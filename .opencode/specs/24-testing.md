# Step 24 — Automated Tests

## Overview

Promotes tests out of the backlog (Step 15). The repo has **no test framework** (`package.json` test
script is a stub: `echo "Error: no test specified"`). This step adds a pragmatic test setup that
protects the money/state logic — the highest-risk code — without pretending to be an exhaustive
integration suite. Target: **unit + integration tests for the modules that carry invariants**
(auth, booking state machine, payment settlement, review rating recompute, wishlist, notifications,
blog comments, contact, dashboard). Public read endpoints get smoke coverage via supertest against
the real app, with a dedicated test database.

## Depends on

- `src/app.ts` — the exported Express app is supertest-friendly (already `export default app`)
- `src/lib/prisma.ts` — the Prisma singleton; tests need a separate `DATABASE_URL`
- `src/config/index.ts` — env is validated at boot; tests set `NODE_ENV=test` and a test DB URL
- `.env.example` — add `DATABASE_URL_TEST`
- Existing module services — the units under test

## Framework & tooling

- **Vitest** (native ESM + TS, zero config friction with this ESM/ES2023 setup) + **supertest** for
  HTTP-level integration. Dev dependencies: `vitest`, `supertest`, `@types/supertest`.
- Test DB: a separate Postgres database (`DATABASE_URL_TEST`), migrated with
  `npx prisma migrate deploy` (or `db push`) in the test setup, and truncated between suites.
- Scripts (package.json):
  ```
  "test": "vitest run",
  "test:watch": "vitest"
  ```
- `vitest.config.ts` — `test.environment = "node"`, `test.globals = true`, `test.setupFiles =
  ["tests/setup.ts"]`, `test.fileParallelism = false` (see parallel-safety), `test.exclude` keeps
  `node_modules`/`dist` out.

## Test layout

```
tests/
  setup.ts            // boots env (DATABASE_URL_TEST, NODE_ENV=test), prisma truncation helper
  factories.ts        // create user/package/booking/etc. helpers against the test DB
  auth.test.ts        // register/login/demo-login/refresh/logout/me + RBAC
  booking.test.ts     // create, ownership 403s, full state machine incl. PAID/CANCELLED
  payment.test.ts     // create session, processGatewayResult (mock sslcommerz), refund
  review.test.ts      // create gate, duplicate 409, edit/delete recompute (Step 20)
  wishlist.test.ts    // add/list/delete + idempotency
  notification.test.ts// raise + read + unread-count + read-all
  blog.test.ts        // publish gating, own-only edits, comments (Step 19)
  contact.test.ts     // public submit + admin manage
  dashboard.test.ts   // stats aggregates
  email.test.ts       // best-effort emails never throw (mock Resend)
```

### What each suite covers (must-have assertions)

- **auth** — register duplicate → 409; login wrong password → 401; suspended user → 403; refresh
  token version mismatch → 401; logout kills refresh (Step 22 rotation if built); `auth(Role.ADMIN)`
  rejects a USER token → 403.
- **booking** — `POST /api/bookings` computes `totalPrice = price × travelers` server-side (client
  totalPrice ignored); duplicate pending → 409; stale pending auto-cancels; ownership 403s;
  `CONFIRMED → COMPLETED` blocked before travel date; `PAID → CANCELLED` marks payment `REFUNDED`
  (Step 16) / calls refund (Step 23).
- **payment** — `POST /api/payments/create` on a non-owned/non-PENDING booking → 403/409; success
  path verifies validator amount match before `PENDING → PAID`; IPN double-fire is idempotent
  (compare-and-set). Mock `sslcommerzInit`/`sslcommerzValidate` via `vi.mock` or a fetch stub.
- **review** — no completed booking → 403; self-review → 403; duplicate → 409; rating recompute
  math (avg rounded to 1 dp); edit/delete recompute (Step 20) with `isDeleted` excluded.
- **wishlist / notification / blog-comments** — the idempotency and ownership rules from their specs.

### External calls in tests

- **SSLCommerz**: mock at the `sslcommerz` lib boundary (`vi.mock("../../src/lib/sslcommerz")`).
- **Resend emails**: mock `src/utils/email.ts` senders to resolve; assert they're *called*, never
  that mail was delivered. Keep best-effort semantics: a rejected sender must not fail the request.
- **Cloudinary** (uploads): only smoke-test the 401/403/auth paths; do not upload real images.

## Env & CI

- `.env.example`: add `DATABASE_URL_TEST=postgres://.../tripverse_test`.
- `tests/setup.ts` reads `DATABASE_URL_TEST` (Zod-validated in a test-only config override) and runs
  `prisma migrate deploy` on it; each suite truncates `users, tour_packages, bookings, payments,
  reviews, wishlist_items, notifications, blog_posts, blog_comments, contact_messages` before run.
- CI (Step 25) provisions the test DB via a Postgres service container and runs `npm test`.

## Files to change

- `package.json` — `test`/`test:watch` scripts + dev deps
- `.env.example` — `DATABASE_URL_TEST`
- `.gitignore` — nothing (tests are committed; test artifacts aren't produced)

## Files to create

- `vitest.config.ts`
- `tests/setup.ts`
- `tests/factories.ts`
- `tests/*.test.ts` (one per suite above)

## New dependencies

- dev: `vitest`, `supertest`, `@types/supertest`

## Rules for implementation

- Tests assert **behaviour**, not implementation — freeze the response envelope, status codes, and
  state-machine transitions, not internal function calls (except where mocking boundaries demand it).
- No real money/email/cloud in tests — every external provider is mocked; the DB is a real Postgres
  (schema fidelity matters for the Prisma queries under test).
- **Parallel-safety (hard requirement):** a single shared test DB means test **files cannot run in
  parallel** — two suites truncating the same tables will stomp each other. `fileParallelism:
  false` in `vitest.config.ts` runs one file at a time (cheap here: ~10 small suites). Within a
  file, tests share state deliberately (sequential flow tests like "register → book → pay →
  confirm") or use unique emails per test.
- Don't over-mock: `prisma` itself is real. Only the *external* services (SSLCommerz, Resend,
  Cloudinary) are stubbed.
- Section-header comments only where existing modules use them.

## Definition of done

- `npm test` runs green on a clean `DATABASE_URL_TEST` (migrate deploy → truncate → run).
- Coverage of the must-have assertions above, including the payment verify-before-PAID and
  review-recompute invariants.
- Tests run in CI (Step 25) on every push/PR and block merge on failure.
- `npx tsc --noEmit` passes (test files typecheck clean).
- Commit + push (AGENTS.md workflow).