# Step 3 — Core Backbone

Shared plumbing every module (Steps 4–11) plugs into. Build and test this in isolation — a `/health` route is enough to confirm it's wired correctly — before starting Auth.

## Error handling & response shape
- Centralized `AppError` + `globalErrorHandler`: handles Zod errors, Prisma known-request errors (P2002 unique, P2025 not found), `AppError`, and generic fallback.
- `sendResponse` standardized envelope: `{ success, message, meta?, data }`.
- `catchAsync` wrapper on every controller so thrown errors reach `globalErrorHandler` instead of crashing the process.

## Security
- `helmet` for security headers.
- CORS — origin is an allow-list, not a single string: `[FRONTEND_URL_DEV, FRONTEND_URL_PROD]` (both env-driven), credentials enabled.
- Request body size limit — `express.json({ limit: '10kb' })`. Package/booking payloads are small text fields (images go through the upload endpoint as URLs, not embedded bytes), so 10kb is generous; blocks trivial payload-flooding abuse.
- Rate limiting — two-tier, not one blanket limiter:
  - **Strict**: `/api/auth/login`, `/api/auth/register`, `/api/auth/demo-login` — 5 requests / 15 min per IP
  - **Standard**: everything else under `/api` — 100 requests / 15 min per IP
  - `app.set('trust proxy', 1)` must be set **before** the limiter is applied — Render/Railway sit behind a reverse proxy, and without this the limiter sees the proxy's IP for every request instead of the real client IP, effectively rate-limiting all users together.
- `morgan('dev')` in non-production for request logging — one line, pays for itself during same-day debugging.
- **Demo note:** the 5/15 min strict limiter on auth endpoints is correct for production, but a live grading demo clicking demo-login repeatedly can trip it. Before a live demo, raise `limit` to 10–20 or whitelist the demo/grading origin. Revert after.

## Pagination
All list endpoints accept `page` and `limit`, return `meta` in the response envelope. `limit` capped at 50 server-side regardless of what the client requests.

## Soft-delete consistency
Every Prisma query against `User` and `TourPackage` — list, detail, dashboard aggregation, everywhere — filters `isDeleted: false` explicitly. This applies across every module below; treat it as a review checklist item each time you write a new query, since forgetting it in one place silently resurfaces deleted records.

## Health check
`/health` returns `200` with a real DB connectivity check (a cheap `SELECT 1` / `$queryRaw`), not just a static `200 OK`. A host that DB-connects-but-app-is-down (or vice versa) is a real failure mode a static check would miss.
