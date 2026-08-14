# Step 20 — Review Edit & Delete

## Overview

Promotes review edit/delete out of the backlog (Step 15). Today a review is insert-only
(`review.service.ts`); a user who typo'd their comment is stuck with it forever. This step adds:

- **Edit** — the review author updates `rating` and/or `comment`; the package's average rating is
  recomputed in the same transaction (the current `createReview` recompute path is extracted into a
  shared helper so create/edit/delete all use the exact same math).
- **Delete** — the review author or any ADMIN removes a review; the average is recomputed on removal
  (this is the exact case Step 10's "Out of scope" note demanded).

The public list contract is unchanged (`GET /package/:packageId`), except it must exclude deleted
reviews so a removed rating stops counting toward the average.

## Depends on

- `prisma/schema/review.prisma` — needs an `isDeleted` column added (soft delete keeps the
  `@@unique([userId, packageId])` backstop meaningful and lets an ADMIN restore instead of destroy)
- `src/modules/review/review.service.ts` — the transactional rating-recompute block to extract
- `src/modules/review/review.route.ts`, `review.controller.ts`, `review.validation.ts`,
  `review.interface.ts`
- `src/middleware/auth.ts`, `src/utils/sendResponse.ts`

## Prisma changes

`prisma/schema/review.prisma` gains one column:

```prisma
model Review {
  id        String @id @default(uuid())
  rating    Int
  comment   String
  isDeleted Boolean @default(false)   // soft delete so replies/ownership checks keep working

  userId    String
  packageId String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user    User        @relation("CustomerReviews", fields: [userId], references: [id])
  package TourPackage @relation(fields: [packageId], references: [id])

  @@unique([userId, packageId])
  @@index([packageId])
  @@map("reviews")
}
```

Apply with `npx prisma migrate dev --name add_review_edit_delete`.

## Shared rating recompute

Extract the `createReview` tail (aggregate `avg(rating)` over non-deleted reviews →
`Math.round(avg * 10) / 10` → `tourPackage.update`) into:

```
src/modules/review/review.service.ts
  recomputePackageRating(tx, packageId) — private helper, tx-scoped
```

`createReview`, `updateReview`, and `deleteReview` all call it inside their own `$transaction`.
Crucially the aggregate's `where` must add `isDeleted: false` everywhere (create, edit, delete) so a
deleted review's rating never counts — otherwise delete would recompute an unchanged average.

## Endpoints — `/api/reviews`

```
PATCH  /:id    auth(USER)  author only — JSON { rating?, comment? } (≥1 field) → updated review + rating
DELETE /:id    auth()      author OR ADMIN — soft delete + recompute → { reviewId, rating }
```

### Behavior

- **PATCH /:id** — `where { id, userId }` lookup (foreign id → 404, never a leak). `rating` and
  `comment` reuse the create schema's bounds (`Int` 1–5, comment 1–1000). `.strict()` so no unknown
  keys. At least one of `rating`/`comment` required. Update, then `recomputePackageRating` in the
  same transaction. Return `{ review, rating }` where `rating` is the fresh value
  `recomputePackageRating` just wrote — read it back from the package row inside the transaction
  (`select: { rating: true }`) rather than returning the input, so the client's displayed average is
  authoritative.
- **DELETE /:id** — author (`userId === req.user.id`) or ADMIN. `update({ data: { isDeleted: true } })`
  inside a transaction with `recomputePackageRating`. Return the id + new average. The public list
  adds `isDeleted: false` to its `where`, so the review disappears from the package page.
- The unique-on-create guarantee is preserved: `@@unique([userId, packageId])` is per-row, so
  re-reviewing after a delete still fails with the friendly 409 from the pre-check — deleting a
  review does **not** let a user review the same package twice (it's a soft delete; the row exists).
  If that behaviour is ever wanted, it'd be a hard delete in a later step.
- No admin list of deleted reviews in this step (backlog: moderation UI).

## Files to change

- `prisma/schema/review.prisma`
- `src/modules/review/review.service.ts` — extract helper; add `updateReview`, `deleteReview`
- `src/modules/review/review.controller.ts`
- `src/modules/review/review.route.ts` — `PATCH /:id`, `DELETE /:id` (registered after
  `GET /package/:packageId` so the literal `/package` segment isn't swallowed)
- `src/modules/review/review.validation.ts` — `updateReviewSchema`, `reviewIdParamsSchema`
- `src/modules/review/review.interface.ts`

## New dependencies

None.

## Rules for implementation

- Every write touching a rating runs in an interactive transaction with the shared recompute helper.
- Money/rating stay server-computed — the client can never set `rating` out of 1–5 (Zod) or bypass
  the recompute.
- Owner checks are `where { id, userId }`; ADMIN bypass via an explicit role branch (mirror
  `booking.service.ts` `canManage`).
- Soft delete only — no hard `delete` in this step.
- Section-header comments only where existing modules use them.

## Definition of done

- `npx prisma migrate dev --name add_review_edit_delete` applies; `npx tsc --noEmit` passes.
- A user edits their review's rating/comment → response shows the change + the package's recomputed
  `rating`; the package detail reflects the new average. Editing a foreign review → 404; editing with
  no fields → 400; invalid rating → 400.
- Author/ADMIN deletes a review → it disappears from `GET /package/:packageId`, and the average is
  recomputed without it. Deleting a foreign review → 404.
- Create/edit/delete all produce identical averages for the same review set (the shared helper is
  the single source of truth).
- Commit + push (AGENTS.md workflow).