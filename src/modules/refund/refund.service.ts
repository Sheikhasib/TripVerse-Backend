import { Prisma } from "../../../generated/prisma/client";
import {
  BookingStatus,
  NotificationType,
  PaymentStatus,
  RefundReasonCategory,
  RefundRequestStatus,
  Role,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { runInBackground } from "../../utils/background";
import { sslcommerzRefund } from "../../lib/sslcommerz";
import {
  sendRefundDecisionEmail,
  sendRefundEmail,
  sendRefundReceivedEmail,
} from "../../utils/email";
import { notify } from "../../utils/notification";
import {
  ICreateRefundRequest,
  IDecideRefundRequest,
  IPayoutOutcome,
  IRefundQuery,
} from "./refund.interface";

// ── Policy engine ───────────────────────────────────────────────────────────
// Categories that require documentary evidence and unlock the enhanced
// (admin-discretion, suggested 100%) refund path.
const DOCS_BACKED_CATEGORIES: RefundReasonCategory[] = [
  RefundReasonCategory.MEDICAL_EMERGENCY,
  RefundReasonCategory.BEREAVEMENT,
  RefundReasonCategory.VISA_REJECTION,
  RefundReasonCategory.FORCE_MAJEURE,
];

// A customer can apply at most twice per booking: one application + one
// re-application with new evidence after a rejection (docs/REFUND_POLICY.md).
const MAX_APPLICATIONS = 2;

export const suggestRefundPercentage = (
  category: RefundReasonCategory,
  daysBeforeTravel: number,
): number => {
  if (DOCS_BACKED_CATEGORIES.includes(category)) return 100;
  if (daysBeforeTravel >= 30) return 90;
  if (daysBeforeTravel >= 15) return 50;
  if (daysBeforeTravel >= 7) return 25;
  return 0;
};

const toUTCMidnight = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const daysUntilTravel = (travelDate: Date) => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const today = toUTCMidnight(new Date()).getTime();
  const travelDay = toUTCMidnight(travelDate).getTime();
  return Math.floor((travelDay - today) / DAY_MS);
};

// ── Actor + access ──────────────────────────────────────────────────────────
type RefundActor = { id: string; role: Role };

const canView = (
  request: { userId: string },
  actor: RefundActor,
): boolean => request.userId === actor.id || actor.role === Role.ADMIN;

// ── Selects + response mapping (Decimal → Number) ───────────────────────────
const refundPackageSelect = {
  select: { id: true, title: true, slug: true, location: true, images: true },
} as const;

const refundUserSelect = {
  select: { id: true, name: true, email: true },
} as const;

type RefundRequestWithRelations = Prisma.RefundRequestGetPayload<{
  include: {
    booking: { include: { package: typeof refundPackageSelect } };
    user: typeof refundUserSelect;
    reviewer: typeof refundUserSelect;
  };
}>;

const mapRefundRequest = (
  request: RefundRequestWithRelations | null,
): Record<string, unknown> | null => {
  if (!request) return null;
  const { refundAmount, ...rest } = request;
  return {
    ...rest,
    refundAmount: refundAmount === null ? null : Number(refundAmount),
    booking: {
      ...request.booking,
      totalPrice: Number(request.booking.totalPrice),
    },
  };
};

// ── Create application ───────────────────────────────────────────────────────
const createRefundRequest = async (
  userId: string,
  payload: ICreateRefundRequest,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: payload.bookingId },
    include: { package: { select: { title: true } }, user: refundUserSelect },
  });

  if (!booking || booking.userId !== userId) {
    throw new AppError(404, "Booking not found.");
  }
  if (
    booking.status !== BookingStatus.PAID &&
    booking.status !== BookingStatus.CONFIRMED
  ) {
    throw new AppError(
      400,
      "Refunds can only be requested for paid bookings.",
    );
  }

  // One LIVE application per booking; a rejection frees exactly one re-apply,
  // up to MAX_APPLICATIONS lifetime rejections.
  const latest = await prisma.refundRequest.findFirst({
    where: { bookingId: booking.id },
    orderBy: { createdAt: "desc" },
  });
  if (latest && latest.status !== RefundRequestStatus.REJECTED) {
    throw new AppError(
      409,
      "A refund application already exists for this booking.",
    );
  }
  const rejectedCount = await prisma.refundRequest.count({
    where: {
      bookingId: booking.id,
      status: RefundRequestStatus.REJECTED,
    },
  });
  if (rejectedCount >= MAX_APPLICATIONS) {
    throw new AppError(
      409,
      "The refund application limit has been reached for this booking.",
    );
  }

  // Policy snapshot — immutable after create; decisions read this, never recompute.
  const daysBeforeTravel = daysUntilTravel(booking.travelDate);
  const suggestedPercentage = suggestRefundPercentage(
    payload.category,
    daysBeforeTravel,
  );

  const created = await prisma.refundRequest.create({
    data: {
      bookingId: booking.id,
      userId,
      category: payload.category,
      reason: payload.reason,
      evidenceUrl: payload.evidenceUrl ?? null,
      daysBeforeTravel,
      suggestedPercentage,
    },
    include: {
      booking: { include: { package: refundPackageSelect } },
      user: refundUserSelect,
      reviewer: refundUserSelect,
    },
  });

  runInBackground([
    sendRefundReceivedEmail({
      email: booking.user.email,
      name: booking.user.name,
      packageTitle: booking.package.title,
      travelDate: booking.travelDate,
      category: payload.category,
    }),
    notify(
      userId,
      NotificationType.REFUND_REQUESTED,
      "Refund application received",
      `Your refund application for "${booking.package.title}" is under review. We'll update you within 5 business days.`,
      `/dashboard/bookings/${booking.id}`,
    ),
  ]);

  return mapRefundRequest(created);
};

// ── Lists + detail ───────────────────────────────────────────────────────────
const refundInclude = {
  booking: { include: { package: refundPackageSelect } },
  user: refundUserSelect,
  reviewer: refundUserSelect,
} as const;

const paginateRefunds = async (
  where: Prisma.RefundRequestWhereInput,
  query: IRefundQuery,
) => {
  const page = query.page || 1;
  const limit = query.limit || 10;

  const [data, total] = await Promise.all([
    prisma.refundRequest.findMany({
      where,
      include: refundInclude,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.refundRequest.count({ where }),
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

const getMyRefundRequests = async (userId: string, query: IRefundQuery) => {
  const where: Prisma.RefundRequestWhereInput = { userId };
  if (query.status) where.status = query.status;

  const result = await paginateRefunds(where, query);
  return { ...result, data: result.data.map(mapRefundRequest) };
};

const getAllRefundRequests = async (query: IRefundQuery) => {
  const where: Prisma.RefundRequestWhereInput = {};
  if (query.status) where.status = query.status;

  const result = await paginateRefunds(where, query);
  return { ...result, data: result.data.map(mapRefundRequest) };
};

const getRefundRequestDetail = async (id: string, actor: RefundActor) => {
  const request = await prisma.refundRequest.findUnique({
    where: { id },
    include: refundInclude,
  });

  if (!request) {
    throw new AppError(404, "Refund request not found.");
  }
  if (!canView(request, actor)) {
    throw new AppError(403, "You are not authorized to view this refund request.");
  }

  return mapRefundRequest(request);
};

// ── Decision (ADMIN) ─────────────────────────────────────────────────────────
const decideRefundRequest = async (
  id: string,
  payload: IDecideRefundRequest,
  admin: RefundActor,
): Promise<{ refundRequest: Record<string, unknown>; payout?: IPayoutOutcome }> => {
  const request = await prisma.refundRequest.findUnique({
    where: { id },
    include: {
      booking: {
        include: { package: { select: { title: true } }, user: refundUserSelect },
      },
    },
  });

  if (!request) {
    throw new AppError(404, "Refund request not found.");
  }

  if (payload.action === "REJECT") {
    // CAS: only a still-PENDING request accepts a decision — a concurrent or
    // repeated decision loses the race and surfaces as 409.
    const flipped = await prisma.refundRequest.updateMany({
      where: { id: request.id, status: RefundRequestStatus.PENDING },
      data: {
        status: RefundRequestStatus.REJECTED,
        reviewNote: payload.reviewNote!,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    if (flipped.count === 0) {
      throw new AppError(409, "This refund request has already been decided.");
    }

    runInBackground([
      sendRefundDecisionEmail({
        email: request.booking.user.email,
        name: request.booking.user.name,
        packageTitle: request.booking.package.title,
        approved: false,
        reviewNote: payload.reviewNote,
      }),
      notify(
        request.userId,
        NotificationType.REFUND_REJECTED,
        "Refund application rejected",
        payload.reviewNote!,
        `/dashboard/bookings/${request.bookingId}`,
      ),
    ]);

    const fresh = await prisma.refundRequest.findUnique({
      where: { id: request.id },
      include: refundInclude,
    });
    return { refundRequest: mapRefundRequest(fresh)! };
  }

  // ── APPROVE branch ────────────────────────────────────────────────────────
  // Final percentage: admin override clamped to 0-100; CHANGE_OF_PLANS can
  // never exceed the submitted tier (only docs-backed categories may).
  let percentage = payload.approvedPercentage ?? request.suggestedPercentage;
  if (request.category === RefundReasonCategory.CHANGE_OF_PLANS) {
    percentage = Math.min(percentage, request.suggestedPercentage);
  }
  percentage = Math.max(0, Math.min(100, percentage));

  const settledPayments = await prisma.payment.findMany({
    where: {
      bookingId: request.bookingId,
      status: PaymentStatus.SUCCESS,
      refundCompletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });
  const paidTotal = settledPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  // Never approve more than the money actually taken.
  const amount = Math.min(
    Math.round(Number(request.booking.totalPrice) * (percentage / 100)),
    paidTotal,
  );

  // One transaction, two CAS writes: the approval and the cancellation commit
  // together or not at all (e.g. an agency cancel racing in → 409 rollback).
  // The request CAS runs first so a repeated decision reports itself accurately.
  const approved = await prisma.$transaction(async (tx) => {
    const requestFlip = await tx.refundRequest.updateMany({
      where: { id: request.id, status: RefundRequestStatus.PENDING },
      data: {
        status: RefundRequestStatus.APPROVED,
        approvedPercentage: percentage,
        refundAmount: amount,
        reviewNote: payload.reviewNote ?? null,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    if (requestFlip.count === 0) {
      throw new AppError(409, "This refund request has already been decided.");
    }

    const bookingFlip = await tx.booking.updateMany({
      where: {
        id: request.bookingId,
        status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] },
      },
      data: { status: BookingStatus.CANCELLED },
    });
    if (bookingFlip.count === 0) {
      throw new AppError(409, "The booking is no longer active.");
    }

    // Cancelling abandons any non-settled sessions (no money was taken) —
    // mirrors updateBookingStatus's CANCELLED branch.
    await tx.payment.updateMany({
      where: { bookingId: request.bookingId, status: PaymentStatus.INITIATED },
      data: { status: PaymentStatus.CANCELLED },
    });

    return true;
  });

  // ── Gateway payout (after commit; mirrors booking.service issueRefunds) ──
  let remaining = amount;
  let refundedTotal = 0;
  let firstFailure: string | null = null;
  const refundRefs: string[] = [];

  for (const payment of settledPayments) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, Number(payment.amount));

    if (!payment.bankTranId) {
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
        refund_amount: slice,
        refund_remarks: `Refund request ${request.id} - TripVerse`,
        refe_id: request.id,
      });

      // CAS: only a still-SUCCESS payment flips to REFUNDED — a concurrent
      // refund loses the race (count 0) and is a no-op.
      const flippedPayment = await prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.SUCCESS },
        data: {
          status: PaymentStatus.REFUNDED,
          refundRefId: gateway.refund_ref_id ?? payment.refundRefId ?? null,
          refundCompletedAt: new Date(),
        },
      });

      if (flippedPayment.count === 0) continue;
      refundedTotal += slice;
      remaining -= slice;
      if (gateway.refund_ref_id) refundRefs.push(gateway.refund_ref_id);
    } catch (error) {
      firstFailure ??= error instanceof Error ? error.message : String(error);
      // Money hasn't left the gateway — leave SUCCESS, mark for retry.
      await prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.SUCCESS },
        data: { refundInitiatedAt: new Date() },
      });
    }
  }

  // Fully paid out (or nothing owed) → terminal state. Any shortfall keeps the
  // request APPROVED so the owed money stays visible for manual retry.
  const payout: IPayoutOutcome =
    !firstFailure && remaining <= 0
      ? { status: "SUCCESS", refundedTotal }
      : { status: "FAILED", message: firstFailure ?? "Payout could not be completed." };

  if (payout.status === "SUCCESS") {
    await prisma.refundRequest.updateMany({
      where: { id: request.id, status: RefundRequestStatus.APPROVED },
      data: { status: RefundRequestStatus.REFUNDED },
    });
  }

  runInBackground([
    sendRefundDecisionEmail({
      email: request.booking.user.email,
      name: request.booking.user.name,
      packageTitle: request.booking.package.title,
      approved: true,
      amount,
      percentage,
      reviewNote: payload.reviewNote,
    }),
    ...(payout.status === "SUCCESS" && refundRefs.length > 0
      ? [
          sendRefundEmail({
            email: request.booking.user.email,
            name: request.booking.user.name,
            packageTitle: request.booking.package.title,
            travelDate: request.booking.travelDate,
            amount: refundedTotal,
            refundRefId: refundRefs[0],
          }),
        ]
      : []),
    notify(
      request.userId,
      NotificationType.REFUND_APPROVED,
      "Refund approved",
      `Your refund of ৳${amount.toFixed(2)} for "${request.booking.package.title}" was approved.`,
      `/dashboard/bookings/${request.bookingId}`,
    ),
  ]);

  const fresh = await prisma.refundRequest.findUnique({
    where: { id: request.id },
    include: refundInclude,
  });
  return { refundRequest: mapRefundRequest(fresh)!, payout };
};

export const refundService = {
  suggestRefundPercentage,
  createRefundRequest,
  getMyRefundRequests,
  getAllRefundRequests,
  getRefundRequestDetail,
  decideRefundRequest,
};
