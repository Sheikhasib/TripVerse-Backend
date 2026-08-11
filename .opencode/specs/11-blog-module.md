# Step 11 — Blog Module

Travel-news content backing the landing **Blogs** section and a standalone **Blog** page (both in the requirements' section/page examples). Agents and admins author posts; admins publish; anyone reads published posts. Depends on auth (Step 4) and uploads (Step 5) for the cover image.

## Endpoints — `/api/blog`
```
GET    /                    public   ?search&sortBy&sortOrder&page&limit   (PUBLISHED + not deleted only)
GET    /internal/all         auth(ADMIN)                                  all statuses, ?page&limit&status
GET    /:slug                public                                       (PUBLISHED + not deleted only)
POST   /                     auth(AGENT, ADMIN)                           authorId = req.user.id
PATCH  /:id                  auth(AGENT, ADMIN)   own only, edits reset to DRAFT
PATCH  /:id/status            auth(ADMIN)          publish/unpublish — body: { status: DRAFT|PUBLISHED }, validated against enum
DELETE /:id                  auth(AGENT, ADMIN)   own only, soft delete
```

## Route order matters
`/internal/all` must be registered **before** `GET /:slug` in `blog.route.ts` — same swallow-the-internal-path hazard as packages (Step 8). One-line comment in the route file, same as packages.

## Public listing only shows PUBLISHED
`GET /` and `GET /:slug` filter `status: PUBLISHED AND isDeleted: false` — a freshly drafted post must not leak to the public blog until the admin publishes it. Same soft-delete filter from Step 3.

## Slug generation
Server generates `slug` from `title` on create (kebab-case, same slugify as packages). On collision append `-2`, `-3`, etc. Edits to `title` do not change the slug.

## Ownership & publishing
- Agent can only edit/delete their own posts (`authorId` check, same as package `agentId`).
- Any edit resets `status` to `DRAFT` — re-publish explicitly via `/:id/status`. Admin can edit anything and is the only role that can publish/unpublish.
- `coverImage` is a single Cloudinary URL returned by Step 5's upload endpoint (required on create). `content` is long-form text/HTML — do not reuse the 10kb global body limit for this field; apply `express.json({ limit: '100kb' })` on the blog routes only, or the post body will be rejected.

## Sort & search
`sortBy` = `newest` (createdAt desc, default) | `oldest` | `title`. `search` matches `title`/`excerpt` contains-insensitive. Standard `page`/`limit` with `meta` in the envelope; `limit` capped at Step 3's 50. No review/comment system — **[LATER]** blog comments.