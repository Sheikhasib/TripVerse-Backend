import { z } from "zod";

const titleSchema = z
  .string({ required_error: "Title is required" })
  .trim()
  .min(3, "Title must be at least 3 characters")
  .max(200, "Title must be at most 200 characters");

const excerptSchema = z
  .string({ required_error: "Excerpt is required" })
  .trim()
  .min(1, "Excerpt must not be empty")
  .max(500, "Excerpt must be at most 500 characters");

const contentSchema = z
  .string({ required_error: "Content is required" })
  .trim()
  .min(1, "Content must not be empty")
  .max(10000, "Content must be at most 10000 characters");

const coverImageSchema = z
  .string({ required_error: "Cover image is required" })
  .url("Cover image must be a valid URL");

const createPostSchema = z
  .object({
    title: titleSchema,
    excerpt: excerptSchema,
    content: contentSchema,
    coverImage: coverImageSchema,
  })
  .strict();

const updatePostSchema = z
  .object({
    title: titleSchema.optional(),
    excerpt: excerptSchema.optional(),
    content: contentSchema.optional(),
    coverImage: coverImageSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

const postParamsSchema = z.object({
  id: z.string({ required_error: "Post id is required" }).min(1),
});

const postSlugParamsSchema = z.object({
  slug: z.string({ required_error: "Post slug is required" }).trim().min(1),
});

const updateStatusSchema = z
  .object({
    status: z.enum(["DRAFT", "PUBLISHED"], {
      required_error: "Status is required",
      invalid_type_error: "Status must be DRAFT or PUBLISHED",
    }),
  })
  .strict();

const publicQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().min(1).max(200).optional(),
    sortBy: z.enum(["newest", "oldest", "title"]).default("newest"),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  });

const internalQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    status: z
      .enum(["DRAFT", "PUBLISHED"])
      .transform((val) => val as "DRAFT" | "PUBLISHED")
      .optional(),
  });

export const blogValidations = {
  createPostSchema,
  updatePostSchema,
  postParamsSchema,
  postSlugParamsSchema,
  updateStatusSchema,
  publicQuerySchema,
  internalQuerySchema,
};
