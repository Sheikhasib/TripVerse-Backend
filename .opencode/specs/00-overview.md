# TripVerse — Backend Spec (Build Order)

Status legend: **[MVP]** = building now for submission · **[LATER]** = deferred, scoped but not built

Files are numbered in the order you build them — each step depends on the one before it, so implement in sequence, not by topic:

1. `01-project-setup.md` — tech stack, folder shape, env validation
2. `02-data-models.md` — full Prisma schema (everything else depends on this)
3. `03-core-backbone.md` — error handling, response envelope, CORS, security headers, rate limiting, health check — the shared plumbing every module plugs into
4. `04-auth-module.md` — auth endpoints, RBAC middleware, tokenVersion invalidation, Google OAuth, user/profile endpoints
5. `05-uploads-module.md` — Cloudinary image upload endpoint
6. `06-contact-module.md` — public contact form + admin manage + best-effort emails (required form; pulled into MVP)
7. `07-category-module.md` — admin-managed package taxonomy (landing Categories section + explore filter)
8. `08-package-module.md` — package CRUD, slug generation, filter/sort/pagination
9. `09-booking-module.md` — booking creation, server-side pricing, status state machine
10. `10-review-module.md` — review creation, transaction-safe rating recalculation
11. `11-blog-module.md` — blog post CRUD, publish gating, own-only edits
12. `12-dashboard-module.md` — admin/agent/user stats aggregation
13. `13-seed-script.md` — demo data so the frontend has something real to render
14. `14-deployment.md` — host, env vars, live link
15. `15-backlog-summary.md` — everything explicitly cut from MVP, for later

Finish and test one file before opening the next.
