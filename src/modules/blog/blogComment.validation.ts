import { z } from "zod";

const createCommentSchema = z
  .object({
    content: z
      .string({ required_error: "Content is required" })
      .trim()
      .min(1, "Content must not be empty")
      .max(2000, "Content must be at most 2000 characters"),
    parentId: z.string().min(1, "parentId must not be empty").optional(),
  })
  .strict();

const commentParamsSchema = z.object({
  id: z
    .string({ required_error: "Comment id is required" })
    .min(1, "Comment id must not be empty"),
});

const commentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const blogCommentValidations = {
  createCommentSchema,
  commentParamsSchema,
  commentQuerySchema,
};