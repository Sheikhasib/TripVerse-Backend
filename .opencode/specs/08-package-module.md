# Step 8 — Package Module

## Endpoints — `/api/packages`
```
GET    /                    public   ?search&category&location&minPrice&maxPrice&minRating&maxDuration&sortBy&sortOrder&page&limit
GET    /internal/all         auth(ADMIN)          ?status&agentId&page&limit
GET    /internal/my-packages auth(AGENT)          ?page&limit
GET    /:slug                public
POST   /                     auth(AGENT, ADMIN)
PATCH  /:id                  auth(AGENT, ADMIN)   own only (AGENT) / any (ADMIN); AGENT edits reset to PENDING
PATCH  /:id/status            auth(ADMIN)          approve/reject
DELETE /:id                  auth(AGENT, ADMIN)   own only (AGENT) / any (ADMIN), soft delete
```

## Route order matters
`/internal/all` and `/internal/my-packages` must be registered **before** `GET /:slug` in `package.route.ts`. Express matches routes top-down, so if `:slug` were registered first it would swallow `/internal/all` as a slug value and the admin/agent routes would 404 unpredictably. Add a one-line comment in the route file itself so this doesn't regress on a future edit.

## Internal endpoints
Both `GET /internal/all` (ADMIN) and `GET /internal/my-packages` (AGENT) return full lists (any status, no public filters), paginated with the standard `meta` object (`page`, `limit`, `total`, `totalPages`). `my-packages` filters `agentId = req.user.id`. `all` supports optional `status` (PENDING/APPROVED/REJECTED) and `agentId` filters for the admin moderation UI. These internal routes also power agent/self preview of their own PENDING/REJECTED packages before approval.

## Public listing only shows APPROVED
`GET /` and `GET /:slug` filter `status: APPROVED AND isDeleted: false` — new packages default to `PENDING`, and a freshly created AGENT package must not leak into the public explore feed or detail page until the admin approves it. Every public query also applies the soft-delete filter from Step 3.

## Category filter
`?category=` matches the `Category.slug` relation (Step 7), not a free string — build the `where` with `category: { slug: category }`. Create/edit payloads send `categoryId`; validate it exists with `findUnique` and throw `AppError(400, 'Invalid categoryId')` explicitly — do **not** rely on P2025, which the global handler maps to 404 (wrong semantic for a bad reference).

## Filters & sorting (requirement #5: ≥2 working filter fields)
Built on `where` filters + `orderBy` — all optional, combined with `AND`. `search` matches `title`/`description`/`location` contains-insensitive. The rest:
- `location` — `location: { contains: location, mode: 'insensitive' }`.
- `minPrice` / `maxPrice` — inclusive range on `price`; 400 if `minPrice > maxPrice`.
- `minRating` — `rating: { gte: minRating }` (decimal, validated 0–5). Note: this filters the stored aggregate rating on `TourPackage.rating`, which stays accurate only once Step 10 (reviews) recomputes it after each review change.
- `maxDuration` — `duration: { lte: maxDuration }` (days).
- `sortBy` = `newest` (createdAt desc, default) | `price` | `rating` | `title`; `sortOrder` = `asc`/`desc` (default `asc` for price/rating/title, `desc` for newest). Whitelist both — never interpolate a user string into `orderBy`.

Every public query stays `status: APPROVED AND isDeleted: false`.

## Create/edit payload validation
Zod schema shared by create and edit (edit = create schema with all fields optional):
- `title` — string, 3–200 chars.
- `description` — string, 10–10_000 chars (long-form travel content).
- `location` — string, 2–200 chars.
- `price` — positive decimal, `> 0`, max 2 decimals (money is `Decimal(10,2)` in the schema — pass a number, the service maps to/from `Number()`).
- `duration` — integer `>= 1` (days).
- `categoryId` — string (validated against DB as above).
- `images` — array of 1–6 valid URLs (Zod `.url()` + `.max(6)`), i.e. the Cloudinary URLs already returned by Step 5's upload endpoint.

## Slug generation
Server generates the slug from `title` on create (kebab-case lowercase, special chars stripped), not the client. TripVerse titles can be non-Latin (Bangla-heavy), so use a slugify lib with strict mode **plus a Bangla→Latin transliteration map**; if the result is still empty, fall back to `package-<shortId>`. On collision, append `-2`, `-3`, etc. — check existing slugs with a single prefix query (`findMany` where `slug: { startsWith: <base> }`), then pick the next free suffix; no per-attempt loop. Edits to `title` do not change the slug (keeps existing links/bookmarks valid).

## Image handling
`images` field in create/edit payload is an array of URLs already returned by Step 5's upload endpoint — each validated as a URL, capped at 6 via Zod `.url()` + `.max(6)`.

## Ownership & approval
Agent can only edit/delete their own packages (`agentId = req.user.id`). Any **AGENT** edit resets `status` to `PENDING`, requiring re-approval. **ADMIN** bypasses ownership (can edit/delete any package) and ADMIN edits preserve the current status (the admin is the approver — no need to re-approve their own change). Admin approves/rejects via the `/:id/status` endpoint.
