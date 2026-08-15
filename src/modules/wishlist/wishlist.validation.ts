import { z } from "zod";

const createWishlistSchema = z
  .object({
    packageId: z
      .string({ required_error: "Package id is required" })
      .min(1, "Package id must not be empty"),
  })
  .strict();

const wishlistParamsSchema = z.object({
  packageId: z
    .string({ required_error: "Package id is required" })
    .min(1, "Package id must not be empty"),
});

const wishlistQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const wishlistValidations = {
  createWishlistSchema,
  wishlistParamsSchema,
  wishlistQuerySchema,
};