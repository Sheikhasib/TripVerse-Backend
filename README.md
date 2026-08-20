# TripVerse Server

[![CI](https://github.com/Sheikhasib/TripVerse-Backend/actions/workflows/ci.yml/badge.svg)](https://github.com/Sheikhasib/TripVerse-Backend/actions/workflows/ci.yml)

This is the **Step 2 — Data Models** build from the backend spec, working and verified.
Read the spec files alongside this repo (`01-project-setup.md` through `15-backlog-summary.md`) and implement each step in order, in this same repo.

## What's already built (Steps 1–3 core backbone + Step 2 data models)

- Folder structure matching GearUp's conventions
- `config/index.ts` — Zod env validation, fails fast on boot if a var is missing/malformed
- `lib/prisma.ts` — Prisma 7 + `@prisma/adapter-pg` driver adapter (same as GearUp)
- `utils/` — `AppError`, `catchAsync`, `sendResponse`, `jwt` (exact GearUp pattern)
- `middleware/` — `globalErrorHandler` (Zod + Prisma + AppError branches), `notFound`, `req.user` typed with the generated `Role` enum
- `app.ts` — helmet, CORS allow-list (dev + prod), two-tier rate limiting, `trust proxy`, body size limit, morgan, `/health` with a real DB ping
- `server.ts` — connects Prisma, starts the server
- `prisma.config.ts` — schema path, migrations, seed command, datasource URL (so no `--schema=` flag is needed)
- `prisma/schema/` — full schema: 7 models (`User`, `Category`, `TourPackage`, `Booking`, `Review`, `ContactMessage`, `BlogPost`) + 6 enums, one file per model
- Migration `20260811144926_init` applied to Postgres

## What's NOT built yet

The feature modules: auth (incl. Google OAuth), uploads, contact, category, packages, bookings, reviews, blog, dashboard, and the seed script. `app.ts` has commented-out lines showing exactly where each module's routes get registered as you build them.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL (Neon), 2 random JWT secrets, Cloudinary creds
npx prisma generate    # required — generated/ is gitignored
npx prisma migrate dev --name init
npm run dev
```

`npm run dev` boots the server and `GET /health` returns `{ success: true, db: "connected" }`.

## Next step

Open `04-auth-module.md` and build the auth module (register, login, demo-login, logout, /me, Google OAuth, plus the `/api/users` endpoints). `03-core-backbone.md` (error handling, response envelope, CORS, rate limiting, health check) is already in place.
