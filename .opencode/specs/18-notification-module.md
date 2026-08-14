# Step 18 — Notification Module

## Overview

Promotes notifications out of the backlog (Step 15) into a real module. In-app notifications for the
two state-changing surfaces that already exist: **bookings** (new booking → the package's agent;
confirmed/cancelled → the customer) and **packages** (approved/rejected → the agent who submitted
them). Reading notifications is REST + polling (no websockets — the frontend refetches on page load /
route change). Notifications are **best-effort, fire-and-forget** exactly like the existing emails:
an email/notification failure must never fail the business write that caused it.

## Depends on

- `prisma/schema/booking.prisma`, `prisma/schema/tourPackage.prisma`, `prisma/schema/user.prisma` —
  the actors and entities notifications reference
- `src/modules/booking/booking.service.ts` — booking state machine (create, confirm, cancel)
- `src/modules/package/package.service.ts` — `changePackageStatus` (approve/reject)
- `src/utils/email.ts` — the `Promise.allSettled` best-effort pattern to mirror
- `src/middleware/auth.ts`, `src/middleware/validateRequest.ts`, `src/utils/sendResponse.ts`
- `src/app.ts` — module registration at `/api/notifications`

## Prisma changes

New `prisma/schema/notification.prisma` + a `NotificationType` enum in `enums.prisma`:

```prisma
enum NotificationType {
  BOOKING_CREATED      // customer placed a booking → package's AGENT
  BOOKING_CONFIRMED    // agent/admin confirmed → customer
  BOOKING_CANCELLED    // any cancel → the other party
  PACKAGE_APPROVED     // admin approved → submitting AGENT
  PACKAGE_REJECTED     // admin rejected → submitting AGENT
}
```

```prisma
model Notification {
  id        String           @id @default(uuid())
  userId    String           // recipient — the one who sees it in their bell
  type      NotificationType
  title     String
  message   String
  link      String?          // frontend route, e.g. /dashboard/agent/bookings/<id>
  isRead    Boolean          @default(false)

  createdAt DateTime         @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, isRead, createdAt])
  @@map("notifications")
}
```

- `user.prisma`: add `notifications Notification[]` back-relation.
- Apply with `npx prisma migrate dev --name add_notification_module`.

## Endpoints — `/api/notifications`

```
GET    /                    auth()   paginated, my notifications (newest first), optional ?unread=true
GET    /unread-count        auth()   → { count } for the bell badge (cheap, index-backed)
PATCH  /:id/read            auth()   marks one notification read (owner only)
PATCH  /read-all            auth()   marks all my notifications read
```

- **GET /** — Step 3 `meta` envelope, default limit 20, capped 50. `where: { userId }`; `?unread=true`
  adds `isRead: false`. Ordered `createdAt desc`. Owner scoping is implicit via `req.user.id` — a
  notification is never addressable by another user's id (the PATCH `:id` lookup is `where { id,
  userId }`, so a foreign id is simply a 404, not a leak).
- **GET /unread-count** — `prisma.notification.count({ where: { userId, isRead: false } })` → envelope
  `data: { count }`.
- **PATCH /:id/read** — `updateMany({ where: { id, userId }, data: { isRead: true } })`; `count === 0`
  → 404. Idempotent: re-reading an already-read row updates nothing but still succeeds.
- **PATCH /read-all** — `updateMany({ where: { userId, isRead: false }, data: { isRead: true } })`.
  Registered **before** `PATCH /:id/read` (Express matches top-down; `/read-all` would otherwise be
  swallowed by `/:id`).
- No delete endpoint in this step — unread history is fine to keep (backlog: prune after N days).

## Where notifications are raised

A single `notify(userId, type, title, message, link?)` helper in
`src/utils/notification.ts` (best-effort, `Promise.allSettled`, never blocks/throws) called from the
existing services — mirroring `sendBookingEmail`:

- `booking.service.ts` `createBooking` → `BOOKING_CREATED` to `tourPackage.agentId` ("New booking
  received", link to agent booking detail).
- `booking.service.ts` `updateBookingStatus`:
  - `→ CONFIRMED` → `BOOKING_CONFIRMED` to `booking.userId`.
  - `→ CANCELLED` → `BOOKING_CANCELLED`. Recipient depends on the actor: customer cancels → notify
    the package agent; agent cancels → notify `booking.userId`; **ADMIN cancels → notify both** the
    customer and the package agent, because an admin acts on behalf of the platform, not either
    side.
- `package.service.ts` `changePackageStatus`:
  - `→ APPROVED` → `PACKAGE_APPROVED` to `tourPackage.agentId`.
  - `→ REJECTED` → `PACKAGE_REJECTED` to `tourPackage.agentId`.

Raising happens **after** the write succeeds, as `void Promise.allSettled([...])` — same shape as the
existing emails, so a notification insert failure can't roll back or fail the business transaction.

## Files to change

- `prisma/schema/enums.prisma`
- `prisma/schema/user.prisma`
- `src/app.ts` — register `notificationRoutes` at `/api/notifications`
- `src/modules/booking/booking.service.ts` — raise notifications on create/confirm/cancel
- `src/modules/package/package.service.ts` — raise notifications on approve/reject

## Files to create

- `prisma/schema/notification.prisma`
- `src/utils/notification.ts`
- `src/modules/notification/notification.route.ts`
- `src/modules/notification/notification.controller.ts`
- `src/modules/notification/notification.service.ts`
- `src/modules/notification/notification.validation.ts`
- `src/modules/notification/notification.interface.ts`
- migration `prisma/migrations/*add_notification_module`

## New dependencies

None.

## Rules for implementation

- Keep the `route → controller → service → validation` module shape with singletons.
- Every write is idempotent (`updateMany`) and owner-scoped (`where { ... userId }`); P2002/P2025
  never surface raw — the global handler maps them.
- Notification raising is best-effort (`Promise.allSettled`) and fired after the write — never inside
  the interactive transaction.
- No polling abuse guard needed yet (apiLimiter 100/15min covers `/api/notifications`); the
  `unread-count` route stays a single indexed count.
- Section-header comments only where existing modules use them.

## Definition of done

- `npx prisma migrate dev --name add_notification_module` applies; `npx tsc --noEmit` passes.
- Wired into `src/app.ts`; `npm run dev` boots, `GET /health` OK.
- Booking created by a USER → the package AGENT sees a `BOOKING_CREATED` notification (and the count
  badge increments). Confirming that booking → the customer gets `BOOKING_CONFIRMED`. Cancelling →
  the counterparty gets `BOOKING_CANCELLED`.
- Admin approving/rejecting a package → the submitting AGENT gets `PACKAGE_APPROVED`/`PACKAGE_REJECTED`.
- `PATCH /:id/read` and `PATCH /read-all` flip `isRead`; `GET /?unread=true` filters correctly;
  reading a foreign notification id → 404; no token → 401.
- Commit + push (AGENTS.md workflow).
