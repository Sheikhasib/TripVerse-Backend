# TripVerse Server

Backend API for TripVerse (travel packages, bookings, reviews). Scaffolded from a multi-step spec
(`01-project-setup.md` → `12-backlog-summary.md`). **Currently: Step 1 done — skeleton only, no Prisma models or feature modules yet.**

## Quick start

```bash
npm install
cp .env.example .env        # real values: DATABASE_URL (Postgres), JWT secrets, Cloudinary creds
npx prisma generate --schema=prisma/schema   # required — generated/ is gitignored
npx prisma migrate dev --schema=prisma/schema --name init
npm run dev                 # tsx watch src/server.ts
```

Verify with `GET /health` → `{ success: true, db: "connected" }`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot-reload (tsx watch) |
| `npm run build` | `tsup` → `dist/` |
| `npm start` | Run compiled `dist/server.js` |
| `npx prisma generate --schema=prisma/schema` | Regenerate client from schema |
| `npx prisma migrate dev --schema=prisma/schema --name <name>` | Create/apply a migration |
| `npx prisma db seed` | Run `prisma/seed.ts` (exists in package config; script not built yet) |

No lint, format, type-check, or test commands exist.

## Architecture

- **Express v5** + **Prisma v7** (PostgreSQL via `@prisma/adapter-pg`)
- **ESM** (`"type": "module"`), target ES2023, `moduleResolution: bundler`, strict TS
- **Zod** for env validation (`src/config/index.ts`) and intended for request validation
- **Planned module layout** (GearUp conventions): `*.route.ts` → `*.controller.ts` → `*.service.ts` under `src/modules/<name>/`
- No DI container — singletons imported directly (prisma, config, jwt, cloudinary)

## Prisma specifics

- Schema is **multi-file** under `prisma/schema/` (`schema.prisma` + `enums.prisma`); `prisma.config.ts` not created yet — pass `--schema=prisma/schema` explicitly
- Generated client output: `../../generated/prisma` (custom path, not `node_modules/.prisma`)
- Imports come from `../../generated/prisma/client` and `../../generated/prisma/enums`
- `generated/` and `dist/` are gitignored — run `npx prisma generate` after clone
- **No models yet** — `schema.prisma` is generator + datasource only; `enums.prisma` is intentionally empty. Add `User`, `TourPackage`, `Booking`, `Review` + enums (`Role`, `PackageStatus`, `BookingStatus`) here as Step 2.

## Config & env

- All env vars are validated at boot via Zod in `src/config/index.ts`; a missing/malformed var exits the process — never read `process.env` directly
- Required: `FRONTEND_URL_DEV`, `FRONTEND_URL_PROD`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, Cloudinary creds
- Defaults: `PORT=4000`, `BCRYPT_SALT_ROUNDS=10`, `JWT_ACCESS_EXPIRES_IN=1d`, `JWT_REFRESH_EXPIRES_IN=30d`

## API conventions

- **Base paths planned**: `/api/auth`, `/api/users`, `/api/uploads`, `/api/packages`, `/api/bookings`, `/api/reviews`, `/api/dashboard` — routes are commented placeholders in `src/app.ts:94`
- **Response shape**: `sendResponse(res, { success, statusCode, message, data, meta })` (`src/utils/sendResponse.ts`)
- **Error handling**: `catchAsync` wrapper → `globalErrorHandler`. It maps ZodError→400, Prisma P2002→409, P2003→409, P2025→404, P1000→401, P1001→503, plus `AppError` (throws with a statusCode)
- **Auth middleware** (not built yet): will attach `req.user`; stub type in `src/middleware/index.d.ts` (`{ id, name, email, role }`) — swap role `string` for generated `Role` enum once Step 2 lands
- **Pagination**: `meta` object `{ page, limit, total, totalPages }` returned with list endpoints
- **Security**: helmet, CORS allow-list (dev + prod), `trust proxy = 1` (must stay before rate limiters), 10kb body limit, two-tier rate limiting (`authLimiter` 5/15min on `/api/auth/login|register|demo-login`, `apiLimiter` 100/15min on `/api`)
- **Uploads**: Cloudinary via multer (deps installed, module not built)

## Notable absences

- No Prisma models, migrations, or seed script yet (Step 2+)
- No test framework, no CI/CD, no Docker, no lint, no formatter
- No `prisma.config.ts` — always pass `--schema=prisma/schema`