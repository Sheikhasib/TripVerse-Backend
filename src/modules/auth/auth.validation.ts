import { z } from "zod";
import { Role } from "../../../generated/prisma/enums";

const registerSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Please provide a valid email"),
  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must be at most 72 characters"),
  phone: z
    .string()
    .max(20, "Phone number is too long")
    .optional(),
  role: z.nativeEnum(Role).optional(),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Please provide a valid email"),
  password: z.string({ required_error: "Password is required" }).min(1),
});

const googleLoginSchema = z.object({
  idToken: z.string({ required_error: "Google idToken is required" }).min(1),
});

const demoLoginSchema = z.object({
  role: z.nativeEnum(Role, {
    required_error: "Please provide a role",
  }),
});

// refreshToken may come from the httpOnly cookie OR the request body —
// validation is lenient here; the controller handles both sources.
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

const emailSchema = z
  .string({ required_error: "Email is required" })
  .trim()
  .email("Please provide a valid email");

const otpSchema = z
  .string({ required_error: "OTP is required" })
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^\d{6}$/, "OTP must be exactly 6 digits");

const verifyEmailSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

const resendVerificationSchema = z.object({
  email: emailSchema,
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: z
    .string({ required_error: "New password is required" })
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must be at most 72 characters"),
});

export type TRegisterSchema = z.infer<typeof registerSchema>;
export type TLoginSchema = z.infer<typeof loginSchema>;
export type TGoogleLoginSchema = z.infer<typeof googleLoginSchema>;
export type TRefreshTokenSchema = z.infer<typeof refreshTokenSchema>;
export type TVerifyEmailSchema = z.infer<typeof verifyEmailSchema>;
export type TResetPasswordSchema = z.infer<typeof resetPasswordSchema>;

export const authValidations = {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  demoLoginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};