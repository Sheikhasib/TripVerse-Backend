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
  NODE_ENV: z.enum(["development", "production"]).default("development"),
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
if (config_default.node_env !== "production") {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FwcC50cyIsICIuLi9zcmMvY29uZmlnL2luZGV4LnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL25vdEZvdW5kLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudC50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2ludGVybmFsL2NsYXNzLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXMudHMiLCAiLi4vc3JjL3V0aWxzL2FwcEVycm9yLnRzIiwgIi4uL3NyYy9saWIvcHJpc21hLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguc2VydmljZS50cyIsICIuLi9zcmMvbGliL2dvb2dsZUF1dGgudHMiLCAiLi4vc3JjL2xpYi9yZWRpcy50cyIsICIuLi9zcmMvdXRpbHMvand0LnRzIiwgIi4uL3NyYy9saWIvbm9kZW1haWxlci50cyIsICIuLi9zcmMvdGVtcGxhdGVzL2luZGV4LnRzIiwgIi4uL3NyYy91dGlscy9hdXRoRW1haWwudHMiLCAiLi4vc3JjL3V0aWxzL2NhdGNoQXN5bmMudHMiLCAiLi4vc3JjL3V0aWxzL3NlbmRSZXNwb25zZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGgudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3QudHMiLCAiLi4vc3JjL21pZGRsZXdhcmUvYXV0aC50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9saWIvY2xvdWRpbmFyeS50cyIsICIuLi9zcmMvbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jb250YWN0L2NvbnRhY3Qucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL2VtYWlsLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbGliL3NzbGNvbW1lcnoudHMiLCAiLi4vc3JjL3V0aWxzL25vdGlmaWNhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcmV2aWV3L3Jldmlldy52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL3NsdWdpZnkudHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2Uuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nQ29tbWVudC5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jsb2cvYmxvZ0NvbW1lbnQuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2dDb21tZW50LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3Qucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3dpc2hsaXN0L3dpc2hsaXN0LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ub3RpZmljYXRpb24vbm90aWZpY2F0aW9uLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL25vdGlmaWNhdGlvbi9ub3RpZmljYXRpb24udmFsaWRhdGlvbi50cyIsICJpbmRleC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IGV4cHJlc3MsIHsgQXBwbGljYXRpb24sIE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xyXG5pbXBvcnQgY29ycyBmcm9tIFwiY29yc1wiO1xyXG5pbXBvcnQgY29va2llUGFyc2VyIGZyb20gXCJjb29raWUtcGFyc2VyXCI7XHJcbmltcG9ydCBoZWxtZXQgZnJvbSBcImhlbG1ldFwiO1xyXG5pbXBvcnQgbW9yZ2FuIGZyb20gXCJtb3JnYW5cIjtcclxuaW1wb3J0IHJhdGVMaW1pdCBmcm9tIFwiZXhwcmVzcy1yYXRlLWxpbWl0XCI7XHJcbmltcG9ydCBjb25maWcgZnJvbSBcIi4vY29uZmlnXCI7XHJcbmltcG9ydCBub3RGb3VuZEhhbmRsZXIgZnJvbSBcIi4vbWlkZGxld2FyZS9ub3RGb3VuZFwiO1xyXG5pbXBvcnQgZ2xvYmFsRXJyb3JIYW5kbGVyIGZyb20gXCIuL21pZGRsZXdhcmUvZ2xvYmFsRXJyb3JIYW5kbGVyXCI7XHJcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuL2xpYi9wcmlzbWFcIjtcclxuaW1wb3J0IHsgYXV0aFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYXV0aC9hdXRoLnJvdXRlXCI7XHJcbmltcG9ydCB7IHVzZXJSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZVwiO1xyXG5pbXBvcnQgeyB1cGxvYWRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBjb250YWN0Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9jb250YWN0L2NvbnRhY3Qucm91dGVcIjtcclxuaW1wb3J0IHsgYm9va2luZ1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlXCI7XHJcbmltcG9ydCB7IHJldmlld1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcmV2aWV3L3Jldmlldy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBjYXRlZ29yeVJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkucm91dGVcIjtcclxuaW1wb3J0IHsgcGFja2FnZVJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGFja2FnZS9wYWNrYWdlLnJvdXRlXCI7XHJcbmltcG9ydCB7IGJsb2dSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Jsb2cvYmxvZy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBkYXNoYm9hcmRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQucm91dGVcIjtcclxuaW1wb3J0IHsgcGF5bWVudFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnJvdXRlXCI7XHJcbmltcG9ydCB7IHdpc2hsaXN0Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBub3RpZmljYXRpb25Sb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL25vdGlmaWNhdGlvbi9ub3RpZmljYXRpb24ucm91dGVcIjtcclxuXHJcbmNvbnN0IGFwcDogQXBwbGljYXRpb24gPSBleHByZXNzKCk7XHJcblxyXG4vLyBSZW5kZXIvUmFpbHdheSBzaXQgYmVoaW5kIGEgcmV2ZXJzZSBwcm94eSBcdTIwMTQgbXVzdCBiZSBzZXQgYmVmb3JlIHRoZVxyXG4vLyByYXRlIGxpbWl0ZXIgb3IgaXQgd2lsbCBzZWUgdGhlIHByb3h5J3MgSVAgZm9yIGV2ZXJ5IHJlcXVlc3QgYW5kXHJcbi8vIGVmZmVjdGl2ZWx5IHJhdGUtbGltaXQgYWxsIHVzZXJzIHRvZ2V0aGVyLlxyXG5hcHAuc2V0KFwidHJ1c3QgcHJveHlcIiwgMSk7XHJcblxyXG5hcHAudXNlKGhlbG1ldCgpKTtcclxuXHJcbmFwcC51c2UoXHJcbiAgY29ycyh7XHJcbiAgICAvLyBEZXYgaG9zdCAobG9jYWxob3N0KSArIHByb2QgaG9zdCAoVmVyY2VsKSBib3RoIGFsbG93ZWQgc2lkZS1ieS1zaWRlLlxyXG4gICAgLy8gQ29uZmlnIHJlc29sdmVzIHNlbnNpYmxlIGRlZmF1bHRzIHNvIG5laXRoZXIgY2FuIGJlIGZhbHN5LlxyXG4gICAgb3JpZ2luOiBbY29uZmlnLmZyb250ZW5kX3VybF9kZXYsIGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZF0uZmlsdGVyKFxyXG4gICAgICAobyk6IG8gaXMgc3RyaW5nID0+IEJvb2xlYW4obyksXHJcbiAgICApLFxyXG4gICAgY3JlZGVudGlhbHM6IHRydWUsXHJcbiAgfSksXHJcbik7XHJcblxyXG5pZiAoY29uZmlnLm5vZGVfZW52ICE9PSBcInByb2R1Y3Rpb25cIikge1xyXG4gIGFwcC51c2UobW9yZ2FuKFwiZGV2XCIpKTtcclxufVxyXG5cclxuYXBwLnVzZShleHByZXNzLmpzb24oeyBsaW1pdDogXCIxMDBrYlwiIH0pKTtcclxuYXBwLnVzZShleHByZXNzLnVybGVuY29kZWQoeyBleHRlbmRlZDogdHJ1ZSwgbGltaXQ6IFwiMTAwa2JcIiB9KSk7XHJcbmFwcC51c2UoY29va2llUGFyc2VyKCkpO1xyXG5cclxuLy8gU3RyaWN0IGxpbWl0ZXIgXHUyMDE0IGF1dGggZW5kcG9pbnRzLCBicnV0ZS1mb3JjZSBwcm90ZWN0aW9uXHJcbmNvbnN0IGF1dGhMaW1pdGVyID0gcmF0ZUxpbWl0KHtcclxuICB3aW5kb3dNczogMTUgKiA2MCAqIDEwMDAsXHJcbiAgbGltaXQ6IDUsXHJcbiAgc3RhbmRhcmRIZWFkZXJzOiB0cnVlLFxyXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxyXG4gIG1lc3NhZ2U6IHtcclxuICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSBhdHRlbXB0cy4gUGxlYXNlIHRyeSBhZ2FpbiBpbiAxNSBtaW51dGVzLlwiLFxyXG4gIH0sXHJcbn0pO1xyXG5cclxuLy8gU3RhbmRhcmQgbGltaXRlciBcdTIwMTQgZXZlcnl0aGluZyBlbHNlIHVuZGVyIC9hcGlcclxuY29uc3QgYXBpTGltaXRlciA9IHJhdGVMaW1pdCh7XHJcbiAgd2luZG93TXM6IDE1ICogNjAgKiAxMDAwLFxyXG4gIGxpbWl0OiAxMDAsXHJcbiAgc3RhbmRhcmRIZWFkZXJzOiB0cnVlLFxyXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxyXG4gIG1lc3NhZ2U6IHtcclxuICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSByZXF1ZXN0cy4gUGxlYXNlIHRyeSBhZ2FpbiBsYXRlci5cIixcclxuICB9LFxyXG59KTtcclxuXHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvbG9naW5cIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL3JlZ2lzdGVyXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9kZW1vLWxvZ2luXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9nb29nbGVcIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL3ZlcmlmeS1lbWFpbFwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvcmVzZW5kLXZlcmlmaWNhdGlvblwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvZm9yZ290LXBhc3N3b3JkXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9yZXNldC1wYXNzd29yZFwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpXCIsIGFwaUxpbWl0ZXIpO1xyXG5cclxuLy8gUm9vdCByb3V0ZVxyXG5hcHAuZ2V0KFwiL1wiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgcmVzLnNlbmQoXCJXZWxjb21lIHRvIHRoZSBUcmlwVmVyc2UgQVBJIVwiKTtcclxufSk7XHJcblxyXG4vLyBIZWFsdGggY2hlY2sgXHUyMDE0IHJlYWwgREIgY29ubmVjdGl2aXR5IGNoZWNrLCBub3QgYSBzdGF0aWMgMjAwLlxyXG5hcHAuZ2V0KFwiL2hlYWx0aFwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUIDFgO1xyXG4gICAgcmVzLnN0YXR1cygyMDApLmpzb24oe1xyXG4gICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICBtZXNzYWdlOiBcIk9LXCIsXHJcbiAgICAgIGRiOiBcImNvbm5lY3RlZFwiLFxyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgIH0pO1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICByZXMuc3RhdHVzKDUwMykuanNvbih7XHJcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICBtZXNzYWdlOiBcIlNlcnZpY2UgdW5hdmFpbGFibGVcIixcclxuICAgICAgZGI6IFwiZGlzY29ubmVjdGVkXCIsXHJcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59KTtcclxuXHJcbi8vIFx1MjUwMFx1MjUwMCBGZWF0dXJlIHJvdXRlcyByZWdpc3RlciBoZXJlIGFzIGVhY2ggbW9kdWxlIGlzIGJ1aWx0IFx1MjUwMFx1MjUwMFxyXG5hcHAudXNlKFwiL2FwaS9hdXRoXCIsIGF1dGhSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS91c2Vyc1wiLCB1c2VyUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvdXBsb2Fkc1wiLCB1cGxvYWRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jb250YWN0XCIsIGNvbnRhY3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jYXRlZ29yaWVzXCIsIGNhdGVnb3J5Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvcGFja2FnZXNcIiwgcGFja2FnZVJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3Jldmlld3NcIiwgcmV2aWV3Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvYm9va2luZ3NcIiwgYm9va2luZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Jsb2dcIiwgYmxvZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Rhc2hib2FyZFwiLCBkYXNoYm9hcmRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9wYXltZW50c1wiLCBwYXltZW50Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvd2lzaGxpc3RcIiwgd2lzaGxpc3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9ub3RpZmljYXRpb25zXCIsIG5vdGlmaWNhdGlvblJvdXRlcyk7XHJcblxyXG5hcHAudXNlKG5vdEZvdW5kSGFuZGxlcik7XHJcbmFwcC51c2UoZ2xvYmFsRXJyb3JIYW5kbGVyKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGFwcDtcclxuIiwgImltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmRvdGVudi5jb25maWcoe1xuICBxdWlldDogdHJ1ZSxcbiAgcGF0aDogcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwiLmVudlwiKSxcbn0pO1xuXG4vLyBFdmVyeSBtb2R1bGUgcmVhZHMgY29uZmlnIHRocm91Z2ggdGhpcyB2YWxpZGF0ZWQgb2JqZWN0LCBuZXZlclxuLy8gcHJvY2Vzcy5lbnYgZGlyZWN0bHkgXHUyMDE0IGEgbWlzc2luZy9tYWxmb3JtZWQgdmFyIGZhaWxzIGxvdWRseSBhdCBib290XG4vLyBpbnN0ZWFkIG9mIHN1cmZhY2luZyBhcyBhIGNvbmZ1c2luZyBydW50aW1lIGVycm9yIG1pZC1yZXF1ZXN0LlxuY29uc3QgZW52U2NoZW1hID0gei5vYmplY3Qoe1xuICBQT1JUOiB6LnN0cmluZygpLmRlZmF1bHQoXCI0MDAwXCIpLFxuICBOT0RFX0VOVjogei5lbnVtKFtcImRldmVsb3BtZW50XCIsIFwicHJvZHVjdGlvblwiXSkuZGVmYXVsdChcImRldmVsb3BtZW50XCIpLFxuXG4gIC8vIEZyb250ZW5kIG9yaWdpbnMgZm9yIENPUlMgKyBwYXltZW50IHJlZGlyZWN0cy4gVGhlIGZyb250ZW5kIG1heSBub3QgYmVcbiAgLy8gZGVwbG95ZWQgeWV0IChvciBtYXkgYmUgcmVidWlsdCksIHNvIGJvdGggYXJlIG9wdGlvbmFsOiB0aGUgYmFja2VuZCBtdXN0XG4gIC8vIG5ldmVyIHJlZnVzZSB0byBib290IGp1c3QgYmVjYXVzZSBhIFVJIGhvc3QgaXNuJ3QgbGl2ZS4gUm91dGVzIHRoYXQgbmVlZCBhXG4gIC8vIHJlYWwgb3JpZ2luIChwYXltZW50IGNhbGxiYWNrIHJlZGlyZWN0cykgZmFsbCBiYWNrIHRvIHRoZSBiYWNrZW5kIFVSTC5cbiAgRlJPTlRFTkRfVVJMX0RFVjogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBGUk9OVEVORF9VUkxfUFJPRDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuXG4gIERBVEFCQVNFX1VSTDogei5zdHJpbmcoKS5taW4oMSwgXCJEQVRBQkFTRV9VUkwgaXMgcmVxdWlyZWRcIiksXG5cbiAgQkNSWVBUX1NBTFRfUk9VTkRTOiB6LnN0cmluZygpLmRlZmF1bHQoXCIxMFwiKSxcblxuICAvLyBPcHRpb25hbCBhZG1pbiBjcmVkZW50aWFscyB1c2VkIGJ5IHRoZSBzZWVkIHNjcmlwdCAoU3RlcCAxMykuIEZhbGxzIGJhY2tcbiAgLy8gdG8gZGVtby1hZG1pbkB0cmlwdmVyc2UuY29tIC8gZGVtbzEyMyB3aGVuIHVuc2V0LlxuICBBRE1JTl9FTUFJTDogei5zdHJpbmcoKS5lbWFpbCgpLm9wdGlvbmFsKCksXG4gIEFETUlOX1BBU1NXT1JEOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxuXG4gIC8vIFNTTENvbW1lcnogKFN0ZXAgMTYpIFx1MjAxNCBzYW5kYm94IHN0b3JlIGNyZWRzIHVudGlsIGdvLWxpdmUuIFNTTF9DT01NRVJaX1NBTkRCT1hcbiAgLy8gcGlja3MgdGhlIHNhbmRib3ggdnMgbGl2ZSBBUEkgYmFzZSBVUkwuIE9wdGlvbmFsIHNvIHRoZSBBUEkgYm9vdHMgKGhlYWx0aCxcbiAgLy8gYXV0aCwgY2F0YWxvZywgZXRjLikgZXZlbiB3aGVuIHRoZSBwYXltZW50IHN0b3JlIGlzbid0IGNvbmZpZ3VyZWQgeWV0IFx1MjAxNCB0aGVcbiAgLy8gcGF5bWVudCBlbmRwb2ludHMgdGhlbiBmYWlsIHdpdGggYSBjbGVhbiBcIm5vdCBjb25maWd1cmVkXCIgZXJyb3IgaW5zdGVhZCBvZlxuICAvLyB0YWtpbmcgdGhlIHdob2xlIGRlcGxveW1lbnQgZG93bi5cbiAgU1NMX0NPTU1FUlpfU1RPUkVfSUQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU1NMX0NPTU1FUlpfU0FOREJPWDogei5zdHJpbmcoKS5kZWZhdWx0KFwidHJ1ZVwiKSxcbiAgLy8gT3B0aW9uYWwgZXhwbGljaXQgZ2F0ZXdheS92YWxpZGF0b3IgYmFzZSBVUkxzIChHZWFyVXAgcGF0dGVybikuIERlZmF1bHRzIGFyZVxuICAvLyBkZXJpdmVkIGZyb20gU1NMX0NPTU1FUlpfU0FOREJPWCB3aGVuIGFic2VudC5cbiAgU1NMQ09NTUVSWl9JTklUX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBTU0xDT01NRVJaX1ZBTElEQVRFX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBTU0xDT01NRVJaX1JFRlVORF9VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICAvLyBQdWJsaWNseSByZWFjaGFibGUgYmFzZSBVUkwgdGhlIHBheW1lbnQgbW9kdWxlIHVzZXMgdG8gYnVpbGQgdGhlXG4gIC8vIFNTTENvbW1lcnogc3VjY2Vzcy9mYWlsL2NhbmNlbC9JUE4gY2FsbGJhY2sgVVJMcy4gTXVzdCBOT1QgYmUgbG9jYWxob3N0IGluXG4gIC8vIHNhbmRib3ggXHUyMDE0IHRoZSBnYXRld2F5IFBPU1RzIHRvIHRoZXNlIHNlcnZlci10by1zZXJ2ZXIuIE9wdGlvbmFsIGxpa2UgdGhlXG4gIC8vIHN0b3JlIGNyZWRzIGFib3ZlIChwYXltZW50LW9ubHkpLlxuICBCQUNLRU5EX1BVQkxJQ19VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICBKV1RfQUNDRVNTX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJKV1RfQUNDRVNTX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX1JFRlJFU0hfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkpXVF9SRUZSRVNIX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX0FDQ0VTU19FWFBJUkVTX0lOOiB6LnN0cmluZygpLmRlZmF1bHQoXCIxZFwiKSxcbiAgSldUX1JFRlJFU0hfRVhQSVJFU19JTjogei5zdHJpbmcoKS5kZWZhdWx0KFwiMzBkXCIpLFxuXG4gIC8vIEdvb2dsZSBPQXV0aCBpcyBvcHRpb25hbCBcdTIwMTQgc2VydmVyIGJvb3RzIHdpdGhvdXQgaXQ7IC9hcGkvYXV0aC9nb29nbGVcbiAgLy8gcmV0dXJucyBhIGNsZWFuIDQwMCB1bnRpbCBHT09HTEVfQ0xJRU5UX0lEIGlzIGNvbmZpZ3VyZWQuXG4gIEdPT0dMRV9DTElFTlRfSUQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcblxuICAvLyBCZXN0LWVmZm9ydCBjb250YWN0IGVtYWlscyAoUmVzZW5kKSBcdTIwMTQgYWx3YXlzIG9wdGlvbmFsOyBzdWJtaXNzaW9uc1xuICAvLyBzdWNjZWVkIGFuZCBlbWFpbHMgYmVjb21lIG5vLW9wcyB3aGVuIHRoZXNlIGFyZSBtaXNzaW5nLlxuICBSRVNFTkRfQVBJX0tFWTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBDT05UQUNUX1JFQ0VJVkVSX0VNQUlMOiB6LnN0cmluZygpLmVtYWlsKCkub3B0aW9uYWwoKSxcbiAgRU1BSUxfRlJPTTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIC8vIEVtYWlsIHZlcmlmaWNhdGlvbiArIHBhc3N3b3JkIHJlc2V0IChTdGVwIDIxKSBcdTIwMTQgUmVkaXMgT1RQIHN0b3JlICsgTm9kZW1haWxlci5cbiAgLy8gQWxsIG9wdGlvbmFsIHNvIHRoZSBhcHAgYm9vdHMgd2l0aG91dCB0aGVtIChlLmcuIFZlcmNlbCBwcm9kKTsgdGhlIGF1dGhcbiAgLy8gZW5kcG9pbnRzIHRoZW4gcmVzcG9uZCB3aXRoIGEgY2xlYW4gNTAzIFwibm90IGNvbmZpZ3VyZWRcIiBpbnN0ZWFkIG9mIGNyYXNoaW5nLlxuICBSRURJU19VU0VSOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFJFRElTX1BBU1NXT1JEOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFJFRElTX0hPU1Q6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgUkVESVNfUE9SVDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTTVRQX1VTRVI6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU01UUF9QQVNTV09SRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIENMT1VESU5BUllfQ0xPVURfTkFNRTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0NMT1VEX05BTUUgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX0tFWTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9LRVkgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9TRUNSRVQgaXMgcmVxdWlyZWRcIiksXG59KTtcblxuY29uc3QgcGFyc2VkID0gZW52U2NoZW1hLnNhZmVQYXJzZShwcm9jZXNzLmVudik7XG5cbmlmICghcGFyc2VkLnN1Y2Nlc3MpIHtcbiAgY29uc29sZS5lcnJvcihcIlx1Mjc0QyBJbnZhbGlkIGVudmlyb25tZW50IHZhcmlhYmxlczpcIik7XG4gIGNvbnNvbGUuZXJyb3IocGFyc2VkLmVycm9yLmZsYXR0ZW4oKS5maWVsZEVycm9ycyk7XG4gIHByb2Nlc3MuZXhpdCgxKTtcbn1cblxuY29uc3QgZW52ID0gcGFyc2VkLmRhdGE7XG5cbmNvbnN0IGNvbmZpZyA9IHtcbiAgcG9ydDogZW52LlBPUlQsXG4gIG5vZGVfZW52OiBlbnYuTk9ERV9FTlYsXG5cbiAgLy8gRnJvbnRlbmQgb3JpZ2lucyBmb3IgQ09SUyArIHBheW1lbnQgcmVkaXJlY3RzLiBMb2NhbGhvc3QgYWx3YXlzIHdpbnMgZm9yXG4gIC8vIGxvY2FsIHRlc3Rpbmc7IHByb2R1Y3Rpb24gdXNlcyB0aGUgVmVyY2VsIGZyb250ZW5kIFVSTCwgZmFsbGluZyBiYWNrIHRvIHRoZVxuICAvLyBiYWNrZW5kIFVSTCBzbyB0aGUgQVBJIHN0YXlzIHJlYWNoYWJsZSBldmVuIGJlZm9yZSB0aGUgVUkgaXMgZGVwbG95ZWQuXG4gIGZyb250ZW5kX3VybF9kZXY6IGVudi5GUk9OVEVORF9VUkxfREVWIHx8IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gIGZyb250ZW5kX3VybF9wcm9kOlxuICAgIGVudi5GUk9OVEVORF9VUkxfUFJPRCB8fCBlbnYuQkFDS0VORF9QVUJMSUNfVVJMIHx8IFwiXCIsXG5cbiAgZGF0YWJhc2VfdXJsOiBlbnYuREFUQUJBU0VfVVJMLFxuXG4gIGJjcnlwdF9zYWx0X3JvdW5kczogZW52LkJDUllQVF9TQUxUX1JPVU5EUyxcblxuICBhZG1pbl9lbWFpbDogZW52LkFETUlOX0VNQUlMLFxuICBhZG1pbl9wYXNzd29yZDogZW52LkFETUlOX1BBU1NXT1JELFxuXG4gIHNzbF9jb21tZXJ6X3N0b3JlX2lkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfSUQsXG4gIHNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQsXG4gIHNzbF9jb21tZXJ6X3NhbmRib3g6IGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIixcbiAgLy8gc2FuZGJveCBiYXNlIFVSTHMgKGZhbGxiYWNrIHdoZW4gdGhlIGV4cGxpY2l0IG92ZXJyaWRlIHZhcnMgYXJlIGFic2VudClcbiAgc3NsY29tbWVyel9pbml0X3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9JTklUX1VSTCA/P1xuICAgIChlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCJcbiAgICAgID8gXCJodHRwczovL3NhbmRib3guc3NsY29tbWVyei5jb20vZ3dwcm9jZXNzL3Y0L2FwaS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL2d3cHJvY2Vzcy92NC9hcGkucGhwXCIpLFxuICBzc2xjb21tZXJ6X3ZhbGlkYXRlX3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9WQUxJREFURV9VUkwgPz9cbiAgICAoZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiXG4gICAgICA/IFwiaHR0cHM6Ly9zYW5kYm94LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIiksXG4gIHNzbGNvbW1lcnpfcmVmdW5kX3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9SRUZVTkRfVVJMID8/XG4gICAgKGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIlxuICAgICAgPyBcImh0dHBzOi8vc2FuZGJveC5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL21lcmNoYW50VHJhbnNJRHZhbGlkYXRpb25BUEkucGhwXCJcbiAgICAgIDogXCJodHRwczovL3NlY3VyZXBheS5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL21lcmNoYW50VHJhbnNJRHZhbGlkYXRpb25BUEkucGhwXCIpLFxuICBiYWNrZW5kX3B1YmxpY191cmw6IGVudi5CQUNLRU5EX1BVQkxJQ19VUkwsXG5cbiAgand0X2FjY2Vzc19zZWNyZXQ6IGVudi5KV1RfQUNDRVNTX1NFQ1JFVCxcbiAgand0X3JlZnJlc2hfc2VjcmV0OiBlbnYuSldUX1JFRlJFU0hfU0VDUkVULFxuICBqd3RfYWNjZXNzX2V4cGlyZXNfaW46IGVudi5KV1RfQUNDRVNTX0VYUElSRVNfSU4sXG4gIGp3dF9yZWZyZXNoX2V4cGlyZXNfaW46IGVudi5KV1RfUkVGUkVTSF9FWFBJUkVTX0lOLFxuXG4gIGdvb2dsZV9jbGllbnRfaWQ6IGVudi5HT09HTEVfQ0xJRU5UX0lELFxuXG4gIHJlc2VuZF9hcGlfa2V5OiBlbnYuUkVTRU5EX0FQSV9LRVksXG4gIGNvbnRhY3RfcmVjZWl2ZXJfZW1haWw6IGVudi5DT05UQUNUX1JFQ0VJVkVSX0VNQUlMLFxuICBlbWFpbF9mcm9tOiBlbnYuRU1BSUxfRlJPTSxcblxuICAvLyBFbWFpbCB2ZXJpZmljYXRpb24gKyBwYXNzd29yZCByZXNldCAoU3RlcCAyMSlcbiAgcmVkaXNfdXNlcjogZW52LlJFRElTX1VTRVIsXG4gIHJlZGlzX3Bhc3N3b3JkOiBlbnYuUkVESVNfUEFTU1dPUkQsXG4gIHJlZGlzX2hvc3Q6IGVudi5SRURJU19IT1NULFxuICByZWRpc19wb3J0OiBlbnYuUkVESVNfUE9SVCxcbiAgc210cF91c2VyOiBlbnYuU01UUF9VU0VSLFxuICBzbXRwX3Bhc3N3b3JkOiBlbnYuU01UUF9QQVNTV09SRCxcblxuICBjbG91ZGluYXJ5X2Nsb3VkX25hbWU6IGVudi5DTE9VRElOQVJZX0NMT1VEX05BTUUsXG4gIGNsb3VkaW5hcnlfYXBpX2tleTogZW52LkNMT1VESU5BUllfQVBJX0tFWSxcbiAgY2xvdWRpbmFyeV9hcGlfc2VjcmV0OiBlbnYuQ0xPVURJTkFSWV9BUElfU0VDUkVULFxufTtcblxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgImltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuY29uc3Qgbm90Rm91bmRIYW5kbGVyID0gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkgPT4ge1xuICByZXMuc3RhdHVzKDQwNCkuanNvbih7XG4gICAgc3VjY2VzczogZmFsc2UsXG4gICAgc3RhdHVzQ29kZTogNDA0LFxuICAgIG1lc3NhZ2U6IFwiUm91dGUgbm90IGZvdW5kXCIsXG4gICAgcGF0aDogcmVxLm9yaWdpbmFsVXJsLFxuICAgIGRhdGU6IG5ldyBEYXRlKCksXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgbm90Rm91bmRIYW5kbGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgbXVsdGVyIGZyb20gXCJtdWx0ZXJcIjtcbmltcG9ydCB7IFpvZEVycm9yIH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbmNvbnN0IGdsb2JhbEVycm9ySGFuZGxlciA9IChcbiAgZXJyOiBhbnksXG4gIHJlcTogUmVxdWVzdCxcbiAgcmVzOiBSZXNwb25zZSxcbiAgbmV4dDogTmV4dEZ1bmN0aW9uLFxuKSA9PiB7XG4gIGlmIChjb25maWcubm9kZV9lbnYgIT09IFwicHJvZHVjdGlvblwiKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yOlwiLCBlcnIpO1xuICB9XG5cbiAgLy8gZGVmYXVsdCBmYWxsYmFja1xuICBsZXQgc3RhdHVzQ29kZTogbnVtYmVyID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gIGxldCBlcnJvck1lc3NhZ2U6IHN0cmluZyA9IGVycj8ubWVzc2FnZSB8fCBcIkludGVybmFsIFNlcnZlciBFcnJvclwiO1xuICBsZXQgZXJyb3JOYW1lOiBzdHJpbmcgPSBlcnI/Lm5hbWUgfHwgXCJFcnJvclwiO1xuXG4gIC8vIFpvZCB2YWxpZGF0aW9uIGVycm9yXG4gIGlmIChlcnIgaW5zdGFuY2VvZiBab2RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5pc3N1ZXMubWFwKChpKSA9PiBpLm1lc3NhZ2UpLmpvaW4oXCIsIFwiKTtcbiAgICBlcnJvck5hbWUgPSBcIlpvZEVycm9yXCI7XG4gIH1cblxuICAvLyBNdWx0ZXIgZmlsZSB1cGxvYWQgZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgbXVsdGVyLk11bHRlckVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JOYW1lID0gXCJNdWx0ZXJFcnJvclwiO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBlcnIuY29kZSA9PT0gXCJMSU1JVF9GSUxFX1NJWkVcIlxuICAgICAgICA/IFwiRmlsZSB0b28gbGFyZ2UuIE1heGltdW0gc2l6ZSBpcyA1TUIuXCJcbiAgICAgICAgOiBgVXBsb2FkIGZhaWxlZDogJHtlcnIuY29kZX1gO1xuICB9XG5cbiAgLy8gQ3VzdG9tIGZpbGUgdHlwZSByZWplY3Rpb24gZnJvbSB0aGUgbXVsdGVyIGZpbGVGaWx0ZXJcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgKGVyciBhcyBhbnkpLmNvZGUgPT09IFwiSU5WQUxJRF9GSUxFX1RZUEVcIikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICB9XG5cbiAgLy8gUHJpc21hIHZhbGlkYXRpb24gZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBcIllvdSBoYXZlIHByb3ZpZGVkIGluY29ycmVjdCBmaWVsZCB0eXBlIG9yIG1pc3NpbmcgcmVxdWlyZWQgZmllbGRzXCI7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3JcIjtcbiAgfVxuXG4gIC8vIFByaXNtYSBrbm93biBlcnJvcnNcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yKSB7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclwiO1xuXG4gICAgaWYgKGVyci5jb2RlID09PSBcIlAyMDAyXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkNPTkZMSUNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJUaGlzIHZhbHVlIGFscmVhZHkgZXhpc3RzXCI7XG4gICAgfSBlbHNlIGlmIChlcnIuY29kZSA9PT0gXCJQMjAwM1wiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5DT05GTElDVDtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiRm9yZWlnbiBrZXkgY29uc3RyYWludCBmYWlsZWRcIjtcbiAgICB9IGVsc2UgaWYgKGVyci5jb2RlID09PSBcIlAyMDI1XCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLk5PVF9GT1VORDtcbiAgICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICAgIFwiQW4gb3BlcmF0aW9uIGZhaWxlZCBiZWNhdXNlIG9uZSBvciBtb3JlIHJlcXVpcmVkIHJlY29yZHMgd2VyZSBub3QgZm91bmQuXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIERCIGNvbm5lY3Rpb24vaW5pdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvcikge1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclwiO1xuXG4gICAgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDBcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuVU5BVVRIT1JJWkVEO1xuICAgICAgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgXCJBdXRoZW50aWNhdGlvbiBmYWlsZWQgYWdhaW5zdCB0aGUgZGF0YWJhc2Ugc2VydmVyLiBQbGVhc2UgY2hlY2sgeW91ciBkYXRhYmFzZSBjcmVkZW50aWFscy5cIjtcbiAgICB9IGVsc2UgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDFcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuU0VSVklDRV9VTkFWQUlMQUJMRTtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiQ2FuJ3QgcmVhY2ggdGhlIGRhdGFiYXNlIHNlcnZlci5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIHVua25vd24gcmVxdWVzdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3JcIjtcbiAgICBlcnJvck1lc3NhZ2UgPSBcIkVycm9yIG9jY3VycmVkIGR1cmluZyBxdWVyeSBleGVjdXRpb25cIjtcbiAgfVxuXG4gIC8vIFlvdXIgY3VzdG9tIEFwcEVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEFwcEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGVyci5zdGF0dXNDb2RlO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIGVycm9yTmFtZSA9IGVyci5uYW1lIHx8IFwiQXBwRXJyb3JcIjtcbiAgfVxuXG4gIC8vIEZhbGxiYWNrIGZvciBvdGhlciB0aHJvd24gZXJyb3JzXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCI7XG4gICAgZXJyb3JOYW1lID0gZXJyLm5hbWUgfHwgXCJFcnJvclwiO1xuICB9XG5cbiAgcmVzLnN0YXR1cyhzdGF0dXNDb2RlKS5qc29uKHtcbiAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICBzdGF0dXNDb2RlLFxuICAgIG5hbWU6IGVycm9yTmFtZSxcbiAgICBtZXNzYWdlOiBlcnJvck1lc3NhZ2UsXG4gICAgZXJyb3I6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcImRldmVsb3BtZW50XCIgPyBlcnIuc3RhY2sgOiB1bmRlZmluZWQsXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZ2xvYmFsRXJyb3JIYW5kbGVyO1xuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogVGhpcyBmaWxlIHNob3VsZCBiZSB5b3VyIG1haW4gaW1wb3J0IHRvIHVzZSBQcmlzbWEuIFRocm91Z2ggaXQgeW91IGdldCBhY2Nlc3MgdG8gYWxsIHRoZSBtb2RlbHMsIGVudW1zLCBhbmQgaW5wdXQgdHlwZXMuXG4gKiBJZiB5b3UncmUgbG9va2luZyBmb3Igc29tZXRoaW5nIHlvdSBjYW4gaW1wb3J0IGluIHRoZSBjbGllbnQtc2lkZSBvZiB5b3VyIGFwcGxpY2F0aW9uLCBwbGVhc2UgcmVmZXIgdG8gdGhlIGBicm93c2VyLnRzYCBmaWxlIGluc3RlYWQuXG4gKlxuICogXHVEODNEXHVERkUyIFlvdSBjYW4gaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseS5cbiAqL1xuXG5pbXBvcnQgKiBhcyBwcm9jZXNzIGZyb20gJ25vZGU6cHJvY2VzcydcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJ1xuZ2xvYmFsVGhpc1snX19kaXJuYW1lJ10gPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKVxuXG5pbXBvcnQgKiBhcyBydW50aW1lIGZyb20gXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL2NsaWVudFwiXG5pbXBvcnQgKiBhcyAkRW51bXMgZnJvbSBcIi4vZW51bXNcIlxuaW1wb3J0ICogYXMgJENsYXNzIGZyb20gXCIuL2ludGVybmFsL2NsYXNzXCJcbmltcG9ydCAqIGFzIFByaXNtYSBmcm9tIFwiLi9pbnRlcm5hbC9wcmlzbWFOYW1lc3BhY2VcIlxuXG5leHBvcnQgKiBhcyAkRW51bXMgZnJvbSAnLi9lbnVtcydcbmV4cG9ydCAqIGZyb20gXCIuL2VudW1zXCJcbi8qKlxuICogIyMgUHJpc21hIENsaWVudFxuICogXG4gKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gKiB9KVxuICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dDb21tZW50c1xuICogY29uc3QgYmxvZ0NvbW1lbnRzID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KClcbiAqIGBgYFxuICogXG4gKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICovXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50ID0gJENsYXNzLmdldFByaXNtYUNsaWVudENsYXNzKClcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudDxMb2dPcHRzIGV4dGVuZHMgUHJpc21hLkxvZ0xldmVsID0gbmV2ZXIsIE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdLCBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncz4gPSAkQ2xhc3MuUHJpc21hQ2xpZW50PExvZ09wdHMsIE9taXRPcHRzLCBFeHRBcmdzPlxuZXhwb3J0IHsgUHJpc21hIH1cblxuLyoqXG4gKiBNb2RlbCBCbG9nQ29tbWVudFxuICogXG4gKi9cbmV4cG9ydCB0eXBlIEJsb2dDb21tZW50ID0gUHJpc21hLkJsb2dDb21tZW50TW9kZWxcbi8qKlxuICogTW9kZWwgQmxvZ1Bvc3RcbiAqIFxuICovXG5leHBvcnQgdHlwZSBCbG9nUG9zdCA9IFByaXNtYS5CbG9nUG9zdE1vZGVsXG4vKipcbiAqIE1vZGVsIEJvb2tpbmdcbiAqIFxuICovXG5leHBvcnQgdHlwZSBCb29raW5nID0gUHJpc21hLkJvb2tpbmdNb2RlbFxuLyoqXG4gKiBNb2RlbCBDYXRlZ29yeVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIENhdGVnb3J5ID0gUHJpc21hLkNhdGVnb3J5TW9kZWxcbi8qKlxuICogTW9kZWwgQ29udGFjdE1lc3NhZ2VcbiAqIFxuICovXG5leHBvcnQgdHlwZSBDb250YWN0TWVzc2FnZSA9IFByaXNtYS5Db250YWN0TWVzc2FnZU1vZGVsXG4vKipcbiAqIE1vZGVsIE5vdGlmaWNhdGlvblxuICogXG4gKi9cbmV4cG9ydCB0eXBlIE5vdGlmaWNhdGlvbiA9IFByaXNtYS5Ob3RpZmljYXRpb25Nb2RlbFxuLyoqXG4gKiBNb2RlbCBQYXltZW50XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUGF5bWVudCA9IFByaXNtYS5QYXltZW50TW9kZWxcbi8qKlxuICogTW9kZWwgUmVmcmVzaFRva2VuXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUmVmcmVzaFRva2VuID0gUHJpc21hLlJlZnJlc2hUb2tlbk1vZGVsXG4vKipcbiAqIE1vZGVsIFJldmlld1xuICogXG4gKi9cbmV4cG9ydCB0eXBlIFJldmlldyA9IFByaXNtYS5SZXZpZXdNb2RlbFxuLyoqXG4gKiBNb2RlbCBUb3VyUGFja2FnZVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFRvdXJQYWNrYWdlID0gUHJpc21hLlRvdXJQYWNrYWdlTW9kZWxcbi8qKlxuICogTW9kZWwgVXNlclxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFVzZXIgPSBQcmlzbWEuVXNlck1vZGVsXG4vKipcbiAqIE1vZGVsIFdpc2hsaXN0SXRlbVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFdpc2hsaXN0SXRlbSA9IFByaXNtYS5XaXNobGlzdEl0ZW1Nb2RlbFxuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogV0FSTklORzogVGhpcyBpcyBhbiBpbnRlcm5hbCBmaWxlIHRoYXQgaXMgc3ViamVjdCB0byBjaGFuZ2UhXG4gKlxuICogXHVEODNEXHVERUQxIFVuZGVyIG5vIGNpcmN1bXN0YW5jZXMgc2hvdWxkIHlvdSBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5ISBcdUQ4M0RcdURFRDFcbiAqXG4gKiBQbGVhc2UgaW1wb3J0IHRoZSBgUHJpc21hQ2xpZW50YCBjbGFzcyBmcm9tIHRoZSBgY2xpZW50LnRzYCBmaWxlIGluc3RlYWQuXG4gKi9cblxuaW1wb3J0ICogYXMgcnVudGltZSBmcm9tIFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9jbGllbnRcIlxuaW1wb3J0IHR5cGUgKiBhcyBQcmlzbWEgZnJvbSBcIi4vcHJpc21hTmFtZXNwYWNlXCJcblxuXG5jb25zdCBjb25maWc6IHJ1bnRpbWUuR2V0UHJpc21hQ2xpZW50Q29uZmlnID0ge1xuICBcInByZXZpZXdGZWF0dXJlc1wiOiBbXSxcbiAgXCJjbGllbnRWZXJzaW9uXCI6IFwiNy45LjFcIixcbiAgXCJlbmdpbmVWZXJzaW9uXCI6IFwiZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFwiLFxuICBcImFjdGl2ZVByb3ZpZGVyXCI6IFwicG9zdGdyZXNxbFwiLFxuICBcImlubGluZVNjaGVtYVwiOiBcIm1vZGVsIEJsb2dDb21tZW50IHtcXG4gIGlkICAgICAgICBTdHJpbmcgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBjb250ZW50ICAgU3RyaW5nICBAZGIuVGV4dFxcbiAgaXNEZWxldGVkIEJvb2xlYW4gQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBwb3N0SWQgICBTdHJpbmdcXG4gIHVzZXJJZCAgIFN0cmluZ1xcbiAgcGFyZW50SWQgU3RyaW5nP1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBvc3QgICAgQmxvZ1Bvc3QgICAgICBAcmVsYXRpb24oXFxcIlBvc3RDb21tZW50c1xcXCIsIGZpZWxkczogW3Bvc3RJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICB1c2VyICAgIFVzZXIgICAgICAgICAgQHJlbGF0aW9uKFxcXCJVc2VyQ29tbWVudHNcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFyZW50ICBCbG9nQ29tbWVudD8gIEByZWxhdGlvbihcXFwiQ29tbWVudFJlcGxpZXNcXFwiLCBmaWVsZHM6IFtwYXJlbnRJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICByZXBsaWVzIEJsb2dDb21tZW50W10gQHJlbGF0aW9uKFxcXCJDb21tZW50UmVwbGllc1xcXCIpXFxuXFxuICBAQGluZGV4KFtwb3N0SWQsIGlzRGVsZXRlZCwgY3JlYXRlZEF0XSlcXG4gIEBAaW5kZXgoW3BhcmVudElkXSlcXG4gIEBAbWFwKFxcXCJibG9nX2NvbW1lbnRzXFxcIilcXG59XFxuXFxubW9kZWwgQmxvZ1Bvc3Qge1xcbiAgaWQgICAgICAgICBTdHJpbmcgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0aXRsZSAgICAgIFN0cmluZ1xcbiAgc2x1ZyAgICAgICBTdHJpbmcgICAgIEB1bmlxdWVcXG4gIGV4Y2VycHQgICAgU3RyaW5nXFxuICBjb250ZW50ICAgIFN0cmluZ1xcbiAgY292ZXJJbWFnZSBTdHJpbmdcXG4gIHN0YXR1cyAgICAgUG9zdFN0YXR1cyBAZGVmYXVsdChEUkFGVClcXG4gIGlzRGVsZXRlZCAgQm9vbGVhbiAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGF1dGhvcklkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGF1dGhvciAgIFVzZXIgICAgICAgICAgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIsIGZpZWxkczogW2F1dGhvcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGNvbW1lbnRzIEJsb2dDb21tZW50W10gQHJlbGF0aW9uKFxcXCJQb3N0Q29tbWVudHNcXFwiKVxcblxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAaW5kZXgoW2F1dGhvcklkXSlcXG4gIEBAbWFwKFxcXCJibG9nX3Bvc3RzXFxcIilcXG59XFxuXFxubW9kZWwgQm9va2luZyB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRyYXZlbERhdGUgRGF0ZVRpbWVcXG4gIHRyYXZlbGVycyAgSW50XFxuICB0b3RhbFByaWNlIERlY2ltYWwgICAgICAgQGRiLkRlY2ltYWwoMTAsIDIpXFxuICBzdGF0dXMgICAgIEJvb2tpbmdTdGF0dXMgQGRlZmF1bHQoUEVORElORylcXG5cXG4gIHVzZXJJZCAgICBTdHJpbmdcXG4gIHBhY2thZ2VJZCBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICB1c2VyICAgICBVc2VyICAgICAgICBAcmVsYXRpb24oXFxcIkN1c3RvbWVyQm9va2luZ3NcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSAgVG91clBhY2thZ2UgQHJlbGF0aW9uKGZpZWxkczogW3BhY2thZ2VJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYXltZW50cyBQYXltZW50W11cXG5cXG4gIEBAaW5kZXgoW3VzZXJJZF0pXFxuICBAQGluZGV4KFtwYWNrYWdlSWRdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAaW5kZXgoW3VzZXJJZCwgcGFja2FnZUlkLCB0cmF2ZWxEYXRlXSlcXG4gIEBAbWFwKFxcXCJib29raW5nc1xcXCIpXFxufVxcblxcbm1vZGVsIENhdGVnb3J5IHtcXG4gIGlkICAgU3RyaW5nIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lIFN0cmluZyBAdW5pcXVlXFxuICBzbHVnIFN0cmluZyBAdW5pcXVlXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgcGFja2FnZXMgVG91clBhY2thZ2VbXVxcblxcbiAgQEBtYXAoXFxcImNhdGVnb3JpZXNcXFwiKVxcbn1cXG5cXG5tb2RlbCBDb250YWN0TWVzc2FnZSB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIG5hbWUgICAgICAgU3RyaW5nXFxuICBlbWFpbCAgICAgIFN0cmluZ1xcbiAgc3ViamVjdCAgICBTdHJpbmdcXG4gIG1lc3NhZ2UgICAgU3RyaW5nXFxuICBpc1Jlc29sdmVkIEJvb2xlYW4gQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgQEBpbmRleChbaXNSZXNvbHZlZF0pXFxuICBAQG1hcChcXFwiY29udGFjdF9tZXNzYWdlc1xcXCIpXFxufVxcblxcbmVudW0gUm9sZSB7XFxuICBVU0VSXFxuICBBR0VOVFxcbiAgQURNSU5cXG59XFxuXFxuZW51bSBVc2VyU3RhdHVzIHtcXG4gIEFDVElWRVxcbiAgU1VTUEVOREVEXFxufVxcblxcbmVudW0gQXV0aFByb3ZpZGVyIHtcXG4gIENSRURFTlRJQUxcXG4gIEdPT0dMRVxcbn1cXG5cXG5lbnVtIFBhY2thZ2VTdGF0dXMge1xcbiAgUEVORElOR1xcbiAgQVBQUk9WRURcXG4gIFJFSkVDVEVEXFxufVxcblxcbmVudW0gQm9va2luZ1N0YXR1cyB7XFxuICBQRU5ESU5HXFxuICBQQUlEXFxuICBDT05GSVJNRURcXG4gIENBTkNFTExFRFxcbiAgQ09NUExFVEVEXFxufVxcblxcbmVudW0gUGF5bWVudFN0YXR1cyB7XFxuICBJTklUSUFURURcXG4gIFNVQ0NFU1NcXG4gIEZBSUxFRFxcbiAgQ0FOQ0VMTEVEXFxuICBSRUZVTkRFRFxcbn1cXG5cXG5lbnVtIFBvc3RTdGF0dXMge1xcbiAgRFJBRlRcXG4gIFBVQkxJU0hFRFxcbn1cXG5cXG5lbnVtIE5vdGlmaWNhdGlvblR5cGUge1xcbiAgQk9PS0lOR19DUkVBVEVEXFxuICBCT09LSU5HX0NPTkZJUk1FRFxcbiAgQk9PS0lOR19DQU5DRUxMRURcXG4gIFBBQ0tBR0VfQVBQUk9WRURcXG4gIFBBQ0tBR0VfUkVKRUNURURcXG59XFxuXFxubW9kZWwgTm90aWZpY2F0aW9uIHtcXG4gIGlkICAgICAgU3RyaW5nICAgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdXNlcklkICBTdHJpbmdcXG4gIHR5cGUgICAgTm90aWZpY2F0aW9uVHlwZVxcbiAgdGl0bGUgICBTdHJpbmdcXG4gIG1lc3NhZ2UgU3RyaW5nXFxuICBsaW5rICAgIFN0cmluZz9cXG4gIGlzUmVhZCAgQm9vbGVhbiAgICAgICAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG5cXG4gIHVzZXIgVXNlciBAcmVsYXRpb24oZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW3VzZXJJZCwgaXNSZWFkLCBjcmVhdGVkQXRdKVxcbiAgQEBtYXAoXFxcIm5vdGlmaWNhdGlvbnNcXFwiKVxcbn1cXG5cXG5tb2RlbCBQYXltZW50IHtcXG4gIGlkICAgICAgICAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIGJvb2tpbmdJZCAgICAgICAgIFN0cmluZ1xcbiAgdHJhbklkICAgICAgICAgICAgU3RyaW5nICAgICAgICBAdW5pcXVlIC8vIFNTTENvbW1lcnogdHJhbnNhY3Rpb24gaWQsIGdlbmVyYXRlZCBzZXJ2ZXItc2lkZVxcbiAgdmFsSWQgICAgICAgICAgICAgU3RyaW5nPyAvLyBzZXQgYWZ0ZXIgZ2F0ZXdheSBzdWNjZXNzLCB1c2VkIGZvciBzZXJ2ZXItc2lkZSB2YWxpZGF0aW9uXFxuICBhbW91bnQgICAgICAgICAgICBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKSAvLyA9IGJvb2tpbmcudG90YWxQcmljZSBhdCBzZXNzaW9uIGNyZWF0aW9uXFxuICBjdXJyZW5jeSAgICAgICAgICBTdHJpbmcgICAgICAgIEBkZWZhdWx0KFxcXCJCRFRcXFwiKVxcbiAgc3RhdHVzICAgICAgICAgICAgUGF5bWVudFN0YXR1cyBAZGVmYXVsdChJTklUSUFURUQpXFxuICBnYXRld2F5UGFnZVVybCAgICBTdHJpbmc/XFxuICBzc2xTZXNzaW9uS2V5ICAgICBTdHJpbmc/XFxuICBjYXJkVHlwZSAgICAgICAgICBTdHJpbmc/XFxuICBiYW5rVHJhbklkICAgICAgICBTdHJpbmc/XFxuICBwYWlkQXQgICAgICAgICAgICBEYXRlVGltZT9cXG4gIHJlZnVuZFJlZklkICAgICAgIFN0cmluZz8gLy8gU1NMQ29tbWVyeiByZWZ1bmQgcmVmZXJlbmNlIChzZXQgd2hlbiBhIHJlZnVuZCBpcyBpbml0aWF0ZWQpXFxuICByZWZ1bmRJbml0aWF0ZWRBdCBEYXRlVGltZT8gLy8gc2V0IHdoZW4gYSByZWZ1bmQgYXR0ZW1wdCBzdGFydHMvZmFpbHMgKGZvciBsYXRlciByZXRyeSlcXG4gIHJlZnVuZENvbXBsZXRlZEF0IERhdGVUaW1lPyAvLyBzZXQgb25seSB3aGVuIHRoZSBnYXRld2F5IGNvbmZpcm1zIHRoZSByZWZ1bmQgc3VjY2VlZGVkXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgYm9va2luZyBCb29raW5nIEByZWxhdGlvbihmaWVsZHM6IFtib29raW5nSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcblxcbiAgQEBpbmRleChbYm9va2luZ0lkXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQG1hcChcXFwicGF5bWVudHNcXFwiKVxcbn1cXG5cXG5tb2RlbCBSZWZyZXNoVG9rZW4ge1xcbiAgaWQgICAgICAgIFN0cmluZyAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdXNlcklkICAgIFN0cmluZ1xcbiAgaGFzaCAgICAgIFN0cmluZyAgICBAdW5pcXVlIC8vIFNIQS0yNTYgb2YgdGhlIHJlZnJlc2ggSldUIFx1MjAxNCBuZXZlciBzdG9yZSB0aGUgSldUIGl0c2VsZlxcbiAgZXhwaXJlc0F0IERhdGVUaW1lXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgIEBkZWZhdWx0KG5vdygpKVxcbiAgcmV2b2tlZEF0IERhdGVUaW1lPyAvLyBzZXQgd2hlbiByb3RhdGVkIG9yIGxvZ2dlZCBvdXRcXG5cXG4gIHVzZXIgVXNlciBAcmVsYXRpb24oZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW3VzZXJJZCwgcmV2b2tlZEF0XSlcXG4gIEBAbWFwKFxcXCJyZWZyZXNoX3Rva2Vuc1xcXCIpXFxufVxcblxcbm1vZGVsIFJldmlldyB7XFxuICBpZCAgICAgICAgU3RyaW5nICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgcmF0aW5nICAgIEludFxcbiAgY29tbWVudCAgIFN0cmluZ1xcbiAgaXNEZWxldGVkIEJvb2xlYW4gQGRlZmF1bHQoZmFsc2UpXFxuXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgdXNlciAgICBVc2VyICAgICAgICBAcmVsYXRpb24oXFxcIkN1c3RvbWVyUmV2aWV3c1xcXCIsIGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYWNrYWdlIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcblxcbiAgQEB1bmlxdWUoW3VzZXJJZCwgcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3BhY2thZ2VJZF0pXFxuICBAQG1hcChcXFwicmV2aWV3c1xcXCIpXFxufVxcblxcbi8vIFRoaXMgaXMgeW91ciBQcmlzbWEgc2NoZW1hIGZpbGUsXFxuLy8gbGVhcm4gbW9yZSBhYm91dCBpdCBpbiB0aGUgZG9jczogaHR0cHM6Ly9wcmlzLmx5L2QvcHJpc21hLXNjaGVtYVxcblxcbmdlbmVyYXRvciBjbGllbnQge1xcbiAgcHJvdmlkZXIgPSBcXFwicHJpc21hLWNsaWVudFxcXCJcXG4gIG91dHB1dCAgID0gXFxcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWFcXFwiXFxufVxcblxcbmRhdGFzb3VyY2UgZGIge1xcbiAgcHJvdmlkZXIgPSBcXFwicG9zdGdyZXNxbFxcXCJcXG59XFxuXFxubW9kZWwgVG91clBhY2thZ2Uge1xcbiAgaWQgICAgICAgICAgU3RyaW5nICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdGl0bGUgICAgICAgU3RyaW5nXFxuICBzbHVnICAgICAgICBTdHJpbmcgICAgICAgIEB1bmlxdWVcXG4gIGRlc2NyaXB0aW9uIFN0cmluZ1xcbiAgbG9jYXRpb24gICAgU3RyaW5nXFxuICBwcmljZSAgICAgICBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKVxcbiAgZHVyYXRpb24gICAgSW50XFxuICByYXRpbmcgICAgICBGbG9hdCAgICAgICAgIEBkZWZhdWx0KDApXFxuICBpbWFnZXMgICAgICBTdHJpbmdbXVxcbiAgc3RhdHVzICAgICAgUGFja2FnZVN0YXR1cyBAZGVmYXVsdChQRU5ESU5HKVxcbiAgaXNEZWxldGVkICAgQm9vbGVhbiAgICAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGNhdGVnb3J5SWQgU3RyaW5nXFxuICBhZ2VudElkICAgIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGNhdGVnb3J5ICAgICAgQ2F0ZWdvcnkgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW2NhdGVnb3J5SWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgYWdlbnQgICAgICAgICBVc2VyICAgICAgICAgICBAcmVsYXRpb24oXFxcIkFnZW50UGFja2FnZXNcXFwiLCBmaWVsZHM6IFthZ2VudElkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGJvb2tpbmdzICAgICAgQm9va2luZ1tdXFxuICByZXZpZXdzICAgICAgIFJldmlld1tdXFxuICB3aXNobGlzdEl0ZW1zIFdpc2hsaXN0SXRlbVtdXFxuXFxuICBAQGluZGV4KFtjYXRlZ29yeUlkXSlcXG4gIEBAaW5kZXgoW2NhdGVnb3J5SWQsIHByaWNlXSlcXG4gIEBAaW5kZXgoW3ByaWNlXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQG1hcChcXFwidG91cl9wYWNrYWdlc1xcXCIpXFxufVxcblxcbm1vZGVsIFVzZXIge1xcbiAgaWQgICAgICAgICAgICBTdHJpbmcgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIG5hbWUgICAgICAgICAgU3RyaW5nXFxuICBlbWFpbCAgICAgICAgIFN0cmluZyAgICAgICBAdW5pcXVlXFxuICBwYXNzd29yZCAgICAgIFN0cmluZz9cXG4gIGdvb2dsZUlkICAgICAgU3RyaW5nPyAgICAgIEB1bmlxdWVcXG4gIHBob25lICAgICAgICAgU3RyaW5nP1xcbiAgYXZhdGFyVXJsICAgICBTdHJpbmc/XFxuICByb2xlICAgICAgICAgIFJvbGUgICAgICAgICBAZGVmYXVsdChVU0VSKVxcbiAgc3RhdHVzICAgICAgICBVc2VyU3RhdHVzICAgQGRlZmF1bHQoQUNUSVZFKVxcbiAgYXV0aFByb3ZpZGVyICBBdXRoUHJvdmlkZXIgQGRlZmF1bHQoQ1JFREVOVElBTClcXG4gIGVtYWlsVmVyaWZpZWQgQm9vbGVhbiAgICAgIEBkZWZhdWx0KGZhbHNlKVxcbiAgaXNEZWxldGVkICAgICBCb29sZWFuICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuICB0b2tlblZlcnNpb24gIEludCAgICAgICAgICBAZGVmYXVsdCgwKVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBhY2thZ2VzICAgICAgVG91clBhY2thZ2VbXSAgQHJlbGF0aW9uKFxcXCJBZ2VudFBhY2thZ2VzXFxcIilcXG4gIGJvb2tpbmdzICAgICAgQm9va2luZ1tdICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lckJvb2tpbmdzXFxcIilcXG4gIHJldmlld3MgICAgICAgUmV2aWV3W10gICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lclJldmlld3NcXFwiKVxcbiAgcG9zdHMgICAgICAgICBCbG9nUG9zdFtdICAgICBAcmVsYXRpb24oXFxcIkF1dGhvclBvc3RzXFxcIilcXG4gIHdpc2hsaXN0ICAgICAgV2lzaGxpc3RJdGVtW11cXG4gIG5vdGlmaWNhdGlvbnMgTm90aWZpY2F0aW9uW11cXG4gIGNvbW1lbnRzICAgICAgQmxvZ0NvbW1lbnRbXSAgQHJlbGF0aW9uKFxcXCJVc2VyQ29tbWVudHNcXFwiKVxcbiAgcmVmcmVzaFRva2VucyBSZWZyZXNoVG9rZW5bXVxcblxcbiAgQEBpbmRleChbcm9sZV0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInVzZXJzXFxcIilcXG59XFxuXFxubW9kZWwgV2lzaGxpc3RJdGVtIHtcXG4gIGlkICAgICAgICBTdHJpbmcgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHVzZXJJZCAgICBTdHJpbmdcXG4gIHBhY2thZ2VJZCBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG5cXG4gIHVzZXIgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYWNrYWdlIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcblxcbiAgQEB1bmlxdWUoW3VzZXJJZCwgcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3VzZXJJZCwgY3JlYXRlZEF0XSlcXG4gIEBAbWFwKFxcXCJ3aXNobGlzdF9pdGVtc1xcXCIpXFxufVxcblwiLFxuICBcInJ1bnRpbWVEYXRhTW9kZWxcIjoge1xuICAgIFwibW9kZWxzXCI6IHt9LFxuICAgIFwiZW51bXNcIjoge30sXG4gICAgXCJ0eXBlc1wiOiB7fVxuICB9LFxuICBcInBhcmFtZXRlcml6YXRpb25TY2hlbWFcIjoge1xuICAgIFwic3RyaW5nc1wiOiBbXSxcbiAgICBcImdyYXBoXCI6IFwiXCJcbiAgfVxufVxuXG5jb25maWcucnVudGltZURhdGFNb2RlbCA9IEpTT04ucGFyc2UoXCJ7XFxcIm1vZGVsc1xcXCI6e1xcXCJCbG9nQ29tbWVudFxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29udGVudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicG9zdElkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhcmVudElkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBvc3RcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dQb3N0XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUG9zdENvbW1lbnRzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlVzZXJDb21tZW50c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhcmVudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQmxvZ0NvbW1lbnRcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDb21tZW50UmVwbGllc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJlcGxpZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ29tbWVudFJlcGxpZXNcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImJsb2dfY29tbWVudHNcXFwifSxcXFwiQmxvZ1Bvc3RcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRpdGxlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzbHVnXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJleGNlcnB0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb250ZW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb3ZlckltYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQb3N0U3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aG9ySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aG9yXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQXV0aG9yUG9zdHNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb21tZW50c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQmxvZ0NvbW1lbnRcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJQb3N0Q29tbWVudHNcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImJsb2dfcG9zdHNcXFwifSxcXFwiQm9va2luZ1xcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhdmVsRGF0ZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0cmF2ZWxlcnNcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRvdGFsUHJpY2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRlY2ltYWxcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyQm9va2luZ3NcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGF5bWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlBheW1lbnRcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9QYXltZW50XFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJib29raW5nc1xcXCJ9LFxcXCJDYXRlZ29yeVxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDYXRlZ29yeVRvVG91clBhY2thZ2VcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImNhdGVnb3JpZXNcXFwifSxcXFwiQ29udGFjdE1lc3NhZ2VcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdWJqZWN0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJtZXNzYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc1Jlc29sdmVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImNvbnRhY3RfbWVzc2FnZXNcXFwifSxcXFwiTm90aWZpY2F0aW9uXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInR5cGVcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJOb3RpZmljYXRpb25UeXBlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidGl0bGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm1lc3NhZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImxpbmtcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzUmVhZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiTm90aWZpY2F0aW9uVG9Vc2VyXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJub3RpZmljYXRpb25zXFxcIn0sXFxcIlBheW1lbnRcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhbklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ2YWxJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYW1vdW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEZWNpbWFsXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3VycmVuY3lcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN0YXR1c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlBheW1lbnRTdGF0dXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJnYXRld2F5UGFnZVVybFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3NsU2Vzc2lvbktleVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2FyZFR5cGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJhbmtUcmFuSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhaWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyZWZ1bmRSZWZJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmdW5kSW5pdGlhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmdW5kQ29tcGxldGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvUGF5bWVudFxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwicGF5bWVudHNcXFwifSxcXFwiUmVmcmVzaFRva2VuXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImhhc2hcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImV4cGlyZXNBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2b2tlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZWZyZXNoVG9rZW5Ub1VzZXJcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInJlZnJlc2hfdG9rZW5zXFxcIn0sXFxcIlJldmlld1xcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmF0aW5nXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb21tZW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZXZpZXdUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJyZXZpZXdzXFxcIn0sXFxcIlRvdXJQYWNrYWdlXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0aXRsZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZGVzY3JpcHRpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImxvY2F0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwcmljZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImR1cmF0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyYXRpbmdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkZsb2F0XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaW1hZ2VzXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYWNrYWdlU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2F0ZWdvcnlJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYWdlbnRJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjYXRlZ29yeVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQ2F0ZWdvcnlcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDYXRlZ29yeVRvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhZ2VudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkFnZW50UGFja2FnZXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmV2aWV3VG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIndpc2hsaXN0SXRlbXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIldpc2hsaXN0SXRlbVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlRvdXJQYWNrYWdlVG9XaXNobGlzdEl0ZW1cXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInRvdXJfcGFja2FnZXNcXFwifSxcXFwiVXNlclxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhc3N3b3JkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJnb29nbGVJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGhvbmVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF2YXRhclVybFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicm9sZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlJvbGVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aFByb3ZpZGVyXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQXV0aFByb3ZpZGVyXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxWZXJpZmllZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRva2VuVmVyc2lvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBZ2VudFBhY2thZ2VzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lckJvb2tpbmdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicG9zdHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dQb3N0XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQXV0aG9yUG9zdHNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ3aXNobGlzdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiV2lzaGxpc3RJdGVtXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVXNlclRvV2lzaGxpc3RJdGVtXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibm90aWZpY2F0aW9uc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiTm90aWZpY2F0aW9uXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiTm90aWZpY2F0aW9uVG9Vc2VyXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29tbWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVXNlckNvbW1lbnRzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmcmVzaFRva2Vuc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmVmcmVzaFRva2VuXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmVmcmVzaFRva2VuVG9Vc2VyXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJ1c2Vyc1xcXCJ9LFxcXCJXaXNobGlzdEl0ZW1cXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlVzZXJUb1dpc2hsaXN0SXRlbVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVG91clBhY2thZ2VUb1dpc2hsaXN0SXRlbVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwid2lzaGxpc3RfaXRlbXNcXFwifX0sXFxcImVudW1zXFxcIjp7fSxcXFwidHlwZXNcXFwiOnt9fVwiKVxuY29uZmlnLnBhcmFtZXRlcml6YXRpb25TY2hlbWEgPSB7XG4gIHN0cmluZ3M6IEpTT04ucGFyc2UoXCJbXFxcIndoZXJlXFxcIixcXFwib3JkZXJCeVxcXCIsXFxcImN1cnNvclxcXCIsXFxcInBhY2thZ2VzXFxcIixcXFwiX2NvdW50XFxcIixcXFwiY2F0ZWdvcnlcXFwiLFxcXCJhZ2VudFxcXCIsXFxcInVzZXJcXFwiLFxcXCJwYWNrYWdlXFxcIixcXFwiYm9va2luZ1xcXCIsXFxcInBheW1lbnRzXFxcIixcXFwiYm9va2luZ3NcXFwiLFxcXCJyZXZpZXdzXFxcIixcXFwid2lzaGxpc3RJdGVtc1xcXCIsXFxcInBvc3RzXFxcIixcXFwid2lzaGxpc3RcXFwiLFxcXCJub3RpZmljYXRpb25zXFxcIixcXFwiY29tbWVudHNcXFwiLFxcXCJyZWZyZXNoVG9rZW5zXFxcIixcXFwiYXV0aG9yXFxcIixcXFwicG9zdFxcXCIsXFxcInBhcmVudFxcXCIsXFxcInJlcGxpZXNcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kVW5pcXVlXFxcIixcXFwiQmxvZ0NvbW1lbnQuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kRmlyc3RcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQmxvZ0NvbW1lbnQuZmluZE1hbnlcXFwiLFxcXCJkYXRhXFxcIixcXFwiQmxvZ0NvbW1lbnQuY3JlYXRlT25lXFxcIixcXFwiQmxvZ0NvbW1lbnQuY3JlYXRlTWFueVxcXCIsXFxcIkJsb2dDb21tZW50LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCbG9nQ29tbWVudC51cGRhdGVPbmVcXFwiLFxcXCJCbG9nQ29tbWVudC51cGRhdGVNYW55XFxcIixcXFwiQmxvZ0NvbW1lbnQudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcImNyZWF0ZVxcXCIsXFxcInVwZGF0ZVxcXCIsXFxcIkJsb2dDb21tZW50LnVwc2VydE9uZVxcXCIsXFxcIkJsb2dDb21tZW50LmRlbGV0ZU9uZVxcXCIsXFxcIkJsb2dDb21tZW50LmRlbGV0ZU1hbnlcXFwiLFxcXCJoYXZpbmdcXFwiLFxcXCJfbWluXFxcIixcXFwiX21heFxcXCIsXFxcIkJsb2dDb21tZW50Lmdyb3VwQnlcXFwiLFxcXCJCbG9nQ29tbWVudC5hZ2dyZWdhdGVcXFwiLFxcXCJCbG9nUG9zdC5maW5kVW5pcXVlXFxcIixcXFwiQmxvZ1Bvc3QuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQmxvZ1Bvc3QuZmluZE1hbnlcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVPbmVcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVNYW55XFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU9uZVxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU1hbnlcXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQmxvZ1Bvc3QudXBzZXJ0T25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlT25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlTWFueVxcXCIsXFxcIkJsb2dQb3N0Lmdyb3VwQnlcXFwiLFxcXCJCbG9nUG9zdC5hZ2dyZWdhdGVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQm9va2luZy5maW5kRmlyc3RcXFwiLFxcXCJCb29raW5nLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJCb29raW5nLmZpbmRNYW55XFxcIixcXFwiQm9va2luZy5jcmVhdGVPbmVcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCb29raW5nLnVwZGF0ZU9uZVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJvb2tpbmcudXBzZXJ0T25lXFxcIixcXFwiQm9va2luZy5kZWxldGVPbmVcXFwiLFxcXCJCb29raW5nLmRlbGV0ZU1hbnlcXFwiLFxcXCJfYXZnXFxcIixcXFwiX3N1bVxcXCIsXFxcIkJvb2tpbmcuZ3JvdXBCeVxcXCIsXFxcIkJvb2tpbmcuYWdncmVnYXRlXFxcIixcXFwiQ2F0ZWdvcnkuZmluZFVuaXF1ZVxcXCIsXFxcIkNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNhdGVnb3J5LmZpbmRNYW55XFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlT25lXFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlTWFueVxcXCIsXFxcIkNhdGVnb3J5LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVPbmVcXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVNYW55XFxcIixcXFwiQ2F0ZWdvcnkudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNhdGVnb3J5LnVwc2VydE9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU1hbnlcXFwiLFxcXCJDYXRlZ29yeS5ncm91cEJ5XFxcIixcXFwiQ2F0ZWdvcnkuYWdncmVnYXRlXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZFVuaXF1ZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlT25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwc2VydE9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5ncm91cEJ5XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuYWdncmVnYXRlXFxcIixcXFwiTm90aWZpY2F0aW9uLmZpbmRVbmlxdWVcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZEZpcnN0XFxcIixcXFwiTm90aWZpY2F0aW9uLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZE1hbnlcXFwiLFxcXCJOb3RpZmljYXRpb24uY3JlYXRlT25lXFxcIixcXFwiTm90aWZpY2F0aW9uLmNyZWF0ZU1hbnlcXFwiLFxcXCJOb3RpZmljYXRpb24uY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIk5vdGlmaWNhdGlvbi51cGRhdGVPbmVcXFwiLFxcXCJOb3RpZmljYXRpb24udXBkYXRlTWFueVxcXCIsXFxcIk5vdGlmaWNhdGlvbi51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiTm90aWZpY2F0aW9uLnVwc2VydE9uZVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5kZWxldGVPbmVcXFwiLFxcXCJOb3RpZmljYXRpb24uZGVsZXRlTWFueVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5ncm91cEJ5XFxcIixcXFwiTm90aWZpY2F0aW9uLmFnZ3JlZ2F0ZVxcXCIsXFxcIlBheW1lbnQuZmluZFVuaXF1ZVxcXCIsXFxcIlBheW1lbnQuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJQYXltZW50LmZpbmRGaXJzdFxcXCIsXFxcIlBheW1lbnQuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlBheW1lbnQuZmluZE1hbnlcXFwiLFxcXCJQYXltZW50LmNyZWF0ZU9uZVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlTWFueVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlBheW1lbnQudXBkYXRlT25lXFxcIixcXFwiUGF5bWVudC51cGRhdGVNYW55XFxcIixcXFwiUGF5bWVudC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUGF5bWVudC51cHNlcnRPbmVcXFwiLFxcXCJQYXltZW50LmRlbGV0ZU9uZVxcXCIsXFxcIlBheW1lbnQuZGVsZXRlTWFueVxcXCIsXFxcIlBheW1lbnQuZ3JvdXBCeVxcXCIsXFxcIlBheW1lbnQuYWdncmVnYXRlXFxcIixcXFwiUmVmcmVzaFRva2VuLmZpbmRVbmlxdWVcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZEZpcnN0XFxcIixcXFwiUmVmcmVzaFRva2VuLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZE1hbnlcXFwiLFxcXCJSZWZyZXNoVG9rZW4uY3JlYXRlT25lXFxcIixcXFwiUmVmcmVzaFRva2VuLmNyZWF0ZU1hbnlcXFwiLFxcXCJSZWZyZXNoVG9rZW4uY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJlZnJlc2hUb2tlbi51cGRhdGVPbmVcXFwiLFxcXCJSZWZyZXNoVG9rZW4udXBkYXRlTWFueVxcXCIsXFxcIlJlZnJlc2hUb2tlbi51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUmVmcmVzaFRva2VuLnVwc2VydE9uZVxcXCIsXFxcIlJlZnJlc2hUb2tlbi5kZWxldGVPbmVcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZGVsZXRlTWFueVxcXCIsXFxcIlJlZnJlc2hUb2tlbi5ncm91cEJ5XFxcIixcXFwiUmVmcmVzaFRva2VuLmFnZ3JlZ2F0ZVxcXCIsXFxcIlJldmlldy5maW5kVW5pcXVlXFxcIixcXFwiUmV2aWV3LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRGaXJzdFxcXCIsXFxcIlJldmlldy5maW5kRmlyc3RPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU9uZVxcXCIsXFxcIlJldmlldy5jcmVhdGVNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJSZXZpZXcudXBkYXRlT25lXFxcIixcXFwiUmV2aWV3LnVwZGF0ZU1hbnlcXFwiLFxcXCJSZXZpZXcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJldmlldy51cHNlcnRPbmVcXFwiLFxcXCJSZXZpZXcuZGVsZXRlT25lXFxcIixcXFwiUmV2aWV3LmRlbGV0ZU1hbnlcXFwiLFxcXCJSZXZpZXcuZ3JvdXBCeVxcXCIsXFxcIlJldmlldy5hZ2dyZWdhdGVcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kVW5pcXVlXFxcIixcXFwiVG91clBhY2thZ2UuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiVG91clBhY2thZ2UuZmluZE1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVNYW55XFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVG91clBhY2thZ2UudXBzZXJ0T25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlT25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLmdyb3VwQnlcXFwiLFxcXCJUb3VyUGFja2FnZS5hZ2dyZWdhdGVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiVXNlci5maW5kRmlyc3RcXFwiLFxcXCJVc2VyLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJVc2VyLmZpbmRNYW55XFxcIixcXFwiVXNlci5jcmVhdGVPbmVcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJVc2VyLnVwZGF0ZU9uZVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlVzZXIudXBzZXJ0T25lXFxcIixcXFwiVXNlci5kZWxldGVPbmVcXFwiLFxcXCJVc2VyLmRlbGV0ZU1hbnlcXFwiLFxcXCJVc2VyLmdyb3VwQnlcXFwiLFxcXCJVc2VyLmFnZ3JlZ2F0ZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kVW5pcXVlXFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRGaXJzdFxcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLmNyZWF0ZU9uZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5jcmVhdGVNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJXaXNobGlzdEl0ZW0udXBkYXRlT25lXFxcIixcXFwiV2lzaGxpc3RJdGVtLnVwZGF0ZU1hbnlcXFwiLFxcXCJXaXNobGlzdEl0ZW0udXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIldpc2hsaXN0SXRlbS51cHNlcnRPbmVcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZGVsZXRlT25lXFxcIixcXFwiV2lzaGxpc3RJdGVtLmRlbGV0ZU1hbnlcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZ3JvdXBCeVxcXCIsXFxcIldpc2hsaXN0SXRlbS5hZ2dyZWdhdGVcXFwiLFxcXCJBTkRcXFwiLFxcXCJPUlxcXCIsXFxcIk5PVFxcXCIsXFxcImlkXFxcIixcXFwidXNlcklkXFxcIixcXFwicGFja2FnZUlkXFxcIixcXFwiY3JlYXRlZEF0XFxcIixcXFwiZXF1YWxzXFxcIixcXFwiaW5cXFwiLFxcXCJub3RJblxcXCIsXFxcImx0XFxcIixcXFwibHRlXFxcIixcXFwiZ3RcXFwiLFxcXCJndGVcXFwiLFxcXCJub3RcXFwiLFxcXCJjb250YWluc1xcXCIsXFxcInN0YXJ0c1dpdGhcXFwiLFxcXCJlbmRzV2l0aFxcXCIsXFxcIm5hbWVcXFwiLFxcXCJlbWFpbFxcXCIsXFxcInBhc3N3b3JkXFxcIixcXFwiZ29vZ2xlSWRcXFwiLFxcXCJwaG9uZVxcXCIsXFxcImF2YXRhclVybFxcXCIsXFxcIlJvbGVcXFwiLFxcXCJyb2xlXFxcIixcXFwiVXNlclN0YXR1c1xcXCIsXFxcInN0YXR1c1xcXCIsXFxcIkF1dGhQcm92aWRlclxcXCIsXFxcImF1dGhQcm92aWRlclxcXCIsXFxcImVtYWlsVmVyaWZpZWRcXFwiLFxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJ0b2tlblZlcnNpb25cXFwiLFxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJldmVyeVxcXCIsXFxcInNvbWVcXFwiLFxcXCJub25lXFxcIixcXFwidGl0bGVcXFwiLFxcXCJzbHVnXFxcIixcXFwiZGVzY3JpcHRpb25cXFwiLFxcXCJsb2NhdGlvblxcXCIsXFxcInByaWNlXFxcIixcXFwiZHVyYXRpb25cXFwiLFxcXCJyYXRpbmdcXFwiLFxcXCJpbWFnZXNcXFwiLFxcXCJQYWNrYWdlU3RhdHVzXFxcIixcXFwiY2F0ZWdvcnlJZFxcXCIsXFxcImFnZW50SWRcXFwiLFxcXCJoYXNcXFwiLFxcXCJoYXNFdmVyeVxcXCIsXFxcImhhc1NvbWVcXFwiLFxcXCJjb21tZW50XFxcIixcXFwiaGFzaFxcXCIsXFxcImV4cGlyZXNBdFxcXCIsXFxcInJldm9rZWRBdFxcXCIsXFxcImJvb2tpbmdJZFxcXCIsXFxcInRyYW5JZFxcXCIsXFxcInZhbElkXFxcIixcXFwiYW1vdW50XFxcIixcXFwiY3VycmVuY3lcXFwiLFxcXCJQYXltZW50U3RhdHVzXFxcIixcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJzc2xTZXNzaW9uS2V5XFxcIixcXFwiY2FyZFR5cGVcXFwiLFxcXCJiYW5rVHJhbklkXFxcIixcXFwicGFpZEF0XFxcIixcXFwicmVmdW5kUmVmSWRcXFwiLFxcXCJyZWZ1bmRJbml0aWF0ZWRBdFxcXCIsXFxcInJlZnVuZENvbXBsZXRlZEF0XFxcIixcXFwiTm90aWZpY2F0aW9uVHlwZVxcXCIsXFxcInR5cGVcXFwiLFxcXCJtZXNzYWdlXFxcIixcXFwibGlua1xcXCIsXFxcImlzUmVhZFxcXCIsXFxcInN1YmplY3RcXFwiLFxcXCJpc1Jlc29sdmVkXFxcIixcXFwidHJhdmVsRGF0ZVxcXCIsXFxcInRyYXZlbGVyc1xcXCIsXFxcInRvdGFsUHJpY2VcXFwiLFxcXCJCb29raW5nU3RhdHVzXFxcIixcXFwiZXhjZXJwdFxcXCIsXFxcImNvbnRlbnRcXFwiLFxcXCJjb3ZlckltYWdlXFxcIixcXFwiUG9zdFN0YXR1c1xcXCIsXFxcImF1dGhvcklkXFxcIixcXFwicG9zdElkXFxcIixcXFwicGFyZW50SWRcXFwiLFxcXCJ1c2VySWRfcGFja2FnZUlkXFxcIixcXFwiaXNcXFwiLFxcXCJpc05vdFxcXCIsXFxcImNvbm5lY3RPckNyZWF0ZVxcXCIsXFxcInVwc2VydFxcXCIsXFxcImNyZWF0ZU1hbnlcXFwiLFxcXCJzZXRcXFwiLFxcXCJkaXNjb25uZWN0XFxcIixcXFwiZGVsZXRlXFxcIixcXFwiY29ubmVjdFxcXCIsXFxcInVwZGF0ZU1hbnlcXFwiLFxcXCJkZWxldGVNYW55XFxcIixcXFwicHVzaFxcXCIsXFxcImluY3JlbWVudFxcXCIsXFxcImRlY3JlbWVudFxcXCIsXFxcIm11bHRpcGx5XFxcIixcXFwiZGl2aWRlXFxcIl1cIiksXG4gIGdyYXBoOiBcIndBWnh3QUVQQndBQW9RTUFJQlFBQUtNREFDQVZBQUNrQXdBZ0ZnQUEtUUlBSU44QkFBQ2lBd0F3NEFFQUFDZ0FFT0VCQUFDaUF3QXc0Z0VCQUFBQUFlTUJBUURyQWdBaDVRRkFBUElDQUNILUFTQUE4QUlBSVlBQ1FBRHlBZ0Foc0FJQkFPc0NBQ0cwQWdFQTZ3SUFJYlVDQVFEc0FnQWhBUUFBQUFFQUlCY0ZBQUM0QXdBZ0JnQUFvUU1BSUFzQUFQUUNBQ0FNQUFEMUFnQWdEUUFBOXdJQUlOOEJBQUMxQXdBdzRBRUFBQU1BRU9FQkFBQzFBd0F3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDM0E0MENJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUURyQWdBaGhnSUJBT3NDQUNHSEFnRUE2d0lBSVlnQ0VBQ3ZBd0FoaVFJQ0FQRUNBQ0dLQWdnQXRnTUFJWXNDQUFELUFnQWdqUUlCQU9zQ0FDR09BZ0VBNndJQUlRVUZBQURtQlFBZ0JnQUE0QVVBSUFzQUFKNEZBQ0FNQUFDZkJRQWdEUUFBb1FVQUlCY0ZBQUM0QXdBZ0JnQUFvUU1BSUFzQUFQUUNBQ0FNQUFEMUFnQWdEUUFBOXdJQUlOOEJBQUMxQXdBdzRBRUFBQU1BRU9FQkFBQzFBd0F3NGdFQkFBQUFBZVVCUUFEeUFnQWgtZ0VBQUxjRGpRSWlfZ0VnQVBBQ0FDR0FBa0FBOGdJQUlZUUNBUURyQWdBaGhRSUJBQUFBQVlZQ0FRRHJBZ0FoaHdJQkFPc0NBQ0dJQWhBQXJ3TUFJWWtDQWdEeEFnQWhpZ0lJQUxZREFDR0xBZ0FBX2dJQUlJMENBUURyQWdBaGpnSUJBT3NDQUNFREFBQUFBd0FnQVFBQUJBQXdBZ0FBQlFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlBRUFBQUFEQUNBUEJ3QUFvUU1BSUFnQUFLc0RBQ0FLQUFDMEF3QWczd0VBQUxJREFERGdBUUFBQ1FBUTRRRUFBTElEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDekE2OENJb0FDUUFEeUFnQWhxd0pBQVBJQ0FDR3NBZ0lBOFFJQUlhMENFQUN2QXdBaEF3Y0FBT0FGQUNBSUFBRGpCUUFnQ2dBQTVRVUFJQThIQUFDaEF3QWdDQUFBcXdNQUlBb0FBTFFEQUNEZkFRQUFzZ01BTU9BQkFBQUpBQkRoQVFBQXNnTUFNT0lCQVFBQUFBSGpBUUVBNndJQUllUUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFzd092QWlLQUFrQUE4Z0lBSWFzQ1FBRHlBZ0FockFJQ0FQRUNBQ0d0QWhBQXJ3TUFJUU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FWQ1FBQXNRTUFJTjhCQUFDdUF3QXc0QUVBQUEwQUVPRUJBQUN1QXdBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ3dBNXdDSW9BQ1FBRHlBZ0FobGdJQkFPc0NBQ0dYQWdFQTZ3SUFJWmdDQVFEc0FnQWhtUUlRQUs4REFDR2FBZ0VBNndJQUlad0NBUURzQWdBaG5RSUJBT3dDQUNHZUFnRUE3QUlBSVo4Q0FRRHNBZ0Fob0FKQUFLQURBQ0doQWdFQTdBSUFJYUlDUUFDZ0F3QWhvd0pBQUtBREFDRUtDUUFBNUFVQUlKZ0NBQURDQXdBZ25BSUFBTUlEQUNDZEFnQUF3Z01BSUo0Q0FBRENBd0FnbndJQUFNSURBQ0NnQWdBQXdnTUFJS0VDQUFEQ0F3QWdvZ0lBQU1JREFDQ2pBZ0FBd2dNQUlCVUpBQUN4QXdBZzN3RUFBSzREQUREZ0FRQUFEUUFRNFFFQUFLNERBRERpQVFFQUFBQUI1UUZBQVBJQ0FDSDZBUUFBc0FPY0FpS0FBa0FBOGdJQUlaWUNBUURyQWdBaGx3SUJBQUFBQVpnQ0FRRHNBZ0FobVFJUUFLOERBQ0dhQWdFQTZ3SUFJWndDQVFEc0FnQWhuUUlCQU93Q0FDR2VBZ0VBN0FJQUlaOENBUURzQWdBaG9BSkFBS0FEQUNHaEFnRUE3QUlBSWFJQ1FBQ2dBd0Fob3dKQUFLQURBQ0VEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQVFBQUFBMEFJQTBIQUFDaEF3QWdDQUFBcXdNQUlOOEJBQUN0QXdBdzRBRUFBQklBRU9FQkFBQ3RBd0F3NGdFQkFPc0NBQ0hqQVFFQTZ3SUFJZVFCQVFEckFnQWg1UUZBQVBJQ0FDSC1BU0FBOEFJQUlZQUNRQUR5QWdBaGlnSUNBUEVDQUNHU0FnRUE2d0lBSVFJSEFBRGdCUUFnQ0FBQTR3VUFJQTRIQUFDaEF3QWdDQUFBcXdNQUlOOEJBQUN0QXdBdzRBRUFBQklBRU9FQkFBQ3RBd0F3NGdFQkFBQUFBZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUlmNEJJQUR3QWdBaGdBSkFBUElDQUNHS0FnSUE4UUlBSVpJQ0FRRHJBZ0FodGdJQUFLd0RBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnQ1FjQUFLRURBQ0FJQUFDckF3QWczd0VBQUtvREFERGdBUUFBRmdBUTRRRUFBS29EQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJUUlIQUFEZ0JRQWdDQUFBNHdVQUlBb0hBQUNoQXdBZ0NBQUFxd01BSU44QkFBQ3FBd0F3NEFFQUFCWUFFT0VCQUFDcUF3QXc0Z0VCQUFBQUFlTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWJZQ0FBQ3BBd0FnQXdBQUFCWUFJQUVBQUJjQU1BSUFBQmdBSUFFQUFBQUpBQ0FCQUFBQUVnQWdBUUFBQUJZQUlBTUFBQUFKQUNBQkFBQUtBREFDQUFBTEFDQURBQUFBRWdBZ0FRQUFFd0F3QWdBQUZBQWdFQkVBQVBrQ0FDQVRBQUNoQXdBZzN3RUFBS2NEQUREZ0FRQUFId0FRNFFFQUFLY0RBRERpQVFFQTZ3SUFJZVVCUUFEeUFnQWgtZ0VBQUtnRHN3SWlfZ0VnQVBBQ0FDR0FBa0FBOGdJQUlZUUNBUURyQWdBaGhRSUJBT3NDQUNHdkFnRUE2d0lBSWJBQ0FRRHJBZ0Foc1FJQkFPc0NBQ0d6QWdFQTZ3SUFJUUlSQUFDakJRQWdFd0FBNEFVQUlCQVJBQUQ1QWdBZ0V3QUFvUU1BSU44QkFBQ25Bd0F3NEFFQUFCOEFFT0VCQUFDbkF3QXc0Z0VCQUFBQUFlVUJRQUR5QWdBaC1nRUFBS2dEc3dJaV9nRWdBUEFDQUNHQUFrQUE4Z0lBSVlRQ0FRRHJBZ0FoaFFJQkFBQUFBYThDQVFEckFnQWhzQUlCQU9zQ0FDR3hBZ0VBNndJQUliTUNBUURyQWdBaEF3QUFBQjhBSUFFQUFDQUFNQUlBQUNFQUlBTUFBQUFXQUNBQkFBQVhBREFDQUFBWUFDQU1Cd0FBb1FNQUlOOEJBQUNsQXdBdzRBRUFBQ1FBRU9FQkFBQ2xBd0F3NGdFQkFPc0NBQ0hqQVFFQTZ3SUFJZVVCUUFEeUFnQWhoQUlCQU9zQ0FDR2xBZ0FBcGdPbEFpS21BZ0VBNndJQUlhY0NBUURzQWdBaHFBSWdBUEFDQUNFQ0J3QUE0QVVBSUtjQ0FBRENBd0FnREFjQUFLRURBQ0RmQVFBQXBRTUFNT0FCQUFBa0FCRGhBUUFBcFFNQU1PSUJBUUFBQUFIakFRRUE2d0lBSWVVQlFBRHlBZ0FoaEFJQkFPc0NBQ0dsQWdBQXBnT2xBaUttQWdFQTZ3SUFJYWNDQVFEc0FnQWhxQUlnQVBBQ0FDRURBQUFBSkFBZ0FRQUFKUUF3QWdBQUpnQWdEd2NBQUtFREFDQVVBQUNqQXdBZ0ZRQUFwQU1BSUJZQUFQa0NBQ0RmQVFBQW9nTUFNT0FCQUFBb0FCRGhBUUFBb2dNQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIbEFVQUE4Z0lBSWY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0d3QWdFQTZ3SUFJYlFDQVFEckFnQWh0UUlCQU93Q0FDRUZCd0FBNEFVQUlCUUFBT0VGQUNBVkFBRGlCUUFnRmdBQW93VUFJTFVDQUFEQ0F3QWdBd0FBQUNnQUlBRUFBQ2tBTUFJQUFBRUFJQW9IQUFDaEF3QWczd0VBQUo4REFERGdBUUFBS3dBUTRRRUFBSjhEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNVFGQUFQSUNBQ0dUQWdFQTZ3SUFJWlFDUUFEeUFnQWhsUUpBQUtBREFDRUNCd0FBNEFVQUlKVUNBQURDQXdBZ0NnY0FBS0VEQUNEZkFRQUFud01BTU9BQkFBQXJBQkRoQVFBQW53TUFNT0lCQVFBQUFBSGpBUUVBNndJQUllVUJRQUR5QWdBaGt3SUJBQUFBQVpRQ1FBRHlBZ0FobFFKQUFLQURBQ0VEQUFBQUt3QWdBUUFBTEFBd0FnQUFMUUFnQVFBQUFBTUFJQUVBQUFBSkFDQUJBQUFBRWdBZ0FRQUFBQjhBSUFFQUFBQVdBQ0FCQUFBQUpBQWdBUUFBQUNnQUlBRUFBQUFyQUNBREFBQUFLQUFnQVFBQUtRQXdBZ0FBQVFBZ0FRQUFBQ2dBSUFFQUFBQW9BQ0FEQUFBQUtBQWdBUUFBS1FBd0FnQUFBUUFnQVFBQUFDZ0FJQUVBQUFBQkFDQURBQUFBS0FBZ0FRQUFLUUF3QWdBQUFRQWdBd0FBQUNnQUlBRUFBQ2tBTUFJQUFBRUFJQU1BQUFBb0FDQUJBQUFwQURBQ0FBQUJBQ0FNQndBQV9BTUFJQlFBQVBzREFDQVZBQURfQXdBZ0ZnQUFfUU1BSU9JQkFRQUFBQUhqQVFFQUFBQUI1UUZBQUFBQUFmNEJJQUFBQUFHQUFrQUFBQUFCc0FJQkFBQUFBYlFDQVFBQUFBRzFBZ0VBQUFBQkFSd0FBRUFBSUFqaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQWJBQ0FRQUFBQUcwQWdFQUFBQUJ0UUlCQUFBQUFRRWNBQUJDQURBQkhBQUFRZ0F3QVFBQUFDZ0FJQXdIQUFENUF3QWdGQUFBN2dNQUlCVUFBTzhEQUNBV0FBRHdBd0FnNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUliQUNBUUM4QXdBaHRBSUJBTHdEQUNHMUFnRUF5QU1BSVFJQUFBQUJBQ0FjQUFCR0FDQUk0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaF9nRWdBTXdEQUNHQUFrQUF2UU1BSWJBQ0FRQzhBd0FodEFJQkFMd0RBQ0cxQWdFQXlBTUFJUUlBQUFBb0FDQWNBQUJJQUNBQ0FBQUFLQUFnSEFBQVNBQWdBUUFBQUNnQUlBTUFBQUFCQUNBakFBQkFBQ0FrQUFCR0FDQUJBQUFBQVFBZ0FRQUFBQ2dBSUFRRUFBRGRCUUFnS1FBQTN3VUFJQ29BQU40RkFDQzFBZ0FBd2dNQUlBdmZBUUFBbmdNQU1PQUJBQUJRQUJEaEFRQUFuZ01BTU9JQkFRRFBBZ0FoNHdFQkFNOENBQ0hsQVVBQTBBSUFJZjRCSUFEYkFnQWhnQUpBQU5BQ0FDR3dBZ0VBendJQUliUUNBUURQQWdBaHRRSUJBTmNDQUNFREFBQUFLQUFnQVFBQVR3QXdLQUFBVUFBZ0F3QUFBQ2dBSUFFQUFDa0FNQUlBQUFFQUlBRUFBQUFoQUNBQkFBQUFJUUFnQXdBQUFCOEFJQUVBQUNBQU1BSUFBQ0VBSUFNQUFBQWZBQ0FCQUFBZ0FEQUNBQUFoQUNBREFBQUFId0FnQVFBQUlBQXdBZ0FBSVFBZ0RSRUFBTEFFQUNBVEFBRGNCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSDZBUUFBQUxNQ0F2NEJJQUFBQUFHQUFrQUFBQUFCaEFJQkFBQUFBWVVDQVFBQUFBR3ZBZ0VBQUFBQnNBSUJBQUFBQWJFQ0FRQUFBQUd6QWdFQUFBQUJBUndBQUZnQUlBdmlBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFzd0lDX2dFZ0FBQUFBWUFDUUFBQUFBR0VBZ0VBQUFBQmhRSUJBQUFBQWE4Q0FRQUFBQUd3QWdFQUFBQUJzUUlCQUFBQUFiTUNBUUFBQUFFQkhBQUFXZ0F3QVJ3QUFGb0FNQTBSQUFDbEJBQWdFd0FBMndVQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUFvd1N6QWlMLUFTQUF6QU1BSVlBQ1FBQzlBd0FoaEFJQkFMd0RBQ0dGQWdFQXZBTUFJYThDQVFDOEF3QWhzQUlCQUx3REFDR3hBZ0VBdkFNQUliTUNBUUM4QXdBaEFnQUFBQ0VBSUJ3QUFGMEFJQXZpQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQUtNRXN3SWlfZ0VnQU13REFDR0FBa0FBdlFNQUlZUUNBUUM4QXdBaGhRSUJBTHdEQUNHdkFnRUF2QU1BSWJBQ0FRQzhBd0Foc1FJQkFMd0RBQ0d6QWdFQXZBTUFJUUlBQUFBZkFDQWNBQUJmQUNBQ0FBQUFId0FnSEFBQVh3QWdBd0FBQUNFQUlDTUFBRmdBSUNRQUFGMEFJQUVBQUFBaEFDQUJBQUFBSHdBZ0F3UUFBTmdGQUNBcEFBRGFCUUFnS2dBQTJRVUFJQTdmQVFBQW1nTUFNT0FCQUFCbUFCRGhBUUFBbWdNQU1PSUJBUURQQWdBaDVRRkFBTkFDQUNINkFRQUFtd096QWlMLUFTQUEyd0lBSVlBQ1FBRFFBZ0FoaEFJQkFNOENBQ0dGQWdFQXp3SUFJYThDQVFEUEFnQWhzQUlCQU04Q0FDR3hBZ0VBendJQUliTUNBUURQQWdBaEF3QUFBQjhBSUFFQUFHVUFNQ2dBQUdZQUlBTUFBQUFmQUNBQkFBQWdBREFDQUFBaEFDQUJBQUFBQ3dBZ0FRQUFBQXNBSUFNQUFBQUpBQ0FCQUFBS0FEQUNBQUFMQUNBREFBQUFDUUFnQVFBQUNnQXdBZ0FBQ3dBZ0F3QUFBQWtBSUFFQUFBb0FNQUlBQUFzQUlBd0hBQUNPQlFBZ0NBQUEzQVFBSUFvQUFOMEVBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3ZBZ0tBQWtBQUFBQUJxd0pBQUFBQUFhd0NBZ0FBQUFHdEFoQUFBQUFCQVJ3QUFHNEFJQW5pQVFFQUFBQUI0d0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3ZBZ0tBQWtBQUFBQUJxd0pBQUFBQUFhd0NBZ0FBQUFHdEFoQUFBQUFCQVJ3QUFIQUFNQUVjQUFCd0FEQU1Cd0FBakFVQUlBZ0FBTXdFQUNBS0FBRE5CQUFnNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVFCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBeWdTdkFpS0FBa0FBdlFNQUlhc0NRQUM5QXdBaHJBSUNBTTBEQUNHdEFoQUF5UVFBSVFJQUFBQUxBQ0FjQUFCekFDQUo0Z0VCQUx3REFDSGpBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUF5Z1N2QWlLQUFrQUF2UU1BSWFzQ1FBQzlBd0FockFJQ0FNMERBQ0d0QWhBQXlRUUFJUUlBQUFBSkFDQWNBQUIxQUNBQ0FBQUFDUUFnSEFBQWRRQWdBd0FBQUFzQUlDTUFBRzRBSUNRQUFITUFJQUVBQUFBTEFDQUJBQUFBQ1FBZ0JRUUFBTk1GQUNBcEFBRFdCUUFnS2dBQTFRVUFJRXNBQU5RRkFDQk1BQURYQlFBZ0ROOEJBQUNXQXdBdzRBRUFBSHdBRU9FQkFBQ1dBd0F3NGdFQkFNOENBQ0hqQVFFQXp3SUFJZVFCQVFEUEFnQWg1UUZBQU5BQ0FDSDZBUUFBbHdPdkFpS0FBa0FBMEFJQUlhc0NRQURRQWdBaHJBSUNBTndDQUNHdEFoQUFfQUlBSVFNQUFBQUpBQ0FCQUFCN0FEQW9BQUI4QUNBREFBQUFDUUFnQVFBQUNnQXdBZ0FBQ3dBZ0NRTUFBUE1DQUNEZkFRQUFsUU1BTU9BQkFBQ0NBUUFRNFFFQUFKVURBRERpQVFFQUFBQUI1UUZBQVBJQ0FDSHhBUUVBQUFBQmdBSkFBUElDQUNHRkFnRUFBQUFCQVFBQUFIOEFJQUVBQUFCX0FDQUpBd0FBOHdJQUlOOEJBQUNWQXdBdzRBRUFBSUlCQUJEaEFRQUFsUU1BTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0h4QVFFQTZ3SUFJWUFDUUFEeUFnQWhoUUlCQU9zQ0FDRUJBd0FBblFVQUlBTUFBQUNDQVFBZ0FRQUFnd0VBTUFJQUFIOEFJQU1BQUFDQ0FRQWdBUUFBZ3dFQU1BSUFBSDhBSUFNQUFBQ0NBUUFnQVFBQWd3RUFNQUlBQUg4QUlBWURBQURTQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUh4QVFFQUFBQUJnQUpBQUFBQUFZVUNBUUFBQUFFQkhBQUFod0VBSUFYaUFRRUFBQUFCNVFGQUFBQUFBZkVCQVFBQUFBR0FBa0FBQUFBQmhRSUJBQUFBQVFFY0FBQ0pBUUF3QVJ3QUFJa0JBREFHQXdBQXlBVUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlZQUNRQUM5QXdBaGhRSUJBTHdEQUNFQ0FBQUFmd0FnSEFBQWpBRUFJQVhpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDR0FBa0FBdlFNQUlZVUNBUUM4QXdBaEFnQUFBSUlCQUNBY0FBQ09BUUFnQWdBQUFJSUJBQ0FjQUFDT0FRQWdBd0FBQUg4QUlDTUFBSWNCQUNBa0FBQ01BUUFnQVFBQUFIOEFJQUVBQUFDQ0FRQWdBd1FBQU1VRkFDQXBBQURIQlFBZ0tnQUF4Z1VBSUFqZkFRQUFsQU1BTU9BQkFBQ1ZBUUFRNFFFQUFKUURBRERpQVFFQXp3SUFJZVVCUUFEUUFnQWg4UUVCQU04Q0FDR0FBa0FBMEFJQUlZVUNBUURQQWdBaEF3QUFBSUlCQUNBQkFBQ1VBUUF3S0FBQWxRRUFJQU1BQUFDQ0FRQWdBUUFBZ3dFQU1BSUFBSDhBSUF2ZkFRQUFrd01BTU9BQkFBQ2JBUUFRNFFFQUFKTURBRERpQVFFQUFBQUI1UUZBQVBJQ0FDSHhBUUVBNndJQUlmSUJBUURyQWdBaGdBSkFBUElDQUNHbUFnRUE2d0lBSWFrQ0FRRHJBZ0FocWdJZ0FQQUNBQ0VCQUFBQW1BRUFJQUVBQUFDWUFRQWdDOThCQUFDVEF3QXc0QUVBQUpzQkFCRGhBUUFBa3dNQU1PSUJBUURyQWdBaDVRRkFBUElDQUNIeEFRRUE2d0lBSWZJQkFRRHJBZ0FoZ0FKQUFQSUNBQ0dtQWdFQTZ3SUFJYWtDQVFEckFnQWhxZ0lnQVBBQ0FDRUFBd0FBQUpzQkFDQUJBQUNjQVFBd0FnQUFtQUVBSUFNQUFBQ2JBUUFnQVFBQW5BRUFNQUlBQUpnQkFDQURBQUFBbXdFQUlBRUFBSndCQURBQ0FBQ1lBUUFnQ09JQkFRQUFBQUhsQVVBQUFBQUI4UUVCQUFBQUFmSUJBUUFBQUFHQUFrQUFBQUFCcGdJQkFBQUFBYWtDQVFBQUFBR3FBaUFBQUFBQkFSd0FBS0FCQUNBSTRnRUJBQUFBQWVVQlFBQUFBQUh4QVFFQUFBQUI4Z0VCQUFBQUFZQUNRQUFBQUFHbUFnRUFBQUFCcVFJQkFBQUFBYW9DSUFBQUFBRUJIQUFBb2dFQU1BRWNBQUNpQVFBd0NPSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoZ0FKQUFMMERBQ0dtQWdFQXZBTUFJYWtDQVFDOEF3QWhxZ0lnQU13REFDRUNBQUFBbUFFQUlCd0FBS1VCQUNBSTRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0dBQWtBQXZRTUFJYVlDQVFDOEF3QWhxUUlCQUx3REFDR3FBaUFBekFNQUlRSUFBQUNiQVFBZ0hBQUFwd0VBSUFJQUFBQ2JBUUFnSEFBQXB3RUFJQU1BQUFDWUFRQWdJd0FBb0FFQUlDUUFBS1VCQUNBQkFBQUFtQUVBSUFFQUFBQ2JBUUFnQXdRQUFNSUZBQ0FwQUFERUJRQWdLZ0FBd3dVQUlBdmZBUUFBa2dNQU1PQUJBQUN1QVFBUTRRRUFBSklEQUREaUFRRUF6d0lBSWVVQlFBRFFBZ0FoOFFFQkFNOENBQ0h5QVFFQXp3SUFJWUFDUUFEUUFnQWhwZ0lCQU04Q0FDR3BBZ0VBendJQUlhb0NJQURiQWdBaEF3QUFBSnNCQUNBQkFBQ3RBUUF3S0FBQXJnRUFJQU1BQUFDYkFRQWdBUUFBbkFFQU1BSUFBSmdCQUNBQkFBQUFKZ0FnQVFBQUFDWUFJQU1BQUFBa0FDQUJBQUFsQURBQ0FBQW1BQ0FEQUFBQUpBQWdBUUFBSlFBd0FnQUFKZ0FnQXdBQUFDUUFJQUVBQUNVQU1BSUFBQ1lBSUFrSEFBREJCUUFnNGdFQkFBQUFBZU1CQVFBQUFBSGxBVUFBQUFBQmhBSUJBQUFBQWFVQ0FBQUFwUUlDcGdJQkFBQUFBYWNDQVFBQUFBR29BaUFBQUFBQkFSd0FBTFlCQUNBSTRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJoQUlCQUFBQUFhVUNBQUFBcFFJQ3BnSUJBQUFBQWFjQ0FRQUFBQUdvQWlBQUFBQUJBUndBQUxnQkFEQUJIQUFBdUFFQU1Ba0hBQURBQlFBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoaEFJQkFMd0RBQ0dsQWdBQWlnU2xBaUttQWdFQXZBTUFJYWNDQVFESUF3QWhxQUlnQU13REFDRUNBQUFBSmdBZ0hBQUF1d0VBSUFqaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0dFQWdFQXZBTUFJYVVDQUFDS0JLVUNJcVlDQVFDOEF3QWhwd0lCQU1nREFDR29BaUFBekFNQUlRSUFBQUFrQUNBY0FBQzlBUUFnQWdBQUFDUUFJQndBQUwwQkFDQURBQUFBSmdBZ0l3QUF0Z0VBSUNRQUFMc0JBQ0FCQUFBQUpnQWdBUUFBQUNRQUlBUUVBQUM5QlFBZ0tRQUF2d1VBSUNvQUFMNEZBQ0NuQWdBQXdnTUFJQXZmQVFBQWpnTUFNT0FCQUFERUFRQVE0UUVBQUk0REFERGlBUUVBendJQUllTUJBUURQQWdBaDVRRkFBTkFDQUNHRUFnRUF6d0lBSWFVQ0FBQ1BBNlVDSXFZQ0FRRFBBZ0FocHdJQkFOY0NBQ0dvQWlBQTJ3SUFJUU1BQUFBa0FDQUJBQUREQVFBd0tBQUF4QUVBSUFNQUFBQWtBQ0FCQUFBbEFEQUNBQUFtQUNBQkFBQUFEd0FnQVFBQUFBOEFJQU1BQUFBTkFDQUJBQUFPQURBQ0FBQVBBQ0FEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQXdBQUFBMEFJQUVBQUE0QU1BSUFBQThBSUJJSkFBQzhCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSDZBUUFBQUp3Q0FvQUNRQUFBQUFHV0FnRUFBQUFCbHdJQkFBQUFBWmdDQVFBQUFBR1pBaEFBQUFBQm1nSUJBQUFBQVp3Q0FRQUFBQUdkQWdFQUFBQUJuZ0lCQUFBQUFaOENBUUFBQUFHZ0FrQUFBQUFCb1FJQkFBQUFBYUlDUUFBQUFBR2pBa0FBQUFBQkFSd0FBTXdCQUNBUjRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFKd0NBb0FDUUFBQUFBR1dBZ0VBQUFBQmx3SUJBQUFBQVpnQ0FRQUFBQUdaQWhBQUFBQUJtZ0lCQUFBQUFad0NBUUFBQUFHZEFnRUFBQUFCbmdJQkFBQUFBWjhDQVFBQUFBR2dBa0FBQUFBQm9RSUJBQUFBQWFJQ1FBQUFBQUdqQWtBQUFBQUJBUndBQU00QkFEQUJIQUFBemdFQU1CSUpBQUM3QlFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBRFlCSndDSW9BQ1FBQzlBd0FobGdJQkFMd0RBQ0dYQWdFQXZBTUFJWmdDQVFESUF3QWhtUUlRQU1rRUFDR2FBZ0VBdkFNQUlad0NBUURJQXdBaG5RSUJBTWdEQUNHZUFnRUF5QU1BSVo4Q0FRRElBd0Fob0FKQUFPQURBQ0doQWdFQXlBTUFJYUlDUUFEZ0F3QWhvd0pBQU9BREFDRUNBQUFBRHdBZ0hBQUEwUUVBSUJIaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFOZ0VuQUlpZ0FKQUFMMERBQ0dXQWdFQXZBTUFJWmNDQVFDOEF3QWhtQUlCQU1nREFDR1pBaEFBeVFRQUlab0NBUUM4QXdBaG5BSUJBTWdEQUNHZEFnRUF5QU1BSVo0Q0FRRElBd0FobndJQkFNZ0RBQ0dnQWtBQTRBTUFJYUVDQVFESUF3QWhvZ0pBQU9BREFDR2pBa0FBNEFNQUlRSUFBQUFOQUNBY0FBRFRBUUFnQWdBQUFBMEFJQndBQU5NQkFDQURBQUFBRHdBZ0l3QUF6QUVBSUNRQUFORUJBQ0FCQUFBQUR3QWdBUUFBQUEwQUlBNEVBQUMyQlFBZ0tRQUF1UVVBSUNvQUFMZ0ZBQ0JMQUFDM0JRQWdUQUFBdWdVQUlKZ0NBQURDQXdBZ25BSUFBTUlEQUNDZEFnQUF3Z01BSUo0Q0FBRENBd0FnbndJQUFNSURBQ0NnQWdBQXdnTUFJS0VDQUFEQ0F3QWdvZ0lBQU1JREFDQ2pBZ0FBd2dNQUlCVGZBUUFBaWdNQU1PQUJBQURhQVFBUTRRRUFBSW9EQUREaUFRRUF6d0lBSWVVQlFBRFFBZ0FoLWdFQUFJc0RuQUlpZ0FKQUFOQUNBQ0dXQWdFQXp3SUFJWmNDQVFEUEFnQWhtQUlCQU5jQ0FDR1pBaEFBX0FJQUlab0NBUURQQWdBaG5BSUJBTmNDQUNHZEFnRUExd0lBSVo0Q0FRRFhBZ0FobndJQkFOY0NBQ0dnQWtBQWh3TUFJYUVDQVFEWEFnQWhvZ0pBQUljREFDR2pBa0FBaHdNQUlRTUFBQUFOQUNBQkFBRFpBUUF3S0FBQTJnRUFJQU1BQUFBTkFDQUJBQUFPQURBQ0FBQVBBQ0FCQUFBQUxRQWdBUUFBQUMwQUlBTUFBQUFyQUNBQkFBQXNBREFDQUFBdEFDQURBQUFBS3dBZ0FRQUFMQUF3QWdBQUxRQWdBd0FBQUNzQUlBRUFBQ3dBTUFJQUFDMEFJQWNIQUFDMUJRQWc0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCa3dJQkFBQUFBWlFDUUFBQUFBR1ZBa0FBQUFBQkFSd0FBT0lCQUNBRzRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJrd0lCQUFBQUFaUUNRQUFBQUFHVkFrQUFBQUFCQVJ3QUFPUUJBREFCSEFBQTVBRUFNQWNIQUFDMEJRQWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaGt3SUJBTHdEQUNHVUFrQUF2UU1BSVpVQ1FBRGdBd0FoQWdBQUFDMEFJQndBQU9jQkFDQUc0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaGt3SUJBTHdEQUNHVUFrQUF2UU1BSVpVQ1FBRGdBd0FoQWdBQUFDc0FJQndBQU9rQkFDQUNBQUFBS3dBZ0hBQUE2UUVBSUFNQUFBQXRBQ0FqQUFEaUFRQWdKQUFBNXdFQUlBRUFBQUF0QUNBQkFBQUFLd0FnQkFRQUFMRUZBQ0FwQUFDekJRQWdLZ0FBc2dVQUlKVUNBQURDQXdBZ0NkOEJBQUNHQXdBdzRBRUFBUEFCQUJEaEFRQUFoZ01BTU9JQkFRRFBBZ0FoNHdFQkFNOENBQ0hsQVVBQTBBSUFJWk1DQVFEUEFnQWhsQUpBQU5BQ0FDR1ZBa0FBaHdNQUlRTUFBQUFyQUNBQkFBRHZBUUF3S0FBQThBRUFJQU1BQUFBckFDQUJBQUFzQURBQ0FBQXRBQ0FCQUFBQUZBQWdBUUFBQUJRQUlBTUFBQUFTQUNBQkFBQVRBREFDQUFBVUFDQURBQUFBRWdBZ0FRQUFFd0F3QWdBQUZBQWdBd0FBQUJJQUlBRUFBQk1BTUFJQUFCUUFJQW9IQUFDREJRQWdDQUFBdmdRQUlPSUJBUUFBQUFIakFRRUFBQUFCNUFFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQVlvQ0FnQUFBQUdTQWdFQUFBQUJBUndBQVBnQkFDQUk0Z0VCQUFBQUFlTUJBUUFBQUFIa0FRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQmlnSUNBQUFBQVpJQ0FRQUFBQUVCSEFBQS1nRUFNQUVjQUFENkFRQXdDZ2NBQUlFRkFDQUlBQUM4QkFBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVRQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhpZ0lDQU0wREFDR1NBZ0VBdkFNQUlRSUFBQUFVQUNBY0FBRDlBUUFnQ09JQkFRQzhBd0FoNHdFQkFMd0RBQ0hrQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUlZb0NBZ0ROQXdBaGtnSUJBTHdEQUNFQ0FBQUFFZ0FnSEFBQV93RUFJQUlBQUFBU0FDQWNBQURfQVFBZ0F3QUFBQlFBSUNNQUFQZ0JBQ0FrQUFEOUFRQWdBUUFBQUJRQUlBRUFBQUFTQUNBRkJBQUFyQVVBSUNrQUFLOEZBQ0FxQUFDdUJRQWdTd0FBclFVQUlFd0FBTEFGQUNBTDN3RUFBSVVEQUREZ0FRQUFoZ0lBRU9FQkFBQ0ZBd0F3NGdFQkFNOENBQ0hqQVFFQXp3SUFJZVFCQVFEUEFnQWg1UUZBQU5BQ0FDSC1BU0FBMndJQUlZQUNRQURRQWdBaGlnSUNBTndDQUNHU0FnRUF6d0lBSVFNQUFBQVNBQ0FCQUFDRkFnQXdLQUFBaGdJQUlBTUFBQUFTQUNBQkFBQVRBREFDQUFBVUFDQUJBQUFBQlFBZ0FRQUFBQVVBSUFNQUFBQURBQ0FCQUFBRUFEQUNBQUFGQUNBREFBQUFBd0FnQVFBQUJBQXdBZ0FBQlFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlCUUZBQUNSQlFBZ0JnQUFxd1VBSUFzQUFKSUZBQ0FNQUFDVEJRQWdEUUFBbEFVQUlPSUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ05BZ0wtQVNBQUFBQUJnQUpBQUFBQUFZUUNBUUFBQUFHRkFnRUFBQUFCaGdJQkFBQUFBWWNDQVFBQUFBR0lBaEFBQUFBQmlRSUNBQUFBQVlvQ0NBQUFBQUdMQWdBQWtBVUFJSTBDQVFBQUFBR09BZ0VBQUFBQkFSd0FBSTRDQUNBUDRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFJMENBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUdHQWdFQUFBQUJod0lCQUFBQUFZZ0NFQUFBQUFHSkFnSUFBQUFCaWdJSUFBQUFBWXNDQUFDUUJRQWdqUUlCQUFBQUFZNENBUUFBQUFFQkhBQUFrQUlBTUFFY0FBQ1FBZ0F3RkFVQUFPd0VBQ0FHQUFDcUJRQWdDd0FBN1FRQUlBd0FBTzRFQUNBTkFBRHZCQUFnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFEcUJJMENJdjRCSUFETUF3QWhnQUpBQUwwREFDR0VBZ0VBdkFNQUlZVUNBUUM4QXdBaGhnSUJBTHdEQUNHSEFnRUF2QU1BSVlnQ0VBREpCQUFoaVFJQ0FNMERBQ0dLQWdnQTZBUUFJWXNDQUFEcEJBQWdqUUlCQUx3REFDR09BZ0VBdkFNQUlRSUFBQUFGQUNBY0FBQ1RBZ0FnRC1JQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTZnU05BaUwtQVNBQXpBTUFJWUFDUUFDOUF3QWhoQUlCQUx3REFDR0ZBZ0VBdkFNQUlZWUNBUUM4QXdBaGh3SUJBTHdEQUNHSUFoQUF5UVFBSVlrQ0FnRE5Bd0FoaWdJSUFPZ0VBQ0dMQWdBQTZRUUFJSTBDQVFDOEF3QWhqZ0lCQUx3REFDRUNBQUFBQXdBZ0hBQUFsUUlBSUFJQUFBQURBQ0FjQUFDVkFnQWdBd0FBQUFVQUlDTUFBSTRDQUNBa0FBQ1RBZ0FnQVFBQUFBVUFJQUVBQUFBREFDQUZCQUFBcFFVQUlDa0FBS2dGQUNBcUFBQ25CUUFnU3dBQXBnVUFJRXdBQUtrRkFDQVMzd0VBQVBzQ0FERGdBUUFBbkFJQUVPRUJBQUQ3QWdBdzRnRUJBTThDQUNIbEFVQUEwQUlBSWZvQkFBRF9BbzBDSXY0QklBRGJBZ0FoZ0FKQUFOQUNBQ0dFQWdFQXp3SUFJWVVDQVFEUEFnQWhoZ0lCQU04Q0FDR0hBZ0VBendJQUlZZ0NFQUQ4QWdBaGlRSUNBTndDQUNHS0FnZ0FfUUlBSVlzQ0FBRC1BZ0FnalFJQkFNOENBQ0dPQWdFQXp3SUFJUU1BQUFBREFDQUJBQUNiQWdBd0tBQUFuQUlBSUFNQUFBQURBQ0FCQUFBRUFEQUNBQUFGQUNBYUF3QUE4d0lBSUFzQUFQUUNBQ0FNQUFEMUFnQWdEZ0FBOWdJQUlBOEFBUGNDQUNBUUFBRDRBZ0FnRVFBQS1RSUFJQklBQVBvQ0FDRGZBUUFBNmdJQU1PQUJBQUNpQWdBUTRRRUFBT29DQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0h4QVFFQTZ3SUFJZklCQVFBQUFBSHpBUUVBN0FJQUlmUUJBUUFBQUFIMUFRRUE3QUlBSWZZQkFRRHNBZ0FoLUFFQUFPMEMtQUVpLWdFQUFPNEMtZ0VpX0FFQUFPOENfQUVpX1FFZ0FQQUNBQ0gtQVNBQThBSUFJZjhCQWdEeEFnQWhnQUpBQVBJQ0FDRUJBQUFBbndJQUlBRUFBQUNmQWdBZ0dnTUFBUE1DQUNBTEFBRDBBZ0FnREFBQTlRSUFJQTRBQVBZQ0FDQVBBQUQzQWdBZ0VBQUEtQUlBSUJFQUFQa0NBQ0FTQUFENkFnQWczd0VBQU9vQ0FERGdBUUFBb2dJQUVPRUJBQURxQWdBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZFQkFRRHJBZ0FoOGdFQkFPc0NBQ0h6QVFFQTdBSUFJZlFCQVFEc0FnQWg5UUVCQU93Q0FDSDJBUUVBN0FJQUlmZ0JBQUR0QXZnQkl2b0JBQUR1QXZvQkl2d0JBQUR2QXZ3Qkl2MEJJQUR3QWdBaF9nRWdBUEFDQUNIX0FRSUE4UUlBSVlBQ1FBRHlBZ0FoREFNQUFKMEZBQ0FMQUFDZUJRQWdEQUFBbndVQUlBNEFBS0FGQUNBUEFBQ2hCUUFnRUFBQW9nVUFJQkVBQUtNRkFDQVNBQUNrQlFBZzh3RUFBTUlEQUNEMEFRQUF3Z01BSVBVQkFBRENBd0FnOWdFQUFNSURBQ0FEQUFBQW9nSUFJQUVBQUtNQ0FEQUNBQUNmQWdBZ0F3QUFBS0lDQUNBQkFBQ2pBZ0F3QWdBQW53SUFJQU1BQUFDaUFnQWdBUUFBb3dJQU1BSUFBSjhDQUNBWEF3QUFsUVVBSUFzQUFKWUZBQ0FNQUFDWEJRQWdEZ0FBbUFVQUlBOEFBSmtGQUNBUUFBQ2FCUUFnRVFBQW13VUFJQklBQUp3RkFDRGlBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUh5QVFFQUFBQUI4d0VCQUFBQUFmUUJBUUFBQUFIMUFRRUFBQUFCOWdFQkFBQUFBZmdCQUFBQS1BRUMtZ0VBQUFENkFRTDhBUUFBQVB3QkF2MEJJQUFBQUFILUFTQUFBQUFCX3dFQ0FBQUFBWUFDUUFBQUFBRUJIQUFBcHdJQUlBX2lBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUh5QVFFQUFBQUI4d0VCQUFBQUFmUUJBUUFBQUFIMUFRRUFBQUFCOWdFQkFBQUFBZmdCQUFBQS1BRUMtZ0VBQUFENkFRTDhBUUFBQVB3QkF2MEJJQUFBQUFILUFTQUFBQUFCX3dFQ0FBQUFBWUFDUUFBQUFBRUJIQUFBcVFJQU1BRWNBQUNwQWdBd0Z3TUFBTTREQUNBTEFBRFBBd0FnREFBQTBBTUFJQTRBQU5FREFDQVBBQURTQXdBZ0VBQUEwd01BSUJFQUFOUURBQ0FTQUFEVkF3QWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaEFnQUFBSjhDQUNBY0FBQ3NBZ0FnRC1JQkFRQzhBd0FoNVFGQUFMMERBQ0h4QVFFQXZBTUFJZklCQVFDOEF3QWg4d0VCQU1nREFDSDBBUUVBeUFNQUlmVUJBUURJQXdBaDlnRUJBTWdEQUNINEFRQUF5UVA0QVNMNkFRQUF5Z1A2QVNMOEFRQUF5d1A4QVNMOUFTQUF6QU1BSWY0QklBRE1Bd0FoX3dFQ0FNMERBQ0dBQWtBQXZRTUFJUUlBQUFDaUFnQWdIQUFBcmdJQUlBSUFBQUNpQWdBZ0hBQUFyZ0lBSUFNQUFBQ2ZBZ0FnSXdBQXB3SUFJQ1FBQUt3Q0FDQUJBQUFBbndJQUlBRUFBQUNpQWdBZ0NRUUFBTU1EQUNBcEFBREdBd0FnS2dBQXhRTUFJRXNBQU1RREFDQk1BQURIQXdBZzh3RUFBTUlEQUNEMEFRQUF3Z01BSVBVQkFBRENBd0FnOWdFQUFNSURBQ0FTM3dFQUFOWUNBRERnQVFBQXRRSUFFT0VCQUFEV0FnQXc0Z0VCQU04Q0FDSGxBVUFBMEFJQUlmRUJBUURQQWdBaDhnRUJBTThDQUNIekFRRUExd0lBSWZRQkFRRFhBZ0FoOVFFQkFOY0NBQ0gyQVFFQTF3SUFJZmdCQUFEWUF2Z0JJdm9CQUFEWkF2b0JJdndCQUFEYUF2d0JJdjBCSUFEYkFnQWhfZ0VnQU5zQ0FDSF9BUUlBM0FJQUlZQUNRQURRQWdBaEF3QUFBS0lDQUNBQkFBQzBBZ0F3S0FBQXRRSUFJQU1BQUFDaUFnQWdBUUFBb3dJQU1BSUFBSjhDQUNBQkFBQUFHQUFnQVFBQUFCZ0FJQU1BQUFBV0FDQUJBQUFYQURBQ0FBQVlBQ0FEQUFBQUZnQWdBUUFBRndBd0FnQUFHQUFnQXdBQUFCWUFJQUVBQUJjQU1BSUFBQmdBSUFZSEFBREFBd0FnQ0FBQXdRTUFJT0lCQVFBQUFBSGpBUUVBQUFBQjVBRUJBQUFBQWVVQlFBQUFBQUVCSEFBQXZRSUFJQVRpQVFFQUFBQUI0d0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCQVJ3QUFMOENBREFCSEFBQXZ3SUFNQVlIQUFDLUF3QWdDQUFBdndNQUlPSUJBUUM4QXdBaDR3RUJBTHdEQUNIa0FRRUF2QU1BSWVVQlFBQzlBd0FoQWdBQUFCZ0FJQndBQU1JQ0FDQUU0Z0VCQUx3REFDSGpBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNFQ0FBQUFGZ0FnSEFBQXhBSUFJQUlBQUFBV0FDQWNBQURFQWdBZ0F3QUFBQmdBSUNNQUFMMENBQ0FrQUFEQ0FnQWdBUUFBQUJnQUlBRUFBQUFXQUNBREJBQUF1UU1BSUNrQUFMc0RBQ0FxQUFDNkF3QWdCOThCQUFET0FnQXc0QUVBQU1zQ0FCRGhBUUFBemdJQU1PSUJBUURQQWdBaDR3RUJBTThDQUNIa0FRRUF6d0lBSWVVQlFBRFFBZ0FoQXdBQUFCWUFJQUVBQU1vQ0FEQW9BQURMQWdBZ0F3QUFBQllBSUFFQUFCY0FNQUlBQUJnQUlBZmZBUUFBemdJQU1PQUJBQURMQWdBUTRRRUFBTTRDQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNUFFQkFNOENBQ0hsQVVBQTBBSUFJUTRFQUFEU0FnQWdLUUFBMVFJQUlDb0FBTlVDQUNEbUFRRUFBQUFCNXdFQkFBQUFCT2dCQVFBQUFBVHBBUUVBQUFBQjZnRUJBQUFBQWVzQkFRQUFBQUhzQVFFQUFBQUI3UUVCQU5RQ0FDSHVBUUVBQUFBQjd3RUJBQUFBQWZBQkFRQUFBQUVMQkFBQTBnSUFJQ2tBQU5NQ0FDQXFBQURUQWdBZzVnRkFBQUFBQWVjQlFBQUFBQVRvQVVBQUFBQUU2UUZBQUFBQUFlb0JRQUFBQUFIckFVQUFBQUFCN0FGQUFBQUFBZTBCUUFEUkFnQWhDd1FBQU5JQ0FDQXBBQURUQWdBZ0tnQUEwd0lBSU9ZQlFBQUFBQUhuQVVBQUFBQUU2QUZBQUFBQUJPa0JRQUFBQUFIcUFVQUFBQUFCNndGQUFBQUFBZXdCUUFBQUFBSHRBVUFBMFFJQUlRam1BUUlBQUFBQjV3RUNBQUFBQk9nQkFnQUFBQVRwQVFJQUFBQUI2Z0VDQUFBQUFlc0JBZ0FBQUFIc0FRSUFBQUFCN1FFQ0FOSUNBQ0VJNWdGQUFBQUFBZWNCUUFBQUFBVG9BVUFBQUFBRTZRRkFBQUFBQWVvQlFBQUFBQUhyQVVBQUFBQUI3QUZBQUFBQUFlMEJRQURUQWdBaERnUUFBTklDQUNBcEFBRFZBZ0FnS2dBQTFRSUFJT1lCQVFBQUFBSG5BUUVBQUFBRTZBRUJBQUFBQk9rQkFRQUFBQUhxQVFFQUFBQUI2d0VCQUFBQUFld0JBUUFBQUFIdEFRRUExQUlBSWU0QkFRQUFBQUh2QVFFQUFBQUI4QUVCQUFBQUFRdm1BUUVBQUFBQjV3RUJBQUFBQk9nQkFRQUFBQVRwQVFFQUFBQUI2Z0VCQUFBQUFlc0JBUUFBQUFIc0FRRUFBQUFCN1FFQkFOVUNBQ0h1QVFFQUFBQUI3d0VCQUFBQUFmQUJBUUFBQUFFUzN3RUFBTllDQUREZ0FRQUF0UUlBRU9FQkFBRFdBZ0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZkVCQVFEUEFnQWg4Z0VCQU04Q0FDSHpBUUVBMXdJQUlmUUJBUURYQWdBaDlRRUJBTmNDQUNIMkFRRUExd0lBSWZnQkFBRFlBdmdCSXZvQkFBRFpBdm9CSXZ3QkFBRGFBdndCSXYwQklBRGJBZ0FoX2dFZ0FOc0NBQ0hfQVFJQTNBSUFJWUFDUUFEUUFnQWhEZ1FBQU9nQ0FDQXBBQURwQWdBZ0tnQUE2UUlBSU9ZQkFRQUFBQUhuQVFFQUFBQUY2QUVCQUFBQUJla0JBUUFBQUFIcUFRRUFBQUFCNndFQkFBQUFBZXdCQVFBQUFBSHRBUUVBNXdJQUllNEJBUUFBQUFIdkFRRUFBQUFCOEFFQkFBQUFBUWNFQUFEU0FnQWdLUUFBNWdJQUlDb0FBT1lDQUNEbUFRQUFBUGdCQXVjQkFBQUEtQUVJNkFFQUFBRDRBUWp0QVFBQTVRTDRBU0lIQkFBQTBnSUFJQ2tBQU9RQ0FDQXFBQURrQWdBZzVnRUFBQUQ2QVFMbkFRQUFBUG9CQ09nQkFBQUEtZ0VJN1FFQUFPTUMtZ0VpQndRQUFOSUNBQ0FwQUFEaUFnQWdLZ0FBNGdJQUlPWUJBQUFBX0FFQzV3RUFBQUQ4QVFqb0FRQUFBUHdCQ08wQkFBRGhBdndCSWdVRUFBRFNBZ0FnS1FBQTRBSUFJQ29BQU9BQ0FDRG1BU0FBQUFBQjdRRWdBTjhDQUNFTkJBQUEwZ0lBSUNrQUFOSUNBQ0FxQUFEU0FnQWdTd0FBM2dJQUlFd0FBTklDQUNEbUFRSUFBQUFCNXdFQ0FBQUFCT2dCQWdBQUFBVHBBUUlBQUFBQjZnRUNBQUFBQWVzQkFnQUFBQUhzQVFJQUFBQUI3UUVDQU4wQ0FDRU5CQUFBMGdJQUlDa0FBTklDQUNBcUFBRFNBZ0FnU3dBQTNnSUFJRXdBQU5JQ0FDRG1BUUlBQUFBQjV3RUNBQUFBQk9nQkFnQUFBQVRwQVFJQUFBQUI2Z0VDQUFBQUFlc0JBZ0FBQUFIc0FRSUFBQUFCN1FFQ0FOMENBQ0VJNWdFSUFBQUFBZWNCQ0FBQUFBVG9BUWdBQUFBRTZRRUlBQUFBQWVvQkNBQUFBQUhyQVFnQUFBQUI3QUVJQUFBQUFlMEJDQURlQWdBaEJRUUFBTklDQUNBcEFBRGdBZ0FnS2dBQTRBSUFJT1lCSUFBQUFBSHRBU0FBM3dJQUlRTG1BU0FBQUFBQjdRRWdBT0FDQUNFSEJBQUEwZ0lBSUNrQUFPSUNBQ0FxQUFEaUFnQWc1Z0VBQUFEOEFRTG5BUUFBQVB3QkNPZ0JBQUFBX0FFSTdRRUFBT0VDX0FFaUJPWUJBQUFBX0FFQzV3RUFBQUQ4QVFqb0FRQUFBUHdCQ08wQkFBRGlBdndCSWdjRUFBRFNBZ0FnS1FBQTVBSUFJQ29BQU9RQ0FDRG1BUUFBQVBvQkF1Y0JBQUFBLWdFSTZBRUFBQUQ2QVFqdEFRQUE0d0w2QVNJRTVnRUFBQUQ2QVFMbkFRQUFBUG9CQ09nQkFBQUEtZ0VJN1FFQUFPUUMtZ0VpQndRQUFOSUNBQ0FwQUFEbUFnQWdLZ0FBNWdJQUlPWUJBQUFBLUFFQzV3RUFBQUQ0QVFqb0FRQUFBUGdCQ08wQkFBRGxBdmdCSWdUbUFRQUFBUGdCQXVjQkFBQUEtQUVJNkFFQUFBRDRBUWp0QVFBQTVnTDRBU0lPQkFBQTZBSUFJQ2tBQU9rQ0FDQXFBQURwQWdBZzVnRUJBQUFBQWVjQkFRQUFBQVhvQVFFQUFBQUY2UUVCQUFBQUFlb0JBUUFBQUFIckFRRUFBQUFCN0FFQkFBQUFBZTBCQVFEbkFnQWg3Z0VCQUFBQUFlOEJBUUFBQUFId0FRRUFBQUFCQ09ZQkFnQUFBQUhuQVFJQUFBQUY2QUVDQUFBQUJla0JBZ0FBQUFIcUFRSUFBQUFCNndFQ0FBQUFBZXdCQWdBQUFBSHRBUUlBNkFJQUlRdm1BUUVBQUFBQjV3RUJBQUFBQmVnQkFRQUFBQVhwQVFFQUFBQUI2Z0VCQUFBQUFlc0JBUUFBQUFIc0FRRUFBQUFCN1FFQkFPa0NBQ0h1QVFFQUFBQUI3d0VCQUFBQUFmQUJBUUFBQUFFYUF3QUE4d0lBSUFzQUFQUUNBQ0FNQUFEMUFnQWdEZ0FBOWdJQUlBOEFBUGNDQUNBUUFBRDRBZ0FnRVFBQS1RSUFJQklBQVBvQ0FDRGZBUUFBNmdJQU1PQUJBQUNpQWdBUTRRRUFBT29DQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoOFFFQkFPc0NBQ0h5QVFFQTZ3SUFJZk1CQVFEc0FnQWg5QUVCQU93Q0FDSDFBUUVBN0FJQUlmWUJBUURzQWdBaC1BRUFBTzBDLUFFaS1nRUFBTzRDLWdFaV9BRUFBTzhDX0FFaV9RRWdBUEFDQUNILUFTQUE4QUlBSWY4QkFnRHhBZ0FoZ0FKQUFQSUNBQ0VMNWdFQkFBQUFBZWNCQVFBQUFBVG9BUUVBQUFBRTZRRUJBQUFBQWVvQkFRQUFBQUhyQVFFQUFBQUI3QUVCQUFBQUFlMEJBUURWQWdBaDdnRUJBQUFBQWU4QkFRQUFBQUh3QVFFQUFBQUJDLVlCQVFBQUFBSG5BUUVBQUFBRjZBRUJBQUFBQmVrQkFRQUFBQUhxQVFFQUFBQUI2d0VCQUFBQUFld0JBUUFBQUFIdEFRRUE2UUlBSWU0QkFRQUFBQUh2QVFFQUFBQUI4QUVCQUFBQUFRVG1BUUFBQVBnQkF1Y0JBQUFBLUFFSTZBRUFBQUQ0QVFqdEFRQUE1Z0w0QVNJRTVnRUFBQUQ2QVFMbkFRQUFBUG9CQ09nQkFBQUEtZ0VJN1FFQUFPUUMtZ0VpQk9ZQkFBQUFfQUVDNXdFQUFBRDhBUWpvQVFBQUFQd0JDTzBCQUFEaUF2d0JJZ0xtQVNBQUFBQUI3UUVnQU9BQ0FDRUk1Z0VDQUFBQUFlY0JBZ0FBQUFUb0FRSUFBQUFFNlFFQ0FBQUFBZW9CQWdBQUFBSHJBUUlBQUFBQjdBRUNBQUFBQWUwQkFnRFNBZ0FoQ09ZQlFBQUFBQUhuQVVBQUFBQUU2QUZBQUFBQUJPa0JRQUFBQUFIcUFVQUFBQUFCNndGQUFBQUFBZXdCUUFBQUFBSHRBVUFBMHdJQUlRT0JBZ0FBQXdBZ2dnSUFBQU1BSUlNQ0FBQURBQ0FEZ1FJQUFBa0FJSUlDQUFBSkFDQ0RBZ0FBQ1FBZ0E0RUNBQUFTQUNDQ0FnQUFFZ0FnZ3dJQUFCSUFJQU9CQWdBQUh3QWdnZ0lBQUI4QUlJTUNBQUFmQUNBRGdRSUFBQllBSUlJQ0FBQVdBQ0NEQWdBQUZnQWdBNEVDQUFBa0FDQ0NBZ0FBSkFBZ2d3SUFBQ1FBSUFPQkFnQUFLQUFnZ2dJQUFDZ0FJSU1DQUFBb0FDQURnUUlBQUNzQUlJSUNBQUFyQUNDREFnQUFLd0FnRXQ4QkFBRDdBZ0F3NEFFQUFKd0NBQkRoQVFBQS13SUFNT0lCQVFEUEFnQWg1UUZBQU5BQ0FDSDZBUUFBX3dLTkFpTC1BU0FBMndJQUlZQUNRQURRQWdBaGhBSUJBTThDQUNHRkFnRUF6d0lBSVlZQ0FRRFBBZ0FoaHdJQkFNOENBQ0dJQWhBQV9BSUFJWWtDQWdEY0FnQWhpZ0lJQVAwQ0FDR0xBZ0FBX2dJQUlJMENBUURQQWdBaGpnSUJBTThDQUNFTkJBQUEwZ0lBSUNrQUFJUURBQ0FxQUFDRUF3QWdTd0FBaEFNQUlFd0FBSVFEQUNEbUFSQUFBQUFCNXdFUUFBQUFCT2dCRUFBQUFBVHBBUkFBQUFBQjZnRVFBQUFBQWVzQkVBQUFBQUhzQVJBQUFBQUI3UUVRQUlNREFDRU5CQUFBMGdJQUlDa0FBTjRDQUNBcUFBRGVBZ0FnU3dBQTNnSUFJRXdBQU40Q0FDRG1BUWdBQUFBQjV3RUlBQUFBQk9nQkNBQUFBQVRwQVFnQUFBQUI2Z0VJQUFBQUFlc0JDQUFBQUFIc0FRZ0FBQUFCN1FFSUFJSURBQ0VFNWdFQkFBQUFCWThDQVFBQUFBR1FBZ0VBQUFBRWtRSUJBQUFBQkFjRUFBRFNBZ0FnS1FBQWdRTUFJQ29BQUlFREFDRG1BUUFBQUkwQ0F1Y0JBQUFBalFJSTZBRUFBQUNOQWdqdEFRQUFnQU9OQWlJSEJBQUEwZ0lBSUNrQUFJRURBQ0FxQUFDQkF3QWc1Z0VBQUFDTkFnTG5BUUFBQUkwQ0NPZ0JBQUFBalFJSTdRRUFBSUFEalFJaUJPWUJBQUFBalFJQzV3RUFBQUNOQWdqb0FRQUFBSTBDQ08wQkFBQ0JBNDBDSWcwRUFBRFNBZ0FnS1FBQTNnSUFJQ29BQU40Q0FDQkxBQURlQWdBZ1RBQUEzZ0lBSU9ZQkNBQUFBQUhuQVFnQUFBQUU2QUVJQUFBQUJPa0JDQUFBQUFIcUFRZ0FBQUFCNndFSUFBQUFBZXdCQ0FBQUFBSHRBUWdBZ2dNQUlRMEVBQURTQWdBZ0tRQUFoQU1BSUNvQUFJUURBQ0JMQUFDRUF3QWdUQUFBaEFNQUlPWUJFQUFBQUFIbkFSQUFBQUFFNkFFUUFBQUFCT2tCRUFBQUFBSHFBUkFBQUFBQjZ3RVFBQUFBQWV3QkVBQUFBQUh0QVJBQWd3TUFJUWptQVJBQUFBQUI1d0VRQUFBQUJPZ0JFQUFBQUFUcEFSQUFBQUFCNmdFUUFBQUFBZXNCRUFBQUFBSHNBUkFBQUFBQjdRRVFBSVFEQUNFTDN3RUFBSVVEQUREZ0FRQUFoZ0lBRU9FQkFBQ0ZBd0F3NGdFQkFNOENBQ0hqQVFFQXp3SUFJZVFCQVFEUEFnQWg1UUZBQU5BQ0FDSC1BU0FBMndJQUlZQUNRQURRQWdBaGlnSUNBTndDQUNHU0FnRUF6d0lBSVFuZkFRQUFoZ01BTU9BQkFBRHdBUUFRNFFFQUFJWURBRERpQVFFQXp3SUFJZU1CQVFEUEFnQWg1UUZBQU5BQ0FDR1RBZ0VBendJQUlaUUNRQURRQWdBaGxRSkFBSWNEQUNFTEJBQUE2QUlBSUNrQUFJa0RBQ0FxQUFDSkF3QWc1Z0ZBQUFBQUFlY0JRQUFBQUFYb0FVQUFBQUFGNlFGQUFBQUFBZW9CUUFBQUFBSHJBVUFBQUFBQjdBRkFBQUFBQWUwQlFBQ0lBd0FoQ3dRQUFPZ0NBQ0FwQUFDSkF3QWdLZ0FBaVFNQUlPWUJRQUFBQUFIbkFVQUFBQUFGNkFGQUFBQUFCZWtCUUFBQUFBSHFBVUFBQUFBQjZ3RkFBQUFBQWV3QlFBQUFBQUh0QVVBQWlBTUFJUWptQVVBQUFBQUI1d0ZBQUFBQUJlZ0JRQUFBQUFYcEFVQUFBQUFCNmdGQUFBQUFBZXNCUUFBQUFBSHNBVUFBQUFBQjdRRkFBSWtEQUNFVTN3RUFBSW9EQUREZ0FRQUEyZ0VBRU9FQkFBQ0tBd0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZm9CQUFDTEE1d0NJb0FDUUFEUUFnQWhsZ0lCQU04Q0FDR1hBZ0VBendJQUlaZ0NBUURYQWdBaG1RSVFBUHdDQUNHYUFnRUF6d0lBSVp3Q0FRRFhBZ0FoblFJQkFOY0NBQ0dlQWdFQTF3SUFJWjhDQVFEWEFnQWhvQUpBQUljREFDR2hBZ0VBMXdJQUlhSUNRQUNIQXdBaG93SkFBSWNEQUNFSEJBQUEwZ0lBSUNrQUFJMERBQ0FxQUFDTkF3QWc1Z0VBQUFDY0FnTG5BUUFBQUp3Q0NPZ0JBQUFBbkFJSTdRRUFBSXdEbkFJaUJ3UUFBTklDQUNBcEFBQ05Bd0FnS2dBQWpRTUFJT1lCQUFBQW5BSUM1d0VBQUFDY0Fnam9BUUFBQUp3Q0NPMEJBQUNNQTV3Q0lnVG1BUUFBQUp3Q0F1Y0JBQUFBbkFJSTZBRUFBQUNjQWdqdEFRQUFqUU9jQWlJTDN3RUFBSTREQUREZ0FRQUF4QUVBRU9FQkFBQ09Bd0F3NGdFQkFNOENBQ0hqQVFFQXp3SUFJZVVCUUFEUUFnQWhoQUlCQU04Q0FDR2xBZ0FBandPbEFpS21BZ0VBendJQUlhY0NBUURYQWdBaHFBSWdBTnNDQUNFSEJBQUEwZ0lBSUNrQUFKRURBQ0FxQUFDUkF3QWc1Z0VBQUFDbEFnTG5BUUFBQUtVQ0NPZ0JBQUFBcFFJSTdRRUFBSkFEcFFJaUJ3UUFBTklDQUNBcEFBQ1JBd0FnS2dBQWtRTUFJT1lCQUFBQXBRSUM1d0VBQUFDbEFnam9BUUFBQUtVQ0NPMEJBQUNRQTZVQ0lnVG1BUUFBQUtVQ0F1Y0JBQUFBcFFJSTZBRUFBQUNsQWdqdEFRQUFrUU9sQWlJTDN3RUFBSklEQUREZ0FRQUFyZ0VBRU9FQkFBQ1NBd0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZkVCQVFEUEFnQWg4Z0VCQU04Q0FDR0FBa0FBMEFJQUlhWUNBUURQQWdBaHFRSUJBTThDQUNHcUFpQUEyd0lBSVF2ZkFRQUFrd01BTU9BQkFBQ2JBUUFRNFFFQUFKTURBRERpQVFFQTZ3SUFJZVVCUUFEeUFnQWg4UUVCQU9zQ0FDSHlBUUVBNndJQUlZQUNRQUR5QWdBaHBnSUJBT3NDQUNHcEFnRUE2d0lBSWFvQ0lBRHdBZ0FoQ044QkFBQ1VBd0F3NEFFQUFKVUJBQkRoQVFBQWxBTUFNT0lCQVFEUEFnQWg1UUZBQU5BQ0FDSHhBUUVBendJQUlZQUNRQURRQWdBaGhRSUJBTThDQUNFSkF3QUE4d0lBSU44QkFBQ1ZBd0F3NEFFQUFJSUJBQkRoQVFBQWxRTUFNT0lCQVFEckFnQWg1UUZBQVBJQ0FDSHhBUUVBNndJQUlZQUNRQUR5QWdBaGhRSUJBT3NDQUNFTTN3RUFBSllEQUREZ0FRQUFmQUFRNFFFQUFKWURBRERpQVFFQXp3SUFJZU1CQVFEUEFnQWg1QUVCQU04Q0FDSGxBVUFBMEFJQUlmb0JBQUNYQTY4Q0lvQUNRQURRQWdBaHF3SkFBTkFDQUNHc0FnSUEzQUlBSWEwQ0VBRDhBZ0FoQndRQUFOSUNBQ0FwQUFDWkF3QWdLZ0FBbVFNQUlPWUJBQUFBcndJQzV3RUFBQUN2QWdqb0FRQUFBSzhDQ08wQkFBQ1lBNjhDSWdjRUFBRFNBZ0FnS1FBQW1RTUFJQ29BQUprREFDRG1BUUFBQUs4Q0F1Y0JBQUFBcndJSTZBRUFBQUN2QWdqdEFRQUFtQU92QWlJRTVnRUFBQUN2QWdMbkFRQUFBSzhDQ09nQkFBQUFyd0lJN1FFQUFKa0Ryd0lpRHQ4QkFBQ2FBd0F3NEFFQUFHWUFFT0VCQUFDYUF3QXc0Z0VCQU04Q0FDSGxBVUFBMEFJQUlmb0JBQUNiQTdNQ0l2NEJJQURiQWdBaGdBSkFBTkFDQUNHRUFnRUF6d0lBSVlVQ0FRRFBBZ0FocndJQkFNOENBQ0d3QWdFQXp3SUFJYkVDQVFEUEFnQWhzd0lCQU04Q0FDRUhCQUFBMGdJQUlDa0FBSjBEQUNBcUFBQ2RBd0FnNWdFQUFBQ3pBZ0xuQVFBQUFMTUNDT2dCQUFBQXN3SUk3UUVBQUp3RHN3SWlCd1FBQU5JQ0FDQXBBQUNkQXdBZ0tnQUFuUU1BSU9ZQkFBQUFzd0lDNXdFQUFBQ3pBZ2pvQVFBQUFMTUNDTzBCQUFDY0E3TUNJZ1RtQVFBQUFMTUNBdWNCQUFBQXN3SUk2QUVBQUFDekFnanRBUUFBblFPekFpSUwzd0VBQUo0REFERGdBUUFBVUFBUTRRRUFBSjREQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNVFGQUFOQUNBQ0gtQVNBQTJ3SUFJWUFDUUFEUUFnQWhzQUlCQU04Q0FDRzBBZ0VBendJQUliVUNBUURYQWdBaENnY0FBS0VEQUNEZkFRQUFud01BTU9BQkFBQXJBQkRoQVFBQW53TUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlaTUNBUURyQWdBaGxBSkFBUElDQUNHVkFrQUFvQU1BSVFqbUFVQUFBQUFCNXdGQUFBQUFCZWdCUUFBQUFBWHBBVUFBQUFBQjZnRkFBQUFBQWVzQlFBQUFBQUhzQVVBQUFBQUI3UUZBQUlrREFDRWNBd0FBOHdJQUlBc0FBUFFDQUNBTUFBRDFBZ0FnRGdBQTlnSUFJQThBQVBjQ0FDQVFBQUQ0QWdBZ0VRQUEtUUlBSUJJQUFQb0NBQ0RmQVFBQTZnSUFNT0FCQUFDaUFnQVE0UUVBQU9vQ0FERGlBUUVBNndJQUllVUJRQUR5QWdBaDhRRUJBT3NDQUNIeUFRRUE2d0lBSWZNQkFRRHNBZ0FoOUFFQkFPd0NBQ0gxQVFFQTdBSUFJZllCQVFEc0FnQWgtQUVBQU8wQy1BRWktZ0VBQU80Qy1nRWlfQUVBQU84Q19BRWlfUUVnQVBBQ0FDSC1BU0FBOEFJQUlmOEJBZ0R4QWdBaGdBSkFBUElDQUNHM0FnQUFvZ0lBSUxnQ0FBQ2lBZ0FnRHdjQUFLRURBQ0FVQUFDakF3QWdGUUFBcEFNQUlCWUFBUGtDQUNEZkFRQUFvZ01BTU9BQkFBQW9BQkRoQVFBQW9nTUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlmNEJJQUR3QWdBaGdBSkFBUElDQUNHd0FnRUE2d0lBSWJRQ0FRRHJBZ0FodFFJQkFPd0NBQ0VTRVFBQS1RSUFJQk1BQUtFREFDRGZBUUFBcHdNQU1PQUJBQUFmQUJEaEFRQUFwd01BTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0g2QVFBQXFBT3pBaUwtQVNBQThBSUFJWUFDUUFEeUFnQWhoQUlCQU9zQ0FDR0ZBZ0VBNndJQUlhOENBUURyQWdBaHNBSUJBT3NDQUNHeEFnRUE2d0lBSWJNQ0FRRHJBZ0FodHdJQUFCOEFJTGdDQUFBZkFDQVJCd0FBb1FNQUlCUUFBS01EQUNBVkFBQ2tBd0FnRmdBQS1RSUFJTjhCQUFDaUF3QXc0QUVBQUNnQUVPRUJBQUNpQXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVVQlFBRHlBZ0FoX2dFZ0FQQUNBQ0dBQWtBQThnSUFJYkFDQVFEckFnQWh0QUlCQU9zQ0FDRzFBZ0VBN0FJQUliY0NBQUFvQUNDNEFnQUFLQUFnREFjQUFLRURBQ0RmQVFBQXBRTUFNT0FCQUFBa0FCRGhBUUFBcFFNQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIbEFVQUE4Z0lBSVlRQ0FRRHJBZ0FocFFJQUFLWURwUUlpcGdJQkFPc0NBQ0duQWdFQTdBSUFJYWdDSUFEd0FnQWhCT1lCQUFBQXBRSUM1d0VBQUFDbEFnam9BUUFBQUtVQ0NPMEJBQUNSQTZVQ0loQVJBQUQ1QWdBZ0V3QUFvUU1BSU44QkFBQ25Bd0F3NEFFQUFCOEFFT0VCQUFDbkF3QXc0Z0VCQU9zQ0FDSGxBVUFBOGdJQUlmb0JBQUNvQTdNQ0l2NEJJQUR3QWdBaGdBSkFBUElDQUNHRUFnRUE2d0lBSVlVQ0FRRHJBZ0FocndJQkFPc0NBQ0d3QWdFQTZ3SUFJYkVDQVFEckFnQWhzd0lCQU9zQ0FDRUU1Z0VBQUFDekFnTG5BUUFBQUxNQ0NPZ0JBQUFBc3dJSTdRRUFBSjBEc3dJaUF1TUJBUUFBQUFIa0FRRUFBQUFCQ1FjQUFLRURBQ0FJQUFDckF3QWczd0VBQUtvREFERGdBUUFBRmdBUTRRRUFBS29EQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJUmtGQUFDNEF3QWdCZ0FBb1FNQUlBc0FBUFFDQUNBTUFBRDFBZ0FnRFFBQTl3SUFJTjhCQUFDMUF3QXc0QUVBQUFNQUVPRUJBQUMxQXdBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQzNBNDBDSXY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0dFQWdFQTZ3SUFJWVVDQVFEckFnQWhoZ0lCQU9zQ0FDR0hBZ0VBNndJQUlZZ0NFQUN2QXdBaGlRSUNBUEVDQUNHS0FnZ0F0Z01BSVlzQ0FBRC1BZ0FnalFJQkFPc0NBQ0dPQWdFQTZ3SUFJYmNDQUFBREFDQzRBZ0FBQXdBZ0F1TUJBUUFBQUFIa0FRRUFBQUFCRFFjQUFLRURBQ0FJQUFDckF3QWczd0VBQUswREFERGdBUUFBRWdBUTRRRUFBSzBEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0tBZ0lBOFFJQUlaSUNBUURyQWdBaEZRa0FBTEVEQUNEZkFRQUFyZ01BTU9BQkFBQU5BQkRoQVFBQXJnTUFNT0lCQVFEckFnQWg1UUZBQVBJQ0FDSDZBUUFBc0FPY0FpS0FBa0FBOGdJQUlaWUNBUURyQWdBaGx3SUJBT3NDQUNHWUFnRUE3QUlBSVprQ0VBQ3ZBd0FobWdJQkFPc0NBQ0djQWdFQTdBSUFJWjBDQVFEc0FnQWhuZ0lCQU93Q0FDR2ZBZ0VBN0FJQUlhQUNRQUNnQXdBaG9RSUJBT3dDQUNHaUFrQUFvQU1BSWFNQ1FBQ2dBd0FoQ09ZQkVBQUFBQUhuQVJBQUFBQUU2QUVRQUFBQUJPa0JFQUFBQUFIcUFSQUFBQUFCNndFUUFBQUFBZXdCRUFBQUFBSHRBUkFBaEFNQUlRVG1BUUFBQUp3Q0F1Y0JBQUFBbkFJSTZBRUFBQUNjQWdqdEFRQUFqUU9jQWlJUkJ3QUFvUU1BSUFnQUFLc0RBQ0FLQUFDMEF3QWczd0VBQUxJREFERGdBUUFBQ1FBUTRRRUFBTElEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDekE2OENJb0FDUUFEeUFnQWhxd0pBQVBJQ0FDR3NBZ0lBOFFJQUlhMENFQUN2QXdBaHR3SUFBQWtBSUxnQ0FBQUpBQ0FQQndBQW9RTUFJQWdBQUtzREFDQUtBQUMwQXdBZzN3RUFBTElEQUREZ0FRQUFDUUFRNFFFQUFMSURBRERpQVFFQTZ3SUFJZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUlmb0JBQUN6QTY4Q0lvQUNRQUR5QWdBaHF3SkFBUElDQUNHc0FnSUE4UUlBSWEwQ0VBQ3ZBd0FoQk9ZQkFBQUFyd0lDNXdFQUFBQ3ZBZ2pvQVFBQUFLOENDTzBCQUFDWkE2OENJZ09CQWdBQURRQWdnZ0lBQUEwQUlJTUNBQUFOQUNBWEJRQUF1QU1BSUFZQUFLRURBQ0FMQUFEMEFnQWdEQUFBOVFJQUlBMEFBUGNDQUNEZkFRQUF0UU1BTU9BQkFBQURBQkRoQVFBQXRRTUFNT0lCQVFEckFnQWg1UUZBQVBJQ0FDSDZBUUFBdHdPTkFpTC1BU0FBOEFJQUlZQUNRQUR5QWdBaGhBSUJBT3NDQUNHRkFnRUE2d0lBSVlZQ0FRRHJBZ0FoaHdJQkFPc0NBQ0dJQWhBQXJ3TUFJWWtDQWdEeEFnQWhpZ0lJQUxZREFDR0xBZ0FBX2dJQUlJMENBUURyQWdBaGpnSUJBT3NDQUNFSTVnRUlBQUFBQWVjQkNBQUFBQVRvQVFnQUFBQUU2UUVJQUFBQUFlb0JDQUFBQUFIckFRZ0FBQUFCN0FFSUFBQUFBZTBCQ0FEZUFnQWhCT1lCQUFBQWpRSUM1d0VBQUFDTkFnam9BUUFBQUkwQ0NPMEJBQUNCQTQwQ0lnc0RBQUR6QWdBZzN3RUFBSlVEQUREZ0FRQUFnZ0VBRU9FQkFBQ1ZBd0F3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZkVCQVFEckFnQWhnQUpBQVBJQ0FDR0ZBZ0VBNndJQUliY0NBQUNDQVFBZ3VBSUFBSUlCQUNBQUFBQUJ2QUlCQUFBQUFRRzhBa0FBQUFBQkJTTUFBTGtHQUNBa0FBQ19CZ0FndVFJQUFMb0dBQ0M2QWdBQXZnWUFJTDhDQUFDZkFnQWdCU01BQUxjR0FDQWtBQUM4QmdBZ3VRSUFBTGdHQUNDNkFnQUF1d1lBSUw4Q0FBQUZBQ0FESXdBQXVRWUFJTGtDQUFDNkJnQWd2d0lBQUo4Q0FDQURJd0FBdHdZQUlMa0NBQUM0QmdBZ3Z3SUFBQVVBSUFBQUFBQUFBQUc4QWdFQUFBQUJBYndDQUFBQS1BRUNBYndDQUFBQS1nRUNBYndDQUFBQV9BRUNBYndDSUFBQUFBRUZ2QUlDQUFBQUFjTUNBZ0FBQUFIRUFnSUFBQUFCeFFJQ0FBQUFBY1lDQWdBQUFBRUxJd0FBM2dRQU1DUUFBT01FQURDNUFnQUEzd1FBTUxvQ0FBRGdCQUF3dXdJQUFPRUVBQ0M4QWdBQTRnUUFNTDBDQUFEaUJBQXd2Z0lBQU9JRUFEQ19BZ0FBNGdRQU1NQUNBQURrQkFBd3dRSUFBT1VFQURBTEl3QUF2d1FBTUNRQUFNUUVBREM1QWdBQXdBUUFNTG9DQUFEQkJBQXd1d0lBQU1JRUFDQzhBZ0FBd3dRQU1MMENBQUREQkFBd3ZnSUFBTU1FQURDX0FnQUF3d1FBTU1BQ0FBREZCQUF3d1FJQUFNWUVBREFMSXdBQXNRUUFNQ1FBQUxZRUFEQzVBZ0FBc2dRQU1Mb0NBQUN6QkFBd3V3SUFBTFFFQUNDOEFnQUF0UVFBTUwwQ0FBQzFCQUF3dmdJQUFMVUVBRENfQWdBQXRRUUFNTUFDQUFDM0JBQXd3UUlBQUxnRUFEQUxJd0FBbVFRQU1DUUFBSjRFQURDNUFnQUFtZ1FBTUxvQ0FBQ2JCQUF3dXdJQUFKd0VBQ0M4QWdBQW5RUUFNTDBDQUFDZEJBQXd2Z0lBQUowRUFEQ19BZ0FBblFRQU1NQUNBQUNmQkFBd3dRSUFBS0FFQURBTEl3QUFqUVFBTUNRQUFKSUVBREM1QWdBQWpnUUFNTG9DQUFDUEJBQXd1d0lBQUpBRUFDQzhBZ0FBa1FRQU1MMENBQUNSQkFBd3ZnSUFBSkVFQURDX0FnQUFrUVFBTU1BQ0FBQ1RCQUF3d1FJQUFKUUVBREFMSXdBQWdBUUFNQ1FBQUlVRUFEQzVBZ0FBZ1FRQU1Mb0NBQUNDQkFBd3V3SUFBSU1FQUNDOEFnQUFoQVFBTUwwQ0FBQ0VCQUF3dmdJQUFJUUVBRENfQWdBQWhBUUFNTUFDQUFDR0JBQXd3UUlBQUljRUFEQUxJd0FBNHdNQU1DUUFBT2dEQURDNUFnQUE1QU1BTUxvQ0FBRGxBd0F3dXdJQUFPWURBQ0M4QWdBQTV3TUFNTDBDQUFEbkF3QXd2Z0lBQU9jREFEQ19BZ0FBNXdNQU1NQUNBQURwQXdBd3dRSUFBT29EQURBTEl3QUExZ01BTUNRQUFOc0RBREM1QWdBQTF3TUFNTG9DQUFEWUF3QXd1d0lBQU5rREFDQzhBZ0FBMmdNQU1MMENBQURhQXdBd3ZnSUFBTm9EQURDX0FnQUEyZ01BTU1BQ0FBRGNBd0F3d1FJQUFOMERBREFGNGdFQkFBQUFBZVVCUUFBQUFBR1RBZ0VBQUFBQmxBSkFBQUFBQVpVQ1FBQUFBQUVDQUFBQUxRQWdJd0FBNGdNQUlBTUFBQUF0QUNBakFBRGlBd0FnSkFBQTRRTUFJQUVjQUFDMkJnQXdDZ2NBQUtFREFDRGZBUUFBbndNQU1PQUJBQUFyQUJEaEFRQUFud01BTU9JQkFRQUFBQUhqQVFFQTZ3SUFJZVVCUUFEeUFnQWhrd0lCQUFBQUFaUUNRQUR5QWdBaGxRSkFBS0FEQUNFQ0FBQUFMUUFnSEFBQTRRTUFJQUlBQUFEZUF3QWdIQUFBM3dNQUlBbmZBUUFBM1FNQU1PQUJBQURlQXdBUTRRRUFBTjBEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNVFGQUFQSUNBQ0dUQWdFQTZ3SUFJWlFDUUFEeUFnQWhsUUpBQUtBREFDRUozd0VBQU4wREFERGdBUUFBM2dNQUVPRUJBQURkQXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVVQlFBRHlBZ0Foa3dJQkFPc0NBQ0dVQWtBQThnSUFJWlVDUUFDZ0F3QWhCZUlCQVFDOEF3QWg1UUZBQUwwREFDR1RBZ0VBdkFNQUlaUUNRQUM5QXdBaGxRSkFBT0FEQUNFQnZBSkFBQUFBQVFYaUFRRUF2QU1BSWVVQlFBQzlBd0Foa3dJQkFMd0RBQ0dVQWtBQXZRTUFJWlVDUUFEZ0F3QWhCZUlCQVFBQUFBSGxBVUFBQUFBQmt3SUJBQUFBQVpRQ1FBQUFBQUdWQWtBQUFBQUJDaFFBQVBzREFDQVZBQURfQXdBZ0ZnQUFfUU1BSU9JQkFRQUFBQUhsQVVBQUFBQUJfZ0VnQUFBQUFZQUNRQUFBQUFHd0FnRUFBQUFCdEFJQkFBQUFBYlVDQVFBQUFBRUNBQUFBQVFBZ0l3QUFfZ01BSUFNQUFBQUJBQ0FqQUFELUF3QWdKQUFBN1FNQUlBRWNBQUMxQmdBd0R3Y0FBS0VEQUNBVUFBQ2pBd0FnRlFBQXBBTUFJQllBQVBrQ0FDRGZBUUFBb2dNQU1PQUJBQUFvQUJEaEFRQUFvZ01BTU9JQkFRQUFBQUhqQVFFQTZ3SUFJZVVCUUFEeUFnQWhfZ0VnQVBBQ0FDR0FBa0FBOGdJQUliQUNBUURyQWdBaHRBSUJBT3NDQUNHMUFnRUE3QUlBSVFJQUFBQUJBQ0FjQUFEdEF3QWdBZ0FBQU9zREFDQWNBQURzQXdBZ0M5OEJBQURxQXdBdzRBRUFBT3NEQUJEaEFRQUE2Z01BTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR3dBZ0VBNndJQUliUUNBUURyQWdBaHRRSUJBT3dDQUNFTDN3RUFBT29EQUREZ0FRQUE2d01BRU9FQkFBRHFBd0F3NGdFQkFPc0NBQ0hqQVFFQTZ3SUFJZVVCUUFEeUFnQWhfZ0VnQVBBQ0FDR0FBa0FBOGdJQUliQUNBUURyQWdBaHRBSUJBT3NDQUNHMUFnRUE3QUlBSVFmaUFRRUF2QU1BSWVVQlFBQzlBd0FoX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJYkFDQVFDOEF3QWh0QUlCQUx3REFDRzFBZ0VBeUFNQUlRb1VBQUR1QXdBZ0ZRQUE3d01BSUJZQUFQQURBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUliQUNBUUM4QXdBaHRBSUJBTHdEQUNHMUFnRUF5QU1BSVFVakFBQ3BCZ0FnSkFBQXN3WUFJTGtDQUFDcUJnQWd1Z0lBQUxJR0FDQ19BZ0FBSVFBZ0J5TUFBS1VHQUNBa0FBQ3dCZ0FndVFJQUFLWUdBQ0M2QWdBQXJ3WUFJTDBDQUFBb0FDQy1BZ0FBS0FBZ3Z3SUFBQUVBSUFzakFBRHhBd0F3SkFBQTlRTUFNTGtDQUFEeUF3QXd1Z0lBQVBNREFEQzdBZ0FBOUFNQUlMd0NBQURuQXdBd3ZRSUFBT2NEQURDLUFnQUE1d01BTUw4Q0FBRG5Bd0F3d0FJQUFQWURBRERCQWdBQTZnTUFNQW9IQUFEOEF3QWdGQUFBLXdNQUlCWUFBUDBEQUNEaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQWJBQ0FRQUFBQUcwQWdFQUFBQUJBZ0FBQUFFQUlDTUFBUG9EQUNBREFBQUFBUUFnSXdBQS1nTUFJQ1FBQVBnREFDQUJIQUFBcmdZQU1BSUFBQUFCQUNBY0FBRDRBd0FnQWdBQUFPc0RBQ0FjQUFEM0F3QWdCLUlCQVFDOEF3QWg0d0VCQUx3REFDSGxBVUFBdlFNQUlmNEJJQURNQXdBaGdBSkFBTDBEQUNHd0FnRUF2QU1BSWJRQ0FRQzhBd0FoQ2djQUFQa0RBQ0FVQUFEdUF3QWdGZ0FBOEFNQUlPSUJBUUM4QXdBaDR3RUJBTHdEQUNIbEFVQUF2UU1BSWY0QklBRE1Bd0FoZ0FKQUFMMERBQ0d3QWdFQXZBTUFJYlFDQVFDOEF3QWhCU01BQUtjR0FDQWtBQUNzQmdBZ3VRSUFBS2dHQUNDNkFnQUFxd1lBSUw4Q0FBQ2ZBZ0FnQ2djQUFQd0RBQ0FVQUFEN0F3QWdGZ0FBX1FNQUlPSUJBUUFBQUFIakFRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQnNBSUJBQUFBQWJRQ0FRQUFBQUVESXdBQXFRWUFJTGtDQUFDcUJnQWd2d0lBQUNFQUlBTWpBQUNuQmdBZ3VRSUFBS2dHQUNDX0FnQUFud0lBSUFRakFBRHhBd0F3dVFJQUFQSURBREM3QWdBQTlBTUFJTDhDQUFEbkF3QXdDaFFBQVBzREFDQVZBQURfQXdBZ0ZnQUFfUU1BSU9JQkFRQUFBQUhsQVVBQUFBQUJfZ0VnQUFBQUFZQUNRQUFBQUFHd0FnRUFBQUFCdEFJQkFBQUFBYlVDQVFBQUFBRURJd0FBcFFZQUlMa0NBQUNtQmdBZ3Z3SUFBQUVBSUFmaUFRRUFBQUFCNVFGQUFBQUFBWVFDQVFBQUFBR2xBZ0FBQUtVQ0FxWUNBUUFBQUFHbkFnRUFBQUFCcUFJZ0FBQUFBUUlBQUFBbUFDQWpBQUNNQkFBZ0F3QUFBQ1lBSUNNQUFJd0VBQ0FrQUFDTEJBQWdBUndBQUtRR0FEQU1Cd0FBb1FNQUlOOEJBQUNsQXdBdzRBRUFBQ1FBRU9FQkFBQ2xBd0F3NGdFQkFBQUFBZU1CQVFEckFnQWg1UUZBQVBJQ0FDR0VBZ0VBNndJQUlhVUNBQUNtQTZVQ0lxWUNBUURyQWdBaHB3SUJBT3dDQUNHb0FpQUE4QUlBSVFJQUFBQW1BQ0FjQUFDTEJBQWdBZ0FBQUlnRUFDQWNBQUNKQkFBZ0M5OEJBQUNIQkFBdzRBRUFBSWdFQUJEaEFRQUFod1FBTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJWVFDQVFEckFnQWhwUUlBQUtZRHBRSWlwZ0lCQU9zQ0FDR25BZ0VBN0FJQUlhZ0NJQUR3QWdBaEM5OEJBQUNIQkFBdzRBRUFBSWdFQUJEaEFRQUFod1FBTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJWVFDQVFEckFnQWhwUUlBQUtZRHBRSWlwZ0lCQU9zQ0FDR25BZ0VBN0FJQUlhZ0NJQUR3QWdBaEItSUJBUUM4QXdBaDVRRkFBTDBEQUNHRUFnRUF2QU1BSWFVQ0FBQ0tCS1VDSXFZQ0FRQzhBd0FocHdJQkFNZ0RBQ0dvQWlBQXpBTUFJUUc4QWdBQUFLVUNBZ2ZpQVFFQXZBTUFJZVVCUUFDOUF3QWhoQUlCQUx3REFDR2xBZ0FBaWdTbEFpS21BZ0VBdkFNQUlhY0NBUURJQXdBaHFBSWdBTXdEQUNFSDRnRUJBQUFBQWVVQlFBQUFBQUdFQWdFQUFBQUJwUUlBQUFDbEFnS21BZ0VBQUFBQnB3SUJBQUFBQWFnQ0lBQUFBQUVFQ0FBQXdRTUFJT0lCQVFBQUFBSGtBUUVBQUFBQjVRRkFBQUFBQVFJQUFBQVlBQ0FqQUFDWUJBQWdBd0FBQUJnQUlDTUFBSmdFQUNBa0FBQ1hCQUFnQVJ3QUFLTUdBREFLQndBQW9RTUFJQWdBQUtzREFDRGZBUUFBcWdNQU1PQUJBQUFXQUJEaEFRQUFxZ01BTU9JQkFRQUFBQUhqQVFFQTZ3SUFJZVFCQVFEckFnQWg1UUZBQVBJQ0FDRzJBZ0FBcVFNQUlBSUFBQUFZQUNBY0FBQ1hCQUFnQWdBQUFKVUVBQ0FjQUFDV0JBQWdCOThCQUFDVUJBQXc0QUVBQUpVRUFCRGhBUUFBbEFRQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIa0FRRUE2d0lBSWVVQlFBRHlBZ0FoQjk4QkFBQ1VCQUF3NEFFQUFKVUVBQkRoQVFBQWxBUUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGtBUUVBNndJQUllVUJRQUR5QWdBaEEtSUJBUUM4QXdBaDVBRUJBTHdEQUNIbEFVQUF2UU1BSVFRSUFBQ19Bd0FnNGdFQkFMd0RBQ0hrQVFFQXZBTUFJZVVCUUFDOUF3QWhCQWdBQU1FREFDRGlBUUVBQUFBQjVBRUJBQUFBQWVVQlFBQUFBQUVMRVFBQXNBUUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN6QWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQnJ3SUJBQUFBQWJBQ0FRQUFBQUd4QWdFQUFBQUJBZ0FBQUNFQUlDTUFBSzhFQUNBREFBQUFJUUFnSXdBQXJ3UUFJQ1FBQUtRRUFDQUJIQUFBb2dZQU1CQVJBQUQ1QWdBZ0V3QUFvUU1BSU44QkFBQ25Bd0F3NEFFQUFCOEFFT0VCQUFDbkF3QXc0Z0VCQUFBQUFlVUJRQUR5QWdBaC1nRUFBS2dEc3dJaV9nRWdBUEFDQUNHQUFrQUE4Z0lBSVlRQ0FRRHJBZ0FoaFFJQkFBQUFBYThDQVFEckFnQWhzQUlCQU9zQ0FDR3hBZ0VBNndJQUliTUNBUURyQWdBaEFnQUFBQ0VBSUJ3QUFLUUVBQ0FDQUFBQW9RUUFJQndBQUtJRUFDQU8zd0VBQUtBRUFERGdBUUFBb1FRQUVPRUJBQUNnQkFBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ29BN01DSXY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0dFQWdFQTZ3SUFJWVVDQVFEckFnQWhyd0lCQU9zQ0FDR3dBZ0VBNndJQUliRUNBUURyQWdBaHN3SUJBT3NDQUNFTzN3RUFBS0FFQUREZ0FRQUFvUVFBRU9FQkFBQ2dCQUF3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDb0E3TUNJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUURyQWdBaHJ3SUJBT3NDQUNHd0FnRUE2d0lBSWJFQ0FRRHJBZ0Foc3dJQkFPc0NBQ0VLNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFDakJMTUNJdjRCSUFETUF3QWhnQUpBQUwwREFDR0VBZ0VBdkFNQUlZVUNBUUM4QXdBaHJ3SUJBTHdEQUNHd0FnRUF2QU1BSWJFQ0FRQzhBd0FoQWJ3Q0FBQUFzd0lDQ3hFQUFLVUVBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQUtNRXN3SWlfZ0VnQU13REFDR0FBa0FBdlFNQUlZUUNBUUM4QXdBaGhRSUJBTHdEQUNHdkFnRUF2QU1BSWJBQ0FRQzhBd0Foc1FJQkFMd0RBQ0VMSXdBQXBnUUFNQ1FBQUtvRUFEQzVBZ0FBcHdRQU1Mb0NBQUNvQkFBd3V3SUFBS2tFQUNDOEFnQUE1d01BTUwwQ0FBRG5Bd0F3dmdJQUFPY0RBRENfQWdBQTV3TUFNTUFDQUFDckJBQXd3UUlBQU9vREFEQUtCd0FBX0FNQUlCVUFBUDhEQUNBV0FBRDlBd0FnNGdFQkFBQUFBZU1CQVFBQUFBSGxBVUFBQUFBQl9nRWdBQUFBQVlBQ1FBQUFBQUd3QWdFQUFBQUJ0UUlCQUFBQUFRSUFBQUFCQUNBakFBQ3VCQUFnQXdBQUFBRUFJQ01BQUs0RUFDQWtBQUN0QkFBZ0FSd0FBS0VHQURBQ0FBQUFBUUFnSEFBQXJRUUFJQUlBQUFEckF3QWdIQUFBckFRQUlBZmlBUUVBdkFNQUllTUJBUUM4QXdBaDVRRkFBTDBEQUNILUFTQUF6QU1BSVlBQ1FBQzlBd0Foc0FJQkFMd0RBQ0cxQWdFQXlBTUFJUW9IQUFENUF3QWdGUUFBN3dNQUlCWUFBUEFEQUNEaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhzQUlCQUx3REFDRzFBZ0VBeUFNQUlRb0hBQUQ4QXdBZ0ZRQUFfd01BSUJZQUFQMERBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBYkFDQVFBQUFBRzFBZ0VBQUFBQkN4RUFBTEFFQUNEaUFRRUFBQUFCNVFGQUFBQUFBZm9CQUFBQXN3SUNfZ0VnQUFBQUFZQUNRQUFBQUFHRUFnRUFBQUFCaFFJQkFBQUFBYThDQVFBQUFBR3dBZ0VBQUFBQnNRSUJBQUFBQVFRakFBQ21CQUF3dVFJQUFLY0VBREM3QWdBQXFRUUFJTDhDQUFEbkF3QXdDQWdBQUw0RUFDRGlBUUVBQUFBQjVBRUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFZb0NBZ0FBQUFHU0FnRUFBQUFCQWdBQUFCUUFJQ01BQUwwRUFDQURBQUFBRkFBZ0l3QUF2UVFBSUNRQUFMc0VBQ0FCSEFBQW9BWUFNQTRIQUFDaEF3QWdDQUFBcXdNQUlOOEJBQUN0QXdBdzRBRUFBQklBRU9FQkFBQ3RBd0F3NGdFQkFBQUFBZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUlmNEJJQUR3QWdBaGdBSkFBUElDQUNHS0FnSUE4UUlBSVpJQ0FRRHJBZ0FodGdJQUFLd0RBQ0FDQUFBQUZBQWdIQUFBdXdRQUlBSUFBQUM1QkFBZ0hBQUF1Z1FBSUF2ZkFRQUF1QVFBTU9BQkFBQzVCQUFRNFFFQUFMZ0VBRERpQVFFQTZ3SUFJZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUlmNEJJQUR3QWdBaGdBSkFBUElDQUNHS0FnSUE4UUlBSVpJQ0FRRHJBZ0FoQzk4QkFBQzRCQUF3NEFFQUFMa0VBQkRoQVFBQXVBUUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGtBUUVBNndJQUllVUJRQUR5QWdBaF9nRWdBUEFDQUNHQUFrQUE4Z0lBSVlvQ0FnRHhBZ0Foa2dJQkFPc0NBQ0VINGdFQkFMd0RBQ0hrQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUlZb0NBZ0ROQXdBaGtnSUJBTHdEQUNFSUNBQUF2QVFBSU9JQkFRQzhBd0FoNUFFQkFMd0RBQ0hsQVVBQXZRTUFJZjRCSUFETUF3QWhnQUpBQUwwREFDR0tBZ0lBelFNQUlaSUNBUUM4QXdBaEJTTUFBSnNHQUNBa0FBQ2VCZ0FndVFJQUFKd0dBQ0M2QWdBQW5RWUFJTDhDQUFBRkFDQUlDQUFBdmdRQUlPSUJBUUFBQUFIa0FRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQmlnSUNBQUFBQVpJQ0FRQUFBQUVESXdBQW13WUFJTGtDQUFDY0JnQWd2d0lBQUFVQUlBb0lBQURjQkFBZ0NnQUEzUVFBSU9JQkFRQUFBQUhrQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBcndJQ2dBSkFBQUFBQWFzQ1FBQUFBQUdzQWdJQUFBQUJyUUlRQUFBQUFRSUFBQUFMQUNBakFBRGJCQUFnQXdBQUFBc0FJQ01BQU5zRUFDQWtBQURMQkFBZ0FSd0FBSm9HQURBUEJ3QUFvUU1BSUFnQUFLc0RBQ0FLQUFDMEF3QWczd0VBQUxJREFERGdBUUFBQ1FBUTRRRUFBTElEQUREaUFRRUFBQUFCNHdFQkFPc0NBQ0hrQVFFQTZ3SUFJZVVCUUFEeUFnQWgtZ0VBQUxNRHJ3SWlnQUpBQVBJQ0FDR3JBa0FBOGdJQUlhd0NBZ0R4QWdBaHJRSVFBSzhEQUNFQ0FBQUFDd0FnSEFBQXl3UUFJQUlBQUFESEJBQWdIQUFBeUFRQUlBemZBUUFBeGdRQU1PQUJBQURIQkFBUTRRRUFBTVlFQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDekE2OENJb0FDUUFEeUFnQWhxd0pBQVBJQ0FDR3NBZ0lBOFFJQUlhMENFQUN2QXdBaEROOEJBQURHQkFBdzRBRUFBTWNFQUJEaEFRQUF4Z1FBTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hrQVFFQTZ3SUFJZVVCUUFEeUFnQWgtZ0VBQUxNRHJ3SWlnQUpBQVBJQ0FDR3JBa0FBOGdJQUlhd0NBZ0R4QWdBaHJRSVFBSzhEQUNFSTRnRUJBTHdEQUNIa0FRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFNb0Vyd0lpZ0FKQUFMMERBQ0dyQWtBQXZRTUFJYXdDQWdETkF3QWhyUUlRQU1rRUFDRUZ2QUlRQUFBQUFjTUNFQUFBQUFIRUFoQUFBQUFCeFFJUUFBQUFBY1lDRUFBQUFBRUJ2QUlBQUFDdkFnSUtDQUFBekFRQUlBb0FBTTBFQUNEaUFRRUF2QU1BSWVRQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQXlnU3ZBaUtBQWtBQXZRTUFJYXNDUUFDOUF3QWhyQUlDQU0wREFDR3RBaEFBeVFRQUlRVWpBQUNVQmdBZ0pBQUFtQVlBSUxrQ0FBQ1ZCZ0FndWdJQUFKY0dBQ0NfQWdBQUJRQWdDeU1BQU00RUFEQWtBQURUQkFBd3VRSUFBTThFQURDNkFnQUEwQVFBTUxzQ0FBRFJCQUFndkFJQUFOSUVBREM5QWdBQTBnUUFNTDRDQUFEU0JBQXd2d0lBQU5JRUFEREFBZ0FBMUFRQU1NRUNBQURWQkFBd0VPSUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ2NBZ0tBQWtBQUFBQUJsd0lCQUFBQUFaZ0NBUUFBQUFHWkFoQUFBQUFCbWdJQkFBQUFBWndDQVFBQUFBR2RBZ0VBQUFBQm5nSUJBQUFBQVo4Q0FRQUFBQUdnQWtBQUFBQUJvUUlCQUFBQUFhSUNRQUFBQUFHakFrQUFBQUFCQWdBQUFBOEFJQ01BQU5vRUFDQURBQUFBRHdBZ0l3QUEyZ1FBSUNRQUFOa0VBQ0FCSEFBQWxnWUFNQlVKQUFDeEF3QWczd0VBQUs0REFERGdBUUFBRFFBUTRRRUFBSzREQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0g2QVFBQXNBT2NBaUtBQWtBQThnSUFJWllDQVFEckFnQWhsd0lCQUFBQUFaZ0NBUURzQWdBaG1RSVFBSzhEQUNHYUFnRUE2d0lBSVp3Q0FRRHNBZ0FoblFJQkFPd0NBQ0dlQWdFQTdBSUFJWjhDQVFEc0FnQWhvQUpBQUtBREFDR2hBZ0VBN0FJQUlhSUNRQUNnQXdBaG93SkFBS0FEQUNFQ0FBQUFEd0FnSEFBQTJRUUFJQUlBQUFEV0JBQWdIQUFBMXdRQUlCVGZBUUFBMVFRQU1PQUJBQURXQkFBUTRRRUFBTlVFQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFMQURuQUlpZ0FKQUFQSUNBQ0dXQWdFQTZ3SUFJWmNDQVFEckFnQWhtQUlCQU93Q0FDR1pBaEFBcndNQUlab0NBUURyQWdBaG5BSUJBT3dDQUNHZEFnRUE3QUlBSVo0Q0FRRHNBZ0FobndJQkFPd0NBQ0dnQWtBQW9BTUFJYUVDQVFEc0FnQWhvZ0pBQUtBREFDR2pBa0FBb0FNQUlSVGZBUUFBMVFRQU1PQUJBQURXQkFBUTRRRUFBTlVFQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFMQURuQUlpZ0FKQUFQSUNBQ0dXQWdFQTZ3SUFJWmNDQVFEckFnQWhtQUlCQU93Q0FDR1pBaEFBcndNQUlab0NBUURyQWdBaG5BSUJBT3dDQUNHZEFnRUE3QUlBSVo0Q0FRRHNBZ0FobndJQkFPd0NBQ0dnQWtBQW9BTUFJYUVDQVFEc0FnQWhvZ0pBQUtBREFDR2pBa0FBb0FNQUlSRGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBTmdFbkFJaWdBSkFBTDBEQUNHWEFnRUF2QU1BSVpnQ0FRRElBd0FobVFJUUFNa0VBQ0dhQWdFQXZBTUFJWndDQVFESUF3QWhuUUlCQU1nREFDR2VBZ0VBeUFNQUlaOENBUURJQXdBaG9BSkFBT0FEQUNHaEFnRUF5QU1BSWFJQ1FBRGdBd0Fob3dKQUFPQURBQ0VCdkFJQUFBQ2NBZ0lRNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFEWUJKd0NJb0FDUUFDOUF3QWhsd0lCQUx3REFDR1lBZ0VBeUFNQUlaa0NFQURKQkFBaG1nSUJBTHdEQUNHY0FnRUF5QU1BSVowQ0FRRElBd0FobmdJQkFNZ0RBQ0dmQWdFQXlBTUFJYUFDUUFEZ0F3QWhvUUlCQU1nREFDR2lBa0FBNEFNQUlhTUNRQURnQXdBaEVPSUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ2NBZ0tBQWtBQUFBQUJsd0lCQUFBQUFaZ0NBUUFBQUFHWkFoQUFBQUFCbWdJQkFBQUFBWndDQVFBQUFBR2RBZ0VBQUFBQm5nSUJBQUFBQVo4Q0FRQUFBQUdnQWtBQUFBQUJvUUlCQUFBQUFhSUNRQUFBQUFHakFrQUFBQUFCQ2dnQUFOd0VBQ0FLQUFEZEJBQWc0Z0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3ZBZ0tBQWtBQUFBQUJxd0pBQUFBQUFhd0NBZ0FBQUFHdEFoQUFBQUFCQXlNQUFKUUdBQ0M1QWdBQWxRWUFJTDhDQUFBRkFDQUVJd0FBemdRQU1Ma0NBQURQQkFBd3V3SUFBTkVFQUNDX0FnQUEwZ1FBTUJJRkFBQ1JCUUFnQ3dBQWtnVUFJQXdBQUpNRkFDQU5BQUNVQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFJMENBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUdHQWdFQUFBQUJod0lCQUFBQUFZZ0NFQUFBQUFHSkFnSUFBQUFCaWdJSUFBQUFBWXNDQUFDUUJRQWdqUUlCQUFBQUFRSUFBQUFGQUNBakFBQ1BCUUFnQXdBQUFBVUFJQ01BQUk4RkFDQWtBQURyQkFBZ0FSd0FBSk1HQURBWEJRQUF1QU1BSUFZQUFLRURBQ0FMQUFEMEFnQWdEQUFBOVFJQUlBMEFBUGNDQUNEZkFRQUF0UU1BTU9BQkFBQURBQkRoQVFBQXRRTUFNT0lCQVFBQUFBSGxBVUFBOGdJQUlmb0JBQUMzQTQwQ0l2NEJJQUR3QWdBaGdBSkFBUElDQUNHRUFnRUE2d0lBSVlVQ0FRQUFBQUdHQWdFQTZ3SUFJWWNDQVFEckFnQWhpQUlRQUs4REFDR0pBZ0lBOFFJQUlZb0NDQUMyQXdBaGl3SUFBUDRDQUNDTkFnRUE2d0lBSVk0Q0FRRHJBZ0FoQWdBQUFBVUFJQndBQU9zRUFDQUNBQUFBNWdRQUlCd0FBT2NFQUNBUzN3RUFBT1VFQUREZ0FRQUE1Z1FBRU9FQkFBRGxCQUF3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDM0E0MENJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUURyQWdBaGhnSUJBT3NDQUNHSEFnRUE2d0lBSVlnQ0VBQ3ZBd0FoaVFJQ0FQRUNBQ0dLQWdnQXRnTUFJWXNDQUFELUFnQWdqUUlCQU9zQ0FDR09BZ0VBNndJQUlSTGZBUUFBNVFRQU1PQUJBQURtQkFBUTRRRUFBT1VFQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFMY0RqUUlpX2dFZ0FQQUNBQ0dBQWtBQThnSUFJWVFDQVFEckFnQWhoUUlCQU9zQ0FDR0dBZ0VBNndJQUlZY0NBUURyQWdBaGlBSVFBSzhEQUNHSkFnSUE4UUlBSVlvQ0NBQzJBd0FoaXdJQUFQNENBQ0NOQWdFQTZ3SUFJWTRDQVFEckFnQWhEdUlCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBNmdTTkFpTC1BU0FBekFNQUlZQUNRQUM5QXdBaGhBSUJBTHdEQUNHRkFnRUF2QU1BSVlZQ0FRQzhBd0FoaHdJQkFMd0RBQ0dJQWhBQXlRUUFJWWtDQWdETkF3QWhpZ0lJQU9nRUFDR0xBZ0FBNlFRQUlJMENBUUM4QXdBaEJid0NDQUFBQUFIREFnZ0FBQUFCeEFJSUFBQUFBY1VDQ0FBQUFBSEdBZ2dBQUFBQkFyd0NBUUFBQUFUQ0FnRUFBQUFGQWJ3Q0FBQUFqUUlDRWdVQUFPd0VBQ0FMQUFEdEJBQWdEQUFBN2dRQUlBMEFBTzhFQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFPb0VqUUlpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR0dBZ0VBdkFNQUlZY0NBUUM4QXdBaGlBSVFBTWtFQUNHSkFnSUF6UU1BSVlvQ0NBRG9CQUFoaXdJQUFPa0VBQ0NOQWdFQXZBTUFJUVVqQUFDQkJnQWdKQUFBa1FZQUlMa0NBQUNDQmdBZ3VnSUFBSkFHQUNDX0FnQUFmd0FnQ3lNQUFJUUZBREFrQUFDSUJRQXd1UUlBQUlVRkFEQzZBZ0FBaGdVQU1Mc0NBQUNIQlFBZ3ZBSUFBTU1FQURDOUFnQUF3d1FBTUw0Q0FBRERCQUF3dndJQUFNTUVBRERBQWdBQWlRVUFNTUVDQUFER0JBQXdDeU1BQVBrRUFEQWtBQUQ5QkFBd3VRSUFBUG9FQURDNkFnQUEtd1FBTUxzQ0FBRDhCQUFndkFJQUFMVUVBREM5QWdBQXRRUUFNTDRDQUFDMUJBQXd2d0lBQUxVRUFEREFBZ0FBX2dRQU1NRUNBQUM0QkFBd0N5TUFBUEFFQURBa0FBRDBCQUF3dVFJQUFQRUVBREM2QWdBQThnUUFNTHNDQUFEekJBQWd2QUlBQUpFRUFEQzlBZ0FBa1FRQU1MNENBQUNSQkFBd3Z3SUFBSkVFQUREQUFnQUE5UVFBTU1FQ0FBQ1VCQUF3QkFjQUFNQURBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFFQ0FBQUFHQUFnSXdBQS1BUUFJQU1BQUFBWUFDQWpBQUQ0QkFBZ0pBQUE5d1FBSUFFY0FBQ1BCZ0F3QWdBQUFCZ0FJQndBQVBjRUFDQUNBQUFBbFFRQUlCd0FBUFlFQUNBRDRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoQkFjQUFMNERBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDRUVCd0FBd0FNQUlPSUJBUUFBQUFIakFRRUFBQUFCNVFGQUFBQUFBUWdIQUFDREJRQWc0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCX2dFZ0FBQUFBWUFDUUFBQUFBR0tBZ0lBQUFBQmtnSUJBQUFBQVFJQUFBQVVBQ0FqQUFDQ0JRQWdBd0FBQUJRQUlDTUFBSUlGQUNBa0FBQ0FCUUFnQVJ3QUFJNEdBREFDQUFBQUZBQWdIQUFBZ0FVQUlBSUFBQUM1QkFBZ0hBQUFfd1FBSUFmaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhpZ0lDQU0wREFDR1NBZ0VBdkFNQUlRZ0hBQUNCQlFBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWW9DQWdETkF3QWhrZ0lCQUx3REFDRUZJd0FBaVFZQUlDUUFBSXdHQUNDNUFnQUFpZ1lBSUxvQ0FBQ0xCZ0FndndJQUFKOENBQ0FJQndBQWd3VUFJT0lCQVFBQUFBSGpBUUVBQUFBQjVRRkFBQUFBQWY0QklBQUFBQUdBQWtBQUFBQUJpZ0lDQUFBQUFaSUNBUUFBQUFFREl3QUFpUVlBSUxrQ0FBQ0tCZ0FndndJQUFKOENBQ0FLQndBQWpnVUFJQW9BQU4wRUFDRGlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFLOENBb0FDUUFBQUFBR3JBa0FBQUFBQnJBSUNBQUFBQWEwQ0VBQUFBQUVDQUFBQUN3QWdJd0FBalFVQUlBTUFBQUFMQUNBakFBQ05CUUFnSkFBQWl3VUFJQUVjQUFDSUJnQXdBZ0FBQUFzQUlCd0FBSXNGQUNBQ0FBQUF4d1FBSUJ3QUFJb0ZBQ0FJNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQU1vRXJ3SWlnQUpBQUwwREFDR3JBa0FBdlFNQUlhd0NBZ0ROQXdBaHJRSVFBTWtFQUNFS0J3QUFqQVVBSUFvQUFNMEVBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBeWdTdkFpS0FBa0FBdlFNQUlhc0NRQUM5QXdBaHJBSUNBTTBEQUNHdEFoQUF5UVFBSVFVakFBQ0RCZ0FnSkFBQWhnWUFJTGtDQUFDRUJnQWd1Z0lBQUlVR0FDQ19BZ0FBbndJQUlBb0hBQUNPQlFBZ0NnQUEzUVFBSU9JQkFRQUFBQUhqQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBcndJQ2dBSkFBQUFBQWFzQ1FBQUFBQUdzQWdJQUFBQUJyUUlRQUFBQUFRTWpBQUNEQmdBZ3VRSUFBSVFHQUNDX0FnQUFud0lBSUJJRkFBQ1JCUUFnQ3dBQWtnVUFJQXdBQUpNRkFDQU5BQUNVQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFJMENBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUdHQWdFQUFBQUJod0lCQUFBQUFZZ0NFQUFBQUFHSkFnSUFBQUFCaWdJSUFBQUFBWXNDQUFDUUJRQWdqUUlCQUFBQUFRRzhBZ0VBQUFBRUF5TUFBSUVHQUNDNUFnQUFnZ1lBSUw4Q0FBQl9BQ0FFSXdBQWhBVUFNTGtDQUFDRkJRQXd1d0lBQUljRkFDQ19BZ0FBd3dRQU1BUWpBQUQ1QkFBd3VRSUFBUG9FQURDN0FnQUFfQVFBSUw4Q0FBQzFCQUF3QkNNQUFQQUVBREM1QWdBQThRUUFNTHNDQUFEekJBQWd2d0lBQUpFRUFEQUVJd0FBM2dRQU1Ma0NBQURmQkFBd3V3SUFBT0VFQUNDX0FnQUE0Z1FBTUFRakFBQ19CQUF3dVFJQUFNQUVBREM3QWdBQXdnUUFJTDhDQUFEREJBQXdCQ01BQUxFRUFEQzVBZ0FBc2dRQU1Mc0NBQUMwQkFBZ3Z3SUFBTFVFQURBRUl3QUFtUVFBTUxrQ0FBQ2FCQUF3dXdJQUFKd0VBQ0NfQWdBQW5RUUFNQVFqQUFDTkJBQXd1UUlBQUk0RUFEQzdBZ0FBa0FRQUlMOENBQUNSQkFBd0JDTUFBSUFFQURDNUFnQUFnUVFBTUxzQ0FBQ0RCQUFndndJQUFJUUVBREFFSXdBQTR3TUFNTGtDQUFEa0F3QXd1d0lBQU9ZREFDQ19BZ0FBNXdNQU1BUWpBQURXQXdBd3VRSUFBTmNEQURDN0FnQUEyUU1BSUw4Q0FBRGFBd0F3QUFBQUFBQUFBQUFBQUFBQUFBVWpBQUQ4QlFBZ0pBQUFfd1VBSUxrQ0FBRDlCUUFndWdJQUFQNEZBQ0NfQWdBQW53SUFJQU1qQUFEOEJRQWd1UUlBQVAwRkFDQ19BZ0FBbndJQUlBQUFBQUFBQUFBQUJTTUFBUGNGQUNBa0FBRDZCUUFndVFJQUFQZ0ZBQ0M2QWdBQS1RVUFJTDhDQUFDZkFnQWdBeU1BQVBjRkFDQzVBZ0FBLUFVQUlMOENBQUNmQWdBZ0FBQUFBQUFGSXdBQThnVUFJQ1FBQVBVRkFDQzVBZ0FBOHdVQUlMb0NBQUQwQlFBZ3Z3SUFBQXNBSUFNakFBRHlCUUFndVFJQUFQTUZBQ0NfQWdBQUN3QWdBQUFBQlNNQUFPMEZBQ0FrQUFEd0JRQWd1UUlBQU80RkFDQzZBZ0FBN3dVQUlMOENBQUNmQWdBZ0F5TUFBTzBGQUNDNUFnQUE3Z1VBSUw4Q0FBQ2ZBZ0FnQUFBQUFBQUFDeU1BQU1rRkFEQWtBQUROQlFBd3VRSUFBTW9GQURDNkFnQUF5d1VBTUxzQ0FBRE1CUUFndkFJQUFPSUVBREM5QWdBQTRnUUFNTDRDQUFEaUJBQXd2d0lBQU9JRUFEREFBZ0FBemdVQU1NRUNBQURsQkFBd0VnWUFBS3NGQUNBTEFBQ1NCUUFnREFBQWt3VUFJQTBBQUpRRkFDRGlBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFqUUlDX2dFZ0FBQUFBWUFDUUFBQUFBR0VBZ0VBQUFBQmhRSUJBQUFBQVlZQ0FRQUFBQUdIQWdFQUFBQUJpQUlRQUFBQUFZa0NBZ0FBQUFHS0FnZ0FBQUFCaXdJQUFKQUZBQ0NPQWdFQUFBQUJBZ0FBQUFVQUlDTUFBTkVGQUNBREFBQUFCUUFnSXdBQTBRVUFJQ1FBQU5BRkFDQUJIQUFBN0FVQU1BSUFBQUFGQUNBY0FBRFFCUUFnQWdBQUFPWUVBQ0FjQUFEUEJRQWdEdUlCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBNmdTTkFpTC1BU0FBekFNQUlZQUNRQUM5QXdBaGhBSUJBTHdEQUNHRkFnRUF2QU1BSVlZQ0FRQzhBd0FoaHdJQkFMd0RBQ0dJQWhBQXlRUUFJWWtDQWdETkF3QWhpZ0lJQU9nRUFDR0xBZ0FBNlFRQUlJNENBUUM4QXdBaEVnWUFBS29GQUNBTEFBRHRCQUFnREFBQTdnUUFJQTBBQU84RUFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBT29FalFJaV9nRWdBTXdEQUNHQUFrQUF2UU1BSVlRQ0FRQzhBd0FoaFFJQkFMd0RBQ0dHQWdFQXZBTUFJWWNDQVFDOEF3QWhpQUlRQU1rRUFDR0pBZ0lBelFNQUlZb0NDQURvQkFBaGl3SUFBT2tFQUNDT0FnRUF2QU1BSVJJR0FBQ3JCUUFnQ3dBQWtnVUFJQXdBQUpNRkFDQU5BQUNVQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFJMENBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUdHQWdFQUFBQUJod0lCQUFBQUFZZ0NFQUFBQUFHSkFnSUFBQUFCaWdJSUFBQUFBWXNDQUFDUUJRQWdqZ0lCQUFBQUFRUWpBQURKQlFBd3VRSUFBTW9GQURDN0FnQUF6QVVBSUw4Q0FBRGlCQUF3QUFBQUFBQUFBQUFGSXdBQTV3VUFJQ1FBQU9vRkFDQzVBZ0FBNkFVQUlMb0NBQURwQlFBZ3Z3SUFBSjhDQUNBREl3QUE1d1VBSUxrQ0FBRG9CUUFndndJQUFKOENBQ0FBQUFBTUF3QUFuUVVBSUFzQUFKNEZBQ0FNQUFDZkJRQWdEZ0FBb0FVQUlBOEFBS0VGQUNBUUFBQ2lCUUFnRVFBQW93VUFJQklBQUtRRkFDRHpBUUFBd2dNQUlQUUJBQURDQXdBZzlRRUFBTUlEQUNEMkFRQUF3Z01BSUFJUkFBQ2pCUUFnRXdBQTRBVUFJQVVIQUFEZ0JRQWdGQUFBNFFVQUlCVUFBT0lGQUNBV0FBQ2pCUUFndFFJQUFNSURBQ0FGQlFBQTVnVUFJQVlBQU9BRkFDQUxBQUNlQlFBZ0RBQUFud1VBSUEwQUFLRUZBQ0FEQndBQTRBVUFJQWdBQU9NRkFDQUtBQURsQlFBZ0FBRURBQUNkQlFBZ0ZnTUFBSlVGQUNBTEFBQ1dCUUFnREFBQWx3VUFJQThBQUprRkFDQVFBQUNhQlFBZ0VRQUFtd1VBSUJJQUFKd0ZBQ0RpQVFFQUFBQUI1UUZBQUFBQUFmRUJBUUFBQUFIeUFRRUFBQUFCOHdFQkFBQUFBZlFCQVFBQUFBSDFBUUVBQUFBQjlnRUJBQUFBQWZnQkFBQUEtQUVDLWdFQUFBRDZBUUw4QVFBQUFQd0JBdjBCSUFBQUFBSC1BU0FBQUFBQl93RUNBQUFBQVlBQ1FBQUFBQUVDQUFBQW53SUFJQ01BQU9jRkFDQURBQUFBb2dJQUlDTUFBT2NGQUNBa0FBRHJCUUFnR0FBQUFLSUNBQ0FEQUFET0F3QWdDd0FBendNQUlBd0FBTkFEQUNBUEFBRFNBd0FnRUFBQTB3TUFJQkVBQU5RREFDQVNBQURWQXdBZ0hBQUE2d1VBSU9JQkFRQzhBd0FoNVFGQUFMMERBQ0h4QVFFQXZBTUFJZklCQVFDOEF3QWg4d0VCQU1nREFDSDBBUUVBeUFNQUlmVUJBUURJQXdBaDlnRUJBTWdEQUNINEFRQUF5UVA0QVNMNkFRQUF5Z1A2QVNMOEFRQUF5d1A4QVNMOUFTQUF6QU1BSWY0QklBRE1Bd0FoX3dFQ0FNMERBQ0dBQWtBQXZRTUFJUllEQUFET0F3QWdDd0FBendNQUlBd0FBTkFEQUNBUEFBRFNBd0FnRUFBQTB3TUFJQkVBQU5RREFDQVNBQURWQXdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoRHVJQkFRQUFBQUhsQVVBQUFBQUItZ0VBQUFDTkFnTC1BU0FBQUFBQmdBSkFBQUFBQVlRQ0FRQUFBQUdGQWdFQUFBQUJoZ0lCQUFBQUFZY0NBUUFBQUFHSUFoQUFBQUFCaVFJQ0FBQUFBWW9DQ0FBQUFBR0xBZ0FBa0FVQUlJNENBUUFBQUFFV0F3QUFsUVVBSUFzQUFKWUZBQ0FNQUFDWEJRQWdEZ0FBbUFVQUlBOEFBSmtGQUNBUkFBQ2JCUUFnRWdBQW5BVUFJT0lCQVFBQUFBSGxBVUFBQUFBQjhRRUJBQUFBQWZJQkFRQUFBQUh6QVFFQUFBQUI5QUVCQUFBQUFmVUJBUUFBQUFIMkFRRUFBQUFCLUFFQUFBRDRBUUw2QVFBQUFQb0JBdndCQUFBQV9BRUNfUUVnQUFBQUFmNEJJQUFBQUFIX0FRSUFBQUFCZ0FKQUFBQUFBUUlBQUFDZkFnQWdJd0FBN1FVQUlBTUFBQUNpQWdBZ0l3QUE3UVVBSUNRQUFQRUZBQ0FZQUFBQW9nSUFJQU1BQU00REFDQUxBQURQQXdBZ0RBQUEwQU1BSUE0QUFORURBQ0FQQUFEU0F3QWdFUUFBMUFNQUlCSUFBTlVEQUNBY0FBRHhCUUFnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZkVCQVFDOEF3QWg4Z0VCQUx3REFDSHpBUUVBeUFNQUlmUUJBUURJQXdBaDlRRUJBTWdEQUNIMkFRRUF5QU1BSWZnQkFBREpBX2dCSXZvQkFBREtBX29CSXZ3QkFBRExBX3dCSXYwQklBRE1Bd0FoX2dFZ0FNd0RBQ0hfQVFJQXpRTUFJWUFDUUFDOUF3QWhGZ01BQU00REFDQUxBQURQQXdBZ0RBQUEwQU1BSUE0QUFORURBQ0FQQUFEU0F3QWdFUUFBMUFNQUlCSUFBTlVEQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0h5QVFFQXZBTUFJZk1CQVFESUF3QWg5QUVCQU1nREFDSDFBUUVBeUFNQUlmWUJBUURJQXdBaC1BRUFBTWtELUFFaS1nRUFBTW9ELWdFaV9BRUFBTXNEX0FFaV9RRWdBTXdEQUNILUFTQUF6QU1BSWY4QkFnRE5Bd0FoZ0FKQUFMMERBQ0VMQndBQWpnVUFJQWdBQU53RUFDRGlBUUVBQUFBQjR3RUJBQUFBQWVRQkFRQUFBQUhsQVVBQUFBQUItZ0VBQUFDdkFnS0FBa0FBQUFBQnF3SkFBQUFBQWF3Q0FnQUFBQUd0QWhBQUFBQUJBZ0FBQUFzQUlDTUFBUElGQUNBREFBQUFDUUFnSXdBQThnVUFJQ1FBQVBZRkFDQU5BQUFBQ1FBZ0J3QUFqQVVBSUFnQUFNd0VBQ0FjQUFEMkJRQWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUF5Z1N2QWlLQUFrQUF2UU1BSWFzQ1FBQzlBd0FockFJQ0FNMERBQ0d0QWhBQXlRUUFJUXNIQUFDTUJRQWdDQUFBekFRQUlPSUJBUUM4QXdBaDR3RUJBTHdEQUNIa0FRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFNb0Vyd0lpZ0FKQUFMMERBQ0dyQWtBQXZRTUFJYXdDQWdETkF3QWhyUUlRQU1rRUFDRVdBd0FBbFFVQUlBc0FBSllGQUNBTUFBQ1hCUUFnRGdBQW1BVUFJQThBQUprRkFDQVFBQUNhQlFBZ0VRQUFtd1VBSU9JQkFRQUFBQUhsQVVBQUFBQUI4UUVCQUFBQUFmSUJBUUFBQUFIekFRRUFBQUFCOUFFQkFBQUFBZlVCQVFBQUFBSDJBUUVBQUFBQi1BRUFBQUQ0QVFMNkFRQUFBUG9CQXZ3QkFBQUFfQUVDX1FFZ0FBQUFBZjRCSUFBQUFBSF9BUUlBQUFBQmdBSkFBQUFBQVFJQUFBQ2ZBZ0FnSXdBQTl3VUFJQU1BQUFDaUFnQWdJd0FBOXdVQUlDUUFBUHNGQUNBWUFBQUFvZ0lBSUFNQUFNNERBQ0FMQUFEUEF3QWdEQUFBMEFNQUlBNEFBTkVEQUNBUEFBRFNBd0FnRUFBQTB3TUFJQkVBQU5RREFDQWNBQUQ3QlFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoRmdNQUFNNERBQ0FMQUFEUEF3QWdEQUFBMEFNQUlBNEFBTkVEQUNBUEFBRFNBd0FnRUFBQTB3TUFJQkVBQU5RREFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFV0N3QUFsZ1VBSUF3QUFKY0ZBQ0FPQUFDWUJRQWdEd0FBbVFVQUlCQUFBSm9GQUNBUkFBQ2JCUUFnRWdBQW5BVUFJT0lCQVFBQUFBSGxBVUFBQUFBQjhRRUJBQUFBQWZJQkFRQUFBQUh6QVFFQUFBQUI5QUVCQUFBQUFmVUJBUUFBQUFIMkFRRUFBQUFCLUFFQUFBRDRBUUw2QVFBQUFQb0JBdndCQUFBQV9BRUNfUUVnQUFBQUFmNEJJQUFBQUFIX0FRSUFBQUFCZ0FKQUFBQUFBUUlBQUFDZkFnQWdJd0FBX0FVQUlBTUFBQUNpQWdBZ0l3QUFfQVVBSUNRQUFJQUdBQ0FZQUFBQW9nSUFJQXNBQU04REFDQU1BQURRQXdBZ0RnQUEwUU1BSUE4QUFOSURBQ0FRQUFEVEF3QWdFUUFBMUFNQUlCSUFBTlVEQUNBY0FBQ0FCZ0FnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZkVCQVFDOEF3QWg4Z0VCQUx3REFDSHpBUUVBeUFNQUlmUUJBUURJQXdBaDlRRUJBTWdEQUNIMkFRRUF5QU1BSWZnQkFBREpBX2dCSXZvQkFBREtBX29CSXZ3QkFBRExBX3dCSXYwQklBRE1Bd0FoX2dFZ0FNd0RBQ0hfQVFJQXpRTUFJWUFDUUFDOUF3QWhGZ3NBQU04REFDQU1BQURRQXdBZ0RnQUEwUU1BSUE4QUFOSURBQ0FRQUFEVEF3QWdFUUFBMUFNQUlCSUFBTlVEQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0h5QVFFQXZBTUFJZk1CQVFESUF3QWg5QUVCQU1nREFDSDFBUUVBeUFNQUlmWUJBUURJQXdBaC1BRUFBTWtELUFFaS1nRUFBTW9ELWdFaV9BRUFBTXNEX0FFaV9RRWdBTXdEQUNILUFTQUF6QU1BSWY4QkFnRE5Bd0FoZ0FKQUFMMERBQ0VGNGdFQkFBQUFBZVVCUUFBQUFBSHhBUUVBQUFBQmdBSkFBQUFBQVlVQ0FRQUFBQUVDQUFBQWZ3QWdJd0FBZ1FZQUlCWURBQUNWQlFBZ0RBQUFsd1VBSUE0QUFKZ0ZBQ0FQQUFDWkJRQWdFQUFBbWdVQUlCRUFBSnNGQUNBU0FBQ2NCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSHhBUUVBQUFBQjhnRUJBQUFBQWZNQkFRQUFBQUgwQVFFQUFBQUI5UUVCQUFBQUFmWUJBUUFBQUFINEFRQUFBUGdCQXZvQkFBQUEtZ0VDX0FFQUFBRDhBUUw5QVNBQUFBQUJfZ0VnQUFBQUFmOEJBZ0FBQUFHQUFrQUFBQUFCQWdBQUFKOENBQ0FqQUFDREJnQWdBd0FBQUtJQ0FDQWpBQUNEQmdBZ0pBQUFod1lBSUJnQUFBQ2lBZ0FnQXdBQXpnTUFJQXdBQU5BREFDQU9BQURSQXdBZ0R3QUEwZ01BSUJBQUFOTURBQ0FSQUFEVUF3QWdFZ0FBMVFNQUlCd0FBSWNHQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0h5QVFFQXZBTUFJZk1CQVFESUF3QWg5QUVCQU1nREFDSDFBUUVBeUFNQUlmWUJBUURJQXdBaC1BRUFBTWtELUFFaS1nRUFBTW9ELWdFaV9BRUFBTXNEX0FFaV9RRWdBTXdEQUNILUFTQUF6QU1BSWY4QkFnRE5Bd0FoZ0FKQUFMMERBQ0VXQXdBQXpnTUFJQXdBQU5BREFDQU9BQURSQXdBZ0R3QUEwZ01BSUJBQUFOTURBQ0FSQUFEVUF3QWdFZ0FBMVFNQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoOHdFQkFNZ0RBQ0gwQVFFQXlBTUFJZlVCQVFESUF3QWg5Z0VCQU1nREFDSDRBUUFBeVFQNEFTTDZBUUFBeWdQNkFTTDhBUUFBeXdQOEFTTDlBU0FBekFNQUlmNEJJQURNQXdBaF93RUNBTTBEQUNHQUFrQUF2UU1BSVFqaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSDZBUUFBQUs4Q0FvQUNRQUFBQUFHckFrQUFBQUFCckFJQ0FBQUFBYTBDRUFBQUFBRVdBd0FBbFFVQUlBc0FBSllGQUNBT0FBQ1lCUUFnRHdBQW1RVUFJQkFBQUpvRkFDQVJBQUNiQlFBZ0VnQUFuQVVBSU9JQkFRQUFBQUhsQVVBQUFBQUI4UUVCQUFBQUFmSUJBUUFBQUFIekFRRUFBQUFCOUFFQkFBQUFBZlVCQVFBQUFBSDJBUUVBQUFBQi1BRUFBQUQ0QVFMNkFRQUFBUG9CQXZ3QkFBQUFfQUVDX1FFZ0FBQUFBZjRCSUFBQUFBSF9BUUlBQUFBQmdBSkFBQUFBQVFJQUFBQ2ZBZ0FnSXdBQWlRWUFJQU1BQUFDaUFnQWdJd0FBaVFZQUlDUUFBSTBHQUNBWUFBQUFvZ0lBSUFNQUFNNERBQ0FMQUFEUEF3QWdEZ0FBMFFNQUlBOEFBTklEQUNBUUFBRFRBd0FnRVFBQTFBTUFJQklBQU5VREFDQWNBQUNOQmdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoRmdNQUFNNERBQ0FMQUFEUEF3QWdEZ0FBMFFNQUlBOEFBTklEQUNBUUFBRFRBd0FnRVFBQTFBTUFJQklBQU5VREFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFSDRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJfZ0VnQUFBQUFZQUNRQUFBQUFHS0FnSUFBQUFCa2dJQkFBQUFBUVBpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFFREFBQUFnZ0VBSUNNQUFJRUdBQ0FrQUFDU0JnQWdCd0FBQUlJQkFDQWNBQUNTQmdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoZ0FKQUFMMERBQ0dGQWdFQXZBTUFJUVhpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDR0FBa0FBdlFNQUlZVUNBUUM4QXdBaER1SUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ05BZ0wtQVNBQUFBQUJnQUpBQUFBQUFZUUNBUUFBQUFHRkFnRUFBQUFCaGdJQkFBQUFBWWNDQVFBQUFBR0lBaEFBQUFBQmlRSUNBQUFBQVlvQ0NBQUFBQUdMQWdBQWtBVUFJSTBDQVFBQUFBRVRCUUFBa1FVQUlBWUFBS3NGQUNBTUFBQ1RCUUFnRFFBQWxBVUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNOQWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQmhnSUJBQUFBQVljQ0FRQUFBQUdJQWhBQUFBQUJpUUlDQUFBQUFZb0NDQUFBQUFHTEFnQUFrQVVBSUkwQ0FRQUFBQUdPQWdFQUFBQUJBZ0FBQUFVQUlDTUFBSlFHQUNBUTRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFKd0NBb0FDUUFBQUFBR1hBZ0VBQUFBQm1BSUJBQUFBQVprQ0VBQUFBQUdhQWdFQUFBQUJuQUlCQUFBQUFaMENBUUFBQUFHZUFnRUFBQUFCbndJQkFBQUFBYUFDUUFBQUFBR2hBZ0VBQUFBQm9nSkFBQUFBQWFNQ1FBQUFBQUVEQUFBQUF3QWdJd0FBbEFZQUlDUUFBSmtHQUNBVkFBQUFBd0FnQlFBQTdBUUFJQVlBQUtvRkFDQU1BQUR1QkFBZ0RRQUE3d1FBSUJ3QUFKa0dBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQU9vRWpRSWlfZ0VnQU13REFDR0FBa0FBdlFNQUlZUUNBUUM4QXdBaGhRSUJBTHdEQUNHR0FnRUF2QU1BSVljQ0FRQzhBd0FoaUFJUUFNa0VBQ0dKQWdJQXpRTUFJWW9DQ0FEb0JBQWhpd0lBQU9rRUFDQ05BZ0VBdkFNQUlZNENBUUM4QXdBaEV3VUFBT3dFQUNBR0FBQ3FCUUFnREFBQTdnUUFJQTBBQU84RUFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBT29FalFJaV9nRWdBTXdEQUNHQUFrQUF2UU1BSVlRQ0FRQzhBd0FoaFFJQkFMd0RBQ0dHQWdFQXZBTUFJWWNDQVFDOEF3QWhpQUlRQU1rRUFDR0pBZ0lBelFNQUlZb0NDQURvQkFBaGl3SUFBT2tFQUNDTkFnRUF2QU1BSVk0Q0FRQzhBd0FoQ09JQkFRQUFBQUhrQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBcndJQ2dBSkFBQUFBQWFzQ1FBQUFBQUdzQWdJQUFBQUJyUUlRQUFBQUFSTUZBQUNSQlFBZ0JnQUFxd1VBSUFzQUFKSUZBQ0FOQUFDVUJRQWc0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSTBDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDRUFBQUFBR0pBZ0lBQUFBQmlnSUlBQUFBQVlzQ0FBQ1FCUUFnalFJQkFBQUFBWTRDQVFBQUFBRUNBQUFBQlFBZ0l3QUFtd1lBSUFNQUFBQURBQ0FqQUFDYkJnQWdKQUFBbndZQUlCVUFBQUFEQUNBRkFBRHNCQUFnQmdBQXFnVUFJQXNBQU8wRUFDQU5BQUR2QkFBZ0hBQUFud1lBSU9JQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTZnU05BaUwtQVNBQXpBTUFJWUFDUUFDOUF3QWhoQUlCQUx3REFDR0ZBZ0VBdkFNQUlZWUNBUUM4QXdBaGh3SUJBTHdEQUNHSUFoQUF5UVFBSVlrQ0FnRE5Bd0FoaWdJSUFPZ0VBQ0dMQWdBQTZRUUFJSTBDQVFDOEF3QWhqZ0lCQUx3REFDRVRCUUFBN0FRQUlBWUFBS29GQUNBTEFBRHRCQUFnRFFBQTd3UUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBNmdTTkFpTC1BU0FBekFNQUlZQUNRQUM5QXdBaGhBSUJBTHdEQUNHRkFnRUF2QU1BSVlZQ0FRQzhBd0FoaHdJQkFMd0RBQ0dJQWhBQXlRUUFJWWtDQWdETkF3QWhpZ0lJQU9nRUFDR0xBZ0FBNlFRQUlJMENBUUM4QXdBaGpnSUJBTHdEQUNFSDRnRUJBQUFBQWVRQkFRQUFBQUhsQVVBQUFBQUJfZ0VnQUFBQUFZQUNRQUFBQUFHS0FnSUFBQUFCa2dJQkFBQUFBUWZpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBYkFDQVFBQUFBRzFBZ0VBQUFBQkN1SUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3pBZ0wtQVNBQUFBQUJnQUpBQUFBQUFZUUNBUUFBQUFHRkFnRUFBQUFCcndJQkFBQUFBYkFDQVFBQUFBR3hBZ0VBQUFBQkEtSUJBUUFBQUFIa0FRRUFBQUFCNVFGQUFBQUFBUWZpQVFFQUFBQUI1UUZBQUFBQUFZUUNBUUFBQUFHbEFnQUFBS1VDQXFZQ0FRQUFBQUduQWdFQUFBQUJxQUlnQUFBQUFRc0hBQUQ4QXdBZ0ZBQUEtd01BSUJVQUFQOERBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBYkFDQVFBQUFBRzBBZ0VBQUFBQnRRSUJBQUFBQVFJQUFBQUJBQ0FqQUFDbEJnQWdGZ01BQUpVRkFDQUxBQUNXQlFBZ0RBQUFsd1VBSUE0QUFKZ0ZBQ0FQQUFDWkJRQWdFQUFBbWdVQUlCSUFBSndGQUNEaUFRRUFBQUFCNVFGQUFBQUFBZkVCQVFBQUFBSHlBUUVBQUFBQjh3RUJBQUFBQWZRQkFRQUFBQUgxQVFFQUFBQUI5Z0VCQUFBQUFmZ0JBQUFBLUFFQy1nRUFBQUQ2QVFMOEFRQUFBUHdCQXYwQklBQUFBQUgtQVNBQUFBQUJfd0VDQUFBQUFZQUNRQUFBQUFFQ0FBQUFud0lBSUNNQUFLY0dBQ0FNRXdBQTNBVUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN6QWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQnJ3SUJBQUFBQWJBQ0FRQUFBQUd4QWdFQUFBQUJzd0lCQUFBQUFRSUFBQUFoQUNBakFBQ3BCZ0FnQXdBQUFLSUNBQ0FqQUFDbkJnQWdKQUFBclFZQUlCZ0FBQUNpQWdBZ0F3QUF6Z01BSUFzQUFNOERBQ0FNQUFEUUF3QWdEZ0FBMFFNQUlBOEFBTklEQUNBUUFBRFRBd0FnRWdBQTFRTUFJQndBQUswR0FDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFV0F3QUF6Z01BSUFzQUFNOERBQ0FNQUFEUUF3QWdEZ0FBMFFNQUlBOEFBTklEQUNBUUFBRFRBd0FnRWdBQTFRTUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaDh3RUJBTWdEQUNIMEFRRUF5QU1BSWZVQkFRRElBd0FoOWdFQkFNZ0RBQ0g0QVFBQXlRUDRBU0w2QVFBQXlnUDZBU0w4QVFBQXl3UDhBU0w5QVNBQXpBTUFJZjRCSUFETUF3QWhfd0VDQU0wREFDR0FBa0FBdlFNQUlRZmlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFiQUNBUUFBQUFHMEFnRUFBQUFCQXdBQUFDZ0FJQ01BQUtVR0FDQWtBQUN4QmdBZ0RRQUFBQ2dBSUFjQUFQa0RBQ0FVQUFEdUF3QWdGUUFBN3dNQUlCd0FBTEVHQUNEaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhzQUlCQUx3REFDRzBBZ0VBdkFNQUliVUNBUURJQXdBaEN3Y0FBUGtEQUNBVUFBRHVBd0FnRlFBQTd3TUFJT0lCQVFDOEF3QWg0d0VCQUx3REFDSGxBVUFBdlFNQUlmNEJJQURNQXdBaGdBSkFBTDBEQUNHd0FnRUF2QU1BSWJRQ0FRQzhBd0FodFFJQkFNZ0RBQ0VEQUFBQUh3QWdJd0FBcVFZQUlDUUFBTFFHQUNBT0FBQUFId0FnRXdBQTJ3VUFJQndBQUxRR0FDRGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBS01Fc3dJaV9nRWdBTXdEQUNHQUFrQUF2UU1BSVlRQ0FRQzhBd0FoaFFJQkFMd0RBQ0d2QWdFQXZBTUFJYkFDQVFDOEF3QWhzUUlCQUx3REFDR3pBZ0VBdkFNQUlRd1RBQURiQlFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBQ2pCTE1DSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhyd0lCQUx3REFDR3dBZ0VBdkFNQUliRUNBUUM4QXdBaHN3SUJBTHdEQUNFSDRnRUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFiQUNBUUFBQUFHMEFnRUFBQUFCdFFJQkFBQUFBUVhpQVFFQUFBQUI1UUZBQUFBQUFaTUNBUUFBQUFHVUFrQUFBQUFCbFFKQUFBQUFBUk1GQUFDUkJRQWdCZ0FBcXdVQUlBc0FBSklGQUNBTUFBQ1RCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSDZBUUFBQUkwQ0F2NEJJQUFBQUFHQUFrQUFBQUFCaEFJQkFBQUFBWVVDQVFBQUFBR0dBZ0VBQUFBQmh3SUJBQUFBQVlnQ0VBQUFBQUdKQWdJQUFBQUJpZ0lJQUFBQUFZc0NBQUNRQlFBZ2pRSUJBQUFBQVk0Q0FRQUFBQUVDQUFBQUJRQWdJd0FBdHdZQUlCWURBQUNWQlFBZ0N3QUFsZ1VBSUF3QUFKY0ZBQ0FPQUFDWUJRQWdFQUFBbWdVQUlCRUFBSnNGQUNBU0FBQ2NCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSHhBUUVBQUFBQjhnRUJBQUFBQWZNQkFRQUFBQUgwQVFFQUFBQUI5UUVCQUFBQUFmWUJBUUFBQUFINEFRQUFBUGdCQXZvQkFBQUEtZ0VDX0FFQUFBRDhBUUw5QVNBQUFBQUJfZ0VnQUFBQUFmOEJBZ0FBQUFHQUFrQUFBQUFCQWdBQUFKOENBQ0FqQUFDNUJnQWdBd0FBQUFNQUlDTUFBTGNHQUNBa0FBQzlCZ0FnRlFBQUFBTUFJQVVBQU93RUFDQUdBQUNxQlFBZ0N3QUE3UVFBSUF3QUFPNEVBQ0FjQUFDOUJnQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmb0JBQURxQkkwQ0l2NEJJQURNQXdBaGdBSkFBTDBEQUNHRUFnRUF2QU1BSVlVQ0FRQzhBd0FoaGdJQkFMd0RBQ0dIQWdFQXZBTUFJWWdDRUFESkJBQWhpUUlDQU0wREFDR0tBZ2dBNkFRQUlZc0NBQURwQkFBZ2pRSUJBTHdEQUNHT0FnRUF2QU1BSVJNRkFBRHNCQUFnQmdBQXFnVUFJQXNBQU8wRUFDQU1BQUR1QkFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBRHFCSTBDSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhoZ0lCQUx3REFDR0hBZ0VBdkFNQUlZZ0NFQURKQkFBaGlRSUNBTTBEQUNHS0FnZ0E2QVFBSVlzQ0FBRHBCQUFnalFJQkFMd0RBQ0dPQWdFQXZBTUFJUU1BQUFDaUFnQWdJd0FBdVFZQUlDUUFBTUFHQUNBWUFBQUFvZ0lBSUFNQUFNNERBQ0FMQUFEUEF3QWdEQUFBMEFNQUlBNEFBTkVEQUNBUUFBRFRBd0FnRVFBQTFBTUFJQklBQU5VREFDQWNBQURBQmdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoRmdNQUFNNERBQ0FMQUFEUEF3QWdEQUFBMEFNQUlBNEFBTkVEQUNBUUFBRFRBd0FnRVFBQTFBTUFJQklBQU5VREFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFRkJBQVJCd0FERkFBQ0ZUa0JGam9CQXdRQUVCRTNBUk1BQXdrREJnUUVBQThMSFFjTUhnb09JZ0lQSXdzUUp3MFJLZ0VTTGc0R0JBQU1CUUFGQmdBREN3d0hEQlVLRFJrTEFnTUhCQVFBQmdFRENBQUVCQUFKQndBRENBQUVDaEFJQVFrQUJ3RUtFUUFDQndBRENBQUVBZ2NBQXdnQUJBTUxHZ0FNR3dBTkhBQUJCd0FEQVFjQUF3Z0RMd0FMTUFBTU1RQU9NZ0FQTXdBUU5BQVJOUUFTTmdBQkVUZ0FBUlk3QUFBREJ3QURGQUFDRlVVQkF3Y0FBeFFBQWhWTEFRTUVBQllwQUJjcUFCZ0FBQUFEQkFBV0tRQVhLZ0FZQVJNQUF3RVRBQU1EQkFBZEtRQWVLZ0FmQUFBQUF3UUFIU2tBSGlvQUh3SUhBQU1JQUFRQ0J3QURDQUFFQlFRQUpDa0FKeW9BS0VzQUpVd0FKZ0FBQUFBQUJRUUFKQ2tBSnlvQUtFc0FKVXdBSmdBQUF3UUFMU2tBTGlvQUx3QUFBQU1FQUMwcEFDNHFBQzhBQUFBREJBQTFLUUEyS2dBM0FBQUFBd1FBTlNrQU5pb0FOd0VIQUFNQkJ3QURBd1FBUENrQVBTb0FQZ0FBQUFNRUFEd3BBRDBxQUQ0QkNRQUhBUWtBQndVRUFFTXBBRVlxQUVkTEFFUk1BRVVBQUFBQUFBVUVBRU1wQUVZcUFFZExBRVJNQUVVQkJ3QURBUWNBQXdNRUFFd3BBRTBxQUU0QUFBQURCQUJNS1FCTktnQk9BZ2NBQXdnQUJBSUhBQU1JQUFRRkJBQlRLUUJXS2dCWFN3QlVUQUJWQUFBQUFBQUZCQUJUS1FCV0tnQlhTd0JVVEFCVkFnVUFCUVlBQXdJRkFBVUdBQU1GQkFCY0tRQmZLZ0JnU3dCZFRBQmVBQUFBQUFBRkJBQmNLUUJmS2dCZ1N3QmRUQUJlQUFBRkJBQmxLUUJvS2dCcFN3Qm1UQUJuQUFBQUFBQUZCQUJsS1FCb0tnQnBTd0JtVEFCbkFnY0FBd2dBQkFJSEFBTUlBQVFEQkFCdUtRQnZLZ0J3QUFBQUF3UUFiaWtBYnlvQWNCY0NBUmc4QVJrOUFSby1BUnNfQVIxQkFSNURFaDlFRXlCSEFTRkpFaUpLRkNWTUFTWk5BU2RPRWl0UkZTeFNHUzFUQWk1VUFpOVZBakJXQWpGWEFqSlpBak5iRWpSY0dqVmVBalpnRWpkaEd6aGlBamxqQWpwa0VqdG5IRHhvSUQxcEJ6NXFCejlyQjBCc0IwRnRCMEp2QjBOeEVrUnlJVVYwQjBaMkVrZDNJa2g0QjBsNUIwcDZFazE5STA1LUtVLUFBUVZRZ1FFRlVZUUJCVktGQVFWVGhnRUZWSWdCQlZXS0FSSldpd0VxVjQwQkJWaVBBUkpaa0FFcldwRUJCVnVTQVFWY2t3RVNYWllCTEY2WEFUQmZtUUV4WUpvQk1XR2RBVEZpbmdFeFk1OEJNV1NoQVRGbG93RVNacVFCTW1lbUFURm9xQUVTYWFrQk0ycXFBVEZycXdFeGJLd0JFbTJ2QVRSdXNBRTRiN0VCRFhDeUFRMXhzd0VOY3JRQkRYTzFBUTEwdHdFTmRia0JFbmE2QVRsM3ZBRU5lTDRCRW5tX0FUcDZ3QUVOZThFQkRYekNBUko5eFFFN2ZzWUJQM19IQVFpQUFjZ0JDSUVCeVFFSWdnSEtBUWlEQWNzQkNJUUJ6UUVJaFFIUEFSS0dBZEFCUUljQjBnRUlpQUhVQVJLSkFkVUJRWW9CMWdFSWl3SFhBUWlNQWRnQkVvMEIyd0ZDamdIY0FVaVBBZDBCRHBBQjNnRU9rUUhmQVE2U0FlQUJEcE1CNFFFT2xBSGpBUTZWQWVVQkVwWUI1Z0ZKbHdIb0FRNllBZW9CRXBrQjZ3RkttZ0hzQVE2YkFlMEJEcHdCN2dFU25RSHhBVXVlQWZJQlQ1OEI4d0VLb0FIMEFRcWhBZlVCQ3FJQjlnRUtvd0gzQVFxa0Fma0JDcVVCLXdFU3BnSDhBVkNuQWY0QkNxZ0JnQUlTcVFHQkFsR3FBWUlDQ3FzQmd3SUtyQUdFQWhLdEFZY0NVcTRCaUFKWXJ3R0pBZ1N3QVlvQ0JMRUJpd0lFc2dHTUFnU3pBWTBDQkxRQmp3SUV0UUdSQWhLMkFaSUNXYmNCbEFJRXVBR1dBaEs1QVpjQ1dyb0JtQUlFdXdHWkFnUzhBWm9DRXIwQm5RSmJ2Z0dlQW1HX0FhQUNBOEFCb1FJRHdRR2tBZ1BDQWFVQ0E4TUJwZ0lEeEFHb0FnUEZBYW9DRXNZQnF3Sml4d0d0QWdQSUFhOENFc2tCc0FKanlnR3hBZ1BMQWJJQ0E4d0Jzd0lTelFHMkFtVE9BYmNDYXM4QnVBSUwwQUc1QWd2UkFib0NDOUlCdXdJTDB3RzhBZ3ZVQWI0Q0M5VUJ3QUlTMWdIQkFtdlhBY01DQzlnQnhRSVMyUUhHQW16YUFjY0NDOXNCeUFJTDNBSEpBaExkQWN3Q2JkNEJ6UUp4XCJcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGVjb2RlQmFzZTY0QXNXYXNtKHdhc21CYXNlNjQ6IHN0cmluZyk6IFByb21pc2U8V2ViQXNzZW1ibHkuTW9kdWxlPiB7XG4gIGNvbnN0IHsgQnVmZmVyIH0gPSBhd2FpdCBpbXBvcnQoJ25vZGU6YnVmZmVyJylcbiAgY29uc3Qgd2FzbUFycmF5ID0gQnVmZmVyLmZyb20od2FzbUJhc2U2NCwgJ2Jhc2U2NCcpXG4gIHJldHVybiBuZXcgV2ViQXNzZW1ibHkuTW9kdWxlKHdhc21BcnJheSlcbn1cblxuY29uZmlnLmNvbXBpbGVyV2FzbSA9IHtcbiAgZ2V0UnVudGltZTogYXN5bmMgKCkgPT4gYXdhaXQgaW1wb3J0KFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9xdWVyeV9jb21waWxlcl9mYXN0X2JnLnBvc3RncmVzcWwubWpzXCIpLFxuXG4gIGdldFF1ZXJ5Q29tcGlsZXJXYXNtTW9kdWxlOiBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgeyB3YXNtIH0gPSBhd2FpdCBpbXBvcnQoXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcucG9zdGdyZXNxbC53YXNtLWJhc2U2NC5tanNcIilcbiAgICByZXR1cm4gYXdhaXQgZGVjb2RlQmFzZTY0QXNXYXNtKHdhc20pXG4gIH0sXG5cbiAgaW1wb3J0TmFtZTogXCIuL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcuanNcIlxufVxuXG5cblxuZXhwb3J0IHR5cGUgTG9nT3B0aW9uczxDbGllbnRPcHRpb25zIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnM+ID1cbiAgJ2xvZycgZXh0ZW5kcyBrZXlvZiBDbGllbnRPcHRpb25zID8gQ2xpZW50T3B0aW9uc1snbG9nJ10gZXh0ZW5kcyBBcnJheTxQcmlzbWEuTG9nTGV2ZWwgfCBQcmlzbWEuTG9nRGVmaW5pdGlvbj4gPyBQcmlzbWEuR2V0RXZlbnRzPENsaWVudE9wdGlvbnNbJ2xvZyddPiA6IG5ldmVyIDogbmV2ZXJcblxuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvciB7XG4gICAgLyoqXG4gICAqICMjIFByaXNtYSBDbGllbnRcbiAgICogXG4gICAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXI6IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICAgKiB9KVxuICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ0NvbW1lbnRzXG4gICAqIGNvbnN0IGJsb2dDb21tZW50cyA9IGF3YWl0IHByaXNtYS5ibG9nQ29tbWVudC5maW5kTWFueSgpXG4gICAqIGBgYFxuICAgKiBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvY2xpZW50KS5cbiAgICovXG5cbiAgbmV3IDxcbiAgICBPcHRpb25zIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnMgPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9ucyxcbiAgICBMb2dPcHRzIGV4dGVuZHMgTG9nT3B0aW9uczxPcHRpb25zPiA9IExvZ09wdGlvbnM8T3B0aW9ucz4sXG4gICAgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddID0gT3B0aW9ucyBleHRlbmRzIHsgb21pdDogaW5mZXIgVSB9ID8gVSA6IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10sXG4gICAgRXh0QXJncyBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3NcbiAgPihvcHRpb25zOiBQcmlzbWEuUHJpc21hQ2xpZW50Q29uc3RydWN0b3JBcmdzPE9wdGlvbnM+KTogUHJpc21hQ2xpZW50PExvZ09wdHMsIE9taXRPcHRzLCBFeHRBcmdzPlxufVxuXG4vKipcbiAqICMjIFByaXNtYSBDbGllbnRcbiAqIFxuICogVHlwZS1zYWZlIGRhdGFiYXNlIGNsaWVudCBmb3IgVHlwZVNjcmlwdFxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gKiAgIGFkYXB0ZXI6IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICogfSlcbiAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nQ29tbWVudHNcbiAqIGNvbnN0IGJsb2dDb21tZW50cyA9IGF3YWl0IHByaXNtYS5ibG9nQ29tbWVudC5maW5kTWFueSgpXG4gKiBgYGBcbiAqIFxuICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvY2xpZW50KS5cbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudDxcbiAgaW4gTG9nT3B0cyBleHRlbmRzIFByaXNtYS5Mb2dMZXZlbCA9IG5ldmVyLFxuICBpbiBvdXQgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSxcbiAgaW4gb3V0IEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzXG4+IHtcbiAgW0s6IHN5bWJvbF06IHsgdHlwZXM6IFByaXNtYS5UeXBlTWFwPEV4dEFyZ3M+WydvdGhlciddIH1cblxuICAkb248ViBleHRlbmRzIExvZ09wdHM+KGV2ZW50VHlwZTogViwgY2FsbGJhY2s6IChldmVudDogViBleHRlbmRzICdxdWVyeScgPyBQcmlzbWEuUXVlcnlFdmVudCA6IFByaXNtYS5Mb2dFdmVudCkgPT4gdm9pZCk6IFByaXNtYUNsaWVudDtcblxuICAvKipcbiAgICogQ29ubmVjdCB3aXRoIHRoZSBkYXRhYmFzZVxuICAgKi9cbiAgJGNvbm5lY3QoKTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8dm9pZD47XG5cbiAgLyoqXG4gICAqIERpc2Nvbm5lY3QgZnJvbSB0aGUgZGF0YWJhc2VcbiAgICovXG4gICRkaXNjb25uZWN0KCk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPHZvaWQ+O1xuXG4vKipcbiAgICogRXhlY3V0ZXMgYSBwcmVwYXJlZCByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIG51bWJlciBvZiBhZmZlY3RlZCByb3dzLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRleGVjdXRlUmF3YFVQREFURSBVc2VyIFNFVCBjb29sID0gJHt0cnVlfSBXSEVSRSBlbWFpbCA9ICR7J3VzZXJAZW1haWwuY29tJ307YFxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJGV4ZWN1dGVSYXc8VCA9IHVua25vd24+KHF1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFByaXNtYS5TcWwsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxudW1iZXI+O1xuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyBhIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIHJvd3MuXG4gICAqIFN1c2NlcHRpYmxlIHRvIFNRTCBpbmplY3Rpb25zLCBzZWUgZG9jdW1lbnRhdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kZXhlY3V0ZVJhd1Vuc2FmZSgnVVBEQVRFIFVzZXIgU0VUIGNvb2wgPSAkMSBXSEVSRSBlbWFpbCA9ICQyIDsnLCB0cnVlLCAndXNlckBlbWFpbC5jb20nKVxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJGV4ZWN1dGVSYXdVbnNhZmU8VCA9IHVua25vd24+KHF1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxudW1iZXI+O1xuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBhIHByZXBhcmVkIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgYFNFTEVDVGAgZGF0YS5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUICogRlJPTSBVc2VyIFdIRVJFIGlkID0gJHsxfSBPUiBlbWFpbCA9ICR7J3VzZXJAZW1haWwuY29tJ307YFxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJHF1ZXJ5UmF3PFQgPSB1bmtub3duPihxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBQcmlzbWEuU3FsLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8VD47XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIGEgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBgU0VMRUNUYCBkYXRhLlxuICAgKiBTdXNjZXB0aWJsZSB0byBTUUwgaW5qZWN0aW9ucywgc2VlIGRvY3VtZW50YXRpb24uXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3VW5zYWZlKCdTRUxFQ1QgKiBGUk9NIFVzZXIgV0hFUkUgaWQgPSAkMSBPUiBlbWFpbCA9ICQyOycsIDEsICd1c2VyQGVtYWlsLmNvbScpXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkcXVlcnlSYXdVbnNhZmU8VCA9IHVua25vd24+KHF1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxUPjtcblxuXG4gIC8qKlxuICAgKiBBbGxvd3MgdGhlIHJ1bm5pbmcgb2YgYSBzZXF1ZW5jZSBvZiByZWFkL3dyaXRlIG9wZXJhdGlvbnMgdGhhdCBhcmUgZ3VhcmFudGVlZCB0byBlaXRoZXIgc3VjY2VlZCBvciBmYWlsIGFzIGEgd2hvbGUuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBbZ2VvcmdlLCBib2IsIGFsaWNlXSA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oW1xuICAgKiAgIHByaXNtYS51c2VyLmNyZWF0ZSh7IGRhdGE6IHsgbmFtZTogJ0dlb3JnZScgfSB9KSxcbiAgICogICBwcmlzbWEudXNlci5jcmVhdGUoeyBkYXRhOiB7IG5hbWU6ICdCb2InIH0gfSksXG4gICAqICAgcHJpc21hLnVzZXIuY3JlYXRlKHsgZGF0YTogeyBuYW1lOiAnQWxpY2UnIH0gfSksXG4gICAqIF0pXG4gICAqIGBgYFxuICAgKiBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3Mvb3JtL3ByaXNtYS1jbGllbnQvcXVlcmllcy90cmFuc2FjdGlvbnMpLlxuICAgKi9cbiAgJHRyYW5zYWN0aW9uPFAgZXh0ZW5kcyBQcmlzbWEuUHJpc21hUHJvbWlzZTxhbnk+W10+KGFyZzogWy4uLlBdLCBvcHRpb25zPzogeyBtYXhXYWl0PzogbnVtYmVyLCB0aW1lb3V0PzogbnVtYmVyLCBpc29sYXRpb25MZXZlbD86IFByaXNtYS5UcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsIH0pOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxydW50aW1lLlR5cGVzLlV0aWxzLlVud3JhcFR1cGxlPFA+PlxuXG4gICR0cmFuc2FjdGlvbjxSPihmbjogKHByaXNtYTogT21pdDxQcmlzbWFDbGllbnQsIHJ1bnRpbWUuSVRYQ2xpZW50RGVueUxpc3Q+KSA9PiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxSPiwgb3B0aW9ucz86IHsgbWF4V2FpdD86IG51bWJlciwgdGltZW91dD86IG51bWJlciwgaXNvbGF0aW9uTGV2ZWw/OiBQcmlzbWEuVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCB9KTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8Uj5cblxuICAkZXh0ZW5kczogcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkV4dGVuZHNIb29rPFwiZXh0ZW5kc1wiLCBQcmlzbWEuVHlwZU1hcENiPE9taXRPcHRzPiwgRXh0QXJncywgcnVudGltZS5UeXBlcy5VdGlscy5DYWxsPFByaXNtYS5UeXBlTWFwQ2I8T21pdE9wdHM+LCB7XG4gICAgZXh0QXJnczogRXh0QXJnc1xuICB9Pj5cblxuICAgICAgLyoqXG4gICAqIGBwcmlzbWEuYmxvZ0NvbW1lbnRgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQmxvZ0NvbW1lbnQqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dDb21tZW50c1xuICAgICogY29uc3QgYmxvZ0NvbW1lbnRzID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBibG9nQ29tbWVudCgpOiBQcmlzbWEuQmxvZ0NvbW1lbnREZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmJsb2dQb3N0YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkJsb2dQb3N0KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nUG9zdHNcbiAgICAqIGNvbnN0IGJsb2dQb3N0cyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgYmxvZ1Bvc3QoKTogUHJpc21hLkJsb2dQb3N0RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5ib29raW5nYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkJvb2tpbmcqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJvb2tpbmdzXG4gICAgKiBjb25zdCBib29raW5ncyA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBib29raW5nKCk6IFByaXNtYS5Cb29raW5nRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5jYXRlZ29yeWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipDYXRlZ29yeSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQ2F0ZWdvcmllc1xuICAgICogY29uc3QgY2F0ZWdvcmllcyA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgY2F0ZWdvcnkoKTogUHJpc21hLkNhdGVnb3J5RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5jb250YWN0TWVzc2FnZWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipDb250YWN0TWVzc2FnZSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQ29udGFjdE1lc3NhZ2VzXG4gICAgKiBjb25zdCBjb250YWN0TWVzc2FnZXMgPSBhd2FpdCBwcmlzbWEuY29udGFjdE1lc3NhZ2UuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGNvbnRhY3RNZXNzYWdlKCk6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEubm90aWZpY2F0aW9uYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKk5vdGlmaWNhdGlvbioqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgTm90aWZpY2F0aW9uc1xuICAgICogY29uc3Qgbm90aWZpY2F0aW9ucyA9IGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24uZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IG5vdGlmaWNhdGlvbigpOiBQcmlzbWEuTm90aWZpY2F0aW9uRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5wYXltZW50YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlBheW1lbnQqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFBheW1lbnRzXG4gICAgKiBjb25zdCBwYXltZW50cyA9IGF3YWl0IHByaXNtYS5wYXltZW50LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBwYXltZW50KCk6IFByaXNtYS5QYXltZW50RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5yZWZyZXNoVG9rZW5gOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqUmVmcmVzaFRva2VuKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBSZWZyZXNoVG9rZW5zXG4gICAgKiBjb25zdCByZWZyZXNoVG9rZW5zID0gYXdhaXQgcHJpc21hLnJlZnJlc2hUb2tlbi5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgcmVmcmVzaFRva2VuKCk6IFByaXNtYS5SZWZyZXNoVG9rZW5EZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnJldmlld2A6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipSZXZpZXcqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFJldmlld3NcbiAgICAqIGNvbnN0IHJldmlld3MgPSBhd2FpdCBwcmlzbWEucmV2aWV3LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCByZXZpZXcoKTogUHJpc21hLlJldmlld0RlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEudG91clBhY2thZ2VgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqVG91clBhY2thZ2UqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFRvdXJQYWNrYWdlc1xuICAgICogY29uc3QgdG91clBhY2thZ2VzID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCB0b3VyUGFja2FnZSgpOiBQcmlzbWEuVG91clBhY2thZ2VEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnVzZXJgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqVXNlcioqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgVXNlcnNcbiAgICAqIGNvbnN0IHVzZXJzID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHVzZXIoKTogUHJpc21hLlVzZXJEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLndpc2hsaXN0SXRlbWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipXaXNobGlzdEl0ZW0qKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFdpc2hsaXN0SXRlbXNcbiAgICAqIGNvbnN0IHdpc2hsaXN0SXRlbXMgPSBhd2FpdCBwcmlzbWEud2lzaGxpc3RJdGVtLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCB3aXNobGlzdEl0ZW0oKTogUHJpc21hLldpc2hsaXN0SXRlbURlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQcmlzbWFDbGllbnRDbGFzcygpOiBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvciB7XG4gIHJldHVybiBydW50aW1lLmdldFByaXNtYUNsaWVudChjb25maWcpIGFzIHVua25vd24gYXMgUHJpc21hQ2xpZW50Q29uc3RydWN0b3Jcbn1cbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiAqIFdBUk5JTkc6IFRoaXMgaXMgYW4gaW50ZXJuYWwgZmlsZSB0aGF0IGlzIHN1YmplY3QgdG8gY2hhbmdlIVxuICpcbiAqIFx1RDgzRFx1REVEMSBVbmRlciBubyBjaXJjdW1zdGFuY2VzIHNob3VsZCB5b3UgaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseSEgXHVEODNEXHVERUQxXG4gKlxuICogQWxsIGV4cG9ydHMgZnJvbSB0aGlzIGZpbGUgYXJlIHdyYXBwZWQgdW5kZXIgYSBgUHJpc21hYCBuYW1lc3BhY2Ugb2JqZWN0IGluIHRoZSBjbGllbnQudHMgZmlsZS5cbiAqIFdoaWxlIHRoaXMgZW5hYmxlcyBwYXJ0aWFsIGJhY2t3YXJkIGNvbXBhdGliaWxpdHksIGl0IGlzIG5vdCBwYXJ0IG9mIHRoZSBzdGFibGUgcHVibGljIEFQSS5cbiAqXG4gKiBJZiB5b3UgYXJlIGxvb2tpbmcgZm9yIHlvdXIgTW9kZWxzLCBFbnVtcywgYW5kIElucHV0IFR5cGVzLCBwbGVhc2UgaW1wb3J0IHRoZW0gZnJvbSB0aGUgcmVzcGVjdGl2ZVxuICogbW9kZWwgZmlsZXMgaW4gdGhlIGBtb2RlbGAgZGlyZWN0b3J5IVxuICovXG5cbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSBcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvY2xpZW50XCJcbmltcG9ydCB0eXBlICogYXMgUHJpc21hIGZyb20gXCIuLi9tb2RlbHNcIlxuaW1wb3J0IHsgdHlwZSBQcmlzbWFDbGllbnQgfSBmcm9tIFwiLi9jbGFzc1wiXG5cbmV4cG9ydCB0eXBlICogZnJvbSAnLi4vbW9kZWxzJ1xuXG5leHBvcnQgdHlwZSBETU1GID0gdHlwZW9mIHJ1bnRpbWUuRE1NRlxuXG5leHBvcnQgdHlwZSBQcmlzbWFQcm9taXNlPFQ+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuUHJpc21hUHJvbWlzZTxUPlxuXG4vKipcbiAqIFByaXNtYSBFcnJvcnNcbiAqL1xuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3JcblxuLyoqXG4gKiBSZS1leHBvcnQgb2Ygc3FsLXRlbXBsYXRlLXRhZ1xuICovXG5leHBvcnQgY29uc3Qgc3FsID0gcnVudGltZS5zcWx0YWdcbmV4cG9ydCBjb25zdCBlbXB0eSA9IHJ1bnRpbWUuZW1wdHlcbmV4cG9ydCBjb25zdCBqb2luID0gcnVudGltZS5qb2luXG5leHBvcnQgY29uc3QgcmF3ID0gcnVudGltZS5yYXdcbmV4cG9ydCBjb25zdCBTcWwgPSBydW50aW1lLlNxbFxuZXhwb3J0IHR5cGUgU3FsID0gcnVudGltZS5TcWxcblxuXG5cbi8qKlxuICogRGVjaW1hbC5qc1xuICovXG5leHBvcnQgY29uc3QgRGVjaW1hbCA9IHJ1bnRpbWUuRGVjaW1hbFxuZXhwb3J0IHR5cGUgRGVjaW1hbCA9IHJ1bnRpbWUuRGVjaW1hbFxuXG5leHBvcnQgdHlwZSBEZWNpbWFsSnNMaWtlID0gcnVudGltZS5EZWNpbWFsSnNMaWtlXG5cbi8qKlxuKiBFeHRlbnNpb25zXG4qL1xuZXhwb3J0IHR5cGUgRXh0ZW5zaW9uID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLlVzZXJBcmdzXG5leHBvcnQgY29uc3QgZ2V0RXh0ZW5zaW9uQ29udGV4dCA9IHJ1bnRpbWUuRXh0ZW5zaW9ucy5nZXRFeHRlbnNpb25Db250ZXh0XG5leHBvcnQgdHlwZSBBcmdzPFQsIEYgZXh0ZW5kcyBydW50aW1lLk9wZXJhdGlvbj4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5BcmdzPFQsIEY+XG5leHBvcnQgdHlwZSBQYXlsb2FkPFQsIEYgZXh0ZW5kcyBydW50aW1lLk9wZXJhdGlvbiA9IG5ldmVyPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLlBheWxvYWQ8VCwgRj5cbmV4cG9ydCB0eXBlIFJlc3VsdDxULCBBLCBGIGV4dGVuZHMgcnVudGltZS5PcGVyYXRpb24+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuUmVzdWx0PFQsIEEsIEY+XG5leHBvcnQgdHlwZSBFeGFjdDxBLCBXPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLkV4YWN0PEEsIFc+XG5cbmV4cG9ydCB0eXBlIFByaXNtYVZlcnNpb24gPSB7XG4gIGNsaWVudDogc3RyaW5nXG4gIGVuZ2luZTogc3RyaW5nXG59XG5cbi8qKlxuICogUHJpc21hIENsaWVudCBKUyB2ZXJzaW9uOiA3LjkuMVxuICogUXVlcnkgRW5naW5lIHZlcnNpb246IGU5MjIwODliN2Q3NTAyYWZmNDI0OWQ1ZGEzNDIwZjZmYTU1ZmM2YWRcbiAqL1xuZXhwb3J0IGNvbnN0IHByaXNtYVZlcnNpb246IFByaXNtYVZlcnNpb24gPSB7XG4gIGNsaWVudDogXCI3LjkuMVwiLFxuICBlbmdpbmU6IFwiZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFwiXG59XG5cbi8qKlxuICogVXRpbGl0eSBUeXBlc1xuICovXG5cbmV4cG9ydCB0eXBlIEJ5dGVzID0gcnVudGltZS5CeXRlc1xuZXhwb3J0IHR5cGUgSnNvbk9iamVjdCA9IHJ1bnRpbWUuSnNvbk9iamVjdFxuZXhwb3J0IHR5cGUgSnNvbkFycmF5ID0gcnVudGltZS5Kc29uQXJyYXlcbmV4cG9ydCB0eXBlIEpzb25WYWx1ZSA9IHJ1bnRpbWUuSnNvblZhbHVlXG5leHBvcnQgdHlwZSBJbnB1dEpzb25PYmplY3QgPSBydW50aW1lLklucHV0SnNvbk9iamVjdFxuZXhwb3J0IHR5cGUgSW5wdXRKc29uQXJyYXkgPSBydW50aW1lLklucHV0SnNvbkFycmF5XG5leHBvcnQgdHlwZSBJbnB1dEpzb25WYWx1ZSA9IHJ1bnRpbWUuSW5wdXRKc29uVmFsdWVcblxuXG5leHBvcnQgY29uc3QgTnVsbFR5cGVzID0ge1xuICBEYk51bGw6IHJ1bnRpbWUuTnVsbFR5cGVzLkRiTnVsbCBhcyAobmV3IChzZWNyZXQ6IG5ldmVyKSA9PiB0eXBlb2YgcnVudGltZS5EYk51bGwpLFxuICBKc29uTnVsbDogcnVudGltZS5OdWxsVHlwZXMuSnNvbk51bGwgYXMgKG5ldyAoc2VjcmV0OiBuZXZlcikgPT4gdHlwZW9mIHJ1bnRpbWUuSnNvbk51bGwpLFxuICBBbnlOdWxsOiBydW50aW1lLk51bGxUeXBlcy5BbnlOdWxsIGFzIChuZXcgKHNlY3JldDogbmV2ZXIpID0+IHR5cGVvZiBydW50aW1lLkFueU51bGwpLFxufVxuLyoqXG4gKiBIZWxwZXIgZm9yIGZpbHRlcmluZyBKU09OIGVudHJpZXMgdGhhdCBoYXZlIGBudWxsYCBvbiB0aGUgZGF0YWJhc2UgKGVtcHR5IG9uIHRoZSBkYilcbiAqXG4gKiBAc2VlIGh0dHBzOi8vd3d3LnByaXNtYS5pby9kb2NzL2NvbmNlcHRzL2NvbXBvbmVudHMvcHJpc21hLWNsaWVudC93b3JraW5nLXdpdGgtZmllbGRzL3dvcmtpbmctd2l0aC1qc29uLWZpZWxkcyNmaWx0ZXJpbmctb24tYS1qc29uLWZpZWxkXG4gKi9cbmV4cG9ydCBjb25zdCBEYk51bGwgPSBydW50aW1lLkRiTnVsbFxuXG4vKipcbiAqIEhlbHBlciBmb3IgZmlsdGVyaW5nIEpTT04gZW50cmllcyB0aGF0IGhhdmUgSlNPTiBgbnVsbGAgdmFsdWVzIChub3QgZW1wdHkgb24gdGhlIGRiKVxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IEpzb25OdWxsID0gcnVudGltZS5Kc29uTnVsbFxuXG4vKipcbiAqIEhlbHBlciBmb3IgZmlsdGVyaW5nIEpTT04gZW50cmllcyB0aGF0IGFyZSBgUHJpc21hLkRiTnVsbGAgb3IgYFByaXNtYS5Kc29uTnVsbGBcbiAqXG4gKiBAc2VlIGh0dHBzOi8vd3d3LnByaXNtYS5pby9kb2NzL2NvbmNlcHRzL2NvbXBvbmVudHMvcHJpc21hLWNsaWVudC93b3JraW5nLXdpdGgtZmllbGRzL3dvcmtpbmctd2l0aC1qc29uLWZpZWxkcyNmaWx0ZXJpbmctb24tYS1qc29uLWZpZWxkXG4gKi9cbmV4cG9ydCBjb25zdCBBbnlOdWxsID0gcnVudGltZS5BbnlOdWxsXG5cblxudHlwZSBTZWxlY3RBbmRJbmNsdWRlID0ge1xuICBzZWxlY3Q6IGFueVxuICBpbmNsdWRlOiBhbnlcbn1cblxudHlwZSBTZWxlY3RBbmRPbWl0ID0ge1xuICBzZWxlY3Q6IGFueVxuICBvbWl0OiBhbnlcbn1cblxuLyoqXG4gKiBGcm9tIFQsIHBpY2sgYSBzZXQgb2YgcHJvcGVydGllcyB3aG9zZSBrZXlzIGFyZSBpbiB0aGUgdW5pb24gS1xuICovXG50eXBlIFByaXNtYV9fUGljazxULCBLIGV4dGVuZHMga2V5b2YgVD4gPSB7XG4gICAgW1AgaW4gS106IFRbUF07XG59O1xuXG5leHBvcnQgdHlwZSBFbnVtZXJhYmxlPFQ+ID0gVCB8IEFycmF5PFQ+O1xuXG4vKipcbiAqIFN1YnNldFxuICogQGRlc2MgRnJvbSBgVGAgcGljayBwcm9wZXJ0aWVzIHRoYXQgZXhpc3QgaW4gYFVgLiBTaW1wbGUgdmVyc2lvbiBvZiBJbnRlcnNlY3Rpb25cbiAqL1xuZXhwb3J0IHR5cGUgU3Vic2V0PFQsIFU+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiBrZXkgZXh0ZW5kcyBrZXlvZiBVID8gVFtrZXldIDogbmV2ZXI7XG59O1xuXG4vKipcbiAqIFJlc29sdmVkIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgYFByaXNtYUNsaWVudGAgY29uc3RydWN0b3IuXG4gKlxuICogV2hlbiBjYWxsZWQgd2l0aG91dCBhIG5hcnJvd2VyIG9wdGlvbnMgdHlwZSAodGhlIGNvbW1vbiBjYXNlKSwgdGhpcyByZXNvbHZlc1xuICogdG8gYFByaXNtYUNsaWVudE9wdGlvbnNgIGRpcmVjdGx5LCB3aGljaCBwcm9kdWNlcyBhIGNsZWFyIFR5cGVTY3JpcHQgZXJyb3JcbiAqIG1lc3NhZ2UgKGBub3QgYXNzaWduYWJsZSB0byBwYXJhbWV0ZXIgb2YgdHlwZSAnUHJpc21hQ2xpZW50T3B0aW9ucydgKSB3aGVuXG4gKiB0aGUgYXJndW1lbnQgaXMgbWlzc2luZyBvciBpbmNvbXBsZXRlLiBXaGVuIHRoZSB1c2VyIHN1cHBsaWVzIGEgbmFycm93ZXJcbiAqIG9wdGlvbnMgdHlwZSAoZS5nLiB2aWEgYSBsaXRlcmFsKSwgaXQgZmFsbHMgYmFjayB0byBgU3Vic2V0YCB0byBrZWVwXG4gKiBmaWx0ZXJpbmcgb3V0IHVua25vd24gcHJvcGVydGllcy5cbiAqL1xuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50Q29uc3RydWN0b3JBcmdzPE9wdGlvbnMgZXh0ZW5kcyBQcmlzbWFDbGllbnRPcHRpb25zPiA9XG4gIFtQcmlzbWFDbGllbnRPcHRpb25zXSBleHRlbmRzIFtPcHRpb25zXSA/IFByaXNtYUNsaWVudE9wdGlvbnMgOiBTdWJzZXQ8T3B0aW9ucywgUHJpc21hQ2xpZW50T3B0aW9ucz47XG5cbi8qKlxuICogU2VsZWN0U3Vic2V0XG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAuIFNpbXBsZSB2ZXJzaW9uIG9mIEludGVyc2VjdGlvbi5cbiAqIEFkZGl0aW9uYWxseSwgaXQgdmFsaWRhdGVzLCBpZiBib3RoIHNlbGVjdCBhbmQgaW5jbHVkZSBhcmUgcHJlc2VudC4gSWYgdGhlIGNhc2UsIGl0IGVycm9ycy5cbiAqL1xuZXhwb3J0IHR5cGUgU2VsZWN0U3Vic2V0PFQsIFU+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiBrZXkgZXh0ZW5kcyBrZXlvZiBVID8gVFtrZXldIDogbmV2ZXJcbn0gJlxuICAoVCBleHRlbmRzIFNlbGVjdEFuZEluY2x1ZGVcbiAgICA/ICdQbGVhc2UgZWl0aGVyIGNob29zZSBgc2VsZWN0YCBvciBgaW5jbHVkZWAuJ1xuICAgIDogVCBleHRlbmRzIFNlbGVjdEFuZE9taXRcbiAgICAgID8gJ1BsZWFzZSBlaXRoZXIgY2hvb3NlIGBzZWxlY3RgIG9yIGBvbWl0YC4nXG4gICAgICA6IHt9KVxuXG4vKipcbiAqIFN1YnNldCArIEludGVyc2VjdGlvblxuICogQGRlc2MgRnJvbSBgVGAgcGljayBwcm9wZXJ0aWVzIHRoYXQgZXhpc3QgaW4gYFVgIGFuZCBpbnRlcnNlY3QgYEtgXG4gKi9cbmV4cG9ydCB0eXBlIFN1YnNldEludGVyc2VjdGlvbjxULCBVLCBLPiA9IHtcbiAgW2tleSBpbiBrZXlvZiBUXToga2V5IGV4dGVuZHMga2V5b2YgVSA/IFRba2V5XSA6IG5ldmVyXG59ICZcbiAgS1xuXG50eXBlIFdpdGhvdXQ8VCwgVT4gPSB7IFtQIGluIEV4Y2x1ZGU8a2V5b2YgVCwga2V5b2YgVT5dPzogbmV2ZXIgfTtcblxuLyoqXG4gKiBYT1IgaXMgbmVlZGVkIHRvIGhhdmUgYSByZWFsIG11dHVhbGx5IGV4Y2x1c2l2ZSB1bmlvbiB0eXBlXG4gKiBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy80MjEyMzQwNy9kb2VzLXR5cGVzY3JpcHQtc3VwcG9ydC1tdXR1YWxseS1leGNsdXNpdmUtdHlwZXNcbiAqL1xuZXhwb3J0IHR5cGUgWE9SPFQsIFU+ID1cbiAgVCBleHRlbmRzIG9iamVjdCA/XG4gIFUgZXh0ZW5kcyBvYmplY3QgP1xuICAgICgoV2l0aG91dDxULCBVPiAmIFUpIHwgKFdpdGhvdXQ8VSwgVD4gJiBUKSkgJiBvYmplY3RcbiAgOiBVIDogVFxuXG5cbi8qKlxuICogSXMgVCBhIFJlY29yZD9cbiAqL1xudHlwZSBJc09iamVjdDxUIGV4dGVuZHMgYW55PiA9IFQgZXh0ZW5kcyBBcnJheTxhbnk+XG4/IEZhbHNlXG46IFQgZXh0ZW5kcyBEYXRlXG4/IEZhbHNlXG46IFQgZXh0ZW5kcyBVaW50OEFycmF5XG4/IEZhbHNlXG46IFQgZXh0ZW5kcyBCaWdJbnRcbj8gRmFsc2VcbjogVCBleHRlbmRzIG9iamVjdFxuPyBUcnVlXG46IEZhbHNlXG5cblxuLyoqXG4gKiBJZiBpdCdzIFRbXSwgcmV0dXJuIFRcbiAqL1xuZXhwb3J0IHR5cGUgVW5FbnVtZXJhdGU8VCBleHRlbmRzIHVua25vd24+ID0gVCBleHRlbmRzIEFycmF5PGluZmVyIFU+ID8gVSA6IFRcblxuLyoqXG4gKiBGcm9tIHRzLXRvb2xiZWx0XG4gKi9cblxudHlwZSBfX0VpdGhlcjxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IE9taXQ8TywgSz4gJlxuICB7XG4gICAgLy8gTWVyZ2UgYWxsIGJ1dCBLXG4gICAgW1AgaW4gS106IFByaXNtYV9fUGljazxPLCBQICYga2V5b2YgTz4gLy8gV2l0aCBLIHBvc3NpYmlsaXRpZXNcbiAgfVtLXVxuXG50eXBlIEVpdGhlclN0cmljdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IFN0cmljdDxfX0VpdGhlcjxPLCBLPj5cblxudHlwZSBFaXRoZXJMb29zZTxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IENvbXB1dGVSYXc8X19FaXRoZXI8TywgSz4+XG5cbnR5cGUgX0VpdGhlcjxcbiAgTyBleHRlbmRzIG9iamVjdCxcbiAgSyBleHRlbmRzIEtleSxcbiAgc3RyaWN0IGV4dGVuZHMgQm9vbGVhblxuPiA9IHtcbiAgMTogRWl0aGVyU3RyaWN0PE8sIEs+XG4gIDA6IEVpdGhlckxvb3NlPE8sIEs+XG59W3N0cmljdF1cblxuZXhwb3J0IHR5cGUgRWl0aGVyPFxuICBPIGV4dGVuZHMgb2JqZWN0LFxuICBLIGV4dGVuZHMgS2V5LFxuICBzdHJpY3QgZXh0ZW5kcyBCb29sZWFuID0gMVxuPiA9IE8gZXh0ZW5kcyB1bmtub3duID8gX0VpdGhlcjxPLCBLLCBzdHJpY3Q+IDogbmV2ZXJcblxuZXhwb3J0IHR5cGUgVW5pb24gPSBhbnlcblxuZXhwb3J0IHR5cGUgUGF0Y2hVbmRlZmluZWQ8TyBleHRlbmRzIG9iamVjdCwgTzEgZXh0ZW5kcyBvYmplY3Q+ID0ge1xuICBbSyBpbiBrZXlvZiBPXTogT1tLXSBleHRlbmRzIHVuZGVmaW5lZCA/IEF0PE8xLCBLPiA6IE9bS11cbn0gJiB7fVxuXG4vKiogSGVscGVyIFR5cGVzIGZvciBcIk1lcmdlXCIgKiovXG5leHBvcnQgdHlwZSBJbnRlcnNlY3RPZjxVIGV4dGVuZHMgVW5pb24+ID0gKFxuICBVIGV4dGVuZHMgdW5rbm93biA/IChrOiBVKSA9PiB2b2lkIDogbmV2ZXJcbikgZXh0ZW5kcyAoazogaW5mZXIgSSkgPT4gdm9pZFxuICA/IElcbiAgOiBuZXZlclxuXG5leHBvcnQgdHlwZSBPdmVyd3JpdGU8TyBleHRlbmRzIG9iamVjdCwgTzEgZXh0ZW5kcyBvYmplY3Q+ID0ge1xuICAgIFtLIGluIGtleW9mIE9dOiBLIGV4dGVuZHMga2V5b2YgTzEgPyBPMVtLXSA6IE9bS107XG59ICYge307XG5cbnR5cGUgX01lcmdlPFUgZXh0ZW5kcyBvYmplY3Q+ID0gSW50ZXJzZWN0T2Y8T3ZlcndyaXRlPFUsIHtcbiAgICBbSyBpbiBrZXlvZiBVXS0/OiBBdDxVLCBLPjtcbn0+PjtcblxudHlwZSBLZXkgPSBzdHJpbmcgfCBudW1iZXIgfCBzeW1ib2w7XG50eXBlIEF0U3RyaWN0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gT1tLICYga2V5b2YgT107XG50eXBlIEF0TG9vc2U8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBPIGV4dGVuZHMgdW5rbm93biA/IEF0U3RyaWN0PE8sIEs+IDogbmV2ZXI7XG5leHBvcnQgdHlwZSBBdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5LCBzdHJpY3QgZXh0ZW5kcyBCb29sZWFuID0gMT4gPSB7XG4gICAgMTogQXRTdHJpY3Q8TywgSz47XG4gICAgMDogQXRMb29zZTxPLCBLPjtcbn1bc3RyaWN0XTtcblxuZXhwb3J0IHR5cGUgQ29tcHV0ZVJhdzxBIGV4dGVuZHMgYW55PiA9IEEgZXh0ZW5kcyBGdW5jdGlvbiA/IEEgOiB7XG4gIFtLIGluIGtleW9mIEFdOiBBW0tdO1xufSAmIHt9O1xuXG5leHBvcnQgdHlwZSBPcHRpb25hbEZsYXQ8Tz4gPSB7XG4gIFtLIGluIGtleW9mIE9dPzogT1tLXTtcbn0gJiB7fTtcblxudHlwZSBfUmVjb3JkPEsgZXh0ZW5kcyBrZXlvZiBhbnksIFQ+ID0ge1xuICBbUCBpbiBLXTogVDtcbn07XG5cbi8vIGNhdXNlIHR5cGVzY3JpcHQgbm90IHRvIGV4cGFuZCB0eXBlcyBhbmQgcHJlc2VydmUgbmFtZXNcbnR5cGUgTm9FeHBhbmQ8VD4gPSBUIGV4dGVuZHMgdW5rbm93biA/IFQgOiBuZXZlcjtcblxuLy8gdGhpcyB0eXBlIGFzc3VtZXMgdGhlIHBhc3NlZCBvYmplY3QgaXMgZW50aXJlbHkgb3B0aW9uYWxcbmV4cG9ydCB0eXBlIEF0TGVhc3Q8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIHN0cmluZz4gPSBOb0V4cGFuZDxcbiAgTyBleHRlbmRzIHVua25vd25cbiAgPyB8IChLIGV4dGVuZHMga2V5b2YgTyA/IHsgW1AgaW4gS106IE9bUF0gfSAmIE8gOiBPKVxuICAgIHwge1tQIGluIGtleW9mIE8gYXMgUCBleHRlbmRzIEsgPyBQIDogbmV2ZXJdLT86IE9bUF19ICYgT1xuICA6IG5ldmVyPjtcblxudHlwZSBfU3RyaWN0PFUsIF9VID0gVT4gPSBVIGV4dGVuZHMgdW5rbm93biA/IFUgJiBPcHRpb25hbEZsYXQ8X1JlY29yZDxFeGNsdWRlPEtleXM8X1U+LCBrZXlvZiBVPiwgbmV2ZXI+PiA6IG5ldmVyO1xuXG5leHBvcnQgdHlwZSBTdHJpY3Q8VSBleHRlbmRzIG9iamVjdD4gPSBDb21wdXRlUmF3PF9TdHJpY3Q8VT4+O1xuLyoqIEVuZCBIZWxwZXIgVHlwZXMgZm9yIFwiTWVyZ2VcIiAqKi9cblxuZXhwb3J0IHR5cGUgTWVyZ2U8VSBleHRlbmRzIG9iamVjdD4gPSBDb21wdXRlUmF3PF9NZXJnZTxTdHJpY3Q8VT4+PjtcblxuZXhwb3J0IHR5cGUgQm9vbGVhbiA9IFRydWUgfCBGYWxzZVxuXG5leHBvcnQgdHlwZSBUcnVlID0gMVxuXG5leHBvcnQgdHlwZSBGYWxzZSA9IDBcblxuZXhwb3J0IHR5cGUgTm90PEIgZXh0ZW5kcyBCb29sZWFuPiA9IHtcbiAgMDogMVxuICAxOiAwXG59W0JdXG5cbmV4cG9ydCB0eXBlIEV4dGVuZHM8QTEgZXh0ZW5kcyBhbnksIEEyIGV4dGVuZHMgYW55PiA9IFtBMV0gZXh0ZW5kcyBbbmV2ZXJdXG4gID8gMCAvLyBhbnl0aGluZyBgbmV2ZXJgIGlzIGZhbHNlXG4gIDogQTEgZXh0ZW5kcyBBMlxuICA/IDFcbiAgOiAwXG5cbmV4cG9ydCB0eXBlIEhhczxVIGV4dGVuZHMgVW5pb24sIFUxIGV4dGVuZHMgVW5pb24+ID0gTm90PFxuICBFeHRlbmRzPEV4Y2x1ZGU8VTEsIFU+LCBVMT5cbj5cblxuZXhwb3J0IHR5cGUgT3I8QjEgZXh0ZW5kcyBCb29sZWFuLCBCMiBleHRlbmRzIEJvb2xlYW4+ID0ge1xuICAwOiB7XG4gICAgMDogMFxuICAgIDE6IDFcbiAgfVxuICAxOiB7XG4gICAgMDogMVxuICAgIDE6IDFcbiAgfVxufVtCMV1bQjJdXG5cbmV4cG9ydCB0eXBlIEtleXM8VSBleHRlbmRzIFVuaW9uPiA9IFUgZXh0ZW5kcyB1bmtub3duID8ga2V5b2YgVSA6IG5ldmVyXG5cbmV4cG9ydCB0eXBlIEdldFNjYWxhclR5cGU8VCwgTz4gPSBPIGV4dGVuZHMgb2JqZWN0ID8ge1xuICBbUCBpbiBrZXlvZiBUXTogUCBleHRlbmRzIGtleW9mIE9cbiAgICA/IE9bUF1cbiAgICA6IG5ldmVyXG59IDogbmV2ZXJcblxudHlwZSBGaWVsZFBhdGhzPFxuICBULFxuICBVID0gT21pdDxULCAnX2F2ZycgfCAnX3N1bScgfCAnX2NvdW50JyB8ICdfbWluJyB8ICdfbWF4Jz5cbj4gPSBJc09iamVjdDxUPiBleHRlbmRzIFRydWUgPyBVIDogVFxuXG5leHBvcnQgdHlwZSBHZXRIYXZpbmdGaWVsZHM8VD4gPSB7XG4gIFtLIGluIGtleW9mIFRdOiBPcjxcbiAgICBPcjxFeHRlbmRzPCdPUicsIEs+LCBFeHRlbmRzPCdBTkQnLCBLPj4sXG4gICAgRXh0ZW5kczwnTk9UJywgSz5cbiAgPiBleHRlbmRzIFRydWVcbiAgICA/IC8vIGluZmVyIGlzIG9ubHkgbmVlZGVkIHRvIG5vdCBoaXQgVFMgbGltaXRcbiAgICAgIC8vIGJhc2VkIG9uIHRoZSBicmlsbGlhbnQgaWRlYSBvZiBQaWVycmUtQW50b2luZSBNaWxsc1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy8zMDE4OCNpc3N1ZWNvbW1lbnQtNDc4OTM4NDM3XG4gICAgICBUW0tdIGV4dGVuZHMgaW5mZXIgVEtcbiAgICAgID8gR2V0SGF2aW5nRmllbGRzPFVuRW51bWVyYXRlPFRLPiBleHRlbmRzIG9iamVjdCA/IE1lcmdlPFVuRW51bWVyYXRlPFRLPj4gOiBuZXZlcj5cbiAgICAgIDogbmV2ZXJcbiAgICA6IHt9IGV4dGVuZHMgRmllbGRQYXRoczxUW0tdPlxuICAgID8gbmV2ZXJcbiAgICA6IEtcbn1ba2V5b2YgVF1cblxuLyoqXG4gKiBDb252ZXJ0IHR1cGxlIHRvIHVuaW9uXG4gKi9cbnR5cGUgX1R1cGxlVG9VbmlvbjxUPiA9IFQgZXh0ZW5kcyAoaW5mZXIgRSlbXSA/IEUgOiBuZXZlclxudHlwZSBUdXBsZVRvVW5pb248SyBleHRlbmRzIHJlYWRvbmx5IGFueVtdPiA9IF9UdXBsZVRvVW5pb248Sz5cbmV4cG9ydCB0eXBlIE1heWJlVHVwbGVUb1VuaW9uPFQ+ID0gVCBleHRlbmRzIGFueVtdID8gVHVwbGVUb1VuaW9uPFQ+IDogVFxuXG4vKipcbiAqIExpa2UgYFBpY2tgLCBidXQgYWRkaXRpb25hbGx5IGNhbiBhbHNvIGFjY2VwdCBhbiBhcnJheSBvZiBrZXlzXG4gKi9cbmV4cG9ydCB0eXBlIFBpY2tFbnVtZXJhYmxlPFQsIEsgZXh0ZW5kcyBFbnVtZXJhYmxlPGtleW9mIFQ+IHwga2V5b2YgVD4gPSBQcmlzbWFfX1BpY2s8VCwgTWF5YmVUdXBsZVRvVW5pb248Sz4+XG5cbi8qKlxuICogRXhjbHVkZSBhbGwga2V5cyB3aXRoIHVuZGVyc2NvcmVzXG4gKi9cbmV4cG9ydCB0eXBlIEV4Y2x1ZGVVbmRlcnNjb3JlS2V5czxUIGV4dGVuZHMgc3RyaW5nPiA9IFQgZXh0ZW5kcyBgXyR7c3RyaW5nfWAgPyBuZXZlciA6IFRcblxuXG5leHBvcnQgdHlwZSBGaWVsZFJlZjxNb2RlbCwgRmllbGRUeXBlPiA9IHJ1bnRpbWUuRmllbGRSZWY8TW9kZWwsIEZpZWxkVHlwZT5cblxudHlwZSBGaWVsZFJlZklucHV0VHlwZTxNb2RlbCwgRmllbGRUeXBlPiA9IE1vZGVsIGV4dGVuZHMgbmV2ZXIgPyBuZXZlciA6IEZpZWxkUmVmPE1vZGVsLCBGaWVsZFR5cGU+XG5cblxuZXhwb3J0IGNvbnN0IE1vZGVsTmFtZSA9IHtcbiAgQmxvZ0NvbW1lbnQ6ICdCbG9nQ29tbWVudCcsXG4gIEJsb2dQb3N0OiAnQmxvZ1Bvc3QnLFxuICBCb29raW5nOiAnQm9va2luZycsXG4gIENhdGVnb3J5OiAnQ2F0ZWdvcnknLFxuICBDb250YWN0TWVzc2FnZTogJ0NvbnRhY3RNZXNzYWdlJyxcbiAgTm90aWZpY2F0aW9uOiAnTm90aWZpY2F0aW9uJyxcbiAgUGF5bWVudDogJ1BheW1lbnQnLFxuICBSZWZyZXNoVG9rZW46ICdSZWZyZXNoVG9rZW4nLFxuICBSZXZpZXc6ICdSZXZpZXcnLFxuICBUb3VyUGFja2FnZTogJ1RvdXJQYWNrYWdlJyxcbiAgVXNlcjogJ1VzZXInLFxuICBXaXNobGlzdEl0ZW06ICdXaXNobGlzdEl0ZW0nXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE1vZGVsTmFtZSA9ICh0eXBlb2YgTW9kZWxOYW1lKVtrZXlvZiB0eXBlb2YgTW9kZWxOYW1lXVxuXG5cblxuZXhwb3J0IGludGVyZmFjZSBUeXBlTWFwQ2I8R2xvYmFsT21pdE9wdGlvbnMgPSB7fT4gZXh0ZW5kcyBydW50aW1lLlR5cGVzLlV0aWxzLkZuPHtleHRBcmdzOiBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzIH0sIHJ1bnRpbWUuVHlwZXMuVXRpbHMuUmVjb3JkPHN0cmluZywgYW55Pj4ge1xuICByZXR1cm5zOiBUeXBlTWFwPHRoaXNbJ3BhcmFtcyddWydleHRBcmdzJ10sIEdsb2JhbE9taXRPcHRpb25zPlxufVxuXG5leHBvcnQgdHlwZSBUeXBlTWFwPEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzLCBHbG9iYWxPbWl0T3B0aW9ucyA9IHt9PiA9IHtcbiAgZ2xvYmFsT21pdE9wdGlvbnM6IHtcbiAgICBvbWl0OiBHbG9iYWxPbWl0T3B0aW9uc1xuICB9XG4gIG1ldGE6IHtcbiAgICBtb2RlbFByb3BzOiBcImJsb2dDb21tZW50XCIgfCBcImJsb2dQb3N0XCIgfCBcImJvb2tpbmdcIiB8IFwiY2F0ZWdvcnlcIiB8IFwiY29udGFjdE1lc3NhZ2VcIiB8IFwibm90aWZpY2F0aW9uXCIgfCBcInBheW1lbnRcIiB8IFwicmVmcmVzaFRva2VuXCIgfCBcInJldmlld1wiIHwgXCJ0b3VyUGFja2FnZVwiIHwgXCJ1c2VyXCIgfCBcIndpc2hsaXN0SXRlbVwiXG4gICAgdHhJc29sYXRpb25MZXZlbDogVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbFxuICB9XG4gIG1vZGVsOiB7XG4gICAgQmxvZ0NvbW1lbnQ6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5CbG9nQ29tbWVudEZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudEZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudENyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudERlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVCbG9nQ29tbWVudD5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJsb2dDb21tZW50R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudENvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQmxvZ0NvbW1lbnRDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQmxvZ1Bvc3Q6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5CbG9nUG9zdEZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdERlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVCbG9nUG9zdD5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJsb2dQb3N0R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQmxvZ1Bvc3RDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQm9va2luZzoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRCb29raW5nUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQm9va2luZ0ZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1VwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQm9va2luZz5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQm9va2luZ0dyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQm9va2luZ0NvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBDYXRlZ29yeToge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRDYXRlZ29yeVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkNhdGVnb3J5RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUNhdGVnb3J5PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ2F0ZWdvcnlHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5DYXRlZ29yeUNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBDb250YWN0TWVzc2FnZToge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUNvbnRhY3RNZXNzYWdlPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ29udGFjdE1lc3NhZ2VHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Db250YWN0TWVzc2FnZUNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBOb3RpZmljYXRpb246IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25GaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25VcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25EZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25VcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25VcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvblVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlTm90aWZpY2F0aW9uPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLk5vdGlmaWNhdGlvbkdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Ob3RpZmljYXRpb25Db3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgUGF5bWVudDoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRQYXltZW50UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUGF5bWVudEZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnREZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnREZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUGF5bWVudD5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUGF5bWVudEdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUGF5bWVudENvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBSZWZyZXNoVG9rZW46IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUmVmcmVzaFRva2VuRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5GaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5VcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5EZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5VcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5VcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlblVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUmVmcmVzaFRva2VuPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJlZnJlc2hUb2tlbkdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5SZWZyZXNoVG9rZW5Db3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgUmV2aWV3OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFJldmlld1BheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlJldmlld0ZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0RlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0FnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVJldmlldz5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0dyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5SZXZpZXdHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUmV2aWV3Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFRvdXJQYWNrYWdlOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuVG91clBhY2thZ2VGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlVG91clBhY2thZ2U+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Ub3VyUGFja2FnZUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlRvdXJQYWNrYWdlQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFVzZXI6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kVXNlclBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlVzZXJGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVVzZXI+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlVzZXJHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlVzZXJDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgV2lzaGxpc3RJdGVtOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLldpc2hsaXN0SXRlbUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1DcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1DcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1DcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1VcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVdpc2hsaXN0SXRlbT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5XaXNobGlzdEl0ZW1Hcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuV2lzaGxpc3RJdGVtQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59ICYge1xuICBvdGhlcjoge1xuICAgIHBheWxvYWQ6IGFueVxuICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICRleGVjdXRlUmF3OiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBTcWwsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJGV4ZWN1dGVSYXdVbnNhZmU6IHtcbiAgICAgICAgYXJnczogW3F1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJHF1ZXJ5UmF3OiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBTcWwsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJHF1ZXJ5UmF3VW5zYWZlOiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBFbnVtc1xuICovXG5cbmV4cG9ydCBjb25zdCBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsID0gcnVudGltZS5tYWtlU3RyaWN0RW51bSh7XG4gIFJlYWRVbmNvbW1pdHRlZDogJ1JlYWRVbmNvbW1pdHRlZCcsXG4gIFJlYWRDb21taXR0ZWQ6ICdSZWFkQ29tbWl0dGVkJyxcbiAgUmVwZWF0YWJsZVJlYWQ6ICdSZXBlYXRhYmxlUmVhZCcsXG4gIFNlcmlhbGl6YWJsZTogJ1NlcmlhbGl6YWJsZSdcbn0gYXMgY29uc3QpXG5cbmV4cG9ydCB0eXBlIFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgPSAodHlwZW9mIFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwpW2tleW9mIHR5cGVvZiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsXVxuXG5cbmV4cG9ydCBjb25zdCBCbG9nQ29tbWVudFNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIGNvbnRlbnQ6ICdjb250ZW50JyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgcG9zdElkOiAncG9zdElkJyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgcGFyZW50SWQ6ICdwYXJlbnRJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQmxvZ0NvbW1lbnRTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIEJsb2dDb21tZW50U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQmxvZ0NvbW1lbnRTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IEJsb2dQb3N0U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdGl0bGU6ICd0aXRsZScsXG4gIHNsdWc6ICdzbHVnJyxcbiAgZXhjZXJwdDogJ2V4Y2VycHQnLFxuICBjb250ZW50OiAnY29udGVudCcsXG4gIGNvdmVySW1hZ2U6ICdjb3ZlckltYWdlJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgYXV0aG9ySWQ6ICdhdXRob3JJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIEJsb2dQb3N0U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IEJvb2tpbmdTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0cmF2ZWxEYXRlOiAndHJhdmVsRGF0ZScsXG4gIHRyYXZlbGVyczogJ3RyYXZlbGVycycsXG4gIHRvdGFsUHJpY2U6ICd0b3RhbFByaWNlJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgcGFja2FnZUlkOiAncGFja2FnZUlkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBCb29raW5nU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBCb29raW5nU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQm9va2luZ1NjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQ2F0ZWdvcnlTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBuYW1lOiAnbmFtZScsXG4gIHNsdWc6ICdzbHVnJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQ2F0ZWdvcnlTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBDYXRlZ29yeVNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBuYW1lOiAnbmFtZScsXG4gIGVtYWlsOiAnZW1haWwnLFxuICBzdWJqZWN0OiAnc3ViamVjdCcsXG4gIG1lc3NhZ2U6ICdtZXNzYWdlJyxcbiAgaXNSZXNvbHZlZDogJ2lzUmVzb2x2ZWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBOb3RpZmljYXRpb25TY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICB0eXBlOiAndHlwZScsXG4gIHRpdGxlOiAndGl0bGUnLFxuICBtZXNzYWdlOiAnbWVzc2FnZScsXG4gIGxpbms6ICdsaW5rJyxcbiAgaXNSZWFkOiAnaXNSZWFkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBOb3RpZmljYXRpb25TY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIE5vdGlmaWNhdGlvblNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIE5vdGlmaWNhdGlvblNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgUGF5bWVudFNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIGJvb2tpbmdJZDogJ2Jvb2tpbmdJZCcsXG4gIHRyYW5JZDogJ3RyYW5JZCcsXG4gIHZhbElkOiAndmFsSWQnLFxuICBhbW91bnQ6ICdhbW91bnQnLFxuICBjdXJyZW5jeTogJ2N1cnJlbmN5JyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgZ2F0ZXdheVBhZ2VVcmw6ICdnYXRld2F5UGFnZVVybCcsXG4gIHNzbFNlc3Npb25LZXk6ICdzc2xTZXNzaW9uS2V5JyxcbiAgY2FyZFR5cGU6ICdjYXJkVHlwZScsXG4gIGJhbmtUcmFuSWQ6ICdiYW5rVHJhbklkJyxcbiAgcGFpZEF0OiAncGFpZEF0JyxcbiAgcmVmdW5kUmVmSWQ6ICdyZWZ1bmRSZWZJZCcsXG4gIHJlZnVuZEluaXRpYXRlZEF0OiAncmVmdW5kSW5pdGlhdGVkQXQnLFxuICByZWZ1bmRDb21wbGV0ZWRBdDogJ3JlZnVuZENvbXBsZXRlZEF0JyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQYXltZW50U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBQYXltZW50U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgUGF5bWVudFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgUmVmcmVzaFRva2VuU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgaGFzaDogJ2hhc2gnLFxuICBleHBpcmVzQXQ6ICdleHBpcmVzQXQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICByZXZva2VkQXQ6ICdyZXZva2VkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFJlZnJlc2hUb2tlblNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgUmVmcmVzaFRva2VuU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgUmVmcmVzaFRva2VuU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBSZXZpZXdTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICByYXRpbmc6ICdyYXRpbmcnLFxuICBjb21tZW50OiAnY29tbWVudCcsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHBhY2thZ2VJZDogJ3BhY2thZ2VJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUmV2aWV3U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBSZXZpZXdTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBSZXZpZXdTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdGl0bGU6ICd0aXRsZScsXG4gIHNsdWc6ICdzbHVnJyxcbiAgZGVzY3JpcHRpb246ICdkZXNjcmlwdGlvbicsXG4gIGxvY2F0aW9uOiAnbG9jYXRpb24nLFxuICBwcmljZTogJ3ByaWNlJyxcbiAgZHVyYXRpb246ICdkdXJhdGlvbicsXG4gIHJhdGluZzogJ3JhdGluZycsXG4gIGltYWdlczogJ2ltYWdlcycsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIGNhdGVnb3J5SWQ6ICdjYXRlZ29yeUlkJyxcbiAgYWdlbnRJZDogJ2FnZW50SWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBVc2VyU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgbmFtZTogJ25hbWUnLFxuICBlbWFpbDogJ2VtYWlsJyxcbiAgcGFzc3dvcmQ6ICdwYXNzd29yZCcsXG4gIGdvb2dsZUlkOiAnZ29vZ2xlSWQnLFxuICBwaG9uZTogJ3Bob25lJyxcbiAgYXZhdGFyVXJsOiAnYXZhdGFyVXJsJyxcbiAgcm9sZTogJ3JvbGUnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBhdXRoUHJvdmlkZXI6ICdhdXRoUHJvdmlkZXInLFxuICBlbWFpbFZlcmlmaWVkOiAnZW1haWxWZXJpZmllZCcsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIHRva2VuVmVyc2lvbjogJ3Rva2VuVmVyc2lvbicsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVXNlclNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgVXNlclNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFVzZXJTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFdpc2hsaXN0SXRlbVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHBhY2thZ2VJZDogJ3BhY2thZ2VJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgV2lzaGxpc3RJdGVtU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBXaXNobGlzdEl0ZW1TY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBXaXNobGlzdEl0ZW1TY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFNvcnRPcmRlciA9IHtcbiAgYXNjOiAnYXNjJyxcbiAgZGVzYzogJ2Rlc2MnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFNvcnRPcmRlciA9ICh0eXBlb2YgU29ydE9yZGVyKVtrZXlvZiB0eXBlb2YgU29ydE9yZGVyXVxuXG5cbmV4cG9ydCBjb25zdCBRdWVyeU1vZGUgPSB7XG4gIGRlZmF1bHQ6ICdkZWZhdWx0JyxcbiAgaW5zZW5zaXRpdmU6ICdpbnNlbnNpdGl2ZSdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUXVlcnlNb2RlID0gKHR5cGVvZiBRdWVyeU1vZGUpW2tleW9mIHR5cGVvZiBRdWVyeU1vZGVdXG5cblxuZXhwb3J0IGNvbnN0IE51bGxzT3JkZXIgPSB7XG4gIGZpcnN0OiAnZmlyc3QnLFxuICBsYXN0OiAnbGFzdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgTnVsbHNPcmRlciA9ICh0eXBlb2YgTnVsbHNPcmRlcilba2V5b2YgdHlwZW9mIE51bGxzT3JkZXJdXG5cblxuXG4vKipcbiAqIEZpZWxkIHJlZmVyZW5jZXNcbiAqL1xuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnU3RyaW5nJ1xuICovXG5leHBvcnQgdHlwZSBTdHJpbmdGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdTdHJpbmcnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnU3RyaW5nW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RTdHJpbmdGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdTdHJpbmdbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29sZWFuJ1xuICovXG5leHBvcnQgdHlwZSBCb29sZWFuRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQm9vbGVhbic+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEYXRlVGltZSdcbiAqL1xuZXhwb3J0IHR5cGUgRGF0ZVRpbWVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEYXRlVGltZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEYXRlVGltZVtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RGF0ZVRpbWVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEYXRlVGltZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1Bvc3RTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Qb3N0U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUG9zdFN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQb3N0U3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUG9zdFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1Bvc3RTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdJbnQnXG4gKi9cbmV4cG9ydCB0eXBlIEludEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0ludCc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdJbnRbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEludEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0ludFtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RlY2ltYWwnXG4gKi9cbmV4cG9ydCB0eXBlIERlY2ltYWxGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEZWNpbWFsJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RlY2ltYWxbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdERlY2ltYWxGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEZWNpbWFsW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQm9va2luZ1N0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bUJvb2tpbmdTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29raW5nU3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Jvb2tpbmdTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Cb29raW5nU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQm9va2luZ1N0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ05vdGlmaWNhdGlvblR5cGUnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Ob3RpZmljYXRpb25UeXBlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnTm90aWZpY2F0aW9uVHlwZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdOb3RpZmljYXRpb25UeXBlW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtTm90aWZpY2F0aW9uVHlwZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ05vdGlmaWNhdGlvblR5cGVbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYXltZW50U3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUGF5bWVudFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BheW1lbnRTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGF5bWVudFN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBheW1lbnRTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYXltZW50U3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRmxvYXQnXG4gKi9cbmV4cG9ydCB0eXBlIEZsb2F0RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRmxvYXQnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRmxvYXRbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEZsb2F0RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRmxvYXRbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYWNrYWdlU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUGFja2FnZVN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BhY2thZ2VTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGFja2FnZVN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBhY2thZ2VTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYWNrYWdlU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUm9sZSdcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVJvbGVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdSb2xlJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1JvbGVbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Sb2xlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUm9sZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1VzZXJTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Vc2VyU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnVXNlclN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdVc2VyU3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtVXNlclN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1VzZXJTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdBdXRoUHJvdmlkZXInXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1BdXRoUHJvdmlkZXJGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdBdXRoUHJvdmlkZXInPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQXV0aFByb3ZpZGVyW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtQXV0aFByb3ZpZGVyRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQXV0aFByb3ZpZGVyW10nPlxuICAgIFxuXG4vKipcbiAqIEJhdGNoIFBheWxvYWQgZm9yIHVwZGF0ZU1hbnkgJiBkZWxldGVNYW55ICYgY3JlYXRlTWFueVxuICovXG5leHBvcnQgdHlwZSBCYXRjaFBheWxvYWQgPSB7XG4gIGNvdW50OiBudW1iZXJcbn1cblxuZXhwb3J0IGNvbnN0IGRlZmluZUV4dGVuc2lvbiA9IHJ1bnRpbWUuRXh0ZW5zaW9ucy5kZWZpbmVFeHRlbnNpb24gYXMgdW5rbm93biBhcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRXh0ZW5kc0hvb2s8XCJkZWZpbmVcIiwgVHlwZU1hcENiLCBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3M+XG5leHBvcnQgdHlwZSBEZWZhdWx0UHJpc21hQ2xpZW50ID0gUHJpc21hQ2xpZW50XG5leHBvcnQgdHlwZSBFcnJvckZvcm1hdCA9ICdwcmV0dHknIHwgJ2NvbG9ybGVzcycgfCAnbWluaW1hbCdcbi8qKlxuICogT3B0aW9ucyBjb21tb24gdG8gYWxsIHZhcmlhbnRzIG9mIGBQcmlzbWFDbGllbnRPcHRpb25zYCwgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHlvdSBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBhIGRyaXZlciBhZGFwdGVyIG9yIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogQGRlZmF1bHQgXCJjb2xvcmxlc3NcIlxuICAgKi9cbiAgZXJyb3JGb3JtYXQ/OiBFcnJvckZvcm1hdFxuICAvKipcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIC8vIFNob3J0aGFuZCBmb3IgYGVtaXQ6ICdzdGRvdXQnYFxuICAgKiBsb2c6IFsncXVlcnknLCAnaW5mbycsICd3YXJuJywgJ2Vycm9yJ11cbiAgICogXG4gICAqIC8vIEVtaXQgYXMgZXZlbnRzIG9ubHlcbiAgICogbG9nOiBbXG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ3F1ZXJ5JyB9LFxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdpbmZvJyB9LFxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICd3YXJuJyB9XG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ2Vycm9yJyB9XG4gICAqIF1cbiAgICogXG4gICAqIC8gRW1pdCBhcyBldmVudHMgYW5kIGxvZyB0byBzdGRvdXRcbiAgICogb2c6IFtcbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAncXVlcnknIH0sXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ2luZm8nIH0sXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ3dhcm4nIH1cbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAnZXJyb3InIH1cbiAgICogXG4gICAqIGBgYFxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9sb2dnaW5nKS5cbiAgICovXG4gIGxvZz86IChMb2dMZXZlbCB8IExvZ0RlZmluaXRpb24pW11cbiAgLyoqXG4gICAqIFRoZSBkZWZhdWx0IHZhbHVlcyBmb3IgdHJhbnNhY3Rpb25PcHRpb25zXG4gICAqIG1heFdhaXQgPz0gMjAwMFxuICAgKiB0aW1lb3V0ID89IDUwMDBcbiAgICovXG4gIHRyYW5zYWN0aW9uT3B0aW9ucz86IHtcbiAgICBtYXhXYWl0PzogbnVtYmVyXG4gICAgdGltZW91dD86IG51bWJlclxuICAgIGlzb2xhdGlvbkxldmVsPzogVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbFxuICB9XG4gIC8qKlxuICAgKiBHbG9iYWwgY29uZmlndXJhdGlvbiBmb3Igb21pdHRpbmcgbW9kZWwgZmllbGRzIGJ5IGRlZmF1bHQuXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgb21pdDoge1xuICAgKiAgICAgdXNlcjoge1xuICAgKiAgICAgICBwYXNzd29yZDogdHJ1ZVxuICAgKiAgICAgfVxuICAgKiAgIH1cbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBvbWl0PzogR2xvYmFsT21pdENvbmZpZ1xuICAvKipcbiAgICogU1FMIGNvbW1lbnRlciBwbHVnaW5zIHRoYXQgYWRkIG1ldGFkYXRhIHRvIFNRTCBxdWVyaWVzIGFzIGNvbW1lbnRzLlxuICAgKiBDb21tZW50cyBmb2xsb3cgdGhlIHNxbGNvbW1lbnRlciBmb3JtYXQ6IGh0dHBzOi8vZ29vZ2xlLmdpdGh1Yi5pby9zcWxjb21tZW50ZXIvXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcixcbiAgICogICBjb21tZW50czogW1xuICAgKiAgICAgdHJhY2VDb250ZXh0KCksXG4gICAqICAgICBxdWVyeUluc2lnaHRzKCksXG4gICAqICAgXSxcbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBjb21tZW50cz86IHJ1bnRpbWUuU3FsQ29tbWVudGVyUGx1Z2luW11cbiAgLyoqXG4gICAqIE9wdGlvbmFsIG1heGltdW0gc2l6ZSBmb3IgdGhlIHF1ZXJ5IHBsYW4gY2FjaGUuIElmIG5vdCBwcm92aWRlZCwgYSBkZWZhdWx0IHNpemUgd2lsbCBiZSB1c2VkLlxuICAgKiBBIHZhbHVlIG9mIGAwYCBjYW4gYmUgdXNlZCB0byBkaXNhYmxlIHRoZSBjYWNoZSBlbnRpcmVseS4gQSBoaWdoZXIgY2FjaGUgc2l6ZSBjYW4gaW1wcm92ZVxuICAgKiBwZXJmb3JtYW5jZSBmb3IgYXBwbGljYXRpb25zIHRoYXQgZXhlY3V0ZSBhIGxhcmdlIG51bWJlciBvZiB1bmlxdWUgcXVlcmllcywgd2hpbGUgYSBzbWFsbGVyXG4gICAqIGNhY2hlIHNpemUgY2FuIHJlZHVjZSBtZW1vcnkgdXNhZ2UuXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcixcbiAgICogICBxdWVyeVBsYW5DYWNoZU1heFNpemU6IDEwMCxcbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBxdWVyeVBsYW5DYWNoZU1heFNpemU/OiBudW1iZXJcbn1cblxuLyoqXG4gKiBgUHJpc21hQ2xpZW50YCBvcHRpb25zIGZvciBjb25uZWN0aW5nIHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSBpbnN0ZWFkIG9mIGEgZHJpdmVyIGFkYXB0ZXIuXG4gKiBcbiAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2FjY2VsZXJhdGVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmwgZXh0ZW5kcyBQcmlzbWFDbGllbnRCYXNlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgUHJpc21hIEFjY2VsZXJhdGUgY29ubmVjdGlvbiBVUkwuIFVzZSB0aGlzIG9wdGlvbiB0byBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSBpbnN0ZWFkIG9mIHVzaW5nIGEgZHJpdmVyIGFkYXB0ZXIgdG8gY29ubmVjdCBkaXJlY3RseS5cbiAgICogXG4gICAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2FjY2VsZXJhdGVcbiAgICovXG4gIGFjY2VsZXJhdGVVcmw6IHN0cmluZ1xuICBhZGFwdGVyPzogbmV2ZXJcbn1cblxuLyoqXG4gKiBgUHJpc21hQ2xpZW50YCBvcHRpb25zIGZvciBjb25uZWN0aW5nIHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBhIGRyaXZlciBhZGFwdGVyLiBUaGlzIGlzIHRoZSBjb21tb24gY2FzZSBpbiBQcmlzbWEgNy5cbiAqIFxuICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyIGV4dGVuZHMgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogQSBkcml2ZXIgYWRhcHRlciB0aGF0IFByaXNtYUNsaWVudCB1c2VzIHRvIGNvbm5lY3QgdG8geW91ciBkYXRhYmFzZSwgc3VjaCBhcyB0aGUgb25lcyBwcm92aWRlZCBieSBgQHByaXNtYS9hZGFwdGVyLXBnYCwgYEBwcmlzbWEvYWRhcHRlci1saWJzcWxgLCBgQHByaXNtYS9hZGFwdGVyLXBsYW5ldHNjYWxlYCwgZXRjLlxuICAgKiBcbiAgICogQSBkcml2ZXIgYWRhcHRlciBpcyAqKnJlcXVpcmVkKiogdW5sZXNzIHlvdSBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSAoaW4gd2hpY2ggY2FzZSB1c2UgYGFjY2VsZXJhdGVVcmxgIGluc3RlYWQpLlxuICAgKiBcbiAgICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBQcmlzbWFQZyB9IGZyb20gJ0BwcmlzbWEvYWRhcHRlci1wZydcbiAgICogaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSAnLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudCdcbiAgICogXG4gICAqIGNvbnN0IGFkYXB0ZXIgPSBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7IGFkYXB0ZXIgfSlcbiAgICogYGBgXG4gICAqL1xuICBhZGFwdGVyOiBydW50aW1lLlNxbERyaXZlckFkYXB0ZXJGYWN0b3J5XG4gIGFjY2VsZXJhdGVVcmw/OiBuZXZlclxufVxuXG4vKipcbiAqIE9wdGlvbnMgcGFzc2VkIHRvIHRoZSBgUHJpc21hQ2xpZW50YCBjb25zdHJ1Y3Rvci5cbiAqIFxuICogQSBkcml2ZXIgYWRhcHRlciAob3IsIGFsdGVybmF0aXZlbHksIGEgUHJpc21hIEFjY2VsZXJhdGUgVVJMKSBpcyAqKnJlcXVpcmVkKiouIFNlZSB7QGxpbmsgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyfSBhbmQge0BsaW5rIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWNjZWxlcmF0ZVVybH0gZm9yIHRoZSB0d28gdmFyaWFudHMuIEFsbCBvdGhlciBwcm9wZXJ0aWVzIGxpdmUgaW4ge0BsaW5rIFByaXNtYUNsaWVudEJhc2VPcHRpb25zfSBhbmQgYXJlIG9wdGlvbmFsLlxuICogXG4gKiBMZWFybiBtb3JlIGFib3V0IGRyaXZlciBhZGFwdGVyczogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gKi9cbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudE9wdGlvbnMgPSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmwgfCBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFkYXB0ZXJcbmV4cG9ydCB0eXBlIEdsb2JhbE9taXRDb25maWcgPSB7XG4gIGJsb2dDb21tZW50PzogUHJpc21hLkJsb2dDb21tZW50T21pdFxuICBibG9nUG9zdD86IFByaXNtYS5CbG9nUG9zdE9taXRcbiAgYm9va2luZz86IFByaXNtYS5Cb29raW5nT21pdFxuICBjYXRlZ29yeT86IFByaXNtYS5DYXRlZ29yeU9taXRcbiAgY29udGFjdE1lc3NhZ2U/OiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VPbWl0XG4gIG5vdGlmaWNhdGlvbj86IFByaXNtYS5Ob3RpZmljYXRpb25PbWl0XG4gIHBheW1lbnQ/OiBQcmlzbWEuUGF5bWVudE9taXRcbiAgcmVmcmVzaFRva2VuPzogUHJpc21hLlJlZnJlc2hUb2tlbk9taXRcbiAgcmV2aWV3PzogUHJpc21hLlJldmlld09taXRcbiAgdG91clBhY2thZ2U/OiBQcmlzbWEuVG91clBhY2thZ2VPbWl0XG4gIHVzZXI/OiBQcmlzbWEuVXNlck9taXRcbiAgd2lzaGxpc3RJdGVtPzogUHJpc21hLldpc2hsaXN0SXRlbU9taXRcbn1cblxuLyogVHlwZXMgZm9yIExvZ2dpbmcgKi9cbmV4cG9ydCB0eXBlIExvZ0xldmVsID0gJ2luZm8nIHwgJ3F1ZXJ5JyB8ICd3YXJuJyB8ICdlcnJvcidcbmV4cG9ydCB0eXBlIExvZ0RlZmluaXRpb24gPSB7XG4gIGxldmVsOiBMb2dMZXZlbFxuICBlbWl0OiAnc3Rkb3V0JyB8ICdldmVudCdcbn1cblxuZXhwb3J0IHR5cGUgQ2hlY2tJc0xvZ0xldmVsPFQ+ID0gVCBleHRlbmRzIExvZ0xldmVsID8gVCA6IG5ldmVyO1xuXG5leHBvcnQgdHlwZSBHZXRMb2dUeXBlPFQ+ID0gQ2hlY2tJc0xvZ0xldmVsPFxuICBUIGV4dGVuZHMgTG9nRGVmaW5pdGlvbiA/IFRbJ2xldmVsJ10gOiBUXG4+O1xuXG5leHBvcnQgdHlwZSBHZXRFdmVudHM8VCBleHRlbmRzIGFueVtdPiA9IFQgZXh0ZW5kcyBBcnJheTxMb2dMZXZlbCB8IExvZ0RlZmluaXRpb24+XG4gID8gR2V0TG9nVHlwZTxUW251bWJlcl0+XG4gIDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5RXZlbnQgPSB7XG4gIHRpbWVzdGFtcDogRGF0ZVxuICBxdWVyeTogc3RyaW5nXG4gIHBhcmFtczogc3RyaW5nXG4gIGR1cmF0aW9uOiBudW1iZXJcbiAgdGFyZ2V0OiBzdHJpbmdcbn1cblxuZXhwb3J0IHR5cGUgTG9nRXZlbnQgPSB7XG4gIHRpbWVzdGFtcDogRGF0ZVxuICBtZXNzYWdlOiBzdHJpbmdcbiAgdGFyZ2V0OiBzdHJpbmdcbn1cbi8qIEVuZCBUeXBlcyBmb3IgTG9nZ2luZyAqL1xuXG5cbmV4cG9ydCB0eXBlIFByaXNtYUFjdGlvbiA9XG4gIHwgJ2ZpbmRVbmlxdWUnXG4gIHwgJ2ZpbmRVbmlxdWVPclRocm93J1xuICB8ICdmaW5kTWFueSdcbiAgfCAnZmluZEZpcnN0J1xuICB8ICdmaW5kRmlyc3RPclRocm93J1xuICB8ICdjcmVhdGUnXG4gIHwgJ2NyZWF0ZU1hbnknXG4gIHwgJ2NyZWF0ZU1hbnlBbmRSZXR1cm4nXG4gIHwgJ3VwZGF0ZSdcbiAgfCAndXBkYXRlTWFueSdcbiAgfCAndXBkYXRlTWFueUFuZFJldHVybidcbiAgfCAndXBzZXJ0J1xuICB8ICdkZWxldGUnXG4gIHwgJ2RlbGV0ZU1hbnknXG4gIHwgJ2V4ZWN1dGVSYXcnXG4gIHwgJ3F1ZXJ5UmF3J1xuICB8ICdhZ2dyZWdhdGUnXG4gIHwgJ2NvdW50J1xuICB8ICdydW5Db21tYW5kUmF3J1xuICB8ICdmaW5kUmF3J1xuICB8ICdncm91cEJ5J1xuXG4vKipcbiAqIGBQcmlzbWFDbGllbnRgIHByb3h5IGF2YWlsYWJsZSBpbiBpbnRlcmFjdGl2ZSB0cmFuc2FjdGlvbnMuXG4gKi9cbmV4cG9ydCB0eXBlIFRyYW5zYWN0aW9uQ2xpZW50ID0gT21pdDxEZWZhdWx0UHJpc21hQ2xpZW50LCBydW50aW1lLklUWENsaWVudERlbnlMaXN0PlxuXG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4qIFRoaXMgZmlsZSBleHBvcnRzIGFsbCBlbnVtIHJlbGF0ZWQgdHlwZXMgZnJvbSB0aGUgc2NoZW1hLlxuKlxuKiBcdUQ4M0RcdURGRTIgWW91IGNhbiBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5LlxuKi9cblxuZXhwb3J0IGNvbnN0IFJvbGUgPSB7XG4gIFVTRVI6ICdVU0VSJyxcbiAgQUdFTlQ6ICdBR0VOVCcsXG4gIEFETUlOOiAnQURNSU4nXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFJvbGUgPSAodHlwZW9mIFJvbGUpW2tleW9mIHR5cGVvZiBSb2xlXVxuXG5cbmV4cG9ydCBjb25zdCBVc2VyU3RhdHVzID0ge1xuICBBQ1RJVkU6ICdBQ1RJVkUnLFxuICBTVVNQRU5ERUQ6ICdTVVNQRU5ERUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFVzZXJTdGF0dXMgPSAodHlwZW9mIFVzZXJTdGF0dXMpW2tleW9mIHR5cGVvZiBVc2VyU3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBBdXRoUHJvdmlkZXIgPSB7XG4gIENSRURFTlRJQUw6ICdDUkVERU5USUFMJyxcbiAgR09PR0xFOiAnR09PR0xFJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBBdXRoUHJvdmlkZXIgPSAodHlwZW9mIEF1dGhQcm92aWRlcilba2V5b2YgdHlwZW9mIEF1dGhQcm92aWRlcl1cblxuXG5leHBvcnQgY29uc3QgUGFja2FnZVN0YXR1cyA9IHtcbiAgUEVORElORzogJ1BFTkRJTkcnLFxuICBBUFBST1ZFRDogJ0FQUFJPVkVEJyxcbiAgUkVKRUNURUQ6ICdSRUpFQ1RFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGFja2FnZVN0YXR1cyA9ICh0eXBlb2YgUGFja2FnZVN0YXR1cylba2V5b2YgdHlwZW9mIFBhY2thZ2VTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IEJvb2tpbmdTdGF0dXMgPSB7XG4gIFBFTkRJTkc6ICdQRU5ESU5HJyxcbiAgUEFJRDogJ1BBSUQnLFxuICBDT05GSVJNRUQ6ICdDT05GSVJNRUQnLFxuICBDQU5DRUxMRUQ6ICdDQU5DRUxMRUQnLFxuICBDT01QTEVURUQ6ICdDT01QTEVURUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJvb2tpbmdTdGF0dXMgPSAodHlwZW9mIEJvb2tpbmdTdGF0dXMpW2tleW9mIHR5cGVvZiBCb29raW5nU3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBQYXltZW50U3RhdHVzID0ge1xuICBJTklUSUFURUQ6ICdJTklUSUFURUQnLFxuICBTVUNDRVNTOiAnU1VDQ0VTUycsXG4gIEZBSUxFRDogJ0ZBSUxFRCcsXG4gIENBTkNFTExFRDogJ0NBTkNFTExFRCcsXG4gIFJFRlVOREVEOiAnUkVGVU5ERUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBheW1lbnRTdGF0dXMgPSAodHlwZW9mIFBheW1lbnRTdGF0dXMpW2tleW9mIHR5cGVvZiBQYXltZW50U3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBQb3N0U3RhdHVzID0ge1xuICBEUkFGVDogJ0RSQUZUJyxcbiAgUFVCTElTSEVEOiAnUFVCTElTSEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQb3N0U3RhdHVzID0gKHR5cGVvZiBQb3N0U3RhdHVzKVtrZXlvZiB0eXBlb2YgUG9zdFN0YXR1c11cblxuXG5leHBvcnQgY29uc3QgTm90aWZpY2F0aW9uVHlwZSA9IHtcbiAgQk9PS0lOR19DUkVBVEVEOiAnQk9PS0lOR19DUkVBVEVEJyxcbiAgQk9PS0lOR19DT05GSVJNRUQ6ICdCT09LSU5HX0NPTkZJUk1FRCcsXG4gIEJPT0tJTkdfQ0FOQ0VMTEVEOiAnQk9PS0lOR19DQU5DRUxMRUQnLFxuICBQQUNLQUdFX0FQUFJPVkVEOiAnUEFDS0FHRV9BUFBST1ZFRCcsXG4gIFBBQ0tBR0VfUkVKRUNURUQ6ICdQQUNLQUdFX1JFSkVDVEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBOb3RpZmljYXRpb25UeXBlID0gKHR5cGVvZiBOb3RpZmljYXRpb25UeXBlKVtrZXlvZiB0eXBlb2YgTm90aWZpY2F0aW9uVHlwZV1cbiIsICIvLyBBcHBFcnJvciBrZWVwcyB0aGUgZXhhY3Qgc2FtZSBcImp1c3QgdGhyb3cgaXRcIiBlcmdvbm9taWNzIGJ1dCBjYXJyaWVzXG4vLyBhIHN0YXR1c0NvZGUgdGhlIGdsb2JhbCBoYW5kbGVyIGNhbiByZWFkIChzZWUgbWlkZGxld2FyZS9nbG9iYWxFcnJvckhhbmRsZXIudHMpLlxuZXhwb3J0IGNsYXNzIEFwcEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBzdGF0dXNDb2RlOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3Ioc3RhdHVzQ29kZTogbnVtYmVyLCBtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSBcIkFwcEVycm9yXCI7XG4gICAgdGhpcy5zdGF0dXNDb2RlID0gc3RhdHVzQ29kZTtcbiAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IFByaXNtYVBnIH0gZnJvbSBcIkBwcmlzbWEvYWRhcHRlci1wZ1wiO1xuaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuY29uc3QgY29ubmVjdGlvblN0cmluZyA9IGNvbmZpZy5kYXRhYmFzZV91cmw7XG5cbi8vIFNlcnZlcmxlc3MtZnJpZW5kbHkgcG9vbDogb25lIGNvbm5lY3Rpb24gcGVyIHdhcm0gaW5zdGFuY2Ugc28gbWFueVxuLy8gY29uY3VycmVudCBpbnZvY2F0aW9ucyBjYW4ndCBleGhhdXN0IHRoZSBkYXRhYmFzZSdzIGNvbm5lY3Rpb24gbGltaXQuXG4vLyBMb2NhbC9WTSBydW5zIGFyZSB1bmFmZmVjdGVkIChhIHNpbmdsZSBwcm9jZXNzIHVzZXMgb25lIGNvbm5lY3Rpb24gYW55d2F5KS5cbmNvbnN0IGFkYXB0ZXIgPSBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nLCBtYXg6IDEgfSk7XG5jb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHsgYWRhcHRlciB9KTtcblxuZXhwb3J0IHsgcHJpc21hIH07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IGF1dGhDb250cm9sbGVyIH0gZnJvbSBcIi4vYXV0aC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBhdXRoVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9hdXRoLnZhbGlkYXRpb25cIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBSZWdpc3RlciBcdTIwMTQgcm9sZSBpcyBvcHRpb25hbCBhbmQgcmVzdHJpY3RlZCB0byBVU0VSL0FHRU5UIGluIHRoZSBzZXJ2aWNlXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVnaXN0ZXJcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLnJlZ2lzdGVyU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZWdpc3RlclVzZXIsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvbG9naW5cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmxvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5sb2dpblVzZXIsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZ29vZ2xlXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5nb29nbGVMb2dpblNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIuZ29vZ2xlTG9naW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZGVtby1sb2dpblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMuZGVtb0xvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5kZW1vTG9naW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVmcmVzaFwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVmcmVzaFRva2VuU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZWZyZXNoVG9rZW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcIi9sb2dvdXRcIiwgYXV0aCgpLCBhdXRoQ29udHJvbGxlci5sb2dvdXRVc2VyKTtcblxucm91dGVyLmdldChcIi9tZVwiLCBhdXRoKCksIGF1dGhDb250cm9sbGVyLmdldE1lKTtcblxuLy8gU3RlcCAyMSBcdTIwMTQgZW1haWwgdmVyaWZpY2F0aW9uICsgcGFzc3dvcmQgcmVzZXQgKGFsbCBwdWJsaWM7IHJhdGUtbGltaXRlZCB2aWFcbi8vIGF1dGhMaW1pdGVyIGluIGFwcC50cyB0byBib3VuZCBPVFAgYnJ1dGUgZm9yY2UgKyBlbWFpbCBib21iaW5nKVxucm91dGVyLnBvc3QoXG4gIFwiL3ZlcmlmeS1lbWFpbFwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMudmVyaWZ5RW1haWxTY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnZlcmlmeUVtYWlsLFxuKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL3Jlc2VuZC12ZXJpZmljYXRpb25cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLnJlc2VuZFZlcmlmaWNhdGlvblNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIucmVzZW5kVmVyaWZpY2F0aW9uLFxuKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL2ZvcmdvdC1wYXNzd29yZFwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMuZm9yZ290UGFzc3dvcmRTY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmZvcmdvdFBhc3N3b3JkLFxuKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL3Jlc2V0LXBhc3N3b3JkXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5yZXNldFBhc3N3b3JkU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZXNldFBhc3N3b3JkLFxuKTtcblxuZXhwb3J0IGNvbnN0IGF1dGhSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBhdXRoU2VydmljZSB9IGZyb20gXCIuL2F1dGguc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbmNvbnN0IGlzUHJvZHVjdGlvbiA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcInByb2R1Y3Rpb25cIjtcblxuLy8gRGV2IChsb2NhbGhvc3Q6MzAwMCBcdTIxOTIgOjQwMDApIGlzIHNhbWUtc2l0ZSBcdTIxOTIgbGF4IHdvcmtzIHdpdGggc2VjdXJlOmZhbHNlLlxuLy8gUHJvZCAoY3Jvc3Mtc2l0ZSBmcm9udGVuZC9iYWNrZW5kKSByZXF1aXJlcyBTYW1lU2l0ZT1Ob25lICsgU2VjdXJlLlxuY29uc3QgY29va2llT3B0aW9uczoge1xuICBodHRwT25seTogdHJ1ZTtcbiAgc2VjdXJlOiBib29sZWFuO1xuICBzYW1lU2l0ZTogXCJsYXhcIiB8IFwibm9uZVwiO1xufSA9IHtcbiAgaHR0cE9ubHk6IHRydWUsXG4gIHNlY3VyZTogaXNQcm9kdWN0aW9uLFxuICBzYW1lU2l0ZTogaXNQcm9kdWN0aW9uID8gXCJub25lXCIgOiBcImxheFwiLFxufTtcblxuY29uc3QgQUNDRVNTX0NPT0tJRV9NQVhfQUdFID0gMjQgKiA2MCAqIDYwICogMTAwMDsgLy8gMSBkYXlcbmNvbnN0IFJFRlJFU0hfQ09PS0lFX01BWF9BR0UgPSAzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDA7IC8vIDMwIGRheXNcblxuY29uc3Qgc2V0QXV0aENvb2tpZXMgPSAoXG4gIHJlczogUmVzcG9uc2UsXG4gIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9OiB7IGFjY2Vzc1Rva2VuOiBzdHJpbmc7IHJlZnJlc2hUb2tlbjogc3RyaW5nIH0sXG4pID0+IHtcbiAgcmVzLmNvb2tpZShcImFjY2Vzc1Rva2VuXCIsIGFjY2Vzc1Rva2VuLCB7XG4gICAgLi4uY29va2llT3B0aW9ucyxcbiAgICBtYXhBZ2U6IEFDQ0VTU19DT09LSUVfTUFYX0FHRSxcbiAgfSk7XG4gIHJlcy5jb29raWUoXCJyZWZyZXNoVG9rZW5cIiwgcmVmcmVzaFRva2VuLCB7XG4gICAgLi4uY29va2llT3B0aW9ucyxcbiAgICBtYXhBZ2U6IFJFRlJFU0hfQ09PS0lFX01BWF9BR0UsXG4gIH0pO1xufTtcblxuY29uc3QgY2xlYXJBdXRoQ29va2llcyA9IChyZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHJlcy5jbGVhckNvb2tpZShcImFjY2Vzc1Rva2VuXCIsIGNvb2tpZU9wdGlvbnMpO1xuICByZXMuY2xlYXJDb29raWUoXCJyZWZyZXNoVG9rZW5cIiwgY29va2llT3B0aW9ucyk7XG59O1xuXG4vLyBSZWdpc3RlciBjb250cm9sbGVyIFx1MjAxNCBzdGFnZXMgdGhlIGFjY291bnQgaW4gUmVkaXMgYW5kIGVtYWlscyBhbiBPVFA7IHRoZVxuLy8gdXNlciByb3cgaXMgY3JlYXRlZCBieSB2ZXJpZnktZW1haWwuXG5jb25zdCByZWdpc3RlclVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBhd2FpdCBhdXRoU2VydmljZS5yZWdpc3RlclVzZXIocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiVmVyaWZpY2F0aW9uIE9UUCBzZW50IHRvIHlvdXIgZW1haWwuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gTG9naW4gY29udHJvbGxlclxuY29uc3QgbG9naW5Vc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0gPSBhd2FpdCBhdXRoU2VydmljZS5sb2dpblVzZXIocmVxLmJvZHkpO1xuXG4gICAgc2V0QXV0aENvb2tpZXMocmVzLCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdvb2dsZSBsb2dpbiAoSUQtdG9rZW4gZmxvdylcbmNvbnN0IGdvb2dsZUxvZ2luID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0gPSBhd2FpdCBhdXRoU2VydmljZS5nb29nbGVMb2dpbihcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gRGVtbyBsb2dpbiBjb250cm9sbGVyXG5jb25zdCBkZW1vTG9naW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmRlbW9Mb2dpbihcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEZW1vIHVzZXIgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBWZXJpZnkgZW1haWwgY29udHJvbGxlciBcdTIwMTQgY3JlYXRlcyB0aGUgdXNlciBhbmQgYXV0by1sb2dzLWluICh0b2tlbnMgYXNcbi8vIGNvb2tpZXMgKyBib2R5KSwgbWlycm9yaW5nIHRoZSByZWZlcmVuY2UgYmFja2VuZC5cbmNvbnN0IHZlcmlmeUVtYWlsID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0gPSBhd2FpdCBhdXRoU2VydmljZS52ZXJpZnlFbWFpbChcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJFbWFpbCB2ZXJpZmllZCBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gUmVzZW5kIHZlcmlmaWNhdGlvbiBjb250cm9sbGVyIFx1MjAxNCBhbHdheXMgMjAwIChubyBlbnVtZXJhdGlvbikuXG5jb25zdCByZXNlbmRWZXJpZmljYXRpb24gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBhd2FpdCBhdXRoU2VydmljZS5yZXNlbmRWZXJpZmljYXRpb24ocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlZlcmlmaWNhdGlvbiBPVFAgc2VudCB0byB5b3VyIGVtYWlsLlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEZvcmdvdCBwYXNzd29yZCBjb250cm9sbGVyIFx1MjAxNCBhbHdheXMgMjAwIChubyBlbnVtZXJhdGlvbikuXG5jb25zdCBmb3Jnb3RQYXNzd29yZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLmZvcmdvdFBhc3N3b3JkKHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTpcbiAgICAgICAgXCJJZiBhbiBhY2NvdW50IHdpdGggdGhhdCBlbWFpbCBleGlzdHMsIGEgcGFzc3dvcmQgcmVzZXQgT1RQIGhhcyBiZWVuIHNlbnQuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gUmVzZXQgcGFzc3dvcmQgY29udHJvbGxlclxuY29uc3QgcmVzZXRQYXNzd29yZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLnJlc2V0UGFzc3dvcmQocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhc3N3b3JkIHJlc2V0IHN1Y2Nlc3NmdWxseS4gUGxlYXNlIGxvZ2luIGFnYWluLlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFJlZnJlc2ggdG9rZW4gY29udHJvbGxlclxuY29uc3QgcmVmcmVzaFRva2VuID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVmcmVzaFRva2VuRnJvbUNvb2tpZSA9IHJlcS5jb29raWVzLnJlZnJlc2hUb2tlbjtcbiAgICBjb25zdCByZWZyZXNoVG9rZW5Gcm9tQm9keSA9IHJlcS5ib2R5Py5yZWZyZXNoVG9rZW47XG5cbiAgICBpZiAoIXJlZnJlc2hUb2tlbkZyb21Db29raWUgJiYgIXJlZnJlc2hUb2tlbkZyb21Cb2R5KSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5VTkFVVEhPUklaRUQsXG4gICAgICAgIG1lc3NhZ2U6IFwiUmVmcmVzaCB0b2tlbiBpcyByZXF1aXJlZFwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4gfSA9XG4gICAgICBhd2FpdCBhdXRoU2VydmljZS5yZWZyZXNoVG9rZW4oe1xuICAgICAgICByZWZyZXNoVG9rZW46IHJlZnJlc2hUb2tlbkZyb21Db29raWUgfHwgcmVmcmVzaFRva2VuRnJvbUJvZHksXG4gICAgICB9KTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywge1xuICAgICAgYWNjZXNzVG9rZW4sXG4gICAgICByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbixcbiAgICB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJUb2tlbiByZWZyZXNoZWQgc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbiB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gTG9nb3V0IGNvbnRyb2xsZXJcbmNvbnN0IGxvZ291dFVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgYXdhaXQgYXV0aFNlcnZpY2UubG9nb3V0KHVzZXJJZCk7XG4gICAgY2xlYXJBdXRoQ29va2llcyhyZXMpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgbG9nZ2VkIG91dCBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgTWUgY29udHJvbGxlclxuY29uc3QgZ2V0TWUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IGF1dGhTZXJ2aWNlLmdldE1lRnJvbURCKHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYXV0aENvbnRyb2xsZXIgPSB7XG4gIHJlZ2lzdGVyVXNlcixcbiAgdmVyaWZ5RW1haWwsXG4gIHJlc2VuZFZlcmlmaWNhdGlvbixcbiAgZm9yZ290UGFzc3dvcmQsXG4gIHJlc2V0UGFzc3dvcmQsXG4gIGxvZ2luVXNlcixcbiAgZ29vZ2xlTG9naW4sXG4gIGRlbW9Mb2dpbixcbiAgcmVmcmVzaFRva2VuLFxuICBsb2dvdXRVc2VyLFxuICBnZXRNZSxcbn07IiwgImltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5pbXBvcnQgY3J5cHRvIGZyb20gXCJjcnlwdG9cIjtcbmltcG9ydCB7IGRlY29kZSwgSnd0UGF5bG9hZCwgU2lnbk9wdGlvbnMgfSBmcm9tIFwianNvbndlYnRva2VuXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBnb29nbGVDbGllbnQgfSBmcm9tIFwiLi4vLi4vbGliL2dvb2dsZUF1dGhcIjtcbmltcG9ydCB7IGdldFJlZGlzIH0gZnJvbSBcIi4uLy4uL2xpYi9yZWRpc1wiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IGp3dFV0aWxzIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2p3dFwiO1xuaW1wb3J0IHtcbiAgc2VuZEZvcmdvdFBhc3N3b3JkT3RwRW1haWwsXG4gIHNlbmRQYXNzd29yZFJlc2V0U3VjY2Vzc0VtYWlsLFxuICBzZW5kVmVyaWZpY2F0aW9uT3RwRW1haWwsXG4gIHNlbmRXZWxjb21lRW1haWwsXG59IGZyb20gXCIuLi8uLi91dGlscy9hdXRoRW1haWxcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQge1xuICBJQXV0aCxcbiAgSURlbW9Mb2dpblBheWxvYWQsXG4gIElGb3Jnb3RQYXNzd29yZFBheWxvYWQsXG4gIElHb29nbGVMb2dpblBheWxvYWQsXG4gIElMb2dpblVzZXIsXG4gIElSZWZyZXNoVG9rZW5QYXlsb2FkLFxuICBJUmVzZW5kVmVyaWZpY2F0aW9uUGF5bG9hZCxcbiAgSVJlc2V0UGFzc3dvcmRQYXlsb2FkLFxuICBJVmVyaWZ5RW1haWxQYXlsb2FkLFxufSBmcm9tIFwiLi9hdXRoLmludGVyZmFjZVwiO1xuXG5jb25zdCBPVFBfRVhQSVJBVElPTl9TRUNPTkRTID0gNSAqIDYwOyAvLyA1IG1pbnV0ZXMgXHUyMDE0IG1hdGNoZXMgdGhlIHJlZmVyZW5jZSBiYWNrZW5kXG5cbi8vIFNIQS0yNTYgb2YgYSByZWZyZXNoIEpXVCBcdTIwMTQgdGhlIHJvdGF0aW9uIGxlZGdlciBzdG9yZXMgb25seSB0aGlzIGhhc2gsIG5ldmVyXG4vLyB0aGUgdG9rZW4gaXRzZWxmLCBzbyBhIERCIGxlYWsgY2FuJ3QgbWludCB1c2FibGUgcmVmcmVzaCB0b2tlbnMuXG5jb25zdCBzaGEyNTYgPSAodmFsdWU6IHN0cmluZykgPT5cbiAgY3J5cHRvLmNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKHZhbHVlKS5kaWdlc3QoXCJoZXhcIik7XG5cbi8vIFJlZnJlc2gtdG9rZW4gZXhwaXJ5IHJlYWQgZnJvbSB0aGUgc2lnbmVkIHRva2VuJ3MgYGV4cGAgc28gdGhlIGxlZGdlciByb3dcbi8vIGFsd2F5cyBtYXRjaGVzIEpXVF9SRUZSRVNIX0VYUElSRVNfSU4gZXhhY3RseS5cbmNvbnN0IHJlZnJlc2hUb2tlbkV4cGlyZXNBdCA9ICh0b2tlbjogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHBheWxvYWQgPSBkZWNvZGUodG9rZW4pIGFzIEp3dFBheWxvYWQgfCBudWxsO1xuICByZXR1cm4gcGF5bG9hZD8uZXhwID8gbmV3IERhdGUocGF5bG9hZC5leHAgKiAxMDAwKSA6IG5ldyBEYXRlKCk7XG59O1xuXG4vLyBSZWRpcyBPVFAgc3RvcmUgYWNjZXNzb3IgXHUyMDE0IDUwMyB3aGVuIHVuY29uZmlndXJlZCAobmV2ZXIgYSBib290LXRpbWUgY3Jhc2gpLlxuY29uc3QgZ2V0UmVkaXNDbGllbnQgPSBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IGdldFJlZGlzKCk7XG4gIGlmICghY2xpZW50KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMywgXCJFbWFpbCB2ZXJpZmljYXRpb24gaXMgbm90IGNvbmZpZ3VyZWQuXCIpO1xuICB9XG4gIHJldHVybiBjbGllbnQ7XG59O1xuXG5jb25zdCBidWlsZFRva2VuUGF5bG9hZCA9ICh1c2VyOiB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgcm9sZTogUm9sZTtcbiAgdG9rZW5WZXJzaW9uOiBudW1iZXI7XG59KSA9PiAoe1xuICBpZDogdXNlci5pZCxcbiAgbmFtZTogdXNlci5uYW1lLFxuICBlbWFpbDogdXNlci5lbWFpbCxcbiAgcm9sZTogdXNlci5yb2xlLFxuICB0b2tlblZlcnNpb246IHVzZXIudG9rZW5WZXJzaW9uLFxufSk7XG5cbmNvbnN0IGlzc3VlVG9rZW5zID0gYXN5bmMgKFxuICB1c2VyOiB7XG4gICAgaWQ6IHN0cmluZztcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgZW1haWw6IHN0cmluZztcbiAgICByb2xlOiBSb2xlO1xuICAgIHRva2VuVmVyc2lvbjogbnVtYmVyO1xuICB9LFxuICBjbGllbnQ6IFByaXNtYS5UcmFuc2FjdGlvbkNsaWVudCB8IHR5cGVvZiBwcmlzbWEgPSBwcmlzbWEsXG4pID0+IHtcbiAgY29uc3QgdG9rZW5QYXlsb2FkID0gYnVpbGRUb2tlblBheWxvYWQodXNlcik7XG5cbiAgY29uc3QgYWNjZXNzVG9rZW4gPSBqd3RVdGlscy5jcmVhdGVUb2tlbihcbiAgICB0b2tlblBheWxvYWQsXG4gICAgY29uZmlnLmp3dF9hY2Nlc3Nfc2VjcmV0LFxuICAgIHsgZXhwaXJlc0luOiBjb25maWcuand0X2FjY2Vzc19leHBpcmVzX2luIH0gYXMgU2lnbk9wdGlvbnMsXG4gICk7XG4gIGNvbnN0IHJlZnJlc2hUb2tlbiA9IGp3dFV0aWxzLmNyZWF0ZVRva2VuKFxuICAgIHRva2VuUGF5bG9hZCxcbiAgICBjb25maWcuand0X3JlZnJlc2hfc2VjcmV0LFxuICAgIHsgZXhwaXJlc0luOiBjb25maWcuand0X3JlZnJlc2hfZXhwaXJlc19pbiB9IGFzIFNpZ25PcHRpb25zLFxuICApO1xuXG4gIC8vIFJvdGF0aW9uIGxlZGdlciBcdTIwMTQgcGVyc2lzdCBhIHJvdyBrZXllZCBieSB0aGUgcmVmcmVzaCB0b2tlbidzIGhhc2guIFRoZVxuICAvLyBKV1QgaXRzZWxmIHN0YXlzIGluIHRoZSByZXNwb25zZSBleGFjdGx5IGFzIGJlZm9yZS5cbiAgYXdhaXQgY2xpZW50LnJlZnJlc2hUb2tlbi5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIHVzZXJJZDogdXNlci5pZCxcbiAgICAgIGhhc2g6IHNoYTI1NihyZWZyZXNoVG9rZW4pLFxuICAgICAgZXhwaXJlc0F0OiByZWZyZXNoVG9rZW5FeHBpcmVzQXQocmVmcmVzaFRva2VuKSxcbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4geyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH07XG59O1xuXG5jb25zdCBzYW5pdGl6ZVVzZXIgPSA8VCBleHRlbmRzIHsgcGFzc3dvcmQ6IHN0cmluZyB8IG51bGwgfT4odXNlcjogVCkgPT4ge1xuICBjb25zdCB7IHBhc3N3b3JkLCAuLi5yZXN0IH0gPSB1c2VyO1xuICByZXR1cm4gcmVzdDtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZWdpc3RlciAoc3RhZ2VkIGluIFJlZGlzLCB2ZXJpZmllZCB2aWEgT1RQKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIEZvbGxvd3MgdGhlIHJlZmVyZW5jZSBiYWNrZW5kOiBhIGNyZWRlbnRpYWwgc2lnbnVwIGRvZXMgTk9UIGNyZWF0ZSBhIERCIHJvdy5cbi8vIEl0IGhhc2hlcyB0aGUgcGFzc3dvcmQsIHN0YWdlcyB0aGUgcGF5bG9hZCBpbiBSZWRpcywgZW1haWxzIGEgNi1kaWdpdCBPVFAsXG4vLyBhbmQgdGhlIHVzZXIgcm93IGlzIG9ubHkgY3JlYXRlZCBvbiBzdWNjZXNzZnVsIHZlcmlmaWNhdGlvbi5cbmNvbnN0IHJlZ2lzdGVyVXNlciA9IGFzeW5jIChwYXlsb2FkOiBJQXV0aCkgPT4ge1xuICBjb25zdCB7IG5hbWUsIHBhc3N3b3JkLCBwaG9uZSwgcm9sZSB9ID0gcGF5bG9hZDtcbiAgY29uc3QgZW1haWwgPSBwYXlsb2FkLmVtYWlsLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG4gIC8vIE9ubHkgdXNlcnMvYWdlbnRzIGNhbiBzZWxmLXJlZ2lzdGVyOyBhZG1pbnMgYXJlIGNyZWF0ZWQgdmlhIGRlbW8tbG9naW4vc2VlZFxuICBpZiAocm9sZSAmJiByb2xlICE9PSBcIlVTRVJcIiAmJiByb2xlICE9PSBcIkFHRU5UXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIlJvbGUgbXVzdCBiZSBlaXRoZXIgVVNFUiBvciBBR0VOVFwiKTtcbiAgfVxuXG4gIGNvbnN0IGV4aXN0aW5nVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGVtYWlsIH0sXG4gIH0pO1xuICBpZiAoZXhpc3RpbmdVc2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJVc2VyIHdpdGggdGhpcyBlbWFpbCBhbHJlYWR5IGV4aXN0c1wiKTtcbiAgfVxuXG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IGdldFJlZGlzQ2xpZW50KCk7XG5cbiAgLy8gQSByZWdpc3RyYXRpb24gaXMgYWxyZWFkeSBzdGFnZWQgZm9yIHRoaXMgZW1haWwgXHUyMDE0IDQwOSBpbnN0ZWFkIG9mIHNpbGVudGx5XG4gIC8vIG92ZXJ3cml0aW5nIHRoZSBwZW5kaW5nIE9UUC9kYXRhIChhbiBhdHRhY2tlciBtdXN0IG5vdCBiZSBhYmxlIHRvIGtpbGwgYVxuICAvLyB2aWN0aW0ncyBpbi1mbGlnaHQgcmVnaXN0cmF0aW9uKS4gVGhlIHBlbmRpbmcgZmxvdyBjb250aW51ZXMgdmlhXG4gIC8vIHJlc2VuZC12ZXJpZmljYXRpb24uXG4gIGNvbnN0IHJlZ2lzdHJhdGlvbkRhdGFLZXkgPSBgdHJpcHZlcnNlOnJlZ2lzdGVyLWRhdGE6JHtlbWFpbH1gO1xuICBjb25zdCBwZW5kaW5nUmVnaXN0cmF0aW9uID0gYXdhaXQgY2xpZW50LmdldChyZWdpc3RyYXRpb25EYXRhS2V5KTtcbiAgaWYgKHBlbmRpbmdSZWdpc3RyYXRpb24pIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBcIlJlZ2lzdHJhdGlvbiBpcyBwZW5kaW5nIHZlcmlmaWNhdGlvbi4gQ2hlY2sgeW91ciBlbWFpbCBvciByZXNlbmQgdGhlIE9UUC5cIixcbiAgICApO1xuICB9XG5cbiAgY29uc3QgaGFzaGVkUGFzc3dvcmQgPSBhd2FpdCBiY3J5cHQuaGFzaChcbiAgICBwYXNzd29yZCxcbiAgICBOdW1iZXIoY29uZmlnLmJjcnlwdF9zYWx0X3JvdW5kcyksXG4gICk7XG5cbiAgLy8gUmVnaXN0cmF0aW9uIE9UUCAodGhlIHZhbHVlIHRoZSB1c2VyIHR5cGVzIGJhY2sgaW50byB0aGUgQVBJKVxuICBjb25zdCBvdHBLZXkgPSBgdHJpcHZlcnNlOnJlZ2lzdGVyLW90cDoke2VtYWlsfWA7XG4gIGNvbnN0IG90cFZhbHVlID0gY3J5cHRvLnJhbmRvbUludCgxMDAwMDAsIDEwMDAwMDApLnRvU3RyaW5nKCk7XG5cbiAgYXdhaXQgY2xpZW50LnNldChvdHBLZXksIG90cFZhbHVlLCB7XG4gICAgZXhwaXJhdGlvbjoge1xuICAgICAgdHlwZTogXCJFWFwiLFxuICAgICAgdmFsdWU6IE9UUF9FWFBJUkFUSU9OX1NFQ09ORFMsXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gU3RhZ2VkIHJlZ2lzdHJhdGlvbiBwYXlsb2FkIFx1MjAxNCBwYXNzd29yZCBpcyBhbHJlYWR5IGhhc2hlZCBoZXJlLCBleGFjdGx5XG4gIC8vIGxpa2UgdGhlIHJlZmVyZW5jZSwgc28gYSBSZWRpcyBsZWFrIG5ldmVyIGV4cG9zZXMgYSBwbGFpbnRleHQgcGFzc3dvcmQuXG4gIGNvbnN0IHJlZGlzVXNlckRhdGFQYXlsb2FkID0ge1xuICAgIG5hbWUsXG4gICAgZW1haWwsXG4gICAgcGFzc3dvcmQ6IGhhc2hlZFBhc3N3b3JkLFxuICAgIHBob25lLFxuICAgIHJvbGU6IHJvbGUgfHwgXCJVU0VSXCIsXG4gIH07XG5cbiAgYXdhaXQgY2xpZW50LnNldChyZWdpc3RyYXRpb25EYXRhS2V5LCBKU09OLnN0cmluZ2lmeShyZWRpc1VzZXJEYXRhUGF5bG9hZCksIHtcbiAgICBleHBpcmF0aW9uOiB7XG4gICAgICB0eXBlOiBcIkVYXCIsXG4gICAgICB2YWx1ZTogT1RQX0VYUElSQVRJT05fU0VDT05EUyxcbiAgICB9LFxuICB9KTtcblxuICAvLyBCZXN0LWVmZm9ydCBlbWFpbCBcdTIwMTQgYSBzZW5kIGZhaWx1cmUgbmV2ZXIgZmFpbHMgcmVnaXN0cmF0aW9uIChUcmlwVmVyc2VcbiAgLy8gY29udmVudGlvbik7IHRoZSB1c2VyIGNhbiByZWNvdmVyIHZpYSByZXNlbmQtdmVyaWZpY2F0aW9uLlxuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZFZlcmlmaWNhdGlvbk90cEVtYWlsKHsgZW1haWwsIG5hbWUsIG90cDogb3RwVmFsdWUgfSksXG4gIF0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFZlcmlmeSBlbWFpbCAoY3JlYXRlcyB0aGUgdXNlciArIGF1dG8tbG9naW4pIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gRm9sbG93cyB0aGUgcmVmZXJlbmNlIGJhY2tlbmQ6IE9UUCBpcyByZWFkIGZyb20gUmVkaXMsIGRlbGV0ZWQsIHRoZW4gdGhlXG4vLyBzdGFnZWQgcGF5bG9hZCBpcyBtYXRlcmlhbGlzZWQgYXMgYSByZWFsIHVzZXIgcm93IHdpdGggZW1haWxWZXJpZmllZDogdHJ1ZSxcbi8vIGFuZCB0b2tlbnMgYXJlIGlzc3VlZCBzbyB0aGUgdXNlciBpcyBsb2dnZWQgaW4gaW1tZWRpYXRlbHkuXG5jb25zdCB2ZXJpZnlFbWFpbCA9IGFzeW5jIChwYXlsb2FkOiBJVmVyaWZ5RW1haWxQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgb3RwIH0gPSBwYXlsb2FkO1xuICBjb25zdCBlbWFpbCA9IHBheWxvYWQuZW1haWwudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgLy8gRGVmZW5zaXZlIFx1MjAxNCByZWdpc3RyYXRpb24gYWxyZWFkeSA0MDlzIG9uIGFuIGV4aXN0aW5nIGVtYWlsLCBzbyBhIHVzZXIgcm93XG4gIC8vIGhlcmUgbWVhbnMgdGhlIGVtYWlsIHdhcyB2ZXJpZmllZCBlYXJsaWVyIHRocm91Z2ggYW5vdGhlciBmbG93LlxuICBjb25zdCBpc1VzZXJFeGlzdHMgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgZW1haWwgfSB9KTtcbiAgaWYgKGlzVXNlckV4aXN0cykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiRW1haWwgaXMgYWxyZWFkeSB2ZXJpZmllZFwiKTtcbiAgfVxuXG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IGdldFJlZGlzQ2xpZW50KCk7XG5cbiAgY29uc3Qgb3RwS2V5ID0gYHRyaXB2ZXJzZTpyZWdpc3Rlci1vdHA6JHtlbWFpbH1gO1xuICBjb25zdCByZWRpc09UUCA9IGF3YWl0IGNsaWVudC5nZXQob3RwS2V5KTtcblxuICBpZiAoIXJlZGlzT1RQIHx8IHJlZGlzT1RQICE9PSBvdHApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgb3IgZXhwaXJlZCBPVFAuXCIpO1xuICB9XG5cbiAgLy8gT1RQIGlzIHNpbmdsZS11c2UgXHUyMDE0IGRlbGV0ZSBpdCBiZWZvcmUgdGhlIHVzZXIgcm93IGlzIGNyZWF0ZWQuXG4gIGF3YWl0IGNsaWVudC5kZWwob3RwS2V5KTtcblxuICBjb25zdCByZWdpc3RyYXRpb25EYXRhS2V5ID0gYHRyaXB2ZXJzZTpyZWdpc3Rlci1kYXRhOiR7ZW1haWx9YDtcbiAgY29uc3QgcmVkaXNVc2VyRGF0YSA9IGF3YWl0IGNsaWVudC5nZXQocmVnaXN0cmF0aW9uRGF0YUtleSk7XG5cbiAgaWYgKCFyZWRpc1VzZXJEYXRhKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIG9yIGV4cGlyZWQgT1RQLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHVzZXJQYXlsb2FkID0gSlNPTi5wYXJzZShyZWRpc1VzZXJEYXRhKSBhcyBJQXV0aDtcblxuICBjb25zdCBjcmVhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgbmFtZTogdXNlclBheWxvYWQubmFtZSxcbiAgICAgIGVtYWlsOiB1c2VyUGF5bG9hZC5lbWFpbCxcbiAgICAgIHBhc3N3b3JkOiB1c2VyUGF5bG9hZC5wYXNzd29yZCxcbiAgICAgIHBob25lOiB1c2VyUGF5bG9hZC5waG9uZSxcbiAgICAgIHJvbGU6IHVzZXJQYXlsb2FkLnJvbGUgfHwgXCJVU0VSXCIsXG4gICAgICBhdXRoUHJvdmlkZXI6IFwiQ1JFREVOVElBTFwiLFxuICAgICAgc3RhdHVzOiBcIkFDVElWRVwiLFxuICAgICAgZW1haWxWZXJpZmllZDogdHJ1ZSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgLy8gU3RhZ2VkIHBheWxvYWQgY29uc3VtZWQgXHUyMDE0IG5vdGhpbmcgcmVtYWlucyBpbiBSZWRpcy5cbiAgYXdhaXQgY2xpZW50LmRlbChyZWdpc3RyYXRpb25EYXRhS2V5KTtcblxuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZFdlbGNvbWVFbWFpbCh7IGVtYWlsOiBjcmVhdGVkVXNlci5lbWFpbCwgbmFtZTogY3JlYXRlZFVzZXIubmFtZSB9KSxcbiAgXSk7XG5cbiAgY29uc3QgdG9rZW5zID0gYXdhaXQgaXNzdWVUb2tlbnMoY3JlYXRlZFVzZXIpO1xuXG4gIHJldHVybiB7IC4uLnRva2VucywgdXNlcjogY3JlYXRlZFVzZXIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZXNlbmQgdmVyaWZpY2F0aW9uIE9UUCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFJlLW1pbnRzIGEgZnJlc2ggT1RQIGZvciBhIHN0aWxsLXN0YWdlZCByZWdpc3RyYXRpb24uIFVuaWZvcm0gMjAwIFx1MjAxNCBpZiB0aGVcbi8vIHN0YWdpbmcgZGF0YSBpcyBnb25lIChuZXZlciByZWdpc3RlcmVkIC8gYWxyZWFkeSB2ZXJpZmllZCkgdGhpcyBuby1vcHMuXG5jb25zdCByZXNlbmRWZXJpZmljYXRpb24gPSBhc3luYyAocGF5bG9hZDogSVJlc2VuZFZlcmlmaWNhdGlvblBheWxvYWQpID0+IHtcbiAgY29uc3QgZW1haWwgPSBwYXlsb2FkLmVtYWlsLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IGdldFJlZGlzQ2xpZW50KCk7XG5cbiAgY29uc3QgcmVnaXN0cmF0aW9uRGF0YUtleSA9IGB0cmlwdmVyc2U6cmVnaXN0ZXItZGF0YToke2VtYWlsfWA7XG4gIGNvbnN0IHJlZGlzVXNlckRhdGEgPSBhd2FpdCBjbGllbnQuZ2V0KHJlZ2lzdHJhdGlvbkRhdGFLZXkpO1xuXG4gIGlmICghcmVkaXNVc2VyRGF0YSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHVzZXJQYXlsb2FkID0gSlNPTi5wYXJzZShyZWRpc1VzZXJEYXRhKSBhcyBJQXV0aDtcblxuICBjb25zdCBvdHBLZXkgPSBgdHJpcHZlcnNlOnJlZ2lzdGVyLW90cDoke2VtYWlsfWA7XG4gIGNvbnN0IG90cFZhbHVlID0gY3J5cHRvLnJhbmRvbUludCgxMDAwMDAsIDEwMDAwMDApLnRvU3RyaW5nKCk7XG5cbiAgYXdhaXQgY2xpZW50LnNldChvdHBLZXksIG90cFZhbHVlLCB7XG4gICAgZXhwaXJhdGlvbjoge1xuICAgICAgdHlwZTogXCJFWFwiLFxuICAgICAgdmFsdWU6IE9UUF9FWFBJUkFUSU9OX1NFQ09ORFMsXG4gICAgfSxcbiAgfSk7XG5cbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRWZXJpZmljYXRpb25PdHBFbWFpbCh7IGVtYWlsLCBuYW1lOiB1c2VyUGF5bG9hZC5uYW1lLCBvdHA6IG90cFZhbHVlIH0pLFxuICBdKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBGb3Jnb3QgcGFzc3dvcmQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBFbWFpbHMgYSByZXNldCBPVFAgdG8gdmVyaWZpZWQgQ1JFREVOVElBTCBhY2NvdW50cy4gRGVsaWJlcmF0ZWx5IHJldHVybnMgYVxuLy8gdW5pZm9ybSAyMDAgd2hldGhlciBvciBub3QgdGhlIGVtYWlsIGV4aXN0cyAvIGlzIGVsaWdpYmxlIChubyBlbnVtZXJhdGlvbiBcdTIwMTRcbi8vIHRoZSByZWZlcmVuY2UgdGhyb3dzIFwiVXNlciBub3QgZm91bmRcIiwgYnV0IFRyaXBWZXJzZSBuZXZlciBsZWFrcyBleGlzdGVuY2UpLlxuY29uc3QgZm9yZ290UGFzc3dvcmQgPSBhc3luYyAocGF5bG9hZDogSUZvcmdvdFBhc3N3b3JkUGF5bG9hZCkgPT4ge1xuICBjb25zdCBlbWFpbCA9IHBheWxvYWQuZW1haWwudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgY29uc3QgaXNVc2VyRXhpc3RzID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG5cbiAgaWYgKFxuICAgICFpc1VzZXJFeGlzdHMgfHxcbiAgICBpc1VzZXJFeGlzdHMuaXNEZWxldGVkIHx8XG4gICAgaXNVc2VyRXhpc3RzLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIiB8fFxuICAgICFpc1VzZXJFeGlzdHMuZW1haWxWZXJpZmllZCB8fFxuICAgIGlzVXNlckV4aXN0cy5hdXRoUHJvdmlkZXIgPT09IFwiR09PR0xFXCJcbiAgKSB7XG4gICAgLy8gR29vZ2xlLW9ubHkgYWNjb3VudHMgcmVzZXQgdmlhIEdvb2dsZTsgZXZlcnlvbmUgZWxzZSBzaWxlbnRseSBuby1vcHMuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0UmVkaXNDbGllbnQoKTtcblxuICBjb25zdCBvdHAgPSBjcnlwdG8ucmFuZG9tSW50KDEwMDAwMCwgMTAwMDAwMCkudG9TdHJpbmcoKTtcbiAgY29uc3Qga2V5ID0gYHRyaXB2ZXJzZTpmb3Jnb3QtcGFzc3dvcmQtb3RwOiR7aXNVc2VyRXhpc3RzLmVtYWlsfWA7XG5cbiAgYXdhaXQgY2xpZW50LnNldChrZXksIG90cCwge1xuICAgIGV4cGlyYXRpb246IHtcbiAgICAgIHR5cGU6IFwiRVhcIixcbiAgICAgIHZhbHVlOiBPVFBfRVhQSVJBVElPTl9TRUNPTkRTLFxuICAgIH0sXG4gIH0pO1xuXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kRm9yZ290UGFzc3dvcmRPdHBFbWFpbCh7XG4gICAgICBlbWFpbDogaXNVc2VyRXhpc3RzLmVtYWlsLFxuICAgICAgbmFtZTogaXNVc2VyRXhpc3RzLm5hbWUsXG4gICAgICBvdHAsXG4gICAgfSksXG4gIF0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlc2V0IHBhc3N3b3JkIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gVmFsaWRhdGVzIHRoZSBPVFAgYWdhaW5zdCBSZWRpcywgdGhlbiByZXBsYWNlcyB0aGUgaGFzaCBhbmQgYnVtcHNcbi8vIHRva2VuVmVyc2lvbiBzbyBldmVyeSBleGlzdGluZyBzZXNzaW9uIGRpZXMgKFRyaXBWZXJzZSBsb2dvdXQgc2VtYW50aWNzKS5cbmNvbnN0IHJlc2V0UGFzc3dvcmQgPSBhc3luYyAocGF5bG9hZDogSVJlc2V0UGFzc3dvcmRQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgbmV3UGFzc3dvcmQsIG90cCB9ID0gcGF5bG9hZDtcbiAgY29uc3QgZW1haWwgPSBwYXlsb2FkLmVtYWlsLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG4gIGNvbnN0IGlzVXNlckV4aXN0cyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBlbWFpbCB9IH0pO1xuXG4gIGlmIChcbiAgICAhaXNVc2VyRXhpc3RzIHx8XG4gICAgaXNVc2VyRXhpc3RzLmlzRGVsZXRlZCB8fFxuICAgIGlzVXNlckV4aXN0cy5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIgfHxcbiAgICBpc1VzZXJFeGlzdHMuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiXG4gICkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBvciBleHBpcmVkIE9UUC5cIik7XG4gIH1cblxuICBjb25zdCBjbGllbnQgPSBhd2FpdCBnZXRSZWRpc0NsaWVudCgpO1xuXG4gIGNvbnN0IGtleSA9IGB0cmlwdmVyc2U6Zm9yZ290LXBhc3N3b3JkLW90cDoke2lzVXNlckV4aXN0cy5lbWFpbH1gO1xuICBjb25zdCByZWRpc09UUCA9IGF3YWl0IGNsaWVudC5nZXQoa2V5KTtcblxuICBpZiAoIXJlZGlzT1RQIHx8IHJlZGlzT1RQICE9PSBvdHApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgb3IgZXhwaXJlZCBPVFAuXCIpO1xuICB9XG5cbiAgY29uc3QgaGFzaGVkTmV3UGFzc3dvcmQgPSBhd2FpdCBiY3J5cHQuaGFzaChcbiAgICBuZXdQYXNzd29yZCxcbiAgICBOdW1iZXIoY29uZmlnLmJjcnlwdF9zYWx0X3JvdW5kcyksXG4gICk7XG5cbiAgYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBlbWFpbDogaXNVc2VyRXhpc3RzLmVtYWlsIH0sXG4gICAgZGF0YToge1xuICAgICAgcGFzc3dvcmQ6IGhhc2hlZE5ld1Bhc3N3b3JkLFxuICAgICAgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9LFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFNpbmdsZS11c2UgT1RQIFx1MjAxNCBkZWxldGUgYWZ0ZXIgYSBzdWNjZXNzZnVsIHJlc2V0LlxuICBhd2FpdCBjbGllbnQuZGVsKGtleSk7XG5cbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRQYXNzd29yZFJlc2V0U3VjY2Vzc0VtYWlsKHtcbiAgICAgIGVtYWlsOiBpc1VzZXJFeGlzdHMuZW1haWwsXG4gICAgICBuYW1lOiBpc1VzZXJFeGlzdHMubmFtZSxcbiAgICB9KSxcbiAgXSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTG9naW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBsb2dpblVzZXIgPSBhc3luYyAocGF5bG9hZDogSUxvZ2luVXNlcikgPT4ge1xuICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgZW1haWwgfSxcbiAgfSk7XG5cbiAgaWYgKCF1c2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJJbnZhbGlkIGVtYWlsIG9yIHBhc3N3b3JkXCIpO1xuICB9XG4gIGlmICh1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBpcyBzdXNwZW5kZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJUaGlzIGFjY291bnQgdXNlcyBHb29nbGUgbG9naW4uIFBsZWFzZSBsb2cgaW4gd2l0aCBHb29nbGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGlzUGFzc3dvcmRWYWxpZCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKHBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkIHx8IFwiXCIpO1xuICBpZiAoIWlzUGFzc3dvcmRWYWxpZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBlbWFpbCBvciBwYXNzd29yZFwiKTtcbiAgfVxuXG4gIHJldHVybiBhd2FpdCBpc3N1ZVRva2Vucyh1c2VyKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBHb29nbGUgbG9naW4gKElELXRva2VuIGZsb3cpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ29vZ2xlTG9naW4gPSBhc3luYyAocGF5bG9hZDogSUdvb2dsZUxvZ2luUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IGlkVG9rZW4gfSA9IHBheWxvYWQ7XG5cbiAgaWYgKCFjb25maWcuZ29vZ2xlX2NsaWVudF9pZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiR29vZ2xlIGxvZ2luIGlzIG5vdCBjb25maWd1cmVkLiBQbGVhc2UgY29udGFjdCBzdXBwb3J0LlwiLFxuICAgICk7XG4gIH1cblxuICBsZXQgdGlja2V0O1xuICB0cnkge1xuICAgIHRpY2tldCA9IGF3YWl0IGdvb2dsZUNsaWVudC52ZXJpZnlJZFRva2VuKHtcbiAgICAgIGlkVG9rZW4sXG4gICAgICBhdWRpZW5jZTogY29uZmlnLmdvb2dsZV9jbGllbnRfaWQsXG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBHb29nbGUgdG9rZW5cIik7XG4gIH1cblxuICBjb25zdCBnb29nbGVEYXRhID0gdGlja2V0LmdldFBheWxvYWQoKTtcbiAgaWYgKCFnb29nbGVEYXRhKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIEdvb2dsZSB0b2tlbiBwYXlsb2FkXCIpO1xuICB9XG5cbiAgY29uc3QgeyBlbWFpbCwgbmFtZSwgc3ViLCBwaWN0dXJlIH0gPSBnb29nbGVEYXRhO1xuXG4gIGlmICghZW1haWwgfHwgIWdvb2dsZURhdGEuZW1haWxfdmVyaWZpZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkdvb2dsZSBhY2NvdW50IGVtYWlsIGlzIG5vdCB2ZXJpZmllZFwiKTtcbiAgfVxuXG4gIGxldCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGdvb2dsZUlkOiBzdWIgfSB9KTtcblxuICAvLyBFeGlzdGluZyB1c2VyIFx1MjE5MiBsaW5rIEdvb2dsZSBhY2NvdW50IGlmIG5vdCBhbHJlYWR5IGxpbmtlZFxuICBpZiAoIXVzZXIgJiYgZW1haWwpIHtcbiAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG4gICAgaWYgKHVzZXIpIHtcbiAgICAgIGlmICh1c2VyLmdvb2dsZUlkICYmIHVzZXIuZ29vZ2xlSWQgIT09IHN1Yikge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgNDA5LFxuICAgICAgICAgIFwiRW1haWwgaXMgYWxyZWFkeSBsaW5rZWQgdG8gYW5vdGhlciBHb29nbGUgYWNjb3VudFwiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiB1c2VyLmlkIH0sXG4gICAgICAgIGRhdGE6IHsgZ29vZ2xlSWQ6IHN1YiwgZW1haWxWZXJpZmllZDogdHJ1ZSB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gQnJhbmQgbmV3IHVzZXJcbiAgaWYgKCF1c2VyKSB7XG4gICAgY29uc3QgbG9jYWxQYXJ0ID0gZW1haWwuc3BsaXQoXCJAXCIpWzBdID8/IGVtYWlsO1xuICAgIGNvbnN0IGRpc3BsYXlOYW1lID0gKG5hbWUgPz8gXCJcIikudHJpbSgpIHx8IGxvY2FsUGFydDtcbiAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgZW1haWwsXG4gICAgICAgIG5hbWU6IGRpc3BsYXlOYW1lLFxuICAgICAgICBwYXNzd29yZDogbnVsbCxcbiAgICAgICAgYXV0aFByb3ZpZGVyOiBcIkdPT0dMRVwiLFxuICAgICAgICBnb29nbGVJZDogc3ViLFxuICAgICAgICBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuICAgICAgICByb2xlOiBcIlVTRVJcIixcbiAgICAgICAgYXZhdGFyVXJsOiBwaWN0dXJlIHx8IG51bGwsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdG9rZW5zID0gYXdhaXQgaXNzdWVUb2tlbnModXNlciEpO1xuICBjb25zdCBzYW5pdGl6ZWRVc2VyID0gc2FuaXRpemVVc2VyKHVzZXIhKTtcblxuICByZXR1cm4geyAuLi50b2tlbnMsIHVzZXI6IHNhbml0aXplZFVzZXIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBEZW1vIGxvZ2luIChncmFkaW5nKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IERFTU9fUEFTU1dPUkQgPSBcImRlbW8xMjNcIjtcblxuY29uc3QgZGVtb0xvZ2luID0gYXN5bmMgKHBheWxvYWQ6IElEZW1vTG9naW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgcm9sZSB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBkZW1vVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwc2VydCh7XG4gICAgd2hlcmU6IHsgZW1haWw6IGBkZW1vLSR7cm9sZS50b0xvd2VyQ2FzZSgpfUB0cmlwdmVyc2UuY29tYCB9LFxuICAgIC8vIHJlc3VycmVjdCBkZW1vIGFjY291bnRzIHRoYXQgYW4gYWRtaW4gc3VzcGVuZGVkIG9yIHNvZnQtZGVsZXRlZFxuICAgIHVwZGF0ZTogeyBzdGF0dXM6IFwiQUNUSVZFXCIsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBjcmVhdGU6IHtcbiAgICAgIG5hbWU6IGBEZW1vICR7cm9sZS5jaGFyQXQoMCkgKyByb2xlLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCl9YCxcbiAgICAgIGVtYWlsOiBgZGVtby0ke3JvbGUudG9Mb3dlckNhc2UoKX1AdHJpcHZlcnNlLmNvbWAsXG4gICAgICBwYXNzd29yZDogYXdhaXQgYmNyeXB0Lmhhc2goREVNT19QQVNTV09SRCwgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpKSxcbiAgICAgIGF1dGhQcm92aWRlcjogXCJDUkVERU5USUFMXCIsXG4gICAgICByb2xlLFxuICAgICAgc3RhdHVzOiBcIkFDVElWRVwiLFxuICAgICAgZW1haWxWZXJpZmllZDogdHJ1ZSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHsgLi4uKGF3YWl0IGlzc3VlVG9rZW5zKGRlbW9Vc2VyKSksIHVzZXI6IGRlbW9Vc2VyIH07XG59O1xuXG4vLyBSZXVzZSBkZXRlY3RlZCBcdTIxOTIga2lsbCB0aGUgd2hvbGUgZmFtaWx5OiBldmVyeSBvdXRzdGFuZGluZyB0b2tlbiBkaWVzIHZpYVxuLy8gcmV2b2tlICsgdG9rZW5WZXJzaW9uIGJ1bXAuIFNhbWUgc2hhcGUgYXMgbG9nb3V0LlxuY29uc3QgcmV2b2tlRmFtaWx5ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oW1xuICAgIHByaXNtYS5yZWZyZXNoVG9rZW4udXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyB1c2VySWQsIHJldm9rZWRBdDogbnVsbCB9LFxuICAgICAgZGF0YTogeyByZXZva2VkQXQ6IG5ldyBEYXRlKCkgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgICAgZGF0YTogeyB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSxcbiAgICB9KSxcbiAgXSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVmcmVzaCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHJlZnJlc2hUb2tlbiA9IGFzeW5jIChwYXlsb2FkOiBJUmVmcmVzaFRva2VuUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IHJlZnJlc2hUb2tlbjogcHJvdmlkZWRSZWZyZXNoVG9rZW4gfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdmVyaWZpZWQgPSBqd3RVdGlscy52ZXJpZnlUb2tlbihcbiAgICBwcm92aWRlZFJlZnJlc2hUb2tlbixcbiAgICBjb25maWcuand0X3JlZnJlc2hfc2VjcmV0LFxuICApO1xuXG4gIGlmICghdmVyaWZpZWQuc3VjY2Vzcykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIHZlcmlmaWVkLmVycm9yKTtcbiAgfVxuXG4gIGNvbnN0IHsgaWQsIHRva2VuVmVyc2lvbjogdG9rZW5Ub2tlblZlcnNpb24gfSA9XG4gICAgdmVyaWZpZWQuZGF0YSBhcyBKd3RQYXlsb2FkICYgeyB0b2tlblZlcnNpb246IG51bWJlciB9O1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcblxuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaGFzIGJlZW4gZGVsZXRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaXMgc3VzcGVuZGVkXCIpO1xuICB9XG5cbiAgLy8gdG9rZW5WZXJzaW9uIGNoYW5nZWQgXHUyMTkyIHRva2VucyB3ZXJlIHJldm9rZWQgKGxvZ291dCAvIHBhc3N3b3JkIGNoYW5nZSlcbiAgaWYgKHVzZXIudG9rZW5WZXJzaW9uICE9PSB0b2tlblRva2VuVmVyc2lvbikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiVG9rZW4gaXMgbm8gbG9uZ2VyIHZhbGlkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIpO1xuICB9XG5cbiAgLy8gT3Bwb3J0dW5pc3RpYyBob3VzZWtlZXBpbmcgXHUyMDE0IGtlZXAgdGhlIGxlZGdlciBmcm9tIGdyb3dpbmcgdW5ib3VuZGVkXG4gIC8vIHdpdGhvdXQgYSBjcm9uOiBkcm9wIGV4cGlyZWQgcm93cyBhbmQgcm93cyByZXZva2VkIG1vcmUgdGhhbiA3IGRheXMgYWdvLlxuICBjb25zdCB3ZWVrQWdvID0gbmV3IERhdGUoRGF0ZS5ub3coKSAtIDcgKiAyNCAqIDYwICogNjAgKiAxMDAwKTtcbiAgYXdhaXQgcHJpc21hLnJlZnJlc2hUb2tlbi5kZWxldGVNYW55KHtcbiAgICB3aGVyZToge1xuICAgICAgT1I6IFt7IGV4cGlyZXNBdDogeyBsdDogbmV3IERhdGUoKSB9IH0sIHsgcmV2b2tlZEF0OiB7IGx0ZTogd2Vla0FnbyB9IH1dLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFJvdGF0aW9uIGxlZGdlciBsb29rdXAgYnkgdGhlIHByZXNlbnRlZCB0b2tlbidzIGhhc2guXG4gIGNvbnN0IHJvdyA9IGF3YWl0IHByaXNtYS5yZWZyZXNoVG9rZW4uZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaGFzaDogc2hhMjU2KHByb3ZpZGVkUmVmcmVzaFRva2VuKSB9LFxuICB9KTtcblxuICAvLyBOZXZlciBpc3N1ZWQgKG9yIGFscmVhZHkgcHJ1bmVkKSBcdTIxOTIgcmVqZWN0LlxuICBpZiAoIXJvdykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCByZWZyZXNoIHRva2VuLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIpO1xuICB9XG5cbiAgLy8gQSByZXZva2VkIHJvdyBpcyB0aGUgdGhlZnQgc2lnbmF0dXJlIFx1MjAxNCBzb21lb25lIHJlcGxheWVkIGEgcm90YXRlZCB0b2tlbi5cbiAgaWYgKHJvdy5yZXZva2VkQXQpIHtcbiAgICBhd2FpdCByZXZva2VGYW1pbHkodXNlci5pZCk7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJSZWZyZXNoIHRva2VuIHJldXNlIGRldGVjdGVkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIpO1xuICB9XG5cbiAgLy8gTmF0dXJhbGx5IGV4cGlyZWQgXHUyMTkyIHJlamVjdCB3aXRob3V0IHRvdWNoaW5nIHRoZSBmYW1pbHkuXG4gIGlmIChyb3cuZXhwaXJlc0F0LmdldFRpbWUoKSA8PSBEYXRlLm5vdygpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJSZWZyZXNoIHRva2VuIGhhcyBleHBpcmVkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIpO1xuICB9XG5cbiAgLy8gVmFsaWQgXHUyMTkyIHJvdGF0ZS4gVGhlIENBUyBvbiBgcmV2b2tlZEF0OiBudWxsYCBtYWtlcyByb3RhdGlvbiBhXG4gIC8vIGNvbXBhcmUtYW5kLXN3YXA6IG9mIHR3byB0cnVseS1jb25jdXJyZW50IHByZXNlbnRzIG9mIHRoZSBzYW1lIHRva2VuIG9ubHlcbiAgLy8gb25lIHdpbnM7IHRoZSBsb3NlcidzIHVwZGF0ZU1hbnkgcmV0dXJucyBjb3VudCAwIFx1MjE5MiBmYW1pbHkgbnVrZS4gVGhlIG51a2VcbiAgLy8gbXVzdCBydW4gQUZURVIgdGhlIHRyYW5zYWN0aW9uIGNvbW1pdHMgXHUyMDE0IHRocm93aW5nIGluc2lkZSB0aGUgaW50ZXJhY3RpdmVcbiAgLy8gdHggd291bGQgcm9sbCBpdCBiYWNrIGFuZCBzaWxlbnRseSB1bmRvIHRoZSBudWtlLlxuICBjb25zdCBvdXRjb21lID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCByb3RhdGVkID0gYXdhaXQgdHgucmVmcmVzaFRva2VuLnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJvdy5pZCwgcmV2b2tlZEF0OiBudWxsIH0sXG4gICAgICBkYXRhOiB7IHJldm9rZWRBdDogbmV3IERhdGUoKSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHJvdGF0ZWQuY291bnQgPT09IDApIHtcbiAgICAgIHJldHVybiBcIkxPU1RcIiBhcyBjb25zdDtcbiAgICB9XG5cbiAgICBjb25zdCB0b2tlbnMgPSBhd2FpdCBpc3N1ZVRva2Vucyh1c2VyLCB0eCk7XG4gICAgcmV0dXJuIHsgdG9rZW5zIH0gYXMgY29uc3Q7XG4gIH0pO1xuXG4gIGlmIChvdXRjb21lID09PSBcIkxPU1RcIikge1xuICAgIGF3YWl0IHJldm9rZUZhbWlseSh1c2VyLmlkKTtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIlJlZnJlc2ggdG9rZW4gcmV1c2UgZGV0ZWN0ZWQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIik7XG4gIH1cblxuICByZXR1cm4gb3V0Y29tZS50b2tlbnM7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTG9nb3V0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgbG9nb3V0ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIC8vIFJldm9rZSB0aGUgbGVkZ2VyIHJvd3MsIHRoZW4gYnVtcCB0b2tlblZlcnNpb24gKGtpbGxzIGV2ZXJ5dGhpbmcpLlxuICBhd2FpdCByZXZva2VGYW1pbHkodXNlcklkKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBHZXQgbWUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRNZUZyb21EQiA9IGFzeW5jICh1c2VySWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuXG4gIHJldHVybiB1c2VyO1xufTtcblxuZXhwb3J0IGNvbnN0IGF1dGhTZXJ2aWNlID0ge1xuICByZWdpc3RlclVzZXIsXG4gIHZlcmlmeUVtYWlsLFxuICByZXNlbmRWZXJpZmljYXRpb24sXG4gIGZvcmdvdFBhc3N3b3JkLFxuICByZXNldFBhc3N3b3JkLFxuICBsb2dpblVzZXIsXG4gIGdvb2dsZUxvZ2luLFxuICBkZW1vTG9naW4sXG4gIHJlZnJlc2hUb2tlbixcbiAgbG9nb3V0LFxuICBnZXRNZUZyb21EQixcbn07IiwgImltcG9ydCB7IE9BdXRoMkNsaWVudCB9IGZyb20gXCJnb29nbGUtYXV0aC1saWJyYXJ5XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuZXhwb3J0IGNvbnN0IGdvb2dsZUNsaWVudCA9IG5ldyBPQXV0aDJDbGllbnQoe1xuICBjbGllbnRJZDogY29uZmlnLmdvb2dsZV9jbGllbnRfaWQsXG59KTsiLCAiaW1wb3J0IHsgY3JlYXRlQ2xpZW50IH0gZnJvbSBcInJlZGlzXCI7XG5pbXBvcnQgdHlwZSB7IFJlZGlzQ2xpZW50VHlwZSB9IGZyb20gXCJyZWRpc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbi8vIFJlZGlzIE9UUCBzdG9yZSBmb3IgZW1haWwgdmVyaWZpY2F0aW9uICsgcGFzc3dvcmQgcmVzZXQgKFN0ZXAgMjEpIFx1MjAxNCBtaXJyb3JzXG4vLyB0aGUgcmVmZXJlbmNlIGJhY2tlbmQncyBub2RlLXJlZGlzIGNsaWVudC4gTnVsbCB3aGVuIHVuY29uZmlndXJlZCBzbyB0aGUgYXBwXG4vLyBzdGlsbCBib290cyAoZS5nLiBWZXJjZWwgcHJvZCk7IHRoZSBhdXRoIGVuZHBvaW50cyB0aGVuIGZhaWwgd2l0aCBhIGNsZWFuXG4vLyA1MDMgaW5zdGVhZCBvZiBjcmFzaGluZy5cbmV4cG9ydCBjb25zdCByZWRpc0NsaWVudCA9IGNvbmZpZy5yZWRpc19ob3N0XG4gID8gY3JlYXRlQ2xpZW50KHtcbiAgICAgIHVzZXJuYW1lOiBjb25maWcucmVkaXNfdXNlcixcbiAgICAgIHBhc3N3b3JkOiBjb25maWcucmVkaXNfcGFzc3dvcmQsXG4gICAgICBzb2NrZXQ6IHtcbiAgICAgICAgaG9zdDogY29uZmlnLnJlZGlzX2hvc3QsXG4gICAgICAgIHBvcnQ6IHBhcnNlSW50KGNvbmZpZy5yZWRpc19wb3J0IHx8IFwiNjM3OVwiKSxcbiAgICAgIH0sXG4gICAgfSlcbiAgOiBudWxsO1xuXG4vLyBMYXppbHktY29ubmVjdCBhY2Nlc3NvciBcdTIwMTQgY29ubmVjdCgpIGlzIGlkZW1wb3RlbnQsIHNvIHRoaXMgaXMgc2FmZSB0byBjYWxsXG4vLyBwZXIgcmVxdWVzdDsgdGhlIGNsaWVudCBpcyBhbHNvIGNvbm5lY3RlZCBvbmNlIGF0IGJvb3QgaW4gc2VydmVyLnRzLlxuZXhwb3J0IGNvbnN0IGdldFJlZGlzID0gYXN5bmMgKCk6IFByb21pc2U8UmVkaXNDbGllbnRUeXBlIHwgbnVsbD4gPT4ge1xuICBpZiAoIXJlZGlzQ2xpZW50KSByZXR1cm4gbnVsbDtcblxuICBpZiAoIXJlZGlzQ2xpZW50LmlzT3Blbikge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCByZWRpc0NsaWVudC5jb25uZWN0KCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIFwiW3JlZGlzXSBjb25uZWN0IGZhaWxlZDpcIixcbiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZWRpc0NsaWVudDtcbn07XG4iLCAiaW1wb3J0IGNyeXB0byBmcm9tIFwiY3J5cHRvXCI7XG5pbXBvcnQgand0LCB7IEp3dFBheWxvYWQsIFNpZ25PcHRpb25zIH0gZnJvbSBcImpzb253ZWJ0b2tlblwiO1xuXG5jb25zdCBjcmVhdGVUb2tlbiA9IChcbiAgcGF5bG9hZDogSnd0UGF5bG9hZCxcbiAgc2VjcmV0OiBzdHJpbmcsXG4gIGV4cGlyZXNJbjogU2lnbk9wdGlvbnMsXG4pID0+IHtcbiAgLy8ganRpIGd1YXJhbnRlZXMgYnl0ZS11bmlxdWUgdG9rZW5zIGV2ZW4gd2l0aGluIHRoZSBzYW1lIGlhdCBzZWNvbmQgXHUyMDE0XG4gIC8vIG90aGVyd2lzZSB0d28gdG9rZW5zIG1pbnRlZCBmb3IgdGhlIHNhbWUgdXNlciBpbiBvbmUgc2Vjb25kIGNvbGxpZGUgb25cbiAgLy8gdGhlIHJlZnJlc2gtbGVkZ2VyIHVuaXF1ZSBoYXNoIChTdGVwIDIyKS5cbiAgY29uc3QgdG9rZW4gPSBqd3Quc2lnbih7IC4uLnBheWxvYWQsIGp0aTogY3J5cHRvLnJhbmRvbVVVSUQoKSB9LCBzZWNyZXQsIGV4cGlyZXNJbik7XG5cbiAgcmV0dXJuIHRva2VuO1xufTtcblxuY29uc3QgdmVyaWZ5VG9rZW4gPSAodG9rZW46IHN0cmluZywgc2VjcmV0OiBzdHJpbmcpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB2ZXJpZmllZFRva2VuID0gand0LnZlcmlmeSh0b2tlbiwgc2VjcmV0KTtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGRhdGE6IHZlcmlmaWVkVG9rZW4sXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIGNvbnNvbGUubG9nKFwiVG9rZW4gVmVyaWZpY2F0aW9uIEZhaWxlZDpcIiwgZXJyb3IpO1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgIH07XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBqd3RVdGlscyA9IHtcbiAgY3JlYXRlVG9rZW4sXG4gIHZlcmlmeVRva2VuLFxufTtcbiIsICJpbXBvcnQgbm9kZW1haWxlciBmcm9tIFwibm9kZW1haWxlclwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbi8vIE5vZGVtYWlsZXIgdHJhbnNwb3J0ZXIgZm9yIHRoZSBhdXRoIGVtYWlscyAoU3RlcCAyMSkgXHUyMDE0IGlkZW50aWNhbCB0byB0aGVcbi8vIHJlZmVyZW5jZSBiYWNrZW5kIChHbWFpbCBhcHAtcGFzc3dvcmQgU01UUCkuIE51bGwgd2hlbiB1bmNvbmZpZ3VyZWQgc28gdGhlXG4vLyBhcHAgc3RpbGwgYm9vdHM7IHRoZSBhdXRoIGVtYWlsIGhlbHBlcnMgdGhlbiBiZWNvbWUgYmVzdC1lZmZvcnQgbm8tb3BzLlxuZXhwb3J0IGNvbnN0IHRyYW5zcG9ydGVyID1cbiAgY29uZmlnLnNtdHBfdXNlciAmJiBjb25maWcuc210cF9wYXNzd29yZFxuICAgID8gbm9kZW1haWxlci5jcmVhdGVUcmFuc3BvcnQoe1xuICAgICAgICBzZXJ2aWNlOiBcImdtYWlsXCIsXG4gICAgICAgIGF1dGg6IHtcbiAgICAgICAgICB1c2VyOiBjb25maWcuc210cF91c2VyLFxuICAgICAgICAgIHBhc3M6IGNvbmZpZy5zbXRwX3Bhc3N3b3JkLFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICA6IG51bGw7XG4iLCAiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCBlanMgZnJvbSBcImVqc1wiO1xuXG4vLyBSZW5kZXJzIGFuIEVKUyBlbWFpbCB0ZW1wbGF0ZSBieSBuYW1lLiBUaGUgdGVtcGxhdGUgZGlyZWN0b3J5IGlzIHJlc29sdmVkIGF0XG4vLyBydW50aW1lIHdpdGggZmFsbGJhY2tzIHNvIGl0IHdvcmtzIGluIGV2ZXJ5IGhvc3Q6XG4vLyAgIC0gZGV2IChgdHN4IHdhdGNoYCkgYW5kIGxvY2FsIGBkaXN0YCBydW4gd2l0aCBjd2QgPSBwcm9qZWN0IHJvb3QgXHUyMTkyIHNyYy90ZW1wbGF0ZXNcbi8vICAgLSB0aGUgVmVyY2VsIGJ1bmRsZSAoYXBpL2luZGV4LmpzKSBoYXMgdGhlIHRlbXBsYXRlcyBjb3BpZWQgdG8gYXBpL3RlbXBsYXRlcyBcdTIxOTIgPGN3ZD4vdGVtcGxhdGVzXG5leHBvcnQgY29uc3QgcmVuZGVyVGVtcGxhdGUgPSAobmFtZTogc3RyaW5nLCBkYXRhOiBvYmplY3QpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICBjb25zdCBjYW5kaWRhdGVzID0gW1xuICAgIHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBcInNyYy90ZW1wbGF0ZXNcIiksXG4gICAgcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwidGVtcGxhdGVzXCIpLFxuICAgIHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBcImFwaS90ZW1wbGF0ZXNcIiksXG4gIF07XG5cbiAgY29uc3QgZGlyID0gY2FuZGlkYXRlcy5maW5kKChkKSA9PiBmcy5leGlzdHNTeW5jKHBhdGguam9pbihkLCBgJHtuYW1lfS5lanNgKSkpO1xuICBpZiAoIWRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcihgRW1haWwgdGVtcGxhdGUgXCIke25hbWV9LmVqc1wiIG5vdCBmb3VuZGApO1xuICB9XG5cbiAgcmV0dXJuIGVqcy5yZW5kZXJGaWxlKHBhdGguam9pbihkaXIsIGAke25hbWV9LmVqc2ApLCBkYXRhKTtcbn07IiwgImltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgdHJhbnNwb3J0ZXIgfSBmcm9tIFwiLi4vbGliL25vZGVtYWlsZXJcIjtcbmltcG9ydCB7IHJlbmRlclRlbXBsYXRlIH0gZnJvbSBcIi4uL3RlbXBsYXRlc1wiO1xuXG4vLyBCZXN0LWVmZm9ydCBOb2RlbWFpbGVyIHNlbmRlcnMgZm9yIHRoZSBhdXRoIGZsb3dzIChTdGVwIDIxKSBcdTIwMTQgbWlycm9ycyB0aGVcbi8vIHJlZmVyZW5jZSBiYWNrZW5kJ3MgdHJhbnNwb3J0ZXIuc2VuZE1haWwgY2FsbHMgd2l0aCBFSlMgdGVtcGxhdGVzIHJlbmRlcmVkXG4vLyBmcm9tIGBzcmMvdGVtcGxhdGVzLyouZWpzYC4gRXZlcnkgZmFpbHVyZSAobWlzc2luZyB0ZW1wbGF0ZSwgU01UUCBlcnJvcikgaXNcbi8vIGNhdWdodCBhbmQgbG9nZ2VkIGFzIGEgd2FybiwgbmV2ZXIgdGhyb3duLCBzbyBpdCBjYW4ndCBmYWlsIHRoZSBidXNpbmVzc1xuLy8gd3JpdGUgdGhhdCB0cmlnZ2VyZWQgaXQuIENhbGwgc2l0ZXMgZmlyZSB0aGVzZSBhc1xuLy8gYHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtzZW5kWCguLi4pXSlgLlxuXG5jb25zdCBPVFBfRVhQSVJBVElPTl9NSU5VVEVTID0gNTtcblxuaW50ZXJmYWNlIElBdXRoRW1haWxEZXRhaWxzIHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzZW5kQXV0aE1haWwoXG4gIHRvOiBzdHJpbmcsXG4gIHN1YmplY3Q6IHN0cmluZyxcbiAgYnVpbGQ6ICgpID0+IFByb21pc2U8c3RyaW5nPixcbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIXRyYW5zcG9ydGVyKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBTTVRQIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBhdXRoIGVtYWlsLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IGh0bWwgPSBhd2FpdCBidWlsZCgpO1xuICAgIGF3YWl0IHRyYW5zcG9ydGVyLnNlbmRNYWlsKHtcbiAgICAgIGZyb206IGNvbmZpZy5zbXRwX3VzZXIgYXMgc3RyaW5nLFxuICAgICAgdG8sXG4gICAgICBzdWJqZWN0LFxuICAgICAgaHRtbCxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zdCBkZXRhaWwgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgY29uc29sZS53YXJuKGBbZW1haWxdIGZhaWxlZCB0byBzZW5kIFwiJHtzdWJqZWN0fVwiIHRvICR7dG99OiAke2RldGFpbH1gKTtcbiAgfVxufVxuXG4vLyBTZW50IHJpZ2h0IGFmdGVyIGEgY3JlZGVudGlhbCByZWdpc3RyYXRpb24gc3RhZ2VzIGFuIE9UUCBpbiBSZWRpcy5cbmV4cG9ydCBjb25zdCBzZW5kVmVyaWZpY2F0aW9uT3RwRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElBdXRoRW1haWxEZXRhaWxzICYgeyBvdHA6IHN0cmluZyB9LFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGF3YWl0IHNlbmRBdXRoTWFpbChkZXRhaWxzLmVtYWlsLCBcIkVtYWlsIFZlcmlmaWNhdGlvbiBPVFBcIiwgKCkgPT5cbiAgICByZW5kZXJUZW1wbGF0ZShcInJlZ2lzdHJhdGlvbi11c2VyLW90cFwiLCB7XG4gICAgICBuYW1lOiBkZXRhaWxzLm5hbWUsXG4gICAgICBlbWFpbDogZGV0YWlscy5lbWFpbCxcbiAgICAgIG90cDogZGV0YWlscy5vdHAsXG4gICAgICBleHBpcmF0aW9uTWludXRlczogT1RQX0VYUElSQVRJT05fTUlOVVRFUyxcbiAgICB9KSxcbiAgKTtcbn07XG5cbi8vIFNlbnQgYnkgdGhlIGZvcmdvdC1wYXNzd29yZCBmbG93IHdpdGggdGhlIHJlc2V0IE9UUC5cbmV4cG9ydCBjb25zdCBzZW5kRm9yZ290UGFzc3dvcmRPdHBFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSUF1dGhFbWFpbERldGFpbHMgJiB7IG90cDogc3RyaW5nIH0sXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgYXdhaXQgc2VuZEF1dGhNYWlsKGRldGFpbHMuZW1haWwsIFwiRm9yZ290IFBhc3N3b3JkIFJlc2V0IE9UUFwiLCAoKSA9PlxuICAgIHJlbmRlclRlbXBsYXRlKFwiZm9yZ290LXBhc3N3b3JkXCIsIHtcbiAgICAgIG5hbWU6IGRldGFpbHMubmFtZSxcbiAgICAgIG90cDogZGV0YWlscy5vdHAsXG4gICAgICBleHBpcmF0aW9uTWludXRlczogT1RQX0VYUElSQVRJT05fTUlOVVRFUyxcbiAgICB9KSxcbiAgKTtcbn07XG5cbi8vIFNlbnQgYWZ0ZXIgYSBzdWNjZXNzZnVsIGVtYWlsIHZlcmlmaWNhdGlvbi4gVGhlIENUQSBsaW5rcyB0byB0aGUgZnJvbnRlbmRcbi8vIChwcm9kIFVSTCBpbiBwcm9kdWN0aW9uLCBkZXYgVVJMIG90aGVyd2lzZSk7IGhpZGRlbiB3aGVuIG5vIFVSTCBpcyBzZXQuXG5leHBvcnQgY29uc3Qgc2VuZFdlbGNvbWVFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSUF1dGhFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgYXdhaXQgc2VuZEF1dGhNYWlsKGRldGFpbHMuZW1haWwsIFwiV2VsY29tZSB0byBUcmlwVmVyc2VcIiwgKCkgPT5cbiAgICByZW5kZXJUZW1wbGF0ZShcIndlbGNvbWUtZW1haWxcIiwge1xuICAgICAgbmFtZTogZGV0YWlscy5uYW1lLFxuICAgICAgZnJvbnRlbmRVcmw6XG4gICAgICAgIGNvbmZpZy5ub2RlX2VudiA9PT0gXCJwcm9kdWN0aW9uXCJcbiAgICAgICAgICA/IGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZFxuICAgICAgICAgIDogY29uZmlnLmZyb250ZW5kX3VybF9kZXYsXG4gICAgfSksXG4gICk7XG59O1xuXG4vLyBTZW50IGFmdGVyIGEgc3VjY2Vzc2Z1bCBwYXNzd29yZCByZXNldC5cbmV4cG9ydCBjb25zdCBzZW5kUGFzc3dvcmRSZXNldFN1Y2Nlc3NFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSUF1dGhFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgYXdhaXQgc2VuZEF1dGhNYWlsKGRldGFpbHMuZW1haWwsIFwiUGFzc3dvcmQgUmVzZXRcIiwgKCkgPT5cbiAgICByZW5kZXJUZW1wbGF0ZShcInJlc2V0LXBhc3N3b3JkLXN1Y2Nlc3NcIiwge1xuICAgICAgbmFtZTogZGV0YWlscy5uYW1lLFxuICAgIH0pLFxuICApO1xufTsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXF1ZXN0SGFuZGxlciwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5leHBvcnQgY29uc3QgY2F0Y2hBc3luYyA9IChmbjogUmVxdWVzdEhhbmRsZXIpID0+IHtcbiAgcmV0dXJuIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmbihyZXEsIHJlcywgbmV4dCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIG5leHQoZXJyb3IpO1xuICAgIH1cbiAgfTtcbn07XG4iLCAiaW1wb3J0IHsgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG50eXBlIFRNZXRhID0ge1xuICBwYWdlOiBudW1iZXI7XG4gIGxpbWl0OiBudW1iZXI7XG4gIHRvdGFsOiBudW1iZXI7XG4gIHRvdGFsUGFnZXM6IG51bWJlcjtcbn07XG5cbnR5cGUgVFJlc3BvbnNlRGF0YTxUPiA9IHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgc3RhdHVzQ29kZTogbnVtYmVyO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGRhdGE6IFQ7XG4gIG1ldGE/OiBUTWV0YTtcbn07XG5cbmV4cG9ydCBjb25zdCBzZW5kUmVzcG9uc2UgPSA8VD4ocmVzOiBSZXNwb25zZSwgZGF0YTogVFJlc3BvbnNlRGF0YTxUPikgPT4ge1xuICByZXMuc3RhdHVzKGRhdGEuc3RhdHVzQ29kZSkuanNvbih7XG4gICAgc3VjY2VzczogZGF0YS5zdWNjZXNzLFxuICAgIG1lc3NhZ2U6IGRhdGEubWVzc2FnZSxcbiAgICBkYXRhOiBkYXRhLmRhdGEsXG4gICAgbWV0YTogZGF0YS5tZXRhLFxuICB9KTtcbn07XG4iLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCByZWdpc3RlclNjaGVtYSA9IHoub2JqZWN0KHtcbiAgbmFtZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOYW1lIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKSxcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpLFxuICBwYXNzd29yZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbig2LCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCg3MiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IG1vc3QgNzIgY2hhcmFjdGVyc1wiKSxcbiAgcGhvbmU6IHpcbiAgICAuc3RyaW5nKClcbiAgICAubWF4KDIwLCBcIlBob25lIG51bWJlciBpcyB0b28gbG9uZ1wiKVxuICAgIC5vcHRpb25hbCgpLFxuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBsb2dpblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpLFxuICBwYXNzd29yZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBnb29nbGVMb2dpblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWRUb2tlbjogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJHb29nbGUgaWRUb2tlbiBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBkZW1vTG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlLCB7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSByb2xlXCIsXG4gIH0pLFxufSk7XG5cbi8vIHJlZnJlc2hUb2tlbiBtYXkgY29tZSBmcm9tIHRoZSBodHRwT25seSBjb29raWUgT1IgdGhlIHJlcXVlc3QgYm9keSBcdTIwMTRcbi8vIHZhbGlkYXRpb24gaXMgbGVuaWVudCBoZXJlOyB0aGUgY29udHJvbGxlciBoYW5kbGVzIGJvdGggc291cmNlcy5cbmNvbnN0IHJlZnJlc2hUb2tlblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcmVmcmVzaFRva2VuOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IGVtYWlsU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5lbWFpbChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWxcIik7XG5cbmNvbnN0IG90cFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk9UUCBpcyByZXF1aXJlZFwiIH0pXG4gIC5sZW5ndGgoNiwgXCJPVFAgbXVzdCBiZSBleGFjdGx5IDYgZGlnaXRzXCIpXG4gIC5yZWdleCgvXlxcZHs2fSQvLCBcIk9UUCBtdXN0IGJlIGV4YWN0bHkgNiBkaWdpdHNcIik7XG5cbmNvbnN0IHZlcmlmeUVtYWlsU2NoZW1hID0gei5vYmplY3Qoe1xuICBlbWFpbDogZW1haWxTY2hlbWEsXG4gIG90cDogb3RwU2NoZW1hLFxufSk7XG5cbmNvbnN0IHJlc2VuZFZlcmlmaWNhdGlvblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IGVtYWlsU2NoZW1hLFxufSk7XG5cbmNvbnN0IGZvcmdvdFBhc3N3b3JkU2NoZW1hID0gei5vYmplY3Qoe1xuICBlbWFpbDogZW1haWxTY2hlbWEsXG59KTtcblxuY29uc3QgcmVzZXRQYXNzd29yZFNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IGVtYWlsU2NoZW1hLFxuICBvdHA6IG90cFNjaGVtYSxcbiAgbmV3UGFzc3dvcmQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTmV3IHBhc3N3b3JkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDYsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBsZWFzdCA2IGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDcyLCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbW9zdCA3MiBjaGFyYWN0ZXJzXCIpLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRSZWdpc3RlclNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHJlZ2lzdGVyU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRMb2dpblNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGxvZ2luU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRHb29nbGVMb2dpblNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGdvb2dsZUxvZ2luU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRSZWZyZXNoVG9rZW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZWZyZXNoVG9rZW5TY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFZlcmlmeUVtYWlsU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdmVyaWZ5RW1haWxTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFJlc2V0UGFzc3dvcmRTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZXNldFBhc3N3b3JkU2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IGF1dGhWYWxpZGF0aW9ucyA9IHtcbiAgcmVnaXN0ZXJTY2hlbWEsXG4gIGxvZ2luU2NoZW1hLFxuICBnb29nbGVMb2dpblNjaGVtYSxcbiAgZGVtb0xvZ2luU2NoZW1hLFxuICByZWZyZXNoVG9rZW5TY2hlbWEsXG4gIHZlcmlmeUVtYWlsU2NoZW1hLFxuICByZXNlbmRWZXJpZmljYXRpb25TY2hlbWEsXG4gIGZvcmdvdFBhc3N3b3JkU2NoZW1hLFxuICByZXNldFBhc3N3b3JkU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBab2RUeXBlIH0gZnJvbSBcInpvZFwiO1xuXG50eXBlIFZhbGlkYXRpb25TY2hlbWEgPSB7XG4gIGJvZHk/OiBab2RUeXBlO1xuICBxdWVyeT86IFpvZFR5cGU7XG4gIHBhcmFtcz86IFpvZFR5cGU7XG59O1xuXG4vLyBSdW5zIFpvZCBzY2hlbWFzIGFnYWluc3QgcmVxLmJvZHkvcXVlcnkvcGFyYW1zIGFuZCByZXBsYWNlcyB0aGUgcGFyc2VkXG4vLyB2YWx1ZXMgc28gZG93bnN0cmVhbSBoYW5kbGVycyB3b3JrIHdpdGggdmFsaWRhdGVkIChhbmQgdHlwZWQpIGRhdGEuXG4vLyBBbnkgWm9kRXJyb3IgdGhyb3duIGhlcmUgaXMgbWFwcGVkIHRvIGEgNDAwIGJ5IGdsb2JhbEVycm9ySGFuZGxlci5cbi8vXG4vLyByZXEuYm9keSBpcyBzYWZlbHkgd3JpdGFibGUsIGJ1dCBpbiBFeHByZXNzIDUgcmVxLnF1ZXJ5L3JlcS5wYXJhbXMgYXJlXG4vLyBnZXR0ZXItb25seSBcdTIwMTQgdGhleSBtdXN0IGJlIHJlZGVmaW5lZCB2aWEgZGVmaW5lUHJvcGVydHkgdG8gc3dhcCBpbiB0aGVcbi8vIHBhcnNlZCB2YWx1ZXMuXG5jb25zdCB2YWxpZGF0ZVJlcXVlc3QgPSAoc2NoZW1hOiBWYWxpZGF0aW9uU2NoZW1hKSA9PiB7XG4gIHJldHVybiAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBpZiAoc2NoZW1hLmJvZHkpIHtcbiAgICAgIHJlcS5ib2R5ID0gc2NoZW1hLmJvZHkucGFyc2UocmVxLmJvZHkpO1xuICAgIH1cbiAgICBpZiAoc2NoZW1hLnF1ZXJ5KSB7XG4gICAgICBjb25zdCBwYXJzZWRRdWVyeSA9IHNjaGVtYS5xdWVyeS5wYXJzZShyZXEucXVlcnkpO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHJlcSwgXCJxdWVyeVwiLCB7XG4gICAgICAgIHZhbHVlOiBwYXJzZWRRdWVyeSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoc2NoZW1hLnBhcmFtcykge1xuICAgICAgY29uc3QgcGFyc2VkUGFyYW1zID0gc2NoZW1hLnBhcmFtcy5wYXJzZShyZXEucGFyYW1zKTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXEsIFwicGFyYW1zXCIsIHtcbiAgICAgICAgdmFsdWU6IHBhcnNlZFBhcmFtcyxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIG5leHQoKTtcbiAgfTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHZhbGlkYXRlUmVxdWVzdDsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBKd3RQYXlsb2FkIH0gZnJvbSBcImpzb253ZWJ0b2tlblwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBqd3RVdGlscyB9IGZyb20gXCIuLi91dGlscy9qd3RcIjtcblxuLy8gYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSBcdTIxOTIgb25seSB0aG9zZSByb2xlcyBwYXNzXG4vLyBhdXRoKCkgXHUyMTkyIGFueSBhdXRoZW50aWNhdGVkIHVzZXIgcGFzc2VzXG5jb25zdCBhdXRoID0gKC4uLnJlcXVpcmVkUm9sZXM6IFJvbGVbXSkgPT4ge1xuICByZXR1cm4gY2F0Y2hBc3luYyhhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB0b2tlbiA9IHJlcS5jb29raWVzLmFjY2Vzc1Rva2VuXG4gICAgICA/IHJlcS5jb29raWVzLmFjY2Vzc1Rva2VuXG4gICAgICA6IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb24/LnN0YXJ0c1dpdGgoXCJCZWFyZXIgXCIpXG4gICAgICAgID8gcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbi5zcGxpdChcIiBcIilbMV1cbiAgICAgICAgOiByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuXG4gICAgLy8gMS4gdG9rZW4gbXVzdCBiZSBwcmVzZW50XG4gICAgaWYgKCF0b2tlbikge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDEsXG4gICAgICAgIFwiWW91IGFyZSBub3QgbG9nZ2VkIGluLiBQbGVhc2UgbG9naW4gdG8gY29udGludWUuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDIuIHZlcmlmeSB0aGUgYWNjZXNzIHRva2VuXG4gICAgY29uc3QgdmVyaWZpZWRUb2tlbiA9IGp3dFV0aWxzLnZlcmlmeVRva2VuKFxuICAgICAgdG9rZW4sXG4gICAgICBjb25maWcuand0X2FjY2Vzc19zZWNyZXQsXG4gICAgKTtcblxuICAgIGlmICghdmVyaWZpZWRUb2tlbi5zdWNjZXNzKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCB2ZXJpZmllZFRva2VuLmVycm9yKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGlkLCB0b2tlblZlcnNpb24gfSA9IHZlcmlmaWVkVG9rZW4uZGF0YSBhcyBKd3RQYXlsb2FkICYge1xuICAgICAgdG9rZW5WZXJzaW9uOiBudW1iZXI7XG4gICAgfTtcblxuICAgIC8vIDMuIHJlLWZldGNoIHVzZXIgdG8gZW5mb3JjZSBhY2NvdW50IHN0YXRlIG9uIGV2ZXJ5IHJlcXVlc3RcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgICB3aGVyZTogeyBpZCB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIlVzZXIgbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICBpZiAodXNlci5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAzLFxuICAgICAgICBcIlVzZXIgaXMgc3VzcGVuZGVkLiBQbGVhc2UgY29udGFjdCBzdXBwb3J0IHNlcnZpY2UuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDQuIHRva2VuVmVyc2lvbiBtdXN0IG1hdGNoIERCIChsb2dvdXQgLyBwYXNzd29yZCBjaGFuZ2Uga2lsbHMgb2xkIHRva2VucylcbiAgICBpZiAodXNlci50b2tlblZlcnNpb24gIT09IHRva2VuVmVyc2lvbikge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDEsXG4gICAgICAgIFwiU2Vzc2lvbiBpcyBubyBsb25nZXIgdmFsaWQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gNS4gYXV0aG9yaXphdGlvbiB1c2VzIHRoZSBEQiByb2xlLCBub3QgdGhlIChwb3NzaWJseSBzdGFsZSkgSldUIHJvbGVcbiAgICBpZiAocmVxdWlyZWRSb2xlcy5sZW5ndGggJiYgIXJlcXVpcmVkUm9sZXMuaW5jbHVkZXModXNlci5yb2xlKSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDMsXG4gICAgICAgIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBhY2Nlc3MgdGhpcyByb3V0ZS5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gNi4gYXR0YWNoIHRoZSBhdXRoZW50aWNhdGVkIHVzZXIgdG8gdGhlIHJlcXVlc3RcbiAgICByZXEudXNlciA9IHtcbiAgICAgIGlkOiB1c2VyLmlkLFxuICAgICAgbmFtZTogdXNlci5uYW1lLFxuICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICByb2xlOiB1c2VyLnJvbGUsXG4gICAgfTtcblxuICAgIG5leHQoKTtcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBhdXRoOyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgdXNlckNvbnRyb2xsZXIgfSBmcm9tIFwiLi91c2VyLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHVzZXJWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3VzZXIudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gT3duIHByb2ZpbGUgXHUyMDE0IGFueSBhdXRoZW50aWNhdGVkIHVzZXJcbnJvdXRlci5wYXRjaChcbiAgXCIvcHJvZmlsZVwiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHVzZXJWYWxpZGF0aW9ucy51cGRhdGVQcm9maWxlU2NoZW1hIH0pLFxuICB1c2VyQ29udHJvbGxlci51cGRhdGVQcm9maWxlLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IGxpc3QgdXNlcnMgd2l0aCBmaWx0ZXJzICsgcGFnaW5hdGlvblxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiB1c2VyVmFsaWRhdGlvbnMudXNlclF1ZXJ5U2NoZW1hIH0pLFxuICB1c2VyQ29udHJvbGxlci5nZXRVc2Vycyxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCByb2xlIG1hbmFnZW1lbnRcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3JvbGVcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHVzZXJWYWxpZGF0aW9ucy51c2VyUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHVzZXJWYWxpZGF0aW9ucy5jaGFuZ2VSb2xlU2NoZW1hLFxuICB9KSxcbiAgdXNlckNvbnRyb2xsZXIuY2hhbmdlUm9sZSxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBzdGF0dXMgbWFuYWdlbWVudFxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiB1c2VyVmFsaWRhdGlvbnMudXNlclBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiB1c2VyVmFsaWRhdGlvbnMuY2hhbmdlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgdXNlckNvbnRyb2xsZXIuY2hhbmdlU3RhdHVzLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IHNvZnQgZGVsZXRlXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiB1c2VyVmFsaWRhdGlvbnMudXNlclBhcmFtc1NjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIuZGVsZXRlVXNlcixcbik7XG5cbmV4cG9ydCBjb25zdCB1c2VyUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgdXNlclNlcnZpY2UgfSBmcm9tIFwiLi91c2VyLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyBVcGRhdGUgcHJvZmlsZSBjb250cm9sbGVyXG5jb25zdCB1cGRhdGVQcm9maWxlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS51cGRhdGVQcm9maWxlKHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlByb2ZpbGUgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR2V0IGFsbCB1c2VycyAoYWRtaW4pXG5jb25zdCBnZXRVc2VycyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHVzZXJTZXJ2aWNlLmdldFVzZXJzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlcnMgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gVXBkYXRlIHVzZXIgcm9sZSAoYWRtaW4pXG5jb25zdCBjaGFuZ2VSb2xlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICAvLyBhbiBhZG1pbiBtdXN0IG5vdCBkb3duZ3JhZGUvY2hhbmdlIHRoZWlyIG93biByb2xlXG4gICAgaWYgKGlkID09PSByZXEudXNlcj8uaWQpIHtcbiAgICAgIHJldHVybiBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkZPUkJJRERFTixcbiAgICAgICAgbWVzc2FnZTogXCJZb3UgY2Fubm90IGNoYW5nZSB5b3VyIG93biByb2xlLlwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHVzZXJTZXJ2aWNlLmNoYW5nZVJvbGUoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIHJvbGUgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gVXBkYXRlIHVzZXIgc3RhdHVzIChhZG1pbilcbmNvbnN0IGNoYW5nZVN0YXR1cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgLy8gYW4gYWRtaW4gbXVzdCBub3Qgc3VzcGVuZC9hY3RpdmF0ZSB0aGVpciBvd24gYWNjb3VudFxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBjaGFuZ2UgeW91ciBvd24gc3RhdHVzLlwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHVzZXJTZXJ2aWNlLmNoYW5nZVN0YXR1cyhpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFNvZnQgZGVsZXRlIHVzZXIgKGFkbWluKVxuY29uc3QgZGVsZXRlVXNlciA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgLy8gYW4gYWRtaW4gbXVzdCBub3QgZGVsZXRlIHRoZWlyIG93biBhY2NvdW50XG4gICAgaWYgKGlkID09PSByZXEudXNlcj8uaWQpIHtcbiAgICAgIHJldHVybiBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkZPUkJJRERFTixcbiAgICAgICAgbWVzc2FnZTogXCJZb3UgY2Fubm90IGRlbGV0ZSB5b3VyIG93biBhY2NvdW50LlwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHVzZXJTZXJ2aWNlLmRlbGV0ZVVzZXIoaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHVzZXJDb250cm9sbGVyID0ge1xuICB1cGRhdGVQcm9maWxlLFxuICBnZXRVc2VycyxcbiAgY2hhbmdlUm9sZSxcbiAgY2hhbmdlU3RhdHVzLFxuICBkZWxldGVVc2VyLFxufTsiLCAiaW1wb3J0IGJjcnlwdCBmcm9tIFwiYmNyeXB0anNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IFJvbGUsIFVzZXJTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHtcbiAgSUNoYW5nZVJvbGUsXG4gIElDaGFuZ2VTdGF0dXMsXG4gIElVcGRhdGVQcm9maWxlLFxuICBJVXNlclF1ZXJ5LFxufSBmcm9tIFwiLi91c2VyLmludGVyZmFjZVwiO1xuXG5jb25zdCB2YWxpZGF0ZUFjdGl2ZVVzZXIgPSBhc3luYyAoaWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG5cbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuICBpZiAodXNlci5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIlVzZXIgaXMgc3VzcGVuZGVkLiBQbGVhc2UgY29udGFjdCBzdXBwb3J0IHNlcnZpY2UuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgVXBkYXRlIHByb2ZpbGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCB1cGRhdGVQcm9maWxlID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBJVXBkYXRlUHJvZmlsZSkgPT4ge1xuICBjb25zdCB7IG5hbWUsIHBob25lLCBhdmF0YXJVcmwsIGN1cnJlbnRQYXNzd29yZCwgbmV3UGFzc3dvcmQgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWVPclRocm93KHsgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9IH0pO1xuXG4gIGlmICh1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLmF1dGhQcm92aWRlciA9PT0gXCJHT09HTEVcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMyxcbiAgICAgIFwiR29vZ2xlIGFjY291bnRzIGNhbm5vdCBjaGFuZ2UgcGFzc3dvcmQuIFVzZSBHb29nbGUgc2lnbi1pbiB0byBtYW5hZ2UgeW91ciBwcm9maWxlLlwiLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBkYXRhOiBQcmlzbWEuVXNlclVwZGF0ZUlucHV0ID0ge307XG5cbiAgaWYgKG5hbWUpIGRhdGEubmFtZSA9IG5hbWU7XG4gIGlmIChwaG9uZSkgZGF0YS5waG9uZSA9IHBob25lO1xuICBpZiAoYXZhdGFyVXJsKSBkYXRhLmF2YXRhclVybCA9IGF2YXRhclVybDtcblxuICAvLyBQYXNzd29yZCBjaGFuZ2UgcmVxdWlyZXMgY3VycmVudFBhc3N3b3JkICsgbmV3UGFzc3dvcmRcbiAgaWYgKG5ld1Bhc3N3b3JkKSB7XG4gICAgaWYgKCFjdXJyZW50UGFzc3dvcmQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiQ3VycmVudCBwYXNzd29yZCBpcyByZXF1aXJlZFwiKTtcbiAgICB9XG4gICAgaWYgKGN1cnJlbnRQYXNzd29yZCA9PT0gbmV3UGFzc3dvcmQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiTmV3IHBhc3N3b3JkIG11c3QgYmUgZGlmZmVyZW50XCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGlzTWF0Y2ggPSBhd2FpdCBiY3J5cHQuY29tcGFyZShjdXJyZW50UGFzc3dvcmQsIHVzZXIucGFzc3dvcmQgfHwgXCJcIik7XG4gICAgaWYgKCFpc01hdGNoKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgY3VycmVudCBwYXNzd29yZFwiKTtcbiAgICB9XG5cbiAgICBkYXRhLnBhc3N3b3JkID0gYXdhaXQgYmNyeXB0Lmhhc2goXG4gICAgICBuZXdQYXNzd29yZCxcbiAgICAgIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSxcbiAgICApO1xuICAgIGRhdGEudG9rZW5WZXJzaW9uID0geyBpbmNyZW1lbnQ6IDEgfTtcbiAgfVxuXG4gIGNvbnN0IHVwZGF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgZGF0YSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB1cGRhdGVkVXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogbGlzdCB1c2VycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldFVzZXJzID0gYXN5bmMgKHF1ZXJ5OiBJVXNlclF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlIHx8IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgfHwgMTA7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Vc2VyV2hlcmVJbnB1dCA9IHtcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICB9O1xuXG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICB3aGVyZS5PUiA9IFtcbiAgICAgIHsgbmFtZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgeyBlbWFpbDogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgIF07XG4gIH1cbiAgaWYgKHF1ZXJ5LnJvbGUpIHdoZXJlLnJvbGUgPSBxdWVyeS5yb2xlO1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG5cbiAgY29uc3QgW3VzZXJzLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnVzZXIuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBza2lwOiAocGFnZSAtIDEpICogbGltaXQsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICAgIH0pLFxuICAgIHByaXNtYS51c2VyLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogdXNlcnMsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogdXBkYXRlIHJvbGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBjaGFuZ2VSb2xlID0gYXN5bmMgKGlkOiBzdHJpbmcsIHBheWxvYWQ6IElDaGFuZ2VSb2xlKSA9PiB7XG4gIGNvbnN0IHsgcm9sZSB9ID0gcGF5bG9hZDtcblxuICBhd2FpdCB2YWxpZGF0ZUFjdGl2ZVVzZXIoaWQpO1xuXG4gIGNvbnN0IHVwZGF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGRhdGE6IHsgcm9sZSwgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gdXBkYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IHVwZGF0ZSBzdGF0dXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBjaGFuZ2VTdGF0dXMgPSBhc3luYyAoaWQ6IHN0cmluZywgcGF5bG9hZDogSUNoYW5nZVN0YXR1cykgPT4ge1xuICBjb25zdCB7IHN0YXR1cyB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7XG4gICAgICBzdGF0dXMsXG4gICAgICAvLyByZWFjdGl2YXRpbmcgcHJlc2VydmVzIHRoZSBhY2NvdW50IHdoaWxlIHN1c3BlbmRpbmcgcmV2b2tlcyBhbGwgc2Vzc2lvbnNcbiAgICAgIC4uLihzdGF0dXMgPT09IFVzZXJTdGF0dXMuU1VTUEVOREVEICYmIHsgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0pLFxuICAgIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gdXBkYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IHNvZnQgZGVsZXRlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZGVsZXRlVXNlciA9IGFzeW5jIChpZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuXG4gIGNvbnN0IGRlbGV0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlLCB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiBkZWxldGVkVXNlcjtcbn07XG5cbmV4cG9ydCBjb25zdCB1c2VyU2VydmljZSA9IHtcbiAgdXBkYXRlUHJvZmlsZSxcbiAgZ2V0VXNlcnMsXG4gIGNoYW5nZVJvbGUsXG4gIGNoYW5nZVN0YXR1cyxcbiAgZGVsZXRlVXNlcixcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBSb2xlLCBVc2VyU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcblxuY29uc3QgdXBkYXRlUHJvZmlsZVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgbmFtZTogelxuICAgICAgLnN0cmluZygpXG4gICAgICAudHJpbSgpXG4gICAgICAubWluKDIsIFwiTmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAgICAgLm1heCgxMDAsIFwiTmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICAgIHBob25lOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC50cmltKClcbiAgICAgIC5tYXgoMjAsIFwiUGhvbmUgbnVtYmVyIGlzIHRvbyBsb25nXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgICBhdmF0YXJVcmw6IHouc3RyaW5nKCkudHJpbSgpLnVybChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgaW1hZ2UgVVJMXCIpLm9wdGlvbmFsKCksXG4gICAgY3VycmVudFBhc3N3b3JkOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxuICAgIG5ld1Bhc3N3b3JkOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC5taW4oNiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IGxlYXN0IDYgY2hhcmFjdGVyc1wiKVxuICAgICAgLm1heCg3MiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IG1vc3QgNzIgY2hhcmFjdGVyc1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5yZWZpbmUoXG4gICAgKGRhdGEpID0+XG4gICAgICBkYXRhLm5ld1Bhc3N3b3JkID09PSB1bmRlZmluZWQgfHxcbiAgICAgIGRhdGEuY3VycmVudFBhc3N3b3JkICE9PSB1bmRlZmluZWQsXG4gICAgeyBtZXNzYWdlOiBcIkN1cnJlbnQgcGFzc3dvcmQgaXMgcmVxdWlyZWQgdG8gY2hhbmdlIHBhc3N3b3JkXCIgfSxcbiAgKTtcblxuY29uc3QgdXNlclF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm9wdGlvbmFsKCksXG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlKS5vcHRpb25hbCgpLFxuICBzdGF0dXM6IHoubmF0aXZlRW51bShVc2VyU3RhdHVzKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IHVzZXJQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlVzZXIgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgY2hhbmdlUm9sZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUsIHsgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSByb2xlXCIgfSksXG59KTtcblxuY29uc3QgY2hhbmdlU3RhdHVzU2NoZW1hID0gei5vYmplY3Qoe1xuICBzdGF0dXM6IHoubmF0aXZlRW51bShVc2VyU3RhdHVzLCB7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSBzdGF0dXNcIixcbiAgfSksXG59KTtcblxuZXhwb3J0IHR5cGUgVFVwZGF0ZVByb2ZpbGVTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiB1cGRhdGVQcm9maWxlU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRVc2VyUXVlcnlTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiB1c2VyUXVlcnlTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgdXNlclZhbGlkYXRpb25zID0ge1xuICB1cGRhdGVQcm9maWxlU2NoZW1hLFxuICB1c2VyUXVlcnlTY2hlbWEsXG4gIHVzZXJQYXJhbXNTY2hlbWEsXG4gIGNoYW5nZVJvbGVTY2hlbWEsXG4gIGNoYW5nZVN0YXR1c1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgbXVsdGVyIGZyb20gXCJtdWx0ZXJcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHsgdXBsb2Fkc0NvbnRyb2xsZXIgfSBmcm9tIFwiLi91cGxvYWRzLmNvbnRyb2xsZXJcIjtcblxuY29uc3QgdXBsb2FkID0gbXVsdGVyKHtcbiAgc3RvcmFnZTogbXVsdGVyLm1lbW9yeVN0b3JhZ2UoKSxcbiAgbGltaXRzOiB7IGZpbGVTaXplOiA1ICogMTAyNCAqIDEwMjQgfSxcbiAgZmlsZUZpbHRlcjogKF9yZXEsIGZpbGUsIGNiKSA9PiB7XG4gICAgaWYgKC9eaW1hZ2VcXC8oanBlZ3xwbmd8d2VicCkkLy50ZXN0KGZpbGUubWltZXR5cGUpKSB7XG4gICAgICBjYihudWxsLCB0cnVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2IoXG4gICAgICAgIE9iamVjdC5hc3NpZ24obmV3IEVycm9yKFwiT25seSBqcGcsIHBuZyBvciB3ZWJwIGltYWdlcyBhcmUgYWxsb3dlZFwiKSwge1xuICAgICAgICAgIGNvZGU6IFwiSU5WQUxJRF9GSUxFX1RZUEVcIixcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cbiAgfSxcbn0pO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL2ltYWdlXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHVwbG9hZC5zaW5nbGUoXCJpbWFnZVwiKSxcbiAgdXBsb2Fkc0NvbnRyb2xsZXIudXBsb2FkSW1hZ2UsXG4pO1xuXG5leHBvcnQgY29uc3QgdXBsb2FkUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgdXBsb2FkSW1hZ2VUb0Nsb3VkaW5hcnkgfSBmcm9tIFwiLi91cGxvYWRzLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuLy8gVXBsb2FkIGEgc2luZ2xlIGltYWdlIChBR0VOVC9BRE1JTikgXHUyMTkyIENsb3VkaW5hcnlcbmNvbnN0IHVwbG9hZEltYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgaWYgKCFyZXEuZmlsZSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbWFnZSBmaWxlIGlzIHJlcXVpcmVkXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5KHJlcS5maWxlKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIkltYWdlIHVwbG9hZGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCB1cGxvYWRzQ29udHJvbGxlciA9IHtcbiAgdXBsb2FkSW1hZ2UsXG59OyIsICJpbXBvcnQgeyB2MiBhcyBjbG91ZGluYXJ5IH0gZnJvbSBcImNsb3VkaW5hcnlcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG5jbG91ZGluYXJ5LmNvbmZpZyh7XG4gIGNsb3VkX25hbWU6IGNvbmZpZy5jbG91ZGluYXJ5X2Nsb3VkX25hbWUsXG4gIGFwaV9rZXk6IGNvbmZpZy5jbG91ZGluYXJ5X2FwaV9rZXksXG4gIGFwaV9zZWNyZXQ6IGNvbmZpZy5jbG91ZGluYXJ5X2FwaV9zZWNyZXQsXG59KTtcblxuZXhwb3J0IGRlZmF1bHQgY2xvdWRpbmFyeTsiLCAiaW1wb3J0IGNsb3VkaW5hcnkgZnJvbSBcIi4uLy4uL2xpYi9jbG91ZGluYXJ5XCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuXG5leHBvcnQgY29uc3QgdXBsb2FkSW1hZ2VUb0Nsb3VkaW5hcnkgPSAoXG4gIGZpbGU6IEV4cHJlc3MuTXVsdGVyLkZpbGUsXG4pOiBQcm9taXNlPHsgdXJsOiBzdHJpbmc7IHB1YmxpY0lkOiBzdHJpbmcgfT4gPT4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHVwbG9hZFN0cmVhbSA9IGNsb3VkaW5hcnkudXBsb2FkZXIudXBsb2FkX3N0cmVhbShcbiAgICAgIHsgZm9sZGVyOiBcInRyaXB2ZXJzZVwiIH0sXG4gICAgICAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IgfHwgIXJlc3VsdCkge1xuICAgICAgICAgIHJlamVjdChuZXcgQXBwRXJyb3IoNDAwLCBcIkltYWdlIHVwbG9hZCBmYWlsZWQuIFBsZWFzZSB0cnkgYWdhaW4uXCIpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmVzb2x2ZSh7IHVybDogcmVzdWx0LnNlY3VyZV91cmwsIHB1YmxpY0lkOiByZXN1bHQucHVibGljX2lkIH0pO1xuICAgICAgfSxcbiAgICApO1xuXG4gICAgdXBsb2FkU3RyZWFtLmVuZChmaWxlLmJ1ZmZlcik7XG4gIH0pO1xufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGNvbnRhY3RDb250cm9sbGVyIH0gZnJvbSBcIi4vY29udGFjdC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBjb250YWN0VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9jb250YWN0LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIENyZWF0ZSBjb250YWN0IG1lc3NhZ2Ugcm91dGUgKHB1YmxpYywgbm8gYXV0aClcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogY29udGFjdFZhbGlkYXRpb25zLmNyZWF0ZU1lc3NhZ2VTY2hlbWEgfSksXG4gIGNvbnRhY3RDb250cm9sbGVyLmNyZWF0ZU1lc3NhZ2UsXG4pO1xuXG4vLyAyLiBMaXN0IGNvbnRhY3QgbWVzc2FnZXMgcm91dGUgKGFkbWluIG9ubHkpXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGNvbnRhY3RWYWxpZGF0aW9ucy5jb250YWN0UXVlcnlTY2hlbWEgfSksXG4gIGNvbnRhY3RDb250cm9sbGVyLmdldE1lc3NhZ2VzLFxuKTtcblxuLy8gMy4gTWFyayByZXNvbHZlZC91bnJlc29sdmVkIHJvdXRlIChhZG1pbiBvbmx5KVxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGNvbnRhY3RWYWxpZGF0aW9ucy5jb250YWN0UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGNvbnRhY3RWYWxpZGF0aW9ucy51cGRhdGVSZXNvbHZlZFNjaGVtYSxcbiAgfSksXG4gIGNvbnRhY3RDb250cm9sbGVyLnVwZGF0ZVJlc29sdmVkLFxuKTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBjb250YWN0U2VydmljZSB9IGZyb20gXCIuL2NvbnRhY3Quc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBjb250YWN0IG1lc3NhZ2UgY29udHJvbGxlciAocHVibGljKVxuY29uc3QgY3JlYXRlTWVzc2FnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhd2FpdCBjb250YWN0U2VydmljZS5jcmVhdGVNZXNzYWdlKHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIk1lc3NhZ2Ugc2VudCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBtZXNzYWdlLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIGNvbnRyb2xsZXIgKGFkbWluIG9ubHkpXG5jb25zdCBnZXRNZXNzYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbnRhY3RTZXJ2aWNlLmxpc3RNZXNzYWdlcyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNvbnRhY3QgbWVzc2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBNYXJrIHJlc29sdmVkL3VucmVzb2x2ZWQgY29udHJvbGxlciAoYWRtaW4gb25seSlcbmNvbnN0IHVwZGF0ZVJlc29sdmVkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgeyBpc1Jlc29sdmVkIH0gPSByZXEuYm9keTtcblxuICAgIGNvbnN0IG1lc3NhZ2UgPSBhd2FpdCBjb250YWN0U2VydmljZS5yZXNvbHZlTWVzc2FnZShpZCwgaXNSZXNvbHZlZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiTWVzc2FnZSBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBtZXNzYWdlLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RDb250cm9sbGVyID0ge1xuICBjcmVhdGVNZXNzYWdlLFxuICBnZXRNZXNzYWdlcyxcbiAgdXBkYXRlUmVzb2x2ZWQsXG59OyIsICJpbXBvcnQgeyBSZXNlbmQgfSBmcm9tIFwicmVzZW5kXCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIElDb250YWN0RW1haWxEZXRhaWxzIHtcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICBzdWJqZWN0OiBzdHJpbmc7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgY3JlYXRlZEF0PzogRGF0ZTtcbn1cblxuLy8gTGF6aWx5IGluaXRpYWxpc2VkIHNvIHRoZSBtb2R1bGUgaXMgaW1wb3J0YWJsZSBldmVuIHdoZW4gUkVTRU5EX0FQSV9LRVlcbi8vIGlzIG5vdCBjb25maWd1cmVkIChlLmcuIGxvY2FsIGRldiAvIGRlbW8gd2l0aG91dCBlbWFpbCkuXG5sZXQgcmVzZW5kOiBSZXNlbmQgfCBudWxsID0gbnVsbDtcblxuZnVuY3Rpb24gZ2V0UmVzZW5kKCk6IFJlc2VuZCB8IG51bGwge1xuICBpZiAocmVzZW5kKSByZXR1cm4gcmVzZW5kO1xuICBpZiAoIWNvbmZpZy5yZXNlbmRfYXBpX2tleSkgcmV0dXJuIG51bGw7XG4gIHJlc2VuZCA9IG5ldyBSZXNlbmQoY29uZmlnLnJlc2VuZF9hcGlfa2V5KTtcbiAgcmV0dXJuIHJlc2VuZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZUh0bWwodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcbiAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIilcbiAgICAucmVwbGFjZSgvXCIvZywgXCImcXVvdDtcIilcbiAgICAucmVwbGFjZSgvJy9nLCBcIiYjMDM5O1wiKTtcbn1cblxuLy8gV3JhcHMgYSBSZXNlbmQgc2VuZCBzbyBmYWlsdXJlcyBiZWNvbWUgYSBzaW5nbGUgY2xlYW4gd2FybmluZyBsaW5lIGluc3RlYWRcbi8vIG9mIHRoZSBTREsncyBub2lzeSBtdWx0aS1saW5lIGVycm9yLiBSZXNlbmQgY2FuIGxlZ2l0aW1hdGVseSByZWplY3Qgc2VuZHNcbi8vIChlLmcuIHRoZSBkZWZhdWx0IG9uYm9hcmRpbmdAcmVzZW5kLmRldiBzZW5kZXIgbWF5IG9ubHkgZGVsaXZlciB0byB0aGVcbi8vIGFjY291bnQgb3duZXIpLCBzbyBlbWFpbHMgYXJlIHN0cmljdGx5IGJlc3QtZWZmb3J0LlxuYXN5bmMgZnVuY3Rpb24gc2VuZFdpdGhMb2coXG4gIGNsaWVudDogUmVzZW5kLFxuICBzdWJqZWN0OiBzdHJpbmcsXG4gIHRvOiBzdHJpbmdbXSxcbiAgaHRtbDogc3RyaW5nLFxuICByZXBseVRvPzogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgY2xpZW50LmVtYWlscy5zZW5kKHtcbiAgICAgIGZyb206IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCIsXG4gICAgICB0byxcbiAgICAgIHN1YmplY3QsXG4gICAgICBodG1sLFxuICAgICAgLi4uKHJlcGx5VG8gPyB7IHJlcGx5VG8gfSA6IHt9KSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zdCBkZXRhaWwgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgY29uc29sZS53YXJuKGBbZW1haWxdIHNlbmQgZmFpbGVkICgke3N1YmplY3R9KSB0byAke3RvLmpvaW4oXCIsIFwiKX06ICR7ZGV0YWlsfWApO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBlbWFpbExheW91dCA9IChjb250ZW50OiBzdHJpbmcpID0+IGBcbiAgPGRpdiBzdHlsZT1cImZvbnQtZmFtaWx5OiBBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmOyBtYXgtd2lkdGg6IDU2MHB4OyBtYXJnaW46IDAgYXV0bzsgY29sb3I6ICMxYTFhMWE7XCI+XG4gICAgPGRpdiBzdHlsZT1cImJhY2tncm91bmQ6ICMwZjc2NmU7IHBhZGRpbmc6IDI0cHg7IGJvcmRlci1yYWRpdXM6IDhweCA4cHggMCAwO1wiPlxuICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjogI2ZmZmZmZjsgZm9udC1zaXplOiAxOHB4OyBmb250LXdlaWdodDogYm9sZDtcIj5UcmlwVmVyc2U8L3NwYW4+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBzdHlsZT1cImJvcmRlcjogMXB4IHNvbGlkICNlNWU3ZWI7IGJvcmRlci10b3A6IG5vbmU7IHBhZGRpbmc6IDMycHg7IGJvcmRlci1yYWRpdXM6IDAgMCA4cHggOHB4O1wiPlxuICAgICAgJHtjb250ZW50fVxuICAgIDwvZGl2PlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxMnB4OyBjb2xvcjogIzZiNzI4MDsgbWFyZ2luLXRvcDogMTZweDsgdGV4dC1hbGlnbjogY2VudGVyO1wiPlxuICAgICAgWW91IGFyZSByZWNlaXZpbmcgdGhpcyBlbWFpbCBiZWNhdXNlIG9mIGFjdGl2aXR5IG9uIFRyaXBWZXJzZS5cbiAgICA8L3A+XG4gIDwvZGl2PlxuYDtcblxuLy8gTm90aWZpZXMgdGhlIHN1cHBvcnQgaW5ib3ggYWJvdXQgYSBuZXcgY29udGFjdCBmb3JtIHN1Ym1pc3Npb24uXG5leHBvcnQgY29uc3Qgc2VuZENvbnRhY3ROb3RpZmljYXRpb24gPSBhc3luYyAoXG4gIGRldGFpbHM6IElDb250YWN0RW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhY29uZmlnLmNvbnRhY3RfcmVjZWl2ZXJfZW1haWwpIHtcbiAgICBjb25zb2xlLndhcm4oXCJbZW1haWxdIFJlc2VuZCBub3QgY29uZmlndXJlZDsgc2tpcHBpbmcgY29udGFjdCBub3RpZmljYXRpb24uXCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGNyZWF0ZWRBdCA9IGRldGFpbHMuY3JlYXRlZEF0Py50b0lTT1N0cmluZygpID8/IFwianVzdCBub3dcIjtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5OZXcgY29udGFjdCBtZXNzYWdlPC9oMj5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5OYW1lPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPkVtYWlsPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGRldGFpbHMuZW1haWwpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+U3ViamVjdDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGRldGFpbHMuc3ViamVjdCl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWNlaXZlZDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChjcmVhdGVkQXQpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgIDwvdGFibGU+XG4gICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6IDE2cHg7IHBhZGRpbmc6IDE2cHg7IGJhY2tncm91bmQ6ICNmOWZhZmI7IGJvcmRlci1yYWRpdXM6IDZweDsgd2hpdGUtc3BhY2U6IHByZS13cmFwO1wiPlxuICAgICAgJHtlc2NhcGVIdG1sKGRldGFpbHMubWVzc2FnZSl9XG4gICAgPC9kaXY+XG4gIGA7XG5cbiAgYXdhaXQgc2VuZFdpdGhMb2coXG4gICAgY2xpZW50LFxuICAgIGBOZXcgY29udGFjdCBtZXNzYWdlOiAke2RldGFpbHMuc3ViamVjdH1gLFxuICAgIFtjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbF0sXG4gICAgZW1haWxMYXlvdXQoY29udGVudCksXG4gICk7XG59O1xuXG4vLyBTZW5kcyBhIGNvbmZpcm1hdGlvbiByZXBseSB0byB0aGUgcGVyc29uIHdobyBzdWJtaXR0ZWQgdGhlIGZvcm0uXG5leHBvcnQgY29uc3Qgc2VuZENvbnRhY3RBdXRvUmVwbHkgPSBhc3luYyAoXG4gIGRldGFpbHM6IElDb250YWN0RW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhZGV0YWlscy5lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBjb250YWN0IGF1dG8tcmVwbHkuXCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHJlY2VpdmVyRW1haWwgPSBjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbDtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5UaGFua3MgZm9yIHJlYWNoaW5nIG91dCwgJHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9ITwvaDI+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDE0cHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjMzc0MTUxO1wiPlxuICAgICAgV2UmYXBvczt2ZSByZWNlaXZlZCB5b3VyIG1lc3NhZ2UgYWJvdXRcbiAgICAgIDxzdHJvbmc+JmxkcXVvOyR7ZXNjYXBlSHRtbChkZXRhaWxzLnN1YmplY3QpfSZyZHF1bzs8L3N0cm9uZz4gYW5kIG91ciBzdXBwb3J0XG4gICAgICB0ZWFtIHdpbGwgZ2V0IGJhY2sgdG8geW91IHdpdGhpbiBvbmUgYnVzaW5lc3MgZGF5LlxuICAgIDwvcD5cbiAgYDtcblxuICBhd2FpdCBzZW5kV2l0aExvZyhcbiAgICBjbGllbnQsXG4gICAgXCJXZSByZWNlaXZlZCB5b3VyIG1lc3NhZ2UgLSBUcmlwVmVyc2VcIixcbiAgICBbZGV0YWlscy5lbWFpbF0sXG4gICAgZW1haWxMYXlvdXQoY29udGVudCksXG4gICAgcmVjZWl2ZXJFbWFpbCxcbiAgKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBCb29raW5nIGVtYWlscyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBpbnRlcmZhY2UgSUJvb2tpbmdFbWFpbERldGFpbHMge1xuICBlbWFpbDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHBhY2thZ2VUaXRsZTogc3RyaW5nO1xuICB0cmF2ZWxEYXRlOiBEYXRlO1xuICB0cmF2ZWxlcnM6IG51bWJlcjtcbiAgdG90YWxQcmljZTogbnVtYmVyO1xuICBzdGF0dXM6IEJvb2tpbmdTdGF0dXM7XG59XG5cbi8vIEluZm9ybXMgdGhlIGN1c3RvbWVyIGFib3V0IGEgYm9va2luZyBjcmVhdGUvY29uZmlybS9jYW5jZWwuXG4vLyBCZXN0LWVmZm9ydCBsaWtlIHRoZSBjb250YWN0IGVtYWlscyBcdTIwMTQgYSBmYWlsdXJlIG11c3QgbmV2ZXIgZmFpbCB0aGUgcmVxdWVzdC5cbmV4cG9ydCBjb25zdCBzZW5kQm9va2luZ0VtYWlsID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQm9va2luZ0VtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zdCBjbGllbnQgPSBnZXRSZXNlbmQoKTtcbiAgaWYgKCFjbGllbnQgfHwgIWRldGFpbHMuZW1haWwpIHtcbiAgICBjb25zb2xlLndhcm4oXCJbZW1haWxdIFJlc2VuZCBub3QgY29uZmlndXJlZDsgc2tpcHBpbmcgYm9va2luZyBlbWFpbC5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgdHJhdmVsRGF0ZSA9IGRldGFpbHMudHJhdmVsRGF0ZS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKTtcblxuICBjb25zdCBzdGF0dXNDb3B5OiBSZWNvcmQ8XG4gICAgQm9va2luZ1N0YXR1cyxcbiAgICB7IHN1YmplY3Q6IHN0cmluZzsgaGVhZGluZzogc3RyaW5nOyBib2R5OiBzdHJpbmcgfVxuICA+ID0ge1xuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgcmVjZWl2ZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyByZWNlaXZlZFwiLFxuICAgICAgYm9keTogXCJXZSd2ZSByZWNlaXZlZCB5b3VyIGJvb2tpbmcgcmVxdWVzdC4gVGhlIGFnZW50IHdpbGwgY29uZmlybSBpdCBzaG9ydGx5LlwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuUEFJRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiUGF5bWVudCByZWNlaXZlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJQYXltZW50IHJlY2VpdmVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgcGF5bWVudCBoYXMgYmVlbiByZWNlaXZlZCwgYW5kIHRoZSBhZ2VudCB3aWxsIGNvbmZpcm0geW91ciBib29raW5nIHNob3J0bHkuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgY29uZmlybWVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIkJvb2tpbmcgY29uZmlybWVkXCIsXG4gICAgICBib2R5OiBcIkdyZWF0IG5ld3MgXHUyMDE0IHlvdXIgYm9va2luZyBoYXMgYmVlbiBjb25maXJtZWQuIFdlIGxvb2sgZm9yd2FyZCB0byBob3N0aW5nIHlvdSFcIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyBjYW5jZWxsZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyBjYW5jZWxsZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciBib29raW5nIGhhcyBiZWVuIGNhbmNlbGxlZC4gSWYgdGhpcyB3YXNuJ3QgZXhwZWN0ZWQsIHBsZWFzZSBjb250YWN0IHN1cHBvcnQuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DT01QTEVURURdOiB7XG4gICAgICBzdWJqZWN0OiBcIlRyaXAgY29tcGxldGVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIlRyaXAgY29tcGxldGVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgdHJpcCBoYXMgYmVlbiBtYXJrZWQgYXMgY29tcGxldGVkLiBUaGFuayB5b3UgZm9yIHRyYXZlbGxpbmcgd2l0aCBUcmlwVmVyc2UhXCIsXG4gICAgfSxcbiAgfTtcblxuICBjb25zdCBjb3B5ID0gc3RhdHVzQ29weVtkZXRhaWxzLnN0YXR1c107XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+JHtjb3B5LmhlYWRpbmd9PC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBIaSAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0sPGJyLz5cbiAgICAgICR7Y29weS5ib2R5fVxuICAgIDwvcD5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5QYWNrYWdlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5wYWNrYWdlVGl0bGUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VHJhdmVsIGRhdGU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwodHJhdmVsRGF0ZSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWxlcnM8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoU3RyaW5nKGRldGFpbHMudHJhdmVsZXJzKSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5Ub3RhbDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChkZXRhaWxzLnRvdGFsUHJpY2UudG9GaXhlZCgyKSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgPC90YWJsZT5cbiAgYDtcblxuICBhd2FpdCBzZW5kV2l0aExvZyhcbiAgICBjbGllbnQsXG4gICAgY29weS5zdWJqZWN0LFxuICAgIFtkZXRhaWxzLmVtYWlsXSxcbiAgICBlbWFpbExheW91dChjb250ZW50KSxcbiAgKTtcbn07XG5cbi8vIEluZm9ybXMgdGhlIGN1c3RvbWVyIHRoYXQgYSBwYWlkIGJvb2tpbmcgd2FzIGNhbmNlbGxlZCBhbmQgdGhlIHBheW1lbnQgaGFzXG4vLyBiZWVuIHJlZnVuZGVkLiBCZXN0LWVmZm9ydCBsaWtlIHRoZSBvdGhlciBlbWFpbHMuXG5leHBvcnQgaW50ZXJmYWNlIElSZWZ1bmRFbWFpbERldGFpbHMge1xuICBlbWFpbDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHBhY2thZ2VUaXRsZTogc3RyaW5nO1xuICB0cmF2ZWxEYXRlOiBEYXRlO1xuICBhbW91bnQ6IG51bWJlcjtcbiAgcmVmdW5kUmVmSWQ/OiBzdHJpbmcgfCBudWxsO1xufVxuXG5leHBvcnQgY29uc3Qgc2VuZFJlZnVuZEVtYWlsID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJUmVmdW5kRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhZGV0YWlscy5lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyByZWZ1bmQgZW1haWwuXCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHRyYXZlbERhdGUgPSBkZXRhaWxzLnRyYXZlbERhdGUudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCk7XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+UmVmdW5kIGlzc3VlZDwvaDI+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDE0cHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjMzc0MTUxO1wiPlxuICAgICAgSGkgJHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9LDxici8+XG4gICAgICBZb3VyIGJvb2tpbmcgd2FzIGNhbmNlbGxlZCwgYW5kIDxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChcbiAgICAgICAgZGV0YWlscy5hbW91bnQudG9GaXhlZCgyKSxcbiAgICAgICl9PC9zdHJvbmc+IGhhcyBiZWVuIHJlZnVuZGVkIHRvIHlvdXIgb3JpZ2luYWwgcGF5bWVudCBtZXRob2QuIFBsZWFzZSBhbGxvd1xuICAgICAgNS0xMCBidXNpbmVzcyBkYXlzIGZvciB0aGUgbW9uZXkgdG8gYXBwZWFyLlxuICAgIDwvcD5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5QYWNrYWdlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5wYWNrYWdlVGl0bGUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VHJhdmVsIGRhdGU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwodHJhdmVsRGF0ZSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWZ1bmRlZCBhbW91bnQ8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiYjMjU0Nzske2VzY2FwZUh0bWwoZGV0YWlscy5hbW91bnQudG9GaXhlZCgyKSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICAke2RldGFpbHMucmVmdW5kUmVmSWRcbiAgICAgICAgPyBgXG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWZ1bmQgcmVmZXJlbmNlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGRldGFpbHMucmVmdW5kUmVmSWQpfTwvdGQ+XG4gICAgICA8L3RyPmBcbiAgICAgICAgOiBcIlwifVxuICAgIDwvdGFibGU+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDEzcHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjNmI3MjgwOyBtYXJnaW4tdG9wOiAxNnB4O1wiPlxuICAgICAgSWYgeW91IGhhdmUgYW55IHF1ZXN0aW9ucyBhYm91dCB0aGlzIHJlZnVuZCwgcGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cbiAgICA8L3A+XG4gIGA7XG5cbiAgYXdhaXQgc2VuZFdpdGhMb2coXG4gICAgY2xpZW50LFxuICAgIFwiQm9va2luZyBjYW5jZWxsZWQgJiByZWZ1bmQgaXNzdWVkIC0gVHJpcFZlcnNlXCIsXG4gICAgW2RldGFpbHMuZW1haWxdLFxuICAgIGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICApO1xufTsiLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHtcbiAgc2VuZENvbnRhY3RBdXRvUmVwbHksXG4gIHNlbmRDb250YWN0Tm90aWZpY2F0aW9uLFxufSBmcm9tIFwiLi4vLi4vdXRpbHMvZW1haWxcIjtcbmltcG9ydCB7IElDb250YWN0UXVlcnksIElDcmVhdGVDb250YWN0UGF5bG9hZCB9IGZyb20gXCIuL2NvbnRhY3QuaW50ZXJmYWNlXCI7XG5cbi8vIDEuIENyZWF0ZSBjb250YWN0IG1lc3NhZ2UgKHB1YmxpYylcbmNvbnN0IGNyZWF0ZU1lc3NhZ2UgPSBhc3luYyAocGF5bG9hZDogSUNyZWF0ZUNvbnRhY3RQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IGNyZWF0ZWRNZXNzYWdlID0gYXdhaXQgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgbmFtZTogcGF5bG9hZC5uYW1lLFxuICAgICAgZW1haWw6IHBheWxvYWQuZW1haWwsXG4gICAgICBzdWJqZWN0OiBwYXlsb2FkLnN1YmplY3QsXG4gICAgICBtZXNzYWdlOiBwYXlsb2FkLm1lc3NhZ2UsXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gRW1haWxzIGFyZSBiZXN0LWVmZm9ydDogYSBmYWlsdXJlIGhlcmUgbXVzdCBuZXZlciBmYWlsIHRoZSBzdWJtaXNzaW9uXG4gIC8vICh0aGUgbWVzc2FnZSBpcyBhbHJlYWR5IHNhdmVkIHRvIHRoZSBpbmJveCkuXG4gIGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZENvbnRhY3ROb3RpZmljYXRpb24oeyAuLi5jcmVhdGVkTWVzc2FnZSwgY3JlYXRlZEF0OiBjcmVhdGVkTWVzc2FnZS5jcmVhdGVkQXQgfSksXG4gICAgc2VuZENvbnRhY3RBdXRvUmVwbHkoeyAuLi5jcmVhdGVkTWVzc2FnZSwgY3JlYXRlZEF0OiBjcmVhdGVkTWVzc2FnZS5jcmVhdGVkQXQgfSksXG4gIF0pO1xuXG4gIHJldHVybiBjcmVhdGVkTWVzc2FnZTtcbn07XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyAoYWRtaW4gb25seSwgcGFnaW5hdGVkLCBmaWx0ZXJhYmxlIGJ5IGlzUmVzb2x2ZWQpXG5jb25zdCBsaXN0TWVzc2FnZXMgPSBhc3luYyAocXVlcnk6IElDb250YWN0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkNvbnRhY3RNZXNzYWdlV2hlcmVJbnB1dCB8IHVuZGVmaW5lZCA9XG4gICAgcXVlcnkuaXNSZXNvbHZlZCA9PT0gdW5kZWZpbmVkXG4gICAgICA/IHVuZGVmaW5lZFxuICAgICAgOiB7IGlzUmVzb2x2ZWQ6IHF1ZXJ5LmlzUmVzb2x2ZWQgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5jb250YWN0TWVzc2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5jb250YWN0TWVzc2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIDMuIE1hcmsgYSBjb250YWN0IG1lc3NhZ2UgcmVzb2x2ZWQvdW5yZXNvbHZlZCAoYWRtaW4gb25seSlcbmNvbnN0IHJlc29sdmVNZXNzYWdlID0gYXN5bmMgKGlkOiBzdHJpbmcsIGlzUmVzb2x2ZWQ6IGJvb2xlYW4pID0+IHtcbiAgcmV0dXJuIHByaXNtYS5jb250YWN0TWVzc2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YTogeyBpc1Jlc29sdmVkIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RTZXJ2aWNlID0ge1xuICBjcmVhdGVNZXNzYWdlLFxuICBsaXN0TWVzc2FnZXMsXG4gIHJlc29sdmVNZXNzYWdlLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlTWVzc2FnZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgbmFtZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOYW1lIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKSxcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsIGFkZHJlc3NcIiksXG4gIHN1YmplY3Q6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiU3ViamVjdCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMiwgXCJTdWJqZWN0IG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgyMDAsIFwiU3ViamVjdCBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIiksXG4gIG1lc3NhZ2U6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTWVzc2FnZSBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMTAsIFwiTWVzc2FnZSBtdXN0IGJlIGF0IGxlYXN0IDEwIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDIwMDAsIFwiTWVzc2FnZSBtdXN0IGJlIGF0IG1vc3QgMjAwMCBjaGFyYWN0ZXJzXCIpLFxufSkuc3RyaWN0KCk7XG5cbmNvbnN0IGNvbnRhY3RRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgaXNSZXNvbHZlZDogelxuICAgIC5lbnVtKFtcInRydWVcIiwgXCJmYWxzZVwiXSlcbiAgICAub3B0aW9uYWwoKVxuICAgIC50cmFuc2Zvcm0oKHZhbCkgPT4gKHZhbCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogdmFsID09PSBcInRydWVcIikpLFxufSk7XG5cbmNvbnN0IGNvbnRhY3RQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk1lc3NhZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgdXBkYXRlUmVzb2x2ZWRTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIGlzUmVzb2x2ZWQ6IHouYm9vbGVhbih7XG4gICAgICByZXF1aXJlZF9lcnJvcjogXCJpc1Jlc29sdmVkIGlzIHJlcXVpcmVkXCIsXG4gICAgICBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiaXNSZXNvbHZlZCBtdXN0IGJlIGEgYm9vbGVhblwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KClcbiAgLnJlZmluZSgoZGF0YSkgPT4gdHlwZW9mIGRhdGEuaXNSZXNvbHZlZCA9PT0gXCJib29sZWFuXCIsIHtcbiAgICBtZXNzYWdlOiBcImlzUmVzb2x2ZWQgbXVzdCBiZSBhIGJvb2xlYW5cIixcbiAgfSk7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZU1lc3NhZ2VTY2hlbWEsXG4gIGNvbnRhY3RRdWVyeVNjaGVtYSxcbiAgY29udGFjdFBhcmFtc1NjaGVtYSxcbiAgdXBkYXRlUmVzb2x2ZWRTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgYm9va2luZ0NvbnRyb2xsZXIgfSBmcm9tIFwiLi9ib29raW5nLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGJvb2tpbmdWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2Jvb2tpbmcudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gQ3JlYXRlIGJvb2tpbmcgKGN1c3RvbWVyIG9ubHkgXHUyMDE0IGFnZW50cyBzZWxsLCBhZG1pbnMgbWFuYWdlKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGJvb2tpbmdWYWxpZGF0aW9ucy5jcmVhdGVTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmNyZWF0ZUJvb2tpbmcsXG4pO1xuXG4vLyBNeSBib29raW5ncyBcdTIwMTQgb3duIGJvb2tpbmdzIHdpdGggZmlsdGVycyArIHBhZ2luYXRpb24gKG93bmVyIGlzIGFsd2F5cyBVU0VSKVxuLy8gTk9URTogcmVnaXN0ZXJlZCBiZWZvcmUgXCIvOmlkXCIgc28gdGhlIHBhcmFtIHJvdXRlIGRvZXNuJ3Qgc3dhbGxvdyBpdC5cbnJvdXRlci5nZXQoXG4gIFwiL215LWJvb2tpbmdzXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUXVlcnlTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmdldE15Qm9va2luZ3MsXG4pO1xuXG4vLyBBZ2VudCBib29raW5ncyBcdTIwMTQgc2NvcGVkIHRvIHBhY2thZ2VzIHRoZSBhZ2VudCBvd25zXG5yb3V0ZXIuZ2V0KFxuICBcIi9hZ2VudC1ib29raW5nc1wiLFxuICBhdXRoKFJvbGUuQUdFTlQpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0QWdlbnRCb29raW5ncyxcbik7XG5cbi8vIEJvb2tpbmcgZGV0YWlsIFx1MjAxNCBvd25lciAvIHBhY2thZ2UgYWdlbnQgLyBhZG1pblxucm91dGVyLmdldChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1BhcmFtc1NjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0Qm9va2luZ0RldGFpbCxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBhbGwgYm9va2luZ3NcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0QWxsQm9va2luZ3MsXG4pO1xuXG4vLyBTdGF0dXMgdHJhbnNpdGlvbiBcdTIwMTQgdmFsaWRhdGVkIGFnYWluc3QgdGhlIHN0YXRlIG1hY2hpbmUgaW4gdGhlIHNlcnZpY2VcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1BhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBib29raW5nVmFsaWRhdGlvbnMudXBkYXRlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIudXBkYXRlQm9va2luZ1N0YXR1cyxcbik7XG5cbmV4cG9ydCBjb25zdCBib29raW5nUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgYm9va2luZ1NlcnZpY2UgfSBmcm9tIFwiLi9ib29raW5nLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG5jb25zdCBjcmVhdGVCb29raW5nID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS5jcmVhdGVCb29raW5nKHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZyBjcmVhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGJvb2tpbmcsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRNeUJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldE15Qm9va2luZ3ModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0QWdlbnRCb29raW5ncyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBib29raW5nU2VydmljZS5nZXRBZ2VudEJvb2tpbmdzKHVzZXJJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldEJvb2tpbmdEZXRhaWwgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS5nZXRCb29raW5nRGV0YWlsKGlkLCByZXEudXNlciEpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmcgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGJvb2tpbmcsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRBbGxCb29raW5ncyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEFsbEJvb2tpbmdzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCB1cGRhdGVCb29raW5nU3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBjb25zdCBib29raW5nID0gYXdhaXQgYm9va2luZ1NlcnZpY2UudXBkYXRlQm9va2luZ1N0YXR1cyhcbiAgICAgIGlkLFxuICAgICAgcmVxLmJvZHksXG4gICAgICByZXEudXNlciEsXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5nIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGJvb2tpbmcsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYm9va2luZ0NvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZUJvb2tpbmcsXG4gIGdldE15Qm9va2luZ3MsXG4gIGdldEFnZW50Qm9va2luZ3MsXG4gIGdldEJvb2tpbmdEZXRhaWwsXG4gIGdldEFsbEJvb2tpbmdzLFxuICB1cGRhdGVCb29raW5nU3RhdHVzLFxufTsiLCAiaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuXG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWcvaW5kZXhcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbi8vIFBheW1lbnQgaXMgYW4gb3B0aW9uYWwgZmVhdHVyZTogdGhlIEFQSSBtdXN0IGJvb3QgYW5kIHNlcnZlIGV2ZXJ5dGhpbmcgZWxzZVxuLy8gZXZlbiB3aGVuIHRoZSBTU0xDb21tZXJ6IHN0b3JlIGlzbid0IGNvbmZpZ3VyZWQgeWV0LiBUaGVzZSB0aHJvdyBhIGNsZWFuIDQwMFxuLy8gb24gdGhlIHBheW1lbnQtb25seSBwYXRocyByYXRoZXIgdGhhbiBjcmFzaCB0aGUgd2hvbGUgZGVwbG95bWVudCBhdCBib290LlxuY29uc3QgcmVxdWlyZUNvbmZpZyA9ICgpID0+IHtcbiAgaWYgKCFjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfaWQgfHwgIWNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9wYXNzd29yZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiU1NMQ29tbWVyeiBpcyBub3QgY29uZmlndXJlZC4gU2V0IFNTTF9DT01NRVJaX1NUT1JFX0lEIGFuZCBTU0xfQ09NTUVSWl9TVE9SRV9QQVNTV09SRC5cIixcbiAgICApO1xuICB9XG4gIGlmICghY29uZmlnLmJhY2tlbmRfcHVibGljX3VybCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiU1NMQ29tbWVyeiBpcyBub3QgY29uZmlndXJlZC4gU2V0IEJBQ0tFTkRfUFVCTElDX1VSTCB0byB0aGUgcHVibGljbHkgcmVhY2hhYmxlIGJhY2tlbmQgVVJMLlwiLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBzdG9yZUlkOiBjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfaWQsXG4gICAgc3RvcmVQYXNzd29yZDogY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkLFxuICB9O1xufTtcblxuZXhwb3J0IGludGVyZmFjZSBTc2xjb21tZXJ6SW5pdFJlc3VsdCB7XG4gIHN0YXR1czogc3RyaW5nO1xuICBmYWlsZWRyZWFzb24/OiBzdHJpbmc7XG4gIHNlc3Npb25rZXk/OiBzdHJpbmc7XG4gIEdhdGV3YXlQYWdlVVJMPzogc3RyaW5nO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQge1xuICBzdGF0dXM6IHN0cmluZztcbiAgZXJyb3I/OiBzdHJpbmc7XG4gIHZhbF9pZD86IHN0cmluZztcbiAgYW1vdW50Pzogc3RyaW5nO1xuICBjdXJyZW5jeT86IHN0cmluZztcbiAgYmFua190cmFuX2lkPzogc3RyaW5nO1xuICBjYXJkX3R5cGU/OiBzdHJpbmc7XG4gIFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTc2xjb21tZXJ6UmVmdW5kUmVzdWx0IHtcbiAgQVBJQ29ubmVjdD86IHN0cmluZztcbiAgc3RhdHVzPzogc3RyaW5nOyAvLyBzdWNjZXNzIHwgZmFpbGVkIHwgcHJvY2Vzc2luZ1xuICBlcnJvclJlYXNvbj86IHN0cmluZztcbiAgcmVmdW5kX3JlZl9pZD86IHN0cmluZztcbiAgYmFua190cmFuX2lkPzogc3RyaW5nO1xuICB0cmFuc19pZD86IHN0cmluZztcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG4vLyBTU0xDb21tZXJ6IHRydW5jYXRlcyB0cmFuX2lkIHRvIDMwIGNoYXJzIFx1MjAxNCBkYXRlICsgdGltZSArIHJhbmRvbSBzYWx0IHN0YXlzIHNhZmVseSB1bmRlci5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZVRyYW5JZCgpOiBzdHJpbmcge1xuICByZXR1cm4gYFRSTlhfSUQtJHtEYXRlLm5vdygpfS0ke3JhbmRvbVVVSUQoKS5yZXBsYWNlKC8tL2csIFwiXCIpLnNsaWNlKDAsIDgpfWA7XG59XG5cbi8vIFVuaXF1ZSByZWZ1bmQgdHJhbnNhY3Rpb24gaWQgKG1hbmRhdG9yeSBieSB0aGUgcmVmdW5kIEFQSSBzaW5jZSAyNC8wMi8yMDI1LFxuLy8gbWF4IDMwIGNoYXJzKSBcdTIwMTQgYSBmcmVzaCBvbmUgcGVyIHJlZnVuZCBhdHRlbXB0IHNvIHRoZSBnYXRld2F5IG5ldmVyIHJlamVjdHMgYVxuLy8gZHVwbGljYXRlLlxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlUmVmdW5kVHJhbklkKCk6IHN0cmluZyB7XG4gIHJldHVybiBgUkZELSR7RGF0ZS5ub3coKX0tJHtyYW5kb21VVUlEKCkucmVwbGFjZSgvLS9nLCBcIlwiKS5zbGljZSgwLCA4KX1gO1xufVxuXG4vLyBJbml0aWF0ZXMgYSBnYXRld2F5IHNlc3Npb24uIFNlcnZlci10by1zZXJ2ZXIgUE9TVCwgZm9ybS1lbmNvZGVkLiBUaGUgZ2F0ZXdheVxuLy8gcmVzcG9uZHMgd2l0aCB0aGUgaG9zdGVkIGNoZWNrb3V0IFVSTCAoR2F0ZXdheVBhZ2VVUkwpIHRoZSBjdXN0b21lciBpcyBzZW50IHRvLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpJbml0KG9wdGlvbnM6IHtcbiAgdG90YWxfYW1vdW50OiBudW1iZXI7XG4gIHRyYW5faWQ6IHN0cmluZztcbiAgc3VjY2Vzc191cmw6IHN0cmluZztcbiAgZmFpbF91cmw6IHN0cmluZztcbiAgY2FuY2VsX3VybDogc3RyaW5nO1xuICBpcG5fdXJsOiBzdHJpbmc7XG4gIGN1c19uYW1lOiBzdHJpbmc7XG4gIGN1c19lbWFpbDogc3RyaW5nO1xuICBjdXNfcGhvbmU6IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpJbml0UmVzdWx0PiB7XG4gIGNvbnN0IHsgc3RvcmVJZCwgc3RvcmVQYXNzd29yZCB9ID0gcmVxdWlyZUNvbmZpZygpO1xuICBjb25zdCBib2R5ID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIHRvdGFsX2Ftb3VudDogb3B0aW9ucy50b3RhbF9hbW91bnQudG9GaXhlZCgyKSxcbiAgICBjdXJyZW5jeTogXCJCRFRcIixcbiAgICB0cmFuX2lkOiBvcHRpb25zLnRyYW5faWQsXG4gICAgc3VjY2Vzc191cmw6IG9wdGlvbnMuc3VjY2Vzc191cmwsXG4gICAgZmFpbF91cmw6IG9wdGlvbnMuZmFpbF91cmwsXG4gICAgY2FuY2VsX3VybDogb3B0aW9ucy5jYW5jZWxfdXJsLFxuICAgIGlwbl91cmw6IG9wdGlvbnMuaXBuX3VybCxcbiAgICBjdXNfbmFtZTogb3B0aW9ucy5jdXNfbmFtZSxcbiAgICBjdXNfZW1haWw6IG9wdGlvbnMuY3VzX2VtYWlsLFxuICAgIGN1c19hZGQxOiBcIk4vQVwiLFxuICAgIGN1c19hZGQyOiBcIk4vQVwiLFxuICAgIGN1c19jaXR5OiBcIk4vQVwiLFxuICAgIGN1c19zdGF0ZTogXCJOL0FcIixcbiAgICBjdXNfcG9zdGNvZGU6IFwiMTAwMFwiLFxuICAgIGN1c19jb3VudHJ5OiBcIkJhbmdsYWRlc2hcIixcbiAgICBjdXNfcGhvbmU6IG9wdGlvbnMuY3VzX3Bob25lLFxuICAgIHByb2R1Y3RfbmFtZTogXCJUcmlwVmVyc2UgVG91ciBCb29raW5nXCIsXG4gICAgc2hpcHBpbmdfbWV0aG9kOiBcIk5PXCIsXG4gIH0pO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGNvbmZpZy5zc2xjb21tZXJ6X2luaXRfdXJsLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCIgfSxcbiAgICBib2R5OiBib2R5LnRvU3RyaW5nKCksXG4gIH0pO1xuXG4gIGNvbnN0IHRleHQgPSBhd2FpdCByZXMudGV4dCgpO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgYFNTTENvbW1lcnogaW5pdCBmYWlsZWQgKCR7cmVzLnN0YXR1c30pYCk7XG5cbiAgbGV0IGRhdGE6IFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB0cnkge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKHRleHQpIGFzIFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBcIlNTTENvbW1lcnogaW5pdCByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlXCIpO1xuICB9XG5cbiAgLy8gVGhlIGdhdGV3YXkgcmVwb3J0cyBzdGF0dXMgaW4gVVBQRVJDQVNFIChcIlNVQ0NFU1NcIiAvIFwiRkFJTEVEXCIpOyBhbnkgb3RoZXJcbiAgLy8gc3RhdHVzLCBvciBhIHN1Y2Nlc3Mgd2l0aG91dCB0aGUgaG9zdGVkIGNoZWNrb3V0IFVSTCwgaXMgYSBmYWlsZWQgaW5pdC5cbiAgaWYgKGRhdGEuc3RhdHVzICE9PSBcIlNVQ0NFU1NcIiB8fCAhZGF0YS5HYXRld2F5UGFnZVVSTCkge1xuICAgIGNvbnN0IHJlYXNvbiA9IGRhdGEuZmFpbGVkcmVhc29uIHx8IGRhdGEuc3RhdHVzIHx8IFwidW5rbm93blwiO1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBgW3NzbGNvbW1lcnpdIGluaXQgcmVqZWN0ZWQgKHVybD0ke2NvbmZpZy5zc2xjb21tZXJ6X2luaXRfdXJsfSwgc2FuZGJveD0ke2NvbmZpZy5zc2xfY29tbWVyel9zYW5kYm94fSk6ICR7cmVhc29ufWAsXG4gICAgICBkYXRhLFxuICAgICk7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNTAyLFxuICAgICAgYFNTTENvbW1lcnogaW5pdCByZWplY3RlZDogJHtyZWFzb259LiBDaGVjayBTU0xfQ09NTUVSWl9TVE9SRV9JRCwgU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQsIFNTTF9DT01NRVJaX1NBTkRCT1ggYW5kIFNTTENPTU1FUlpfSU5JVF9VUkwgKHNlZSBzZXJ2ZXIgbG9ncykuYCxcbiAgICApO1xuICB9XG4gIHJldHVybiBkYXRhO1xufVxuXG4vLyBTZXJ2ZXItc2lkZSB2ZXJpZmljYXRpb24gb2YgYSBjb21wbGV0ZWQgdHJhbnNhY3Rpb24uIHN0YXR1czogVkFMSUQgLyBWQUxJREFURUQgL1xuLy8gSU5WQUxJRF9UUkFOU0FDVElPTiAvIEZBSUxFRC4gVkFMSURBVEVEIG1lYW5zIHRoZSB0cmFuc2FjdGlvbiB3YXMgdmVyaWZpZWQgYmVmb3JlXG4vLyAoaWRlbXBvdGVudCksIElOVkFMSURfVFJBTlNBQ1RJT04gbWVhbnMgdGhlIGFtb3VudC90cmFuc2FjdGlvbiBtaXNtYXRjaGVzLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpWYWxpZGF0ZShvcHRpb25zOiB7XG4gIHZhbF9pZDogc3RyaW5nO1xufSk6IFByb21pc2U8U3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ+IHtcbiAgY29uc3QgeyBzdG9yZUlkLCBzdG9yZVBhc3N3b3JkIH0gPSByZXF1aXJlQ29uZmlnKCk7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHZhbF9pZDogb3B0aW9ucy52YWxfaWQsXG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIGZvcm1hdDogXCJqc29uXCIsXG4gIH0pO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2NvbmZpZy5zc2xjb21tZXJ6X3ZhbGlkYXRlX3VybH0/JHtwYXJhbXMudG9TdHJpbmcoKX1gLCB7XG4gICAgbWV0aG9kOiBcIkdFVFwiLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IHZhbGlkYXRpb24gZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IHZhbGlkYXRpb24gcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn1cblxuLy8gSW5pdGlhdGVzIGEgcmVmdW5kIGFnYWluc3QgYSBzZXR0bGVkIHRyYW5zYWN0aW9uIChSZWZ1bmQgQVBJLCB2NCBkb2NzKS4gVGhlXG4vLyB0cmFuc2FjdGlvbiBpcyByZXNvbHZlZCBieSBgYmFua190cmFuX2lkYCAoY2FwdHVyZWQgZnJvbSB0aGUgZ2F0ZXdheSBhdFxuLy8gcGF5bWVudCB0aW1lKS4gYHJlZnVuZF90cmFuc19pZGAgaXMgYSBtYW5kYXRvcnksIHVuaXF1ZS1wZXItYXR0ZW1wdCBpZC5cbi8vIE9ubHkgYHN0YXR1czogXCJzdWNjZXNzXCJgIChBUElDb25uZWN0IERPTkUpIGlzIHRyZWF0ZWQgYXMgYSBjb25maXJtZWQgcmVmdW5kO1xuLy8gYW55dGhpbmcgZWxzZSAoZmFpbGVkL3Byb2Nlc3NpbmcvcGVuZGluZykgdGhyb3dzLiBCb3VuZGVkIHRvIDhzIHNvIGEgaHVuZ1xuLy8gZ2F0ZXdheSBjYW4ndCBob2xkIHRoZSBjYW5jZWxsaW5nIHJlcXVlc3QuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3NsY29tbWVyelJlZnVuZChvcHRpb25zOiB7XG4gIGJhbmtfdHJhbl9pZDogc3RyaW5nO1xuICByZWZ1bmRfdHJhbnNfaWQ/OiBzdHJpbmc7XG4gIHJlZnVuZF9hbW91bnQ6IG51bWJlcjtcbiAgcmVmdW5kX3JlbWFya3M6IHN0cmluZztcbiAgcmVmZV9pZD86IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ+IHtcbiAgY29uc3QgeyBzdG9yZUlkLCBzdG9yZVBhc3N3b3JkIH0gPSByZXF1aXJlQ29uZmlnKCk7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIGJhbmtfdHJhbl9pZDogb3B0aW9ucy5iYW5rX3RyYW5faWQsXG4gICAgcmVmdW5kX3RyYW5zX2lkOiBvcHRpb25zLnJlZnVuZF90cmFuc19pZCA/PyBnZW5lcmF0ZVJlZnVuZFRyYW5JZCgpLFxuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICByZWZ1bmRfYW1vdW50OiBvcHRpb25zLnJlZnVuZF9hbW91bnQudG9GaXhlZCgyKSxcbiAgICByZWZ1bmRfcmVtYXJrczogb3B0aW9ucy5yZWZ1bmRfcmVtYXJrcyxcbiAgICBmb3JtYXQ6IFwianNvblwiLFxuICAgIHY6IFwiMVwiLFxuICB9KTtcbiAgaWYgKG9wdGlvbnMucmVmZV9pZCkgcGFyYW1zLnNldChcInJlZmVfaWRcIiwgb3B0aW9ucy5yZWZlX2lkKTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChcbiAgICBgJHtjb25maWcuc3NsY29tbWVyel9yZWZ1bmRfdXJsfT8ke3BhcmFtcy50b1N0cmluZygpfWAsXG4gICAgeyBtZXRob2Q6IFwiR0VUXCIsIHNpZ25hbDogQWJvcnRTaWduYWwudGltZW91dCg4MDAwKSB9LFxuICApO1xuXG4gIGNvbnN0IHRleHQgPSBhd2FpdCByZXMudGV4dCgpO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgYFNTTENvbW1lcnogcmVmdW5kIGZhaWxlZCAoJHtyZXMuc3RhdHVzfSlgKTtcblxuICBsZXQgZGF0YTogU3NsY29tbWVyelJlZnVuZFJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6UmVmdW5kUmVzdWx0O1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBcIlNTTENvbW1lcnogcmVmdW5kIHJldHVybmVkIGEgbm9uLUpTT04gcmVzcG9uc2VcIik7XG4gIH1cblxuICAvLyBXaGl0ZWxpc3Q6IG9ubHkgYW4gZXhwbGljaXQgYHN1Y2Nlc3NgIGNvdW50cyBhcyBhIGNvbmZpcm1lZCByZWZ1bmQuIEFueSBvdGhlclxuICAvLyBzdGF0dXMgKGZhaWxlZCwgcHJvY2Vzc2luZywgcGVuZGluZywgb3IgYW4gdW5leHBlY3RlZCB2YWx1ZSkgdGhyb3dzIFx1MjAxNCBzbyB0aGVcbiAgLy8gcGF5bWVudCByb3cgY2FuIG5ldmVyIGZsaXAgdG8gUkVGVU5ERUQgYmVmb3JlIHRoZSBnYXRld2F5IGFjdHVhbGx5IHNldHRsZXMuXG4gIGlmIChkYXRhLkFQSUNvbm5lY3QgIT09IFwiRE9ORVwiIHx8IGRhdGEuc3RhdHVzICE9PSBcInN1Y2Nlc3NcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDUwMixcbiAgICAgIGBTU0xDb21tZXJ6IHJlZnVuZCByZWplY3RlZDogJHtkYXRhLmVycm9yUmVhc29uID8/IGRhdGEuQVBJQ29ubmVjdCA/PyBkYXRhLnN0YXR1cyA/PyBcInVua25vd25cIn1gLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIGRhdGE7XG59IiwgImltcG9ydCB7IE5vdGlmaWNhdGlvblR5cGUgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uL2xpYi9wcmlzbWFcIjtcblxuLy8gQmVzdC1lZmZvcnQgaW4tYXBwIG5vdGlmaWNhdGlvbiBcdTIwMTQgbWlycm9ycyB0aGUgZW1haWwgaGVscGVycy4gQSBmYWlsdXJlIGlzXG4vLyBsb2dnZWQgYW5kIHN3YWxsb3dlZCwgbmV2ZXIgdGhyb3duLCBzbyBhIG5vdGlmaWNhdGlvbiBpbnNlcnQgY2FuJ3QgZmFpbCB0aGVcbi8vIGJ1c2luZXNzIHdyaXRlIHRoYXQgY2F1c2VkIGl0LiBDYWxsIHNpdGVzIGZpcmUgaXQgYXNcbi8vIGB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbbm90aWZ5KC4uLildKWAuXG5leHBvcnQgY29uc3Qgbm90aWZ5ID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgdHlwZTogTm90aWZpY2F0aW9uVHlwZSxcbiAgdGl0bGU6IHN0cmluZyxcbiAgbWVzc2FnZTogc3RyaW5nLFxuICBsaW5rPzogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcHJpc21hLm5vdGlmaWNhdGlvbi5jcmVhdGUoe1xuICAgICAgZGF0YTogeyB1c2VySWQsIHR5cGUsIHRpdGxlLCBtZXNzYWdlLCBsaW5rIH0sXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGBbbm90aWZpY2F0aW9uXSBmYWlsZWQgdG8gY3JlYXRlICR7dHlwZX0gZm9yIHVzZXIgJHt1c2VySWR9OiAke1xuICAgICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcilcbiAgICAgIH1gLFxuICAgICk7XG4gIH1cbn07IiwgImltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cywgTm90aWZpY2F0aW9uVHlwZSwgUGFja2FnZVN0YXR1cywgUGF5bWVudFN0YXR1cywgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHNzbGNvbW1lcnpSZWZ1bmQgfSBmcm9tIFwiLi4vLi4vbGliL3NzbGNvbW1lcnpcIjtcbmltcG9ydCB7IHNlbmRCb29raW5nRW1haWwsIHNlbmRSZWZ1bmRFbWFpbCB9IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgbm90aWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL25vdGlmaWNhdGlvblwiO1xuaW1wb3J0IHtcbiAgSUJvb2tpbmdRdWVyeSxcbiAgSUJvb2tpbmdTZWFyY2hRdWVyeSxcbiAgSUNyZWF0ZUJvb2tpbmcsXG4gIElSZWZ1bmRPdXRjb21lLFxuICBJVXBkYXRlQm9va2luZ1N0YXR1cyxcbn0gZnJvbSBcIi4vYm9va2luZy5pbnRlcmZhY2VcIjtcblxuLy8gQSBQRU5ESU5HIGJvb2tpbmcgb2xkZXIgdGhhbiB0aGlzIGlzIHRyZWF0ZWQgYXMgYW4gYWJhbmRvbmVkIGNoZWNrb3V0OlxuLy8gaXQncyBhdXRvLWNhbmNlbGxlZCBzbyB0aGUgdXNlciBjYW4gcmVib29rIHRoZSBzYW1lIHBhY2thZ2UrZGF0ZS5cbmNvbnN0IFNUQUxFX0JPT0tJTkdfSE9VUlMgPSAyNDtcblxuY29uc3QgdG9VVENNaWRuaWdodCA9IChkYXRlOiBEYXRlKSA9PlxuICBuZXcgRGF0ZShcbiAgICBEYXRlLlVUQyhkYXRlLmdldFVUQ0Z1bGxZZWFyKCksIGRhdGUuZ2V0VVRDTW9udGgoKSwgZGF0ZS5nZXRVVENEYXRlKCkpLFxuICApO1xuXG4vLyBcdTI1MDBcdTI1MDAgQWN0b3IgKyBvd25lcnNoaXAgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG50eXBlIEJvb2tpbmdBY3RvciA9IHsgaWQ6IHN0cmluZzsgcm9sZTogUm9sZSB9O1xuXG4vLyBTdHJ1Y3R1cmFsIHN1YnNldCBcdTIwMTQgb25seSB3aGF0IHRoZSBvd25lcnNoaXAgY2hlY2tzIG5lZWQuXG50eXBlIEJvb2tpbmdPd25lckluZm8gPSB7XG4gIHVzZXJJZDogc3RyaW5nO1xuICBwYWNrYWdlOiB7IGFnZW50SWQ6IHN0cmluZyB9O1xufTtcblxuLy8gQm9va2luZyBvd25lciwgdGhlIEFHRU5UIHdobyBvd25zIHRoZSBwYWNrYWdlLCBvciBBRE1JTiBcdTIwMTQgZnVsbCBtYW5hZ2Ugc2NvcGUuXG5jb25zdCBjYW5NYW5hZ2UgPSAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT5cbiAgYm9va2luZy51c2VySWQgPT09IGFjdG9yLmlkIHx8XG4gIChhY3Rvci5yb2xlID09PSBSb2xlLkFHRU5UICYmIGJvb2tpbmcucGFja2FnZS5hZ2VudElkID09PSBhY3Rvci5pZCkgfHxcbiAgYWN0b3Iucm9sZSA9PT0gUm9sZS5BRE1JTjtcblxuLy8gT25seSB0aGUgcGFja2FnZS1vd25pbmcgQUdFTlQgb3IgQURNSU4gY2FuIG1vdmUgYSBib29raW5nJ3MgbW9uZXkgc3RhdHVzXG4vLyAoUEVORElOR1x1MjE5MkNPTkZJUk1FRCwgQ09ORklSTUVEXHUyMTkyQ09NUExFVEVELCBDT05GSVJNRURcdTIxOTJQRU5ESU5HKS5cbmNvbnN0IGlzQWdlbnRPd25lck9yQWRtaW4gPSAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT5cbiAgYWN0b3Iucm9sZSA9PT0gUm9sZS5BRE1JTiB8fFxuICAoYWN0b3Iucm9sZSA9PT0gUm9sZS5BR0VOVCAmJiBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWQpO1xuXG4vLyBcdTI1MDBcdTI1MDAgU3RhdGUgbWFjaGluZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbnR5cGUgVHJhbnNpdGlvblJ1bGUgPSB7XG4gIGFsbG93ZWQ6IChib29raW5nOiBCb29raW5nT3duZXJJbmZvLCBhY3RvcjogQm9va2luZ0FjdG9yKSA9PiBib29sZWFuO1xuICByZXF1aXJlc1RyYXZlbERhdGVQYXNzZWQ/OiBib29sZWFuO1xuICBiZWZvcmVUcmF2ZWxEYXRlPzogYm9vbGVhbjtcbn07XG5cbmNvbnN0IFRSQU5TSVRJT05TOiBQYXJ0aWFsPFxuICBSZWNvcmQ8Qm9va2luZ1N0YXR1cywgUGFydGlhbDxSZWNvcmQ8Qm9va2luZ1N0YXR1cywgVHJhbnNpdGlvblJ1bGU+Pj5cbj4gPSB7XG4gIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXTogeyBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXTogeyBhbGxvd2VkOiBjYW5NYW5hZ2UgfSxcbiAgfSxcbiAgW0Jvb2tpbmdTdGF0dXMuUEFJRF06IHtcbiAgICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7IGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4gfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7IGFsbG93ZWQ6IGNhbk1hbmFnZSB9LFxuICB9LFxuICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09NUExFVEVEXToge1xuICAgICAgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbixcbiAgICAgIHJlcXVpcmVzVHJhdmVsRGF0ZVBhc3NlZDogdHJ1ZSxcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHsgYWxsb3dlZDogY2FuTWFuYWdlIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuUEVORElOR106IHtcbiAgICAgIGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4sXG4gICAgICBiZWZvcmVUcmF2ZWxEYXRlOiB0cnVlLFxuICAgIH0sXG4gIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVzcG9uc2UgbWFwcGluZyAoRGVjaW1hbCBcdTIxOTIgTnVtYmVyKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGJvb2tpbmdQYWNrYWdlU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0aXRsZTogdHJ1ZSxcbiAgICBzbHVnOiB0cnVlLFxuICAgIGxvY2F0aW9uOiB0cnVlLFxuICAgIGltYWdlczogdHJ1ZSxcbiAgICBwcmljZTogdHJ1ZSxcbiAgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIERldGFpbCB2aWV3IGFkZHMgYWdlbnRJZCAobmVlZGVkIGJ5IG93bmVyc2hpcCBjaGVja3MgaW4gdGhlIHNlcnZpY2UpLlxuY29uc3QgYm9va2luZ1BhY2thZ2VEZXRhaWxTZWxlY3QgPSB7XG4gIHNlbGVjdDoge1xuICAgIGlkOiB0cnVlLFxuICAgIHRpdGxlOiB0cnVlLFxuICAgIHNsdWc6IHRydWUsXG4gICAgbG9jYXRpb246IHRydWUsXG4gICAgaW1hZ2VzOiB0cnVlLFxuICAgIHByaWNlOiB0cnVlLFxuICAgIGFnZW50SWQ6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG5jb25zdCBib29raW5nVXNlclNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9LFxufSBhcyBjb25zdDtcblxuLy8gUGF5bWVudCBsZWRnZXIgc2hvd24gb24gdGhlIGJvb2tpbmcgZGV0YWlsIHBhZ2UgKGFtb3VudHMgc3RheSBEZWNpbWFsIGluIERCKS5cbmNvbnN0IGJvb2tpbmdQYXltZW50U2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0cmFuSWQ6IHRydWUsXG4gICAgYW1vdW50OiB0cnVlLFxuICAgIGN1cnJlbmN5OiB0cnVlLFxuICAgIHN0YXR1czogdHJ1ZSxcbiAgICBjYXJkVHlwZTogdHJ1ZSxcbiAgICBiYW5rVHJhbklkOiB0cnVlLFxuICAgIHZhbElkOiB0cnVlLFxuICAgIHBhaWRBdDogdHJ1ZSxcbiAgICByZWZ1bmRSZWZJZDogdHJ1ZSxcbiAgICByZWZ1bmRJbml0aWF0ZWRBdDogdHJ1ZSxcbiAgICByZWZ1bmRDb21wbGV0ZWRBdDogdHJ1ZSxcbiAgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnRzIG9yZGVyZWQgbmV3ZXN0LWZpcnN0IHNvIGNvbnN1bWVycyBjYW4gcmVseSBvbiBwYXltZW50c1swXSBiZWluZyB0aGVcbi8vIGxhdGVzdCBhdHRlbXB0ICh1c2VkIGZvciB0aGUgdXNlciBwYXltZW50LWhpc3RvcnkgXCJsYXRlc3Qgc3RhdHVzXCIgcm93KS5cbmNvbnN0IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgPSB7XG4gIC4uLmJvb2tpbmdQYXltZW50U2VsZWN0LFxuICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgYXMgY29uc3QgfSxcbn0gYXMgY29uc3Q7XG5cbnR5cGUgQm9va2luZ1dpdFBhY2thZ2UgPSBQcmlzbWEuQm9va2luZ0dldFBheWxvYWQ8e1xuICBpbmNsdWRlOiB7IHBhY2thZ2U6IHR5cGVvZiBib29raW5nUGFja2FnZVNlbGVjdCB9O1xufT47XG5cbi8vIFBheW1lbnRzIHNob3cgb24gbGlzdCByb3dzIHRvbyAoRG9EOiBcImxpc3QvZGV0YWlsIG5vdyBpbmNsdWRlcyBwYXltZW50c1wiKSxcbi8vIG1hcHBlZCB0byBOdW1iZXIgYXQgdGhlIGJvdW5kYXJ5IGxpa2UgdGhlIHJlc3Qgb2YgdGhlIG1vbmV5IGZpZWxkcy5cbnR5cGUgQm9va2luZ1BheW1lbnRJdGVtID0ge1xuICBpZDogc3RyaW5nO1xuICB0cmFuSWQ6IHN0cmluZztcbiAgYW1vdW50OiB1bmtub3duO1xuICBjdXJyZW5jeTogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgY2FyZFR5cGU6IHN0cmluZyB8IG51bGw7XG4gIGJhbmtUcmFuSWQ6IHN0cmluZyB8IG51bGw7XG4gIHZhbElkOiBzdHJpbmcgfCBudWxsO1xuICBwYWlkQXQ6IERhdGUgfCBudWxsO1xufTtcblxuY29uc3QgbWFwQm9va2luZ0xpc3QgPSAoYm9va2luZzogQm9va2luZ1dpdFBhY2thZ2UgJiB7IHBheW1lbnRzPzogQm9va2luZ1BheW1lbnRJdGVtW10gfSkgPT4gKHtcbiAgLi4uYm9va2luZyxcbiAgdG90YWxQcmljZTogTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSksXG4gIHBhY2thZ2U6IHsgLi4uYm9va2luZy5wYWNrYWdlLCBwcmljZTogTnVtYmVyKGJvb2tpbmcucGFja2FnZS5wcmljZSkgfSxcbiAgcGF5bWVudHM6IGJvb2tpbmcucGF5bWVudHM/Lm1hcCgocCkgPT4gKHsgLi4ucCwgYW1vdW50OiBOdW1iZXIocC5hbW91bnQpIH0pKSxcbn0pO1xuXG4vLyBcdTI1MDBcdTI1MDAgQ3JlYXRlIGJvb2tpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBjcmVhdGVCb29raW5nID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBJQ3JlYXRlQm9va2luZykgPT4ge1xuICBjb25zdCB7IHBhY2thZ2VJZCwgdHJhdmVsZXJzIH0gPSBwYXlsb2FkO1xuICBjb25zdCB0cmF2ZWxEYXRlID0gdG9VVENNaWRuaWdodChwYXlsb2FkLnRyYXZlbERhdGUpO1xuXG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG4gIGlmIChcbiAgICAhdG91clBhY2thZ2UgfHxcbiAgICB0b3VyUGFja2FnZS5pc0RlbGV0ZWQgfHxcbiAgICB0b3VyUGFja2FnZS5zdGF0dXMgIT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJQYWNrYWdlIGlzIG5vdCBhdmFpbGFibGUgZm9yIGJvb2tpbmcuXCIpO1xuICB9XG5cbiAgLy8gdG90YWxQcmljZSBpcyBjb21wdXRlZCBzZXJ2ZXItc2lkZSBmcm9tIHRoZSBwYWNrYWdlJ3MgY3VycmVudCBwcmljZSBcdTIwMTRcbiAgLy8gYW55dGhpbmcgdGhlIGNsaWVudCBzZW5kcyBpcyBpZ25vcmVkLlxuICBjb25zdCB0b3RhbFByaWNlID0gTnVtYmVyKHRvdXJQYWNrYWdlLnByaWNlKSAqIHRyYXZlbGVycztcblxuICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHR4LmJvb2tpbmcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkLFxuICAgICAgICB0cmF2ZWxEYXRlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZykge1xuICAgICAgY29uc3QgaXNSZWNlbnQgPVxuICAgICAgICBleGlzdGluZy5jcmVhdGVkQXQuZ2V0VGltZSgpID49XG4gICAgICAgIERhdGUubm93KCkgLSBTVEFMRV9CT09LSU5HX0hPVVJTICogNjAgKiA2MCAqIDEwMDA7XG5cbiAgICAgIGlmIChpc1JlY2VudCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgNDA5LFxuICAgICAgICAgIFwiWW91IGFscmVhZHkgaGF2ZSBhIHBlbmRpbmcgYm9va2luZyBmb3IgdGhpcyBwYWNrYWdlIG9uIHRoaXMgZGF0ZS5cIixcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgLy8gYWJhbmRvbmVkIGNoZWNrb3V0IFx1MjAxNCBjYW5jZWwgaXQgaW4gdGhlIHNhbWUgdHJhbnNhY3Rpb24gYW5kIHJlYm9va1xuICAgICAgYXdhaXQgdHguYm9va2luZy51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogZXhpc3RpbmcuaWQgfSxcbiAgICAgICAgZGF0YTogeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHguYm9va2luZy5jcmVhdGUoe1xuICAgICAgZGF0YTogeyB1c2VySWQsIHBhY2thZ2VJZCwgdHJhdmVsRGF0ZSwgdHJhdmVsZXJzLCB0b3RhbFByaWNlIH0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IGVtYWlsIFx1MjAxNCBuZXZlciBmYWlscyB0aGUgcmVxdWVzdFxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9LFxuICB9KTtcbiAgaWYgKHVzZXIpIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgICAgcGFja2FnZVRpdGxlOiB0b3VyUGFja2FnZS50aXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZSxcbiAgICAgICAgdHJhdmVsZXJzLFxuICAgICAgICB0b3RhbFByaWNlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9XG5cbiAgLy8gYmVzdC1lZmZvcnQgaW4tYXBwIG5vdGlmaWNhdGlvbiB0byB0aGUgcGFja2FnZSBhZ2VudCAobmV2ZXIgZmFpbHMgcmVxdWVzdClcbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIG5vdGlmeShcbiAgICAgIHRvdXJQYWNrYWdlLmFnZW50SWQsXG4gICAgICBOb3RpZmljYXRpb25UeXBlLkJPT0tJTkdfQ1JFQVRFRCxcbiAgICAgIFwiTmV3IGJvb2tpbmcgcmVjZWl2ZWRcIixcbiAgICAgIGBBIG5ldyBib29raW5nIGhhcyBiZWVuIHBsYWNlZCBmb3IgXCIke3RvdXJQYWNrYWdlLnRpdGxlfVwiLmAsXG4gICAgICBgL2Rhc2hib2FyZC9hZ2VudC9ib29raW5ncy8ke2NyZWF0ZWQuaWR9YCxcbiAgICApLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIC4uLmNyZWF0ZWQsXG4gICAgdG90YWxQcmljZTogTnVtYmVyKGNyZWF0ZWQudG90YWxQcmljZSksXG4gIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTGlzdCBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcGFnaW5hdGVCb29raW5nID0gYXN5bmMgKFxuICB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0LFxuICBpbmNsdWRlOiBQcmlzbWEuQm9va2luZ0luY2x1ZGUsXG4gIHF1ZXJ5OiBJQm9va2luZ1F1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlIHx8IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgfHwgMTA7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYm9va2luZy5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGUsXG4gICAgICBza2lwOiAocGFnZSAtIDEpICogbGltaXQsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgIH0pLFxuICAgIHByaXNtYS5ib29raW5nLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIE15IGJvb2tpbmdzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0TXlCb29raW5ncyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElCb29raW5nUXVlcnkpID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHsgdXNlcklkIH07XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAgeyBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCwgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWdlbnQgYm9va2luZ3MgKHNjb3BlZCB0byBvd24gcGFja2FnZXMpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0QWdlbnRCb29raW5ncyA9IGFzeW5jIChcbiAgYWdlbnRJZDogc3RyaW5nLFxuICBxdWVyeTogSUJvb2tpbmdTZWFyY2hRdWVyeSxcbikgPT4ge1xuICBjb25zdCB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0ge1xuICAgIHBhY2thZ2U6IHsgYWdlbnRJZCB9LFxuICB9O1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICB3aGVyZS5wYWNrYWdlID0ge1xuICAgICAgYWdlbnRJZCxcbiAgICAgIHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9LFxuICAgIH07XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAgeyBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCwgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IGFsbCBib29raW5ncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldEFsbEJvb2tpbmdzID0gYXN5bmMgKHF1ZXJ5OiBJQm9va2luZ1NlYXJjaFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7fTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUucGFja2FnZSA9IHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhZ2luYXRlQm9va2luZyhcbiAgICB3aGVyZSxcbiAgICB7XG4gICAgICBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCxcbiAgICAgIHVzZXI6IGJvb2tpbmdVc2VyU2VsZWN0LFxuICAgICAgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUsXG4gICAgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQm9va2luZyBkZXRhaWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRCb29raW5nRGV0YWlsID0gYXN5bmMgKGlkOiBzdHJpbmcsIGFjdG9yOiBCb29raW5nQWN0b3IpID0+IHtcbiAgY29uc3QgYm9va2luZyA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgcGFja2FnZTogYm9va2luZ1BhY2thZ2VEZXRhaWxTZWxlY3QsXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICAgIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlLFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG4gIGlmICghY2FuTWFuYWdlKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byB2aWV3IHRoaXMgYm9va2luZy5cIik7XG4gIH1cblxuICByZXR1cm4gbWFwQm9va2luZ0xpc3QoYm9va2luZyk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVmdW5kIChib29raW5nIGNhbmNlbGxlZCB3aXRoIHNldHRsZWQgbW9uZXkpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gUnVucyBBRlRFUiB0aGUgc3RhdHVzLXRyYW5zaXRpb24gdHJhbnNhY3Rpb24gY29tbWl0cywgc28gYSBnYXRld2F5IGZhaWx1cmUgY2FuXG4vLyBuZXZlciByb2xsIGJhY2sgdGhlIGNhbmNlbGxhdGlvbiBpdHNlbGYuIEVhY2ggc2V0dGxlZCBwYXltZW50IGlzIHJlZnVuZGVkIHZpYVxuLy8gdGhlIFNTTENvbW1lcnogUmVmdW5kIEFQSTsgdGhlIGxlZGdlciBmbGlwcyB0byBSRUZVTkRFRCBPTkxZIGFmdGVyIHRoZSBnYXRld2F5XG4vLyBjb25maXJtcyBcdTIwMTQgYSBmYWlsZWQgcmVmdW5kIGxlYXZlcyB0aGUgcGF5bWVudCBTVUNDRVNTIHdpdGggcmVmdW5kSW5pdGlhdGVkQXRcbi8vIHNldCBzbyBhIGxhdGVyIHJldHJ5L21hbnVhbCBhY3Rpb24gY2FuIGZpbmQgaXQgKHNwZWMgMjMpLlxudHlwZSBSZWZ1bmRDb250ZXh0ID0ge1xuICBlbWFpbDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHBhY2thZ2VUaXRsZTogc3RyaW5nO1xuICB0cmF2ZWxEYXRlOiBEYXRlO1xufTtcblxuY29uc3QgaXNzdWVSZWZ1bmRzID0gYXN5bmMgKFxuICBib29raW5nSWQ6IHN0cmluZyxcbiAgY3R4OiBSZWZ1bmRDb250ZXh0LFxuKTogUHJvbWlzZTxJUmVmdW5kT3V0Y29tZSB8IG51bGw+ID0+IHtcbiAgY29uc3QgcGF5bWVudHMgPSBhd2FpdCBwcmlzbWEucGF5bWVudC5maW5kTWFueSh7XG4gICAgd2hlcmU6IHsgYm9va2luZ0lkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUywgcmVmdW5kQ29tcGxldGVkQXQ6IG51bGwgfSxcbiAgfSk7XG4gIGlmIChwYXltZW50cy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gIGxldCBhbGxTdWNjZWVkZWQgPSB0cnVlO1xuICBsZXQgZmlyc3RGYWlsdXJlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgbGV0IHJlZnVuZGVkVG90YWwgPSAwO1xuICBjb25zdCByZWZ1bmRSZWZzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgcGF5bWVudCBvZiBwYXltZW50cykge1xuICAgIGlmICghcGF5bWVudC5iYW5rVHJhbklkKSB7XG4gICAgICBhbGxTdWNjZWVkZWQgPSBmYWxzZTtcbiAgICAgIGZpcnN0RmFpbHVyZSA/Pz0gXCJQYXltZW50IGhhcyBubyBiYW5rIHRyYW5zYWN0aW9uIGlkIHRvIHJlZnVuZCBhZ2FpbnN0LlwiO1xuICAgICAgYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyB9LFxuICAgICAgICBkYXRhOiB7IHJlZnVuZEluaXRpYXRlZEF0OiBuZXcgRGF0ZSgpIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBnYXRld2F5ID0gYXdhaXQgc3NsY29tbWVyelJlZnVuZCh7XG4gICAgICAgIGJhbmtfdHJhbl9pZDogcGF5bWVudC5iYW5rVHJhbklkLFxuICAgICAgICByZWZ1bmRfYW1vdW50OiBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICAgICAgICByZWZ1bmRfcmVtYXJrczogYEJvb2tpbmcgJHtib29raW5nSWR9IGNhbmNlbGxlZCAtIFRyaXBWZXJzZWAsXG4gICAgICAgIHJlZmVfaWQ6IGJvb2tpbmdJZCxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBDQVM6IG9ubHkgYSBzdGlsbC1TVUNDRVNTIHBheW1lbnQgZmxpcHMgdG8gUkVGVU5ERUQgXHUyMDE0IGEgY29uY3VycmVudFxuICAgICAgLy8gcmVmdW5kIGxvc2VzIHRoZSByYWNlIChjb3VudCAwKSBhbmQgaXMgYSBuby1vcC4gTmV2ZXIgZG91YmxlLXJlZnVuZHMuXG4gICAgICBjb25zdCBmbGlwcGVkID0gYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyB9LFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgc3RhdHVzOiBQYXltZW50U3RhdHVzLlJFRlVOREVELFxuICAgICAgICAgIHJlZnVuZFJlZklkOiBnYXRld2F5LnJlZnVuZF9yZWZfaWQgPz8gcGF5bWVudC5yZWZ1bmRSZWZJZCA/PyBudWxsLFxuICAgICAgICAgIHJlZnVuZENvbXBsZXRlZEF0OiBuZXcgRGF0ZSgpLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChmbGlwcGVkLmNvdW50ID09PSAwKSBjb250aW51ZTsgLy8gYWxyZWFkeSByZWZ1bmRlZCBieSBhIGNvbmN1cnJlbnQgcGF0aFxuICAgICAgcmVmdW5kZWRUb3RhbCArPSBOdW1iZXIocGF5bWVudC5hbW91bnQpO1xuICAgICAgaWYgKGdhdGV3YXkucmVmdW5kX3JlZl9pZCkgcmVmdW5kUmVmcy5wdXNoKGdhdGV3YXkucmVmdW5kX3JlZl9pZCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGFsbFN1Y2NlZWRlZCA9IGZhbHNlO1xuICAgICAgZmlyc3RGYWlsdXJlID8/PVxuICAgICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICAvLyBtb25leSBoYXNuJ3QgbGVmdCB0aGUgZ2F0ZXdheSBcdTIwMTQgbGVhdmUgc3RhdHVzIFNVQ0NFU1MsIG1hcmsgZm9yIHJldHJ5XG4gICAgICBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5TVUNDRVNTIH0sXG4gICAgICAgIGRhdGE6IHsgcmVmdW5kSW5pdGlhdGVkQXQ6IG5ldyBEYXRlKCkgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGlmIChyZWZ1bmRSZWZzLmxlbmd0aCA+IDApIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBzZW5kUmVmdW5kRW1haWwoe1xuICAgICAgICBlbWFpbDogY3R4LmVtYWlsLFxuICAgICAgICBuYW1lOiBjdHgubmFtZSxcbiAgICAgICAgcGFja2FnZVRpdGxlOiBjdHgucGFja2FnZVRpdGxlLFxuICAgICAgICB0cmF2ZWxEYXRlOiBjdHgudHJhdmVsRGF0ZSxcbiAgICAgICAgYW1vdW50OiByZWZ1bmRlZFRvdGFsLFxuICAgICAgICByZWZ1bmRSZWZJZDogcmVmdW5kUmVmc1swXSxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9XG5cbiAgcmV0dXJuIGFsbFN1Y2NlZWRlZFxuICAgID8geyBzdGF0dXM6IFwiU1VDQ0VTU1wiIH1cbiAgICA6IHsgc3RhdHVzOiBcIkZBSUxFRFwiLCBtZXNzYWdlOiBmaXJzdEZhaWx1cmUgPz8gXCJSZWZ1bmQgY291bGQgbm90IGJlIHByb2Nlc3NlZC5cIiB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXR1cyB0cmFuc2l0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgdXBkYXRlQm9va2luZ1N0YXR1cyA9IGFzeW5jIChcbiAgaWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG4gIGFjdG9yOiBCb29raW5nQWN0b3IsXG4pID0+IHtcbiAgY29uc3QgeyBzdGF0dXM6IHRvIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIHBhY2thZ2U6IHtcbiAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBhZ2VudElkOiB0cnVlLCB0aXRsZTogdHJ1ZSB9LFxuICAgICAgfSxcbiAgICAgIHVzZXI6IGJvb2tpbmdVc2VyU2VsZWN0LFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKCFjYW5NYW5hZ2UoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBlcmZvcm0gdGhpcyBhY3Rpb24uXCIpO1xuICB9XG5cbiAgY29uc3QgcnVsZSA9IFRSQU5TSVRJT05TW2Jvb2tpbmcuc3RhdHVzXT8uW3RvXTtcbiAgaWYgKCFydWxlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgYENhbm5vdCB0cmFuc2l0aW9uIGJvb2tpbmcgZnJvbSAke2Jvb2tpbmcuc3RhdHVzfSB0byAke3RvfS5gLFxuICAgICk7XG4gIH1cbiAgaWYgKCFydWxlLmFsbG93ZWQoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBlcmZvcm0gdGhpcyBhY3Rpb24uXCIpO1xuICB9XG5cbiAgY29uc3QgdHJhdmVsRGF5ID0gdG9VVENNaWRuaWdodChib29raW5nLnRyYXZlbERhdGUpLmdldFRpbWUoKTtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgaWYgKHJ1bGUucmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkICYmIHRyYXZlbERheSA+IG5vdykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiQm9va2luZyBjYW4gb25seSBiZSBjb21wbGV0ZWQgYWZ0ZXIgdGhlIHRyYXZlbCBkYXRlIGhhcyBwYXNzZWQuXCIsXG4gICAgKTtcbiAgfVxuICBpZiAocnVsZS5iZWZvcmVUcmF2ZWxEYXRlICYmIHRyYXZlbERheSA8PSBub3cpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkJvb2tpbmcgY2FuIG9ubHkgYmUgcmV2ZXJ0ZWQgYmVmb3JlIHRoZSB0cmF2ZWwgZGF0ZS5cIixcbiAgICApO1xuICB9XG5cbiAgLy8gY29tcGFyZS1hbmQtc2V0OiB0aGUgdHJhbnNpdGlvbiBhcHBsaWVzIG9ubHkgaWYgdGhlIHJlY29yZGVkIHN0YXR1cyBzdGlsbFxuICAvLyBtYXRjaGVzIFx1MjAxNCBhIGNvbmN1cnJlbnQgY2hhbmdlIG1ha2VzIGNvdW50IDAgYW5kIHRoZSByZXF1ZXN0IGZhaWxzIHNhZmVseS5cbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdHguYm9va2luZy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkLCBzdGF0dXM6IGJvb2tpbmcuc3RhdHVzIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogdG8gfSxcbiAgICB9KTtcbiAgICBpZiAocmVzdWx0LmNvdW50ID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwOSxcbiAgICAgICAgXCJCb29raW5nIHN0YXR1cyBjaGFuZ2VkIGNvbmN1cnJlbnRseS4gUGxlYXNlIHRyeSBhZ2Fpbi5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQ2FuY2VsbGluZyBhIGJvb2tpbmcgYWJhbmRvbnMgYW55IG5vbi1zZXR0bGVkIHNlc3Npb25zIChubyBtb25leSB3YXNcbiAgICAvLyB0YWtlbikuIFNldHRsZWQgKFNVQ0NFU1MpIHBheW1lbnRzIGFyZSBOT1QgdG91Y2hlZCBoZXJlIFx1MjAxNCB0aGUgZ2F0ZXdheVxuICAgIC8vIHJlZnVuZCArIFJFRlVOREVEIGZsaXAgaGFwcGVuIGFmdGVyIHRoaXMgdHJhbnNhY3Rpb24gY29tbWl0cywgc28gYSBnYXRld2F5XG4gICAgLy8gZmFpbHVyZSBjYW4gbmV2ZXIgcm9sbCBiYWNrIHRoZSBjYW5jZWxsYXRpb24gaXRzZWxmIChzcGVjIDIzKS5cbiAgICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBib29raW5nSWQ6IGlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkNBTkNFTExFRCB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHR4LmJvb2tpbmcuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIH0pO1xuXG4gIGlmICghdXBkYXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgLy8gc3luY2hyb25vdXMgZ2F0ZXdheSByZWZ1bmQgZm9yIHNldHRsZWQgbW9uZXkgKGJvb2tpbmcgYWxyZWFkeSBDQU5DRUxMRUQpLlxuICAvLyBUaGUgb3V0Y29tZSBpcyBzdXJmYWNlZCB0byB0aGUgYWN0b3I7IGEgZ2F0ZXdheSBoaWNjdXAgbmV2ZXIgZmFpbHMgdGhlXG4gIC8vIGNhbmNlbGxhdGlvbiBpdHNlbGYuXG4gIGxldCByZWZ1bmQ6IElSZWZ1bmRPdXRjb21lIHwgbnVsbCA9IG51bGw7XG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQpIHtcbiAgICByZWZ1bmQgPSBhd2FpdCBpc3N1ZVJlZnVuZHMoaWQsIHtcbiAgICAgIGVtYWlsOiBib29raW5nLnVzZXIuZW1haWwsXG4gICAgICBuYW1lOiBib29raW5nLnVzZXIubmFtZSxcbiAgICAgIHBhY2thZ2VUaXRsZTogYm9va2luZy5wYWNrYWdlLnRpdGxlLFxuICAgICAgdHJhdmVsRGF0ZTogYm9va2luZy50cmF2ZWxEYXRlLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gYmVzdC1lZmZvcnQgZW1haWwgZm9yIG1vbmV5LXN0YXR1cyBjaGFuZ2VzXG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DT05GSVJNRUQgfHwgdG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgc2VuZEJvb2tpbmdFbWFpbCh7XG4gICAgICAgIGVtYWlsOiBib29raW5nLnVzZXIuZW1haWwsXG4gICAgICAgIG5hbWU6IGJvb2tpbmcudXNlci5uYW1lLFxuICAgICAgICBwYWNrYWdlVGl0bGU6IGJvb2tpbmcucGFja2FnZS50aXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZTogYm9va2luZy50cmF2ZWxEYXRlLFxuICAgICAgICB0cmF2ZWxlcnM6IGJvb2tpbmcudHJhdmVsZXJzLFxuICAgICAgICB0b3RhbFByaWNlOiBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKSxcbiAgICAgICAgc3RhdHVzOiB0byxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9XG5cbiAgLy8gYmVzdC1lZmZvcnQgaW4tYXBwIG5vdGlmaWNhdGlvbnMgKG5ldmVyIGZhaWxzIHJlcXVlc3QpLiBSZWNpcGllbnQgb2YgYVxuICAvLyBjYW5jZWxsYXRpb24gZGVwZW5kcyBvbiB0aGUgYWN0b3I6IHRoZSBjdXN0b21lciBjYW5jZWxzIFx1MjE5MiB0aGUgYWdlbnQgaGVhcnM7XG4gIC8vIHRoZSBhZ2VudCBjYW5jZWxzIFx1MjE5MiB0aGUgY3VzdG9tZXIgaGVhcnM7IGFuIEFETUlOIGNhbmNlbHMgXHUyMTkyIGJvdGggaGVhciwgc2luY2VcbiAgLy8gdGhlIGFkbWluIGFjdHMgb24gYmVoYWxmIG9mIHRoZSBwbGF0Zm9ybSwgbm90IGVpdGhlciBzaWRlLlxuICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ09ORklSTUVEKSB7XG4gICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgbm90aWZ5KFxuICAgICAgICBib29raW5nLnVzZXJJZCxcbiAgICAgICAgTm90aWZpY2F0aW9uVHlwZS5CT09LSU5HX0NPTkZJUk1FRCxcbiAgICAgICAgXCJCb29raW5nIGNvbmZpcm1lZFwiLFxuICAgICAgICBgWW91ciBib29raW5nIGZvciBcIiR7Ym9va2luZy5wYWNrYWdlLnRpdGxlfVwiIGhhcyBiZWVuIGNvbmZpcm1lZC5gLFxuICAgICAgICBgL2Rhc2hib2FyZC9ib29raW5ncy8ke2lkfWAsXG4gICAgICApLFxuICAgIF0pO1xuICB9XG5cbiAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgIGNvbnN0IHJlY2lwaWVudHM6IHN0cmluZ1tdID0gW107XG4gICAgaWYgKGFjdG9yLmlkID09PSBib29raW5nLnVzZXJJZCkge1xuICAgICAgcmVjaXBpZW50cy5wdXNoKGJvb2tpbmcucGFja2FnZS5hZ2VudElkKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgYWN0b3Iucm9sZSA9PT0gUm9sZS5BR0VOVCAmJlxuICAgICAgYm9va2luZy5wYWNrYWdlLmFnZW50SWQgPT09IGFjdG9yLmlkXG4gICAgKSB7XG4gICAgICByZWNpcGllbnRzLnB1c2goYm9va2luZy51c2VySWQpO1xuICAgIH0gZWxzZSBpZiAoYWN0b3Iucm9sZSA9PT0gUm9sZS5BRE1JTikge1xuICAgICAgcmVjaXBpZW50cy5wdXNoKGJvb2tpbmcudXNlcklkLCBib29raW5nLnBhY2thZ2UuYWdlbnRJZCk7XG4gICAgfVxuXG4gICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoXG4gICAgICBbLi4ubmV3IFNldChyZWNpcGllbnRzKV0ubWFwKChyZWNpcGllbnRJZCkgPT5cbiAgICAgICAgbm90aWZ5KFxuICAgICAgICAgIHJlY2lwaWVudElkLFxuICAgICAgICAgIE5vdGlmaWNhdGlvblR5cGUuQk9PS0lOR19DQU5DRUxMRUQsXG4gICAgICAgICAgXCJCb29raW5nIGNhbmNlbGxlZFwiLFxuICAgICAgICAgIGBUaGUgYm9va2luZyBmb3IgXCIke2Jvb2tpbmcucGFja2FnZS50aXRsZX1cIiBoYXMgYmVlbiBjYW5jZWxsZWQuYCxcbiAgICAgICAgICBgL2Rhc2hib2FyZC9ib29raW5ncy8ke2lkfWAsXG4gICAgICAgICksXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLnVwZGF0ZWQsXG4gICAgdG90YWxQcmljZTogTnVtYmVyKHVwZGF0ZWQudG90YWxQcmljZSksXG4gICAgLi4uKHJlZnVuZCA/IHsgcmVmdW5kIH0gOiB7fSksXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgYm9va2luZ1NlcnZpY2UgPSB7XG4gIGNyZWF0ZUJvb2tpbmcsXG4gIGdldE15Qm9va2luZ3MsXG4gIGdldEFnZW50Qm9va2luZ3MsXG4gIGdldEFsbEJvb2tpbmdzLFxuICBnZXRCb29raW5nRGV0YWlsLFxuICB1cGRhdGVCb29raW5nU3RhdHVzLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCBjcmVhdGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxuICB0cmF2ZWxEYXRlOiB6LmNvZXJjZS5kYXRlKHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJUcmF2ZWwgZGF0ZSBpcyByZXF1aXJlZFwiLFxuICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJUcmF2ZWwgZGF0ZSBtdXN0IGJlIGEgdmFsaWQgZGF0ZVwiLFxuICB9KS5yZWZpbmUoXG4gICAgKGRhdGUpID0+IHtcbiAgICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICAgIGNvbnN0IHRyYXZlbERheSA9IG5ldyBEYXRlKFxuICAgICAgICBEYXRlLlVUQyhcbiAgICAgICAgICBkYXRlLmdldFVUQ0Z1bGxZZWFyKCksXG4gICAgICAgICAgZGF0ZS5nZXRVVENNb250aCgpLFxuICAgICAgICAgIGRhdGUuZ2V0VVRDRGF0ZSgpLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IHRvZGF5VVRDID0gbmV3IERhdGUoXG4gICAgICAgIERhdGUuVVRDKFxuICAgICAgICAgIHRvZGF5LmdldFVUQ0Z1bGxZZWFyKCksXG4gICAgICAgICAgdG9kYXkuZ2V0VVRDTW9udGgoKSxcbiAgICAgICAgICB0b2RheS5nZXRVVENEYXRlKCksXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRyYXZlbERheS5nZXRUaW1lKCkgPj0gdG9kYXlVVEMuZ2V0VGltZSgpO1xuICAgIH0sXG4gICAgeyBtZXNzYWdlOiBcIlRyYXZlbCBkYXRlIGNhbm5vdCBiZSBpbiB0aGUgcGFzdC5cIiB9LFxuICApLFxuICB0cmF2ZWxlcnM6IHpcbiAgICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiVHJhdmVsZXJzIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAuaW50KFwiVHJhdmVsZXJzIG11c3QgYmUgYSB3aG9sZSBudW1iZXJcIilcbiAgICAubWluKDEsIFwiVHJhdmVsZXJzIG11c3QgYmUgYXQgbGVhc3QgMVwiKVxuICAgIC5tYXgoMjAsIFwiVHJhdmVsZXJzIG11c3QgYmUgYXQgbW9zdCAyMFwiKSxcbn0pO1xuXG5jb25zdCBib29raW5nUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJCb29raW5nIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oQm9va2luZ1N0YXR1cykub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBib29raW5nU2VhcmNoUXVlcnlTY2hlbWEgPSBib29raW5nUXVlcnlTY2hlbWEuZXh0ZW5kKHtcbiAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oQm9va2luZ1N0YXR1cywge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgc3RhdHVzXCIsXG4gIH0pLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRDcmVhdGVCb29raW5nU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY3JlYXRlU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRCb29raW5nUXVlcnlTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBib29raW5nUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUVXBkYXRlU3RhdHVzU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXBkYXRlU3RhdHVzU2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlU2NoZW1hLFxuICBib29raW5nUGFyYW1zU2NoZW1hLFxuICBib29raW5nUXVlcnlTY2hlbWEsXG4gIGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHJldmlld0NvbnRyb2xsZXIgfSBmcm9tIFwiLi9yZXZpZXcuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgcmV2aWV3VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9yZXZpZXcudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IChVU0VSIG9ubHkpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcmV2aWV3VmFsaWRhdGlvbnMuY3JlYXRlUmV2aWV3U2NoZW1hIH0pLFxuICByZXZpZXdDb250cm9sbGVyLmNyZWF0ZVJldmlldyxcbik7XG5cbi8vIDIuIExpc3QgcmV2aWV3cyBmb3IgYSBwYWNrYWdlIChwdWJsaWMpXG5yb3V0ZXIuZ2V0KFxuICBcIi9wYWNrYWdlLzpwYWNrYWdlSWRcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHJldmlld1ZhbGlkYXRpb25zLnJldmlld1BhcmFtc1NjaGVtYSxcbiAgICBxdWVyeTogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3UXVlcnlTY2hlbWEsXG4gIH0pLFxuICByZXZpZXdDb250cm9sbGVyLmdldFBhY2thZ2VSZXZpZXdzLFxuKTtcblxuLy8gMy4gVXBkYXRlIGEgcmV2aWV3IChVU0VSLCBhdXRob3Igb25seSkgXHUyMDE0IHJlZ2lzdGVyZWQgYWZ0ZXIgL3BhY2thZ2UvOnBhY2thZ2VJZFxuLy8gICAgc28gdGhlIGxpdGVyYWwgYC9wYWNrYWdlYCBzZWdtZW50IGlzIG5ldmVyIHN3YWxsb3dlZCBieSBgLzppZGAuXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiByZXZpZXdWYWxpZGF0aW9ucy5yZXZpZXdJZFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiByZXZpZXdWYWxpZGF0aW9ucy51cGRhdGVSZXZpZXdTY2hlbWEsXG4gIH0pLFxuICByZXZpZXdDb250cm9sbGVyLnVwZGF0ZVJldmlldyxcbik7XG5cbi8vIDQuIERlbGV0ZSBhIHJldmlldyAoYXV0aG9yIG9yIEFETUlOKVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiByZXZpZXdWYWxpZGF0aW9ucy5yZXZpZXdJZFBhcmFtc1NjaGVtYSB9KSxcbiAgcmV2aWV3Q29udHJvbGxlci5kZWxldGVSZXZpZXcsXG4pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3Um91dGVzID0gcm91dGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyByZXZpZXdTZXJ2aWNlIH0gZnJvbSBcIi4vcmV2aWV3LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgY29udHJvbGxlciAoVVNFUiBvbmx5KVxuY29uc3QgY3JlYXRlUmV2aWV3ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmV2aWV3U2VydmljZS5jcmVhdGVSZXZpZXcodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJSZXZpZXcgc3VibWl0dGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIExpc3QgcGFja2FnZSByZXZpZXdzIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGdldFBhY2thZ2VSZXZpZXdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUlkID0gU3RyaW5nKHJlcS5wYXJhbXMucGFja2FnZUlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXZpZXdTZXJ2aWNlLmxpc3RQYWNrYWdlUmV2aWV3cyhwYWNrYWdlSWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFVwZGF0ZSBhIHJldmlldyBjb250cm9sbGVyIChVU0VSLCBhdXRob3Igb25seSlcbmNvbnN0IHVwZGF0ZVJldmlldyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJldmlld1NlcnZpY2UudXBkYXRlUmV2aWV3KHVzZXJJZCwgaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJSZXZpZXcgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBEZWxldGUgYSByZXZpZXcgY29udHJvbGxlciAoYXV0aG9yIG9yIEFETUlOKVxuY29uc3QgZGVsZXRlUmV2aWV3ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3Qgcm9sZSA9IHJlcS51c2VyIS5yb2xlO1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJldmlld1NlcnZpY2UuZGVsZXRlUmV2aWV3KHVzZXJJZCwgcm9sZSwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlJldmlldyBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCByZXZpZXdDb250cm9sbGVyID0ge1xuICBjcmVhdGVSZXZpZXcsXG4gIGdldFBhY2thZ2VSZXZpZXdzLFxuICB1cGRhdGVSZXZpZXcsXG4gIGRlbGV0ZVJldmlldyxcbn07XG4iLCAiaW1wb3J0IHsgUGFja2FnZVN0YXR1cywgQm9va2luZ1N0YXR1cywgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHtcbiAgSUNyZWF0ZVJldmlld1BheWxvYWQsXG4gIElSZXZpZXdRdWVyeSxcbiAgSVVwZGF0ZVJldmlld1BheWxvYWQsXG59IGZyb20gXCIuL3Jldmlldy5pbnRlcmZhY2VcIjtcblxuLy8gU2hhcmVkIHJhdGluZyByZWNvbXB1dGUgXHUyMDE0IHRoZSBzaW5nbGUgc291cmNlIG9mIHRydXRoIGZvciB0aGUgcGFja2FnZVxuLy8gYXZlcmFnZS4gY3JlYXRlL3VwZGF0ZS9kZWxldGUgYWxsIGNhbGwgaXQgaW5zaWRlIHRoZWlyIG93biB0cmFuc2FjdGlvbiwgYW5kXG4vLyB0aGUgYWdncmVnYXRlIGFsd2F5cyBmaWx0ZXJzIGBpc0RlbGV0ZWQ6IGZhbHNlYCBzbyBhIHJlbW92ZWQgcmF0aW5nIG5ldmVyXG4vLyBjb3VudHMgKG90aGVyd2lzZSBkZWxldGUgd291bGQgcmVjb21wdXRlIGFuIHVuY2hhbmdlZCBhdmVyYWdlKS5cbmNvbnN0IHJlY29tcHV0ZVBhY2thZ2VSYXRpbmcgPSBhc3luYyAoXG4gIHR4OiBQcmlzbWEuVHJhbnNhY3Rpb25DbGllbnQsXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuKTogUHJvbWlzZTxudW1iZXI+ID0+IHtcbiAgY29uc3QgeyBfYXZnIH0gPSBhd2FpdCB0eC5yZXZpZXcuYWdncmVnYXRlKHtcbiAgICB3aGVyZTogeyBwYWNrYWdlSWQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBfYXZnOiB7IHJhdGluZzogdHJ1ZSB9LFxuICB9KTtcblxuICBjb25zdCByYXRpbmcgPSBNYXRoLnJvdW5kKChfYXZnLnJhdGluZyA/PyAwKSAqIDEwKSAvIDEwO1xuXG4gIGF3YWl0IHR4LnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGE6IHsgcmF0aW5nIH0sXG4gIH0pO1xuXG4gIHJldHVybiByYXRpbmc7XG59O1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgKFVTRVIgb25seSkgXHUyMDE0IGdhdGVkLCB1bmlxdWUgcGVyIHVzZXIrcGFja2FnZSwgYW5kXG4vLyAgICByZWNhbGN1bGF0ZXMgdGhlIHBhY2thZ2UgcmF0aW5nIGluIHRoZSBzYW1lIHRyYW5zYWN0aW9uLlxuY29uc3QgY3JlYXRlUmV2aWV3ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBJQ3JlYXRlUmV2aWV3UGF5bG9hZCkgPT4ge1xuICByZXR1cm4gcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICAvLyBQYWNrYWdlIG11c3QgZXhpc3QsIGJlIGFwcHJvdmVkLCBhbmQgbm90IGJlIGRlbGV0ZWQgXHUyMDE0IGEgcmV2aWV3IG9mIGFcbiAgICAvLyBwZW5kaW5nL3JlamVjdGVkL2RlbGV0ZWQgcGFja2FnZSBpcyBub25zZW5zZS5cbiAgICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHR4LnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICBpZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIGFnZW50SWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghdG91clBhY2thZ2UpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIC8vIE5vIHNlbGYtcmV2aWV3IFx1MjAxNCBhbiBhZ2VudCByYXRpbmcgdGhlaXIgb3duIHBhY2thZ2UgaXMgYSBjb25mbGljdCBvZiBpbnRlcmVzdC5cbiAgICBpZiAodG91clBhY2thZ2UuYWdlbnRJZCA9PT0gdXNlcklkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW5ub3QgcmV2aWV3IHlvdXIgb3duIHBhY2thZ2UuXCIpO1xuICAgIH1cblxuICAgIC8vIE9ubHkgY3VzdG9tZXJzIHdpdGggYSBjb21wbGV0ZWQgYm9va2luZyBtYXkgcmV2aWV3LlxuICAgIGNvbnN0IGNvbXBsZXRlZEJvb2tpbmcgPSBhd2FpdCB0eC5ib29raW5nLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICAgIHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQsXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIWNvbXBsZXRlZEJvb2tpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAzLFxuICAgICAgICBcIllvdSBjYW4gb25seSByZXZpZXcgYSBwYWNrYWdlIGFmdGVyIGNvbXBsZXRpbmcgYSBib29raW5nLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBGcmllbmRseSBkdXBsaWNhdGUgY2hlY2sgXHUyMDE0IEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pIGJhY2tzdG9wcyBhbnlcbiAgICAvLyByYWNlIHZpYSBQMjAwMiAobWFwcGVkIHRvIDQwOSBieSB0aGUgZ2xvYmFsIGhhbmRsZXIpLiBEZWxpYmVyYXRlbHkgTk9UXG4gICAgLy8gZmlsdGVyZWQgYnkgaXNEZWxldGVkOiBzb2Z0IGRlbGV0ZSBrZWVwcyB0aGUgcm93LCBzbyByZS1yZXZpZXdpbmcgYWZ0ZXJcbiAgICAvLyBhIGRlbGV0ZSBzdGlsbCBmYWlscyB3aXRoIHRoaXMgZnJpZW5kbHkgNDA5LlxuICAgIGNvbnN0IGV4aXN0aW5nUmV2aWV3ID0gYXdhaXQgdHgucmV2aWV3LmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZTogeyB1c2VySWQsIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKGV4aXN0aW5nUmV2aWV3KSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIllvdSBoYXZlIGFscmVhZHkgcmV2aWV3ZWQgdGhpcyBwYWNrYWdlLlwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBjcmVhdGVkUmV2aWV3ID0gYXdhaXQgdHgucmV2aWV3LmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgICAgcmF0aW5nOiBwYXlsb2FkLnJhdGluZyxcbiAgICAgICAgY29tbWVudDogcGF5bG9hZC5jb21tZW50LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJhdGluZyA9IGF3YWl0IHJlY29tcHV0ZVBhY2thZ2VSYXRpbmcodHgsIHBheWxvYWQucGFja2FnZUlkKTtcblxuICAgIHJldHVybiB7IHJldmlldzogY3JlYXRlZFJldmlldywgcmF0aW5nIH07XG4gIH0pO1xufTtcblxuLy8gMi4gTGlzdCByZXZpZXdzIGZvciBhIHBhY2thZ2UgKHB1YmxpYykgXHUyMDE0IHBhZ2luYXRlZDsgdGhlIHBhY2thZ2UgbXVzdCBiZVxuLy8gICAgYXBwcm92ZWQgYW5kIG5vdCBkZWxldGVkIHNvIHVucHVibGlzaGVkIHBhY2thZ2UgcmV2aWV3cyBuZXZlciBsZWFrLlxuLy8gICAgRGVsZXRlZCByZXZpZXdzIGFyZSBleGNsdWRlZCBzbyBhIHJlbW92ZWQgcmF0aW5nIHN0b3BzIGNvdW50aW5nLlxuY29uc3QgbGlzdFBhY2thZ2VSZXZpZXdzID0gYXN5bmMgKFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcXVlcnk6IElSZXZpZXdRdWVyeSxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7XG4gICAgICBpZDogcGFja2FnZUlkLFxuICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlID0geyBwYWNrYWdlSWQsIGlzRGVsZXRlZDogZmFsc2UgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5yZXZpZXcuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBzZWxlY3Q6IHtcbiAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgIHJhdGluZzogdHJ1ZSxcbiAgICAgICAgY29tbWVudDogdHJ1ZSxcbiAgICAgICAgY3JlYXRlZEF0OiB0cnVlLFxuICAgICAgICB1cGRhdGVkQXQ6IHRydWUsXG4gICAgICAgIHVzZXI6IHsgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGF2YXRhclVybDogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnJldmlldy5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFVwZGF0ZSBhIHJldmlldyAoVVNFUiwgYXV0aG9yIG9ubHkpLiBBIGZvcmVpZ24gaWQgb3IgYSByZW1vdmVkIHJldmlldyBpc1xuLy8gICAgYSB1bmlmb3JtIDQwNCBcdTIwMTQgbmV2ZXIgYSBsZWFrLiBUaGUgcGFja2FnZSBhdmVyYWdlIGlzIHJlY29tcHV0ZWQgaW4gdGhlXG4vLyAgICBzYW1lIHRyYW5zYWN0aW9uLlxuY29uc3QgdXBkYXRlUmV2aWV3ID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcmV2aWV3SWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVJldmlld1BheWxvYWQsXG4pID0+IHtcbiAgcmV0dXJuIHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCB0eC5yZXZpZXcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7IGlkOiByZXZpZXdJZCwgdXNlcklkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIHBhY2thZ2VJZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFleGlzdGluZykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJSZXZpZXcgbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgdHgucmV2aWV3LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcmV2aWV3SWQgfSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgLi4uKHBheWxvYWQucmF0aW5nICE9PSB1bmRlZmluZWQgPyB7IHJhdGluZzogcGF5bG9hZC5yYXRpbmcgfSA6IHt9KSxcbiAgICAgICAgLi4uKHBheWxvYWQuY29tbWVudCAhPT0gdW5kZWZpbmVkID8geyBjb21tZW50OiBwYXlsb2FkLmNvbW1lbnQgfSA6IHt9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBhd2FpdCByZWNvbXB1dGVQYWNrYWdlUmF0aW5nKHR4LCBleGlzdGluZy5wYWNrYWdlSWQpO1xuXG4gICAgLy8gVGhlIHJlc3BvbnNlJ3MgcmF0aW5nIGlzIHRoZSBhdXRob3JpdGF0aXZlIHZhbHVlIGZyb20gdGhlIHBhY2thZ2Ugcm93LFxuICAgIC8vIG5vdCB0aGUgaW5wdXQgXHUyMDE0IHRoZSBjbGllbnQncyBkaXNwbGF5ZWQgYXZlcmFnZSBpcyBuZXZlciBzdGFsZS5cbiAgICBjb25zdCBmcmVzaCA9IGF3YWl0IHR4LnRvdXJQYWNrYWdlLmZpbmRVbmlxdWUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IGV4aXN0aW5nLnBhY2thZ2VJZCB9LFxuICAgICAgc2VsZWN0OiB7IHJhdGluZzogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgcmV2aWV3OiB1cGRhdGVkLCByYXRpbmc6IGZyZXNoPy5yYXRpbmcgPz8gMCB9O1xuICB9KTtcbn07XG5cbi8vIDQuIFNvZnQgZGVsZXRlIGEgcmV2aWV3IChhdXRob3Igb3IgQURNSU4pIFx1MjAxNCB0aGUgYXZlcmFnZSBpcyByZWNvbXB1dGVkIHNvIHRoZVxuLy8gICAgcmVtb3ZlZCByYXRpbmcgc3RvcHMgY291bnRpbmcuIEZvcmVpZ24gaWQgLyByZXBlYXQgZGVsZXRlIFx1MjE5MiB1bmlmb3JtIDQwNC5cbmNvbnN0IGRlbGV0ZVJldmlldyA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHJvbGU6IFJvbGUsXG4gIHJldmlld0lkOiBzdHJpbmcsXG4pID0+IHtcbiAgcmV0dXJuIHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCB0eC5yZXZpZXcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7IGlkOiByZXZpZXdJZCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBwYWNrYWdlSWQ6IHRydWUsIHVzZXJJZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFleGlzdGluZykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJSZXZpZXcgbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICBpZiAocm9sZSAhPT0gUm9sZS5BRE1JTiAmJiBleGlzdGluZy51c2VySWQgIT09IHVzZXJJZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJSZXZpZXcgbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICBjb25zdCByZW1vdmVkID0gYXdhaXQgdHgucmV2aWV3LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJldmlld0lkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHJlbW92ZWQuY291bnQgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUmV2aWV3IG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgcmF0aW5nID0gYXdhaXQgcmVjb21wdXRlUGFja2FnZVJhdGluZyh0eCwgZXhpc3RpbmcucGFja2FnZUlkKTtcblxuICAgIHJldHVybiB7IHJldmlld0lkLCByYXRpbmcgfTtcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgcmV2aWV3U2VydmljZSA9IHtcbiAgY3JlYXRlUmV2aWV3LFxuICBsaXN0UGFja2FnZVJldmlld3MsXG4gIHVwZGF0ZVJldmlldyxcbiAgZGVsZXRlUmV2aWV3LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlUmV2aWV3U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWNrYWdlSWQ6IHpcbiAgICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC5taW4oMSwgXCJQYWNrYWdlIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxuICAgIHJhdGluZzogelxuICAgICAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIlJhdGluZyBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAuaW50KFwiUmF0aW5nIG11c3QgYmUgYSB3aG9sZSBudW1iZXJcIilcbiAgICAgIC5taW4oMSwgXCJSYXRpbmcgbXVzdCBiZSBhdCBsZWFzdCAxXCIpXG4gICAgICAubWF4KDUsIFwiUmF0aW5nIG11c3QgYmUgYXQgbW9zdCA1XCIpLFxuICAgIGNvbW1lbnQ6IHpcbiAgICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb21tZW50IGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC50cmltKClcbiAgICAgIC5taW4oMSwgXCJDb21tZW50IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gICAgICAubWF4KDEwMDAsIFwiQ29tbWVudCBtdXN0IGJlIGF0IG1vc3QgMTAwMCBjaGFyYWN0ZXJzXCIpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHJldmlld1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFja2FnZUlkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oMSwgXCJQYWNrYWdlIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxufSk7XG5cbmNvbnN0IHJldmlld1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVJldmlld1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcmF0aW5nOiB6XG4gICAgICAubnVtYmVyKHsgaW52YWxpZF90eXBlX2Vycm9yOiBcIlJhdGluZyBtdXN0IGJlIGEgbnVtYmVyXCIgfSlcbiAgICAgIC5pbnQoXCJSYXRpbmcgbXVzdCBiZSBhIHdob2xlIG51bWJlclwiKVxuICAgICAgLm1pbigxLCBcIlJhdGluZyBtdXN0IGJlIGF0IGxlYXN0IDFcIilcbiAgICAgIC5tYXgoNSwgXCJSYXRpbmcgbXVzdCBiZSBhdCBtb3N0IDVcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICAgIGNvbW1lbnQ6IHpcbiAgICAgIC5zdHJpbmcoeyBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiQ29tbWVudCBtdXN0IGJlIGEgc3RyaW5nXCIgfSlcbiAgICAgIC50cmltKClcbiAgICAgIC5taW4oMSwgXCJDb21tZW50IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gICAgICAubWF4KDEwMDAsIFwiQ29tbWVudCBtdXN0IGJlIGF0IG1vc3QgMTAwMCBjaGFyYWN0ZXJzXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IGRhdGEucmF0aW5nICE9PSB1bmRlZmluZWQgfHwgZGF0YS5jb21tZW50ICE9PSB1bmRlZmluZWQsIHtcbiAgICBtZXNzYWdlOiBcIkF0IGxlYXN0IG9uZSBvZiByYXRpbmcgb3IgY29tbWVudCBtdXN0IGJlIHByb3ZpZGVkXCIsXG4gIH0pO1xuXG5jb25zdCByZXZpZXdJZFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUmV2aWV3IGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiUmV2aWV3IGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxufSk7XG5cbmV4cG9ydCBjb25zdCByZXZpZXdWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlUmV2aWV3U2NoZW1hLFxuICByZXZpZXdQYXJhbXNTY2hlbWEsXG4gIHJldmlld1F1ZXJ5U2NoZW1hLFxuICB1cGRhdGVSZXZpZXdTY2hlbWEsXG4gIHJldmlld0lkUGFyYW1zU2NoZW1hLFxufTtcbiIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgY2F0ZWdvcnlDb250cm9sbGVyIH0gZnJvbSBcIi4vY2F0ZWdvcnkuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgY2F0ZWdvcnlWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2NhdGVnb3J5LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIExpc3QgYWxsIGNhdGVnb3JpZXMgKHB1YmxpYywgbm8gYXV0aClcbnJvdXRlci5nZXQoXCIvXCIsIGNhdGVnb3J5Q29udHJvbGxlci5nZXRBbGxDYXRlZ29yaWVzKTtcblxuLy8gMi4gQ3JlYXRlIGNhdGVnb3J5IChhZG1pbilcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogY2F0ZWdvcnlWYWxpZGF0aW9ucy5jcmVhdGVDYXRlZ29yeVNjaGVtYSB9KSxcbiAgY2F0ZWdvcnlDb250cm9sbGVyLmNyZWF0ZUNhdGVnb3J5LFxuKTtcblxuLy8gMy4gVXBkYXRlIGNhdGVnb3J5IChhZG1pbilcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBjYXRlZ29yeVZhbGlkYXRpb25zLmNhdGVnb3J5UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGNhdGVnb3J5VmFsaWRhdGlvbnMudXBkYXRlQ2F0ZWdvcnlTY2hlbWEsXG4gIH0pLFxuICBjYXRlZ29yeUNvbnRyb2xsZXIudXBkYXRlQ2F0ZWdvcnksXG4pO1xuXG4vLyA0LiBEZWxldGUgY2F0ZWdvcnkgKGFkbWluKVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogY2F0ZWdvcnlWYWxpZGF0aW9ucy5jYXRlZ29yeVBhcmFtc1NjaGVtYSB9KSxcbiAgY2F0ZWdvcnlDb250cm9sbGVyLmRlbGV0ZUNhdGVnb3J5LFxuKTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgY2F0ZWdvcnlTZXJ2aWNlIH0gZnJvbSBcIi4vY2F0ZWdvcnkuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIENyZWF0ZSBjYXRlZ29yeSBjb250cm9sbGVyIChhZG1pbilcbmNvbnN0IGNyZWF0ZUNhdGVnb3J5ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgY2F0ZWdvcnkgPSBhd2FpdCBjYXRlZ29yeVNlcnZpY2UuY3JlYXRlQ2F0ZWdvcnkocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiQ2F0ZWdvcnkgY3JlYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBjYXRlZ29yeSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdldCBhbGwgY2F0ZWdvcmllcyBjb250cm9sbGVyIChwdWJsaWMpXG5jb25zdCBnZXRBbGxDYXRlZ29yaWVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgY2F0ZWdvcmllcyA9IGF3YWl0IGNhdGVnb3J5U2VydmljZS5nZXRBbGxDYXRlZ29yaWVzKCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIGNhdGVnb3JpZXMgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBjYXRlZ29yaWVzLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gVXBkYXRlIGNhdGVnb3J5IGNvbnRyb2xsZXIgKGFkbWluKVxuY29uc3QgdXBkYXRlQ2F0ZWdvcnkgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLnVwZGF0ZUNhdGVnb3J5KGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ2F0ZWdvcnkgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBjYXRlZ29yeSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIERlbGV0ZSBjYXRlZ29yeSBjb250cm9sbGVyIChhZG1pbilcbmNvbnN0IGRlbGV0ZUNhdGVnb3J5ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBhd2FpdCBjYXRlZ29yeVNlcnZpY2UuZGVsZXRlQ2F0ZWdvcnkoaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeUNvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZUNhdGVnb3J5LFxuICBnZXRBbGxDYXRlZ29yaWVzLFxuICB1cGRhdGVDYXRlZ29yeSxcbiAgZGVsZXRlQ2F0ZWdvcnksXG59OyIsICIvLyBCYW5nbGEgKEJlbmdhbGkpIFx1MjE5MiBMYXRpbiBjb25zb25hbnQvdm93ZWwgbWFwLCBhcHBsaWVkIGJlZm9yZSBrZWJhYi1jYXNpbmcgc29cbi8vIEJhbmdsYS1oZWF2eSB0aXRsZXMgc3RpbGwgcHJvZHVjZSByZWFkYWJsZSBzbHVncyBpbnN0ZWFkIG9mIGJlaW5nIHN0cmlwcGVkIHRvXG4vLyBhbiBlbXB0eSBzdHJpbmcuXG5jb25zdCBCQU5HTEFfVE9fTEFUSU46IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIFx1MDk4NTogXCJvXCIsXG4gIFx1MDk4NjogXCJhXCIsXG4gIFx1MDk4NzogXCJpXCIsXG4gIFx1MDk4ODogXCJpXCIsXG4gIFx1MDk4OTogXCJ1XCIsXG4gIFx1MDk4QTogXCJ1XCIsXG4gIFx1MDk4QjogXCJyaVwiLFxuICBcdTA5OEY6IFwiZVwiLFxuICBcdTA5OTA6IFwib2lcIixcbiAgXHUwOTkzOiBcIm9cIixcbiAgXHUwOTk0OiBcIm91XCIsXG4gIFx1MDk5NTogXCJrYVwiLFxuICBcdTA5OTY6IFwia2hhXCIsXG4gIFx1MDk5NzogXCJnYVwiLFxuICBcdTA5OTg6IFwiZ2hhXCIsXG4gIFx1MDk5OTogXCJuZ2FcIixcbiAgXHUwOTlBOiBcImNoYVwiLFxuICBcdTA5OUI6IFwiY2hoYVwiLFxuICBcdTA5OUM6IFwiamFcIixcbiAgXHUwOTlEOiBcImpoYVwiLFxuICBcdTA5OUU6IFwibnlhXCIsXG4gIFx1MDk5RjogXCJ0YVwiLFxuICBcdTA5QTA6IFwidGhhXCIsXG4gIFx1MDlBMTogXCJkYVwiLFxuICBcdTA5QTI6IFwiZGhhXCIsXG4gIFx1MDlBMzogXCJuYVwiLFxuICBcdTA5QTQ6IFwidGFcIixcbiAgXHUwOUE1OiBcInRoYVwiLFxuICBcdTA5QTY6IFwiZGFcIixcbiAgXHUwOUE3OiBcImRoYVwiLFxuICBcdTA5QTg6IFwibmFcIixcbiAgXHUwOUFBOiBcInBhXCIsXG4gIFx1MDlBQjogXCJwaGFcIixcbiAgXHUwOUFDOiBcImJhXCIsXG4gIFx1MDlBRDogXCJiaGFcIixcbiAgXHUwOUFFOiBcIm1hXCIsXG4gIFx1MDlBRjogXCJ5YVwiLFxuICBcdTA5QjA6IFwicmFcIixcbiAgXHUwOUIyOiBcImxhXCIsXG4gIFx1MDlCNjogXCJzaGFcIixcbiAgXHUwOUI3OiBcInNoYVwiLFxuICBcdTA5Qjg6IFwic2FcIixcbiAgXHUwOUI5OiBcImhhXCIsXG4gIFx1MDlBMVx1MDlCQzogXCJyYVwiLFxuICBcdTA5QTJcdTA5QkM6IFwicmhhXCIsXG4gIFx1MDlBRlx1MDlCQzogXCJ5YVwiLFxuICBcIlx1MDk4MlwiOiBcIm5nXCIsXG4gIFwiXHUwOTgzXCI6IFwiaFwiLFxuICBcIlx1MDk4MVwiOiBcIlwiLFxuICBcIlx1MDlDRFwiOiBcIlwiLFxuICBcIlx1MDlDN1wiOiBcImVcIixcbiAgXCJcdTA5QzhcIjogXCJvaVwiLFxuICBcIlx1MDlDQlwiOiBcIm9cIixcbiAgXCJcdTA5Q0NcIjogXCJvdVwiLFxuICBcIlx1MDlCRVwiOiBcImFcIixcbiAgXCJcdTA5QkZcIjogXCJpXCIsXG4gIFwiXHUwOUMwXCI6IFwiaVwiLFxuICBcIlx1MDlDMVwiOiBcInVcIixcbiAgXCJcdTA5QzJcIjogXCJ1XCIsXG4gIFwiXHUwOUMzXCI6IFwicmlcIixcbn07XG5cbmNvbnN0IHRyYW5zbGl0ZXJhdGUgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nID0+XG4gIFsuLi50ZXh0XS5tYXAoKGNoYXIpID0+IEJBTkdMQV9UT19MQVRJTltjaGFyXSA/PyBjaGFyKS5qb2luKFwiXCIpO1xuXG4vLyBTaGFyZWQga2ViYWItY2FzZSBzbHVnaWZpZXIgdXNlZCBieSBDYXRlZ29yeSBhbmQgVG91clBhY2thZ2Ugc2x1Z3MuIE5vbi1MYXRpblxuLy8gc2NyaXB0cyAoZS5nLiBCYW5nbGEpIGFyZSB0cmFuc2xpdGVyYXRlZCBmaXJzdDsgaWYgdGhlIHJlc3VsdCBpcyBzdGlsbCBlbXB0eVxuLy8gdGhlIGNhbGxlciBtYXkgc3VwcGx5IGEgYGZhbGxiYWNrYCAoZS5nLiBcInBhY2thZ2UtPHNob3J0SWQ+XCIpLlxuZXhwb3J0IGNvbnN0IHNsdWdpZnkgPSAodGV4dDogc3RyaW5nLCBmYWxsYmFjaz86IHN0cmluZyk6IHN0cmluZyA9PiB7XG4gIGNvbnN0IHNsdWcgPSB0cmFuc2xpdGVyYXRlKHRleHQpXG4gICAgLnRvTG93ZXJDYXNlKClcbiAgICAudHJpbSgpXG4gICAgLnJlcGxhY2UoL1teXFx3XFxzLV0vZywgXCJcIilcbiAgICAucmVwbGFjZSgvW1xcc18tXSsvZywgXCItXCIpXG4gICAgLnJlcGxhY2UoL14tK3wtKyQvZywgXCJcIik7XG5cbiAgcmV0dXJuIHNsdWcgfHwgZmFsbGJhY2sgfHwgXCJcIjtcbn07IiwgImltcG9ydCB7IFBhY2thZ2VTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7IElDcmVhdGVDYXRlZ29yeSwgSVVwZGF0ZUNhdGVnb3J5IH0gZnJvbSBcIi4vY2F0ZWdvcnkuaW50ZXJmYWNlXCI7XG5cbi8vIEZyaWVuZGx5IDQwOSBmb3IgQHVuaXF1ZSBjb25mbGljdHMgKG5hbWUgb3Igc2x1ZykgaW5zdGVhZCBvZiBhIHJhdyBQMjAwMi5cbi8vIGV4Y2x1ZGVJZCBsZXRzIHVwZGF0ZXMgc2tpcCB0aGUgdmVyeSByb3cgYmVpbmcgZWRpdGVkIHNvIGEgbm8tb3AgcmVuYW1lXG4vLyBkb2Vzbid0IGZhbHNlLTQwOSBhZ2FpbnN0IGl0c2VsZi5cbmNvbnN0IGFzc2VydE5hbWVBdmFpbGFibGUgPSBhc3luYyAoXG4gIG5hbWU6IHN0cmluZyxcbiAgc2x1Zzogc3RyaW5nLFxuICBleGNsdWRlSWQ/OiBzdHJpbmcsXG4pID0+IHtcbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZEZpcnN0KHtcbiAgICB3aGVyZToge1xuICAgICAgT1I6IFt7IG5hbWUgfSwgeyBzbHVnIH1dLFxuICAgICAgLi4uKGV4Y2x1ZGVJZCA/IHsgTk9UOiB7IGlkOiBleGNsdWRlSWQgfSB9IDoge30pLFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmIChleGlzdGluZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiQSBjYXRlZ29yeSB3aXRoIHRoaXMgbmFtZSBhbHJlYWR5IGV4aXN0c1wiKTtcbiAgfVxufTtcblxuLy8gQ3JlYXRlIGNhdGVnb3J5IChhZG1pbilcbmNvbnN0IGNyZWF0ZUNhdGVnb3J5ID0gYXN5bmMgKHBheWxvYWQ6IElDcmVhdGVDYXRlZ29yeSkgPT4ge1xuICBjb25zdCB7IG5hbWUgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IHNsdWcgPSBzbHVnaWZ5KG5hbWUpO1xuXG4gIGF3YWl0IGFzc2VydE5hbWVBdmFpbGFibGUobmFtZSwgc2x1Zyk7XG5cbiAgcmV0dXJuIHByaXNtYS5jYXRlZ29yeS5jcmVhdGUoe1xuICAgIGRhdGE6IHsgbmFtZSwgc2x1ZyB9LFxuICB9KTtcbn07XG5cbi8vIEdldCBhbGwgY2F0ZWdvcmllcyAocHVibGljKSB3aXRoIGNvdW50cyBvZiBhcHByb3ZlZCwgbm9uLWRlbGV0ZWQgcGFja2FnZXNcbmNvbnN0IGdldEFsbENhdGVnb3JpZXMgPSBhc3luYyAoKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkuZmluZE1hbnkoe1xuICAgIG9yZGVyQnk6IHsgbmFtZTogXCJhc2NcIiB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIF9jb3VudDoge1xuICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICBwYWNrYWdlczoge1xuICAgICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcbn07XG5cbi8vIFVwZGF0ZSBjYXRlZ29yeSBuYW1lIChyZWdlbmVyYXRlcyBzbHVnKSAoYWRtaW4pXG5jb25zdCB1cGRhdGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcsIHBheWxvYWQ6IElVcGRhdGVDYXRlZ29yeSkgPT4ge1xuICBjb25zdCB7IG5hbWUgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IHNsdWcgPSBzbHVnaWZ5KG5hbWUpO1xuXG4gIGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kVW5pcXVlT3JUaHJvdyh7IHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0gfSk7XG4gIGF3YWl0IGFzc2VydE5hbWVBdmFpbGFibGUobmFtZSwgc2x1ZywgY2F0ZWdvcnlJZCk7XG5cbiAgcmV0dXJuIHByaXNtYS5jYXRlZ29yeS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0sXG4gICAgZGF0YTogeyBuYW1lLCBzbHVnIH0sXG4gIH0pO1xufTtcblxuLy8gRGVsZXRlIGNhdGVnb3J5IChhZG1pbikgXHUyMDE0IDQwOSB3aGVuIGFueSBwYWNrYWdlIHJlZmVyZW5jZXMgaXRcbmNvbnN0IGRlbGV0ZUNhdGVnb3J5ID0gYXN5bmMgKGNhdGVnb3J5SWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9IH0pO1xuXG4gIGNvbnN0IHBhY2thZ2VDb3VudCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7XG4gICAgd2hlcmU6IHsgY2F0ZWdvcnlJZCB9LFxuICB9KTtcblxuICBpZiAocGFja2FnZUNvdW50ID4gMCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwOSxcbiAgICAgIFwiQ2Fubm90IGRlbGV0ZSBjYXRlZ29yeSB3aXRoIGFzc29jaWF0ZWQgcGFja2FnZXMuIFJlbmFtZSBpdCBpbnN0ZWFkLlwiLFxuICAgICk7XG4gIH1cblxuICBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZGVsZXRlKHsgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeVNlcnZpY2UgPSB7XG4gIGNyZWF0ZUNhdGVnb3J5LFxuICBnZXRBbGxDYXRlZ29yaWVzLFxuICB1cGRhdGVDYXRlZ29yeSxcbiAgZGVsZXRlQ2F0ZWdvcnksXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBuYW1lU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ2F0ZWdvcnkgbmFtZSBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigyLCBcIkNhdGVnb3J5IG5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgLm1heCgxMDAsIFwiQ2F0ZWdvcnkgbmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGNyZWF0ZUNhdGVnb3J5U2NoZW1hID0gei5vYmplY3QoeyBuYW1lOiBuYW1lU2NoZW1hIH0pLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVDYXRlZ29yeVNjaGVtYSA9IHoub2JqZWN0KHsgbmFtZTogbmFtZVNjaGVtYSB9KS5zdHJpY3QoKTtcblxuY29uc3QgY2F0ZWdvcnlQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNhdGVnb3J5IGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeVZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVDYXRlZ29yeVNjaGVtYSxcbiAgdXBkYXRlQ2F0ZWdvcnlTY2hlbWEsXG4gIGNhdGVnb3J5UGFyYW1zU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHBhY2thZ2VDb250cm9sbGVyIH0gZnJvbSBcIi4vcGFja2FnZS5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBwYWNrYWdlVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9wYWNrYWdlLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE5PVEU6IGAvaW50ZXJuYWwvKmAgcm91dGVzIE1VU1Qgc3RheSByZWdpc3RlcmVkIGJlZm9yZSBgR0VUIC86c2x1Z2AgYmVsb3cgXHUyMDE0XG4vLyBFeHByZXNzIG1hdGNoZXMgdG9wLWRvd24sIGFuZCBhIGxpdGVyYWwgc2VnbWVudCAoYC9pbnRlcm5hbC9hbGxgKSB3b3VsZFxuLy8gb3RoZXJ3aXNlIGJlIHN3YWxsb3dlZCBieSB0aGUgYDpzbHVnYCBwYXJhbSByb3V0ZSBhbmQgNDA0IGZvcmV2ZXIuXG5cbi8vIDEuIE15IHBhY2thZ2VzIChhZ2VudCkgXHUyMDE0IHNlbGYtcHJldmlldyBvZiBQRU5ESU5HL1JFSkVDVEVEIGJlZm9yZSBhcHByb3ZhbFxucm91dGVyLmdldChcbiAgXCIvaW50ZXJuYWwvbXktcGFja2FnZXNcIixcbiAgYXV0aChSb2xlLkFHRU5UKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHBhY2thZ2VWYWxpZGF0aW9ucy5pbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0TXlQYWNrYWdlcyxcbik7XG5cbi8vIDIuIEFsbCBwYWNrYWdlcyAoYWRtaW4gbW9kZXJhdGlvbiBVSSlcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL2FsbFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogcGFja2FnZVZhbGlkYXRpb25zLmludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRBbGxQYWNrYWdlcyxcbik7XG5cbi8vIDMuIFB1YmxpYyBwYWNrYWdlIGRldGFpbCBieSBzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi86c2x1Z1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlU2x1Z1BhcmFtc1NjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0UGFja2FnZUJ5U2x1Zyxcbik7XG5cbi8vIDQuIENyZWF0ZSBwYWNrYWdlIChhZ2VudCBjcmVhdGVzIG93bjsgYWRtaW4gY2FuIGNyZWF0ZSBmb3IgYW55IGFnZW50KVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBwYWNrYWdlVmFsaWRhdGlvbnMuY3JlYXRlUGFja2FnZVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuY3JlYXRlUGFja2FnZSxcbik7XG5cbi8vIDUuIEFwcHJvdmUvcmVqZWN0IHBhY2thZ2UgKGFkbWluKSBcdTIwMTQgcmVnaXN0ZXJlZCBiZWZvcmUgUEFUQ0ggLzppZCBmb3IgY2xhcml0eVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBwYWNrYWdlVmFsaWRhdGlvbnMudXBkYXRlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuY2hhbmdlUGFja2FnZVN0YXR1cyxcbik7XG5cbi8vIDYuIFVwZGF0ZSBwYWNrYWdlIChhZ2VudCBvd24gLyBhZG1pbiBhbnkpXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLnVwZGF0ZVBhY2thZ2VTY2hlbWEsXG4gIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci51cGRhdGVQYWNrYWdlLFxuKTtcblxuLy8gNy4gU29mdCBkZWxldGUgcGFja2FnZSAoYWdlbnQgb3duIC8gYWRtaW4gYW55KVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VQYXJhbXNTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLnNvZnREZWxldGVQYWNrYWdlLFxuKTtcblxuLy8gOC4gUHVibGljIGxpc3RpbmcgXHUyMDE0IGtlcHQgbGFzdCBzbyBub25lIG9mIHRoZSBhYm92ZSByb3V0ZXMgYXJlIHNoYWRvd2VkXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUXVlcnlTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldFB1YmxpY1BhY2thZ2VzLFxuKTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBwYWNrYWdlU2VydmljZSB9IGZyb20gXCIuL3BhY2thZ2Uuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBwYWNrYWdlIGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgY3JlYXRlUGFja2FnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmNyZWF0ZVBhY2thZ2UocmVxLnVzZXIhLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LiBJdCB3aWxsIGJlIHZpc2libGUgYWZ0ZXIgYWRtaW4gYXBwcm92YWwuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBQdWJsaWMgbGlzdGluZyBjb250cm9sbGVyIChmaWx0ZXJzICsgcGFnaW5hdGlvbilcbmNvbnN0IGdldFB1YmxpY1BhY2thZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0UHVibGljUGFja2FnZXMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFB1YmxpYyBwYWNrYWdlIGRldGFpbCBieSBzbHVnXG5jb25zdCBnZXRQYWNrYWdlQnlTbHVnID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3Qgc2x1ZyA9IFN0cmluZyhyZXEucGFyYW1zLnNsdWcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldFBhY2thZ2VCeVNsdWcoc2x1Zyk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNC4gQWxsIHBhY2thZ2VzIGNvbnRyb2xsZXIgKEFETUlOIG1vZGVyYXRpb24pXG5jb25zdCBnZXRBbGxQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldEFsbFBhY2thZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIHBhY2thZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNS4gTXkgcGFja2FnZXMgY29udHJvbGxlciAoQUdFTlQpXG5jb25zdCBnZXRNeVBhY2thZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0TXlQYWNrYWdlcyh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiWW91ciBwYWNrYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDYuIFVwZGF0ZSBwYWNrYWdlIGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHVwZGF0ZVBhY2thZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS51cGRhdGVQYWNrYWdlKHJlcS51c2VyISwgaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNy4gQ2hhbmdlIHBhY2thZ2Ugc3RhdHVzIGNvbnRyb2xsZXIgKEFETUlOIGFwcHJvdmUvcmVqZWN0KVxuY29uc3QgY2hhbmdlUGFja2FnZVN0YXR1cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmNoYW5nZVBhY2thZ2VTdGF0dXMoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDguIFNvZnQgZGVsZXRlIHBhY2thZ2UgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3Qgc29mdERlbGV0ZVBhY2thZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBhd2FpdCBwYWNrYWdlU2VydmljZS5zb2Z0RGVsZXRlUGFja2FnZShyZXEudXNlciEsIGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlQ29udHJvbGxlciA9IHtcbiAgY3JlYXRlUGFja2FnZSxcbiAgZ2V0UHVibGljUGFja2FnZXMsXG4gIGdldFBhY2thZ2VCeVNsdWcsXG4gIGdldEFsbFBhY2thZ2VzLFxuICBnZXRNeVBhY2thZ2VzLFxuICB1cGRhdGVQYWNrYWdlLFxuICBjaGFuZ2VQYWNrYWdlU3RhdHVzLFxuICBzb2Z0RGVsZXRlUGFja2FnZSxcbn07IiwgImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcbmltcG9ydCB7IFBhY2thZ2VTdGF0dXMsIFJvbGUsIE5vdGlmaWNhdGlvblR5cGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IG5vdGlmeSB9IGZyb20gXCIuLi8uLi91dGlscy9ub3RpZmljYXRpb25cIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2x1Z2lmeVwiO1xuaW1wb3J0IHtcbiAgSUNyZWF0ZVBhY2thZ2VQYXlsb2FkLFxuICBJSW50ZXJuYWxQYWNrYWdlUXVlcnksXG4gIElQYWNrYWdlUXVlcnksXG4gIElSZXF1ZXN0VXNlcixcbiAgSVVwZGF0ZVBhY2thZ2VQYXlsb2FkLFxuICBJVXBkYXRlU3RhdHVzUGF5bG9hZCxcbn0gZnJvbSBcIi4vcGFja2FnZS5pbnRlcmZhY2VcIjtcblxuLy8gTW9uZXkgaXMgYERlY2ltYWwoMTAsMilgIGluIHRoZSBzY2hlbWEgKEFHRU5UUy5tZCkgXHUyMDE0IG1hcCB0byBOdW1iZXIgb24gcmV0dXJuLlxuY29uc3Qgc2VyaWFsaXplUHJpY2UgPSA8VCBleHRlbmRzIHsgcHJpY2U6IFByaXNtYS5EZWNpbWFsIH0+KHJvdzogVCk6IFQgPT4gKHtcbiAgLi4ucm93LFxuICBwcmljZTogTnVtYmVyKHJvdy5wcmljZSksXG59KTtcblxuLy8gUHVibGljIHBheWxvYWRzIGNhcnJ5IHRoZSBhZ2VudCdzIGRpc3BsYXkgaW5mbyBvbmx5IFx1MjAxNCBuZXZlciBlbWFpbC5cbmV4cG9ydCBjb25zdCBwdWJsaWNQYWNrYWdlSW5jbHVkZSA9IHtcbiAgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgYWdlbnQ6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSB9LFxufSBhcyBjb25zdDtcblxuY29uc3QgdmFsaWRhdGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2F0ZWdvcnkgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCFjYXRlZ29yeSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBjYXRlZ29yeUlkXCIpO1xuICB9XG59O1xuXG4vLyBQYWNrYWdlcyBtdXN0IGJlIG93bmVkIGJ5IGEgbGl2ZSBBR0VOVCBcdTIwMTQgb3RoZXJ3aXNlIHRoZSBib29raW5nIHN0YXRlXG4vLyBtYWNoaW5lJ3MgXCJBR0VOVCAob3ducyBwYWNrYWdlKVwiIGJyYW5jaCBhbmQgYWdlbnQtYm9va2luZ3Mgc2NvcGluZyBicmVhay5cbmNvbnN0IHZhbGlkYXRlQWdlbnQgPSBhc3luYyAoYWdlbnRJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGFnZW50ID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGFnZW50SWQgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIHJvbGU6IHRydWUsIGlzRGVsZXRlZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIWFnZW50IHx8IGFnZW50LnJvbGUgIT09IFJvbGUuQUdFTlQgfHwgYWdlbnQuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGFnZW50SWRcIik7XG4gIH1cbn07XG5cbi8vIENvbGxpc2lvbi1zYWZlIHNsdWc6IGJhc2Ugc2x1ZyBmcm9tIHRoZSB0aXRsZSwgdGhlbiBgLTJgLCBgLTNgLCAuLi4gdXNpbmcgYVxuLy8gc2luZ2xlIHByZWZpeCBxdWVyeS4gUHVyZS1CYW5nbGEvZW1vamkgdGl0bGVzIGNhbid0IHNsdWdpZnkgXHUyMDE0IGZhbGwgYmFjayB0b1xuLy8gYHBhY2thZ2UtPHNob3J0SWQ+YCBzbyB0aGUgVVJMIGlzIGFsd2F5cyBtZWFuaW5nZnVsLlxuY29uc3QgZ2VuZXJhdGVVbmlxdWVTbHVnID0gYXN5bmMgKHRpdGxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICBjb25zdCBiYXNlID0gc2x1Z2lmeSh0aXRsZSkgfHwgYHBhY2thZ2UtJHtyYW5kb21VVUlEKCkuc2xpY2UoMCwgOCl9YDtcblxuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgd2hlcmU6IHsgc2x1ZzogeyBzdGFydHNXaXRoOiBiYXNlIH0gfSxcbiAgICBzZWxlY3Q6IHsgc2x1ZzogdHJ1ZSB9LFxuICB9KTtcblxuICBjb25zdCB1c2VkID0gbmV3IFNldChleGlzdGluZy5tYXAoKHApID0+IHAuc2x1ZykpO1xuICBpZiAoIXVzZWQuaGFzKGJhc2UpKSB7XG4gICAgcmV0dXJuIGJhc2U7XG4gIH1cblxuICBsZXQgc3VmZml4ID0gMjtcbiAgd2hpbGUgKHVzZWQuaGFzKGAke2Jhc2V9LSR7c3VmZml4fWApKSB7XG4gICAgc3VmZml4ICs9IDE7XG4gIH1cbiAgcmV0dXJuIGAke2Jhc2V9LSR7c3VmZml4fWA7XG59O1xuXG4vLyAxLiBDcmVhdGUgYSBwYWNrYWdlIChBR0VOVC9BRE1JTikuIE5ldyBwYWNrYWdlcyBzdGFydCBQRU5ESU5HIGFuZCBuZXZlciBsZWFrXG4vLyAgICBpbnRvIHB1YmxpYyBxdWVyaWVzIHVudGlsIGFuIGFkbWluIGFwcHJvdmVzIHRoZW0uXG5jb25zdCBjcmVhdGVQYWNrYWdlID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGF5bG9hZDogSUNyZWF0ZVBhY2thZ2VQYXlsb2FkKSA9PiB7XG4gIGF3YWl0IHZhbGlkYXRlQ2F0ZWdvcnkocGF5bG9hZC5jYXRlZ29yeUlkKTtcblxuICAvLyBBRE1JTiBtYXkgY3JlYXRlIG9uIGJlaGFsZiBvZiBhbiBhZ2VudCAob3B0aW9uYWwgYWdlbnRJZCk7IEFHRU5UIGFsd2F5c1xuICAvLyBvd25zIHdoYXQgdGhleSBjcmVhdGUgYW5kIG1heSBub3QgaW1wZXJzb25hdGUgYW5vdGhlciB1c2VyLlxuICBsZXQgYWdlbnRJZDogc3RyaW5nO1xuICBpZiAodXNlci5yb2xlID09PSBSb2xlLkFETUlOKSB7XG4gICAgaWYgKHBheWxvYWQuYWdlbnRJZCkge1xuICAgICAgYXdhaXQgdmFsaWRhdGVBZ2VudChwYXlsb2FkLmFnZW50SWQpO1xuICAgICAgYWdlbnRJZCA9IHBheWxvYWQuYWdlbnRJZDtcbiAgICB9IGVsc2Uge1xuICAgICAgYWdlbnRJZCA9IHVzZXIuaWQ7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChwYXlsb2FkLmFnZW50SWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiYWdlbnRJZCBjYW4gb25seSBiZSBzZXQgYnkgYW4gYWRtaW5cIik7XG4gICAgfVxuICAgIGFnZW50SWQgPSB1c2VyLmlkO1xuICB9XG5cbiAgY29uc3Qgc2x1ZyA9IGF3YWl0IGdlbmVyYXRlVW5pcXVlU2x1ZyhwYXlsb2FkLnRpdGxlKTtcblxuICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgdGl0bGU6IHBheWxvYWQudGl0bGUsXG4gICAgICBkZXNjcmlwdGlvbjogcGF5bG9hZC5kZXNjcmlwdGlvbixcbiAgICAgIGxvY2F0aW9uOiBwYXlsb2FkLmxvY2F0aW9uLFxuICAgICAgcHJpY2U6IHBheWxvYWQucHJpY2UsXG4gICAgICBkdXJhdGlvbjogcGF5bG9hZC5kdXJhdGlvbixcbiAgICAgIGNhdGVnb3J5SWQ6IHBheWxvYWQuY2F0ZWdvcnlJZCxcbiAgICAgIGltYWdlczogcGF5bG9hZC5pbWFnZXMsXG4gICAgICBhZ2VudElkLFxuICAgICAgc2x1ZyxcbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UoY3JlYXRlZCk7XG59O1xuXG4vLyAyLiBQdWJsaWMgZXhwbG9yZWQgbGlzdGluZyBcdTIwMTQgQVBQUk9WRUQgKyBub3QtZGVsZXRlZCBvbmx5LCBmaWx0ZXJzICsgc29ydGluZy5cbmNvbnN0IGdldFB1YmxpY1BhY2thZ2VzID0gYXN5bmMgKHF1ZXJ5OiBJUGFja2FnZVF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3QgZmlsdGVyczogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dFtdID0gW107XG5cbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICBPUjogW1xuICAgICAgICB7IHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgIHsgZGVzY3JpcHRpb246IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgeyBsb2NhdGlvbjogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubG9jYXRpb24pIHtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgbG9jYXRpb246IHsgY29udGFpbnM6IHF1ZXJ5LmxvY2F0aW9uLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubWluUHJpY2UgIT09IHVuZGVmaW5lZCB8fCBxdWVyeS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZmlsdGVycy5wdXNoKHtcbiAgICAgIHByaWNlOiB7XG4gICAgICAgIC4uLihxdWVyeS5taW5QcmljZSAhPT0gdW5kZWZpbmVkID8geyBndGU6IHF1ZXJ5Lm1pblByaWNlIH0gOiB7fSksXG4gICAgICAgIC4uLihxdWVyeS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkID8geyBsdGU6IHF1ZXJ5Lm1heFByaWNlIH0gOiB7fSksXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG4gIGlmIChxdWVyeS5taW5SYXRpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7IHJhdGluZzogeyBndGU6IHF1ZXJ5Lm1pblJhdGluZyB9IH0pO1xuICB9XG4gIGlmIChxdWVyeS5tYXhEdXJhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZmlsdGVycy5wdXNoKHsgZHVyYXRpb246IHsgbHRlOiBxdWVyeS5tYXhEdXJhdGlvbiB9IH0pO1xuICB9XG4gIGlmIChxdWVyeS5jYXRlZ29yeSkge1xuICAgIGZpbHRlcnMucHVzaCh7IGNhdGVnb3J5OiB7IHNsdWc6IHF1ZXJ5LmNhdGVnb3J5IH0gfSk7XG4gIH1cblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICBBTkQ6IGZpbHRlcnMubGVuZ3RoID4gMCA/IGZpbHRlcnMgOiB1bmRlZmluZWQsXG4gIH07XG5cbiAgY29uc3Qgc29ydE9yZGVyID0gcXVlcnkuc29ydE9yZGVyID8/IChxdWVyeS5zb3J0QnkgPT09IFwibmV3ZXN0XCIgPyBcImRlc2NcIiA6IFwiYXNjXCIpO1xuXG4gIGNvbnN0IG9yZGVyQnlNYXA6IFJlY29yZDxzdHJpbmcsIFByaXNtYS5Ub3VyUGFja2FnZU9yZGVyQnlXaXRoUmVsYXRpb25JbnB1dD4gPSB7XG4gICAgbmV3ZXN0OiB7IGNyZWF0ZWRBdDogc29ydE9yZGVyIH0sXG4gICAgcHJpY2U6IHsgcHJpY2U6IHNvcnRPcmRlciB9LFxuICAgIHJhdGluZzogeyByYXRpbmc6IHNvcnRPcmRlciB9LFxuICAgIHRpdGxlOiB7IHRpdGxlOiBzb3J0T3JkZXIgfSxcbiAgfTtcblxuICBjb25zdCBvcmRlckJ5ID0gb3JkZXJCeU1hcFtxdWVyeS5zb3J0QnkgPz8gXCJuZXdlc3RcIl0gPz8gb3JkZXJCeU1hcC5uZXdlc3Q7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5LFxuICAgICAgaW5jbHVkZTogcHVibGljUGFja2FnZUluY2x1ZGUsXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFB1YmxpYyBkZXRhaWwgYnkgc2x1ZyBcdTIwMTQgQVBQUk9WRUQgKyBub3QtZGVsZXRlZCBvbmx5LlxuY29uc3QgZ2V0UGFja2FnZUJ5U2x1ZyA9IGFzeW5jIChzbHVnOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZEZpcnN0KHtcbiAgICB3aGVyZTogeyBzbHVnLCBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBpbmNsdWRlOiBwdWJsaWNQYWNrYWdlSW5jbHVkZSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKHRvdXJQYWNrYWdlKTtcbn07XG5cbi8vIDQuIEFsbCBwYWNrYWdlcyBmb3IgdGhlIGFkbWluIG1vZGVyYXRpb24gVUkgKGFueSBzdGF0dXMsIG9wdGlvbmFsIGZpbHRlcnMpLlxuY29uc3QgZ2V0QWxsUGFja2FnZXMgPSBhc3luYyAocXVlcnk6IElJbnRlcm5hbFBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgICAuLi4ocXVlcnkuYWdlbnRJZCA/IHsgYWdlbnRJZDogcXVlcnkuYWdlbnRJZCB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICAgICAgICBhZ2VudDogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVQcmljZSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gNS4gQW4gYWdlbnQncyBvd24gcGFja2FnZXMgKGFueSBzdGF0dXMpIFx1MjAxNCBzZWxmLXByZXZpZXcgYmVmb3JlIGFwcHJvdmFsLlxuY29uc3QgZ2V0TXlQYWNrYWdlcyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElJbnRlcm5hbFBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0ID0ge1xuICAgIGFnZW50SWQ6IHVzZXJJZCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVQcmljZSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gRmV0Y2ggKyBvd25lcnNoaXAgZ2F0ZSBzaGFyZWQgYnkgUEFUQ0ggYW5kIERFTEVURS4gQURNSU4gYnlwYXNzZXMgb3duZXJzaGlwO1xuLy8gQUdFTlQgZWRpdHMgYXJlIGNvbmZpbmVkIHRvIHRoZWlyIG93biBwYWNrYWdlcy5cbmNvbnN0IGZpbmRPd25lZFBhY2thZ2UgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYWNrYWdlSWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGlmICh1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gJiYgdG91clBhY2thZ2UuYWdlbnRJZCAhPT0gdXNlci5pZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGNhbiBvbmx5IGFjdCBvbiB5b3VyIG93biBwYWNrYWdlcy5cIik7XG4gIH1cblxuICByZXR1cm4gdG91clBhY2thZ2U7XG59O1xuXG4vLyA2LiBVcGRhdGUgYSBwYWNrYWdlLiBTbHVnIG5ldmVyIGNoYW5nZXMgKGtlZXBzIGxpbmtzL2Jvb2ttYXJrcyB2YWxpZCkuXG4vLyAgICBBR0VOVCBlZGl0cyByZXNldCBzdGF0dXMgdG8gUEVORElORzsgQURNSU4gZWRpdHMgcHJlc2VydmUgaXQuXG5jb25zdCB1cGRhdGVQYWNrYWdlID0gYXN5bmMgKFxuICB1c2VyOiBJUmVxdWVzdFVzZXIsXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlUGFja2FnZVBheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBmaW5kT3duZWRQYWNrYWdlKHVzZXIsIHBhY2thZ2VJZCk7XG5cbiAgaWYgKHBheWxvYWQuY2F0ZWdvcnlJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgYXdhaXQgdmFsaWRhdGVDYXRlZ29yeShwYXlsb2FkLmNhdGVnb3J5SWQpO1xuICB9XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlSW5wdXQgPSB7XG4gICAgLi4uKHBheWxvYWQudGl0bGUgIT09IHVuZGVmaW5lZCA/IHsgdGl0bGU6IHBheWxvYWQudGl0bGUgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5kZXNjcmlwdGlvbiAhPT0gdW5kZWZpbmVkID8geyBkZXNjcmlwdGlvbjogcGF5bG9hZC5kZXNjcmlwdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmxvY2F0aW9uICE9PSB1bmRlZmluZWQgPyB7IGxvY2F0aW9uOiBwYXlsb2FkLmxvY2F0aW9uIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQucHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgcHJpY2U6IHBheWxvYWQucHJpY2UgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5kdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8geyBkdXJhdGlvbjogcGF5bG9hZC5kdXJhdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmltYWdlcyAhPT0gdW5kZWZpbmVkID8geyBpbWFnZXM6IHBheWxvYWQuaW1hZ2VzIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuY2F0ZWdvcnlJZCAhPT0gdW5kZWZpbmVkXG4gICAgICA/IHsgY2F0ZWdvcnk6IHsgY29ubmVjdDogeyBpZDogcGF5bG9hZC5jYXRlZ29yeUlkIH0gfSB9XG4gICAgICA6IHt9KSxcbiAgICAuLi4odXNlci5yb2xlICE9PSBSb2xlLkFETUlOID8geyBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuUEVORElORyB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YSxcbiAgICBpbmNsdWRlOiB7IGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0gfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKHVwZGF0ZWQpO1xufTtcblxuLy8gNy4gQXBwcm92ZS9yZWplY3QgYSBwYWNrYWdlIChhZG1pbikuXG5jb25zdCBjaGFuZ2VQYWNrYWdlU3RhdHVzID0gYXN5bmMgKFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVN0YXR1c1BheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZFVuaXF1ZU9yVGhyb3coe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG5cbiAgaWYgKHRvdXJQYWNrYWdlLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiQ2Fubm90IGNoYW5nZSB0aGUgc3RhdHVzIG9mIGEgZGVsZXRlZCBwYWNrYWdlLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YTogeyBzdGF0dXM6IHBheWxvYWQuc3RhdHVzIH0sXG4gIH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IGluLWFwcCBub3RpZmljYXRpb24gdG8gdGhlIHN1Ym1pdHRpbmcgYWdlbnQgKG5ldmVyIGZhaWxzIHJlcXVlc3QpXG4gIGNvbnN0IG5vdGlmaWVkID0ge1xuICAgIHR5cGU6XG4gICAgICBwYXlsb2FkLnN0YXR1cyA9PT0gUGFja2FnZVN0YXR1cy5BUFBST1ZFRFxuICAgICAgICA/IE5vdGlmaWNhdGlvblR5cGUuUEFDS0FHRV9BUFBST1ZFRFxuICAgICAgICA6IE5vdGlmaWNhdGlvblR5cGUuUEFDS0FHRV9SRUpFQ1RFRCxcbiAgICB0aXRsZTpcbiAgICAgIHBheWxvYWQuc3RhdHVzID09PSBQYWNrYWdlU3RhdHVzLkFQUFJPVkVEXG4gICAgICAgID8gXCJQYWNrYWdlIGFwcHJvdmVkXCJcbiAgICAgICAgOiBcIlBhY2thZ2UgcmVqZWN0ZWRcIixcbiAgICBtZXNzYWdlOlxuICAgICAgcGF5bG9hZC5zdGF0dXMgPT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgICAgICAgPyBgWW91ciBwYWNrYWdlIFwiJHt0b3VyUGFja2FnZS50aXRsZX1cIiBoYXMgYmVlbiBhcHByb3ZlZCBhbmQgaXMgbm93IGxpdmUuYFxuICAgICAgICA6IGBZb3VyIHBhY2thZ2UgXCIke3RvdXJQYWNrYWdlLnRpdGxlfVwiIHdhcyByZWplY3RlZC4gUGxlYXNlIHJldmlldyBhbmQgcmVzdWJtaXQuYCxcbiAgfTtcbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIG5vdGlmeShcbiAgICAgIHRvdXJQYWNrYWdlLmFnZW50SWQsXG4gICAgICBub3RpZmllZC50eXBlLFxuICAgICAgbm90aWZpZWQudGl0bGUsXG4gICAgICBub3RpZmllZC5tZXNzYWdlLFxuICAgICAgYC9kYXNoYm9hcmQvYWdlbnQvcGFja2FnZXMvJHtwYWNrYWdlSWR9YCxcbiAgICApLFxuICBdKTtcblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UodXBkYXRlZCk7XG59O1xuXG4vLyA4LiBTb2Z0IGRlbGV0ZSAoYWRtaW4gYW55LCBhZ2VudCBvd24pLlxuY29uc3Qgc29mdERlbGV0ZVBhY2thZ2UgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYWNrYWdlSWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBmaW5kT3duZWRQYWNrYWdlKHVzZXIsIHBhY2thZ2VJZCk7XG5cbiAgcmV0dXJuIHByaXNtYS50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSB9LFxuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlU2VydmljZSA9IHtcbiAgY3JlYXRlUGFja2FnZSxcbiAgZ2V0UHVibGljUGFja2FnZXMsXG4gIGdldFBhY2thZ2VCeVNsdWcsXG4gIGdldEFsbFBhY2thZ2VzLFxuICBnZXRNeVBhY2thZ2VzLFxuICB1cGRhdGVQYWNrYWdlLFxuICBjaGFuZ2VQYWNrYWdlU3RhdHVzLFxuICBzb2Z0RGVsZXRlUGFja2FnZSxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IHRpdGxlU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVGl0bGUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMywgXCJUaXRsZSBtdXN0IGJlIGF0IGxlYXN0IDMgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJUaXRsZSBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGRlc2NyaXB0aW9uU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRGVzY3JpcHRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMTAsIFwiRGVzY3JpcHRpb24gbXVzdCBiZSBhdCBsZWFzdCAxMCBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMTAwMDAsIFwiRGVzY3JpcHRpb24gbXVzdCBiZSBhdCBtb3N0IDEwMDAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGxvY2F0aW9uU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTG9jYXRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMiwgXCJMb2NhdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJMb2NhdGlvbiBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IHByaWNlU2NoZW1hID0gelxuICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiUHJpY2UgaXMgcmVxdWlyZWRcIiB9KVxuICAucG9zaXRpdmUoXCJQcmljZSBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIpXG4gIC5yZWZpbmUoKHZhbCkgPT4gTWF0aC5yb3VuZCh2YWwgKiAxMDApIC8gMTAwID09PSB2YWwsIHtcbiAgICBtZXNzYWdlOiBcIlByaWNlIG11c3QgaGF2ZSBhdCBtb3N0IDIgZGVjaW1hbCBwbGFjZXNcIixcbiAgfSk7XG5cbmNvbnN0IGR1cmF0aW9uU2NoZW1hID0gelxuICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiRHVyYXRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAuaW50KFwiRHVyYXRpb24gbXVzdCBiZSBhIHdob2xlIG51bWJlciBvZiBkYXlzXCIpXG4gIC5taW4oMSwgXCJEdXJhdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDEgZGF5XCIpO1xuXG5jb25zdCBjYXRlZ29yeUlkU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ2F0ZWdvcnkgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAubWluKDEsIFwiQ2F0ZWdvcnkgaWQgbXVzdCBub3QgYmUgZW1wdHlcIik7XG5cbmNvbnN0IGltYWdlc1NjaGVtYSA9IHpcbiAgLmFycmF5KHouc3RyaW5nKCkudXJsKFwiRWFjaCBpbWFnZSBtdXN0IGJlIGEgdmFsaWQgVVJMXCIpKVxuICAubWluKDEsIFwiQXQgbGVhc3Qgb25lIGltYWdlIGlzIHJlcXVpcmVkXCIpXG4gIC5tYXgoNiwgXCJBdCBtb3N0IDYgaW1hZ2VzIGFyZSBhbGxvd2VkXCIpO1xuXG5jb25zdCBjcmVhdGVQYWNrYWdlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEsXG4gICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uU2NoZW1hLFxuICAgIGxvY2F0aW9uOiBsb2NhdGlvblNjaGVtYSxcbiAgICBwcmljZTogcHJpY2VTY2hlbWEsXG4gICAgZHVyYXRpb246IGR1cmF0aW9uU2NoZW1hLFxuICAgIGNhdGVnb3J5SWQ6IGNhdGVnb3J5SWRTY2hlbWEsXG4gICAgaW1hZ2VzOiBpbWFnZXNTY2hlbWEsXG4gICAgYWdlbnRJZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVQYWNrYWdlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBsb2NhdGlvbjogbG9jYXRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBwcmljZTogcHJpY2VTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBkdXJhdGlvbjogZHVyYXRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBjYXRlZ29yeUlkOiBjYXRlZ29yeUlkU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgaW1hZ2VzOiBpbWFnZXNTY2hlbWEub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IE9iamVjdC5rZXlzKGRhdGEpLmxlbmd0aCA+IDAsIHtcbiAgICBtZXNzYWdlOiBcIkF0IGxlYXN0IG9uZSBmaWVsZCBtdXN0IGJlIHByb3ZpZGVkIHRvIHVwZGF0ZVwiLFxuICB9KTtcblxuY29uc3QgcGFja2FnZVF1ZXJ5U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gICAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBjYXRlZ29yeTogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgbG9jYXRpb246IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIG1pblByaWNlOiB6LmNvZXJjZS5udW1iZXIoKS5wb3NpdGl2ZSgpLm9wdGlvbmFsKCksXG4gICAgbWF4UHJpY2U6IHouY29lcmNlLm51bWJlcigpLnBvc2l0aXZlKCkub3B0aW9uYWwoKSxcbiAgICBtaW5SYXRpbmc6IHouY29lcmNlLm51bWJlcigpLm1pbigwKS5tYXgoNSkub3B0aW9uYWwoKSxcbiAgICBtYXhEdXJhdGlvbjogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm9wdGlvbmFsKCksXG4gICAgc29ydEJ5OiB6XG4gICAgICAuZW51bShbXCJuZXdlc3RcIiwgXCJwcmljZVwiLCBcInJhdGluZ1wiLCBcInRpdGxlXCJdKVxuICAgICAgLmRlZmF1bHQoXCJuZXdlc3RcIiksXG4gICAgc29ydE9yZGVyOiB6LmVudW0oW1wiYXNjXCIsIFwiZGVzY1wiXSkub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnJlZmluZSgoZGF0YSkgPT4ge1xuICAgIGlmIChkYXRhLm1pblByaWNlICE9PSB1bmRlZmluZWQgJiYgZGF0YS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gZGF0YS5taW5QcmljZSA8PSBkYXRhLm1heFByaWNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSwge1xuICAgIG1lc3NhZ2U6IFwibWluUHJpY2UgbXVzdCBiZSBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gbWF4UHJpY2VcIixcbiAgICBwYXRoOiBbXCJtaW5QcmljZVwiXSxcbiAgfSk7XG5cbmNvbnN0IGludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBzdGF0dXM6IHpcbiAgICAuZW51bShbXCJQRU5ESU5HXCIsIFwiQVBQUk9WRURcIiwgXCJSRUpFQ1RFRFwiXSlcbiAgICAudHJhbnNmb3JtKCh2YWwpID0+IHZhbCBhcyBcIlBFTkRJTkdcIiB8IFwiQVBQUk9WRURcIiB8IFwiUkVKRUNURURcIilcbiAgICAub3B0aW9uYWwoKSxcbiAgYWdlbnRJZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBwYWNrYWdlUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IHBhY2thZ2VTbHVnUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBzbHVnOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2Ugc2x1ZyBpcyByZXF1aXJlZFwiIH0pLnRyaW0oKS5taW4oMSksXG59KTtcblxuY29uc3QgdXBkYXRlU3RhdHVzU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBzdGF0dXM6IHouZW51bShbXCJBUFBST1ZFRFwiLCBcIlJFSkVDVEVEXCJdLCB7XG4gICAgICByZXF1aXJlZF9lcnJvcjogXCJTdGF0dXMgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJTdGF0dXMgbXVzdCBiZSBBUFBST1ZFRCBvciBSRUpFQ1RFRFwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlVmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVBhY2thZ2VTY2hlbWEsXG4gIHVwZGF0ZVBhY2thZ2VTY2hlbWEsXG4gIHBhY2thZ2VRdWVyeVNjaGVtYSxcbiAgaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEsXG4gIHBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gIHBhY2thZ2VTbHVnUGFyYW1zU2NoZW1hLFxuICB1cGRhdGVTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgYmxvZ0NvbnRyb2xsZXIgfSBmcm9tIFwiLi9ibG9nLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGJsb2dWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2Jsb2cudmFsaWRhdGlvblwiO1xuaW1wb3J0IHsgYmxvZ0NvbW1lbnRDb250cm9sbGVyIH0gZnJvbSBcIi4vYmxvZ0NvbW1lbnQuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYmxvZ0NvbW1lbnRWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2Jsb2dDb21tZW50LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE5PVEU6IGAvaW50ZXJuYWwvKmAgcm91dGVzIE1VU1Qgc3RheSByZWdpc3RlcmVkIGJlZm9yZSBgR0VUIC86c2x1Z2AgYmVsb3cgXHUyMDE0XG4vLyBFeHByZXNzIG1hdGNoZXMgdG9wLWRvd24sIGFuZCBhIGxpdGVyYWwgc2VnbWVudCAoYC9pbnRlcm5hbC9hbGxgKSB3b3VsZFxuLy8gb3RoZXJ3aXNlIGJlIHN3YWxsb3dlZCBieSB0aGUgYDpzbHVnYCBwYXJhbSByb3V0ZSBhbmQgNDA0IGZvcmV2ZXIuXG5cbi8vIDEuIEFsbCBwb3N0cyAoYWRtaW4gbW9kZXJhdGlvbiBVSSkgXHUyMDE0IHJlZ2lzdGVyZWQgYmVmb3JlIC86c2x1Z1xucm91dGVyLmdldChcbiAgXCIvaW50ZXJuYWwvYWxsXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBibG9nVmFsaWRhdGlvbnMuaW50ZXJuYWxRdWVyeVNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0QWxsUG9zdHMsXG4pO1xuXG4vLyAxYi4gT3duIHBvc3RzIChcIk15IFBvc3RzXCIgVUkgZm9yIGFnZW50cy9hZG1pbnMpIFx1MjAxNCBiZWZvcmUgLzpzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi9teS1wb3N0c1wiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLmludGVybmFsUXVlcnlTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldE15UG9zdHMsXG4pO1xuXG4vLyAyLiBQdWJsaWMgbGlzdGluZyBcdTIwMTQgUFVCTElTSEVEICsgbm90LWRlbGV0ZWQgb25seVxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBibG9nVmFsaWRhdGlvbnMucHVibGljUXVlcnlTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldFB1YmxpY1Bvc3RzLFxuKTtcblxuLy8gMy4gUHVibGljIHBvc3QgZGV0YWlsIGJ5IHNsdWdcbnJvdXRlci5nZXQoXG4gIFwiLzpzbHVnXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RTbHVnUGFyYW1zU2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRQb3N0QnlTbHVnLFxuKTtcblxuLy8gNC4gQ3JlYXRlIHBvc3QgKGFnZW50L2FkbWluIGF1dGhvcnMgb3duIHBvc3RzOyBuZXcgcG9zdHMgc3RhcnQgRFJBRlQpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGJsb2dWYWxpZGF0aW9ucy5jcmVhdGVQb3N0U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5jcmVhdGVQb3N0LFxuKTtcblxuLy8gXHUyNTAwXHUyNTAwIENvbW1lbnRzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gTk9URTogdGhpcyBibG9jayBzdGF5cyBiZWZvcmUgUEFUQ0ggLzppZC9zdGF0dXMgc28gREVMRVRFIC9jb21tZW50cy86aWQgaXNcbi8vIG5ldmVyIHNoYWRvd2VkIFx1MjAxNCBhbmQgbm8gYmFyZSBQQVRDSCAvOnNsdWcgb3IgREVMRVRFIC86c2x1ZyBpcyBldmVyIGFkZGVkLlxuXG4vLyA0YS4gUHVibGljIGNvbW1lbnRzIGZvciBhIHBvc3QgKFBVQkxJU0hFRCArIG5vbi1kZWxldGVkIHBvc3Qgb25seSlcbnJvdXRlci5nZXQoXG4gIFwiLzpzbHVnL2NvbW1lbnRzXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFNsdWdQYXJhbXNTY2hlbWEsXG4gICAgcXVlcnk6IGJsb2dDb21tZW50VmFsaWRhdGlvbnMuY29tbWVudFF1ZXJ5U2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbW1lbnRDb250cm9sbGVyLmdldFBvc3RDb21tZW50cyxcbik7XG5cbi8vIDRiLiBDcmVhdGUgYSBjb21tZW50IChhbnkgYXV0aGVudGljYXRlZCB1c2VyKVxucm91dGVyLnBvc3QoXG4gIFwiLzpzbHVnL2NvbW1lbnRzXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0U2x1Z1BhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBibG9nQ29tbWVudFZhbGlkYXRpb25zLmNyZWF0ZUNvbW1lbnRTY2hlbWEsXG4gIH0pLFxuICBibG9nQ29tbWVudENvbnRyb2xsZXIuY3JlYXRlQ29tbWVudCxcbik7XG5cbi8vIDRjLiBTb2Z0IGRlbGV0ZSBhIGNvbW1lbnQgKG93bmVyIG9yIEFETUlOKVxucm91dGVyLmRlbGV0ZShcbiAgXCIvY29tbWVudHMvOmlkXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBibG9nQ29tbWVudFZhbGlkYXRpb25zLmNvbW1lbnRQYXJhbXNTY2hlbWEgfSksXG4gIGJsb2dDb21tZW50Q29udHJvbGxlci5kZWxldGVDb21tZW50LFxuKTtcblxuLy8gNS4gUHVibGlzaC91bnB1Ymxpc2ggcG9zdCAoYWRtaW4pIFx1MjAxNCByZWdpc3RlcmVkIGJlZm9yZSBQQVRDSCAvOmlkIGZvciBjbGFyaXR5XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJsb2dWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBibG9nQ29udHJvbGxlci5jaGFuZ2VQb3N0U3RhdHVzLFxuKTtcblxuLy8gNi4gVXBkYXRlIHBvc3QgKGFnZW50IG93biAvIGFkbWluIGFueSkgXHUyMDE0IGFnZW50IGVkaXRzIHJlc2V0IHRvIERSQUZUXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogYmxvZ1ZhbGlkYXRpb25zLnVwZGF0ZVBvc3RTY2hlbWEsXG4gIH0pLFxuICBibG9nQ29udHJvbGxlci51cGRhdGVQb3N0LFxuKTtcblxuLy8gNy4gU29mdCBkZWxldGUgcG9zdCAoYWdlbnQgb3duIC8gYWRtaW4gYW55KVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RQYXJhbXNTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLnNvZnREZWxldGVQb3N0LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJsb2dSb3V0ZXMgPSByb3V0ZXI7XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGJsb2dTZXJ2aWNlIH0gZnJvbSBcIi4vYmxvZy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIHBvc3QgY29udHJvbGxlciAoQUdFTlQvQURNSU4pXG5jb25zdCBjcmVhdGVQb3N0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuY3JlYXRlUG9zdChyZXEudXNlciEsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgY3JlYXRlZCBzdWNjZXNzZnVsbHkuIEl0IHdpbGwgYmUgdmlzaWJsZSBhZnRlciBwdWJsaXNoaW5nLlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgY29udHJvbGxlciAoc2VhcmNoICsgc29ydCArIHBhZ2luYXRpb24pXG5jb25zdCBnZXRQdWJsaWNQb3N0cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldFB1YmxpY1Bvc3RzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBQdWJsaWMgcG9zdCBkZXRhaWwgYnkgc2x1Z1xuY29uc3QgZ2V0UG9zdEJ5U2x1ZyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHNsdWcgPSBTdHJpbmcocmVxLnBhcmFtcy5zbHVnKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRQb3N0QnlTbHVnKHNsdWcpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIEFsbCBwb3N0cyBjb250cm9sbGVyIChBRE1JTiBtb2RlcmF0aW9uKVxuY29uc3QgZ2V0QWxsUG9zdHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRBbGxQb3N0cyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBwb3N0cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDRiLiBPd24gcG9zdHMgY29udHJvbGxlciAoQUdFTlQvQURNSU4pXG5jb25zdCBnZXRNeVBvc3RzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0TXlQb3N0cyhyZXEudXNlciEsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA1LiBVcGRhdGUgcG9zdCBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCB1cGRhdGVQb3N0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UudXBkYXRlUG9zdChyZXEudXNlciEsIGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDYuIENoYW5nZSBwb3N0IHN0YXR1cyBjb250cm9sbGVyIChBRE1JTiBwdWJsaXNoL3VucHVibGlzaClcbmNvbnN0IGNoYW5nZVBvc3RTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5jaGFuZ2VQb3N0U3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSBwb3N0IGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHNvZnREZWxldGVQb3N0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgYXdhaXQgYmxvZ1NlcnZpY2Uuc29mdERlbGV0ZVBvc3QocmVxLnVzZXIhLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYmxvZ0NvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBvc3QsXG4gIGdldFB1YmxpY1Bvc3RzLFxuICBnZXRQb3N0QnlTbHVnLFxuICBnZXRBbGxQb3N0cyxcbiAgZ2V0TXlQb3N0cyxcbiAgdXBkYXRlUG9zdCxcbiAgY2hhbmdlUG9zdFN0YXR1cyxcbiAgc29mdERlbGV0ZVBvc3QsXG59O1xuIiwgImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcbmltcG9ydCB7IFBvc3RTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2x1Z2lmeVwiO1xuaW1wb3J0IHtcbiAgSUNyZWF0ZVBvc3RQYXlsb2FkLFxuICBJSW50ZXJuYWxQb3N0UXVlcnksXG4gIElQb3N0UXVlcnksXG4gIElSZXF1ZXN0VXNlcixcbiAgSVVwZGF0ZVBvc3RQYXlsb2FkLFxuICBJVXBkYXRlUG9zdFN0YXR1c1BheWxvYWQsXG59IGZyb20gXCIuL2Jsb2cuaW50ZXJmYWNlXCI7XG5cbi8vIFB1YmxpYyBwYXlsb2FkcyBjYXJyeSB0aGUgYXV0aG9yJ3MgZGlzcGxheSBpbmZvIG9ubHkgXHUyMDE0IG5ldmVyIGVtYWlsL3JvbGUuXG5leHBvcnQgY29uc3QgcHVibGljQXV0aG9yU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGF2YXRhclVybDogdHJ1ZSB9LFxufTtcblxuLy8gQ29sbGlzaW9uLXNhZmUgc2x1ZzogYmFzZSBzbHVnIGZyb20gdGhlIHRpdGxlLCB0aGVuIGAtMmAsIGAtM2AsIC4uLiB1c2luZyBhXG4vLyBzaW5nbGUgcHJlZml4IHF1ZXJ5LiBQdXJlLUJhbmdsYS9lbW9qaSB0aXRsZXMgY2FuJ3Qgc2x1Z2lmeSBcdTIwMTQgZmFsbCBiYWNrIHRvXG4vLyBgYmxvZy08c2hvcnRJZD5gIHNvIHRoZSBVUkwgaXMgYWx3YXlzIG1lYW5pbmdmdWwuXG5jb25zdCBnZW5lcmF0ZVVuaXF1ZVNsdWcgPSBhc3luYyAodGl0bGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gIGNvbnN0IGJhc2UgPSBzbHVnaWZ5KHRpdGxlKSB8fCBgYmxvZy0ke3JhbmRvbVVVSUQoKS5zbGljZSgwLCA4KX1gO1xuXG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICB3aGVyZTogeyBzbHVnOiB7IHN0YXJ0c1dpdGg6IGJhc2UgfSB9LFxuICAgIHNlbGVjdDogeyBzbHVnOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGNvbnN0IHVzZWQgPSBuZXcgU2V0KGV4aXN0aW5nLm1hcCgocCkgPT4gcC5zbHVnKSk7XG4gIGlmICghdXNlZC5oYXMoYmFzZSkpIHtcbiAgICByZXR1cm4gYmFzZTtcbiAgfVxuXG4gIGxldCBzdWZmaXggPSAyO1xuICB3aGlsZSAodXNlZC5oYXMoYCR7YmFzZX0tJHtzdWZmaXh9YCkpIHtcbiAgICBzdWZmaXggKz0gMTtcbiAgfVxuICByZXR1cm4gYCR7YmFzZX0tJHtzdWZmaXh9YDtcbn07XG5cbi8vIDEuIENyZWF0ZSBhIHBvc3QgKEFHRU5UL0FETUlOKS4gTmV3IHBvc3RzIHN0YXJ0IERSQUZUIGFuZCBuZXZlciBsZWFrIGludG9cbi8vICAgIHB1YmxpYyBxdWVyaWVzIHVudGlsIGFuIGFkbWluIHB1Ymxpc2hlcyB0aGVtLlxuY29uc3QgY3JlYXRlUG9zdCA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBheWxvYWQ6IElDcmVhdGVQb3N0UGF5bG9hZCkgPT4ge1xuICBjb25zdCBzbHVnID0gYXdhaXQgZ2VuZXJhdGVVbmlxdWVTbHVnKHBheWxvYWQudGl0bGUpO1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICB0aXRsZTogcGF5bG9hZC50aXRsZSxcbiAgICAgIGV4Y2VycHQ6IHBheWxvYWQuZXhjZXJwdCxcbiAgICAgIGNvbnRlbnQ6IHBheWxvYWQuY29udGVudCxcbiAgICAgIGNvdmVySW1hZ2U6IHBheWxvYWQuY292ZXJJbWFnZSxcbiAgICAgIHNsdWcsXG4gICAgICBhdXRob3JJZDogdXNlci5pZCxcbiAgICB9LFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG59O1xuXG4vLyAyLiBQdWJsaWMgYmxvZyBsaXN0aW5nIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5LCBzZWFyY2ggKyBzb3J0LlxuY29uc3QgZ2V0UHVibGljUG9zdHMgPSBhc3luYyAocXVlcnk6IElQb3N0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkJsb2dQb3N0V2hlcmVJbnB1dCA9IHtcbiAgICBzdGF0dXM6IFBvc3RTdGF0dXMuUFVCTElTSEVELFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnNlYXJjaFxuICAgICAgPyB7XG4gICAgICAgICAgT1I6IFtcbiAgICAgICAgICAgIHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgICAgIHsgZXhjZXJwdDogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH1cbiAgICAgIDoge30pLFxuICB9O1xuXG4gIGNvbnN0IHNvcnRPcmRlciA9IHF1ZXJ5LnNvcnRPcmRlciA/PyAocXVlcnkuc29ydEJ5ID09PSBcIm9sZGVzdFwiID8gXCJhc2NcIiA6IFwiZGVzY1wiKTtcblxuICBjb25zdCBvcmRlckJ5TWFwOiBSZWNvcmQ8c3RyaW5nLCBQcmlzbWEuQmxvZ1Bvc3RPcmRlckJ5V2l0aFJlbGF0aW9uSW5wdXQ+ID0ge1xuICAgIG5ld2VzdDogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgb2xkZXN0OiB7IGNyZWF0ZWRBdDogXCJhc2NcIiB9LFxuICAgIHRpdGxlOiB7IHRpdGxlOiBzb3J0T3JkZXIgfSxcbiAgfTtcblxuICBjb25zdCBvcmRlckJ5ID0gb3JkZXJCeU1hcFtxdWVyeS5zb3J0QnkgPz8gXCJuZXdlc3RcIl0gPz8gb3JkZXJCeU1hcC5uZXdlc3Q7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5LFxuICAgICAgc2VsZWN0OiB7XG4gICAgICAgIGlkOiB0cnVlLFxuICAgICAgICB0aXRsZTogdHJ1ZSxcbiAgICAgICAgc2x1ZzogdHJ1ZSxcbiAgICAgICAgZXhjZXJwdDogdHJ1ZSxcbiAgICAgICAgY292ZXJJbWFnZTogdHJ1ZSxcbiAgICAgICAgY3JlYXRlZEF0OiB0cnVlLFxuICAgICAgICB1cGRhdGVkQXQ6IHRydWUsXG4gICAgICAgIGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0LFxuICAgICAgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5LlxuY29uc3QgZ2V0UG9zdEJ5U2x1ZyA9IGFzeW5jIChzbHVnOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7IHNsdWcsIHN0YXR1czogUG9zdFN0YXR1cy5QVUJMSVNIRUQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xuXG4gIGlmICghcG9zdCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUG9zdCBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc3Q7XG59O1xuXG4vLyA0LiBBbGwgcG9zdHMgZm9yIHRoZSBhZG1pbiBtb2RlcmF0aW9uIFVJIChhbnkgc3RhdHVzLCBvcHRpb25hbCBmaWx0ZXIpLlxuY29uc3QgZ2V0QWxsUG9zdHMgPSBhc3luYyAocXVlcnk6IElJbnRlcm5hbFBvc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQmxvZ1Bvc3RXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgYXV0aG9yOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDRiLiBUaGUgY2FsbGVyJ3Mgb3duIHBvc3RzIChBR0VOVC9BRE1JTiBcIk15IFBvc3RzXCIgVUkpIFx1MjAxNCBhbnkgc3RhdHVzLCBzaW5jZVxuLy8gICAgIGFnZW50cyBtdXN0IHNlZSB0aGVpciBvd24gZHJhZnRzIGJlZm9yZSBhbiBhZG1pbiBwdWJsaXNoZXMgdGhlbS5cbmNvbnN0IGdldE15UG9zdHMgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBxdWVyeTogSUludGVybmFsUG9zdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5CbG9nUG9zdFdoZXJlSW5wdXQgPSB7XG4gICAgYXV0aG9ySWQ6IHVzZXIuaWQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc3RhdHVzID8geyBzdGF0dXM6IHF1ZXJ5LnN0YXR1cyB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBhdXRob3I6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0gfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nUG9zdC5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gRmV0Y2ggKyBvd25lcnNoaXAgZ2F0ZSBzaGFyZWQgYnkgUEFUQ0ggYW5kIERFTEVURS4gQURNSU4gYnlwYXNzZXMgb3duZXJzaGlwO1xuLy8gQUdFTlQgZWRpdHMgYXJlIGNvbmZpbmVkIHRvIHRoZWlyIG93biBwb3N0cy5cbmNvbnN0IGZpbmRPd25lZFBvc3QgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwb3N0SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgfSk7XG5cbiAgaWYgKCFwb3N0KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQb3N0IG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBpZiAodXNlci5yb2xlICE9PSBSb2xlLkFETUlOICYmIHBvc3QuYXV0aG9ySWQgIT09IHVzZXIuaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW4gb25seSBhY3Qgb24geW91ciBvd24gcG9zdHMuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc3Q7XG59O1xuXG4vLyA1LiBVcGRhdGUgYSBwb3N0LiBTbHVnIG5ldmVyIGNoYW5nZXMgKGtlZXBzIGxpbmtzL2Jvb2ttYXJrcyB2YWxpZCkuXG4vLyAgICBBR0VOVCBlZGl0cyByZXNldCBzdGF0dXMgdG8gRFJBRlQgKHJlLXB1Ymxpc2ggdmlhIC86aWQvc3RhdHVzKTtcbi8vICAgIEFETUlOIGVkaXRzIHByZXNlcnZlIHN0YXR1cy5cbmNvbnN0IHVwZGF0ZVBvc3QgPSBhc3luYyAoXG4gIHVzZXI6IElSZXF1ZXN0VXNlcixcbiAgcG9zdElkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQb3N0UGF5bG9hZCxcbikgPT4ge1xuICBhd2FpdCBmaW5kT3duZWRQb3N0KHVzZXIsIHBvc3RJZCk7XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLkJsb2dQb3N0VXBkYXRlSW5wdXQgPSB7XG4gICAgLi4uKHBheWxvYWQudGl0bGUgIT09IHVuZGVmaW5lZCA/IHsgdGl0bGU6IHBheWxvYWQudGl0bGUgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5leGNlcnB0ICE9PSB1bmRlZmluZWQgPyB7IGV4Y2VycHQ6IHBheWxvYWQuZXhjZXJwdCB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNvbnRlbnQgIT09IHVuZGVmaW5lZCA/IHsgY29udGVudDogcGF5bG9hZC5jb250ZW50IH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuY292ZXJJbWFnZSAhPT0gdW5kZWZpbmVkXG4gICAgICA/IHsgY292ZXJJbWFnZTogcGF5bG9hZC5jb3ZlckltYWdlIH1cbiAgICAgIDoge30pLFxuICAgIC4uLih1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gPyB7IHN0YXR1czogUG9zdFN0YXR1cy5EUkFGVCB9IDoge30pLFxuICB9O1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gNi4gUHVibGlzaC91bnB1Ymxpc2ggYSBwb3N0IChhZG1pbikuXG5jb25zdCBjaGFuZ2VQb3N0U3RhdHVzID0gYXN5bmMgKFxuICBwb3N0SWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVBvc3RTdGF0dXNQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHBvc3QgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZFVuaXF1ZU9yVGhyb3coe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgfSk7XG5cbiAgaWYgKHBvc3QuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDYW5ub3QgY2hhbmdlIHRoZSBzdGF0dXMgb2YgYSBkZWxldGVkIHBvc3QuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgICBkYXRhOiB7IHN0YXR1czogcGF5bG9hZC5zdGF0dXMgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gNy4gU29mdCBkZWxldGUgKGFkbWluIGFueSwgYWdlbnQgb3duKS5cbmNvbnN0IHNvZnREZWxldGVQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcG9zdElkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUG9zdCh1c2VyLCBwb3N0SWQpO1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgYmxvZ1NlcnZpY2UgPSB7XG4gIGNyZWF0ZVBvc3QsXG4gIGdldFB1YmxpY1Bvc3RzLFxuICBnZXRQb3N0QnlTbHVnLFxuICBnZXRBbGxQb3N0cyxcbiAgZ2V0TXlQb3N0cyxcbiAgdXBkYXRlUG9zdCxcbiAgY2hhbmdlUG9zdFN0YXR1cyxcbiAgc29mdERlbGV0ZVBvc3QsXG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IHRpdGxlU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVGl0bGUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMywgXCJUaXRsZSBtdXN0IGJlIGF0IGxlYXN0IDMgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJUaXRsZSBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGV4Y2VycHRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFeGNlcnB0IGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEsIFwiRXhjZXJwdCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAubWF4KDUwMCwgXCJFeGNlcnB0IG11c3QgYmUgYXQgbW9zdCA1MDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY29udGVudFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbnRlbnQgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMSwgXCJDb250ZW50IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gIC5tYXgoMTAwMDAsIFwiQ29udGVudCBtdXN0IGJlIGF0IG1vc3QgMTAwMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY292ZXJJbWFnZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvdmVyIGltYWdlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnVybChcIkNvdmVyIGltYWdlIG11c3QgYmUgYSB2YWxpZCBVUkxcIik7XG5cbmNvbnN0IGNyZWF0ZVBvc3RTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYSxcbiAgICBleGNlcnB0OiBleGNlcnB0U2NoZW1hLFxuICAgIGNvbnRlbnQ6IGNvbnRlbnRTY2hlbWEsXG4gICAgY292ZXJJbWFnZTogY292ZXJJbWFnZVNjaGVtYSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVQb3N0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBleGNlcnB0OiBleGNlcnB0U2NoZW1hLm9wdGlvbmFsKCksXG4gICAgY29udGVudDogY29udGVudFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNvdmVySW1hZ2U6IGNvdmVySW1hZ2VTY2hlbWEub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IE9iamVjdC5rZXlzKGRhdGEpLmxlbmd0aCA+IDAsIHtcbiAgICBtZXNzYWdlOiBcIkF0IGxlYXN0IG9uZSBmaWVsZCBtdXN0IGJlIHByb3ZpZGVkIHRvIHVwZGF0ZVwiLFxuICB9KTtcblxuY29uc3QgcG9zdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUG9zdCBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBwb3N0U2x1Z1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc2x1Zzogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQb3N0IHNsdWcgaXMgcmVxdWlyZWRcIiB9KS50cmltKCkubWluKDEpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgc3RhdHVzOiB6LmVudW0oW1wiRFJBRlRcIiwgXCJQVUJMSVNIRURcIl0sIHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcIlN0YXR1cyBpcyByZXF1aXJlZFwiLFxuICAgICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlN0YXR1cyBtdXN0IGJlIERSQUZUIG9yIFBVQkxJU0hFRFwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHB1YmxpY1F1ZXJ5U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gICAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBzb3J0Qnk6IHouZW51bShbXCJuZXdlc3RcIiwgXCJvbGRlc3RcIiwgXCJ0aXRsZVwiXSkuZGVmYXVsdChcIm5ld2VzdFwiKSxcbiAgICBzb3J0T3JkZXI6IHouZW51bShbXCJhc2NcIiwgXCJkZXNjXCJdKS5vcHRpb25hbCgpLFxuICB9KTtcblxuY29uc3QgaW50ZXJuYWxRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHN0YXR1czogelxuICAgICAgLmVudW0oW1wiRFJBRlRcIiwgXCJQVUJMSVNIRURcIl0pXG4gICAgICAudHJhbnNmb3JtKCh2YWwpID0+IHZhbCBhcyBcIkRSQUZUXCIgfCBcIlBVQkxJU0hFRFwiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gIH0pO1xuXG5leHBvcnQgY29uc3QgYmxvZ1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVQb3N0U2NoZW1hLFxuICB1cGRhdGVQb3N0U2NoZW1hLFxuICBwb3N0UGFyYW1zU2NoZW1hLFxuICBwb3N0U2x1Z1BhcmFtc1NjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxuICBwdWJsaWNRdWVyeVNjaGVtYSxcbiAgaW50ZXJuYWxRdWVyeVNjaGVtYSxcbn07XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGJsb2dDb21tZW50U2VydmljZSB9IGZyb20gXCIuL2Jsb2dDb21tZW50LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBQdWJsaWMgY29tbWVudHMgZm9yIGEgcG9zdCBjb250cm9sbGVyXG5jb25zdCBnZXRQb3N0Q29tbWVudHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ0NvbW1lbnRTZXJ2aWNlLmdldFBvc3RDb21tZW50cyhzbHVnLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNvbW1lbnRzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gQ3JlYXRlIGEgY29tbWVudCBjb250cm9sbGVyIChhbnkgYXV0aGVudGljYXRlZCB1c2VyKVxuY29uc3QgY3JlYXRlQ29tbWVudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHNsdWcgPSBTdHJpbmcocmVxLnBhcmFtcy5zbHVnKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nQ29tbWVudFNlcnZpY2UuY3JlYXRlQ29tbWVudCh1c2VySWQsIHNsdWcsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIkNvbW1lbnQgcG9zdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFNvZnQgZGVsZXRlIGNvbW1lbnQgY29udHJvbGxlciAob3duZXIgb3IgQURNSU4pXG5jb25zdCBkZWxldGVDb21tZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3Qgcm9sZSA9IHJlcS51c2VyIS5yb2xlO1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGF3YWl0IGJsb2dDb21tZW50U2VydmljZS5kZWxldGVDb21tZW50KHVzZXJJZCwgcm9sZSwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNvbW1lbnQgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJsb2dDb21tZW50Q29udHJvbGxlciA9IHtcbiAgZ2V0UG9zdENvbW1lbnRzLFxuICBjcmVhdGVDb21tZW50LFxuICBkZWxldGVDb21tZW50LFxufTsiLCAiaW1wb3J0IHsgUG9zdFN0YXR1cywgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgcHVibGljQXV0aG9yU2VsZWN0IH0gZnJvbSBcIi4vYmxvZy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBJQ3JlYXRlQ29tbWVudFBheWxvYWQsIElDb21tZW50UXVlcnkgfSBmcm9tIFwiLi9ibG9nQ29tbWVudC5pbnRlcmZhY2VcIjtcblxuLy8gU2hhcmVkIHZpc2liaWxpdHkgcnVsZTogY29tbWVudHMgb25seSBldmVyIGFwcGVhciB1bmRlciBhIFBVQkxJU0hFRCxcbi8vIG5vbi1kZWxldGVkIHBvc3QgXHUyMDE0IHRoZSBzYW1lIHJ1bGUgYXMgZ2V0UG9zdEJ5U2x1Zy5cbmNvbnN0IGdldFBvc3RJZEJ5U2x1ZyA9IGFzeW5jIChzbHVnOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHsgc2x1Zywgc3RhdHVzOiBQb3N0U3RhdHVzLlBVQkxJU0hFRCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIXBvc3QpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBvc3Qgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwb3N0LmlkO1xufTtcblxuLy8gMS4gUHVibGljIGNvbW1lbnRzIGZvciBhIHBvc3QgXHUyMDE0IHRvcC1sZXZlbCArIHRoZWlyIHJlcGxpZXMgaW4gdHdvIHF1ZXJpZXM6XG4vLyAgICB0b3AtbGV2ZWwgbmV3ZXN0LWZpcnN0LCByZXBsaWVzIG9sZGVzdC1maXJzdCAoY29udmVyc2F0aW9uIG9yZGVyKS5cbmNvbnN0IGdldFBvc3RDb21tZW50cyA9IGFzeW5jIChzbHVnOiBzdHJpbmcsIHF1ZXJ5OiBJQ29tbWVudFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBvc3RJZCA9IGF3YWl0IGdldFBvc3RJZEJ5U2x1ZyhzbHVnKTtcblxuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHRvcExldmVsV2hlcmU6IFByaXNtYS5CbG9nQ29tbWVudFdoZXJlSW5wdXQgPSB7XG4gICAgcG9zdElkLFxuICAgIHBhcmVudElkOiBudWxsLFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gIH07XG5cbiAgY29uc3QgW3RvcExldmVsLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB0b3BMZXZlbFdoZXJlLFxuICAgICAgaW5jbHVkZTogeyB1c2VyOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nQ29tbWVudC5jb3VudCh7IHdoZXJlOiB0b3BMZXZlbFdoZXJlIH0pLFxuICBdKTtcblxuICBjb25zdCByZXBsaWVzID0gdG9wTGV2ZWwubGVuZ3RoID4gMFxuICAgID8gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KHtcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBwb3N0SWQsXG4gICAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgICAgICBwYXJlbnRJZDogeyBpbjogdG9wTGV2ZWwubWFwKChjKSA9PiBjLmlkKSB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmNsdWRlOiB7IHVzZXI6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICAgICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJhc2NcIiB9LFxuICAgICAgfSlcbiAgICA6IFtdO1xuXG4gIGNvbnN0IHJlcGx5TWFwID0gbmV3IE1hcDxzdHJpbmcsIHR5cGVvZiByZXBsaWVzPigpO1xuICBmb3IgKGNvbnN0IHJlcGx5IG9mIHJlcGxpZXMpIHtcbiAgICBjb25zdCBsaXN0ID0gcmVwbHlNYXAuZ2V0KHJlcGx5LnBhcmVudElkISkgPz8gW107XG4gICAgbGlzdC5wdXNoKHJlcGx5KTtcbiAgICByZXBseU1hcC5zZXQocmVwbHkucGFyZW50SWQhLCBsaXN0KTtcbiAgfVxuXG4gIGNvbnN0IGRhdGEgPSB0b3BMZXZlbC5tYXAoKGNvbW1lbnQpID0+ICh7XG4gICAgLi4uY29tbWVudCxcbiAgICByZXBsaWVzOiByZXBseU1hcC5nZXQoY29tbWVudC5pZCkgPz8gW10sXG4gIH0pKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMi4gQ3JlYXRlIGEgY29tbWVudCAoYW55IGF1dGhlbnRpY2F0ZWQgdXNlcikuIE9uZS1sZXZlbCByZXBsaWVzIG9ubHk6IGFcbi8vICAgIHBhcmVudCBtdXN0IGJlIGEgdG9wLWxldmVsIGNvbW1lbnQgb24gdGhlIHNhbWUgcG9zdC5cbmNvbnN0IGNyZWF0ZUNvbW1lbnQgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBzbHVnOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElDcmVhdGVDb21tZW50UGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCBwb3N0SWQgPSBhd2FpdCBnZXRQb3N0SWRCeVNsdWcoc2x1Zyk7XG5cbiAgbGV0IHBhcmVudElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgaWYgKHBheWxvYWQucGFyZW50SWQpIHtcbiAgICBjb25zdCBwYXJlbnQgPSBhd2FpdCBwcmlzbWEuYmxvZ0NvbW1lbnQuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGlkOiBwYXlsb2FkLnBhcmVudElkLFxuICAgICAgICBwb3N0SWQsXG4gICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBwYXJlbnRJZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFwYXJlbnQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiUGFyZW50IGNvbW1lbnQgbm90IGZvdW5kIG9uIHRoaXMgcG9zdC5cIik7XG4gICAgfVxuXG4gICAgaWYgKHBhcmVudC5wYXJlbnRJZCAhPT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJSZXBsaWVzIHRvIHJlcGxpZXMgYXJlIG5vdCBhbGxvd2VkLlwiKTtcbiAgICB9XG5cbiAgICBwYXJlbnRJZCA9IHBhcmVudC5pZDtcbiAgfVxuXG4gIHJldHVybiBwcmlzbWEuYmxvZ0NvbW1lbnQuY3JlYXRlKHtcbiAgICBkYXRhOiB7IGNvbnRlbnQ6IHBheWxvYWQuY29udGVudCwgcG9zdElkLCB1c2VySWQsIHBhcmVudElkIH0sXG4gICAgaW5jbHVkZTogeyB1c2VyOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG59O1xuXG4vLyAzLiBTb2Z0IGRlbGV0ZSBhIGNvbW1lbnQgXHUyMDE0IG93bmVyIG9yIEFETUlOLiBBIGZvcmVpZ24gaWQsIGFuIGFscmVhZHktZGVsZXRlZFxuLy8gICAgY29tbWVudCwgb3IgYSBub25leGlzdGVudCBvbmUgaXMgYSB1bmlmb3JtIDQwNCAobmV2ZXIgYSBsZWFrKS5cbmNvbnN0IGRlbGV0ZUNvbW1lbnQgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICByb2xlOiBSb2xlLFxuICBjb21tZW50SWQ6IHN0cmluZyxcbikgPT4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuYmxvZ0NvbW1lbnQudXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHtcbiAgICAgIGlkOiBjb21tZW50SWQsXG4gICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgLi4uKHJvbGUgIT09IFJvbGUuQURNSU4gPyB7IHVzZXJJZCB9IDoge30pLFxuICAgIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKHJlc3VsdC5jb3VudCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQ29tbWVudCBub3QgZm91bmQuXCIpO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgYmxvZ0NvbW1lbnRTZXJ2aWNlID0ge1xuICBnZXRQb3N0Q29tbWVudHMsXG4gIGNyZWF0ZUNvbW1lbnQsXG4gIGRlbGV0ZUNvbW1lbnQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVDb21tZW50U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBjb250ZW50OiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ29udGVudCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAudHJpbSgpXG4gICAgICAubWluKDEsIFwiQ29udGVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAgICAgLm1heCgyMDAwLCBcIkNvbnRlbnQgbXVzdCBiZSBhdCBtb3N0IDIwMDAgY2hhcmFjdGVyc1wiKSxcbiAgICBwYXJlbnRJZDogei5zdHJpbmcoKS5taW4oMSwgXCJwYXJlbnRJZCBtdXN0IG5vdCBiZSBlbXB0eVwiKS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IGNvbW1lbnRQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbW1lbnQgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oMSwgXCJDb21tZW50IGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxufSk7XG5cbmNvbnN0IGNvbW1lbnRRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgYmxvZ0NvbW1lbnRWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlQ29tbWVudFNjaGVtYSxcbiAgY29tbWVudFBhcmFtc1NjaGVtYSxcbiAgY29tbWVudFF1ZXJ5U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGRhc2hib2FyZENvbnRyb2xsZXIgfSBmcm9tIFwiLi9kYXNoYm9hcmQuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgZGFzaGJvYXJkVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9kYXNoYm9hcmQudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQWRtaW4gZGFzaGJvYXJkIFx1MjAxNCBwbGF0Zm9ybS13aWRlIGFuYWx5dGljc1xucm91dGVyLmdldChcbiAgXCIvYWRtaW5cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGRhc2hib2FyZFZhbGlkYXRpb25zLmRhc2hib2FyZFF1ZXJ5U2NoZW1hIH0pLFxuICBkYXNoYm9hcmRDb250cm9sbGVyLmdldEFkbWluRGFzaGJvYXJkLFxuKTtcblxuLy8gMi4gQWdlbnQgZGFzaGJvYXJkIFx1MjAxNCBvd24gcGFja2FnZXMvYm9va2luZ3MvcmV2ZW51ZS9wZXJmb3JtYW5jZVxucm91dGVyLmdldChcbiAgXCIvYWdlbnRcIixcbiAgYXV0aChSb2xlLkFHRU5UKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGRhc2hib2FyZFZhbGlkYXRpb25zLmRhc2hib2FyZFF1ZXJ5U2NoZW1hIH0pLFxuICBkYXNoYm9hcmRDb250cm9sbGVyLmdldEFnZW50RGFzaGJvYXJkLFxuKTtcblxuLy8gMy4gVXNlciBkYXNoYm9hcmQgXHUyMDE0IG93biBib29raW5ncy91cGNvbWluZy9zcGVuZFxucm91dGVyLmdldChcbiAgXCIvdXNlclwiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBkYXNoYm9hcmRWYWxpZGF0aW9ucy5kYXNoYm9hcmRRdWVyeVNjaGVtYSB9KSxcbiAgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRVc2VyRGFzaGJvYXJkLFxuKTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGRhc2hib2FyZFNlcnZpY2UgfSBmcm9tIFwiLi9kYXNoYm9hcmQuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBjb250cm9sbGVyIChBRE1JTilcbmNvbnN0IGdldEFkbWluRGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRBZG1pbkRhc2hib2FyZChcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBjb250cm9sbGVyIChBR0VOVClcbmNvbnN0IGdldEFnZW50RGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRBZ2VudERhc2hib2FyZChcbiAgICAgIHVzZXJJZCxcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIGNvbnRyb2xsZXIgKFVTRVIpXG5jb25zdCBnZXRVc2VyRGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRVc2VyRGFzaGJvYXJkKFxuICAgICAgdXNlcklkLFxuICAgICAgTnVtYmVyKHJlcS5xdWVyeS5kYXlzKSxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRhc2hib2FyZCBkYXRhIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZENvbnRyb2xsZXIgPSB7XG4gIGdldEFkbWluRGFzaGJvYXJkLFxuICBnZXRBZ2VudERhc2hib2FyZCxcbiAgZ2V0VXNlckRhc2hib2FyZCxcbn07IiwgImltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cywgUGFja2FnZVN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHtcbiAgSUFnZW50RGFzaGJvYXJkLFxuICBJQWRtaW5EYXNoYm9hcmQsXG4gIElCb29raW5nc0J5U3RhdHVzLFxuICBJUmV2ZW51ZVBvaW50LFxuICBJVXNlckRhc2hib2FyZCxcbn0gZnJvbSBcIi4vZGFzaGJvYXJkLmludGVyZmFjZVwiO1xuXG4vLyBNb25leSBpcyBgRGVjaW1hbCgxMCwyKWAgaW4gdGhlIHNjaGVtYSAoQUdFTlRTLm1kKSBcdTIwMTQgbWFwIHRvIE51bWJlciBvbiByZXR1cm4uXG5jb25zdCB0b051bWJlciA9ICh2YWx1ZTogdW5rbm93bik6IG51bWJlciA9PiBOdW1iZXIodmFsdWUgPz8gMCk7XG5cbi8vIEJvb2tpbmctc3RhdHVzIGJyZWFrZG93biB2aWEgZ3JvdXBCeSArIF9jb3VudC4gT3B0aW9uYWwgc2NvcGUgbGltaXRzIGl0IHRvXG4vLyBhbiBhZ2VudCdzIG93biBub24tZGVsZXRlZCBwYWNrYWdlcyBvciBhIHNpbmdsZSB1c2VyJ3MgYm9va2luZ3MuXG5jb25zdCBnZXRCb29raW5nc0J5U3RhdHVzID0gYXN5bmMgKFxuICBzY29wZTogeyBhZ2VudElkPzogc3RyaW5nOyB1c2VySWQ/OiBzdHJpbmcgfSA9IHt9LFxuKTogUHJvbWlzZTxJQm9va2luZ3NCeVN0YXR1c1tdPiA9PiB7XG4gIGNvbnN0IGdyb3VwZWQgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5ncm91cEJ5KHtcbiAgICBieTogW1wic3RhdHVzXCJdLFxuICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgd2hlcmU6IHNjb3BlLmFnZW50SWRcbiAgICAgID8geyBwYWNrYWdlOiB7IGFnZW50SWQ6IHNjb3BlLmFnZW50SWQsIGlzRGVsZXRlZDogZmFsc2UgfSB9XG4gICAgICA6IHNjb3BlLnVzZXJJZFxuICAgICAgICA/IHsgdXNlcklkOiBzY29wZS51c2VySWQgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgfSk7XG5cbiAgcmV0dXJuIGdyb3VwZWRcbiAgICAubWFwKChnKSA9PiAoeyBzdGF0dXM6IGcuc3RhdHVzLCBjb3VudDogZy5fY291bnQuX2FsbCB9KSlcbiAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpO1xufTtcblxuLy8gUmV2ZW51ZSB0cmVuZDogb25lIHJvdyBwZXIgZGF5IGZvciB0aGUgbGFzdCBgZGF5c2AgZGF5cywgYnVja2V0aW5nIENPTVBMRVRFRFxuLy8gYm9va2luZ3MgYnkgdGhlaXIgYHVwZGF0ZWRBdGAgXHUyMDE0IHRoZSB0aW1lc3RhbXAgb2YgdGhlIHRyYW5zaXRpb24gaW50b1xuLy8gQ09NUExFVEVEIChhIHRlcm1pbmFsIHN0YXRlLCBzbyBpdCBpcyB0aGUgbGFzdCB3cml0ZSkuIGBjcmVhdGVkQXRgIGlzIHdoZW5cbi8vIHRoZSBib29raW5nIHdhcyBtYWRlIChQRU5ESU5HKSBhbmQgbmV2ZXIgbW92ZXMsIHdoaWNoIHdvdWxkIG1pcy1kYXRlIHJldmVudWVcbi8vIHdlZWtzIGxhdGVyLiBQb3N0Z3JlcyBnZW5lcmF0ZV9zZXJpZXMgZ3VhcmFudGVlcyBhIGRlbnNlIHNlcmllcyAoemVyby1maWxsZWRcbi8vIGRheXMpIFx1MjAxNCBiZXR0ZXIgYW5kIGZhc3RlciB0aGFuIGEgcGVyLWRheSBKUyBsb29wLiBPcHRpb25hbCBzY29wZTogYW4gYWdlbnQnc1xuLy8gb3duIG5vbi1kZWxldGVkIHBhY2thZ2VzLCBvciBhIHNpbmdsZSB1c2VyJ3Mgc3BlbmQuXG5jb25zdCBnZXRSZXZlbnVlT3ZlclRpbWUgPSBhc3luYyAoXG4gIGRheXM6IG51bWJlcixcbiAgc2NvcGU6IHsgYWdlbnRJZD86IHN0cmluZzsgdXNlcklkPzogc3RyaW5nIH0gPSB7fSxcbik6IFByb21pc2U8SVJldmVudWVQb2ludFtdPiA9PiB7XG4gIGNvbnN0IGFnZW50U2NvcGUgPSBzY29wZS5hZ2VudElkXG4gICAgPyBgQU5EIGIuXCJwYWNrYWdlSWRcIiBJTiAoXG4gICAgICAgICBTRUxFQ1QgcC5cImlkXCJcbiAgICAgICAgIEZST00gXCJ0b3VyX3BhY2thZ2VzXCIgcFxuICAgICAgICAgV0hFUkUgcC5cImFnZW50SWRcIiA9ICQyXG4gICAgICAgICAgIEFORCBwLlwiaXNEZWxldGVkXCIgPSBmYWxzZVxuICAgICAgIClgXG4gICAgOiBcIlwiO1xuICBjb25zdCB1c2VyU2NvcGUgPSBzY29wZS51c2VySWQgPyBgQU5EIGIuXCJ1c2VySWRcIiA9ICQyYCA6IFwiXCI7XG4gIGNvbnN0IHdoZXJlQ2xhdXNlID0gc2NvcGUuYWdlbnRJZCA/IGFnZW50U2NvcGUgOiB1c2VyU2NvcGU7XG5cbiAgY29uc3Qgcm93cyA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdVbnNhZmU8XG4gICAgeyBkYXRlOiBzdHJpbmc7IHJldmVudWU6IG51bWJlciB9W11cbiAgPihcbiAgICBgXG4gICAgU0VMRUNUIHRvX2NoYXIoZGF5cy5kLCAnWVlZWS1NTS1ERCcpIEFTIGRhdGUsXG4gICAgICAgICAgIENPQUxFU0NFKFNVTShiLlwidG90YWxQcmljZVwiKSwgMCk6OmZsb2F0OCBBUyByZXZlbnVlXG4gICAgRlJPTSBnZW5lcmF0ZV9zZXJpZXMoXG4gICAgICBDVVJSRU5UX0RBVEUgLSBtYWtlX2ludGVydmFsKGRheXMgPT4gJDE6OmludCAtIDEpLFxuICAgICAgQ1VSUkVOVF9EQVRFLFxuICAgICAgJzEgZGF5Jzo6aW50ZXJ2YWxcbiAgICApIEFTIGRheXMoZClcbiAgICBMRUZUIEpPSU4gXCJib29raW5nc1wiIGJcbiAgICAgIE9OIGRhdGVfdHJ1bmMoJ2RheScsIGIuXCJ1cGRhdGVkQXRcIik6OmRhdGUgPSBkYXlzLmRcbiAgICAgIEFORCBiLlwic3RhdHVzXCIgPSAnQ09NUExFVEVEJ1xuICAgICAgJHt3aGVyZUNsYXVzZX1cbiAgICBHUk9VUCBCWSBkYXlzLmRcbiAgICBPUkRFUiBCWSBkYXlzLmQgQVNDXG4gICAgYCxcbiAgICBkYXlzLFxuICAgIC4uLihzY29wZS5hZ2VudElkIHx8IHNjb3BlLnVzZXJJZCA/IFtzY29wZS5hZ2VudElkID8/IHNjb3BlLnVzZXJJZF0gOiBbXSksXG4gICk7XG5cbiAgcmV0dXJuIHJvd3M7XG59O1xuXG4vLyBQYWNrYWdlLWlkIHNjb3BlIGZvciBib29raW5nIHF1ZXJpZXMuIENhbGxlcnMgc2hvcnQtY2lyY3VpdCB0aGUgZW1wdHkgY2FzZVxuLy8gKGFuIGFnZW50IHdpdGggbm8gcGFja2FnZXMpLCBidXQgYW4gYGluOiBbXWAgZmFsbGJhY2sga2VlcHMgdGhlIHR5cGVcbi8vIG5vbi1udWxsYWJsZSB3aGlsZSBzdGlsbCBtYXRjaGluZyBub3RoaW5nIGlmIGl0IGV2ZXIgc2xpcHMgdGhyb3VnaC5cbmNvbnN0IHRvUGFja2FnZUlkU2NvcGUgPSAoXG4gIHBhY2thZ2VJZHM6IHN0cmluZ1tdLFxuKTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0+XG4gIHBhY2thZ2VJZHMubGVuZ3RoXG4gICAgPyB7IHBhY2thZ2VJZDogeyBpbjogcGFja2FnZUlkcyB9IH1cbiAgICA6IHsgcGFja2FnZUlkOiB7IGluOiBbXSB9IH07XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBcdTIwMTQgcGxhdGZvcm0td2lkZSBjb3VudHMsIGJyZWFrZG93bnMgYW5kIHJldmVudWUgdHJlbmQuXG5jb25zdCBnZXRBZG1pbkRhc2hib2FyZCA9IGFzeW5jIChkYXlzOiBudW1iZXIpOiBQcm9taXNlPElBZG1pbkRhc2hib2FyZD4gPT4ge1xuICBjb25zdCBbXG4gICAgdG90YWxVc2VycyxcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlLFxuICAgIHVzZXJzQnlSb2xlLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcGFja2FnZXNCeUNhdGVnb3J5LFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudXNlci5jb3VudCh7IHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0gfSksXG4gICAgcHJpc21hLmJvb2tpbmcuY291bnQoKSxcbiAgICBwcmlzbWEuYm9va2luZy5hZ2dyZWdhdGUoe1xuICAgICAgX3N1bTogeyB0b3RhbFByaWNlOiB0cnVlIH0sXG4gICAgICB3aGVyZTogeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVEIH0sXG4gICAgfSksXG4gICAgcHJpc21hLnVzZXIuZ3JvdXBCeSh7XG4gICAgICBieTogW1wicm9sZVwiXSxcbiAgICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgICB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgfSksXG4gICAgZ2V0Qm9va2luZ3NCeVN0YXR1cygpLFxuICAgIHByaXNtYS50b3VyUGFja2FnZVxuICAgICAgLmdyb3VwQnkoe1xuICAgICAgICBieTogW1wiY2F0ZWdvcnlJZFwiXSxcbiAgICAgICAgX2NvdW50OiB7IF9hbGw6IHRydWUgfSxcbiAgICAgICAgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgfSlcbiAgICAgIC50aGVuKGFzeW5jIChncm91cGVkKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhdGVnb3J5SWRzID0gZ3JvdXBlZC5tYXAoKGcpID0+IGcuY2F0ZWdvcnlJZCk7XG4gICAgICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZE1hbnkoe1xuICAgICAgICAgIHdoZXJlOiB7IGlkOiB7IGluOiBjYXRlZ29yeUlkcyB9IH0sXG4gICAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBuYW1lTWFwID0gbmV3IE1hcChjYXRlZ29yaWVzLm1hcCgoYykgPT4gW2MuaWQsIGMubmFtZV0pKTtcblxuICAgICAgICByZXR1cm4gZ3JvdXBlZFxuICAgICAgICAgIC5tYXAoKGcpID0+ICh7XG4gICAgICAgICAgICBjYXRlZ29yeTogbmFtZU1hcC5nZXQoZy5jYXRlZ29yeUlkKSA/PyBcIlVua25vd25cIixcbiAgICAgICAgICAgIGNvdW50OiBnLl9jb3VudC5fYWxsLFxuICAgICAgICAgIH0pKVxuICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLmNvdW50IC0gYS5jb3VudCk7XG4gICAgICB9KSxcbiAgICBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cyksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxVc2VycyxcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlOiB0b051bWJlcih0b3RhbFJldmVudWUuX3N1bS50b3RhbFByaWNlKSxcbiAgICB1c2Vyc0J5Um9sZTogdXNlcnNCeVJvbGVcbiAgICAgIC5tYXAoKGcpID0+ICh7IHJvbGU6IGcucm9sZSwgY291bnQ6IGcuX2NvdW50Ll9hbGwgfSkpXG4gICAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcGFja2FnZXNCeUNhdGVnb3J5LFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgfTtcbn07XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBcdTIwMTQgc2NvcGVkIHRvIHRoZSBhZ2VudCdzIG93biBwYWNrYWdlcy4gRmV0Y2hlcyBvd25lZFxuLy8gICAgcGFja2FnZSBpZHMgb25jZSwgdGhlbiBldmVyeSBhZ2dyZWdhdGUgcmV1c2VzIHRoYXQgc2NvcGUgc28gdGhlIHdob2xlXG4vLyAgICBidW5kbGUgaXMgb25lIFByb21pc2UuYWxsIChubyBwZXItaXRlbSBxdWVyaWVzKS5cbmNvbnN0IGdldEFnZW50RGFzaGJvYXJkID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgZGF5czogbnVtYmVyLFxuKTogUHJvbWlzZTxJQWdlbnREYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW293bmVkUGFja2FnZXMsIGJvb2tpbmdzQnlTdGF0dXMsIGF2ZXJhZ2VSYXRpbmddID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZTogeyBhZ2VudElkOiB1c2VySWQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pLFxuICAgIGdldEJvb2tpbmdzQnlTdGF0dXMoeyBhZ2VudElkOiB1c2VySWQgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmFnZ3JlZ2F0ZSh7XG4gICAgICBfYXZnOiB7IHJhdGluZzogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHtcbiAgICAgICAgYWdlbnRJZDogdXNlcklkLFxuICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgIH0pLFxuICBdKTtcblxuICBjb25zdCBwYWNrYWdlSWRzID0gb3duZWRQYWNrYWdlcy5tYXAoKHApID0+IHAuaWQpO1xuXG4gIC8vIEFuIGFnZW50IHdpdGggbm8gcGFja2FnZXMgbXVzdCBzZWUgemVyb3MgXHUyMDE0IHNjb3BlIGlzIHVuZGVmaW5lZCBmb3IgYW4gZW1wdHlcbiAgLy8gbGlzdCwgYW5kIGEgYmFyZSBgd2hlcmU6IHVuZGVmaW5lZGAgLyBgQU5EOiBbe31dYCB3b3VsZCBvdGhlcndpc2UgbWF0Y2ggdGhlXG4gIC8vIHdob2xlIHBsYXRmb3JtIChjcm9zcy1hZ2VudCBkYXRhIGxlYWspLiBTaG9ydC1jaXJjdWl0IGhlcmUgaW5zdGVhZC5cbiAgaWYgKHBhY2thZ2VJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRvdGFsUGFja2FnZXM6IDAsXG4gICAgICB0b3RhbEJvb2tpbmdzOiAwLFxuICAgICAgdG90YWxSZXZlbnVlOiAwLFxuICAgICAgYXZlcmFnZVJhdGluZzogTWF0aC5yb3VuZCgoYXZlcmFnZVJhdGluZy5fYXZnLnJhdGluZyA/PyAwKSAqIDEwKSAvIDEwLFxuICAgICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICAgIHJldmVudWVPdmVyVGltZTogYXdhaXQgZ2V0UmV2ZW51ZU92ZXJUaW1lKGRheXMsIHsgYWdlbnRJZDogdXNlcklkIH0pLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBzY29wZSA9IHRvUGFja2FnZUlkU2NvcGUocGFja2FnZUlkcyk7XG5cbiAgY29uc3QgW3RvdGFsUGFja2FnZXMsIHRvdGFsQm9va2luZ3MsIHRvdGFsUmV2ZW51ZSwgcmV2ZW51ZU92ZXJUaW1lXSA9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgcGFja2FnZUlkcy5sZW5ndGgsXG4gICAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlOiBzY29wZSB9KSxcbiAgICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIEFORDogW3Njb3BlLCB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfV0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIGdldFJldmVudWVPdmVyVGltZShkYXlzLCB7IGFnZW50SWQ6IHVzZXJJZCB9KSxcbiAgICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsUGFja2FnZXMsXG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFJldmVudWU6IHRvTnVtYmVyKHRvdGFsUmV2ZW51ZS5fc3VtLnRvdGFsUHJpY2UpLFxuICAgIGF2ZXJhZ2VSYXRpbmc6IE1hdGgucm91bmQoKGF2ZXJhZ2VSYXRpbmcuX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMCxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgfTtcbn07XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIFx1MjAxNCB0aGUgdXNlcidzIGJvb2tpbmdzLCBzcGVuZCwgYW5kIHVwY29taW5nIHRyaXBzLlxuY29uc3QgZ2V0VXNlckRhc2hib2FyZCA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIGRheXMgPSAzMCxcbik6IFByb21pc2U8SVVzZXJEYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW3RvdGFsQm9va2luZ3MsIHRvdGFsU3BlbmQsIHVwY29taW5nLCBib29raW5nc0J5U3RhdHVzLCByZXZlbnVlT3ZlclRpbWVdID1cbiAgICBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlOiB7IHVzZXJJZCB9IH0pLFxuICAgICAgcHJpc21hLmJvb2tpbmcuYWdncmVnYXRlKHtcbiAgICAgICAgX3N1bTogeyB0b3RhbFByaWNlOiB0cnVlIH0sXG4gICAgICAgIHdoZXJlOiB7IHVzZXJJZCwgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCB9LFxuICAgICAgfSksXG4gICAgICBwcmlzbWEuYm9va2luZy5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgdXNlcklkLFxuICAgICAgICAgIHN0YXR1czoge1xuICAgICAgICAgICAgaW46IFtCb29raW5nU3RhdHVzLlBFTkRJTkcsIEJvb2tpbmdTdGF0dXMuUEFJRCwgQm9va2luZ1N0YXR1cy5DT05GSVJNRURdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJhdmVsRGF0ZTogeyBndDogbmV3IERhdGUoKSB9LFxuICAgICAgICB9LFxuICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgICB0cmF2ZWxEYXRlOiB0cnVlLFxuICAgICAgICAgIHRyYXZlbGVyczogdHJ1ZSxcbiAgICAgICAgICB0b3RhbFByaWNlOiB0cnVlLFxuICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICBwYWNrYWdlOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgdGl0bGU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICAgICAgICB9LFxuICAgICAgICBvcmRlckJ5OiB7IHRyYXZlbERhdGU6IFwiYXNjXCIgfSxcbiAgICAgICAgdGFrZTogNSxcbiAgICAgIH0pLFxuICAgICAgZ2V0Qm9va2luZ3NCeVN0YXR1cyh7IHVzZXJJZCB9KSxcbiAgICAgIGdldFJldmVudWVPdmVyVGltZShkYXlzLCB7IHVzZXJJZCB9KSxcbiAgICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxTcGVuZDogdG9OdW1iZXIodG90YWxTcGVuZC5fc3VtLnRvdGFsUHJpY2UpLFxuICAgIHVwY29taW5nQ291bnQ6IHVwY29taW5nLmxlbmd0aCxcbiAgICB1cGNvbWluZzogdXBjb21pbmcubWFwKChiKSA9PiAoe1xuICAgICAgLi4uYixcbiAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihiLnRvdGFsUHJpY2UpLFxuICAgIH0pKSxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRTZXJ2aWNlID0ge1xuICBnZXRBZG1pbkRhc2hib2FyZCxcbiAgZ2V0QWdlbnREYXNoYm9hcmQsXG4gIGdldFVzZXJEYXNoYm9hcmQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBkYXNoYm9hcmRRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZGF5czogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCgzNjUpLmRlZmF1bHQoMzApLFxufSk7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRWYWxpZGF0aW9ucyA9IHtcbiAgZGFzaGJvYXJkUXVlcnlTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgcGF5bWVudENvbnRyb2xsZXIgfSBmcm9tIFwiLi9wYXltZW50LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHBheW1lbnRWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3BheW1lbnQudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gT3BlbiBhIGdhdGV3YXkgc2Vzc2lvbiBmb3IgdGhlIHVzZXIncyBwZW5kaW5nIGJvb2tpbmcgKFVTRVIgb25seSkuXG5yb3V0ZXIucG9zdChcbiAgXCIvY3JlYXRlXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcGF5bWVudFZhbGlkYXRpb25zLmNyZWF0ZVNjaGVtYSB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuY3JlYXRlUGF5bWVudCxcbik7XG5cbi8vIFB1YmxpYyBcdTIwMTQgU1NMQ29tbWVyeiBQT1NUcyB0aGUgb3V0Y29tZSBoZXJlIChzdWNjZXNzL2ZhaWwvY2FuY2VsKSBhbmQgd2Vcbi8vIHJlZGlyZWN0IHRoZSBicm93c2VyIHRvIHRoZSBmcm9udGVuZCByZXN1bHQgcGFnZS5cbnJvdXRlci5wb3N0KFxuICBcIi9jb25maXJtXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcXVlcnk6IHBheW1lbnRWYWxpZGF0aW9ucy5jYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICAgIGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5nYXRld2F5UmVzdWx0U2NoZW1hLFxuICB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuY29uZmlybVBheW1lbnQsXG4pO1xuXG4vLyBQdWJsaWMgXHUyMDE0IFNTTENvbW1lcnogaW5zdGFudCBwYXltZW50IG5vdGlmaWNhdGlvbjsgc2FtZSBpZGVtcG90ZW50IHNldHRsZS5cbnJvdXRlci5wb3N0KFxuICBcIi9pcG5cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBxdWVyeTogcGF5bWVudFZhbGlkYXRpb25zLmNhbGxiYWNrUXVlcnlTY2hlbWEsXG4gICAgYm9keTogcGF5bWVudFZhbGlkYXRpb25zLmdhdGV3YXlSZXN1bHRTY2hlbWEsXG4gIH0pLFxuICBwYXltZW50Q29udHJvbGxlci5pcG4sXG4pO1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5pbXBvcnQgeyBJR2F0ZXdheVJlc3VsdCB9IGZyb20gXCIuL3BheW1lbnQuaW50ZXJmYWNlXCI7XG5pbXBvcnQgeyBwYXltZW50U2VydmljZSB9IGZyb20gXCIuL3BheW1lbnQuc2VydmljZVwiO1xuXG5jb25zdCBjcmVhdGVQYXltZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBwYXltZW50U2VydmljZS5jcmVhdGVQYXltZW50U2Vzc2lvbih1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlBheW1lbnQgc2Vzc2lvbiBjcmVhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHNlc3Npb24sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBQdWJsaWMgY2FsbGJhY2sgdGFyZ2V0IFx1MjAxNCBTU0xDb21tZXJ6IFBPU1RzIGhlcmUgKHNlcnZlci10by1zZXJ2ZXIpIGFmdGVyIHRoZVxuLy8gc2hvcHBlciBmaW5pc2hlcyBhdCB0aGUgZ2F0ZXdheS4gV2Ugc2V0dGxlIHRoZSBwYXltZW50LCB0aGVuIGJvdW5jZSB0aGVcbi8vIGJyb3dzZXIgdG8gdGhlIGZyb250ZW5kIHJlc3VsdCBwYWdlLlxuY29uc3QgY29uZmlybVBheW1lbnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBib29raW5nSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LmJvb2tpbmdJZCk7XG4gICAgY29uc3QgdHJhbklkID0gU3RyaW5nKHJlcS5xdWVyeS50cmFuSWQpO1xuICAgIGNvbnN0IHN0YXR1cyA9IFN0cmluZyhyZXEucXVlcnkuc3RhdHVzID8/IFwiZmFpbFwiKTtcblxuICAgIGF3YWl0IHBheW1lbnRTZXJ2aWNlLnByb2Nlc3NHYXRld2F5UmVzdWx0KFxuICAgICAgYm9va2luZ0lkLFxuICAgICAgdHJhbklkLFxuICAgICAgcmVxLmJvZHkgYXMgSUdhdGV3YXlSZXN1bHQsXG4gICAgKTtcblxuICAgIGNvbnN0IHJlZGlyZWN0QmFzZSA9XG4gICAgICBjb25maWcubm9kZV9lbnYgPT09IFwicHJvZHVjdGlvblwiXG4gICAgICAgID8gY29uZmlnLmZyb250ZW5kX3VybF9wcm9kXG4gICAgICAgIDogY29uZmlnLmZyb250ZW5kX3VybF9kZXY7XG4gICAgY29uc3QgcGFnZSA9IFtcInN1Y2Nlc3NcIiwgXCJmYWlsXCIsIFwiY2FuY2VsXCJdLmluY2x1ZGVzKHN0YXR1cykgPyBzdGF0dXMgOiBcImZhaWxcIjtcblxuICAgIHJlcy5yZWRpcmVjdCgzMDIsIGAke3JlZGlyZWN0QmFzZX0vcGF5bWVudC8ke3BhZ2V9P2Jvb2tpbmdJZD0ke2Jvb2tpbmdJZH1gKTtcbiAgfSxcbik7XG5cbi8vIFB1YmxpYyBJUE4gdGFyZ2V0IFx1MjAxNCB0aGUgZ2F0ZXdheSBub3RpZmllcyB1cyBoZXJlIGluZGVwZW5kZW50bHkgb2YgdGhlXG4vLyByZWRpcmVjdC4gU2FtZSBpZGVtcG90ZW50IHNldHRsZTsgYWx3YXlzIGFuc3dlcnMgMjAwIHNvIHRoZSBnYXRld2F5IHN0b3BzIHJldHJ5aW5nLlxuY29uc3QgaXBuID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgYm9va2luZ0lkID0gU3RyaW5nKHJlcS5xdWVyeS5ib29raW5nSWQpO1xuICAgIGNvbnN0IHRyYW5JZCA9IFN0cmluZyhyZXEucXVlcnkudHJhbklkKTtcblxuICAgIGF3YWl0IHBheW1lbnRTZXJ2aWNlLnByb2Nlc3NHYXRld2F5UmVzdWx0KFxuICAgICAgYm9va2luZ0lkLFxuICAgICAgdHJhbklkLFxuICAgICAgcmVxLmJvZHkgYXMgSUdhdGV3YXlSZXN1bHQsXG4gICAgKTtcblxuICAgIHJlcy5zdGF0dXMoMjAwKS50eXBlKFwidGV4dC9wbGFpblwiKS5zZW5kKFwiT0tcIik7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcGF5bWVudENvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBheW1lbnQsXG4gIGNvbmZpcm1QYXltZW50LFxuICBpcG4sXG59OyIsICJpbXBvcnQgeyBCb29raW5nU3RhdHVzLCBQYXltZW50U3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IFNzbGNvbW1lcnpJbml0UmVzdWx0LCBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCwgZ2VuZXJhdGVUcmFuSWQsIHNzbGNvbW1lcnpJbml0LCBzc2xjb21tZXJ6VmFsaWRhdGUgfSBmcm9tIFwiLi4vLi4vbGliL3NzbGNvbW1lcnpcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzZW5kQm9va2luZ0VtYWlsIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQgeyBJR2F0ZXdheVJlc3VsdCwgSVBheW1lbnRDcmVhdGVSZXF1ZXN0LCBJUGF5bWVudEdhdGV3YXlPdXRjb21lIH0gZnJvbSBcIi4vcGF5bWVudC5pbnRlcmZhY2VcIjtcblxuLy8gVGhlIGdhdGV3YXkgUE9TVHMgdG8gdGhlc2UgVVJMcyBzZXJ2ZXItdG8tc2VydmVyLCBzbyB0aGUgaG9zdCBtdXN0IGJlXG4vLyBwdWJsaWNseSByZWFjaGFibGUgXHUyMDE0IGNvbmZpZy5iYWNrZW5kX3B1YmxpY191cmwsIG5ldmVyIGxvY2FsaG9zdCBpbiBzYW5kYm94LlxuY29uc3QgYnVpbGRDYWxsYmFja1VybCA9IChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIHRyYW5JZDogc3RyaW5nLFxuICBraW5kOiBcInN1Y2Nlc3NcIiB8IFwiZmFpbFwiIHwgXCJjYW5jZWxcIiB8IFwiaXBuXCIsXG4pID0+XG4gIGAke2NvbmZpZy5iYWNrZW5kX3B1YmxpY191cmx9L2FwaS9wYXltZW50cy8ke2tpbmQgPT09IFwiaXBuXCIgPyBcImlwblwiIDogXCJjb25maXJtXCJ9P2Jvb2tpbmdJZD0ke2Jvb2tpbmdJZH0mdHJhbklkPSR7dHJhbklkfSR7XG4gICAga2luZCA9PT0gXCJpcG5cIiA/IFwiXCIgOiBgJnN0YXR1cz0ke2tpbmR9YFxuICB9YDtcblxuLy8gT3BlbnMgYW4gU1NMQ29tbWVyeiBzZXNzaW9uIGZvciBhIHBlbmRpbmcgYm9va2luZyB0aGUgdXNlciBvd25zLiBUaGUgYm9va2luZ1xuLy8gYW1vdW50IGlzIGZyb3plbiBhdCBpbml0aWF0aW9uOyBpdCBuZXZlciByZS1yZWFkcyB0aGUgcGFja2FnZSBwcmljZS5cbmNvbnN0IGNyZWF0ZVBheW1lbnRTZXNzaW9uID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVBheW1lbnRDcmVhdGVSZXF1ZXN0LFxuKTogUHJvbWlzZTx7IHBheW1lbnRJZDogc3RyaW5nOyB0cmFuSWQ6IHN0cmluZzsgcGF5bWVudFVybDogc3RyaW5nIHwgbnVsbCB9PiA9PiB7XG4gIGNvbnN0IHsgYm9va2luZ0lkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogYm9va2luZ0lkIH0sXG4gICAgaW5jbHVkZTogeyBwYWNrYWdlOiB7IHNlbGVjdDogeyB0aXRsZTogdHJ1ZSB9IH0gfSxcbiAgfSk7XG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG4gIGlmIChib29raW5nLnVzZXJJZCAhPT0gdXNlcklkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBheSBmb3IgdGhpcyBib29raW5nLlwiKTtcbiAgfVxuICBpZiAoYm9va2luZy5zdGF0dXMgPT09IEJvb2tpbmdTdGF0dXMuUEFJRCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiVGhpcyBib29raW5nIGlzIGFscmVhZHkgcGFpZC5cIik7XG4gIH1cbiAgaWYgKGJvb2tpbmcuc3RhdHVzICE9PSBCb29raW5nU3RhdHVzLlBFTkRJTkcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBgQ2Fubm90IHBheSBmb3IgYSBib29raW5nIGluICR7Ym9va2luZy5zdGF0dXMudG9Mb3dlckNhc2UoKX0gc3RhdHVzLmAsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlLCBwaG9uZTogdHJ1ZSB9LFxuICB9KTtcbiAgaWYgKCF1c2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBjb25zdCBhbW91bnQgPSBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKTtcbiAgY29uc3QgdHJhbklkID0gZ2VuZXJhdGVUcmFuSWQoKTtcblxuICAvLyBPbmUgbGl2ZSBzZXNzaW9uIHBlciBib29raW5nOiB0aGUgbGVkZ2VyIHJvdyBpcyBjcmVhdGVkIGF0b21pY2FsbHkgd2hpbGVcbiAgLy8gc3VwZXJzZWRpbmcgYW55IGFiYW5kb25lZCBzZXNzaW9uLCB0aGVuIHRoZSBnYXRld2F5IGlzIGFza2VkLiBUaGUgcm93XG4gIC8vIHN1cnZpdmVzIHJlZ2FyZGxlc3Mgb2YgdGhlIGdhdGV3YXkgcmVzcG9uc2UgXHUyMDE0IGluaXQgZmFpbHVyZSBmbGlwcyBpdCB0b1xuICAvLyBGQUlMRUQgYmVsb3cgc28gYSB0cnV0aGZ1bCBlbnRyeSBhbHdheXMgZXhpc3RzLlxuICBjb25zdCBwYXltZW50ID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgYm9va2luZ0lkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB0eC5wYXltZW50LmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIGJvb2tpbmdJZCxcbiAgICAgICAgdHJhbklkLFxuICAgICAgICBhbW91bnQsXG4gICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQsXG4gICAgICB9LFxuICAgIH0pO1xuICB9KTtcblxuICBsZXQgaW5pdDogU3NsY29tbWVyekluaXRSZXN1bHQ7XG4gIHRyeSB7XG4gICAgaW5pdCA9IGF3YWl0IHNzbGNvbW1lcnpJbml0KHtcbiAgICAgIHRvdGFsX2Ftb3VudDogYW1vdW50LFxuICAgICAgdHJhbl9pZDogdHJhbklkLFxuICAgICAgc3VjY2Vzc191cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwic3VjY2Vzc1wiKSxcbiAgICAgIGZhaWxfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImZhaWxcIiksXG4gICAgICBjYW5jZWxfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImNhbmNlbFwiKSxcbiAgICAgIGlwbl91cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwiaXBuXCIpLFxuICAgICAgY3VzX25hbWU6IHVzZXIubmFtZSxcbiAgICAgIGN1c19lbWFpbDogdXNlci5lbWFpbCxcbiAgICAgIGN1c19waG9uZTogdXNlci5waG9uZSA/PyBcIjAxNzExMTExMTExXCIsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgLy8ga2VlcCB0aGUgbGVkZ2VyIHRydXRoZnVsIFx1MjAxNCB0aGUgc2Vzc2lvbiBuZXZlciByZWFjaGVkIHRoZSBnYXRld2F5LiBUaGVcbiAgICAvLyBzdGF0dXMgZ3VhcmQgbWFrZXMgYSBjb25jdXJyZW50IC9jcmVhdGUgdGhhdCBhbHJlYWR5IGNhbmNlbGxlZCB0aGlzIHJvd1xuICAgIC8vIHdpbiB0aGUgcmFjZSAodGhhdCByb3cgc3RheXMgY2FuY2VsbGVkLCB0aGlzIG9uZSBmYWlscyBvbmx5IGlmIGxpdmUpLlxuICAgIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgLy8gc3RvcmUgdGhlIGdhdGV3YXkgVVJMcyBvbmx5IGlmIHRoZSByb3cgaXMgc3RpbGwgdGhlIGxpdmUgc2Vzc2lvbi5cbiAgYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICBkYXRhOiB7IGdhdGV3YXlQYWdlVXJsOiBpbml0LkdhdGV3YXlQYWdlVVJMLCBzc2xTZXNzaW9uS2V5OiBpbml0LnNlc3Npb25rZXkgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXltZW50SWQ6IHBheW1lbnQuaWQsXG4gICAgdHJhbklkOiBwYXltZW50LnRyYW5JZCxcbiAgICBwYXltZW50VXJsOiBpbml0LkdhdGV3YXlQYWdlVVJMID8/IG51bGwsXG4gIH07XG59O1xuXG4vLyBTZXJ2ZXItc2lkZSB2ZXJpZmljYXRpb24gb2YgYSBjb21wbGV0ZWQgdHJhbnNhY3Rpb246IHRoZSB2YWxpZGF0b3IgcmV0dXJuc1xuLy8gVkFMSUQgKGZpcnN0IGNoZWNrKSBvciBWQUxJREFURUQgKGFscmVhZHkgdmVyaWZpZWQgYmVmb3JlKSB3aXRoIHRoZSBhbW91bnQuXG4vLyBBbnl0aGluZyBlbHNlIFx1MjAxNCBvciBhIG1pc21hdGNoZWQgYW1vdW50IFx1MjAxNCBmYWlscyB0aGUgcGF5bWVudC5cbmNvbnN0IHZlcmlmeVN1Y2Nlc3MgPSBhc3luYyAoXG4gIHZhbElkOiBzdHJpbmcsXG4gIGV4cGVjdGVkQW1vdW50OiBudW1iZXIsXG4pOiBQcm9taXNlPHsgdmVyaWZpZWQ6IFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHwgbnVsbDsgbWF0Y2hlc0Ftb3VudDogYm9vbGVhbiB9PiA9PiB7XG4gIGxldCB2ZXJpZmllZDogU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQgfCBudWxsID0gbnVsbDtcbiAgdHJ5IHtcbiAgICB2ZXJpZmllZCA9IGF3YWl0IHNzbGNvbW1lcnpWYWxpZGF0ZSh7IHZhbF9pZDogdmFsSWQgfSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIHZhbGlkYXRvciB1bnJlYWNoYWJsZSBcdTIwMTQgZmFpbCB0aGUgcGF5bWVudCByYXRoZXIgdGhhbiBjcmFzaCB0aGUgY2FsbGJhY2tcbiAgICByZXR1cm4geyB2ZXJpZmllZDogbnVsbCwgbWF0Y2hlc0Ftb3VudDogZmFsc2UgfTtcbiAgfVxuXG4gIGNvbnN0IHZhbGlkU3RhdHVzID1cbiAgICB2ZXJpZmllZC5zdGF0dXMgPT09IFwiVkFMSURcIiB8fCB2ZXJpZmllZC5zdGF0dXMgPT09IFwiVkFMSURBVEVEXCI7XG4gIGNvbnN0IG1hdGNoZXNBbW91bnQgPVxuICAgIHZlcmlmaWVkLmFtb3VudCAhPT0gdW5kZWZpbmVkICYmIE51bWJlcih2ZXJpZmllZC5hbW91bnQpID09PSBleHBlY3RlZEFtb3VudDtcblxuICByZXR1cm4geyB2ZXJpZmllZCwgbWF0Y2hlc0Ftb3VudDogdmFsaWRTdGF0dXMgJiYgbWF0Y2hlc0Ftb3VudCB9O1xufTtcblxuLy8gU2hhcmVkIGJ5IHRoZSBjb25maXJtIChzdWNjZXNzL2ZhaWwvY2FuY2VsKSBhbmQgSVBOIGVuZHBvaW50cy4gSWRlbXBvdGVudDogYVxuLy8gc2V0dGxlZCBwYXltZW50IHNob3J0LWNpcmN1aXRzLCBzbyB0aGUgZG91YmxlLWZpcmluZyBJUE4gbmV2ZXIgZG91YmxlLWNoYXJnZXMuXG5jb25zdCBwcm9jZXNzR2F0ZXdheVJlc3VsdCA9IGFzeW5jIChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIHRyYW5JZDogc3RyaW5nLFxuICByZXN1bHQ6IElHYXRld2F5UmVzdWx0LFxuKTogUHJvbWlzZTxJUGF5bWVudEdhdGV3YXlPdXRjb21lPiA9PiB7XG4gIGNvbnN0IHBheW1lbnQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyB0cmFuSWQgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBib29raW5nOiB7XG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICB1c2VyOiB7IHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0sXG4gICAgICAgICAgcGFja2FnZTogeyBzZWxlY3Q6IHsgdGl0bGU6IHRydWUgfSB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIXBheW1lbnQgfHwgcGF5bWVudC5ib29raW5nSWQgIT09IGJvb2tpbmdJZCkge1xuICAgIC8vIEEgY2FsbGJhY2sgZm9yIGEgc2Vzc2lvbiB3ZSBuZXZlciBjcmVhdGVkIFx1MjAxNCBub3RoaW5nIHRvIHNldHRsZS5cbiAgICByZXR1cm4geyBwYXltZW50U3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCwgYm9va2luZ1N0YXR1czogbnVsbCwgY2hhbmdlZDogZmFsc2UgfTtcbiAgfVxuXG4gIGlmIChwYXltZW50LnN0YXR1cyA9PT0gUGF5bWVudFN0YXR1cy5TVUNDRVNTKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiBmYWxzZSxcbiAgICB9O1xuICB9XG5cbiAgLy8gQ2FuY2VsIGNhbGxiYWNrIFx1MjAxNCB0aGUgc2hvcHBlciBhYmFuZG9uZWQgY2hlY2tvdXQsIG5vIGNoYXJnZSB3YXMgbWFkZS5cbiAgaWYgKHJlc3VsdC5mYWlsX3N0YXR1cyA9PT0gXCJDQU5DRUxMRURcIiB8fCByZXN1bHQuc3RhdHVzID09PSBcIkNBTkNFTExFRFwiKSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IHVwZGF0ZWQuc3RhdHVzLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IHVwZGF0ZWQuc3RhdHVzICE9PSBwYXltZW50LnN0YXR1cyxcbiAgICB9O1xuICB9XG5cbiAgLy8gTm8gdmFsX2lkIG1lYW5zIHRoZSBnYXRld2F5IHJlcG9ydGVkIGEgZmFpbHVyZSAoZmFpbF91cmwpIFx1MjAxNCBub3RoaW5nIHRvIHZlcmlmeS5cbiAgaWYgKCFyZXN1bHQudmFsX2lkKSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuRkFJTEVEIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IHVwZGF0ZWQuc3RhdHVzLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IHVwZGF0ZWQuc3RhdHVzICE9PSBwYXltZW50LnN0YXR1cyxcbiAgICB9O1xuICB9XG5cbiAgLy8gU3VjY2VzcyBwYXRoOiB2ZXJpZnkgc2VydmVyLXNpZGUgYW5kIG9ubHkgdGhlbiBtYXJrIHRoZSBib29raW5nIGFzIHBhaWQuXG4gIGNvbnN0IHsgdmVyaWZpZWQsIG1hdGNoZXNBbW91bnQgfSA9IGF3YWl0IHZlcmlmeVN1Y2Nlc3MoXG4gICAgcmVzdWx0LnZhbF9pZCxcbiAgICBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICApO1xuXG4gIGlmICghbWF0Y2hlc0Ftb3VudCkge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB0cnVlLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBzZXR0bGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgdHgucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsXG4gICAgICAgIHZhbElkOiByZXN1bHQudmFsX2lkLFxuICAgICAgICBjYXJkVHlwZTogcmVzdWx0LmNhcmRfdHlwZSA/PyB2ZXJpZmllZD8uY2FyZF90eXBlLFxuICAgICAgICBiYW5rVHJhbklkOiByZXN1bHQuYmFua190cmFuX2lkID8/IHZlcmlmaWVkPy5iYW5rX3RyYW5faWQsXG4gICAgICAgIHBhaWRBdDogbmV3IERhdGUoKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBjb21wYXJlLWFuZC1zZXQ6IG9ubHkgYSBzdGlsbC1QRU5ESU5HIGJvb2tpbmcgYmVjb21lcyBQQUlEOyBhIGJvb2tpbmcgdGhhdFxuICAgIC8vIHdhcyBjb25jdXJyZW50bHkgY29uZmlybWVkIG9yIGNhbmNlbGxlZCBrZWVwcyBpdHMgc3RhdGUsIHRoZSBtb25leSBzdGF5cyBvbi5cbiAgICBhd2FpdCB0eC5ib29raW5nLnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCwgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBFTkRJTkcgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBBSUQgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB1cGRhdGVkO1xuICB9KTtcblxuICBjb25zdCBib29raW5nQWZ0ZXIgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCB9IH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IFwicGF5bWVudCByZWNlaXZlZFwiIGVtYWlsIFx1MjAxNCBuZXZlciBmYWlscyB0aGUgY2FsbGJhY2tcbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgZW1haWw6IHBheW1lbnQuYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgbmFtZTogcGF5bWVudC5ib29raW5nLnVzZXIubmFtZSxcbiAgICAgIHBhY2thZ2VUaXRsZTogcGF5bWVudC5ib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICB0cmF2ZWxEYXRlOiBwYXltZW50LmJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICAgIHRyYXZlbGVyczogcGF5bWVudC5ib29raW5nLnRyYXZlbGVycyxcbiAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihwYXltZW50LmFtb3VudCksXG4gICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEFJRCxcbiAgICB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXltZW50U3RhdHVzOiBzZXR0bGVkLnN0YXR1cyxcbiAgICBib29raW5nU3RhdHVzOiBib29raW5nQWZ0ZXI/LnN0YXR1cyA/PyBudWxsLFxuICAgIGNoYW5nZWQ6IHRydWUsXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFNlcnZpY2UgPSB7XG4gIGNyZWF0ZVBheW1lbnRTZXNzaW9uLFxuICBwcm9jZXNzR2F0ZXdheVJlc3VsdCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgYm9va2luZ0lkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkJvb2tpbmcgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC51dWlkKFwiQm9va2luZyBpZCBtdXN0IGJlIGEgdmFsaWQgdXVpZFwiKSxcbn0pO1xuXG5jb25zdCBjYWxsYmFja1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBib29raW5nSWQ6IHouc3RyaW5nKCkudXVpZChcIkJvb2tpbmcgaWQgbXVzdCBiZSBhIHZhbGlkIHV1aWRcIiksXG4gIHRyYW5JZDogei5zdHJpbmcoKS5taW4oMSksXG4gIHN0YXR1czogei5lbnVtKFtcInN1Y2Nlc3NcIiwgXCJmYWlsXCIsIFwiY2FuY2VsXCJdKS5vcHRpb25hbCgpLFxufSk7XG5cbi8vIEJvZHkgb2YgdGhlIGdhdGV3YXkgUE9TVCBcdTIwMTQgb25seSBmaWVsZHMgd2UgY29uc3VtZSwgYWxsIG9wdGlvbmFsIGJlY2F1c2UgdGhlXG4vLyBzaGFwZSBkaWZmZXJzIGJldHdlZW4gc3VjY2VzcyAvIGZhaWwgLyBjYW5jZWwgLyBJUE4gY2FsbGJhY2tzLlxuY29uc3QgZ2F0ZXdheVJlc3VsdFNjaGVtYSA9IHoub2JqZWN0KHtcbiAgdmFsX2lkOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHN0YXR1czogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBmYWlsX3N0YXR1czogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBjYXJkX3R5cGU6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgYmFua190cmFuX2lkOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGN1cnJlbmN5OiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGFtb3VudDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRDcmVhdGVQYXltZW50U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY3JlYXRlU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRDYWxsYmFja1F1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY2FsbGJhY2tRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUR2F0ZXdheVJlc3VsdFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGdhdGV3YXlSZXN1bHRTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVTY2hlbWEsXG4gIGNhbGxiYWNrUXVlcnlTY2hlbWEsXG4gIGdhdGV3YXlSZXN1bHRTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgd2lzaGxpc3RDb250cm9sbGVyIH0gZnJvbSBcIi4vd2lzaGxpc3QuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgd2lzaGxpc3RWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3dpc2hsaXN0LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIFNhdmUgYSBwYWNrYWdlIHRvIHRoZSB3aXNobGlzdCAoVVNFUiBvbmx5KVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHdpc2hsaXN0VmFsaWRhdGlvbnMuY3JlYXRlV2lzaGxpc3RTY2hlbWEgfSksXG4gIHdpc2hsaXN0Q29udHJvbGxlci5hZGRUb1dpc2hsaXN0LFxuKTtcblxuLy8gMi4gTXkgd2lzaGxpc3QgKFVTRVIgb25seSkgXHUyMDE0IHBhZ2luYXRlZCwgbmV3ZXN0IGZpcnN0XG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogd2lzaGxpc3RWYWxpZGF0aW9ucy53aXNobGlzdFF1ZXJ5U2NoZW1hIH0pLFxuICB3aXNobGlzdENvbnRyb2xsZXIuZ2V0TXlXaXNobGlzdCxcbik7XG5cbi8vIDMuIFJlbW92ZSBhIHBhY2thZ2UgZnJvbSB0aGUgd2lzaGxpc3QgKFVTRVIgb25seSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzpwYWNrYWdlSWRcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHdpc2hsaXN0VmFsaWRhdGlvbnMud2lzaGxpc3RQYXJhbXNTY2hlbWEgfSksXG4gIHdpc2hsaXN0Q29udHJvbGxlci5yZW1vdmVGcm9tV2lzaGxpc3QsXG4pO1xuXG5leHBvcnQgY29uc3Qgd2lzaGxpc3RSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyB3aXNobGlzdFNlcnZpY2UgfSBmcm9tIFwiLi93aXNobGlzdC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gU2F2ZSBhIHBhY2thZ2UgdG8gdGhlIHdpc2hsaXN0IGNvbnRyb2xsZXIgKFVTRVIpXG5jb25zdCBhZGRUb1dpc2hsaXN0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2lzaGxpc3RTZXJ2aWNlLmFkZFRvV2lzaGxpc3QodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIGFkZGVkIHRvIHdpc2hsaXN0IHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIE15IHdpc2hsaXN0IGNvbnRyb2xsZXIgKFVTRVIpXG5jb25zdCBnZXRNeVdpc2hsaXN0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2lzaGxpc3RTZXJ2aWNlLmdldE15V2lzaGxpc3QodXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIldpc2hsaXN0IHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gUmVtb3ZlIGZyb20gd2lzaGxpc3QgY29udHJvbGxlciAoVVNFUikgXHUyMDE0IDIwNCBzbyBhIHJlcGVhdCBkZWxldGUgaXMgYVxuLy8gICAgbm8tb3AgaW5kaXN0aW5ndWlzaGFibGUgZnJvbSBhIHN1Y2Nlc3NmdWwgb25lIChubyBib2R5LCBubyBlcnJvcikuXG5jb25zdCByZW1vdmVGcm9tV2lzaGxpc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCBwYWNrYWdlSWQgPSBTdHJpbmcocmVxLnBhcmFtcy5wYWNrYWdlSWQpO1xuXG4gICAgYXdhaXQgd2lzaGxpc3RTZXJ2aWNlLnJlbW92ZUZyb21XaXNobGlzdCh1c2VySWQsIHBhY2thZ2VJZCk7XG5cbiAgICByZXMuc3RhdHVzKGh0dHBTdGF0dXMuTk9fQ09OVEVOVCkuc2VuZCgpO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHdpc2hsaXN0Q29udHJvbGxlciA9IHtcbiAgYWRkVG9XaXNobGlzdCxcbiAgZ2V0TXlXaXNobGlzdCxcbiAgcmVtb3ZlRnJvbVdpc2hsaXN0LFxufTsiLCAiaW1wb3J0IHsgUGFja2FnZVN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgcHVibGljUGFja2FnZUluY2x1ZGUgfSBmcm9tIFwiLi4vcGFja2FnZS9wYWNrYWdlLnNlcnZpY2VcIjtcbmltcG9ydCB7IElDcmVhdGVXaXNobGlzdFBheWxvYWQsIElXaXNobGlzdFF1ZXJ5IH0gZnJvbSBcIi4vd2lzaGxpc3QuaW50ZXJmYWNlXCI7XG5cbi8vIE1vbmV5IGlzIGBEZWNpbWFsKDEwLDIpYCBpbiB0aGUgc2NoZW1hIChBR0VOVFMubWQpIFx1MjAxNCBtYXAgdG8gTnVtYmVyIG9uIHJldHVybi5cbmNvbnN0IHNlcmlhbGl6ZVdpc2hsaXN0SXRlbSA9IDxcbiAgVCBleHRlbmRzIHsgcGFja2FnZTogeyBwcmljZTogUHJpc21hLkRlY2ltYWwgfSB9LFxuPihcbiAgcm93OiBULFxuKTogVCA9PiAoe1xuICAuLi5yb3csXG4gIHBhY2thZ2U6IHsgLi4ucm93LnBhY2thZ2UsIHByaWNlOiBOdW1iZXIocm93LnBhY2thZ2UucHJpY2UpIH0sXG59KTtcblxuLy8gMS4gU2F2ZSBhIHBhY2thZ2UgdG8gdGhlIHdpc2hsaXN0IChVU0VSKSBcdTIwMTQgaWRlbXBvdGVudC4gVGhlIHBhY2thZ2UgbXVzdCBiZVxuLy8gICAgQVBQUk9WRUQgYW5kIG5vdCBkZWxldGVkLCBtaXJyb3JpbmcgdGhlIHB1YmxpYy1wYWNrYWdlIHZpc2liaWxpdHkgcnVsZS5cbmNvbnN0IGFkZFRvV2lzaGxpc3QgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJQ3JlYXRlV2lzaGxpc3RQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIGlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHByaXNtYS53aXNobGlzdEl0ZW0udXBzZXJ0KHtcbiAgICB3aGVyZTogeyB1c2VySWRfcGFja2FnZUlkOiB7IHVzZXJJZCwgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9IH0sXG4gICAgY3JlYXRlOiB7IHVzZXJJZCwgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9LFxuICAgIHVwZGF0ZToge30sXG4gIH0pO1xufTtcblxuLy8gMi4gUGFnaW5hdGVkIHdpc2hsaXN0IChVU0VSKSBcdTIwMTQgbmV3ZXN0IGZpcnN0LiBSb3dzIHdob3NlIHBhY2thZ2Ugd2FzIGxhdGVyXG4vLyAgICBzb2Z0LWRlbGV0ZWQgb3IgZGVtb3RlZCBvdXQgb2YgQVBQUk9WRUQgYXJlIGZpbHRlcmVkIGF0IHJlYWQgdGltZSwgc28gdGhlXG4vLyAgICBwYWdlIG5ldmVyIGxpc3RzIGEgcGFja2FnZSB3aG9zZSBkZXRhaWwgcm91dGUgd291bGQgNDA0LlxuY29uc3QgZ2V0TXlXaXNobGlzdCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElXaXNobGlzdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5XaXNobGlzdEl0ZW1XaGVyZUlucHV0ID0ge1xuICAgIHVzZXJJZCxcbiAgICBwYWNrYWdlOiB7IGlzRGVsZXRlZDogZmFsc2UsIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCB9LFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLndpc2hsaXN0SXRlbS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgcGFja2FnZTogeyBpbmNsdWRlOiBwdWJsaWNQYWNrYWdlSW5jbHVkZSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEud2lzaGxpc3RJdGVtLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplV2lzaGxpc3RJdGVtKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAzLiBSZW1vdmUgYSBwYWNrYWdlIGZyb20gdGhlIHdpc2hsaXN0IChVU0VSKSBcdTIwMTQgaWRlbXBvdGVudDsgYSBtaXNzaW5nIHJvdyBpc1xuLy8gICAgYSBuby1vcCwgbmV2ZXIgYW4gZXJyb3IuIERlbGliZXJhdGVseSBubyBcImNsZWFyIGFsbFwiLlxuY29uc3QgcmVtb3ZlRnJvbVdpc2hsaXN0ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYWNrYWdlSWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBwcmlzbWEud2lzaGxpc3RJdGVtLmRlbGV0ZU1hbnkoe1xuICAgIHdoZXJlOiB7IHVzZXJJZCwgcGFja2FnZUlkIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IHdpc2hsaXN0U2VydmljZSA9IHtcbiAgYWRkVG9XaXNobGlzdCxcbiAgZ2V0TXlXaXNobGlzdCxcbiAgcmVtb3ZlRnJvbVdpc2hsaXN0LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlV2lzaGxpc3RTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhY2thZ2VJZDogelxuICAgICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3Qgd2lzaGxpc3RQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5jb25zdCB3aXNobGlzdFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxufSk7XG5cbmV4cG9ydCBjb25zdCB3aXNobGlzdFZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVXaXNobGlzdFNjaGVtYSxcbiAgd2lzaGxpc3RQYXJhbXNTY2hlbWEsXG4gIHdpc2hsaXN0UXVlcnlTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24uY29udHJvbGxlclwiO1xuaW1wb3J0IHsgbm90aWZpY2F0aW9uVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24udmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gTk9URTogUEFUQ0ggL3JlYWQtYWxsIE1VU1Qgc3RheSByZWdpc3RlcmVkIGJlZm9yZSBQQVRDSCAvOmlkL3JlYWQgXHUyMDE0XG4vLyBFeHByZXNzIG1hdGNoZXMgdG9wLWRvd24sIGFuZCBgL3JlYWQtYWxsYCB3b3VsZCBvdGhlcndpc2UgYmUgc3dhbGxvd2VkIGJ5XG4vLyB0aGUgYDppZGAgcGFyYW0gcm91dGUuXG5cbi8vIDEuIE15IG5vdGlmaWNhdGlvbnMgKGFueSBhdXRoZW50aWNhdGVkIHVzZXIpIFx1MjAxNCBwYWdpbmF0ZWQsIG9wdGlvbmFsID91bnJlYWQ9dHJ1ZVxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IG5vdGlmaWNhdGlvblZhbGlkYXRpb25zLm5vdGlmaWNhdGlvblF1ZXJ5U2NoZW1hIH0pLFxuICBub3RpZmljYXRpb25Db250cm9sbGVyLmdldE15Tm90aWZpY2F0aW9ucyxcbik7XG5cbi8vIDIuIFVucmVhZCBjb3VudCBmb3IgdGhlIGJlbGwgYmFkZ2VcbnJvdXRlci5nZXQoXG4gIFwiL3VucmVhZC1jb3VudFwiLFxuICBhdXRoKCksXG4gIG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIuZ2V0VW5yZWFkQ291bnQsXG4pO1xuXG4vLyAzLiBNYXJrIGFsbCBteSBub3RpZmljYXRpb25zIHJlYWRcbnJvdXRlci5wYXRjaChcbiAgXCIvcmVhZC1hbGxcIixcbiAgYXV0aCgpLFxuICBub3RpZmljYXRpb25Db250cm9sbGVyLm1hcmtBbGxBc1JlYWQsXG4pO1xuXG4vLyA0LiBNYXJrIG9uZSBub3RpZmljYXRpb24gcmVhZCAob3duZXIgb25seSlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3JlYWRcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IG5vdGlmaWNhdGlvblZhbGlkYXRpb25zLm5vdGlmaWNhdGlvblBhcmFtc1NjaGVtYSB9KSxcbiAgbm90aWZpY2F0aW9uQ29udHJvbGxlci5tYXJrQXNSZWFkLFxuKTtcblxuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvblJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IG5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24uc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIE15IG5vdGlmaWNhdGlvbnMgY29udHJvbGxlciAoYW55IGF1dGhlbnRpY2F0ZWQgdXNlcilcbmNvbnN0IGdldE15Tm90aWZpY2F0aW9ucyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5vdGlmaWNhdGlvblNlcnZpY2UuZ2V0TXlOb3RpZmljYXRpb25zKFxuICAgICAgdXNlcklkLFxuICAgICAgcmVxLnF1ZXJ5LFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiTm90aWZpY2F0aW9ucyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIFVucmVhZCBjb3VudCBjb250cm9sbGVyIChiZWxsIGJhZGdlKVxuY29uc3QgZ2V0VW5yZWFkQ291bnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBub3RpZmljYXRpb25TZXJ2aWNlLmdldFVucmVhZENvdW50KHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVW5yZWFkIGNvdW50IHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBNYXJrIG9uZSBub3RpZmljYXRpb24gcmVhZCBjb250cm9sbGVyXG5jb25zdCBtYXJrQXNSZWFkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbm90aWZpY2F0aW9uU2VydmljZS5tYXJrQXNSZWFkKHVzZXJJZCwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIk5vdGlmaWNhdGlvbiBtYXJrZWQgYXMgcmVhZC5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIE1hcmsgYWxsIG5vdGlmaWNhdGlvbnMgcmVhZCBjb250cm9sbGVyXG5jb25zdCBtYXJrQWxsQXNSZWFkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbm90aWZpY2F0aW9uU2VydmljZS5tYXJrQWxsQXNSZWFkKHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIG5vdGlmaWNhdGlvbnMgbWFya2VkIGFzIHJlYWQuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3Qgbm90aWZpY2F0aW9uQ29udHJvbGxlciA9IHtcbiAgZ2V0TXlOb3RpZmljYXRpb25zLFxuICBnZXRVbnJlYWRDb3VudCxcbiAgbWFya0FzUmVhZCxcbiAgbWFya0FsbEFzUmVhZCxcbn07IiwgImltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uUXVlcnkgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24uaW50ZXJmYWNlXCI7XG5cbi8vIDEuIE15IG5vdGlmaWNhdGlvbnMgKG5ld2VzdCBmaXJzdCkgXHUyMDE0IG9wdGlvbmFsID91bnJlYWQ9dHJ1ZSBmaWx0ZXIuXG5jb25zdCBnZXRNeU5vdGlmaWNhdGlvbnMgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBxdWVyeTogSU5vdGlmaWNhdGlvblF1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMjA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ob3RpZmljYXRpb25XaGVyZUlucHV0ID0ge1xuICAgIHVzZXJJZCxcbiAgICAuLi4ocXVlcnkudW5yZWFkID8geyBpc1JlYWQ6IGZhbHNlIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEubm90aWZpY2F0aW9uLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLm5vdGlmaWNhdGlvbi5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMi4gVW5yZWFkIGNvdW50IGZvciB0aGUgYmVsbCBiYWRnZSBcdTIwMTQgc2luZ2xlIGluZGV4LWJhY2tlZCBjb3VudC5cbmNvbnN0IGdldFVucmVhZENvdW50ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNvdW50ID0gYXdhaXQgcHJpc21hLm5vdGlmaWNhdGlvbi5jb3VudCh7XG4gICAgd2hlcmU6IHsgdXNlcklkLCBpc1JlYWQ6IGZhbHNlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7IGNvdW50IH07XG59O1xuXG4vLyAzLiBNYXJrIG9uZSBub3RpZmljYXRpb24gcmVhZCAob3duZXIgb25seSBcdTIwMTQgYSBmb3JlaWduIGlkIGlzIGEgNDA0KS5cbmNvbnN0IG1hcmtBc1JlYWQgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLm5vdGlmaWNhdGlvbi51cGRhdGVNYW55KHtcbiAgICB3aGVyZTogeyBpZCwgdXNlcklkIH0sXG4gICAgZGF0YTogeyBpc1JlYWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKHJlc3VsdC5jb3VudCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiTm90aWZpY2F0aW9uIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4geyBjb3VudDogcmVzdWx0LmNvdW50IH07XG59O1xuXG4vLyA0LiBNYXJrIGFsbCBteSBub3RpZmljYXRpb25zIHJlYWQgXHUyMDE0IGlkZW1wb3RlbnQuXG5jb25zdCBtYXJrQWxsQXNSZWFkID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24udXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHsgdXNlcklkLCBpc1JlYWQ6IGZhbHNlIH0sXG4gICAgZGF0YTogeyBpc1JlYWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHsgY291bnQ6IHJlc3VsdC5jb3VudCB9O1xufTtcblxuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSB7XG4gIGdldE15Tm90aWZpY2F0aW9ucyxcbiAgZ2V0VW5yZWFkQ291bnQsXG4gIG1hcmtBc1JlYWQsXG4gIG1hcmtBbGxBc1JlYWQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBub3RpZmljYXRpb25RdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDIwKSxcbiAgLy8gXCJ0cnVlXCIvXCJmYWxzZVwiIHN0cmluZ3Mgb25seSBcdTIwMTQgei5jb2VyY2UuYm9vbGVhbigpIHdvdWxkIHRyZWF0IHRoZSBzdHJpbmdcbiAgLy8gXCJmYWxzZVwiIGFzIHRydXRoeS5cbiAgdW5yZWFkOiB6XG4gICAgLmVudW0oW1widHJ1ZVwiLCBcImZhbHNlXCJdKVxuICAgIC50cmFuc2Zvcm0oKHZhbHVlKSA9PiB2YWx1ZSA9PT0gXCJ0cnVlXCIpXG4gICAgLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3Qgbm90aWZpY2F0aW9uUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOb3RpZmljYXRpb24gaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oMSwgXCJOb3RpZmljYXRpb24gaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG59KTtcblxuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvblZhbGlkYXRpb25zID0ge1xuICBub3RpZmljYXRpb25RdWVyeVNjaGVtYSxcbiAgbm90aWZpY2F0aW9uUGFyYW1zU2NoZW1hLFxufTsiLCAiLy8gVmVyY2VsIHNlcnZlcmxlc3MgZW50cnlwb2ludCBcdTIwMTQgcmUtZXhwb3J0cyB0aGUgc2FtZSBFeHByZXNzIGFwcCB0aGUgbG9jYWxcbi8vIGJ1aWxkIHVzZXMuIFZlcmNlbCdzIEB2ZXJjZWwvbm9kZSBydW50aW1lIGNvbXBpbGVzIGFuZCB3cmFwcyBpdDsgdGhlIGFwcCBpc1xuLy8gc3BsaXQgZnJvbSBzZXJ2ZXIudHMgKHdoaWNoIG9ubHkgc3RhcnRzIHRoZSBsaXN0ZW5lcikgc28gdGhlIHR3byBob3N0cyBzaGFyZVxuLy8gb25lIHJvdXRlIHJlZ2lzdHJ5LlxuaW1wb3J0IGFwcCBmcm9tIFwiLi4vc3JjL2FwcFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhcHA7Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7OztBQUFBLE9BQU8sYUFBK0Q7QUFDdEUsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFlBQVk7QUFDbkIsT0FBTyxlQUFlOzs7QUNMdEIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sVUFBVTtBQUNqQixTQUFTLFNBQVM7QUFFbEIsT0FBTyxPQUFPO0FBQUEsRUFDWixPQUFPO0FBQUEsRUFDUCxNQUFNLEtBQUssS0FBSyxRQUFRLElBQUksR0FBRyxNQUFNO0FBQ3ZDLENBQUM7QUFLRCxJQUFNLFlBQVksRUFBRSxPQUFPO0FBQUEsRUFDekIsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLE1BQU07QUFBQSxFQUMvQixVQUFVLEVBQUUsS0FBSyxDQUFDLGVBQWUsWUFBWSxDQUFDLEVBQUUsUUFBUSxhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1yRSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVM7QUFBQSxFQUM1QyxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVM7QUFBQSxFQUU3QyxjQUFjLEVBQUUsT0FBTyxFQUFFLElBQUksR0FBRywwQkFBMEI7QUFBQSxFQUUxRCxvQkFBb0IsRUFBRSxPQUFPLEVBQUUsUUFBUSxJQUFJO0FBQUE7QUFBQTtBQUFBLEVBSTNDLGFBQWEsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFNBQVM7QUFBQSxFQUN6QyxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLEVBQUUsU0FBUztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU8zQyxzQkFBc0IsRUFBRSxPQUFPLEVBQUUsU0FBUztBQUFBLEVBQzFDLDRCQUE0QixFQUFFLE9BQU8sRUFBRSxTQUFTO0FBQUEsRUFDaEQscUJBQXFCLEVBQUUsT0FBTyxFQUFFLFFBQVEsTUFBTTtBQUFBO0FBQUE7QUFBQSxFQUc5QyxxQkFBcUIsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVM7QUFBQSxFQUMvQyx5QkFBeUIsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVM7QUFBQSxFQUNuRCx1QkFBdUIsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTWpELG9CQUFvQixFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUztBQUFBLEVBRTlDLG1CQUFtQixFQUFFLE9BQU8sRUFBRSxJQUFJLEdBQUcsK0JBQStCO0FBQUEsRUFDcEUsb0JBQW9CLEVBQUUsT0FBTyxFQUFFLElBQUksR0FBRyxnQ0FBZ0M7QUFBQSxFQUN0RSx1QkFBdUIsRUFBRSxPQUFPLEVBQUUsUUFBUSxJQUFJO0FBQUEsRUFDOUMsd0JBQXdCLEVBQUUsT0FBTyxFQUFFLFFBQVEsS0FBSztBQUFBO0FBQUE7QUFBQSxFQUloRCxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsU0FBUztBQUFBO0FBQUE7QUFBQSxFQUl0QyxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUsU0FBUztBQUFBLEVBQ3BDLHdCQUF3QixFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUztBQUFBLEVBQ3BELFlBQVksRUFBRSxPQUFPLEVBQUUsU0FBUztBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS2hDLFlBQVksRUFBRSxPQUFPLEVBQUUsU0FBUztBQUFBLEVBQ2hDLGdCQUFnQixFQUFFLE9BQU8sRUFBRSxTQUFTO0FBQUEsRUFDcEMsWUFBWSxFQUFFLE9BQU8sRUFBRSxTQUFTO0FBQUEsRUFDaEMsWUFBWSxFQUFFLE9BQU8sRUFBRSxTQUFTO0FBQUEsRUFDaEMsV0FBVyxFQUFFLE9BQU8sRUFBRSxTQUFTO0FBQUEsRUFDL0IsZUFBZSxFQUFFLE9BQU8sRUFBRSxTQUFTO0FBQUEsRUFFbkMsdUJBQXVCLEVBQUUsT0FBTyxFQUFFLElBQUksR0FBRyxtQ0FBbUM7QUFBQSxFQUM1RSxvQkFBb0IsRUFBRSxPQUFPLEVBQUUsSUFBSSxHQUFHLGdDQUFnQztBQUFBLEVBQ3RFLHVCQUF1QixFQUFFLE9BQU8sRUFBRSxJQUFJLEdBQUcsbUNBQW1DO0FBQzlFLENBQUM7QUFFRCxJQUFNLFNBQVMsVUFBVSxVQUFVLFFBQVEsR0FBRztBQUU5QyxJQUFJLENBQUMsT0FBTyxTQUFTO0FBQ25CLFVBQVEsTUFBTSx1Q0FBa0M7QUFDaEQsVUFBUSxNQUFNLE9BQU8sTUFBTSxRQUFRLEVBQUUsV0FBVztBQUNoRCxVQUFRLEtBQUssQ0FBQztBQUNoQjtBQUVBLElBQU0sTUFBTSxPQUFPO0FBRW5CLElBQU0sU0FBUztBQUFBLEVBQ2IsTUFBTSxJQUFJO0FBQUEsRUFDVixVQUFVLElBQUk7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtkLGtCQUFrQixJQUFJLG9CQUFvQjtBQUFBLEVBQzFDLG1CQUNFLElBQUkscUJBQXFCLElBQUksc0JBQXNCO0FBQUEsRUFFckQsY0FBYyxJQUFJO0FBQUEsRUFFbEIsb0JBQW9CLElBQUk7QUFBQSxFQUV4QixhQUFhLElBQUk7QUFBQSxFQUNqQixnQkFBZ0IsSUFBSTtBQUFBLEVBRXBCLHNCQUFzQixJQUFJO0FBQUEsRUFDMUIsNEJBQTRCLElBQUk7QUFBQSxFQUNoQyxxQkFBcUIsSUFBSSx3QkFBd0I7QUFBQTtBQUFBLEVBRWpELHFCQUNFLElBQUksd0JBQ0gsSUFBSSx3QkFBd0IsU0FDekIsd0RBQ0E7QUFBQSxFQUNOLHlCQUNFLElBQUksNEJBQ0gsSUFBSSx3QkFBd0IsU0FDekIseUVBQ0E7QUFBQSxFQUNOLHVCQUNFLElBQUksMEJBQ0gsSUFBSSx3QkFBd0IsU0FDekIsa0ZBQ0E7QUFBQSxFQUNOLG9CQUFvQixJQUFJO0FBQUEsRUFFeEIsbUJBQW1CLElBQUk7QUFBQSxFQUN2QixvQkFBb0IsSUFBSTtBQUFBLEVBQ3hCLHVCQUF1QixJQUFJO0FBQUEsRUFDM0Isd0JBQXdCLElBQUk7QUFBQSxFQUU1QixrQkFBa0IsSUFBSTtBQUFBLEVBRXRCLGdCQUFnQixJQUFJO0FBQUEsRUFDcEIsd0JBQXdCLElBQUk7QUFBQSxFQUM1QixZQUFZLElBQUk7QUFBQTtBQUFBLEVBR2hCLFlBQVksSUFBSTtBQUFBLEVBQ2hCLGdCQUFnQixJQUFJO0FBQUEsRUFDcEIsWUFBWSxJQUFJO0FBQUEsRUFDaEIsWUFBWSxJQUFJO0FBQUEsRUFDaEIsV0FBVyxJQUFJO0FBQUEsRUFDZixlQUFlLElBQUk7QUFBQSxFQUVuQix1QkFBdUIsSUFBSTtBQUFBLEVBQzNCLG9CQUFvQixJQUFJO0FBQUEsRUFDeEIsdUJBQXVCLElBQUk7QUFDN0I7QUFFQSxJQUFPLGlCQUFROzs7QUN6SmYsSUFBTSxrQkFBa0IsQ0FBQyxLQUFjLFFBQWtCO0FBQ3ZELE1BQUksT0FBTyxHQUFHLEVBQUUsS0FBSztBQUFBLElBQ25CLFNBQVM7QUFBQSxJQUNULFlBQVk7QUFBQSxJQUNaLFNBQVM7QUFBQSxJQUNULE1BQU0sSUFBSTtBQUFBLElBQ1YsTUFBTSxvQkFBSSxLQUFLO0FBQUEsRUFDakIsQ0FBQztBQUNIO0FBRUEsSUFBTyxtQkFBUTs7O0FDWGYsT0FBTyxnQkFBZ0I7QUFDdkIsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZ0JBQWdCOzs7QUNVekIsWUFBWUEsV0FBVTtBQUN0QixTQUFTLHFCQUFxQjs7O0FDRDlCLFlBQVksYUFBYTtBQUl6QixJQUFNQyxVQUF3QztBQUFBLEVBQzVDLG1CQUFtQixDQUFDO0FBQUEsRUFDcEIsaUJBQWlCO0FBQUEsRUFDakIsaUJBQWlCO0FBQUEsRUFDakIsa0JBQWtCO0FBQUEsRUFDbEIsZ0JBQWdCO0FBQUEsRUFDaEIsb0JBQW9CO0FBQUEsSUFDbEIsVUFBVSxDQUFDO0FBQUEsSUFDWCxTQUFTLENBQUM7QUFBQSxJQUNWLFNBQVMsQ0FBQztBQUFBLEVBQ1o7QUFBQSxFQUNBLDBCQUEwQjtBQUFBLElBQ3hCLFdBQVcsQ0FBQztBQUFBLElBQ1osU0FBUztBQUFBLEVBQ1g7QUFDRjtBQUVBQSxRQUFPLG1CQUFtQixLQUFLLE1BQU0sMjhSQUF5MlY7QUFDOTRWQSxRQUFPLHlCQUF5QjtBQUFBLEVBQzlCLFNBQVMsS0FBSyxNQUFNLDYrTEFBMm5OO0FBQUEsRUFDL29OLE9BQU87QUFDVDtBQUVBLGVBQWUsbUJBQW1CLFlBQWlEO0FBQ2pGLFFBQU0sRUFBRSxRQUFBQyxRQUFPLElBQUksTUFBTSxPQUFPLGFBQWE7QUFDN0MsUUFBTSxZQUFZQSxRQUFPLEtBQUssWUFBWSxRQUFRO0FBQ2xELFNBQU8sSUFBSSxZQUFZLE9BQU8sU0FBUztBQUN6QztBQUVBRCxRQUFPLGVBQWU7QUFBQSxFQUNwQixZQUFZLFlBQVksTUFBTSxPQUFPLDhEQUE4RDtBQUFBLEVBRW5HLDRCQUE0QixZQUFZO0FBQ3RDLFVBQU0sRUFBRSxLQUFLLElBQUksTUFBTSxPQUFPLDBFQUEwRTtBQUN4RyxXQUFPLE1BQU0sbUJBQW1CLElBQUk7QUFBQSxFQUN0QztBQUFBLEVBRUEsWUFBWTtBQUNkO0FBZ1FPLFNBQVMsdUJBQWdEO0FBQzlELFNBQWUsd0JBQWdCQSxPQUFNO0FBQ3ZDOzs7QUN6VEE7QUFBQTtBQUFBLGlCQUFBRTtBQUFBLEVBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGdCQUFBQztBQUFBLEVBQUEsZUFBQUM7QUFBQSxFQUFBLGdCQUFBQztBQUFBLEVBQUE7QUFBQTtBQUFBLG1CQUFBQztBQUFBLEVBQUE7QUFBQTtBQUFBLHlDQUFBQztBQUFBLEVBQUEscUNBQUFDO0FBQUEsRUFBQSxrQ0FBQUM7QUFBQSxFQUFBLHVDQUFBQztBQUFBLEVBQUEsbUNBQUFDO0FBQUEsRUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBQUFDO0FBQUEsRUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFBQUM7QUFBQSxFQUFBO0FBQUEsY0FBQUM7QUFBQSxFQUFBO0FBQUEsYUFBQUM7QUFBQSxFQUFBO0FBQUE7QUFpQkEsWUFBWUMsY0FBYTtBQWNsQixJQUFNUixpQ0FBd0M7QUFHOUMsSUFBTUUsbUNBQTBDO0FBR2hELElBQU1ELDhCQUFxQztBQUczQyxJQUFNRixtQ0FBMEM7QUFHaEQsSUFBTUksK0JBQXNDO0FBTTVDLElBQU0sTUFBYztBQUNwQixJQUFNRSxTQUFnQjtBQUN0QixJQUFNQyxRQUFlO0FBQ3JCLElBQU1DLE9BQWM7QUFDcEIsSUFBTUgsT0FBYztBQVFwQixJQUFNUixXQUFrQjtBQVN4QixJQUFNLHNCQUE4QixvQkFBVztBQWUvQyxJQUFNLGdCQUErQjtBQUFBLEVBQzFDLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFDVjtBQWVPLElBQU1FLGFBQVk7QUFBQSxFQUN2QixRQUFnQixtQkFBVTtBQUFBLEVBQzFCLFVBQWtCLG1CQUFVO0FBQUEsRUFDNUIsU0FBaUIsbUJBQVU7QUFDN0I7QUFNTyxJQUFNSCxVQUFpQjtBQU92QixJQUFNRSxZQUFtQjtBQU96QixJQUFNSCxXQUFrQjtBQStReEIsSUFBTSxZQUFZO0FBQUEsRUFDdkIsYUFBYTtBQUFBLEVBQ2IsVUFBVTtBQUFBLEVBQ1YsU0FBUztBQUFBLEVBQ1QsVUFBVTtBQUFBLEVBQ1YsZ0JBQWdCO0FBQUEsRUFDaEIsY0FBYztBQUFBLEVBQ2QsU0FBUztBQUFBLEVBQ1QsY0FBYztBQUFBLEVBQ2QsUUFBUTtBQUFBLEVBQ1IsYUFBYTtBQUFBLEVBQ2IsTUFBTTtBQUFBLEVBQ04sY0FBYztBQUNoQjtBQXc2Qk8sSUFBTSw0QkFBb0Msd0JBQWU7QUFBQSxFQUM5RCxpQkFBaUI7QUFBQSxFQUNqQixlQUFlO0FBQUEsRUFDZixnQkFBZ0I7QUFBQSxFQUNoQixjQUFjO0FBQ2hCLENBQVU7QUFLSCxJQUFNLDZCQUE2QjtBQUFBLEVBQ3hDLElBQUk7QUFBQSxFQUNKLFNBQVM7QUFBQSxFQUNULFdBQVc7QUFBQSxFQUNYLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFBQSxFQUNSLFVBQVU7QUFBQSxFQUNWLFdBQVc7QUFBQSxFQUNYLFdBQVc7QUFDYjtBQUtPLElBQU0sMEJBQTBCO0FBQUEsRUFDckMsSUFBSTtBQUFBLEVBQ0osT0FBTztBQUFBLEVBQ1AsTUFBTTtBQUFBLEVBQ04sU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsWUFBWTtBQUFBLEVBQ1osUUFBUTtBQUFBLEVBQ1IsV0FBVztBQUFBLEVBQ1gsVUFBVTtBQUFBLEVBQ1YsV0FBVztBQUFBLEVBQ1gsV0FBVztBQUNiO0FBS08sSUFBTSx5QkFBeUI7QUFBQSxFQUNwQyxJQUFJO0FBQUEsRUFDSixZQUFZO0FBQUEsRUFDWixXQUFXO0FBQUEsRUFDWCxZQUFZO0FBQUEsRUFDWixRQUFRO0FBQUEsRUFDUixRQUFRO0FBQUEsRUFDUixXQUFXO0FBQUEsRUFDWCxXQUFXO0FBQUEsRUFDWCxXQUFXO0FBQ2I7QUFLTyxJQUFNLDBCQUEwQjtBQUFBLEVBQ3JDLElBQUk7QUFBQSxFQUNKLE1BQU07QUFBQSxFQUNOLE1BQU07QUFBQSxFQUNOLFdBQVc7QUFBQSxFQUNYLFdBQVc7QUFDYjtBQUtPLElBQU0sZ0NBQWdDO0FBQUEsRUFDM0MsSUFBSTtBQUFBLEVBQ0osTUFBTTtBQUFBLEVBQ04sT0FBTztBQUFBLEVBQ1AsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsWUFBWTtBQUFBLEVBQ1osV0FBVztBQUFBLEVBQ1gsV0FBVztBQUNiO0FBS08sSUFBTSw4QkFBOEI7QUFBQSxFQUN6QyxJQUFJO0FBQUEsRUFDSixRQUFRO0FBQUEsRUFDUixNQUFNO0FBQUEsRUFDTixPQUFPO0FBQUEsRUFDUCxTQUFTO0FBQUEsRUFDVCxNQUFNO0FBQUEsRUFDTixRQUFRO0FBQUEsRUFDUixXQUFXO0FBQ2I7QUFLTyxJQUFNLHlCQUF5QjtBQUFBLEVBQ3BDLElBQUk7QUFBQSxFQUNKLFdBQVc7QUFBQSxFQUNYLFFBQVE7QUFBQSxFQUNSLE9BQU87QUFBQSxFQUNQLFFBQVE7QUFBQSxFQUNSLFVBQVU7QUFBQSxFQUNWLFFBQVE7QUFBQSxFQUNSLGdCQUFnQjtBQUFBLEVBQ2hCLGVBQWU7QUFBQSxFQUNmLFVBQVU7QUFBQSxFQUNWLFlBQVk7QUFBQSxFQUNaLFFBQVE7QUFBQSxFQUNSLGFBQWE7QUFBQSxFQUNiLG1CQUFtQjtBQUFBLEVBQ25CLG1CQUFtQjtBQUFBLEVBQ25CLFdBQVc7QUFBQSxFQUNYLFdBQVc7QUFDYjtBQUtPLElBQU0sOEJBQThCO0FBQUEsRUFDekMsSUFBSTtBQUFBLEVBQ0osUUFBUTtBQUFBLEVBQ1IsTUFBTTtBQUFBLEVBQ04sV0FBVztBQUFBLEVBQ1gsV0FBVztBQUFBLEVBQ1gsV0FBVztBQUNiO0FBS08sSUFBTSx3QkFBd0I7QUFBQSxFQUNuQyxJQUFJO0FBQUEsRUFDSixRQUFRO0FBQUEsRUFDUixTQUFTO0FBQUEsRUFDVCxXQUFXO0FBQUEsRUFDWCxRQUFRO0FBQUEsRUFDUixXQUFXO0FBQUEsRUFDWCxXQUFXO0FBQUEsRUFDWCxXQUFXO0FBQ2I7QUFLTyxJQUFNLDZCQUE2QjtBQUFBLEVBQ3hDLElBQUk7QUFBQSxFQUNKLE9BQU87QUFBQSxFQUNQLE1BQU07QUFBQSxFQUNOLGFBQWE7QUFBQSxFQUNiLFVBQVU7QUFBQSxFQUNWLE9BQU87QUFBQSxFQUNQLFVBQVU7QUFBQSxFQUNWLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFBQSxFQUNSLFdBQVc7QUFBQSxFQUNYLFlBQVk7QUFBQSxFQUNaLFNBQVM7QUFBQSxFQUNULFdBQVc7QUFBQSxFQUNYLFdBQVc7QUFDYjtBQUtPLElBQU0sc0JBQXNCO0FBQUEsRUFDakMsSUFBSTtBQUFBLEVBQ0osTUFBTTtBQUFBLEVBQ04sT0FBTztBQUFBLEVBQ1AsVUFBVTtBQUFBLEVBQ1YsVUFBVTtBQUFBLEVBQ1YsT0FBTztBQUFBLEVBQ1AsV0FBVztBQUFBLEVBQ1gsTUFBTTtBQUFBLEVBQ04sUUFBUTtBQUFBLEVBQ1IsY0FBYztBQUFBLEVBQ2QsZUFBZTtBQUFBLEVBQ2YsV0FBVztBQUFBLEVBQ1gsY0FBYztBQUFBLEVBQ2QsV0FBVztBQUFBLEVBQ1gsV0FBVztBQUNiO0FBS08sSUFBTSw4QkFBOEI7QUFBQSxFQUN6QyxJQUFJO0FBQUEsRUFDSixRQUFRO0FBQUEsRUFDUixXQUFXO0FBQUEsRUFDWCxXQUFXO0FBQ2I7QUFLTyxJQUFNLFlBQVk7QUFBQSxFQUN2QixLQUFLO0FBQUEsRUFDTCxNQUFNO0FBQ1I7QUFLTyxJQUFNLFlBQVk7QUFBQSxFQUN2QixTQUFTO0FBQUEsRUFDVCxhQUFhO0FBQ2Y7QUFLTyxJQUFNLGFBQWE7QUFBQSxFQUN4QixPQUFPO0FBQUEsRUFDUCxNQUFNO0FBQ1I7QUE4TU8sSUFBTSxrQkFBMEIsb0JBQVc7OztBQzd0RDNDLElBQU0sT0FBTztBQUFBLEVBQ2xCLE1BQU07QUFBQSxFQUNOLE9BQU87QUFBQSxFQUNQLE9BQU87QUFDVDtBQUtPLElBQU0sYUFBYTtBQUFBLEVBQ3hCLFFBQVE7QUFBQSxFQUNSLFdBQVc7QUFDYjtBQWFPLElBQU0sZ0JBQWdCO0FBQUEsRUFDM0IsU0FBUztBQUFBLEVBQ1QsVUFBVTtBQUFBLEVBQ1YsVUFBVTtBQUNaO0FBS08sSUFBTSxnQkFBZ0I7QUFBQSxFQUMzQixTQUFTO0FBQUEsRUFDVCxNQUFNO0FBQUEsRUFDTixXQUFXO0FBQUEsRUFDWCxXQUFXO0FBQUEsRUFDWCxXQUFXO0FBQ2I7QUFLTyxJQUFNLGdCQUFnQjtBQUFBLEVBQzNCLFdBQVc7QUFBQSxFQUNYLFNBQVM7QUFBQSxFQUNULFFBQVE7QUFBQSxFQUNSLFdBQVc7QUFBQSxFQUNYLFVBQVU7QUFDWjtBQUtPLElBQU0sYUFBYTtBQUFBLEVBQ3hCLE9BQU87QUFBQSxFQUNQLFdBQVc7QUFDYjtBQUtPLElBQU0sbUJBQW1CO0FBQUEsRUFDOUIsaUJBQWlCO0FBQUEsRUFDakIsbUJBQW1CO0FBQUEsRUFDbkIsbUJBQW1CO0FBQUEsRUFDbkIsa0JBQWtCO0FBQUEsRUFDbEIsa0JBQWtCO0FBQ3BCOzs7QUhsRUEsV0FBVyxXQUFXLElBQVMsY0FBUSxjQUFjLFlBQVksR0FBRyxDQUFDO0FBd0I5RCxJQUFNLGVBQXNCLHFCQUFxQjs7O0FJckNqRCxJQUFNLFdBQU4sY0FBdUIsTUFBTTtBQUFBLEVBQ2xDO0FBQUEsRUFFQSxZQUFZLFlBQW9CLFNBQWlCO0FBQy9DLFVBQU0sT0FBTztBQUNiLFNBQUssT0FBTztBQUNaLFNBQUssYUFBYTtBQUNsQixVQUFNLGtCQUFrQixNQUFNLEtBQUssV0FBVztBQUFBLEVBQ2hEO0FBQ0Y7OztBTEhBLElBQU0scUJBQXFCLENBQ3pCLEtBQ0EsS0FDQSxLQUNBLFNBQ0c7QUFDSCxNQUFJLGVBQU8sYUFBYSxjQUFjO0FBQ3BDLFlBQVEsTUFBTSxVQUFVLEdBQUc7QUFBQSxFQUM3QjtBQUdBLE1BQUksYUFBcUIsV0FBVztBQUNwQyxNQUFJLGVBQXVCLEtBQUssV0FBVztBQUMzQyxNQUFJLFlBQW9CLEtBQUssUUFBUTtBQUdyQyxNQUFJLGVBQWUsVUFBVTtBQUMzQixpQkFBYSxXQUFXO0FBQ3hCLG1CQUFlLElBQUksT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxLQUFLLElBQUk7QUFDekQsZ0JBQVk7QUFBQSxFQUNkLFdBR1MsZUFBZSxPQUFPLGFBQWE7QUFDMUMsaUJBQWEsV0FBVztBQUN4QixnQkFBWTtBQUNaLG1CQUNFLElBQUksU0FBUyxvQkFDVCx5Q0FDQSxrQkFBa0IsSUFBSSxJQUFJO0FBQUEsRUFDbEMsV0FHUyxlQUFlLFNBQVUsSUFBWSxTQUFTLHFCQUFxQjtBQUMxRSxpQkFBYSxXQUFXO0FBQ3hCLG1CQUFlLElBQUk7QUFBQSxFQUNyQixXQUdTLGVBQWUsd0JBQU8sNkJBQTZCO0FBQzFELGlCQUFhLFdBQVc7QUFDeEIsbUJBQ0U7QUFDRixnQkFBWTtBQUFBLEVBQ2QsV0FHUyxlQUFlLHdCQUFPLCtCQUErQjtBQUM1RCxnQkFBWTtBQUVaLFFBQUksSUFBSSxTQUFTLFNBQVM7QUFDeEIsbUJBQWEsV0FBVztBQUN4QixxQkFBZTtBQUFBLElBQ2pCLFdBQVcsSUFBSSxTQUFTLFNBQVM7QUFDL0IsbUJBQWEsV0FBVztBQUN4QixxQkFBZTtBQUFBLElBQ2pCLFdBQVcsSUFBSSxTQUFTLFNBQVM7QUFDL0IsbUJBQWEsV0FBVztBQUN4QixxQkFDRTtBQUFBLElBQ0osT0FBTztBQUNMLG1CQUFhLFdBQVc7QUFDeEIscUJBQWUsSUFBSTtBQUFBLElBQ3JCO0FBQUEsRUFDRixXQUdTLGVBQWUsd0JBQU8saUNBQWlDO0FBQzlELGdCQUFZO0FBRVosUUFBSSxJQUFJLGNBQWMsU0FBUztBQUM3QixtQkFBYSxXQUFXO0FBQ3hCLHFCQUNFO0FBQUEsSUFDSixXQUFXLElBQUksY0FBYyxTQUFTO0FBQ3BDLG1CQUFhLFdBQVc7QUFDeEIscUJBQWU7QUFBQSxJQUNqQixPQUFPO0FBQ0wsbUJBQWEsV0FBVztBQUN4QixxQkFBZSxJQUFJO0FBQUEsSUFDckI7QUFBQSxFQUNGLFdBR1MsZUFBZSx3QkFBTyxpQ0FBaUM7QUFDOUQsaUJBQWEsV0FBVztBQUN4QixnQkFBWTtBQUNaLG1CQUFlO0FBQUEsRUFDakIsV0FHUyxlQUFlLFVBQVU7QUFDaEMsaUJBQWEsSUFBSTtBQUNqQixtQkFBZSxJQUFJO0FBQ25CLGdCQUFZLElBQUksUUFBUTtBQUFBLEVBQzFCLFdBR1MsZUFBZSxPQUFPO0FBQzdCLGlCQUFhLFdBQVc7QUFDeEIsbUJBQWUsSUFBSSxXQUFXO0FBQzlCLGdCQUFZLElBQUksUUFBUTtBQUFBLEVBQzFCO0FBRUEsTUFBSSxPQUFPLFVBQVUsRUFBRSxLQUFLO0FBQUEsSUFDMUIsU0FBUztBQUFBLElBQ1Q7QUFBQSxJQUNBLE1BQU07QUFBQSxJQUNOLFNBQVM7QUFBQSxJQUNULE9BQU8sUUFBUSxJQUFJLGFBQWEsZ0JBQWdCLElBQUksUUFBUTtBQUFBLEVBQzlELENBQUM7QUFDSDtBQUVBLElBQU8sNkJBQVE7OztBTXpIZixTQUFTLGdCQUFnQjtBQUl6QixJQUFNLG1CQUFtQixlQUFPO0FBS2hDLElBQU0sVUFBVSxJQUFJLFNBQVMsRUFBRSxrQkFBa0IsS0FBSyxFQUFFLENBQUM7QUFDekQsSUFBTSxTQUFTLElBQUksYUFBYSxFQUFFLFFBQVEsQ0FBQzs7O0FDVjNDLFNBQVMsY0FBYzs7O0FDQ3ZCLE9BQU9lLGlCQUFnQjs7O0FDRHZCLE9BQU8sWUFBWTtBQUNuQixPQUFPQyxhQUFZO0FBQ25CLFNBQVMsY0FBdUM7OztBQ0ZoRCxTQUFTLG9CQUFvQjtBQUd0QixJQUFNLGVBQWUsSUFBSSxhQUFhO0FBQUEsRUFDM0MsVUFBVSxlQUFPO0FBQ25CLENBQUM7OztBQ0xELFNBQVMsb0JBQW9CO0FBUXRCLElBQU0sY0FBYyxlQUFPLGFBQzlCLGFBQWE7QUFBQSxFQUNYLFVBQVUsZUFBTztBQUFBLEVBQ2pCLFVBQVUsZUFBTztBQUFBLEVBQ2pCLFFBQVE7QUFBQSxJQUNOLE1BQU0sZUFBTztBQUFBLElBQ2IsTUFBTSxTQUFTLGVBQU8sY0FBYyxNQUFNO0FBQUEsRUFDNUM7QUFDRixDQUFDLElBQ0Q7QUFJRyxJQUFNLFdBQVcsWUFBNkM7QUFDbkUsTUFBSSxDQUFDLFlBQWEsUUFBTztBQUV6QixNQUFJLENBQUMsWUFBWSxRQUFRO0FBQ3ZCLFFBQUk7QUFDRixZQUFNLFlBQVksUUFBUTtBQUFBLElBQzVCLFNBQVMsT0FBTztBQUNkLGNBQVE7QUFBQSxRQUNOO0FBQUEsUUFDQSxpQkFBaUIsUUFBUSxNQUFNLFVBQVUsT0FBTyxLQUFLO0FBQUEsTUFDdkQ7QUFDQSxhQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1Q7OztBQ3JDQSxPQUFPLFlBQVk7QUFDbkIsT0FBTyxTQUFzQztBQUU3QyxJQUFNLGNBQWMsQ0FDbEIsU0FDQSxRQUNBLGNBQ0c7QUFJSCxRQUFNLFFBQVEsSUFBSSxLQUFLLEVBQUUsR0FBRyxTQUFTLEtBQUssT0FBTyxXQUFXLEVBQUUsR0FBRyxRQUFRLFNBQVM7QUFFbEYsU0FBTztBQUNUO0FBRUEsSUFBTSxjQUFjLENBQUMsT0FBZSxXQUFtQjtBQUNyRCxNQUFJO0FBQ0YsVUFBTSxnQkFBZ0IsSUFBSSxPQUFPLE9BQU8sTUFBTTtBQUM5QyxXQUFPO0FBQUEsTUFDTCxTQUFTO0FBQUEsTUFDVCxNQUFNO0FBQUEsSUFDUjtBQUFBLEVBQ0YsU0FBUyxPQUFZO0FBQ25CLFlBQVEsSUFBSSw4QkFBOEIsS0FBSztBQUMvQyxXQUFPO0FBQUEsTUFDTCxTQUFTO0FBQUEsTUFDVCxPQUFPLE1BQU07QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUNGO0FBRU8sSUFBTSxXQUFXO0FBQUEsRUFDdEI7QUFBQSxFQUNBO0FBQ0Y7OztBQ25DQSxPQUFPLGdCQUFnQjtBQU1oQixJQUFNLGNBQ1gsZUFBTyxhQUFhLGVBQU8sZ0JBQ3ZCLFdBQVcsZ0JBQWdCO0FBQUEsRUFDekIsU0FBUztBQUFBLEVBQ1QsTUFBTTtBQUFBLElBQ0osTUFBTSxlQUFPO0FBQUEsSUFDYixNQUFNLGVBQU87QUFBQSxFQUNmO0FBQ0YsQ0FBQyxJQUNEOzs7QUNmTixPQUFPLFFBQVE7QUFDZixPQUFPQyxXQUFVO0FBQ2pCLE9BQU8sU0FBUztBQU1ULElBQU0saUJBQWlCLENBQUMsTUFBYyxTQUFrQztBQUM3RSxRQUFNLGFBQWE7QUFBQSxJQUNqQkEsTUFBSyxLQUFLLFFBQVEsSUFBSSxHQUFHLGVBQWU7QUFBQSxJQUN4Q0EsTUFBSyxLQUFLLFFBQVEsSUFBSSxHQUFHLFdBQVc7QUFBQSxJQUNwQ0EsTUFBSyxLQUFLLFFBQVEsSUFBSSxHQUFHLGVBQWU7QUFBQSxFQUMxQztBQUVBLFFBQU0sTUFBTSxXQUFXLEtBQUssQ0FBQyxNQUFNLEdBQUcsV0FBV0EsTUFBSyxLQUFLLEdBQUcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxDQUFDO0FBQzdFLE1BQUksQ0FBQyxLQUFLO0FBQ1IsVUFBTSxJQUFJLE1BQU0sbUJBQW1CLElBQUksaUJBQWlCO0FBQUEsRUFDMUQ7QUFFQSxTQUFPLElBQUksV0FBV0EsTUFBSyxLQUFLLEtBQUssR0FBRyxJQUFJLE1BQU0sR0FBRyxJQUFJO0FBQzNEOzs7QUNWQSxJQUFNLHlCQUF5QjtBQU8vQixlQUFlLGFBQ2IsSUFDQSxTQUNBLE9BQ2U7QUFDZixNQUFJLENBQUMsYUFBYTtBQUNoQixZQUFRLEtBQUssbURBQW1EO0FBQ2hFO0FBQUEsRUFDRjtBQUVBLE1BQUk7QUFDRixVQUFNLE9BQU8sTUFBTSxNQUFNO0FBQ3pCLFVBQU0sWUFBWSxTQUFTO0FBQUEsTUFDekIsTUFBTSxlQUFPO0FBQUEsTUFDYjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSCxTQUFTLE9BQU87QUFDZCxVQUFNLFNBQVMsaUJBQWlCLFFBQVEsTUFBTSxVQUFVLE9BQU8sS0FBSztBQUNwRSxZQUFRLEtBQUssMkJBQTJCLE9BQU8sUUFBUSxFQUFFLEtBQUssTUFBTSxFQUFFO0FBQUEsRUFDeEU7QUFDRjtBQUdPLElBQU0sMkJBQTJCLE9BQ3RDLFlBQ2tCO0FBQ2xCLFFBQU07QUFBQSxJQUFhLFFBQVE7QUFBQSxJQUFPO0FBQUEsSUFBMEIsTUFDMUQsZUFBZSx5QkFBeUI7QUFBQSxNQUN0QyxNQUFNLFFBQVE7QUFBQSxNQUNkLE9BQU8sUUFBUTtBQUFBLE1BQ2YsS0FBSyxRQUFRO0FBQUEsTUFDYixtQkFBbUI7QUFBQSxJQUNyQixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBR08sSUFBTSw2QkFBNkIsT0FDeEMsWUFDa0I7QUFDbEIsUUFBTTtBQUFBLElBQWEsUUFBUTtBQUFBLElBQU87QUFBQSxJQUE2QixNQUM3RCxlQUFlLG1CQUFtQjtBQUFBLE1BQ2hDLE1BQU0sUUFBUTtBQUFBLE1BQ2QsS0FBSyxRQUFRO0FBQUEsTUFDYixtQkFBbUI7QUFBQSxJQUNyQixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBSU8sSUFBTSxtQkFBbUIsT0FDOUIsWUFDa0I7QUFDbEIsUUFBTTtBQUFBLElBQWEsUUFBUTtBQUFBLElBQU87QUFBQSxJQUF3QixNQUN4RCxlQUFlLGlCQUFpQjtBQUFBLE1BQzlCLE1BQU0sUUFBUTtBQUFBLE1BQ2QsYUFDRSxlQUFPLGFBQWEsZUFDaEIsZUFBTyxvQkFDUCxlQUFPO0FBQUEsSUFDZixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBR08sSUFBTSxnQ0FBZ0MsT0FDM0MsWUFDa0I7QUFDbEIsUUFBTTtBQUFBLElBQWEsUUFBUTtBQUFBLElBQU87QUFBQSxJQUFrQixNQUNsRCxlQUFlLDBCQUEwQjtBQUFBLE1BQ3ZDLE1BQU0sUUFBUTtBQUFBLElBQ2hCLENBQUM7QUFBQSxFQUNIO0FBQ0Y7OztBTmpFQSxJQUFNLHlCQUF5QixJQUFJO0FBSW5DLElBQU0sU0FBUyxDQUFDLFVBQ2RDLFFBQU8sV0FBVyxRQUFRLEVBQUUsT0FBTyxLQUFLLEVBQUUsT0FBTyxLQUFLO0FBSXhELElBQU0sd0JBQXdCLENBQUMsVUFBa0I7QUFDL0MsUUFBTSxVQUFVLE9BQU8sS0FBSztBQUM1QixTQUFPLFNBQVMsTUFBTSxJQUFJLEtBQUssUUFBUSxNQUFNLEdBQUksSUFBSSxvQkFBSSxLQUFLO0FBQ2hFO0FBR0EsSUFBTSxpQkFBaUIsWUFBWTtBQUNqQyxRQUFNLFNBQVMsTUFBTSxTQUFTO0FBQzlCLE1BQUksQ0FBQyxRQUFRO0FBQ1gsVUFBTSxJQUFJLFNBQVMsS0FBSyx1Q0FBdUM7QUFBQSxFQUNqRTtBQUNBLFNBQU87QUFDVDtBQUVBLElBQU0sb0JBQW9CLENBQUMsVUFNcEI7QUFBQSxFQUNMLElBQUksS0FBSztBQUFBLEVBQ1QsTUFBTSxLQUFLO0FBQUEsRUFDWCxPQUFPLEtBQUs7QUFBQSxFQUNaLE1BQU0sS0FBSztBQUFBLEVBQ1gsY0FBYyxLQUFLO0FBQ3JCO0FBRUEsSUFBTSxjQUFjLE9BQ2xCLE1BT0EsU0FBbUQsV0FDaEQ7QUFDSCxRQUFNLGVBQWUsa0JBQWtCLElBQUk7QUFFM0MsUUFBTSxjQUFjLFNBQVM7QUFBQSxJQUMzQjtBQUFBLElBQ0EsZUFBTztBQUFBLElBQ1AsRUFBRSxXQUFXLGVBQU8sc0JBQXNCO0FBQUEsRUFDNUM7QUFDQSxRQUFNQyxnQkFBZSxTQUFTO0FBQUEsSUFDNUI7QUFBQSxJQUNBLGVBQU87QUFBQSxJQUNQLEVBQUUsV0FBVyxlQUFPLHVCQUF1QjtBQUFBLEVBQzdDO0FBSUEsUUFBTSxPQUFPLGFBQWEsT0FBTztBQUFBLElBQy9CLE1BQU07QUFBQSxNQUNKLFFBQVEsS0FBSztBQUFBLE1BQ2IsTUFBTSxPQUFPQSxhQUFZO0FBQUEsTUFDekIsV0FBVyxzQkFBc0JBLGFBQVk7QUFBQSxJQUMvQztBQUFBLEVBQ0YsQ0FBQztBQUVELFNBQU8sRUFBRSxhQUFhLGNBQUFBLGNBQWE7QUFDckM7QUFFQSxJQUFNLGVBQWUsQ0FBd0MsU0FBWTtBQUN2RSxRQUFNLEVBQUUsVUFBVSxHQUFHLEtBQUssSUFBSTtBQUM5QixTQUFPO0FBQ1Q7QUFNQSxJQUFNLGVBQWUsT0FBTyxZQUFtQjtBQUM3QyxRQUFNLEVBQUUsTUFBTSxVQUFVLE9BQU8sS0FBSyxJQUFJO0FBQ3hDLFFBQU0sUUFBUSxRQUFRLE1BQU0sS0FBSyxFQUFFLFlBQVk7QUFHL0MsTUFBSSxRQUFRLFNBQVMsVUFBVSxTQUFTLFNBQVM7QUFDL0MsVUFBTSxJQUFJLFNBQVMsS0FBSyxtQ0FBbUM7QUFBQSxFQUM3RDtBQUVBLFFBQU0sZUFBZSxNQUFNLE9BQU8sS0FBSyxXQUFXO0FBQUEsSUFDaEQsT0FBTyxFQUFFLE1BQU07QUFBQSxFQUNqQixDQUFDO0FBQ0QsTUFBSSxjQUFjO0FBQ2hCLFVBQU0sSUFBSSxTQUFTLEtBQUsscUNBQXFDO0FBQUEsRUFDL0Q7QUFFQSxRQUFNLFNBQVMsTUFBTSxlQUFlO0FBTXBDLFFBQU0sc0JBQXNCLDJCQUEyQixLQUFLO0FBQzVELFFBQU0sc0JBQXNCLE1BQU0sT0FBTyxJQUFJLG1CQUFtQjtBQUNoRSxNQUFJLHFCQUFxQjtBQUN2QixVQUFNLElBQUk7QUFBQSxNQUNSO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBRUEsUUFBTSxpQkFBaUIsTUFBTSxPQUFPO0FBQUEsSUFDbEM7QUFBQSxJQUNBLE9BQU8sZUFBTyxrQkFBa0I7QUFBQSxFQUNsQztBQUdBLFFBQU0sU0FBUywwQkFBMEIsS0FBSztBQUM5QyxRQUFNLFdBQVdELFFBQU8sVUFBVSxLQUFRLEdBQU8sRUFBRSxTQUFTO0FBRTVELFFBQU0sT0FBTyxJQUFJLFFBQVEsVUFBVTtBQUFBLElBQ2pDLFlBQVk7QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxJQUNUO0FBQUEsRUFDRixDQUFDO0FBSUQsUUFBTSx1QkFBdUI7QUFBQSxJQUMzQjtBQUFBLElBQ0E7QUFBQSxJQUNBLFVBQVU7QUFBQSxJQUNWO0FBQUEsSUFDQSxNQUFNLFFBQVE7QUFBQSxFQUNoQjtBQUVBLFFBQU0sT0FBTyxJQUFJLHFCQUFxQixLQUFLLFVBQVUsb0JBQW9CLEdBQUc7QUFBQSxJQUMxRSxZQUFZO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0YsQ0FBQztBQUlELE9BQUssUUFBUSxXQUFXO0FBQUEsSUFDdEIseUJBQXlCLEVBQUUsT0FBTyxNQUFNLEtBQUssU0FBUyxDQUFDO0FBQUEsRUFDekQsQ0FBQztBQUNIO0FBTUEsSUFBTSxjQUFjLE9BQU8sWUFBaUM7QUFDMUQsUUFBTSxFQUFFLElBQUksSUFBSTtBQUNoQixRQUFNLFFBQVEsUUFBUSxNQUFNLEtBQUssRUFBRSxZQUFZO0FBSS9DLFFBQU0sZUFBZSxNQUFNLE9BQU8sS0FBSyxXQUFXLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDO0FBQ3RFLE1BQUksY0FBYztBQUNoQixVQUFNLElBQUksU0FBUyxLQUFLLDJCQUEyQjtBQUFBLEVBQ3JEO0FBRUEsUUFBTSxTQUFTLE1BQU0sZUFBZTtBQUVwQyxRQUFNLFNBQVMsMEJBQTBCLEtBQUs7QUFDOUMsUUFBTSxXQUFXLE1BQU0sT0FBTyxJQUFJLE1BQU07QUFFeEMsTUFBSSxDQUFDLFlBQVksYUFBYSxLQUFLO0FBQ2pDLFVBQU0sSUFBSSxTQUFTLEtBQUsseUJBQXlCO0FBQUEsRUFDbkQ7QUFHQSxRQUFNLE9BQU8sSUFBSSxNQUFNO0FBRXZCLFFBQU0sc0JBQXNCLDJCQUEyQixLQUFLO0FBQzVELFFBQU0sZ0JBQWdCLE1BQU0sT0FBTyxJQUFJLG1CQUFtQjtBQUUxRCxNQUFJLENBQUMsZUFBZTtBQUNsQixVQUFNLElBQUksU0FBUyxLQUFLLHlCQUF5QjtBQUFBLEVBQ25EO0FBRUEsUUFBTSxjQUFjLEtBQUssTUFBTSxhQUFhO0FBRTVDLFFBQU0sY0FBYyxNQUFNLE9BQU8sS0FBSyxPQUFPO0FBQUEsSUFDM0MsTUFBTTtBQUFBLE1BQ0osTUFBTSxZQUFZO0FBQUEsTUFDbEIsT0FBTyxZQUFZO0FBQUEsTUFDbkIsVUFBVSxZQUFZO0FBQUEsTUFDdEIsT0FBTyxZQUFZO0FBQUEsTUFDbkIsTUFBTSxZQUFZLFFBQVE7QUFBQSxNQUMxQixjQUFjO0FBQUEsTUFDZCxRQUFRO0FBQUEsTUFDUixlQUFlO0FBQUEsSUFDakI7QUFBQSxJQUNBLE1BQU0sRUFBRSxVQUFVLEtBQUs7QUFBQSxFQUN6QixDQUFDO0FBR0QsUUFBTSxPQUFPLElBQUksbUJBQW1CO0FBRXBDLE9BQUssUUFBUSxXQUFXO0FBQUEsSUFDdEIsaUJBQWlCLEVBQUUsT0FBTyxZQUFZLE9BQU8sTUFBTSxZQUFZLEtBQUssQ0FBQztBQUFBLEVBQ3ZFLENBQUM7QUFFRCxRQUFNLFNBQVMsTUFBTSxZQUFZLFdBQVc7QUFFNUMsU0FBTyxFQUFFLEdBQUcsUUFBUSxNQUFNLFlBQVk7QUFDeEM7QUFLQSxJQUFNLHFCQUFxQixPQUFPLFlBQXdDO0FBQ3hFLFFBQU0sUUFBUSxRQUFRLE1BQU0sS0FBSyxFQUFFLFlBQVk7QUFFL0MsUUFBTSxTQUFTLE1BQU0sZUFBZTtBQUVwQyxRQUFNLHNCQUFzQiwyQkFBMkIsS0FBSztBQUM1RCxRQUFNLGdCQUFnQixNQUFNLE9BQU8sSUFBSSxtQkFBbUI7QUFFMUQsTUFBSSxDQUFDLGVBQWU7QUFDbEI7QUFBQSxFQUNGO0FBRUEsUUFBTSxjQUFjLEtBQUssTUFBTSxhQUFhO0FBRTVDLFFBQU0sU0FBUywwQkFBMEIsS0FBSztBQUM5QyxRQUFNLFdBQVdBLFFBQU8sVUFBVSxLQUFRLEdBQU8sRUFBRSxTQUFTO0FBRTVELFFBQU0sT0FBTyxJQUFJLFFBQVEsVUFBVTtBQUFBLElBQ2pDLFlBQVk7QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxJQUNUO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxRQUFRLFdBQVc7QUFBQSxJQUN0Qix5QkFBeUIsRUFBRSxPQUFPLE1BQU0sWUFBWSxNQUFNLEtBQUssU0FBUyxDQUFDO0FBQUEsRUFDM0UsQ0FBQztBQUNIO0FBTUEsSUFBTSxpQkFBaUIsT0FBTyxZQUFvQztBQUNoRSxRQUFNLFFBQVEsUUFBUSxNQUFNLEtBQUssRUFBRSxZQUFZO0FBRS9DLFFBQU0sZUFBZSxNQUFNLE9BQU8sS0FBSyxXQUFXLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDO0FBRXRFLE1BQ0UsQ0FBQyxnQkFDRCxhQUFhLGFBQ2IsYUFBYSxXQUFXLGVBQ3hCLENBQUMsYUFBYSxpQkFDZCxhQUFhLGlCQUFpQixVQUM5QjtBQUVBO0FBQUEsRUFDRjtBQUVBLFFBQU0sU0FBUyxNQUFNLGVBQWU7QUFFcEMsUUFBTSxNQUFNQSxRQUFPLFVBQVUsS0FBUSxHQUFPLEVBQUUsU0FBUztBQUN2RCxRQUFNLE1BQU0saUNBQWlDLGFBQWEsS0FBSztBQUUvRCxRQUFNLE9BQU8sSUFBSSxLQUFLLEtBQUs7QUFBQSxJQUN6QixZQUFZO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssUUFBUSxXQUFXO0FBQUEsSUFDdEIsMkJBQTJCO0FBQUEsTUFDekIsT0FBTyxhQUFhO0FBQUEsTUFDcEIsTUFBTSxhQUFhO0FBQUEsTUFDbkI7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNILENBQUM7QUFDSDtBQUtBLElBQU0sZ0JBQWdCLE9BQU8sWUFBbUM7QUFDOUQsUUFBTSxFQUFFLGFBQWEsSUFBSSxJQUFJO0FBQzdCLFFBQU0sUUFBUSxRQUFRLE1BQU0sS0FBSyxFQUFFLFlBQVk7QUFFL0MsUUFBTSxlQUFlLE1BQU0sT0FBTyxLQUFLLFdBQVcsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUM7QUFFdEUsTUFDRSxDQUFDLGdCQUNELGFBQWEsYUFDYixhQUFhLFdBQVcsZUFDeEIsYUFBYSxpQkFBaUIsVUFDOUI7QUFDQSxVQUFNLElBQUksU0FBUyxLQUFLLHlCQUF5QjtBQUFBLEVBQ25EO0FBRUEsUUFBTSxTQUFTLE1BQU0sZUFBZTtBQUVwQyxRQUFNLE1BQU0saUNBQWlDLGFBQWEsS0FBSztBQUMvRCxRQUFNLFdBQVcsTUFBTSxPQUFPLElBQUksR0FBRztBQUVyQyxNQUFJLENBQUMsWUFBWSxhQUFhLEtBQUs7QUFDakMsVUFBTSxJQUFJLFNBQVMsS0FBSyx5QkFBeUI7QUFBQSxFQUNuRDtBQUVBLFFBQU0sb0JBQW9CLE1BQU0sT0FBTztBQUFBLElBQ3JDO0FBQUEsSUFDQSxPQUFPLGVBQU8sa0JBQWtCO0FBQUEsRUFDbEM7QUFFQSxRQUFNLE9BQU8sS0FBSyxPQUFPO0FBQUEsSUFDdkIsT0FBTyxFQUFFLE9BQU8sYUFBYSxNQUFNO0FBQUEsSUFDbkMsTUFBTTtBQUFBLE1BQ0osVUFBVTtBQUFBLE1BQ1YsY0FBYyxFQUFFLFdBQVcsRUFBRTtBQUFBLElBQy9CO0FBQUEsRUFDRixDQUFDO0FBR0QsUUFBTSxPQUFPLElBQUksR0FBRztBQUVwQixPQUFLLFFBQVEsV0FBVztBQUFBLElBQ3RCLDhCQUE4QjtBQUFBLE1BQzVCLE9BQU8sYUFBYTtBQUFBLE1BQ3BCLE1BQU0sYUFBYTtBQUFBLElBQ3JCLENBQUM7QUFBQSxFQUNILENBQUM7QUFDSDtBQUdBLElBQU0sWUFBWSxPQUFPLFlBQXdCO0FBQy9DLFFBQU0sRUFBRSxPQUFPLFNBQVMsSUFBSTtBQUU1QixRQUFNLE9BQU8sTUFBTSxPQUFPLEtBQUssV0FBVztBQUFBLElBQ3hDLE9BQU8sRUFBRSxNQUFNO0FBQUEsRUFDakIsQ0FBQztBQUVELE1BQUksQ0FBQyxNQUFNO0FBQ1QsVUFBTSxJQUFJLFNBQVMsS0FBSywyQkFBMkI7QUFBQSxFQUNyRDtBQUNBLE1BQUksS0FBSyxXQUFXO0FBQ2xCLFVBQU0sSUFBSSxTQUFTLEtBQUssMEJBQTBCO0FBQUEsRUFDcEQ7QUFDQSxNQUFJLEtBQUssV0FBVyxhQUFhO0FBQy9CLFVBQU0sSUFBSSxTQUFTLEtBQUssc0JBQXNCO0FBQUEsRUFDaEQ7QUFDQSxNQUFJLEtBQUssaUJBQWlCLFVBQVU7QUFDbEMsVUFBTSxJQUFJO0FBQUEsTUFDUjtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUVBLFFBQU0sa0JBQWtCLE1BQU0sT0FBTyxRQUFRLFVBQVUsS0FBSyxZQUFZLEVBQUU7QUFDMUUsTUFBSSxDQUFDLGlCQUFpQjtBQUNwQixVQUFNLElBQUksU0FBUyxLQUFLLDJCQUEyQjtBQUFBLEVBQ3JEO0FBRUEsU0FBTyxNQUFNLFlBQVksSUFBSTtBQUMvQjtBQUdBLElBQU0sY0FBYyxPQUFPLFlBQWlDO0FBQzFELFFBQU0sRUFBRSxRQUFRLElBQUk7QUFFcEIsTUFBSSxDQUFDLGVBQU8sa0JBQWtCO0FBQzVCLFVBQU0sSUFBSTtBQUFBLE1BQ1I7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFQSxNQUFJO0FBQ0osTUFBSTtBQUNGLGFBQVMsTUFBTSxhQUFhLGNBQWM7QUFBQSxNQUN4QztBQUFBLE1BQ0EsVUFBVSxlQUFPO0FBQUEsSUFDbkIsQ0FBQztBQUFBLEVBQ0gsUUFBUTtBQUNOLFVBQU0sSUFBSSxTQUFTLEtBQUssc0JBQXNCO0FBQUEsRUFDaEQ7QUFFQSxRQUFNLGFBQWEsT0FBTyxXQUFXO0FBQ3JDLE1BQUksQ0FBQyxZQUFZO0FBQ2YsVUFBTSxJQUFJLFNBQVMsS0FBSyw4QkFBOEI7QUFBQSxFQUN4RDtBQUVBLFFBQU0sRUFBRSxPQUFPLE1BQU0sS0FBSyxRQUFRLElBQUk7QUFFdEMsTUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLGdCQUFnQjtBQUN4QyxVQUFNLElBQUksU0FBUyxLQUFLLHNDQUFzQztBQUFBLEVBQ2hFO0FBRUEsTUFBSSxPQUFPLE1BQU0sT0FBTyxLQUFLLFdBQVcsRUFBRSxPQUFPLEVBQUUsVUFBVSxJQUFJLEVBQUUsQ0FBQztBQUdwRSxNQUFJLENBQUMsUUFBUSxPQUFPO0FBQ2xCLFdBQU8sTUFBTSxPQUFPLEtBQUssV0FBVyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQztBQUN4RCxRQUFJLE1BQU07QUFDUixVQUFJLEtBQUssWUFBWSxLQUFLLGFBQWEsS0FBSztBQUMxQyxjQUFNLElBQUk7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQ0EsYUFBTyxNQUFNLE9BQU8sS0FBSyxPQUFPO0FBQUEsUUFDOUIsT0FBTyxFQUFFLElBQUksS0FBSyxHQUFHO0FBQUEsUUFDckIsTUFBTSxFQUFFLFVBQVUsS0FBSyxlQUFlLEtBQUs7QUFBQSxNQUM3QyxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFHQSxNQUFJLENBQUMsTUFBTTtBQUNULFVBQU0sWUFBWSxNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsS0FBSztBQUN6QyxVQUFNLGVBQWUsUUFBUSxJQUFJLEtBQUssS0FBSztBQUMzQyxXQUFPLE1BQU0sT0FBTyxLQUFLLE9BQU87QUFBQSxNQUM5QixNQUFNO0FBQUEsUUFDSjtBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sVUFBVTtBQUFBLFFBQ1YsY0FBYztBQUFBLFFBQ2QsVUFBVTtBQUFBLFFBQ1YsZUFBZTtBQUFBLFFBQ2YsTUFBTTtBQUFBLFFBQ04sV0FBVyxXQUFXO0FBQUEsTUFDeEI7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBRUEsUUFBTSxTQUFTLE1BQU0sWUFBWSxJQUFLO0FBQ3RDLFFBQU0sZ0JBQWdCLGFBQWEsSUFBSztBQUV4QyxTQUFPLEVBQUUsR0FBRyxRQUFRLE1BQU0sY0FBYztBQUMxQztBQUdBLElBQU0sZ0JBQWdCO0FBRXRCLElBQU0sWUFBWSxPQUFPLFlBQStCO0FBQ3RELFFBQU0sRUFBRSxLQUFLLElBQUk7QUFFakIsUUFBTSxXQUFXLE1BQU0sT0FBTyxLQUFLLE9BQU87QUFBQSxJQUN4QyxPQUFPLEVBQUUsT0FBTyxRQUFRLEtBQUssWUFBWSxDQUFDLGlCQUFpQjtBQUFBO0FBQUEsSUFFM0QsUUFBUSxFQUFFLFFBQVEsVUFBVSxXQUFXLE1BQU07QUFBQSxJQUM3QyxRQUFRO0FBQUEsTUFDTixNQUFNLFFBQVEsS0FBSyxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxFQUFFLFlBQVksQ0FBQztBQUFBLE1BQzFELE9BQU8sUUFBUSxLQUFLLFlBQVksQ0FBQztBQUFBLE1BQ2pDLFVBQVUsTUFBTSxPQUFPLEtBQUssZUFBZSxPQUFPLGVBQU8sa0JBQWtCLENBQUM7QUFBQSxNQUM1RSxjQUFjO0FBQUEsTUFDZDtBQUFBLE1BQ0EsUUFBUTtBQUFBLE1BQ1IsZUFBZTtBQUFBLElBQ2pCO0FBQUEsSUFDQSxNQUFNLEVBQUUsVUFBVSxLQUFLO0FBQUEsRUFDekIsQ0FBQztBQUVELFNBQU8sRUFBRSxHQUFJLE1BQU0sWUFBWSxRQUFRLEdBQUksTUFBTSxTQUFTO0FBQzVEO0FBSUEsSUFBTSxlQUFlLE9BQU8sV0FBbUI7QUFDN0MsUUFBTSxPQUFPLGFBQWE7QUFBQSxJQUN4QixPQUFPLGFBQWEsV0FBVztBQUFBLE1BQzdCLE9BQU8sRUFBRSxRQUFRLFdBQVcsS0FBSztBQUFBLE1BQ2pDLE1BQU0sRUFBRSxXQUFXLG9CQUFJLEtBQUssRUFBRTtBQUFBLElBQ2hDLENBQUM7QUFBQSxJQUNELE9BQU8sS0FBSyxPQUFPO0FBQUEsTUFDakIsT0FBTyxFQUFFLElBQUksT0FBTztBQUFBLE1BQ3BCLE1BQU0sRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFFLEVBQUU7QUFBQSxJQUN6QyxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBQ0g7QUFHQSxJQUFNLGVBQWUsT0FBTyxZQUFrQztBQUM1RCxRQUFNLEVBQUUsY0FBYyxxQkFBcUIsSUFBSTtBQUUvQyxRQUFNLFdBQVcsU0FBUztBQUFBLElBQ3hCO0FBQUEsSUFDQSxlQUFPO0FBQUEsRUFDVDtBQUVBLE1BQUksQ0FBQyxTQUFTLFNBQVM7QUFDckIsVUFBTSxJQUFJLFNBQVMsS0FBSyxTQUFTLEtBQUs7QUFBQSxFQUN4QztBQUVBLFFBQU0sRUFBRSxJQUFJLGNBQWMsa0JBQWtCLElBQzFDLFNBQVM7QUFFWCxRQUFNLE9BQU8sTUFBTSxPQUFPLEtBQUssV0FBVyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUUzRCxNQUFJLENBQUMsUUFBUSxLQUFLLFdBQVc7QUFDM0IsVUFBTSxJQUFJLFNBQVMsS0FBSywwQkFBMEI7QUFBQSxFQUNwRDtBQUNBLE1BQUksS0FBSyxXQUFXLGFBQWE7QUFDL0IsVUFBTSxJQUFJLFNBQVMsS0FBSyxzQkFBc0I7QUFBQSxFQUNoRDtBQUdBLE1BQUksS0FBSyxpQkFBaUIsbUJBQW1CO0FBQzNDLFVBQU0sSUFBSSxTQUFTLEtBQUssK0NBQStDO0FBQUEsRUFDekU7QUFJQSxRQUFNLFVBQVUsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxLQUFLLEtBQUssR0FBSTtBQUM3RCxRQUFNLE9BQU8sYUFBYSxXQUFXO0FBQUEsSUFDbkMsT0FBTztBQUFBLE1BQ0wsSUFBSSxDQUFDLEVBQUUsV0FBVyxFQUFFLElBQUksb0JBQUksS0FBSyxFQUFFLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxLQUFLLFFBQVEsRUFBRSxDQUFDO0FBQUEsSUFDekU7QUFBQSxFQUNGLENBQUM7QUFHRCxRQUFNLE1BQU0sTUFBTSxPQUFPLGFBQWEsV0FBVztBQUFBLElBQy9DLE9BQU8sRUFBRSxNQUFNLE9BQU8sb0JBQW9CLEVBQUU7QUFBQSxFQUM5QyxDQUFDO0FBR0QsTUFBSSxDQUFDLEtBQUs7QUFDUixVQUFNLElBQUksU0FBUyxLQUFLLDRDQUE0QztBQUFBLEVBQ3RFO0FBR0EsTUFBSSxJQUFJLFdBQVc7QUFDakIsVUFBTSxhQUFhLEtBQUssRUFBRTtBQUMxQixVQUFNLElBQUksU0FBUyxLQUFLLG1EQUFtRDtBQUFBLEVBQzdFO0FBR0EsTUFBSSxJQUFJLFVBQVUsUUFBUSxLQUFLLEtBQUssSUFBSSxHQUFHO0FBQ3pDLFVBQU0sSUFBSSxTQUFTLEtBQUssZ0RBQWdEO0FBQUEsRUFDMUU7QUFPQSxRQUFNLFVBQVUsTUFBTSxPQUFPLGFBQWEsT0FBTyxPQUFPO0FBQ3RELFVBQU0sVUFBVSxNQUFNLEdBQUcsYUFBYSxXQUFXO0FBQUEsTUFDL0MsT0FBTyxFQUFFLElBQUksSUFBSSxJQUFJLFdBQVcsS0FBSztBQUFBLE1BQ3JDLE1BQU0sRUFBRSxXQUFXLG9CQUFJLEtBQUssRUFBRTtBQUFBLElBQ2hDLENBQUM7QUFFRCxRQUFJLFFBQVEsVUFBVSxHQUFHO0FBQ3ZCLGFBQU87QUFBQSxJQUNUO0FBRUEsVUFBTSxTQUFTLE1BQU0sWUFBWSxNQUFNLEVBQUU7QUFDekMsV0FBTyxFQUFFLE9BQU87QUFBQSxFQUNsQixDQUFDO0FBRUQsTUFBSSxZQUFZLFFBQVE7QUFDdEIsVUFBTSxhQUFhLEtBQUssRUFBRTtBQUMxQixVQUFNLElBQUksU0FBUyxLQUFLLG1EQUFtRDtBQUFBLEVBQzdFO0FBRUEsU0FBTyxRQUFRO0FBQ2pCO0FBR0EsSUFBTSxTQUFTLE9BQU8sV0FBbUI7QUFFdkMsUUFBTSxhQUFhLE1BQU07QUFDM0I7QUFHQSxJQUFNLGNBQWMsT0FBTyxXQUFtQjtBQUM1QyxRQUFNLE9BQU8sTUFBTSxPQUFPLEtBQUssV0FBVztBQUFBLElBQ3hDLE9BQU8sRUFBRSxJQUFJLE9BQU87QUFBQSxJQUNwQixNQUFNLEVBQUUsVUFBVSxLQUFLO0FBQUEsRUFDekIsQ0FBQztBQUVELE1BQUksQ0FBQyxRQUFRLEtBQUssV0FBVztBQUMzQixVQUFNLElBQUksU0FBUyxLQUFLLGdCQUFnQjtBQUFBLEVBQzFDO0FBRUEsU0FBTztBQUNUO0FBRU8sSUFBTSxjQUFjO0FBQUEsRUFDekI7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0Y7OztBT3huQk8sSUFBTSxhQUFhLENBQUMsT0FBdUI7QUFDaEQsU0FBTyxPQUFPLEtBQWMsS0FBZSxTQUF1QjtBQUNoRSxRQUFJO0FBQ0YsWUFBTSxHQUFHLEtBQUssS0FBSyxJQUFJO0FBQUEsSUFDekIsU0FBUyxPQUFPO0FBQ2QsV0FBSyxLQUFLO0FBQUEsSUFDWjtBQUFBLEVBQ0Y7QUFDRjs7O0FDT08sSUFBTSxlQUFlLENBQUksS0FBZSxTQUEyQjtBQUN4RSxNQUFJLE9BQU8sS0FBSyxVQUFVLEVBQUUsS0FBSztBQUFBLElBQy9CLFNBQVMsS0FBSztBQUFBLElBQ2QsU0FBUyxLQUFLO0FBQUEsSUFDZCxNQUFNLEtBQUs7QUFBQSxJQUNYLE1BQU0sS0FBSztBQUFBLEVBQ2IsQ0FBQztBQUNIOzs7QVRsQkEsSUFBTSxlQUFlLFFBQVEsSUFBSSxhQUFhO0FBSTlDLElBQU0sZ0JBSUY7QUFBQSxFQUNGLFVBQVU7QUFBQSxFQUNWLFFBQVE7QUFBQSxFQUNSLFVBQVUsZUFBZSxTQUFTO0FBQ3BDO0FBRUEsSUFBTSx3QkFBd0IsS0FBSyxLQUFLLEtBQUs7QUFDN0MsSUFBTSx5QkFBeUIsS0FBSyxLQUFLLEtBQUssS0FBSztBQUVuRCxJQUFNLGlCQUFpQixDQUNyQixLQUNBLEVBQUUsYUFBYSxjQUFBRSxjQUFhLE1BQ3pCO0FBQ0gsTUFBSSxPQUFPLGVBQWUsYUFBYTtBQUFBLElBQ3JDLEdBQUc7QUFBQSxJQUNILFFBQVE7QUFBQSxFQUNWLENBQUM7QUFDRCxNQUFJLE9BQU8sZ0JBQWdCQSxlQUFjO0FBQUEsSUFDdkMsR0FBRztBQUFBLElBQ0gsUUFBUTtBQUFBLEVBQ1YsQ0FBQztBQUNIO0FBRUEsSUFBTSxtQkFBbUIsQ0FBQyxRQUFrQjtBQUMxQyxNQUFJLFlBQVksZUFBZSxhQUFhO0FBQzVDLE1BQUksWUFBWSxnQkFBZ0IsYUFBYTtBQUMvQztBQUlBLElBQU1DLGdCQUFlO0FBQUEsRUFDbkIsT0FBTyxLQUFjLEtBQWUsU0FBdUI7QUFDekQsVUFBTSxZQUFZLGFBQWEsSUFBSSxJQUFJO0FBRXZDLGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZQyxZQUFXO0FBQUEsTUFDdkIsU0FBUztBQUFBLE1BQ1QsTUFBTTtBQUFBLElBQ1IsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUdBLElBQU1DLGFBQVk7QUFBQSxFQUNoQixPQUFPLEtBQWMsS0FBZSxTQUF1QjtBQUN6RCxVQUFNLEVBQUUsYUFBYSxjQUFBSCxjQUFhLElBQUksTUFBTSxZQUFZLFVBQVUsSUFBSSxJQUFJO0FBRTFFLG1CQUFlLEtBQUssRUFBRSxhQUFhLGNBQUFBLGNBQWEsQ0FBQztBQUVqRCxpQkFBYSxLQUFLO0FBQUEsTUFDaEIsU0FBUztBQUFBLE1BQ1QsWUFBWUUsWUFBVztBQUFBLE1BQ3ZCLFNBQVM7QUFBQSxNQUNULE1BQU0sRUFBRSxhQUFhLGNBQUFGLGNBQWE7QUFBQSxJQUNwQyxDQUFDO0FBQUEsRUFDSDtBQUNGO0FBR0EsSUFBTUksZUFBYztBQUFBLEVBQ2xCLE9BQU8sS0FBYyxLQUFlLFNBQXVCO0FBQ3pELFVBQU0sRUFBRSxhQUFhLGNBQUFKLGVBQWMsS0FBSyxJQUFJLE1BQU0sWUFBWTtBQUFBLE1BQzVELElBQUk7QUFBQSxJQUNOO0FBRUEsbUJBQWUsS0FBSyxFQUFFLGFBQWEsY0FBQUEsY0FBYSxDQUFDO0FBRWpELGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZRSxZQUFXO0FBQUEsTUFDdkIsU0FBUztBQUFBLE1BQ1QsTUFBTSxFQUFFLGFBQWEsY0FBQUYsZUFBYyxLQUFLO0FBQUEsSUFDMUMsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUdBLElBQU1LLGFBQVk7QUFBQSxFQUNoQixPQUFPLEtBQWMsS0FBZSxTQUF1QjtBQUN6RCxVQUFNLEVBQUUsYUFBYSxjQUFBTCxlQUFjLEtBQUssSUFBSSxNQUFNLFlBQVk7QUFBQSxNQUM1RCxJQUFJO0FBQUEsSUFDTjtBQUVBLG1CQUFlLEtBQUssRUFBRSxhQUFhLGNBQUFBLGNBQWEsQ0FBQztBQUVqRCxpQkFBYSxLQUFLO0FBQUEsTUFDaEIsU0FBUztBQUFBLE1BQ1QsWUFBWUUsWUFBVztBQUFBLE1BQ3ZCLFNBQVM7QUFBQSxNQUNULE1BQU0sRUFBRSxhQUFhLGNBQUFGLGVBQWMsS0FBSztBQUFBLElBQzFDLENBQUM7QUFBQSxFQUNIO0FBQ0Y7QUFJQSxJQUFNTSxlQUFjO0FBQUEsRUFDbEIsT0FBTyxLQUFjLEtBQWUsU0FBdUI7QUFDekQsVUFBTSxFQUFFLGFBQWEsY0FBQU4sZUFBYyxLQUFLLElBQUksTUFBTSxZQUFZO0FBQUEsTUFDNUQsSUFBSTtBQUFBLElBQ047QUFFQSxtQkFBZSxLQUFLLEVBQUUsYUFBYSxjQUFBQSxjQUFhLENBQUM7QUFFakQsaUJBQWEsS0FBSztBQUFBLE1BQ2hCLFNBQVM7QUFBQSxNQUNULFlBQVlFLFlBQVc7QUFBQSxNQUN2QixTQUFTO0FBQUEsTUFDVCxNQUFNLEVBQUUsYUFBYSxjQUFBRixlQUFjLEtBQUs7QUFBQSxJQUMxQyxDQUFDO0FBQUEsRUFDSDtBQUNGO0FBR0EsSUFBTU8sc0JBQXFCO0FBQUEsRUFDekIsT0FBTyxLQUFjLEtBQWUsU0FBdUI7QUFDekQsVUFBTSxZQUFZLG1CQUFtQixJQUFJLElBQUk7QUFFN0MsaUJBQWEsS0FBSztBQUFBLE1BQ2hCLFNBQVM7QUFBQSxNQUNULFlBQVlMLFlBQVc7QUFBQSxNQUN2QixTQUFTO0FBQUEsTUFDVCxNQUFNO0FBQUEsSUFDUixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBR0EsSUFBTU0sa0JBQWlCO0FBQUEsRUFDckIsT0FBTyxLQUFjLEtBQWUsU0FBdUI7QUFDekQsVUFBTSxZQUFZLGVBQWUsSUFBSSxJQUFJO0FBRXpDLGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZTixZQUFXO0FBQUEsTUFDdkIsU0FDRTtBQUFBLE1BQ0YsTUFBTTtBQUFBLElBQ1IsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUdBLElBQU1PLGlCQUFnQjtBQUFBLEVBQ3BCLE9BQU8sS0FBYyxLQUFlLFNBQXVCO0FBQ3pELFVBQU0sWUFBWSxjQUFjLElBQUksSUFBSTtBQUV4QyxpQkFBYSxLQUFLO0FBQUEsTUFDaEIsU0FBUztBQUFBLE1BQ1QsWUFBWVAsWUFBVztBQUFBLE1BQ3ZCLFNBQVM7QUFBQSxNQUNULE1BQU07QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNIO0FBQ0Y7QUFHQSxJQUFNRixnQkFBZTtBQUFBLEVBQ25CLE9BQU8sS0FBYyxLQUFlLFNBQXVCO0FBQ3pELFVBQU0seUJBQXlCLElBQUksUUFBUTtBQUMzQyxVQUFNLHVCQUF1QixJQUFJLE1BQU07QUFFdkMsUUFBSSxDQUFDLDBCQUEwQixDQUFDLHNCQUFzQjtBQUNwRCxhQUFPLGFBQWEsS0FBSztBQUFBLFFBQ3ZCLFNBQVM7QUFBQSxRQUNULFlBQVlFLFlBQVc7QUFBQSxRQUN2QixTQUFTO0FBQUEsUUFDVCxNQUFNO0FBQUEsTUFDUixDQUFDO0FBQUEsSUFDSDtBQUVBLFVBQU0sRUFBRSxhQUFhLGNBQWMsZ0JBQWdCLElBQ2pELE1BQU0sWUFBWSxhQUFhO0FBQUEsTUFDN0IsY0FBYywwQkFBMEI7QUFBQSxJQUMxQyxDQUFDO0FBRUgsbUJBQWUsS0FBSztBQUFBLE1BQ2xCO0FBQUEsTUFDQSxjQUFjO0FBQUEsSUFDaEIsQ0FBQztBQUVELGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZQSxZQUFXO0FBQUEsTUFDdkIsU0FBUztBQUFBLE1BQ1QsTUFBTSxFQUFFLGFBQWEsY0FBYyxnQkFBZ0I7QUFBQSxJQUNyRCxDQUFDO0FBQUEsRUFDSDtBQUNGO0FBR0EsSUFBTSxhQUFhO0FBQUEsRUFDakIsT0FBTyxLQUFjLEtBQWUsU0FBdUI7QUFDekQsVUFBTSxTQUFTLElBQUksTUFBTTtBQUV6QixVQUFNLFlBQVksT0FBTyxNQUFNO0FBQy9CLHFCQUFpQixHQUFHO0FBRXBCLGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZQSxZQUFXO0FBQUEsTUFDdkIsU0FBUztBQUFBLE1BQ1QsTUFBTTtBQUFBLElBQ1IsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUdBLElBQU0sUUFBUTtBQUFBLEVBQ1osT0FBTyxLQUFjLEtBQWUsU0FBdUI7QUFDekQsVUFBTSxTQUFTLElBQUksTUFBTTtBQUV6QixVQUFNLE9BQU8sTUFBTSxZQUFZLFlBQVksTUFBTTtBQUVqRCxpQkFBYSxLQUFLO0FBQUEsTUFDaEIsU0FBUztBQUFBLE1BQ1QsWUFBWUEsWUFBVztBQUFBLE1BQ3ZCLFNBQVM7QUFBQSxNQUNULE1BQU07QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNIO0FBQ0Y7QUFFTyxJQUFNLGlCQUFpQjtBQUFBLEVBQzVCLGNBQUFEO0FBQUEsRUFDQSxhQUFBSztBQUFBLEVBQ0Esb0JBQUFDO0FBQUEsRUFDQSxnQkFBQUM7QUFBQSxFQUNBLGVBQUFDO0FBQUEsRUFDQSxXQUFBTjtBQUFBLEVBQ0EsYUFBQUM7QUFBQSxFQUNBLFdBQUFDO0FBQUEsRUFDQSxjQUFBTDtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0Y7OztBVTFQQSxTQUFTLEtBQUFVLFVBQVM7QUFHbEIsSUFBTSxpQkFBaUJDLEdBQUUsT0FBTztBQUFBLEVBQzlCLE1BQU1BLEdBQ0gsT0FBTyxFQUFFLGdCQUFnQixtQkFBbUIsQ0FBQyxFQUM3QyxLQUFLLEVBQ0wsSUFBSSxHQUFHLG9DQUFvQyxFQUMzQyxJQUFJLEtBQUsscUNBQXFDO0FBQUEsRUFDakQsT0FBT0EsR0FDSixPQUFPLEVBQUUsZ0JBQWdCLG9CQUFvQixDQUFDLEVBQzlDLEtBQUssRUFDTCxNQUFNLDhCQUE4QjtBQUFBLEVBQ3ZDLFVBQVVBLEdBQ1AsT0FBTyxFQUFFLGdCQUFnQix1QkFBdUIsQ0FBQyxFQUNqRCxJQUFJLEdBQUcsd0NBQXdDLEVBQy9DLElBQUksSUFBSSx3Q0FBd0M7QUFBQSxFQUNuRCxPQUFPQSxHQUNKLE9BQU8sRUFDUCxJQUFJLElBQUksMEJBQTBCLEVBQ2xDLFNBQVM7QUFBQSxFQUNaLE1BQU1BLEdBQUUsV0FBVyxJQUFJLEVBQUUsU0FBUztBQUNwQyxDQUFDO0FBRUQsSUFBTSxjQUFjQSxHQUFFLE9BQU87QUFBQSxFQUMzQixPQUFPQSxHQUNKLE9BQU8sRUFBRSxnQkFBZ0Isb0JBQW9CLENBQUMsRUFDOUMsS0FBSyxFQUNMLE1BQU0sOEJBQThCO0FBQUEsRUFDdkMsVUFBVUEsR0FBRSxPQUFPLEVBQUUsZ0JBQWdCLHVCQUF1QixDQUFDLEVBQUUsSUFBSSxDQUFDO0FBQ3RFLENBQUM7QUFFRCxJQUFNLG9CQUFvQkEsR0FBRSxPQUFPO0FBQUEsRUFDakMsU0FBU0EsR0FBRSxPQUFPLEVBQUUsZ0JBQWdCLDZCQUE2QixDQUFDLEVBQUUsSUFBSSxDQUFDO0FBQzNFLENBQUM7QUFFRCxJQUFNLGtCQUFrQkEsR0FBRSxPQUFPO0FBQUEsRUFDL0IsTUFBTUEsR0FBRSxXQUFXLE1BQU07QUFBQSxJQUN2QixnQkFBZ0I7QUFBQSxFQUNsQixDQUFDO0FBQ0gsQ0FBQztBQUlELElBQU0scUJBQXFCQSxHQUFFLE9BQU87QUFBQSxFQUNsQyxjQUFjQSxHQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsRUFBRSxTQUFTO0FBQzNDLENBQUM7QUFFRCxJQUFNLGNBQWNBLEdBQ2pCLE9BQU8sRUFBRSxnQkFBZ0Isb0JBQW9CLENBQUMsRUFDOUMsS0FBSyxFQUNMLE1BQU0sOEJBQThCO0FBRXZDLElBQU0sWUFBWUEsR0FDZixPQUFPLEVBQUUsZ0JBQWdCLGtCQUFrQixDQUFDLEVBQzVDLE9BQU8sR0FBRyw4QkFBOEIsRUFDeEMsTUFBTSxXQUFXLDhCQUE4QjtBQUVsRCxJQUFNLG9CQUFvQkEsR0FBRSxPQUFPO0FBQUEsRUFDakMsT0FBTztBQUFBLEVBQ1AsS0FBSztBQUNQLENBQUM7QUFFRCxJQUFNLDJCQUEyQkEsR0FBRSxPQUFPO0FBQUEsRUFDeEMsT0FBTztBQUNULENBQUM7QUFFRCxJQUFNLHVCQUF1QkEsR0FBRSxPQUFPO0FBQUEsRUFDcEMsT0FBTztBQUNULENBQUM7QUFFRCxJQUFNLHNCQUFzQkEsR0FBRSxPQUFPO0FBQUEsRUFDbkMsT0FBTztBQUFBLEVBQ1AsS0FBSztBQUFBLEVBQ0wsYUFBYUEsR0FDVixPQUFPLEVBQUUsZ0JBQWdCLDJCQUEyQixDQUFDLEVBQ3JELElBQUksR0FBRyx3Q0FBd0MsRUFDL0MsSUFBSSxJQUFJLHdDQUF3QztBQUNyRCxDQUFDO0FBU00sSUFBTSxrQkFBa0I7QUFBQSxFQUM3QjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0Y7OztBQ2pGQSxJQUFNLGtCQUFrQixDQUFDLFdBQTZCO0FBQ3BELFNBQU8sQ0FBQyxLQUFjLEtBQWUsU0FBdUI7QUFDMUQsUUFBSSxPQUFPLE1BQU07QUFDZixVQUFJLE9BQU8sT0FBTyxLQUFLLE1BQU0sSUFBSSxJQUFJO0FBQUEsSUFDdkM7QUFDQSxRQUFJLE9BQU8sT0FBTztBQUNoQixZQUFNLGNBQWMsT0FBTyxNQUFNLE1BQU0sSUFBSSxLQUFLO0FBQ2hELGFBQU8sZUFBZSxLQUFLLFNBQVM7QUFBQSxRQUNsQyxPQUFPO0FBQUEsUUFDUCxVQUFVO0FBQUEsUUFDVixjQUFjO0FBQUEsUUFDZCxZQUFZO0FBQUEsTUFDZCxDQUFDO0FBQUEsSUFDSDtBQUNBLFFBQUksT0FBTyxRQUFRO0FBQ2pCLFlBQU0sZUFBZSxPQUFPLE9BQU8sTUFBTSxJQUFJLE1BQU07QUFDbkQsYUFBTyxlQUFlLEtBQUssVUFBVTtBQUFBLFFBQ25DLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQSxRQUNWLGNBQWM7QUFBQSxRQUNkLFlBQVk7QUFBQSxNQUNkLENBQUM7QUFBQSxJQUNIO0FBRUEsU0FBSztBQUFBLEVBQ1A7QUFDRjtBQUVBLElBQU8sMEJBQVE7OztBQ2pDZixJQUFNLE9BQU8sSUFBSSxrQkFBMEI7QUFDekMsU0FBTyxXQUFXLE9BQU8sS0FBYyxLQUFlLFNBQXVCO0FBQzNFLFVBQU0sUUFBUSxJQUFJLFFBQVEsY0FDdEIsSUFBSSxRQUFRLGNBQ1osSUFBSSxRQUFRLGVBQWUsV0FBVyxTQUFTLElBQzdDLElBQUksUUFBUSxjQUFjLE1BQU0sR0FBRyxFQUFFLENBQUMsSUFDdEMsSUFBSSxRQUFRO0FBR2xCLFFBQUksQ0FBQyxPQUFPO0FBQ1YsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUdBLFVBQU0sZ0JBQWdCLFNBQVM7QUFBQSxNQUM3QjtBQUFBLE1BQ0EsZUFBTztBQUFBLElBQ1Q7QUFFQSxRQUFJLENBQUMsY0FBYyxTQUFTO0FBQzFCLFlBQU0sSUFBSSxTQUFTLEtBQUssY0FBYyxLQUFLO0FBQUEsSUFDN0M7QUFFQSxVQUFNLEVBQUUsSUFBSSxhQUFhLElBQUksY0FBYztBQUszQyxVQUFNLE9BQU8sTUFBTSxPQUFPLEtBQUssV0FBVztBQUFBLE1BQ3hDLE9BQU8sRUFBRSxHQUFHO0FBQUEsSUFDZCxDQUFDO0FBRUQsUUFBSSxDQUFDLFFBQVEsS0FBSyxXQUFXO0FBQzNCLFlBQU0sSUFBSSxTQUFTLEtBQUssaUJBQWlCO0FBQUEsSUFDM0M7QUFFQSxRQUFJLEtBQUssV0FBVyxhQUFhO0FBQy9CLFlBQU0sSUFBSTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFHQSxRQUFJLEtBQUssaUJBQWlCLGNBQWM7QUFDdEMsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUdBLFFBQUksY0FBYyxVQUFVLENBQUMsY0FBYyxTQUFTLEtBQUssSUFBSSxHQUFHO0FBQzlELFlBQU0sSUFBSTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFHQSxRQUFJLE9BQU87QUFBQSxNQUNULElBQUksS0FBSztBQUFBLE1BQ1QsTUFBTSxLQUFLO0FBQUEsTUFDWCxPQUFPLEtBQUs7QUFBQSxNQUNaLE1BQU0sS0FBSztBQUFBLElBQ2I7QUFFQSxTQUFLO0FBQUEsRUFDUCxDQUFDO0FBQ0g7QUFFQSxJQUFPLGVBQVE7OztBYi9FZixJQUFNLFNBQVMsT0FBTztBQUd0QixPQUFPO0FBQUEsRUFDTDtBQUFBLEVBQ0Esd0JBQWdCLEVBQUUsTUFBTSxnQkFBZ0IsZUFBZSxDQUFDO0FBQUEsRUFDeEQsZUFBZTtBQUNqQjtBQUVBLE9BQU87QUFBQSxFQUNMO0FBQUEsRUFDQSx3QkFBZ0IsRUFBRSxNQUFNLGdCQUFnQixZQUFZLENBQUM7QUFBQSxFQUNyRCxlQUFlO0FBQ2pCO0FBRUEsT0FBTztBQUFBLEVBQ0w7QUFBQSxFQUNBLHdCQUFnQixFQUFFLE1BQU0sZ0JBQWdCLGtCQUFrQixDQUFDO0FBQUEsRUFDM0QsZUFBZTtBQUNqQjtBQUVBLE9BQU87QUFBQSxFQUNMO0FBQUEsRUFDQSx3QkFBZ0IsRUFBRSxNQUFNLGdCQUFnQixnQkFBZ0IsQ0FBQztBQUFBLEVBQ3pELGVBQWU7QUFDakI7QUFFQSxPQUFPO0FBQUEsRUFDTDtBQUFBLEVBQ0Esd0JBQWdCLEVBQUUsTUFBTSxnQkFBZ0IsbUJBQW1CLENBQUM7QUFBQSxFQUM1RCxlQUFlO0FBQ2pCO0FBRUEsT0FBTyxLQUFLLFdBQVcsYUFBSyxHQUFHLGVBQWUsVUFBVTtBQUV4RCxPQUFPLElBQUksT0FBTyxhQUFLLEdBQUcsZUFBZSxLQUFLO0FBSTlDLE9BQU87QUFBQSxFQUNMO0FBQUEsRUFDQSx3QkFBZ0IsRUFBRSxNQUFNLGdCQUFnQixrQkFBa0IsQ0FBQztBQUFBLEVBQzNELGVBQWU7QUFDakI7QUFFQSxPQUFPO0FBQUEsRUFDTDtBQUFBLEVBQ0Esd0JBQWdCLEVBQUUsTUFBTSxnQkFBZ0IseUJBQXlCLENBQUM7QUFBQSxFQUNsRSxlQUFlO0FBQ2pCO0FBRUEsT0FBTztBQUFBLEVBQ0w7QUFBQSxFQUNBLHdCQUFnQixFQUFFLE1BQU0sZ0JBQWdCLHFCQUFxQixDQUFDO0FBQUEsRUFDOUQsZUFBZTtBQUNqQjtBQUVBLE9BQU87QUFBQSxFQUNMO0FBQUEsRUFDQSx3QkFBZ0IsRUFBRSxNQUFNLGdCQUFnQixvQkFBb0IsQ0FBQztBQUFBLEVBQzdELGVBQWU7QUFDakI7QUFFTyxJQUFNLGFBQWE7OztBY3JFMUIsU0FBUyxVQUFBQyxlQUFjOzs7QUNDdkIsT0FBT0MsaUJBQWdCOzs7QUNEdkIsT0FBT0MsYUFBWTtBQWFuQixJQUFNLHFCQUFxQixPQUFPLE9BQWU7QUFDL0MsUUFBTSxPQUFPLE1BQU0sT0FBTyxLQUFLLFdBQVcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFFM0QsTUFBSSxDQUFDLFFBQVEsS0FBSyxXQUFXO0FBQzNCLFVBQU0sSUFBSSxTQUFTLEtBQUssZ0JBQWdCO0FBQUEsRUFDMUM7QUFDQSxNQUFJLEtBQUssV0FBVyxhQUFhO0FBQy9CLFVBQU0sSUFBSSxTQUFTLEtBQUssb0RBQW9EO0FBQUEsRUFDOUU7QUFFQSxTQUFPO0FBQ1Q7QUFHQSxJQUFNLGdCQUFnQixPQUFPLFFBQWdCLFlBQTRCO0FBQ3ZFLFFBQU0sRUFBRSxNQUFNLE9BQU8sV0FBVyxpQkFBaUIsWUFBWSxJQUFJO0FBRWpFLFFBQU0sT0FBTyxNQUFNLE9BQU8sS0FBSyxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsSUFBSSxPQUFPLEVBQUUsQ0FBQztBQUUxRSxNQUFJLEtBQUssV0FBVztBQUNsQixVQUFNLElBQUksU0FBUyxLQUFLLDBCQUEwQjtBQUFBLEVBQ3BEO0FBQ0EsTUFBSSxLQUFLLGlCQUFpQixVQUFVO0FBQ2xDLFVBQU0sSUFBSTtBQUFBLE1BQ1I7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFQSxRQUFNLE9BQStCLENBQUM7QUFFdEMsTUFBSSxLQUFNLE1BQUssT0FBTztBQUN0QixNQUFJLE1BQU8sTUFBSyxRQUFRO0FBQ3hCLE1BQUksVUFBVyxNQUFLLFlBQVk7QUFHaEMsTUFBSSxhQUFhO0FBQ2YsUUFBSSxDQUFDLGlCQUFpQjtBQUNwQixZQUFNLElBQUksU0FBUyxLQUFLLDhCQUE4QjtBQUFBLElBQ3hEO0FBQ0EsUUFBSSxvQkFBb0IsYUFBYTtBQUNuQyxZQUFNLElBQUksU0FBUyxLQUFLLGdDQUFnQztBQUFBLElBQzFEO0FBRUEsVUFBTSxVQUFVLE1BQU1DLFFBQU8sUUFBUSxpQkFBaUIsS0FBSyxZQUFZLEVBQUU7QUFDekUsUUFBSSxDQUFDLFNBQVM7QUFDWixZQUFNLElBQUksU0FBUyxLQUFLLDBCQUEwQjtBQUFBLElBQ3BEO0FBRUEsU0FBSyxXQUFXLE1BQU1BLFFBQU87QUFBQSxNQUMzQjtBQUFBLE1BQ0EsT0FBTyxlQUFPLGtCQUFrQjtBQUFBLElBQ2xDO0FBQ0EsU0FBSyxlQUFlLEVBQUUsV0FBVyxFQUFFO0FBQUEsRUFDckM7QUFFQSxRQUFNLGNBQWMsTUFBTSxPQUFPLEtBQUssT0FBTztBQUFBLElBQzNDLE9BQU8sRUFBRSxJQUFJLE9BQU87QUFBQSxJQUNwQjtBQUFBLElBQ0EsTUFBTSxFQUFFLFVBQVUsS0FBSztBQUFBLEVBQ3pCLENBQUM7QUFFRCxTQUFPO0FBQ1Q7QUFHQSxJQUFNLFdBQVcsT0FBTyxVQUFzQjtBQUM1QyxRQUFNLE9BQU8sTUFBTSxRQUFRO0FBQzNCLFFBQU0sUUFBUSxNQUFNLFNBQVM7QUFFN0IsUUFBTSxRQUErQjtBQUFBLElBQ25DLFdBQVc7QUFBQSxFQUNiO0FBRUEsTUFBSSxNQUFNLFFBQVE7QUFDaEIsVUFBTSxLQUFLO0FBQUEsTUFDVCxFQUFFLE1BQU0sRUFBRSxVQUFVLE1BQU0sUUFBUSxNQUFNLGNBQWMsRUFBRTtBQUFBLE1BQ3hELEVBQUUsT0FBTyxFQUFFLFVBQVUsTUFBTSxRQUFRLE1BQU0sY0FBYyxFQUFFO0FBQUEsSUFDM0Q7QUFBQSxFQUNGO0FBQ0EsTUFBSSxNQUFNLEtBQU0sT0FBTSxPQUFPLE1BQU07QUFDbkMsTUFBSSxNQUFNLE9BQVEsT0FBTSxTQUFTLE1BQU07QUFFdkMsUUFBTSxDQUFDLE9BQU8sS0FBSyxJQUFJLE1BQU0sUUFBUSxJQUFJO0FBQUEsSUFDdkMsT0FBTyxLQUFLLFNBQVM7QUFBQSxNQUNuQjtBQUFBLE1BQ0EsT0FBTyxPQUFPLEtBQUs7QUFBQSxNQUNuQixNQUFNO0FBQUEsTUFDTixTQUFTLEVBQUUsV0FBVyxPQUFPO0FBQUEsTUFDN0IsTUFBTSxFQUFFLFVBQVUsS0FBSztBQUFBLElBQ3pCLENBQUM7QUFBQSxJQUNELE9BQU8sS0FBSyxNQUFNLEVBQUUsTUFBTSxDQUFDO0FBQUEsRUFDN0IsQ0FBQztBQUVELFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLFlBQVksS0FBSyxLQUFLLFFBQVEsS0FBSztBQUFBLElBQ3JDO0FBQUEsRUFDRjtBQUNGO0FBR0EsSUFBTSxhQUFhLE9BQU8sSUFBWSxZQUF5QjtBQUM3RCxRQUFNLEVBQUUsS0FBSyxJQUFJO0FBRWpCLFFBQU0sbUJBQW1CLEVBQUU7QUFFM0IsUUFBTSxjQUFjLE1BQU0sT0FBTyxLQUFLLE9BQU87QUFBQSxJQUMzQyxPQUFPLEVBQUUsR0FBRztBQUFBLElBQ1osTUFBTSxFQUFFLE1BQU0sY0FBYyxFQUFFLFdBQVcsRUFBRSxFQUFFO0FBQUEsSUFDN0MsTUFBTSxFQUFFLFVBQVUsS0FBSztBQUFBLEVBQ3pCLENBQUM7QUFFRCxTQUFPO0FBQ1Q7QUFHQSxJQUFNLGVBQWUsT0FBTyxJQUFZLFlBQTJCO0FBQ2pFLFFBQU0sRUFBRSxPQUFPLElBQUk7QUFFbkIsUUFBTSxPQUFPLE1BQU0sT0FBTyxLQUFLLFdBQVcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFDM0QsTUFBSSxDQUFDLFFBQVEsS0FBSyxXQUFXO0FBQzNCLFVBQU0sSUFBSSxTQUFTLEtBQUssZ0JBQWdCO0FBQUEsRUFDMUM7QUFFQSxRQUFNLGNBQWMsTUFBTSxPQUFPLEtBQUssT0FBTztBQUFBLElBQzNDLE9BQU8sRUFBRSxHQUFHO0FBQUEsSUFDWixNQUFNO0FBQUEsTUFDSjtBQUFBO0FBQUEsTUFFQSxHQUFJLFdBQVcsV0FBVyxhQUFhLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSxFQUFFO0FBQUEsSUFDMUU7QUFBQSxJQUNBLE1BQU0sRUFBRSxVQUFVLEtBQUs7QUFBQSxFQUN6QixDQUFDO0FBRUQsU0FBTztBQUNUO0FBR0EsSUFBTSxhQUFhLE9BQU8sT0FBZTtBQUN2QyxRQUFNLE9BQU8sTUFBTSxPQUFPLEtBQUssV0FBVyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUMzRCxNQUFJLENBQUMsUUFBUSxLQUFLLFdBQVc7QUFDM0IsVUFBTSxJQUFJLFNBQVMsS0FBSyxnQkFBZ0I7QUFBQSxFQUMxQztBQUVBLFFBQU0sY0FBYyxNQUFNLE9BQU8sS0FBSyxPQUFPO0FBQUEsSUFDM0MsT0FBTyxFQUFFLEdBQUc7QUFBQSxJQUNaLE1BQU0sRUFBRSxXQUFXLE1BQU0sY0FBYyxFQUFFLFdBQVcsRUFBRSxFQUFFO0FBQUEsSUFDeEQsTUFBTSxFQUFFLFVBQVUsS0FBSztBQUFBLEVBQ3pCLENBQUM7QUFFRCxTQUFPO0FBQ1Q7QUFFTyxJQUFNLGNBQWM7QUFBQSxFQUN6QjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjs7O0FEMUtBLElBQU1DLGlCQUFnQjtBQUFBLEVBQ3BCLE9BQU8sS0FBYyxLQUFlLFNBQXVCO0FBQ3pELFVBQU0sU0FBUyxJQUFJLE1BQU07QUFFekIsVUFBTSxPQUFPLE1BQU0sWUFBWSxjQUFjLFFBQVEsSUFBSSxJQUFJO0FBRTdELGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZQyxZQUFXO0FBQUEsTUFDdkIsU0FBUztBQUFBLE1BQ1QsTUFBTTtBQUFBLElBQ1IsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUdBLElBQU1DLFlBQVc7QUFBQSxFQUNmLE9BQU8sS0FBYyxLQUFlLFNBQXVCO0FBQ3pELFVBQU0sU0FBUyxNQUFNLFlBQVksU0FBUyxJQUFJLEtBQUs7QUFFbkQsaUJBQWEsS0FBSztBQUFBLE1BQ2hCLFNBQVM7QUFBQSxNQUNULFlBQVlELFlBQVc7QUFBQSxNQUN2QixTQUFTO0FBQUEsTUFDVCxNQUFNLE9BQU87QUFBQSxNQUNiLE1BQU0sT0FBTztBQUFBLElBQ2YsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUdBLElBQU1FLGNBQWE7QUFBQSxFQUNqQixPQUFPLEtBQWMsS0FBZSxTQUF1QjtBQUN6RCxVQUFNLEtBQUssT0FBTyxJQUFJLE9BQU8sRUFBRTtBQUcvQixRQUFJLE9BQU8sSUFBSSxNQUFNLElBQUk7QUFDdkIsYUFBTyxhQUFhLEtBQUs7QUFBQSxRQUN2QixTQUFTO0FBQUEsUUFDVCxZQUFZRixZQUFXO0FBQUEsUUFDdkIsU0FBUztBQUFBLFFBQ1QsTUFBTTtBQUFBLE1BQ1IsQ0FBQztBQUFBLElBQ0g7QUFFQSxVQUFNLE9BQU8sTUFBTSxZQUFZLFdBQVcsSUFBSSxJQUFJLElBQUk7QUFFdEQsaUJBQWEsS0FBSztBQUFBLE1BQ2hCLFNBQVM7QUFBQSxNQUNULFlBQVlBLFlBQVc7QUFBQSxNQUN2QixTQUFTO0FBQUEsTUFDVCxNQUFNO0FBQUEsSUFDUixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBR0EsSUFBTUcsZ0JBQWU7QUFBQSxFQUNuQixPQUFPLEtBQWMsS0FBZSxTQUF1QjtBQUN6RCxVQUFNLEtBQUssT0FBTyxJQUFJLE9BQU8sRUFBRTtBQUcvQixRQUFJLE9BQU8sSUFBSSxNQUFNLElBQUk7QUFDdkIsYUFBTyxhQUFhLEtBQUs7QUFBQSxRQUN2QixTQUFTO0FBQUEsUUFDVCxZQUFZSCxZQUFXO0FBQUEsUUFDdkIsU0FBUztBQUFBLFFBQ1QsTUFBTTtBQUFBLE1BQ1IsQ0FBQztBQUFBLElBQ0g7QUFFQSxVQUFNLE9BQU8sTUFBTSxZQUFZLGFBQWEsSUFBSSxJQUFJLElBQUk7QUFFeEQsaUJBQWEsS0FBSztBQUFBLE1BQ2hCLFNBQVM7QUFBQSxNQUNULFlBQVlBLFlBQVc7QUFBQSxNQUN2QixTQUFTO0FBQUEsTUFDVCxNQUFNO0FBQUEsSUFDUixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBR0EsSUFBTUksY0FBYTtBQUFBLEVBQ2pCLE9BQU8sS0FBYyxLQUFlLFNBQXVCO0FBQ3pELFVBQU0sS0FBSyxPQUFPLElBQUksT0FBTyxFQUFFO0FBRy9CLFFBQUksT0FBTyxJQUFJLE1BQU0sSUFBSTtBQUN2QixhQUFPLGFBQWEsS0FBSztBQUFBLFFBQ3ZCLFNBQVM7QUFBQSxRQUNULFlBQVlKLFlBQVc7QUFBQSxRQUN2QixTQUFTO0FBQUEsUUFDVCxNQUFNO0FBQUEsTUFDUixDQUFDO0FBQUEsSUFDSDtBQUVBLFVBQU0sT0FBTyxNQUFNLFlBQVksV0FBVyxFQUFFO0FBRTVDLGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZQSxZQUFXO0FBQUEsTUFDdkIsU0FBUztBQUFBLE1BQ1QsTUFBTTtBQUFBLElBQ1IsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUVPLElBQU0saUJBQWlCO0FBQUEsRUFDNUIsZUFBQUQ7QUFBQSxFQUNBLFVBQUFFO0FBQUEsRUFDQSxZQUFBQztBQUFBLEVBQ0EsY0FBQUM7QUFBQSxFQUNBLFlBQUFDO0FBQ0Y7OztBRXpIQSxTQUFTLEtBQUFDLFVBQVM7QUFHbEIsSUFBTSxzQkFBc0JDLEdBQ3pCLE9BQU87QUFBQSxFQUNOLE1BQU1BLEdBQ0gsT0FBTyxFQUNQLEtBQUssRUFDTCxJQUFJLEdBQUcsb0NBQW9DLEVBQzNDLElBQUksS0FBSyxxQ0FBcUMsRUFDOUMsU0FBUztBQUFBLEVBQ1osT0FBT0EsR0FDSixPQUFPLEVBQ1AsS0FBSyxFQUNMLElBQUksSUFBSSwwQkFBMEIsRUFDbEMsU0FBUztBQUFBLEVBQ1osV0FBV0EsR0FBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksa0NBQWtDLEVBQUUsU0FBUztBQUFBLEVBQzlFLGlCQUFpQkEsR0FBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLEVBQUUsU0FBUztBQUFBLEVBQzVDLGFBQWFBLEdBQ1YsT0FBTyxFQUNQLElBQUksR0FBRyx3Q0FBd0MsRUFDL0MsSUFBSSxJQUFJLHdDQUF3QyxFQUNoRCxTQUFTO0FBQ2QsQ0FBQyxFQUNBO0FBQUEsRUFDQyxDQUFDLFNBQ0MsS0FBSyxnQkFBZ0IsVUFDckIsS0FBSyxvQkFBb0I7QUFBQSxFQUMzQixFQUFFLFNBQVMsa0RBQWtEO0FBQy9EO0FBRUYsSUFBTSxrQkFBa0JBLEdBQUUsT0FBTztBQUFBLEVBQy9CLE1BQU1BLEdBQUUsT0FBTyxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUFBLEVBQzlDLE9BQU9BLEdBQUUsT0FBTyxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLFFBQVEsRUFBRTtBQUFBLEVBQ3hELFFBQVFBLEdBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxTQUFTO0FBQUEsRUFDbkMsTUFBTUEsR0FBRSxXQUFXLElBQUksRUFBRSxTQUFTO0FBQUEsRUFDbEMsUUFBUUEsR0FBRSxXQUFXLFVBQVUsRUFBRSxTQUFTO0FBQzVDLENBQUM7QUFFRCxJQUFNLG1CQUFtQkEsR0FBRSxPQUFPO0FBQUEsRUFDaEMsSUFBSUEsR0FBRSxPQUFPLEVBQUUsZ0JBQWdCLHNCQUFzQixDQUFDLEVBQUUsSUFBSSxDQUFDO0FBQy9ELENBQUM7QUFFRCxJQUFNLG1CQUFtQkEsR0FBRSxPQUFPO0FBQUEsRUFDaEMsTUFBTUEsR0FBRSxXQUFXLE1BQU0sRUFBRSxnQkFBZ0Isd0JBQXdCLENBQUM7QUFDdEUsQ0FBQztBQUVELElBQU0scUJBQXFCQSxHQUFFLE9BQU87QUFBQSxFQUNsQyxRQUFRQSxHQUFFLFdBQVcsWUFBWTtBQUFBLElBQy9CLGdCQUFnQjtBQUFBLEVBQ2xCLENBQUM7QUFDSCxDQUFDO0FBS00sSUFBTSxrQkFBa0I7QUFBQSxFQUM3QjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjs7O0FIdkRBLElBQU1DLFVBQVNDLFFBQU87QUFHdEJELFFBQU87QUFBQSxFQUNMO0FBQUEsRUFDQSxhQUFLO0FBQUEsRUFDTCx3QkFBZ0IsRUFBRSxNQUFNLGdCQUFnQixvQkFBb0IsQ0FBQztBQUFBLEVBQzdELGVBQWU7QUFDakI7QUFHQUEsUUFBTztBQUFBLEVBQ0w7QUFBQSxFQUNBLGFBQUssS0FBSyxLQUFLO0FBQUEsRUFDZix3QkFBZ0IsRUFBRSxPQUFPLGdCQUFnQixnQkFBZ0IsQ0FBQztBQUFBLEVBQzFELGVBQWU7QUFDakI7QUFHQUEsUUFBTztBQUFBLEVBQ0w7QUFBQSxFQUNBLGFBQUssS0FBSyxLQUFLO0FBQUEsRUFDZix3QkFBZ0I7QUFBQSxJQUNkLFFBQVEsZ0JBQWdCO0FBQUEsSUFDeEIsTUFBTSxnQkFBZ0I7QUFBQSxFQUN4QixDQUFDO0FBQUEsRUFDRCxlQUFlO0FBQ2pCO0FBR0FBLFFBQU87QUFBQSxFQUNMO0FBQUEsRUFDQSxhQUFLLEtBQUssS0FBSztBQUFBLEVBQ2Ysd0JBQWdCO0FBQUEsSUFDZCxRQUFRLGdCQUFnQjtBQUFBLElBQ3hCLE1BQU0sZ0JBQWdCO0FBQUEsRUFDeEIsQ0FBQztBQUFBLEVBQ0QsZUFBZTtBQUNqQjtBQUdBQSxRQUFPO0FBQUEsRUFDTDtBQUFBLEVBQ0EsYUFBSyxLQUFLLEtBQUs7QUFBQSxFQUNmLHdCQUFnQixFQUFFLFFBQVEsZ0JBQWdCLGlCQUFpQixDQUFDO0FBQUEsRUFDNUQsZUFBZTtBQUNqQjtBQUVPLElBQU0sYUFBYUE7OztBSXZEMUIsU0FBUyxVQUFBRSxlQUFjO0FBQ3ZCLE9BQU9DLGFBQVk7OztBQ0FuQixPQUFPQyxpQkFBZ0I7OztBQ0R2QixTQUFTLE1BQU0sa0JBQWtCO0FBR2pDLFdBQVcsT0FBTztBQUFBLEVBQ2hCLFlBQVksZUFBTztBQUFBLEVBQ25CLFNBQVMsZUFBTztBQUFBLEVBQ2hCLFlBQVksZUFBTztBQUNyQixDQUFDO0FBRUQsSUFBTyxxQkFBUTs7O0FDTlIsSUFBTSwwQkFBMEIsQ0FDckMsU0FDK0M7QUFDL0MsU0FBTyxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFDdEMsVUFBTSxlQUFlLG1CQUFXLFNBQVM7QUFBQSxNQUN2QyxFQUFFLFFBQVEsWUFBWTtBQUFBLE1BQ3RCLENBQUMsT0FBTyxXQUFXO0FBQ2pCLFlBQUksU0FBUyxDQUFDLFFBQVE7QUFDcEIsaUJBQU8sSUFBSSxTQUFTLEtBQUssd0NBQXdDLENBQUM7QUFDbEU7QUFBQSxRQUNGO0FBQ0EsZ0JBQVEsRUFBRSxLQUFLLE9BQU8sWUFBWSxVQUFVLE9BQU8sVUFBVSxDQUFDO0FBQUEsTUFDaEU7QUFBQSxJQUNGO0FBRUEsaUJBQWEsSUFBSSxLQUFLLE1BQU07QUFBQSxFQUM5QixDQUFDO0FBQ0g7OztBRlpBLElBQU0sY0FBYztBQUFBLEVBQ2xCLE9BQU8sS0FBYyxLQUFlLFNBQXVCO0FBQ3pELFFBQUksQ0FBQyxJQUFJLE1BQU07QUFDYixZQUFNLElBQUksU0FBUyxLQUFLLHdCQUF3QjtBQUFBLElBQ2xEO0FBRUEsVUFBTSxTQUFTLE1BQU0sd0JBQXdCLElBQUksSUFBSTtBQUVyRCxpQkFBYSxLQUFLO0FBQUEsTUFDaEIsU0FBUztBQUFBLE1BQ1QsWUFBWUMsWUFBVztBQUFBLE1BQ3ZCLFNBQVM7QUFBQSxNQUNULE1BQU07QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNIO0FBQ0Y7QUFFTyxJQUFNLG9CQUFvQjtBQUFBLEVBQy9CO0FBQ0Y7OztBRHJCQSxJQUFNLFNBQVNDLFFBQU87QUFBQSxFQUNwQixTQUFTQSxRQUFPLGNBQWM7QUFBQSxFQUM5QixRQUFRLEVBQUUsVUFBVSxJQUFJLE9BQU8sS0FBSztBQUFBLEVBQ3BDLFlBQVksQ0FBQyxNQUFNLE1BQU0sT0FBTztBQUM5QixRQUFJLDJCQUEyQixLQUFLLEtBQUssUUFBUSxHQUFHO0FBQ2xELFNBQUcsTUFBTSxJQUFJO0FBQUEsSUFDZixPQUFPO0FBQ0w7QUFBQSxRQUNFLE9BQU8sT0FBTyxJQUFJLE1BQU0sMENBQTBDLEdBQUc7QUFBQSxVQUNuRSxNQUFNO0FBQUEsUUFDUixDQUFDO0FBQUEsTUFDSDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQztBQUVELElBQU1DLFVBQVNDLFFBQU87QUFFdEJELFFBQU87QUFBQSxFQUNMO0FBQUEsRUFDQSxhQUFLLEtBQUssT0FBTyxLQUFLLEtBQUs7QUFBQSxFQUMzQixPQUFPLE9BQU8sT0FBTztBQUFBLEVBQ3JCLGtCQUFrQjtBQUNwQjtBQUVPLElBQU0sZUFBZUE7OztBSS9CNUIsU0FBUyxVQUFBRSxlQUFjOzs7QUNDdkIsT0FBT0MsaUJBQWdCOzs7QUNEdkIsU0FBUyxjQUFjO0FBY3ZCLElBQUksU0FBd0I7QUFFNUIsU0FBUyxZQUEyQjtBQUNsQyxNQUFJLE9BQVEsUUFBTztBQUNuQixNQUFJLENBQUMsZUFBTyxlQUFnQixRQUFPO0FBQ25DLFdBQVMsSUFBSSxPQUFPLGVBQU8sY0FBYztBQUN6QyxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFdBQVcsT0FBdUI7QUFDaEQsU0FBTyxNQUNKLFFBQVEsTUFBTSxPQUFPLEVBQ3JCLFFBQVEsTUFBTSxNQUFNLEVBQ3BCLFFBQVEsTUFBTSxNQUFNLEVBQ3BCLFFBQVEsTUFBTSxRQUFRLEVBQ3RCLFFBQVEsTUFBTSxRQUFRO0FBQzNCO0FBTUEsZUFBZSxZQUNiLFFBQ0EsU0FDQSxJQUNBLE1BQ0EsU0FDZTtBQUNmLE1BQUk7QUFDRixVQUFNLE9BQU8sT0FBTyxLQUFLO0FBQUEsTUFDdkIsTUFBTSxlQUFPLGNBQWM7QUFBQSxNQUMzQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxHQUFJLFVBQVUsRUFBRSxRQUFRLElBQUksQ0FBQztBQUFBLElBQy9CLENBQUM7QUFBQSxFQUNILFNBQVMsT0FBTztBQUNkLFVBQU0sU0FBUyxpQkFBaUIsUUFBUSxNQUFNLFVBQVUsT0FBTyxLQUFLO0FBQ3BFLFlBQVEsS0FBSyx3QkFBd0IsT0FBTyxRQUFRLEdBQUcsS0FBSyxJQUFJLENBQUMsS0FBSyxNQUFNLEVBQUU7QUFBQSxFQUNoRjtBQUNGO0FBRU8sSUFBTSxjQUFjLENBQUMsWUFBb0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFNeEMsT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVNSLElBQU0sMEJBQTBCLE9BQ3JDLFlBQ2tCO0FBQ2xCLFFBQU0sU0FBUyxVQUFVO0FBQ3pCLE1BQUksQ0FBQyxVQUFVLENBQUMsZUFBTyx3QkFBd0I7QUFDN0MsWUFBUSxLQUFLLCtEQUErRDtBQUM1RTtBQUFBLEVBQ0Y7QUFFQSxRQUFNLFlBQVksUUFBUSxXQUFXLFlBQVksS0FBSztBQUV0RCxRQUFNLFVBQVU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLDhDQUs0QixXQUFXLFFBQVEsSUFBSSxDQUFDO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0NBSWhDLFdBQVcsUUFBUSxLQUFLLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFBQSw4Q0FJakIsV0FBVyxRQUFRLE9BQU8sQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBLHNDQUluQyxXQUFXLFNBQVMsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBLFFBSW5ELFdBQVcsUUFBUSxPQUFPLENBQUM7QUFBQTtBQUFBO0FBSWpDLFFBQU07QUFBQSxJQUNKO0FBQUEsSUFDQSx3QkFBd0IsUUFBUSxPQUFPO0FBQUEsSUFDdkMsQ0FBQyxlQUFPLHNCQUFzQjtBQUFBLElBQzlCLFlBQVksT0FBTztBQUFBLEVBQ3JCO0FBQ0Y7QUFHTyxJQUFNLHVCQUF1QixPQUNsQyxZQUNrQjtBQUNsQixRQUFNLFNBQVMsVUFBVTtBQUN6QixNQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsT0FBTztBQUM3QixZQUFRLEtBQUssNkRBQTZEO0FBQzFFO0FBQUEsRUFDRjtBQUVBLFFBQU0sZ0JBQWdCLGVBQU87QUFFN0IsUUFBTSxVQUFVO0FBQUEsMkVBQ3lELFdBQVcsUUFBUSxJQUFJLENBQUM7QUFBQTtBQUFBO0FBQUEsdUJBRzVFLFdBQVcsUUFBUSxPQUFPLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFLaEQsUUFBTTtBQUFBLElBQ0o7QUFBQSxJQUNBO0FBQUEsSUFDQSxDQUFDLFFBQVEsS0FBSztBQUFBLElBQ2QsWUFBWSxPQUFPO0FBQUEsSUFDbkI7QUFBQSxFQUNGO0FBQ0Y7QUFlTyxJQUFNLG1CQUFtQixPQUM5QixZQUNrQjtBQUNsQixRQUFNLFNBQVMsVUFBVTtBQUN6QixNQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsT0FBTztBQUM3QixZQUFRLEtBQUssd0RBQXdEO0FBQ3JFO0FBQUEsRUFDRjtBQUVBLFFBQU0sYUFBYSxRQUFRLFdBQVcsWUFBWSxFQUFFLE1BQU0sR0FBRyxFQUFFO0FBRS9ELFFBQU0sYUFHRjtBQUFBLElBQ0YsQ0FBQyxjQUFjLE9BQU8sR0FBRztBQUFBLE1BQ3ZCLFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxDQUFDLGNBQWMsSUFBSSxHQUFHO0FBQUEsTUFDcEIsU0FBUztBQUFBLE1BQ1QsU0FBUztBQUFBLE1BQ1QsTUFBTTtBQUFBLElBQ1I7QUFBQSxJQUNBLENBQUMsY0FBYyxTQUFTLEdBQUc7QUFBQSxNQUN6QixTQUFTO0FBQUEsTUFDVCxTQUFTO0FBQUEsTUFDVCxNQUFNO0FBQUEsSUFDUjtBQUFBLElBQ0EsQ0FBQyxjQUFjLFNBQVMsR0FBRztBQUFBLE1BQ3pCLFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxDQUFDLGNBQWMsU0FBUyxHQUFHO0FBQUEsTUFDekIsU0FBUztBQUFBLE1BQ1QsU0FBUztBQUFBLE1BQ1QsTUFBTTtBQUFBLElBQ1I7QUFBQSxFQUNGO0FBRUEsUUFBTSxPQUFPLFdBQVcsUUFBUSxNQUFNO0FBRXRDLFFBQU0sVUFBVTtBQUFBLGtEQUNnQyxLQUFLLE9BQU87QUFBQTtBQUFBLFdBRW5ELFdBQVcsUUFBUSxJQUFJLENBQUM7QUFBQSxRQUMzQixLQUFLLElBQUk7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLDhDQUs2QixXQUFXLFFBQVEsWUFBWSxDQUFDO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0NBSXhDLFdBQVcsVUFBVSxDQUFDO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0NBSXRCLFdBQVcsT0FBTyxRQUFRLFNBQVMsQ0FBQyxDQUFDO0FBQUE7QUFBQTtBQUFBO0FBQUEscURBSXRCLFdBQVcsUUFBUSxXQUFXLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFLNUYsUUFBTTtBQUFBLElBQ0o7QUFBQSxJQUNBLEtBQUs7QUFBQSxJQUNMLENBQUMsUUFBUSxLQUFLO0FBQUEsSUFDZCxZQUFZLE9BQU87QUFBQSxFQUNyQjtBQUNGO0FBYU8sSUFBTSxrQkFBa0IsT0FDN0IsWUFDa0I7QUFDbEIsUUFBTSxTQUFTLFVBQVU7QUFDekIsTUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLE9BQU87QUFDN0IsWUFBUSxLQUFLLHVEQUF1RDtBQUNwRTtBQUFBLEVBQ0Y7QUFFQSxRQUFNLGFBQWEsUUFBUSxXQUFXLFlBQVksRUFBRSxNQUFNLEdBQUcsRUFBRTtBQUUvRCxRQUFNLFVBQVU7QUFBQTtBQUFBO0FBQUEsV0FHUCxXQUFXLFFBQVEsSUFBSSxDQUFDO0FBQUEsdURBQ29CO0FBQUEsSUFDL0MsUUFBUSxPQUFPLFFBQVEsQ0FBQztBQUFBLEVBQzFCLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsOENBTXVDLFdBQVcsUUFBUSxZQUFZLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQ0FJeEMsV0FBVyxVQUFVLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFBQSxxREFJUCxXQUFXLFFBQVEsT0FBTyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQUE7QUFBQSxRQUVsRixRQUFRLGNBQ047QUFBQTtBQUFBO0FBQUEsc0NBRzRCLFdBQVcsUUFBUSxXQUFXLENBQUM7QUFBQSxlQUUzRCxFQUFFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQU9WLFFBQU07QUFBQSxJQUNKO0FBQUEsSUFDQTtBQUFBLElBQ0EsQ0FBQyxRQUFRLEtBQUs7QUFBQSxJQUNkLFlBQVksT0FBTztBQUFBLEVBQ3JCO0FBQ0Y7OztBQ25TQSxJQUFNLGdCQUFnQixPQUFPLFlBQW1DO0FBQzlELFFBQU0saUJBQWlCLE1BQU0sT0FBTyxlQUFlLE9BQU87QUFBQSxJQUN4RCxNQUFNO0FBQUEsTUFDSixNQUFNLFFBQVE7QUFBQSxNQUNkLE9BQU8sUUFBUTtBQUFBLE1BQ2YsU0FBUyxRQUFRO0FBQUEsTUFDakIsU0FBUyxRQUFRO0FBQUEsSUFDbkI7QUFBQSxFQUNGLENBQUM7QUFJRCxRQUFNLFFBQVEsV0FBVztBQUFBLElBQ3ZCLHdCQUF3QixFQUFFLEdBQUcsZ0JBQWdCLFdBQVcsZUFBZSxVQUFVLENBQUM7QUFBQSxJQUNsRixxQkFBcUIsRUFBRSxHQUFHLGdCQUFnQixXQUFXLGVBQWUsVUFBVSxDQUFDO0FBQUEsRUFDakYsQ0FBQztBQUVELFNBQU87QUFDVDtBQUdBLElBQU0sZUFBZSxPQUFPLFVBQXlCO0FBQ25ELFFBQU0sT0FBTyxNQUFNLFFBQVE7QUFDM0IsUUFBTSxRQUFRLE1BQU0sU0FBUztBQUM3QixRQUFNLFFBQVEsT0FBTyxLQUFLO0FBRTFCLFFBQU0sUUFDSixNQUFNLGVBQWUsU0FDakIsU0FDQSxFQUFFLFlBQVksTUFBTSxXQUFXO0FBRXJDLFFBQU0sQ0FBQyxNQUFNLEtBQUssSUFBSSxNQUFNLFFBQVEsSUFBSTtBQUFBLElBQ3RDLE9BQU8sZUFBZSxTQUFTO0FBQUEsTUFDN0I7QUFBQSxNQUNBLFNBQVMsRUFBRSxXQUFXLE9BQU87QUFBQSxNQUM3QjtBQUFBLE1BQ0EsTUFBTTtBQUFBLElBQ1IsQ0FBQztBQUFBLElBQ0QsT0FBTyxlQUFlLE1BQU0sRUFBRSxNQUFNLENBQUM7QUFBQSxFQUN2QyxDQUFDO0FBRUQsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBLE1BQU07QUFBQSxNQUNKO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLFlBQVksS0FBSyxLQUFLLFFBQVEsS0FBSztBQUFBLElBQ3JDO0FBQUEsRUFDRjtBQUNGO0FBR0EsSUFBTSxpQkFBaUIsT0FBTyxJQUFZLGVBQXdCO0FBQ2hFLFNBQU8sT0FBTyxlQUFlLE9BQU87QUFBQSxJQUNsQyxPQUFPLEVBQUUsR0FBRztBQUFBLElBQ1osTUFBTSxFQUFFLFdBQVc7QUFBQSxFQUNyQixDQUFDO0FBQ0g7QUFFTyxJQUFNLGlCQUFpQjtBQUFBLEVBQzVCO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjs7O0FGbEVBLElBQU1DLGlCQUFnQjtBQUFBLEVBQ3BCLE9BQU8sS0FBYyxLQUFlLFNBQXVCO0FBQ3pELFVBQU0sVUFBVSxNQUFNLGVBQWUsY0FBYyxJQUFJLElBQUk7QUFFM0QsaUJBQWEsS0FBSztBQUFBLE1BQ2hCLFNBQVM7QUFBQSxNQUNULFlBQVlDLFlBQVc7QUFBQSxNQUN2QixTQUFTO0FBQUEsTUFDVCxNQUFNO0FBQUEsSUFDUixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBR0EsSUFBTSxjQUFjO0FBQUEsRUFDbEIsT0FBTyxLQUFjLEtBQWUsU0FBdUI7QUFDekQsVUFBTSxTQUFTLE1BQU0sZUFBZSxhQUFhLElBQUksS0FBSztBQUUxRCxpQkFBYSxLQUFLO0FBQUEsTUFDaEIsU0FBUztBQUFBLE1BQ1QsWUFBWUEsWUFBVztBQUFBLE1BQ3ZCLFNBQVM7QUFBQSxNQUNULE1BQU0sT0FBTztBQUFBLE1BQ2IsTUFBTSxPQUFPO0FBQUEsSUFDZixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBR0EsSUFBTSxpQkFBaUI7QUFBQSxFQUNyQixPQUFPLEtBQWMsS0FBZSxTQUF1QjtBQUN6RCxVQUFNLEtBQUssT0FBTyxJQUFJLE9BQU8sRUFBRTtBQUMvQixVQUFNLEVBQUUsV0FBVyxJQUFJLElBQUk7QUFFM0IsVUFBTSxVQUFVLE1BQU0sZUFBZSxlQUFlLElBQUksVUFBVTtBQUVsRSxpQkFBYSxLQUFLO0FBQUEsTUFDaEIsU0FBUztBQUFBLE1BQ1QsWUFBWUEsWUFBVztBQUFBLE1BQ3ZCLFNBQVM7QUFBQSxNQUNULE1BQU07QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNIO0FBQ0Y7QUFFTyxJQUFNLG9CQUFvQjtBQUFBLEVBQy9CLGVBQUFEO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjs7O0FHeERBLFNBQVMsS0FBQUUsVUFBUztBQUVsQixJQUFNLHNCQUFzQkEsR0FBRSxPQUFPO0FBQUEsRUFDbkMsTUFBTUEsR0FDSCxPQUFPLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDLEVBQzdDLEtBQUssRUFDTCxJQUFJLEdBQUcsb0NBQW9DLEVBQzNDLElBQUksS0FBSyxxQ0FBcUM7QUFBQSxFQUNqRCxPQUFPQSxHQUNKLE9BQU8sRUFBRSxnQkFBZ0Isb0JBQW9CLENBQUMsRUFDOUMsS0FBSyxFQUNMLE1BQU0sc0NBQXNDO0FBQUEsRUFDL0MsU0FBU0EsR0FDTixPQUFPLEVBQUUsZ0JBQWdCLHNCQUFzQixDQUFDLEVBQ2hELEtBQUssRUFDTCxJQUFJLEdBQUcsdUNBQXVDLEVBQzlDLElBQUksS0FBSyx3Q0FBd0M7QUFBQSxFQUNwRCxTQUFTQSxHQUNOLE9BQU8sRUFBRSxnQkFBZ0Isc0JBQXNCLENBQUMsRUFDaEQsS0FBSyxFQUNMLElBQUksSUFBSSx3Q0FBd0MsRUFDaEQsSUFBSSxLQUFNLHlDQUF5QztBQUN4RCxDQUFDLEVBQUUsT0FBTztBQUVWLElBQU0scUJBQXFCQSxHQUFFLE9BQU87QUFBQSxFQUNsQyxNQUFNQSxHQUFFLE9BQU8sT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxRQUFRLENBQUM7QUFBQSxFQUM5QyxPQUFPQSxHQUFFLE9BQU8sT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUU7QUFBQSxFQUN4RCxZQUFZQSxHQUNULEtBQUssQ0FBQyxRQUFRLE9BQU8sQ0FBQyxFQUN0QixTQUFTLEVBQ1QsVUFBVSxDQUFDLFFBQVMsUUFBUSxTQUFZLFNBQVksUUFBUSxNQUFPO0FBQ3hFLENBQUM7QUFFRCxJQUFNLHNCQUFzQkEsR0FBRSxPQUFPO0FBQUEsRUFDbkMsSUFBSUEsR0FBRSxPQUFPLEVBQUUsZ0JBQWdCLHlCQUF5QixDQUFDLEVBQUUsSUFBSSxDQUFDO0FBQ2xFLENBQUM7QUFFRCxJQUFNLHVCQUF1QkEsR0FDMUIsT0FBTztBQUFBLEVBQ04sWUFBWUEsR0FBRSxRQUFRO0FBQUEsSUFDcEIsZ0JBQWdCO0FBQUEsSUFDaEIsb0JBQW9CO0FBQUEsRUFDdEIsQ0FBQztBQUNILENBQUMsRUFDQSxPQUFPLEVBQ1AsT0FBTyxDQUFDLFNBQVMsT0FBTyxLQUFLLGVBQWUsV0FBVztBQUFBLEVBQ3RELFNBQVM7QUFDWCxDQUFDO0FBRUksSUFBTSxxQkFBcUI7QUFBQSxFQUNoQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNGOzs7QUovQ0EsSUFBTUMsVUFBU0MsUUFBTztBQUd0QkQsUUFBTztBQUFBLEVBQ0w7QUFBQSxFQUNBLHdCQUFnQixFQUFFLE1BQU0sbUJBQW1CLG9CQUFvQixDQUFDO0FBQUEsRUFDaEUsa0JBQWtCO0FBQ3BCO0FBR0FBLFFBQU87QUFBQSxFQUNMO0FBQUEsRUFDQSxhQUFLLEtBQUssS0FBSztBQUFBLEVBQ2Ysd0JBQWdCLEVBQUUsT0FBTyxtQkFBbUIsbUJBQW1CLENBQUM7QUFBQSxFQUNoRSxrQkFBa0I7QUFDcEI7QUFHQUEsUUFBTztBQUFBLEVBQ0w7QUFBQSxFQUNBLGFBQUssS0FBSyxLQUFLO0FBQUEsRUFDZix3QkFBZ0I7QUFBQSxJQUNkLFFBQVEsbUJBQW1CO0FBQUEsSUFDM0IsTUFBTSxtQkFBbUI7QUFBQSxFQUMzQixDQUFDO0FBQUEsRUFDRCxrQkFBa0I7QUFDcEI7QUFFTyxJQUFNLGdCQUFnQkE7OztBS25DN0IsU0FBUyxVQUFBRSxlQUFjOzs7QUNDdkIsT0FBT0MsaUJBQWdCOzs7QUNEdkIsU0FBUyxrQkFBa0I7QUFRM0IsSUFBTSxnQkFBZ0IsTUFBTTtBQUMxQixNQUFJLENBQUMsZUFBTyx3QkFBd0IsQ0FBQyxlQUFPLDRCQUE0QjtBQUN0RSxVQUFNLElBQUk7QUFBQSxNQUNSO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0EsTUFBSSxDQUFDLGVBQU8sb0JBQW9CO0FBQzlCLFVBQU0sSUFBSTtBQUFBLE1BQ1I7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDQSxTQUFPO0FBQUEsSUFDTCxTQUFTLGVBQU87QUFBQSxJQUNoQixlQUFlLGVBQU87QUFBQSxFQUN4QjtBQUNGO0FBZ0NPLFNBQVMsaUJBQXlCO0FBQ3ZDLFNBQU8sV0FBVyxLQUFLLElBQUksQ0FBQyxJQUFJLFdBQVcsRUFBRSxRQUFRLE1BQU0sRUFBRSxFQUFFLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDNUU7QUFLTyxTQUFTLHVCQUErQjtBQUM3QyxTQUFPLE9BQU8sS0FBSyxJQUFJLENBQUMsSUFBSSxXQUFXLEVBQUUsUUFBUSxNQUFNLEVBQUUsRUFBRSxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQ3hFO0FBSUEsZUFBc0IsZUFBZSxTQVVIO0FBQ2hDLFFBQU0sRUFBRSxTQUFTLGNBQWMsSUFBSSxjQUFjO0FBQ2pELFFBQU0sT0FBTyxJQUFJLGdCQUFnQjtBQUFBLElBQy9CLFVBQVU7QUFBQSxJQUNWLGNBQWM7QUFBQSxJQUNkLGNBQWMsUUFBUSxhQUFhLFFBQVEsQ0FBQztBQUFBLElBQzVDLFVBQVU7QUFBQSxJQUNWLFNBQVMsUUFBUTtBQUFBLElBQ2pCLGFBQWEsUUFBUTtBQUFBLElBQ3JCLFVBQVUsUUFBUTtBQUFBLElBQ2xCLFlBQVksUUFBUTtBQUFBLElBQ3BCLFNBQVMsUUFBUTtBQUFBLElBQ2pCLFVBQVUsUUFBUTtBQUFBLElBQ2xCLFdBQVcsUUFBUTtBQUFBLElBQ25CLFVBQVU7QUFBQSxJQUNWLFVBQVU7QUFBQSxJQUNWLFVBQVU7QUFBQSxJQUNWLFdBQVc7QUFBQSxJQUNYLGNBQWM7QUFBQSxJQUNkLGFBQWE7QUFBQSxJQUNiLFdBQVcsUUFBUTtBQUFBLElBQ25CLGNBQWM7QUFBQSxJQUNkLGlCQUFpQjtBQUFBLEVBQ25CLENBQUM7QUFFRCxRQUFNLE1BQU0sTUFBTSxNQUFNLGVBQU8scUJBQXFCO0FBQUEsSUFDbEQsUUFBUTtBQUFBLElBQ1IsU0FBUyxFQUFFLGdCQUFnQixvQ0FBb0M7QUFBQSxJQUMvRCxNQUFNLEtBQUssU0FBUztBQUFBLEVBQ3RCLENBQUM7QUFFRCxRQUFNLE9BQU8sTUFBTSxJQUFJLEtBQUs7QUFDNUIsTUFBSSxDQUFDLElBQUksR0FBSSxPQUFNLElBQUksU0FBUyxLQUFLLDJCQUEyQixJQUFJLE1BQU0sR0FBRztBQUU3RSxNQUFJO0FBQ0osTUFBSTtBQUNGLFdBQU8sS0FBSyxNQUFNLElBQUk7QUFBQSxFQUN4QixRQUFRO0FBQ04sVUFBTSxJQUFJLFNBQVMsS0FBSyw4Q0FBOEM7QUFBQSxFQUN4RTtBQUlBLE1BQUksS0FBSyxXQUFXLGFBQWEsQ0FBQyxLQUFLLGdCQUFnQjtBQUNyRCxVQUFNLFNBQVMsS0FBSyxnQkFBZ0IsS0FBSyxVQUFVO0FBQ25ELFlBQVE7QUFBQSxNQUNOLG1DQUFtQyxlQUFPLG1CQUFtQixhQUFhLGVBQU8sbUJBQW1CLE1BQU0sTUFBTTtBQUFBLE1BQ2hIO0FBQUEsSUFDRjtBQUNBLFVBQU0sSUFBSTtBQUFBLE1BQ1I7QUFBQSxNQUNBLDZCQUE2QixNQUFNO0FBQUEsSUFDckM7QUFBQSxFQUNGO0FBQ0EsU0FBTztBQUNUO0FBS0EsZUFBc0IsbUJBQW1CLFNBRUQ7QUFDdEMsUUFBTSxFQUFFLFNBQVMsY0FBYyxJQUFJLGNBQWM7QUFDakQsUUFBTSxTQUFTLElBQUksZ0JBQWdCO0FBQUEsSUFDakMsUUFBUSxRQUFRO0FBQUEsSUFDaEIsVUFBVTtBQUFBLElBQ1YsY0FBYztBQUFBLElBQ2QsUUFBUTtBQUFBLEVBQ1YsQ0FBQztBQUVELFFBQU0sTUFBTSxNQUFNLE1BQU0sR0FBRyxlQUFPLHVCQUF1QixJQUFJLE9BQU8sU0FBUyxDQUFDLElBQUk7QUFBQSxJQUNoRixRQUFRO0FBQUEsRUFDVixDQUFDO0FBRUQsUUFBTSxPQUFPLE1BQU0sSUFBSSxLQUFLO0FBQzVCLE1BQUksQ0FBQyxJQUFJLEdBQUksT0FBTSxJQUFJLFNBQVMsS0FBSyxpQ0FBaUMsSUFBSSxNQUFNLEdBQUc7QUFFbkYsTUFBSTtBQUNKLE1BQUk7QUFDRixXQUFPLEtBQUssTUFBTSxJQUFJO0FBQUEsRUFDeEIsUUFBUTtBQUNOLFVBQU0sSUFBSSxTQUFTLEtBQUssb0RBQW9EO0FBQUEsRUFDOUU7QUFDQSxTQUFPO0FBQ1Q7QUFRQSxlQUFzQixpQkFBaUIsU0FNSDtBQUNsQyxRQUFNLEVBQUUsU0FBUyxjQUFjLElBQUksY0FBYztBQUNqRCxRQUFNLFNBQVMsSUFBSSxnQkFBZ0I7QUFBQSxJQUNqQyxjQUFjLFFBQVE7QUFBQSxJQUN0QixpQkFBaUIsUUFBUSxtQkFBbUIscUJBQXFCO0FBQUEsSUFDakUsVUFBVTtBQUFBLElBQ1YsY0FBYztBQUFBLElBQ2QsZUFBZSxRQUFRLGNBQWMsUUFBUSxDQUFDO0FBQUEsSUFDOUMsZ0JBQWdCLFFBQVE7QUFBQSxJQUN4QixRQUFRO0FBQUEsSUFDUixHQUFHO0FBQUEsRUFDTCxDQUFDO0FBQ0QsTUFBSSxRQUFRLFFBQVMsUUFBTyxJQUFJLFdBQVcsUUFBUSxPQUFPO0FBRTFELFFBQU0sTUFBTSxNQUFNO0FBQUEsSUFDaEIsR0FBRyxlQUFPLHFCQUFxQixJQUFJLE9BQU8sU0FBUyxDQUFDO0FBQUEsSUFDcEQsRUFBRSxRQUFRLE9BQU8sUUFBUSxZQUFZLFFBQVEsR0FBSSxFQUFFO0FBQUEsRUFDckQ7QUFFQSxRQUFNLE9BQU8sTUFBTSxJQUFJLEtBQUs7QUFDNUIsTUFBSSxDQUFDLElBQUksR0FBSSxPQUFNLElBQUksU0FBUyxLQUFLLDZCQUE2QixJQUFJLE1BQU0sR0FBRztBQUUvRSxNQUFJO0FBQ0osTUFBSTtBQUNGLFdBQU8sS0FBSyxNQUFNLElBQUk7QUFBQSxFQUN4QixRQUFRO0FBQ04sVUFBTSxJQUFJLFNBQVMsS0FBSyxnREFBZ0Q7QUFBQSxFQUMxRTtBQUtBLE1BQUksS0FBSyxlQUFlLFVBQVUsS0FBSyxXQUFXLFdBQVc7QUFDM0QsVUFBTSxJQUFJO0FBQUEsTUFDUjtBQUFBLE1BQ0EsK0JBQStCLEtBQUssZUFBZSxLQUFLLGNBQWMsS0FBSyxVQUFVLFNBQVM7QUFBQSxJQUNoRztBQUFBLEVBQ0Y7QUFDQSxTQUFPO0FBQ1Q7OztBQ25OTyxJQUFNLFNBQVMsT0FDcEIsUUFDQSxNQUNBLE9BQ0EsU0FDQSxTQUNrQjtBQUNsQixNQUFJO0FBQ0YsVUFBTSxPQUFPLGFBQWEsT0FBTztBQUFBLE1BQy9CLE1BQU0sRUFBRSxRQUFRLE1BQU0sT0FBTyxTQUFTLEtBQUs7QUFBQSxJQUM3QyxDQUFDO0FBQUEsRUFDSCxTQUFTLE9BQU87QUFDZCxZQUFRO0FBQUEsTUFDTixtQ0FBbUMsSUFBSSxhQUFhLE1BQU0sS0FDeEQsaUJBQWlCLFFBQVEsTUFBTSxVQUFVLE9BQU8sS0FBSyxDQUN2RDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7OztBQ1JBLElBQU0sc0JBQXNCO0FBRTVCLElBQU0sZ0JBQWdCLENBQUMsU0FDckIsSUFBSTtBQUFBLEVBQ0YsS0FBSyxJQUFJLEtBQUssZUFBZSxHQUFHLEtBQUssWUFBWSxHQUFHLEtBQUssV0FBVyxDQUFDO0FBQ3ZFO0FBWUYsSUFBTSxZQUFZLENBQUMsU0FBMkIsVUFDNUMsUUFBUSxXQUFXLE1BQU0sTUFDeEIsTUFBTSxTQUFTLEtBQUssU0FBUyxRQUFRLFFBQVEsWUFBWSxNQUFNLE1BQ2hFLE1BQU0sU0FBUyxLQUFLO0FBSXRCLElBQU0sc0JBQXNCLENBQUMsU0FBMkIsVUFDdEQsTUFBTSxTQUFTLEtBQUssU0FDbkIsTUFBTSxTQUFTLEtBQUssU0FBUyxRQUFRLFFBQVEsWUFBWSxNQUFNO0FBU2xFLElBQU0sY0FFRjtBQUFBLEVBQ0YsQ0FBQyxjQUFjLE9BQU8sR0FBRztBQUFBLElBQ3ZCLENBQUMsY0FBYyxTQUFTLEdBQUcsRUFBRSxTQUFTLG9CQUFvQjtBQUFBLElBQzFELENBQUMsY0FBYyxTQUFTLEdBQUcsRUFBRSxTQUFTLFVBQVU7QUFBQSxFQUNsRDtBQUFBLEVBQ0EsQ0FBQyxjQUFjLElBQUksR0FBRztBQUFBLElBQ3BCLENBQUMsY0FBYyxTQUFTLEdBQUcsRUFBRSxTQUFTLG9CQUFvQjtBQUFBLElBQzFELENBQUMsY0FBYyxTQUFTLEdBQUcsRUFBRSxTQUFTLFVBQVU7QUFBQSxFQUNsRDtBQUFBLEVBQ0EsQ0FBQyxjQUFjLFNBQVMsR0FBRztBQUFBLElBQ3pCLENBQUMsY0FBYyxTQUFTLEdBQUc7QUFBQSxNQUN6QixTQUFTO0FBQUEsTUFDVCwwQkFBMEI7QUFBQSxJQUM1QjtBQUFBLElBQ0EsQ0FBQyxjQUFjLFNBQVMsR0FBRyxFQUFFLFNBQVMsVUFBVTtBQUFBLElBQ2hELENBQUMsY0FBYyxPQUFPLEdBQUc7QUFBQSxNQUN2QixTQUFTO0FBQUEsTUFDVCxrQkFBa0I7QUFBQSxJQUNwQjtBQUFBLEVBQ0Y7QUFDRjtBQUdBLElBQU0sdUJBQXVCO0FBQUEsRUFDM0IsUUFBUTtBQUFBLElBQ04sSUFBSTtBQUFBLElBQ0osT0FBTztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sVUFBVTtBQUFBLElBQ1YsUUFBUTtBQUFBLElBQ1IsT0FBTztBQUFBLEVBQ1Q7QUFDRjtBQUdBLElBQU0sNkJBQTZCO0FBQUEsRUFDakMsUUFBUTtBQUFBLElBQ04sSUFBSTtBQUFBLElBQ0osT0FBTztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sVUFBVTtBQUFBLElBQ1YsUUFBUTtBQUFBLElBQ1IsT0FBTztBQUFBLElBQ1AsU0FBUztBQUFBLEVBQ1g7QUFDRjtBQUVBLElBQU0sb0JBQW9CO0FBQUEsRUFDeEIsUUFBUSxFQUFFLElBQUksTUFBTSxNQUFNLE1BQU0sT0FBTyxLQUFLO0FBQzlDO0FBR0EsSUFBTSx1QkFBdUI7QUFBQSxFQUMzQixRQUFRO0FBQUEsSUFDTixJQUFJO0FBQUEsSUFDSixRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsSUFDUixVQUFVO0FBQUEsSUFDVixRQUFRO0FBQUEsSUFDUixVQUFVO0FBQUEsSUFDVixZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUEsSUFDUCxRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsSUFDYixtQkFBbUI7QUFBQSxJQUNuQixtQkFBbUI7QUFBQSxFQUNyQjtBQUNGO0FBSUEsSUFBTSx5QkFBeUI7QUFBQSxFQUM3QixHQUFHO0FBQUEsRUFDSCxTQUFTLEVBQUUsV0FBVyxPQUFnQjtBQUN4QztBQW9CQSxJQUFNLGlCQUFpQixDQUFDLGFBQXNFO0FBQUEsRUFDNUYsR0FBRztBQUFBLEVBQ0gsWUFBWSxPQUFPLFFBQVEsVUFBVTtBQUFBLEVBQ3JDLFNBQVMsRUFBRSxHQUFHLFFBQVEsU0FBUyxPQUFPLE9BQU8sUUFBUSxRQUFRLEtBQUssRUFBRTtBQUFBLEVBQ3BFLFVBQVUsUUFBUSxVQUFVLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxHQUFHLFFBQVEsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO0FBQzdFO0FBR0EsSUFBTSxnQkFBZ0IsT0FBTyxRQUFnQixZQUE0QjtBQUN2RSxRQUFNLEVBQUUsV0FBVyxVQUFVLElBQUk7QUFDakMsUUFBTSxhQUFhLGNBQWMsUUFBUSxVQUFVO0FBRW5ELFFBQU0sY0FBYyxNQUFNLE9BQU8sWUFBWSxXQUFXO0FBQUEsSUFDdEQsT0FBTyxFQUFFLElBQUksVUFBVTtBQUFBLEVBQ3pCLENBQUM7QUFDRCxNQUNFLENBQUMsZUFDRCxZQUFZLGFBQ1osWUFBWSxXQUFXLGNBQWMsVUFDckM7QUFDQSxVQUFNLElBQUksU0FBUyxLQUFLLHVDQUF1QztBQUFBLEVBQ2pFO0FBSUEsUUFBTSxhQUFhLE9BQU8sWUFBWSxLQUFLLElBQUk7QUFFL0MsUUFBTSxVQUFVLE1BQU0sT0FBTyxhQUFhLE9BQU8sT0FBTztBQUN0RCxVQUFNLFdBQVcsTUFBTSxHQUFHLFFBQVEsVUFBVTtBQUFBLE1BQzFDLE9BQU87QUFBQSxRQUNMO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBLFFBQVEsY0FBYztBQUFBLE1BQ3hCO0FBQUEsTUFDQSxTQUFTLEVBQUUsV0FBVyxPQUFPO0FBQUEsSUFDL0IsQ0FBQztBQUVELFFBQUksVUFBVTtBQUNaLFlBQU0sV0FDSixTQUFTLFVBQVUsUUFBUSxLQUMzQixLQUFLLElBQUksSUFBSSxzQkFBc0IsS0FBSyxLQUFLO0FBRS9DLFVBQUksVUFBVTtBQUNaLGNBQU0sSUFBSTtBQUFBLFVBQ1I7QUFBQSxVQUNBO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFHQSxZQUFNLEdBQUcsUUFBUSxPQUFPO0FBQUEsUUFDdEIsT0FBTyxFQUFFLElBQUksU0FBUyxHQUFHO0FBQUEsUUFDekIsTUFBTSxFQUFFLFFBQVEsY0FBYyxVQUFVO0FBQUEsTUFDMUMsQ0FBQztBQUFBLElBQ0g7QUFFQSxXQUFPLEdBQUcsUUFBUSxPQUFPO0FBQUEsTUFDdkIsTUFBTSxFQUFFLFFBQVEsV0FBVyxZQUFZLFdBQVcsV0FBVztBQUFBLElBQy9ELENBQUM7QUFBQSxFQUNILENBQUM7QUFHRCxRQUFNLE9BQU8sTUFBTSxPQUFPLEtBQUssV0FBVztBQUFBLElBQ3hDLE9BQU8sRUFBRSxJQUFJLE9BQU87QUFBQSxJQUNwQixRQUFRLEVBQUUsTUFBTSxNQUFNLE9BQU8sS0FBSztBQUFBLEVBQ3BDLENBQUM7QUFDRCxNQUFJLE1BQU07QUFDUixTQUFLLFFBQVEsV0FBVztBQUFBLE1BQ3RCLGlCQUFpQjtBQUFBLFFBQ2YsT0FBTyxLQUFLO0FBQUEsUUFDWixNQUFNLEtBQUs7QUFBQSxRQUNYLGNBQWMsWUFBWTtBQUFBLFFBQzFCO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBLFFBQVEsY0FBYztBQUFBLE1BQ3hCLENBQUM7QUFBQSxJQUNILENBQUM7QUFBQSxFQUNIO0FBR0EsT0FBSyxRQUFRLFdBQVc7QUFBQSxJQUN0QjtBQUFBLE1BQ0UsWUFBWTtBQUFBLE1BQ1osaUJBQWlCO0FBQUEsTUFDakI7QUFBQSxNQUNBLHNDQUFzQyxZQUFZLEtBQUs7QUFBQSxNQUN2RCw2QkFBNkIsUUFBUSxFQUFFO0FBQUEsSUFDekM7QUFBQSxFQUNGLENBQUM7QUFFRCxTQUFPO0FBQUEsSUFDTCxHQUFHO0FBQUEsSUFDSCxZQUFZLE9BQU8sUUFBUSxVQUFVO0FBQUEsRUFDdkM7QUFDRjtBQUdBLElBQU0sa0JBQWtCLE9BQ3RCLE9BQ0EsU0FDQSxVQUNHO0FBQ0gsUUFBTSxPQUFPLE1BQU0sUUFBUTtBQUMzQixRQUFNLFFBQVEsTUFBTSxTQUFTO0FBRTdCLFFBQU0sQ0FBQyxNQUFNLEtBQUssSUFBSSxNQUFNLFFBQVEsSUFBSTtBQUFBLElBQ3RDLE9BQU8sUUFBUSxTQUFTO0FBQUEsTUFDdEI7QUFBQSxNQUNBO0FBQUEsTUFDQSxPQUFPLE9BQU8sS0FBSztBQUFBLE1BQ25CLE1BQU07QUFBQSxNQUNOLFNBQVMsRUFBRSxXQUFXLE9BQU87QUFBQSxJQUMvQixDQUFDO0FBQUEsSUFDRCxPQUFPLFFBQVEsTUFBTSxFQUFFLE1BQU0sQ0FBQztBQUFBLEVBQ2hDLENBQUM7QUFFRCxTQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0EsTUFBTTtBQUFBLE1BQ0o7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsWUFBWSxLQUFLLEtBQUssUUFBUSxLQUFLO0FBQUEsSUFDckM7QUFBQSxFQUNGO0FBQ0Y7QUFHQSxJQUFNLGdCQUFnQixPQUFPLFFBQWdCLFVBQXlCO0FBQ3BFLFFBQU0sUUFBa0MsRUFBRSxPQUFPO0FBQ2pELE1BQUksTUFBTSxPQUFRLE9BQU0sU0FBUyxNQUFNO0FBRXZDLFFBQU0sU0FBUyxNQUFNO0FBQUEsSUFDbkI7QUFBQSxJQUNBLEVBQUUsU0FBUyxzQkFBc0IsVUFBVSx1QkFBdUI7QUFBQSxJQUNsRTtBQUFBLEVBQ0Y7QUFDQSxTQUFPLEVBQUUsR0FBRyxRQUFRLE1BQU0sT0FBTyxLQUFLLElBQUksY0FBYyxFQUFFO0FBQzVEO0FBR0EsSUFBTSxtQkFBbUIsT0FDdkIsU0FDQSxVQUNHO0FBQ0gsUUFBTSxRQUFrQztBQUFBLElBQ3RDLFNBQVMsRUFBRSxRQUFRO0FBQUEsRUFDckI7QUFDQSxNQUFJLE1BQU0sT0FBUSxPQUFNLFNBQVMsTUFBTTtBQUN2QyxNQUFJLE1BQU0sUUFBUTtBQUNoQixVQUFNLFVBQVU7QUFBQSxNQUNkO0FBQUEsTUFDQSxPQUFPLEVBQUUsVUFBVSxNQUFNLFFBQVEsTUFBTSxjQUFjO0FBQUEsSUFDdkQ7QUFBQSxFQUNGO0FBRUEsUUFBTSxTQUFTLE1BQU07QUFBQSxJQUNuQjtBQUFBLElBQ0EsRUFBRSxTQUFTLHNCQUFzQixVQUFVLHVCQUF1QjtBQUFBLElBQ2xFO0FBQUEsRUFDRjtBQUNBLFNBQU8sRUFBRSxHQUFHLFFBQVEsTUFBTSxPQUFPLEtBQUssSUFBSSxjQUFjLEVBQUU7QUFDNUQ7QUFHQSxJQUFNLGlCQUFpQixPQUFPLFVBQStCO0FBQzNELFFBQU0sUUFBa0MsQ0FBQztBQUN6QyxNQUFJLE1BQU0sT0FBUSxPQUFNLFNBQVMsTUFBTTtBQUN2QyxNQUFJLE1BQU0sUUFBUTtBQUNoQixVQUFNLFVBQVUsRUFBRSxPQUFPLEVBQUUsVUFBVSxNQUFNLFFBQVEsTUFBTSxjQUFjLEVBQUU7QUFBQSxFQUMzRTtBQUVBLFFBQU0sU0FBUyxNQUFNO0FBQUEsSUFDbkI7QUFBQSxJQUNBO0FBQUEsTUFDRSxTQUFTO0FBQUEsTUFDVCxNQUFNO0FBQUEsTUFDTixVQUFVO0FBQUEsSUFDWjtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQ0EsU0FBTyxFQUFFLEdBQUcsUUFBUSxNQUFNLE9BQU8sS0FBSyxJQUFJLGNBQWMsRUFBRTtBQUM1RDtBQUdBLElBQU0sbUJBQW1CLE9BQU8sSUFBWSxVQUF3QjtBQUNsRSxRQUFNLFVBQVUsTUFBTSxPQUFPLFFBQVEsV0FBVztBQUFBLElBQzlDLE9BQU8sRUFBRSxHQUFHO0FBQUEsSUFDWixTQUFTO0FBQUEsTUFDUCxTQUFTO0FBQUEsTUFDVCxNQUFNO0FBQUEsTUFDTixVQUFVO0FBQUEsSUFDWjtBQUFBLEVBQ0YsQ0FBQztBQUVELE1BQUksQ0FBQyxTQUFTO0FBQ1osVUFBTSxJQUFJLFNBQVMsS0FBSyxvQkFBb0I7QUFBQSxFQUM5QztBQUNBLE1BQUksQ0FBQyxVQUFVLFNBQVMsS0FBSyxHQUFHO0FBQzlCLFVBQU0sSUFBSSxTQUFTLEtBQUssOENBQThDO0FBQUEsRUFDeEU7QUFFQSxTQUFPLGVBQWUsT0FBTztBQUMvQjtBQWVBLElBQU0sZUFBZSxPQUNuQixXQUNBLFFBQ21DO0FBQ25DLFFBQU0sV0FBVyxNQUFNLE9BQU8sUUFBUSxTQUFTO0FBQUEsSUFDN0MsT0FBTyxFQUFFLFdBQVcsUUFBUSxjQUFjLFNBQVMsbUJBQW1CLEtBQUs7QUFBQSxFQUM3RSxDQUFDO0FBQ0QsTUFBSSxTQUFTLFdBQVcsRUFBRyxRQUFPO0FBRWxDLE1BQUksZUFBZTtBQUNuQixNQUFJLGVBQThCO0FBQ2xDLE1BQUksZ0JBQWdCO0FBQ3BCLFFBQU0sYUFBdUIsQ0FBQztBQUU5QixhQUFXLFdBQVcsVUFBVTtBQUM5QixRQUFJLENBQUMsUUFBUSxZQUFZO0FBQ3ZCLHFCQUFlO0FBQ2YsdUJBQWlCO0FBQ2pCLFlBQU0sT0FBTyxRQUFRLFdBQVc7QUFBQSxRQUM5QixPQUFPLEVBQUUsSUFBSSxRQUFRLElBQUksUUFBUSxjQUFjLFFBQVE7QUFBQSxRQUN2RCxNQUFNLEVBQUUsbUJBQW1CLG9CQUFJLEtBQUssRUFBRTtBQUFBLE1BQ3hDLENBQUM7QUFDRDtBQUFBLElBQ0Y7QUFFQSxRQUFJO0FBQ0YsWUFBTSxVQUFVLE1BQU0saUJBQWlCO0FBQUEsUUFDckMsY0FBYyxRQUFRO0FBQUEsUUFDdEIsZUFBZSxPQUFPLFFBQVEsTUFBTTtBQUFBLFFBQ3BDLGdCQUFnQixXQUFXLFNBQVM7QUFBQSxRQUNwQyxTQUFTO0FBQUEsTUFDWCxDQUFDO0FBSUQsWUFBTSxVQUFVLE1BQU0sT0FBTyxRQUFRLFdBQVc7QUFBQSxRQUM5QyxPQUFPLEVBQUUsSUFBSSxRQUFRLElBQUksUUFBUSxjQUFjLFFBQVE7QUFBQSxRQUN2RCxNQUFNO0FBQUEsVUFDSixRQUFRLGNBQWM7QUFBQSxVQUN0QixhQUFhLFFBQVEsaUJBQWlCLFFBQVEsZUFBZTtBQUFBLFVBQzdELG1CQUFtQixvQkFBSSxLQUFLO0FBQUEsUUFDOUI7QUFBQSxNQUNGLENBQUM7QUFFRCxVQUFJLFFBQVEsVUFBVSxFQUFHO0FBQ3pCLHVCQUFpQixPQUFPLFFBQVEsTUFBTTtBQUN0QyxVQUFJLFFBQVEsY0FBZSxZQUFXLEtBQUssUUFBUSxhQUFhO0FBQUEsSUFDbEUsU0FBUyxPQUFPO0FBQ2QscUJBQWU7QUFDZix1QkFDRSxpQkFBaUIsUUFBUSxNQUFNLFVBQVUsT0FBTyxLQUFLO0FBRXZELFlBQU0sT0FBTyxRQUFRLFdBQVc7QUFBQSxRQUM5QixPQUFPLEVBQUUsSUFBSSxRQUFRLElBQUksUUFBUSxjQUFjLFFBQVE7QUFBQSxRQUN2RCxNQUFNLEVBQUUsbUJBQW1CLG9CQUFJLEtBQUssRUFBRTtBQUFBLE1BQ3hDLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUVBLE1BQUksV0FBVyxTQUFTLEdBQUc7QUFDekIsU0FBSyxRQUFRLFdBQVc7QUFBQSxNQUN0QixnQkFBZ0I7QUFBQSxRQUNkLE9BQU8sSUFBSTtBQUFBLFFBQ1gsTUFBTSxJQUFJO0FBQUEsUUFDVixjQUFjLElBQUk7QUFBQSxRQUNsQixZQUFZLElBQUk7QUFBQSxRQUNoQixRQUFRO0FBQUEsUUFDUixhQUFhLFdBQVcsQ0FBQztBQUFBLE1BQzNCLENBQUM7QUFBQSxJQUNILENBQUM7QUFBQSxFQUNIO0FBRUEsU0FBTyxlQUNILEVBQUUsUUFBUSxVQUFVLElBQ3BCLEVBQUUsUUFBUSxVQUFVLFNBQVMsZ0JBQWdCLGlDQUFpQztBQUNwRjtBQUdBLElBQU0sc0JBQXNCLE9BQzFCLElBQ0EsU0FDQSxVQUNHO0FBQ0gsUUFBTSxFQUFFLFFBQVEsR0FBRyxJQUFJO0FBRXZCLFFBQU0sVUFBVSxNQUFNLE9BQU8sUUFBUSxXQUFXO0FBQUEsSUFDOUMsT0FBTyxFQUFFLEdBQUc7QUFBQSxJQUNaLFNBQVM7QUFBQSxNQUNQLFNBQVM7QUFBQSxRQUNQLFFBQVEsRUFBRSxJQUFJLE1BQU0sU0FBUyxNQUFNLE9BQU8sS0FBSztBQUFBLE1BQ2pEO0FBQUEsTUFDQSxNQUFNO0FBQUEsSUFDUjtBQUFBLEVBQ0YsQ0FBQztBQUVELE1BQUksQ0FBQyxTQUFTO0FBQ1osVUFBTSxJQUFJLFNBQVMsS0FBSyxvQkFBb0I7QUFBQSxFQUM5QztBQUVBLE1BQUksQ0FBQyxVQUFVLFNBQVMsS0FBSyxHQUFHO0FBQzlCLFVBQU0sSUFBSSxTQUFTLEtBQUssZ0RBQWdEO0FBQUEsRUFDMUU7QUFFQSxRQUFNLE9BQU8sWUFBWSxRQUFRLE1BQU0sSUFBSSxFQUFFO0FBQzdDLE1BQUksQ0FBQyxNQUFNO0FBQ1QsVUFBTSxJQUFJO0FBQUEsTUFDUjtBQUFBLE1BQ0Esa0NBQWtDLFFBQVEsTUFBTSxPQUFPLEVBQUU7QUFBQSxJQUMzRDtBQUFBLEVBQ0Y7QUFDQSxNQUFJLENBQUMsS0FBSyxRQUFRLFNBQVMsS0FBSyxHQUFHO0FBQ2pDLFVBQU0sSUFBSSxTQUFTLEtBQUssZ0RBQWdEO0FBQUEsRUFDMUU7QUFFQSxRQUFNLFlBQVksY0FBYyxRQUFRLFVBQVUsRUFBRSxRQUFRO0FBQzVELFFBQU0sTUFBTSxLQUFLLElBQUk7QUFDckIsTUFBSSxLQUFLLDRCQUE0QixZQUFZLEtBQUs7QUFDcEQsVUFBTSxJQUFJO0FBQUEsTUFDUjtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNBLE1BQUksS0FBSyxvQkFBb0IsYUFBYSxLQUFLO0FBQzdDLFVBQU0sSUFBSTtBQUFBLE1BQ1I7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFJQSxRQUFNLFVBQVUsTUFBTSxPQUFPLGFBQWEsT0FBTyxPQUFPO0FBQ3RELFVBQU0sU0FBUyxNQUFNLEdBQUcsUUFBUSxXQUFXO0FBQUEsTUFDekMsT0FBTyxFQUFFLElBQUksUUFBUSxRQUFRLE9BQU87QUFBQSxNQUNwQyxNQUFNLEVBQUUsUUFBUSxHQUFHO0FBQUEsSUFDckIsQ0FBQztBQUNELFFBQUksT0FBTyxVQUFVLEdBQUc7QUFDdEIsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQU1BLFFBQUksT0FBTyxjQUFjLFdBQVc7QUFDbEMsWUFBTSxHQUFHLFFBQVEsV0FBVztBQUFBLFFBQzFCLE9BQU8sRUFBRSxXQUFXLElBQUksUUFBUSxjQUFjLFVBQVU7QUFBQSxRQUN4RCxNQUFNLEVBQUUsUUFBUSxjQUFjLFVBQVU7QUFBQSxNQUMxQyxDQUFDO0FBQUEsSUFDSDtBQUVBLFdBQU8sR0FBRyxRQUFRLFdBQVcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFBQSxFQUNoRCxDQUFDO0FBRUQsTUFBSSxDQUFDLFNBQVM7QUFDWixVQUFNLElBQUksU0FBUyxLQUFLLG9CQUFvQjtBQUFBLEVBQzlDO0FBS0EsTUFBSSxTQUFnQztBQUNwQyxNQUFJLE9BQU8sY0FBYyxXQUFXO0FBQ2xDLGFBQVMsTUFBTSxhQUFhLElBQUk7QUFBQSxNQUM5QixPQUFPLFFBQVEsS0FBSztBQUFBLE1BQ3BCLE1BQU0sUUFBUSxLQUFLO0FBQUEsTUFDbkIsY0FBYyxRQUFRLFFBQVE7QUFBQSxNQUM5QixZQUFZLFFBQVE7QUFBQSxJQUN0QixDQUFDO0FBQUEsRUFDSDtBQUdBLE1BQUksT0FBTyxjQUFjLGFBQWEsT0FBTyxjQUFjLFdBQVc7QUFDcEUsU0FBSyxRQUFRLFdBQVc7QUFBQSxNQUN0QixpQkFBaUI7QUFBQSxRQUNmLE9BQU8sUUFBUSxLQUFLO0FBQUEsUUFDcEIsTUFBTSxRQUFRLEtBQUs7QUFBQSxRQUNuQixjQUFjLFFBQVEsUUFBUTtBQUFBLFFBQzlCLFlBQVksUUFBUTtBQUFBLFFBQ3BCLFdBQVcsUUFBUTtBQUFBLFFBQ25CLFlBQVksT0FBTyxRQUFRLFVBQVU7QUFBQSxRQUNyQyxRQUFRO0FBQUEsTUFDVixDQUFDO0FBQUEsSUFDSCxDQUFDO0FBQUEsRUFDSDtBQU1BLE1BQUksT0FBTyxjQUFjLFdBQVc7QUFDbEMsU0FBSyxRQUFRLFdBQVc7QUFBQSxNQUN0QjtBQUFBLFFBQ0UsUUFBUTtBQUFBLFFBQ1IsaUJBQWlCO0FBQUEsUUFDakI7QUFBQSxRQUNBLHFCQUFxQixRQUFRLFFBQVEsS0FBSztBQUFBLFFBQzFDLHVCQUF1QixFQUFFO0FBQUEsTUFDM0I7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBRUEsTUFBSSxPQUFPLGNBQWMsV0FBVztBQUNsQyxVQUFNLGFBQXVCLENBQUM7QUFDOUIsUUFBSSxNQUFNLE9BQU8sUUFBUSxRQUFRO0FBQy9CLGlCQUFXLEtBQUssUUFBUSxRQUFRLE9BQU87QUFBQSxJQUN6QyxXQUNFLE1BQU0sU0FBUyxLQUFLLFNBQ3BCLFFBQVEsUUFBUSxZQUFZLE1BQU0sSUFDbEM7QUFDQSxpQkFBVyxLQUFLLFFBQVEsTUFBTTtBQUFBLElBQ2hDLFdBQVcsTUFBTSxTQUFTLEtBQUssT0FBTztBQUNwQyxpQkFBVyxLQUFLLFFBQVEsUUFBUSxRQUFRLFFBQVEsT0FBTztBQUFBLElBQ3pEO0FBRUEsU0FBSyxRQUFRO0FBQUEsTUFDWCxDQUFDLEdBQUcsSUFBSSxJQUFJLFVBQVUsQ0FBQyxFQUFFO0FBQUEsUUFBSSxDQUFDLGdCQUM1QjtBQUFBLFVBQ0U7QUFBQSxVQUNBLGlCQUFpQjtBQUFBLFVBQ2pCO0FBQUEsVUFDQSxvQkFBb0IsUUFBUSxRQUFRLEtBQUs7QUFBQSxVQUN6Qyx1QkFBdUIsRUFBRTtBQUFBLFFBQzNCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBRUEsU0FBTztBQUFBLElBQ0wsR0FBRztBQUFBLElBQ0gsWUFBWSxPQUFPLFFBQVEsVUFBVTtBQUFBLElBQ3JDLEdBQUksU0FBUyxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQUEsRUFDN0I7QUFDRjtBQUVPLElBQU0saUJBQWlCO0FBQUEsRUFDNUI7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNGOzs7QUgvbEJBLElBQU1DLGlCQUFnQjtBQUFBLEVBQ3BCLE9BQU8sS0FBYyxLQUFlLFNBQXVCO0FBQ3pELFVBQU0sU0FBUyxJQUFJLE1BQU07QUFFekIsVUFBTSxVQUFVLE1BQU0sZUFBZSxjQUFjLFFBQVEsSUFBSSxJQUFJO0FBRW5FLGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZQyxZQUFXO0FBQUEsTUFDdkIsU0FBUztBQUFBLE1BQ1QsTUFBTTtBQUFBLElBQ1IsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUVBLElBQU1DLGlCQUFnQjtBQUFBLEVBQ3BCLE9BQU8sS0FBYyxLQUFlLFNBQXVCO0FBQ3pELFVBQU0sU0FBUyxJQUFJLE1BQU07QUFFekIsVUFBTSxTQUFTLE1BQU0sZUFBZSxjQUFjLFFBQVEsSUFBSSxLQUFLO0FBRW5FLGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZRCxZQUFXO0FBQUEsTUFDdkIsU0FBUztBQUFBLE1BQ1QsTUFBTSxPQUFPO0FBQUEsTUFDYixNQUFNLE9BQU87QUFBQSxJQUNmLENBQUM7QUFBQSxFQUNIO0FBQ0Y7QUFFQSxJQUFNRSxvQkFBbUI7QUFBQSxFQUN2QixPQUFPLEtBQWMsS0FBZSxTQUF1QjtBQUN6RCxVQUFNLFNBQVMsSUFBSSxNQUFNO0FBRXpCLFVBQU0sU0FBUyxNQUFNLGVBQWUsaUJBQWlCLFFBQVEsSUFBSSxLQUFLO0FBRXRFLGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZRixZQUFXO0FBQUEsTUFDdkIsU0FBUztBQUFBLE1BQ1QsTUFBTSxPQUFPO0FBQUEsTUFDYixNQUFNLE9BQU87QUFBQSxJQUNmLENBQUM7QUFBQSxFQUNIO0FBQ0Y7QUFFQSxJQUFNRyxvQkFBbUI7QUFBQSxFQUN2QixPQUFPLEtBQWMsS0FBZSxTQUF1QjtBQUN6RCxVQUFNLEtBQUssT0FBTyxJQUFJLE9BQU8sRUFBRTtBQUUvQixVQUFNLFVBQVUsTUFBTSxlQUFlLGlCQUFpQixJQUFJLElBQUksSUFBSztBQUVuRSxpQkFBYSxLQUFLO0FBQUEsTUFDaEIsU0FBUztBQUFBLE1BQ1QsWUFBWUgsWUFBVztBQUFBLE1BQ3ZCLFNBQVM7QUFBQSxNQUNULE1BQU07QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNIO0FBQ0Y7QUFFQSxJQUFNSSxrQkFBaUI7QUFBQSxFQUNyQixPQUFPLEtBQWMsS0FBZSxTQUF1QjtBQUN6RCxVQUFNLFNBQVMsTUFBTSxlQUFlLGVBQWUsSUFBSSxLQUFLO0FBRTVELGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZSixZQUFXO0FBQUEsTUFDdkIsU0FBUztBQUFBLE1BQ1QsTUFBTSxPQUFPO0FBQUEsTUFDYixNQUFNLE9BQU87QUFBQSxJQUNmLENBQUM7QUFBQSxFQUNIO0FBQ0Y7QUFFQSxJQUFNSyx1QkFBc0I7QUFBQSxFQUMxQixPQUFPLEtBQWMsS0FBZSxTQUF1QjtBQUN6RCxVQUFNLEtBQUssT0FBTyxJQUFJLE9BQU8sRUFBRTtBQUUvQixVQUFNLFVBQVUsTUFBTSxlQUFlO0FBQUEsTUFDbkM7QUFBQSxNQUNBLElBQUk7QUFBQSxNQUNKLElBQUk7QUFBQSxJQUNOO0FBRUEsaUJBQWEsS0FBSztBQUFBLE1BQ2hCLFNBQVM7QUFBQSxNQUNULFlBQVlMLFlBQVc7QUFBQSxNQUN2QixTQUFTO0FBQUEsTUFDVCxNQUFNO0FBQUEsSUFDUixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBRU8sSUFBTSxvQkFBb0I7QUFBQSxFQUMvQixlQUFBRDtBQUFBLEVBQ0EsZUFBQUU7QUFBQSxFQUNBLGtCQUFBQztBQUFBLEVBQ0Esa0JBQUFDO0FBQUEsRUFDQSxnQkFBQUM7QUFBQSxFQUNBLHFCQUFBQztBQUNGOzs7QUk1R0EsU0FBUyxLQUFBQyxVQUFTO0FBR2xCLElBQU0sZUFBZUMsR0FBRSxPQUFPO0FBQUEsRUFDNUIsV0FBV0EsR0FBRSxPQUFPLEVBQUUsZ0JBQWdCLHlCQUF5QixDQUFDLEVBQUUsSUFBSSxDQUFDO0FBQUEsRUFDdkUsWUFBWUEsR0FBRSxPQUFPLEtBQUs7QUFBQSxJQUN4QixnQkFBZ0I7QUFBQSxJQUNoQixvQkFBb0I7QUFBQSxFQUN0QixDQUFDLEVBQUU7QUFBQSxJQUNELENBQUMsU0FBUztBQUNSLFlBQU0sUUFBUSxvQkFBSSxLQUFLO0FBQ3ZCLFlBQU0sWUFBWSxJQUFJO0FBQUEsUUFDcEIsS0FBSztBQUFBLFVBQ0gsS0FBSyxlQUFlO0FBQUEsVUFDcEIsS0FBSyxZQUFZO0FBQUEsVUFDakIsS0FBSyxXQUFXO0FBQUEsUUFDbEI7QUFBQSxNQUNGO0FBQ0EsWUFBTSxXQUFXLElBQUk7QUFBQSxRQUNuQixLQUFLO0FBQUEsVUFDSCxNQUFNLGVBQWU7QUFBQSxVQUNyQixNQUFNLFlBQVk7QUFBQSxVQUNsQixNQUFNLFdBQVc7QUFBQSxRQUNuQjtBQUFBLE1BQ0Y7QUFDQSxhQUFPLFVBQVUsUUFBUSxLQUFLLFNBQVMsUUFBUTtBQUFBLElBQ2pEO0FBQUEsSUFDQSxFQUFFLFNBQVMscUNBQXFDO0FBQUEsRUFDbEQ7QUFBQSxFQUNBLFdBQVdBLEdBQ1IsT0FBTyxFQUFFLGdCQUFnQix3QkFBd0IsQ0FBQyxFQUNsRCxJQUFJLGtDQUFrQyxFQUN0QyxJQUFJLEdBQUcsOEJBQThCLEVBQ3JDLElBQUksSUFBSSw4QkFBOEI7QUFDM0MsQ0FBQztBQUVELElBQU0sc0JBQXNCQSxHQUFFLE9BQU87QUFBQSxFQUNuQyxJQUFJQSxHQUFFLE9BQU8sRUFBRSxnQkFBZ0IseUJBQXlCLENBQUMsRUFBRSxJQUFJLENBQUM7QUFDbEUsQ0FBQztBQUVELElBQU0scUJBQXFCQSxHQUFFLE9BQU87QUFBQSxFQUNsQyxNQUFNQSxHQUFFLE9BQU8sT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxRQUFRLENBQUM7QUFBQSxFQUM5QyxPQUFPQSxHQUFFLE9BQU8sT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUU7QUFBQSxFQUN4RCxRQUFRQSxHQUFFLFdBQVcsYUFBYSxFQUFFLFNBQVM7QUFDL0MsQ0FBQztBQUVELElBQU0sMkJBQTJCLG1CQUFtQixPQUFPO0FBQUEsRUFDekQsUUFBUUEsR0FBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFNBQVM7QUFDckMsQ0FBQztBQUVELElBQU0scUJBQXFCQSxHQUFFLE9BQU87QUFBQSxFQUNsQyxRQUFRQSxHQUFFLFdBQVcsZUFBZTtBQUFBLElBQ2xDLGdCQUFnQjtBQUFBLEVBQ2xCLENBQUM7QUFDSCxDQUFDO0FBT00sSUFBTSxxQkFBcUI7QUFBQSxFQUNoQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjs7O0FMNURBLElBQU1DLFVBQVNDLFFBQU87QUFHdEJELFFBQU87QUFBQSxFQUNMO0FBQUEsRUFDQSxhQUFLLEtBQUssSUFBSTtBQUFBLEVBQ2Qsd0JBQWdCLEVBQUUsTUFBTSxtQkFBbUIsYUFBYSxDQUFDO0FBQUEsRUFDekQsa0JBQWtCO0FBQ3BCO0FBSUFBLFFBQU87QUFBQSxFQUNMO0FBQUEsRUFDQSxhQUFLLEtBQUssSUFBSTtBQUFBLEVBQ2Qsd0JBQWdCLEVBQUUsT0FBTyxtQkFBbUIsbUJBQW1CLENBQUM7QUFBQSxFQUNoRSxrQkFBa0I7QUFDcEI7QUFHQUEsUUFBTztBQUFBLEVBQ0w7QUFBQSxFQUNBLGFBQUssS0FBSyxLQUFLO0FBQUEsRUFDZix3QkFBZ0IsRUFBRSxPQUFPLG1CQUFtQix5QkFBeUIsQ0FBQztBQUFBLEVBQ3RFLGtCQUFrQjtBQUNwQjtBQUdBQSxRQUFPO0FBQUEsRUFDTDtBQUFBLEVBQ0EsYUFBSztBQUFBLEVBQ0wsd0JBQWdCLEVBQUUsUUFBUSxtQkFBbUIsb0JBQW9CLENBQUM7QUFBQSxFQUNsRSxrQkFBa0I7QUFDcEI7QUFHQUEsUUFBTztBQUFBLEVBQ0w7QUFBQSxFQUNBLGFBQUssS0FBSyxLQUFLO0FBQUEsRUFDZix3QkFBZ0IsRUFBRSxPQUFPLG1CQUFtQix5QkFBeUIsQ0FBQztBQUFBLEVBQ3RFLGtCQUFrQjtBQUNwQjtBQUdBQSxRQUFPO0FBQUEsRUFDTDtBQUFBLEVBQ0EsYUFBSztBQUFBLEVBQ0wsd0JBQWdCO0FBQUEsSUFDZCxRQUFRLG1CQUFtQjtBQUFBLElBQzNCLE1BQU0sbUJBQW1CO0FBQUEsRUFDM0IsQ0FBQztBQUFBLEVBQ0Qsa0JBQWtCO0FBQ3BCO0FBRU8sSUFBTSxnQkFBZ0JBOzs7QU03RDdCLFNBQVMsVUFBQUUsZUFBYzs7O0FDQ3ZCLE9BQU9DLGlCQUFnQjs7O0FDYXZCLElBQU0seUJBQXlCLE9BQzdCLElBQ0EsY0FDb0I7QUFDcEIsUUFBTSxFQUFFLEtBQUssSUFBSSxNQUFNLEdBQUcsT0FBTyxVQUFVO0FBQUEsSUFDekMsT0FBTyxFQUFFLFdBQVcsV0FBVyxNQUFNO0FBQUEsSUFDckMsTUFBTSxFQUFFLFFBQVEsS0FBSztBQUFBLEVBQ3ZCLENBQUM7QUFFRCxRQUFNLFNBQVMsS0FBSyxPQUFPLEtBQUssVUFBVSxLQUFLLEVBQUUsSUFBSTtBQUVyRCxRQUFNLEdBQUcsWUFBWSxPQUFPO0FBQUEsSUFDMUIsT0FBTyxFQUFFLElBQUksVUFBVTtBQUFBLElBQ3ZCLE1BQU0sRUFBRSxPQUFPO0FBQUEsRUFDakIsQ0FBQztBQUVELFNBQU87QUFDVDtBQUlBLElBQU0sZUFBZSxPQUFPLFFBQWdCLFlBQWtDO0FBQzVFLFNBQU8sT0FBTyxhQUFhLE9BQU8sT0FBTztBQUd2QyxVQUFNLGNBQWMsTUFBTSxHQUFHLFlBQVksVUFBVTtBQUFBLE1BQ2pELE9BQU87QUFBQSxRQUNMLElBQUksUUFBUTtBQUFBLFFBQ1osUUFBUSxjQUFjO0FBQUEsUUFDdEIsV0FBVztBQUFBLE1BQ2I7QUFBQSxNQUNBLFFBQVEsRUFBRSxJQUFJLE1BQU0sU0FBUyxLQUFLO0FBQUEsSUFDcEMsQ0FBQztBQUVELFFBQUksQ0FBQyxhQUFhO0FBQ2hCLFlBQU0sSUFBSSxTQUFTLEtBQUssb0JBQW9CO0FBQUEsSUFDOUM7QUFHQSxRQUFJLFlBQVksWUFBWSxRQUFRO0FBQ2xDLFlBQU0sSUFBSSxTQUFTLEtBQUsscUNBQXFDO0FBQUEsSUFDL0Q7QUFHQSxVQUFNLG1CQUFtQixNQUFNLEdBQUcsUUFBUSxVQUFVO0FBQUEsTUFDbEQsT0FBTztBQUFBLFFBQ0w7QUFBQSxRQUNBLFdBQVcsUUFBUTtBQUFBLFFBQ25CLFFBQVEsY0FBYztBQUFBLE1BQ3hCO0FBQUEsTUFDQSxRQUFRLEVBQUUsSUFBSSxLQUFLO0FBQUEsSUFDckIsQ0FBQztBQUVELFFBQUksQ0FBQyxrQkFBa0I7QUFDckIsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQU1BLFVBQU0saUJBQWlCLE1BQU0sR0FBRyxPQUFPLFVBQVU7QUFBQSxNQUMvQyxPQUFPLEVBQUUsUUFBUSxXQUFXLFFBQVEsVUFBVTtBQUFBLE1BQzlDLFFBQVEsRUFBRSxJQUFJLEtBQUs7QUFBQSxJQUNyQixDQUFDO0FBRUQsUUFBSSxnQkFBZ0I7QUFDbEIsWUFBTSxJQUFJLFNBQVMsS0FBSyx5Q0FBeUM7QUFBQSxJQUNuRTtBQUVBLFVBQU0sZ0JBQWdCLE1BQU0sR0FBRyxPQUFPLE9BQU87QUFBQSxNQUMzQyxNQUFNO0FBQUEsUUFDSjtBQUFBLFFBQ0EsV0FBVyxRQUFRO0FBQUEsUUFDbkIsUUFBUSxRQUFRO0FBQUEsUUFDaEIsU0FBUyxRQUFRO0FBQUEsTUFDbkI7QUFBQSxJQUNGLENBQUM7QUFFRCxVQUFNLFNBQVMsTUFBTSx1QkFBdUIsSUFBSSxRQUFRLFNBQVM7QUFFakUsV0FBTyxFQUFFLFFBQVEsZUFBZSxPQUFPO0FBQUEsRUFDekMsQ0FBQztBQUNIO0FBS0EsSUFBTSxxQkFBcUIsT0FDekIsV0FDQSxVQUNHO0FBQ0gsUUFBTSxjQUFjLE1BQU0sT0FBTyxZQUFZLFVBQVU7QUFBQSxJQUNyRCxPQUFPO0FBQUEsTUFDTCxJQUFJO0FBQUEsTUFDSixRQUFRLGNBQWM7QUFBQSxNQUN0QixXQUFXO0FBQUEsSUFDYjtBQUFBLElBQ0EsUUFBUSxFQUFFLElBQUksS0FBSztBQUFBLEVBQ3JCLENBQUM7QUFFRCxNQUFJLENBQUMsYUFBYTtBQUNoQixVQUFNLElBQUksU0FBUyxLQUFLLG9CQUFvQjtBQUFBLEVBQzlDO0FBRUEsUUFBTSxPQUFPLE1BQU0sUUFBUTtBQUMzQixRQUFNLFFBQVEsTUFBTSxTQUFTO0FBQzdCLFFBQU0sUUFBUSxPQUFPLEtBQUs7QUFFMUIsUUFBTSxRQUFRLEVBQUUsV0FBVyxXQUFXLE1BQU07QUFFNUMsUUFBTSxDQUFDLE1BQU0sS0FBSyxJQUFJLE1BQU0sUUFBUSxJQUFJO0FBQUEsSUFDdEMsT0FBTyxPQUFPLFNBQVM7QUFBQSxNQUNyQjtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sSUFBSTtBQUFBLFFBQ0osUUFBUTtBQUFBLFFBQ1IsU0FBUztBQUFBLFFBQ1QsV0FBVztBQUFBLFFBQ1gsV0FBVztBQUFBLFFBQ1gsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLE1BQU0sV0FBVyxLQUFLLEVBQUU7QUFBQSxNQUNsRDtBQUFBLE1BQ0EsU0FBUyxFQUFFLFdBQVcsT0FBTztBQUFBLE1BQzdCO0FBQUEsTUFDQSxNQUFNO0FBQUEsSUFDUixDQUFDO0FBQUEsSUFDRCxPQUFPLE9BQU8sTUFBTSxFQUFFLE1BQU0sQ0FBQztBQUFBLEVBQy9CLENBQUM7QUFFRCxTQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0EsTUFBTTtBQUFBLE1BQ0o7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsWUFBWSxLQUFLLEtBQUssUUFBUSxLQUFLO0FBQUEsSUFDckM7QUFBQSxFQUNGO0FBQ0Y7QUFLQSxJQUFNLGVBQWUsT0FDbkIsUUFDQSxVQUNBLFlBQ0c7QUFDSCxTQUFPLE9BQU8sYUFBYSxPQUFPLE9BQU87QUFDdkMsVUFBTSxXQUFXLE1BQU0sR0FBRyxPQUFPLFVBQVU7QUFBQSxNQUN6QyxPQUFPLEVBQUUsSUFBSSxVQUFVLFFBQVEsV0FBVyxNQUFNO0FBQUEsTUFDaEQsUUFBUSxFQUFFLElBQUksTUFBTSxXQUFXLEtBQUs7QUFBQSxJQUN0QyxDQUFDO0FBRUQsUUFBSSxDQUFDLFVBQVU7QUFDYixZQUFNLElBQUksU0FBUyxLQUFLLG1CQUFtQjtBQUFBLElBQzdDO0FBRUEsVUFBTSxVQUFVLE1BQU0sR0FBRyxPQUFPLE9BQU87QUFBQSxNQUNyQyxPQUFPLEVBQUUsSUFBSSxTQUFTO0FBQUEsTUFDdEIsTUFBTTtBQUFBLFFBQ0osR0FBSSxRQUFRLFdBQVcsU0FBWSxFQUFFLFFBQVEsUUFBUSxPQUFPLElBQUksQ0FBQztBQUFBLFFBQ2pFLEdBQUksUUFBUSxZQUFZLFNBQVksRUFBRSxTQUFTLFFBQVEsUUFBUSxJQUFJLENBQUM7QUFBQSxNQUN0RTtBQUFBLElBQ0YsQ0FBQztBQUVELFVBQU0sdUJBQXVCLElBQUksU0FBUyxTQUFTO0FBSW5ELFVBQU0sUUFBUSxNQUFNLEdBQUcsWUFBWSxXQUFXO0FBQUEsTUFDNUMsT0FBTyxFQUFFLElBQUksU0FBUyxVQUFVO0FBQUEsTUFDaEMsUUFBUSxFQUFFLFFBQVEsS0FBSztBQUFBLElBQ3pCLENBQUM7QUFFRCxXQUFPLEVBQUUsUUFBUSxTQUFTLFFBQVEsT0FBTyxVQUFVLEVBQUU7QUFBQSxFQUN2RCxDQUFDO0FBQ0g7QUFJQSxJQUFNLGVBQWUsT0FDbkIsUUFDQSxNQUNBLGFBQ0c7QUFDSCxTQUFPLE9BQU8sYUFBYSxPQUFPLE9BQU87QUFDdkMsVUFBTSxXQUFXLE1BQU0sR0FBRyxPQUFPLFVBQVU7QUFBQSxNQUN6QyxPQUFPLEVBQUUsSUFBSSxVQUFVLFdBQVcsTUFBTTtBQUFBLE1BQ3hDLFFBQVEsRUFBRSxJQUFJLE1BQU0sV0FBVyxNQUFNLFFBQVEsS0FBSztBQUFBLElBQ3BELENBQUM7QUFFRCxRQUFJLENBQUMsVUFBVTtBQUNiLFlBQU0sSUFBSSxTQUFTLEtBQUssbUJBQW1CO0FBQUEsSUFDN0M7QUFFQSxRQUFJLFNBQVMsS0FBSyxTQUFTLFNBQVMsV0FBVyxRQUFRO0FBQ3JELFlBQU0sSUFBSSxTQUFTLEtBQUssbUJBQW1CO0FBQUEsSUFDN0M7QUFFQSxVQUFNLFVBQVUsTUFBTSxHQUFHLE9BQU8sV0FBVztBQUFBLE1BQ3pDLE9BQU8sRUFBRSxJQUFJLFVBQVUsV0FBVyxNQUFNO0FBQUEsTUFDeEMsTUFBTSxFQUFFLFdBQVcsS0FBSztBQUFBLElBQzFCLENBQUM7QUFFRCxRQUFJLFFBQVEsVUFBVSxHQUFHO0FBQ3ZCLFlBQU0sSUFBSSxTQUFTLEtBQUssbUJBQW1CO0FBQUEsSUFDN0M7QUFFQSxVQUFNLFNBQVMsTUFBTSx1QkFBdUIsSUFBSSxTQUFTLFNBQVM7QUFFbEUsV0FBTyxFQUFFLFVBQVUsT0FBTztBQUFBLEVBQzVCLENBQUM7QUFDSDtBQUVPLElBQU0sZ0JBQWdCO0FBQUEsRUFDM0I7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjs7O0FEdE9BLElBQU1DLGdCQUFlO0FBQUEsRUFDbkIsT0FBTyxLQUFjLEtBQWUsU0FBdUI7QUFDekQsVUFBTSxTQUFTLE9BQU8sSUFBSSxNQUFNLEVBQUU7QUFDbEMsVUFBTSxTQUFTLE1BQU0sY0FBYyxhQUFhLFFBQVEsSUFBSSxJQUFJO0FBRWhFLGlCQUFhLEtBQUs7QUFBQSxNQUNoQixTQUFTO0FBQUEsTUFDVCxZQUFZQyxZQUFXO0FBQUEsTUFDdkIsU0FBUztBQUFBLE1BQ1QsTUFBTTtBQUFBLElBQ1IsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUdBLElBQU0sb0JBQW9CO0FBQUEsRUFDeEIsT0FBTyxLQUFjLEtBQWUsU0FBdUI7QUFDekQsVUFBTSxZQUFZLE9BQU8sSUFBSSxPQUFPLFNBQVM7QUFDN0MsVUFBTSxTQUFTLE1BQU0sY0FBYyxtQkFBbUIsV0FBVyxJQUFJLEtBQUs7QUFFMUUsaUJBQWEsS0FBSztBQUFBLE1BQ2hCLFNBQVM7QUFBQSxNQUNULFlBQVlBLFlBQVc7QUFBQSxNQUN2QixTQUFTO0FBQUEsTUFDVCxNQUFNLE9BQU87QUFBQSxNQUNiLE1BQU0sT0FBTztBQUFBLElBQ2YsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUdBLElBQU1DLGdCQUFlO0FBQUEsRUFDbkIsT0FBTyxLQUFjLEtBQWUsU0FBdUI7QUFDekQsVUFBTSxTQUFTLE9BQU8sSUFBSSxNQUFNLEVBQUU7QUFDbEMsVUFBTSxLQUFLLE9BQU8sSUFBSSxPQUFPLEVBQUU7QUFDL0IsVUFBTSxTQUFTLE1BQU0sY0FBYyxhQUFhLFFBQVEsSUFBSSxJQUFJLElBQUk7QUFFcEUsaUJBQWEsS0FBSztBQUFBLE1BQ2hCLFNBQVM7QUFBQSxNQUNULFlBQVlELFlBQVc7QUFBQSxNQUN2QixTQUFTO0FBQUEsTUFDVCxNQUFNO0FBQUEsSUFDUixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBR0EsSUFBTUUsZ0JBQWU7QUFBQSxFQUNuQixPQUFPLEtBQWMsS0FBZSxTQUF1QjtBQUN6RCxVQUFNLFNBQVMsT0FBTyxJQUFJLE1BQU0sRUFBRTtBQUNsQyxVQUFNLE9BQU8sSUFBSSxLQUFNO0FBQ3ZCLFVBQU0sS0FBSyxPQUFPLElBQUksT0FBTyxFQUFFO0FBQy9CLFVBQU0sU0FBUyxNQUFNLGNBQWMsYUFBYSxRQUFRLE1BQU0sRUFBRTtBQUVoRSxpQkFBYSxLQUFLO0FBQUEsTUFDaEIsU0FBUztBQUFBLE1BQ1QsWUFBWUYsWUFBVztBQUFBLE1BQ3ZCLFNBQVM7QUFBQSxNQUNULE1BQU07QUFBQSxJQUNSLENBQUM7QUFBQSxFQUNIO0FBQ0Y7QUFFTyxJQUFNLG1CQUFtQjtBQUFBLEVBQzlCLGNBQUFEO0FBQUEsRUFDQTtBQUFBLEVBQ0EsY0FBQUU7QUFBQSxFQUNBLGNBQUFDO0FBQ0Y7OztBRTNFQSxTQUFTLEtBQUFDLFVBQVM7QUFFbEIsSUFBTSxxQkFBcUJBLEdBQ3hCLE9BQU87QUFBQSxFQUNOLFdBQVdBLEdBQ1IsT0FBTyxFQUFFLGdCQUFnQix5QkFBeUIsQ0FBQyxFQUNuRCxJQUFJLEdBQUcsOEJBQThCO0FBQUEsRUFDeEMsUUFBUUEsR0FDTCxPQUFPLEVBQUUsZ0JBQWdCLHFCQUFxQixDQUFDLEVBQy9DLElBQUksK0JBQStCLEVBQ25DLElBQUksR0FBRywyQkFBMkIsRUFDbEMsSUFBSSxHQUFHLDBCQUEwQjtBQUFBLEVBQ3BDLFNBQVNBLEdBQ04sT0FBTyxFQUFFLGdCQUFnQixzQkFBc0IsQ0FBQyxFQUNoRCxLQUFLLEVBQ0wsSUFBSSxHQUFHLDJCQUEyQixFQUNsQyxJQUFJLEtBQU0seUNBQXlDO0FBQ3hELENBQUMsRUFDQSxPQUFPO0FBRVYsSUFBTSxxQkFBcUJBLEdBQUUsT0FBTztBQUFBLEVBQ2xDLFdBQVdBLEdBQ1IsT0FBTyxFQUFFLGdCQUFnQix5QkFBeUIsQ0FBQyxFQUNuRCxJQUFJLEdBQUcsOEJBQThCO0FBQzFDLENBQUM7QUFFRCxJQUFNLG9CQUFvQkEsR0FBRSxPQUFPO0FBQUEsRUFDakMsTUFBTUEsR0FBRSxPQUFPLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQUEsRUFDOUMsT0FBT0EsR0FBRSxPQUFPLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFO0FBQzFELENBQUM7QUFFRCxJQUFNLHFCQUFxQkEsR0FDeEIsT0FBTztBQUFBLEVBQ04sUUFBUUEsR0FDTCxPQUFPLEVBQUUsb0JBQW9CLDBCQUEwQixDQUFDLEVBQ3hELElBQUksK0JBQStCLEVBQ25DLElBQUksR0FBRywyQkFBMkIsRUFDbEMsSUFBSSxHQUFHLDBCQUEwQixFQUNqQyxTQUFTO0FBQUEsRUFDWixTQUFTQSxHQUNOLE9BQU8sRUFBRSxvQkFBb0IsMkJBQTJCLENBQUMsRUFDekQsS0FBSyxFQUNMLElBQUksR0FBRywyQkFBMkIsRUFDbEMsSUFBSSxLQUFNLHlDQUF5QyxFQUNuRCxTQUFTO0FBQ2QsQ0FBQyxFQUNBLE9BQU8sRUFDUCxPQUFPLENBQUMsU0FBUyxLQUFLLFdBQVcsVUFBYSxLQUFLLFlBQVksUUFBVztBQUFBLEVBQ3pFLFNBQVM7QUFDWCxDQUFDO0FBRUgsSUFBTSx1QkFBdUJBLEdBQUUsT0FBTztBQUFBLEVBQ3BDLElBQUlBLEdBQ0QsT0FBTyxFQUFFLGdCQUFnQix3QkFBd0IsQ0FBQyxFQUNsRCxJQUFJLEdBQUcsNkJBQTZCO0FBQ3pDLENBQUM7QUFFTSxJQUFNLG9CQUFvQjtBQUFBLEVBQy9CO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNGOzs7QUh4REEsSUFBTUMsVUFBU0MsUUFBTztBQUd0QkQsUUFBTztBQUFBLEVBQ0w7QUFBQSxFQUNBLGFBQUssS0FBSyxJQUFJO0FBQUEsRUFDZCx3QkFBZ0IsRUFBRSxNQUFNLGtCQUFrQixtQkFBbUIsQ0FBQztBQUFBLEVBQzlELGlCQUFpQjtBQUNuQjtBQUdBQSxRQUFPO0FBQUEsRUFDTDtBQUFBLEVBQ0Esd0JBQWdCO0FBQUEsSUFDZCxRQUFRLGtCQUFrQjtBQUFBLElBQzFCLE9BQU8sa0JBQWtCO0FBQUEsRUFDM0IsQ0FBQztBQUFBLEVBQ0QsaUJBQWlCO0FBQ25CO0FBSUFBLFFBQU87QUFBQSxFQUNMO0FBQUEsRUFDQSxhQUFLLEtBQUssSUFBSTtBQUFBLEVBQ2Qsd0JBQWdCO0FBQUEsSUFDZCxRQUFRLGtCQUFrQjtBQUFBLElBQzFCLE1BQU0sa0JBQWtCO0FBQUEsRUFDMUIsQ0FBQztBQUFBLEVBQ0QsaUJBQWlCO0FBQ25CO0FBR0FBLFFBQU87QUFBQSxFQUNMO0FBQUEsRUFDQSxhQUFLO0FBQUEsRUFDTCx3QkFBZ0IsRUFBRSxRQUFRLGtCQUFrQixxQkFBcUIsQ0FBQztBQUFBLEVBQ2xFLGlCQUFpQjtBQUNuQjtBQUVPLElBQU0sZUFBZUE7OztBSS9DNUIsU0FBUyxVQUFBRSxlQUFjOzs7QUNDdkIsT0FBT0MsaUJBQWdCOzs7QUNFdkIsSUFBTSxrQkFBMEM7QUFBQSxFQUM5QyxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxRQUFHO0FBQUEsRUFDSCxjQUFJO0FBQUEsRUFDSixjQUFJO0FBQUEsRUFDSixjQUFJO0FBQUEsRUFDSixVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFLO0FBQUEsRUFDTCxVQUFL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QUFDckMsSUFBSSxJQUFJLG1CQUFtQixjQUFjO0FBQ3pDLElBQUksSUFBSSxpQkFBaUIsYUFBYTtBQUN0QyxJQUFJLElBQUksZ0JBQWdCLFlBQVk7QUFDcEMsSUFBSSxJQUFJLGlCQUFpQixhQUFhO0FBQ3RDLElBQUksSUFBSSxhQUFhLFVBQVU7QUFDL0IsSUFBSSxJQUFJLGtCQUFrQixlQUFlO0FBQ3pDLElBQUksSUFBSSxpQkFBaUIsYUFBYTtBQUN0QyxJQUFJLElBQUksaUJBQWlCLGNBQWM7QUFDdkMsSUFBSSxJQUFJLHNCQUFzQixrQkFBa0I7QUFFaEQsSUFBSSxJQUFJLGdCQUFlO0FBQ3ZCLElBQUksSUFBSSwwQkFBa0I7QUFFMUIsSUFBTyxjQUFROzs7QStFM0hmLElBQU8sZ0JBQVE7IiwKICAibmFtZXMiOiBbInBhdGgiLCAiY29uZmlnIiwgIkJ1ZmZlciIsICJBbnlOdWxsIiwgIkRiTnVsbCIsICJEZWNpbWFsIiwgIkpzb25OdWxsIiwgIk51bGxUeXBlcyIsICJQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yIiwgIlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yIiwgIlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yIiwgIlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3IiLCAiUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yIiwgIlNxbCIsICJlbXB0eSIsICJqb2luIiwgInJhdyIsICJydW50aW1lIiwgImh0dHBTdGF0dXMiLCAiY3J5cHRvIiwgInBhdGgiLCAiY3J5cHRvIiwgInJlZnJlc2hUb2tlbiIsICJyZWZyZXNoVG9rZW4iLCAicmVnaXN0ZXJVc2VyIiwgImh0dHBTdGF0dXMiLCAibG9naW5Vc2VyIiwgImdvb2dsZUxvZ2luIiwgImRlbW9Mb2dpbiIsICJ2ZXJpZnlFbWFpbCIsICJyZXNlbmRWZXJpZmljYXRpb24iLCAiZm9yZ290UGFzc3dvcmQiLCAicmVzZXRQYXNzd29yZCIsICJ6IiwgInoiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiYmNyeXB0IiwgImJjcnlwdCIsICJ1cGRhdGVQcm9maWxlIiwgImh0dHBTdGF0dXMiLCAiZ2V0VXNlcnMiLCAiY2hhbmdlUm9sZSIsICJjaGFuZ2VTdGF0dXMiLCAiZGVsZXRlVXNlciIsICJ6IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAibXVsdGVyIiwgImh0dHBTdGF0dXMiLCAiaHR0cFN0YXR1cyIsICJtdWx0ZXIiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVNZXNzYWdlIiwgImh0dHBTdGF0dXMiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZUJvb2tpbmciLCAiaHR0cFN0YXR1cyIsICJnZXRNeUJvb2tpbmdzIiwgImdldEFnZW50Qm9va2luZ3MiLCAiZ2V0Qm9va2luZ0RldGFpbCIsICJnZXRBbGxCb29raW5ncyIsICJ1cGRhdGVCb29raW5nU3RhdHVzIiwgInoiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZVJldmlldyIsICJodHRwU3RhdHVzIiwgInVwZGF0ZVJldmlldyIsICJkZWxldGVSZXZpZXciLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZUNhdGVnb3J5IiwgImh0dHBTdGF0dXMiLCAiZ2V0QWxsQ2F0ZWdvcmllcyIsICJ1cGRhdGVDYXRlZ29yeSIsICJkZWxldGVDYXRlZ29yeSIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAicmFuZG9tVVVJRCIsICJyYW5kb21VVUlEIiwgImNyZWF0ZVBhY2thZ2UiLCAiaHR0cFN0YXR1cyIsICJnZXRQdWJsaWNQYWNrYWdlcyIsICJnZXRQYWNrYWdlQnlTbHVnIiwgImdldEFsbFBhY2thZ2VzIiwgImdldE15UGFja2FnZXMiLCAidXBkYXRlUGFja2FnZSIsICJjaGFuZ2VQYWNrYWdlU3RhdHVzIiwgInNvZnREZWxldGVQYWNrYWdlIiwgInoiLCAidXBkYXRlU3RhdHVzU2NoZW1hIiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAicmFuZG9tVVVJRCIsICJnZW5lcmF0ZVVuaXF1ZVNsdWciLCAicmFuZG9tVVVJRCIsICJjcmVhdGVQb3N0IiwgImh0dHBTdGF0dXMiLCAiZ2V0UHVibGljUG9zdHMiLCAiZ2V0UG9zdEJ5U2x1ZyIsICJnZXRBbGxQb3N0cyIsICJnZXRNeVBvc3RzIiwgInVwZGF0ZVBvc3QiLCAiY2hhbmdlUG9zdFN0YXR1cyIsICJzb2Z0RGVsZXRlUG9zdCIsICJ6IiwgInRpdGxlU2NoZW1hIiwgInVwZGF0ZVN0YXR1c1NjaGVtYSIsICJodHRwU3RhdHVzIiwgImdldFBvc3RDb21tZW50cyIsICJodHRwU3RhdHVzIiwgImNyZWF0ZUNvbW1lbnQiLCAiZGVsZXRlQ29tbWVudCIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiZ2V0QWRtaW5EYXNoYm9hcmQiLCAiaHR0cFN0YXR1cyIsICJnZXRBZ2VudERhc2hib2FyZCIsICJnZXRVc2VyRGFzaGJvYXJkIiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJodHRwU3RhdHVzIiwgInoiLCAiY3JlYXRlU2NoZW1hIiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiYWRkVG9XaXNobGlzdCIsICJodHRwU3RhdHVzIiwgImdldE15V2lzaGxpc3QiLCAicmVtb3ZlRnJvbVdpc2hsaXN0IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJnZXRNeU5vdGlmaWNhdGlvbnMiLCAiaHR0cFN0YXR1cyIsICJnZXRVbnJlYWRDb3VudCIsICJtYXJrQXNSZWFkIiwgIm1hcmtBbGxBc1JlYWQiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIl0KfQo=
