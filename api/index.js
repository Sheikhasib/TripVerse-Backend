var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/app.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

// src/config/index.ts
import dotenv from "dotenv";
import path from "path";
import { z } from "zod";
dotenv.config({
  quiet: true,
  path: path.join(process.cwd(), ".env")
});
var envSchema = z.object({
  PORT: z.string().default("4000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Frontend origins for CORS + payment redirects. The frontend may not be
  // deployed yet (or may be rebuilt), so both are optional: the backend must
  // never refuse to boot just because a UI host isn't live. Routes that need a
  // real origin (payment callback redirects) fall back to the backend URL.
  FRONTEND_URL_DEV: z.string().url().optional(),
  FRONTEND_URL_PROD: z.string().url().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BCRYPT_SALT_ROUNDS: z.string().default("10"),
  // Optional admin credentials used by the seed script (Step 13). Falls back
  // to demo-admin@tripverse.com / demo123 when unset.
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(1).optional(),
  // SSLCommerz (Step 16) — sandbox store creds until go-live. SSL_COMMERZ_SANDBOX
  // picks the sandbox vs live API base URL. Optional so the API boots (health,
  // auth, catalog, etc.) even when the payment store isn't configured yet — the
  // payment endpoints then fail with a clean "not configured" error instead of
  // taking the whole deployment down.
  SSL_COMMERZ_STORE_ID: z.string().optional(),
  SSL_COMMERZ_STORE_PASSWORD: z.string().optional(),
  SSL_COMMERZ_SANDBOX: z.string().default("true"),
  // Optional explicit gateway/validator base URLs (GearUp pattern). Defaults are
  // derived from SSL_COMMERZ_SANDBOX when absent.
  SSLCOMMERZ_INIT_URL: z.string().url().optional(),
  SSLCOMMERZ_VALIDATE_URL: z.string().url().optional(),
  SSLCOMMERZ_REFUND_URL: z.string().url().optional(),
  // Publicly reachable base URL the payment module uses to build the
  // SSLCommerz success/fail/cancel/IPN callback URLs. Must NOT be localhost in
  // sandbox — the gateway POSTs to these server-to-server. Optional like the
  // store creds above (payment-only).
  BACKEND_PUBLIC_URL: z.string().url().optional(),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("1d"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  // Google OAuth is optional — server boots without it; /api/auth/google
  // returns a clean 400 until GOOGLE_CLIENT_ID is configured.
  GOOGLE_CLIENT_ID: z.string().optional(),
  // Best-effort contact emails (Resend) — always optional; submissions
  // succeed and emails become no-ops when these are missing.
  RESEND_API_KEY: z.string().optional(),
  CONTACT_RECEIVER_EMAIL: z.string().email().optional(),
  EMAIL_FROM: z.string().optional(),
  // Email verification + password reset (Step 21) — Redis OTP store + Nodemailer.
  // All optional so the app boots without them (e.g. Vercel prod); the auth
  // endpoints then respond with a clean 503 "not configured" instead of crashing.
  REDIS_USER: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required")
});
var parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("\u274C Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}
var env = parsed.data;
var config = {
  port: env.PORT,
  node_env: env.NODE_ENV,
  // Frontend origins for CORS + payment redirects. Localhost always wins for
  // local testing; production uses the Vercel frontend URL, falling back to the
  // backend URL so the API stays reachable even before the UI is deployed.
  frontend_url_dev: env.FRONTEND_URL_DEV || "http://localhost:3000",
  frontend_url_prod: env.FRONTEND_URL_PROD || env.BACKEND_PUBLIC_URL || "",
  database_url: env.DATABASE_URL,
  bcrypt_salt_rounds: env.BCRYPT_SALT_ROUNDS,
  admin_email: env.ADMIN_EMAIL,
  admin_password: env.ADMIN_PASSWORD,
  ssl_commerz_store_id: env.SSL_COMMERZ_STORE_ID,
  ssl_commerz_store_password: env.SSL_COMMERZ_STORE_PASSWORD,
  ssl_commerz_sandbox: env.SSL_COMMERZ_SANDBOX === "true",
  // sandbox base URLs (fallback when the explicit override vars are absent)
  sslcommerz_init_url: env.SSLCOMMERZ_INIT_URL ?? (env.SSL_COMMERZ_SANDBOX === "true" ? "https://sandbox.sslcommerz.com/gwprocess/v4/api.php" : "https://securepay.sslcommerz.com/gwprocess/v4/api.php"),
  sslcommerz_validate_url: env.SSLCOMMERZ_VALIDATE_URL ?? (env.SSL_COMMERZ_SANDBOX === "true" ? "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php" : "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php"),
  sslcommerz_refund_url: env.SSLCOMMERZ_REFUND_URL ?? (env.SSL_COMMERZ_SANDBOX === "true" ? "https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php" : "https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php"),
  backend_public_url: env.BACKEND_PUBLIC_URL,
  jwt_access_secret: env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: env.JWT_REFRESH_SECRET,
  jwt_access_expires_in: env.JWT_ACCESS_EXPIRES_IN,
  jwt_refresh_expires_in: env.JWT_REFRESH_EXPIRES_IN,
  google_client_id: env.GOOGLE_CLIENT_ID,
  resend_api_key: env.RESEND_API_KEY,
  contact_receiver_email: env.CONTACT_RECEIVER_EMAIL,
  email_from: env.EMAIL_FROM,
  // Email verification + password reset (Step 21)
  redis_user: env.REDIS_USER,
  redis_password: env.REDIS_PASSWORD,
  redis_host: env.REDIS_HOST,
  redis_port: env.REDIS_PORT,
  smtp_user: env.SMTP_USER,
  smtp_password: env.SMTP_PASSWORD,
  cloudinary_cloud_name: env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: env.CLOUDINARY_API_SECRET
};
var config_default = config;

// src/middleware/notFound.ts
var notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: "Route not found",
    path: req.originalUrl,
    date: /* @__PURE__ */ new Date()
  });
};
var notFound_default = notFoundHandler;

// src/middleware/globalErrorHandler.ts
import httpStatus from "http-status";
import multer from "multer";
import { ZodError } from "zod";

// generated/prisma/client.ts
import * as path2 from "node:path";
import { fileURLToPath } from "node:url";

// generated/prisma/internal/class.ts
import * as runtime from "@prisma/client/runtime/client";
var config2 = {
  "previewFeatures": [],
  "clientVersion": "7.9.1",
  "engineVersion": "e922089b7d7502aff4249d5da3420f6fa55fc6ad",
  "activeProvider": "postgresql",
  "inlineSchema": 'model BlogComment {\n  id        String  @id @default(uuid())\n  content   String  @db.Text\n  isDeleted Boolean @default(false)\n\n  postId   String\n  userId   String\n  parentId String?\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  post    BlogPost      @relation("PostComments", fields: [postId], references: [id])\n  user    User          @relation("UserComments", fields: [userId], references: [id])\n  parent  BlogComment?  @relation("CommentReplies", fields: [parentId], references: [id])\n  replies BlogComment[] @relation("CommentReplies")\n\n  @@index([postId, isDeleted, createdAt])\n  @@index([parentId])\n  @@map("blog_comments")\n}\n\nmodel BlogPost {\n  id         String     @id @default(uuid())\n  title      String\n  slug       String     @unique\n  excerpt    String\n  content    String\n  coverImage String\n  status     PostStatus @default(DRAFT)\n  isDeleted  Boolean    @default(false)\n\n  authorId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  author   User          @relation("AuthorPosts", fields: [authorId], references: [id])\n  comments BlogComment[] @relation("PostComments")\n\n  @@index([status])\n  @@index([authorId])\n  @@map("blog_posts")\n}\n\nmodel Booking {\n  id         String        @id @default(uuid())\n  travelDate DateTime\n  travelers  Int\n  totalPrice Decimal       @db.Decimal(10, 2)\n  status     BookingStatus @default(PENDING)\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user     User        @relation("CustomerBookings", fields: [userId], references: [id])\n  package  TourPackage @relation(fields: [packageId], references: [id])\n  payments Payment[]\n\n  @@index([userId])\n  @@index([packageId])\n  @@index([status])\n  @@index([userId, packageId, travelDate])\n  @@map("bookings")\n}\n\nmodel Category {\n  id   String @id @default(uuid())\n  name String @unique\n  slug String @unique\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages TourPackage[]\n\n  @@map("categories")\n}\n\nmodel ContactMessage {\n  id         String  @id @default(uuid())\n  name       String\n  email      String\n  subject    String\n  message    String\n  isResolved Boolean @default(false)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@index([isResolved])\n  @@map("contact_messages")\n}\n\nenum Role {\n  USER\n  AGENT\n  ADMIN\n}\n\nenum UserStatus {\n  ACTIVE\n  SUSPENDED\n}\n\nenum AuthProvider {\n  CREDENTIAL\n  GOOGLE\n}\n\nenum PackageStatus {\n  PENDING\n  APPROVED\n  REJECTED\n}\n\nenum BookingStatus {\n  PENDING\n  PAID\n  CONFIRMED\n  CANCELLED\n  COMPLETED\n}\n\nenum PaymentStatus {\n  INITIATED\n  SUCCESS\n  FAILED\n  CANCELLED\n  REFUNDED\n}\n\nenum PostStatus {\n  DRAFT\n  PUBLISHED\n}\n\nenum NotificationType {\n  BOOKING_CREATED\n  BOOKING_CONFIRMED\n  BOOKING_CANCELLED\n  PACKAGE_APPROVED\n  PACKAGE_REJECTED\n}\n\nmodel Notification {\n  id      String           @id @default(uuid())\n  userId  String\n  type    NotificationType\n  title   String\n  message String\n  link    String?\n  isRead  Boolean          @default(false)\n\n  createdAt DateTime @default(now())\n\n  user User @relation(fields: [userId], references: [id])\n\n  @@index([userId, isRead, createdAt])\n  @@map("notifications")\n}\n\nmodel Payment {\n  id                String        @id @default(uuid())\n  bookingId         String\n  tranId            String        @unique // SSLCommerz transaction id, generated server-side\n  valId             String? // set after gateway success, used for server-side validation\n  amount            Decimal       @db.Decimal(10, 2) // = booking.totalPrice at session creation\n  currency          String        @default("BDT")\n  status            PaymentStatus @default(INITIATED)\n  gatewayPageUrl    String?\n  sslSessionKey     String?\n  cardType          String?\n  bankTranId        String?\n  paidAt            DateTime?\n  refundRefId       String? // SSLCommerz refund reference (set when a refund is initiated)\n  refundInitiatedAt DateTime? // set when a refund attempt starts/fails (for later retry)\n  refundCompletedAt DateTime? // set only when the gateway confirms the refund succeeded\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  booking Booking @relation(fields: [bookingId], references: [id])\n\n  @@index([bookingId])\n  @@index([status])\n  @@map("payments")\n}\n\nmodel RefreshToken {\n  id        String    @id @default(uuid())\n  userId    String\n  hash      String    @unique // SHA-256 of the refresh JWT \u2014 never store the JWT itself\n  expiresAt DateTime\n  createdAt DateTime  @default(now())\n  revokedAt DateTime? // set when rotated or logged out\n\n  user User @relation(fields: [userId], references: [id])\n\n  @@index([userId, revokedAt])\n  @@map("refresh_tokens")\n}\n\nmodel Review {\n  id        String  @id @default(uuid())\n  rating    Int\n  comment   String\n  isDeleted Boolean @default(false)\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user    User        @relation("CustomerReviews", fields: [userId], references: [id])\n  package TourPackage @relation(fields: [packageId], references: [id])\n\n  @@unique([userId, packageId])\n  @@index([packageId])\n  @@map("reviews")\n}\n\n// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../../generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\nmodel TourPackage {\n  id          String        @id @default(uuid())\n  title       String\n  slug        String        @unique\n  description String\n  location    String\n  price       Decimal       @db.Decimal(10, 2)\n  duration    Int\n  rating      Float         @default(0)\n  images      String[]\n  status      PackageStatus @default(PENDING)\n  isDeleted   Boolean       @default(false)\n\n  categoryId String\n  agentId    String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  category      Category       @relation(fields: [categoryId], references: [id])\n  agent         User           @relation("AgentPackages", fields: [agentId], references: [id])\n  bookings      Booking[]\n  reviews       Review[]\n  wishlistItems WishlistItem[]\n\n  @@index([categoryId])\n  @@index([categoryId, price])\n  @@index([price])\n  @@index([status])\n  @@map("tour_packages")\n}\n\nmodel User {\n  id            String       @id @default(uuid())\n  name          String\n  email         String       @unique\n  password      String?\n  googleId      String?      @unique\n  phone         String?\n  avatarUrl     String?\n  role          Role         @default(USER)\n  status        UserStatus   @default(ACTIVE)\n  authProvider  AuthProvider @default(CREDENTIAL)\n  emailVerified Boolean      @default(false)\n  isDeleted     Boolean      @default(false)\n  tokenVersion  Int          @default(0)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages      TourPackage[]  @relation("AgentPackages")\n  bookings      Booking[]      @relation("CustomerBookings")\n  reviews       Review[]       @relation("CustomerReviews")\n  posts         BlogPost[]     @relation("AuthorPosts")\n  wishlist      WishlistItem[]\n  notifications Notification[]\n  comments      BlogComment[]  @relation("UserComments")\n  refreshTokens RefreshToken[]\n\n  @@index([role])\n  @@index([status])\n  @@map("users")\n}\n\nmodel WishlistItem {\n  id        String @id @default(uuid())\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n\n  user    User        @relation(fields: [userId], references: [id])\n  package TourPackage @relation(fields: [packageId], references: [id])\n\n  @@unique([userId, packageId])\n  @@index([userId, createdAt])\n  @@map("wishlist_items")\n}\n',
  "runtimeDataModel": {
    "models": {},
    "enums": {},
    "types": {}
  },
  "parameterizationSchema": {
    "strings": [],
    "graph": ""
  }
};
config2.runtimeDataModel = JSON.parse('{"models":{"BlogComment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"postId","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"parentId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"post","kind":"object","type":"BlogPost","relationName":"PostComments"},{"name":"user","kind":"object","type":"User","relationName":"UserComments"},{"name":"parent","kind":"object","type":"BlogComment","relationName":"CommentReplies"},{"name":"replies","kind":"object","type":"BlogComment","relationName":"CommentReplies"}],"dbName":"blog_comments"},"BlogPost":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"excerpt","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"coverImage","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PostStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"authorId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"author","kind":"object","type":"User","relationName":"AuthorPosts"},{"name":"comments","kind":"object","type":"BlogComment","relationName":"PostComments"}],"dbName":"blog_posts"},"Booking":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"travelDate","kind":"scalar","type":"DateTime"},{"name":"travelers","kind":"scalar","type":"Int"},{"name":"totalPrice","kind":"scalar","type":"Decimal"},{"name":"status","kind":"enum","type":"BookingStatus"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerBookings"},{"name":"package","kind":"object","type":"TourPackage","relationName":"BookingToTourPackage"},{"name":"payments","kind":"object","type":"Payment","relationName":"BookingToPayment"}],"dbName":"bookings"},"Category":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"CategoryToTourPackage"}],"dbName":"categories"},"ContactMessage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"isResolved","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"contact_messages"},"Notification":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"type","kind":"enum","type":"NotificationType"},{"name":"title","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"link","kind":"scalar","type":"String"},{"name":"isRead","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"NotificationToUser"}],"dbName":"notifications"},"Payment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"bookingId","kind":"scalar","type":"String"},{"name":"tranId","kind":"scalar","type":"String"},{"name":"valId","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Decimal"},{"name":"currency","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PaymentStatus"},{"name":"gatewayPageUrl","kind":"scalar","type":"String"},{"name":"sslSessionKey","kind":"scalar","type":"String"},{"name":"cardType","kind":"scalar","type":"String"},{"name":"bankTranId","kind":"scalar","type":"String"},{"name":"paidAt","kind":"scalar","type":"DateTime"},{"name":"refundRefId","kind":"scalar","type":"String"},{"name":"refundInitiatedAt","kind":"scalar","type":"DateTime"},{"name":"refundCompletedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"booking","kind":"object","type":"Booking","relationName":"BookingToPayment"}],"dbName":"payments"},"RefreshToken":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"hash","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"revokedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"RefreshTokenToUser"}],"dbName":"refresh_tokens"},"Review":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"rating","kind":"scalar","type":"Int"},{"name":"comment","kind":"scalar","type":"String"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerReviews"},{"name":"package","kind":"object","type":"TourPackage","relationName":"ReviewToTourPackage"}],"dbName":"reviews"},"TourPackage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"location","kind":"scalar","type":"String"},{"name":"price","kind":"scalar","type":"Decimal"},{"name":"duration","kind":"scalar","type":"Int"},{"name":"rating","kind":"scalar","type":"Float"},{"name":"images","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PackageStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"categoryId","kind":"scalar","type":"String"},{"name":"agentId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"category","kind":"object","type":"Category","relationName":"CategoryToTourPackage"},{"name":"agent","kind":"object","type":"User","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"BookingToTourPackage"},{"name":"reviews","kind":"object","type":"Review","relationName":"ReviewToTourPackage"},{"name":"wishlistItems","kind":"object","type":"WishlistItem","relationName":"TourPackageToWishlistItem"}],"dbName":"tour_packages"},"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"googleId","kind":"scalar","type":"String"},{"name":"phone","kind":"scalar","type":"String"},{"name":"avatarUrl","kind":"scalar","type":"String"},{"name":"role","kind":"enum","type":"Role"},{"name":"status","kind":"enum","type":"UserStatus"},{"name":"authProvider","kind":"enum","type":"AuthProvider"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"tokenVersion","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"CustomerBookings"},{"name":"reviews","kind":"object","type":"Review","relationName":"CustomerReviews"},{"name":"posts","kind":"object","type":"BlogPost","relationName":"AuthorPosts"},{"name":"wishlist","kind":"object","type":"WishlistItem","relationName":"UserToWishlistItem"},{"name":"notifications","kind":"object","type":"Notification","relationName":"NotificationToUser"},{"name":"comments","kind":"object","type":"BlogComment","relationName":"UserComments"},{"name":"refreshTokens","kind":"object","type":"RefreshToken","relationName":"RefreshTokenToUser"}],"dbName":"users"},"WishlistItem":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"UserToWishlistItem"},{"name":"package","kind":"object","type":"TourPackage","relationName":"TourPackageToWishlistItem"}],"dbName":"wishlist_items"}},"enums":{},"types":{}}');
config2.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","packages","_count","category","agent","user","package","booking","payments","bookings","reviews","wishlistItems","posts","wishlist","notifications","comments","refreshTokens","author","post","parent","replies","BlogComment.findUnique","BlogComment.findUniqueOrThrow","BlogComment.findFirst","BlogComment.findFirstOrThrow","BlogComment.findMany","data","BlogComment.createOne","BlogComment.createMany","BlogComment.createManyAndReturn","BlogComment.updateOne","BlogComment.updateMany","BlogComment.updateManyAndReturn","create","update","BlogComment.upsertOne","BlogComment.deleteOne","BlogComment.deleteMany","having","_min","_max","BlogComment.groupBy","BlogComment.aggregate","BlogPost.findUnique","BlogPost.findUniqueOrThrow","BlogPost.findFirst","BlogPost.findFirstOrThrow","BlogPost.findMany","BlogPost.createOne","BlogPost.createMany","BlogPost.createManyAndReturn","BlogPost.updateOne","BlogPost.updateMany","BlogPost.updateManyAndReturn","BlogPost.upsertOne","BlogPost.deleteOne","BlogPost.deleteMany","BlogPost.groupBy","BlogPost.aggregate","Booking.findUnique","Booking.findUniqueOrThrow","Booking.findFirst","Booking.findFirstOrThrow","Booking.findMany","Booking.createOne","Booking.createMany","Booking.createManyAndReturn","Booking.updateOne","Booking.updateMany","Booking.updateManyAndReturn","Booking.upsertOne","Booking.deleteOne","Booking.deleteMany","_avg","_sum","Booking.groupBy","Booking.aggregate","Category.findUnique","Category.findUniqueOrThrow","Category.findFirst","Category.findFirstOrThrow","Category.findMany","Category.createOne","Category.createMany","Category.createManyAndReturn","Category.updateOne","Category.updateMany","Category.updateManyAndReturn","Category.upsertOne","Category.deleteOne","Category.deleteMany","Category.groupBy","Category.aggregate","ContactMessage.findUnique","ContactMessage.findUniqueOrThrow","ContactMessage.findFirst","ContactMessage.findFirstOrThrow","ContactMessage.findMany","ContactMessage.createOne","ContactMessage.createMany","ContactMessage.createManyAndReturn","ContactMessage.updateOne","ContactMessage.updateMany","ContactMessage.updateManyAndReturn","ContactMessage.upsertOne","ContactMessage.deleteOne","ContactMessage.deleteMany","ContactMessage.groupBy","ContactMessage.aggregate","Notification.findUnique","Notification.findUniqueOrThrow","Notification.findFirst","Notification.findFirstOrThrow","Notification.findMany","Notification.createOne","Notification.createMany","Notification.createManyAndReturn","Notification.updateOne","Notification.updateMany","Notification.updateManyAndReturn","Notification.upsertOne","Notification.deleteOne","Notification.deleteMany","Notification.groupBy","Notification.aggregate","Payment.findUnique","Payment.findUniqueOrThrow","Payment.findFirst","Payment.findFirstOrThrow","Payment.findMany","Payment.createOne","Payment.createMany","Payment.createManyAndReturn","Payment.updateOne","Payment.updateMany","Payment.updateManyAndReturn","Payment.upsertOne","Payment.deleteOne","Payment.deleteMany","Payment.groupBy","Payment.aggregate","RefreshToken.findUnique","RefreshToken.findUniqueOrThrow","RefreshToken.findFirst","RefreshToken.findFirstOrThrow","RefreshToken.findMany","RefreshToken.createOne","RefreshToken.createMany","RefreshToken.createManyAndReturn","RefreshToken.updateOne","RefreshToken.updateMany","RefreshToken.updateManyAndReturn","RefreshToken.upsertOne","RefreshToken.deleteOne","RefreshToken.deleteMany","RefreshToken.groupBy","RefreshToken.aggregate","Review.findUnique","Review.findUniqueOrThrow","Review.findFirst","Review.findFirstOrThrow","Review.findMany","Review.createOne","Review.createMany","Review.createManyAndReturn","Review.updateOne","Review.updateMany","Review.updateManyAndReturn","Review.upsertOne","Review.deleteOne","Review.deleteMany","Review.groupBy","Review.aggregate","TourPackage.findUnique","TourPackage.findUniqueOrThrow","TourPackage.findFirst","TourPackage.findFirstOrThrow","TourPackage.findMany","TourPackage.createOne","TourPackage.createMany","TourPackage.createManyAndReturn","TourPackage.updateOne","TourPackage.updateMany","TourPackage.updateManyAndReturn","TourPackage.upsertOne","TourPackage.deleteOne","TourPackage.deleteMany","TourPackage.groupBy","TourPackage.aggregate","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","User.upsertOne","User.deleteOne","User.deleteMany","User.groupBy","User.aggregate","WishlistItem.findUnique","WishlistItem.findUniqueOrThrow","WishlistItem.findFirst","WishlistItem.findFirstOrThrow","WishlistItem.findMany","WishlistItem.createOne","WishlistItem.createMany","WishlistItem.createManyAndReturn","WishlistItem.updateOne","WishlistItem.updateMany","WishlistItem.updateManyAndReturn","WishlistItem.upsertOne","WishlistItem.deleteOne","WishlistItem.deleteMany","WishlistItem.groupBy","WishlistItem.aggregate","AND","OR","NOT","id","userId","packageId","createdAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","name","email","password","googleId","phone","avatarUrl","Role","role","UserStatus","status","AuthProvider","authProvider","emailVerified","isDeleted","tokenVersion","updatedAt","every","some","none","title","slug","description","location","price","duration","rating","images","PackageStatus","categoryId","agentId","has","hasEvery","hasSome","comment","hash","expiresAt","revokedAt","bookingId","tranId","valId","amount","currency","PaymentStatus","gatewayPageUrl","sslSessionKey","cardType","bankTranId","paidAt","refundRefId","refundInitiatedAt","refundCompletedAt","NotificationType","type","message","link","isRead","subject","isResolved","travelDate","travelers","totalPrice","BookingStatus","excerpt","content","coverImage","PostStatus","authorId","postId","parentId","userId_packageId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","push","increment","decrement","multiply","divide"]'),
  graph: "wAZxwAEPBwAAoQMAIBQAAKMDACAVAACkAwAgFgAA-QIAIN8BAACiAwAw4AEAACgAEOEBAACiAwAw4gEBAAAAAeMBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhsAIBAOsCACG0AgEA6wIAIbUCAQDsAgAhAQAAAAEAIBcFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIQUFAADmBQAgBgAA4AUAIAsAAJ4FACAMAACfBQAgDQAAoQUAIBcFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAAAAAeUBQADyAgAh-gEAALcDjQIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAAAAAYYCAQDrAgAhhwIBAOsCACGIAhAArwMAIYkCAgDxAgAhigIIALYDACGLAgAA_gIAII0CAQDrAgAhjgIBAOsCACEDAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAEAAAADACAPBwAAoQMAIAgAAKsDACAKAAC0AwAg3wEAALIDADDgAQAACQAQ4QEAALIDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA68CIoACQADyAgAhqwJAAPICACGsAgIA8QIAIa0CEACvAwAhAwcAAOAFACAIAADjBQAgCgAA5QUAIA8HAAChAwAgCAAAqwMAIAoAALQDACDfAQAAsgMAMOABAAAJABDhAQAAsgMAMOIBAQAAAAHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH6AQAAswOvAiKAAkAA8gIAIasCQADyAgAhrAICAPECACGtAhAArwMAIQMAAAAJACABAAAKADACAAALACAVCQAAsQMAIN8BAACuAwAw4AEAAA0AEOEBAACuAwAw4gEBAOsCACHlAUAA8gIAIfoBAACwA5wCIoACQADyAgAhlgIBAOsCACGXAgEA6wIAIZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhowJAAKADACEKCQAA5AUAIJgCAADCAwAgnAIAAMIDACCdAgAAwgMAIJ4CAADCAwAgnwIAAMIDACCgAgAAwgMAIKECAADCAwAgogIAAMIDACCjAgAAwgMAIBUJAACxAwAg3wEAAK4DADDgAQAADQAQ4QEAAK4DADDiAQEAAAAB5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAAAAAZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhowJAAKADACEDAAAADQAgAQAADgAwAgAADwAgAQAAAA0AIA0HAAChAwAgCAAAqwMAIN8BAACtAwAw4AEAABIAEOEBAACtAwAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhigICAPECACGSAgEA6wIAIQIHAADgBQAgCAAA4wUAIA4HAAChAwAgCAAAqwMAIN8BAACtAwAw4AEAABIAEOEBAACtAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhtgIAAKwDACADAAAAEgAgAQAAEwAwAgAAFAAgCQcAAKEDACAIAACrAwAg3wEAAKoDADDgAQAAFgAQ4QEAAKoDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIQIHAADgBQAgCAAA4wUAIAoHAAChAwAgCAAAqwMAIN8BAACqAwAw4AEAABYAEOEBAACqAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIbYCAACpAwAgAwAAABYAIAEAABcAMAIAABgAIAEAAAAJACABAAAAEgAgAQAAABYAIAMAAAAJACABAAAKADACAAALACADAAAAEgAgAQAAEwAwAgAAFAAgEBEAAPkCACATAAChAwAg3wEAAKcDADDgAQAAHwAQ4QEAAKcDADDiAQEA6wIAIeUBQADyAgAh-gEAAKgDswIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAOsCACGvAgEA6wIAIbACAQDrAgAhsQIBAOsCACGzAgEA6wIAIQIRAACjBQAgEwAA4AUAIBARAAD5AgAgEwAAoQMAIN8BAACnAwAw4AEAAB8AEOEBAACnAwAw4gEBAAAAAeUBQADyAgAh-gEAAKgDswIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAAAAAa8CAQDrAgAhsAIBAOsCACGxAgEA6wIAIbMCAQDrAgAhAwAAAB8AIAEAACAAMAIAACEAIAMAAAAWACABAAAXADACAAAYACAMBwAAoQMAIN8BAAClAwAw4AEAACQAEOEBAAClAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAhhAIBAOsCACGlAgAApgOlAiKmAgEA6wIAIacCAQDsAgAhqAIgAPACACECBwAA4AUAIKcCAADCAwAgDAcAAKEDACDfAQAApQMAMOABAAAkABDhAQAApQMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhhAIBAOsCACGlAgAApgOlAiKmAgEA6wIAIacCAQDsAgAhqAIgAPACACEDAAAAJAAgAQAAJQAwAgAAJgAgDwcAAKEDACAUAACjAwAgFQAApAMAIBYAAPkCACDfAQAAogMAMOABAAAoABDhAQAAogMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGwAgEA6wIAIbQCAQDrAgAhtQIBAOwCACEFBwAA4AUAIBQAAOEFACAVAADiBQAgFgAAowUAILUCAADCAwAgAwAAACgAIAEAACkAMAIAAAEAIAoHAAChAwAg3wEAAJ8DADDgAQAAKwAQ4QEAAJ8DADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACGTAgEA6wIAIZQCQADyAgAhlQJAAKADACECBwAA4AUAIJUCAADCAwAgCgcAAKEDACDfAQAAnwMAMOABAAArABDhAQAAnwMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhkwIBAAAAAZQCQADyAgAhlQJAAKADACEDAAAAKwAgAQAALAAwAgAALQAgAQAAAAMAIAEAAAAJACABAAAAEgAgAQAAAB8AIAEAAAAWACABAAAAJAAgAQAAACgAIAEAAAArACADAAAAKAAgAQAAKQAwAgAAAQAgAQAAACgAIAEAAAAoACADAAAAKAAgAQAAKQAwAgAAAQAgAQAAACgAIAEAAAABACADAAAAKAAgAQAAKQAwAgAAAQAgAwAAACgAIAEAACkAMAIAAAEAIAMAAAAoACABAAApADACAAABACAMBwAA_AMAIBQAAPsDACAVAAD_AwAgFgAA_QMAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABsAIBAAAAAbQCAQAAAAG1AgEAAAABARwAAEAAIAjiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG0AgEAAAABtQIBAAAAAQEcAABCADABHAAAQgAwAQAAACgAIAwHAAD5AwAgFAAA7gMAIBUAAO8DACAWAADwAwAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIbACAQC8AwAhtAIBALwDACG1AgEAyAMAIQIAAAABACAcAABGACAI4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIbACAQC8AwAhtAIBALwDACG1AgEAyAMAIQIAAAAoACAcAABIACACAAAAKAAgHAAASAAgAQAAACgAIAMAAAABACAjAABAACAkAABGACABAAAAAQAgAQAAACgAIAQEAADdBQAgKQAA3wUAICoAAN4FACC1AgAAwgMAIAvfAQAAngMAMOABAABQABDhAQAAngMAMOIBAQDPAgAh4wEBAM8CACHlAUAA0AIAIf4BIADbAgAhgAJAANACACGwAgEAzwIAIbQCAQDPAgAhtQIBANcCACEDAAAAKAAgAQAATwAwKAAAUAAgAwAAACgAIAEAACkAMAIAAAEAIAEAAAAhACABAAAAIQAgAwAAAB8AIAEAACAAMAIAACEAIAMAAAAfACABAAAgADACAAAhACADAAAAHwAgAQAAIAAwAgAAIQAgDREAALAEACATAADcBQAg4gEBAAAAAeUBQAAAAAH6AQAAALMCAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGvAgEAAAABsAIBAAAAAbECAQAAAAGzAgEAAAABARwAAFgAIAviAQEAAAAB5QFAAAAAAfoBAAAAswIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAa8CAQAAAAGwAgEAAAABsQIBAAAAAbMCAQAAAAEBHAAAWgAwARwAAFoAMA0RAAClBAAgEwAA2wUAIOIBAQC8AwAh5QFAAL0DACH6AQAAowSzAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIa8CAQC8AwAhsAIBALwDACGxAgEAvAMAIbMCAQC8AwAhAgAAACEAIBwAAF0AIAviAQEAvAMAIeUBQAC9AwAh-gEAAKMEswIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGvAgEAvAMAIbACAQC8AwAhsQIBALwDACGzAgEAvAMAIQIAAAAfACAcAABfACACAAAAHwAgHAAAXwAgAwAAACEAICMAAFgAICQAAF0AIAEAAAAhACABAAAAHwAgAwQAANgFACApAADaBQAgKgAA2QUAIA7fAQAAmgMAMOABAABmABDhAQAAmgMAMOIBAQDPAgAh5QFAANACACH6AQAAmwOzAiL-ASAA2wIAIYACQADQAgAhhAIBAM8CACGFAgEAzwIAIa8CAQDPAgAhsAIBAM8CACGxAgEAzwIAIbMCAQDPAgAhAwAAAB8AIAEAAGUAMCgAAGYAIAMAAAAfACABAAAgADACAAAhACABAAAACwAgAQAAAAsAIAMAAAAJACABAAAKADACAAALACADAAAACQAgAQAACgAwAgAACwAgAwAAAAkAIAEAAAoAMAIAAAsAIAwHAACOBQAgCAAA3AQAIAoAAN0EACDiAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACvAgKAAkAAAAABqwJAAAAAAawCAgAAAAGtAhAAAAABARwAAG4AIAniAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACvAgKAAkAAAAABqwJAAAAAAawCAgAAAAGtAhAAAAABARwAAHAAMAEcAABwADAMBwAAjAUAIAgAAMwEACAKAADNBAAg4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSvAiKAAkAAvQMAIasCQAC9AwAhrAICAM0DACGtAhAAyQQAIQIAAAALACAcAABzACAJ4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSvAiKAAkAAvQMAIasCQAC9AwAhrAICAM0DACGtAhAAyQQAIQIAAAAJACAcAAB1ACACAAAACQAgHAAAdQAgAwAAAAsAICMAAG4AICQAAHMAIAEAAAALACABAAAACQAgBQQAANMFACApAADWBQAgKgAA1QUAIEsAANQFACBMAADXBQAgDN8BAACWAwAw4AEAAHwAEOEBAACWAwAw4gEBAM8CACHjAQEAzwIAIeQBAQDPAgAh5QFAANACACH6AQAAlwOvAiKAAkAA0AIAIasCQADQAgAhrAICANwCACGtAhAA_AIAIQMAAAAJACABAAB7ADAoAAB8ACADAAAACQAgAQAACgAwAgAACwAgCQMAAPMCACDfAQAAlQMAMOABAACCAQAQ4QEAAJUDADDiAQEAAAAB5QFAAPICACHxAQEAAAABgAJAAPICACGFAgEAAAABAQAAAH8AIAEAAAB_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_AIAIZoCAQDPAgAhnAIBANcCACGdAgEA1wIAIZ4CAQDXAgAhnwIBANcCACGgAkAAhwMAIaECAQDXAgAhogJAAIcDACGjAkAAhwMAIQMAAAANACABAADZAQAwKAAA2gEAIAMAAAANACABAAAOADACAAAPACABAAAALQAgAQAAAC0AIAMAAAArACABAAAsADACAAAtACADAAAAKwAgAQAALAAwAgAALQAgAwAAACsAIAEAACwAMAIAAC0AIAcHAAC1BQAg4gEBAAAAAeMBAQAAAAHlAUAAAAABkwIBAAAAAZQCQAAAAAGVAkAAAAABARwAAOIBACAG4gEBAAAAAeMBAQAAAAHlAUAAAAABkwIBAAAAAZQCQAAAAAGVAkAAAAABARwAAOQBADABHAAA5AEAMAcHAAC0BQAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAhkwIBALwDACGUAkAAvQMAIZUCQADgAwAhAgAAAC0AIBwAAOcBACAG4gEBALwDACHjAQEAvAMAIeUBQAC9AwAhkwIBALwDACGUAkAAvQMAIZUCQADgAwAhAgAAACsAIBwAAOkBACACAAAAKwAgHAAA6QEAIAMAAAAtACAjAADiAQAgJAAA5wEAIAEAAAAtACABAAAAKwAgBAQAALEFACApAACzBQAgKgAAsgUAIJUCAADCAwAgCd8BAACGAwAw4AEAAPABABDhAQAAhgMAMOIBAQDPAgAh4wEBAM8CACHlAUAA0AIAIZMCAQDPAgAhlAJAANACACGVAkAAhwMAIQMAAAArACABAADvAQAwKAAA8AEAIAMAAAArACABAAAsADACAAAtACABAAAAFAAgAQAAABQAIAMAAAASACABAAATADACAAAUACADAAAAEgAgAQAAEwAwAgAAFAAgAwAAABIAIAEAABMAMAIAABQAIAoHAACDBQAgCAAAvgQAIOIBAQAAAAHjAQEAAAAB5AEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAYoCAgAAAAGSAgEAAAABARwAAPgBACAI4gEBAAAAAeMBAQAAAAHkAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABigICAAAAAZICAQAAAAEBHAAA-gEAMAEcAAD6AQAwCgcAAIEFACAIAAC8BAAg4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhigICAM0DACGSAgEAvAMAIQIAAAAUACAcAAD9AQAgCOIBAQC8AwAh4wEBALwDACHkAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIYoCAgDNAwAhkgIBALwDACECAAAAEgAgHAAA_wEAIAIAAAASACAcAAD_AQAgAwAAABQAICMAAPgBACAkAAD9AQAgAQAAABQAIAEAAAASACAFBAAArAUAICkAAK8FACAqAACuBQAgSwAArQUAIEwAALAFACAL3wEAAIUDADDgAQAAhgIAEOEBAACFAwAw4gEBAM8CACHjAQEAzwIAIeQBAQDPAgAh5QFAANACACH-ASAA2wIAIYACQADQAgAhigICANwCACGSAgEAzwIAIQMAAAASACABAACFAgAwKAAAhgIAIAMAAAASACABAAATADACAAAUACABAAAABQAgAQAAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIBQFAACRBQAgBgAAqwUAIAsAAJIFACAMAACTBQAgDQAAlAUAIOIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII0CAQAAAAGOAgEAAAABARwAAI4CACAP4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAEBHAAAkAIAMAEcAACQAgAwFAUAAOwEACAGAACqBQAgCwAA7QQAIAwAAO4EACANAADvBAAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIQIAAAAFACAcAACTAgAgD-IBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhjgIBALwDACECAAAAAwAgHAAAlQIAIAIAAAADACAcAACVAgAgAwAAAAUAICMAAI4CACAkAACTAgAgAQAAAAUAIAEAAAADACAFBAAApQUAICkAAKgFACAqAACnBQAgSwAApgUAIEwAAKkFACAS3wEAAPsCADDgAQAAnAIAEOEBAAD7AgAw4gEBAM8CACHlAUAA0AIAIfoBAAD_Ao0CIv4BIADbAgAhgAJAANACACGEAgEAzwIAIYUCAQDPAgAhhgIBAM8CACGHAgEAzwIAIYgCEAD8AgAhiQICANwCACGKAggA_QIAIYsCAAD-AgAgjQIBAM8CACGOAgEAzwIAIQMAAAADACABAACbAgAwKAAAnAIAIAMAAAADACABAAAEADACAAAFACAaAwAA8wIAIAsAAPQCACAMAAD1AgAgDgAA9gIAIA8AAPcCACAQAAD4AgAgEQAA-QIAIBIAAPoCACDfAQAA6gIAMOABAACiAgAQ4QEAAOoCADDiAQEAAAAB5QFAAPICACHxAQEA6wIAIfIBAQAAAAHzAQEA7AIAIfQBAQAAAAH1AQEA7AIAIfYBAQDsAgAh-AEAAO0C-AEi-gEAAO4C-gEi_AEAAO8C_AEi_QEgAPACACH-ASAA8AIAIf8BAgDxAgAhgAJAAPICACEBAAAAnwIAIAEAAACfAgAgGgMAAPMCACALAAD0AgAgDAAA9QIAIA4AAPYCACAPAAD3AgAgEAAA-AIAIBEAAPkCACASAAD6AgAg3wEAAOoCADDgAQAAogIAEOEBAADqAgAw4gEBAOsCACHlAUAA8gIAIfEBAQDrAgAh8gEBAOsCACHzAQEA7AIAIfQBAQDsAgAh9QEBAOwCACH2AQEA7AIAIfgBAADtAvgBIvoBAADuAvoBIvwBAADvAvwBIv0BIADwAgAh_gEgAPACACH_AQIA8QIAIYACQADyAgAhDAMAAJ0FACALAACeBQAgDAAAnwUAIA4AAKAFACAPAAChBQAgEAAAogUAIBEAAKMFACASAACkBQAg8wEAAMIDACD0AQAAwgMAIPUBAADCAwAg9gEAAMIDACADAAAAogIAIAEAAKMCADACAACfAgAgAwAAAKICACABAACjAgAwAgAAnwIAIAMAAACiAgAgAQAAowIAMAIAAJ8CACAXAwAAlQUAIAsAAJYFACAMAACXBQAgDgAAmAUAIA8AAJkFACAQAACaBQAgEQAAmwUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAEBHAAApwIAIA_iAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAEBHAAAqQIAMAEcAACpAgAwFwMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhAgAAAJ8CACAcAACsAgAgD-IBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIQIAAACiAgAgHAAArgIAIAIAAACiAgAgHAAArgIAIAMAAACfAgAgIwAApwIAICQAAKwCACABAAAAnwIAIAEAAACiAgAgCQQAAMMDACApAADGAwAgKgAAxQMAIEsAAMQDACBMAADHAwAg8wEAAMIDACD0AQAAwgMAIPUBAADCAwAg9gEAAMIDACAS3wEAANYCADDgAQAAtQIAEOEBAADWAgAw4gEBAM8CACHlAUAA0AIAIfEBAQDPAgAh8gEBAM8CACHzAQEA1wIAIfQBAQDXAgAh9QEBANcCACH2AQEA1wIAIfgBAADYAvgBIvoBAADZAvoBIvwBAADaAvwBIv0BIADbAgAh_gEgANsCACH_AQIA3AIAIYACQADQAgAhAwAAAKICACABAAC0AgAwKAAAtQIAIAMAAACiAgAgAQAAowIAMAIAAJ8CACABAAAAGAAgAQAAABgAIAMAAAAWACABAAAXADACAAAYACADAAAAFgAgAQAAFwAwAgAAGAAgAwAAABYAIAEAABcAMAIAABgAIAYHAADAAwAgCAAAwQMAIOIBAQAAAAHjAQEAAAAB5AEBAAAAAeUBQAAAAAEBHAAAvQIAIATiAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAABARwAAL8CADABHAAAvwIAMAYHAAC-AwAgCAAAvwMAIOIBAQC8AwAh4wEBALwDACHkAQEAvAMAIeUBQAC9AwAhAgAAABgAIBwAAMICACAE4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACECAAAAFgAgHAAAxAIAIAIAAAAWACAcAADEAgAgAwAAABgAICMAAL0CACAkAADCAgAgAQAAABgAIAEAAAAWACADBAAAuQMAICkAALsDACAqAAC6AwAgB98BAADOAgAw4AEAAMsCABDhAQAAzgIAMOIBAQDPAgAh4wEBAM8CACHkAQEAzwIAIeUBQADQAgAhAwAAABYAIAEAAMoCADAoAADLAgAgAwAAABYAIAEAABcAMAIAABgAIAffAQAAzgIAMOABAADLAgAQ4QEAAM4CADDiAQEAzwIAIeMBAQDPAgAh5AEBAM8CACHlAUAA0AIAIQ4EAADSAgAgKQAA1QIAICoAANUCACDmAQEAAAAB5wEBAAAABOgBAQAAAATpAQEAAAAB6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBANQCACHuAQEAAAAB7wEBAAAAAfABAQAAAAELBAAA0gIAICkAANMCACAqAADTAgAg5gFAAAAAAecBQAAAAAToAUAAAAAE6QFAAAAAAeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQADRAgAhCwQAANICACApAADTAgAgKgAA0wIAIOYBQAAAAAHnAUAAAAAE6AFAAAAABOkBQAAAAAHqAUAAAAAB6wFAAAAAAewBQAAAAAHtAUAA0QIAIQjmAQIAAAAB5wECAAAABOgBAgAAAATpAQIAAAAB6gECAAAAAesBAgAAAAHsAQIAAAAB7QECANICACEI5gFAAAAAAecBQAAAAAToAUAAAAAE6QFAAAAAAeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQADTAgAhDgQAANICACApAADVAgAgKgAA1QIAIOYBAQAAAAHnAQEAAAAE6AEBAAAABOkBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA1AIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAAQvmAQEAAAAB5wEBAAAABOgBAQAAAATpAQEAAAAB6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBANUCACHuAQEAAAAB7wEBAAAAAfABAQAAAAES3wEAANYCADDgAQAAtQIAEOEBAADWAgAw4gEBAM8CACHlAUAA0AIAIfEBAQDPAgAh8gEBAM8CACHzAQEA1wIAIfQBAQDXAgAh9QEBANcCACH2AQEA1wIAIfgBAADYAvgBIvoBAADZAvoBIvwBAADaAvwBIv0BIADbAgAh_gEgANsCACH_AQIA3AIAIYACQADQAgAhDgQAAOgCACApAADpAgAgKgAA6QIAIOYBAQAAAAHnAQEAAAAF6AEBAAAABekBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA5wIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAAQcEAADSAgAgKQAA5gIAICoAAOYCACDmAQAAAPgBAucBAAAA-AEI6AEAAAD4AQjtAQAA5QL4ASIHBAAA0gIAICkAAOQCACAqAADkAgAg5gEAAAD6AQLnAQAAAPoBCOgBAAAA-gEI7QEAAOMC-gEiBwQAANICACApAADiAgAgKgAA4gIAIOYBAAAA_AEC5wEAAAD8AQjoAQAAAPwBCO0BAADhAvwBIgUEAADSAgAgKQAA4AIAICoAAOACACDmASAAAAAB7QEgAN8CACENBAAA0gIAICkAANICACAqAADSAgAgSwAA3gIAIEwAANICACDmAQIAAAAB5wECAAAABOgBAgAAAATpAQIAAAAB6gECAAAAAesBAgAAAAHsAQIAAAAB7QECAN0CACENBAAA0gIAICkAANICACAqAADSAgAgSwAA3gIAIEwAANICACDmAQIAAAAB5wECAAAABOgBAgAAAATpAQIAAAAB6gECAAAAAesBAgAAAAHsAQIAAAAB7QECAN0CACEI5gEIAAAAAecBCAAAAAToAQgAAAAE6QEIAAAAAeoBCAAAAAHrAQgAAAAB7AEIAAAAAe0BCADeAgAhBQQAANICACApAADgAgAgKgAA4AIAIOYBIAAAAAHtASAA3wIAIQLmASAAAAAB7QEgAOACACEHBAAA0gIAICkAAOICACAqAADiAgAg5gEAAAD8AQLnAQAAAPwBCOgBAAAA_AEI7QEAAOEC_AEiBOYBAAAA_AEC5wEAAAD8AQjoAQAAAPwBCO0BAADiAvwBIgcEAADSAgAgKQAA5AIAICoAAOQCACDmAQAAAPoBAucBAAAA-gEI6AEAAAD6AQjtAQAA4wL6ASIE5gEAAAD6AQLnAQAAAPoBCOgBAAAA-gEI7QEAAOQC-gEiBwQAANICACApAADmAgAgKgAA5gIAIOYBAAAA-AEC5wEAAAD4AQjoAQAAAPgBCO0BAADlAvgBIgTmAQAAAPgBAucBAAAA-AEI6AEAAAD4AQjtAQAA5gL4ASIOBAAA6AIAICkAAOkCACAqAADpAgAg5gEBAAAAAecBAQAAAAXoAQEAAAAF6QEBAAAAAeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQDnAgAh7gEBAAAAAe8BAQAAAAHwAQEAAAABCOYBAgAAAAHnAQIAAAAF6AECAAAABekBAgAAAAHqAQIAAAAB6wECAAAAAewBAgAAAAHtAQIA6AIAIQvmAQEAAAAB5wEBAAAABegBAQAAAAXpAQEAAAAB6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBAOkCACHuAQEAAAAB7wEBAAAAAfABAQAAAAEaAwAA8wIAIAsAAPQCACAMAAD1AgAgDgAA9gIAIA8AAPcCACAQAAD4AgAgEQAA-QIAIBIAAPoCACDfAQAA6gIAMOABAACiAgAQ4QEAAOoCADDiAQEA6wIAIeUBQADyAgAh8QEBAOsCACHyAQEA6wIAIfMBAQDsAgAh9AEBAOwCACH1AQEA7AIAIfYBAQDsAgAh-AEAAO0C-AEi-gEAAO4C-gEi_AEAAO8C_AEi_QEgAPACACH-ASAA8AIAIf8BAgDxAgAhgAJAAPICACEL5gEBAAAAAecBAQAAAAToAQEAAAAE6QEBAAAAAeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQDVAgAh7gEBAAAAAe8BAQAAAAHwAQEAAAABC-YBAQAAAAHnAQEAAAAF6AEBAAAABekBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA6QIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAAQTmAQAAAPgBAucBAAAA-AEI6AEAAAD4AQjtAQAA5gL4ASIE5gEAAAD6AQLnAQAAAPoBCOgBAAAA-gEI7QEAAOQC-gEiBOYBAAAA_AEC5wEAAAD8AQjoAQAAAPwBCO0BAADiAvwBIgLmASAAAAAB7QEgAOACACEI5gECAAAAAecBAgAAAAToAQIAAAAE6QECAAAAAeoBAgAAAAHrAQIAAAAB7AECAAAAAe0BAgDSAgAhCOYBQAAAAAHnAUAAAAAE6AFAAAAABOkBQAAAAAHqAUAAAAAB6wFAAAAAAewBQAAAAAHtAUAA0wIAIQOBAgAAAwAgggIAAAMAIIMCAAADACADgQIAAAkAIIICAAAJACCDAgAACQAgA4ECAAASACCCAgAAEgAggwIAABIAIAOBAgAAHwAgggIAAB8AIIMCAAAfACADgQIAABYAIIICAAAWACCDAgAAFgAgA4ECAAAkACCCAgAAJAAggwIAACQAIAOBAgAAKAAgggIAACgAIIMCAAAoACADgQIAACsAIIICAAArACCDAgAAKwAgEt8BAAD7AgAw4AEAAJwCABDhAQAA-wIAMOIBAQDPAgAh5QFAANACACH6AQAA_wKNAiL-ASAA2wIAIYACQADQAgAhhAIBAM8CACGFAgEAzwIAIYYCAQDPAgAhhwIBAM8CACGIAhAA_AIAIYkCAgDcAgAhigIIAP0CACGLAgAA_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-AEAAO0C-AEi-gEAAO4C-gEi_AEAAO8C_AEi_QEgAPACACH-ASAA8AIAIf8BAgDxAgAhgAJAAPICACG3AgAAogIAILgCAACiAgAgDwcAAKEDACAUAACjAwAgFQAApAMAIBYAAPkCACDfAQAAogMAMOABAAAoABDhAQAAogMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGwAgEA6wIAIbQCAQDrAgAhtQIBAOwCACESEQAA-QIAIBMAAKEDACDfAQAApwMAMOABAAAfABDhAQAApwMAMOIBAQDrAgAh5QFAAPICACH6AQAAqAOzAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIa8CAQDrAgAhsAIBAOsCACGxAgEA6wIAIbMCAQDrAgAhtwIAAB8AILgCAAAfACARBwAAoQMAIBQAAKMDACAVAACkAwAgFgAA-QIAIN8BAACiAwAw4AEAACgAEOEBAACiAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAh_gEgAPACACGAAkAA8gIAIbACAQDrAgAhtAIBAOsCACG1AgEA7AIAIbcCAAAoACC4AgAAKAAgDAcAAKEDACDfAQAApQMAMOABAAAkABDhAQAApQMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIYQCAQDrAgAhpQIAAKYDpQIipgIBAOsCACGnAgEA7AIAIagCIADwAgAhBOYBAAAApQIC5wEAAAClAgjoAQAAAKUCCO0BAACRA6UCIhARAAD5AgAgEwAAoQMAIN8BAACnAwAw4AEAAB8AEOEBAACnAwAw4gEBAOsCACHlAUAA8gIAIfoBAACoA7MCIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhrwIBAOsCACGwAgEA6wIAIbECAQDrAgAhswIBAOsCACEE5gEAAACzAgLnAQAAALMCCOgBAAAAswII7QEAAJ0DswIiAuMBAQAAAAHkAQEAAAABCQcAAKEDACAIAACrAwAg3wEAAKoDADDgAQAAFgAQ4QEAAKoDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIRkFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIbcCAAADACC4AgAAAwAgAuMBAQAAAAHkAQEAAAABDQcAAKEDACAIAACrAwAg3wEAAK0DADDgAQAAEgAQ4QEAAK0DADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhFQkAALEDACDfAQAArgMAMOABAAANABDhAQAArgMAMOIBAQDrAgAh5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAOsCACGYAgEA7AIAIZkCEACvAwAhmgIBAOsCACGcAgEA7AIAIZ0CAQDsAgAhngIBAOwCACGfAgEA7AIAIaACQACgAwAhoQIBAOwCACGiAkAAoAMAIaMCQACgAwAhCOYBEAAAAAHnARAAAAAE6AEQAAAABOkBEAAAAAHqARAAAAAB6wEQAAAAAewBEAAAAAHtARAAhAMAIQTmAQAAAJwCAucBAAAAnAII6AEAAACcAgjtAQAAjQOcAiIRBwAAoQMAIAgAAKsDACAKAAC0AwAg3wEAALIDADDgAQAACQAQ4QEAALIDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA68CIoACQADyAgAhqwJAAPICACGsAgIA8QIAIa0CEACvAwAhtwIAAAkAILgCAAAJACAPBwAAoQMAIAgAAKsDACAKAAC0AwAg3wEAALIDADDgAQAACQAQ4QEAALIDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA68CIoACQADyAgAhqwJAAPICACGsAgIA8QIAIa0CEACvAwAhBOYBAAAArwIC5wEAAACvAgjoAQAAAK8CCO0BAACZA68CIgOBAgAADQAgggIAAA0AIIMCAAANACAXBQAAuAMAIAYAAKEDACALAAD0AgAgDAAA9QIAIA0AAPcCACDfAQAAtQMAMOABAAADABDhAQAAtQMAMOIBAQDrAgAh5QFAAPICACH6AQAAtwONAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIYYCAQDrAgAhhwIBAOsCACGIAhAArwMAIYkCAgDxAgAhigIIALYDACGLAgAA_gIAII0CAQDrAgAhjgIBAOsCACEI5gEIAAAAAecBCAAAAAToAQgAAAAE6QEIAAAAAeoBCAAAAAHrAQgAAAAB7AEIAAAAAe0BCADeAgAhBOYBAAAAjQIC5wEAAACNAgjoAQAAAI0CCO0BAACBA40CIgsDAADzAgAg3wEAAJUDADDgAQAAggEAEOEBAACVAwAw4gEBAOsCACHlAUAA8gIAIfEBAQDrAgAhgAJAAPICACGFAgEA6wIAIbcCAACCAQAguAIAAIIBACAAAAABvAIBAAAAAQG8AkAAAAABBSMAALkGACAkAAC_BgAguQIAALoGACC6AgAAvgYAIL8CAACfAgAgBSMAALcGACAkAAC8BgAguQIAALgGACC6AgAAuwYAIL8CAAAFACADIwAAuQYAILkCAAC6BgAgvwIAAJ8CACADIwAAtwYAILkCAAC4BgAgvwIAAAUAIAAAAAAAAAG8AgEAAAABAbwCAAAA-AECAbwCAAAA-gECAbwCAAAA_AECAbwCIAAAAAEFvAICAAAAAcMCAgAAAAHEAgIAAAABxQICAAAAAcYCAgAAAAELIwAA3gQAMCQAAOMEADC5AgAA3wQAMLoCAADgBAAwuwIAAOEEACC8AgAA4gQAML0CAADiBAAwvgIAAOIEADC_AgAA4gQAMMACAADkBAAwwQIAAOUEADALIwAAvwQAMCQAAMQEADC5AgAAwAQAMLoCAADBBAAwuwIAAMIEACC8AgAAwwQAML0CAADDBAAwvgIAAMMEADC_AgAAwwQAMMACAADFBAAwwQIAAMYEADALIwAAsQQAMCQAALYEADC5AgAAsgQAMLoCAACzBAAwuwIAALQEACC8AgAAtQQAML0CAAC1BAAwvgIAALUEADC_AgAAtQQAMMACAAC3BAAwwQIAALgEADALIwAAmQQAMCQAAJ4EADC5AgAAmgQAMLoCAACbBAAwuwIAAJwEACC8AgAAnQQAML0CAACdBAAwvgIAAJ0EADC_AgAAnQQAMMACAACfBAAwwQIAAKAEADALIwAAjQQAMCQAAJIEADC5AgAAjgQAMLoCAACPBAAwuwIAAJAEACC8AgAAkQQAML0CAACRBAAwvgIAAJEEADC_AgAAkQQAMMACAACTBAAwwQIAAJQEADALIwAAgAQAMCQAAIUEADC5AgAAgQQAMLoCAACCBAAwuwIAAIMEACC8AgAAhAQAML0CAACEBAAwvgIAAIQEADC_AgAAhAQAMMACAACGBAAwwQIAAIcEADALIwAA4wMAMCQAAOgDADC5AgAA5AMAMLoCAADlAwAwuwIAAOYDACC8AgAA5wMAML0CAADnAwAwvgIAAOcDADC_AgAA5wMAMMACAADpAwAwwQIAAOoDADALIwAA1gMAMCQAANsDADC5AgAA1wMAMLoCAADYAwAwuwIAANkDACC8AgAA2gMAML0CAADaAwAwvgIAANoDADC_AgAA2gMAMMACAADcAwAwwQIAAN0DADAF4gEBAAAAAeUBQAAAAAGTAgEAAAABlAJAAAAAAZUCQAAAAAECAAAALQAgIwAA4gMAIAMAAAAtACAjAADiAwAgJAAA4QMAIAEcAAC2BgAwCgcAAKEDACDfAQAAnwMAMOABAAArABDhAQAAnwMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhkwIBAAAAAZQCQADyAgAhlQJAAKADACECAAAALQAgHAAA4QMAIAIAAADeAwAgHAAA3wMAIAnfAQAA3QMAMOABAADeAwAQ4QEAAN0DADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACGTAgEA6wIAIZQCQADyAgAhlQJAAKADACEJ3wEAAN0DADDgAQAA3gMAEOEBAADdAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAhkwIBAOsCACGUAkAA8gIAIZUCQACgAwAhBeIBAQC8AwAh5QFAAL0DACGTAgEAvAMAIZQCQAC9AwAhlQJAAOADACEBvAJAAAAAAQXiAQEAvAMAIeUBQAC9AwAhkwIBALwDACGUAkAAvQMAIZUCQADgAwAhBeIBAQAAAAHlAUAAAAABkwIBAAAAAZQCQAAAAAGVAkAAAAABChQAAPsDACAVAAD_AwAgFgAA_QMAIOIBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGwAgEAAAABtAIBAAAAAbUCAQAAAAECAAAAAQAgIwAA_gMAIAMAAAABACAjAAD-AwAgJAAA7QMAIAEcAAC1BgAwDwcAAKEDACAUAACjAwAgFQAApAMAIBYAAPkCACDfAQAAogMAMOABAAAoABDhAQAAogMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAh_gEgAPACACGAAkAA8gIAIbACAQDrAgAhtAIBAOsCACG1AgEA7AIAIQIAAAABACAcAADtAwAgAgAAAOsDACAcAADsAwAgC98BAADqAwAw4AEAAOsDABDhAQAA6gMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGwAgEA6wIAIbQCAQDrAgAhtQIBAOwCACEL3wEAAOoDADDgAQAA6wMAEOEBAADqAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAh_gEgAPACACGAAkAA8gIAIbACAQDrAgAhtAIBAOsCACG1AgEA7AIAIQfiAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIbACAQC8AwAhtAIBALwDACG1AgEAyAMAIQoUAADuAwAgFQAA7wMAIBYAAPADACDiAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIbACAQC8AwAhtAIBALwDACG1AgEAyAMAIQUjAACpBgAgJAAAswYAILkCAACqBgAgugIAALIGACC_AgAAIQAgByMAAKUGACAkAACwBgAguQIAAKYGACC6AgAArwYAIL0CAAAoACC-AgAAKAAgvwIAAAEAIAsjAADxAwAwJAAA9QMAMLkCAADyAwAwugIAAPMDADC7AgAA9AMAILwCAADnAwAwvQIAAOcDADC-AgAA5wMAML8CAADnAwAwwAIAAPYDADDBAgAA6gMAMAoHAAD8AwAgFAAA-wMAIBYAAP0DACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG0AgEAAAABAgAAAAEAICMAAPoDACADAAAAAQAgIwAA-gMAICQAAPgDACABHAAArgYAMAIAAAABACAcAAD4AwAgAgAAAOsDACAcAAD3AwAgB-IBAQC8AwAh4wEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGwAgEAvAMAIbQCAQC8AwAhCgcAAPkDACAUAADuAwAgFgAA8AMAIOIBAQC8AwAh4wEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGwAgEAvAMAIbQCAQC8AwAhBSMAAKcGACAkAACsBgAguQIAAKgGACC6AgAAqwYAIL8CAACfAgAgCgcAAPwDACAUAAD7AwAgFgAA_QMAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABsAIBAAAAAbQCAQAAAAEDIwAAqQYAILkCAACqBgAgvwIAACEAIAMjAACnBgAguQIAAKgGACC_AgAAnwIAIAQjAADxAwAwuQIAAPIDADC7AgAA9AMAIL8CAADnAwAwChQAAPsDACAVAAD_AwAgFgAA_QMAIOIBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGwAgEAAAABtAIBAAAAAbUCAQAAAAEDIwAApQYAILkCAACmBgAgvwIAAAEAIAfiAQEAAAAB5QFAAAAAAYQCAQAAAAGlAgAAAKUCAqYCAQAAAAGnAgEAAAABqAIgAAAAAQIAAAAmACAjAACMBAAgAwAAACYAICMAAIwEACAkAACLBAAgARwAAKQGADAMBwAAoQMAIN8BAAClAwAw4AEAACQAEOEBAAClAwAw4gEBAAAAAeMBAQDrAgAh5QFAAPICACGEAgEA6wIAIaUCAACmA6UCIqYCAQDrAgAhpwIBAOwCACGoAiAA8AIAIQIAAAAmACAcAACLBAAgAgAAAIgEACAcAACJBAAgC98BAACHBAAw4AEAAIgEABDhAQAAhwQAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIYQCAQDrAgAhpQIAAKYDpQIipgIBAOsCACGnAgEA7AIAIagCIADwAgAhC98BAACHBAAw4AEAAIgEABDhAQAAhwQAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIYQCAQDrAgAhpQIAAKYDpQIipgIBAOsCACGnAgEA7AIAIagCIADwAgAhB-IBAQC8AwAh5QFAAL0DACGEAgEAvAMAIaUCAACKBKUCIqYCAQC8AwAhpwIBAMgDACGoAiAAzAMAIQG8AgAAAKUCAgfiAQEAvAMAIeUBQAC9AwAhhAIBALwDACGlAgAAigSlAiKmAgEAvAMAIacCAQDIAwAhqAIgAMwDACEH4gEBAAAAAeUBQAAAAAGEAgEAAAABpQIAAAClAgKmAgEAAAABpwIBAAAAAagCIAAAAAEECAAAwQMAIOIBAQAAAAHkAQEAAAAB5QFAAAAAAQIAAAAYACAjAACYBAAgAwAAABgAICMAAJgEACAkAACXBAAgARwAAKMGADAKBwAAoQMAIAgAAKsDACDfAQAAqgMAMOABAAAWABDhAQAAqgMAMOIBAQAAAAHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACG2AgAAqQMAIAIAAAAYACAcAACXBAAgAgAAAJUEACAcAACWBAAgB98BAACUBAAw4AEAAJUEABDhAQAAlAQAMOIBAQDrAgAh4wEBAOsCACHkAQEA6wIAIeUBQADyAgAhB98BAACUBAAw4AEAAJUEABDhAQAAlAQAMOIBAQDrAgAh4wEBAOsCACHkAQEA6wIAIeUBQADyAgAhA-IBAQC8AwAh5AEBALwDACHlAUAAvQMAIQQIAAC_AwAg4gEBALwDACHkAQEAvAMAIeUBQAC9AwAhBAgAAMEDACDiAQEAAAAB5AEBAAAAAeUBQAAAAAELEQAAsAQAIOIBAQAAAAHlAUAAAAAB-gEAAACzAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABrwIBAAAAAbACAQAAAAGxAgEAAAABAgAAACEAICMAAK8EACADAAAAIQAgIwAArwQAICQAAKQEACABHAAAogYAMBARAAD5AgAgEwAAoQMAIN8BAACnAwAw4AEAAB8AEOEBAACnAwAw4gEBAAAAAeUBQADyAgAh-gEAAKgDswIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAAAAAa8CAQDrAgAhsAIBAOsCACGxAgEA6wIAIbMCAQDrAgAhAgAAACEAIBwAAKQEACACAAAAoQQAIBwAAKIEACAO3wEAAKAEADDgAQAAoQQAEOEBAACgBAAw4gEBAOsCACHlAUAA8gIAIfoBAACoA7MCIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhrwIBAOsCACGwAgEA6wIAIbECAQDrAgAhswIBAOsCACEO3wEAAKAEADDgAQAAoQQAEOEBAACgBAAw4gEBAOsCACHlAUAA8gIAIfoBAACoA7MCIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhrwIBAOsCACGwAgEA6wIAIbECAQDrAgAhswIBAOsCACEK4gEBALwDACHlAUAAvQMAIfoBAACjBLMCIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhrwIBALwDACGwAgEAvAMAIbECAQC8AwAhAbwCAAAAswICCxEAAKUEACDiAQEAvAMAIeUBQAC9AwAh-gEAAKMEswIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGvAgEAvAMAIbACAQC8AwAhsQIBALwDACELIwAApgQAMCQAAKoEADC5AgAApwQAMLoCAACoBAAwuwIAAKkEACC8AgAA5wMAML0CAADnAwAwvgIAAOcDADC_AgAA5wMAMMACAACrBAAwwQIAAOoDADAKBwAA_AMAIBUAAP8DACAWAAD9AwAg4gEBAAAAAeMBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGwAgEAAAABtQIBAAAAAQIAAAABACAjAACuBAAgAwAAAAEAICMAAK4EACAkAACtBAAgARwAAKEGADACAAAAAQAgHAAArQQAIAIAAADrAwAgHAAArAQAIAfiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhsAIBALwDACG1AgEAyAMAIQoHAAD5AwAgFQAA7wMAIBYAAPADACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhsAIBALwDACG1AgEAyAMAIQoHAAD8AwAgFQAA_wMAIBYAAP0DACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG1AgEAAAABCxEAALAEACDiAQEAAAAB5QFAAAAAAfoBAAAAswIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAa8CAQAAAAGwAgEAAAABsQIBAAAAAQQjAACmBAAwuQIAAKcEADC7AgAAqQQAIL8CAADnAwAwCAgAAL4EACDiAQEAAAAB5AEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAYoCAgAAAAGSAgEAAAABAgAAABQAICMAAL0EACADAAAAFAAgIwAAvQQAICQAALsEACABHAAAoAYAMA4HAAChAwAgCAAAqwMAIN8BAACtAwAw4AEAABIAEOEBAACtAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhtgIAAKwDACACAAAAFAAgHAAAuwQAIAIAAAC5BAAgHAAAugQAIAvfAQAAuAQAMOABAAC5BAAQ4QEAALgEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhC98BAAC4BAAw4AEAALkEABDhAQAAuAQAMOIBAQDrAgAh4wEBAOsCACHkAQEA6wIAIeUBQADyAgAh_gEgAPACACGAAkAA8gIAIYoCAgDxAgAhkgIBAOsCACEH4gEBALwDACHkAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIYoCAgDNAwAhkgIBALwDACEICAAAvAQAIOIBAQC8AwAh5AEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGKAgIAzQMAIZICAQC8AwAhBSMAAJsGACAkAACeBgAguQIAAJwGACC6AgAAnQYAIL8CAAAFACAICAAAvgQAIOIBAQAAAAHkAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABigICAAAAAZICAQAAAAEDIwAAmwYAILkCAACcBgAgvwIAAAUAIAoIAADcBAAgCgAA3QQAIOIBAQAAAAHkAQEAAAAB5QFAAAAAAfoBAAAArwICgAJAAAAAAasCQAAAAAGsAgIAAAABrQIQAAAAAQIAAAALACAjAADbBAAgAwAAAAsAICMAANsEACAkAADLBAAgARwAAJoGADAPBwAAoQMAIAgAAKsDACAKAAC0AwAg3wEAALIDADDgAQAACQAQ4QEAALIDADDiAQEAAAAB4wEBAOsCACHkAQEA6wIAIeUBQADyAgAh-gEAALMDrwIigAJAAPICACGrAkAA8gIAIawCAgDxAgAhrQIQAK8DACECAAAACwAgHAAAywQAIAIAAADHBAAgHAAAyAQAIAzfAQAAxgQAMOABAADHBAAQ4QEAAMYEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA68CIoACQADyAgAhqwJAAPICACGsAgIA8QIAIa0CEACvAwAhDN8BAADGBAAw4AEAAMcEABDhAQAAxgQAMOIBAQDrAgAh4wEBAOsCACHkAQEA6wIAIeUBQADyAgAh-gEAALMDrwIigAJAAPICACGrAkAA8gIAIawCAgDxAgAhrQIQAK8DACEI4gEBALwDACHkAQEAvAMAIeUBQAC9AwAh-gEAAMoErwIigAJAAL0DACGrAkAAvQMAIawCAgDNAwAhrQIQAMkEACEFvAIQAAAAAcMCEAAAAAHEAhAAAAABxQIQAAAAAcYCEAAAAAEBvAIAAACvAgIKCAAAzAQAIAoAAM0EACDiAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSvAiKAAkAAvQMAIasCQAC9AwAhrAICAM0DACGtAhAAyQQAIQUjAACUBgAgJAAAmAYAILkCAACVBgAgugIAAJcGACC_AgAABQAgCyMAAM4EADAkAADTBAAwuQIAAM8EADC6AgAA0AQAMLsCAADRBAAgvAIAANIEADC9AgAA0gQAML4CAADSBAAwvwIAANIEADDAAgAA1AQAMMECAADVBAAwEOIBAQAAAAHlAUAAAAAB-gEAAACcAgKAAkAAAAABlwIBAAAAAZgCAQAAAAGZAhAAAAABmgIBAAAAAZwCAQAAAAGdAgEAAAABngIBAAAAAZ8CAQAAAAGgAkAAAAABoQIBAAAAAaICQAAAAAGjAkAAAAABAgAAAA8AICMAANoEACADAAAADwAgIwAA2gQAICQAANkEACABHAAAlgYAMBUJAACxAwAg3wEAAK4DADDgAQAADQAQ4QEAAK4DADDiAQEAAAAB5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAAAAAZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhowJAAKADACECAAAADwAgHAAA2QQAIAIAAADWBAAgHAAA1wQAIBTfAQAA1QQAMOABAADWBAAQ4QEAANUEADDiAQEA6wIAIeUBQADyAgAh-gEAALADnAIigAJAAPICACGWAgEA6wIAIZcCAQDrAgAhmAIBAOwCACGZAhAArwMAIZoCAQDrAgAhnAIBAOwCACGdAgEA7AIAIZ4CAQDsAgAhnwIBAOwCACGgAkAAoAMAIaECAQDsAgAhogJAAKADACGjAkAAoAMAIRTfAQAA1QQAMOABAADWBAAQ4QEAANUEADDiAQEA6wIAIeUBQADyAgAh-gEAALADnAIigAJAAPICACGWAgEA6wIAIZcCAQDrAgAhmAIBAOwCACGZAhAArwMAIZoCAQDrAgAhnAIBAOwCACGdAgEA7AIAIZ4CAQDsAgAhnwIBAOwCACGgAkAAoAMAIaECAQDsAgAhogJAAKADACGjAkAAoAMAIRDiAQEAvAMAIeUBQAC9AwAh-gEAANgEnAIigAJAAL0DACGXAgEAvAMAIZgCAQDIAwAhmQIQAMkEACGaAgEAvAMAIZwCAQDIAwAhnQIBAMgDACGeAgEAyAMAIZ8CAQDIAwAhoAJAAOADACGhAgEAyAMAIaICQADgAwAhowJAAOADACEBvAIAAACcAgIQ4gEBALwDACHlAUAAvQMAIfoBAADYBJwCIoACQAC9AwAhlwIBALwDACGYAgEAyAMAIZkCEADJBAAhmgIBALwDACGcAgEAyAMAIZ0CAQDIAwAhngIBAMgDACGfAgEAyAMAIaACQADgAwAhoQIBAMgDACGiAkAA4AMAIaMCQADgAwAhEOIBAQAAAAHlAUAAAAAB-gEAAACcAgKAAkAAAAABlwIBAAAAAZgCAQAAAAGZAhAAAAABmgIBAAAAAZwCAQAAAAGdAgEAAAABngIBAAAAAZ8CAQAAAAGgAkAAAAABoQIBAAAAAaICQAAAAAGjAkAAAAABCggAANwEACAKAADdBAAg4gEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACvAgKAAkAAAAABqwJAAAAAAawCAgAAAAGtAhAAAAABAyMAAJQGACC5AgAAlQYAIL8CAAAFACAEIwAAzgQAMLkCAADPBAAwuwIAANEEACC_AgAA0gQAMBIFAACRBQAgCwAAkgUAIAwAAJMFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAQIAAAAFACAjAACPBQAgAwAAAAUAICMAAI8FACAkAADrBAAgARwAAJMGADAXBQAAuAMAIAYAAKEDACALAAD0AgAgDAAA9QIAIA0AAPcCACDfAQAAtQMAMOABAAADABDhAQAAtQMAMOIBAQAAAAHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQAAAAGGAgEA6wIAIYcCAQDrAgAhiAIQAK8DACGJAgIA8QIAIYoCCAC2AwAhiwIAAP4CACCNAgEA6wIAIY4CAQDrAgAhAgAAAAUAIBwAAOsEACACAAAA5gQAIBwAAOcEACAS3wEAAOUEADDgAQAA5gQAEOEBAADlBAAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIRLfAQAA5QQAMOABAADmBAAQ4QEAAOUEADDiAQEA6wIAIeUBQADyAgAh-gEAALcDjQIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAOsCACGGAgEA6wIAIYcCAQDrAgAhiAIQAK8DACGJAgIA8QIAIYoCCAC2AwAhiwIAAP4CACCNAgEA6wIAIY4CAQDrAgAhDuIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhBbwCCAAAAAHDAggAAAABxAIIAAAAAcUCCAAAAAHGAggAAAABArwCAQAAAATCAgEAAAAFAbwCAAAAjQICEgUAAOwEACALAADtBAAgDAAA7gQAIA0AAO8EACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIQUjAACBBgAgJAAAkQYAILkCAACCBgAgugIAAJAGACC_AgAAfwAgCyMAAIQFADAkAACIBQAwuQIAAIUFADC6AgAAhgUAMLsCAACHBQAgvAIAAMMEADC9AgAAwwQAML4CAADDBAAwvwIAAMMEADDAAgAAiQUAMMECAADGBAAwCyMAAPkEADAkAAD9BAAwuQIAAPoEADC6AgAA-wQAMLsCAAD8BAAgvAIAALUEADC9AgAAtQQAML4CAAC1BAAwvwIAALUEADDAAgAA_gQAMMECAAC4BAAwCyMAAPAEADAkAAD0BAAwuQIAAPEEADC6AgAA8gQAMLsCAADzBAAgvAIAAJEEADC9AgAAkQQAML4CAACRBAAwvwIAAJEEADDAAgAA9QQAMMECAACUBAAwBAcAAMADACDiAQEAAAAB4wEBAAAAAeUBQAAAAAECAAAAGAAgIwAA-AQAIAMAAAAYACAjAAD4BAAgJAAA9wQAIAEcAACPBgAwAgAAABgAIBwAAPcEACACAAAAlQQAIBwAAPYEACAD4gEBALwDACHjAQEAvAMAIeUBQAC9AwAhBAcAAL4DACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACEEBwAAwAMAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAQgHAACDBQAg4gEBAAAAAeMBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQIAAAAUACAjAACCBQAgAwAAABQAICMAAIIFACAkAACABQAgARwAAI4GADACAAAAFAAgHAAAgAUAIAIAAAC5BAAgHAAA_wQAIAfiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhigICAM0DACGSAgEAvAMAIQgHAACBBQAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIYoCAgDNAwAhkgIBALwDACEFIwAAiQYAICQAAIwGACC5AgAAigYAILoCAACLBgAgvwIAAJ8CACAIBwAAgwUAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABigICAAAAAZICAQAAAAEDIwAAiQYAILkCAACKBgAgvwIAAJ8CACAKBwAAjgUAIAoAAN0EACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH6AQAAAK8CAoACQAAAAAGrAkAAAAABrAICAAAAAa0CEAAAAAECAAAACwAgIwAAjQUAIAMAAAALACAjAACNBQAgJAAAiwUAIAEcAACIBgAwAgAAAAsAIBwAAIsFACACAAAAxwQAIBwAAIoFACAI4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh-gEAAMoErwIigAJAAL0DACGrAkAAvQMAIawCAgDNAwAhrQIQAMkEACEKBwAAjAUAIAoAAM0EACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH6AQAAygSvAiKAAkAAvQMAIasCQAC9AwAhrAICAM0DACGtAhAAyQQAIQUjAACDBgAgJAAAhgYAILkCAACEBgAgugIAAIUGACC_AgAAnwIAIAoHAACOBQAgCgAA3QQAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAfoBAAAArwICgAJAAAAAAasCQAAAAAGsAgIAAAABrQIQAAAAAQMjAACDBgAguQIAAIQGACC_AgAAnwIAIBIFAACRBQAgCwAAkgUAIAwAAJMFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAQG8AgEAAAAEAyMAAIEGACC5AgAAggYAIL8CAAB_ACAEIwAAhAUAMLkCAACFBQAwuwIAAIcFACC_AgAAwwQAMAQjAAD5BAAwuQIAAPoEADC7AgAA_AQAIL8CAAC1BAAwBCMAAPAEADC5AgAA8QQAMLsCAADzBAAgvwIAAJEEADAEIwAA3gQAMLkCAADfBAAwuwIAAOEEACC_AgAA4gQAMAQjAAC_BAAwuQIAAMAEADC7AgAAwgQAIL8CAADDBAAwBCMAALEEADC5AgAAsgQAMLsCAAC0BAAgvwIAALUEADAEIwAAmQQAMLkCAACaBAAwuwIAAJwEACC_AgAAnQQAMAQjAACNBAAwuQIAAI4EADC7AgAAkAQAIL8CAACRBAAwBCMAAIAEADC5AgAAgQQAMLsCAACDBAAgvwIAAIQEADAEIwAA4wMAMLkCAADkAwAwuwIAAOYDACC_AgAA5wMAMAQjAADWAwAwuQIAANcDADC7AgAA2QMAIL8CAADaAwAwAAAAAAAAAAAAAAAAAAUjAAD8BQAgJAAA_wUAILkCAAD9BQAgugIAAP4FACC_AgAAnwIAIAMjAAD8BQAguQIAAP0FACC_AgAAnwIAIAAAAAAAAAAABSMAAPcFACAkAAD6BQAguQIAAPgFACC6AgAA-QUAIL8CAACfAgAgAyMAAPcFACC5AgAA-AUAIL8CAACfAgAgAAAAAAAFIwAA8gUAICQAAPUFACC5AgAA8wUAILoCAAD0BQAgvwIAAAsAIAMjAADyBQAguQIAAPMFACC_AgAACwAgAAAABSMAAO0FACAkAADwBQAguQIAAO4FACC6AgAA7wUAIL8CAACfAgAgAyMAAO0FACC5AgAA7gUAIL8CAACfAgAgAAAAAAAACyMAAMkFADAkAADNBQAwuQIAAMoFADC6AgAAywUAMLsCAADMBQAgvAIAAOIEADC9AgAA4gQAML4CAADiBAAwvwIAAOIEADDAAgAAzgUAMMECAADlBAAwEgYAAKsFACALAACSBQAgDAAAkwUAIA0AAJQFACDiAQEAAAAB5QFAAAAAAfoBAAAAjQIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIQAAAAAYkCAgAAAAGKAggAAAABiwIAAJAFACCOAgEAAAABAgAAAAUAICMAANEFACADAAAABQAgIwAA0QUAICQAANAFACABHAAA7AUAMAIAAAAFACAcAADQBQAgAgAAAOYEACAcAADPBQAgDuIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII4CAQC8AwAhEgYAAKoFACALAADtBAAgDAAA7gQAIA0AAO8EACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCOAgEAvAMAIRIGAACrBQAgCwAAkgUAIAwAAJMFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjgIBAAAAAQQjAADJBQAwuQIAAMoFADC7AgAAzAUAIL8CAADiBAAwAAAAAAAAAAAFIwAA5wUAICQAAOoFACC5AgAA6AUAILoCAADpBQAgvwIAAJ8CACADIwAA5wUAILkCAADoBQAgvwIAAJ8CACAAAAAMAwAAnQUAIAsAAJ4FACAMAACfBQAgDgAAoAUAIA8AAKEFACAQAACiBQAgEQAAowUAIBIAAKQFACDzAQAAwgMAIPQBAADCAwAg9QEAAMIDACD2AQAAwgMAIAIRAACjBQAgEwAA4AUAIAUHAADgBQAgFAAA4QUAIBUAAOIFACAWAACjBQAgtQIAAMIDACAFBQAA5gUAIAYAAOAFACALAACeBQAgDAAAnwUAIA0AAKEFACADBwAA4AUAIAgAAOMFACAKAADlBQAgAAEDAACdBQAgFgMAAJUFACALAACWBQAgDAAAlwUAIA8AAJkFACAQAACaBQAgEQAAmwUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAOcFACADAAAAogIAICMAAOcFACAkAADrBQAgGAAAAKICACADAADOAwAgCwAAzwMAIAwAANADACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAgHAAA6wUAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIRYDAADOAwAgCwAAzwMAIAwAANADACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhDuIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII4CAQAAAAEWAwAAlQUAIAsAAJYFACAMAACXBQAgDgAAmAUAIA8AAJkFACARAACbBQAgEgAAnAUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQIAAACfAgAgIwAA7QUAIAMAAACiAgAgIwAA7QUAICQAAPEFACAYAAAAogIAIAMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEQAA1AMAIBIAANUDACAcAADxBQAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACELBwAAjgUAIAgAANwEACDiAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACvAgKAAkAAAAABqwJAAAAAAawCAgAAAAGtAhAAAAABAgAAAAsAICMAAPIFACADAAAACQAgIwAA8gUAICQAAPYFACANAAAACQAgBwAAjAUAIAgAAMwEACAcAAD2BQAg4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSvAiKAAkAAvQMAIasCQAC9AwAhrAICAM0DACGtAhAAyQQAIQsHAACMBQAgCAAAzAQAIOIBAQC8AwAh4wEBALwDACHkAQEAvAMAIeUBQAC9AwAh-gEAAMoErwIigAJAAL0DACGrAkAAvQMAIawCAgDNAwAhrQIQAMkEACEWAwAAlQUAIAsAAJYFACAMAACXBQAgDgAAmAUAIA8AAJkFACAQAACaBQAgEQAAmwUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQIAAACfAgAgIwAA9wUAIAMAAACiAgAgIwAA9wUAICQAAPsFACAYAAAAogIAIAMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACAcAAD7BQAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEWCwAAlgUAIAwAAJcFACAOAACYBQAgDwAAmQUAIBAAAJoFACARAACbBQAgEgAAnAUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQIAAACfAgAgIwAA_AUAIAMAAACiAgAgIwAA_AUAICQAAIAGACAYAAAAogIAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACAcAACABgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEF4gEBAAAAAeUBQAAAAAHxAQEAAAABgAJAAAAAAYUCAQAAAAECAAAAfwAgIwAAgQYAIBYDAACVBQAgDAAAlwUAIA4AAJgFACAPAACZBQAgEAAAmgUAIBEAAJsFACASAACcBQAg4gEBAAAAAeUBQAAAAAHxAQEAAAAB8gEBAAAAAfMBAQAAAAH0AQEAAAAB9QEBAAAAAfYBAQAAAAH4AQAAAPgBAvoBAAAA-gEC_AEAAAD8AQL9ASAAAAAB_gEgAAAAAf8BAgAAAAGAAkAAAAABAgAAAJ8CACAjAACDBgAgAwAAAKICACAjAACDBgAgJAAAhwYAIBgAAACiAgAgAwAAzgMAIAwAANADACAOAADRAwAgDwAA0gMAIBAAANMDACARAADUAwAgEgAA1QMAIBwAAIcGACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEWAwAAzgMAIAwAANADACAOAADRAwAgDwAA0gMAIBAAANMDACARAADUAwAgEgAA1QMAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIQjiAQEAAAAB4wEBAAAAAeUBQAAAAAH6AQAAAK8CAoACQAAAAAGrAkAAAAABrAICAAAAAa0CEAAAAAEWAwAAlQUAIAsAAJYFACAOAACYBQAgDwAAmQUAIBAAAJoFACARAACbBQAgEgAAnAUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQIAAACfAgAgIwAAiQYAIAMAAACiAgAgIwAAiQYAICQAAI0GACAYAAAAogIAIAMAAM4DACALAADPAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACAcAACNBgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACALAADPAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEH4gEBAAAAAeMBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQPiAQEAAAAB4wEBAAAAAeUBQAAAAAEDAAAAggEAICMAAIEGACAkAACSBgAgBwAAAIIBACAcAACSBgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAhgAJAAL0DACGFAgEAvAMAIQXiAQEAvAMAIeUBQAC9AwAh8QEBALwDACGAAkAAvQMAIYUCAQC8AwAhDuIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII0CAQAAAAETBQAAkQUAIAYAAKsFACAMAACTBQAgDQAAlAUAIOIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII0CAQAAAAGOAgEAAAABAgAAAAUAICMAAJQGACAQ4gEBAAAAAeUBQAAAAAH6AQAAAJwCAoACQAAAAAGXAgEAAAABmAIBAAAAAZkCEAAAAAGaAgEAAAABnAIBAAAAAZ0CAQAAAAGeAgEAAAABnwIBAAAAAaACQAAAAAGhAgEAAAABogJAAAAAAaMCQAAAAAEDAAAAAwAgIwAAlAYAICQAAJkGACAVAAAAAwAgBQAA7AQAIAYAAKoFACAMAADuBAAgDQAA7wQAIBwAAJkGACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIY4CAQC8AwAhEwUAAOwEACAGAACqBQAgDAAA7gQAIA0AAO8EACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIY4CAQC8AwAhCOIBAQAAAAHkAQEAAAAB5QFAAAAAAfoBAAAArwICgAJAAAAAAasCQAAAAAGsAgIAAAABrQIQAAAAARMFAACRBQAgBgAAqwUAIAsAAJIFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAECAAAABQAgIwAAmwYAIAMAAAADACAjAACbBgAgJAAAnwYAIBUAAAADACAFAADsBAAgBgAAqgUAIAsAAO0EACANAADvBAAgHAAAnwYAIOIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhjgIBALwDACETBQAA7AQAIAYAAKoFACALAADtBAAgDQAA7wQAIOIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhjgIBALwDACEH4gEBAAAAAeQBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQfiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG1AgEAAAABCuIBAQAAAAHlAUAAAAAB-gEAAACzAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABrwIBAAAAAbACAQAAAAGxAgEAAAABA-IBAQAAAAHkAQEAAAAB5QFAAAAAAQfiAQEAAAAB5QFAAAAAAYQCAQAAAAGlAgAAAKUCAqYCAQAAAAGnAgEAAAABqAIgAAAAAQsHAAD8AwAgFAAA-wMAIBUAAP8DACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG0AgEAAAABtQIBAAAAAQIAAAABACAjAAClBgAgFgMAAJUFACALAACWBQAgDAAAlwUAIA4AAJgFACAPAACZBQAgEAAAmgUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAKcGACAMEwAA3AUAIOIBAQAAAAHlAUAAAAAB-gEAAACzAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABrwIBAAAAAbACAQAAAAGxAgEAAAABswIBAAAAAQIAAAAhACAjAACpBgAgAwAAAKICACAjAACnBgAgJAAArQYAIBgAAACiAgAgAwAAzgMAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEgAA1QMAIBwAAK0GACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEWAwAAzgMAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEgAA1QMAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIQfiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG0AgEAAAABAwAAACgAICMAAKUGACAkAACxBgAgDQAAACgAIAcAAPkDACAUAADuAwAgFQAA7wMAIBwAALEGACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhsAIBALwDACG0AgEAvAMAIbUCAQDIAwAhCwcAAPkDACAUAADuAwAgFQAA7wMAIOIBAQC8AwAh4wEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGwAgEAvAMAIbQCAQC8AwAhtQIBAMgDACEDAAAAHwAgIwAAqQYAICQAALQGACAOAAAAHwAgEwAA2wUAIBwAALQGACDiAQEAvAMAIeUBQAC9AwAh-gEAAKMEswIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGvAgEAvAMAIbACAQC8AwAhsQIBALwDACGzAgEAvAMAIQwTAADbBQAg4gEBALwDACHlAUAAvQMAIfoBAACjBLMCIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhrwIBALwDACGwAgEAvAMAIbECAQC8AwAhswIBALwDACEH4gEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG0AgEAAAABtQIBAAAAAQXiAQEAAAAB5QFAAAAAAZMCAQAAAAGUAkAAAAABlQJAAAAAARMFAACRBQAgBgAAqwUAIAsAAJIFACAMAACTBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAECAAAABQAgIwAAtwYAIBYDAACVBQAgCwAAlgUAIAwAAJcFACAOAACYBQAgEAAAmgUAIBEAAJsFACASAACcBQAg4gEBAAAAAeUBQAAAAAHxAQEAAAAB8gEBAAAAAfMBAQAAAAH0AQEAAAAB9QEBAAAAAfYBAQAAAAH4AQAAAPgBAvoBAAAA-gEC_AEAAAD8AQL9ASAAAAAB_gEgAAAAAf8BAgAAAAGAAkAAAAABAgAAAJ8CACAjAAC5BgAgAwAAAAMAICMAALcGACAkAAC9BgAgFQAAAAMAIAUAAOwEACAGAACqBQAgCwAA7QQAIAwAAO4EACAcAAC9BgAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIRMFAADsBAAgBgAAqgUAIAsAAO0EACAMAADuBAAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIQMAAACiAgAgIwAAuQYAICQAAMAGACAYAAAAogIAIAMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAQAADTAwAgEQAA1AMAIBIAANUDACAcAADABgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEFBAARBwADFAACFTkBFjoBAwQAEBE3ARMAAwkDBgQEAA8LHQcMHgoOIgIPIwsQJw0RKgESLg4GBAAMBQAFBgADCwwHDBUKDRkLAgMHBAQABgEDCAAEBAAJBwADCAAEChAIAQkABwEKEQACBwADCAAEAgcAAwgABAMLGgAMGwANHAABBwADAQcAAwgDLwALMAAMMQAOMgAPMwAQNAARNQASNgABETgAARY7AAADBwADFAACFUUBAwcAAxQAAhVLAQMEABYpABcqABgAAAADBAAWKQAXKgAYARMAAwETAAMDBAAdKQAeKgAfAAAAAwQAHSkAHioAHwIHAAMIAAQCBwADCAAEBQQAJCkAJyoAKEsAJUwAJgAAAAAABQQAJCkAJyoAKEsAJUwAJgAAAwQALSkALioALwAAAAMEAC0pAC4qAC8AAAADBAA1KQA2KgA3AAAAAwQANSkANioANwEHAAMBBwADAwQAPCkAPSoAPgAAAAMEADwpAD0qAD4BCQAHAQkABwUEAEMpAEYqAEdLAERMAEUAAAAAAAUEAEMpAEYqAEdLAERMAEUBBwADAQcAAwMEAEwpAE0qAE4AAAADBABMKQBNKgBOAgcAAwgABAIHAAMIAAQFBABTKQBWKgBXSwBUTABVAAAAAAAFBABTKQBWKgBXSwBUTABVAgUABQYAAwIFAAUGAAMFBABcKQBfKgBgSwBdTABeAAAAAAAFBABcKQBfKgBgSwBdTABeAAAFBABlKQBoKgBpSwBmTABnAAAAAAAFBABlKQBoKgBpSwBmTABnAgcAAwgABAIHAAMIAAQDBABuKQBvKgBwAAAAAwQAbikAbyoAcBcCARg8ARk9ARo-ARs_AR1BAR5DEh9EEyBHASFJEiJKFCVMASZNASdOEitRFSxSGS1TAi5UAi9VAjBWAjFXAjJZAjNbEjRcGjVeAjZgEjdhGzhiAjljAjpkEjtnHDxoID1pBz5qBz9rB0BsB0FtB0JvB0NxEkRyIUV0B0Z2Ekd3Ikh4B0l5B0p6Ek19I05-KU-AAQVQgQEFUYQBBVKFAQVThgEFVIgBBVWKARJWiwEqV40BBViPARJZkAErWpEBBVuSAQVckwESXZYBLF6XATBfmQExYJoBMWGdATFingExY58BMWShATFlowESZqQBMmemATFoqAESaakBM2qqATFrqwExbKwBEm2vATRusAE4b7EBDXCyAQ1xswENcrQBDXO1AQ10twENdbkBEna6ATl3vAENeL4BEnm_ATp6wAENe8EBDXzCARJ9xQE7fsYBP3_HAQiAAcgBCIEByQEIggHKAQiDAcsBCIQBzQEIhQHPARKGAdABQIcB0gEIiAHUARKJAdUBQYoB1gEIiwHXAQiMAdgBEo0B2wFCjgHcAUiPAd0BDpAB3gEOkQHfAQ6SAeABDpMB4QEOlAHjAQ6VAeUBEpYB5gFJlwHoAQ6YAeoBEpkB6wFKmgHsAQ6bAe0BDpwB7gESnQHxAUueAfIBT58B8wEKoAH0AQqhAfUBCqIB9gEKowH3AQqkAfkBCqUB-wESpgH8AVCnAf4BCqgBgAISqQGBAlGqAYICCqsBgwIKrAGEAhKtAYcCUq4BiAJYrwGJAgSwAYoCBLEBiwIEsgGMAgSzAY0CBLQBjwIEtQGRAhK2AZICWbcBlAIEuAGWAhK5AZcCWroBmAIEuwGZAgS8AZoCEr0BnQJbvgGeAmG_AaACA8ABoQIDwQGkAgPCAaUCA8MBpgIDxAGoAgPFAaoCEsYBqwJixwGtAgPIAa8CEskBsAJjygGxAgPLAbICA8wBswISzQG2AmTOAbcCas8BuAIL0AG5AgvRAboCC9IBuwIL0wG8AgvUAb4CC9UBwAIS1gHBAmvXAcMCC9gBxQIS2QHGAmzaAccCC9sByAIL3AHJAhLdAcwCbd4BzQJx"
};
async function decodeBase64AsWasm(wasmBase64) {
  const { Buffer: Buffer2 } = await import("node:buffer");
  const wasmArray = Buffer2.from(wasmBase64, "base64");
  return new WebAssembly.Module(wasmArray);
}
config2.compilerWasm = {
  getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs"),
  getQueryCompilerWasmModule: async () => {
    const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
    return await decodeBase64AsWasm(wasm);
  },
  importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
  return runtime.getPrismaClient(config2);
}

// generated/prisma/internal/prismaNamespace.ts
var prismaNamespace_exports = {};
__export(prismaNamespace_exports, {
  AnyNull: () => AnyNull2,
  BlogCommentScalarFieldEnum: () => BlogCommentScalarFieldEnum,
  BlogPostScalarFieldEnum: () => BlogPostScalarFieldEnum,
  BookingScalarFieldEnum: () => BookingScalarFieldEnum,
  CategoryScalarFieldEnum: () => CategoryScalarFieldEnum,
  ContactMessageScalarFieldEnum: () => ContactMessageScalarFieldEnum,
  DbNull: () => DbNull2,
  Decimal: () => Decimal2,
  JsonNull: () => JsonNull2,
  ModelName: () => ModelName,
  NotificationScalarFieldEnum: () => NotificationScalarFieldEnum,
  NullTypes: () => NullTypes2,
  NullsOrder: () => NullsOrder,
  PaymentScalarFieldEnum: () => PaymentScalarFieldEnum,
  PrismaClientInitializationError: () => PrismaClientInitializationError2,
  PrismaClientKnownRequestError: () => PrismaClientKnownRequestError2,
  PrismaClientRustPanicError: () => PrismaClientRustPanicError2,
  PrismaClientUnknownRequestError: () => PrismaClientUnknownRequestError2,
  PrismaClientValidationError: () => PrismaClientValidationError2,
  QueryMode: () => QueryMode,
  RefreshTokenScalarFieldEnum: () => RefreshTokenScalarFieldEnum,
  ReviewScalarFieldEnum: () => ReviewScalarFieldEnum,
  SortOrder: () => SortOrder,
  Sql: () => Sql2,
  TourPackageScalarFieldEnum: () => TourPackageScalarFieldEnum,
  TransactionIsolationLevel: () => TransactionIsolationLevel,
  UserScalarFieldEnum: () => UserScalarFieldEnum,
  WishlistItemScalarFieldEnum: () => WishlistItemScalarFieldEnum,
  defineExtension: () => defineExtension,
  empty: () => empty2,
  getExtensionContext: () => getExtensionContext,
  join: () => join2,
  prismaVersion: () => prismaVersion,
  raw: () => raw2,
  sql: () => sql
});
import * as runtime2 from "@prisma/client/runtime/client";
var PrismaClientKnownRequestError2 = runtime2.PrismaClientKnownRequestError;
var PrismaClientUnknownRequestError2 = runtime2.PrismaClientUnknownRequestError;
var PrismaClientRustPanicError2 = runtime2.PrismaClientRustPanicError;
var PrismaClientInitializationError2 = runtime2.PrismaClientInitializationError;
var PrismaClientValidationError2 = runtime2.PrismaClientValidationError;
var sql = runtime2.sqltag;
var empty2 = runtime2.empty;
var join2 = runtime2.join;
var raw2 = runtime2.raw;
var Sql2 = runtime2.Sql;
var Decimal2 = runtime2.Decimal;
var getExtensionContext = runtime2.Extensions.getExtensionContext;
var prismaVersion = {
  client: "7.9.1",
  engine: "e922089b7d7502aff4249d5da3420f6fa55fc6ad"
};
var NullTypes2 = {
  DbNull: runtime2.NullTypes.DbNull,
  JsonNull: runtime2.NullTypes.JsonNull,
  AnyNull: runtime2.NullTypes.AnyNull
};
var DbNull2 = runtime2.DbNull;
var JsonNull2 = runtime2.JsonNull;
var AnyNull2 = runtime2.AnyNull;
var ModelName = {
  BlogComment: "BlogComment",
  BlogPost: "BlogPost",
  Booking: "Booking",
  Category: "Category",
  ContactMessage: "ContactMessage",
  Notification: "Notification",
  Payment: "Payment",
  RefreshToken: "RefreshToken",
  Review: "Review",
  TourPackage: "TourPackage",
  User: "User",
  WishlistItem: "WishlistItem"
};
var TransactionIsolationLevel = runtime2.makeStrictEnum({
  ReadUncommitted: "ReadUncommitted",
  ReadCommitted: "ReadCommitted",
  RepeatableRead: "RepeatableRead",
  Serializable: "Serializable"
});
var BlogCommentScalarFieldEnum = {
  id: "id",
  content: "content",
  isDeleted: "isDeleted",
  postId: "postId",
  userId: "userId",
  parentId: "parentId",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var BlogPostScalarFieldEnum = {
  id: "id",
  title: "title",
  slug: "slug",
  excerpt: "excerpt",
  content: "content",
  coverImage: "coverImage",
  status: "status",
  isDeleted: "isDeleted",
  authorId: "authorId",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var BookingScalarFieldEnum = {
  id: "id",
  travelDate: "travelDate",
  travelers: "travelers",
  totalPrice: "totalPrice",
  status: "status",
  userId: "userId",
  packageId: "packageId",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var CategoryScalarFieldEnum = {
  id: "id",
  name: "name",
  slug: "slug",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var ContactMessageScalarFieldEnum = {
  id: "id",
  name: "name",
  email: "email",
  subject: "subject",
  message: "message",
  isResolved: "isResolved",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var NotificationScalarFieldEnum = {
  id: "id",
  userId: "userId",
  type: "type",
  title: "title",
  message: "message",
  link: "link",
  isRead: "isRead",
  createdAt: "createdAt"
};
var PaymentScalarFieldEnum = {
  id: "id",
  bookingId: "bookingId",
  tranId: "tranId",
  valId: "valId",
  amount: "amount",
  currency: "currency",
  status: "status",
  gatewayPageUrl: "gatewayPageUrl",
  sslSessionKey: "sslSessionKey",
  cardType: "cardType",
  bankTranId: "bankTranId",
  paidAt: "paidAt",
  refundRefId: "refundRefId",
  refundInitiatedAt: "refundInitiatedAt",
  refundCompletedAt: "refundCompletedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var RefreshTokenScalarFieldEnum = {
  id: "id",
  userId: "userId",
  hash: "hash",
  expiresAt: "expiresAt",
  createdAt: "createdAt",
  revokedAt: "revokedAt"
};
var ReviewScalarFieldEnum = {
  id: "id",
  rating: "rating",
  comment: "comment",
  isDeleted: "isDeleted",
  userId: "userId",
  packageId: "packageId",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var TourPackageScalarFieldEnum = {
  id: "id",
  title: "title",
  slug: "slug",
  description: "description",
  location: "location",
  price: "price",
  duration: "duration",
  rating: "rating",
  images: "images",
  status: "status",
  isDeleted: "isDeleted",
  categoryId: "categoryId",
  agentId: "agentId",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var UserScalarFieldEnum = {
  id: "id",
  name: "name",
  email: "email",
  password: "password",
  googleId: "googleId",
  phone: "phone",
  avatarUrl: "avatarUrl",
  role: "role",
  status: "status",
  authProvider: "authProvider",
  emailVerified: "emailVerified",
  isDeleted: "isDeleted",
  tokenVersion: "tokenVersion",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var WishlistItemScalarFieldEnum = {
  id: "id",
  userId: "userId",
  packageId: "packageId",
  createdAt: "createdAt"
};
var SortOrder = {
  asc: "asc",
  desc: "desc"
};
var QueryMode = {
  default: "default",
  insensitive: "insensitive"
};
var NullsOrder = {
  first: "first",
  last: "last"
};
var defineExtension = runtime2.Extensions.defineExtension;

// generated/prisma/enums.ts
var Role = {
  USER: "USER",
  AGENT: "AGENT",
  ADMIN: "ADMIN"
};
var UserStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED"
};
var PackageStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
};
var BookingStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED"
};
var PaymentStatus = {
  INITIATED: "INITIATED",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED"
};
var PostStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED"
};
var NotificationType = {
  BOOKING_CREATED: "BOOKING_CREATED",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  PACKAGE_APPROVED: "PACKAGE_APPROVED",
  PACKAGE_REJECTED: "PACKAGE_REJECTED"
};

// generated/prisma/client.ts
globalThis["__dirname"] = path2.dirname(fileURLToPath(import.meta.url));
var PrismaClient = getPrismaClientClass();

// src/utils/appError.ts
var AppError = class extends Error {
  statusCode;
  constructor(statusCode, message) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
};

// src/middleware/globalErrorHandler.ts
var globalErrorHandler = (err, req, res, next) => {
  if (config_default.node_env !== "production") {
    console.error("Error:", err);
  }
  let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
  let errorMessage = err?.message || "Internal Server Error";
  let errorName = err?.name || "Error";
  if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorMessage = err.issues.map((i) => i.message).join(", ");
    errorName = "ZodError";
  } else if (err instanceof multer.MulterError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorName = "MulterError";
    errorMessage = err.code === "LIMIT_FILE_SIZE" ? "File too large. Maximum size is 5MB." : `Upload failed: ${err.code}`;
  } else if (err instanceof Error && err.code === "INVALID_FILE_TYPE") {
    statusCode = httpStatus.BAD_REQUEST;
    errorMessage = err.message;
  } else if (err instanceof prismaNamespace_exports.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorMessage = "You have provided incorrect field type or missing required fields";
    errorName = "PrismaClientValidationError";
  } else if (err instanceof prismaNamespace_exports.PrismaClientKnownRequestError) {
    errorName = "PrismaClientKnownRequestError";
    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      errorMessage = "This value already exists";
    } else if (err.code === "P2003") {
      statusCode = httpStatus.CONFLICT;
      errorMessage = "Foreign key constraint failed";
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      errorMessage = "An operation failed because one or more required records were not found.";
    } else {
      statusCode = httpStatus.BAD_REQUEST;
      errorMessage = err.message;
    }
  } else if (err instanceof prismaNamespace_exports.PrismaClientInitializationError) {
    errorName = "PrismaClientInitializationError";
    if (err.errorCode === "P1000") {
      statusCode = httpStatus.UNAUTHORIZED;
      errorMessage = "Authentication failed against the database server. Please check your database credentials.";
    } else if (err.errorCode === "P1001") {
      statusCode = httpStatus.SERVICE_UNAVAILABLE;
      errorMessage = "Can't reach the database server.";
    } else {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = err.message;
    }
  } else if (err instanceof prismaNamespace_exports.PrismaClientUnknownRequestError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    errorName = "PrismaClientUnknownRequestError";
    errorMessage = "Error occurred during query execution";
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorMessage = err.message;
    errorName = err.name || "AppError";
  } else if (err instanceof Error) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    errorMessage = err.message || "Internal Server Error";
    errorName = err.name || "Error";
  }
  res.status(statusCode).json({
    success: false,
    statusCode,
    name: errorName,
    message: errorMessage,
    error: process.env.NODE_ENV === "development" ? err.stack : void 0
  });
};
var globalErrorHandler_default = globalErrorHandler;

// src/lib/prisma.ts
import { PrismaPg } from "@prisma/adapter-pg";
var connectionString = config_default.database_url;
var adapter = new PrismaPg({ connectionString, max: 1 });
var prisma = new PrismaClient({ adapter });

// src/modules/auth/auth.route.ts
import { Router } from "express";

// src/modules/auth/auth.controller.ts
import httpStatus2 from "http-status";

// src/modules/auth/auth.service.ts
import bcrypt from "bcryptjs";
import crypto2 from "crypto";
import { decode } from "jsonwebtoken";

// src/lib/googleAuth.ts
import { OAuth2Client } from "google-auth-library";
var googleClient = new OAuth2Client({
  clientId: config_default.google_client_id
});

// src/lib/redis.ts
import { createClient } from "redis";
var redisClient = config_default.redis_host ? createClient({
  username: config_default.redis_user,
  password: config_default.redis_password,
  socket: {
    host: config_default.redis_host,
    port: parseInt(config_default.redis_port || "6379")
  }
}) : null;
var getRedis = async () => {
  if (!redisClient) return null;
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (error) {
      console.error(
        "[redis] connect failed:",
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }
  return redisClient;
};

// src/utils/jwt.ts
import crypto from "crypto";
import jwt from "jsonwebtoken";
var createToken = (payload, secret, expiresIn) => {
  const token = jwt.sign({ ...payload, jti: crypto.randomUUID() }, secret, expiresIn);
  return token;
};
var verifyToken = (token, secret) => {
  try {
    const verifiedToken = jwt.verify(token, secret);
    return {
      success: true,
      data: verifiedToken
    };
  } catch (error) {
    console.log("Token Verification Failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
};
var jwtUtils = {
  createToken,
  verifyToken
};

// src/lib/nodemailer.ts
import nodemailer from "nodemailer";
var transporter = config_default.smtp_user && config_default.smtp_password ? nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config_default.smtp_user,
    pass: config_default.smtp_password
  }
}) : null;

// src/templates/index.ts
import fs from "fs";
import path3 from "path";
import ejs from "ejs";
var renderTemplate = (name, data) => {
  const candidates = [
    path3.join(process.cwd(), "src/templates"),
    path3.join(process.cwd(), "templates"),
    path3.join(process.cwd(), "api/templates")
  ];
  const dir = candidates.find((d) => fs.existsSync(path3.join(d, `${name}.ejs`)));
  if (!dir) {
    throw new Error(`Email template "${name}.ejs" not found`);
  }
  return ejs.renderFile(path3.join(dir, `${name}.ejs`), data);
};

// src/utils/authEmail.ts
var OTP_EXPIRATION_MINUTES = 5;
async function sendAuthMail(to, subject, build) {
  if (!transporter) {
    console.warn("[email] SMTP not configured; skipping auth email.");
    return;
  }
  try {
    const html = await build();
    await transporter.sendMail({
      from: config_default.smtp_user,
      to,
      subject,
      html
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[email] failed to send "${subject}" to ${to}: ${detail}`);
  }
}
var sendVerificationOtpEmail = async (details) => {
  await sendAuthMail(
    details.email,
    "Email Verification OTP",
    () => renderTemplate("registration-user-otp", {
      name: details.name,
      email: details.email,
      otp: details.otp,
      expirationMinutes: OTP_EXPIRATION_MINUTES
    })
  );
};
var sendForgotPasswordOtpEmail = async (details) => {
  await sendAuthMail(
    details.email,
    "Forgot Password Reset OTP",
    () => renderTemplate("forgot-password", {
      name: details.name,
      otp: details.otp,
      expirationMinutes: OTP_EXPIRATION_MINUTES
    })
  );
};
var sendWelcomeEmail = async (details) => {
  await sendAuthMail(
    details.email,
    "Welcome to TripVerse",
    () => renderTemplate("welcome-email", {
      name: details.name,
      frontendUrl: config_default.node_env === "production" ? config_default.frontend_url_prod : config_default.frontend_url_dev
    })
  );
};
var sendPasswordResetSuccessEmail = async (details) => {
  await sendAuthMail(
    details.email,
    "Password Reset",
    () => renderTemplate("reset-password-success", {
      name: details.name
    })
  );
};

// src/modules/auth/auth.service.ts
var OTP_EXPIRATION_SECONDS = 5 * 60;
var sha256 = (value) => crypto2.createHash("sha256").update(value).digest("hex");
var refreshTokenExpiresAt = (token) => {
  const payload = decode(token);
  return payload?.exp ? new Date(payload.exp * 1e3) : /* @__PURE__ */ new Date();
};
var getRedisClient = async () => {
  const client = await getRedis();
  if (!client) {
    throw new AppError(503, "Email verification is not configured.");
  }
  return client;
};
var buildTokenPayload = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  tokenVersion: user.tokenVersion
});
var issueTokens = async (user, client = prisma) => {
  const tokenPayload = buildTokenPayload(user);
  const accessToken = jwtUtils.createToken(
    tokenPayload,
    config_default.jwt_access_secret,
    { expiresIn: config_default.jwt_access_expires_in }
  );
  const refreshToken3 = jwtUtils.createToken(
    tokenPayload,
    config_default.jwt_refresh_secret,
    { expiresIn: config_default.jwt_refresh_expires_in }
  );
  await client.refreshToken.create({
    data: {
      userId: user.id,
      hash: sha256(refreshToken3),
      expiresAt: refreshTokenExpiresAt(refreshToken3)
    }
  });
  return { accessToken, refreshToken: refreshToken3 };
};
var sanitizeUser = (user) => {
  const { password, ...rest } = user;
  return rest;
};
var registerUser = async (payload) => {
  const { name, password, phone, role } = payload;
  const email = payload.email.trim().toLowerCase();
  if (role && role !== "USER" && role !== "AGENT") {
    throw new AppError(400, "Role must be either USER or AGENT");
  }
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  if (existingUser) {
    throw new AppError(409, "User with this email already exists");
  }
  const client = await getRedisClient();
  const registrationDataKey = `tripverse:register-data:${email}`;
  const pendingRegistration = await client.get(registrationDataKey);
  if (pendingRegistration) {
    throw new AppError(
      409,
      "Registration is pending verification. Check your email or resend the OTP."
    );
  }
  const hashedPassword = await bcrypt.hash(
    password,
    Number(config_default.bcrypt_salt_rounds)
  );
  const otpKey = `tripverse:register-otp:${email}`;
  const otpValue = crypto2.randomInt(1e5, 1e6).toString();
  await client.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: OTP_EXPIRATION_SECONDS
    }
  });
  const redisUserDataPayload = {
    name,
    email,
    password: hashedPassword,
    phone,
    role: role || "USER"
  };
  await client.set(registrationDataKey, JSON.stringify(redisUserDataPayload), {
    expiration: {
      type: "EX",
      value: OTP_EXPIRATION_SECONDS
    }
  });
  void Promise.allSettled([
    sendVerificationOtpEmail({ email, name, otp: otpValue })
  ]);
};
var verifyEmail = async (payload) => {
  const { otp } = payload;
  const email = payload.email.trim().toLowerCase();
  const isUserExists = await prisma.user.findUnique({ where: { email } });
  if (isUserExists) {
    throw new AppError(409, "Email is already verified");
  }
  const client = await getRedisClient();
  const otpKey = `tripverse:register-otp:${email}`;
  const redisOTP = await client.get(otpKey);
  if (!redisOTP || redisOTP !== otp) {
    throw new AppError(400, "Invalid or expired OTP.");
  }
  await client.del(otpKey);
  const registrationDataKey = `tripverse:register-data:${email}`;
  const redisUserData = await client.get(registrationDataKey);
  if (!redisUserData) {
    throw new AppError(400, "Invalid or expired OTP.");
  }
  const userPayload = JSON.parse(redisUserData);
  const createdUser = await prisma.user.create({
    data: {
      name: userPayload.name,
      email: userPayload.email,
      password: userPayload.password,
      phone: userPayload.phone,
      role: userPayload.role || "USER",
      authProvider: "CREDENTIAL",
      status: "ACTIVE",
      emailVerified: true
    },
    omit: { password: true }
  });
  await client.del(registrationDataKey);
  void Promise.allSettled([
    sendWelcomeEmail({ email: createdUser.email, name: createdUser.name })
  ]);
  const tokens = await issueTokens(createdUser);
  return { ...tokens, user: createdUser };
};
var resendVerification = async (payload) => {
  const email = payload.email.trim().toLowerCase();
  const client = await getRedisClient();
  const registrationDataKey = `tripverse:register-data:${email}`;
  const redisUserData = await client.get(registrationDataKey);
  if (!redisUserData) {
    return;
  }
  const userPayload = JSON.parse(redisUserData);
  const otpKey = `tripverse:register-otp:${email}`;
  const otpValue = crypto2.randomInt(1e5, 1e6).toString();
  await client.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: OTP_EXPIRATION_SECONDS
    }
  });
  void Promise.allSettled([
    sendVerificationOtpEmail({ email, name: userPayload.name, otp: otpValue })
  ]);
};
var forgotPassword = async (payload) => {
  const email = payload.email.trim().toLowerCase();
  const isUserExists = await prisma.user.findUnique({ where: { email } });
  if (!isUserExists || isUserExists.isDeleted || isUserExists.status === "SUSPENDED" || !isUserExists.emailVerified || isUserExists.authProvider === "GOOGLE") {
    return;
  }
  const client = await getRedisClient();
  const otp = crypto2.randomInt(1e5, 1e6).toString();
  const key = `tripverse:forgot-password-otp:${isUserExists.email}`;
  await client.set(key, otp, {
    expiration: {
      type: "EX",
      value: OTP_EXPIRATION_SECONDS
    }
  });
  void Promise.allSettled([
    sendForgotPasswordOtpEmail({
      email: isUserExists.email,
      name: isUserExists.name,
      otp
    })
  ]);
};
var resetPassword = async (payload) => {
  const { newPassword, otp } = payload;
  const email = payload.email.trim().toLowerCase();
  const isUserExists = await prisma.user.findUnique({ where: { email } });
  if (!isUserExists || isUserExists.isDeleted || isUserExists.status === "SUSPENDED" || isUserExists.authProvider === "GOOGLE") {
    throw new AppError(400, "Invalid or expired OTP.");
  }
  const client = await getRedisClient();
  const key = `tripverse:forgot-password-otp:${isUserExists.email}`;
  const redisOTP = await client.get(key);
  if (!redisOTP || redisOTP !== otp) {
    throw new AppError(400, "Invalid or expired OTP.");
  }
  const hashedNewPassword = await bcrypt.hash(
    newPassword,
    Number(config_default.bcrypt_salt_rounds)
  );
  await prisma.user.update({
    where: { email: isUserExists.email },
    data: {
      password: hashedNewPassword,
      tokenVersion: { increment: 1 }
    }
  });
  await client.del(key);
  void Promise.allSettled([
    sendPasswordResetSuccessEmail({
      email: isUserExists.email,
      name: isUserExists.name
    })
  ]);
};
var loginUser = async (payload) => {
  const { email, password } = payload;
  const user = await prisma.user.findUnique({
    where: { email }
  });
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }
  if (user.isDeleted) {
    throw new AppError(403, "Account has been deleted");
  }
  if (user.status === "SUSPENDED") {
    throw new AppError(403, "Account is suspended");
  }
  if (user.authProvider === "GOOGLE") {
    throw new AppError(
      400,
      "This account uses Google login. Please log in with Google."
    );
  }
  const isPasswordValid = await bcrypt.compare(password, user.password || "");
  if (!isPasswordValid) {
    throw new AppError(401, "Invalid email or password");
  }
  return await issueTokens(user);
};
var googleLogin = async (payload) => {
  const { idToken } = payload;
  if (!config_default.google_client_id) {
    throw new AppError(
      400,
      "Google login is not configured. Please contact support."
    );
  }
  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config_default.google_client_id
    });
  } catch {
    throw new AppError(401, "Invalid Google token");
  }
  const googleData = ticket.getPayload();
  if (!googleData) {
    throw new AppError(400, "Invalid Google token payload");
  }
  const { email, name, sub, picture } = googleData;
  if (!email || !googleData.email_verified) {
    throw new AppError(400, "Google account email is not verified");
  }
  let user = await prisma.user.findUnique({ where: { googleId: sub } });
  if (!user && email) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      if (user.googleId && user.googleId !== sub) {
        throw new AppError(
          409,
          "Email is already linked to another Google account"
        );
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: sub, emailVerified: true }
      });
    }
  }
  if (!user) {
    const localPart = email.split("@")[0] ?? email;
    const displayName = (name ?? "").trim() || localPart;
    user = await prisma.user.create({
      data: {
        email,
        name: displayName,
        password: null,
        authProvider: "GOOGLE",
        googleId: sub,
        emailVerified: true,
        role: "USER",
        avatarUrl: picture || null
      }
    });
  }
  const tokens = await issueTokens(user);
  const sanitizedUser = sanitizeUser(user);
  return { ...tokens, user: sanitizedUser };
};
var DEMO_PASSWORD = "demo123";
var demoLogin = async (payload) => {
  const { role } = payload;
  const demoUser = await prisma.user.upsert({
    where: { email: `demo-${role.toLowerCase()}@tripverse.com` },
    // resurrect demo accounts that an admin suspended or soft-deleted
    update: { status: "ACTIVE", isDeleted: false },
    create: {
      name: `Demo ${role.charAt(0) + role.slice(1).toLowerCase()}`,
      email: `demo-${role.toLowerCase()}@tripverse.com`,
      password: await bcrypt.hash(DEMO_PASSWORD, Number(config_default.bcrypt_salt_rounds)),
      authProvider: "CREDENTIAL",
      role,
      status: "ACTIVE",
      emailVerified: true
    },
    omit: { password: true }
  });
  return { ...await issueTokens(demoUser), user: demoUser };
};
var revokeFamily = async (userId) => {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: /* @__PURE__ */ new Date() }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } }
    })
  ]);
};
var refreshToken = async (payload) => {
  const { refreshToken: providedRefreshToken } = payload;
  const verified = jwtUtils.verifyToken(
    providedRefreshToken,
    config_default.jwt_refresh_secret
  );
  if (!verified.success) {
    throw new AppError(401, verified.error);
  }
  const { id, tokenVersion: tokenTokenVersion } = verified.data;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(403, "Account has been deleted");
  }
  if (user.status === "SUSPENDED") {
    throw new AppError(403, "Account is suspended");
  }
  if (user.tokenVersion !== tokenTokenVersion) {
    throw new AppError(401, "Token is no longer valid. Please login again.");
  }
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
  await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: /* @__PURE__ */ new Date() } }, { revokedAt: { lte: weekAgo } }]
    }
  });
  const row = await prisma.refreshToken.findUnique({
    where: { hash: sha256(providedRefreshToken) }
  });
  if (!row) {
    throw new AppError(401, "Invalid refresh token. Please login again.");
  }
  if (row.revokedAt) {
    await revokeFamily(user.id);
    throw new AppError(401, "Refresh token reuse detected. Please login again.");
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, "Refresh token has expired. Please login again.");
  }
  const outcome = await prisma.$transaction(async (tx) => {
    const rotated = await tx.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: /* @__PURE__ */ new Date() }
    });
    if (rotated.count === 0) {
      return "LOST";
    }
    const tokens = await issueTokens(user, tx);
    return { tokens };
  });
  if (outcome === "LOST") {
    await revokeFamily(user.id);
    throw new AppError(401, "Refresh token reuse detected. Please login again.");
  }
  return outcome.tokens;
};
var logout = async (userId) => {
  await revokeFamily(userId);
};
var getMeFromDB = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    omit: { password: true }
  });
  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }
  return user;
};
var authService = {
  registerUser,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  loginUser,
  googleLogin,
  demoLogin,
  refreshToken,
  logout,
  getMeFromDB
};

// src/utils/catchAsync.ts
var catchAsync = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// src/utils/sendResponse.ts
var sendResponse = (res, data) => {
  res.status(data.statusCode).json({
    success: data.success,
    message: data.message,
    data: data.data,
    meta: data.meta
  });
};

// src/modules/auth/auth.controller.ts
var isProduction = process.env.NODE_ENV === "production";
var cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax"
};
var ACCESS_COOKIE_MAX_AGE = 24 * 60 * 60 * 1e3;
var REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1e3;
var setAuthCookies = (res, { accessToken, refreshToken: refreshToken3 }) => {
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_COOKIE_MAX_AGE
  });
  res.cookie("refreshToken", refreshToken3, {
    ...cookieOptions,
    maxAge: REFRESH_COOKIE_MAX_AGE
  });
};
var clearAuthCookies = (res) => {
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
};
var registerUser2 = catchAsync(
  async (req, res, next) => {
    await authService.registerUser(req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.CREATED,
      message: "Verification OTP sent to your email.",
      data: null
    });
  }
);
var loginUser2 = catchAsync(
  async (req, res, next) => {
    const { accessToken, refreshToken: refreshToken3 } = await authService.loginUser(req.body);
    setAuthCookies(res, { accessToken, refreshToken: refreshToken3 });
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.OK,
      message: "User logged in successfully",
      data: { accessToken, refreshToken: refreshToken3 }
    });
  }
);
var googleLogin2 = catchAsync(
  async (req, res, next) => {
    const { accessToken, refreshToken: refreshToken3, user } = await authService.googleLogin(
      req.body
    );
    setAuthCookies(res, { accessToken, refreshToken: refreshToken3 });
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.OK,
      message: "User logged in successfully",
      data: { accessToken, refreshToken: refreshToken3, user }
    });
  }
);
var demoLogin2 = catchAsync(
  async (req, res, next) => {
    const { accessToken, refreshToken: refreshToken3, user } = await authService.demoLogin(
      req.body
    );
    setAuthCookies(res, { accessToken, refreshToken: refreshToken3 });
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.OK,
      message: "Demo user logged in successfully",
      data: { accessToken, refreshToken: refreshToken3, user }
    });
  }
);
var verifyEmail2 = catchAsync(
  async (req, res, next) => {
    const { accessToken, refreshToken: refreshToken3, user } = await authService.verifyEmail(
      req.body
    );
    setAuthCookies(res, { accessToken, refreshToken: refreshToken3 });
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.OK,
      message: "Email verified successfully",
      data: { accessToken, refreshToken: refreshToken3, user }
    });
  }
);
var resendVerification2 = catchAsync(
  async (req, res, next) => {
    await authService.resendVerification(req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.OK,
      message: "Verification OTP sent to your email.",
      data: null
    });
  }
);
var forgotPassword2 = catchAsync(
  async (req, res, next) => {
    await authService.forgotPassword(req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.OK,
      message: "If an account with that email exists, a password reset OTP has been sent.",
      data: null
    });
  }
);
var resetPassword2 = catchAsync(
  async (req, res, next) => {
    await authService.resetPassword(req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.OK,
      message: "Password reset successfully. Please login again.",
      data: null
    });
  }
);
var refreshToken2 = catchAsync(
  async (req, res, next) => {
    const refreshTokenFromCookie = req.cookies.refreshToken;
    const refreshTokenFromBody = req.body?.refreshToken;
    if (!refreshTokenFromCookie && !refreshTokenFromBody) {
      return sendResponse(res, {
        success: false,
        statusCode: httpStatus2.UNAUTHORIZED,
        message: "Refresh token is required",
        data: null
      });
    }
    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshToken({
      refreshToken: refreshTokenFromCookie || refreshTokenFromBody
    });
    setAuthCookies(res, {
      accessToken,
      refreshToken: newRefreshToken
    });
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.OK,
      message: "Token refreshed successfully",
      data: { accessToken, refreshToken: newRefreshToken }
    });
  }
);
var logoutUser = catchAsync(
  async (req, res, next) => {
    const userId = req.user?.id;
    await authService.logout(userId);
    clearAuthCookies(res);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.OK,
      message: "User logged out successfully",
      data: null
    });
  }
);
var getMe = catchAsync(
  async (req, res, next) => {
    const userId = req.user?.id;
    const user = await authService.getMeFromDB(userId);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.OK,
      message: "User fetched successfully.",
      data: user
    });
  }
);
var authController = {
  registerUser: registerUser2,
  verifyEmail: verifyEmail2,
  resendVerification: resendVerification2,
  forgotPassword: forgotPassword2,
  resetPassword: resetPassword2,
  loginUser: loginUser2,
  googleLogin: googleLogin2,
  demoLogin: demoLogin2,
  refreshToken: refreshToken2,
  logoutUser,
  getMe
};

// src/modules/auth/auth.validation.ts
import { z as z2 } from "zod";
var registerSchema = z2.object({
  name: z2.string({ required_error: "Name is required" }).trim().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters"),
  email: z2.string({ required_error: "Email is required" }).trim().email("Please provide a valid email"),
  password: z2.string({ required_error: "Password is required" }).min(6, "Password must be at least 6 characters").max(72, "Password must be at most 72 characters"),
  phone: z2.string().max(20, "Phone number is too long").optional(),
  role: z2.nativeEnum(Role).optional()
});
var loginSchema = z2.object({
  email: z2.string({ required_error: "Email is required" }).trim().email("Please provide a valid email"),
  password: z2.string({ required_error: "Password is required" }).min(1)
});
var googleLoginSchema = z2.object({
  idToken: z2.string({ required_error: "Google idToken is required" }).min(1)
});
var demoLoginSchema = z2.object({
  role: z2.nativeEnum(Role, {
    required_error: "Please provide a role"
  })
});
var refreshTokenSchema = z2.object({
  refreshToken: z2.string().min(1).optional()
});
var emailSchema = z2.string({ required_error: "Email is required" }).trim().email("Please provide a valid email");
var otpSchema = z2.string({ required_error: "OTP is required" }).length(6, "OTP must be exactly 6 digits").regex(/^\d{6}$/, "OTP must be exactly 6 digits");
var verifyEmailSchema = z2.object({
  email: emailSchema,
  otp: otpSchema
});
var resendVerificationSchema = z2.object({
  email: emailSchema
});
var forgotPasswordSchema = z2.object({
  email: emailSchema
});
var resetPasswordSchema = z2.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: z2.string({ required_error: "New password is required" }).min(6, "Password must be at least 6 characters").max(72, "Password must be at most 72 characters")
});
var authValidations = {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  demoLoginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema
};

// src/middleware/validateRequest.ts
var validateRequest = (schema) => {
  return (req, res, next) => {
    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }
    if (schema.query) {
      const parsedQuery = schema.query.parse(req.query);
      Object.defineProperty(req, "query", {
        value: parsedQuery,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
    if (schema.params) {
      const parsedParams = schema.params.parse(req.params);
      Object.defineProperty(req, "params", {
        value: parsedParams,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
    next();
  };
};
var validateRequest_default = validateRequest;

// src/middleware/auth.ts
var auth = (...requiredRoles) => {
  return catchAsync(async (req, res, next) => {
    const token = req.cookies.accessToken ? req.cookies.accessToken : req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : req.headers.authorization;
    if (!token) {
      throw new AppError(
        401,
        "You are not logged in. Please login to continue."
      );
    }
    const verifiedToken = jwtUtils.verifyToken(
      token,
      config_default.jwt_access_secret
    );
    if (!verifiedToken.success) {
      throw new AppError(401, verifiedToken.error);
    }
    const { id, tokenVersion } = verifiedToken.data;
    const user = await prisma.user.findUnique({
      where: { id }
    });
    if (!user || user.isDeleted) {
      throw new AppError(401, "User not found.");
    }
    if (user.status === "SUSPENDED") {
      throw new AppError(
        403,
        "User is suspended. Please contact support service."
      );
    }
    if (user.tokenVersion !== tokenVersion) {
      throw new AppError(
        401,
        "Session is no longer valid. Please login again."
      );
    }
    if (requiredRoles.length && !requiredRoles.includes(user.role)) {
      throw new AppError(
        403,
        "You are not authorized to access this route."
      );
    }
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    next();
  });
};
var auth_default = auth;

// src/modules/auth/auth.route.ts
var router = Router();
router.post(
  "/register",
  validateRequest_default({ body: authValidations.registerSchema }),
  authController.registerUser
);
router.post(
  "/login",
  validateRequest_default({ body: authValidations.loginSchema }),
  authController.loginUser
);
router.post(
  "/google",
  validateRequest_default({ body: authValidations.googleLoginSchema }),
  authController.googleLogin
);
router.post(
  "/demo-login",
  validateRequest_default({ body: authValidations.demoLoginSchema }),
  authController.demoLogin
);
router.post(
  "/refresh",
  validateRequest_default({ body: authValidations.refreshTokenSchema }),
  authController.refreshToken
);
router.post("/logout", auth_default(), authController.logoutUser);
router.get("/me", auth_default(), authController.getMe);
router.post(
  "/verify-email",
  validateRequest_default({ body: authValidations.verifyEmailSchema }),
  authController.verifyEmail
);
router.post(
  "/resend-verification",
  validateRequest_default({ body: authValidations.resendVerificationSchema }),
  authController.resendVerification
);
router.post(
  "/forgot-password",
  validateRequest_default({ body: authValidations.forgotPasswordSchema }),
  authController.forgotPassword
);
router.post(
  "/reset-password",
  validateRequest_default({ body: authValidations.resetPasswordSchema }),
  authController.resetPassword
);
var authRoutes = router;

// src/modules/user/user.route.ts
import { Router as Router2 } from "express";

// src/modules/user/user.controller.ts
import httpStatus3 from "http-status";

// src/modules/user/user.service.ts
import bcrypt2 from "bcryptjs";
var validateActiveUser = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }
  if (user.status === "SUSPENDED") {
    throw new AppError(403, "User is suspended. Please contact support service.");
  }
  return user;
};
var updateProfile = async (userId, payload) => {
  const { name, phone, avatarUrl, currentPassword, newPassword } = payload;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.isDeleted) {
    throw new AppError(403, "Account has been deleted");
  }
  if (user.authProvider === "GOOGLE") {
    throw new AppError(
      403,
      "Google accounts cannot change password. Use Google sign-in to manage your profile."
    );
  }
  const data = {};
  if (name) data.name = name;
  if (phone) data.phone = phone;
  if (avatarUrl) data.avatarUrl = avatarUrl;
  if (newPassword) {
    if (!currentPassword) {
      throw new AppError(400, "Current password is required");
    }
    if (currentPassword === newPassword) {
      throw new AppError(400, "New password must be different");
    }
    const isMatch = await bcrypt2.compare(currentPassword, user.password || "");
    if (!isMatch) {
      throw new AppError(400, "Invalid current password");
    }
    data.password = await bcrypt2.hash(
      newPassword,
      Number(config_default.bcrypt_salt_rounds)
    );
    data.tokenVersion = { increment: 1 };
  }
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data,
    omit: { password: true }
  });
  return updatedUser;
};
var getUsers = async (query) => {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const where = {
    isDeleted: false
  };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } }
    ];
  }
  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      omit: { password: true }
    }),
    prisma.user.count({ where })
  ]);
  return {
    data: users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};
var changeRole = async (id, payload) => {
  const { role } = payload;
  await validateActiveUser(id);
  const updatedUser = await prisma.user.update({
    where: { id },
    data: { role, tokenVersion: { increment: 1 } },
    omit: { password: true }
  });
  return updatedUser;
};
var changeStatus = async (id, payload) => {
  const { status } = payload;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }
  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      status,
      // reactivating preserves the account while suspending revokes all sessions
      ...status === UserStatus.SUSPENDED && { tokenVersion: { increment: 1 } }
    },
    omit: { password: true }
  });
  return updatedUser;
};
var deleteUser = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }
  const deletedUser = await prisma.user.update({
    where: { id },
    data: { isDeleted: true, tokenVersion: { increment: 1 } },
    omit: { password: true }
  });
  return deletedUser;
};
var userService = {
  updateProfile,
  getUsers,
  changeRole,
  changeStatus,
  deleteUser
};

// src/modules/user/user.controller.ts
var updateProfile2 = catchAsync(
  async (req, res, next) => {
    const userId = req.user?.id;
    const user = await userService.updateProfile(userId, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus3.OK,
      message: "Profile updated successfully.",
      data: user
    });
  }
);
var getUsers2 = catchAsync(
  async (req, res, next) => {
    const result = await userService.getUsers(req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus3.OK,
      message: "Users fetched successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var changeRole2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    if (id === req.user?.id) {
      return sendResponse(res, {
        success: false,
        statusCode: httpStatus3.FORBIDDEN,
        message: "You cannot change your own role.",
        data: null
      });
    }
    const user = await userService.changeRole(id, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus3.OK,
      message: "User role updated successfully.",
      data: user
    });
  }
);
var changeStatus2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    if (id === req.user?.id) {
      return sendResponse(res, {
        success: false,
        statusCode: httpStatus3.FORBIDDEN,
        message: "You cannot change your own status.",
        data: null
      });
    }
    const user = await userService.changeStatus(id, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus3.OK,
      message: "User status updated successfully.",
      data: user
    });
  }
);
var deleteUser2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    if (id === req.user?.id) {
      return sendResponse(res, {
        success: false,
        statusCode: httpStatus3.FORBIDDEN,
        message: "You cannot delete your own account.",
        data: null
      });
    }
    const user = await userService.deleteUser(id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus3.OK,
      message: "User deleted successfully.",
      data: user
    });
  }
);
var userController = {
  updateProfile: updateProfile2,
  getUsers: getUsers2,
  changeRole: changeRole2,
  changeStatus: changeStatus2,
  deleteUser: deleteUser2
};

// src/modules/user/user.validation.ts
import { z as z3 } from "zod";
var updateProfileSchema = z3.object({
  name: z3.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters").optional(),
  phone: z3.string().trim().max(20, "Phone number is too long").optional(),
  avatarUrl: z3.string().trim().url("Please provide a valid image URL").optional(),
  currentPassword: z3.string().min(1).optional(),
  newPassword: z3.string().min(6, "Password must be at least 6 characters").max(72, "Password must be at most 72 characters").optional()
}).refine(
  (data) => data.newPassword === void 0 || data.currentPassword !== void 0,
  { message: "Current password is required to change password" }
);
var userQuerySchema = z3.object({
  page: z3.coerce.number().int().min(1).default(1),
  limit: z3.coerce.number().int().min(1).max(50).default(10),
  search: z3.string().trim().optional(),
  role: z3.nativeEnum(Role).optional(),
  status: z3.nativeEnum(UserStatus).optional()
});
var userParamsSchema = z3.object({
  id: z3.string({ required_error: "User id is required" }).min(1)
});
var changeRoleSchema = z3.object({
  role: z3.nativeEnum(Role, { required_error: "Please provide a role" })
});
var changeStatusSchema = z3.object({
  status: z3.nativeEnum(UserStatus, {
    required_error: "Please provide a status"
  })
});
var userValidations = {
  updateProfileSchema,
  userQuerySchema,
  userParamsSchema,
  changeRoleSchema,
  changeStatusSchema
};

// src/modules/user/user.route.ts
var router2 = Router2();
router2.patch(
  "/profile",
  auth_default(),
  validateRequest_default({ body: userValidations.updateProfileSchema }),
  userController.updateProfile
);
router2.get(
  "/",
  auth_default(Role.ADMIN),
  validateRequest_default({ query: userValidations.userQuerySchema }),
  userController.getUsers
);
router2.patch(
  "/:id/role",
  auth_default(Role.ADMIN),
  validateRequest_default({
    params: userValidations.userParamsSchema,
    body: userValidations.changeRoleSchema
  }),
  userController.changeRole
);
router2.patch(
  "/:id/status",
  auth_default(Role.ADMIN),
  validateRequest_default({
    params: userValidations.userParamsSchema,
    body: userValidations.changeStatusSchema
  }),
  userController.changeStatus
);
router2.delete(
  "/:id",
  auth_default(Role.ADMIN),
  validateRequest_default({ params: userValidations.userParamsSchema }),
  userController.deleteUser
);
var userRoutes = router2;

// src/modules/uploads/uploads.route.ts
import { Router as Router3 } from "express";
import multer2 from "multer";

// src/modules/uploads/uploads.controller.ts
import httpStatus4 from "http-status";

// src/lib/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: config_default.cloudinary_cloud_name,
  api_key: config_default.cloudinary_api_key,
  api_secret: config_default.cloudinary_api_secret
});
var cloudinary_default = cloudinary;

// src/modules/uploads/uploads.service.ts
var uploadImageToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary_default.uploader.upload_stream(
      { folder: "tripverse" },
      (error, result) => {
        if (error || !result) {
          reject(new AppError(400, "Image upload failed. Please try again."));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(file.buffer);
  });
};

// src/modules/uploads/uploads.controller.ts
var uploadImage = catchAsync(
  async (req, res, next) => {
    if (!req.file) {
      throw new AppError(400, "Image file is required");
    }
    const result = await uploadImageToCloudinary(req.file);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus4.CREATED,
      message: "Image uploaded successfully.",
      data: result
    });
  }
);
var uploadsController = {
  uploadImage
};

// src/modules/uploads/uploads.route.ts
var upload = multer2({
  storage: multer2.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(new Error("Only jpg, png or webp images are allowed"), {
          code: "INVALID_FILE_TYPE"
        })
      );
    }
  }
});
var router3 = Router3();
router3.post(
  "/image",
  auth_default(Role.AGENT, Role.ADMIN),
  upload.single("image"),
  uploadsController.uploadImage
);
var uploadRoutes = router3;

// src/modules/contact/contact.route.ts
import { Router as Router4 } from "express";

// src/modules/contact/contact.controller.ts
import httpStatus5 from "http-status";

// src/utils/email.ts
import { Resend } from "resend";
var resend = null;
function getResend() {
  if (resend) return resend;
  if (!config_default.resend_api_key) return null;
  resend = new Resend(config_default.resend_api_key);
  return resend;
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
async function sendWithLog(client, subject, to, html, replyTo) {
  try {
    await client.emails.send({
      from: config_default.email_from || "TripVerse <onboarding@resend.dev>",
      to,
      subject,
      html,
      ...replyTo ? { replyTo } : {}
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[email] send failed (${subject}) to ${to.join(", ")}: ${detail}`);
  }
}
var emailLayout = (content) => `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
    <div style="background: #0f766e; padding: 24px; border-radius: 8px 8px 0 0;">
      <span style="color: #ffffff; font-size: 18px; font-weight: bold;">TripVerse</span>
    </div>
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
      ${content}
    </div>
    <p style="font-size: 12px; color: #6b7280; margin-top: 16px; text-align: center;">
      You are receiving this email because of activity on TripVerse.
    </p>
  </div>
`;
var sendContactNotification = async (details) => {
  const client = getResend();
  if (!client || !config_default.contact_receiver_email) {
    console.warn("[email] Resend not configured; skipping contact notification.");
    return;
  }
  const createdAt = details.createdAt?.toISOString() ?? "just now";
  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">New contact message</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; width: 120px;">Name</td>
        <td style="padding: 8px 0;"><strong>${escapeHtml(details.name)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Email</td>
        <td style="padding: 8px 0;">${escapeHtml(details.email)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Subject</td>
        <td style="padding: 8px 0;"><strong>${escapeHtml(details.subject)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Received</td>
        <td style="padding: 8px 0;">${escapeHtml(createdAt)}</td>
      </tr>
    </table>
    <div style="margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 6px; white-space: pre-wrap;">
      ${escapeHtml(details.message)}
    </div>
  `;
  await sendWithLog(
    client,
    `New contact message: ${details.subject}`,
    [config_default.contact_receiver_email],
    emailLayout(content)
  );
};
var sendContactAutoReply = async (details) => {
  const client = getResend();
  if (!client || !details.email) {
    console.warn("[email] Resend not configured; skipping contact auto-reply.");
    return;
  }
  const receiverEmail = config_default.contact_receiver_email;
  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">Thanks for reaching out, ${escapeHtml(details.name)}!</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      We&apos;ve received your message about
      <strong>&ldquo;${escapeHtml(details.subject)}&rdquo;</strong> and our support
      team will get back to you within one business day.
    </p>
  `;
  await sendWithLog(
    client,
    "We received your message - TripVerse",
    [details.email],
    emailLayout(content),
    receiverEmail
  );
};
var sendBookingEmail = async (details) => {
  const client = getResend();
  if (!client || !details.email) {
    console.warn("[email] Resend not configured; skipping booking email.");
    return;
  }
  const travelDate = details.travelDate.toISOString().slice(0, 10);
  const statusCopy = {
    [BookingStatus.PENDING]: {
      subject: "Booking received - TripVerse",
      heading: "Booking received",
      body: "We've received your booking request. The agent will confirm it shortly."
    },
    [BookingStatus.PAID]: {
      subject: "Payment received - TripVerse",
      heading: "Payment received",
      body: "Your payment has been received, and the agent will confirm your booking shortly."
    },
    [BookingStatus.CONFIRMED]: {
      subject: "Booking confirmed - TripVerse",
      heading: "Booking confirmed",
      body: "Great news \u2014 your booking has been confirmed. We look forward to hosting you!"
    },
    [BookingStatus.CANCELLED]: {
      subject: "Booking cancelled - TripVerse",
      heading: "Booking cancelled",
      body: "Your booking has been cancelled. If this wasn't expected, please contact support."
    },
    [BookingStatus.COMPLETED]: {
      subject: "Trip completed - TripVerse",
      heading: "Trip completed",
      body: "Your trip has been marked as completed. Thank you for travelling with TripVerse!"
    }
  };
  const copy = statusCopy[details.status];
  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">${copy.heading}</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      Hi ${escapeHtml(details.name)},<br/>
      ${copy.body}
    </p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; width: 120px;">Package</td>
        <td style="padding: 8px 0;"><strong>${escapeHtml(details.packageTitle)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Travel date</td>
        <td style="padding: 8px 0;">${escapeHtml(travelDate)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Travelers</td>
        <td style="padding: 8px 0;">${escapeHtml(String(details.travelers))}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Total</td>
        <td style="padding: 8px 0;"><strong>&#2547;${escapeHtml(details.totalPrice.toFixed(2))}</strong></td>
      </tr>
    </table>
  `;
  await sendWithLog(
    client,
    copy.subject,
    [details.email],
    emailLayout(content)
  );
};
var sendRefundEmail = async (details) => {
  const client = getResend();
  if (!client || !details.email) {
    console.warn("[email] Resend not configured; skipping refund email.");
    return;
  }
  const travelDate = details.travelDate.toISOString().slice(0, 10);
  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">Refund issued</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      Hi ${escapeHtml(details.name)},<br/>
      Your booking was cancelled, and <strong>&#2547;${escapeHtml(
    details.amount.toFixed(2)
  )}</strong> has been refunded to your original payment method. Please allow
      5-10 business days for the money to appear.
    </p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; width: 120px;">Package</td>
        <td style="padding: 8px 0;"><strong>${escapeHtml(details.packageTitle)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Travel date</td>
        <td style="padding: 8px 0;">${escapeHtml(travelDate)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Refunded amount</td>
        <td style="padding: 8px 0;"><strong>&#2547;${escapeHtml(details.amount.toFixed(2))}</strong></td>
      </tr>
      ${details.refundRefId ? `
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Refund reference</td>
        <td style="padding: 8px 0;">${escapeHtml(details.refundRefId)}</td>
      </tr>` : ""}
    </table>
    <p style="font-size: 13px; line-height: 1.6; color: #6b7280; margin-top: 16px;">
      If you have any questions about this refund, please contact support.
    </p>
  `;
  await sendWithLog(
    client,
    "Booking cancelled & refund issued - TripVerse",
    [details.email],
    emailLayout(content)
  );
};

// src/modules/contact/contact.service.ts
var createMessage = async (payload) => {
  const createdMessage = await prisma.contactMessage.create({
    data: {
      name: payload.name,
      email: payload.email,
      subject: payload.subject,
      message: payload.message
    }
  });
  await Promise.allSettled([
    sendContactNotification({ ...createdMessage, createdAt: createdMessage.createdAt }),
    sendContactAutoReply({ ...createdMessage, createdAt: createdMessage.createdAt })
  ]);
  return createdMessage;
};
var listMessages = async (query) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const where = query.isResolved === void 0 ? void 0 : { isResolved: query.isResolved };
  const [data, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.contactMessage.count({ where })
  ]);
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};
var resolveMessage = async (id, isResolved) => {
  return prisma.contactMessage.update({
    where: { id },
    data: { isResolved }
  });
};
var contactService = {
  createMessage,
  listMessages,
  resolveMessage
};

// src/modules/contact/contact.controller.ts
var createMessage2 = catchAsync(
  async (req, res, next) => {
    const message = await contactService.createMessage(req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus5.CREATED,
      message: "Message sent successfully.",
      data: message
    });
  }
);
var getMessages = catchAsync(
  async (req, res, next) => {
    const result = await contactService.listMessages(req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus5.OK,
      message: "Contact messages retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var updateResolved = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    const { isResolved } = req.body;
    const message = await contactService.resolveMessage(id, isResolved);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus5.OK,
      message: "Message status updated successfully.",
      data: message
    });
  }
);
var contactController = {
  createMessage: createMessage2,
  getMessages,
  updateResolved
};

// src/modules/contact/contact.validation.ts
import { z as z4 } from "zod";
var createMessageSchema = z4.object({
  name: z4.string({ required_error: "Name is required" }).trim().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters"),
  email: z4.string({ required_error: "Email is required" }).trim().email("Please provide a valid email address"),
  subject: z4.string({ required_error: "Subject is required" }).trim().min(2, "Subject must be at least 2 characters").max(200, "Subject must be at most 200 characters"),
  message: z4.string({ required_error: "Message is required" }).trim().min(10, "Message must be at least 10 characters").max(2e3, "Message must be at most 2000 characters")
}).strict();
var contactQuerySchema = z4.object({
  page: z4.coerce.number().int().min(1).default(1),
  limit: z4.coerce.number().int().min(1).max(50).default(10),
  isResolved: z4.enum(["true", "false"]).optional().transform((val) => val === void 0 ? void 0 : val === "true")
});
var contactParamsSchema = z4.object({
  id: z4.string({ required_error: "Message id is required" }).min(1)
});
var updateResolvedSchema = z4.object({
  isResolved: z4.boolean({
    required_error: "isResolved is required",
    invalid_type_error: "isResolved must be a boolean"
  })
}).strict().refine((data) => typeof data.isResolved === "boolean", {
  message: "isResolved must be a boolean"
});
var contactValidations = {
  createMessageSchema,
  contactQuerySchema,
  contactParamsSchema,
  updateResolvedSchema
};

// src/modules/contact/contact.route.ts
var router4 = Router4();
router4.post(
  "/",
  validateRequest_default({ body: contactValidations.createMessageSchema }),
  contactController.createMessage
);
router4.get(
  "/",
  auth_default(Role.ADMIN),
  validateRequest_default({ query: contactValidations.contactQuerySchema }),
  contactController.getMessages
);
router4.patch(
  "/:id",
  auth_default(Role.ADMIN),
  validateRequest_default({
    params: contactValidations.contactParamsSchema,
    body: contactValidations.updateResolvedSchema
  }),
  contactController.updateResolved
);
var contactRoutes = router4;

// src/modules/booking/booking.route.ts
import { Router as Router5 } from "express";

// src/modules/booking/booking.controller.ts
import httpStatus6 from "http-status";

// src/lib/sslcommerz.ts
import { randomUUID } from "node:crypto";
var requireConfig = () => {
  if (!config_default.ssl_commerz_store_id || !config_default.ssl_commerz_store_password) {
    throw new AppError(
      400,
      "SSLCommerz is not configured. Set SSL_COMMERZ_STORE_ID and SSL_COMMERZ_STORE_PASSWORD."
    );
  }
  if (!config_default.backend_public_url) {
    throw new AppError(
      400,
      "SSLCommerz is not configured. Set BACKEND_PUBLIC_URL to the publicly reachable backend URL."
    );
  }
  return {
    storeId: config_default.ssl_commerz_store_id,
    storePassword: config_default.ssl_commerz_store_password
  };
};
function generateTranId() {
  return `TRNX_ID-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}
function generateRefundTranId() {
  return `RFD-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}
async function sslcommerzInit(options) {
  const { storeId, storePassword } = requireConfig();
  const body = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    total_amount: options.total_amount.toFixed(2),
    currency: "BDT",
    tran_id: options.tran_id,
    success_url: options.success_url,
    fail_url: options.fail_url,
    cancel_url: options.cancel_url,
    ipn_url: options.ipn_url,
    cus_name: options.cus_name,
    cus_email: options.cus_email,
    cus_add1: "N/A",
    cus_add2: "N/A",
    cus_city: "N/A",
    cus_state: "N/A",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: options.cus_phone,
    product_name: "TripVerse Tour Booking",
    shipping_method: "NO"
  });
  const res = await fetch(config_default.sslcommerz_init_url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  const text = await res.text();
  if (!res.ok) throw new AppError(502, `SSLCommerz init failed (${res.status})`);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AppError(502, "SSLCommerz init returned a non-JSON response");
  }
  if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
    const reason = data.failedreason || data.status || "unknown";
    console.error(
      `[sslcommerz] init rejected (url=${config_default.sslcommerz_init_url}, sandbox=${config_default.ssl_commerz_sandbox}): ${reason}`,
      data
    );
    throw new AppError(
      502,
      `SSLCommerz init rejected: ${reason}. Check SSL_COMMERZ_STORE_ID, SSL_COMMERZ_STORE_PASSWORD, SSL_COMMERZ_SANDBOX and SSLCOMMERZ_INIT_URL (see server logs).`
    );
  }
  return data;
}
async function sslcommerzValidate(options) {
  const { storeId, storePassword } = requireConfig();
  const params = new URLSearchParams({
    val_id: options.val_id,
    store_id: storeId,
    store_passwd: storePassword,
    format: "json"
  });
  const res = await fetch(`${config_default.sslcommerz_validate_url}?${params.toString()}`, {
    method: "GET"
  });
  const text = await res.text();
  if (!res.ok) throw new AppError(502, `SSLCommerz validation failed (${res.status})`);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AppError(502, "SSLCommerz validation returned a non-JSON response");
  }
  return data;
}
async function sslcommerzRefund(options) {
  const { storeId, storePassword } = requireConfig();
  const params = new URLSearchParams({
    bank_tran_id: options.bank_tran_id,
    refund_trans_id: options.refund_trans_id ?? generateRefundTranId(),
    store_id: storeId,
    store_passwd: storePassword,
    refund_amount: options.refund_amount.toFixed(2),
    refund_remarks: options.refund_remarks,
    format: "json",
    v: "1"
  });
  if (options.refe_id) params.set("refe_id", options.refe_id);
  const res = await fetch(
    `${config_default.sslcommerz_refund_url}?${params.toString()}`,
    { method: "GET", signal: AbortSignal.timeout(8e3) }
  );
  const text = await res.text();
  if (!res.ok) throw new AppError(502, `SSLCommerz refund failed (${res.status})`);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AppError(502, "SSLCommerz refund returned a non-JSON response");
  }
  if (data.APIConnect !== "DONE" || data.status !== "success") {
    throw new AppError(
      502,
      `SSLCommerz refund rejected: ${data.errorReason ?? data.APIConnect ?? data.status ?? "unknown"}`
    );
  }
  return data;
}

// src/utils/notification.ts
var notify = async (userId, type, title, message, link) => {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, link }
    });
  } catch (error) {
    console.error(
      `[notification] failed to create ${type} for user ${userId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

// src/modules/booking/booking.service.ts
var STALE_BOOKING_HOURS = 24;
var toUTCMidnight = (date) => new Date(
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
);
var canManage = (booking, actor) => booking.userId === actor.id || actor.role === Role.AGENT && booking.package.agentId === actor.id || actor.role === Role.ADMIN;
var isAgentOwnerOrAdmin = (booking, actor) => actor.role === Role.ADMIN || actor.role === Role.AGENT && booking.package.agentId === actor.id;
var TRANSITIONS = {
  [BookingStatus.PENDING]: {
    [BookingStatus.CONFIRMED]: { allowed: isAgentOwnerOrAdmin },
    [BookingStatus.CANCELLED]: { allowed: canManage }
  },
  [BookingStatus.PAID]: {
    [BookingStatus.CONFIRMED]: { allowed: isAgentOwnerOrAdmin },
    [BookingStatus.CANCELLED]: { allowed: canManage }
  },
  [BookingStatus.CONFIRMED]: {
    [BookingStatus.COMPLETED]: {
      allowed: isAgentOwnerOrAdmin,
      requiresTravelDatePassed: true
    },
    [BookingStatus.CANCELLED]: { allowed: canManage },
    [BookingStatus.PENDING]: {
      allowed: isAgentOwnerOrAdmin,
      beforeTravelDate: true
    }
  }
};
var bookingPackageSelect = {
  select: {
    id: true,
    title: true,
    slug: true,
    location: true,
    images: true,
    price: true
  }
};
var bookingPackageDetailSelect = {
  select: {
    id: true,
    title: true,
    slug: true,
    location: true,
    images: true,
    price: true,
    agentId: true
  }
};
var bookingUserSelect = {
  select: { id: true, name: true, email: true }
};
var bookingPaymentSelect = {
  select: {
    id: true,
    tranId: true,
    amount: true,
    currency: true,
    status: true,
    cardType: true,
    bankTranId: true,
    valId: true,
    paidAt: true,
    refundRefId: true,
    refundInitiatedAt: true,
    refundCompletedAt: true
  }
};
var bookingPaymentsInclude = {
  ...bookingPaymentSelect,
  orderBy: { createdAt: "desc" }
};
var mapBookingList = (booking) => ({
  ...booking,
  totalPrice: Number(booking.totalPrice),
  package: { ...booking.package, price: Number(booking.package.price) },
  payments: booking.payments?.map((p) => ({ ...p, amount: Number(p.amount) }))
});
var createBooking = async (userId, payload) => {
  const { packageId, travelers } = payload;
  const travelDate = toUTCMidnight(payload.travelDate);
  const tourPackage = await prisma.tourPackage.findUnique({
    where: { id: packageId }
  });
  if (!tourPackage || tourPackage.isDeleted || tourPackage.status !== PackageStatus.APPROVED) {
    throw new AppError(409, "Package is not available for booking.");
  }
  const totalPrice = Number(tourPackage.price) * travelers;
  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findFirst({
      where: {
        userId,
        packageId,
        travelDate,
        status: BookingStatus.PENDING
      },
      orderBy: { createdAt: "desc" }
    });
    if (existing) {
      const isRecent = existing.createdAt.getTime() >= Date.now() - STALE_BOOKING_HOURS * 60 * 60 * 1e3;
      if (isRecent) {
        throw new AppError(
          409,
          "You already have a pending booking for this package on this date."
        );
      }
      await tx.booking.update({
        where: { id: existing.id },
        data: { status: BookingStatus.CANCELLED }
      });
    }
    return tx.booking.create({
      data: { userId, packageId, travelDate, travelers, totalPrice }
    });
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true }
  });
  if (user) {
    void Promise.allSettled([
      sendBookingEmail({
        email: user.email,
        name: user.name,
        packageTitle: tourPackage.title,
        travelDate,
        travelers,
        totalPrice,
        status: BookingStatus.PENDING
      })
    ]);
  }
  void Promise.allSettled([
    notify(
      tourPackage.agentId,
      NotificationType.BOOKING_CREATED,
      "New booking received",
      `A new booking has been placed for "${tourPackage.title}".`,
      `/dashboard/agent/bookings/${created.id}`
    )
  ]);
  return {
    ...created,
    totalPrice: Number(created.totalPrice)
  };
};
var paginateBooking = async (where, include, query) => {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const [data, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" }
    }),
    prisma.booking.count({ where })
  ]);
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};
var getMyBookings = async (userId, query) => {
  const where = { userId };
  if (query.status) where.status = query.status;
  const result = await paginateBooking(
    where,
    { package: bookingPackageSelect, payments: bookingPaymentsInclude },
    query
  );
  return { ...result, data: result.data.map(mapBookingList) };
};
var getAgentBookings = async (agentId, query) => {
  const where = {
    package: { agentId }
  };
  if (query.status) where.status = query.status;
  if (query.search) {
    where.package = {
      agentId,
      title: { contains: query.search, mode: "insensitive" }
    };
  }
  const result = await paginateBooking(
    where,
    { package: bookingPackageSelect, payments: bookingPaymentsInclude },
    query
  );
  return { ...result, data: result.data.map(mapBookingList) };
};
var getAllBookings = async (query) => {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.package = { title: { contains: query.search, mode: "insensitive" } };
  }
  const result = await paginateBooking(
    where,
    {
      package: bookingPackageSelect,
      user: bookingUserSelect,
      payments: bookingPaymentsInclude
    },
    query
  );
  return { ...result, data: result.data.map(mapBookingList) };
};
var getBookingDetail = async (id, actor) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      package: bookingPackageDetailSelect,
      user: bookingUserSelect,
      payments: bookingPaymentsInclude
    }
  });
  if (!booking) {
    throw new AppError(404, "Booking not found.");
  }
  if (!canManage(booking, actor)) {
    throw new AppError(403, "You are not authorized to view this booking.");
  }
  return mapBookingList(booking);
};
var issueRefunds = async (bookingId, ctx) => {
  const payments = await prisma.payment.findMany({
    where: { bookingId, status: PaymentStatus.SUCCESS, refundCompletedAt: null }
  });
  if (payments.length === 0) return null;
  let allSucceeded = true;
  let firstFailure = null;
  let refundedTotal = 0;
  const refundRefs = [];
  for (const payment of payments) {
    if (!payment.bankTranId) {
      allSucceeded = false;
      firstFailure ??= "Payment has no bank transaction id to refund against.";
      await prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.SUCCESS },
        data: { refundInitiatedAt: /* @__PURE__ */ new Date() }
      });
      continue;
    }
    try {
      const gateway = await sslcommerzRefund({
        bank_tran_id: payment.bankTranId,
        refund_amount: Number(payment.amount),
        refund_remarks: `Booking ${bookingId} cancelled - TripVerse`,
        refe_id: bookingId
      });
      const flipped = await prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.SUCCESS },
        data: {
          status: PaymentStatus.REFUNDED,
          refundRefId: gateway.refund_ref_id ?? payment.refundRefId ?? null,
          refundCompletedAt: /* @__PURE__ */ new Date()
        }
      });
      if (flipped.count === 0) continue;
      refundedTotal += Number(payment.amount);
      if (gateway.refund_ref_id) refundRefs.push(gateway.refund_ref_id);
    } catch (error) {
      allSucceeded = false;
      firstFailure ??= error instanceof Error ? error.message : String(error);
      await prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.SUCCESS },
        data: { refundInitiatedAt: /* @__PURE__ */ new Date() }
      });
    }
  }
  if (refundRefs.length > 0) {
    void Promise.allSettled([
      sendRefundEmail({
        email: ctx.email,
        name: ctx.name,
        packageTitle: ctx.packageTitle,
        travelDate: ctx.travelDate,
        amount: refundedTotal,
        refundRefId: refundRefs[0]
      })
    ]);
  }
  return allSucceeded ? { status: "SUCCESS" } : { status: "FAILED", message: firstFailure ?? "Refund could not be processed." };
};
var updateBookingStatus = async (id, payload, actor) => {
  const { status: to } = payload;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      package: {
        select: { id: true, agentId: true, title: true }
      },
      user: bookingUserSelect
    }
  });
  if (!booking) {
    throw new AppError(404, "Booking not found.");
  }
  if (!canManage(booking, actor)) {
    throw new AppError(403, "You are not authorized to perform this action.");
  }
  const rule = TRANSITIONS[booking.status]?.[to];
  if (!rule) {
    throw new AppError(
      400,
      `Cannot transition booking from ${booking.status} to ${to}.`
    );
  }
  if (!rule.allowed(booking, actor)) {
    throw new AppError(403, "You are not authorized to perform this action.");
  }
  const travelDay = toUTCMidnight(booking.travelDate).getTime();
  const now = Date.now();
  if (rule.requiresTravelDatePassed && travelDay > now) {
    throw new AppError(
      400,
      "Booking can only be completed after the travel date has passed."
    );
  }
  if (rule.beforeTravelDate && travelDay <= now) {
    throw new AppError(
      400,
      "Booking can only be reverted before the travel date."
    );
  }
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.booking.updateMany({
      where: { id, status: booking.status },
      data: { status: to }
    });
    if (result.count === 0) {
      throw new AppError(
        409,
        "Booking status changed concurrently. Please try again."
      );
    }
    if (to === BookingStatus.CANCELLED) {
      await tx.payment.updateMany({
        where: { bookingId: id, status: PaymentStatus.INITIATED },
        data: { status: PaymentStatus.CANCELLED }
      });
    }
    return tx.booking.findUnique({ where: { id } });
  });
  if (!updated) {
    throw new AppError(404, "Booking not found.");
  }
  let refund = null;
  if (to === BookingStatus.CANCELLED) {
    refund = await issueRefunds(id, {
      email: booking.user.email,
      name: booking.user.name,
      packageTitle: booking.package.title,
      travelDate: booking.travelDate
    });
  }
  if (to === BookingStatus.CONFIRMED || to === BookingStatus.CANCELLED) {
    void Promise.allSettled([
      sendBookingEmail({
        email: booking.user.email,
        name: booking.user.name,
        packageTitle: booking.package.title,
        travelDate: booking.travelDate,
        travelers: booking.travelers,
        totalPrice: Number(booking.totalPrice),
        status: to
      })
    ]);
  }
  if (to === BookingStatus.CONFIRMED) {
    void Promise.allSettled([
      notify(
        booking.userId,
        NotificationType.BOOKING_CONFIRMED,
        "Booking confirmed",
        `Your booking for "${booking.package.title}" has been confirmed.`,
        `/dashboard/bookings/${id}`
      )
    ]);
  }
  if (to === BookingStatus.CANCELLED) {
    const recipients = [];
    if (actor.id === booking.userId) {
      recipients.push(booking.package.agentId);
    } else if (actor.role === Role.AGENT && booking.package.agentId === actor.id) {
      recipients.push(booking.userId);
    } else if (actor.role === Role.ADMIN) {
      recipients.push(booking.userId, booking.package.agentId);
    }
    void Promise.allSettled(
      [...new Set(recipients)].map(
        (recipientId) => notify(
          recipientId,
          NotificationType.BOOKING_CANCELLED,
          "Booking cancelled",
          `The booking for "${booking.package.title}" has been cancelled.`,
          `/dashboard/bookings/${id}`
        )
      )
    );
  }
  return {
    ...updated,
    totalPrice: Number(updated.totalPrice),
    ...refund ? { refund } : {}
  };
};
var bookingService = {
  createBooking,
  getMyBookings,
  getAgentBookings,
  getAllBookings,
  getBookingDetail,
  updateBookingStatus
};

// src/modules/booking/booking.controller.ts
var createBooking2 = catchAsync(
  async (req, res, next) => {
    const userId = req.user?.id;
    const booking = await bookingService.createBooking(userId, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus6.CREATED,
      message: "Booking created successfully.",
      data: booking
    });
  }
);
var getMyBookings2 = catchAsync(
  async (req, res, next) => {
    const userId = req.user?.id;
    const result = await bookingService.getMyBookings(userId, req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus6.OK,
      message: "Bookings retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var getAgentBookings2 = catchAsync(
  async (req, res, next) => {
    const userId = req.user?.id;
    const result = await bookingService.getAgentBookings(userId, req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus6.OK,
      message: "Bookings retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var getBookingDetail2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    const booking = await bookingService.getBookingDetail(id, req.user);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus6.OK,
      message: "Booking retrieved successfully.",
      data: booking
    });
  }
);
var getAllBookings2 = catchAsync(
  async (req, res, next) => {
    const result = await bookingService.getAllBookings(req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus6.OK,
      message: "Bookings retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var updateBookingStatus2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    const booking = await bookingService.updateBookingStatus(
      id,
      req.body,
      req.user
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus6.OK,
      message: "Booking status updated successfully.",
      data: booking
    });
  }
);
var bookingController = {
  createBooking: createBooking2,
  getMyBookings: getMyBookings2,
  getAgentBookings: getAgentBookings2,
  getBookingDetail: getBookingDetail2,
  getAllBookings: getAllBookings2,
  updateBookingStatus: updateBookingStatus2
};

// src/modules/booking/booking.validation.ts
import { z as z5 } from "zod";
var createSchema = z5.object({
  packageId: z5.string({ required_error: "Package id is required" }).min(1),
  travelDate: z5.coerce.date({
    required_error: "Travel date is required",
    invalid_type_error: "Travel date must be a valid date"
  }).refine(
    (date) => {
      const today = /* @__PURE__ */ new Date();
      const travelDay = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate()
        )
      );
      const todayUTC = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate()
        )
      );
      return travelDay.getTime() >= todayUTC.getTime();
    },
    { message: "Travel date cannot be in the past." }
  ),
  travelers: z5.number({ required_error: "Travelers is required" }).int("Travelers must be a whole number").min(1, "Travelers must be at least 1").max(20, "Travelers must be at most 20")
});
var bookingParamsSchema = z5.object({
  id: z5.string({ required_error: "Booking id is required" }).min(1)
});
var bookingQuerySchema = z5.object({
  page: z5.coerce.number().int().min(1).default(1),
  limit: z5.coerce.number().int().min(1).max(50).default(10),
  status: z5.nativeEnum(BookingStatus).optional()
});
var bookingSearchQuerySchema = bookingQuerySchema.extend({
  search: z5.string().trim().optional()
});
var updateStatusSchema = z5.object({
  status: z5.nativeEnum(BookingStatus, {
    required_error: "Please provide a status"
  })
});
var bookingValidations = {
  createSchema,
  bookingParamsSchema,
  bookingQuerySchema,
  bookingSearchQuerySchema,
  updateStatusSchema
};

// src/modules/booking/booking.route.ts
var router5 = Router5();
router5.post(
  "/",
  auth_default(Role.USER),
  validateRequest_default({ body: bookingValidations.createSchema }),
  bookingController.createBooking
);
router5.get(
  "/my-bookings",
  auth_default(Role.USER),
  validateRequest_default({ query: bookingValidations.bookingQuerySchema }),
  bookingController.getMyBookings
);
router5.get(
  "/agent-bookings",
  auth_default(Role.AGENT),
  validateRequest_default({ query: bookingValidations.bookingSearchQuerySchema }),
  bookingController.getAgentBookings
);
router5.get(
  "/:id",
  auth_default(),
  validateRequest_default({ params: bookingValidations.bookingParamsSchema }),
  bookingController.getBookingDetail
);
router5.get(
  "/",
  auth_default(Role.ADMIN),
  validateRequest_default({ query: bookingValidations.bookingSearchQuerySchema }),
  bookingController.getAllBookings
);
router5.patch(
  "/:id/status",
  auth_default(),
  validateRequest_default({
    params: bookingValidations.bookingParamsSchema,
    body: bookingValidations.updateStatusSchema
  }),
  bookingController.updateBookingStatus
);
var bookingRoutes = router5;

// src/modules/review/review.route.ts
import { Router as Router6 } from "express";

// src/modules/review/review.controller.ts
import httpStatus7 from "http-status";

// src/modules/review/review.service.ts
var recomputePackageRating = async (tx, packageId) => {
  const { _avg } = await tx.review.aggregate({
    where: { packageId, isDeleted: false },
    _avg: { rating: true }
  });
  const rating = Math.round((_avg.rating ?? 0) * 10) / 10;
  await tx.tourPackage.update({
    where: { id: packageId },
    data: { rating }
  });
  return rating;
};
var createReview = async (userId, payload) => {
  return prisma.$transaction(async (tx) => {
    const tourPackage = await tx.tourPackage.findFirst({
      where: {
        id: payload.packageId,
        status: PackageStatus.APPROVED,
        isDeleted: false
      },
      select: { id: true, agentId: true }
    });
    if (!tourPackage) {
      throw new AppError(404, "Package not found.");
    }
    if (tourPackage.agentId === userId) {
      throw new AppError(403, "You cannot review your own package.");
    }
    const completedBooking = await tx.booking.findFirst({
      where: {
        userId,
        packageId: payload.packageId,
        status: BookingStatus.COMPLETED
      },
      select: { id: true }
    });
    if (!completedBooking) {
      throw new AppError(
        403,
        "You can only review a package after completing a booking."
      );
    }
    const existingReview = await tx.review.findFirst({
      where: { userId, packageId: payload.packageId },
      select: { id: true }
    });
    if (existingReview) {
      throw new AppError(409, "You have already reviewed this package.");
    }
    const createdReview = await tx.review.create({
      data: {
        userId,
        packageId: payload.packageId,
        rating: payload.rating,
        comment: payload.comment
      }
    });
    const rating = await recomputePackageRating(tx, payload.packageId);
    return { review: createdReview, rating };
  });
};
var listPackageReviews = async (packageId, query) => {
  const tourPackage = await prisma.tourPackage.findFirst({
    where: {
      id: packageId,
      status: PackageStatus.APPROVED,
      isDeleted: false
    },
    select: { id: true }
  });
  if (!tourPackage) {
    throw new AppError(404, "Package not found.");
  }
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const where = { packageId, isDeleted: false };
  const [data, total] = await Promise.all([
    prisma.review.findMany({
      where,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { name: true, avatarUrl: true } }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.review.count({ where })
  ]);
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};
var updateReview = async (userId, reviewId, payload) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.review.findFirst({
      where: { id: reviewId, userId, isDeleted: false },
      select: { id: true, packageId: true }
    });
    if (!existing) {
      throw new AppError(404, "Review not found.");
    }
    const updated = await tx.review.update({
      where: { id: reviewId },
      data: {
        ...payload.rating !== void 0 ? { rating: payload.rating } : {},
        ...payload.comment !== void 0 ? { comment: payload.comment } : {}
      }
    });
    await recomputePackageRating(tx, existing.packageId);
    const fresh = await tx.tourPackage.findUnique({
      where: { id: existing.packageId },
      select: { rating: true }
    });
    return { review: updated, rating: fresh?.rating ?? 0 };
  });
};
var deleteReview = async (userId, role, reviewId) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.review.findFirst({
      where: { id: reviewId, isDeleted: false },
      select: { id: true, packageId: true, userId: true }
    });
    if (!existing) {
      throw new AppError(404, "Review not found.");
    }
    if (role !== Role.ADMIN && existing.userId !== userId) {
      throw new AppError(404, "Review not found.");
    }
    const removed = await tx.review.updateMany({
      where: { id: reviewId, isDeleted: false },
      data: { isDeleted: true }
    });
    if (removed.count === 0) {
      throw new AppError(404, "Review not found.");
    }
    const rating = await recomputePackageRating(tx, existing.packageId);
    return { reviewId, rating };
  });
};
var reviewService = {
  createReview,
  listPackageReviews,
  updateReview,
  deleteReview
};

// src/modules/review/review.controller.ts
var createReview2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const result = await reviewService.createReview(userId, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus7.CREATED,
      message: "Review submitted successfully.",
      data: result
    });
  }
);
var getPackageReviews = catchAsync(
  async (req, res, next) => {
    const packageId = String(req.params.packageId);
    const result = await reviewService.listPackageReviews(packageId, req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus7.OK,
      message: "Reviews retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var updateReview2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const id = String(req.params.id);
    const result = await reviewService.updateReview(userId, id, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus7.OK,
      message: "Review updated successfully.",
      data: result
    });
  }
);
var deleteReview2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const role = req.user.role;
    const id = String(req.params.id);
    const result = await reviewService.deleteReview(userId, role, id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus7.OK,
      message: "Review deleted successfully.",
      data: result
    });
  }
);
var reviewController = {
  createReview: createReview2,
  getPackageReviews,
  updateReview: updateReview2,
  deleteReview: deleteReview2
};

// src/modules/review/review.validation.ts
import { z as z6 } from "zod";
var createReviewSchema = z6.object({
  packageId: z6.string({ required_error: "Package id is required" }).min(1, "Package id must not be empty"),
  rating: z6.number({ required_error: "Rating is required" }).int("Rating must be a whole number").min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  comment: z6.string({ required_error: "Comment is required" }).trim().min(1, "Comment must not be empty").max(1e3, "Comment must be at most 1000 characters")
}).strict();
var reviewParamsSchema = z6.object({
  packageId: z6.string({ required_error: "Package id is required" }).min(1, "Package id must not be empty")
});
var reviewQuerySchema = z6.object({
  page: z6.coerce.number().int().min(1).default(1),
  limit: z6.coerce.number().int().min(1).max(50).default(10)
});
var updateReviewSchema = z6.object({
  rating: z6.number({ invalid_type_error: "Rating must be a number" }).int("Rating must be a whole number").min(1, "Rating must be at least 1").max(5, "Rating must be at most 5").optional(),
  comment: z6.string({ invalid_type_error: "Comment must be a string" }).trim().min(1, "Comment must not be empty").max(1e3, "Comment must be at most 1000 characters").optional()
}).strict().refine((data) => data.rating !== void 0 || data.comment !== void 0, {
  message: "At least one of rating or comment must be provided"
});
var reviewIdParamsSchema = z6.object({
  id: z6.string({ required_error: "Review id is required" }).min(1, "Review id must not be empty")
});
var reviewValidations = {
  createReviewSchema,
  reviewParamsSchema,
  reviewQuerySchema,
  updateReviewSchema,
  reviewIdParamsSchema
};

// src/modules/review/review.route.ts
var router6 = Router6();
router6.post(
  "/",
  auth_default(Role.USER),
  validateRequest_default({ body: reviewValidations.createReviewSchema }),
  reviewController.createReview
);
router6.get(
  "/package/:packageId",
  validateRequest_default({
    params: reviewValidations.reviewParamsSchema,
    query: reviewValidations.reviewQuerySchema
  }),
  reviewController.getPackageReviews
);
router6.patch(
  "/:id",
  auth_default(Role.USER),
  validateRequest_default({
    params: reviewValidations.reviewIdParamsSchema,
    body: reviewValidations.updateReviewSchema
  }),
  reviewController.updateReview
);
router6.delete(
  "/:id",
  auth_default(),
  validateRequest_default({ params: reviewValidations.reviewIdParamsSchema }),
  reviewController.deleteReview
);
var reviewRoutes = router6;

// src/modules/category/category.route.ts
import { Router as Router7 } from "express";

// src/modules/category/category.controller.ts
import httpStatus8 from "http-status";

// src/utils/slugify.ts
var BANGLA_TO_LATIN = {
  \u0985: "o",
  \u0986: "a",
  \u0987: "i",
  \u0988: "i",
  \u0989: "u",
  \u098A: "u",
  \u098B: "ri",
  \u098F: "e",
  \u0990: "oi",
  \u0993: "o",
  \u0994: "ou",
  \u0995: "ka",
  \u0996: "kha",
  \u0997: "ga",
  \u0998: "gha",
  \u0999: "nga",
  \u099A: "cha",
  \u099B: "chha",
  \u099C: "ja",
  \u099D: "jha",
  \u099E: "nya",
  \u099F: "ta",
  \u09A0: "tha",
  \u09A1: "da",
  \u09A2: "dha",
  \u09A3: "na",
  \u09A4: "ta",
  \u09A5: "tha",
  \u09A6: "da",
  \u09A7: "dha",
  \u09A8: "na",
  \u09AA: "pa",
  \u09AB: "pha",
  \u09AC: "ba",
  \u09AD: "bha",
  \u09AE: "ma",
  \u09AF: "ya",
  \u09B0: "ra",
  \u09B2: "la",
  \u09B6: "sha",
  \u09B7: "sha",
  \u09B8: "sa",
  \u09B9: "ha",
  \u09A1\u09BC: "ra",
  \u09A2\u09BC: "rha",
  \u09AF\u09BC: "ya",
  "\u0982": "ng",
  "\u0983": "h",
  "\u0981": "",
  "\u09CD": "",
  "\u09C7": "e",
  "\u09C8": "oi",
  "\u09CB": "o",
  "\u09CC": "ou",
  "\u09BE": "a",
  "\u09BF": "i",
  "\u09C0": "i",
  "\u09C1": "u",
  "\u09C2": "u",
  "\u09C3": "ri"
};
var transliterate = (text) => [...text].map((char) => BANGLA_TO_LATIN[char] ?? char).join("");
var slugify = (text, fallback) => {
  const slug = transliterate(text).toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || fallback || "";
};

// src/modules/category/category.service.ts
var assertNameAvailable = async (name, slug, excludeId) => {
  const existing = await prisma.category.findFirst({
    where: {
      OR: [{ name }, { slug }],
      ...excludeId ? { NOT: { id: excludeId } } : {}
    }
  });
  if (existing) {
    throw new AppError(409, "A category with this name already exists");
  }
};
var createCategory = async (payload) => {
  const { name } = payload;
  const slug = slugify(name);
  await assertNameAvailable(name, slug);
  return prisma.category.create({
    data: { name, slug }
  });
};
var getAllCategories = async () => {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          packages: {
            where: {
              status: PackageStatus.APPROVED,
              isDeleted: false
            }
          }
        }
      }
    }
  });
};
var updateCategory = async (categoryId, payload) => {
  const { name } = payload;
  const slug = slugify(name);
  await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
  await assertNameAvailable(name, slug, categoryId);
  return prisma.category.update({
    where: { id: categoryId },
    data: { name, slug }
  });
};
var deleteCategory = async (categoryId) => {
  await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
  const packageCount = await prisma.tourPackage.count({
    where: { categoryId }
  });
  if (packageCount > 0) {
    throw new AppError(
      409,
      "Cannot delete category with associated packages. Rename it instead."
    );
  }
  await prisma.category.delete({ where: { id: categoryId } });
};
var categoryService = {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory
};

// src/modules/category/category.controller.ts
var createCategory2 = catchAsync(
  async (req, res, next) => {
    const category = await categoryService.createCategory(req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus8.CREATED,
      message: "Category created successfully.",
      data: category
    });
  }
);
var getAllCategories2 = catchAsync(
  async (req, res, next) => {
    const categories = await categoryService.getAllCategories();
    sendResponse(res, {
      success: true,
      statusCode: httpStatus8.OK,
      message: "All categories fetched successfully.",
      data: categories
    });
  }
);
var updateCategory2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    const category = await categoryService.updateCategory(id, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus8.OK,
      message: "Category updated successfully.",
      data: category
    });
  }
);
var deleteCategory2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    await categoryService.deleteCategory(id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus8.OK,
      message: "Category deleted successfully.",
      data: null
    });
  }
);
var categoryController = {
  createCategory: createCategory2,
  getAllCategories: getAllCategories2,
  updateCategory: updateCategory2,
  deleteCategory: deleteCategory2
};

// src/modules/category/category.validation.ts
import { z as z7 } from "zod";
var nameSchema = z7.string({ required_error: "Category name is required" }).trim().min(2, "Category name must be at least 2 characters").max(100, "Category name must be at most 100 characters");
var createCategorySchema = z7.object({ name: nameSchema }).strict();
var updateCategorySchema = z7.object({ name: nameSchema }).strict();
var categoryParamsSchema = z7.object({
  id: z7.string({ required_error: "Category id is required" }).min(1)
});
var categoryValidations = {
  createCategorySchema,
  updateCategorySchema,
  categoryParamsSchema
};

// src/modules/category/category.route.ts
var router7 = Router7();
router7.get("/", categoryController.getAllCategories);
router7.post(
  "/",
  auth_default(Role.ADMIN),
  validateRequest_default({ body: categoryValidations.createCategorySchema }),
  categoryController.createCategory
);
router7.patch(
  "/:id",
  auth_default(Role.ADMIN),
  validateRequest_default({
    params: categoryValidations.categoryParamsSchema,
    body: categoryValidations.updateCategorySchema
  }),
  categoryController.updateCategory
);
router7.delete(
  "/:id",
  auth_default(Role.ADMIN),
  validateRequest_default({ params: categoryValidations.categoryParamsSchema }),
  categoryController.deleteCategory
);
var categoryRoutes = router7;

// src/modules/package/package.route.ts
import { Router as Router8 } from "express";

// src/modules/package/package.controller.ts
import httpStatus9 from "http-status";

// src/modules/package/package.service.ts
import { randomUUID as randomUUID2 } from "node:crypto";
var serializePrice = (row) => ({
  ...row,
  price: Number(row.price)
});
var publicPackageInclude = {
  category: { select: { id: true, name: true, slug: true } },
  agent: { select: { id: true, name: true, avatarUrl: true } }
};
var validateCategory = async (categoryId) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true }
  });
  if (!category) {
    throw new AppError(400, "Invalid categoryId");
  }
};
var validateAgent = async (agentId) => {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, role: true, isDeleted: true }
  });
  if (!agent || agent.role !== Role.AGENT || agent.isDeleted) {
    throw new AppError(400, "Invalid agentId");
  }
};
var generateUniqueSlug = async (title) => {
  const base = slugify(title) || `package-${randomUUID2().slice(0, 8)}`;
  const existing = await prisma.tourPackage.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true }
  });
  const used = new Set(existing.map((p) => p.slug));
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};
var createPackage = async (user, payload) => {
  await validateCategory(payload.categoryId);
  let agentId;
  if (user.role === Role.ADMIN) {
    if (payload.agentId) {
      await validateAgent(payload.agentId);
      agentId = payload.agentId;
    } else {
      agentId = user.id;
    }
  } else {
    if (payload.agentId) {
      throw new AppError(400, "agentId can only be set by an admin");
    }
    agentId = user.id;
  }
  const slug = await generateUniqueSlug(payload.title);
  const created = await prisma.tourPackage.create({
    data: {
      title: payload.title,
      description: payload.description,
      location: payload.location,
      price: payload.price,
      duration: payload.duration,
      categoryId: payload.categoryId,
      images: payload.images,
      agentId,
      slug
    }
  });
  return serializePrice(created);
};
var getPublicPackages = async (query) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const filters = [];
  if (query.search) {
    filters.push({
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { location: { contains: query.search, mode: "insensitive" } }
      ]
    });
  }
  if (query.location) {
    filters.push({
      location: { contains: query.location, mode: "insensitive" }
    });
  }
  if (query.minPrice !== void 0 || query.maxPrice !== void 0) {
    filters.push({
      price: {
        ...query.minPrice !== void 0 ? { gte: query.minPrice } : {},
        ...query.maxPrice !== void 0 ? { lte: query.maxPrice } : {}
      }
    });
  }
  if (query.minRating !== void 0) {
    filters.push({ rating: { gte: query.minRating } });
  }
  if (query.maxDuration !== void 0) {
    filters.push({ duration: { lte: query.maxDuration } });
  }
  if (query.category) {
    filters.push({ category: { slug: query.category } });
  }
  const where = {
    status: PackageStatus.APPROVED,
    isDeleted: false,
    AND: filters.length > 0 ? filters : void 0
  };
  const sortOrder = query.sortOrder ?? (query.sortBy === "newest" ? "desc" : "asc");
  const orderByMap = {
    newest: { createdAt: sortOrder },
    price: { price: sortOrder },
    rating: { rating: sortOrder },
    title: { title: sortOrder }
  };
  const orderBy = orderByMap[query.sortBy ?? "newest"] ?? orderByMap.newest;
  const [data, total] = await Promise.all([
    prisma.tourPackage.findMany({
      where,
      orderBy,
      include: publicPackageInclude,
      skip,
      take: limit
    }),
    prisma.tourPackage.count({ where })
  ]);
  return {
    data: data.map(serializePrice),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getPackageBySlug = async (slug) => {
  const tourPackage = await prisma.tourPackage.findFirst({
    where: { slug, status: PackageStatus.APPROVED, isDeleted: false },
    include: publicPackageInclude
  });
  if (!tourPackage) {
    throw new AppError(404, "Package not found.");
  }
  return serializePrice(tourPackage);
};
var getAllPackages = async (query) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const where = {
    isDeleted: false,
    ...query.status ? { status: query.status } : {},
    ...query.agentId ? { agentId: query.agentId } : {}
  };
  const [data, total] = await Promise.all([
    prisma.tourPackage.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        agent: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.tourPackage.count({ where })
  ]);
  return {
    data: data.map(serializePrice),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getMyPackages = async (userId, query) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const where = {
    agentId: userId,
    isDeleted: false
  };
  const [data, total] = await Promise.all([
    prisma.tourPackage.findMany({
      where,
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.tourPackage.count({ where })
  ]);
  return {
    data: data.map(serializePrice),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var findOwnedPackage = async (user, packageId) => {
  const tourPackage = await prisma.tourPackage.findUnique({
    where: { id: packageId }
  });
  if (!tourPackage) {
    throw new AppError(404, "Package not found.");
  }
  if (user.role !== Role.ADMIN && tourPackage.agentId !== user.id) {
    throw new AppError(403, "You can only act on your own packages.");
  }
  return tourPackage;
};
var updatePackage = async (user, packageId, payload) => {
  const tourPackage = await findOwnedPackage(user, packageId);
  if (payload.categoryId !== void 0) {
    await validateCategory(payload.categoryId);
  }
  const data = {
    ...payload.title !== void 0 ? { title: payload.title } : {},
    ...payload.description !== void 0 ? { description: payload.description } : {},
    ...payload.location !== void 0 ? { location: payload.location } : {},
    ...payload.price !== void 0 ? { price: payload.price } : {},
    ...payload.duration !== void 0 ? { duration: payload.duration } : {},
    ...payload.images !== void 0 ? { images: payload.images } : {},
    ...payload.categoryId !== void 0 ? { category: { connect: { id: payload.categoryId } } } : {},
    ...user.role !== Role.ADMIN ? { status: PackageStatus.PENDING } : {}
  };
  const updated = await prisma.tourPackage.update({
    where: { id: packageId },
    data,
    include: { category: { select: { id: true, name: true, slug: true } } }
  });
  return serializePrice(updated);
};
var changePackageStatus = async (packageId, payload) => {
  const tourPackage = await prisma.tourPackage.findUniqueOrThrow({
    where: { id: packageId }
  });
  if (tourPackage.isDeleted) {
    throw new AppError(400, "Cannot change the status of a deleted package.");
  }
  const updated = await prisma.tourPackage.update({
    where: { id: packageId },
    data: { status: payload.status }
  });
  const notified = {
    type: payload.status === PackageStatus.APPROVED ? NotificationType.PACKAGE_APPROVED : NotificationType.PACKAGE_REJECTED,
    title: payload.status === PackageStatus.APPROVED ? "Package approved" : "Package rejected",
    message: payload.status === PackageStatus.APPROVED ? `Your package "${tourPackage.title}" has been approved and is now live.` : `Your package "${tourPackage.title}" was rejected. Please review and resubmit.`
  };
  void Promise.allSettled([
    notify(
      tourPackage.agentId,
      notified.type,
      notified.title,
      notified.message,
      `/dashboard/agent/packages/${packageId}`
    )
  ]);
  return serializePrice(updated);
};
var softDeletePackage = async (user, packageId) => {
  await findOwnedPackage(user, packageId);
  return prisma.tourPackage.update({
    where: { id: packageId },
    data: { isDeleted: true }
  });
};
var packageService = {
  createPackage,
  getPublicPackages,
  getPackageBySlug,
  getAllPackages,
  getMyPackages,
  updatePackage,
  changePackageStatus,
  softDeletePackage
};

// src/modules/package/package.controller.ts
var createPackage2 = catchAsync(
  async (req, res, next) => {
    const result = await packageService.createPackage(req.user, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus9.CREATED,
      message: "Package created successfully. It will be visible after admin approval.",
      data: result
    });
  }
);
var getPublicPackages2 = catchAsync(
  async (req, res, next) => {
    const result = await packageService.getPublicPackages(req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus9.OK,
      message: "Packages retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var getPackageBySlug2 = catchAsync(
  async (req, res, next) => {
    const slug = String(req.params.slug);
    const result = await packageService.getPackageBySlug(slug);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus9.OK,
      message: "Package retrieved successfully.",
      data: result
    });
  }
);
var getAllPackages2 = catchAsync(
  async (req, res, next) => {
    const result = await packageService.getAllPackages(req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus9.OK,
      message: "All packages retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var getMyPackages2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const result = await packageService.getMyPackages(userId, req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus9.OK,
      message: "Your packages retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var updatePackage2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    const result = await packageService.updatePackage(req.user, id, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus9.OK,
      message: "Package updated successfully.",
      data: result
    });
  }
);
var changePackageStatus2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    const result = await packageService.changePackageStatus(id, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus9.OK,
      message: "Package status updated successfully.",
      data: result
    });
  }
);
var softDeletePackage2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    await packageService.softDeletePackage(req.user, id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus9.OK,
      message: "Package deleted successfully.",
      data: null
    });
  }
);
var packageController = {
  createPackage: createPackage2,
  getPublicPackages: getPublicPackages2,
  getPackageBySlug: getPackageBySlug2,
  getAllPackages: getAllPackages2,
  getMyPackages: getMyPackages2,
  updatePackage: updatePackage2,
  changePackageStatus: changePackageStatus2,
  softDeletePackage: softDeletePackage2
};

// src/modules/package/package.validation.ts
import { z as z8 } from "zod";
var titleSchema = z8.string({ required_error: "Title is required" }).trim().min(3, "Title must be at least 3 characters").max(200, "Title must be at most 200 characters");
var descriptionSchema = z8.string({ required_error: "Description is required" }).trim().min(10, "Description must be at least 10 characters").max(1e4, "Description must be at most 10000 characters");
var locationSchema = z8.string({ required_error: "Location is required" }).trim().min(2, "Location must be at least 2 characters").max(200, "Location must be at most 200 characters");
var priceSchema = z8.number({ required_error: "Price is required" }).positive("Price must be a positive number").refine((val) => Math.round(val * 100) / 100 === val, {
  message: "Price must have at most 2 decimal places"
});
var durationSchema = z8.number({ required_error: "Duration is required" }).int("Duration must be a whole number of days").min(1, "Duration must be at least 1 day");
var categoryIdSchema = z8.string({ required_error: "Category id is required" }).min(1, "Category id must not be empty");
var imagesSchema = z8.array(z8.string().url("Each image must be a valid URL")).min(1, "At least one image is required").max(6, "At most 6 images are allowed");
var createPackageSchema = z8.object({
  title: titleSchema,
  description: descriptionSchema,
  location: locationSchema,
  price: priceSchema,
  duration: durationSchema,
  categoryId: categoryIdSchema,
  images: imagesSchema,
  agentId: z8.string().min(1).optional()
}).strict();
var updatePackageSchema = z8.object({
  title: titleSchema.optional(),
  description: descriptionSchema.optional(),
  location: locationSchema.optional(),
  price: priceSchema.optional(),
  duration: durationSchema.optional(),
  categoryId: categoryIdSchema.optional(),
  images: imagesSchema.optional()
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided to update"
});
var packageQuerySchema = z8.object({
  page: z8.coerce.number().int().min(1).default(1),
  limit: z8.coerce.number().int().min(1).max(50).default(10),
  search: z8.string().trim().min(1).max(200).optional(),
  category: z8.string().trim().min(1).max(200).optional(),
  location: z8.string().trim().min(1).max(200).optional(),
  minPrice: z8.coerce.number().positive().optional(),
  maxPrice: z8.coerce.number().positive().optional(),
  minRating: z8.coerce.number().min(0).max(5).optional(),
  maxDuration: z8.coerce.number().int().min(1).optional(),
  sortBy: z8.enum(["newest", "price", "rating", "title"]).default("newest"),
  sortOrder: z8.enum(["asc", "desc"]).optional()
}).refine((data) => {
  if (data.minPrice !== void 0 && data.maxPrice !== void 0) {
    return data.minPrice <= data.maxPrice;
  }
  return true;
}, {
  message: "minPrice must be less than or equal to maxPrice",
  path: ["minPrice"]
});
var internalPackageQuerySchema = z8.object({
  page: z8.coerce.number().int().min(1).default(1),
  limit: z8.coerce.number().int().min(1).max(50).default(10),
  status: z8.enum(["PENDING", "APPROVED", "REJECTED"]).transform((val) => val).optional(),
  agentId: z8.string().min(1).optional()
});
var packageParamsSchema = z8.object({
  id: z8.string({ required_error: "Package id is required" }).min(1)
});
var packageSlugParamsSchema = z8.object({
  slug: z8.string({ required_error: "Package slug is required" }).trim().min(1)
});
var updateStatusSchema2 = z8.object({
  status: z8.enum(["APPROVED", "REJECTED"], {
    required_error: "Status is required",
    invalid_type_error: "Status must be APPROVED or REJECTED"
  })
}).strict();
var packageValidations = {
  createPackageSchema,
  updatePackageSchema,
  packageQuerySchema,
  internalPackageQuerySchema,
  packageParamsSchema,
  packageSlugParamsSchema,
  updateStatusSchema: updateStatusSchema2
};

// src/modules/package/package.route.ts
var router8 = Router8();
router8.get(
  "/internal/my-packages",
  auth_default(Role.AGENT),
  validateRequest_default({ query: packageValidations.internalPackageQuerySchema }),
  packageController.getMyPackages
);
router8.get(
  "/internal/all",
  auth_default(Role.ADMIN),
  validateRequest_default({ query: packageValidations.internalPackageQuerySchema }),
  packageController.getAllPackages
);
router8.get(
  "/:slug",
  validateRequest_default({ params: packageValidations.packageSlugParamsSchema }),
  packageController.getPackageBySlug
);
router8.post(
  "/",
  auth_default(Role.AGENT, Role.ADMIN),
  validateRequest_default({ body: packageValidations.createPackageSchema }),
  packageController.createPackage
);
router8.patch(
  "/:id/status",
  auth_default(Role.ADMIN),
  validateRequest_default({
    params: packageValidations.packageParamsSchema,
    body: packageValidations.updateStatusSchema
  }),
  packageController.changePackageStatus
);
router8.patch(
  "/:id",
  auth_default(Role.AGENT, Role.ADMIN),
  validateRequest_default({
    params: packageValidations.packageParamsSchema,
    body: packageValidations.updatePackageSchema
  }),
  packageController.updatePackage
);
router8.delete(
  "/:id",
  auth_default(Role.AGENT, Role.ADMIN),
  validateRequest_default({ params: packageValidations.packageParamsSchema }),
  packageController.softDeletePackage
);
router8.get(
  "/",
  validateRequest_default({ query: packageValidations.packageQuerySchema }),
  packageController.getPublicPackages
);
var packageRoutes = router8;

// src/modules/blog/blog.route.ts
import { Router as Router9 } from "express";

// src/modules/blog/blog.controller.ts
import httpStatus10 from "http-status";

// src/modules/blog/blog.service.ts
import { randomUUID as randomUUID3 } from "node:crypto";
var publicAuthorSelect = {
  select: { id: true, name: true, avatarUrl: true }
};
var generateUniqueSlug2 = async (title) => {
  const base = slugify(title) || `blog-${randomUUID3().slice(0, 8)}`;
  const existing = await prisma.blogPost.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true }
  });
  const used = new Set(existing.map((p) => p.slug));
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};
var createPost = async (user, payload) => {
  const slug = await generateUniqueSlug2(payload.title);
  return prisma.blogPost.create({
    data: {
      title: payload.title,
      excerpt: payload.excerpt,
      content: payload.content,
      coverImage: payload.coverImage,
      slug,
      authorId: user.id
    },
    include: { author: publicAuthorSelect }
  });
};
var getPublicPosts = async (query) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const where = {
    status: PostStatus.PUBLISHED,
    isDeleted: false,
    ...query.search ? {
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { excerpt: { contains: query.search, mode: "insensitive" } }
      ]
    } : {}
  };
  const sortOrder = query.sortOrder ?? (query.sortBy === "oldest" ? "asc" : "desc");
  const orderByMap = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    title: { title: sortOrder }
  };
  const orderBy = orderByMap[query.sortBy ?? "newest"] ?? orderByMap.newest;
  const [data, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        createdAt: true,
        updatedAt: true,
        author: publicAuthorSelect
      },
      skip,
      take: limit
    }),
    prisma.blogPost.count({ where })
  ]);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getPostBySlug = async (slug) => {
  const post = await prisma.blogPost.findFirst({
    where: { slug, status: PostStatus.PUBLISHED, isDeleted: false },
    include: { author: publicAuthorSelect }
  });
  if (!post) {
    throw new AppError(404, "Post not found.");
  }
  return post;
};
var getAllPosts = async (query) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const where = {
    isDeleted: false,
    ...query.status ? { status: query.status } : {}
  };
  const [data, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.blogPost.count({ where })
  ]);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getMyPosts = async (user, query) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const where = {
    authorId: user.id,
    isDeleted: false,
    ...query.status ? { status: query.status } : {}
  };
  const [data, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.blogPost.count({ where })
  ]);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var findOwnedPost = async (user, postId) => {
  const post = await prisma.blogPost.findUnique({
    where: { id: postId }
  });
  if (!post) {
    throw new AppError(404, "Post not found.");
  }
  if (user.role !== Role.ADMIN && post.authorId !== user.id) {
    throw new AppError(403, "You can only act on your own posts.");
  }
  return post;
};
var updatePost = async (user, postId, payload) => {
  await findOwnedPost(user, postId);
  const data = {
    ...payload.title !== void 0 ? { title: payload.title } : {},
    ...payload.excerpt !== void 0 ? { excerpt: payload.excerpt } : {},
    ...payload.content !== void 0 ? { content: payload.content } : {},
    ...payload.coverImage !== void 0 ? { coverImage: payload.coverImage } : {},
    ...user.role !== Role.ADMIN ? { status: PostStatus.DRAFT } : {}
  };
  return prisma.blogPost.update({
    where: { id: postId },
    data,
    include: { author: publicAuthorSelect }
  });
};
var changePostStatus = async (postId, payload) => {
  const post = await prisma.blogPost.findUniqueOrThrow({
    where: { id: postId }
  });
  if (post.isDeleted) {
    throw new AppError(400, "Cannot change the status of a deleted post.");
  }
  return prisma.blogPost.update({
    where: { id: postId },
    data: { status: payload.status },
    include: { author: publicAuthorSelect }
  });
};
var softDeletePost = async (user, postId) => {
  await findOwnedPost(user, postId);
  return prisma.blogPost.update({
    where: { id: postId },
    data: { isDeleted: true }
  });
};
var blogService = {
  createPost,
  getPublicPosts,
  getPostBySlug,
  getAllPosts,
  getMyPosts,
  updatePost,
  changePostStatus,
  softDeletePost
};

// src/modules/blog/blog.controller.ts
var createPost2 = catchAsync(
  async (req, res, next) => {
    const result = await blogService.createPost(req.user, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus10.CREATED,
      message: "Post created successfully. It will be visible after publishing.",
      data: result
    });
  }
);
var getPublicPosts2 = catchAsync(
  async (req, res, next) => {
    const result = await blogService.getPublicPosts(req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus10.OK,
      message: "Posts retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var getPostBySlug2 = catchAsync(
  async (req, res, next) => {
    const slug = String(req.params.slug);
    const result = await blogService.getPostBySlug(slug);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus10.OK,
      message: "Post retrieved successfully.",
      data: result
    });
  }
);
var getAllPosts2 = catchAsync(
  async (req, res, next) => {
    const result = await blogService.getAllPosts(req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus10.OK,
      message: "All posts retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var getMyPosts2 = catchAsync(
  async (req, res, next) => {
    const result = await blogService.getMyPosts(req.user, req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus10.OK,
      message: "Posts retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var updatePost2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    const result = await blogService.updatePost(req.user, id, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus10.OK,
      message: "Post updated successfully.",
      data: result
    });
  }
);
var changePostStatus2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    const result = await blogService.changePostStatus(id, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus10.OK,
      message: "Post status updated successfully.",
      data: result
    });
  }
);
var softDeletePost2 = catchAsync(
  async (req, res, next) => {
    const id = String(req.params.id);
    await blogService.softDeletePost(req.user, id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus10.OK,
      message: "Post deleted successfully.",
      data: null
    });
  }
);
var blogController = {
  createPost: createPost2,
  getPublicPosts: getPublicPosts2,
  getPostBySlug: getPostBySlug2,
  getAllPosts: getAllPosts2,
  getMyPosts: getMyPosts2,
  updatePost: updatePost2,
  changePostStatus: changePostStatus2,
  softDeletePost: softDeletePost2
};

// src/modules/blog/blog.validation.ts
import { z as z9 } from "zod";
var titleSchema2 = z9.string({ required_error: "Title is required" }).trim().min(3, "Title must be at least 3 characters").max(200, "Title must be at most 200 characters");
var excerptSchema = z9.string({ required_error: "Excerpt is required" }).trim().min(1, "Excerpt must not be empty").max(500, "Excerpt must be at most 500 characters");
var contentSchema = z9.string({ required_error: "Content is required" }).trim().min(1, "Content must not be empty").max(1e4, "Content must be at most 10000 characters");
var coverImageSchema = z9.string({ required_error: "Cover image is required" }).url("Cover image must be a valid URL");
var createPostSchema = z9.object({
  title: titleSchema2,
  excerpt: excerptSchema,
  content: contentSchema,
  coverImage: coverImageSchema
}).strict();
var updatePostSchema = z9.object({
  title: titleSchema2.optional(),
  excerpt: excerptSchema.optional(),
  content: contentSchema.optional(),
  coverImage: coverImageSchema.optional()
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided to update"
});
var postParamsSchema = z9.object({
  id: z9.string({ required_error: "Post id is required" }).min(1)
});
var postSlugParamsSchema = z9.object({
  slug: z9.string({ required_error: "Post slug is required" }).trim().min(1)
});
var updateStatusSchema3 = z9.object({
  status: z9.enum(["DRAFT", "PUBLISHED"], {
    required_error: "Status is required",
    invalid_type_error: "Status must be DRAFT or PUBLISHED"
  })
}).strict();
var publicQuerySchema = z9.object({
  page: z9.coerce.number().int().min(1).default(1),
  limit: z9.coerce.number().int().min(1).max(50).default(10),
  search: z9.string().trim().min(1).max(200).optional(),
  sortBy: z9.enum(["newest", "oldest", "title"]).default("newest"),
  sortOrder: z9.enum(["asc", "desc"]).optional()
});
var internalQuerySchema = z9.object({
  page: z9.coerce.number().int().min(1).default(1),
  limit: z9.coerce.number().int().min(1).max(50).default(10),
  status: z9.enum(["DRAFT", "PUBLISHED"]).transform((val) => val).optional()
});
var blogValidations = {
  createPostSchema,
  updatePostSchema,
  postParamsSchema,
  postSlugParamsSchema,
  updateStatusSchema: updateStatusSchema3,
  publicQuerySchema,
  internalQuerySchema
};

// src/modules/blog/blogComment.controller.ts
import httpStatus11 from "http-status";

// src/modules/blog/blogComment.service.ts
var getPostIdBySlug = async (slug) => {
  const post = await prisma.blogPost.findFirst({
    where: { slug, status: PostStatus.PUBLISHED, isDeleted: false },
    select: { id: true }
  });
  if (!post) {
    throw new AppError(404, "Post not found.");
  }
  return post.id;
};
var getPostComments = async (slug, query) => {
  const postId = await getPostIdBySlug(slug);
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const topLevelWhere = {
    postId,
    parentId: null,
    isDeleted: false
  };
  const [topLevel, total] = await Promise.all([
    prisma.blogComment.findMany({
      where: topLevelWhere,
      include: { user: publicAuthorSelect },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.blogComment.count({ where: topLevelWhere })
  ]);
  const replies = topLevel.length > 0 ? await prisma.blogComment.findMany({
    where: {
      postId,
      isDeleted: false,
      parentId: { in: topLevel.map((c) => c.id) }
    },
    include: { user: publicAuthorSelect },
    orderBy: { createdAt: "asc" }
  }) : [];
  const replyMap = /* @__PURE__ */ new Map();
  for (const reply of replies) {
    const list = replyMap.get(reply.parentId) ?? [];
    list.push(reply);
    replyMap.set(reply.parentId, list);
  }
  const data = topLevel.map((comment) => ({
    ...comment,
    replies: replyMap.get(comment.id) ?? []
  }));
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var createComment = async (userId, slug, payload) => {
  const postId = await getPostIdBySlug(slug);
  let parentId = null;
  if (payload.parentId) {
    const parent = await prisma.blogComment.findFirst({
      where: {
        id: payload.parentId,
        postId,
        isDeleted: false
      },
      select: { id: true, parentId: true }
    });
    if (!parent) {
      throw new AppError(400, "Parent comment not found on this post.");
    }
    if (parent.parentId !== null) {
      throw new AppError(400, "Replies to replies are not allowed.");
    }
    parentId = parent.id;
  }
  return prisma.blogComment.create({
    data: { content: payload.content, postId, userId, parentId },
    include: { user: publicAuthorSelect }
  });
};
var deleteComment = async (userId, role, commentId) => {
  const result = await prisma.blogComment.updateMany({
    where: {
      id: commentId,
      isDeleted: false,
      ...role !== Role.ADMIN ? { userId } : {}
    },
    data: { isDeleted: true }
  });
  if (result.count === 0) {
    throw new AppError(404, "Comment not found.");
  }
};
var blogCommentService = {
  getPostComments,
  createComment,
  deleteComment
};

// src/modules/blog/blogComment.controller.ts
var getPostComments2 = catchAsync(
  async (req, res, next) => {
    const slug = String(req.params.slug);
    const result = await blogCommentService.getPostComments(slug, req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus11.OK,
      message: "Comments retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var createComment2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const slug = String(req.params.slug);
    const result = await blogCommentService.createComment(userId, slug, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus11.CREATED,
      message: "Comment posted successfully.",
      data: result
    });
  }
);
var deleteComment2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const role = req.user.role;
    const id = String(req.params.id);
    await blogCommentService.deleteComment(userId, role, id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus11.OK,
      message: "Comment deleted successfully.",
      data: null
    });
  }
);
var blogCommentController = {
  getPostComments: getPostComments2,
  createComment: createComment2,
  deleteComment: deleteComment2
};

// src/modules/blog/blogComment.validation.ts
import { z as z10 } from "zod";
var createCommentSchema = z10.object({
  content: z10.string({ required_error: "Content is required" }).trim().min(1, "Content must not be empty").max(2e3, "Content must be at most 2000 characters"),
  parentId: z10.string().min(1, "parentId must not be empty").optional()
}).strict();
var commentParamsSchema = z10.object({
  id: z10.string({ required_error: "Comment id is required" }).min(1, "Comment id must not be empty")
});
var commentQuerySchema = z10.object({
  page: z10.coerce.number().int().min(1).default(1),
  limit: z10.coerce.number().int().min(1).max(50).default(10)
});
var blogCommentValidations = {
  createCommentSchema,
  commentParamsSchema,
  commentQuerySchema
};

// src/modules/blog/blog.route.ts
var router9 = Router9();
router9.get(
  "/internal/all",
  auth_default(Role.ADMIN),
  validateRequest_default({ query: blogValidations.internalQuerySchema }),
  blogController.getAllPosts
);
router9.get(
  "/my-posts",
  auth_default(Role.AGENT, Role.ADMIN),
  validateRequest_default({ query: blogValidations.internalQuerySchema }),
  blogController.getMyPosts
);
router9.get(
  "/",
  validateRequest_default({ query: blogValidations.publicQuerySchema }),
  blogController.getPublicPosts
);
router9.get(
  "/:slug",
  validateRequest_default({ params: blogValidations.postSlugParamsSchema }),
  blogController.getPostBySlug
);
router9.post(
  "/",
  auth_default(Role.AGENT, Role.ADMIN),
  validateRequest_default({ body: blogValidations.createPostSchema }),
  blogController.createPost
);
router9.get(
  "/:slug/comments",
  validateRequest_default({
    params: blogValidations.postSlugParamsSchema,
    query: blogCommentValidations.commentQuerySchema
  }),
  blogCommentController.getPostComments
);
router9.post(
  "/:slug/comments",
  auth_default(),
  validateRequest_default({
    params: blogValidations.postSlugParamsSchema,
    body: blogCommentValidations.createCommentSchema
  }),
  blogCommentController.createComment
);
router9.delete(
  "/comments/:id",
  auth_default(),
  validateRequest_default({ params: blogCommentValidations.commentParamsSchema }),
  blogCommentController.deleteComment
);
router9.patch(
  "/:id/status",
  auth_default(Role.ADMIN),
  validateRequest_default({
    params: blogValidations.postParamsSchema,
    body: blogValidations.updateStatusSchema
  }),
  blogController.changePostStatus
);
router9.patch(
  "/:id",
  auth_default(Role.AGENT, Role.ADMIN),
  validateRequest_default({
    params: blogValidations.postParamsSchema,
    body: blogValidations.updatePostSchema
  }),
  blogController.updatePost
);
router9.delete(
  "/:id",
  auth_default(Role.AGENT, Role.ADMIN),
  validateRequest_default({ params: blogValidations.postParamsSchema }),
  blogController.softDeletePost
);
var blogRoutes = router9;

// src/modules/dashboard/dashboard.route.ts
import { Router as Router10 } from "express";

// src/modules/dashboard/dashboard.controller.ts
import httpStatus12 from "http-status";

// src/modules/dashboard/dashboard.service.ts
var toNumber = (value) => Number(value ?? 0);
var getBookingsByStatus = async (scope = {}) => {
  const grouped = await prisma.booking.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: scope.agentId ? { package: { agentId: scope.agentId, isDeleted: false } } : scope.userId ? { userId: scope.userId } : void 0
  });
  return grouped.map((g) => ({ status: g.status, count: g._count._all })).sort((a, b) => b.count - a.count);
};
var getRevenueOverTime = async (days, scope = {}) => {
  const agentScope = scope.agentId ? `AND b."packageId" IN (
         SELECT p."id"
         FROM "tour_packages" p
         WHERE p."agentId" = $2
           AND p."isDeleted" = false
       )` : "";
  const userScope = scope.userId ? `AND b."userId" = $2` : "";
  const whereClause = scope.agentId ? agentScope : userScope;
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT to_char(days.d, 'YYYY-MM-DD') AS date,
           COALESCE(SUM(b."totalPrice"), 0)::float8 AS revenue
    FROM generate_series(
      CURRENT_DATE - make_interval(days => $1::int - 1),
      CURRENT_DATE,
      '1 day'::interval
    ) AS days(d)
    LEFT JOIN "bookings" b
      ON date_trunc('day', b."updatedAt")::date = days.d
      AND b."status" = 'COMPLETED'
      ${whereClause}
    GROUP BY days.d
    ORDER BY days.d ASC
    `,
    days,
    ...scope.agentId || scope.userId ? [scope.agentId ?? scope.userId] : []
  );
  return rows;
};
var toPackageIdScope = (packageIds) => packageIds.length ? { packageId: { in: packageIds } } : { packageId: { in: [] } };
var getAdminDashboard = async (days) => {
  const [
    totalUsers,
    totalPackages,
    totalBookings,
    totalRevenue,
    usersByRole,
    bookingsByStatus,
    packagesByCategory,
    revenueOverTime
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.tourPackage.count({ where: { isDeleted: false } }),
    prisma.booking.count(),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: { status: BookingStatus.COMPLETED }
    }),
    prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
      where: { isDeleted: false }
    }),
    getBookingsByStatus(),
    prisma.tourPackage.groupBy({
      by: ["categoryId"],
      _count: { _all: true },
      where: { isDeleted: false }
    }).then(async (grouped) => {
      const categoryIds = grouped.map((g) => g.categoryId);
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true }
      });
      const nameMap = new Map(categories.map((c) => [c.id, c.name]));
      return grouped.map((g) => ({
        category: nameMap.get(g.categoryId) ?? "Unknown",
        count: g._count._all
      })).sort((a, b) => b.count - a.count);
    }),
    getRevenueOverTime(days)
  ]);
  return {
    totalUsers,
    totalPackages,
    totalBookings,
    totalRevenue: toNumber(totalRevenue._sum.totalPrice),
    usersByRole: usersByRole.map((g) => ({ role: g.role, count: g._count._all })).sort((a, b) => b.count - a.count),
    bookingsByStatus,
    packagesByCategory,
    revenueOverTime
  };
};
var getAgentDashboard = async (userId, days) => {
  const [ownedPackages, bookingsByStatus, averageRating] = await Promise.all([
    prisma.tourPackage.findMany({
      where: { agentId: userId, isDeleted: false },
      select: { id: true }
    }),
    getBookingsByStatus({ agentId: userId }),
    prisma.tourPackage.aggregate({
      _avg: { rating: true },
      where: {
        agentId: userId,
        status: PackageStatus.APPROVED,
        isDeleted: false
      }
    })
  ]);
  const packageIds = ownedPackages.map((p) => p.id);
  if (packageIds.length === 0) {
    return {
      totalPackages: 0,
      totalBookings: 0,
      totalRevenue: 0,
      averageRating: Math.round((averageRating._avg.rating ?? 0) * 10) / 10,
      bookingsByStatus,
      revenueOverTime: await getRevenueOverTime(days, { agentId: userId })
    };
  }
  const scope = toPackageIdScope(packageIds);
  const [totalPackages, totalBookings, totalRevenue, revenueOverTime] = await Promise.all([
    packageIds.length,
    prisma.booking.count({ where: scope }),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: {
        AND: [scope, { status: BookingStatus.COMPLETED }]
      }
    }),
    getRevenueOverTime(days, { agentId: userId })
  ]);
  return {
    totalPackages,
    totalBookings,
    totalRevenue: toNumber(totalRevenue._sum.totalPrice),
    averageRating: Math.round((averageRating._avg.rating ?? 0) * 10) / 10,
    bookingsByStatus,
    revenueOverTime
  };
};
var getUserDashboard = async (userId, days = 30) => {
  const [totalBookings, totalSpend, upcoming, bookingsByStatus, revenueOverTime] = await Promise.all([
    prisma.booking.count({ where: { userId } }),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: { userId, status: BookingStatus.COMPLETED }
    }),
    prisma.booking.findMany({
      where: {
        userId,
        status: {
          in: [BookingStatus.PENDING, BookingStatus.PAID, BookingStatus.CONFIRMED]
        },
        travelDate: { gt: /* @__PURE__ */ new Date() }
      },
      select: {
        id: true,
        travelDate: true,
        travelers: true,
        totalPrice: true,
        status: true,
        package: { select: { id: true, title: true, slug: true } }
      },
      orderBy: { travelDate: "asc" },
      take: 5
    }),
    getBookingsByStatus({ userId }),
    getRevenueOverTime(days, { userId })
  ]);
  return {
    totalBookings,
    totalSpend: toNumber(totalSpend._sum.totalPrice),
    upcomingCount: upcoming.length,
    upcoming: upcoming.map((b) => ({
      ...b,
      totalPrice: Number(b.totalPrice)
    })),
    bookingsByStatus,
    revenueOverTime
  };
};
var dashboardService = {
  getAdminDashboard,
  getAgentDashboard,
  getUserDashboard
};

// src/modules/dashboard/dashboard.controller.ts
var getAdminDashboard2 = catchAsync(
  async (req, res, next) => {
    const result = await dashboardService.getAdminDashboard(
      Number(req.query.days)
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus12.OK,
      message: "Dashboard data fetched successfully.",
      data: result
    });
  }
);
var getAgentDashboard2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const result = await dashboardService.getAgentDashboard(
      userId,
      Number(req.query.days)
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus12.OK,
      message: "Dashboard data fetched successfully.",
      data: result
    });
  }
);
var getUserDashboard2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const result = await dashboardService.getUserDashboard(
      userId,
      Number(req.query.days)
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus12.OK,
      message: "Dashboard data fetched successfully.",
      data: result
    });
  }
);
var dashboardController = {
  getAdminDashboard: getAdminDashboard2,
  getAgentDashboard: getAgentDashboard2,
  getUserDashboard: getUserDashboard2
};

// src/modules/dashboard/dashboard.validation.ts
import { z as z11 } from "zod";
var dashboardQuerySchema = z11.object({
  days: z11.coerce.number().int().min(1).max(365).default(30)
});
var dashboardValidations = {
  dashboardQuerySchema
};

// src/modules/dashboard/dashboard.route.ts
var router10 = Router10();
router10.get(
  "/admin",
  auth_default(Role.ADMIN),
  validateRequest_default({ query: dashboardValidations.dashboardQuerySchema }),
  dashboardController.getAdminDashboard
);
router10.get(
  "/agent",
  auth_default(Role.AGENT),
  validateRequest_default({ query: dashboardValidations.dashboardQuerySchema }),
  dashboardController.getAgentDashboard
);
router10.get(
  "/user",
  auth_default(Role.USER),
  validateRequest_default({ query: dashboardValidations.dashboardQuerySchema }),
  dashboardController.getUserDashboard
);
var dashboardRoutes = router10;

// src/modules/payment/payment.route.ts
import { Router as Router11 } from "express";

// src/modules/payment/payment.controller.ts
import httpStatus13 from "http-status";

// src/modules/payment/payment.service.ts
var buildCallbackUrl = (bookingId, tranId, kind) => `${config_default.backend_public_url}/api/payments/${kind === "ipn" ? "ipn" : "confirm"}?bookingId=${bookingId}&tranId=${tranId}${kind === "ipn" ? "" : `&status=${kind}`}`;
var createPaymentSession = async (userId, payload) => {
  const { bookingId } = payload;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { package: { select: { title: true } } }
  });
  if (!booking) {
    throw new AppError(404, "Booking not found.");
  }
  if (booking.userId !== userId) {
    throw new AppError(403, "You are not authorized to pay for this booking.");
  }
  if (booking.status === BookingStatus.PAID) {
    throw new AppError(409, "This booking is already paid.");
  }
  if (booking.status !== BookingStatus.PENDING) {
    throw new AppError(
      409,
      `Cannot pay for a booking in ${booking.status.toLowerCase()} status.`
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true }
  });
  if (!user) {
    throw new AppError(404, "User not found.");
  }
  const amount = Number(booking.totalPrice);
  const tranId = generateTranId();
  const payment = await prisma.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { bookingId, status: PaymentStatus.INITIATED },
      data: { status: PaymentStatus.CANCELLED }
    });
    return tx.payment.create({
      data: {
        bookingId,
        tranId,
        amount,
        status: PaymentStatus.INITIATED
      }
    });
  });
  let init;
  try {
    init = await sslcommerzInit({
      total_amount: amount,
      tran_id: tranId,
      success_url: buildCallbackUrl(bookingId, tranId, "success"),
      fail_url: buildCallbackUrl(bookingId, tranId, "fail"),
      cancel_url: buildCallbackUrl(bookingId, tranId, "cancel"),
      ipn_url: buildCallbackUrl(bookingId, tranId, "ipn"),
      cus_name: user.name,
      cus_email: user.email,
      cus_phone: user.phone ?? "01711111111"
    });
  } catch (error) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.INITIATED },
      data: { status: PaymentStatus.FAILED }
    });
    throw error;
  }
  await prisma.payment.updateMany({
    where: { id: payment.id, status: PaymentStatus.INITIATED },
    data: { gatewayPageUrl: init.GatewayPageURL, sslSessionKey: init.sessionkey }
  });
  return {
    paymentId: payment.id,
    tranId: payment.tranId,
    paymentUrl: init.GatewayPageURL ?? null
  };
};
var verifySuccess = async (valId, expectedAmount) => {
  let verified = null;
  try {
    verified = await sslcommerzValidate({ val_id: valId });
  } catch {
    return { verified: null, matchesAmount: false };
  }
  const validStatus = verified.status === "VALID" || verified.status === "VALIDATED";
  const matchesAmount = verified.amount !== void 0 && Number(verified.amount) === expectedAmount;
  return { verified, matchesAmount: validStatus && matchesAmount };
};
var processGatewayResult = async (bookingId, tranId, result) => {
  const payment = await prisma.payment.findUnique({
    where: { tranId },
    include: {
      booking: {
        include: {
          user: { select: { name: true, email: true } },
          package: { select: { title: true } }
        }
      }
    }
  });
  if (!payment || payment.bookingId !== bookingId) {
    return { paymentStatus: PaymentStatus.FAILED, bookingStatus: null, changed: false };
  }
  if (payment.status === PaymentStatus.SUCCESS) {
    return {
      paymentStatus: PaymentStatus.SUCCESS,
      bookingStatus: payment.booking.status,
      changed: false
    };
  }
  if (result.fail_status === "CANCELLED" || result.status === "CANCELLED") {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.CANCELLED }
    });
    return {
      paymentStatus: updated.status,
      bookingStatus: payment.booking.status,
      changed: updated.status !== payment.status
    };
  }
  if (!result.val_id) {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED }
    });
    return {
      paymentStatus: updated.status,
      bookingStatus: payment.booking.status,
      changed: updated.status !== payment.status
    };
  }
  const { verified, matchesAmount } = await verifySuccess(
    result.val_id,
    Number(payment.amount)
  );
  if (!matchesAmount) {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED }
    });
    return {
      paymentStatus: updated.status,
      bookingStatus: payment.booking.status,
      changed: true
    };
  }
  const settled = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCESS,
        valId: result.val_id,
        cardType: result.card_type ?? verified?.card_type,
        bankTranId: result.bank_tran_id ?? verified?.bank_tran_id,
        paidAt: /* @__PURE__ */ new Date()
      }
    });
    await tx.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.PENDING },
      data: { status: BookingStatus.PAID }
    });
    return updated;
  });
  const bookingAfter = await prisma.booking.findUnique({ where: { id: bookingId } });
  void Promise.allSettled([
    sendBookingEmail({
      email: payment.booking.user.email,
      name: payment.booking.user.name,
      packageTitle: payment.booking.package.title,
      travelDate: payment.booking.travelDate,
      travelers: payment.booking.travelers,
      totalPrice: Number(payment.amount),
      status: BookingStatus.PAID
    })
  ]);
  return {
    paymentStatus: settled.status,
    bookingStatus: bookingAfter?.status ?? null,
    changed: true
  };
};
var paymentService = {
  createPaymentSession,
  processGatewayResult
};

// src/modules/payment/payment.controller.ts
var createPayment = catchAsync(
  async (req, res, next) => {
    const userId = req.user?.id;
    const session = await paymentService.createPaymentSession(userId, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus13.CREATED,
      message: "Payment session created successfully.",
      data: session
    });
  }
);
var confirmPayment = catchAsync(
  async (req, res, next) => {
    const bookingId = String(req.query.bookingId);
    const tranId = String(req.query.tranId);
    const status = String(req.query.status ?? "fail");
    await paymentService.processGatewayResult(
      bookingId,
      tranId,
      req.body
    );
    const redirectBase = config_default.node_env === "production" ? config_default.frontend_url_prod : config_default.frontend_url_dev;
    const page = ["success", "fail", "cancel"].includes(status) ? status : "fail";
    res.redirect(302, `${redirectBase}/payment/${page}?bookingId=${bookingId}`);
  }
);
var ipn = catchAsync(
  async (req, res, next) => {
    const bookingId = String(req.query.bookingId);
    const tranId = String(req.query.tranId);
    await paymentService.processGatewayResult(
      bookingId,
      tranId,
      req.body
    );
    res.status(200).type("text/plain").send("OK");
  }
);
var paymentController = {
  createPayment,
  confirmPayment,
  ipn
};

// src/modules/payment/payment.validation.ts
import { z as z12 } from "zod";
var createSchema2 = z12.object({
  bookingId: z12.string({ required_error: "Booking id is required" }).uuid("Booking id must be a valid uuid")
});
var callbackQuerySchema = z12.object({
  bookingId: z12.string().uuid("Booking id must be a valid uuid"),
  tranId: z12.string().min(1),
  status: z12.enum(["success", "fail", "cancel"]).optional()
});
var gatewayResultSchema = z12.object({
  val_id: z12.string().optional(),
  status: z12.string().optional(),
  fail_status: z12.string().optional(),
  card_type: z12.string().optional(),
  bank_tran_id: z12.string().optional(),
  currency: z12.string().optional(),
  amount: z12.string().optional()
});
var paymentValidations = {
  createSchema: createSchema2,
  callbackQuerySchema,
  gatewayResultSchema
};

// src/modules/payment/payment.route.ts
var router11 = Router11();
router11.post(
  "/create",
  auth_default(Role.USER),
  validateRequest_default({ body: paymentValidations.createSchema }),
  paymentController.createPayment
);
router11.post(
  "/confirm",
  validateRequest_default({
    query: paymentValidations.callbackQuerySchema,
    body: paymentValidations.gatewayResultSchema
  }),
  paymentController.confirmPayment
);
router11.post(
  "/ipn",
  validateRequest_default({
    query: paymentValidations.callbackQuerySchema,
    body: paymentValidations.gatewayResultSchema
  }),
  paymentController.ipn
);
var paymentRoutes = router11;

// src/modules/wishlist/wishlist.route.ts
import { Router as Router12 } from "express";

// src/modules/wishlist/wishlist.controller.ts
import httpStatus14 from "http-status";

// src/modules/wishlist/wishlist.service.ts
var serializeWishlistItem = (row) => ({
  ...row,
  package: { ...row.package, price: Number(row.package.price) }
});
var addToWishlist = async (userId, payload) => {
  const tourPackage = await prisma.tourPackage.findFirst({
    where: {
      id: payload.packageId,
      status: PackageStatus.APPROVED,
      isDeleted: false
    },
    select: { id: true }
  });
  if (!tourPackage) {
    throw new AppError(404, "Package not found.");
  }
  return prisma.wishlistItem.upsert({
    where: { userId_packageId: { userId, packageId: payload.packageId } },
    create: { userId, packageId: payload.packageId },
    update: {}
  });
};
var getMyWishlist = async (userId, query) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;
  const where = {
    userId,
    package: { isDeleted: false, status: PackageStatus.APPROVED }
  };
  const [data, total] = await Promise.all([
    prisma.wishlistItem.findMany({
      where,
      include: { package: { include: publicPackageInclude } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.wishlistItem.count({ where })
  ]);
  return {
    data: data.map(serializeWishlistItem),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var removeFromWishlist = async (userId, packageId) => {
  await prisma.wishlistItem.deleteMany({
    where: { userId, packageId }
  });
};
var wishlistService = {
  addToWishlist,
  getMyWishlist,
  removeFromWishlist
};

// src/modules/wishlist/wishlist.controller.ts
var addToWishlist2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const result = await wishlistService.addToWishlist(userId, req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus14.CREATED,
      message: "Package added to wishlist successfully.",
      data: result
    });
  }
);
var getMyWishlist2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const result = await wishlistService.getMyWishlist(userId, req.query);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus14.OK,
      message: "Wishlist retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var removeFromWishlist2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const packageId = String(req.params.packageId);
    await wishlistService.removeFromWishlist(userId, packageId);
    res.status(httpStatus14.NO_CONTENT).send();
  }
);
var wishlistController = {
  addToWishlist: addToWishlist2,
  getMyWishlist: getMyWishlist2,
  removeFromWishlist: removeFromWishlist2
};

// src/modules/wishlist/wishlist.validation.ts
import { z as z13 } from "zod";
var createWishlistSchema = z13.object({
  packageId: z13.string({ required_error: "Package id is required" }).min(1, "Package id must not be empty")
}).strict();
var wishlistParamsSchema = z13.object({
  packageId: z13.string({ required_error: "Package id is required" }).min(1, "Package id must not be empty")
});
var wishlistQuerySchema = z13.object({
  page: z13.coerce.number().int().min(1).default(1),
  limit: z13.coerce.number().int().min(1).max(50).default(10)
});
var wishlistValidations = {
  createWishlistSchema,
  wishlistParamsSchema,
  wishlistQuerySchema
};

// src/modules/wishlist/wishlist.route.ts
var router12 = Router12();
router12.post(
  "/",
  auth_default(Role.USER),
  validateRequest_default({ body: wishlistValidations.createWishlistSchema }),
  wishlistController.addToWishlist
);
router12.get(
  "/",
  auth_default(Role.USER),
  validateRequest_default({ query: wishlistValidations.wishlistQuerySchema }),
  wishlistController.getMyWishlist
);
router12.delete(
  "/:packageId",
  auth_default(Role.USER),
  validateRequest_default({ params: wishlistValidations.wishlistParamsSchema }),
  wishlistController.removeFromWishlist
);
var wishlistRoutes = router12;

// src/modules/notification/notification.route.ts
import { Router as Router13 } from "express";

// src/modules/notification/notification.controller.ts
import httpStatus15 from "http-status";

// src/modules/notification/notification.service.ts
var getMyNotifications = async (userId, query) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const where = {
    userId,
    ...query.unread ? { isRead: false } : {}
  };
  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.notification.count({ where })
  ]);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getUnreadCount = async (userId) => {
  const count = await prisma.notification.count({
    where: { userId, isRead: false }
  });
  return { count };
};
var markAsRead = async (userId, id) => {
  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true }
  });
  if (result.count === 0) {
    throw new AppError(404, "Notification not found.");
  }
  return { count: result.count };
};
var markAllAsRead = async (userId) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });
  return { count: result.count };
};
var notificationService = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};

// src/modules/notification/notification.controller.ts
var getMyNotifications2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const result = await notificationService.getMyNotifications(
      userId,
      req.query
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus15.OK,
      message: "Notifications retrieved successfully.",
      data: result.data,
      meta: result.meta
    });
  }
);
var getUnreadCount2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const result = await notificationService.getUnreadCount(userId);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus15.OK,
      message: "Unread count retrieved successfully.",
      data: result
    });
  }
);
var markAsRead2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const id = String(req.params.id);
    const result = await notificationService.markAsRead(userId, id);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus15.OK,
      message: "Notification marked as read.",
      data: result
    });
  }
);
var markAllAsRead2 = catchAsync(
  async (req, res, next) => {
    const userId = String(req.user?.id);
    const result = await notificationService.markAllAsRead(userId);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus15.OK,
      message: "All notifications marked as read.",
      data: result
    });
  }
);
var notificationController = {
  getMyNotifications: getMyNotifications2,
  getUnreadCount: getUnreadCount2,
  markAsRead: markAsRead2,
  markAllAsRead: markAllAsRead2
};

// src/modules/notification/notification.validation.ts
import { z as z14 } from "zod";
var notificationQuerySchema = z14.object({
  page: z14.coerce.number().int().min(1).default(1),
  limit: z14.coerce.number().int().min(1).max(50).default(20),
  // "true"/"false" strings only — z.coerce.boolean() would treat the string
  // "false" as truthy.
  unread: z14.enum(["true", "false"]).transform((value) => value === "true").optional()
});
var notificationParamsSchema = z14.object({
  id: z14.string({ required_error: "Notification id is required" }).min(1, "Notification id must not be empty")
});
var notificationValidations = {
  notificationQuerySchema,
  notificationParamsSchema
};

// src/modules/notification/notification.route.ts
var router13 = Router13();
router13.get(
  "/",
  auth_default(),
  validateRequest_default({ query: notificationValidations.notificationQuerySchema }),
  notificationController.getMyNotifications
);
router13.get(
  "/unread-count",
  auth_default(),
  notificationController.getUnreadCount
);
router13.patch(
  "/read-all",
  auth_default(),
  notificationController.markAllAsRead
);
router13.patch(
  "/:id/read",
  auth_default(),
  validateRequest_default({ params: notificationValidations.notificationParamsSchema }),
  notificationController.markAsRead
);
var notificationRoutes = router13;

// src/app.ts
var app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    // Dev host (localhost) + prod host (Vercel) both allowed side-by-side.
    // Config resolves sensible defaults so neither can be falsy.
    origin: [config_default.frontend_url_dev, config_default.frontend_url_prod].filter(
      (o) => Boolean(o)
    ),
    credentials: true
  })
);
if (config_default.node_env === "development") {
  app.use(morgan("dev"));
}
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes."
  }
});
var apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/demo-login", authLimiter);
app.use("/api/auth/google", authLimiter);
app.use("/api/auth/verify-email", authLimiter);
app.use("/api/auth/resend-verification", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api", apiLimiter);
app.get("/", (req, res) => {
  res.send("Welcome to the TripVerse API!");
});
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: "OK",
      db: "connected",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "Service unavailable",
      db: "disconnected",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/notifications", notificationRoutes);
app.use(notFound_default);
app.use(globalErrorHandler_default);
var app_default = app;

// api/index.ts
var index_default = app_default;
export {
  index_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FwcC50cyIsICIuLi9zcmMvY29uZmlnL2luZGV4LnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL25vdEZvdW5kLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudC50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2ludGVybmFsL2NsYXNzLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXMudHMiLCAiLi4vc3JjL3V0aWxzL2FwcEVycm9yLnRzIiwgIi4uL3NyYy9saWIvcHJpc21hLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguc2VydmljZS50cyIsICIuLi9zcmMvbGliL2dvb2dsZUF1dGgudHMiLCAiLi4vc3JjL2xpYi9yZWRpcy50cyIsICIuLi9zcmMvdXRpbHMvand0LnRzIiwgIi4uL3NyYy9saWIvbm9kZW1haWxlci50cyIsICIuLi9zcmMvdGVtcGxhdGVzL2luZGV4LnRzIiwgIi4uL3NyYy91dGlscy9hdXRoRW1haWwudHMiLCAiLi4vc3JjL3V0aWxzL2NhdGNoQXN5bmMudHMiLCAiLi4vc3JjL3V0aWxzL3NlbmRSZXNwb25zZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGgudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3QudHMiLCAiLi4vc3JjL21pZGRsZXdhcmUvYXV0aC50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9saWIvY2xvdWRpbmFyeS50cyIsICIuLi9zcmMvbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jb250YWN0L2NvbnRhY3Qucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL2VtYWlsLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbGliL3NzbGNvbW1lcnoudHMiLCAiLi4vc3JjL3V0aWxzL25vdGlmaWNhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcmV2aWV3L3Jldmlldy52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL3NsdWdpZnkudHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2Uuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nQ29tbWVudC5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jsb2cvYmxvZ0NvbW1lbnQuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2dDb21tZW50LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3Qucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3dpc2hsaXN0L3dpc2hsaXN0LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ub3RpZmljYXRpb24vbm90aWZpY2F0aW9uLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL25vdGlmaWNhdGlvbi9ub3RpZmljYXRpb24udmFsaWRhdGlvbi50cyIsICJpbmRleC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IGV4cHJlc3MsIHsgQXBwbGljYXRpb24sIE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xyXG5pbXBvcnQgY29ycyBmcm9tIFwiY29yc1wiO1xyXG5pbXBvcnQgY29va2llUGFyc2VyIGZyb20gXCJjb29raWUtcGFyc2VyXCI7XHJcbmltcG9ydCBoZWxtZXQgZnJvbSBcImhlbG1ldFwiO1xyXG5pbXBvcnQgbW9yZ2FuIGZyb20gXCJtb3JnYW5cIjtcclxuaW1wb3J0IHJhdGVMaW1pdCBmcm9tIFwiZXhwcmVzcy1yYXRlLWxpbWl0XCI7XHJcbmltcG9ydCBjb25maWcgZnJvbSBcIi4vY29uZmlnXCI7XHJcbmltcG9ydCBub3RGb3VuZEhhbmRsZXIgZnJvbSBcIi4vbWlkZGxld2FyZS9ub3RGb3VuZFwiO1xyXG5pbXBvcnQgZ2xvYmFsRXJyb3JIYW5kbGVyIGZyb20gXCIuL21pZGRsZXdhcmUvZ2xvYmFsRXJyb3JIYW5kbGVyXCI7XHJcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuL2xpYi9wcmlzbWFcIjtcclxuaW1wb3J0IHsgYXV0aFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYXV0aC9hdXRoLnJvdXRlXCI7XHJcbmltcG9ydCB7IHVzZXJSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZVwiO1xyXG5pbXBvcnQgeyB1cGxvYWRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBjb250YWN0Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9jb250YWN0L2NvbnRhY3Qucm91dGVcIjtcclxuaW1wb3J0IHsgYm9va2luZ1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlXCI7XHJcbmltcG9ydCB7IHJldmlld1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcmV2aWV3L3Jldmlldy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBjYXRlZ29yeVJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkucm91dGVcIjtcclxuaW1wb3J0IHsgcGFja2FnZVJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGFja2FnZS9wYWNrYWdlLnJvdXRlXCI7XHJcbmltcG9ydCB7IGJsb2dSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Jsb2cvYmxvZy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBkYXNoYm9hcmRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQucm91dGVcIjtcclxuaW1wb3J0IHsgcGF5bWVudFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnJvdXRlXCI7XHJcbmltcG9ydCB7IHdpc2hsaXN0Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBub3RpZmljYXRpb25Sb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL25vdGlmaWNhdGlvbi9ub3RpZmljYXRpb24ucm91dGVcIjtcclxuXHJcbmNvbnN0IGFwcDogQXBwbGljYXRpb24gPSBleHByZXNzKCk7XHJcblxyXG4vLyBSZW5kZXIvUmFpbHdheSBzaXQgYmVoaW5kIGEgcmV2ZXJzZSBwcm94eSBcdTIwMTQgbXVzdCBiZSBzZXQgYmVmb3JlIHRoZVxyXG4vLyByYXRlIGxpbWl0ZXIgb3IgaXQgd2lsbCBzZWUgdGhlIHByb3h5J3MgSVAgZm9yIGV2ZXJ5IHJlcXVlc3QgYW5kXHJcbi8vIGVmZmVjdGl2ZWx5IHJhdGUtbGltaXQgYWxsIHVzZXJzIHRvZ2V0aGVyLlxyXG5hcHAuc2V0KFwidHJ1c3QgcHJveHlcIiwgMSk7XHJcblxyXG5hcHAudXNlKGhlbG1ldCgpKTtcclxuXHJcbmFwcC51c2UoXHJcbiAgY29ycyh7XHJcbiAgICAvLyBEZXYgaG9zdCAobG9jYWxob3N0KSArIHByb2QgaG9zdCAoVmVyY2VsKSBib3RoIGFsbG93ZWQgc2lkZS1ieS1zaWRlLlxyXG4gICAgLy8gQ29uZmlnIHJlc29sdmVzIHNlbnNpYmxlIGRlZmF1bHRzIHNvIG5laXRoZXIgY2FuIGJlIGZhbHN5LlxyXG4gICAgb3JpZ2luOiBbY29uZmlnLmZyb250ZW5kX3VybF9kZXYsIGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZF0uZmlsdGVyKFxyXG4gICAgICAobyk6IG8gaXMgc3RyaW5nID0+IEJvb2xlYW4obyksXHJcbiAgICApLFxyXG4gICAgY3JlZGVudGlhbHM6IHRydWUsXHJcbiAgfSksXHJcbik7XHJcblxyXG5pZiAoY29uZmlnLm5vZGVfZW52ID09PSBcImRldmVsb3BtZW50XCIpIHtcclxuICBhcHAudXNlKG1vcmdhbihcImRldlwiKSk7XHJcbn1cclxuXHJcbmFwcC51c2UoZXhwcmVzcy5qc29uKHsgbGltaXQ6IFwiMTAwa2JcIiB9KSk7XHJcbmFwcC51c2UoZXhwcmVzcy51cmxlbmNvZGVkKHsgZXh0ZW5kZWQ6IHRydWUsIGxpbWl0OiBcIjEwMGtiXCIgfSkpO1xyXG5hcHAudXNlKGNvb2tpZVBhcnNlcigpKTtcclxuXHJcbi8vIFN0cmljdCBsaW1pdGVyIFx1MjAxNCBhdXRoIGVuZHBvaW50cywgYnJ1dGUtZm9yY2UgcHJvdGVjdGlvbi5cclxuLy8gU2tpcHBlZCBpbiB0ZXN0cyBzbyB0aGUgc3VpdGVzIGNhbiBleGVyY2lzZSBldmVyeSBhdXRoIHBhdGggZnJlZWx5LlxyXG5jb25zdCBhdXRoTGltaXRlciA9IHJhdGVMaW1pdCh7XHJcbiAgd2luZG93TXM6IDE1ICogNjAgKiAxMDAwLFxyXG4gIGxpbWl0OiA1LFxyXG4gIHN0YW5kYXJkSGVhZGVyczogdHJ1ZSxcclxuICBsZWdhY3lIZWFkZXJzOiBmYWxzZSxcclxuICBza2lwOiAoKSA9PiBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gXCJ0ZXN0XCIsXHJcbiAgbWVzc2FnZToge1xyXG4gICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICBtZXNzYWdlOiBcIlRvbyBtYW55IGF0dGVtcHRzLiBQbGVhc2UgdHJ5IGFnYWluIGluIDE1IG1pbnV0ZXMuXCIsXHJcbiAgfSxcclxufSk7XHJcblxyXG4vLyBTdGFuZGFyZCBsaW1pdGVyIFx1MjAxNCBldmVyeXRoaW5nIGVsc2UgdW5kZXIgL2FwaVxyXG5jb25zdCBhcGlMaW1pdGVyID0gcmF0ZUxpbWl0KHtcclxuICB3aW5kb3dNczogMTUgKiA2MCAqIDEwMDAsXHJcbiAgbGltaXQ6IDEwMCxcclxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXHJcbiAgbGVnYWN5SGVhZGVyczogZmFsc2UsXHJcbiAgc2tpcDogKCkgPT4gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwidGVzdFwiLFxyXG4gIG1lc3NhZ2U6IHtcclxuICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSByZXF1ZXN0cy4gUGxlYXNlIHRyeSBhZ2FpbiBsYXRlci5cIixcclxuICB9LFxyXG59KTtcclxuXHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvbG9naW5cIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL3JlZ2lzdGVyXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9kZW1vLWxvZ2luXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9nb29nbGVcIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL3ZlcmlmeS1lbWFpbFwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvcmVzZW5kLXZlcmlmaWNhdGlvblwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvZm9yZ290LXBhc3N3b3JkXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9yZXNldC1wYXNzd29yZFwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpXCIsIGFwaUxpbWl0ZXIpO1xyXG5cclxuLy8gUm9vdCByb3V0ZVxyXG5hcHAuZ2V0KFwiL1wiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgcmVzLnNlbmQoXCJXZWxjb21lIHRvIHRoZSBUcmlwVmVyc2UgQVBJIVwiKTtcclxufSk7XHJcblxyXG4vLyBIZWFsdGggY2hlY2sgXHUyMDE0IHJlYWwgREIgY29ubmVjdGl2aXR5IGNoZWNrLCBub3QgYSBzdGF0aWMgMjAwLlxyXG5hcHAuZ2V0KFwiL2hlYWx0aFwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUIDFgO1xyXG4gICAgcmVzLnN0YXR1cygyMDApLmpzb24oe1xyXG4gICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICBtZXNzYWdlOiBcIk9LXCIsXHJcbiAgICAgIGRiOiBcImNvbm5lY3RlZFwiLFxyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgIH0pO1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICByZXMuc3RhdHVzKDUwMykuanNvbih7XHJcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICBtZXNzYWdlOiBcIlNlcnZpY2UgdW5hdmFpbGFibGVcIixcclxuICAgICAgZGI6IFwiZGlzY29ubmVjdGVkXCIsXHJcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59KTtcclxuXHJcbi8vIFx1MjUwMFx1MjUwMCBGZWF0dXJlIHJvdXRlcyByZWdpc3RlciBoZXJlIGFzIGVhY2ggbW9kdWxlIGlzIGJ1aWx0IFx1MjUwMFx1MjUwMFxyXG5hcHAudXNlKFwiL2FwaS9hdXRoXCIsIGF1dGhSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS91c2Vyc1wiLCB1c2VyUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvdXBsb2Fkc1wiLCB1cGxvYWRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jb250YWN0XCIsIGNvbnRhY3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jYXRlZ29yaWVzXCIsIGNhdGVnb3J5Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvcGFja2FnZXNcIiwgcGFja2FnZVJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3Jldmlld3NcIiwgcmV2aWV3Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvYm9va2luZ3NcIiwgYm9va2luZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Jsb2dcIiwgYmxvZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Rhc2hib2FyZFwiLCBkYXNoYm9hcmRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9wYXltZW50c1wiLCBwYXltZW50Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvd2lzaGxpc3RcIiwgd2lzaGxpc3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9ub3RpZmljYXRpb25zXCIsIG5vdGlmaWNhdGlvblJvdXRlcyk7XHJcblxyXG5hcHAudXNlKG5vdEZvdW5kSGFuZGxlcik7XHJcbmFwcC51c2UoZ2xvYmFsRXJyb3JIYW5kbGVyKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGFwcDtcclxuIiwgImltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmRvdGVudi5jb25maWcoe1xuICBxdWlldDogdHJ1ZSxcbiAgcGF0aDogcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwiLmVudlwiKSxcbn0pO1xuXG4vLyBFdmVyeSBtb2R1bGUgcmVhZHMgY29uZmlnIHRocm91Z2ggdGhpcyB2YWxpZGF0ZWQgb2JqZWN0LCBuZXZlclxuLy8gcHJvY2Vzcy5lbnYgZGlyZWN0bHkgXHUyMDE0IGEgbWlzc2luZy9tYWxmb3JtZWQgdmFyIGZhaWxzIGxvdWRseSBhdCBib290XG4vLyBpbnN0ZWFkIG9mIHN1cmZhY2luZyBhcyBhIGNvbmZ1c2luZyBydW50aW1lIGVycm9yIG1pZC1yZXF1ZXN0LlxuY29uc3QgZW52U2NoZW1hID0gei5vYmplY3Qoe1xuICBQT1JUOiB6LnN0cmluZygpLmRlZmF1bHQoXCI0MDAwXCIpLFxuICBOT0RFX0VOVjogei5lbnVtKFtcImRldmVsb3BtZW50XCIsIFwidGVzdFwiLCBcInByb2R1Y3Rpb25cIl0pLmRlZmF1bHQoXCJkZXZlbG9wbWVudFwiKSxcblxuICAvLyBGcm9udGVuZCBvcmlnaW5zIGZvciBDT1JTICsgcGF5bWVudCByZWRpcmVjdHMuIFRoZSBmcm9udGVuZCBtYXkgbm90IGJlXG4gIC8vIGRlcGxveWVkIHlldCAob3IgbWF5IGJlIHJlYnVpbHQpLCBzbyBib3RoIGFyZSBvcHRpb25hbDogdGhlIGJhY2tlbmQgbXVzdFxuICAvLyBuZXZlciByZWZ1c2UgdG8gYm9vdCBqdXN0IGJlY2F1c2UgYSBVSSBob3N0IGlzbid0IGxpdmUuIFJvdXRlcyB0aGF0IG5lZWQgYVxuICAvLyByZWFsIG9yaWdpbiAocGF5bWVudCBjYWxsYmFjayByZWRpcmVjdHMpIGZhbGwgYmFjayB0byB0aGUgYmFja2VuZCBVUkwuXG4gIEZST05URU5EX1VSTF9ERVY6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcbiAgRlJPTlRFTkRfVVJMX1BST0Q6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICBEQVRBQkFTRV9VUkw6IHouc3RyaW5nKCkubWluKDEsIFwiREFUQUJBU0VfVVJMIGlzIHJlcXVpcmVkXCIpLFxuXG4gIEJDUllQVF9TQUxUX1JPVU5EUzogei5zdHJpbmcoKS5kZWZhdWx0KFwiMTBcIiksXG5cbiAgLy8gT3B0aW9uYWwgYWRtaW4gY3JlZGVudGlhbHMgdXNlZCBieSB0aGUgc2VlZCBzY3JpcHQgKFN0ZXAgMTMpLiBGYWxscyBiYWNrXG4gIC8vIHRvIGRlbW8tYWRtaW5AdHJpcHZlcnNlLmNvbSAvIGRlbW8xMjMgd2hlbiB1bnNldC5cbiAgQURNSU5fRU1BSUw6IHouc3RyaW5nKCkuZW1haWwoKS5vcHRpb25hbCgpLFxuICBBRE1JTl9QQVNTV09SRDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcblxuICAvLyBTU0xDb21tZXJ6IChTdGVwIDE2KSBcdTIwMTQgc2FuZGJveCBzdG9yZSBjcmVkcyB1bnRpbCBnby1saXZlLiBTU0xfQ09NTUVSWl9TQU5EQk9YXG4gIC8vIHBpY2tzIHRoZSBzYW5kYm94IHZzIGxpdmUgQVBJIGJhc2UgVVJMLiBPcHRpb25hbCBzbyB0aGUgQVBJIGJvb3RzIChoZWFsdGgsXG4gIC8vIGF1dGgsIGNhdGFsb2csIGV0Yy4pIGV2ZW4gd2hlbiB0aGUgcGF5bWVudCBzdG9yZSBpc24ndCBjb25maWd1cmVkIHlldCBcdTIwMTQgdGhlXG4gIC8vIHBheW1lbnQgZW5kcG9pbnRzIHRoZW4gZmFpbCB3aXRoIGEgY2xlYW4gXCJub3QgY29uZmlndXJlZFwiIGVycm9yIGluc3RlYWQgb2ZcbiAgLy8gdGFraW5nIHRoZSB3aG9sZSBkZXBsb3ltZW50IGRvd24uXG4gIFNTTF9DT01NRVJaX1NUT1JFX0lEOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JEOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFNTTF9DT01NRVJaX1NBTkRCT1g6IHouc3RyaW5nKCkuZGVmYXVsdChcInRydWVcIiksXG4gIC8vIE9wdGlvbmFsIGV4cGxpY2l0IGdhdGV3YXkvdmFsaWRhdG9yIGJhc2UgVVJMcyAoR2VhclVwIHBhdHRlcm4pLiBEZWZhdWx0cyBhcmVcbiAgLy8gZGVyaXZlZCBmcm9tIFNTTF9DT01NRVJaX1NBTkRCT1ggd2hlbiBhYnNlbnQuXG4gIFNTTENPTU1FUlpfSU5JVF9VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcbiAgU1NMQ09NTUVSWl9WQUxJREFURV9VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcbiAgU1NMQ09NTUVSWl9SRUZVTkRfVVJMOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG5cbiAgLy8gUHVibGljbHkgcmVhY2hhYmxlIGJhc2UgVVJMIHRoZSBwYXltZW50IG1vZHVsZSB1c2VzIHRvIGJ1aWxkIHRoZVxuICAvLyBTU0xDb21tZXJ6IHN1Y2Nlc3MvZmFpbC9jYW5jZWwvSVBOIGNhbGxiYWNrIFVSTHMuIE11c3QgTk9UIGJlIGxvY2FsaG9zdCBpblxuICAvLyBzYW5kYm94IFx1MjAxNCB0aGUgZ2F0ZXdheSBQT1NUcyB0byB0aGVzZSBzZXJ2ZXItdG8tc2VydmVyLiBPcHRpb25hbCBsaWtlIHRoZVxuICAvLyBzdG9yZSBjcmVkcyBhYm92ZSAocGF5bWVudC1vbmx5KS5cbiAgQkFDS0VORF9QVUJMSUNfVVJMOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG5cbiAgSldUX0FDQ0VTU19TRUNSRVQ6IHouc3RyaW5nKCkubWluKDEsIFwiSldUX0FDQ0VTU19TRUNSRVQgaXMgcmVxdWlyZWRcIiksXG4gIEpXVF9SRUZSRVNIX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJKV1RfUkVGUkVTSF9TRUNSRVQgaXMgcmVxdWlyZWRcIiksXG4gIEpXVF9BQ0NFU1NfRVhQSVJFU19JTjogei5zdHJpbmcoKS5kZWZhdWx0KFwiMWRcIiksXG4gIEpXVF9SRUZSRVNIX0VYUElSRVNfSU46IHouc3RyaW5nKCkuZGVmYXVsdChcIjMwZFwiKSxcblxuICAvLyBHb29nbGUgT0F1dGggaXMgb3B0aW9uYWwgXHUyMDE0IHNlcnZlciBib290cyB3aXRob3V0IGl0OyAvYXBpL2F1dGgvZ29vZ2xlXG4gIC8vIHJldHVybnMgYSBjbGVhbiA0MDAgdW50aWwgR09PR0xFX0NMSUVOVF9JRCBpcyBjb25maWd1cmVkLlxuICBHT09HTEVfQ0xJRU5UX0lEOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG5cbiAgLy8gQmVzdC1lZmZvcnQgY29udGFjdCBlbWFpbHMgKFJlc2VuZCkgXHUyMDE0IGFsd2F5cyBvcHRpb25hbDsgc3VibWlzc2lvbnNcbiAgLy8gc3VjY2VlZCBhbmQgZW1haWxzIGJlY29tZSBuby1vcHMgd2hlbiB0aGVzZSBhcmUgbWlzc2luZy5cbiAgUkVTRU5EX0FQSV9LRVk6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgQ09OVEFDVF9SRUNFSVZFUl9FTUFJTDogei5zdHJpbmcoKS5lbWFpbCgpLm9wdGlvbmFsKCksXG4gIEVNQUlMX0ZST006IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcblxuICAvLyBFbWFpbCB2ZXJpZmljYXRpb24gKyBwYXNzd29yZCByZXNldCAoU3RlcCAyMSkgXHUyMDE0IFJlZGlzIE9UUCBzdG9yZSArIE5vZGVtYWlsZXIuXG4gIC8vIEFsbCBvcHRpb25hbCBzbyB0aGUgYXBwIGJvb3RzIHdpdGhvdXQgdGhlbSAoZS5nLiBWZXJjZWwgcHJvZCk7IHRoZSBhdXRoXG4gIC8vIGVuZHBvaW50cyB0aGVuIHJlc3BvbmQgd2l0aCBhIGNsZWFuIDUwMyBcIm5vdCBjb25maWd1cmVkXCIgaW5zdGVhZCBvZiBjcmFzaGluZy5cbiAgUkVESVNfVVNFUjogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBSRURJU19QQVNTV09SRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBSRURJU19IT1NUOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFJFRElTX1BPUlQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU01UUF9VU0VSOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFNNVFBfUEFTU1dPUkQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcblxuICBDTE9VRElOQVJZX0NMT1VEX05BTUU6IHouc3RyaW5nKCkubWluKDEsIFwiQ0xPVURJTkFSWV9DTE9VRF9OQU1FIGlzIHJlcXVpcmVkXCIpLFxuICBDTE9VRElOQVJZX0FQSV9LRVk6IHouc3RyaW5nKCkubWluKDEsIFwiQ0xPVURJTkFSWV9BUElfS0VZIGlzIHJlcXVpcmVkXCIpLFxuICBDTE9VRElOQVJZX0FQSV9TRUNSRVQ6IHouc3RyaW5nKCkubWluKDEsIFwiQ0xPVURJTkFSWV9BUElfU0VDUkVUIGlzIHJlcXVpcmVkXCIpLFxufSk7XG5cbmNvbnN0IHBhcnNlZCA9IGVudlNjaGVtYS5zYWZlUGFyc2UocHJvY2Vzcy5lbnYpO1xuXG5pZiAoIXBhcnNlZC5zdWNjZXNzKSB7XG4gIGNvbnNvbGUuZXJyb3IoXCJcdTI3NEMgSW52YWxpZCBlbnZpcm9ubWVudCB2YXJpYWJsZXM6XCIpO1xuICBjb25zb2xlLmVycm9yKHBhcnNlZC5lcnJvci5mbGF0dGVuKCkuZmllbGRFcnJvcnMpO1xuICBwcm9jZXNzLmV4aXQoMSk7XG59XG5cbmNvbnN0IGVudiA9IHBhcnNlZC5kYXRhO1xuXG5jb25zdCBjb25maWcgPSB7XG4gIHBvcnQ6IGVudi5QT1JULFxuICBub2RlX2VudjogZW52Lk5PREVfRU5WLFxuXG4gIC8vIEZyb250ZW5kIG9yaWdpbnMgZm9yIENPUlMgKyBwYXltZW50IHJlZGlyZWN0cy4gTG9jYWxob3N0IGFsd2F5cyB3aW5zIGZvclxuICAvLyBsb2NhbCB0ZXN0aW5nOyBwcm9kdWN0aW9uIHVzZXMgdGhlIFZlcmNlbCBmcm9udGVuZCBVUkwsIGZhbGxpbmcgYmFjayB0byB0aGVcbiAgLy8gYmFja2VuZCBVUkwgc28gdGhlIEFQSSBzdGF5cyByZWFjaGFibGUgZXZlbiBiZWZvcmUgdGhlIFVJIGlzIGRlcGxveWVkLlxuICBmcm9udGVuZF91cmxfZGV2OiBlbnYuRlJPTlRFTkRfVVJMX0RFViB8fCBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICBmcm9udGVuZF91cmxfcHJvZDpcbiAgICBlbnYuRlJPTlRFTkRfVVJMX1BST0QgfHwgZW52LkJBQ0tFTkRfUFVCTElDX1VSTCB8fCBcIlwiLFxuXG4gIGRhdGFiYXNlX3VybDogZW52LkRBVEFCQVNFX1VSTCxcblxuICBiY3J5cHRfc2FsdF9yb3VuZHM6IGVudi5CQ1JZUFRfU0FMVF9ST1VORFMsXG5cbiAgYWRtaW5fZW1haWw6IGVudi5BRE1JTl9FTUFJTCxcbiAgYWRtaW5fcGFzc3dvcmQ6IGVudi5BRE1JTl9QQVNTV09SRCxcblxuICBzc2xfY29tbWVyel9zdG9yZV9pZDogZW52LlNTTF9DT01NRVJaX1NUT1JFX0lELFxuICBzc2xfY29tbWVyel9zdG9yZV9wYXNzd29yZDogZW52LlNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELFxuICBzc2xfY29tbWVyel9zYW5kYm94OiBlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCIsXG4gIC8vIHNhbmRib3ggYmFzZSBVUkxzIChmYWxsYmFjayB3aGVuIHRoZSBleHBsaWNpdCBvdmVycmlkZSB2YXJzIGFyZSBhYnNlbnQpXG4gIHNzbGNvbW1lcnpfaW5pdF91cmw6XG4gICAgZW52LlNTTENPTU1FUlpfSU5JVF9VUkwgPz9cbiAgICAoZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiXG4gICAgICA/IFwiaHR0cHM6Ly9zYW5kYm94LnNzbGNvbW1lcnouY29tL2d3cHJvY2Vzcy92NC9hcGkucGhwXCJcbiAgICAgIDogXCJodHRwczovL3NlY3VyZXBheS5zc2xjb21tZXJ6LmNvbS9nd3Byb2Nlc3MvdjQvYXBpLnBocFwiKSxcbiAgc3NsY29tbWVyel92YWxpZGF0ZV91cmw6XG4gICAgZW52LlNTTENPTU1FUlpfVkFMSURBVEVfVVJMID8/XG4gICAgKGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIlxuICAgICAgPyBcImh0dHBzOi8vc2FuZGJveC5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL3ZhbGlkYXRpb25zZXJ2ZXJBUEkucGhwXCJcbiAgICAgIDogXCJodHRwczovL3NlY3VyZXBheS5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL3ZhbGlkYXRpb25zZXJ2ZXJBUEkucGhwXCIpLFxuICBzc2xjb21tZXJ6X3JlZnVuZF91cmw6XG4gICAgZW52LlNTTENPTU1FUlpfUkVGVU5EX1VSTCA/P1xuICAgIChlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCJcbiAgICAgID8gXCJodHRwczovL3NhbmRib3guc3NsY29tbWVyei5jb20vdmFsaWRhdG9yL2FwaS9tZXJjaGFudFRyYW5zSUR2YWxpZGF0aW9uQVBJLnBocFwiXG4gICAgICA6IFwiaHR0cHM6Ly9zZWN1cmVwYXkuc3NsY29tbWVyei5jb20vdmFsaWRhdG9yL2FwaS9tZXJjaGFudFRyYW5zSUR2YWxpZGF0aW9uQVBJLnBocFwiKSxcbiAgYmFja2VuZF9wdWJsaWNfdXJsOiBlbnYuQkFDS0VORF9QVUJMSUNfVVJMLFxuXG4gIGp3dF9hY2Nlc3Nfc2VjcmV0OiBlbnYuSldUX0FDQ0VTU19TRUNSRVQsXG4gIGp3dF9yZWZyZXNoX3NlY3JldDogZW52LkpXVF9SRUZSRVNIX1NFQ1JFVCxcbiAgand0X2FjY2Vzc19leHBpcmVzX2luOiBlbnYuSldUX0FDQ0VTU19FWFBJUkVTX0lOLFxuICBqd3RfcmVmcmVzaF9leHBpcmVzX2luOiBlbnYuSldUX1JFRlJFU0hfRVhQSVJFU19JTixcblxuICBnb29nbGVfY2xpZW50X2lkOiBlbnYuR09PR0xFX0NMSUVOVF9JRCxcblxuICByZXNlbmRfYXBpX2tleTogZW52LlJFU0VORF9BUElfS0VZLFxuICBjb250YWN0X3JlY2VpdmVyX2VtYWlsOiBlbnYuQ09OVEFDVF9SRUNFSVZFUl9FTUFJTCxcbiAgZW1haWxfZnJvbTogZW52LkVNQUlMX0ZST00sXG5cbiAgLy8gRW1haWwgdmVyaWZpY2F0aW9uICsgcGFzc3dvcmQgcmVzZXQgKFN0ZXAgMjEpXG4gIHJlZGlzX3VzZXI6IGVudi5SRURJU19VU0VSLFxuICByZWRpc19wYXNzd29yZDogZW52LlJFRElTX1BBU1NXT1JELFxuICByZWRpc19ob3N0OiBlbnYuUkVESVNfSE9TVCxcbiAgcmVkaXNfcG9ydDogZW52LlJFRElTX1BPUlQsXG4gIHNtdHBfdXNlcjogZW52LlNNVFBfVVNFUixcbiAgc210cF9wYXNzd29yZDogZW52LlNNVFBfUEFTU1dPUkQsXG5cbiAgY2xvdWRpbmFyeV9jbG91ZF9uYW1lOiBlbnYuQ0xPVURJTkFSWV9DTE9VRF9OQU1FLFxuICBjbG91ZGluYXJ5X2FwaV9rZXk6IGVudi5DTE9VRElOQVJZX0FQSV9LRVksXG4gIGNsb3VkaW5hcnlfYXBpX3NlY3JldDogZW52LkNMT1VESU5BUllfQVBJX1NFQ1JFVCxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNvbmZpZztcbiIsICJpbXBvcnQgeyBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5cbmNvbnN0IG5vdEZvdW5kSGFuZGxlciA9IChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpID0+IHtcbiAgcmVzLnN0YXR1cyg0MDQpLmpzb24oe1xuICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgIHN0YXR1c0NvZGU6IDQwNCxcbiAgICBtZXNzYWdlOiBcIlJvdXRlIG5vdCBmb3VuZFwiLFxuICAgIHBhdGg6IHJlcS5vcmlnaW5hbFVybCxcbiAgICBkYXRlOiBuZXcgRGF0ZSgpLFxuICB9KTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IG5vdEZvdW5kSGFuZGxlcjtcbiIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IG11bHRlciBmcm9tIFwibXVsdGVyXCI7XG5pbXBvcnQgeyBab2RFcnJvciB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi91dGlscy9hcHBFcnJvclwiO1xuXG5jb25zdCBnbG9iYWxFcnJvckhhbmRsZXIgPSAoXG4gIGVycjogYW55LFxuICByZXE6IFJlcXVlc3QsXG4gIHJlczogUmVzcG9uc2UsXG4gIG5leHQ6IE5leHRGdW5jdGlvbixcbikgPT4ge1xuICBpZiAoY29uZmlnLm5vZGVfZW52ICE9PSBcInByb2R1Y3Rpb25cIikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvcjpcIiwgZXJyKTtcbiAgfVxuXG4gIC8vIGRlZmF1bHQgZmFsbGJhY2tcbiAgbGV0IHN0YXR1c0NvZGU6IG51bWJlciA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICBsZXQgZXJyb3JNZXNzYWdlOiBzdHJpbmcgPSBlcnI/Lm1lc3NhZ2UgfHwgXCJJbnRlcm5hbCBTZXJ2ZXIgRXJyb3JcIjtcbiAgbGV0IGVycm9yTmFtZTogc3RyaW5nID0gZXJyPy5uYW1lIHx8IFwiRXJyb3JcIjtcblxuICAvLyBab2QgdmFsaWRhdGlvbiBlcnJvclxuICBpZiAoZXJyIGluc3RhbmNlb2YgWm9kRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5CQURfUkVRVUVTVDtcbiAgICBlcnJvck1lc3NhZ2UgPSBlcnIuaXNzdWVzLm1hcCgoaSkgPT4gaS5tZXNzYWdlKS5qb2luKFwiLCBcIik7XG4gICAgZXJyb3JOYW1lID0gXCJab2RFcnJvclwiO1xuICB9XG5cbiAgLy8gTXVsdGVyIGZpbGUgdXBsb2FkIGVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIG11bHRlci5NdWx0ZXJFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTmFtZSA9IFwiTXVsdGVyRXJyb3JcIjtcbiAgICBlcnJvck1lc3NhZ2UgPVxuICAgICAgZXJyLmNvZGUgPT09IFwiTElNSVRfRklMRV9TSVpFXCJcbiAgICAgICAgPyBcIkZpbGUgdG9vIGxhcmdlLiBNYXhpbXVtIHNpemUgaXMgNU1CLlwiXG4gICAgICAgIDogYFVwbG9hZCBmYWlsZWQ6ICR7ZXJyLmNvZGV9YDtcbiAgfVxuXG4gIC8vIEN1c3RvbSBmaWxlIHR5cGUgcmVqZWN0aW9uIGZyb20gdGhlIG11bHRlciBmaWxlRmlsdGVyXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yICYmIChlcnIgYXMgYW55KS5jb2RlID09PSBcIklOVkFMSURfRklMRV9UWVBFXCIpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5CQURfUkVRVUVTVDtcbiAgICBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgfVxuXG4gIC8vIFByaXNtYSB2YWxpZGF0aW9uIGVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIFByaXNtYS5QcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5CQURfUkVRVUVTVDtcbiAgICBlcnJvck1lc3NhZ2UgPVxuICAgICAgXCJZb3UgaGF2ZSBwcm92aWRlZCBpbmNvcnJlY3QgZmllbGQgdHlwZSBvciBtaXNzaW5nIHJlcXVpcmVkIGZpZWxkc1wiO1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yXCI7XG4gIH1cblxuICAvLyBQcmlzbWEga25vd24gZXJyb3JzXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIFByaXNtYS5QcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvcikge1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3JcIjtcblxuICAgIGlmIChlcnIuY29kZSA9PT0gXCJQMjAwMlwiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5DT05GTElDVDtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiVGhpcyB2YWx1ZSBhbHJlYWR5IGV4aXN0c1wiO1xuICAgIH0gZWxzZSBpZiAoZXJyLmNvZGUgPT09IFwiUDIwMDNcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQ09ORkxJQ1Q7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBcIkZvcmVpZ24ga2V5IGNvbnN0cmFpbnQgZmFpbGVkXCI7XG4gICAgfSBlbHNlIGlmIChlcnIuY29kZSA9PT0gXCJQMjAyNVwiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5OT1RfRk9VTkQ7XG4gICAgICBlcnJvck1lc3NhZ2UgPVxuICAgICAgICBcIkFuIG9wZXJhdGlvbiBmYWlsZWQgYmVjYXVzZSBvbmUgb3IgbW9yZSByZXF1aXJlZCByZWNvcmRzIHdlcmUgbm90IGZvdW5kLlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5CQURfUkVRVUVTVDtcbiAgICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIH1cbiAgfVxuXG4gIC8vIFByaXNtYSBEQiBjb25uZWN0aW9uL2luaXQgZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IpIHtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcIjtcblxuICAgIGlmIChlcnIuZXJyb3JDb2RlID09PSBcIlAxMDAwXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLlVOQVVUSE9SSVpFRDtcbiAgICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICAgIFwiQXV0aGVudGljYXRpb24gZmFpbGVkIGFnYWluc3QgdGhlIGRhdGFiYXNlIHNlcnZlci4gUGxlYXNlIGNoZWNrIHlvdXIgZGF0YWJhc2UgY3JlZGVudGlhbHMuXCI7XG4gICAgfSBlbHNlIGlmIChlcnIuZXJyb3JDb2RlID09PSBcIlAxMDAxXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLlNFUlZJQ0VfVU5BVkFJTEFCTEU7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBcIkNhbid0IHJlYWNoIHRoZSBkYXRhYmFzZSBzZXJ2ZXIuXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIH1cbiAgfVxuXG4gIC8vIFByaXNtYSB1bmtub3duIHJlcXVlc3QgZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yXCI7XG4gICAgZXJyb3JNZXNzYWdlID0gXCJFcnJvciBvY2N1cnJlZCBkdXJpbmcgcXVlcnkgZXhlY3V0aW9uXCI7XG4gIH1cblxuICAvLyBZb3VyIGN1c3RvbSBBcHBFcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBBcHBFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBlcnIuc3RhdHVzQ29kZTtcbiAgICBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICBlcnJvck5hbWUgPSBlcnIubmFtZSB8fCBcIkFwcEVycm9yXCI7XG4gIH1cblxuICAvLyBGYWxsYmFjayBmb3Igb3RoZXIgdGhyb3duIGVycm9yc1xuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgICBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZSB8fCBcIkludGVybmFsIFNlcnZlciBFcnJvclwiO1xuICAgIGVycm9yTmFtZSA9IGVyci5uYW1lIHx8IFwiRXJyb3JcIjtcbiAgfVxuXG4gIHJlcy5zdGF0dXMoc3RhdHVzQ29kZSkuanNvbih7XG4gICAgc3VjY2VzczogZmFsc2UsXG4gICAgc3RhdHVzQ29kZSxcbiAgICBuYW1lOiBlcnJvck5hbWUsXG4gICAgbWVzc2FnZTogZXJyb3JNZXNzYWdlLFxuICAgIGVycm9yOiBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gXCJkZXZlbG9wbWVudFwiID8gZXJyLnN0YWNrIDogdW5kZWZpbmVkLFxuICB9KTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGdsb2JhbEVycm9ySGFuZGxlcjtcbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiAqIFRoaXMgZmlsZSBzaG91bGQgYmUgeW91ciBtYWluIGltcG9ydCB0byB1c2UgUHJpc21hLiBUaHJvdWdoIGl0IHlvdSBnZXQgYWNjZXNzIHRvIGFsbCB0aGUgbW9kZWxzLCBlbnVtcywgYW5kIGlucHV0IHR5cGVzLlxuICogSWYgeW91J3JlIGxvb2tpbmcgZm9yIHNvbWV0aGluZyB5b3UgY2FuIGltcG9ydCBpbiB0aGUgY2xpZW50LXNpZGUgb2YgeW91ciBhcHBsaWNhdGlvbiwgcGxlYXNlIHJlZmVyIHRvIHRoZSBgYnJvd3Nlci50c2AgZmlsZSBpbnN0ZWFkLlxuICpcbiAqIFx1RDgzRFx1REZFMiBZb3UgY2FuIGltcG9ydCB0aGlzIGZpbGUgZGlyZWN0bHkuXG4gKi9cblxuaW1wb3J0ICogYXMgcHJvY2VzcyBmcm9tICdub2RlOnByb2Nlc3MnXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ25vZGU6cGF0aCdcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICdub2RlOnVybCdcbmdsb2JhbFRoaXNbJ19fZGlybmFtZSddID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKSlcblxuaW1wb3J0ICogYXMgcnVudGltZSBmcm9tIFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9jbGllbnRcIlxuaW1wb3J0ICogYXMgJEVudW1zIGZyb20gXCIuL2VudW1zXCJcbmltcG9ydCAqIGFzICRDbGFzcyBmcm9tIFwiLi9pbnRlcm5hbC9jbGFzc1wiXG5pbXBvcnQgKiBhcyBQcmlzbWEgZnJvbSBcIi4vaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlXCJcblxuZXhwb3J0ICogYXMgJEVudW1zIGZyb20gJy4vZW51bXMnXG5leHBvcnQgKiBmcm9tIFwiLi9lbnVtc1wiXG4vKipcbiAqICMjIFByaXNtYSBDbGllbnRcbiAqIFxuICogVHlwZS1zYWZlIGRhdGFiYXNlIGNsaWVudCBmb3IgVHlwZVNjcmlwdFxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gKiAgIGFkYXB0ZXI6IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICogfSlcbiAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nQ29tbWVudHNcbiAqIGNvbnN0IGJsb2dDb21tZW50cyA9IGF3YWl0IHByaXNtYS5ibG9nQ29tbWVudC5maW5kTWFueSgpXG4gKiBgYGBcbiAqIFxuICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvY2xpZW50KS5cbiAqL1xuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudCA9ICRDbGFzcy5nZXRQcmlzbWFDbGllbnRDbGFzcygpXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnQ8TG9nT3B0cyBleHRlbmRzIFByaXNtYS5Mb2dMZXZlbCA9IG5ldmVyLCBPbWl0T3B0cyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zW1wib21pdFwiXSA9IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zW1wib21pdFwiXSwgRXh0QXJncyBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3M+ID0gJENsYXNzLlByaXNtYUNsaWVudDxMb2dPcHRzLCBPbWl0T3B0cywgRXh0QXJncz5cbmV4cG9ydCB7IFByaXNtYSB9XG5cbi8qKlxuICogTW9kZWwgQmxvZ0NvbW1lbnRcbiAqIFxuICovXG5leHBvcnQgdHlwZSBCbG9nQ29tbWVudCA9IFByaXNtYS5CbG9nQ29tbWVudE1vZGVsXG4vKipcbiAqIE1vZGVsIEJsb2dQb3N0XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQmxvZ1Bvc3QgPSBQcmlzbWEuQmxvZ1Bvc3RNb2RlbFxuLyoqXG4gKiBNb2RlbCBCb29raW5nXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQm9va2luZyA9IFByaXNtYS5Cb29raW5nTW9kZWxcbi8qKlxuICogTW9kZWwgQ2F0ZWdvcnlcbiAqIFxuICovXG5leHBvcnQgdHlwZSBDYXRlZ29yeSA9IFByaXNtYS5DYXRlZ29yeU1vZGVsXG4vKipcbiAqIE1vZGVsIENvbnRhY3RNZXNzYWdlXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQ29udGFjdE1lc3NhZ2UgPSBQcmlzbWEuQ29udGFjdE1lc3NhZ2VNb2RlbFxuLyoqXG4gKiBNb2RlbCBOb3RpZmljYXRpb25cbiAqIFxuICovXG5leHBvcnQgdHlwZSBOb3RpZmljYXRpb24gPSBQcmlzbWEuTm90aWZpY2F0aW9uTW9kZWxcbi8qKlxuICogTW9kZWwgUGF5bWVudFxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFBheW1lbnQgPSBQcmlzbWEuUGF5bWVudE1vZGVsXG4vKipcbiAqIE1vZGVsIFJlZnJlc2hUb2tlblxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFJlZnJlc2hUb2tlbiA9IFByaXNtYS5SZWZyZXNoVG9rZW5Nb2RlbFxuLyoqXG4gKiBNb2RlbCBSZXZpZXdcbiAqIFxuICovXG5leHBvcnQgdHlwZSBSZXZpZXcgPSBQcmlzbWEuUmV2aWV3TW9kZWxcbi8qKlxuICogTW9kZWwgVG91clBhY2thZ2VcbiAqIFxuICovXG5leHBvcnQgdHlwZSBUb3VyUGFja2FnZSA9IFByaXNtYS5Ub3VyUGFja2FnZU1vZGVsXG4vKipcbiAqIE1vZGVsIFVzZXJcbiAqIFxuICovXG5leHBvcnQgdHlwZSBVc2VyID0gUHJpc21hLlVzZXJNb2RlbFxuLyoqXG4gKiBNb2RlbCBXaXNobGlzdEl0ZW1cbiAqIFxuICovXG5leHBvcnQgdHlwZSBXaXNobGlzdEl0ZW0gPSBQcmlzbWEuV2lzaGxpc3RJdGVtTW9kZWxcbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiAqIFdBUk5JTkc6IFRoaXMgaXMgYW4gaW50ZXJuYWwgZmlsZSB0aGF0IGlzIHN1YmplY3QgdG8gY2hhbmdlIVxuICpcbiAqIFx1RDgzRFx1REVEMSBVbmRlciBubyBjaXJjdW1zdGFuY2VzIHNob3VsZCB5b3UgaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseSEgXHVEODNEXHVERUQxXG4gKlxuICogUGxlYXNlIGltcG9ydCB0aGUgYFByaXNtYUNsaWVudGAgY2xhc3MgZnJvbSB0aGUgYGNsaWVudC50c2AgZmlsZSBpbnN0ZWFkLlxuICovXG5cbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSBcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvY2xpZW50XCJcbmltcG9ydCB0eXBlICogYXMgUHJpc21hIGZyb20gXCIuL3ByaXNtYU5hbWVzcGFjZVwiXG5cblxuY29uc3QgY29uZmlnOiBydW50aW1lLkdldFByaXNtYUNsaWVudENvbmZpZyA9IHtcbiAgXCJwcmV2aWV3RmVhdHVyZXNcIjogW10sXG4gIFwiY2xpZW50VmVyc2lvblwiOiBcIjcuOS4xXCIsXG4gIFwiZW5naW5lVmVyc2lvblwiOiBcImU5MjIwODliN2Q3NTAyYWZmNDI0OWQ1ZGEzNDIwZjZmYTU1ZmM2YWRcIixcbiAgXCJhY3RpdmVQcm92aWRlclwiOiBcInBvc3RncmVzcWxcIixcbiAgXCJpbmxpbmVTY2hlbWFcIjogXCJtb2RlbCBCbG9nQ29tbWVudCB7XFxuICBpZCAgICAgICAgU3RyaW5nICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgY29udGVudCAgIFN0cmluZyAgQGRiLlRleHRcXG4gIGlzRGVsZXRlZCBCb29sZWFuIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgcG9zdElkICAgU3RyaW5nXFxuICB1c2VySWQgICBTdHJpbmdcXG4gIHBhcmVudElkIFN0cmluZz9cXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBwb3N0ICAgIEJsb2dQb3N0ICAgICAgQHJlbGF0aW9uKFxcXCJQb3N0Q29tbWVudHNcXFwiLCBmaWVsZHM6IFtwb3N0SWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgdXNlciAgICBVc2VyICAgICAgICAgIEByZWxhdGlvbihcXFwiVXNlckNvbW1lbnRzXFxcIiwgZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIHBhcmVudCAgQmxvZ0NvbW1lbnQ/ICBAcmVsYXRpb24oXFxcIkNvbW1lbnRSZXBsaWVzXFxcIiwgZmllbGRzOiBbcGFyZW50SWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcmVwbGllcyBCbG9nQ29tbWVudFtdIEByZWxhdGlvbihcXFwiQ29tbWVudFJlcGxpZXNcXFwiKVxcblxcbiAgQEBpbmRleChbcG9zdElkLCBpc0RlbGV0ZWQsIGNyZWF0ZWRBdF0pXFxuICBAQGluZGV4KFtwYXJlbnRJZF0pXFxuICBAQG1hcChcXFwiYmxvZ19jb21tZW50c1xcXCIpXFxufVxcblxcbm1vZGVsIEJsb2dQb3N0IHtcXG4gIGlkICAgICAgICAgU3RyaW5nICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdGl0bGUgICAgICBTdHJpbmdcXG4gIHNsdWcgICAgICAgU3RyaW5nICAgICBAdW5pcXVlXFxuICBleGNlcnB0ICAgIFN0cmluZ1xcbiAgY29udGVudCAgICBTdHJpbmdcXG4gIGNvdmVySW1hZ2UgU3RyaW5nXFxuICBzdGF0dXMgICAgIFBvc3RTdGF0dXMgQGRlZmF1bHQoRFJBRlQpXFxuICBpc0RlbGV0ZWQgIEJvb2xlYW4gICAgQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBhdXRob3JJZCBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBhdXRob3IgICBVc2VyICAgICAgICAgIEByZWxhdGlvbihcXFwiQXV0aG9yUG9zdHNcXFwiLCBmaWVsZHM6IFthdXRob3JJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBjb21tZW50cyBCbG9nQ29tbWVudFtdIEByZWxhdGlvbihcXFwiUG9zdENvbW1lbnRzXFxcIilcXG5cXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQGluZGV4KFthdXRob3JJZF0pXFxuICBAQG1hcChcXFwiYmxvZ19wb3N0c1xcXCIpXFxufVxcblxcbm1vZGVsIEJvb2tpbmcge1xcbiAgaWQgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0cmF2ZWxEYXRlIERhdGVUaW1lXFxuICB0cmF2ZWxlcnMgIEludFxcbiAgdG90YWxQcmljZSBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKVxcbiAgc3RhdHVzICAgICBCb29raW5nU3RhdHVzIEBkZWZhdWx0KFBFTkRJTkcpXFxuXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgdXNlciAgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lckJvb2tpbmdzXFxcIiwgZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIHBhY2thZ2UgIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGF5bWVudHMgUGF5bWVudFtdXFxuXFxuICBAQGluZGV4KFt1c2VySWRdKVxcbiAgQEBpbmRleChbcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQGluZGV4KFt1c2VySWQsIHBhY2thZ2VJZCwgdHJhdmVsRGF0ZV0pXFxuICBAQG1hcChcXFwiYm9va2luZ3NcXFwiKVxcbn1cXG5cXG5tb2RlbCBDYXRlZ29yeSB7XFxuICBpZCAgIFN0cmluZyBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgbmFtZSBTdHJpbmcgQHVuaXF1ZVxcbiAgc2x1ZyBTdHJpbmcgQHVuaXF1ZVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBhY2thZ2VzIFRvdXJQYWNrYWdlW11cXG5cXG4gIEBAbWFwKFxcXCJjYXRlZ29yaWVzXFxcIilcXG59XFxuXFxubW9kZWwgQ29udGFjdE1lc3NhZ2Uge1xcbiAgaWQgICAgICAgICBTdHJpbmcgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lICAgICAgIFN0cmluZ1xcbiAgZW1haWwgICAgICBTdHJpbmdcXG4gIHN1YmplY3QgICAgU3RyaW5nXFxuICBtZXNzYWdlICAgIFN0cmluZ1xcbiAgaXNSZXNvbHZlZCBCb29sZWFuIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIEBAaW5kZXgoW2lzUmVzb2x2ZWRdKVxcbiAgQEBtYXAoXFxcImNvbnRhY3RfbWVzc2FnZXNcXFwiKVxcbn1cXG5cXG5lbnVtIFJvbGUge1xcbiAgVVNFUlxcbiAgQUdFTlRcXG4gIEFETUlOXFxufVxcblxcbmVudW0gVXNlclN0YXR1cyB7XFxuICBBQ1RJVkVcXG4gIFNVU1BFTkRFRFxcbn1cXG5cXG5lbnVtIEF1dGhQcm92aWRlciB7XFxuICBDUkVERU5USUFMXFxuICBHT09HTEVcXG59XFxuXFxuZW51bSBQYWNrYWdlU3RhdHVzIHtcXG4gIFBFTkRJTkdcXG4gIEFQUFJPVkVEXFxuICBSRUpFQ1RFRFxcbn1cXG5cXG5lbnVtIEJvb2tpbmdTdGF0dXMge1xcbiAgUEVORElOR1xcbiAgUEFJRFxcbiAgQ09ORklSTUVEXFxuICBDQU5DRUxMRURcXG4gIENPTVBMRVRFRFxcbn1cXG5cXG5lbnVtIFBheW1lbnRTdGF0dXMge1xcbiAgSU5JVElBVEVEXFxuICBTVUNDRVNTXFxuICBGQUlMRURcXG4gIENBTkNFTExFRFxcbiAgUkVGVU5ERURcXG59XFxuXFxuZW51bSBQb3N0U3RhdHVzIHtcXG4gIERSQUZUXFxuICBQVUJMSVNIRURcXG59XFxuXFxuZW51bSBOb3RpZmljYXRpb25UeXBlIHtcXG4gIEJPT0tJTkdfQ1JFQVRFRFxcbiAgQk9PS0lOR19DT05GSVJNRURcXG4gIEJPT0tJTkdfQ0FOQ0VMTEVEXFxuICBQQUNLQUdFX0FQUFJPVkVEXFxuICBQQUNLQUdFX1JFSkVDVEVEXFxufVxcblxcbm1vZGVsIE5vdGlmaWNhdGlvbiB7XFxuICBpZCAgICAgIFN0cmluZyAgICAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHVzZXJJZCAgU3RyaW5nXFxuICB0eXBlICAgIE5vdGlmaWNhdGlvblR5cGVcXG4gIHRpdGxlICAgU3RyaW5nXFxuICBtZXNzYWdlIFN0cmluZ1xcbiAgbGluayAgICBTdHJpbmc/XFxuICBpc1JlYWQgIEJvb2xlYW4gICAgICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuXFxuICB1c2VyIFVzZXIgQHJlbGF0aW9uKGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuXFxuICBAQGluZGV4KFt1c2VySWQsIGlzUmVhZCwgY3JlYXRlZEF0XSlcXG4gIEBAbWFwKFxcXCJub3RpZmljYXRpb25zXFxcIilcXG59XFxuXFxubW9kZWwgUGF5bWVudCB7XFxuICBpZCAgICAgICAgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBib29raW5nSWQgICAgICAgICBTdHJpbmdcXG4gIHRyYW5JZCAgICAgICAgICAgIFN0cmluZyAgICAgICAgQHVuaXF1ZSAvLyBTU0xDb21tZXJ6IHRyYW5zYWN0aW9uIGlkLCBnZW5lcmF0ZWQgc2VydmVyLXNpZGVcXG4gIHZhbElkICAgICAgICAgICAgIFN0cmluZz8gLy8gc2V0IGFmdGVyIGdhdGV3YXkgc3VjY2VzcywgdXNlZCBmb3Igc2VydmVyLXNpZGUgdmFsaWRhdGlvblxcbiAgYW1vdW50ICAgICAgICAgICAgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMikgLy8gPSBib29raW5nLnRvdGFsUHJpY2UgYXQgc2Vzc2lvbiBjcmVhdGlvblxcbiAgY3VycmVuY3kgICAgICAgICAgU3RyaW5nICAgICAgICBAZGVmYXVsdChcXFwiQkRUXFxcIilcXG4gIHN0YXR1cyAgICAgICAgICAgIFBheW1lbnRTdGF0dXMgQGRlZmF1bHQoSU5JVElBVEVEKVxcbiAgZ2F0ZXdheVBhZ2VVcmwgICAgU3RyaW5nP1xcbiAgc3NsU2Vzc2lvbktleSAgICAgU3RyaW5nP1xcbiAgY2FyZFR5cGUgICAgICAgICAgU3RyaW5nP1xcbiAgYmFua1RyYW5JZCAgICAgICAgU3RyaW5nP1xcbiAgcGFpZEF0ICAgICAgICAgICAgRGF0ZVRpbWU/XFxuICByZWZ1bmRSZWZJZCAgICAgICBTdHJpbmc/IC8vIFNTTENvbW1lcnogcmVmdW5kIHJlZmVyZW5jZSAoc2V0IHdoZW4gYSByZWZ1bmQgaXMgaW5pdGlhdGVkKVxcbiAgcmVmdW5kSW5pdGlhdGVkQXQgRGF0ZVRpbWU/IC8vIHNldCB3aGVuIGEgcmVmdW5kIGF0dGVtcHQgc3RhcnRzL2ZhaWxzIChmb3IgbGF0ZXIgcmV0cnkpXFxuICByZWZ1bmRDb21wbGV0ZWRBdCBEYXRlVGltZT8gLy8gc2V0IG9ubHkgd2hlbiB0aGUgZ2F0ZXdheSBjb25maXJtcyB0aGUgcmVmdW5kIHN1Y2NlZWRlZFxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGJvb2tpbmcgQm9va2luZyBAcmVsYXRpb24oZmllbGRzOiBbYm9va2luZ0lkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW2Jvb2tpbmdJZF0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInBheW1lbnRzXFxcIilcXG59XFxuXFxubW9kZWwgUmVmcmVzaFRva2VuIHtcXG4gIGlkICAgICAgICBTdHJpbmcgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHVzZXJJZCAgICBTdHJpbmdcXG4gIGhhc2ggICAgICBTdHJpbmcgICAgQHVuaXF1ZSAvLyBTSEEtMjU2IG9mIHRoZSByZWZyZXNoIEpXVCBcdTIwMTQgbmV2ZXIgc3RvcmUgdGhlIEpXVCBpdHNlbGZcXG4gIGV4cGlyZXNBdCBEYXRlVGltZVxcbiAgY3JlYXRlZEF0IERhdGVUaW1lICBAZGVmYXVsdChub3coKSlcXG4gIHJldm9rZWRBdCBEYXRlVGltZT8gLy8gc2V0IHdoZW4gcm90YXRlZCBvciBsb2dnZWQgb3V0XFxuXFxuICB1c2VyIFVzZXIgQHJlbGF0aW9uKGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuXFxuICBAQGluZGV4KFt1c2VySWQsIHJldm9rZWRBdF0pXFxuICBAQG1hcChcXFwicmVmcmVzaF90b2tlbnNcXFwiKVxcbn1cXG5cXG5tb2RlbCBSZXZpZXcge1xcbiAgaWQgICAgICAgIFN0cmluZyAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHJhdGluZyAgICBJbnRcXG4gIGNvbW1lbnQgICBTdHJpbmdcXG4gIGlzRGVsZXRlZCBCb29sZWFuIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgdXNlcklkICAgIFN0cmluZ1xcbiAgcGFja2FnZUlkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHVzZXIgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lclJldmlld3NcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pXFxuICBAQGluZGV4KFtwYWNrYWdlSWRdKVxcbiAgQEBtYXAoXFxcInJldmlld3NcXFwiKVxcbn1cXG5cXG4vLyBUaGlzIGlzIHlvdXIgUHJpc21hIHNjaGVtYSBmaWxlLFxcbi8vIGxlYXJuIG1vcmUgYWJvdXQgaXQgaW4gdGhlIGRvY3M6IGh0dHBzOi8vcHJpcy5seS9kL3ByaXNtYS1zY2hlbWFcXG5cXG5nZW5lcmF0b3IgY2xpZW50IHtcXG4gIHByb3ZpZGVyID0gXFxcInByaXNtYS1jbGllbnRcXFwiXFxuICBvdXRwdXQgICA9IFxcXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hXFxcIlxcbn1cXG5cXG5kYXRhc291cmNlIGRiIHtcXG4gIHByb3ZpZGVyID0gXFxcInBvc3RncmVzcWxcXFwiXFxufVxcblxcbm1vZGVsIFRvdXJQYWNrYWdlIHtcXG4gIGlkICAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRpdGxlICAgICAgIFN0cmluZ1xcbiAgc2x1ZyAgICAgICAgU3RyaW5nICAgICAgICBAdW5pcXVlXFxuICBkZXNjcmlwdGlvbiBTdHJpbmdcXG4gIGxvY2F0aW9uICAgIFN0cmluZ1xcbiAgcHJpY2UgICAgICAgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMilcXG4gIGR1cmF0aW9uICAgIEludFxcbiAgcmF0aW5nICAgICAgRmxvYXQgICAgICAgICBAZGVmYXVsdCgwKVxcbiAgaW1hZ2VzICAgICAgU3RyaW5nW11cXG4gIHN0YXR1cyAgICAgIFBhY2thZ2VTdGF0dXMgQGRlZmF1bHQoUEVORElORylcXG4gIGlzRGVsZXRlZCAgIEJvb2xlYW4gICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBjYXRlZ29yeUlkIFN0cmluZ1xcbiAgYWdlbnRJZCAgICBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBjYXRlZ29yeSAgICAgIENhdGVnb3J5ICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFtjYXRlZ29yeUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGFnZW50ICAgICAgICAgVXNlciAgICAgICAgICAgQHJlbGF0aW9uKFxcXCJBZ2VudFBhY2thZ2VzXFxcIiwgZmllbGRzOiBbYWdlbnRJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBib29raW5ncyAgICAgIEJvb2tpbmdbXVxcbiAgcmV2aWV3cyAgICAgICBSZXZpZXdbXVxcbiAgd2lzaGxpc3RJdGVtcyBXaXNobGlzdEl0ZW1bXVxcblxcbiAgQEBpbmRleChbY2F0ZWdvcnlJZF0pXFxuICBAQGluZGV4KFtjYXRlZ29yeUlkLCBwcmljZV0pXFxuICBAQGluZGV4KFtwcmljZV0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInRvdXJfcGFja2FnZXNcXFwiKVxcbn1cXG5cXG5tb2RlbCBVc2VyIHtcXG4gIGlkICAgICAgICAgICAgU3RyaW5nICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lICAgICAgICAgIFN0cmluZ1xcbiAgZW1haWwgICAgICAgICBTdHJpbmcgICAgICAgQHVuaXF1ZVxcbiAgcGFzc3dvcmQgICAgICBTdHJpbmc/XFxuICBnb29nbGVJZCAgICAgIFN0cmluZz8gICAgICBAdW5pcXVlXFxuICBwaG9uZSAgICAgICAgIFN0cmluZz9cXG4gIGF2YXRhclVybCAgICAgU3RyaW5nP1xcbiAgcm9sZSAgICAgICAgICBSb2xlICAgICAgICAgQGRlZmF1bHQoVVNFUilcXG4gIHN0YXR1cyAgICAgICAgVXNlclN0YXR1cyAgIEBkZWZhdWx0KEFDVElWRSlcXG4gIGF1dGhQcm92aWRlciAgQXV0aFByb3ZpZGVyIEBkZWZhdWx0KENSRURFTlRJQUwpXFxuICBlbWFpbFZlcmlmaWVkIEJvb2xlYW4gICAgICBAZGVmYXVsdChmYWxzZSlcXG4gIGlzRGVsZXRlZCAgICAgQm9vbGVhbiAgICAgIEBkZWZhdWx0KGZhbHNlKVxcbiAgdG9rZW5WZXJzaW9uICBJbnQgICAgICAgICAgQGRlZmF1bHQoMClcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBwYWNrYWdlcyAgICAgIFRvdXJQYWNrYWdlW10gIEByZWxhdGlvbihcXFwiQWdlbnRQYWNrYWdlc1xcXCIpXFxuICBib29raW5ncyAgICAgIEJvb2tpbmdbXSAgICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCIpXFxuICByZXZpZXdzICAgICAgIFJldmlld1tdICAgICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIilcXG4gIHBvc3RzICAgICAgICAgQmxvZ1Bvc3RbXSAgICAgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIpXFxuICB3aXNobGlzdCAgICAgIFdpc2hsaXN0SXRlbVtdXFxuICBub3RpZmljYXRpb25zIE5vdGlmaWNhdGlvbltdXFxuICBjb21tZW50cyAgICAgIEJsb2dDb21tZW50W10gIEByZWxhdGlvbihcXFwiVXNlckNvbW1lbnRzXFxcIilcXG4gIHJlZnJlc2hUb2tlbnMgUmVmcmVzaFRva2VuW11cXG5cXG4gIEBAaW5kZXgoW3JvbGVdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAbWFwKFxcXCJ1c2Vyc1xcXCIpXFxufVxcblxcbm1vZGVsIFdpc2hsaXN0SXRlbSB7XFxuICBpZCAgICAgICAgU3RyaW5nIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuXFxuICB1c2VyICAgIFVzZXIgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pXFxuICBAQGluZGV4KFt1c2VySWQsIGNyZWF0ZWRBdF0pXFxuICBAQG1hcChcXFwid2lzaGxpc3RfaXRlbXNcXFwiKVxcbn1cXG5cIixcbiAgXCJydW50aW1lRGF0YU1vZGVsXCI6IHtcbiAgICBcIm1vZGVsc1wiOiB7fSxcbiAgICBcImVudW1zXCI6IHt9LFxuICAgIFwidHlwZXNcIjoge31cbiAgfSxcbiAgXCJwYXJhbWV0ZXJpemF0aW9uU2NoZW1hXCI6IHtcbiAgICBcInN0cmluZ3NcIjogW10sXG4gICAgXCJncmFwaFwiOiBcIlwiXG4gIH1cbn1cblxuY29uZmlnLnJ1bnRpbWVEYXRhTW9kZWwgPSBKU09OLnBhcnNlKFwie1xcXCJtb2RlbHNcXFwiOntcXFwiQmxvZ0NvbW1lbnRcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNvbnRlbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBvc3RJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXJlbnRJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwb3N0XFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCbG9nUG9zdFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlBvc3RDb21tZW50c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJVc2VyQ29tbWVudHNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXJlbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ29tbWVudFJlcGxpZXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyZXBsaWVzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCbG9nQ29tbWVudFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkNvbW1lbnRSZXBsaWVzXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJibG9nX2NvbW1lbnRzXFxcIn0sXFxcIkJsb2dQb3N0XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0aXRsZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZXhjZXJwdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29udGVudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY292ZXJJbWFnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUG9zdFN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhvcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhvclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkF1dGhvclBvc3RzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29tbWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUG9zdENvbW1lbnRzXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJibG9nX3Bvc3RzXFxcIn0sXFxcIkJvb2tpbmdcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRyYXZlbERhdGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhdmVsZXJzXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0b3RhbFByaWNlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEZWNpbWFsXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1N0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lckJvb2tpbmdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBheW1lbnRzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYXltZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvUGF5bWVudFxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwifSxcXFwiQ2F0ZWdvcnlcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNsdWdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ2F0ZWdvcnlUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJjYXRlZ29yaWVzXFxcIn0sXFxcIkNvbnRhY3RNZXNzYWdlXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJuYW1lXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJlbWFpbFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3ViamVjdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibWVzc2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNSZXNvbHZlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJjb250YWN0X21lc3NhZ2VzXFxcIn0sXFxcIk5vdGlmaWNhdGlvblxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0eXBlXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiTm90aWZpY2F0aW9uVHlwZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRpdGxlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJtZXNzYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJsaW5rXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc1JlYWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIk5vdGlmaWNhdGlvblRvVXNlclxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwibm90aWZpY2F0aW9uc1xcXCJ9LFxcXCJQYXltZW50XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRyYW5JZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidmFsSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImFtb3VudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImN1cnJlbmN5XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYXltZW50U3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNzbFNlc3Npb25LZXlcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNhcmRUeXBlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJiYW5rVHJhbklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWlkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmdW5kUmVmSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJlZnVuZEluaXRpYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJlZnVuZENvbXBsZXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1BheW1lbnRcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInBheW1lbnRzXFxcIn0sXFxcIlJlZnJlc2hUb2tlblxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJoYXNoXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJleHBpcmVzQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJldm9rZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmVmcmVzaFRva2VuVG9Vc2VyXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJyZWZyZXNoX3Rva2Vuc1xcXCJ9LFxcXCJSZXZpZXdcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJhdGluZ1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29tbWVudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyUmV2aWV3c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmV2aWV3VG9Ub3VyUGFja2FnZVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwicmV2aWV3c1xcXCJ9LFxcXCJUb3VyUGFja2FnZVxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidGl0bGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNsdWdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImRlc2NyaXB0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJsb2NhdGlvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicHJpY2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRlY2ltYWxcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJkdXJhdGlvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmF0aW5nXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJGbG9hdFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImltYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUGFja2FnZVN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNhdGVnb3J5SWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImFnZW50SWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2F0ZWdvcnlcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkNhdGVnb3J5XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ2F0ZWdvcnlUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYWdlbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBZ2VudFBhY2thZ2VzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJldmlld3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlJldmlld1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlJldmlld1RvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ3aXNobGlzdEl0ZW1zXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJXaXNobGlzdEl0ZW1cXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJUb3VyUGFja2FnZVRvV2lzaGxpc3RJdGVtXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJ0b3VyX3BhY2thZ2VzXFxcIn0sXFxcIlVzZXJcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXNzd29yZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZ29vZ2xlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBob25lXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhdmF0YXJVcmxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJvbGVcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJSb2xlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhQcm92aWRlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIkF1dGhQcm92aWRlclxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsVmVyaWZpZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0b2tlblZlcnNpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQWdlbnRQYWNrYWdlc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJldmlld3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlJldmlld1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyUmV2aWV3c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBvc3RzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCbG9nUG9zdFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkF1dGhvclBvc3RzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwid2lzaGxpc3RcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIldpc2hsaXN0SXRlbVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlVzZXJUb1dpc2hsaXN0SXRlbVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5vdGlmaWNhdGlvbnNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIk5vdGlmaWNhdGlvblxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIk5vdGlmaWNhdGlvblRvVXNlclxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNvbW1lbnRzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCbG9nQ29tbWVudFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlVzZXJDb21tZW50c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJlZnJlc2hUb2tlbnNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlJlZnJlc2hUb2tlblxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlJlZnJlc2hUb2tlblRvVXNlclxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwidXNlcnNcXFwifSxcXFwiV2lzaGxpc3RJdGVtXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJVc2VyVG9XaXNobGlzdEl0ZW1cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlRvdXJQYWNrYWdlVG9XaXNobGlzdEl0ZW1cXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcIndpc2hsaXN0X2l0ZW1zXFxcIn19LFxcXCJlbnVtc1xcXCI6e30sXFxcInR5cGVzXFxcIjp7fX1cIilcbmNvbmZpZy5wYXJhbWV0ZXJpemF0aW9uU2NoZW1hID0ge1xuICBzdHJpbmdzOiBKU09OLnBhcnNlKFwiW1xcXCJ3aGVyZVxcXCIsXFxcIm9yZGVyQnlcXFwiLFxcXCJjdXJzb3JcXFwiLFxcXCJwYWNrYWdlc1xcXCIsXFxcIl9jb3VudFxcXCIsXFxcImNhdGVnb3J5XFxcIixcXFwiYWdlbnRcXFwiLFxcXCJ1c2VyXFxcIixcXFwicGFja2FnZVxcXCIsXFxcImJvb2tpbmdcXFwiLFxcXCJwYXltZW50c1xcXCIsXFxcImJvb2tpbmdzXFxcIixcXFwicmV2aWV3c1xcXCIsXFxcIndpc2hsaXN0SXRlbXNcXFwiLFxcXCJwb3N0c1xcXCIsXFxcIndpc2hsaXN0XFxcIixcXFwibm90aWZpY2F0aW9uc1xcXCIsXFxcImNvbW1lbnRzXFxcIixcXFwicmVmcmVzaFRva2Vuc1xcXCIsXFxcImF1dGhvclxcXCIsXFxcInBvc3RcXFwiLFxcXCJwYXJlbnRcXFwiLFxcXCJyZXBsaWVzXFxcIixcXFwiQmxvZ0NvbW1lbnQuZmluZFVuaXF1ZVxcXCIsXFxcIkJsb2dDb21tZW50LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQmxvZ0NvbW1lbnQuZmluZEZpcnN0XFxcIixcXFwiQmxvZ0NvbW1lbnQuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkJsb2dDb21tZW50LmZpbmRNYW55XFxcIixcXFwiZGF0YVxcXCIsXFxcIkJsb2dDb21tZW50LmNyZWF0ZU9uZVxcXCIsXFxcIkJsb2dDb21tZW50LmNyZWF0ZU1hbnlcXFwiLFxcXCJCbG9nQ29tbWVudC5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQmxvZ0NvbW1lbnQudXBkYXRlT25lXFxcIixcXFwiQmxvZ0NvbW1lbnQudXBkYXRlTWFueVxcXCIsXFxcIkJsb2dDb21tZW50LnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJjcmVhdGVcXFwiLFxcXCJ1cGRhdGVcXFwiLFxcXCJCbG9nQ29tbWVudC51cHNlcnRPbmVcXFwiLFxcXCJCbG9nQ29tbWVudC5kZWxldGVPbmVcXFwiLFxcXCJCbG9nQ29tbWVudC5kZWxldGVNYW55XFxcIixcXFwiaGF2aW5nXFxcIixcXFwiX21pblxcXCIsXFxcIl9tYXhcXFwiLFxcXCJCbG9nQ29tbWVudC5ncm91cEJ5XFxcIixcXFwiQmxvZ0NvbW1lbnQuYWdncmVnYXRlXFxcIixcXFwiQmxvZ1Bvc3QuZmluZFVuaXF1ZVxcXCIsXFxcIkJsb2dQb3N0LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQmxvZ1Bvc3QuZmluZEZpcnN0XFxcIixcXFwiQmxvZ1Bvc3QuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkJsb2dQb3N0LmZpbmRNYW55XFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlT25lXFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlTWFueVxcXCIsXFxcIkJsb2dQb3N0LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVPbmVcXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVNYW55XFxcIixcXFwiQmxvZ1Bvc3QudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJsb2dQb3N0LnVwc2VydE9uZVxcXCIsXFxcIkJsb2dQb3N0LmRlbGV0ZU9uZVxcXCIsXFxcIkJsb2dQb3N0LmRlbGV0ZU1hbnlcXFwiLFxcXCJCbG9nUG9zdC5ncm91cEJ5XFxcIixcXFwiQmxvZ1Bvc3QuYWdncmVnYXRlXFxcIixcXFwiQm9va2luZy5maW5kVW5pcXVlXFxcIixcXFwiQm9va2luZy5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIkJvb2tpbmcuZmluZEZpcnN0XFxcIixcXFwiQm9va2luZy5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQm9va2luZy5maW5kTWFueVxcXCIsXFxcIkJvb2tpbmcuY3JlYXRlT25lXFxcIixcXFwiQm9va2luZy5jcmVhdGVNYW55XFxcIixcXFwiQm9va2luZy5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQm9va2luZy51cGRhdGVPbmVcXFwiLFxcXCJCb29raW5nLnVwZGF0ZU1hbnlcXFwiLFxcXCJCb29raW5nLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCb29raW5nLnVwc2VydE9uZVxcXCIsXFxcIkJvb2tpbmcuZGVsZXRlT25lXFxcIixcXFwiQm9va2luZy5kZWxldGVNYW55XFxcIixcXFwiX2F2Z1xcXCIsXFxcIl9zdW1cXFwiLFxcXCJCb29raW5nLmdyb3VwQnlcXFwiLFxcXCJCb29raW5nLmFnZ3JlZ2F0ZVxcXCIsXFxcIkNhdGVnb3J5LmZpbmRVbmlxdWVcXFwiLFxcXCJDYXRlZ29yeS5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIkNhdGVnb3J5LmZpbmRGaXJzdFxcXCIsXFxcIkNhdGVnb3J5LmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJDYXRlZ29yeS5maW5kTWFueVxcXCIsXFxcIkNhdGVnb3J5LmNyZWF0ZU9uZVxcXCIsXFxcIkNhdGVnb3J5LmNyZWF0ZU1hbnlcXFwiLFxcXCJDYXRlZ29yeS5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQ2F0ZWdvcnkudXBkYXRlT25lXFxcIixcXFwiQ2F0ZWdvcnkudXBkYXRlTWFueVxcXCIsXFxcIkNhdGVnb3J5LnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDYXRlZ29yeS51cHNlcnRPbmVcXFwiLFxcXCJDYXRlZ29yeS5kZWxldGVPbmVcXFwiLFxcXCJDYXRlZ29yeS5kZWxldGVNYW55XFxcIixcXFwiQ2F0ZWdvcnkuZ3JvdXBCeVxcXCIsXFxcIkNhdGVnb3J5LmFnZ3JlZ2F0ZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRVbmlxdWVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRGaXJzdFxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmNyZWF0ZU9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmNyZWF0ZU1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBkYXRlT25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBkYXRlTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cHNlcnRPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5kZWxldGVPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5kZWxldGVNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZ3JvdXBCeVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmFnZ3JlZ2F0ZVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5maW5kVW5pcXVlXFxcIixcXFwiTm90aWZpY2F0aW9uLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiTm90aWZpY2F0aW9uLmZpbmRGaXJzdFxcXCIsXFxcIk5vdGlmaWNhdGlvbi5maW5kRmlyc3RPclRocm93XFxcIixcXFwiTm90aWZpY2F0aW9uLmZpbmRNYW55XFxcIixcXFwiTm90aWZpY2F0aW9uLmNyZWF0ZU9uZVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5jcmVhdGVNYW55XFxcIixcXFwiTm90aWZpY2F0aW9uLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJOb3RpZmljYXRpb24udXBkYXRlT25lXFxcIixcXFwiTm90aWZpY2F0aW9uLnVwZGF0ZU1hbnlcXFwiLFxcXCJOb3RpZmljYXRpb24udXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIk5vdGlmaWNhdGlvbi51cHNlcnRPbmVcXFwiLFxcXCJOb3RpZmljYXRpb24uZGVsZXRlT25lXFxcIixcXFwiTm90aWZpY2F0aW9uLmRlbGV0ZU1hbnlcXFwiLFxcXCJOb3RpZmljYXRpb24uZ3JvdXBCeVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5hZ2dyZWdhdGVcXFwiLFxcXCJQYXltZW50LmZpbmRVbmlxdWVcXFwiLFxcXCJQYXltZW50LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiUGF5bWVudC5maW5kRmlyc3RcXFwiLFxcXCJQYXltZW50LmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJQYXltZW50LmZpbmRNYW55XFxcIixcXFwiUGF5bWVudC5jcmVhdGVPbmVcXFwiLFxcXCJQYXltZW50LmNyZWF0ZU1hbnlcXFwiLFxcXCJQYXltZW50LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJQYXltZW50LnVwZGF0ZU9uZVxcXCIsXFxcIlBheW1lbnQudXBkYXRlTWFueVxcXCIsXFxcIlBheW1lbnQudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlBheW1lbnQudXBzZXJ0T25lXFxcIixcXFwiUGF5bWVudC5kZWxldGVPbmVcXFwiLFxcXCJQYXltZW50LmRlbGV0ZU1hbnlcXFwiLFxcXCJQYXltZW50Lmdyb3VwQnlcXFwiLFxcXCJQYXltZW50LmFnZ3JlZ2F0ZVxcXCIsXFxcIlJlZnJlc2hUb2tlbi5maW5kVW5pcXVlXFxcIixcXFwiUmVmcmVzaFRva2VuLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiUmVmcmVzaFRva2VuLmZpbmRGaXJzdFxcXCIsXFxcIlJlZnJlc2hUb2tlbi5maW5kRmlyc3RPclRocm93XFxcIixcXFwiUmVmcmVzaFRva2VuLmZpbmRNYW55XFxcIixcXFwiUmVmcmVzaFRva2VuLmNyZWF0ZU9uZVxcXCIsXFxcIlJlZnJlc2hUb2tlbi5jcmVhdGVNYW55XFxcIixcXFwiUmVmcmVzaFRva2VuLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJSZWZyZXNoVG9rZW4udXBkYXRlT25lXFxcIixcXFwiUmVmcmVzaFRva2VuLnVwZGF0ZU1hbnlcXFwiLFxcXCJSZWZyZXNoVG9rZW4udXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJlZnJlc2hUb2tlbi51cHNlcnRPbmVcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZGVsZXRlT25lXFxcIixcXFwiUmVmcmVzaFRva2VuLmRlbGV0ZU1hbnlcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZ3JvdXBCeVxcXCIsXFxcIlJlZnJlc2hUb2tlbi5hZ2dyZWdhdGVcXFwiLFxcXCJSZXZpZXcuZmluZFVuaXF1ZVxcXCIsXFxcIlJldmlldy5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlJldmlldy5maW5kRmlyc3RcXFwiLFxcXCJSZXZpZXcuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlJldmlldy5maW5kTWFueVxcXCIsXFxcIlJldmlldy5jcmVhdGVPbmVcXFwiLFxcXCJSZXZpZXcuY3JlYXRlTWFueVxcXCIsXFxcIlJldmlldy5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUmV2aWV3LnVwZGF0ZU9uZVxcXCIsXFxcIlJldmlldy51cGRhdGVNYW55XFxcIixcXFwiUmV2aWV3LnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJSZXZpZXcudXBzZXJ0T25lXFxcIixcXFwiUmV2aWV3LmRlbGV0ZU9uZVxcXCIsXFxcIlJldmlldy5kZWxldGVNYW55XFxcIixcXFwiUmV2aWV3Lmdyb3VwQnlcXFwiLFxcXCJSZXZpZXcuYWdncmVnYXRlXFxcIixcXFwiVG91clBhY2thZ2UuZmluZFVuaXF1ZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiVG91clBhY2thZ2UuZmluZEZpcnN0XFxcIixcXFwiVG91clBhY2thZ2UuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlRvdXJQYWNrYWdlLmZpbmRNYW55XFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlT25lXFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVNYW55XFxcIixcXFwiVG91clBhY2thZ2UudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwc2VydE9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmRlbGV0ZU9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmRlbGV0ZU1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS5ncm91cEJ5XFxcIixcXFwiVG91clBhY2thZ2UuYWdncmVnYXRlXFxcIixcXFwiVXNlci5maW5kVW5pcXVlXFxcIixcXFwiVXNlci5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlVzZXIuZmluZEZpcnN0XFxcIixcXFwiVXNlci5maW5kRmlyc3RPclRocm93XFxcIixcXFwiVXNlci5maW5kTWFueVxcXCIsXFxcIlVzZXIuY3JlYXRlT25lXFxcIixcXFwiVXNlci5jcmVhdGVNYW55XFxcIixcXFwiVXNlci5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVXNlci51cGRhdGVPbmVcXFwiLFxcXCJVc2VyLnVwZGF0ZU1hbnlcXFwiLFxcXCJVc2VyLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJVc2VyLnVwc2VydE9uZVxcXCIsXFxcIlVzZXIuZGVsZXRlT25lXFxcIixcXFwiVXNlci5kZWxldGVNYW55XFxcIixcXFwiVXNlci5ncm91cEJ5XFxcIixcXFwiVXNlci5hZ2dyZWdhdGVcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZmluZFVuaXF1ZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kRmlyc3RcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kTWFueVxcXCIsXFxcIldpc2hsaXN0SXRlbS5jcmVhdGVPbmVcXFwiLFxcXCJXaXNobGlzdEl0ZW0uY3JlYXRlTWFueVxcXCIsXFxcIldpc2hsaXN0SXRlbS5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiV2lzaGxpc3RJdGVtLnVwZGF0ZU9uZVxcXCIsXFxcIldpc2hsaXN0SXRlbS51cGRhdGVNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJXaXNobGlzdEl0ZW0udXBzZXJ0T25lXFxcIixcXFwiV2lzaGxpc3RJdGVtLmRlbGV0ZU9uZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5kZWxldGVNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLmdyb3VwQnlcXFwiLFxcXCJXaXNobGlzdEl0ZW0uYWdncmVnYXRlXFxcIixcXFwiQU5EXFxcIixcXFwiT1JcXFwiLFxcXCJOT1RcXFwiLFxcXCJpZFxcXCIsXFxcInVzZXJJZFxcXCIsXFxcInBhY2thZ2VJZFxcXCIsXFxcImNyZWF0ZWRBdFxcXCIsXFxcImVxdWFsc1xcXCIsXFxcImluXFxcIixcXFwibm90SW5cXFwiLFxcXCJsdFxcXCIsXFxcImx0ZVxcXCIsXFxcImd0XFxcIixcXFwiZ3RlXFxcIixcXFwibm90XFxcIixcXFwiY29udGFpbnNcXFwiLFxcXCJzdGFydHNXaXRoXFxcIixcXFwiZW5kc1dpdGhcXFwiLFxcXCJuYW1lXFxcIixcXFwiZW1haWxcXFwiLFxcXCJwYXNzd29yZFxcXCIsXFxcImdvb2dsZUlkXFxcIixcXFwicGhvbmVcXFwiLFxcXCJhdmF0YXJVcmxcXFwiLFxcXCJSb2xlXFxcIixcXFwicm9sZVxcXCIsXFxcIlVzZXJTdGF0dXNcXFwiLFxcXCJzdGF0dXNcXFwiLFxcXCJBdXRoUHJvdmlkZXJcXFwiLFxcXCJhdXRoUHJvdmlkZXJcXFwiLFxcXCJlbWFpbFZlcmlmaWVkXFxcIixcXFwiaXNEZWxldGVkXFxcIixcXFwidG9rZW5WZXJzaW9uXFxcIixcXFwidXBkYXRlZEF0XFxcIixcXFwiZXZlcnlcXFwiLFxcXCJzb21lXFxcIixcXFwibm9uZVxcXCIsXFxcInRpdGxlXFxcIixcXFwic2x1Z1xcXCIsXFxcImRlc2NyaXB0aW9uXFxcIixcXFwibG9jYXRpb25cXFwiLFxcXCJwcmljZVxcXCIsXFxcImR1cmF0aW9uXFxcIixcXFwicmF0aW5nXFxcIixcXFwiaW1hZ2VzXFxcIixcXFwiUGFja2FnZVN0YXR1c1xcXCIsXFxcImNhdGVnb3J5SWRcXFwiLFxcXCJhZ2VudElkXFxcIixcXFwiaGFzXFxcIixcXFwiaGFzRXZlcnlcXFwiLFxcXCJoYXNTb21lXFxcIixcXFwiY29tbWVudFxcXCIsXFxcImhhc2hcXFwiLFxcXCJleHBpcmVzQXRcXFwiLFxcXCJyZXZva2VkQXRcXFwiLFxcXCJib29raW5nSWRcXFwiLFxcXCJ0cmFuSWRcXFwiLFxcXCJ2YWxJZFxcXCIsXFxcImFtb3VudFxcXCIsXFxcImN1cnJlbmN5XFxcIixcXFwiUGF5bWVudFN0YXR1c1xcXCIsXFxcImdhdGV3YXlQYWdlVXJsXFxcIixcXFwic3NsU2Vzc2lvbktleVxcXCIsXFxcImNhcmRUeXBlXFxcIixcXFwiYmFua1RyYW5JZFxcXCIsXFxcInBhaWRBdFxcXCIsXFxcInJlZnVuZFJlZklkXFxcIixcXFwicmVmdW5kSW5pdGlhdGVkQXRcXFwiLFxcXCJyZWZ1bmRDb21wbGV0ZWRBdFxcXCIsXFxcIk5vdGlmaWNhdGlvblR5cGVcXFwiLFxcXCJ0eXBlXFxcIixcXFwibWVzc2FnZVxcXCIsXFxcImxpbmtcXFwiLFxcXCJpc1JlYWRcXFwiLFxcXCJzdWJqZWN0XFxcIixcXFwiaXNSZXNvbHZlZFxcXCIsXFxcInRyYXZlbERhdGVcXFwiLFxcXCJ0cmF2ZWxlcnNcXFwiLFxcXCJ0b3RhbFByaWNlXFxcIixcXFwiQm9va2luZ1N0YXR1c1xcXCIsXFxcImV4Y2VycHRcXFwiLFxcXCJjb250ZW50XFxcIixcXFwiY292ZXJJbWFnZVxcXCIsXFxcIlBvc3RTdGF0dXNcXFwiLFxcXCJhdXRob3JJZFxcXCIsXFxcInBvc3RJZFxcXCIsXFxcInBhcmVudElkXFxcIixcXFwidXNlcklkX3BhY2thZ2VJZFxcXCIsXFxcImlzXFxcIixcXFwiaXNOb3RcXFwiLFxcXCJjb25uZWN0T3JDcmVhdGVcXFwiLFxcXCJ1cHNlcnRcXFwiLFxcXCJjcmVhdGVNYW55XFxcIixcXFwic2V0XFxcIixcXFwiZGlzY29ubmVjdFxcXCIsXFxcImRlbGV0ZVxcXCIsXFxcImNvbm5lY3RcXFwiLFxcXCJ1cGRhdGVNYW55XFxcIixcXFwiZGVsZXRlTWFueVxcXCIsXFxcInB1c2hcXFwiLFxcXCJpbmNyZW1lbnRcXFwiLFxcXCJkZWNyZW1lbnRcXFwiLFxcXCJtdWx0aXBseVxcXCIsXFxcImRpdmlkZVxcXCJdXCIpLFxuICBncmFwaDogXCJ3QVp4d0FFUEJ3QUFvUU1BSUJRQUFLTURBQ0FWQUFDa0F3QWdGZ0FBLVFJQUlOOEJBQUNpQXdBdzRBRUFBQ2dBRU9FQkFBQ2lBd0F3NGdFQkFBQUFBZU1CQVFEckFnQWg1UUZBQVBJQ0FDSC1BU0FBOEFJQUlZQUNRQUR5QWdBaHNBSUJBT3NDQUNHMEFnRUE2d0lBSWJVQ0FRRHNBZ0FoQVFBQUFBRUFJQmNGQUFDNEF3QWdCZ0FBb1FNQUlBc0FBUFFDQUNBTUFBRDFBZ0FnRFFBQTl3SUFJTjhCQUFDMUF3QXc0QUVBQUFNQUVPRUJBQUMxQXdBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQzNBNDBDSXY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0dFQWdFQTZ3SUFJWVVDQVFEckFnQWhoZ0lCQU9zQ0FDR0hBZ0VBNndJQUlZZ0NFQUN2QXdBaGlRSUNBUEVDQUNHS0FnZ0F0Z01BSVlzQ0FBRC1BZ0FnalFJQkFPc0NBQ0dPQWdFQTZ3SUFJUVVGQUFEbUJRQWdCZ0FBNEFVQUlBc0FBSjRGQUNBTUFBQ2ZCUUFnRFFBQW9RVUFJQmNGQUFDNEF3QWdCZ0FBb1FNQUlBc0FBUFFDQUNBTUFBRDFBZ0FnRFFBQTl3SUFJTjhCQUFDMUF3QXc0QUVBQUFNQUVPRUJBQUMxQXdBdzRnRUJBQUFBQWVVQlFBRHlBZ0FoLWdFQUFMY0RqUUlpX2dFZ0FQQUNBQ0dBQWtBQThnSUFJWVFDQVFEckFnQWhoUUlCQUFBQUFZWUNBUURyQWdBaGh3SUJBT3NDQUNHSUFoQUFyd01BSVlrQ0FnRHhBZ0FoaWdJSUFMWURBQ0dMQWdBQV9nSUFJSTBDQVFEckFnQWhqZ0lCQU9zQ0FDRURBQUFBQXdBZ0FRQUFCQUF3QWdBQUJRQWdBd0FBQUFNQUlBRUFBQVFBTUFJQUFBVUFJQUVBQUFBREFDQVBCd0FBb1FNQUlBZ0FBS3NEQUNBS0FBQzBBd0FnM3dFQUFMSURBRERnQVFBQUNRQVE0UUVBQUxJREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ3pBNjhDSW9BQ1FBRHlBZ0FocXdKQUFQSUNBQ0dzQWdJQThRSUFJYTBDRUFDdkF3QWhBd2NBQU9BRkFDQUlBQURqQlFBZ0NnQUE1UVVBSUE4SEFBQ2hBd0FnQ0FBQXF3TUFJQW9BQUxRREFDRGZBUUFBc2dNQU1PQUJBQUFKQUJEaEFRQUFzZ01BTU9JQkFRQUFBQUhqQVFFQTZ3SUFJZVFCQVFEckFnQWg1UUZBQVBJQ0FDSDZBUUFBc3dPdkFpS0FBa0FBOGdJQUlhc0NRQUR5QWdBaHJBSUNBUEVDQUNHdEFoQUFyd01BSVFNQUFBQUpBQ0FCQUFBS0FEQUNBQUFMQUNBVkNRQUFzUU1BSU44QkFBQ3VBd0F3NEFFQUFBMEFFT0VCQUFDdUF3QXc0Z0VCQU9zQ0FDSGxBVUFBOGdJQUlmb0JBQUN3QTV3Q0lvQUNRQUR5QWdBaGxnSUJBT3NDQUNHWEFnRUE2d0lBSVpnQ0FRRHNBZ0FobVFJUUFLOERBQ0dhQWdFQTZ3SUFJWndDQVFEc0FnQWhuUUlCQU93Q0FDR2VBZ0VBN0FJQUlaOENBUURzQWdBaG9BSkFBS0FEQUNHaEFnRUE3QUlBSWFJQ1FBQ2dBd0Fob3dKQUFLQURBQ0VLQ1FBQTVBVUFJSmdDQUFEQ0F3QWduQUlBQU1JREFDQ2RBZ0FBd2dNQUlKNENBQURDQXdBZ253SUFBTUlEQUNDZ0FnQUF3Z01BSUtFQ0FBRENBd0Fnb2dJQUFNSURBQ0NqQWdBQXdnTUFJQlVKQUFDeEF3QWczd0VBQUs0REFERGdBUUFBRFFBUTRRRUFBSzREQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0g2QVFBQXNBT2NBaUtBQWtBQThnSUFJWllDQVFEckFnQWhsd0lCQUFBQUFaZ0NBUURzQWdBaG1RSVFBSzhEQUNHYUFnRUE2d0lBSVp3Q0FRRHNBZ0FoblFJQkFPd0NBQ0dlQWdFQTdBSUFJWjhDQVFEc0FnQWhvQUpBQUtBREFDR2hBZ0VBN0FJQUlhSUNRQUNnQXdBaG93SkFBS0FEQUNFREFBQUFEUUFnQVFBQURnQXdBZ0FBRHdBZ0FRQUFBQTBBSUEwSEFBQ2hBd0FnQ0FBQXF3TUFJTjhCQUFDdEF3QXc0QUVBQUJJQUVPRUJBQUN0QXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVRQkFRRHJBZ0FoNVFGQUFQSUNBQ0gtQVNBQThBSUFJWUFDUUFEeUFnQWhpZ0lDQVBFQ0FDR1NBZ0VBNndJQUlRSUhBQURnQlFBZ0NBQUE0d1VBSUE0SEFBQ2hBd0FnQ0FBQXF3TUFJTjhCQUFDdEF3QXc0QUVBQUJJQUVPRUJBQUN0QXdBdzRnRUJBQUFBQWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0tBZ0lBOFFJQUlaSUNBUURyQWdBaHRnSUFBS3dEQUNBREFBQUFFZ0FnQVFBQUV3QXdBZ0FBRkFBZ0NRY0FBS0VEQUNBSUFBQ3JBd0FnM3dFQUFLb0RBRERnQVFBQUZnQVE0UUVBQUtvREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSVFJSEFBRGdCUUFnQ0FBQTR3VUFJQW9IQUFDaEF3QWdDQUFBcXdNQUlOOEJBQUNxQXdBdzRBRUFBQllBRU9FQkFBQ3FBd0F3NGdFQkFBQUFBZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUliWUNBQUNwQXdBZ0F3QUFBQllBSUFFQUFCY0FNQUlBQUJnQUlBRUFBQUFKQUNBQkFBQUFFZ0FnQVFBQUFCWUFJQU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnRUJFQUFQa0NBQ0FUQUFDaEF3QWczd0VBQUtjREFERGdBUUFBSHdBUTRRRUFBS2NEQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFLZ0Rzd0lpX2dFZ0FQQUNBQ0dBQWtBQThnSUFJWVFDQVFEckFnQWhoUUlCQU9zQ0FDR3ZBZ0VBNndJQUliQUNBUURyQWdBaHNRSUJBT3NDQUNHekFnRUE2d0lBSVFJUkFBQ2pCUUFnRXdBQTRBVUFJQkFSQUFENUFnQWdFd0FBb1FNQUlOOEJBQUNuQXdBdzRBRUFBQjhBRU9FQkFBQ25Bd0F3NGdFQkFBQUFBZVVCUUFEeUFnQWgtZ0VBQUtnRHN3SWlfZ0VnQVBBQ0FDR0FBa0FBOGdJQUlZUUNBUURyQWdBaGhRSUJBQUFBQWE4Q0FRRHJBZ0Foc0FJQkFPc0NBQ0d4QWdFQTZ3SUFJYk1DQVFEckFnQWhBd0FBQUI4QUlBRUFBQ0FBTUFJQUFDRUFJQU1BQUFBV0FDQUJBQUFYQURBQ0FBQVlBQ0FNQndBQW9RTUFJTjhCQUFDbEF3QXc0QUVBQUNRQUVPRUJBQUNsQXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVVQlFBRHlBZ0FoaEFJQkFPc0NBQ0dsQWdBQXBnT2xBaUttQWdFQTZ3SUFJYWNDQVFEc0FnQWhxQUlnQVBBQ0FDRUNCd0FBNEFVQUlLY0NBQURDQXdBZ0RBY0FBS0VEQUNEZkFRQUFwUU1BTU9BQkFBQWtBQkRoQVFBQXBRTUFNT0lCQVFBQUFBSGpBUUVBNndJQUllVUJRQUR5QWdBaGhBSUJBT3NDQUNHbEFnQUFwZ09sQWlLbUFnRUE2d0lBSWFjQ0FRRHNBZ0FocUFJZ0FQQUNBQ0VEQUFBQUpBQWdBUUFBSlFBd0FnQUFKZ0FnRHdjQUFLRURBQ0FVQUFDakF3QWdGUUFBcEFNQUlCWUFBUGtDQUNEZkFRQUFvZ01BTU9BQkFBQW9BQkRoQVFBQW9nTUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlmNEJJQUR3QWdBaGdBSkFBUElDQUNHd0FnRUE2d0lBSWJRQ0FRRHJBZ0FodFFJQkFPd0NBQ0VGQndBQTRBVUFJQlFBQU9FRkFDQVZBQURpQlFBZ0ZnQUFvd1VBSUxVQ0FBRENBd0FnQXdBQUFDZ0FJQUVBQUNrQU1BSUFBQUVBSUFvSEFBQ2hBd0FnM3dFQUFKOERBRERnQVFBQUt3QVE0UUVBQUo4REFERGlBUUVBNndJQUllTUJBUURyQWdBaDVRRkFBUElDQUNHVEFnRUE2d0lBSVpRQ1FBRHlBZ0FobFFKQUFLQURBQ0VDQndBQTRBVUFJSlVDQUFEQ0F3QWdDZ2NBQUtFREFDRGZBUUFBbndNQU1PQUJBQUFyQUJEaEFRQUFud01BTU9JQkFRQUFBQUhqQVFFQTZ3SUFJZVVCUUFEeUFnQWhrd0lCQUFBQUFaUUNRQUR5QWdBaGxRSkFBS0FEQUNFREFBQUFLd0FnQVFBQUxBQXdBZ0FBTFFBZ0FRQUFBQU1BSUFFQUFBQUpBQ0FCQUFBQUVnQWdBUUFBQUI4QUlBRUFBQUFXQUNBQkFBQUFKQUFnQVFBQUFDZ0FJQUVBQUFBckFDQURBQUFBS0FBZ0FRQUFLUUF3QWdBQUFRQWdBUUFBQUNnQUlBRUFBQUFvQUNBREFBQUFLQUFnQVFBQUtRQXdBZ0FBQVFBZ0FRQUFBQ2dBSUFFQUFBQUJBQ0FEQUFBQUtBQWdBUUFBS1FBd0FnQUFBUUFnQXdBQUFDZ0FJQUVBQUNrQU1BSUFBQUVBSUFNQUFBQW9BQ0FCQUFBcEFEQUNBQUFCQUNBTUJ3QUFfQU1BSUJRQUFQc0RBQ0FWQUFEX0F3QWdGZ0FBX1FNQUlPSUJBUUFBQUFIakFRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQnNBSUJBQUFBQWJRQ0FRQUFBQUcxQWdFQUFBQUJBUndBQUVBQUlBamlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFiQUNBUUFBQUFHMEFnRUFBQUFCdFFJQkFBQUFBUUVjQUFCQ0FEQUJIQUFBUWdBd0FRQUFBQ2dBSUF3SEFBRDVBd0FnRkFBQTdnTUFJQlVBQU84REFDQVdBQUR3QXdBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJYkFDQVFDOEF3QWh0QUlCQUx3REFDRzFBZ0VBeUFNQUlRSUFBQUFCQUNBY0FBQkdBQ0FJNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUliQUNBUUM4QXdBaHRBSUJBTHdEQUNHMUFnRUF5QU1BSVFJQUFBQW9BQ0FjQUFCSUFDQUNBQUFBS0FBZ0hBQUFTQUFnQVFBQUFDZ0FJQU1BQUFBQkFDQWpBQUJBQUNBa0FBQkdBQ0FCQUFBQUFRQWdBUUFBQUNnQUlBUUVBQURkQlFBZ0tRQUEzd1VBSUNvQUFONEZBQ0MxQWdBQXdnTUFJQXZmQVFBQW5nTUFNT0FCQUFCUUFCRGhBUUFBbmdNQU1PSUJBUURQQWdBaDR3RUJBTThDQUNIbEFVQUEwQUlBSWY0QklBRGJBZ0FoZ0FKQUFOQUNBQ0d3QWdFQXp3SUFJYlFDQVFEUEFnQWh0UUlCQU5jQ0FDRURBQUFBS0FBZ0FRQUFUd0F3S0FBQVVBQWdBd0FBQUNnQUlBRUFBQ2tBTUFJQUFBRUFJQUVBQUFBaEFDQUJBQUFBSVFBZ0F3QUFBQjhBSUFFQUFDQUFNQUlBQUNFQUlBTUFBQUFmQUNBQkFBQWdBREFDQUFBaEFDQURBQUFBSHdBZ0FRQUFJQUF3QWdBQUlRQWdEUkVBQUxBRUFDQVRBQURjQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFMTUNBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUd2QWdFQUFBQUJzQUlCQUFBQUFiRUNBUUFBQUFHekFnRUFBQUFCQVJ3QUFGZ0FJQXZpQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBc3dJQ19nRWdBQUFBQVlBQ1FBQUFBQUdFQWdFQUFBQUJoUUlCQUFBQUFhOENBUUFBQUFHd0FnRUFBQUFCc1FJQkFBQUFBYk1DQVFBQUFBRUJIQUFBV2dBd0FSd0FBRm9BTUEwUkFBQ2xCQUFnRXdBQTJ3VUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBb3dTekFpTC1BU0FBekFNQUlZQUNRQUM5QXdBaGhBSUJBTHdEQUNHRkFnRUF2QU1BSWE4Q0FRQzhBd0Foc0FJQkFMd0RBQ0d4QWdFQXZBTUFJYk1DQVFDOEF3QWhBZ0FBQUNFQUlCd0FBRjBBSUF2aUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFLTUVzd0lpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR3ZBZ0VBdkFNQUliQUNBUUM4QXdBaHNRSUJBTHdEQUNHekFnRUF2QU1BSVFJQUFBQWZBQ0FjQUFCZkFDQUNBQUFBSHdBZ0hBQUFYd0FnQXdBQUFDRUFJQ01BQUZnQUlDUUFBRjBBSUFFQUFBQWhBQ0FCQUFBQUh3QWdBd1FBQU5nRkFDQXBBQURhQlFBZ0tnQUEyUVVBSUE3ZkFRQUFtZ01BTU9BQkFBQm1BQkRoQVFBQW1nTUFNT0lCQVFEUEFnQWg1UUZBQU5BQ0FDSDZBUUFBbXdPekFpTC1BU0FBMndJQUlZQUNRQURRQWdBaGhBSUJBTThDQUNHRkFnRUF6d0lBSWE4Q0FRRFBBZ0Foc0FJQkFNOENBQ0d4QWdFQXp3SUFJYk1DQVFEUEFnQWhBd0FBQUI4QUlBRUFBR1VBTUNnQUFHWUFJQU1BQUFBZkFDQUJBQUFnQURBQ0FBQWhBQ0FCQUFBQUN3QWdBUUFBQUFzQUlBTUFBQUFKQUNBQkFBQUtBREFDQUFBTEFDQURBQUFBQ1FBZ0FRQUFDZ0F3QWdBQUN3QWdBd0FBQUFrQUlBRUFBQW9BTUFJQUFBc0FJQXdIQUFDT0JRQWdDQUFBM0FRQUlBb0FBTjBFQUNEaUFRRUFBQUFCNHdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN2QWdLQUFrQUFBQUFCcXdKQUFBQUFBYXdDQWdBQUFBR3RBaEFBQUFBQkFSd0FBRzRBSUFuaUFRRUFBQUFCNHdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN2QWdLQUFrQUFBQUFCcXdKQUFBQUFBYXdDQWdBQUFBR3RBaEFBQUFBQkFSd0FBSEFBTUFFY0FBQndBREFNQndBQWpBVUFJQWdBQU13RUFDQUtBQUROQkFBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVRQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQXlnU3ZBaUtBQWtBQXZRTUFJYXNDUUFDOUF3QWhyQUlDQU0wREFDR3RBaEFBeVFRQUlRSUFBQUFMQUNBY0FBQnpBQ0FKNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVFCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBeWdTdkFpS0FBa0FBdlFNQUlhc0NRQUM5QXdBaHJBSUNBTTBEQUNHdEFoQUF5UVFBSVFJQUFBQUpBQ0FjQUFCMUFDQUNBQUFBQ1FBZ0hBQUFkUUFnQXdBQUFBc0FJQ01BQUc0QUlDUUFBSE1BSUFFQUFBQUxBQ0FCQUFBQUNRQWdCUVFBQU5NRkFDQXBBQURXQlFBZ0tnQUExUVVBSUVzQUFOUUZBQ0JNQUFEWEJRQWdETjhCQUFDV0F3QXc0QUVBQUh3QUVPRUJBQUNXQXdBdzRnRUJBTThDQUNIakFRRUF6d0lBSWVRQkFRRFBBZ0FoNVFGQUFOQUNBQ0g2QVFBQWx3T3ZBaUtBQWtBQTBBSUFJYXNDUUFEUUFnQWhyQUlDQU53Q0FDR3RBaEFBX0FJQUlRTUFBQUFKQUNBQkFBQjdBREFvQUFCOEFDQURBQUFBQ1FBZ0FRQUFDZ0F3QWdBQUN3QWdDUU1BQVBNQ0FDRGZBUUFBbFFNQU1PQUJBQUNDQVFBUTRRRUFBSlVEQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0h4QVFFQUFBQUJnQUpBQVBJQ0FDR0ZBZ0VBQUFBQkFRQUFBSDhBSUFFQUFBQl9BQ0FKQXdBQTh3SUFJTjhCQUFDVkF3QXc0QUVBQUlJQkFCRGhBUUFBbFFNQU1PSUJBUURyQWdBaDVRRkFBUElDQUNIeEFRRUE2d0lBSVlBQ1FBRHlBZ0FoaFFJQkFPc0NBQ0VCQXdBQW5RVUFJQU1BQUFDQ0FRQWdBUUFBZ3dFQU1BSUFBSDhBSUFNQUFBQ0NBUUFnQVFBQWd3RUFNQUlBQUg4QUlBTUFBQUNDQVFBZ0FRQUFnd0VBTUFJQUFIOEFJQVlEQUFEU0JRQWc0Z0VCQUFBQUFlVUJRQUFBQUFIeEFRRUFBQUFCZ0FKQUFBQUFBWVVDQVFBQUFBRUJIQUFBaHdFQUlBWGlBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUdBQWtBQUFBQUJoUUlCQUFBQUFRRWNBQUNKQVFBd0FSd0FBSWtCQURBR0F3QUF5QVVBSU9JQkFRQzhBd0FoNVFGQUFMMERBQ0h4QVFFQXZBTUFJWUFDUUFDOUF3QWhoUUlCQUx3REFDRUNBQUFBZndBZ0hBQUFqQUVBSUFYaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0dBQWtBQXZRTUFJWVVDQVFDOEF3QWhBZ0FBQUlJQkFDQWNBQUNPQVFBZ0FnQUFBSUlCQUNBY0FBQ09BUUFnQXdBQUFIOEFJQ01BQUljQkFDQWtBQUNNQVFBZ0FRQUFBSDhBSUFFQUFBQ0NBUUFnQXdRQUFNVUZBQ0FwQUFESEJRQWdLZ0FBeGdVQUlBamZBUUFBbEFNQU1PQUJBQUNWQVFBUTRRRUFBSlFEQUREaUFRRUF6d0lBSWVVQlFBRFFBZ0FoOFFFQkFNOENBQ0dBQWtBQTBBSUFJWVVDQVFEUEFnQWhBd0FBQUlJQkFDQUJBQUNVQVFBd0tBQUFsUUVBSUFNQUFBQ0NBUUFnQVFBQWd3RUFNQUlBQUg4QUlBdmZBUUFBa3dNQU1PQUJBQUNiQVFBUTRRRUFBSk1EQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0h4QVFFQTZ3SUFJZklCQVFEckFnQWhnQUpBQVBJQ0FDR21BZ0VBNndJQUlha0NBUURyQWdBaHFnSWdBUEFDQUNFQkFBQUFtQUVBSUFFQUFBQ1lBUUFnQzk4QkFBQ1RBd0F3NEFFQUFKc0JBQkRoQVFBQWt3TUFNT0lCQVFEckFnQWg1UUZBQVBJQ0FDSHhBUUVBNndJQUlmSUJBUURyQWdBaGdBSkFBUElDQUNHbUFnRUE2d0lBSWFrQ0FRRHJBZ0FocWdJZ0FQQUNBQ0VBQXdBQUFKc0JBQ0FCQUFDY0FRQXdBZ0FBbUFFQUlBTUFBQUNiQVFBZ0FRQUFuQUVBTUFJQUFKZ0JBQ0FEQUFBQW13RUFJQUVBQUp3QkFEQUNBQUNZQVFBZ0NPSUJBUUFBQUFIbEFVQUFBQUFCOFFFQkFBQUFBZklCQVFBQUFBR0FBa0FBQUFBQnBnSUJBQUFBQWFrQ0FRQUFBQUdxQWlBQUFBQUJBUndBQUtBQkFDQUk0Z0VCQUFBQUFlVUJRQUFBQUFIeEFRRUFBQUFCOGdFQkFBQUFBWUFDUUFBQUFBR21BZ0VBQUFBQnFRSUJBQUFBQWFvQ0lBQUFBQUVCSEFBQW9nRUFNQUVjQUFDaUFRQXdDT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaGdBSkFBTDBEQUNHbUFnRUF2QU1BSWFrQ0FRQzhBd0FocWdJZ0FNd0RBQ0VDQUFBQW1BRUFJQndBQUtVQkFDQUk0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNHQUFrQUF2UU1BSWFZQ0FRQzhBd0FocVFJQkFMd0RBQ0dxQWlBQXpBTUFJUUlBQUFDYkFRQWdIQUFBcHdFQUlBSUFBQUNiQVFBZ0hBQUFwd0VBSUFNQUFBQ1lBUUFnSXdBQW9BRUFJQ1FBQUtVQkFDQUJBQUFBbUFFQUlBRUFBQUNiQVFBZ0F3UUFBTUlGQUNBcEFBREVCUUFnS2dBQXd3VUFJQXZmQVFBQWtnTUFNT0FCQUFDdUFRQVE0UUVBQUpJREFERGlBUUVBendJQUllVUJRQURRQWdBaDhRRUJBTThDQUNIeUFRRUF6d0lBSVlBQ1FBRFFBZ0FocGdJQkFNOENBQ0dwQWdFQXp3SUFJYW9DSUFEYkFnQWhBd0FBQUpzQkFDQUJBQUN0QVFBd0tBQUFyZ0VBSUFNQUFBQ2JBUUFnQVFBQW5BRUFNQUlBQUpnQkFDQUJBQUFBSmdBZ0FRQUFBQ1lBSUFNQUFBQWtBQ0FCQUFBbEFEQUNBQUFtQUNBREFBQUFKQUFnQVFBQUpRQXdBZ0FBSmdBZ0F3QUFBQ1FBSUFFQUFDVUFNQUlBQUNZQUlBa0hBQURCQlFBZzRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJoQUlCQUFBQUFhVUNBQUFBcFFJQ3BnSUJBQUFBQWFjQ0FRQUFBQUdvQWlBQUFBQUJBUndBQUxZQkFDQUk0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCaEFJQkFBQUFBYVVDQUFBQXBRSUNwZ0lCQUFBQUFhY0NBUUFBQUFHb0FpQUFBQUFCQVJ3QUFMZ0JBREFCSEFBQXVBRUFNQWtIQUFEQUJRQWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaGhBSUJBTHdEQUNHbEFnQUFpZ1NsQWlLbUFnRUF2QU1BSWFjQ0FRRElBd0FocUFJZ0FNd0RBQ0VDQUFBQUpnQWdIQUFBdXdFQUlBamlBUUVBdkFNQUllTUJBUUM4QXdBaDVRRkFBTDBEQUNHRUFnRUF2QU1BSWFVQ0FBQ0tCS1VDSXFZQ0FRQzhBd0FocHdJQkFNZ0RBQ0dvQWlBQXpBTUFJUUlBQUFBa0FDQWNBQUM5QVFBZ0FnQUFBQ1FBSUJ3QUFMMEJBQ0FEQUFBQUpnQWdJd0FBdGdFQUlDUUFBTHNCQUNBQkFBQUFKZ0FnQVFBQUFDUUFJQVFFQUFDOUJRQWdLUUFBdndVQUlDb0FBTDRGQUNDbkFnQUF3Z01BSUF2ZkFRQUFqZ01BTU9BQkFBREVBUUFRNFFFQUFJNERBRERpQVFFQXp3SUFJZU1CQVFEUEFnQWg1UUZBQU5BQ0FDR0VBZ0VBendJQUlhVUNBQUNQQTZVQ0lxWUNBUURQQWdBaHB3SUJBTmNDQUNHb0FpQUEyd0lBSVFNQUFBQWtBQ0FCQUFEREFRQXdLQUFBeEFFQUlBTUFBQUFrQUNBQkFBQWxBREFDQUFBbUFDQUJBQUFBRHdBZ0FRQUFBQThBSUFNQUFBQU5BQ0FCQUFBT0FEQUNBQUFQQUNBREFBQUFEUUFnQVFBQURnQXdBZ0FBRHdBZ0F3QUFBQTBBSUFFQUFBNEFNQUlBQUE4QUlCSUpBQUM4QlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFKd0NBb0FDUUFBQUFBR1dBZ0VBQUFBQmx3SUJBQUFBQVpnQ0FRQUFBQUdaQWhBQUFBQUJtZ0lCQUFBQUFad0NBUUFBQUFHZEFnRUFBQUFCbmdJQkFBQUFBWjhDQVFBQUFBR2dBa0FBQUFBQm9RSUJBQUFBQWFJQ1FBQUFBQUdqQWtBQUFBQUJBUndBQU13QkFDQVI0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSndDQW9BQ1FBQUFBQUdXQWdFQUFBQUJsd0lCQUFBQUFaZ0NBUUFBQUFHWkFoQUFBQUFCbWdJQkFBQUFBWndDQVFBQUFBR2RBZ0VBQUFBQm5nSUJBQUFBQVo4Q0FRQUFBQUdnQWtBQUFBQUJvUUlCQUFBQUFhSUNRQUFBQUFHakFrQUFBQUFCQVJ3QUFNNEJBREFCSEFBQXpnRUFNQklKQUFDN0JRQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmb0JBQURZQkp3Q0lvQUNRQUM5QXdBaGxnSUJBTHdEQUNHWEFnRUF2QU1BSVpnQ0FRRElBd0FobVFJUUFNa0VBQ0dhQWdFQXZBTUFJWndDQVFESUF3QWhuUUlCQU1nREFDR2VBZ0VBeUFNQUlaOENBUURJQXdBaG9BSkFBT0FEQUNHaEFnRUF5QU1BSWFJQ1FBRGdBd0Fob3dKQUFPQURBQ0VDQUFBQUR3QWdIQUFBMFFFQUlCSGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBTmdFbkFJaWdBSkFBTDBEQUNHV0FnRUF2QU1BSVpjQ0FRQzhBd0FobUFJQkFNZ0RBQ0daQWhBQXlRUUFJWm9DQVFDOEF3QWhuQUlCQU1nREFDR2RBZ0VBeUFNQUlaNENBUURJQXdBaG53SUJBTWdEQUNHZ0FrQUE0QU1BSWFFQ0FRRElBd0Fob2dKQUFPQURBQ0dqQWtBQTRBTUFJUUlBQUFBTkFDQWNBQURUQVFBZ0FnQUFBQTBBSUJ3QUFOTUJBQ0FEQUFBQUR3QWdJd0FBekFFQUlDUUFBTkVCQUNBQkFBQUFEd0FnQVFBQUFBMEFJQTRFQUFDMkJRQWdLUUFBdVFVQUlDb0FBTGdGQUNCTEFBQzNCUUFnVEFBQXVnVUFJSmdDQUFEQ0F3QWduQUlBQU1JREFDQ2RBZ0FBd2dNQUlKNENBQURDQXdBZ253SUFBTUlEQUNDZ0FnQUF3Z01BSUtFQ0FBRENBd0Fnb2dJQUFNSURBQ0NqQWdBQXdnTUFJQlRmQVFBQWlnTUFNT0FCQUFEYUFRQVE0UUVBQUlvREFERGlBUUVBendJQUllVUJRQURRQWdBaC1nRUFBSXNEbkFJaWdBSkFBTkFDQUNHV0FnRUF6d0lBSVpjQ0FRRFBBZ0FobUFJQkFOY0NBQ0daQWhBQV9BSUFJWm9DQVFEUEFnQWhuQUlCQU5jQ0FDR2RBZ0VBMXdJQUlaNENBUURYQWdBaG53SUJBTmNDQUNHZ0FrQUFod01BSWFFQ0FRRFhBZ0Fob2dKQUFJY0RBQ0dqQWtBQWh3TUFJUU1BQUFBTkFDQUJBQURaQVFBd0tBQUEyZ0VBSUFNQUFBQU5BQ0FCQUFBT0FEQUNBQUFQQUNBQkFBQUFMUUFnQVFBQUFDMEFJQU1BQUFBckFDQUJBQUFzQURBQ0FBQXRBQ0FEQUFBQUt3QWdBUUFBTEFBd0FnQUFMUUFnQXdBQUFDc0FJQUVBQUN3QU1BSUFBQzBBSUFjSEFBQzFCUUFnNGdFQkFBQUFBZU1CQVFBQUFBSGxBVUFBQUFBQmt3SUJBQUFBQVpRQ1FBQUFBQUdWQWtBQUFBQUJBUndBQU9JQkFDQUc0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCa3dJQkFBQUFBWlFDUUFBQUFBR1ZBa0FBQUFBQkFSd0FBT1FCQURBQkhBQUE1QUVBTUFjSEFBQzBCUUFnNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVVCUUFDOUF3QWhrd0lCQUx3REFDR1VBa0FBdlFNQUlaVUNRQURnQXdBaEFnQUFBQzBBSUJ3QUFPY0JBQ0FHNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVVCUUFDOUF3QWhrd0lCQUx3REFDR1VBa0FBdlFNQUlaVUNRQURnQXdBaEFnQUFBQ3NBSUJ3QUFPa0JBQ0FDQUFBQUt3QWdIQUFBNlFFQUlBTUFBQUF0QUNBakFBRGlBUUFnSkFBQTV3RUFJQUVBQUFBdEFDQUJBQUFBS3dBZ0JBUUFBTEVGQUNBcEFBQ3pCUUFnS2dBQXNnVUFJSlVDQUFEQ0F3QWdDZDhCQUFDR0F3QXc0QUVBQVBBQkFCRGhBUUFBaGdNQU1PSUJBUURQQWdBaDR3RUJBTThDQUNIbEFVQUEwQUlBSVpNQ0FRRFBBZ0FobEFKQUFOQUNBQ0dWQWtBQWh3TUFJUU1BQUFBckFDQUJBQUR2QVFBd0tBQUE4QUVBSUFNQUFBQXJBQ0FCQUFBc0FEQUNBQUF0QUNBQkFBQUFGQUFnQVFBQUFCUUFJQU1BQUFBU0FDQUJBQUFUQURBQ0FBQVVBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnQXdBQUFCSUFJQUVBQUJNQU1BSUFBQlFBSUFvSEFBQ0RCUUFnQ0FBQXZnUUFJT0lCQVFBQUFBSGpBUUVBQUFBQjVBRUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFZb0NBZ0FBQUFHU0FnRUFBQUFCQVJ3QUFQZ0JBQ0FJNGdFQkFBQUFBZU1CQVFBQUFBSGtBUUVBQUFBQjVRRkFBQUFBQWY0QklBQUFBQUdBQWtBQUFBQUJpZ0lDQUFBQUFaSUNBUUFBQUFFQkhBQUEtZ0VBTUFFY0FBRDZBUUF3Q2djQUFJRUZBQ0FJQUFDOEJBQWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNILUFTQUF6QU1BSVlBQ1FBQzlBd0FoaWdJQ0FNMERBQ0dTQWdFQXZBTUFJUUlBQUFBVUFDQWNBQUQ5QVFBZ0NPSUJBUUM4QXdBaDR3RUJBTHdEQUNIa0FRRUF2QU1BSWVVQlFBQzlBd0FoX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWW9DQWdETkF3QWhrZ0lCQUx3REFDRUNBQUFBRWdBZ0hBQUFfd0VBSUFJQUFBQVNBQ0FjQUFEX0FRQWdBd0FBQUJRQUlDTUFBUGdCQUNBa0FBRDlBUUFnQVFBQUFCUUFJQUVBQUFBU0FDQUZCQUFBckFVQUlDa0FBSzhGQUNBcUFBQ3VCUUFnU3dBQXJRVUFJRXdBQUxBRkFDQUwzd0VBQUlVREFERGdBUUFBaGdJQUVPRUJBQUNGQXdBdzRnRUJBTThDQUNIakFRRUF6d0lBSWVRQkFRRFBBZ0FoNVFGQUFOQUNBQ0gtQVNBQTJ3SUFJWUFDUUFEUUFnQWhpZ0lDQU53Q0FDR1NBZ0VBendJQUlRTUFBQUFTQUNBQkFBQ0ZBZ0F3S0FBQWhnSUFJQU1BQUFBU0FDQUJBQUFUQURBQ0FBQVVBQ0FCQUFBQUJRQWdBUUFBQUFVQUlBTUFBQUFEQUNBQkFBQUVBREFDQUFBRkFDQURBQUFBQXdBZ0FRQUFCQUF3QWdBQUJRQWdBd0FBQUFNQUlBRUFBQVFBTUFJQUFBVUFJQlFGQUFDUkJRQWdCZ0FBcXdVQUlBc0FBSklGQUNBTUFBQ1RCUUFnRFFBQWxBVUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNOQWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQmhnSUJBQUFBQVljQ0FRQUFBQUdJQWhBQUFBQUJpUUlDQUFBQUFZb0NDQUFBQUFHTEFnQUFrQVVBSUkwQ0FRQUFBQUdPQWdFQUFBQUJBUndBQUk0Q0FDQVA0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSTBDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDRUFBQUFBR0pBZ0lBQUFBQmlnSUlBQUFBQVlzQ0FBQ1FCUUFnalFJQkFBQUFBWTRDQVFBQUFBRUJIQUFBa0FJQU1BRWNBQUNRQWdBd0ZBVUFBT3dFQUNBR0FBQ3FCUUFnQ3dBQTdRUUFJQXdBQU80RUFDQU5BQUR2QkFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBRHFCSTBDSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhoZ0lCQUx3REFDR0hBZ0VBdkFNQUlZZ0NFQURKQkFBaGlRSUNBTTBEQUNHS0FnZ0E2QVFBSVlzQ0FBRHBCQUFnalFJQkFMd0RBQ0dPQWdFQXZBTUFJUUlBQUFBRkFDQWNBQUNUQWdBZ0QtSUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUE2Z1NOQWlMLUFTQUF6QU1BSVlBQ1FBQzlBd0FoaEFJQkFMd0RBQ0dGQWdFQXZBTUFJWVlDQVFDOEF3QWhod0lCQUx3REFDR0lBaEFBeVFRQUlZa0NBZ0ROQXdBaGlnSUlBT2dFQUNHTEFnQUE2UVFBSUkwQ0FRQzhBd0FoamdJQkFMd0RBQ0VDQUFBQUF3QWdIQUFBbFFJQUlBSUFBQUFEQUNBY0FBQ1ZBZ0FnQXdBQUFBVUFJQ01BQUk0Q0FDQWtBQUNUQWdBZ0FRQUFBQVVBSUFFQUFBQURBQ0FGQkFBQXBRVUFJQ2tBQUtnRkFDQXFBQUNuQlFBZ1N3QUFwZ1VBSUV3QUFLa0ZBQ0FTM3dFQUFQc0NBRERnQVFBQW5BSUFFT0VCQUFEN0FnQXc0Z0VCQU04Q0FDSGxBVUFBMEFJQUlmb0JBQURfQW8wQ0l2NEJJQURiQWdBaGdBSkFBTkFDQUNHRUFnRUF6d0lBSVlVQ0FRRFBBZ0FoaGdJQkFNOENBQ0dIQWdFQXp3SUFJWWdDRUFEOEFnQWhpUUlDQU53Q0FDR0tBZ2dBX1FJQUlZc0NBQUQtQWdBZ2pRSUJBTThDQUNHT0FnRUF6d0lBSVFNQUFBQURBQ0FCQUFDYkFnQXdLQUFBbkFJQUlBTUFBQUFEQUNBQkFBQUVBREFDQUFBRkFDQWFBd0FBOHdJQUlBc0FBUFFDQUNBTUFBRDFBZ0FnRGdBQTlnSUFJQThBQVBjQ0FDQVFBQUQ0QWdBZ0VRQUEtUUlBSUJJQUFQb0NBQ0RmQVFBQTZnSUFNT0FCQUFDaUFnQVE0UUVBQU9vQ0FERGlBUUVBQUFBQjVRRkFBUElDQUNIeEFRRUE2d0lBSWZJQkFRQUFBQUh6QVFFQTdBSUFJZlFCQVFBQUFBSDFBUUVBN0FJQUlmWUJBUURzQWdBaC1BRUFBTzBDLUFFaS1nRUFBTzRDLWdFaV9BRUFBTzhDX0FFaV9RRWdBUEFDQUNILUFTQUE4QUlBSWY4QkFnRHhBZ0FoZ0FKQUFQSUNBQ0VCQUFBQW53SUFJQUVBQUFDZkFnQWdHZ01BQVBNQ0FDQUxBQUQwQWdBZ0RBQUE5UUlBSUE0QUFQWUNBQ0FQQUFEM0FnQWdFQUFBLUFJQUlCRUFBUGtDQUNBU0FBRDZBZ0FnM3dFQUFPb0NBRERnQVFBQW9nSUFFT0VCQUFEcUFnQXc0Z0VCQU9zQ0FDSGxBVUFBOGdJQUlmRUJBUURyQWdBaDhnRUJBT3NDQUNIekFRRUE3QUlBSWZRQkFRRHNBZ0FoOVFFQkFPd0NBQ0gyQVFFQTdBSUFJZmdCQUFEdEF2Z0JJdm9CQUFEdUF2b0JJdndCQUFEdkF2d0JJdjBCSUFEd0FnQWhfZ0VnQVBBQ0FDSF9BUUlBOFFJQUlZQUNRQUR5QWdBaERBTUFBSjBGQUNBTEFBQ2VCUUFnREFBQW53VUFJQTRBQUtBRkFDQVBBQUNoQlFBZ0VBQUFvZ1VBSUJFQUFLTUZBQ0FTQUFDa0JRQWc4d0VBQU1JREFDRDBBUUFBd2dNQUlQVUJBQURDQXdBZzlnRUFBTUlEQUNBREFBQUFvZ0lBSUFFQUFLTUNBREFDQUFDZkFnQWdBd0FBQUtJQ0FDQUJBQUNqQWdBd0FnQUFud0lBSUFNQUFBQ2lBZ0FnQVFBQW93SUFNQUlBQUo4Q0FDQVhBd0FBbFFVQUlBc0FBSllGQUNBTUFBQ1hCUUFnRGdBQW1BVUFJQThBQUprRkFDQVFBQUNhQlFBZ0VRQUFtd1VBSUJJQUFKd0ZBQ0RpQVFFQUFBQUI1UUZBQUFBQUFmRUJBUUFBQUFIeUFRRUFBQUFCOHdFQkFBQUFBZlFCQVFBQUFBSDFBUUVBQUFBQjlnRUJBQUFBQWZnQkFBQUEtQUVDLWdFQUFBRDZBUUw4QVFBQUFQd0JBdjBCSUFBQUFBSC1BU0FBQUFBQl93RUNBQUFBQVlBQ1FBQUFBQUVCSEFBQXB3SUFJQV9pQVFFQUFBQUI1UUZBQUFBQUFmRUJBUUFBQUFIeUFRRUFBQUFCOHdFQkFBQUFBZlFCQVFBQUFBSDFBUUVBQUFBQjlnRUJBQUFBQWZnQkFBQUEtQUVDLWdFQUFBRDZBUUw4QVFBQUFQd0JBdjBCSUFBQUFBSC1BU0FBQUFBQl93RUNBQUFBQVlBQ1FBQUFBQUVCSEFBQXFRSUFNQUVjQUFDcEFnQXdGd01BQU00REFDQUxBQURQQXdBZ0RBQUEwQU1BSUE0QUFORURBQ0FQQUFEU0F3QWdFQUFBMHdNQUlCRUFBTlFEQUNBU0FBRFZBd0FnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZkVCQVFDOEF3QWg4Z0VCQUx3REFDSHpBUUVBeUFNQUlmUUJBUURJQXdBaDlRRUJBTWdEQUNIMkFRRUF5QU1BSWZnQkFBREpBX2dCSXZvQkFBREtBX29CSXZ3QkFBRExBX3dCSXYwQklBRE1Bd0FoX2dFZ0FNd0RBQ0hfQVFJQXpRTUFJWUFDUUFDOUF3QWhBZ0FBQUo4Q0FDQWNBQUNzQWdBZ0QtSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoOHdFQkFNZ0RBQ0gwQVFFQXlBTUFJZlVCQVFESUF3QWg5Z0VCQU1nREFDSDRBUUFBeVFQNEFTTDZBUUFBeWdQNkFTTDhBUUFBeXdQOEFTTDlBU0FBekFNQUlmNEJJQURNQXdBaF93RUNBTTBEQUNHQUFrQUF2UU1BSVFJQUFBQ2lBZ0FnSEFBQXJnSUFJQUlBQUFDaUFnQWdIQUFBcmdJQUlBTUFBQUNmQWdBZ0l3QUFwd0lBSUNRQUFLd0NBQ0FCQUFBQW53SUFJQUVBQUFDaUFnQWdDUVFBQU1NREFDQXBBQURHQXdBZ0tnQUF4UU1BSUVzQUFNUURBQ0JNQUFESEF3QWc4d0VBQU1JREFDRDBBUUFBd2dNQUlQVUJBQURDQXdBZzlnRUFBTUlEQUNBUzN3RUFBTllDQUREZ0FRQUF0UUlBRU9FQkFBRFdBZ0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZkVCQVFEUEFnQWg4Z0VCQU04Q0FDSHpBUUVBMXdJQUlmUUJBUURYQWdBaDlRRUJBTmNDQUNIMkFRRUExd0lBSWZnQkFBRFlBdmdCSXZvQkFBRFpBdm9CSXZ3QkFBRGFBdndCSXYwQklBRGJBZ0FoX2dFZ0FOc0NBQ0hfQVFJQTNBSUFJWUFDUUFEUUFnQWhBd0FBQUtJQ0FDQUJBQUMwQWdBd0tBQUF0UUlBSUFNQUFBQ2lBZ0FnQVFBQW93SUFNQUlBQUo4Q0FDQUJBQUFBR0FBZ0FRQUFBQmdBSUFNQUFBQVdBQ0FCQUFBWEFEQUNBQUFZQUNBREFBQUFGZ0FnQVFBQUZ3QXdBZ0FBR0FBZ0F3QUFBQllBSUFFQUFCY0FNQUlBQUJnQUlBWUhBQURBQXdBZ0NBQUF3UU1BSU9JQkFRQUFBQUhqQVFFQUFBQUI1QUVCQUFBQUFlVUJRQUFBQUFFQkhBQUF2UUlBSUFUaUFRRUFBQUFCNHdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQkFSd0FBTDhDQURBQkhBQUF2d0lBTUFZSEFBQy1Bd0FnQ0FBQXZ3TUFJT0lCQVFDOEF3QWg0d0VCQUx3REFDSGtBUUVBdkFNQUllVUJRQUM5QXdBaEFnQUFBQmdBSUJ3QUFNSUNBQ0FFNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVFCQVFDOEF3QWg1UUZBQUwwREFDRUNBQUFBRmdBZ0hBQUF4QUlBSUFJQUFBQVdBQ0FjQUFERUFnQWdBd0FBQUJnQUlDTUFBTDBDQUNBa0FBRENBZ0FnQVFBQUFCZ0FJQUVBQUFBV0FDQURCQUFBdVFNQUlDa0FBTHNEQUNBcUFBQzZBd0FnQjk4QkFBRE9BZ0F3NEFFQUFNc0NBQkRoQVFBQXpnSUFNT0lCQVFEUEFnQWg0d0VCQU04Q0FDSGtBUUVBendJQUllVUJRQURRQWdBaEF3QUFBQllBSUFFQUFNb0NBREFvQUFETEFnQWdBd0FBQUJZQUlBRUFBQmNBTUFJQUFCZ0FJQWZmQVFBQXpnSUFNT0FCQUFETEFnQVE0UUVBQU00Q0FERGlBUUVBendJQUllTUJBUURQQWdBaDVBRUJBTThDQUNIbEFVQUEwQUlBSVE0RUFBRFNBZ0FnS1FBQTFRSUFJQ29BQU5VQ0FDRG1BUUVBQUFBQjV3RUJBQUFBQk9nQkFRQUFBQVRwQVFFQUFBQUI2Z0VCQUFBQUFlc0JBUUFBQUFIc0FRRUFBQUFCN1FFQkFOUUNBQ0h1QVFFQUFBQUI3d0VCQUFBQUFmQUJBUUFBQUFFTEJBQUEwZ0lBSUNrQUFOTUNBQ0FxQUFEVEFnQWc1Z0ZBQUFBQUFlY0JRQUFBQUFUb0FVQUFBQUFFNlFGQUFBQUFBZW9CUUFBQUFBSHJBVUFBQUFBQjdBRkFBQUFBQWUwQlFBRFJBZ0FoQ3dRQUFOSUNBQ0FwQUFEVEFnQWdLZ0FBMHdJQUlPWUJRQUFBQUFIbkFVQUFBQUFFNkFGQUFBQUFCT2tCUUFBQUFBSHFBVUFBQUFBQjZ3RkFBQUFBQWV3QlFBQUFBQUh0QVVBQTBRSUFJUWptQVFJQUFBQUI1d0VDQUFBQUJPZ0JBZ0FBQUFUcEFRSUFBQUFCNmdFQ0FBQUFBZXNCQWdBQUFBSHNBUUlBQUFBQjdRRUNBTklDQUNFSTVnRkFBQUFBQWVjQlFBQUFBQVRvQVVBQUFBQUU2UUZBQUFBQUFlb0JRQUFBQUFIckFVQUFBQUFCN0FGQUFBQUFBZTBCUUFEVEFnQWhEZ1FBQU5JQ0FDQXBBQURWQWdBZ0tnQUExUUlBSU9ZQkFRQUFBQUhuQVFFQUFBQUU2QUVCQUFBQUJPa0JBUUFBQUFIcUFRRUFBQUFCNndFQkFBQUFBZXdCQVFBQUFBSHRBUUVBMUFJQUllNEJBUUFBQUFIdkFRRUFBQUFCOEFFQkFBQUFBUXZtQVFFQUFBQUI1d0VCQUFBQUJPZ0JBUUFBQUFUcEFRRUFBQUFCNmdFQkFBQUFBZXNCQVFBQUFBSHNBUUVBQUFBQjdRRUJBTlVDQUNIdUFRRUFBQUFCN3dFQkFBQUFBZkFCQVFBQUFBRVMzd0VBQU5ZQ0FERGdBUUFBdFFJQUVPRUJBQURXQWdBdzRnRUJBTThDQUNIbEFVQUEwQUlBSWZFQkFRRFBBZ0FoOGdFQkFNOENBQ0h6QVFFQTF3SUFJZlFCQVFEWEFnQWg5UUVCQU5jQ0FDSDJBUUVBMXdJQUlmZ0JBQURZQXZnQkl2b0JBQURaQXZvQkl2d0JBQURhQXZ3Qkl2MEJJQURiQWdBaF9nRWdBTnNDQUNIX0FRSUEzQUlBSVlBQ1FBRFFBZ0FoRGdRQUFPZ0NBQ0FwQUFEcEFnQWdLZ0FBNlFJQUlPWUJBUUFBQUFIbkFRRUFBQUFGNkFFQkFBQUFCZWtCQVFBQUFBSHFBUUVBQUFBQjZ3RUJBQUFBQWV3QkFRQUFBQUh0QVFFQTV3SUFJZTRCQVFBQUFBSHZBUUVBQUFBQjhBRUJBQUFBQVFjRUFBRFNBZ0FnS1FBQTVnSUFJQ29BQU9ZQ0FDRG1BUUFBQVBnQkF1Y0JBQUFBLUFFSTZBRUFBQUQ0QVFqdEFRQUE1UUw0QVNJSEJBQUEwZ0lBSUNrQUFPUUNBQ0FxQUFEa0FnQWc1Z0VBQUFENkFRTG5BUUFBQVBvQkNPZ0JBQUFBLWdFSTdRRUFBT01DLWdFaUJ3UUFBTklDQUNBcEFBRGlBZ0FnS2dBQTRnSUFJT1lCQUFBQV9BRUM1d0VBQUFEOEFRam9BUUFBQVB3QkNPMEJBQURoQXZ3QklnVUVBQURTQWdBZ0tRQUE0QUlBSUNvQUFPQUNBQ0RtQVNBQUFBQUI3UUVnQU44Q0FDRU5CQUFBMGdJQUlDa0FBTklDQUNBcUFBRFNBZ0FnU3dBQTNnSUFJRXdBQU5JQ0FDRG1BUUlBQUFBQjV3RUNBQUFBQk9nQkFnQUFBQVRwQVFJQUFBQUI2Z0VDQUFBQUFlc0JBZ0FBQUFIc0FRSUFBQUFCN1FFQ0FOMENBQ0VOQkFBQTBnSUFJQ2tBQU5JQ0FDQXFBQURTQWdBZ1N3QUEzZ0lBSUV3QUFOSUNBQ0RtQVFJQUFBQUI1d0VDQUFBQUJPZ0JBZ0FBQUFUcEFRSUFBQUFCNmdFQ0FBQUFBZXNCQWdBQUFBSHNBUUlBQUFBQjdRRUNBTjBDQUNFSTVnRUlBQUFBQWVjQkNBQUFBQVRvQVFnQUFBQUU2UUVJQUFBQUFlb0JDQUFBQUFIckFRZ0FBQUFCN0FFSUFBQUFBZTBCQ0FEZUFnQWhCUVFBQU5JQ0FDQXBBQURnQWdBZ0tnQUE0QUlBSU9ZQklBQUFBQUh0QVNBQTN3SUFJUUxtQVNBQUFBQUI3UUVnQU9BQ0FDRUhCQUFBMGdJQUlDa0FBT0lDQUNBcUFBRGlBZ0FnNWdFQUFBRDhBUUxuQVFBQUFQd0JDT2dCQUFBQV9BRUk3UUVBQU9FQ19BRWlCT1lCQUFBQV9BRUM1d0VBQUFEOEFRam9BUUFBQVB3QkNPMEJBQURpQXZ3QklnY0VBQURTQWdBZ0tRQUE1QUlBSUNvQUFPUUNBQ0RtQVFBQUFQb0JBdWNCQUFBQS1nRUk2QUVBQUFENkFRanRBUUFBNHdMNkFTSUU1Z0VBQUFENkFRTG5BUUFBQVBvQkNPZ0JBQUFBLWdFSTdRRUFBT1FDLWdFaUJ3UUFBTklDQUNBcEFBRG1BZ0FnS2dBQTVnSUFJT1lCQUFBQS1BRUM1d0VBQUFENEFRam9BUUFBQVBnQkNPMEJBQURsQXZnQklnVG1BUUFBQVBnQkF1Y0JBQUFBLUFFSTZBRUFBQUQ0QVFqdEFRQUE1Z0w0QVNJT0JBQUE2QUlBSUNrQUFPa0NBQ0FxQUFEcEFnQWc1Z0VCQUFBQUFlY0JBUUFBQUFYb0FRRUFBQUFGNlFFQkFBQUFBZW9CQVFBQUFBSHJBUUVBQUFBQjdBRUJBQUFBQWUwQkFRRG5BZ0FoN2dFQkFBQUFBZThCQVFBQUFBSHdBUUVBQUFBQkNPWUJBZ0FBQUFIbkFRSUFBQUFGNkFFQ0FBQUFCZWtCQWdBQUFBSHFBUUlBQUFBQjZ3RUNBQUFBQWV3QkFnQUFBQUh0QVFJQTZBSUFJUXZtQVFFQUFBQUI1d0VCQUFBQUJlZ0JBUUFBQUFYcEFRRUFBQUFCNmdFQkFBQUFBZXNCQVFBQUFBSHNBUUVBQUFBQjdRRUJBT2tDQUNIdUFRRUFBQUFCN3dFQkFBQUFBZkFCQVFBQUFBRWFBd0FBOHdJQUlBc0FBUFFDQUNBTUFBRDFBZ0FnRGdBQTlnSUFJQThBQVBjQ0FDQVFBQUQ0QWdBZ0VRQUEtUUlBSUJJQUFQb0NBQ0RmQVFBQTZnSUFNT0FCQUFDaUFnQVE0UUVBQU9vQ0FERGlBUUVBNndJQUllVUJRQUR5QWdBaDhRRUJBT3NDQUNIeUFRRUE2d0lBSWZNQkFRRHNBZ0FoOUFFQkFPd0NBQ0gxQVFFQTdBSUFJZllCQVFEc0FnQWgtQUVBQU8wQy1BRWktZ0VBQU80Qy1nRWlfQUVBQU84Q19BRWlfUUVnQVBBQ0FDSC1BU0FBOEFJQUlmOEJBZ0R4QWdBaGdBSkFBUElDQUNFTDVnRUJBQUFBQWVjQkFRQUFBQVRvQVFFQUFBQUU2UUVCQUFBQUFlb0JBUUFBQUFIckFRRUFBQUFCN0FFQkFBQUFBZTBCQVFEVkFnQWg3Z0VCQUFBQUFlOEJBUUFBQUFId0FRRUFBQUFCQy1ZQkFRQUFBQUhuQVFFQUFBQUY2QUVCQUFBQUJla0JBUUFBQUFIcUFRRUFBQUFCNndFQkFBQUFBZXdCQVFBQUFBSHRBUUVBNlFJQUllNEJBUUFBQUFIdkFRRUFBQUFCOEFFQkFBQUFBUVRtQVFBQUFQZ0JBdWNCQUFBQS1BRUk2QUVBQUFENEFRanRBUUFBNWdMNEFTSUU1Z0VBQUFENkFRTG5BUUFBQVBvQkNPZ0JBQUFBLWdFSTdRRUFBT1FDLWdFaUJPWUJBQUFBX0FFQzV3RUFBQUQ4QVFqb0FRQUFBUHdCQ08wQkFBRGlBdndCSWdMbUFTQUFBQUFCN1FFZ0FPQUNBQ0VJNWdFQ0FBQUFBZWNCQWdBQUFBVG9BUUlBQUFBRTZRRUNBQUFBQWVvQkFnQUFBQUhyQVFJQUFBQUI3QUVDQUFBQUFlMEJBZ0RTQWdBaENPWUJRQUFBQUFIbkFVQUFBQUFFNkFGQUFBQUFCT2tCUUFBQUFBSHFBVUFBQUFBQjZ3RkFBQUFBQWV3QlFBQUFBQUh0QVVBQTB3SUFJUU9CQWdBQUF3QWdnZ0lBQUFNQUlJTUNBQUFEQUNBRGdRSUFBQWtBSUlJQ0FBQUpBQ0NEQWdBQUNRQWdBNEVDQUFBU0FDQ0NBZ0FBRWdBZ2d3SUFBQklBSUFPQkFnQUFId0FnZ2dJQUFCOEFJSU1DQUFBZkFDQURnUUlBQUJZQUlJSUNBQUFXQUNDREFnQUFGZ0FnQTRFQ0FBQWtBQ0NDQWdBQUpBQWdnd0lBQUNRQUlBT0JBZ0FBS0FBZ2dnSUFBQ2dBSUlNQ0FBQW9BQ0FEZ1FJQUFDc0FJSUlDQUFBckFDQ0RBZ0FBS3dBZ0V0OEJBQUQ3QWdBdzRBRUFBSndDQUJEaEFRQUEtd0lBTU9JQkFRRFBBZ0FoNVFGQUFOQUNBQ0g2QVFBQV93S05BaUwtQVNBQTJ3SUFJWUFDUUFEUUFnQWhoQUlCQU04Q0FDR0ZBZ0VBendJQUlZWUNBUURQQWdBaGh3SUJBTThDQUNHSUFoQUFfQUlBSVlrQ0FnRGNBZ0FoaWdJSUFQMENBQ0dMQWdBQV9nSUFJSTBDQVFEUEFnQWhqZ0lCQU04Q0FDRU5CQUFBMGdJQUlDa0FBSVFEQUNBcUFBQ0VBd0FnU3dBQWhBTUFJRXdBQUlRREFDRG1BUkFBQUFBQjV3RVFBQUFBQk9nQkVBQUFBQVRwQVJBQUFBQUI2Z0VRQUFBQUFlc0JFQUFBQUFIc0FSQUFBQUFCN1FFUUFJTURBQ0VOQkFBQTBnSUFJQ2tBQU40Q0FDQXFBQURlQWdBZ1N3QUEzZ0lBSUV3QUFONENBQ0RtQVFnQUFBQUI1d0VJQUFBQUJPZ0JDQUFBQUFUcEFRZ0FBQUFCNmdFSUFBQUFBZXNCQ0FBQUFBSHNBUWdBQUFBQjdRRUlBSUlEQUNFRTVnRUJBQUFBQlk4Q0FRQUFBQUdRQWdFQUFBQUVrUUlCQUFBQUJBY0VBQURTQWdBZ0tRQUFnUU1BSUNvQUFJRURBQ0RtQVFBQUFJMENBdWNCQUFBQWpRSUk2QUVBQUFDTkFnanRBUUFBZ0FPTkFpSUhCQUFBMGdJQUlDa0FBSUVEQUNBcUFBQ0JBd0FnNWdFQUFBQ05BZ0xuQVFBQUFJMENDT2dCQUFBQWpRSUk3UUVBQUlBRGpRSWlCT1lCQUFBQWpRSUM1d0VBQUFDTkFnam9BUUFBQUkwQ0NPMEJBQUNCQTQwQ0lnMEVBQURTQWdBZ0tRQUEzZ0lBSUNvQUFONENBQ0JMQUFEZUFnQWdUQUFBM2dJQUlPWUJDQUFBQUFIbkFRZ0FBQUFFNkFFSUFBQUFCT2tCQ0FBQUFBSHFBUWdBQUFBQjZ3RUlBQUFBQWV3QkNBQUFBQUh0QVFnQWdnTUFJUTBFQUFEU0FnQWdLUUFBaEFNQUlDb0FBSVFEQUNCTEFBQ0VBd0FnVEFBQWhBTUFJT1lCRUFBQUFBSG5BUkFBQUFBRTZBRVFBQUFBQk9rQkVBQUFBQUhxQVJBQUFBQUI2d0VRQUFBQUFld0JFQUFBQUFIdEFSQUFnd01BSVFqbUFSQUFBQUFCNXdFUUFBQUFCT2dCRUFBQUFBVHBBUkFBQUFBQjZnRVFBQUFBQWVzQkVBQUFBQUhzQVJBQUFBQUI3UUVRQUlRREFDRUwzd0VBQUlVREFERGdBUUFBaGdJQUVPRUJBQUNGQXdBdzRnRUJBTThDQUNIakFRRUF6d0lBSWVRQkFRRFBBZ0FoNVFGQUFOQUNBQ0gtQVNBQTJ3SUFJWUFDUUFEUUFnQWhpZ0lDQU53Q0FDR1NBZ0VBendJQUlRbmZBUUFBaGdNQU1PQUJBQUR3QVFBUTRRRUFBSVlEQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNVFGQUFOQUNBQ0dUQWdFQXp3SUFJWlFDUUFEUUFnQWhsUUpBQUljREFDRUxCQUFBNkFJQUlDa0FBSWtEQUNBcUFBQ0pBd0FnNWdGQUFBQUFBZWNCUUFBQUFBWG9BVUFBQUFBRjZRRkFBQUFBQWVvQlFBQUFBQUhyQVVBQUFBQUI3QUZBQUFBQUFlMEJRQUNJQXdBaEN3UUFBT2dDQUNBcEFBQ0pBd0FnS2dBQWlRTUFJT1lCUUFBQUFBSG5BVUFBQUFBRjZBRkFBQUFBQmVrQlFBQUFBQUhxQVVBQUFBQUI2d0ZBQUFBQUFld0JRQUFBQUFIdEFVQUFpQU1BSVFqbUFVQUFBQUFCNXdGQUFBQUFCZWdCUUFBQUFBWHBBVUFBQUFBQjZnRkFBQUFBQWVzQlFBQUFBQUhzQVVBQUFBQUI3UUZBQUlrREFDRVUzd0VBQUlvREFERGdBUUFBMmdFQUVPRUJBQUNLQXdBdzRnRUJBTThDQUNIbEFVQUEwQUlBSWZvQkFBQ0xBNXdDSW9BQ1FBRFFBZ0FobGdJQkFNOENBQ0dYQWdFQXp3SUFJWmdDQVFEWEFnQWhtUUlRQVB3Q0FDR2FBZ0VBendJQUlad0NBUURYQWdBaG5RSUJBTmNDQUNHZUFnRUExd0lBSVo4Q0FRRFhBZ0Fob0FKQUFJY0RBQ0doQWdFQTF3SUFJYUlDUUFDSEF3QWhvd0pBQUljREFDRUhCQUFBMGdJQUlDa0FBSTBEQUNBcUFBQ05Bd0FnNWdFQUFBQ2NBZ0xuQVFBQUFKd0NDT2dCQUFBQW5BSUk3UUVBQUl3RG5BSWlCd1FBQU5JQ0FDQXBBQUNOQXdBZ0tnQUFqUU1BSU9ZQkFBQUFuQUlDNXdFQUFBQ2NBZ2pvQVFBQUFKd0NDTzBCQUFDTUE1d0NJZ1RtQVFBQUFKd0NBdWNCQUFBQW5BSUk2QUVBQUFDY0FnanRBUUFBalFPY0FpSUwzd0VBQUk0REFERGdBUUFBeEFFQUVPRUJBQUNPQXdBdzRnRUJBTThDQUNIakFRRUF6d0lBSWVVQlFBRFFBZ0FoaEFJQkFNOENBQ0dsQWdBQWp3T2xBaUttQWdFQXp3SUFJYWNDQVFEWEFnQWhxQUlnQU5zQ0FDRUhCQUFBMGdJQUlDa0FBSkVEQUNBcUFBQ1JBd0FnNWdFQUFBQ2xBZ0xuQVFBQUFLVUNDT2dCQUFBQXBRSUk3UUVBQUpBRHBRSWlCd1FBQU5JQ0FDQXBBQUNSQXdBZ0tnQUFrUU1BSU9ZQkFBQUFwUUlDNXdFQUFBQ2xBZ2pvQVFBQUFLVUNDTzBCQUFDUUE2VUNJZ1RtQVFBQUFLVUNBdWNCQUFBQXBRSUk2QUVBQUFDbEFnanRBUUFBa1FPbEFpSUwzd0VBQUpJREFERGdBUUFBcmdFQUVPRUJBQUNTQXdBdzRnRUJBTThDQUNIbEFVQUEwQUlBSWZFQkFRRFBBZ0FoOGdFQkFNOENBQ0dBQWtBQTBBSUFJYVlDQVFEUEFnQWhxUUlCQU04Q0FDR3FBaUFBMndJQUlRdmZBUUFBa3dNQU1PQUJBQUNiQVFBUTRRRUFBSk1EQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoOFFFQkFPc0NBQ0h5QVFFQTZ3SUFJWUFDUUFEeUFnQWhwZ0lCQU9zQ0FDR3BBZ0VBNndJQUlhb0NJQUR3QWdBaENOOEJBQUNVQXdBdzRBRUFBSlVCQUJEaEFRQUFsQU1BTU9JQkFRRFBBZ0FoNVFGQUFOQUNBQ0h4QVFFQXp3SUFJWUFDUUFEUUFnQWhoUUlCQU04Q0FDRUpBd0FBOHdJQUlOOEJBQUNWQXdBdzRBRUFBSUlCQUJEaEFRQUFsUU1BTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0h4QVFFQTZ3SUFJWUFDUUFEeUFnQWhoUUlCQU9zQ0FDRU0zd0VBQUpZREFERGdBUUFBZkFBUTRRRUFBSllEQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNUFFQkFNOENBQ0hsQVVBQTBBSUFJZm9CQUFDWEE2OENJb0FDUUFEUUFnQWhxd0pBQU5BQ0FDR3NBZ0lBM0FJQUlhMENFQUQ4QWdBaEJ3UUFBTklDQUNBcEFBQ1pBd0FnS2dBQW1RTUFJT1lCQUFBQXJ3SUM1d0VBQUFDdkFnam9BUUFBQUs4Q0NPMEJBQUNZQTY4Q0lnY0VBQURTQWdBZ0tRQUFtUU1BSUNvQUFKa0RBQ0RtQVFBQUFLOENBdWNCQUFBQXJ3SUk2QUVBQUFDdkFnanRBUUFBbUFPdkFpSUU1Z0VBQUFDdkFnTG5BUUFBQUs4Q0NPZ0JBQUFBcndJSTdRRUFBSmtEcndJaUR0OEJBQUNhQXdBdzRBRUFBR1lBRU9FQkFBQ2FBd0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZm9CQUFDYkE3TUNJdjRCSUFEYkFnQWhnQUpBQU5BQ0FDR0VBZ0VBendJQUlZVUNBUURQQWdBaHJ3SUJBTThDQUNHd0FnRUF6d0lBSWJFQ0FRRFBBZ0Foc3dJQkFNOENBQ0VIQkFBQTBnSUFJQ2tBQUowREFDQXFBQUNkQXdBZzVnRUFBQUN6QWdMbkFRQUFBTE1DQ09nQkFBQUFzd0lJN1FFQUFKd0Rzd0lpQndRQUFOSUNBQ0FwQUFDZEF3QWdLZ0FBblFNQUlPWUJBQUFBc3dJQzV3RUFBQUN6QWdqb0FRQUFBTE1DQ08wQkFBQ2NBN01DSWdUbUFRQUFBTE1DQXVjQkFBQUFzd0lJNkFFQUFBQ3pBZ2p0QVFBQW5RT3pBaUlMM3dFQUFKNERBRERnQVFBQVVBQVE0UUVBQUo0REFERGlBUUVBendJQUllTUJBUURQQWdBaDVRRkFBTkFDQUNILUFTQUEyd0lBSVlBQ1FBRFFBZ0Foc0FJQkFNOENBQ0cwQWdFQXp3SUFJYlVDQVFEWEFnQWhDZ2NBQUtFREFDRGZBUUFBbndNQU1PQUJBQUFyQUJEaEFRQUFud01BTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJWk1DQVFEckFnQWhsQUpBQVBJQ0FDR1ZBa0FBb0FNQUlRam1BVUFBQUFBQjV3RkFBQUFBQmVnQlFBQUFBQVhwQVVBQUFBQUI2Z0ZBQUFBQUFlc0JRQUFBQUFIc0FVQUFBQUFCN1FGQUFJa0RBQ0VjQXdBQTh3SUFJQXNBQVBRQ0FDQU1BQUQxQWdBZ0RnQUE5Z0lBSUE4QUFQY0NBQ0FRQUFENEFnQWdFUUFBLVFJQUlCSUFBUG9DQUNEZkFRQUE2Z0lBTU9BQkFBQ2lBZ0FRNFFFQUFPb0NBRERpQVFFQTZ3SUFJZVVCUUFEeUFnQWg4UUVCQU9zQ0FDSHlBUUVBNndJQUlmTUJBUURzQWdBaDlBRUJBT3dDQUNIMUFRRUE3QUlBSWZZQkFRRHNBZ0FoLUFFQUFPMEMtQUVpLWdFQUFPNEMtZ0VpX0FFQUFPOENfQUVpX1FFZ0FQQUNBQ0gtQVNBQThBSUFJZjhCQWdEeEFnQWhnQUpBQVBJQ0FDRzNBZ0FBb2dJQUlMZ0NBQUNpQWdBZ0R3Y0FBS0VEQUNBVUFBQ2pBd0FnRlFBQXBBTUFJQllBQVBrQ0FDRGZBUUFBb2dNQU1PQUJBQUFvQUJEaEFRQUFvZ01BTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR3dBZ0VBNndJQUliUUNBUURyQWdBaHRRSUJBT3dDQUNFU0VRQUEtUUlBSUJNQUFLRURBQ0RmQVFBQXB3TUFNT0FCQUFBZkFCRGhBUUFBcHdNQU1PSUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFxQU96QWlMLUFTQUE4QUlBSVlBQ1FBRHlBZ0FoaEFJQkFPc0NBQ0dGQWdFQTZ3SUFJYThDQVFEckFnQWhzQUlCQU9zQ0FDR3hBZ0VBNndJQUliTUNBUURyQWdBaHR3SUFBQjhBSUxnQ0FBQWZBQ0FSQndBQW9RTUFJQlFBQUtNREFDQVZBQUNrQXdBZ0ZnQUEtUUlBSU44QkFBQ2lBd0F3NEFFQUFDZ0FFT0VCQUFDaUF3QXc0Z0VCQU9zQ0FDSGpBUUVBNndJQUllVUJRQUR5QWdBaF9nRWdBUEFDQUNHQUFrQUE4Z0lBSWJBQ0FRRHJBZ0FodEFJQkFPc0NBQ0cxQWdFQTdBSUFJYmNDQUFBb0FDQzRBZ0FBS0FBZ0RBY0FBS0VEQUNEZkFRQUFwUU1BTU9BQkFBQWtBQkRoQVFBQXBRTUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlZUUNBUURyQWdBaHBRSUFBS1lEcFFJaXBnSUJBT3NDQUNHbkFnRUE3QUlBSWFnQ0lBRHdBZ0FoQk9ZQkFBQUFwUUlDNXdFQUFBQ2xBZ2pvQVFBQUFLVUNDTzBCQUFDUkE2VUNJaEFSQUFENUFnQWdFd0FBb1FNQUlOOEJBQUNuQXdBdzRBRUFBQjhBRU9FQkFBQ25Bd0F3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDb0E3TUNJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUURyQWdBaHJ3SUJBT3NDQUNHd0FnRUE2d0lBSWJFQ0FRRHJBZ0Foc3dJQkFPc0NBQ0VFNWdFQUFBQ3pBZ0xuQVFBQUFMTUNDT2dCQUFBQXN3SUk3UUVBQUowRHN3SWlBdU1CQVFBQUFBSGtBUUVBQUFBQkNRY0FBS0VEQUNBSUFBQ3JBd0FnM3dFQUFLb0RBRERnQVFBQUZnQVE0UUVBQUtvREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSVJrRkFBQzRBd0FnQmdBQW9RTUFJQXNBQVBRQ0FDQU1BQUQxQWdBZ0RRQUE5d0lBSU44QkFBQzFBd0F3NEFFQUFBTUFFT0VCQUFDMUF3QXc0Z0VCQU9zQ0FDSGxBVUFBOGdJQUlmb0JBQUMzQTQwQ0l2NEJJQUR3QWdBaGdBSkFBUElDQUNHRUFnRUE2d0lBSVlVQ0FRRHJBZ0FoaGdJQkFPc0NBQ0dIQWdFQTZ3SUFJWWdDRUFDdkF3QWhpUUlDQVBFQ0FDR0tBZ2dBdGdNQUlZc0NBQUQtQWdBZ2pRSUJBT3NDQUNHT0FnRUE2d0lBSWJjQ0FBQURBQ0M0QWdBQUF3QWdBdU1CQVFBQUFBSGtBUUVBQUFBQkRRY0FBS0VEQUNBSUFBQ3JBd0FnM3dFQUFLMERBRERnQVFBQUVnQVE0UUVBQUswREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0dLQWdJQThRSUFJWklDQVFEckFnQWhGUWtBQUxFREFDRGZBUUFBcmdNQU1PQUJBQUFOQUJEaEFRQUFyZ01BTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0g2QVFBQXNBT2NBaUtBQWtBQThnSUFJWllDQVFEckFnQWhsd0lCQU9zQ0FDR1lBZ0VBN0FJQUlaa0NFQUN2QXdBaG1nSUJBT3NDQUNHY0FnRUE3QUlBSVowQ0FRRHNBZ0FobmdJQkFPd0NBQ0dmQWdFQTdBSUFJYUFDUUFDZ0F3QWhvUUlCQU93Q0FDR2lBa0FBb0FNQUlhTUNRQUNnQXdBaENPWUJFQUFBQUFIbkFSQUFBQUFFNkFFUUFBQUFCT2tCRUFBQUFBSHFBUkFBQUFBQjZ3RVFBQUFBQWV3QkVBQUFBQUh0QVJBQWhBTUFJUVRtQVFBQUFKd0NBdWNCQUFBQW5BSUk2QUVBQUFDY0FnanRBUUFBalFPY0FpSVJCd0FBb1FNQUlBZ0FBS3NEQUNBS0FBQzBBd0FnM3dFQUFMSURBRERnQVFBQUNRQVE0UUVBQUxJREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ3pBNjhDSW9BQ1FBRHlBZ0FocXdKQUFQSUNBQ0dzQWdJQThRSUFJYTBDRUFDdkF3QWh0d0lBQUFrQUlMZ0NBQUFKQUNBUEJ3QUFvUU1BSUFnQUFLc0RBQ0FLQUFDMEF3QWczd0VBQUxJREFERGdBUUFBQ1FBUTRRRUFBTElEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDekE2OENJb0FDUUFEeUFnQWhxd0pBQVBJQ0FDR3NBZ0lBOFFJQUlhMENFQUN2QXdBaEJPWUJBQUFBcndJQzV3RUFBQUN2QWdqb0FRQUFBSzhDQ08wQkFBQ1pBNjhDSWdPQkFnQUFEUUFnZ2dJQUFBMEFJSU1DQUFBTkFDQVhCUUFBdUFNQUlBWUFBS0VEQUNBTEFBRDBBZ0FnREFBQTlRSUFJQTBBQVBjQ0FDRGZBUUFBdFFNQU1PQUJBQUFEQUJEaEFRQUF0UU1BTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0g2QVFBQXR3T05BaUwtQVNBQThBSUFJWUFDUUFEeUFnQWhoQUlCQU9zQ0FDR0ZBZ0VBNndJQUlZWUNBUURyQWdBaGh3SUJBT3NDQUNHSUFoQUFyd01BSVlrQ0FnRHhBZ0FoaWdJSUFMWURBQ0dMQWdBQV9nSUFJSTBDQVFEckFnQWhqZ0lCQU9zQ0FDRUk1Z0VJQUFBQUFlY0JDQUFBQUFUb0FRZ0FBQUFFNlFFSUFBQUFBZW9CQ0FBQUFBSHJBUWdBQUFBQjdBRUlBQUFBQWUwQkNBRGVBZ0FoQk9ZQkFBQUFqUUlDNXdFQUFBQ05BZ2pvQVFBQUFJMENDTzBCQUFDQkE0MENJZ3NEQUFEekFnQWczd0VBQUpVREFERGdBUUFBZ2dFQUVPRUJBQUNWQXdBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZFQkFRRHJBZ0FoZ0FKQUFQSUNBQ0dGQWdFQTZ3SUFJYmNDQUFDQ0FRQWd1QUlBQUlJQkFDQUFBQUFCdkFJQkFBQUFBUUc4QWtBQUFBQUJCU01BQUxrR0FDQWtBQUNfQmdBZ3VRSUFBTG9HQUNDNkFnQUF2Z1lBSUw4Q0FBQ2ZBZ0FnQlNNQUFMY0dBQ0FrQUFDOEJnQWd1UUlBQUxnR0FDQzZBZ0FBdXdZQUlMOENBQUFGQUNBREl3QUF1UVlBSUxrQ0FBQzZCZ0FndndJQUFKOENBQ0FESXdBQXR3WUFJTGtDQUFDNEJnQWd2d0lBQUFVQUlBQUFBQUFBQUFHOEFnRUFBQUFCQWJ3Q0FBQUEtQUVDQWJ3Q0FBQUEtZ0VDQWJ3Q0FBQUFfQUVDQWJ3Q0lBQUFBQUVGdkFJQ0FBQUFBY01DQWdBQUFBSEVBZ0lBQUFBQnhRSUNBQUFBQWNZQ0FnQUFBQUVMSXdBQTNnUUFNQ1FBQU9NRUFEQzVBZ0FBM3dRQU1Mb0NBQURnQkFBd3V3SUFBT0VFQUNDOEFnQUE0Z1FBTUwwQ0FBRGlCQUF3dmdJQUFPSUVBRENfQWdBQTRnUUFNTUFDQUFEa0JBQXd3UUlBQU9VRUFEQUxJd0FBdndRQU1DUUFBTVFFQURDNUFnQUF3QVFBTUxvQ0FBREJCQUF3dXdJQUFNSUVBQ0M4QWdBQXd3UUFNTDBDQUFEREJBQXd2Z0lBQU1NRUFEQ19BZ0FBd3dRQU1NQUNBQURGQkFBd3dRSUFBTVlFQURBTEl3QUFzUVFBTUNRQUFMWUVBREM1QWdBQXNnUUFNTG9DQUFDekJBQXd1d0lBQUxRRUFDQzhBZ0FBdFFRQU1MMENBQUMxQkFBd3ZnSUFBTFVFQURDX0FnQUF0UVFBTU1BQ0FBQzNCQUF3d1FJQUFMZ0VBREFMSXdBQW1RUUFNQ1FBQUo0RUFEQzVBZ0FBbWdRQU1Mb0NBQUNiQkFBd3V3SUFBSndFQUNDOEFnQUFuUVFBTUwwQ0FBQ2RCQUF3dmdJQUFKMEVBRENfQWdBQW5RUUFNTUFDQUFDZkJBQXd3UUlBQUtBRUFEQUxJd0FBalFRQU1DUUFBSklFQURDNUFnQUFqZ1FBTUxvQ0FBQ1BCQUF3dXdJQUFKQUVBQ0M4QWdBQWtRUUFNTDBDQUFDUkJBQXd2Z0lBQUpFRUFEQ19BZ0FBa1FRQU1NQUNBQUNUQkFBd3dRSUFBSlFFQURBTEl3QUFnQVFBTUNRQUFJVUVBREM1QWdBQWdRUUFNTG9DQUFDQ0JBQXd1d0lBQUlNRUFDQzhBZ0FBaEFRQU1MMENBQUNFQkFBd3ZnSUFBSVFFQURDX0FnQUFoQVFBTU1BQ0FBQ0dCQUF3d1FJQUFJY0VBREFMSXdBQTR3TUFNQ1FBQU9nREFEQzVBZ0FBNUFNQU1Mb0NBQURsQXdBd3V3SUFBT1lEQUNDOEFnQUE1d01BTUwwQ0FBRG5Bd0F3dmdJQUFPY0RBRENfQWdBQTV3TUFNTUFDQUFEcEF3QXd3UUlBQU9vREFEQUxJd0FBMWdNQU1DUUFBTnNEQURDNUFnQUExd01BTUxvQ0FBRFlBd0F3dXdJQUFOa0RBQ0M4QWdBQTJnTUFNTDBDQUFEYUF3QXd2Z0lBQU5vREFEQ19BZ0FBMmdNQU1NQUNBQURjQXdBd3dRSUFBTjBEQURBRjRnRUJBQUFBQWVVQlFBQUFBQUdUQWdFQUFBQUJsQUpBQUFBQUFaVUNRQUFBQUFFQ0FBQUFMUUFnSXdBQTRnTUFJQU1BQUFBdEFDQWpBQURpQXdBZ0pBQUE0UU1BSUFFY0FBQzJCZ0F3Q2djQUFLRURBQ0RmQVFBQW53TUFNT0FCQUFBckFCRGhBUUFBbndNQU1PSUJBUUFBQUFIakFRRUE2d0lBSWVVQlFBRHlBZ0Foa3dJQkFBQUFBWlFDUUFEeUFnQWhsUUpBQUtBREFDRUNBQUFBTFFBZ0hBQUE0UU1BSUFJQUFBRGVBd0FnSEFBQTN3TUFJQW5mQVFBQTNRTUFNT0FCQUFEZUF3QVE0UUVBQU4wREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVRRkFBUElDQUNHVEFnRUE2d0lBSVpRQ1FBRHlBZ0FobFFKQUFLQURBQ0VKM3dFQUFOMERBRERnQVFBQTNnTUFFT0VCQUFEZEF3QXc0Z0VCQU9zQ0FDSGpBUUVBNndJQUllVUJRQUR5QWdBaGt3SUJBT3NDQUNHVUFrQUE4Z0lBSVpVQ1FBQ2dBd0FoQmVJQkFRQzhBd0FoNVFGQUFMMERBQ0dUQWdFQXZBTUFJWlFDUUFDOUF3QWhsUUpBQU9BREFDRUJ2QUpBQUFBQUFRWGlBUUVBdkFNQUllVUJRQUM5QXdBaGt3SUJBTHdEQUNHVUFrQUF2UU1BSVpVQ1FBRGdBd0FoQmVJQkFRQUFBQUhsQVVBQUFBQUJrd0lCQUFBQUFaUUNRQUFBQUFHVkFrQUFBQUFCQ2hRQUFQc0RBQ0FWQUFEX0F3QWdGZ0FBX1FNQUlPSUJBUUFBQUFIbEFVQUFBQUFCX2dFZ0FBQUFBWUFDUUFBQUFBR3dBZ0VBQUFBQnRBSUJBQUFBQWJVQ0FRQUFBQUVDQUFBQUFRQWdJd0FBX2dNQUlBTUFBQUFCQUNBakFBRC1Bd0FnSkFBQTdRTUFJQUVjQUFDMUJnQXdEd2NBQUtFREFDQVVBQUNqQXdBZ0ZRQUFwQU1BSUJZQUFQa0NBQ0RmQVFBQW9nTUFNT0FCQUFBb0FCRGhBUUFBb2dNQU1PSUJBUUFBQUFIakFRRUE2d0lBSWVVQlFBRHlBZ0FoX2dFZ0FQQUNBQ0dBQWtBQThnSUFJYkFDQVFEckFnQWh0QUlCQU9zQ0FDRzFBZ0VBN0FJQUlRSUFBQUFCQUNBY0FBRHRBd0FnQWdBQUFPc0RBQ0FjQUFEc0F3QWdDOThCQUFEcUF3QXc0QUVBQU9zREFCRGhBUUFBNmdNQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIbEFVQUE4Z0lBSWY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0d3QWdFQTZ3SUFJYlFDQVFEckFnQWh0UUlCQU93Q0FDRUwzd0VBQU9vREFERGdBUUFBNndNQUVPRUJBQURxQXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVVQlFBRHlBZ0FoX2dFZ0FQQUNBQ0dBQWtBQThnSUFJYkFDQVFEckFnQWh0QUlCQU9zQ0FDRzFBZ0VBN0FJQUlRZmlBUUVBdkFNQUllVUJRQUM5QXdBaF9nRWdBTXdEQUNHQUFrQUF2UU1BSWJBQ0FRQzhBd0FodEFJQkFMd0RBQ0cxQWdFQXlBTUFJUW9VQUFEdUF3QWdGUUFBN3dNQUlCWUFBUEFEQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJYkFDQVFDOEF3QWh0QUlCQUx3REFDRzFBZ0VBeUFNQUlRVWpBQUNwQmdBZ0pBQUFzd1lBSUxrQ0FBQ3FCZ0FndWdJQUFMSUdBQ0NfQWdBQUlRQWdCeU1BQUtVR0FDQWtBQUN3QmdBZ3VRSUFBS1lHQUNDNkFnQUFyd1lBSUwwQ0FBQW9BQ0MtQWdBQUtBQWd2d0lBQUFFQUlBc2pBQUR4QXdBd0pBQUE5UU1BTUxrQ0FBRHlBd0F3dWdJQUFQTURBREM3QWdBQTlBTUFJTHdDQUFEbkF3QXd2UUlBQU9jREFEQy1BZ0FBNXdNQU1MOENBQURuQXdBd3dBSUFBUFlEQUREQkFnQUE2Z01BTUFvSEFBRDhBd0FnRkFBQS13TUFJQllBQVAwREFDRGlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFiQUNBUUFBQUFHMEFnRUFBQUFCQWdBQUFBRUFJQ01BQVBvREFDQURBQUFBQVFBZ0l3QUEtZ01BSUNRQUFQZ0RBQ0FCSEFBQXJnWUFNQUlBQUFBQkFDQWNBQUQ0QXdBZ0FnQUFBT3NEQUNBY0FBRDNBd0FnQi1JQkFRQzhBd0FoNHdFQkFMd0RBQ0hsQVVBQXZRTUFJZjRCSUFETUF3QWhnQUpBQUwwREFDR3dBZ0VBdkFNQUliUUNBUUM4QXdBaENnY0FBUGtEQUNBVUFBRHVBd0FnRmdBQThBTUFJT0lCQVFDOEF3QWg0d0VCQUx3REFDSGxBVUFBdlFNQUlmNEJJQURNQXdBaGdBSkFBTDBEQUNHd0FnRUF2QU1BSWJRQ0FRQzhBd0FoQlNNQUFLY0dBQ0FrQUFDc0JnQWd1UUlBQUtnR0FDQzZBZ0FBcXdZQUlMOENBQUNmQWdBZ0NnY0FBUHdEQUNBVUFBRDdBd0FnRmdBQV9RTUFJT0lCQVFBQUFBSGpBUUVBQUFBQjVRRkFBQUFBQWY0QklBQUFBQUdBQWtBQUFBQUJzQUlCQUFBQUFiUUNBUUFBQUFFREl3QUFxUVlBSUxrQ0FBQ3FCZ0FndndJQUFDRUFJQU1qQUFDbkJnQWd1UUlBQUtnR0FDQ19BZ0FBbndJQUlBUWpBQUR4QXdBd3VRSUFBUElEQURDN0FnQUE5QU1BSUw4Q0FBRG5Bd0F3Q2hRQUFQc0RBQ0FWQUFEX0F3QWdGZ0FBX1FNQUlPSUJBUUFBQUFIbEFVQUFBQUFCX2dFZ0FBQUFBWUFDUUFBQUFBR3dBZ0VBQUFBQnRBSUJBQUFBQWJVQ0FRQUFBQUVESXdBQXBRWUFJTGtDQUFDbUJnQWd2d0lBQUFFQUlBZmlBUUVBQUFBQjVRRkFBQUFBQVlRQ0FRQUFBQUdsQWdBQUFLVUNBcVlDQVFBQUFBR25BZ0VBQUFBQnFBSWdBQUFBQVFJQUFBQW1BQ0FqQUFDTUJBQWdBd0FBQUNZQUlDTUFBSXdFQUNBa0FBQ0xCQUFnQVJ3QUFLUUdBREFNQndBQW9RTUFJTjhCQUFDbEF3QXc0QUVBQUNRQUVPRUJBQUNsQXdBdzRnRUJBQUFBQWVNQkFRRHJBZ0FoNVFGQUFQSUNBQ0dFQWdFQTZ3SUFJYVVDQUFDbUE2VUNJcVlDQVFEckFnQWhwd0lCQU93Q0FDR29BaUFBOEFJQUlRSUFBQUFtQUNBY0FBQ0xCQUFnQWdBQUFJZ0VBQ0FjQUFDSkJBQWdDOThCQUFDSEJBQXc0QUVBQUlnRUFCRGhBUUFBaHdRQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIbEFVQUE4Z0lBSVlRQ0FRRHJBZ0FocFFJQUFLWURwUUlpcGdJQkFPc0NBQ0duQWdFQTdBSUFJYWdDSUFEd0FnQWhDOThCQUFDSEJBQXc0QUVBQUlnRUFCRGhBUUFBaHdRQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIbEFVQUE4Z0lBSVlRQ0FRRHJBZ0FocFFJQUFLWURwUUlpcGdJQkFPc0NBQ0duQWdFQTdBSUFJYWdDSUFEd0FnQWhCLUlCQVFDOEF3QWg1UUZBQUwwREFDR0VBZ0VBdkFNQUlhVUNBQUNLQktVQ0lxWUNBUUM4QXdBaHB3SUJBTWdEQUNHb0FpQUF6QU1BSVFHOEFnQUFBS1VDQWdmaUFRRUF2QU1BSWVVQlFBQzlBd0FoaEFJQkFMd0RBQ0dsQWdBQWlnU2xBaUttQWdFQXZBTUFJYWNDQVFESUF3QWhxQUlnQU13REFDRUg0Z0VCQUFBQUFlVUJRQUFBQUFHRUFnRUFBQUFCcFFJQUFBQ2xBZ0ttQWdFQUFBQUJwd0lCQUFBQUFhZ0NJQUFBQUFFRUNBQUF3UU1BSU9JQkFRQUFBQUhrQVFFQUFBQUI1UUZBQUFBQUFRSUFBQUFZQUNBakFBQ1lCQUFnQXdBQUFCZ0FJQ01BQUpnRUFDQWtBQUNYQkFBZ0FSd0FBS01HQURBS0J3QUFvUU1BSUFnQUFLc0RBQ0RmQVFBQXFnTUFNT0FCQUFBV0FCRGhBUUFBcWdNQU1PSUJBUUFBQUFIakFRRUE2d0lBSWVRQkFRRHJBZ0FoNVFGQUFQSUNBQ0cyQWdBQXFRTUFJQUlBQUFBWUFDQWNBQUNYQkFBZ0FnQUFBSlVFQUNBY0FBQ1dCQUFnQjk4QkFBQ1VCQUF3NEFFQUFKVUVBQkRoQVFBQWxBUUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGtBUUVBNndJQUllVUJRQUR5QWdBaEI5OEJBQUNVQkFBdzRBRUFBSlVFQUJEaEFRQUFsQVFBTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hrQVFFQTZ3SUFJZVVCUUFEeUFnQWhBLUlCQVFDOEF3QWg1QUVCQUx3REFDSGxBVUFBdlFNQUlRUUlBQUNfQXdBZzRnRUJBTHdEQUNIa0FRRUF2QU1BSWVVQlFBQzlBd0FoQkFnQUFNRURBQ0RpQVFFQUFBQUI1QUVCQUFBQUFlVUJRQUFBQUFFTEVRQUFzQVFBSU9JQkFRQUFBQUhsQVVBQUFBQUItZ0VBQUFDekFnTC1BU0FBQUFBQmdBSkFBQUFBQVlRQ0FRQUFBQUdGQWdFQUFBQUJyd0lCQUFBQUFiQUNBUUFBQUFHeEFnRUFBQUFCQWdBQUFDRUFJQ01BQUs4RUFDQURBQUFBSVFBZ0l3QUFyd1FBSUNRQUFLUUVBQ0FCSEFBQW9nWUFNQkFSQUFENUFnQWdFd0FBb1FNQUlOOEJBQUNuQXdBdzRBRUFBQjhBRU9FQkFBQ25Bd0F3NGdFQkFBQUFBZVVCUUFEeUFnQWgtZ0VBQUtnRHN3SWlfZ0VnQVBBQ0FDR0FBa0FBOGdJQUlZUUNBUURyQWdBaGhRSUJBQUFBQWE4Q0FRRHJBZ0Foc0FJQkFPc0NBQ0d4QWdFQTZ3SUFJYk1DQVFEckFnQWhBZ0FBQUNFQUlCd0FBS1FFQUNBQ0FBQUFvUVFBSUJ3QUFLSUVBQ0FPM3dFQUFLQUVBRERnQVFBQW9RUUFFT0VCQUFDZ0JBQXc0Z0VCQU9zQ0FDSGxBVUFBOGdJQUlmb0JBQUNvQTdNQ0l2NEJJQUR3QWdBaGdBSkFBUElDQUNHRUFnRUE2d0lBSVlVQ0FRRHJBZ0FocndJQkFPc0NBQ0d3QWdFQTZ3SUFJYkVDQVFEckFnQWhzd0lCQU9zQ0FDRU8zd0VBQUtBRUFERGdBUUFBb1FRQUVPRUJBQUNnQkFBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ29BN01DSXY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0dFQWdFQTZ3SUFJWVVDQVFEckFnQWhyd0lCQU9zQ0FDR3dBZ0VBNndJQUliRUNBUURyQWdBaHN3SUJBT3NDQUNFSzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBQ2pCTE1DSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhyd0lCQUx3REFDR3dBZ0VBdkFNQUliRUNBUUM4QXdBaEFid0NBQUFBc3dJQ0N4RUFBS1VFQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFLTUVzd0lpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR3ZBZ0VBdkFNQUliQUNBUUM4QXdBaHNRSUJBTHdEQUNFTEl3QUFwZ1FBTUNRQUFLb0VBREM1QWdBQXB3UUFNTG9DQUFDb0JBQXd1d0lBQUtrRUFDQzhBZ0FBNXdNQU1MMENBQURuQXdBd3ZnSUFBT2NEQURDX0FnQUE1d01BTU1BQ0FBQ3JCQUF3d1FJQUFPb0RBREFLQndBQV9BTUFJQlVBQVA4REFDQVdBQUQ5QXdBZzRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJfZ0VnQUFBQUFZQUNRQUFBQUFHd0FnRUFBQUFCdFFJQkFBQUFBUUlBQUFBQkFDQWpBQUN1QkFBZ0F3QUFBQUVBSUNNQUFLNEVBQ0FrQUFDdEJBQWdBUndBQUtFR0FEQUNBQUFBQVFBZ0hBQUFyUVFBSUFJQUFBRHJBd0FnSEFBQXJBUUFJQWZpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDSC1BU0FBekFNQUlZQUNRQUM5QXdBaHNBSUJBTHdEQUNHMUFnRUF5QU1BSVFvSEFBRDVBd0FnRlFBQTd3TUFJQllBQVBBREFDRGlBUUVBdkFNQUllTUJBUUM4QXdBaDVRRkFBTDBEQUNILUFTQUF6QU1BSVlBQ1FBQzlBd0Foc0FJQkFMd0RBQ0cxQWdFQXlBTUFJUW9IQUFEOEF3QWdGUUFBX3dNQUlCWUFBUDBEQUNEaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQWJBQ0FRQUFBQUcxQWdFQUFBQUJDeEVBQUxBRUFDRGlBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFzd0lDX2dFZ0FBQUFBWUFDUUFBQUFBR0VBZ0VBQUFBQmhRSUJBQUFBQWE4Q0FRQUFBQUd3QWdFQUFBQUJzUUlCQUFBQUFRUWpBQUNtQkFBd3VRSUFBS2NFQURDN0FnQUFxUVFBSUw4Q0FBRG5Bd0F3Q0FnQUFMNEVBQ0RpQVFFQUFBQUI1QUVCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBWW9DQWdBQUFBR1NBZ0VBQUFBQkFnQUFBQlFBSUNNQUFMMEVBQ0FEQUFBQUZBQWdJd0FBdlFRQUlDUUFBTHNFQUNBQkhBQUFvQVlBTUE0SEFBQ2hBd0FnQ0FBQXF3TUFJTjhCQUFDdEF3QXc0QUVBQUJJQUVPRUJBQUN0QXdBdzRnRUJBQUFBQWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0tBZ0lBOFFJQUlaSUNBUURyQWdBaHRnSUFBS3dEQUNBQ0FBQUFGQUFnSEFBQXV3UUFJQUlBQUFDNUJBQWdIQUFBdWdRQUlBdmZBUUFBdUFRQU1PQUJBQUM1QkFBUTRRRUFBTGdFQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0tBZ0lBOFFJQUlaSUNBUURyQWdBaEM5OEJBQUM0QkFBdzRBRUFBTGtFQUJEaEFRQUF1QVFBTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hrQVFFQTZ3SUFJZVVCUUFEeUFnQWhfZ0VnQVBBQ0FDR0FBa0FBOGdJQUlZb0NBZ0R4QWdBaGtnSUJBT3NDQUNFSDRnRUJBTHdEQUNIa0FRRUF2QU1BSWVVQlFBQzlBd0FoX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWW9DQWdETkF3QWhrZ0lCQUx3REFDRUlDQUFBdkFRQUlPSUJBUUM4QXdBaDVBRUJBTHdEQUNIbEFVQUF2UU1BSWY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dLQWdJQXpRTUFJWklDQVFDOEF3QWhCU01BQUpzR0FDQWtBQUNlQmdBZ3VRSUFBSndHQUNDNkFnQUFuUVlBSUw4Q0FBQUZBQ0FJQ0FBQXZnUUFJT0lCQVFBQUFBSGtBUUVBQUFBQjVRRkFBQUFBQWY0QklBQUFBQUdBQWtBQUFBQUJpZ0lDQUFBQUFaSUNBUUFBQUFFREl3QUFtd1lBSUxrQ0FBQ2NCZ0FndndJQUFBVUFJQW9JQUFEY0JBQWdDZ0FBM1FRQUlPSUJBUUFBQUFIa0FRRUFBQUFCNVFGQUFBQUFBZm9CQUFBQXJ3SUNnQUpBQUFBQUFhc0NRQUFBQUFHc0FnSUFBQUFCclFJUUFBQUFBUUlBQUFBTEFDQWpBQURiQkFBZ0F3QUFBQXNBSUNNQUFOc0VBQ0FrQUFETEJBQWdBUndBQUpvR0FEQVBCd0FBb1FNQUlBZ0FBS3NEQUNBS0FBQzBBd0FnM3dFQUFMSURBRERnQVFBQUNRQVE0UUVBQUxJREFERGlBUUVBQUFBQjR3RUJBT3NDQUNIa0FRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFMTURyd0lpZ0FKQUFQSUNBQ0dyQWtBQThnSUFJYXdDQWdEeEFnQWhyUUlRQUs4REFDRUNBQUFBQ3dBZ0hBQUF5d1FBSUFJQUFBREhCQUFnSEFBQXlBUUFJQXpmQVFBQXhnUUFNT0FCQUFESEJBQVE0UUVBQU1ZRUFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ3pBNjhDSW9BQ1FBRHlBZ0FocXdKQUFQSUNBQ0dzQWdJQThRSUFJYTBDRUFDdkF3QWhETjhCQUFER0JBQXc0QUVBQU1jRUFCRGhBUUFBeGdRQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIa0FRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFMTURyd0lpZ0FKQUFQSUNBQ0dyQWtBQThnSUFJYXdDQWdEeEFnQWhyUUlRQUs4REFDRUk0Z0VCQUx3REFDSGtBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBTW9FcndJaWdBSkFBTDBEQUNHckFrQUF2UU1BSWF3Q0FnRE5Bd0FoclFJUUFNa0VBQ0VGdkFJUUFBQUFBY01DRUFBQUFBSEVBaEFBQUFBQnhRSVFBQUFBQWNZQ0VBQUFBQUVCdkFJQUFBQ3ZBZ0lLQ0FBQXpBUUFJQW9BQU0wRUFDRGlBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUF5Z1N2QWlLQUFrQUF2UU1BSWFzQ1FBQzlBd0FockFJQ0FNMERBQ0d0QWhBQXlRUUFJUVVqQUFDVUJnQWdKQUFBbUFZQUlMa0NBQUNWQmdBZ3VnSUFBSmNHQUNDX0FnQUFCUUFnQ3lNQUFNNEVBREFrQUFEVEJBQXd1UUlBQU04RUFEQzZBZ0FBMEFRQU1Mc0NBQURSQkFBZ3ZBSUFBTklFQURDOUFnQUEwZ1FBTUw0Q0FBRFNCQUF3dndJQUFOSUVBRERBQWdBQTFBUUFNTUVDQUFEVkJBQXdFT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNjQWdLQUFrQUFBQUFCbHdJQkFBQUFBWmdDQVFBQUFBR1pBaEFBQUFBQm1nSUJBQUFBQVp3Q0FRQUFBQUdkQWdFQUFBQUJuZ0lCQUFBQUFaOENBUUFBQUFHZ0FrQUFBQUFCb1FJQkFBQUFBYUlDUUFBQUFBR2pBa0FBQUFBQkFnQUFBQThBSUNNQUFOb0VBQ0FEQUFBQUR3QWdJd0FBMmdRQUlDUUFBTmtFQUNBQkhBQUFsZ1lBTUJVSkFBQ3hBd0FnM3dFQUFLNERBRERnQVFBQURRQVE0UUVBQUs0REFERGlBUUVBQUFBQjVRRkFBUElDQUNINkFRQUFzQU9jQWlLQUFrQUE4Z0lBSVpZQ0FRRHJBZ0FobHdJQkFBQUFBWmdDQVFEc0FnQWhtUUlRQUs4REFDR2FBZ0VBNndJQUlad0NBUURzQWdBaG5RSUJBT3dDQUNHZUFnRUE3QUlBSVo4Q0FRRHNBZ0Fob0FKQUFLQURBQ0doQWdFQTdBSUFJYUlDUUFDZ0F3QWhvd0pBQUtBREFDRUNBQUFBRHdBZ0hBQUEyUVFBSUFJQUFBRFdCQUFnSEFBQTF3UUFJQlRmQVFBQTFRUUFNT0FCQUFEV0JBQVE0UUVBQU5VRUFERGlBUUVBNndJQUllVUJRQUR5QWdBaC1nRUFBTEFEbkFJaWdBSkFBUElDQUNHV0FnRUE2d0lBSVpjQ0FRRHJBZ0FobUFJQkFPd0NBQ0daQWhBQXJ3TUFJWm9DQVFEckFnQWhuQUlCQU93Q0FDR2RBZ0VBN0FJQUlaNENBUURzQWdBaG53SUJBT3dDQUNHZ0FrQUFvQU1BSWFFQ0FRRHNBZ0Fob2dKQUFLQURBQ0dqQWtBQW9BTUFJUlRmQVFBQTFRUUFNT0FCQUFEV0JBQVE0UUVBQU5VRUFERGlBUUVBNndJQUllVUJRQUR5QWdBaC1nRUFBTEFEbkFJaWdBSkFBUElDQUNHV0FnRUE2d0lBSVpjQ0FRRHJBZ0FobUFJQkFPd0NBQ0daQWhBQXJ3TUFJWm9DQVFEckFnQWhuQUlCQU93Q0FDR2RBZ0VBN0FJQUlaNENBUURzQWdBaG53SUJBT3dDQUNHZ0FrQUFvQU1BSWFFQ0FRRHNBZ0Fob2dKQUFLQURBQ0dqQWtBQW9BTUFJUkRpQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQU5nRW5BSWlnQUpBQUwwREFDR1hBZ0VBdkFNQUlaZ0NBUURJQXdBaG1RSVFBTWtFQUNHYUFnRUF2QU1BSVp3Q0FRRElBd0FoblFJQkFNZ0RBQ0dlQWdFQXlBTUFJWjhDQVFESUF3QWhvQUpBQU9BREFDR2hBZ0VBeUFNQUlhSUNRQURnQXdBaG93SkFBT0FEQUNFQnZBSUFBQUNjQWdJUTRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBRFlCSndDSW9BQ1FBQzlBd0FobHdJQkFMd0RBQ0dZQWdFQXlBTUFJWmtDRUFESkJBQWhtZ0lCQUx3REFDR2NBZ0VBeUFNQUlaMENBUURJQXdBaG5nSUJBTWdEQUNHZkFnRUF5QU1BSWFBQ1FBRGdBd0Fob1FJQkFNZ0RBQ0dpQWtBQTRBTUFJYU1DUUFEZ0F3QWhFT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNjQWdLQUFrQUFBQUFCbHdJQkFBQUFBWmdDQVFBQUFBR1pBaEFBQUFBQm1nSUJBQUFBQVp3Q0FRQUFBQUdkQWdFQUFBQUJuZ0lCQUFBQUFaOENBUUFBQUFHZ0FrQUFBQUFCb1FJQkFBQUFBYUlDUUFBQUFBR2pBa0FBQUFBQkNnZ0FBTndFQUNBS0FBRGRCQUFnNGdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN2QWdLQUFrQUFBQUFCcXdKQUFBQUFBYXdDQWdBQUFBR3RBaEFBQUFBQkF5TUFBSlFHQUNDNUFnQUFsUVlBSUw4Q0FBQUZBQ0FFSXdBQXpnUUFNTGtDQUFEUEJBQXd1d0lBQU5FRUFDQ19BZ0FBMGdRQU1CSUZBQUNSQlFBZ0N3QUFrZ1VBSUF3QUFKTUZBQ0FOQUFDVUJRQWc0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSTBDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDRUFBQUFBR0pBZ0lBQUFBQmlnSUlBQUFBQVlzQ0FBQ1FCUUFnalFJQkFBQUFBUUlBQUFBRkFDQWpBQUNQQlFBZ0F3QUFBQVVBSUNNQUFJOEZBQ0FrQUFEckJBQWdBUndBQUpNR0FEQVhCUUFBdUFNQUlBWUFBS0VEQUNBTEFBRDBBZ0FnREFBQTlRSUFJQTBBQVBjQ0FDRGZBUUFBdFFNQU1PQUJBQUFEQUJEaEFRQUF0UU1BTU9JQkFRQUFBQUhsQVVBQThnSUFJZm9CQUFDM0E0MENJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUUFBQUFHR0FnRUE2d0lBSVljQ0FRRHJBZ0FoaUFJUUFLOERBQ0dKQWdJQThRSUFJWW9DQ0FDMkF3QWhpd0lBQVA0Q0FDQ05BZ0VBNndJQUlZNENBUURyQWdBaEFnQUFBQVVBSUJ3QUFPc0VBQ0FDQUFBQTVnUUFJQndBQU9jRUFDQVMzd0VBQU9VRUFERGdBUUFBNWdRQUVPRUJBQURsQkFBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQzNBNDBDSXY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0dFQWdFQTZ3SUFJWVVDQVFEckFnQWhoZ0lCQU9zQ0FDR0hBZ0VBNndJQUlZZ0NFQUN2QXdBaGlRSUNBUEVDQUNHS0FnZ0F0Z01BSVlzQ0FBRC1BZ0FnalFJQkFPc0NBQ0dPQWdFQTZ3SUFJUkxmQVFBQTVRUUFNT0FCQUFEbUJBQVE0UUVBQU9VRUFERGlBUUVBNndJQUllVUJRQUR5QWdBaC1nRUFBTGNEalFJaV9nRWdBUEFDQUNHQUFrQUE4Z0lBSVlRQ0FRRHJBZ0FoaFFJQkFPc0NBQ0dHQWdFQTZ3SUFJWWNDQVFEckFnQWhpQUlRQUs4REFDR0pBZ0lBOFFJQUlZb0NDQUMyQXdBaGl3SUFBUDRDQUNDTkFnRUE2d0lBSVk0Q0FRRHJBZ0FoRHVJQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTZnU05BaUwtQVNBQXpBTUFJWUFDUUFDOUF3QWhoQUlCQUx3REFDR0ZBZ0VBdkFNQUlZWUNBUUM4QXdBaGh3SUJBTHdEQUNHSUFoQUF5UVFBSVlrQ0FnRE5Bd0FoaWdJSUFPZ0VBQ0dMQWdBQTZRUUFJSTBDQVFDOEF3QWhCYndDQ0FBQUFBSERBZ2dBQUFBQnhBSUlBQUFBQWNVQ0NBQUFBQUhHQWdnQUFBQUJBcndDQVFBQUFBVENBZ0VBQUFBRkFid0NBQUFBalFJQ0VnVUFBT3dFQUNBTEFBRHRCQUFnREFBQTdnUUFJQTBBQU84RUFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBT29FalFJaV9nRWdBTXdEQUNHQUFrQUF2UU1BSVlRQ0FRQzhBd0FoaFFJQkFMd0RBQ0dHQWdFQXZBTUFJWWNDQVFDOEF3QWhpQUlRQU1rRUFDR0pBZ0lBelFNQUlZb0NDQURvQkFBaGl3SUFBT2tFQUNDTkFnRUF2QU1BSVFVakFBQ0JCZ0FnSkFBQWtRWUFJTGtDQUFDQ0JnQWd1Z0lBQUpBR0FDQ19BZ0FBZndBZ0N5TUFBSVFGQURBa0FBQ0lCUUF3dVFJQUFJVUZBREM2QWdBQWhnVUFNTHNDQUFDSEJRQWd2QUlBQU1NRUFEQzlBZ0FBd3dRQU1MNENBQUREQkFBd3Z3SUFBTU1FQUREQUFnQUFpUVVBTU1FQ0FBREdCQUF3Q3lNQUFQa0VBREFrQUFEOUJBQXd1UUlBQVBvRUFEQzZBZ0FBLXdRQU1Mc0NBQUQ4QkFBZ3ZBSUFBTFVFQURDOUFnQUF0UVFBTUw0Q0FBQzFCQUF3dndJQUFMVUVBRERBQWdBQV9nUUFNTUVDQUFDNEJBQXdDeU1BQVBBRUFEQWtBQUQwQkFBd3VRSUFBUEVFQURDNkFnQUE4Z1FBTUxzQ0FBRHpCQUFndkFJQUFKRUVBREM5QWdBQWtRUUFNTDRDQUFDUkJBQXd2d0lBQUpFRUFEREFBZ0FBOVFRQU1NRUNBQUNVQkFBd0JBY0FBTUFEQUNEaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBRUNBQUFBR0FBZ0l3QUEtQVFBSUFNQUFBQVlBQ0FqQUFENEJBQWdKQUFBOXdRQUlBRWNBQUNQQmdBd0FnQUFBQmdBSUJ3QUFQY0VBQ0FDQUFBQWxRUUFJQndBQVBZRUFDQUQ0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaEJBY0FBTDREQUNEaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0VFQndBQXdBTUFJT0lCQVFBQUFBSGpBUUVBQUFBQjVRRkFBQUFBQVFnSEFBQ0RCUUFnNGdFQkFBQUFBZU1CQVFBQUFBSGxBVUFBQUFBQl9nRWdBQUFBQVlBQ1FBQUFBQUdLQWdJQUFBQUJrZ0lCQUFBQUFRSUFBQUFVQUNBakFBQ0NCUUFnQXdBQUFCUUFJQ01BQUlJRkFDQWtBQUNBQlFBZ0FSd0FBSTRHQURBQ0FBQUFGQUFnSEFBQWdBVUFJQUlBQUFDNUJBQWdIQUFBX3dRQUlBZmlBUUVBdkFNQUllTUJBUUM4QXdBaDVRRkFBTDBEQUNILUFTQUF6QU1BSVlBQ1FBQzlBd0FoaWdJQ0FNMERBQ0dTQWdFQXZBTUFJUWdIQUFDQkJRQWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaF9nRWdBTXdEQUNHQUFrQUF2UU1BSVlvQ0FnRE5Bd0Foa2dJQkFMd0RBQ0VGSXdBQWlRWUFJQ1FBQUl3R0FDQzVBZ0FBaWdZQUlMb0NBQUNMQmdBZ3Z3SUFBSjhDQUNBSUJ3QUFnd1VBSU9JQkFRQUFBQUhqQVFFQUFBQUI1UUZBQUFBQUFmNEJJQUFBQUFHQUFrQUFBQUFCaWdJQ0FBQUFBWklDQVFBQUFBRURJd0FBaVFZQUlMa0NBQUNLQmdBZ3Z3SUFBSjhDQUNBS0J3QUFqZ1VBSUFvQUFOMEVBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSzhDQW9BQ1FBQUFBQUdyQWtBQUFBQUJyQUlDQUFBQUFhMENFQUFBQUFFQ0FBQUFDd0FnSXdBQWpRVUFJQU1BQUFBTEFDQWpBQUNOQlFBZ0pBQUFpd1VBSUFFY0FBQ0lCZ0F3QWdBQUFBc0FJQndBQUlzRkFDQUNBQUFBeHdRQUlCd0FBSW9GQUNBSTRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFNb0Vyd0lpZ0FKQUFMMERBQ0dyQWtBQXZRTUFJYXdDQWdETkF3QWhyUUlRQU1rRUFDRUtCd0FBakFVQUlBb0FBTTBFQUNEaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQXlnU3ZBaUtBQWtBQXZRTUFJYXNDUUFDOUF3QWhyQUlDQU0wREFDR3RBaEFBeVFRQUlRVWpBQUNEQmdBZ0pBQUFoZ1lBSUxrQ0FBQ0VCZ0FndWdJQUFJVUdBQ0NfQWdBQW53SUFJQW9IQUFDT0JRQWdDZ0FBM1FRQUlPSUJBUUFBQUFIakFRRUFBQUFCNVFGQUFBQUFBZm9CQUFBQXJ3SUNnQUpBQUFBQUFhc0NRQUFBQUFHc0FnSUFBQUFCclFJUUFBQUFBUU1qQUFDREJnQWd1UUlBQUlRR0FDQ19BZ0FBbndJQUlCSUZBQUNSQlFBZ0N3QUFrZ1VBSUF3QUFKTUZBQ0FOQUFDVUJRQWc0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSTBDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDRUFBQUFBR0pBZ0lBQUFBQmlnSUlBQUFBQVlzQ0FBQ1FCUUFnalFJQkFBQUFBUUc4QWdFQUFBQUVBeU1BQUlFR0FDQzVBZ0FBZ2dZQUlMOENBQUJfQUNBRUl3QUFoQVVBTUxrQ0FBQ0ZCUUF3dXdJQUFJY0ZBQ0NfQWdBQXd3UUFNQVFqQUFENUJBQXd1UUlBQVBvRUFEQzdBZ0FBX0FRQUlMOENBQUMxQkFBd0JDTUFBUEFFQURDNUFnQUE4UVFBTUxzQ0FBRHpCQUFndndJQUFKRUVBREFFSXdBQTNnUUFNTGtDQUFEZkJBQXd1d0lBQU9FRUFDQ19BZ0FBNGdRQU1BUWpBQUNfQkFBd3VRSUFBTUFFQURDN0FnQUF3Z1FBSUw4Q0FBRERCQUF3QkNNQUFMRUVBREM1QWdBQXNnUUFNTHNDQUFDMEJBQWd2d0lBQUxVRUFEQUVJd0FBbVFRQU1Ma0NBQUNhQkFBd3V3SUFBSndFQUNDX0FnQUFuUVFBTUFRakFBQ05CQUF3dVFJQUFJNEVBREM3QWdBQWtBUUFJTDhDQUFDUkJBQXdCQ01BQUlBRUFEQzVBZ0FBZ1FRQU1Mc0NBQUNEQkFBZ3Z3SUFBSVFFQURBRUl3QUE0d01BTUxrQ0FBRGtBd0F3dXdJQUFPWURBQ0NfQWdBQTV3TUFNQVFqQUFEV0F3QXd1UUlBQU5jREFEQzdBZ0FBMlFNQUlMOENBQURhQXdBd0FBQUFBQUFBQUFBQUFBQUFBQVVqQUFEOEJRQWdKQUFBX3dVQUlMa0NBQUQ5QlFBZ3VnSUFBUDRGQUNDX0FnQUFud0lBSUFNakFBRDhCUUFndVFJQUFQMEZBQ0NfQWdBQW53SUFJQUFBQUFBQUFBQUFCU01BQVBjRkFDQWtBQUQ2QlFBZ3VRSUFBUGdGQUNDNkFnQUEtUVVBSUw4Q0FBQ2ZBZ0FnQXlNQUFQY0ZBQ0M1QWdBQS1BVUFJTDhDQUFDZkFnQWdBQUFBQUFBRkl3QUE4Z1VBSUNRQUFQVUZBQ0M1QWdBQTh3VUFJTG9DQUFEMEJRQWd2d0lBQUFzQUlBTWpBQUR5QlFBZ3VRSUFBUE1GQUNDX0FnQUFDd0FnQUFBQUJTTUFBTzBGQUNBa0FBRHdCUUFndVFJQUFPNEZBQ0M2QWdBQTd3VUFJTDhDQUFDZkFnQWdBeU1BQU8wRkFDQzVBZ0FBN2dVQUlMOENBQUNmQWdBZ0FBQUFBQUFBQ3lNQUFNa0ZBREFrQUFETkJRQXd1UUlBQU1vRkFEQzZBZ0FBeXdVQU1Mc0NBQURNQlFBZ3ZBSUFBT0lFQURDOUFnQUE0Z1FBTUw0Q0FBRGlCQUF3dndJQUFPSUVBRERBQWdBQXpnVUFNTUVDQUFEbEJBQXdFZ1lBQUtzRkFDQUxBQUNTQlFBZ0RBQUFrd1VBSUEwQUFKUUZBQ0RpQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBalFJQ19nRWdBQUFBQVlBQ1FBQUFBQUdFQWdFQUFBQUJoUUlCQUFBQUFZWUNBUUFBQUFHSEFnRUFBQUFCaUFJUUFBQUFBWWtDQWdBQUFBR0tBZ2dBQUFBQml3SUFBSkFGQUNDT0FnRUFBQUFCQWdBQUFBVUFJQ01BQU5FRkFDQURBQUFBQlFBZ0l3QUEwUVVBSUNRQUFOQUZBQ0FCSEFBQTdBVUFNQUlBQUFBRkFDQWNBQURRQlFBZ0FnQUFBT1lFQUNBY0FBRFBCUUFnRHVJQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTZnU05BaUwtQVNBQXpBTUFJWUFDUUFDOUF3QWhoQUlCQUx3REFDR0ZBZ0VBdkFNQUlZWUNBUUM4QXdBaGh3SUJBTHdEQUNHSUFoQUF5UVFBSVlrQ0FnRE5Bd0FoaWdJSUFPZ0VBQ0dMQWdBQTZRUUFJSTRDQVFDOEF3QWhFZ1lBQUtvRkFDQUxBQUR0QkFBZ0RBQUE3Z1FBSUEwQUFPOEVBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQU9vRWpRSWlfZ0VnQU13REFDR0FBa0FBdlFNQUlZUUNBUUM4QXdBaGhRSUJBTHdEQUNHR0FnRUF2QU1BSVljQ0FRQzhBd0FoaUFJUUFNa0VBQ0dKQWdJQXpRTUFJWW9DQ0FEb0JBQWhpd0lBQU9rRUFDQ09BZ0VBdkFNQUlSSUdBQUNyQlFBZ0N3QUFrZ1VBSUF3QUFKTUZBQ0FOQUFDVUJRQWc0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSTBDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDRUFBQUFBR0pBZ0lBQUFBQmlnSUlBQUFBQVlzQ0FBQ1FCUUFnamdJQkFBQUFBUVFqQUFESkJRQXd1UUlBQU1vRkFEQzdBZ0FBekFVQUlMOENBQURpQkFBd0FBQUFBQUFBQUFBRkl3QUE1d1VBSUNRQUFPb0ZBQ0M1QWdBQTZBVUFJTG9DQUFEcEJRQWd2d0lBQUo4Q0FDQURJd0FBNXdVQUlMa0NBQURvQlFBZ3Z3SUFBSjhDQUNBQUFBQU1Bd0FBblFVQUlBc0FBSjRGQUNBTUFBQ2ZCUUFnRGdBQW9BVUFJQThBQUtFRkFDQVFBQUNpQlFBZ0VRQUFvd1VBSUJJQUFLUUZBQ0R6QVFBQXdnTUFJUFFCQUFEQ0F3QWc5UUVBQU1JREFDRDJBUUFBd2dNQUlBSVJBQUNqQlFBZ0V3QUE0QVVBSUFVSEFBRGdCUUFnRkFBQTRRVUFJQlVBQU9JRkFDQVdBQUNqQlFBZ3RRSUFBTUlEQUNBRkJRQUE1Z1VBSUFZQUFPQUZBQ0FMQUFDZUJRQWdEQUFBbndVQUlBMEFBS0VGQUNBREJ3QUE0QVVBSUFnQUFPTUZBQ0FLQUFEbEJRQWdBQUVEQUFDZEJRQWdGZ01BQUpVRkFDQUxBQUNXQlFBZ0RBQUFsd1VBSUE4QUFKa0ZBQ0FRQUFDYUJRQWdFUUFBbXdVQUlCSUFBSndGQUNEaUFRRUFBQUFCNVFGQUFBQUFBZkVCQVFBQUFBSHlBUUVBQUFBQjh3RUJBQUFBQWZRQkFRQUFBQUgxQVFFQUFBQUI5Z0VCQUFBQUFmZ0JBQUFBLUFFQy1nRUFBQUQ2QVFMOEFRQUFBUHdCQXYwQklBQUFBQUgtQVNBQUFBQUJfd0VDQUFBQUFZQUNRQUFBQUFFQ0FBQUFud0lBSUNNQUFPY0ZBQ0FEQUFBQW9nSUFJQ01BQU9jRkFDQWtBQURyQlFBZ0dBQUFBS0lDQUNBREFBRE9Bd0FnQ3dBQXp3TUFJQXdBQU5BREFDQVBBQURTQXdBZ0VBQUEwd01BSUJFQUFOUURBQ0FTQUFEVkF3QWdIQUFBNndVQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoOHdFQkFNZ0RBQ0gwQVFFQXlBTUFJZlVCQVFESUF3QWg5Z0VCQU1nREFDSDRBUUFBeVFQNEFTTDZBUUFBeWdQNkFTTDhBUUFBeXdQOEFTTDlBU0FBekFNQUlmNEJJQURNQXdBaF93RUNBTTBEQUNHQUFrQUF2UU1BSVJZREFBRE9Bd0FnQ3dBQXp3TUFJQXdBQU5BREFDQVBBQURTQXdBZ0VBQUEwd01BSUJFQUFOUURBQ0FTQUFEVkF3QWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaER1SUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ05BZ0wtQVNBQUFBQUJnQUpBQUFBQUFZUUNBUUFBQUFHRkFnRUFBQUFCaGdJQkFBQUFBWWNDQVFBQUFBR0lBaEFBQUFBQmlRSUNBQUFBQVlvQ0NBQUFBQUdMQWdBQWtBVUFJSTRDQVFBQUFBRVdBd0FBbFFVQUlBc0FBSllGQUNBTUFBQ1hCUUFnRGdBQW1BVUFJQThBQUprRkFDQVJBQUNiQlFBZ0VnQUFuQVVBSU9JQkFRQUFBQUhsQVVBQUFBQUI4UUVCQUFBQUFmSUJBUUFBQUFIekFRRUFBQUFCOUFFQkFBQUFBZlVCQVFBQUFBSDJBUUVBQUFBQi1BRUFBQUQ0QVFMNkFRQUFBUG9CQXZ3QkFBQUFfQUVDX1FFZ0FBQUFBZjRCSUFBQUFBSF9BUUlBQUFBQmdBSkFBQUFBQVFJQUFBQ2ZBZ0FnSXdBQTdRVUFJQU1BQUFDaUFnQWdJd0FBN1FVQUlDUUFBUEVGQUNBWUFBQUFvZ0lBSUFNQUFNNERBQ0FMQUFEUEF3QWdEQUFBMEFNQUlBNEFBTkVEQUNBUEFBRFNBd0FnRVFBQTFBTUFJQklBQU5VREFDQWNBQUR4QlFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoRmdNQUFNNERBQ0FMQUFEUEF3QWdEQUFBMEFNQUlBNEFBTkVEQUNBUEFBRFNBd0FnRVFBQTFBTUFJQklBQU5VREFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFTEJ3QUFqZ1VBSUFnQUFOd0VBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3ZBZ0tBQWtBQUFBQUJxd0pBQUFBQUFhd0NBZ0FBQUFHdEFoQUFBQUFCQWdBQUFBc0FJQ01BQVBJRkFDQURBQUFBQ1FBZ0l3QUE4Z1VBSUNRQUFQWUZBQ0FOQUFBQUNRQWdCd0FBakFVQUlBZ0FBTXdFQUNBY0FBRDJCUUFnNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVFCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBeWdTdkFpS0FBa0FBdlFNQUlhc0NRQUM5QXdBaHJBSUNBTTBEQUNHdEFoQUF5UVFBSVFzSEFBQ01CUUFnQ0FBQXpBUUFJT0lCQVFDOEF3QWg0d0VCQUx3REFDSGtBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBTW9FcndJaWdBSkFBTDBEQUNHckFrQUF2UU1BSWF3Q0FnRE5Bd0FoclFJUUFNa0VBQ0VXQXdBQWxRVUFJQXNBQUpZRkFDQU1BQUNYQlFBZ0RnQUFtQVVBSUE4QUFKa0ZBQ0FRQUFDYUJRQWdFUUFBbXdVQUlPSUJBUUFBQUFIbEFVQUFBQUFCOFFFQkFBQUFBZklCQVFBQUFBSHpBUUVBQUFBQjlBRUJBQUFBQWZVQkFRQUFBQUgyQVFFQUFBQUItQUVBQUFENEFRTDZBUUFBQVBvQkF2d0JBQUFBX0FFQ19RRWdBQUFBQWY0QklBQUFBQUhfQVFJQUFBQUJnQUpBQUFBQUFRSUFBQUNmQWdBZ0l3QUE5d1VBSUFNQUFBQ2lBZ0FnSXdBQTl3VUFJQ1FBQVBzRkFDQVlBQUFBb2dJQUlBTUFBTTREQUNBTEFBRFBBd0FnREFBQTBBTUFJQTRBQU5FREFDQVBBQURTQXdBZ0VBQUEwd01BSUJFQUFOUURBQ0FjQUFEN0JRQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaEZnTUFBTTREQUNBTEFBRFBBd0FnREFBQTBBTUFJQTRBQU5FREFDQVBBQURTQXdBZ0VBQUEwd01BSUJFQUFOUURBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDSHlBUUVBdkFNQUlmTUJBUURJQXdBaDlBRUJBTWdEQUNIMUFRRUF5QU1BSWZZQkFRRElBd0FoLUFFQUFNa0QtQUVpLWdFQUFNb0QtZ0VpX0FFQUFNc0RfQUVpX1FFZ0FNd0RBQ0gtQVNBQXpBTUFJZjhCQWdETkF3QWhnQUpBQUwwREFDRVdDd0FBbGdVQUlBd0FBSmNGQUNBT0FBQ1lCUUFnRHdBQW1RVUFJQkFBQUpvRkFDQVJBQUNiQlFBZ0VnQUFuQVVBSU9JQkFRQUFBQUhsQVVBQUFBQUI4UUVCQUFBQUFmSUJBUUFBQUFIekFRRUFBQUFCOUFFQkFBQUFBZlVCQVFBQUFBSDJBUUVBQUFBQi1BRUFBQUQ0QVFMNkFRQUFBUG9CQXZ3QkFBQUFfQUVDX1FFZ0FBQUFBZjRCSUFBQUFBSF9BUUlBQUFBQmdBSkFBQUFBQVFJQUFBQ2ZBZ0FnSXdBQV9BVUFJQU1BQUFDaUFnQWdJd0FBX0FVQUlDUUFBSUFHQUNBWUFBQUFvZ0lBSUFzQUFNOERBQ0FNQUFEUUF3QWdEZ0FBMFFNQUlBOEFBTklEQUNBUUFBRFRBd0FnRVFBQTFBTUFJQklBQU5VREFDQWNBQUNBQmdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoRmdzQUFNOERBQ0FNQUFEUUF3QWdEZ0FBMFFNQUlBOEFBTklEQUNBUUFBRFRBd0FnRVFBQTFBTUFJQklBQU5VREFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFRjRnRUJBQUFBQWVVQlFBQUFBQUh4QVFFQUFBQUJnQUpBQUFBQUFZVUNBUUFBQUFFQ0FBQUFmd0FnSXdBQWdRWUFJQllEQUFDVkJRQWdEQUFBbHdVQUlBNEFBSmdGQUNBUEFBQ1pCUUFnRUFBQW1nVUFJQkVBQUpzRkFDQVNBQUNjQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUh4QVFFQUFBQUI4Z0VCQUFBQUFmTUJBUUFBQUFIMEFRRUFBQUFCOVFFQkFBQUFBZllCQVFBQUFBSDRBUUFBQVBnQkF2b0JBQUFBLWdFQ19BRUFBQUQ4QVFMOUFTQUFBQUFCX2dFZ0FBQUFBZjhCQWdBQUFBR0FBa0FBQUFBQkFnQUFBSjhDQUNBakFBQ0RCZ0FnQXdBQUFLSUNBQ0FqQUFDREJnQWdKQUFBaHdZQUlCZ0FBQUNpQWdBZ0F3QUF6Z01BSUF3QUFOQURBQ0FPQUFEUkF3QWdEd0FBMGdNQUlCQUFBTk1EQUNBUkFBRFVBd0FnRWdBQTFRTUFJQndBQUljR0FDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFV0F3QUF6Z01BSUF3QUFOQURBQ0FPQUFEUkF3QWdEd0FBMGdNQUlCQUFBTk1EQUNBUkFBRFVBd0FnRWdBQTFRTUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaDh3RUJBTWdEQUNIMEFRRUF5QU1BSWZVQkFRRElBd0FoOWdFQkFNZ0RBQ0g0QVFBQXlRUDRBU0w2QVFBQXlnUDZBU0w4QVFBQXl3UDhBU0w5QVNBQXpBTUFJZjRCSUFETUF3QWhfd0VDQU0wREFDR0FBa0FBdlFNQUlRamlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFLOENBb0FDUUFBQUFBR3JBa0FBQUFBQnJBSUNBQUFBQWEwQ0VBQUFBQUVXQXdBQWxRVUFJQXNBQUpZRkFDQU9BQUNZQlFBZ0R3QUFtUVVBSUJBQUFKb0ZBQ0FSQUFDYkJRQWdFZ0FBbkFVQUlPSUJBUUFBQUFIbEFVQUFBQUFCOFFFQkFBQUFBZklCQVFBQUFBSHpBUUVBQUFBQjlBRUJBQUFBQWZVQkFRQUFBQUgyQVFFQUFBQUItQUVBQUFENEFRTDZBUUFBQVBvQkF2d0JBQUFBX0FFQ19RRWdBQUFBQWY0QklBQUFBQUhfQVFJQUFBQUJnQUpBQUFBQUFRSUFBQUNmQWdBZ0l3QUFpUVlBSUFNQUFBQ2lBZ0FnSXdBQWlRWUFJQ1FBQUkwR0FDQVlBQUFBb2dJQUlBTUFBTTREQUNBTEFBRFBBd0FnRGdBQTBRTUFJQThBQU5JREFDQVFBQURUQXdBZ0VRQUExQU1BSUJJQUFOVURBQ0FjQUFDTkJnQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaEZnTUFBTTREQUNBTEFBRFBBd0FnRGdBQTBRTUFJQThBQU5JREFDQVFBQURUQXdBZ0VRQUExQU1BSUJJQUFOVURBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDSHlBUUVBdkFNQUlmTUJBUURJQXdBaDlBRUJBTWdEQUNIMUFRRUF5QU1BSWZZQkFRRElBd0FoLUFFQUFNa0QtQUVpLWdFQUFNb0QtZ0VpX0FFQUFNc0RfQUVpX1FFZ0FNd0RBQ0gtQVNBQXpBTUFJZjhCQWdETkF3QWhnQUpBQUwwREFDRUg0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCX2dFZ0FBQUFBWUFDUUFBQUFBR0tBZ0lBQUFBQmtnSUJBQUFBQVFQaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBRURBQUFBZ2dFQUlDTUFBSUVHQUNBa0FBQ1NCZ0FnQndBQUFJSUJBQ0FjQUFDU0JnQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaGdBSkFBTDBEQUNHRkFnRUF2QU1BSVFYaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0dBQWtBQXZRTUFJWVVDQVFDOEF3QWhEdUlCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNOQWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQmhnSUJBQUFBQVljQ0FRQUFBQUdJQWhBQUFBQUJpUUlDQUFBQUFZb0NDQUFBQUFHTEFnQUFrQVVBSUkwQ0FRQUFBQUVUQlFBQWtRVUFJQVlBQUtzRkFDQU1BQUNUQlFBZ0RRQUFsQVVBSU9JQkFRQUFBQUhsQVVBQUFBQUItZ0VBQUFDTkFnTC1BU0FBQUFBQmdBSkFBQUFBQVlRQ0FRQUFBQUdGQWdFQUFBQUJoZ0lCQUFBQUFZY0NBUUFBQUFHSUFoQUFBQUFCaVFJQ0FBQUFBWW9DQ0FBQUFBR0xBZ0FBa0FVQUlJMENBUUFBQUFHT0FnRUFBQUFCQWdBQUFBVUFJQ01BQUpRR0FDQVE0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSndDQW9BQ1FBQUFBQUdYQWdFQUFBQUJtQUlCQUFBQUFaa0NFQUFBQUFHYUFnRUFBQUFCbkFJQkFBQUFBWjBDQVFBQUFBR2VBZ0VBQUFBQm53SUJBQUFBQWFBQ1FBQUFBQUdoQWdFQUFBQUJvZ0pBQUFBQUFhTUNRQUFBQUFFREFBQUFBd0FnSXdBQWxBWUFJQ1FBQUprR0FDQVZBQUFBQXdBZ0JRQUE3QVFBSUFZQUFLb0ZBQ0FNQUFEdUJBQWdEUUFBN3dRQUlCd0FBSmtHQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFPb0VqUUlpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR0dBZ0VBdkFNQUlZY0NBUUM4QXdBaGlBSVFBTWtFQUNHSkFnSUF6UU1BSVlvQ0NBRG9CQUFoaXdJQUFPa0VBQ0NOQWdFQXZBTUFJWTRDQVFDOEF3QWhFd1VBQU93RUFDQUdBQUNxQlFBZ0RBQUE3Z1FBSUEwQUFPOEVBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQU9vRWpRSWlfZ0VnQU13REFDR0FBa0FBdlFNQUlZUUNBUUM4QXdBaGhRSUJBTHdEQUNHR0FnRUF2QU1BSVljQ0FRQzhBd0FoaUFJUUFNa0VBQ0dKQWdJQXpRTUFJWW9DQ0FEb0JBQWhpd0lBQU9rRUFDQ05BZ0VBdkFNQUlZNENBUUM4QXdBaENPSUJBUUFBQUFIa0FRRUFBQUFCNVFGQUFBQUFBZm9CQUFBQXJ3SUNnQUpBQUFBQUFhc0NRQUFBQUFHc0FnSUFBQUFCclFJUUFBQUFBUk1GQUFDUkJRQWdCZ0FBcXdVQUlBc0FBSklGQUNBTkFBQ1VCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSDZBUUFBQUkwQ0F2NEJJQUFBQUFHQUFrQUFBQUFCaEFJQkFBQUFBWVVDQVFBQUFBR0dBZ0VBQUFBQmh3SUJBQUFBQVlnQ0VBQUFBQUdKQWdJQUFBQUJpZ0lJQUFBQUFZc0NBQUNRQlFBZ2pRSUJBQUFBQVk0Q0FRQUFBQUVDQUFBQUJRQWdJd0FBbXdZQUlBTUFBQUFEQUNBakFBQ2JCZ0FnSkFBQW53WUFJQlVBQUFBREFDQUZBQURzQkFBZ0JnQUFxZ1VBSUFzQUFPMEVBQ0FOQUFEdkJBQWdIQUFBbndZQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUE2Z1NOQWlMLUFTQUF6QU1BSVlBQ1FBQzlBd0FoaEFJQkFMd0RBQ0dGQWdFQXZBTUFJWVlDQVFDOEF3QWhod0lCQUx3REFDR0lBaEFBeVFRQUlZa0NBZ0ROQXdBaGlnSUlBT2dFQUNHTEFnQUE2UVFBSUkwQ0FRQzhBd0FoamdJQkFMd0RBQ0VUQlFBQTdBUUFJQVlBQUtvRkFDQUxBQUR0QkFBZ0RRQUE3d1FBSU9JQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTZnU05BaUwtQVNBQXpBTUFJWUFDUUFDOUF3QWhoQUlCQUx3REFDR0ZBZ0VBdkFNQUlZWUNBUUM4QXdBaGh3SUJBTHdEQUNHSUFoQUF5UVFBSVlrQ0FnRE5Bd0FoaWdJSUFPZ0VBQ0dMQWdBQTZRUUFJSTBDQVFDOEF3QWhqZ0lCQUx3REFDRUg0Z0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCX2dFZ0FBQUFBWUFDUUFBQUFBR0tBZ0lBQUFBQmtnSUJBQUFBQVFmaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQWJBQ0FRQUFBQUcxQWdFQUFBQUJDdUlCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN6QWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQnJ3SUJBQUFBQWJBQ0FRQUFBQUd4QWdFQUFBQUJBLUlCQVFBQUFBSGtBUUVBQUFBQjVRRkFBQUFBQVFmaUFRRUFBQUFCNVFGQUFBQUFBWVFDQVFBQUFBR2xBZ0FBQUtVQ0FxWUNBUUFBQUFHbkFnRUFBQUFCcUFJZ0FBQUFBUXNIQUFEOEF3QWdGQUFBLXdNQUlCVUFBUDhEQUNEaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQWJBQ0FRQUFBQUcwQWdFQUFBQUJ0UUlCQUFBQUFRSUFBQUFCQUNBakFBQ2xCZ0FnRmdNQUFKVUZBQ0FMQUFDV0JRQWdEQUFBbHdVQUlBNEFBSmdGQUNBUEFBQ1pCUUFnRUFBQW1nVUFJQklBQUp3RkFDRGlBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUh5QVFFQUFBQUI4d0VCQUFBQUFmUUJBUUFBQUFIMUFRRUFBQUFCOWdFQkFBQUFBZmdCQUFBQS1BRUMtZ0VBQUFENkFRTDhBUUFBQVB3QkF2MEJJQUFBQUFILUFTQUFBQUFCX3dFQ0FBQUFBWUFDUUFBQUFBRUNBQUFBbndJQUlDTUFBS2NHQUNBTUV3QUEzQVVBSU9JQkFRQUFBQUhsQVVBQUFBQUItZ0VBQUFDekFnTC1BU0FBQUFBQmdBSkFBQUFBQVlRQ0FRQUFBQUdGQWdFQUFBQUJyd0lCQUFBQUFiQUNBUUFBQUFHeEFnRUFBQUFCc3dJQkFBQUFBUUlBQUFBaEFDQWpBQUNwQmdBZ0F3QUFBS0lDQUNBakFBQ25CZ0FnSkFBQXJRWUFJQmdBQUFDaUFnQWdBd0FBemdNQUlBc0FBTThEQUNBTUFBRFFBd0FnRGdBQTBRTUFJQThBQU5JREFDQVFBQURUQXdBZ0VnQUExUU1BSUJ3QUFLMEdBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDSHlBUUVBdkFNQUlmTUJBUURJQXdBaDlBRUJBTWdEQUNIMUFRRUF5QU1BSWZZQkFRRElBd0FoLUFFQUFNa0QtQUVpLWdFQUFNb0QtZ0VpX0FFQUFNc0RfQUVpX1FFZ0FNd0RBQ0gtQVNBQXpBTUFJZjhCQWdETkF3QWhnQUpBQUwwREFDRVdBd0FBemdNQUlBc0FBTThEQUNBTUFBRFFBd0FnRGdBQTBRTUFJQThBQU5JREFDQVFBQURUQXdBZ0VnQUExUU1BSU9JQkFRQzhBd0FoNVFGQUFMMERBQ0h4QVFFQXZBTUFJZklCQVFDOEF3QWg4d0VCQU1nREFDSDBBUUVBeUFNQUlmVUJBUURJQXdBaDlnRUJBTWdEQUNINEFRQUF5UVA0QVNMNkFRQUF5Z1A2QVNMOEFRQUF5d1A4QVNMOUFTQUF6QU1BSWY0QklBRE1Bd0FoX3dFQ0FNMERBQ0dBQWtBQXZRTUFJUWZpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBYkFDQVFBQUFBRzBBZ0VBQUFBQkF3QUFBQ2dBSUNNQUFLVUdBQ0FrQUFDeEJnQWdEUUFBQUNnQUlBY0FBUGtEQUNBVUFBRHVBd0FnRlFBQTd3TUFJQndBQUxFR0FDRGlBUUVBdkFNQUllTUJBUUM4QXdBaDVRRkFBTDBEQUNILUFTQUF6QU1BSVlBQ1FBQzlBd0Foc0FJQkFMd0RBQ0cwQWdFQXZBTUFJYlVDQVFESUF3QWhDd2NBQVBrREFDQVVBQUR1QXdBZ0ZRQUE3d01BSU9JQkFRQzhBd0FoNHdFQkFMd0RBQ0hsQVVBQXZRTUFJZjRCSUFETUF3QWhnQUpBQUwwREFDR3dBZ0VBdkFNQUliUUNBUUM4QXdBaHRRSUJBTWdEQUNFREFBQUFId0FnSXdBQXFRWUFJQ1FBQUxRR0FDQU9BQUFBSHdBZ0V3QUEyd1VBSUJ3QUFMUUdBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQUtNRXN3SWlfZ0VnQU13REFDR0FBa0FBdlFNQUlZUUNBUUM4QXdBaGhRSUJBTHdEQUNHdkFnRUF2QU1BSWJBQ0FRQzhBd0Foc1FJQkFMd0RBQ0d6QWdFQXZBTUFJUXdUQUFEYkJRQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmb0JBQUNqQkxNQ0l2NEJJQURNQXdBaGdBSkFBTDBEQUNHRUFnRUF2QU1BSVlVQ0FRQzhBd0FocndJQkFMd0RBQ0d3QWdFQXZBTUFJYkVDQVFDOEF3QWhzd0lCQUx3REFDRUg0Z0VCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBYkFDQVFBQUFBRzBBZ0VBQUFBQnRRSUJBQUFBQVFYaUFRRUFBQUFCNVFGQUFBQUFBWk1DQVFBQUFBR1VBa0FBQUFBQmxRSkFBQUFBQVJNRkFBQ1JCUUFnQmdBQXF3VUFJQXNBQUpJRkFDQU1BQUNUQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFJMENBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUdHQWdFQUFBQUJod0lCQUFBQUFZZ0NFQUFBQUFHSkFnSUFBQUFCaWdJSUFBQUFBWXNDQUFDUUJRQWdqUUlCQUFBQUFZNENBUUFBQUFFQ0FBQUFCUUFnSXdBQXR3WUFJQllEQUFDVkJRQWdDd0FBbGdVQUlBd0FBSmNGQUNBT0FBQ1lCUUFnRUFBQW1nVUFJQkVBQUpzRkFDQVNBQUNjQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUh4QVFFQUFBQUI4Z0VCQUFBQUFmTUJBUUFBQUFIMEFRRUFBQUFCOVFFQkFBQUFBZllCQVFBQUFBSDRBUUFBQVBnQkF2b0JBQUFBLWdFQ19BRUFBQUQ4QVFMOUFTQUFBQUFCX2dFZ0FBQUFBZjhCQWdBQUFBR0FBa0FBQUFBQkFnQUFBSjhDQUNBakFBQzVCZ0FnQXdBQUFBTUFJQ01BQUxjR0FDQWtBQUM5QmdBZ0ZRQUFBQU1BSUFVQUFPd0VBQ0FHQUFDcUJRQWdDd0FBN1FRQUlBd0FBTzRFQUNBY0FBQzlCZ0FnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFEcUJJMENJdjRCSUFETUF3QWhnQUpBQUwwREFDR0VBZ0VBdkFNQUlZVUNBUUM4QXdBaGhnSUJBTHdEQUNHSEFnRUF2QU1BSVlnQ0VBREpCQUFoaVFJQ0FNMERBQ0dLQWdnQTZBUUFJWXNDQUFEcEJBQWdqUUlCQUx3REFDR09BZ0VBdkFNQUlSTUZBQURzQkFBZ0JnQUFxZ1VBSUFzQUFPMEVBQ0FNQUFEdUJBQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmb0JBQURxQkkwQ0l2NEJJQURNQXdBaGdBSkFBTDBEQUNHRUFnRUF2QU1BSVlVQ0FRQzhBd0FoaGdJQkFMd0RBQ0dIQWdFQXZBTUFJWWdDRUFESkJBQWhpUUlDQU0wREFDR0tBZ2dBNkFRQUlZc0NBQURwQkFBZ2pRSUJBTHdEQUNHT0FnRUF2QU1BSVFNQUFBQ2lBZ0FnSXdBQXVRWUFJQ1FBQU1BR0FDQVlBQUFBb2dJQUlBTUFBTTREQUNBTEFBRFBBd0FnREFBQTBBTUFJQTRBQU5FREFDQVFBQURUQXdBZ0VRQUExQU1BSUJJQUFOVURBQ0FjQUFEQUJnQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaEZnTUFBTTREQUNBTEFBRFBBd0FnREFBQTBBTUFJQTRBQU5FREFDQVFBQURUQXdBZ0VRQUExQU1BSUJJQUFOVURBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDSHlBUUVBdkFNQUlmTUJBUURJQXdBaDlBRUJBTWdEQUNIMUFRRUF5QU1BSWZZQkFRRElBd0FoLUFFQUFNa0QtQUVpLWdFQUFNb0QtZ0VpX0FFQUFNc0RfQUVpX1FFZ0FNd0RBQ0gtQVNBQXpBTUFJZjhCQWdETkF3QWhnQUpBQUwwREFDRUZCQUFSQndBREZBQUNGVGtCRmpvQkF3UUFFQkUzQVJNQUF3a0RCZ1FFQUE4TEhRY01IZ29PSWdJUEl3c1FKdzBSS2dFU0xnNEdCQUFNQlFBRkJnQURDd3dIREJVS0RSa0xBZ01IQkFRQUJnRURDQUFFQkFBSkJ3QURDQUFFQ2hBSUFRa0FCd0VLRVFBQ0J3QURDQUFFQWdjQUF3Z0FCQU1MR2dBTUd3QU5IQUFCQndBREFRY0FBd2dETHdBTE1BQU1NUUFPTWdBUE13QVFOQUFSTlFBU05nQUJFVGdBQVJZN0FBQURCd0FERkFBQ0ZVVUJBd2NBQXhRQUFoVkxBUU1FQUJZcEFCY3FBQmdBQUFBREJBQVdLUUFYS2dBWUFSTUFBd0VUQUFNREJBQWRLUUFlS2dBZkFBQUFBd1FBSFNrQUhpb0FId0lIQUFNSUFBUUNCd0FEQ0FBRUJRUUFKQ2tBSnlvQUtFc0FKVXdBSmdBQUFBQUFCUVFBSkNrQUp5b0FLRXNBSlV3QUpnQUFBd1FBTFNrQUxpb0FMd0FBQUFNRUFDMHBBQzRxQUM4QUFBQURCQUExS1FBMktnQTNBQUFBQXdRQU5Ta0FOaW9BTndFSEFBTUJCd0FEQXdRQVBDa0FQU29BUGdBQUFBTUVBRHdwQUQwcUFENEJDUUFIQVFrQUJ3VUVBRU1wQUVZcUFFZExBRVJNQUVVQUFBQUFBQVVFQUVNcEFFWXFBRWRMQUVSTUFFVUJCd0FEQVFjQUF3TUVBRXdwQUUwcUFFNEFBQUFEQkFCTUtRQk5LZ0JPQWdjQUF3Z0FCQUlIQUFNSUFBUUZCQUJUS1FCV0tnQlhTd0JVVEFCVkFBQUFBQUFGQkFCVEtRQldLZ0JYU3dCVVRBQlZBZ1VBQlFZQUF3SUZBQVVHQUFNRkJBQmNLUUJmS2dCZ1N3QmRUQUJlQUFBQUFBQUZCQUJjS1FCZktnQmdTd0JkVEFCZUFBQUZCQUJsS1FCb0tnQnBTd0JtVEFCbkFBQUFBQUFGQkFCbEtRQm9LZ0JwU3dCbVRBQm5BZ2NBQXdnQUJBSUhBQU1JQUFRREJBQnVLUUJ2S2dCd0FBQUFBd1FBYmlrQWJ5b0FjQmNDQVJnOEFSazlBUm8tQVJzX0FSMUJBUjVERWg5RUV5QkhBU0ZKRWlKS0ZDVk1BU1pOQVNkT0VpdFJGU3hTR1MxVEFpNVVBaTlWQWpCV0FqRlhBakpaQWpOYkVqUmNHalZlQWpaZ0VqZGhHemhpQWpsakFqcGtFanRuSER4b0lEMXBCejVxQno5ckIwQnNCMEZ0QjBKdkIwTnhFa1J5SVVWMEIwWjJFa2QzSWtoNEIwbDVCMHA2RWsxOUkwNS1LVS1BQVFWUWdRRUZVWVFCQlZLRkFRVlRoZ0VGVklnQkJWV0tBUkpXaXdFcVY0MEJCVmlQQVJKWmtBRXJXcEVCQlZ1U0FRVmNrd0VTWFpZQkxGNlhBVEJmbVFFeFlKb0JNV0dkQVRGaW5nRXhZNThCTVdTaEFURmxvd0VTWnFRQk1tZW1BVEZvcUFFU2Fha0JNMnFxQVRGcnF3RXhiS3dCRW0ydkFUUnVzQUU0YjdFQkRYQ3lBUTF4c3dFTmNyUUJEWE8xQVExMHR3RU5kYmtCRW5hNkFUbDN2QUVOZUw0QkVubV9BVHA2d0FFTmU4RUJEWHpDQVJKOXhRRTdmc1lCUDNfSEFRaUFBY2dCQ0lFQnlRRUlnZ0hLQVFpREFjc0JDSVFCelFFSWhRSFBBUktHQWRBQlFJY0IwZ0VJaUFIVUFSS0pBZFVCUVlvQjFnRUlpd0hYQVFpTUFkZ0JFbzBCMndGQ2pnSGNBVWlQQWQwQkRwQUIzZ0VPa1FIZkFRNlNBZUFCRHBNQjRRRU9sQUhqQVE2VkFlVUJFcFlCNWdGSmx3SG9BUTZZQWVvQkVwa0I2d0ZLbWdIc0FRNmJBZTBCRHB3QjdnRVNuUUh4QVV1ZUFmSUJUNThCOHdFS29BSDBBUXFoQWZVQkNxSUI5Z0VLb3dIM0FRcWtBZmtCQ3FVQi13RVNwZ0g4QVZDbkFmNEJDcWdCZ0FJU3FRR0JBbEdxQVlJQ0Nxc0Jnd0lLckFHRUFoS3RBWWNDVXE0QmlBSllyd0dKQWdTd0FZb0NCTEVCaXdJRXNnR01BZ1N6QVkwQ0JMUUJqd0lFdFFHUkFoSzJBWklDV2JjQmxBSUV1QUdXQWhLNUFaY0NXcm9CbUFJRXV3R1pBZ1M4QVpvQ0VyMEJuUUpidmdHZUFtR19BYUFDQThBQm9RSUR3UUdrQWdQQ0FhVUNBOE1CcGdJRHhBR29BZ1BGQWFvQ0VzWUJxd0ppeHdHdEFnUElBYThDRXNrQnNBSmp5Z0d4QWdQTEFiSUNBOHdCc3dJU3pRRzJBbVRPQWJjQ2FzOEJ1QUlMMEFHNUFndlJBYm9DQzlJQnV3SUwwd0c4QWd2VUFiNENDOVVCd0FJUzFnSEJBbXZYQWNNQ0M5Z0J4UUlTMlFIR0FtemFBY2NDQzlzQnlBSUwzQUhKQWhMZEFjd0NiZDRCelFKeFwiXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRlY29kZUJhc2U2NEFzV2FzbSh3YXNtQmFzZTY0OiBzdHJpbmcpOiBQcm9taXNlPFdlYkFzc2VtYmx5Lk1vZHVsZT4ge1xuICBjb25zdCB7IEJ1ZmZlciB9ID0gYXdhaXQgaW1wb3J0KCdub2RlOmJ1ZmZlcicpXG4gIGNvbnN0IHdhc21BcnJheSA9IEJ1ZmZlci5mcm9tKHdhc21CYXNlNjQsICdiYXNlNjQnKVxuICByZXR1cm4gbmV3IFdlYkFzc2VtYmx5Lk1vZHVsZSh3YXNtQXJyYXkpXG59XG5cbmNvbmZpZy5jb21waWxlcldhc20gPSB7XG4gIGdldFJ1bnRpbWU6IGFzeW5jICgpID0+IGF3YWl0IGltcG9ydChcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvcXVlcnlfY29tcGlsZXJfZmFzdF9iZy5wb3N0Z3Jlc3FsLm1qc1wiKSxcblxuICBnZXRRdWVyeUNvbXBpbGVyV2FzbU1vZHVsZTogYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHsgd2FzbSB9ID0gYXdhaXQgaW1wb3J0KFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9xdWVyeV9jb21waWxlcl9mYXN0X2JnLnBvc3RncmVzcWwud2FzbS1iYXNlNjQubWpzXCIpXG4gICAgcmV0dXJuIGF3YWl0IGRlY29kZUJhc2U2NEFzV2FzbSh3YXNtKVxuICB9LFxuXG4gIGltcG9ydE5hbWU6IFwiLi9xdWVyeV9jb21waWxlcl9mYXN0X2JnLmpzXCJcbn1cblxuXG5cbmV4cG9ydCB0eXBlIExvZ09wdGlvbnM8Q2xpZW50T3B0aW9ucyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zPiA9XG4gICdsb2cnIGV4dGVuZHMga2V5b2YgQ2xpZW50T3B0aW9ucyA/IENsaWVudE9wdGlvbnNbJ2xvZyddIGV4dGVuZHMgQXJyYXk8UHJpc21hLkxvZ0xldmVsIHwgUHJpc21hLkxvZ0RlZmluaXRpb24+ID8gUHJpc21hLkdldEV2ZW50czxDbGllbnRPcHRpb25zWydsb2cnXT4gOiBuZXZlciA6IG5ldmVyXG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50Q29uc3RydWN0b3Ige1xuICAgIC8qKlxuICAgKiAjIyBQcmlzbWEgQ2xpZW50XG4gICAqIFxuICAgKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAgICogICBhZGFwdGVyOiBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAgICogfSlcbiAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dDb21tZW50c1xuICAgKiBjb25zdCBibG9nQ29tbWVudHMgPSBhd2FpdCBwcmlzbWEuYmxvZ0NvbW1lbnQuZmluZE1hbnkoKVxuICAgKiBgYGBcbiAgICogXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2NsaWVudCkuXG4gICAqL1xuXG4gIG5ldyA8XG4gICAgT3B0aW9ucyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnMsXG4gICAgTG9nT3B0cyBleHRlbmRzIExvZ09wdGlvbnM8T3B0aW9ucz4gPSBMb2dPcHRpb25zPE9wdGlvbnM+LFxuICAgIE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSA9IE9wdGlvbnMgZXh0ZW5kcyB7IG9taXQ6IGluZmVyIFUgfSA/IFUgOiBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddLFxuICAgIEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzXG4gID4ob3B0aW9uczogUHJpc21hLlByaXNtYUNsaWVudENvbnN0cnVjdG9yQXJnczxPcHRpb25zPik6IFByaXNtYUNsaWVudDxMb2dPcHRzLCBPbWl0T3B0cywgRXh0QXJncz5cbn1cblxuLyoqXG4gKiAjIyBQcmlzbWEgQ2xpZW50XG4gKiBcbiAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICogICBhZGFwdGVyOiBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAqIH0pXG4gKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ0NvbW1lbnRzXG4gKiBjb25zdCBibG9nQ29tbWVudHMgPSBhd2FpdCBwcmlzbWEuYmxvZ0NvbW1lbnQuZmluZE1hbnkoKVxuICogYGBgXG4gKiBcbiAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2NsaWVudCkuXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnQ8XG4gIGluIExvZ09wdHMgZXh0ZW5kcyBQcmlzbWEuTG9nTGV2ZWwgPSBuZXZlcixcbiAgaW4gb3V0IE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSA9IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10sXG4gIGluIG91dCBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJnc1xuPiB7XG4gIFtLOiBzeW1ib2xdOiB7IHR5cGVzOiBQcmlzbWEuVHlwZU1hcDxFeHRBcmdzPlsnb3RoZXInXSB9XG5cbiAgJG9uPFYgZXh0ZW5kcyBMb2dPcHRzPihldmVudFR5cGU6IFYsIGNhbGxiYWNrOiAoZXZlbnQ6IFYgZXh0ZW5kcyAncXVlcnknID8gUHJpc21hLlF1ZXJ5RXZlbnQgOiBQcmlzbWEuTG9nRXZlbnQpID0+IHZvaWQpOiBQcmlzbWFDbGllbnQ7XG5cbiAgLyoqXG4gICAqIENvbm5lY3Qgd2l0aCB0aGUgZGF0YWJhc2VcbiAgICovXG4gICRjb25uZWN0KCk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPHZvaWQ+O1xuXG4gIC8qKlxuICAgKiBEaXNjb25uZWN0IGZyb20gdGhlIGRhdGFiYXNlXG4gICAqL1xuICAkZGlzY29ubmVjdCgpOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTx2b2lkPjtcblxuLyoqXG4gICAqIEV4ZWN1dGVzIGEgcHJlcGFyZWQgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWQgcm93cy5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kZXhlY3V0ZVJhd2BVUERBVEUgVXNlciBTRVQgY29vbCA9ICR7dHJ1ZX0gV0hFUkUgZW1haWwgPSAkeyd1c2VyQGVtYWlsLmNvbSd9O2BcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRleGVjdXRlUmF3PFQgPSB1bmtub3duPihxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBQcmlzbWEuU3FsLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8bnVtYmVyPjtcblxuICAvKipcbiAgICogRXhlY3V0ZXMgYSByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIG51bWJlciBvZiBhZmZlY3RlZCByb3dzLlxuICAgKiBTdXNjZXB0aWJsZSB0byBTUUwgaW5qZWN0aW9ucywgc2VlIGRvY3VtZW50YXRpb24uXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJGV4ZWN1dGVSYXdVbnNhZmUoJ1VQREFURSBVc2VyIFNFVCBjb29sID0gJDEgV0hFUkUgZW1haWwgPSAkMiA7JywgdHJ1ZSwgJ3VzZXJAZW1haWwuY29tJylcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRleGVjdXRlUmF3VW5zYWZlPFQgPSB1bmtub3duPihxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8bnVtYmVyPjtcblxuICAvKipcbiAgICogUGVyZm9ybXMgYSBwcmVwYXJlZCByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIGBTRUxFQ1RgIGRhdGEuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3YFNFTEVDVCAqIEZST00gVXNlciBXSEVSRSBpZCA9ICR7MX0gT1IgZW1haWwgPSAkeyd1c2VyQGVtYWlsLmNvbSd9O2BcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRxdWVyeVJhdzxUID0gdW5rbm93bj4ocXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgUHJpc21hLlNxbCwgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPFQ+O1xuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBhIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgYFNFTEVDVGAgZGF0YS5cbiAgICogU3VzY2VwdGlibGUgdG8gU1FMIGluamVjdGlvbnMsIHNlZSBkb2N1bWVudGF0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRxdWVyeVJhd1Vuc2FmZSgnU0VMRUNUICogRlJPTSBVc2VyIFdIRVJFIGlkID0gJDEgT1IgZW1haWwgPSAkMjsnLCAxLCAndXNlckBlbWFpbC5jb20nKVxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJHF1ZXJ5UmF3VW5zYWZlPFQgPSB1bmtub3duPihxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8VD47XG5cblxuICAvKipcbiAgICogQWxsb3dzIHRoZSBydW5uaW5nIG9mIGEgc2VxdWVuY2Ugb2YgcmVhZC93cml0ZSBvcGVyYXRpb25zIHRoYXQgYXJlIGd1YXJhbnRlZWQgdG8gZWl0aGVyIHN1Y2NlZWQgb3IgZmFpbCBhcyBhIHdob2xlLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgW2dlb3JnZSwgYm9iLCBhbGljZV0gPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKFtcbiAgICogICBwcmlzbWEudXNlci5jcmVhdGUoeyBkYXRhOiB7IG5hbWU6ICdHZW9yZ2UnIH0gfSksXG4gICAqICAgcHJpc21hLnVzZXIuY3JlYXRlKHsgZGF0YTogeyBuYW1lOiAnQm9iJyB9IH0pLFxuICAgKiAgIHByaXNtYS51c2VyLmNyZWF0ZSh7IGRhdGE6IHsgbmFtZTogJ0FsaWNlJyB9IH0pLFxuICAgKiBdKVxuICAgKiBgYGBcbiAgICogXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vd3d3LnByaXNtYS5pby9kb2NzL29ybS9wcmlzbWEtY2xpZW50L3F1ZXJpZXMvdHJhbnNhY3Rpb25zKS5cbiAgICovXG4gICR0cmFuc2FjdGlvbjxQIGV4dGVuZHMgUHJpc21hLlByaXNtYVByb21pc2U8YW55PltdPihhcmc6IFsuLi5QXSwgb3B0aW9ucz86IHsgbWF4V2FpdD86IG51bWJlciwgdGltZW91dD86IG51bWJlciwgaXNvbGF0aW9uTGV2ZWw/OiBQcmlzbWEuVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCB9KTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8cnVudGltZS5UeXBlcy5VdGlscy5VbndyYXBUdXBsZTxQPj5cblxuICAkdHJhbnNhY3Rpb248Uj4oZm46IChwcmlzbWE6IE9taXQ8UHJpc21hQ2xpZW50LCBydW50aW1lLklUWENsaWVudERlbnlMaXN0PikgPT4gcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8Uj4sIG9wdGlvbnM/OiB7IG1heFdhaXQ/OiBudW1iZXIsIHRpbWVvdXQ/OiBudW1iZXIsIGlzb2xhdGlvbkxldmVsPzogUHJpc21hLlRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgfSk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPFI+XG5cbiAgJGV4dGVuZHM6IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5FeHRlbmRzSG9vazxcImV4dGVuZHNcIiwgUHJpc21hLlR5cGVNYXBDYjxPbWl0T3B0cz4sIEV4dEFyZ3MsIHJ1bnRpbWUuVHlwZXMuVXRpbHMuQ2FsbDxQcmlzbWEuVHlwZU1hcENiPE9taXRPcHRzPiwge1xuICAgIGV4dEFyZ3M6IEV4dEFyZ3NcbiAgfT4+XG5cbiAgICAgIC8qKlxuICAgKiBgcHJpc21hLmJsb2dDb21tZW50YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkJsb2dDb21tZW50KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nQ29tbWVudHNcbiAgICAqIGNvbnN0IGJsb2dDb21tZW50cyA9IGF3YWl0IHByaXNtYS5ibG9nQ29tbWVudC5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgYmxvZ0NvbW1lbnQoKTogUHJpc21hLkJsb2dDb21tZW50RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5ibG9nUG9zdGA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipCbG9nUG9zdCoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ1Bvc3RzXG4gICAgKiBjb25zdCBibG9nUG9zdHMgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGJsb2dQb3N0KCk6IFByaXNtYS5CbG9nUG9zdERlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEuYm9va2luZ2A6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipCb29raW5nKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCb29raW5nc1xuICAgICogY29uc3QgYm9va2luZ3MgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgYm9va2luZygpOiBQcmlzbWEuQm9va2luZ0RlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEuY2F0ZWdvcnlgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQ2F0ZWdvcnkqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIENhdGVnb3JpZXNcbiAgICAqIGNvbnN0IGNhdGVnb3JpZXMgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGNhdGVnb3J5KCk6IFByaXNtYS5DYXRlZ29yeURlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEuY29udGFjdE1lc3NhZ2VgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQ29udGFjdE1lc3NhZ2UqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIENvbnRhY3RNZXNzYWdlc1xuICAgICogY29uc3QgY29udGFjdE1lc3NhZ2VzID0gYXdhaXQgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBjb250YWN0TWVzc2FnZSgpOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLm5vdGlmaWNhdGlvbmA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipOb3RpZmljYXRpb24qKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIE5vdGlmaWNhdGlvbnNcbiAgICAqIGNvbnN0IG5vdGlmaWNhdGlvbnMgPSBhd2FpdCBwcmlzbWEubm90aWZpY2F0aW9uLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBub3RpZmljYXRpb24oKTogUHJpc21hLk5vdGlmaWNhdGlvbkRlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEucGF5bWVudGA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipQYXltZW50KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBQYXltZW50c1xuICAgICogY29uc3QgcGF5bWVudHMgPSBhd2FpdCBwcmlzbWEucGF5bWVudC5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgcGF5bWVudCgpOiBQcmlzbWEuUGF5bWVudERlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEucmVmcmVzaFRva2VuYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlJlZnJlc2hUb2tlbioqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgUmVmcmVzaFRva2Vuc1xuICAgICogY29uc3QgcmVmcmVzaFRva2VucyA9IGF3YWl0IHByaXNtYS5yZWZyZXNoVG9rZW4uZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHJlZnJlc2hUb2tlbigpOiBQcmlzbWEuUmVmcmVzaFRva2VuRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5yZXZpZXdgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqUmV2aWV3KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBSZXZpZXdzXG4gICAgKiBjb25zdCByZXZpZXdzID0gYXdhaXQgcHJpc21hLnJldmlldy5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgcmV2aWV3KCk6IFByaXNtYS5SZXZpZXdEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnRvdXJQYWNrYWdlYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlRvdXJQYWNrYWdlKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBUb3VyUGFja2FnZXNcbiAgICAqIGNvbnN0IHRvdXJQYWNrYWdlcyA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgdG91clBhY2thZ2UoKTogUHJpc21hLlRvdXJQYWNrYWdlRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS51c2VyYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlVzZXIqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFVzZXJzXG4gICAgKiBjb25zdCB1c2VycyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCB1c2VyKCk6IFByaXNtYS5Vc2VyRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS53aXNobGlzdEl0ZW1gOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqV2lzaGxpc3RJdGVtKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBXaXNobGlzdEl0ZW1zXG4gICAgKiBjb25zdCB3aXNobGlzdEl0ZW1zID0gYXdhaXQgcHJpc21hLndpc2hsaXN0SXRlbS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgd2lzaGxpc3RJdGVtKCk6IFByaXNtYS5XaXNobGlzdEl0ZW1EZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJpc21hQ2xpZW50Q2xhc3MoKTogUHJpc21hQ2xpZW50Q29uc3RydWN0b3Ige1xuICByZXR1cm4gcnVudGltZS5nZXRQcmlzbWFDbGllbnQoY29uZmlnKSBhcyB1bmtub3duIGFzIFByaXNtYUNsaWVudENvbnN0cnVjdG9yXG59XG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4gKiBXQVJOSU5HOiBUaGlzIGlzIGFuIGludGVybmFsIGZpbGUgdGhhdCBpcyBzdWJqZWN0IHRvIGNoYW5nZSFcbiAqXG4gKiBcdUQ4M0RcdURFRDEgVW5kZXIgbm8gY2lyY3Vtc3RhbmNlcyBzaG91bGQgeW91IGltcG9ydCB0aGlzIGZpbGUgZGlyZWN0bHkhIFx1RDgzRFx1REVEMVxuICpcbiAqIEFsbCBleHBvcnRzIGZyb20gdGhpcyBmaWxlIGFyZSB3cmFwcGVkIHVuZGVyIGEgYFByaXNtYWAgbmFtZXNwYWNlIG9iamVjdCBpbiB0aGUgY2xpZW50LnRzIGZpbGUuXG4gKiBXaGlsZSB0aGlzIGVuYWJsZXMgcGFydGlhbCBiYWNrd2FyZCBjb21wYXRpYmlsaXR5LCBpdCBpcyBub3QgcGFydCBvZiB0aGUgc3RhYmxlIHB1YmxpYyBBUEkuXG4gKlxuICogSWYgeW91IGFyZSBsb29raW5nIGZvciB5b3VyIE1vZGVscywgRW51bXMsIGFuZCBJbnB1dCBUeXBlcywgcGxlYXNlIGltcG9ydCB0aGVtIGZyb20gdGhlIHJlc3BlY3RpdmVcbiAqIG1vZGVsIGZpbGVzIGluIHRoZSBgbW9kZWxgIGRpcmVjdG9yeSFcbiAqL1xuXG5pbXBvcnQgKiBhcyBydW50aW1lIGZyb20gXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL2NsaWVudFwiXG5pbXBvcnQgdHlwZSAqIGFzIFByaXNtYSBmcm9tIFwiLi4vbW9kZWxzXCJcbmltcG9ydCB7IHR5cGUgUHJpc21hQ2xpZW50IH0gZnJvbSBcIi4vY2xhc3NcIlxuXG5leHBvcnQgdHlwZSAqIGZyb20gJy4uL21vZGVscydcblxuZXhwb3J0IHR5cGUgRE1NRiA9IHR5cGVvZiBydW50aW1lLkRNTUZcblxuZXhwb3J0IHR5cGUgUHJpc21hUHJvbWlzZTxUPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLlByaXNtYVByb21pc2U8VD5cblxuLyoqXG4gKiBQcmlzbWEgRXJyb3JzXG4gKi9cblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yXG5cbi8qKlxuICogUmUtZXhwb3J0IG9mIHNxbC10ZW1wbGF0ZS10YWdcbiAqL1xuZXhwb3J0IGNvbnN0IHNxbCA9IHJ1bnRpbWUuc3FsdGFnXG5leHBvcnQgY29uc3QgZW1wdHkgPSBydW50aW1lLmVtcHR5XG5leHBvcnQgY29uc3Qgam9pbiA9IHJ1bnRpbWUuam9pblxuZXhwb3J0IGNvbnN0IHJhdyA9IHJ1bnRpbWUucmF3XG5leHBvcnQgY29uc3QgU3FsID0gcnVudGltZS5TcWxcbmV4cG9ydCB0eXBlIFNxbCA9IHJ1bnRpbWUuU3FsXG5cblxuXG4vKipcbiAqIERlY2ltYWwuanNcbiAqL1xuZXhwb3J0IGNvbnN0IERlY2ltYWwgPSBydW50aW1lLkRlY2ltYWxcbmV4cG9ydCB0eXBlIERlY2ltYWwgPSBydW50aW1lLkRlY2ltYWxcblxuZXhwb3J0IHR5cGUgRGVjaW1hbEpzTGlrZSA9IHJ1bnRpbWUuRGVjaW1hbEpzTGlrZVxuXG4vKipcbiogRXh0ZW5zaW9uc1xuKi9cbmV4cG9ydCB0eXBlIEV4dGVuc2lvbiA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5Vc2VyQXJnc1xuZXhwb3J0IGNvbnN0IGdldEV4dGVuc2lvbkNvbnRleHQgPSBydW50aW1lLkV4dGVuc2lvbnMuZ2V0RXh0ZW5zaW9uQ29udGV4dFxuZXhwb3J0IHR5cGUgQXJnczxULCBGIGV4dGVuZHMgcnVudGltZS5PcGVyYXRpb24+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuQXJnczxULCBGPlxuZXhwb3J0IHR5cGUgUGF5bG9hZDxULCBGIGV4dGVuZHMgcnVudGltZS5PcGVyYXRpb24gPSBuZXZlcj4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5QYXlsb2FkPFQsIEY+XG5leHBvcnQgdHlwZSBSZXN1bHQ8VCwgQSwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLlJlc3VsdDxULCBBLCBGPlxuZXhwb3J0IHR5cGUgRXhhY3Q8QSwgVz4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5FeGFjdDxBLCBXPlxuXG5leHBvcnQgdHlwZSBQcmlzbWFWZXJzaW9uID0ge1xuICBjbGllbnQ6IHN0cmluZ1xuICBlbmdpbmU6IHN0cmluZ1xufVxuXG4vKipcbiAqIFByaXNtYSBDbGllbnQgSlMgdmVyc2lvbjogNy45LjFcbiAqIFF1ZXJ5IEVuZ2luZSB2ZXJzaW9uOiBlOTIyMDg5YjdkNzUwMmFmZjQyNDlkNWRhMzQyMGY2ZmE1NWZjNmFkXG4gKi9cbmV4cG9ydCBjb25zdCBwcmlzbWFWZXJzaW9uOiBQcmlzbWFWZXJzaW9uID0ge1xuICBjbGllbnQ6IFwiNy45LjFcIixcbiAgZW5naW5lOiBcImU5MjIwODliN2Q3NTAyYWZmNDI0OWQ1ZGEzNDIwZjZmYTU1ZmM2YWRcIlxufVxuXG4vKipcbiAqIFV0aWxpdHkgVHlwZXNcbiAqL1xuXG5leHBvcnQgdHlwZSBCeXRlcyA9IHJ1bnRpbWUuQnl0ZXNcbmV4cG9ydCB0eXBlIEpzb25PYmplY3QgPSBydW50aW1lLkpzb25PYmplY3RcbmV4cG9ydCB0eXBlIEpzb25BcnJheSA9IHJ1bnRpbWUuSnNvbkFycmF5XG5leHBvcnQgdHlwZSBKc29uVmFsdWUgPSBydW50aW1lLkpzb25WYWx1ZVxuZXhwb3J0IHR5cGUgSW5wdXRKc29uT2JqZWN0ID0gcnVudGltZS5JbnB1dEpzb25PYmplY3RcbmV4cG9ydCB0eXBlIElucHV0SnNvbkFycmF5ID0gcnVudGltZS5JbnB1dEpzb25BcnJheVxuZXhwb3J0IHR5cGUgSW5wdXRKc29uVmFsdWUgPSBydW50aW1lLklucHV0SnNvblZhbHVlXG5cblxuZXhwb3J0IGNvbnN0IE51bGxUeXBlcyA9IHtcbiAgRGJOdWxsOiBydW50aW1lLk51bGxUeXBlcy5EYk51bGwgYXMgKG5ldyAoc2VjcmV0OiBuZXZlcikgPT4gdHlwZW9mIHJ1bnRpbWUuRGJOdWxsKSxcbiAgSnNvbk51bGw6IHJ1bnRpbWUuTnVsbFR5cGVzLkpzb25OdWxsIGFzIChuZXcgKHNlY3JldDogbmV2ZXIpID0+IHR5cGVvZiBydW50aW1lLkpzb25OdWxsKSxcbiAgQW55TnVsbDogcnVudGltZS5OdWxsVHlwZXMuQW55TnVsbCBhcyAobmV3IChzZWNyZXQ6IG5ldmVyKSA9PiB0eXBlb2YgcnVudGltZS5BbnlOdWxsKSxcbn1cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgaGF2ZSBgbnVsbGAgb24gdGhlIGRhdGFiYXNlIChlbXB0eSBvbiB0aGUgZGIpXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgRGJOdWxsID0gcnVudGltZS5EYk51bGxcblxuLyoqXG4gKiBIZWxwZXIgZm9yIGZpbHRlcmluZyBKU09OIGVudHJpZXMgdGhhdCBoYXZlIEpTT04gYG51bGxgIHZhbHVlcyAobm90IGVtcHR5IG9uIHRoZSBkYilcbiAqXG4gKiBAc2VlIGh0dHBzOi8vd3d3LnByaXNtYS5pby9kb2NzL2NvbmNlcHRzL2NvbXBvbmVudHMvcHJpc21hLWNsaWVudC93b3JraW5nLXdpdGgtZmllbGRzL3dvcmtpbmctd2l0aC1qc29uLWZpZWxkcyNmaWx0ZXJpbmctb24tYS1qc29uLWZpZWxkXG4gKi9cbmV4cG9ydCBjb25zdCBKc29uTnVsbCA9IHJ1bnRpbWUuSnNvbk51bGxcblxuLyoqXG4gKiBIZWxwZXIgZm9yIGZpbHRlcmluZyBKU09OIGVudHJpZXMgdGhhdCBhcmUgYFByaXNtYS5EYk51bGxgIG9yIGBQcmlzbWEuSnNvbk51bGxgXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgQW55TnVsbCA9IHJ1bnRpbWUuQW55TnVsbFxuXG5cbnR5cGUgU2VsZWN0QW5kSW5jbHVkZSA9IHtcbiAgc2VsZWN0OiBhbnlcbiAgaW5jbHVkZTogYW55XG59XG5cbnR5cGUgU2VsZWN0QW5kT21pdCA9IHtcbiAgc2VsZWN0OiBhbnlcbiAgb21pdDogYW55XG59XG5cbi8qKlxuICogRnJvbSBULCBwaWNrIGEgc2V0IG9mIHByb3BlcnRpZXMgd2hvc2Uga2V5cyBhcmUgaW4gdGhlIHVuaW9uIEtcbiAqL1xudHlwZSBQcmlzbWFfX1BpY2s8VCwgSyBleHRlbmRzIGtleW9mIFQ+ID0ge1xuICAgIFtQIGluIEtdOiBUW1BdO1xufTtcblxuZXhwb3J0IHR5cGUgRW51bWVyYWJsZTxUPiA9IFQgfCBBcnJheTxUPjtcblxuLyoqXG4gKiBTdWJzZXRcbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYC4gU2ltcGxlIHZlcnNpb24gb2YgSW50ZXJzZWN0aW9uXG4gKi9cbmV4cG9ydCB0eXBlIFN1YnNldDxULCBVPiA9IHtcbiAgW2tleSBpbiBrZXlvZiBUXToga2V5IGV4dGVuZHMga2V5b2YgVSA/IFRba2V5XSA6IG5ldmVyO1xufTtcblxuLyoqXG4gKiBSZXNvbHZlZCB0eXBlIG9mIHRoZSBhcmd1bWVudCBwYXNzZWQgdG8gdGhlIGBQcmlzbWFDbGllbnRgIGNvbnN0cnVjdG9yLlxuICpcbiAqIFdoZW4gY2FsbGVkIHdpdGhvdXQgYSBuYXJyb3dlciBvcHRpb25zIHR5cGUgKHRoZSBjb21tb24gY2FzZSksIHRoaXMgcmVzb2x2ZXNcbiAqIHRvIGBQcmlzbWFDbGllbnRPcHRpb25zYCBkaXJlY3RseSwgd2hpY2ggcHJvZHVjZXMgYSBjbGVhciBUeXBlU2NyaXB0IGVycm9yXG4gKiBtZXNzYWdlIChgbm90IGFzc2lnbmFibGUgdG8gcGFyYW1ldGVyIG9mIHR5cGUgJ1ByaXNtYUNsaWVudE9wdGlvbnMnYCkgd2hlblxuICogdGhlIGFyZ3VtZW50IGlzIG1pc3Npbmcgb3IgaW5jb21wbGV0ZS4gV2hlbiB0aGUgdXNlciBzdXBwbGllcyBhIG5hcnJvd2VyXG4gKiBvcHRpb25zIHR5cGUgKGUuZy4gdmlhIGEgbGl0ZXJhbCksIGl0IGZhbGxzIGJhY2sgdG8gYFN1YnNldGAgdG8ga2VlcFxuICogZmlsdGVyaW5nIG91dCB1bmtub3duIHByb3BlcnRpZXMuXG4gKi9cbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudENvbnN0cnVjdG9yQXJnczxPcHRpb25zIGV4dGVuZHMgUHJpc21hQ2xpZW50T3B0aW9ucz4gPVxuICBbUHJpc21hQ2xpZW50T3B0aW9uc10gZXh0ZW5kcyBbT3B0aW9uc10gPyBQcmlzbWFDbGllbnRPcHRpb25zIDogU3Vic2V0PE9wdGlvbnMsIFByaXNtYUNsaWVudE9wdGlvbnM+O1xuXG4vKipcbiAqIFNlbGVjdFN1YnNldFxuICogQGRlc2MgRnJvbSBgVGAgcGljayBwcm9wZXJ0aWVzIHRoYXQgZXhpc3QgaW4gYFVgLiBTaW1wbGUgdmVyc2lvbiBvZiBJbnRlcnNlY3Rpb24uXG4gKiBBZGRpdGlvbmFsbHksIGl0IHZhbGlkYXRlcywgaWYgYm90aCBzZWxlY3QgYW5kIGluY2x1ZGUgYXJlIHByZXNlbnQuIElmIHRoZSBjYXNlLCBpdCBlcnJvcnMuXG4gKi9cbmV4cG9ydCB0eXBlIFNlbGVjdFN1YnNldDxULCBVPiA9IHtcbiAgW2tleSBpbiBrZXlvZiBUXToga2V5IGV4dGVuZHMga2V5b2YgVSA/IFRba2V5XSA6IG5ldmVyXG59ICZcbiAgKFQgZXh0ZW5kcyBTZWxlY3RBbmRJbmNsdWRlXG4gICAgPyAnUGxlYXNlIGVpdGhlciBjaG9vc2UgYHNlbGVjdGAgb3IgYGluY2x1ZGVgLidcbiAgICA6IFQgZXh0ZW5kcyBTZWxlY3RBbmRPbWl0XG4gICAgICA/ICdQbGVhc2UgZWl0aGVyIGNob29zZSBgc2VsZWN0YCBvciBgb21pdGAuJ1xuICAgICAgOiB7fSlcblxuLyoqXG4gKiBTdWJzZXQgKyBJbnRlcnNlY3Rpb25cbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYCBhbmQgaW50ZXJzZWN0IGBLYFxuICovXG5leHBvcnQgdHlwZSBTdWJzZXRJbnRlcnNlY3Rpb248VCwgVSwgSz4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlclxufSAmXG4gIEtcblxudHlwZSBXaXRob3V0PFQsIFU+ID0geyBbUCBpbiBFeGNsdWRlPGtleW9mIFQsIGtleW9mIFU+XT86IG5ldmVyIH07XG5cbi8qKlxuICogWE9SIGlzIG5lZWRlZCB0byBoYXZlIGEgcmVhbCBtdXR1YWxseSBleGNsdXNpdmUgdW5pb24gdHlwZVxuICogaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNDIxMjM0MDcvZG9lcy10eXBlc2NyaXB0LXN1cHBvcnQtbXV0dWFsbHktZXhjbHVzaXZlLXR5cGVzXG4gKi9cbmV4cG9ydCB0eXBlIFhPUjxULCBVPiA9XG4gIFQgZXh0ZW5kcyBvYmplY3QgP1xuICBVIGV4dGVuZHMgb2JqZWN0ID9cbiAgICAoKFdpdGhvdXQ8VCwgVT4gJiBVKSB8IChXaXRob3V0PFUsIFQ+ICYgVCkpICYgb2JqZWN0XG4gIDogVSA6IFRcblxuXG4vKipcbiAqIElzIFQgYSBSZWNvcmQ/XG4gKi9cbnR5cGUgSXNPYmplY3Q8VCBleHRlbmRzIGFueT4gPSBUIGV4dGVuZHMgQXJyYXk8YW55PlxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgRGF0ZVxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgVWludDhBcnJheVxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgQmlnSW50XG4/IEZhbHNlXG46IFQgZXh0ZW5kcyBvYmplY3Rcbj8gVHJ1ZVxuOiBGYWxzZVxuXG5cbi8qKlxuICogSWYgaXQncyBUW10sIHJldHVybiBUXG4gKi9cbmV4cG9ydCB0eXBlIFVuRW51bWVyYXRlPFQgZXh0ZW5kcyB1bmtub3duPiA9IFQgZXh0ZW5kcyBBcnJheTxpbmZlciBVPiA/IFUgOiBUXG5cbi8qKlxuICogRnJvbSB0cy10b29sYmVsdFxuICovXG5cbnR5cGUgX19FaXRoZXI8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBPbWl0PE8sIEs+ICZcbiAge1xuICAgIC8vIE1lcmdlIGFsbCBidXQgS1xuICAgIFtQIGluIEtdOiBQcmlzbWFfX1BpY2s8TywgUCAmIGtleW9mIE8+IC8vIFdpdGggSyBwb3NzaWJpbGl0aWVzXG4gIH1bS11cblxudHlwZSBFaXRoZXJTdHJpY3Q8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBTdHJpY3Q8X19FaXRoZXI8TywgSz4+XG5cbnR5cGUgRWl0aGVyTG9vc2U8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBDb21wdXRlUmF3PF9fRWl0aGVyPE8sIEs+PlxuXG50eXBlIF9FaXRoZXI8XG4gIE8gZXh0ZW5kcyBvYmplY3QsXG4gIEsgZXh0ZW5kcyBLZXksXG4gIHN0cmljdCBleHRlbmRzIEJvb2xlYW5cbj4gPSB7XG4gIDE6IEVpdGhlclN0cmljdDxPLCBLPlxuICAwOiBFaXRoZXJMb29zZTxPLCBLPlxufVtzdHJpY3RdXG5cbmV4cG9ydCB0eXBlIEVpdGhlcjxcbiAgTyBleHRlbmRzIG9iamVjdCxcbiAgSyBleHRlbmRzIEtleSxcbiAgc3RyaWN0IGV4dGVuZHMgQm9vbGVhbiA9IDFcbj4gPSBPIGV4dGVuZHMgdW5rbm93biA/IF9FaXRoZXI8TywgSywgc3RyaWN0PiA6IG5ldmVyXG5cbmV4cG9ydCB0eXBlIFVuaW9uID0gYW55XG5cbmV4cG9ydCB0eXBlIFBhdGNoVW5kZWZpbmVkPE8gZXh0ZW5kcyBvYmplY3QsIE8xIGV4dGVuZHMgb2JqZWN0PiA9IHtcbiAgW0sgaW4ga2V5b2YgT106IE9bS10gZXh0ZW5kcyB1bmRlZmluZWQgPyBBdDxPMSwgSz4gOiBPW0tdXG59ICYge31cblxuLyoqIEhlbHBlciBUeXBlcyBmb3IgXCJNZXJnZVwiICoqL1xuZXhwb3J0IHR5cGUgSW50ZXJzZWN0T2Y8VSBleHRlbmRzIFVuaW9uPiA9IChcbiAgVSBleHRlbmRzIHVua25vd24gPyAoazogVSkgPT4gdm9pZCA6IG5ldmVyXG4pIGV4dGVuZHMgKGs6IGluZmVyIEkpID0+IHZvaWRcbiAgPyBJXG4gIDogbmV2ZXJcblxuZXhwb3J0IHR5cGUgT3ZlcndyaXRlPE8gZXh0ZW5kcyBvYmplY3QsIE8xIGV4dGVuZHMgb2JqZWN0PiA9IHtcbiAgICBbSyBpbiBrZXlvZiBPXTogSyBleHRlbmRzIGtleW9mIE8xID8gTzFbS10gOiBPW0tdO1xufSAmIHt9O1xuXG50eXBlIF9NZXJnZTxVIGV4dGVuZHMgb2JqZWN0PiA9IEludGVyc2VjdE9mPE92ZXJ3cml0ZTxVLCB7XG4gICAgW0sgaW4ga2V5b2YgVV0tPzogQXQ8VSwgSz47XG59Pj47XG5cbnR5cGUgS2V5ID0gc3RyaW5nIHwgbnVtYmVyIHwgc3ltYm9sO1xudHlwZSBBdFN0cmljdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IE9bSyAmIGtleW9mIE9dO1xudHlwZSBBdExvb3NlPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gTyBleHRlbmRzIHVua25vd24gPyBBdFN0cmljdDxPLCBLPiA6IG5ldmVyO1xuZXhwb3J0IHR5cGUgQXQ8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleSwgc3RyaWN0IGV4dGVuZHMgQm9vbGVhbiA9IDE+ID0ge1xuICAgIDE6IEF0U3RyaWN0PE8sIEs+O1xuICAgIDA6IEF0TG9vc2U8TywgSz47XG59W3N0cmljdF07XG5cbmV4cG9ydCB0eXBlIENvbXB1dGVSYXc8QSBleHRlbmRzIGFueT4gPSBBIGV4dGVuZHMgRnVuY3Rpb24gPyBBIDoge1xuICBbSyBpbiBrZXlvZiBBXTogQVtLXTtcbn0gJiB7fTtcblxuZXhwb3J0IHR5cGUgT3B0aW9uYWxGbGF0PE8+ID0ge1xuICBbSyBpbiBrZXlvZiBPXT86IE9bS107XG59ICYge307XG5cbnR5cGUgX1JlY29yZDxLIGV4dGVuZHMga2V5b2YgYW55LCBUPiA9IHtcbiAgW1AgaW4gS106IFQ7XG59O1xuXG4vLyBjYXVzZSB0eXBlc2NyaXB0IG5vdCB0byBleHBhbmQgdHlwZXMgYW5kIHByZXNlcnZlIG5hbWVzXG50eXBlIE5vRXhwYW5kPFQ+ID0gVCBleHRlbmRzIHVua25vd24gPyBUIDogbmV2ZXI7XG5cbi8vIHRoaXMgdHlwZSBhc3N1bWVzIHRoZSBwYXNzZWQgb2JqZWN0IGlzIGVudGlyZWx5IG9wdGlvbmFsXG5leHBvcnQgdHlwZSBBdExlYXN0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBzdHJpbmc+ID0gTm9FeHBhbmQ8XG4gIE8gZXh0ZW5kcyB1bmtub3duXG4gID8gfCAoSyBleHRlbmRzIGtleW9mIE8gPyB7IFtQIGluIEtdOiBPW1BdIH0gJiBPIDogTylcbiAgICB8IHtbUCBpbiBrZXlvZiBPIGFzIFAgZXh0ZW5kcyBLID8gUCA6IG5ldmVyXS0/OiBPW1BdfSAmIE9cbiAgOiBuZXZlcj47XG5cbnR5cGUgX1N0cmljdDxVLCBfVSA9IFU+ID0gVSBleHRlbmRzIHVua25vd24gPyBVICYgT3B0aW9uYWxGbGF0PF9SZWNvcmQ8RXhjbHVkZTxLZXlzPF9VPiwga2V5b2YgVT4sIG5ldmVyPj4gOiBuZXZlcjtcblxuZXhwb3J0IHR5cGUgU3RyaWN0PFUgZXh0ZW5kcyBvYmplY3Q+ID0gQ29tcHV0ZVJhdzxfU3RyaWN0PFU+Pjtcbi8qKiBFbmQgSGVscGVyIFR5cGVzIGZvciBcIk1lcmdlXCIgKiovXG5cbmV4cG9ydCB0eXBlIE1lcmdlPFUgZXh0ZW5kcyBvYmplY3Q+ID0gQ29tcHV0ZVJhdzxfTWVyZ2U8U3RyaWN0PFU+Pj47XG5cbmV4cG9ydCB0eXBlIEJvb2xlYW4gPSBUcnVlIHwgRmFsc2VcblxuZXhwb3J0IHR5cGUgVHJ1ZSA9IDFcblxuZXhwb3J0IHR5cGUgRmFsc2UgPSAwXG5cbmV4cG9ydCB0eXBlIE5vdDxCIGV4dGVuZHMgQm9vbGVhbj4gPSB7XG4gIDA6IDFcbiAgMTogMFxufVtCXVxuXG5leHBvcnQgdHlwZSBFeHRlbmRzPEExIGV4dGVuZHMgYW55LCBBMiBleHRlbmRzIGFueT4gPSBbQTFdIGV4dGVuZHMgW25ldmVyXVxuICA/IDAgLy8gYW55dGhpbmcgYG5ldmVyYCBpcyBmYWxzZVxuICA6IEExIGV4dGVuZHMgQTJcbiAgPyAxXG4gIDogMFxuXG5leHBvcnQgdHlwZSBIYXM8VSBleHRlbmRzIFVuaW9uLCBVMSBleHRlbmRzIFVuaW9uPiA9IE5vdDxcbiAgRXh0ZW5kczxFeGNsdWRlPFUxLCBVPiwgVTE+XG4+XG5cbmV4cG9ydCB0eXBlIE9yPEIxIGV4dGVuZHMgQm9vbGVhbiwgQjIgZXh0ZW5kcyBCb29sZWFuPiA9IHtcbiAgMDoge1xuICAgIDA6IDBcbiAgICAxOiAxXG4gIH1cbiAgMToge1xuICAgIDA6IDFcbiAgICAxOiAxXG4gIH1cbn1bQjFdW0IyXVxuXG5leHBvcnQgdHlwZSBLZXlzPFUgZXh0ZW5kcyBVbmlvbj4gPSBVIGV4dGVuZHMgdW5rbm93biA/IGtleW9mIFUgOiBuZXZlclxuXG5leHBvcnQgdHlwZSBHZXRTY2FsYXJUeXBlPFQsIE8+ID0gTyBleHRlbmRzIG9iamVjdCA/IHtcbiAgW1AgaW4ga2V5b2YgVF06IFAgZXh0ZW5kcyBrZXlvZiBPXG4gICAgPyBPW1BdXG4gICAgOiBuZXZlclxufSA6IG5ldmVyXG5cbnR5cGUgRmllbGRQYXRoczxcbiAgVCxcbiAgVSA9IE9taXQ8VCwgJ19hdmcnIHwgJ19zdW0nIHwgJ19jb3VudCcgfCAnX21pbicgfCAnX21heCc+XG4+ID0gSXNPYmplY3Q8VD4gZXh0ZW5kcyBUcnVlID8gVSA6IFRcblxuZXhwb3J0IHR5cGUgR2V0SGF2aW5nRmllbGRzPFQ+ID0ge1xuICBbSyBpbiBrZXlvZiBUXTogT3I8XG4gICAgT3I8RXh0ZW5kczwnT1InLCBLPiwgRXh0ZW5kczwnQU5EJywgSz4+LFxuICAgIEV4dGVuZHM8J05PVCcsIEs+XG4gID4gZXh0ZW5kcyBUcnVlXG4gICAgPyAvLyBpbmZlciBpcyBvbmx5IG5lZWRlZCB0byBub3QgaGl0IFRTIGxpbWl0XG4gICAgICAvLyBiYXNlZCBvbiB0aGUgYnJpbGxpYW50IGlkZWEgb2YgUGllcnJlLUFudG9pbmUgTWlsbHNcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvMzAxODgjaXNzdWVjb21tZW50LTQ3ODkzODQzN1xuICAgICAgVFtLXSBleHRlbmRzIGluZmVyIFRLXG4gICAgICA/IEdldEhhdmluZ0ZpZWxkczxVbkVudW1lcmF0ZTxUSz4gZXh0ZW5kcyBvYmplY3QgPyBNZXJnZTxVbkVudW1lcmF0ZTxUSz4+IDogbmV2ZXI+XG4gICAgICA6IG5ldmVyXG4gICAgOiB7fSBleHRlbmRzIEZpZWxkUGF0aHM8VFtLXT5cbiAgICA/IG5ldmVyXG4gICAgOiBLXG59W2tleW9mIFRdXG5cbi8qKlxuICogQ29udmVydCB0dXBsZSB0byB1bmlvblxuICovXG50eXBlIF9UdXBsZVRvVW5pb248VD4gPSBUIGV4dGVuZHMgKGluZmVyIEUpW10gPyBFIDogbmV2ZXJcbnR5cGUgVHVwbGVUb1VuaW9uPEsgZXh0ZW5kcyByZWFkb25seSBhbnlbXT4gPSBfVHVwbGVUb1VuaW9uPEs+XG5leHBvcnQgdHlwZSBNYXliZVR1cGxlVG9VbmlvbjxUPiA9IFQgZXh0ZW5kcyBhbnlbXSA/IFR1cGxlVG9VbmlvbjxUPiA6IFRcblxuLyoqXG4gKiBMaWtlIGBQaWNrYCwgYnV0IGFkZGl0aW9uYWxseSBjYW4gYWxzbyBhY2NlcHQgYW4gYXJyYXkgb2Yga2V5c1xuICovXG5leHBvcnQgdHlwZSBQaWNrRW51bWVyYWJsZTxULCBLIGV4dGVuZHMgRW51bWVyYWJsZTxrZXlvZiBUPiB8IGtleW9mIFQ+ID0gUHJpc21hX19QaWNrPFQsIE1heWJlVHVwbGVUb1VuaW9uPEs+PlxuXG4vKipcbiAqIEV4Y2x1ZGUgYWxsIGtleXMgd2l0aCB1bmRlcnNjb3Jlc1xuICovXG5leHBvcnQgdHlwZSBFeGNsdWRlVW5kZXJzY29yZUtleXM8VCBleHRlbmRzIHN0cmluZz4gPSBUIGV4dGVuZHMgYF8ke3N0cmluZ31gID8gbmV2ZXIgOiBUXG5cblxuZXhwb3J0IHR5cGUgRmllbGRSZWY8TW9kZWwsIEZpZWxkVHlwZT4gPSBydW50aW1lLkZpZWxkUmVmPE1vZGVsLCBGaWVsZFR5cGU+XG5cbnR5cGUgRmllbGRSZWZJbnB1dFR5cGU8TW9kZWwsIEZpZWxkVHlwZT4gPSBNb2RlbCBleHRlbmRzIG5ldmVyID8gbmV2ZXIgOiBGaWVsZFJlZjxNb2RlbCwgRmllbGRUeXBlPlxuXG5cbmV4cG9ydCBjb25zdCBNb2RlbE5hbWUgPSB7XG4gIEJsb2dDb21tZW50OiAnQmxvZ0NvbW1lbnQnLFxuICBCbG9nUG9zdDogJ0Jsb2dQb3N0JyxcbiAgQm9va2luZzogJ0Jvb2tpbmcnLFxuICBDYXRlZ29yeTogJ0NhdGVnb3J5JyxcbiAgQ29udGFjdE1lc3NhZ2U6ICdDb250YWN0TWVzc2FnZScsXG4gIE5vdGlmaWNhdGlvbjogJ05vdGlmaWNhdGlvbicsXG4gIFBheW1lbnQ6ICdQYXltZW50JyxcbiAgUmVmcmVzaFRva2VuOiAnUmVmcmVzaFRva2VuJyxcbiAgUmV2aWV3OiAnUmV2aWV3JyxcbiAgVG91clBhY2thZ2U6ICdUb3VyUGFja2FnZScsXG4gIFVzZXI6ICdVc2VyJyxcbiAgV2lzaGxpc3RJdGVtOiAnV2lzaGxpc3RJdGVtJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBNb2RlbE5hbWUgPSAodHlwZW9mIE1vZGVsTmFtZSlba2V5b2YgdHlwZW9mIE1vZGVsTmFtZV1cblxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgVHlwZU1hcENiPEdsb2JhbE9taXRPcHRpb25zID0ge30+IGV4dGVuZHMgcnVudGltZS5UeXBlcy5VdGlscy5Gbjx7ZXh0QXJnczogcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyB9LCBydW50aW1lLlR5cGVzLlV0aWxzLlJlY29yZDxzdHJpbmcsIGFueT4+IHtcbiAgcmV0dXJuczogVHlwZU1hcDx0aGlzWydwYXJhbXMnXVsnZXh0QXJncyddLCBHbG9iYWxPbWl0T3B0aW9ucz5cbn1cblxuZXhwb3J0IHR5cGUgVHlwZU1hcDxFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncywgR2xvYmFsT21pdE9wdGlvbnMgPSB7fT4gPSB7XG4gIGdsb2JhbE9taXRPcHRpb25zOiB7XG4gICAgb21pdDogR2xvYmFsT21pdE9wdGlvbnNcbiAgfVxuICBtZXRhOiB7XG4gICAgbW9kZWxQcm9wczogXCJibG9nQ29tbWVudFwiIHwgXCJibG9nUG9zdFwiIHwgXCJib29raW5nXCIgfCBcImNhdGVnb3J5XCIgfCBcImNvbnRhY3RNZXNzYWdlXCIgfCBcIm5vdGlmaWNhdGlvblwiIHwgXCJwYXltZW50XCIgfCBcInJlZnJlc2hUb2tlblwiIHwgXCJyZXZpZXdcIiB8IFwidG91clBhY2thZ2VcIiB8IFwidXNlclwiIHwgXCJ3aXNobGlzdEl0ZW1cIlxuICAgIHR4SXNvbGF0aW9uTGV2ZWw6IFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWxcbiAgfVxuICBtb2RlbDoge1xuICAgIEJsb2dDb21tZW50OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQmxvZ0NvbW1lbnRGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudEZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudEZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudENyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudENyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudERlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudFVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnREZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudFVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQmxvZ0NvbW1lbnQ+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudEdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5CbG9nQ29tbWVudEdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJsb2dDb21tZW50Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIEJsb2dQb3N0OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQmxvZ1Bvc3RGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdERlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3REZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQmxvZ1Bvc3Q+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5CbG9nUG9zdEdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJsb2dQb3N0Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIEJvb2tpbmc6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQm9va2luZ1BheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkJvb2tpbmdGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1VwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1VwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0FnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUJvb2tpbmc+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJvb2tpbmdHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJvb2tpbmdDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQ2F0ZWdvcnk6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5DYXRlZ29yeUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVDYXRlZ29yeT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNhdGVnb3J5R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ2F0ZWdvcnlDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQ29udGFjdE1lc3NhZ2U6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVDb250YWN0TWVzc2FnZT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNvbnRhY3RNZXNzYWdlR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ29udGFjdE1lc3NhZ2VDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgTm90aWZpY2F0aW9uOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLk5vdGlmaWNhdGlvbkZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25GaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25GaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25DcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25DcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25DcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkRlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25VcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZU5vdGlmaWNhdGlvbj5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Ob3RpZmljYXRpb25Hcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuTm90aWZpY2F0aW9uQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFBheW1lbnQ6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kUGF5bWVudFBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlBheW1lbnRGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVBheW1lbnQ+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlBheW1lbnRHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlBheW1lbnRDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgUmVmcmVzaFRva2VuOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlJlZnJlc2hUb2tlbkZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5GaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5GaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5DcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5DcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5DcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkRlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5VcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVJlZnJlc2hUb2tlbj5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5SZWZyZXNoVG9rZW5Hcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUmVmcmVzaFRva2VuQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFJldmlldzoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRSZXZpZXdQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5SZXZpZXdGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1VwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0RlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1VwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1VwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVSZXZpZXc+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUmV2aWV3R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJldmlld0NvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBUb3VyUGFja2FnZToge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlRvdXJQYWNrYWdlRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVRvdXJQYWNrYWdlPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVG91clBhY2thZ2VHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Ub3VyUGFja2FnZUNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBVc2VyOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFVzZXJQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Vc2VyRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckRlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckRlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVVc2VyPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Vc2VyR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Vc2VyQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFdpc2hsaXN0SXRlbToge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5XaXNobGlzdEl0ZW1GaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1EZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbVVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1BZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVXaXNobGlzdEl0ZW0+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1Hcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuV2lzaGxpc3RJdGVtR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1Db3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLldpc2hsaXN0SXRlbUNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufSAmIHtcbiAgb3RoZXI6IHtcbiAgICBwYXlsb2FkOiBhbnlcbiAgICBvcGVyYXRpb25zOiB7XG4gICAgICAkZXhlY3V0ZVJhdzoge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgU3FsLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRleGVjdXRlUmF3VW5zYWZlOiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRxdWVyeVJhdzoge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgU3FsLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRxdWVyeVJhd1Vuc2FmZToge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXV0sXG4gICAgICAgIHJlc3VsdDogYW55XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRW51bXNcbiAqL1xuXG5leHBvcnQgY29uc3QgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCA9IHJ1bnRpbWUubWFrZVN0cmljdEVudW0oe1xuICBSZWFkVW5jb21taXR0ZWQ6ICdSZWFkVW5jb21taXR0ZWQnLFxuICBSZWFkQ29tbWl0dGVkOiAnUmVhZENvbW1pdHRlZCcsXG4gIFJlcGVhdGFibGVSZWFkOiAnUmVwZWF0YWJsZVJlYWQnLFxuICBTZXJpYWxpemFibGU6ICdTZXJpYWxpemFibGUnXG59IGFzIGNvbnN0KVxuXG5leHBvcnQgdHlwZSBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsID0gKHR5cGVvZiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsKVtrZXlvZiB0eXBlb2YgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbF1cblxuXG5leHBvcnQgY29uc3QgQmxvZ0NvbW1lbnRTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBjb250ZW50OiAnY29udGVudCcsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIHBvc3RJZDogJ3Bvc3RJZCcsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHBhcmVudElkOiAncGFyZW50SWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJsb2dDb21tZW50U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBCbG9nQ29tbWVudFNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIEJsb2dDb21tZW50U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRpdGxlOiAndGl0bGUnLFxuICBzbHVnOiAnc2x1ZycsXG4gIGV4Y2VycHQ6ICdleGNlcnB0JyxcbiAgY29udGVudDogJ2NvbnRlbnQnLFxuICBjb3ZlckltYWdlOiAnY292ZXJJbWFnZScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIGF1dGhvcklkOiAnYXV0aG9ySWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJsb2dQb3N0U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIEJsb2dQb3N0U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBCb29raW5nU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdHJhdmVsRGF0ZTogJ3RyYXZlbERhdGUnLFxuICB0cmF2ZWxlcnM6ICd0cmF2ZWxlcnMnLFxuICB0b3RhbFByaWNlOiAndG90YWxQcmljZScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHBhY2thZ2VJZDogJ3BhY2thZ2VJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQm9va2luZ1NjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQm9va2luZ1NjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIEJvb2tpbmdTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IENhdGVnb3J5U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgbmFtZTogJ25hbWUnLFxuICBzbHVnOiAnc2x1ZycsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQ2F0ZWdvcnlTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQ2F0ZWdvcnlTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgbmFtZTogJ25hbWUnLFxuICBlbWFpbDogJ2VtYWlsJyxcbiAgc3ViamVjdDogJ3N1YmplY3QnLFxuICBtZXNzYWdlOiAnbWVzc2FnZScsXG4gIGlzUmVzb2x2ZWQ6ICdpc1Jlc29sdmVkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgTm90aWZpY2F0aW9uU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgdHlwZTogJ3R5cGUnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgbWVzc2FnZTogJ21lc3NhZ2UnLFxuICBsaW5rOiAnbGluaycsXG4gIGlzUmVhZDogJ2lzUmVhZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgTm90aWZpY2F0aW9uU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBOb3RpZmljYXRpb25TY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBOb3RpZmljYXRpb25TY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFBheW1lbnRTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBib29raW5nSWQ6ICdib29raW5nSWQnLFxuICB0cmFuSWQ6ICd0cmFuSWQnLFxuICB2YWxJZDogJ3ZhbElkJyxcbiAgYW1vdW50OiAnYW1vdW50JyxcbiAgY3VycmVuY3k6ICdjdXJyZW5jeScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGdhdGV3YXlQYWdlVXJsOiAnZ2F0ZXdheVBhZ2VVcmwnLFxuICBzc2xTZXNzaW9uS2V5OiAnc3NsU2Vzc2lvbktleScsXG4gIGNhcmRUeXBlOiAnY2FyZFR5cGUnLFxuICBiYW5rVHJhbklkOiAnYmFua1RyYW5JZCcsXG4gIHBhaWRBdDogJ3BhaWRBdCcsXG4gIHJlZnVuZFJlZklkOiAncmVmdW5kUmVmSWQnLFxuICByZWZ1bmRJbml0aWF0ZWRBdDogJ3JlZnVuZEluaXRpYXRlZEF0JyxcbiAgcmVmdW5kQ29tcGxldGVkQXQ6ICdyZWZ1bmRDb21wbGV0ZWRBdCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGF5bWVudFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgUGF5bWVudFNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFBheW1lbnRTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFJlZnJlc2hUb2tlblNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIGhhc2g6ICdoYXNoJyxcbiAgZXhwaXJlc0F0OiAnZXhwaXJlc0F0JyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgcmV2b2tlZEF0OiAncmV2b2tlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBSZWZyZXNoVG9rZW5TY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFJlZnJlc2hUb2tlblNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFJlZnJlc2hUb2tlblNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgUmV2aWV3U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgcmF0aW5nOiAncmF0aW5nJyxcbiAgY29tbWVudDogJ2NvbW1lbnQnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYWNrYWdlSWQ6ICdwYWNrYWdlSWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFJldmlld1NjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgUmV2aWV3U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgUmV2aWV3U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRpdGxlOiAndGl0bGUnLFxuICBzbHVnOiAnc2x1ZycsXG4gIGRlc2NyaXB0aW9uOiAnZGVzY3JpcHRpb24nLFxuICBsb2NhdGlvbjogJ2xvY2F0aW9uJyxcbiAgcHJpY2U6ICdwcmljZScsXG4gIGR1cmF0aW9uOiAnZHVyYXRpb24nLFxuICByYXRpbmc6ICdyYXRpbmcnLFxuICBpbWFnZXM6ICdpbWFnZXMnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICBjYXRlZ29yeUlkOiAnY2F0ZWdvcnlJZCcsXG4gIGFnZW50SWQ6ICdhZ2VudElkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgVXNlclNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgZW1haWw6ICdlbWFpbCcsXG4gIHBhc3N3b3JkOiAncGFzc3dvcmQnLFxuICBnb29nbGVJZDogJ2dvb2dsZUlkJyxcbiAgcGhvbmU6ICdwaG9uZScsXG4gIGF2YXRhclVybDogJ2F2YXRhclVybCcsXG4gIHJvbGU6ICdyb2xlJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgYXV0aFByb3ZpZGVyOiAnYXV0aFByb3ZpZGVyJyxcbiAgZW1haWxWZXJpZmllZDogJ2VtYWlsVmVyaWZpZWQnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICB0b2tlblZlcnNpb246ICd0b2tlblZlcnNpb24nLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFVzZXJTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFVzZXJTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBVc2VyU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBXaXNobGlzdEl0ZW1TY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYWNrYWdlSWQ6ICdwYWNrYWdlSWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFdpc2hsaXN0SXRlbVNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgV2lzaGxpc3RJdGVtU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgV2lzaGxpc3RJdGVtU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBTb3J0T3JkZXIgPSB7XG4gIGFzYzogJ2FzYycsXG4gIGRlc2M6ICdkZXNjJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBTb3J0T3JkZXIgPSAodHlwZW9mIFNvcnRPcmRlcilba2V5b2YgdHlwZW9mIFNvcnRPcmRlcl1cblxuXG5leHBvcnQgY29uc3QgUXVlcnlNb2RlID0ge1xuICBkZWZhdWx0OiAnZGVmYXVsdCcsXG4gIGluc2Vuc2l0aXZlOiAnaW5zZW5zaXRpdmUnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5TW9kZSA9ICh0eXBlb2YgUXVlcnlNb2RlKVtrZXlvZiB0eXBlb2YgUXVlcnlNb2RlXVxuXG5cbmV4cG9ydCBjb25zdCBOdWxsc09yZGVyID0ge1xuICBmaXJzdDogJ2ZpcnN0JyxcbiAgbGFzdDogJ2xhc3QnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE51bGxzT3JkZXIgPSAodHlwZW9mIE51bGxzT3JkZXIpW2tleW9mIHR5cGVvZiBOdWxsc09yZGVyXVxuXG5cblxuLyoqXG4gKiBGaWVsZCByZWZlcmVuY2VzXG4gKi9cblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1N0cmluZydcbiAqL1xuZXhwb3J0IHR5cGUgU3RyaW5nRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnU3RyaW5nJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1N0cmluZ1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0U3RyaW5nRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnU3RyaW5nW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQm9vbGVhbidcbiAqL1xuZXhwb3J0IHR5cGUgQm9vbGVhbkZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Jvb2xlYW4nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGF0ZVRpbWUnXG4gKi9cbmV4cG9ydCB0eXBlIERhdGVUaW1lRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRGF0ZVRpbWUnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGF0ZVRpbWVbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdERhdGVUaW1lRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRGF0ZVRpbWVbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQb3N0U3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUG9zdFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1Bvc3RTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUG9zdFN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBvc3RTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQb3N0U3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnSW50J1xuICovXG5leHBvcnQgdHlwZSBJbnRGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdJbnQnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnSW50W10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RJbnRGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdJbnRbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEZWNpbWFsJ1xuICovXG5leHBvcnQgdHlwZSBEZWNpbWFsRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRGVjaW1hbCc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEZWNpbWFsW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3REZWNpbWFsRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRGVjaW1hbFtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Jvb2tpbmdTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Cb29raW5nU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQm9va2luZ1N0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29raW5nU3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtQm9va2luZ1N0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Jvb2tpbmdTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdOb3RpZmljYXRpb25UeXBlJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtTm90aWZpY2F0aW9uVHlwZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ05vdGlmaWNhdGlvblR5cGUnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnTm90aWZpY2F0aW9uVHlwZVtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bU5vdGlmaWNhdGlvblR5cGVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdOb3RpZmljYXRpb25UeXBlW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGF5bWVudFN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBheW1lbnRTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYXltZW50U3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BheW1lbnRTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1QYXltZW50U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGF5bWVudFN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Zsb2F0J1xuICovXG5leHBvcnQgdHlwZSBGbG9hdEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Zsb2F0Jz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Zsb2F0W10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RGbG9hdEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Zsb2F0W10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGFja2FnZVN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBhY2thZ2VTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYWNrYWdlU3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BhY2thZ2VTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1QYWNrYWdlU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGFja2FnZVN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1JvbGUnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Sb2xlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUm9sZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdSb2xlW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUm9sZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1JvbGVbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdVc2VyU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtVXNlclN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1VzZXJTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnVXNlclN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVVzZXJTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdVc2VyU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQXV0aFByb3ZpZGVyJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtQXV0aFByb3ZpZGVyRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQXV0aFByb3ZpZGVyJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0F1dGhQcm92aWRlcltdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bUF1dGhQcm92aWRlckZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0F1dGhQcm92aWRlcltdJz5cbiAgICBcblxuLyoqXG4gKiBCYXRjaCBQYXlsb2FkIGZvciB1cGRhdGVNYW55ICYgZGVsZXRlTWFueSAmIGNyZWF0ZU1hbnlcbiAqL1xuZXhwb3J0IHR5cGUgQmF0Y2hQYXlsb2FkID0ge1xuICBjb3VudDogbnVtYmVyXG59XG5cbmV4cG9ydCBjb25zdCBkZWZpbmVFeHRlbnNpb24gPSBydW50aW1lLkV4dGVuc2lvbnMuZGVmaW5lRXh0ZW5zaW9uIGFzIHVua25vd24gYXMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkV4dGVuZHNIb29rPFwiZGVmaW5lXCIsIFR5cGVNYXBDYiwgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzPlxuZXhwb3J0IHR5cGUgRGVmYXVsdFByaXNtYUNsaWVudCA9IFByaXNtYUNsaWVudFxuZXhwb3J0IHR5cGUgRXJyb3JGb3JtYXQgPSAncHJldHR5JyB8ICdjb2xvcmxlc3MnIHwgJ21pbmltYWwnXG4vKipcbiAqIE9wdGlvbnMgY29tbW9uIHRvIGFsbCB2YXJpYW50cyBvZiBgUHJpc21hQ2xpZW50T3B0aW9uc2AsIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB5b3UgY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggYSBkcml2ZXIgYWRhcHRlciBvciB0aHJvdWdoIFByaXNtYSBBY2NlbGVyYXRlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudEJhc2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIEBkZWZhdWx0IFwiY29sb3JsZXNzXCJcbiAgICovXG4gIGVycm9yRm9ybWF0PzogRXJyb3JGb3JtYXRcbiAgLyoqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiAvLyBTaG9ydGhhbmQgZm9yIGBlbWl0OiAnc3Rkb3V0J2BcbiAgICogbG9nOiBbJ3F1ZXJ5JywgJ2luZm8nLCAnd2FybicsICdlcnJvciddXG4gICAqIFxuICAgKiAvLyBFbWl0IGFzIGV2ZW50cyBvbmx5XG4gICAqIGxvZzogW1xuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdxdWVyeScgfSxcbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAnaW5mbycgfSxcbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAnd2FybicgfVxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdlcnJvcicgfVxuICAgKiBdXG4gICAqIFxuICAgKiAvIEVtaXQgYXMgZXZlbnRzIGFuZCBsb2cgdG8gc3Rkb3V0XG4gICAqIG9nOiBbXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ3F1ZXJ5JyB9LFxuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICdpbmZvJyB9LFxuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICd3YXJuJyB9XG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ2Vycm9yJyB9XG4gICAqIFxuICAgKiBgYGBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvbG9nZ2luZykuXG4gICAqL1xuICBsb2c/OiAoTG9nTGV2ZWwgfCBMb2dEZWZpbml0aW9uKVtdXG4gIC8qKlxuICAgKiBUaGUgZGVmYXVsdCB2YWx1ZXMgZm9yIHRyYW5zYWN0aW9uT3B0aW9uc1xuICAgKiBtYXhXYWl0ID89IDIwMDBcbiAgICogdGltZW91dCA/PSA1MDAwXG4gICAqL1xuICB0cmFuc2FjdGlvbk9wdGlvbnM/OiB7XG4gICAgbWF4V2FpdD86IG51bWJlclxuICAgIHRpbWVvdXQ/OiBudW1iZXJcbiAgICBpc29sYXRpb25MZXZlbD86IFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWxcbiAgfVxuICAvKipcbiAgICogR2xvYmFsIGNvbmZpZ3VyYXRpb24gZm9yIG9taXR0aW5nIG1vZGVsIGZpZWxkcyBieSBkZWZhdWx0LlxuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIG9taXQ6IHtcbiAgICogICAgIHVzZXI6IHtcbiAgICogICAgICAgcGFzc3dvcmQ6IHRydWVcbiAgICogICAgIH1cbiAgICogICB9XG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgb21pdD86IEdsb2JhbE9taXRDb25maWdcbiAgLyoqXG4gICAqIFNRTCBjb21tZW50ZXIgcGx1Z2lucyB0aGF0IGFkZCBtZXRhZGF0YSB0byBTUUwgcXVlcmllcyBhcyBjb21tZW50cy5cbiAgICogQ29tbWVudHMgZm9sbG93IHRoZSBzcWxjb21tZW50ZXIgZm9ybWF0OiBodHRwczovL2dvb2dsZS5naXRodWIuaW8vc3FsY29tbWVudGVyL1xuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXIsXG4gICAqICAgY29tbWVudHM6IFtcbiAgICogICAgIHRyYWNlQ29udGV4dCgpLFxuICAgKiAgICAgcXVlcnlJbnNpZ2h0cygpLFxuICAgKiAgIF0sXG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgY29tbWVudHM/OiBydW50aW1lLlNxbENvbW1lbnRlclBsdWdpbltdXG4gIC8qKlxuICAgKiBPcHRpb25hbCBtYXhpbXVtIHNpemUgZm9yIHRoZSBxdWVyeSBwbGFuIGNhY2hlLiBJZiBub3QgcHJvdmlkZWQsIGEgZGVmYXVsdCBzaXplIHdpbGwgYmUgdXNlZC5cbiAgICogQSB2YWx1ZSBvZiBgMGAgY2FuIGJlIHVzZWQgdG8gZGlzYWJsZSB0aGUgY2FjaGUgZW50aXJlbHkuIEEgaGlnaGVyIGNhY2hlIHNpemUgY2FuIGltcHJvdmVcbiAgICogcGVyZm9ybWFuY2UgZm9yIGFwcGxpY2F0aW9ucyB0aGF0IGV4ZWN1dGUgYSBsYXJnZSBudW1iZXIgb2YgdW5pcXVlIHF1ZXJpZXMsIHdoaWxlIGEgc21hbGxlclxuICAgKiBjYWNoZSBzaXplIGNhbiByZWR1Y2UgbWVtb3J5IHVzYWdlLlxuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXIsXG4gICAqICAgcXVlcnlQbGFuQ2FjaGVNYXhTaXplOiAxMDAsXG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgcXVlcnlQbGFuQ2FjaGVNYXhTaXplPzogbnVtYmVyXG59XG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgb3B0aW9ucyBmb3IgY29ubmVjdGluZyB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgaW5zdGVhZCBvZiBhIGRyaXZlciBhZGFwdGVyLlxuICogXG4gKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9hY2NlbGVyYXRlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBY2NlbGVyYXRlVXJsIGV4dGVuZHMgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIFByaXNtYSBBY2NlbGVyYXRlIGNvbm5lY3Rpb24gVVJMLiBVc2UgdGhpcyBvcHRpb24gdG8gY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgaW5zdGVhZCBvZiB1c2luZyBhIGRyaXZlciBhZGFwdGVyIHRvIGNvbm5lY3QgZGlyZWN0bHkuXG4gICAqIFxuICAgKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9hY2NlbGVyYXRlXG4gICAqL1xuICBhY2NlbGVyYXRlVXJsOiBzdHJpbmdcbiAgYWRhcHRlcj86IG5ldmVyXG59XG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgb3B0aW9ucyBmb3IgY29ubmVjdGluZyB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggYSBkcml2ZXIgYWRhcHRlci4gVGhpcyBpcyB0aGUgY29tbW9uIGNhc2UgaW4gUHJpc21hIDcuXG4gKiBcbiAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWRhcHRlciBleHRlbmRzIFByaXNtYUNsaWVudEJhc2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIEEgZHJpdmVyIGFkYXB0ZXIgdGhhdCBQcmlzbWFDbGllbnQgdXNlcyB0byBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UsIHN1Y2ggYXMgdGhlIG9uZXMgcHJvdmlkZWQgYnkgYEBwcmlzbWEvYWRhcHRlci1wZ2AsIGBAcHJpc21hL2FkYXB0ZXItbGlic3FsYCwgYEBwcmlzbWEvYWRhcHRlci1wbGFuZXRzY2FsZWAsIGV0Yy5cbiAgICogXG4gICAqIEEgZHJpdmVyIGFkYXB0ZXIgaXMgKipyZXF1aXJlZCoqIHVubGVzcyB5b3UgY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgKGluIHdoaWNoIGNhc2UgdXNlIGBhY2NlbGVyYXRlVXJsYCBpbnN0ZWFkKS5cbiAgICogXG4gICAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgUHJpc21hUGcgfSBmcm9tICdAcHJpc21hL2FkYXB0ZXItcGcnXG4gICAqIGltcG9ydCB7IFByaXNtYUNsaWVudCB9IGZyb20gJy4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnQnXG4gICAqIFxuICAgKiBjb25zdCBhZGFwdGVyID0gbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoeyBhZGFwdGVyIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgYWRhcHRlcjogcnVudGltZS5TcWxEcml2ZXJBZGFwdGVyRmFjdG9yeVxuICBhY2NlbGVyYXRlVXJsPzogbmV2ZXJcbn1cblxuLyoqXG4gKiBPcHRpb25zIHBhc3NlZCB0byB0aGUgYFByaXNtYUNsaWVudGAgY29uc3RydWN0b3IuXG4gKiBcbiAqIEEgZHJpdmVyIGFkYXB0ZXIgKG9yLCBhbHRlcm5hdGl2ZWx5LCBhIFByaXNtYSBBY2NlbGVyYXRlIFVSTCkgaXMgKipyZXF1aXJlZCoqLiBTZWUge0BsaW5rIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWRhcHRlcn0gYW5kIHtAbGluayBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmx9IGZvciB0aGUgdHdvIHZhcmlhbnRzLiBBbGwgb3RoZXIgcHJvcGVydGllcyBsaXZlIGluIHtAbGluayBQcmlzbWFDbGllbnRCYXNlT3B0aW9uc30gYW5kIGFyZSBvcHRpb25hbC5cbiAqIFxuICogTGVhcm4gbW9yZSBhYm91dCBkcml2ZXIgYWRhcHRlcnM6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICovXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRPcHRpb25zID0gUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBY2NlbGVyYXRlVXJsIHwgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyXG5leHBvcnQgdHlwZSBHbG9iYWxPbWl0Q29uZmlnID0ge1xuICBibG9nQ29tbWVudD86IFByaXNtYS5CbG9nQ29tbWVudE9taXRcbiAgYmxvZ1Bvc3Q/OiBQcmlzbWEuQmxvZ1Bvc3RPbWl0XG4gIGJvb2tpbmc/OiBQcmlzbWEuQm9va2luZ09taXRcbiAgY2F0ZWdvcnk/OiBQcmlzbWEuQ2F0ZWdvcnlPbWl0XG4gIGNvbnRhY3RNZXNzYWdlPzogUHJpc21hLkNvbnRhY3RNZXNzYWdlT21pdFxuICBub3RpZmljYXRpb24/OiBQcmlzbWEuTm90aWZpY2F0aW9uT21pdFxuICBwYXltZW50PzogUHJpc21hLlBheW1lbnRPbWl0XG4gIHJlZnJlc2hUb2tlbj86IFByaXNtYS5SZWZyZXNoVG9rZW5PbWl0XG4gIHJldmlldz86IFByaXNtYS5SZXZpZXdPbWl0XG4gIHRvdXJQYWNrYWdlPzogUHJpc21hLlRvdXJQYWNrYWdlT21pdFxuICB1c2VyPzogUHJpc21hLlVzZXJPbWl0XG4gIHdpc2hsaXN0SXRlbT86IFByaXNtYS5XaXNobGlzdEl0ZW1PbWl0XG59XG5cbi8qIFR5cGVzIGZvciBMb2dnaW5nICovXG5leHBvcnQgdHlwZSBMb2dMZXZlbCA9ICdpbmZvJyB8ICdxdWVyeScgfCAnd2FybicgfCAnZXJyb3InXG5leHBvcnQgdHlwZSBMb2dEZWZpbml0aW9uID0ge1xuICBsZXZlbDogTG9nTGV2ZWxcbiAgZW1pdDogJ3N0ZG91dCcgfCAnZXZlbnQnXG59XG5cbmV4cG9ydCB0eXBlIENoZWNrSXNMb2dMZXZlbDxUPiA9IFQgZXh0ZW5kcyBMb2dMZXZlbCA/IFQgOiBuZXZlcjtcblxuZXhwb3J0IHR5cGUgR2V0TG9nVHlwZTxUPiA9IENoZWNrSXNMb2dMZXZlbDxcbiAgVCBleHRlbmRzIExvZ0RlZmluaXRpb24gPyBUWydsZXZlbCddIDogVFxuPjtcblxuZXhwb3J0IHR5cGUgR2V0RXZlbnRzPFQgZXh0ZW5kcyBhbnlbXT4gPSBUIGV4dGVuZHMgQXJyYXk8TG9nTGV2ZWwgfCBMb2dEZWZpbml0aW9uPlxuICA/IEdldExvZ1R5cGU8VFtudW1iZXJdPlxuICA6IG5ldmVyO1xuXG5leHBvcnQgdHlwZSBRdWVyeUV2ZW50ID0ge1xuICB0aW1lc3RhbXA6IERhdGVcbiAgcXVlcnk6IHN0cmluZ1xuICBwYXJhbXM6IHN0cmluZ1xuICBkdXJhdGlvbjogbnVtYmVyXG4gIHRhcmdldDogc3RyaW5nXG59XG5cbmV4cG9ydCB0eXBlIExvZ0V2ZW50ID0ge1xuICB0aW1lc3RhbXA6IERhdGVcbiAgbWVzc2FnZTogc3RyaW5nXG4gIHRhcmdldDogc3RyaW5nXG59XG4vKiBFbmQgVHlwZXMgZm9yIExvZ2dpbmcgKi9cblxuXG5leHBvcnQgdHlwZSBQcmlzbWFBY3Rpb24gPVxuICB8ICdmaW5kVW5pcXVlJ1xuICB8ICdmaW5kVW5pcXVlT3JUaHJvdydcbiAgfCAnZmluZE1hbnknXG4gIHwgJ2ZpbmRGaXJzdCdcbiAgfCAnZmluZEZpcnN0T3JUaHJvdydcbiAgfCAnY3JlYXRlJ1xuICB8ICdjcmVhdGVNYW55J1xuICB8ICdjcmVhdGVNYW55QW5kUmV0dXJuJ1xuICB8ICd1cGRhdGUnXG4gIHwgJ3VwZGF0ZU1hbnknXG4gIHwgJ3VwZGF0ZU1hbnlBbmRSZXR1cm4nXG4gIHwgJ3Vwc2VydCdcbiAgfCAnZGVsZXRlJ1xuICB8ICdkZWxldGVNYW55J1xuICB8ICdleGVjdXRlUmF3J1xuICB8ICdxdWVyeVJhdydcbiAgfCAnYWdncmVnYXRlJ1xuICB8ICdjb3VudCdcbiAgfCAncnVuQ29tbWFuZFJhdydcbiAgfCAnZmluZFJhdydcbiAgfCAnZ3JvdXBCeSdcblxuLyoqXG4gKiBgUHJpc21hQ2xpZW50YCBwcm94eSBhdmFpbGFibGUgaW4gaW50ZXJhY3RpdmUgdHJhbnNhY3Rpb25zLlxuICovXG5leHBvcnQgdHlwZSBUcmFuc2FjdGlvbkNsaWVudCA9IE9taXQ8RGVmYXVsdFByaXNtYUNsaWVudCwgcnVudGltZS5JVFhDbGllbnREZW55TGlzdD5cblxuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuKiBUaGlzIGZpbGUgZXhwb3J0cyBhbGwgZW51bSByZWxhdGVkIHR5cGVzIGZyb20gdGhlIHNjaGVtYS5cbipcbiogXHVEODNEXHVERkUyIFlvdSBjYW4gaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseS5cbiovXG5cbmV4cG9ydCBjb25zdCBSb2xlID0ge1xuICBVU0VSOiAnVVNFUicsXG4gIEFHRU5UOiAnQUdFTlQnLFxuICBBRE1JTjogJ0FETUlOJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBSb2xlID0gKHR5cGVvZiBSb2xlKVtrZXlvZiB0eXBlb2YgUm9sZV1cblxuXG5leHBvcnQgY29uc3QgVXNlclN0YXR1cyA9IHtcbiAgQUNUSVZFOiAnQUNUSVZFJyxcbiAgU1VTUEVOREVEOiAnU1VTUEVOREVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBVc2VyU3RhdHVzID0gKHR5cGVvZiBVc2VyU3RhdHVzKVtrZXlvZiB0eXBlb2YgVXNlclN0YXR1c11cblxuXG5leHBvcnQgY29uc3QgQXV0aFByb3ZpZGVyID0ge1xuICBDUkVERU5USUFMOiAnQ1JFREVOVElBTCcsXG4gIEdPT0dMRTogJ0dPT0dMRSdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQXV0aFByb3ZpZGVyID0gKHR5cGVvZiBBdXRoUHJvdmlkZXIpW2tleW9mIHR5cGVvZiBBdXRoUHJvdmlkZXJdXG5cblxuZXhwb3J0IGNvbnN0IFBhY2thZ2VTdGF0dXMgPSB7XG4gIFBFTkRJTkc6ICdQRU5ESU5HJyxcbiAgQVBQUk9WRUQ6ICdBUFBST1ZFRCcsXG4gIFJFSkVDVEVEOiAnUkVKRUNURUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBhY2thZ2VTdGF0dXMgPSAodHlwZW9mIFBhY2thZ2VTdGF0dXMpW2tleW9mIHR5cGVvZiBQYWNrYWdlU3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBCb29raW5nU3RhdHVzID0ge1xuICBQRU5ESU5HOiAnUEVORElORycsXG4gIFBBSUQ6ICdQQUlEJyxcbiAgQ09ORklSTUVEOiAnQ09ORklSTUVEJyxcbiAgQ0FOQ0VMTEVEOiAnQ0FOQ0VMTEVEJyxcbiAgQ09NUExFVEVEOiAnQ09NUExFVEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBCb29raW5nU3RhdHVzID0gKHR5cGVvZiBCb29raW5nU3RhdHVzKVtrZXlvZiB0eXBlb2YgQm9va2luZ1N0YXR1c11cblxuXG5leHBvcnQgY29uc3QgUGF5bWVudFN0YXR1cyA9IHtcbiAgSU5JVElBVEVEOiAnSU5JVElBVEVEJyxcbiAgU1VDQ0VTUzogJ1NVQ0NFU1MnLFxuICBGQUlMRUQ6ICdGQUlMRUQnLFxuICBDQU5DRUxMRUQ6ICdDQU5DRUxMRUQnLFxuICBSRUZVTkRFRDogJ1JFRlVOREVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQYXltZW50U3RhdHVzID0gKHR5cGVvZiBQYXltZW50U3RhdHVzKVtrZXlvZiB0eXBlb2YgUGF5bWVudFN0YXR1c11cblxuXG5leHBvcnQgY29uc3QgUG9zdFN0YXR1cyA9IHtcbiAgRFJBRlQ6ICdEUkFGVCcsXG4gIFBVQkxJU0hFRDogJ1BVQkxJU0hFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUG9zdFN0YXR1cyA9ICh0eXBlb2YgUG9zdFN0YXR1cylba2V5b2YgdHlwZW9mIFBvc3RTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IE5vdGlmaWNhdGlvblR5cGUgPSB7XG4gIEJPT0tJTkdfQ1JFQVRFRDogJ0JPT0tJTkdfQ1JFQVRFRCcsXG4gIEJPT0tJTkdfQ09ORklSTUVEOiAnQk9PS0lOR19DT05GSVJNRUQnLFxuICBCT09LSU5HX0NBTkNFTExFRDogJ0JPT0tJTkdfQ0FOQ0VMTEVEJyxcbiAgUEFDS0FHRV9BUFBST1ZFRDogJ1BBQ0tBR0VfQVBQUk9WRUQnLFxuICBQQUNLQUdFX1JFSkVDVEVEOiAnUEFDS0FHRV9SRUpFQ1RFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgTm90aWZpY2F0aW9uVHlwZSA9ICh0eXBlb2YgTm90aWZpY2F0aW9uVHlwZSlba2V5b2YgdHlwZW9mIE5vdGlmaWNhdGlvblR5cGVdXG4iLCAiLy8gQXBwRXJyb3Iga2VlcHMgdGhlIGV4YWN0IHNhbWUgXCJqdXN0IHRocm93IGl0XCIgZXJnb25vbWljcyBidXQgY2Fycmllc1xuLy8gYSBzdGF0dXNDb2RlIHRoZSBnbG9iYWwgaGFuZGxlciBjYW4gcmVhZCAoc2VlIG1pZGRsZXdhcmUvZ2xvYmFsRXJyb3JIYW5kbGVyLnRzKS5cbmV4cG9ydCBjbGFzcyBBcHBFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgc3RhdHVzQ29kZTogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKHN0YXR1c0NvZGU6IG51bWJlciwgbWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gXCJBcHBFcnJvclwiO1xuICAgIHRoaXMuc3RhdHVzQ29kZSA9IHN0YXR1c0NvZGU7XG4gICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgdGhpcy5jb25zdHJ1Y3Rvcik7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBQcmlzbWFQZyB9IGZyb20gXCJAcHJpc21hL2FkYXB0ZXItcGdcIjtcbmltcG9ydCB7IFByaXNtYUNsaWVudCB9IGZyb20gXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmNvbnN0IGNvbm5lY3Rpb25TdHJpbmcgPSBjb25maWcuZGF0YWJhc2VfdXJsO1xuXG4vLyBTZXJ2ZXJsZXNzLWZyaWVuZGx5IHBvb2w6IG9uZSBjb25uZWN0aW9uIHBlciB3YXJtIGluc3RhbmNlIHNvIG1hbnlcbi8vIGNvbmN1cnJlbnQgaW52b2NhdGlvbnMgY2FuJ3QgZXhoYXVzdCB0aGUgZGF0YWJhc2UncyBjb25uZWN0aW9uIGxpbWl0LlxuLy8gTG9jYWwvVk0gcnVucyBhcmUgdW5hZmZlY3RlZCAoYSBzaW5nbGUgcHJvY2VzcyB1c2VzIG9uZSBjb25uZWN0aW9uIGFueXdheSkuXG5jb25zdCBhZGFwdGVyID0gbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZywgbWF4OiAxIH0pO1xuY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7IGFkYXB0ZXIgfSk7XG5cbmV4cG9ydCB7IHByaXNtYSB9O1xuIiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBhdXRoQ29udHJvbGxlciB9IGZyb20gXCIuL2F1dGguY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYXV0aFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYXV0aC52YWxpZGF0aW9uXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gUmVnaXN0ZXIgXHUyMDE0IHJvbGUgaXMgb3B0aW9uYWwgYW5kIHJlc3RyaWN0ZWQgdG8gVVNFUi9BR0VOVCBpbiB0aGUgc2VydmljZVxucm91dGVyLnBvc3QoXG4gIFwiL3JlZ2lzdGVyXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5yZWdpc3RlclNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIucmVnaXN0ZXJVc2VyLFxuKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL2xvZ2luXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5sb2dpblNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIubG9naW5Vc2VyLFxuKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL2dvb2dsZVwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMuZ29vZ2xlTG9naW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmdvb2dsZUxvZ2luLFxuKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL2RlbW8tbG9naW5cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmRlbW9Mb2dpblNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIuZGVtb0xvZ2luLFxuKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL3JlZnJlc2hcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLnJlZnJlc2hUb2tlblNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIucmVmcmVzaFRva2VuLFxuKTtcblxucm91dGVyLnBvc3QoXCIvbG9nb3V0XCIsIGF1dGgoKSwgYXV0aENvbnRyb2xsZXIubG9nb3V0VXNlcik7XG5cbnJvdXRlci5nZXQoXCIvbWVcIiwgYXV0aCgpLCBhdXRoQ29udHJvbGxlci5nZXRNZSk7XG5cbi8vIFN0ZXAgMjEgXHUyMDE0IGVtYWlsIHZlcmlmaWNhdGlvbiArIHBhc3N3b3JkIHJlc2V0IChhbGwgcHVibGljOyByYXRlLWxpbWl0ZWQgdmlhXG4vLyBhdXRoTGltaXRlciBpbiBhcHAudHMgdG8gYm91bmQgT1RQIGJydXRlIGZvcmNlICsgZW1haWwgYm9tYmluZylcbnJvdXRlci5wb3N0KFxuICBcIi92ZXJpZnktZW1haWxcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLnZlcmlmeUVtYWlsU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci52ZXJpZnlFbWFpbCxcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9yZXNlbmQtdmVyaWZpY2F0aW9uXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5yZXNlbmRWZXJpZmljYXRpb25TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlc2VuZFZlcmlmaWNhdGlvbixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9mb3Jnb3QtcGFzc3dvcmRcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmZvcmdvdFBhc3N3b3JkU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5mb3Jnb3RQYXNzd29yZCxcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9yZXNldC1wYXNzd29yZFwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVzZXRQYXNzd29yZFNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIucmVzZXRQYXNzd29yZCxcbik7XG5cbmV4cG9ydCBjb25zdCBhdXRoUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgYXV0aFNlcnZpY2UgfSBmcm9tIFwiLi9hdXRoLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG5jb25zdCBpc1Byb2R1Y3Rpb24gPSBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gXCJwcm9kdWN0aW9uXCI7XG5cbi8vIERldiAobG9jYWxob3N0OjMwMDAgXHUyMTkyIDo0MDAwKSBpcyBzYW1lLXNpdGUgXHUyMTkyIGxheCB3b3JrcyB3aXRoIHNlY3VyZTpmYWxzZS5cbi8vIFByb2QgKGNyb3NzLXNpdGUgZnJvbnRlbmQvYmFja2VuZCkgcmVxdWlyZXMgU2FtZVNpdGU9Tm9uZSArIFNlY3VyZS5cbmNvbnN0IGNvb2tpZU9wdGlvbnM6IHtcbiAgaHR0cE9ubHk6IHRydWU7XG4gIHNlY3VyZTogYm9vbGVhbjtcbiAgc2FtZVNpdGU6IFwibGF4XCIgfCBcIm5vbmVcIjtcbn0gPSB7XG4gIGh0dHBPbmx5OiB0cnVlLFxuICBzZWN1cmU6IGlzUHJvZHVjdGlvbixcbiAgc2FtZVNpdGU6IGlzUHJvZHVjdGlvbiA/IFwibm9uZVwiIDogXCJsYXhcIixcbn07XG5cbmNvbnN0IEFDQ0VTU19DT09LSUVfTUFYX0FHRSA9IDI0ICogNjAgKiA2MCAqIDEwMDA7IC8vIDEgZGF5XG5jb25zdCBSRUZSRVNIX0NPT0tJRV9NQVhfQUdFID0gMzAgKiAyNCAqIDYwICogNjAgKiAxMDAwOyAvLyAzMCBkYXlzXG5cbmNvbnN0IHNldEF1dGhDb29raWVzID0gKFxuICByZXM6IFJlc3BvbnNlLFxuICB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfTogeyBhY2Nlc3NUb2tlbjogc3RyaW5nOyByZWZyZXNoVG9rZW46IHN0cmluZyB9LFxuKSA9PiB7XG4gIHJlcy5jb29raWUoXCJhY2Nlc3NUb2tlblwiLCBhY2Nlc3NUb2tlbiwge1xuICAgIC4uLmNvb2tpZU9wdGlvbnMsXG4gICAgbWF4QWdlOiBBQ0NFU1NfQ09PS0lFX01BWF9BR0UsXG4gIH0pO1xuICByZXMuY29va2llKFwicmVmcmVzaFRva2VuXCIsIHJlZnJlc2hUb2tlbiwge1xuICAgIC4uLmNvb2tpZU9wdGlvbnMsXG4gICAgbWF4QWdlOiBSRUZSRVNIX0NPT0tJRV9NQVhfQUdFLFxuICB9KTtcbn07XG5cbmNvbnN0IGNsZWFyQXV0aENvb2tpZXMgPSAocmVzOiBSZXNwb25zZSkgPT4ge1xuICByZXMuY2xlYXJDb29raWUoXCJhY2Nlc3NUb2tlblwiLCBjb29raWVPcHRpb25zKTtcbiAgcmVzLmNsZWFyQ29va2llKFwicmVmcmVzaFRva2VuXCIsIGNvb2tpZU9wdGlvbnMpO1xufTtcblxuLy8gUmVnaXN0ZXIgY29udHJvbGxlciBcdTIwMTQgc3RhZ2VzIHRoZSBhY2NvdW50IGluIFJlZGlzIGFuZCBlbWFpbHMgYW4gT1RQOyB0aGVcbi8vIHVzZXIgcm93IGlzIGNyZWF0ZWQgYnkgdmVyaWZ5LWVtYWlsLlxuY29uc3QgcmVnaXN0ZXJVc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgYXdhaXQgYXV0aFNlcnZpY2UucmVnaXN0ZXJVc2VyKHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlZlcmlmaWNhdGlvbiBPVFAgc2VudCB0byB5b3VyIGVtYWlsLlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIExvZ2luIGNvbnRyb2xsZXJcbmNvbnN0IGxvZ2luVXNlciA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9ID0gYXdhaXQgYXV0aFNlcnZpY2UubG9naW5Vc2VyKHJlcS5ib2R5KTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHb29nbGUgbG9naW4gKElELXRva2VuIGZsb3cpXG5jb25zdCBnb29nbGVMb2dpbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9ID0gYXdhaXQgYXV0aFNlcnZpY2UuZ29vZ2xlTG9naW4oXG4gICAgICByZXEuYm9keSxcbiAgICApO1xuXG4gICAgc2V0QXV0aENvb2tpZXMocmVzLCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIERlbW8gbG9naW4gY29udHJvbGxlclxuY29uc3QgZGVtb0xvZ2luID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0gPSBhd2FpdCBhdXRoU2VydmljZS5kZW1vTG9naW4oXG4gICAgICByZXEuYm9keSxcbiAgICApO1xuXG4gICAgc2V0QXV0aENvb2tpZXMocmVzLCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGVtbyB1c2VyIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gVmVyaWZ5IGVtYWlsIGNvbnRyb2xsZXIgXHUyMDE0IGNyZWF0ZXMgdGhlIHVzZXIgYW5kIGF1dG8tbG9ncy1pbiAodG9rZW5zIGFzXG4vLyBjb29raWVzICsgYm9keSksIG1pcnJvcmluZyB0aGUgcmVmZXJlbmNlIGJhY2tlbmQuXG5jb25zdCB2ZXJpZnlFbWFpbCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9ID0gYXdhaXQgYXV0aFNlcnZpY2UudmVyaWZ5RW1haWwoXG4gICAgICByZXEuYm9keSxcbiAgICApO1xuXG4gICAgc2V0QXV0aENvb2tpZXMocmVzLCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRW1haWwgdmVyaWZpZWQgc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFJlc2VuZCB2ZXJpZmljYXRpb24gY29udHJvbGxlciBcdTIwMTQgYWx3YXlzIDIwMCAobm8gZW51bWVyYXRpb24pLlxuY29uc3QgcmVzZW5kVmVyaWZpY2F0aW9uID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgYXdhaXQgYXV0aFNlcnZpY2UucmVzZW5kVmVyaWZpY2F0aW9uKHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJWZXJpZmljYXRpb24gT1RQIHNlbnQgdG8geW91ciBlbWFpbC5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBGb3Jnb3QgcGFzc3dvcmQgY29udHJvbGxlciBcdTIwMTQgYWx3YXlzIDIwMCAobm8gZW51bWVyYXRpb24pLlxuY29uc3QgZm9yZ290UGFzc3dvcmQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBhd2FpdCBhdXRoU2VydmljZS5mb3Jnb3RQYXNzd29yZChyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6XG4gICAgICAgIFwiSWYgYW4gYWNjb3VudCB3aXRoIHRoYXQgZW1haWwgZXhpc3RzLCBhIHBhc3N3b3JkIHJlc2V0IE9UUCBoYXMgYmVlbiBzZW50LlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFJlc2V0IHBhc3N3b3JkIGNvbnRyb2xsZXJcbmNvbnN0IHJlc2V0UGFzc3dvcmQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBhd2FpdCBhdXRoU2VydmljZS5yZXNldFBhc3N3b3JkKHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYXNzd29yZCByZXNldCBzdWNjZXNzZnVsbHkuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBSZWZyZXNoIHRva2VuIGNvbnRyb2xsZXJcbmNvbnN0IHJlZnJlc2hUb2tlbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlZnJlc2hUb2tlbkZyb21Db29raWUgPSByZXEuY29va2llcy5yZWZyZXNoVG9rZW47XG4gICAgY29uc3QgcmVmcmVzaFRva2VuRnJvbUJvZHkgPSByZXEuYm9keT8ucmVmcmVzaFRva2VuO1xuXG4gICAgaWYgKCFyZWZyZXNoVG9rZW5Gcm9tQ29va2llICYmICFyZWZyZXNoVG9rZW5Gcm9tQm9keSkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuVU5BVVRIT1JJWkVELFxuICAgICAgICBtZXNzYWdlOiBcIlJlZnJlc2ggdG9rZW4gaXMgcmVxdWlyZWRcIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbjogbmV3UmVmcmVzaFRva2VuIH0gPVxuICAgICAgYXdhaXQgYXV0aFNlcnZpY2UucmVmcmVzaFRva2VuKHtcbiAgICAgICAgcmVmcmVzaFRva2VuOiByZWZyZXNoVG9rZW5Gcm9tQ29va2llIHx8IHJlZnJlc2hUb2tlbkZyb21Cb2R5LFxuICAgICAgfSk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHtcbiAgICAgIGFjY2Vzc1Rva2VuLFxuICAgICAgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4sXG4gICAgfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVG9rZW4gcmVmcmVzaGVkIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4gfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIExvZ291dCBjb250cm9sbGVyXG5jb25zdCBsb2dvdXRVc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLmxvZ291dCh1c2VySWQpO1xuICAgIGNsZWFyQXV0aENvb2tpZXMocmVzKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBvdXQgc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR2V0IE1lIGNvbnRyb2xsZXJcbmNvbnN0IGdldE1lID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhdXRoU2VydmljZS5nZXRNZUZyb21EQih1c2VySWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGF1dGhDb250cm9sbGVyID0ge1xuICByZWdpc3RlclVzZXIsXG4gIHZlcmlmeUVtYWlsLFxuICByZXNlbmRWZXJpZmljYXRpb24sXG4gIGZvcmdvdFBhc3N3b3JkLFxuICByZXNldFBhc3N3b3JkLFxuICBsb2dpblVzZXIsXG4gIGdvb2dsZUxvZ2luLFxuICBkZW1vTG9naW4sXG4gIHJlZnJlc2hUb2tlbixcbiAgbG9nb3V0VXNlcixcbiAgZ2V0TWUsXG59OyIsICJpbXBvcnQgYmNyeXB0IGZyb20gXCJiY3J5cHRqc1wiO1xuaW1wb3J0IGNyeXB0byBmcm9tIFwiY3J5cHRvXCI7XG5pbXBvcnQgeyBkZWNvZGUsIEp3dFBheWxvYWQsIFNpZ25PcHRpb25zIH0gZnJvbSBcImpzb253ZWJ0b2tlblwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgZ29vZ2xlQ2xpZW50IH0gZnJvbSBcIi4uLy4uL2xpYi9nb29nbGVBdXRoXCI7XG5pbXBvcnQgeyBnZXRSZWRpcyB9IGZyb20gXCIuLi8uLi9saWIvcmVkaXNcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBqd3RVdGlscyB9IGZyb20gXCIuLi8uLi91dGlscy9qd3RcIjtcbmltcG9ydCB7XG4gIHNlbmRGb3Jnb3RQYXNzd29yZE90cEVtYWlsLFxuICBzZW5kUGFzc3dvcmRSZXNldFN1Y2Nlc3NFbWFpbCxcbiAgc2VuZFZlcmlmaWNhdGlvbk90cEVtYWlsLFxuICBzZW5kV2VsY29tZUVtYWlsLFxufSBmcm9tIFwiLi4vLi4vdXRpbHMvYXV0aEVtYWlsXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHtcbiAgSUF1dGgsXG4gIElEZW1vTG9naW5QYXlsb2FkLFxuICBJRm9yZ290UGFzc3dvcmRQYXlsb2FkLFxuICBJR29vZ2xlTG9naW5QYXlsb2FkLFxuICBJTG9naW5Vc2VyLFxuICBJUmVmcmVzaFRva2VuUGF5bG9hZCxcbiAgSVJlc2VuZFZlcmlmaWNhdGlvblBheWxvYWQsXG4gIElSZXNldFBhc3N3b3JkUGF5bG9hZCxcbiAgSVZlcmlmeUVtYWlsUGF5bG9hZCxcbn0gZnJvbSBcIi4vYXV0aC5pbnRlcmZhY2VcIjtcblxuY29uc3QgT1RQX0VYUElSQVRJT05fU0VDT05EUyA9IDUgKiA2MDsgLy8gNSBtaW51dGVzIFx1MjAxNCBtYXRjaGVzIHRoZSByZWZlcmVuY2UgYmFja2VuZFxuXG4vLyBTSEEtMjU2IG9mIGEgcmVmcmVzaCBKV1QgXHUyMDE0IHRoZSByb3RhdGlvbiBsZWRnZXIgc3RvcmVzIG9ubHkgdGhpcyBoYXNoLCBuZXZlclxuLy8gdGhlIHRva2VuIGl0c2VsZiwgc28gYSBEQiBsZWFrIGNhbid0IG1pbnQgdXNhYmxlIHJlZnJlc2ggdG9rZW5zLlxuY29uc3Qgc2hhMjU2ID0gKHZhbHVlOiBzdHJpbmcpID0+XG4gIGNyeXB0by5jcmVhdGVIYXNoKFwic2hhMjU2XCIpLnVwZGF0ZSh2YWx1ZSkuZGlnZXN0KFwiaGV4XCIpO1xuXG4vLyBSZWZyZXNoLXRva2VuIGV4cGlyeSByZWFkIGZyb20gdGhlIHNpZ25lZCB0b2tlbidzIGBleHBgIHNvIHRoZSBsZWRnZXIgcm93XG4vLyBhbHdheXMgbWF0Y2hlcyBKV1RfUkVGUkVTSF9FWFBJUkVTX0lOIGV4YWN0bHkuXG5jb25zdCByZWZyZXNoVG9rZW5FeHBpcmVzQXQgPSAodG9rZW46IHN0cmluZykgPT4ge1xuICBjb25zdCBwYXlsb2FkID0gZGVjb2RlKHRva2VuKSBhcyBKd3RQYXlsb2FkIHwgbnVsbDtcbiAgcmV0dXJuIHBheWxvYWQ/LmV4cCA/IG5ldyBEYXRlKHBheWxvYWQuZXhwICogMTAwMCkgOiBuZXcgRGF0ZSgpO1xufTtcblxuLy8gUmVkaXMgT1RQIHN0b3JlIGFjY2Vzc29yIFx1MjAxNCA1MDMgd2hlbiB1bmNvbmZpZ3VyZWQgKG5ldmVyIGEgYm9vdC10aW1lIGNyYXNoKS5cbmNvbnN0IGdldFJlZGlzQ2xpZW50ID0gYXN5bmMgKCkgPT4ge1xuICBjb25zdCBjbGllbnQgPSBhd2FpdCBnZXRSZWRpcygpO1xuICBpZiAoIWNsaWVudCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig1MDMsIFwiRW1haWwgdmVyaWZpY2F0aW9uIGlzIG5vdCBjb25maWd1cmVkLlwiKTtcbiAgfVxuICByZXR1cm4gY2xpZW50O1xufTtcblxuY29uc3QgYnVpbGRUb2tlblBheWxvYWQgPSAodXNlcjoge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIHJvbGU6IFJvbGU7XG4gIHRva2VuVmVyc2lvbjogbnVtYmVyO1xufSkgPT4gKHtcbiAgaWQ6IHVzZXIuaWQsXG4gIG5hbWU6IHVzZXIubmFtZSxcbiAgZW1haWw6IHVzZXIuZW1haWwsXG4gIHJvbGU6IHVzZXIucm9sZSxcbiAgdG9rZW5WZXJzaW9uOiB1c2VyLnRva2VuVmVyc2lvbixcbn0pO1xuXG5jb25zdCBpc3N1ZVRva2VucyA9IGFzeW5jIChcbiAgdXNlcjoge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIGVtYWlsOiBzdHJpbmc7XG4gICAgcm9sZTogUm9sZTtcbiAgICB0b2tlblZlcnNpb246IG51bWJlcjtcbiAgfSxcbiAgY2xpZW50OiBQcmlzbWEuVHJhbnNhY3Rpb25DbGllbnQgfCB0eXBlb2YgcHJpc21hID0gcHJpc21hLFxuKSA9PiB7XG4gIGNvbnN0IHRva2VuUGF5bG9hZCA9IGJ1aWxkVG9rZW5QYXlsb2FkKHVzZXIpO1xuXG4gIGNvbnN0IGFjY2Vzc1Rva2VuID0gand0VXRpbHMuY3JlYXRlVG9rZW4oXG4gICAgdG9rZW5QYXlsb2FkLFxuICAgIGNvbmZpZy5qd3RfYWNjZXNzX3NlY3JldCxcbiAgICB7IGV4cGlyZXNJbjogY29uZmlnLmp3dF9hY2Nlc3NfZXhwaXJlc19pbiB9IGFzIFNpZ25PcHRpb25zLFxuICApO1xuICBjb25zdCByZWZyZXNoVG9rZW4gPSBqd3RVdGlscy5jcmVhdGVUb2tlbihcbiAgICB0b2tlblBheWxvYWQsXG4gICAgY29uZmlnLmp3dF9yZWZyZXNoX3NlY3JldCxcbiAgICB7IGV4cGlyZXNJbjogY29uZmlnLmp3dF9yZWZyZXNoX2V4cGlyZXNfaW4gfSBhcyBTaWduT3B0aW9ucyxcbiAgKTtcblxuICAvLyBSb3RhdGlvbiBsZWRnZXIgXHUyMDE0IHBlcnNpc3QgYSByb3cga2V5ZWQgYnkgdGhlIHJlZnJlc2ggdG9rZW4ncyBoYXNoLiBUaGVcbiAgLy8gSldUIGl0c2VsZiBzdGF5cyBpbiB0aGUgcmVzcG9uc2UgZXhhY3RseSBhcyBiZWZvcmUuXG4gIGF3YWl0IGNsaWVudC5yZWZyZXNoVG9rZW4uY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICB1c2VySWQ6IHVzZXIuaWQsXG4gICAgICBoYXNoOiBzaGEyNTYocmVmcmVzaFRva2VuKSxcbiAgICAgIGV4cGlyZXNBdDogcmVmcmVzaFRva2VuRXhwaXJlc0F0KHJlZnJlc2hUb2tlbiksXG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9O1xufTtcblxuY29uc3Qgc2FuaXRpemVVc2VyID0gPFQgZXh0ZW5kcyB7IHBhc3N3b3JkOiBzdHJpbmcgfCBudWxsIH0+KHVzZXI6IFQpID0+IHtcbiAgY29uc3QgeyBwYXNzd29yZCwgLi4ucmVzdCB9ID0gdXNlcjtcbiAgcmV0dXJuIHJlc3Q7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVnaXN0ZXIgKHN0YWdlZCBpbiBSZWRpcywgdmVyaWZpZWQgdmlhIE9UUCkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBGb2xsb3dzIHRoZSByZWZlcmVuY2UgYmFja2VuZDogYSBjcmVkZW50aWFsIHNpZ251cCBkb2VzIE5PVCBjcmVhdGUgYSBEQiByb3cuXG4vLyBJdCBoYXNoZXMgdGhlIHBhc3N3b3JkLCBzdGFnZXMgdGhlIHBheWxvYWQgaW4gUmVkaXMsIGVtYWlscyBhIDYtZGlnaXQgT1RQLFxuLy8gYW5kIHRoZSB1c2VyIHJvdyBpcyBvbmx5IGNyZWF0ZWQgb24gc3VjY2Vzc2Z1bCB2ZXJpZmljYXRpb24uXG5jb25zdCByZWdpc3RlclVzZXIgPSBhc3luYyAocGF5bG9hZDogSUF1dGgpID0+IHtcbiAgY29uc3QgeyBuYW1lLCBwYXNzd29yZCwgcGhvbmUsIHJvbGUgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IGVtYWlsID0gcGF5bG9hZC5lbWFpbC50cmltKCkudG9Mb3dlckNhc2UoKTtcblxuICAvLyBPbmx5IHVzZXJzL2FnZW50cyBjYW4gc2VsZi1yZWdpc3RlcjsgYWRtaW5zIGFyZSBjcmVhdGVkIHZpYSBkZW1vLWxvZ2luL3NlZWRcbiAgaWYgKHJvbGUgJiYgcm9sZSAhPT0gXCJVU0VSXCIgJiYgcm9sZSAhPT0gXCJBR0VOVFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJSb2xlIG11c3QgYmUgZWl0aGVyIFVTRVIgb3IgQUdFTlRcIik7XG4gIH1cblxuICBjb25zdCBleGlzdGluZ1VzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBlbWFpbCB9LFxuICB9KTtcbiAgaWYgKGV4aXN0aW5nVXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiVXNlciB3aXRoIHRoaXMgZW1haWwgYWxyZWFkeSBleGlzdHNcIik7XG4gIH1cblxuICBjb25zdCBjbGllbnQgPSBhd2FpdCBnZXRSZWRpc0NsaWVudCgpO1xuXG4gIC8vIEEgcmVnaXN0cmF0aW9uIGlzIGFscmVhZHkgc3RhZ2VkIGZvciB0aGlzIGVtYWlsIFx1MjAxNCA0MDkgaW5zdGVhZCBvZiBzaWxlbnRseVxuICAvLyBvdmVyd3JpdGluZyB0aGUgcGVuZGluZyBPVFAvZGF0YSAoYW4gYXR0YWNrZXIgbXVzdCBub3QgYmUgYWJsZSB0byBraWxsIGFcbiAgLy8gdmljdGltJ3MgaW4tZmxpZ2h0IHJlZ2lzdHJhdGlvbikuIFRoZSBwZW5kaW5nIGZsb3cgY29udGludWVzIHZpYVxuICAvLyByZXNlbmQtdmVyaWZpY2F0aW9uLlxuICBjb25zdCByZWdpc3RyYXRpb25EYXRhS2V5ID0gYHRyaXB2ZXJzZTpyZWdpc3Rlci1kYXRhOiR7ZW1haWx9YDtcbiAgY29uc3QgcGVuZGluZ1JlZ2lzdHJhdGlvbiA9IGF3YWl0IGNsaWVudC5nZXQocmVnaXN0cmF0aW9uRGF0YUtleSk7XG4gIGlmIChwZW5kaW5nUmVnaXN0cmF0aW9uKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDA5LFxuICAgICAgXCJSZWdpc3RyYXRpb24gaXMgcGVuZGluZyB2ZXJpZmljYXRpb24uIENoZWNrIHlvdXIgZW1haWwgb3IgcmVzZW5kIHRoZSBPVFAuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGhhc2hlZFBhc3N3b3JkID0gYXdhaXQgYmNyeXB0Lmhhc2goXG4gICAgcGFzc3dvcmQsXG4gICAgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpLFxuICApO1xuXG4gIC8vIFJlZ2lzdHJhdGlvbiBPVFAgKHRoZSB2YWx1ZSB0aGUgdXNlciB0eXBlcyBiYWNrIGludG8gdGhlIEFQSSlcbiAgY29uc3Qgb3RwS2V5ID0gYHRyaXB2ZXJzZTpyZWdpc3Rlci1vdHA6JHtlbWFpbH1gO1xuICBjb25zdCBvdHBWYWx1ZSA9IGNyeXB0by5yYW5kb21JbnQoMTAwMDAwLCAxMDAwMDAwKS50b1N0cmluZygpO1xuXG4gIGF3YWl0IGNsaWVudC5zZXQob3RwS2V5LCBvdHBWYWx1ZSwge1xuICAgIGV4cGlyYXRpb246IHtcbiAgICAgIHR5cGU6IFwiRVhcIixcbiAgICAgIHZhbHVlOiBPVFBfRVhQSVJBVElPTl9TRUNPTkRTLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFN0YWdlZCByZWdpc3RyYXRpb24gcGF5bG9hZCBcdTIwMTQgcGFzc3dvcmQgaXMgYWxyZWFkeSBoYXNoZWQgaGVyZSwgZXhhY3RseVxuICAvLyBsaWtlIHRoZSByZWZlcmVuY2UsIHNvIGEgUmVkaXMgbGVhayBuZXZlciBleHBvc2VzIGEgcGxhaW50ZXh0IHBhc3N3b3JkLlxuICBjb25zdCByZWRpc1VzZXJEYXRhUGF5bG9hZCA9IHtcbiAgICBuYW1lLFxuICAgIGVtYWlsLFxuICAgIHBhc3N3b3JkOiBoYXNoZWRQYXNzd29yZCxcbiAgICBwaG9uZSxcbiAgICByb2xlOiByb2xlIHx8IFwiVVNFUlwiLFxuICB9O1xuXG4gIGF3YWl0IGNsaWVudC5zZXQocmVnaXN0cmF0aW9uRGF0YUtleSwgSlNPTi5zdHJpbmdpZnkocmVkaXNVc2VyRGF0YVBheWxvYWQpLCB7XG4gICAgZXhwaXJhdGlvbjoge1xuICAgICAgdHlwZTogXCJFWFwiLFxuICAgICAgdmFsdWU6IE9UUF9FWFBJUkFUSU9OX1NFQ09ORFMsXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gQmVzdC1lZmZvcnQgZW1haWwgXHUyMDE0IGEgc2VuZCBmYWlsdXJlIG5ldmVyIGZhaWxzIHJlZ2lzdHJhdGlvbiAoVHJpcFZlcnNlXG4gIC8vIGNvbnZlbnRpb24pOyB0aGUgdXNlciBjYW4gcmVjb3ZlciB2aWEgcmVzZW5kLXZlcmlmaWNhdGlvbi5cbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRWZXJpZmljYXRpb25PdHBFbWFpbCh7IGVtYWlsLCBuYW1lLCBvdHA6IG90cFZhbHVlIH0pLFxuICBdKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBWZXJpZnkgZW1haWwgKGNyZWF0ZXMgdGhlIHVzZXIgKyBhdXRvLWxvZ2luKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIEZvbGxvd3MgdGhlIHJlZmVyZW5jZSBiYWNrZW5kOiBPVFAgaXMgcmVhZCBmcm9tIFJlZGlzLCBkZWxldGVkLCB0aGVuIHRoZVxuLy8gc3RhZ2VkIHBheWxvYWQgaXMgbWF0ZXJpYWxpc2VkIGFzIGEgcmVhbCB1c2VyIHJvdyB3aXRoIGVtYWlsVmVyaWZpZWQ6IHRydWUsXG4vLyBhbmQgdG9rZW5zIGFyZSBpc3N1ZWQgc28gdGhlIHVzZXIgaXMgbG9nZ2VkIGluIGltbWVkaWF0ZWx5LlxuY29uc3QgdmVyaWZ5RW1haWwgPSBhc3luYyAocGF5bG9hZDogSVZlcmlmeUVtYWlsUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IG90cCB9ID0gcGF5bG9hZDtcbiAgY29uc3QgZW1haWwgPSBwYXlsb2FkLmVtYWlsLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG4gIC8vIERlZmVuc2l2ZSBcdTIwMTQgcmVnaXN0cmF0aW9uIGFscmVhZHkgNDA5cyBvbiBhbiBleGlzdGluZyBlbWFpbCwgc28gYSB1c2VyIHJvd1xuICAvLyBoZXJlIG1lYW5zIHRoZSBlbWFpbCB3YXMgdmVyaWZpZWQgZWFybGllciB0aHJvdWdoIGFub3RoZXIgZmxvdy5cbiAgY29uc3QgaXNVc2VyRXhpc3RzID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG4gIGlmIChpc1VzZXJFeGlzdHMpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIkVtYWlsIGlzIGFscmVhZHkgdmVyaWZpZWRcIik7XG4gIH1cblxuICBjb25zdCBjbGllbnQgPSBhd2FpdCBnZXRSZWRpc0NsaWVudCgpO1xuXG4gIGNvbnN0IG90cEtleSA9IGB0cmlwdmVyc2U6cmVnaXN0ZXItb3RwOiR7ZW1haWx9YDtcbiAgY29uc3QgcmVkaXNPVFAgPSBhd2FpdCBjbGllbnQuZ2V0KG90cEtleSk7XG5cbiAgaWYgKCFyZWRpc09UUCB8fCByZWRpc09UUCAhPT0gb3RwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIG9yIGV4cGlyZWQgT1RQLlwiKTtcbiAgfVxuXG4gIC8vIE9UUCBpcyBzaW5nbGUtdXNlIFx1MjAxNCBkZWxldGUgaXQgYmVmb3JlIHRoZSB1c2VyIHJvdyBpcyBjcmVhdGVkLlxuICBhd2FpdCBjbGllbnQuZGVsKG90cEtleSk7XG5cbiAgY29uc3QgcmVnaXN0cmF0aW9uRGF0YUtleSA9IGB0cmlwdmVyc2U6cmVnaXN0ZXItZGF0YToke2VtYWlsfWA7XG4gIGNvbnN0IHJlZGlzVXNlckRhdGEgPSBhd2FpdCBjbGllbnQuZ2V0KHJlZ2lzdHJhdGlvbkRhdGFLZXkpO1xuXG4gIGlmICghcmVkaXNVc2VyRGF0YSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBvciBleHBpcmVkIE9UUC5cIik7XG4gIH1cblxuICBjb25zdCB1c2VyUGF5bG9hZCA9IEpTT04ucGFyc2UocmVkaXNVc2VyRGF0YSkgYXMgSUF1dGg7XG5cbiAgY29uc3QgY3JlYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIG5hbWU6IHVzZXJQYXlsb2FkLm5hbWUsXG4gICAgICBlbWFpbDogdXNlclBheWxvYWQuZW1haWwsXG4gICAgICBwYXNzd29yZDogdXNlclBheWxvYWQucGFzc3dvcmQsXG4gICAgICBwaG9uZTogdXNlclBheWxvYWQucGhvbmUsXG4gICAgICByb2xlOiB1c2VyUGF5bG9hZC5yb2xlIHx8IFwiVVNFUlwiLFxuICAgICAgYXV0aFByb3ZpZGVyOiBcIkNSRURFTlRJQUxcIixcbiAgICAgIHN0YXR1czogXCJBQ1RJVkVcIixcbiAgICAgIGVtYWlsVmVyaWZpZWQ6IHRydWUsXG4gICAgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIC8vIFN0YWdlZCBwYXlsb2FkIGNvbnN1bWVkIFx1MjAxNCBub3RoaW5nIHJlbWFpbnMgaW4gUmVkaXMuXG4gIGF3YWl0IGNsaWVudC5kZWwocmVnaXN0cmF0aW9uRGF0YUtleSk7XG5cbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRXZWxjb21lRW1haWwoeyBlbWFpbDogY3JlYXRlZFVzZXIuZW1haWwsIG5hbWU6IGNyZWF0ZWRVc2VyLm5hbWUgfSksXG4gIF0pO1xuXG4gIGNvbnN0IHRva2VucyA9IGF3YWl0IGlzc3VlVG9rZW5zKGNyZWF0ZWRVc2VyKTtcblxuICByZXR1cm4geyAuLi50b2tlbnMsIHVzZXI6IGNyZWF0ZWRVc2VyIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVzZW5kIHZlcmlmaWNhdGlvbiBPVFAgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBSZS1taW50cyBhIGZyZXNoIE9UUCBmb3IgYSBzdGlsbC1zdGFnZWQgcmVnaXN0cmF0aW9uLiBVbmlmb3JtIDIwMCBcdTIwMTQgaWYgdGhlXG4vLyBzdGFnaW5nIGRhdGEgaXMgZ29uZSAobmV2ZXIgcmVnaXN0ZXJlZCAvIGFscmVhZHkgdmVyaWZpZWQpIHRoaXMgbm8tb3BzLlxuY29uc3QgcmVzZW5kVmVyaWZpY2F0aW9uID0gYXN5bmMgKHBheWxvYWQ6IElSZXNlbmRWZXJpZmljYXRpb25QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IGVtYWlsID0gcGF5bG9hZC5lbWFpbC50cmltKCkudG9Mb3dlckNhc2UoKTtcblxuICBjb25zdCBjbGllbnQgPSBhd2FpdCBnZXRSZWRpc0NsaWVudCgpO1xuXG4gIGNvbnN0IHJlZ2lzdHJhdGlvbkRhdGFLZXkgPSBgdHJpcHZlcnNlOnJlZ2lzdGVyLWRhdGE6JHtlbWFpbH1gO1xuICBjb25zdCByZWRpc1VzZXJEYXRhID0gYXdhaXQgY2xpZW50LmdldChyZWdpc3RyYXRpb25EYXRhS2V5KTtcblxuICBpZiAoIXJlZGlzVXNlckRhdGEpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB1c2VyUGF5bG9hZCA9IEpTT04ucGFyc2UocmVkaXNVc2VyRGF0YSkgYXMgSUF1dGg7XG5cbiAgY29uc3Qgb3RwS2V5ID0gYHRyaXB2ZXJzZTpyZWdpc3Rlci1vdHA6JHtlbWFpbH1gO1xuICBjb25zdCBvdHBWYWx1ZSA9IGNyeXB0by5yYW5kb21JbnQoMTAwMDAwLCAxMDAwMDAwKS50b1N0cmluZygpO1xuXG4gIGF3YWl0IGNsaWVudC5zZXQob3RwS2V5LCBvdHBWYWx1ZSwge1xuICAgIGV4cGlyYXRpb246IHtcbiAgICAgIHR5cGU6IFwiRVhcIixcbiAgICAgIHZhbHVlOiBPVFBfRVhQSVJBVElPTl9TRUNPTkRTLFxuICAgIH0sXG4gIH0pO1xuXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kVmVyaWZpY2F0aW9uT3RwRW1haWwoeyBlbWFpbCwgbmFtZTogdXNlclBheWxvYWQubmFtZSwgb3RwOiBvdHBWYWx1ZSB9KSxcbiAgXSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgRm9yZ290IHBhc3N3b3JkIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gRW1haWxzIGEgcmVzZXQgT1RQIHRvIHZlcmlmaWVkIENSRURFTlRJQUwgYWNjb3VudHMuIERlbGliZXJhdGVseSByZXR1cm5zIGFcbi8vIHVuaWZvcm0gMjAwIHdoZXRoZXIgb3Igbm90IHRoZSBlbWFpbCBleGlzdHMgLyBpcyBlbGlnaWJsZSAobm8gZW51bWVyYXRpb24gXHUyMDE0XG4vLyB0aGUgcmVmZXJlbmNlIHRocm93cyBcIlVzZXIgbm90IGZvdW5kXCIsIGJ1dCBUcmlwVmVyc2UgbmV2ZXIgbGVha3MgZXhpc3RlbmNlKS5cbmNvbnN0IGZvcmdvdFBhc3N3b3JkID0gYXN5bmMgKHBheWxvYWQ6IElGb3Jnb3RQYXNzd29yZFBheWxvYWQpID0+IHtcbiAgY29uc3QgZW1haWwgPSBwYXlsb2FkLmVtYWlsLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG4gIGNvbnN0IGlzVXNlckV4aXN0cyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBlbWFpbCB9IH0pO1xuXG4gIGlmIChcbiAgICAhaXNVc2VyRXhpc3RzIHx8XG4gICAgaXNVc2VyRXhpc3RzLmlzRGVsZXRlZCB8fFxuICAgIGlzVXNlckV4aXN0cy5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIgfHxcbiAgICAhaXNVc2VyRXhpc3RzLmVtYWlsVmVyaWZpZWQgfHxcbiAgICBpc1VzZXJFeGlzdHMuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiXG4gICkge1xuICAgIC8vIEdvb2dsZS1vbmx5IGFjY291bnRzIHJlc2V0IHZpYSBHb29nbGU7IGV2ZXJ5b25lIGVsc2Ugc2lsZW50bHkgbm8tb3BzLlxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IGdldFJlZGlzQ2xpZW50KCk7XG5cbiAgY29uc3Qgb3RwID0gY3J5cHRvLnJhbmRvbUludCgxMDAwMDAsIDEwMDAwMDApLnRvU3RyaW5nKCk7XG4gIGNvbnN0IGtleSA9IGB0cmlwdmVyc2U6Zm9yZ290LXBhc3N3b3JkLW90cDoke2lzVXNlckV4aXN0cy5lbWFpbH1gO1xuXG4gIGF3YWl0IGNsaWVudC5zZXQoa2V5LCBvdHAsIHtcbiAgICBleHBpcmF0aW9uOiB7XG4gICAgICB0eXBlOiBcIkVYXCIsXG4gICAgICB2YWx1ZTogT1RQX0VYUElSQVRJT05fU0VDT05EUyxcbiAgICB9LFxuICB9KTtcblxuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZEZvcmdvdFBhc3N3b3JkT3RwRW1haWwoe1xuICAgICAgZW1haWw6IGlzVXNlckV4aXN0cy5lbWFpbCxcbiAgICAgIG5hbWU6IGlzVXNlckV4aXN0cy5uYW1lLFxuICAgICAgb3RwLFxuICAgIH0pLFxuICBdKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZXNldCBwYXNzd29yZCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFZhbGlkYXRlcyB0aGUgT1RQIGFnYWluc3QgUmVkaXMsIHRoZW4gcmVwbGFjZXMgdGhlIGhhc2ggYW5kIGJ1bXBzXG4vLyB0b2tlblZlcnNpb24gc28gZXZlcnkgZXhpc3Rpbmcgc2Vzc2lvbiBkaWVzIChUcmlwVmVyc2UgbG9nb3V0IHNlbWFudGljcykuXG5jb25zdCByZXNldFBhc3N3b3JkID0gYXN5bmMgKHBheWxvYWQ6IElSZXNldFBhc3N3b3JkUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IG5ld1Bhc3N3b3JkLCBvdHAgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IGVtYWlsID0gcGF5bG9hZC5lbWFpbC50cmltKCkudG9Mb3dlckNhc2UoKTtcblxuICBjb25zdCBpc1VzZXJFeGlzdHMgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgZW1haWwgfSB9KTtcblxuICBpZiAoXG4gICAgIWlzVXNlckV4aXN0cyB8fFxuICAgIGlzVXNlckV4aXN0cy5pc0RlbGV0ZWQgfHxcbiAgICBpc1VzZXJFeGlzdHMuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiIHx8XG4gICAgaXNVc2VyRXhpc3RzLmF1dGhQcm92aWRlciA9PT0gXCJHT09HTEVcIlxuICApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgb3IgZXhwaXJlZCBPVFAuXCIpO1xuICB9XG5cbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0UmVkaXNDbGllbnQoKTtcblxuICBjb25zdCBrZXkgPSBgdHJpcHZlcnNlOmZvcmdvdC1wYXNzd29yZC1vdHA6JHtpc1VzZXJFeGlzdHMuZW1haWx9YDtcbiAgY29uc3QgcmVkaXNPVFAgPSBhd2FpdCBjbGllbnQuZ2V0KGtleSk7XG5cbiAgaWYgKCFyZWRpc09UUCB8fCByZWRpc09UUCAhPT0gb3RwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIG9yIGV4cGlyZWQgT1RQLlwiKTtcbiAgfVxuXG4gIGNvbnN0IGhhc2hlZE5ld1Bhc3N3b3JkID0gYXdhaXQgYmNyeXB0Lmhhc2goXG4gICAgbmV3UGFzc3dvcmQsXG4gICAgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpLFxuICApO1xuXG4gIGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgZW1haWw6IGlzVXNlckV4aXN0cy5lbWFpbCB9LFxuICAgIGRhdGE6IHtcbiAgICAgIHBhc3N3b3JkOiBoYXNoZWROZXdQYXNzd29yZCxcbiAgICAgIHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSxcbiAgICB9LFxuICB9KTtcblxuICAvLyBTaW5nbGUtdXNlIE9UUCBcdTIwMTQgZGVsZXRlIGFmdGVyIGEgc3VjY2Vzc2Z1bCByZXNldC5cbiAgYXdhaXQgY2xpZW50LmRlbChrZXkpO1xuXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kUGFzc3dvcmRSZXNldFN1Y2Nlc3NFbWFpbCh7XG4gICAgICBlbWFpbDogaXNVc2VyRXhpc3RzLmVtYWlsLFxuICAgICAgbmFtZTogaXNVc2VyRXhpc3RzLm5hbWUsXG4gICAgfSksXG4gIF0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIExvZ2luIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgbG9naW5Vc2VyID0gYXN5bmMgKHBheWxvYWQ6IElMb2dpblVzZXIpID0+IHtcbiAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGVtYWlsIH0sXG4gIH0pO1xuXG4gIGlmICghdXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBlbWFpbCBvciBwYXNzd29yZFwiKTtcbiAgfVxuICBpZiAodXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaGFzIGJlZW4gZGVsZXRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaXMgc3VzcGVuZGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLmF1dGhQcm92aWRlciA9PT0gXCJHT09HTEVcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiVGhpcyBhY2NvdW50IHVzZXMgR29vZ2xlIGxvZ2luLiBQbGVhc2UgbG9nIGluIHdpdGggR29vZ2xlLlwiLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBpc1Bhc3N3b3JkVmFsaWQgPSBhd2FpdCBiY3J5cHQuY29tcGFyZShwYXNzd29yZCwgdXNlci5wYXNzd29yZCB8fCBcIlwiKTtcbiAgaWYgKCFpc1Bhc3N3b3JkVmFsaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIkludmFsaWQgZW1haWwgb3IgcGFzc3dvcmRcIik7XG4gIH1cblxuICByZXR1cm4gYXdhaXQgaXNzdWVUb2tlbnModXNlcik7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgR29vZ2xlIGxvZ2luIChJRC10b2tlbiBmbG93KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdvb2dsZUxvZ2luID0gYXN5bmMgKHBheWxvYWQ6IElHb29nbGVMb2dpblBheWxvYWQpID0+IHtcbiAgY29uc3QgeyBpZFRva2VuIH0gPSBwYXlsb2FkO1xuXG4gIGlmICghY29uZmlnLmdvb2dsZV9jbGllbnRfaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkdvb2dsZSBsb2dpbiBpcyBub3QgY29uZmlndXJlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cIixcbiAgICApO1xuICB9XG5cbiAgbGV0IHRpY2tldDtcbiAgdHJ5IHtcbiAgICB0aWNrZXQgPSBhd2FpdCBnb29nbGVDbGllbnQudmVyaWZ5SWRUb2tlbih7XG4gICAgICBpZFRva2VuLFxuICAgICAgYXVkaWVuY2U6IGNvbmZpZy5nb29nbGVfY2xpZW50X2lkLFxuICAgIH0pO1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIkludmFsaWQgR29vZ2xlIHRva2VuXCIpO1xuICB9XG5cbiAgY29uc3QgZ29vZ2xlRGF0YSA9IHRpY2tldC5nZXRQYXlsb2FkKCk7XG4gIGlmICghZ29vZ2xlRGF0YSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBHb29nbGUgdG9rZW4gcGF5bG9hZFwiKTtcbiAgfVxuXG4gIGNvbnN0IHsgZW1haWwsIG5hbWUsIHN1YiwgcGljdHVyZSB9ID0gZ29vZ2xlRGF0YTtcblxuICBpZiAoIWVtYWlsIHx8ICFnb29nbGVEYXRhLmVtYWlsX3ZlcmlmaWVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJHb29nbGUgYWNjb3VudCBlbWFpbCBpcyBub3QgdmVyaWZpZWRcIik7XG4gIH1cblxuICBsZXQgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBnb29nbGVJZDogc3ViIH0gfSk7XG5cbiAgLy8gRXhpc3RpbmcgdXNlciBcdTIxOTIgbGluayBHb29nbGUgYWNjb3VudCBpZiBub3QgYWxyZWFkeSBsaW5rZWRcbiAgaWYgKCF1c2VyICYmIGVtYWlsKSB7XG4gICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBlbWFpbCB9IH0pO1xuICAgIGlmICh1c2VyKSB7XG4gICAgICBpZiAodXNlci5nb29nbGVJZCAmJiB1c2VyLmdvb2dsZUlkICE9PSBzdWIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICAgIDQwOSxcbiAgICAgICAgICBcIkVtYWlsIGlzIGFscmVhZHkgbGlua2VkIHRvIGFub3RoZXIgR29vZ2xlIGFjY291bnRcIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogdXNlci5pZCB9LFxuICAgICAgICBkYXRhOiB7IGdvb2dsZUlkOiBzdWIsIGVtYWlsVmVyaWZpZWQ6IHRydWUgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIEJyYW5kIG5ldyB1c2VyXG4gIGlmICghdXNlcikge1xuICAgIGNvbnN0IGxvY2FsUGFydCA9IGVtYWlsLnNwbGl0KFwiQFwiKVswXSA/PyBlbWFpbDtcbiAgICBjb25zdCBkaXNwbGF5TmFtZSA9IChuYW1lID8/IFwiXCIpLnRyaW0oKSB8fCBsb2NhbFBhcnQ7XG4gICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIGVtYWlsLFxuICAgICAgICBuYW1lOiBkaXNwbGF5TmFtZSxcbiAgICAgICAgcGFzc3dvcmQ6IG51bGwsXG4gICAgICAgIGF1dGhQcm92aWRlcjogXCJHT09HTEVcIixcbiAgICAgICAgZ29vZ2xlSWQ6IHN1YixcbiAgICAgICAgZW1haWxWZXJpZmllZDogdHJ1ZSxcbiAgICAgICAgcm9sZTogXCJVU0VSXCIsXG4gICAgICAgIGF2YXRhclVybDogcGljdHVyZSB8fCBudWxsLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHRva2VucyA9IGF3YWl0IGlzc3VlVG9rZW5zKHVzZXIhKTtcbiAgY29uc3Qgc2FuaXRpemVkVXNlciA9IHNhbml0aXplVXNlcih1c2VyISk7XG5cbiAgcmV0dXJuIHsgLi4udG9rZW5zLCB1c2VyOiBzYW5pdGl6ZWRVc2VyIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgRGVtbyBsb2dpbiAoZ3JhZGluZykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBERU1PX1BBU1NXT1JEID0gXCJkZW1vMTIzXCI7XG5cbmNvbnN0IGRlbW9Mb2dpbiA9IGFzeW5jIChwYXlsb2FkOiBJRGVtb0xvZ2luUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IHJvbGUgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgZGVtb1VzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cHNlcnQoe1xuICAgIHdoZXJlOiB7IGVtYWlsOiBgZGVtby0ke3JvbGUudG9Mb3dlckNhc2UoKX1AdHJpcHZlcnNlLmNvbWAgfSxcbiAgICAvLyByZXN1cnJlY3QgZGVtbyBhY2NvdW50cyB0aGF0IGFuIGFkbWluIHN1c3BlbmRlZCBvciBzb2Z0LWRlbGV0ZWRcbiAgICB1cGRhdGU6IHsgc3RhdHVzOiBcIkFDVElWRVwiLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgY3JlYXRlOiB7XG4gICAgICBuYW1lOiBgRGVtbyAke3JvbGUuY2hhckF0KDApICsgcm9sZS5zbGljZSgxKS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBlbWFpbDogYGRlbW8tJHtyb2xlLnRvTG93ZXJDYXNlKCl9QHRyaXB2ZXJzZS5jb21gLFxuICAgICAgcGFzc3dvcmQ6IGF3YWl0IGJjcnlwdC5oYXNoKERFTU9fUEFTU1dPUkQsIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSksXG4gICAgICBhdXRoUHJvdmlkZXI6IFwiQ1JFREVOVElBTFwiLFxuICAgICAgcm9sZSxcbiAgICAgIHN0YXR1czogXCJBQ1RJVkVcIixcbiAgICAgIGVtYWlsVmVyaWZpZWQ6IHRydWUsXG4gICAgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7IC4uLihhd2FpdCBpc3N1ZVRva2VucyhkZW1vVXNlcikpLCB1c2VyOiBkZW1vVXNlciB9O1xufTtcblxuLy8gUmV1c2UgZGV0ZWN0ZWQgXHUyMTkyIGtpbGwgdGhlIHdob2xlIGZhbWlseTogZXZlcnkgb3V0c3RhbmRpbmcgdG9rZW4gZGllcyB2aWFcbi8vIHJldm9rZSArIHRva2VuVmVyc2lvbiBidW1wLiBTYW1lIHNoYXBlIGFzIGxvZ291dC5cbmNvbnN0IHJldm9rZUZhbWlseSA9IGFzeW5jICh1c2VySWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKFtcbiAgICBwcmlzbWEucmVmcmVzaFRva2VuLnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgdXNlcklkLCByZXZva2VkQXQ6IG51bGwgfSxcbiAgICAgIGRhdGE6IHsgcmV2b2tlZEF0OiBuZXcgRGF0ZSgpIH0sXG4gICAgfSksXG4gICAgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICAgIGRhdGE6IHsgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0sXG4gICAgfSksXG4gIF0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZnJlc2ggXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCByZWZyZXNoVG9rZW4gPSBhc3luYyAocGF5bG9hZDogSVJlZnJlc2hUb2tlblBheWxvYWQpID0+IHtcbiAgY29uc3QgeyByZWZyZXNoVG9rZW46IHByb3ZpZGVkUmVmcmVzaFRva2VuIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHZlcmlmaWVkID0gand0VXRpbHMudmVyaWZ5VG9rZW4oXG4gICAgcHJvdmlkZWRSZWZyZXNoVG9rZW4sXG4gICAgY29uZmlnLmp3dF9yZWZyZXNoX3NlY3JldCxcbiAgKTtcblxuICBpZiAoIXZlcmlmaWVkLnN1Y2Nlc3MpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCB2ZXJpZmllZC5lcnJvcik7XG4gIH1cblxuICBjb25zdCB7IGlkLCB0b2tlblZlcnNpb246IHRva2VuVG9rZW5WZXJzaW9uIH0gPVxuICAgIHZlcmlmaWVkLmRhdGEgYXMgSnd0UGF5bG9hZCAmIHsgdG9rZW5WZXJzaW9uOiBudW1iZXIgfTtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG5cbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGhhcyBiZWVuIGRlbGV0ZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGlzIHN1c3BlbmRlZFwiKTtcbiAgfVxuXG4gIC8vIHRva2VuVmVyc2lvbiBjaGFuZ2VkIFx1MjE5MiB0b2tlbnMgd2VyZSByZXZva2VkIChsb2dvdXQgLyBwYXNzd29yZCBjaGFuZ2UpXG4gIGlmICh1c2VyLnRva2VuVmVyc2lvbiAhPT0gdG9rZW5Ub2tlblZlcnNpb24pIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIlRva2VuIGlzIG5vIGxvbmdlciB2YWxpZC4gUGxlYXNlIGxvZ2luIGFnYWluLlwiKTtcbiAgfVxuXG4gIC8vIE9wcG9ydHVuaXN0aWMgaG91c2VrZWVwaW5nIFx1MjAxNCBrZWVwIHRoZSBsZWRnZXIgZnJvbSBncm93aW5nIHVuYm91bmRlZFxuICAvLyB3aXRob3V0IGEgY3JvbjogZHJvcCBleHBpcmVkIHJvd3MgYW5kIHJvd3MgcmV2b2tlZCBtb3JlIHRoYW4gNyBkYXlzIGFnby5cbiAgY29uc3Qgd2Vla0FnbyA9IG5ldyBEYXRlKERhdGUubm93KCkgLSA3ICogMjQgKiA2MCAqIDYwICogMTAwMCk7XG4gIGF3YWl0IHByaXNtYS5yZWZyZXNoVG9rZW4uZGVsZXRlTWFueSh7XG4gICAgd2hlcmU6IHtcbiAgICAgIE9SOiBbeyBleHBpcmVzQXQ6IHsgbHQ6IG5ldyBEYXRlKCkgfSB9LCB7IHJldm9rZWRBdDogeyBsdGU6IHdlZWtBZ28gfSB9XSxcbiAgICB9LFxuICB9KTtcblxuICAvLyBSb3RhdGlvbiBsZWRnZXIgbG9va3VwIGJ5IHRoZSBwcmVzZW50ZWQgdG9rZW4ncyBoYXNoLlxuICBjb25zdCByb3cgPSBhd2FpdCBwcmlzbWEucmVmcmVzaFRva2VuLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGhhc2g6IHNoYTI1Nihwcm92aWRlZFJlZnJlc2hUb2tlbikgfSxcbiAgfSk7XG5cbiAgLy8gTmV2ZXIgaXNzdWVkIChvciBhbHJlYWR5IHBydW5lZCkgXHUyMTkyIHJlamVjdC5cbiAgaWYgKCFyb3cpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIkludmFsaWQgcmVmcmVzaCB0b2tlbi4gUGxlYXNlIGxvZ2luIGFnYWluLlwiKTtcbiAgfVxuXG4gIC8vIEEgcmV2b2tlZCByb3cgaXMgdGhlIHRoZWZ0IHNpZ25hdHVyZSBcdTIwMTQgc29tZW9uZSByZXBsYXllZCBhIHJvdGF0ZWQgdG9rZW4uXG4gIGlmIChyb3cucmV2b2tlZEF0KSB7XG4gICAgYXdhaXQgcmV2b2tlRmFtaWx5KHVzZXIuaWQpO1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiUmVmcmVzaCB0b2tlbiByZXVzZSBkZXRlY3RlZC4gUGxlYXNlIGxvZ2luIGFnYWluLlwiKTtcbiAgfVxuXG4gIC8vIE5hdHVyYWxseSBleHBpcmVkIFx1MjE5MiByZWplY3Qgd2l0aG91dCB0b3VjaGluZyB0aGUgZmFtaWx5LlxuICBpZiAocm93LmV4cGlyZXNBdC5nZXRUaW1lKCkgPD0gRGF0ZS5ub3coKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiUmVmcmVzaCB0b2tlbiBoYXMgZXhwaXJlZC4gUGxlYXNlIGxvZ2luIGFnYWluLlwiKTtcbiAgfVxuXG4gIC8vIFZhbGlkIFx1MjE5MiByb3RhdGUuIFRoZSBDQVMgb24gYHJldm9rZWRBdDogbnVsbGAgbWFrZXMgcm90YXRpb24gYVxuICAvLyBjb21wYXJlLWFuZC1zd2FwOiBvZiB0d28gdHJ1bHktY29uY3VycmVudCBwcmVzZW50cyBvZiB0aGUgc2FtZSB0b2tlbiBvbmx5XG4gIC8vIG9uZSB3aW5zOyB0aGUgbG9zZXIncyB1cGRhdGVNYW55IHJldHVybnMgY291bnQgMCBcdTIxOTIgZmFtaWx5IG51a2UuIFRoZSBudWtlXG4gIC8vIG11c3QgcnVuIEFGVEVSIHRoZSB0cmFuc2FjdGlvbiBjb21taXRzIFx1MjAxNCB0aHJvd2luZyBpbnNpZGUgdGhlIGludGVyYWN0aXZlXG4gIC8vIHR4IHdvdWxkIHJvbGwgaXQgYmFjayBhbmQgc2lsZW50bHkgdW5kbyB0aGUgbnVrZS5cbiAgY29uc3Qgb3V0Y29tZSA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3Qgcm90YXRlZCA9IGF3YWl0IHR4LnJlZnJlc2hUb2tlbi51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiByb3cuaWQsIHJldm9rZWRBdDogbnVsbCB9LFxuICAgICAgZGF0YTogeyByZXZva2VkQXQ6IG5ldyBEYXRlKCkgfSxcbiAgICB9KTtcblxuICAgIGlmIChyb3RhdGVkLmNvdW50ID09PSAwKSB7XG4gICAgICByZXR1cm4gXCJMT1NUXCIgYXMgY29uc3Q7XG4gICAgfVxuXG4gICAgY29uc3QgdG9rZW5zID0gYXdhaXQgaXNzdWVUb2tlbnModXNlciwgdHgpO1xuICAgIHJldHVybiB7IHRva2VucyB9IGFzIGNvbnN0O1xuICB9KTtcblxuICBpZiAob3V0Y29tZSA9PT0gXCJMT1NUXCIpIHtcbiAgICBhd2FpdCByZXZva2VGYW1pbHkodXNlci5pZCk7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJSZWZyZXNoIHRva2VuIHJldXNlIGRldGVjdGVkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIpO1xuICB9XG5cbiAgcmV0dXJuIG91dGNvbWUudG9rZW5zO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIExvZ291dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGxvZ291dCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZykgPT4ge1xuICAvLyBSZXZva2UgdGhlIGxlZGdlciByb3dzLCB0aGVuIGJ1bXAgdG9rZW5WZXJzaW9uIChraWxscyBldmVyeXRoaW5nKS5cbiAgYXdhaXQgcmV2b2tlRmFtaWx5KHVzZXJJZCk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgR2V0IG1lIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0TWVGcm9tREIgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICByZXR1cm4gdXNlcjtcbn07XG5cbmV4cG9ydCBjb25zdCBhdXRoU2VydmljZSA9IHtcbiAgcmVnaXN0ZXJVc2VyLFxuICB2ZXJpZnlFbWFpbCxcbiAgcmVzZW5kVmVyaWZpY2F0aW9uLFxuICBmb3Jnb3RQYXNzd29yZCxcbiAgcmVzZXRQYXNzd29yZCxcbiAgbG9naW5Vc2VyLFxuICBnb29nbGVMb2dpbixcbiAgZGVtb0xvZ2luLFxuICByZWZyZXNoVG9rZW4sXG4gIGxvZ291dCxcbiAgZ2V0TWVGcm9tREIsXG59OyIsICJpbXBvcnQgeyBPQXV0aDJDbGllbnQgfSBmcm9tIFwiZ29vZ2xlLWF1dGgtbGlicmFyeVwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmV4cG9ydCBjb25zdCBnb29nbGVDbGllbnQgPSBuZXcgT0F1dGgyQ2xpZW50KHtcbiAgY2xpZW50SWQ6IGNvbmZpZy5nb29nbGVfY2xpZW50X2lkLFxufSk7IiwgImltcG9ydCB7IGNyZWF0ZUNsaWVudCB9IGZyb20gXCJyZWRpc1wiO1xuaW1wb3J0IHR5cGUgeyBSZWRpc0NsaWVudFR5cGUgfSBmcm9tIFwicmVkaXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG4vLyBSZWRpcyBPVFAgc3RvcmUgZm9yIGVtYWlsIHZlcmlmaWNhdGlvbiArIHBhc3N3b3JkIHJlc2V0IChTdGVwIDIxKSBcdTIwMTQgbWlycm9yc1xuLy8gdGhlIHJlZmVyZW5jZSBiYWNrZW5kJ3Mgbm9kZS1yZWRpcyBjbGllbnQuIE51bGwgd2hlbiB1bmNvbmZpZ3VyZWQgc28gdGhlIGFwcFxuLy8gc3RpbGwgYm9vdHMgKGUuZy4gVmVyY2VsIHByb2QpOyB0aGUgYXV0aCBlbmRwb2ludHMgdGhlbiBmYWlsIHdpdGggYSBjbGVhblxuLy8gNTAzIGluc3RlYWQgb2YgY3Jhc2hpbmcuXG5leHBvcnQgY29uc3QgcmVkaXNDbGllbnQgPSBjb25maWcucmVkaXNfaG9zdFxuICA/IGNyZWF0ZUNsaWVudCh7XG4gICAgICB1c2VybmFtZTogY29uZmlnLnJlZGlzX3VzZXIsXG4gICAgICBwYXNzd29yZDogY29uZmlnLnJlZGlzX3Bhc3N3b3JkLFxuICAgICAgc29ja2V0OiB7XG4gICAgICAgIGhvc3Q6IGNvbmZpZy5yZWRpc19ob3N0LFxuICAgICAgICBwb3J0OiBwYXJzZUludChjb25maWcucmVkaXNfcG9ydCB8fCBcIjYzNzlcIiksXG4gICAgICB9LFxuICAgIH0pXG4gIDogbnVsbDtcblxuLy8gTGF6aWx5LWNvbm5lY3QgYWNjZXNzb3IgXHUyMDE0IGNvbm5lY3QoKSBpcyBpZGVtcG90ZW50LCBzbyB0aGlzIGlzIHNhZmUgdG8gY2FsbFxuLy8gcGVyIHJlcXVlc3Q7IHRoZSBjbGllbnQgaXMgYWxzbyBjb25uZWN0ZWQgb25jZSBhdCBib290IGluIHNlcnZlci50cy5cbmV4cG9ydCBjb25zdCBnZXRSZWRpcyA9IGFzeW5jICgpOiBQcm9taXNlPFJlZGlzQ2xpZW50VHlwZSB8IG51bGw+ID0+IHtcbiAgaWYgKCFyZWRpc0NsaWVudCkgcmV0dXJuIG51bGw7XG5cbiAgaWYgKCFyZWRpc0NsaWVudC5pc09wZW4pIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgcmVkaXNDbGllbnQuY29ubmVjdCgpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBcIltyZWRpc10gY29ubmVjdCBmYWlsZWQ6XCIsXG4gICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgICk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVkaXNDbGllbnQ7XG59O1xuIiwgImltcG9ydCBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuaW1wb3J0IGp3dCwgeyBKd3RQYXlsb2FkLCBTaWduT3B0aW9ucyB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcblxuY29uc3QgY3JlYXRlVG9rZW4gPSAoXG4gIHBheWxvYWQ6IEp3dFBheWxvYWQsXG4gIHNlY3JldDogc3RyaW5nLFxuICBleHBpcmVzSW46IFNpZ25PcHRpb25zLFxuKSA9PiB7XG4gIC8vIGp0aSBndWFyYW50ZWVzIGJ5dGUtdW5pcXVlIHRva2VucyBldmVuIHdpdGhpbiB0aGUgc2FtZSBpYXQgc2Vjb25kIFx1MjAxNFxuICAvLyBvdGhlcndpc2UgdHdvIHRva2VucyBtaW50ZWQgZm9yIHRoZSBzYW1lIHVzZXIgaW4gb25lIHNlY29uZCBjb2xsaWRlIG9uXG4gIC8vIHRoZSByZWZyZXNoLWxlZGdlciB1bmlxdWUgaGFzaCAoU3RlcCAyMikuXG4gIGNvbnN0IHRva2VuID0gand0LnNpZ24oeyAuLi5wYXlsb2FkLCBqdGk6IGNyeXB0by5yYW5kb21VVUlEKCkgfSwgc2VjcmV0LCBleHBpcmVzSW4pO1xuXG4gIHJldHVybiB0b2tlbjtcbn07XG5cbmNvbnN0IHZlcmlmeVRva2VuID0gKHRva2VuOiBzdHJpbmcsIHNlY3JldDogc3RyaW5nKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdmVyaWZpZWRUb2tlbiA9IGp3dC52ZXJpZnkodG9rZW4sIHNlY3JldCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBkYXRhOiB2ZXJpZmllZFRva2VuLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICBjb25zb2xlLmxvZyhcIlRva2VuIFZlcmlmaWNhdGlvbiBGYWlsZWQ6XCIsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogZXJyb3IubWVzc2FnZSxcbiAgICB9O1xuICB9XG59O1xuXG5leHBvcnQgY29uc3Qgand0VXRpbHMgPSB7XG4gIGNyZWF0ZVRva2VuLFxuICB2ZXJpZnlUb2tlbixcbn07XG4iLCAiaW1wb3J0IG5vZGVtYWlsZXIgZnJvbSBcIm5vZGVtYWlsZXJcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG4vLyBOb2RlbWFpbGVyIHRyYW5zcG9ydGVyIGZvciB0aGUgYXV0aCBlbWFpbHMgKFN0ZXAgMjEpIFx1MjAxNCBpZGVudGljYWwgdG8gdGhlXG4vLyByZWZlcmVuY2UgYmFja2VuZCAoR21haWwgYXBwLXBhc3N3b3JkIFNNVFApLiBOdWxsIHdoZW4gdW5jb25maWd1cmVkIHNvIHRoZVxuLy8gYXBwIHN0aWxsIGJvb3RzOyB0aGUgYXV0aCBlbWFpbCBoZWxwZXJzIHRoZW4gYmVjb21lIGJlc3QtZWZmb3J0IG5vLW9wcy5cbmV4cG9ydCBjb25zdCB0cmFuc3BvcnRlciA9XG4gIGNvbmZpZy5zbXRwX3VzZXIgJiYgY29uZmlnLnNtdHBfcGFzc3dvcmRcbiAgICA/IG5vZGVtYWlsZXIuY3JlYXRlVHJhbnNwb3J0KHtcbiAgICAgICAgc2VydmljZTogXCJnbWFpbFwiLFxuICAgICAgICBhdXRoOiB7XG4gICAgICAgICAgdXNlcjogY29uZmlnLnNtdHBfdXNlcixcbiAgICAgICAgICBwYXNzOiBjb25maWcuc210cF9wYXNzd29yZCxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgOiBudWxsO1xuIiwgImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgZWpzIGZyb20gXCJlanNcIjtcblxuLy8gUmVuZGVycyBhbiBFSlMgZW1haWwgdGVtcGxhdGUgYnkgbmFtZS4gVGhlIHRlbXBsYXRlIGRpcmVjdG9yeSBpcyByZXNvbHZlZCBhdFxuLy8gcnVudGltZSB3aXRoIGZhbGxiYWNrcyBzbyBpdCB3b3JrcyBpbiBldmVyeSBob3N0OlxuLy8gICAtIGRldiAoYHRzeCB3YXRjaGApIGFuZCBsb2NhbCBgZGlzdGAgcnVuIHdpdGggY3dkID0gcHJvamVjdCByb290IFx1MjE5MiBzcmMvdGVtcGxhdGVzXG4vLyAgIC0gdGhlIFZlcmNlbCBidW5kbGUgKGFwaS9pbmRleC5qcykgaGFzIHRoZSB0ZW1wbGF0ZXMgY29waWVkIHRvIGFwaS90ZW1wbGF0ZXMgXHUyMTkyIDxjd2Q+L3RlbXBsYXRlc1xuZXhwb3J0IGNvbnN0IHJlbmRlclRlbXBsYXRlID0gKG5hbWU6IHN0cmluZywgZGF0YTogb2JqZWN0KTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgXCJzcmMvdGVtcGxhdGVzXCIpLFxuICAgIHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBcInRlbXBsYXRlc1wiKSxcbiAgICBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgXCJhcGkvdGVtcGxhdGVzXCIpLFxuICBdO1xuXG4gIGNvbnN0IGRpciA9IGNhbmRpZGF0ZXMuZmluZCgoZCkgPT4gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZCwgYCR7bmFtZX0uZWpzYCkpKTtcbiAgaWYgKCFkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEVtYWlsIHRlbXBsYXRlIFwiJHtuYW1lfS5lanNcIiBub3QgZm91bmRgKTtcbiAgfVxuXG4gIHJldHVybiBlanMucmVuZGVyRmlsZShwYXRoLmpvaW4oZGlyLCBgJHtuYW1lfS5lanNgKSwgZGF0YSk7XG59OyIsICJpbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcbmltcG9ydCB7IHRyYW5zcG9ydGVyIH0gZnJvbSBcIi4uL2xpYi9ub2RlbWFpbGVyXCI7XG5pbXBvcnQgeyByZW5kZXJUZW1wbGF0ZSB9IGZyb20gXCIuLi90ZW1wbGF0ZXNcIjtcblxuLy8gQmVzdC1lZmZvcnQgTm9kZW1haWxlciBzZW5kZXJzIGZvciB0aGUgYXV0aCBmbG93cyAoU3RlcCAyMSkgXHUyMDE0IG1pcnJvcnMgdGhlXG4vLyByZWZlcmVuY2UgYmFja2VuZCdzIHRyYW5zcG9ydGVyLnNlbmRNYWlsIGNhbGxzIHdpdGggRUpTIHRlbXBsYXRlcyByZW5kZXJlZFxuLy8gZnJvbSBgc3JjL3RlbXBsYXRlcy8qLmVqc2AuIEV2ZXJ5IGZhaWx1cmUgKG1pc3NpbmcgdGVtcGxhdGUsIFNNVFAgZXJyb3IpIGlzXG4vLyBjYXVnaHQgYW5kIGxvZ2dlZCBhcyBhIHdhcm4sIG5ldmVyIHRocm93biwgc28gaXQgY2FuJ3QgZmFpbCB0aGUgYnVzaW5lc3Ncbi8vIHdyaXRlIHRoYXQgdHJpZ2dlcmVkIGl0LiBDYWxsIHNpdGVzIGZpcmUgdGhlc2UgYXNcbi8vIGB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbc2VuZFgoLi4uKV0pYC5cblxuY29uc3QgT1RQX0VYUElSQVRJT05fTUlOVVRFUyA9IDU7XG5cbmludGVyZmFjZSBJQXV0aEVtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2VuZEF1dGhNYWlsKFxuICB0bzogc3RyaW5nLFxuICBzdWJqZWN0OiBzdHJpbmcsXG4gIGJ1aWxkOiAoKSA9PiBQcm9taXNlPHN0cmluZz4sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCF0cmFuc3BvcnRlcikge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gU01UUCBub3QgY29uZmlndXJlZDsgc2tpcHBpbmcgYXV0aCBlbWFpbC5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBodG1sID0gYXdhaXQgYnVpbGQoKTtcbiAgICBhd2FpdCB0cmFuc3BvcnRlci5zZW5kTWFpbCh7XG4gICAgICBmcm9tOiBjb25maWcuc210cF91c2VyIGFzIHN0cmluZyxcbiAgICAgIHRvLFxuICAgICAgc3ViamVjdCxcbiAgICAgIGh0bWwsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc3QgZGV0YWlsID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgIGNvbnNvbGUud2FybihgW2VtYWlsXSBmYWlsZWQgdG8gc2VuZCBcIiR7c3ViamVjdH1cIiB0byAke3RvfTogJHtkZXRhaWx9YCk7XG4gIH1cbn1cblxuLy8gU2VudCByaWdodCBhZnRlciBhIGNyZWRlbnRpYWwgcmVnaXN0cmF0aW9uIHN0YWdlcyBhbiBPVFAgaW4gUmVkaXMuXG5leHBvcnQgY29uc3Qgc2VuZFZlcmlmaWNhdGlvbk90cEVtYWlsID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQXV0aEVtYWlsRGV0YWlscyAmIHsgb3RwOiBzdHJpbmcgfSxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBhd2FpdCBzZW5kQXV0aE1haWwoZGV0YWlscy5lbWFpbCwgXCJFbWFpbCBWZXJpZmljYXRpb24gT1RQXCIsICgpID0+XG4gICAgcmVuZGVyVGVtcGxhdGUoXCJyZWdpc3RyYXRpb24tdXNlci1vdHBcIiwge1xuICAgICAgbmFtZTogZGV0YWlscy5uYW1lLFxuICAgICAgZW1haWw6IGRldGFpbHMuZW1haWwsXG4gICAgICBvdHA6IGRldGFpbHMub3RwLFxuICAgICAgZXhwaXJhdGlvbk1pbnV0ZXM6IE9UUF9FWFBJUkFUSU9OX01JTlVURVMsXG4gICAgfSksXG4gICk7XG59O1xuXG4vLyBTZW50IGJ5IHRoZSBmb3Jnb3QtcGFzc3dvcmQgZmxvdyB3aXRoIHRoZSByZXNldCBPVFAuXG5leHBvcnQgY29uc3Qgc2VuZEZvcmdvdFBhc3N3b3JkT3RwRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElBdXRoRW1haWxEZXRhaWxzICYgeyBvdHA6IHN0cmluZyB9LFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGF3YWl0IHNlbmRBdXRoTWFpbChkZXRhaWxzLmVtYWlsLCBcIkZvcmdvdCBQYXNzd29yZCBSZXNldCBPVFBcIiwgKCkgPT5cbiAgICByZW5kZXJUZW1wbGF0ZShcImZvcmdvdC1wYXNzd29yZFwiLCB7XG4gICAgICBuYW1lOiBkZXRhaWxzLm5hbWUsXG4gICAgICBvdHA6IGRldGFpbHMub3RwLFxuICAgICAgZXhwaXJhdGlvbk1pbnV0ZXM6IE9UUF9FWFBJUkFUSU9OX01JTlVURVMsXG4gICAgfSksXG4gICk7XG59O1xuXG4vLyBTZW50IGFmdGVyIGEgc3VjY2Vzc2Z1bCBlbWFpbCB2ZXJpZmljYXRpb24uIFRoZSBDVEEgbGlua3MgdG8gdGhlIGZyb250ZW5kXG4vLyAocHJvZCBVUkwgaW4gcHJvZHVjdGlvbiwgZGV2IFVSTCBvdGhlcndpc2UpOyBoaWRkZW4gd2hlbiBubyBVUkwgaXMgc2V0LlxuZXhwb3J0IGNvbnN0IHNlbmRXZWxjb21lRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElBdXRoRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGF3YWl0IHNlbmRBdXRoTWFpbChkZXRhaWxzLmVtYWlsLCBcIldlbGNvbWUgdG8gVHJpcFZlcnNlXCIsICgpID0+XG4gICAgcmVuZGVyVGVtcGxhdGUoXCJ3ZWxjb21lLWVtYWlsXCIsIHtcbiAgICAgIG5hbWU6IGRldGFpbHMubmFtZSxcbiAgICAgIGZyb250ZW5kVXJsOlxuICAgICAgICBjb25maWcubm9kZV9lbnYgPT09IFwicHJvZHVjdGlvblwiXG4gICAgICAgICAgPyBjb25maWcuZnJvbnRlbmRfdXJsX3Byb2RcbiAgICAgICAgICA6IGNvbmZpZy5mcm9udGVuZF91cmxfZGV2LFxuICAgIH0pLFxuICApO1xufTtcblxuLy8gU2VudCBhZnRlciBhIHN1Y2Nlc3NmdWwgcGFzc3dvcmQgcmVzZXQuXG5leHBvcnQgY29uc3Qgc2VuZFBhc3N3b3JkUmVzZXRTdWNjZXNzRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElBdXRoRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGF3YWl0IHNlbmRBdXRoTWFpbChkZXRhaWxzLmVtYWlsLCBcIlBhc3N3b3JkIFJlc2V0XCIsICgpID0+XG4gICAgcmVuZGVyVGVtcGxhdGUoXCJyZXNldC1wYXNzd29yZC1zdWNjZXNzXCIsIHtcbiAgICAgIG5hbWU6IGRldGFpbHMubmFtZSxcbiAgICB9KSxcbiAgKTtcbn07IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVxdWVzdEhhbmRsZXIsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGNvbnN0IGNhdGNoQXN5bmMgPSAoZm46IFJlcXVlc3RIYW5kbGVyKSA9PiB7XG4gIHJldHVybiBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZm4ocmVxLCByZXMsIG5leHQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICB9XG4gIH07XG59O1xuIiwgImltcG9ydCB7IFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxudHlwZSBUTWV0YSA9IHtcbiAgcGFnZTogbnVtYmVyO1xuICBsaW1pdDogbnVtYmVyO1xuICB0b3RhbDogbnVtYmVyO1xuICB0b3RhbFBhZ2VzOiBudW1iZXI7XG59O1xuXG50eXBlIFRSZXNwb25zZURhdGE8VD4gPSB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHN0YXR1c0NvZGU6IG51bWJlcjtcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBkYXRhOiBUO1xuICBtZXRhPzogVE1ldGE7XG59O1xuXG5leHBvcnQgY29uc3Qgc2VuZFJlc3BvbnNlID0gPFQ+KHJlczogUmVzcG9uc2UsIGRhdGE6IFRSZXNwb25zZURhdGE8VD4pID0+IHtcbiAgcmVzLnN0YXR1cyhkYXRhLnN0YXR1c0NvZGUpLmpzb24oe1xuICAgIHN1Y2Nlc3M6IGRhdGEuc3VjY2VzcyxcbiAgICBtZXNzYWdlOiBkYXRhLm1lc3NhZ2UsXG4gICAgZGF0YTogZGF0YS5kYXRhLFxuICAgIG1ldGE6IGRhdGEubWV0YSxcbiAgfSk7XG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcblxuY29uc3QgcmVnaXN0ZXJTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIG5hbWU6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTmFtZSBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMiwgXCJOYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgxMDAsIFwiTmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIiksXG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbFwiKSxcbiAgcGFzc3dvcmQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFzc3dvcmQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oNiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IGxlYXN0IDYgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoNzIsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBtb3N0IDcyIGNoYXJhY3RlcnNcIiksXG4gIHBob25lOiB6XG4gICAgLnN0cmluZygpXG4gICAgLm1heCgyMCwgXCJQaG9uZSBudW1iZXIgaXMgdG9vIGxvbmdcIilcbiAgICAub3B0aW9uYWwoKSxcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgbG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbFwiKSxcbiAgcGFzc3dvcmQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFzc3dvcmQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgZ29vZ2xlTG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkVG9rZW46IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiR29vZ2xlIGlkVG9rZW4gaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgZGVtb0xvZ2luU2NoZW1hID0gei5vYmplY3Qoe1xuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSwge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgcm9sZVwiLFxuICB9KSxcbn0pO1xuXG4vLyByZWZyZXNoVG9rZW4gbWF5IGNvbWUgZnJvbSB0aGUgaHR0cE9ubHkgY29va2llIE9SIHRoZSByZXF1ZXN0IGJvZHkgXHUyMDE0XG4vLyB2YWxpZGF0aW9uIGlzIGxlbmllbnQgaGVyZTsgdGhlIGNvbnRyb2xsZXIgaGFuZGxlcyBib3RoIHNvdXJjZXMuXG5jb25zdCByZWZyZXNoVG9rZW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJlZnJlc2hUb2tlbjogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBlbWFpbFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpO1xuXG5jb25zdCBvdHBTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJPVFAgaXMgcmVxdWlyZWRcIiB9KVxuICAubGVuZ3RoKDYsIFwiT1RQIG11c3QgYmUgZXhhY3RseSA2IGRpZ2l0c1wiKVxuICAucmVnZXgoL15cXGR7Nn0kLywgXCJPVFAgbXVzdCBiZSBleGFjdGx5IDYgZGlnaXRzXCIpO1xuXG5jb25zdCB2ZXJpZnlFbWFpbFNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IGVtYWlsU2NoZW1hLFxuICBvdHA6IG90cFNjaGVtYSxcbn0pO1xuXG5jb25zdCByZXNlbmRWZXJpZmljYXRpb25TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGVtYWlsOiBlbWFpbFNjaGVtYSxcbn0pO1xuXG5jb25zdCBmb3Jnb3RQYXNzd29yZFNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IGVtYWlsU2NoZW1hLFxufSk7XG5cbmNvbnN0IHJlc2V0UGFzc3dvcmRTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGVtYWlsOiBlbWFpbFNjaGVtYSxcbiAgb3RwOiBvdHBTY2hlbWEsXG4gIG5ld1Bhc3N3b3JkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk5ldyBwYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbig2LCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCg3MiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IG1vc3QgNzIgY2hhcmFjdGVyc1wiKSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUUmVnaXN0ZXJTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZWdpc3RlclNjaGVtYT47XG5leHBvcnQgdHlwZSBUTG9naW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBsb2dpblNjaGVtYT47XG5leHBvcnQgdHlwZSBUR29vZ2xlTG9naW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBnb29nbGVMb2dpblNjaGVtYT47XG5leHBvcnQgdHlwZSBUUmVmcmVzaFRva2VuU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgcmVmcmVzaFRva2VuU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRWZXJpZnlFbWFpbFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHZlcmlmeUVtYWlsU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRSZXNldFBhc3N3b3JkU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgcmVzZXRQYXNzd29yZFNjaGVtYT47XG5cbmV4cG9ydCBjb25zdCBhdXRoVmFsaWRhdGlvbnMgPSB7XG4gIHJlZ2lzdGVyU2NoZW1hLFxuICBsb2dpblNjaGVtYSxcbiAgZ29vZ2xlTG9naW5TY2hlbWEsXG4gIGRlbW9Mb2dpblNjaGVtYSxcbiAgcmVmcmVzaFRva2VuU2NoZW1hLFxuICB2ZXJpZnlFbWFpbFNjaGVtYSxcbiAgcmVzZW5kVmVyaWZpY2F0aW9uU2NoZW1hLFxuICBmb3Jnb3RQYXNzd29yZFNjaGVtYSxcbiAgcmVzZXRQYXNzd29yZFNjaGVtYSxcbn07IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgWm9kVHlwZSB9IGZyb20gXCJ6b2RcIjtcblxudHlwZSBWYWxpZGF0aW9uU2NoZW1hID0ge1xuICBib2R5PzogWm9kVHlwZTtcbiAgcXVlcnk/OiBab2RUeXBlO1xuICBwYXJhbXM/OiBab2RUeXBlO1xufTtcblxuLy8gUnVucyBab2Qgc2NoZW1hcyBhZ2FpbnN0IHJlcS5ib2R5L3F1ZXJ5L3BhcmFtcyBhbmQgcmVwbGFjZXMgdGhlIHBhcnNlZFxuLy8gdmFsdWVzIHNvIGRvd25zdHJlYW0gaGFuZGxlcnMgd29yayB3aXRoIHZhbGlkYXRlZCAoYW5kIHR5cGVkKSBkYXRhLlxuLy8gQW55IFpvZEVycm9yIHRocm93biBoZXJlIGlzIG1hcHBlZCB0byBhIDQwMCBieSBnbG9iYWxFcnJvckhhbmRsZXIuXG4vL1xuLy8gcmVxLmJvZHkgaXMgc2FmZWx5IHdyaXRhYmxlLCBidXQgaW4gRXhwcmVzcyA1IHJlcS5xdWVyeS9yZXEucGFyYW1zIGFyZVxuLy8gZ2V0dGVyLW9ubHkgXHUyMDE0IHRoZXkgbXVzdCBiZSByZWRlZmluZWQgdmlhIGRlZmluZVByb3BlcnR5IHRvIHN3YXAgaW4gdGhlXG4vLyBwYXJzZWQgdmFsdWVzLlxuY29uc3QgdmFsaWRhdGVSZXF1ZXN0ID0gKHNjaGVtYTogVmFsaWRhdGlvblNjaGVtYSkgPT4ge1xuICByZXR1cm4gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgaWYgKHNjaGVtYS5ib2R5KSB7XG4gICAgICByZXEuYm9keSA9IHNjaGVtYS5ib2R5LnBhcnNlKHJlcS5ib2R5KTtcbiAgICB9XG4gICAgaWYgKHNjaGVtYS5xdWVyeSkge1xuICAgICAgY29uc3QgcGFyc2VkUXVlcnkgPSBzY2hlbWEucXVlcnkucGFyc2UocmVxLnF1ZXJ5KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXEsIFwicXVlcnlcIiwge1xuICAgICAgICB2YWx1ZTogcGFyc2VkUXVlcnksXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKHNjaGVtYS5wYXJhbXMpIHtcbiAgICAgIGNvbnN0IHBhcnNlZFBhcmFtcyA9IHNjaGVtYS5wYXJhbXMucGFyc2UocmVxLnBhcmFtcyk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVxLCBcInBhcmFtc1wiLCB7XG4gICAgICAgIHZhbHVlOiBwYXJzZWRQYXJhbXMsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBuZXh0KCk7XG4gIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCB2YWxpZGF0ZVJlcXVlc3Q7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgSnd0UGF5bG9hZCB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgand0VXRpbHMgfSBmcm9tIFwiLi4vdXRpbHMvand0XCI7XG5cbi8vIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTikgXHUyMTkyIG9ubHkgdGhvc2Ugcm9sZXMgcGFzc1xuLy8gYXV0aCgpIFx1MjE5MiBhbnkgYXV0aGVudGljYXRlZCB1c2VyIHBhc3Nlc1xuY29uc3QgYXV0aCA9ICguLi5yZXF1aXJlZFJvbGVzOiBSb2xlW10pID0+IHtcbiAgcmV0dXJuIGNhdGNoQXN5bmMoYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdG9rZW4gPSByZXEuY29va2llcy5hY2Nlc3NUb2tlblxuICAgICAgPyByZXEuY29va2llcy5hY2Nlc3NUb2tlblxuICAgICAgOiByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uPy5zdGFydHNXaXRoKFwiQmVhcmVyIFwiKVxuICAgICAgICA/IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb24uc3BsaXQoXCIgXCIpWzFdXG4gICAgICAgIDogcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbjtcblxuICAgIC8vIDEuIHRva2VuIG11c3QgYmUgcHJlc2VudFxuICAgIGlmICghdG9rZW4pIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAxLFxuICAgICAgICBcIllvdSBhcmUgbm90IGxvZ2dlZCBpbi4gUGxlYXNlIGxvZ2luIHRvIGNvbnRpbnVlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyAyLiB2ZXJpZnkgdGhlIGFjY2VzcyB0b2tlblxuICAgIGNvbnN0IHZlcmlmaWVkVG9rZW4gPSBqd3RVdGlscy52ZXJpZnlUb2tlbihcbiAgICAgIHRva2VuLFxuICAgICAgY29uZmlnLmp3dF9hY2Nlc3Nfc2VjcmV0LFxuICAgICk7XG5cbiAgICBpZiAoIXZlcmlmaWVkVG9rZW4uc3VjY2Vzcykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgdmVyaWZpZWRUb2tlbi5lcnJvcik7XG4gICAgfVxuXG4gICAgY29uc3QgeyBpZCwgdG9rZW5WZXJzaW9uIH0gPSB2ZXJpZmllZFRva2VuLmRhdGEgYXMgSnd0UGF5bG9hZCAmIHtcbiAgICAgIHRva2VuVmVyc2lvbjogbnVtYmVyO1xuICAgIH07XG5cbiAgICAvLyAzLiByZS1mZXRjaCB1c2VyIHRvIGVuZm9yY2UgYWNjb3VudCBzdGF0ZSBvbiBldmVyeSByZXF1ZXN0XG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgd2hlcmU6IHsgaWQgfSxcbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJVc2VyIG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJVc2VyIGlzIHN1c3BlbmRlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydCBzZXJ2aWNlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA0LiB0b2tlblZlcnNpb24gbXVzdCBtYXRjaCBEQiAobG9nb3V0IC8gcGFzc3dvcmQgY2hhbmdlIGtpbGxzIG9sZCB0b2tlbnMpXG4gICAgaWYgKHVzZXIudG9rZW5WZXJzaW9uICE9PSB0b2tlblZlcnNpb24pIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAxLFxuICAgICAgICBcIlNlc3Npb24gaXMgbm8gbG9uZ2VyIHZhbGlkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDUuIGF1dGhvcml6YXRpb24gdXNlcyB0aGUgREIgcm9sZSwgbm90IHRoZSAocG9zc2libHkgc3RhbGUpIEpXVCByb2xlXG4gICAgaWYgKHJlcXVpcmVkUm9sZXMubGVuZ3RoICYmICFyZXF1aXJlZFJvbGVzLmluY2x1ZGVzKHVzZXIucm9sZSkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAzLFxuICAgICAgICBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gYWNjZXNzIHRoaXMgcm91dGUuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDYuIGF0dGFjaCB0aGUgYXV0aGVudGljYXRlZCB1c2VyIHRvIHRoZSByZXF1ZXN0XG4gICAgcmVxLnVzZXIgPSB7XG4gICAgICBpZDogdXNlci5pZCxcbiAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgIGVtYWlsOiB1c2VyLmVtYWlsLFxuICAgICAgcm9sZTogdXNlci5yb2xlLFxuICAgIH07XG5cbiAgICBuZXh0KCk7XG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYXV0aDsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHVzZXJDb250cm9sbGVyIH0gZnJvbSBcIi4vdXNlci5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyB1c2VyVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi91c2VyLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE93biBwcm9maWxlIFx1MjAxNCBhbnkgYXV0aGVudGljYXRlZCB1c2VyXG5yb3V0ZXIucGF0Y2goXG4gIFwiL3Byb2ZpbGVcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiB1c2VyVmFsaWRhdGlvbnMudXBkYXRlUHJvZmlsZVNjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIudXBkYXRlUHJvZmlsZSxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBsaXN0IHVzZXJzIHdpdGggZmlsdGVycyArIHBhZ2luYXRpb25cbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogdXNlclZhbGlkYXRpb25zLnVzZXJRdWVyeVNjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIuZ2V0VXNlcnMsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgcm9sZSBtYW5hZ2VtZW50XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9yb2xlXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiB1c2VyVmFsaWRhdGlvbnMudXNlclBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiB1c2VyVmFsaWRhdGlvbnMuY2hhbmdlUm9sZVNjaGVtYSxcbiAgfSksXG4gIHVzZXJDb250cm9sbGVyLmNoYW5nZVJvbGUsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgc3RhdHVzIG1hbmFnZW1lbnRcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogdXNlclZhbGlkYXRpb25zLmNoYW5nZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIHVzZXJDb250cm9sbGVyLmNoYW5nZVN0YXR1cyxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBzb2Z0IGRlbGV0ZVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLmRlbGV0ZVVzZXIsXG4pO1xuXG5leHBvcnQgY29uc3QgdXNlclJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHVzZXJTZXJ2aWNlIH0gZnJvbSBcIi4vdXNlci5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gVXBkYXRlIHByb2ZpbGUgY29udHJvbGxlclxuY29uc3QgdXBkYXRlUHJvZmlsZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UudXBkYXRlUHJvZmlsZSh1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQcm9maWxlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdldCBhbGwgdXNlcnMgKGFkbWluKVxuY29uc3QgZ2V0VXNlcnMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1c2VyU2VydmljZS5nZXRVc2VycyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXJzIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSB1c2VyIHJvbGUgKGFkbWluKVxuY29uc3QgY2hhbmdlUm9sZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgLy8gYW4gYWRtaW4gbXVzdCBub3QgZG93bmdyYWRlL2NoYW5nZSB0aGVpciBvd24gcm9sZVxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBjaGFuZ2UgeW91ciBvd24gcm9sZS5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5jaGFuZ2VSb2xlKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciByb2xlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSB1c2VyIHN0YXR1cyAoYWRtaW4pXG5jb25zdCBjaGFuZ2VTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IHN1c3BlbmQvYWN0aXZhdGUgdGhlaXIgb3duIGFjY291bnRcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgY2hhbmdlIHlvdXIgb3duIHN0YXR1cy5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5jaGFuZ2VTdGF0dXMoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBTb2Z0IGRlbGV0ZSB1c2VyIChhZG1pbilcbmNvbnN0IGRlbGV0ZVVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IGRlbGV0ZSB0aGVpciBvd24gYWNjb3VudFxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBkZWxldGUgeW91ciBvd24gYWNjb3VudC5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5kZWxldGVVc2VyKGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCB1c2VyQ29udHJvbGxlciA9IHtcbiAgdXBkYXRlUHJvZmlsZSxcbiAgZ2V0VXNlcnMsXG4gIGNoYW5nZVJvbGUsXG4gIGNoYW5nZVN0YXR1cyxcbiAgZGVsZXRlVXNlcixcbn07IiwgImltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBSb2xlLCBVc2VyU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7XG4gIElDaGFuZ2VSb2xlLFxuICBJQ2hhbmdlU3RhdHVzLFxuICBJVXBkYXRlUHJvZmlsZSxcbiAgSVVzZXJRdWVyeSxcbn0gZnJvbSBcIi4vdXNlci5pbnRlcmZhY2VcIjtcblxuY29uc3QgdmFsaWRhdGVBY3RpdmVVc2VyID0gYXN5bmMgKGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cbiAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJVc2VyIGlzIHN1c3BlbmRlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydCBzZXJ2aWNlLlwiKTtcbiAgfVxuXG4gIHJldHVybiB1c2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFVwZGF0ZSBwcm9maWxlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgdXBkYXRlUHJvZmlsZSA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSVVwZGF0ZVByb2ZpbGUpID0+IHtcbiAgY29uc3QgeyBuYW1lLCBwaG9uZSwgYXZhdGFyVXJsLCBjdXJyZW50UGFzc3dvcmQsIG5ld1Bhc3N3b3JkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlT3JUaHJvdyh7IHdoZXJlOiB7IGlkOiB1c2VySWQgfSB9KTtcblxuICBpZiAodXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaGFzIGJlZW4gZGVsZXRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5hdXRoUHJvdmlkZXIgPT09IFwiR09PR0xFXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDMsXG4gICAgICBcIkdvb2dsZSBhY2NvdW50cyBjYW5ub3QgY2hhbmdlIHBhc3N3b3JkLiBVc2UgR29vZ2xlIHNpZ24taW4gdG8gbWFuYWdlIHlvdXIgcHJvZmlsZS5cIixcbiAgICApO1xuICB9XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLlVzZXJVcGRhdGVJbnB1dCA9IHt9O1xuXG4gIGlmIChuYW1lKSBkYXRhLm5hbWUgPSBuYW1lO1xuICBpZiAocGhvbmUpIGRhdGEucGhvbmUgPSBwaG9uZTtcbiAgaWYgKGF2YXRhclVybCkgZGF0YS5hdmF0YXJVcmwgPSBhdmF0YXJVcmw7XG5cbiAgLy8gUGFzc3dvcmQgY2hhbmdlIHJlcXVpcmVzIGN1cnJlbnRQYXNzd29yZCArIG5ld1Bhc3N3b3JkXG4gIGlmIChuZXdQYXNzd29yZCkge1xuICAgIGlmICghY3VycmVudFBhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkN1cnJlbnQgcGFzc3dvcmQgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuICAgIGlmIChjdXJyZW50UGFzc3dvcmQgPT09IG5ld1Bhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIk5ldyBwYXNzd29yZCBtdXN0IGJlIGRpZmZlcmVudFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBpc01hdGNoID0gYXdhaXQgYmNyeXB0LmNvbXBhcmUoY3VycmVudFBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkIHx8IFwiXCIpO1xuICAgIGlmICghaXNNYXRjaCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGN1cnJlbnQgcGFzc3dvcmRcIik7XG4gICAgfVxuXG4gICAgZGF0YS5wYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgICAgbmV3UGFzc3dvcmQsXG4gICAgICBOdW1iZXIoY29uZmlnLmJjcnlwdF9zYWx0X3JvdW5kcyksXG4gICAgKTtcbiAgICBkYXRhLnRva2VuVmVyc2lvbiA9IHsgaW5jcmVtZW50OiAxIH07XG4gIH1cblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIGRhdGEsXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gdXBkYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IGxpc3QgdXNlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRVc2VycyA9IGFzeW5jIChxdWVyeTogSVVzZXJRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSB8fCAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0IHx8IDEwO1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVXNlcldoZXJlSW5wdXQgPSB7XG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgfTtcblxuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUuT1IgPSBbXG4gICAgICB7IG5hbWU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgIHsgZW1haWw6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICBdO1xuICB9XG4gIGlmIChxdWVyeS5yb2xlKSB3aGVyZS5yb2xlID0gcXVlcnkucm9sZTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuXG4gIGNvbnN0IFt1c2VycywgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS51c2VyLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgc2tpcDogKHBhZ2UgLSAxKSAqIGxpbWl0LFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEudXNlci5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IHVzZXJzLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IHVwZGF0ZSByb2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY2hhbmdlUm9sZSA9IGFzeW5jIChpZDogc3RyaW5nLCBwYXlsb2FkOiBJQ2hhbmdlUm9sZSkgPT4ge1xuICBjb25zdCB7IHJvbGUgfSA9IHBheWxvYWQ7XG5cbiAgYXdhaXQgdmFsaWRhdGVBY3RpdmVVc2VyKGlkKTtcblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IHJvbGUsIHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiB1cGRhdGUgc3RhdHVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY2hhbmdlU3RhdHVzID0gYXN5bmMgKGlkOiBzdHJpbmcsIHBheWxvYWQ6IElDaGFuZ2VTdGF0dXMpID0+IHtcbiAgY29uc3QgeyBzdGF0dXMgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YToge1xuICAgICAgc3RhdHVzLFxuICAgICAgLy8gcmVhY3RpdmF0aW5nIHByZXNlcnZlcyB0aGUgYWNjb3VudCB3aGlsZSBzdXNwZW5kaW5nIHJldm9rZXMgYWxsIHNlc3Npb25zXG4gICAgICAuLi4oc3RhdHVzID09PSBVc2VyU3RhdHVzLlNVU1BFTkRFRCAmJiB7IHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9KSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBzb2Z0IGRlbGV0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGRlbGV0ZVVzZXIgPSBhc3luYyAoaWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICBjb25zdCBkZWxldGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSwgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gZGVsZXRlZFVzZXI7XG59O1xuXG5leHBvcnQgY29uc3QgdXNlclNlcnZpY2UgPSB7XG4gIHVwZGF0ZVByb2ZpbGUsXG4gIGdldFVzZXJzLFxuICBjaGFuZ2VSb2xlLFxuICBjaGFuZ2VTdGF0dXMsXG4gIGRlbGV0ZVVzZXIsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUm9sZSwgVXNlclN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5cbmNvbnN0IHVwZGF0ZVByb2ZpbGVTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIG5hbWU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgICBwaG9uZTogelxuICAgICAgLnN0cmluZygpXG4gICAgICAudHJpbSgpXG4gICAgICAubWF4KDIwLCBcIlBob25lIG51bWJlciBpcyB0b28gbG9uZ1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gICAgYXZhdGFyVXJsOiB6LnN0cmluZygpLnRyaW0oKS51cmwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGltYWdlIFVSTFwiKS5vcHRpb25hbCgpLFxuICAgIGN1cnJlbnRQYXNzd29yZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgICBuZXdQYXNzd29yZDogelxuICAgICAgLnN0cmluZygpXG4gICAgICAubWluKDYsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBsZWFzdCA2IGNoYXJhY3RlcnNcIilcbiAgICAgIC5tYXgoNzIsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBtb3N0IDcyIGNoYXJhY3RlcnNcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICB9KVxuICAucmVmaW5lKFxuICAgIChkYXRhKSA9PlxuICAgICAgZGF0YS5uZXdQYXNzd29yZCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICBkYXRhLmN1cnJlbnRQYXNzd29yZCAhPT0gdW5kZWZpbmVkLFxuICAgIHsgbWVzc2FnZTogXCJDdXJyZW50IHBhc3N3b3JkIGlzIHJlcXVpcmVkIHRvIGNoYW5nZSBwYXNzd29yZFwiIH0sXG4gICk7XG5cbmNvbnN0IHVzZXJRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5vcHRpb25hbCgpLFxuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSkub3B0aW9uYWwoKSxcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oVXNlclN0YXR1cykub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCB1c2VyUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJVc2VyIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IGNoYW5nZVJvbGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlLCB7IHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgcm9sZVwiIH0pLFxufSk7XG5cbmNvbnN0IGNoYW5nZVN0YXR1c1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oVXNlclN0YXR1cywge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgc3RhdHVzXCIsXG4gIH0pLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRVcGRhdGVQcm9maWxlU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXBkYXRlUHJvZmlsZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUVXNlclF1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXNlclF1ZXJ5U2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IHVzZXJWYWxpZGF0aW9ucyA9IHtcbiAgdXBkYXRlUHJvZmlsZVNjaGVtYSxcbiAgdXNlclF1ZXJ5U2NoZW1hLFxuICB1c2VyUGFyYW1zU2NoZW1hLFxuICBjaGFuZ2VSb2xlU2NoZW1hLFxuICBjaGFuZ2VTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IG11bHRlciBmcm9tIFwibXVsdGVyXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB7IHVwbG9hZHNDb250cm9sbGVyIH0gZnJvbSBcIi4vdXBsb2Fkcy5jb250cm9sbGVyXCI7XG5cbmNvbnN0IHVwbG9hZCA9IG11bHRlcih7XG4gIHN0b3JhZ2U6IG11bHRlci5tZW1vcnlTdG9yYWdlKCksXG4gIGxpbWl0czogeyBmaWxlU2l6ZTogNSAqIDEwMjQgKiAxMDI0IH0sXG4gIGZpbGVGaWx0ZXI6IChfcmVxLCBmaWxlLCBjYikgPT4ge1xuICAgIGlmICgvXmltYWdlXFwvKGpwZWd8cG5nfHdlYnApJC8udGVzdChmaWxlLm1pbWV0eXBlKSkge1xuICAgICAgY2IobnVsbCwgdHJ1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKFxuICAgICAgICBPYmplY3QuYXNzaWduKG5ldyBFcnJvcihcIk9ubHkganBnLCBwbmcgb3Igd2VicCBpbWFnZXMgYXJlIGFsbG93ZWRcIiksIHtcbiAgICAgICAgICBjb2RlOiBcIklOVkFMSURfRklMRV9UWVBFXCIsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG4gIH0sXG59KTtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9pbWFnZVwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB1cGxvYWQuc2luZ2xlKFwiaW1hZ2VcIiksXG4gIHVwbG9hZHNDb250cm9sbGVyLnVwbG9hZEltYWdlLFxuKTtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5IH0gZnJvbSBcIi4vdXBsb2Fkcy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbi8vIFVwbG9hZCBhIHNpbmdsZSBpbWFnZSAoQUdFTlQvQURNSU4pIFx1MjE5MiBDbG91ZGluYXJ5XG5jb25zdCB1cGxvYWRJbWFnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGlmICghcmVxLmZpbGUpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW1hZ2UgZmlsZSBpcyByZXF1aXJlZFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeShyZXEuZmlsZSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJJbWFnZSB1cGxvYWRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgdXBsb2Fkc0NvbnRyb2xsZXIgPSB7XG4gIHVwbG9hZEltYWdlLFxufTsiLCAiaW1wb3J0IHsgdjIgYXMgY2xvdWRpbmFyeSB9IGZyb20gXCJjbG91ZGluYXJ5XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuY2xvdWRpbmFyeS5jb25maWcoe1xuICBjbG91ZF9uYW1lOiBjb25maWcuY2xvdWRpbmFyeV9jbG91ZF9uYW1lLFxuICBhcGlfa2V5OiBjb25maWcuY2xvdWRpbmFyeV9hcGlfa2V5LFxuICBhcGlfc2VjcmV0OiBjb25maWcuY2xvdWRpbmFyeV9hcGlfc2VjcmV0LFxufSk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsb3VkaW5hcnk7IiwgImltcG9ydCBjbG91ZGluYXJ5IGZyb20gXCIuLi8uLi9saWIvY2xvdWRpbmFyeVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5ID0gKFxuICBmaWxlOiBFeHByZXNzLk11bHRlci5GaWxlLFxuKTogUHJvbWlzZTx7IHVybDogc3RyaW5nOyBwdWJsaWNJZDogc3RyaW5nIH0+ID0+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCB1cGxvYWRTdHJlYW0gPSBjbG91ZGluYXJ5LnVwbG9hZGVyLnVwbG9hZF9zdHJlYW0oXG4gICAgICB7IGZvbGRlcjogXCJ0cmlwdmVyc2VcIiB9LFxuICAgICAgKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKGVycm9yIHx8ICFyZXN1bHQpIHtcbiAgICAgICAgICByZWplY3QobmV3IEFwcEVycm9yKDQwMCwgXCJJbWFnZSB1cGxvYWQgZmFpbGVkLiBQbGVhc2UgdHJ5IGFnYWluLlwiKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJlc29sdmUoeyB1cmw6IHJlc3VsdC5zZWN1cmVfdXJsLCBwdWJsaWNJZDogcmVzdWx0LnB1YmxpY19pZCB9KTtcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHVwbG9hZFN0cmVhbS5lbmQoZmlsZS5idWZmZXIpO1xuICB9KTtcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBjb250YWN0Q29udHJvbGxlciB9IGZyb20gXCIuL2NvbnRhY3QuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgY29udGFjdFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vY29udGFjdC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIHJvdXRlIChwdWJsaWMsIG5vIGF1dGgpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGNvbnRhY3RWYWxpZGF0aW9ucy5jcmVhdGVNZXNzYWdlU2NoZW1hIH0pLFxuICBjb250YWN0Q29udHJvbGxlci5jcmVhdGVNZXNzYWdlLFxuKTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIHJvdXRlIChhZG1pbiBvbmx5KVxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBjb250YWN0VmFsaWRhdGlvbnMuY29udGFjdFF1ZXJ5U2NoZW1hIH0pLFxuICBjb250YWN0Q29udHJvbGxlci5nZXRNZXNzYWdlcyxcbik7XG5cbi8vIDMuIE1hcmsgcmVzb2x2ZWQvdW5yZXNvbHZlZCByb3V0ZSAoYWRtaW4gb25seSlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBjb250YWN0VmFsaWRhdGlvbnMuY29udGFjdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBjb250YWN0VmFsaWRhdGlvbnMudXBkYXRlUmVzb2x2ZWRTY2hlbWEsXG4gIH0pLFxuICBjb250YWN0Q29udHJvbGxlci51cGRhdGVSZXNvbHZlZCxcbik7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgY29udGFjdFNlcnZpY2UgfSBmcm9tIFwiLi9jb250YWN0LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGNyZWF0ZU1lc3NhZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgY29udGFjdFNlcnZpY2UuY3JlYXRlTWVzc2FnZShyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJNZXNzYWdlIHNlbnQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbWVzc2FnZSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyBjb250cm9sbGVyIChhZG1pbiBvbmx5KVxuY29uc3QgZ2V0TWVzc2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb250YWN0U2VydmljZS5saXN0TWVzc2FnZXMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDb250YWN0IG1lc3NhZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gTWFyayByZXNvbHZlZC91bnJlc29sdmVkIGNvbnRyb2xsZXIgKGFkbWluIG9ubHkpXG5jb25zdCB1cGRhdGVSZXNvbHZlZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHsgaXNSZXNvbHZlZCB9ID0gcmVxLmJvZHk7XG5cbiAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgY29udGFjdFNlcnZpY2UucmVzb2x2ZU1lc3NhZ2UoaWQsIGlzUmVzb2x2ZWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIk1lc3NhZ2Ugc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbWVzc2FnZSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlTWVzc2FnZSxcbiAgZ2V0TWVzc2FnZXMsXG4gIHVwZGF0ZVJlc29sdmVkLFxufTsiLCAiaW1wb3J0IHsgUmVzZW5kIH0gZnJvbSBcInJlc2VuZFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cyB9IGZyb20gXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGFjdEVtYWlsRGV0YWlscyB7XG4gIG5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgc3ViamVjdDogc3RyaW5nO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGNyZWF0ZWRBdD86IERhdGU7XG59XG5cbi8vIExhemlseSBpbml0aWFsaXNlZCBzbyB0aGUgbW9kdWxlIGlzIGltcG9ydGFibGUgZXZlbiB3aGVuIFJFU0VORF9BUElfS0VZXG4vLyBpcyBub3QgY29uZmlndXJlZCAoZS5nLiBsb2NhbCBkZXYgLyBkZW1vIHdpdGhvdXQgZW1haWwpLlxubGV0IHJlc2VuZDogUmVzZW5kIHwgbnVsbCA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldFJlc2VuZCgpOiBSZXNlbmQgfCBudWxsIHtcbiAgaWYgKHJlc2VuZCkgcmV0dXJuIHJlc2VuZDtcbiAgaWYgKCFjb25maWcucmVzZW5kX2FwaV9rZXkpIHJldHVybiBudWxsO1xuICByZXNlbmQgPSBuZXcgUmVzZW5kKGNvbmZpZy5yZXNlbmRfYXBpX2tleSk7XG4gIHJldHVybiByZXNlbmQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVIdG1sKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdmFsdWVcbiAgICAucmVwbGFjZSgvJi9nLCBcIiZhbXA7XCIpXG4gICAgLnJlcGxhY2UoLzwvZywgXCImbHQ7XCIpXG4gICAgLnJlcGxhY2UoLz4vZywgXCImZ3Q7XCIpXG4gICAgLnJlcGxhY2UoL1wiL2csIFwiJnF1b3Q7XCIpXG4gICAgLnJlcGxhY2UoLycvZywgXCImIzAzOTtcIik7XG59XG5cbi8vIFdyYXBzIGEgUmVzZW5kIHNlbmQgc28gZmFpbHVyZXMgYmVjb21lIGEgc2luZ2xlIGNsZWFuIHdhcm5pbmcgbGluZSBpbnN0ZWFkXG4vLyBvZiB0aGUgU0RLJ3Mgbm9pc3kgbXVsdGktbGluZSBlcnJvci4gUmVzZW5kIGNhbiBsZWdpdGltYXRlbHkgcmVqZWN0IHNlbmRzXG4vLyAoZS5nLiB0aGUgZGVmYXVsdCBvbmJvYXJkaW5nQHJlc2VuZC5kZXYgc2VuZGVyIG1heSBvbmx5IGRlbGl2ZXIgdG8gdGhlXG4vLyBhY2NvdW50IG93bmVyKSwgc28gZW1haWxzIGFyZSBzdHJpY3RseSBiZXN0LWVmZm9ydC5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRXaXRoTG9nKFxuICBjbGllbnQ6IFJlc2VuZCxcbiAgc3ViamVjdDogc3RyaW5nLFxuICB0bzogc3RyaW5nW10sXG4gIGh0bWw6IHN0cmluZyxcbiAgcmVwbHlUbz86IHN0cmluZyxcbik6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIGF3YWl0IGNsaWVudC5lbWFpbHMuc2VuZCh7XG4gICAgICBmcm9tOiBjb25maWcuZW1haWxfZnJvbSB8fCBcIlRyaXBWZXJzZSA8b25ib2FyZGluZ0ByZXNlbmQuZGV2PlwiLFxuICAgICAgdG8sXG4gICAgICBzdWJqZWN0LFxuICAgICAgaHRtbCxcbiAgICAgIC4uLihyZXBseVRvID8geyByZXBseVRvIH0gOiB7fSksXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc3QgZGV0YWlsID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgIGNvbnNvbGUud2FybihgW2VtYWlsXSBzZW5kIGZhaWxlZCAoJHtzdWJqZWN0fSkgdG8gJHt0by5qb2luKFwiLCBcIil9OiAke2RldGFpbH1gKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgZW1haWxMYXlvdXQgPSAoY29udGVudDogc3RyaW5nKSA9PiBgXG4gIDxkaXYgc3R5bGU9XCJmb250LWZhbWlseTogQXJpYWwsIEhlbHZldGljYSwgc2Fucy1zZXJpZjsgbWF4LXdpZHRoOiA1NjBweDsgbWFyZ2luOiAwIGF1dG87IGNvbG9yOiAjMWExYTFhO1wiPlxuICAgIDxkaXYgc3R5bGU9XCJiYWNrZ3JvdW5kOiAjMGY3NjZlOyBwYWRkaW5nOiAyNHB4OyBib3JkZXItcmFkaXVzOiA4cHggOHB4IDAgMDtcIj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6ICNmZmZmZmY7IGZvbnQtc2l6ZTogMThweDsgZm9udC13ZWlnaHQ6IGJvbGQ7XCI+VHJpcFZlcnNlPC9zcGFuPlxuICAgIDwvZGl2PlxuICAgIDxkaXYgc3R5bGU9XCJib3JkZXI6IDFweCBzb2xpZCAjZTVlN2ViOyBib3JkZXItdG9wOiBub25lOyBwYWRkaW5nOiAzMnB4OyBib3JkZXItcmFkaXVzOiAwIDAgOHB4IDhweDtcIj5cbiAgICAgICR7Y29udGVudH1cbiAgICA8L2Rpdj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTJweDsgY29sb3I6ICM2YjcyODA7IG1hcmdpbi10b3A6IDE2cHg7IHRleHQtYWxpZ246IGNlbnRlcjtcIj5cbiAgICAgIFlvdSBhcmUgcmVjZWl2aW5nIHRoaXMgZW1haWwgYmVjYXVzZSBvZiBhY3Rpdml0eSBvbiBUcmlwVmVyc2UuXG4gICAgPC9wPlxuICA8L2Rpdj5cbmA7XG5cbi8vIE5vdGlmaWVzIHRoZSBzdXBwb3J0IGluYm94IGFib3V0IGEgbmV3IGNvbnRhY3QgZm9ybSBzdWJtaXNzaW9uLlxuZXhwb3J0IGNvbnN0IHNlbmRDb250YWN0Tm90aWZpY2F0aW9uID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQ29udGFjdEVtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zdCBjbGllbnQgPSBnZXRSZXNlbmQoKTtcbiAgaWYgKCFjbGllbnQgfHwgIWNvbmZpZy5jb250YWN0X3JlY2VpdmVyX2VtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGNvbnRhY3Qgbm90aWZpY2F0aW9uLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBjcmVhdGVkQXQgPSBkZXRhaWxzLmNyZWF0ZWRBdD8udG9JU09TdHJpbmcoKSA/PyBcImp1c3Qgbm93XCI7XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+TmV3IGNvbnRhY3QgbWVzc2FnZTwvaDI+XG4gICAgPHRhYmxlIHN0eWxlPVwid2lkdGg6IDEwMCU7IGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7IGZvbnQtc2l6ZTogMTRweDtcIj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwOyB3aWR0aDogMTIwcHg7XCI+TmFtZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5FbWFpbDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChkZXRhaWxzLmVtYWlsKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlN1YmplY3Q8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLnN1YmplY3QpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+UmVjZWl2ZWQ8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoY3JlYXRlZEF0KX08L3RkPlxuICAgICAgPC90cj5cbiAgICA8L3RhYmxlPlxuICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOiAxNnB4OyBwYWRkaW5nOiAxNnB4OyBiYWNrZ3JvdW5kOiAjZjlmYWZiOyBib3JkZXItcmFkaXVzOiA2cHg7IHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcIj5cbiAgICAgICR7ZXNjYXBlSHRtbChkZXRhaWxzLm1lc3NhZ2UpfVxuICAgIDwvZGl2PlxuICBgO1xuXG4gIGF3YWl0IHNlbmRXaXRoTG9nKFxuICAgIGNsaWVudCxcbiAgICBgTmV3IGNvbnRhY3QgbWVzc2FnZTogJHtkZXRhaWxzLnN1YmplY3R9YCxcbiAgICBbY29uZmlnLmNvbnRhY3RfcmVjZWl2ZXJfZW1haWxdLFxuICAgIGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICApO1xufTtcblxuLy8gU2VuZHMgYSBjb25maXJtYXRpb24gcmVwbHkgdG8gdGhlIHBlcnNvbiB3aG8gc3VibWl0dGVkIHRoZSBmb3JtLlxuZXhwb3J0IGNvbnN0IHNlbmRDb250YWN0QXV0b1JlcGx5ID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQ29udGFjdEVtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zdCBjbGllbnQgPSBnZXRSZXNlbmQoKTtcbiAgaWYgKCFjbGllbnQgfHwgIWRldGFpbHMuZW1haWwpIHtcbiAgICBjb25zb2xlLndhcm4oXCJbZW1haWxdIFJlc2VuZCBub3QgY29uZmlndXJlZDsgc2tpcHBpbmcgY29udGFjdCBhdXRvLXJlcGx5LlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCByZWNlaXZlckVtYWlsID0gY29uZmlnLmNvbnRhY3RfcmVjZWl2ZXJfZW1haWw7XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+VGhhbmtzIGZvciByZWFjaGluZyBvdXQsICR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfSE8L2gyPlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxNHB4OyBsaW5lLWhlaWdodDogMS42OyBjb2xvcjogIzM3NDE1MTtcIj5cbiAgICAgIFdlJmFwb3M7dmUgcmVjZWl2ZWQgeW91ciBtZXNzYWdlIGFib3V0XG4gICAgICA8c3Ryb25nPiZsZHF1bzske2VzY2FwZUh0bWwoZGV0YWlscy5zdWJqZWN0KX0mcmRxdW87PC9zdHJvbmc+IGFuZCBvdXIgc3VwcG9ydFxuICAgICAgdGVhbSB3aWxsIGdldCBiYWNrIHRvIHlvdSB3aXRoaW4gb25lIGJ1c2luZXNzIGRheS5cbiAgICA8L3A+XG4gIGA7XG5cbiAgYXdhaXQgc2VuZFdpdGhMb2coXG4gICAgY2xpZW50LFxuICAgIFwiV2UgcmVjZWl2ZWQgeW91ciBtZXNzYWdlIC0gVHJpcFZlcnNlXCIsXG4gICAgW2RldGFpbHMuZW1haWxdLFxuICAgIGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICAgIHJlY2VpdmVyRW1haWwsXG4gICk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQm9va2luZyBlbWFpbHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5leHBvcnQgaW50ZXJmYWNlIElCb29raW5nRW1haWxEZXRhaWxzIHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBwYWNrYWdlVGl0bGU6IHN0cmluZztcbiAgdHJhdmVsRGF0ZTogRGF0ZTtcbiAgdHJhdmVsZXJzOiBudW1iZXI7XG4gIHRvdGFsUHJpY2U6IG51bWJlcjtcbiAgc3RhdHVzOiBCb29raW5nU3RhdHVzO1xufVxuXG4vLyBJbmZvcm1zIHRoZSBjdXN0b21lciBhYm91dCBhIGJvb2tpbmcgY3JlYXRlL2NvbmZpcm0vY2FuY2VsLlxuLy8gQmVzdC1lZmZvcnQgbGlrZSB0aGUgY29udGFjdCBlbWFpbHMgXHUyMDE0IGEgZmFpbHVyZSBtdXN0IG5ldmVyIGZhaWwgdGhlIHJlcXVlc3QuXG5leHBvcnQgY29uc3Qgc2VuZEJvb2tpbmdFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSUJvb2tpbmdFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGJvb2tpbmcgZW1haWwuXCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHRyYXZlbERhdGUgPSBkZXRhaWxzLnRyYXZlbERhdGUudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCk7XG5cbiAgY29uc3Qgc3RhdHVzQ29weTogUmVjb3JkPFxuICAgIEJvb2tpbmdTdGF0dXMsXG4gICAgeyBzdWJqZWN0OiBzdHJpbmc7IGhlYWRpbmc6IHN0cmluZzsgYm9keTogc3RyaW5nIH1cbiAgPiA9IHtcbiAgICBbQm9va2luZ1N0YXR1cy5QRU5ESU5HXToge1xuICAgICAgc3ViamVjdDogXCJCb29raW5nIHJlY2VpdmVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIkJvb2tpbmcgcmVjZWl2ZWRcIixcbiAgICAgIGJvZHk6IFwiV2UndmUgcmVjZWl2ZWQgeW91ciBib29raW5nIHJlcXVlc3QuIFRoZSBhZ2VudCB3aWxsIGNvbmZpcm0gaXQgc2hvcnRseS5cIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLlBBSURdOiB7XG4gICAgICBzdWJqZWN0OiBcIlBheW1lbnQgcmVjZWl2ZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiUGF5bWVudCByZWNlaXZlZFwiLFxuICAgICAgYm9keTogXCJZb3VyIHBheW1lbnQgaGFzIGJlZW4gcmVjZWl2ZWQsIGFuZCB0aGUgYWdlbnQgd2lsbCBjb25maXJtIHlvdXIgYm9va2luZyBzaG9ydGx5LlwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXToge1xuICAgICAgc3ViamVjdDogXCJCb29raW5nIGNvbmZpcm1lZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJCb29raW5nIGNvbmZpcm1lZFwiLFxuICAgICAgYm9keTogXCJHcmVhdCBuZXdzIFx1MjAxNCB5b3VyIGJvb2tpbmcgaGFzIGJlZW4gY29uZmlybWVkLiBXZSBsb29rIGZvcndhcmQgdG8gaG9zdGluZyB5b3UhXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgY2FuY2VsbGVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIkJvb2tpbmcgY2FuY2VsbGVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgYm9va2luZyBoYXMgYmVlbiBjYW5jZWxsZWQuIElmIHRoaXMgd2Fzbid0IGV4cGVjdGVkLCBwbGVhc2UgY29udGFjdCBzdXBwb3J0LlwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09NUExFVEVEXToge1xuICAgICAgc3ViamVjdDogXCJUcmlwIGNvbXBsZXRlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJUcmlwIGNvbXBsZXRlZFwiLFxuICAgICAgYm9keTogXCJZb3VyIHRyaXAgaGFzIGJlZW4gbWFya2VkIGFzIGNvbXBsZXRlZC4gVGhhbmsgeW91IGZvciB0cmF2ZWxsaW5nIHdpdGggVHJpcFZlcnNlIVwiLFxuICAgIH0sXG4gIH07XG5cbiAgY29uc3QgY29weSA9IHN0YXR1c0NvcHlbZGV0YWlscy5zdGF0dXNdO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPiR7Y29weS5oZWFkaW5nfTwvaDI+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDE0cHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjMzc0MTUxO1wiPlxuICAgICAgSGkgJHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9LDxici8+XG4gICAgICAke2NvcHkuYm9keX1cbiAgICA8L3A+XG4gICAgPHRhYmxlIHN0eWxlPVwid2lkdGg6IDEwMCU7IGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7IGZvbnQtc2l6ZTogMTRweDtcIj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwOyB3aWR0aDogMTIwcHg7XCI+UGFja2FnZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGRldGFpbHMucGFja2FnZVRpdGxlKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRyYXZlbCBkYXRlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKHRyYXZlbERhdGUpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VHJhdmVsZXJzPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKFN0cmluZyhkZXRhaWxzLnRyYXZlbGVycykpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VG90YWw8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiYjMjU0Nzske2VzY2FwZUh0bWwoZGV0YWlscy50b3RhbFByaWNlLnRvRml4ZWQoMikpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgIDwvdGFibGU+XG4gIGA7XG5cbiAgYXdhaXQgc2VuZFdpdGhMb2coXG4gICAgY2xpZW50LFxuICAgIGNvcHkuc3ViamVjdCxcbiAgICBbZGV0YWlscy5lbWFpbF0sXG4gICAgZW1haWxMYXlvdXQoY29udGVudCksXG4gICk7XG59O1xuXG4vLyBJbmZvcm1zIHRoZSBjdXN0b21lciB0aGF0IGEgcGFpZCBib29raW5nIHdhcyBjYW5jZWxsZWQgYW5kIHRoZSBwYXltZW50IGhhc1xuLy8gYmVlbiByZWZ1bmRlZC4gQmVzdC1lZmZvcnQgbGlrZSB0aGUgb3RoZXIgZW1haWxzLlxuZXhwb3J0IGludGVyZmFjZSBJUmVmdW5kRW1haWxEZXRhaWxzIHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBwYWNrYWdlVGl0bGU6IHN0cmluZztcbiAgdHJhdmVsRGF0ZTogRGF0ZTtcbiAgYW1vdW50OiBudW1iZXI7XG4gIHJlZnVuZFJlZklkPzogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGNvbnN0IHNlbmRSZWZ1bmRFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSVJlZnVuZEVtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zdCBjbGllbnQgPSBnZXRSZXNlbmQoKTtcbiAgaWYgKCFjbGllbnQgfHwgIWRldGFpbHMuZW1haWwpIHtcbiAgICBjb25zb2xlLndhcm4oXCJbZW1haWxdIFJlc2VuZCBub3QgY29uZmlndXJlZDsgc2tpcHBpbmcgcmVmdW5kIGVtYWlsLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB0cmF2ZWxEYXRlID0gZGV0YWlscy50cmF2ZWxEYXRlLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPlJlZnVuZCBpc3N1ZWQ8L2gyPlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxNHB4OyBsaW5lLWhlaWdodDogMS42OyBjb2xvcjogIzM3NDE1MTtcIj5cbiAgICAgIEhpICR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfSw8YnIvPlxuICAgICAgWW91ciBib29raW5nIHdhcyBjYW5jZWxsZWQsIGFuZCA8c3Ryb25nPiYjMjU0Nzske2VzY2FwZUh0bWwoXG4gICAgICAgIGRldGFpbHMuYW1vdW50LnRvRml4ZWQoMiksXG4gICAgICApfTwvc3Ryb25nPiBoYXMgYmVlbiByZWZ1bmRlZCB0byB5b3VyIG9yaWdpbmFsIHBheW1lbnQgbWV0aG9kLiBQbGVhc2UgYWxsb3dcbiAgICAgIDUtMTAgYnVzaW5lc3MgZGF5cyBmb3IgdGhlIG1vbmV5IHRvIGFwcGVhci5cbiAgICA8L3A+XG4gICAgPHRhYmxlIHN0eWxlPVwid2lkdGg6IDEwMCU7IGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7IGZvbnQtc2l6ZTogMTRweDtcIj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwOyB3aWR0aDogMTIwcHg7XCI+UGFja2FnZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGRldGFpbHMucGFja2FnZVRpdGxlKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRyYXZlbCBkYXRlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKHRyYXZlbERhdGUpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+UmVmdW5kZWQgYW1vdW50PC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4mIzI1NDc7JHtlc2NhcGVIdG1sKGRldGFpbHMuYW1vdW50LnRvRml4ZWQoMikpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgJHtkZXRhaWxzLnJlZnVuZFJlZklkXG4gICAgICAgID8gYFxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+UmVmdW5kIHJlZmVyZW5jZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChkZXRhaWxzLnJlZnVuZFJlZklkKX08L3RkPlxuICAgICAgPC90cj5gXG4gICAgICAgIDogXCJcIn1cbiAgICA8L3RhYmxlPlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxM3B4OyBsaW5lLWhlaWdodDogMS42OyBjb2xvcjogIzZiNzI4MDsgbWFyZ2luLXRvcDogMTZweDtcIj5cbiAgICAgIElmIHlvdSBoYXZlIGFueSBxdWVzdGlvbnMgYWJvdXQgdGhpcyByZWZ1bmQsIHBsZWFzZSBjb250YWN0IHN1cHBvcnQuXG4gICAgPC9wPlxuICBgO1xuXG4gIGF3YWl0IHNlbmRXaXRoTG9nKFxuICAgIGNsaWVudCxcbiAgICBcIkJvb2tpbmcgY2FuY2VsbGVkICYgcmVmdW5kIGlzc3VlZCAtIFRyaXBWZXJzZVwiLFxuICAgIFtkZXRhaWxzLmVtYWlsXSxcbiAgICBlbWFpbExheW91dChjb250ZW50KSxcbiAgKTtcbn07IiwgImltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7XG4gIHNlbmRDb250YWN0QXV0b1JlcGx5LFxuICBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbixcbn0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQgeyBJQ29udGFjdFF1ZXJ5LCBJQ3JlYXRlQ29udGFjdFBheWxvYWQgfSBmcm9tIFwiLi9jb250YWN0LmludGVyZmFjZVwiO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIChwdWJsaWMpXG5jb25zdCBjcmVhdGVNZXNzYWdlID0gYXN5bmMgKHBheWxvYWQ6IElDcmVhdGVDb250YWN0UGF5bG9hZCkgPT4ge1xuICBjb25zdCBjcmVhdGVkTWVzc2FnZSA9IGF3YWl0IHByaXNtYS5jb250YWN0TWVzc2FnZS5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIG5hbWU6IHBheWxvYWQubmFtZSxcbiAgICAgIGVtYWlsOiBwYXlsb2FkLmVtYWlsLFxuICAgICAgc3ViamVjdDogcGF5bG9hZC5zdWJqZWN0LFxuICAgICAgbWVzc2FnZTogcGF5bG9hZC5tZXNzYWdlLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIEVtYWlscyBhcmUgYmVzdC1lZmZvcnQ6IGEgZmFpbHVyZSBoZXJlIG11c3QgbmV2ZXIgZmFpbCB0aGUgc3VibWlzc2lvblxuICAvLyAodGhlIG1lc3NhZ2UgaXMgYWxyZWFkeSBzYXZlZCB0byB0aGUgaW5ib3gpLlxuICBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRDb250YWN0Tm90aWZpY2F0aW9uKHsgLi4uY3JlYXRlZE1lc3NhZ2UsIGNyZWF0ZWRBdDogY3JlYXRlZE1lc3NhZ2UuY3JlYXRlZEF0IH0pLFxuICAgIHNlbmRDb250YWN0QXV0b1JlcGx5KHsgLi4uY3JlYXRlZE1lc3NhZ2UsIGNyZWF0ZWRBdDogY3JlYXRlZE1lc3NhZ2UuY3JlYXRlZEF0IH0pLFxuICBdKTtcblxuICByZXR1cm4gY3JlYXRlZE1lc3NhZ2U7XG59O1xuXG4vLyAyLiBMaXN0IGNvbnRhY3QgbWVzc2FnZXMgKGFkbWluIG9ubHksIHBhZ2luYXRlZCwgZmlsdGVyYWJsZSBieSBpc1Jlc29sdmVkKVxuY29uc3QgbGlzdE1lc3NhZ2VzID0gYXN5bmMgKHF1ZXJ5OiBJQ29udGFjdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Db250YWN0TWVzc2FnZVdoZXJlSW5wdXQgfCB1bmRlZmluZWQgPVxuICAgIHF1ZXJ5LmlzUmVzb2x2ZWQgPT09IHVuZGVmaW5lZFxuICAgICAgPyB1bmRlZmluZWRcbiAgICAgIDogeyBpc1Jlc29sdmVkOiBxdWVyeS5pc1Jlc29sdmVkIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuY29udGFjdE1lc3NhZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuY29udGFjdE1lc3NhZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG4vLyAzLiBNYXJrIGEgY29udGFjdCBtZXNzYWdlIHJlc29sdmVkL3VucmVzb2x2ZWQgKGFkbWluIG9ubHkpXG5jb25zdCByZXNvbHZlTWVzc2FnZSA9IGFzeW5jIChpZDogc3RyaW5nLCBpc1Jlc29sdmVkOiBib29sZWFuKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuY29udGFjdE1lc3NhZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGRhdGE6IHsgaXNSZXNvbHZlZCB9LFxuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBjb250YWN0U2VydmljZSA9IHtcbiAgY3JlYXRlTWVzc2FnZSxcbiAgbGlzdE1lc3NhZ2VzLFxuICByZXNvbHZlTWVzc2FnZSxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZU1lc3NhZ2VTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIG5hbWU6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTmFtZSBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMiwgXCJOYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgxMDAsIFwiTmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIiksXG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbCBhZGRyZXNzXCIpLFxuICBzdWJqZWN0OiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlN1YmplY3QgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAubWluKDIsIFwiU3ViamVjdCBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMjAwLCBcIlN1YmplY3QgbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpLFxuICBtZXNzYWdlOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk1lc3NhZ2UgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAubWluKDEwLCBcIk1lc3NhZ2UgbXVzdCBiZSBhdCBsZWFzdCAxMCBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgyMDAwLCBcIk1lc3NhZ2UgbXVzdCBiZSBhdCBtb3N0IDIwMDAgY2hhcmFjdGVyc1wiKSxcbn0pLnN0cmljdCgpO1xuXG5jb25zdCBjb250YWN0UXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIGlzUmVzb2x2ZWQ6IHpcbiAgICAuZW51bShbXCJ0cnVlXCIsIFwiZmFsc2VcIl0pXG4gICAgLm9wdGlvbmFsKClcbiAgICAudHJhbnNmb3JtKCh2YWwpID0+ICh2YWwgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IHZhbCA9PT0gXCJ0cnVlXCIpKSxcbn0pO1xuXG5jb25zdCBjb250YWN0UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJNZXNzYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVJlc29sdmVkU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBpc1Jlc29sdmVkOiB6LmJvb2xlYW4oe1xuICAgICAgcmVxdWlyZWRfZXJyb3I6IFwiaXNSZXNvbHZlZCBpcyByZXF1aXJlZFwiLFxuICAgICAgaW52YWxpZF90eXBlX2Vycm9yOiBcImlzUmVzb2x2ZWQgbXVzdCBiZSBhIGJvb2xlYW5cIixcbiAgICB9KSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IHR5cGVvZiBkYXRhLmlzUmVzb2x2ZWQgPT09IFwiYm9vbGVhblwiLCB7XG4gICAgbWVzc2FnZTogXCJpc1Jlc29sdmVkIG11c3QgYmUgYSBib29sZWFuXCIsXG4gIH0pO1xuXG5leHBvcnQgY29uc3QgY29udGFjdFZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVNZXNzYWdlU2NoZW1hLFxuICBjb250YWN0UXVlcnlTY2hlbWEsXG4gIGNvbnRhY3RQYXJhbXNTY2hlbWEsXG4gIHVwZGF0ZVJlc29sdmVkU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGJvb2tpbmdDb250cm9sbGVyIH0gZnJvbSBcIi4vYm9va2luZy5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBib29raW5nVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9ib29raW5nLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIENyZWF0ZSBib29raW5nIChjdXN0b21lciBvbmx5IFx1MjAxNCBhZ2VudHMgc2VsbCwgYWRtaW5zIG1hbmFnZSlcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBib29raW5nVmFsaWRhdGlvbnMuY3JlYXRlU2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5jcmVhdGVCb29raW5nLFxuKTtcblxuLy8gTXkgYm9va2luZ3MgXHUyMDE0IG93biBib29raW5ncyB3aXRoIGZpbHRlcnMgKyBwYWdpbmF0aW9uIChvd25lciBpcyBhbHdheXMgVVNFUilcbi8vIE5PVEU6IHJlZ2lzdGVyZWQgYmVmb3JlIFwiLzppZFwiIHNvIHRoZSBwYXJhbSByb3V0ZSBkb2Vzbid0IHN3YWxsb3cgaXQuXG5yb3V0ZXIuZ2V0KFxuICBcIi9teS1ib29raW5nc1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1F1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRNeUJvb2tpbmdzLFxuKTtcblxuLy8gQWdlbnQgYm9va2luZ3MgXHUyMDE0IHNjb3BlZCB0byBwYWNrYWdlcyB0aGUgYWdlbnQgb3duc1xucm91dGVyLmdldChcbiAgXCIvYWdlbnQtYm9va2luZ3NcIixcbiAgYXV0aChSb2xlLkFHRU5UKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nU2VhcmNoUXVlcnlTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmdldEFnZW50Qm9va2luZ3MsXG4pO1xuXG4vLyBCb29raW5nIGRldGFpbCBcdTIwMTQgb3duZXIgLyBwYWNrYWdlIGFnZW50IC8gYWRtaW5cbnJvdXRlci5nZXQoXG4gIFwiLzppZFwiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdQYXJhbXNTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmdldEJvb2tpbmdEZXRhaWwsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgYWxsIGJvb2tpbmdzXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nU2VhcmNoUXVlcnlTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmdldEFsbEJvb2tpbmdzLFxuKTtcblxuLy8gU3RhdHVzIHRyYW5zaXRpb24gXHUyMDE0IHZhbGlkYXRlZCBhZ2FpbnN0IHRoZSBzdGF0ZSBtYWNoaW5lIGluIHRoZSBzZXJ2aWNlXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogYm9va2luZ1ZhbGlkYXRpb25zLnVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLnVwZGF0ZUJvb2tpbmdTdGF0dXMsXG4pO1xuXG5leHBvcnQgY29uc3QgYm9va2luZ1JvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGJvb2tpbmdTZXJ2aWNlIH0gZnJvbSBcIi4vYm9va2luZy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuY29uc3QgY3JlYXRlQm9va2luZyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBib29raW5nID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuY3JlYXRlQm9va2luZyh1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmcgY3JlYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBib29raW5nLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0TXlCb29raW5ncyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBib29raW5nU2VydmljZS5nZXRNeUJvb2tpbmdzKHVzZXJJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldEFnZW50Qm9va2luZ3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0QWdlbnRCb29raW5ncyh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRCb29raW5nRGV0YWlsID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBjb25zdCBib29raW5nID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0Qm9va2luZ0RldGFpbChpZCwgcmVxLnVzZXIhKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5nIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBib29raW5nLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0QWxsQm9va2luZ3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBib29raW5nU2VydmljZS5nZXRBbGxCb29raW5ncyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgdXBkYXRlQm9va2luZ1N0YXR1cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLnVwZGF0ZUJvb2tpbmdTdGF0dXMoXG4gICAgICBpZCxcbiAgICAgIHJlcS5ib2R5LFxuICAgICAgcmVxLnVzZXIhLFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZyBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBib29raW5nLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdDb250cm9sbGVyID0ge1xuICBjcmVhdGVCb29raW5nLFxuICBnZXRNeUJvb2tpbmdzLFxuICBnZXRBZ2VudEJvb2tpbmdzLFxuICBnZXRCb29raW5nRGV0YWlsLFxuICBnZXRBbGxCb29raW5ncyxcbiAgdXBkYXRlQm9va2luZ1N0YXR1cyxcbn07IiwgImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcblxuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnL2luZGV4XCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi91dGlscy9hcHBFcnJvclwiO1xuXG4vLyBQYXltZW50IGlzIGFuIG9wdGlvbmFsIGZlYXR1cmU6IHRoZSBBUEkgbXVzdCBib290IGFuZCBzZXJ2ZSBldmVyeXRoaW5nIGVsc2Vcbi8vIGV2ZW4gd2hlbiB0aGUgU1NMQ29tbWVyeiBzdG9yZSBpc24ndCBjb25maWd1cmVkIHlldC4gVGhlc2UgdGhyb3cgYSBjbGVhbiA0MDBcbi8vIG9uIHRoZSBwYXltZW50LW9ubHkgcGF0aHMgcmF0aGVyIHRoYW4gY3Jhc2ggdGhlIHdob2xlIGRlcGxveW1lbnQgYXQgYm9vdC5cbmNvbnN0IHJlcXVpcmVDb25maWcgPSAoKSA9PiB7XG4gIGlmICghY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX2lkIHx8ICFjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfcGFzc3dvcmQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIlNTTENvbW1lcnogaXMgbm90IGNvbmZpZ3VyZWQuIFNldCBTU0xfQ09NTUVSWl9TVE9SRV9JRCBhbmQgU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQuXCIsXG4gICAgKTtcbiAgfVxuICBpZiAoIWNvbmZpZy5iYWNrZW5kX3B1YmxpY191cmwpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIlNTTENvbW1lcnogaXMgbm90IGNvbmZpZ3VyZWQuIFNldCBCQUNLRU5EX1BVQkxJQ19VUkwgdG8gdGhlIHB1YmxpY2x5IHJlYWNoYWJsZSBiYWNrZW5kIFVSTC5cIixcbiAgICApO1xuICB9XG4gIHJldHVybiB7XG4gICAgc3RvcmVJZDogY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX2lkLFxuICAgIHN0b3JlUGFzc3dvcmQ6IGNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9wYXNzd29yZCxcbiAgfTtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3NsY29tbWVyekluaXRSZXN1bHQge1xuICBzdGF0dXM6IHN0cmluZztcbiAgZmFpbGVkcmVhc29uPzogc3RyaW5nO1xuICBzZXNzaW9ua2V5Pzogc3RyaW5nO1xuICBHYXRld2F5UGFnZVVSTD86IHN0cmluZztcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHtcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGVycm9yPzogc3RyaW5nO1xuICB2YWxfaWQ/OiBzdHJpbmc7XG4gIGFtb3VudD86IHN0cmluZztcbiAgY3VycmVuY3k/OiBzdHJpbmc7XG4gIGJhbmtfdHJhbl9pZD86IHN0cmluZztcbiAgY2FyZF90eXBlPzogc3RyaW5nO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3NsY29tbWVyelJlZnVuZFJlc3VsdCB7XG4gIEFQSUNvbm5lY3Q/OiBzdHJpbmc7XG4gIHN0YXR1cz86IHN0cmluZzsgLy8gc3VjY2VzcyB8IGZhaWxlZCB8IHByb2Nlc3NpbmdcbiAgZXJyb3JSZWFzb24/OiBzdHJpbmc7XG4gIHJlZnVuZF9yZWZfaWQ/OiBzdHJpbmc7XG4gIGJhbmtfdHJhbl9pZD86IHN0cmluZztcbiAgdHJhbnNfaWQ/OiBzdHJpbmc7XG4gIFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuLy8gU1NMQ29tbWVyeiB0cnVuY2F0ZXMgdHJhbl9pZCB0byAzMCBjaGFycyBcdTIwMTQgZGF0ZSArIHRpbWUgKyByYW5kb20gc2FsdCBzdGF5cyBzYWZlbHkgdW5kZXIuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVUcmFuSWQoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGBUUk5YX0lELSR7RGF0ZS5ub3coKX0tJHtyYW5kb21VVUlEKCkucmVwbGFjZSgvLS9nLCBcIlwiKS5zbGljZSgwLCA4KX1gO1xufVxuXG4vLyBVbmlxdWUgcmVmdW5kIHRyYW5zYWN0aW9uIGlkIChtYW5kYXRvcnkgYnkgdGhlIHJlZnVuZCBBUEkgc2luY2UgMjQvMDIvMjAyNSxcbi8vIG1heCAzMCBjaGFycykgXHUyMDE0IGEgZnJlc2ggb25lIHBlciByZWZ1bmQgYXR0ZW1wdCBzbyB0aGUgZ2F0ZXdheSBuZXZlciByZWplY3RzIGFcbi8vIGR1cGxpY2F0ZS5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZVJlZnVuZFRyYW5JZCgpOiBzdHJpbmcge1xuICByZXR1cm4gYFJGRC0ke0RhdGUubm93KCl9LSR7cmFuZG9tVVVJRCgpLnJlcGxhY2UoLy0vZywgXCJcIikuc2xpY2UoMCwgOCl9YDtcbn1cblxuLy8gSW5pdGlhdGVzIGEgZ2F0ZXdheSBzZXNzaW9uLiBTZXJ2ZXItdG8tc2VydmVyIFBPU1QsIGZvcm0tZW5jb2RlZC4gVGhlIGdhdGV3YXlcbi8vIHJlc3BvbmRzIHdpdGggdGhlIGhvc3RlZCBjaGVja291dCBVUkwgKEdhdGV3YXlQYWdlVVJMKSB0aGUgY3VzdG9tZXIgaXMgc2VudCB0by5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6SW5pdChvcHRpb25zOiB7XG4gIHRvdGFsX2Ftb3VudDogbnVtYmVyO1xuICB0cmFuX2lkOiBzdHJpbmc7XG4gIHN1Y2Nlc3NfdXJsOiBzdHJpbmc7XG4gIGZhaWxfdXJsOiBzdHJpbmc7XG4gIGNhbmNlbF91cmw6IHN0cmluZztcbiAgaXBuX3VybDogc3RyaW5nO1xuICBjdXNfbmFtZTogc3RyaW5nO1xuICBjdXNfZW1haWw6IHN0cmluZztcbiAgY3VzX3Bob25lOiBzdHJpbmc7XG59KTogUHJvbWlzZTxTc2xjb21tZXJ6SW5pdFJlc3VsdD4ge1xuICBjb25zdCB7IHN0b3JlSWQsIHN0b3JlUGFzc3dvcmQgfSA9IHJlcXVpcmVDb25maWcoKTtcbiAgY29uc3QgYm9keSA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICB0b3RhbF9hbW91bnQ6IG9wdGlvbnMudG90YWxfYW1vdW50LnRvRml4ZWQoMiksXG4gICAgY3VycmVuY3k6IFwiQkRUXCIsXG4gICAgdHJhbl9pZDogb3B0aW9ucy50cmFuX2lkLFxuICAgIHN1Y2Nlc3NfdXJsOiBvcHRpb25zLnN1Y2Nlc3NfdXJsLFxuICAgIGZhaWxfdXJsOiBvcHRpb25zLmZhaWxfdXJsLFxuICAgIGNhbmNlbF91cmw6IG9wdGlvbnMuY2FuY2VsX3VybCxcbiAgICBpcG5fdXJsOiBvcHRpb25zLmlwbl91cmwsXG4gICAgY3VzX25hbWU6IG9wdGlvbnMuY3VzX25hbWUsXG4gICAgY3VzX2VtYWlsOiBvcHRpb25zLmN1c19lbWFpbCxcbiAgICBjdXNfYWRkMTogXCJOL0FcIixcbiAgICBjdXNfYWRkMjogXCJOL0FcIixcbiAgICBjdXNfY2l0eTogXCJOL0FcIixcbiAgICBjdXNfc3RhdGU6IFwiTi9BXCIsXG4gICAgY3VzX3Bvc3Rjb2RlOiBcIjEwMDBcIixcbiAgICBjdXNfY291bnRyeTogXCJCYW5nbGFkZXNoXCIsXG4gICAgY3VzX3Bob25lOiBvcHRpb25zLmN1c19waG9uZSxcbiAgICBwcm9kdWN0X25hbWU6IFwiVHJpcFZlcnNlIFRvdXIgQm9va2luZ1wiLFxuICAgIHNoaXBwaW5nX21ldGhvZDogXCJOT1wiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChjb25maWcuc3NsY29tbWVyel9pbml0X3VybCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIH0sXG4gICAgYm9keTogYm9keS50b1N0cmluZygpLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IGluaXQgZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IGluaXQgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuXG4gIC8vIFRoZSBnYXRld2F5IHJlcG9ydHMgc3RhdHVzIGluIFVQUEVSQ0FTRSAoXCJTVUNDRVNTXCIgLyBcIkZBSUxFRFwiKTsgYW55IG90aGVyXG4gIC8vIHN0YXR1cywgb3IgYSBzdWNjZXNzIHdpdGhvdXQgdGhlIGhvc3RlZCBjaGVja291dCBVUkwsIGlzIGEgZmFpbGVkIGluaXQuXG4gIGlmIChkYXRhLnN0YXR1cyAhPT0gXCJTVUNDRVNTXCIgfHwgIWRhdGEuR2F0ZXdheVBhZ2VVUkwpIHtcbiAgICBjb25zdCByZWFzb24gPSBkYXRhLmZhaWxlZHJlYXNvbiB8fCBkYXRhLnN0YXR1cyB8fCBcInVua25vd25cIjtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtzc2xjb21tZXJ6XSBpbml0IHJlamVjdGVkICh1cmw9JHtjb25maWcuc3NsY29tbWVyel9pbml0X3VybH0sIHNhbmRib3g9JHtjb25maWcuc3NsX2NvbW1lcnpfc2FuZGJveH0pOiAke3JlYXNvbn1gLFxuICAgICAgZGF0YSxcbiAgICApO1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDUwMixcbiAgICAgIGBTU0xDb21tZXJ6IGluaXQgcmVqZWN0ZWQ6ICR7cmVhc29ufS4gQ2hlY2sgU1NMX0NPTU1FUlpfU1RPUkVfSUQsIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELCBTU0xfQ09NTUVSWl9TQU5EQk9YIGFuZCBTU0xDT01NRVJaX0lOSVRfVVJMIChzZWUgc2VydmVyIGxvZ3MpLmAsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn1cblxuLy8gU2VydmVyLXNpZGUgdmVyaWZpY2F0aW9uIG9mIGEgY29tcGxldGVkIHRyYW5zYWN0aW9uLiBzdGF0dXM6IFZBTElEIC8gVkFMSURBVEVEIC9cbi8vIElOVkFMSURfVFJBTlNBQ1RJT04gLyBGQUlMRUQuIFZBTElEQVRFRCBtZWFucyB0aGUgdHJhbnNhY3Rpb24gd2FzIHZlcmlmaWVkIGJlZm9yZVxuLy8gKGlkZW1wb3RlbnQpLCBJTlZBTElEX1RSQU5TQUNUSU9OIG1lYW5zIHRoZSBhbW91bnQvdHJhbnNhY3Rpb24gbWlzbWF0Y2hlcy5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6VmFsaWRhdGUob3B0aW9uczoge1xuICB2YWxfaWQ6IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0PiB7XG4gIGNvbnN0IHsgc3RvcmVJZCwgc3RvcmVQYXNzd29yZCB9ID0gcmVxdWlyZUNvbmZpZygpO1xuICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICB2YWxfaWQ6IG9wdGlvbnMudmFsX2lkLFxuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICBmb3JtYXQ6IFwianNvblwiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHtjb25maWcuc3NsY29tbWVyel92YWxpZGF0ZV91cmx9PyR7cGFyYW1zLnRvU3RyaW5nKCl9YCwge1xuICAgIG1ldGhvZDogXCJHRVRcIixcbiAgfSk7XG5cbiAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBgU1NMQ29tbWVyeiB2YWxpZGF0aW9uIGZhaWxlZCAoJHtyZXMuc3RhdHVzfSlgKTtcblxuICBsZXQgZGF0YTogU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ7XG4gIHRyeSB7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UodGV4dCkgYXMgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIFwiU1NMQ29tbWVyeiB2YWxpZGF0aW9uIHJldHVybmVkIGEgbm9uLUpTT04gcmVzcG9uc2VcIik7XG4gIH1cbiAgcmV0dXJuIGRhdGE7XG59XG5cbi8vIEluaXRpYXRlcyBhIHJlZnVuZCBhZ2FpbnN0IGEgc2V0dGxlZCB0cmFuc2FjdGlvbiAoUmVmdW5kIEFQSSwgdjQgZG9jcykuIFRoZVxuLy8gdHJhbnNhY3Rpb24gaXMgcmVzb2x2ZWQgYnkgYGJhbmtfdHJhbl9pZGAgKGNhcHR1cmVkIGZyb20gdGhlIGdhdGV3YXkgYXRcbi8vIHBheW1lbnQgdGltZSkuIGByZWZ1bmRfdHJhbnNfaWRgIGlzIGEgbWFuZGF0b3J5LCB1bmlxdWUtcGVyLWF0dGVtcHQgaWQuXG4vLyBPbmx5IGBzdGF0dXM6IFwic3VjY2Vzc1wiYCAoQVBJQ29ubmVjdCBET05FKSBpcyB0cmVhdGVkIGFzIGEgY29uZmlybWVkIHJlZnVuZDtcbi8vIGFueXRoaW5nIGVsc2UgKGZhaWxlZC9wcm9jZXNzaW5nL3BlbmRpbmcpIHRocm93cy4gQm91bmRlZCB0byA4cyBzbyBhIGh1bmdcbi8vIGdhdGV3YXkgY2FuJ3QgaG9sZCB0aGUgY2FuY2VsbGluZyByZXF1ZXN0LlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpSZWZ1bmQob3B0aW9uczoge1xuICBiYW5rX3RyYW5faWQ6IHN0cmluZztcbiAgcmVmdW5kX3RyYW5zX2lkPzogc3RyaW5nO1xuICByZWZ1bmRfYW1vdW50OiBudW1iZXI7XG4gIHJlZnVuZF9yZW1hcmtzOiBzdHJpbmc7XG4gIHJlZmVfaWQ/OiBzdHJpbmc7XG59KTogUHJvbWlzZTxTc2xjb21tZXJ6UmVmdW5kUmVzdWx0PiB7XG4gIGNvbnN0IHsgc3RvcmVJZCwgc3RvcmVQYXNzd29yZCB9ID0gcmVxdWlyZUNvbmZpZygpO1xuICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICBiYW5rX3RyYW5faWQ6IG9wdGlvbnMuYmFua190cmFuX2lkLFxuICAgIHJlZnVuZF90cmFuc19pZDogb3B0aW9ucy5yZWZ1bmRfdHJhbnNfaWQgPz8gZ2VuZXJhdGVSZWZ1bmRUcmFuSWQoKSxcbiAgICBzdG9yZV9pZDogc3RvcmVJZCxcbiAgICBzdG9yZV9wYXNzd2Q6IHN0b3JlUGFzc3dvcmQsXG4gICAgcmVmdW5kX2Ftb3VudDogb3B0aW9ucy5yZWZ1bmRfYW1vdW50LnRvRml4ZWQoMiksXG4gICAgcmVmdW5kX3JlbWFya3M6IG9wdGlvbnMucmVmdW5kX3JlbWFya3MsXG4gICAgZm9ybWF0OiBcImpzb25cIixcbiAgICB2OiBcIjFcIixcbiAgfSk7XG4gIGlmIChvcHRpb25zLnJlZmVfaWQpIHBhcmFtcy5zZXQoXCJyZWZlX2lkXCIsIG9wdGlvbnMucmVmZV9pZCk7XG5cbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goXG4gICAgYCR7Y29uZmlnLnNzbGNvbW1lcnpfcmVmdW5kX3VybH0/JHtwYXJhbXMudG9TdHJpbmcoKX1gLFxuICAgIHsgbWV0aG9kOiBcIkdFVFwiLCBzaWduYWw6IEFib3J0U2lnbmFsLnRpbWVvdXQoODAwMCkgfSxcbiAgKTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IHJlZnVuZCBmYWlsZWQgKCR7cmVzLnN0YXR1c30pYCk7XG5cbiAgbGV0IGRhdGE6IFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ7XG4gIHRyeSB7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UodGV4dCkgYXMgU3NsY29tbWVyelJlZnVuZFJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IHJlZnVuZCByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlXCIpO1xuICB9XG5cbiAgLy8gV2hpdGVsaXN0OiBvbmx5IGFuIGV4cGxpY2l0IGBzdWNjZXNzYCBjb3VudHMgYXMgYSBjb25maXJtZWQgcmVmdW5kLiBBbnkgb3RoZXJcbiAgLy8gc3RhdHVzIChmYWlsZWQsIHByb2Nlc3NpbmcsIHBlbmRpbmcsIG9yIGFuIHVuZXhwZWN0ZWQgdmFsdWUpIHRocm93cyBcdTIwMTQgc28gdGhlXG4gIC8vIHBheW1lbnQgcm93IGNhbiBuZXZlciBmbGlwIHRvIFJFRlVOREVEIGJlZm9yZSB0aGUgZ2F0ZXdheSBhY3R1YWxseSBzZXR0bGVzLlxuICBpZiAoZGF0YS5BUElDb25uZWN0ICE9PSBcIkRPTkVcIiB8fCBkYXRhLnN0YXR1cyAhPT0gXCJzdWNjZXNzXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA1MDIsXG4gICAgICBgU1NMQ29tbWVyeiByZWZ1bmQgcmVqZWN0ZWQ6ICR7ZGF0YS5lcnJvclJlYXNvbiA/PyBkYXRhLkFQSUNvbm5lY3QgPz8gZGF0YS5zdGF0dXMgPz8gXCJ1bmtub3duXCJ9YCxcbiAgICApO1xuICB9XG4gIHJldHVybiBkYXRhO1xufSIsICJpbXBvcnQgeyBOb3RpZmljYXRpb25UeXBlIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi9saWIvcHJpc21hXCI7XG5cbi8vIEJlc3QtZWZmb3J0IGluLWFwcCBub3RpZmljYXRpb24gXHUyMDE0IG1pcnJvcnMgdGhlIGVtYWlsIGhlbHBlcnMuIEEgZmFpbHVyZSBpc1xuLy8gbG9nZ2VkIGFuZCBzd2FsbG93ZWQsIG5ldmVyIHRocm93biwgc28gYSBub3RpZmljYXRpb24gaW5zZXJ0IGNhbid0IGZhaWwgdGhlXG4vLyBidXNpbmVzcyB3cml0ZSB0aGF0IGNhdXNlZCBpdC4gQ2FsbCBzaXRlcyBmaXJlIGl0IGFzXG4vLyBgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW25vdGlmeSguLi4pXSlgLlxuZXhwb3J0IGNvbnN0IG5vdGlmeSA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHR5cGU6IE5vdGlmaWNhdGlvblR5cGUsXG4gIHRpdGxlOiBzdHJpbmcsXG4gIG1lc3NhZ2U6IHN0cmluZyxcbiAgbGluaz86IHN0cmluZyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICB0cnkge1xuICAgIGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24uY3JlYXRlKHtcbiAgICAgIGRhdGE6IHsgdXNlcklkLCB0eXBlLCB0aXRsZSwgbWVzc2FnZSwgbGluayB9LFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBgW25vdGlmaWNhdGlvbl0gZmFpbGVkIHRvIGNyZWF0ZSAke3R5cGV9IGZvciB1c2VyICR7dXNlcklkfTogJHtcbiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpXG4gICAgICB9YCxcbiAgICApO1xuICB9XG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMsIE5vdGlmaWNhdGlvblR5cGUsIFBhY2thZ2VTdGF0dXMsIFBheW1lbnRTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzc2xjb21tZXJ6UmVmdW5kIH0gZnJvbSBcIi4uLy4uL2xpYi9zc2xjb21tZXJ6XCI7XG5pbXBvcnQgeyBzZW5kQm9va2luZ0VtYWlsLCBzZW5kUmVmdW5kRW1haWwgfSBmcm9tIFwiLi4vLi4vdXRpbHMvZW1haWxcIjtcbmltcG9ydCB7IG5vdGlmeSB9IGZyb20gXCIuLi8uLi91dGlscy9ub3RpZmljYXRpb25cIjtcbmltcG9ydCB7XG4gIElCb29raW5nUXVlcnksXG4gIElCb29raW5nU2VhcmNoUXVlcnksXG4gIElDcmVhdGVCb29raW5nLFxuICBJUmVmdW5kT3V0Y29tZSxcbiAgSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59IGZyb20gXCIuL2Jvb2tpbmcuaW50ZXJmYWNlXCI7XG5cbi8vIEEgUEVORElORyBib29raW5nIG9sZGVyIHRoYW4gdGhpcyBpcyB0cmVhdGVkIGFzIGFuIGFiYW5kb25lZCBjaGVja291dDpcbi8vIGl0J3MgYXV0by1jYW5jZWxsZWQgc28gdGhlIHVzZXIgY2FuIHJlYm9vayB0aGUgc2FtZSBwYWNrYWdlK2RhdGUuXG5jb25zdCBTVEFMRV9CT09LSU5HX0hPVVJTID0gMjQ7XG5cbmNvbnN0IHRvVVRDTWlkbmlnaHQgPSAoZGF0ZTogRGF0ZSkgPT5cbiAgbmV3IERhdGUoXG4gICAgRGF0ZS5VVEMoZGF0ZS5nZXRVVENGdWxsWWVhcigpLCBkYXRlLmdldFVUQ01vbnRoKCksIGRhdGUuZ2V0VVRDRGF0ZSgpKSxcbiAgKTtcblxuLy8gXHUyNTAwXHUyNTAwIEFjdG9yICsgb3duZXJzaGlwIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxudHlwZSBCb29raW5nQWN0b3IgPSB7IGlkOiBzdHJpbmc7IHJvbGU6IFJvbGUgfTtcblxuLy8gU3RydWN0dXJhbCBzdWJzZXQgXHUyMDE0IG9ubHkgd2hhdCB0aGUgb3duZXJzaGlwIGNoZWNrcyBuZWVkLlxudHlwZSBCb29raW5nT3duZXJJbmZvID0ge1xuICB1c2VySWQ6IHN0cmluZztcbiAgcGFja2FnZTogeyBhZ2VudElkOiBzdHJpbmcgfTtcbn07XG5cbi8vIEJvb2tpbmcgb3duZXIsIHRoZSBBR0VOVCB3aG8gb3ducyB0aGUgcGFja2FnZSwgb3IgQURNSU4gXHUyMDE0IGZ1bGwgbWFuYWdlIHNjb3BlLlxuY29uc3QgY2FuTWFuYWdlID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGJvb2tpbmcudXNlcklkID09PSBhY3Rvci5pZCB8fFxuICAoYWN0b3Iucm9sZSA9PT0gUm9sZS5BR0VOVCAmJiBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWQpIHx8XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU47XG5cbi8vIE9ubHkgdGhlIHBhY2thZ2Utb3duaW5nIEFHRU5UIG9yIEFETUlOIGNhbiBtb3ZlIGEgYm9va2luZydzIG1vbmV5IHN0YXR1c1xuLy8gKFBFTkRJTkdcdTIxOTJDT05GSVJNRUQsIENPTkZJUk1FRFx1MjE5MkNPTVBMRVRFRCwgQ09ORklSTUVEXHUyMTkyUEVORElORykuXG5jb25zdCBpc0FnZW50T3duZXJPckFkbWluID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU4gfHxcbiAgKGFjdG9yLnJvbGUgPT09IFJvbGUuQUdFTlQgJiYgYm9va2luZy5wYWNrYWdlLmFnZW50SWQgPT09IGFjdG9yLmlkKTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXRlIG1hY2hpbmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG50eXBlIFRyYW5zaXRpb25SdWxlID0ge1xuICBhbGxvd2VkOiAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT4gYm9vbGVhbjtcbiAgcmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkPzogYm9vbGVhbjtcbiAgYmVmb3JlVHJhdmVsRGF0ZT86IGJvb2xlYW47XG59O1xuXG5jb25zdCBUUkFOU0lUSU9OUzogUGFydGlhbDxcbiAgUmVjb3JkPEJvb2tpbmdTdGF0dXMsIFBhcnRpYWw8UmVjb3JkPEJvb2tpbmdTdGF0dXMsIFRyYW5zaXRpb25SdWxlPj4+XG4+ID0ge1xuICBbQm9va2luZ1N0YXR1cy5QRU5ESU5HXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHsgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbiB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHsgYWxsb3dlZDogY2FuTWFuYWdlIH0sXG4gIH0sXG4gIFtCb29raW5nU3RhdHVzLlBBSURdOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXTogeyBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXTogeyBhbGxvd2VkOiBjYW5NYW5hZ2UgfSxcbiAgfSxcbiAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTVBMRVRFRF06IHtcbiAgICAgIGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4sXG4gICAgICByZXF1aXJlc1RyYXZlbERhdGVQYXNzZWQ6IHRydWUsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7IGFsbG93ZWQ6IGNhbk1hbmFnZSB9LFxuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluLFxuICAgICAgYmVmb3JlVHJhdmVsRGF0ZTogdHJ1ZSxcbiAgICB9LFxuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlc3BvbnNlIG1hcHBpbmcgKERlY2ltYWwgXHUyMTkyIE51bWJlcikgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBib29raW5nUGFja2FnZVNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdGl0bGU6IHRydWUsXG4gICAgc2x1ZzogdHJ1ZSxcbiAgICBsb2NhdGlvbjogdHJ1ZSxcbiAgICBpbWFnZXM6IHRydWUsXG4gICAgcHJpY2U6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG4vLyBEZXRhaWwgdmlldyBhZGRzIGFnZW50SWQgKG5lZWRlZCBieSBvd25lcnNoaXAgY2hlY2tzIGluIHRoZSBzZXJ2aWNlKS5cbmNvbnN0IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0aXRsZTogdHJ1ZSxcbiAgICBzbHVnOiB0cnVlLFxuICAgIGxvY2F0aW9uOiB0cnVlLFxuICAgIGltYWdlczogdHJ1ZSxcbiAgICBwcmljZTogdHJ1ZSxcbiAgICBhZ2VudElkOiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxuY29uc3QgYm9va2luZ1VzZXJTZWxlY3QgPSB7XG4gIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnQgbGVkZ2VyIHNob3duIG9uIHRoZSBib29raW5nIGRldGFpbCBwYWdlIChhbW91bnRzIHN0YXkgRGVjaW1hbCBpbiBEQikuXG5jb25zdCBib29raW5nUGF5bWVudFNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdHJhbklkOiB0cnVlLFxuICAgIGFtb3VudDogdHJ1ZSxcbiAgICBjdXJyZW5jeTogdHJ1ZSxcbiAgICBzdGF0dXM6IHRydWUsXG4gICAgY2FyZFR5cGU6IHRydWUsXG4gICAgYmFua1RyYW5JZDogdHJ1ZSxcbiAgICB2YWxJZDogdHJ1ZSxcbiAgICBwYWlkQXQ6IHRydWUsXG4gICAgcmVmdW5kUmVmSWQ6IHRydWUsXG4gICAgcmVmdW5kSW5pdGlhdGVkQXQ6IHRydWUsXG4gICAgcmVmdW5kQ29tcGxldGVkQXQ6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG4vLyBQYXltZW50cyBvcmRlcmVkIG5ld2VzdC1maXJzdCBzbyBjb25zdW1lcnMgY2FuIHJlbHkgb24gcGF5bWVudHNbMF0gYmVpbmcgdGhlXG4vLyBsYXRlc3QgYXR0ZW1wdCAodXNlZCBmb3IgdGhlIHVzZXIgcGF5bWVudC1oaXN0b3J5IFwibGF0ZXN0IHN0YXR1c1wiIHJvdykuXG5jb25zdCBib29raW5nUGF5bWVudHNJbmNsdWRlID0ge1xuICAuLi5ib29raW5nUGF5bWVudFNlbGVjdCxcbiAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIGFzIGNvbnN0IH0sXG59IGFzIGNvbnN0O1xuXG50eXBlIEJvb2tpbmdXaXRQYWNrYWdlID0gUHJpc21hLkJvb2tpbmdHZXRQYXlsb2FkPHtcbiAgaW5jbHVkZTogeyBwYWNrYWdlOiB0eXBlb2YgYm9va2luZ1BhY2thZ2VTZWxlY3QgfTtcbn0+O1xuXG4vLyBQYXltZW50cyBzaG93IG9uIGxpc3Qgcm93cyB0b28gKERvRDogXCJsaXN0L2RldGFpbCBub3cgaW5jbHVkZXMgcGF5bWVudHNcIiksXG4vLyBtYXBwZWQgdG8gTnVtYmVyIGF0IHRoZSBib3VuZGFyeSBsaWtlIHRoZSByZXN0IG9mIHRoZSBtb25leSBmaWVsZHMuXG50eXBlIEJvb2tpbmdQYXltZW50SXRlbSA9IHtcbiAgaWQ6IHN0cmluZztcbiAgdHJhbklkOiBzdHJpbmc7XG4gIGFtb3VudDogdW5rbm93bjtcbiAgY3VycmVuY3k6IHN0cmluZztcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGNhcmRUeXBlOiBzdHJpbmcgfCBudWxsO1xuICBiYW5rVHJhbklkOiBzdHJpbmcgfCBudWxsO1xuICB2YWxJZDogc3RyaW5nIHwgbnVsbDtcbiAgcGFpZEF0OiBEYXRlIHwgbnVsbDtcbn07XG5cbmNvbnN0IG1hcEJvb2tpbmdMaXN0ID0gKGJvb2tpbmc6IEJvb2tpbmdXaXRQYWNrYWdlICYgeyBwYXltZW50cz86IEJvb2tpbmdQYXltZW50SXRlbVtdIH0pID0+ICh7XG4gIC4uLmJvb2tpbmcsXG4gIHRvdGFsUHJpY2U6IE51bWJlcihib29raW5nLnRvdGFsUHJpY2UpLFxuICBwYWNrYWdlOiB7IC4uLmJvb2tpbmcucGFja2FnZSwgcHJpY2U6IE51bWJlcihib29raW5nLnBhY2thZ2UucHJpY2UpIH0sXG4gIHBheW1lbnRzOiBib29raW5nLnBheW1lbnRzPy5tYXAoKHApID0+ICh7IC4uLnAsIGFtb3VudDogTnVtYmVyKHAuYW1vdW50KSB9KSksXG59KTtcblxuLy8gXHUyNTAwXHUyNTAwIENyZWF0ZSBib29raW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY3JlYXRlQm9va2luZyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSUNyZWF0ZUJvb2tpbmcpID0+IHtcbiAgY29uc3QgeyBwYWNrYWdlSWQsIHRyYXZlbGVycyB9ID0gcGF5bG9hZDtcbiAgY29uc3QgdHJhdmVsRGF0ZSA9IHRvVVRDTWlkbmlnaHQocGF5bG9hZC50cmF2ZWxEYXRlKTtcblxuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gIH0pO1xuICBpZiAoXG4gICAgIXRvdXJQYWNrYWdlIHx8XG4gICAgdG91clBhY2thZ2UuaXNEZWxldGVkIHx8XG4gICAgdG91clBhY2thZ2Uuc3RhdHVzICE9PSBQYWNrYWdlU3RhdHVzLkFQUFJPVkVEXG4gICkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiUGFja2FnZSBpcyBub3QgYXZhaWxhYmxlIGZvciBib29raW5nLlwiKTtcbiAgfVxuXG4gIC8vIHRvdGFsUHJpY2UgaXMgY29tcHV0ZWQgc2VydmVyLXNpZGUgZnJvbSB0aGUgcGFja2FnZSdzIGN1cnJlbnQgcHJpY2UgXHUyMDE0XG4gIC8vIGFueXRoaW5nIHRoZSBjbGllbnQgc2VuZHMgaXMgaWdub3JlZC5cbiAgY29uc3QgdG90YWxQcmljZSA9IE51bWJlcih0b3VyUGFja2FnZS5wcmljZSkgKiB0cmF2ZWxlcnM7XG5cbiAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCB0eC5ib29raW5nLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHBhY2thZ2VJZCxcbiAgICAgICAgdHJhdmVsRGF0ZSxcbiAgICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBFTkRJTkcsXG4gICAgICB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgIGNvbnN0IGlzUmVjZW50ID1cbiAgICAgICAgZXhpc3RpbmcuY3JlYXRlZEF0LmdldFRpbWUoKSA+PVxuICAgICAgICBEYXRlLm5vdygpIC0gU1RBTEVfQk9PS0lOR19IT1VSUyAqIDYwICogNjAgKiAxMDAwO1xuXG4gICAgICBpZiAoaXNSZWNlbnQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICAgIDQwOSxcbiAgICAgICAgICBcIllvdSBhbHJlYWR5IGhhdmUgYSBwZW5kaW5nIGJvb2tpbmcgZm9yIHRoaXMgcGFja2FnZSBvbiB0aGlzIGRhdGUuXCIsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIC8vIGFiYW5kb25lZCBjaGVja291dCBcdTIwMTQgY2FuY2VsIGl0IGluIHRoZSBzYW1lIHRyYW5zYWN0aW9uIGFuZCByZWJvb2tcbiAgICAgIGF3YWl0IHR4LmJvb2tpbmcudXBkYXRlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQ6IGV4aXN0aW5nLmlkIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNBTkNFTExFRCB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHR4LmJvb2tpbmcuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHsgdXNlcklkLCBwYWNrYWdlSWQsIHRyYXZlbERhdGUsIHRyYXZlbGVycywgdG90YWxQcmljZSB9LFxuICAgIH0pO1xuICB9KTtcblxuICAvLyBiZXN0LWVmZm9ydCBlbWFpbCBcdTIwMTQgbmV2ZXIgZmFpbHMgdGhlIHJlcXVlc3RcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBzZWxlY3Q6IHsgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSxcbiAgfSk7XG4gIGlmICh1c2VyKSB7XG4gICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgc2VuZEJvb2tpbmdFbWFpbCh7XG4gICAgICAgIGVtYWlsOiB1c2VyLmVtYWlsLFxuICAgICAgICBuYW1lOiB1c2VyLm5hbWUsXG4gICAgICAgIHBhY2thZ2VUaXRsZTogdG91clBhY2thZ2UudGl0bGUsXG4gICAgICAgIHRyYXZlbERhdGUsXG4gICAgICAgIHRyYXZlbGVycyxcbiAgICAgICAgdG90YWxQcmljZSxcbiAgICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBFTkRJTkcsXG4gICAgICB9KSxcbiAgICBdKTtcbiAgfVxuXG4gIC8vIGJlc3QtZWZmb3J0IGluLWFwcCBub3RpZmljYXRpb24gdG8gdGhlIHBhY2thZ2UgYWdlbnQgKG5ldmVyIGZhaWxzIHJlcXVlc3QpXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBub3RpZnkoXG4gICAgICB0b3VyUGFja2FnZS5hZ2VudElkLFxuICAgICAgTm90aWZpY2F0aW9uVHlwZS5CT09LSU5HX0NSRUFURUQsXG4gICAgICBcIk5ldyBib29raW5nIHJlY2VpdmVkXCIsXG4gICAgICBgQSBuZXcgYm9va2luZyBoYXMgYmVlbiBwbGFjZWQgZm9yIFwiJHt0b3VyUGFja2FnZS50aXRsZX1cIi5gLFxuICAgICAgYC9kYXNoYm9hcmQvYWdlbnQvYm9va2luZ3MvJHtjcmVhdGVkLmlkfWAsXG4gICAgKSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICAuLi5jcmVhdGVkLFxuICAgIHRvdGFsUHJpY2U6IE51bWJlcihjcmVhdGVkLnRvdGFsUHJpY2UpLFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIExpc3QgaGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHBhZ2luYXRlQm9va2luZyA9IGFzeW5jIChcbiAgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCxcbiAgaW5jbHVkZTogUHJpc21hLkJvb2tpbmdJbmNsdWRlLFxuICBxdWVyeTogSUJvb2tpbmdRdWVyeSxcbikgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSB8fCAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0IHx8IDEwO1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlLFxuICAgICAgc2tpcDogKHBhZ2UgLSAxKSAqIGxpbWl0LFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBNeSBib29raW5ncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldE15Qm9va2luZ3MgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJQm9va2luZ1F1ZXJ5KSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7IHVzZXJJZCB9O1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHsgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFnZW50IGJvb2tpbmdzIChzY29wZWQgdG8gb3duIHBhY2thZ2VzKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldEFnZW50Qm9va2luZ3MgPSBhc3luYyAoXG4gIGFnZW50SWQ6IHN0cmluZyxcbiAgcXVlcnk6IElCb29raW5nU2VhcmNoUXVlcnksXG4pID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHtcbiAgICBwYWNrYWdlOiB7IGFnZW50SWQgfSxcbiAgfTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUucGFja2FnZSA9IHtcbiAgICAgIGFnZW50SWQsXG4gICAgICB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHsgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBhbGwgYm9va2luZ3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRBbGxCb29raW5ncyA9IGFzeW5jIChxdWVyeTogSUJvb2tpbmdTZWFyY2hRdWVyeSkgPT4ge1xuICBjb25zdCB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0ge307XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIHdoZXJlLnBhY2thZ2UgPSB7IHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH07XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAge1xuICAgICAgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICAgIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlLFxuICAgIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEJvb2tpbmcgZGV0YWlsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0Qm9va2luZ0RldGFpbCA9IGFzeW5jIChpZDogc3RyaW5nLCBhY3RvcjogQm9va2luZ0FjdG9yKSA9PiB7XG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIHBhY2thZ2U6IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0LFxuICAgICAgdXNlcjogYm9va2luZ1VzZXJTZWxlY3QsXG4gICAgICBwYXltZW50czogYm9va2luZ1BheW1lbnRzSW5jbHVkZSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuICBpZiAoIWNhbk1hbmFnZShib29raW5nLCBhY3RvcikpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gdmlldyB0aGlzIGJvb2tpbmcuXCIpO1xuICB9XG5cbiAgcmV0dXJuIG1hcEJvb2tpbmdMaXN0KGJvb2tpbmcpO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZnVuZCAoYm9va2luZyBjYW5jZWxsZWQgd2l0aCBzZXR0bGVkIG1vbmV5KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFJ1bnMgQUZURVIgdGhlIHN0YXR1cy10cmFuc2l0aW9uIHRyYW5zYWN0aW9uIGNvbW1pdHMsIHNvIGEgZ2F0ZXdheSBmYWlsdXJlIGNhblxuLy8gbmV2ZXIgcm9sbCBiYWNrIHRoZSBjYW5jZWxsYXRpb24gaXRzZWxmLiBFYWNoIHNldHRsZWQgcGF5bWVudCBpcyByZWZ1bmRlZCB2aWFcbi8vIHRoZSBTU0xDb21tZXJ6IFJlZnVuZCBBUEk7IHRoZSBsZWRnZXIgZmxpcHMgdG8gUkVGVU5ERUQgT05MWSBhZnRlciB0aGUgZ2F0ZXdheVxuLy8gY29uZmlybXMgXHUyMDE0IGEgZmFpbGVkIHJlZnVuZCBsZWF2ZXMgdGhlIHBheW1lbnQgU1VDQ0VTUyB3aXRoIHJlZnVuZEluaXRpYXRlZEF0XG4vLyBzZXQgc28gYSBsYXRlciByZXRyeS9tYW51YWwgYWN0aW9uIGNhbiBmaW5kIGl0IChzcGVjIDIzKS5cbnR5cGUgUmVmdW5kQ29udGV4dCA9IHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBwYWNrYWdlVGl0bGU6IHN0cmluZztcbiAgdHJhdmVsRGF0ZTogRGF0ZTtcbn07XG5cbmNvbnN0IGlzc3VlUmVmdW5kcyA9IGFzeW5jIChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIGN0eDogUmVmdW5kQ29udGV4dCxcbik6IFByb21pc2U8SVJlZnVuZE91dGNvbWUgfCBudWxsPiA9PiB7XG4gIGNvbnN0IHBheW1lbnRzID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZE1hbnkoe1xuICAgIHdoZXJlOiB7IGJvb2tpbmdJZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsIHJlZnVuZENvbXBsZXRlZEF0OiBudWxsIH0sXG4gIH0pO1xuICBpZiAocGF5bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICBsZXQgYWxsU3VjY2VlZGVkID0gdHJ1ZTtcbiAgbGV0IGZpcnN0RmFpbHVyZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGxldCByZWZ1bmRlZFRvdGFsID0gMDtcbiAgY29uc3QgcmVmdW5kUmVmczogc3RyaW5nW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IHBheW1lbnQgb2YgcGF5bWVudHMpIHtcbiAgICBpZiAoIXBheW1lbnQuYmFua1RyYW5JZCkge1xuICAgICAgYWxsU3VjY2VlZGVkID0gZmFsc2U7XG4gICAgICBmaXJzdEZhaWx1cmUgPz89IFwiUGF5bWVudCBoYXMgbm8gYmFuayB0cmFuc2FjdGlvbiBpZCB0byByZWZ1bmQgYWdhaW5zdC5cIjtcbiAgICAgIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MgfSxcbiAgICAgICAgZGF0YTogeyByZWZ1bmRJbml0aWF0ZWRBdDogbmV3IERhdGUoKSB9LFxuICAgICAgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgZ2F0ZXdheSA9IGF3YWl0IHNzbGNvbW1lcnpSZWZ1bmQoe1xuICAgICAgICBiYW5rX3RyYW5faWQ6IHBheW1lbnQuYmFua1RyYW5JZCxcbiAgICAgICAgcmVmdW5kX2Ftb3VudDogTnVtYmVyKHBheW1lbnQuYW1vdW50KSxcbiAgICAgICAgcmVmdW5kX3JlbWFya3M6IGBCb29raW5nICR7Ym9va2luZ0lkfSBjYW5jZWxsZWQgLSBUcmlwVmVyc2VgLFxuICAgICAgICByZWZlX2lkOiBib29raW5nSWQsXG4gICAgICB9KTtcblxuICAgICAgLy8gQ0FTOiBvbmx5IGEgc3RpbGwtU1VDQ0VTUyBwYXltZW50IGZsaXBzIHRvIFJFRlVOREVEIFx1MjAxNCBhIGNvbmN1cnJlbnRcbiAgICAgIC8vIHJlZnVuZCBsb3NlcyB0aGUgcmFjZSAoY291bnQgMCkgYW5kIGlzIGEgbm8tb3AuIE5ldmVyIGRvdWJsZS1yZWZ1bmRzLlxuICAgICAgY29uc3QgZmxpcHBlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MgfSxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5SRUZVTkRFRCxcbiAgICAgICAgICByZWZ1bmRSZWZJZDogZ2F0ZXdheS5yZWZ1bmRfcmVmX2lkID8/IHBheW1lbnQucmVmdW5kUmVmSWQgPz8gbnVsbCxcbiAgICAgICAgICByZWZ1bmRDb21wbGV0ZWRBdDogbmV3IERhdGUoKSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoZmxpcHBlZC5jb3VudCA9PT0gMCkgY29udGludWU7IC8vIGFscmVhZHkgcmVmdW5kZWQgYnkgYSBjb25jdXJyZW50IHBhdGhcbiAgICAgIHJlZnVuZGVkVG90YWwgKz0gTnVtYmVyKHBheW1lbnQuYW1vdW50KTtcbiAgICAgIGlmIChnYXRld2F5LnJlZnVuZF9yZWZfaWQpIHJlZnVuZFJlZnMucHVzaChnYXRld2F5LnJlZnVuZF9yZWZfaWQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBhbGxTdWNjZWVkZWQgPSBmYWxzZTtcbiAgICAgIGZpcnN0RmFpbHVyZSA/Pz1cbiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgLy8gbW9uZXkgaGFzbid0IGxlZnQgdGhlIGdhdGV3YXkgXHUyMDE0IGxlYXZlIHN0YXR1cyBTVUNDRVNTLCBtYXJrIGZvciByZXRyeVxuICAgICAgYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyB9LFxuICAgICAgICBkYXRhOiB7IHJlZnVuZEluaXRpYXRlZEF0OiBuZXcgRGF0ZSgpIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBpZiAocmVmdW5kUmVmcy5sZW5ndGggPiAwKSB7XG4gICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgc2VuZFJlZnVuZEVtYWlsKHtcbiAgICAgICAgZW1haWw6IGN0eC5lbWFpbCxcbiAgICAgICAgbmFtZTogY3R4Lm5hbWUsXG4gICAgICAgIHBhY2thZ2VUaXRsZTogY3R4LnBhY2thZ2VUaXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZTogY3R4LnRyYXZlbERhdGUsXG4gICAgICAgIGFtb3VudDogcmVmdW5kZWRUb3RhbCxcbiAgICAgICAgcmVmdW5kUmVmSWQ6IHJlZnVuZFJlZnNbMF0sXG4gICAgICB9KSxcbiAgICBdKTtcbiAgfVxuXG4gIHJldHVybiBhbGxTdWNjZWVkZWRcbiAgICA/IHsgc3RhdHVzOiBcIlNVQ0NFU1NcIiB9XG4gICAgOiB7IHN0YXR1czogXCJGQUlMRURcIiwgbWVzc2FnZTogZmlyc3RGYWlsdXJlID8/IFwiUmVmdW5kIGNvdWxkIG5vdCBiZSBwcm9jZXNzZWQuXCIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBTdGF0dXMgdHJhbnNpdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHVwZGF0ZUJvb2tpbmdTdGF0dXMgPSBhc3luYyAoXG4gIGlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVCb29raW5nU3RhdHVzLFxuICBhY3RvcjogQm9va2luZ0FjdG9yLFxuKSA9PiB7XG4gIGNvbnN0IHsgc3RhdHVzOiB0byB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBib29raW5nID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBwYWNrYWdlOiB7XG4gICAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgYWdlbnRJZDogdHJ1ZSwgdGl0bGU6IHRydWUgfSxcbiAgICAgIH0sXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGlmICghY2FuTWFuYWdlKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwZXJmb3JtIHRoaXMgYWN0aW9uLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHJ1bGUgPSBUUkFOU0lUSU9OU1tib29raW5nLnN0YXR1c10/Llt0b107XG4gIGlmICghcnVsZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIGBDYW5ub3QgdHJhbnNpdGlvbiBib29raW5nIGZyb20gJHtib29raW5nLnN0YXR1c30gdG8gJHt0b30uYCxcbiAgICApO1xuICB9XG4gIGlmICghcnVsZS5hbGxvd2VkKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwZXJmb3JtIHRoaXMgYWN0aW9uLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHRyYXZlbERheSA9IHRvVVRDTWlkbmlnaHQoYm9va2luZy50cmF2ZWxEYXRlKS5nZXRUaW1lKCk7XG4gIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gIGlmIChydWxlLnJlcXVpcmVzVHJhdmVsRGF0ZVBhc3NlZCAmJiB0cmF2ZWxEYXkgPiBub3cpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkJvb2tpbmcgY2FuIG9ubHkgYmUgY29tcGxldGVkIGFmdGVyIHRoZSB0cmF2ZWwgZGF0ZSBoYXMgcGFzc2VkLlwiLFxuICAgICk7XG4gIH1cbiAgaWYgKHJ1bGUuYmVmb3JlVHJhdmVsRGF0ZSAmJiB0cmF2ZWxEYXkgPD0gbm93KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJCb29raW5nIGNhbiBvbmx5IGJlIHJldmVydGVkIGJlZm9yZSB0aGUgdHJhdmVsIGRhdGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIC8vIGNvbXBhcmUtYW5kLXNldDogdGhlIHRyYW5zaXRpb24gYXBwbGllcyBvbmx5IGlmIHRoZSByZWNvcmRlZCBzdGF0dXMgc3RpbGxcbiAgLy8gbWF0Y2hlcyBcdTIwMTQgYSBjb25jdXJyZW50IGNoYW5nZSBtYWtlcyBjb3VudCAwIGFuZCB0aGUgcmVxdWVzdCBmYWlscyBzYWZlbHkuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHR4LmJvb2tpbmcudXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyBpZCwgc3RhdHVzOiBib29raW5nLnN0YXR1cyB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IHRvIH0sXG4gICAgfSk7XG4gICAgaWYgKHJlc3VsdC5jb3VudCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDksXG4gICAgICAgIFwiQm9va2luZyBzdGF0dXMgY2hhbmdlZCBjb25jdXJyZW50bHkuIFBsZWFzZSB0cnkgYWdhaW4uXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIENhbmNlbGxpbmcgYSBib29raW5nIGFiYW5kb25zIGFueSBub24tc2V0dGxlZCBzZXNzaW9ucyAobm8gbW9uZXkgd2FzXG4gICAgLy8gdGFrZW4pLiBTZXR0bGVkIChTVUNDRVNTKSBwYXltZW50cyBhcmUgTk9UIHRvdWNoZWQgaGVyZSBcdTIwMTQgdGhlIGdhdGV3YXlcbiAgICAvLyByZWZ1bmQgKyBSRUZVTkRFRCBmbGlwIGhhcHBlbiBhZnRlciB0aGlzIHRyYW5zYWN0aW9uIGNvbW1pdHMsIHNvIGEgZ2F0ZXdheVxuICAgIC8vIGZhaWx1cmUgY2FuIG5ldmVyIHJvbGwgYmFjayB0aGUgY2FuY2VsbGF0aW9uIGl0c2VsZiAoc3BlYyAyMykuXG4gICAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgICAgd2hlcmU6IHsgYm9va2luZ0lkOiBpZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB0eC5ib29raW5nLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICB9KTtcblxuICBpZiAoIXVwZGF0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIC8vIHN5bmNocm9ub3VzIGdhdGV3YXkgcmVmdW5kIGZvciBzZXR0bGVkIG1vbmV5IChib29raW5nIGFscmVhZHkgQ0FOQ0VMTEVEKS5cbiAgLy8gVGhlIG91dGNvbWUgaXMgc3VyZmFjZWQgdG8gdGhlIGFjdG9yOyBhIGdhdGV3YXkgaGljY3VwIG5ldmVyIGZhaWxzIHRoZVxuICAvLyBjYW5jZWxsYXRpb24gaXRzZWxmLlxuICBsZXQgcmVmdW5kOiBJUmVmdW5kT3V0Y29tZSB8IG51bGwgPSBudWxsO1xuICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgcmVmdW5kID0gYXdhaXQgaXNzdWVSZWZ1bmRzKGlkLCB7XG4gICAgICBlbWFpbDogYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgbmFtZTogYm9va2luZy51c2VyLm5hbWUsXG4gICAgICBwYWNrYWdlVGl0bGU6IGJvb2tpbmcucGFja2FnZS50aXRsZSxcbiAgICAgIHRyYXZlbERhdGU6IGJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIGJlc3QtZWZmb3J0IGVtYWlsIGZvciBtb25leS1zdGF0dXMgY2hhbmdlc1xuICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ09ORklSTUVEIHx8IHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgICBlbWFpbDogYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgICBuYW1lOiBib29raW5nLnVzZXIubmFtZSxcbiAgICAgICAgcGFja2FnZVRpdGxlOiBib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICAgIHRyYXZlbERhdGU6IGJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICAgICAgdHJhdmVsZXJzOiBib29raW5nLnRyYXZlbGVycyxcbiAgICAgICAgdG90YWxQcmljZTogTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSksXG4gICAgICAgIHN0YXR1czogdG8sXG4gICAgICB9KSxcbiAgICBdKTtcbiAgfVxuXG4gIC8vIGJlc3QtZWZmb3J0IGluLWFwcCBub3RpZmljYXRpb25zIChuZXZlciBmYWlscyByZXF1ZXN0KS4gUmVjaXBpZW50IG9mIGFcbiAgLy8gY2FuY2VsbGF0aW9uIGRlcGVuZHMgb24gdGhlIGFjdG9yOiB0aGUgY3VzdG9tZXIgY2FuY2VscyBcdTIxOTIgdGhlIGFnZW50IGhlYXJzO1xuICAvLyB0aGUgYWdlbnQgY2FuY2VscyBcdTIxOTIgdGhlIGN1c3RvbWVyIGhlYXJzOyBhbiBBRE1JTiBjYW5jZWxzIFx1MjE5MiBib3RoIGhlYXIsIHNpbmNlXG4gIC8vIHRoZSBhZG1pbiBhY3RzIG9uIGJlaGFsZiBvZiB0aGUgcGxhdGZvcm0sIG5vdCBlaXRoZXIgc2lkZS5cbiAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNPTkZJUk1FRCkge1xuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgIG5vdGlmeShcbiAgICAgICAgYm9va2luZy51c2VySWQsXG4gICAgICAgIE5vdGlmaWNhdGlvblR5cGUuQk9PS0lOR19DT05GSVJNRUQsXG4gICAgICAgIFwiQm9va2luZyBjb25maXJtZWRcIixcbiAgICAgICAgYFlvdXIgYm9va2luZyBmb3IgXCIke2Jvb2tpbmcucGFja2FnZS50aXRsZX1cIiBoYXMgYmVlbiBjb25maXJtZWQuYCxcbiAgICAgICAgYC9kYXNoYm9hcmQvYm9va2luZ3MvJHtpZH1gLFxuICAgICAgKSxcbiAgICBdKTtcbiAgfVxuXG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQpIHtcbiAgICBjb25zdCByZWNpcGllbnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGlmIChhY3Rvci5pZCA9PT0gYm9va2luZy51c2VySWQpIHtcbiAgICAgIHJlY2lwaWVudHMucHVzaChib29raW5nLnBhY2thZ2UuYWdlbnRJZCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGFjdG9yLnJvbGUgPT09IFJvbGUuQUdFTlQgJiZcbiAgICAgIGJvb2tpbmcucGFja2FnZS5hZ2VudElkID09PSBhY3Rvci5pZFxuICAgICkge1xuICAgICAgcmVjaXBpZW50cy5wdXNoKGJvb2tpbmcudXNlcklkKTtcbiAgICB9IGVsc2UgaWYgKGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU4pIHtcbiAgICAgIHJlY2lwaWVudHMucHVzaChib29raW5nLnVzZXJJZCwgYm9va2luZy5wYWNrYWdlLmFnZW50SWQpO1xuICAgIH1cblxuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgWy4uLm5ldyBTZXQocmVjaXBpZW50cyldLm1hcCgocmVjaXBpZW50SWQpID0+XG4gICAgICAgIG5vdGlmeShcbiAgICAgICAgICByZWNpcGllbnRJZCxcbiAgICAgICAgICBOb3RpZmljYXRpb25UeXBlLkJPT0tJTkdfQ0FOQ0VMTEVELFxuICAgICAgICAgIFwiQm9va2luZyBjYW5jZWxsZWRcIixcbiAgICAgICAgICBgVGhlIGJvb2tpbmcgZm9yIFwiJHtib29raW5nLnBhY2thZ2UudGl0bGV9XCIgaGFzIGJlZW4gY2FuY2VsbGVkLmAsXG4gICAgICAgICAgYC9kYXNoYm9hcmQvYm9va2luZ3MvJHtpZH1gLFxuICAgICAgICApLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAuLi51cGRhdGVkLFxuICAgIHRvdGFsUHJpY2U6IE51bWJlcih1cGRhdGVkLnRvdGFsUHJpY2UpLFxuICAgIC4uLihyZWZ1bmQgPyB7IHJlZnVuZCB9IDoge30pLFxuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdTZXJ2aWNlID0ge1xuICBjcmVhdGVCb29raW5nLFxuICBnZXRNeUJvb2tpbmdzLFxuICBnZXRBZ2VudEJvb2tpbmdzLFxuICBnZXRBbGxCb29raW5ncyxcbiAgZ2V0Qm9va2luZ0RldGFpbCxcbiAgdXBkYXRlQm9va2luZ1N0YXR1cyxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcblxuY29uc3QgY3JlYXRlU2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWNrYWdlSWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbiAgdHJhdmVsRGF0ZTogei5jb2VyY2UuZGF0ZSh7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiVHJhdmVsIGRhdGUgaXMgcmVxdWlyZWRcIixcbiAgICBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiVHJhdmVsIGRhdGUgbXVzdCBiZSBhIHZhbGlkIGRhdGVcIixcbiAgfSkucmVmaW5lKFxuICAgIChkYXRlKSA9PiB7XG4gICAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XG4gICAgICBjb25zdCB0cmF2ZWxEYXkgPSBuZXcgRGF0ZShcbiAgICAgICAgRGF0ZS5VVEMoXG4gICAgICAgICAgZGF0ZS5nZXRVVENGdWxsWWVhcigpLFxuICAgICAgICAgIGRhdGUuZ2V0VVRDTW9udGgoKSxcbiAgICAgICAgICBkYXRlLmdldFVUQ0RhdGUoKSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBjb25zdCB0b2RheVVUQyA9IG5ldyBEYXRlKFxuICAgICAgICBEYXRlLlVUQyhcbiAgICAgICAgICB0b2RheS5nZXRVVENGdWxsWWVhcigpLFxuICAgICAgICAgIHRvZGF5LmdldFVUQ01vbnRoKCksXG4gICAgICAgICAgdG9kYXkuZ2V0VVRDRGF0ZSgpLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIHJldHVybiB0cmF2ZWxEYXkuZ2V0VGltZSgpID49IHRvZGF5VVRDLmdldFRpbWUoKTtcbiAgICB9LFxuICAgIHsgbWVzc2FnZTogXCJUcmF2ZWwgZGF0ZSBjYW5ub3QgYmUgaW4gdGhlIHBhc3QuXCIgfSxcbiAgKSxcbiAgdHJhdmVsZXJzOiB6XG4gICAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIlRyYXZlbGVycyBpcyByZXF1aXJlZFwiIH0pXG4gICAgLmludChcIlRyYXZlbGVycyBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyXCIpXG4gICAgLm1pbigxLCBcIlRyYXZlbGVycyBtdXN0IGJlIGF0IGxlYXN0IDFcIilcbiAgICAubWF4KDIwLCBcIlRyYXZlbGVycyBtdXN0IGJlIGF0IG1vc3QgMjBcIiksXG59KTtcblxuY29uc3QgYm9va2luZ1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQm9va2luZyBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBib29raW5nUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIHN0YXR1czogei5uYXRpdmVFbnVtKEJvb2tpbmdTdGF0dXMpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hID0gYm9va2luZ1F1ZXJ5U2NoZW1hLmV4dGVuZCh7XG4gIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVTdGF0dXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHN0YXR1czogei5uYXRpdmVFbnVtKEJvb2tpbmdTdGF0dXMsIHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHN0YXR1c1wiLFxuICB9KSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUQ3JlYXRlQm9va2luZ1NjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNyZWF0ZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQm9va2luZ1F1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgYm9va2luZ1F1ZXJ5U2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRCb29raW5nU2VhcmNoUXVlcnlTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBib29raW5nU2VhcmNoUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFVwZGF0ZVN0YXR1c1NjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHVwZGF0ZVN0YXR1c1NjaGVtYT47XG5cbmV4cG9ydCBjb25zdCBib29raW5nVmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVNjaGVtYSxcbiAgYm9va2luZ1BhcmFtc1NjaGVtYSxcbiAgYm9va2luZ1F1ZXJ5U2NoZW1hLFxuICBib29raW5nU2VhcmNoUXVlcnlTY2hlbWEsXG4gIHVwZGF0ZVN0YXR1c1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyByZXZpZXdDb250cm9sbGVyIH0gZnJvbSBcIi4vcmV2aWV3LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHJldmlld1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vcmV2aWV3LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIENyZWF0ZSBhIHJldmlldyAoVVNFUiBvbmx5KVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHJldmlld1ZhbGlkYXRpb25zLmNyZWF0ZVJldmlld1NjaGVtYSB9KSxcbiAgcmV2aWV3Q29udHJvbGxlci5jcmVhdGVSZXZpZXcsXG4pO1xuXG4vLyAyLiBMaXN0IHJldmlld3MgZm9yIGEgcGFja2FnZSAocHVibGljKVxucm91dGVyLmdldChcbiAgXCIvcGFja2FnZS86cGFja2FnZUlkXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiByZXZpZXdWYWxpZGF0aW9ucy5yZXZpZXdQYXJhbXNTY2hlbWEsXG4gICAgcXVlcnk6IHJldmlld1ZhbGlkYXRpb25zLnJldmlld1F1ZXJ5U2NoZW1hLFxuICB9KSxcbiAgcmV2aWV3Q29udHJvbGxlci5nZXRQYWNrYWdlUmV2aWV3cyxcbik7XG5cbi8vIDMuIFVwZGF0ZSBhIHJldmlldyAoVVNFUiwgYXV0aG9yIG9ubHkpIFx1MjAxNCByZWdpc3RlcmVkIGFmdGVyIC9wYWNrYWdlLzpwYWNrYWdlSWRcbi8vICAgIHNvIHRoZSBsaXRlcmFsIGAvcGFja2FnZWAgc2VnbWVudCBpcyBuZXZlciBzd2FsbG93ZWQgYnkgYC86aWRgLlxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3SWRQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogcmV2aWV3VmFsaWRhdGlvbnMudXBkYXRlUmV2aWV3U2NoZW1hLFxuICB9KSxcbiAgcmV2aWV3Q29udHJvbGxlci51cGRhdGVSZXZpZXcsXG4pO1xuXG4vLyA0LiBEZWxldGUgYSByZXZpZXcgKGF1dGhvciBvciBBRE1JTilcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3SWRQYXJhbXNTY2hlbWEgfSksXG4gIHJldmlld0NvbnRyb2xsZXIuZGVsZXRlUmV2aWV3LFxuKTtcblxuZXhwb3J0IGNvbnN0IHJldmlld1JvdXRlcyA9IHJvdXRlcjtcbiIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgcmV2aWV3U2VydmljZSB9IGZyb20gXCIuL3Jldmlldy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IGNvbnRyb2xsZXIgKFVTRVIgb25seSlcbmNvbnN0IGNyZWF0ZVJldmlldyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJldmlld1NlcnZpY2UuY3JlYXRlUmV2aWV3KHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3IHN1Ym1pdHRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBMaXN0IHBhY2thZ2UgcmV2aWV3cyBjb250cm9sbGVyIChwdWJsaWMpXG5jb25zdCBnZXRQYWNrYWdlUmV2aWV3cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VJZCA9IFN0cmluZyhyZXEucGFyYW1zLnBhY2thZ2VJZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmV2aWV3U2VydmljZS5saXN0UGFja2FnZVJldmlld3MocGFja2FnZUlkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlJldmlld3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBVcGRhdGUgYSByZXZpZXcgY29udHJvbGxlciAoVVNFUiwgYXV0aG9yIG9ubHkpXG5jb25zdCB1cGRhdGVSZXZpZXcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXZpZXdTZXJ2aWNlLnVwZGF0ZVJldmlldyh1c2VySWQsIGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3IHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNC4gRGVsZXRlIGEgcmV2aWV3IGNvbnRyb2xsZXIgKGF1dGhvciBvciBBRE1JTilcbmNvbnN0IGRlbGV0ZVJldmlldyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJvbGUgPSByZXEudXNlciEucm9sZTtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXZpZXdTZXJ2aWNlLmRlbGV0ZVJldmlldyh1c2VySWQsIHJvbGUsIGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJSZXZpZXcgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlUmV2aWV3LFxuICBnZXRQYWNrYWdlUmV2aWV3cyxcbiAgdXBkYXRlUmV2aWV3LFxuICBkZWxldGVSZXZpZXcsXG59O1xuIiwgImltcG9ydCB7IFBhY2thZ2VTdGF0dXMsIEJvb2tpbmdTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVSZXZpZXdQYXlsb2FkLFxuICBJUmV2aWV3UXVlcnksXG4gIElVcGRhdGVSZXZpZXdQYXlsb2FkLFxufSBmcm9tIFwiLi9yZXZpZXcuaW50ZXJmYWNlXCI7XG5cbi8vIFNoYXJlZCByYXRpbmcgcmVjb21wdXRlIFx1MjAxNCB0aGUgc2luZ2xlIHNvdXJjZSBvZiB0cnV0aCBmb3IgdGhlIHBhY2thZ2Vcbi8vIGF2ZXJhZ2UuIGNyZWF0ZS91cGRhdGUvZGVsZXRlIGFsbCBjYWxsIGl0IGluc2lkZSB0aGVpciBvd24gdHJhbnNhY3Rpb24sIGFuZFxuLy8gdGhlIGFnZ3JlZ2F0ZSBhbHdheXMgZmlsdGVycyBgaXNEZWxldGVkOiBmYWxzZWAgc28gYSByZW1vdmVkIHJhdGluZyBuZXZlclxuLy8gY291bnRzIChvdGhlcndpc2UgZGVsZXRlIHdvdWxkIHJlY29tcHV0ZSBhbiB1bmNoYW5nZWQgYXZlcmFnZSkuXG5jb25zdCByZWNvbXB1dGVQYWNrYWdlUmF0aW5nID0gYXN5bmMgKFxuICB0eDogUHJpc21hLlRyYW5zYWN0aW9uQ2xpZW50LFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbik6IFByb21pc2U8bnVtYmVyPiA9PiB7XG4gIGNvbnN0IHsgX2F2ZyB9ID0gYXdhaXQgdHgucmV2aWV3LmFnZ3JlZ2F0ZSh7XG4gICAgd2hlcmU6IHsgcGFja2FnZUlkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgX2F2ZzogeyByYXRpbmc6IHRydWUgfSxcbiAgfSk7XG5cbiAgY29uc3QgcmF0aW5nID0gTWF0aC5yb3VuZCgoX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMDtcblxuICBhd2FpdCB0eC50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhOiB7IHJhdGluZyB9LFxuICB9KTtcblxuICByZXR1cm4gcmF0aW5nO1xufTtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IChVU0VSIG9ubHkpIFx1MjAxNCBnYXRlZCwgdW5pcXVlIHBlciB1c2VyK3BhY2thZ2UsIGFuZFxuLy8gICAgcmVjYWxjdWxhdGVzIHRoZSBwYWNrYWdlIHJhdGluZyBpbiB0aGUgc2FtZSB0cmFuc2FjdGlvbi5cbmNvbnN0IGNyZWF0ZVJldmlldyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSUNyZWF0ZVJldmlld1BheWxvYWQpID0+IHtcbiAgcmV0dXJuIHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgLy8gUGFja2FnZSBtdXN0IGV4aXN0LCBiZSBhcHByb3ZlZCwgYW5kIG5vdCBiZSBkZWxldGVkIFx1MjAxNCBhIHJldmlldyBvZiBhXG4gICAgLy8gcGVuZGluZy9yZWplY3RlZC9kZWxldGVkIHBhY2thZ2UgaXMgbm9uc2Vuc2UuXG4gICAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCB0eC50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgaWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBhZ2VudElkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICAvLyBObyBzZWxmLXJldmlldyBcdTIwMTQgYW4gYWdlbnQgcmF0aW5nIHRoZWlyIG93biBwYWNrYWdlIGlzIGEgY29uZmxpY3Qgb2YgaW50ZXJlc3QuXG4gICAgaWYgKHRvdXJQYWNrYWdlLmFnZW50SWQgPT09IHVzZXJJZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2Fubm90IHJldmlldyB5b3VyIG93biBwYWNrYWdlLlwiKTtcbiAgICB9XG5cbiAgICAvLyBPbmx5IGN1c3RvbWVycyB3aXRoIGEgY29tcGxldGVkIGJvb2tpbmcgbWF5IHJldmlldy5cbiAgICBjb25zdCBjb21wbGV0ZWRCb29raW5nID0gYXdhaXQgdHguYm9va2luZy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVELFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFjb21wbGV0ZWRCb29raW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJZb3UgY2FuIG9ubHkgcmV2aWV3IGEgcGFja2FnZSBhZnRlciBjb21wbGV0aW5nIGEgYm9va2luZy5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gRnJpZW5kbHkgZHVwbGljYXRlIGNoZWNrIFx1MjAxNCBAQHVuaXF1ZShbdXNlcklkLCBwYWNrYWdlSWRdKSBiYWNrc3RvcHMgYW55XG4gICAgLy8gcmFjZSB2aWEgUDIwMDIgKG1hcHBlZCB0byA0MDkgYnkgdGhlIGdsb2JhbCBoYW5kbGVyKS4gRGVsaWJlcmF0ZWx5IE5PVFxuICAgIC8vIGZpbHRlcmVkIGJ5IGlzRGVsZXRlZDogc29mdCBkZWxldGUga2VlcHMgdGhlIHJvdywgc28gcmUtcmV2aWV3aW5nIGFmdGVyXG4gICAgLy8gYSBkZWxldGUgc3RpbGwgZmFpbHMgd2l0aCB0aGlzIGZyaWVuZGx5IDQwOS5cbiAgICBjb25zdCBleGlzdGluZ1JldmlldyA9IGF3YWl0IHR4LnJldmlldy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHsgdXNlcklkLCBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZ1Jldmlldykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJZb3UgaGF2ZSBhbHJlYWR5IHJldmlld2VkIHRoaXMgcGFja2FnZS5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgY3JlYXRlZFJldmlldyA9IGF3YWl0IHR4LnJldmlldy5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICAgIHJhdGluZzogcGF5bG9hZC5yYXRpbmcsXG4gICAgICAgIGNvbW1lbnQ6IHBheWxvYWQuY29tbWVudCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByYXRpbmcgPSBhd2FpdCByZWNvbXB1dGVQYWNrYWdlUmF0aW5nKHR4LCBwYXlsb2FkLnBhY2thZ2VJZCk7XG5cbiAgICByZXR1cm4geyByZXZpZXc6IGNyZWF0ZWRSZXZpZXcsIHJhdGluZyB9O1xuICB9KTtcbn07XG5cbi8vIDIuIExpc3QgcmV2aWV3cyBmb3IgYSBwYWNrYWdlIChwdWJsaWMpIFx1MjAxNCBwYWdpbmF0ZWQ7IHRoZSBwYWNrYWdlIG11c3QgYmVcbi8vICAgIGFwcHJvdmVkIGFuZCBub3QgZGVsZXRlZCBzbyB1bnB1Ymxpc2hlZCBwYWNrYWdlIHJldmlld3MgbmV2ZXIgbGVhay5cbi8vICAgIERlbGV0ZWQgcmV2aWV3cyBhcmUgZXhjbHVkZWQgc28gYSByZW1vdmVkIHJhdGluZyBzdG9wcyBjb3VudGluZy5cbmNvbnN0IGxpc3RQYWNrYWdlUmV2aWV3cyA9IGFzeW5jIChcbiAgcGFja2FnZUlkOiBzdHJpbmcsXG4gIHF1ZXJ5OiBJUmV2aWV3UXVlcnksXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZEZpcnN0KHtcbiAgICB3aGVyZToge1xuICAgICAgaWQ6IHBhY2thZ2VJZCxcbiAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZSA9IHsgcGFja2FnZUlkLCBpc0RlbGV0ZWQ6IGZhbHNlIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEucmV2aWV3LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgc2VsZWN0OiB7XG4gICAgICAgIGlkOiB0cnVlLFxuICAgICAgICByYXRpbmc6IHRydWUsXG4gICAgICAgIGNvbW1lbnQ6IHRydWUsXG4gICAgICAgIGNyZWF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgdXBkYXRlZEF0OiB0cnVlLFxuICAgICAgICB1c2VyOiB7IHNlbGVjdDogeyBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5yZXZpZXcuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG4vLyAzLiBVcGRhdGUgYSByZXZpZXcgKFVTRVIsIGF1dGhvciBvbmx5KS4gQSBmb3JlaWduIGlkIG9yIGEgcmVtb3ZlZCByZXZpZXcgaXNcbi8vICAgIGEgdW5pZm9ybSA0MDQgXHUyMDE0IG5ldmVyIGEgbGVhay4gVGhlIHBhY2thZ2UgYXZlcmFnZSBpcyByZWNvbXB1dGVkIGluIHRoZVxuLy8gICAgc2FtZSB0cmFuc2FjdGlvbi5cbmNvbnN0IHVwZGF0ZVJldmlldyA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHJldmlld0lkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVSZXZpZXdQYXlsb2FkLFxuKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgdHgucmV2aWV3LmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZTogeyBpZDogcmV2aWV3SWQsIHVzZXJJZCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBwYWNrYWdlSWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUmV2aWV3IG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHR4LnJldmlldy51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJldmlld0lkIH0sXG4gICAgICBkYXRhOiB7XG4gICAgICAgIC4uLihwYXlsb2FkLnJhdGluZyAhPT0gdW5kZWZpbmVkID8geyByYXRpbmc6IHBheWxvYWQucmF0aW5nIH0gOiB7fSksXG4gICAgICAgIC4uLihwYXlsb2FkLmNvbW1lbnQgIT09IHVuZGVmaW5lZCA/IHsgY29tbWVudDogcGF5bG9hZC5jb21tZW50IH0gOiB7fSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgYXdhaXQgcmVjb21wdXRlUGFja2FnZVJhdGluZyh0eCwgZXhpc3RpbmcucGFja2FnZUlkKTtcblxuICAgIC8vIFRoZSByZXNwb25zZSdzIHJhdGluZyBpcyB0aGUgYXV0aG9yaXRhdGl2ZSB2YWx1ZSBmcm9tIHRoZSBwYWNrYWdlIHJvdyxcbiAgICAvLyBub3QgdGhlIGlucHV0IFx1MjAxNCB0aGUgY2xpZW50J3MgZGlzcGxheWVkIGF2ZXJhZ2UgaXMgbmV2ZXIgc3RhbGUuXG4gICAgY29uc3QgZnJlc2ggPSBhd2FpdCB0eC50b3VyUGFja2FnZS5maW5kVW5pcXVlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBleGlzdGluZy5wYWNrYWdlSWQgfSxcbiAgICAgIHNlbGVjdDogeyByYXRpbmc6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB7IHJldmlldzogdXBkYXRlZCwgcmF0aW5nOiBmcmVzaD8ucmF0aW5nID8/IDAgfTtcbiAgfSk7XG59O1xuXG4vLyA0LiBTb2Z0IGRlbGV0ZSBhIHJldmlldyAoYXV0aG9yIG9yIEFETUlOKSBcdTIwMTQgdGhlIGF2ZXJhZ2UgaXMgcmVjb21wdXRlZCBzbyB0aGVcbi8vICAgIHJlbW92ZWQgcmF0aW5nIHN0b3BzIGNvdW50aW5nLiBGb3JlaWduIGlkIC8gcmVwZWF0IGRlbGV0ZSBcdTIxOTIgdW5pZm9ybSA0MDQuXG5jb25zdCBkZWxldGVSZXZpZXcgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICByb2xlOiBSb2xlLFxuICByZXZpZXdJZDogc3RyaW5nLFxuKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgdHgucmV2aWV3LmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZTogeyBpZDogcmV2aWV3SWQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgcGFja2FnZUlkOiB0cnVlLCB1c2VySWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUmV2aWV3IG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgaWYgKHJvbGUgIT09IFJvbGUuQURNSU4gJiYgZXhpc3RpbmcudXNlcklkICE9PSB1c2VySWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUmV2aWV3IG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgcmVtb3ZlZCA9IGF3YWl0IHR4LnJldmlldy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiByZXZpZXdJZCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmIChyZW1vdmVkLmNvdW50ID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlJldmlldyBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IHJhdGluZyA9IGF3YWl0IHJlY29tcHV0ZVBhY2thZ2VSYXRpbmcodHgsIGV4aXN0aW5nLnBhY2thZ2VJZCk7XG5cbiAgICByZXR1cm4geyByZXZpZXdJZCwgcmF0aW5nIH07XG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IHJldmlld1NlcnZpY2UgPSB7XG4gIGNyZWF0ZVJldmlldyxcbiAgbGlzdFBhY2thZ2VSZXZpZXdzLFxuICB1cGRhdGVSZXZpZXcsXG4gIGRlbGV0ZVJldmlldyxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVJldmlld1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFja2FnZUlkOiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbiAgICByYXRpbmc6IHpcbiAgICAgIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJSYXRpbmcgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLmludChcIlJhdGluZyBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyXCIpXG4gICAgICAubWluKDEsIFwiUmF0aW5nIG11c3QgYmUgYXQgbGVhc3QgMVwiKVxuICAgICAgLm1heCg1LCBcIlJhdGluZyBtdXN0IGJlIGF0IG1vc3QgNVwiKSxcbiAgICBjb21tZW50OiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ29tbWVudCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAudHJpbSgpXG4gICAgICAubWluKDEsIFwiQ29tbWVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAgICAgLm1heCgxMDAwLCBcIkNvbW1lbnQgbXVzdCBiZSBhdCBtb3N0IDEwMDAgY2hhcmFjdGVyc1wiKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCByZXZpZXdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5jb25zdCByZXZpZXdRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVSZXZpZXdTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHJhdGluZzogelxuICAgICAgLm51bWJlcih7IGludmFsaWRfdHlwZV9lcnJvcjogXCJSYXRpbmcgbXVzdCBiZSBhIG51bWJlclwiIH0pXG4gICAgICAuaW50KFwiUmF0aW5nIG11c3QgYmUgYSB3aG9sZSBudW1iZXJcIilcbiAgICAgIC5taW4oMSwgXCJSYXRpbmcgbXVzdCBiZSBhdCBsZWFzdCAxXCIpXG4gICAgICAubWF4KDUsIFwiUmF0aW5nIG11c3QgYmUgYXQgbW9zdCA1XCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgICBjb21tZW50OiB6XG4gICAgICAuc3RyaW5nKHsgaW52YWxpZF90eXBlX2Vycm9yOiBcIkNvbW1lbnQgbXVzdCBiZSBhIHN0cmluZ1wiIH0pXG4gICAgICAudHJpbSgpXG4gICAgICAubWluKDEsIFwiQ29tbWVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAgICAgLm1heCgxMDAwLCBcIkNvbW1lbnQgbXVzdCBiZSBhdCBtb3N0IDEwMDAgY2hhcmFjdGVyc1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiBkYXRhLnJhdGluZyAhPT0gdW5kZWZpbmVkIHx8IGRhdGEuY29tbWVudCAhPT0gdW5kZWZpbmVkLCB7XG4gICAgbWVzc2FnZTogXCJBdCBsZWFzdCBvbmUgb2YgcmF0aW5nIG9yIGNvbW1lbnQgbXVzdCBiZSBwcm92aWRlZFwiLFxuICB9KTtcblxuY29uc3QgcmV2aWV3SWRQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlJldmlldyBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbigxLCBcIlJldmlldyBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVJldmlld1NjaGVtYSxcbiAgcmV2aWV3UGFyYW1zU2NoZW1hLFxuICByZXZpZXdRdWVyeVNjaGVtYSxcbiAgdXBkYXRlUmV2aWV3U2NoZW1hLFxuICByZXZpZXdJZFBhcmFtc1NjaGVtYSxcbn07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGNhdGVnb3J5Q29udHJvbGxlciB9IGZyb20gXCIuL2NhdGVnb3J5LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGNhdGVnb3J5VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9jYXRlZ29yeS52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBMaXN0IGFsbCBjYXRlZ29yaWVzIChwdWJsaWMsIG5vIGF1dGgpXG5yb3V0ZXIuZ2V0KFwiL1wiLCBjYXRlZ29yeUNvbnRyb2xsZXIuZ2V0QWxsQ2F0ZWdvcmllcyk7XG5cbi8vIDIuIENyZWF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY3JlYXRlQ2F0ZWdvcnlTY2hlbWEgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci5jcmVhdGVDYXRlZ29yeSxcbik7XG5cbi8vIDMuIFVwZGF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogY2F0ZWdvcnlWYWxpZGF0aW9ucy5jYXRlZ29yeVBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBjYXRlZ29yeVZhbGlkYXRpb25zLnVwZGF0ZUNhdGVnb3J5U2NoZW1hLFxuICB9KSxcbiAgY2F0ZWdvcnlDb250cm9sbGVyLnVwZGF0ZUNhdGVnb3J5LFxuKTtcblxuLy8gNC4gRGVsZXRlIGNhdGVnb3J5IChhZG1pbilcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY2F0ZWdvcnlQYXJhbXNTY2hlbWEgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci5kZWxldGVDYXRlZ29yeSxcbik7XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeVJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGNhdGVnb3J5U2VydmljZSB9IGZyb20gXCIuL2NhdGVnb3J5LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyBDcmVhdGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCBjcmVhdGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmNyZWF0ZUNhdGVnb3J5KHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcnksXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgYWxsIGNhdGVnb3JpZXMgY29udHJvbGxlciAocHVibGljKVxuY29uc3QgZ2V0QWxsQ2F0ZWdvcmllcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBhd2FpdCBjYXRlZ29yeVNlcnZpY2UuZ2V0QWxsQ2F0ZWdvcmllcygpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBjYXRlZ29yaWVzIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcmllcyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSBjYXRlZ29yeSBjb250cm9sbGVyIChhZG1pbilcbmNvbnN0IHVwZGF0ZUNhdGVnb3J5ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBjb25zdCBjYXRlZ29yeSA9IGF3YWl0IGNhdGVnb3J5U2VydmljZS51cGRhdGVDYXRlZ29yeShpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcnksXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBEZWxldGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCBkZWxldGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmRlbGV0ZUNhdGVnb3J5KGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDYXRlZ29yeSBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlDb250cm9sbGVyID0ge1xuICBjcmVhdGVDYXRlZ29yeSxcbiAgZ2V0QWxsQ2F0ZWdvcmllcyxcbiAgdXBkYXRlQ2F0ZWdvcnksXG4gIGRlbGV0ZUNhdGVnb3J5LFxufTsiLCAiLy8gQmFuZ2xhIChCZW5nYWxpKSBcdTIxOTIgTGF0aW4gY29uc29uYW50L3Zvd2VsIG1hcCwgYXBwbGllZCBiZWZvcmUga2ViYWItY2FzaW5nIHNvXG4vLyBCYW5nbGEtaGVhdnkgdGl0bGVzIHN0aWxsIHByb2R1Y2UgcmVhZGFibGUgc2x1Z3MgaW5zdGVhZCBvZiBiZWluZyBzdHJpcHBlZCB0b1xuLy8gYW4gZW1wdHkgc3RyaW5nLlxuY29uc3QgQkFOR0xBX1RPX0xBVElOOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBcdTA5ODU6IFwib1wiLFxuICBcdTA5ODY6IFwiYVwiLFxuICBcdTA5ODc6IFwiaVwiLFxuICBcdTA5ODg6IFwiaVwiLFxuICBcdTA5ODk6IFwidVwiLFxuICBcdTA5OEE6IFwidVwiLFxuICBcdTA5OEI6IFwicmlcIixcbiAgXHUwOThGOiBcImVcIixcbiAgXHUwOTkwOiBcIm9pXCIsXG4gIFx1MDk5MzogXCJvXCIsXG4gIFx1MDk5NDogXCJvdVwiLFxuICBcdTA5OTU6IFwia2FcIixcbiAgXHUwOTk2OiBcImtoYVwiLFxuICBcdTA5OTc6IFwiZ2FcIixcbiAgXHUwOTk4OiBcImdoYVwiLFxuICBcdTA5OTk6IFwibmdhXCIsXG4gIFx1MDk5QTogXCJjaGFcIixcbiAgXHUwOTlCOiBcImNoaGFcIixcbiAgXHUwOTlDOiBcImphXCIsXG4gIFx1MDk5RDogXCJqaGFcIixcbiAgXHUwOTlFOiBcIm55YVwiLFxuICBcdTA5OUY6IFwidGFcIixcbiAgXHUwOUEwOiBcInRoYVwiLFxuICBcdTA5QTE6IFwiZGFcIixcbiAgXHUwOUEyOiBcImRoYVwiLFxuICBcdTA5QTM6IFwibmFcIixcbiAgXHUwOUE0OiBcInRhXCIsXG4gIFx1MDlBNTogXCJ0aGFcIixcbiAgXHUwOUE2OiBcImRhXCIsXG4gIFx1MDlBNzogXCJkaGFcIixcbiAgXHUwOUE4OiBcIm5hXCIsXG4gIFx1MDlBQTogXCJwYVwiLFxuICBcdTA5QUI6IFwicGhhXCIsXG4gIFx1MDlBQzogXCJiYVwiLFxuICBcdTA5QUQ6IFwiYmhhXCIsXG4gIFx1MDlBRTogXCJtYVwiLFxuICBcdTA5QUY6IFwieWFcIixcbiAgXHUwOUIwOiBcInJhXCIsXG4gIFx1MDlCMjogXCJsYVwiLFxuICBcdTA5QjY6IFwic2hhXCIsXG4gIFx1MDlCNzogXCJzaGFcIixcbiAgXHUwOUI4OiBcInNhXCIsXG4gIFx1MDlCOTogXCJoYVwiLFxuICBcdTA5QTFcdTA5QkM6IFwicmFcIixcbiAgXHUwOUEyXHUwOUJDOiBcInJoYVwiLFxuICBcdTA5QUZcdTA5QkM6IFwieWFcIixcbiAgXCJcdTA5ODJcIjogXCJuZ1wiLFxuICBcIlx1MDk4M1wiOiBcImhcIixcbiAgXCJcdTA5ODFcIjogXCJcIixcbiAgXCJcdTA5Q0RcIjogXCJcIixcbiAgXCJcdTA5QzdcIjogXCJlXCIsXG4gIFwiXHUwOUM4XCI6IFwib2lcIixcbiAgXCJcdTA5Q0JcIjogXCJvXCIsXG4gIFwiXHUwOUNDXCI6IFwib3VcIixcbiAgXCJcdTA5QkVcIjogXCJhXCIsXG4gIFwiXHUwOUJGXCI6IFwiaVwiLFxuICBcIlx1MDlDMFwiOiBcImlcIixcbiAgXCJcdTA5QzFcIjogXCJ1XCIsXG4gIFwiXHUwOUMyXCI6IFwidVwiLFxuICBcIlx1MDlDM1wiOiBcInJpXCIsXG59O1xuXG5jb25zdCB0cmFuc2xpdGVyYXRlID0gKHRleHQ6IHN0cmluZyk6IHN0cmluZyA9PlxuICBbLi4udGV4dF0ubWFwKChjaGFyKSA9PiBCQU5HTEFfVE9fTEFUSU5bY2hhcl0gPz8gY2hhcikuam9pbihcIlwiKTtcblxuLy8gU2hhcmVkIGtlYmFiLWNhc2Ugc2x1Z2lmaWVyIHVzZWQgYnkgQ2F0ZWdvcnkgYW5kIFRvdXJQYWNrYWdlIHNsdWdzLiBOb24tTGF0aW5cbi8vIHNjcmlwdHMgKGUuZy4gQmFuZ2xhKSBhcmUgdHJhbnNsaXRlcmF0ZWQgZmlyc3Q7IGlmIHRoZSByZXN1bHQgaXMgc3RpbGwgZW1wdHlcbi8vIHRoZSBjYWxsZXIgbWF5IHN1cHBseSBhIGBmYWxsYmFja2AgKGUuZy4gXCJwYWNrYWdlLTxzaG9ydElkPlwiKS5cbmV4cG9ydCBjb25zdCBzbHVnaWZ5ID0gKHRleHQ6IHN0cmluZywgZmFsbGJhY2s/OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICBjb25zdCBzbHVnID0gdHJhbnNsaXRlcmF0ZSh0ZXh0KVxuICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgLnRyaW0oKVxuICAgIC5yZXBsYWNlKC9bXlxcd1xccy1dL2csIFwiXCIpXG4gICAgLnJlcGxhY2UoL1tcXHNfLV0rL2csIFwiLVwiKVxuICAgIC5yZXBsYWNlKC9eLSt8LSskL2csIFwiXCIpO1xuXG4gIHJldHVybiBzbHVnIHx8IGZhbGxiYWNrIHx8IFwiXCI7XG59OyIsICJpbXBvcnQgeyBQYWNrYWdlU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2x1Z2lmeSB9IGZyb20gXCIuLi8uLi91dGlscy9zbHVnaWZ5XCI7XG5pbXBvcnQgeyBJQ3JlYXRlQ2F0ZWdvcnksIElVcGRhdGVDYXRlZ29yeSB9IGZyb20gXCIuL2NhdGVnb3J5LmludGVyZmFjZVwiO1xuXG4vLyBGcmllbmRseSA0MDkgZm9yIEB1bmlxdWUgY29uZmxpY3RzIChuYW1lIG9yIHNsdWcpIGluc3RlYWQgb2YgYSByYXcgUDIwMDIuXG4vLyBleGNsdWRlSWQgbGV0cyB1cGRhdGVzIHNraXAgdGhlIHZlcnkgcm93IGJlaW5nIGVkaXRlZCBzbyBhIG5vLW9wIHJlbmFtZVxuLy8gZG9lc24ndCBmYWxzZS00MDkgYWdhaW5zdCBpdHNlbGYuXG5jb25zdCBhc3NlcnROYW1lQXZhaWxhYmxlID0gYXN5bmMgKFxuICBuYW1lOiBzdHJpbmcsXG4gIHNsdWc6IHN0cmluZyxcbiAgZXhjbHVkZUlkPzogc3RyaW5nLFxuKSA9PiB7XG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIE9SOiBbeyBuYW1lIH0sIHsgc2x1ZyB9XSxcbiAgICAgIC4uLihleGNsdWRlSWQgPyB7IE5PVDogeyBpZDogZXhjbHVkZUlkIH0gfSA6IHt9KSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoZXhpc3RpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIkEgY2F0ZWdvcnkgd2l0aCB0aGlzIG5hbWUgYWxyZWFkeSBleGlzdHNcIik7XG4gIH1cbn07XG5cbi8vIENyZWF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5jb25zdCBjcmVhdGVDYXRlZ29yeSA9IGFzeW5jIChwYXlsb2FkOiBJQ3JlYXRlQ2F0ZWdvcnkpID0+IHtcbiAgY29uc3QgeyBuYW1lIH0gPSBwYXlsb2FkO1xuICBjb25zdCBzbHVnID0gc2x1Z2lmeShuYW1lKTtcblxuICBhd2FpdCBhc3NlcnROYW1lQXZhaWxhYmxlKG5hbWUsIHNsdWcpO1xuXG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkuY3JlYXRlKHtcbiAgICBkYXRhOiB7IG5hbWUsIHNsdWcgfSxcbiAgfSk7XG59O1xuXG4vLyBHZXQgYWxsIGNhdGVnb3JpZXMgKHB1YmxpYykgd2l0aCBjb3VudHMgb2YgYXBwcm92ZWQsIG5vbi1kZWxldGVkIHBhY2thZ2VzXG5jb25zdCBnZXRBbGxDYXRlZ29yaWVzID0gYXN5bmMgKCkgPT4ge1xuICByZXR1cm4gcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KHtcbiAgICBvcmRlckJ5OiB7IG5hbWU6IFwiYXNjXCIgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBfY291bnQ6IHtcbiAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgcGFja2FnZXM6IHtcbiAgICAgICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgICAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG59O1xuXG4vLyBVcGRhdGUgY2F0ZWdvcnkgbmFtZSAocmVnZW5lcmF0ZXMgc2x1ZykgKGFkbWluKVxuY29uc3QgdXBkYXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nLCBwYXlsb2FkOiBJVXBkYXRlQ2F0ZWdvcnkpID0+IHtcbiAgY29uc3QgeyBuYW1lIH0gPSBwYXlsb2FkO1xuICBjb25zdCBzbHVnID0gc2x1Z2lmeShuYW1lKTtcblxuICBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9IH0pO1xuICBhd2FpdCBhc3NlcnROYW1lQXZhaWxhYmxlKG5hbWUsIHNsdWcsIGNhdGVnb3J5SWQpO1xuXG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9LFxuICAgIGRhdGE6IHsgbmFtZSwgc2x1ZyB9LFxuICB9KTtcbn07XG5cbi8vIERlbGV0ZSBjYXRlZ29yeSAoYWRtaW4pIFx1MjAxNCA0MDkgd2hlbiBhbnkgcGFja2FnZSByZWZlcmVuY2VzIGl0XG5jb25zdCBkZWxldGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93KHsgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSB9KTtcblxuICBjb25zdCBwYWNrYWdlQ291bnQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuY291bnQoe1xuICAgIHdoZXJlOiB7IGNhdGVnb3J5SWQgfSxcbiAgfSk7XG5cbiAgaWYgKHBhY2thZ2VDb3VudCA+IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBcIkNhbm5vdCBkZWxldGUgY2F0ZWdvcnkgd2l0aCBhc3NvY2lhdGVkIHBhY2thZ2VzLiBSZW5hbWUgaXQgaW5zdGVhZC5cIixcbiAgICApO1xuICB9XG5cbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmRlbGV0ZSh7IHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0gfSk7XG59O1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlTZXJ2aWNlID0ge1xuICBjcmVhdGVDYXRlZ29yeSxcbiAgZ2V0QWxsQ2F0ZWdvcmllcyxcbiAgdXBkYXRlQ2F0ZWdvcnksXG4gIGRlbGV0ZUNhdGVnb3J5LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgbmFtZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNhdGVnb3J5IG5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMiwgXCJDYXRlZ29yeSBuYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMTAwLCBcIkNhdGVnb3J5IG5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBjcmVhdGVDYXRlZ29yeVNjaGVtYSA9IHoub2JqZWN0KHsgbmFtZTogbmFtZVNjaGVtYSB9KS5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlQ2F0ZWdvcnlTY2hlbWEgPSB6Lm9iamVjdCh7IG5hbWU6IG5hbWVTY2hlbWEgfSkuc3RyaWN0KCk7XG5cbmNvbnN0IGNhdGVnb3J5UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlQ2F0ZWdvcnlTY2hlbWEsXG4gIHVwZGF0ZUNhdGVnb3J5U2NoZW1hLFxuICBjYXRlZ29yeVBhcmFtc1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBwYWNrYWdlQ29udHJvbGxlciB9IGZyb20gXCIuL3BhY2thZ2UuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgcGFja2FnZVZhbGlkYXRpb25zIH0gZnJvbSBcIi4vcGFja2FnZS52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBOT1RFOiBgL2ludGVybmFsLypgIHJvdXRlcyBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgYEdFVCAvOnNsdWdgIGJlbG93IFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYSBsaXRlcmFsIHNlZ21lbnQgKGAvaW50ZXJuYWwvYWxsYCkgd291bGRcbi8vIG90aGVyd2lzZSBiZSBzd2FsbG93ZWQgYnkgdGhlIGA6c2x1Z2AgcGFyYW0gcm91dGUgYW5kIDQwNCBmb3JldmVyLlxuXG4vLyAxLiBNeSBwYWNrYWdlcyAoYWdlbnQpIFx1MjAxNCBzZWxmLXByZXZpZXcgb2YgUEVORElORy9SRUpFQ1RFRCBiZWZvcmUgYXBwcm92YWxcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL215LXBhY2thZ2VzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMuaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldE15UGFja2FnZXMsXG4pO1xuXG4vLyAyLiBBbGwgcGFja2FnZXMgKGFkbWluIG1vZGVyYXRpb24gVUkpXG5yb3V0ZXIuZ2V0KFxuICBcIi9pbnRlcm5hbC9hbGxcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHBhY2thZ2VWYWxpZGF0aW9ucy5pbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0QWxsUGFja2FnZXMsXG4pO1xuXG4vLyAzLiBQdWJsaWMgcGFja2FnZSBkZXRhaWwgYnkgc2x1Z1xucm91dGVyLmdldChcbiAgXCIvOnNsdWdcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVNsdWdQYXJhbXNTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldFBhY2thZ2VCeVNsdWcsXG4pO1xuXG4vLyA0LiBDcmVhdGUgcGFja2FnZSAoYWdlbnQgY3JlYXRlcyBvd247IGFkbWluIGNhbiBjcmVhdGUgZm9yIGFueSBhZ2VudClcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLmNyZWF0ZVBhY2thZ2VTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmNyZWF0ZVBhY2thZ2UsXG4pO1xuXG4vLyA1LiBBcHByb3ZlL3JlamVjdCBwYWNrYWdlIChhZG1pbikgXHUyMDE0IHJlZ2lzdGVyZWQgYmVmb3JlIFBBVENIIC86aWQgZm9yIGNsYXJpdHlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLnVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmNoYW5nZVBhY2thZ2VTdGF0dXMsXG4pO1xuXG4vLyA2LiBVcGRhdGUgcGFja2FnZSAoYWdlbnQgb3duIC8gYWRtaW4gYW55KVxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHBhY2thZ2VWYWxpZGF0aW9ucy51cGRhdGVQYWNrYWdlU2NoZW1hLFxuICB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIudXBkYXRlUGFja2FnZSxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBhY2thZ2UgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5zb2Z0RGVsZXRlUGFja2FnZSxcbik7XG5cbi8vIDguIFB1YmxpYyBsaXN0aW5nIFx1MjAxNCBrZXB0IGxhc3Qgc28gbm9uZSBvZiB0aGUgYWJvdmUgcm91dGVzIGFyZSBzaGFkb3dlZFxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVF1ZXJ5U2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRQdWJsaWNQYWNrYWdlcyxcbik7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgcGFja2FnZVNlcnZpY2UgfSBmcm9tIFwiLi9wYWNrYWdlLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVC9BRE1JTilcbmNvbnN0IGNyZWF0ZVBhY2thZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5jcmVhdGVQYWNrYWdlKHJlcS51c2VyISwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseS4gSXQgd2lsbCBiZSB2aXNpYmxlIGFmdGVyIGFkbWluIGFwcHJvdmFsLlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgY29udHJvbGxlciAoZmlsdGVycyArIHBhZ2luYXRpb24pXG5jb25zdCBnZXRQdWJsaWNQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldFB1YmxpY1BhY2thZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBQdWJsaWMgcGFja2FnZSBkZXRhaWwgYnkgc2x1Z1xuY29uc3QgZ2V0UGFja2FnZUJ5U2x1ZyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHNsdWcgPSBTdHJpbmcocmVxLnBhcmFtcy5zbHVnKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRQYWNrYWdlQnlTbHVnKHNsdWcpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIEFsbCBwYWNrYWdlcyBjb250cm9sbGVyIChBRE1JTiBtb2RlcmF0aW9uKVxuY29uc3QgZ2V0QWxsUGFja2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRBbGxQYWNrYWdlcyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBwYWNrYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDUuIE15IHBhY2thZ2VzIGNvbnRyb2xsZXIgKEFHRU5UKVxuY29uc3QgZ2V0TXlQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldE15UGFja2FnZXModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIllvdXIgcGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA2LiBVcGRhdGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCB1cGRhdGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UudXBkYXRlUGFja2FnZShyZXEudXNlciEsIGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDcuIENoYW5nZSBwYWNrYWdlIHN0YXR1cyBjb250cm9sbGVyIChBRE1JTiBhcHByb3ZlL3JlamVjdClcbmNvbnN0IGNoYW5nZVBhY2thZ2VTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5jaGFuZ2VQYWNrYWdlU3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA4LiBTb2Z0IGRlbGV0ZSBwYWNrYWdlIGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHNvZnREZWxldGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgYXdhaXQgcGFja2FnZVNlcnZpY2Uuc29mdERlbGV0ZVBhY2thZ2UocmVxLnVzZXIhLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcGFja2FnZUNvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBhY2thZ2UsXG4gIGdldFB1YmxpY1BhY2thZ2VzLFxuICBnZXRQYWNrYWdlQnlTbHVnLFxuICBnZXRBbGxQYWNrYWdlcyxcbiAgZ2V0TXlQYWNrYWdlcyxcbiAgdXBkYXRlUGFja2FnZSxcbiAgY2hhbmdlUGFja2FnZVN0YXR1cyxcbiAgc29mdERlbGV0ZVBhY2thZ2UsXG59OyIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyBQYWNrYWdlU3RhdHVzLCBSb2xlLCBOb3RpZmljYXRpb25UeXBlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBub3RpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvbm90aWZpY2F0aW9uXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVQYWNrYWdlUGF5bG9hZCxcbiAgSUludGVybmFsUGFja2FnZVF1ZXJ5LFxuICBJUGFja2FnZVF1ZXJ5LFxuICBJUmVxdWVzdFVzZXIsXG4gIElVcGRhdGVQYWNrYWdlUGF5bG9hZCxcbiAgSVVwZGF0ZVN0YXR1c1BheWxvYWQsXG59IGZyb20gXCIuL3BhY2thZ2UuaW50ZXJmYWNlXCI7XG5cbi8vIE1vbmV5IGlzIGBEZWNpbWFsKDEwLDIpYCBpbiB0aGUgc2NoZW1hIChBR0VOVFMubWQpIFx1MjAxNCBtYXAgdG8gTnVtYmVyIG9uIHJldHVybi5cbmNvbnN0IHNlcmlhbGl6ZVByaWNlID0gPFQgZXh0ZW5kcyB7IHByaWNlOiBQcmlzbWEuRGVjaW1hbCB9Pihyb3c6IFQpOiBUID0+ICh7XG4gIC4uLnJvdyxcbiAgcHJpY2U6IE51bWJlcihyb3cucHJpY2UpLFxufSk7XG5cbi8vIFB1YmxpYyBwYXlsb2FkcyBjYXJyeSB0aGUgYWdlbnQncyBkaXNwbGF5IGluZm8gb25seSBcdTIwMTQgbmV2ZXIgZW1haWwuXG5leHBvcnQgY29uc3QgcHVibGljUGFja2FnZUluY2x1ZGUgPSB7XG4gIGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0sXG4gIGFnZW50OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgYXZhdGFyVXJsOiB0cnVlIH0gfSxcbn0gYXMgY29uc3Q7XG5cbmNvbnN0IHZhbGlkYXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghY2F0ZWdvcnkpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgY2F0ZWdvcnlJZFwiKTtcbiAgfVxufTtcblxuLy8gUGFja2FnZXMgbXVzdCBiZSBvd25lZCBieSBhIGxpdmUgQUdFTlQgXHUyMDE0IG90aGVyd2lzZSB0aGUgYm9va2luZyBzdGF0ZVxuLy8gbWFjaGluZSdzIFwiQUdFTlQgKG93bnMgcGFja2FnZSlcIiBicmFuY2ggYW5kIGFnZW50LWJvb2tpbmdzIHNjb3BpbmcgYnJlYWsuXG5jb25zdCB2YWxpZGF0ZUFnZW50ID0gYXN5bmMgKGFnZW50SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBhZ2VudCA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBhZ2VudElkIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlLCByb2xlOiB0cnVlLCBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCFhZ2VudCB8fCBhZ2VudC5yb2xlICE9PSBSb2xlLkFHRU5UIHx8IGFnZW50LmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBhZ2VudElkXCIpO1xuICB9XG59O1xuXG4vLyBDb2xsaXNpb24tc2FmZSBzbHVnOiBiYXNlIHNsdWcgZnJvbSB0aGUgdGl0bGUsIHRoZW4gYC0yYCwgYC0zYCwgLi4uIHVzaW5nIGFcbi8vIHNpbmdsZSBwcmVmaXggcXVlcnkuIFB1cmUtQmFuZ2xhL2Vtb2ppIHRpdGxlcyBjYW4ndCBzbHVnaWZ5IFx1MjAxNCBmYWxsIGJhY2sgdG9cbi8vIGBwYWNrYWdlLTxzaG9ydElkPmAgc28gdGhlIFVSTCBpcyBhbHdheXMgbWVhbmluZ2Z1bC5cbmNvbnN0IGdlbmVyYXRlVW5pcXVlU2x1ZyA9IGFzeW5jICh0aXRsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgY29uc3QgYmFzZSA9IHNsdWdpZnkodGl0bGUpIHx8IGBwYWNrYWdlLSR7cmFuZG9tVVVJRCgpLnNsaWNlKDAsIDgpfWA7XG5cbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgIHdoZXJlOiB7IHNsdWc6IHsgc3RhcnRzV2l0aDogYmFzZSB9IH0sXG4gICAgc2VsZWN0OiB7IHNsdWc6IHRydWUgfSxcbiAgfSk7XG5cbiAgY29uc3QgdXNlZCA9IG5ldyBTZXQoZXhpc3RpbmcubWFwKChwKSA9PiBwLnNsdWcpKTtcbiAgaWYgKCF1c2VkLmhhcyhiYXNlKSkge1xuICAgIHJldHVybiBiYXNlO1xuICB9XG5cbiAgbGV0IHN1ZmZpeCA9IDI7XG4gIHdoaWxlICh1c2VkLmhhcyhgJHtiYXNlfS0ke3N1ZmZpeH1gKSkge1xuICAgIHN1ZmZpeCArPSAxO1xuICB9XG4gIHJldHVybiBgJHtiYXNlfS0ke3N1ZmZpeH1gO1xufTtcblxuLy8gMS4gQ3JlYXRlIGEgcGFja2FnZSAoQUdFTlQvQURNSU4pLiBOZXcgcGFja2FnZXMgc3RhcnQgUEVORElORyBhbmQgbmV2ZXIgbGVha1xuLy8gICAgaW50byBwdWJsaWMgcXVlcmllcyB1bnRpbCBhbiBhZG1pbiBhcHByb3ZlcyB0aGVtLlxuY29uc3QgY3JlYXRlUGFja2FnZSA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBheWxvYWQ6IElDcmVhdGVQYWNrYWdlUGF5bG9hZCkgPT4ge1xuICBhd2FpdCB2YWxpZGF0ZUNhdGVnb3J5KHBheWxvYWQuY2F0ZWdvcnlJZCk7XG5cbiAgLy8gQURNSU4gbWF5IGNyZWF0ZSBvbiBiZWhhbGYgb2YgYW4gYWdlbnQgKG9wdGlvbmFsIGFnZW50SWQpOyBBR0VOVCBhbHdheXNcbiAgLy8gb3ducyB3aGF0IHRoZXkgY3JlYXRlIGFuZCBtYXkgbm90IGltcGVyc29uYXRlIGFub3RoZXIgdXNlci5cbiAgbGV0IGFnZW50SWQ6IHN0cmluZztcbiAgaWYgKHVzZXIucm9sZSA9PT0gUm9sZS5BRE1JTikge1xuICAgIGlmIChwYXlsb2FkLmFnZW50SWQpIHtcbiAgICAgIGF3YWl0IHZhbGlkYXRlQWdlbnQocGF5bG9hZC5hZ2VudElkKTtcbiAgICAgIGFnZW50SWQgPSBwYXlsb2FkLmFnZW50SWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFnZW50SWQgPSB1c2VyLmlkO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAocGF5bG9hZC5hZ2VudElkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcImFnZW50SWQgY2FuIG9ubHkgYmUgc2V0IGJ5IGFuIGFkbWluXCIpO1xuICAgIH1cbiAgICBhZ2VudElkID0gdXNlci5pZDtcbiAgfVxuXG4gIGNvbnN0IHNsdWcgPSBhd2FpdCBnZW5lcmF0ZVVuaXF1ZVNsdWcocGF5bG9hZC50aXRsZSk7XG5cbiAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIHRpdGxlOiBwYXlsb2FkLnRpdGxlLFxuICAgICAgZGVzY3JpcHRpb246IHBheWxvYWQuZGVzY3JpcHRpb24sXG4gICAgICBsb2NhdGlvbjogcGF5bG9hZC5sb2NhdGlvbixcbiAgICAgIHByaWNlOiBwYXlsb2FkLnByaWNlLFxuICAgICAgZHVyYXRpb246IHBheWxvYWQuZHVyYXRpb24sXG4gICAgICBjYXRlZ29yeUlkOiBwYXlsb2FkLmNhdGVnb3J5SWQsXG4gICAgICBpbWFnZXM6IHBheWxvYWQuaW1hZ2VzLFxuICAgICAgYWdlbnRJZCxcbiAgICAgIHNsdWcsXG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKGNyZWF0ZWQpO1xufTtcblxuLy8gMi4gUHVibGljIGV4cGxvcmVkIGxpc3RpbmcgXHUyMDE0IEFQUFJPVkVEICsgbm90LWRlbGV0ZWQgb25seSwgZmlsdGVycyArIHNvcnRpbmcuXG5jb25zdCBnZXRQdWJsaWNQYWNrYWdlcyA9IGFzeW5jIChxdWVyeTogSVBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IGZpbHRlcnM6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXRbXSA9IFtdO1xuXG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgT1I6IFtcbiAgICAgICAgeyB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICB7IGRlc2NyaXB0aW9uOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgIHsgbG9jYXRpb246IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5LmxvY2F0aW9uKSB7XG4gICAgZmlsdGVycy5wdXNoKHtcbiAgICAgIGxvY2F0aW9uOiB7IGNvbnRhaW5zOiBxdWVyeS5sb2NhdGlvbiwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0sXG4gICAgfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5Lm1pblByaWNlICE9PSB1bmRlZmluZWQgfHwgcXVlcnkubWF4UHJpY2UgIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICBwcmljZToge1xuICAgICAgICAuLi4ocXVlcnkubWluUHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgZ3RlOiBxdWVyeS5taW5QcmljZSB9IDoge30pLFxuICAgICAgICAuLi4ocXVlcnkubWF4UHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgbHRlOiBxdWVyeS5tYXhQcmljZSB9IDoge30pLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubWluUmF0aW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBmaWx0ZXJzLnB1c2goeyByYXRpbmc6IHsgZ3RlOiBxdWVyeS5taW5SYXRpbmcgfSB9KTtcbiAgfVxuICBpZiAocXVlcnkubWF4RHVyYXRpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7IGR1cmF0aW9uOiB7IGx0ZTogcXVlcnkubWF4RHVyYXRpb24gfSB9KTtcbiAgfVxuICBpZiAocXVlcnkuY2F0ZWdvcnkpIHtcbiAgICBmaWx0ZXJzLnB1c2goeyBjYXRlZ29yeTogeyBzbHVnOiBxdWVyeS5jYXRlZ29yeSB9IH0pO1xuICB9XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXQgPSB7XG4gICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgQU5EOiBmaWx0ZXJzLmxlbmd0aCA+IDAgPyBmaWx0ZXJzIDogdW5kZWZpbmVkLFxuICB9O1xuXG4gIGNvbnN0IHNvcnRPcmRlciA9IHF1ZXJ5LnNvcnRPcmRlciA/PyAocXVlcnkuc29ydEJ5ID09PSBcIm5ld2VzdFwiID8gXCJkZXNjXCIgOiBcImFzY1wiKTtcblxuICBjb25zdCBvcmRlckJ5TWFwOiBSZWNvcmQ8c3RyaW5nLCBQcmlzbWEuVG91clBhY2thZ2VPcmRlckJ5V2l0aFJlbGF0aW9uSW5wdXQ+ID0ge1xuICAgIG5ld2VzdDogeyBjcmVhdGVkQXQ6IHNvcnRPcmRlciB9LFxuICAgIHByaWNlOiB7IHByaWNlOiBzb3J0T3JkZXIgfSxcbiAgICByYXRpbmc6IHsgcmF0aW5nOiBzb3J0T3JkZXIgfSxcbiAgICB0aXRsZTogeyB0aXRsZTogc29ydE9yZGVyIH0sXG4gIH07XG5cbiAgY29uc3Qgb3JkZXJCeSA9IG9yZGVyQnlNYXBbcXVlcnkuc29ydEJ5ID8/IFwibmV3ZXN0XCJdID8/IG9yZGVyQnlNYXAubmV3ZXN0O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeSxcbiAgICAgIGluY2x1ZGU6IHB1YmxpY1BhY2thZ2VJbmNsdWRlLFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVByaWNlKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAzLiBQdWJsaWMgZGV0YWlsIGJ5IHNsdWcgXHUyMDE0IEFQUFJPVkVEICsgbm90LWRlbGV0ZWQgb25seS5cbmNvbnN0IGdldFBhY2thZ2VCeVNsdWcgPSBhc3luYyAoc2x1Zzogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHsgc2x1Zywgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgaW5jbHVkZTogcHVibGljUGFja2FnZUluY2x1ZGUsXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh0b3VyUGFja2FnZSk7XG59O1xuXG4vLyA0LiBBbGwgcGFja2FnZXMgZm9yIHRoZSBhZG1pbiBtb2RlcmF0aW9uIFVJIChhbnkgc3RhdHVzLCBvcHRpb25hbCBmaWx0ZXJzKS5cbmNvbnN0IGdldEFsbFBhY2thZ2VzID0gYXN5bmMgKHF1ZXJ5OiBJSW50ZXJuYWxQYWNrYWdlUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zdGF0dXMgPyB7IHN0YXR1czogcXVlcnkuc3RhdHVzIH0gOiB7fSksXG4gICAgLi4uKHF1ZXJ5LmFnZW50SWQgPyB7IGFnZW50SWQ6IHF1ZXJ5LmFnZW50SWQgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgICAgICAgYWdlbnQ6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDUuIEFuIGFnZW50J3Mgb3duIHBhY2thZ2VzIChhbnkgc3RhdHVzKSBcdTIwMTQgc2VsZi1wcmV2aWV3IGJlZm9yZSBhcHByb3ZhbC5cbmNvbnN0IGdldE15UGFja2FnZXMgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJSW50ZXJuYWxQYWNrYWdlUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBhZ2VudElkOiB1c2VySWQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIEZldGNoICsgb3duZXJzaGlwIGdhdGUgc2hhcmVkIGJ5IFBBVENIIGFuZCBERUxFVEUuIEFETUlOIGJ5cGFzc2VzIG93bmVyc2hpcDtcbi8vIEFHRU5UIGVkaXRzIGFyZSBjb25maW5lZCB0byB0aGVpciBvd24gcGFja2FnZXMuXG5jb25zdCBmaW5kT3duZWRQYWNrYWdlID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGFja2FnZUlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBpZiAodXNlci5yb2xlICE9PSBSb2xlLkFETUlOICYmIHRvdXJQYWNrYWdlLmFnZW50SWQgIT09IHVzZXIuaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW4gb25seSBhY3Qgb24geW91ciBvd24gcGFja2FnZXMuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHRvdXJQYWNrYWdlO1xufTtcblxuLy8gNi4gVXBkYXRlIGEgcGFja2FnZS4gU2x1ZyBuZXZlciBjaGFuZ2VzIChrZWVwcyBsaW5rcy9ib29rbWFya3MgdmFsaWQpLlxuLy8gICAgQUdFTlQgZWRpdHMgcmVzZXQgc3RhdHVzIHRvIFBFTkRJTkc7IEFETUlOIGVkaXRzIHByZXNlcnZlIGl0LlxuY29uc3QgdXBkYXRlUGFja2FnZSA9IGFzeW5jIChcbiAgdXNlcjogSVJlcXVlc3RVc2VyLFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVBhY2thZ2VQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgZmluZE93bmVkUGFja2FnZSh1c2VyLCBwYWNrYWdlSWQpO1xuXG4gIGlmIChwYXlsb2FkLmNhdGVnb3J5SWQgIT09IHVuZGVmaW5lZCkge1xuICAgIGF3YWl0IHZhbGlkYXRlQ2F0ZWdvcnkocGF5bG9hZC5jYXRlZ29yeUlkKTtcbiAgfVxuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZUlucHV0ID0ge1xuICAgIC4uLihwYXlsb2FkLnRpdGxlICE9PSB1bmRlZmluZWQgPyB7IHRpdGxlOiBwYXlsb2FkLnRpdGxlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZGVzY3JpcHRpb24gIT09IHVuZGVmaW5lZCA/IHsgZGVzY3JpcHRpb246IHBheWxvYWQuZGVzY3JpcHRpb24gfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5sb2NhdGlvbiAhPT0gdW5kZWZpbmVkID8geyBsb2NhdGlvbjogcGF5bG9hZC5sb2NhdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLnByaWNlICE9PSB1bmRlZmluZWQgPyB7IHByaWNlOiBwYXlsb2FkLnByaWNlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZHVyYXRpb24gIT09IHVuZGVmaW5lZCA/IHsgZHVyYXRpb246IHBheWxvYWQuZHVyYXRpb24gfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5pbWFnZXMgIT09IHVuZGVmaW5lZCA/IHsgaW1hZ2VzOiBwYXlsb2FkLmltYWdlcyB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNhdGVnb3J5SWQgIT09IHVuZGVmaW5lZFxuICAgICAgPyB7IGNhdGVnb3J5OiB7IGNvbm5lY3Q6IHsgaWQ6IHBheWxvYWQuY2F0ZWdvcnlJZCB9IH0gfVxuICAgICAgOiB7fSksXG4gICAgLi4uKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiA/IHsgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLlBFTkRJTkcgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGEsXG4gICAgaW5jbHVkZTogeyBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9IH0sXG4gIH0pO1xuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh1cGRhdGVkKTtcbn07XG5cbi8vIDcuIEFwcHJvdmUvcmVqZWN0IGEgcGFja2FnZSAoYWRtaW4pLlxuY29uc3QgY2hhbmdlUGFja2FnZVN0YXR1cyA9IGFzeW5jIChcbiAgcGFja2FnZUlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVTdGF0dXNQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWVPclRocm93KHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gIH0pO1xuXG4gIGlmICh0b3VyUGFja2FnZS5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkNhbm5vdCBjaGFuZ2UgdGhlIHN0YXR1cyBvZiBhIGRlbGV0ZWQgcGFja2FnZS5cIik7XG4gIH1cblxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGE6IHsgc3RhdHVzOiBwYXlsb2FkLnN0YXR1cyB9LFxuICB9KTtcblxuICAvLyBiZXN0LWVmZm9ydCBpbi1hcHAgbm90aWZpY2F0aW9uIHRvIHRoZSBzdWJtaXR0aW5nIGFnZW50IChuZXZlciBmYWlscyByZXF1ZXN0KVxuICBjb25zdCBub3RpZmllZCA9IHtcbiAgICB0eXBlOlxuICAgICAgcGF5bG9hZC5zdGF0dXMgPT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgICAgICAgPyBOb3RpZmljYXRpb25UeXBlLlBBQ0tBR0VfQVBQUk9WRURcbiAgICAgICAgOiBOb3RpZmljYXRpb25UeXBlLlBBQ0tBR0VfUkVKRUNURUQsXG4gICAgdGl0bGU6XG4gICAgICBwYXlsb2FkLnN0YXR1cyA9PT0gUGFja2FnZVN0YXR1cy5BUFBST1ZFRFxuICAgICAgICA/IFwiUGFja2FnZSBhcHByb3ZlZFwiXG4gICAgICAgIDogXCJQYWNrYWdlIHJlamVjdGVkXCIsXG4gICAgbWVzc2FnZTpcbiAgICAgIHBheWxvYWQuc3RhdHVzID09PSBQYWNrYWdlU3RhdHVzLkFQUFJPVkVEXG4gICAgICAgID8gYFlvdXIgcGFja2FnZSBcIiR7dG91clBhY2thZ2UudGl0bGV9XCIgaGFzIGJlZW4gYXBwcm92ZWQgYW5kIGlzIG5vdyBsaXZlLmBcbiAgICAgICAgOiBgWW91ciBwYWNrYWdlIFwiJHt0b3VyUGFja2FnZS50aXRsZX1cIiB3YXMgcmVqZWN0ZWQuIFBsZWFzZSByZXZpZXcgYW5kIHJlc3VibWl0LmAsXG4gIH07XG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBub3RpZnkoXG4gICAgICB0b3VyUGFja2FnZS5hZ2VudElkLFxuICAgICAgbm90aWZpZWQudHlwZSxcbiAgICAgIG5vdGlmaWVkLnRpdGxlLFxuICAgICAgbm90aWZpZWQubWVzc2FnZSxcbiAgICAgIGAvZGFzaGJvYXJkL2FnZW50L3BhY2thZ2VzLyR7cGFja2FnZUlkfWAsXG4gICAgKSxcbiAgXSk7XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKHVwZGF0ZWQpO1xufTtcblxuLy8gOC4gU29mdCBkZWxldGUgKGFkbWluIGFueSwgYWdlbnQgb3duKS5cbmNvbnN0IHNvZnREZWxldGVQYWNrYWdlID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGFja2FnZUlkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUGFja2FnZSh1c2VyLCBwYWNrYWdlSWQpO1xuXG4gIHJldHVybiBwcmlzbWEudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgcGFja2FnZVNlcnZpY2UgPSB7XG4gIGNyZWF0ZVBhY2thZ2UsXG4gIGdldFB1YmxpY1BhY2thZ2VzLFxuICBnZXRQYWNrYWdlQnlTbHVnLFxuICBnZXRBbGxQYWNrYWdlcyxcbiAgZ2V0TXlQYWNrYWdlcyxcbiAgdXBkYXRlUGFja2FnZSxcbiAgY2hhbmdlUGFja2FnZVN0YXR1cyxcbiAgc29mdERlbGV0ZVBhY2thZ2UsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCB0aXRsZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlRpdGxlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDMsIFwiVGl0bGUgbXVzdCBiZSBhdCBsZWFzdCAzIGNoYXJhY3RlcnNcIilcbiAgLm1heCgyMDAsIFwiVGl0bGUgbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBkZXNjcmlwdGlvblNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkRlc2NyaXB0aW9uIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEwLCBcIkRlc2NyaXB0aW9uIG11c3QgYmUgYXQgbGVhc3QgMTAgY2hhcmFjdGVyc1wiKVxuICAubWF4KDEwMDAwLCBcIkRlc2NyaXB0aW9uIG11c3QgYmUgYXQgbW9zdCAxMDAwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBsb2NhdGlvblNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkxvY2F0aW9uIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDIsIFwiTG9jYXRpb24gbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgLm1heCgyMDAsIFwiTG9jYXRpb24gbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBwcmljZVNjaGVtYSA9IHpcbiAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIlByaWNlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnBvc2l0aXZlKFwiUHJpY2UgbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiKVxuICAucmVmaW5lKCh2YWwpID0+IE1hdGgucm91bmQodmFsICogMTAwKSAvIDEwMCA9PT0gdmFsLCB7XG4gICAgbWVzc2FnZTogXCJQcmljZSBtdXN0IGhhdmUgYXQgbW9zdCAyIGRlY2ltYWwgcGxhY2VzXCIsXG4gIH0pO1xuXG5jb25zdCBkdXJhdGlvblNjaGVtYSA9IHpcbiAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIkR1cmF0aW9uIGlzIHJlcXVpcmVkXCIgfSlcbiAgLmludChcIkR1cmF0aW9uIG11c3QgYmUgYSB3aG9sZSBudW1iZXIgb2YgZGF5c1wiKVxuICAubWluKDEsIFwiRHVyYXRpb24gbXVzdCBiZSBhdCBsZWFzdCAxIGRheVwiKTtcblxuY29uc3QgY2F0ZWdvcnlJZFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNhdGVnb3J5IGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgLm1pbigxLCBcIkNhdGVnb3J5IGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpO1xuXG5jb25zdCBpbWFnZXNTY2hlbWEgPSB6XG4gIC5hcnJheSh6LnN0cmluZygpLnVybChcIkVhY2ggaW1hZ2UgbXVzdCBiZSBhIHZhbGlkIFVSTFwiKSlcbiAgLm1pbigxLCBcIkF0IGxlYXN0IG9uZSBpbWFnZSBpcyByZXF1aXJlZFwiKVxuICAubWF4KDYsIFwiQXQgbW9zdCA2IGltYWdlcyBhcmUgYWxsb3dlZFwiKTtcblxuY29uc3QgY3JlYXRlUGFja2FnZVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLFxuICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvblNjaGVtYSxcbiAgICBsb2NhdGlvbjogbG9jYXRpb25TY2hlbWEsXG4gICAgcHJpY2U6IHByaWNlU2NoZW1hLFxuICAgIGR1cmF0aW9uOiBkdXJhdGlvblNjaGVtYSxcbiAgICBjYXRlZ29yeUlkOiBjYXRlZ29yeUlkU2NoZW1hLFxuICAgIGltYWdlczogaW1hZ2VzU2NoZW1hLFxuICAgIGFnZW50SWQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlUGFja2FnZVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgbG9jYXRpb246IGxvY2F0aW9uU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgcHJpY2U6IHByaWNlU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgZHVyYXRpb246IGR1cmF0aW9uU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgY2F0ZWdvcnlJZDogY2F0ZWdvcnlJZFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGltYWdlczogaW1hZ2VzU2NoZW1hLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiBPYmplY3Qua2V5cyhkYXRhKS5sZW5ndGggPiAwLCB7XG4gICAgbWVzc2FnZTogXCJBdCBsZWFzdCBvbmUgZmllbGQgbXVzdCBiZSBwcm92aWRlZCB0byB1cGRhdGVcIixcbiAgfSk7XG5cbmNvbnN0IHBhY2thZ2VRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgY2F0ZWdvcnk6IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIGxvY2F0aW9uOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBtaW5QcmljZTogei5jb2VyY2UubnVtYmVyKCkucG9zaXRpdmUoKS5vcHRpb25hbCgpLFxuICAgIG1heFByaWNlOiB6LmNvZXJjZS5udW1iZXIoKS5wb3NpdGl2ZSgpLm9wdGlvbmFsKCksXG4gICAgbWluUmF0aW5nOiB6LmNvZXJjZS5udW1iZXIoKS5taW4oMCkubWF4KDUpLm9wdGlvbmFsKCksXG4gICAgbWF4RHVyYXRpb246IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5vcHRpb25hbCgpLFxuICAgIHNvcnRCeTogelxuICAgICAgLmVudW0oW1wibmV3ZXN0XCIsIFwicHJpY2VcIiwgXCJyYXRpbmdcIiwgXCJ0aXRsZVwiXSlcbiAgICAgIC5kZWZhdWx0KFwibmV3ZXN0XCIpLFxuICAgIHNvcnRPcmRlcjogei5lbnVtKFtcImFzY1wiLCBcImRlc2NcIl0pLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5yZWZpbmUoKGRhdGEpID0+IHtcbiAgICBpZiAoZGF0YS5taW5QcmljZSAhPT0gdW5kZWZpbmVkICYmIGRhdGEubWF4UHJpY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGRhdGEubWluUHJpY2UgPD0gZGF0YS5tYXhQcmljZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sIHtcbiAgICBtZXNzYWdlOiBcIm1pblByaWNlIG11c3QgYmUgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIG1heFByaWNlXCIsXG4gICAgcGF0aDogW1wibWluUHJpY2VcIl0sXG4gIH0pO1xuXG5jb25zdCBpbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc3RhdHVzOiB6XG4gICAgLmVudW0oW1wiUEVORElOR1wiLCBcIkFQUFJPVkVEXCIsIFwiUkVKRUNURURcIl0pXG4gICAgLnRyYW5zZm9ybSgodmFsKSA9PiB2YWwgYXMgXCJQRU5ESU5HXCIgfCBcIkFQUFJPVkVEXCIgfCBcIlJFSkVDVEVEXCIpXG4gICAgLm9wdGlvbmFsKCksXG4gIGFnZW50SWQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgcGFja2FnZVBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBwYWNrYWdlU2x1Z1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc2x1Zzogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIHNsdWcgaXMgcmVxdWlyZWRcIiB9KS50cmltKCkubWluKDEpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgc3RhdHVzOiB6LmVudW0oW1wiQVBQUk9WRURcIiwgXCJSRUpFQ1RFRFwiXSwge1xuICAgICAgcmVxdWlyZWRfZXJyb3I6IFwiU3RhdHVzIGlzIHJlcXVpcmVkXCIsXG4gICAgICBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiU3RhdHVzIG11c3QgYmUgQVBQUk9WRUQgb3IgUkVKRUNURURcIixcbiAgICB9KSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5leHBvcnQgY29uc3QgcGFja2FnZVZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVQYWNrYWdlU2NoZW1hLFxuICB1cGRhdGVQYWNrYWdlU2NoZW1hLFxuICBwYWNrYWdlUXVlcnlTY2hlbWEsXG4gIGludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hLFxuICBwYWNrYWdlUGFyYW1zU2NoZW1hLFxuICBwYWNrYWdlU2x1Z1BhcmFtc1NjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGJsb2dDb250cm9sbGVyIH0gZnJvbSBcIi4vYmxvZy5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBibG9nVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9ibG9nLnZhbGlkYXRpb25cIjtcbmltcG9ydCB7IGJsb2dDb21tZW50Q29udHJvbGxlciB9IGZyb20gXCIuL2Jsb2dDb21tZW50LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGJsb2dDb21tZW50VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9ibG9nQ29tbWVudC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBOT1RFOiBgL2ludGVybmFsLypgIHJvdXRlcyBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgYEdFVCAvOnNsdWdgIGJlbG93IFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYSBsaXRlcmFsIHNlZ21lbnQgKGAvaW50ZXJuYWwvYWxsYCkgd291bGRcbi8vIG90aGVyd2lzZSBiZSBzd2FsbG93ZWQgYnkgdGhlIGA6c2x1Z2AgcGFyYW0gcm91dGUgYW5kIDQwNCBmb3JldmVyLlxuXG4vLyAxLiBBbGwgcG9zdHMgKGFkbWluIG1vZGVyYXRpb24gVUkpIFx1MjAxNCByZWdpc3RlcmVkIGJlZm9yZSAvOnNsdWdcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL2FsbFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLmludGVybmFsUXVlcnlTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldEFsbFBvc3RzLFxuKTtcblxuLy8gMWIuIE93biBwb3N0cyAoXCJNeSBQb3N0c1wiIFVJIGZvciBhZ2VudHMvYWRtaW5zKSBcdTIwMTQgYmVmb3JlIC86c2x1Z1xucm91dGVyLmdldChcbiAgXCIvbXktcG9zdHNcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJsb2dWYWxpZGF0aW9ucy5pbnRlcm5hbFF1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRNeVBvc3RzLFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgXHUyMDE0IFBVQkxJU0hFRCArIG5vdC1kZWxldGVkIG9ubHlcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLnB1YmxpY1F1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRQdWJsaWNQb3N0cyxcbik7XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi86c2x1Z1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0U2x1Z1BhcmFtc1NjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0UG9zdEJ5U2x1Zyxcbik7XG5cbi8vIDQuIENyZWF0ZSBwb3N0IChhZ2VudC9hZG1pbiBhdXRob3JzIG93biBwb3N0czsgbmV3IHBvc3RzIHN0YXJ0IERSQUZUKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBibG9nVmFsaWRhdGlvbnMuY3JlYXRlUG9zdFNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuY3JlYXRlUG9zdCxcbik7XG5cbi8vIFx1MjUwMFx1MjUwMCBDb21tZW50cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIE5PVEU6IHRoaXMgYmxvY2sgc3RheXMgYmVmb3JlIFBBVENIIC86aWQvc3RhdHVzIHNvIERFTEVURSAvY29tbWVudHMvOmlkIGlzXG4vLyBuZXZlciBzaGFkb3dlZCBcdTIwMTQgYW5kIG5vIGJhcmUgUEFUQ0ggLzpzbHVnIG9yIERFTEVURSAvOnNsdWcgaXMgZXZlciBhZGRlZC5cblxuLy8gNGEuIFB1YmxpYyBjb21tZW50cyBmb3IgYSBwb3N0IChQVUJMSVNIRUQgKyBub24tZGVsZXRlZCBwb3N0IG9ubHkpXG5yb3V0ZXIuZ2V0KFxuICBcIi86c2x1Zy9jb21tZW50c1wiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RTbHVnUGFyYW1zU2NoZW1hLFxuICAgIHF1ZXJ5OiBibG9nQ29tbWVudFZhbGlkYXRpb25zLmNvbW1lbnRRdWVyeVNjaGVtYSxcbiAgfSksXG4gIGJsb2dDb21tZW50Q29udHJvbGxlci5nZXRQb3N0Q29tbWVudHMsXG4pO1xuXG4vLyA0Yi4gQ3JlYXRlIGEgY29tbWVudCAoYW55IGF1dGhlbnRpY2F0ZWQgdXNlcilcbnJvdXRlci5wb3N0KFxuICBcIi86c2x1Zy9jb21tZW50c1wiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFNsdWdQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogYmxvZ0NvbW1lbnRWYWxpZGF0aW9ucy5jcmVhdGVDb21tZW50U2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbW1lbnRDb250cm9sbGVyLmNyZWF0ZUNvbW1lbnQsXG4pO1xuXG4vLyA0Yy4gU29mdCBkZWxldGUgYSBjb21tZW50IChvd25lciBvciBBRE1JTilcbnJvdXRlci5kZWxldGUoXG4gIFwiL2NvbW1lbnRzLzppZFwiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogYmxvZ0NvbW1lbnRWYWxpZGF0aW9ucy5jb21tZW50UGFyYW1zU2NoZW1hIH0pLFxuICBibG9nQ29tbWVudENvbnRyb2xsZXIuZGVsZXRlQ29tbWVudCxcbik7XG5cbi8vIDUuIFB1Ymxpc2gvdW5wdWJsaXNoIHBvc3QgKGFkbWluKSBcdTIwMTQgcmVnaXN0ZXJlZCBiZWZvcmUgUEFUQ0ggLzppZCBmb3IgY2xhcml0eVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBibG9nVmFsaWRhdGlvbnMudXBkYXRlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuY2hhbmdlUG9zdFN0YXR1cyxcbik7XG5cbi8vIDYuIFVwZGF0ZSBwb3N0IChhZ2VudCBvd24gLyBhZG1pbiBhbnkpIFx1MjAxNCBhZ2VudCBlZGl0cyByZXNldCB0byBEUkFGVFxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJsb2dWYWxpZGF0aW9ucy51cGRhdGVQb3N0U2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIudXBkYXRlUG9zdCxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBvc3QgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5zb2Z0RGVsZXRlUG9zdCxcbik7XG5cbmV4cG9ydCBjb25zdCBibG9nUm91dGVzID0gcm91dGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBibG9nU2VydmljZSB9IGZyb20gXCIuL2Jsb2cuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBwb3N0IGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgY3JlYXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmNyZWF0ZVBvc3QocmVxLnVzZXIhLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQb3N0IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LiBJdCB3aWxsIGJlIHZpc2libGUgYWZ0ZXIgcHVibGlzaGluZy5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIFB1YmxpYyBsaXN0aW5nIGNvbnRyb2xsZXIgKHNlYXJjaCArIHNvcnQgKyBwYWdpbmF0aW9uKVxuY29uc3QgZ2V0UHVibGljUG9zdHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRQdWJsaWNQb3N0cyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gUHVibGljIHBvc3QgZGV0YWlsIGJ5IHNsdWdcbmNvbnN0IGdldFBvc3RCeVNsdWcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0UG9zdEJ5U2x1ZyhzbHVnKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0IHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBBbGwgcG9zdHMgY29udHJvbGxlciAoQURNSU4gbW9kZXJhdGlvbilcbmNvbnN0IGdldEFsbFBvc3RzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0QWxsUG9zdHMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgcG9zdHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0Yi4gT3duIHBvc3RzIGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgZ2V0TXlQb3N0cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldE15UG9zdHMocmVxLnVzZXIhLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNS4gVXBkYXRlIHBvc3QgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3QgdXBkYXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLnVwZGF0ZVBvc3QocmVxLnVzZXIhLCBpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA2LiBDaGFuZ2UgcG9zdCBzdGF0dXMgY29udHJvbGxlciAoQURNSU4gcHVibGlzaC91bnB1Ymxpc2gpXG5jb25zdCBjaGFuZ2VQb3N0U3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuY2hhbmdlUG9zdFN0YXR1cyhpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3Qgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNy4gU29mdCBkZWxldGUgcG9zdCBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCBzb2Z0RGVsZXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGF3YWl0IGJsb2dTZXJ2aWNlLnNvZnREZWxldGVQb3N0KHJlcS51c2VyISwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJsb2dDb250cm9sbGVyID0ge1xuICBjcmVhdGVQb3N0LFxuICBnZXRQdWJsaWNQb3N0cyxcbiAgZ2V0UG9zdEJ5U2x1ZyxcbiAgZ2V0QWxsUG9zdHMsXG4gIGdldE15UG9zdHMsXG4gIHVwZGF0ZVBvc3QsXG4gIGNoYW5nZVBvc3RTdGF0dXMsXG4gIHNvZnREZWxldGVQb3N0LFxufTtcbiIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyBQb3N0U3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVQb3N0UGF5bG9hZCxcbiAgSUludGVybmFsUG9zdFF1ZXJ5LFxuICBJUG9zdFF1ZXJ5LFxuICBJUmVxdWVzdFVzZXIsXG4gIElVcGRhdGVQb3N0UGF5bG9hZCxcbiAgSVVwZGF0ZVBvc3RTdGF0dXNQYXlsb2FkLFxufSBmcm9tIFwiLi9ibG9nLmludGVyZmFjZVwiO1xuXG4vLyBQdWJsaWMgcGF5bG9hZHMgY2FycnkgdGhlIGF1dGhvcidzIGRpc3BsYXkgaW5mbyBvbmx5IFx1MjAxNCBuZXZlciBlbWFpbC9yb2xlLlxuZXhwb3J0IGNvbnN0IHB1YmxpY0F1dGhvclNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSxcbn07XG5cbi8vIENvbGxpc2lvbi1zYWZlIHNsdWc6IGJhc2Ugc2x1ZyBmcm9tIHRoZSB0aXRsZSwgdGhlbiBgLTJgLCBgLTNgLCAuLi4gdXNpbmcgYVxuLy8gc2luZ2xlIHByZWZpeCBxdWVyeS4gUHVyZS1CYW5nbGEvZW1vamkgdGl0bGVzIGNhbid0IHNsdWdpZnkgXHUyMDE0IGZhbGwgYmFjayB0b1xuLy8gYGJsb2ctPHNob3J0SWQ+YCBzbyB0aGUgVVJMIGlzIGFsd2F5cyBtZWFuaW5nZnVsLlxuY29uc3QgZ2VuZXJhdGVVbmlxdWVTbHVnID0gYXN5bmMgKHRpdGxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICBjb25zdCBiYXNlID0gc2x1Z2lmeSh0aXRsZSkgfHwgYGJsb2ctJHtyYW5kb21VVUlEKCkuc2xpY2UoMCwgOCl9YDtcblxuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgd2hlcmU6IHsgc2x1ZzogeyBzdGFydHNXaXRoOiBiYXNlIH0gfSxcbiAgICBzZWxlY3Q6IHsgc2x1ZzogdHJ1ZSB9LFxuICB9KTtcblxuICBjb25zdCB1c2VkID0gbmV3IFNldChleGlzdGluZy5tYXAoKHApID0+IHAuc2x1ZykpO1xuICBpZiAoIXVzZWQuaGFzKGJhc2UpKSB7XG4gICAgcmV0dXJuIGJhc2U7XG4gIH1cblxuICBsZXQgc3VmZml4ID0gMjtcbiAgd2hpbGUgKHVzZWQuaGFzKGAke2Jhc2V9LSR7c3VmZml4fWApKSB7XG4gICAgc3VmZml4ICs9IDE7XG4gIH1cbiAgcmV0dXJuIGAke2Jhc2V9LSR7c3VmZml4fWA7XG59O1xuXG4vLyAxLiBDcmVhdGUgYSBwb3N0IChBR0VOVC9BRE1JTikuIE5ldyBwb3N0cyBzdGFydCBEUkFGVCBhbmQgbmV2ZXIgbGVhayBpbnRvXG4vLyAgICBwdWJsaWMgcXVlcmllcyB1bnRpbCBhbiBhZG1pbiBwdWJsaXNoZXMgdGhlbS5cbmNvbnN0IGNyZWF0ZVBvc3QgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYXlsb2FkOiBJQ3JlYXRlUG9zdFBheWxvYWQpID0+IHtcbiAgY29uc3Qgc2x1ZyA9IGF3YWl0IGdlbmVyYXRlVW5pcXVlU2x1ZyhwYXlsb2FkLnRpdGxlKTtcblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgdGl0bGU6IHBheWxvYWQudGl0bGUsXG4gICAgICBleGNlcnB0OiBwYXlsb2FkLmV4Y2VycHQsXG4gICAgICBjb250ZW50OiBwYXlsb2FkLmNvbnRlbnQsXG4gICAgICBjb3ZlckltYWdlOiBwYXlsb2FkLmNvdmVySW1hZ2UsXG4gICAgICBzbHVnLFxuICAgICAgYXV0aG9ySWQ6IHVzZXIuaWQsXG4gICAgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gMi4gUHVibGljIGJsb2cgbGlzdGluZyBcdTIwMTQgUFVCTElTSEVEICsgbm90LWRlbGV0ZWQgb25seSwgc2VhcmNoICsgc29ydC5cbmNvbnN0IGdldFB1YmxpY1Bvc3RzID0gYXN5bmMgKHF1ZXJ5OiBJUG9zdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5CbG9nUG9zdFdoZXJlSW5wdXQgPSB7XG4gICAgc3RhdHVzOiBQb3N0U3RhdHVzLlBVQkxJU0hFRCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zZWFyY2hcbiAgICAgID8ge1xuICAgICAgICAgIE9SOiBbXG4gICAgICAgICAgICB7IHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgICAgICB7IGV4Y2VycHQ6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9XG4gICAgICA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBzb3J0T3JkZXIgPSBxdWVyeS5zb3J0T3JkZXIgPz8gKHF1ZXJ5LnNvcnRCeSA9PT0gXCJvbGRlc3RcIiA/IFwiYXNjXCIgOiBcImRlc2NcIik7XG5cbiAgY29uc3Qgb3JkZXJCeU1hcDogUmVjb3JkPHN0cmluZywgUHJpc21hLkJsb2dQb3N0T3JkZXJCeVdpdGhSZWxhdGlvbklucHV0PiA9IHtcbiAgICBuZXdlc3Q6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgIG9sZGVzdDogeyBjcmVhdGVkQXQ6IFwiYXNjXCIgfSxcbiAgICB0aXRsZTogeyB0aXRsZTogc29ydE9yZGVyIH0sXG4gIH07XG5cbiAgY29uc3Qgb3JkZXJCeSA9IG9yZGVyQnlNYXBbcXVlcnkuc29ydEJ5ID8/IFwibmV3ZXN0XCJdID8/IG9yZGVyQnlNYXAubmV3ZXN0O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeSxcbiAgICAgIHNlbGVjdDoge1xuICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgdGl0bGU6IHRydWUsXG4gICAgICAgIHNsdWc6IHRydWUsXG4gICAgICAgIGV4Y2VycHQ6IHRydWUsXG4gICAgICAgIGNvdmVySW1hZ2U6IHRydWUsXG4gICAgICAgIGNyZWF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgdXBkYXRlZEF0OiB0cnVlLFxuICAgICAgICBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCxcbiAgICAgIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmJsb2dQb3N0LmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAzLiBQdWJsaWMgcG9zdCBkZXRhaWwgYnkgc2x1ZyBcdTIwMTQgUFVCTElTSEVEICsgbm90LWRlbGV0ZWQgb25seS5cbmNvbnN0IGdldFBvc3RCeVNsdWcgPSBhc3luYyAoc2x1Zzogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHBvc3QgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZEZpcnN0KHtcbiAgICB3aGVyZTogeyBzbHVnLCBzdGF0dXM6IFBvc3RTdGF0dXMuUFVCTElTSEVELCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcblxuICBpZiAoIXBvc3QpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBvc3Qgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwb3N0O1xufTtcblxuLy8gNC4gQWxsIHBvc3RzIGZvciB0aGUgYWRtaW4gbW9kZXJhdGlvbiBVSSAoYW55IHN0YXR1cywgb3B0aW9uYWwgZmlsdGVyKS5cbmNvbnN0IGdldEFsbFBvc3RzID0gYXN5bmMgKHF1ZXJ5OiBJSW50ZXJuYWxQb3N0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkJsb2dQb3N0V2hlcmVJbnB1dCA9IHtcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zdGF0dXMgPyB7IHN0YXR1czogcXVlcnkuc3RhdHVzIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IGF1dGhvcjogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0gfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmJsb2dQb3N0LmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyA0Yi4gVGhlIGNhbGxlcidzIG93biBwb3N0cyAoQUdFTlQvQURNSU4gXCJNeSBQb3N0c1wiIFVJKSBcdTIwMTQgYW55IHN0YXR1cywgc2luY2Vcbi8vICAgICBhZ2VudHMgbXVzdCBzZWUgdGhlaXIgb3duIGRyYWZ0cyBiZWZvcmUgYW4gYWRtaW4gcHVibGlzaGVzIHRoZW0uXG5jb25zdCBnZXRNeVBvc3RzID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcXVlcnk6IElJbnRlcm5hbFBvc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQmxvZ1Bvc3RXaGVyZUlucHV0ID0ge1xuICAgIGF1dGhvcklkOiB1c2VyLmlkLFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgYXV0aG9yOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIEZldGNoICsgb3duZXJzaGlwIGdhdGUgc2hhcmVkIGJ5IFBBVENIIGFuZCBERUxFVEUuIEFETUlOIGJ5cGFzc2VzIG93bmVyc2hpcDtcbi8vIEFHRU5UIGVkaXRzIGFyZSBjb25maW5lZCB0byB0aGVpciBvd24gcG9zdHMuXG5jb25zdCBmaW5kT3duZWRQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcG9zdElkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gIH0pO1xuXG4gIGlmICghcG9zdCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUG9zdCBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiAmJiBwb3N0LmF1dGhvcklkICE9PSB1c2VyLmlkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2FuIG9ubHkgYWN0IG9uIHlvdXIgb3duIHBvc3RzLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwb3N0O1xufTtcblxuLy8gNS4gVXBkYXRlIGEgcG9zdC4gU2x1ZyBuZXZlciBjaGFuZ2VzIChrZWVwcyBsaW5rcy9ib29rbWFya3MgdmFsaWQpLlxuLy8gICAgQUdFTlQgZWRpdHMgcmVzZXQgc3RhdHVzIHRvIERSQUZUIChyZS1wdWJsaXNoIHZpYSAvOmlkL3N0YXR1cyk7XG4vLyAgICBBRE1JTiBlZGl0cyBwcmVzZXJ2ZSBzdGF0dXMuXG5jb25zdCB1cGRhdGVQb3N0ID0gYXN5bmMgKFxuICB1c2VyOiBJUmVxdWVzdFVzZXIsXG4gIHBvc3RJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlUG9zdFBheWxvYWQsXG4pID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUG9zdCh1c2VyLCBwb3N0SWQpO1xuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZUlucHV0ID0ge1xuICAgIC4uLihwYXlsb2FkLnRpdGxlICE9PSB1bmRlZmluZWQgPyB7IHRpdGxlOiBwYXlsb2FkLnRpdGxlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZXhjZXJwdCAhPT0gdW5kZWZpbmVkID8geyBleGNlcnB0OiBwYXlsb2FkLmV4Y2VycHQgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5jb250ZW50ICE9PSB1bmRlZmluZWQgPyB7IGNvbnRlbnQ6IHBheWxvYWQuY29udGVudCB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNvdmVySW1hZ2UgIT09IHVuZGVmaW5lZFxuICAgICAgPyB7IGNvdmVySW1hZ2U6IHBheWxvYWQuY292ZXJJbWFnZSB9XG4gICAgICA6IHt9KSxcbiAgICAuLi4odXNlci5yb2xlICE9PSBSb2xlLkFETUlOID8geyBzdGF0dXM6IFBvc3RTdGF0dXMuRFJBRlQgfSA6IHt9KSxcbiAgfTtcblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICAgIGRhdGEsXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDYuIFB1Ymxpc2gvdW5wdWJsaXNoIGEgcG9zdCAoYWRtaW4pLlxuY29uc3QgY2hhbmdlUG9zdFN0YXR1cyA9IGFzeW5jIChcbiAgcG9zdElkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQb3N0U3RhdHVzUGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRVbmlxdWVPclRocm93KHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gIH0pO1xuXG4gIGlmIChwb3N0LmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiQ2Fubm90IGNoYW5nZSB0aGUgc3RhdHVzIG9mIGEgZGVsZXRlZCBwb3N0LlwiKTtcbiAgfVxuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YTogeyBzdGF0dXM6IHBheWxvYWQuc3RhdHVzIH0sXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDcuIFNvZnQgZGVsZXRlIChhZG1pbiBhbnksIGFnZW50IG93bikuXG5jb25zdCBzb2Z0RGVsZXRlUG9zdCA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBvc3RJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IGZpbmRPd25lZFBvc3QodXNlciwgcG9zdElkKTtcblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGJsb2dTZXJ2aWNlID0ge1xuICBjcmVhdGVQb3N0LFxuICBnZXRQdWJsaWNQb3N0cyxcbiAgZ2V0UG9zdEJ5U2x1ZyxcbiAgZ2V0QWxsUG9zdHMsXG4gIGdldE15UG9zdHMsXG4gIHVwZGF0ZVBvc3QsXG4gIGNoYW5nZVBvc3RTdGF0dXMsXG4gIHNvZnREZWxldGVQb3N0LFxufTtcbiIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCB0aXRsZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlRpdGxlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDMsIFwiVGl0bGUgbXVzdCBiZSBhdCBsZWFzdCAzIGNoYXJhY3RlcnNcIilcbiAgLm1heCgyMDAsIFwiVGl0bGUgbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBleGNlcnB0U2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRXhjZXJwdCBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigxLCBcIkV4Y2VycHQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgLm1heCg1MDAsIFwiRXhjZXJwdCBtdXN0IGJlIGF0IG1vc3QgNTAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGNvbnRlbnRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb250ZW50IGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEsIFwiQ29udGVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAubWF4KDEwMDAwLCBcIkNvbnRlbnQgbXVzdCBiZSBhdCBtb3N0IDEwMDAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGNvdmVySW1hZ2VTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb3ZlciBpbWFnZSBpcyByZXF1aXJlZFwiIH0pXG4gIC51cmwoXCJDb3ZlciBpbWFnZSBtdXN0IGJlIGEgdmFsaWQgVVJMXCIpO1xuXG5jb25zdCBjcmVhdGVQb3N0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEsXG4gICAgZXhjZXJwdDogZXhjZXJwdFNjaGVtYSxcbiAgICBjb250ZW50OiBjb250ZW50U2NoZW1hLFxuICAgIGNvdmVySW1hZ2U6IGNvdmVySW1hZ2VTY2hlbWEsXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlUG9zdFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgZXhjZXJwdDogZXhjZXJwdFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNvbnRlbnQ6IGNvbnRlbnRTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBjb3ZlckltYWdlOiBjb3ZlckltYWdlU2NoZW1hLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiBPYmplY3Qua2V5cyhkYXRhKS5sZW5ndGggPiAwLCB7XG4gICAgbWVzc2FnZTogXCJBdCBsZWFzdCBvbmUgZmllbGQgbXVzdCBiZSBwcm92aWRlZCB0byB1cGRhdGVcIixcbiAgfSk7XG5cbmNvbnN0IHBvc3RQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBvc3QgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgcG9zdFNsdWdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHNsdWc6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUG9zdCBzbHVnIGlzIHJlcXVpcmVkXCIgfSkudHJpbSgpLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVTdGF0dXNTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHN0YXR1czogei5lbnVtKFtcIkRSQUZUXCIsIFwiUFVCTElTSEVEXCJdLCB7XG4gICAgICByZXF1aXJlZF9lcnJvcjogXCJTdGF0dXMgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJTdGF0dXMgbXVzdCBiZSBEUkFGVCBvciBQVUJMSVNIRURcIixcbiAgICB9KSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCBwdWJsaWNRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgc29ydEJ5OiB6LmVudW0oW1wibmV3ZXN0XCIsIFwib2xkZXN0XCIsIFwidGl0bGVcIl0pLmRlZmF1bHQoXCJuZXdlc3RcIiksXG4gICAgc29ydE9yZGVyOiB6LmVudW0oW1wiYXNjXCIsIFwiZGVzY1wiXSkub3B0aW9uYWwoKSxcbiAgfSk7XG5cbmNvbnN0IGludGVybmFsUXVlcnlTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICAgIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgICBzdGF0dXM6IHpcbiAgICAgIC5lbnVtKFtcIkRSQUZUXCIsIFwiUFVCTElTSEVEXCJdKVxuICAgICAgLnRyYW5zZm9ybSgodmFsKSA9PiB2YWwgYXMgXCJEUkFGVFwiIHwgXCJQVUJMSVNIRURcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICB9KTtcblxuZXhwb3J0IGNvbnN0IGJsb2dWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlUG9zdFNjaGVtYSxcbiAgdXBkYXRlUG9zdFNjaGVtYSxcbiAgcG9zdFBhcmFtc1NjaGVtYSxcbiAgcG9zdFNsdWdQYXJhbXNTY2hlbWEsXG4gIHVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgcHVibGljUXVlcnlTY2hlbWEsXG4gIGludGVybmFsUXVlcnlTY2hlbWEsXG59O1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBibG9nQ29tbWVudFNlcnZpY2UgfSBmcm9tIFwiLi9ibG9nQ29tbWVudC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gUHVibGljIGNvbW1lbnRzIGZvciBhIHBvc3QgY29udHJvbGxlclxuY29uc3QgZ2V0UG9zdENvbW1lbnRzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3Qgc2x1ZyA9IFN0cmluZyhyZXEucGFyYW1zLnNsdWcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dDb21tZW50U2VydmljZS5nZXRQb3N0Q29tbWVudHMoc2x1ZywgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDb21tZW50cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIENyZWF0ZSBhIGNvbW1lbnQgY29udHJvbGxlciAoYW55IGF1dGhlbnRpY2F0ZWQgdXNlcilcbmNvbnN0IGNyZWF0ZUNvbW1lbnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ0NvbW1lbnRTZXJ2aWNlLmNyZWF0ZUNvbW1lbnQodXNlcklkLCBzbHVnLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJDb21tZW50IHBvc3RlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBTb2Z0IGRlbGV0ZSBjb21tZW50IGNvbnRyb2xsZXIgKG93bmVyIG9yIEFETUlOKVxuY29uc3QgZGVsZXRlQ29tbWVudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJvbGUgPSByZXEudXNlciEucm9sZTtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBhd2FpdCBibG9nQ29tbWVudFNlcnZpY2UuZGVsZXRlQ29tbWVudCh1c2VySWQsIHJvbGUsIGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDb21tZW50IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBibG9nQ29tbWVudENvbnRyb2xsZXIgPSB7XG4gIGdldFBvc3RDb21tZW50cyxcbiAgY3JlYXRlQ29tbWVudCxcbiAgZGVsZXRlQ29tbWVudCxcbn07IiwgImltcG9ydCB7IFBvc3RTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHB1YmxpY0F1dGhvclNlbGVjdCB9IGZyb20gXCIuL2Jsb2cuc2VydmljZVwiO1xuaW1wb3J0IHsgSUNyZWF0ZUNvbW1lbnRQYXlsb2FkLCBJQ29tbWVudFF1ZXJ5IH0gZnJvbSBcIi4vYmxvZ0NvbW1lbnQuaW50ZXJmYWNlXCI7XG5cbi8vIFNoYXJlZCB2aXNpYmlsaXR5IHJ1bGU6IGNvbW1lbnRzIG9ubHkgZXZlciBhcHBlYXIgdW5kZXIgYSBQVUJMSVNIRUQsXG4vLyBub24tZGVsZXRlZCBwb3N0IFx1MjAxNCB0aGUgc2FtZSBydWxlIGFzIGdldFBvc3RCeVNsdWcuXG5jb25zdCBnZXRQb3N0SWRCeVNsdWcgPSBhc3luYyAoc2x1Zzogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7IHNsdWcsIHN0YXR1czogUG9zdFN0YXR1cy5QVUJMSVNIRUQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCFwb3N0KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQb3N0IG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4gcG9zdC5pZDtcbn07XG5cbi8vIDEuIFB1YmxpYyBjb21tZW50cyBmb3IgYSBwb3N0IFx1MjAxNCB0b3AtbGV2ZWwgKyB0aGVpciByZXBsaWVzIGluIHR3byBxdWVyaWVzOlxuLy8gICAgdG9wLWxldmVsIG5ld2VzdC1maXJzdCwgcmVwbGllcyBvbGRlc3QtZmlyc3QgKGNvbnZlcnNhdGlvbiBvcmRlcikuXG5jb25zdCBnZXRQb3N0Q29tbWVudHMgPSBhc3luYyAoc2x1Zzogc3RyaW5nLCBxdWVyeTogSUNvbW1lbnRRdWVyeSkgPT4ge1xuICBjb25zdCBwb3N0SWQgPSBhd2FpdCBnZXRQb3N0SWRCeVNsdWcoc2x1Zyk7XG5cbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB0b3BMZXZlbFdoZXJlOiBQcmlzbWEuQmxvZ0NvbW1lbnRXaGVyZUlucHV0ID0ge1xuICAgIHBvc3RJZCxcbiAgICBwYXJlbnRJZDogbnVsbCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICB9O1xuXG4gIGNvbnN0IFt0b3BMZXZlbCwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nQ29tbWVudC5maW5kTWFueSh7XG4gICAgICB3aGVyZTogdG9wTGV2ZWxXaGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgdXNlcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ0NvbW1lbnQuY291bnQoeyB3aGVyZTogdG9wTGV2ZWxXaGVyZSB9KSxcbiAgXSk7XG5cbiAgY29uc3QgcmVwbGllcyA9IHRvcExldmVsLmxlbmd0aCA+IDBcbiAgICA/IGF3YWl0IHByaXNtYS5ibG9nQ29tbWVudC5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgcG9zdElkLFxuICAgICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICAgICAgcGFyZW50SWQ6IHsgaW46IHRvcExldmVsLm1hcCgoYykgPT4gYy5pZCkgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaW5jbHVkZTogeyB1c2VyOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiYXNjXCIgfSxcbiAgICAgIH0pXG4gICAgOiBbXTtcblxuICBjb25zdCByZXBseU1hcCA9IG5ldyBNYXA8c3RyaW5nLCB0eXBlb2YgcmVwbGllcz4oKTtcbiAgZm9yIChjb25zdCByZXBseSBvZiByZXBsaWVzKSB7XG4gICAgY29uc3QgbGlzdCA9IHJlcGx5TWFwLmdldChyZXBseS5wYXJlbnRJZCEpID8/IFtdO1xuICAgIGxpc3QucHVzaChyZXBseSk7XG4gICAgcmVwbHlNYXAuc2V0KHJlcGx5LnBhcmVudElkISwgbGlzdCk7XG4gIH1cblxuICBjb25zdCBkYXRhID0gdG9wTGV2ZWwubWFwKChjb21tZW50KSA9PiAoe1xuICAgIC4uLmNvbW1lbnQsXG4gICAgcmVwbGllczogcmVwbHlNYXAuZ2V0KGNvbW1lbnQuaWQpID8/IFtdLFxuICB9KSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDIuIENyZWF0ZSBhIGNvbW1lbnQgKGFueSBhdXRoZW50aWNhdGVkIHVzZXIpLiBPbmUtbGV2ZWwgcmVwbGllcyBvbmx5OiBhXG4vLyAgICBwYXJlbnQgbXVzdCBiZSBhIHRvcC1sZXZlbCBjb21tZW50IG9uIHRoZSBzYW1lIHBvc3QuXG5jb25zdCBjcmVhdGVDb21tZW50ID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgc2x1Zzogc3RyaW5nLFxuICBwYXlsb2FkOiBJQ3JlYXRlQ29tbWVudFBheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgcG9zdElkID0gYXdhaXQgZ2V0UG9zdElkQnlTbHVnKHNsdWcpO1xuXG4gIGxldCBwYXJlbnRJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGlmIChwYXlsb2FkLnBhcmVudElkKSB7XG4gICAgY29uc3QgcGFyZW50ID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICBpZDogcGF5bG9hZC5wYXJlbnRJZCxcbiAgICAgICAgcG9zdElkLFxuICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgcGFyZW50SWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghcGFyZW50KSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIlBhcmVudCBjb21tZW50IG5vdCBmb3VuZCBvbiB0aGlzIHBvc3QuXCIpO1xuICAgIH1cblxuICAgIGlmIChwYXJlbnQucGFyZW50SWQgIT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiUmVwbGllcyB0byByZXBsaWVzIGFyZSBub3QgYWxsb3dlZC5cIik7XG4gICAgfVxuXG4gICAgcGFyZW50SWQgPSBwYXJlbnQuaWQ7XG4gIH1cblxuICByZXR1cm4gcHJpc21hLmJsb2dDb21tZW50LmNyZWF0ZSh7XG4gICAgZGF0YTogeyBjb250ZW50OiBwYXlsb2FkLmNvbnRlbnQsIHBvc3RJZCwgdXNlcklkLCBwYXJlbnRJZCB9LFxuICAgIGluY2x1ZGU6IHsgdXNlcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gMy4gU29mdCBkZWxldGUgYSBjb21tZW50IFx1MjAxNCBvd25lciBvciBBRE1JTi4gQSBmb3JlaWduIGlkLCBhbiBhbHJlYWR5LWRlbGV0ZWRcbi8vICAgIGNvbW1lbnQsIG9yIGEgbm9uZXhpc3RlbnQgb25lIGlzIGEgdW5pZm9ybSA0MDQgKG5ldmVyIGEgbGVhaykuXG5jb25zdCBkZWxldGVDb21tZW50ID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcm9sZTogUm9sZSxcbiAgY29tbWVudElkOiBzdHJpbmcsXG4pID0+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LnVwZGF0ZU1hbnkoe1xuICAgIHdoZXJlOiB7XG4gICAgICBpZDogY29tbWVudElkLFxuICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgIC4uLihyb2xlICE9PSBSb2xlLkFETUlOID8geyB1c2VySWQgfSA6IHt9KSxcbiAgICB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmIChyZXN1bHQuY291bnQgPT09IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkNvbW1lbnQgbm90IGZvdW5kLlwiKTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGJsb2dDb21tZW50U2VydmljZSA9IHtcbiAgZ2V0UG9zdENvbW1lbnRzLFxuICBjcmVhdGVDb21tZW50LFxuICBkZWxldGVDb21tZW50LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlQ29tbWVudFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgY29udGVudDogelxuICAgICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbnRlbnQgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1pbigxLCBcIkNvbnRlbnQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgICAgIC5tYXgoMjAwMCwgXCJDb250ZW50IG11c3QgYmUgYXQgbW9zdCAyMDAwIGNoYXJhY3RlcnNcIiksXG4gICAgcGFyZW50SWQ6IHouc3RyaW5nKCkubWluKDEsIFwicGFyZW50SWQgbXVzdCBub3QgYmUgZW1wdHlcIikub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCBjb21tZW50UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb21tZW50IGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiQ29tbWVudCBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5jb25zdCBjb21tZW50UXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG59KTtcblxuZXhwb3J0IGNvbnN0IGJsb2dDb21tZW50VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZUNvbW1lbnRTY2hlbWEsXG4gIGNvbW1lbnRQYXJhbXNTY2hlbWEsXG4gIGNvbW1lbnRRdWVyeVNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBkYXNoYm9hcmRDb250cm9sbGVyIH0gZnJvbSBcIi4vZGFzaGJvYXJkLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGRhc2hib2FyZFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vZGFzaGJvYXJkLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBcdTIwMTQgcGxhdGZvcm0td2lkZSBhbmFseXRpY3NcbnJvdXRlci5nZXQoXG4gIFwiL2FkbWluXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBkYXNoYm9hcmRWYWxpZGF0aW9ucy5kYXNoYm9hcmRRdWVyeVNjaGVtYSB9KSxcbiAgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRBZG1pbkRhc2hib2FyZCxcbik7XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBcdTIwMTQgb3duIHBhY2thZ2VzL2Jvb2tpbmdzL3JldmVudWUvcGVyZm9ybWFuY2VcbnJvdXRlci5nZXQoXG4gIFwiL2FnZW50XCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBkYXNoYm9hcmRWYWxpZGF0aW9ucy5kYXNoYm9hcmRRdWVyeVNjaGVtYSB9KSxcbiAgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRBZ2VudERhc2hib2FyZCxcbik7XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIFx1MjAxNCBvd24gYm9va2luZ3MvdXBjb21pbmcvc3BlbmRcbnJvdXRlci5nZXQoXG4gIFwiL3VzZXJcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogZGFzaGJvYXJkVmFsaWRhdGlvbnMuZGFzaGJvYXJkUXVlcnlTY2hlbWEgfSksXG4gIGRhc2hib2FyZENvbnRyb2xsZXIuZ2V0VXNlckRhc2hib2FyZCxcbik7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBkYXNoYm9hcmRTZXJ2aWNlIH0gZnJvbSBcIi4vZGFzaGJvYXJkLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBBZG1pbiBkYXNoYm9hcmQgY29udHJvbGxlciAoQURNSU4pXG5jb25zdCBnZXRBZG1pbkRhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0QWRtaW5EYXNoYm9hcmQoXG4gICAgICBOdW1iZXIocmVxLnF1ZXJ5LmRheXMpLFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGFzaGJvYXJkIGRhdGEgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBBZ2VudCBkYXNoYm9hcmQgY29udHJvbGxlciAoQUdFTlQpXG5jb25zdCBnZXRBZ2VudERhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0QWdlbnREYXNoYm9hcmQoXG4gICAgICB1c2VySWQsXG4gICAgICBOdW1iZXIocmVxLnF1ZXJ5LmRheXMpLFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGFzaGJvYXJkIGRhdGEgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBVc2VyIGRhc2hib2FyZCBjb250cm9sbGVyIChVU0VSKVxuY29uc3QgZ2V0VXNlckRhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0VXNlckRhc2hib2FyZChcbiAgICAgIHVzZXJJZCxcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRDb250cm9sbGVyID0ge1xuICBnZXRBZG1pbkRhc2hib2FyZCxcbiAgZ2V0QWdlbnREYXNoYm9hcmQsXG4gIGdldFVzZXJEYXNoYm9hcmQsXG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMsIFBhY2thZ2VTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7XG4gIElBZ2VudERhc2hib2FyZCxcbiAgSUFkbWluRGFzaGJvYXJkLFxuICBJQm9va2luZ3NCeVN0YXR1cyxcbiAgSVJldmVudWVQb2ludCxcbiAgSVVzZXJEYXNoYm9hcmQsXG59IGZyb20gXCIuL2Rhc2hib2FyZC5pbnRlcmZhY2VcIjtcblxuLy8gTW9uZXkgaXMgYERlY2ltYWwoMTAsMilgIGluIHRoZSBzY2hlbWEgKEFHRU5UUy5tZCkgXHUyMDE0IG1hcCB0byBOdW1iZXIgb24gcmV0dXJuLlxuY29uc3QgdG9OdW1iZXIgPSAodmFsdWU6IHVua25vd24pOiBudW1iZXIgPT4gTnVtYmVyKHZhbHVlID8/IDApO1xuXG4vLyBCb29raW5nLXN0YXR1cyBicmVha2Rvd24gdmlhIGdyb3VwQnkgKyBfY291bnQuIE9wdGlvbmFsIHNjb3BlIGxpbWl0cyBpdCB0b1xuLy8gYW4gYWdlbnQncyBvd24gbm9uLWRlbGV0ZWQgcGFja2FnZXMgb3IgYSBzaW5nbGUgdXNlcidzIGJvb2tpbmdzLlxuY29uc3QgZ2V0Qm9va2luZ3NCeVN0YXR1cyA9IGFzeW5jIChcbiAgc2NvcGU6IHsgYWdlbnRJZD86IHN0cmluZzsgdXNlcklkPzogc3RyaW5nIH0gPSB7fSxcbik6IFByb21pc2U8SUJvb2tpbmdzQnlTdGF0dXNbXT4gPT4ge1xuICBjb25zdCBncm91cGVkID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZ3JvdXBCeSh7XG4gICAgYnk6IFtcInN0YXR1c1wiXSxcbiAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgIHdoZXJlOiBzY29wZS5hZ2VudElkXG4gICAgICA/IHsgcGFja2FnZTogeyBhZ2VudElkOiBzY29wZS5hZ2VudElkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0gfVxuICAgICAgOiBzY29wZS51c2VySWRcbiAgICAgICAgPyB7IHVzZXJJZDogc2NvcGUudXNlcklkIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gIH0pO1xuXG4gIHJldHVybiBncm91cGVkXG4gICAgLm1hcCgoZykgPT4gKHsgc3RhdHVzOiBnLnN0YXR1cywgY291bnQ6IGcuX2NvdW50Ll9hbGwgfSkpXG4gICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KTtcbn07XG5cbi8vIFJldmVudWUgdHJlbmQ6IG9uZSByb3cgcGVyIGRheSBmb3IgdGhlIGxhc3QgYGRheXNgIGRheXMsIGJ1Y2tldGluZyBDT01QTEVURURcbi8vIGJvb2tpbmdzIGJ5IHRoZWlyIGB1cGRhdGVkQXRgIFx1MjAxNCB0aGUgdGltZXN0YW1wIG9mIHRoZSB0cmFuc2l0aW9uIGludG9cbi8vIENPTVBMRVRFRCAoYSB0ZXJtaW5hbCBzdGF0ZSwgc28gaXQgaXMgdGhlIGxhc3Qgd3JpdGUpLiBgY3JlYXRlZEF0YCBpcyB3aGVuXG4vLyB0aGUgYm9va2luZyB3YXMgbWFkZSAoUEVORElORykgYW5kIG5ldmVyIG1vdmVzLCB3aGljaCB3b3VsZCBtaXMtZGF0ZSByZXZlbnVlXG4vLyB3ZWVrcyBsYXRlci4gUG9zdGdyZXMgZ2VuZXJhdGVfc2VyaWVzIGd1YXJhbnRlZXMgYSBkZW5zZSBzZXJpZXMgKHplcm8tZmlsbGVkXG4vLyBkYXlzKSBcdTIwMTQgYmV0dGVyIGFuZCBmYXN0ZXIgdGhhbiBhIHBlci1kYXkgSlMgbG9vcC4gT3B0aW9uYWwgc2NvcGU6IGFuIGFnZW50J3Ncbi8vIG93biBub24tZGVsZXRlZCBwYWNrYWdlcywgb3IgYSBzaW5nbGUgdXNlcidzIHNwZW5kLlxuY29uc3QgZ2V0UmV2ZW51ZU92ZXJUaW1lID0gYXN5bmMgKFxuICBkYXlzOiBudW1iZXIsXG4gIHNjb3BlOiB7IGFnZW50SWQ/OiBzdHJpbmc7IHVzZXJJZD86IHN0cmluZyB9ID0ge30sXG4pOiBQcm9taXNlPElSZXZlbnVlUG9pbnRbXT4gPT4ge1xuICBjb25zdCBhZ2VudFNjb3BlID0gc2NvcGUuYWdlbnRJZFxuICAgID8gYEFORCBiLlwicGFja2FnZUlkXCIgSU4gKFxuICAgICAgICAgU0VMRUNUIHAuXCJpZFwiXG4gICAgICAgICBGUk9NIFwidG91cl9wYWNrYWdlc1wiIHBcbiAgICAgICAgIFdIRVJFIHAuXCJhZ2VudElkXCIgPSAkMlxuICAgICAgICAgICBBTkQgcC5cImlzRGVsZXRlZFwiID0gZmFsc2VcbiAgICAgICApYFxuICAgIDogXCJcIjtcbiAgY29uc3QgdXNlclNjb3BlID0gc2NvcGUudXNlcklkID8gYEFORCBiLlwidXNlcklkXCIgPSAkMmAgOiBcIlwiO1xuICBjb25zdCB3aGVyZUNsYXVzZSA9IHNjb3BlLmFnZW50SWQgPyBhZ2VudFNjb3BlIDogdXNlclNjb3BlO1xuXG4gIGNvbnN0IHJvd3MgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3VW5zYWZlPFxuICAgIHsgZGF0ZTogc3RyaW5nOyByZXZlbnVlOiBudW1iZXIgfVtdXG4gID4oXG4gICAgYFxuICAgIFNFTEVDVCB0b19jaGFyKGRheXMuZCwgJ1lZWVktTU0tREQnKSBBUyBkYXRlLFxuICAgICAgICAgICBDT0FMRVNDRShTVU0oYi5cInRvdGFsUHJpY2VcIiksIDApOjpmbG9hdDggQVMgcmV2ZW51ZVxuICAgIEZST00gZ2VuZXJhdGVfc2VyaWVzKFxuICAgICAgQ1VSUkVOVF9EQVRFIC0gbWFrZV9pbnRlcnZhbChkYXlzID0+ICQxOjppbnQgLSAxKSxcbiAgICAgIENVUlJFTlRfREFURSxcbiAgICAgICcxIGRheSc6OmludGVydmFsXG4gICAgKSBBUyBkYXlzKGQpXG4gICAgTEVGVCBKT0lOIFwiYm9va2luZ3NcIiBiXG4gICAgICBPTiBkYXRlX3RydW5jKCdkYXknLCBiLlwidXBkYXRlZEF0XCIpOjpkYXRlID0gZGF5cy5kXG4gICAgICBBTkQgYi5cInN0YXR1c1wiID0gJ0NPTVBMRVRFRCdcbiAgICAgICR7d2hlcmVDbGF1c2V9XG4gICAgR1JPVVAgQlkgZGF5cy5kXG4gICAgT1JERVIgQlkgZGF5cy5kIEFTQ1xuICAgIGAsXG4gICAgZGF5cyxcbiAgICAuLi4oc2NvcGUuYWdlbnRJZCB8fCBzY29wZS51c2VySWQgPyBbc2NvcGUuYWdlbnRJZCA/PyBzY29wZS51c2VySWRdIDogW10pLFxuICApO1xuXG4gIHJldHVybiByb3dzO1xufTtcblxuLy8gUGFja2FnZS1pZCBzY29wZSBmb3IgYm9va2luZyBxdWVyaWVzLiBDYWxsZXJzIHNob3J0LWNpcmN1aXQgdGhlIGVtcHR5IGNhc2Vcbi8vIChhbiBhZ2VudCB3aXRoIG5vIHBhY2thZ2VzKSwgYnV0IGFuIGBpbjogW11gIGZhbGxiYWNrIGtlZXBzIHRoZSB0eXBlXG4vLyBub24tbnVsbGFibGUgd2hpbGUgc3RpbGwgbWF0Y2hpbmcgbm90aGluZyBpZiBpdCBldmVyIHNsaXBzIHRocm91Z2guXG5jb25zdCB0b1BhY2thZ2VJZFNjb3BlID0gKFxuICBwYWNrYWdlSWRzOiBzdHJpbmdbXSxcbik6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9PlxuICBwYWNrYWdlSWRzLmxlbmd0aFxuICAgID8geyBwYWNrYWdlSWQ6IHsgaW46IHBhY2thZ2VJZHMgfSB9XG4gICAgOiB7IHBhY2thZ2VJZDogeyBpbjogW10gfSB9O1xuXG4vLyAxLiBBZG1pbiBkYXNoYm9hcmQgXHUyMDE0IHBsYXRmb3JtLXdpZGUgY291bnRzLCBicmVha2Rvd25zIGFuZCByZXZlbnVlIHRyZW5kLlxuY29uc3QgZ2V0QWRtaW5EYXNoYm9hcmQgPSBhc3luYyAoZGF5czogbnVtYmVyKTogUHJvbWlzZTxJQWRtaW5EYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW1xuICAgIHRvdGFsVXNlcnMsXG4gICAgdG90YWxQYWNrYWdlcyxcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsUmV2ZW51ZSxcbiAgICB1c2Vyc0J5Um9sZSxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHBhY2thZ2VzQnlDYXRlZ29yeSxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnVzZXIuY291bnQoeyB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0gfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9IH0pLFxuICAgIHByaXNtYS5ib29raW5nLmNvdW50KCksXG4gICAgcHJpc21hLmJvb2tpbmcuYWdncmVnYXRlKHtcbiAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCB9LFxuICAgIH0pLFxuICAgIHByaXNtYS51c2VyLmdyb3VwQnkoe1xuICAgICAgYnk6IFtcInJvbGVcIl0sXG4gICAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIH0pLFxuICAgIGdldEJvb2tpbmdzQnlTdGF0dXMoKSxcbiAgICBwcmlzbWEudG91clBhY2thZ2VcbiAgICAgIC5ncm91cEJ5KHtcbiAgICAgICAgYnk6IFtcImNhdGVnb3J5SWRcIl0sXG4gICAgICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgICAgIHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIH0pXG4gICAgICAudGhlbihhc3luYyAoZ3JvdXBlZCkgPT4ge1xuICAgICAgICBjb25zdCBjYXRlZ29yeUlkcyA9IGdyb3VwZWQubWFwKChnKSA9PiBnLmNhdGVnb3J5SWQpO1xuICAgICAgICBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KHtcbiAgICAgICAgICB3aGVyZTogeyBpZDogeyBpbjogY2F0ZWdvcnlJZHMgfSB9LFxuICAgICAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9LFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgbmFtZU1hcCA9IG5ldyBNYXAoY2F0ZWdvcmllcy5tYXAoKGMpID0+IFtjLmlkLCBjLm5hbWVdKSk7XG5cbiAgICAgICAgcmV0dXJuIGdyb3VwZWRcbiAgICAgICAgICAubWFwKChnKSA9PiAoe1xuICAgICAgICAgICAgY2F0ZWdvcnk6IG5hbWVNYXAuZ2V0KGcuY2F0ZWdvcnlJZCkgPz8gXCJVbmtub3duXCIsXG4gICAgICAgICAgICBjb3VudDogZy5fY291bnQuX2FsbCxcbiAgICAgICAgICB9KSlcbiAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpO1xuICAgICAgfSksXG4gICAgZ2V0UmV2ZW51ZU92ZXJUaW1lKGRheXMpLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsVXNlcnMsXG4gICAgdG90YWxQYWNrYWdlcyxcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsUmV2ZW51ZTogdG9OdW1iZXIodG90YWxSZXZlbnVlLl9zdW0udG90YWxQcmljZSksXG4gICAgdXNlcnNCeVJvbGU6IHVzZXJzQnlSb2xlXG4gICAgICAubWFwKChnKSA9PiAoeyByb2xlOiBnLnJvbGUsIGNvdW50OiBnLl9jb3VudC5fYWxsIH0pKVxuICAgICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KSxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHBhY2thZ2VzQnlDYXRlZ29yeSxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIH07XG59O1xuXG4vLyAyLiBBZ2VudCBkYXNoYm9hcmQgXHUyMDE0IHNjb3BlZCB0byB0aGUgYWdlbnQncyBvd24gcGFja2FnZXMuIEZldGNoZXMgb3duZWRcbi8vICAgIHBhY2thZ2UgaWRzIG9uY2UsIHRoZW4gZXZlcnkgYWdncmVnYXRlIHJldXNlcyB0aGF0IHNjb3BlIHNvIHRoZSB3aG9sZVxuLy8gICAgYnVuZGxlIGlzIG9uZSBQcm9taXNlLmFsbCAobm8gcGVyLWl0ZW0gcXVlcmllcykuXG5jb25zdCBnZXRBZ2VudERhc2hib2FyZCA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIGRheXM6IG51bWJlcixcbik6IFByb21pc2U8SUFnZW50RGFzaGJvYXJkPiA9PiB7XG4gIGNvbnN0IFtvd25lZFBhY2thZ2VzLCBib29raW5nc0J5U3RhdHVzLCBhdmVyYWdlUmF0aW5nXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHsgYWdlbnRJZDogdXNlcklkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KSxcbiAgICBnZXRCb29raW5nc0J5U3RhdHVzKHsgYWdlbnRJZDogdXNlcklkIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5hZ2dyZWdhdGUoe1xuICAgICAgX2F2ZzogeyByYXRpbmc6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGFnZW50SWQ6IHVzZXJJZCxcbiAgICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSk7XG5cbiAgY29uc3QgcGFja2FnZUlkcyA9IG93bmVkUGFja2FnZXMubWFwKChwKSA9PiBwLmlkKTtcblxuICAvLyBBbiBhZ2VudCB3aXRoIG5vIHBhY2thZ2VzIG11c3Qgc2VlIHplcm9zIFx1MjAxNCBzY29wZSBpcyB1bmRlZmluZWQgZm9yIGFuIGVtcHR5XG4gIC8vIGxpc3QsIGFuZCBhIGJhcmUgYHdoZXJlOiB1bmRlZmluZWRgIC8gYEFORDogW3t9XWAgd291bGQgb3RoZXJ3aXNlIG1hdGNoIHRoZVxuICAvLyB3aG9sZSBwbGF0Zm9ybSAoY3Jvc3MtYWdlbnQgZGF0YSBsZWFrKS4gU2hvcnQtY2lyY3VpdCBoZXJlIGluc3RlYWQuXG4gIGlmIChwYWNrYWdlSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB7XG4gICAgICB0b3RhbFBhY2thZ2VzOiAwLFxuICAgICAgdG90YWxCb29raW5nczogMCxcbiAgICAgIHRvdGFsUmV2ZW51ZTogMCxcbiAgICAgIGF2ZXJhZ2VSYXRpbmc6IE1hdGgucm91bmQoKGF2ZXJhZ2VSYXRpbmcuX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMCxcbiAgICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgICByZXZlbnVlT3ZlclRpbWU6IGF3YWl0IGdldFJldmVudWVPdmVyVGltZShkYXlzLCB7IGFnZW50SWQ6IHVzZXJJZCB9KSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgc2NvcGUgPSB0b1BhY2thZ2VJZFNjb3BlKHBhY2thZ2VJZHMpO1xuXG4gIGNvbnN0IFt0b3RhbFBhY2thZ2VzLCB0b3RhbEJvb2tpbmdzLCB0b3RhbFJldmVudWUsIHJldmVudWVPdmVyVGltZV0gPVxuICAgIGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHBhY2thZ2VJZHMubGVuZ3RoLFxuICAgICAgcHJpc21hLmJvb2tpbmcuY291bnQoeyB3aGVyZTogc2NvcGUgfSksXG4gICAgICBwcmlzbWEuYm9va2luZy5hZ2dyZWdhdGUoe1xuICAgICAgICBfc3VtOiB7IHRvdGFsUHJpY2U6IHRydWUgfSxcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBBTkQ6IFtzY29wZSwgeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVEIH1dLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cywgeyBhZ2VudElkOiB1c2VySWQgfSksXG4gICAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlOiB0b051bWJlcih0b3RhbFJldmVudWUuX3N1bS50b3RhbFByaWNlKSxcbiAgICBhdmVyYWdlUmF0aW5nOiBNYXRoLnJvdW5kKChhdmVyYWdlUmF0aW5nLl9hdmcucmF0aW5nID8/IDApICogMTApIC8gMTAsXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIH07XG59O1xuXG4vLyAzLiBVc2VyIGRhc2hib2FyZCBcdTIwMTQgdGhlIHVzZXIncyBib29raW5ncywgc3BlbmQsIGFuZCB1cGNvbWluZyB0cmlwcy5cbmNvbnN0IGdldFVzZXJEYXNoYm9hcmQgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBkYXlzID0gMzAsXG4pOiBQcm9taXNlPElVc2VyRGFzaGJvYXJkPiA9PiB7XG4gIGNvbnN0IFt0b3RhbEJvb2tpbmdzLCB0b3RhbFNwZW5kLCB1cGNvbWluZywgYm9va2luZ3NCeVN0YXR1cywgcmV2ZW51ZU92ZXJUaW1lXSA9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgcHJpc21hLmJvb2tpbmcuY291bnQoeyB3aGVyZTogeyB1c2VySWQgfSB9KSxcbiAgICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgICB3aGVyZTogeyB1c2VySWQsIHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfSxcbiAgICAgIH0pLFxuICAgICAgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoe1xuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIHVzZXJJZCxcbiAgICAgICAgICBzdGF0dXM6IHtcbiAgICAgICAgICAgIGluOiBbQm9va2luZ1N0YXR1cy5QRU5ESU5HLCBCb29raW5nU3RhdHVzLlBBSUQsIEJvb2tpbmdTdGF0dXMuQ09ORklSTUVEXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRyYXZlbERhdGU6IHsgZ3Q6IG5ldyBEYXRlKCkgfSxcbiAgICAgICAgfSxcbiAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgICAgdHJhdmVsRGF0ZTogdHJ1ZSxcbiAgICAgICAgICB0cmF2ZWxlcnM6IHRydWUsXG4gICAgICAgICAgdG90YWxQcmljZTogdHJ1ZSxcbiAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgcGFja2FnZTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIHRpdGxlOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgICAgICAgfSxcbiAgICAgICAgb3JkZXJCeTogeyB0cmF2ZWxEYXRlOiBcImFzY1wiIH0sXG4gICAgICAgIHRha2U6IDUsXG4gICAgICB9KSxcbiAgICAgIGdldEJvb2tpbmdzQnlTdGF0dXMoeyB1c2VySWQgfSksXG4gICAgICBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cywgeyB1c2VySWQgfSksXG4gICAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsU3BlbmQ6IHRvTnVtYmVyKHRvdGFsU3BlbmQuX3N1bS50b3RhbFByaWNlKSxcbiAgICB1cGNvbWluZ0NvdW50OiB1cGNvbWluZy5sZW5ndGgsXG4gICAgdXBjb21pbmc6IHVwY29taW5nLm1hcCgoYikgPT4gKHtcbiAgICAgIC4uLmIsXG4gICAgICB0b3RhbFByaWNlOiBOdW1iZXIoYi50b3RhbFByaWNlKSxcbiAgICB9KSksXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkU2VydmljZSA9IHtcbiAgZ2V0QWRtaW5EYXNoYm9hcmQsXG4gIGdldEFnZW50RGFzaGJvYXJkLFxuICBnZXRVc2VyRGFzaGJvYXJkLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgZGFzaGJvYXJkUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGRheXM6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoMzY1KS5kZWZhdWx0KDMwKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkVmFsaWRhdGlvbnMgPSB7XG4gIGRhc2hib2FyZFF1ZXJ5U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHBheW1lbnRDb250cm9sbGVyIH0gZnJvbSBcIi4vcGF5bWVudC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBwYXltZW50VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9wYXltZW50LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE9wZW4gYSBnYXRld2F5IHNlc3Npb24gZm9yIHRoZSB1c2VyJ3MgcGVuZGluZyBib29raW5nIChVU0VSIG9ubHkpLlxucm91dGVyLnBvc3QoXG4gIFwiL2NyZWF0ZVwiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5jcmVhdGVTY2hlbWEgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmNyZWF0ZVBheW1lbnQsXG4pO1xuXG4vLyBQdWJsaWMgXHUyMDE0IFNTTENvbW1lcnogUE9TVHMgdGhlIG91dGNvbWUgaGVyZSAoc3VjY2Vzcy9mYWlsL2NhbmNlbCkgYW5kIHdlXG4vLyByZWRpcmVjdCB0aGUgYnJvd3NlciB0byB0aGUgZnJvbnRlbmQgcmVzdWx0IHBhZ2UuXG5yb3V0ZXIucG9zdChcbiAgXCIvY29uZmlybVwiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHF1ZXJ5OiBwYXltZW50VmFsaWRhdGlvbnMuY2FsbGJhY2tRdWVyeVNjaGVtYSxcbiAgICBib2R5OiBwYXltZW50VmFsaWRhdGlvbnMuZ2F0ZXdheVJlc3VsdFNjaGVtYSxcbiAgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmNvbmZpcm1QYXltZW50LFxuKTtcblxuLy8gUHVibGljIFx1MjAxNCBTU0xDb21tZXJ6IGluc3RhbnQgcGF5bWVudCBub3RpZmljYXRpb247IHNhbWUgaWRlbXBvdGVudCBzZXR0bGUuXG5yb3V0ZXIucG9zdChcbiAgXCIvaXBuXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcXVlcnk6IHBheW1lbnRWYWxpZGF0aW9ucy5jYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICAgIGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5nYXRld2F5UmVzdWx0U2NoZW1hLFxuICB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuaXBuLFxuKTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuaW1wb3J0IHsgSUdhdGV3YXlSZXN1bHQgfSBmcm9tIFwiLi9wYXltZW50LmludGVyZmFjZVwiO1xuaW1wb3J0IHsgcGF5bWVudFNlcnZpY2UgfSBmcm9tIFwiLi9wYXltZW50LnNlcnZpY2VcIjtcblxuY29uc3QgY3JlYXRlUGF5bWVudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgcGF5bWVudFNlcnZpY2UuY3JlYXRlUGF5bWVudFNlc3Npb24odXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQYXltZW50IHNlc3Npb24gY3JlYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBzZXNzaW9uLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gUHVibGljIGNhbGxiYWNrIHRhcmdldCBcdTIwMTQgU1NMQ29tbWVyeiBQT1NUcyBoZXJlIChzZXJ2ZXItdG8tc2VydmVyKSBhZnRlciB0aGVcbi8vIHNob3BwZXIgZmluaXNoZXMgYXQgdGhlIGdhdGV3YXkuIFdlIHNldHRsZSB0aGUgcGF5bWVudCwgdGhlbiBib3VuY2UgdGhlXG4vLyBicm93c2VyIHRvIHRoZSBmcm9udGVuZCByZXN1bHQgcGFnZS5cbmNvbnN0IGNvbmZpcm1QYXltZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgYm9va2luZ0lkID0gU3RyaW5nKHJlcS5xdWVyeS5ib29raW5nSWQpO1xuICAgIGNvbnN0IHRyYW5JZCA9IFN0cmluZyhyZXEucXVlcnkudHJhbklkKTtcbiAgICBjb25zdCBzdGF0dXMgPSBTdHJpbmcocmVxLnF1ZXJ5LnN0YXR1cyA/PyBcImZhaWxcIik7XG5cbiAgICBhd2FpdCBwYXltZW50U2VydmljZS5wcm9jZXNzR2F0ZXdheVJlc3VsdChcbiAgICAgIGJvb2tpbmdJZCxcbiAgICAgIHRyYW5JZCxcbiAgICAgIHJlcS5ib2R5IGFzIElHYXRld2F5UmVzdWx0LFxuICAgICk7XG5cbiAgICBjb25zdCByZWRpcmVjdEJhc2UgPVxuICAgICAgY29uZmlnLm5vZGVfZW52ID09PSBcInByb2R1Y3Rpb25cIlxuICAgICAgICA/IGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZFxuICAgICAgICA6IGNvbmZpZy5mcm9udGVuZF91cmxfZGV2O1xuICAgIGNvbnN0IHBhZ2UgPSBbXCJzdWNjZXNzXCIsIFwiZmFpbFwiLCBcImNhbmNlbFwiXS5pbmNsdWRlcyhzdGF0dXMpID8gc3RhdHVzIDogXCJmYWlsXCI7XG5cbiAgICByZXMucmVkaXJlY3QoMzAyLCBgJHtyZWRpcmVjdEJhc2V9L3BheW1lbnQvJHtwYWdlfT9ib29raW5nSWQ9JHtib29raW5nSWR9YCk7XG4gIH0sXG4pO1xuXG4vLyBQdWJsaWMgSVBOIHRhcmdldCBcdTIwMTQgdGhlIGdhdGV3YXkgbm90aWZpZXMgdXMgaGVyZSBpbmRlcGVuZGVudGx5IG9mIHRoZVxuLy8gcmVkaXJlY3QuIFNhbWUgaWRlbXBvdGVudCBzZXR0bGU7IGFsd2F5cyBhbnN3ZXJzIDIwMCBzbyB0aGUgZ2F0ZXdheSBzdG9wcyByZXRyeWluZy5cbmNvbnN0IGlwbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGJvb2tpbmdJZCA9IFN0cmluZyhyZXEucXVlcnkuYm9va2luZ0lkKTtcbiAgICBjb25zdCB0cmFuSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LnRyYW5JZCk7XG5cbiAgICBhd2FpdCBwYXltZW50U2VydmljZS5wcm9jZXNzR2F0ZXdheVJlc3VsdChcbiAgICAgIGJvb2tpbmdJZCxcbiAgICAgIHRyYW5JZCxcbiAgICAgIHJlcS5ib2R5IGFzIElHYXRld2F5UmVzdWx0LFxuICAgICk7XG5cbiAgICByZXMuc3RhdHVzKDIwMCkudHlwZShcInRleHQvcGxhaW5cIikuc2VuZChcIk9LXCIpO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRDb250cm9sbGVyID0ge1xuICBjcmVhdGVQYXltZW50LFxuICBjb25maXJtUGF5bWVudCxcbiAgaXBuLFxufTsiLCAiaW1wb3J0IHsgQm9va2luZ1N0YXR1cywgUGF5bWVudFN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBTc2xjb21tZXJ6SW5pdFJlc3VsdCwgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQsIGdlbmVyYXRlVHJhbklkLCBzc2xjb21tZXJ6SW5pdCwgc3NsY29tbWVyelZhbGlkYXRlIH0gZnJvbSBcIi4uLy4uL2xpYi9zc2xjb21tZXJ6XCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2VuZEJvb2tpbmdFbWFpbCB9IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgSUdhdGV3YXlSZXN1bHQsIElQYXltZW50Q3JlYXRlUmVxdWVzdCwgSVBheW1lbnRHYXRld2F5T3V0Y29tZSB9IGZyb20gXCIuL3BheW1lbnQuaW50ZXJmYWNlXCI7XG5cbi8vIFRoZSBnYXRld2F5IFBPU1RzIHRvIHRoZXNlIFVSTHMgc2VydmVyLXRvLXNlcnZlciwgc28gdGhlIGhvc3QgbXVzdCBiZVxuLy8gcHVibGljbHkgcmVhY2hhYmxlIFx1MjAxNCBjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsLCBuZXZlciBsb2NhbGhvc3QgaW4gc2FuZGJveC5cbmNvbnN0IGJ1aWxkQ2FsbGJhY2tVcmwgPSAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICB0cmFuSWQ6IHN0cmluZyxcbiAga2luZDogXCJzdWNjZXNzXCIgfCBcImZhaWxcIiB8IFwiY2FuY2VsXCIgfCBcImlwblwiLFxuKSA9PlxuICBgJHtjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsfS9hcGkvcGF5bWVudHMvJHtraW5kID09PSBcImlwblwiID8gXCJpcG5cIiA6IFwiY29uZmlybVwifT9ib29raW5nSWQ9JHtib29raW5nSWR9JnRyYW5JZD0ke3RyYW5JZH0ke1xuICAgIGtpbmQgPT09IFwiaXBuXCIgPyBcIlwiIDogYCZzdGF0dXM9JHtraW5kfWBcbiAgfWA7XG5cbi8vIE9wZW5zIGFuIFNTTENvbW1lcnogc2Vzc2lvbiBmb3IgYSBwZW5kaW5nIGJvb2tpbmcgdGhlIHVzZXIgb3ducy4gVGhlIGJvb2tpbmdcbi8vIGFtb3VudCBpcyBmcm96ZW4gYXQgaW5pdGlhdGlvbjsgaXQgbmV2ZXIgcmUtcmVhZHMgdGhlIHBhY2thZ2UgcHJpY2UuXG5jb25zdCBjcmVhdGVQYXltZW50U2Vzc2lvbiA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElQYXltZW50Q3JlYXRlUmVxdWVzdCxcbik6IFByb21pc2U8eyBwYXltZW50SWQ6IHN0cmluZzsgdHJhbklkOiBzdHJpbmc7IHBheW1lbnRVcmw6IHN0cmluZyB8IG51bGwgfT4gPT4ge1xuICBjb25zdCB7IGJvb2tpbmdJZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBib29raW5nID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCB9LFxuICAgIGluY2x1ZGU6IHsgcGFja2FnZTogeyBzZWxlY3Q6IHsgdGl0bGU6IHRydWUgfSB9IH0sXG4gIH0pO1xuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuICBpZiAoYm9va2luZy51c2VySWQgIT09IHVzZXJJZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwYXkgZm9yIHRoaXMgYm9va2luZy5cIik7XG4gIH1cbiAgaWYgKGJvb2tpbmcuc3RhdHVzID09PSBCb29raW5nU3RhdHVzLlBBSUQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIlRoaXMgYm9va2luZyBpcyBhbHJlYWR5IHBhaWQuXCIpO1xuICB9XG4gIGlmIChib29raW5nLnN0YXR1cyAhPT0gQm9va2luZ1N0YXR1cy5QRU5ESU5HKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDA5LFxuICAgICAgYENhbm5vdCBwYXkgZm9yIGEgYm9va2luZyBpbiAke2Jvb2tpbmcuc3RhdHVzLnRvTG93ZXJDYXNlKCl9IHN0YXR1cy5gLFxuICAgICk7XG4gIH1cblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSwgcGhvbmU6IHRydWUgfSxcbiAgfSk7XG4gIGlmICghdXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgY29uc3QgYW1vdW50ID0gTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSk7XG4gIGNvbnN0IHRyYW5JZCA9IGdlbmVyYXRlVHJhbklkKCk7XG5cbiAgLy8gT25lIGxpdmUgc2Vzc2lvbiBwZXIgYm9va2luZzogdGhlIGxlZGdlciByb3cgaXMgY3JlYXRlZCBhdG9taWNhbGx5IHdoaWxlXG4gIC8vIHN1cGVyc2VkaW5nIGFueSBhYmFuZG9uZWQgc2Vzc2lvbiwgdGhlbiB0aGUgZ2F0ZXdheSBpcyBhc2tlZC4gVGhlIHJvd1xuICAvLyBzdXJ2aXZlcyByZWdhcmRsZXNzIG9mIHRoZSBnYXRld2F5IHJlc3BvbnNlIFx1MjAxNCBpbml0IGZhaWx1cmUgZmxpcHMgaXQgdG9cbiAgLy8gRkFJTEVEIGJlbG93IHNvIGEgdHJ1dGhmdWwgZW50cnkgYWx3YXlzIGV4aXN0cy5cbiAgY29uc3QgcGF5bWVudCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGJvb2tpbmdJZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHgucGF5bWVudC5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICBib29raW5nSWQsXG4gICAgICAgIHRyYW5JZCxcbiAgICAgICAgYW1vdW50LFxuICAgICAgICBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVELFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgbGV0IGluaXQ6IFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB0cnkge1xuICAgIGluaXQgPSBhd2FpdCBzc2xjb21tZXJ6SW5pdCh7XG4gICAgICB0b3RhbF9hbW91bnQ6IGFtb3VudCxcbiAgICAgIHRyYW5faWQ6IHRyYW5JZCxcbiAgICAgIHN1Y2Nlc3NfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcInN1Y2Nlc3NcIiksXG4gICAgICBmYWlsX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJmYWlsXCIpLFxuICAgICAgY2FuY2VsX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJjYW5jZWxcIiksXG4gICAgICBpcG5fdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImlwblwiKSxcbiAgICAgIGN1c19uYW1lOiB1c2VyLm5hbWUsXG4gICAgICBjdXNfZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICBjdXNfcGhvbmU6IHVzZXIucGhvbmUgPz8gXCIwMTcxMTExMTExMVwiLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIGtlZXAgdGhlIGxlZGdlciB0cnV0aGZ1bCBcdTIwMTQgdGhlIHNlc3Npb24gbmV2ZXIgcmVhY2hlZCB0aGUgZ2F0ZXdheS4gVGhlXG4gICAgLy8gc3RhdHVzIGd1YXJkIG1ha2VzIGEgY29uY3VycmVudCAvY3JlYXRlIHRoYXQgYWxyZWFkeSBjYW5jZWxsZWQgdGhpcyByb3dcbiAgICAvLyB3aW4gdGhlIHJhY2UgKHRoYXQgcm93IHN0YXlzIGNhbmNlbGxlZCwgdGhpcyBvbmUgZmFpbHMgb25seSBpZiBsaXZlKS5cbiAgICBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQgfSxcbiAgICB9KTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIC8vIHN0b3JlIHRoZSBnYXRld2F5IFVSTHMgb25seSBpZiB0aGUgcm93IGlzIHN0aWxsIHRoZSBsaXZlIHNlc3Npb24uXG4gIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgZGF0YTogeyBnYXRld2F5UGFnZVVybDogaW5pdC5HYXRld2F5UGFnZVVSTCwgc3NsU2Vzc2lvbktleTogaW5pdC5zZXNzaW9ua2V5IH0sXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgcGF5bWVudElkOiBwYXltZW50LmlkLFxuICAgIHRyYW5JZDogcGF5bWVudC50cmFuSWQsXG4gICAgcGF5bWVudFVybDogaW5pdC5HYXRld2F5UGFnZVVSTCA/PyBudWxsLFxuICB9O1xufTtcblxuLy8gU2VydmVyLXNpZGUgdmVyaWZpY2F0aW9uIG9mIGEgY29tcGxldGVkIHRyYW5zYWN0aW9uOiB0aGUgdmFsaWRhdG9yIHJldHVybnNcbi8vIFZBTElEIChmaXJzdCBjaGVjaykgb3IgVkFMSURBVEVEIChhbHJlYWR5IHZlcmlmaWVkIGJlZm9yZSkgd2l0aCB0aGUgYW1vdW50LlxuLy8gQW55dGhpbmcgZWxzZSBcdTIwMTQgb3IgYSBtaXNtYXRjaGVkIGFtb3VudCBcdTIwMTQgZmFpbHMgdGhlIHBheW1lbnQuXG5jb25zdCB2ZXJpZnlTdWNjZXNzID0gYXN5bmMgKFxuICB2YWxJZDogc3RyaW5nLFxuICBleHBlY3RlZEFtb3VudDogbnVtYmVyLFxuKTogUHJvbWlzZTx7IHZlcmlmaWVkOiBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCB8IG51bGw7IG1hdGNoZXNBbW91bnQ6IGJvb2xlYW4gfT4gPT4ge1xuICBsZXQgdmVyaWZpZWQ6IFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHwgbnVsbCA9IG51bGw7XG4gIHRyeSB7XG4gICAgdmVyaWZpZWQgPSBhd2FpdCBzc2xjb21tZXJ6VmFsaWRhdGUoeyB2YWxfaWQ6IHZhbElkIH0pO1xuICB9IGNhdGNoIHtcbiAgICAvLyB2YWxpZGF0b3IgdW5yZWFjaGFibGUgXHUyMDE0IGZhaWwgdGhlIHBheW1lbnQgcmF0aGVyIHRoYW4gY3Jhc2ggdGhlIGNhbGxiYWNrXG4gICAgcmV0dXJuIHsgdmVyaWZpZWQ6IG51bGwsIG1hdGNoZXNBbW91bnQ6IGZhbHNlIH07XG4gIH1cblxuICBjb25zdCB2YWxpZFN0YXR1cyA9XG4gICAgdmVyaWZpZWQuc3RhdHVzID09PSBcIlZBTElEXCIgfHwgdmVyaWZpZWQuc3RhdHVzID09PSBcIlZBTElEQVRFRFwiO1xuICBjb25zdCBtYXRjaGVzQW1vdW50ID1cbiAgICB2ZXJpZmllZC5hbW91bnQgIT09IHVuZGVmaW5lZCAmJiBOdW1iZXIodmVyaWZpZWQuYW1vdW50KSA9PT0gZXhwZWN0ZWRBbW91bnQ7XG5cbiAgcmV0dXJuIHsgdmVyaWZpZWQsIG1hdGNoZXNBbW91bnQ6IHZhbGlkU3RhdHVzICYmIG1hdGNoZXNBbW91bnQgfTtcbn07XG5cbi8vIFNoYXJlZCBieSB0aGUgY29uZmlybSAoc3VjY2Vzcy9mYWlsL2NhbmNlbCkgYW5kIElQTiBlbmRwb2ludHMuIElkZW1wb3RlbnQ6IGFcbi8vIHNldHRsZWQgcGF5bWVudCBzaG9ydC1jaXJjdWl0cywgc28gdGhlIGRvdWJsZS1maXJpbmcgSVBOIG5ldmVyIGRvdWJsZS1jaGFyZ2VzLlxuY29uc3QgcHJvY2Vzc0dhdGV3YXlSZXN1bHQgPSBhc3luYyAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICB0cmFuSWQ6IHN0cmluZyxcbiAgcmVzdWx0OiBJR2F0ZXdheVJlc3VsdCxcbik6IFByb21pc2U8SVBheW1lbnRHYXRld2F5T3V0Y29tZT4gPT4ge1xuICBjb25zdCBwYXltZW50ID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgdHJhbklkIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgYm9va2luZzoge1xuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgdXNlcjogeyBzZWxlY3Q6IHsgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9LFxuICAgICAgICAgIHBhY2thZ2U6IHsgc2VsZWN0OiB7IHRpdGxlOiB0cnVlIH0gfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKCFwYXltZW50IHx8IHBheW1lbnQuYm9va2luZ0lkICE9PSBib29raW5nSWQpIHtcbiAgICAvLyBBIGNhbGxiYWNrIGZvciBhIHNlc3Npb24gd2UgbmV2ZXIgY3JlYXRlZCBcdTIwMTQgbm90aGluZyB0byBzZXR0bGUuXG4gICAgcmV0dXJuIHsgcGF5bWVudFN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQsIGJvb2tpbmdTdGF0dXM6IG51bGwsIGNoYW5nZWQ6IGZhbHNlIH07XG4gIH1cblxuICBpZiAocGF5bWVudC5zdGF0dXMgPT09IFBheW1lbnRTdGF0dXMuU1VDQ0VTUykge1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogZmFsc2UsXG4gICAgfTtcbiAgfVxuXG4gIC8vIENhbmNlbCBjYWxsYmFjayBcdTIwMTQgdGhlIHNob3BwZXIgYWJhbmRvbmVkIGNoZWNrb3V0LCBubyBjaGFyZ2Ugd2FzIG1hZGUuXG4gIGlmIChyZXN1bHQuZmFpbF9zdGF0dXMgPT09IFwiQ0FOQ0VMTEVEXCIgfHwgcmVzdWx0LnN0YXR1cyA9PT0gXCJDQU5DRUxMRURcIikge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkNBTkNFTExFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB1cGRhdGVkLnN0YXR1cyAhPT0gcGF5bWVudC5zdGF0dXMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIE5vIHZhbF9pZCBtZWFucyB0aGUgZ2F0ZXdheSByZXBvcnRlZCBhIGZhaWx1cmUgKGZhaWxfdXJsKSBcdTIwMTQgbm90aGluZyB0byB2ZXJpZnkuXG4gIGlmICghcmVzdWx0LnZhbF9pZCkge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB1cGRhdGVkLnN0YXR1cyAhPT0gcGF5bWVudC5zdGF0dXMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIFN1Y2Nlc3MgcGF0aDogdmVyaWZ5IHNlcnZlci1zaWRlIGFuZCBvbmx5IHRoZW4gbWFyayB0aGUgYm9va2luZyBhcyBwYWlkLlxuICBjb25zdCB7IHZlcmlmaWVkLCBtYXRjaGVzQW1vdW50IH0gPSBhd2FpdCB2ZXJpZnlTdWNjZXNzKFxuICAgIHJlc3VsdC52YWxfaWQsXG4gICAgTnVtYmVyKHBheW1lbnQuYW1vdW50KSxcbiAgKTtcblxuICBpZiAoIW1hdGNoZXNBbW91bnQpIHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQgfSxcbiAgICB9KTtcbiAgICByZXR1cm4ge1xuICAgICAgcGF5bWVudFN0YXR1czogdXBkYXRlZC5zdGF0dXMsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogdHJ1ZSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgc2V0dGxlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHR4LnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5TVUNDRVNTLFxuICAgICAgICB2YWxJZDogcmVzdWx0LnZhbF9pZCxcbiAgICAgICAgY2FyZFR5cGU6IHJlc3VsdC5jYXJkX3R5cGUgPz8gdmVyaWZpZWQ/LmNhcmRfdHlwZSxcbiAgICAgICAgYmFua1RyYW5JZDogcmVzdWx0LmJhbmtfdHJhbl9pZCA/PyB2ZXJpZmllZD8uYmFua190cmFuX2lkLFxuICAgICAgICBwYWlkQXQ6IG5ldyBEYXRlKCksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gY29tcGFyZS1hbmQtc2V0OiBvbmx5IGEgc3RpbGwtUEVORElORyBib29raW5nIGJlY29tZXMgUEFJRDsgYSBib29raW5nIHRoYXRcbiAgICAvLyB3YXMgY29uY3VycmVudGx5IGNvbmZpcm1lZCBvciBjYW5jZWxsZWQga2VlcHMgaXRzIHN0YXRlLCB0aGUgbW9uZXkgc3RheXMgb24uXG4gICAgYXdhaXQgdHguYm9va2luZy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiBib29raW5nSWQsIHN0YXR1czogQm9va2luZ1N0YXR1cy5QRU5ESU5HIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5QQUlEIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdXBkYXRlZDtcbiAgfSk7XG5cbiAgY29uc3QgYm9va2luZ0FmdGVyID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkOiBib29raW5nSWQgfSB9KTtcblxuICAvLyBiZXN0LWVmZm9ydCBcInBheW1lbnQgcmVjZWl2ZWRcIiBlbWFpbCBcdTIwMTQgbmV2ZXIgZmFpbHMgdGhlIGNhbGxiYWNrXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgIGVtYWlsOiBwYXltZW50LmJvb2tpbmcudXNlci5lbWFpbCxcbiAgICAgIG5hbWU6IHBheW1lbnQuYm9va2luZy51c2VyLm5hbWUsXG4gICAgICBwYWNrYWdlVGl0bGU6IHBheW1lbnQuYm9va2luZy5wYWNrYWdlLnRpdGxlLFxuICAgICAgdHJhdmVsRGF0ZTogcGF5bWVudC5ib29raW5nLnRyYXZlbERhdGUsXG4gICAgICB0cmF2ZWxlcnM6IHBheW1lbnQuYm9va2luZy50cmF2ZWxlcnMsXG4gICAgICB0b3RhbFByaWNlOiBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBBSUQsXG4gICAgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgcGF5bWVudFN0YXR1czogc2V0dGxlZC5zdGF0dXMsXG4gICAgYm9va2luZ1N0YXR1czogYm9va2luZ0FmdGVyPy5zdGF0dXMgPz8gbnVsbCxcbiAgICBjaGFuZ2VkOiB0cnVlLFxuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRTZXJ2aWNlID0ge1xuICBjcmVhdGVQYXltZW50U2Vzc2lvbixcbiAgcHJvY2Vzc0dhdGV3YXlSZXN1bHQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGJvb2tpbmdJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJCb29raW5nIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudXVpZChcIkJvb2tpbmcgaWQgbXVzdCBiZSBhIHZhbGlkIHV1aWRcIiksXG59KTtcblxuY29uc3QgY2FsbGJhY2tRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgYm9va2luZ0lkOiB6LnN0cmluZygpLnV1aWQoXCJCb29raW5nIGlkIG11c3QgYmUgYSB2YWxpZCB1dWlkXCIpLFxuICB0cmFuSWQ6IHouc3RyaW5nKCkubWluKDEpLFxuICBzdGF0dXM6IHouZW51bShbXCJzdWNjZXNzXCIsIFwiZmFpbFwiLCBcImNhbmNlbFwiXSkub3B0aW9uYWwoKSxcbn0pO1xuXG4vLyBCb2R5IG9mIHRoZSBnYXRld2F5IFBPU1QgXHUyMDE0IG9ubHkgZmllbGRzIHdlIGNvbnN1bWUsIGFsbCBvcHRpb25hbCBiZWNhdXNlIHRoZVxuLy8gc2hhcGUgZGlmZmVycyBiZXR3ZWVuIHN1Y2Nlc3MgLyBmYWlsIC8gY2FuY2VsIC8gSVBOIGNhbGxiYWNrcy5cbmNvbnN0IGdhdGV3YXlSZXN1bHRTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHZhbF9pZDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBzdGF0dXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgZmFpbF9zdGF0dXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgY2FyZF90eXBlOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGJhbmtfdHJhbl9pZDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBjdXJyZW5jeTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBhbW91bnQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUQ3JlYXRlUGF5bWVudFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNyZWF0ZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQ2FsbGJhY2tRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNhbGxiYWNrUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEdhdGV3YXlSZXN1bHRTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBnYXRld2F5UmVzdWx0U2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlU2NoZW1hLFxuICBjYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICBnYXRld2F5UmVzdWx0U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHdpc2hsaXN0Q29udHJvbGxlciB9IGZyb20gXCIuL3dpc2hsaXN0LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHdpc2hsaXN0VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi93aXNobGlzdC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBTYXZlIGEgcGFja2FnZSB0byB0aGUgd2lzaGxpc3QgKFVTRVIgb25seSlcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiB3aXNobGlzdFZhbGlkYXRpb25zLmNyZWF0ZVdpc2hsaXN0U2NoZW1hIH0pLFxuICB3aXNobGlzdENvbnRyb2xsZXIuYWRkVG9XaXNobGlzdCxcbik7XG5cbi8vIDIuIE15IHdpc2hsaXN0IChVU0VSIG9ubHkpIFx1MjAxNCBwYWdpbmF0ZWQsIG5ld2VzdCBmaXJzdFxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHdpc2hsaXN0VmFsaWRhdGlvbnMud2lzaGxpc3RRdWVyeVNjaGVtYSB9KSxcbiAgd2lzaGxpc3RDb250cm9sbGVyLmdldE15V2lzaGxpc3QsXG4pO1xuXG4vLyAzLiBSZW1vdmUgYSBwYWNrYWdlIGZyb20gdGhlIHdpc2hsaXN0IChVU0VSIG9ubHkpXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86cGFja2FnZUlkXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiB3aXNobGlzdFZhbGlkYXRpb25zLndpc2hsaXN0UGFyYW1zU2NoZW1hIH0pLFxuICB3aXNobGlzdENvbnRyb2xsZXIucmVtb3ZlRnJvbVdpc2hsaXN0LFxuKTtcblxuZXhwb3J0IGNvbnN0IHdpc2hsaXN0Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgd2lzaGxpc3RTZXJ2aWNlIH0gZnJvbSBcIi4vd2lzaGxpc3Quc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIFNhdmUgYSBwYWNrYWdlIHRvIHRoZSB3aXNobGlzdCBjb250cm9sbGVyIChVU0VSKVxuY29uc3QgYWRkVG9XaXNobGlzdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpc2hsaXN0U2VydmljZS5hZGRUb1dpc2hsaXN0KHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBhZGRlZCB0byB3aXNobGlzdCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBNeSB3aXNobGlzdCBjb250cm9sbGVyIChVU0VSKVxuY29uc3QgZ2V0TXlXaXNobGlzdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpc2hsaXN0U2VydmljZS5nZXRNeVdpc2hsaXN0KHVzZXJJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJXaXNobGlzdCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFJlbW92ZSBmcm9tIHdpc2hsaXN0IGNvbnRyb2xsZXIgKFVTRVIpIFx1MjAxNCAyMDQgc28gYSByZXBlYXQgZGVsZXRlIGlzIGFcbi8vICAgIG5vLW9wIGluZGlzdGluZ3Vpc2hhYmxlIGZyb20gYSBzdWNjZXNzZnVsIG9uZSAobm8gYm9keSwgbm8gZXJyb3IpLlxuY29uc3QgcmVtb3ZlRnJvbVdpc2hsaXN0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcGFja2FnZUlkID0gU3RyaW5nKHJlcS5wYXJhbXMucGFja2FnZUlkKTtcblxuICAgIGF3YWl0IHdpc2hsaXN0U2VydmljZS5yZW1vdmVGcm9tV2lzaGxpc3QodXNlcklkLCBwYWNrYWdlSWQpO1xuXG4gICAgcmVzLnN0YXR1cyhodHRwU3RhdHVzLk5PX0NPTlRFTlQpLnNlbmQoKTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCB3aXNobGlzdENvbnRyb2xsZXIgPSB7XG4gIGFkZFRvV2lzaGxpc3QsXG4gIGdldE15V2lzaGxpc3QsXG4gIHJlbW92ZUZyb21XaXNobGlzdCxcbn07IiwgImltcG9ydCB7IFBhY2thZ2VTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHB1YmxpY1BhY2thZ2VJbmNsdWRlIH0gZnJvbSBcIi4uL3BhY2thZ2UvcGFja2FnZS5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBJQ3JlYXRlV2lzaGxpc3RQYXlsb2FkLCBJV2lzaGxpc3RRdWVyeSB9IGZyb20gXCIuL3dpc2hsaXN0LmludGVyZmFjZVwiO1xuXG4vLyBNb25leSBpcyBgRGVjaW1hbCgxMCwyKWAgaW4gdGhlIHNjaGVtYSAoQUdFTlRTLm1kKSBcdTIwMTQgbWFwIHRvIE51bWJlciBvbiByZXR1cm4uXG5jb25zdCBzZXJpYWxpemVXaXNobGlzdEl0ZW0gPSA8XG4gIFQgZXh0ZW5kcyB7IHBhY2thZ2U6IHsgcHJpY2U6IFByaXNtYS5EZWNpbWFsIH0gfSxcbj4oXG4gIHJvdzogVCxcbik6IFQgPT4gKHtcbiAgLi4ucm93LFxuICBwYWNrYWdlOiB7IC4uLnJvdy5wYWNrYWdlLCBwcmljZTogTnVtYmVyKHJvdy5wYWNrYWdlLnByaWNlKSB9LFxufSk7XG5cbi8vIDEuIFNhdmUgYSBwYWNrYWdlIHRvIHRoZSB3aXNobGlzdCAoVVNFUikgXHUyMDE0IGlkZW1wb3RlbnQuIFRoZSBwYWNrYWdlIG11c3QgYmVcbi8vICAgIEFQUFJPVkVEIGFuZCBub3QgZGVsZXRlZCwgbWlycm9yaW5nIHRoZSBwdWJsaWMtcGFja2FnZSB2aXNpYmlsaXR5IHJ1bGUuXG5jb25zdCBhZGRUb1dpc2hsaXN0ID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSUNyZWF0ZVdpc2hsaXN0UGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7XG4gICAgICBpZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwcmlzbWEud2lzaGxpc3RJdGVtLnVwc2VydCh7XG4gICAgd2hlcmU6IHsgdXNlcklkX3BhY2thZ2VJZDogeyB1c2VySWQsIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQgfSB9LFxuICAgIGNyZWF0ZTogeyB1c2VySWQsIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQgfSxcbiAgICB1cGRhdGU6IHt9LFxuICB9KTtcbn07XG5cbi8vIDIuIFBhZ2luYXRlZCB3aXNobGlzdCAoVVNFUikgXHUyMDE0IG5ld2VzdCBmaXJzdC4gUm93cyB3aG9zZSBwYWNrYWdlIHdhcyBsYXRlclxuLy8gICAgc29mdC1kZWxldGVkIG9yIGRlbW90ZWQgb3V0IG9mIEFQUFJPVkVEIGFyZSBmaWx0ZXJlZCBhdCByZWFkIHRpbWUsIHNvIHRoZVxuLy8gICAgcGFnZSBuZXZlciBsaXN0cyBhIHBhY2thZ2Ugd2hvc2UgZGV0YWlsIHJvdXRlIHdvdWxkIDQwNC5cbmNvbnN0IGdldE15V2lzaGxpc3QgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJV2lzaGxpc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuV2lzaGxpc3RJdGVtV2hlcmVJbnB1dCA9IHtcbiAgICB1c2VySWQsXG4gICAgcGFja2FnZTogeyBpc0RlbGV0ZWQ6IGZhbHNlLCBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQgfSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS53aXNobGlzdEl0ZW0uZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IHBhY2thZ2U6IHsgaW5jbHVkZTogcHVibGljUGFja2FnZUluY2x1ZGUgfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLndpc2hsaXN0SXRlbS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVdpc2hsaXN0SXRlbSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMy4gUmVtb3ZlIGEgcGFja2FnZSBmcm9tIHRoZSB3aXNobGlzdCAoVVNFUikgXHUyMDE0IGlkZW1wb3RlbnQ7IGEgbWlzc2luZyByb3cgaXNcbi8vICAgIGEgbm8tb3AsIG5ldmVyIGFuIGVycm9yLiBEZWxpYmVyYXRlbHkgbm8gXCJjbGVhciBhbGxcIi5cbmNvbnN0IHJlbW92ZUZyb21XaXNobGlzdCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGFja2FnZUlkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLndpc2hsaXN0SXRlbS5kZWxldGVNYW55KHtcbiAgICB3aGVyZTogeyB1c2VySWQsIHBhY2thZ2VJZCB9LFxuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCB3aXNobGlzdFNlcnZpY2UgPSB7XG4gIGFkZFRvV2lzaGxpc3QsXG4gIGdldE15V2lzaGxpc3QsXG4gIHJlbW92ZUZyb21XaXNobGlzdCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVdpc2hsaXN0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWNrYWdlSWQ6IHpcbiAgICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC5taW4oMSwgXCJQYWNrYWdlIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHdpc2hsaXN0UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWNrYWdlSWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG59KTtcblxuY29uc3Qgd2lzaGxpc3RRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbn0pO1xuXG5leHBvcnQgY29uc3Qgd2lzaGxpc3RWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlV2lzaGxpc3RTY2hlbWEsXG4gIHdpc2hsaXN0UGFyYW1zU2NoZW1hLFxuICB3aXNobGlzdFF1ZXJ5U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBub3RpZmljYXRpb25Db250cm9sbGVyIH0gZnJvbSBcIi4vbm90aWZpY2F0aW9uLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IG5vdGlmaWNhdGlvblZhbGlkYXRpb25zIH0gZnJvbSBcIi4vbm90aWZpY2F0aW9uLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE5PVEU6IFBBVENIIC9yZWFkLWFsbCBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgUEFUQ0ggLzppZC9yZWFkIFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYC9yZWFkLWFsbGAgd291bGQgb3RoZXJ3aXNlIGJlIHN3YWxsb3dlZCBieVxuLy8gdGhlIGA6aWRgIHBhcmFtIHJvdXRlLlxuXG4vLyAxLiBNeSBub3RpZmljYXRpb25zIChhbnkgYXV0aGVudGljYXRlZCB1c2VyKSBcdTIwMTQgcGFnaW5hdGVkLCBvcHRpb25hbCA/dW5yZWFkPXRydWVcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBub3RpZmljYXRpb25WYWxpZGF0aW9ucy5ub3RpZmljYXRpb25RdWVyeVNjaGVtYSB9KSxcbiAgbm90aWZpY2F0aW9uQ29udHJvbGxlci5nZXRNeU5vdGlmaWNhdGlvbnMsXG4pO1xuXG4vLyAyLiBVbnJlYWQgY291bnQgZm9yIHRoZSBiZWxsIGJhZGdlXG5yb3V0ZXIuZ2V0KFxuICBcIi91bnJlYWQtY291bnRcIixcbiAgYXV0aCgpLFxuICBub3RpZmljYXRpb25Db250cm9sbGVyLmdldFVucmVhZENvdW50LFxuKTtcblxuLy8gMy4gTWFyayBhbGwgbXkgbm90aWZpY2F0aW9ucyByZWFkXG5yb3V0ZXIucGF0Y2goXG4gIFwiL3JlYWQtYWxsXCIsXG4gIGF1dGgoKSxcbiAgbm90aWZpY2F0aW9uQ29udHJvbGxlci5tYXJrQWxsQXNSZWFkLFxuKTtcblxuLy8gNC4gTWFyayBvbmUgbm90aWZpY2F0aW9uIHJlYWQgKG93bmVyIG9ubHkpXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9yZWFkXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBub3RpZmljYXRpb25WYWxpZGF0aW9ucy5ub3RpZmljYXRpb25QYXJhbXNTY2hlbWEgfSksXG4gIG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIubWFya0FzUmVhZCxcbik7XG5cbmV4cG9ydCBjb25zdCBub3RpZmljYXRpb25Sb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBub3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSBcIi4vbm90aWZpY2F0aW9uLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBNeSBub3RpZmljYXRpb25zIGNvbnRyb2xsZXIgKGFueSBhdXRoZW50aWNhdGVkIHVzZXIpXG5jb25zdCBnZXRNeU5vdGlmaWNhdGlvbnMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBub3RpZmljYXRpb25TZXJ2aWNlLmdldE15Tm90aWZpY2F0aW9ucyhcbiAgICAgIHVzZXJJZCxcbiAgICAgIHJlcS5xdWVyeSxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIk5vdGlmaWNhdGlvbnMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBVbnJlYWQgY291bnQgY29udHJvbGxlciAoYmVsbCBiYWRnZSlcbmNvbnN0IGdldFVucmVhZENvdW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbm90aWZpY2F0aW9uU2VydmljZS5nZXRVbnJlYWRDb3VudCh1c2VySWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVucmVhZCBjb3VudCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gTWFyayBvbmUgbm90aWZpY2F0aW9uIHJlYWQgY29udHJvbGxlclxuY29uc3QgbWFya0FzUmVhZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5vdGlmaWNhdGlvblNlcnZpY2UubWFya0FzUmVhZCh1c2VySWQsIGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJOb3RpZmljYXRpb24gbWFya2VkIGFzIHJlYWQuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBNYXJrIGFsbCBub3RpZmljYXRpb25zIHJlYWQgY29udHJvbGxlclxuY29uc3QgbWFya0FsbEFzUmVhZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5vdGlmaWNhdGlvblNlcnZpY2UubWFya0FsbEFzUmVhZCh1c2VySWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBub3RpZmljYXRpb25zIG1hcmtlZCBhcyByZWFkLlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIgPSB7XG4gIGdldE15Tm90aWZpY2F0aW9ucyxcbiAgZ2V0VW5yZWFkQ291bnQsXG4gIG1hcmtBc1JlYWQsXG4gIG1hcmtBbGxBc1JlYWQsXG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblF1ZXJ5IH0gZnJvbSBcIi4vbm90aWZpY2F0aW9uLmludGVyZmFjZVwiO1xuXG4vLyAxLiBNeSBub3RpZmljYXRpb25zIChuZXdlc3QgZmlyc3QpIFx1MjAxNCBvcHRpb25hbCA/dW5yZWFkPXRydWUgZmlsdGVyLlxuY29uc3QgZ2V0TXlOb3RpZmljYXRpb25zID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcXVlcnk6IElOb3RpZmljYXRpb25RdWVyeSxcbikgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDIwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuTm90aWZpY2F0aW9uV2hlcmVJbnB1dCA9IHtcbiAgICB1c2VySWQsXG4gICAgLi4uKHF1ZXJ5LnVucmVhZCA/IHsgaXNSZWFkOiBmYWxzZSB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLm5vdGlmaWNhdGlvbi5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ub3RpZmljYXRpb24uY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDIuIFVucmVhZCBjb3VudCBmb3IgdGhlIGJlbGwgYmFkZ2UgXHUyMDE0IHNpbmdsZSBpbmRleC1iYWNrZWQgY291bnQuXG5jb25zdCBnZXRVbnJlYWRDb3VudCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBjb3VudCA9IGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24uY291bnQoe1xuICAgIHdoZXJlOiB7IHVzZXJJZCwgaXNSZWFkOiBmYWxzZSB9LFxuICB9KTtcblxuICByZXR1cm4geyBjb3VudCB9O1xufTtcblxuLy8gMy4gTWFyayBvbmUgbm90aWZpY2F0aW9uIHJlYWQgKG93bmVyIG9ubHkgXHUyMDE0IGEgZm9yZWlnbiBpZCBpcyBhIDQwNCkuXG5jb25zdCBtYXJrQXNSZWFkID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBpZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24udXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHsgaWQsIHVzZXJJZCB9LFxuICAgIGRhdGE6IHsgaXNSZWFkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmIChyZXN1bHQuY291bnQgPT09IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIk5vdGlmaWNhdGlvbiBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHsgY291bnQ6IHJlc3VsdC5jb3VudCB9O1xufTtcblxuLy8gNC4gTWFyayBhbGwgbXkgbm90aWZpY2F0aW9ucyByZWFkIFx1MjAxNCBpZGVtcG90ZW50LlxuY29uc3QgbWFya0FsbEFzUmVhZCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEubm90aWZpY2F0aW9uLnVwZGF0ZU1hbnkoe1xuICAgIHdoZXJlOiB7IHVzZXJJZCwgaXNSZWFkOiBmYWxzZSB9LFxuICAgIGRhdGE6IHsgaXNSZWFkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7IGNvdW50OiByZXN1bHQuY291bnQgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0ge1xuICBnZXRNeU5vdGlmaWNhdGlvbnMsXG4gIGdldFVucmVhZENvdW50LFxuICBtYXJrQXNSZWFkLFxuICBtYXJrQWxsQXNSZWFkLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3Qgbm90aWZpY2F0aW9uUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgyMCksXG4gIC8vIFwidHJ1ZVwiL1wiZmFsc2VcIiBzdHJpbmdzIG9ubHkgXHUyMDE0IHouY29lcmNlLmJvb2xlYW4oKSB3b3VsZCB0cmVhdCB0aGUgc3RyaW5nXG4gIC8vIFwiZmFsc2VcIiBhcyB0cnV0aHkuXG4gIHVucmVhZDogelxuICAgIC5lbnVtKFtcInRydWVcIiwgXCJmYWxzZVwiXSlcbiAgICAudHJhbnNmb3JtKCh2YWx1ZSkgPT4gdmFsdWUgPT09IFwidHJ1ZVwiKVxuICAgIC5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IG5vdGlmaWNhdGlvblBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTm90aWZpY2F0aW9uIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiTm90aWZpY2F0aW9uIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxufSk7XG5cbmV4cG9ydCBjb25zdCBub3RpZmljYXRpb25WYWxpZGF0aW9ucyA9IHtcbiAgbm90aWZpY2F0aW9uUXVlcnlTY2hlbWEsXG4gIG5vdGlmaWNhdGlvblBhcmFtc1NjaGVtYSxcbn07IiwgIi8vIFZlcmNlbCBzZXJ2ZXJsZXNzIGVudHJ5cG9pbnQgXHUyMDE0IHJlLWV4cG9ydHMgdGhlIHNhbWUgRXhwcmVzcyBhcHAgdGhlIGxvY2FsXG4vLyBidWlsZCB1c2VzLiBWZXJjZWwncyBAdmVyY2VsL25vZGUgcnVudGltZSBjb21waWxlcyBhbmQgd3JhcHMgaXQ7IHRoZSBhcHAgaXNcbi8vIHNwbGl0IGZyb20gc2VydmVyLnRzICh3aGljaCBvbmx5IHN0YXJ0cyB0aGUgbGlzdGVuZXIpIHNvIHRoZSB0d28gaG9zdHMgc2hhcmVcbi8vIG9uZSByb3V0ZSByZWdpc3RyeS5cbmltcG9ydCBhcHAgZnJvbSBcIi4uL3NyYy9hcHBcIjtcblxuZXhwb3J0IGRlZmF1bHQgYXBwOyJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7QUFBQSxPQUFPLGFBQStEO0FBQ3RFLE9BQU8sVUFBVTtBQUNqQixPQUFPLGtCQUFrQjtBQUN6QixPQUFPLFlBQVk7QUFDbkIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sZUFBZTs7O0FDTHRCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFVBQVU7QUFDakIsU0FBUyxTQUFTO0FBRWxCLE9BQU8sT0FBTztBQUFBLEVBQ1osT0FBTztBQUFBLEVBQ1AsTUFBTSxLQUFLLEtBQUssUUFBUSxJQUFJLEdBQUcsTUFBTTtBQUN2QyxDQUFDO0FBS0QsSUFBTSxZQUFZLEVBQUUsT0FBTztBQUFBLEVBQ3pCLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxNQUFNO0FBQUEsRUFDL0IsVUFBVSxFQUFFLEtBQUssQ0FBQyxlQUFlLFFBQVEsWUFBWSxDQUFDLEVBQUUsUUFBUSxhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU03RSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVM7QUFBQSxFQUM1QyxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVM7QUFBQSxFQUU3QyxjQUFjLEVBQUUsT0FBTyxFQUFFLElBQUksR0FBRywwQkFBMEI7QUFBQSxFQUUxRCxvQkFBb0IsRUFBRSxPQUFPLEVBQUUsUUFBUSxJQUFJO0FBQUE7QUFBQTtBQUFBLEVBSTNDLGFBQWEsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFNBQVM7QUFBQSxFQUN6QyxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUs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SCxTQUFTLE9BQU87QUFDZCxRQUFJLE9BQU8sR0FBRyxFQUFFLEtBQUs7QUFBQSxNQUNuQixTQUFTO0FBQUEsTUFDVCxTQUFTO0FBQUEsTUFDVCxJQUFJO0FBQUEsTUFDSixZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsSUFDcEMsQ0FBQztBQUFBLEVBQ0g7QUFDRixDQUFDO0FBR0QsSUFBSSxJQUFJLGFBQWEsVUFBVTtBQUMvQixJQUFJLElBQUksY0FBYyxVQUFVO0FBQ2hDLElBQUksSUFBSSxnQkFBZ0IsWUFBWTtBQUNwQyxJQUFJLElBQUksZ0JBQWdCLGFBQWE7QUFDckMsSUFBSSxJQUFJLG1CQUFtQixjQUFjO0FBQ3pDLElBQUksSUFBSSxpQkFBaUIsYUFBYTtBQUN0QyxJQUFJLElBQUksZ0JBQWdCLFlBQVk7QUFDcEMsSUFBSSxJQUFJLGlCQUFpQixhQUFhO0FBQ3RDLElBQUksSUFBSSxhQUFhLFVBQVU7QUFDL0IsSUFBSSxJQUFJLGtCQUFrQixlQUFlO0FBQ3pDLElBQUksSUFBSSxpQkFBaUIsYUFBYTtBQUN0QyxJQUFJLElBQUksaUJBQWlCLGNBQWM7QUFDdkMsSUFBSSxJQUFJLHNCQUFzQixrQkFBa0I7QUFFaEQsSUFBSSxJQUFJLGdCQUFlO0FBQ3ZCLElBQUksSUFBSSwwQkFBa0I7QUFFMUIsSUFBTyxjQUFROzs7QStFOUhmLElBQU8sZ0JBQVE7IiwKICAibmFtZXMiOiBbInBhdGgiLCAiY29uZmlnIiwgIkJ1ZmZlciIsICJBbnlOdWxsIiwgIkRiTnVsbCIsICJEZWNpbWFsIiwgIkpzb25OdWxsIiwgIk51bGxUeXBlcyIsICJQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yIiwgIlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yIiwgIlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yIiwgIlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3IiLCAiUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yIiwgIlNxbCIsICJlbXB0eSIsICJqb2luIiwgInJhdyIsICJydW50aW1lIiwgImh0dHBTdGF0dXMiLCAiY3J5cHRvIiwgInBhdGgiLCAiY3J5cHRvIiwgInJlZnJlc2hUb2tlbiIsICJyZWZyZXNoVG9rZW4iLCAicmVnaXN0ZXJVc2VyIiwgImh0dHBTdGF0dXMiLCAibG9naW5Vc2VyIiwgImdvb2dsZUxvZ2luIiwgImRlbW9Mb2dpbiIsICJ2ZXJpZnlFbWFpbCIsICJyZXNlbmRWZXJpZmljYXRpb24iLCAiZm9yZ290UGFzc3dvcmQiLCAicmVzZXRQYXNzd29yZCIsICJ6IiwgInoiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiYmNyeXB0IiwgImJjcnlwdCIsICJ1cGRhdGVQcm9maWxlIiwgImh0dHBTdGF0dXMiLCAiZ2V0VXNlcnMiLCAiY2hhbmdlUm9sZSIsICJjaGFuZ2VTdGF0dXMiLCAiZGVsZXRlVXNlciIsICJ6IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAibXVsdGVyIiwgImh0dHBTdGF0dXMiLCAiaHR0cFN0YXR1cyIsICJtdWx0ZXIiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVNZXNzYWdlIiwgImh0dHBTdGF0dXMiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZUJvb2tpbmciLCAiaHR0cFN0YXR1cyIsICJnZXRNeUJvb2tpbmdzIiwgImdldEFnZW50Qm9va2luZ3MiLCAiZ2V0Qm9va2luZ0RldGFpbCIsICJnZXRBbGxCb29raW5ncyIsICJ1cGRhdGVCb29raW5nU3RhdHVzIiwgInoiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZVJldmlldyIsICJodHRwU3RhdHVzIiwgInVwZGF0ZVJldmlldyIsICJkZWxldGVSZXZpZXciLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZUNhdGVnb3J5IiwgImh0dHBTdGF0dXMiLCAiZ2V0QWxsQ2F0ZWdvcmllcyIsICJ1cGRhdGVDYXRlZ29yeSIsICJkZWxldGVDYXRlZ29yeSIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAicmFuZG9tVVVJRCIsICJyYW5kb21VVUlEIiwgImNyZWF0ZVBhY2thZ2UiLCAiaHR0cFN0YXR1cyIsICJnZXRQdWJsaWNQYWNrYWdlcyIsICJnZXRQYWNrYWdlQnlTbHVnIiwgImdldEFsbFBhY2thZ2VzIiwgImdldE15UGFja2FnZXMiLCAidXBkYXRlUGFja2FnZSIsICJjaGFuZ2VQYWNrYWdlU3RhdHVzIiwgInNvZnREZWxldGVQYWNrYWdlIiwgInoiLCAidXBkYXRlU3RhdHVzU2NoZW1hIiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAicmFuZG9tVVVJRCIsICJnZW5lcmF0ZVVuaXF1ZVNsdWciLCAicmFuZG9tVVVJRCIsICJjcmVhdGVQb3N0IiwgImh0dHBTdGF0dXMiLCAiZ2V0UHVibGljUG9zdHMiLCAiZ2V0UG9zdEJ5U2x1ZyIsICJnZXRBbGxQb3N0cyIsICJnZXRNeVBvc3RzIiwgInVwZGF0ZVBvc3QiLCAiY2hhbmdlUG9zdFN0YXR1cyIsICJzb2Z0RGVsZXRlUG9zdCIsICJ6IiwgInRpdGxlU2NoZW1hIiwgInVwZGF0ZVN0YXR1c1NjaGVtYSIsICJodHRwU3RhdHVzIiwgImdldFBvc3RDb21tZW50cyIsICJodHRwU3RhdHVzIiwgImNyZWF0ZUNvbW1lbnQiLCAiZGVsZXRlQ29tbWVudCIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiZ2V0QWRtaW5EYXNoYm9hcmQiLCAiaHR0cFN0YXR1cyIsICJnZXRBZ2VudERhc2hib2FyZCIsICJnZXRVc2VyRGFzaGJvYXJkIiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJodHRwU3RhdHVzIiwgInoiLCAiY3JlYXRlU2NoZW1hIiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiYWRkVG9XaXNobGlzdCIsICJodHRwU3RhdHVzIiwgImdldE15V2lzaGxpc3QiLCAicmVtb3ZlRnJvbVdpc2hsaXN0IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJnZXRNeU5vdGlmaWNhdGlvbnMiLCAiaHR0cFN0YXR1cyIsICJnZXRVbnJlYWRDb3VudCIsICJtYXJrQXNSZWFkIiwgIm1hcmtBbGxBc1JlYWQiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIl0KfQo=
