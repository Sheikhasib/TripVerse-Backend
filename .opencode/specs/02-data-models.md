# Step 2 — Data Models (Prisma Schema)

Everything downstream depends on this — build it fully before touching any module.

### User
`id, name, email, password(String?, null for Google accounts), phone, avatarUrl, role(USER/AGENT/ADMIN), status(ACTIVE/SUSPENDED), authProvider(CREDENTIAL/GOOGLE, default CREDENTIAL), googleId(String? @unique), emailVerified(Boolean default false), isDeleted, tokenVersion(Int, default 0), timestamps`

- `tokenVersion` — incremented on logout and on password change. Refresh token payload carries the version it was issued with; `auth` middleware (Step 4) rejects the token if it doesn't match the current DB value. Minimal, cheap alternative to full refresh-token-table rotation.
- `password` is nullable and `googleId` is set only for Google-created accounts. Google accounts are permanently passwordless: password login and password changes are blocked for them (enforced in Step 4, same as GearUp).
- `@@index([role])`, `@@index([status])` — admin user-management list filters by both.

### TourPackage
`id, title, slug, description, location, price, duration, categoryId, images[](Cloudinary secure_url strings), rating, status(PENDING/APPROVED/REJECTED), isDeleted, agentId, timestamps`

- `categoryId` is a `Category` relation, not a free string — the explore `?category=` filter matches `category.slug` (Step 7). A real table is required for the landing Categories section and admin category management.
- `images[]` — array of Cloudinary `secure_url` strings (max 6 per package, enforced at the validation layer, not DB). See Step 5 (uploads module).
- `@@index([categoryId])`, `@@index([categoryId, price])` — explore filters on category+price; the composite index covers the common filter pair.
- `@@index([price])`, `@@index([status])` — explore sorts and the APPROVED-only public query both hit these.
- `@@unique([slug])` — explicit in schema.

### Category
`id, name(@unique), slug(@unique), packages TourPackage[], timestamps` — admin-managed taxonomy backing the explore filter, the landing Categories section, and the dashboard Categories menu. See Step 7 (category module).

- Deleting a category is blocked (409) while any package references it — checked in the category module, not the DB. `@@map("categories")`.

### Booking
`id, userId, packageId, travelDate, travelers, totalPrice, status(PENDING/PAID/CONFIRMED/CANCELLED/COMPLETED), timestamps`

- `@@index([userId])`, `@@index([packageId])`, `@@index([status])` — used by my-bookings, agent-bookings, and dashboard aggregation queries.
- Status transitions are a fixed state machine — see Step 9 (booking module).

### Review
`id, userId, packageId, rating, comment, timestamps` — creation gated on a `COMPLETED` booking for that package

- `@@unique([userId, packageId])` — one review per user per package. Without this a user can review the same package repeatedly and skew the rating average.

### ContactMessage
`id, name, email, subject, message, isResolved(Boolean default false), timestamps` — backs the Contact page form. `@@index([isResolved])` for the admin list filter.

### BlogPost
`id, title, slug(@unique), excerpt, content, coverImage, status(DRAFT/PUBLISHED), isDeleted, authorId, timestamps`

- `authorId` is a `User` relation (`authorId String` FK) — blog is authored by agents/admins (Step 11). `content` is long-form text/HTML, so the 10kb global JSON limit does not apply to blog routes (see Step 11).
- `@@index([status])`, `@@index([authorId])` — public list filters on `status`, admin list filters on author; both plus `isDeleted: false` on every query (Step 3 soft-delete checklist applies here too).
- `@@unique([slug])` — explicit in schema.

### Cloudinary asset tracking (lightweight)
No separate `Image` model for MVP — `images[]` on `TourPackage` is enough. Promote to a proper `Image` model only if moderation or per-image metadata becomes necessary.

### Enums (`enums.prisma`)
`Role` (USER/AGENT/ADMIN), `UserStatus` (ACTIVE/SUSPENDED), `AuthProvider` (CREDENTIAL/GOOGLE), `PackageStatus` (PENDING/APPROVED/REJECTED), `BookingStatus` (PENDING/CONFIRMED/CANCELLED/COMPLETED), `PostStatus` (DRAFT/PUBLISHED).

### [LATER] Wishlist
`id, userId, packageId, timestamps` — simple join table, ~30 min to add later

### Payment — **built** (Step 16)
`id, bookingId, tranId(@unique), valId, amount, currency(BDT default), status(INITIATED/SUCCESS/FAILED/CANCELLED/REFUNDED), gatewayPageUrl, sslSessionKey, cardType, bankTranId, paidAt, timestamps` — SSLCommerz integration, mirrors GearUp. One booking can carry many payment attempts; a `SUCCESS` row flips the booking to `PAID`.

### [LATER] Notification
`id, userId, type, message, isRead, timestamps` — booking confirmed/rejected, package approved/rejected
