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
16. `16-payment-module.md` — SSLCommerz payment gateway (checkout, IPN, booking PAID status)

## Backlog — scoped specs (do NOT build now)

The Step 15 backlog items have been spec'd out into concrete follow-up steps. Each is a quick add-on
later, not a redesign. Build them in order only after the MVP + payment are verified:

17. `17-wishlist-module.md` — user saves packages to a wishlist
18. `18-notification-module.md` — in-app notifications for bookings + package approvals
19. `19-blog-comments.md` — public blog comments with one-level replies
20. `20-review-edit-delete.md` — review edit/delete + shared rating recompute
21. `21-email-verification-password-reset.md` — one-time-token verify + reset flows
22. `22-refresh-token-rotation.md` — rotating refresh tokens with theft detection
23. `23-sslcommerz-refund.md` — real refund money movement on PAID-booking cancel
24. `24-testing.md` — Vitest + supertest suite (unit + integration)
25. `25-ci-cd.md` — GitHub Actions: typecheck, tests, Vercel bundle-freshness gate

Finish and test one file before opening the next.

## Git workflow (mandatory)

Commit and push continuously as the build progresses — not once at the end:

- **At minimum**: one commit per spec step, right after its module endpoints are verified.
- **More often**: commit at substantial milestones *within* a step (e.g. after the auth module's routes were wired and live-tested, before starting the user module).
- Commit small, reviewable units — don't bundle multiple unimplemented steps into one commit.
- Push to `origin` after every commit.
- Never end a session (or ask to move to the next step) with uncommitted work on the tree.
