# Step 8 — Package Module

## Endpoints — `/api/packages`
```
GET    /                    public   ?search&category&location&minPrice&maxPrice&minRating&maxDuration&sortBy&sortOrder&page&limit
GET    /internal/all         auth(ADMIN)
GET    /internal/my-packages auth(AGENT)
GET    /:slug                public
POST   /                     auth(AGENT, ADMIN)
PATCH  /:id                  auth(AGENT, ADMIN)   own only, edits reset to PENDING
PATCH  /:id/status            auth(ADMIN)          approve/reject
DELETE /:id                  auth(AGENT, ADMIN)   own only, soft delete
```

## Route order matters
`/internal/all` and `/internal/my-packages` must be registered **before** `GET /:slug` in `package.route.ts`. Express matches routes top-down, so if `:slug` were registered first it would swallow `/internal/all` as a slug value and the admin/agent routes would 404 unpredictably. Add a one-line comment in the route file itself so this doesn't regress on a future edit.

## Public listing only shows APPROVED
`GET /` and `GET /:slug` filter `status: APPROVED AND isDeleted: false` — new packages default to `PENDING`, and a freshly created AGENT package must not leak into the public explore feed or detail page until the admin approves it. Every public query also applies the soft-delete filter from Step 3.

## Category filter
`?category=` matches the `Category.slug` relation (Step 7), not a free string — build the `where` with `category: { slug: category }`. Create/edit payloads send `categoryId`; validate it exists via `findUniqueOrThrow` and let P2025 surface as a 400-style message.

## Filters & sorting (requirement #5: ≥2 working filter fields)
Built on `where` filters + `orderBy` — all optional, combined with `AND`. `search` matches `title`/`description`/`location` contains-insensitive. The rest:
- `location` — `location: { contains: location, mode: 'insensitive' }`.
- `minPrice` / `maxPrice` — inclusive range on `price`; 400 if `minPrice > maxPrice`.
- `minRating` — `rating: { gte: minRating }` (decimal, validated 0–5).
- `maxDuration` — `duration: { lte: maxDuration }` (days).
- `sortBy` = `newest` (createdAt desc, default) | `price` | `rating` | `title`; `sortOrder` = `asc`/`desc` (default `asc` for price/rating/title, `desc` for newest). Whitelist both — never interpolate a user string into `orderBy`.

Every public query stays `status: APPROVED AND isDeleted: false`.

## Slug generation
Server generates the slug from `title` on create (kebab-case), not the client. On collision, append `-2`, `-3`, etc. by checking existing slugs with that prefix. Edits to `title` do not change the slug (keeps existing links/bookmarks valid).

## Image handling
`images` field in create/edit payload is an array of URLs already returned by Step 5's upload endpoint — capped at 6 via Zod `.max(6)`.

## Ownership & approval
Agent can only edit/delete their own packages (`agentId` check). Any edit resets `status` to `PENDING`, requiring re-approval. Admin approves/rejects via the `/:id/status` endpoint.
