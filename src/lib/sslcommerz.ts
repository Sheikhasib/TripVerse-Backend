import { randomUUID } from "node:crypto";

import config from "../config/index";

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
  return `TRNX_ID_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
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
  const body = new URLSearchParams({
    store_id: config.ssl_commerz_store_id,
    store_passwd: config.ssl_commerz_store_password,
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
  if (!res.ok) throw new Error(`SSLCommerz init failed (${res.status}): ${text}`);

  let data: SslcommerzInitResult;
  try {
    data = JSON.parse(text) as SslcommerzInitResult;
  } catch {
    throw new Error(`SSLCommerz init returned non-JSON: ${text}`);
  }

  if (data.status !== "success" || !data.GatewayPageURL) {
    throw new Error(`SSLCommerz init rejected: ${data.failedreason ?? data.status}`);
  }
  return data;
}

// Server-side verification of a completed transaction. status: VALID / VALIDATED /
// INVALID_TRANSACTION / FAILED. VALIDATED means the transaction was verified before
// (idempotent), INVALID_TRANSACTION means the amount/transaction mismatches.
export async function sslcommerzValidate(options: {
  val_id: string;
}): Promise<SslcommerzValidationResult> {
  const params = new URLSearchParams({
    val_id: options.val_id,
    store_id: config.ssl_commerz_store_id,
    store_passwd: config.ssl_commerz_store_password,
    format: "json",
  });

  const res = await fetch(`${config.sslcommerz_validate_url}?${params.toString()}`, {
    method: "GET",
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`SSLCommerz validation failed (${res.status}): ${text}`);

  let data: SslcommerzValidationResult;
  try {
    data = JSON.parse(text) as SslcommerzValidationResult;
  } catch {
    throw new Error(`SSLCommerz validation returned non-JSON: ${text}`);
  }
  return data;
}