import { Prisma } from "../../../generated/prisma/client";
import { BookingStatus, PackageStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import {
  IAgentDashboard,
  IAdminDashboard,
  IBookingsByStatus,
  IRevenuePoint,
  IUserDashboard,
} from "./dashboard.interface";

// Money is `Decimal(10,2)` in the schema (AGENTS.md) — map to Number on return.
const toNumber = (value: unknown): number => Number(value ?? 0);

// Booking-status breakdown via groupBy + _count. Optional package-id scope
// (`agentId`) limits it to an agent's own, non-deleted packages.
const getBookingsByStatus = async (
  agentId?: string,
): Promise<IBookingsByStatus[]> => {
  const grouped = await prisma.booking.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: agentId
      ? { package: { agentId, isDeleted: false } }
      : undefined,
  });

  return grouped
    .map((g) => ({ status: g.status, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
};

// Revenue trend: one row per day for the last `days` days, bucketing COMPLETED
// bookings by their `updatedAt` — the timestamp of the transition into
// COMPLETED (a terminal state, so it is the last write). `createdAt` is when
// the booking was made (PENDING) and never moves, which would mis-date revenue
// weeks later. Postgres generate_series guarantees a dense series (zero-filled
// days) — better and faster than a per-day JS loop.
const getRevenueOverTime = async (
  days: number,
  agentId?: string,
): Promise<IRevenuePoint[]> => {
  const scope = agentId
    ? `AND b."packageId" IN (
         SELECT p."id"
         FROM "tour_packages" p
         WHERE p."agentId" = $2
           AND p."isDeleted" = false
       )`
    : "";

  const rows = await prisma.$queryRawUnsafe<
    { date: string; revenue: number }[]
  >(
    `
    SELECT to_char(days.d, 'YYYY-MM-DD') AS date,
           COALESCE(SUM(b."totalPrice"), 0)::float8 AS revenue
    FROM generate_series(
      CURRENT_DATE - make_interval(days => $1::int - 1),
      CURRENT_DATE,
      '1 day'::interval
    ) AS days(d)
    LEFT JOIN "bookings" b
      ON date_trunc('day', b."updatedAt")::date = days.d
      AND b."status" = 'COMPLETED'
      ${scope}
    GROUP BY days.d
    ORDER BY days.d ASC
    `,
    days,
    ...(agentId ? [agentId] : []),
  );

  return rows;
};

// Package-id scope for booking queries. Callers short-circuit the empty case
// (an agent with no packages), but an `in: []` fallback keeps the type
// non-nullable while still matching nothing if it ever slips through.
const toPackageIdScope = (
  packageIds: string[],
): Prisma.BookingWhereInput =>
  packageIds.length
    ? { packageId: { in: packageIds } }
    : { packageId: { in: [] } };

// 1. Admin dashboard — platform-wide counts, breakdowns and revenue trend.
const getAdminDashboard = async (days: number): Promise<IAdminDashboard> => {
  const [
    totalUsers,
    totalPackages,
    totalBookings,
    totalRevenue,
    usersByRole,
    bookingsByStatus,
    packagesByCategory,
    revenueOverTime,
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.tourPackage.count({ where: { isDeleted: false } }),
    prisma.booking.count(),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: { status: BookingStatus.COMPLETED },
    }),
    prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
      where: { isDeleted: false },
    }),
    getBookingsByStatus(),
    prisma.tourPackage
      .groupBy({
        by: ["categoryId"],
        _count: { _all: true },
        where: { isDeleted: false },
      })
      .then(async (grouped) => {
        const categoryIds = grouped.map((g) => g.categoryId);
        const categories = await prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        });
        const nameMap = new Map(categories.map((c) => [c.id, c.name]));

        return grouped
          .map((g) => ({
            category: nameMap.get(g.categoryId) ?? "Unknown",
            count: g._count._all,
          }))
          .sort((a, b) => b.count - a.count);
      }),
    getRevenueOverTime(days),
  ]);

  return {
    totalUsers,
    totalPackages,
    totalBookings,
    totalRevenue: toNumber(totalRevenue._sum.totalPrice),
    usersByRole: usersByRole
      .map((g) => ({ role: g.role, count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    bookingsByStatus,
    packagesByCategory,
    revenueOverTime,
  };
};

// 2. Agent dashboard — scoped to the agent's own packages. Fetches owned
//    package ids once, then every aggregate reuses that scope so the whole
//    bundle is one Promise.all (no per-item queries).
const getAgentDashboard = async (
  userId: string,
  days: number,
): Promise<IAgentDashboard> => {
  const [ownedPackages, bookingsByStatus, averageRating] = await Promise.all([
    prisma.tourPackage.findMany({
      where: { agentId: userId, isDeleted: false },
      select: { id: true },
    }),
    getBookingsByStatus(userId),
    prisma.tourPackage.aggregate({
      _avg: { rating: true },
      where: {
        agentId: userId,
        status: PackageStatus.APPROVED,
        isDeleted: false,
      },
    }),
  ]);

  const packageIds = ownedPackages.map((p) => p.id);

  // An agent with no packages must see zeros — scope is undefined for an empty
  // list, and a bare `where: undefined` / `AND: [{}]` would otherwise match the
  // whole platform (cross-agent data leak). Short-circuit here instead.
  if (packageIds.length === 0) {
    return {
      totalPackages: 0,
      totalBookings: 0,
      totalRevenue: 0,
      averageRating: Math.round((averageRating._avg.rating ?? 0) * 10) / 10,
      bookingsByStatus,
      revenueOverTime: await getRevenueOverTime(days, userId),
    };
  }

  const scope = toPackageIdScope(packageIds);

  const [totalPackages, totalBookings, totalRevenue, revenueOverTime] =
    await Promise.all([
      packageIds.length,
      prisma.booking.count({ where: scope }),
      prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: {
          AND: [scope, { status: BookingStatus.COMPLETED }],
        },
      }),
      getRevenueOverTime(days, userId),
    ]);

  return {
    totalPackages,
    totalBookings,
    totalRevenue: toNumber(totalRevenue._sum.totalPrice),
    averageRating: Math.round((averageRating._avg.rating ?? 0) * 10) / 10,
    bookingsByStatus,
    revenueOverTime,
  };
};

// 3. User dashboard — the user's bookings, spend, and upcoming trips.
const getUserDashboard = async (userId: string): Promise<IUserDashboard> => {
  const [totalBookings, totalSpend, upcoming] = await Promise.all([
    prisma.booking.count({ where: { userId } }),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: { userId, status: BookingStatus.COMPLETED },
    }),
    prisma.booking.findMany({
      where: {
        userId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        travelDate: { gt: new Date() },
      },
      select: {
        id: true,
        travelDate: true,
        travelers: true,
        totalPrice: true,
        status: true,
        package: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { travelDate: "asc" },
      take: 5,
    }),
  ]);

  return {
    totalBookings,
    totalSpend: toNumber(totalSpend._sum.totalPrice),
    upcomingCount: upcoming.length,
    upcoming: upcoming.map((b) => ({
      ...b,
      totalPrice: Number(b.totalPrice),
    })),
  };
};

export const dashboardService = {
  getAdminDashboard,
  getAgentDashboard,
  getUserDashboard,
};