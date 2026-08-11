# Step 1 — Project Setup

## Tech Stack
- Express 5 + TypeScript, `tsx` for dev, `tsup` for build (matches GearUp exactly)
- PostgreSQL + Prisma 7 with `@prisma/adapter-pg` driver adapter, custom generated client output
- Split schema files under `prisma/schema/*.prisma`
- Auth: JWT (access + refresh), `bcryptjs`, cookie-based refresh token, `tokenVersion`-based invalidation, Google OAuth (`google-auth-library`)
- Validation: Zod (also used for env validation)
- Image storage: Cloudinary (`cloudinary` SDK) + `multer` (memory storage) for the upload endpoint
- Email: `resend` for best-effort contact notifications (lazy client, never fails a request)
- Security: `helmet`, `express-rate-limit` (two-tier), `morgan` (dev logging), CORS with credentials
- Error handling: centralized `AppError` + `globalErrorHandler`

## Folder Structure
```
server/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   └── index.ts        # env validation lives here
│   ├── lib/
│   │   ├── prisma.ts
│   │   └── googleAuth.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── globalErrorHandler.ts
│   │   ├── notFound.ts
│   │   └── validateRequest.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── user/
│   │   ├── upload/
│   │   ├── contact/
│   │   ├── category/
│   │   ├── package/
│   │   ├── booking/
│   │   ├── review/
│   │   ├── blog/
│   │   └── dashboard/
│   └── utils/
│       ├── AppError.ts
│       ├── catchAsync.ts
│       ├── sendResponse.ts
│       └── email.ts
├── prisma/
│   ├── schema/
│   └── seed.ts
├── .env.example
└── package.json
```

## Env Validation
`config/index.ts` parses `process.env` through a Zod schema at boot: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL_DEV`, `FRONTEND_URL_PROD`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Process exits with a clear message on a missing/malformed var instead of failing later with a confusing runtime error mid-request. Every module below reads config only through this validated object, never `process.env` directly.

Optional — `.optional()` in the Zod schema so the app still boots without them, validated at runtime where they're used: `GOOGLE_CLIENT_ID` (checked when `/auth/google` is hit), `RESEND_API_KEY` + `CONTACT_RECEIVER_EMAIL` + `EMAIL_FROM` (best-effort contact emails), and `ADMIN_EMAIL`/`ADMIN_PASSWORD` (admin seed).
