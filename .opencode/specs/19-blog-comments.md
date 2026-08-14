# Step 19 — Blog Comments

## Overview

Promotes blog comments out of the backlog (Step 15) into a real module. Public, paginated comments
under each published blog post, with one-level replies (a comment can reply to another comment —
no deeper nesting, keeping the UI and queries simple). Any authenticated user may comment; the post
author (AGENT/ADMIN) and ADMIN can delete comments (soft delete). Reading is public; writing is
authenticated. Comments only ever appear under `PUBLISHED`, non-deleted posts — the same visibility
rule as `getPostBySlug`.

## Depends on

- `prisma/schema/blogPost.prisma`, `prisma/schema/user.prisma` — the post and commenter models
- `src/modules/blog/blog.service.ts` — `publicAuthorSelect` pattern + the PUBLISHED/not-deleted rule
- `src/modules/blog/blog.route.ts` — route ordering lesson: static paths before `:slug`
- `src/middleware/auth.ts`, `src/middleware/validateRequest.ts`, `src/utils/sendResponse.ts`
- `src/app.ts` — module registration (nested under `/api/blog` or its own `/api/comments`)

## Prisma changes

New `prisma/schema/blogComment.prisma`:

```prisma
model BlogComment {
  id         String   @id @default(uuid())
  content    String   @db.Text
  isDeleted  Boolean  @default(false)

  postId   String
  userId   String
  parentId String?          // one-level replies: parent comment id, else null

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  post   BlogPost     @relation("PostComments", fields: [postId], references: [id])
  user   User         @relation("UserComments", fields: [userId], references: [id])
  parent BlogComment? @relation("CommentReplies", fields: [parentId], references: [id])
  replies BlogComment[] @relation("CommentReplies")

  @@index([postId, isDeleted, createdAt])
  @@index([parentId])
  @@map("blog_comments")
}
```

- `blogPost.prisma`: add `comments BlogComment[] @relation("PostComments")` back-relation.
- `user.prisma`: add `comments BlogComment[] @relation("UserComments")` back-relation.
- Apply with `npx prisma migrate dev --name add_blog_comments`.

## Endpoints — `/api/blog`

```
GET    /:slug/comments       public        paginated, PUBLISHED + non-deleted post only
POST   /:slug/comments       auth()        JSON { content, parentId? } → 201
DELETE /comments/:id         auth()        author or ADMIN soft-deletes
```

> **Route ordering note** (mirrors the literal-before-param discipline in `blog.route.ts`):
> - `GET /:slug/comments` and `POST /:slug/comments` are two-segment paths, so they never collide
>   with the one-segment `GET /:slug` — their position relative to `GET /:slug` doesn't matter, but
>   keep them grouped after `POST /` for readability.
> - `DELETE /comments/:id` must be registered before any route that could shadow `comments` as a
>   `:slug` segment. In practice: register the whole comment block after `POST /` and before
>   `PATCH /:id/status`, and never add a bare `PATCH /:slug` or `DELETE /:slug`.

### Behavior

- **GET /:slug/comments** — the post must be `PUBLISHED` + `isDeleted: false` (404 otherwise, same
  as `getPostBySlug`). Returns top-level comments + their replies in one pass (two queries or a
  single `where { OR: [{ parentId: null }, { parent: { parentId: null } }] }` — pick the two-query
  shape for clarity). Ordered newest-first for top-level, oldest-first within replies (conversation
  order). Step 3 `meta` envelope, default limit 10, capped 50. Each item includes the commenter's
  `name` + `avatarUrl` (never email/role) and a `replies` array.
- **POST /:slug/comments** — post must be `PUBLISHED` + not deleted (404). `content` `.trim().min(1)
  .max(2000)`. `parentId` optional; when present it must reference a comment on the **same post**
  (400 otherwise) and must itself be a top-level comment (replies to replies → 400, enforcing the
  one-level rule). Returns 201 with the created comment + commenter select.
- **DELETE /comments/:id** — the comment owner (`userId === req.user.id`) or any ADMIN. Soft delete:
  `update({ data: { isDeleted: true } })` so replies keep their parent. Repeat delete → 404 (already
  gone). Public list never returns `isDeleted` rows.
- No edit endpoint in this step (backlog: comment edit).

## Files to change

- `prisma/schema/blogPost.prisma`
- `prisma/schema/user.prisma`
- `src/modules/blog/blog.route.ts` — add the comment routes

## Files to create

- `prisma/schema/blogComment.prisma`
- `src/modules/blog/blogComment.service.ts` (co-located with the blog module, one comment concern)
- `src/modules/blog/blogComment.controller.ts`
- `src/modules/blog/blogComment.validation.ts`
- `src/modules/blog/blogComment.interface.ts`
- migration `prisma/migrations/*add_blog_comments`

## New dependencies

None.

## Rules for implementation

- Keep the `route → controller → service → validation` shape; comment service is a sibling file in
  `src/modules/blog/` so both concerns share the post-visibility helpers.
- Services throw `AppError(statusCode, message)`; `catchAsync` + global handler do the rest.
- One-level replies enforced server-side (`parent.parentId === null` check) — the client cannot nest.
- Owner checks use `where { id, userId }` on writes so a foreign id is a 404, never a leak.
- Section-header comments only where existing modules use them.

## Definition of done

- `npx prisma migrate dev --name add_blog_comments` applies; `npx tsc --noEmit` passes.
- Wired into the blog router; `npm run dev` boots, `GET /health` OK.
- On a PUBLISHED post: `POST /:slug/comments` → 201 with commenter info; reply-to-comment works;
  reply-to-reply → 400; comment on a DRAFT post → 404; unauthenticated POST → 401.
- `GET /:slug/comments` returns top-level + replies with `meta`; deleted comments are absent.
- Author/ADMIN `DELETE /comments/:id` → row's `isDeleted: true`; foreign user → 404.
- Commit + push (AGENTS.md workflow).