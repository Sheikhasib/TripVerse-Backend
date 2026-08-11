import { z } from "zod";
import { Role, UserStatus } from "../../../generated/prisma/enums";

const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be at most 100 characters")
      .optional(),
    phone: z
      .string()
      .trim()
      .max(20, "Phone number is too long")
      .optional(),
    avatarUrl: z.string().trim().url("Please provide a valid image URL").optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(72, "Password must be at most 72 characters")
      .optional(),
  })
  .refine(
    (data) =>
      data.newPassword === undefined ||
      data.currentPassword !== undefined,
    { message: "Current password is required to change password" },
  );

const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

const userParamsSchema = z.object({
  id: z.string({ required_error: "User id is required" }).min(1),
});

const changeRoleSchema = z.object({
  role: z.nativeEnum(Role, { required_error: "Please provide a role" }),
});

const changeStatusSchema = z.object({
  status: z.nativeEnum(UserStatus, {
    required_error: "Please provide a status",
  }),
});

export type TUpdateProfileSchema = z.infer<typeof updateProfileSchema>;
export type TUserQuerySchema = z.infer<typeof userQuerySchema>;

export const userValidations = {
  updateProfileSchema,
  userQuerySchema,
  userParamsSchema,
  changeRoleSchema,
  changeStatusSchema,
};