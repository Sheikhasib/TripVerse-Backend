# Step 4 — Auth Module

## Middleware
- **[MVP]** `auth(...roles: Role[])` — single combined middleware (matches GearUp): verifies JWT, re-fetches user from DB (catches suspended/deleted users immediately), attaches `req.user = { id, name, email, role }`.
- **[MVP]** Roles: `USER`, `AGENT`, `ADMIN`. (Rubric says "User / Admin / Manager" — `AGENT` is the "Manager" role; keep that label on the frontend, e.g. sidebar menu, role badges.)
- **[MVP]** Token invalidation via `tokenVersion` — access/refresh JWT payload includes `tokenVersion`. On logout or password change, `User.tokenVersion` is incremented; `auth` middleware compares payload version against the current DB value and rejects on mismatch. This makes logout actually invalidate the token instead of only clearing the cookie.
- **[LATER]** Email verification on registration (the `emailVerified` field exists; Google sets it via `email_verified`, credentials accounts stay `false` until this flow is built).
- **[LATER]** Password reset flow.

## Registration role policy
Self-registration accepts only `role: USER` or `AGENT` — never `ADMIN`. Admin is seeded with env credentials (Step 13); an attempt to register as ADMIN is a 400. `demo-login` still accepts any role (it is the grading path).

## Google OAuth — ID-token flow (`google-auth-library`)
Requirement #6 requires social login, so this is **[MVP]**, not deferred. Add `google-auth-library` and a `lib/googleAuth.ts` `OAuth2Client` (`clientId: config.google_client_id`) — port the proven GearUp flow:
- `POST /auth/google` — body `{ idToken }`; verify via `verifyIdToken({ idToken, audience })`, require `email_verified` and the `sub/googleId`.
- Email already belongs to a CREDENTIAL account → link it (set `googleId` + `emailVerified: true`) and sign them in as the same user. Email already linked to a *different* `googleId` → 409.
- New email → create user with `password: null, authProvider: GOOGLE, googleId, emailVerified: true, role: USER`.
- Google accounts are passwordless: `loginUser` and the password-change path block them with a clear message (never let a Google account set a password).
- `GOOGLE_CLIENT_ID` is `.optional()` in the Step 1 Zod schema and is validated at runtime when this route is hit — the app boots without it, only Google login fails.

## Endpoints — `/api/auth`
```
POST   /register
POST   /login
POST   /google              body: { idToken }
POST   /demo-login          body: { role }
POST   /logout              auth   — increments tokenVersion, clears cookie
GET    /me                  auth
```

## Endpoints — `/api/users`
```
PATCH  /profile             auth
GET    /                    auth(ADMIN)  ?page&limit&search
PATCH  /:id/role            auth(ADMIN)
PATCH  /:id/status          auth(ADMIN)   suspend/reactivate
DELETE /:id                 auth(ADMIN)  soft delete
```
