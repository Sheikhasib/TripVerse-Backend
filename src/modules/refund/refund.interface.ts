import { RefundReasonCategory, RefundRequestStatus } from "../../../generated/prisma/enums";

export interface ICreateRefundRequest {
  bookingId: string;
  category: RefundReasonCategory;
  reason: string;
  evidenceUrl?: string;
}

export interface IRefundQuery {
  page?: number;
  limit?: number;
  status?: RefundRequestStatus;
}

export interface IDecideRefundRequest {
  action: "APPROVE" | "REJECT";
  approvedPercentage?: number;
  reviewNote?: string;
}

// Outcome of the synchronous gateway payout carried in the decision response.
export type IPayoutOutcome =
  | { status: "SUCCESS"; refundedTotal: number }
  | { status: "FAILED"; message: string };

export interface IRefundDecisionResult {
  refundRequest: Record<string, unknown>;
  payout?: IPayoutOutcome;
}
