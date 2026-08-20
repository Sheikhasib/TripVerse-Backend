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
- **Test DB strategy (implemented, user-approved deviation from this spec):** there is no separate
  Postgres database available (no local password; Prisma Postgres is a pooled proxy where
  `CREATE DATABASE` is not allowed; `tripverse_test`/`tripverse` DBs don't exist). `DATABASE_URL_TEST`
  points at the **same live Prisma Postgres DB** and the suite runs **without truncation**. Safety
  comes from (a) every test uses unique UUID keys/emails, and (b) `tests/setup.ts` cleanup deletes
  ONLY the rows each file created — children before parents (schema uses Prisma's default RESTRICT).
  Do **not** run truncating tests against this DB. If a real disposable DB becomes available, flip
  `DATABASE_URL_TEST` and re-enable truncation — the tests are keyed, so they stay safe either way.
- Scripts (package.json):
  ```
  "test": "vitest run",
  "test:watch": "vitest"
  ```
- `vitest.config.ts` — `environment = "node"`, `globals = true`, `setupFiles = ["tests/setup.ts"]`,
  `fileParallelism = false` (sequential — the shared DB), `pool = "forks"`, `isolate = true`,
  `testTimeout/hookTimeout = 30_000`. **Do not override `test.exclude`** — vitest's default excludes
  keep `node_modules`/`dist` out; a custom `exclude` list dropped that default and vitest scanned
  node_modules for test files.
- **vi.mock path gotcha (bit us):** mock specifiers must be written exactly as vitest can reconcile
  against the app's own imports. From `tests/`, source modules are reached via `../src/...` (one level
  up) — `vi.mock("../src/lib/sslcommerz")`. Using `vi.mock("../../src/lib/sslcommerz")` silently did
  NOT mock the copy the app graph imports (real gateway/email/Redis calls ran and the tests failed);
  `import` statements in the test files were already `../src/...`. Keep import and mock paths in the
  same form.
- Rate limiters are skipped when `NODE_ENV === "test"` (`src/app.ts`) so `authLimiter`
  (5/15 min per IP) can't throttle the suites; morgan only logs in development. `NODE_ENV="test"`
  was added to the config Zod enum.

## Test layout

```
tests/
  setup.ts            // boots env (DATABASE_URL_TEST → DATABASE_URL, NODE_ENV=test),
                      // no-truncation cleanup registry + global afterAll cleanup
  factories.ts        // create user/package/booking/etc. helpers against the shared DB
                      // + loginAs (real login endpoint) + bearer + futureIso
  auth.test.ts        // register/login/demo-login/refresh/logout/me + RBAC + email OTP (stub redis)
  booking.test.ts     // create, ownership 403s, full state machine incl. PAID/CANCELLED + refund
  payment.test.ts     // create session, verify-before-PAID, IPN idempotency (mock sslcommerz)
  review.test.ts      // create gate, duplicate 409, edit/delete recompute (Step 20)
  wishlist.test.ts    // add/list/delete + idempotency
  notification.test.ts// raise + read + unread-count + read-all
  blog.test.ts        // publish gating, own-only edits, comments (Step 19)
  contact.test.ts     // public submit + admin manage (mock email senders)
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

- **SSLCommerz**: mock at the `sslcommerz` lib boundary (`vi.mock("../src/lib/sslcommerz")` — see the path gotcha above).
- **Resend emails**: mock `src/utils/email.ts` senders to resolve; assert they're *called*, never
  that mail was delivered. Keep best-effort semantics: a rejected sender must not fail the request.
- **Cloudinary** (uploads): only smoke-test the 401/403/auth paths; do not upload real images.

## Env & CI

- `.env.example` and local `.env` add `DATABASE_URL_TEST` (points at the shared live DB today —
  see the strategy note above). `tests/setup.ts` boots env **before** the test file imports run:
  `NODE_ENV=test`, explicit `dotenv.config({ quiet: true })`, then
  `process.env.DATABASE_URL = process.env.DATABASE_URL_TEST` so config/prisma connect to the test
  URL. `NODE_ENV="test"` is a valid value in the config Zod enum.
- **Mocks per test file** (isolated vitest module graphs): `src/lib/sslcommerz` (booking/payment),
  `src/utils/email` (booking/payment/contact), `src/lib/redis` + `src/utils/authEmail` +
  `src/lib/googleAuth` (auth), the `resend` package (email.test). The in-app `notify` helper stays
  real (rows are cleaned up with their users).
- CI (Step 25) provisions a disposable Postgres (or keeps `DATABASE_URL_TEST` on the shared DB,
  non-truncating) and runs `npm test`.

## Files to change

- `package.json` — `test`/`test:watch` scripts + dev deps
- `.env.example` — `DATABASE_URL_TEST`
- `src/config/index.ts` — add `"test"` to the `NODE_ENV` enum
- `src/app.ts` — rate limiters `skip` when `NODE_ENV === "test"`; morgan only in development
- `tsconfig.json` — `types` include `vitest/globals`; include `tests/**/*` + `vitest.config.ts`
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
- No real money/email/cloud in tests — every external provider is mocked; the DB is the real Postgres
  (schema fidelity matters for the Prisma queries under test).
- **Parallel-safety (hard requirement):** a shared DB means test **files cannot run in parallel** —
  `fileParallelism: false` runs one file at a time. Within a file, tests share state deliberately
  (sequential flow tests like "register → book → pay → confirm") or use unique emails/keys per test.
- **Live-DB discipline:** never assert absolute list counts (the DB has real data — e.g. published
  blog posts); assert by unique slug/key or by deltas. Never truncate; cleanup only what a file
  created, children before parents.
- Don't over-mock: `prisma` itself is real. Only the *external* services (SSLCommerz, Resend,
  Redis in auth, Cloudinary) are stubbed.
- Section-header comments only where existing modules use them.

## Definition of done

- `npm test` runs green (`npx vitest run`): **67 tests across 10 suites** against `DATABASE_URL_TEST`
  (shared live DB, non-truncating, unique keys + scoped cleanup).
- Coverage of the must-have assertions above, including the payment verify-before-PAID and
  review-recompute invariants.
- `npx tsc --noEmit` passes (test files typecheck clean).
- Commit + push (AGENTS.md workflow).