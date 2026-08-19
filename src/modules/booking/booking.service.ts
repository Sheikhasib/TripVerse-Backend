import { Prisma } from "../../../generated/prisma/client";
import { BookingStatus, NotificationType, PackageStatus, PaymentStatus, Role } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { sslcommerzRefund } from "../../lib/sslcommerz";
import { sendBookingEmail, sendRefundEmail } from "../../utils/email";
import { notify } from "../../utils/notification";
import {
  IBookingQuery,
  IBookingSearchQuery,
  ICreateBooking,
  IRefundOutcome,
  IUpdateBookingStatus,
} from "./booking.interface";

// A PENDING booking older than this is treated as an abandoned checkout:
// it's auto-cancelled so the user can rebook the same package+date.
const STALE_BOOKING_HOURS = 24;

const toUTCMidnight = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

// ── Actor + ownership ────────────────────────────────────────────────────
type BookingActor = { id: string; role: Role };

// Structural subset — only what the ownership checks need.
type BookingOwnerInfo = {
  userId: string;
  package: { agentId: string };
};

// Booking owner, the AGENT who owns the package, or ADMIN — full manage scope.
const canManage = (booking: BookingOwnerInfo, actor: BookingActor) =>
  booking.userId === actor.id ||
  (actor.role === Role.AGENT && booking.package.agentId === actor.id) ||
  actor.role === Role.ADMIN;

// Only the package-owning AGENT or ADMIN can move a booking's money status
// (PENDING→CONFIRMED, CONFIRMED→COMPLETED, CONFIRMED→PENDING).
const isAgentOwnerOrAdmin = (booking: BookingOwnerInfo, actor: BookingActor) =>
  actor.role === Role.ADMIN ||
  (actor.role === Role.AGENT && booking.package.agentId === actor.id);

// ── State machine ─────────────────────────────────────────────────────────
type TransitionRule = {
  allowed: (booking: BookingOwnerInfo, actor: BookingActor) => boolean;
  requiresTravelDatePassed?: boolean;
  beforeTravelDate?: boolean;
};

const TRANSITIONS: Partial<
  Record<BookingStatus, Partial<Record<BookingStatus, TransitionRule>>>
> = {
  [BookingStatus.PENDING]: {
    [BookingStatus.CONFIRMED]: { allowed: isAgentOwnerOrAdmin },
    [BookingStatus.CANCELLED]: { allowed: canManage },
  },
  [BookingStatus.PAID]: {
    [BookingStatus.CONFIRMED]: { allowed: isAgentOwnerOrAdmin },
    [BookingStatus.CANCELLED]: { allowed: canManage },
  },
  [BookingStatus.CONFIRMED]: {
    [BookingStatus.COMPLETED]: {
      allowed: isAgentOwnerOrAdmin,
      requiresTravelDatePassed: true,
    },
    [BookingStatus.CANCELLED]: { allowed: canManage },
    [BookingStatus.PENDING]: {
      allowed: isAgentOwnerOrAdmin,
      beforeTravelDate: true,
    },
  },
};

// ── Response mapping (Decimal → Number) ───────────────────────────────────
const bookingPackageSelect = {
  select: {
    id: true,
    title: true,
    slug: true,
    location: true,
    images: true,
    price: true,
  },
} as const;

// Detail view adds agentId (needed by ownership checks in the service).
const bookingPackageDetailSelect = {
  select: {
    id: true,
    title: true,
    slug: true,
    location: true,
    images: true,
    price: true,
    agentId: true,
  },
} as const;

const bookingUserSelect = {
  select: { id: true, name: true, email: true },
} as const;

// Payment ledger shown on the booking detail page (amounts stay Decimal in DB).
const bookingPaymentSelect = {
  select: {
    id: true,
    tranId: true,
    amount: true,
    currency: true,
    status: true,
    cardType: true,
    bankTranId: true,
    valId: true,
    paidAt: true,
    refundRefId: true,
    refundInitiatedAt: true,
    refundCompletedAt: true,
  },
} as const;

// Payments ordered newest-first so consumers can rely on payments[0] being the
// latest attempt (used for the user payment-history "latest status" row).
const bookingPaymentsInclude = {
  ...bookingPaymentSelect,
  orderBy: { createdAt: "desc" as const },
} as const;

type BookingWitPackage = Prisma.BookingGetPayload<{
  include: { package: typeof bookingPackageSelect };
}>;

// Payments show on list rows too (DoD: "list/detail now includes payments"),
// mapped to Number at the boundary like the rest of the money fields.
type BookingPaymentItem = {
  id: string;
  tranId: string;
  amount: unknown;
  currency: string;
  status: string;
  cardType: string | null;
  bankTranId: string | null;
  valId: string | null;
  paidAt: Date | null;
};

const mapBookingList = (booking: BookingWitPackage & { payments?: BookingPaymentItem[] }) => ({
  ...booking,
  totalPrice: Number(booking.totalPrice),
  package: { ...booking.package, price: Number(booking.package.price) },
  payments: booking.payments?.map((p) => ({ ...p, amount: Number(p.amount) })),
});

// ── Create booking ─────────────────────────────────────────────────────────
const createBooking = async (userId: string, payload: ICreateBooking) => {
  const { packageId, travelers } = payload;
  const travelDate = toUTCMidnight(payload.travelDate);

  const tourPackage = await prisma.tourPackage.findUnique({
    where: { id: packageId },
  });
  if (
    !tourPackage ||
    tourPackage.isDeleted ||
    tourPackage.status !== PackageStatus.APPROVED
  ) {
    throw new AppError(409, "Package is not available for booking.");
  }

  // totalPrice is computed server-side from the package's current price —
  // anything the client sends is ignored.
  const totalPrice = Number(tourPackage.price) * travelers;

  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findFirst({
      where: {
        userId,
        packageId,
        travelDate,
        status: BookingStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      const isRecent =
        existing.createdAt.getTime() >=
        Date.now() - STALE_BOOKING_HOURS * 60 * 60 * 1000;

      if (isRecent) {
        throw new AppError(
          409,
          "You already have a pending booking for this package on this date.",
        );
      }

      // abandoned checkout — cancel it in the same transaction and rebook
      await tx.booking.update({
        where: { id: existing.id },
        data: { status: BookingStatus.CANCELLED },
      });
    }

    return tx.booking.create({
      data: { userId, packageId, travelDate, travelers, totalPrice },
    });
  });

  // best-effort email — never fails the request
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (user) {
    void Promise.allSettled([
      sendBookingEmail({
        email: user.email,
        name: user.name,
        packageTitle: tourPackage.title,
        travelDate,
        travelers,
        totalPrice,
        status: BookingStatus.PENDING,
      }),
    ]);
  }

  // best-effort in-app notification to the package agent (never fails request)
  void Promise.allSettled([
    notify(
      tourPackage.agentId,
      NotificationType.BOOKING_CREATED,
      "New booking received",
      `A new booking has been placed for "${tourPackage.title}".`,
      `/dashboard/agent/bookings/${created.id}`,
    ),
  ]);

  return {
    ...created,
    totalPrice: Number(created.totalPrice),
  };
};

// ── List helpers ───────────────────────────────────────────────────────────
const paginateBooking = async (
  where: Prisma.BookingWhereInput,
  include: Prisma.BookingInclude,
  query: IBookingQuery,
) => {
  const page = query.page || 1;
  const limit = query.limit || 10;

  const [data, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ── My bookings ────────────────────────────────────────────────────────────
const getMyBookings = async (userId: string, query: IBookingQuery) => {
  const where: Prisma.BookingWhereInput = { userId };
  if (query.status) where.status = query.status;

  const result = await paginateBooking(
    where,
    { package: bookingPackageSelect, payments: bookingPaymentsInclude },
    query,
  );
  return { ...result, data: result.data.map(mapBookingList) };
};

// ── Agent bookings (scoped to own packages) ────────────────────────────────
const getAgentBookings = async (
  agentId: string,
  query: IBookingSearchQuery,
) => {
  const where: Prisma.BookingWhereInput = {
    package: { agentId },
  };
  if (query.status) where.status = query.status;
  if (query.search) {
    where.package = {
      agentId,
      title: { contains: query.search, mode: "insensitive" },
    };
  }

  const result = await paginateBooking(
    where,
    { package: bookingPackageSelect, payments: bookingPaymentsInclude },
    query,
  );
  return { ...result, data: result.data.map(mapBookingList) };
};

// ── Admin: all bookings ────────────────────────────────────────────────────
const getAllBookings = async (query: IBookingSearchQuery) => {
  const where: Prisma.BookingWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.package = { title: { contains: query.search, mode: "insensitive" } };
  }

  const result = await paginateBooking(
    where,
    {
      package: bookingPackageSelect,
      user: bookingUserSelect,
      payments: bookingPaymentsInclude,
    },
    query,
  );
  return { ...result, data: result.data.map(mapBookingList) };
};

// ── Booking detail ──────────────────────────────────────────────────────────
const getBookingDetail = async (id: string, actor: BookingActor) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      package: bookingPackageDetailSelect,
      user: bookingUserSelect,
      payments: bookingPaymentsInclude,
    },
  });

  if (!booking) {
    throw new AppError(404, "Booking not found.");
  }
  if (!canManage(booking, actor)) {
    throw new AppError(403, "You are not authorized to view this booking.");
  }

  return mapBookingList(booking);
};

// ── Refund (booking cancelled with settled money) ───────────────────────────
// Runs AFTER the status-transition transaction commits, so a gateway failure can
// never roll back the cancellation itself. Each settled payment is refunded via
// the SSLCommerz Refund API; the ledger flips to REFUNDED ONLY after the gateway
// confirms — a failed refund leaves the payment SUCCESS with refundInitiatedAt
// set so a later retry/manual action can find it (spec 23).
type RefundContext = {
  email: string;
  name: string;
  packageTitle: string;
  travelDate: Date;
};

const issueRefunds = async (
  bookingId: string,
  ctx: RefundContext,
): Promise<IRefundOutcome | null> => {
  const payments = await prisma.payment.findMany({
    where: { bookingId, status: PaymentStatus.SUCCESS, refundCompletedAt: null },
  });
  if (payments.length === 0) return null;

  let allSucceeded = true;
  let firstFailure: string | null = null;
  let refundedTotal = 0;
  const refundRefs: string[] = [];

  for (const payment of payments) {
    if (!payment.bankTranId) {
      allSucceeded = false;
      firstFailure ??= "Payment has no bank transaction id to refund against.";
      await prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.SUCCESS },
        data: { refundInitiatedAt: new Date() },
      });
      continue;
    }

    try {
      const gateway = await sslcommerzRefund({
        bank_tran_id: payment.bankTranId,
        refund_amount: Number(payment.amount),
        refund_remarks: `Booking ${bookingId} cancelled - TripVerse`,
        refe_id: bookingId,
      });

      // CAS: only a still-SUCCESS payment flips to REFUNDED — a concurrent
      // refund loses the race (count 0) and is a no-op. Never double-refunds.
      const flipped = await prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.SUCCESS },
        data: {
          status: PaymentStatus.REFUNDED,
          refundRefId: gateway.refund_ref_id ?? payment.refundRefId ?? null,
          refundCompletedAt: new Date(),
        },
      });

      if (flipped.count === 0) continue; // already refunded by a concurrent path
      refundedTotal += Number(payment.amount);
      if (gateway.refund_ref_id) refundRefs.push(gateway.refund_ref_id);
    } catch (error) {
      allSucceeded = false;
      firstFailure ??=
        error instanceof Error ? error.message : String(error);
      // money hasn't left the gateway — leave status SUCCESS, mark for retry
      await prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.SUCCESS },
        data: { refundInitiatedAt: new Date() },
      });
    }
  }

  if (refundRefs.length > 0) {
    void Promise.allSettled([
      sendRefundEmail({
        email: ctx.email,
        name: ctx.name,
        packageTitle: ctx.packageTitle,
        travelDate: ctx.travelDate,
        amount: refundedTotal,
        refundRefId: refundRefs[0],
      }),
    ]);
  }

  return allSucceeded
    ? { status: "SUCCESS" }
    : { status: "FAILED", message: firstFailure ?? "Refund could not be processed." };
};

// ── Status transition ───────────────────────────────────────────────────────
const updateBookingStatus = async (
  id: string,
  payload: IUpdateBookingStatus,
  actor: BookingActor,
) => {
  const { status: to } = payload;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      package: {
        select: { id: true, agentId: true, title: true },
      },
      user: bookingUserSelect,
    },
  });

  if (!booking) {
    throw new AppError(404, "Booking not found.");
  }

  if (!canManage(booking, actor)) {
    throw new AppError(403, "You are not authorized to perform this action.");
  }

  const rule = TRANSITIONS[booking.status]?.[to];
  if (!rule) {
    throw new AppError(
      400,
      `Cannot transition booking from ${booking.status} to ${to}.`,
    );
  }
  if (!rule.allowed(booking, actor)) {
    throw new AppError(403, "You are not authorized to perform this action.");
  }

  const travelDay = toUTCMidnight(booking.travelDate).getTime();
  const now = Date.now();
  if (rule.requiresTravelDatePassed && travelDay > now) {
    throw new AppError(
      400,
      "Booking can only be completed after the travel date has passed.",
    );
  }
  if (rule.beforeTravelDate && travelDay <= now) {
    throw new AppError(
      400,
      "Booking can only be reverted before the travel date.",
    );
  }

  // compare-and-set: the transition applies only if the recorded status still
  // matches — a concurrent change makes count 0 and the request fails safely.
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.booking.updateMany({
      where: { id, status: booking.status },
      data: { status: to },
    });
    if (result.count === 0) {
      throw new AppError(
        409,
        "Booking status changed concurrently. Please try again.",
      );
    }

    // Cancelling a booking abandons any non-settled sessions (no money was
    // taken). Settled (SUCCESS) payments are NOT touched here — the gateway
    // refund + REFUNDED flip happen after this transaction commits, so a gateway
    // failure can never roll back the cancellation itself (spec 23).
    if (to === BookingStatus.CANCELLED) {
      await tx.payment.updateMany({
        where: { bookingId: id, status: PaymentStatus.INITIATED },
        data: { status: PaymentStatus.CANCELLED },
      });
    }

    return tx.booking.findUnique({ where: { id } });
  });

  if (!updated) {
    throw new AppError(404, "Booking not found.");
  }

  // synchronous gateway refund for settled money (booking already CANCELLED).
  // The outcome is surfaced to the actor; a gateway hiccup never fails the
  // cancellation itself.
  let refund: IRefundOutcome | null = null;
  if (to === BookingStatus.CANCELLED) {
    refund = await issueRefunds(id, {
      email: booking.user.email,
      name: booking.user.name,
      packageTitle: booking.package.title,
      travelDate: booking.travelDate,
    });
  }

  // best-effort email for money-status changes
  if (to === BookingStatus.CONFIRMED || to === BookingStatus.CANCELLED) {
    void Promise.allSettled([
      sendBookingEmail({
        email: booking.user.email,
        name: booking.user.name,
        packageTitle: booking.package.title,
        travelDate: booking.travelDate,
        travelers: booking.travelers,
        totalPrice: Number(booking.totalPrice),
        status: to,
      }),
    ]);
  }

  // best-effort in-app notifications (never fails request). Recipient of a
  // cancellation depends on the actor: the customer cancels → the agent hears;
  // the agent cancels → the customer hears; an ADMIN cancels → both hear, since
  // the admin acts on behalf of the platform, not either side.
  if (to === BookingStatus.CONFIRMED) {
    void Promise.allSettled([
      notify(
        booking.userId,
        NotificationType.BOOKING_CONFIRMED,
        "Booking confirmed",
        `Your booking for "${booking.package.title}" has been confirmed.`,
        `/dashboard/bookings/${id}`,
      ),
    ]);
  }

  if (to === BookingStatus.CANCELLED) {
    const recipients: string[] = [];
    if (actor.id === booking.userId) {
      recipients.push(booking.package.agentId);
    } else if (
      actor.role === Role.AGENT &&
      booking.package.agentId === actor.id
    ) {
      recipients.push(booking.userId);
    } else if (actor.role === Role.ADMIN) {
      recipients.push(booking.userId, booking.package.agentId);
    }

    void Promise.allSettled(
      [...new Set(recipients)].map((recipientId) =>
        notify(
          recipientId,
          NotificationType.BOOKING_CANCELLED,
          "Booking cancelled",
          `The booking for "${booking.package.title}" has been cancelled.`,
          `/dashboard/bookings/${id}`,
        ),
      ),
    );
  }

  return {
    ...updated,
    totalPrice: Number(updated.totalPrice),
    ...(refund ? { refund } : {}),
  };
};

export const bookingService = {
  createBooking,
  getMyBookings,
  getAgentBookings,
  getAllBookings,
  getBookingDetail,
  updateBookingStatus,
};