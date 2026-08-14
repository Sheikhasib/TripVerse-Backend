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

`sslcommerzRefund({ refund_ref_id, amount, tran_id, remarks })` — `POST` to the refund endpoint
(sandbox `https://sandbox.sslcommerz.com/refund/api/v3/refund.php`, live
`https://securepay.sslcommerz.com/refund/api/v3/refund.php`; derived from `SSL_COMMERZ_SANDBOX` like
the init/validate URLs), form-encoded with `store_id, store_passwd, refund_ref_id, amount, tran_id,
reference_easy, refund_remarks, format=json`. Returns `{ status: "success"|"failed", error?,
refund_ref_id, bank_tran_id }`; non-success → throw (clean 502 path in the service). `refund_ref_id`
comes from the original payment's stored value (captured below). Never logs the store password.

## Capturing `refund_ref_id`

SSLCommerz returns a `refund_ref_id` per transaction at **init/validation** time. Extend:

- `payment.service.ts` `createPaymentSession` — store `refund_ref_id` (and `val_id`) from the init /
  validation response onto the payment row when available.
- `payment.service.ts` `processGatewayResult` SUCCESS branch — persist `valId`, `cardType`,
  `bankTranId`, `paidAt` **and** any `refund_ref_id` from the validation payload.

So a `SUCCESS` payment that later gets cancelled already knows its refund reference. If it's null
(refund not yet supported by the captured payload), fall back to `val_id` + `tran_id` — SSLCommerz
can resolve a refund from the transaction; document the fallback in code. **Sandbox verification
required during implementation**: confirm the sandbox init/validation payload actually returns
`refund_ref_id`; if it doesn't, prove the `val_id` fallback works end-to-end before relying on it.

## Refund flow — `booking.service.ts` `updateBookingStatus`

The `to === CANCELLED` branch changes from "flag REFUNDED unconditionally" to:

1. Find the `SUCCESS` payment for the booking (`where: { bookingId, status: SUCCESS }`).
2. If none → no money to return; proceed as today.
3. If one exists **and** `refundCompletedAt` is null → call `sslcommerzRefund(...)` **after** the
   booking row flips to `CANCELLED` (order: flip booking first so the booking is consistent even if
   the gateway call hangs/throws; then refund).
4. Refund success → update the payment: `status: REFUNDED, refundCompletedAt: now`. Best-effort
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
Inside the refund, gate the gateway call on `payment.refundCompletedAt === null` and flip to
`REFUNDED` via `updateMany({ where: { id, status: SUCCESS }, data: { ... } })` — a concurrent refund
loses the race and is a no-op. A payment already `REFUNDED` is never re-charged or re-refunded.

## Booking status machine note

No new transitions. `PAID → CANCELLED` (canManage) already exists; this step only changes **what
happens** on that transition. `PENDING → CANCELLED` (no payment) and `CONFIRMED → CANCELLED`
(payment already `SUCCESS` → same refund path) are unchanged in shape.

## Files to change

- `prisma/schema/payment.prisma`
- `src/lib/sslcommerz.ts` — `sslcommerzRefund`
- `src/modules/payment/payment.service.ts` — capture `refund_ref_id`/`val_id`
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
- With a sandbox store + a `SUCCESS` payment: cancelling the `PAID` booking → booking `CANCELLED`,
  gateway refund succeeds, payment `REFUNDED` with `refundCompletedAt` set, refund email attempted.
- Repeat cancel is a no-op (already `CANCELLED` → 409 from the state machine); a payment already
  `REFUNDED` is never refunded again.
- Refund API failure (bad creds / network): booking still `CANCELLED`, payment stays `SUCCESS` with
  `refundInitiatedAt`, response reports `refund.status: "FAILED"`, request does not 500.
- `GET /api/bookings/:id` detail reflects the payment's refund columns.
- Commit + push (AGENTS.md workflow).