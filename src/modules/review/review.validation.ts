import { z } from "zod";

const createReviewSchema = z
  .object({
    packageId: z
      .string({ required_error: "Package id is required" })
      .min(1, "Package id must not be empty"),
    rating: z
      .number({ required_error: "Rating is required" })
      .int("Rating must be a whole number")
      .min(1, "Rating must be at least 1")
      .max(5, "Rating must be at most 5"),
    comment: z
      .string({ required_error: "Comment is required" })
      .trim()
      .min(1, "Comment must not be empty")
      .max(1000, "Comment must be at most 1000 characters"),
  })
  .strict();

const reviewParamsSchema = z.object({
  packageId: z
    .string({ required_error: "Package id is required" })
    .min(1, "Package id must not be empty"),
});

const reviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const updateReviewSchema = z
  .object({
    rating: z
      .number({ invalid_type_error: "Rating must be a number" })
      .int("Rating must be a whole number")
      .min(1, "Rating must be at least 1")
      .max(5, "Rating must be at most 5")
      .optional(),
    comment: z
      .string({ invalid_type_error: "Comment must be a string" })
      .trim()
      .min(1, "Comment must not be empty")
      .max(1000, "Comment must be at most 1000 characters")
      .optional(),
  })
  .strict()
  .refine((data) => data.rating !== undefined || data.comment !== undefined, {
    message: "At least one of rating or comment must be provided",
  });

const reviewIdParamsSchema = z.object({
  id: z
    .string({ required_error: "Review id is required" })
    .min(1, "Review id must not be empty"),
});

export const reviewValidations = {
  createReviewSchema,
  reviewParamsSchema,
  reviewQuerySchema,
  updateReviewSchema,
  reviewIdParamsSchema,
};
