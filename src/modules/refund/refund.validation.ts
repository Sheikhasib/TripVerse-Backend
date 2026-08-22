import { z } from "zod";
import { RefundReasonCategory, RefundRequestStatus } from "../../../generated/prisma/enums";

// Categories that require documentary evidence per the refund policy.
const DOCS_BACKED_CATEGORIES: RefundReasonCategory[] = [
  RefundReasonCategory.MEDICAL_EMERGENCY,
  RefundReasonCategory.BEREAVEMENT,
  RefundReasonCategory.VISA_REJECTION,
  RefundReasonCategory.FORCE_MAJEURE,
];

const createSchema = z
  .object({
    bookingId: z.string({ required_error: "Booking id is required" }).min(1),
    category: z.nativeEnum(RefundReasonCategory, {
      required_error: "Please choose a reason category",
    }),
    reason: z
      .string({ required_error: "Please describe your reason" })
      .trim()
      .min(20, "Please describe your reason in at least 20 characters")
      .max(2000, "Reason must be at most 2000 characters"),
    evidenceUrl: z.string().url("Evidence must be a valid URL").optional(),
  })
  .superRefine((data, ctx) => {
    if (
      DOCS_BACKED_CATEGORIES.includes(data.category) &&
      !data.evidenceUrl
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceUrl"],
        message:
          "Supporting documents are required for this reason category.",
      });
    }
  });

const refundParamsSchema = z.object({
  id: z.string({ required_error: "Refund request id is required" }).min(1),
});

const refundQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.nativeEnum(RefundRequestStatus).optional(),
});

const decisionSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"], {
      required_error: "Please provide a decision action",
    }),
    approvedPercentage: z.coerce.number().int().min(0).max(100).optional(),
    reviewNote: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "REJECT" && !data.reviewNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewNote"],
        message: "A review note is required when rejecting a refund request.",
      });
    }
  });

export type TCreateRefundSchema = z.infer<typeof createSchema>;
export type TRefundQuerySchema = z.infer<typeof refundQuerySchema>;
export type TDecisionSchema = z.infer<typeof decisionSchema>;

export const refundValidations = {
  createSchema,
  refundParamsSchema,
  refundQuerySchema,
  decisionSchema,
};
