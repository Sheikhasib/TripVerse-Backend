# Step 9 — Booking Module

## Endpoints — `/api/bookings`
```
POST   /                     auth(USER)   blocks duplicate PENDING booking same package+date
GET    /my-bookings          auth(USER)    ?page&limit&status
GET    /agent-bookings       auth(AGENT)   ?page&limit&status&search
GET    /                     auth(ADMIN)  ?page&limit
PATCH  /:id/status            auth          validated against the state machine table below
```

## List pagination
`my-bookings`, `agent-bookings`, and admin `GET /` all return `page`/`limit` + `meta` (Step 3 envelope) — the dashboard booking tables require filtered, paginated data. Optional `status` (enum-whitelisted) filters every list; `agent-bookings` also takes `search` on package title so an agent with many bookings can find one. Limit capped at Step 3's 50 server-side.

## `totalPrice` is never trusted from the client
Request body only accepts `packageId, travelDate, travelers` — the controller looks up the package's current `price`, computes `totalPrice = price * travelers` server-side, and persists that. Any `totalPrice` field sent in the request body is ignored. Without this, a tampered request could book a package at an arbitrary price.

## Create validation
- `travelDate` — Zod `.refine(...)` refusing dates before today; the state machine's `CONFIRMED → COMPLETED` rule keys off `travelDate`, so a past date is nonsense.
- `travelers` — Int, `.min(1)`, `.max(20)` — bounds the server-side `totalPrice = price * travelers` and keeps values sane.

## Duplicate-booking guard
Before creating, check for an existing `PENDING` booking with the same `userId + packageId + travelDate`; reject if found.

## Booking status state machine
Fixed transitions only — controller rejects anything outside this table instead of accepting free-form status strings.

| From | To | Allowed by |
|---|---|---|
| `PENDING` | `CONFIRMED` | AGENT (owns package), ADMIN |
| `PENDING` | `CANCELLED` | USER (owns booking), AGENT, ADMIN |
| `CONFIRMED` | `COMPLETED` | AGENT (owns package), ADMIN — only after `travelDate` has passed |
| `CONFIRMED` | `CANCELLED` | USER (owns booking), AGENT, ADMIN |
| `COMPLETED` | — | terminal, no further transitions |
| `CANCELLED` | — | terminal, no further transitions |

`PATCH /api/bookings/:id/status` validates the requested transition against this table before touching the DB — keeps the authorization logic in one place instead of scattered if/else in the controller.
