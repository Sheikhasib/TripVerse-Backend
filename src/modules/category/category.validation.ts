import { z } from "zod";

const nameSchema = z
  .string({ required_error: "Category name is required" })
  .trim()
  .min(2, "Category name must be at least 2 characters")
  .max(100, "Category name must be at most 100 characters");

const createCategorySchema = z.object({ name: nameSchema }).strict();

const updateCategorySchema = z.object({ name: nameSchema }).strict();

const categoryParamsSchema = z.object({
  id: z.string({ required_error: "Category id is required" }).min(1),
});

export const categoryValidations = {
  createCategorySchema,
  updateCategorySchema,
  categoryParamsSchema,
};