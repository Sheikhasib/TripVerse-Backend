# TripVerse — Step 2 Implementation Plan: Data Models

**Date:** 2026-08-11 · **Status:** Approved (discussion complete, no code written yet)
**Source of truth:** `.opencode/specs/02-data-models.md`, `03-core-backbone.md`
**Reference:** GearUp per-model schema layout + `prisma.config.ts`

## Goal

Build the complete Prisma schema (enums + 6 models) so Steps 4–14 can compile and run. Step 1 (setup/backbone) is already in place; Step 2 unblocks everything else.

## Locked decisions

| Decision | Choice |
|---|---|
| Config file | Port GearUp's `prisma.config.ts` (schema path, migrations path, seed command, `datasource.url` from env) — Prisma 7 CLI requires it |
| Schema layout | One `.prisma` file per model under `prisma/schema/` |
| Money | `Decimal @db.Decimal(10, 2)` for `price`/`totalPrice`; services map to `Number()` before returning so the API always emits plain numbers |
| Rating | Denormalized `Float` average on `TourPackage`, recomputed in a `$transaction` on review create (Step 10) |
| Duplicate booking guard | Service-layer check (Step 9), not a DB unique — Prisma can't express a partial unique index |
| Table names | `@@map` to snake_case plural (`users`, `tour_packages`, `bookings`, `reviews`, `categories`, `contact_messages`) |

## Files to create

### 1. `prisma.config.ts` (repo root)
Ported from GearUp:
- `schema: "prisma/schema"`
- `migrations.path: "prisma/migrations"`
- `migrations.seed: "tsx prisma/seed.ts"`
- `datasource.url: process.env.DATABASE_URL`
- `import "dotenv/config"` at top

### 2. `prisma/schema/enums.prisma`
`Role (USER/AGENT/ADMIN)`, `UserStatus (ACTIVE/SUSPENDED)`, `AuthProvider (CREDENTIAL/GOOGLE)`, `PackageStatus (PENDING/APPROVED/REJECTED)`, `BookingStatus (PENDING/CONFIRMED/CANCELLED/COMPLETED)`.

### 3. `prisma/schema/user.prisma`
```
id, name, email @unique, password String?, googleId String? @unique,
phone?, avatarUrl?, role @default(USER), status @default(ACTIVE),
authProvider @default(CREDENTIAL), emailVerified @default(false),
isDeleted @default(false), tokenVersion Int @default(0),
createdAt @default(now()), updatedAt @updatedAt
relations: packages TourPackage[] @relation("AgentPackages"),
           bookings Booking[] @relation("CustomerBookings"),
           reviews Review[] @relation("CustomerReviews")
@@index([role]), @@index([status])
@@map("users")
```

### 4. `prisma/schema/category.prisma`
```
id, name @unique, slug @unique, packages TourPackage[], timestamps
@@map("categories")
```

### 5. `prisma/schema/tourPackage.prisma`
```
id, title, slug @unique, description, location,
price Decimal @db.Decimal(10,2), duration Int, rating Float @default(0),
images String[], status @default(PENDING), isDeleted @default(false),
categoryId, agentId, timestamps
category Category @relation(fields:[categoryId], references:[id])
agent User @relation("AgentPackages", fields:[agentId], references:[id])
bookings Booking[], reviews Review[]
@@index([categoryId]), @@index([categoryId, price]),
@@index([price]), @@index([status])
@@map("tour_packages")
```

### 6. `prisma/schema/booking.prisma`
```
id, userId, packageId, travelDate DateTime, travelers Int,
totalPrice Decimal @db.Decimal(10,2), status @default(PENDING), timestamps
user @relation("CustomerBookings"), package @relation(fields:[packageId],...)
@@index([userId]), @@index([packageId]), @@index([status])
@@map("bookings")
```

### 7. `prisma/schema/review.prisma`
```
id, userId, packageId, rating Int, comment, timestamps
user @relation("CustomerReviews"), package @relation(...)
@@unique([userId, packageId]), @@index([packageId])
@@map("reviews")
```

### 8. `prisma/schema/contactMessage.prisma`
```
id, name, email, subject, message, isResolved @default(false), timestamps
@@index([isResolved])
@@map("contact_messages")
```

## Commands to run (in order)

```bash
npx prisma migrate dev --schema=prisma/schema --name init   # creates + applies migration
npx prisma generate --schema=prisma/schema                  # regenerates client (generated/ is gitignored)
npm run dev                                                 # boot; GET /health → { success: true, db: "connected" }
```

`migrate dev` requires a real `DATABASE_URL` in `.env` (already present). Do **not** commit `generated/` or `dist/`.

## Follow-up code touches (same step)

- `src/middleware/index.d.ts` — swap the stub `role: string` for the generated `Role` enum (AGENTS.md flagged this for exactly Step 2).
- `.env.example` — append optional vars `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `CONTACT_RECEIVER_EMAIL`, `EMAIL_FROM` (documented now, used in Steps 4/6; Zod `.optional()` in Step 4 config work).

## Non-goals (explicitly out of scope)

- No feature modules (auth, uploads, contact, category, package, booking, review, dashboard) — schema only.
- No seed data (Step 12). No `prisma/seed.ts` implementation.
- No payment, wishlist, notification models (deferred — see `14-backlog-summary.md`).
- No changes to `src/config/index.ts` Zod schema yet (Step 4 adds the optional vars).

## Acceptance criteria

1. `npx prisma generate` completes with no errors.
2. `npx prisma migrate dev --name init` applies cleanly to a fresh Postgres.
3. `npm run dev` boots; `GET /health` returns `{ success: true, db: "connected" }`.
4. `src/middleware/index.d.ts` uses the generated `Role` enum.
5. `generated/` and `dist/` remain gitignored.
