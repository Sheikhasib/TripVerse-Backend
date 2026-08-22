import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { prisma } from "../src/lib/prisma";
import app from "../src/app";
import {
  BookingStatus,
  NotificationType,
  PackageStatus,
  PaymentStatus,
  PostStatus,
  RefundReasonCategory,
  RefundRequestStatus,
  Role,
  UserStatus,
} from "../generated/prisma/enums";
import {
  registerBooking,
  registerCategory,
  registerContact,
  registerPackage,
  registerPost,
  registerRefundRequest,
  registerUser,
} from "./setup";

export const TEST_PASSWORD = "testpass123";

export const hashPassword = (password: string = TEST_PASSWORD) =>
  bcrypt.hash(password, 10);

// Travel dates are normalized to UTC midnight by the booking service and must
// be >= today (create validation), so tests always pass an ISO date a few days out.
export const futureIso = (daysAhead = 7) =>
  new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

// ── Users ──────────────────────────────────────────────────────────────────
export async function createUser(
  overrides: Partial<{
    name: string;
    email: string;
    password: string;
    role: Role;
    status: UserStatus;
    authProvider: "CREDENTIAL" | "GOOGLE";
    emailVerified: boolean;
    isDeleted: boolean;
    phone: string;
  }> = {},
) {
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `t-${randomUUID()}@test.dev`,
      password: overrides.password
        ? await hashPassword(overrides.password)
        : await hashPassword(),
      phone: overrides.phone ?? "01700000000",
      role: overrides.role ?? Role.USER,
      status: overrides.status ?? UserStatus.ACTIVE,
      authProvider: overrides.authProvider ?? "CREDENTIAL",
      emailVerified: overrides.emailVerified ?? true,
      isDeleted: overrides.isDeleted ?? false,
    },
  });
  registerUser(user.id);
  return user;
}

export async function createAdmin() {
  return createUser({ role: Role.ADMIN });
}

export async function createAgent() {
  return createUser({ role: Role.AGENT });
}

// Authenticates through the real login endpoint (also exercises it) and
// returns the token pair. The rotation ledger rows are cleaned up when the
// user is deleted by cleanupCreated().
export async function loginAs(user: { email: string }) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: user.email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(
      `loginAs failed (${res.status}): ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.data as {
    accessToken: string;
    refreshToken: string;
  };
}

export const bearer = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

// ── Category / package ─────────────────────────────────────────────────────
export async function createCategory() {
  const id = randomUUID();
  const category = await prisma.category.create({
    data: { name: `Category ${id.slice(0, 8)}`, slug: `cat-${id.slice(0, 8)}` },
  });
  registerCategory(category.id);
  return category;
}

export async function createPackage(
  overrides: Partial<{
    agentId: string;
    categoryId: string;
    price: number;
    status: PackageStatus;
    isDeleted: boolean;
    title: string;
    slug: string;
  }> = {},
) {
  const id = randomUUID();
  const tourPackage = await prisma.tourPackage.create({
    data: {
      title: overrides.title ?? `Test Package ${id.slice(0, 8)}`,
      slug: overrides.slug ?? `pkg-${id.slice(0, 8)}`,
      description: "A package created by the test factory.",
      location: "Cox's Bazar",
      price: overrides.price ?? 1000,
      duration: 3,
      images: ["https://example.com/image.jpg"],
      status: overrides.status ?? PackageStatus.APPROVED,
      isDeleted: overrides.isDeleted ?? false,
      categoryId: overrides.categoryId ?? (await createCategory()).id,
      agentId: overrides.agentId ?? (await createAgent()).id,
    },
  });
  registerPackage(tourPackage.id);
  return tourPackage;
}

// ── Booking / payment ──────────────────────────────────────────────────────
export async function createBooking(
  overrides: Partial<{
    userId: string;
    packageId: string;
    travelDate: Date;
    travelers: number;
    totalPrice: number;
    status: BookingStatus;
  }> = {},
) {
  const booking = await prisma.booking.create({
    data: {
      userId: overrides.userId ?? (await createUser()).id,
      packageId: overrides.packageId ?? (await createPackage()).id,
      travelDate:
        overrides.travelDate ?? new Date(futureIso()),
      travelers: overrides.travelers ?? 2,
      totalPrice: overrides.totalPrice ?? 2000,
      status: overrides.status ?? BookingStatus.PENDING,
    },
  });
  registerBooking(booking.id);
  return booking;
}

export async function createPayment(
  bookingId: string,
  overrides: Partial<{
    tranId: string;
    amount: number;
    status: PaymentStatus;
    bankTranId: string | null;
    valId: string | null;
    refundInitiatedAt: Date | null;
    refundCompletedAt: Date | null;
  }> = {},
) {
  return prisma.payment.create({
    data: {
      bookingId,
      tranId: overrides.tranId ?? `TRNX-${randomUUID()}`,
      amount: overrides.amount ?? 2000,
      status: overrides.status ?? PaymentStatus.SUCCESS,
      bankTranId: overrides.bankTranId ?? `BT${randomUUID().slice(0, 12)}`,
      valId: overrides.valId ?? null,
      refundInitiatedAt: overrides.refundInitiatedAt ?? null,
      refundCompletedAt: overrides.refundCompletedAt ?? null,
    },
  });
}

// ── Refund requests ────────────────────────────────────────────────────────
export async function createRefundRequest(
  bookingId: string,
  overrides: Partial<{
    userId: string;
    category: RefundReasonCategory;
    reason: string;
    evidenceUrl: string | null;
    daysBeforeTravel: number;
    suggestedPercentage: number;
    status: RefundRequestStatus;
    approvedPercentage: number | null;
    refundAmount: number | null;
    reviewNote: string | null;
    reviewedById: string | null;
  }> = {},
) {
  const refundRequest = await prisma.refundRequest.create({
    data: {
      bookingId,
      userId:
        overrides.userId ??
        (await prisma.booking.findUniqueOrThrow({
          where: { id: bookingId },
          select: { userId: true },
        })).userId,
      category: overrides.category ?? RefundReasonCategory.CHANGE_OF_PLANS,
      reason: overrides.reason ?? "My travel plans have changed unexpectedly.",
      evidenceUrl: overrides.evidenceUrl ?? null,
      daysBeforeTravel: overrides.daysBeforeTravel ?? 40,
      suggestedPercentage: overrides.suggestedPercentage ?? 90,
      status: overrides.status ?? RefundRequestStatus.PENDING,
      approvedPercentage: overrides.approvedPercentage ?? null,
      refundAmount: overrides.refundAmount ?? null,
      reviewNote: overrides.reviewNote ?? null,
      reviewedById: overrides.reviewedById ?? null,
    },
  });
  registerRefundRequest(refundRequest.id);
  return refundRequest;
}

// ── Wishlist / notification ────────────────────────────────────────────────
export async function createWishlistItem(userId: string, packageId: string) {
  return prisma.wishlistItem.create({ data: { userId, packageId } });
}

export async function createNotification(
  userId: string,
  overrides: Partial<{
    isRead: boolean;
    type: NotificationType;
  }> = {},
) {
  return prisma.notification.create({
    data: {
      userId,
      type: overrides.type ?? NotificationType.BOOKING_CREATED,
      title: "Test notification",
      message: "A notification created by the test factory.",
      isRead: overrides.isRead ?? false,
    },
  });
}

// ── Blog ───────────────────────────────────────────────────────────────────
export async function createPost(
  authorId: string,
  overrides: Partial<{
    status: PostStatus;
    isDeleted: boolean;
    title: string;
    slug: string;
  }> = {},
) {
  const id = randomUUID();
  const post = await prisma.blogPost.create({
    data: {
      title: overrides.title ?? `Test Post ${id.slice(0, 8)}`,
      slug: overrides.slug ?? `post-${id.slice(0, 8)}`,
      excerpt: "A short excerpt.",
      content: "Full blog content from the test factory.",
      coverImage: "https://example.com/cover.jpg",
      status: overrides.status ?? PostStatus.PUBLISHED,
      isDeleted: overrides.isDeleted ?? false,
      authorId,
    },
  });
  registerPost(post.id);
  return post;
}

export async function createComment(
  postId: string,
  userId: string,
  overrides: Partial<{ parentId: string | null; isDeleted: boolean }> = {},
) {
  return prisma.blogComment.create({
    data: {
      content: "A test comment on the post.",
      postId,
      userId,
      parentId: overrides.parentId ?? null,
      isDeleted: overrides.isDeleted ?? false,
    },
  });
}

// ── Contact ────────────────────────────────────────────────────────────────
export async function createContactMessage(
  overrides: Partial<{
    email: string;
    subject: string;
    isResolved: boolean;
  }> = {},
) {
  const message = await prisma.contactMessage.create({
    data: {
      name: "Contact Sender",
      email: overrides.email ?? `contact-${randomUUID()}@test.dev`,
      subject: overrides.subject ?? "Test subject",
      message: "This is a test contact message body.",
      isResolved: overrides.isResolved ?? false,
    },
  });
  registerContact(message.id);
  return message;
}