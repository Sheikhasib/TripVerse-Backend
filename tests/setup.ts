import dotenv from "dotenv";
import type { PrismaClient } from "../generated/prisma/client";

// ── Environment boot (runs BEFORE the test file's imports are evaluated) ──
// NODE_ENV=test turns off the rate limiters (app.ts) and request logging.
// DATABASE_URL is pointed at DATABASE_URL_TEST so the whole app under test —
// config, prisma, every module — connects to the test database. `dotenv` here
// is the explicit call (imports are hoisted, so a side-effect import would load
// .env before these lines ran); config's own dotenv.config() later is a no-op
// because dotenv never overrides already-set vars.
process.env.NODE_ENV = "test";
dotenv.config({ quiet: true });

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    "DATABASE_URL_TEST is required to run the test suite. Add it to .env.",
  );
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

// ── No-truncation cleanup registry ─────────────────────────────────────────
// The suite runs against a shared/live DB, so nothing is ever truncated.
// Factories register every row they create here, and cleanupCreated() deletes
// ONLY those rows — children before parents (the schema uses Prisma's default
// RESTRICT, so a parent can't be deleted while it still has children).
let prisma: PrismaClient | null = null;
const getPrisma = async () => {
  if (!prisma) prisma = (await import("../src/lib/prisma")).prisma;
  return prisma;
};

const userIds: string[] = [];
const packageIds: string[] = [];
const categoryIds: string[] = [];
const bookingIds: string[] = [];
const postIds: string[] = [];
const contactIds: string[] = [];

export const registerUser = (id: string) => userIds.push(id);
export const registerPackage = (id: string) => packageIds.push(id);
export const registerCategory = (id: string) => categoryIds.push(id);
export const registerBooking = (id: string) => bookingIds.push(id);
export const registerPost = (id: string) => postIds.push(id);
export const registerContact = (id: string) => contactIds.push(id);

export const createdIds = {
  get userIds() {
    return [...userIds];
  },
};

// Deletes every row this test file created, bottom-up. Safe against a shared
// DB: every delete is scoped to a UUID the factories minted for this run.
export const cleanupCreated = async () => {
  const db = await getPrisma();

  const userIn = userIds.length ? { in: userIds } : undefined;
  const pkgIn = packageIds.length ? { in: packageIds } : undefined;
  const bookingIn = bookingIds.length ? { in: bookingIds } : undefined;
  const postIn = postIds.length ? { in: postIds } : undefined;

  if (bookingIn) {
    await db.payment.deleteMany({ where: { bookingId: bookingIn } });
    await db.booking.deleteMany({ where: { id: bookingIn } });
  }
  if (userIn || pkgIn) {
    await db.booking.deleteMany({
      where: {
        AND: [
          ...(userIn ? [{ userId: userIn }] : []),
          ...(pkgIn ? [{ packageId: pkgIn }] : []),
        ],
      },
    });
    await db.review.deleteMany({
      where: {
        OR: [
          ...(userIn ? [{ userId: userIn }] : []),
          ...(pkgIn ? [{ packageId: pkgIn }] : []),
        ],
      },
    });
    await db.wishlistItem.deleteMany({
      where: {
        OR: [
          ...(userIn ? [{ userId: userIn }] : []),
          ...(pkgIn ? [{ packageId: pkgIn }] : []),
        ],
      },
    });
  }
  // blog posts created through the API are never registered (only the factory
  // is), so also sweep every post authored by a user we created
  const authored = userIn
    ? (await db.blogPost.findMany({
        where: { authorId: userIn },
        select: { id: true },
      })).map((p) => p.id)
    : [];
  const allPostIds = [...(postIn?.in ?? []), ...authored];
  const allPosts = allPostIds.length ? { in: allPostIds } : undefined;

  if (userIn || allPosts) {
    await db.blogComment.deleteMany({
      where: {
        OR: [
          ...(userIn ? [{ userId: userIn }] : []),
          ...(allPosts ? [{ postId: allPosts }] : []),
        ],
      },
    });
  }
  if (allPosts) {
    await db.blogPost.deleteMany({ where: { id: allPosts } });
  }
  if (userIn) {
    await db.notification.deleteMany({ where: { userId: userIn } });
    await db.refreshToken.deleteMany({ where: { userId: userIn } });
  }
  if (pkgIn) {
    await db.tourPackage.deleteMany({ where: { id: pkgIn } });
  }
  if (userIn) {
    await db.user.deleteMany({ where: { id: userIn } });
  }
  if (categoryIds.length) {
    await db.category.deleteMany({
      where: { id: { in: categoryIds } },
    });
  }
  if (contactIds.length) {
    await db.contactMessage.deleteMany({
      where: { id: { in: contactIds } },
    });
  }
};

// Every file's created rows are deleted when the file finishes.
afterAll(async () => {
  await cleanupCreated();
});