# Step 14 — Deployment (for the live link)

- DB: Neon (already your standard).
- Backend host: **Vercel** (student's standard). The app is exposed through `api/index.ts`, which re-exports the same Express app from `src/app.ts`; `vercel.json` routes every path to it. `server.ts` (the listener) is Vercel-agnostic and only used for local `npm run dev` / `npm start`.
- Prisma pool is capped (`max: 1` in `src/lib/prisma.ts`) so warm serverless instances don't exhaust the DB's connection limit.
- `trust proxy` — enabled in `src/app.ts`; both Vercel and Render sit behind a reverse proxy, so kept regardless of host.
- Env vars set on the Vercel dashboard, not committed: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL_DEV`, `FRONTEND_URL_PROD`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — all covered by the boot-time Zod env validation from Step 1, so a missing one fails the deploy loudly instead of failing silently on first upload attempt.
- Step 16 payment also needs on the host: `SSL_COMMERZ_STORE_ID`, `SSL_COMMERZ_STORE_PASSWORD`, and `BACKEND_PUBLIC_URL` (the live Vercel URL — SSLCommerz POSTs to it server-to-server, so it must not be localhost).
- Optional-but-useful on the host: `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `CONTACT_RECEIVER_EMAIL`, `EMAIL_FROM`, plus `ADMIN_EMAIL`/`ADMIN_PASSWORD` if you seed the admin from env.
- After the first deploy: `npx prisma migrate deploy` against production (never `migrate dev`), then optionally `npx prisma db seed`.
- **[LATER]** CI (GitHub Actions) — lint/typecheck on push.
