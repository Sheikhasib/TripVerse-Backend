# Step 10 — Review Module

## Endpoints — `/api/reviews`
```
POST   /                     auth(USER)   requires COMPLETED booking; blocked by @@unique([userId, packageId]) if already reviewed; rating recalculated in a transaction
GET    /package/:packageId   public
```

## Rules
- Creation is gated on the user having a `COMPLETED` booking for that package — check before insert.
- `@@unique([userId, packageId])` (Step 2) blocks a second review from the same user on the same package at the DB level; controller should also pre-check and return a friendly error rather than surfacing the raw P2002.
- Rating recalculation (`TourPackage.rating`) happens in the same `prisma.$transaction` as the review insert — two separate writes here is a race condition under concurrent reviews. Round the new average to one decimal (`Math.round(avg * 10) / 10`) so `rating` never stores `3.8333333...`.
