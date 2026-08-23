-- One LIVE application per booking: a partial unique index. Prisma cannot
-- model partial indexes, so this is raw SQL (kept out of schema.prisma on
-- purpose). PENDING/APPROVED/REFUNDED rows occupy the index; REJECTED rows
-- leave it, which frees exactly one re-application (max 2 lifetime, enforced
-- in refund.service). The service's findFirst check can race a concurrent
-- POST — this index is the real gatekeeper; the service maps the P2002 to 409.
CREATE UNIQUE INDEX "refund_requests_bookingId_live_key" ON "refund_requests"("bookingId") WHERE "status" <> 'REJECTED';
