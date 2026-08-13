import { randomUUID } from "node:crypto";

import config from "../config/index";
import { AppError } from "../utils/appError";

// Payment is an optional feature: the API must boot and serve everything else
// even when the SSLCommerz store isn't configured yet. These throw a clean 400
// on the payment-only paths rather than crash the whole deployment at boot.
const requireConfig = () => {
  if (!config.ssl_commerz_store_id || !config.ssl_commerz_store_password) {
    throw new AppError(
      400,
      "SSLCommerz is not configured. Set SSL_COMMERZ_STORE_ID and SSL_COMMERZ_STORE_PASSWORD.",
    );
  }
  if (!config.backend_public_url) {
    throw new AppError(
      400,
      "SSLCommerz is not configured. Set BACKEND_PUBLIC_URL to the publicly reachable backend URL.",
    );
  }
  return {
    storeId: config.ssl_commerz_store_id,
    storePassword: config.ssl_commerz_store_password,
  };
};

export interface SslcommerzInitResult {
  status: string;
  failedreason?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
  [key: string]: string | undefined;
}

export interface SslcommerzValidationResult {
  status: string;
  error?: string;
  val_id?: string;
  amount?: string;
  currency?: string;
  bank_tran_id?: string;
  card_type?: string;
  [key: string]: string | undefined;
}

// SSLCommerz truncates tran_id to 30 chars — date + time + random salt stays safely under.
export function generateTranId(): string {
  return `TRNX_ID-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

// Initiates a gateway session. Server-to-server POST, form-encoded. The gateway
// responds with the hosted checkout URL (GatewayPageURL) the customer is sent to.
export async function sslcommerzInit(options: {
  total_amount: number;
  tran_id: string;
  success_url: string;
  fail_url: string;
  cancel_url: string;
  ipn_url: string;
  cus_name: string;
  cus_email: string;
  cus_phone: string;
}): Promise<SslcommerzInitResult> {
  const { storeId, storePassword } = requireConfig();
  const body = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    total_amount: options.total_amount.toFixed(2),
    currency: "BDT",
    tran_id: options.tran_id,
    success_url: options.success_url,
    fail_url: options.fail_url,
    cancel_url: options.cancel_url,
    ipn_url: options.ipn_url,
    cus_name: options.cus_name,
    cus_email: options.cus_email,
    cus_add1: "N/A",
    cus_add2: "N/A",
    cus_city: "N/A",
    cus_state: "N/A",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: options.cus_phone,
    product_name: "TripVerse Tour Booking",
    shipping_method: "NO",
  });

  const res = await fetch(config.sslcommerz_init_url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) throw new AppError(502, `SSLCommerz init failed (${res.status})`);

  let data: SslcommerzInitResult;
  try {
    data = JSON.parse(text) as SslcommerzInitResult;
  } catch {
    throw new AppError(502, "SSLCommerz init returned a non-JSON response");
  }

  if (data.status !== "success" || !data.GatewayPageURL) {
    throw new AppError(502, `SSLCommerz init rejected: ${data.failedreason ?? data.status}`);
  }
  return data;
}

// Server-side verification of a completed transaction. status: VALID / VALIDATED /
// INVALID_TRANSACTION / FAILED. VALIDATED means the transaction was verified before
// (idempotent), INVALID_TRANSACTION means the amount/transaction mismatches.
export async function sslcommerzValidate(options: {
  val_id: string;
}): Promise<SslcommerzValidationResult> {
  const { storeId, storePassword } = requireConfig();
  const params = new URLSearchParams({
    val_id: options.val_id,
    store_id: storeId,
    store_passwd: storePassword,
    format: "json",
  });

  const res = await fetch(`${config.sslcommerz_validate_url}?${params.toString()}`, {
    method: "GET",
  });

  const text = await res.text();
  if (!res.ok) throw new AppError(502, `SSLCommerz validation failed (${res.status})`);

  let data: SslcommerzValidationResult;
  try {
    data = JSON.parse(text) as SslcommerzValidationResult;
  } catch {
    throw new AppError(502, "SSLCommerz validation returned a non-JSON response");
  }
  return data;
}