import { Prisma } from "../../../generated/prisma/client";
import { BookingStatus, PaymentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { SslcommerzInitResult, SslcommerzValidationResult, generateTranId, sslcommerzInit, sslcommerzValidate } from "../../lib/sslcommerz";
import { AppError } from "../../utils/appError";
import { sendBookingEmail } from "../../utils/email";
import { runInBackground } from "../../utils/background";
import { issueRefunds } from "../booking/booking.service";
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

  // One live session per booking: the ledger row is created atomically while
  // superseding any abandoned session, then the gateway is asked. The row
  // survives regardless of the gateway response — init failure flips it to
  // FAILED below so a truthful entry always exists.
  const payment = await prisma.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { bookingId, status: PaymentStatus.INITIATED },
      data: { status: PaymentStatus.CANCELLED },
    });

    return tx.payment.create({
      data: {
        bookingId,
        tranId,
        amount,
        status: PaymentStatus.INITIATED,
      },
    });
  });

  let init: SslcommerzInitResult;
  try {
    init = await sslcommerzInit({
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
  } catch (error) {
    // keep the ledger truthful — the session never reached the gateway. The
    // status guard makes a concurrent /create that already cancelled this row
    // win the race (that row stays cancelled, this one fails only if live).
    await prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.INITIATED },
      data: { status: PaymentStatus.FAILED },
    });
    throw error;
  }

  // store the gateway URLs only if the row is still the live session.
  await prisma.payment.updateMany({
    where: { id: payment.id, status: PaymentStatus.INITIATED },
    data: { gatewayPageUrl: init.GatewayPageURL, sslSessionKey: init.sessionkey },
  });

  return {
    paymentId: payment.id,
    tranId: payment.tranId,
    paymentUrl: init.GatewayPageURL ?? null,
  };
};

// Money compared in integer paisa — never float ===.
const toPaisa = (value: string | number | Prisma.Decimal): number | null => {
  try {
    return new Prisma.Decimal(value).mul(100).round().toNumber();
  } catch {
    return null; // not a number
  }
};

// Server-side verification of a completed transaction: the validator returns
// VALID (first check) or VALIDATED (already verified before). The result must
// also belong to THIS payment — same tran_id, same amount (in paisa), BDT —
// otherwise a val_id from another paid booking could be replayed here.
const verifySuccess = async (
  valId: string,
  expected: { tranId: string; amount: Prisma.Decimal },
): Promise<{ verified: SslcommerzValidationResult | null; isValid: boolean }> => {
  let verified: SslcommerzValidationResult | null = null;
  try {
    verified = await sslcommerzValidate({ val_id: valId });
  } catch {
    // validator unreachable — fail the payment rather than crash the callback
    return { verified: null, isValid: false };
  }

  const validStatus =
    verified.status === "VALID" || verified.status === "VALIDATED";
  const matchesTranId = verified.tran_id === expected.tranId;
  const paid = verified.amount === undefined ? null : toPaisa(verified.amount);
  const matchesAmount = paid !== null && paid === toPaisa(expected.amount);
  const matchesCurrency = (verified.currency_type ?? verified.currency) === "BDT";

  return {
    verified,
    isValid: validStatus && matchesTranId && matchesAmount && matchesCurrency,
  };
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

  // Settled (or refunded) rows are final — a replayed or late callback can't move them.
  if (
    payment.status === PaymentStatus.SUCCESS ||
    payment.status === PaymentStatus.REFUNDED
  ) {
    return {
      paymentStatus: payment.status,
      bookingStatus: payment.booking.status,
      changed: false,
    };
  }

  // Moves the row only while it is still INITIATED (compare-and-set). A late
  // fail/cancel callback therefore can never overwrite SUCCESS, and the
  // outcome reports whatever the row really ended up as.
  const closeSession = async (to: PaymentStatus): Promise<IPaymentGatewayOutcome> => {
    const { count } = await prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.INITIATED },
      data: { status: to },
    });
    const [current, booking] = await Promise.all([
      prisma.payment.findUnique({ where: { id: payment.id }, select: { status: true } }),
      prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true } }),
    ]);
    return {
      paymentStatus: current?.status ?? to,
      bookingStatus: booking?.status ?? null,
      changed: count > 0,
    };
  };

  // Cancel callback — the shopper abandoned checkout, no charge was made.
  if (result.fail_status === "CANCELLED" || result.status === "CANCELLED") {
    return closeSession(PaymentStatus.CANCELLED);
  }

  // No val_id means the gateway reported a failure (fail_url) — nothing to verify.
  if (!result.val_id) {
    return closeSession(PaymentStatus.FAILED);
  }

  // Success path: verify server-side and only then mark the booking as paid.
  const { verified, isValid } = await verifySuccess(result.val_id, {
    tranId: payment.tranId,
    amount: payment.amount,
  });

  if (!isValid) {
    return closeSession(PaymentStatus.FAILED);
  }

  // Compare-and-set on both rows. Confirm and IPN can arrive together: only the
  // call whose payment update matches (count 1) settles and sends the email.
  const settled = await prisma.$transaction(async (tx) => {
    const paymentCas = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: [PaymentStatus.INITIATED, PaymentStatus.CANCELLED, PaymentStatus.FAILED],
        },
      },
      data: {
        status: PaymentStatus.SUCCESS,
        valId: result.val_id,
        cardType: result.card_type ?? verified?.card_type,
        bankTranId: result.bank_tran_id ?? verified?.bank_tran_id,
        paidAt: new Date(),
      },
    });
    if (paymentCas.count === 0) return { won: false, bookingPaid: false };

    // only a still-PENDING booking becomes PAID; one that was cancelled or
    // confirmed meanwhile keeps its state.
    const bookingCas = await tx.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.PENDING },
      data: { status: BookingStatus.PAID },
    });
    return { won: true, bookingPaid: bookingCas.count > 0 };
  });

  const [paymentAfter, bookingAfter] = await Promise.all([
    prisma.payment.findUnique({ where: { id: payment.id }, select: { status: true } }),
    prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true } }),
  ]);

  if (!settled.won) {
    // the other callback settled first — it owns the email and any refund
    return {
      paymentStatus: paymentAfter?.status ?? PaymentStatus.SUCCESS,
      bookingStatus: bookingAfter?.status ?? null,
      changed: false,
    };
  }

  const user = payment.booking.user;
  const packageTitle = payment.booking.package.title;

  if (settled.bookingPaid) {
    // best-effort "payment received" email — never fails the callback
    runInBackground([
      sendBookingEmail({
        email: user.email,
        name: user.name,
        packageTitle,
        travelDate: payment.booking.travelDate,
        travelers: payment.booking.travelers,
        totalPrice: Number(payment.amount),
        status: BookingStatus.PAID,
      }),
    ]);
  } else if (bookingAfter?.status === BookingStatus.CANCELLED) {
    // Money arrived for a booking that was already cancelled: give it back
    // right away rather than keeping it.
    await issueRefunds(bookingId, {
      email: user.email,
      name: user.name,
      packageTitle,
      travelDate: payment.booking.travelDate,
    });
  }

  const finalPayment = await prisma.payment.findUnique({
    where: { id: payment.id },
    select: { status: true },
  });

  return {
    paymentStatus: finalPayment?.status ?? PaymentStatus.SUCCESS,
    bookingStatus: bookingAfter?.status ?? null,
    changed: true,
  };
};

export const paymentService = {
  createPaymentSession,
  processGatewayResult,
};