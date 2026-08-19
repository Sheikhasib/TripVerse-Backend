# Step 21 — Email Verification & Password Reset (Redis + Nodemailer)

> **Spec upgraded** to follow the verified reference implementation in
> `PH-Healthcare-System/Project-PH-Healthcare-Backend` (Redis OTP + Nodemailer
> flow). Supersedes the earlier draft that proposed a DB-stored hashed-link
> token with Resend. The workflow, Redis key scheme, OTP lifecycle and
> register→verify→auto-login shape mirror the reference; integration points
> (config validation, AppError, rate limiting, response envelope) follow
> TripVerse's existing conventions.

## Overview

Adds email verification + password reset using **Redis** (OTP store, TTL'd) and
**Nodemailer** (Gmail app-password SMTP), exactly the way the reference backend
does it:

- **Registration is staged in Redis** — a credential signup does *not* create a
  DB row. It hashes the password, stages the payload in Redis, emails a 6-digit
  OTP, and only **creates the user on successful OTP verification** (with
  `emailVerified: true`). No unverified DB accounts can ever exist, which is how
  the reference "verifies registration and login".
- **Verify-email auto-logs-in** — verifying the OTP creates the user and issues
  access/refresh tokens (same shape as `googleLogin`).
- **Password reset** — `forgot-password` emails a 6-digit OTP stored in Redis
  (5-min TTL); `reset-password` validates it and replaces the hash.

Both flows use short-lived OTPs in Redis, not JWTs and not DB-stored tokens.

## Reference implementation being followed

`Project-PH-Healthcare-Backend/src/app/module/auth/auth.service.ts`
(register → verify → auto-login → forgot → reset), `src/app/lib/redis.ts`,
`src/app/lib/nodemailer.ts`. Key mechanics copied verbatim:

- 6-digit numeric OTP via `crypto.randomInt(100000, 1000000)`.
- Redis keys: `<prefix>-otp:<email>` and `<prefix>-data:<email>` (registration
  only), `SET ... { expiration: { type: "EX", value: 5 * 60 } }`, `GET`,
  `DEL` after successful use.
- Registration payload (incl. **already-hashed** password) staged in Redis; DB
  row created only after OTP verification.
- Nodemailer `createTransport({ service: "gmail", auth: { user, pass } })`;
  `from` = `smtp_user`.

## Depends on

- `src/modules/auth/auth.service.ts` — `registerUser` (rewrite to stage),
  `issueTokens`, `sanitizeUser`, `buildTokenPayload` (reuse for auto-login)
- `prisma/schema/user.prisma` — `emailVerified` already present
- `src/templates/` — EJS email templates (reference-style `*.ejs`), rendered
  via the new `src/templates/index.ts` `renderTemplate`
- `src/config/index.ts` — add Redis + SMTP env keys
- `src/app.ts` — extend `authLimiter` paths
- `src/server.ts` — guarded Redis connect at boot

## New dependencies & infra

- `redis` **^6.2.1** (same major as the reference → identical `SET/GET/DEL`
  options API: `{ expiration: { type: "EX", value } }`)
- `nodemailer` + `@types/nodemailer` (dev)
- No Prisma schema/migration changes — `emailVerified` already exists and is
  only ever written `true`; no token table needed.

**Vercel caveat (documented, not fixed here):** node-redis is TCP-based and is
not reliable in serverless cold starts. Dev + local grading is unaffected. On
Vercel production, leave the Redis env vars unset so the app boots and the auth
endpoints respond with a clean "not configured" error — identical in spirit to
how Resend/SSLCommerz/Google degrade when unconfigured.

## Config & env — `src/config/index.ts`

Add to the Zod schema (all **optional**, fail-soft like the other infra):

```
REDIS_USER / REDIS_PASSWORD / REDIS_HOST / REDIS_PORT   # Redis (node-redis)
SMTP_USER / SMTP_PASSWORD                                # Nodemailer (Gmail app password)
```

Config keys: `redis_user`, `redis_password`, `redis_host`, `redis_port`,
`smtp_user`, `smtp_password`. Update `.env.example` with the new block.

## Redis & Nodemailer libs

### `src/lib/redis.ts`
Mirror the reference, but nullable when unconfigured (TripVerse fail-soft):
```ts
export const redisClient = config.redis_host
  ? createClient({ username: config.redis_user, password: config.redis_password,
                   socket: { host: config.redis_host, port: parseInt(config.redis_port || "6379") } })
  : null;
```
Plus `getRedis(): Promise<RedisClientType | null>` that lazily connects once
and returns the client or `null`. Auth endpoints throw
`AppError(503, "Email verification is not configured.")` when `null`.

### `src/lib/nodemailer.ts`
```ts
export const transporter = config.smtp_user && config.smtp_password
  ? nodemailer.createTransport({ service: "gmail",
      auth: { user: config.smtp_user, pass: config.smtp_password } })
  : null;
```

### `src/server.ts`
After `prisma.$connect()`: if `config.redis_host` → `await redisClient!.connect()`
in try/catch, log success/warning (guarded, never crashes boot).

## Redis keys & OTP lifecycle

| Key | Purpose | TTL |
|---|---|---|
| `tripverse:register-otp:<email>` | registration OTP | 300s |
| `tripverse:register-data:<email>` | staged `{ name, email, password(hash), phone?, role }` | 300s |
| `tripverse:forgot-password-otp:<email>` | password-reset OTP | 300s |

- OTP: `crypto.randomInt(100000, 1000000).toString()` (6-digit).
- Constant `OTP_EXPIRATION_SECONDS = 5 * 60` in `auth.service.ts`.
- On success: `DEL` the key immediately (single-use; a replay finds nothing →
  "invalid or expired"). No OTP ever touches the DB or logs.
- Email addresses are normalized (`trim().toLowerCase()`) in the service before
  being used as keys / lookups.

## Nodemailer senders — `src/utils/authEmail.ts` (new)

Best-effort, no-op when `transporter` is null (log a warn line), same spirit as
`sendWithLog`. Each sender renders an EJS template from `src/templates/`
(via `renderTemplate` in `src/templates/index.ts` — mirrors the reference's
`ejs.renderFile(path.join(process.cwd(), "src/app/templates/..."))`, with path
fallbacks so it also works inside the Vercel bundle where the templates are
copied to `api/templates/`):

- `sendVerificationOtpEmail({ email, name, otp })` → `registration-user-otp.ejs`
- `sendForgotPasswordOtpEmail({ email, name, otp })` → `forgot-password.ejs`
- `sendWelcomeEmail({ email, name })` → `welcome-email.ejs`
- `sendPasswordResetSuccessEmail({ email, name })` → `reset-password-success.ejs`

(Template content matches the reference structure, rebranded PH → TripVerse;
`<%= %>` auto-escapes so no manual `escapeHtml` needed. `esbuild.vercel.mjs`
copies `src/templates` → `api/templates` after bundling so `ejs.renderFile`
can read them at runtime on Vercel.)

## Auth module changes — `src/modules/auth`

### register (rewritten → staged)
`registerUser` no longer creates a DB row. New behavior:
1. Normalize email; `findUnique` → exists → `AppError(409)` (unchanged).
2. Role guard USER/AGENT (unchanged).
3. `GET tripverse:register-data:<email>` → already staged → `AppError(409, "Registration is pending verification...")` — an attacker must not silently overwrite a victim's in-flight OTP (last-write-wins would kill it). Recovery goes through `resend-verification`.
4. Hash password.
5. `SET tripverse:register-otp:<email>` = OTP (EX 300s) and
   `SET tripverse:register-data:<email>` = JSON `{ name, email, password: hash, phone, role }` (EX 300s).
6. Best-effort `sendVerificationOtpEmail` (fire-and-forget; never fails register).
7. Respond `data: null` (no user, no tokens).

**Breaking API contract change:** register response `data` is now `null`, not the
created user. Frontend must switch to the register → verify-email → (auto-login)
flow.

### verify-email (new — creates user + auto-login)
`POST /api/auth/verify-email` `{ email, otp }` → 200:
1. Normalize email. Defensive: if a user already exists with that email → `AppError(409)`.
2. `GET tripverse:register-otp:<email>`; missing → `AppError(400, "Invalid or expired OTP.")`; mismatch → same 400.
3. `DEL` OTP key. `GET tripverse:register-data:<email>` → `JSON.parse`; missing → 400 (and DEL OTP if present).
4. `DEL` data key.
5. `prisma.user.create({ name, email, password, phone, role, authProvider: "CREDENTIAL", status: "ACTIVE", emailVerified: true })` (omit password).
6. Best-effort `sendWelcomeEmail`.
7. `issueTokens(user)` → return `{ accessToken, refreshToken, user: sanitized }`; controller sets cookies (`setAuthCookies`) — auto-login, mirroring `googleLogin`.

### resend-verification (new)
`POST /api/auth/resend-verification` `{ email }` → 200 (public — a user cannot be authenticated before verification exists):
1. If `tripverse:register-data:<email>` exists → regenerate OTP, overwrite `tripverse:register-otp:<email>` (new TTL), best-effort resend.
2. Otherwise → no-op.
3. Always 200 with the same message (no enumeration).

### forgot-password (new)
`POST /api/auth/forgot-password` `{ email }` → **always 200** (uniform — never reveals whether the email exists):
1. Normalize email; lookup user.
2. If not found / deleted / suspended / unverified (`emailVerified === false` — impossible by construction, kept as defense) / `authProvider === "GOOGLE"` → return 200 without sending (Google users reset via Google).
3. `SET tripverse:forgot-password-otp:<email>` = OTP (EX 300s); best-effort `sendForgotPasswordOtpEmail`.
4. 200.

### reset-password (new)
`POST /api/auth/reset-password` `{ email, otp, newPassword }` → 200:
1. Normalize email; lookup user. Not found / deleted / suspended / GOOGLE → `AppError(400, "Invalid or expired OTP.")` (uniform).
2. `GET tripverse:forgot-password-otp:<email>`; missing → 400; mismatch → 400.
3. `prisma.user.update({ data: { password: bcrypt.hash(newPassword), tokenVersion: { increment: 1 } } })` — tokenVersion bump kills all existing sessions (TripVerse logout/password-change semantics; the reference didn't bump, we keep TripVerse's stronger behavior).
4. `DEL` OTP key — **after** the update succeeds (the reference DELs first; update-first means a transient DB error keeps the OTP valid for retry — single-use still holds).
5. Best-effort `sendPasswordResetSuccessEmail`. Return 200 (client logs in fresh).

### login
Unchanged — no `emailVerified` gate, and none is needed: with staged
registration every DB user is already verified (`emailVerified: true`), exactly
like the reference. Google/demo/seed users are already `true`.

## Validation & interface

- `verifyEmailSchema`: `email` (trim + email), `otp` (shared `otpSchema`: length 6 **and** `/^\d{6}$/` — rejects `"abcdef"`).
- `resendVerificationSchema`: `email`.
- `forgotPasswordSchema`: `email`.
- `resetPasswordSchema`: `email`, `otp` (same `otpSchema`), `newPassword` (min 6, max 72, same rules as register).
- Interface: `IVerifyEmailPayload`, `IResendVerificationPayload`,
  `IForgotPasswordPayload`, `IResetPasswordPayload`.

## Rate limiting — `src/app.ts`

Add these paths to `authLimiter` (5/15min) to bound OTP brute force and email
bombing (upgrade over the reference, which has none):

```
app.use("/api/auth/verify-email", authLimiter);
app.use("/api/auth/resend-verification", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
```

> **Shared budget (important for grading):** `authLimiter` is a **single** instance
> already mounted on `/login`, `/register`, `/demo-login`, `/google`. Express
> reuses one in-memory counter per IP, so the effective limit is **5 auth
> requests total per 15 min across all 8 auth paths** — not 5 per endpoint. The
> 6th auth request in a window returns 429 (this is also the DoD's "429 after 5
> attempts" proof). A full grading pass
> (register→verify→resend→forgot→reset→login = 6 calls) trips 429 on call 6 —
> plan accordingly (split across windows, or restart the dev server to reset the
> in-memory limiter).

## Files

**Create:**
- `src/lib/redis.ts`
- `src/lib/nodemailer.ts`
- `src/utils/authEmail.ts`
- `src/templates/` — `registration-user-otp.ejs`, `forgot-password.ejs`,
  `welcome-email.ejs`, `reset-password-success.ejs` + `index.ts` (`renderTemplate`)

**Change:**
- `package.json` (deps: `redis@^6.2.1`, `nodemailer`, `ejs`, `@types/ejs`)
- `esbuild.vercel.mjs` (copy `src/templates` → `api/templates` after bundling)
- `.env.example` (Redis + SMTP block)
- `src/config/index.ts` (6 new optional env keys)
- `src/server.ts` (guarded Redis connect)
- `src/utils/email.ts` (export `emailLayout`, `escapeHtml`)
- `src/modules/auth/auth.service.ts` (rewrite `registerUser`; add `verifyEmail`, `resendVerification`, `forgotPassword`, `resetPassword`; export all)
- `src/modules/auth/auth.controller.ts` (4 new controllers; `verifyEmail` sets cookies)
- `src/modules/auth/auth.route.ts` (4 new public routes)
- `src/modules/auth/auth.validation.ts`
- `src/modules/auth/auth.interface.ts`
- `src/app.ts` (authLimiter paths)

**No Prisma changes, no migration.**

## Rules for implementation

- OTPs live only in Redis; never logged, never persisted. `DEL` on success.
- Emails are best-effort (fire-and-forget via a warn-and-return helper) — a send
  failure must never fail register/verify/forgot/reset.
- `forgot-password` / `resend-verification` never leak whether an email exists
  (uniform 200).
- Password reset bumps `tokenVersion` (kills sessions) — reuse existing semantics.
- Every auth endpoint that mints/consumes an OTP is behind `authLimiter`.
- Redis/SMTP unconfigured → clean `AppError(503)` (or no-op email), never a boot
  failure.

## Definition of done

- `npm install` pulls `redis`, `nodemailer`; `npx tsc --noEmit` clean.
- With Redis running + SMTP configured:
  - `POST /api/auth/register` (credential) → 201, **no user row created**, OTP
    present in Redis, verification email attempted.
  - `POST /api/auth/verify-email` with the correct OTP → 200, user created with
    `emailVerified: true`, access/refresh cookies set (auto-login). Wrong OTP →
    400; replay of the same OTP → 409 (the user row now exists, so the defensive
    exists-check fires before the OTP check); expired → 400.
  - `POST /api/auth/resend-verification` → new OTP in Redis, old one invalid.
  - `POST /api/auth/forgot-password` → 200 for both existing and non-existing
    emails; OTP only created for existing CREDENTIAL accounts; Google-only
    account → 200 with no OTP/email.
  - `POST /api/auth/reset-password` with correct OTP → password changes,
    `tokenVersion` bumped (old sessions rejected), success email attempted;
    wrong/expired/replayed OTP → 400.
  - Existing-email register → 409. Re-register while a registration is already
    staged (pending OTP) → 409 (use `resend-verification` instead). Rate limiter
    returns 429 after 5 attempts (shared across all auth paths — see note above).
  - Demo/Google login still works; seed users still `emailVerified: true`.
- `npm run build:vercel` regenerates `api/index.js`; commit + push (AGENTS.md workflow).
