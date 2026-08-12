import { z } from "zod";

const titleSchema = z
  .string({ required_error: "Title is required" })
  .trim()
  .min(3, "Title must be at least 3 characters")
  .max(200, "Title must be at most 200 characters");

const descriptionSchema = z
  .string({ required_error: "Description is required" })
  .trim()
  .min(10, "Description must be at least 10 characters")
  .max(10000, "Description must be at most 10000 characters");

const locationSchema = z
  .string({ required_error: "Location is required" })
  .trim()
  .min(2, "Location must be at least 2 characters")
  .max(200, "Location must be at most 200 characters");

const priceSchema = z
  .number({ required_error: "Price is required" })
  .positive("Price must be a positive number")
  .refine((val) => Math.round(val * 100) / 100 === val, {
    message: "Price must have at most 2 decimal places",
  });

const durationSchema = z
  .number({ required_error: "Duration is required" })
  .int("Duration must be a whole number of days")
  .min(1, "Duration must be at least 1 day");

const categoryIdSchema = z
  .string({ required_error: "Category id is required" })
  .min(1, "Category id must not be empty");

const imagesSchema = z
  .array(z.string().url("Each image must be a valid URL"))
  .min(1, "At least one image is required")
  .max(6, "At most 6 images are allowed");

const createPackageSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    location: locationSchema,
    price: priceSchema,
    duration: durationSchema,
    categoryId: categoryIdSchema,
    images: imagesSchema,
    agentId: z.string().min(1).optional(),
  })
  .strict();

const updatePackageSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    location: locationSchema.optional(),
    price: priceSchema.optional(),
    duration: durationSchema.optional(),
    categoryId: categoryIdSchema.optional(),
    images: imagesSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

const packageQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().min(1).max(200).optional(),
    location: z.string().trim().min(1).max(200).optional(),
    minPrice: z.coerce.number().positive().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxDuration: z.coerce.number().int().min(1).optional(),
    sortBy: z
      .enum(["newest", "price", "rating", "title"])
      .default("newest"),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .refine((data) => {
    if (data.minPrice !== undefined && data.maxPrice !== undefined) {
      return data.minPrice <= data.maxPrice;
    }
    return true;
  }, {
    message: "minPrice must be less than or equal to maxPrice",
    path: ["minPrice"],
  });

const internalPackageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED"])
    .transform((val) => val as "PENDING" | "APPROVED" | "REJECTED")
    .optional(),
  agentId: z.string().min(1).optional(),
});

const packageParamsSchema = z.object({
  id: z.string({ required_error: "Package id is required" }).min(1),
});

const packageSlugParamsSchema = z.object({
  slug: z.string({ required_error: "Package slug is required" }).trim().min(1),
});

const updateStatusSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"], {
      required_error: "Status is required",
      invalid_type_error: "Status must be APPROVED or REJECTED",
    }),
  })
  .strict();

export const packageValidations = {
  createPackageSchema,
  updatePackageSchema,
  packageQuerySchema,
  internalPackageQuerySchema,
  packageParamsSchema,
  packageSlugParamsSchema,
  updateStatusSchema,
};