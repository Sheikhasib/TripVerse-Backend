import { z } from "zod";

const createSchema = z.object({
  bookingId: z
    .string({ required_error: "Booking id is required" })
    .uuid("Booking id must be a valid uuid"),
});

const callbackQuerySchema = z.object({
  bookingId: z.string().uuid("Booking id must be a valid uuid"),
  tranId: z.string().min(1),
  status: z.enum(["success", "fail", "cancel"]).optional(),
});

// Body of the gateway POST — only fields we consume, all optional because the
// shape differs between success / fail / cancel / IPN callbacks.
const gatewayResultSchema = z.object({
  val_id: z.string().optional(),
  status: z.string().optional(),
  fail_status: z.string().optional(),
  card_type: z.string().optional(),
  bank_tran_id: z.string().optional(),
  currency: z.string().optional(),
  amount: z.string().optional(),
});

export type TCreatePaymentSchema = z.infer<typeof createSchema>;
export type TCallbackQuerySchema = z.infer<typeof callbackQuerySchema>;
export type TGatewayResultSchema = z.infer<typeof gatewayResultSchema>;

export const paymentValidations = {
  createSchema,
  callbackQuerySchema,
  gatewayResultSchema,
};