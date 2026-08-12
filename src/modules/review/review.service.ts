import { PackageStatus, BookingStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { ICreateReviewPayload, IReviewQuery } from "./review.interface";

// 1. Create a review (USER only) — gated, unique per user+package, and
//    recalculates the package rating in the same transaction.
const createReview = async (userId: string, payload: ICreateReviewPayload) => {
  return prisma.$transaction(async (tx) => {
    // Package must exist, be approved, and not be deleted — a review of a
    // pending/rejected/deleted package is nonsense.
    const tourPackage = await tx.tourPackage.findFirst({
      where: {
        id: payload.packageId,
        status: PackageStatus.APPROVED,
        isDeleted: false,
      },
      select: { id: true, agentId: true },
    });

    if (!tourPackage) {
      throw new AppError(404, "Package not found.");
    }

    // No self-review — an agent rating their own package is a conflict of interest.
    if (tourPackage.agentId === userId) {
      throw new AppError(403, "You cannot review your own package.");
    }

    // Only customers with a completed booking may review.
    const completedBooking = await tx.booking.findFirst({
      where: {
        userId,
        packageId: payload.packageId,
        status: BookingStatus.COMPLETED,
      },
      select: { id: true },
    });

    if (!completedBooking) {
      throw new AppError(
        403,
        "You can only review a package after completing a booking.",
      );
    }

    // Friendly duplicate check — @@unique([userId, packageId]) backstops any
    // race via P2002 (mapped to 409 by the global handler).
    const existingReview = await tx.review.findFirst({
      where: { userId, packageId: payload.packageId },
      select: { id: true },
    });

    if (existingReview) {
      throw new AppError(409, "You have already reviewed this package.");
    }

    const createdReview = await tx.review.create({
      data: {
        userId,
        packageId: payload.packageId,
        rating: payload.rating,
        comment: payload.comment,
      },
    });

    // Recompute the package rating from all of its reviews, rounded to one
    // decimal, inside the same transaction so a stale average is never written.
    const { _avg } = await tx.review.aggregate({
      where: { packageId: payload.packageId },
      _avg: { rating: true },
    });

    const rating = Math.round((_avg.rating ?? 0) * 10) / 10;

    await tx.tourPackage.update({
      where: { id: payload.packageId },
      data: { rating },
    });

    return { review: createdReview, rating };
  });
};

// 2. List reviews for a package (public) — paginated; the package must be
//    approved and not deleted so unpublished package reviews never leak.
const listPackageReviews = async (
  packageId: string,
  query: IReviewQuery,
) => {
  const tourPackage = await prisma.tourPackage.findFirst({
    where: {
      id: packageId,
      status: PackageStatus.APPROVED,
      isDeleted: false,
    },
    select: { id: true },
  });

  if (!tourPackage) {
    throw new AppError(404, "Package not found.");
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.review.findMany({
      where: { packageId },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: { packageId } }),
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

export const reviewService = {
  createReview,
  listPackageReviews,
};
