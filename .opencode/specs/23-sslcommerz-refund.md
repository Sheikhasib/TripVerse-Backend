# Step 23 — SSLCommerz Refund (Money Movement)

## Overview

Promotes the SSLCommerz refund-money movement out of the backlog (Step 15, Step 16 "Out of scope").
Today cancelling a `PAID` booking only flags the payment `REFUNDED` in the DB (`booking.service.ts`
`updateBookingStatus` → `payment.updateMany`); no money actually moves. This step calls SSLCommerz's
**refund API** so the customer's money really returns, and only marks the payment `REFUNDED` once the
gateway confirms the refund succeeded. If the refund API fails (network, insufficient balance,
store not configured), the payment **stays `SUCCESS`** and the booking stays `CANCELLED` — the money
is safe, the refund simply needs retrying/manual attention — and an error is surfaced to the actor.

## Depends on

- `src/lib/sslcommerz.ts` — the typed `fetch` wrapper; add `sslcommerzRefund`
- `src/modules/booking/booking.service.ts` — `updateBookingStatus` CANCELLED branch
- `prisma/schema/payment.prisma` — needs refund-tracking columns
- `src/config/index.ts` — SSLCommerz creds + `SSL_COMMERZ_SANDBOX` already present
- `src/utils/email.ts` — best-effort refund email
- `src/utils/appError.ts`, `src/middleware/auth.ts` — existing plumbing

## Prisma changes

`prisma/schema/payment.prisma` gains refund-tracking columns:

```prisma
model Payment {
  // ... existing fields (id, bookingId, tranId, valId, amount, currency,
  // status, gatewayPageUrl, sslSessionKey, cardType, bankTranId, paidAt) ...
  refundRefId      String?   // SSLCommerz's refund reference — needed for lookup/retry
  refundInitiatedAt DateTime?
  refundCompletedAt DateTime?
}
```

Apply with `npx prisma migrate dev --name add_payment_refund_columns`.

## SSLCommerz refund client — `src/lib/sslcommerz.ts`

`sslcommerzRefund({ bank_tran_id, refund_amount, refund_remarks, refe_id })` — **GET** to the refund
endpoint (sandbox `https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php`, live
`https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php`; derived from
`SSL_COMMERZ_SANDBOX` like the init/validate URLs) with query params
`bank_tran_id, refund_trans_id, store_id, store_passwd, refund_amount, refund_remarks, refe_id,
format=json, v=1`. `refund_trans_id` is **mandatory** (added by SSLCommerz 24/02/2025) — the lib
auto-generates a fresh unique one per attempt (`generateRefundTranId`, ≤30 chars). Response
`{ APIConnect, status, errorReason?, refund_ref_id?, bank_tran_id? }`; `APIConnect !== "DONE"` or
`status === "failed"` → throw (clean 502 path in the service). Bounded with `AbortSignal.timeout(8000)`.
Never logs the store password.

> **Verified 2026-08-19 (sandbox):** the older `POST https://…/refund/api/v3/refund.php` endpoint from
> the v3 docs **does not exist** (404). The current v4 docs confirm refund initiation lives on the
> validator endpoint above. With the real sandbox store creds the endpoint answers `APIConnect: "DONE"`
> (auth OK) and only fails a refund for an unknown `bank_tran_id` — proving endpoint + credentials +
> params are wired correctly.

## Capturing the refund identifier

The refund is resolved by `bank_tran_id` — the gateway's bank-side transaction id, captured at
settlement (`processGatewayResult` SUCCESS branch already persists `bankTranId`). `refund_ref_id` is
**not** returned by init/validation; the gateway generates it only when a refund is initiated, so the
payment row stores it at that point (`refundRefId`, output of `sslcommerzRefund`). A `SUCCESS` payment
without a `bank_tran_id` cannot be refunded via the gateway — the flow marks it `refundInitiatedAt`
and reports `refund.status: FAILED` ("no bank transaction id").

## Refund flow — `booking.service.ts` `updateBookingStatus`

The `to === CANCELLED` branch changes from "flag REFUNDED unconditionally" to:

1. Find the `SUCCESS` payments for the booking (`where: { bookingId, status: SUCCESS, refundCompletedAt: null }`).
2. If none → no money to return; proceed as today (no `refund` key in the response).
3. For each, after the booking row has flipped to `CANCELLED` (order: flip booking first so the
   booking is consistent even if the gateway call hangs/throws), call
   `sslcommerzRefund({ bank_tran_id, refund_amount, refund_remarks, refe_id })`. A payment with no
   `bank_tran_id` is treated as a failed refund.
4. Refund success → CAS the payment `status: REFUNDED, refundRefId, refundCompletedAt: now`. Best-effort
   refund email.
**Sync-vs-async decision:** the refund API call runs **synchronously inside the cancel request**,
because (a) a cancel is rare and user-initiated and the actor wants the refund outcome immediately,
and (b) the booking state is already committed before the call, so a slow/aborted refund only loses
the refund *confirmation*, never the cancellation. Bound the call with a short timeout (~8s,
comfortably inside the Vercel function limit after the DB work) so a hung gateway can't hold the
request. A queue / admin retry endpoint (`POST /api/payments/:id/retry-refund`) is deferred to the
backlog; `refundInitiatedAt` exists so that later path can find refundable-but-unconfirmed payments.

5. Refund failure/throw → **leave `status: SUCCESS`** (money hasn't left the gateway), set
   `refundInitiatedAt` for visibility, **do not fail the cancellation**. Because the booking already
   flipped `CANCELLED`, the request completes successfully and the refund outcome is carried in the
   response body: `{ booking, refund: { status: "FAILED", message } }`. The actor sees "Booking
   cancelled, but the refund could not be processed right now — we'll retry / contact support." A
   gateway hiccup must never turn a legitimate cancellation into a 500.

**Idempotency guard:** never refund twice. The compare-and-set on the booking status
(`updateMany where { id, status: booking.status }`, count 0 → 409) already prevents double-cancel.
Inside the refund, the payments query is gated on `status: SUCCESS, refundCompletedAt: null` and the
`REFUNDED` flip is a CAS (`updateMany where { id, status: SUCCESS }`) — a concurrent refund loses the
race and is a no-op. A payment already `REFUNDED` is never selected, so never re-refunded. A repeated
cancel of an already-`CANCELLED` booking is rejected by the state machine (400 "Cannot transition").

## Booking status machine note

No new transitions. `PAID → CANCELLED` (canManage) already exists; this step only changes **what
happens** on that transition. `PENDING → CANCELLED` (no payment) and `CONFIRMED → CANCELLED`
(payment already `SUCCESS` → same refund path) are unchanged in shape.

## Files to change

- `prisma/schema/payment.prisma`
- `src/lib/sslcommerz.ts` — `sslcommerzRefund` + `generateRefundTranId`
- `src/modules/payment/payment.service.ts` — `bankTranId` already captured at settlement (refund identifier)
- `src/modules/booking/booking.service.ts` — CANCELLED branch calls the refund, guarded + idempotent
- `src/utils/email.ts` — optional `sendRefundEmail`
- `src/modules/booking/booking.controller.ts` / `booking.interface.ts` — surface refund status

## New dependencies

None (native `fetch`; reuses the existing wrapper).

## Rules for implementation

- The booking flips `CANCELLED` **first**; the gateway call happens after, so a gateway failure never
  corrupts booking state.
- Money only moves via the validated gateway call; `REFUNDED` is written **only** after gateway
  success, via compare-and-set on the payment row.
- Refund failures are surfaced, not swallowed: response carries `refund: { status: "FAILED" }`; the
  payment row stays `SUCCESS` with `refundInitiatedAt` for later retry/manual action.
- Refund API errors map to `502` (like init/validate); never log credentials or card data.
- Best-effort refund email via `Promise.allSettled`.
- Section-header comments only where existing modules use them.

## Definition of done

- `npx prisma migrate dev --name add_payment_refund_columns` applies; `npx tsc --noEmit` passes.
- With a sandbox store + a real `SUCCESS` payment: cancelling the `PAID` booking → booking `CANCELLED`,
  gateway refund succeeds, payment `REFUNDED` with `refundCompletedAt` set, refund email attempted.
  (Verified up to the gateway: endpoint + store auth answer `APIConnect: "DONE"`; a full settlement
  refund requires a genuine sandbox transaction to exist for `bank_tran_id`.)
- Repeat cancel is a no-op (already `CANCELLED` → 400 from the state machine); a payment already
  `REFUNDED` is never refunded again.
- Refund API failure (bad creds / network): booking still `CANCELLED`, payment stays `SUCCESS` with
  `refundInitiatedAt`, response reports `refund.status: "FAILED"`, request does not 500.
- `GET /api/bookings/:id` detail reflects the payment's refund columns.
- Commit + push (AGENTS.md workflow).