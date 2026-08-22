import { PackageStatus, BookingStatus, Role } from "../../../generated/prisma/enums";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import {
  ICreateReviewPayload,
  IReviewQuery,
  IUpdateReviewPayload,
} from "./review.interface";

// Shared rating recompute — the single source of truth for the package
// average. create/update/delete all call it inside their own transaction, and
// the aggregate always filters `isDeleted: false` so a removed rating never
// counts (otherwise delete would recompute an unchanged average).
const recomputePackageRating = async (
  tx: Prisma.TransactionClient,
  packageId: string,
): Promise<number> => {
  const { _avg } = await tx.review.aggregate({
    where: { packageId, isDeleted: false },
    _avg: { rating: true },
  });

  const rating = Math.round((_avg.rating ?? 0) * 10) / 10;

  await tx.tourPackage.update({
    where: { id: packageId },
    data: { rating },
  });

  return rating;
};

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
    // race via P2002 (mapped to 409 by the global handler). Deliberately NOT
    // filtered by isDeleted: soft delete keeps the row, so re-reviewing after
    // a delete still fails with this friendly 409.
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

    const rating = await recomputePackageRating(tx, payload.packageId);

    return { review: createdReview, rating };
  });
};

// 2. List reviews for a package (public) — paginated; the package must be
//    approved and not deleted so unpublished package reviews never leak.
//    Deleted reviews are excluded so a removed rating stops counting.
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

  const where = { packageId, isDeleted: false };

  const [data, total] = await Promise.all([
    prisma.review.findMany({
      where,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        // `id` lets the client show ownership controls (edit/delete) on the
        // author's own reviews without guessing from the display name.
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.review.count({ where }),
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

// 3. Update a review (USER, author only). A foreign id or a removed review is
//    a uniform 404 — never a leak. The package average is recomputed in the
//    same transaction.
const updateReview = async (
  userId: string,
  reviewId: string,
  payload: IUpdateReviewPayload,
) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.review.findFirst({
      where: { id: reviewId, userId, isDeleted: false },
      select: { id: true, packageId: true },
    });

    if (!existing) {
      throw new AppError(404, "Review not found.");
    }

    const updated = await tx.review.update({
      where: { id: reviewId },
      data: {
        ...(payload.rating !== undefined ? { rating: payload.rating } : {}),
        ...(payload.comment !== undefined ? { comment: payload.comment } : {}),
      },
    });

    await recomputePackageRating(tx, existing.packageId);

    // The response's rating is the authoritative value from the package row,
    // not the input — the client's displayed average is never stale.
    const fresh = await tx.tourPackage.findUnique({
      where: { id: existing.packageId },
      select: { rating: true },
    });

    return { review: updated, rating: fresh?.rating ?? 0 };
  });
};

// 4. Soft delete a review (author or ADMIN) — the average is recomputed so the
//    removed rating stops counting. Foreign id / repeat delete → uniform 404.
const deleteReview = async (
  userId: string,
  role: Role,
  reviewId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.review.findFirst({
      where: { id: reviewId, isDeleted: false },
      select: { id: true, packageId: true, userId: true },
    });

    if (!existing) {
      throw new AppError(404, "Review not found.");
    }

    if (role !== Role.ADMIN && existing.userId !== userId) {
      throw new AppError(404, "Review not found.");
    }

    const removed = await tx.review.updateMany({
      where: { id: reviewId, isDeleted: false },
      data: { isDeleted: true },
    });

    if (removed.count === 0) {
      throw new AppError(404, "Review not found.");
    }

    const rating = await recomputePackageRating(tx, existing.packageId);

    return { reviewId, rating };
  });
};

export const reviewService = {
  createReview,
  listPackageReviews,
  updateReview,
  deleteReview,
};