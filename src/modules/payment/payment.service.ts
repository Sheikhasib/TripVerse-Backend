import { BookingStatus, PaymentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { SslcommerzValidationResult, generateTranId, sslcommerzInit, sslcommerzValidate } from "../../lib/sslcommerz";
import { AppError } from "../../utils/appError";
import { sendBookingEmail } from "../../utils/email";
import { IGatewayResult, IPaymentCreateRequest, IPaymentGatewayOutcome } from "./payment.interface";

// The gateway POSTs to these URLs server-to-server, so the host must be
// publicly reachable — config.backend_public_url, never localhost in sandbox.
const buildCallbackUrl = (
  bookingId: string,
  tranId: string,
  kind: "success" | "fail" | "cancel" | "ipn",
) =>
  `${config.backend_public_url}/api/payments/${kind === "ipn" ? "ipn" : "confirm"}?bookingId=${bookingId}&tranId=${tranId}${
    kind === "ipn" ? "" : `&status=${kind}`
  }`;

// Opens an SSLCommerz session for a pending booking the user owns. The booking
// amount is frozen at initiation; it never re-reads the package price.
const createPaymentSession = async (
  userId: string,
  payload: IPaymentCreateRequest,
): Promise<{ paymentId: string; tranId: string; paymentUrl: string | null }> => {
  const { bookingId } = payload;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { package: { select: { title: true } } },
  });
  if (!booking) {
    throw new AppError(404, "Booking not found.");
  }
  if (booking.userId !== userId) {
    throw new AppError(403, "You are not authorized to pay for this booking.");
  }
  if (booking.status === BookingStatus.PAID) {
    throw new AppError(409, "This booking is already paid.");
  }
  if (booking.status !== BookingStatus.PENDING) {
    throw new AppError(
      409,
      `Cannot pay for a booking in ${booking.status.toLowerCase()} status.`,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });
  if (!user) {
    throw new AppError(404, "User not found.");
  }

  const amount = Number(booking.totalPrice);
  const tranId = generateTranId();

  // A fresh session supersedes any abandoned ones for this booking.
  await prisma.payment.updateMany({
    where: { bookingId, status: PaymentStatus.INITIATED },
    data: { status: PaymentStatus.CANCELLED },
  });

  const init = await sslcommerzInit({
    total_amount: amount,
    tran_id: tranId,
    success_url: buildCallbackUrl(bookingId, tranId, "success"),
    fail_url: buildCallbackUrl(bookingId, tranId, "fail"),
    cancel_url: buildCallbackUrl(bookingId, tranId, "cancel"),
    ipn_url: buildCallbackUrl(bookingId, tranId, "ipn"),
    cus_name: user.name,
    cus_email: user.email,
    cus_phone: user.phone ?? "01711111111",
  });

  const payment = await prisma.payment.create({
    data: {
      bookingId,
      tranId,
      amount,
      status: PaymentStatus.INITIATED,
      gatewayPageUrl: init.GatewayPageURL,
      sslSessionKey: init.sessionkey,
    },
  });

  return {
    paymentId: payment.id,
    tranId: payment.tranId,
    paymentUrl: payment.gatewayPageUrl,
  };
};

// Server-side verification of a completed transaction: the validator returns
// VALID (first check) or VALIDATED (already verified before) with the amount.
// Anything else — or a mismatched amount — fails the payment.
const verifySuccess = async (
  valId: string,
  expectedAmount: number,
): Promise<{ verified: SslcommerzValidationResult | null; matchesAmount: boolean }> => {
  let verified: SslcommerzValidationResult | null = null;
  try {
    verified = await sslcommerzValidate({ val_id: valId });
  } catch {
    // validator unreachable — fail the payment rather than crash the callback
    return { verified: null, matchesAmount: false };
  }

  const validStatus =
    verified.status === "VALID" || verified.status === "VALIDATED";
  const matchesAmount =
    verified.amount !== undefined && Number(verified.amount) === expectedAmount;

  return { verified, matchesAmount: validStatus && matchesAmount };
};

// Shared by the confirm (success/fail/cancel) and IPN endpoints. Idempotent: a
// settled payment short-circuits, so the double-firing IPN never double-charges.
const processGatewayResult = async (
  bookingId: string,
  tranId: string,
  result: IGatewayResult,
): Promise<IPaymentGatewayOutcome> => {
  const payment = await prisma.payment.findUnique({
    where: { tranId },
    include: {
      booking: {
        include: {
          user: { select: { name: true, email: true } },
          package: { select: { title: true } },
        },
      },
    },
  });

  if (!payment || payment.bookingId !== bookingId) {
    // A callback for a session we never created — nothing to settle.
    return { paymentStatus: PaymentStatus.FAILED, bookingStatus: null, changed: false };
  }

  if (payment.status === PaymentStatus.SUCCESS) {
    return {
      paymentStatus: PaymentStatus.SUCCESS,
      bookingStatus: payment.booking.status,
      changed: false,
    };
  }

  // Cancel callback — the shopper abandoned checkout, no charge was made.
  if (result.fail_status === "CANCELLED" || result.status === "CANCELLED") {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.CANCELLED },
    });
    return {
      paymentStatus: updated.status,
      bookingStatus: payment.booking.status,
      changed: updated.status !== payment.status,
    };
  }

  // No val_id means the gateway reported a failure (fail_url) — nothing to verify.
  if (!result.val_id) {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
    return {
      paymentStatus: updated.status,
      bookingStatus: payment.booking.status,
      changed: updated.status !== payment.status,
    };
  }

  // Success path: verify server-side and only then mark the booking as paid.
  const { verified, matchesAmount } = await verifySuccess(
    result.val_id,
    Number(payment.amount),
  );

  if (!matchesAmount) {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
    return {
      paymentStatus: updated.status,
      bookingStatus: payment.booking.status,
      changed: true,
    };
  }

  const settled = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCESS,
        valId: result.val_id,
        cardType: result.card_type ?? verified?.card_type,
        bankTranId: result.bank_tran_id ?? verified?.bank_tran_id,
        paidAt: new Date(),
      },
    });

    // compare-and-set: only a still-PENDING booking becomes PAID; a booking that
    // was concurrently confirmed or cancelled keeps its state, the money stays on.
    await tx.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.PENDING },
      data: { status: BookingStatus.PAID },
    });

    return updated;
  });

  const bookingAfter = await prisma.booking.findUnique({ where: { id: bookingId } });

  // best-effort "payment received" email — never fails the callback
  void Promise.allSettled([
    sendBookingEmail({
      email: payment.booking.user.email,
      name: payment.booking.user.name,
      packageTitle: payment.booking.package.title,
      travelDate: payment.booking.travelDate,
      travelers: payment.booking.travelers,
      totalPrice: Number(payment.amount),
      status: BookingStatus.PAID,
    }),
  ]);

  return {
    paymentStatus: settled.status,
    bookingStatus: bookingAfter?.status ?? null,
    changed: true,
  };
};

export const paymentService = {
  createPaymentSession,
  processGatewayResult,
};