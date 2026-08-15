import { randomUUID } from "node:crypto";
import { PackageStatus, Role } from "../../../generated/prisma/enums";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { slugify } from "../../utils/slugify";
import {
  ICreatePackagePayload,
  IInternalPackageQuery,
  IPackageQuery,
  IRequestUser,
  IUpdatePackagePayload,
  IUpdateStatusPayload,
} from "./package.interface";

// Money is `Decimal(10,2)` in the schema (AGENTS.md) — map to Number on return.
const serializePrice = <T extends { price: Prisma.Decimal }>(row: T): T => ({
  ...row,
  price: Number(row.price),
});

// Public payloads carry the agent's display info only — never email.
export const publicPackageInclude = {
  category: { select: { id: true, name: true, slug: true } },
  agent: { select: { id: true, name: true, avatarUrl: true } },
} as const;

const validateCategory = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new AppError(400, "Invalid categoryId");
  }
};

// Packages must be owned by a live AGENT — otherwise the booking state
// machine's "AGENT (owns package)" branch and agent-bookings scoping break.
const validateAgent = async (agentId: string) => {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, role: true, isDeleted: true },
  });

  if (!agent || agent.role !== Role.AGENT || agent.isDeleted) {
    throw new AppError(400, "Invalid agentId");
  }
};

// Collision-safe slug: base slug from the title, then `-2`, `-3`, ... using a
// single prefix query. Pure-Bangla/emoji titles can't slugify — fall back to
// `package-<shortId>` so the URL is always meaningful.
const generateUniqueSlug = async (title: string): Promise<string> => {
  const base = slugify(title) || `package-${randomUUID().slice(0, 8)}`;

  const existing = await prisma.tourPackage.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });

  const used = new Set(existing.map((p) => p.slug));
  if (!used.has(base)) {
    return base;
  }

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};

// 1. Create a package (AGENT/ADMIN). New packages start PENDING and never leak
//    into public queries until an admin approves them.
const createPackage = async (user: IRequestUser, payload: ICreatePackagePayload) => {
  await validateCategory(payload.categoryId);

  // ADMIN may create on behalf of an agent (optional agentId); AGENT always
  // owns what they create and may not impersonate another user.
  let agentId: string;
  if (user.role === Role.ADMIN) {
    if (payload.agentId) {
      await validateAgent(payload.agentId);
      agentId = payload.agentId;
    } else {
      agentId = user.id;
    }
  } else {
    if (payload.agentId) {
      throw new AppError(400, "agentId can only be set by an admin");
    }
    agentId = user.id;
  }

  const slug = await generateUniqueSlug(payload.title);

  const created = await prisma.tourPackage.create({
    data: {
      title: payload.title,
      description: payload.description,
      location: payload.location,
      price: payload.price,
      duration: payload.duration,
      categoryId: payload.categoryId,
      images: payload.images,
      agentId,
      slug,
    },
  });

  return serializePrice(created);
};

// 2. Public explored listing — APPROVED + not-deleted only, filters + sorting.
const getPublicPackages = async (query: IPackageQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const filters: Prisma.TourPackageWhereInput[] = [];

  if (query.search) {
    filters.push({
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { location: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }
  if (query.location) {
    filters.push({
      location: { contains: query.location, mode: "insensitive" },
    });
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filters.push({
      price: {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      },
    });
  }
  if (query.minRating !== undefined) {
    filters.push({ rating: { gte: query.minRating } });
  }
  if (query.maxDuration !== undefined) {
    filters.push({ duration: { lte: query.maxDuration } });
  }
  if (query.category) {
    filters.push({ category: { slug: query.category } });
  }

  const where: Prisma.TourPackageWhereInput = {
    status: PackageStatus.APPROVED,
    isDeleted: false,
    AND: filters.length > 0 ? filters : undefined,
  };

  const sortOrder = query.sortOrder ?? (query.sortBy === "newest" ? "desc" : "asc");

  const orderByMap: Record<string, Prisma.TourPackageOrderByWithRelationInput> = {
    newest: { createdAt: sortOrder },
    price: { price: sortOrder },
    rating: { rating: sortOrder },
    title: { title: sortOrder },
  };

  const orderBy = orderByMap[query.sortBy ?? "newest"] ?? orderByMap.newest;

  const [data, total] = await Promise.all([
    prisma.tourPackage.findMany({
      where,
      orderBy,
      include: publicPackageInclude,
      skip,
      take: limit,
    }),
    prisma.tourPackage.count({ where }),
  ]);

  return {
    data: data.map(serializePrice),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// 3. Public detail by slug — APPROVED + not-deleted only.
const getPackageBySlug = async (slug: string) => {
  const tourPackage = await prisma.tourPackage.findFirst({
    where: { slug, status: PackageStatus.APPROVED, isDeleted: false },
    include: publicPackageInclude,
  });

  if (!tourPackage) {
    throw new AppError(404, "Package not found.");
  }

  return serializePrice(tourPackage);
};

// 4. All packages for the admin moderation UI (any status, optional filters).
const getAllPackages = async (query: IInternalPackageQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: Prisma.TourPackageWhereInput = {
    isDeleted: false,
    ...(query.status ? { status: query.status } : {}),
    ...(query.agentId ? { agentId: query.agentId } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.tourPackage.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        agent: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.tourPackage.count({ where }),
  ]);

  return {
    data: data.map(serializePrice),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// 5. An agent's own packages (any status) — self-preview before approval.
const getMyPackages = async (userId: string, query: IInternalPackageQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: Prisma.TourPackageWhereInput = {
    agentId: userId,
    isDeleted: false,
  };

  const [data, total] = await Promise.all([
    prisma.tourPackage.findMany({
      where,
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.tourPackage.count({ where }),
  ]);

  return {
    data: data.map(serializePrice),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// Fetch + ownership gate shared by PATCH and DELETE. ADMIN bypasses ownership;
// AGENT edits are confined to their own packages.
const findOwnedPackage = async (user: IRequestUser, packageId: string) => {
  const tourPackage = await prisma.tourPackage.findUnique({
    where: { id: packageId },
  });

  if (!tourPackage) {
    throw new AppError(404, "Package not found.");
  }

  if (user.role !== Role.ADMIN && tourPackage.agentId !== user.id) {
    throw new AppError(403, "You can only act on your own packages.");
  }

  return tourPackage;
};

// 6. Update a package. Slug never changes (keeps links/bookmarks valid).
//    AGENT edits reset status to PENDING; ADMIN edits preserve it.
const updatePackage = async (
  user: IRequestUser,
  packageId: string,
  payload: IUpdatePackagePayload,
) => {
  const tourPackage = await findOwnedPackage(user, packageId);

  if (payload.categoryId !== undefined) {
    await validateCategory(payload.categoryId);
  }

  const data: Prisma.TourPackageUpdateInput = {
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.location !== undefined ? { location: payload.location } : {}),
    ...(payload.price !== undefined ? { price: payload.price } : {}),
    ...(payload.duration !== undefined ? { duration: payload.duration } : {}),
    ...(payload.images !== undefined ? { images: payload.images } : {}),
    ...(payload.categoryId !== undefined
      ? { category: { connect: { id: payload.categoryId } } }
      : {}),
    ...(user.role !== Role.ADMIN ? { status: PackageStatus.PENDING } : {}),
  };

  const updated = await prisma.tourPackage.update({
    where: { id: packageId },
    data,
    include: { category: { select: { id: true, name: true, slug: true } } },
  });

  return serializePrice(updated);
};

// 7. Approve/reject a package (admin).
const changePackageStatus = async (
  packageId: string,
  payload: IUpdateStatusPayload,
) => {
  const tourPackage = await prisma.tourPackage.findUniqueOrThrow({
    where: { id: packageId },
  });

  if (tourPackage.isDeleted) {
    throw new AppError(400, "Cannot change the status of a deleted package.");
  }

  const updated = await prisma.tourPackage.update({
    where: { id: packageId },
    data: { status: payload.status },
  });

  return serializePrice(updated);
};

// 8. Soft delete (admin any, agent own).
const softDeletePackage = async (user: IRequestUser, packageId: string) => {
  await findOwnedPackage(user, packageId);

  return prisma.tourPackage.update({
    where: { id: packageId },
    data: { isDeleted: true },
  });
};

export const packageService = {
  createPackage,
  getPublicPackages,
  getPackageBySlug,
  getAllPackages,
  getMyPackages,
  updatePackage,
  changePackageStatus,
  softDeletePackage,
};