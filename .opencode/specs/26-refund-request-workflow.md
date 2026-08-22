# Step 26 — Refund Request Workflow (Apply → Admin Review → Policy-Based Payout)

## Overview

Replaces the customer self-cancel path for paid bookings. Business rule: **once a booking is
PAID/CONFIRMED, the customer cannot cancel it** — money is committed. Instead the customer
**applies for a refund** (reason category + free text + optional evidence image); an **ADMIN**
verifies the facts and either **approves** (booking flips CANCELLED, gateway pays out per the
policy tiers) or **rejects** (booking untouched). Agency-initiated cancellations keep today's
behavior: agent-owner/admin direct cancel still auto-refunds **100%** through the spec-23 path.

Policy source of truth: `docs/REFUND_POLICY.md` (customer-facing). Tier percentages:
90% (≥30 days before travel), 50% (15–29d), 25% (7–14d), 0% (<7d). Documented-emergency
categories are suggested at 100%, at admin discretion. The applicable tier is **snapshotted at
application submission** (industry convention: entitlement freezes when the operator receives
the request — an admin delay never reduces the customer's bracket).

## Depends on

- `src/modules/booking/booking.service.ts` — TRANSITIONS map (remove customer from paid-cancel),
  `issueRefunds` (spec 23) as payout engine reference; approval re-implements its loop with a
  **computed total** (partial refunds)
- `src/lib/sslcommerz.ts` — `sslcommerzRefund({ bank_tran_id, refund_amount, ... })` already
  supports arbitrary amounts → partial refunds need no lib change
- `src/modules/uploads` — evidence images; currently AGENT/ADMIN only → widen to USER
- `src/utils/email.ts`, `src/utils/notification.ts`, `src/middleware/auth.ts`,
  `prisma/schema/payment.prisma` (refund columns already exist)

## Prisma changes

```prisma
enum RefundReasonCategory {
  MEDICAL_EMERGENCY
  BEREAVEMENT
  VISA_REJECTION
  FORCE_MAJEURE
  CHANGE_OF_PLANS
}

enum RefundRequestStatus {
  PENDING    // applied, awaiting admin decision
  APPROVED   // approved + booking cancelled; payout may be pending gateway confirm
  REJECTED
  REFUNDED   // terminal: all settled payments confirmed refunded by gateway
}

model RefundRequest {
  id        String @id @default(uuid())

  bookingId String @unique
  userId    String

  category     RefundReasonCategory
  reason       String   @db.Text          // free-text explanation
  evidenceUrl  String?                    // Cloudinary URL (uploads module)

  // policy snapshot at submission — immutable after create
  daysBeforeTravel      Int               // travelDate − now, whole days at submission
  suggestedPercentage   Int               // tier/category suggestion shown to admin

  status         RefundRequestStatus @default(PENDING)
  approvedPercentage Int?              // final admin-decided pct (0–100)
  refundAmount   Decimal? @db.Decimal(10, 2)
  reviewNote     String?                 // mandatory on reject
  reviewedById   String?
  reviewedAt     DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  booking Booking @relation(fields: [bookingId], references: [id])
  user    User    @relation("RefundRequests", fields: [userId], references: [id])
  reviewer User?  @relation("RefundReviewer", fields: [reviewedById], references: [id])

  @@index([userId])
  @@index([status, createdAt])
  @@map("refund_requests")
}
```

Plus `NotificationType` gains `REFUND_REQUESTED | REFUND_APPROVED | REFUND_REJECTED`.
Apply with `npx prisma migrate dev --name add_refund_requests`.

> `bookingId @unique` enforces one *live* application; the "re-apply once after rejection"
> rule cannot live in a unique constraint (a rejected row would block forever), so it is
> service-enforced: creating a new request requires the previous one to be REJECTED and
> rejects-count < 2. On re-application the old REJECTED row stays for audit.

## State machine change — `booking.service.ts`

In `TRANSITIONS`: `[PAID][CANCELLED]` and `[CONFIRMED][CANCELLED]` switch `allowed` from
`canManage` to `isAgentOwnerOrAdmin`. The customer loses direct cancel of paid bookings
(403 via existing middleware+rule check); agents/admins retain it, and their cancels keep
the existing post-commit `issueRefunds` full-amount payout (= policy "agency-initiated →
100%"). `PENDING → CANCELLED` stays `canManage` (free cancel, no money involved).
No other transitions change; `requiresTravelDatePassed` logic untouched.

## Refund module — `src/modules/refund/`

`refund.route.ts → refund.controller.ts → refund.service.ts` (+ `refund.interface.ts`,
`refund.validation.ts` Zod schemas). Mounted at `/api/refunds` in `app.ts`.

| Method & path | Actor | Purpose |
|---|---|---|
| `POST /api/refunds` | owner USER | Apply: `{ bookingId, category, reason, evidenceUrl? }` |
| `GET /api/refunds/mine` | USER | Own applications (paginated) |
| `GET /api/refunds` | ADMIN | All applications; `?status=` filter + pagination meta |
| `GET /api/refunds/:id` | owner or ADMIN | Detail incl. snapshot + decision fields |
| `PATCH /api/refunds/:id/decision` | ADMIN | `{ action: "APPROVE"\|"REJECT", approvedPercentage?, reviewNote? }` |

### Create rules (`createRefundRequest`)

1. Booking exists, belongs to actor, `status ∈ {PAID, CONFIRMED}`.
2. No live request on the booking (`status ∈ {PENDING, APPROVED, REFUNDED}` blocks);
   re-application allowed only when the latest is REJECTED and rejectedCount < 2.
3. `evidenceUrl` **required** for MEDICAL_EMERGENCY, BEREAVEMENT, VISA_REJECTION,
   FORCE_MAJEURE (docs-backed categories); optional for CHANGE_OF_PLANS.
4. Snapshot: `daysBeforeTravel = floor((travelDate − now)/86400s)` (UTC-midnight math like
   `toUTCMidnight`); `suggestedPercentage` from pure helper
   `suggestRefundPercentage(category, daysBeforeTravel)`:
   docs-backed categories → 100; else ≥30 → 90, 15–29 → 50, 7–14 → 25, ≤6 → 0.
5. Best-effort email ("application received") + `REFUND_REQUESTED` notification.

### Decision rules (`decideRefundRequest`) — APPROVE

1. Compute `pct = clamp(approvedPercentage ?? suggestedPercentage, 0, 100)`; for
   CHANGE_OF_PLANS additionally `pct = min(pct, suggestedPercentage)` — admin may grant
   *more* only on docs-backed categories. `amount = round(totalPrice × pct / 100)`, capped
   at the sum of the booking's `SUCCESS` non-refunded payments (never exceed money taken).
2. **One transaction, two CAS writes**: flip request `PENDING → APPROVED`
   (storing pct/amount/reviewedById/reviewedAt) AND flip booking `{ status: { in: [PAID,
   CONFIRMED] } } → CANCELLED` (+ INITIATED payments → CANCELLED, mirroring
   `updateBookingStatus`). Either count ≠ expected → throw 409 (e.g. agency cancelled
   meanwhile, or double decision) — transaction rolls back, nothing half-applied.
3. After commit: **payout loop** over `SUCCESS, refundCompletedAt: null` payments in
   `createdAt` order — deduct sequentially from `amount`; last payment may be partially
   refunded (`refund_amount` < original). Each success CAS-flips that payment to `REFUNDED`
   (same pattern as `issueRefunds`). Gateway failure leaves that payment `SUCCESS` +
   `refundInitiatedAt` (spec-23 semantics) and does **not** unapprove anything.
4. When every selected payment ended `REFUNDED` → request `APPROVED → REFUNDED`. If any
   failed → request **stays APPROVED** (money owed; manual retry later — same posture as
   spec 23's deferred retry endpoint). Response always carries
   `refundRequest` + `payout: { status: "SUCCESS"|"FAILED", message? }`.
5. Best-effort `REFUND_APPROVED` notification + decision email; payout confirmation reuses
   `sendRefundEmail` when refs exist.

### Decision rules — REJECT

CAS `PENDING → REJECTED`, `reviewNote` required (Zod min length). Booking and payments
untouched. Best-effort `REFUND_REJECTED` notification + email carrying the note.
A repeated decision hits the CAS (count 0 → 409) — never double-applies.

## Idempotency & safety summary

- One live application per booking (unique) + max 2 lifetime applications.
- Approval is double-CAS'd (request PENDING, booking PAID/CONFIRMED) inside one transaction.
- Money moves only via validated gateway calls after commit; ledger flips only on gateway
  confirmation; totals capped at actually-paid amounts.
- Gateway failure degrades to APPROVED-with-unpaid-payout, surfaced in response — never a
  silent loss, never an unapproved payout.

## Uploads widening

`POST /api/uploads/image` currently AGENT/ADMIN — add USER so customers can attach evidence.
No other uploads changes.

## Files to change

- `prisma/schema/enums.prisma`, `prisma/schema/notification.prisma` (enum values),
  new `prisma/schema/refundRequest.prisma` (+ relations in `user.prisma`, `booking.prisma`)
- `src/modules/booking/booking.service.ts` — TRANSITIONS allowed-fn swap
- `src/modules/refund/*` — new module
- `src/app.ts` — mount `/api/refunds`
- `src/modules/uploads/*` — role widening
- `src/utils/email.ts` — `sendRefundReceivedEmail`, `sendRefundDecisionEmail`
- `tests/refund.test.ts` (new) + adjust any booking tests asserting customer-cancel of PAID
  bookings (now 403). Mocks use `../src/...` specifier form; prisma stays real.

## Rules for implementation

- The **snapshot is immutable** — decisions read `suggestedPercentage`, never recompute.
- Admin override upward is only valid on docs-backed categories; enforced server-side.
- Never refund more than the sum of settled payments; partial refunds are first-class.
- A gateway hiccup must not corrupt state: booking/request flips commit first, payout is
  recoverable afterwards (`refundInitiatedAt` marks the retry surface).
- Errors map per globalErrorHandler; decisions on missing rows → 404, races → 409.
- No credentials/card data in logs; emails best-effort via `Promise.allSettled`.

## Definition of done

- Migration applies; `npx tsc --noEmit` passes; `npm test` green including the adjusted
  booking tests and the new refund suite (apply validation, snapshot correctness,
  approve happy path with partial allocation vs sandbox-mocked gateway, reject + re-apply
  limit, double-decision 409, customer-cancel-of-PAID 403).
- Sandbox verify: apply → approve on a real `SUCCESS` payment → booking CANCELLED, correct
  partial amount refunded, payments/request terminal states set, emails attempted.
- `GET /api/bookings/:id` detail surfaces the refund request alongside payments.
- Commit + push (AGENTS.md workflow).
