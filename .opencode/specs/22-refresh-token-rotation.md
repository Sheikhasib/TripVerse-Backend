# Step 22 — Refresh Token Rotation

## Overview

Promotes refresh token rotation out of the backlog (Step 15). Today a refresh token is a
**stateless** JWT (`auth.service.ts` `issueTokens` → `refreshToken` verifies against
`JWT_REFRESH_SECRET` and `tokenVersion`). A leaked/stolen refresh JWT stays valid for 30 days and is
only killed by logout (tokenVersion bump). Rotation makes each refresh issue a **new** refresh token
and invalidate the old one, so a stolen token becomes worthless after a single legitimate use, and a
**replay of an already-rotated token** (the classic theft signature) revokes the whole token family.

This is a drop-in replacement for the existing `/api/auth/refresh` — the client contract does not
change (send refresh token → get new access + refresh tokens).

## Depends on

- `src/modules/auth/auth.service.ts` — `refreshToken`, `logout`, `issueTokens`, `tokenVersion`
- `prisma/schema/user.prisma` — `tokenVersion` stays as the family kill-switch
- `src/config/index.ts` — `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` already present
- `src/utils/jwt.ts` — `jwtUtils.verifyToken` used to validate the presented token's signature
- `src/modules/auth/auth.route.ts` — the `/refresh` route exists; only the service changes
- `src/app.ts` — no route changes needed

## Prisma changes

New `prisma/schema/refreshToken.prisma`:

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  hash      String   @unique   // SHA-256 of the refresh JWT — never store the JWT itself
  expiresAt DateTime
  createdAt DateTime @default(now())
  revokedAt DateTime?          // set when rotated or logged out

  user User @relation(fields: [userId], references: [id])

  @@index([userId, revokedAt])
  @@map("refresh_tokens")
}
```

- `user.prisma`: add `refreshTokens RefreshToken[]` back-relation.
- Apply with `npx prisma migrate dev --name add_refresh_token_rotation`.

## Flow

### Issue (`issueTokens` — extended)

After signing the access + refresh JWTs (unchanged), also persist:
`create({ userId, hash: sha256(refreshToken), expiresAt: now + refresh-expiry })`. The refresh JWT
itself stays in the response payload exactly as today — the DB row is just a rotation ledger.

**jti is mandatory.** `jwt.sign(payload, secret)` (second-resolution `iat`, no `jti`) mints
**byte-identical** tokens for the same user within the same second — the rotated token would equal
the one being revoked and its `sha256` would collide on the ledger's `@unique` hash (→ P2002 → 409).
Every signed token must carry `jti: crypto.randomUUID()` (add in `jwtUtils.createToken` so it applies
to access + refresh alike). Verify: two tokens minted in the same second decode to different `jti`.

### Refresh (`refreshToken` — rewritten)

1. Verify the JWT signature + `tokenVersion` as today (a bad signature still → 401; a bumped
   tokenVersion still → 401).
2. Look up `prisma.refreshToken.findUnique({ where: { hash: sha256(presented) } })`:
   - **Not found** → 401 (never issued, or already pruned).
   - **Found but `revokedAt` set** → **theft signature**: someone replayed an already-rotated token.
     Revoke the whole family — `updateMany({ where: { userId }, data: { revokedAt: now } })` **and**
     `user.update({ data: { tokenVersion: { increment: 1 } } })` so every outstanding token (incl.
     the stolen one) dies. Throw 401.
   - **Found, not revoked, not expired** → rotate via **compare-and-swap**, not a blind update:
     `updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } })`. If `count === 0` the
     token was just rotated by a concurrent request → treat as reuse and nuke the family (same as the
     `revokedAt` branch). Only the winner issues the new pair. This keeps the backend strict under
     true concurrency, not just sequential replay.
3. A rotated token presented **again** (the honest client's old token arriving late, or a thief)
   hits the `revokedAt` branch and kills the family — the intended trade-off of rotation. The
   frontend must always persist the **newest** refresh token it receives.

**Two-tab / concurrent-refresh mitigation (required):** two tabs (or a boot-time race) firing
`/refresh` concurrently will race — the first rotates the token, the second arrives on the now-revoked
old token, hits the `revokedAt` branch, and revokes the whole family, logging the user out for doing
nothing wrong. This is the classic false positive of rotation. The frontend must **single-flight**
its refresh calls (a shared in-memory promise so concurrent callers await the same in-flight
request, or reuse the latest token after the first succeeds). The backend stays strict (reuse →
revoke); the web app absorbs the concurrency. Document this as a hard frontend requirement.

### Logout (`logout` — extended)

Existing `tokenVersion: { increment: 1 }` stays (kills everything). Add
`updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } })` so the ledger is clean
too. Order: revoke rows first, then bump tokenVersion.

### Housekeeping

- Prune expired/revoked rows opportunistically on refresh (e.g. `deleteMany({ where: { OR: [
  { expiresAt: { lt: now } }, { revokedAt: { lte: now - 7d } } ] } })` — no cron needed; a light sweep
  per refresh keeps the table from growing unbounded).
- Same-secret, same-TTL config — no `.env` changes.

## Files to change

- `prisma/schema/user.prisma`
- `src/modules/auth/auth.service.ts` — `issueTokens`, `refreshToken`, `logout`

## Files to create

- `prisma/schema/refreshToken.prisma`
- migration `prisma/migrations/*add_refresh_token_rotation`

## New dependencies

None (`node:crypto` `createHash` for SHA-256).

## Rules for implementation

- Never store the refresh JWT — only `sha256` of it. A DB leak can't mint usable refresh tokens.
- Rotation is transactional: revoke-old + insert-new must succeed atomically or the client gets
  neither.
- Reuse detection (a `revokedAt` row presented) **always** nukes the family via `tokenVersion` — this
  is the security property the feature exists for; don't soften it to a simple 401.
- The access token stays short-lived (unchanged); rotation only governs the refresh token.
- Section-header comments only where existing modules use them.

## Definition of done

- `npx prisma migrate dev --name add_refresh_token_rotation` applies; `npx tsc --noEmit` passes.
- Login → a refresh row exists (hash present, `revokedAt: null`). `POST /api/auth/refresh` →
  new tokens **and** the old row's `revokedAt` set, a new row inserted.
- **Same-second mint** (login → refresh back-to-back) → 200, distinct tokens/hashes — never a 409.
- Presenting the **old** (now revoked) refresh token → family revoked: `tokenVersion` incremented,
  the previously-issued refresh token now 401s too.
- Two concurrent presents of the same still-valid token → one 200, the other 401 with a family
  nuke (CAS: only one rotation wins).
- Logout → all rows for the user revoked + tokenVersion bumped (existing behaviour preserved).
- `npm run dev` boots; the normal login→refresh→use flow works unchanged for the frontend.
- Commit + push (AGENTS.md workflow).