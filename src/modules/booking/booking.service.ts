import { Prisma } from "../../../generated/prisma/client";
import { BookingStatus, PackageStatus, Role } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { sendBookingEmail } from "../../utils/email";
import {
  IBookingQuery,
  IBookingSearchQuery,
  ICreateBooking,
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

type BookingWitPackage = Prisma.BookingGetPayload<{
  include: { package: typeof bookingPackageSelect };
}>;

const mapBookingList = (booking: BookingWitPackage) => ({
  ...booking,
  totalPrice: Number(booking.totalPrice),
  package: { ...booking.package, price: Number(booking.package.price) },
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

  const result = await paginateBooking(where, { package: bookingPackageSelect }, query);
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

  const result = await paginateBooking(where, { package: bookingPackageSelect }, query);
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
    { package: bookingPackageSelect, user: bookingUserSelect },
    query,
  );
  return { ...result, data: result.data.map(mapBookingList) };
};

// ── Booking detail ──────────────────────────────────────────────────────────
const getBookingDetail = async (id: string, actor: BookingActor) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { package: bookingPackageDetailSelect, user: bookingUserSelect },
  });

  if (!booking) {
    throw new AppError(404, "Booking not found.");
  }
  if (!canManage(booking, actor)) {
    throw new AppError(403, "You are not authorized to view this booking.");
  }

  return mapBookingList(booking);
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
    return tx.booking.findUnique({ where: { id } });
  });

  if (!updated) {
    throw new AppError(404, "Booking not found.");
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

  return { ...updated, totalPrice: Number(updated.totalPrice) };
};

export const bookingService = {
  createBooking,
  getMyBookings,
  getAgentBookings,
  getAllBookings,
  getBookingDetail,
  updateBookingStatus,
};