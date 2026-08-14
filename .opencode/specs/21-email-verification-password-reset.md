# Step 21 — Email Verification & Password Reset

## Overview

Promotes email verification + password reset out of the backlog (Step 15). `User.emailVerified`
already exists (`user.prisma:12`) and is set `true` by Google/demo logins — but credential
registration never verifies it, and there is no way to reset a forgotten password. This step adds:

- **Email verification** — on credential register, email a one-time link; clicking it flips
  `emailVerified: true`. A resend endpoint recovers lost emails.
- **Password reset** — "forgot password" emails a one-time token; a token + new password resets the
  hash and bumps `tokenVersion` so all existing sessions die (matches the logout semantics in
  `auth.service.ts`).

Both use a single shared, **one-time, hashed, expiring** token model — not JWTs (the existing
`jwtUtils` signs sessions; these tokens are random 32-byte secrets, only their SHA-256 hash is stored
so a DB leak can't mint reset links). Emails go through the existing `src/utils/email.ts`
Resend pattern — always best-effort, never failing the request.

## Depends on

- `src/modules/auth/auth.service.ts` — `registerUser` (verify after register), `loginUser`
  (optionally gate unverified accounts), tokenVersion semantics
- `prisma/schema/user.prisma` — `emailVerified` already present
- `src/utils/email.ts` — `getResend`, `emailLayout`, `escapeHtml` to extend with two new senders
- `src/config/index.ts` — Resend creds already validated; add nothing required
- `src/utils/jwt.ts`, `src/middleware/auth.ts` — existing auth plumbing
- `src/app.ts` — the auth router already exists at `/api/auth`; new routes join it

## Prisma changes

New `prisma/schema/authToken.prisma` + a `TokenType` enum in `enums.prisma`:

```prisma
enum TokenType {
  EMAIL_VERIFY
  PASSWORD_RESET
}
```

```prisma
model AuthToken {
  id        String    @id @default(uuid())
  userId    String
  type      TokenType
  hash      String    @unique   // SHA-256 of the raw token sent in the email
  expiresAt DateTime

  createdAt DateTime  @default(now())
  consumedAt DateTime?          // one-time use

  user User @relation(fields: [userId], references: [id])

  @@index([userId, type])
  @@map("auth_tokens")
}
```

- `user.prisma`: add `authTokens AuthToken[]` back-relation.
- Apply with `npx prisma migrate dev --name add_auth_tokens`.

## Token lifecycle (shared util)

`src/utils/authToken.ts`:

- `createAuthToken(userId, type, ttlMs)` — generate `randomBytes(32).toString("hex")`, store
  `{ userId, type, hash: sha256(raw), expiresAt }` (via `crypto.createHash`), return the **raw**
  token (only ever handed to the email; never stored).
- `consumeAuthToken(rawToken, type)` — hash the presented token, `findFirst({ where: { hash, type,
  consumedAt: null, expiresAt: { gt: now } } })`. If found → mark `consumedAt: now` **in the same
  transaction as the caller's action** (or after the action succeeds) and return the row. Any miss →
  throw `AppError(400/401, "This link is invalid or has expired.")`. One-time use: a replayed token
  finds `consumedAt: not null` → same error.
- TTLs: email verify **24h**, password reset **1h**.

## Endpoints — `/api/auth`

```
POST /verify-email         public   { token }          → 200 { emailVerified: true }
POST /resend-verification  auth()                      → 200 (always succeeds once verified)
POST /forgot-password      public   { email }          → 200 (never reveals whether the email exists)
POST /reset-password       public   { token, password }→ 200 → user must re-login
```

### Behavior

- **POST /verify-email** — `consumeAuthToken(token, EMAIL_VERIFY)`; transaction: mark consumed +
  `user.update({ data: { emailVerified: true } })`. Re-verifying an already-verified account: a valid
  un-consumed token still succeeds; a consumed/replayed token errors (one-time). If the account is
  already verified and the token is expired, return success anyway (idempotent UX — the page should
  not fail for a user who's already verified).
- **POST /resend-verification** — `auth()`; if `user.emailVerified` → 200 with a "already verified"
  message (no new email). Else `createAuthToken(EMAIL_VERIFY)` + best-effort email. Keep the existing
  `authLimiter`? It's registered on specific paths only (`/api/auth/register|login|demo-login|google`);
  add `/api/auth/forgot-password|resend-verification` to it to stop email bombing.
- **POST /forgot-password** — lookup by email; **always** return 200 (no account enumeration — the
  demo login pattern's resurrection logic is irrelevant here). If the user exists and
  `authProvider === CREDENTIAL` (Google users reset via Google), `createAuthToken(PASSWORD_RESET)` +
  email. The email contains a link the frontend builds: `FRONTEND_URL_DEV/PROD + /reset-password?token=`.
- **POST /reset-password** — `consumeAuthToken(token, PASSWORD_RESET)`; transaction: update
  `password: bcrypt.hash(newPassword)` **and** `tokenVersion: { increment: 1 }` (kills all sessions,
  same as logout). Return 200 — the client then logs in fresh.
- **registerUser** change: after `user.create`, if `authProvider === CREDENTIAL`, fire a verification
  email best-effort (`Promise.allSettled` — never fails registration). The response may include
  `emailVerified: false`.
- **loginUser** change (deliberate non-gate): this step intentionally does **not** block unverified
  users from logging in or booking. `emailVerified` becomes observable (flag on `/me`, UI banner)
  but no endpoint enforces it yet — gating bookings/payments behind verification is a documented
  product decision deferred to the backlog. This is a conscious choice, not an omission:
  hard-blocking without an admin-side verification path would lock out demo/seed accounts and
  break the grading flow.

## Email additions — `src/utils/email.ts`

Two new senders using the existing `getResend`/`emailLayout`/`escapeHtml` helpers:

- `sendVerificationEmail({ email, name, verifyUrl })` — "Verify your email" + a button-style link.
- `sendPasswordResetEmail({ email, name, resetUrl })` — "Reset your password", notes 1h expiry.

The URLs are built in the auth service from `config.frontend_url_dev`/`frontend_url_prod`
(`NODE_ENV`-picked, like the payment redirect logic).

## Files to change

- `prisma/schema/enums.prisma`
- `prisma/schema/user.prisma`
- `src/modules/auth/auth.service.ts` — register fires verification; forgot/reset/verify/resend logic
- `src/modules/auth/auth.route.ts` — four new routes + limiter additions
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.validation.ts` — `verifyEmailSchema`, `forgotPasswordSchema`,
  `resetPasswordSchema`
- `src/modules/auth/auth.interface.ts`
- `src/utils/email.ts` — two new senders
- `src/app.ts` — extend `authLimiter` paths

## Files to create

- `prisma/schema/authToken.prisma`
- `src/utils/authToken.ts`
- migration `prisma/migrations/*add_auth_tokens`

## New dependencies

None (`node:crypto` provides `randomBytes` + `createHash`).

## Rules for implementation

- Raw tokens never persist — only the SHA-256 hash. Logs must never print the raw token.
- Token consumption and the resulting write (verify / reset) are atomic — consume inside the same
  `$transaction` as the user update, so a crash between consume and update can't orphan a token.
- Emails are best-effort (`Promise.allSettled`) exactly like the existing booking/contact emails.
- `forgot-password` never leaks whether an email exists (uniform 200 + the same error path).
- Password reset bumps `tokenVersion` (kills sessions) — reuse the existing semantics.
- Section-header comments only where existing modules use them.

## Definition of done

- `npx prisma migrate dev --name add_auth_tokens` applies; `npx tsc --noEmit` passes.
- Register a credential user → an email with a verify link is sent (Resend configured) or no-oped;
  `POST /api/auth/verify-email { token }` → `emailVerified: true`; the same token replayed → error.
- Expired token → "invalid or expired". Wrong type (reset token used to verify) → error.
- `POST /api/auth/forgot-password` returns 200 for both existing and non-existing emails; the reset
  token works once, then re-login succeeds with the new password and all old sessions are dead
  (`tokenVersion` bumped).
- `POST /api/auth/resend-verification` on a verified account → 200 "already verified", no email.
- `npx tsc --noEmit` clean; commit + push (AGENTS.md workflow).