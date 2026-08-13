# Step 14 — Deployment (for the live link)

- DB: Prisma Studio (already your standard).
- Backend host: Render or Railway (free tier, simplest for a same-day deploy — Vercel is not ideal for a long-running Express server).
- `trust proxy` — must be enabled (see Step 3) since both Render and Railway sit behind a reverse proxy; without it, rate limiting and any IP-based logic misbehave.
- Env vars set on host dashboard, not committed: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL_DEV`, `FRONTEND_URL_PROD`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — all covered by the boot-time Zod env validation from Step 1, so a missing one fails the deploy loudly instead of failing silently on first upload attempt.
- Optional-but-useful on the host: `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `CONTACT_RECEIVER_EMAIL`, `EMAIL_FROM`, plus `ADMIN_EMAIL`/`ADMIN_PASSWORD` if you seed the admin from env.
- `npm run build && npm start` as the production command.
- **[LATER]** CI (GitHub Actions) — lint/typecheck on push.
