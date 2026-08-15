import { z } from "zod";

const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // "true"/"false" strings only — z.coerce.boolean() would treat the string
  // "false" as truthy.
  unread: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const notificationParamsSchema = z.object({
  id: z
    .string({ required_error: "Notification id is required" })
    .min(1, "Notification id must not be empty"),
});

export const notificationValidations = {
  notificationQuerySchema,
  notificationParamsSchema,
};