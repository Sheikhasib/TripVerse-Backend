# Step 17 — Wishlist Module

## Overview

Promotes the wishlist out of the backlog (Step 15) into a real module. A `USER` saves tour
packages to a wishlist (the "save for later" heart icon on the package card/detail) and views them
in a dedicated dashboard page. It is a pure join table — no business logic, no statuses — so it is
the cheapest of the backlog items and a natural first add-on. The package must be `APPROVED` and not
deleted at save time, mirroring the public-package visibility rule in `package.service.ts`.

## Depends on

- `prisma/schema/tourPackage.prisma` — the `TourPackage` model the wishlist rows point at
- `prisma/schema/user.prisma` — the `User` model (wishlist owner)
- `src/modules/package/package.service.ts` — `publicPackageInclude` pattern (agent/category select)
  to reuse for the wishlist list payloads
- `src/middleware/auth.ts` — `auth()` / `auth(Role.USER)` guards
- `src/middleware/validateRequest.ts` — Zod request validation
- `src/utils/sendResponse.ts` — the `{ success, statusCode, message, data, meta }` envelope
- `src/app.ts` — module registration at `/api/wishlist`

## Prisma changes

New `prisma/schema/wishlistItem.prisma`:

```prisma
model WishlistItem {
  id        String   @id @default(uuid())
  userId    String
  packageId String

  createdAt DateTime @default(now())

  user    User         @relation(fields: [userId], references: [id])
  package TourPackage  @relation(fields: [packageId], references: [id])

  @@unique([userId, packageId])
  @@index([userId, createdAt])
  @@map("wishlist_items")
}
```

- `user.prisma`: add `wishlist WishlistItem[]` back-relation.
- `tourPackage.prisma`: add `wishlistItems WishlistItem[]` back-relation.
- Apply with `npx prisma migrate dev --name add_wishlist_module`.

## Endpoints — `/api/wishlist`

```
GET    /              auth(USER)  paginated list of saved packages (newest first)
POST   /              auth(USER)  JSON { packageId } → adds to wishlist (idempotent)
DELETE /:packageId    auth(USER)  removes a package from the wishlist (idempotent)
```

### Behavior

- **POST** — validates `packageId` is a real, `APPROVED`, `isDeleted: false` package (404 otherwise,
  same rule as `getPublicPackages`). Use `prisma.wishlistItem.upsert` on the `@@unique(userId,
  packageId)` key so a repeat save is a no-op 201/200 instead of a 409. Return the created row.
- **GET** — paginated (Step 3 `meta` envelope, default limit 10, capped 50). Each item's package
  payload reuses `publicPackageInclude` (`category` + `agent` display info) and maps `price` to
  `Number()` (Decimal → boundary convention). Ordered `createdAt desc`.
- **GET — stale entries filtered at read time**: a saved package that was later soft-deleted or
  demoted out of `APPROVED` is filtered out of the response (`where: { package: { isDeleted: false,
  status: APPROVED } }`), so the page never lists a package whose detail route would 404. The
  wishlist row itself stays in the DB — filtering happens on read, not on save, so a re-approved
  package reappears without the user re-saving it.
- **DELETE** — `deleteMany({ where: { userId, packageId } })`; a missing row is a 204 no-op, never a
  404. There is deliberately no "clear all" — the user removes items one at a time on the page.
- **Auth** — all three are `auth(Role.USER)`. An AGENT/ADMIN may not wishlist (it is a customer
  concept); if the dashboard ever needs admin visibility of wishlists, that is a separate admin
  endpoint.

## Files to change

- `prisma/schema/user.prisma`
- `prisma/schema/tourPackage.prisma`
- `src/app.ts` — register `wishlistRoutes` at `/api/wishlist`

## Files to create

- `prisma/schema/wishlistItem.prisma`
- `src/modules/wishlist/wishlist.route.ts`
- `src/modules/wishlist/wishlist.controller.ts`
- `src/modules/wishlist/wishlist.service.ts`
- `src/modules/wishlist/wishlist.validation.ts`
- `src/modules/wishlist/wishlist.interface.ts`
- migration `prisma/migrations/*add_wishlist_module`

## New dependencies

None.

## Rules for implementation

- Keep the `route → controller → service → validation` module shape with singletons.
- Services throw `AppError(statusCode, message)`; `catchAsync` + the global handler do the rest.
- Money stays `Decimal` in Prisma; map to `Number()` at the service boundary (Step 2 convention).
- A package the user already saved must not 409 — upsert/deleteMany make both writes idempotent.
- Section-header comments only where existing modules use them.

## Definition of done

- `npx prisma migrate dev --name add_wishlist_module` applies; `npx tsc --noEmit` passes.
- Wired into `src/app.ts`; `npm run dev` boots, `GET /health` OK.
- USER token: `POST /api/wishlist { packageId }` → row created; repeat POST → no-op (no error);
  `GET /api/wishlist` returns it with package + price as a number + pagination `meta`;
  `DELETE /api/wishlist/:packageId` → 204; repeat DELETE → 204.
- Saving a `PENDING`/deleted package → 404; wishlist without a token → 401; AGENT token → 403.
- Commit + push (AGENTS.md workflow).
