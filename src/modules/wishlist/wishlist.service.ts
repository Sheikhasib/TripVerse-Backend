import { PackageStatus } from "../../../generated/prisma/enums";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { publicPackageInclude } from "../package/package.service";
import { ICreateWishlistPayload, IWishlistQuery } from "./wishlist.interface";

// Money is `Decimal(10,2)` in the schema (AGENTS.md) — map to Number on return.
const serializeWishlistItem = <
  T extends { package: { price: Prisma.Decimal } },
>(
  row: T,
): T => ({
  ...row,
  package: { ...row.package, price: Number(row.package.price) },
});

// 1. Save a package to the wishlist (USER) — idempotent. The package must be
//    APPROVED and not deleted, mirroring the public-package visibility rule.
const addToWishlist = async (
  userId: string,
  payload: ICreateWishlistPayload,
) => {
  const tourPackage = await prisma.tourPackage.findFirst({
    where: {
      id: payload.packageId,
      status: PackageStatus.APPROVED,
      isDeleted: false,
    },
    select: { id: true },
  });

  if (!tourPackage) {
    throw new AppError(404, "Package not found.");
  }

  return prisma.wishlistItem.upsert({
    where: { userId_packageId: { userId, packageId: payload.packageId } },
    create: { userId, packageId: payload.packageId },
    update: {},
  });
};

// 2. Paginated wishlist (USER) — newest first. Rows whose package was later
//    soft-deleted or demoted out of APPROVED are filtered at read time, so the
//    page never lists a package whose detail route would 404.
const getMyWishlist = async (userId: string, query: IWishlistQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: Prisma.WishlistItemWhereInput = {
    userId,
    package: { isDeleted: false, status: PackageStatus.APPROVED },
  };

  const [data, total] = await Promise.all([
    prisma.wishlistItem.findMany({
      where,
      include: { package: { include: publicPackageInclude } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.wishlistItem.count({ where }),
  ]);

  return {
    data: data.map(serializeWishlistItem),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// 3. Remove a package from the wishlist (USER) — idempotent; a missing row is
//    a no-op, never an error. Deliberately no "clear all".
const removeFromWishlist = async (userId: string, packageId: string) => {
  await prisma.wishlistItem.deleteMany({
    where: { userId, packageId },
  });
};

export const wishlistService = {
  addToWishlist,
  getMyWishlist,
  removeFromWishlist,
};