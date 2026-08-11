# Step 6 — Contact Module

Backs the Contact page form (a required form in the requirements). Public submit, admin manage. Build after uploads.

## Endpoints — `/api/contact`
```
POST  /                public          body: { name, email, subject, message }
GET   /                auth(ADMIN)      ?page&limit&isResolved
PATCH /:id             auth(ADMIN)      mark resolved/unresolved  body: { isResolved }
```

## Rules
- `POST /` — no auth. All four fields required and validated with Zod (Zod `.email()` for `email`, sensible min/max lengths on the rest). Never trust more than the schema; the model has one boolean field admin edits, nothing sensitive.
- `GET /` — filter by `isResolved`, standard `page`/`limit` pagination with `meta` in the response envelope. Admin list is already covered by the role guard.
- `PATCH /:id` — validates the transition `.refine(...)` style at the Zod layer; rejected with 400 if `isResolved` missing or not a boolean.
- No soft-delete wrapper yet — soft-delete checklist applies to `User`/`TourPackage` only (see Step 3). If contact moderation matters later, promote `isResolved` into a status enum.

## Rate limiting
Public `POST /` is covered by the standard API limiter from Step 3 (100 req / 15 min per IP). That is per-IP, so a scripted flood is throttled, but it does not stop one IP from creating many messages — acceptable for MVP; add honeypot + field-level rate limiting only if spam appears.

## Best-effort email notifications (Resend)
Port GearUp's `utils/email.ts` pattern so the Contact page feels real, without email ever breaking the form:
- Lazy Resend client — module is importable with no API key; every send becomes a no-op with a `console.warn` when unconfigured.
- After the DB insert, fire the admin notification + user auto-reply through `Promise.allSettled` — an email failure must never fail the submission (the message is already saved).
- HTML-escape every user-supplied value inside the email layout.
- New env (Step 1, Zod `.optional()`): `RESEND_API_KEY`, `CONTACT_RECEIVER_EMAIL`, `EMAIL_FROM`.