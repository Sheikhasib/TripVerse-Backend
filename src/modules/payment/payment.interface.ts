import { BookingStatus, PaymentStatus } from "../../../generated/prisma/enums";

export interface IPaymentCreateRequest {
  bookingId: string;
}

// Fields the SSLCommerz gateway POSTs back to the confirm/IPN endpoints.
export interface IGatewayResult {
  val_id?: string;
  status?: string;
  fail_status?: string;
  card_type?: string;
  bank_tran_id?: string;
  currency?: string;
  amount?: string;
}

export interface IPaymentGatewayOutcome {
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus | null;
  changed: boolean;
}