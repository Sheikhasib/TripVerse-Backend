# Step 16 — Payment Module (SSLCommerz)

## Overview

Promotes payment out of the backlog (listed as `[LATER]` in Step 2 and in Step 15) into a real module.
Checkout uses **SSLCommerz** in **BDT**, mirroring GearUp. A `USER` creates a booking (Step 9) and pays
at checkout: the booking stays `PENDING`, a `Payment` row is raised, and the browser is redirected to
the SSLCommerz gateway (`gatewayPageUrl`). On a **server-validated** success the payment → `SUCCESS`
and the booking → `PAID`. The seller flow is unchanged (`PAID → CONFIRMED → COMPLETED`). Cancelling a
`PAID` booking marks the payment `REFUNDED` in the DB only — the actual money movement via SSLCommerz's
refund API stays in the backlog.

## Depends on

- `prisma/schema/booking.prisma`, `prisma/schema/enums.prisma` — the `Booking` model + `BookingStatus`
  enum the new `Payment` model and transitions tie into
- `src/modules/booking/booking.service.ts` — booking state machine + ownership/compare-and-set patterns
  to reuse for the `PAID` flow
- `src/config/index.ts` — Zod-validated env pattern to extend for SSLCommerz creds
- `src/utils/email.ts` — best-effort email pattern (Resend); `BookingStatus` gains `PAID`, so
  `statusCopy` must cover it
- `src/app.ts` — module registration; the existing `apiLimiter` already covers `/api/payments`

## Prisma changes

- `enums.prisma`:
  - `BookingStatus` gains `PAID` → `PENDING, PAID, CONFIRMED, CANCELLED, COMPLETED`
  - New enum `PaymentStatus`: `INITIATED, SUCCESS, FAILED, CANCELLED, REFUNDED`
- New `prisma/schema/payment.prisma`

```prisma
model Payment {
  id             String        @id @default(uuid())
  bookingId      String
  tranId         String        @unique // SSLCommerz transaction id, generated server-side
  valId          String?               // set after gateway success (used to validate)
  amount         Decimal       @db.Decimal(10, 2) // = booking.totalPrice at initiate time
  currency       String        @default("BDT")
  status         PaymentStatus @default(INITIATED)
  gatewayPageUrl String?
  sslSessionKey  String?
  cardType       String?
  bankTranId     String?
  paidAt         DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  booking Booking @relation(fields: [bookingId], references: [id])

  @@index([bookingId])
  @@index([status])
  @@map("payments")
}
```

- `booking.prisma`: add `payments Payment[]` back-relation.
- Apply with `npx prisma migrate dev --name add-payment-module`.

## PaymentStatus lifecycle

| Status | Meaning |
|---|---|
| `INITIATED` | Session created; user is on the gateway page |
| `SUCCESS` | Server-validated, amount matches → booking flips `PENDING → PAID` |
| `FAILED` | Gateway init failed or validator reports INVALID / amount mismatch |
| `CANCELLED` | Abandoned session (no `SUCCESS` inside the TTL window) auto-cancelled on next initiate |
| `REFUNDED` | Set when a `PAID` booking is cancelled (DB flag only — refund API deferred to backlog) |

## SSLCommerz client — `src/lib/sslcommerz.ts`

Thin typed wrapper over native `fetch` — **no new npm dependency**.

- Gateway/validator URLs come from `SSLCOMMERZ_INIT_URL` / `SSLCOMMERZ_VALIDATE_URL` (GearUp pattern);
  when absent they default off `SSL_COMMERZ_SANDBOX` (sandbox `https://sandbox.sslcommerz.com`, live
  `https://securepay.sslcommerz.com`).
- `sslcommerzInit(options)` — `POST {init_url}/gwprocess/v4/api.php` (form-encoded):
  `store_id, store_passwd, total_amount, currency=BDT, tran_id, success_url, fail_url, cancel_url,
  ipn_url, cus_name, cus_email, cus_add1="N/A", cus_add2="N/A", cus_city="N/A", cus_state="N/A",
  cus_postcode=1000, cus_country="Bangladesh", cus_phone, product_name, shipping_method=NO`.
  Returns `{ status, GatewayPageURL, sessionkey }`; non-success → throw (clean 502 path in service).
- `sslcommerzValidate({ val_id })` — `GET {validate_url}?val_id&store_id&store_passwd&format=json` →
  `{ status: "VALID"|"VALIDATED"|"INVALID_TRANSACTION"|"FAILED", amount, currency, card_type,
  bank_tran_id, ... }`. Parsed defensively (gateway edge cases can return unexpected shapes).
- `tran_id` is generated server-side: `TRNX_ID-<Date.now()>-<randomUUID().slice(0,8)>` (≤30 chars, the
  gateway's hard limit). The client never supplies it.

## Config & env — `src/config/index.ts`, `.env.example`

- Required: `SSL_COMMERZ_STORE_ID`, `SSL_COMMERZ_STORE_PASSWORD`, `BACKEND_PUBLIC_URL`
- Defaults: `SSL_COMMERZ_SANDBOX=true` (switches to live gateway URLs); `SSLCOMMERZ_INIT_URL` /
  `SSLCOMMERZ_VALIDATE_URL` optional overrides (GearUp pattern).
- `BACKEND_PUBLIC_URL` is the publicly reachable base the module builds the success/fail/cancel/IPN
  callback URLs from. **Must not be localhost in sandbox** — the gateway POSTs to it server-to-server.
- Frontend redirect target (`/payment/{success|fail|cancel}?bookingId=`) is picked off `NODE_ENV`
  (`frontend_url_prod` vs `frontend_url_dev`).

## Endpoints — `/api/payments`

```
POST  /create    auth(USER)      JSON { bookingId }        → { paymentId, tranId, paymentUrl }
POST  /confirm   PUBLIC          form POST from SSLCommerz  → 302 to /payment/{success|fail|cancel}
POST  /ipn       PUBLIC          form POST from SSLCommerz  → 200 text/plain ("OK")
```

- `/create` is registered before the static `/confirm` + `/ipn` paths (Express 5 static-beats-param);
  there is no `/:id` route.
- `/confirm` and `/ipn` accept the gateway's `application/x-www-form-urlencoded` POST (the global
  `express.urlencoded` middleware parses it) and share the same idempotent `processGatewayResult`.
- Receipt view comes from Step 9's `GET /api/bookings/:id`, whose response gains a `payments` array —
  no separate payment GET endpoint.

## Flow

1. **Book** — `POST /api/bookings` (unchanged, Step 9) creates the `PENDING` booking with a
   server-computed `totalPrice`.
2. **Create session** — frontend calls `POST /api/payments/create` right after a 201:
   - Booking must exist and be owned by `req.user` (`booking.userId === req.user.id`) → else 403.
   - Booking must be `PENDING`; already `PAID` → 409 "already paid"; `CANCELLED`/`CONFIRMED`/
     `COMPLETED` → 409 "not payable".
   - Any outstanding `INITIATED` session for this booking is flipped to `CANCELLED` first, then a fresh
     `Payment` row (`tranId`, `amount = booking.totalPrice`, BDT) is created and `sslcommerzInit` called.
     Init failure → `FAILED` row + rethrow.
   - Return `{ paymentId, tranId, paymentUrl: GatewayPageURL }`.
3. **Redirect** — user pays on the SSLCommerz page; SSLCommerz fires the IPN (async) and POSTs to
   `success_url` / `fail_url` / `cancel_url` (distinguished by the `?status=success|fail|cancel` query
   the module appended).
4. **Confirm** — `POST /api/payments/confirm` settles and then `302`s the browser to the frontend
   `/payment/{success|fail|cancel}?bookingId=` page:
   - `status=CANCEL`/`fail_status=CANCELLED` → payment → `CANCELLED`, no charge.
   - Fail (no `val_id`) → payment → `FAILED`.
   - Success (has `val_id`) → server-side `sslcommerzValidate`: require `status VALID|VALIDATED` **and**
     `amount === payment.amount` (exact 2-dp BDT). Mismatch/unreachable → payment `FAILED`, no booking
     change. Verified → payment `SUCCESS` (`paidAt`, `cardType`, `bankTranId`, `valId`), then flip
     booking `PENDING → PAID` via **compare-and-set** (`updateMany` `where { id, status: PENDING }`)
     inside the same transaction — a racing IPN or stale booking can't double-process.
5. **IPN** — `POST /api/payments/ipn`: same `processGatewayResult` helper (compare-and-set makes both
   paths safe and idempotent). Always answers **200 plain text** (SSLCommerz retries otherwise) — no
   `sendResponse` envelope on this route. Never trusts the raw IPN body; every status change goes
   through the validator + amount check.

## Booking state machine — extended in `booking.service.ts`

Everything from Step 9 stays; these rows are added/changed:

| From | To | Allowed by | Note |
|---|---|---|---|
| `PENDING` | `PAID` | **system (payment module only)** | never offered on `PATCH /:id/status`; driven by payment success via compare-and-set |
| `PAID` | `CONFIRMED` | AGENT (owns package), ADMIN | the seller act that used to be `PENDING → CONFIRMED` |
| `PAID` | `CANCELLED` | USER (owns booking), AGENT (owns package), ADMIN | same transaction: `SUCCESS` payment → `REFUNDED` |
| (any) | `CANCELLED` | — | cancelling a booking also flips its `INITIATED` payments → `CANCELLED` |

- `PENDING → CANCELLED` (existing) — no payments to touch.
- `CONFIRMED → …` and `COMPLETED` rules unchanged. Not adding refund API calls (backlog).
- `BookingStatus` now includes `PAID`, so `src/utils/email.ts` `statusCopy` must add a `PAID` entry
  ("Payment received — the agent will confirm shortly") or TS will fail the exhaustive `Record`.
- Seed script (Step 13): optionally add sample `SUCCESS` payments for a few bookings so the receipt and
  dashboard aggregates show data.

## Security, rate limiting, hygiene

- `/api/payments/ipn` is intentionally public (`no auth()`): authenticity comes from the validator call
  plus `tranId`/`amount` match. It must never move behind `auth()`.
- `apiLimiter` (100/15min) already covers `/api/payments/*`; the IPN handler stays minimal (validate →
  one DB write → 200).
- Server never sees card numbers (SSLCommerz hosts the page); we persist only `cardType`/`bankTranId`
  metadata. `tranId`/`valId` are gateway refs, not secrets.
- Money stays `Decimal` in Prisma; `Number()` only at the service boundary (Step 2 convention).
- The charged `amount` is frozen at initiate time from `booking.totalPrice` — later package price
  changes must not alter it.

## Pricing / currency note

SSLCommerz processes **BDT only**. The charged amount is the booking `totalPrice` expressed in BDT; no
conversion logic in the backend (store prices as BDT, treat display currency as a frontend concern).

## Files to change

- `prisma/schema/enums.prisma`
- `prisma/schema/booking.prisma`
- `src/config/index.ts`
- `.env.example`
- `src/app.ts` — register `paymentRoutes` at `/api/payments`
- `src/utils/email.ts` — `statusCopy` gains `PAID`
- `src/modules/booking/booking.service.ts` — `PAID` transitions, payment-to-refund/cancel on booking
  cancel, `payments` included in booking detail/list output, `totalPrice` untouched
- `prisma/seed.ts` — optional sample payments
- `.opencode/specs/00-overview.md` — add step 16 to the build order
- `.opencode/specs/02-data-models.md` — move `Payment` out of `[LATER]`, add `PAID` to `BookingStatus`
- `.opencode/specs/15-backlog-summary.md` — drop payment gateway from the backlog list

## Files to create

- `prisma/schema/payment.prisma`
- `src/lib/sslcommerz.ts`
- `src/modules/payment/payment.route.ts`
- `src/modules/payment/payment.controller.ts`
- `src/modules/payment/payment.service.ts`
- `src/modules/payment/payment.validation.ts`
- `src/modules/payment/payment.interface.ts`
- migration `prisma/migrations/*add_payment_module`

## New dependencies

None (native `fetch`; `express.urlencoded` already parses the IPN form post).

## Rules for implementation

- Keep the `route → controller → service → validation` module shape with singletons; JSON endpoints use
  the `sendResponse` envelope (IPN is the one plain-text exception).
- Services throw `AppError(statusCode, message)`; `catchAsync` + global error handler do the rest. The
  only inline catch is in the SSLCommerz client mapping network errors → `502`.
- Every write touching booking state runs in an interactive transaction; status flips are compare-and-set
  (`updateMany`, `count === 0` → 409 / idempotent no-op), exactly like Step 9.
- Best-effort emails via `Promise.allSettled` — an email failure never fails the request.
- SSLCommerz creds must never be logged. Env validated at boot in `src/config/index.ts`; the module never
  reads `process.env` directly.
- Section-header comments only where the existing modules use them (no new commentary).

## Definition of done

- `npx prisma migrate dev --name add_payment_module` applies cleanly; `npx tsc --noEmit` passes.
- Modules wired into `src/app.ts`; `npm run dev` boots and `GET /health` OK.
- With sandbox store creds + a public `BACKEND_PUBLIC_URL` in `.env`:
  - Create a booking, then `POST /api/payments/create` → returns a sandbox `paymentUrl`; payment row is
    `INITIATED`. Creating again while a session is open flips the old session to `CANCELLED`. Creating
    for a `CANCELLED` booking → 409.
  - Pay on the sandbox gateway; `/api/payments/confirm` is POSTed by SSLCommerz → payment `SUCCESS`,
    booking `PAID`, browser redirected to `/payment/success`. The sandbox IPN replay to
    `/api/payments/ipn` is a 200 idempotent no-op.
  - Booking list/detail now includes `payments`; `?status=PAID` filter works.
  - AGENT(owner) moves `PAID → CONFIRMED`; after the travel date `CONFIRMED → COMPLETED`. USER cancels the
    `PAID` booking → booking `CANCELLED`, payment `REFUNDED`.
- Commit + push this step (AGENTS.md workflow).