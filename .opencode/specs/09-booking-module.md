# Step 9 — Booking Module

## Role model
- Only `USER`-role accounts **create** bookings — customers book, agents sell.
- `AGENT` acts on bookings **only for packages they own** (`package.agentId === req.user.id`).
- `ADMIN` is the global override for every transition.
- "Booking owner" means `booking.userId === req.user.id`.
- Ownership checks are explicit in the service; a `403` when the caller isn't owner / package-owner / admin.

## Endpoints — `/api/bookings`
```
POST   /                    auth(USER)      blocks duplicate PENDING booking same package+date
GET    /my-bookings         auth(USER)      ?page&limit&status
GET    /agent-bookings      auth(AGENT)     ?page&limit&status&search   (scoped to own packages)
GET    /:id                 auth(USER|AGENT|ADMIN)  owner / package-owner / admin only
GET    /                    auth(ADMIN)     ?page&limit&status&search
PATCH  /:id/status          auth            validated against the state machine table below
```

## Single-booking detail (`GET /:id`)
Return the booking with its `package` and a compact `user` (name + email) for admin/agent views.
Authorization: booking owner, the agent owning the package, or admin. This is what the frontend
confirmation/receipt page renders.

## List pagination
`my-bookings`, `agent-bookings`, and admin `GET /` all return `page`/`limit` + `meta` (Step 3 envelope) —
the dashboard booking tables require filtered, paginated data. Optional `status` (enum-whitelisted)
filters every list; `agent-bookings` and admin `GET /` also take `search` on package title. Limit capped
at Step 3's 50 server-side.

## `totalPrice` is never trusted from the client
Request body only accepts `packageId, travelDate, travelers` — the controller looks up the package's
current `price`, computes `totalPrice = price * travelers` server-side, and persists that. Any
`totalPrice` field sent in the request body is ignored. Without this, a tampered request could book a
package at an arbitrary price.

## Availability gate
Booking requires the package to be bookable: `status === APPROVED && !isDeleted`. A `PENDING`/`REJECTED`
or soft-deleted package cannot be booked (`409`). Enforced in the `createBooking` package lookup.

## Create validation
- `travelDate` — Zod `.refine(...)` refusing dates before today; compare on the **UTC date** (store the
  travel date as UTC midnight) so "before today" and the `CONFIRMED → COMPLETED` rule are stable across
  timezones.
- `travelers` — Int, `.min(1)`, `.max(20)` — bounds the server-side `totalPrice = price * travelers`
  and keeps values sane. Note: `max(20)` is a product constant for now; if a package `capacity` field is
  ever added, rebooking/confirm must clamp `travelers <= capacity` to prevent overselling.

## Duplicate-booking guard
- Check for an existing `PENDING` booking with the same `userId + packageId + travelDate`.
- **Recent** PENDING (created within the last **24h** — a configurable constant) → reject with `409`.
  This stops double-submits and an active checkout.
- **Stale** PENDING (older than the window) → treated as abandoned: the service cancels the old booking
  inside the same transaction, then creates the new one. Without this, a single abandoned checkout locks
  the user out of that package+date forever.
- The check and the create run inside an **interactive transaction** (check-then-insert is racy; plain
  `skipDuplicates` isn't supported on Postgres). Add a composite index on
  `@@index([userId, packageId, travelDate])` for the guard query.

## Booking status state machine
Fixed transitions only — the service rejects anything outside this table instead of accepting free-form
status strings. "Allowed by" resolves to: booking owner, package-owning agent, or admin (see Role model).

| From | To | Allowed by |
|---|---|---|
| `PENDING` | `CONFIRMED` | AGENT (owns package), ADMIN |
| `PENDING` | `CANCELLED` | USER (owns booking), AGENT (owns package), ADMIN |
| `CONFIRMED` | `COMPLETED` | AGENT (owns package), ADMIN — only after `travelDate` has passed |
| `CONFIRMED` | `CANCELLED` | USER (owns booking), AGENT (owns package), ADMIN |
| `CONFIRMED` | `PENDING` | AGENT (owns package), ADMIN — before `travelDate` (undo accidental confirm) |
| `COMPLETED` | — | terminal, no further transitions |
| `CANCELLED` | — | terminal, no further transitions |

## Status transitions are compare-and-set
Don't trust a pre-read `status` — two concurrent agents could both pass the state-machine check. After
validating the transition + ownership, apply the change with a **conditional update**:
`updateMany({ where: { id, status: <expected-from>, ... }, data: { status: <to> } })` and require
`count === 1`, inside a transaction. `count === 0` → `409` (state changed under you, retry).

## Notifications (best-effort)
Booking **created**, **confirmed**, and **cancelled** are the highest-value email moments in a travel
app. Reuse the contact module's pattern: fire `sendBookingEmail(...)` via `Promise.allSettled` so an
email failure never fails the request or the DB write.
