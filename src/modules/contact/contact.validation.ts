import { z } from "zod";

const createMessageSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Please provide a valid email address"),
  subject: z
    .string({ required_error: "Subject is required" })
    .trim()
    .min(2, "Subject must be at least 2 characters")
    .max(200, "Subject must be at most 200 characters"),
  message: z
    .string({ required_error: "Message is required" })
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must be at most 2000 characters"),
}).strict();

const contactQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  isResolved: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
});

const contactParamsSchema = z.object({
  id: z.string({ required_error: "Message id is required" }).min(1),
});

const updateResolvedSchema = z
  .object({
    isResolved: z.boolean({
      required_error: "isResolved is required",
      invalid_type_error: "isResolved must be a boolean",
    }),
  })
  .strict()
  .refine((data) => typeof data.isResolved === "boolean", {
    message: "isResolved must be a boolean",
  });

export const contactValidations = {
  createMessageSchema,
  contactQuerySchema,
  contactParamsSchema,
  updateResolvedSchema,
};