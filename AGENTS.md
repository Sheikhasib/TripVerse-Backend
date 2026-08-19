# TripVerse Server

Backend API for TripVerse (travel packages, bookings, reviews). Scaffolded from a multi-step spec
(`01-project-setup.md` → `15-backlog-summary.md`). **Currently: Steps 1-5 done — project setup, full Prisma schema (7 models + 6 enums, migration applied), auth module (register/login/google/demo-login/refresh/logout/me + RBAC middleware + admin user management), and uploads module (`POST /api/uploads/image` → Cloudinary, AGENT/ADMIN only).

> **Workflow rule:** commit to git continuously as the work progresses — at minimum once per spec step, and more often for substantial milestones within a step (e.g. after a feature module's endpoints are verified). Push after each commit. Never leave uncommitted work at the end of a session.

## Quick start

```bash
npm install
cp .env.example .env        # real values: DATABASE_URL (Postgres), JWT secrets, Cloudinary creds
npx prisma generate         # required — generated/ is gitignored
npx prisma migrate dev --name init
npm run dev                 # tsx watch src/server.ts
```

Verify with `GET /health` → `{ success: true, db: "connected" }`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot-reload (tsx watch) |
| `npm run build` | `tsup` → `dist/` |
| `npm start` | Run compiled `dist/server.js` |
| `npx prisma generate` | Regenerate client from schema |
| `npx prisma migrate dev --name <name>` | Create/apply a migration |
| `npx prisma db seed` | Run `prisma/seed.ts` (exists in package config; script not built yet) |
| `npm run build:vercel` | Manually rebuild `api/index.js` bundle (auto via pre-commit hook) |

`prisma.config.ts` supplies the schema path, so **no `--schema=` flag is needed**. Use `npx tsc --noEmit` for a typecheck.

## Vercel deployment

- Deployed to `https://tripverse-server.vercel.app` from `main` (Git-based). Root is `api/index.js` — a **single esbuild bundle** of the app (`src/app.ts` re-export), built by `esbuild.vercel.mjs`. `vercel.json` routes `/(.*)` to it; `installCommand` runs `npx prisma generate` (since `generated/` is gitignored).
- **The bundle is committed to git.** `@vercel/node` does NOT bundle the `src/` tree itself (caused `ERR_MODULE_NOT_FOUND` before), so the committed `api/index.js` must always match `src/`.
- A **husky pre-commit hook** (`.husky/pre-commit`) auto-runs `node esbuild.vercel.mjs` and re-stages `api/index.js` whenever a `src/` file is committed — so bundle staleness is prevented automatically. You can also run `npm run build:vercel` manually.
- Env vars come from the **Vercel dashboard**, NOT `.env` (gitignored). Production needs `DATABASE_URL`, both JWT secrets, Cloudinary ×3, `BACKEND_PUBLIC_URL` (Vercel URL). `FRONTEND_URL_PROD` stays unset until the frontend is live.

## Architecture

- **Express v5** + **Prisma v7** (PostgreSQL via `@prisma/adapter-pg`)
- **ESM** (`"type": "module"`), target ES2023, `moduleResolution: bundler`, strict TS
- **Zod** for env validation (`src/config/index.ts`) and intended for request validation
- **Planned module layout** (GearUp conventions): `*.route.ts` → `*.controller.ts` → `*.service.ts` under `src/modules/<name>/`
- No DI container — singletons imported directly (prisma, config, jwt, cloudinary)

## Prisma specifics

- Schema is **multi-file** under `prisma/schema/` — one file per model (`user.prisma`, `category.prisma`, `tourPackage.prisma`, `booking.prisma`, `review.prisma`, `contactMessage.prisma`, `blogPost.prisma`) + `enums.prisma` + `schema.prisma` (generator + datasource). `prisma.config.ts` sets the schema path — do not pass `--schema=`
- Generated client output: `../../generated/prisma` (custom path, not `node_modules/.prisma`)
- Imports come from `../../generated/prisma/client`, `../../generated/prisma/enums`, and `../../generated/prisma/models` (WhereInput types)
- `generated/` and `dist/` are gitignored — run `npx prisma generate` after clone
- **Models are built** (Step 2): `User`, `Category`, `TourPackage`, `Booking`, `Review`, `ContactMessage`, `BlogPost` + enums `Role`, `UserStatus`, `AuthProvider`, `PackageStatus`, `BookingStatus`, `PostStatus` — all `@@map` to snake_case tables (`users`, `tour_packages`, ...)
- Money is `Decimal @db.Decimal(10, 2)` (`price`, `totalPrice`) — map to `Number()` before returning from services
- `tsconfig.json` has `rootDir` commented out (GearUp's fix) so the generated client outside `src/` doesn't break `tsc`

## Config & env

- All env vars are validated at boot via Zod in `src/config/index.ts`; a missing/malformed var exits the process — never read `process.env` directly
- Required: `FRONTEND_URL_DEV`, `FRONTEND_URL_PROD`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, Cloudinary creds
- Defaults: `PORT=4000`, `BCRYPT_SALT_ROUNDS=10`, `JWT_ACCESS_EXPIRES_IN=1d`, `JWT_REFRESH_EXPIRES_IN=30d`

## API conventions

- **Base paths planned**: `/api/auth`, `/api/users`, `/api/uploads`, `/api/contact`, `/api/categories`, `/api/packages`, `/api/bookings`, `/api/reviews`, `/api/blog`, `/api/dashboard` — routes are commented placeholders in `src/app.ts:94`
- **Response shape**: `sendResponse(res, { success, statusCode, message, data, meta })` (`src/utils/sendResponse.ts`)
- **Error handling**: `catchAsync` wrapper → `globalErrorHandler`. It maps ZodError→400, Prisma P2002→409, P2003→409, P2025→404, P1000→401, P1001→503, plus `AppError` (throws with a statusCode)
- **Auth middleware** (not built yet): will attach `req.user`; `src/middleware/index.d.ts` types it `{ id, name, email, role: Role }` using the generated `Role` enum
- **Pagination**: `meta` object `{ page, limit, total, totalPages }` returned with list endpoints
- **Security**: helmet, CORS allow-list (dev + prod), `trust proxy = 1` (must stay before rate limiters), 100kb body limit (covers long-form blog content; images are URLs), two-tier rate limiting (`authLimiter` 5/15min on `/api/auth/login|register|demo-login`, `apiLimiter` 100/15min on `/api`)
- **Refresh token rotation** (Step 22): every `POST /api/auth/refresh` mints a new refresh JWT and revokes the old one in a `$transaction`; the ledger (`refresh_tokens`) stores only the SHA-256 hash, never the JWT. Replaying an already-revoked token revokes the whole family (`tokenVersion` bump). **Frontend must single-flight refresh calls** (reuse the newest token / share the in-flight promise) or two-tab races trigger a false family-revoke.
- **Uploads**: Cloudinary via multer (deps installed, module not built)

## Notable absences

- No feature modules, no seed script yet (Steps 4+)
- No test framework, no CI/CD, no Docker, no lint, no formatter