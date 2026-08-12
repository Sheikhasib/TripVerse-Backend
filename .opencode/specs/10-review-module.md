# Step 10 — Review Module

## Endpoints — `/api/reviews`
```
POST   /                    auth(USER)  requires COMPLETED booking; one review per user per package; rating recalculated in a transaction
GET    /package/:packageId  public      paginated, APPROVED + not-deleted packages only
```

## Create validation (Zod)
- `packageId` — must reference an existing package that is `APPROVED` and `isDeleted: false`; a review of a pending/rejected/deleted package is nonsense.
- `rating` — Int `.min(1)` `.max(5)` — bounds the average so a bad value can never corrupt `TourPackage.rating`.
- `comment` — required (schema field is non-nullable), `.min(1)` `.max(1000)`.

## COMPLETED booking gate
Before insert, verify the user has a booking with `userId + packageId + status: COMPLETED`. No completed booking → 403. Also reject self-reviews — if the package's `agentId` equals the user's id, return 403 (an agent rating their own package is a conflict of interest).

## Duplicate-review guard
Pre-check for an existing `userId + packageId` review and return a friendly 409 ("You've already reviewed this package"). `@@unique([userId, packageId])` stays as the DB backstop — the global P2002→409 mapping catches any race, but the controller pre-check gives a clean message instead of surfacing the raw constraint.

## Transactional rating recalculation
Insert the review and recompute the package rating in the same `prisma.$transaction(async (tx) => {...})`:
- aggregate `avg(rating)` over all reviews for the package, round via `Math.round(avg * 10) / 10`, then `tx.tourPackage.update(...)` so `rating` never stores `3.8333333...`.
- The `@@unique` constraint makes double-insert impossible — a concurrent loser fails on insert inside its own transaction, so its stale average is never written. No double-counting.

## Public list contract
`GET /package/:packageId` returns the Step 3 pagination envelope (`page`/`limit` + `meta`), default limit 10, capped at 50 server-side, ordered `createdAt desc`. The package must be `APPROVED` and `isDeleted: false` (404 otherwise) so reviews of unpublished packages never leak. Each item includes the reviewer's `name` and `avatarUrl` (select only — never email/role).

## Out of scope (deferred to Step 15)
No edit/delete — review update/removal is backlogged. When delete lands later, it must also recompute the package rating on removal; the insert-only recalculation here is not a reusable path.
