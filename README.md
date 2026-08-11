# TripVerse Server

This is the **Step 1 — Project Setup** scaffold from the backend spec, built and working.
Read the spec files alongside this repo (`01-project-setup.md` through `14-backlog-summary.md`) and implement each step in order, in this same repo.

## What's already built (Step 1 + Step 3 core backbone)

- Folder structure matching GearUp's conventions
- `config/index.ts` — Zod env validation, fails fast on boot if a var is missing/malformed
- `lib/prisma.ts` — Prisma 7 + `@prisma/adapter-pg` driver adapter (same as GearUp)
- `utils/` — `AppError`, `catchAsync`, `sendResponse`, `jwt` (exact GearUp pattern)
- `middleware/` — `globalErrorHandler` (Zod + Prisma + AppError branches), `notFound`, `req.user` type stub
- `app.ts` — helmet, CORS allow-list (dev + prod), two-tier rate limiting, `trust proxy`, body size limit, morgan, `/health` with a real DB ping
- `server.ts` — connects Prisma, starts the server
- `prisma/schema/schema.prisma` — generator + datasource only; models come in Step 2

## What's NOT built yet

Everything in `02-data-models.md` onward: the actual Prisma models, auth module (incl. Google OAuth), contact module, category module, uploads, packages, bookings, reviews, dashboard, seed script. `app.ts` has commented-out lines showing exactly where each module's routes get registered as you build them.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL (Neon), 2 random JWT secrets, Cloudinary creds
npm run dev
```

Right now `npm run dev` will fail at the Prisma import step until Step 2 adds real models and you run:
```bash
npx prisma generate --schema=prisma/schema
npx prisma migrate dev --schema=prisma/schema --name init
```

Once that's done, `npm run dev` boots the server and `GET /health` should return `{ success: true, db: "connected" }`.

## Next step

Open `02-data-models.md` and add the `User`, `TourPackage`, `Booking`, `Review` models (plus enums) to `prisma/schema/`. That unblocks everything else.
