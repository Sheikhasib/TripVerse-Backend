# TripVerse — Step 2 Implementation Plan: Data Models

**Date:** 2026-08-11 · **Status:** Implemented ✅ (schema built, migrated, verified)
**Source of truth:** `.opencode/specs/02-data-models.md`, `03-core-backbone.md`
**Reference:** GearUp per-model schema layout + `prisma.config.ts`

## Goal

Build the complete Prisma schema (enums + 7 models) so Steps 4–15 can compile and run. Step 1 (setup/backbone) was already in place; Step 2 is now done.

## Locked decisions (as implemented)

| Decision | Choice |
|---|---|
| Config file | `prisma.config.ts` created (schema path, migrations path, seed command, `datasource.url` from env) |
| Schema layout | One `.prisma` file per model under `prisma/schema/` |
| Money | `Decimal @db.Decimal(10, 2)` for `price`/`totalPrice`; services will map to `Number()` before returning |
| Rating | Denormalized `Float` average on `TourPackage`, recomputed in a `$transaction` on review create (Step 10) |
| Duplicate booking guard | Service-layer check (Step 9), not a DB unique — Prisma can't express a partial unique index |
| Table names | `@@map` to snake_case plural (`users`, `tour_packages`, `bookings`, `reviews`, `categories`, `contact_messages`, `blog_posts`) |
| Relations | All FKs `ON DELETE RESTRICT` (safe under soft-delete design, no cascades) |

## Files created

### `prisma.config.ts` (repo root)
`schema: "prisma/schema"`, `migrations.path: "prisma/migrations"`, `migrations.seed: "tsx prisma/seed.ts"`, `datasource.url: process.env.DATABASE_URL`, `import "dotenv/config"`.

### `prisma/schema/enums.prisma`
`Role (USER/AGENT/ADMIN)`, `UserStatus (ACTIVE/SUSPENDED)`, `AuthProvider (CREDENTIAL/GOOGLE)`, `PackageStatus (PENDING/APPROVED/REJECTED)`, `BookingStatus (PENDING/CONFIRMED/CANCELLED/COMPLETED)`, `PostStatus (DRAFT/PUBLISHED)`.

### `prisma/schema/*.prisma` (7 model files)
- **user** — `password String?`, `googleId @unique`, `authProvider @default(CREDENTIAL)`, `emailVerified @default(false)`, `isDeleted`, `tokenVersion @default(0)`, relations `packages`/`bookings`/`reviews`/`posts`, `@@index([role])`, `@@index([status])`.
- **category** — `name @unique`, `slug @unique`, `packages[]`.
- **tourPackage** — `slug @unique`, `price Decimal(10,2)`, `duration Int`, `rating Float @default(0)`, `images String[]`, `status @default(PENDING)`, `isDeleted`, `categoryId` + `agentId`; indexes `[categoryId]`, `[categoryId, price]`, `[price]`, `[status]`.
- **booking** — `travelDate DateTime`, `travelers Int`, `totalPrice Decimal(10,2)`, `status @default(PENDING)`, `userId` + `packageId`; indexes `[userId]`, `[packageId]`, `[status]`.
- **review** — `rating Int`, `comment`, `@@unique([userId, packageId])`, `@@index([packageId])`.
- **contactMessage** — `isResolved @default(false)`, `@@index([isResolved])`.
- **blogPost** — `title`, `slug @unique`, `excerpt`, `content`, `coverImage`, `status @default(DRAFT)`, `isDeleted`, `authorId` → User; indexes `[status]`, `[authorId]`.

## Commands executed

```bash
npx prisma generate                        # schema validated, client generated (7.9.1)
npx prisma migrate dev --name init         # migration 20260811144926_init created + applied
npx tsc --noEmit                           # clean
# server booted → GET /health → { success: true, db: "connected" }
```

Commands run **without** `--schema=prisma/schema` — `prisma.config.ts` now supplies the schema path.

## Follow-up code touches (done in this step)

- `src/middleware/index.d.ts` — `role: string` → generated `Role` enum (imported from `../../generated/prisma/enums`).
- `tsconfig.json` — commented out `rootDir: "./src"` (GearUp's exact fix): the generated client lives outside `src`, so an active `rootDir` broke `tsc`. `tsup` doesn't need it.
- `.env.example` — appended optional vars `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `CONTACT_RECEIVER_EMAIL`, `EMAIL_FROM` (used in Steps 4/6; Zod `.optional()`).

## Non-goals (out of scope, unchanged)

- No feature modules (auth, uploads, contact, category, package, booking, review, blog, dashboard) — schema only.
- No seed data (Step 13). No `prisma/seed.ts` implementation.
- No payment, wishlist, notification, blog-comment models (deferred — see `15-backlog-summary.md`).
- No changes to `src/config/index.ts` Zod schema yet (Step 4 adds the optional vars).

## Acceptance criteria (all met)

1. ✅ `npx prisma generate` completes with no errors.
2. ✅ `npx prisma migrate dev --name init` applies cleanly.
3. ✅ Server boots; `GET /health` → `{ success: true, db: "connected" }`.
4. ✅ `src/middleware/index.d.ts` uses the generated `Role` enum.
5. ✅ `generated/` and `dist/` remain gitignored; `npx tsc --noEmit` clean.
