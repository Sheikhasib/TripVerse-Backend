import { PackageStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { slugify } from "../../utils/slugify";
import { ICreateCategory, IUpdateCategory } from "./category.interface";

// Friendly 409 for @unique conflicts (name or slug) instead of a raw P2002.
const assertNameAvailable = async (name: string, slug: string) => {
  const existing = await prisma.category.findFirst({
    where: { OR: [{ name }, { slug }] },
  });

  if (existing) {
    throw new AppError(409, "A category with this name already exists");
  }
};

// Create category (admin)
const createCategory = async (payload: ICreateCategory) => {
  const { name } = payload;
  const slug = slugify(name);

  await assertNameAvailable(name, slug);

  return prisma.category.create({
    data: { name, slug },
  });
};

// Get all categories (public) with counts of approved, non-deleted packages
const getAllCategories = async () => {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          packages: {
            where: {
              status: PackageStatus.APPROVED,
              isDeleted: false,
            },
          },
        },
      },
    },
  });
};

// Update category name (regenerates slug) (admin)
const updateCategory = async (categoryId: string, payload: IUpdateCategory) => {
  const { name } = payload;
  const slug = slugify(name);

  await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
  await assertNameAvailable(name, slug);

  return prisma.category.update({
    where: { id: categoryId },
    data: { name, slug },
  });
};

// Delete category (admin) — 409 when any package references it
const deleteCategory = async (categoryId: string) => {
  await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });

  const packageCount = await prisma.tourPackage.count({
    where: { categoryId },
  });

  if (packageCount > 0) {
    throw new AppError(
      409,
      "Cannot delete category with associated packages. Rename it instead.",
    );
  }

  await prisma.category.delete({ where: { id: categoryId } });
};

export const categoryService = {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
};