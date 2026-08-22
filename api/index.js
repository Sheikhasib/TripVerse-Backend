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
  // Injected by Vercel on deployed environments; absent locally.
  VERCEL_ENV: z.string().optional(),
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
  // True when serving the deployed production host. VERCEL_ENV is set by the
  // platform itself and cannot be overridden by dashboard env vars, so this
  // stays correct even if NODE_ENV is accidentally copied as "development"
  // onto production — which silently routed payment redirects to localhost.
  is_production: env.NODE_ENV === "production" || env.VERCEL_ENV === "production",
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
  graph: "wAZxwAEPBwAAoQMAIBQAAKMDACAVAACkAwAgFgAA-QIAIN8BAACiAwAw4AEAACgAEOEBAACiAwAw4gEBAAAAAeMBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhsAIBAOsCACG0AgEA6wIAIbUCAQDsAgAhAQAAAAEAIBcFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIQUFAADmBQAgBgAA4AUAIAsAAJ4FACAMAACfBQAgDQAAoQUAIBcFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAAAAAeUBQADyAgAh-gEAALcDjQIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAAAAAYYCAQDrAgAhhwIBAOsCACGIAhAArwMAIYkCAgDxAgAhigIIALYDACGLAgAA_gIAII0CAQDrAgAhjgIBAOsCACEDAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAEAAAADACAPBwAAoQMAIAgAAKsDACAKAAC0AwAg3wEAALIDADDgAQAACQAQ4QEAALIDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA68CIoACQADyAgAhqwJAAPICACGsAgIA8QIAIa0CEACvAwAhAwcAAOAFACAIAADjBQAgCgAA5QUAIA8HAAChAwAgCAAAqwMAIAoAALQDACDfAQAAsgMAMOABAAAJABDhAQAAsgMAMOIBAQAAAAHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH6AQAAswOvAiKAAkAA8gIAIasCQADyAgAhrAICAPECACGtAhAArwMAIQMAAAAJACABAAAKADACAAALACAVCQAAsQMAIN8BAACuAwAw4AEAAA0AEOEBAACuAwAw4gEBAOsCACHlAUAA8gIAIfoBAACwA5wCIoACQADyAgAhlgIBAOsCACGXAgEA6wIAIZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhowJAAKADACEKCQAA5AUAIJgCAADCAwAgnAIAAMIDACCdAgAAwgMAIJ4CAADCAwAgnwIAAMIDACCgAgAAwgMAIKECAADCAwAgogIAAMIDACCjAgAAwgMAIBUJAACxAwAg3wEAAK4DADDgAQAADQAQ4QEAAK4DADDiAQEAAAAB5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAAAAAZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhowJAAKADACEDAAAADQAgAQAADgAwAgAADwAgAQAAAA0AIA0HAAChAwAgCAAAqwMAIN8BAACtAwAw4AEAABIAEOEBAACtAwAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhigICAPECACGSAgEA6wIAIQIHAADgBQAgCAAA4wUAIA4HAAChAwAgCAAAqwMAIN8BAACtAwAw4AEAABIAEOEBAACtAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhtgIAAKwDACADAAAAEgAgAQAAEwAwAgAAFAAgCQcAAKEDACAIAACrAwAg3wEAAKoDADDgAQAAFgAQ4QEAAKoDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIQIHAADgBQAgCAAA4wUAIAoHAAChAwAgCAAAqwMAIN8BAACqAwAw4AEAABYAEOEBAACqAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIbYCAACpAwAgAwAAABYAIAEAABcAMAIAABgAIAEAAAAJACABAAAAEgAgAQAAABYAIAMAAAAJACABAAAKADACAAALACADAAAAEgAgAQAAEwAwAgAAFAAgEBEAAPkCACATAAChAwAg3wEAAKcDADDgAQAAHwAQ4QEAAKcDADDiAQEA6wIAIeUBQADyAgAh-gEAAKgDswIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAOsCACGvAgEA6wIAIbACAQDrAgAhsQIBAOsCACGzAgEA6wIAIQIRAACjBQAgEwAA4AUAIBARAAD5AgAgEwAAoQMAIN8BAACnAwAw4AEAAB8AEOEBAACnAwAw4gEBAAAAAeUBQADyAgAh-gEAAKgDswIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAAAAAa8CAQDrAgAhsAIBAOsCACGxAgEA6wIAIbMCAQDrAgAhAwAAAB8AIAEAACAAMAIAACEAIAMAAAAWACABAAAXADACAAAYACAMBwAAoQMAIN8BAAClAwAw4AEAACQAEOEBAAClAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAhhAIBAOsCACGlAgAApgOlAiKmAgEA6wIAIacCAQDsAgAhqAIgAPACACECBwAA4AUAIKcCAADCAwAgDAcAAKEDACDfAQAApQMAMOABAAAkABDhAQAApQMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhhAIBAOsCACGlAgAApgOlAiKmAgEA6wIAIacCAQDsAgAhqAIgAPACACEDAAAAJAAgAQAAJQAwAgAAJgAgDwcAAKEDACAUAACjAwAgFQAApAMAIBYAAPkCACDfAQAAogMAMOABAAAoABDhAQAAogMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGwAgEA6wIAIbQCAQDrAgAhtQIBAOwCACEFBwAA4AUAIBQAAOEFACAVAADiBQAgFgAAowUAILUCAADCAwAgAwAAACgAIAEAACkAMAIAAAEAIAoHAAChAwAg3wEAAJ8DADDgAQAAKwAQ4QEAAJ8DADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACGTAgEA6wIAIZQCQADyAgAhlQJAAKADACECBwAA4AUAIJUCAADCAwAgCgcAAKEDACDfAQAAnwMAMOABAAArABDhAQAAnwMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhkwIBAAAAAZQCQADyAgAhlQJAAKADACEDAAAAKwAgAQAALAAwAgAALQAgAQAAAAMAIAEAAAAJACABAAAAEgAgAQAAAB8AIAEAAAAWACABAAAAJAAgAQAAACgAIAEAAAArACADAAAAKAAgAQAAKQAwAgAAAQAgAQAAACgAIAEAAAAoACADAAAAKAAgAQAAKQAwAgAAAQAgAQAAACgAIAEAAAABACADAAAAKAAgAQAAKQAwAgAAAQAgAwAAACgAIAEAACkAMAIAAAEAIAMAAAAoACABAAApADACAAABACAMBwAA_AMAIBQAAPsDACAVAAD_AwAgFgAA_QMAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABsAIBAAAAAbQCAQAAAAG1AgEAAAABARwAAEAAIAjiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG0AgEAAAABtQIBAAAAAQEcAABCADABHAAAQgAwAQAAACgAIAwHAAD5AwAgFAAA7gMAIBUAAO8DACAWAADwAwAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIbACAQC8AwAhtAIBALwDACG1AgEAyAMAIQIAAAABACAcAABGACAI4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIbACAQC8AwAhtAIBALwDACG1AgEAyAMAIQIAAAAoACAcAABIACACAAAAKAAgHAAASAAgAQAAACgAIAMAAAABACAjAABAACAkAABGACABAAAAAQAgAQAAACgAIAQEAADdBQAgKQAA3wUAICoAAN4FACC1AgAAwgMAIAvfAQAAngMAMOABAABQABDhAQAAngMAMOIBAQDPAgAh4wEBAM8CACHlAUAA0AIAIf4BIADbAgAhgAJAANACACGwAgEAzwIAIbQCAQDPAgAhtQIBANcCACEDAAAAKAAgAQAATwAwKAAAUAAgAwAAACgAIAEAACkAMAIAAAEAIAEAAAAhACABAAAAIQAgAwAAAB8AIAEAACAAMAIAACEAIAMAAAAfACABAAAgADACAAAhACADAAAAHwAgAQAAIAAwAgAAIQAgDREAALAEACATAADcBQAg4gEBAAAAAeUBQAAAAAH6AQAAALMCAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGvAgEAAAABsAIBAAAAAbECAQAAAAGzAgEAAAABARwAAFgAIAviAQEAAAAB5QFAAAAAAfoBAAAAswIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAa8CAQAAAAGwAgEAAAABsQIBAAAAAbMCAQAAAAEBHAAAWgAwARwAAFoAMA0RAAClBAAgEwAA2wUAIOIBAQC8AwAh5QFAAL0DACH6AQAAowSzAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIa8CAQC8AwAhsAIBALwDACGxAgEAvAMAIbMCAQC8AwAhAgAAACEAIBwAAF0AIAviAQEAvAMAIeUBQAC9AwAh-gEAAKMEswIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGvAgEAvAMAIbACAQC8AwAhsQIBALwDACGzAgEAvAMAIQIAAAAfACAcAABfACACAAAAHwAgHAAAXwAgAwAAACEAICMAAFgAICQAAF0AIAEAAAAhACABAAAAHwAgAwQAANgFACApAADaBQAgKgAA2QUAIA7fAQAAmgMAMOABAABmABDhAQAAmgMAMOIBAQDPAgAh5QFAANACACH6AQAAmwOzAiL-ASAA2wIAIYACQADQAgAhhAIBAM8CACGFAgEAzwIAIa8CAQDPAgAhsAIBAM8CACGxAgEAzwIAIbMCAQDPAgAhAwAAAB8AIAEAAGUAMCgAAGYAIAMAAAAfACABAAAgADACAAAhACABAAAACwAgAQAAAAsAIAMAAAAJACABAAAKADACAAALACADAAAACQAgAQAACgAwAgAACwAgAwAAAAkAIAEAAAoAMAIAAAsAIAwHAACOBQAgCAAA3AQAIAoAAN0EACDiAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACvAgKAAkAAAAABqwJAAAAAAawCAgAAAAGtAhAAAAABARwAAG4AIAniAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACvAgKAAkAAAAABqwJAAAAAAawCAgAAAAGtAhAAAAABARwAAHAAMAEcAABwADAMBwAAjAUAIAgAAMwEACAKAADNBAAg4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSvAiKAAkAAvQMAIasCQAC9AwAhrAICAM0DACGtAhAAyQQAIQIAAAALACAcAABzACAJ4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSvAiKAAkAAvQMAIasCQAC9AwAhrAICAM0DACGtAhAAyQQAIQIAAAAJACAcAAB1ACACAAAACQAgHAAAdQAgAwAAAAsAICMAAG4AICQAAHMAIAEAAAALACABAAAACQAgBQQAANMFACApAADWBQAgKgAA1QUAIEsAANQFACBMAADXBQAgDN8BAACWAwAw4AEAAHwAEOEBAACWAwAw4gEBAM8CACHjAQEAzwIAIeQBAQDPAgAh5QFAANACACH6AQAAlwOvAiKAAkAA0AIAIasCQADQAgAhrAICANwCACGtAhAA_AIAIQMAAAAJACABAAB7ADAoAAB8ACADAAAACQAgAQAACgAwAgAACwAgCQMAAPMCACDfAQAAlQMAMOABAACCAQAQ4QEAAJUDADDiAQEAAAAB5QFAAPICACHxAQEAAAABgAJAAPICACGFAgEAAAABAQAAAH8AIAEAAAB_ACAJAwAA8wIAIN8BAACVAwAw4AEAAIIBABDhAQAAlQMAMOIBAQDrAgAh5QFAAPICACHxAQEA6wIAIYACQADyAgAhhQIBAOsCACEBAwAAnQUAIAMAAACCAQAgAQAAgwEAMAIAAH8AIAMAAACCAQAgAQAAgwEAMAIAAH8AIAMAAACCAQAgAQAAgwEAMAIAAH8AIAYDAADSBQAg4gEBAAAAAeUBQAAAAAHxAQEAAAABgAJAAAAAAYUCAQAAAAEBHAAAhwEAIAXiAQEAAAAB5QFAAAAAAfEBAQAAAAGAAkAAAAABhQIBAAAAAQEcAACJAQAwARwAAIkBADAGAwAAyAUAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIYACQAC9AwAhhQIBALwDACECAAAAfwAgHAAAjAEAIAXiAQEAvAMAIeUBQAC9AwAh8QEBALwDACGAAkAAvQMAIYUCAQC8AwAhAgAAAIIBACAcAACOAQAgAgAAAIIBACAcAACOAQAgAwAAAH8AICMAAIcBACAkAACMAQAgAQAAAH8AIAEAAACCAQAgAwQAAMUFACApAADHBQAgKgAAxgUAIAjfAQAAlAMAMOABAACVAQAQ4QEAAJQDADDiAQEAzwIAIeUBQADQAgAh8QEBAM8CACGAAkAA0AIAIYUCAQDPAgAhAwAAAIIBACABAACUAQAwKAAAlQEAIAMAAACCAQAgAQAAgwEAMAIAAH8AIAvfAQAAkwMAMOABAACbAQAQ4QEAAJMDADDiAQEAAAAB5QFAAPICACHxAQEA6wIAIfIBAQDrAgAhgAJAAPICACGmAgEA6wIAIakCAQDrAgAhqgIgAPACACEBAAAAmAEAIAEAAACYAQAgC98BAACTAwAw4AEAAJsBABDhAQAAkwMAMOIBAQDrAgAh5QFAAPICACHxAQEA6wIAIfIBAQDrAgAhgAJAAPICACGmAgEA6wIAIakCAQDrAgAhqgIgAPACACEAAwAAAJsBACABAACcAQAwAgAAmAEAIAMAAACbAQAgAQAAnAEAMAIAAJgBACADAAAAmwEAIAEAAJwBADACAACYAQAgCOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAGAAkAAAAABpgIBAAAAAakCAQAAAAGqAiAAAAABARwAAKABACAI4gEBAAAAAeUBQAAAAAHxAQEAAAAB8gEBAAAAAYACQAAAAAGmAgEAAAABqQIBAAAAAaoCIAAAAAEBHAAAogEAMAEcAACiAQAwCOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAhgAJAAL0DACGmAgEAvAMAIakCAQC8AwAhqgIgAMwDACECAAAAmAEAIBwAAKUBACAI4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACGAAkAAvQMAIaYCAQC8AwAhqQIBALwDACGqAiAAzAMAIQIAAACbAQAgHAAApwEAIAIAAACbAQAgHAAApwEAIAMAAACYAQAgIwAAoAEAICQAAKUBACABAAAAmAEAIAEAAACbAQAgAwQAAMIFACApAADEBQAgKgAAwwUAIAvfAQAAkgMAMOABAACuAQAQ4QEAAJIDADDiAQEAzwIAIeUBQADQAgAh8QEBAM8CACHyAQEAzwIAIYACQADQAgAhpgIBAM8CACGpAgEAzwIAIaoCIADbAgAhAwAAAJsBACABAACtAQAwKAAArgEAIAMAAACbAQAgAQAAnAEAMAIAAJgBACABAAAAJgAgAQAAACYAIAMAAAAkACABAAAlADACAAAmACADAAAAJAAgAQAAJQAwAgAAJgAgAwAAACQAIAEAACUAMAIAACYAIAkHAADBBQAg4gEBAAAAAeMBAQAAAAHlAUAAAAABhAIBAAAAAaUCAAAApQICpgIBAAAAAacCAQAAAAGoAiAAAAABARwAALYBACAI4gEBAAAAAeMBAQAAAAHlAUAAAAABhAIBAAAAAaUCAAAApQICpgIBAAAAAacCAQAAAAGoAiAAAAABARwAALgBADABHAAAuAEAMAkHAADABQAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAhhAIBALwDACGlAgAAigSlAiKmAgEAvAMAIacCAQDIAwAhqAIgAMwDACECAAAAJgAgHAAAuwEAIAjiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACGEAgEAvAMAIaUCAACKBKUCIqYCAQC8AwAhpwIBAMgDACGoAiAAzAMAIQIAAAAkACAcAAC9AQAgAgAAACQAIBwAAL0BACADAAAAJgAgIwAAtgEAICQAALsBACABAAAAJgAgAQAAACQAIAQEAAC9BQAgKQAAvwUAICoAAL4FACCnAgAAwgMAIAvfAQAAjgMAMOABAADEAQAQ4QEAAI4DADDiAQEAzwIAIeMBAQDPAgAh5QFAANACACGEAgEAzwIAIaUCAACPA6UCIqYCAQDPAgAhpwIBANcCACGoAiAA2wIAIQMAAAAkACABAADDAQAwKAAAxAEAIAMAAAAkACABAAAlADACAAAmACABAAAADwAgAQAAAA8AIAMAAAANACABAAAOADACAAAPACADAAAADQAgAQAADgAwAgAADwAgAwAAAA0AIAEAAA4AMAIAAA8AIBIJAAC8BQAg4gEBAAAAAeUBQAAAAAH6AQAAAJwCAoACQAAAAAGWAgEAAAABlwIBAAAAAZgCAQAAAAGZAhAAAAABmgIBAAAAAZwCAQAAAAGdAgEAAAABngIBAAAAAZ8CAQAAAAGgAkAAAAABoQIBAAAAAaICQAAAAAGjAkAAAAABARwAAMwBACAR4gEBAAAAAeUBQAAAAAH6AQAAAJwCAoACQAAAAAGWAgEAAAABlwIBAAAAAZgCAQAAAAGZAhAAAAABmgIBAAAAAZwCAQAAAAGdAgEAAAABngIBAAAAAZ8CAQAAAAGgAkAAAAABoQIBAAAAAaICQAAAAAGjAkAAAAABARwAAM4BADABHAAAzgEAMBIJAAC7BQAg4gEBALwDACHlAUAAvQMAIfoBAADYBJwCIoACQAC9AwAhlgIBALwDACGXAgEAvAMAIZgCAQDIAwAhmQIQAMkEACGaAgEAvAMAIZwCAQDIAwAhnQIBAMgDACGeAgEAyAMAIZ8CAQDIAwAhoAJAAOADACGhAgEAyAMAIaICQADgAwAhowJAAOADACECAAAADwAgHAAA0QEAIBHiAQEAvAMAIeUBQAC9AwAh-gEAANgEnAIigAJAAL0DACGWAgEAvAMAIZcCAQC8AwAhmAIBAMgDACGZAhAAyQQAIZoCAQC8AwAhnAIBAMgDACGdAgEAyAMAIZ4CAQDIAwAhnwIBAMgDACGgAkAA4AMAIaECAQDIAwAhogJAAOADACGjAkAA4AMAIQIAAAANACAcAADTAQAgAgAAAA0AIBwAANMBACADAAAADwAgIwAAzAEAICQAANEBACABAAAADwAgAQAAAA0AIA4EAAC2BQAgKQAAuQUAICoAALgFACBLAAC3BQAgTAAAugUAIJgCAADCAwAgnAIAAMIDACCdAgAAwgMAIJ4CAADCAwAgnwIAAMIDACCgAgAAwgMAIKECAADCAwAgogIAAMIDACCjAgAAwgMAIBTfAQAAigMAMOABAADaAQAQ4QEAAIoDADDiAQEAzwIAIeUBQADQAgAh-gEAAIsDnAIigAJAANACACGWAgEAzwIAIZcCAQDPAgAhmAIBANcCACGZAhAA_AIAIZoCAQDPAgAhnAIBANcCACGdAgEA1wIAIZ4CAQDXAgAhnwIBANcCACGgAkAAhwMAIaECAQDXAgAhogJAAIcDACGjAkAAhwMAIQMAAAANACABAADZAQAwKAAA2gEAIAMAAAANACABAAAOADACAAAPACABAAAALQAgAQAAAC0AIAMAAAArACABAAAsADACAAAtACADAAAAKwAgAQAALAAwAgAALQAgAwAAACsAIAEAACwAMAIAAC0AIAcHAAC1BQAg4gEBAAAAAeMBAQAAAAHlAUAAAAABkwIBAAAAAZQCQAAAAAGVAkAAAAABARwAAOIBACAG4gEBAAAAAeMBAQAAAAHlAUAAAAABkwIBAAAAAZQCQAAAAAGVAkAAAAABARwAAOQBADABHAAA5AEAMAcHAAC0BQAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAhkwIBALwDACGUAkAAvQMAIZUCQADgAwAhAgAAAC0AIBwAAOcBACAG4gEBALwDACHjAQEAvAMAIeUBQAC9AwAhkwIBALwDACGUAkAAvQMAIZUCQADgAwAhAgAAACsAIBwAAOkBACACAAAAKwAgHAAA6QEAIAMAAAAtACAjAADiAQAgJAAA5wEAIAEAAAAtACABAAAAKwAgBAQAALEFACApAACzBQAgKgAAsgUAIJUCAADCAwAgCd8BAACGAwAw4AEAAPABABDhAQAAhgMAMOIBAQDPAgAh4wEBAM8CACHlAUAA0AIAIZMCAQDPAgAhlAJAANACACGVAkAAhwMAIQMAAAArACABAADvAQAwKAAA8AEAIAMAAAArACABAAAsADACAAAtACABAAAAFAAgAQAAABQAIAMAAAASACABAAATADACAAAUACADAAAAEgAgAQAAEwAwAgAAFAAgAwAAABIAIAEAABMAMAIAABQAIAoHAACDBQAgCAAAvgQAIOIBAQAAAAHjAQEAAAAB5AEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAYoCAgAAAAGSAgEAAAABARwAAPgBACAI4gEBAAAAAeMBAQAAAAHkAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABigICAAAAAZICAQAAAAEBHAAA-gEAMAEcAAD6AQAwCgcAAIEFACAIAAC8BAAg4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhigICAM0DACGSAgEAvAMAIQIAAAAUACAcAAD9AQAgCOIBAQC8AwAh4wEBALwDACHkAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIYoCAgDNAwAhkgIBALwDACECAAAAEgAgHAAA_wEAIAIAAAASACAcAAD_AQAgAwAAABQAICMAAPgBACAkAAD9AQAgAQAAABQAIAEAAAASACAFBAAArAUAICkAAK8FACAqAACuBQAgSwAArQUAIEwAALAFACAL3wEAAIUDADDgAQAAhgIAEOEBAACFAwAw4gEBAM8CACHjAQEAzwIAIeQBAQDPAgAh5QFAANACACH-ASAA2wIAIYACQADQAgAhigICANwCACGSAgEAzwIAIQMAAAASACABAACFAgAwKAAAhgIAIAMAAAASACABAAATADACAAAUACABAAAABQAgAQAAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIBQFAACRBQAgBgAAqwUAIAsAAJIFACAMAACTBQAgDQAAlAUAIOIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII0CAQAAAAGOAgEAAAABARwAAI4CACAP4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAEBHAAAkAIAMAEcAACQAgAwFAUAAOwEACAGAACqBQAgCwAA7QQAIAwAAO4EACANAADvBAAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIQIAAAAFACAcAACTAgAgD-IBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhjgIBALwDACECAAAAAwAgHAAAlQIAIAIAAAADACAcAACVAgAgAwAAAAUAICMAAI4CACAkAACTAgAgAQAAAAUAIAEAAAADACAFBAAApQUAICkAAKgFACAqAACnBQAgSwAApgUAIEwAAKkFACAS3wEAAPsCADDgAQAAnAIAEOEBAAD7AgAw4gEBAM8CACHlAUAA0AIAIfoBAAD_Ao0CIv4BIADbAgAhgAJAANACACGEAgEAzwIAIYUCAQDPAgAhhgIBAM8CACGHAgEAzwIAIYgCEAD8AgAhiQICANwCACGKAggA_QIAIYsCAAD-AgAgjQIBAM8CACGOAgEAzwIAIQMAAAADACABAACbAgAwKAAAnAIAIAMAAAADACABAAAEADACAAAFACAaAwAA8wIAIAsAAPQCACAMAAD1AgAgDgAA9gIAIA8AAPcCACAQAAD4AgAgEQAA-QIAIBIAAPoCACDfAQAA6gIAMOABAACiAgAQ4QEAAOoCADDiAQEAAAAB5QFAAPICACHxAQEA6wIAIfIBAQAAAAHzAQEA7AIAIfQBAQAAAAH1AQEA7AIAIfYBAQDsAgAh-AEAAO0C-AEi-gEAAO4C-gEi_AEAAO8C_AEi_QEgAPACACH-ASAA8AIAIf8BAgDxAgAhgAJAAPICACEBAAAAnwIAIAEAAACfAgAgGgMAAPMCACALAAD0AgAgDAAA9QIAIA4AAPYCACAPAAD3AgAgEAAA-AIAIBEAAPkCACASAAD6AgAg3wEAAOoCADDgAQAAogIAEOEBAADqAgAw4gEBAOsCACHlAUAA8gIAIfEBAQDrAgAh8gEBAOsCACHzAQEA7AIAIfQBAQDsAgAh9QEBAOwCACH2AQEA7AIAIfgBAADtAvgBIvoBAADuAvoBIvwBAADvAvwBIv0BIADwAgAh_gEgAPACACH_AQIA8QIAIYACQADyAgAhDAMAAJ0FACALAACeBQAgDAAAnwUAIA4AAKAFACAPAAChBQAgEAAAogUAIBEAAKMFACASAACkBQAg8wEAAMIDACD0AQAAwgMAIPUBAADCAwAg9gEAAMIDACADAAAAogIAIAEAAKMCADACAACfAgAgAwAAAKICACABAACjAgAwAgAAnwIAIAMAAACiAgAgAQAAowIAMAIAAJ8CACAXAwAAlQUAIAsAAJYFACAMAACXBQAgDgAAmAUAIA8AAJkFACAQAACaBQAgEQAAmwUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAEBHAAApwIAIA_iAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAEBHAAAqQIAMAEcAACpAgAwFwMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhAgAAAJ8CACAcAACsAgAgD-IBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIQIAAACiAgAgHAAArgIAIAIAAACiAgAgHAAArgIAIAMAAACfAgAgIwAApwIAICQAAKwCACABAAAAnwIAIAEAAACiAgAgCQQAAMMDACApAADGAwAgKgAAxQMAIEsAAMQDACBMAADHAwAg8wEAAMIDACD0AQAAwgMAIPUBAADCAwAg9gEAAMIDACAS3wEAANYCADDgAQAAtQIAEOEBAADWAgAw4gEBAM8CACHlAUAA0AIAIfEBAQDPAgAh8gEBAM8CACHzAQEA1wIAIfQBAQDXAgAh9QEBANcCACH2AQEA1wIAIfgBAADYAvgBIvoBAADZAvoBIvwBAADaAvwBIv0BIADbAgAh_gEgANsCACH_AQIA3AIAIYACQADQAgAhAwAAAKICACABAAC0AgAwKAAAtQIAIAMAAACiAgAgAQAAowIAMAIAAJ8CACABAAAAGAAgAQAAABgAIAMAAAAWACABAAAXADACAAAYACADAAAAFgAgAQAAFwAwAgAAGAAgAwAAABYAIAEAABcAMAIAABgAIAYHAADAAwAgCAAAwQMAIOIBAQAAAAHjAQEAAAAB5AEBAAAAAeUBQAAAAAEBHAAAvQIAIATiAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAABARwAAL8CADABHAAAvwIAMAYHAAC-AwAgCAAAvwMAIOIBAQC8AwAh4wEBALwDACHkAQEAvAMAIeUBQAC9AwAhAgAAABgAIBwAAMICACAE4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACECAAAAFgAgHAAAxAIAIAIAAAAWACAcAADEAgAgAwAAABgAICMAAL0CACAkAADCAgAgAQAAABgAIAEAAAAWACADBAAAuQMAICkAALsDACAqAAC6AwAgB98BAADOAgAw4AEAAMsCABDhAQAAzgIAMOIBAQDPAgAh4wEBAM8CACHkAQEAzwIAIeUBQADQAgAhAwAAABYAIAEAAMoCADAoAADLAgAgAwAAABYAIAEAABcAMAIAABgAIAffAQAAzgIAMOABAADLAgAQ4QEAAM4CADDiAQEAzwIAIeMBAQDPAgAh5AEBAM8CACHlAUAA0AIAIQ4EAADSAgAgKQAA1QIAICoAANUCACDmAQEAAAAB5wEBAAAABOgBAQAAAATpAQEAAAAB6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBANQCACHuAQEAAAAB7wEBAAAAAfABAQAAAAELBAAA0gIAICkAANMCACAqAADTAgAg5gFAAAAAAecBQAAAAAToAUAAAAAE6QFAAAAAAeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQADRAgAhCwQAANICACApAADTAgAgKgAA0wIAIOYBQAAAAAHnAUAAAAAE6AFAAAAABOkBQAAAAAHqAUAAAAAB6wFAAAAAAewBQAAAAAHtAUAA0QIAIQjmAQIAAAAB5wECAAAABOgBAgAAAATpAQIAAAAB6gECAAAAAesBAgAAAAHsAQIAAAAB7QECANICACEI5gFAAAAAAecBQAAAAAToAUAAAAAE6QFAAAAAAeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQADTAgAhDgQAANICACApAADVAgAgKgAA1QIAIOYBAQAAAAHnAQEAAAAE6AEBAAAABOkBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA1AIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAAQvmAQEAAAAB5wEBAAAABOgBAQAAAATpAQEAAAAB6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBANUCACHuAQEAAAAB7wEBAAAAAfABAQAAAAES3wEAANYCADDgAQAAtQIAEOEBAADWAgAw4gEBAM8CACHlAUAA0AIAIfEBAQDPAgAh8gEBAM8CACHzAQEA1wIAIfQBAQDXAgAh9QEBANcCACH2AQEA1wIAIfgBAADYAvgBIvoBAADZAvoBIvwBAADaAvwBIv0BIADbAgAh_gEgANsCACH_AQIA3AIAIYACQADQAgAhDgQAAOgCACApAADpAgAgKgAA6QIAIOYBAQAAAAHnAQEAAAAF6AEBAAAABekBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA5wIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAAQcEAADSAgAgKQAA5gIAICoAAOYCACDmAQAAAPgBAucBAAAA-AEI6AEAAAD4AQjtAQAA5QL4ASIHBAAA0gIAICkAAOQCACAqAADkAgAg5gEAAAD6AQLnAQAAAPoBCOgBAAAA-gEI7QEAAOMC-gEiBwQAANICACApAADiAgAgKgAA4gIAIOYBAAAA_AEC5wEAAAD8AQjoAQAAAPwBCO0BAADhAvwBIgUEAADSAgAgKQAA4AIAICoAAOACACDmASAAAAAB7QEgAN8CACENBAAA0gIAICkAANICACAqAADSAgAgSwAA3gIAIEwAANICACDmAQIAAAAB5wECAAAABOgBAgAAAATpAQIAAAAB6gECAAAAAesBAgAAAAHsAQIAAAAB7QECAN0CACENBAAA0gIAICkAANICACAqAADSAgAgSwAA3gIAIEwAANICACDmAQIAAAAB5wECAAAABOgBAgAAAATpAQIAAAAB6gECAAAAAesBAgAAAAHsAQIAAAAB7QECAN0CACEI5gEIAAAAAecBCAAAAAToAQgAAAAE6QEIAAAAAeoBCAAAAAHrAQgAAAAB7AEIAAAAAe0BCADeAgAhBQQAANICACApAADgAgAgKgAA4AIAIOYBIAAAAAHtASAA3wIAIQLmASAAAAAB7QEgAOACACEHBAAA0gIAICkAAOICACAqAADiAgAg5gEAAAD8AQLnAQAAAPwBCOgBAAAA_AEI7QEAAOEC_AEiBOYBAAAA_AEC5wEAAAD8AQjoAQAAAPwBCO0BAADiAvwBIgcEAADSAgAgKQAA5AIAICoAAOQCACDmAQAAAPoBAucBAAAA-gEI6AEAAAD6AQjtAQAA4wL6ASIE5gEAAAD6AQLnAQAAAPoBCOgBAAAA-gEI7QEAAOQC-gEiBwQAANICACApAADmAgAgKgAA5gIAIOYBAAAA-AEC5wEAAAD4AQjoAQAAAPgBCO0BAADlAvgBIgTmAQAAAPgBAucBAAAA-AEI6AEAAAD4AQjtAQAA5gL4ASIOBAAA6AIAICkAAOkCACAqAADpAgAg5gEBAAAAAecBAQAAAAXoAQEAAAAF6QEBAAAAAeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQDnAgAh7gEBAAAAAe8BAQAAAAHwAQEAAAABCOYBAgAAAAHnAQIAAAAF6AECAAAABekBAgAAAAHqAQIAAAAB6wECAAAAAewBAgAAAAHtAQIA6AIAIQvmAQEAAAAB5wEBAAAABegBAQAAAAXpAQEAAAAB6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBAOkCACHuAQEAAAAB7wEBAAAAAfABAQAAAAEaAwAA8wIAIAsAAPQCACAMAAD1AgAgDgAA9gIAIA8AAPcCACAQAAD4AgAgEQAA-QIAIBIAAPoCACDfAQAA6gIAMOABAACiAgAQ4QEAAOoCADDiAQEA6wIAIeUBQADyAgAh8QEBAOsCACHyAQEA6wIAIfMBAQDsAgAh9AEBAOwCACH1AQEA7AIAIfYBAQDsAgAh-AEAAO0C-AEi-gEAAO4C-gEi_AEAAO8C_AEi_QEgAPACACH-ASAA8AIAIf8BAgDxAgAhgAJAAPICACEL5gEBAAAAAecBAQAAAAToAQEAAAAE6QEBAAAAAeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQDVAgAh7gEBAAAAAe8BAQAAAAHwAQEAAAABC-YBAQAAAAHnAQEAAAAF6AEBAAAABekBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA6QIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAAQTmAQAAAPgBAucBAAAA-AEI6AEAAAD4AQjtAQAA5gL4ASIE5gEAAAD6AQLnAQAAAPoBCOgBAAAA-gEI7QEAAOQC-gEiBOYBAAAA_AEC5wEAAAD8AQjoAQAAAPwBCO0BAADiAvwBIgLmASAAAAAB7QEgAOACACEI5gECAAAAAecBAgAAAAToAQIAAAAE6QECAAAAAeoBAgAAAAHrAQIAAAAB7AECAAAAAe0BAgDSAgAhCOYBQAAAAAHnAUAAAAAE6AFAAAAABOkBQAAAAAHqAUAAAAAB6wFAAAAAAewBQAAAAAHtAUAA0wIAIQOBAgAAAwAgggIAAAMAIIMCAAADACADgQIAAAkAIIICAAAJACCDAgAACQAgA4ECAAASACCCAgAAEgAggwIAABIAIAOBAgAAHwAgggIAAB8AIIMCAAAfACADgQIAABYAIIICAAAWACCDAgAAFgAgA4ECAAAkACCCAgAAJAAggwIAACQAIAOBAgAAKAAgggIAACgAIIMCAAAoACADgQIAACsAIIICAAArACCDAgAAKwAgEt8BAAD7AgAw4AEAAJwCABDhAQAA-wIAMOIBAQDPAgAh5QFAANACACH6AQAA_wKNAiL-ASAA2wIAIYACQADQAgAhhAIBAM8CACGFAgEAzwIAIYYCAQDPAgAhhwIBAM8CACGIAhAA_AIAIYkCAgDcAgAhigIIAP0CACGLAgAA_gIAII0CAQDPAgAhjgIBAM8CACENBAAA0gIAICkAAIQDACAqAACEAwAgSwAAhAMAIEwAAIQDACDmARAAAAAB5wEQAAAABOgBEAAAAATpARAAAAAB6gEQAAAAAesBEAAAAAHsARAAAAAB7QEQAIMDACENBAAA0gIAICkAAN4CACAqAADeAgAgSwAA3gIAIEwAAN4CACDmAQgAAAAB5wEIAAAABOgBCAAAAATpAQgAAAAB6gEIAAAAAesBCAAAAAHsAQgAAAAB7QEIAIIDACEE5gEBAAAABY8CAQAAAAGQAgEAAAAEkQIBAAAABAcEAADSAgAgKQAAgQMAICoAAIEDACDmAQAAAI0CAucBAAAAjQII6AEAAACNAgjtAQAAgAONAiIHBAAA0gIAICkAAIEDACAqAACBAwAg5gEAAACNAgLnAQAAAI0CCOgBAAAAjQII7QEAAIADjQIiBOYBAAAAjQIC5wEAAACNAgjoAQAAAI0CCO0BAACBA40CIg0EAADSAgAgKQAA3gIAICoAAN4CACBLAADeAgAgTAAA3gIAIOYBCAAAAAHnAQgAAAAE6AEIAAAABOkBCAAAAAHqAQgAAAAB6wEIAAAAAewBCAAAAAHtAQgAggMAIQ0EAADSAgAgKQAAhAMAICoAAIQDACBLAACEAwAgTAAAhAMAIOYBEAAAAAHnARAAAAAE6AEQAAAABOkBEAAAAAHqARAAAAAB6wEQAAAAAewBEAAAAAHtARAAgwMAIQjmARAAAAAB5wEQAAAABOgBEAAAAATpARAAAAAB6gEQAAAAAesBEAAAAAHsARAAAAAB7QEQAIQDACEL3wEAAIUDADDgAQAAhgIAEOEBAACFAwAw4gEBAM8CACHjAQEAzwIAIeQBAQDPAgAh5QFAANACACH-ASAA2wIAIYACQADQAgAhigICANwCACGSAgEAzwIAIQnfAQAAhgMAMOABAADwAQAQ4QEAAIYDADDiAQEAzwIAIeMBAQDPAgAh5QFAANACACGTAgEAzwIAIZQCQADQAgAhlQJAAIcDACELBAAA6AIAICkAAIkDACAqAACJAwAg5gFAAAAAAecBQAAAAAXoAUAAAAAF6QFAAAAAAeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQACIAwAhCwQAAOgCACApAACJAwAgKgAAiQMAIOYBQAAAAAHnAUAAAAAF6AFAAAAABekBQAAAAAHqAUAAAAAB6wFAAAAAAewBQAAAAAHtAUAAiAMAIQjmAUAAAAAB5wFAAAAABegBQAAAAAXpAUAAAAAB6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAAIkDACEU3wEAAIoDADDgAQAA2gEAEOEBAACKAwAw4gEBAM8CACHlAUAA0AIAIfoBAACLA5wCIoACQADQAgAhlgIBAM8CACGXAgEAzwIAIZgCAQDXAgAhmQIQAPwCACGaAgEAzwIAIZwCAQDXAgAhnQIBANcCACGeAgEA1wIAIZ8CAQDXAgAhoAJAAIcDACGhAgEA1wIAIaICQACHAwAhowJAAIcDACEHBAAA0gIAICkAAI0DACAqAACNAwAg5gEAAACcAgLnAQAAAJwCCOgBAAAAnAII7QEAAIwDnAIiBwQAANICACApAACNAwAgKgAAjQMAIOYBAAAAnAIC5wEAAACcAgjoAQAAAJwCCO0BAACMA5wCIgTmAQAAAJwCAucBAAAAnAII6AEAAACcAgjtAQAAjQOcAiIL3wEAAI4DADDgAQAAxAEAEOEBAACOAwAw4gEBAM8CACHjAQEAzwIAIeUBQADQAgAhhAIBAM8CACGlAgAAjwOlAiKmAgEAzwIAIacCAQDXAgAhqAIgANsCACEHBAAA0gIAICkAAJEDACAqAACRAwAg5gEAAAClAgLnAQAAAKUCCOgBAAAApQII7QEAAJADpQIiBwQAANICACApAACRAwAgKgAAkQMAIOYBAAAApQIC5wEAAAClAgjoAQAAAKUCCO0BAACQA6UCIgTmAQAAAKUCAucBAAAApQII6AEAAAClAgjtAQAAkQOlAiIL3wEAAJIDADDgAQAArgEAEOEBAACSAwAw4gEBAM8CACHlAUAA0AIAIfEBAQDPAgAh8gEBAM8CACGAAkAA0AIAIaYCAQDPAgAhqQIBAM8CACGqAiAA2wIAIQvfAQAAkwMAMOABAACbAQAQ4QEAAJMDADDiAQEA6wIAIeUBQADyAgAh8QEBAOsCACHyAQEA6wIAIYACQADyAgAhpgIBAOsCACGpAgEA6wIAIaoCIADwAgAhCN8BAACUAwAw4AEAAJUBABDhAQAAlAMAMOIBAQDPAgAh5QFAANACACHxAQEAzwIAIYACQADQAgAhhQIBAM8CACEJAwAA8wIAIN8BAACVAwAw4AEAAIIBABDhAQAAlQMAMOIBAQDrAgAh5QFAAPICACHxAQEA6wIAIYACQADyAgAhhQIBAOsCACEM3wEAAJYDADDgAQAAfAAQ4QEAAJYDADDiAQEAzwIAIeMBAQDPAgAh5AEBAM8CACHlAUAA0AIAIfoBAACXA68CIoACQADQAgAhqwJAANACACGsAgIA3AIAIa0CEAD8AgAhBwQAANICACApAACZAwAgKgAAmQMAIOYBAAAArwIC5wEAAACvAgjoAQAAAK8CCO0BAACYA68CIgcEAADSAgAgKQAAmQMAICoAAJkDACDmAQAAAK8CAucBAAAArwII6AEAAACvAgjtAQAAmAOvAiIE5gEAAACvAgLnAQAAAK8CCOgBAAAArwII7QEAAJkDrwIiDt8BAACaAwAw4AEAAGYAEOEBAACaAwAw4gEBAM8CACHlAUAA0AIAIfoBAACbA7MCIv4BIADbAgAhgAJAANACACGEAgEAzwIAIYUCAQDPAgAhrwIBAM8CACGwAgEAzwIAIbECAQDPAgAhswIBAM8CACEHBAAA0gIAICkAAJ0DACAqAACdAwAg5gEAAACzAgLnAQAAALMCCOgBAAAAswII7QEAAJwDswIiBwQAANICACApAACdAwAgKgAAnQMAIOYBAAAAswIC5wEAAACzAgjoAQAAALMCCO0BAACcA7MCIgTmAQAAALMCAucBAAAAswII6AEAAACzAgjtAQAAnQOzAiIL3wEAAJ4DADDgAQAAUAAQ4QEAAJ4DADDiAQEAzwIAIeMBAQDPAgAh5QFAANACACH-ASAA2wIAIYACQADQAgAhsAIBAM8CACG0AgEAzwIAIbUCAQDXAgAhCgcAAKEDACDfAQAAnwMAMOABAAArABDhAQAAnwMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIZMCAQDrAgAhlAJAAPICACGVAkAAoAMAIQjmAUAAAAAB5wFAAAAABegBQAAAAAXpAUAAAAAB6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAAIkDACEcAwAA8wIAIAsAAPQCACAMAAD1AgAgDgAA9gIAIA8AAPcCACAQAAD4AgAgEQAA-QIAIBIAAPoCACDfAQAA6gIAMOABAACiAgAQ4QEAAOoCADDiAQEA6wIAIeUBQADyAgAh8QEBAOsCACHyAQEA6wIAIfMBAQDsAgAh9AEBAOwCACH1AQEA7AIAIfYBAQDsAgAh-AEAAO0C-AEi-gEAAO4C-gEi_AEAAO8C_AEi_QEgAPACACH-ASAA8AIAIf8BAgDxAgAhgAJAAPICACG3AgAAogIAILgCAACiAgAgDwcAAKEDACAUAACjAwAgFQAApAMAIBYAAPkCACDfAQAAogMAMOABAAAoABDhAQAAogMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGwAgEA6wIAIbQCAQDrAgAhtQIBAOwCACESEQAA-QIAIBMAAKEDACDfAQAApwMAMOABAAAfABDhAQAApwMAMOIBAQDrAgAh5QFAAPICACH6AQAAqAOzAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIa8CAQDrAgAhsAIBAOsCACGxAgEA6wIAIbMCAQDrAgAhtwIAAB8AILgCAAAfACARBwAAoQMAIBQAAKMDACAVAACkAwAgFgAA-QIAIN8BAACiAwAw4AEAACgAEOEBAACiAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAh_gEgAPACACGAAkAA8gIAIbACAQDrAgAhtAIBAOsCACG1AgEA7AIAIbcCAAAoACC4AgAAKAAgDAcAAKEDACDfAQAApQMAMOABAAAkABDhAQAApQMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIYQCAQDrAgAhpQIAAKYDpQIipgIBAOsCACGnAgEA7AIAIagCIADwAgAhBOYBAAAApQIC5wEAAAClAgjoAQAAAKUCCO0BAACRA6UCIhARAAD5AgAgEwAAoQMAIN8BAACnAwAw4AEAAB8AEOEBAACnAwAw4gEBAOsCACHlAUAA8gIAIfoBAACoA7MCIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhrwIBAOsCACGwAgEA6wIAIbECAQDrAgAhswIBAOsCACEE5gEAAACzAgLnAQAAALMCCOgBAAAAswII7QEAAJ0DswIiAuMBAQAAAAHkAQEAAAABCQcAAKEDACAIAACrAwAg3wEAAKoDADDgAQAAFgAQ4QEAAKoDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIRkFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIbcCAAADACC4AgAAAwAgAuMBAQAAAAHkAQEAAAABDQcAAKEDACAIAACrAwAg3wEAAK0DADDgAQAAEgAQ4QEAAK0DADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhFQkAALEDACDfAQAArgMAMOABAAANABDhAQAArgMAMOIBAQDrAgAh5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAOsCACGYAgEA7AIAIZkCEACvAwAhmgIBAOsCACGcAgEA7AIAIZ0CAQDsAgAhngIBAOwCACGfAgEA7AIAIaACQACgAwAhoQIBAOwCACGiAkAAoAMAIaMCQACgAwAhCOYBEAAAAAHnARAAAAAE6AEQAAAABOkBEAAAAAHqARAAAAAB6wEQAAAAAewBEAAAAAHtARAAhAMAIQTmAQAAAJwCAucBAAAAnAII6AEAAACcAgjtAQAAjQOcAiIRBwAAoQMAIAgAAKsDACAKAAC0AwAg3wEAALIDADDgAQAACQAQ4QEAALIDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA68CIoACQADyAgAhqwJAAPICACGsAgIA8QIAIa0CEACvAwAhtwIAAAkAILgCAAAJACAPBwAAoQMAIAgAAKsDACAKAAC0AwAg3wEAALIDADDgAQAACQAQ4QEAALIDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA68CIoACQADyAgAhqwJAAPICACGsAgIA8QIAIa0CEACvAwAhBOYBAAAArwIC5wEAAACvAgjoAQAAAK8CCO0BAACZA68CIgOBAgAADQAgggIAAA0AIIMCAAANACAXBQAAuAMAIAYAAKEDACALAAD0AgAgDAAA9QIAIA0AAPcCACDfAQAAtQMAMOABAAADABDhAQAAtQMAMOIBAQDrAgAh5QFAAPICACH6AQAAtwONAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIYYCAQDrAgAhhwIBAOsCACGIAhAArwMAIYkCAgDxAgAhigIIALYDACGLAgAA_gIAII0CAQDrAgAhjgIBAOsCACEI5gEIAAAAAecBCAAAAAToAQgAAAAE6QEIAAAAAeoBCAAAAAHrAQgAAAAB7AEIAAAAAe0BCADeAgAhBOYBAAAAjQIC5wEAAACNAgjoAQAAAI0CCO0BAACBA40CIgsDAADzAgAg3wEAAJUDADDgAQAAggEAEOEBAACVAwAw4gEBAOsCACHlAUAA8gIAIfEBAQDrAgAhgAJAAPICACGFAgEA6wIAIbcCAACCAQAguAIAAIIBACAAAAABvAIBAAAAAQG8AkAAAAABBSMAALkGACAkAAC_BgAguQIAALoGACC6AgAAvgYAIL8CAACfAgAgBSMAALcGACAkAAC8BgAguQIAALgGACC6AgAAuwYAIL8CAAAFACADIwAAuQYAILkCAAC6BgAgvwIAAJ8CACADIwAAtwYAILkCAAC4BgAgvwIAAAUAIAAAAAAAAAG8AgEAAAABAbwCAAAA-AECAbwCAAAA-gECAbwCAAAA_AECAbwCIAAAAAEFvAICAAAAAcMCAgAAAAHEAgIAAAABxQICAAAAAcYCAgAAAAELIwAA3gQAMCQAAOMEADC5AgAA3wQAMLoCAADgBAAwuwIAAOEEACC8AgAA4gQAML0CAADiBAAwvgIAAOIEADC_AgAA4gQAMMACAADkBAAwwQIAAOUEADALIwAAvwQAMCQAAMQEADC5AgAAwAQAMLoCAADBBAAwuwIAAMIEACC8AgAAwwQAML0CAADDBAAwvgIAAMMEADC_AgAAwwQAMMACAADFBAAwwQIAAMYEADALIwAAsQQAMCQAALYEADC5AgAAsgQAMLoCAACzBAAwuwIAALQEACC8AgAAtQQAML0CAAC1BAAwvgIAALUEADC_AgAAtQQAMMACAAC3BAAwwQIAALgEADALIwAAmQQAMCQAAJ4EADC5AgAAmgQAMLoCAACbBAAwuwIAAJwEACC8AgAAnQQAML0CAACdBAAwvgIAAJ0EADC_AgAAnQQAMMACAACfBAAwwQIAAKAEADALIwAAjQQAMCQAAJIEADC5AgAAjgQAMLoCAACPBAAwuwIAAJAEACC8AgAAkQQAML0CAACRBAAwvgIAAJEEADC_AgAAkQQAMMACAACTBAAwwQIAAJQEADALIwAAgAQAMCQAAIUEADC5AgAAgQQAMLoCAACCBAAwuwIAAIMEACC8AgAAhAQAML0CAACEBAAwvgIAAIQEADC_AgAAhAQAMMACAACGBAAwwQIAAIcEADALIwAA4wMAMCQAAOgDADC5AgAA5AMAMLoCAADlAwAwuwIAAOYDACC8AgAA5wMAML0CAADnAwAwvgIAAOcDADC_AgAA5wMAMMACAADpAwAwwQIAAOoDADALIwAA1gMAMCQAANsDADC5AgAA1wMAMLoCAADYAwAwuwIAANkDACC8AgAA2gMAML0CAADaAwAwvgIAANoDADC_AgAA2gMAMMACAADcAwAwwQIAAN0DADAF4gEBAAAAAeUBQAAAAAGTAgEAAAABlAJAAAAAAZUCQAAAAAECAAAALQAgIwAA4gMAIAMAAAAtACAjAADiAwAgJAAA4QMAIAEcAAC2BgAwCgcAAKEDACDfAQAAnwMAMOABAAArABDhAQAAnwMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhkwIBAAAAAZQCQADyAgAhlQJAAKADACECAAAALQAgHAAA4QMAIAIAAADeAwAgHAAA3wMAIAnfAQAA3QMAMOABAADeAwAQ4QEAAN0DADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACGTAgEA6wIAIZQCQADyAgAhlQJAAKADACEJ3wEAAN0DADDgAQAA3gMAEOEBAADdAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAhkwIBAOsCACGUAkAA8gIAIZUCQACgAwAhBeIBAQC8AwAh5QFAAL0DACGTAgEAvAMAIZQCQAC9AwAhlQJAAOADACEBvAJAAAAAAQXiAQEAvAMAIeUBQAC9AwAhkwIBALwDACGUAkAAvQMAIZUCQADgAwAhBeIBAQAAAAHlAUAAAAABkwIBAAAAAZQCQAAAAAGVAkAAAAABChQAAPsDACAVAAD_AwAgFgAA_QMAIOIBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGwAgEAAAABtAIBAAAAAbUCAQAAAAECAAAAAQAgIwAA_gMAIAMAAAABACAjAAD-AwAgJAAA7QMAIAEcAAC1BgAwDwcAAKEDACAUAACjAwAgFQAApAMAIBYAAPkCACDfAQAAogMAMOABAAAoABDhAQAAogMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAh_gEgAPACACGAAkAA8gIAIbACAQDrAgAhtAIBAOsCACG1AgEA7AIAIQIAAAABACAcAADtAwAgAgAAAOsDACAcAADsAwAgC98BAADqAwAw4AEAAOsDABDhAQAA6gMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGwAgEA6wIAIbQCAQDrAgAhtQIBAOwCACEL3wEAAOoDADDgAQAA6wMAEOEBAADqAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAh_gEgAPACACGAAkAA8gIAIbACAQDrAgAhtAIBAOsCACG1AgEA7AIAIQfiAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIbACAQC8AwAhtAIBALwDACG1AgEAyAMAIQoUAADuAwAgFQAA7wMAIBYAAPADACDiAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIbACAQC8AwAhtAIBALwDACG1AgEAyAMAIQUjAACpBgAgJAAAswYAILkCAACqBgAgugIAALIGACC_AgAAIQAgByMAAKUGACAkAACwBgAguQIAAKYGACC6AgAArwYAIL0CAAAoACC-AgAAKAAgvwIAAAEAIAsjAADxAwAwJAAA9QMAMLkCAADyAwAwugIAAPMDADC7AgAA9AMAILwCAADnAwAwvQIAAOcDADC-AgAA5wMAML8CAADnAwAwwAIAAPYDADDBAgAA6gMAMAoHAAD8AwAgFAAA-wMAIBYAAP0DACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG0AgEAAAABAgAAAAEAICMAAPoDACADAAAAAQAgIwAA-gMAICQAAPgDACABHAAArgYAMAIAAAABACAcAAD4AwAgAgAAAOsDACAcAAD3AwAgB-IBAQC8AwAh4wEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGwAgEAvAMAIbQCAQC8AwAhCgcAAPkDACAUAADuAwAgFgAA8AMAIOIBAQC8AwAh4wEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGwAgEAvAMAIbQCAQC8AwAhBSMAAKcGACAkAACsBgAguQIAAKgGACC6AgAAqwYAIL8CAACfAgAgCgcAAPwDACAUAAD7AwAgFgAA_QMAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABsAIBAAAAAbQCAQAAAAEDIwAAqQYAILkCAACqBgAgvwIAACEAIAMjAACnBgAguQIAAKgGACC_AgAAnwIAIAQjAADxAwAwuQIAAPIDADC7AgAA9AMAIL8CAADnAwAwChQAAPsDACAVAAD_AwAgFgAA_QMAIOIBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGwAgEAAAABtAIBAAAAAbUCAQAAAAEDIwAApQYAILkCAACmBgAgvwIAAAEAIAfiAQEAAAAB5QFAAAAAAYQCAQAAAAGlAgAAAKUCAqYCAQAAAAGnAgEAAAABqAIgAAAAAQIAAAAmACAjAACMBAAgAwAAACYAICMAAIwEACAkAACLBAAgARwAAKQGADAMBwAAoQMAIN8BAAClAwAw4AEAACQAEOEBAAClAwAw4gEBAAAAAeMBAQDrAgAh5QFAAPICACGEAgEA6wIAIaUCAACmA6UCIqYCAQDrAgAhpwIBAOwCACGoAiAA8AIAIQIAAAAmACAcAACLBAAgAgAAAIgEACAcAACJBAAgC98BAACHBAAw4AEAAIgEABDhAQAAhwQAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIYQCAQDrAgAhpQIAAKYDpQIipgIBAOsCACGnAgEA7AIAIagCIADwAgAhC98BAACHBAAw4AEAAIgEABDhAQAAhwQAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIYQCAQDrAgAhpQIAAKYDpQIipgIBAOsCACGnAgEA7AIAIagCIADwAgAhB-IBAQC8AwAh5QFAAL0DACGEAgEAvAMAIaUCAACKBKUCIqYCAQC8AwAhpwIBAMgDACGoAiAAzAMAIQG8AgAAAKUCAgfiAQEAvAMAIeUBQAC9AwAhhAIBALwDACGlAgAAigSlAiKmAgEAvAMAIacCAQDIAwAhqAIgAMwDACEH4gEBAAAAAeUBQAAAAAGEAgEAAAABpQIAAAClAgKmAgEAAAABpwIBAAAAAagCIAAAAAEECAAAwQMAIOIBAQAAAAHkAQEAAAAB5QFAAAAAAQIAAAAYACAjAACYBAAgAwAAABgAICMAAJgEACAkAACXBAAgARwAAKMGADAKBwAAoQMAIAgAAKsDACDfAQAAqgMAMOABAAAWABDhAQAAqgMAMOIBAQAAAAHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACG2AgAAqQMAIAIAAAAYACAcAACXBAAgAgAAAJUEACAcAACWBAAgB98BAACUBAAw4AEAAJUEABDhAQAAlAQAMOIBAQDrAgAh4wEBAOsCACHkAQEA6wIAIeUBQADyAgAhB98BAACUBAAw4AEAAJUEABDhAQAAlAQAMOIBAQDrAgAh4wEBAOsCACHkAQEA6wIAIeUBQADyAgAhA-IBAQC8AwAh5AEBALwDACHlAUAAvQMAIQQIAAC_AwAg4gEBALwDACHkAQEAvAMAIeUBQAC9AwAhBAgAAMEDACDiAQEAAAAB5AEBAAAAAeUBQAAAAAELEQAAsAQAIOIBAQAAAAHlAUAAAAAB-gEAAACzAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABrwIBAAAAAbACAQAAAAGxAgEAAAABAgAAACEAICMAAK8EACADAAAAIQAgIwAArwQAICQAAKQEACABHAAAogYAMBARAAD5AgAgEwAAoQMAIN8BAACnAwAw4AEAAB8AEOEBAACnAwAw4gEBAAAAAeUBQADyAgAh-gEAAKgDswIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAAAAAa8CAQDrAgAhsAIBAOsCACGxAgEA6wIAIbMCAQDrAgAhAgAAACEAIBwAAKQEACACAAAAoQQAIBwAAKIEACAO3wEAAKAEADDgAQAAoQQAEOEBAACgBAAw4gEBAOsCACHlAUAA8gIAIfoBAACoA7MCIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhrwIBAOsCACGwAgEA6wIAIbECAQDrAgAhswIBAOsCACEO3wEAAKAEADDgAQAAoQQAEOEBAACgBAAw4gEBAOsCACHlAUAA8gIAIfoBAACoA7MCIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhrwIBAOsCACGwAgEA6wIAIbECAQDrAgAhswIBAOsCACEK4gEBALwDACHlAUAAvQMAIfoBAACjBLMCIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhrwIBALwDACGwAgEAvAMAIbECAQC8AwAhAbwCAAAAswICCxEAAKUEACDiAQEAvAMAIeUBQAC9AwAh-gEAAKMEswIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGvAgEAvAMAIbACAQC8AwAhsQIBALwDACELIwAApgQAMCQAAKoEADC5AgAApwQAMLoCAACoBAAwuwIAAKkEACC8AgAA5wMAML0CAADnAwAwvgIAAOcDADC_AgAA5wMAMMACAACrBAAwwQIAAOoDADAKBwAA_AMAIBUAAP8DACAWAAD9AwAg4gEBAAAAAeMBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGwAgEAAAABtQIBAAAAAQIAAAABACAjAACuBAAgAwAAAAEAICMAAK4EACAkAACtBAAgARwAAKEGADACAAAAAQAgHAAArQQAIAIAAADrAwAgHAAArAQAIAfiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhsAIBALwDACG1AgEAyAMAIQoHAAD5AwAgFQAA7wMAIBYAAPADACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhsAIBALwDACG1AgEAyAMAIQoHAAD8AwAgFQAA_wMAIBYAAP0DACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG1AgEAAAABCxEAALAEACDiAQEAAAAB5QFAAAAAAfoBAAAAswIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAa8CAQAAAAGwAgEAAAABsQIBAAAAAQQjAACmBAAwuQIAAKcEADC7AgAAqQQAIL8CAADnAwAwCAgAAL4EACDiAQEAAAAB5AEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAYoCAgAAAAGSAgEAAAABAgAAABQAICMAAL0EACADAAAAFAAgIwAAvQQAICQAALsEACABHAAAoAYAMA4HAAChAwAgCAAAqwMAIN8BAACtAwAw4AEAABIAEOEBAACtAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhtgIAAKwDACACAAAAFAAgHAAAuwQAIAIAAAC5BAAgHAAAugQAIAvfAQAAuAQAMOABAAC5BAAQ4QEAALgEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhC98BAAC4BAAw4AEAALkEABDhAQAAuAQAMOIBAQDrAgAh4wEBAOsCACHkAQEA6wIAIeUBQADyAgAh_gEgAPACACGAAkAA8gIAIYoCAgDxAgAhkgIBAOsCACEH4gEBALwDACHkAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIYoCAgDNAwAhkgIBALwDACEICAAAvAQAIOIBAQC8AwAh5AEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGKAgIAzQMAIZICAQC8AwAhBSMAAJsGACAkAACeBgAguQIAAJwGACC6AgAAnQYAIL8CAAAFACAICAAAvgQAIOIBAQAAAAHkAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABigICAAAAAZICAQAAAAEDIwAAmwYAILkCAACcBgAgvwIAAAUAIAoIAADcBAAgCgAA3QQAIOIBAQAAAAHkAQEAAAAB5QFAAAAAAfoBAAAArwICgAJAAAAAAasCQAAAAAGsAgIAAAABrQIQAAAAAQIAAAALACAjAADbBAAgAwAAAAsAICMAANsEACAkAADLBAAgARwAAJoGADAPBwAAoQMAIAgAAKsDACAKAAC0AwAg3wEAALIDADDgAQAACQAQ4QEAALIDADDiAQEAAAAB4wEBAOsCACHkAQEA6wIAIeUBQADyAgAh-gEAALMDrwIigAJAAPICACGrAkAA8gIAIawCAgDxAgAhrQIQAK8DACECAAAACwAgHAAAywQAIAIAAADHBAAgHAAAyAQAIAzfAQAAxgQAMOABAADHBAAQ4QEAAMYEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA68CIoACQADyAgAhqwJAAPICACGsAgIA8QIAIa0CEACvAwAhDN8BAADGBAAw4AEAAMcEABDhAQAAxgQAMOIBAQDrAgAh4wEBAOsCACHkAQEA6wIAIeUBQADyAgAh-gEAALMDrwIigAJAAPICACGrAkAA8gIAIawCAgDxAgAhrQIQAK8DACEI4gEBALwDACHkAQEAvAMAIeUBQAC9AwAh-gEAAMoErwIigAJAAL0DACGrAkAAvQMAIawCAgDNAwAhrQIQAMkEACEFvAIQAAAAAcMCEAAAAAHEAhAAAAABxQIQAAAAAcYCEAAAAAEBvAIAAACvAgIKCAAAzAQAIAoAAM0EACDiAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSvAiKAAkAAvQMAIasCQAC9AwAhrAICAM0DACGtAhAAyQQAIQUjAACUBgAgJAAAmAYAILkCAACVBgAgugIAAJcGACC_AgAABQAgCyMAAM4EADAkAADTBAAwuQIAAM8EADC6AgAA0AQAMLsCAADRBAAgvAIAANIEADC9AgAA0gQAML4CAADSBAAwvwIAANIEADDAAgAA1AQAMMECAADVBAAwEOIBAQAAAAHlAUAAAAAB-gEAAACcAgKAAkAAAAABlwIBAAAAAZgCAQAAAAGZAhAAAAABmgIBAAAAAZwCAQAAAAGdAgEAAAABngIBAAAAAZ8CAQAAAAGgAkAAAAABoQIBAAAAAaICQAAAAAGjAkAAAAABAgAAAA8AICMAANoEACADAAAADwAgIwAA2gQAICQAANkEACABHAAAlgYAMBUJAACxAwAg3wEAAK4DADDgAQAADQAQ4QEAAK4DADDiAQEAAAAB5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAAAAAZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhowJAAKADACECAAAADwAgHAAA2QQAIAIAAADWBAAgHAAA1wQAIBTfAQAA1QQAMOABAADWBAAQ4QEAANUEADDiAQEA6wIAIeUBQADyAgAh-gEAALADnAIigAJAAPICACGWAgEA6wIAIZcCAQDrAgAhmAIBAOwCACGZAhAArwMAIZoCAQDrAgAhnAIBAOwCACGdAgEA7AIAIZ4CAQDsAgAhnwIBAOwCACGgAkAAoAMAIaECAQDsAgAhogJAAKADACGjAkAAoAMAIRTfAQAA1QQAMOABAADWBAAQ4QEAANUEADDiAQEA6wIAIeUBQADyAgAh-gEAALADnAIigAJAAPICACGWAgEA6wIAIZcCAQDrAgAhmAIBAOwCACGZAhAArwMAIZoCAQDrAgAhnAIBAOwCACGdAgEA7AIAIZ4CAQDsAgAhnwIBAOwCACGgAkAAoAMAIaECAQDsAgAhogJAAKADACGjAkAAoAMAIRDiAQEAvAMAIeUBQAC9AwAh-gEAANgEnAIigAJAAL0DACGXAgEAvAMAIZgCAQDIAwAhmQIQAMkEACGaAgEAvAMAIZwCAQDIAwAhnQIBAMgDACGeAgEAyAMAIZ8CAQDIAwAhoAJAAOADACGhAgEAyAMAIaICQADgAwAhowJAAOADACEBvAIAAACcAgIQ4gEBALwDACHlAUAAvQMAIfoBAADYBJwCIoACQAC9AwAhlwIBALwDACGYAgEAyAMAIZkCEADJBAAhmgIBALwDACGcAgEAyAMAIZ0CAQDIAwAhngIBAMgDACGfAgEAyAMAIaACQADgAwAhoQIBAMgDACGiAkAA4AMAIaMCQADgAwAhEOIBAQAAAAHlAUAAAAAB-gEAAACcAgKAAkAAAAABlwIBAAAAAZgCAQAAAAGZAhAAAAABmgIBAAAAAZwCAQAAAAGdAgEAAAABngIBAAAAAZ8CAQAAAAGgAkAAAAABoQIBAAAAAaICQAAAAAGjAkAAAAABCggAANwEACAKAADdBAAg4gEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACvAgKAAkAAAAABqwJAAAAAAawCAgAAAAGtAhAAAAABAyMAAJQGACC5AgAAlQYAIL8CAAAFACAEIwAAzgQAMLkCAADPBAAwuwIAANEEACC_AgAA0gQAMBIFAACRBQAgCwAAkgUAIAwAAJMFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAQIAAAAFACAjAACPBQAgAwAAAAUAICMAAI8FACAkAADrBAAgARwAAJMGADAXBQAAuAMAIAYAAKEDACALAAD0AgAgDAAA9QIAIA0AAPcCACDfAQAAtQMAMOABAAADABDhAQAAtQMAMOIBAQAAAAHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQAAAAGGAgEA6wIAIYcCAQDrAgAhiAIQAK8DACGJAgIA8QIAIYoCCAC2AwAhiwIAAP4CACCNAgEA6wIAIY4CAQDrAgAhAgAAAAUAIBwAAOsEACACAAAA5gQAIBwAAOcEACAS3wEAAOUEADDgAQAA5gQAEOEBAADlBAAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIRLfAQAA5QQAMOABAADmBAAQ4QEAAOUEADDiAQEA6wIAIeUBQADyAgAh-gEAALcDjQIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAOsCACGGAgEA6wIAIYcCAQDrAgAhiAIQAK8DACGJAgIA8QIAIYoCCAC2AwAhiwIAAP4CACCNAgEA6wIAIY4CAQDrAgAhDuIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhBbwCCAAAAAHDAggAAAABxAIIAAAAAcUCCAAAAAHGAggAAAABArwCAQAAAATCAgEAAAAFAbwCAAAAjQICEgUAAOwEACALAADtBAAgDAAA7gQAIA0AAO8EACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIQUjAACBBgAgJAAAkQYAILkCAACCBgAgugIAAJAGACC_AgAAfwAgCyMAAIQFADAkAACIBQAwuQIAAIUFADC6AgAAhgUAMLsCAACHBQAgvAIAAMMEADC9AgAAwwQAML4CAADDBAAwvwIAAMMEADDAAgAAiQUAMMECAADGBAAwCyMAAPkEADAkAAD9BAAwuQIAAPoEADC6AgAA-wQAMLsCAAD8BAAgvAIAALUEADC9AgAAtQQAML4CAAC1BAAwvwIAALUEADDAAgAA_gQAMMECAAC4BAAwCyMAAPAEADAkAAD0BAAwuQIAAPEEADC6AgAA8gQAMLsCAADzBAAgvAIAAJEEADC9AgAAkQQAML4CAACRBAAwvwIAAJEEADDAAgAA9QQAMMECAACUBAAwBAcAAMADACDiAQEAAAAB4wEBAAAAAeUBQAAAAAECAAAAGAAgIwAA-AQAIAMAAAAYACAjAAD4BAAgJAAA9wQAIAEcAACPBgAwAgAAABgAIBwAAPcEACACAAAAlQQAIBwAAPYEACAD4gEBALwDACHjAQEAvAMAIeUBQAC9AwAhBAcAAL4DACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACEEBwAAwAMAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAQgHAACDBQAg4gEBAAAAAeMBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQIAAAAUACAjAACCBQAgAwAAABQAICMAAIIFACAkAACABQAgARwAAI4GADACAAAAFAAgHAAAgAUAIAIAAAC5BAAgHAAA_wQAIAfiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhigICAM0DACGSAgEAvAMAIQgHAACBBQAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIYoCAgDNAwAhkgIBALwDACEFIwAAiQYAICQAAIwGACC5AgAAigYAILoCAACLBgAgvwIAAJ8CACAIBwAAgwUAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABigICAAAAAZICAQAAAAEDIwAAiQYAILkCAACKBgAgvwIAAJ8CACAKBwAAjgUAIAoAAN0EACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH6AQAAAK8CAoACQAAAAAGrAkAAAAABrAICAAAAAa0CEAAAAAECAAAACwAgIwAAjQUAIAMAAAALACAjAACNBQAgJAAAiwUAIAEcAACIBgAwAgAAAAsAIBwAAIsFACACAAAAxwQAIBwAAIoFACAI4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh-gEAAMoErwIigAJAAL0DACGrAkAAvQMAIawCAgDNAwAhrQIQAMkEACEKBwAAjAUAIAoAAM0EACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH6AQAAygSvAiKAAkAAvQMAIasCQAC9AwAhrAICAM0DACGtAhAAyQQAIQUjAACDBgAgJAAAhgYAILkCAACEBgAgugIAAIUGACC_AgAAnwIAIAoHAACOBQAgCgAA3QQAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAfoBAAAArwICgAJAAAAAAasCQAAAAAGsAgIAAAABrQIQAAAAAQMjAACDBgAguQIAAIQGACC_AgAAnwIAIBIFAACRBQAgCwAAkgUAIAwAAJMFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAQG8AgEAAAAEAyMAAIEGACC5AgAAggYAIL8CAAB_ACAEIwAAhAUAMLkCAACFBQAwuwIAAIcFACC_AgAAwwQAMAQjAAD5BAAwuQIAAPoEADC7AgAA_AQAIL8CAAC1BAAwBCMAAPAEADC5AgAA8QQAMLsCAADzBAAgvwIAAJEEADAEIwAA3gQAMLkCAADfBAAwuwIAAOEEACC_AgAA4gQAMAQjAAC_BAAwuQIAAMAEADC7AgAAwgQAIL8CAADDBAAwBCMAALEEADC5AgAAsgQAMLsCAAC0BAAgvwIAALUEADAEIwAAmQQAMLkCAACaBAAwuwIAAJwEACC_AgAAnQQAMAQjAACNBAAwuQIAAI4EADC7AgAAkAQAIL8CAACRBAAwBCMAAIAEADC5AgAAgQQAMLsCAACDBAAgvwIAAIQEADAEIwAA4wMAMLkCAADkAwAwuwIAAOYDACC_AgAA5wMAMAQjAADWAwAwuQIAANcDADC7AgAA2QMAIL8CAADaAwAwAAAAAAAAAAAAAAAAAAUjAAD8BQAgJAAA_wUAILkCAAD9BQAgugIAAP4FACC_AgAAnwIAIAMjAAD8BQAguQIAAP0FACC_AgAAnwIAIAAAAAAAAAAABSMAAPcFACAkAAD6BQAguQIAAPgFACC6AgAA-QUAIL8CAACfAgAgAyMAAPcFACC5AgAA-AUAIL8CAACfAgAgAAAAAAAFIwAA8gUAICQAAPUFACC5AgAA8wUAILoCAAD0BQAgvwIAAAsAIAMjAADyBQAguQIAAPMFACC_AgAACwAgAAAABSMAAO0FACAkAADwBQAguQIAAO4FACC6AgAA7wUAIL8CAACfAgAgAyMAAO0FACC5AgAA7gUAIL8CAACfAgAgAAAAAAAACyMAAMkFADAkAADNBQAwuQIAAMoFADC6AgAAywUAMLsCAADMBQAgvAIAAOIEADC9AgAA4gQAML4CAADiBAAwvwIAAOIEADDAAgAAzgUAMMECAADlBAAwEgYAAKsFACALAACSBQAgDAAAkwUAIA0AAJQFACDiAQEAAAAB5QFAAAAAAfoBAAAAjQIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIQAAAAAYkCAgAAAAGKAggAAAABiwIAAJAFACCOAgEAAAABAgAAAAUAICMAANEFACADAAAABQAgIwAA0QUAICQAANAFACABHAAA7AUAMAIAAAAFACAcAADQBQAgAgAAAOYEACAcAADPBQAgDuIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII4CAQC8AwAhEgYAAKoFACALAADtBAAgDAAA7gQAIA0AAO8EACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCOAgEAvAMAIRIGAACrBQAgCwAAkgUAIAwAAJMFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjgIBAAAAAQQjAADJBQAwuQIAAMoFADC7AgAAzAUAIL8CAADiBAAwAAAAAAAAAAAFIwAA5wUAICQAAOoFACC5AgAA6AUAILoCAADpBQAgvwIAAJ8CACADIwAA5wUAILkCAADoBQAgvwIAAJ8CACAAAAAMAwAAnQUAIAsAAJ4FACAMAACfBQAgDgAAoAUAIA8AAKEFACAQAACiBQAgEQAAowUAIBIAAKQFACDzAQAAwgMAIPQBAADCAwAg9QEAAMIDACD2AQAAwgMAIAIRAACjBQAgEwAA4AUAIAUHAADgBQAgFAAA4QUAIBUAAOIFACAWAACjBQAgtQIAAMIDACAFBQAA5gUAIAYAAOAFACALAACeBQAgDAAAnwUAIA0AAKEFACADBwAA4AUAIAgAAOMFACAKAADlBQAgAAEDAACdBQAgFgMAAJUFACALAACWBQAgDAAAlwUAIA8AAJkFACAQAACaBQAgEQAAmwUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAOcFACADAAAAogIAICMAAOcFACAkAADrBQAgGAAAAKICACADAADOAwAgCwAAzwMAIAwAANADACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAgHAAA6wUAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIRYDAADOAwAgCwAAzwMAIAwAANADACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhDuIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII4CAQAAAAEWAwAAlQUAIAsAAJYFACAMAACXBQAgDgAAmAUAIA8AAJkFACARAACbBQAgEgAAnAUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQIAAACfAgAgIwAA7QUAIAMAAACiAgAgIwAA7QUAICQAAPEFACAYAAAAogIAIAMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEQAA1AMAIBIAANUDACAcAADxBQAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACELBwAAjgUAIAgAANwEACDiAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACvAgKAAkAAAAABqwJAAAAAAawCAgAAAAGtAhAAAAABAgAAAAsAICMAAPIFACADAAAACQAgIwAA8gUAICQAAPYFACANAAAACQAgBwAAjAUAIAgAAMwEACAcAAD2BQAg4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSvAiKAAkAAvQMAIasCQAC9AwAhrAICAM0DACGtAhAAyQQAIQsHAACMBQAgCAAAzAQAIOIBAQC8AwAh4wEBALwDACHkAQEAvAMAIeUBQAC9AwAh-gEAAMoErwIigAJAAL0DACGrAkAAvQMAIawCAgDNAwAhrQIQAMkEACEWAwAAlQUAIAsAAJYFACAMAACXBQAgDgAAmAUAIA8AAJkFACAQAACaBQAgEQAAmwUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQIAAACfAgAgIwAA9wUAIAMAAACiAgAgIwAA9wUAICQAAPsFACAYAAAAogIAIAMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACAcAAD7BQAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEWCwAAlgUAIAwAAJcFACAOAACYBQAgDwAAmQUAIBAAAJoFACARAACbBQAgEgAAnAUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQIAAACfAgAgIwAA_AUAIAMAAACiAgAgIwAA_AUAICQAAIAGACAYAAAAogIAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACAcAACABgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEF4gEBAAAAAeUBQAAAAAHxAQEAAAABgAJAAAAAAYUCAQAAAAECAAAAfwAgIwAAgQYAIBYDAACVBQAgDAAAlwUAIA4AAJgFACAPAACZBQAgEAAAmgUAIBEAAJsFACASAACcBQAg4gEBAAAAAeUBQAAAAAHxAQEAAAAB8gEBAAAAAfMBAQAAAAH0AQEAAAAB9QEBAAAAAfYBAQAAAAH4AQAAAPgBAvoBAAAA-gEC_AEAAAD8AQL9ASAAAAAB_gEgAAAAAf8BAgAAAAGAAkAAAAABAgAAAJ8CACAjAACDBgAgAwAAAKICACAjAACDBgAgJAAAhwYAIBgAAACiAgAgAwAAzgMAIAwAANADACAOAADRAwAgDwAA0gMAIBAAANMDACARAADUAwAgEgAA1QMAIBwAAIcGACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEWAwAAzgMAIAwAANADACAOAADRAwAgDwAA0gMAIBAAANMDACARAADUAwAgEgAA1QMAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIQjiAQEAAAAB4wEBAAAAAeUBQAAAAAH6AQAAAK8CAoACQAAAAAGrAkAAAAABrAICAAAAAa0CEAAAAAEWAwAAlQUAIAsAAJYFACAOAACYBQAgDwAAmQUAIBAAAJoFACARAACbBQAgEgAAnAUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQIAAACfAgAgIwAAiQYAIAMAAACiAgAgIwAAiQYAICQAAI0GACAYAAAAogIAIAMAAM4DACALAADPAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACAcAACNBgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACALAADPAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEH4gEBAAAAAeMBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQPiAQEAAAAB4wEBAAAAAeUBQAAAAAEDAAAAggEAICMAAIEGACAkAACSBgAgBwAAAIIBACAcAACSBgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAhgAJAAL0DACGFAgEAvAMAIQXiAQEAvAMAIeUBQAC9AwAh8QEBALwDACGAAkAAvQMAIYUCAQC8AwAhDuIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII0CAQAAAAETBQAAkQUAIAYAAKsFACAMAACTBQAgDQAAlAUAIOIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII0CAQAAAAGOAgEAAAABAgAAAAUAICMAAJQGACAQ4gEBAAAAAeUBQAAAAAH6AQAAAJwCAoACQAAAAAGXAgEAAAABmAIBAAAAAZkCEAAAAAGaAgEAAAABnAIBAAAAAZ0CAQAAAAGeAgEAAAABnwIBAAAAAaACQAAAAAGhAgEAAAABogJAAAAAAaMCQAAAAAEDAAAAAwAgIwAAlAYAICQAAJkGACAVAAAAAwAgBQAA7AQAIAYAAKoFACAMAADuBAAgDQAA7wQAIBwAAJkGACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIY4CAQC8AwAhEwUAAOwEACAGAACqBQAgDAAA7gQAIA0AAO8EACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIY4CAQC8AwAhCOIBAQAAAAHkAQEAAAAB5QFAAAAAAfoBAAAArwICgAJAAAAAAasCQAAAAAGsAgIAAAABrQIQAAAAARMFAACRBQAgBgAAqwUAIAsAAJIFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAECAAAABQAgIwAAmwYAIAMAAAADACAjAACbBgAgJAAAnwYAIBUAAAADACAFAADsBAAgBgAAqgUAIAsAAO0EACANAADvBAAgHAAAnwYAIOIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhjgIBALwDACETBQAA7AQAIAYAAKoFACALAADtBAAgDQAA7wQAIOIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhjgIBALwDACEH4gEBAAAAAeQBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQfiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG1AgEAAAABCuIBAQAAAAHlAUAAAAAB-gEAAACzAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABrwIBAAAAAbACAQAAAAGxAgEAAAABA-IBAQAAAAHkAQEAAAAB5QFAAAAAAQfiAQEAAAAB5QFAAAAAAYQCAQAAAAGlAgAAAKUCAqYCAQAAAAGnAgEAAAABqAIgAAAAAQsHAAD8AwAgFAAA-wMAIBUAAP8DACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG0AgEAAAABtQIBAAAAAQIAAAABACAjAAClBgAgFgMAAJUFACALAACWBQAgDAAAlwUAIA4AAJgFACAPAACZBQAgEAAAmgUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAKcGACAMEwAA3AUAIOIBAQAAAAHlAUAAAAAB-gEAAACzAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABrwIBAAAAAbACAQAAAAGxAgEAAAABswIBAAAAAQIAAAAhACAjAACpBgAgAwAAAKICACAjAACnBgAgJAAArQYAIBgAAACiAgAgAwAAzgMAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEgAA1QMAIBwAAK0GACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEWAwAAzgMAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEgAA1QMAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIQfiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG0AgEAAAABAwAAACgAICMAAKUGACAkAACxBgAgDQAAACgAIAcAAPkDACAUAADuAwAgFQAA7wMAIBwAALEGACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhsAIBALwDACG0AgEAvAMAIbUCAQDIAwAhCwcAAPkDACAUAADuAwAgFQAA7wMAIOIBAQC8AwAh4wEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGwAgEAvAMAIbQCAQC8AwAhtQIBAMgDACEDAAAAHwAgIwAAqQYAICQAALQGACAOAAAAHwAgEwAA2wUAIBwAALQGACDiAQEAvAMAIeUBQAC9AwAh-gEAAKMEswIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGvAgEAvAMAIbACAQC8AwAhsQIBALwDACGzAgEAvAMAIQwTAADbBQAg4gEBALwDACHlAUAAvQMAIfoBAACjBLMCIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhrwIBALwDACGwAgEAvAMAIbECAQC8AwAhswIBALwDACEH4gEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAbACAQAAAAG0AgEAAAABtQIBAAAAAQXiAQEAAAAB5QFAAAAAAZMCAQAAAAGUAkAAAAABlQJAAAAAARMFAACRBQAgBgAAqwUAIAsAAJIFACAMAACTBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAECAAAABQAgIwAAtwYAIBYDAACVBQAgCwAAlgUAIAwAAJcFACAOAACYBQAgEAAAmgUAIBEAAJsFACASAACcBQAg4gEBAAAAAeUBQAAAAAHxAQEAAAAB8gEBAAAAAfMBAQAAAAH0AQEAAAAB9QEBAAAAAfYBAQAAAAH4AQAAAPgBAvoBAAAA-gEC_AEAAAD8AQL9ASAAAAAB_gEgAAAAAf8BAgAAAAGAAkAAAAABAgAAAJ8CACAjAAC5BgAgAwAAAAMAICMAALcGACAkAAC9BgAgFQAAAAMAIAUAAOwEACAGAACqBQAgCwAA7QQAIAwAAO4EACAcAAC9BgAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIRMFAADsBAAgBgAAqgUAIAsAAO0EACAMAADuBAAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIQMAAACiAgAgIwAAuQYAICQAAMAGACAYAAAAogIAIAMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAQAADTAwAgEQAA1AMAIBIAANUDACAcAADABgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEFBAARBwADFAACFTkBFjoBAwQAEBE3ARMAAwkDBgQEAA8LHQcMHgoOIgIPIwsQJw0RKgESLg4GBAAMBQAFBgADCwwHDBUKDRkLAgMHBAQABgEDCAAEBAAJBwADCAAEChAIAQkABwEKEQACBwADCAAEAgcAAwgABAMLGgAMGwANHAABBwADAQcAAwgDLwALMAAMMQAOMgAPMwAQNAARNQASNgABETgAARY7AAADBwADFAACFUUBAwcAAxQAAhVLAQMEABYpABcqABgAAAADBAAWKQAXKgAYARMAAwETAAMDBAAdKQAeKgAfAAAAAwQAHSkAHioAHwIHAAMIAAQCBwADCAAEBQQAJCkAJyoAKEsAJUwAJgAAAAAABQQAJCkAJyoAKEsAJUwAJgAAAwQALSkALioALwAAAAMEAC0pAC4qAC8AAAADBAA1KQA2KgA3AAAAAwQANSkANioANwEHAAMBBwADAwQAPCkAPSoAPgAAAAMEADwpAD0qAD4BCQAHAQkABwUEAEMpAEYqAEdLAERMAEUAAAAAAAUEAEMpAEYqAEdLAERMAEUBBwADAQcAAwMEAEwpAE0qAE4AAAADBABMKQBNKgBOAgcAAwgABAIHAAMIAAQFBABTKQBWKgBXSwBUTABVAAAAAAAFBABTKQBWKgBXSwBUTABVAgUABQYAAwIFAAUGAAMFBABcKQBfKgBgSwBdTABeAAAAAAAFBABcKQBfKgBgSwBdTABeAAAFBABlKQBoKgBpSwBmTABnAAAAAAAFBABlKQBoKgBpSwBmTABnAgcAAwgABAIHAAMIAAQDBABuKQBvKgBwAAAAAwQAbikAbyoAcBcCARg8ARk9ARo-ARs_AR1BAR5DEh9EEyBHASFJEiJKFCVMASZNASdOEitRFSxSGS1TAi5UAi9VAjBWAjFXAjJZAjNbEjRcGjVeAjZgEjdhGzhiAjljAjpkEjtnHDxoID1pBz5qBz9rB0BsB0FtB0JvB0NxEkRyIUV0B0Z2Ekd3Ikh4B0l5B0p6Ek19I05-KU-AAQVQgQEFUYQBBVKFAQVThgEFVIgBBVWKARJWiwEqV40BBViPARJZkAErWpEBBVuSAQVckwESXZYBLF6XATBfmQExYJoBMWGdATFingExY58BMWShATFlowESZqQBMmemATFoqAESaakBM2qqATFrqwExbKwBEm2vATRusAE4b7EBDXCyAQ1xswENcrQBDXO1AQ10twENdbkBEna6ATl3vAENeL4BEnm_ATp6wAENe8EBDXzCARJ9xQE7fsYBP3_HAQiAAcgBCIEByQEIggHKAQiDAcsBCIQBzQEIhQHPARKGAdABQIcB0gEIiAHUARKJAdUBQYoB1gEIiwHXAQiMAdgBEo0B2wFCjgHcAUiPAd0BDpAB3gEOkQHfAQ6SAeABDpMB4QEOlAHjAQ6VAeUBEpYB5gFJlwHoAQ6YAeoBEpkB6wFKmgHsAQ6bAe0BDpwB7gESnQHxAUueAfIBT58B8wEKoAH0AQqhAfUBCqIB9gEKowH3AQqkAfkBCqUB-wESpgH8AVCnAf4BCqgBgAISqQGBAlGqAYICCqsBgwIKrAGEAhKtAYcCUq4BiAJYrwGJAgSwAYoCBLEBiwIEsgGMAgSzAY0CBLQBjwIEtQGRAhK2AZICWbcBlAIEuAGWAhK5AZcCWroBmAIEuwGZAgS8AZoCEr0BnQJbvgGeAmG_AaACA8ABoQIDwQGkAgPCAaUCA8MBpgIDxAGoAgPFAaoCEsYBqwJixwGtAgPIAa8CEskBsAJjygGxAgPLAbICA8wBswISzQG2AmTOAbcCas8BuAIL0AG5AgvRAboCC9IBuwIL0wG8AgvUAb4CC9UBwAIS1gHBAmvXAcMCC9gBxQIS2QHGAmzaAccCC9sByAIL3AHJAhLdAcwCbd4BzQJx"
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
      frontendUrl: config_default.is_production ? config_default.frontend_url_prod : config_default.frontend_url_dev
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
        // `id` lets the client show ownership controls (edit/delete) on the
        // author's own reviews without guessing from the display name.
        user: { select: { id: true, name: true, avatarUrl: true } }
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
    const redirectBase = config_default.is_production && config_default.frontend_url_prod ? config_default.frontend_url_prod : config_default.frontend_url_dev;
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
var authCredentialLimiter = rateLimit({
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
var authOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  limit: 10,
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
app.use("/api/auth/login", authCredentialLimiter);
app.use("/api/auth/register", authCredentialLimiter);
app.use("/api/auth/reset-password", authCredentialLimiter);
app.use("/api/auth/verify-email", authOtpLimiter);
app.use("/api/auth/resend-verification", authOtpLimiter);
app.use("/api/auth/forgot-password", authOtpLimiter);
app.use("/api/auth/demo-login", authOtpLimiter);
app.use("/api/auth/google", authOtpLimiter);
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
