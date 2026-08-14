# Step 15 — Backlog Summary (do NOT build now)

Wishlist, Notifications, blog comments, review edit/delete (let users fix a typo after posting), email verification + password reset flows, refresh token rotation, SSLCommerz refund-money movement (booking cancellation currently only flags the payment `REFUNDED` — see Step 16), tests, CI. All scoped above so they're a quick add-on later, not a redesign.

Each backlog item now has a concrete spec (written for quick follow-up implementation). See:

- `17-wishlist-module.md` — wishlist
- `18-notification-module.md` — notifications
- `19-blog-comments.md` — blog comments
- `20-review-edit-delete.md` — review edit/delete
- `21-email-verification-password-reset.md` — email verification + password reset
- `22-refresh-token-rotation.md` — refresh token rotation
- `23-sslcommerz-refund.md` — SSLCommerz refund money movement
- `24-testing.md` — tests
- `25-ci-cd.md` — CI

The build order in `00-overview.md` lists them as steps 17–25. Still deferred (not yet spec'd):
blog comment edit, wishlist admin visibility, notification pruning, hard review delete.