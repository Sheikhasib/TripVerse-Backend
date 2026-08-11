# Step 12 — Dashboard Module

## Endpoints — `/api/dashboard`
```
GET    /admin                auth(ADMIN)   users/packages/bookings/revenue/monthly trend/category breakdown
GET    /agent                 auth(AGENT)   own packages/bookings/revenue/performance
GET    /user                  auth(USER)    bookings/upcoming/spend
```

## Aggregation patterns (port from GearUp `analytics.service.ts`)
Use Prisma `groupBy`/`aggregate` for trend and breakdown queries rather than looping and querying per-item — this is aggregation-heavy by nature and looped queries will be visibly slow once seed data (Step 13) is in place.

- **Overview cards**: run every count/aggregate in one `Promise.all`, never sequential `await`s.
- **Breakdowns** (bookings by status, packages by category, users by role): `groupBy` + `_count`, then resolve IDs to names with a single `findMany` + `Map` lookup (GearUp's category-name pattern) — not per-row queries.
- **Revenue-over-time**: Postgres `generate_series` via `$queryRawUnsafe` — date-bucket the last N days (clamp `days` to 1–365), `LEFT JOIN` only `COMPLETED` bookings, `COALESCE(SUM, 0)`. A per-day JS loop is slow and wrong for the trend chart.
- Apply the Step 3 soft-delete filter to every query.
