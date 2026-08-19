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
  if (data.APIConnect !== "DONE" || data.status === "failed") {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FwcC50cyIsICIuLi9zcmMvY29uZmlnL2luZGV4LnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL25vdEZvdW5kLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudC50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2ludGVybmFsL2NsYXNzLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXMudHMiLCAiLi4vc3JjL3V0aWxzL2FwcEVycm9yLnRzIiwgIi4uL3NyYy9saWIvcHJpc21hLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguc2VydmljZS50cyIsICIuLi9zcmMvbGliL2dvb2dsZUF1dGgudHMiLCAiLi4vc3JjL2xpYi9yZWRpcy50cyIsICIuLi9zcmMvdXRpbHMvand0LnRzIiwgIi4uL3NyYy9saWIvbm9kZW1haWxlci50cyIsICIuLi9zcmMvdGVtcGxhdGVzL2luZGV4LnRzIiwgIi4uL3NyYy91dGlscy9hdXRoRW1haWwudHMiLCAiLi4vc3JjL3V0aWxzL2NhdGNoQXN5bmMudHMiLCAiLi4vc3JjL3V0aWxzL3NlbmRSZXNwb25zZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGgudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3QudHMiLCAiLi4vc3JjL21pZGRsZXdhcmUvYXV0aC50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9saWIvY2xvdWRpbmFyeS50cyIsICIuLi9zcmMvbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jb250YWN0L2NvbnRhY3Qucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL2VtYWlsLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbGliL3NzbGNvbW1lcnoudHMiLCAiLi4vc3JjL3V0aWxzL25vdGlmaWNhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcmV2aWV3L3Jldmlldy52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL3NsdWdpZnkudHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2Uuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nQ29tbWVudC5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jsb2cvYmxvZ0NvbW1lbnQuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2dDb21tZW50LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3Qucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3dpc2hsaXN0L3dpc2hsaXN0LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ub3RpZmljYXRpb24vbm90aWZpY2F0aW9uLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL25vdGlmaWNhdGlvbi9ub3RpZmljYXRpb24udmFsaWRhdGlvbi50cyIsICJpbmRleC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IGV4cHJlc3MsIHsgQXBwbGljYXRpb24sIE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xyXG5pbXBvcnQgY29ycyBmcm9tIFwiY29yc1wiO1xyXG5pbXBvcnQgY29va2llUGFyc2VyIGZyb20gXCJjb29raWUtcGFyc2VyXCI7XHJcbmltcG9ydCBoZWxtZXQgZnJvbSBcImhlbG1ldFwiO1xyXG5pbXBvcnQgbW9yZ2FuIGZyb20gXCJtb3JnYW5cIjtcclxuaW1wb3J0IHJhdGVMaW1pdCBmcm9tIFwiZXhwcmVzcy1yYXRlLWxpbWl0XCI7XHJcbmltcG9ydCBjb25maWcgZnJvbSBcIi4vY29uZmlnXCI7XHJcbmltcG9ydCBub3RGb3VuZEhhbmRsZXIgZnJvbSBcIi4vbWlkZGxld2FyZS9ub3RGb3VuZFwiO1xyXG5pbXBvcnQgZ2xvYmFsRXJyb3JIYW5kbGVyIGZyb20gXCIuL21pZGRsZXdhcmUvZ2xvYmFsRXJyb3JIYW5kbGVyXCI7XHJcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuL2xpYi9wcmlzbWFcIjtcclxuaW1wb3J0IHsgYXV0aFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYXV0aC9hdXRoLnJvdXRlXCI7XHJcbmltcG9ydCB7IHVzZXJSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZVwiO1xyXG5pbXBvcnQgeyB1cGxvYWRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBjb250YWN0Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9jb250YWN0L2NvbnRhY3Qucm91dGVcIjtcclxuaW1wb3J0IHsgYm9va2luZ1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlXCI7XHJcbmltcG9ydCB7IHJldmlld1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcmV2aWV3L3Jldmlldy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBjYXRlZ29yeVJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkucm91dGVcIjtcclxuaW1wb3J0IHsgcGFja2FnZVJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGFja2FnZS9wYWNrYWdlLnJvdXRlXCI7XHJcbmltcG9ydCB7IGJsb2dSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Jsb2cvYmxvZy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBkYXNoYm9hcmRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQucm91dGVcIjtcclxuaW1wb3J0IHsgcGF5bWVudFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnJvdXRlXCI7XHJcbmltcG9ydCB7IHdpc2hsaXN0Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBub3RpZmljYXRpb25Sb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL25vdGlmaWNhdGlvbi9ub3RpZmljYXRpb24ucm91dGVcIjtcclxuXHJcbmNvbnN0IGFwcDogQXBwbGljYXRpb24gPSBleHByZXNzKCk7XHJcblxyXG4vLyBSZW5kZXIvUmFpbHdheSBzaXQgYmVoaW5kIGEgcmV2ZXJzZSBwcm94eSBcdTIwMTQgbXVzdCBiZSBzZXQgYmVmb3JlIHRoZVxyXG4vLyByYXRlIGxpbWl0ZXIgb3IgaXQgd2lsbCBzZWUgdGhlIHByb3h5J3MgSVAgZm9yIGV2ZXJ5IHJlcXVlc3QgYW5kXHJcbi8vIGVmZmVjdGl2ZWx5IHJhdGUtbGltaXQgYWxsIHVzZXJzIHRvZ2V0aGVyLlxyXG5hcHAuc2V0KFwidHJ1c3QgcHJveHlcIiwgMSk7XHJcblxyXG5hcHAudXNlKGhlbG1ldCgpKTtcclxuXHJcbmFwcC51c2UoXHJcbiAgY29ycyh7XHJcbiAgICAvLyBEZXYgaG9zdCAobG9jYWxob3N0KSArIHByb2QgaG9zdCAoVmVyY2VsKSBib3RoIGFsbG93ZWQgc2lkZS1ieS1zaWRlLlxyXG4gICAgLy8gQ29uZmlnIHJlc29sdmVzIHNlbnNpYmxlIGRlZmF1bHRzIHNvIG5laXRoZXIgY2FuIGJlIGZhbHN5LlxyXG4gICAgb3JpZ2luOiBbY29uZmlnLmZyb250ZW5kX3VybF9kZXYsIGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZF0uZmlsdGVyKFxyXG4gICAgICAobyk6IG8gaXMgc3RyaW5nID0+IEJvb2xlYW4obyksXHJcbiAgICApLFxyXG4gICAgY3JlZGVudGlhbHM6IHRydWUsXHJcbiAgfSksXHJcbik7XHJcblxyXG5pZiAoY29uZmlnLm5vZGVfZW52ICE9PSBcInByb2R1Y3Rpb25cIikge1xyXG4gIGFwcC51c2UobW9yZ2FuKFwiZGV2XCIpKTtcclxufVxyXG5cclxuYXBwLnVzZShleHByZXNzLmpzb24oeyBsaW1pdDogXCIxMDBrYlwiIH0pKTtcclxuYXBwLnVzZShleHByZXNzLnVybGVuY29kZWQoeyBleHRlbmRlZDogdHJ1ZSwgbGltaXQ6IFwiMTAwa2JcIiB9KSk7XHJcbmFwcC51c2UoY29va2llUGFyc2VyKCkpO1xyXG5cclxuLy8gU3RyaWN0IGxpbWl0ZXIgXHUyMDE0IGF1dGggZW5kcG9pbnRzLCBicnV0ZS1mb3JjZSBwcm90ZWN0aW9uXHJcbmNvbnN0IGF1dGhMaW1pdGVyID0gcmF0ZUxpbWl0KHtcclxuICB3aW5kb3dNczogMTUgKiA2MCAqIDEwMDAsXHJcbiAgbGltaXQ6IDUsXHJcbiAgc3RhbmRhcmRIZWFkZXJzOiB0cnVlLFxyXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxyXG4gIG1lc3NhZ2U6IHtcclxuICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSBhdHRlbXB0cy4gUGxlYXNlIHRyeSBhZ2FpbiBpbiAxNSBtaW51dGVzLlwiLFxyXG4gIH0sXHJcbn0pO1xyXG5cclxuLy8gU3RhbmRhcmQgbGltaXRlciBcdTIwMTQgZXZlcnl0aGluZyBlbHNlIHVuZGVyIC9hcGlcclxuY29uc3QgYXBpTGltaXRlciA9IHJhdGVMaW1pdCh7XHJcbiAgd2luZG93TXM6IDE1ICogNjAgKiAxMDAwLFxyXG4gIGxpbWl0OiAxMDAsXHJcbiAgc3RhbmRhcmRIZWFkZXJzOiB0cnVlLFxyXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxyXG4gIG1lc3NhZ2U6IHtcclxuICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSByZXF1ZXN0cy4gUGxlYXNlIHRyeSBhZ2FpbiBsYXRlci5cIixcclxuICB9LFxyXG59KTtcclxuXHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvbG9naW5cIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL3JlZ2lzdGVyXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9kZW1vLWxvZ2luXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9nb29nbGVcIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL3ZlcmlmeS1lbWFpbFwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvcmVzZW5kLXZlcmlmaWNhdGlvblwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvZm9yZ290LXBhc3N3b3JkXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9yZXNldC1wYXNzd29yZFwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpXCIsIGFwaUxpbWl0ZXIpO1xyXG5cclxuLy8gUm9vdCByb3V0ZVxyXG5hcHAuZ2V0KFwiL1wiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgcmVzLnNlbmQoXCJXZWxjb21lIHRvIHRoZSBUcmlwVmVyc2UgQVBJIVwiKTtcclxufSk7XHJcblxyXG4vLyBIZWFsdGggY2hlY2sgXHUyMDE0IHJlYWwgREIgY29ubmVjdGl2aXR5IGNoZWNrLCBub3QgYSBzdGF0aWMgMjAwLlxyXG5hcHAuZ2V0KFwiL2hlYWx0aFwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUIDFgO1xyXG4gICAgcmVzLnN0YXR1cygyMDApLmpzb24oe1xyXG4gICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICBtZXNzYWdlOiBcIk9LXCIsXHJcbiAgICAgIGRiOiBcImNvbm5lY3RlZFwiLFxyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgIH0pO1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICByZXMuc3RhdHVzKDUwMykuanNvbih7XHJcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICBtZXNzYWdlOiBcIlNlcnZpY2UgdW5hdmFpbGFibGVcIixcclxuICAgICAgZGI6IFwiZGlzY29ubmVjdGVkXCIsXHJcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59KTtcclxuXHJcbi8vIFx1MjUwMFx1MjUwMCBGZWF0dXJlIHJvdXRlcyByZWdpc3RlciBoZXJlIGFzIGVhY2ggbW9kdWxlIGlzIGJ1aWx0IFx1MjUwMFx1MjUwMFxyXG5hcHAudXNlKFwiL2FwaS9hdXRoXCIsIGF1dGhSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS91c2Vyc1wiLCB1c2VyUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvdXBsb2Fkc1wiLCB1cGxvYWRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jb250YWN0XCIsIGNvbnRhY3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jYXRlZ29yaWVzXCIsIGNhdGVnb3J5Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvcGFja2FnZXNcIiwgcGFja2FnZVJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3Jldmlld3NcIiwgcmV2aWV3Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvYm9va2luZ3NcIiwgYm9va2luZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Jsb2dcIiwgYmxvZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Rhc2hib2FyZFwiLCBkYXNoYm9hcmRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9wYXltZW50c1wiLCBwYXltZW50Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvd2lzaGxpc3RcIiwgd2lzaGxpc3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9ub3RpZmljYXRpb25zXCIsIG5vdGlmaWNhdGlvblJvdXRlcyk7XHJcblxyXG5hcHAudXNlKG5vdEZvdW5kSGFuZGxlcik7XHJcbmFwcC51c2UoZ2xvYmFsRXJyb3JIYW5kbGVyKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGFwcDtcclxuIiwgImltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmRvdGVudi5jb25maWcoe1xuICBxdWlldDogdHJ1ZSxcbiAgcGF0aDogcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwiLmVudlwiKSxcbn0pO1xuXG4vLyBFdmVyeSBtb2R1bGUgcmVhZHMgY29uZmlnIHRocm91Z2ggdGhpcyB2YWxpZGF0ZWQgb2JqZWN0LCBuZXZlclxuLy8gcHJvY2Vzcy5lbnYgZGlyZWN0bHkgXHUyMDE0IGEgbWlzc2luZy9tYWxmb3JtZWQgdmFyIGZhaWxzIGxvdWRseSBhdCBib290XG4vLyBpbnN0ZWFkIG9mIHN1cmZhY2luZyBhcyBhIGNvbmZ1c2luZyBydW50aW1lIGVycm9yIG1pZC1yZXF1ZXN0LlxuY29uc3QgZW52U2NoZW1hID0gei5vYmplY3Qoe1xuICBQT1JUOiB6LnN0cmluZygpLmRlZmF1bHQoXCI0MDAwXCIpLFxuICBOT0RFX0VOVjogei5lbnVtKFtcImRldmVsb3BtZW50XCIsIFwicHJvZHVjdGlvblwiXSkuZGVmYXVsdChcImRldmVsb3BtZW50XCIpLFxuXG4gIC8vIEZyb250ZW5kIG9yaWdpbnMgZm9yIENPUlMgKyBwYXltZW50IHJlZGlyZWN0cy4gVGhlIGZyb250ZW5kIG1heSBub3QgYmVcbiAgLy8gZGVwbG95ZWQgeWV0IChvciBtYXkgYmUgcmVidWlsdCksIHNvIGJvdGggYXJlIG9wdGlvbmFsOiB0aGUgYmFja2VuZCBtdXN0XG4gIC8vIG5ldmVyIHJlZnVzZSB0byBib290IGp1c3QgYmVjYXVzZSBhIFVJIGhvc3QgaXNuJ3QgbGl2ZS4gUm91dGVzIHRoYXQgbmVlZCBhXG4gIC8vIHJlYWwgb3JpZ2luIChwYXltZW50IGNhbGxiYWNrIHJlZGlyZWN0cykgZmFsbCBiYWNrIHRvIHRoZSBiYWNrZW5kIFVSTC5cbiAgRlJPTlRFTkRfVVJMX0RFVjogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBGUk9OVEVORF9VUkxfUFJPRDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuXG4gIERBVEFCQVNFX1VSTDogei5zdHJpbmcoKS5taW4oMSwgXCJEQVRBQkFTRV9VUkwgaXMgcmVxdWlyZWRcIiksXG5cbiAgQkNSWVBUX1NBTFRfUk9VTkRTOiB6LnN0cmluZygpLmRlZmF1bHQoXCIxMFwiKSxcblxuICAvLyBPcHRpb25hbCBhZG1pbiBjcmVkZW50aWFscyB1c2VkIGJ5IHRoZSBzZWVkIHNjcmlwdCAoU3RlcCAxMykuIEZhbGxzIGJhY2tcbiAgLy8gdG8gZGVtby1hZG1pbkB0cmlwdmVyc2UuY29tIC8gZGVtbzEyMyB3aGVuIHVuc2V0LlxuICBBRE1JTl9FTUFJTDogei5zdHJpbmcoKS5lbWFpbCgpLm9wdGlvbmFsKCksXG4gIEFETUlOX1BBU1NXT1JEOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxuXG4gIC8vIFNTTENvbW1lcnogKFN0ZXAgMTYpIFx1MjAxNCBzYW5kYm94IHN0b3JlIGNyZWRzIHVudGlsIGdvLWxpdmUuIFNTTF9DT01NRVJaX1NBTkRCT1hcbiAgLy8gcGlja3MgdGhlIHNhbmRib3ggdnMgbGl2ZSBBUEkgYmFzZSBVUkwuIE9wdGlvbmFsIHNvIHRoZSBBUEkgYm9vdHMgKGhlYWx0aCxcbiAgLy8gYXV0aCwgY2F0YWxvZywgZXRjLikgZXZlbiB3aGVuIHRoZSBwYXltZW50IHN0b3JlIGlzbid0IGNvbmZpZ3VyZWQgeWV0IFx1MjAxNCB0aGVcbiAgLy8gcGF5bWVudCBlbmRwb2ludHMgdGhlbiBmYWlsIHdpdGggYSBjbGVhbiBcIm5vdCBjb25maWd1cmVkXCIgZXJyb3IgaW5zdGVhZCBvZlxuICAvLyB0YWtpbmcgdGhlIHdob2xlIGRlcGxveW1lbnQgZG93bi5cbiAgU1NMX0NPTU1FUlpfU1RPUkVfSUQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU1NMX0NPTU1FUlpfU0FOREJPWDogei5zdHJpbmcoKS5kZWZhdWx0KFwidHJ1ZVwiKSxcbiAgLy8gT3B0aW9uYWwgZXhwbGljaXQgZ2F0ZXdheS92YWxpZGF0b3IgYmFzZSBVUkxzIChHZWFyVXAgcGF0dGVybikuIERlZmF1bHRzIGFyZVxuICAvLyBkZXJpdmVkIGZyb20gU1NMX0NPTU1FUlpfU0FOREJPWCB3aGVuIGFic2VudC5cbiAgU1NMQ09NTUVSWl9JTklUX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBTU0xDT01NRVJaX1ZBTElEQVRFX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBTU0xDT01NRVJaX1JFRlVORF9VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICAvLyBQdWJsaWNseSByZWFjaGFibGUgYmFzZSBVUkwgdGhlIHBheW1lbnQgbW9kdWxlIHVzZXMgdG8gYnVpbGQgdGhlXG4gIC8vIFNTTENvbW1lcnogc3VjY2Vzcy9mYWlsL2NhbmNlbC9JUE4gY2FsbGJhY2sgVVJMcy4gTXVzdCBOT1QgYmUgbG9jYWxob3N0IGluXG4gIC8vIHNhbmRib3ggXHUyMDE0IHRoZSBnYXRld2F5IFBPU1RzIHRvIHRoZXNlIHNlcnZlci10by1zZXJ2ZXIuIE9wdGlvbmFsIGxpa2UgdGhlXG4gIC8vIHN0b3JlIGNyZWRzIGFib3ZlIChwYXltZW50LW9ubHkpLlxuICBCQUNLRU5EX1BVQkxJQ19VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICBKV1RfQUNDRVNTX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJKV1RfQUNDRVNTX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX1JFRlJFU0hfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkpXVF9SRUZSRVNIX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX0FDQ0VTU19FWFBJUkVTX0lOOiB6LnN0cmluZygpLmRlZmF1bHQoXCIxZFwiKSxcbiAgSldUX1JFRlJFU0hfRVhQSVJFU19JTjogei5zdHJpbmcoKS5kZWZhdWx0KFwiMzBkXCIpLFxuXG4gIC8vIEdvb2dsZSBPQXV0aCBpcyBvcHRpb25hbCBcdTIwMTQgc2VydmVyIGJvb3RzIHdpdGhvdXQgaXQ7IC9hcGkvYXV0aC9nb29nbGVcbiAgLy8gcmV0dXJucyBhIGNsZWFuIDQwMCB1bnRpbCBHT09HTEVfQ0xJRU5UX0lEIGlzIGNvbmZpZ3VyZWQuXG4gIEdPT0dMRV9DTElFTlRfSUQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcblxuICAvLyBCZXN0LWVmZm9ydCBjb250YWN0IGVtYWlscyAoUmVzZW5kKSBcdTIwMTQgYWx3YXlzIG9wdGlvbmFsOyBzdWJtaXNzaW9uc1xuICAvLyBzdWNjZWVkIGFuZCBlbWFpbHMgYmVjb21lIG5vLW9wcyB3aGVuIHRoZXNlIGFyZSBtaXNzaW5nLlxuICBSRVNFTkRfQVBJX0tFWTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBDT05UQUNUX1JFQ0VJVkVSX0VNQUlMOiB6LnN0cmluZygpLmVtYWlsKCkub3B0aW9uYWwoKSxcbiAgRU1BSUxfRlJPTTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIC8vIEVtYWlsIHZlcmlmaWNhdGlvbiArIHBhc3N3b3JkIHJlc2V0IChTdGVwIDIxKSBcdTIwMTQgUmVkaXMgT1RQIHN0b3JlICsgTm9kZW1haWxlci5cbiAgLy8gQWxsIG9wdGlvbmFsIHNvIHRoZSBhcHAgYm9vdHMgd2l0aG91dCB0aGVtIChlLmcuIFZlcmNlbCBwcm9kKTsgdGhlIGF1dGhcbiAgLy8gZW5kcG9pbnRzIHRoZW4gcmVzcG9uZCB3aXRoIGEgY2xlYW4gNTAzIFwibm90IGNvbmZpZ3VyZWRcIiBpbnN0ZWFkIG9mIGNyYXNoaW5nLlxuICBSRURJU19VU0VSOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFJFRElTX1BBU1NXT1JEOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFJFRElTX0hPU1Q6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgUkVESVNfUE9SVDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTTVRQX1VTRVI6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU01UUF9QQVNTV09SRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIENMT1VESU5BUllfQ0xPVURfTkFNRTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0NMT1VEX05BTUUgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX0tFWTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9LRVkgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9TRUNSRVQgaXMgcmVxdWlyZWRcIiksXG59KTtcblxuY29uc3QgcGFyc2VkID0gZW52U2NoZW1hLnNhZmVQYXJzZShwcm9jZXNzLmVudik7XG5cbmlmICghcGFyc2VkLnN1Y2Nlc3MpIHtcbiAgY29uc29sZS5lcnJvcihcIlx1Mjc0QyBJbnZhbGlkIGVudmlyb25tZW50IHZhcmlhYmxlczpcIik7XG4gIGNvbnNvbGUuZXJyb3IocGFyc2VkLmVycm9yLmZsYXR0ZW4oKS5maWVsZEVycm9ycyk7XG4gIHByb2Nlc3MuZXhpdCgxKTtcbn1cblxuY29uc3QgZW52ID0gcGFyc2VkLmRhdGE7XG5cbmNvbnN0IGNvbmZpZyA9IHtcbiAgcG9ydDogZW52LlBPUlQsXG4gIG5vZGVfZW52OiBlbnYuTk9ERV9FTlYsXG5cbiAgLy8gRnJvbnRlbmQgb3JpZ2lucyBmb3IgQ09SUyArIHBheW1lbnQgcmVkaXJlY3RzLiBMb2NhbGhvc3QgYWx3YXlzIHdpbnMgZm9yXG4gIC8vIGxvY2FsIHRlc3Rpbmc7IHByb2R1Y3Rpb24gdXNlcyB0aGUgVmVyY2VsIGZyb250ZW5kIFVSTCwgZmFsbGluZyBiYWNrIHRvIHRoZVxuICAvLyBiYWNrZW5kIFVSTCBzbyB0aGUgQVBJIHN0YXlzIHJlYWNoYWJsZSBldmVuIGJlZm9yZSB0aGUgVUkgaXMgZGVwbG95ZWQuXG4gIGZyb250ZW5kX3VybF9kZXY6IGVudi5GUk9OVEVORF9VUkxfREVWIHx8IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gIGZyb250ZW5kX3VybF9wcm9kOlxuICAgIGVudi5GUk9OVEVORF9VUkxfUFJPRCB8fCBlbnYuQkFDS0VORF9QVUJMSUNfVVJMIHx8IFwiXCIsXG5cbiAgZGF0YWJhc2VfdXJsOiBlbnYuREFUQUJBU0VfVVJMLFxuXG4gIGJjcnlwdF9zYWx0X3JvdW5kczogZW52LkJDUllQVF9TQUxUX1JPVU5EUyxcblxuICBhZG1pbl9lbWFpbDogZW52LkFETUlOX0VNQUlMLFxuICBhZG1pbl9wYXNzd29yZDogZW52LkFETUlOX1BBU1NXT1JELFxuXG4gIHNzbF9jb21tZXJ6X3N0b3JlX2lkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfSUQsXG4gIHNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQsXG4gIHNzbF9jb21tZXJ6X3NhbmRib3g6IGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIixcbiAgLy8gc2FuZGJveCBiYXNlIFVSTHMgKGZhbGxiYWNrIHdoZW4gdGhlIGV4cGxpY2l0IG92ZXJyaWRlIHZhcnMgYXJlIGFic2VudClcbiAgc3NsY29tbWVyel9pbml0X3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9JTklUX1VSTCA/P1xuICAgIChlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCJcbiAgICAgID8gXCJodHRwczovL3NhbmRib3guc3NsY29tbWVyei5jb20vZ3dwcm9jZXNzL3Y0L2FwaS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL2d3cHJvY2Vzcy92NC9hcGkucGhwXCIpLFxuICBzc2xjb21tZXJ6X3ZhbGlkYXRlX3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9WQUxJREFURV9VUkwgPz9cbiAgICAoZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiXG4gICAgICA/IFwiaHR0cHM6Ly9zYW5kYm94LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIiksXG4gIHNzbGNvbW1lcnpfcmVmdW5kX3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9SRUZVTkRfVVJMID8/XG4gICAgKGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIlxuICAgICAgPyBcImh0dHBzOi8vc2FuZGJveC5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL21lcmNoYW50VHJhbnNJRHZhbGlkYXRpb25BUEkucGhwXCJcbiAgICAgIDogXCJodHRwczovL3NlY3VyZXBheS5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL21lcmNoYW50VHJhbnNJRHZhbGlkYXRpb25BUEkucGhwXCIpLFxuICBiYWNrZW5kX3B1YmxpY191cmw6IGVudi5CQUNLRU5EX1BVQkxJQ19VUkwsXG5cbiAgand0X2FjY2Vzc19zZWNyZXQ6IGVudi5KV1RfQUNDRVNTX1NFQ1JFVCxcbiAgand0X3JlZnJlc2hfc2VjcmV0OiBlbnYuSldUX1JFRlJFU0hfU0VDUkVULFxuICBqd3RfYWNjZXNzX2V4cGlyZXNfaW46IGVudi5KV1RfQUNDRVNTX0VYUElSRVNfSU4sXG4gIGp3dF9yZWZyZXNoX2V4cGlyZXNfaW46IGVudi5KV1RfUkVGUkVTSF9FWFBJUkVTX0lOLFxuXG4gIGdvb2dsZV9jbGllbnRfaWQ6IGVudi5HT09HTEVfQ0xJRU5UX0lELFxuXG4gIHJlc2VuZF9hcGlfa2V5OiBlbnYuUkVTRU5EX0FQSV9LRVksXG4gIGNvbnRhY3RfcmVjZWl2ZXJfZW1haWw6IGVudi5DT05UQUNUX1JFQ0VJVkVSX0VNQUlMLFxuICBlbWFpbF9mcm9tOiBlbnYuRU1BSUxfRlJPTSxcblxuICAvLyBFbWFpbCB2ZXJpZmljYXRpb24gKyBwYXNzd29yZCByZXNldCAoU3RlcCAyMSlcbiAgcmVkaXNfdXNlcjogZW52LlJFRElTX1VTRVIsXG4gIHJlZGlzX3Bhc3N3b3JkOiBlbnYuUkVESVNfUEFTU1dPUkQsXG4gIHJlZGlzX2hvc3Q6IGVudi5SRURJU19IT1NULFxuICByZWRpc19wb3J0OiBlbnYuUkVESVNfUE9SVCxcbiAgc210cF91c2VyOiBlbnYuU01UUF9VU0VSLFxuICBzbXRwX3Bhc3N3b3JkOiBlbnYuU01UUF9QQVNTV09SRCxcblxuICBjbG91ZGluYXJ5X2Nsb3VkX25hbWU6IGVudi5DTE9VRElOQVJZX0NMT1VEX05BTUUsXG4gIGNsb3VkaW5hcnlfYXBpX2tleTogZW52LkNMT1VESU5BUllfQVBJX0tFWSxcbiAgY2xvdWRpbmFyeV9hcGlfc2VjcmV0OiBlbnYuQ0xPVURJTkFSWV9BUElfU0VDUkVULFxufTtcblxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgImltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuY29uc3Qgbm90Rm91bmRIYW5kbGVyID0gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkgPT4ge1xuICByZXMuc3RhdHVzKDQwNCkuanNvbih7XG4gICAgc3VjY2VzczogZmFsc2UsXG4gICAgc3RhdHVzQ29kZTogNDA0LFxuICAgIG1lc3NhZ2U6IFwiUm91dGUgbm90IGZvdW5kXCIsXG4gICAgcGF0aDogcmVxLm9yaWdpbmFsVXJsLFxuICAgIGRhdGU6IG5ldyBEYXRlKCksXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgbm90Rm91bmRIYW5kbGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgbXVsdGVyIGZyb20gXCJtdWx0ZXJcIjtcbmltcG9ydCB7IFpvZEVycm9yIH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbmNvbnN0IGdsb2JhbEVycm9ySGFuZGxlciA9IChcbiAgZXJyOiBhbnksXG4gIHJlcTogUmVxdWVzdCxcbiAgcmVzOiBSZXNwb25zZSxcbiAgbmV4dDogTmV4dEZ1bmN0aW9uLFxuKSA9PiB7XG4gIGlmIChjb25maWcubm9kZV9lbnYgIT09IFwicHJvZHVjdGlvblwiKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yOlwiLCBlcnIpO1xuICB9XG5cbiAgLy8gZGVmYXVsdCBmYWxsYmFja1xuICBsZXQgc3RhdHVzQ29kZTogbnVtYmVyID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gIGxldCBlcnJvck1lc3NhZ2U6IHN0cmluZyA9IGVycj8ubWVzc2FnZSB8fCBcIkludGVybmFsIFNlcnZlciBFcnJvclwiO1xuICBsZXQgZXJyb3JOYW1lOiBzdHJpbmcgPSBlcnI/Lm5hbWUgfHwgXCJFcnJvclwiO1xuXG4gIC8vIFpvZCB2YWxpZGF0aW9uIGVycm9yXG4gIGlmIChlcnIgaW5zdGFuY2VvZiBab2RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5pc3N1ZXMubWFwKChpKSA9PiBpLm1lc3NhZ2UpLmpvaW4oXCIsIFwiKTtcbiAgICBlcnJvck5hbWUgPSBcIlpvZEVycm9yXCI7XG4gIH1cblxuICAvLyBNdWx0ZXIgZmlsZSB1cGxvYWQgZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgbXVsdGVyLk11bHRlckVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JOYW1lID0gXCJNdWx0ZXJFcnJvclwiO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBlcnIuY29kZSA9PT0gXCJMSU1JVF9GSUxFX1NJWkVcIlxuICAgICAgICA/IFwiRmlsZSB0b28gbGFyZ2UuIE1heGltdW0gc2l6ZSBpcyA1TUIuXCJcbiAgICAgICAgOiBgVXBsb2FkIGZhaWxlZDogJHtlcnIuY29kZX1gO1xuICB9XG5cbiAgLy8gQ3VzdG9tIGZpbGUgdHlwZSByZWplY3Rpb24gZnJvbSB0aGUgbXVsdGVyIGZpbGVGaWx0ZXJcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgKGVyciBhcyBhbnkpLmNvZGUgPT09IFwiSU5WQUxJRF9GSUxFX1RZUEVcIikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICB9XG5cbiAgLy8gUHJpc21hIHZhbGlkYXRpb24gZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBcIllvdSBoYXZlIHByb3ZpZGVkIGluY29ycmVjdCBmaWVsZCB0eXBlIG9yIG1pc3NpbmcgcmVxdWlyZWQgZmllbGRzXCI7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3JcIjtcbiAgfVxuXG4gIC8vIFByaXNtYSBrbm93biBlcnJvcnNcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yKSB7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclwiO1xuXG4gICAgaWYgKGVyci5jb2RlID09PSBcIlAyMDAyXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkNPTkZMSUNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJUaGlzIHZhbHVlIGFscmVhZHkgZXhpc3RzXCI7XG4gICAgfSBlbHNlIGlmIChlcnIuY29kZSA9PT0gXCJQMjAwM1wiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5DT05GTElDVDtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiRm9yZWlnbiBrZXkgY29uc3RyYWludCBmYWlsZWRcIjtcbiAgICB9IGVsc2UgaWYgKGVyci5jb2RlID09PSBcIlAyMDI1XCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLk5PVF9GT1VORDtcbiAgICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICAgIFwiQW4gb3BlcmF0aW9uIGZhaWxlZCBiZWNhdXNlIG9uZSBvciBtb3JlIHJlcXVpcmVkIHJlY29yZHMgd2VyZSBub3QgZm91bmQuXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIERCIGNvbm5lY3Rpb24vaW5pdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvcikge1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclwiO1xuXG4gICAgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDBcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuVU5BVVRIT1JJWkVEO1xuICAgICAgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgXCJBdXRoZW50aWNhdGlvbiBmYWlsZWQgYWdhaW5zdCB0aGUgZGF0YWJhc2Ugc2VydmVyLiBQbGVhc2UgY2hlY2sgeW91ciBkYXRhYmFzZSBjcmVkZW50aWFscy5cIjtcbiAgICB9IGVsc2UgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDFcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuU0VSVklDRV9VTkFWQUlMQUJMRTtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiQ2FuJ3QgcmVhY2ggdGhlIGRhdGFiYXNlIHNlcnZlci5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIHVua25vd24gcmVxdWVzdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3JcIjtcbiAgICBlcnJvck1lc3NhZ2UgPSBcIkVycm9yIG9jY3VycmVkIGR1cmluZyBxdWVyeSBleGVjdXRpb25cIjtcbiAgfVxuXG4gIC8vIFlvdXIgY3VzdG9tIEFwcEVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEFwcEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGVyci5zdGF0dXNDb2RlO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIGVycm9yTmFtZSA9IGVyci5uYW1lIHx8IFwiQXBwRXJyb3JcIjtcbiAgfVxuXG4gIC8vIEZhbGxiYWNrIGZvciBvdGhlciB0aHJvd24gZXJyb3JzXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCI7XG4gICAgZXJyb3JOYW1lID0gZXJyLm5hbWUgfHwgXCJFcnJvclwiO1xuICB9XG5cbiAgcmVzLnN0YXR1cyhzdGF0dXNDb2RlKS5qc29uKHtcbiAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICBzdGF0dXNDb2RlLFxuICAgIG5hbWU6IGVycm9yTmFtZSxcbiAgICBtZXNzYWdlOiBlcnJvck1lc3NhZ2UsXG4gICAgZXJyb3I6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcImRldmVsb3BtZW50XCIgPyBlcnIuc3RhY2sgOiB1bmRlZmluZWQsXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZ2xvYmFsRXJyb3JIYW5kbGVyO1xuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogVGhpcyBmaWxlIHNob3VsZCBiZSB5b3VyIG1haW4gaW1wb3J0IHRvIHVzZSBQcmlzbWEuIFRocm91Z2ggaXQgeW91IGdldCBhY2Nlc3MgdG8gYWxsIHRoZSBtb2RlbHMsIGVudW1zLCBhbmQgaW5wdXQgdHlwZXMuXG4gKiBJZiB5b3UncmUgbG9va2luZyBmb3Igc29tZXRoaW5nIHlvdSBjYW4gaW1wb3J0IGluIHRoZSBjbGllbnQtc2lkZSBvZiB5b3VyIGFwcGxpY2F0aW9uLCBwbGVhc2UgcmVmZXIgdG8gdGhlIGBicm93c2VyLnRzYCBmaWxlIGluc3RlYWQuXG4gKlxuICogXHVEODNEXHVERkUyIFlvdSBjYW4gaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseS5cbiAqL1xuXG5pbXBvcnQgKiBhcyBwcm9jZXNzIGZyb20gJ25vZGU6cHJvY2VzcydcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJ1xuZ2xvYmFsVGhpc1snX19kaXJuYW1lJ10gPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKVxuXG5pbXBvcnQgKiBhcyBydW50aW1lIGZyb20gXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL2NsaWVudFwiXG5pbXBvcnQgKiBhcyAkRW51bXMgZnJvbSBcIi4vZW51bXNcIlxuaW1wb3J0ICogYXMgJENsYXNzIGZyb20gXCIuL2ludGVybmFsL2NsYXNzXCJcbmltcG9ydCAqIGFzIFByaXNtYSBmcm9tIFwiLi9pbnRlcm5hbC9wcmlzbWFOYW1lc3BhY2VcIlxuXG5leHBvcnQgKiBhcyAkRW51bXMgZnJvbSAnLi9lbnVtcydcbmV4cG9ydCAqIGZyb20gXCIuL2VudW1zXCJcbi8qKlxuICogIyMgUHJpc21hIENsaWVudFxuICogXG4gKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gKiB9KVxuICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dDb21tZW50c1xuICogY29uc3QgYmxvZ0NvbW1lbnRzID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KClcbiAqIGBgYFxuICogXG4gKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICovXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50ID0gJENsYXNzLmdldFByaXNtYUNsaWVudENsYXNzKClcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudDxMb2dPcHRzIGV4dGVuZHMgUHJpc21hLkxvZ0xldmVsID0gbmV2ZXIsIE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdLCBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncz4gPSAkQ2xhc3MuUHJpc21hQ2xpZW50PExvZ09wdHMsIE9taXRPcHRzLCBFeHRBcmdzPlxuZXhwb3J0IHsgUHJpc21hIH1cblxuLyoqXG4gKiBNb2RlbCBCbG9nQ29tbWVudFxuICogXG4gKi9cbmV4cG9ydCB0eXBlIEJsb2dDb21tZW50ID0gUHJpc21hLkJsb2dDb21tZW50TW9kZWxcbi8qKlxuICogTW9kZWwgQmxvZ1Bvc3RcbiAqIFxuICovXG5leHBvcnQgdHlwZSBCbG9nUG9zdCA9IFByaXNtYS5CbG9nUG9zdE1vZGVsXG4vKipcbiAqIE1vZGVsIEJvb2tpbmdcbiAqIFxuICovXG5leHBvcnQgdHlwZSBCb29raW5nID0gUHJpc21hLkJvb2tpbmdNb2RlbFxuLyoqXG4gKiBNb2RlbCBDYXRlZ29yeVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIENhdGVnb3J5ID0gUHJpc21hLkNhdGVnb3J5TW9kZWxcbi8qKlxuICogTW9kZWwgQ29udGFjdE1lc3NhZ2VcbiAqIFxuICovXG5leHBvcnQgdHlwZSBDb250YWN0TWVzc2FnZSA9IFByaXNtYS5Db250YWN0TWVzc2FnZU1vZGVsXG4vKipcbiAqIE1vZGVsIE5vdGlmaWNhdGlvblxuICogXG4gKi9cbmV4cG9ydCB0eXBlIE5vdGlmaWNhdGlvbiA9IFByaXNtYS5Ob3RpZmljYXRpb25Nb2RlbFxuLyoqXG4gKiBNb2RlbCBQYXltZW50XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUGF5bWVudCA9IFByaXNtYS5QYXltZW50TW9kZWxcbi8qKlxuICogTW9kZWwgUmVmcmVzaFRva2VuXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUmVmcmVzaFRva2VuID0gUHJpc21hLlJlZnJlc2hUb2tlbk1vZGVsXG4vKipcbiAqIE1vZGVsIFJldmlld1xuICogXG4gKi9cbmV4cG9ydCB0eXBlIFJldmlldyA9IFByaXNtYS5SZXZpZXdNb2RlbFxuLyoqXG4gKiBNb2RlbCBUb3VyUGFja2FnZVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFRvdXJQYWNrYWdlID0gUHJpc21hLlRvdXJQYWNrYWdlTW9kZWxcbi8qKlxuICogTW9kZWwgVXNlclxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFVzZXIgPSBQcmlzbWEuVXNlck1vZGVsXG4vKipcbiAqIE1vZGVsIFdpc2hsaXN0SXRlbVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFdpc2hsaXN0SXRlbSA9IFByaXNtYS5XaXNobGlzdEl0ZW1Nb2RlbFxuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogV0FSTklORzogVGhpcyBpcyBhbiBpbnRlcm5hbCBmaWxlIHRoYXQgaXMgc3ViamVjdCB0byBjaGFuZ2UhXG4gKlxuICogXHVEODNEXHVERUQxIFVuZGVyIG5vIGNpcmN1bXN0YW5jZXMgc2hvdWxkIHlvdSBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5ISBcdUQ4M0RcdURFRDFcbiAqXG4gKiBQbGVhc2UgaW1wb3J0IHRoZSBgUHJpc21hQ2xpZW50YCBjbGFzcyBmcm9tIHRoZSBgY2xpZW50LnRzYCBmaWxlIGluc3RlYWQuXG4gKi9cblxuaW1wb3J0ICogYXMgcnVudGltZSBmcm9tIFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9jbGllbnRcIlxuaW1wb3J0IHR5cGUgKiBhcyBQcmlzbWEgZnJvbSBcIi4vcHJpc21hTmFtZXNwYWNlXCJcblxuXG5jb25zdCBjb25maWc6IHJ1bnRpbWUuR2V0UHJpc21hQ2xpZW50Q29uZmlnID0ge1xuICBcInByZXZpZXdGZWF0dXJlc1wiOiBbXSxcbiAgXCJjbGllbnRWZXJzaW9uXCI6IFwiNy45LjFcIixcbiAgXCJlbmdpbmVWZXJzaW9uXCI6IFwiZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFwiLFxuICBcImFjdGl2ZVByb3ZpZGVyXCI6IFwicG9zdGdyZXNxbFwiLFxuICBcImlubGluZVNjaGVtYVwiOiBcIm1vZGVsIEJsb2dDb21tZW50IHtcXG4gIGlkICAgICAgICBTdHJpbmcgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBjb250ZW50ICAgU3RyaW5nICBAZGIuVGV4dFxcbiAgaXNEZWxldGVkIEJvb2xlYW4gQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBwb3N0SWQgICBTdHJpbmdcXG4gIHVzZXJJZCAgIFN0cmluZ1xcbiAgcGFyZW50SWQgU3RyaW5nP1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBvc3QgICAgQmxvZ1Bvc3QgICAgICBAcmVsYXRpb24oXFxcIlBvc3RDb21tZW50c1xcXCIsIGZpZWxkczogW3Bvc3RJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICB1c2VyICAgIFVzZXIgICAgICAgICAgQHJlbGF0aW9uKFxcXCJVc2VyQ29tbWVudHNcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFyZW50ICBCbG9nQ29tbWVudD8gIEByZWxhdGlvbihcXFwiQ29tbWVudFJlcGxpZXNcXFwiLCBmaWVsZHM6IFtwYXJlbnRJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICByZXBsaWVzIEJsb2dDb21tZW50W10gQHJlbGF0aW9uKFxcXCJDb21tZW50UmVwbGllc1xcXCIpXFxuXFxuICBAQGluZGV4KFtwb3N0SWQsIGlzRGVsZXRlZCwgY3JlYXRlZEF0XSlcXG4gIEBAaW5kZXgoW3BhcmVudElkXSlcXG4gIEBAbWFwKFxcXCJibG9nX2NvbW1lbnRzXFxcIilcXG59XFxuXFxubW9kZWwgQmxvZ1Bvc3Qge1xcbiAgaWQgICAgICAgICBTdHJpbmcgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0aXRsZSAgICAgIFN0cmluZ1xcbiAgc2x1ZyAgICAgICBTdHJpbmcgICAgIEB1bmlxdWVcXG4gIGV4Y2VycHQgICAgU3RyaW5nXFxuICBjb250ZW50ICAgIFN0cmluZ1xcbiAgY292ZXJJbWFnZSBTdHJpbmdcXG4gIHN0YXR1cyAgICAgUG9zdFN0YXR1cyBAZGVmYXVsdChEUkFGVClcXG4gIGlzRGVsZXRlZCAgQm9vbGVhbiAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGF1dGhvcklkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGF1dGhvciAgIFVzZXIgICAgICAgICAgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIsIGZpZWxkczogW2F1dGhvcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGNvbW1lbnRzIEJsb2dDb21tZW50W10gQHJlbGF0aW9uKFxcXCJQb3N0Q29tbWVudHNcXFwiKVxcblxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAaW5kZXgoW2F1dGhvcklkXSlcXG4gIEBAbWFwKFxcXCJibG9nX3Bvc3RzXFxcIilcXG59XFxuXFxubW9kZWwgQm9va2luZyB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRyYXZlbERhdGUgRGF0ZVRpbWVcXG4gIHRyYXZlbGVycyAgSW50XFxuICB0b3RhbFByaWNlIERlY2ltYWwgICAgICAgQGRiLkRlY2ltYWwoMTAsIDIpXFxuICBzdGF0dXMgICAgIEJvb2tpbmdTdGF0dXMgQGRlZmF1bHQoUEVORElORylcXG5cXG4gIHVzZXJJZCAgICBTdHJpbmdcXG4gIHBhY2thZ2VJZCBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICB1c2VyICAgICBVc2VyICAgICAgICBAcmVsYXRpb24oXFxcIkN1c3RvbWVyQm9va2luZ3NcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSAgVG91clBhY2thZ2UgQHJlbGF0aW9uKGZpZWxkczogW3BhY2thZ2VJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYXltZW50cyBQYXltZW50W11cXG5cXG4gIEBAaW5kZXgoW3VzZXJJZF0pXFxuICBAQGluZGV4KFtwYWNrYWdlSWRdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAaW5kZXgoW3VzZXJJZCwgcGFja2FnZUlkLCB0cmF2ZWxEYXRlXSlcXG4gIEBAbWFwKFxcXCJib29raW5nc1xcXCIpXFxufVxcblxcbm1vZGVsIENhdGVnb3J5IHtcXG4gIGlkICAgU3RyaW5nIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lIFN0cmluZyBAdW5pcXVlXFxuICBzbHVnIFN0cmluZyBAdW5pcXVlXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgcGFja2FnZXMgVG91clBhY2thZ2VbXVxcblxcbiAgQEBtYXAoXFxcImNhdGVnb3JpZXNcXFwiKVxcbn1cXG5cXG5tb2RlbCBDb250YWN0TWVzc2FnZSB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIG5hbWUgICAgICAgU3RyaW5nXFxuICBlbWFpbCAgICAgIFN0cmluZ1xcbiAgc3ViamVjdCAgICBTdHJpbmdcXG4gIG1lc3NhZ2UgICAgU3RyaW5nXFxuICBpc1Jlc29sdmVkIEJvb2xlYW4gQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgQEBpbmRleChbaXNSZXNvbHZlZF0pXFxuICBAQG1hcChcXFwiY29udGFjdF9tZXNzYWdlc1xcXCIpXFxufVxcblxcbmVudW0gUm9sZSB7XFxuICBVU0VSXFxuICBBR0VOVFxcbiAgQURNSU5cXG59XFxuXFxuZW51bSBVc2VyU3RhdHVzIHtcXG4gIEFDVElWRVxcbiAgU1VTUEVOREVEXFxufVxcblxcbmVudW0gQXV0aFByb3ZpZGVyIHtcXG4gIENSRURFTlRJQUxcXG4gIEdPT0dMRVxcbn1cXG5cXG5lbnVtIFBhY2thZ2VTdGF0dXMge1xcbiAgUEVORElOR1xcbiAgQVBQUk9WRURcXG4gIFJFSkVDVEVEXFxufVxcblxcbmVudW0gQm9va2luZ1N0YXR1cyB7XFxuICBQRU5ESU5HXFxuICBQQUlEXFxuICBDT05GSVJNRURcXG4gIENBTkNFTExFRFxcbiAgQ09NUExFVEVEXFxufVxcblxcbmVudW0gUGF5bWVudFN0YXR1cyB7XFxuICBJTklUSUFURURcXG4gIFNVQ0NFU1NcXG4gIEZBSUxFRFxcbiAgQ0FOQ0VMTEVEXFxuICBSRUZVTkRFRFxcbn1cXG5cXG5lbnVtIFBvc3RTdGF0dXMge1xcbiAgRFJBRlRcXG4gIFBVQkxJU0hFRFxcbn1cXG5cXG5lbnVtIE5vdGlmaWNhdGlvblR5cGUge1xcbiAgQk9PS0lOR19DUkVBVEVEXFxuICBCT09LSU5HX0NPTkZJUk1FRFxcbiAgQk9PS0lOR19DQU5DRUxMRURcXG4gIFBBQ0tBR0VfQVBQUk9WRURcXG4gIFBBQ0tBR0VfUkVKRUNURURcXG59XFxuXFxubW9kZWwgTm90aWZpY2F0aW9uIHtcXG4gIGlkICAgICAgU3RyaW5nICAgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdXNlcklkICBTdHJpbmdcXG4gIHR5cGUgICAgTm90aWZpY2F0aW9uVHlwZVxcbiAgdGl0bGUgICBTdHJpbmdcXG4gIG1lc3NhZ2UgU3RyaW5nXFxuICBsaW5rICAgIFN0cmluZz9cXG4gIGlzUmVhZCAgQm9vbGVhbiAgICAgICAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG5cXG4gIHVzZXIgVXNlciBAcmVsYXRpb24oZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW3VzZXJJZCwgaXNSZWFkLCBjcmVhdGVkQXRdKVxcbiAgQEBtYXAoXFxcIm5vdGlmaWNhdGlvbnNcXFwiKVxcbn1cXG5cXG5tb2RlbCBQYXltZW50IHtcXG4gIGlkICAgICAgICAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIGJvb2tpbmdJZCAgICAgICAgIFN0cmluZ1xcbiAgdHJhbklkICAgICAgICAgICAgU3RyaW5nICAgICAgICBAdW5pcXVlIC8vIFNTTENvbW1lcnogdHJhbnNhY3Rpb24gaWQsIGdlbmVyYXRlZCBzZXJ2ZXItc2lkZVxcbiAgdmFsSWQgICAgICAgICAgICAgU3RyaW5nPyAvLyBzZXQgYWZ0ZXIgZ2F0ZXdheSBzdWNjZXNzLCB1c2VkIGZvciBzZXJ2ZXItc2lkZSB2YWxpZGF0aW9uXFxuICBhbW91bnQgICAgICAgICAgICBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKSAvLyA9IGJvb2tpbmcudG90YWxQcmljZSBhdCBzZXNzaW9uIGNyZWF0aW9uXFxuICBjdXJyZW5jeSAgICAgICAgICBTdHJpbmcgICAgICAgIEBkZWZhdWx0KFxcXCJCRFRcXFwiKVxcbiAgc3RhdHVzICAgICAgICAgICAgUGF5bWVudFN0YXR1cyBAZGVmYXVsdChJTklUSUFURUQpXFxuICBnYXRld2F5UGFnZVVybCAgICBTdHJpbmc/XFxuICBzc2xTZXNzaW9uS2V5ICAgICBTdHJpbmc/XFxuICBjYXJkVHlwZSAgICAgICAgICBTdHJpbmc/XFxuICBiYW5rVHJhbklkICAgICAgICBTdHJpbmc/XFxuICBwYWlkQXQgICAgICAgICAgICBEYXRlVGltZT9cXG4gIHJlZnVuZFJlZklkICAgICAgIFN0cmluZz8gLy8gU1NMQ29tbWVyeiByZWZ1bmQgcmVmZXJlbmNlIChzZXQgd2hlbiBhIHJlZnVuZCBpcyBpbml0aWF0ZWQpXFxuICByZWZ1bmRJbml0aWF0ZWRBdCBEYXRlVGltZT8gLy8gc2V0IHdoZW4gYSByZWZ1bmQgYXR0ZW1wdCBzdGFydHMvZmFpbHMgKGZvciBsYXRlciByZXRyeSlcXG4gIHJlZnVuZENvbXBsZXRlZEF0IERhdGVUaW1lPyAvLyBzZXQgb25seSB3aGVuIHRoZSBnYXRld2F5IGNvbmZpcm1zIHRoZSByZWZ1bmQgc3VjY2VlZGVkXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgYm9va2luZyBCb29raW5nIEByZWxhdGlvbihmaWVsZHM6IFtib29raW5nSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcblxcbiAgQEBpbmRleChbYm9va2luZ0lkXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQG1hcChcXFwicGF5bWVudHNcXFwiKVxcbn1cXG5cXG5tb2RlbCBSZWZyZXNoVG9rZW4ge1xcbiAgaWQgICAgICAgIFN0cmluZyAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdXNlcklkICAgIFN0cmluZ1xcbiAgaGFzaCAgICAgIFN0cmluZyAgICBAdW5pcXVlIC8vIFNIQS0yNTYgb2YgdGhlIHJlZnJlc2ggSldUIFx1MjAxNCBuZXZlciBzdG9yZSB0aGUgSldUIGl0c2VsZlxcbiAgZXhwaXJlc0F0IERhdGVUaW1lXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgIEBkZWZhdWx0KG5vdygpKVxcbiAgcmV2b2tlZEF0IERhdGVUaW1lPyAvLyBzZXQgd2hlbiByb3RhdGVkIG9yIGxvZ2dlZCBvdXRcXG5cXG4gIHVzZXIgVXNlciBAcmVsYXRpb24oZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW3VzZXJJZCwgcmV2b2tlZEF0XSlcXG4gIEBAbWFwKFxcXCJyZWZyZXNoX3Rva2Vuc1xcXCIpXFxufVxcblxcbm1vZGVsIFJldmlldyB7XFxuICBpZCAgICAgICAgU3RyaW5nICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgcmF0aW5nICAgIEludFxcbiAgY29tbWVudCAgIFN0cmluZ1xcbiAgaXNEZWxldGVkIEJvb2xlYW4gQGRlZmF1bHQoZmFsc2UpXFxuXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgdXNlciAgICBVc2VyICAgICAgICBAcmVsYXRpb24oXFxcIkN1c3RvbWVyUmV2aWV3c1xcXCIsIGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYWNrYWdlIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcblxcbiAgQEB1bmlxdWUoW3VzZXJJZCwgcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3BhY2thZ2VJZF0pXFxuICBAQG1hcChcXFwicmV2aWV3c1xcXCIpXFxufVxcblxcbi8vIFRoaXMgaXMgeW91ciBQcmlzbWEgc2NoZW1hIGZpbGUsXFxuLy8gbGVhcm4gbW9yZSBhYm91dCBpdCBpbiB0aGUgZG9jczogaHR0cHM6Ly9wcmlzLmx5L2QvcHJpc21hLXNjaGVtYVxcblxcbmdlbmVyYXRvciBjbGllbnQge1xcbiAgcHJvdmlkZXIgPSBcXFwicHJpc21hLWNsaWVudFxcXCJcXG4gIG91dHB1dCAgID0gXFxcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWFcXFwiXFxufVxcblxcbmRhdGFzb3VyY2UgZGIge1xcbiAgcHJvdmlkZXIgPSBcXFwicG9zdGdyZXNxbFxcXCJcXG59XFxuXFxubW9kZWwgVG91clBhY2thZ2Uge1xcbiAgaWQgICAgICAgICAgU3RyaW5nICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdGl0bGUgICAgICAgU3RyaW5nXFxuICBzbHVnICAgICAgICBTdHJpbmcgICAgICAgIEB1bmlxdWVcXG4gIGRlc2NyaXB0aW9uIFN0cmluZ1xcbiAgbG9jYXRpb24gICAgU3RyaW5nXFxuICBwcmljZSAgICAgICBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKVxcbiAgZHVyYXRpb24gICAgSW50XFxuICByYXRpbmcgICAgICBGbG9hdCAgICAgICAgIEBkZWZhdWx0KDApXFxuICBpbWFnZXMgICAgICBTdHJpbmdbXVxcbiAgc3RhdHVzICAgICAgUGFja2FnZVN0YXR1cyBAZGVmYXVsdChQRU5ESU5HKVxcbiAgaXNEZWxldGVkICAgQm9vbGVhbiAgICAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGNhdGVnb3J5SWQgU3RyaW5nXFxuICBhZ2VudElkICAgIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGNhdGVnb3J5ICAgICAgQ2F0ZWdvcnkgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW2NhdGVnb3J5SWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgYWdlbnQgICAgICAgICBVc2VyICAgICAgICAgICBAcmVsYXRpb24oXFxcIkFnZW50UGFja2FnZXNcXFwiLCBmaWVsZHM6IFthZ2VudElkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGJvb2tpbmdzICAgICAgQm9va2luZ1tdXFxuICByZXZpZXdzICAgICAgIFJldmlld1tdXFxuICB3aXNobGlzdEl0ZW1zIFdpc2hsaXN0SXRlbVtdXFxuXFxuICBAQGluZGV4KFtjYXRlZ29yeUlkXSlcXG4gIEBAaW5kZXgoW2NhdGVnb3J5SWQsIHByaWNlXSlcXG4gIEBAaW5kZXgoW3ByaWNlXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQG1hcChcXFwidG91cl9wYWNrYWdlc1xcXCIpXFxufVxcblxcbm1vZGVsIFVzZXIge1xcbiAgaWQgICAgICAgICAgICBTdHJpbmcgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIG5hbWUgICAgICAgICAgU3RyaW5nXFxuICBlbWFpbCAgICAgICAgIFN0cmluZyAgICAgICBAdW5pcXVlXFxuICBwYXNzd29yZCAgICAgIFN0cmluZz9cXG4gIGdvb2dsZUlkICAgICAgU3RyaW5nPyAgICAgIEB1bmlxdWVcXG4gIHBob25lICAgICAgICAgU3RyaW5nP1xcbiAgYXZhdGFyVXJsICAgICBTdHJpbmc/XFxuICByb2xlICAgICAgICAgIFJvbGUgICAgICAgICBAZGVmYXVsdChVU0VSKVxcbiAgc3RhdHVzICAgICAgICBVc2VyU3RhdHVzICAgQGRlZmF1bHQoQUNUSVZFKVxcbiAgYXV0aFByb3ZpZGVyICBBdXRoUHJvdmlkZXIgQGRlZmF1bHQoQ1JFREVOVElBTClcXG4gIGVtYWlsVmVyaWZpZWQgQm9vbGVhbiAgICAgIEBkZWZhdWx0KGZhbHNlKVxcbiAgaXNEZWxldGVkICAgICBCb29sZWFuICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuICB0b2tlblZlcnNpb24gIEludCAgICAgICAgICBAZGVmYXVsdCgwKVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBhY2thZ2VzICAgICAgVG91clBhY2thZ2VbXSAgQHJlbGF0aW9uKFxcXCJBZ2VudFBhY2thZ2VzXFxcIilcXG4gIGJvb2tpbmdzICAgICAgQm9va2luZ1tdICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lckJvb2tpbmdzXFxcIilcXG4gIHJldmlld3MgICAgICAgUmV2aWV3W10gICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lclJldmlld3NcXFwiKVxcbiAgcG9zdHMgICAgICAgICBCbG9nUG9zdFtdICAgICBAcmVsYXRpb24oXFxcIkF1dGhvclBvc3RzXFxcIilcXG4gIHdpc2hsaXN0ICAgICAgV2lzaGxpc3RJdGVtW11cXG4gIG5vdGlmaWNhdGlvbnMgTm90aWZpY2F0aW9uW11cXG4gIGNvbW1lbnRzICAgICAgQmxvZ0NvbW1lbnRbXSAgQHJlbGF0aW9uKFxcXCJVc2VyQ29tbWVudHNcXFwiKVxcbiAgcmVmcmVzaFRva2VucyBSZWZyZXNoVG9rZW5bXVxcblxcbiAgQEBpbmRleChbcm9sZV0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInVzZXJzXFxcIilcXG59XFxuXFxubW9kZWwgV2lzaGxpc3RJdGVtIHtcXG4gIGlkICAgICAgICBTdHJpbmcgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHVzZXJJZCAgICBTdHJpbmdcXG4gIHBhY2thZ2VJZCBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG5cXG4gIHVzZXIgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYWNrYWdlIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcblxcbiAgQEB1bmlxdWUoW3VzZXJJZCwgcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3VzZXJJZCwgY3JlYXRlZEF0XSlcXG4gIEBAbWFwKFxcXCJ3aXNobGlzdF9pdGVtc1xcXCIpXFxufVxcblwiLFxuICBcInJ1bnRpbWVEYXRhTW9kZWxcIjoge1xuICAgIFwibW9kZWxzXCI6IHt9LFxuICAgIFwiZW51bXNcIjoge30sXG4gICAgXCJ0eXBlc1wiOiB7fVxuICB9LFxuICBcInBhcmFtZXRlcml6YXRpb25TY2hlbWFcIjoge1xuICAgIFwic3RyaW5nc1wiOiBbXSxcbiAgICBcImdyYXBoXCI6IFwiXCJcbiAgfVxufVxuXG5jb25maWcucnVudGltZURhdGFNb2RlbCA9IEpTT04ucGFyc2UoXCJ7XFxcIm1vZGVsc1xcXCI6e1xcXCJCbG9nQ29tbWVudFxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29udGVudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicG9zdElkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhcmVudElkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBvc3RcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dQb3N0XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUG9zdENvbW1lbnRzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlVzZXJDb21tZW50c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhcmVudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQmxvZ0NvbW1lbnRcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDb21tZW50UmVwbGllc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJlcGxpZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ29tbWVudFJlcGxpZXNcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImJsb2dfY29tbWVudHNcXFwifSxcXFwiQmxvZ1Bvc3RcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRpdGxlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzbHVnXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJleGNlcnB0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb250ZW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb3ZlckltYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQb3N0U3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aG9ySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aG9yXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQXV0aG9yUG9zdHNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb21tZW50c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQmxvZ0NvbW1lbnRcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJQb3N0Q29tbWVudHNcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImJsb2dfcG9zdHNcXFwifSxcXFwiQm9va2luZ1xcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhdmVsRGF0ZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0cmF2ZWxlcnNcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRvdGFsUHJpY2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRlY2ltYWxcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyQm9va2luZ3NcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGF5bWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlBheW1lbnRcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9QYXltZW50XFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJib29raW5nc1xcXCJ9LFxcXCJDYXRlZ29yeVxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDYXRlZ29yeVRvVG91clBhY2thZ2VcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImNhdGVnb3JpZXNcXFwifSxcXFwiQ29udGFjdE1lc3NhZ2VcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdWJqZWN0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJtZXNzYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc1Jlc29sdmVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImNvbnRhY3RfbWVzc2FnZXNcXFwifSxcXFwiTm90aWZpY2F0aW9uXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInR5cGVcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJOb3RpZmljYXRpb25UeXBlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidGl0bGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm1lc3NhZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImxpbmtcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzUmVhZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiTm90aWZpY2F0aW9uVG9Vc2VyXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJub3RpZmljYXRpb25zXFxcIn0sXFxcIlBheW1lbnRcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhbklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ2YWxJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYW1vdW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEZWNpbWFsXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3VycmVuY3lcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN0YXR1c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlBheW1lbnRTdGF0dXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJnYXRld2F5UGFnZVVybFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3NsU2Vzc2lvbktleVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2FyZFR5cGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJhbmtUcmFuSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhaWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyZWZ1bmRSZWZJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmdW5kSW5pdGlhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmdW5kQ29tcGxldGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvUGF5bWVudFxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwicGF5bWVudHNcXFwifSxcXFwiUmVmcmVzaFRva2VuXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImhhc2hcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImV4cGlyZXNBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2b2tlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZWZyZXNoVG9rZW5Ub1VzZXJcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInJlZnJlc2hfdG9rZW5zXFxcIn0sXFxcIlJldmlld1xcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmF0aW5nXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb21tZW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZXZpZXdUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJyZXZpZXdzXFxcIn0sXFxcIlRvdXJQYWNrYWdlXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0aXRsZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZGVzY3JpcHRpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImxvY2F0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwcmljZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImR1cmF0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyYXRpbmdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkZsb2F0XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaW1hZ2VzXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYWNrYWdlU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2F0ZWdvcnlJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYWdlbnRJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjYXRlZ29yeVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQ2F0ZWdvcnlcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDYXRlZ29yeVRvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhZ2VudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkFnZW50UGFja2FnZXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmV2aWV3VG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIndpc2hsaXN0SXRlbXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIldpc2hsaXN0SXRlbVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlRvdXJQYWNrYWdlVG9XaXNobGlzdEl0ZW1cXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInRvdXJfcGFja2FnZXNcXFwifSxcXFwiVXNlclxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhc3N3b3JkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJnb29nbGVJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGhvbmVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF2YXRhclVybFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicm9sZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlJvbGVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aFByb3ZpZGVyXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQXV0aFByb3ZpZGVyXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxWZXJpZmllZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRva2VuVmVyc2lvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBZ2VudFBhY2thZ2VzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lckJvb2tpbmdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicG9zdHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dQb3N0XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQXV0aG9yUG9zdHNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ3aXNobGlzdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiV2lzaGxpc3RJdGVtXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVXNlclRvV2lzaGxpc3RJdGVtXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibm90aWZpY2F0aW9uc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiTm90aWZpY2F0aW9uXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiTm90aWZpY2F0aW9uVG9Vc2VyXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29tbWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVXNlckNvbW1lbnRzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmcmVzaFRva2Vuc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmVmcmVzaFRva2VuXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmVmcmVzaFRva2VuVG9Vc2VyXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJ1c2Vyc1xcXCJ9LFxcXCJXaXNobGlzdEl0ZW1cXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlVzZXJUb1dpc2hsaXN0SXRlbVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVG91clBhY2thZ2VUb1dpc2hsaXN0SXRlbVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwid2lzaGxpc3RfaXRlbXNcXFwifX0sXFxcImVudW1zXFxcIjp7fSxcXFwidHlwZXNcXFwiOnt9fVwiKVxuY29uZmlnLnBhcmFtZXRlcml6YXRpb25TY2hlbWEgPSB7XG4gIHN0cmluZ3M6IEpTT04ucGFyc2UoXCJbXFxcIndoZXJlXFxcIixcXFwib3JkZXJCeVxcXCIsXFxcImN1cnNvclxcXCIsXFxcInBhY2thZ2VzXFxcIixcXFwiX2NvdW50XFxcIixcXFwiY2F0ZWdvcnlcXFwiLFxcXCJhZ2VudFxcXCIsXFxcInVzZXJcXFwiLFxcXCJwYWNrYWdlXFxcIixcXFwiYm9va2luZ1xcXCIsXFxcInBheW1lbnRzXFxcIixcXFwiYm9va2luZ3NcXFwiLFxcXCJyZXZpZXdzXFxcIixcXFwid2lzaGxpc3RJdGVtc1xcXCIsXFxcInBvc3RzXFxcIixcXFwid2lzaGxpc3RcXFwiLFxcXCJub3RpZmljYXRpb25zXFxcIixcXFwiY29tbWVudHNcXFwiLFxcXCJyZWZyZXNoVG9rZW5zXFxcIixcXFwiYXV0aG9yXFxcIixcXFwicG9zdFxcXCIsXFxcInBhcmVudFxcXCIsXFxcInJlcGxpZXNcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kVW5pcXVlXFxcIixcXFwiQmxvZ0NvbW1lbnQuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kRmlyc3RcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQmxvZ0NvbW1lbnQuZmluZE1hbnlcXFwiLFxcXCJkYXRhXFxcIixcXFwiQmxvZ0NvbW1lbnQuY3JlYXRlT25lXFxcIixcXFwiQmxvZ0NvbW1lbnQuY3JlYXRlTWFueVxcXCIsXFxcIkJsb2dDb21tZW50LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCbG9nQ29tbWVudC51cGRhdGVPbmVcXFwiLFxcXCJCbG9nQ29tbWVudC51cGRhdGVNYW55XFxcIixcXFwiQmxvZ0NvbW1lbnQudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcImNyZWF0ZVxcXCIsXFxcInVwZGF0ZVxcXCIsXFxcIkJsb2dDb21tZW50LnVwc2VydE9uZVxcXCIsXFxcIkJsb2dDb21tZW50LmRlbGV0ZU9uZVxcXCIsXFxcIkJsb2dDb21tZW50LmRlbGV0ZU1hbnlcXFwiLFxcXCJoYXZpbmdcXFwiLFxcXCJfbWluXFxcIixcXFwiX21heFxcXCIsXFxcIkJsb2dDb21tZW50Lmdyb3VwQnlcXFwiLFxcXCJCbG9nQ29tbWVudC5hZ2dyZWdhdGVcXFwiLFxcXCJCbG9nUG9zdC5maW5kVW5pcXVlXFxcIixcXFwiQmxvZ1Bvc3QuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQmxvZ1Bvc3QuZmluZE1hbnlcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVPbmVcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVNYW55XFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU9uZVxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU1hbnlcXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQmxvZ1Bvc3QudXBzZXJ0T25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlT25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlTWFueVxcXCIsXFxcIkJsb2dQb3N0Lmdyb3VwQnlcXFwiLFxcXCJCbG9nUG9zdC5hZ2dyZWdhdGVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQm9va2luZy5maW5kRmlyc3RcXFwiLFxcXCJCb29raW5nLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJCb29raW5nLmZpbmRNYW55XFxcIixcXFwiQm9va2luZy5jcmVhdGVPbmVcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCb29raW5nLnVwZGF0ZU9uZVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJvb2tpbmcudXBzZXJ0T25lXFxcIixcXFwiQm9va2luZy5kZWxldGVPbmVcXFwiLFxcXCJCb29raW5nLmRlbGV0ZU1hbnlcXFwiLFxcXCJfYXZnXFxcIixcXFwiX3N1bVxcXCIsXFxcIkJvb2tpbmcuZ3JvdXBCeVxcXCIsXFxcIkJvb2tpbmcuYWdncmVnYXRlXFxcIixcXFwiQ2F0ZWdvcnkuZmluZFVuaXF1ZVxcXCIsXFxcIkNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNhdGVnb3J5LmZpbmRNYW55XFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlT25lXFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlTWFueVxcXCIsXFxcIkNhdGVnb3J5LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVPbmVcXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVNYW55XFxcIixcXFwiQ2F0ZWdvcnkudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNhdGVnb3J5LnVwc2VydE9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU1hbnlcXFwiLFxcXCJDYXRlZ29yeS5ncm91cEJ5XFxcIixcXFwiQ2F0ZWdvcnkuYWdncmVnYXRlXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZFVuaXF1ZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlT25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwc2VydE9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5ncm91cEJ5XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuYWdncmVnYXRlXFxcIixcXFwiTm90aWZpY2F0aW9uLmZpbmRVbmlxdWVcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZEZpcnN0XFxcIixcXFwiTm90aWZpY2F0aW9uLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZE1hbnlcXFwiLFxcXCJOb3RpZmljYXRpb24uY3JlYXRlT25lXFxcIixcXFwiTm90aWZpY2F0aW9uLmNyZWF0ZU1hbnlcXFwiLFxcXCJOb3RpZmljYXRpb24uY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIk5vdGlmaWNhdGlvbi51cGRhdGVPbmVcXFwiLFxcXCJOb3RpZmljYXRpb24udXBkYXRlTWFueVxcXCIsXFxcIk5vdGlmaWNhdGlvbi51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiTm90aWZpY2F0aW9uLnVwc2VydE9uZVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5kZWxldGVPbmVcXFwiLFxcXCJOb3RpZmljYXRpb24uZGVsZXRlTWFueVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5ncm91cEJ5XFxcIixcXFwiTm90aWZpY2F0aW9uLmFnZ3JlZ2F0ZVxcXCIsXFxcIlBheW1lbnQuZmluZFVuaXF1ZVxcXCIsXFxcIlBheW1lbnQuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJQYXltZW50LmZpbmRGaXJzdFxcXCIsXFxcIlBheW1lbnQuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlBheW1lbnQuZmluZE1hbnlcXFwiLFxcXCJQYXltZW50LmNyZWF0ZU9uZVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlTWFueVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlBheW1lbnQudXBkYXRlT25lXFxcIixcXFwiUGF5bWVudC51cGRhdGVNYW55XFxcIixcXFwiUGF5bWVudC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUGF5bWVudC51cHNlcnRPbmVcXFwiLFxcXCJQYXltZW50LmRlbGV0ZU9uZVxcXCIsXFxcIlBheW1lbnQuZGVsZXRlTWFueVxcXCIsXFxcIlBheW1lbnQuZ3JvdXBCeVxcXCIsXFxcIlBheW1lbnQuYWdncmVnYXRlXFxcIixcXFwiUmVmcmVzaFRva2VuLmZpbmRVbmlxdWVcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZEZpcnN0XFxcIixcXFwiUmVmcmVzaFRva2VuLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZE1hbnlcXFwiLFxcXCJSZWZyZXNoVG9rZW4uY3JlYXRlT25lXFxcIixcXFwiUmVmcmVzaFRva2VuLmNyZWF0ZU1hbnlcXFwiLFxcXCJSZWZyZXNoVG9rZW4uY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJlZnJlc2hUb2tlbi51cGRhdGVPbmVcXFwiLFxcXCJSZWZyZXNoVG9rZW4udXBkYXRlTWFueVxcXCIsXFxcIlJlZnJlc2hUb2tlbi51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUmVmcmVzaFRva2VuLnVwc2VydE9uZVxcXCIsXFxcIlJlZnJlc2hUb2tlbi5kZWxldGVPbmVcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZGVsZXRlTWFueVxcXCIsXFxcIlJlZnJlc2hUb2tlbi5ncm91cEJ5XFxcIixcXFwiUmVmcmVzaFRva2VuLmFnZ3JlZ2F0ZVxcXCIsXFxcIlJldmlldy5maW5kVW5pcXVlXFxcIixcXFwiUmV2aWV3LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRGaXJzdFxcXCIsXFxcIlJldmlldy5maW5kRmlyc3RPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU9uZVxcXCIsXFxcIlJldmlldy5jcmVhdGVNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJSZXZpZXcudXBkYXRlT25lXFxcIixcXFwiUmV2aWV3LnVwZGF0ZU1hbnlcXFwiLFxcXCJSZXZpZXcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJldmlldy51cHNlcnRPbmVcXFwiLFxcXCJSZXZpZXcuZGVsZXRlT25lXFxcIixcXFwiUmV2aWV3LmRlbGV0ZU1hbnlcXFwiLFxcXCJSZXZpZXcuZ3JvdXBCeVxcXCIsXFxcIlJldmlldy5hZ2dyZWdhdGVcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kVW5pcXVlXFxcIixcXFwiVG91clBhY2thZ2UuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiVG91clBhY2thZ2UuZmluZE1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVNYW55XFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVG91clBhY2thZ2UudXBzZXJ0T25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlT25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLmdyb3VwQnlcXFwiLFxcXCJUb3VyUGFja2FnZS5hZ2dyZWdhdGVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiVXNlci5maW5kRmlyc3RcXFwiLFxcXCJVc2VyLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJVc2VyLmZpbmRNYW55XFxcIixcXFwiVXNlci5jcmVhdGVPbmVcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJVc2VyLnVwZGF0ZU9uZVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlVzZXIudXBzZXJ0T25lXFxcIixcXFwiVXNlci5kZWxldGVPbmVcXFwiLFxcXCJVc2VyLmRlbGV0ZU1hbnlcXFwiLFxcXCJVc2VyLmdyb3VwQnlcXFwiLFxcXCJVc2VyLmFnZ3JlZ2F0ZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kVW5pcXVlXFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRGaXJzdFxcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLmNyZWF0ZU9uZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5jcmVhdGVNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJXaXNobGlzdEl0ZW0udXBkYXRlT25lXFxcIixcXFwiV2lzaGxpc3RJdGVtLnVwZGF0ZU1hbnlcXFwiLFxcXCJXaXNobGlzdEl0ZW0udXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIldpc2hsaXN0SXRlbS51cHNlcnRPbmVcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZGVsZXRlT25lXFxcIixcXFwiV2lzaGxpc3RJdGVtLmRlbGV0ZU1hbnlcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZ3JvdXBCeVxcXCIsXFxcIldpc2hsaXN0SXRlbS5hZ2dyZWdhdGVcXFwiLFxcXCJBTkRcXFwiLFxcXCJPUlxcXCIsXFxcIk5PVFxcXCIsXFxcImlkXFxcIixcXFwidXNlcklkXFxcIixcXFwicGFja2FnZUlkXFxcIixcXFwiY3JlYXRlZEF0XFxcIixcXFwiZXF1YWxzXFxcIixcXFwiaW5cXFwiLFxcXCJub3RJblxcXCIsXFxcImx0XFxcIixcXFwibHRlXFxcIixcXFwiZ3RcXFwiLFxcXCJndGVcXFwiLFxcXCJub3RcXFwiLFxcXCJjb250YWluc1xcXCIsXFxcInN0YXJ0c1dpdGhcXFwiLFxcXCJlbmRzV2l0aFxcXCIsXFxcIm5hbWVcXFwiLFxcXCJlbWFpbFxcXCIsXFxcInBhc3N3b3JkXFxcIixcXFwiZ29vZ2xlSWRcXFwiLFxcXCJwaG9uZVxcXCIsXFxcImF2YXRhclVybFxcXCIsXFxcIlJvbGVcXFwiLFxcXCJyb2xlXFxcIixcXFwiVXNlclN0YXR1c1xcXCIsXFxcInN0YXR1c1xcXCIsXFxcIkF1dGhQcm92aWRlclxcXCIsXFxcImF1dGhQcm92aWRlclxcXCIsXFxcImVtYWlsVmVyaWZpZWRcXFwiLFxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJ0b2tlblZlcnNpb25cXFwiLFxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJldmVyeVxcXCIsXFxcInNvbWVcXFwiLFxcXCJub25lXFxcIixcXFwidGl0bGVcXFwiLFxcXCJzbHVnXFxcIixcXFwiZGVzY3JpcHRpb25cXFwiLFxcXCJsb2NhdGlvblxcXCIsXFxcInByaWNlXFxcIixcXFwiZHVyYXRpb25cXFwiLFxcXCJyYXRpbmdcXFwiLFxcXCJpbWFnZXNcXFwiLFxcXCJQYWNrYWdlU3RhdHVzXFxcIixcXFwiY2F0ZWdvcnlJZFxcXCIsXFxcImFnZW50SWRcXFwiLFxcXCJoYXNcXFwiLFxcXCJoYXNFdmVyeVxcXCIsXFxcImhhc1NvbWVcXFwiLFxcXCJjb21tZW50XFxcIixcXFwiaGFzaFxcXCIsXFxcImV4cGlyZXNBdFxcXCIsXFxcInJldm9rZWRBdFxcXCIsXFxcImJvb2tpbmdJZFxcXCIsXFxcInRyYW5JZFxcXCIsXFxcInZhbElkXFxcIixcXFwiYW1vdW50XFxcIixcXFwiY3VycmVuY3lcXFwiLFxcXCJQYXltZW50U3RhdHVzXFxcIixcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJzc2xTZXNzaW9uS2V5XFxcIixcXFwiY2FyZFR5cGVcXFwiLFxcXCJiYW5rVHJhbklkXFxcIixcXFwicGFpZEF0XFxcIixcXFwicmVmdW5kUmVmSWRcXFwiLFxcXCJyZWZ1bmRJbml0aWF0ZWRBdFxcXCIsXFxcInJlZnVuZENvbXBsZXRlZEF0XFxcIixcXFwiTm90aWZpY2F0aW9uVHlwZVxcXCIsXFxcInR5cGVcXFwiLFxcXCJtZXNzYWdlXFxcIixcXFwibGlua1xcXCIsXFxcImlzUmVhZFxcXCIsXFxcInN1YmplY3RcXFwiLFxcXCJpc1Jlc29sdmVkXFxcIixcXFwidHJhdmVsRGF0ZVxcXCIsXFxcInRyYXZlbGVyc1xcXCIsXFxcInRvdGFsUHJpY2VcXFwiLFxcXCJCb29raW5nU3RhdHVzXFxcIixcXFwiZXhjZXJwdFxcXCIsXFxcImNvbnRlbnRcXFwiLFxcXCJjb3ZlckltYWdlXFxcIixcXFwiUG9zdFN0YXR1c1xcXCIsXFxcImF1dGhvcklkXFxcIixcXFwicG9zdElkXFxcIixcXFwicGFyZW50SWRcXFwiLFxcXCJ1c2VySWRfcGFja2FnZUlkXFxcIixcXFwiaXNcXFwiLFxcXCJpc05vdFxcXCIsXFxcImNvbm5lY3RPckNyZWF0ZVxcXCIsXFxcInVwc2VydFxcXCIsXFxcImNyZWF0ZU1hbnlcXFwiLFxcXCJzZXRcXFwiLFxcXCJkaXNjb25uZWN0XFxcIixcXFwiZGVsZXRlXFxcIixcXFwiY29ubmVjdFxcXCIsXFxcInVwZGF0ZU1hbnlcXFwiLFxcXCJkZWxldGVNYW55XFxcIixcXFwicHVzaFxcXCIsXFxcImluY3JlbWVudFxcXCIsXFxcImRlY3JlbWVudFxcXCIsXFxcIm11bHRpcGx5XFxcIixcXFwiZGl2aWRlXFxcIl1cIiksXG4gIGdyYXBoOiBcIndBWnh3QUVQQndBQW9RTUFJQlFBQUtNREFDQVZBQUNrQXdBZ0ZnQUEtUUlBSU44QkFBQ2lBd0F3NEFFQUFDZ0FFT0VCQUFDaUF3QXc0Z0VCQUFBQUFlTUJBUURyQWdBaDVRRkFBUElDQUNILUFTQUE4QUlBSVlBQ1FBRHlBZ0Foc0FJQkFPc0NBQ0cwQWdFQTZ3SUFJYlVDQVFEc0FnQWhBUUFBQUFFQUlCY0ZBQUM0QXdBZ0JnQUFvUU1BSUFzQUFQUUNBQ0FNQUFEMUFnQWdEUUFBOXdJQUlOOEJBQUMxQXdBdzRBRUFBQU1BRU9FQkFBQzFBd0F3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDM0E0MENJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUURyQWdBaGhnSUJBT3NDQUNHSEFnRUE2d0lBSVlnQ0VBQ3ZBd0FoaVFJQ0FQRUNBQ0dLQWdnQXRnTUFJWXNDQUFELUFnQWdqUUlCQU9zQ0FDR09BZ0VBNndJQUlRVUZBQURtQlFBZ0JnQUE0QVVBSUFzQUFKNEZBQ0FNQUFDZkJRQWdEUUFBb1FVQUlCY0ZBQUM0QXdBZ0JnQUFvUU1BSUFzQUFQUUNBQ0FNQUFEMUFnQWdEUUFBOXdJQUlOOEJBQUMxQXdBdzRBRUFBQU1BRU9FQkFBQzFBd0F3NGdFQkFBQUFBZVVCUUFEeUFnQWgtZ0VBQUxjRGpRSWlfZ0VnQVBBQ0FDR0FBa0FBOGdJQUlZUUNBUURyQWdBaGhRSUJBQUFBQVlZQ0FRRHJBZ0FoaHdJQkFPc0NBQ0dJQWhBQXJ3TUFJWWtDQWdEeEFnQWhpZ0lJQUxZREFDR0xBZ0FBX2dJQUlJMENBUURyQWdBaGpnSUJBT3NDQUNFREFBQUFBd0FnQVFBQUJBQXdBZ0FBQlFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlBRUFBQUFEQUNBUEJ3QUFvUU1BSUFnQUFLc0RBQ0FLQUFDMEF3QWczd0VBQUxJREFERGdBUUFBQ1FBUTRRRUFBTElEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDekE2OENJb0FDUUFEeUFnQWhxd0pBQVBJQ0FDR3NBZ0lBOFFJQUlhMENFQUN2QXdBaEF3Y0FBT0FGQUNBSUFBRGpCUUFnQ2dBQTVRVUFJQThIQUFDaEF3QWdDQUFBcXdNQUlBb0FBTFFEQUNEZkFRQUFzZ01BTU9BQkFBQUpBQkRoQVFBQXNnTUFNT0lCQVFBQUFBSGpBUUVBNndJQUllUUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFzd092QWlLQUFrQUE4Z0lBSWFzQ1FBRHlBZ0FockFJQ0FQRUNBQ0d0QWhBQXJ3TUFJUU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FWQ1FBQXNRTUFJTjhCQUFDdUF3QXc0QUVBQUEwQUVPRUJBQUN1QXdBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ3dBNXdDSW9BQ1FBRHlBZ0FobGdJQkFPc0NBQ0dYQWdFQTZ3SUFJWmdDQVFEc0FnQWhtUUlRQUs4REFDR2FBZ0VBNndJQUlad0NBUURzQWdBaG5RSUJBT3dDQUNHZUFnRUE3QUlBSVo4Q0FRRHNBZ0Fob0FKQUFLQURBQ0doQWdFQTdBSUFJYUlDUUFDZ0F3QWhvd0pBQUtBREFDRUtDUUFBNUFVQUlKZ0NBQURDQXdBZ25BSUFBTUlEQUNDZEFnQUF3Z01BSUo0Q0FBRENBd0FnbndJQUFNSURBQ0NnQWdBQXdnTUFJS0VDQUFEQ0F3QWdvZ0lBQU1JREFDQ2pBZ0FBd2dNQUlCVUpBQUN4QXdBZzN3RUFBSzREQUREZ0FRQUFEUUFRNFFFQUFLNERBRERpQVFFQUFBQUI1UUZBQVBJQ0FDSDZBUUFBc0FPY0FpS0FBa0FBOGdJQUlaWUNBUURyQWdBaGx3SUJBQUFBQVpnQ0FRRHNBZ0FobVFJUUFLOERBQ0dhQWdFQTZ3SUFJWndDQVFEc0FnQWhuUUlCQU93Q0FDR2VBZ0VBN0FJQUlaOENBUURzQWdBaG9BSkFBS0FEQUNHaEFnRUE3QUlBSWFJQ1FBQ2dBd0Fob3dKQUFLQURBQ0VEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQVFBQUFBMEFJQTBIQUFDaEF3QWdDQUFBcXdNQUlOOEJBQUN0QXdBdzRBRUFBQklBRU9FQkFBQ3RBd0F3NGdFQkFPc0NBQ0hqQVFFQTZ3SUFJZVFCQVFEckFnQWg1UUZBQVBJQ0FDSC1BU0FBOEFJQUlZQUNRQUR5QWdBaGlnSUNBUEVDQUNHU0FnRUE2d0lBSVFJSEFBRGdCUUFnQ0FBQTR3VUFJQTRIQUFDaEF3QWdDQUFBcXdNQUlOOEJBQUN0QXdBdzRBRUFBQklBRU9FQkFBQ3RBd0F3NGdFQkFBQUFBZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUlmNEJJQUR3QWdBaGdBSkFBUElDQUNHS0FnSUE4UUlBSVpJQ0FRRHJBZ0FodGdJQUFLd0RBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnQ1FjQUFLRURBQ0FJQUFDckF3QWczd0VBQUtvREFERGdBUUFBRmdBUTRRRUFBS29EQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJUUlIQUFEZ0JRQWdDQUFBNHdVQUlBb0hBQUNoQXdBZ0NBQUFxd01BSU44QkFBQ3FBd0F3NEFFQUFCWUFFT0VCQUFDcUF3QXc0Z0VCQUFBQUFlTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWJZQ0FBQ3BBd0FnQXdBQUFCWUFJQUVBQUJjQU1BSUFBQmdBSUFFQUFBQUpBQ0FCQUFBQUVnQWdBUUFBQUJZQUlBTUFBQUFKQUNBQkFBQUtBREFDQUFBTEFDQURBQUFBRWdBZ0FRQUFFd0F3QWdBQUZBQWdFQkVBQVBrQ0FDQVRBQUNoQXdBZzN3RUFBS2NEQUREZ0FRQUFId0FRNFFFQUFLY0RBRERpQVFFQTZ3SUFJZVVCUUFEeUFnQWgtZ0VBQUtnRHN3SWlfZ0VnQVBBQ0FDR0FBa0FBOGdJQUlZUUNBUURyQWdBaGhRSUJBT3NDQUNHdkFnRUE2d0lBSWJBQ0FRRHJBZ0Foc1FJQkFPc0NBQ0d6QWdFQTZ3SUFJUUlSQUFDakJRQWdFd0FBNEFVQUlCQVJBQUQ1QWdBZ0V3QUFvUU1BSU44QkFBQ25Bd0F3NEFFQUFCOEFFT0VCQUFDbkF3QXc0Z0VCQUFBQUFlVUJRQUR5QWdBaC1nRUFBS2dEc3dJaV9nRWdBUEFDQUNHQUFrQUE4Z0lBSVlRQ0FRRHJBZ0FoaFFJQkFBQUFBYThDQVFEckFnQWhzQUlCQU9zQ0FDR3hBZ0VBNndJQUliTUNBUURyQWdBaEF3QUFBQjhBSUFFQUFDQUFNQUlBQUNFQUlBTUFBQUFXQUNBQkFBQVhBREFDQUFBWUFDQU1Cd0FBb1FNQUlOOEJBQUNsQXdBdzRBRUFBQ1FBRU9FQkFBQ2xBd0F3NGdFQkFPc0NBQ0hqQVFFQTZ3SUFJZVVCUUFEeUFnQWhoQUlCQU9zQ0FDR2xBZ0FBcGdPbEFpS21BZ0VBNndJQUlhY0NBUURzQWdBaHFBSWdBUEFDQUNFQ0J3QUE0QVVBSUtjQ0FBRENBd0FnREFjQUFLRURBQ0RmQVFBQXBRTUFNT0FCQUFBa0FCRGhBUUFBcFFNQU1PSUJBUUFBQUFIakFRRUE2d0lBSWVVQlFBRHlBZ0FoaEFJQkFPc0NBQ0dsQWdBQXBnT2xBaUttQWdFQTZ3SUFJYWNDQVFEc0FnQWhxQUlnQVBBQ0FDRURBQUFBSkFBZ0FRQUFKUUF3QWdBQUpnQWdEd2NBQUtFREFDQVVBQUNqQXdBZ0ZRQUFwQU1BSUJZQUFQa0NBQ0RmQVFBQW9nTUFNT0FCQUFBb0FCRGhBUUFBb2dNQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIbEFVQUE4Z0lBSWY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0d3QWdFQTZ3SUFJYlFDQVFEckFnQWh0UUlCQU93Q0FDRUZCd0FBNEFVQUlCUUFBT0VGQUNBVkFBRGlCUUFnRmdBQW93VUFJTFVDQUFEQ0F3QWdBd0FBQUNnQUlBRUFBQ2tBTUFJQUFBRUFJQW9IQUFDaEF3QWczd0VBQUo4REFERGdBUUFBS3dBUTRRRUFBSjhEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNVFGQUFQSUNBQ0dUQWdFQTZ3SUFJWlFDUUFEeUFnQWhsUUpBQUtBREFDRUNCd0FBNEFVQUlKVUNBQURDQXdBZ0NnY0FBS0VEQUNEZkFRQUFud01BTU9BQkFBQXJBQkRoQVFBQW53TUFNT0lCQVFBQUFBSGpBUUVBNndJQUllVUJRQUR5QWdBaGt3SUJBQUFBQVpRQ1FBRHlBZ0FobFFKQUFLQURBQ0VEQUFBQUt3QWdBUUFBTEFBd0FnQUFMUUFnQVFBQUFBTUFJQUVBQUFBSkFDQUJBQUFBRWdBZ0FRQUFBQjhBSUFFQUFBQVdBQ0FCQUFBQUpBQWdBUUFBQUNnQUlBRUFBQUFyQUNBREFBQUFLQUFnQVFBQUtRQXdBZ0FBQVFBZ0FRQUFBQ2dBSUFFQUFBQW9BQ0FEQUFBQUtBQWdBUUFBS1FBd0FnQUFBUUFnQVFBQUFDZ0FJQUVBQUFBQkFDQURBQUFBS0FBZ0FRQUFLUUF3QWdBQUFRQWdBd0FBQUNnQUlBRUFBQ2tBTUFJQUFBRUFJQU1BQUFBb0FDQUJBQUFwQURBQ0FBQUJBQ0FNQndBQV9BTUFJQlFBQVBzREFDQVZBQURfQXdBZ0ZnQUFfUU1BSU9JQkFRQUFBQUhqQVFFQUFBQUI1UUZBQUFBQUFmNEJJQUFBQUFHQUFrQUFBQUFCc0FJQkFBQUFBYlFDQVFBQUFBRzFBZ0VBQUFBQkFSd0FBRUFBSUFqaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQWJBQ0FRQUFBQUcwQWdFQUFBQUJ0UUlCQUFBQUFRRWNBQUJDQURBQkhBQUFRZ0F3QVFBQUFDZ0FJQXdIQUFENUF3QWdGQUFBN2dNQUlCVUFBTzhEQUNBV0FBRHdBd0FnNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUliQUNBUUM4QXdBaHRBSUJBTHdEQUNHMUFnRUF5QU1BSVFJQUFBQUJBQ0FjQUFCR0FDQUk0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaF9nRWdBTXdEQUNHQUFrQUF2UU1BSWJBQ0FRQzhBd0FodEFJQkFMd0RBQ0cxQWdFQXlBTUFJUUlBQUFBb0FDQWNBQUJJQUNBQ0FBQUFLQUFnSEFBQVNBQWdBUUFBQUNnQUlBTUFBQUFCQUNBakFBQkFBQ0FrQUFCR0FDQUJBQUFBQVFBZ0FRQUFBQ2dBSUFRRUFBRGRCUUFnS1FBQTN3VUFJQ29BQU40RkFDQzFBZ0FBd2dNQUlBdmZBUUFBbmdNQU1PQUJBQUJRQUJEaEFRQUFuZ01BTU9JQkFRRFBBZ0FoNHdFQkFNOENBQ0hsQVVBQTBBSUFJZjRCSUFEYkFnQWhnQUpBQU5BQ0FDR3dBZ0VBendJQUliUUNBUURQQWdBaHRRSUJBTmNDQUNFREFBQUFLQUFnQVFBQVR3QXdLQUFBVUFBZ0F3QUFBQ2dBSUFFQUFDa0FNQUlBQUFFQUlBRUFBQUFoQUNBQkFBQUFJUUFnQXdBQUFCOEFJQUVBQUNBQU1BSUFBQ0VBSUFNQUFBQWZBQ0FCQUFBZ0FEQUNBQUFoQUNBREFBQUFId0FnQVFBQUlBQXdBZ0FBSVFBZ0RSRUFBTEFFQUNBVEFBRGNCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSDZBUUFBQUxNQ0F2NEJJQUFBQUFHQUFrQUFBQUFCaEFJQkFBQUFBWVVDQVFBQUFBR3ZBZ0VBQUFBQnNBSUJBQUFBQWJFQ0FRQUFBQUd6QWdFQUFBQUJBUndBQUZnQUlBdmlBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFzd0lDX2dFZ0FBQUFBWUFDUUFBQUFBR0VBZ0VBQUFBQmhRSUJBQUFBQWE4Q0FRQUFBQUd3QWdFQUFBQUJzUUlCQUFBQUFiTUNBUUFBQUFFQkhBQUFXZ0F3QVJ3QUFGb0FNQTBSQUFDbEJBQWdFd0FBMndVQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUFvd1N6QWlMLUFTQUF6QU1BSVlBQ1FBQzlBd0FoaEFJQkFMd0RBQ0dGQWdFQXZBTUFJYThDQVFDOEF3QWhzQUlCQUx3REFDR3hBZ0VBdkFNQUliTUNBUUM4QXdBaEFnQUFBQ0VBSUJ3QUFGMEFJQXZpQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQUtNRXN3SWlfZ0VnQU13REFDR0FBa0FBdlFNQUlZUUNBUUM4QXdBaGhRSUJBTHdEQUNHdkFnRUF2QU1BSWJBQ0FRQzhBd0Foc1FJQkFMd0RBQ0d6QWdFQXZBTUFJUUlBQUFBZkFDQWNBQUJmQUNBQ0FBQUFId0FnSEFBQVh3QWdBd0FBQUNFQUlDTUFBRmdBSUNRQUFGMEFJQUVBQUFBaEFDQUJBQUFBSHdBZ0F3UUFBTmdGQUNBcEFBRGFCUUFnS2dBQTJRVUFJQTdmQVFBQW1nTUFNT0FCQUFCbUFCRGhBUUFBbWdNQU1PSUJBUURQQWdBaDVRRkFBTkFDQUNINkFRQUFtd096QWlMLUFTQUEyd0lBSVlBQ1FBRFFBZ0FoaEFJQkFNOENBQ0dGQWdFQXp3SUFJYThDQVFEUEFnQWhzQUlCQU04Q0FDR3hBZ0VBendJQUliTUNBUURQQWdBaEF3QUFBQjhBSUFFQUFHVUFNQ2dBQUdZQUlBTUFBQUFmQUNBQkFBQWdBREFDQUFBaEFDQUJBQUFBQ3dBZ0FRQUFBQXNBSUFNQUFBQUpBQ0FCQUFBS0FEQUNBQUFMQUNBREFBQUFDUUFnQVFBQUNnQXdBZ0FBQ3dBZ0F3QUFBQWtBSUFFQUFBb0FNQUlBQUFzQUlBd0hBQUNPQlFBZ0NBQUEzQVFBSUFvQUFOMEVBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3ZBZ0tBQWtBQUFBQUJxd0pBQUFBQUFhd0NBZ0FBQUFHdEFoQUFBQUFCQVJ3QUFHNEFJQW5pQVFFQUFBQUI0d0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3ZBZ0tBQWtBQUFBQUJxd0pBQUFBQUFhd0NBZ0FBQUFHdEFoQUFBQUFCQVJ3QUFIQUFNQUVjQUFCd0FEQU1Cd0FBakFVQUlBZ0FBTXdFQUNBS0FBRE5CQUFnNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVFCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBeWdTdkFpS0FBa0FBdlFNQUlhc0NRQUM5QXdBaHJBSUNBTTBEQUNHdEFoQUF5UVFBSVFJQUFBQUxBQ0FjQUFCekFDQUo0Z0VCQUx3REFDSGpBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUF5Z1N2QWlLQUFrQUF2UU1BSWFzQ1FBQzlBd0FockFJQ0FNMERBQ0d0QWhBQXlRUUFJUUlBQUFBSkFDQWNBQUIxQUNBQ0FBQUFDUUFnSEFBQWRRQWdBd0FBQUFzQUlDTUFBRzRBSUNRQUFITUFJQUVBQUFBTEFDQUJBQUFBQ1FBZ0JRUUFBTk1GQUNBcEFBRFdCUUFnS2dBQTFRVUFJRXNBQU5RRkFDQk1BQURYQlFBZ0ROOEJBQUNXQXdBdzRBRUFBSHdBRU9FQkFBQ1dBd0F3NGdFQkFNOENBQ0hqQVFFQXp3SUFJZVFCQVFEUEFnQWg1UUZBQU5BQ0FDSDZBUUFBbHdPdkFpS0FBa0FBMEFJQUlhc0NRQURRQWdBaHJBSUNBTndDQUNHdEFoQUFfQUlBSVFNQUFBQUpBQ0FCQUFCN0FEQW9BQUI4QUNBREFBQUFDUUFnQVFBQUNnQXdBZ0FBQ3dBZ0NRTUFBUE1DQUNEZkFRQUFsUU1BTU9BQkFBQ0NBUUFRNFFFQUFKVURBRERpQVFFQUFBQUI1UUZBQVBJQ0FDSHhBUUVBQUFBQmdBSkFBUElDQUNHRkFnRUFBQUFCQVFBQUFIOEFJQUVBQUFCX0FDQUpBd0FBOHdJQUlOOEJBQUNWQXdBdzRBRUFBSUlCQUJEaEFRQUFsUU1BTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0h4QVFFQTZ3SUFJWUFDUUFEeUFnQWhoUUlCQU9zQ0FDRUJBd0FBblFVQUlBTUFBQUNDQVFBZ0FRQUFnd0VBTUFJQUFIOEFJQU1BQUFDQ0FRQWdBUUFBZ3dFQU1BSUFBSDhBSUFNQUFBQ0NBUUFnQVFBQWd3RUFNQUlBQUg4QUlBWURBQURTQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUh4QVFFQUFBQUJnQUpBQUFBQUFZVUNBUUFBQUFFQkhBQUFod0VBSUFYaUFRRUFBQUFCNVFGQUFBQUFBZkVCQVFBQUFBR0FBa0FBQUFBQmhRSUJBQUFBQVFFY0FBQ0pBUUF3QVJ3QUFJa0JBREFHQXdBQXlBVUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlZQUNRQUM5QXdBaGhRSUJBTHdEQUNFQ0FBQUFmd0FnSEFBQWpBRUFJQVhpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDR0FBa0FBdlFNQUlZVUNBUUM4QXdBaEFnQUFBSUlCQUNBY0FBQ09BUUFnQWdBQUFJSUJBQ0FjQUFDT0FRQWdBd0FBQUg4QUlDTUFBSWNCQUNBa0FBQ01BUUFnQVFBQUFIOEFJQUVBQUFDQ0FRQWdBd1FBQU1VRkFDQXBBQURIQlFBZ0tnQUF4Z1VBSUFqZkFRQUFsQU1BTU9BQkFBQ1ZBUUFRNFFFQUFKUURBRERpQVFFQXp3SUFJZVVCUUFEUUFnQWg4UUVCQU04Q0FDR0FBa0FBMEFJQUlZVUNBUURQQWdBaEF3QUFBSUlCQUNBQkFBQ1VBUUF3S0FBQWxRRUFJQU1BQUFDQ0FRQWdBUUFBZ3dFQU1BSUFBSDhBSUF2ZkFRQUFrd01BTU9BQkFBQ2JBUUFRNFFFQUFKTURBRERpQVFFQUFBQUI1UUZBQVBJQ0FDSHhBUUVBNndJQUlmSUJBUURyQWdBaGdBSkFBUElDQUNHbUFnRUE2d0lBSWFrQ0FRRHJBZ0FocWdJZ0FQQUNBQ0VCQUFBQW1BRUFJQUVBQUFDWUFRQWdDOThCQUFDVEF3QXc0QUVBQUpzQkFCRGhBUUFBa3dNQU1PSUJBUURyQWdBaDVRRkFBUElDQUNIeEFRRUE2d0lBSWZJQkFRRHJBZ0FoZ0FKQUFQSUNBQ0dtQWdFQTZ3SUFJYWtDQVFEckFnQWhxZ0lnQVBBQ0FDRUFBd0FBQUpzQkFDQUJBQUNjQVFBd0FnQUFtQUVBSUFNQUFBQ2JBUUFnQVFBQW5BRUFNQUlBQUpnQkFDQURBQUFBbXdFQUlBRUFBSndCQURBQ0FBQ1lBUUFnQ09JQkFRQUFBQUhsQVVBQUFBQUI4UUVCQUFBQUFmSUJBUUFBQUFHQUFrQUFBQUFCcGdJQkFBQUFBYWtDQVFBQUFBR3FBaUFBQUFBQkFSd0FBS0FCQUNBSTRnRUJBQUFBQWVVQlFBQUFBQUh4QVFFQUFBQUI4Z0VCQUFBQUFZQUNRQUFBQUFHbUFnRUFBQUFCcVFJQkFBQUFBYW9DSUFBQUFBRUJIQUFBb2dFQU1BRWNBQUNpQVFBd0NPSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoZ0FKQUFMMERBQ0dtQWdFQXZBTUFJYWtDQVFDOEF3QWhxZ0lnQU13REFDRUNBQUFBbUFFQUlCd0FBS1VCQUNBSTRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0dBQWtBQXZRTUFJYVlDQVFDOEF3QWhxUUlCQUx3REFDR3FBaUFBekFNQUlRSUFBQUNiQVFBZ0hBQUFwd0VBSUFJQUFBQ2JBUUFnSEFBQXB3RUFJQU1BQUFDWUFRQWdJd0FBb0FFQUlDUUFBS1VCQUNBQkFBQUFtQUVBSUFFQUFBQ2JBUUFnQXdRQUFNSUZBQ0FwQUFERUJRQWdLZ0FBd3dVQUlBdmZBUUFBa2dNQU1PQUJBQUN1QVFBUTRRRUFBSklEQUREaUFRRUF6d0lBSWVVQlFBRFFBZ0FoOFFFQkFNOENBQ0h5QVFFQXp3SUFJWUFDUUFEUUFnQWhwZ0lCQU04Q0FDR3BBZ0VBendJQUlhb0NJQURiQWdBaEF3QUFBSnNCQUNBQkFBQ3RBUUF3S0FBQXJnRUFJQU1BQUFDYkFRQWdBUUFBbkFFQU1BSUFBSmdCQUNBQkFBQUFKZ0FnQVFBQUFDWUFJQU1BQUFBa0FDQUJBQUFsQURBQ0FBQW1BQ0FEQUFBQUpBQWdBUUFBSlFBd0FnQUFKZ0FnQXdBQUFDUUFJQUVBQUNVQU1BSUFBQ1lBSUFrSEFBREJCUUFnNGdFQkFBQUFBZU1CQVFBQUFBSGxBVUFBQUFBQmhBSUJBQUFBQWFVQ0FBQUFwUUlDcGdJQkFBQUFBYWNDQVFBQUFBR29BaUFBQUFBQkFSd0FBTFlCQUNBSTRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJoQUlCQUFBQUFhVUNBQUFBcFFJQ3BnSUJBQUFBQWFjQ0FRQUFBQUdvQWlBQUFBQUJBUndBQUxnQkFEQUJIQUFBdUFFQU1Ba0hBQURBQlFBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoaEFJQkFMd0RBQ0dsQWdBQWlnU2xBaUttQWdFQXZBTUFJYWNDQVFESUF3QWhxQUlnQU13REFDRUNBQUFBSmdBZ0hBQUF1d0VBSUFqaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0dFQWdFQXZBTUFJYVVDQUFDS0JLVUNJcVlDQVFDOEF3QWhwd0lCQU1nREFDR29BaUFBekFNQUlRSUFBQUFrQUNBY0FBQzlBUUFnQWdBQUFDUUFJQndBQUwwQkFDQURBQUFBSmdBZ0l3QUF0Z0VBSUNRQUFMc0JBQ0FCQUFBQUpnQWdBUUFBQUNRQUlBUUVBQUM5QlFBZ0tRQUF2d1VBSUNvQUFMNEZBQ0NuQWdBQXdnTUFJQXZmQVFBQWpnTUFNT0FCQUFERUFRQVE0UUVBQUk0REFERGlBUUVBendJQUllTUJBUURQQWdBaDVRRkFBTkFDQUNHRUFnRUF6d0lBSWFVQ0FBQ1BBNlVDSXFZQ0FRRFBBZ0FocHdJQkFOY0NBQ0dvQWlBQTJ3SUFJUU1BQUFBa0FDQUJBQUREQVFBd0tBQUF4QUVBSUFNQUFBQWtBQ0FCQUFBbEFEQUNBQUFtQUNBQkFBQUFEd0FnQVFBQUFBOEFJQU1BQUFBTkFDQUJBQUFPQURBQ0FBQVBBQ0FEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQXdBQUFBMEFJQUVBQUE0QU1BSUFBQThBSUJJSkFBQzhCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSDZBUUFBQUp3Q0FvQUNRQUFBQUFHV0FnRUFBQUFCbHdJQkFBQUFBWmdDQVFBQUFBR1pBaEFBQUFBQm1nSUJBQUFBQVp3Q0FRQUFBQUdkQWdFQUFBQUJuZ0lCQUFBQUFaOENBUUFBQUFHZ0FrQUFBQUFCb1FJQkFBQUFBYUlDUUFBQUFBR2pBa0FBQUFBQkFSd0FBTXdCQUNBUjRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFKd0NBb0FDUUFBQUFBR1dBZ0VBQUFBQmx3SUJBQUFBQVpnQ0FRQUFBQUdaQWhBQUFBQUJtZ0lCQUFBQUFad0NBUUFBQUFHZEFnRUFBQUFCbmdJQkFBQUFBWjhDQVFBQUFBR2dBa0FBQUFBQm9RSUJBQUFBQWFJQ1FBQUFBQUdqQWtBQUFBQUJBUndBQU00QkFEQUJIQUFBemdFQU1CSUpBQUM3QlFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBRFlCSndDSW9BQ1FBQzlBd0FobGdJQkFMd0RBQ0dYQWdFQXZBTUFJWmdDQVFESUF3QWhtUUlRQU1rRUFDR2FBZ0VBdkFNQUlad0NBUURJQXdBaG5RSUJBTWdEQUNHZUFnRUF5QU1BSVo4Q0FRRElBd0Fob0FKQUFPQURBQ0doQWdFQXlBTUFJYUlDUUFEZ0F3QWhvd0pBQU9BREFDRUNBQUFBRHdBZ0hBQUEwUUVBSUJIaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFOZ0VuQUlpZ0FKQUFMMERBQ0dXQWdFQXZBTUFJWmNDQVFDOEF3QWhtQUlCQU1nREFDR1pBaEFBeVFRQUlab0NBUUM4QXdBaG5BSUJBTWdEQUNHZEFnRUF5QU1BSVo0Q0FRRElBd0FobndJQkFNZ0RBQ0dnQWtBQTRBTUFJYUVDQVFESUF3QWhvZ0pBQU9BREFDR2pBa0FBNEFNQUlRSUFBQUFOQUNBY0FBRFRBUUFnQWdBQUFBMEFJQndBQU5NQkFDQURBQUFBRHdBZ0l3QUF6QUVBSUNRQUFORUJBQ0FCQUFBQUR3QWdBUUFBQUEwQUlBNEVBQUMyQlFBZ0tRQUF1UVVBSUNvQUFMZ0ZBQ0JMQUFDM0JRQWdUQUFBdWdVQUlKZ0NBQURDQXdBZ25BSUFBTUlEQUNDZEFnQUF3Z01BSUo0Q0FBRENBd0FnbndJQUFNSURBQ0NnQWdBQXdnTUFJS0VDQUFEQ0F3QWdvZ0lBQU1JREFDQ2pBZ0FBd2dNQUlCVGZBUUFBaWdNQU1PQUJBQURhQVFBUTRRRUFBSW9EQUREaUFRRUF6d0lBSWVVQlFBRFFBZ0FoLWdFQUFJc0RuQUlpZ0FKQUFOQUNBQ0dXQWdFQXp3SUFJWmNDQVFEUEFnQWhtQUlCQU5jQ0FDR1pBaEFBX0FJQUlab0NBUURQQWdBaG5BSUJBTmNDQUNHZEFnRUExd0lBSVo0Q0FRRFhBZ0FobndJQkFOY0NBQ0dnQWtBQWh3TUFJYUVDQVFEWEFnQWhvZ0pBQUljREFDR2pBa0FBaHdNQUlRTUFBQUFOQUNBQkFBRFpBUUF3S0FBQTJnRUFJQU1BQUFBTkFDQUJBQUFPQURBQ0FBQVBBQ0FCQUFBQUxRQWdBUUFBQUMwQUlBTUFBQUFyQUNBQkFBQXNBREFDQUFBdEFDQURBQUFBS3dBZ0FRQUFMQUF3QWdBQUxRQWdBd0FBQUNzQUlBRUFBQ3dBTUFJQUFDMEFJQWNIQUFDMUJRQWc0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCa3dJQkFBQUFBWlFDUUFBQUFBR1ZBa0FBQUFBQkFSd0FBT0lCQUNBRzRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJrd0lCQUFBQUFaUUNRQUFBQUFHVkFrQUFBQUFCQVJ3QUFPUUJBREFCSEFBQTVBRUFNQWNIQUFDMEJRQWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaGt3SUJBTHdEQUNHVUFrQUF2UU1BSVpVQ1FBRGdBd0FoQWdBQUFDMEFJQndBQU9jQkFDQUc0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaGt3SUJBTHdEQUNHVUFrQUF2UU1BSVpVQ1FBRGdBd0FoQWdBQUFDc0FJQndBQU9rQkFDQUNBQUFBS3dBZ0hBQUE2UUVBSUFNQUFBQXRBQ0FqQUFEaUFRQWdKQUFBNXdFQUlBRUFBQUF0QUNBQkFBQUFLd0FnQkFRQUFMRUZBQ0FwQUFDekJRQWdLZ0FBc2dVQUlKVUNBQURDQXdBZ0NkOEJBQUNHQXdBdzRBRUFBUEFCQUJEaEFRQUFoZ01BTU9JQkFRRFBBZ0FoNHdFQkFNOENBQ0hsQVVBQTBBSUFJWk1DQVFEUEFnQWhsQUpBQU5BQ0FDR1ZBa0FBaHdNQUlRTUFBQUFyQUNBQkFBRHZBUUF3S0FBQThBRUFJQU1BQUFBckFDQUJBQUFzQURBQ0FBQXRBQ0FCQUFBQUZBQWdBUUFBQUJRQUlBTUFBQUFTQUNBQkFBQVRBREFDQUFBVUFDQURBQUFBRWdBZ0FRQUFFd0F3QWdBQUZBQWdBd0FBQUJJQUlBRUFBQk1BTUFJQUFCUUFJQW9IQUFDREJRQWdDQUFBdmdRQUlPSUJBUUFBQUFIakFRRUFBQUFCNUFFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQVlvQ0FnQUFBQUdTQWdFQUFBQUJBUndBQVBnQkFDQUk0Z0VCQUFBQUFlTUJBUUFBQUFIa0FRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQmlnSUNBQUFBQVpJQ0FRQUFBQUVCSEFBQS1nRUFNQUVjQUFENkFRQXdDZ2NBQUlFRkFDQUlBQUM4QkFBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVRQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhpZ0lDQU0wREFDR1NBZ0VBdkFNQUlRSUFBQUFVQUNBY0FBRDlBUUFnQ09JQkFRQzhBd0FoNHdFQkFMd0RBQ0hrQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUlZb0NBZ0ROQXdBaGtnSUJBTHdEQUNFQ0FBQUFFZ0FnSEFBQV93RUFJQUlBQUFBU0FDQWNBQURfQVFBZ0F3QUFBQlFBSUNNQUFQZ0JBQ0FrQUFEOUFRQWdBUUFBQUJRQUlBRUFBQUFTQUNBRkJBQUFyQVVBSUNrQUFLOEZBQ0FxQUFDdUJRQWdTd0FBclFVQUlFd0FBTEFGQUNBTDN3RUFBSVVEQUREZ0FRQUFoZ0lBRU9FQkFBQ0ZBd0F3NGdFQkFNOENBQ0hqQVFFQXp3SUFJZVFCQVFEUEFnQWg1UUZBQU5BQ0FDSC1BU0FBMndJQUlZQUNRQURRQWdBaGlnSUNBTndDQUNHU0FnRUF6d0lBSVFNQUFBQVNBQ0FCQUFDRkFnQXdLQUFBaGdJQUlBTUFBQUFTQUNBQkFBQVRBREFDQUFBVUFDQUJBQUFBQlFBZ0FRQUFBQVVBSUFNQUFBQURBQ0FCQUFBRUFEQUNBQUFGQUNBREFBQUFBd0FnQVFBQUJBQXdBZ0FBQlFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlCUUZBQUNSQlFBZ0JnQUFxd1VBSUFzQUFKSUZBQ0FNQUFDVEJRQWdEUUFBbEFVQUlPSUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ05BZ0wtQVNBQUFBQUJnQUpBQUFBQUFZUUNBUUFBQUFHRkFnRUFBQUFCaGdJQkFBQUFBWWNDQVFBQUFBR0lBaEFBQUFBQmlRSUNBQUFBQVlvQ0NBQUFBQUdMQWdBQWtBVUFJSTBDQVFBQUFBR09BZ0VBQUFBQkFSd0FBSTRDQUNBUDRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFJMENBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUdHQWdFQUFBQUJod0lCQUFBQUFZZ0NFQUFBQUFHSkFnSUFBQUFCaWdJSUFBQUFBWXNDQUFDUUJRQWdqUUlCQUFBQUFZNENBUUFBQUFFQkhBQUFrQUlBTUFFY0FBQ1FBZ0F3RkFVQUFPd0VBQ0FHQUFDcUJRQWdDd0FBN1FRQUlBd0FBTzRFQUNBTkFBRHZCQUFnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFEcUJJMENJdjRCSUFETUF3QWhnQUpBQUwwREFDR0VBZ0VBdkFNQUlZVUNBUUM4QXdBaGhnSUJBTHdEQUNHSEFnRUF2QU1BSVlnQ0VBREpCQUFoaVFJQ0FNMERBQ0dLQWdnQTZBUUFJWXNDQUFEcEJBQWdqUUlCQUx3REFDR09BZ0VBdkFNQUlRSUFBQUFGQUNBY0FBQ1RBZ0FnRC1JQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTZnU05BaUwtQVNBQXpBTUFJWUFDUUFDOUF3QWhoQUlCQUx3REFDR0ZBZ0VBdkFNQUlZWUNBUUM4QXdBaGh3SUJBTHdEQUNHSUFoQUF5UVFBSVlrQ0FnRE5Bd0FoaWdJSUFPZ0VBQ0dMQWdBQTZRUUFJSTBDQVFDOEF3QWhqZ0lCQUx3REFDRUNBQUFBQXdBZ0hBQUFsUUlBSUFJQUFBQURBQ0FjQUFDVkFnQWdBd0FBQUFVQUlDTUFBSTRDQUNBa0FBQ1RBZ0FnQVFBQUFBVUFJQUVBQUFBREFDQUZCQUFBcFFVQUlDa0FBS2dGQUNBcUFBQ25CUUFnU3dBQXBnVUFJRXdBQUtrRkFDQVMzd0VBQVBzQ0FERGdBUUFBbkFJQUVPRUJBQUQ3QWdBdzRnRUJBTThDQUNIbEFVQUEwQUlBSWZvQkFBRF9BbzBDSXY0QklBRGJBZ0FoZ0FKQUFOQUNBQ0dFQWdFQXp3SUFJWVVDQVFEUEFnQWhoZ0lCQU04Q0FDR0hBZ0VBendJQUlZZ0NFQUQ4QWdBaGlRSUNBTndDQUNHS0FnZ0FfUUlBSVlzQ0FBRC1BZ0FnalFJQkFNOENBQ0dPQWdFQXp3SUFJUU1BQUFBREFDQUJBQUNiQWdBd0tBQUFuQUlBSUFNQUFBQURBQ0FCQUFBRUFEQUNBQUFGQUNBYUF3QUE4d0lBSUFzQUFQUUNBQ0FNQUFEMUFnQWdEZ0FBOWdJQUlBOEFBUGNDQUNBUUFBRDRBZ0FnRVFBQS1RSUFJQklBQVBvQ0FDRGZBUUFBNmdJQU1PQUJBQUNpQWdBUTRRRUFBT29DQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0h4QVFFQTZ3SUFJZklCQVFBQUFBSHpBUUVBN0FJQUlmUUJBUUFBQUFIMUFRRUE3QUlBSWZZQkFRRHNBZ0FoLUFFQUFPMEMtQUVpLWdFQUFPNEMtZ0VpX0FFQUFPOENfQUVpX1FFZ0FQQUNBQ0gtQVNBQThBSUFJZjhCQWdEeEFnQWhnQUpBQVBJQ0FDRUJBQUFBbndJQUlBRUFBQUNmQWdBZ0dnTUFBUE1DQUNBTEFBRDBBZ0FnREFBQTlRSUFJQTRBQVBZQ0FDQVBBQUQzQWdBZ0VBQUEtQUlBSUJFQUFQa0NBQ0FTQUFENkFnQWczd0VBQU9vQ0FERGdBUUFBb2dJQUVPRUJBQURxQWdBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZFQkFRRHJBZ0FoOGdFQkFPc0NBQ0h6QVFFQTdBSUFJZlFCQVFEc0FnQWg5UUVCQU93Q0FDSDJBUUVBN0FJQUlmZ0JBQUR0QXZnQkl2b0JBQUR1QXZvQkl2d0JBQUR2QXZ3Qkl2MEJJQUR3QWdBaF9nRWdBUEFDQUNIX0FRSUE4UUlBSVlBQ1FBRHlBZ0FoREFNQUFKMEZBQ0FMQUFDZUJRQWdEQUFBbndVQUlBNEFBS0FGQUNBUEFBQ2hCUUFnRUFBQW9nVUFJQkVBQUtNRkFDQVNBQUNrQlFBZzh3RUFBTUlEQUNEMEFRQUF3Z01BSVBVQkFBRENBd0FnOWdFQUFNSURBQ0FEQUFBQW9nSUFJQUVBQUtNQ0FEQUNBQUNmQWdBZ0F3QUFBS0lDQUNBQkFBQ2pBZ0F3QWdBQW53SUFJQU1BQUFDaUFnQWdBUUFBb3dJQU1BSUFBSjhDQUNBWEF3QUFsUVVBSUFzQUFKWUZBQ0FNQUFDWEJRQWdEZ0FBbUFVQUlBOEFBSmtGQUNBUUFBQ2FCUUFnRVFBQW13VUFJQklBQUp3RkFDRGlBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUh5QVFFQUFBQUI4d0VCQUFBQUFmUUJBUUFBQUFIMUFRRUFBQUFCOWdFQkFBQUFBZmdCQUFBQS1BRUMtZ0VBQUFENkFRTDhBUUFBQVB3QkF2MEJJQUFBQUFILUFTQUFBQUFCX3dFQ0FBQUFBWUFDUUFBQUFBRUJIQUFBcHdJQUlBX2lBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUh5QVFFQUFBQUI4d0VCQUFBQUFmUUJBUUFBQUFIMUFRRUFBQUFCOWdFQkFBQUFBZmdCQUFBQS1BRUMtZ0VBQUFENkFRTDhBUUFBQVB3QkF2MEJJQUFBQUFILUFTQUFBQUFCX3dFQ0FBQUFBWUFDUUFBQUFBRUJIQUFBcVFJQU1BRWNBQUNwQWdBd0Z3TUFBTTREQUNBTEFBRFBBd0FnREFBQTBBTUFJQTRBQU5FREFDQVBBQURTQXdBZ0VBQUEwd01BSUJFQUFOUURBQ0FTQUFEVkF3QWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaEFnQUFBSjhDQUNBY0FBQ3NBZ0FnRC1JQkFRQzhBd0FoNVFGQUFMMERBQ0h4QVFFQXZBTUFJZklCQVFDOEF3QWg4d0VCQU1nREFDSDBBUUVBeUFNQUlmVUJBUURJQXdBaDlnRUJBTWdEQUNINEFRQUF5UVA0QVNMNkFRQUF5Z1A2QVNMOEFRQUF5d1A4QVNMOUFTQUF6QU1BSWY0QklBRE1Bd0FoX3dFQ0FNMERBQ0dBQWtBQXZRTUFJUUlBQUFDaUFnQWdIQUFBcmdJQUlBSUFBQUNpQWdBZ0hBQUFyZ0lBSUFNQUFBQ2ZBZ0FnSXdBQXB3SUFJQ1FBQUt3Q0FDQUJBQUFBbndJQUlBRUFBQUNpQWdBZ0NRUUFBTU1EQUNBcEFBREdBd0FnS2dBQXhRTUFJRXNBQU1RREFDQk1BQURIQXdBZzh3RUFBTUlEQUNEMEFRQUF3Z01BSVBVQkFBRENBd0FnOWdFQUFNSURBQ0FTM3dFQUFOWUNBRERnQVFBQXRRSUFFT0VCQUFEV0FnQXc0Z0VCQU04Q0FDSGxBVUFBMEFJQUlmRUJBUURQQWdBaDhnRUJBTThDQUNIekFRRUExd0lBSWZRQkFRRFhBZ0FoOVFFQkFOY0NBQ0gyQVFFQTF3SUFJZmdCQUFEWUF2Z0JJdm9CQUFEWkF2b0JJdndCQUFEYUF2d0JJdjBCSUFEYkFnQWhfZ0VnQU5zQ0FDSF9BUUlBM0FJQUlZQUNRQURRQWdBaEF3QUFBS0lDQUNBQkFBQzBBZ0F3S0FBQXRRSUFJQU1BQUFDaUFnQWdBUUFBb3dJQU1BSUFBSjhDQUNBQkFBQUFHQUFnQVFBQUFCZ0FJQU1BQUFBV0FDQUJBQUFYQURBQ0FBQVlBQ0FEQUFBQUZnQWdBUUFBRndBd0FnQUFHQUFnQXdBQUFCWUFJQUVBQUJjQU1BSUFBQmdBSUFZSEFBREFBd0FnQ0FBQXdRTUFJT0lCQVFBQUFBSGpBUUVBQUFBQjVBRUJBQUFBQWVVQlFBQUFBQUVCSEFBQXZRSUFJQVRpQVFFQUFBQUI0d0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCQVJ3QUFMOENBREFCSEFBQXZ3SUFNQVlIQUFDLUF3QWdDQUFBdndNQUlPSUJBUUM4QXdBaDR3RUJBTHdEQUNIa0FRRUF2QU1BSWVVQlFBQzlBd0FoQWdBQUFCZ0FJQndBQU1JQ0FDQUU0Z0VCQUx3REFDSGpBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNFQ0FBQUFGZ0FnSEFBQXhBSUFJQUlBQUFBV0FDQWNBQURFQWdBZ0F3QUFBQmdBSUNNQUFMMENBQ0FrQUFEQ0FnQWdBUUFBQUJnQUlBRUFBQUFXQUNBREJBQUF1UU1BSUNrQUFMc0RBQ0FxQUFDNkF3QWdCOThCQUFET0FnQXc0QUVBQU1zQ0FCRGhBUUFBemdJQU1PSUJBUURQQWdBaDR3RUJBTThDQUNIa0FRRUF6d0lBSWVVQlFBRFFBZ0FoQXdBQUFCWUFJQUVBQU1vQ0FEQW9BQURMQWdBZ0F3QUFBQllBSUFFQUFCY0FNQUlBQUJnQUlBZmZBUUFBemdJQU1PQUJBQURMQWdBUTRRRUFBTTRDQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNUFFQkFNOENBQ0hsQVVBQTBBSUFJUTRFQUFEU0FnQWdLUUFBMVFJQUlDb0FBTlVDQUNEbUFRRUFBQUFCNXdFQkFBQUFCT2dCQVFBQUFBVHBBUUVBQUFBQjZnRUJBQUFBQWVzQkFRQUFBQUhzQVFFQUFBQUI3UUVCQU5RQ0FDSHVBUUVBQUFBQjd3RUJBQUFBQWZBQkFRQUFBQUVMQkFBQTBnSUFJQ2tBQU5NQ0FDQXFBQURUQWdBZzVnRkFBQUFBQWVjQlFBQUFBQVRvQVVBQUFBQUU2UUZBQUFBQUFlb0JRQUFBQUFIckFVQUFBQUFCN0FGQUFBQUFBZTBCUUFEUkFnQWhDd1FBQU5JQ0FDQXBBQURUQWdBZ0tnQUEwd0lBSU9ZQlFBQUFBQUhuQVVBQUFBQUU2QUZBQUFBQUJPa0JRQUFBQUFIcUFVQUFBQUFCNndGQUFBQUFBZXdCUUFBQUFBSHRBVUFBMFFJQUlRam1BUUlBQUFBQjV3RUNBQUFBQk9nQkFnQUFBQVRwQVFJQUFBQUI2Z0VDQUFBQUFlc0JBZ0FBQUFIc0FRSUFBQUFCN1FFQ0FOSUNBQ0VJNWdGQUFBQUFBZWNCUUFBQUFBVG9BVUFBQUFBRTZRRkFBQUFBQWVvQlFBQUFBQUhyQVVBQUFBQUI3QUZBQUFBQUFlMEJRQURUQWdBaERnUUFBTklDQUNBcEFBRFZBZ0FnS2dBQTFRSUFJT1lCQVFBQUFBSG5BUUVBQUFBRTZBRUJBQUFBQk9rQkFRQUFBQUhxQVFFQUFBQUI2d0VCQUFBQUFld0JBUUFBQUFIdEFRRUExQUlBSWU0QkFRQUFBQUh2QVFFQUFBQUI4QUVCQUFBQUFRdm1BUUVBQUFBQjV3RUJBQUFBQk9nQkFRQUFBQVRwQVFFQUFBQUI2Z0VCQUFBQUFlc0JBUUFBQUFIc0FRRUFBQUFCN1FFQkFOVUNBQ0h1QVFFQUFBQUI3d0VCQUFBQUFmQUJBUUFBQUFFUzN3RUFBTllDQUREZ0FRQUF0UUlBRU9FQkFBRFdBZ0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZkVCQVFEUEFnQWg4Z0VCQU04Q0FDSHpBUUVBMXdJQUlmUUJBUURYQWdBaDlRRUJBTmNDQUNIMkFRRUExd0lBSWZnQkFBRFlBdmdCSXZvQkFBRFpBdm9CSXZ3QkFBRGFBdndCSXYwQklBRGJBZ0FoX2dFZ0FOc0NBQ0hfQVFJQTNBSUFJWUFDUUFEUUFnQWhEZ1FBQU9nQ0FDQXBBQURwQWdBZ0tnQUE2UUlBSU9ZQkFRQUFBQUhuQVFFQUFBQUY2QUVCQUFBQUJla0JBUUFBQUFIcUFRRUFBQUFCNndFQkFBQUFBZXdCQVFBQUFBSHRBUUVBNXdJQUllNEJBUUFBQUFIdkFRRUFBQUFCOEFFQkFBQUFBUWNFQUFEU0FnQWdLUUFBNWdJQUlDb0FBT1lDQUNEbUFRQUFBUGdCQXVjQkFBQUEtQUVJNkFFQUFBRDRBUWp0QVFBQTVRTDRBU0lIQkFBQTBnSUFJQ2tBQU9RQ0FDQXFBQURrQWdBZzVnRUFBQUQ2QVFMbkFRQUFBUG9CQ09nQkFBQUEtZ0VJN1FFQUFPTUMtZ0VpQndRQUFOSUNBQ0FwQUFEaUFnQWdLZ0FBNGdJQUlPWUJBQUFBX0FFQzV3RUFBQUQ4QVFqb0FRQUFBUHdCQ08wQkFBRGhBdndCSWdVRUFBRFNBZ0FnS1FBQTRBSUFJQ29BQU9BQ0FDRG1BU0FBQUFBQjdRRWdBTjhDQUNFTkJBQUEwZ0lBSUNrQUFOSUNBQ0FxQUFEU0FnQWdTd0FBM2dJQUlFd0FBTklDQUNEbUFRSUFBQUFCNXdFQ0FBQUFCT2dCQWdBQUFBVHBBUUlBQUFBQjZnRUNBQUFBQWVzQkFnQUFBQUhzQVFJQUFBQUI3UUVDQU4wQ0FDRU5CQUFBMGdJQUlDa0FBTklDQUNBcUFBRFNBZ0FnU3dBQTNnSUFJRXdBQU5JQ0FDRG1BUUlBQUFBQjV3RUNBQUFBQk9nQkFnQUFBQVRwQVFJQUFBQUI2Z0VDQUFBQUFlc0JBZ0FBQUFIc0FRSUFBQUFCN1FFQ0FOMENBQ0VJNWdFSUFBQUFBZWNCQ0FBQUFBVG9BUWdBQUFBRTZRRUlBQUFBQWVvQkNBQUFBQUhyQVFnQUFBQUI3QUVJQUFBQUFlMEJDQURlQWdBaEJRUUFBTklDQUNBcEFBRGdBZ0FnS2dBQTRBSUFJT1lCSUFBQUFBSHRBU0FBM3dJQUlRTG1BU0FBQUFBQjdRRWdBT0FDQUNFSEJBQUEwZ0lBSUNrQUFPSUNBQ0FxQUFEaUFnQWc1Z0VBQUFEOEFRTG5BUUFBQVB3QkNPZ0JBQUFBX0FFSTdRRUFBT0VDX0FFaUJPWUJBQUFBX0FFQzV3RUFBQUQ4QVFqb0FRQUFBUHdCQ08wQkFBRGlBdndCSWdjRUFBRFNBZ0FnS1FBQTVBSUFJQ29BQU9RQ0FDRG1BUUFBQVBvQkF1Y0JBQUFBLWdFSTZBRUFBQUQ2QVFqdEFRQUE0d0w2QVNJRTVnRUFBQUQ2QVFMbkFRQUFBUG9CQ09nQkFBQUEtZ0VJN1FFQUFPUUMtZ0VpQndRQUFOSUNBQ0FwQUFEbUFnQWdLZ0FBNWdJQUlPWUJBQUFBLUFFQzV3RUFBQUQ0QVFqb0FRQUFBUGdCQ08wQkFBRGxBdmdCSWdUbUFRQUFBUGdCQXVjQkFBQUEtQUVJNkFFQUFBRDRBUWp0QVFBQTVnTDRBU0lPQkFBQTZBSUFJQ2tBQU9rQ0FDQXFBQURwQWdBZzVnRUJBQUFBQWVjQkFRQUFBQVhvQVFFQUFBQUY2UUVCQUFBQUFlb0JBUUFBQUFIckFRRUFBQUFCN0FFQkFBQUFBZTBCQVFEbkFnQWg3Z0VCQUFBQUFlOEJBUUFBQUFId0FRRUFBQUFCQ09ZQkFnQUFBQUhuQVFJQUFBQUY2QUVDQUFBQUJla0JBZ0FBQUFIcUFRSUFBQUFCNndFQ0FBQUFBZXdCQWdBQUFBSHRBUUlBNkFJQUlRdm1BUUVBQUFBQjV3RUJBQUFBQmVnQkFRQUFBQVhwQVFFQUFBQUI2Z0VCQUFBQUFlc0JBUUFBQUFIc0FRRUFBQUFCN1FFQkFPa0NBQ0h1QVFFQUFBQUI3d0VCQUFBQUFmQUJBUUFBQUFFYUF3QUE4d0lBSUFzQUFQUUNBQ0FNQUFEMUFnQWdEZ0FBOWdJQUlBOEFBUGNDQUNBUUFBRDRBZ0FnRVFBQS1RSUFJQklBQVBvQ0FDRGZBUUFBNmdJQU1PQUJBQUNpQWdBUTRRRUFBT29DQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoOFFFQkFPc0NBQ0h5QVFFQTZ3SUFJZk1CQVFEc0FnQWg5QUVCQU93Q0FDSDFBUUVBN0FJQUlmWUJBUURzQWdBaC1BRUFBTzBDLUFFaS1nRUFBTzRDLWdFaV9BRUFBTzhDX0FFaV9RRWdBUEFDQUNILUFTQUE4QUlBSWY4QkFnRHhBZ0FoZ0FKQUFQSUNBQ0VMNWdFQkFBQUFBZWNCQVFBQUFBVG9BUUVBQUFBRTZRRUJBQUFBQWVvQkFRQUFBQUhyQVFFQUFBQUI3QUVCQUFBQUFlMEJBUURWQWdBaDdnRUJBQUFBQWU4QkFRQUFBQUh3QVFFQUFBQUJDLVlCQVFBQUFBSG5BUUVBQUFBRjZBRUJBQUFBQmVrQkFRQUFBQUhxQVFFQUFBQUI2d0VCQUFBQUFld0JBUUFBQUFIdEFRRUE2UUlBSWU0QkFRQUFBQUh2QVFFQUFBQUI4QUVCQUFBQUFRVG1BUUFBQVBnQkF1Y0JBQUFBLUFFSTZBRUFBQUQ0QVFqdEFRQUE1Z0w0QVNJRTVnRUFBQUQ2QVFMbkFRQUFBUG9CQ09nQkFBQUEtZ0VJN1FFQUFPUUMtZ0VpQk9ZQkFBQUFfQUVDNXdFQUFBRDhBUWpvQVFBQUFQd0JDTzBCQUFEaUF2d0JJZ0xtQVNBQUFBQUI3UUVnQU9BQ0FDRUk1Z0VDQUFBQUFlY0JBZ0FBQUFUb0FRSUFBQUFFNlFFQ0FBQUFBZW9CQWdBQUFBSHJBUUlBQUFBQjdBRUNBQUFBQWUwQkFnRFNBZ0FoQ09ZQlFBQUFBQUhuQVVBQUFBQUU2QUZBQUFBQUJPa0JRQUFBQUFIcUFVQUFBQUFCNndGQUFBQUFBZXdCUUFBQUFBSHRBVUFBMHdJQUlRT0JBZ0FBQXdBZ2dnSUFBQU1BSUlNQ0FBQURBQ0FEZ1FJQUFBa0FJSUlDQUFBSkFDQ0RBZ0FBQ1FBZ0E0RUNBQUFTQUNDQ0FnQUFFZ0FnZ3dJQUFCSUFJQU9CQWdBQUh3QWdnZ0lBQUI4QUlJTUNBQUFmQUNBRGdRSUFBQllBSUlJQ0FBQVdBQ0NEQWdBQUZnQWdBNEVDQUFBa0FDQ0NBZ0FBSkFBZ2d3SUFBQ1FBSUFPQkFnQUFLQUFnZ2dJQUFDZ0FJSU1DQUFBb0FDQURnUUlBQUNzQUlJSUNBQUFyQUNDREFnQUFLd0FnRXQ4QkFBRDdBZ0F3NEFFQUFKd0NBQkRoQVFBQS13SUFNT0lCQVFEUEFnQWg1UUZBQU5BQ0FDSDZBUUFBX3dLTkFpTC1BU0FBMndJQUlZQUNRQURRQWdBaGhBSUJBTThDQUNHRkFnRUF6d0lBSVlZQ0FRRFBBZ0FoaHdJQkFNOENBQ0dJQWhBQV9BSUFJWWtDQWdEY0FnQWhpZ0lJQVAwQ0FDR0xBZ0FBX2dJQUlJMENBUURQQWdBaGpnSUJBTThDQUNFTkJBQUEwZ0lBSUNrQUFJUURBQ0FxQUFDRUF3QWdTd0FBaEFNQUlFd0FBSVFEQUNEbUFSQUFBQUFCNXdFUUFBQUFCT2dCRUFBQUFBVHBBUkFBQUFBQjZnRVFBQUFBQWVzQkVBQUFBQUhzQVJBQUFBQUI3UUVRQUlNREFDRU5CQUFBMGdJQUlDa0FBTjRDQUNBcUFBRGVBZ0FnU3dBQTNnSUFJRXdBQU40Q0FDRG1BUWdBQUFBQjV3RUlBQUFBQk9nQkNBQUFBQVRwQVFnQUFBQUI2Z0VJQUFBQUFlc0JDQUFBQUFIc0FRZ0FBQUFCN1FFSUFJSURBQ0VFNWdFQkFBQUFCWThDQVFBQUFBR1FBZ0VBQUFBRWtRSUJBQUFBQkFjRUFBRFNBZ0FnS1FBQWdRTUFJQ29BQUlFREFDRG1BUUFBQUkwQ0F1Y0JBQUFBalFJSTZBRUFBQUNOQWdqdEFRQUFnQU9OQWlJSEJBQUEwZ0lBSUNrQUFJRURBQ0FxQUFDQkF3QWc1Z0VBQUFDTkFnTG5BUUFBQUkwQ0NPZ0JBQUFBalFJSTdRRUFBSUFEalFJaUJPWUJBQUFBalFJQzV3RUFBQUNOQWdqb0FRQUFBSTBDQ08wQkFBQ0JBNDBDSWcwRUFBRFNBZ0FnS1FBQTNnSUFJQ29BQU40Q0FDQkxBQURlQWdBZ1RBQUEzZ0lBSU9ZQkNBQUFBQUhuQVFnQUFBQUU2QUVJQUFBQUJPa0JDQUFBQUFIcUFRZ0FBQUFCNndFSUFBQUFBZXdCQ0FBQUFBSHRBUWdBZ2dNQUlRMEVBQURTQWdBZ0tRQUFoQU1BSUNvQUFJUURBQ0JMQUFDRUF3QWdUQUFBaEFNQUlPWUJFQUFBQUFIbkFSQUFBQUFFNkFFUUFBQUFCT2tCRUFBQUFBSHFBUkFBQUFBQjZ3RVFBQUFBQWV3QkVBQUFBQUh0QVJBQWd3TUFJUWptQVJBQUFBQUI1d0VRQUFBQUJPZ0JFQUFBQUFUcEFSQUFBQUFCNmdFUUFBQUFBZXNCRUFBQUFBSHNBUkFBQUFBQjdRRVFBSVFEQUNFTDN3RUFBSVVEQUREZ0FRQUFoZ0lBRU9FQkFBQ0ZBd0F3NGdFQkFNOENBQ0hqQVFFQXp3SUFJZVFCQVFEUEFnQWg1UUZBQU5BQ0FDSC1BU0FBMndJQUlZQUNRQURRQWdBaGlnSUNBTndDQUNHU0FnRUF6d0lBSVFuZkFRQUFoZ01BTU9BQkFBRHdBUUFRNFFFQUFJWURBRERpQVFFQXp3SUFJZU1CQVFEUEFnQWg1UUZBQU5BQ0FDR1RBZ0VBendJQUlaUUNRQURRQWdBaGxRSkFBSWNEQUNFTEJBQUE2QUlBSUNrQUFJa0RBQ0FxQUFDSkF3QWc1Z0ZBQUFBQUFlY0JRQUFBQUFYb0FVQUFBQUFGNlFGQUFBQUFBZW9CUUFBQUFBSHJBVUFBQUFBQjdBRkFBQUFBQWUwQlFBQ0lBd0FoQ3dRQUFPZ0NBQ0FwQUFDSkF3QWdLZ0FBaVFNQUlPWUJRQUFBQUFIbkFVQUFBQUFGNkFGQUFBQUFCZWtCUUFBQUFBSHFBVUFBQUFBQjZ3RkFBQUFBQWV3QlFBQUFBQUh0QVVBQWlBTUFJUWptQVVBQUFBQUI1d0ZBQUFBQUJlZ0JRQUFBQUFYcEFVQUFBQUFCNmdGQUFBQUFBZXNCUUFBQUFBSHNBVUFBQUFBQjdRRkFBSWtEQUNFVTN3RUFBSW9EQUREZ0FRQUEyZ0VBRU9FQkFBQ0tBd0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZm9CQUFDTEE1d0NJb0FDUUFEUUFnQWhsZ0lCQU04Q0FDR1hBZ0VBendJQUlaZ0NBUURYQWdBaG1RSVFBUHdDQUNHYUFnRUF6d0lBSVp3Q0FRRFhBZ0FoblFJQkFOY0NBQ0dlQWdFQTF3SUFJWjhDQVFEWEFnQWhvQUpBQUljREFDR2hBZ0VBMXdJQUlhSUNRQUNIQXdBaG93SkFBSWNEQUNFSEJBQUEwZ0lBSUNrQUFJMERBQ0FxQUFDTkF3QWc1Z0VBQUFDY0FnTG5BUUFBQUp3Q0NPZ0JBQUFBbkFJSTdRRUFBSXdEbkFJaUJ3UUFBTklDQUNBcEFBQ05Bd0FnS2dBQWpRTUFJT1lCQUFBQW5BSUM1d0VBQUFDY0Fnam9BUUFBQUp3Q0NPMEJBQUNNQTV3Q0lnVG1BUUFBQUp3Q0F1Y0JBQUFBbkFJSTZBRUFBQUNjQWdqdEFRQUFqUU9jQWlJTDN3RUFBSTREQUREZ0FRQUF4QUVBRU9FQkFBQ09Bd0F3NGdFQkFNOENBQ0hqQVFFQXp3SUFJZVVCUUFEUUFnQWhoQUlCQU04Q0FDR2xBZ0FBandPbEFpS21BZ0VBendJQUlhY0NBUURYQWdBaHFBSWdBTnNDQUNFSEJBQUEwZ0lBSUNrQUFKRURBQ0FxQUFDUkF3QWc1Z0VBQUFDbEFnTG5BUUFBQUtVQ0NPZ0JBQUFBcFFJSTdRRUFBSkFEcFFJaUJ3UUFBTklDQUNBcEFBQ1JBd0FnS2dBQWtRTUFJT1lCQUFBQXBRSUM1d0VBQUFDbEFnam9BUUFBQUtVQ0NPMEJBQUNRQTZVQ0lnVG1BUUFBQUtVQ0F1Y0JBQUFBcFFJSTZBRUFBQUNsQWdqdEFRQUFrUU9sQWlJTDN3RUFBSklEQUREZ0FRQUFyZ0VBRU9FQkFBQ1NBd0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZkVCQVFEUEFnQWg4Z0VCQU04Q0FDR0FBa0FBMEFJQUlhWUNBUURQQWdBaHFRSUJBTThDQUNHcUFpQUEyd0lBSVF2ZkFRQUFrd01BTU9BQkFBQ2JBUUFRNFFFQUFKTURBRERpQVFFQTZ3SUFJZVVCUUFEeUFnQWg4UUVCQU9zQ0FDSHlBUUVBNndJQUlZQUNRQUR5QWdBaHBnSUJBT3NDQUNHcEFnRUE2d0lBSWFvQ0lBRHdBZ0FoQ044QkFBQ1VBd0F3NEFFQUFKVUJBQkRoQVFBQWxBTUFNT0lCQVFEUEFnQWg1UUZBQU5BQ0FDSHhBUUVBendJQUlZQUNRQURRQWdBaGhRSUJBTThDQUNFSkF3QUE4d0lBSU44QkFBQ1ZBd0F3NEFFQUFJSUJBQkRoQVFBQWxRTUFNT0lCQVFEckFnQWg1UUZBQVBJQ0FDSHhBUUVBNndJQUlZQUNRQUR5QWdBaGhRSUJBT3NDQUNFTTN3RUFBSllEQUREZ0FRQUFmQUFRNFFFQUFKWURBRERpQVFFQXp3SUFJZU1CQVFEUEFnQWg1QUVCQU04Q0FDSGxBVUFBMEFJQUlmb0JBQUNYQTY4Q0lvQUNRQURRQWdBaHF3SkFBTkFDQUNHc0FnSUEzQUlBSWEwQ0VBRDhBZ0FoQndRQUFOSUNBQ0FwQUFDWkF3QWdLZ0FBbVFNQUlPWUJBQUFBcndJQzV3RUFBQUN2QWdqb0FRQUFBSzhDQ08wQkFBQ1lBNjhDSWdjRUFBRFNBZ0FnS1FBQW1RTUFJQ29BQUprREFDRG1BUUFBQUs4Q0F1Y0JBQUFBcndJSTZBRUFBQUN2QWdqdEFRQUFtQU92QWlJRTVnRUFBQUN2QWdMbkFRQUFBSzhDQ09nQkFBQUFyd0lJN1FFQUFKa0Ryd0lpRHQ4QkFBQ2FBd0F3NEFFQUFHWUFFT0VCQUFDYUF3QXc0Z0VCQU04Q0FDSGxBVUFBMEFJQUlmb0JBQUNiQTdNQ0l2NEJJQURiQWdBaGdBSkFBTkFDQUNHRUFnRUF6d0lBSVlVQ0FRRFBBZ0FocndJQkFNOENBQ0d3QWdFQXp3SUFJYkVDQVFEUEFnQWhzd0lCQU04Q0FDRUhCQUFBMGdJQUlDa0FBSjBEQUNBcUFBQ2RBd0FnNWdFQUFBQ3pBZ0xuQVFBQUFMTUNDT2dCQUFBQXN3SUk3UUVBQUp3RHN3SWlCd1FBQU5JQ0FDQXBBQUNkQXdBZ0tnQUFuUU1BSU9ZQkFBQUFzd0lDNXdFQUFBQ3pBZ2pvQVFBQUFMTUNDTzBCQUFDY0E3TUNJZ1RtQVFBQUFMTUNBdWNCQUFBQXN3SUk2QUVBQUFDekFnanRBUUFBblFPekFpSUwzd0VBQUo0REFERGdBUUFBVUFBUTRRRUFBSjREQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNVFGQUFOQUNBQ0gtQVNBQTJ3SUFJWUFDUUFEUUFnQWhzQUlCQU04Q0FDRzBBZ0VBendJQUliVUNBUURYQWdBaENnY0FBS0VEQUNEZkFRQUFud01BTU9BQkFBQXJBQkRoQVFBQW53TUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlaTUNBUURyQWdBaGxBSkFBUElDQUNHVkFrQUFvQU1BSVFqbUFVQUFBQUFCNXdGQUFBQUFCZWdCUUFBQUFBWHBBVUFBQUFBQjZnRkFBQUFBQWVzQlFBQUFBQUhzQVVBQUFBQUI3UUZBQUlrREFDRWNBd0FBOHdJQUlBc0FBUFFDQUNBTUFBRDFBZ0FnRGdBQTlnSUFJQThBQVBjQ0FDQVFBQUQ0QWdBZ0VRQUEtUUlBSUJJQUFQb0NBQ0RmQVFBQTZnSUFNT0FCQUFDaUFnQVE0UUVBQU9vQ0FERGlBUUVBNndJQUllVUJRQUR5QWdBaDhRRUJBT3NDQUNIeUFRRUE2d0lBSWZNQkFRRHNBZ0FoOUFFQkFPd0NBQ0gxQVFFQTdBSUFJZllCQVFEc0FnQWgtQUVBQU8wQy1BRWktZ0VBQU80Qy1nRWlfQUVBQU84Q19BRWlfUUVnQVBBQ0FDSC1BU0FBOEFJQUlmOEJBZ0R4QWdBaGdBSkFBUElDQUNHM0FnQUFvZ0lBSUxnQ0FBQ2lBZ0FnRHdjQUFLRURBQ0FVQUFDakF3QWdGUUFBcEFNQUlCWUFBUGtDQUNEZkFRQUFvZ01BTU9BQkFBQW9BQkRoQVFBQW9nTUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlmNEJJQUR3QWdBaGdBSkFBUElDQUNHd0FnRUE2d0lBSWJRQ0FRRHJBZ0FodFFJQkFPd0NBQ0VTRVFBQS1RSUFJQk1BQUtFREFDRGZBUUFBcHdNQU1PQUJBQUFmQUJEaEFRQUFwd01BTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0g2QVFBQXFBT3pBaUwtQVNBQThBSUFJWUFDUUFEeUFnQWhoQUlCQU9zQ0FDR0ZBZ0VBNndJQUlhOENBUURyQWdBaHNBSUJBT3NDQUNHeEFnRUE2d0lBSWJNQ0FRRHJBZ0FodHdJQUFCOEFJTGdDQUFBZkFDQVJCd0FBb1FNQUlCUUFBS01EQUNBVkFBQ2tBd0FnRmdBQS1RSUFJTjhCQUFDaUF3QXc0QUVBQUNnQUVPRUJBQUNpQXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVVQlFBRHlBZ0FoX2dFZ0FQQUNBQ0dBQWtBQThnSUFJYkFDQVFEckFnQWh0QUlCQU9zQ0FDRzFBZ0VBN0FJQUliY0NBQUFvQUNDNEFnQUFLQUFnREFjQUFLRURBQ0RmQVFBQXBRTUFNT0FCQUFBa0FCRGhBUUFBcFFNQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIbEFVQUE4Z0lBSVlRQ0FRRHJBZ0FocFFJQUFLWURwUUlpcGdJQkFPc0NBQ0duQWdFQTdBSUFJYWdDSUFEd0FnQWhCT1lCQUFBQXBRSUM1d0VBQUFDbEFnam9BUUFBQUtVQ0NPMEJBQUNSQTZVQ0loQVJBQUQ1QWdBZ0V3QUFvUU1BSU44QkFBQ25Bd0F3NEFFQUFCOEFFT0VCQUFDbkF3QXc0Z0VCQU9zQ0FDSGxBVUFBOGdJQUlmb0JBQUNvQTdNQ0l2NEJJQUR3QWdBaGdBSkFBUElDQUNHRUFnRUE2d0lBSVlVQ0FRRHJBZ0FocndJQkFPc0NBQ0d3QWdFQTZ3SUFJYkVDQVFEckFnQWhzd0lCQU9zQ0FDRUU1Z0VBQUFDekFnTG5BUUFBQUxNQ0NPZ0JBQUFBc3dJSTdRRUFBSjBEc3dJaUF1TUJBUUFBQUFIa0FRRUFBQUFCQ1FjQUFLRURBQ0FJQUFDckF3QWczd0VBQUtvREFERGdBUUFBRmdBUTRRRUFBS29EQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJUmtGQUFDNEF3QWdCZ0FBb1FNQUlBc0FBUFFDQUNBTUFBRDFBZ0FnRFFBQTl3SUFJTjhCQUFDMUF3QXc0QUVBQUFNQUVPRUJBQUMxQXdBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQzNBNDBDSXY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0dFQWdFQTZ3SUFJWVVDQVFEckFnQWhoZ0lCQU9zQ0FDR0hBZ0VBNndJQUlZZ0NFQUN2QXdBaGlRSUNBUEVDQUNHS0FnZ0F0Z01BSVlzQ0FBRC1BZ0FnalFJQkFPc0NBQ0dPQWdFQTZ3SUFJYmNDQUFBREFDQzRBZ0FBQXdBZ0F1TUJBUUFBQUFIa0FRRUFBQUFCRFFjQUFLRURBQ0FJQUFDckF3QWczd0VBQUswREFERGdBUUFBRWdBUTRRRUFBSzBEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0tBZ0lBOFFJQUlaSUNBUURyQWdBaEZRa0FBTEVEQUNEZkFRQUFyZ01BTU9BQkFBQU5BQkRoQVFBQXJnTUFNT0lCQVFEckFnQWg1UUZBQVBJQ0FDSDZBUUFBc0FPY0FpS0FBa0FBOGdJQUlaWUNBUURyQWdBaGx3SUJBT3NDQUNHWUFnRUE3QUlBSVprQ0VBQ3ZBd0FobWdJQkFPc0NBQ0djQWdFQTdBSUFJWjBDQVFEc0FnQWhuZ0lCQU93Q0FDR2ZBZ0VBN0FJQUlhQUNRQUNnQXdBaG9RSUJBT3dDQUNHaUFrQUFvQU1BSWFNQ1FBQ2dBd0FoQ09ZQkVBQUFBQUhuQVJBQUFBQUU2QUVRQUFBQUJPa0JFQUFBQUFIcUFSQUFBQUFCNndFUUFBQUFBZXdCRUFBQUFBSHRBUkFBaEFNQUlRVG1BUUFBQUp3Q0F1Y0JBQUFBbkFJSTZBRUFBQUNjQWdqdEFRQUFqUU9jQWlJUkJ3QUFvUU1BSUFnQUFLc0RBQ0FLQUFDMEF3QWczd0VBQUxJREFERGdBUUFBQ1FBUTRRRUFBTElEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDekE2OENJb0FDUUFEeUFnQWhxd0pBQVBJQ0FDR3NBZ0lBOFFJQUlhMENFQUN2QXdBaHR3SUFBQWtBSUxnQ0FBQUpBQ0FQQndBQW9RTUFJQWdBQUtzREFDQUtBQUMwQXdBZzN3RUFBTElEQUREZ0FRQUFDUUFRNFFFQUFMSURBRERpQVFFQTZ3SUFJZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUlmb0JBQUN6QTY4Q0lvQUNRQUR5QWdBaHF3SkFBUElDQUNHc0FnSUE4UUlBSWEwQ0VBQ3ZBd0FoQk9ZQkFBQUFyd0lDNXdFQUFBQ3ZBZ2pvQVFBQUFLOENDTzBCQUFDWkE2OENJZ09CQWdBQURRQWdnZ0lBQUEwQUlJTUNBQUFOQUNBWEJRQUF1QU1BSUFZQUFLRURBQ0FMQUFEMEFnQWdEQUFBOVFJQUlBMEFBUGNDQUNEZkFRQUF0UU1BTU9BQkFBQURBQkRoQVFBQXRRTUFNT0lCQVFEckFnQWg1UUZBQVBJQ0FDSDZBUUFBdHdPTkFpTC1BU0FBOEFJQUlZQUNRQUR5QWdBaGhBSUJBT3NDQUNHRkFnRUE2d0lBSVlZQ0FRRHJBZ0FoaHdJQkFPc0NBQ0dJQWhBQXJ3TUFJWWtDQWdEeEFnQWhpZ0lJQUxZREFDR0xBZ0FBX2dJQUlJMENBUURyQWdBaGpnSUJBT3NDQUNFSTVnRUlBQUFBQWVjQkNBQUFBQVRvQVFnQUFBQUU2UUVJQUFBQUFlb0JDQUFBQUFIckFRZ0FBQUFCN0FFSUFBQUFBZTBCQ0FEZUFnQWhCT1lCQUFBQWpRSUM1d0VBQUFDTkFnam9BUUFBQUkwQ0NPMEJBQUNCQTQwQ0lnc0RBQUR6QWdBZzN3RUFBSlVEQUREZ0FRQUFnZ0VBRU9FQkFBQ1ZBd0F3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZkVCQVFEckFnQWhnQUpBQVBJQ0FDR0ZBZ0VBNndJQUliY0NBQUNDQVFBZ3VBSUFBSUlCQUNBQUFBQUJ2QUlCQUFBQUFRRzhBa0FBQUFBQkJTTUFBTGtHQUNBa0FBQ19CZ0FndVFJQUFMb0dBQ0M2QWdBQXZnWUFJTDhDQUFDZkFnQWdCU01BQUxjR0FDQWtBQUM4QmdBZ3VRSUFBTGdHQUNDNkFnQUF1d1lBSUw4Q0FBQUZBQ0FESXdBQXVRWUFJTGtDQUFDNkJnQWd2d0lBQUo4Q0FDQURJd0FBdHdZQUlMa0NBQUM0QmdBZ3Z3SUFBQVVBSUFBQUFBQUFBQUc4QWdFQUFBQUJBYndDQUFBQS1BRUNBYndDQUFBQS1nRUNBYndDQUFBQV9BRUNBYndDSUFBQUFBRUZ2QUlDQUFBQUFjTUNBZ0FBQUFIRUFnSUFBQUFCeFFJQ0FBQUFBY1lDQWdBQUFBRUxJd0FBM2dRQU1DUUFBT01FQURDNUFnQUEzd1FBTUxvQ0FBRGdCQUF3dXdJQUFPRUVBQ0M4QWdBQTRnUUFNTDBDQUFEaUJBQXd2Z0lBQU9JRUFEQ19BZ0FBNGdRQU1NQUNBQURrQkFBd3dRSUFBT1VFQURBTEl3QUF2d1FBTUNRQUFNUUVBREM1QWdBQXdBUUFNTG9DQUFEQkJBQXd1d0lBQU1JRUFDQzhBZ0FBd3dRQU1MMENBQUREQkFBd3ZnSUFBTU1FQURDX0FnQUF3d1FBTU1BQ0FBREZCQUF3d1FJQUFNWUVBREFMSXdBQXNRUUFNQ1FBQUxZRUFEQzVBZ0FBc2dRQU1Mb0NBQUN6QkFBd3V3SUFBTFFFQUNDOEFnQUF0UVFBTUwwQ0FBQzFCQUF3dmdJQUFMVUVBRENfQWdBQXRRUUFNTUFDQUFDM0JBQXd3UUlBQUxnRUFEQUxJd0FBbVFRQU1DUUFBSjRFQURDNUFnQUFtZ1FBTUxvQ0FBQ2JCQUF3dXdJQUFKd0VBQ0M4QWdBQW5RUUFNTDBDQUFDZEJBQXd2Z0lBQUowRUFEQ19BZ0FBblFRQU1NQUNBQUNmQkFBd3dRSUFBS0FFQURBTEl3QUFqUVFBTUNRQUFKSUVBREM1QWdBQWpnUUFNTG9DQUFDUEJBQXd1d0lBQUpBRUFDQzhBZ0FBa1FRQU1MMENBQUNSQkFBd3ZnSUFBSkVFQURDX0FnQUFrUVFBTU1BQ0FBQ1RCQUF3d1FJQUFKUUVBREFMSXdBQWdBUUFNQ1FBQUlVRUFEQzVBZ0FBZ1FRQU1Mb0NBQUNDQkFBd3V3SUFBSU1FQUNDOEFnQUFoQVFBTUwwQ0FBQ0VCQUF3dmdJQUFJUUVBRENfQWdBQWhBUUFNTUFDQUFDR0JBQXd3UUlBQUljRUFEQUxJd0FBNHdNQU1DUUFBT2dEQURDNUFnQUE1QU1BTUxvQ0FBRGxBd0F3dXdJQUFPWURBQ0M4QWdBQTV3TUFNTDBDQUFEbkF3QXd2Z0lBQU9jREFEQ19BZ0FBNXdNQU1NQUNBQURwQXdBd3dRSUFBT29EQURBTEl3QUExZ01BTUNRQUFOc0RBREM1QWdBQTF3TUFNTG9DQUFEWUF3QXd1d0lBQU5rREFDQzhBZ0FBMmdNQU1MMENBQURhQXdBd3ZnSUFBTm9EQURDX0FnQUEyZ01BTU1BQ0FBRGNBd0F3d1FJQUFOMERBREFGNGdFQkFBQUFBZVVCUUFBQUFBR1RBZ0VBQUFBQmxBSkFBQUFBQVpVQ1FBQUFBQUVDQUFBQUxRQWdJd0FBNGdNQUlBTUFBQUF0QUNBakFBRGlBd0FnSkFBQTRRTUFJQUVjQUFDMkJnQXdDZ2NBQUtFREFDRGZBUUFBbndNQU1PQUJBQUFyQUJEaEFRQUFud01BTU9JQkFRQUFBQUhqQVFFQTZ3SUFJZVVCUUFEeUFnQWhrd0lCQUFBQUFaUUNRQUR5QWdBaGxRSkFBS0FEQUNFQ0FBQUFMUUFnSEFBQTRRTUFJQUlBQUFEZUF3QWdIQUFBM3dNQUlBbmZBUUFBM1FNQU1PQUJBQURlQXdBUTRRRUFBTjBEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNVFGQUFQSUNBQ0dUQWdFQTZ3SUFJWlFDUUFEeUFnQWhsUUpBQUtBREFDRUozd0VBQU4wREFERGdBUUFBM2dNQUVPRUJBQURkQXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVVQlFBRHlBZ0Foa3dJQkFPc0NBQ0dVQWtBQThnSUFJWlVDUUFDZ0F3QWhCZUlCQVFDOEF3QWg1UUZBQUwwREFDR1RBZ0VBdkFNQUlaUUNRQUM5QXdBaGxRSkFBT0FEQUNFQnZBSkFBQUFBQVFYaUFRRUF2QU1BSWVVQlFBQzlBd0Foa3dJQkFMd0RBQ0dVQWtBQXZRTUFJWlVDUUFEZ0F3QWhCZUlCQVFBQUFBSGxBVUFBQUFBQmt3SUJBQUFBQVpRQ1FBQUFBQUdWQWtBQUFBQUJDaFFBQVBzREFDQVZBQURfQXdBZ0ZnQUFfUU1BSU9JQkFRQUFBQUhsQVVBQUFBQUJfZ0VnQUFBQUFZQUNRQUFBQUFHd0FnRUFBQUFCdEFJQkFBQUFBYlVDQVFBQUFBRUNBQUFBQVFBZ0l3QUFfZ01BSUFNQUFBQUJBQ0FqQUFELUF3QWdKQUFBN1FNQUlBRWNBQUMxQmdBd0R3Y0FBS0VEQUNBVUFBQ2pBd0FnRlFBQXBBTUFJQllBQVBrQ0FDRGZBUUFBb2dNQU1PQUJBQUFvQUJEaEFRQUFvZ01BTU9JQkFRQUFBQUhqQVFFQTZ3SUFJZVVCUUFEeUFnQWhfZ0VnQVBBQ0FDR0FBa0FBOGdJQUliQUNBUURyQWdBaHRBSUJBT3NDQUNHMUFnRUE3QUlBSVFJQUFBQUJBQ0FjQUFEdEF3QWdBZ0FBQU9zREFDQWNBQURzQXdBZ0M5OEJBQURxQXdBdzRBRUFBT3NEQUJEaEFRQUE2Z01BTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR3dBZ0VBNndJQUliUUNBUURyQWdBaHRRSUJBT3dDQUNFTDN3RUFBT29EQUREZ0FRQUE2d01BRU9FQkFBRHFBd0F3NGdFQkFPc0NBQ0hqQVFFQTZ3SUFJZVVCUUFEeUFnQWhfZ0VnQVBBQ0FDR0FBa0FBOGdJQUliQUNBUURyQWdBaHRBSUJBT3NDQUNHMUFnRUE3QUlBSVFmaUFRRUF2QU1BSWVVQlFBQzlBd0FoX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJYkFDQVFDOEF3QWh0QUlCQUx3REFDRzFBZ0VBeUFNQUlRb1VBQUR1QXdBZ0ZRQUE3d01BSUJZQUFQQURBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUliQUNBUUM4QXdBaHRBSUJBTHdEQUNHMUFnRUF5QU1BSVFVakFBQ3BCZ0FnSkFBQXN3WUFJTGtDQUFDcUJnQWd1Z0lBQUxJR0FDQ19BZ0FBSVFBZ0J5TUFBS1VHQUNBa0FBQ3dCZ0FndVFJQUFLWUdBQ0M2QWdBQXJ3WUFJTDBDQUFBb0FDQy1BZ0FBS0FBZ3Z3SUFBQUVBSUFzakFBRHhBd0F3SkFBQTlRTUFNTGtDQUFEeUF3QXd1Z0lBQVBNREFEQzdBZ0FBOUFNQUlMd0NBQURuQXdBd3ZRSUFBT2NEQURDLUFnQUE1d01BTUw4Q0FBRG5Bd0F3d0FJQUFQWURBRERCQWdBQTZnTUFNQW9IQUFEOEF3QWdGQUFBLXdNQUlCWUFBUDBEQUNEaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQWJBQ0FRQUFBQUcwQWdFQUFBQUJBZ0FBQUFFQUlDTUFBUG9EQUNBREFBQUFBUUFnSXdBQS1nTUFJQ1FBQVBnREFDQUJIQUFBcmdZQU1BSUFBQUFCQUNBY0FBRDRBd0FnQWdBQUFPc0RBQ0FjQUFEM0F3QWdCLUlCQVFDOEF3QWg0d0VCQUx3REFDSGxBVUFBdlFNQUlmNEJJQURNQXdBaGdBSkFBTDBEQUNHd0FnRUF2QU1BSWJRQ0FRQzhBd0FoQ2djQUFQa0RBQ0FVQUFEdUF3QWdGZ0FBOEFNQUlPSUJBUUM4QXdBaDR3RUJBTHdEQUNIbEFVQUF2UU1BSWY0QklBRE1Bd0FoZ0FKQUFMMERBQ0d3QWdFQXZBTUFJYlFDQVFDOEF3QWhCU01BQUtjR0FDQWtBQUNzQmdBZ3VRSUFBS2dHQUNDNkFnQUFxd1lBSUw4Q0FBQ2ZBZ0FnQ2djQUFQd0RBQ0FVQUFEN0F3QWdGZ0FBX1FNQUlPSUJBUUFBQUFIakFRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQnNBSUJBQUFBQWJRQ0FRQUFBQUVESXdBQXFRWUFJTGtDQUFDcUJnQWd2d0lBQUNFQUlBTWpBQUNuQmdBZ3VRSUFBS2dHQUNDX0FnQUFud0lBSUFRakFBRHhBd0F3dVFJQUFQSURBREM3QWdBQTlBTUFJTDhDQUFEbkF3QXdDaFFBQVBzREFDQVZBQURfQXdBZ0ZnQUFfUU1BSU9JQkFRQUFBQUhsQVVBQUFBQUJfZ0VnQUFBQUFZQUNRQUFBQUFHd0FnRUFBQUFCdEFJQkFBQUFBYlVDQVFBQUFBRURJd0FBcFFZQUlMa0NBQUNtQmdBZ3Z3SUFBQUVBSUFmaUFRRUFBQUFCNVFGQUFBQUFBWVFDQVFBQUFBR2xBZ0FBQUtVQ0FxWUNBUUFBQUFHbkFnRUFBQUFCcUFJZ0FBQUFBUUlBQUFBbUFDQWpBQUNNQkFBZ0F3QUFBQ1lBSUNNQUFJd0VBQ0FrQUFDTEJBQWdBUndBQUtRR0FEQU1Cd0FBb1FNQUlOOEJBQUNsQXdBdzRBRUFBQ1FBRU9FQkFBQ2xBd0F3NGdFQkFBQUFBZU1CQVFEckFnQWg1UUZBQVBJQ0FDR0VBZ0VBNndJQUlhVUNBQUNtQTZVQ0lxWUNBUURyQWdBaHB3SUJBT3dDQUNHb0FpQUE4QUlBSVFJQUFBQW1BQ0FjQUFDTEJBQWdBZ0FBQUlnRUFDQWNBQUNKQkFBZ0M5OEJBQUNIQkFBdzRBRUFBSWdFQUJEaEFRQUFod1FBTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJWVFDQVFEckFnQWhwUUlBQUtZRHBRSWlwZ0lCQU9zQ0FDR25BZ0VBN0FJQUlhZ0NJQUR3QWdBaEM5OEJBQUNIQkFBdzRBRUFBSWdFQUJEaEFRQUFod1FBTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJWVFDQVFEckFnQWhwUUlBQUtZRHBRSWlwZ0lCQU9zQ0FDR25BZ0VBN0FJQUlhZ0NJQUR3QWdBaEItSUJBUUM4QXdBaDVRRkFBTDBEQUNHRUFnRUF2QU1BSWFVQ0FBQ0tCS1VDSXFZQ0FRQzhBd0FocHdJQkFNZ0RBQ0dvQWlBQXpBTUFJUUc4QWdBQUFLVUNBZ2ZpQVFFQXZBTUFJZVVCUUFDOUF3QWhoQUlCQUx3REFDR2xBZ0FBaWdTbEFpS21BZ0VBdkFNQUlhY0NBUURJQXdBaHFBSWdBTXdEQUNFSDRnRUJBQUFBQWVVQlFBQUFBQUdFQWdFQUFBQUJwUUlBQUFDbEFnS21BZ0VBQUFBQnB3SUJBQUFBQWFnQ0lBQUFBQUVFQ0FBQXdRTUFJT0lCQVFBQUFBSGtBUUVBQUFBQjVRRkFBQUFBQVFJQUFBQVlBQ0FqQUFDWUJBQWdBd0FBQUJnQUlDTUFBSmdFQUNBa0FBQ1hCQUFnQVJ3QUFLTUdBREFLQndBQW9RTUFJQWdBQUtzREFDRGZBUUFBcWdNQU1PQUJBQUFXQUJEaEFRQUFxZ01BTU9JQkFRQUFBQUhqQVFFQTZ3SUFJZVFCQVFEckFnQWg1UUZBQVBJQ0FDRzJBZ0FBcVFNQUlBSUFBQUFZQUNBY0FBQ1hCQUFnQWdBQUFKVUVBQ0FjQUFDV0JBQWdCOThCQUFDVUJBQXc0QUVBQUpVRUFCRGhBUUFBbEFRQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIa0FRRUE2d0lBSWVVQlFBRHlBZ0FoQjk4QkFBQ1VCQUF3NEFFQUFKVUVBQkRoQVFBQWxBUUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGtBUUVBNndJQUllVUJRQUR5QWdBaEEtSUJBUUM4QXdBaDVBRUJBTHdEQUNIbEFVQUF2UU1BSVFRSUFBQ19Bd0FnNGdFQkFMd0RBQ0hrQVFFQXZBTUFJZVVCUUFDOUF3QWhCQWdBQU1FREFDRGlBUUVBQUFBQjVBRUJBQUFBQWVVQlFBQUFBQUVMRVFBQXNBUUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN6QWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQnJ3SUJBQUFBQWJBQ0FRQUFBQUd4QWdFQUFBQUJBZ0FBQUNFQUlDTUFBSzhFQUNBREFBQUFJUUFnSXdBQXJ3UUFJQ1FBQUtRRUFDQUJIQUFBb2dZQU1CQVJBQUQ1QWdBZ0V3QUFvUU1BSU44QkFBQ25Bd0F3NEFFQUFCOEFFT0VCQUFDbkF3QXc0Z0VCQUFBQUFlVUJRQUR5QWdBaC1nRUFBS2dEc3dJaV9nRWdBUEFDQUNHQUFrQUE4Z0lBSVlRQ0FRRHJBZ0FoaFFJQkFBQUFBYThDQVFEckFnQWhzQUlCQU9zQ0FDR3hBZ0VBNndJQUliTUNBUURyQWdBaEFnQUFBQ0VBSUJ3QUFLUUVBQ0FDQUFBQW9RUUFJQndBQUtJRUFDQU8zd0VBQUtBRUFERGdBUUFBb1FRQUVPRUJBQUNnQkFBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ29BN01DSXY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0dFQWdFQTZ3SUFJWVVDQVFEckFnQWhyd0lCQU9zQ0FDR3dBZ0VBNndJQUliRUNBUURyQWdBaHN3SUJBT3NDQUNFTzN3RUFBS0FFQUREZ0FRQUFvUVFBRU9FQkFBQ2dCQUF3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDb0E3TUNJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUURyQWdBaHJ3SUJBT3NDQUNHd0FnRUE2d0lBSWJFQ0FRRHJBZ0Foc3dJQkFPc0NBQ0VLNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFDakJMTUNJdjRCSUFETUF3QWhnQUpBQUwwREFDR0VBZ0VBdkFNQUlZVUNBUUM4QXdBaHJ3SUJBTHdEQUNHd0FnRUF2QU1BSWJFQ0FRQzhBd0FoQWJ3Q0FBQUFzd0lDQ3hFQUFLVUVBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQUtNRXN3SWlfZ0VnQU13REFDR0FBa0FBdlFNQUlZUUNBUUM4QXdBaGhRSUJBTHdEQUNHdkFnRUF2QU1BSWJBQ0FRQzhBd0Foc1FJQkFMd0RBQ0VMSXdBQXBnUUFNQ1FBQUtvRUFEQzVBZ0FBcHdRQU1Mb0NBQUNvQkFBd3V3SUFBS2tFQUNDOEFnQUE1d01BTUwwQ0FBRG5Bd0F3dmdJQUFPY0RBRENfQWdBQTV3TUFNTUFDQUFDckJBQXd3UUlBQU9vREFEQUtCd0FBX0FNQUlCVUFBUDhEQUNBV0FBRDlBd0FnNGdFQkFBQUFBZU1CQVFBQUFBSGxBVUFBQUFBQl9nRWdBQUFBQVlBQ1FBQUFBQUd3QWdFQUFBQUJ0UUlCQUFBQUFRSUFBQUFCQUNBakFBQ3VCQUFnQXdBQUFBRUFJQ01BQUs0RUFDQWtBQUN0QkFBZ0FSd0FBS0VHQURBQ0FBQUFBUUFnSEFBQXJRUUFJQUlBQUFEckF3QWdIQUFBckFRQUlBZmlBUUVBdkFNQUllTUJBUUM4QXdBaDVRRkFBTDBEQUNILUFTQUF6QU1BSVlBQ1FBQzlBd0Foc0FJQkFMd0RBQ0cxQWdFQXlBTUFJUW9IQUFENUF3QWdGUUFBN3dNQUlCWUFBUEFEQUNEaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhzQUlCQUx3REFDRzFBZ0VBeUFNQUlRb0hBQUQ4QXdBZ0ZRQUFfd01BSUJZQUFQMERBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBYkFDQVFBQUFBRzFBZ0VBQUFBQkN4RUFBTEFFQUNEaUFRRUFBQUFCNVFGQUFBQUFBZm9CQUFBQXN3SUNfZ0VnQUFBQUFZQUNRQUFBQUFHRUFnRUFBQUFCaFFJQkFBQUFBYThDQVFBQUFBR3dBZ0VBQUFBQnNRSUJBQUFBQVFRakFBQ21CQUF3dVFJQUFLY0VBREM3QWdBQXFRUUFJTDhDQUFEbkF3QXdDQWdBQUw0RUFDRGlBUUVBQUFBQjVBRUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFZb0NBZ0FBQUFHU0FnRUFBQUFCQWdBQUFCUUFJQ01BQUwwRUFDQURBQUFBRkFBZ0l3QUF2UVFBSUNRQUFMc0VBQ0FCSEFBQW9BWUFNQTRIQUFDaEF3QWdDQUFBcXdNQUlOOEJBQUN0QXdBdzRBRUFBQklBRU9FQkFBQ3RBd0F3NGdFQkFBQUFBZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUlmNEJJQUR3QWdBaGdBSkFBUElDQUNHS0FnSUE4UUlBSVpJQ0FRRHJBZ0FodGdJQUFLd0RBQ0FDQUFBQUZBQWdIQUFBdXdRQUlBSUFBQUM1QkFBZ0hBQUF1Z1FBSUF2ZkFRQUF1QVFBTU9BQkFBQzVCQUFRNFFFQUFMZ0VBRERpQVFFQTZ3SUFJZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUlmNEJJQUR3QWdBaGdBSkFBUElDQUNHS0FnSUE4UUlBSVpJQ0FRRHJBZ0FoQzk4QkFBQzRCQUF3NEFFQUFMa0VBQkRoQVFBQXVBUUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGtBUUVBNndJQUllVUJRQUR5QWdBaF9nRWdBUEFDQUNHQUFrQUE4Z0lBSVlvQ0FnRHhBZ0Foa2dJQkFPc0NBQ0VINGdFQkFMd0RBQ0hrQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUlZb0NBZ0ROQXdBaGtnSUJBTHdEQUNFSUNBQUF2QVFBSU9JQkFRQzhBd0FoNUFFQkFMd0RBQ0hsQVVBQXZRTUFJZjRCSUFETUF3QWhnQUpBQUwwREFDR0tBZ0lBelFNQUlaSUNBUUM4QXdBaEJTTUFBSnNHQUNBa0FBQ2VCZ0FndVFJQUFKd0dBQ0M2QWdBQW5RWUFJTDhDQUFBRkFDQUlDQUFBdmdRQUlPSUJBUUFBQUFIa0FRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQmlnSUNBQUFBQVpJQ0FRQUFBQUVESXdBQW13WUFJTGtDQUFDY0JnQWd2d0lBQUFVQUlBb0lBQURjQkFBZ0NnQUEzUVFBSU9JQkFRQUFBQUhrQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBcndJQ2dBSkFBQUFBQWFzQ1FBQUFBQUdzQWdJQUFBQUJyUUlRQUFBQUFRSUFBQUFMQUNBakFBRGJCQUFnQXdBQUFBc0FJQ01BQU5zRUFDQWtBQURMQkFBZ0FSd0FBSm9HQURBUEJ3QUFvUU1BSUFnQUFLc0RBQ0FLQUFDMEF3QWczd0VBQUxJREFERGdBUUFBQ1FBUTRRRUFBTElEQUREaUFRRUFBQUFCNHdFQkFPc0NBQ0hrQVFFQTZ3SUFJZVVCUUFEeUFnQWgtZ0VBQUxNRHJ3SWlnQUpBQVBJQ0FDR3JBa0FBOGdJQUlhd0NBZ0R4QWdBaHJRSVFBSzhEQUNFQ0FBQUFDd0FnSEFBQXl3UUFJQUlBQUFESEJBQWdIQUFBeUFRQUlBemZBUUFBeGdRQU1PQUJBQURIQkFBUTRRRUFBTVlFQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDekE2OENJb0FDUUFEeUFnQWhxd0pBQVBJQ0FDR3NBZ0lBOFFJQUlhMENFQUN2QXdBaEROOEJBQURHQkFBdzRBRUFBTWNFQUJEaEFRQUF4Z1FBTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hrQVFFQTZ3SUFJZVVCUUFEeUFnQWgtZ0VBQUxNRHJ3SWlnQUpBQVBJQ0FDR3JBa0FBOGdJQUlhd0NBZ0R4QWdBaHJRSVFBSzhEQUNFSTRnRUJBTHdEQUNIa0FRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFNb0Vyd0lpZ0FKQUFMMERBQ0dyQWtBQXZRTUFJYXdDQWdETkF3QWhyUUlRQU1rRUFDRUZ2QUlRQUFBQUFjTUNFQUFBQUFIRUFoQUFBQUFCeFFJUUFBQUFBY1lDRUFBQUFBRUJ2QUlBQUFDdkFnSUtDQUFBekFRQUlBb0FBTTBFQUNEaUFRRUF2QU1BSWVRQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQXlnU3ZBaUtBQWtBQXZRTUFJYXNDUUFDOUF3QWhyQUlDQU0wREFDR3RBaEFBeVFRQUlRVWpBQUNVQmdBZ0pBQUFtQVlBSUxrQ0FBQ1ZCZ0FndWdJQUFKY0dBQ0NfQWdBQUJRQWdDeU1BQU00RUFEQWtBQURUQkFBd3VRSUFBTThFQURDNkFnQUEwQVFBTUxzQ0FBRFJCQUFndkFJQUFOSUVBREM5QWdBQTBnUUFNTDRDQUFEU0JBQXd2d0lBQU5JRUFEREFBZ0FBMUFRQU1NRUNBQURWQkFBd0VPSUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ2NBZ0tBQWtBQUFBQUJsd0lCQUFBQUFaZ0NBUUFBQUFHWkFoQUFBQUFCbWdJQkFBQUFBWndDQVFBQUFBR2RBZ0VBQUFBQm5nSUJBQUFBQVo4Q0FRQUFBQUdnQWtBQUFBQUJvUUlCQUFBQUFhSUNRQUFBQUFHakFrQUFBQUFCQWdBQUFBOEFJQ01BQU5vRUFDQURBQUFBRHdBZ0l3QUEyZ1FBSUNRQUFOa0VBQ0FCSEFBQWxnWUFNQlVKQUFDeEF3QWczd0VBQUs0REFERGdBUUFBRFFBUTRRRUFBSzREQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0g2QVFBQXNBT2NBaUtBQWtBQThnSUFJWllDQVFEckFnQWhsd0lCQUFBQUFaZ0NBUURzQWdBaG1RSVFBSzhEQUNHYUFnRUE2d0lBSVp3Q0FRRHNBZ0FoblFJQkFPd0NBQ0dlQWdFQTdBSUFJWjhDQVFEc0FnQWhvQUpBQUtBREFDR2hBZ0VBN0FJQUlhSUNRQUNnQXdBaG93SkFBS0FEQUNFQ0FBQUFEd0FnSEFBQTJRUUFJQUlBQUFEV0JBQWdIQUFBMXdRQUlCVGZBUUFBMVFRQU1PQUJBQURXQkFBUTRRRUFBTlVFQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFMQURuQUlpZ0FKQUFQSUNBQ0dXQWdFQTZ3SUFJWmNDQVFEckFnQWhtQUlCQU93Q0FDR1pBaEFBcndNQUlab0NBUURyQWdBaG5BSUJBT3dDQUNHZEFnRUE3QUlBSVo0Q0FRRHNBZ0FobndJQkFPd0NBQ0dnQWtBQW9BTUFJYUVDQVFEc0FnQWhvZ0pBQUtBREFDR2pBa0FBb0FNQUlSVGZBUUFBMVFRQU1PQUJBQURXQkFBUTRRRUFBTlVFQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFMQURuQUlpZ0FKQUFQSUNBQ0dXQWdFQTZ3SUFJWmNDQVFEckFnQWhtQUlCQU93Q0FDR1pBaEFBcndNQUlab0NBUURyQWdBaG5BSUJBT3dDQUNHZEFnRUE3QUlBSVo0Q0FRRHNBZ0FobndJQkFPd0NBQ0dnQWtBQW9BTUFJYUVDQVFEc0FnQWhvZ0pBQUtBREFDR2pBa0FBb0FNQUlSRGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBTmdFbkFJaWdBSkFBTDBEQUNHWEFnRUF2QU1BSVpnQ0FRRElBd0FobVFJUUFNa0VBQ0dhQWdFQXZBTUFJWndDQVFESUF3QWhuUUlCQU1nREFDR2VBZ0VBeUFNQUlaOENBUURJQXdBaG9BSkFBT0FEQUNHaEFnRUF5QU1BSWFJQ1FBRGdBd0Fob3dKQUFPQURBQ0VCdkFJQUFBQ2NBZ0lRNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFEWUJKd0NJb0FDUUFDOUF3QWhsd0lCQUx3REFDR1lBZ0VBeUFNQUlaa0NFQURKQkFBaG1nSUJBTHdEQUNHY0FnRUF5QU1BSVowQ0FRRElBd0FobmdJQkFNZ0RBQ0dmQWdFQXlBTUFJYUFDUUFEZ0F3QWhvUUlCQU1nREFDR2lBa0FBNEFNQUlhTUNRQURnQXdBaEVPSUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ2NBZ0tBQWtBQUFBQUJsd0lCQUFBQUFaZ0NBUUFBQUFHWkFoQUFBQUFCbWdJQkFBQUFBWndDQVFBQUFBR2RBZ0VBQUFBQm5nSUJBQUFBQVo4Q0FRQUFBQUdnQWtBQUFBQUJvUUlCQUFBQUFhSUNRQUFBQUFHakFrQUFBQUFCQ2dnQUFOd0VBQ0FLQUFEZEJBQWc0Z0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3ZBZ0tBQWtBQUFBQUJxd0pBQUFBQUFhd0NBZ0FBQUFHdEFoQUFBQUFCQXlNQUFKUUdBQ0M1QWdBQWxRWUFJTDhDQUFBRkFDQUVJd0FBemdRQU1Ma0NBQURQQkFBd3V3SUFBTkVFQUNDX0FnQUEwZ1FBTUJJRkFBQ1JCUUFnQ3dBQWtnVUFJQXdBQUpNRkFDQU5BQUNVQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFJMENBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUdHQWdFQUFBQUJod0lCQUFBQUFZZ0NFQUFBQUFHSkFnSUFBQUFCaWdJSUFBQUFBWXNDQUFDUUJRQWdqUUlCQUFBQUFRSUFBQUFGQUNBakFBQ1BCUUFnQXdBQUFBVUFJQ01BQUk4RkFDQWtBQURyQkFBZ0FSd0FBSk1HQURBWEJRQUF1QU1BSUFZQUFLRURBQ0FMQUFEMEFnQWdEQUFBOVFJQUlBMEFBUGNDQUNEZkFRQUF0UU1BTU9BQkFBQURBQkRoQVFBQXRRTUFNT0lCQVFBQUFBSGxBVUFBOGdJQUlmb0JBQUMzQTQwQ0l2NEJJQUR3QWdBaGdBSkFBUElDQUNHRUFnRUE2d0lBSVlVQ0FRQUFBQUdHQWdFQTZ3SUFJWWNDQVFEckFnQWhpQUlRQUs4REFDR0pBZ0lBOFFJQUlZb0NDQUMyQXdBaGl3SUFBUDRDQUNDTkFnRUE2d0lBSVk0Q0FRRHJBZ0FoQWdBQUFBVUFJQndBQU9zRUFDQUNBQUFBNWdRQUlCd0FBT2NFQUNBUzN3RUFBT1VFQUREZ0FRQUE1Z1FBRU9FQkFBRGxCQUF3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDM0E0MENJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUURyQWdBaGhnSUJBT3NDQUNHSEFnRUE2d0lBSVlnQ0VBQ3ZBd0FoaVFJQ0FQRUNBQ0dLQWdnQXRnTUFJWXNDQUFELUFnQWdqUUlCQU9zQ0FDR09BZ0VBNndJQUlSTGZBUUFBNVFRQU1PQUJBQURtQkFBUTRRRUFBT1VFQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFMY0RqUUlpX2dFZ0FQQUNBQ0dBQWtBQThnSUFJWVFDQVFEckFnQWhoUUlCQU9zQ0FDR0dBZ0VBNndJQUlZY0NBUURyQWdBaGlBSVFBSzhEQUNHSkFnSUE4UUlBSVlvQ0NBQzJBd0FoaXdJQUFQNENBQ0NOQWdFQTZ3SUFJWTRDQVFEckFnQWhEdUlCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBNmdTTkFpTC1BU0FBekFNQUlZQUNRQUM5QXdBaGhBSUJBTHdEQUNHRkFnRUF2QU1BSVlZQ0FRQzhBd0FoaHdJQkFMd0RBQ0dJQWhBQXlRUUFJWWtDQWdETkF3QWhpZ0lJQU9nRUFDR0xBZ0FBNlFRQUlJMENBUUM4QXdBaEJid0NDQUFBQUFIREFnZ0FBQUFCeEFJSUFBQUFBY1VDQ0FBQUFBSEdBZ2dBQUFBQkFyd0NBUUFBQUFUQ0FnRUFBQUFGQWJ3Q0FBQUFqUUlDRWdVQUFPd0VBQ0FMQUFEdEJBQWdEQUFBN2dRQUlBMEFBTzhFQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFPb0VqUUlpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR0dBZ0VBdkFNQUlZY0NBUUM4QXdBaGlBSVFBTWtFQUNHSkFnSUF6UU1BSVlvQ0NBRG9CQUFoaXdJQUFPa0VBQ0NOQWdFQXZBTUFJUVVqQUFDQkJnQWdKQUFBa1FZQUlMa0NBQUNDQmdBZ3VnSUFBSkFHQUNDX0FnQUFmd0FnQ3lNQUFJUUZBREFrQUFDSUJRQXd1UUlBQUlVRkFEQzZBZ0FBaGdVQU1Mc0NBQUNIQlFBZ3ZBSUFBTU1FQURDOUFnQUF3d1FBTUw0Q0FBRERCQUF3dndJQUFNTUVBRERBQWdBQWlRVUFNTUVDQUFER0JBQXdDeU1BQVBrRUFEQWtBQUQ5QkFBd3VRSUFBUG9FQURDNkFnQUEtd1FBTUxzQ0FBRDhCQUFndkFJQUFMVUVBREM5QWdBQXRRUUFNTDRDQUFDMUJBQXd2d0lBQUxVRUFEREFBZ0FBX2dRQU1NRUNBQUM0QkFBd0N5TUFBUEFFQURBa0FBRDBCQUF3dVFJQUFQRUVBREM2QWdBQThnUUFNTHNDQUFEekJBQWd2QUlBQUpFRUFEQzlBZ0FBa1FRQU1MNENBQUNSQkFBd3Z3SUFBSkVFQUREQUFnQUE5UVFBTU1FQ0FBQ1VCQUF3QkFjQUFNQURBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFFQ0FBQUFHQUFnSXdBQS1BUUFJQU1BQUFBWUFDQWpBQUQ0QkFBZ0pBQUE5d1FBSUFFY0FBQ1BCZ0F3QWdBQUFCZ0FJQndBQVBjRUFDQUNBQUFBbFFRQUlCd0FBUFlFQUNBRDRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoQkFjQUFMNERBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDRUVCd0FBd0FNQUlPSUJBUUFBQUFIakFRRUFBQUFCNVFGQUFBQUFBUWdIQUFDREJRQWc0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCX2dFZ0FBQUFBWUFDUUFBQUFBR0tBZ0lBQUFBQmtnSUJBQUFBQVFJQUFBQVVBQ0FqQUFDQ0JRQWdBd0FBQUJRQUlDTUFBSUlGQUNBa0FBQ0FCUUFnQVJ3QUFJNEdBREFDQUFBQUZBQWdIQUFBZ0FVQUlBSUFBQUM1QkFBZ0hBQUFfd1FBSUFmaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhpZ0lDQU0wREFDR1NBZ0VBdkFNQUlRZ0hBQUNCQlFBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWW9DQWdETkF3QWhrZ0lCQUx3REFDRUZJd0FBaVFZQUlDUUFBSXdHQUNDNUFnQUFpZ1lBSUxvQ0FBQ0xCZ0FndndJQUFKOENBQ0FJQndBQWd3VUFJT0lCQVFBQUFBSGpBUUVBQUFBQjVRRkFBQUFBQWY0QklBQUFBQUdBQWtBQUFBQUJpZ0lDQUFBQUFaSUNBUUFBQUFFREl3QUFpUVlBSUxrQ0FBQ0tCZ0FndndJQUFKOENBQ0FLQndBQWpnVUFJQW9BQU4wRUFDRGlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFLOENBb0FDUUFBQUFBR3JBa0FBQUFBQnJBSUNBQUFBQWEwQ0VBQUFBQUVDQUFBQUN3QWdJd0FBalFVQUlBTUFBQUFMQUNBakFBQ05CUUFnSkFBQWl3VUFJQUVjQUFDSUJnQXdBZ0FBQUFzQUlCd0FBSXNGQUNBQ0FBQUF4d1FBSUJ3QUFJb0ZBQ0FJNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQU1vRXJ3SWlnQUpBQUwwREFDR3JBa0FBdlFNQUlhd0NBZ0ROQXdBaHJRSVFBTWtFQUNFS0J3QUFqQVVBSUFvQUFNMEVBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBeWdTdkFpS0FBa0FBdlFNQUlhc0NRQUM5QXdBaHJBSUNBTTBEQUNHdEFoQUF5UVFBSVFVakFBQ0RCZ0FnSkFBQWhnWUFJTGtDQUFDRUJnQWd1Z0lBQUlVR0FDQ19BZ0FBbndJQUlBb0hBQUNPQlFBZ0NnQUEzUVFBSU9JQkFRQUFBQUhqQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBcndJQ2dBSkFBQUFBQWFzQ1FBQUFBQUdzQWdJQUFBQUJyUUlRQUFBQUFRTWpBQUNEQmdBZ3VRSUFBSVFHQUNDX0FnQUFud0lBSUJJRkFBQ1JCUUFnQ3dBQWtnVUFJQXdBQUpNRkFDQU5BQUNVQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFJMENBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUdHQWdFQUFBQUJod0lCQUFBQUFZZ0NFQUFBQUFHSkFnSUFBQUFCaWdJSUFBQUFBWXNDQUFDUUJRQWdqUUlCQUFBQUFRRzhBZ0VBQUFBRUF5TUFBSUVHQUNDNUFnQUFnZ1lBSUw4Q0FBQl9BQ0FFSXdBQWhBVUFNTGtDQUFDRkJRQXd1d0lBQUljRkFDQ19BZ0FBd3dRQU1BUWpBQUQ1QkFBd3VRSUFBUG9FQURDN0FnQUFfQVFBSUw4Q0FBQzFCQUF3QkNNQUFQQUVBREM1QWdBQThRUUFNTHNDQUFEekJBQWd2d0lBQUpFRUFEQUVJd0FBM2dRQU1Ma0NBQURmQkFBd3V3SUFBT0VFQUNDX0FnQUE0Z1FBTUFRakFBQ19CQUF3dVFJQUFNQUVBREM3QWdBQXdnUUFJTDhDQUFEREJBQXdCQ01BQUxFRUFEQzVBZ0FBc2dRQU1Mc0NBQUMwQkFBZ3Z3SUFBTFVFQURBRUl3QUFtUVFBTUxrQ0FBQ2FCQUF3dXdJQUFKd0VBQ0NfQWdBQW5RUUFNQVFqQUFDTkJBQXd1UUlBQUk0RUFEQzdBZ0FBa0FRQUlMOENBQUNSQkFBd0JDTUFBSUFFQURDNUFnQUFnUVFBTUxzQ0FBQ0RCQUFndndJQUFJUUVBREFFSXdBQTR3TUFNTGtDQUFEa0F3QXd1d0lBQU9ZREFDQ19BZ0FBNXdNQU1BUWpBQURXQXdBd3VRSUFBTmNEQURDN0FnQUEyUU1BSUw4Q0FBRGFBd0F3QUFBQUFBQUFBQUFBQUFBQUFBVWpBQUQ4QlFBZ0pBQUFfd1VBSUxrQ0FBRDlCUUFndWdJQUFQNEZBQ0NfQWdBQW53SUFJQU1qQUFEOEJRQWd1UUlBQVAwRkFDQ19BZ0FBbndJQUlBQUFBQUFBQUFBQUJTTUFBUGNGQUNBa0FBRDZCUUFndVFJQUFQZ0ZBQ0M2QWdBQS1RVUFJTDhDQUFDZkFnQWdBeU1BQVBjRkFDQzVBZ0FBLUFVQUlMOENBQUNmQWdBZ0FBQUFBQUFGSXdBQThnVUFJQ1FBQVBVRkFDQzVBZ0FBOHdVQUlMb0NBQUQwQlFBZ3Z3SUFBQXNBSUFNakFBRHlCUUFndVFJQUFQTUZBQ0NfQWdBQUN3QWdBQUFBQlNNQUFPMEZBQ0FrQUFEd0JRQWd1UUlBQU80RkFDQzZBZ0FBN3dVQUlMOENBQUNmQWdBZ0F5TUFBTzBGQUNDNUFnQUE3Z1VBSUw4Q0FBQ2ZBZ0FnQUFBQUFBQUFDeU1BQU1rRkFEQWtBQUROQlFBd3VRSUFBTW9GQURDNkFnQUF5d1VBTUxzQ0FBRE1CUUFndkFJQUFPSUVBREM5QWdBQTRnUUFNTDRDQUFEaUJBQXd2d0lBQU9JRUFEREFBZ0FBemdVQU1NRUNBQURsQkFBd0VnWUFBS3NGQUNBTEFBQ1NCUUFnREFBQWt3VUFJQTBBQUpRRkFDRGlBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFqUUlDX2dFZ0FBQUFBWUFDUUFBQUFBR0VBZ0VBQUFBQmhRSUJBQUFBQVlZQ0FRQUFBQUdIQWdFQUFBQUJpQUlRQUFBQUFZa0NBZ0FBQUFHS0FnZ0FBQUFCaXdJQUFKQUZBQ0NPQWdFQUFBQUJBZ0FBQUFVQUlDTUFBTkVGQUNBREFBQUFCUUFnSXdBQTBRVUFJQ1FBQU5BRkFDQUJIQUFBN0FVQU1BSUFBQUFGQUNBY0FBRFFCUUFnQWdBQUFPWUVBQ0FjQUFEUEJRQWdEdUlCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBNmdTTkFpTC1BU0FBekFNQUlZQUNRQUM5QXdBaGhBSUJBTHdEQUNHRkFnRUF2QU1BSVlZQ0FRQzhBd0FoaHdJQkFMd0RBQ0dJQWhBQXlRUUFJWWtDQWdETkF3QWhpZ0lJQU9nRUFDR0xBZ0FBNlFRQUlJNENBUUM4QXdBaEVnWUFBS29GQUNBTEFBRHRCQUFnREFBQTdnUUFJQTBBQU84RUFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBT29FalFJaV9nRWdBTXdEQUNHQUFrQUF2UU1BSVlRQ0FRQzhBd0FoaFFJQkFMd0RBQ0dHQWdFQXZBTUFJWWNDQVFDOEF3QWhpQUlRQU1rRUFDR0pBZ0lBelFNQUlZb0NDQURvQkFBaGl3SUFBT2tFQUNDT0FnRUF2QU1BSVJJR0FBQ3JCUUFnQ3dBQWtnVUFJQXdBQUpNRkFDQU5BQUNVQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFJMENBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUdHQWdFQUFBQUJod0lCQUFBQUFZZ0NFQUFBQUFHSkFnSUFBQUFCaWdJSUFBQUFBWXNDQUFDUUJRQWdqZ0lCQUFBQUFRUWpBQURKQlFBd3VRSUFBTW9GQURDN0FnQUF6QVVBSUw4Q0FBRGlCQUF3QUFBQUFBQUFBQUFGSXdBQTV3VUFJQ1FBQU9vRkFDQzVBZ0FBNkFVQUlMb0NBQURwQlFBZ3Z3SUFBSjhDQUNBREl3QUE1d1VBSUxrQ0FBRG9CUUFndndJQUFKOENBQ0FBQUFBTUF3QUFuUVVBSUFzQUFKNEZBQ0FNQUFDZkJRQWdEZ0FBb0FVQUlBOEFBS0VGQUNBUUFBQ2lCUUFnRVFBQW93VUFJQklBQUtRRkFDRHpBUUFBd2dNQUlQUUJBQURDQXdBZzlRRUFBTUlEQUNEMkFRQUF3Z01BSUFJUkFBQ2pCUUFnRXdBQTRBVUFJQVVIQUFEZ0JRQWdGQUFBNFFVQUlCVUFBT0lGQUNBV0FBQ2pCUUFndFFJQUFNSURBQ0FGQlFBQTVnVUFJQVlBQU9BRkFDQUxBQUNlQlFBZ0RBQUFud1VBSUEwQUFLRUZBQ0FEQndBQTRBVUFJQWdBQU9NRkFDQUtBQURsQlFBZ0FBRURBQUNkQlFBZ0ZnTUFBSlVGQUNBTEFBQ1dCUUFnREFBQWx3VUFJQThBQUprRkFDQVFBQUNhQlFBZ0VRQUFtd1VBSUJJQUFKd0ZBQ0RpQVFFQUFBQUI1UUZBQUFBQUFmRUJBUUFBQUFIeUFRRUFBQUFCOHdFQkFBQUFBZlFCQVFBQUFBSDFBUUVBQUFBQjlnRUJBQUFBQWZnQkFBQUEtQUVDLWdFQUFBRDZBUUw4QVFBQUFQd0JBdjBCSUFBQUFBSC1BU0FBQUFBQl93RUNBQUFBQVlBQ1FBQUFBQUVDQUFBQW53SUFJQ01BQU9jRkFDQURBQUFBb2dJQUlDTUFBT2NGQUNBa0FBRHJCUUFnR0FBQUFLSUNBQ0FEQUFET0F3QWdDd0FBendNQUlBd0FBTkFEQUNBUEFBRFNBd0FnRUFBQTB3TUFJQkVBQU5RREFDQVNBQURWQXdBZ0hBQUE2d1VBSU9JQkFRQzhBd0FoNVFGQUFMMERBQ0h4QVFFQXZBTUFJZklCQVFDOEF3QWg4d0VCQU1nREFDSDBBUUVBeUFNQUlmVUJBUURJQXdBaDlnRUJBTWdEQUNINEFRQUF5UVA0QVNMNkFRQUF5Z1A2QVNMOEFRQUF5d1A4QVNMOUFTQUF6QU1BSWY0QklBRE1Bd0FoX3dFQ0FNMERBQ0dBQWtBQXZRTUFJUllEQUFET0F3QWdDd0FBendNQUlBd0FBTkFEQUNBUEFBRFNBd0FnRUFBQTB3TUFJQkVBQU5RREFDQVNBQURWQXdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoRHVJQkFRQUFBQUhsQVVBQUFBQUItZ0VBQUFDTkFnTC1BU0FBQUFBQmdBSkFBQUFBQVlRQ0FRQUFBQUdGQWdFQUFBQUJoZ0lCQUFBQUFZY0NBUUFBQUFHSUFoQUFBQUFCaVFJQ0FBQUFBWW9DQ0FBQUFBR0xBZ0FBa0FVQUlJNENBUUFBQUFFV0F3QUFsUVVBSUFzQUFKWUZBQ0FNQUFDWEJRQWdEZ0FBbUFVQUlBOEFBSmtGQUNBUkFBQ2JCUUFnRWdBQW5BVUFJT0lCQVFBQUFBSGxBVUFBQUFBQjhRRUJBQUFBQWZJQkFRQUFBQUh6QVFFQUFBQUI5QUVCQUFBQUFmVUJBUUFBQUFIMkFRRUFBQUFCLUFFQUFBRDRBUUw2QVFBQUFQb0JBdndCQUFBQV9BRUNfUUVnQUFBQUFmNEJJQUFBQUFIX0FRSUFBQUFCZ0FKQUFBQUFBUUlBQUFDZkFnQWdJd0FBN1FVQUlBTUFBQUNpQWdBZ0l3QUE3UVVBSUNRQUFQRUZBQ0FZQUFBQW9nSUFJQU1BQU00REFDQUxBQURQQXdBZ0RBQUEwQU1BSUE0QUFORURBQ0FQQUFEU0F3QWdFUUFBMUFNQUlCSUFBTlVEQUNBY0FBRHhCUUFnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZkVCQVFDOEF3QWg4Z0VCQUx3REFDSHpBUUVBeUFNQUlmUUJBUURJQXdBaDlRRUJBTWdEQUNIMkFRRUF5QU1BSWZnQkFBREpBX2dCSXZvQkFBREtBX29CSXZ3QkFBRExBX3dCSXYwQklBRE1Bd0FoX2dFZ0FNd0RBQ0hfQVFJQXpRTUFJWUFDUUFDOUF3QWhGZ01BQU00REFDQUxBQURQQXdBZ0RBQUEwQU1BSUE0QUFORURBQ0FQQUFEU0F3QWdFUUFBMUFNQUlCSUFBTlVEQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0h5QVFFQXZBTUFJZk1CQVFESUF3QWg5QUVCQU1nREFDSDFBUUVBeUFNQUlmWUJBUURJQXdBaC1BRUFBTWtELUFFaS1nRUFBTW9ELWdFaV9BRUFBTXNEX0FFaV9RRWdBTXdEQUNILUFTQUF6QU1BSWY4QkFnRE5Bd0FoZ0FKQUFMMERBQ0VMQndBQWpnVUFJQWdBQU53RUFDRGlBUUVBQUFBQjR3RUJBQUFBQWVRQkFRQUFBQUhsQVVBQUFBQUItZ0VBQUFDdkFnS0FBa0FBQUFBQnF3SkFBQUFBQWF3Q0FnQUFBQUd0QWhBQUFBQUJBZ0FBQUFzQUlDTUFBUElGQUNBREFBQUFDUUFnSXdBQThnVUFJQ1FBQVBZRkFDQU5BQUFBQ1FBZ0J3QUFqQVVBSUFnQUFNd0VBQ0FjQUFEMkJRQWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUF5Z1N2QWlLQUFrQUF2UU1BSWFzQ1FBQzlBd0FockFJQ0FNMERBQ0d0QWhBQXlRUUFJUXNIQUFDTUJRQWdDQUFBekFRQUlPSUJBUUM4QXdBaDR3RUJBTHdEQUNIa0FRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFNb0Vyd0lpZ0FKQUFMMERBQ0dyQWtBQXZRTUFJYXdDQWdETkF3QWhyUUlRQU1rRUFDRVdBd0FBbFFVQUlBc0FBSllGQUNBTUFBQ1hCUUFnRGdBQW1BVUFJQThBQUprRkFDQVFBQUNhQlFBZ0VRQUFtd1VBSU9JQkFRQUFBQUhsQVVBQUFBQUI4UUVCQUFBQUFmSUJBUUFBQUFIekFRRUFBQUFCOUFFQkFBQUFBZlVCQVFBQUFBSDJBUUVBQUFBQi1BRUFBQUQ0QVFMNkFRQUFBUG9CQXZ3QkFBQUFfQUVDX1FFZ0FBQUFBZjRCSUFBQUFBSF9BUUlBQUFBQmdBSkFBQUFBQVFJQUFBQ2ZBZ0FnSXdBQTl3VUFJQU1BQUFDaUFnQWdJd0FBOXdVQUlDUUFBUHNGQUNBWUFBQUFvZ0lBSUFNQUFNNERBQ0FMQUFEUEF3QWdEQUFBMEFNQUlBNEFBTkVEQUNBUEFBRFNBd0FnRUFBQTB3TUFJQkVBQU5RREFDQWNBQUQ3QlFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoRmdNQUFNNERBQ0FMQUFEUEF3QWdEQUFBMEFNQUlBNEFBTkVEQUNBUEFBRFNBd0FnRUFBQTB3TUFJQkVBQU5RREFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFV0N3QUFsZ1VBSUF3QUFKY0ZBQ0FPQUFDWUJRQWdEd0FBbVFVQUlCQUFBSm9GQUNBUkFBQ2JCUUFnRWdBQW5BVUFJT0lCQVFBQUFBSGxBVUFBQUFBQjhRRUJBQUFBQWZJQkFRQUFBQUh6QVFFQUFBQUI5QUVCQUFBQUFmVUJBUUFBQUFIMkFRRUFBQUFCLUFFQUFBRDRBUUw2QVFBQUFQb0JBdndCQUFBQV9BRUNfUUVnQUFBQUFmNEJJQUFBQUFIX0FRSUFBQUFCZ0FKQUFBQUFBUUlBQUFDZkFnQWdJd0FBX0FVQUlBTUFBQUNpQWdBZ0l3QUFfQVVBSUNRQUFJQUdBQ0FZQUFBQW9nSUFJQXNBQU04REFDQU1BQURRQXdBZ0RnQUEwUU1BSUE4QUFOSURBQ0FRQUFEVEF3QWdFUUFBMUFNQUlCSUFBTlVEQUNBY0FBQ0FCZ0FnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZkVCQVFDOEF3QWg4Z0VCQUx3REFDSHpBUUVBeUFNQUlmUUJBUURJQXdBaDlRRUJBTWdEQUNIMkFRRUF5QU1BSWZnQkFBREpBX2dCSXZvQkFBREtBX29CSXZ3QkFBRExBX3dCSXYwQklBRE1Bd0FoX2dFZ0FNd0RBQ0hfQVFJQXpRTUFJWUFDUUFDOUF3QWhGZ3NBQU04REFDQU1BQURRQXdBZ0RnQUEwUU1BSUE4QUFOSURBQ0FRQUFEVEF3QWdFUUFBMUFNQUlCSUFBTlVEQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0h5QVFFQXZBTUFJZk1CQVFESUF3QWg5QUVCQU1nREFDSDFBUUVBeUFNQUlmWUJBUURJQXdBaC1BRUFBTWtELUFFaS1nRUFBTW9ELWdFaV9BRUFBTXNEX0FFaV9RRWdBTXdEQUNILUFTQUF6QU1BSWY4QkFnRE5Bd0FoZ0FKQUFMMERBQ0VGNGdFQkFBQUFBZVVCUUFBQUFBSHhBUUVBQUFBQmdBSkFBQUFBQVlVQ0FRQUFBQUVDQUFBQWZ3QWdJd0FBZ1FZQUlCWURBQUNWQlFBZ0RBQUFsd1VBSUE0QUFKZ0ZBQ0FQQUFDWkJRQWdFQUFBbWdVQUlCRUFBSnNGQUNBU0FBQ2NCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSHhBUUVBQUFBQjhnRUJBQUFBQWZNQkFRQUFBQUgwQVFFQUFBQUI5UUVCQUFBQUFmWUJBUUFBQUFINEFRQUFBUGdCQXZvQkFBQUEtZ0VDX0FFQUFBRDhBUUw5QVNBQUFBQUJfZ0VnQUFBQUFmOEJBZ0FBQUFHQUFrQUFBQUFCQWdBQUFKOENBQ0FqQUFDREJnQWdBd0FBQUtJQ0FDQWpBQUNEQmdBZ0pBQUFod1lBSUJnQUFBQ2lBZ0FnQXdBQXpnTUFJQXdBQU5BREFDQU9BQURSQXdBZ0R3QUEwZ01BSUJBQUFOTURBQ0FSQUFEVUF3QWdFZ0FBMVFNQUlCd0FBSWNHQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0h5QVFFQXZBTUFJZk1CQVFESUF3QWg5QUVCQU1nREFDSDFBUUVBeUFNQUlmWUJBUURJQXdBaC1BRUFBTWtELUFFaS1nRUFBTW9ELWdFaV9BRUFBTXNEX0FFaV9RRWdBTXdEQUNILUFTQUF6QU1BSWY4QkFnRE5Bd0FoZ0FKQUFMMERBQ0VXQXdBQXpnTUFJQXdBQU5BREFDQU9BQURSQXdBZ0R3QUEwZ01BSUJBQUFOTURBQ0FSQUFEVUF3QWdFZ0FBMVFNQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoOHdFQkFNZ0RBQ0gwQVFFQXlBTUFJZlVCQVFESUF3QWg5Z0VCQU1nREFDSDRBUUFBeVFQNEFTTDZBUUFBeWdQNkFTTDhBUUFBeXdQOEFTTDlBU0FBekFNQUlmNEJJQURNQXdBaF93RUNBTTBEQUNHQUFrQUF2UU1BSVFqaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSDZBUUFBQUs4Q0FvQUNRQUFBQUFHckFrQUFBQUFCckFJQ0FBQUFBYTBDRUFBQUFBRVdBd0FBbFFVQUlBc0FBSllGQUNBT0FBQ1lCUUFnRHdBQW1RVUFJQkFBQUpvRkFDQVJBQUNiQlFBZ0VnQUFuQVVBSU9JQkFRQUFBQUhsQVVBQUFBQUI4UUVCQUFBQUFmSUJBUUFBQUFIekFRRUFBQUFCOUFFQkFBQUFBZlVCQVFBQUFBSDJBUUVBQUFBQi1BRUFBQUQ0QVFMNkFRQUFBUG9CQXZ3QkFBQUFfQUVDX1FFZ0FBQUFBZjRCSUFBQUFBSF9BUUlBQUFBQmdBSkFBQUFBQVFJQUFBQ2ZBZ0FnSXdBQWlRWUFJQU1BQUFDaUFnQWdJd0FBaVFZQUlDUUFBSTBHQUNBWUFBQUFvZ0lBSUFNQUFNNERBQ0FMQUFEUEF3QWdEZ0FBMFFNQUlBOEFBTklEQUNBUUFBRFRBd0FnRVFBQTFBTUFJQklBQU5VREFDQWNBQUNOQmdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoRmdNQUFNNERBQ0FMQUFEUEF3QWdEZ0FBMFFNQUlBOEFBTklEQUNBUUFBRFRBd0FnRVFBQTFBTUFJQklBQU5VREFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFSDRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJfZ0VnQUFBQUFZQUNRQUFBQUFHS0FnSUFBQUFCa2dJQkFBQUFBUVBpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFFREFBQUFnZ0VBSUNNQUFJRUdBQ0FrQUFDU0JnQWdCd0FBQUlJQkFDQWNBQUNTQmdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoZ0FKQUFMMERBQ0dGQWdFQXZBTUFJUVhpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDR0FBa0FBdlFNQUlZVUNBUUM4QXdBaER1SUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ05BZ0wtQVNBQUFBQUJnQUpBQUFBQUFZUUNBUUFBQUFHRkFnRUFBQUFCaGdJQkFBQUFBWWNDQVFBQUFBR0lBaEFBQUFBQmlRSUNBQUFBQVlvQ0NBQUFBQUdMQWdBQWtBVUFJSTBDQVFBQUFBRVRCUUFBa1FVQUlBWUFBS3NGQUNBTUFBQ1RCUUFnRFFBQWxBVUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNOQWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQmhnSUJBQUFBQVljQ0FRQUFBQUdJQWhBQUFBQUJpUUlDQUFBQUFZb0NDQUFBQUFHTEFnQUFrQVVBSUkwQ0FRQUFBQUdPQWdFQUFBQUJBZ0FBQUFVQUlDTUFBSlFHQUNBUTRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFKd0NBb0FDUUFBQUFBR1hBZ0VBQUFBQm1BSUJBQUFBQVprQ0VBQUFBQUdhQWdFQUFBQUJuQUlCQUFBQUFaMENBUUFBQUFHZUFnRUFBQUFCbndJQkFBQUFBYUFDUUFBQUFBR2hBZ0VBQUFBQm9nSkFBQUFBQWFNQ1FBQUFBQUVEQUFBQUF3QWdJd0FBbEFZQUlDUUFBSmtHQUNBVkFBQUFBd0FnQlFBQTdBUUFJQVlBQUtvRkFDQU1BQUR1QkFBZ0RRQUE3d1FBSUJ3QUFKa0dBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQU9vRWpRSWlfZ0VnQU13REFDR0FBa0FBdlFNQUlZUUNBUUM4QXdBaGhRSUJBTHdEQUNHR0FnRUF2QU1BSVljQ0FRQzhBd0FoaUFJUUFNa0VBQ0dKQWdJQXpRTUFJWW9DQ0FEb0JBQWhpd0lBQU9rRUFDQ05BZ0VBdkFNQUlZNENBUUM4QXdBaEV3VUFBT3dFQUNBR0FBQ3FCUUFnREFBQTdnUUFJQTBBQU84RUFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBT29FalFJaV9nRWdBTXdEQUNHQUFrQUF2UU1BSVlRQ0FRQzhBd0FoaFFJQkFMd0RBQ0dHQWdFQXZBTUFJWWNDQVFDOEF3QWhpQUlRQU1rRUFDR0pBZ0lBelFNQUlZb0NDQURvQkFBaGl3SUFBT2tFQUNDTkFnRUF2QU1BSVk0Q0FRQzhBd0FoQ09JQkFRQUFBQUhrQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBcndJQ2dBSkFBQUFBQWFzQ1FBQUFBQUdzQWdJQUFBQUJyUUlRQUFBQUFSTUZBQUNSQlFBZ0JnQUFxd1VBSUFzQUFKSUZBQ0FOQUFDVUJRQWc0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSTBDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDRUFBQUFBR0pBZ0lBQUFBQmlnSUlBQUFBQVlzQ0FBQ1FCUUFnalFJQkFBQUFBWTRDQVFBQUFBRUNBQUFBQlFBZ0l3QUFtd1lBSUFNQUFBQURBQ0FqQUFDYkJnQWdKQUFBbndZQUlCVUFBQUFEQUNBRkFBRHNCQUFnQmdBQXFnVUFJQXNBQU8wRUFDQU5BQUR2QkFBZ0hBQUFud1lBSU9JQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTZnU05BaUwtQVNBQXpBTUFJWUFDUUFDOUF3QWhoQUlCQUx3REFDR0ZBZ0VBdkFNQUlZWUNBUUM4QXdBaGh3SUJBTHdEQUNHSUFoQUF5UVFBSVlrQ0FnRE5Bd0FoaWdJSUFPZ0VBQ0dMQWdBQTZRUUFJSTBDQVFDOEF3QWhqZ0lCQUx3REFDRVRCUUFBN0FRQUlBWUFBS29GQUNBTEFBRHRCQUFnRFFBQTd3UUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBNmdTTkFpTC1BU0FBekFNQUlZQUNRQUM5QXdBaGhBSUJBTHdEQUNHRkFnRUF2QU1BSVlZQ0FRQzhBd0FoaHdJQkFMd0RBQ0dJQWhBQXlRUUFJWWtDQWdETkF3QWhpZ0lJQU9nRUFDR0xBZ0FBNlFRQUlJMENBUUM4QXdBaGpnSUJBTHdEQUNFSDRnRUJBQUFBQWVRQkFRQUFBQUhsQVVBQUFBQUJfZ0VnQUFBQUFZQUNRQUFBQUFHS0FnSUFBQUFCa2dJQkFBQUFBUWZpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBYkFDQVFBQUFBRzFBZ0VBQUFBQkN1SUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3pBZ0wtQVNBQUFBQUJnQUpBQUFBQUFZUUNBUUFBQUFHRkFnRUFBQUFCcndJQkFBQUFBYkFDQVFBQUFBR3hBZ0VBQUFBQkEtSUJBUUFBQUFIa0FRRUFBQUFCNVFGQUFBQUFBUWZpQVFFQUFBQUI1UUZBQUFBQUFZUUNBUUFBQUFHbEFnQUFBS1VDQXFZQ0FRQUFBQUduQWdFQUFBQUJxQUlnQUFBQUFRc0hBQUQ4QXdBZ0ZBQUEtd01BSUJVQUFQOERBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBYkFDQVFBQUFBRzBBZ0VBQUFBQnRRSUJBQUFBQVFJQUFBQUJBQ0FqQUFDbEJnQWdGZ01BQUpVRkFDQUxBQUNXQlFBZ0RBQUFsd1VBSUE0QUFKZ0ZBQ0FQQUFDWkJRQWdFQUFBbWdVQUlCSUFBSndGQUNEaUFRRUFBQUFCNVFGQUFBQUFBZkVCQVFBQUFBSHlBUUVBQUFBQjh3RUJBQUFBQWZRQkFRQUFBQUgxQVFFQUFBQUI5Z0VCQUFBQUFmZ0JBQUFBLUFFQy1nRUFBQUQ2QVFMOEFRQUFBUHdCQXYwQklBQUFBQUgtQVNBQUFBQUJfd0VDQUFBQUFZQUNRQUFBQUFFQ0FBQUFud0lBSUNNQUFLY0dBQ0FNRXdBQTNBVUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN6QWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQnJ3SUJBQUFBQWJBQ0FRQUFBQUd4QWdFQUFBQUJzd0lCQUFBQUFRSUFBQUFoQUNBakFBQ3BCZ0FnQXdBQUFLSUNBQ0FqQUFDbkJnQWdKQUFBclFZQUlCZ0FBQUNpQWdBZ0F3QUF6Z01BSUFzQUFNOERBQ0FNQUFEUUF3QWdEZ0FBMFFNQUlBOEFBTklEQUNBUUFBRFRBd0FnRWdBQTFRTUFJQndBQUswR0FDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFV0F3QUF6Z01BSUFzQUFNOERBQ0FNQUFEUUF3QWdEZ0FBMFFNQUlBOEFBTklEQUNBUUFBRFRBd0FnRWdBQTFRTUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaDh3RUJBTWdEQUNIMEFRRUF5QU1BSWZVQkFRRElBd0FoOWdFQkFNZ0RBQ0g0QVFBQXlRUDRBU0w2QVFBQXlnUDZBU0w4QVFBQXl3UDhBU0w5QVNBQXpBTUFJZjRCSUFETUF3QWhfd0VDQU0wREFDR0FBa0FBdlFNQUlRZmlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFiQUNBUUFBQUFHMEFnRUFBQUFCQXdBQUFDZ0FJQ01BQUtVR0FDQWtBQUN4QmdBZ0RRQUFBQ2dBSUFjQUFQa0RBQ0FVQUFEdUF3QWdGUUFBN3dNQUlCd0FBTEVHQUNEaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhzQUlCQUx3REFDRzBBZ0VBdkFNQUliVUNBUURJQXdBaEN3Y0FBUGtEQUNBVUFBRHVBd0FnRlFBQTd3TUFJT0lCQVFDOEF3QWg0d0VCQUx3REFDSGxBVUFBdlFNQUlmNEJJQURNQXdBaGdBSkFBTDBEQUNHd0FnRUF2QU1BSWJRQ0FRQzhBd0FodFFJQkFNZ0RBQ0VEQUFBQUh3QWdJd0FBcVFZQUlDUUFBTFFHQUNBT0FBQUFId0FnRXdBQTJ3VUFJQndBQUxRR0FDRGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBS01Fc3dJaV9nRWdBTXdEQUNHQUFrQUF2UU1BSVlRQ0FRQzhBd0FoaFFJQkFMd0RBQ0d2QWdFQXZBTUFJYkFDQVFDOEF3QWhzUUlCQUx3REFDR3pBZ0VBdkFNQUlRd1RBQURiQlFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBQ2pCTE1DSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhyd0lCQUx3REFDR3dBZ0VBdkFNQUliRUNBUUM4QXdBaHN3SUJBTHdEQUNFSDRnRUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFiQUNBUUFBQUFHMEFnRUFBQUFCdFFJQkFBQUFBUVhpQVFFQUFBQUI1UUZBQUFBQUFaTUNBUUFBQUFHVUFrQUFBQUFCbFFKQUFBQUFBUk1GQUFDUkJRQWdCZ0FBcXdVQUlBc0FBSklGQUNBTUFBQ1RCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSDZBUUFBQUkwQ0F2NEJJQUFBQUFHQUFrQUFBQUFCaEFJQkFBQUFBWVVDQVFBQUFBR0dBZ0VBQUFBQmh3SUJBQUFBQVlnQ0VBQUFBQUdKQWdJQUFBQUJpZ0lJQUFBQUFZc0NBQUNRQlFBZ2pRSUJBQUFBQVk0Q0FRQUFBQUVDQUFBQUJRQWdJd0FBdHdZQUlCWURBQUNWQlFBZ0N3QUFsZ1VBSUF3QUFKY0ZBQ0FPQUFDWUJRQWdFQUFBbWdVQUlCRUFBSnNGQUNBU0FBQ2NCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSHhBUUVBQUFBQjhnRUJBQUFBQWZNQkFRQUFBQUgwQVFFQUFBQUI5UUVCQUFBQUFmWUJBUUFBQUFINEFRQUFBUGdCQXZvQkFBQUEtZ0VDX0FFQUFBRDhBUUw5QVNBQUFBQUJfZ0VnQUFBQUFmOEJBZ0FBQUFHQUFrQUFBQUFCQWdBQUFKOENBQ0FqQUFDNUJnQWdBd0FBQUFNQUlDTUFBTGNHQUNBa0FBQzlCZ0FnRlFBQUFBTUFJQVVBQU93RUFDQUdBQUNxQlFBZ0N3QUE3UVFBSUF3QUFPNEVBQ0FjQUFDOUJnQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmb0JBQURxQkkwQ0l2NEJJQURNQXdBaGdBSkFBTDBEQUNHRUFnRUF2QU1BSVlVQ0FRQzhBd0FoaGdJQkFMd0RBQ0dIQWdFQXZBTUFJWWdDRUFESkJBQWhpUUlDQU0wREFDR0tBZ2dBNkFRQUlZc0NBQURwQkFBZ2pRSUJBTHdEQUNHT0FnRUF2QU1BSVJNRkFBRHNCQUFnQmdBQXFnVUFJQXNBQU8wRUFDQU1BQUR1QkFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBRHFCSTBDSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhoZ0lCQUx3REFDR0hBZ0VBdkFNQUlZZ0NFQURKQkFBaGlRSUNBTTBEQUNHS0FnZ0E2QVFBSVlzQ0FBRHBCQUFnalFJQkFMd0RBQ0dPQWdFQXZBTUFJUU1BQUFDaUFnQWdJd0FBdVFZQUlDUUFBTUFHQUNBWUFBQUFvZ0lBSUFNQUFNNERBQ0FMQUFEUEF3QWdEQUFBMEFNQUlBNEFBTkVEQUNBUUFBRFRBd0FnRVFBQTFBTUFJQklBQU5VREFDQWNBQURBQmdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoRmdNQUFNNERBQ0FMQUFEUEF3QWdEQUFBMEFNQUlBNEFBTkVEQUNBUUFBRFRBd0FnRVFBQTFBTUFJQklBQU5VREFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFRkJBQVJCd0FERkFBQ0ZUa0JGam9CQXdRQUVCRTNBUk1BQXdrREJnUUVBQThMSFFjTUhnb09JZ0lQSXdzUUp3MFJLZ0VTTGc0R0JBQU1CUUFGQmdBREN3d0hEQlVLRFJrTEFnTUhCQVFBQmdFRENBQUVCQUFKQndBRENBQUVDaEFJQVFrQUJ3RUtFUUFDQndBRENBQUVBZ2NBQXdnQUJBTUxHZ0FNR3dBTkhBQUJCd0FEQVFjQUF3Z0RMd0FMTUFBTU1RQU9NZ0FQTXdBUU5BQVJOUUFTTmdBQkVUZ0FBUlk3QUFBREJ3QURGQUFDRlVVQkF3Y0FBeFFBQWhWTEFRTUVBQllwQUJjcUFCZ0FBQUFEQkFBV0tRQVhLZ0FZQVJNQUF3RVRBQU1EQkFBZEtRQWVLZ0FmQUFBQUF3UUFIU2tBSGlvQUh3SUhBQU1JQUFRQ0J3QURDQUFFQlFRQUpDa0FKeW9BS0VzQUpVd0FKZ0FBQUFBQUJRUUFKQ2tBSnlvQUtFc0FKVXdBSmdBQUF3UUFMU2tBTGlvQUx3QUFBQU1FQUMwcEFDNHFBQzhBQUFBREJBQTFLUUEyS2dBM0FBQUFBd1FBTlNrQU5pb0FOd0VIQUFNQkJ3QURBd1FBUENrQVBTb0FQZ0FBQUFNRUFEd3BBRDBxQUQ0QkNRQUhBUWtBQndVRUFFTXBBRVlxQUVkTEFFUk1BRVVBQUFBQUFBVUVBRU1wQUVZcUFFZExBRVJNQUVVQkJ3QURBUWNBQXdNRUFFd3BBRTBxQUU0QUFBQURCQUJNS1FCTktnQk9BZ2NBQXdnQUJBSUhBQU1JQUFRRkJBQlRLUUJXS2dCWFN3QlVUQUJWQUFBQUFBQUZCQUJUS1FCV0tnQlhTd0JVVEFCVkFnVUFCUVlBQXdJRkFBVUdBQU1GQkFCY0tRQmZLZ0JnU3dCZFRBQmVBQUFBQUFBRkJBQmNLUUJmS2dCZ1N3QmRUQUJlQUFBRkJBQmxLUUJvS2dCcFN3Qm1UQUJuQUFBQUFBQUZCQUJsS1FCb0tnQnBTd0JtVEFCbkFnY0FBd2dBQkFJSEFBTUlBQVFEQkFCdUtRQnZLZ0J3QUFBQUF3UUFiaWtBYnlvQWNCY0NBUmc4QVJrOUFSby1BUnNfQVIxQkFSNURFaDlFRXlCSEFTRkpFaUpLRkNWTUFTWk5BU2RPRWl0UkZTeFNHUzFUQWk1VUFpOVZBakJXQWpGWEFqSlpBak5iRWpSY0dqVmVBalpnRWpkaEd6aGlBamxqQWpwa0VqdG5IRHhvSUQxcEJ6NXFCejlyQjBCc0IwRnRCMEp2QjBOeEVrUnlJVVYwQjBaMkVrZDNJa2g0QjBsNUIwcDZFazE5STA1LUtVLUFBUVZRZ1FFRlVZUUJCVktGQVFWVGhnRUZWSWdCQlZXS0FSSldpd0VxVjQwQkJWaVBBUkpaa0FFcldwRUJCVnVTQVFWY2t3RVNYWllCTEY2WEFUQmZtUUV4WUpvQk1XR2RBVEZpbmdFeFk1OEJNV1NoQVRGbG93RVNacVFCTW1lbUFURm9xQUVTYWFrQk0ycXFBVEZycXdFeGJLd0JFbTJ2QVRSdXNBRTRiN0VCRFhDeUFRMXhzd0VOY3JRQkRYTzFBUTEwdHdFTmRia0JFbmE2QVRsM3ZBRU5lTDRCRW5tX0FUcDZ3QUVOZThFQkRYekNBUko5eFFFN2ZzWUJQM19IQVFpQUFjZ0JDSUVCeVFFSWdnSEtBUWlEQWNzQkNJUUJ6UUVJaFFIUEFSS0dBZEFCUUljQjBnRUlpQUhVQVJLSkFkVUJRWW9CMWdFSWl3SFhBUWlNQWRnQkVvMEIyd0ZDamdIY0FVaVBBZDBCRHBBQjNnRU9rUUhmQVE2U0FlQUJEcE1CNFFFT2xBSGpBUTZWQWVVQkVwWUI1Z0ZKbHdIb0FRNllBZW9CRXBrQjZ3RkttZ0hzQVE2YkFlMEJEcHdCN2dFU25RSHhBVXVlQWZJQlQ1OEI4d0VLb0FIMEFRcWhBZlVCQ3FJQjlnRUtvd0gzQVFxa0Fma0JDcVVCLXdFU3BnSDhBVkNuQWY0QkNxZ0JnQUlTcVFHQkFsR3FBWUlDQ3FzQmd3SUtyQUdFQWhLdEFZY0NVcTRCaUFKWXJ3R0pBZ1N3QVlvQ0JMRUJpd0lFc2dHTUFnU3pBWTBDQkxRQmp3SUV0UUdSQWhLMkFaSUNXYmNCbEFJRXVBR1dBaEs1QVpjQ1dyb0JtQUlFdXdHWkFnUzhBWm9DRXIwQm5RSmJ2Z0dlQW1HX0FhQUNBOEFCb1FJRHdRR2tBZ1BDQWFVQ0E4TUJwZ0lEeEFHb0FnUEZBYW9DRXNZQnF3Sml4d0d0QWdQSUFhOENFc2tCc0FKanlnR3hBZ1BMQWJJQ0E4d0Jzd0lTelFHMkFtVE9BYmNDYXM4QnVBSUwwQUc1QWd2UkFib0NDOUlCdXdJTDB3RzhBZ3ZVQWI0Q0M5VUJ3QUlTMWdIQkFtdlhBY01DQzlnQnhRSVMyUUhHQW16YUFjY0NDOXNCeUFJTDNBSEpBaExkQWN3Q2JkNEJ6UUp4XCJcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGVjb2RlQmFzZTY0QXNXYXNtKHdhc21CYXNlNjQ6IHN0cmluZyk6IFByb21pc2U8V2ViQXNzZW1ibHkuTW9kdWxlPiB7XG4gIGNvbnN0IHsgQnVmZmVyIH0gPSBhd2FpdCBpbXBvcnQoJ25vZGU6YnVmZmVyJylcbiAgY29uc3Qgd2FzbUFycmF5ID0gQnVmZmVyLmZyb20od2FzbUJhc2U2NCwgJ2Jhc2U2NCcpXG4gIHJldHVybiBuZXcgV2ViQXNzZW1ibHkuTW9kdWxlKHdhc21BcnJheSlcbn1cblxuY29uZmlnLmNvbXBpbGVyV2FzbSA9IHtcbiAgZ2V0UnVudGltZTogYXN5bmMgKCkgPT4gYXdhaXQgaW1wb3J0KFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9xdWVyeV9jb21waWxlcl9mYXN0X2JnLnBvc3RncmVzcWwubWpzXCIpLFxuXG4gIGdldFF1ZXJ5Q29tcGlsZXJXYXNtTW9kdWxlOiBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgeyB3YXNtIH0gPSBhd2FpdCBpbXBvcnQoXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcucG9zdGdyZXNxbC53YXNtLWJhc2U2NC5tanNcIilcbiAgICByZXR1cm4gYXdhaXQgZGVjb2RlQmFzZTY0QXNXYXNtKHdhc20pXG4gIH0sXG5cbiAgaW1wb3J0TmFtZTogXCIuL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcuanNcIlxufVxuXG5cblxuZXhwb3J0IHR5cGUgTG9nT3B0aW9uczxDbGllbnRPcHRpb25zIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnM+ID1cbiAgJ2xvZycgZXh0ZW5kcyBrZXlvZiBDbGllbnRPcHRpb25zID8gQ2xpZW50T3B0aW9uc1snbG9nJ10gZXh0ZW5kcyBBcnJheTxQcmlzbWEuTG9nTGV2ZWwgfCBQcmlzbWEuTG9nRGVmaW5pdGlvbj4gPyBQcmlzbWEuR2V0RXZlbnRzPENsaWVudE9wdGlvbnNbJ2xvZyddPiA6IG5ldmVyIDogbmV2ZXJcblxuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvciB7XG4gICAgLyoqXG4gICAqICMjIFByaXNtYSBDbGllbnRcbiAgICogXG4gICAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXI6IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICAgKiB9KVxuICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ0NvbW1lbnRzXG4gICAqIGNvbnN0IGJsb2dDb21tZW50cyA9IGF3YWl0IHByaXNtYS5ibG9nQ29tbWVudC5maW5kTWFueSgpXG4gICAqIGBgYFxuICAgKiBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvY2xpZW50KS5cbiAgICovXG5cbiAgbmV3IDxcbiAgICBPcHRpb25zIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnMgPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9ucyxcbiAgICBMb2dPcHRzIGV4dGVuZHMgTG9nT3B0aW9uczxPcHRpb25zPiA9IExvZ09wdGlvbnM8T3B0aW9ucz4sXG4gICAgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddID0gT3B0aW9ucyBleHRlbmRzIHsgb21pdDogaW5mZXIgVSB9ID8gVSA6IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10sXG4gICAgRXh0QXJncyBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3NcbiAgPihvcHRpb25zOiBQcmlzbWEuUHJpc21hQ2xpZW50Q29uc3RydWN0b3JBcmdzPE9wdGlvbnM+KTogUHJpc21hQ2xpZW50PExvZ09wdHMsIE9taXRPcHRzLCBFeHRBcmdzPlxufVxuXG4vKipcbiAqICMjIFByaXNtYSBDbGllbnRcbiAqIFxuICogVHlwZS1zYWZlIGRhdGFiYXNlIGNsaWVudCBmb3IgVHlwZVNjcmlwdFxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gKiAgIGFkYXB0ZXI6IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICogfSlcbiAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nQ29tbWVudHNcbiAqIGNvbnN0IGJsb2dDb21tZW50cyA9IGF3YWl0IHByaXNtYS5ibG9nQ29tbWVudC5maW5kTWFueSgpXG4gKiBgYGBcbiAqIFxuICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvY2xpZW50KS5cbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudDxcbiAgaW4gTG9nT3B0cyBleHRlbmRzIFByaXNtYS5Mb2dMZXZlbCA9IG5ldmVyLFxuICBpbiBvdXQgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSxcbiAgaW4gb3V0IEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzXG4+IHtcbiAgW0s6IHN5bWJvbF06IHsgdHlwZXM6IFByaXNtYS5UeXBlTWFwPEV4dEFyZ3M+WydvdGhlciddIH1cblxuICAkb248ViBleHRlbmRzIExvZ09wdHM+KGV2ZW50VHlwZTogViwgY2FsbGJhY2s6IChldmVudDogViBleHRlbmRzICdxdWVyeScgPyBQcmlzbWEuUXVlcnlFdmVudCA6IFByaXNtYS5Mb2dFdmVudCkgPT4gdm9pZCk6IFByaXNtYUNsaWVudDtcblxuICAvKipcbiAgICogQ29ubmVjdCB3aXRoIHRoZSBkYXRhYmFzZVxuICAgKi9cbiAgJGNvbm5lY3QoKTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8dm9pZD47XG5cbiAgLyoqXG4gICAqIERpc2Nvbm5lY3QgZnJvbSB0aGUgZGF0YWJhc2VcbiAgICovXG4gICRkaXNjb25uZWN0KCk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPHZvaWQ+O1xuXG4vKipcbiAgICogRXhlY3V0ZXMgYSBwcmVwYXJlZCByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIG51bWJlciBvZiBhZmZlY3RlZCByb3dzLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRleGVjdXRlUmF3YFVQREFURSBVc2VyIFNFVCBjb29sID0gJHt0cnVlfSBXSEVSRSBlbWFpbCA9ICR7J3VzZXJAZW1haWwuY29tJ307YFxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJGV4ZWN1dGVSYXc8VCA9IHVua25vd24+KHF1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFByaXNtYS5TcWwsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxudW1iZXI+O1xuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyBhIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIHJvd3MuXG4gICAqIFN1c2NlcHRpYmxlIHRvIFNRTCBpbmplY3Rpb25zLCBzZWUgZG9jdW1lbnRhdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kZXhlY3V0ZVJhd1Vuc2FmZSgnVVBEQVRFIFVzZXIgU0VUIGNvb2wgPSAkMSBXSEVSRSBlbWFpbCA9ICQyIDsnLCB0cnVlLCAndXNlckBlbWFpbC5jb20nKVxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJGV4ZWN1dGVSYXdVbnNhZmU8VCA9IHVua25vd24+KHF1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxudW1iZXI+O1xuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBhIHByZXBhcmVkIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgYFNFTEVDVGAgZGF0YS5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUICogRlJPTSBVc2VyIFdIRVJFIGlkID0gJHsxfSBPUiBlbWFpbCA9ICR7J3VzZXJAZW1haWwuY29tJ307YFxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJHF1ZXJ5UmF3PFQgPSB1bmtub3duPihxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBQcmlzbWEuU3FsLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8VD47XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIGEgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBgU0VMRUNUYCBkYXRhLlxuICAgKiBTdXNjZXB0aWJsZSB0byBTUUwgaW5qZWN0aW9ucywgc2VlIGRvY3VtZW50YXRpb24uXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3VW5zYWZlKCdTRUxFQ1QgKiBGUk9NIFVzZXIgV0hFUkUgaWQgPSAkMSBPUiBlbWFpbCA9ICQyOycsIDEsICd1c2VyQGVtYWlsLmNvbScpXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkcXVlcnlSYXdVbnNhZmU8VCA9IHVua25vd24+KHF1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxUPjtcblxuXG4gIC8qKlxuICAgKiBBbGxvd3MgdGhlIHJ1bm5pbmcgb2YgYSBzZXF1ZW5jZSBvZiByZWFkL3dyaXRlIG9wZXJhdGlvbnMgdGhhdCBhcmUgZ3VhcmFudGVlZCB0byBlaXRoZXIgc3VjY2VlZCBvciBmYWlsIGFzIGEgd2hvbGUuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBbZ2VvcmdlLCBib2IsIGFsaWNlXSA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oW1xuICAgKiAgIHByaXNtYS51c2VyLmNyZWF0ZSh7IGRhdGE6IHsgbmFtZTogJ0dlb3JnZScgfSB9KSxcbiAgICogICBwcmlzbWEudXNlci5jcmVhdGUoeyBkYXRhOiB7IG5hbWU6ICdCb2InIH0gfSksXG4gICAqICAgcHJpc21hLnVzZXIuY3JlYXRlKHsgZGF0YTogeyBuYW1lOiAnQWxpY2UnIH0gfSksXG4gICAqIF0pXG4gICAqIGBgYFxuICAgKiBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3Mvb3JtL3ByaXNtYS1jbGllbnQvcXVlcmllcy90cmFuc2FjdGlvbnMpLlxuICAgKi9cbiAgJHRyYW5zYWN0aW9uPFAgZXh0ZW5kcyBQcmlzbWEuUHJpc21hUHJvbWlzZTxhbnk+W10+KGFyZzogWy4uLlBdLCBvcHRpb25zPzogeyBtYXhXYWl0PzogbnVtYmVyLCB0aW1lb3V0PzogbnVtYmVyLCBpc29sYXRpb25MZXZlbD86IFByaXNtYS5UcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsIH0pOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxydW50aW1lLlR5cGVzLlV0aWxzLlVud3JhcFR1cGxlPFA+PlxuXG4gICR0cmFuc2FjdGlvbjxSPihmbjogKHByaXNtYTogT21pdDxQcmlzbWFDbGllbnQsIHJ1bnRpbWUuSVRYQ2xpZW50RGVueUxpc3Q+KSA9PiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxSPiwgb3B0aW9ucz86IHsgbWF4V2FpdD86IG51bWJlciwgdGltZW91dD86IG51bWJlciwgaXNvbGF0aW9uTGV2ZWw/OiBQcmlzbWEuVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCB9KTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8Uj5cblxuICAkZXh0ZW5kczogcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkV4dGVuZHNIb29rPFwiZXh0ZW5kc1wiLCBQcmlzbWEuVHlwZU1hcENiPE9taXRPcHRzPiwgRXh0QXJncywgcnVudGltZS5UeXBlcy5VdGlscy5DYWxsPFByaXNtYS5UeXBlTWFwQ2I8T21pdE9wdHM+LCB7XG4gICAgZXh0QXJnczogRXh0QXJnc1xuICB9Pj5cblxuICAgICAgLyoqXG4gICAqIGBwcmlzbWEuYmxvZ0NvbW1lbnRgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQmxvZ0NvbW1lbnQqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dDb21tZW50c1xuICAgICogY29uc3QgYmxvZ0NvbW1lbnRzID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBibG9nQ29tbWVudCgpOiBQcmlzbWEuQmxvZ0NvbW1lbnREZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmJsb2dQb3N0YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkJsb2dQb3N0KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nUG9zdHNcbiAgICAqIGNvbnN0IGJsb2dQb3N0cyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgYmxvZ1Bvc3QoKTogUHJpc21hLkJsb2dQb3N0RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5ib29raW5nYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkJvb2tpbmcqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJvb2tpbmdzXG4gICAgKiBjb25zdCBib29raW5ncyA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBib29raW5nKCk6IFByaXNtYS5Cb29raW5nRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5jYXRlZ29yeWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipDYXRlZ29yeSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQ2F0ZWdvcmllc1xuICAgICogY29uc3QgY2F0ZWdvcmllcyA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgY2F0ZWdvcnkoKTogUHJpc21hLkNhdGVnb3J5RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5jb250YWN0TWVzc2FnZWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipDb250YWN0TWVzc2FnZSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQ29udGFjdE1lc3NhZ2VzXG4gICAgKiBjb25zdCBjb250YWN0TWVzc2FnZXMgPSBhd2FpdCBwcmlzbWEuY29udGFjdE1lc3NhZ2UuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGNvbnRhY3RNZXNzYWdlKCk6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEubm90aWZpY2F0aW9uYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKk5vdGlmaWNhdGlvbioqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgTm90aWZpY2F0aW9uc1xuICAgICogY29uc3Qgbm90aWZpY2F0aW9ucyA9IGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24uZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IG5vdGlmaWNhdGlvbigpOiBQcmlzbWEuTm90aWZpY2F0aW9uRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5wYXltZW50YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlBheW1lbnQqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFBheW1lbnRzXG4gICAgKiBjb25zdCBwYXltZW50cyA9IGF3YWl0IHByaXNtYS5wYXltZW50LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBwYXltZW50KCk6IFByaXNtYS5QYXltZW50RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5yZWZyZXNoVG9rZW5gOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqUmVmcmVzaFRva2VuKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBSZWZyZXNoVG9rZW5zXG4gICAgKiBjb25zdCByZWZyZXNoVG9rZW5zID0gYXdhaXQgcHJpc21hLnJlZnJlc2hUb2tlbi5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgcmVmcmVzaFRva2VuKCk6IFByaXNtYS5SZWZyZXNoVG9rZW5EZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnJldmlld2A6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipSZXZpZXcqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFJldmlld3NcbiAgICAqIGNvbnN0IHJldmlld3MgPSBhd2FpdCBwcmlzbWEucmV2aWV3LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCByZXZpZXcoKTogUHJpc21hLlJldmlld0RlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEudG91clBhY2thZ2VgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqVG91clBhY2thZ2UqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFRvdXJQYWNrYWdlc1xuICAgICogY29uc3QgdG91clBhY2thZ2VzID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCB0b3VyUGFja2FnZSgpOiBQcmlzbWEuVG91clBhY2thZ2VEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnVzZXJgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqVXNlcioqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgVXNlcnNcbiAgICAqIGNvbnN0IHVzZXJzID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHVzZXIoKTogUHJpc21hLlVzZXJEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLndpc2hsaXN0SXRlbWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipXaXNobGlzdEl0ZW0qKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFdpc2hsaXN0SXRlbXNcbiAgICAqIGNvbnN0IHdpc2hsaXN0SXRlbXMgPSBhd2FpdCBwcmlzbWEud2lzaGxpc3RJdGVtLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCB3aXNobGlzdEl0ZW0oKTogUHJpc21hLldpc2hsaXN0SXRlbURlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQcmlzbWFDbGllbnRDbGFzcygpOiBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvciB7XG4gIHJldHVybiBydW50aW1lLmdldFByaXNtYUNsaWVudChjb25maWcpIGFzIHVua25vd24gYXMgUHJpc21hQ2xpZW50Q29uc3RydWN0b3Jcbn1cbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiAqIFdBUk5JTkc6IFRoaXMgaXMgYW4gaW50ZXJuYWwgZmlsZSB0aGF0IGlzIHN1YmplY3QgdG8gY2hhbmdlIVxuICpcbiAqIFx1RDgzRFx1REVEMSBVbmRlciBubyBjaXJjdW1zdGFuY2VzIHNob3VsZCB5b3UgaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseSEgXHVEODNEXHVERUQxXG4gKlxuICogQWxsIGV4cG9ydHMgZnJvbSB0aGlzIGZpbGUgYXJlIHdyYXBwZWQgdW5kZXIgYSBgUHJpc21hYCBuYW1lc3BhY2Ugb2JqZWN0IGluIHRoZSBjbGllbnQudHMgZmlsZS5cbiAqIFdoaWxlIHRoaXMgZW5hYmxlcyBwYXJ0aWFsIGJhY2t3YXJkIGNvbXBhdGliaWxpdHksIGl0IGlzIG5vdCBwYXJ0IG9mIHRoZSBzdGFibGUgcHVibGljIEFQSS5cbiAqXG4gKiBJZiB5b3UgYXJlIGxvb2tpbmcgZm9yIHlvdXIgTW9kZWxzLCBFbnVtcywgYW5kIElucHV0IFR5cGVzLCBwbGVhc2UgaW1wb3J0IHRoZW0gZnJvbSB0aGUgcmVzcGVjdGl2ZVxuICogbW9kZWwgZmlsZXMgaW4gdGhlIGBtb2RlbGAgZGlyZWN0b3J5IVxuICovXG5cbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSBcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvY2xpZW50XCJcbmltcG9ydCB0eXBlICogYXMgUHJpc21hIGZyb20gXCIuLi9tb2RlbHNcIlxuaW1wb3J0IHsgdHlwZSBQcmlzbWFDbGllbnQgfSBmcm9tIFwiLi9jbGFzc1wiXG5cbmV4cG9ydCB0eXBlICogZnJvbSAnLi4vbW9kZWxzJ1xuXG5leHBvcnQgdHlwZSBETU1GID0gdHlwZW9mIHJ1bnRpbWUuRE1NRlxuXG5leHBvcnQgdHlwZSBQcmlzbWFQcm9taXNlPFQ+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuUHJpc21hUHJvbWlzZTxUPlxuXG4vKipcbiAqIFByaXNtYSBFcnJvcnNcbiAqL1xuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3JcblxuLyoqXG4gKiBSZS1leHBvcnQgb2Ygc3FsLXRlbXBsYXRlLXRhZ1xuICovXG5leHBvcnQgY29uc3Qgc3FsID0gcnVudGltZS5zcWx0YWdcbmV4cG9ydCBjb25zdCBlbXB0eSA9IHJ1bnRpbWUuZW1wdHlcbmV4cG9ydCBjb25zdCBqb2luID0gcnVudGltZS5qb2luXG5leHBvcnQgY29uc3QgcmF3ID0gcnVudGltZS5yYXdcbmV4cG9ydCBjb25zdCBTcWwgPSBydW50aW1lLlNxbFxuZXhwb3J0IHR5cGUgU3FsID0gcnVudGltZS5TcWxcblxuXG5cbi8qKlxuICogRGVjaW1hbC5qc1xuICovXG5leHBvcnQgY29uc3QgRGVjaW1hbCA9IHJ1bnRpbWUuRGVjaW1hbFxuZXhwb3J0IHR5cGUgRGVjaW1hbCA9IHJ1bnRpbWUuRGVjaW1hbFxuXG5leHBvcnQgdHlwZSBEZWNpbWFsSnNMaWtlID0gcnVudGltZS5EZWNpbWFsSnNMaWtlXG5cbi8qKlxuKiBFeHRlbnNpb25zXG4qL1xuZXhwb3J0IHR5cGUgRXh0ZW5zaW9uID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLlVzZXJBcmdzXG5leHBvcnQgY29uc3QgZ2V0RXh0ZW5zaW9uQ29udGV4dCA9IHJ1bnRpbWUuRXh0ZW5zaW9ucy5nZXRFeHRlbnNpb25Db250ZXh0XG5leHBvcnQgdHlwZSBBcmdzPFQsIEYgZXh0ZW5kcyBydW50aW1lLk9wZXJhdGlvbj4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5BcmdzPFQsIEY+XG5leHBvcnQgdHlwZSBQYXlsb2FkPFQsIEYgZXh0ZW5kcyBydW50aW1lLk9wZXJhdGlvbiA9IG5ldmVyPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLlBheWxvYWQ8VCwgRj5cbmV4cG9ydCB0eXBlIFJlc3VsdDxULCBBLCBGIGV4dGVuZHMgcnVudGltZS5PcGVyYXRpb24+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuUmVzdWx0PFQsIEEsIEY+XG5leHBvcnQgdHlwZSBFeGFjdDxBLCBXPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLkV4YWN0PEEsIFc+XG5cbmV4cG9ydCB0eXBlIFByaXNtYVZlcnNpb24gPSB7XG4gIGNsaWVudDogc3RyaW5nXG4gIGVuZ2luZTogc3RyaW5nXG59XG5cbi8qKlxuICogUHJpc21hIENsaWVudCBKUyB2ZXJzaW9uOiA3LjkuMVxuICogUXVlcnkgRW5naW5lIHZlcnNpb246IGU5MjIwODliN2Q3NTAyYWZmNDI0OWQ1ZGEzNDIwZjZmYTU1ZmM2YWRcbiAqL1xuZXhwb3J0IGNvbnN0IHByaXNtYVZlcnNpb246IFByaXNtYVZlcnNpb24gPSB7XG4gIGNsaWVudDogXCI3LjkuMVwiLFxuICBlbmdpbmU6IFwiZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFwiXG59XG5cbi8qKlxuICogVXRpbGl0eSBUeXBlc1xuICovXG5cbmV4cG9ydCB0eXBlIEJ5dGVzID0gcnVudGltZS5CeXRlc1xuZXhwb3J0IHR5cGUgSnNvbk9iamVjdCA9IHJ1bnRpbWUuSnNvbk9iamVjdFxuZXhwb3J0IHR5cGUgSnNvbkFycmF5ID0gcnVudGltZS5Kc29uQXJyYXlcbmV4cG9ydCB0eXBlIEpzb25WYWx1ZSA9IHJ1bnRpbWUuSnNvblZhbHVlXG5leHBvcnQgdHlwZSBJbnB1dEpzb25PYmplY3QgPSBydW50aW1lLklucHV0SnNvbk9iamVjdFxuZXhwb3J0IHR5cGUgSW5wdXRKc29uQXJyYXkgPSBydW50aW1lLklucHV0SnNvbkFycmF5XG5leHBvcnQgdHlwZSBJbnB1dEpzb25WYWx1ZSA9IHJ1bnRpbWUuSW5wdXRKc29uVmFsdWVcblxuXG5leHBvcnQgY29uc3QgTnVsbFR5cGVzID0ge1xuICBEYk51bGw6IHJ1bnRpbWUuTnVsbFR5cGVzLkRiTnVsbCBhcyAobmV3IChzZWNyZXQ6IG5ldmVyKSA9PiB0eXBlb2YgcnVudGltZS5EYk51bGwpLFxuICBKc29uTnVsbDogcnVudGltZS5OdWxsVHlwZXMuSnNvbk51bGwgYXMgKG5ldyAoc2VjcmV0OiBuZXZlcikgPT4gdHlwZW9mIHJ1bnRpbWUuSnNvbk51bGwpLFxuICBBbnlOdWxsOiBydW50aW1lLk51bGxUeXBlcy5BbnlOdWxsIGFzIChuZXcgKHNlY3JldDogbmV2ZXIpID0+IHR5cGVvZiBydW50aW1lLkFueU51bGwpLFxufVxuLyoqXG4gKiBIZWxwZXIgZm9yIGZpbHRlcmluZyBKU09OIGVudHJpZXMgdGhhdCBoYXZlIGBudWxsYCBvbiB0aGUgZGF0YWJhc2UgKGVtcHR5IG9uIHRoZSBkYilcbiAqXG4gKiBAc2VlIGh0dHBzOi8vd3d3LnByaXNtYS5pby9kb2NzL2NvbmNlcHRzL2NvbXBvbmVudHMvcHJpc21hLWNsaWVudC93b3JraW5nLXdpdGgtZmllbGRzL3dvcmtpbmctd2l0aC1qc29uLWZpZWxkcyNmaWx0ZXJpbmctb24tYS1qc29uLWZpZWxkXG4gKi9cbmV4cG9ydCBjb25zdCBEYk51bGwgPSBydW50aW1lLkRiTnVsbFxuXG4vKipcbiAqIEhlbHBlciBmb3IgZmlsdGVyaW5nIEpTT04gZW50cmllcyB0aGF0IGhhdmUgSlNPTiBgbnVsbGAgdmFsdWVzIChub3QgZW1wdHkgb24gdGhlIGRiKVxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IEpzb25OdWxsID0gcnVudGltZS5Kc29uTnVsbFxuXG4vKipcbiAqIEhlbHBlciBmb3IgZmlsdGVyaW5nIEpTT04gZW50cmllcyB0aGF0IGFyZSBgUHJpc21hLkRiTnVsbGAgb3IgYFByaXNtYS5Kc29uTnVsbGBcbiAqXG4gKiBAc2VlIGh0dHBzOi8vd3d3LnByaXNtYS5pby9kb2NzL2NvbmNlcHRzL2NvbXBvbmVudHMvcHJpc21hLWNsaWVudC93b3JraW5nLXdpdGgtZmllbGRzL3dvcmtpbmctd2l0aC1qc29uLWZpZWxkcyNmaWx0ZXJpbmctb24tYS1qc29uLWZpZWxkXG4gKi9cbmV4cG9ydCBjb25zdCBBbnlOdWxsID0gcnVudGltZS5BbnlOdWxsXG5cblxudHlwZSBTZWxlY3RBbmRJbmNsdWRlID0ge1xuICBzZWxlY3Q6IGFueVxuICBpbmNsdWRlOiBhbnlcbn1cblxudHlwZSBTZWxlY3RBbmRPbWl0ID0ge1xuICBzZWxlY3Q6IGFueVxuICBvbWl0OiBhbnlcbn1cblxuLyoqXG4gKiBGcm9tIFQsIHBpY2sgYSBzZXQgb2YgcHJvcGVydGllcyB3aG9zZSBrZXlzIGFyZSBpbiB0aGUgdW5pb24gS1xuICovXG50eXBlIFByaXNtYV9fUGljazxULCBLIGV4dGVuZHMga2V5b2YgVD4gPSB7XG4gICAgW1AgaW4gS106IFRbUF07XG59O1xuXG5leHBvcnQgdHlwZSBFbnVtZXJhYmxlPFQ+ID0gVCB8IEFycmF5PFQ+O1xuXG4vKipcbiAqIFN1YnNldFxuICogQGRlc2MgRnJvbSBgVGAgcGljayBwcm9wZXJ0aWVzIHRoYXQgZXhpc3QgaW4gYFVgLiBTaW1wbGUgdmVyc2lvbiBvZiBJbnRlcnNlY3Rpb25cbiAqL1xuZXhwb3J0IHR5cGUgU3Vic2V0PFQsIFU+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiBrZXkgZXh0ZW5kcyBrZXlvZiBVID8gVFtrZXldIDogbmV2ZXI7XG59O1xuXG4vKipcbiAqIFJlc29sdmVkIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgYFByaXNtYUNsaWVudGAgY29uc3RydWN0b3IuXG4gKlxuICogV2hlbiBjYWxsZWQgd2l0aG91dCBhIG5hcnJvd2VyIG9wdGlvbnMgdHlwZSAodGhlIGNvbW1vbiBjYXNlKSwgdGhpcyByZXNvbHZlc1xuICogdG8gYFByaXNtYUNsaWVudE9wdGlvbnNgIGRpcmVjdGx5LCB3aGljaCBwcm9kdWNlcyBhIGNsZWFyIFR5cGVTY3JpcHQgZXJyb3JcbiAqIG1lc3NhZ2UgKGBub3QgYXNzaWduYWJsZSB0byBwYXJhbWV0ZXIgb2YgdHlwZSAnUHJpc21hQ2xpZW50T3B0aW9ucydgKSB3aGVuXG4gKiB0aGUgYXJndW1lbnQgaXMgbWlzc2luZyBvciBpbmNvbXBsZXRlLiBXaGVuIHRoZSB1c2VyIHN1cHBsaWVzIGEgbmFycm93ZXJcbiAqIG9wdGlvbnMgdHlwZSAoZS5nLiB2aWEgYSBsaXRlcmFsKSwgaXQgZmFsbHMgYmFjayB0byBgU3Vic2V0YCB0byBrZWVwXG4gKiBmaWx0ZXJpbmcgb3V0IHVua25vd24gcHJvcGVydGllcy5cbiAqL1xuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50Q29uc3RydWN0b3JBcmdzPE9wdGlvbnMgZXh0ZW5kcyBQcmlzbWFDbGllbnRPcHRpb25zPiA9XG4gIFtQcmlzbWFDbGllbnRPcHRpb25zXSBleHRlbmRzIFtPcHRpb25zXSA/IFByaXNtYUNsaWVudE9wdGlvbnMgOiBTdWJzZXQ8T3B0aW9ucywgUHJpc21hQ2xpZW50T3B0aW9ucz47XG5cbi8qKlxuICogU2VsZWN0U3Vic2V0XG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAuIFNpbXBsZSB2ZXJzaW9uIG9mIEludGVyc2VjdGlvbi5cbiAqIEFkZGl0aW9uYWxseSwgaXQgdmFsaWRhdGVzLCBpZiBib3RoIHNlbGVjdCBhbmQgaW5jbHVkZSBhcmUgcHJlc2VudC4gSWYgdGhlIGNhc2UsIGl0IGVycm9ycy5cbiAqL1xuZXhwb3J0IHR5cGUgU2VsZWN0U3Vic2V0PFQsIFU+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiBrZXkgZXh0ZW5kcyBrZXlvZiBVID8gVFtrZXldIDogbmV2ZXJcbn0gJlxuICAoVCBleHRlbmRzIFNlbGVjdEFuZEluY2x1ZGVcbiAgICA/ICdQbGVhc2UgZWl0aGVyIGNob29zZSBgc2VsZWN0YCBvciBgaW5jbHVkZWAuJ1xuICAgIDogVCBleHRlbmRzIFNlbGVjdEFuZE9taXRcbiAgICAgID8gJ1BsZWFzZSBlaXRoZXIgY2hvb3NlIGBzZWxlY3RgIG9yIGBvbWl0YC4nXG4gICAgICA6IHt9KVxuXG4vKipcbiAqIFN1YnNldCArIEludGVyc2VjdGlvblxuICogQGRlc2MgRnJvbSBgVGAgcGljayBwcm9wZXJ0aWVzIHRoYXQgZXhpc3QgaW4gYFVgIGFuZCBpbnRlcnNlY3QgYEtgXG4gKi9cbmV4cG9ydCB0eXBlIFN1YnNldEludGVyc2VjdGlvbjxULCBVLCBLPiA9IHtcbiAgW2tleSBpbiBrZXlvZiBUXToga2V5IGV4dGVuZHMga2V5b2YgVSA/IFRba2V5XSA6IG5ldmVyXG59ICZcbiAgS1xuXG50eXBlIFdpdGhvdXQ8VCwgVT4gPSB7IFtQIGluIEV4Y2x1ZGU8a2V5b2YgVCwga2V5b2YgVT5dPzogbmV2ZXIgfTtcblxuLyoqXG4gKiBYT1IgaXMgbmVlZGVkIHRvIGhhdmUgYSByZWFsIG11dHVhbGx5IGV4Y2x1c2l2ZSB1bmlvbiB0eXBlXG4gKiBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy80MjEyMzQwNy9kb2VzLXR5cGVzY3JpcHQtc3VwcG9ydC1tdXR1YWxseS1leGNsdXNpdmUtdHlwZXNcbiAqL1xuZXhwb3J0IHR5cGUgWE9SPFQsIFU+ID1cbiAgVCBleHRlbmRzIG9iamVjdCA/XG4gIFUgZXh0ZW5kcyBvYmplY3QgP1xuICAgICgoV2l0aG91dDxULCBVPiAmIFUpIHwgKFdpdGhvdXQ8VSwgVD4gJiBUKSkgJiBvYmplY3RcbiAgOiBVIDogVFxuXG5cbi8qKlxuICogSXMgVCBhIFJlY29yZD9cbiAqL1xudHlwZSBJc09iamVjdDxUIGV4dGVuZHMgYW55PiA9IFQgZXh0ZW5kcyBBcnJheTxhbnk+XG4/IEZhbHNlXG46IFQgZXh0ZW5kcyBEYXRlXG4/IEZhbHNlXG46IFQgZXh0ZW5kcyBVaW50OEFycmF5XG4/IEZhbHNlXG46IFQgZXh0ZW5kcyBCaWdJbnRcbj8gRmFsc2VcbjogVCBleHRlbmRzIG9iamVjdFxuPyBUcnVlXG46IEZhbHNlXG5cblxuLyoqXG4gKiBJZiBpdCdzIFRbXSwgcmV0dXJuIFRcbiAqL1xuZXhwb3J0IHR5cGUgVW5FbnVtZXJhdGU8VCBleHRlbmRzIHVua25vd24+ID0gVCBleHRlbmRzIEFycmF5PGluZmVyIFU+ID8gVSA6IFRcblxuLyoqXG4gKiBGcm9tIHRzLXRvb2xiZWx0XG4gKi9cblxudHlwZSBfX0VpdGhlcjxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IE9taXQ8TywgSz4gJlxuICB7XG4gICAgLy8gTWVyZ2UgYWxsIGJ1dCBLXG4gICAgW1AgaW4gS106IFByaXNtYV9fUGljazxPLCBQICYga2V5b2YgTz4gLy8gV2l0aCBLIHBvc3NpYmlsaXRpZXNcbiAgfVtLXVxuXG50eXBlIEVpdGhlclN0cmljdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IFN0cmljdDxfX0VpdGhlcjxPLCBLPj5cblxudHlwZSBFaXRoZXJMb29zZTxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IENvbXB1dGVSYXc8X19FaXRoZXI8TywgSz4+XG5cbnR5cGUgX0VpdGhlcjxcbiAgTyBleHRlbmRzIG9iamVjdCxcbiAgSyBleHRlbmRzIEtleSxcbiAgc3RyaWN0IGV4dGVuZHMgQm9vbGVhblxuPiA9IHtcbiAgMTogRWl0aGVyU3RyaWN0PE8sIEs+XG4gIDA6IEVpdGhlckxvb3NlPE8sIEs+XG59W3N0cmljdF1cblxuZXhwb3J0IHR5cGUgRWl0aGVyPFxuICBPIGV4dGVuZHMgb2JqZWN0LFxuICBLIGV4dGVuZHMgS2V5LFxuICBzdHJpY3QgZXh0ZW5kcyBCb29sZWFuID0gMVxuPiA9IE8gZXh0ZW5kcyB1bmtub3duID8gX0VpdGhlcjxPLCBLLCBzdHJpY3Q+IDogbmV2ZXJcblxuZXhwb3J0IHR5cGUgVW5pb24gPSBhbnlcblxuZXhwb3J0IHR5cGUgUGF0Y2hVbmRlZmluZWQ8TyBleHRlbmRzIG9iamVjdCwgTzEgZXh0ZW5kcyBvYmplY3Q+ID0ge1xuICBbSyBpbiBrZXlvZiBPXTogT1tLXSBleHRlbmRzIHVuZGVmaW5lZCA/IEF0PE8xLCBLPiA6IE9bS11cbn0gJiB7fVxuXG4vKiogSGVscGVyIFR5cGVzIGZvciBcIk1lcmdlXCIgKiovXG5leHBvcnQgdHlwZSBJbnRlcnNlY3RPZjxVIGV4dGVuZHMgVW5pb24+ID0gKFxuICBVIGV4dGVuZHMgdW5rbm93biA/IChrOiBVKSA9PiB2b2lkIDogbmV2ZXJcbikgZXh0ZW5kcyAoazogaW5mZXIgSSkgPT4gdm9pZFxuICA/IElcbiAgOiBuZXZlclxuXG5leHBvcnQgdHlwZSBPdmVyd3JpdGU8TyBleHRlbmRzIG9iamVjdCwgTzEgZXh0ZW5kcyBvYmplY3Q+ID0ge1xuICAgIFtLIGluIGtleW9mIE9dOiBLIGV4dGVuZHMga2V5b2YgTzEgPyBPMVtLXSA6IE9bS107XG59ICYge307XG5cbnR5cGUgX01lcmdlPFUgZXh0ZW5kcyBvYmplY3Q+ID0gSW50ZXJzZWN0T2Y8T3ZlcndyaXRlPFUsIHtcbiAgICBbSyBpbiBrZXlvZiBVXS0/OiBBdDxVLCBLPjtcbn0+PjtcblxudHlwZSBLZXkgPSBzdHJpbmcgfCBudW1iZXIgfCBzeW1ib2w7XG50eXBlIEF0U3RyaWN0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gT1tLICYga2V5b2YgT107XG50eXBlIEF0TG9vc2U8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBPIGV4dGVuZHMgdW5rbm93biA/IEF0U3RyaWN0PE8sIEs+IDogbmV2ZXI7XG5leHBvcnQgdHlwZSBBdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5LCBzdHJpY3QgZXh0ZW5kcyBCb29sZWFuID0gMT4gPSB7XG4gICAgMTogQXRTdHJpY3Q8TywgSz47XG4gICAgMDogQXRMb29zZTxPLCBLPjtcbn1bc3RyaWN0XTtcblxuZXhwb3J0IHR5cGUgQ29tcHV0ZVJhdzxBIGV4dGVuZHMgYW55PiA9IEEgZXh0ZW5kcyBGdW5jdGlvbiA/IEEgOiB7XG4gIFtLIGluIGtleW9mIEFdOiBBW0tdO1xufSAmIHt9O1xuXG5leHBvcnQgdHlwZSBPcHRpb25hbEZsYXQ8Tz4gPSB7XG4gIFtLIGluIGtleW9mIE9dPzogT1tLXTtcbn0gJiB7fTtcblxudHlwZSBfUmVjb3JkPEsgZXh0ZW5kcyBrZXlvZiBhbnksIFQ+ID0ge1xuICBbUCBpbiBLXTogVDtcbn07XG5cbi8vIGNhdXNlIHR5cGVzY3JpcHQgbm90IHRvIGV4cGFuZCB0eXBlcyBhbmQgcHJlc2VydmUgbmFtZXNcbnR5cGUgTm9FeHBhbmQ8VD4gPSBUIGV4dGVuZHMgdW5rbm93biA/IFQgOiBuZXZlcjtcblxuLy8gdGhpcyB0eXBlIGFzc3VtZXMgdGhlIHBhc3NlZCBvYmplY3QgaXMgZW50aXJlbHkgb3B0aW9uYWxcbmV4cG9ydCB0eXBlIEF0TGVhc3Q8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIHN0cmluZz4gPSBOb0V4cGFuZDxcbiAgTyBleHRlbmRzIHVua25vd25cbiAgPyB8IChLIGV4dGVuZHMga2V5b2YgTyA/IHsgW1AgaW4gS106IE9bUF0gfSAmIE8gOiBPKVxuICAgIHwge1tQIGluIGtleW9mIE8gYXMgUCBleHRlbmRzIEsgPyBQIDogbmV2ZXJdLT86IE9bUF19ICYgT1xuICA6IG5ldmVyPjtcblxudHlwZSBfU3RyaWN0PFUsIF9VID0gVT4gPSBVIGV4dGVuZHMgdW5rbm93biA/IFUgJiBPcHRpb25hbEZsYXQ8X1JlY29yZDxFeGNsdWRlPEtleXM8X1U+LCBrZXlvZiBVPiwgbmV2ZXI+PiA6IG5ldmVyO1xuXG5leHBvcnQgdHlwZSBTdHJpY3Q8VSBleHRlbmRzIG9iamVjdD4gPSBDb21wdXRlUmF3PF9TdHJpY3Q8VT4+O1xuLyoqIEVuZCBIZWxwZXIgVHlwZXMgZm9yIFwiTWVyZ2VcIiAqKi9cblxuZXhwb3J0IHR5cGUgTWVyZ2U8VSBleHRlbmRzIG9iamVjdD4gPSBDb21wdXRlUmF3PF9NZXJnZTxTdHJpY3Q8VT4+PjtcblxuZXhwb3J0IHR5cGUgQm9vbGVhbiA9IFRydWUgfCBGYWxzZVxuXG5leHBvcnQgdHlwZSBUcnVlID0gMVxuXG5leHBvcnQgdHlwZSBGYWxzZSA9IDBcblxuZXhwb3J0IHR5cGUgTm90PEIgZXh0ZW5kcyBCb29sZWFuPiA9IHtcbiAgMDogMVxuICAxOiAwXG59W0JdXG5cbmV4cG9ydCB0eXBlIEV4dGVuZHM8QTEgZXh0ZW5kcyBhbnksIEEyIGV4dGVuZHMgYW55PiA9IFtBMV0gZXh0ZW5kcyBbbmV2ZXJdXG4gID8gMCAvLyBhbnl0aGluZyBgbmV2ZXJgIGlzIGZhbHNlXG4gIDogQTEgZXh0ZW5kcyBBMlxuICA/IDFcbiAgOiAwXG5cbmV4cG9ydCB0eXBlIEhhczxVIGV4dGVuZHMgVW5pb24sIFUxIGV4dGVuZHMgVW5pb24+ID0gTm90PFxuICBFeHRlbmRzPEV4Y2x1ZGU8VTEsIFU+LCBVMT5cbj5cblxuZXhwb3J0IHR5cGUgT3I8QjEgZXh0ZW5kcyBCb29sZWFuLCBCMiBleHRlbmRzIEJvb2xlYW4+ID0ge1xuICAwOiB7XG4gICAgMDogMFxuICAgIDE6IDFcbiAgfVxuICAxOiB7XG4gICAgMDogMVxuICAgIDE6IDFcbiAgfVxufVtCMV1bQjJdXG5cbmV4cG9ydCB0eXBlIEtleXM8VSBleHRlbmRzIFVuaW9uPiA9IFUgZXh0ZW5kcyB1bmtub3duID8ga2V5b2YgVSA6IG5ldmVyXG5cbmV4cG9ydCB0eXBlIEdldFNjYWxhclR5cGU8VCwgTz4gPSBPIGV4dGVuZHMgb2JqZWN0ID8ge1xuICBbUCBpbiBrZXlvZiBUXTogUCBleHRlbmRzIGtleW9mIE9cbiAgICA/IE9bUF1cbiAgICA6IG5ldmVyXG59IDogbmV2ZXJcblxudHlwZSBGaWVsZFBhdGhzPFxuICBULFxuICBVID0gT21pdDxULCAnX2F2ZycgfCAnX3N1bScgfCAnX2NvdW50JyB8ICdfbWluJyB8ICdfbWF4Jz5cbj4gPSBJc09iamVjdDxUPiBleHRlbmRzIFRydWUgPyBVIDogVFxuXG5leHBvcnQgdHlwZSBHZXRIYXZpbmdGaWVsZHM8VD4gPSB7XG4gIFtLIGluIGtleW9mIFRdOiBPcjxcbiAgICBPcjxFeHRlbmRzPCdPUicsIEs+LCBFeHRlbmRzPCdBTkQnLCBLPj4sXG4gICAgRXh0ZW5kczwnTk9UJywgSz5cbiAgPiBleHRlbmRzIFRydWVcbiAgICA/IC8vIGluZmVyIGlzIG9ubHkgbmVlZGVkIHRvIG5vdCBoaXQgVFMgbGltaXRcbiAgICAgIC8vIGJhc2VkIG9uIHRoZSBicmlsbGlhbnQgaWRlYSBvZiBQaWVycmUtQW50b2luZSBNaWxsc1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy8zMDE4OCNpc3N1ZWNvbW1lbnQtNDc4OTM4NDM3XG4gICAgICBUW0tdIGV4dGVuZHMgaW5mZXIgVEtcbiAgICAgID8gR2V0SGF2aW5nRmllbGRzPFVuRW51bWVyYXRlPFRLPiBleHRlbmRzIG9iamVjdCA/IE1lcmdlPFVuRW51bWVyYXRlPFRLPj4gOiBuZXZlcj5cbiAgICAgIDogbmV2ZXJcbiAgICA6IHt9IGV4dGVuZHMgRmllbGRQYXRoczxUW0tdPlxuICAgID8gbmV2ZXJcbiAgICA6IEtcbn1ba2V5b2YgVF1cblxuLyoqXG4gKiBDb252ZXJ0IHR1cGxlIHRvIHVuaW9uXG4gKi9cbnR5cGUgX1R1cGxlVG9VbmlvbjxUPiA9IFQgZXh0ZW5kcyAoaW5mZXIgRSlbXSA/IEUgOiBuZXZlclxudHlwZSBUdXBsZVRvVW5pb248SyBleHRlbmRzIHJlYWRvbmx5IGFueVtdPiA9IF9UdXBsZVRvVW5pb248Sz5cbmV4cG9ydCB0eXBlIE1heWJlVHVwbGVUb1VuaW9uPFQ+ID0gVCBleHRlbmRzIGFueVtdID8gVHVwbGVUb1VuaW9uPFQ+IDogVFxuXG4vKipcbiAqIExpa2UgYFBpY2tgLCBidXQgYWRkaXRpb25hbGx5IGNhbiBhbHNvIGFjY2VwdCBhbiBhcnJheSBvZiBrZXlzXG4gKi9cbmV4cG9ydCB0eXBlIFBpY2tFbnVtZXJhYmxlPFQsIEsgZXh0ZW5kcyBFbnVtZXJhYmxlPGtleW9mIFQ+IHwga2V5b2YgVD4gPSBQcmlzbWFfX1BpY2s8VCwgTWF5YmVUdXBsZVRvVW5pb248Sz4+XG5cbi8qKlxuICogRXhjbHVkZSBhbGwga2V5cyB3aXRoIHVuZGVyc2NvcmVzXG4gKi9cbmV4cG9ydCB0eXBlIEV4Y2x1ZGVVbmRlcnNjb3JlS2V5czxUIGV4dGVuZHMgc3RyaW5nPiA9IFQgZXh0ZW5kcyBgXyR7c3RyaW5nfWAgPyBuZXZlciA6IFRcblxuXG5leHBvcnQgdHlwZSBGaWVsZFJlZjxNb2RlbCwgRmllbGRUeXBlPiA9IHJ1bnRpbWUuRmllbGRSZWY8TW9kZWwsIEZpZWxkVHlwZT5cblxudHlwZSBGaWVsZFJlZklucHV0VHlwZTxNb2RlbCwgRmllbGRUeXBlPiA9IE1vZGVsIGV4dGVuZHMgbmV2ZXIgPyBuZXZlciA6IEZpZWxkUmVmPE1vZGVsLCBGaWVsZFR5cGU+XG5cblxuZXhwb3J0IGNvbnN0IE1vZGVsTmFtZSA9IHtcbiAgQmxvZ0NvbW1lbnQ6ICdCbG9nQ29tbWVudCcsXG4gIEJsb2dQb3N0OiAnQmxvZ1Bvc3QnLFxuICBCb29raW5nOiAnQm9va2luZycsXG4gIENhdGVnb3J5OiAnQ2F0ZWdvcnknLFxuICBDb250YWN0TWVzc2FnZTogJ0NvbnRhY3RNZXNzYWdlJyxcbiAgTm90aWZpY2F0aW9uOiAnTm90aWZpY2F0aW9uJyxcbiAgUGF5bWVudDogJ1BheW1lbnQnLFxuICBSZWZyZXNoVG9rZW46ICdSZWZyZXNoVG9rZW4nLFxuICBSZXZpZXc6ICdSZXZpZXcnLFxuICBUb3VyUGFja2FnZTogJ1RvdXJQYWNrYWdlJyxcbiAgVXNlcjogJ1VzZXInLFxuICBXaXNobGlzdEl0ZW06ICdXaXNobGlzdEl0ZW0nXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE1vZGVsTmFtZSA9ICh0eXBlb2YgTW9kZWxOYW1lKVtrZXlvZiB0eXBlb2YgTW9kZWxOYW1lXVxuXG5cblxuZXhwb3J0IGludGVyZmFjZSBUeXBlTWFwQ2I8R2xvYmFsT21pdE9wdGlvbnMgPSB7fT4gZXh0ZW5kcyBydW50aW1lLlR5cGVzLlV0aWxzLkZuPHtleHRBcmdzOiBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzIH0sIHJ1bnRpbWUuVHlwZXMuVXRpbHMuUmVjb3JkPHN0cmluZywgYW55Pj4ge1xuICByZXR1cm5zOiBUeXBlTWFwPHRoaXNbJ3BhcmFtcyddWydleHRBcmdzJ10sIEdsb2JhbE9taXRPcHRpb25zPlxufVxuXG5leHBvcnQgdHlwZSBUeXBlTWFwPEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzLCBHbG9iYWxPbWl0T3B0aW9ucyA9IHt9PiA9IHtcbiAgZ2xvYmFsT21pdE9wdGlvbnM6IHtcbiAgICBvbWl0OiBHbG9iYWxPbWl0T3B0aW9uc1xuICB9XG4gIG1ldGE6IHtcbiAgICBtb2RlbFByb3BzOiBcImJsb2dDb21tZW50XCIgfCBcImJsb2dQb3N0XCIgfCBcImJvb2tpbmdcIiB8IFwiY2F0ZWdvcnlcIiB8IFwiY29udGFjdE1lc3NhZ2VcIiB8IFwibm90aWZpY2F0aW9uXCIgfCBcInBheW1lbnRcIiB8IFwicmVmcmVzaFRva2VuXCIgfCBcInJldmlld1wiIHwgXCJ0b3VyUGFja2FnZVwiIHwgXCJ1c2VyXCIgfCBcIndpc2hsaXN0SXRlbVwiXG4gICAgdHhJc29sYXRpb25MZXZlbDogVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbFxuICB9XG4gIG1vZGVsOiB7XG4gICAgQmxvZ0NvbW1lbnQ6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5CbG9nQ29tbWVudEZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudEZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudENyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudERlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVCbG9nQ29tbWVudD5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJsb2dDb21tZW50R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudENvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQmxvZ0NvbW1lbnRDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQmxvZ1Bvc3Q6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5CbG9nUG9zdEZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdERlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVCbG9nUG9zdD5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJsb2dQb3N0R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQmxvZ1Bvc3RDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQm9va2luZzoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRCb29raW5nUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQm9va2luZ0ZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1VwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQm9va2luZz5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQm9va2luZ0dyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQm9va2luZ0NvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBDYXRlZ29yeToge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRDYXRlZ29yeVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkNhdGVnb3J5RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUNhdGVnb3J5PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ2F0ZWdvcnlHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5DYXRlZ29yeUNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBDb250YWN0TWVzc2FnZToge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUNvbnRhY3RNZXNzYWdlPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ29udGFjdE1lc3NhZ2VHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Db250YWN0TWVzc2FnZUNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBOb3RpZmljYXRpb246IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25GaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25VcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25EZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25VcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25VcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvblVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlTm90aWZpY2F0aW9uPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLk5vdGlmaWNhdGlvbkdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Ob3RpZmljYXRpb25Db3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgUGF5bWVudDoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRQYXltZW50UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUGF5bWVudEZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnREZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnREZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUGF5bWVudD5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUGF5bWVudEdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUGF5bWVudENvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBSZWZyZXNoVG9rZW46IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUmVmcmVzaFRva2VuRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5GaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5VcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5EZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5VcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5VcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlblVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUmVmcmVzaFRva2VuPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJlZnJlc2hUb2tlbkdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5SZWZyZXNoVG9rZW5Db3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgUmV2aWV3OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFJldmlld1BheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlJldmlld0ZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0RlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0FnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVJldmlldz5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0dyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5SZXZpZXdHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUmV2aWV3Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFRvdXJQYWNrYWdlOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuVG91clBhY2thZ2VGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlVG91clBhY2thZ2U+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Ub3VyUGFja2FnZUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlRvdXJQYWNrYWdlQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFVzZXI6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kVXNlclBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlVzZXJGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVVzZXI+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlVzZXJHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlVzZXJDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgV2lzaGxpc3RJdGVtOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLldpc2hsaXN0SXRlbUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1DcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1DcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1DcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1VcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVdpc2hsaXN0SXRlbT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5XaXNobGlzdEl0ZW1Hcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuV2lzaGxpc3RJdGVtQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59ICYge1xuICBvdGhlcjoge1xuICAgIHBheWxvYWQ6IGFueVxuICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICRleGVjdXRlUmF3OiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBTcWwsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJGV4ZWN1dGVSYXdVbnNhZmU6IHtcbiAgICAgICAgYXJnczogW3F1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJHF1ZXJ5UmF3OiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBTcWwsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJHF1ZXJ5UmF3VW5zYWZlOiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBFbnVtc1xuICovXG5cbmV4cG9ydCBjb25zdCBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsID0gcnVudGltZS5tYWtlU3RyaWN0RW51bSh7XG4gIFJlYWRVbmNvbW1pdHRlZDogJ1JlYWRVbmNvbW1pdHRlZCcsXG4gIFJlYWRDb21taXR0ZWQ6ICdSZWFkQ29tbWl0dGVkJyxcbiAgUmVwZWF0YWJsZVJlYWQ6ICdSZXBlYXRhYmxlUmVhZCcsXG4gIFNlcmlhbGl6YWJsZTogJ1NlcmlhbGl6YWJsZSdcbn0gYXMgY29uc3QpXG5cbmV4cG9ydCB0eXBlIFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgPSAodHlwZW9mIFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwpW2tleW9mIHR5cGVvZiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsXVxuXG5cbmV4cG9ydCBjb25zdCBCbG9nQ29tbWVudFNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIGNvbnRlbnQ6ICdjb250ZW50JyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgcG9zdElkOiAncG9zdElkJyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgcGFyZW50SWQ6ICdwYXJlbnRJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQmxvZ0NvbW1lbnRTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIEJsb2dDb21tZW50U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQmxvZ0NvbW1lbnRTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IEJsb2dQb3N0U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdGl0bGU6ICd0aXRsZScsXG4gIHNsdWc6ICdzbHVnJyxcbiAgZXhjZXJwdDogJ2V4Y2VycHQnLFxuICBjb250ZW50OiAnY29udGVudCcsXG4gIGNvdmVySW1hZ2U6ICdjb3ZlckltYWdlJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgYXV0aG9ySWQ6ICdhdXRob3JJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIEJsb2dQb3N0U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IEJvb2tpbmdTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0cmF2ZWxEYXRlOiAndHJhdmVsRGF0ZScsXG4gIHRyYXZlbGVyczogJ3RyYXZlbGVycycsXG4gIHRvdGFsUHJpY2U6ICd0b3RhbFByaWNlJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgcGFja2FnZUlkOiAncGFja2FnZUlkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBCb29raW5nU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBCb29raW5nU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQm9va2luZ1NjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQ2F0ZWdvcnlTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBuYW1lOiAnbmFtZScsXG4gIHNsdWc6ICdzbHVnJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQ2F0ZWdvcnlTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBDYXRlZ29yeVNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBuYW1lOiAnbmFtZScsXG4gIGVtYWlsOiAnZW1haWwnLFxuICBzdWJqZWN0OiAnc3ViamVjdCcsXG4gIG1lc3NhZ2U6ICdtZXNzYWdlJyxcbiAgaXNSZXNvbHZlZDogJ2lzUmVzb2x2ZWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBOb3RpZmljYXRpb25TY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICB0eXBlOiAndHlwZScsXG4gIHRpdGxlOiAndGl0bGUnLFxuICBtZXNzYWdlOiAnbWVzc2FnZScsXG4gIGxpbms6ICdsaW5rJyxcbiAgaXNSZWFkOiAnaXNSZWFkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBOb3RpZmljYXRpb25TY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIE5vdGlmaWNhdGlvblNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIE5vdGlmaWNhdGlvblNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgUGF5bWVudFNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIGJvb2tpbmdJZDogJ2Jvb2tpbmdJZCcsXG4gIHRyYW5JZDogJ3RyYW5JZCcsXG4gIHZhbElkOiAndmFsSWQnLFxuICBhbW91bnQ6ICdhbW91bnQnLFxuICBjdXJyZW5jeTogJ2N1cnJlbmN5JyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgZ2F0ZXdheVBhZ2VVcmw6ICdnYXRld2F5UGFnZVVybCcsXG4gIHNzbFNlc3Npb25LZXk6ICdzc2xTZXNzaW9uS2V5JyxcbiAgY2FyZFR5cGU6ICdjYXJkVHlwZScsXG4gIGJhbmtUcmFuSWQ6ICdiYW5rVHJhbklkJyxcbiAgcGFpZEF0OiAncGFpZEF0JyxcbiAgcmVmdW5kUmVmSWQ6ICdyZWZ1bmRSZWZJZCcsXG4gIHJlZnVuZEluaXRpYXRlZEF0OiAncmVmdW5kSW5pdGlhdGVkQXQnLFxuICByZWZ1bmRDb21wbGV0ZWRBdDogJ3JlZnVuZENvbXBsZXRlZEF0JyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQYXltZW50U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBQYXltZW50U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgUGF5bWVudFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgUmVmcmVzaFRva2VuU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgaGFzaDogJ2hhc2gnLFxuICBleHBpcmVzQXQ6ICdleHBpcmVzQXQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICByZXZva2VkQXQ6ICdyZXZva2VkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFJlZnJlc2hUb2tlblNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgUmVmcmVzaFRva2VuU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgUmVmcmVzaFRva2VuU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBSZXZpZXdTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICByYXRpbmc6ICdyYXRpbmcnLFxuICBjb21tZW50OiAnY29tbWVudCcsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHBhY2thZ2VJZDogJ3BhY2thZ2VJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUmV2aWV3U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBSZXZpZXdTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBSZXZpZXdTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdGl0bGU6ICd0aXRsZScsXG4gIHNsdWc6ICdzbHVnJyxcbiAgZGVzY3JpcHRpb246ICdkZXNjcmlwdGlvbicsXG4gIGxvY2F0aW9uOiAnbG9jYXRpb24nLFxuICBwcmljZTogJ3ByaWNlJyxcbiAgZHVyYXRpb246ICdkdXJhdGlvbicsXG4gIHJhdGluZzogJ3JhdGluZycsXG4gIGltYWdlczogJ2ltYWdlcycsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIGNhdGVnb3J5SWQ6ICdjYXRlZ29yeUlkJyxcbiAgYWdlbnRJZDogJ2FnZW50SWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBVc2VyU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgbmFtZTogJ25hbWUnLFxuICBlbWFpbDogJ2VtYWlsJyxcbiAgcGFzc3dvcmQ6ICdwYXNzd29yZCcsXG4gIGdvb2dsZUlkOiAnZ29vZ2xlSWQnLFxuICBwaG9uZTogJ3Bob25lJyxcbiAgYXZhdGFyVXJsOiAnYXZhdGFyVXJsJyxcbiAgcm9sZTogJ3JvbGUnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBhdXRoUHJvdmlkZXI6ICdhdXRoUHJvdmlkZXInLFxuICBlbWFpbFZlcmlmaWVkOiAnZW1haWxWZXJpZmllZCcsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIHRva2VuVmVyc2lvbjogJ3Rva2VuVmVyc2lvbicsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVXNlclNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgVXNlclNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFVzZXJTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFdpc2hsaXN0SXRlbVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHBhY2thZ2VJZDogJ3BhY2thZ2VJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgV2lzaGxpc3RJdGVtU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBXaXNobGlzdEl0ZW1TY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBXaXNobGlzdEl0ZW1TY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFNvcnRPcmRlciA9IHtcbiAgYXNjOiAnYXNjJyxcbiAgZGVzYzogJ2Rlc2MnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFNvcnRPcmRlciA9ICh0eXBlb2YgU29ydE9yZGVyKVtrZXlvZiB0eXBlb2YgU29ydE9yZGVyXVxuXG5cbmV4cG9ydCBjb25zdCBRdWVyeU1vZGUgPSB7XG4gIGRlZmF1bHQ6ICdkZWZhdWx0JyxcbiAgaW5zZW5zaXRpdmU6ICdpbnNlbnNpdGl2ZSdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUXVlcnlNb2RlID0gKHR5cGVvZiBRdWVyeU1vZGUpW2tleW9mIHR5cGVvZiBRdWVyeU1vZGVdXG5cblxuZXhwb3J0IGNvbnN0IE51bGxzT3JkZXIgPSB7XG4gIGZpcnN0OiAnZmlyc3QnLFxuICBsYXN0OiAnbGFzdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgTnVsbHNPcmRlciA9ICh0eXBlb2YgTnVsbHNPcmRlcilba2V5b2YgdHlwZW9mIE51bGxzT3JkZXJdXG5cblxuXG4vKipcbiAqIEZpZWxkIHJlZmVyZW5jZXNcbiAqL1xuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnU3RyaW5nJ1xuICovXG5leHBvcnQgdHlwZSBTdHJpbmdGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdTdHJpbmcnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnU3RyaW5nW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RTdHJpbmdGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdTdHJpbmdbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29sZWFuJ1xuICovXG5leHBvcnQgdHlwZSBCb29sZWFuRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQm9vbGVhbic+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEYXRlVGltZSdcbiAqL1xuZXhwb3J0IHR5cGUgRGF0ZVRpbWVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEYXRlVGltZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEYXRlVGltZVtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RGF0ZVRpbWVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEYXRlVGltZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1Bvc3RTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Qb3N0U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUG9zdFN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQb3N0U3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUG9zdFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1Bvc3RTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdJbnQnXG4gKi9cbmV4cG9ydCB0eXBlIEludEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0ludCc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdJbnRbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEludEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0ludFtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RlY2ltYWwnXG4gKi9cbmV4cG9ydCB0eXBlIERlY2ltYWxGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEZWNpbWFsJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RlY2ltYWxbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdERlY2ltYWxGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEZWNpbWFsW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQm9va2luZ1N0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bUJvb2tpbmdTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29raW5nU3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Jvb2tpbmdTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Cb29raW5nU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQm9va2luZ1N0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ05vdGlmaWNhdGlvblR5cGUnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Ob3RpZmljYXRpb25UeXBlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnTm90aWZpY2F0aW9uVHlwZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdOb3RpZmljYXRpb25UeXBlW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtTm90aWZpY2F0aW9uVHlwZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ05vdGlmaWNhdGlvblR5cGVbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYXltZW50U3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUGF5bWVudFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BheW1lbnRTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGF5bWVudFN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBheW1lbnRTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYXltZW50U3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRmxvYXQnXG4gKi9cbmV4cG9ydCB0eXBlIEZsb2F0RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRmxvYXQnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRmxvYXRbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEZsb2F0RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRmxvYXRbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYWNrYWdlU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUGFja2FnZVN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BhY2thZ2VTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGFja2FnZVN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBhY2thZ2VTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYWNrYWdlU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUm9sZSdcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVJvbGVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdSb2xlJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1JvbGVbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Sb2xlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUm9sZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1VzZXJTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Vc2VyU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnVXNlclN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdVc2VyU3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtVXNlclN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1VzZXJTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdBdXRoUHJvdmlkZXInXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1BdXRoUHJvdmlkZXJGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdBdXRoUHJvdmlkZXInPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQXV0aFByb3ZpZGVyW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtQXV0aFByb3ZpZGVyRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQXV0aFByb3ZpZGVyW10nPlxuICAgIFxuXG4vKipcbiAqIEJhdGNoIFBheWxvYWQgZm9yIHVwZGF0ZU1hbnkgJiBkZWxldGVNYW55ICYgY3JlYXRlTWFueVxuICovXG5leHBvcnQgdHlwZSBCYXRjaFBheWxvYWQgPSB7XG4gIGNvdW50OiBudW1iZXJcbn1cblxuZXhwb3J0IGNvbnN0IGRlZmluZUV4dGVuc2lvbiA9IHJ1bnRpbWUuRXh0ZW5zaW9ucy5kZWZpbmVFeHRlbnNpb24gYXMgdW5rbm93biBhcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRXh0ZW5kc0hvb2s8XCJkZWZpbmVcIiwgVHlwZU1hcENiLCBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3M+XG5leHBvcnQgdHlwZSBEZWZhdWx0UHJpc21hQ2xpZW50ID0gUHJpc21hQ2xpZW50XG5leHBvcnQgdHlwZSBFcnJvckZvcm1hdCA9ICdwcmV0dHknIHwgJ2NvbG9ybGVzcycgfCAnbWluaW1hbCdcbi8qKlxuICogT3B0aW9ucyBjb21tb24gdG8gYWxsIHZhcmlhbnRzIG9mIGBQcmlzbWFDbGllbnRPcHRpb25zYCwgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHlvdSBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBhIGRyaXZlciBhZGFwdGVyIG9yIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogQGRlZmF1bHQgXCJjb2xvcmxlc3NcIlxuICAgKi9cbiAgZXJyb3JGb3JtYXQ/OiBFcnJvckZvcm1hdFxuICAvKipcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIC8vIFNob3J0aGFuZCBmb3IgYGVtaXQ6ICdzdGRvdXQnYFxuICAgKiBsb2c6IFsncXVlcnknLCAnaW5mbycsICd3YXJuJywgJ2Vycm9yJ11cbiAgICogXG4gICAqIC8vIEVtaXQgYXMgZXZlbnRzIG9ubHlcbiAgICogbG9nOiBbXG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ3F1ZXJ5JyB9LFxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdpbmZvJyB9LFxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICd3YXJuJyB9XG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ2Vycm9yJyB9XG4gICAqIF1cbiAgICogXG4gICAqIC8gRW1pdCBhcyBldmVudHMgYW5kIGxvZyB0byBzdGRvdXRcbiAgICogb2c6IFtcbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAncXVlcnknIH0sXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ2luZm8nIH0sXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ3dhcm4nIH1cbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAnZXJyb3InIH1cbiAgICogXG4gICAqIGBgYFxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9sb2dnaW5nKS5cbiAgICovXG4gIGxvZz86IChMb2dMZXZlbCB8IExvZ0RlZmluaXRpb24pW11cbiAgLyoqXG4gICAqIFRoZSBkZWZhdWx0IHZhbHVlcyBmb3IgdHJhbnNhY3Rpb25PcHRpb25zXG4gICAqIG1heFdhaXQgPz0gMjAwMFxuICAgKiB0aW1lb3V0ID89IDUwMDBcbiAgICovXG4gIHRyYW5zYWN0aW9uT3B0aW9ucz86IHtcbiAgICBtYXhXYWl0PzogbnVtYmVyXG4gICAgdGltZW91dD86IG51bWJlclxuICAgIGlzb2xhdGlvbkxldmVsPzogVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbFxuICB9XG4gIC8qKlxuICAgKiBHbG9iYWwgY29uZmlndXJhdGlvbiBmb3Igb21pdHRpbmcgbW9kZWwgZmllbGRzIGJ5IGRlZmF1bHQuXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgb21pdDoge1xuICAgKiAgICAgdXNlcjoge1xuICAgKiAgICAgICBwYXNzd29yZDogdHJ1ZVxuICAgKiAgICAgfVxuICAgKiAgIH1cbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBvbWl0PzogR2xvYmFsT21pdENvbmZpZ1xuICAvKipcbiAgICogU1FMIGNvbW1lbnRlciBwbHVnaW5zIHRoYXQgYWRkIG1ldGFkYXRhIHRvIFNRTCBxdWVyaWVzIGFzIGNvbW1lbnRzLlxuICAgKiBDb21tZW50cyBmb2xsb3cgdGhlIHNxbGNvbW1lbnRlciBmb3JtYXQ6IGh0dHBzOi8vZ29vZ2xlLmdpdGh1Yi5pby9zcWxjb21tZW50ZXIvXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcixcbiAgICogICBjb21tZW50czogW1xuICAgKiAgICAgdHJhY2VDb250ZXh0KCksXG4gICAqICAgICBxdWVyeUluc2lnaHRzKCksXG4gICAqICAgXSxcbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBjb21tZW50cz86IHJ1bnRpbWUuU3FsQ29tbWVudGVyUGx1Z2luW11cbiAgLyoqXG4gICAqIE9wdGlvbmFsIG1heGltdW0gc2l6ZSBmb3IgdGhlIHF1ZXJ5IHBsYW4gY2FjaGUuIElmIG5vdCBwcm92aWRlZCwgYSBkZWZhdWx0IHNpemUgd2lsbCBiZSB1c2VkLlxuICAgKiBBIHZhbHVlIG9mIGAwYCBjYW4gYmUgdXNlZCB0byBkaXNhYmxlIHRoZSBjYWNoZSBlbnRpcmVseS4gQSBoaWdoZXIgY2FjaGUgc2l6ZSBjYW4gaW1wcm92ZVxuICAgKiBwZXJmb3JtYW5jZSBmb3IgYXBwbGljYXRpb25zIHRoYXQgZXhlY3V0ZSBhIGxhcmdlIG51bWJlciBvZiB1bmlxdWUgcXVlcmllcywgd2hpbGUgYSBzbWFsbGVyXG4gICAqIGNhY2hlIHNpemUgY2FuIHJlZHVjZSBtZW1vcnkgdXNhZ2UuXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcixcbiAgICogICBxdWVyeVBsYW5DYWNoZU1heFNpemU6IDEwMCxcbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBxdWVyeVBsYW5DYWNoZU1heFNpemU/OiBudW1iZXJcbn1cblxuLyoqXG4gKiBgUHJpc21hQ2xpZW50YCBvcHRpb25zIGZvciBjb25uZWN0aW5nIHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSBpbnN0ZWFkIG9mIGEgZHJpdmVyIGFkYXB0ZXIuXG4gKiBcbiAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2FjY2VsZXJhdGVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmwgZXh0ZW5kcyBQcmlzbWFDbGllbnRCYXNlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgUHJpc21hIEFjY2VsZXJhdGUgY29ubmVjdGlvbiBVUkwuIFVzZSB0aGlzIG9wdGlvbiB0byBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSBpbnN0ZWFkIG9mIHVzaW5nIGEgZHJpdmVyIGFkYXB0ZXIgdG8gY29ubmVjdCBkaXJlY3RseS5cbiAgICogXG4gICAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2FjY2VsZXJhdGVcbiAgICovXG4gIGFjY2VsZXJhdGVVcmw6IHN0cmluZ1xuICBhZGFwdGVyPzogbmV2ZXJcbn1cblxuLyoqXG4gKiBgUHJpc21hQ2xpZW50YCBvcHRpb25zIGZvciBjb25uZWN0aW5nIHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBhIGRyaXZlciBhZGFwdGVyLiBUaGlzIGlzIHRoZSBjb21tb24gY2FzZSBpbiBQcmlzbWEgNy5cbiAqIFxuICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyIGV4dGVuZHMgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogQSBkcml2ZXIgYWRhcHRlciB0aGF0IFByaXNtYUNsaWVudCB1c2VzIHRvIGNvbm5lY3QgdG8geW91ciBkYXRhYmFzZSwgc3VjaCBhcyB0aGUgb25lcyBwcm92aWRlZCBieSBgQHByaXNtYS9hZGFwdGVyLXBnYCwgYEBwcmlzbWEvYWRhcHRlci1saWJzcWxgLCBgQHByaXNtYS9hZGFwdGVyLXBsYW5ldHNjYWxlYCwgZXRjLlxuICAgKiBcbiAgICogQSBkcml2ZXIgYWRhcHRlciBpcyAqKnJlcXVpcmVkKiogdW5sZXNzIHlvdSBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSAoaW4gd2hpY2ggY2FzZSB1c2UgYGFjY2VsZXJhdGVVcmxgIGluc3RlYWQpLlxuICAgKiBcbiAgICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBQcmlzbWFQZyB9IGZyb20gJ0BwcmlzbWEvYWRhcHRlci1wZydcbiAgICogaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSAnLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudCdcbiAgICogXG4gICAqIGNvbnN0IGFkYXB0ZXIgPSBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7IGFkYXB0ZXIgfSlcbiAgICogYGBgXG4gICAqL1xuICBhZGFwdGVyOiBydW50aW1lLlNxbERyaXZlckFkYXB0ZXJGYWN0b3J5XG4gIGFjY2VsZXJhdGVVcmw/OiBuZXZlclxufVxuXG4vKipcbiAqIE9wdGlvbnMgcGFzc2VkIHRvIHRoZSBgUHJpc21hQ2xpZW50YCBjb25zdHJ1Y3Rvci5cbiAqIFxuICogQSBkcml2ZXIgYWRhcHRlciAob3IsIGFsdGVybmF0aXZlbHksIGEgUHJpc21hIEFjY2VsZXJhdGUgVVJMKSBpcyAqKnJlcXVpcmVkKiouIFNlZSB7QGxpbmsgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyfSBhbmQge0BsaW5rIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWNjZWxlcmF0ZVVybH0gZm9yIHRoZSB0d28gdmFyaWFudHMuIEFsbCBvdGhlciBwcm9wZXJ0aWVzIGxpdmUgaW4ge0BsaW5rIFByaXNtYUNsaWVudEJhc2VPcHRpb25zfSBhbmQgYXJlIG9wdGlvbmFsLlxuICogXG4gKiBMZWFybiBtb3JlIGFib3V0IGRyaXZlciBhZGFwdGVyczogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gKi9cbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudE9wdGlvbnMgPSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmwgfCBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFkYXB0ZXJcbmV4cG9ydCB0eXBlIEdsb2JhbE9taXRDb25maWcgPSB7XG4gIGJsb2dDb21tZW50PzogUHJpc21hLkJsb2dDb21tZW50T21pdFxuICBibG9nUG9zdD86IFByaXNtYS5CbG9nUG9zdE9taXRcbiAgYm9va2luZz86IFByaXNtYS5Cb29raW5nT21pdFxuICBjYXRlZ29yeT86IFByaXNtYS5DYXRlZ29yeU9taXRcbiAgY29udGFjdE1lc3NhZ2U/OiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VPbWl0XG4gIG5vdGlmaWNhdGlvbj86IFByaXNtYS5Ob3RpZmljYXRpb25PbWl0XG4gIHBheW1lbnQ/OiBQcmlzbWEuUGF5bWVudE9taXRcbiAgcmVmcmVzaFRva2VuPzogUHJpc21hLlJlZnJlc2hUb2tlbk9taXRcbiAgcmV2aWV3PzogUHJpc21hLlJldmlld09taXRcbiAgdG91clBhY2thZ2U/OiBQcmlzbWEuVG91clBhY2thZ2VPbWl0XG4gIHVzZXI/OiBQcmlzbWEuVXNlck9taXRcbiAgd2lzaGxpc3RJdGVtPzogUHJpc21hLldpc2hsaXN0SXRlbU9taXRcbn1cblxuLyogVHlwZXMgZm9yIExvZ2dpbmcgKi9cbmV4cG9ydCB0eXBlIExvZ0xldmVsID0gJ2luZm8nIHwgJ3F1ZXJ5JyB8ICd3YXJuJyB8ICdlcnJvcidcbmV4cG9ydCB0eXBlIExvZ0RlZmluaXRpb24gPSB7XG4gIGxldmVsOiBMb2dMZXZlbFxuICBlbWl0OiAnc3Rkb3V0JyB8ICdldmVudCdcbn1cblxuZXhwb3J0IHR5cGUgQ2hlY2tJc0xvZ0xldmVsPFQ+ID0gVCBleHRlbmRzIExvZ0xldmVsID8gVCA6IG5ldmVyO1xuXG5leHBvcnQgdHlwZSBHZXRMb2dUeXBlPFQ+ID0gQ2hlY2tJc0xvZ0xldmVsPFxuICBUIGV4dGVuZHMgTG9nRGVmaW5pdGlvbiA/IFRbJ2xldmVsJ10gOiBUXG4+O1xuXG5leHBvcnQgdHlwZSBHZXRFdmVudHM8VCBleHRlbmRzIGFueVtdPiA9IFQgZXh0ZW5kcyBBcnJheTxMb2dMZXZlbCB8IExvZ0RlZmluaXRpb24+XG4gID8gR2V0TG9nVHlwZTxUW251bWJlcl0+XG4gIDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5RXZlbnQgPSB7XG4gIHRpbWVzdGFtcDogRGF0ZVxuICBxdWVyeTogc3RyaW5nXG4gIHBhcmFtczogc3RyaW5nXG4gIGR1cmF0aW9uOiBudW1iZXJcbiAgdGFyZ2V0OiBzdHJpbmdcbn1cblxuZXhwb3J0IHR5cGUgTG9nRXZlbnQgPSB7XG4gIHRpbWVzdGFtcDogRGF0ZVxuICBtZXNzYWdlOiBzdHJpbmdcbiAgdGFyZ2V0OiBzdHJpbmdcbn1cbi8qIEVuZCBUeXBlcyBmb3IgTG9nZ2luZyAqL1xuXG5cbmV4cG9ydCB0eXBlIFByaXNtYUFjdGlvbiA9XG4gIHwgJ2ZpbmRVbmlxdWUnXG4gIHwgJ2ZpbmRVbmlxdWVPclRocm93J1xuICB8ICdmaW5kTWFueSdcbiAgfCAnZmluZEZpcnN0J1xuICB8ICdmaW5kRmlyc3RPclRocm93J1xuICB8ICdjcmVhdGUnXG4gIHwgJ2NyZWF0ZU1hbnknXG4gIHwgJ2NyZWF0ZU1hbnlBbmRSZXR1cm4nXG4gIHwgJ3VwZGF0ZSdcbiAgfCAndXBkYXRlTWFueSdcbiAgfCAndXBkYXRlTWFueUFuZFJldHVybidcbiAgfCAndXBzZXJ0J1xuICB8ICdkZWxldGUnXG4gIHwgJ2RlbGV0ZU1hbnknXG4gIHwgJ2V4ZWN1dGVSYXcnXG4gIHwgJ3F1ZXJ5UmF3J1xuICB8ICdhZ2dyZWdhdGUnXG4gIHwgJ2NvdW50J1xuICB8ICdydW5Db21tYW5kUmF3J1xuICB8ICdmaW5kUmF3J1xuICB8ICdncm91cEJ5J1xuXG4vKipcbiAqIGBQcmlzbWFDbGllbnRgIHByb3h5IGF2YWlsYWJsZSBpbiBpbnRlcmFjdGl2ZSB0cmFuc2FjdGlvbnMuXG4gKi9cbmV4cG9ydCB0eXBlIFRyYW5zYWN0aW9uQ2xpZW50ID0gT21pdDxEZWZhdWx0UHJpc21hQ2xpZW50LCBydW50aW1lLklUWENsaWVudERlbnlMaXN0PlxuXG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4qIFRoaXMgZmlsZSBleHBvcnRzIGFsbCBlbnVtIHJlbGF0ZWQgdHlwZXMgZnJvbSB0aGUgc2NoZW1hLlxuKlxuKiBcdUQ4M0RcdURGRTIgWW91IGNhbiBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5LlxuKi9cblxuZXhwb3J0IGNvbnN0IFJvbGUgPSB7XG4gIFVTRVI6ICdVU0VSJyxcbiAgQUdFTlQ6ICdBR0VOVCcsXG4gIEFETUlOOiAnQURNSU4nXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFJvbGUgPSAodHlwZW9mIFJvbGUpW2tleW9mIHR5cGVvZiBSb2xlXVxuXG5cbmV4cG9ydCBjb25zdCBVc2VyU3RhdHVzID0ge1xuICBBQ1RJVkU6ICdBQ1RJVkUnLFxuICBTVVNQRU5ERUQ6ICdTVVNQRU5ERUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFVzZXJTdGF0dXMgPSAodHlwZW9mIFVzZXJTdGF0dXMpW2tleW9mIHR5cGVvZiBVc2VyU3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBBdXRoUHJvdmlkZXIgPSB7XG4gIENSRURFTlRJQUw6ICdDUkVERU5USUFMJyxcbiAgR09PR0xFOiAnR09PR0xFJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBBdXRoUHJvdmlkZXIgPSAodHlwZW9mIEF1dGhQcm92aWRlcilba2V5b2YgdHlwZW9mIEF1dGhQcm92aWRlcl1cblxuXG5leHBvcnQgY29uc3QgUGFja2FnZVN0YXR1cyA9IHtcbiAgUEVORElORzogJ1BFTkRJTkcnLFxuICBBUFBST1ZFRDogJ0FQUFJPVkVEJyxcbiAgUkVKRUNURUQ6ICdSRUpFQ1RFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGFja2FnZVN0YXR1cyA9ICh0eXBlb2YgUGFja2FnZVN0YXR1cylba2V5b2YgdHlwZW9mIFBhY2thZ2VTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IEJvb2tpbmdTdGF0dXMgPSB7XG4gIFBFTkRJTkc6ICdQRU5ESU5HJyxcbiAgUEFJRDogJ1BBSUQnLFxuICBDT05GSVJNRUQ6ICdDT05GSVJNRUQnLFxuICBDQU5DRUxMRUQ6ICdDQU5DRUxMRUQnLFxuICBDT01QTEVURUQ6ICdDT01QTEVURUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJvb2tpbmdTdGF0dXMgPSAodHlwZW9mIEJvb2tpbmdTdGF0dXMpW2tleW9mIHR5cGVvZiBCb29raW5nU3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBQYXltZW50U3RhdHVzID0ge1xuICBJTklUSUFURUQ6ICdJTklUSUFURUQnLFxuICBTVUNDRVNTOiAnU1VDQ0VTUycsXG4gIEZBSUxFRDogJ0ZBSUxFRCcsXG4gIENBTkNFTExFRDogJ0NBTkNFTExFRCcsXG4gIFJFRlVOREVEOiAnUkVGVU5ERUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBheW1lbnRTdGF0dXMgPSAodHlwZW9mIFBheW1lbnRTdGF0dXMpW2tleW9mIHR5cGVvZiBQYXltZW50U3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBQb3N0U3RhdHVzID0ge1xuICBEUkFGVDogJ0RSQUZUJyxcbiAgUFVCTElTSEVEOiAnUFVCTElTSEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQb3N0U3RhdHVzID0gKHR5cGVvZiBQb3N0U3RhdHVzKVtrZXlvZiB0eXBlb2YgUG9zdFN0YXR1c11cblxuXG5leHBvcnQgY29uc3QgTm90aWZpY2F0aW9uVHlwZSA9IHtcbiAgQk9PS0lOR19DUkVBVEVEOiAnQk9PS0lOR19DUkVBVEVEJyxcbiAgQk9PS0lOR19DT05GSVJNRUQ6ICdCT09LSU5HX0NPTkZJUk1FRCcsXG4gIEJPT0tJTkdfQ0FOQ0VMTEVEOiAnQk9PS0lOR19DQU5DRUxMRUQnLFxuICBQQUNLQUdFX0FQUFJPVkVEOiAnUEFDS0FHRV9BUFBST1ZFRCcsXG4gIFBBQ0tBR0VfUkVKRUNURUQ6ICdQQUNLQUdFX1JFSkVDVEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBOb3RpZmljYXRpb25UeXBlID0gKHR5cGVvZiBOb3RpZmljYXRpb25UeXBlKVtrZXlvZiB0eXBlb2YgTm90aWZpY2F0aW9uVHlwZV1cbiIsICIvLyBBcHBFcnJvciBrZWVwcyB0aGUgZXhhY3Qgc2FtZSBcImp1c3QgdGhyb3cgaXRcIiBlcmdvbm9taWNzIGJ1dCBjYXJyaWVzXG4vLyBhIHN0YXR1c0NvZGUgdGhlIGdsb2JhbCBoYW5kbGVyIGNhbiByZWFkIChzZWUgbWlkZGxld2FyZS9nbG9iYWxFcnJvckhhbmRsZXIudHMpLlxuZXhwb3J0IGNsYXNzIEFwcEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBzdGF0dXNDb2RlOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3Ioc3RhdHVzQ29kZTogbnVtYmVyLCBtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSBcIkFwcEVycm9yXCI7XG4gICAgdGhpcy5zdGF0dXNDb2RlID0gc3RhdHVzQ29kZTtcbiAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IFByaXNtYVBnIH0gZnJvbSBcIkBwcmlzbWEvYWRhcHRlci1wZ1wiO1xuaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuY29uc3QgY29ubmVjdGlvblN0cmluZyA9IGNvbmZpZy5kYXRhYmFzZV91cmw7XG5cbi8vIFNlcnZlcmxlc3MtZnJpZW5kbHkgcG9vbDogb25lIGNvbm5lY3Rpb24gcGVyIHdhcm0gaW5zdGFuY2Ugc28gbWFueVxuLy8gY29uY3VycmVudCBpbnZvY2F0aW9ucyBjYW4ndCBleGhhdXN0IHRoZSBkYXRhYmFzZSdzIGNvbm5lY3Rpb24gbGltaXQuXG4vLyBMb2NhbC9WTSBydW5zIGFyZSB1bmFmZmVjdGVkIChhIHNpbmdsZSBwcm9jZXNzIHVzZXMgb25lIGNvbm5lY3Rpb24gYW55d2F5KS5cbmNvbnN0IGFkYXB0ZXIgPSBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nLCBtYXg6IDEgfSk7XG5jb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHsgYWRhcHRlciB9KTtcblxuZXhwb3J0IHsgcHJpc21hIH07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IGF1dGhDb250cm9sbGVyIH0gZnJvbSBcIi4vYXV0aC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBhdXRoVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9hdXRoLnZhbGlkYXRpb25cIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBSZWdpc3RlciBcdTIwMTQgcm9sZSBpcyBvcHRpb25hbCBhbmQgcmVzdHJpY3RlZCB0byBVU0VSL0FHRU5UIGluIHRoZSBzZXJ2aWNlXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVnaXN0ZXJcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLnJlZ2lzdGVyU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZWdpc3RlclVzZXIsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvbG9naW5cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmxvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5sb2dpblVzZXIsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZ29vZ2xlXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5nb29nbGVMb2dpblNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIuZ29vZ2xlTG9naW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZGVtby1sb2dpblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMuZGVtb0xvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5kZW1vTG9naW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVmcmVzaFwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVmcmVzaFRva2VuU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZWZyZXNoVG9rZW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcIi9sb2dvdXRcIiwgYXV0aCgpLCBhdXRoQ29udHJvbGxlci5sb2dvdXRVc2VyKTtcblxucm91dGVyLmdldChcIi9tZVwiLCBhdXRoKCksIGF1dGhDb250cm9sbGVyLmdldE1lKTtcblxuLy8gU3RlcCAyMSBcdTIwMTQgZW1haWwgdmVyaWZpY2F0aW9uICsgcGFzc3dvcmQgcmVzZXQgKGFsbCBwdWJsaWM7IHJhdGUtbGltaXRlZCB2aWFcbi8vIGF1dGhMaW1pdGVyIGluIGFwcC50cyB0byBib3VuZCBPVFAgYnJ1dGUgZm9yY2UgKyBlbWFpbCBib21iaW5nKVxucm91dGVyLnBvc3QoXG4gIFwiL3ZlcmlmeS1lbWFpbFwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMudmVyaWZ5RW1haWxTY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnZlcmlmeUVtYWlsLFxuKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL3Jlc2VuZC12ZXJpZmljYXRpb25cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLnJlc2VuZFZlcmlmaWNhdGlvblNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIucmVzZW5kVmVyaWZpY2F0aW9uLFxuKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL2ZvcmdvdC1wYXNzd29yZFwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMuZm9yZ290UGFzc3dvcmRTY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmZvcmdvdFBhc3N3b3JkLFxuKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL3Jlc2V0LXBhc3N3b3JkXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5yZXNldFBhc3N3b3JkU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZXNldFBhc3N3b3JkLFxuKTtcblxuZXhwb3J0IGNvbnN0IGF1dGhSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBhdXRoU2VydmljZSB9IGZyb20gXCIuL2F1dGguc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbmNvbnN0IGlzUHJvZHVjdGlvbiA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcInByb2R1Y3Rpb25cIjtcblxuLy8gRGV2IChsb2NhbGhvc3Q6MzAwMCBcdTIxOTIgOjQwMDApIGlzIHNhbWUtc2l0ZSBcdTIxOTIgbGF4IHdvcmtzIHdpdGggc2VjdXJlOmZhbHNlLlxuLy8gUHJvZCAoY3Jvc3Mtc2l0ZSBmcm9udGVuZC9iYWNrZW5kKSByZXF1aXJlcyBTYW1lU2l0ZT1Ob25lICsgU2VjdXJlLlxuY29uc3QgY29va2llT3B0aW9uczoge1xuICBodHRwT25seTogdHJ1ZTtcbiAgc2VjdXJlOiBib29sZWFuO1xuICBzYW1lU2l0ZTogXCJsYXhcIiB8IFwibm9uZVwiO1xufSA9IHtcbiAgaHR0cE9ubHk6IHRydWUsXG4gIHNlY3VyZTogaXNQcm9kdWN0aW9uLFxuICBzYW1lU2l0ZTogaXNQcm9kdWN0aW9uID8gXCJub25lXCIgOiBcImxheFwiLFxufTtcblxuY29uc3QgQUNDRVNTX0NPT0tJRV9NQVhfQUdFID0gMjQgKiA2MCAqIDYwICogMTAwMDsgLy8gMSBkYXlcbmNvbnN0IFJFRlJFU0hfQ09PS0lFX01BWF9BR0UgPSAzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDA7IC8vIDMwIGRheXNcblxuY29uc3Qgc2V0QXV0aENvb2tpZXMgPSAoXG4gIHJlczogUmVzcG9uc2UsXG4gIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9OiB7IGFjY2Vzc1Rva2VuOiBzdHJpbmc7IHJlZnJlc2hUb2tlbjogc3RyaW5nIH0sXG4pID0+IHtcbiAgcmVzLmNvb2tpZShcImFjY2Vzc1Rva2VuXCIsIGFjY2Vzc1Rva2VuLCB7XG4gICAgLi4uY29va2llT3B0aW9ucyxcbiAgICBtYXhBZ2U6IEFDQ0VTU19DT09LSUVfTUFYX0FHRSxcbiAgfSk7XG4gIHJlcy5jb29raWUoXCJyZWZyZXNoVG9rZW5cIiwgcmVmcmVzaFRva2VuLCB7XG4gICAgLi4uY29va2llT3B0aW9ucyxcbiAgICBtYXhBZ2U6IFJFRlJFU0hfQ09PS0lFX01BWF9BR0UsXG4gIH0pO1xufTtcblxuY29uc3QgY2xlYXJBdXRoQ29va2llcyA9IChyZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHJlcy5jbGVhckNvb2tpZShcImFjY2Vzc1Rva2VuXCIsIGNvb2tpZU9wdGlvbnMpO1xuICByZXMuY2xlYXJDb29raWUoXCJyZWZyZXNoVG9rZW5cIiwgY29va2llT3B0aW9ucyk7XG59O1xuXG4vLyBSZWdpc3RlciBjb250cm9sbGVyIFx1MjAxNCBzdGFnZXMgdGhlIGFjY291bnQgaW4gUmVkaXMgYW5kIGVtYWlscyBhbiBPVFA7IHRoZVxuLy8gdXNlciByb3cgaXMgY3JlYXRlZCBieSB2ZXJpZnktZW1haWwuXG5jb25zdCByZWdpc3RlclVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBhd2FpdCBhdXRoU2VydmljZS5yZWdpc3RlclVzZXIocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiVmVyaWZpY2F0aW9uIE9UUCBzZW50IHRvIHlvdXIgZW1haWwuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gTG9naW4gY29udHJvbGxlclxuY29uc3QgbG9naW5Vc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0gPSBhd2FpdCBhdXRoU2VydmljZS5sb2dpblVzZXIocmVxLmJvZHkpO1xuXG4gICAgc2V0QXV0aENvb2tpZXMocmVzLCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdvb2dsZSBsb2dpbiAoSUQtdG9rZW4gZmxvdylcbmNvbnN0IGdvb2dsZUxvZ2luID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0gPSBhd2FpdCBhdXRoU2VydmljZS5nb29nbGVMb2dpbihcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gRGVtbyBsb2dpbiBjb250cm9sbGVyXG5jb25zdCBkZW1vTG9naW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmRlbW9Mb2dpbihcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEZW1vIHVzZXIgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBWZXJpZnkgZW1haWwgY29udHJvbGxlciBcdTIwMTQgY3JlYXRlcyB0aGUgdXNlciBhbmQgYXV0by1sb2dzLWluICh0b2tlbnMgYXNcbi8vIGNvb2tpZXMgKyBib2R5KSwgbWlycm9yaW5nIHRoZSByZWZlcmVuY2UgYmFja2VuZC5cbmNvbnN0IHZlcmlmeUVtYWlsID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0gPSBhd2FpdCBhdXRoU2VydmljZS52ZXJpZnlFbWFpbChcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJFbWFpbCB2ZXJpZmllZCBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gUmVzZW5kIHZlcmlmaWNhdGlvbiBjb250cm9sbGVyIFx1MjAxNCBhbHdheXMgMjAwIChubyBlbnVtZXJhdGlvbikuXG5jb25zdCByZXNlbmRWZXJpZmljYXRpb24gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBhd2FpdCBhdXRoU2VydmljZS5yZXNlbmRWZXJpZmljYXRpb24ocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlZlcmlmaWNhdGlvbiBPVFAgc2VudCB0byB5b3VyIGVtYWlsLlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEZvcmdvdCBwYXNzd29yZCBjb250cm9sbGVyIFx1MjAxNCBhbHdheXMgMjAwIChubyBlbnVtZXJhdGlvbikuXG5jb25zdCBmb3Jnb3RQYXNzd29yZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLmZvcmdvdFBhc3N3b3JkKHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTpcbiAgICAgICAgXCJJZiBhbiBhY2NvdW50IHdpdGggdGhhdCBlbWFpbCBleGlzdHMsIGEgcGFzc3dvcmQgcmVzZXQgT1RQIGhhcyBiZWVuIHNlbnQuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gUmVzZXQgcGFzc3dvcmQgY29udHJvbGxlclxuY29uc3QgcmVzZXRQYXNzd29yZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLnJlc2V0UGFzc3dvcmQocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhc3N3b3JkIHJlc2V0IHN1Y2Nlc3NmdWxseS4gUGxlYXNlIGxvZ2luIGFnYWluLlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFJlZnJlc2ggdG9rZW4gY29udHJvbGxlclxuY29uc3QgcmVmcmVzaFRva2VuID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVmcmVzaFRva2VuRnJvbUNvb2tpZSA9IHJlcS5jb29raWVzLnJlZnJlc2hUb2tlbjtcbiAgICBjb25zdCByZWZyZXNoVG9rZW5Gcm9tQm9keSA9IHJlcS5ib2R5Py5yZWZyZXNoVG9rZW47XG5cbiAgICBpZiAoIXJlZnJlc2hUb2tlbkZyb21Db29raWUgJiYgIXJlZnJlc2hUb2tlbkZyb21Cb2R5KSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5VTkFVVEhPUklaRUQsXG4gICAgICAgIG1lc3NhZ2U6IFwiUmVmcmVzaCB0b2tlbiBpcyByZXF1aXJlZFwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4gfSA9XG4gICAgICBhd2FpdCBhdXRoU2VydmljZS5yZWZyZXNoVG9rZW4oe1xuICAgICAgICByZWZyZXNoVG9rZW46IHJlZnJlc2hUb2tlbkZyb21Db29raWUgfHwgcmVmcmVzaFRva2VuRnJvbUJvZHksXG4gICAgICB9KTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywge1xuICAgICAgYWNjZXNzVG9rZW4sXG4gICAgICByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbixcbiAgICB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJUb2tlbiByZWZyZXNoZWQgc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbiB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gTG9nb3V0IGNvbnRyb2xsZXJcbmNvbnN0IGxvZ291dFVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgYXdhaXQgYXV0aFNlcnZpY2UubG9nb3V0KHVzZXJJZCk7XG4gICAgY2xlYXJBdXRoQ29va2llcyhyZXMpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgbG9nZ2VkIG91dCBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgTWUgY29udHJvbGxlclxuY29uc3QgZ2V0TWUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IGF1dGhTZXJ2aWNlLmdldE1lRnJvbURCKHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYXV0aENvbnRyb2xsZXIgPSB7XG4gIHJlZ2lzdGVyVXNlcixcbiAgdmVyaWZ5RW1haWwsXG4gIHJlc2VuZFZlcmlmaWNhdGlvbixcbiAgZm9yZ290UGFzc3dvcmQsXG4gIHJlc2V0UGFzc3dvcmQsXG4gIGxvZ2luVXNlcixcbiAgZ29vZ2xlTG9naW4sXG4gIGRlbW9Mb2dpbixcbiAgcmVmcmVzaFRva2VuLFxuICBsb2dvdXRVc2VyLFxuICBnZXRNZSxcbn07IiwgImltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5pbXBvcnQgY3J5cHRvIGZyb20gXCJjcnlwdG9cIjtcbmltcG9ydCB7IGRlY29kZSwgSnd0UGF5bG9hZCwgU2lnbk9wdGlvbnMgfSBmcm9tIFwianNvbndlYnRva2VuXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBnb29nbGVDbGllbnQgfSBmcm9tIFwiLi4vLi4vbGliL2dvb2dsZUF1dGhcIjtcbmltcG9ydCB7IGdldFJlZGlzIH0gZnJvbSBcIi4uLy4uL2xpYi9yZWRpc1wiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IGp3dFV0aWxzIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2p3dFwiO1xuaW1wb3J0IHtcbiAgc2VuZEZvcmdvdFBhc3N3b3JkT3RwRW1haWwsXG4gIHNlbmRQYXNzd29yZFJlc2V0U3VjY2Vzc0VtYWlsLFxuICBzZW5kVmVyaWZpY2F0aW9uT3RwRW1haWwsXG4gIHNlbmRXZWxjb21lRW1haWwsXG59IGZyb20gXCIuLi8uLi91dGlscy9hdXRoRW1haWxcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQge1xuICBJQXV0aCxcbiAgSURlbW9Mb2dpblBheWxvYWQsXG4gIElGb3Jnb3RQYXNzd29yZFBheWxvYWQsXG4gIElHb29nbGVMb2dpblBheWxvYWQsXG4gIElMb2dpblVzZXIsXG4gIElSZWZyZXNoVG9rZW5QYXlsb2FkLFxuICBJUmVzZW5kVmVyaWZpY2F0aW9uUGF5bG9hZCxcbiAgSVJlc2V0UGFzc3dvcmRQYXlsb2FkLFxuICBJVmVyaWZ5RW1haWxQYXlsb2FkLFxufSBmcm9tIFwiLi9hdXRoLmludGVyZmFjZVwiO1xuXG5jb25zdCBPVFBfRVhQSVJBVElPTl9TRUNPTkRTID0gNSAqIDYwOyAvLyA1IG1pbnV0ZXMgXHUyMDE0IG1hdGNoZXMgdGhlIHJlZmVyZW5jZSBiYWNrZW5kXG5cbi8vIFNIQS0yNTYgb2YgYSByZWZyZXNoIEpXVCBcdTIwMTQgdGhlIHJvdGF0aW9uIGxlZGdlciBzdG9yZXMgb25seSB0aGlzIGhhc2gsIG5ldmVyXG4vLyB0aGUgdG9rZW4gaXRzZWxmLCBzbyBhIERCIGxlYWsgY2FuJ3QgbWludCB1c2FibGUgcmVmcmVzaCB0b2tlbnMuXG5jb25zdCBzaGEyNTYgPSAodmFsdWU6IHN0cmluZykgPT5cbiAgY3J5cHRvLmNyZWF0ZUhhc2goXCJzaGEyNTZcIikudXBkYXRlKHZhbHVlKS5kaWdlc3QoXCJoZXhcIik7XG5cbi8vIFJlZnJlc2gtdG9rZW4gZXhwaXJ5IHJlYWQgZnJvbSB0aGUgc2lnbmVkIHRva2VuJ3MgYGV4cGAgc28gdGhlIGxlZGdlciByb3dcbi8vIGFsd2F5cyBtYXRjaGVzIEpXVF9SRUZSRVNIX0VYUElSRVNfSU4gZXhhY3RseS5cbmNvbnN0IHJlZnJlc2hUb2tlbkV4cGlyZXNBdCA9ICh0b2tlbjogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHBheWxvYWQgPSBkZWNvZGUodG9rZW4pIGFzIEp3dFBheWxvYWQgfCBudWxsO1xuICByZXR1cm4gcGF5bG9hZD8uZXhwID8gbmV3IERhdGUocGF5bG9hZC5leHAgKiAxMDAwKSA6IG5ldyBEYXRlKCk7XG59O1xuXG4vLyBSZWRpcyBPVFAgc3RvcmUgYWNjZXNzb3IgXHUyMDE0IDUwMyB3aGVuIHVuY29uZmlndXJlZCAobmV2ZXIgYSBib290LXRpbWUgY3Jhc2gpLlxuY29uc3QgZ2V0UmVkaXNDbGllbnQgPSBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IGdldFJlZGlzKCk7XG4gIGlmICghY2xpZW50KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMywgXCJFbWFpbCB2ZXJpZmljYXRpb24gaXMgbm90IGNvbmZpZ3VyZWQuXCIpO1xuICB9XG4gIHJldHVybiBjbGllbnQ7XG59O1xuXG5jb25zdCBidWlsZFRva2VuUGF5bG9hZCA9ICh1c2VyOiB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgcm9sZTogUm9sZTtcbiAgdG9rZW5WZXJzaW9uOiBudW1iZXI7XG59KSA9PiAoe1xuICBpZDogdXNlci5pZCxcbiAgbmFtZTogdXNlci5uYW1lLFxuICBlbWFpbDogdXNlci5lbWFpbCxcbiAgcm9sZTogdXNlci5yb2xlLFxuICB0b2tlblZlcnNpb246IHVzZXIudG9rZW5WZXJzaW9uLFxufSk7XG5cbmNvbnN0IGlzc3VlVG9rZW5zID0gYXN5bmMgKFxuICB1c2VyOiB7XG4gICAgaWQ6IHN0cmluZztcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgZW1haWw6IHN0cmluZztcbiAgICByb2xlOiBSb2xlO1xuICAgIHRva2VuVmVyc2lvbjogbnVtYmVyO1xuICB9LFxuICBjbGllbnQ6IFByaXNtYS5UcmFuc2FjdGlvbkNsaWVudCB8IHR5cGVvZiBwcmlzbWEgPSBwcmlzbWEsXG4pID0+IHtcbiAgY29uc3QgdG9rZW5QYXlsb2FkID0gYnVpbGRUb2tlblBheWxvYWQodXNlcik7XG5cbiAgY29uc3QgYWNjZXNzVG9rZW4gPSBqd3RVdGlscy5jcmVhdGVUb2tlbihcbiAgICB0b2tlblBheWxvYWQsXG4gICAgY29uZmlnLmp3dF9hY2Nlc3Nfc2VjcmV0LFxuICAgIHsgZXhwaXJlc0luOiBjb25maWcuand0X2FjY2Vzc19leHBpcmVzX2luIH0gYXMgU2lnbk9wdGlvbnMsXG4gICk7XG4gIGNvbnN0IHJlZnJlc2hUb2tlbiA9IGp3dFV0aWxzLmNyZWF0ZVRva2VuKFxuICAgIHRva2VuUGF5bG9hZCxcbiAgICBjb25maWcuand0X3JlZnJlc2hfc2VjcmV0LFxuICAgIHsgZXhwaXJlc0luOiBjb25maWcuand0X3JlZnJlc2hfZXhwaXJlc19pbiB9IGFzIFNpZ25PcHRpb25zLFxuICApO1xuXG4gIC8vIFJvdGF0aW9uIGxlZGdlciBcdTIwMTQgcGVyc2lzdCBhIHJvdyBrZXllZCBieSB0aGUgcmVmcmVzaCB0b2tlbidzIGhhc2guIFRoZVxuICAvLyBKV1QgaXRzZWxmIHN0YXlzIGluIHRoZSByZXNwb25zZSBleGFjdGx5IGFzIGJlZm9yZS5cbiAgYXdhaXQgY2xpZW50LnJlZnJlc2hUb2tlbi5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIHVzZXJJZDogdXNlci5pZCxcbiAgICAgIGhhc2g6IHNoYTI1NihyZWZyZXNoVG9rZW4pLFxuICAgICAgZXhwaXJlc0F0OiByZWZyZXNoVG9rZW5FeHBpcmVzQXQocmVmcmVzaFRva2VuKSxcbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4geyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH07XG59O1xuXG5jb25zdCBzYW5pdGl6ZVVzZXIgPSA8VCBleHRlbmRzIHsgcGFzc3dvcmQ6IHN0cmluZyB8IG51bGwgfT4odXNlcjogVCkgPT4ge1xuICBjb25zdCB7IHBhc3N3b3JkLCAuLi5yZXN0IH0gPSB1c2VyO1xuICByZXR1cm4gcmVzdDtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZWdpc3RlciAoc3RhZ2VkIGluIFJlZGlzLCB2ZXJpZmllZCB2aWEgT1RQKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIEZvbGxvd3MgdGhlIHJlZmVyZW5jZSBiYWNrZW5kOiBhIGNyZWRlbnRpYWwgc2lnbnVwIGRvZXMgTk9UIGNyZWF0ZSBhIERCIHJvdy5cbi8vIEl0IGhhc2hlcyB0aGUgcGFzc3dvcmQsIHN0YWdlcyB0aGUgcGF5bG9hZCBpbiBSZWRpcywgZW1haWxzIGEgNi1kaWdpdCBPVFAsXG4vLyBhbmQgdGhlIHVzZXIgcm93IGlzIG9ubHkgY3JlYXRlZCBvbiBzdWNjZXNzZnVsIHZlcmlmaWNhdGlvbi5cbmNvbnN0IHJlZ2lzdGVyVXNlciA9IGFzeW5jIChwYXlsb2FkOiBJQXV0aCkgPT4ge1xuICBjb25zdCB7IG5hbWUsIHBhc3N3b3JkLCBwaG9uZSwgcm9sZSB9ID0gcGF5bG9hZDtcbiAgY29uc3QgZW1haWwgPSBwYXlsb2FkLmVtYWlsLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG4gIC8vIE9ubHkgdXNlcnMvYWdlbnRzIGNhbiBzZWxmLXJlZ2lzdGVyOyBhZG1pbnMgYXJlIGNyZWF0ZWQgdmlhIGRlbW8tbG9naW4vc2VlZFxuICBpZiAocm9sZSAmJiByb2xlICE9PSBcIlVTRVJcIiAmJiByb2xlICE9PSBcIkFHRU5UXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIlJvbGUgbXVzdCBiZSBlaXRoZXIgVVNFUiBvciBBR0VOVFwiKTtcbiAgfVxuXG4gIGNvbnN0IGV4aXN0aW5nVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGVtYWlsIH0sXG4gIH0pO1xuICBpZiAoZXhpc3RpbmdVc2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJVc2VyIHdpdGggdGhpcyBlbWFpbCBhbHJlYWR5IGV4aXN0c1wiKTtcbiAgfVxuXG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IGdldFJlZGlzQ2xpZW50KCk7XG5cbiAgLy8gQSByZWdpc3RyYXRpb24gaXMgYWxyZWFkeSBzdGFnZWQgZm9yIHRoaXMgZW1haWwgXHUyMDE0IDQwOSBpbnN0ZWFkIG9mIHNpbGVudGx5XG4gIC8vIG92ZXJ3cml0aW5nIHRoZSBwZW5kaW5nIE9UUC9kYXRhIChhbiBhdHRhY2tlciBtdXN0IG5vdCBiZSBhYmxlIHRvIGtpbGwgYVxuICAvLyB2aWN0aW0ncyBpbi1mbGlnaHQgcmVnaXN0cmF0aW9uKS4gVGhlIHBlbmRpbmcgZmxvdyBjb250aW51ZXMgdmlhXG4gIC8vIHJlc2VuZC12ZXJpZmljYXRpb24uXG4gIGNvbnN0IHJlZ2lzdHJhdGlvbkRhdGFLZXkgPSBgdHJpcHZlcnNlOnJlZ2lzdGVyLWRhdGE6JHtlbWFpbH1gO1xuICBjb25zdCBwZW5kaW5nUmVnaXN0cmF0aW9uID0gYXdhaXQgY2xpZW50LmdldChyZWdpc3RyYXRpb25EYXRhS2V5KTtcbiAgaWYgKHBlbmRpbmdSZWdpc3RyYXRpb24pIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBcIlJlZ2lzdHJhdGlvbiBpcyBwZW5kaW5nIHZlcmlmaWNhdGlvbi4gQ2hlY2sgeW91ciBlbWFpbCBvciByZXNlbmQgdGhlIE9UUC5cIixcbiAgICApO1xuICB9XG5cbiAgY29uc3QgaGFzaGVkUGFzc3dvcmQgPSBhd2FpdCBiY3J5cHQuaGFzaChcbiAgICBwYXNzd29yZCxcbiAgICBOdW1iZXIoY29uZmlnLmJjcnlwdF9zYWx0X3JvdW5kcyksXG4gICk7XG5cbiAgLy8gUmVnaXN0cmF0aW9uIE9UUCAodGhlIHZhbHVlIHRoZSB1c2VyIHR5cGVzIGJhY2sgaW50byB0aGUgQVBJKVxuICBjb25zdCBvdHBLZXkgPSBgdHJpcHZlcnNlOnJlZ2lzdGVyLW90cDoke2VtYWlsfWA7XG4gIGNvbnN0IG90cFZhbHVlID0gY3J5cHRvLnJhbmRvbUludCgxMDAwMDAsIDEwMDAwMDApLnRvU3RyaW5nKCk7XG5cbiAgYXdhaXQgY2xpZW50LnNldChvdHBLZXksIG90cFZhbHVlLCB7XG4gICAgZXhwaXJhdGlvbjoge1xuICAgICAgdHlwZTogXCJFWFwiLFxuICAgICAgdmFsdWU6IE9UUF9FWFBJUkFUSU9OX1NFQ09ORFMsXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gU3RhZ2VkIHJlZ2lzdHJhdGlvbiBwYXlsb2FkIFx1MjAxNCBwYXNzd29yZCBpcyBhbHJlYWR5IGhhc2hlZCBoZXJlLCBleGFjdGx5XG4gIC8vIGxpa2UgdGhlIHJlZmVyZW5jZSwgc28gYSBSZWRpcyBsZWFrIG5ldmVyIGV4cG9zZXMgYSBwbGFpbnRleHQgcGFzc3dvcmQuXG4gIGNvbnN0IHJlZGlzVXNlckRhdGFQYXlsb2FkID0ge1xuICAgIG5hbWUsXG4gICAgZW1haWwsXG4gICAgcGFzc3dvcmQ6IGhhc2hlZFBhc3N3b3JkLFxuICAgIHBob25lLFxuICAgIHJvbGU6IHJvbGUgfHwgXCJVU0VSXCIsXG4gIH07XG5cbiAgYXdhaXQgY2xpZW50LnNldChyZWdpc3RyYXRpb25EYXRhS2V5LCBKU09OLnN0cmluZ2lmeShyZWRpc1VzZXJEYXRhUGF5bG9hZCksIHtcbiAgICBleHBpcmF0aW9uOiB7XG4gICAgICB0eXBlOiBcIkVYXCIsXG4gICAgICB2YWx1ZTogT1RQX0VYUElSQVRJT05fU0VDT05EUyxcbiAgICB9LFxuICB9KTtcblxuICAvLyBCZXN0LWVmZm9ydCBlbWFpbCBcdTIwMTQgYSBzZW5kIGZhaWx1cmUgbmV2ZXIgZmFpbHMgcmVnaXN0cmF0aW9uIChUcmlwVmVyc2VcbiAgLy8gY29udmVudGlvbik7IHRoZSB1c2VyIGNhbiByZWNvdmVyIHZpYSByZXNlbmQtdmVyaWZpY2F0aW9uLlxuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZFZlcmlmaWNhdGlvbk90cEVtYWlsKHsgZW1haWwsIG5hbWUsIG90cDogb3RwVmFsdWUgfSksXG4gIF0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFZlcmlmeSBlbWFpbCAoY3JlYXRlcyB0aGUgdXNlciArIGF1dG8tbG9naW4pIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gRm9sbG93cyB0aGUgcmVmZXJlbmNlIGJhY2tlbmQ6IE9UUCBpcyByZWFkIGZyb20gUmVkaXMsIGRlbGV0ZWQsIHRoZW4gdGhlXG4vLyBzdGFnZWQgcGF5bG9hZCBpcyBtYXRlcmlhbGlzZWQgYXMgYSByZWFsIHVzZXIgcm93IHdpdGggZW1haWxWZXJpZmllZDogdHJ1ZSxcbi8vIGFuZCB0b2tlbnMgYXJlIGlzc3VlZCBzbyB0aGUgdXNlciBpcyBsb2dnZWQgaW4gaW1tZWRpYXRlbHkuXG5jb25zdCB2ZXJpZnlFbWFpbCA9IGFzeW5jIChwYXlsb2FkOiBJVmVyaWZ5RW1haWxQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgb3RwIH0gPSBwYXlsb2FkO1xuICBjb25zdCBlbWFpbCA9IHBheWxvYWQuZW1haWwudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgLy8gRGVmZW5zaXZlIFx1MjAxNCByZWdpc3RyYXRpb24gYWxyZWFkeSA0MDlzIG9uIGFuIGV4aXN0aW5nIGVtYWlsLCBzbyBhIHVzZXIgcm93XG4gIC8vIGhlcmUgbWVhbnMgdGhlIGVtYWlsIHdhcyB2ZXJpZmllZCBlYXJsaWVyIHRocm91Z2ggYW5vdGhlciBmbG93LlxuICBjb25zdCBpc1VzZXJFeGlzdHMgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgZW1haWwgfSB9KTtcbiAgaWYgKGlzVXNlckV4aXN0cykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiRW1haWwgaXMgYWxyZWFkeSB2ZXJpZmllZFwiKTtcbiAgfVxuXG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IGdldFJlZGlzQ2xpZW50KCk7XG5cbiAgY29uc3Qgb3RwS2V5ID0gYHRyaXB2ZXJzZTpyZWdpc3Rlci1vdHA6JHtlbWFpbH1gO1xuICBjb25zdCByZWRpc09UUCA9IGF3YWl0IGNsaWVudC5nZXQob3RwS2V5KTtcblxuICBpZiAoIXJlZGlzT1RQIHx8IHJlZGlzT1RQICE9PSBvdHApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgb3IgZXhwaXJlZCBPVFAuXCIpO1xuICB9XG5cbiAgLy8gT1RQIGlzIHNpbmdsZS11c2UgXHUyMDE0IGRlbGV0ZSBpdCBiZWZvcmUgdGhlIHVzZXIgcm93IGlzIGNyZWF0ZWQuXG4gIGF3YWl0IGNsaWVudC5kZWwob3RwS2V5KTtcblxuICBjb25zdCByZWdpc3RyYXRpb25EYXRhS2V5ID0gYHRyaXB2ZXJzZTpyZWdpc3Rlci1kYXRhOiR7ZW1haWx9YDtcbiAgY29uc3QgcmVkaXNVc2VyRGF0YSA9IGF3YWl0IGNsaWVudC5nZXQocmVnaXN0cmF0aW9uRGF0YUtleSk7XG5cbiAgaWYgKCFyZWRpc1VzZXJEYXRhKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIG9yIGV4cGlyZWQgT1RQLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHVzZXJQYXlsb2FkID0gSlNPTi5wYXJzZShyZWRpc1VzZXJEYXRhKSBhcyBJQXV0aDtcblxuICBjb25zdCBjcmVhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgbmFtZTogdXNlclBheWxvYWQubmFtZSxcbiAgICAgIGVtYWlsOiB1c2VyUGF5bG9hZC5lbWFpbCxcbiAgICAgIHBhc3N3b3JkOiB1c2VyUGF5bG9hZC5wYXNzd29yZCxcbiAgICAgIHBob25lOiB1c2VyUGF5bG9hZC5waG9uZSxcbiAgICAgIHJvbGU6IHVzZXJQYXlsb2FkLnJvbGUgfHwgXCJVU0VSXCIsXG4gICAgICBhdXRoUHJvdmlkZXI6IFwiQ1JFREVOVElBTFwiLFxuICAgICAgc3RhdHVzOiBcIkFDVElWRVwiLFxuICAgICAgZW1haWxWZXJpZmllZDogdHJ1ZSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgLy8gU3RhZ2VkIHBheWxvYWQgY29uc3VtZWQgXHUyMDE0IG5vdGhpbmcgcmVtYWlucyBpbiBSZWRpcy5cbiAgYXdhaXQgY2xpZW50LmRlbChyZWdpc3RyYXRpb25EYXRhS2V5KTtcblxuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZFdlbGNvbWVFbWFpbCh7IGVtYWlsOiBjcmVhdGVkVXNlci5lbWFpbCwgbmFtZTogY3JlYXRlZFVzZXIubmFtZSB9KSxcbiAgXSk7XG5cbiAgY29uc3QgdG9rZW5zID0gYXdhaXQgaXNzdWVUb2tlbnMoY3JlYXRlZFVzZXIpO1xuXG4gIHJldHVybiB7IC4uLnRva2VucywgdXNlcjogY3JlYXRlZFVzZXIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZXNlbmQgdmVyaWZpY2F0aW9uIE9UUCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFJlLW1pbnRzIGEgZnJlc2ggT1RQIGZvciBhIHN0aWxsLXN0YWdlZCByZWdpc3RyYXRpb24uIFVuaWZvcm0gMjAwIFx1MjAxNCBpZiB0aGVcbi8vIHN0YWdpbmcgZGF0YSBpcyBnb25lIChuZXZlciByZWdpc3RlcmVkIC8gYWxyZWFkeSB2ZXJpZmllZCkgdGhpcyBuby1vcHMuXG5jb25zdCByZXNlbmRWZXJpZmljYXRpb24gPSBhc3luYyAocGF5bG9hZDogSVJlc2VuZFZlcmlmaWNhdGlvblBheWxvYWQpID0+IHtcbiAgY29uc3QgZW1haWwgPSBwYXlsb2FkLmVtYWlsLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IGdldFJlZGlzQ2xpZW50KCk7XG5cbiAgY29uc3QgcmVnaXN0cmF0aW9uRGF0YUtleSA9IGB0cmlwdmVyc2U6cmVnaXN0ZXItZGF0YToke2VtYWlsfWA7XG4gIGNvbnN0IHJlZGlzVXNlckRhdGEgPSBhd2FpdCBjbGllbnQuZ2V0KHJlZ2lzdHJhdGlvbkRhdGFLZXkpO1xuXG4gIGlmICghcmVkaXNVc2VyRGF0YSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHVzZXJQYXlsb2FkID0gSlNPTi5wYXJzZShyZWRpc1VzZXJEYXRhKSBhcyBJQXV0aDtcblxuICBjb25zdCBvdHBLZXkgPSBgdHJpcHZlcnNlOnJlZ2lzdGVyLW90cDoke2VtYWlsfWA7XG4gIGNvbnN0IG90cFZhbHVlID0gY3J5cHRvLnJhbmRvbUludCgxMDAwMDAsIDEwMDAwMDApLnRvU3RyaW5nKCk7XG5cbiAgYXdhaXQgY2xpZW50LnNldChvdHBLZXksIG90cFZhbHVlLCB7XG4gICAgZXhwaXJhdGlvbjoge1xuICAgICAgdHlwZTogXCJFWFwiLFxuICAgICAgdmFsdWU6IE9UUF9FWFBJUkFUSU9OX1NFQ09ORFMsXG4gICAgfSxcbiAgfSk7XG5cbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRWZXJpZmljYXRpb25PdHBFbWFpbCh7IGVtYWlsLCBuYW1lOiB1c2VyUGF5bG9hZC5uYW1lLCBvdHA6IG90cFZhbHVlIH0pLFxuICBdKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBGb3Jnb3QgcGFzc3dvcmQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBFbWFpbHMgYSByZXNldCBPVFAgdG8gdmVyaWZpZWQgQ1JFREVOVElBTCBhY2NvdW50cy4gRGVsaWJlcmF0ZWx5IHJldHVybnMgYVxuLy8gdW5pZm9ybSAyMDAgd2hldGhlciBvciBub3QgdGhlIGVtYWlsIGV4aXN0cyAvIGlzIGVsaWdpYmxlIChubyBlbnVtZXJhdGlvbiBcdTIwMTRcbi8vIHRoZSByZWZlcmVuY2UgdGhyb3dzIFwiVXNlciBub3QgZm91bmRcIiwgYnV0IFRyaXBWZXJzZSBuZXZlciBsZWFrcyBleGlzdGVuY2UpLlxuY29uc3QgZm9yZ290UGFzc3dvcmQgPSBhc3luYyAocGF5bG9hZDogSUZvcmdvdFBhc3N3b3JkUGF5bG9hZCkgPT4ge1xuICBjb25zdCBlbWFpbCA9IHBheWxvYWQuZW1haWwudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgY29uc3QgaXNVc2VyRXhpc3RzID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG5cbiAgaWYgKFxuICAgICFpc1VzZXJFeGlzdHMgfHxcbiAgICBpc1VzZXJFeGlzdHMuaXNEZWxldGVkIHx8XG4gICAgaXNVc2VyRXhpc3RzLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIiB8fFxuICAgICFpc1VzZXJFeGlzdHMuZW1haWxWZXJpZmllZCB8fFxuICAgIGlzVXNlckV4aXN0cy5hdXRoUHJvdmlkZXIgPT09IFwiR09PR0xFXCJcbiAgKSB7XG4gICAgLy8gR29vZ2xlLW9ubHkgYWNjb3VudHMgcmVzZXQgdmlhIEdvb2dsZTsgZXZlcnlvbmUgZWxzZSBzaWxlbnRseSBuby1vcHMuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0UmVkaXNDbGllbnQoKTtcblxuICBjb25zdCBvdHAgPSBjcnlwdG8ucmFuZG9tSW50KDEwMDAwMCwgMTAwMDAwMCkudG9TdHJpbmcoKTtcbiAgY29uc3Qga2V5ID0gYHRyaXB2ZXJzZTpmb3Jnb3QtcGFzc3dvcmQtb3RwOiR7aXNVc2VyRXhpc3RzLmVtYWlsfWA7XG5cbiAgYXdhaXQgY2xpZW50LnNldChrZXksIG90cCwge1xuICAgIGV4cGlyYXRpb246IHtcbiAgICAgIHR5cGU6IFwiRVhcIixcbiAgICAgIHZhbHVlOiBPVFBfRVhQSVJBVElPTl9TRUNPTkRTLFxuICAgIH0sXG4gIH0pO1xuXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kRm9yZ290UGFzc3dvcmRPdHBFbWFpbCh7XG4gICAgICBlbWFpbDogaXNVc2VyRXhpc3RzLmVtYWlsLFxuICAgICAgbmFtZTogaXNVc2VyRXhpc3RzLm5hbWUsXG4gICAgICBvdHAsXG4gICAgfSksXG4gIF0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlc2V0IHBhc3N3b3JkIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gVmFsaWRhdGVzIHRoZSBPVFAgYWdhaW5zdCBSZWRpcywgdGhlbiByZXBsYWNlcyB0aGUgaGFzaCBhbmQgYnVtcHNcbi8vIHRva2VuVmVyc2lvbiBzbyBldmVyeSBleGlzdGluZyBzZXNzaW9uIGRpZXMgKFRyaXBWZXJzZSBsb2dvdXQgc2VtYW50aWNzKS5cbmNvbnN0IHJlc2V0UGFzc3dvcmQgPSBhc3luYyAocGF5bG9hZDogSVJlc2V0UGFzc3dvcmRQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgbmV3UGFzc3dvcmQsIG90cCB9ID0gcGF5bG9hZDtcbiAgY29uc3QgZW1haWwgPSBwYXlsb2FkLmVtYWlsLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG4gIGNvbnN0IGlzVXNlckV4aXN0cyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBlbWFpbCB9IH0pO1xuXG4gIGlmIChcbiAgICAhaXNVc2VyRXhpc3RzIHx8XG4gICAgaXNVc2VyRXhpc3RzLmlzRGVsZXRlZCB8fFxuICAgIGlzVXNlckV4aXN0cy5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIgfHxcbiAgICBpc1VzZXJFeGlzdHMuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiXG4gICkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBvciBleHBpcmVkIE9UUC5cIik7XG4gIH1cblxuICBjb25zdCBjbGllbnQgPSBhd2FpdCBnZXRSZWRpc0NsaWVudCgpO1xuXG4gIGNvbnN0IGtleSA9IGB0cmlwdmVyc2U6Zm9yZ290LXBhc3N3b3JkLW90cDoke2lzVXNlckV4aXN0cy5lbWFpbH1gO1xuICBjb25zdCByZWRpc09UUCA9IGF3YWl0IGNsaWVudC5nZXQoa2V5KTtcblxuICBpZiAoIXJlZGlzT1RQIHx8IHJlZGlzT1RQICE9PSBvdHApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgb3IgZXhwaXJlZCBPVFAuXCIpO1xuICB9XG5cbiAgY29uc3QgaGFzaGVkTmV3UGFzc3dvcmQgPSBhd2FpdCBiY3J5cHQuaGFzaChcbiAgICBuZXdQYXNzd29yZCxcbiAgICBOdW1iZXIoY29uZmlnLmJjcnlwdF9zYWx0X3JvdW5kcyksXG4gICk7XG5cbiAgYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBlbWFpbDogaXNVc2VyRXhpc3RzLmVtYWlsIH0sXG4gICAgZGF0YToge1xuICAgICAgcGFzc3dvcmQ6IGhhc2hlZE5ld1Bhc3N3b3JkLFxuICAgICAgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9LFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFNpbmdsZS11c2UgT1RQIFx1MjAxNCBkZWxldGUgYWZ0ZXIgYSBzdWNjZXNzZnVsIHJlc2V0LlxuICBhd2FpdCBjbGllbnQuZGVsKGtleSk7XG5cbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRQYXNzd29yZFJlc2V0U3VjY2Vzc0VtYWlsKHtcbiAgICAgIGVtYWlsOiBpc1VzZXJFeGlzdHMuZW1haWwsXG4gICAgICBuYW1lOiBpc1VzZXJFeGlzdHMubmFtZSxcbiAgICB9KSxcbiAgXSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTG9naW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBsb2dpblVzZXIgPSBhc3luYyAocGF5bG9hZDogSUxvZ2luVXNlcikgPT4ge1xuICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgZW1haWwgfSxcbiAgfSk7XG5cbiAgaWYgKCF1c2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJJbnZhbGlkIGVtYWlsIG9yIHBhc3N3b3JkXCIpO1xuICB9XG4gIGlmICh1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBpcyBzdXNwZW5kZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJUaGlzIGFjY291bnQgdXNlcyBHb29nbGUgbG9naW4uIFBsZWFzZSBsb2cgaW4gd2l0aCBHb29nbGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGlzUGFzc3dvcmRWYWxpZCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKHBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkIHx8IFwiXCIpO1xuICBpZiAoIWlzUGFzc3dvcmRWYWxpZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBlbWFpbCBvciBwYXNzd29yZFwiKTtcbiAgfVxuXG4gIHJldHVybiBhd2FpdCBpc3N1ZVRva2Vucyh1c2VyKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBHb29nbGUgbG9naW4gKElELXRva2VuIGZsb3cpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ29vZ2xlTG9naW4gPSBhc3luYyAocGF5bG9hZDogSUdvb2dsZUxvZ2luUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IGlkVG9rZW4gfSA9IHBheWxvYWQ7XG5cbiAgaWYgKCFjb25maWcuZ29vZ2xlX2NsaWVudF9pZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiR29vZ2xlIGxvZ2luIGlzIG5vdCBjb25maWd1cmVkLiBQbGVhc2UgY29udGFjdCBzdXBwb3J0LlwiLFxuICAgICk7XG4gIH1cblxuICBsZXQgdGlja2V0O1xuICB0cnkge1xuICAgIHRpY2tldCA9IGF3YWl0IGdvb2dsZUNsaWVudC52ZXJpZnlJZFRva2VuKHtcbiAgICAgIGlkVG9rZW4sXG4gICAgICBhdWRpZW5jZTogY29uZmlnLmdvb2dsZV9jbGllbnRfaWQsXG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBHb29nbGUgdG9rZW5cIik7XG4gIH1cblxuICBjb25zdCBnb29nbGVEYXRhID0gdGlja2V0LmdldFBheWxvYWQoKTtcbiAgaWYgKCFnb29nbGVEYXRhKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIEdvb2dsZSB0b2tlbiBwYXlsb2FkXCIpO1xuICB9XG5cbiAgY29uc3QgeyBlbWFpbCwgbmFtZSwgc3ViLCBwaWN0dXJlIH0gPSBnb29nbGVEYXRhO1xuXG4gIGlmICghZW1haWwgfHwgIWdvb2dsZURhdGEuZW1haWxfdmVyaWZpZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkdvb2dsZSBhY2NvdW50IGVtYWlsIGlzIG5vdCB2ZXJpZmllZFwiKTtcbiAgfVxuXG4gIGxldCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGdvb2dsZUlkOiBzdWIgfSB9KTtcblxuICAvLyBFeGlzdGluZyB1c2VyIFx1MjE5MiBsaW5rIEdvb2dsZSBhY2NvdW50IGlmIG5vdCBhbHJlYWR5IGxpbmtlZFxuICBpZiAoIXVzZXIgJiYgZW1haWwpIHtcbiAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG4gICAgaWYgKHVzZXIpIHtcbiAgICAgIGlmICh1c2VyLmdvb2dsZUlkICYmIHVzZXIuZ29vZ2xlSWQgIT09IHN1Yikge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgNDA5LFxuICAgICAgICAgIFwiRW1haWwgaXMgYWxyZWFkeSBsaW5rZWQgdG8gYW5vdGhlciBHb29nbGUgYWNjb3VudFwiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiB1c2VyLmlkIH0sXG4gICAgICAgIGRhdGE6IHsgZ29vZ2xlSWQ6IHN1YiwgZW1haWxWZXJpZmllZDogdHJ1ZSB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gQnJhbmQgbmV3IHVzZXJcbiAgaWYgKCF1c2VyKSB7XG4gICAgY29uc3QgbG9jYWxQYXJ0ID0gZW1haWwuc3BsaXQoXCJAXCIpWzBdID8/IGVtYWlsO1xuICAgIGNvbnN0IGRpc3BsYXlOYW1lID0gKG5hbWUgPz8gXCJcIikudHJpbSgpIHx8IGxvY2FsUGFydDtcbiAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgZW1haWwsXG4gICAgICAgIG5hbWU6IGRpc3BsYXlOYW1lLFxuICAgICAgICBwYXNzd29yZDogbnVsbCxcbiAgICAgICAgYXV0aFByb3ZpZGVyOiBcIkdPT0dMRVwiLFxuICAgICAgICBnb29nbGVJZDogc3ViLFxuICAgICAgICBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuICAgICAgICByb2xlOiBcIlVTRVJcIixcbiAgICAgICAgYXZhdGFyVXJsOiBwaWN0dXJlIHx8IG51bGwsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdG9rZW5zID0gYXdhaXQgaXNzdWVUb2tlbnModXNlciEpO1xuICBjb25zdCBzYW5pdGl6ZWRVc2VyID0gc2FuaXRpemVVc2VyKHVzZXIhKTtcblxuICByZXR1cm4geyAuLi50b2tlbnMsIHVzZXI6IHNhbml0aXplZFVzZXIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBEZW1vIGxvZ2luIChncmFkaW5nKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IERFTU9fUEFTU1dPUkQgPSBcImRlbW8xMjNcIjtcblxuY29uc3QgZGVtb0xvZ2luID0gYXN5bmMgKHBheWxvYWQ6IElEZW1vTG9naW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgcm9sZSB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBkZW1vVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwc2VydCh7XG4gICAgd2hlcmU6IHsgZW1haWw6IGBkZW1vLSR7cm9sZS50b0xvd2VyQ2FzZSgpfUB0cmlwdmVyc2UuY29tYCB9LFxuICAgIC8vIHJlc3VycmVjdCBkZW1vIGFjY291bnRzIHRoYXQgYW4gYWRtaW4gc3VzcGVuZGVkIG9yIHNvZnQtZGVsZXRlZFxuICAgIHVwZGF0ZTogeyBzdGF0dXM6IFwiQUNUSVZFXCIsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBjcmVhdGU6IHtcbiAgICAgIG5hbWU6IGBEZW1vICR7cm9sZS5jaGFyQXQoMCkgKyByb2xlLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCl9YCxcbiAgICAgIGVtYWlsOiBgZGVtby0ke3JvbGUudG9Mb3dlckNhc2UoKX1AdHJpcHZlcnNlLmNvbWAsXG4gICAgICBwYXNzd29yZDogYXdhaXQgYmNyeXB0Lmhhc2goREVNT19QQVNTV09SRCwgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpKSxcbiAgICAgIGF1dGhQcm92aWRlcjogXCJDUkVERU5USUFMXCIsXG4gICAgICByb2xlLFxuICAgICAgc3RhdHVzOiBcIkFDVElWRVwiLFxuICAgICAgZW1haWxWZXJpZmllZDogdHJ1ZSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHsgLi4uKGF3YWl0IGlzc3VlVG9rZW5zKGRlbW9Vc2VyKSksIHVzZXI6IGRlbW9Vc2VyIH07XG59O1xuXG4vLyBSZXVzZSBkZXRlY3RlZCBcdTIxOTIga2lsbCB0aGUgd2hvbGUgZmFtaWx5OiBldmVyeSBvdXRzdGFuZGluZyB0b2tlbiBkaWVzIHZpYVxuLy8gcmV2b2tlICsgdG9rZW5WZXJzaW9uIGJ1bXAuIFNhbWUgc2hhcGUgYXMgbG9nb3V0LlxuY29uc3QgcmV2b2tlRmFtaWx5ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oW1xuICAgIHByaXNtYS5yZWZyZXNoVG9rZW4udXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyB1c2VySWQsIHJldm9rZWRBdDogbnVsbCB9LFxuICAgICAgZGF0YTogeyByZXZva2VkQXQ6IG5ldyBEYXRlKCkgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgICAgZGF0YTogeyB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSxcbiAgICB9KSxcbiAgXSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVmcmVzaCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHJlZnJlc2hUb2tlbiA9IGFzeW5jIChwYXlsb2FkOiBJUmVmcmVzaFRva2VuUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IHJlZnJlc2hUb2tlbjogcHJvdmlkZWRSZWZyZXNoVG9rZW4gfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdmVyaWZpZWQgPSBqd3RVdGlscy52ZXJpZnlUb2tlbihcbiAgICBwcm92aWRlZFJlZnJlc2hUb2tlbixcbiAgICBjb25maWcuand0X3JlZnJlc2hfc2VjcmV0LFxuICApO1xuXG4gIGlmICghdmVyaWZpZWQuc3VjY2Vzcykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIHZlcmlmaWVkLmVycm9yKTtcbiAgfVxuXG4gIGNvbnN0IHsgaWQsIHRva2VuVmVyc2lvbjogdG9rZW5Ub2tlblZlcnNpb24gfSA9XG4gICAgdmVyaWZpZWQuZGF0YSBhcyBKd3RQYXlsb2FkICYgeyB0b2tlblZlcnNpb246IG51bWJlciB9O1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcblxuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaGFzIGJlZW4gZGVsZXRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaXMgc3VzcGVuZGVkXCIpO1xuICB9XG5cbiAgLy8gdG9rZW5WZXJzaW9uIGNoYW5nZWQgXHUyMTkyIHRva2VucyB3ZXJlIHJldm9rZWQgKGxvZ291dCAvIHBhc3N3b3JkIGNoYW5nZSlcbiAgaWYgKHVzZXIudG9rZW5WZXJzaW9uICE9PSB0b2tlblRva2VuVmVyc2lvbikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiVG9rZW4gaXMgbm8gbG9uZ2VyIHZhbGlkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIpO1xuICB9XG5cbiAgLy8gT3Bwb3J0dW5pc3RpYyBob3VzZWtlZXBpbmcgXHUyMDE0IGtlZXAgdGhlIGxlZGdlciBmcm9tIGdyb3dpbmcgdW5ib3VuZGVkXG4gIC8vIHdpdGhvdXQgYSBjcm9uOiBkcm9wIGV4cGlyZWQgcm93cyBhbmQgcm93cyByZXZva2VkIG1vcmUgdGhhbiA3IGRheXMgYWdvLlxuICBjb25zdCB3ZWVrQWdvID0gbmV3IERhdGUoRGF0ZS5ub3coKSAtIDcgKiAyNCAqIDYwICogNjAgKiAxMDAwKTtcbiAgYXdhaXQgcHJpc21hLnJlZnJlc2hUb2tlbi5kZWxldGVNYW55KHtcbiAgICB3aGVyZToge1xuICAgICAgT1I6IFt7IGV4cGlyZXNBdDogeyBsdDogbmV3IERhdGUoKSB9IH0sIHsgcmV2b2tlZEF0OiB7IGx0ZTogd2Vla0FnbyB9IH1dLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFJvdGF0aW9uIGxlZGdlciBsb29rdXAgYnkgdGhlIHByZXNlbnRlZCB0b2tlbidzIGhhc2guXG4gIGNvbnN0IHJvdyA9IGF3YWl0IHByaXNtYS5yZWZyZXNoVG9rZW4uZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaGFzaDogc2hhMjU2KHByb3ZpZGVkUmVmcmVzaFRva2VuKSB9LFxuICB9KTtcblxuICAvLyBOZXZlciBpc3N1ZWQgKG9yIGFscmVhZHkgcHJ1bmVkKSBcdTIxOTIgcmVqZWN0LlxuICBpZiAoIXJvdykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCByZWZyZXNoIHRva2VuLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIpO1xuICB9XG5cbiAgLy8gQSByZXZva2VkIHJvdyBpcyB0aGUgdGhlZnQgc2lnbmF0dXJlIFx1MjAxNCBzb21lb25lIHJlcGxheWVkIGEgcm90YXRlZCB0b2tlbi5cbiAgaWYgKHJvdy5yZXZva2VkQXQpIHtcbiAgICBhd2FpdCByZXZva2VGYW1pbHkodXNlci5pZCk7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJSZWZyZXNoIHRva2VuIHJldXNlIGRldGVjdGVkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIpO1xuICB9XG5cbiAgLy8gTmF0dXJhbGx5IGV4cGlyZWQgXHUyMTkyIHJlamVjdCB3aXRob3V0IHRvdWNoaW5nIHRoZSBmYW1pbHkuXG4gIGlmIChyb3cuZXhwaXJlc0F0LmdldFRpbWUoKSA8PSBEYXRlLm5vdygpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJSZWZyZXNoIHRva2VuIGhhcyBleHBpcmVkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIpO1xuICB9XG5cbiAgLy8gVmFsaWQgXHUyMTkyIHJvdGF0ZS4gVGhlIENBUyBvbiBgcmV2b2tlZEF0OiBudWxsYCBtYWtlcyByb3RhdGlvbiBhXG4gIC8vIGNvbXBhcmUtYW5kLXN3YXA6IG9mIHR3byB0cnVseS1jb25jdXJyZW50IHByZXNlbnRzIG9mIHRoZSBzYW1lIHRva2VuIG9ubHlcbiAgLy8gb25lIHdpbnM7IHRoZSBsb3NlcidzIHVwZGF0ZU1hbnkgcmV0dXJucyBjb3VudCAwIFx1MjE5MiBmYW1pbHkgbnVrZS4gVGhlIG51a2VcbiAgLy8gbXVzdCBydW4gQUZURVIgdGhlIHRyYW5zYWN0aW9uIGNvbW1pdHMgXHUyMDE0IHRocm93aW5nIGluc2lkZSB0aGUgaW50ZXJhY3RpdmVcbiAgLy8gdHggd291bGQgcm9sbCBpdCBiYWNrIGFuZCBzaWxlbnRseSB1bmRvIHRoZSBudWtlLlxuICBjb25zdCBvdXRjb21lID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCByb3RhdGVkID0gYXdhaXQgdHgucmVmcmVzaFRva2VuLnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJvdy5pZCwgcmV2b2tlZEF0OiBudWxsIH0sXG4gICAgICBkYXRhOiB7IHJldm9rZWRBdDogbmV3IERhdGUoKSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHJvdGF0ZWQuY291bnQgPT09IDApIHtcbiAgICAgIHJldHVybiBcIkxPU1RcIiBhcyBjb25zdDtcbiAgICB9XG5cbiAgICBjb25zdCB0b2tlbnMgPSBhd2FpdCBpc3N1ZVRva2Vucyh1c2VyLCB0eCk7XG4gICAgcmV0dXJuIHsgdG9rZW5zIH0gYXMgY29uc3Q7XG4gIH0pO1xuXG4gIGlmIChvdXRjb21lID09PSBcIkxPU1RcIikge1xuICAgIGF3YWl0IHJldm9rZUZhbWlseSh1c2VyLmlkKTtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIlJlZnJlc2ggdG9rZW4gcmV1c2UgZGV0ZWN0ZWQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIik7XG4gIH1cblxuICByZXR1cm4gb3V0Y29tZS50b2tlbnM7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTG9nb3V0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgbG9nb3V0ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIC8vIFJldm9rZSB0aGUgbGVkZ2VyIHJvd3MsIHRoZW4gYnVtcCB0b2tlblZlcnNpb24gKGtpbGxzIGV2ZXJ5dGhpbmcpLlxuICBhd2FpdCByZXZva2VGYW1pbHkodXNlcklkKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBHZXQgbWUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRNZUZyb21EQiA9IGFzeW5jICh1c2VySWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuXG4gIHJldHVybiB1c2VyO1xufTtcblxuZXhwb3J0IGNvbnN0IGF1dGhTZXJ2aWNlID0ge1xuICByZWdpc3RlclVzZXIsXG4gIHZlcmlmeUVtYWlsLFxuICByZXNlbmRWZXJpZmljYXRpb24sXG4gIGZvcmdvdFBhc3N3b3JkLFxuICByZXNldFBhc3N3b3JkLFxuICBsb2dpblVzZXIsXG4gIGdvb2dsZUxvZ2luLFxuICBkZW1vTG9naW4sXG4gIHJlZnJlc2hUb2tlbixcbiAgbG9nb3V0LFxuICBnZXRNZUZyb21EQixcbn07IiwgImltcG9ydCB7IE9BdXRoMkNsaWVudCB9IGZyb20gXCJnb29nbGUtYXV0aC1saWJyYXJ5XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuZXhwb3J0IGNvbnN0IGdvb2dsZUNsaWVudCA9IG5ldyBPQXV0aDJDbGllbnQoe1xuICBjbGllbnRJZDogY29uZmlnLmdvb2dsZV9jbGllbnRfaWQsXG59KTsiLCAiaW1wb3J0IHsgY3JlYXRlQ2xpZW50IH0gZnJvbSBcInJlZGlzXCI7XG5pbXBvcnQgdHlwZSB7IFJlZGlzQ2xpZW50VHlwZSB9IGZyb20gXCJyZWRpc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbi8vIFJlZGlzIE9UUCBzdG9yZSBmb3IgZW1haWwgdmVyaWZpY2F0aW9uICsgcGFzc3dvcmQgcmVzZXQgKFN0ZXAgMjEpIFx1MjAxNCBtaXJyb3JzXG4vLyB0aGUgcmVmZXJlbmNlIGJhY2tlbmQncyBub2RlLXJlZGlzIGNsaWVudC4gTnVsbCB3aGVuIHVuY29uZmlndXJlZCBzbyB0aGUgYXBwXG4vLyBzdGlsbCBib290cyAoZS5nLiBWZXJjZWwgcHJvZCk7IHRoZSBhdXRoIGVuZHBvaW50cyB0aGVuIGZhaWwgd2l0aCBhIGNsZWFuXG4vLyA1MDMgaW5zdGVhZCBvZiBjcmFzaGluZy5cbmV4cG9ydCBjb25zdCByZWRpc0NsaWVudCA9IGNvbmZpZy5yZWRpc19ob3N0XG4gID8gY3JlYXRlQ2xpZW50KHtcbiAgICAgIHVzZXJuYW1lOiBjb25maWcucmVkaXNfdXNlcixcbiAgICAgIHBhc3N3b3JkOiBjb25maWcucmVkaXNfcGFzc3dvcmQsXG4gICAgICBzb2NrZXQ6IHtcbiAgICAgICAgaG9zdDogY29uZmlnLnJlZGlzX2hvc3QsXG4gICAgICAgIHBvcnQ6IHBhcnNlSW50KGNvbmZpZy5yZWRpc19wb3J0IHx8IFwiNjM3OVwiKSxcbiAgICAgIH0sXG4gICAgfSlcbiAgOiBudWxsO1xuXG4vLyBMYXppbHktY29ubmVjdCBhY2Nlc3NvciBcdTIwMTQgY29ubmVjdCgpIGlzIGlkZW1wb3RlbnQsIHNvIHRoaXMgaXMgc2FmZSB0byBjYWxsXG4vLyBwZXIgcmVxdWVzdDsgdGhlIGNsaWVudCBpcyBhbHNvIGNvbm5lY3RlZCBvbmNlIGF0IGJvb3QgaW4gc2VydmVyLnRzLlxuZXhwb3J0IGNvbnN0IGdldFJlZGlzID0gYXN5bmMgKCk6IFByb21pc2U8UmVkaXNDbGllbnRUeXBlIHwgbnVsbD4gPT4ge1xuICBpZiAoIXJlZGlzQ2xpZW50KSByZXR1cm4gbnVsbDtcblxuICBpZiAoIXJlZGlzQ2xpZW50LmlzT3Blbikge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCByZWRpc0NsaWVudC5jb25uZWN0KCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIFwiW3JlZGlzXSBjb25uZWN0IGZhaWxlZDpcIixcbiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZWRpc0NsaWVudDtcbn07XG4iLCAiaW1wb3J0IGNyeXB0byBmcm9tIFwiY3J5cHRvXCI7XG5pbXBvcnQgand0LCB7IEp3dFBheWxvYWQsIFNpZ25PcHRpb25zIH0gZnJvbSBcImpzb253ZWJ0b2tlblwiO1xuXG5jb25zdCBjcmVhdGVUb2tlbiA9IChcbiAgcGF5bG9hZDogSnd0UGF5bG9hZCxcbiAgc2VjcmV0OiBzdHJpbmcsXG4gIGV4cGlyZXNJbjogU2lnbk9wdGlvbnMsXG4pID0+IHtcbiAgLy8ganRpIGd1YXJhbnRlZXMgYnl0ZS11bmlxdWUgdG9rZW5zIGV2ZW4gd2l0aGluIHRoZSBzYW1lIGlhdCBzZWNvbmQgXHUyMDE0XG4gIC8vIG90aGVyd2lzZSB0d28gdG9rZW5zIG1pbnRlZCBmb3IgdGhlIHNhbWUgdXNlciBpbiBvbmUgc2Vjb25kIGNvbGxpZGUgb25cbiAgLy8gdGhlIHJlZnJlc2gtbGVkZ2VyIHVuaXF1ZSBoYXNoIChTdGVwIDIyKS5cbiAgY29uc3QgdG9rZW4gPSBqd3Quc2lnbih7IC4uLnBheWxvYWQsIGp0aTogY3J5cHRvLnJhbmRvbVVVSUQoKSB9LCBzZWNyZXQsIGV4cGlyZXNJbik7XG5cbiAgcmV0dXJuIHRva2VuO1xufTtcblxuY29uc3QgdmVyaWZ5VG9rZW4gPSAodG9rZW46IHN0cmluZywgc2VjcmV0OiBzdHJpbmcpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB2ZXJpZmllZFRva2VuID0gand0LnZlcmlmeSh0b2tlbiwgc2VjcmV0KTtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGRhdGE6IHZlcmlmaWVkVG9rZW4sXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIGNvbnNvbGUubG9nKFwiVG9rZW4gVmVyaWZpY2F0aW9uIEZhaWxlZDpcIiwgZXJyb3IpO1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgIH07XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBqd3RVdGlscyA9IHtcbiAgY3JlYXRlVG9rZW4sXG4gIHZlcmlmeVRva2VuLFxufTtcbiIsICJpbXBvcnQgbm9kZW1haWxlciBmcm9tIFwibm9kZW1haWxlclwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbi8vIE5vZGVtYWlsZXIgdHJhbnNwb3J0ZXIgZm9yIHRoZSBhdXRoIGVtYWlscyAoU3RlcCAyMSkgXHUyMDE0IGlkZW50aWNhbCB0byB0aGVcbi8vIHJlZmVyZW5jZSBiYWNrZW5kIChHbWFpbCBhcHAtcGFzc3dvcmQgU01UUCkuIE51bGwgd2hlbiB1bmNvbmZpZ3VyZWQgc28gdGhlXG4vLyBhcHAgc3RpbGwgYm9vdHM7IHRoZSBhdXRoIGVtYWlsIGhlbHBlcnMgdGhlbiBiZWNvbWUgYmVzdC1lZmZvcnQgbm8tb3BzLlxuZXhwb3J0IGNvbnN0IHRyYW5zcG9ydGVyID1cbiAgY29uZmlnLnNtdHBfdXNlciAmJiBjb25maWcuc210cF9wYXNzd29yZFxuICAgID8gbm9kZW1haWxlci5jcmVhdGVUcmFuc3BvcnQoe1xuICAgICAgICBzZXJ2aWNlOiBcImdtYWlsXCIsXG4gICAgICAgIGF1dGg6IHtcbiAgICAgICAgICB1c2VyOiBjb25maWcuc210cF91c2VyLFxuICAgICAgICAgIHBhc3M6IGNvbmZpZy5zbXRwX3Bhc3N3b3JkLFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICA6IG51bGw7XG4iLCAiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCBlanMgZnJvbSBcImVqc1wiO1xuXG4vLyBSZW5kZXJzIGFuIEVKUyBlbWFpbCB0ZW1wbGF0ZSBieSBuYW1lLiBUaGUgdGVtcGxhdGUgZGlyZWN0b3J5IGlzIHJlc29sdmVkIGF0XG4vLyBydW50aW1lIHdpdGggZmFsbGJhY2tzIHNvIGl0IHdvcmtzIGluIGV2ZXJ5IGhvc3Q6XG4vLyAgIC0gZGV2IChgdHN4IHdhdGNoYCkgYW5kIGxvY2FsIGBkaXN0YCBydW4gd2l0aCBjd2QgPSBwcm9qZWN0IHJvb3QgXHUyMTkyIHNyYy90ZW1wbGF0ZXNcbi8vICAgLSB0aGUgVmVyY2VsIGJ1bmRsZSAoYXBpL2luZGV4LmpzKSBoYXMgdGhlIHRlbXBsYXRlcyBjb3BpZWQgdG8gYXBpL3RlbXBsYXRlcyBcdTIxOTIgPGN3ZD4vdGVtcGxhdGVzXG5leHBvcnQgY29uc3QgcmVuZGVyVGVtcGxhdGUgPSAobmFtZTogc3RyaW5nLCBkYXRhOiBvYmplY3QpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICBjb25zdCBjYW5kaWRhdGVzID0gW1xuICAgIHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBcInNyYy90ZW1wbGF0ZXNcIiksXG4gICAgcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwidGVtcGxhdGVzXCIpLFxuICAgIHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBcImFwaS90ZW1wbGF0ZXNcIiksXG4gIF07XG5cbiAgY29uc3QgZGlyID0gY2FuZGlkYXRlcy5maW5kKChkKSA9PiBmcy5leGlzdHNTeW5jKHBhdGguam9pbihkLCBgJHtuYW1lfS5lanNgKSkpO1xuICBpZiAoIWRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcihgRW1haWwgdGVtcGxhdGUgXCIke25hbWV9LmVqc1wiIG5vdCBmb3VuZGApO1xuICB9XG5cbiAgcmV0dXJuIGVqcy5yZW5kZXJGaWxlKHBhdGguam9pbihkaXIsIGAke25hbWV9LmVqc2ApLCBkYXRhKTtcbn07IiwgImltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgdHJhbnNwb3J0ZXIgfSBmcm9tIFwiLi4vbGliL25vZGVtYWlsZXJcIjtcbmltcG9ydCB7IHJlbmRlclRlbXBsYXRlIH0gZnJvbSBcIi4uL3RlbXBsYXRlc1wiO1xuXG4vLyBCZXN0LWVmZm9ydCBOb2RlbWFpbGVyIHNlbmRlcnMgZm9yIHRoZSBhdXRoIGZsb3dzIChTdGVwIDIxKSBcdTIwMTQgbWlycm9ycyB0aGVcbi8vIHJlZmVyZW5jZSBiYWNrZW5kJ3MgdHJhbnNwb3J0ZXIuc2VuZE1haWwgY2FsbHMgd2l0aCBFSlMgdGVtcGxhdGVzIHJlbmRlcmVkXG4vLyBmcm9tIGBzcmMvdGVtcGxhdGVzLyouZWpzYC4gRXZlcnkgZmFpbHVyZSAobWlzc2luZyB0ZW1wbGF0ZSwgU01UUCBlcnJvcikgaXNcbi8vIGNhdWdodCBhbmQgbG9nZ2VkIGFzIGEgd2FybiwgbmV2ZXIgdGhyb3duLCBzbyBpdCBjYW4ndCBmYWlsIHRoZSBidXNpbmVzc1xuLy8gd3JpdGUgdGhhdCB0cmlnZ2VyZWQgaXQuIENhbGwgc2l0ZXMgZmlyZSB0aGVzZSBhc1xuLy8gYHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtzZW5kWCguLi4pXSlgLlxuXG5jb25zdCBPVFBfRVhQSVJBVElPTl9NSU5VVEVTID0gNTtcblxuaW50ZXJmYWNlIElBdXRoRW1haWxEZXRhaWxzIHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzZW5kQXV0aE1haWwoXG4gIHRvOiBzdHJpbmcsXG4gIHN1YmplY3Q6IHN0cmluZyxcbiAgYnVpbGQ6ICgpID0+IFByb21pc2U8c3RyaW5nPixcbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIXRyYW5zcG9ydGVyKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBTTVRQIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBhdXRoIGVtYWlsLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IGh0bWwgPSBhd2FpdCBidWlsZCgpO1xuICAgIGF3YWl0IHRyYW5zcG9ydGVyLnNlbmRNYWlsKHtcbiAgICAgIGZyb206IGNvbmZpZy5zbXRwX3VzZXIgYXMgc3RyaW5nLFxuICAgICAgdG8sXG4gICAgICBzdWJqZWN0LFxuICAgICAgaHRtbCxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zdCBkZXRhaWwgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgY29uc29sZS53YXJuKGBbZW1haWxdIGZhaWxlZCB0byBzZW5kIFwiJHtzdWJqZWN0fVwiIHRvICR7dG99OiAke2RldGFpbH1gKTtcbiAgfVxufVxuXG4vLyBTZW50IHJpZ2h0IGFmdGVyIGEgY3JlZGVudGlhbCByZWdpc3RyYXRpb24gc3RhZ2VzIGFuIE9UUCBpbiBSZWRpcy5cbmV4cG9ydCBjb25zdCBzZW5kVmVyaWZpY2F0aW9uT3RwRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElBdXRoRW1haWxEZXRhaWxzICYgeyBvdHA6IHN0cmluZyB9LFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGF3YWl0IHNlbmRBdXRoTWFpbChkZXRhaWxzLmVtYWlsLCBcIkVtYWlsIFZlcmlmaWNhdGlvbiBPVFBcIiwgKCkgPT5cbiAgICByZW5kZXJUZW1wbGF0ZShcInJlZ2lzdHJhdGlvbi11c2VyLW90cFwiLCB7XG4gICAgICBuYW1lOiBkZXRhaWxzLm5hbWUsXG4gICAgICBlbWFpbDogZGV0YWlscy5lbWFpbCxcbiAgICAgIG90cDogZGV0YWlscy5vdHAsXG4gICAgICBleHBpcmF0aW9uTWludXRlczogT1RQX0VYUElSQVRJT05fTUlOVVRFUyxcbiAgICB9KSxcbiAgKTtcbn07XG5cbi8vIFNlbnQgYnkgdGhlIGZvcmdvdC1wYXNzd29yZCBmbG93IHdpdGggdGhlIHJlc2V0IE9UUC5cbmV4cG9ydCBjb25zdCBzZW5kRm9yZ290UGFzc3dvcmRPdHBFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSUF1dGhFbWFpbERldGFpbHMgJiB7IG90cDogc3RyaW5nIH0sXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgYXdhaXQgc2VuZEF1dGhNYWlsKGRldGFpbHMuZW1haWwsIFwiRm9yZ290IFBhc3N3b3JkIFJlc2V0IE9UUFwiLCAoKSA9PlxuICAgIHJlbmRlclRlbXBsYXRlKFwiZm9yZ290LXBhc3N3b3JkXCIsIHtcbiAgICAgIG5hbWU6IGRldGFpbHMubmFtZSxcbiAgICAgIG90cDogZGV0YWlscy5vdHAsXG4gICAgICBleHBpcmF0aW9uTWludXRlczogT1RQX0VYUElSQVRJT05fTUlOVVRFUyxcbiAgICB9KSxcbiAgKTtcbn07XG5cbi8vIFNlbnQgYWZ0ZXIgYSBzdWNjZXNzZnVsIGVtYWlsIHZlcmlmaWNhdGlvbi4gVGhlIENUQSBsaW5rcyB0byB0aGUgZnJvbnRlbmRcbi8vIChwcm9kIFVSTCBpbiBwcm9kdWN0aW9uLCBkZXYgVVJMIG90aGVyd2lzZSk7IGhpZGRlbiB3aGVuIG5vIFVSTCBpcyBzZXQuXG5leHBvcnQgY29uc3Qgc2VuZFdlbGNvbWVFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSUF1dGhFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgYXdhaXQgc2VuZEF1dGhNYWlsKGRldGFpbHMuZW1haWwsIFwiV2VsY29tZSB0byBUcmlwVmVyc2VcIiwgKCkgPT5cbiAgICByZW5kZXJUZW1wbGF0ZShcIndlbGNvbWUtZW1haWxcIiwge1xuICAgICAgbmFtZTogZGV0YWlscy5uYW1lLFxuICAgICAgZnJvbnRlbmRVcmw6XG4gICAgICAgIGNvbmZpZy5ub2RlX2VudiA9PT0gXCJwcm9kdWN0aW9uXCJcbiAgICAgICAgICA/IGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZFxuICAgICAgICAgIDogY29uZmlnLmZyb250ZW5kX3VybF9kZXYsXG4gICAgfSksXG4gICk7XG59O1xuXG4vLyBTZW50IGFmdGVyIGEgc3VjY2Vzc2Z1bCBwYXNzd29yZCByZXNldC5cbmV4cG9ydCBjb25zdCBzZW5kUGFzc3dvcmRSZXNldFN1Y2Nlc3NFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSUF1dGhFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgYXdhaXQgc2VuZEF1dGhNYWlsKGRldGFpbHMuZW1haWwsIFwiUGFzc3dvcmQgUmVzZXRcIiwgKCkgPT5cbiAgICByZW5kZXJUZW1wbGF0ZShcInJlc2V0LXBhc3N3b3JkLXN1Y2Nlc3NcIiwge1xuICAgICAgbmFtZTogZGV0YWlscy5uYW1lLFxuICAgIH0pLFxuICApO1xufTsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXF1ZXN0SGFuZGxlciwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5leHBvcnQgY29uc3QgY2F0Y2hBc3luYyA9IChmbjogUmVxdWVzdEhhbmRsZXIpID0+IHtcbiAgcmV0dXJuIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmbihyZXEsIHJlcywgbmV4dCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIG5leHQoZXJyb3IpO1xuICAgIH1cbiAgfTtcbn07XG4iLCAiaW1wb3J0IHsgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG50eXBlIFRNZXRhID0ge1xuICBwYWdlOiBudW1iZXI7XG4gIGxpbWl0OiBudW1iZXI7XG4gIHRvdGFsOiBudW1iZXI7XG4gIHRvdGFsUGFnZXM6IG51bWJlcjtcbn07XG5cbnR5cGUgVFJlc3BvbnNlRGF0YTxUPiA9IHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgc3RhdHVzQ29kZTogbnVtYmVyO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGRhdGE6IFQ7XG4gIG1ldGE/OiBUTWV0YTtcbn07XG5cbmV4cG9ydCBjb25zdCBzZW5kUmVzcG9uc2UgPSA8VD4ocmVzOiBSZXNwb25zZSwgZGF0YTogVFJlc3BvbnNlRGF0YTxUPikgPT4ge1xuICByZXMuc3RhdHVzKGRhdGEuc3RhdHVzQ29kZSkuanNvbih7XG4gICAgc3VjY2VzczogZGF0YS5zdWNjZXNzLFxuICAgIG1lc3NhZ2U6IGRhdGEubWVzc2FnZSxcbiAgICBkYXRhOiBkYXRhLmRhdGEsXG4gICAgbWV0YTogZGF0YS5tZXRhLFxuICB9KTtcbn07XG4iLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCByZWdpc3RlclNjaGVtYSA9IHoub2JqZWN0KHtcbiAgbmFtZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOYW1lIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKSxcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpLFxuICBwYXNzd29yZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbig2LCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCg3MiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IG1vc3QgNzIgY2hhcmFjdGVyc1wiKSxcbiAgcGhvbmU6IHpcbiAgICAuc3RyaW5nKClcbiAgICAubWF4KDIwLCBcIlBob25lIG51bWJlciBpcyB0b28gbG9uZ1wiKVxuICAgIC5vcHRpb25hbCgpLFxuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBsb2dpblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpLFxuICBwYXNzd29yZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBnb29nbGVMb2dpblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWRUb2tlbjogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJHb29nbGUgaWRUb2tlbiBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBkZW1vTG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlLCB7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSByb2xlXCIsXG4gIH0pLFxufSk7XG5cbi8vIHJlZnJlc2hUb2tlbiBtYXkgY29tZSBmcm9tIHRoZSBodHRwT25seSBjb29raWUgT1IgdGhlIHJlcXVlc3QgYm9keSBcdTIwMTRcbi8vIHZhbGlkYXRpb24gaXMgbGVuaWVudCBoZXJlOyB0aGUgY29udHJvbGxlciBoYW5kbGVzIGJvdGggc291cmNlcy5cbmNvbnN0IHJlZnJlc2hUb2tlblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcmVmcmVzaFRva2VuOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IGVtYWlsU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5lbWFpbChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWxcIik7XG5cbmNvbnN0IG90cFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk9UUCBpcyByZXF1aXJlZFwiIH0pXG4gIC5sZW5ndGgoNiwgXCJPVFAgbXVzdCBiZSBleGFjdGx5IDYgZGlnaXRzXCIpXG4gIC5yZWdleCgvXlxcZHs2fSQvLCBcIk9UUCBtdXN0IGJlIGV4YWN0bHkgNiBkaWdpdHNcIik7XG5cbmNvbnN0IHZlcmlmeUVtYWlsU2NoZW1hID0gei5vYmplY3Qoe1xuICBlbWFpbDogZW1haWxTY2hlbWEsXG4gIG90cDogb3RwU2NoZW1hLFxufSk7XG5cbmNvbnN0IHJlc2VuZFZlcmlmaWNhdGlvblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IGVtYWlsU2NoZW1hLFxufSk7XG5cbmNvbnN0IGZvcmdvdFBhc3N3b3JkU2NoZW1hID0gei5vYmplY3Qoe1xuICBlbWFpbDogZW1haWxTY2hlbWEsXG59KTtcblxuY29uc3QgcmVzZXRQYXNzd29yZFNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IGVtYWlsU2NoZW1hLFxuICBvdHA6IG90cFNjaGVtYSxcbiAgbmV3UGFzc3dvcmQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTmV3IHBhc3N3b3JkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDYsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBsZWFzdCA2IGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDcyLCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbW9zdCA3MiBjaGFyYWN0ZXJzXCIpLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRSZWdpc3RlclNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHJlZ2lzdGVyU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRMb2dpblNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGxvZ2luU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRHb29nbGVMb2dpblNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGdvb2dsZUxvZ2luU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRSZWZyZXNoVG9rZW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZWZyZXNoVG9rZW5TY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFZlcmlmeUVtYWlsU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdmVyaWZ5RW1haWxTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFJlc2V0UGFzc3dvcmRTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZXNldFBhc3N3b3JkU2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IGF1dGhWYWxpZGF0aW9ucyA9IHtcbiAgcmVnaXN0ZXJTY2hlbWEsXG4gIGxvZ2luU2NoZW1hLFxuICBnb29nbGVMb2dpblNjaGVtYSxcbiAgZGVtb0xvZ2luU2NoZW1hLFxuICByZWZyZXNoVG9rZW5TY2hlbWEsXG4gIHZlcmlmeUVtYWlsU2NoZW1hLFxuICByZXNlbmRWZXJpZmljYXRpb25TY2hlbWEsXG4gIGZvcmdvdFBhc3N3b3JkU2NoZW1hLFxuICByZXNldFBhc3N3b3JkU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBab2RUeXBlIH0gZnJvbSBcInpvZFwiO1xuXG50eXBlIFZhbGlkYXRpb25TY2hlbWEgPSB7XG4gIGJvZHk/OiBab2RUeXBlO1xuICBxdWVyeT86IFpvZFR5cGU7XG4gIHBhcmFtcz86IFpvZFR5cGU7XG59O1xuXG4vLyBSdW5zIFpvZCBzY2hlbWFzIGFnYWluc3QgcmVxLmJvZHkvcXVlcnkvcGFyYW1zIGFuZCByZXBsYWNlcyB0aGUgcGFyc2VkXG4vLyB2YWx1ZXMgc28gZG93bnN0cmVhbSBoYW5kbGVycyB3b3JrIHdpdGggdmFsaWRhdGVkIChhbmQgdHlwZWQpIGRhdGEuXG4vLyBBbnkgWm9kRXJyb3IgdGhyb3duIGhlcmUgaXMgbWFwcGVkIHRvIGEgNDAwIGJ5IGdsb2JhbEVycm9ySGFuZGxlci5cbi8vXG4vLyByZXEuYm9keSBpcyBzYWZlbHkgd3JpdGFibGUsIGJ1dCBpbiBFeHByZXNzIDUgcmVxLnF1ZXJ5L3JlcS5wYXJhbXMgYXJlXG4vLyBnZXR0ZXItb25seSBcdTIwMTQgdGhleSBtdXN0IGJlIHJlZGVmaW5lZCB2aWEgZGVmaW5lUHJvcGVydHkgdG8gc3dhcCBpbiB0aGVcbi8vIHBhcnNlZCB2YWx1ZXMuXG5jb25zdCB2YWxpZGF0ZVJlcXVlc3QgPSAoc2NoZW1hOiBWYWxpZGF0aW9uU2NoZW1hKSA9PiB7XG4gIHJldHVybiAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBpZiAoc2NoZW1hLmJvZHkpIHtcbiAgICAgIHJlcS5ib2R5ID0gc2NoZW1hLmJvZHkucGFyc2UocmVxLmJvZHkpO1xuICAgIH1cbiAgICBpZiAoc2NoZW1hLnF1ZXJ5KSB7XG4gICAgICBjb25zdCBwYXJzZWRRdWVyeSA9IHNjaGVtYS5xdWVyeS5wYXJzZShyZXEucXVlcnkpO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHJlcSwgXCJxdWVyeVwiLCB7XG4gICAgICAgIHZhbHVlOiBwYXJzZWRRdWVyeSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoc2NoZW1hLnBhcmFtcykge1xuICAgICAgY29uc3QgcGFyc2VkUGFyYW1zID0gc2NoZW1hLnBhcmFtcy5wYXJzZShyZXEucGFyYW1zKTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXEsIFwicGFyYW1zXCIsIHtcbiAgICAgICAgdmFsdWU6IHBhcnNlZFBhcmFtcyxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIG5leHQoKTtcbiAgfTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHZhbGlkYXRlUmVxdWVzdDsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBKd3RQYXlsb2FkIH0gZnJvbSBcImpzb253ZWJ0b2tlblwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBqd3RVdGlscyB9IGZyb20gXCIuLi91dGlscy9qd3RcIjtcblxuLy8gYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSBcdTIxOTIgb25seSB0aG9zZSByb2xlcyBwYXNzXG4vLyBhdXRoKCkgXHUyMTkyIGFueSBhdXRoZW50aWNhdGVkIHVzZXIgcGFzc2VzXG5jb25zdCBhdXRoID0gKC4uLnJlcXVpcmVkUm9sZXM6IFJvbGVbXSkgPT4ge1xuICByZXR1cm4gY2F0Y2hBc3luYyhhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB0b2tlbiA9IHJlcS5jb29raWVzLmFjY2Vzc1Rva2VuXG4gICAgICA/IHJlcS5jb29raWVzLmFjY2Vzc1Rva2VuXG4gICAgICA6IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb24/LnN0YXJ0c1dpdGgoXCJCZWFyZXIgXCIpXG4gICAgICAgID8gcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbi5zcGxpdChcIiBcIilbMV1cbiAgICAgICAgOiByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuXG4gICAgLy8gMS4gdG9rZW4gbXVzdCBiZSBwcmVzZW50XG4gICAgaWYgKCF0b2tlbikge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDEsXG4gICAgICAgIFwiWW91IGFyZSBub3QgbG9nZ2VkIGluLiBQbGVhc2UgbG9naW4gdG8gY29udGludWUuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDIuIHZlcmlmeSB0aGUgYWNjZXNzIHRva2VuXG4gICAgY29uc3QgdmVyaWZpZWRUb2tlbiA9IGp3dFV0aWxzLnZlcmlmeVRva2VuKFxuICAgICAgdG9rZW4sXG4gICAgICBjb25maWcuand0X2FjY2Vzc19zZWNyZXQsXG4gICAgKTtcblxuICAgIGlmICghdmVyaWZpZWRUb2tlbi5zdWNjZXNzKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCB2ZXJpZmllZFRva2VuLmVycm9yKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGlkLCB0b2tlblZlcnNpb24gfSA9IHZlcmlmaWVkVG9rZW4uZGF0YSBhcyBKd3RQYXlsb2FkICYge1xuICAgICAgdG9rZW5WZXJzaW9uOiBudW1iZXI7XG4gICAgfTtcblxuICAgIC8vIDMuIHJlLWZldGNoIHVzZXIgdG8gZW5mb3JjZSBhY2NvdW50IHN0YXRlIG9uIGV2ZXJ5IHJlcXVlc3RcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgICB3aGVyZTogeyBpZCB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIlVzZXIgbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICBpZiAodXNlci5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAzLFxuICAgICAgICBcIlVzZXIgaXMgc3VzcGVuZGVkLiBQbGVhc2UgY29udGFjdCBzdXBwb3J0IHNlcnZpY2UuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDQuIHRva2VuVmVyc2lvbiBtdXN0IG1hdGNoIERCIChsb2dvdXQgLyBwYXNzd29yZCBjaGFuZ2Uga2lsbHMgb2xkIHRva2VucylcbiAgICBpZiAodXNlci50b2tlblZlcnNpb24gIT09IHRva2VuVmVyc2lvbikge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDEsXG4gICAgICAgIFwiU2Vzc2lvbiBpcyBubyBsb25nZXIgdmFsaWQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gNS4gYXV0aG9yaXphdGlvbiB1c2VzIHRoZSBEQiByb2xlLCBub3QgdGhlIChwb3NzaWJseSBzdGFsZSkgSldUIHJvbGVcbiAgICBpZiAocmVxdWlyZWRSb2xlcy5sZW5ndGggJiYgIXJlcXVpcmVkUm9sZXMuaW5jbHVkZXModXNlci5yb2xlKSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDMsXG4gICAgICAgIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBhY2Nlc3MgdGhpcyByb3V0ZS5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gNi4gYXR0YWNoIHRoZSBhdXRoZW50aWNhdGVkIHVzZXIgdG8gdGhlIHJlcXVlc3RcbiAgICByZXEudXNlciA9IHtcbiAgICAgIGlkOiB1c2VyLmlkLFxuICAgICAgbmFtZTogdXNlci5uYW1lLFxuICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICByb2xlOiB1c2VyLnJvbGUsXG4gICAgfTtcblxuICAgIG5leHQoKTtcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBhdXRoOyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgdXNlckNvbnRyb2xsZXIgfSBmcm9tIFwiLi91c2VyLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHVzZXJWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3VzZXIudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gT3duIHByb2ZpbGUgXHUyMDE0IGFueSBhdXRoZW50aWNhdGVkIHVzZXJcbnJvdXRlci5wYXRjaChcbiAgXCIvcHJvZmlsZVwiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHVzZXJWYWxpZGF0aW9ucy51cGRhdGVQcm9maWxlU2NoZW1hIH0pLFxuICB1c2VyQ29udHJvbGxlci51cGRhdGVQcm9maWxlLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IGxpc3QgdXNlcnMgd2l0aCBmaWx0ZXJzICsgcGFnaW5hdGlvblxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiB1c2VyVmFsaWRhdGlvbnMudXNlclF1ZXJ5U2NoZW1hIH0pLFxuICB1c2VyQ29udHJvbGxlci5nZXRVc2Vycyxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCByb2xlIG1hbmFnZW1lbnRcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3JvbGVcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHVzZXJWYWxpZGF0aW9ucy51c2VyUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHVzZXJWYWxpZGF0aW9ucy5jaGFuZ2VSb2xlU2NoZW1hLFxuICB9KSxcbiAgdXNlckNvbnRyb2xsZXIuY2hhbmdlUm9sZSxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBzdGF0dXMgbWFuYWdlbWVudFxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiB1c2VyVmFsaWRhdGlvbnMudXNlclBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiB1c2VyVmFsaWRhdGlvbnMuY2hhbmdlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgdXNlckNvbnRyb2xsZXIuY2hhbmdlU3RhdHVzLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IHNvZnQgZGVsZXRlXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiB1c2VyVmFsaWRhdGlvbnMudXNlclBhcmFtc1NjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIuZGVsZXRlVXNlcixcbik7XG5cbmV4cG9ydCBjb25zdCB1c2VyUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgdXNlclNlcnZpY2UgfSBmcm9tIFwiLi91c2VyLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyBVcGRhdGUgcHJvZmlsZSBjb250cm9sbGVyXG5jb25zdCB1cGRhdGVQcm9maWxlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS51cGRhdGVQcm9maWxlKHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlByb2ZpbGUgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR2V0IGFsbCB1c2VycyAoYWRtaW4pXG5jb25zdCBnZXRVc2VycyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHVzZXJTZXJ2aWNlLmdldFVzZXJzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlcnMgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gVXBkYXRlIHVzZXIgcm9sZSAoYWRtaW4pXG5jb25zdCBjaGFuZ2VSb2xlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICAvLyBhbiBhZG1pbiBtdXN0IG5vdCBkb3duZ3JhZGUvY2hhbmdlIHRoZWlyIG93biByb2xlXG4gICAgaWYgKGlkID09PSByZXEudXNlcj8uaWQpIHtcbiAgICAgIHJldHVybiBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkZPUkJJRERFTixcbiAgICAgICAgbWVzc2FnZTogXCJZb3UgY2Fubm90IGNoYW5nZSB5b3VyIG93biByb2xlLlwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHVzZXJTZXJ2aWNlLmNoYW5nZVJvbGUoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIHJvbGUgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gVXBkYXRlIHVzZXIgc3RhdHVzIChhZG1pbilcbmNvbnN0IGNoYW5nZVN0YXR1cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgLy8gYW4gYWRtaW4gbXVzdCBub3Qgc3VzcGVuZC9hY3RpdmF0ZSB0aGVpciBvd24gYWNjb3VudFxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBjaGFuZ2UgeW91ciBvd24gc3RhdHVzLlwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHVzZXJTZXJ2aWNlLmNoYW5nZVN0YXR1cyhpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFNvZnQgZGVsZXRlIHVzZXIgKGFkbWluKVxuY29uc3QgZGVsZXRlVXNlciA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgLy8gYW4gYWRtaW4gbXVzdCBub3QgZGVsZXRlIHRoZWlyIG93biBhY2NvdW50XG4gICAgaWYgKGlkID09PSByZXEudXNlcj8uaWQpIHtcbiAgICAgIHJldHVybiBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkZPUkJJRERFTixcbiAgICAgICAgbWVzc2FnZTogXCJZb3UgY2Fubm90IGRlbGV0ZSB5b3VyIG93biBhY2NvdW50LlwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHVzZXJTZXJ2aWNlLmRlbGV0ZVVzZXIoaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHVzZXJDb250cm9sbGVyID0ge1xuICB1cGRhdGVQcm9maWxlLFxuICBnZXRVc2VycyxcbiAgY2hhbmdlUm9sZSxcbiAgY2hhbmdlU3RhdHVzLFxuICBkZWxldGVVc2VyLFxufTsiLCAiaW1wb3J0IGJjcnlwdCBmcm9tIFwiYmNyeXB0anNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IFJvbGUsIFVzZXJTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHtcbiAgSUNoYW5nZVJvbGUsXG4gIElDaGFuZ2VTdGF0dXMsXG4gIElVcGRhdGVQcm9maWxlLFxuICBJVXNlclF1ZXJ5LFxufSBmcm9tIFwiLi91c2VyLmludGVyZmFjZVwiO1xuXG5jb25zdCB2YWxpZGF0ZUFjdGl2ZVVzZXIgPSBhc3luYyAoaWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG5cbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuICBpZiAodXNlci5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIlVzZXIgaXMgc3VzcGVuZGVkLiBQbGVhc2UgY29udGFjdCBzdXBwb3J0IHNlcnZpY2UuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgVXBkYXRlIHByb2ZpbGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCB1cGRhdGVQcm9maWxlID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBJVXBkYXRlUHJvZmlsZSkgPT4ge1xuICBjb25zdCB7IG5hbWUsIHBob25lLCBhdmF0YXJVcmwsIGN1cnJlbnRQYXNzd29yZCwgbmV3UGFzc3dvcmQgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWVPclRocm93KHsgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9IH0pO1xuXG4gIGlmICh1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLmF1dGhQcm92aWRlciA9PT0gXCJHT09HTEVcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMyxcbiAgICAgIFwiR29vZ2xlIGFjY291bnRzIGNhbm5vdCBjaGFuZ2UgcGFzc3dvcmQuIFVzZSBHb29nbGUgc2lnbi1pbiB0byBtYW5hZ2UgeW91ciBwcm9maWxlLlwiLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBkYXRhOiBQcmlzbWEuVXNlclVwZGF0ZUlucHV0ID0ge307XG5cbiAgaWYgKG5hbWUpIGRhdGEubmFtZSA9IG5hbWU7XG4gIGlmIChwaG9uZSkgZGF0YS5waG9uZSA9IHBob25lO1xuICBpZiAoYXZhdGFyVXJsKSBkYXRhLmF2YXRhclVybCA9IGF2YXRhclVybDtcblxuICAvLyBQYXNzd29yZCBjaGFuZ2UgcmVxdWlyZXMgY3VycmVudFBhc3N3b3JkICsgbmV3UGFzc3dvcmRcbiAgaWYgKG5ld1Bhc3N3b3JkKSB7XG4gICAgaWYgKCFjdXJyZW50UGFzc3dvcmQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiQ3VycmVudCBwYXNzd29yZCBpcyByZXF1aXJlZFwiKTtcbiAgICB9XG4gICAgaWYgKGN1cnJlbnRQYXNzd29yZCA9PT0gbmV3UGFzc3dvcmQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiTmV3IHBhc3N3b3JkIG11c3QgYmUgZGlmZmVyZW50XCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGlzTWF0Y2ggPSBhd2FpdCBiY3J5cHQuY29tcGFyZShjdXJyZW50UGFzc3dvcmQsIHVzZXIucGFzc3dvcmQgfHwgXCJcIik7XG4gICAgaWYgKCFpc01hdGNoKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgY3VycmVudCBwYXNzd29yZFwiKTtcbiAgICB9XG5cbiAgICBkYXRhLnBhc3N3b3JkID0gYXdhaXQgYmNyeXB0Lmhhc2goXG4gICAgICBuZXdQYXNzd29yZCxcbiAgICAgIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSxcbiAgICApO1xuICAgIGRhdGEudG9rZW5WZXJzaW9uID0geyBpbmNyZW1lbnQ6IDEgfTtcbiAgfVxuXG4gIGNvbnN0IHVwZGF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgZGF0YSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB1cGRhdGVkVXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogbGlzdCB1c2VycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldFVzZXJzID0gYXN5bmMgKHF1ZXJ5OiBJVXNlclF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlIHx8IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgfHwgMTA7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Vc2VyV2hlcmVJbnB1dCA9IHtcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICB9O1xuXG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICB3aGVyZS5PUiA9IFtcbiAgICAgIHsgbmFtZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgeyBlbWFpbDogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgIF07XG4gIH1cbiAgaWYgKHF1ZXJ5LnJvbGUpIHdoZXJlLnJvbGUgPSBxdWVyeS5yb2xlO1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG5cbiAgY29uc3QgW3VzZXJzLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnVzZXIuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBza2lwOiAocGFnZSAtIDEpICogbGltaXQsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICAgIH0pLFxuICAgIHByaXNtYS51c2VyLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogdXNlcnMsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogdXBkYXRlIHJvbGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBjaGFuZ2VSb2xlID0gYXN5bmMgKGlkOiBzdHJpbmcsIHBheWxvYWQ6IElDaGFuZ2VSb2xlKSA9PiB7XG4gIGNvbnN0IHsgcm9sZSB9ID0gcGF5bG9hZDtcblxuICBhd2FpdCB2YWxpZGF0ZUFjdGl2ZVVzZXIoaWQpO1xuXG4gIGNvbnN0IHVwZGF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGRhdGE6IHsgcm9sZSwgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gdXBkYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IHVwZGF0ZSBzdGF0dXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBjaGFuZ2VTdGF0dXMgPSBhc3luYyAoaWQ6IHN0cmluZywgcGF5bG9hZDogSUNoYW5nZVN0YXR1cykgPT4ge1xuICBjb25zdCB7IHN0YXR1cyB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7XG4gICAgICBzdGF0dXMsXG4gICAgICAvLyByZWFjdGl2YXRpbmcgcHJlc2VydmVzIHRoZSBhY2NvdW50IHdoaWxlIHN1c3BlbmRpbmcgcmV2b2tlcyBhbGwgc2Vzc2lvbnNcbiAgICAgIC4uLihzdGF0dXMgPT09IFVzZXJTdGF0dXMuU1VTUEVOREVEICYmIHsgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0pLFxuICAgIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gdXBkYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IHNvZnQgZGVsZXRlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZGVsZXRlVXNlciA9IGFzeW5jIChpZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuXG4gIGNvbnN0IGRlbGV0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlLCB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiBkZWxldGVkVXNlcjtcbn07XG5cbmV4cG9ydCBjb25zdCB1c2VyU2VydmljZSA9IHtcbiAgdXBkYXRlUHJvZmlsZSxcbiAgZ2V0VXNlcnMsXG4gIGNoYW5nZVJvbGUsXG4gIGNoYW5nZVN0YXR1cyxcbiAgZGVsZXRlVXNlcixcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBSb2xlLCBVc2VyU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcblxuY29uc3QgdXBkYXRlUHJvZmlsZVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgbmFtZTogelxuICAgICAgLnN0cmluZygpXG4gICAgICAudHJpbSgpXG4gICAgICAubWluKDIsIFwiTmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAgICAgLm1heCgxMDAsIFwiTmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICAgIHBob25lOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC50cmltKClcbiAgICAgIC5tYXgoMjAsIFwiUGhvbmUgbnVtYmVyIGlzIHRvbyBsb25nXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgICBhdmF0YXJVcmw6IHouc3RyaW5nKCkudHJpbSgpLnVybChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgaW1hZ2UgVVJMXCIpLm9wdGlvbmFsKCksXG4gICAgY3VycmVudFBhc3N3b3JkOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxuICAgIG5ld1Bhc3N3b3JkOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC5taW4oNiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IGxlYXN0IDYgY2hhcmFjdGVyc1wiKVxuICAgICAgLm1heCg3MiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IG1vc3QgNzIgY2hhcmFjdGVyc1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5yZWZpbmUoXG4gICAgKGRhdGEpID0+XG4gICAgICBkYXRhLm5ld1Bhc3N3b3JkID09PSB1bmRlZmluZWQgfHxcbiAgICAgIGRhdGEuY3VycmVudFBhc3N3b3JkICE9PSB1bmRlZmluZWQsXG4gICAgeyBtZXNzYWdlOiBcIkN1cnJlbnQgcGFzc3dvcmQgaXMgcmVxdWlyZWQgdG8gY2hhbmdlIHBhc3N3b3JkXCIgfSxcbiAgKTtcblxuY29uc3QgdXNlclF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm9wdGlvbmFsKCksXG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlKS5vcHRpb25hbCgpLFxuICBzdGF0dXM6IHoubmF0aXZlRW51bShVc2VyU3RhdHVzKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IHVzZXJQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlVzZXIgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgY2hhbmdlUm9sZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUsIHsgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSByb2xlXCIgfSksXG59KTtcblxuY29uc3QgY2hhbmdlU3RhdHVzU2NoZW1hID0gei5vYmplY3Qoe1xuICBzdGF0dXM6IHoubmF0aXZlRW51bShVc2VyU3RhdHVzLCB7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSBzdGF0dXNcIixcbiAgfSksXG59KTtcblxuZXhwb3J0IHR5cGUgVFVwZGF0ZVByb2ZpbGVTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiB1cGRhdGVQcm9maWxlU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRVc2VyUXVlcnlTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiB1c2VyUXVlcnlTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgdXNlclZhbGlkYXRpb25zID0ge1xuICB1cGRhdGVQcm9maWxlU2NoZW1hLFxuICB1c2VyUXVlcnlTY2hlbWEsXG4gIHVzZXJQYXJhbXNTY2hlbWEsXG4gIGNoYW5nZVJvbGVTY2hlbWEsXG4gIGNoYW5nZVN0YXR1c1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgbXVsdGVyIGZyb20gXCJtdWx0ZXJcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHsgdXBsb2Fkc0NvbnRyb2xsZXIgfSBmcm9tIFwiLi91cGxvYWRzLmNvbnRyb2xsZXJcIjtcblxuY29uc3QgdXBsb2FkID0gbXVsdGVyKHtcbiAgc3RvcmFnZTogbXVsdGVyLm1lbW9yeVN0b3JhZ2UoKSxcbiAgbGltaXRzOiB7IGZpbGVTaXplOiA1ICogMTAyNCAqIDEwMjQgfSxcbiAgZmlsZUZpbHRlcjogKF9yZXEsIGZpbGUsIGNiKSA9PiB7XG4gICAgaWYgKC9eaW1hZ2VcXC8oanBlZ3xwbmd8d2VicCkkLy50ZXN0KGZpbGUubWltZXR5cGUpKSB7XG4gICAgICBjYihudWxsLCB0cnVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2IoXG4gICAgICAgIE9iamVjdC5hc3NpZ24obmV3IEVycm9yKFwiT25seSBqcGcsIHBuZyBvciB3ZWJwIGltYWdlcyBhcmUgYWxsb3dlZFwiKSwge1xuICAgICAgICAgIGNvZGU6IFwiSU5WQUxJRF9GSUxFX1RZUEVcIixcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cbiAgfSxcbn0pO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxucm91dGVyLnBvc3QoXG4gIFwiL2ltYWdlXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHVwbG9hZC5zaW5nbGUoXCJpbWFnZVwiKSxcbiAgdXBsb2Fkc0NvbnRyb2xsZXIudXBsb2FkSW1hZ2UsXG4pO1xuXG5leHBvcnQgY29uc3QgdXBsb2FkUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgdXBsb2FkSW1hZ2VUb0Nsb3VkaW5hcnkgfSBmcm9tIFwiLi91cGxvYWRzLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuLy8gVXBsb2FkIGEgc2luZ2xlIGltYWdlIChBR0VOVC9BRE1JTikgXHUyMTkyIENsb3VkaW5hcnlcbmNvbnN0IHVwbG9hZEltYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgaWYgKCFyZXEuZmlsZSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbWFnZSBmaWxlIGlzIHJlcXVpcmVkXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5KHJlcS5maWxlKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIkltYWdlIHVwbG9hZGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCB1cGxvYWRzQ29udHJvbGxlciA9IHtcbiAgdXBsb2FkSW1hZ2UsXG59OyIsICJpbXBvcnQgeyB2MiBhcyBjbG91ZGluYXJ5IH0gZnJvbSBcImNsb3VkaW5hcnlcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG5jbG91ZGluYXJ5LmNvbmZpZyh7XG4gIGNsb3VkX25hbWU6IGNvbmZpZy5jbG91ZGluYXJ5X2Nsb3VkX25hbWUsXG4gIGFwaV9rZXk6IGNvbmZpZy5jbG91ZGluYXJ5X2FwaV9rZXksXG4gIGFwaV9zZWNyZXQ6IGNvbmZpZy5jbG91ZGluYXJ5X2FwaV9zZWNyZXQsXG59KTtcblxuZXhwb3J0IGRlZmF1bHQgY2xvdWRpbmFyeTsiLCAiaW1wb3J0IGNsb3VkaW5hcnkgZnJvbSBcIi4uLy4uL2xpYi9jbG91ZGluYXJ5XCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuXG5leHBvcnQgY29uc3QgdXBsb2FkSW1hZ2VUb0Nsb3VkaW5hcnkgPSAoXG4gIGZpbGU6IEV4cHJlc3MuTXVsdGVyLkZpbGUsXG4pOiBQcm9taXNlPHsgdXJsOiBzdHJpbmc7IHB1YmxpY0lkOiBzdHJpbmcgfT4gPT4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHVwbG9hZFN0cmVhbSA9IGNsb3VkaW5hcnkudXBsb2FkZXIudXBsb2FkX3N0cmVhbShcbiAgICAgIHsgZm9sZGVyOiBcInRyaXB2ZXJzZVwiIH0sXG4gICAgICAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IgfHwgIXJlc3VsdCkge1xuICAgICAgICAgIHJlamVjdChuZXcgQXBwRXJyb3IoNDAwLCBcIkltYWdlIHVwbG9hZCBmYWlsZWQuIFBsZWFzZSB0cnkgYWdhaW4uXCIpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmVzb2x2ZSh7IHVybDogcmVzdWx0LnNlY3VyZV91cmwsIHB1YmxpY0lkOiByZXN1bHQucHVibGljX2lkIH0pO1xuICAgICAgfSxcbiAgICApO1xuXG4gICAgdXBsb2FkU3RyZWFtLmVuZChmaWxlLmJ1ZmZlcik7XG4gIH0pO1xufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGNvbnRhY3RDb250cm9sbGVyIH0gZnJvbSBcIi4vY29udGFjdC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBjb250YWN0VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9jb250YWN0LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIENyZWF0ZSBjb250YWN0IG1lc3NhZ2Ugcm91dGUgKHB1YmxpYywgbm8gYXV0aClcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogY29udGFjdFZhbGlkYXRpb25zLmNyZWF0ZU1lc3NhZ2VTY2hlbWEgfSksXG4gIGNvbnRhY3RDb250cm9sbGVyLmNyZWF0ZU1lc3NhZ2UsXG4pO1xuXG4vLyAyLiBMaXN0IGNvbnRhY3QgbWVzc2FnZXMgcm91dGUgKGFkbWluIG9ubHkpXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGNvbnRhY3RWYWxpZGF0aW9ucy5jb250YWN0UXVlcnlTY2hlbWEgfSksXG4gIGNvbnRhY3RDb250cm9sbGVyLmdldE1lc3NhZ2VzLFxuKTtcblxuLy8gMy4gTWFyayByZXNvbHZlZC91bnJlc29sdmVkIHJvdXRlIChhZG1pbiBvbmx5KVxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGNvbnRhY3RWYWxpZGF0aW9ucy5jb250YWN0UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGNvbnRhY3RWYWxpZGF0aW9ucy51cGRhdGVSZXNvbHZlZFNjaGVtYSxcbiAgfSksXG4gIGNvbnRhY3RDb250cm9sbGVyLnVwZGF0ZVJlc29sdmVkLFxuKTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBjb250YWN0U2VydmljZSB9IGZyb20gXCIuL2NvbnRhY3Quc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBjb250YWN0IG1lc3NhZ2UgY29udHJvbGxlciAocHVibGljKVxuY29uc3QgY3JlYXRlTWVzc2FnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhd2FpdCBjb250YWN0U2VydmljZS5jcmVhdGVNZXNzYWdlKHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIk1lc3NhZ2Ugc2VudCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBtZXNzYWdlLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIGNvbnRyb2xsZXIgKGFkbWluIG9ubHkpXG5jb25zdCBnZXRNZXNzYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbnRhY3RTZXJ2aWNlLmxpc3RNZXNzYWdlcyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNvbnRhY3QgbWVzc2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBNYXJrIHJlc29sdmVkL3VucmVzb2x2ZWQgY29udHJvbGxlciAoYWRtaW4gb25seSlcbmNvbnN0IHVwZGF0ZVJlc29sdmVkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgeyBpc1Jlc29sdmVkIH0gPSByZXEuYm9keTtcblxuICAgIGNvbnN0IG1lc3NhZ2UgPSBhd2FpdCBjb250YWN0U2VydmljZS5yZXNvbHZlTWVzc2FnZShpZCwgaXNSZXNvbHZlZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiTWVzc2FnZSBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBtZXNzYWdlLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RDb250cm9sbGVyID0ge1xuICBjcmVhdGVNZXNzYWdlLFxuICBnZXRNZXNzYWdlcyxcbiAgdXBkYXRlUmVzb2x2ZWQsXG59OyIsICJpbXBvcnQgeyBSZXNlbmQgfSBmcm9tIFwicmVzZW5kXCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIElDb250YWN0RW1haWxEZXRhaWxzIHtcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICBzdWJqZWN0OiBzdHJpbmc7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgY3JlYXRlZEF0PzogRGF0ZTtcbn1cblxuLy8gTGF6aWx5IGluaXRpYWxpc2VkIHNvIHRoZSBtb2R1bGUgaXMgaW1wb3J0YWJsZSBldmVuIHdoZW4gUkVTRU5EX0FQSV9LRVlcbi8vIGlzIG5vdCBjb25maWd1cmVkIChlLmcuIGxvY2FsIGRldiAvIGRlbW8gd2l0aG91dCBlbWFpbCkuXG5sZXQgcmVzZW5kOiBSZXNlbmQgfCBudWxsID0gbnVsbDtcblxuZnVuY3Rpb24gZ2V0UmVzZW5kKCk6IFJlc2VuZCB8IG51bGwge1xuICBpZiAocmVzZW5kKSByZXR1cm4gcmVzZW5kO1xuICBpZiAoIWNvbmZpZy5yZXNlbmRfYXBpX2tleSkgcmV0dXJuIG51bGw7XG4gIHJlc2VuZCA9IG5ldyBSZXNlbmQoY29uZmlnLnJlc2VuZF9hcGlfa2V5KTtcbiAgcmV0dXJuIHJlc2VuZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZUh0bWwodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcbiAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIilcbiAgICAucmVwbGFjZSgvXCIvZywgXCImcXVvdDtcIilcbiAgICAucmVwbGFjZSgvJy9nLCBcIiYjMDM5O1wiKTtcbn1cblxuLy8gV3JhcHMgYSBSZXNlbmQgc2VuZCBzbyBmYWlsdXJlcyBiZWNvbWUgYSBzaW5nbGUgY2xlYW4gd2FybmluZyBsaW5lIGluc3RlYWRcbi8vIG9mIHRoZSBTREsncyBub2lzeSBtdWx0aS1saW5lIGVycm9yLiBSZXNlbmQgY2FuIGxlZ2l0aW1hdGVseSByZWplY3Qgc2VuZHNcbi8vIChlLmcuIHRoZSBkZWZhdWx0IG9uYm9hcmRpbmdAcmVzZW5kLmRldiBzZW5kZXIgbWF5IG9ubHkgZGVsaXZlciB0byB0aGVcbi8vIGFjY291bnQgb3duZXIpLCBzbyBlbWFpbHMgYXJlIHN0cmljdGx5IGJlc3QtZWZmb3J0LlxuYXN5bmMgZnVuY3Rpb24gc2VuZFdpdGhMb2coXG4gIGNsaWVudDogUmVzZW5kLFxuICBzdWJqZWN0OiBzdHJpbmcsXG4gIHRvOiBzdHJpbmdbXSxcbiAgaHRtbDogc3RyaW5nLFxuICByZXBseVRvPzogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgY2xpZW50LmVtYWlscy5zZW5kKHtcbiAgICAgIGZyb206IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCIsXG4gICAgICB0byxcbiAgICAgIHN1YmplY3QsXG4gICAgICBodG1sLFxuICAgICAgLi4uKHJlcGx5VG8gPyB7IHJlcGx5VG8gfSA6IHt9KSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zdCBkZXRhaWwgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgY29uc29sZS53YXJuKGBbZW1haWxdIHNlbmQgZmFpbGVkICgke3N1YmplY3R9KSB0byAke3RvLmpvaW4oXCIsIFwiKX06ICR7ZGV0YWlsfWApO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBlbWFpbExheW91dCA9IChjb250ZW50OiBzdHJpbmcpID0+IGBcbiAgPGRpdiBzdHlsZT1cImZvbnQtZmFtaWx5OiBBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmOyBtYXgtd2lkdGg6IDU2MHB4OyBtYXJnaW46IDAgYXV0bzsgY29sb3I6ICMxYTFhMWE7XCI+XG4gICAgPGRpdiBzdHlsZT1cImJhY2tncm91bmQ6ICMwZjc2NmU7IHBhZGRpbmc6IDI0cHg7IGJvcmRlci1yYWRpdXM6IDhweCA4cHggMCAwO1wiPlxuICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjogI2ZmZmZmZjsgZm9udC1zaXplOiAxOHB4OyBmb250LXdlaWdodDogYm9sZDtcIj5UcmlwVmVyc2U8L3NwYW4+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBzdHlsZT1cImJvcmRlcjogMXB4IHNvbGlkICNlNWU3ZWI7IGJvcmRlci10b3A6IG5vbmU7IHBhZGRpbmc6IDMycHg7IGJvcmRlci1yYWRpdXM6IDAgMCA4cHggOHB4O1wiPlxuICAgICAgJHtjb250ZW50fVxuICAgIDwvZGl2PlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxMnB4OyBjb2xvcjogIzZiNzI4MDsgbWFyZ2luLXRvcDogMTZweDsgdGV4dC1hbGlnbjogY2VudGVyO1wiPlxuICAgICAgWW91IGFyZSByZWNlaXZpbmcgdGhpcyBlbWFpbCBiZWNhdXNlIG9mIGFjdGl2aXR5IG9uIFRyaXBWZXJzZS5cbiAgICA8L3A+XG4gIDwvZGl2PlxuYDtcblxuLy8gTm90aWZpZXMgdGhlIHN1cHBvcnQgaW5ib3ggYWJvdXQgYSBuZXcgY29udGFjdCBmb3JtIHN1Ym1pc3Npb24uXG5leHBvcnQgY29uc3Qgc2VuZENvbnRhY3ROb3RpZmljYXRpb24gPSBhc3luYyAoXG4gIGRldGFpbHM6IElDb250YWN0RW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhY29uZmlnLmNvbnRhY3RfcmVjZWl2ZXJfZW1haWwpIHtcbiAgICBjb25zb2xlLndhcm4oXCJbZW1haWxdIFJlc2VuZCBub3QgY29uZmlndXJlZDsgc2tpcHBpbmcgY29udGFjdCBub3RpZmljYXRpb24uXCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGNyZWF0ZWRBdCA9IGRldGFpbHMuY3JlYXRlZEF0Py50b0lTT1N0cmluZygpID8/IFwianVzdCBub3dcIjtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5OZXcgY29udGFjdCBtZXNzYWdlPC9oMj5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5OYW1lPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPkVtYWlsPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGRldGFpbHMuZW1haWwpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+U3ViamVjdDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGRldGFpbHMuc3ViamVjdCl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWNlaXZlZDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChjcmVhdGVkQXQpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgIDwvdGFibGU+XG4gICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6IDE2cHg7IHBhZGRpbmc6IDE2cHg7IGJhY2tncm91bmQ6ICNmOWZhZmI7IGJvcmRlci1yYWRpdXM6IDZweDsgd2hpdGUtc3BhY2U6IHByZS13cmFwO1wiPlxuICAgICAgJHtlc2NhcGVIdG1sKGRldGFpbHMubWVzc2FnZSl9XG4gICAgPC9kaXY+XG4gIGA7XG5cbiAgYXdhaXQgc2VuZFdpdGhMb2coXG4gICAgY2xpZW50LFxuICAgIGBOZXcgY29udGFjdCBtZXNzYWdlOiAke2RldGFpbHMuc3ViamVjdH1gLFxuICAgIFtjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbF0sXG4gICAgZW1haWxMYXlvdXQoY29udGVudCksXG4gICk7XG59O1xuXG4vLyBTZW5kcyBhIGNvbmZpcm1hdGlvbiByZXBseSB0byB0aGUgcGVyc29uIHdobyBzdWJtaXR0ZWQgdGhlIGZvcm0uXG5leHBvcnQgY29uc3Qgc2VuZENvbnRhY3RBdXRvUmVwbHkgPSBhc3luYyAoXG4gIGRldGFpbHM6IElDb250YWN0RW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhZGV0YWlscy5lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBjb250YWN0IGF1dG8tcmVwbHkuXCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHJlY2VpdmVyRW1haWwgPSBjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbDtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5UaGFua3MgZm9yIHJlYWNoaW5nIG91dCwgJHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9ITwvaDI+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDE0cHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjMzc0MTUxO1wiPlxuICAgICAgV2UmYXBvczt2ZSByZWNlaXZlZCB5b3VyIG1lc3NhZ2UgYWJvdXRcbiAgICAgIDxzdHJvbmc+JmxkcXVvOyR7ZXNjYXBlSHRtbChkZXRhaWxzLnN1YmplY3QpfSZyZHF1bzs8L3N0cm9uZz4gYW5kIG91ciBzdXBwb3J0XG4gICAgICB0ZWFtIHdpbGwgZ2V0IGJhY2sgdG8geW91IHdpdGhpbiBvbmUgYnVzaW5lc3MgZGF5LlxuICAgIDwvcD5cbiAgYDtcblxuICBhd2FpdCBzZW5kV2l0aExvZyhcbiAgICBjbGllbnQsXG4gICAgXCJXZSByZWNlaXZlZCB5b3VyIG1lc3NhZ2UgLSBUcmlwVmVyc2VcIixcbiAgICBbZGV0YWlscy5lbWFpbF0sXG4gICAgZW1haWxMYXlvdXQoY29udGVudCksXG4gICAgcmVjZWl2ZXJFbWFpbCxcbiAgKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBCb29raW5nIGVtYWlscyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmV4cG9ydCBpbnRlcmZhY2UgSUJvb2tpbmdFbWFpbERldGFpbHMge1xuICBlbWFpbDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHBhY2thZ2VUaXRsZTogc3RyaW5nO1xuICB0cmF2ZWxEYXRlOiBEYXRlO1xuICB0cmF2ZWxlcnM6IG51bWJlcjtcbiAgdG90YWxQcmljZTogbnVtYmVyO1xuICBzdGF0dXM6IEJvb2tpbmdTdGF0dXM7XG59XG5cbi8vIEluZm9ybXMgdGhlIGN1c3RvbWVyIGFib3V0IGEgYm9va2luZyBjcmVhdGUvY29uZmlybS9jYW5jZWwuXG4vLyBCZXN0LWVmZm9ydCBsaWtlIHRoZSBjb250YWN0IGVtYWlscyBcdTIwMTQgYSBmYWlsdXJlIG11c3QgbmV2ZXIgZmFpbCB0aGUgcmVxdWVzdC5cbmV4cG9ydCBjb25zdCBzZW5kQm9va2luZ0VtYWlsID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQm9va2luZ0VtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zdCBjbGllbnQgPSBnZXRSZXNlbmQoKTtcbiAgaWYgKCFjbGllbnQgfHwgIWRldGFpbHMuZW1haWwpIHtcbiAgICBjb25zb2xlLndhcm4oXCJbZW1haWxdIFJlc2VuZCBub3QgY29uZmlndXJlZDsgc2tpcHBpbmcgYm9va2luZyBlbWFpbC5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgdHJhdmVsRGF0ZSA9IGRldGFpbHMudHJhdmVsRGF0ZS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKTtcblxuICBjb25zdCBzdGF0dXNDb3B5OiBSZWNvcmQ8XG4gICAgQm9va2luZ1N0YXR1cyxcbiAgICB7IHN1YmplY3Q6IHN0cmluZzsgaGVhZGluZzogc3RyaW5nOyBib2R5OiBzdHJpbmcgfVxuICA+ID0ge1xuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgcmVjZWl2ZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyByZWNlaXZlZFwiLFxuICAgICAgYm9keTogXCJXZSd2ZSByZWNlaXZlZCB5b3VyIGJvb2tpbmcgcmVxdWVzdC4gVGhlIGFnZW50IHdpbGwgY29uZmlybSBpdCBzaG9ydGx5LlwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuUEFJRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiUGF5bWVudCByZWNlaXZlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJQYXltZW50IHJlY2VpdmVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgcGF5bWVudCBoYXMgYmVlbiByZWNlaXZlZCwgYW5kIHRoZSBhZ2VudCB3aWxsIGNvbmZpcm0geW91ciBib29raW5nIHNob3J0bHkuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgY29uZmlybWVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIkJvb2tpbmcgY29uZmlybWVkXCIsXG4gICAgICBib2R5OiBcIkdyZWF0IG5ld3MgXHUyMDE0IHlvdXIgYm9va2luZyBoYXMgYmVlbiBjb25maXJtZWQuIFdlIGxvb2sgZm9yd2FyZCB0byBob3N0aW5nIHlvdSFcIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyBjYW5jZWxsZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyBjYW5jZWxsZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciBib29raW5nIGhhcyBiZWVuIGNhbmNlbGxlZC4gSWYgdGhpcyB3YXNuJ3QgZXhwZWN0ZWQsIHBsZWFzZSBjb250YWN0IHN1cHBvcnQuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DT01QTEVURURdOiB7XG4gICAgICBzdWJqZWN0OiBcIlRyaXAgY29tcGxldGVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIlRyaXAgY29tcGxldGVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgdHJpcCBoYXMgYmVlbiBtYXJrZWQgYXMgY29tcGxldGVkLiBUaGFuayB5b3UgZm9yIHRyYXZlbGxpbmcgd2l0aCBUcmlwVmVyc2UhXCIsXG4gICAgfSxcbiAgfTtcblxuICBjb25zdCBjb3B5ID0gc3RhdHVzQ29weVtkZXRhaWxzLnN0YXR1c107XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+JHtjb3B5LmhlYWRpbmd9PC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBIaSAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0sPGJyLz5cbiAgICAgICR7Y29weS5ib2R5fVxuICAgIDwvcD5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5QYWNrYWdlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5wYWNrYWdlVGl0bGUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VHJhdmVsIGRhdGU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwodHJhdmVsRGF0ZSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWxlcnM8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoU3RyaW5nKGRldGFpbHMudHJhdmVsZXJzKSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5Ub3RhbDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChkZXRhaWxzLnRvdGFsUHJpY2UudG9GaXhlZCgyKSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgPC90YWJsZT5cbiAgYDtcblxuICBhd2FpdCBzZW5kV2l0aExvZyhcbiAgICBjbGllbnQsXG4gICAgY29weS5zdWJqZWN0LFxuICAgIFtkZXRhaWxzLmVtYWlsXSxcbiAgICBlbWFpbExheW91dChjb250ZW50KSxcbiAgKTtcbn07XG5cbi8vIEluZm9ybXMgdGhlIGN1c3RvbWVyIHRoYXQgYSBwYWlkIGJvb2tpbmcgd2FzIGNhbmNlbGxlZCBhbmQgdGhlIHBheW1lbnQgaGFzXG4vLyBiZWVuIHJlZnVuZGVkLiBCZXN0LWVmZm9ydCBsaWtlIHRoZSBvdGhlciBlbWFpbHMuXG5leHBvcnQgaW50ZXJmYWNlIElSZWZ1bmRFbWFpbERldGFpbHMge1xuICBlbWFpbDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHBhY2thZ2VUaXRsZTogc3RyaW5nO1xuICB0cmF2ZWxEYXRlOiBEYXRlO1xuICBhbW91bnQ6IG51bWJlcjtcbiAgcmVmdW5kUmVmSWQ/OiBzdHJpbmcgfCBudWxsO1xufVxuXG5leHBvcnQgY29uc3Qgc2VuZFJlZnVuZEVtYWlsID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJUmVmdW5kRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhZGV0YWlscy5lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyByZWZ1bmQgZW1haWwuXCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHRyYXZlbERhdGUgPSBkZXRhaWxzLnRyYXZlbERhdGUudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCk7XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+UmVmdW5kIGlzc3VlZDwvaDI+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDE0cHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjMzc0MTUxO1wiPlxuICAgICAgSGkgJHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9LDxici8+XG4gICAgICBZb3VyIGJvb2tpbmcgd2FzIGNhbmNlbGxlZCwgYW5kIDxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChcbiAgICAgICAgZGV0YWlscy5hbW91bnQudG9GaXhlZCgyKSxcbiAgICAgICl9PC9zdHJvbmc+IGhhcyBiZWVuIHJlZnVuZGVkIHRvIHlvdXIgb3JpZ2luYWwgcGF5bWVudCBtZXRob2QuIFBsZWFzZSBhbGxvd1xuICAgICAgNS0xMCBidXNpbmVzcyBkYXlzIGZvciB0aGUgbW9uZXkgdG8gYXBwZWFyLlxuICAgIDwvcD5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5QYWNrYWdlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5wYWNrYWdlVGl0bGUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VHJhdmVsIGRhdGU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwodHJhdmVsRGF0ZSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWZ1bmRlZCBhbW91bnQ8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiYjMjU0Nzske2VzY2FwZUh0bWwoZGV0YWlscy5hbW91bnQudG9GaXhlZCgyKSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICAke2RldGFpbHMucmVmdW5kUmVmSWRcbiAgICAgICAgPyBgXG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWZ1bmQgcmVmZXJlbmNlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGRldGFpbHMucmVmdW5kUmVmSWQpfTwvdGQ+XG4gICAgICA8L3RyPmBcbiAgICAgICAgOiBcIlwifVxuICAgIDwvdGFibGU+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDEzcHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjNmI3MjgwOyBtYXJnaW4tdG9wOiAxNnB4O1wiPlxuICAgICAgSWYgeW91IGhhdmUgYW55IHF1ZXN0aW9ucyBhYm91dCB0aGlzIHJlZnVuZCwgcGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cbiAgICA8L3A+XG4gIGA7XG5cbiAgYXdhaXQgc2VuZFdpdGhMb2coXG4gICAgY2xpZW50LFxuICAgIFwiQm9va2luZyBjYW5jZWxsZWQgJiByZWZ1bmQgaXNzdWVkIC0gVHJpcFZlcnNlXCIsXG4gICAgW2RldGFpbHMuZW1haWxdLFxuICAgIGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICApO1xufTsiLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHtcbiAgc2VuZENvbnRhY3RBdXRvUmVwbHksXG4gIHNlbmRDb250YWN0Tm90aWZpY2F0aW9uLFxufSBmcm9tIFwiLi4vLi4vdXRpbHMvZW1haWxcIjtcbmltcG9ydCB7IElDb250YWN0UXVlcnksIElDcmVhdGVDb250YWN0UGF5bG9hZCB9IGZyb20gXCIuL2NvbnRhY3QuaW50ZXJmYWNlXCI7XG5cbi8vIDEuIENyZWF0ZSBjb250YWN0IG1lc3NhZ2UgKHB1YmxpYylcbmNvbnN0IGNyZWF0ZU1lc3NhZ2UgPSBhc3luYyAocGF5bG9hZDogSUNyZWF0ZUNvbnRhY3RQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IGNyZWF0ZWRNZXNzYWdlID0gYXdhaXQgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgbmFtZTogcGF5bG9hZC5uYW1lLFxuICAgICAgZW1haWw6IHBheWxvYWQuZW1haWwsXG4gICAgICBzdWJqZWN0OiBwYXlsb2FkLnN1YmplY3QsXG4gICAgICBtZXNzYWdlOiBwYXlsb2FkLm1lc3NhZ2UsXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gRW1haWxzIGFyZSBiZXN0LWVmZm9ydDogYSBmYWlsdXJlIGhlcmUgbXVzdCBuZXZlciBmYWlsIHRoZSBzdWJtaXNzaW9uXG4gIC8vICh0aGUgbWVzc2FnZSBpcyBhbHJlYWR5IHNhdmVkIHRvIHRoZSBpbmJveCkuXG4gIGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZENvbnRhY3ROb3RpZmljYXRpb24oeyAuLi5jcmVhdGVkTWVzc2FnZSwgY3JlYXRlZEF0OiBjcmVhdGVkTWVzc2FnZS5jcmVhdGVkQXQgfSksXG4gICAgc2VuZENvbnRhY3RBdXRvUmVwbHkoeyAuLi5jcmVhdGVkTWVzc2FnZSwgY3JlYXRlZEF0OiBjcmVhdGVkTWVzc2FnZS5jcmVhdGVkQXQgfSksXG4gIF0pO1xuXG4gIHJldHVybiBjcmVhdGVkTWVzc2FnZTtcbn07XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyAoYWRtaW4gb25seSwgcGFnaW5hdGVkLCBmaWx0ZXJhYmxlIGJ5IGlzUmVzb2x2ZWQpXG5jb25zdCBsaXN0TWVzc2FnZXMgPSBhc3luYyAocXVlcnk6IElDb250YWN0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkNvbnRhY3RNZXNzYWdlV2hlcmVJbnB1dCB8IHVuZGVmaW5lZCA9XG4gICAgcXVlcnkuaXNSZXNvbHZlZCA9PT0gdW5kZWZpbmVkXG4gICAgICA/IHVuZGVmaW5lZFxuICAgICAgOiB7IGlzUmVzb2x2ZWQ6IHF1ZXJ5LmlzUmVzb2x2ZWQgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5jb250YWN0TWVzc2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5jb250YWN0TWVzc2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIDMuIE1hcmsgYSBjb250YWN0IG1lc3NhZ2UgcmVzb2x2ZWQvdW5yZXNvbHZlZCAoYWRtaW4gb25seSlcbmNvbnN0IHJlc29sdmVNZXNzYWdlID0gYXN5bmMgKGlkOiBzdHJpbmcsIGlzUmVzb2x2ZWQ6IGJvb2xlYW4pID0+IHtcbiAgcmV0dXJuIHByaXNtYS5jb250YWN0TWVzc2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YTogeyBpc1Jlc29sdmVkIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RTZXJ2aWNlID0ge1xuICBjcmVhdGVNZXNzYWdlLFxuICBsaXN0TWVzc2FnZXMsXG4gIHJlc29sdmVNZXNzYWdlLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlTWVzc2FnZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgbmFtZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOYW1lIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKSxcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsIGFkZHJlc3NcIiksXG4gIHN1YmplY3Q6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiU3ViamVjdCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMiwgXCJTdWJqZWN0IG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgyMDAsIFwiU3ViamVjdCBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIiksXG4gIG1lc3NhZ2U6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTWVzc2FnZSBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMTAsIFwiTWVzc2FnZSBtdXN0IGJlIGF0IGxlYXN0IDEwIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDIwMDAsIFwiTWVzc2FnZSBtdXN0IGJlIGF0IG1vc3QgMjAwMCBjaGFyYWN0ZXJzXCIpLFxufSkuc3RyaWN0KCk7XG5cbmNvbnN0IGNvbnRhY3RRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgaXNSZXNvbHZlZDogelxuICAgIC5lbnVtKFtcInRydWVcIiwgXCJmYWxzZVwiXSlcbiAgICAub3B0aW9uYWwoKVxuICAgIC50cmFuc2Zvcm0oKHZhbCkgPT4gKHZhbCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogdmFsID09PSBcInRydWVcIikpLFxufSk7XG5cbmNvbnN0IGNvbnRhY3RQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk1lc3NhZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgdXBkYXRlUmVzb2x2ZWRTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIGlzUmVzb2x2ZWQ6IHouYm9vbGVhbih7XG4gICAgICByZXF1aXJlZF9lcnJvcjogXCJpc1Jlc29sdmVkIGlzIHJlcXVpcmVkXCIsXG4gICAgICBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiaXNSZXNvbHZlZCBtdXN0IGJlIGEgYm9vbGVhblwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KClcbiAgLnJlZmluZSgoZGF0YSkgPT4gdHlwZW9mIGRhdGEuaXNSZXNvbHZlZCA9PT0gXCJib29sZWFuXCIsIHtcbiAgICBtZXNzYWdlOiBcImlzUmVzb2x2ZWQgbXVzdCBiZSBhIGJvb2xlYW5cIixcbiAgfSk7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZU1lc3NhZ2VTY2hlbWEsXG4gIGNvbnRhY3RRdWVyeVNjaGVtYSxcbiAgY29udGFjdFBhcmFtc1NjaGVtYSxcbiAgdXBkYXRlUmVzb2x2ZWRTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgYm9va2luZ0NvbnRyb2xsZXIgfSBmcm9tIFwiLi9ib29raW5nLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGJvb2tpbmdWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2Jvb2tpbmcudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gQ3JlYXRlIGJvb2tpbmcgKGN1c3RvbWVyIG9ubHkgXHUyMDE0IGFnZW50cyBzZWxsLCBhZG1pbnMgbWFuYWdlKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGJvb2tpbmdWYWxpZGF0aW9ucy5jcmVhdGVTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmNyZWF0ZUJvb2tpbmcsXG4pO1xuXG4vLyBNeSBib29raW5ncyBcdTIwMTQgb3duIGJvb2tpbmdzIHdpdGggZmlsdGVycyArIHBhZ2luYXRpb24gKG93bmVyIGlzIGFsd2F5cyBVU0VSKVxuLy8gTk9URTogcmVnaXN0ZXJlZCBiZWZvcmUgXCIvOmlkXCIgc28gdGhlIHBhcmFtIHJvdXRlIGRvZXNuJ3Qgc3dhbGxvdyBpdC5cbnJvdXRlci5nZXQoXG4gIFwiL215LWJvb2tpbmdzXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUXVlcnlTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmdldE15Qm9va2luZ3MsXG4pO1xuXG4vLyBBZ2VudCBib29raW5ncyBcdTIwMTQgc2NvcGVkIHRvIHBhY2thZ2VzIHRoZSBhZ2VudCBvd25zXG5yb3V0ZXIuZ2V0KFxuICBcIi9hZ2VudC1ib29raW5nc1wiLFxuICBhdXRoKFJvbGUuQUdFTlQpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0QWdlbnRCb29raW5ncyxcbik7XG5cbi8vIEJvb2tpbmcgZGV0YWlsIFx1MjAxNCBvd25lciAvIHBhY2thZ2UgYWdlbnQgLyBhZG1pblxucm91dGVyLmdldChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1BhcmFtc1NjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0Qm9va2luZ0RldGFpbCxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBhbGwgYm9va2luZ3NcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0QWxsQm9va2luZ3MsXG4pO1xuXG4vLyBTdGF0dXMgdHJhbnNpdGlvbiBcdTIwMTQgdmFsaWRhdGVkIGFnYWluc3QgdGhlIHN0YXRlIG1hY2hpbmUgaW4gdGhlIHNlcnZpY2VcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1BhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBib29raW5nVmFsaWRhdGlvbnMudXBkYXRlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIudXBkYXRlQm9va2luZ1N0YXR1cyxcbik7XG5cbmV4cG9ydCBjb25zdCBib29raW5nUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgYm9va2luZ1NlcnZpY2UgfSBmcm9tIFwiLi9ib29raW5nLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG5jb25zdCBjcmVhdGVCb29raW5nID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS5jcmVhdGVCb29raW5nKHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZyBjcmVhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGJvb2tpbmcsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRNeUJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldE15Qm9va2luZ3ModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0QWdlbnRCb29raW5ncyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBib29raW5nU2VydmljZS5nZXRBZ2VudEJvb2tpbmdzKHVzZXJJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldEJvb2tpbmdEZXRhaWwgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS5nZXRCb29raW5nRGV0YWlsKGlkLCByZXEudXNlciEpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmcgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGJvb2tpbmcsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRBbGxCb29raW5ncyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEFsbEJvb2tpbmdzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCB1cGRhdGVCb29raW5nU3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBjb25zdCBib29raW5nID0gYXdhaXQgYm9va2luZ1NlcnZpY2UudXBkYXRlQm9va2luZ1N0YXR1cyhcbiAgICAgIGlkLFxuICAgICAgcmVxLmJvZHksXG4gICAgICByZXEudXNlciEsXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5nIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGJvb2tpbmcsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYm9va2luZ0NvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZUJvb2tpbmcsXG4gIGdldE15Qm9va2luZ3MsXG4gIGdldEFnZW50Qm9va2luZ3MsXG4gIGdldEJvb2tpbmdEZXRhaWwsXG4gIGdldEFsbEJvb2tpbmdzLFxuICB1cGRhdGVCb29raW5nU3RhdHVzLFxufTsiLCAiaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuXG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWcvaW5kZXhcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbi8vIFBheW1lbnQgaXMgYW4gb3B0aW9uYWwgZmVhdHVyZTogdGhlIEFQSSBtdXN0IGJvb3QgYW5kIHNlcnZlIGV2ZXJ5dGhpbmcgZWxzZVxuLy8gZXZlbiB3aGVuIHRoZSBTU0xDb21tZXJ6IHN0b3JlIGlzbid0IGNvbmZpZ3VyZWQgeWV0LiBUaGVzZSB0aHJvdyBhIGNsZWFuIDQwMFxuLy8gb24gdGhlIHBheW1lbnQtb25seSBwYXRocyByYXRoZXIgdGhhbiBjcmFzaCB0aGUgd2hvbGUgZGVwbG95bWVudCBhdCBib290LlxuY29uc3QgcmVxdWlyZUNvbmZpZyA9ICgpID0+IHtcbiAgaWYgKCFjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfaWQgfHwgIWNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9wYXNzd29yZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiU1NMQ29tbWVyeiBpcyBub3QgY29uZmlndXJlZC4gU2V0IFNTTF9DT01NRVJaX1NUT1JFX0lEIGFuZCBTU0xfQ09NTUVSWl9TVE9SRV9QQVNTV09SRC5cIixcbiAgICApO1xuICB9XG4gIGlmICghY29uZmlnLmJhY2tlbmRfcHVibGljX3VybCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiU1NMQ29tbWVyeiBpcyBub3QgY29uZmlndXJlZC4gU2V0IEJBQ0tFTkRfUFVCTElDX1VSTCB0byB0aGUgcHVibGljbHkgcmVhY2hhYmxlIGJhY2tlbmQgVVJMLlwiLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBzdG9yZUlkOiBjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfaWQsXG4gICAgc3RvcmVQYXNzd29yZDogY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkLFxuICB9O1xufTtcblxuZXhwb3J0IGludGVyZmFjZSBTc2xjb21tZXJ6SW5pdFJlc3VsdCB7XG4gIHN0YXR1czogc3RyaW5nO1xuICBmYWlsZWRyZWFzb24/OiBzdHJpbmc7XG4gIHNlc3Npb25rZXk/OiBzdHJpbmc7XG4gIEdhdGV3YXlQYWdlVVJMPzogc3RyaW5nO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQge1xuICBzdGF0dXM6IHN0cmluZztcbiAgZXJyb3I/OiBzdHJpbmc7XG4gIHZhbF9pZD86IHN0cmluZztcbiAgYW1vdW50Pzogc3RyaW5nO1xuICBjdXJyZW5jeT86IHN0cmluZztcbiAgYmFua190cmFuX2lkPzogc3RyaW5nO1xuICBjYXJkX3R5cGU/OiBzdHJpbmc7XG4gIFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTc2xjb21tZXJ6UmVmdW5kUmVzdWx0IHtcbiAgQVBJQ29ubmVjdD86IHN0cmluZztcbiAgc3RhdHVzPzogc3RyaW5nOyAvLyBzdWNjZXNzIHwgZmFpbGVkIHwgcHJvY2Vzc2luZ1xuICBlcnJvclJlYXNvbj86IHN0cmluZztcbiAgcmVmdW5kX3JlZl9pZD86IHN0cmluZztcbiAgYmFua190cmFuX2lkPzogc3RyaW5nO1xuICB0cmFuc19pZD86IHN0cmluZztcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG4vLyBTU0xDb21tZXJ6IHRydW5jYXRlcyB0cmFuX2lkIHRvIDMwIGNoYXJzIFx1MjAxNCBkYXRlICsgdGltZSArIHJhbmRvbSBzYWx0IHN0YXlzIHNhZmVseSB1bmRlci5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZVRyYW5JZCgpOiBzdHJpbmcge1xuICByZXR1cm4gYFRSTlhfSUQtJHtEYXRlLm5vdygpfS0ke3JhbmRvbVVVSUQoKS5yZXBsYWNlKC8tL2csIFwiXCIpLnNsaWNlKDAsIDgpfWA7XG59XG5cbi8vIFVuaXF1ZSByZWZ1bmQgdHJhbnNhY3Rpb24gaWQgKG1hbmRhdG9yeSBieSB0aGUgcmVmdW5kIEFQSSBzaW5jZSAyNC8wMi8yMDI1LFxuLy8gbWF4IDMwIGNoYXJzKSBcdTIwMTQgYSBmcmVzaCBvbmUgcGVyIHJlZnVuZCBhdHRlbXB0IHNvIHRoZSBnYXRld2F5IG5ldmVyIHJlamVjdHMgYVxuLy8gZHVwbGljYXRlLlxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlUmVmdW5kVHJhbklkKCk6IHN0cmluZyB7XG4gIHJldHVybiBgUkZELSR7RGF0ZS5ub3coKX0tJHtyYW5kb21VVUlEKCkucmVwbGFjZSgvLS9nLCBcIlwiKS5zbGljZSgwLCA4KX1gO1xufVxuXG4vLyBJbml0aWF0ZXMgYSBnYXRld2F5IHNlc3Npb24uIFNlcnZlci10by1zZXJ2ZXIgUE9TVCwgZm9ybS1lbmNvZGVkLiBUaGUgZ2F0ZXdheVxuLy8gcmVzcG9uZHMgd2l0aCB0aGUgaG9zdGVkIGNoZWNrb3V0IFVSTCAoR2F0ZXdheVBhZ2VVUkwpIHRoZSBjdXN0b21lciBpcyBzZW50IHRvLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpJbml0KG9wdGlvbnM6IHtcbiAgdG90YWxfYW1vdW50OiBudW1iZXI7XG4gIHRyYW5faWQ6IHN0cmluZztcbiAgc3VjY2Vzc191cmw6IHN0cmluZztcbiAgZmFpbF91cmw6IHN0cmluZztcbiAgY2FuY2VsX3VybDogc3RyaW5nO1xuICBpcG5fdXJsOiBzdHJpbmc7XG4gIGN1c19uYW1lOiBzdHJpbmc7XG4gIGN1c19lbWFpbDogc3RyaW5nO1xuICBjdXNfcGhvbmU6IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpJbml0UmVzdWx0PiB7XG4gIGNvbnN0IHsgc3RvcmVJZCwgc3RvcmVQYXNzd29yZCB9ID0gcmVxdWlyZUNvbmZpZygpO1xuICBjb25zdCBib2R5ID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIHRvdGFsX2Ftb3VudDogb3B0aW9ucy50b3RhbF9hbW91bnQudG9GaXhlZCgyKSxcbiAgICBjdXJyZW5jeTogXCJCRFRcIixcbiAgICB0cmFuX2lkOiBvcHRpb25zLnRyYW5faWQsXG4gICAgc3VjY2Vzc191cmw6IG9wdGlvbnMuc3VjY2Vzc191cmwsXG4gICAgZmFpbF91cmw6IG9wdGlvbnMuZmFpbF91cmwsXG4gICAgY2FuY2VsX3VybDogb3B0aW9ucy5jYW5jZWxfdXJsLFxuICAgIGlwbl91cmw6IG9wdGlvbnMuaXBuX3VybCxcbiAgICBjdXNfbmFtZTogb3B0aW9ucy5jdXNfbmFtZSxcbiAgICBjdXNfZW1haWw6IG9wdGlvbnMuY3VzX2VtYWlsLFxuICAgIGN1c19hZGQxOiBcIk4vQVwiLFxuICAgIGN1c19hZGQyOiBcIk4vQVwiLFxuICAgIGN1c19jaXR5OiBcIk4vQVwiLFxuICAgIGN1c19zdGF0ZTogXCJOL0FcIixcbiAgICBjdXNfcG9zdGNvZGU6IFwiMTAwMFwiLFxuICAgIGN1c19jb3VudHJ5OiBcIkJhbmdsYWRlc2hcIixcbiAgICBjdXNfcGhvbmU6IG9wdGlvbnMuY3VzX3Bob25lLFxuICAgIHByb2R1Y3RfbmFtZTogXCJUcmlwVmVyc2UgVG91ciBCb29raW5nXCIsXG4gICAgc2hpcHBpbmdfbWV0aG9kOiBcIk5PXCIsXG4gIH0pO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGNvbmZpZy5zc2xjb21tZXJ6X2luaXRfdXJsLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCIgfSxcbiAgICBib2R5OiBib2R5LnRvU3RyaW5nKCksXG4gIH0pO1xuXG4gIGNvbnN0IHRleHQgPSBhd2FpdCByZXMudGV4dCgpO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgYFNTTENvbW1lcnogaW5pdCBmYWlsZWQgKCR7cmVzLnN0YXR1c30pYCk7XG5cbiAgbGV0IGRhdGE6IFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB0cnkge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKHRleHQpIGFzIFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBcIlNTTENvbW1lcnogaW5pdCByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlXCIpO1xuICB9XG5cbiAgLy8gVGhlIGdhdGV3YXkgcmVwb3J0cyBzdGF0dXMgaW4gVVBQRVJDQVNFIChcIlNVQ0NFU1NcIiAvIFwiRkFJTEVEXCIpOyBhbnkgb3RoZXJcbiAgLy8gc3RhdHVzLCBvciBhIHN1Y2Nlc3Mgd2l0aG91dCB0aGUgaG9zdGVkIGNoZWNrb3V0IFVSTCwgaXMgYSBmYWlsZWQgaW5pdC5cbiAgaWYgKGRhdGEuc3RhdHVzICE9PSBcIlNVQ0NFU1NcIiB8fCAhZGF0YS5HYXRld2F5UGFnZVVSTCkge1xuICAgIGNvbnN0IHJlYXNvbiA9IGRhdGEuZmFpbGVkcmVhc29uIHx8IGRhdGEuc3RhdHVzIHx8IFwidW5rbm93blwiO1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBgW3NzbGNvbW1lcnpdIGluaXQgcmVqZWN0ZWQgKHVybD0ke2NvbmZpZy5zc2xjb21tZXJ6X2luaXRfdXJsfSwgc2FuZGJveD0ke2NvbmZpZy5zc2xfY29tbWVyel9zYW5kYm94fSk6ICR7cmVhc29ufWAsXG4gICAgICBkYXRhLFxuICAgICk7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNTAyLFxuICAgICAgYFNTTENvbW1lcnogaW5pdCByZWplY3RlZDogJHtyZWFzb259LiBDaGVjayBTU0xfQ09NTUVSWl9TVE9SRV9JRCwgU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQsIFNTTF9DT01NRVJaX1NBTkRCT1ggYW5kIFNTTENPTU1FUlpfSU5JVF9VUkwgKHNlZSBzZXJ2ZXIgbG9ncykuYCxcbiAgICApO1xuICB9XG4gIHJldHVybiBkYXRhO1xufVxuXG4vLyBTZXJ2ZXItc2lkZSB2ZXJpZmljYXRpb24gb2YgYSBjb21wbGV0ZWQgdHJhbnNhY3Rpb24uIHN0YXR1czogVkFMSUQgLyBWQUxJREFURUQgL1xuLy8gSU5WQUxJRF9UUkFOU0FDVElPTiAvIEZBSUxFRC4gVkFMSURBVEVEIG1lYW5zIHRoZSB0cmFuc2FjdGlvbiB3YXMgdmVyaWZpZWQgYmVmb3JlXG4vLyAoaWRlbXBvdGVudCksIElOVkFMSURfVFJBTlNBQ1RJT04gbWVhbnMgdGhlIGFtb3VudC90cmFuc2FjdGlvbiBtaXNtYXRjaGVzLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpWYWxpZGF0ZShvcHRpb25zOiB7XG4gIHZhbF9pZDogc3RyaW5nO1xufSk6IFByb21pc2U8U3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ+IHtcbiAgY29uc3QgeyBzdG9yZUlkLCBzdG9yZVBhc3N3b3JkIH0gPSByZXF1aXJlQ29uZmlnKCk7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHZhbF9pZDogb3B0aW9ucy52YWxfaWQsXG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIGZvcm1hdDogXCJqc29uXCIsXG4gIH0pO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2NvbmZpZy5zc2xjb21tZXJ6X3ZhbGlkYXRlX3VybH0/JHtwYXJhbXMudG9TdHJpbmcoKX1gLCB7XG4gICAgbWV0aG9kOiBcIkdFVFwiLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IHZhbGlkYXRpb24gZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IHZhbGlkYXRpb24gcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn1cblxuLy8gSW5pdGlhdGVzIGEgcmVmdW5kIGFnYWluc3QgYSBzZXR0bGVkIHRyYW5zYWN0aW9uIChSZWZ1bmQgQVBJLCB2NCBkb2NzKS4gVGhlXG4vLyB0cmFuc2FjdGlvbiBpcyByZXNvbHZlZCBieSBgYmFua190cmFuX2lkYCAoY2FwdHVyZWQgZnJvbSB0aGUgZ2F0ZXdheSBhdFxuLy8gcGF5bWVudCB0aW1lKS4gYHJlZnVuZF90cmFuc19pZGAgaXMgYSBtYW5kYXRvcnksIHVuaXF1ZS1wZXItYXR0ZW1wdCBpZC5cbi8vIHN0YXR1czogc3VjY2VzcyAoaW5pdGlhdGVkKSB8IGZhaWxlZCB8IHByb2Nlc3NpbmcgKGFscmVhZHkgaW5pdGlhdGVkKS5cbi8vIEJvdW5kZWQgdG8gOHMgc28gYSBodW5nIGdhdGV3YXkgY2FuJ3QgaG9sZCB0aGUgY2FuY2VsbGluZyByZXF1ZXN0LlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpSZWZ1bmQob3B0aW9uczoge1xuICBiYW5rX3RyYW5faWQ6IHN0cmluZztcbiAgcmVmdW5kX3RyYW5zX2lkPzogc3RyaW5nO1xuICByZWZ1bmRfYW1vdW50OiBudW1iZXI7XG4gIHJlZnVuZF9yZW1hcmtzOiBzdHJpbmc7XG4gIHJlZmVfaWQ/OiBzdHJpbmc7XG59KTogUHJvbWlzZTxTc2xjb21tZXJ6UmVmdW5kUmVzdWx0PiB7XG4gIGNvbnN0IHsgc3RvcmVJZCwgc3RvcmVQYXNzd29yZCB9ID0gcmVxdWlyZUNvbmZpZygpO1xuICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICBiYW5rX3RyYW5faWQ6IG9wdGlvbnMuYmFua190cmFuX2lkLFxuICAgIHJlZnVuZF90cmFuc19pZDogb3B0aW9ucy5yZWZ1bmRfdHJhbnNfaWQgPz8gZ2VuZXJhdGVSZWZ1bmRUcmFuSWQoKSxcbiAgICBzdG9yZV9pZDogc3RvcmVJZCxcbiAgICBzdG9yZV9wYXNzd2Q6IHN0b3JlUGFzc3dvcmQsXG4gICAgcmVmdW5kX2Ftb3VudDogb3B0aW9ucy5yZWZ1bmRfYW1vdW50LnRvRml4ZWQoMiksXG4gICAgcmVmdW5kX3JlbWFya3M6IG9wdGlvbnMucmVmdW5kX3JlbWFya3MsXG4gICAgZm9ybWF0OiBcImpzb25cIixcbiAgICB2OiBcIjFcIixcbiAgfSk7XG4gIGlmIChvcHRpb25zLnJlZmVfaWQpIHBhcmFtcy5zZXQoXCJyZWZlX2lkXCIsIG9wdGlvbnMucmVmZV9pZCk7XG5cbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goXG4gICAgYCR7Y29uZmlnLnNzbGNvbW1lcnpfcmVmdW5kX3VybH0/JHtwYXJhbXMudG9TdHJpbmcoKX1gLFxuICAgIHsgbWV0aG9kOiBcIkdFVFwiLCBzaWduYWw6IEFib3J0U2lnbmFsLnRpbWVvdXQoODAwMCkgfSxcbiAgKTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IHJlZnVuZCBmYWlsZWQgKCR7cmVzLnN0YXR1c30pYCk7XG5cbiAgbGV0IGRhdGE6IFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ7XG4gIHRyeSB7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UodGV4dCkgYXMgU3NsY29tbWVyelJlZnVuZFJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IHJlZnVuZCByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlXCIpO1xuICB9XG5cbiAgaWYgKGRhdGEuQVBJQ29ubmVjdCAhPT0gXCJET05FXCIgfHwgZGF0YS5zdGF0dXMgPT09IFwiZmFpbGVkXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA1MDIsXG4gICAgICBgU1NMQ29tbWVyeiByZWZ1bmQgcmVqZWN0ZWQ6ICR7ZGF0YS5lcnJvclJlYXNvbiA/PyBkYXRhLkFQSUNvbm5lY3QgPz8gZGF0YS5zdGF0dXMgPz8gXCJ1bmtub3duXCJ9YCxcbiAgICApO1xuICB9XG4gIHJldHVybiBkYXRhO1xufSIsICJpbXBvcnQgeyBOb3RpZmljYXRpb25UeXBlIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi9saWIvcHJpc21hXCI7XG5cbi8vIEJlc3QtZWZmb3J0IGluLWFwcCBub3RpZmljYXRpb24gXHUyMDE0IG1pcnJvcnMgdGhlIGVtYWlsIGhlbHBlcnMuIEEgZmFpbHVyZSBpc1xuLy8gbG9nZ2VkIGFuZCBzd2FsbG93ZWQsIG5ldmVyIHRocm93biwgc28gYSBub3RpZmljYXRpb24gaW5zZXJ0IGNhbid0IGZhaWwgdGhlXG4vLyBidXNpbmVzcyB3cml0ZSB0aGF0IGNhdXNlZCBpdC4gQ2FsbCBzaXRlcyBmaXJlIGl0IGFzXG4vLyBgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW25vdGlmeSguLi4pXSlgLlxuZXhwb3J0IGNvbnN0IG5vdGlmeSA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHR5cGU6IE5vdGlmaWNhdGlvblR5cGUsXG4gIHRpdGxlOiBzdHJpbmcsXG4gIG1lc3NhZ2U6IHN0cmluZyxcbiAgbGluaz86IHN0cmluZyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICB0cnkge1xuICAgIGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24uY3JlYXRlKHtcbiAgICAgIGRhdGE6IHsgdXNlcklkLCB0eXBlLCB0aXRsZSwgbWVzc2FnZSwgbGluayB9LFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBgW25vdGlmaWNhdGlvbl0gZmFpbGVkIHRvIGNyZWF0ZSAke3R5cGV9IGZvciB1c2VyICR7dXNlcklkfTogJHtcbiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpXG4gICAgICB9YCxcbiAgICApO1xuICB9XG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMsIE5vdGlmaWNhdGlvblR5cGUsIFBhY2thZ2VTdGF0dXMsIFBheW1lbnRTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzc2xjb21tZXJ6UmVmdW5kIH0gZnJvbSBcIi4uLy4uL2xpYi9zc2xjb21tZXJ6XCI7XG5pbXBvcnQgeyBzZW5kQm9va2luZ0VtYWlsLCBzZW5kUmVmdW5kRW1haWwgfSBmcm9tIFwiLi4vLi4vdXRpbHMvZW1haWxcIjtcbmltcG9ydCB7IG5vdGlmeSB9IGZyb20gXCIuLi8uLi91dGlscy9ub3RpZmljYXRpb25cIjtcbmltcG9ydCB7XG4gIElCb29raW5nUXVlcnksXG4gIElCb29raW5nU2VhcmNoUXVlcnksXG4gIElDcmVhdGVCb29raW5nLFxuICBJUmVmdW5kT3V0Y29tZSxcbiAgSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59IGZyb20gXCIuL2Jvb2tpbmcuaW50ZXJmYWNlXCI7XG5cbi8vIEEgUEVORElORyBib29raW5nIG9sZGVyIHRoYW4gdGhpcyBpcyB0cmVhdGVkIGFzIGFuIGFiYW5kb25lZCBjaGVja291dDpcbi8vIGl0J3MgYXV0by1jYW5jZWxsZWQgc28gdGhlIHVzZXIgY2FuIHJlYm9vayB0aGUgc2FtZSBwYWNrYWdlK2RhdGUuXG5jb25zdCBTVEFMRV9CT09LSU5HX0hPVVJTID0gMjQ7XG5cbmNvbnN0IHRvVVRDTWlkbmlnaHQgPSAoZGF0ZTogRGF0ZSkgPT5cbiAgbmV3IERhdGUoXG4gICAgRGF0ZS5VVEMoZGF0ZS5nZXRVVENGdWxsWWVhcigpLCBkYXRlLmdldFVUQ01vbnRoKCksIGRhdGUuZ2V0VVRDRGF0ZSgpKSxcbiAgKTtcblxuLy8gXHUyNTAwXHUyNTAwIEFjdG9yICsgb3duZXJzaGlwIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxudHlwZSBCb29raW5nQWN0b3IgPSB7IGlkOiBzdHJpbmc7IHJvbGU6IFJvbGUgfTtcblxuLy8gU3RydWN0dXJhbCBzdWJzZXQgXHUyMDE0IG9ubHkgd2hhdCB0aGUgb3duZXJzaGlwIGNoZWNrcyBuZWVkLlxudHlwZSBCb29raW5nT3duZXJJbmZvID0ge1xuICB1c2VySWQ6IHN0cmluZztcbiAgcGFja2FnZTogeyBhZ2VudElkOiBzdHJpbmcgfTtcbn07XG5cbi8vIEJvb2tpbmcgb3duZXIsIHRoZSBBR0VOVCB3aG8gb3ducyB0aGUgcGFja2FnZSwgb3IgQURNSU4gXHUyMDE0IGZ1bGwgbWFuYWdlIHNjb3BlLlxuY29uc3QgY2FuTWFuYWdlID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGJvb2tpbmcudXNlcklkID09PSBhY3Rvci5pZCB8fFxuICAoYWN0b3Iucm9sZSA9PT0gUm9sZS5BR0VOVCAmJiBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWQpIHx8XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU47XG5cbi8vIE9ubHkgdGhlIHBhY2thZ2Utb3duaW5nIEFHRU5UIG9yIEFETUlOIGNhbiBtb3ZlIGEgYm9va2luZydzIG1vbmV5IHN0YXR1c1xuLy8gKFBFTkRJTkdcdTIxOTJDT05GSVJNRUQsIENPTkZJUk1FRFx1MjE5MkNPTVBMRVRFRCwgQ09ORklSTUVEXHUyMTkyUEVORElORykuXG5jb25zdCBpc0FnZW50T3duZXJPckFkbWluID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU4gfHxcbiAgKGFjdG9yLnJvbGUgPT09IFJvbGUuQUdFTlQgJiYgYm9va2luZy5wYWNrYWdlLmFnZW50SWQgPT09IGFjdG9yLmlkKTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXRlIG1hY2hpbmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG50eXBlIFRyYW5zaXRpb25SdWxlID0ge1xuICBhbGxvd2VkOiAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT4gYm9vbGVhbjtcbiAgcmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkPzogYm9vbGVhbjtcbiAgYmVmb3JlVHJhdmVsRGF0ZT86IGJvb2xlYW47XG59O1xuXG5jb25zdCBUUkFOU0lUSU9OUzogUGFydGlhbDxcbiAgUmVjb3JkPEJvb2tpbmdTdGF0dXMsIFBhcnRpYWw8UmVjb3JkPEJvb2tpbmdTdGF0dXMsIFRyYW5zaXRpb25SdWxlPj4+XG4+ID0ge1xuICBbQm9va2luZ1N0YXR1cy5QRU5ESU5HXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHsgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbiB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHsgYWxsb3dlZDogY2FuTWFuYWdlIH0sXG4gIH0sXG4gIFtCb29raW5nU3RhdHVzLlBBSURdOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXTogeyBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXTogeyBhbGxvd2VkOiBjYW5NYW5hZ2UgfSxcbiAgfSxcbiAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTVBMRVRFRF06IHtcbiAgICAgIGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4sXG4gICAgICByZXF1aXJlc1RyYXZlbERhdGVQYXNzZWQ6IHRydWUsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7IGFsbG93ZWQ6IGNhbk1hbmFnZSB9LFxuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluLFxuICAgICAgYmVmb3JlVHJhdmVsRGF0ZTogdHJ1ZSxcbiAgICB9LFxuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlc3BvbnNlIG1hcHBpbmcgKERlY2ltYWwgXHUyMTkyIE51bWJlcikgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBib29raW5nUGFja2FnZVNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdGl0bGU6IHRydWUsXG4gICAgc2x1ZzogdHJ1ZSxcbiAgICBsb2NhdGlvbjogdHJ1ZSxcbiAgICBpbWFnZXM6IHRydWUsXG4gICAgcHJpY2U6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG4vLyBEZXRhaWwgdmlldyBhZGRzIGFnZW50SWQgKG5lZWRlZCBieSBvd25lcnNoaXAgY2hlY2tzIGluIHRoZSBzZXJ2aWNlKS5cbmNvbnN0IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0aXRsZTogdHJ1ZSxcbiAgICBzbHVnOiB0cnVlLFxuICAgIGxvY2F0aW9uOiB0cnVlLFxuICAgIGltYWdlczogdHJ1ZSxcbiAgICBwcmljZTogdHJ1ZSxcbiAgICBhZ2VudElkOiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxuY29uc3QgYm9va2luZ1VzZXJTZWxlY3QgPSB7XG4gIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnQgbGVkZ2VyIHNob3duIG9uIHRoZSBib29raW5nIGRldGFpbCBwYWdlIChhbW91bnRzIHN0YXkgRGVjaW1hbCBpbiBEQikuXG5jb25zdCBib29raW5nUGF5bWVudFNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdHJhbklkOiB0cnVlLFxuICAgIGFtb3VudDogdHJ1ZSxcbiAgICBjdXJyZW5jeTogdHJ1ZSxcbiAgICBzdGF0dXM6IHRydWUsXG4gICAgY2FyZFR5cGU6IHRydWUsXG4gICAgYmFua1RyYW5JZDogdHJ1ZSxcbiAgICB2YWxJZDogdHJ1ZSxcbiAgICBwYWlkQXQ6IHRydWUsXG4gICAgcmVmdW5kUmVmSWQ6IHRydWUsXG4gICAgcmVmdW5kSW5pdGlhdGVkQXQ6IHRydWUsXG4gICAgcmVmdW5kQ29tcGxldGVkQXQ6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG4vLyBQYXltZW50cyBvcmRlcmVkIG5ld2VzdC1maXJzdCBzbyBjb25zdW1lcnMgY2FuIHJlbHkgb24gcGF5bWVudHNbMF0gYmVpbmcgdGhlXG4vLyBsYXRlc3QgYXR0ZW1wdCAodXNlZCBmb3IgdGhlIHVzZXIgcGF5bWVudC1oaXN0b3J5IFwibGF0ZXN0IHN0YXR1c1wiIHJvdykuXG5jb25zdCBib29raW5nUGF5bWVudHNJbmNsdWRlID0ge1xuICAuLi5ib29raW5nUGF5bWVudFNlbGVjdCxcbiAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIGFzIGNvbnN0IH0sXG59IGFzIGNvbnN0O1xuXG50eXBlIEJvb2tpbmdXaXRQYWNrYWdlID0gUHJpc21hLkJvb2tpbmdHZXRQYXlsb2FkPHtcbiAgaW5jbHVkZTogeyBwYWNrYWdlOiB0eXBlb2YgYm9va2luZ1BhY2thZ2VTZWxlY3QgfTtcbn0+O1xuXG4vLyBQYXltZW50cyBzaG93IG9uIGxpc3Qgcm93cyB0b28gKERvRDogXCJsaXN0L2RldGFpbCBub3cgaW5jbHVkZXMgcGF5bWVudHNcIiksXG4vLyBtYXBwZWQgdG8gTnVtYmVyIGF0IHRoZSBib3VuZGFyeSBsaWtlIHRoZSByZXN0IG9mIHRoZSBtb25leSBmaWVsZHMuXG50eXBlIEJvb2tpbmdQYXltZW50SXRlbSA9IHtcbiAgaWQ6IHN0cmluZztcbiAgdHJhbklkOiBzdHJpbmc7XG4gIGFtb3VudDogdW5rbm93bjtcbiAgY3VycmVuY3k6IHN0cmluZztcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGNhcmRUeXBlOiBzdHJpbmcgfCBudWxsO1xuICBiYW5rVHJhbklkOiBzdHJpbmcgfCBudWxsO1xuICB2YWxJZDogc3RyaW5nIHwgbnVsbDtcbiAgcGFpZEF0OiBEYXRlIHwgbnVsbDtcbn07XG5cbmNvbnN0IG1hcEJvb2tpbmdMaXN0ID0gKGJvb2tpbmc6IEJvb2tpbmdXaXRQYWNrYWdlICYgeyBwYXltZW50cz86IEJvb2tpbmdQYXltZW50SXRlbVtdIH0pID0+ICh7XG4gIC4uLmJvb2tpbmcsXG4gIHRvdGFsUHJpY2U6IE51bWJlcihib29raW5nLnRvdGFsUHJpY2UpLFxuICBwYWNrYWdlOiB7IC4uLmJvb2tpbmcucGFja2FnZSwgcHJpY2U6IE51bWJlcihib29raW5nLnBhY2thZ2UucHJpY2UpIH0sXG4gIHBheW1lbnRzOiBib29raW5nLnBheW1lbnRzPy5tYXAoKHApID0+ICh7IC4uLnAsIGFtb3VudDogTnVtYmVyKHAuYW1vdW50KSB9KSksXG59KTtcblxuLy8gXHUyNTAwXHUyNTAwIENyZWF0ZSBib29raW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY3JlYXRlQm9va2luZyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSUNyZWF0ZUJvb2tpbmcpID0+IHtcbiAgY29uc3QgeyBwYWNrYWdlSWQsIHRyYXZlbGVycyB9ID0gcGF5bG9hZDtcbiAgY29uc3QgdHJhdmVsRGF0ZSA9IHRvVVRDTWlkbmlnaHQocGF5bG9hZC50cmF2ZWxEYXRlKTtcblxuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gIH0pO1xuICBpZiAoXG4gICAgIXRvdXJQYWNrYWdlIHx8XG4gICAgdG91clBhY2thZ2UuaXNEZWxldGVkIHx8XG4gICAgdG91clBhY2thZ2Uuc3RhdHVzICE9PSBQYWNrYWdlU3RhdHVzLkFQUFJPVkVEXG4gICkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiUGFja2FnZSBpcyBub3QgYXZhaWxhYmxlIGZvciBib29raW5nLlwiKTtcbiAgfVxuXG4gIC8vIHRvdGFsUHJpY2UgaXMgY29tcHV0ZWQgc2VydmVyLXNpZGUgZnJvbSB0aGUgcGFja2FnZSdzIGN1cnJlbnQgcHJpY2UgXHUyMDE0XG4gIC8vIGFueXRoaW5nIHRoZSBjbGllbnQgc2VuZHMgaXMgaWdub3JlZC5cbiAgY29uc3QgdG90YWxQcmljZSA9IE51bWJlcih0b3VyUGFja2FnZS5wcmljZSkgKiB0cmF2ZWxlcnM7XG5cbiAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCB0eC5ib29raW5nLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHBhY2thZ2VJZCxcbiAgICAgICAgdHJhdmVsRGF0ZSxcbiAgICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBFTkRJTkcsXG4gICAgICB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgIGNvbnN0IGlzUmVjZW50ID1cbiAgICAgICAgZXhpc3RpbmcuY3JlYXRlZEF0LmdldFRpbWUoKSA+PVxuICAgICAgICBEYXRlLm5vdygpIC0gU1RBTEVfQk9PS0lOR19IT1VSUyAqIDYwICogNjAgKiAxMDAwO1xuXG4gICAgICBpZiAoaXNSZWNlbnQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICAgIDQwOSxcbiAgICAgICAgICBcIllvdSBhbHJlYWR5IGhhdmUgYSBwZW5kaW5nIGJvb2tpbmcgZm9yIHRoaXMgcGFja2FnZSBvbiB0aGlzIGRhdGUuXCIsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIC8vIGFiYW5kb25lZCBjaGVja291dCBcdTIwMTQgY2FuY2VsIGl0IGluIHRoZSBzYW1lIHRyYW5zYWN0aW9uIGFuZCByZWJvb2tcbiAgICAgIGF3YWl0IHR4LmJvb2tpbmcudXBkYXRlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQ6IGV4aXN0aW5nLmlkIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNBTkNFTExFRCB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHR4LmJvb2tpbmcuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHsgdXNlcklkLCBwYWNrYWdlSWQsIHRyYXZlbERhdGUsIHRyYXZlbGVycywgdG90YWxQcmljZSB9LFxuICAgIH0pO1xuICB9KTtcblxuICAvLyBiZXN0LWVmZm9ydCBlbWFpbCBcdTIwMTQgbmV2ZXIgZmFpbHMgdGhlIHJlcXVlc3RcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBzZWxlY3Q6IHsgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSxcbiAgfSk7XG4gIGlmICh1c2VyKSB7XG4gICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgc2VuZEJvb2tpbmdFbWFpbCh7XG4gICAgICAgIGVtYWlsOiB1c2VyLmVtYWlsLFxuICAgICAgICBuYW1lOiB1c2VyLm5hbWUsXG4gICAgICAgIHBhY2thZ2VUaXRsZTogdG91clBhY2thZ2UudGl0bGUsXG4gICAgICAgIHRyYXZlbERhdGUsXG4gICAgICAgIHRyYXZlbGVycyxcbiAgICAgICAgdG90YWxQcmljZSxcbiAgICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBFTkRJTkcsXG4gICAgICB9KSxcbiAgICBdKTtcbiAgfVxuXG4gIC8vIGJlc3QtZWZmb3J0IGluLWFwcCBub3RpZmljYXRpb24gdG8gdGhlIHBhY2thZ2UgYWdlbnQgKG5ldmVyIGZhaWxzIHJlcXVlc3QpXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBub3RpZnkoXG4gICAgICB0b3VyUGFja2FnZS5hZ2VudElkLFxuICAgICAgTm90aWZpY2F0aW9uVHlwZS5CT09LSU5HX0NSRUFURUQsXG4gICAgICBcIk5ldyBib29raW5nIHJlY2VpdmVkXCIsXG4gICAgICBgQSBuZXcgYm9va2luZyBoYXMgYmVlbiBwbGFjZWQgZm9yIFwiJHt0b3VyUGFja2FnZS50aXRsZX1cIi5gLFxuICAgICAgYC9kYXNoYm9hcmQvYWdlbnQvYm9va2luZ3MvJHtjcmVhdGVkLmlkfWAsXG4gICAgKSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICAuLi5jcmVhdGVkLFxuICAgIHRvdGFsUHJpY2U6IE51bWJlcihjcmVhdGVkLnRvdGFsUHJpY2UpLFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIExpc3QgaGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHBhZ2luYXRlQm9va2luZyA9IGFzeW5jIChcbiAgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCxcbiAgaW5jbHVkZTogUHJpc21hLkJvb2tpbmdJbmNsdWRlLFxuICBxdWVyeTogSUJvb2tpbmdRdWVyeSxcbikgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSB8fCAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0IHx8IDEwO1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlLFxuICAgICAgc2tpcDogKHBhZ2UgLSAxKSAqIGxpbWl0LFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBNeSBib29raW5ncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldE15Qm9va2luZ3MgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJQm9va2luZ1F1ZXJ5KSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7IHVzZXJJZCB9O1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHsgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFnZW50IGJvb2tpbmdzIChzY29wZWQgdG8gb3duIHBhY2thZ2VzKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldEFnZW50Qm9va2luZ3MgPSBhc3luYyAoXG4gIGFnZW50SWQ6IHN0cmluZyxcbiAgcXVlcnk6IElCb29raW5nU2VhcmNoUXVlcnksXG4pID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHtcbiAgICBwYWNrYWdlOiB7IGFnZW50SWQgfSxcbiAgfTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUucGFja2FnZSA9IHtcbiAgICAgIGFnZW50SWQsXG4gICAgICB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHsgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBhbGwgYm9va2luZ3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRBbGxCb29raW5ncyA9IGFzeW5jIChxdWVyeTogSUJvb2tpbmdTZWFyY2hRdWVyeSkgPT4ge1xuICBjb25zdCB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0ge307XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIHdoZXJlLnBhY2thZ2UgPSB7IHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH07XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAge1xuICAgICAgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICAgIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlLFxuICAgIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEJvb2tpbmcgZGV0YWlsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0Qm9va2luZ0RldGFpbCA9IGFzeW5jIChpZDogc3RyaW5nLCBhY3RvcjogQm9va2luZ0FjdG9yKSA9PiB7XG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIHBhY2thZ2U6IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0LFxuICAgICAgdXNlcjogYm9va2luZ1VzZXJTZWxlY3QsXG4gICAgICBwYXltZW50czogYm9va2luZ1BheW1lbnRzSW5jbHVkZSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuICBpZiAoIWNhbk1hbmFnZShib29raW5nLCBhY3RvcikpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gdmlldyB0aGlzIGJvb2tpbmcuXCIpO1xuICB9XG5cbiAgcmV0dXJuIG1hcEJvb2tpbmdMaXN0KGJvb2tpbmcpO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZnVuZCAoYm9va2luZyBjYW5jZWxsZWQgd2l0aCBzZXR0bGVkIG1vbmV5KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFJ1bnMgQUZURVIgdGhlIHN0YXR1cy10cmFuc2l0aW9uIHRyYW5zYWN0aW9uIGNvbW1pdHMsIHNvIGEgZ2F0ZXdheSBmYWlsdXJlIGNhblxuLy8gbmV2ZXIgcm9sbCBiYWNrIHRoZSBjYW5jZWxsYXRpb24gaXRzZWxmLiBFYWNoIHNldHRsZWQgcGF5bWVudCBpcyByZWZ1bmRlZCB2aWFcbi8vIHRoZSBTU0xDb21tZXJ6IFJlZnVuZCBBUEk7IHRoZSBsZWRnZXIgZmxpcHMgdG8gUkVGVU5ERUQgT05MWSBhZnRlciB0aGUgZ2F0ZXdheVxuLy8gY29uZmlybXMgXHUyMDE0IGEgZmFpbGVkIHJlZnVuZCBsZWF2ZXMgdGhlIHBheW1lbnQgU1VDQ0VTUyB3aXRoIHJlZnVuZEluaXRpYXRlZEF0XG4vLyBzZXQgc28gYSBsYXRlciByZXRyeS9tYW51YWwgYWN0aW9uIGNhbiBmaW5kIGl0IChzcGVjIDIzKS5cbnR5cGUgUmVmdW5kQ29udGV4dCA9IHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBwYWNrYWdlVGl0bGU6IHN0cmluZztcbiAgdHJhdmVsRGF0ZTogRGF0ZTtcbn07XG5cbmNvbnN0IGlzc3VlUmVmdW5kcyA9IGFzeW5jIChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIGN0eDogUmVmdW5kQ29udGV4dCxcbik6IFByb21pc2U8SVJlZnVuZE91dGNvbWUgfCBudWxsPiA9PiB7XG4gIGNvbnN0IHBheW1lbnRzID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZE1hbnkoe1xuICAgIHdoZXJlOiB7IGJvb2tpbmdJZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsIHJlZnVuZENvbXBsZXRlZEF0OiBudWxsIH0sXG4gIH0pO1xuICBpZiAocGF5bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICBsZXQgYWxsU3VjY2VlZGVkID0gdHJ1ZTtcbiAgbGV0IGZpcnN0RmFpbHVyZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGxldCByZWZ1bmRlZFRvdGFsID0gMDtcbiAgY29uc3QgcmVmdW5kUmVmczogc3RyaW5nW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IHBheW1lbnQgb2YgcGF5bWVudHMpIHtcbiAgICBpZiAoIXBheW1lbnQuYmFua1RyYW5JZCkge1xuICAgICAgYWxsU3VjY2VlZGVkID0gZmFsc2U7XG4gICAgICBmaXJzdEZhaWx1cmUgPz89IFwiUGF5bWVudCBoYXMgbm8gYmFuayB0cmFuc2FjdGlvbiBpZCB0byByZWZ1bmQgYWdhaW5zdC5cIjtcbiAgICAgIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MgfSxcbiAgICAgICAgZGF0YTogeyByZWZ1bmRJbml0aWF0ZWRBdDogbmV3IERhdGUoKSB9LFxuICAgICAgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgZ2F0ZXdheSA9IGF3YWl0IHNzbGNvbW1lcnpSZWZ1bmQoe1xuICAgICAgICBiYW5rX3RyYW5faWQ6IHBheW1lbnQuYmFua1RyYW5JZCxcbiAgICAgICAgcmVmdW5kX2Ftb3VudDogTnVtYmVyKHBheW1lbnQuYW1vdW50KSxcbiAgICAgICAgcmVmdW5kX3JlbWFya3M6IGBCb29raW5nICR7Ym9va2luZ0lkfSBjYW5jZWxsZWQgLSBUcmlwVmVyc2VgLFxuICAgICAgICByZWZlX2lkOiBib29raW5nSWQsXG4gICAgICB9KTtcblxuICAgICAgLy8gQ0FTOiBvbmx5IGEgc3RpbGwtU1VDQ0VTUyBwYXltZW50IGZsaXBzIHRvIFJFRlVOREVEIFx1MjAxNCBhIGNvbmN1cnJlbnRcbiAgICAgIC8vIHJlZnVuZCBsb3NlcyB0aGUgcmFjZSAoY291bnQgMCkgYW5kIGlzIGEgbm8tb3AuIE5ldmVyIGRvdWJsZS1yZWZ1bmRzLlxuICAgICAgY29uc3QgZmxpcHBlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MgfSxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5SRUZVTkRFRCxcbiAgICAgICAgICByZWZ1bmRSZWZJZDogZ2F0ZXdheS5yZWZ1bmRfcmVmX2lkID8/IHBheW1lbnQucmVmdW5kUmVmSWQgPz8gbnVsbCxcbiAgICAgICAgICByZWZ1bmRDb21wbGV0ZWRBdDogbmV3IERhdGUoKSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoZmxpcHBlZC5jb3VudCA9PT0gMCkgY29udGludWU7IC8vIGFscmVhZHkgcmVmdW5kZWQgYnkgYSBjb25jdXJyZW50IHBhdGhcbiAgICAgIHJlZnVuZGVkVG90YWwgKz0gTnVtYmVyKHBheW1lbnQuYW1vdW50KTtcbiAgICAgIGlmIChnYXRld2F5LnJlZnVuZF9yZWZfaWQpIHJlZnVuZFJlZnMucHVzaChnYXRld2F5LnJlZnVuZF9yZWZfaWQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBhbGxTdWNjZWVkZWQgPSBmYWxzZTtcbiAgICAgIGZpcnN0RmFpbHVyZSA/Pz1cbiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgLy8gbW9uZXkgaGFzbid0IGxlZnQgdGhlIGdhdGV3YXkgXHUyMDE0IGxlYXZlIHN0YXR1cyBTVUNDRVNTLCBtYXJrIGZvciByZXRyeVxuICAgICAgYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyB9LFxuICAgICAgICBkYXRhOiB7IHJlZnVuZEluaXRpYXRlZEF0OiBuZXcgRGF0ZSgpIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBpZiAocmVmdW5kUmVmcy5sZW5ndGggPiAwKSB7XG4gICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgc2VuZFJlZnVuZEVtYWlsKHtcbiAgICAgICAgZW1haWw6IGN0eC5lbWFpbCxcbiAgICAgICAgbmFtZTogY3R4Lm5hbWUsXG4gICAgICAgIHBhY2thZ2VUaXRsZTogY3R4LnBhY2thZ2VUaXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZTogY3R4LnRyYXZlbERhdGUsXG4gICAgICAgIGFtb3VudDogcmVmdW5kZWRUb3RhbCxcbiAgICAgICAgcmVmdW5kUmVmSWQ6IHJlZnVuZFJlZnNbMF0sXG4gICAgICB9KSxcbiAgICBdKTtcbiAgfVxuXG4gIHJldHVybiBhbGxTdWNjZWVkZWRcbiAgICA/IHsgc3RhdHVzOiBcIlNVQ0NFU1NcIiB9XG4gICAgOiB7IHN0YXR1czogXCJGQUlMRURcIiwgbWVzc2FnZTogZmlyc3RGYWlsdXJlID8/IFwiUmVmdW5kIGNvdWxkIG5vdCBiZSBwcm9jZXNzZWQuXCIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBTdGF0dXMgdHJhbnNpdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHVwZGF0ZUJvb2tpbmdTdGF0dXMgPSBhc3luYyAoXG4gIGlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVCb29raW5nU3RhdHVzLFxuICBhY3RvcjogQm9va2luZ0FjdG9yLFxuKSA9PiB7XG4gIGNvbnN0IHsgc3RhdHVzOiB0byB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBib29raW5nID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBwYWNrYWdlOiB7XG4gICAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgYWdlbnRJZDogdHJ1ZSwgdGl0bGU6IHRydWUgfSxcbiAgICAgIH0sXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGlmICghY2FuTWFuYWdlKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwZXJmb3JtIHRoaXMgYWN0aW9uLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHJ1bGUgPSBUUkFOU0lUSU9OU1tib29raW5nLnN0YXR1c10/Llt0b107XG4gIGlmICghcnVsZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIGBDYW5ub3QgdHJhbnNpdGlvbiBib29raW5nIGZyb20gJHtib29raW5nLnN0YXR1c30gdG8gJHt0b30uYCxcbiAgICApO1xuICB9XG4gIGlmICghcnVsZS5hbGxvd2VkKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwZXJmb3JtIHRoaXMgYWN0aW9uLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHRyYXZlbERheSA9IHRvVVRDTWlkbmlnaHQoYm9va2luZy50cmF2ZWxEYXRlKS5nZXRUaW1lKCk7XG4gIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gIGlmIChydWxlLnJlcXVpcmVzVHJhdmVsRGF0ZVBhc3NlZCAmJiB0cmF2ZWxEYXkgPiBub3cpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkJvb2tpbmcgY2FuIG9ubHkgYmUgY29tcGxldGVkIGFmdGVyIHRoZSB0cmF2ZWwgZGF0ZSBoYXMgcGFzc2VkLlwiLFxuICAgICk7XG4gIH1cbiAgaWYgKHJ1bGUuYmVmb3JlVHJhdmVsRGF0ZSAmJiB0cmF2ZWxEYXkgPD0gbm93KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJCb29raW5nIGNhbiBvbmx5IGJlIHJldmVydGVkIGJlZm9yZSB0aGUgdHJhdmVsIGRhdGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIC8vIGNvbXBhcmUtYW5kLXNldDogdGhlIHRyYW5zaXRpb24gYXBwbGllcyBvbmx5IGlmIHRoZSByZWNvcmRlZCBzdGF0dXMgc3RpbGxcbiAgLy8gbWF0Y2hlcyBcdTIwMTQgYSBjb25jdXJyZW50IGNoYW5nZSBtYWtlcyBjb3VudCAwIGFuZCB0aGUgcmVxdWVzdCBmYWlscyBzYWZlbHkuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHR4LmJvb2tpbmcudXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyBpZCwgc3RhdHVzOiBib29raW5nLnN0YXR1cyB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IHRvIH0sXG4gICAgfSk7XG4gICAgaWYgKHJlc3VsdC5jb3VudCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDksXG4gICAgICAgIFwiQm9va2luZyBzdGF0dXMgY2hhbmdlZCBjb25jdXJyZW50bHkuIFBsZWFzZSB0cnkgYWdhaW4uXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIENhbmNlbGxpbmcgYSBib29raW5nIGFiYW5kb25zIGFueSBub24tc2V0dGxlZCBzZXNzaW9ucyAobm8gbW9uZXkgd2FzXG4gICAgLy8gdGFrZW4pLiBTZXR0bGVkIChTVUNDRVNTKSBwYXltZW50cyBhcmUgTk9UIHRvdWNoZWQgaGVyZSBcdTIwMTQgdGhlIGdhdGV3YXlcbiAgICAvLyByZWZ1bmQgKyBSRUZVTkRFRCBmbGlwIGhhcHBlbiBhZnRlciB0aGlzIHRyYW5zYWN0aW9uIGNvbW1pdHMsIHNvIGEgZ2F0ZXdheVxuICAgIC8vIGZhaWx1cmUgY2FuIG5ldmVyIHJvbGwgYmFjayB0aGUgY2FuY2VsbGF0aW9uIGl0c2VsZiAoc3BlYyAyMykuXG4gICAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgICAgd2hlcmU6IHsgYm9va2luZ0lkOiBpZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB0eC5ib29raW5nLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICB9KTtcblxuICBpZiAoIXVwZGF0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIC8vIHN5bmNocm9ub3VzIGdhdGV3YXkgcmVmdW5kIGZvciBzZXR0bGVkIG1vbmV5IChib29raW5nIGFscmVhZHkgQ0FOQ0VMTEVEKS5cbiAgLy8gVGhlIG91dGNvbWUgaXMgc3VyZmFjZWQgdG8gdGhlIGFjdG9yOyBhIGdhdGV3YXkgaGljY3VwIG5ldmVyIGZhaWxzIHRoZVxuICAvLyBjYW5jZWxsYXRpb24gaXRzZWxmLlxuICBsZXQgcmVmdW5kOiBJUmVmdW5kT3V0Y29tZSB8IG51bGwgPSBudWxsO1xuICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgcmVmdW5kID0gYXdhaXQgaXNzdWVSZWZ1bmRzKGlkLCB7XG4gICAgICBlbWFpbDogYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgbmFtZTogYm9va2luZy51c2VyLm5hbWUsXG4gICAgICBwYWNrYWdlVGl0bGU6IGJvb2tpbmcucGFja2FnZS50aXRsZSxcbiAgICAgIHRyYXZlbERhdGU6IGJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIGJlc3QtZWZmb3J0IGVtYWlsIGZvciBtb25leS1zdGF0dXMgY2hhbmdlc1xuICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ09ORklSTUVEIHx8IHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgICBlbWFpbDogYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgICBuYW1lOiBib29raW5nLnVzZXIubmFtZSxcbiAgICAgICAgcGFja2FnZVRpdGxlOiBib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICAgIHRyYXZlbERhdGU6IGJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICAgICAgdHJhdmVsZXJzOiBib29raW5nLnRyYXZlbGVycyxcbiAgICAgICAgdG90YWxQcmljZTogTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSksXG4gICAgICAgIHN0YXR1czogdG8sXG4gICAgICB9KSxcbiAgICBdKTtcbiAgfVxuXG4gIC8vIGJlc3QtZWZmb3J0IGluLWFwcCBub3RpZmljYXRpb25zIChuZXZlciBmYWlscyByZXF1ZXN0KS4gUmVjaXBpZW50IG9mIGFcbiAgLy8gY2FuY2VsbGF0aW9uIGRlcGVuZHMgb24gdGhlIGFjdG9yOiB0aGUgY3VzdG9tZXIgY2FuY2VscyBcdTIxOTIgdGhlIGFnZW50IGhlYXJzO1xuICAvLyB0aGUgYWdlbnQgY2FuY2VscyBcdTIxOTIgdGhlIGN1c3RvbWVyIGhlYXJzOyBhbiBBRE1JTiBjYW5jZWxzIFx1MjE5MiBib3RoIGhlYXIsIHNpbmNlXG4gIC8vIHRoZSBhZG1pbiBhY3RzIG9uIGJlaGFsZiBvZiB0aGUgcGxhdGZvcm0sIG5vdCBlaXRoZXIgc2lkZS5cbiAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNPTkZJUk1FRCkge1xuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgIG5vdGlmeShcbiAgICAgICAgYm9va2luZy51c2VySWQsXG4gICAgICAgIE5vdGlmaWNhdGlvblR5cGUuQk9PS0lOR19DT05GSVJNRUQsXG4gICAgICAgIFwiQm9va2luZyBjb25maXJtZWRcIixcbiAgICAgICAgYFlvdXIgYm9va2luZyBmb3IgXCIke2Jvb2tpbmcucGFja2FnZS50aXRsZX1cIiBoYXMgYmVlbiBjb25maXJtZWQuYCxcbiAgICAgICAgYC9kYXNoYm9hcmQvYm9va2luZ3MvJHtpZH1gLFxuICAgICAgKSxcbiAgICBdKTtcbiAgfVxuXG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQpIHtcbiAgICBjb25zdCByZWNpcGllbnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGlmIChhY3Rvci5pZCA9PT0gYm9va2luZy51c2VySWQpIHtcbiAgICAgIHJlY2lwaWVudHMucHVzaChib29raW5nLnBhY2thZ2UuYWdlbnRJZCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGFjdG9yLnJvbGUgPT09IFJvbGUuQUdFTlQgJiZcbiAgICAgIGJvb2tpbmcucGFja2FnZS5hZ2VudElkID09PSBhY3Rvci5pZFxuICAgICkge1xuICAgICAgcmVjaXBpZW50cy5wdXNoKGJvb2tpbmcudXNlcklkKTtcbiAgICB9IGVsc2UgaWYgKGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU4pIHtcbiAgICAgIHJlY2lwaWVudHMucHVzaChib29raW5nLnVzZXJJZCwgYm9va2luZy5wYWNrYWdlLmFnZW50SWQpO1xuICAgIH1cblxuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgWy4uLm5ldyBTZXQocmVjaXBpZW50cyldLm1hcCgocmVjaXBpZW50SWQpID0+XG4gICAgICAgIG5vdGlmeShcbiAgICAgICAgICByZWNpcGllbnRJZCxcbiAgICAgICAgICBOb3RpZmljYXRpb25UeXBlLkJPT0tJTkdfQ0FOQ0VMTEVELFxuICAgICAgICAgIFwiQm9va2luZyBjYW5jZWxsZWRcIixcbiAgICAgICAgICBgVGhlIGJvb2tpbmcgZm9yIFwiJHtib29raW5nLnBhY2thZ2UudGl0bGV9XCIgaGFzIGJlZW4gY2FuY2VsbGVkLmAsXG4gICAgICAgICAgYC9kYXNoYm9hcmQvYm9va2luZ3MvJHtpZH1gLFxuICAgICAgICApLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAuLi51cGRhdGVkLFxuICAgIHRvdGFsUHJpY2U6IE51bWJlcih1cGRhdGVkLnRvdGFsUHJpY2UpLFxuICAgIC4uLihyZWZ1bmQgPyB7IHJlZnVuZCB9IDoge30pLFxuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdTZXJ2aWNlID0ge1xuICBjcmVhdGVCb29raW5nLFxuICBnZXRNeUJvb2tpbmdzLFxuICBnZXRBZ2VudEJvb2tpbmdzLFxuICBnZXRBbGxCb29raW5ncyxcbiAgZ2V0Qm9va2luZ0RldGFpbCxcbiAgdXBkYXRlQm9va2luZ1N0YXR1cyxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcblxuY29uc3QgY3JlYXRlU2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWNrYWdlSWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbiAgdHJhdmVsRGF0ZTogei5jb2VyY2UuZGF0ZSh7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiVHJhdmVsIGRhdGUgaXMgcmVxdWlyZWRcIixcbiAgICBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiVHJhdmVsIGRhdGUgbXVzdCBiZSBhIHZhbGlkIGRhdGVcIixcbiAgfSkucmVmaW5lKFxuICAgIChkYXRlKSA9PiB7XG4gICAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XG4gICAgICBjb25zdCB0cmF2ZWxEYXkgPSBuZXcgRGF0ZShcbiAgICAgICAgRGF0ZS5VVEMoXG4gICAgICAgICAgZGF0ZS5nZXRVVENGdWxsWWVhcigpLFxuICAgICAgICAgIGRhdGUuZ2V0VVRDTW9udGgoKSxcbiAgICAgICAgICBkYXRlLmdldFVUQ0RhdGUoKSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBjb25zdCB0b2RheVVUQyA9IG5ldyBEYXRlKFxuICAgICAgICBEYXRlLlVUQyhcbiAgICAgICAgICB0b2RheS5nZXRVVENGdWxsWWVhcigpLFxuICAgICAgICAgIHRvZGF5LmdldFVUQ01vbnRoKCksXG4gICAgICAgICAgdG9kYXkuZ2V0VVRDRGF0ZSgpLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIHJldHVybiB0cmF2ZWxEYXkuZ2V0VGltZSgpID49IHRvZGF5VVRDLmdldFRpbWUoKTtcbiAgICB9LFxuICAgIHsgbWVzc2FnZTogXCJUcmF2ZWwgZGF0ZSBjYW5ub3QgYmUgaW4gdGhlIHBhc3QuXCIgfSxcbiAgKSxcbiAgdHJhdmVsZXJzOiB6XG4gICAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIlRyYXZlbGVycyBpcyByZXF1aXJlZFwiIH0pXG4gICAgLmludChcIlRyYXZlbGVycyBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyXCIpXG4gICAgLm1pbigxLCBcIlRyYXZlbGVycyBtdXN0IGJlIGF0IGxlYXN0IDFcIilcbiAgICAubWF4KDIwLCBcIlRyYXZlbGVycyBtdXN0IGJlIGF0IG1vc3QgMjBcIiksXG59KTtcblxuY29uc3QgYm9va2luZ1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQm9va2luZyBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBib29raW5nUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIHN0YXR1czogei5uYXRpdmVFbnVtKEJvb2tpbmdTdGF0dXMpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hID0gYm9va2luZ1F1ZXJ5U2NoZW1hLmV4dGVuZCh7XG4gIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVTdGF0dXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHN0YXR1czogei5uYXRpdmVFbnVtKEJvb2tpbmdTdGF0dXMsIHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHN0YXR1c1wiLFxuICB9KSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUQ3JlYXRlQm9va2luZ1NjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNyZWF0ZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQm9va2luZ1F1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgYm9va2luZ1F1ZXJ5U2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRCb29raW5nU2VhcmNoUXVlcnlTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBib29raW5nU2VhcmNoUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFVwZGF0ZVN0YXR1c1NjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHVwZGF0ZVN0YXR1c1NjaGVtYT47XG5cbmV4cG9ydCBjb25zdCBib29raW5nVmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVNjaGVtYSxcbiAgYm9va2luZ1BhcmFtc1NjaGVtYSxcbiAgYm9va2luZ1F1ZXJ5U2NoZW1hLFxuICBib29raW5nU2VhcmNoUXVlcnlTY2hlbWEsXG4gIHVwZGF0ZVN0YXR1c1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyByZXZpZXdDb250cm9sbGVyIH0gZnJvbSBcIi4vcmV2aWV3LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHJldmlld1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vcmV2aWV3LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIENyZWF0ZSBhIHJldmlldyAoVVNFUiBvbmx5KVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHJldmlld1ZhbGlkYXRpb25zLmNyZWF0ZVJldmlld1NjaGVtYSB9KSxcbiAgcmV2aWV3Q29udHJvbGxlci5jcmVhdGVSZXZpZXcsXG4pO1xuXG4vLyAyLiBMaXN0IHJldmlld3MgZm9yIGEgcGFja2FnZSAocHVibGljKVxucm91dGVyLmdldChcbiAgXCIvcGFja2FnZS86cGFja2FnZUlkXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiByZXZpZXdWYWxpZGF0aW9ucy5yZXZpZXdQYXJhbXNTY2hlbWEsXG4gICAgcXVlcnk6IHJldmlld1ZhbGlkYXRpb25zLnJldmlld1F1ZXJ5U2NoZW1hLFxuICB9KSxcbiAgcmV2aWV3Q29udHJvbGxlci5nZXRQYWNrYWdlUmV2aWV3cyxcbik7XG5cbi8vIDMuIFVwZGF0ZSBhIHJldmlldyAoVVNFUiwgYXV0aG9yIG9ubHkpIFx1MjAxNCByZWdpc3RlcmVkIGFmdGVyIC9wYWNrYWdlLzpwYWNrYWdlSWRcbi8vICAgIHNvIHRoZSBsaXRlcmFsIGAvcGFja2FnZWAgc2VnbWVudCBpcyBuZXZlciBzd2FsbG93ZWQgYnkgYC86aWRgLlxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3SWRQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogcmV2aWV3VmFsaWRhdGlvbnMudXBkYXRlUmV2aWV3U2NoZW1hLFxuICB9KSxcbiAgcmV2aWV3Q29udHJvbGxlci51cGRhdGVSZXZpZXcsXG4pO1xuXG4vLyA0LiBEZWxldGUgYSByZXZpZXcgKGF1dGhvciBvciBBRE1JTilcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3SWRQYXJhbXNTY2hlbWEgfSksXG4gIHJldmlld0NvbnRyb2xsZXIuZGVsZXRlUmV2aWV3LFxuKTtcblxuZXhwb3J0IGNvbnN0IHJldmlld1JvdXRlcyA9IHJvdXRlcjtcbiIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgcmV2aWV3U2VydmljZSB9IGZyb20gXCIuL3Jldmlldy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IGNvbnRyb2xsZXIgKFVTRVIgb25seSlcbmNvbnN0IGNyZWF0ZVJldmlldyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJldmlld1NlcnZpY2UuY3JlYXRlUmV2aWV3KHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3IHN1Ym1pdHRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBMaXN0IHBhY2thZ2UgcmV2aWV3cyBjb250cm9sbGVyIChwdWJsaWMpXG5jb25zdCBnZXRQYWNrYWdlUmV2aWV3cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VJZCA9IFN0cmluZyhyZXEucGFyYW1zLnBhY2thZ2VJZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmV2aWV3U2VydmljZS5saXN0UGFja2FnZVJldmlld3MocGFja2FnZUlkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlJldmlld3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBVcGRhdGUgYSByZXZpZXcgY29udHJvbGxlciAoVVNFUiwgYXV0aG9yIG9ubHkpXG5jb25zdCB1cGRhdGVSZXZpZXcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXZpZXdTZXJ2aWNlLnVwZGF0ZVJldmlldyh1c2VySWQsIGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3IHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNC4gRGVsZXRlIGEgcmV2aWV3IGNvbnRyb2xsZXIgKGF1dGhvciBvciBBRE1JTilcbmNvbnN0IGRlbGV0ZVJldmlldyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJvbGUgPSByZXEudXNlciEucm9sZTtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXZpZXdTZXJ2aWNlLmRlbGV0ZVJldmlldyh1c2VySWQsIHJvbGUsIGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJSZXZpZXcgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlUmV2aWV3LFxuICBnZXRQYWNrYWdlUmV2aWV3cyxcbiAgdXBkYXRlUmV2aWV3LFxuICBkZWxldGVSZXZpZXcsXG59O1xuIiwgImltcG9ydCB7IFBhY2thZ2VTdGF0dXMsIEJvb2tpbmdTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVSZXZpZXdQYXlsb2FkLFxuICBJUmV2aWV3UXVlcnksXG4gIElVcGRhdGVSZXZpZXdQYXlsb2FkLFxufSBmcm9tIFwiLi9yZXZpZXcuaW50ZXJmYWNlXCI7XG5cbi8vIFNoYXJlZCByYXRpbmcgcmVjb21wdXRlIFx1MjAxNCB0aGUgc2luZ2xlIHNvdXJjZSBvZiB0cnV0aCBmb3IgdGhlIHBhY2thZ2Vcbi8vIGF2ZXJhZ2UuIGNyZWF0ZS91cGRhdGUvZGVsZXRlIGFsbCBjYWxsIGl0IGluc2lkZSB0aGVpciBvd24gdHJhbnNhY3Rpb24sIGFuZFxuLy8gdGhlIGFnZ3JlZ2F0ZSBhbHdheXMgZmlsdGVycyBgaXNEZWxldGVkOiBmYWxzZWAgc28gYSByZW1vdmVkIHJhdGluZyBuZXZlclxuLy8gY291bnRzIChvdGhlcndpc2UgZGVsZXRlIHdvdWxkIHJlY29tcHV0ZSBhbiB1bmNoYW5nZWQgYXZlcmFnZSkuXG5jb25zdCByZWNvbXB1dGVQYWNrYWdlUmF0aW5nID0gYXN5bmMgKFxuICB0eDogUHJpc21hLlRyYW5zYWN0aW9uQ2xpZW50LFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbik6IFByb21pc2U8bnVtYmVyPiA9PiB7XG4gIGNvbnN0IHsgX2F2ZyB9ID0gYXdhaXQgdHgucmV2aWV3LmFnZ3JlZ2F0ZSh7XG4gICAgd2hlcmU6IHsgcGFja2FnZUlkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgX2F2ZzogeyByYXRpbmc6IHRydWUgfSxcbiAgfSk7XG5cbiAgY29uc3QgcmF0aW5nID0gTWF0aC5yb3VuZCgoX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMDtcblxuICBhd2FpdCB0eC50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhOiB7IHJhdGluZyB9LFxuICB9KTtcblxuICByZXR1cm4gcmF0aW5nO1xufTtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IChVU0VSIG9ubHkpIFx1MjAxNCBnYXRlZCwgdW5pcXVlIHBlciB1c2VyK3BhY2thZ2UsIGFuZFxuLy8gICAgcmVjYWxjdWxhdGVzIHRoZSBwYWNrYWdlIHJhdGluZyBpbiB0aGUgc2FtZSB0cmFuc2FjdGlvbi5cbmNvbnN0IGNyZWF0ZVJldmlldyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSUNyZWF0ZVJldmlld1BheWxvYWQpID0+IHtcbiAgcmV0dXJuIHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgLy8gUGFja2FnZSBtdXN0IGV4aXN0LCBiZSBhcHByb3ZlZCwgYW5kIG5vdCBiZSBkZWxldGVkIFx1MjAxNCBhIHJldmlldyBvZiBhXG4gICAgLy8gcGVuZGluZy9yZWplY3RlZC9kZWxldGVkIHBhY2thZ2UgaXMgbm9uc2Vuc2UuXG4gICAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCB0eC50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgaWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBhZ2VudElkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICAvLyBObyBzZWxmLXJldmlldyBcdTIwMTQgYW4gYWdlbnQgcmF0aW5nIHRoZWlyIG93biBwYWNrYWdlIGlzIGEgY29uZmxpY3Qgb2YgaW50ZXJlc3QuXG4gICAgaWYgKHRvdXJQYWNrYWdlLmFnZW50SWQgPT09IHVzZXJJZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2Fubm90IHJldmlldyB5b3VyIG93biBwYWNrYWdlLlwiKTtcbiAgICB9XG5cbiAgICAvLyBPbmx5IGN1c3RvbWVycyB3aXRoIGEgY29tcGxldGVkIGJvb2tpbmcgbWF5IHJldmlldy5cbiAgICBjb25zdCBjb21wbGV0ZWRCb29raW5nID0gYXdhaXQgdHguYm9va2luZy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVELFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFjb21wbGV0ZWRCb29raW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJZb3UgY2FuIG9ubHkgcmV2aWV3IGEgcGFja2FnZSBhZnRlciBjb21wbGV0aW5nIGEgYm9va2luZy5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gRnJpZW5kbHkgZHVwbGljYXRlIGNoZWNrIFx1MjAxNCBAQHVuaXF1ZShbdXNlcklkLCBwYWNrYWdlSWRdKSBiYWNrc3RvcHMgYW55XG4gICAgLy8gcmFjZSB2aWEgUDIwMDIgKG1hcHBlZCB0byA0MDkgYnkgdGhlIGdsb2JhbCBoYW5kbGVyKS4gRGVsaWJlcmF0ZWx5IE5PVFxuICAgIC8vIGZpbHRlcmVkIGJ5IGlzRGVsZXRlZDogc29mdCBkZWxldGUga2VlcHMgdGhlIHJvdywgc28gcmUtcmV2aWV3aW5nIGFmdGVyXG4gICAgLy8gYSBkZWxldGUgc3RpbGwgZmFpbHMgd2l0aCB0aGlzIGZyaWVuZGx5IDQwOS5cbiAgICBjb25zdCBleGlzdGluZ1JldmlldyA9IGF3YWl0IHR4LnJldmlldy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHsgdXNlcklkLCBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZ1Jldmlldykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJZb3UgaGF2ZSBhbHJlYWR5IHJldmlld2VkIHRoaXMgcGFja2FnZS5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgY3JlYXRlZFJldmlldyA9IGF3YWl0IHR4LnJldmlldy5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICAgIHJhdGluZzogcGF5bG9hZC5yYXRpbmcsXG4gICAgICAgIGNvbW1lbnQ6IHBheWxvYWQuY29tbWVudCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByYXRpbmcgPSBhd2FpdCByZWNvbXB1dGVQYWNrYWdlUmF0aW5nKHR4LCBwYXlsb2FkLnBhY2thZ2VJZCk7XG5cbiAgICByZXR1cm4geyByZXZpZXc6IGNyZWF0ZWRSZXZpZXcsIHJhdGluZyB9O1xuICB9KTtcbn07XG5cbi8vIDIuIExpc3QgcmV2aWV3cyBmb3IgYSBwYWNrYWdlIChwdWJsaWMpIFx1MjAxNCBwYWdpbmF0ZWQ7IHRoZSBwYWNrYWdlIG11c3QgYmVcbi8vICAgIGFwcHJvdmVkIGFuZCBub3QgZGVsZXRlZCBzbyB1bnB1Ymxpc2hlZCBwYWNrYWdlIHJldmlld3MgbmV2ZXIgbGVhay5cbi8vICAgIERlbGV0ZWQgcmV2aWV3cyBhcmUgZXhjbHVkZWQgc28gYSByZW1vdmVkIHJhdGluZyBzdG9wcyBjb3VudGluZy5cbmNvbnN0IGxpc3RQYWNrYWdlUmV2aWV3cyA9IGFzeW5jIChcbiAgcGFja2FnZUlkOiBzdHJpbmcsXG4gIHF1ZXJ5OiBJUmV2aWV3UXVlcnksXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZEZpcnN0KHtcbiAgICB3aGVyZToge1xuICAgICAgaWQ6IHBhY2thZ2VJZCxcbiAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZSA9IHsgcGFja2FnZUlkLCBpc0RlbGV0ZWQ6IGZhbHNlIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEucmV2aWV3LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgc2VsZWN0OiB7XG4gICAgICAgIGlkOiB0cnVlLFxuICAgICAgICByYXRpbmc6IHRydWUsXG4gICAgICAgIGNvbW1lbnQ6IHRydWUsXG4gICAgICAgIGNyZWF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgdXBkYXRlZEF0OiB0cnVlLFxuICAgICAgICB1c2VyOiB7IHNlbGVjdDogeyBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5yZXZpZXcuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG4vLyAzLiBVcGRhdGUgYSByZXZpZXcgKFVTRVIsIGF1dGhvciBvbmx5KS4gQSBmb3JlaWduIGlkIG9yIGEgcmVtb3ZlZCByZXZpZXcgaXNcbi8vICAgIGEgdW5pZm9ybSA0MDQgXHUyMDE0IG5ldmVyIGEgbGVhay4gVGhlIHBhY2thZ2UgYXZlcmFnZSBpcyByZWNvbXB1dGVkIGluIHRoZVxuLy8gICAgc2FtZSB0cmFuc2FjdGlvbi5cbmNvbnN0IHVwZGF0ZVJldmlldyA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHJldmlld0lkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVSZXZpZXdQYXlsb2FkLFxuKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgdHgucmV2aWV3LmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZTogeyBpZDogcmV2aWV3SWQsIHVzZXJJZCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBwYWNrYWdlSWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUmV2aWV3IG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHR4LnJldmlldy51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJldmlld0lkIH0sXG4gICAgICBkYXRhOiB7XG4gICAgICAgIC4uLihwYXlsb2FkLnJhdGluZyAhPT0gdW5kZWZpbmVkID8geyByYXRpbmc6IHBheWxvYWQucmF0aW5nIH0gOiB7fSksXG4gICAgICAgIC4uLihwYXlsb2FkLmNvbW1lbnQgIT09IHVuZGVmaW5lZCA/IHsgY29tbWVudDogcGF5bG9hZC5jb21tZW50IH0gOiB7fSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgYXdhaXQgcmVjb21wdXRlUGFja2FnZVJhdGluZyh0eCwgZXhpc3RpbmcucGFja2FnZUlkKTtcblxuICAgIC8vIFRoZSByZXNwb25zZSdzIHJhdGluZyBpcyB0aGUgYXV0aG9yaXRhdGl2ZSB2YWx1ZSBmcm9tIHRoZSBwYWNrYWdlIHJvdyxcbiAgICAvLyBub3QgdGhlIGlucHV0IFx1MjAxNCB0aGUgY2xpZW50J3MgZGlzcGxheWVkIGF2ZXJhZ2UgaXMgbmV2ZXIgc3RhbGUuXG4gICAgY29uc3QgZnJlc2ggPSBhd2FpdCB0eC50b3VyUGFja2FnZS5maW5kVW5pcXVlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBleGlzdGluZy5wYWNrYWdlSWQgfSxcbiAgICAgIHNlbGVjdDogeyByYXRpbmc6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB7IHJldmlldzogdXBkYXRlZCwgcmF0aW5nOiBmcmVzaD8ucmF0aW5nID8/IDAgfTtcbiAgfSk7XG59O1xuXG4vLyA0LiBTb2Z0IGRlbGV0ZSBhIHJldmlldyAoYXV0aG9yIG9yIEFETUlOKSBcdTIwMTQgdGhlIGF2ZXJhZ2UgaXMgcmVjb21wdXRlZCBzbyB0aGVcbi8vICAgIHJlbW92ZWQgcmF0aW5nIHN0b3BzIGNvdW50aW5nLiBGb3JlaWduIGlkIC8gcmVwZWF0IGRlbGV0ZSBcdTIxOTIgdW5pZm9ybSA0MDQuXG5jb25zdCBkZWxldGVSZXZpZXcgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICByb2xlOiBSb2xlLFxuICByZXZpZXdJZDogc3RyaW5nLFxuKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgdHgucmV2aWV3LmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZTogeyBpZDogcmV2aWV3SWQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgcGFja2FnZUlkOiB0cnVlLCB1c2VySWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUmV2aWV3IG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgaWYgKHJvbGUgIT09IFJvbGUuQURNSU4gJiYgZXhpc3RpbmcudXNlcklkICE9PSB1c2VySWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUmV2aWV3IG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgcmVtb3ZlZCA9IGF3YWl0IHR4LnJldmlldy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiByZXZpZXdJZCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmIChyZW1vdmVkLmNvdW50ID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlJldmlldyBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IHJhdGluZyA9IGF3YWl0IHJlY29tcHV0ZVBhY2thZ2VSYXRpbmcodHgsIGV4aXN0aW5nLnBhY2thZ2VJZCk7XG5cbiAgICByZXR1cm4geyByZXZpZXdJZCwgcmF0aW5nIH07XG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IHJldmlld1NlcnZpY2UgPSB7XG4gIGNyZWF0ZVJldmlldyxcbiAgbGlzdFBhY2thZ2VSZXZpZXdzLFxuICB1cGRhdGVSZXZpZXcsXG4gIGRlbGV0ZVJldmlldyxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVJldmlld1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFja2FnZUlkOiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbiAgICByYXRpbmc6IHpcbiAgICAgIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJSYXRpbmcgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLmludChcIlJhdGluZyBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyXCIpXG4gICAgICAubWluKDEsIFwiUmF0aW5nIG11c3QgYmUgYXQgbGVhc3QgMVwiKVxuICAgICAgLm1heCg1LCBcIlJhdGluZyBtdXN0IGJlIGF0IG1vc3QgNVwiKSxcbiAgICBjb21tZW50OiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ29tbWVudCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAudHJpbSgpXG4gICAgICAubWluKDEsIFwiQ29tbWVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAgICAgLm1heCgxMDAwLCBcIkNvbW1lbnQgbXVzdCBiZSBhdCBtb3N0IDEwMDAgY2hhcmFjdGVyc1wiKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCByZXZpZXdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5jb25zdCByZXZpZXdRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVSZXZpZXdTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHJhdGluZzogelxuICAgICAgLm51bWJlcih7IGludmFsaWRfdHlwZV9lcnJvcjogXCJSYXRpbmcgbXVzdCBiZSBhIG51bWJlclwiIH0pXG4gICAgICAuaW50KFwiUmF0aW5nIG11c3QgYmUgYSB3aG9sZSBudW1iZXJcIilcbiAgICAgIC5taW4oMSwgXCJSYXRpbmcgbXVzdCBiZSBhdCBsZWFzdCAxXCIpXG4gICAgICAubWF4KDUsIFwiUmF0aW5nIG11c3QgYmUgYXQgbW9zdCA1XCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgICBjb21tZW50OiB6XG4gICAgICAuc3RyaW5nKHsgaW52YWxpZF90eXBlX2Vycm9yOiBcIkNvbW1lbnQgbXVzdCBiZSBhIHN0cmluZ1wiIH0pXG4gICAgICAudHJpbSgpXG4gICAgICAubWluKDEsIFwiQ29tbWVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAgICAgLm1heCgxMDAwLCBcIkNvbW1lbnQgbXVzdCBiZSBhdCBtb3N0IDEwMDAgY2hhcmFjdGVyc1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiBkYXRhLnJhdGluZyAhPT0gdW5kZWZpbmVkIHx8IGRhdGEuY29tbWVudCAhPT0gdW5kZWZpbmVkLCB7XG4gICAgbWVzc2FnZTogXCJBdCBsZWFzdCBvbmUgb2YgcmF0aW5nIG9yIGNvbW1lbnQgbXVzdCBiZSBwcm92aWRlZFwiLFxuICB9KTtcblxuY29uc3QgcmV2aWV3SWRQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlJldmlldyBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbigxLCBcIlJldmlldyBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVJldmlld1NjaGVtYSxcbiAgcmV2aWV3UGFyYW1zU2NoZW1hLFxuICByZXZpZXdRdWVyeVNjaGVtYSxcbiAgdXBkYXRlUmV2aWV3U2NoZW1hLFxuICByZXZpZXdJZFBhcmFtc1NjaGVtYSxcbn07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGNhdGVnb3J5Q29udHJvbGxlciB9IGZyb20gXCIuL2NhdGVnb3J5LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGNhdGVnb3J5VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9jYXRlZ29yeS52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBMaXN0IGFsbCBjYXRlZ29yaWVzIChwdWJsaWMsIG5vIGF1dGgpXG5yb3V0ZXIuZ2V0KFwiL1wiLCBjYXRlZ29yeUNvbnRyb2xsZXIuZ2V0QWxsQ2F0ZWdvcmllcyk7XG5cbi8vIDIuIENyZWF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY3JlYXRlQ2F0ZWdvcnlTY2hlbWEgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci5jcmVhdGVDYXRlZ29yeSxcbik7XG5cbi8vIDMuIFVwZGF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogY2F0ZWdvcnlWYWxpZGF0aW9ucy5jYXRlZ29yeVBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBjYXRlZ29yeVZhbGlkYXRpb25zLnVwZGF0ZUNhdGVnb3J5U2NoZW1hLFxuICB9KSxcbiAgY2F0ZWdvcnlDb250cm9sbGVyLnVwZGF0ZUNhdGVnb3J5LFxuKTtcblxuLy8gNC4gRGVsZXRlIGNhdGVnb3J5IChhZG1pbilcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY2F0ZWdvcnlQYXJhbXNTY2hlbWEgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci5kZWxldGVDYXRlZ29yeSxcbik7XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeVJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGNhdGVnb3J5U2VydmljZSB9IGZyb20gXCIuL2NhdGVnb3J5LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyBDcmVhdGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCBjcmVhdGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmNyZWF0ZUNhdGVnb3J5KHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcnksXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgYWxsIGNhdGVnb3JpZXMgY29udHJvbGxlciAocHVibGljKVxuY29uc3QgZ2V0QWxsQ2F0ZWdvcmllcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBhd2FpdCBjYXRlZ29yeVNlcnZpY2UuZ2V0QWxsQ2F0ZWdvcmllcygpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBjYXRlZ29yaWVzIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcmllcyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSBjYXRlZ29yeSBjb250cm9sbGVyIChhZG1pbilcbmNvbnN0IHVwZGF0ZUNhdGVnb3J5ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBjb25zdCBjYXRlZ29yeSA9IGF3YWl0IGNhdGVnb3J5U2VydmljZS51cGRhdGVDYXRlZ29yeShpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcnksXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBEZWxldGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCBkZWxldGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmRlbGV0ZUNhdGVnb3J5KGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDYXRlZ29yeSBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlDb250cm9sbGVyID0ge1xuICBjcmVhdGVDYXRlZ29yeSxcbiAgZ2V0QWxsQ2F0ZWdvcmllcyxcbiAgdXBkYXRlQ2F0ZWdvcnksXG4gIGRlbGV0ZUNhdGVnb3J5LFxufTsiLCAiLy8gQmFuZ2xhIChCZW5nYWxpKSBcdTIxOTIgTGF0aW4gY29uc29uYW50L3Zvd2VsIG1hcCwgYXBwbGllZCBiZWZvcmUga2ViYWItY2FzaW5nIHNvXG4vLyBCYW5nbGEtaGVhdnkgdGl0bGVzIHN0aWxsIHByb2R1Y2UgcmVhZGFibGUgc2x1Z3MgaW5zdGVhZCBvZiBiZWluZyBzdHJpcHBlZCB0b1xuLy8gYW4gZW1wdHkgc3RyaW5nLlxuY29uc3QgQkFOR0xBX1RPX0xBVElOOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBcdTA5ODU6IFwib1wiLFxuICBcdTA5ODY6IFwiYVwiLFxuICBcdTA5ODc6IFwiaVwiLFxuICBcdTA5ODg6IFwiaVwiLFxuICBcdTA5ODk6IFwidVwiLFxuICBcdTA5OEE6IFwidVwiLFxuICBcdTA5OEI6IFwicmlcIixcbiAgXHUwOThGOiBcImVcIixcbiAgXHUwOTkwOiBcIm9pXCIsXG4gIFx1MDk5MzogXCJvXCIsXG4gIFx1MDk5NDogXCJvdVwiLFxuICBcdTA5OTU6IFwia2FcIixcbiAgXHUwOTk2OiBcImtoYVwiLFxuICBcdTA5OTc6IFwiZ2FcIixcbiAgXHUwOTk4OiBcImdoYVwiLFxuICBcdTA5OTk6IFwibmdhXCIsXG4gIFx1MDk5QTogXCJjaGFcIixcbiAgXHUwOTlCOiBcImNoaGFcIixcbiAgXHUwOTlDOiBcImphXCIsXG4gIFx1MDk5RDogXCJqaGFcIixcbiAgXHUwOTlFOiBcIm55YVwiLFxuICBcdTA5OUY6IFwidGFcIixcbiAgXHUwOUEwOiBcInRoYVwiLFxuICBcdTA5QTE6IFwiZGFcIixcbiAgXHUwOUEyOiBcImRoYVwiLFxuICBcdTA5QTM6IFwibmFcIixcbiAgXHUwOUE0OiBcInRhXCIsXG4gIFx1MDlBNTogXCJ0aGFcIixcbiAgXHUwOUE2OiBcImRhXCIsXG4gIFx1MDlBNzogXCJkaGFcIixcbiAgXHUwOUE4OiBcIm5hXCIsXG4gIFx1MDlBQTogXCJwYVwiLFxuICBcdTA5QUI6IFwicGhhXCIsXG4gIFx1MDlBQzogXCJiYVwiLFxuICBcdTA5QUQ6IFwiYmhhXCIsXG4gIFx1MDlBRTogXCJtYVwiLFxuICBcdTA5QUY6IFwieWFcIixcbiAgXHUwOUIwOiBcInJhXCIsXG4gIFx1MDlCMjogXCJsYVwiLFxuICBcdTA5QjY6IFwic2hhXCIsXG4gIFx1MDlCNzogXCJzaGFcIixcbiAgXHUwOUI4OiBcInNhXCIsXG4gIFx1MDlCOTogXCJoYVwiLFxuICBcdTA5QTFcdTA5QkM6IFwicmFcIixcbiAgXHUwOUEyXHUwOUJDOiBcInJoYVwiLFxuICBcdTA5QUZcdTA5QkM6IFwieWFcIixcbiAgXCJcdTA5ODJcIjogXCJuZ1wiLFxuICBcIlx1MDk4M1wiOiBcImhcIixcbiAgXCJcdTA5ODFcIjogXCJcIixcbiAgXCJcdTA5Q0RcIjogXCJcIixcbiAgXCJcdTA5QzdcIjogXCJlXCIsXG4gIFwiXHUwOUM4XCI6IFwib2lcIixcbiAgXCJcdTA5Q0JcIjogXCJvXCIsXG4gIFwiXHUwOUNDXCI6IFwib3VcIixcbiAgXCJcdTA5QkVcIjogXCJhXCIsXG4gIFwiXHUwOUJGXCI6IFwiaVwiLFxuICBcIlx1MDlDMFwiOiBcImlcIixcbiAgXCJcdTA5QzFcIjogXCJ1XCIsXG4gIFwiXHUwOUMyXCI6IFwidVwiLFxuICBcIlx1MDlDM1wiOiBcInJpXCIsXG59O1xuXG5jb25zdCB0cmFuc2xpdGVyYXRlID0gKHRleHQ6IHN0cmluZyk6IHN0cmluZyA9PlxuICBbLi4udGV4dF0ubWFwKChjaGFyKSA9PiBCQU5HTEFfVE9fTEFUSU5bY2hhcl0gPz8gY2hhcikuam9pbihcIlwiKTtcblxuLy8gU2hhcmVkIGtlYmFiLWNhc2Ugc2x1Z2lmaWVyIHVzZWQgYnkgQ2F0ZWdvcnkgYW5kIFRvdXJQYWNrYWdlIHNsdWdzLiBOb24tTGF0aW5cbi8vIHNjcmlwdHMgKGUuZy4gQmFuZ2xhKSBhcmUgdHJhbnNsaXRlcmF0ZWQgZmlyc3Q7IGlmIHRoZSByZXN1bHQgaXMgc3RpbGwgZW1wdHlcbi8vIHRoZSBjYWxsZXIgbWF5IHN1cHBseSBhIGBmYWxsYmFja2AgKGUuZy4gXCJwYWNrYWdlLTxzaG9ydElkPlwiKS5cbmV4cG9ydCBjb25zdCBzbHVnaWZ5ID0gKHRleHQ6IHN0cmluZywgZmFsbGJhY2s/OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICBjb25zdCBzbHVnID0gdHJhbnNsaXRlcmF0ZSh0ZXh0KVxuICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgLnRyaW0oKVxuICAgIC5yZXBsYWNlKC9bXlxcd1xccy1dL2csIFwiXCIpXG4gICAgLnJlcGxhY2UoL1tcXHNfLV0rL2csIFwiLVwiKVxuICAgIC5yZXBsYWNlKC9eLSt8LSskL2csIFwiXCIpO1xuXG4gIHJldHVybiBzbHVnIHx8IGZhbGxiYWNrIHx8IFwiXCI7XG59OyIsICJpbXBvcnQgeyBQYWNrYWdlU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2x1Z2lmeSB9IGZyb20gXCIuLi8uLi91dGlscy9zbHVnaWZ5XCI7XG5pbXBvcnQgeyBJQ3JlYXRlQ2F0ZWdvcnksIElVcGRhdGVDYXRlZ29yeSB9IGZyb20gXCIuL2NhdGVnb3J5LmludGVyZmFjZVwiO1xuXG4vLyBGcmllbmRseSA0MDkgZm9yIEB1bmlxdWUgY29uZmxpY3RzIChuYW1lIG9yIHNsdWcpIGluc3RlYWQgb2YgYSByYXcgUDIwMDIuXG4vLyBleGNsdWRlSWQgbGV0cyB1cGRhdGVzIHNraXAgdGhlIHZlcnkgcm93IGJlaW5nIGVkaXRlZCBzbyBhIG5vLW9wIHJlbmFtZVxuLy8gZG9lc24ndCBmYWxzZS00MDkgYWdhaW5zdCBpdHNlbGYuXG5jb25zdCBhc3NlcnROYW1lQXZhaWxhYmxlID0gYXN5bmMgKFxuICBuYW1lOiBzdHJpbmcsXG4gIHNsdWc6IHN0cmluZyxcbiAgZXhjbHVkZUlkPzogc3RyaW5nLFxuKSA9PiB7XG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIE9SOiBbeyBuYW1lIH0sIHsgc2x1ZyB9XSxcbiAgICAgIC4uLihleGNsdWRlSWQgPyB7IE5PVDogeyBpZDogZXhjbHVkZUlkIH0gfSA6IHt9KSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoZXhpc3RpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIkEgY2F0ZWdvcnkgd2l0aCB0aGlzIG5hbWUgYWxyZWFkeSBleGlzdHNcIik7XG4gIH1cbn07XG5cbi8vIENyZWF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5jb25zdCBjcmVhdGVDYXRlZ29yeSA9IGFzeW5jIChwYXlsb2FkOiBJQ3JlYXRlQ2F0ZWdvcnkpID0+IHtcbiAgY29uc3QgeyBuYW1lIH0gPSBwYXlsb2FkO1xuICBjb25zdCBzbHVnID0gc2x1Z2lmeShuYW1lKTtcblxuICBhd2FpdCBhc3NlcnROYW1lQXZhaWxhYmxlKG5hbWUsIHNsdWcpO1xuXG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkuY3JlYXRlKHtcbiAgICBkYXRhOiB7IG5hbWUsIHNsdWcgfSxcbiAgfSk7XG59O1xuXG4vLyBHZXQgYWxsIGNhdGVnb3JpZXMgKHB1YmxpYykgd2l0aCBjb3VudHMgb2YgYXBwcm92ZWQsIG5vbi1kZWxldGVkIHBhY2thZ2VzXG5jb25zdCBnZXRBbGxDYXRlZ29yaWVzID0gYXN5bmMgKCkgPT4ge1xuICByZXR1cm4gcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KHtcbiAgICBvcmRlckJ5OiB7IG5hbWU6IFwiYXNjXCIgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBfY291bnQ6IHtcbiAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgcGFja2FnZXM6IHtcbiAgICAgICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgICAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG59O1xuXG4vLyBVcGRhdGUgY2F0ZWdvcnkgbmFtZSAocmVnZW5lcmF0ZXMgc2x1ZykgKGFkbWluKVxuY29uc3QgdXBkYXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nLCBwYXlsb2FkOiBJVXBkYXRlQ2F0ZWdvcnkpID0+IHtcbiAgY29uc3QgeyBuYW1lIH0gPSBwYXlsb2FkO1xuICBjb25zdCBzbHVnID0gc2x1Z2lmeShuYW1lKTtcblxuICBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9IH0pO1xuICBhd2FpdCBhc3NlcnROYW1lQXZhaWxhYmxlKG5hbWUsIHNsdWcsIGNhdGVnb3J5SWQpO1xuXG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9LFxuICAgIGRhdGE6IHsgbmFtZSwgc2x1ZyB9LFxuICB9KTtcbn07XG5cbi8vIERlbGV0ZSBjYXRlZ29yeSAoYWRtaW4pIFx1MjAxNCA0MDkgd2hlbiBhbnkgcGFja2FnZSByZWZlcmVuY2VzIGl0XG5jb25zdCBkZWxldGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93KHsgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSB9KTtcblxuICBjb25zdCBwYWNrYWdlQ291bnQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuY291bnQoe1xuICAgIHdoZXJlOiB7IGNhdGVnb3J5SWQgfSxcbiAgfSk7XG5cbiAgaWYgKHBhY2thZ2VDb3VudCA+IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBcIkNhbm5vdCBkZWxldGUgY2F0ZWdvcnkgd2l0aCBhc3NvY2lhdGVkIHBhY2thZ2VzLiBSZW5hbWUgaXQgaW5zdGVhZC5cIixcbiAgICApO1xuICB9XG5cbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmRlbGV0ZSh7IHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0gfSk7XG59O1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlTZXJ2aWNlID0ge1xuICBjcmVhdGVDYXRlZ29yeSxcbiAgZ2V0QWxsQ2F0ZWdvcmllcyxcbiAgdXBkYXRlQ2F0ZWdvcnksXG4gIGRlbGV0ZUNhdGVnb3J5LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgbmFtZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNhdGVnb3J5IG5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMiwgXCJDYXRlZ29yeSBuYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMTAwLCBcIkNhdGVnb3J5IG5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBjcmVhdGVDYXRlZ29yeVNjaGVtYSA9IHoub2JqZWN0KHsgbmFtZTogbmFtZVNjaGVtYSB9KS5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlQ2F0ZWdvcnlTY2hlbWEgPSB6Lm9iamVjdCh7IG5hbWU6IG5hbWVTY2hlbWEgfSkuc3RyaWN0KCk7XG5cbmNvbnN0IGNhdGVnb3J5UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlQ2F0ZWdvcnlTY2hlbWEsXG4gIHVwZGF0ZUNhdGVnb3J5U2NoZW1hLFxuICBjYXRlZ29yeVBhcmFtc1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBwYWNrYWdlQ29udHJvbGxlciB9IGZyb20gXCIuL3BhY2thZ2UuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgcGFja2FnZVZhbGlkYXRpb25zIH0gZnJvbSBcIi4vcGFja2FnZS52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBOT1RFOiBgL2ludGVybmFsLypgIHJvdXRlcyBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgYEdFVCAvOnNsdWdgIGJlbG93IFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYSBsaXRlcmFsIHNlZ21lbnQgKGAvaW50ZXJuYWwvYWxsYCkgd291bGRcbi8vIG90aGVyd2lzZSBiZSBzd2FsbG93ZWQgYnkgdGhlIGA6c2x1Z2AgcGFyYW0gcm91dGUgYW5kIDQwNCBmb3JldmVyLlxuXG4vLyAxLiBNeSBwYWNrYWdlcyAoYWdlbnQpIFx1MjAxNCBzZWxmLXByZXZpZXcgb2YgUEVORElORy9SRUpFQ1RFRCBiZWZvcmUgYXBwcm92YWxcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL215LXBhY2thZ2VzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMuaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldE15UGFja2FnZXMsXG4pO1xuXG4vLyAyLiBBbGwgcGFja2FnZXMgKGFkbWluIG1vZGVyYXRpb24gVUkpXG5yb3V0ZXIuZ2V0KFxuICBcIi9pbnRlcm5hbC9hbGxcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHBhY2thZ2VWYWxpZGF0aW9ucy5pbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0QWxsUGFja2FnZXMsXG4pO1xuXG4vLyAzLiBQdWJsaWMgcGFja2FnZSBkZXRhaWwgYnkgc2x1Z1xucm91dGVyLmdldChcbiAgXCIvOnNsdWdcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVNsdWdQYXJhbXNTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldFBhY2thZ2VCeVNsdWcsXG4pO1xuXG4vLyA0LiBDcmVhdGUgcGFja2FnZSAoYWdlbnQgY3JlYXRlcyBvd247IGFkbWluIGNhbiBjcmVhdGUgZm9yIGFueSBhZ2VudClcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLmNyZWF0ZVBhY2thZ2VTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmNyZWF0ZVBhY2thZ2UsXG4pO1xuXG4vLyA1LiBBcHByb3ZlL3JlamVjdCBwYWNrYWdlIChhZG1pbikgXHUyMDE0IHJlZ2lzdGVyZWQgYmVmb3JlIFBBVENIIC86aWQgZm9yIGNsYXJpdHlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLnVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmNoYW5nZVBhY2thZ2VTdGF0dXMsXG4pO1xuXG4vLyA2LiBVcGRhdGUgcGFja2FnZSAoYWdlbnQgb3duIC8gYWRtaW4gYW55KVxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHBhY2thZ2VWYWxpZGF0aW9ucy51cGRhdGVQYWNrYWdlU2NoZW1hLFxuICB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIudXBkYXRlUGFja2FnZSxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBhY2thZ2UgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5zb2Z0RGVsZXRlUGFja2FnZSxcbik7XG5cbi8vIDguIFB1YmxpYyBsaXN0aW5nIFx1MjAxNCBrZXB0IGxhc3Qgc28gbm9uZSBvZiB0aGUgYWJvdmUgcm91dGVzIGFyZSBzaGFkb3dlZFxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVF1ZXJ5U2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRQdWJsaWNQYWNrYWdlcyxcbik7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgcGFja2FnZVNlcnZpY2UgfSBmcm9tIFwiLi9wYWNrYWdlLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVC9BRE1JTilcbmNvbnN0IGNyZWF0ZVBhY2thZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5jcmVhdGVQYWNrYWdlKHJlcS51c2VyISwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseS4gSXQgd2lsbCBiZSB2aXNpYmxlIGFmdGVyIGFkbWluIGFwcHJvdmFsLlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgY29udHJvbGxlciAoZmlsdGVycyArIHBhZ2luYXRpb24pXG5jb25zdCBnZXRQdWJsaWNQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldFB1YmxpY1BhY2thZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBQdWJsaWMgcGFja2FnZSBkZXRhaWwgYnkgc2x1Z1xuY29uc3QgZ2V0UGFja2FnZUJ5U2x1ZyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHNsdWcgPSBTdHJpbmcocmVxLnBhcmFtcy5zbHVnKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRQYWNrYWdlQnlTbHVnKHNsdWcpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIEFsbCBwYWNrYWdlcyBjb250cm9sbGVyIChBRE1JTiBtb2RlcmF0aW9uKVxuY29uc3QgZ2V0QWxsUGFja2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRBbGxQYWNrYWdlcyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBwYWNrYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDUuIE15IHBhY2thZ2VzIGNvbnRyb2xsZXIgKEFHRU5UKVxuY29uc3QgZ2V0TXlQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldE15UGFja2FnZXModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIllvdXIgcGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA2LiBVcGRhdGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCB1cGRhdGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UudXBkYXRlUGFja2FnZShyZXEudXNlciEsIGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDcuIENoYW5nZSBwYWNrYWdlIHN0YXR1cyBjb250cm9sbGVyIChBRE1JTiBhcHByb3ZlL3JlamVjdClcbmNvbnN0IGNoYW5nZVBhY2thZ2VTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5jaGFuZ2VQYWNrYWdlU3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA4LiBTb2Z0IGRlbGV0ZSBwYWNrYWdlIGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHNvZnREZWxldGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgYXdhaXQgcGFja2FnZVNlcnZpY2Uuc29mdERlbGV0ZVBhY2thZ2UocmVxLnVzZXIhLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcGFja2FnZUNvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBhY2thZ2UsXG4gIGdldFB1YmxpY1BhY2thZ2VzLFxuICBnZXRQYWNrYWdlQnlTbHVnLFxuICBnZXRBbGxQYWNrYWdlcyxcbiAgZ2V0TXlQYWNrYWdlcyxcbiAgdXBkYXRlUGFja2FnZSxcbiAgY2hhbmdlUGFja2FnZVN0YXR1cyxcbiAgc29mdERlbGV0ZVBhY2thZ2UsXG59OyIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyBQYWNrYWdlU3RhdHVzLCBSb2xlLCBOb3RpZmljYXRpb25UeXBlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBub3RpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvbm90aWZpY2F0aW9uXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVQYWNrYWdlUGF5bG9hZCxcbiAgSUludGVybmFsUGFja2FnZVF1ZXJ5LFxuICBJUGFja2FnZVF1ZXJ5LFxuICBJUmVxdWVzdFVzZXIsXG4gIElVcGRhdGVQYWNrYWdlUGF5bG9hZCxcbiAgSVVwZGF0ZVN0YXR1c1BheWxvYWQsXG59IGZyb20gXCIuL3BhY2thZ2UuaW50ZXJmYWNlXCI7XG5cbi8vIE1vbmV5IGlzIGBEZWNpbWFsKDEwLDIpYCBpbiB0aGUgc2NoZW1hIChBR0VOVFMubWQpIFx1MjAxNCBtYXAgdG8gTnVtYmVyIG9uIHJldHVybi5cbmNvbnN0IHNlcmlhbGl6ZVByaWNlID0gPFQgZXh0ZW5kcyB7IHByaWNlOiBQcmlzbWEuRGVjaW1hbCB9Pihyb3c6IFQpOiBUID0+ICh7XG4gIC4uLnJvdyxcbiAgcHJpY2U6IE51bWJlcihyb3cucHJpY2UpLFxufSk7XG5cbi8vIFB1YmxpYyBwYXlsb2FkcyBjYXJyeSB0aGUgYWdlbnQncyBkaXNwbGF5IGluZm8gb25seSBcdTIwMTQgbmV2ZXIgZW1haWwuXG5leHBvcnQgY29uc3QgcHVibGljUGFja2FnZUluY2x1ZGUgPSB7XG4gIGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0sXG4gIGFnZW50OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgYXZhdGFyVXJsOiB0cnVlIH0gfSxcbn0gYXMgY29uc3Q7XG5cbmNvbnN0IHZhbGlkYXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghY2F0ZWdvcnkpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgY2F0ZWdvcnlJZFwiKTtcbiAgfVxufTtcblxuLy8gUGFja2FnZXMgbXVzdCBiZSBvd25lZCBieSBhIGxpdmUgQUdFTlQgXHUyMDE0IG90aGVyd2lzZSB0aGUgYm9va2luZyBzdGF0ZVxuLy8gbWFjaGluZSdzIFwiQUdFTlQgKG93bnMgcGFja2FnZSlcIiBicmFuY2ggYW5kIGFnZW50LWJvb2tpbmdzIHNjb3BpbmcgYnJlYWsuXG5jb25zdCB2YWxpZGF0ZUFnZW50ID0gYXN5bmMgKGFnZW50SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBhZ2VudCA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBhZ2VudElkIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlLCByb2xlOiB0cnVlLCBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCFhZ2VudCB8fCBhZ2VudC5yb2xlICE9PSBSb2xlLkFHRU5UIHx8IGFnZW50LmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBhZ2VudElkXCIpO1xuICB9XG59O1xuXG4vLyBDb2xsaXNpb24tc2FmZSBzbHVnOiBiYXNlIHNsdWcgZnJvbSB0aGUgdGl0bGUsIHRoZW4gYC0yYCwgYC0zYCwgLi4uIHVzaW5nIGFcbi8vIHNpbmdsZSBwcmVmaXggcXVlcnkuIFB1cmUtQmFuZ2xhL2Vtb2ppIHRpdGxlcyBjYW4ndCBzbHVnaWZ5IFx1MjAxNCBmYWxsIGJhY2sgdG9cbi8vIGBwYWNrYWdlLTxzaG9ydElkPmAgc28gdGhlIFVSTCBpcyBhbHdheXMgbWVhbmluZ2Z1bC5cbmNvbnN0IGdlbmVyYXRlVW5pcXVlU2x1ZyA9IGFzeW5jICh0aXRsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgY29uc3QgYmFzZSA9IHNsdWdpZnkodGl0bGUpIHx8IGBwYWNrYWdlLSR7cmFuZG9tVVVJRCgpLnNsaWNlKDAsIDgpfWA7XG5cbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgIHdoZXJlOiB7IHNsdWc6IHsgc3RhcnRzV2l0aDogYmFzZSB9IH0sXG4gICAgc2VsZWN0OiB7IHNsdWc6IHRydWUgfSxcbiAgfSk7XG5cbiAgY29uc3QgdXNlZCA9IG5ldyBTZXQoZXhpc3RpbmcubWFwKChwKSA9PiBwLnNsdWcpKTtcbiAgaWYgKCF1c2VkLmhhcyhiYXNlKSkge1xuICAgIHJldHVybiBiYXNlO1xuICB9XG5cbiAgbGV0IHN1ZmZpeCA9IDI7XG4gIHdoaWxlICh1c2VkLmhhcyhgJHtiYXNlfS0ke3N1ZmZpeH1gKSkge1xuICAgIHN1ZmZpeCArPSAxO1xuICB9XG4gIHJldHVybiBgJHtiYXNlfS0ke3N1ZmZpeH1gO1xufTtcblxuLy8gMS4gQ3JlYXRlIGEgcGFja2FnZSAoQUdFTlQvQURNSU4pLiBOZXcgcGFja2FnZXMgc3RhcnQgUEVORElORyBhbmQgbmV2ZXIgbGVha1xuLy8gICAgaW50byBwdWJsaWMgcXVlcmllcyB1bnRpbCBhbiBhZG1pbiBhcHByb3ZlcyB0aGVtLlxuY29uc3QgY3JlYXRlUGFja2FnZSA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBheWxvYWQ6IElDcmVhdGVQYWNrYWdlUGF5bG9hZCkgPT4ge1xuICBhd2FpdCB2YWxpZGF0ZUNhdGVnb3J5KHBheWxvYWQuY2F0ZWdvcnlJZCk7XG5cbiAgLy8gQURNSU4gbWF5IGNyZWF0ZSBvbiBiZWhhbGYgb2YgYW4gYWdlbnQgKG9wdGlvbmFsIGFnZW50SWQpOyBBR0VOVCBhbHdheXNcbiAgLy8gb3ducyB3aGF0IHRoZXkgY3JlYXRlIGFuZCBtYXkgbm90IGltcGVyc29uYXRlIGFub3RoZXIgdXNlci5cbiAgbGV0IGFnZW50SWQ6IHN0cmluZztcbiAgaWYgKHVzZXIucm9sZSA9PT0gUm9sZS5BRE1JTikge1xuICAgIGlmIChwYXlsb2FkLmFnZW50SWQpIHtcbiAgICAgIGF3YWl0IHZhbGlkYXRlQWdlbnQocGF5bG9hZC5hZ2VudElkKTtcbiAgICAgIGFnZW50SWQgPSBwYXlsb2FkLmFnZW50SWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFnZW50SWQgPSB1c2VyLmlkO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAocGF5bG9hZC5hZ2VudElkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcImFnZW50SWQgY2FuIG9ubHkgYmUgc2V0IGJ5IGFuIGFkbWluXCIpO1xuICAgIH1cbiAgICBhZ2VudElkID0gdXNlci5pZDtcbiAgfVxuXG4gIGNvbnN0IHNsdWcgPSBhd2FpdCBnZW5lcmF0ZVVuaXF1ZVNsdWcocGF5bG9hZC50aXRsZSk7XG5cbiAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIHRpdGxlOiBwYXlsb2FkLnRpdGxlLFxuICAgICAgZGVzY3JpcHRpb246IHBheWxvYWQuZGVzY3JpcHRpb24sXG4gICAgICBsb2NhdGlvbjogcGF5bG9hZC5sb2NhdGlvbixcbiAgICAgIHByaWNlOiBwYXlsb2FkLnByaWNlLFxuICAgICAgZHVyYXRpb246IHBheWxvYWQuZHVyYXRpb24sXG4gICAgICBjYXRlZ29yeUlkOiBwYXlsb2FkLmNhdGVnb3J5SWQsXG4gICAgICBpbWFnZXM6IHBheWxvYWQuaW1hZ2VzLFxuICAgICAgYWdlbnRJZCxcbiAgICAgIHNsdWcsXG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKGNyZWF0ZWQpO1xufTtcblxuLy8gMi4gUHVibGljIGV4cGxvcmVkIGxpc3RpbmcgXHUyMDE0IEFQUFJPVkVEICsgbm90LWRlbGV0ZWQgb25seSwgZmlsdGVycyArIHNvcnRpbmcuXG5jb25zdCBnZXRQdWJsaWNQYWNrYWdlcyA9IGFzeW5jIChxdWVyeTogSVBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IGZpbHRlcnM6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXRbXSA9IFtdO1xuXG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgT1I6IFtcbiAgICAgICAgeyB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICB7IGRlc2NyaXB0aW9uOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgIHsgbG9jYXRpb246IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5LmxvY2F0aW9uKSB7XG4gICAgZmlsdGVycy5wdXNoKHtcbiAgICAgIGxvY2F0aW9uOiB7IGNvbnRhaW5zOiBxdWVyeS5sb2NhdGlvbiwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0sXG4gICAgfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5Lm1pblByaWNlICE9PSB1bmRlZmluZWQgfHwgcXVlcnkubWF4UHJpY2UgIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICBwcmljZToge1xuICAgICAgICAuLi4ocXVlcnkubWluUHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgZ3RlOiBxdWVyeS5taW5QcmljZSB9IDoge30pLFxuICAgICAgICAuLi4ocXVlcnkubWF4UHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgbHRlOiBxdWVyeS5tYXhQcmljZSB9IDoge30pLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubWluUmF0aW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBmaWx0ZXJzLnB1c2goeyByYXRpbmc6IHsgZ3RlOiBxdWVyeS5taW5SYXRpbmcgfSB9KTtcbiAgfVxuICBpZiAocXVlcnkubWF4RHVyYXRpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7IGR1cmF0aW9uOiB7IGx0ZTogcXVlcnkubWF4RHVyYXRpb24gfSB9KTtcbiAgfVxuICBpZiAocXVlcnkuY2F0ZWdvcnkpIHtcbiAgICBmaWx0ZXJzLnB1c2goeyBjYXRlZ29yeTogeyBzbHVnOiBxdWVyeS5jYXRlZ29yeSB9IH0pO1xuICB9XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXQgPSB7XG4gICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgQU5EOiBmaWx0ZXJzLmxlbmd0aCA+IDAgPyBmaWx0ZXJzIDogdW5kZWZpbmVkLFxuICB9O1xuXG4gIGNvbnN0IHNvcnRPcmRlciA9IHF1ZXJ5LnNvcnRPcmRlciA/PyAocXVlcnkuc29ydEJ5ID09PSBcIm5ld2VzdFwiID8gXCJkZXNjXCIgOiBcImFzY1wiKTtcblxuICBjb25zdCBvcmRlckJ5TWFwOiBSZWNvcmQ8c3RyaW5nLCBQcmlzbWEuVG91clBhY2thZ2VPcmRlckJ5V2l0aFJlbGF0aW9uSW5wdXQ+ID0ge1xuICAgIG5ld2VzdDogeyBjcmVhdGVkQXQ6IHNvcnRPcmRlciB9LFxuICAgIHByaWNlOiB7IHByaWNlOiBzb3J0T3JkZXIgfSxcbiAgICByYXRpbmc6IHsgcmF0aW5nOiBzb3J0T3JkZXIgfSxcbiAgICB0aXRsZTogeyB0aXRsZTogc29ydE9yZGVyIH0sXG4gIH07XG5cbiAgY29uc3Qgb3JkZXJCeSA9IG9yZGVyQnlNYXBbcXVlcnkuc29ydEJ5ID8/IFwibmV3ZXN0XCJdID8/IG9yZGVyQnlNYXAubmV3ZXN0O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeSxcbiAgICAgIGluY2x1ZGU6IHB1YmxpY1BhY2thZ2VJbmNsdWRlLFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVByaWNlKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAzLiBQdWJsaWMgZGV0YWlsIGJ5IHNsdWcgXHUyMDE0IEFQUFJPVkVEICsgbm90LWRlbGV0ZWQgb25seS5cbmNvbnN0IGdldFBhY2thZ2VCeVNsdWcgPSBhc3luYyAoc2x1Zzogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHsgc2x1Zywgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgaW5jbHVkZTogcHVibGljUGFja2FnZUluY2x1ZGUsXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh0b3VyUGFja2FnZSk7XG59O1xuXG4vLyA0LiBBbGwgcGFja2FnZXMgZm9yIHRoZSBhZG1pbiBtb2RlcmF0aW9uIFVJIChhbnkgc3RhdHVzLCBvcHRpb25hbCBmaWx0ZXJzKS5cbmNvbnN0IGdldEFsbFBhY2thZ2VzID0gYXN5bmMgKHF1ZXJ5OiBJSW50ZXJuYWxQYWNrYWdlUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zdGF0dXMgPyB7IHN0YXR1czogcXVlcnkuc3RhdHVzIH0gOiB7fSksXG4gICAgLi4uKHF1ZXJ5LmFnZW50SWQgPyB7IGFnZW50SWQ6IHF1ZXJ5LmFnZW50SWQgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgICAgICAgYWdlbnQ6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDUuIEFuIGFnZW50J3Mgb3duIHBhY2thZ2VzIChhbnkgc3RhdHVzKSBcdTIwMTQgc2VsZi1wcmV2aWV3IGJlZm9yZSBhcHByb3ZhbC5cbmNvbnN0IGdldE15UGFja2FnZXMgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJSW50ZXJuYWxQYWNrYWdlUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBhZ2VudElkOiB1c2VySWQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIEZldGNoICsgb3duZXJzaGlwIGdhdGUgc2hhcmVkIGJ5IFBBVENIIGFuZCBERUxFVEUuIEFETUlOIGJ5cGFzc2VzIG93bmVyc2hpcDtcbi8vIEFHRU5UIGVkaXRzIGFyZSBjb25maW5lZCB0byB0aGVpciBvd24gcGFja2FnZXMuXG5jb25zdCBmaW5kT3duZWRQYWNrYWdlID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGFja2FnZUlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBpZiAodXNlci5yb2xlICE9PSBSb2xlLkFETUlOICYmIHRvdXJQYWNrYWdlLmFnZW50SWQgIT09IHVzZXIuaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW4gb25seSBhY3Qgb24geW91ciBvd24gcGFja2FnZXMuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHRvdXJQYWNrYWdlO1xufTtcblxuLy8gNi4gVXBkYXRlIGEgcGFja2FnZS4gU2x1ZyBuZXZlciBjaGFuZ2VzIChrZWVwcyBsaW5rcy9ib29rbWFya3MgdmFsaWQpLlxuLy8gICAgQUdFTlQgZWRpdHMgcmVzZXQgc3RhdHVzIHRvIFBFTkRJTkc7IEFETUlOIGVkaXRzIHByZXNlcnZlIGl0LlxuY29uc3QgdXBkYXRlUGFja2FnZSA9IGFzeW5jIChcbiAgdXNlcjogSVJlcXVlc3RVc2VyLFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVBhY2thZ2VQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgZmluZE93bmVkUGFja2FnZSh1c2VyLCBwYWNrYWdlSWQpO1xuXG4gIGlmIChwYXlsb2FkLmNhdGVnb3J5SWQgIT09IHVuZGVmaW5lZCkge1xuICAgIGF3YWl0IHZhbGlkYXRlQ2F0ZWdvcnkocGF5bG9hZC5jYXRlZ29yeUlkKTtcbiAgfVxuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZUlucHV0ID0ge1xuICAgIC4uLihwYXlsb2FkLnRpdGxlICE9PSB1bmRlZmluZWQgPyB7IHRpdGxlOiBwYXlsb2FkLnRpdGxlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZGVzY3JpcHRpb24gIT09IHVuZGVmaW5lZCA/IHsgZGVzY3JpcHRpb246IHBheWxvYWQuZGVzY3JpcHRpb24gfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5sb2NhdGlvbiAhPT0gdW5kZWZpbmVkID8geyBsb2NhdGlvbjogcGF5bG9hZC5sb2NhdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLnByaWNlICE9PSB1bmRlZmluZWQgPyB7IHByaWNlOiBwYXlsb2FkLnByaWNlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZHVyYXRpb24gIT09IHVuZGVmaW5lZCA/IHsgZHVyYXRpb246IHBheWxvYWQuZHVyYXRpb24gfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5pbWFnZXMgIT09IHVuZGVmaW5lZCA/IHsgaW1hZ2VzOiBwYXlsb2FkLmltYWdlcyB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNhdGVnb3J5SWQgIT09IHVuZGVmaW5lZFxuICAgICAgPyB7IGNhdGVnb3J5OiB7IGNvbm5lY3Q6IHsgaWQ6IHBheWxvYWQuY2F0ZWdvcnlJZCB9IH0gfVxuICAgICAgOiB7fSksXG4gICAgLi4uKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiA/IHsgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLlBFTkRJTkcgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGEsXG4gICAgaW5jbHVkZTogeyBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9IH0sXG4gIH0pO1xuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh1cGRhdGVkKTtcbn07XG5cbi8vIDcuIEFwcHJvdmUvcmVqZWN0IGEgcGFja2FnZSAoYWRtaW4pLlxuY29uc3QgY2hhbmdlUGFja2FnZVN0YXR1cyA9IGFzeW5jIChcbiAgcGFja2FnZUlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVTdGF0dXNQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWVPclRocm93KHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gIH0pO1xuXG4gIGlmICh0b3VyUGFja2FnZS5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkNhbm5vdCBjaGFuZ2UgdGhlIHN0YXR1cyBvZiBhIGRlbGV0ZWQgcGFja2FnZS5cIik7XG4gIH1cblxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGE6IHsgc3RhdHVzOiBwYXlsb2FkLnN0YXR1cyB9LFxuICB9KTtcblxuICAvLyBiZXN0LWVmZm9ydCBpbi1hcHAgbm90aWZpY2F0aW9uIHRvIHRoZSBzdWJtaXR0aW5nIGFnZW50IChuZXZlciBmYWlscyByZXF1ZXN0KVxuICBjb25zdCBub3RpZmllZCA9IHtcbiAgICB0eXBlOlxuICAgICAgcGF5bG9hZC5zdGF0dXMgPT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgICAgICAgPyBOb3RpZmljYXRpb25UeXBlLlBBQ0tBR0VfQVBQUk9WRURcbiAgICAgICAgOiBOb3RpZmljYXRpb25UeXBlLlBBQ0tBR0VfUkVKRUNURUQsXG4gICAgdGl0bGU6XG4gICAgICBwYXlsb2FkLnN0YXR1cyA9PT0gUGFja2FnZVN0YXR1cy5BUFBST1ZFRFxuICAgICAgICA/IFwiUGFja2FnZSBhcHByb3ZlZFwiXG4gICAgICAgIDogXCJQYWNrYWdlIHJlamVjdGVkXCIsXG4gICAgbWVzc2FnZTpcbiAgICAgIHBheWxvYWQuc3RhdHVzID09PSBQYWNrYWdlU3RhdHVzLkFQUFJPVkVEXG4gICAgICAgID8gYFlvdXIgcGFja2FnZSBcIiR7dG91clBhY2thZ2UudGl0bGV9XCIgaGFzIGJlZW4gYXBwcm92ZWQgYW5kIGlzIG5vdyBsaXZlLmBcbiAgICAgICAgOiBgWW91ciBwYWNrYWdlIFwiJHt0b3VyUGFja2FnZS50aXRsZX1cIiB3YXMgcmVqZWN0ZWQuIFBsZWFzZSByZXZpZXcgYW5kIHJlc3VibWl0LmAsXG4gIH07XG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBub3RpZnkoXG4gICAgICB0b3VyUGFja2FnZS5hZ2VudElkLFxuICAgICAgbm90aWZpZWQudHlwZSxcbiAgICAgIG5vdGlmaWVkLnRpdGxlLFxuICAgICAgbm90aWZpZWQubWVzc2FnZSxcbiAgICAgIGAvZGFzaGJvYXJkL2FnZW50L3BhY2thZ2VzLyR7cGFja2FnZUlkfWAsXG4gICAgKSxcbiAgXSk7XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKHVwZGF0ZWQpO1xufTtcblxuLy8gOC4gU29mdCBkZWxldGUgKGFkbWluIGFueSwgYWdlbnQgb3duKS5cbmNvbnN0IHNvZnREZWxldGVQYWNrYWdlID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGFja2FnZUlkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUGFja2FnZSh1c2VyLCBwYWNrYWdlSWQpO1xuXG4gIHJldHVybiBwcmlzbWEudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgcGFja2FnZVNlcnZpY2UgPSB7XG4gIGNyZWF0ZVBhY2thZ2UsXG4gIGdldFB1YmxpY1BhY2thZ2VzLFxuICBnZXRQYWNrYWdlQnlTbHVnLFxuICBnZXRBbGxQYWNrYWdlcyxcbiAgZ2V0TXlQYWNrYWdlcyxcbiAgdXBkYXRlUGFja2FnZSxcbiAgY2hhbmdlUGFja2FnZVN0YXR1cyxcbiAgc29mdERlbGV0ZVBhY2thZ2UsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCB0aXRsZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlRpdGxlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDMsIFwiVGl0bGUgbXVzdCBiZSBhdCBsZWFzdCAzIGNoYXJhY3RlcnNcIilcbiAgLm1heCgyMDAsIFwiVGl0bGUgbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBkZXNjcmlwdGlvblNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkRlc2NyaXB0aW9uIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEwLCBcIkRlc2NyaXB0aW9uIG11c3QgYmUgYXQgbGVhc3QgMTAgY2hhcmFjdGVyc1wiKVxuICAubWF4KDEwMDAwLCBcIkRlc2NyaXB0aW9uIG11c3QgYmUgYXQgbW9zdCAxMDAwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBsb2NhdGlvblNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkxvY2F0aW9uIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDIsIFwiTG9jYXRpb24gbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgLm1heCgyMDAsIFwiTG9jYXRpb24gbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBwcmljZVNjaGVtYSA9IHpcbiAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIlByaWNlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnBvc2l0aXZlKFwiUHJpY2UgbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiKVxuICAucmVmaW5lKCh2YWwpID0+IE1hdGgucm91bmQodmFsICogMTAwKSAvIDEwMCA9PT0gdmFsLCB7XG4gICAgbWVzc2FnZTogXCJQcmljZSBtdXN0IGhhdmUgYXQgbW9zdCAyIGRlY2ltYWwgcGxhY2VzXCIsXG4gIH0pO1xuXG5jb25zdCBkdXJhdGlvblNjaGVtYSA9IHpcbiAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIkR1cmF0aW9uIGlzIHJlcXVpcmVkXCIgfSlcbiAgLmludChcIkR1cmF0aW9uIG11c3QgYmUgYSB3aG9sZSBudW1iZXIgb2YgZGF5c1wiKVxuICAubWluKDEsIFwiRHVyYXRpb24gbXVzdCBiZSBhdCBsZWFzdCAxIGRheVwiKTtcblxuY29uc3QgY2F0ZWdvcnlJZFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNhdGVnb3J5IGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgLm1pbigxLCBcIkNhdGVnb3J5IGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpO1xuXG5jb25zdCBpbWFnZXNTY2hlbWEgPSB6XG4gIC5hcnJheSh6LnN0cmluZygpLnVybChcIkVhY2ggaW1hZ2UgbXVzdCBiZSBhIHZhbGlkIFVSTFwiKSlcbiAgLm1pbigxLCBcIkF0IGxlYXN0IG9uZSBpbWFnZSBpcyByZXF1aXJlZFwiKVxuICAubWF4KDYsIFwiQXQgbW9zdCA2IGltYWdlcyBhcmUgYWxsb3dlZFwiKTtcblxuY29uc3QgY3JlYXRlUGFja2FnZVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLFxuICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvblNjaGVtYSxcbiAgICBsb2NhdGlvbjogbG9jYXRpb25TY2hlbWEsXG4gICAgcHJpY2U6IHByaWNlU2NoZW1hLFxuICAgIGR1cmF0aW9uOiBkdXJhdGlvblNjaGVtYSxcbiAgICBjYXRlZ29yeUlkOiBjYXRlZ29yeUlkU2NoZW1hLFxuICAgIGltYWdlczogaW1hZ2VzU2NoZW1hLFxuICAgIGFnZW50SWQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlUGFja2FnZVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgbG9jYXRpb246IGxvY2F0aW9uU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgcHJpY2U6IHByaWNlU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgZHVyYXRpb246IGR1cmF0aW9uU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgY2F0ZWdvcnlJZDogY2F0ZWdvcnlJZFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGltYWdlczogaW1hZ2VzU2NoZW1hLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiBPYmplY3Qua2V5cyhkYXRhKS5sZW5ndGggPiAwLCB7XG4gICAgbWVzc2FnZTogXCJBdCBsZWFzdCBvbmUgZmllbGQgbXVzdCBiZSBwcm92aWRlZCB0byB1cGRhdGVcIixcbiAgfSk7XG5cbmNvbnN0IHBhY2thZ2VRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgY2F0ZWdvcnk6IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIGxvY2F0aW9uOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBtaW5QcmljZTogei5jb2VyY2UubnVtYmVyKCkucG9zaXRpdmUoKS5vcHRpb25hbCgpLFxuICAgIG1heFByaWNlOiB6LmNvZXJjZS5udW1iZXIoKS5wb3NpdGl2ZSgpLm9wdGlvbmFsKCksXG4gICAgbWluUmF0aW5nOiB6LmNvZXJjZS5udW1iZXIoKS5taW4oMCkubWF4KDUpLm9wdGlvbmFsKCksXG4gICAgbWF4RHVyYXRpb246IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5vcHRpb25hbCgpLFxuICAgIHNvcnRCeTogelxuICAgICAgLmVudW0oW1wibmV3ZXN0XCIsIFwicHJpY2VcIiwgXCJyYXRpbmdcIiwgXCJ0aXRsZVwiXSlcbiAgICAgIC5kZWZhdWx0KFwibmV3ZXN0XCIpLFxuICAgIHNvcnRPcmRlcjogei5lbnVtKFtcImFzY1wiLCBcImRlc2NcIl0pLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5yZWZpbmUoKGRhdGEpID0+IHtcbiAgICBpZiAoZGF0YS5taW5QcmljZSAhPT0gdW5kZWZpbmVkICYmIGRhdGEubWF4UHJpY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGRhdGEubWluUHJpY2UgPD0gZGF0YS5tYXhQcmljZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sIHtcbiAgICBtZXNzYWdlOiBcIm1pblByaWNlIG11c3QgYmUgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIG1heFByaWNlXCIsXG4gICAgcGF0aDogW1wibWluUHJpY2VcIl0sXG4gIH0pO1xuXG5jb25zdCBpbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc3RhdHVzOiB6XG4gICAgLmVudW0oW1wiUEVORElOR1wiLCBcIkFQUFJPVkVEXCIsIFwiUkVKRUNURURcIl0pXG4gICAgLnRyYW5zZm9ybSgodmFsKSA9PiB2YWwgYXMgXCJQRU5ESU5HXCIgfCBcIkFQUFJPVkVEXCIgfCBcIlJFSkVDVEVEXCIpXG4gICAgLm9wdGlvbmFsKCksXG4gIGFnZW50SWQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgcGFja2FnZVBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBwYWNrYWdlU2x1Z1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc2x1Zzogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIHNsdWcgaXMgcmVxdWlyZWRcIiB9KS50cmltKCkubWluKDEpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgc3RhdHVzOiB6LmVudW0oW1wiQVBQUk9WRURcIiwgXCJSRUpFQ1RFRFwiXSwge1xuICAgICAgcmVxdWlyZWRfZXJyb3I6IFwiU3RhdHVzIGlzIHJlcXVpcmVkXCIsXG4gICAgICBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiU3RhdHVzIG11c3QgYmUgQVBQUk9WRUQgb3IgUkVKRUNURURcIixcbiAgICB9KSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5leHBvcnQgY29uc3QgcGFja2FnZVZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVQYWNrYWdlU2NoZW1hLFxuICB1cGRhdGVQYWNrYWdlU2NoZW1hLFxuICBwYWNrYWdlUXVlcnlTY2hlbWEsXG4gIGludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hLFxuICBwYWNrYWdlUGFyYW1zU2NoZW1hLFxuICBwYWNrYWdlU2x1Z1BhcmFtc1NjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGJsb2dDb250cm9sbGVyIH0gZnJvbSBcIi4vYmxvZy5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBibG9nVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9ibG9nLnZhbGlkYXRpb25cIjtcbmltcG9ydCB7IGJsb2dDb21tZW50Q29udHJvbGxlciB9IGZyb20gXCIuL2Jsb2dDb21tZW50LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGJsb2dDb21tZW50VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9ibG9nQ29tbWVudC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBOT1RFOiBgL2ludGVybmFsLypgIHJvdXRlcyBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgYEdFVCAvOnNsdWdgIGJlbG93IFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYSBsaXRlcmFsIHNlZ21lbnQgKGAvaW50ZXJuYWwvYWxsYCkgd291bGRcbi8vIG90aGVyd2lzZSBiZSBzd2FsbG93ZWQgYnkgdGhlIGA6c2x1Z2AgcGFyYW0gcm91dGUgYW5kIDQwNCBmb3JldmVyLlxuXG4vLyAxLiBBbGwgcG9zdHMgKGFkbWluIG1vZGVyYXRpb24gVUkpIFx1MjAxNCByZWdpc3RlcmVkIGJlZm9yZSAvOnNsdWdcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL2FsbFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLmludGVybmFsUXVlcnlTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldEFsbFBvc3RzLFxuKTtcblxuLy8gMWIuIE93biBwb3N0cyAoXCJNeSBQb3N0c1wiIFVJIGZvciBhZ2VudHMvYWRtaW5zKSBcdTIwMTQgYmVmb3JlIC86c2x1Z1xucm91dGVyLmdldChcbiAgXCIvbXktcG9zdHNcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJsb2dWYWxpZGF0aW9ucy5pbnRlcm5hbFF1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRNeVBvc3RzLFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgXHUyMDE0IFBVQkxJU0hFRCArIG5vdC1kZWxldGVkIG9ubHlcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLnB1YmxpY1F1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRQdWJsaWNQb3N0cyxcbik7XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi86c2x1Z1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0U2x1Z1BhcmFtc1NjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0UG9zdEJ5U2x1Zyxcbik7XG5cbi8vIDQuIENyZWF0ZSBwb3N0IChhZ2VudC9hZG1pbiBhdXRob3JzIG93biBwb3N0czsgbmV3IHBvc3RzIHN0YXJ0IERSQUZUKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBibG9nVmFsaWRhdGlvbnMuY3JlYXRlUG9zdFNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuY3JlYXRlUG9zdCxcbik7XG5cbi8vIFx1MjUwMFx1MjUwMCBDb21tZW50cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIE5PVEU6IHRoaXMgYmxvY2sgc3RheXMgYmVmb3JlIFBBVENIIC86aWQvc3RhdHVzIHNvIERFTEVURSAvY29tbWVudHMvOmlkIGlzXG4vLyBuZXZlciBzaGFkb3dlZCBcdTIwMTQgYW5kIG5vIGJhcmUgUEFUQ0ggLzpzbHVnIG9yIERFTEVURSAvOnNsdWcgaXMgZXZlciBhZGRlZC5cblxuLy8gNGEuIFB1YmxpYyBjb21tZW50cyBmb3IgYSBwb3N0IChQVUJMSVNIRUQgKyBub24tZGVsZXRlZCBwb3N0IG9ubHkpXG5yb3V0ZXIuZ2V0KFxuICBcIi86c2x1Zy9jb21tZW50c1wiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RTbHVnUGFyYW1zU2NoZW1hLFxuICAgIHF1ZXJ5OiBibG9nQ29tbWVudFZhbGlkYXRpb25zLmNvbW1lbnRRdWVyeVNjaGVtYSxcbiAgfSksXG4gIGJsb2dDb21tZW50Q29udHJvbGxlci5nZXRQb3N0Q29tbWVudHMsXG4pO1xuXG4vLyA0Yi4gQ3JlYXRlIGEgY29tbWVudCAoYW55IGF1dGhlbnRpY2F0ZWQgdXNlcilcbnJvdXRlci5wb3N0KFxuICBcIi86c2x1Zy9jb21tZW50c1wiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFNsdWdQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogYmxvZ0NvbW1lbnRWYWxpZGF0aW9ucy5jcmVhdGVDb21tZW50U2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbW1lbnRDb250cm9sbGVyLmNyZWF0ZUNvbW1lbnQsXG4pO1xuXG4vLyA0Yy4gU29mdCBkZWxldGUgYSBjb21tZW50IChvd25lciBvciBBRE1JTilcbnJvdXRlci5kZWxldGUoXG4gIFwiL2NvbW1lbnRzLzppZFwiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogYmxvZ0NvbW1lbnRWYWxpZGF0aW9ucy5jb21tZW50UGFyYW1zU2NoZW1hIH0pLFxuICBibG9nQ29tbWVudENvbnRyb2xsZXIuZGVsZXRlQ29tbWVudCxcbik7XG5cbi8vIDUuIFB1Ymxpc2gvdW5wdWJsaXNoIHBvc3QgKGFkbWluKSBcdTIwMTQgcmVnaXN0ZXJlZCBiZWZvcmUgUEFUQ0ggLzppZCBmb3IgY2xhcml0eVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBibG9nVmFsaWRhdGlvbnMudXBkYXRlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuY2hhbmdlUG9zdFN0YXR1cyxcbik7XG5cbi8vIDYuIFVwZGF0ZSBwb3N0IChhZ2VudCBvd24gLyBhZG1pbiBhbnkpIFx1MjAxNCBhZ2VudCBlZGl0cyByZXNldCB0byBEUkFGVFxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJsb2dWYWxpZGF0aW9ucy51cGRhdGVQb3N0U2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIudXBkYXRlUG9zdCxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBvc3QgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5zb2Z0RGVsZXRlUG9zdCxcbik7XG5cbmV4cG9ydCBjb25zdCBibG9nUm91dGVzID0gcm91dGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBibG9nU2VydmljZSB9IGZyb20gXCIuL2Jsb2cuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBwb3N0IGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgY3JlYXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmNyZWF0ZVBvc3QocmVxLnVzZXIhLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQb3N0IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LiBJdCB3aWxsIGJlIHZpc2libGUgYWZ0ZXIgcHVibGlzaGluZy5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIFB1YmxpYyBsaXN0aW5nIGNvbnRyb2xsZXIgKHNlYXJjaCArIHNvcnQgKyBwYWdpbmF0aW9uKVxuY29uc3QgZ2V0UHVibGljUG9zdHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRQdWJsaWNQb3N0cyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gUHVibGljIHBvc3QgZGV0YWlsIGJ5IHNsdWdcbmNvbnN0IGdldFBvc3RCeVNsdWcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0UG9zdEJ5U2x1ZyhzbHVnKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0IHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBBbGwgcG9zdHMgY29udHJvbGxlciAoQURNSU4gbW9kZXJhdGlvbilcbmNvbnN0IGdldEFsbFBvc3RzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0QWxsUG9zdHMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgcG9zdHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0Yi4gT3duIHBvc3RzIGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgZ2V0TXlQb3N0cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldE15UG9zdHMocmVxLnVzZXIhLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNS4gVXBkYXRlIHBvc3QgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3QgdXBkYXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLnVwZGF0ZVBvc3QocmVxLnVzZXIhLCBpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA2LiBDaGFuZ2UgcG9zdCBzdGF0dXMgY29udHJvbGxlciAoQURNSU4gcHVibGlzaC91bnB1Ymxpc2gpXG5jb25zdCBjaGFuZ2VQb3N0U3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuY2hhbmdlUG9zdFN0YXR1cyhpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3Qgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNy4gU29mdCBkZWxldGUgcG9zdCBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCBzb2Z0RGVsZXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGF3YWl0IGJsb2dTZXJ2aWNlLnNvZnREZWxldGVQb3N0KHJlcS51c2VyISwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJsb2dDb250cm9sbGVyID0ge1xuICBjcmVhdGVQb3N0LFxuICBnZXRQdWJsaWNQb3N0cyxcbiAgZ2V0UG9zdEJ5U2x1ZyxcbiAgZ2V0QWxsUG9zdHMsXG4gIGdldE15UG9zdHMsXG4gIHVwZGF0ZVBvc3QsXG4gIGNoYW5nZVBvc3RTdGF0dXMsXG4gIHNvZnREZWxldGVQb3N0LFxufTtcbiIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyBQb3N0U3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVQb3N0UGF5bG9hZCxcbiAgSUludGVybmFsUG9zdFF1ZXJ5LFxuICBJUG9zdFF1ZXJ5LFxuICBJUmVxdWVzdFVzZXIsXG4gIElVcGRhdGVQb3N0UGF5bG9hZCxcbiAgSVVwZGF0ZVBvc3RTdGF0dXNQYXlsb2FkLFxufSBmcm9tIFwiLi9ibG9nLmludGVyZmFjZVwiO1xuXG4vLyBQdWJsaWMgcGF5bG9hZHMgY2FycnkgdGhlIGF1dGhvcidzIGRpc3BsYXkgaW5mbyBvbmx5IFx1MjAxNCBuZXZlciBlbWFpbC9yb2xlLlxuZXhwb3J0IGNvbnN0IHB1YmxpY0F1dGhvclNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSxcbn07XG5cbi8vIENvbGxpc2lvbi1zYWZlIHNsdWc6IGJhc2Ugc2x1ZyBmcm9tIHRoZSB0aXRsZSwgdGhlbiBgLTJgLCBgLTNgLCAuLi4gdXNpbmcgYVxuLy8gc2luZ2xlIHByZWZpeCBxdWVyeS4gUHVyZS1CYW5nbGEvZW1vamkgdGl0bGVzIGNhbid0IHNsdWdpZnkgXHUyMDE0IGZhbGwgYmFjayB0b1xuLy8gYGJsb2ctPHNob3J0SWQ+YCBzbyB0aGUgVVJMIGlzIGFsd2F5cyBtZWFuaW5nZnVsLlxuY29uc3QgZ2VuZXJhdGVVbmlxdWVTbHVnID0gYXN5bmMgKHRpdGxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICBjb25zdCBiYXNlID0gc2x1Z2lmeSh0aXRsZSkgfHwgYGJsb2ctJHtyYW5kb21VVUlEKCkuc2xpY2UoMCwgOCl9YDtcblxuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgd2hlcmU6IHsgc2x1ZzogeyBzdGFydHNXaXRoOiBiYXNlIH0gfSxcbiAgICBzZWxlY3Q6IHsgc2x1ZzogdHJ1ZSB9LFxuICB9KTtcblxuICBjb25zdCB1c2VkID0gbmV3IFNldChleGlzdGluZy5tYXAoKHApID0+IHAuc2x1ZykpO1xuICBpZiAoIXVzZWQuaGFzKGJhc2UpKSB7XG4gICAgcmV0dXJuIGJhc2U7XG4gIH1cblxuICBsZXQgc3VmZml4ID0gMjtcbiAgd2hpbGUgKHVzZWQuaGFzKGAke2Jhc2V9LSR7c3VmZml4fWApKSB7XG4gICAgc3VmZml4ICs9IDE7XG4gIH1cbiAgcmV0dXJuIGAke2Jhc2V9LSR7c3VmZml4fWA7XG59O1xuXG4vLyAxLiBDcmVhdGUgYSBwb3N0IChBR0VOVC9BRE1JTikuIE5ldyBwb3N0cyBzdGFydCBEUkFGVCBhbmQgbmV2ZXIgbGVhayBpbnRvXG4vLyAgICBwdWJsaWMgcXVlcmllcyB1bnRpbCBhbiBhZG1pbiBwdWJsaXNoZXMgdGhlbS5cbmNvbnN0IGNyZWF0ZVBvc3QgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYXlsb2FkOiBJQ3JlYXRlUG9zdFBheWxvYWQpID0+IHtcbiAgY29uc3Qgc2x1ZyA9IGF3YWl0IGdlbmVyYXRlVW5pcXVlU2x1ZyhwYXlsb2FkLnRpdGxlKTtcblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgdGl0bGU6IHBheWxvYWQudGl0bGUsXG4gICAgICBleGNlcnB0OiBwYXlsb2FkLmV4Y2VycHQsXG4gICAgICBjb250ZW50OiBwYXlsb2FkLmNvbnRlbnQsXG4gICAgICBjb3ZlckltYWdlOiBwYXlsb2FkLmNvdmVySW1hZ2UsXG4gICAgICBzbHVnLFxuICAgICAgYXV0aG9ySWQ6IHVzZXIuaWQsXG4gICAgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gMi4gUHVibGljIGJsb2cgbGlzdGluZyBcdTIwMTQgUFVCTElTSEVEICsgbm90LWRlbGV0ZWQgb25seSwgc2VhcmNoICsgc29ydC5cbmNvbnN0IGdldFB1YmxpY1Bvc3RzID0gYXN5bmMgKHF1ZXJ5OiBJUG9zdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5CbG9nUG9zdFdoZXJlSW5wdXQgPSB7XG4gICAgc3RhdHVzOiBQb3N0U3RhdHVzLlBVQkxJU0hFRCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zZWFyY2hcbiAgICAgID8ge1xuICAgICAgICAgIE9SOiBbXG4gICAgICAgICAgICB7IHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgICAgICB7IGV4Y2VycHQ6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9XG4gICAgICA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBzb3J0T3JkZXIgPSBxdWVyeS5zb3J0T3JkZXIgPz8gKHF1ZXJ5LnNvcnRCeSA9PT0gXCJvbGRlc3RcIiA/IFwiYXNjXCIgOiBcImRlc2NcIik7XG5cbiAgY29uc3Qgb3JkZXJCeU1hcDogUmVjb3JkPHN0cmluZywgUHJpc21hLkJsb2dQb3N0T3JkZXJCeVdpdGhSZWxhdGlvbklucHV0PiA9IHtcbiAgICBuZXdlc3Q6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgIG9sZGVzdDogeyBjcmVhdGVkQXQ6IFwiYXNjXCIgfSxcbiAgICB0aXRsZTogeyB0aXRsZTogc29ydE9yZGVyIH0sXG4gIH07XG5cbiAgY29uc3Qgb3JkZXJCeSA9IG9yZGVyQnlNYXBbcXVlcnkuc29ydEJ5ID8/IFwibmV3ZXN0XCJdID8/IG9yZGVyQnlNYXAubmV3ZXN0O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeSxcbiAgICAgIHNlbGVjdDoge1xuICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgdGl0bGU6IHRydWUsXG4gICAgICAgIHNsdWc6IHRydWUsXG4gICAgICAgIGV4Y2VycHQ6IHRydWUsXG4gICAgICAgIGNvdmVySW1hZ2U6IHRydWUsXG4gICAgICAgIGNyZWF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgdXBkYXRlZEF0OiB0cnVlLFxuICAgICAgICBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCxcbiAgICAgIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmJsb2dQb3N0LmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAzLiBQdWJsaWMgcG9zdCBkZXRhaWwgYnkgc2x1ZyBcdTIwMTQgUFVCTElTSEVEICsgbm90LWRlbGV0ZWQgb25seS5cbmNvbnN0IGdldFBvc3RCeVNsdWcgPSBhc3luYyAoc2x1Zzogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHBvc3QgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZEZpcnN0KHtcbiAgICB3aGVyZTogeyBzbHVnLCBzdGF0dXM6IFBvc3RTdGF0dXMuUFVCTElTSEVELCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcblxuICBpZiAoIXBvc3QpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBvc3Qgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwb3N0O1xufTtcblxuLy8gNC4gQWxsIHBvc3RzIGZvciB0aGUgYWRtaW4gbW9kZXJhdGlvbiBVSSAoYW55IHN0YXR1cywgb3B0aW9uYWwgZmlsdGVyKS5cbmNvbnN0IGdldEFsbFBvc3RzID0gYXN5bmMgKHF1ZXJ5OiBJSW50ZXJuYWxQb3N0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkJsb2dQb3N0V2hlcmVJbnB1dCA9IHtcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zdGF0dXMgPyB7IHN0YXR1czogcXVlcnkuc3RhdHVzIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IGF1dGhvcjogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0gfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmJsb2dQb3N0LmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyA0Yi4gVGhlIGNhbGxlcidzIG93biBwb3N0cyAoQUdFTlQvQURNSU4gXCJNeSBQb3N0c1wiIFVJKSBcdTIwMTQgYW55IHN0YXR1cywgc2luY2Vcbi8vICAgICBhZ2VudHMgbXVzdCBzZWUgdGhlaXIgb3duIGRyYWZ0cyBiZWZvcmUgYW4gYWRtaW4gcHVibGlzaGVzIHRoZW0uXG5jb25zdCBnZXRNeVBvc3RzID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcXVlcnk6IElJbnRlcm5hbFBvc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQmxvZ1Bvc3RXaGVyZUlucHV0ID0ge1xuICAgIGF1dGhvcklkOiB1c2VyLmlkLFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgYXV0aG9yOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIEZldGNoICsgb3duZXJzaGlwIGdhdGUgc2hhcmVkIGJ5IFBBVENIIGFuZCBERUxFVEUuIEFETUlOIGJ5cGFzc2VzIG93bmVyc2hpcDtcbi8vIEFHRU5UIGVkaXRzIGFyZSBjb25maW5lZCB0byB0aGVpciBvd24gcG9zdHMuXG5jb25zdCBmaW5kT3duZWRQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcG9zdElkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gIH0pO1xuXG4gIGlmICghcG9zdCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUG9zdCBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiAmJiBwb3N0LmF1dGhvcklkICE9PSB1c2VyLmlkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2FuIG9ubHkgYWN0IG9uIHlvdXIgb3duIHBvc3RzLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwb3N0O1xufTtcblxuLy8gNS4gVXBkYXRlIGEgcG9zdC4gU2x1ZyBuZXZlciBjaGFuZ2VzIChrZWVwcyBsaW5rcy9ib29rbWFya3MgdmFsaWQpLlxuLy8gICAgQUdFTlQgZWRpdHMgcmVzZXQgc3RhdHVzIHRvIERSQUZUIChyZS1wdWJsaXNoIHZpYSAvOmlkL3N0YXR1cyk7XG4vLyAgICBBRE1JTiBlZGl0cyBwcmVzZXJ2ZSBzdGF0dXMuXG5jb25zdCB1cGRhdGVQb3N0ID0gYXN5bmMgKFxuICB1c2VyOiBJUmVxdWVzdFVzZXIsXG4gIHBvc3RJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlUG9zdFBheWxvYWQsXG4pID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUG9zdCh1c2VyLCBwb3N0SWQpO1xuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZUlucHV0ID0ge1xuICAgIC4uLihwYXlsb2FkLnRpdGxlICE9PSB1bmRlZmluZWQgPyB7IHRpdGxlOiBwYXlsb2FkLnRpdGxlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZXhjZXJwdCAhPT0gdW5kZWZpbmVkID8geyBleGNlcnB0OiBwYXlsb2FkLmV4Y2VycHQgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5jb250ZW50ICE9PSB1bmRlZmluZWQgPyB7IGNvbnRlbnQ6IHBheWxvYWQuY29udGVudCB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNvdmVySW1hZ2UgIT09IHVuZGVmaW5lZFxuICAgICAgPyB7IGNvdmVySW1hZ2U6IHBheWxvYWQuY292ZXJJbWFnZSB9XG4gICAgICA6IHt9KSxcbiAgICAuLi4odXNlci5yb2xlICE9PSBSb2xlLkFETUlOID8geyBzdGF0dXM6IFBvc3RTdGF0dXMuRFJBRlQgfSA6IHt9KSxcbiAgfTtcblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICAgIGRhdGEsXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDYuIFB1Ymxpc2gvdW5wdWJsaXNoIGEgcG9zdCAoYWRtaW4pLlxuY29uc3QgY2hhbmdlUG9zdFN0YXR1cyA9IGFzeW5jIChcbiAgcG9zdElkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQb3N0U3RhdHVzUGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRVbmlxdWVPclRocm93KHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gIH0pO1xuXG4gIGlmIChwb3N0LmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiQ2Fubm90IGNoYW5nZSB0aGUgc3RhdHVzIG9mIGEgZGVsZXRlZCBwb3N0LlwiKTtcbiAgfVxuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YTogeyBzdGF0dXM6IHBheWxvYWQuc3RhdHVzIH0sXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDcuIFNvZnQgZGVsZXRlIChhZG1pbiBhbnksIGFnZW50IG93bikuXG5jb25zdCBzb2Z0RGVsZXRlUG9zdCA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBvc3RJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IGZpbmRPd25lZFBvc3QodXNlciwgcG9zdElkKTtcblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGJsb2dTZXJ2aWNlID0ge1xuICBjcmVhdGVQb3N0LFxuICBnZXRQdWJsaWNQb3N0cyxcbiAgZ2V0UG9zdEJ5U2x1ZyxcbiAgZ2V0QWxsUG9zdHMsXG4gIGdldE15UG9zdHMsXG4gIHVwZGF0ZVBvc3QsXG4gIGNoYW5nZVBvc3RTdGF0dXMsXG4gIHNvZnREZWxldGVQb3N0LFxufTtcbiIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCB0aXRsZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlRpdGxlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDMsIFwiVGl0bGUgbXVzdCBiZSBhdCBsZWFzdCAzIGNoYXJhY3RlcnNcIilcbiAgLm1heCgyMDAsIFwiVGl0bGUgbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBleGNlcnB0U2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRXhjZXJwdCBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigxLCBcIkV4Y2VycHQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgLm1heCg1MDAsIFwiRXhjZXJwdCBtdXN0IGJlIGF0IG1vc3QgNTAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGNvbnRlbnRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb250ZW50IGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEsIFwiQ29udGVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAubWF4KDEwMDAwLCBcIkNvbnRlbnQgbXVzdCBiZSBhdCBtb3N0IDEwMDAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGNvdmVySW1hZ2VTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb3ZlciBpbWFnZSBpcyByZXF1aXJlZFwiIH0pXG4gIC51cmwoXCJDb3ZlciBpbWFnZSBtdXN0IGJlIGEgdmFsaWQgVVJMXCIpO1xuXG5jb25zdCBjcmVhdGVQb3N0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEsXG4gICAgZXhjZXJwdDogZXhjZXJwdFNjaGVtYSxcbiAgICBjb250ZW50OiBjb250ZW50U2NoZW1hLFxuICAgIGNvdmVySW1hZ2U6IGNvdmVySW1hZ2VTY2hlbWEsXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlUG9zdFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgZXhjZXJwdDogZXhjZXJwdFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNvbnRlbnQ6IGNvbnRlbnRTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBjb3ZlckltYWdlOiBjb3ZlckltYWdlU2NoZW1hLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiBPYmplY3Qua2V5cyhkYXRhKS5sZW5ndGggPiAwLCB7XG4gICAgbWVzc2FnZTogXCJBdCBsZWFzdCBvbmUgZmllbGQgbXVzdCBiZSBwcm92aWRlZCB0byB1cGRhdGVcIixcbiAgfSk7XG5cbmNvbnN0IHBvc3RQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBvc3QgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgcG9zdFNsdWdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHNsdWc6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUG9zdCBzbHVnIGlzIHJlcXVpcmVkXCIgfSkudHJpbSgpLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVTdGF0dXNTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHN0YXR1czogei5lbnVtKFtcIkRSQUZUXCIsIFwiUFVCTElTSEVEXCJdLCB7XG4gICAgICByZXF1aXJlZF9lcnJvcjogXCJTdGF0dXMgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJTdGF0dXMgbXVzdCBiZSBEUkFGVCBvciBQVUJMSVNIRURcIixcbiAgICB9KSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCBwdWJsaWNRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgc29ydEJ5OiB6LmVudW0oW1wibmV3ZXN0XCIsIFwib2xkZXN0XCIsIFwidGl0bGVcIl0pLmRlZmF1bHQoXCJuZXdlc3RcIiksXG4gICAgc29ydE9yZGVyOiB6LmVudW0oW1wiYXNjXCIsIFwiZGVzY1wiXSkub3B0aW9uYWwoKSxcbiAgfSk7XG5cbmNvbnN0IGludGVybmFsUXVlcnlTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICAgIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgICBzdGF0dXM6IHpcbiAgICAgIC5lbnVtKFtcIkRSQUZUXCIsIFwiUFVCTElTSEVEXCJdKVxuICAgICAgLnRyYW5zZm9ybSgodmFsKSA9PiB2YWwgYXMgXCJEUkFGVFwiIHwgXCJQVUJMSVNIRURcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICB9KTtcblxuZXhwb3J0IGNvbnN0IGJsb2dWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlUG9zdFNjaGVtYSxcbiAgdXBkYXRlUG9zdFNjaGVtYSxcbiAgcG9zdFBhcmFtc1NjaGVtYSxcbiAgcG9zdFNsdWdQYXJhbXNTY2hlbWEsXG4gIHVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgcHVibGljUXVlcnlTY2hlbWEsXG4gIGludGVybmFsUXVlcnlTY2hlbWEsXG59O1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBibG9nQ29tbWVudFNlcnZpY2UgfSBmcm9tIFwiLi9ibG9nQ29tbWVudC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gUHVibGljIGNvbW1lbnRzIGZvciBhIHBvc3QgY29udHJvbGxlclxuY29uc3QgZ2V0UG9zdENvbW1lbnRzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3Qgc2x1ZyA9IFN0cmluZyhyZXEucGFyYW1zLnNsdWcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dDb21tZW50U2VydmljZS5nZXRQb3N0Q29tbWVudHMoc2x1ZywgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDb21tZW50cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIENyZWF0ZSBhIGNvbW1lbnQgY29udHJvbGxlciAoYW55IGF1dGhlbnRpY2F0ZWQgdXNlcilcbmNvbnN0IGNyZWF0ZUNvbW1lbnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ0NvbW1lbnRTZXJ2aWNlLmNyZWF0ZUNvbW1lbnQodXNlcklkLCBzbHVnLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJDb21tZW50IHBvc3RlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBTb2Z0IGRlbGV0ZSBjb21tZW50IGNvbnRyb2xsZXIgKG93bmVyIG9yIEFETUlOKVxuY29uc3QgZGVsZXRlQ29tbWVudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJvbGUgPSByZXEudXNlciEucm9sZTtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBhd2FpdCBibG9nQ29tbWVudFNlcnZpY2UuZGVsZXRlQ29tbWVudCh1c2VySWQsIHJvbGUsIGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDb21tZW50IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBibG9nQ29tbWVudENvbnRyb2xsZXIgPSB7XG4gIGdldFBvc3RDb21tZW50cyxcbiAgY3JlYXRlQ29tbWVudCxcbiAgZGVsZXRlQ29tbWVudCxcbn07IiwgImltcG9ydCB7IFBvc3RTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHB1YmxpY0F1dGhvclNlbGVjdCB9IGZyb20gXCIuL2Jsb2cuc2VydmljZVwiO1xuaW1wb3J0IHsgSUNyZWF0ZUNvbW1lbnRQYXlsb2FkLCBJQ29tbWVudFF1ZXJ5IH0gZnJvbSBcIi4vYmxvZ0NvbW1lbnQuaW50ZXJmYWNlXCI7XG5cbi8vIFNoYXJlZCB2aXNpYmlsaXR5IHJ1bGU6IGNvbW1lbnRzIG9ubHkgZXZlciBhcHBlYXIgdW5kZXIgYSBQVUJMSVNIRUQsXG4vLyBub24tZGVsZXRlZCBwb3N0IFx1MjAxNCB0aGUgc2FtZSBydWxlIGFzIGdldFBvc3RCeVNsdWcuXG5jb25zdCBnZXRQb3N0SWRCeVNsdWcgPSBhc3luYyAoc2x1Zzogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7IHNsdWcsIHN0YXR1czogUG9zdFN0YXR1cy5QVUJMSVNIRUQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCFwb3N0KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQb3N0IG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4gcG9zdC5pZDtcbn07XG5cbi8vIDEuIFB1YmxpYyBjb21tZW50cyBmb3IgYSBwb3N0IFx1MjAxNCB0b3AtbGV2ZWwgKyB0aGVpciByZXBsaWVzIGluIHR3byBxdWVyaWVzOlxuLy8gICAgdG9wLWxldmVsIG5ld2VzdC1maXJzdCwgcmVwbGllcyBvbGRlc3QtZmlyc3QgKGNvbnZlcnNhdGlvbiBvcmRlcikuXG5jb25zdCBnZXRQb3N0Q29tbWVudHMgPSBhc3luYyAoc2x1Zzogc3RyaW5nLCBxdWVyeTogSUNvbW1lbnRRdWVyeSkgPT4ge1xuICBjb25zdCBwb3N0SWQgPSBhd2FpdCBnZXRQb3N0SWRCeVNsdWcoc2x1Zyk7XG5cbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB0b3BMZXZlbFdoZXJlOiBQcmlzbWEuQmxvZ0NvbW1lbnRXaGVyZUlucHV0ID0ge1xuICAgIHBvc3RJZCxcbiAgICBwYXJlbnRJZDogbnVsbCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICB9O1xuXG4gIGNvbnN0IFt0b3BMZXZlbCwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nQ29tbWVudC5maW5kTWFueSh7XG4gICAgICB3aGVyZTogdG9wTGV2ZWxXaGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgdXNlcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ0NvbW1lbnQuY291bnQoeyB3aGVyZTogdG9wTGV2ZWxXaGVyZSB9KSxcbiAgXSk7XG5cbiAgY29uc3QgcmVwbGllcyA9IHRvcExldmVsLmxlbmd0aCA+IDBcbiAgICA/IGF3YWl0IHByaXNtYS5ibG9nQ29tbWVudC5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgcG9zdElkLFxuICAgICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICAgICAgcGFyZW50SWQ6IHsgaW46IHRvcExldmVsLm1hcCgoYykgPT4gYy5pZCkgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaW5jbHVkZTogeyB1c2VyOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiYXNjXCIgfSxcbiAgICAgIH0pXG4gICAgOiBbXTtcblxuICBjb25zdCByZXBseU1hcCA9IG5ldyBNYXA8c3RyaW5nLCB0eXBlb2YgcmVwbGllcz4oKTtcbiAgZm9yIChjb25zdCByZXBseSBvZiByZXBsaWVzKSB7XG4gICAgY29uc3QgbGlzdCA9IHJlcGx5TWFwLmdldChyZXBseS5wYXJlbnRJZCEpID8/IFtdO1xuICAgIGxpc3QucHVzaChyZXBseSk7XG4gICAgcmVwbHlNYXAuc2V0KHJlcGx5LnBhcmVudElkISwgbGlzdCk7XG4gIH1cblxuICBjb25zdCBkYXRhID0gdG9wTGV2ZWwubWFwKChjb21tZW50KSA9PiAoe1xuICAgIC4uLmNvbW1lbnQsXG4gICAgcmVwbGllczogcmVwbHlNYXAuZ2V0KGNvbW1lbnQuaWQpID8/IFtdLFxuICB9KSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDIuIENyZWF0ZSBhIGNvbW1lbnQgKGFueSBhdXRoZW50aWNhdGVkIHVzZXIpLiBPbmUtbGV2ZWwgcmVwbGllcyBvbmx5OiBhXG4vLyAgICBwYXJlbnQgbXVzdCBiZSBhIHRvcC1sZXZlbCBjb21tZW50IG9uIHRoZSBzYW1lIHBvc3QuXG5jb25zdCBjcmVhdGVDb21tZW50ID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgc2x1Zzogc3RyaW5nLFxuICBwYXlsb2FkOiBJQ3JlYXRlQ29tbWVudFBheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgcG9zdElkID0gYXdhaXQgZ2V0UG9zdElkQnlTbHVnKHNsdWcpO1xuXG4gIGxldCBwYXJlbnRJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGlmIChwYXlsb2FkLnBhcmVudElkKSB7XG4gICAgY29uc3QgcGFyZW50ID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICBpZDogcGF5bG9hZC5wYXJlbnRJZCxcbiAgICAgICAgcG9zdElkLFxuICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgcGFyZW50SWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghcGFyZW50KSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIlBhcmVudCBjb21tZW50IG5vdCBmb3VuZCBvbiB0aGlzIHBvc3QuXCIpO1xuICAgIH1cblxuICAgIGlmIChwYXJlbnQucGFyZW50SWQgIT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiUmVwbGllcyB0byByZXBsaWVzIGFyZSBub3QgYWxsb3dlZC5cIik7XG4gICAgfVxuXG4gICAgcGFyZW50SWQgPSBwYXJlbnQuaWQ7XG4gIH1cblxuICByZXR1cm4gcHJpc21hLmJsb2dDb21tZW50LmNyZWF0ZSh7XG4gICAgZGF0YTogeyBjb250ZW50OiBwYXlsb2FkLmNvbnRlbnQsIHBvc3RJZCwgdXNlcklkLCBwYXJlbnRJZCB9LFxuICAgIGluY2x1ZGU6IHsgdXNlcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gMy4gU29mdCBkZWxldGUgYSBjb21tZW50IFx1MjAxNCBvd25lciBvciBBRE1JTi4gQSBmb3JlaWduIGlkLCBhbiBhbHJlYWR5LWRlbGV0ZWRcbi8vICAgIGNvbW1lbnQsIG9yIGEgbm9uZXhpc3RlbnQgb25lIGlzIGEgdW5pZm9ybSA0MDQgKG5ldmVyIGEgbGVhaykuXG5jb25zdCBkZWxldGVDb21tZW50ID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcm9sZTogUm9sZSxcbiAgY29tbWVudElkOiBzdHJpbmcsXG4pID0+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LnVwZGF0ZU1hbnkoe1xuICAgIHdoZXJlOiB7XG4gICAgICBpZDogY29tbWVudElkLFxuICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgIC4uLihyb2xlICE9PSBSb2xlLkFETUlOID8geyB1c2VySWQgfSA6IHt9KSxcbiAgICB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmIChyZXN1bHQuY291bnQgPT09IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkNvbW1lbnQgbm90IGZvdW5kLlwiKTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGJsb2dDb21tZW50U2VydmljZSA9IHtcbiAgZ2V0UG9zdENvbW1lbnRzLFxuICBjcmVhdGVDb21tZW50LFxuICBkZWxldGVDb21tZW50LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlQ29tbWVudFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgY29udGVudDogelxuICAgICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbnRlbnQgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1pbigxLCBcIkNvbnRlbnQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgICAgIC5tYXgoMjAwMCwgXCJDb250ZW50IG11c3QgYmUgYXQgbW9zdCAyMDAwIGNoYXJhY3RlcnNcIiksXG4gICAgcGFyZW50SWQ6IHouc3RyaW5nKCkubWluKDEsIFwicGFyZW50SWQgbXVzdCBub3QgYmUgZW1wdHlcIikub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCBjb21tZW50UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb21tZW50IGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiQ29tbWVudCBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5jb25zdCBjb21tZW50UXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG59KTtcblxuZXhwb3J0IGNvbnN0IGJsb2dDb21tZW50VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZUNvbW1lbnRTY2hlbWEsXG4gIGNvbW1lbnRQYXJhbXNTY2hlbWEsXG4gIGNvbW1lbnRRdWVyeVNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBkYXNoYm9hcmRDb250cm9sbGVyIH0gZnJvbSBcIi4vZGFzaGJvYXJkLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGRhc2hib2FyZFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vZGFzaGJvYXJkLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBcdTIwMTQgcGxhdGZvcm0td2lkZSBhbmFseXRpY3NcbnJvdXRlci5nZXQoXG4gIFwiL2FkbWluXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBkYXNoYm9hcmRWYWxpZGF0aW9ucy5kYXNoYm9hcmRRdWVyeVNjaGVtYSB9KSxcbiAgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRBZG1pbkRhc2hib2FyZCxcbik7XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBcdTIwMTQgb3duIHBhY2thZ2VzL2Jvb2tpbmdzL3JldmVudWUvcGVyZm9ybWFuY2VcbnJvdXRlci5nZXQoXG4gIFwiL2FnZW50XCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBkYXNoYm9hcmRWYWxpZGF0aW9ucy5kYXNoYm9hcmRRdWVyeVNjaGVtYSB9KSxcbiAgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRBZ2VudERhc2hib2FyZCxcbik7XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIFx1MjAxNCBvd24gYm9va2luZ3MvdXBjb21pbmcvc3BlbmRcbnJvdXRlci5nZXQoXG4gIFwiL3VzZXJcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogZGFzaGJvYXJkVmFsaWRhdGlvbnMuZGFzaGJvYXJkUXVlcnlTY2hlbWEgfSksXG4gIGRhc2hib2FyZENvbnRyb2xsZXIuZ2V0VXNlckRhc2hib2FyZCxcbik7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBkYXNoYm9hcmRTZXJ2aWNlIH0gZnJvbSBcIi4vZGFzaGJvYXJkLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBBZG1pbiBkYXNoYm9hcmQgY29udHJvbGxlciAoQURNSU4pXG5jb25zdCBnZXRBZG1pbkRhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0QWRtaW5EYXNoYm9hcmQoXG4gICAgICBOdW1iZXIocmVxLnF1ZXJ5LmRheXMpLFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGFzaGJvYXJkIGRhdGEgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBBZ2VudCBkYXNoYm9hcmQgY29udHJvbGxlciAoQUdFTlQpXG5jb25zdCBnZXRBZ2VudERhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0QWdlbnREYXNoYm9hcmQoXG4gICAgICB1c2VySWQsXG4gICAgICBOdW1iZXIocmVxLnF1ZXJ5LmRheXMpLFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGFzaGJvYXJkIGRhdGEgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBVc2VyIGRhc2hib2FyZCBjb250cm9sbGVyIChVU0VSKVxuY29uc3QgZ2V0VXNlckRhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0VXNlckRhc2hib2FyZChcbiAgICAgIHVzZXJJZCxcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRDb250cm9sbGVyID0ge1xuICBnZXRBZG1pbkRhc2hib2FyZCxcbiAgZ2V0QWdlbnREYXNoYm9hcmQsXG4gIGdldFVzZXJEYXNoYm9hcmQsXG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMsIFBhY2thZ2VTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7XG4gIElBZ2VudERhc2hib2FyZCxcbiAgSUFkbWluRGFzaGJvYXJkLFxuICBJQm9va2luZ3NCeVN0YXR1cyxcbiAgSVJldmVudWVQb2ludCxcbiAgSVVzZXJEYXNoYm9hcmQsXG59IGZyb20gXCIuL2Rhc2hib2FyZC5pbnRlcmZhY2VcIjtcblxuLy8gTW9uZXkgaXMgYERlY2ltYWwoMTAsMilgIGluIHRoZSBzY2hlbWEgKEFHRU5UUy5tZCkgXHUyMDE0IG1hcCB0byBOdW1iZXIgb24gcmV0dXJuLlxuY29uc3QgdG9OdW1iZXIgPSAodmFsdWU6IHVua25vd24pOiBudW1iZXIgPT4gTnVtYmVyKHZhbHVlID8/IDApO1xuXG4vLyBCb29raW5nLXN0YXR1cyBicmVha2Rvd24gdmlhIGdyb3VwQnkgKyBfY291bnQuIE9wdGlvbmFsIHNjb3BlIGxpbWl0cyBpdCB0b1xuLy8gYW4gYWdlbnQncyBvd24gbm9uLWRlbGV0ZWQgcGFja2FnZXMgb3IgYSBzaW5nbGUgdXNlcidzIGJvb2tpbmdzLlxuY29uc3QgZ2V0Qm9va2luZ3NCeVN0YXR1cyA9IGFzeW5jIChcbiAgc2NvcGU6IHsgYWdlbnRJZD86IHN0cmluZzsgdXNlcklkPzogc3RyaW5nIH0gPSB7fSxcbik6IFByb21pc2U8SUJvb2tpbmdzQnlTdGF0dXNbXT4gPT4ge1xuICBjb25zdCBncm91cGVkID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZ3JvdXBCeSh7XG4gICAgYnk6IFtcInN0YXR1c1wiXSxcbiAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgIHdoZXJlOiBzY29wZS5hZ2VudElkXG4gICAgICA/IHsgcGFja2FnZTogeyBhZ2VudElkOiBzY29wZS5hZ2VudElkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0gfVxuICAgICAgOiBzY29wZS51c2VySWRcbiAgICAgICAgPyB7IHVzZXJJZDogc2NvcGUudXNlcklkIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gIH0pO1xuXG4gIHJldHVybiBncm91cGVkXG4gICAgLm1hcCgoZykgPT4gKHsgc3RhdHVzOiBnLnN0YXR1cywgY291bnQ6IGcuX2NvdW50Ll9hbGwgfSkpXG4gICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KTtcbn07XG5cbi8vIFJldmVudWUgdHJlbmQ6IG9uZSByb3cgcGVyIGRheSBmb3IgdGhlIGxhc3QgYGRheXNgIGRheXMsIGJ1Y2tldGluZyBDT01QTEVURURcbi8vIGJvb2tpbmdzIGJ5IHRoZWlyIGB1cGRhdGVkQXRgIFx1MjAxNCB0aGUgdGltZXN0YW1wIG9mIHRoZSB0cmFuc2l0aW9uIGludG9cbi8vIENPTVBMRVRFRCAoYSB0ZXJtaW5hbCBzdGF0ZSwgc28gaXQgaXMgdGhlIGxhc3Qgd3JpdGUpLiBgY3JlYXRlZEF0YCBpcyB3aGVuXG4vLyB0aGUgYm9va2luZyB3YXMgbWFkZSAoUEVORElORykgYW5kIG5ldmVyIG1vdmVzLCB3aGljaCB3b3VsZCBtaXMtZGF0ZSByZXZlbnVlXG4vLyB3ZWVrcyBsYXRlci4gUG9zdGdyZXMgZ2VuZXJhdGVfc2VyaWVzIGd1YXJhbnRlZXMgYSBkZW5zZSBzZXJpZXMgKHplcm8tZmlsbGVkXG4vLyBkYXlzKSBcdTIwMTQgYmV0dGVyIGFuZCBmYXN0ZXIgdGhhbiBhIHBlci1kYXkgSlMgbG9vcC4gT3B0aW9uYWwgc2NvcGU6IGFuIGFnZW50J3Ncbi8vIG93biBub24tZGVsZXRlZCBwYWNrYWdlcywgb3IgYSBzaW5nbGUgdXNlcidzIHNwZW5kLlxuY29uc3QgZ2V0UmV2ZW51ZU92ZXJUaW1lID0gYXN5bmMgKFxuICBkYXlzOiBudW1iZXIsXG4gIHNjb3BlOiB7IGFnZW50SWQ/OiBzdHJpbmc7IHVzZXJJZD86IHN0cmluZyB9ID0ge30sXG4pOiBQcm9taXNlPElSZXZlbnVlUG9pbnRbXT4gPT4ge1xuICBjb25zdCBhZ2VudFNjb3BlID0gc2NvcGUuYWdlbnRJZFxuICAgID8gYEFORCBiLlwicGFja2FnZUlkXCIgSU4gKFxuICAgICAgICAgU0VMRUNUIHAuXCJpZFwiXG4gICAgICAgICBGUk9NIFwidG91cl9wYWNrYWdlc1wiIHBcbiAgICAgICAgIFdIRVJFIHAuXCJhZ2VudElkXCIgPSAkMlxuICAgICAgICAgICBBTkQgcC5cImlzRGVsZXRlZFwiID0gZmFsc2VcbiAgICAgICApYFxuICAgIDogXCJcIjtcbiAgY29uc3QgdXNlclNjb3BlID0gc2NvcGUudXNlcklkID8gYEFORCBiLlwidXNlcklkXCIgPSAkMmAgOiBcIlwiO1xuICBjb25zdCB3aGVyZUNsYXVzZSA9IHNjb3BlLmFnZW50SWQgPyBhZ2VudFNjb3BlIDogdXNlclNjb3BlO1xuXG4gIGNvbnN0IHJvd3MgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3VW5zYWZlPFxuICAgIHsgZGF0ZTogc3RyaW5nOyByZXZlbnVlOiBudW1iZXIgfVtdXG4gID4oXG4gICAgYFxuICAgIFNFTEVDVCB0b19jaGFyKGRheXMuZCwgJ1lZWVktTU0tREQnKSBBUyBkYXRlLFxuICAgICAgICAgICBDT0FMRVNDRShTVU0oYi5cInRvdGFsUHJpY2VcIiksIDApOjpmbG9hdDggQVMgcmV2ZW51ZVxuICAgIEZST00gZ2VuZXJhdGVfc2VyaWVzKFxuICAgICAgQ1VSUkVOVF9EQVRFIC0gbWFrZV9pbnRlcnZhbChkYXlzID0+ICQxOjppbnQgLSAxKSxcbiAgICAgIENVUlJFTlRfREFURSxcbiAgICAgICcxIGRheSc6OmludGVydmFsXG4gICAgKSBBUyBkYXlzKGQpXG4gICAgTEVGVCBKT0lOIFwiYm9va2luZ3NcIiBiXG4gICAgICBPTiBkYXRlX3RydW5jKCdkYXknLCBiLlwidXBkYXRlZEF0XCIpOjpkYXRlID0gZGF5cy5kXG4gICAgICBBTkQgYi5cInN0YXR1c1wiID0gJ0NPTVBMRVRFRCdcbiAgICAgICR7d2hlcmVDbGF1c2V9XG4gICAgR1JPVVAgQlkgZGF5cy5kXG4gICAgT1JERVIgQlkgZGF5cy5kIEFTQ1xuICAgIGAsXG4gICAgZGF5cyxcbiAgICAuLi4oc2NvcGUuYWdlbnRJZCB8fCBzY29wZS51c2VySWQgPyBbc2NvcGUuYWdlbnRJZCA/PyBzY29wZS51c2VySWRdIDogW10pLFxuICApO1xuXG4gIHJldHVybiByb3dzO1xufTtcblxuLy8gUGFja2FnZS1pZCBzY29wZSBmb3IgYm9va2luZyBxdWVyaWVzLiBDYWxsZXJzIHNob3J0LWNpcmN1aXQgdGhlIGVtcHR5IGNhc2Vcbi8vIChhbiBhZ2VudCB3aXRoIG5vIHBhY2thZ2VzKSwgYnV0IGFuIGBpbjogW11gIGZhbGxiYWNrIGtlZXBzIHRoZSB0eXBlXG4vLyBub24tbnVsbGFibGUgd2hpbGUgc3RpbGwgbWF0Y2hpbmcgbm90aGluZyBpZiBpdCBldmVyIHNsaXBzIHRocm91Z2guXG5jb25zdCB0b1BhY2thZ2VJZFNjb3BlID0gKFxuICBwYWNrYWdlSWRzOiBzdHJpbmdbXSxcbik6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9PlxuICBwYWNrYWdlSWRzLmxlbmd0aFxuICAgID8geyBwYWNrYWdlSWQ6IHsgaW46IHBhY2thZ2VJZHMgfSB9XG4gICAgOiB7IHBhY2thZ2VJZDogeyBpbjogW10gfSB9O1xuXG4vLyAxLiBBZG1pbiBkYXNoYm9hcmQgXHUyMDE0IHBsYXRmb3JtLXdpZGUgY291bnRzLCBicmVha2Rvd25zIGFuZCByZXZlbnVlIHRyZW5kLlxuY29uc3QgZ2V0QWRtaW5EYXNoYm9hcmQgPSBhc3luYyAoZGF5czogbnVtYmVyKTogUHJvbWlzZTxJQWRtaW5EYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW1xuICAgIHRvdGFsVXNlcnMsXG4gICAgdG90YWxQYWNrYWdlcyxcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsUmV2ZW51ZSxcbiAgICB1c2Vyc0J5Um9sZSxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHBhY2thZ2VzQnlDYXRlZ29yeSxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnVzZXIuY291bnQoeyB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0gfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9IH0pLFxuICAgIHByaXNtYS5ib29raW5nLmNvdW50KCksXG4gICAgcHJpc21hLmJvb2tpbmcuYWdncmVnYXRlKHtcbiAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCB9LFxuICAgIH0pLFxuICAgIHByaXNtYS51c2VyLmdyb3VwQnkoe1xuICAgICAgYnk6IFtcInJvbGVcIl0sXG4gICAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIH0pLFxuICAgIGdldEJvb2tpbmdzQnlTdGF0dXMoKSxcbiAgICBwcmlzbWEudG91clBhY2thZ2VcbiAgICAgIC5ncm91cEJ5KHtcbiAgICAgICAgYnk6IFtcImNhdGVnb3J5SWRcIl0sXG4gICAgICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgICAgIHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIH0pXG4gICAgICAudGhlbihhc3luYyAoZ3JvdXBlZCkgPT4ge1xuICAgICAgICBjb25zdCBjYXRlZ29yeUlkcyA9IGdyb3VwZWQubWFwKChnKSA9PiBnLmNhdGVnb3J5SWQpO1xuICAgICAgICBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KHtcbiAgICAgICAgICB3aGVyZTogeyBpZDogeyBpbjogY2F0ZWdvcnlJZHMgfSB9LFxuICAgICAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9LFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgbmFtZU1hcCA9IG5ldyBNYXAoY2F0ZWdvcmllcy5tYXAoKGMpID0+IFtjLmlkLCBjLm5hbWVdKSk7XG5cbiAgICAgICAgcmV0dXJuIGdyb3VwZWRcbiAgICAgICAgICAubWFwKChnKSA9PiAoe1xuICAgICAgICAgICAgY2F0ZWdvcnk6IG5hbWVNYXAuZ2V0KGcuY2F0ZWdvcnlJZCkgPz8gXCJVbmtub3duXCIsXG4gICAgICAgICAgICBjb3VudDogZy5fY291bnQuX2FsbCxcbiAgICAgICAgICB9KSlcbiAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpO1xuICAgICAgfSksXG4gICAgZ2V0UmV2ZW51ZU92ZXJUaW1lKGRheXMpLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsVXNlcnMsXG4gICAgdG90YWxQYWNrYWdlcyxcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsUmV2ZW51ZTogdG9OdW1iZXIodG90YWxSZXZlbnVlLl9zdW0udG90YWxQcmljZSksXG4gICAgdXNlcnNCeVJvbGU6IHVzZXJzQnlSb2xlXG4gICAgICAubWFwKChnKSA9PiAoeyByb2xlOiBnLnJvbGUsIGNvdW50OiBnLl9jb3VudC5fYWxsIH0pKVxuICAgICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KSxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHBhY2thZ2VzQnlDYXRlZ29yeSxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIH07XG59O1xuXG4vLyAyLiBBZ2VudCBkYXNoYm9hcmQgXHUyMDE0IHNjb3BlZCB0byB0aGUgYWdlbnQncyBvd24gcGFja2FnZXMuIEZldGNoZXMgb3duZWRcbi8vICAgIHBhY2thZ2UgaWRzIG9uY2UsIHRoZW4gZXZlcnkgYWdncmVnYXRlIHJldXNlcyB0aGF0IHNjb3BlIHNvIHRoZSB3aG9sZVxuLy8gICAgYnVuZGxlIGlzIG9uZSBQcm9taXNlLmFsbCAobm8gcGVyLWl0ZW0gcXVlcmllcykuXG5jb25zdCBnZXRBZ2VudERhc2hib2FyZCA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIGRheXM6IG51bWJlcixcbik6IFByb21pc2U8SUFnZW50RGFzaGJvYXJkPiA9PiB7XG4gIGNvbnN0IFtvd25lZFBhY2thZ2VzLCBib29raW5nc0J5U3RhdHVzLCBhdmVyYWdlUmF0aW5nXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHsgYWdlbnRJZDogdXNlcklkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KSxcbiAgICBnZXRCb29raW5nc0J5U3RhdHVzKHsgYWdlbnRJZDogdXNlcklkIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5hZ2dyZWdhdGUoe1xuICAgICAgX2F2ZzogeyByYXRpbmc6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGFnZW50SWQ6IHVzZXJJZCxcbiAgICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSk7XG5cbiAgY29uc3QgcGFja2FnZUlkcyA9IG93bmVkUGFja2FnZXMubWFwKChwKSA9PiBwLmlkKTtcblxuICAvLyBBbiBhZ2VudCB3aXRoIG5vIHBhY2thZ2VzIG11c3Qgc2VlIHplcm9zIFx1MjAxNCBzY29wZSBpcyB1bmRlZmluZWQgZm9yIGFuIGVtcHR5XG4gIC8vIGxpc3QsIGFuZCBhIGJhcmUgYHdoZXJlOiB1bmRlZmluZWRgIC8gYEFORDogW3t9XWAgd291bGQgb3RoZXJ3aXNlIG1hdGNoIHRoZVxuICAvLyB3aG9sZSBwbGF0Zm9ybSAoY3Jvc3MtYWdlbnQgZGF0YSBsZWFrKS4gU2hvcnQtY2lyY3VpdCBoZXJlIGluc3RlYWQuXG4gIGlmIChwYWNrYWdlSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB7XG4gICAgICB0b3RhbFBhY2thZ2VzOiAwLFxuICAgICAgdG90YWxCb29raW5nczogMCxcbiAgICAgIHRvdGFsUmV2ZW51ZTogMCxcbiAgICAgIGF2ZXJhZ2VSYXRpbmc6IE1hdGgucm91bmQoKGF2ZXJhZ2VSYXRpbmcuX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMCxcbiAgICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgICByZXZlbnVlT3ZlclRpbWU6IGF3YWl0IGdldFJldmVudWVPdmVyVGltZShkYXlzLCB7IGFnZW50SWQ6IHVzZXJJZCB9KSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgc2NvcGUgPSB0b1BhY2thZ2VJZFNjb3BlKHBhY2thZ2VJZHMpO1xuXG4gIGNvbnN0IFt0b3RhbFBhY2thZ2VzLCB0b3RhbEJvb2tpbmdzLCB0b3RhbFJldmVudWUsIHJldmVudWVPdmVyVGltZV0gPVxuICAgIGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHBhY2thZ2VJZHMubGVuZ3RoLFxuICAgICAgcHJpc21hLmJvb2tpbmcuY291bnQoeyB3aGVyZTogc2NvcGUgfSksXG4gICAgICBwcmlzbWEuYm9va2luZy5hZ2dyZWdhdGUoe1xuICAgICAgICBfc3VtOiB7IHRvdGFsUHJpY2U6IHRydWUgfSxcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBBTkQ6IFtzY29wZSwgeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVEIH1dLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cywgeyBhZ2VudElkOiB1c2VySWQgfSksXG4gICAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlOiB0b051bWJlcih0b3RhbFJldmVudWUuX3N1bS50b3RhbFByaWNlKSxcbiAgICBhdmVyYWdlUmF0aW5nOiBNYXRoLnJvdW5kKChhdmVyYWdlUmF0aW5nLl9hdmcucmF0aW5nID8/IDApICogMTApIC8gMTAsXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIH07XG59O1xuXG4vLyAzLiBVc2VyIGRhc2hib2FyZCBcdTIwMTQgdGhlIHVzZXIncyBib29raW5ncywgc3BlbmQsIGFuZCB1cGNvbWluZyB0cmlwcy5cbmNvbnN0IGdldFVzZXJEYXNoYm9hcmQgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBkYXlzID0gMzAsXG4pOiBQcm9taXNlPElVc2VyRGFzaGJvYXJkPiA9PiB7XG4gIGNvbnN0IFt0b3RhbEJvb2tpbmdzLCB0b3RhbFNwZW5kLCB1cGNvbWluZywgYm9va2luZ3NCeVN0YXR1cywgcmV2ZW51ZU92ZXJUaW1lXSA9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgcHJpc21hLmJvb2tpbmcuY291bnQoeyB3aGVyZTogeyB1c2VySWQgfSB9KSxcbiAgICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgICB3aGVyZTogeyB1c2VySWQsIHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfSxcbiAgICAgIH0pLFxuICAgICAgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoe1xuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIHVzZXJJZCxcbiAgICAgICAgICBzdGF0dXM6IHtcbiAgICAgICAgICAgIGluOiBbQm9va2luZ1N0YXR1cy5QRU5ESU5HLCBCb29raW5nU3RhdHVzLlBBSUQsIEJvb2tpbmdTdGF0dXMuQ09ORklSTUVEXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRyYXZlbERhdGU6IHsgZ3Q6IG5ldyBEYXRlKCkgfSxcbiAgICAgICAgfSxcbiAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgICAgdHJhdmVsRGF0ZTogdHJ1ZSxcbiAgICAgICAgICB0cmF2ZWxlcnM6IHRydWUsXG4gICAgICAgICAgdG90YWxQcmljZTogdHJ1ZSxcbiAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgcGFja2FnZTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIHRpdGxlOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgICAgICAgfSxcbiAgICAgICAgb3JkZXJCeTogeyB0cmF2ZWxEYXRlOiBcImFzY1wiIH0sXG4gICAgICAgIHRha2U6IDUsXG4gICAgICB9KSxcbiAgICAgIGdldEJvb2tpbmdzQnlTdGF0dXMoeyB1c2VySWQgfSksXG4gICAgICBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cywgeyB1c2VySWQgfSksXG4gICAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsU3BlbmQ6IHRvTnVtYmVyKHRvdGFsU3BlbmQuX3N1bS50b3RhbFByaWNlKSxcbiAgICB1cGNvbWluZ0NvdW50OiB1cGNvbWluZy5sZW5ndGgsXG4gICAgdXBjb21pbmc6IHVwY29taW5nLm1hcCgoYikgPT4gKHtcbiAgICAgIC4uLmIsXG4gICAgICB0b3RhbFByaWNlOiBOdW1iZXIoYi50b3RhbFByaWNlKSxcbiAgICB9KSksXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkU2VydmljZSA9IHtcbiAgZ2V0QWRtaW5EYXNoYm9hcmQsXG4gIGdldEFnZW50RGFzaGJvYXJkLFxuICBnZXRVc2VyRGFzaGJvYXJkLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgZGFzaGJvYXJkUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGRheXM6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoMzY1KS5kZWZhdWx0KDMwKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkVmFsaWRhdGlvbnMgPSB7XG4gIGRhc2hib2FyZFF1ZXJ5U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHBheW1lbnRDb250cm9sbGVyIH0gZnJvbSBcIi4vcGF5bWVudC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBwYXltZW50VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9wYXltZW50LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE9wZW4gYSBnYXRld2F5IHNlc3Npb24gZm9yIHRoZSB1c2VyJ3MgcGVuZGluZyBib29raW5nIChVU0VSIG9ubHkpLlxucm91dGVyLnBvc3QoXG4gIFwiL2NyZWF0ZVwiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5jcmVhdGVTY2hlbWEgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmNyZWF0ZVBheW1lbnQsXG4pO1xuXG4vLyBQdWJsaWMgXHUyMDE0IFNTTENvbW1lcnogUE9TVHMgdGhlIG91dGNvbWUgaGVyZSAoc3VjY2Vzcy9mYWlsL2NhbmNlbCkgYW5kIHdlXG4vLyByZWRpcmVjdCB0aGUgYnJvd3NlciB0byB0aGUgZnJvbnRlbmQgcmVzdWx0IHBhZ2UuXG5yb3V0ZXIucG9zdChcbiAgXCIvY29uZmlybVwiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHF1ZXJ5OiBwYXltZW50VmFsaWRhdGlvbnMuY2FsbGJhY2tRdWVyeVNjaGVtYSxcbiAgICBib2R5OiBwYXltZW50VmFsaWRhdGlvbnMuZ2F0ZXdheVJlc3VsdFNjaGVtYSxcbiAgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmNvbmZpcm1QYXltZW50LFxuKTtcblxuLy8gUHVibGljIFx1MjAxNCBTU0xDb21tZXJ6IGluc3RhbnQgcGF5bWVudCBub3RpZmljYXRpb247IHNhbWUgaWRlbXBvdGVudCBzZXR0bGUuXG5yb3V0ZXIucG9zdChcbiAgXCIvaXBuXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcXVlcnk6IHBheW1lbnRWYWxpZGF0aW9ucy5jYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICAgIGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5nYXRld2F5UmVzdWx0U2NoZW1hLFxuICB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuaXBuLFxuKTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuaW1wb3J0IHsgSUdhdGV3YXlSZXN1bHQgfSBmcm9tIFwiLi9wYXltZW50LmludGVyZmFjZVwiO1xuaW1wb3J0IHsgcGF5bWVudFNlcnZpY2UgfSBmcm9tIFwiLi9wYXltZW50LnNlcnZpY2VcIjtcblxuY29uc3QgY3JlYXRlUGF5bWVudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgcGF5bWVudFNlcnZpY2UuY3JlYXRlUGF5bWVudFNlc3Npb24odXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQYXltZW50IHNlc3Npb24gY3JlYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBzZXNzaW9uLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gUHVibGljIGNhbGxiYWNrIHRhcmdldCBcdTIwMTQgU1NMQ29tbWVyeiBQT1NUcyBoZXJlIChzZXJ2ZXItdG8tc2VydmVyKSBhZnRlciB0aGVcbi8vIHNob3BwZXIgZmluaXNoZXMgYXQgdGhlIGdhdGV3YXkuIFdlIHNldHRsZSB0aGUgcGF5bWVudCwgdGhlbiBib3VuY2UgdGhlXG4vLyBicm93c2VyIHRvIHRoZSBmcm9udGVuZCByZXN1bHQgcGFnZS5cbmNvbnN0IGNvbmZpcm1QYXltZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgYm9va2luZ0lkID0gU3RyaW5nKHJlcS5xdWVyeS5ib29raW5nSWQpO1xuICAgIGNvbnN0IHRyYW5JZCA9IFN0cmluZyhyZXEucXVlcnkudHJhbklkKTtcbiAgICBjb25zdCBzdGF0dXMgPSBTdHJpbmcocmVxLnF1ZXJ5LnN0YXR1cyA/PyBcImZhaWxcIik7XG5cbiAgICBhd2FpdCBwYXltZW50U2VydmljZS5wcm9jZXNzR2F0ZXdheVJlc3VsdChcbiAgICAgIGJvb2tpbmdJZCxcbiAgICAgIHRyYW5JZCxcbiAgICAgIHJlcS5ib2R5IGFzIElHYXRld2F5UmVzdWx0LFxuICAgICk7XG5cbiAgICBjb25zdCByZWRpcmVjdEJhc2UgPVxuICAgICAgY29uZmlnLm5vZGVfZW52ID09PSBcInByb2R1Y3Rpb25cIlxuICAgICAgICA/IGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZFxuICAgICAgICA6IGNvbmZpZy5mcm9udGVuZF91cmxfZGV2O1xuICAgIGNvbnN0IHBhZ2UgPSBbXCJzdWNjZXNzXCIsIFwiZmFpbFwiLCBcImNhbmNlbFwiXS5pbmNsdWRlcyhzdGF0dXMpID8gc3RhdHVzIDogXCJmYWlsXCI7XG5cbiAgICByZXMucmVkaXJlY3QoMzAyLCBgJHtyZWRpcmVjdEJhc2V9L3BheW1lbnQvJHtwYWdlfT9ib29raW5nSWQ9JHtib29raW5nSWR9YCk7XG4gIH0sXG4pO1xuXG4vLyBQdWJsaWMgSVBOIHRhcmdldCBcdTIwMTQgdGhlIGdhdGV3YXkgbm90aWZpZXMgdXMgaGVyZSBpbmRlcGVuZGVudGx5IG9mIHRoZVxuLy8gcmVkaXJlY3QuIFNhbWUgaWRlbXBvdGVudCBzZXR0bGU7IGFsd2F5cyBhbnN3ZXJzIDIwMCBzbyB0aGUgZ2F0ZXdheSBzdG9wcyByZXRyeWluZy5cbmNvbnN0IGlwbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGJvb2tpbmdJZCA9IFN0cmluZyhyZXEucXVlcnkuYm9va2luZ0lkKTtcbiAgICBjb25zdCB0cmFuSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LnRyYW5JZCk7XG5cbiAgICBhd2FpdCBwYXltZW50U2VydmljZS5wcm9jZXNzR2F0ZXdheVJlc3VsdChcbiAgICAgIGJvb2tpbmdJZCxcbiAgICAgIHRyYW5JZCxcbiAgICAgIHJlcS5ib2R5IGFzIElHYXRld2F5UmVzdWx0LFxuICAgICk7XG5cbiAgICByZXMuc3RhdHVzKDIwMCkudHlwZShcInRleHQvcGxhaW5cIikuc2VuZChcIk9LXCIpO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRDb250cm9sbGVyID0ge1xuICBjcmVhdGVQYXltZW50LFxuICBjb25maXJtUGF5bWVudCxcbiAgaXBuLFxufTsiLCAiaW1wb3J0IHsgQm9va2luZ1N0YXR1cywgUGF5bWVudFN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBTc2xjb21tZXJ6SW5pdFJlc3VsdCwgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQsIGdlbmVyYXRlVHJhbklkLCBzc2xjb21tZXJ6SW5pdCwgc3NsY29tbWVyelZhbGlkYXRlIH0gZnJvbSBcIi4uLy4uL2xpYi9zc2xjb21tZXJ6XCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2VuZEJvb2tpbmdFbWFpbCB9IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgSUdhdGV3YXlSZXN1bHQsIElQYXltZW50Q3JlYXRlUmVxdWVzdCwgSVBheW1lbnRHYXRld2F5T3V0Y29tZSB9IGZyb20gXCIuL3BheW1lbnQuaW50ZXJmYWNlXCI7XG5cbi8vIFRoZSBnYXRld2F5IFBPU1RzIHRvIHRoZXNlIFVSTHMgc2VydmVyLXRvLXNlcnZlciwgc28gdGhlIGhvc3QgbXVzdCBiZVxuLy8gcHVibGljbHkgcmVhY2hhYmxlIFx1MjAxNCBjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsLCBuZXZlciBsb2NhbGhvc3QgaW4gc2FuZGJveC5cbmNvbnN0IGJ1aWxkQ2FsbGJhY2tVcmwgPSAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICB0cmFuSWQ6IHN0cmluZyxcbiAga2luZDogXCJzdWNjZXNzXCIgfCBcImZhaWxcIiB8IFwiY2FuY2VsXCIgfCBcImlwblwiLFxuKSA9PlxuICBgJHtjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsfS9hcGkvcGF5bWVudHMvJHtraW5kID09PSBcImlwblwiID8gXCJpcG5cIiA6IFwiY29uZmlybVwifT9ib29raW5nSWQ9JHtib29raW5nSWR9JnRyYW5JZD0ke3RyYW5JZH0ke1xuICAgIGtpbmQgPT09IFwiaXBuXCIgPyBcIlwiIDogYCZzdGF0dXM9JHtraW5kfWBcbiAgfWA7XG5cbi8vIE9wZW5zIGFuIFNTTENvbW1lcnogc2Vzc2lvbiBmb3IgYSBwZW5kaW5nIGJvb2tpbmcgdGhlIHVzZXIgb3ducy4gVGhlIGJvb2tpbmdcbi8vIGFtb3VudCBpcyBmcm96ZW4gYXQgaW5pdGlhdGlvbjsgaXQgbmV2ZXIgcmUtcmVhZHMgdGhlIHBhY2thZ2UgcHJpY2UuXG5jb25zdCBjcmVhdGVQYXltZW50U2Vzc2lvbiA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElQYXltZW50Q3JlYXRlUmVxdWVzdCxcbik6IFByb21pc2U8eyBwYXltZW50SWQ6IHN0cmluZzsgdHJhbklkOiBzdHJpbmc7IHBheW1lbnRVcmw6IHN0cmluZyB8IG51bGwgfT4gPT4ge1xuICBjb25zdCB7IGJvb2tpbmdJZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBib29raW5nID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCB9LFxuICAgIGluY2x1ZGU6IHsgcGFja2FnZTogeyBzZWxlY3Q6IHsgdGl0bGU6IHRydWUgfSB9IH0sXG4gIH0pO1xuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuICBpZiAoYm9va2luZy51c2VySWQgIT09IHVzZXJJZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwYXkgZm9yIHRoaXMgYm9va2luZy5cIik7XG4gIH1cbiAgaWYgKGJvb2tpbmcuc3RhdHVzID09PSBCb29raW5nU3RhdHVzLlBBSUQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIlRoaXMgYm9va2luZyBpcyBhbHJlYWR5IHBhaWQuXCIpO1xuICB9XG4gIGlmIChib29raW5nLnN0YXR1cyAhPT0gQm9va2luZ1N0YXR1cy5QRU5ESU5HKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDA5LFxuICAgICAgYENhbm5vdCBwYXkgZm9yIGEgYm9va2luZyBpbiAke2Jvb2tpbmcuc3RhdHVzLnRvTG93ZXJDYXNlKCl9IHN0YXR1cy5gLFxuICAgICk7XG4gIH1cblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSwgcGhvbmU6IHRydWUgfSxcbiAgfSk7XG4gIGlmICghdXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgY29uc3QgYW1vdW50ID0gTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSk7XG4gIGNvbnN0IHRyYW5JZCA9IGdlbmVyYXRlVHJhbklkKCk7XG5cbiAgLy8gT25lIGxpdmUgc2Vzc2lvbiBwZXIgYm9va2luZzogdGhlIGxlZGdlciByb3cgaXMgY3JlYXRlZCBhdG9taWNhbGx5IHdoaWxlXG4gIC8vIHN1cGVyc2VkaW5nIGFueSBhYmFuZG9uZWQgc2Vzc2lvbiwgdGhlbiB0aGUgZ2F0ZXdheSBpcyBhc2tlZC4gVGhlIHJvd1xuICAvLyBzdXJ2aXZlcyByZWdhcmRsZXNzIG9mIHRoZSBnYXRld2F5IHJlc3BvbnNlIFx1MjAxNCBpbml0IGZhaWx1cmUgZmxpcHMgaXQgdG9cbiAgLy8gRkFJTEVEIGJlbG93IHNvIGEgdHJ1dGhmdWwgZW50cnkgYWx3YXlzIGV4aXN0cy5cbiAgY29uc3QgcGF5bWVudCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGJvb2tpbmdJZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHgucGF5bWVudC5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICBib29raW5nSWQsXG4gICAgICAgIHRyYW5JZCxcbiAgICAgICAgYW1vdW50LFxuICAgICAgICBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVELFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgbGV0IGluaXQ6IFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB0cnkge1xuICAgIGluaXQgPSBhd2FpdCBzc2xjb21tZXJ6SW5pdCh7XG4gICAgICB0b3RhbF9hbW91bnQ6IGFtb3VudCxcbiAgICAgIHRyYW5faWQ6IHRyYW5JZCxcbiAgICAgIHN1Y2Nlc3NfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcInN1Y2Nlc3NcIiksXG4gICAgICBmYWlsX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJmYWlsXCIpLFxuICAgICAgY2FuY2VsX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJjYW5jZWxcIiksXG4gICAgICBpcG5fdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImlwblwiKSxcbiAgICAgIGN1c19uYW1lOiB1c2VyLm5hbWUsXG4gICAgICBjdXNfZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICBjdXNfcGhvbmU6IHVzZXIucGhvbmUgPz8gXCIwMTcxMTExMTExMVwiLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIGtlZXAgdGhlIGxlZGdlciB0cnV0aGZ1bCBcdTIwMTQgdGhlIHNlc3Npb24gbmV2ZXIgcmVhY2hlZCB0aGUgZ2F0ZXdheS4gVGhlXG4gICAgLy8gc3RhdHVzIGd1YXJkIG1ha2VzIGEgY29uY3VycmVudCAvY3JlYXRlIHRoYXQgYWxyZWFkeSBjYW5jZWxsZWQgdGhpcyByb3dcbiAgICAvLyB3aW4gdGhlIHJhY2UgKHRoYXQgcm93IHN0YXlzIGNhbmNlbGxlZCwgdGhpcyBvbmUgZmFpbHMgb25seSBpZiBsaXZlKS5cbiAgICBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQgfSxcbiAgICB9KTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIC8vIHN0b3JlIHRoZSBnYXRld2F5IFVSTHMgb25seSBpZiB0aGUgcm93IGlzIHN0aWxsIHRoZSBsaXZlIHNlc3Npb24uXG4gIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgZGF0YTogeyBnYXRld2F5UGFnZVVybDogaW5pdC5HYXRld2F5UGFnZVVSTCwgc3NsU2Vzc2lvbktleTogaW5pdC5zZXNzaW9ua2V5IH0sXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgcGF5bWVudElkOiBwYXltZW50LmlkLFxuICAgIHRyYW5JZDogcGF5bWVudC50cmFuSWQsXG4gICAgcGF5bWVudFVybDogaW5pdC5HYXRld2F5UGFnZVVSTCA/PyBudWxsLFxuICB9O1xufTtcblxuLy8gU2VydmVyLXNpZGUgdmVyaWZpY2F0aW9uIG9mIGEgY29tcGxldGVkIHRyYW5zYWN0aW9uOiB0aGUgdmFsaWRhdG9yIHJldHVybnNcbi8vIFZBTElEIChmaXJzdCBjaGVjaykgb3IgVkFMSURBVEVEIChhbHJlYWR5IHZlcmlmaWVkIGJlZm9yZSkgd2l0aCB0aGUgYW1vdW50LlxuLy8gQW55dGhpbmcgZWxzZSBcdTIwMTQgb3IgYSBtaXNtYXRjaGVkIGFtb3VudCBcdTIwMTQgZmFpbHMgdGhlIHBheW1lbnQuXG5jb25zdCB2ZXJpZnlTdWNjZXNzID0gYXN5bmMgKFxuICB2YWxJZDogc3RyaW5nLFxuICBleHBlY3RlZEFtb3VudDogbnVtYmVyLFxuKTogUHJvbWlzZTx7IHZlcmlmaWVkOiBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCB8IG51bGw7IG1hdGNoZXNBbW91bnQ6IGJvb2xlYW4gfT4gPT4ge1xuICBsZXQgdmVyaWZpZWQ6IFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHwgbnVsbCA9IG51bGw7XG4gIHRyeSB7XG4gICAgdmVyaWZpZWQgPSBhd2FpdCBzc2xjb21tZXJ6VmFsaWRhdGUoeyB2YWxfaWQ6IHZhbElkIH0pO1xuICB9IGNhdGNoIHtcbiAgICAvLyB2YWxpZGF0b3IgdW5yZWFjaGFibGUgXHUyMDE0IGZhaWwgdGhlIHBheW1lbnQgcmF0aGVyIHRoYW4gY3Jhc2ggdGhlIGNhbGxiYWNrXG4gICAgcmV0dXJuIHsgdmVyaWZpZWQ6IG51bGwsIG1hdGNoZXNBbW91bnQ6IGZhbHNlIH07XG4gIH1cblxuICBjb25zdCB2YWxpZFN0YXR1cyA9XG4gICAgdmVyaWZpZWQuc3RhdHVzID09PSBcIlZBTElEXCIgfHwgdmVyaWZpZWQuc3RhdHVzID09PSBcIlZBTElEQVRFRFwiO1xuICBjb25zdCBtYXRjaGVzQW1vdW50ID1cbiAgICB2ZXJpZmllZC5hbW91bnQgIT09IHVuZGVmaW5lZCAmJiBOdW1iZXIodmVyaWZpZWQuYW1vdW50KSA9PT0gZXhwZWN0ZWRBbW91bnQ7XG5cbiAgcmV0dXJuIHsgdmVyaWZpZWQsIG1hdGNoZXNBbW91bnQ6IHZhbGlkU3RhdHVzICYmIG1hdGNoZXNBbW91bnQgfTtcbn07XG5cbi8vIFNoYXJlZCBieSB0aGUgY29uZmlybSAoc3VjY2Vzcy9mYWlsL2NhbmNlbCkgYW5kIElQTiBlbmRwb2ludHMuIElkZW1wb3RlbnQ6IGFcbi8vIHNldHRsZWQgcGF5bWVudCBzaG9ydC1jaXJjdWl0cywgc28gdGhlIGRvdWJsZS1maXJpbmcgSVBOIG5ldmVyIGRvdWJsZS1jaGFyZ2VzLlxuY29uc3QgcHJvY2Vzc0dhdGV3YXlSZXN1bHQgPSBhc3luYyAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICB0cmFuSWQ6IHN0cmluZyxcbiAgcmVzdWx0OiBJR2F0ZXdheVJlc3VsdCxcbik6IFByb21pc2U8SVBheW1lbnRHYXRld2F5T3V0Y29tZT4gPT4ge1xuICBjb25zdCBwYXltZW50ID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgdHJhbklkIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgYm9va2luZzoge1xuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgdXNlcjogeyBzZWxlY3Q6IHsgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9LFxuICAgICAgICAgIHBhY2thZ2U6IHsgc2VsZWN0OiB7IHRpdGxlOiB0cnVlIH0gfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKCFwYXltZW50IHx8IHBheW1lbnQuYm9va2luZ0lkICE9PSBib29raW5nSWQpIHtcbiAgICAvLyBBIGNhbGxiYWNrIGZvciBhIHNlc3Npb24gd2UgbmV2ZXIgY3JlYXRlZCBcdTIwMTQgbm90aGluZyB0byBzZXR0bGUuXG4gICAgcmV0dXJuIHsgcGF5bWVudFN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQsIGJvb2tpbmdTdGF0dXM6IG51bGwsIGNoYW5nZWQ6IGZhbHNlIH07XG4gIH1cblxuICBpZiAocGF5bWVudC5zdGF0dXMgPT09IFBheW1lbnRTdGF0dXMuU1VDQ0VTUykge1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogZmFsc2UsXG4gICAgfTtcbiAgfVxuXG4gIC8vIENhbmNlbCBjYWxsYmFjayBcdTIwMTQgdGhlIHNob3BwZXIgYWJhbmRvbmVkIGNoZWNrb3V0LCBubyBjaGFyZ2Ugd2FzIG1hZGUuXG4gIGlmIChyZXN1bHQuZmFpbF9zdGF0dXMgPT09IFwiQ0FOQ0VMTEVEXCIgfHwgcmVzdWx0LnN0YXR1cyA9PT0gXCJDQU5DRUxMRURcIikge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkNBTkNFTExFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB1cGRhdGVkLnN0YXR1cyAhPT0gcGF5bWVudC5zdGF0dXMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIE5vIHZhbF9pZCBtZWFucyB0aGUgZ2F0ZXdheSByZXBvcnRlZCBhIGZhaWx1cmUgKGZhaWxfdXJsKSBcdTIwMTQgbm90aGluZyB0byB2ZXJpZnkuXG4gIGlmICghcmVzdWx0LnZhbF9pZCkge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB1cGRhdGVkLnN0YXR1cyAhPT0gcGF5bWVudC5zdGF0dXMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIFN1Y2Nlc3MgcGF0aDogdmVyaWZ5IHNlcnZlci1zaWRlIGFuZCBvbmx5IHRoZW4gbWFyayB0aGUgYm9va2luZyBhcyBwYWlkLlxuICBjb25zdCB7IHZlcmlmaWVkLCBtYXRjaGVzQW1vdW50IH0gPSBhd2FpdCB2ZXJpZnlTdWNjZXNzKFxuICAgIHJlc3VsdC52YWxfaWQsXG4gICAgTnVtYmVyKHBheW1lbnQuYW1vdW50KSxcbiAgKTtcblxuICBpZiAoIW1hdGNoZXNBbW91bnQpIHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQgfSxcbiAgICB9KTtcbiAgICByZXR1cm4ge1xuICAgICAgcGF5bWVudFN0YXR1czogdXBkYXRlZC5zdGF0dXMsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogdHJ1ZSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgc2V0dGxlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHR4LnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5TVUNDRVNTLFxuICAgICAgICB2YWxJZDogcmVzdWx0LnZhbF9pZCxcbiAgICAgICAgY2FyZFR5cGU6IHJlc3VsdC5jYXJkX3R5cGUgPz8gdmVyaWZpZWQ/LmNhcmRfdHlwZSxcbiAgICAgICAgYmFua1RyYW5JZDogcmVzdWx0LmJhbmtfdHJhbl9pZCA/PyB2ZXJpZmllZD8uYmFua190cmFuX2lkLFxuICAgICAgICBwYWlkQXQ6IG5ldyBEYXRlKCksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gY29tcGFyZS1hbmQtc2V0OiBvbmx5IGEgc3RpbGwtUEVORElORyBib29raW5nIGJlY29tZXMgUEFJRDsgYSBib29raW5nIHRoYXRcbiAgICAvLyB3YXMgY29uY3VycmVudGx5IGNvbmZpcm1lZCBvciBjYW5jZWxsZWQga2VlcHMgaXRzIHN0YXRlLCB0aGUgbW9uZXkgc3RheXMgb24uXG4gICAgYXdhaXQgdHguYm9va2luZy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiBib29raW5nSWQsIHN0YXR1czogQm9va2luZ1N0YXR1cy5QRU5ESU5HIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5QQUlEIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdXBkYXRlZDtcbiAgfSk7XG5cbiAgY29uc3QgYm9va2luZ0FmdGVyID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkOiBib29raW5nSWQgfSB9KTtcblxuICAvLyBiZXN0LWVmZm9ydCBcInBheW1lbnQgcmVjZWl2ZWRcIiBlbWFpbCBcdTIwMTQgbmV2ZXIgZmFpbHMgdGhlIGNhbGxiYWNrXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgIGVtYWlsOiBwYXltZW50LmJvb2tpbmcudXNlci5lbWFpbCxcbiAgICAgIG5hbWU6IHBheW1lbnQuYm9va2luZy51c2VyLm5hbWUsXG4gICAgICBwYWNrYWdlVGl0bGU6IHBheW1lbnQuYm9va2luZy5wYWNrYWdlLnRpdGxlLFxuICAgICAgdHJhdmVsRGF0ZTogcGF5bWVudC5ib29raW5nLnRyYXZlbERhdGUsXG4gICAgICB0cmF2ZWxlcnM6IHBheW1lbnQuYm9va2luZy50cmF2ZWxlcnMsXG4gICAgICB0b3RhbFByaWNlOiBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBBSUQsXG4gICAgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgcGF5bWVudFN0YXR1czogc2V0dGxlZC5zdGF0dXMsXG4gICAgYm9va2luZ1N0YXR1czogYm9va2luZ0FmdGVyPy5zdGF0dXMgPz8gbnVsbCxcbiAgICBjaGFuZ2VkOiB0cnVlLFxuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRTZXJ2aWNlID0ge1xuICBjcmVhdGVQYXltZW50U2Vzc2lvbixcbiAgcHJvY2Vzc0dhdGV3YXlSZXN1bHQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGJvb2tpbmdJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJCb29raW5nIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudXVpZChcIkJvb2tpbmcgaWQgbXVzdCBiZSBhIHZhbGlkIHV1aWRcIiksXG59KTtcblxuY29uc3QgY2FsbGJhY2tRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgYm9va2luZ0lkOiB6LnN0cmluZygpLnV1aWQoXCJCb29raW5nIGlkIG11c3QgYmUgYSB2YWxpZCB1dWlkXCIpLFxuICB0cmFuSWQ6IHouc3RyaW5nKCkubWluKDEpLFxuICBzdGF0dXM6IHouZW51bShbXCJzdWNjZXNzXCIsIFwiZmFpbFwiLCBcImNhbmNlbFwiXSkub3B0aW9uYWwoKSxcbn0pO1xuXG4vLyBCb2R5IG9mIHRoZSBnYXRld2F5IFBPU1QgXHUyMDE0IG9ubHkgZmllbGRzIHdlIGNvbnN1bWUsIGFsbCBvcHRpb25hbCBiZWNhdXNlIHRoZVxuLy8gc2hhcGUgZGlmZmVycyBiZXR3ZWVuIHN1Y2Nlc3MgLyBmYWlsIC8gY2FuY2VsIC8gSVBOIGNhbGxiYWNrcy5cbmNvbnN0IGdhdGV3YXlSZXN1bHRTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHZhbF9pZDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBzdGF0dXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgZmFpbF9zdGF0dXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgY2FyZF90eXBlOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGJhbmtfdHJhbl9pZDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBjdXJyZW5jeTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBhbW91bnQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUQ3JlYXRlUGF5bWVudFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNyZWF0ZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQ2FsbGJhY2tRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNhbGxiYWNrUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEdhdGV3YXlSZXN1bHRTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBnYXRld2F5UmVzdWx0U2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlU2NoZW1hLFxuICBjYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICBnYXRld2F5UmVzdWx0U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHdpc2hsaXN0Q29udHJvbGxlciB9IGZyb20gXCIuL3dpc2hsaXN0LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHdpc2hsaXN0VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi93aXNobGlzdC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBTYXZlIGEgcGFja2FnZSB0byB0aGUgd2lzaGxpc3QgKFVTRVIgb25seSlcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiB3aXNobGlzdFZhbGlkYXRpb25zLmNyZWF0ZVdpc2hsaXN0U2NoZW1hIH0pLFxuICB3aXNobGlzdENvbnRyb2xsZXIuYWRkVG9XaXNobGlzdCxcbik7XG5cbi8vIDIuIE15IHdpc2hsaXN0IChVU0VSIG9ubHkpIFx1MjAxNCBwYWdpbmF0ZWQsIG5ld2VzdCBmaXJzdFxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHdpc2hsaXN0VmFsaWRhdGlvbnMud2lzaGxpc3RRdWVyeVNjaGVtYSB9KSxcbiAgd2lzaGxpc3RDb250cm9sbGVyLmdldE15V2lzaGxpc3QsXG4pO1xuXG4vLyAzLiBSZW1vdmUgYSBwYWNrYWdlIGZyb20gdGhlIHdpc2hsaXN0IChVU0VSIG9ubHkpXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86cGFja2FnZUlkXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiB3aXNobGlzdFZhbGlkYXRpb25zLndpc2hsaXN0UGFyYW1zU2NoZW1hIH0pLFxuICB3aXNobGlzdENvbnRyb2xsZXIucmVtb3ZlRnJvbVdpc2hsaXN0LFxuKTtcblxuZXhwb3J0IGNvbnN0IHdpc2hsaXN0Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgd2lzaGxpc3RTZXJ2aWNlIH0gZnJvbSBcIi4vd2lzaGxpc3Quc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIFNhdmUgYSBwYWNrYWdlIHRvIHRoZSB3aXNobGlzdCBjb250cm9sbGVyIChVU0VSKVxuY29uc3QgYWRkVG9XaXNobGlzdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpc2hsaXN0U2VydmljZS5hZGRUb1dpc2hsaXN0KHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBhZGRlZCB0byB3aXNobGlzdCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBNeSB3aXNobGlzdCBjb250cm9sbGVyIChVU0VSKVxuY29uc3QgZ2V0TXlXaXNobGlzdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpc2hsaXN0U2VydmljZS5nZXRNeVdpc2hsaXN0KHVzZXJJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJXaXNobGlzdCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFJlbW92ZSBmcm9tIHdpc2hsaXN0IGNvbnRyb2xsZXIgKFVTRVIpIFx1MjAxNCAyMDQgc28gYSByZXBlYXQgZGVsZXRlIGlzIGFcbi8vICAgIG5vLW9wIGluZGlzdGluZ3Vpc2hhYmxlIGZyb20gYSBzdWNjZXNzZnVsIG9uZSAobm8gYm9keSwgbm8gZXJyb3IpLlxuY29uc3QgcmVtb3ZlRnJvbVdpc2hsaXN0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcGFja2FnZUlkID0gU3RyaW5nKHJlcS5wYXJhbXMucGFja2FnZUlkKTtcblxuICAgIGF3YWl0IHdpc2hsaXN0U2VydmljZS5yZW1vdmVGcm9tV2lzaGxpc3QodXNlcklkLCBwYWNrYWdlSWQpO1xuXG4gICAgcmVzLnN0YXR1cyhodHRwU3RhdHVzLk5PX0NPTlRFTlQpLnNlbmQoKTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCB3aXNobGlzdENvbnRyb2xsZXIgPSB7XG4gIGFkZFRvV2lzaGxpc3QsXG4gIGdldE15V2lzaGxpc3QsXG4gIHJlbW92ZUZyb21XaXNobGlzdCxcbn07IiwgImltcG9ydCB7IFBhY2thZ2VTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHB1YmxpY1BhY2thZ2VJbmNsdWRlIH0gZnJvbSBcIi4uL3BhY2thZ2UvcGFja2FnZS5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBJQ3JlYXRlV2lzaGxpc3RQYXlsb2FkLCBJV2lzaGxpc3RRdWVyeSB9IGZyb20gXCIuL3dpc2hsaXN0LmludGVyZmFjZVwiO1xuXG4vLyBNb25leSBpcyBgRGVjaW1hbCgxMCwyKWAgaW4gdGhlIHNjaGVtYSAoQUdFTlRTLm1kKSBcdTIwMTQgbWFwIHRvIE51bWJlciBvbiByZXR1cm4uXG5jb25zdCBzZXJpYWxpemVXaXNobGlzdEl0ZW0gPSA8XG4gIFQgZXh0ZW5kcyB7IHBhY2thZ2U6IHsgcHJpY2U6IFByaXNtYS5EZWNpbWFsIH0gfSxcbj4oXG4gIHJvdzogVCxcbik6IFQgPT4gKHtcbiAgLi4ucm93LFxuICBwYWNrYWdlOiB7IC4uLnJvdy5wYWNrYWdlLCBwcmljZTogTnVtYmVyKHJvdy5wYWNrYWdlLnByaWNlKSB9LFxufSk7XG5cbi8vIDEuIFNhdmUgYSBwYWNrYWdlIHRvIHRoZSB3aXNobGlzdCAoVVNFUikgXHUyMDE0IGlkZW1wb3RlbnQuIFRoZSBwYWNrYWdlIG11c3QgYmVcbi8vICAgIEFQUFJPVkVEIGFuZCBub3QgZGVsZXRlZCwgbWlycm9yaW5nIHRoZSBwdWJsaWMtcGFja2FnZSB2aXNpYmlsaXR5IHJ1bGUuXG5jb25zdCBhZGRUb1dpc2hsaXN0ID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSUNyZWF0ZVdpc2hsaXN0UGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7XG4gICAgICBpZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwcmlzbWEud2lzaGxpc3RJdGVtLnVwc2VydCh7XG4gICAgd2hlcmU6IHsgdXNlcklkX3BhY2thZ2VJZDogeyB1c2VySWQsIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQgfSB9LFxuICAgIGNyZWF0ZTogeyB1c2VySWQsIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQgfSxcbiAgICB1cGRhdGU6IHt9LFxuICB9KTtcbn07XG5cbi8vIDIuIFBhZ2luYXRlZCB3aXNobGlzdCAoVVNFUikgXHUyMDE0IG5ld2VzdCBmaXJzdC4gUm93cyB3aG9zZSBwYWNrYWdlIHdhcyBsYXRlclxuLy8gICAgc29mdC1kZWxldGVkIG9yIGRlbW90ZWQgb3V0IG9mIEFQUFJPVkVEIGFyZSBmaWx0ZXJlZCBhdCByZWFkIHRpbWUsIHNvIHRoZVxuLy8gICAgcGFnZSBuZXZlciBsaXN0cyBhIHBhY2thZ2Ugd2hvc2UgZGV0YWlsIHJvdXRlIHdvdWxkIDQwNC5cbmNvbnN0IGdldE15V2lzaGxpc3QgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJV2lzaGxpc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuV2lzaGxpc3RJdGVtV2hlcmVJbnB1dCA9IHtcbiAgICB1c2VySWQsXG4gICAgcGFja2FnZTogeyBpc0RlbGV0ZWQ6IGZhbHNlLCBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQgfSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS53aXNobGlzdEl0ZW0uZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IHBhY2thZ2U6IHsgaW5jbHVkZTogcHVibGljUGFja2FnZUluY2x1ZGUgfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLndpc2hsaXN0SXRlbS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVdpc2hsaXN0SXRlbSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMy4gUmVtb3ZlIGEgcGFja2FnZSBmcm9tIHRoZSB3aXNobGlzdCAoVVNFUikgXHUyMDE0IGlkZW1wb3RlbnQ7IGEgbWlzc2luZyByb3cgaXNcbi8vICAgIGEgbm8tb3AsIG5ldmVyIGFuIGVycm9yLiBEZWxpYmVyYXRlbHkgbm8gXCJjbGVhciBhbGxcIi5cbmNvbnN0IHJlbW92ZUZyb21XaXNobGlzdCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGFja2FnZUlkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLndpc2hsaXN0SXRlbS5kZWxldGVNYW55KHtcbiAgICB3aGVyZTogeyB1c2VySWQsIHBhY2thZ2VJZCB9LFxuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCB3aXNobGlzdFNlcnZpY2UgPSB7XG4gIGFkZFRvV2lzaGxpc3QsXG4gIGdldE15V2lzaGxpc3QsXG4gIHJlbW92ZUZyb21XaXNobGlzdCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVdpc2hsaXN0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWNrYWdlSWQ6IHpcbiAgICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC5taW4oMSwgXCJQYWNrYWdlIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHdpc2hsaXN0UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWNrYWdlSWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG59KTtcblxuY29uc3Qgd2lzaGxpc3RRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbn0pO1xuXG5leHBvcnQgY29uc3Qgd2lzaGxpc3RWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlV2lzaGxpc3RTY2hlbWEsXG4gIHdpc2hsaXN0UGFyYW1zU2NoZW1hLFxuICB3aXNobGlzdFF1ZXJ5U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBub3RpZmljYXRpb25Db250cm9sbGVyIH0gZnJvbSBcIi4vbm90aWZpY2F0aW9uLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IG5vdGlmaWNhdGlvblZhbGlkYXRpb25zIH0gZnJvbSBcIi4vbm90aWZpY2F0aW9uLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE5PVEU6IFBBVENIIC9yZWFkLWFsbCBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgUEFUQ0ggLzppZC9yZWFkIFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYC9yZWFkLWFsbGAgd291bGQgb3RoZXJ3aXNlIGJlIHN3YWxsb3dlZCBieVxuLy8gdGhlIGA6aWRgIHBhcmFtIHJvdXRlLlxuXG4vLyAxLiBNeSBub3RpZmljYXRpb25zIChhbnkgYXV0aGVudGljYXRlZCB1c2VyKSBcdTIwMTQgcGFnaW5hdGVkLCBvcHRpb25hbCA/dW5yZWFkPXRydWVcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBub3RpZmljYXRpb25WYWxpZGF0aW9ucy5ub3RpZmljYXRpb25RdWVyeVNjaGVtYSB9KSxcbiAgbm90aWZpY2F0aW9uQ29udHJvbGxlci5nZXRNeU5vdGlmaWNhdGlvbnMsXG4pO1xuXG4vLyAyLiBVbnJlYWQgY291bnQgZm9yIHRoZSBiZWxsIGJhZGdlXG5yb3V0ZXIuZ2V0KFxuICBcIi91bnJlYWQtY291bnRcIixcbiAgYXV0aCgpLFxuICBub3RpZmljYXRpb25Db250cm9sbGVyLmdldFVucmVhZENvdW50LFxuKTtcblxuLy8gMy4gTWFyayBhbGwgbXkgbm90aWZpY2F0aW9ucyByZWFkXG5yb3V0ZXIucGF0Y2goXG4gIFwiL3JlYWQtYWxsXCIsXG4gIGF1dGgoKSxcbiAgbm90aWZpY2F0aW9uQ29udHJvbGxlci5tYXJrQWxsQXNSZWFkLFxuKTtcblxuLy8gNC4gTWFyayBvbmUgbm90aWZpY2F0aW9uIHJlYWQgKG93bmVyIG9ubHkpXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9yZWFkXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBub3RpZmljYXRpb25WYWxpZGF0aW9ucy5ub3RpZmljYXRpb25QYXJhbXNTY2hlbWEgfSksXG4gIG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIubWFya0FzUmVhZCxcbik7XG5cbmV4cG9ydCBjb25zdCBub3RpZmljYXRpb25Sb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBub3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSBcIi4vbm90aWZpY2F0aW9uLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBNeSBub3RpZmljYXRpb25zIGNvbnRyb2xsZXIgKGFueSBhdXRoZW50aWNhdGVkIHVzZXIpXG5jb25zdCBnZXRNeU5vdGlmaWNhdGlvbnMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBub3RpZmljYXRpb25TZXJ2aWNlLmdldE15Tm90aWZpY2F0aW9ucyhcbiAgICAgIHVzZXJJZCxcbiAgICAgIHJlcS5xdWVyeSxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIk5vdGlmaWNhdGlvbnMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBVbnJlYWQgY291bnQgY29udHJvbGxlciAoYmVsbCBiYWRnZSlcbmNvbnN0IGdldFVucmVhZENvdW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbm90aWZpY2F0aW9uU2VydmljZS5nZXRVbnJlYWRDb3VudCh1c2VySWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVucmVhZCBjb3VudCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gTWFyayBvbmUgbm90aWZpY2F0aW9uIHJlYWQgY29udHJvbGxlclxuY29uc3QgbWFya0FzUmVhZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5vdGlmaWNhdGlvblNlcnZpY2UubWFya0FzUmVhZCh1c2VySWQsIGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJOb3RpZmljYXRpb24gbWFya2VkIGFzIHJlYWQuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBNYXJrIGFsbCBub3RpZmljYXRpb25zIHJlYWQgY29udHJvbGxlclxuY29uc3QgbWFya0FsbEFzUmVhZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5vdGlmaWNhdGlvblNlcnZpY2UubWFya0FsbEFzUmVhZCh1c2VySWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBub3RpZmljYXRpb25zIG1hcmtlZCBhcyByZWFkLlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIgPSB7XG4gIGdldE15Tm90aWZpY2F0aW9ucyxcbiAgZ2V0VW5yZWFkQ291bnQsXG4gIG1hcmtBc1JlYWQsXG4gIG1hcmtBbGxBc1JlYWQsXG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblF1ZXJ5IH0gZnJvbSBcIi4vbm90aWZpY2F0aW9uLmludGVyZmFjZVwiO1xuXG4vLyAxLiBNeSBub3RpZmljYXRpb25zIChuZXdlc3QgZmlyc3QpIFx1MjAxNCBvcHRpb25hbCA/dW5yZWFkPXRydWUgZmlsdGVyLlxuY29uc3QgZ2V0TXlOb3RpZmljYXRpb25zID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcXVlcnk6IElOb3RpZmljYXRpb25RdWVyeSxcbikgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDIwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuTm90aWZpY2F0aW9uV2hlcmVJbnB1dCA9IHtcbiAgICB1c2VySWQsXG4gICAgLi4uKHF1ZXJ5LnVucmVhZCA/IHsgaXNSZWFkOiBmYWxzZSB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLm5vdGlmaWNhdGlvbi5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ub3RpZmljYXRpb24uY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDIuIFVucmVhZCBjb3VudCBmb3IgdGhlIGJlbGwgYmFkZ2UgXHUyMDE0IHNpbmdsZSBpbmRleC1iYWNrZWQgY291bnQuXG5jb25zdCBnZXRVbnJlYWRDb3VudCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBjb3VudCA9IGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24uY291bnQoe1xuICAgIHdoZXJlOiB7IHVzZXJJZCwgaXNSZWFkOiBmYWxzZSB9LFxuICB9KTtcblxuICByZXR1cm4geyBjb3VudCB9O1xufTtcblxuLy8gMy4gTWFyayBvbmUgbm90aWZpY2F0aW9uIHJlYWQgKG93bmVyIG9ubHkgXHUyMDE0IGEgZm9yZWlnbiBpZCBpcyBhIDQwNCkuXG5jb25zdCBtYXJrQXNSZWFkID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBpZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24udXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHsgaWQsIHVzZXJJZCB9LFxuICAgIGRhdGE6IHsgaXNSZWFkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmIChyZXN1bHQuY291bnQgPT09IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIk5vdGlmaWNhdGlvbiBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHsgY291bnQ6IHJlc3VsdC5jb3VudCB9O1xufTtcblxuLy8gNC4gTWFyayBhbGwgbXkgbm90aWZpY2F0aW9ucyByZWFkIFx1MjAxNCBpZGVtcG90ZW50LlxuY29uc3QgbWFya0FsbEFzUmVhZCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEubm90aWZpY2F0aW9uLnVwZGF0ZU1hbnkoe1xuICAgIHdoZXJlOiB7IHVzZXJJZCwgaXNSZWFkOiBmYWxzZSB9LFxuICAgIGRhdGE6IHsgaXNSZWFkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7IGNvdW50OiByZXN1bHQuY291bnQgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0ge1xuICBnZXRNeU5vdGlmaWNhdGlvbnMsXG4gIGdldFVucmVhZENvdW50LFxuICBtYXJrQXNSZWFkLFxuICBtYXJrQWxsQXNSZWFkLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3Qgbm90aWZpY2F0aW9uUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgyMCksXG4gIC8vIFwidHJ1ZVwiL1wiZmFsc2VcIiBzdHJpbmdzIG9ubHkgXHUyMDE0IHouY29lcmNlLmJvb2xlYW4oKSB3b3VsZCB0cmVhdCB0aGUgc3RyaW5nXG4gIC8vIFwiZmFsc2VcIiBhcyB0cnV0aHkuXG4gIHVucmVhZDogelxuICAgIC5lbnVtKFtcInRydWVcIiwgXCJmYWxzZVwiXSlcbiAgICAudHJhbnNmb3JtKCh2YWx1ZSkgPT4gdmFsdWUgPT09IFwidHJ1ZVwiKVxuICAgIC5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IG5vdGlmaWNhdGlvblBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTm90aWZpY2F0aW9uIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiTm90aWZpY2F0aW9uIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxufSk7XG5cbmV4cG9ydCBjb25zdCBub3RpZmljYXRpb25WYWxpZGF0aW9ucyA9IHtcbiAgbm90aWZpY2F0aW9uUXVlcnlTY2hlbWEsXG4gIG5vdGlmaWNhdGlvblBhcmFtc1NjaGVtYSxcbn07IiwgIi8vIFZlcmNlbCBzZXJ2ZXJsZXNzIGVudHJ5cG9pbnQgXHUyMDE0IHJlLWV4cG9ydHMgdGhlIHNhbWUgRXhwcmVzcyBhcHAgdGhlIGxvY2FsXG4vLyBidWlsZCB1c2VzLiBWZXJjZWwncyBAdmVyY2VsL25vZGUgcnVudGltZSBjb21waWxlcyBhbmQgd3JhcHMgaXQ7IHRoZSBhcHAgaXNcbi8vIHNwbGl0IGZyb20gc2VydmVyLnRzICh3aGljaCBvbmx5IHN0YXJ0cyB0aGUgbGlzdGVuZXIpIHNvIHRoZSB0d28gaG9zdHMgc2hhcmVcbi8vIG9uZSByb3V0ZSByZWdpc3RyeS5cbmltcG9ydCBhcHAgZnJvbSBcIi4uL3NyYy9hcHBcIjtcblxuZXhwb3J0IGRlZmF1bHQgYXBwOyJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7QUFBQSxPQUFPLGFBQStEO0FBQ3RFLE9BQU8sVUFBVTtBQUNqQixPQUFPLGtCQUFrQjtBQUN6QixPQUFPLFlBQVk7QUFDbkIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sZUFBZTs7O0FDTHRCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFVBQVU7QUFDakIsU0FBUyxTQUFTO0FBRWxCLE9BQU8sT0FBTztBQUFBLEVBQ1osT0FBTztBQUFBLEVBQ1AsTUFBTSxLQUFLLEtBQUssUUFBUSxJQUFJLEdBQUcsTUFBTTtBQUN2QyxDQUFDO0FBS0QsSUFBTSxZQUFZLEVBQUUsT0FBTztBQUFBLEVBQ3pC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RTNIZixJQUFPLGdCQUFROyIsCiAgIm5hbWVzIjogWyJwYXRoIiwgImNvbmZpZyIsICJCdWZmZXIiLCAiQW55TnVsbCIsICJEYk51bGwiLCAiRGVjaW1hbCIsICJKc29uTnVsbCIsICJOdWxsVHlwZXMiLCAiUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvciIsICJQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciIsICJQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciIsICJQcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yIiwgIlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciIsICJTcWwiLCAiZW1wdHkiLCAiam9pbiIsICJyYXciLCAicnVudGltZSIsICJodHRwU3RhdHVzIiwgImNyeXB0byIsICJwYXRoIiwgImNyeXB0byIsICJyZWZyZXNoVG9rZW4iLCAicmVmcmVzaFRva2VuIiwgInJlZ2lzdGVyVXNlciIsICJodHRwU3RhdHVzIiwgImxvZ2luVXNlciIsICJnb29nbGVMb2dpbiIsICJkZW1vTG9naW4iLCAidmVyaWZ5RW1haWwiLCAicmVzZW5kVmVyaWZpY2F0aW9uIiwgImZvcmdvdFBhc3N3b3JkIiwgInJlc2V0UGFzc3dvcmQiLCAieiIsICJ6IiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImJjcnlwdCIsICJiY3J5cHQiLCAidXBkYXRlUHJvZmlsZSIsICJodHRwU3RhdHVzIiwgImdldFVzZXJzIiwgImNoYW5nZVJvbGUiLCAiY2hhbmdlU3RhdHVzIiwgImRlbGV0ZVVzZXIiLCAieiIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgIm11bHRlciIsICJodHRwU3RhdHVzIiwgImh0dHBTdGF0dXMiLCAibXVsdGVyIiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlTWVzc2FnZSIsICJodHRwU3RhdHVzIiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVCb29raW5nIiwgImh0dHBTdGF0dXMiLCAiZ2V0TXlCb29raW5ncyIsICJnZXRBZ2VudEJvb2tpbmdzIiwgImdldEJvb2tpbmdEZXRhaWwiLCAiZ2V0QWxsQm9va2luZ3MiLCAidXBkYXRlQm9va2luZ1N0YXR1cyIsICJ6IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVSZXZpZXciLCAiaHR0cFN0YXR1cyIsICJ1cGRhdGVSZXZpZXciLCAiZGVsZXRlUmV2aWV3IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVDYXRlZ29yeSIsICJodHRwU3RhdHVzIiwgImdldEFsbENhdGVnb3JpZXMiLCAidXBkYXRlQ2F0ZWdvcnkiLCAiZGVsZXRlQ2F0ZWdvcnkiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgInJhbmRvbVVVSUQiLCAicmFuZG9tVVVJRCIsICJjcmVhdGVQYWNrYWdlIiwgImh0dHBTdGF0dXMiLCAiZ2V0UHVibGljUGFja2FnZXMiLCAiZ2V0UGFja2FnZUJ5U2x1ZyIsICJnZXRBbGxQYWNrYWdlcyIsICJnZXRNeVBhY2thZ2VzIiwgInVwZGF0ZVBhY2thZ2UiLCAiY2hhbmdlUGFja2FnZVN0YXR1cyIsICJzb2Z0RGVsZXRlUGFja2FnZSIsICJ6IiwgInVwZGF0ZVN0YXR1c1NjaGVtYSIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgInJhbmRvbVVVSUQiLCAiZ2VuZXJhdGVVbmlxdWVTbHVnIiwgInJhbmRvbVVVSUQiLCAiY3JlYXRlUG9zdCIsICJodHRwU3RhdHVzIiwgImdldFB1YmxpY1Bvc3RzIiwgImdldFBvc3RCeVNsdWciLCAiZ2V0QWxsUG9zdHMiLCAiZ2V0TXlQb3N0cyIsICJ1cGRhdGVQb3N0IiwgImNoYW5nZVBvc3RTdGF0dXMiLCAic29mdERlbGV0ZVBvc3QiLCAieiIsICJ0aXRsZVNjaGVtYSIsICJ1cGRhdGVTdGF0dXNTY2hlbWEiLCAiaHR0cFN0YXR1cyIsICJnZXRQb3N0Q29tbWVudHMiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVDb21tZW50IiwgImRlbGV0ZUNvbW1lbnQiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImdldEFkbWluRGFzaGJvYXJkIiwgImh0dHBTdGF0dXMiLCAiZ2V0QWdlbnREYXNoYm9hcmQiLCAiZ2V0VXNlckRhc2hib2FyZCIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiaHR0cFN0YXR1cyIsICJ6IiwgImNyZWF0ZVNjaGVtYSIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImFkZFRvV2lzaGxpc3QiLCAiaHR0cFN0YXR1cyIsICJnZXRNeVdpc2hsaXN0IiwgInJlbW92ZUZyb21XaXNobGlzdCIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiZ2V0TXlOb3RpZmljYXRpb25zIiwgImh0dHBTdGF0dXMiLCAiZ2V0VW5yZWFkQ291bnQiLCAibWFya0FzUmVhZCIsICJtYXJrQWxsQXNSZWFkIiwgInoiLCAicm91dGVyIiwgIlJvdXRlciJdCn0K
