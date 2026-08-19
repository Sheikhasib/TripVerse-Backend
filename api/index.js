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
  "inlineSchema": 'model BlogComment {\n  id        String  @id @default(uuid())\n  content   String  @db.Text\n  isDeleted Boolean @default(false)\n\n  postId   String\n  userId   String\n  parentId String?\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  post    BlogPost      @relation("PostComments", fields: [postId], references: [id])\n  user    User          @relation("UserComments", fields: [userId], references: [id])\n  parent  BlogComment?  @relation("CommentReplies", fields: [parentId], references: [id])\n  replies BlogComment[] @relation("CommentReplies")\n\n  @@index([postId, isDeleted, createdAt])\n  @@index([parentId])\n  @@map("blog_comments")\n}\n\nmodel BlogPost {\n  id         String     @id @default(uuid())\n  title      String\n  slug       String     @unique\n  excerpt    String\n  content    String\n  coverImage String\n  status     PostStatus @default(DRAFT)\n  isDeleted  Boolean    @default(false)\n\n  authorId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  author   User          @relation("AuthorPosts", fields: [authorId], references: [id])\n  comments BlogComment[] @relation("PostComments")\n\n  @@index([status])\n  @@index([authorId])\n  @@map("blog_posts")\n}\n\nmodel Booking {\n  id         String        @id @default(uuid())\n  travelDate DateTime\n  travelers  Int\n  totalPrice Decimal       @db.Decimal(10, 2)\n  status     BookingStatus @default(PENDING)\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user     User        @relation("CustomerBookings", fields: [userId], references: [id])\n  package  TourPackage @relation(fields: [packageId], references: [id])\n  payments Payment[]\n\n  @@index([userId])\n  @@index([packageId])\n  @@index([status])\n  @@index([userId, packageId, travelDate])\n  @@map("bookings")\n}\n\nmodel Category {\n  id   String @id @default(uuid())\n  name String @unique\n  slug String @unique\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages TourPackage[]\n\n  @@map("categories")\n}\n\nmodel ContactMessage {\n  id         String  @id @default(uuid())\n  name       String\n  email      String\n  subject    String\n  message    String\n  isResolved Boolean @default(false)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@index([isResolved])\n  @@map("contact_messages")\n}\n\nenum Role {\n  USER\n  AGENT\n  ADMIN\n}\n\nenum UserStatus {\n  ACTIVE\n  SUSPENDED\n}\n\nenum AuthProvider {\n  CREDENTIAL\n  GOOGLE\n}\n\nenum PackageStatus {\n  PENDING\n  APPROVED\n  REJECTED\n}\n\nenum BookingStatus {\n  PENDING\n  PAID\n  CONFIRMED\n  CANCELLED\n  COMPLETED\n}\n\nenum PaymentStatus {\n  INITIATED\n  SUCCESS\n  FAILED\n  CANCELLED\n  REFUNDED\n}\n\nenum PostStatus {\n  DRAFT\n  PUBLISHED\n}\n\nenum NotificationType {\n  BOOKING_CREATED\n  BOOKING_CONFIRMED\n  BOOKING_CANCELLED\n  PACKAGE_APPROVED\n  PACKAGE_REJECTED\n}\n\nmodel Notification {\n  id      String           @id @default(uuid())\n  userId  String\n  type    NotificationType\n  title   String\n  message String\n  link    String?\n  isRead  Boolean          @default(false)\n\n  createdAt DateTime @default(now())\n\n  user User @relation(fields: [userId], references: [id])\n\n  @@index([userId, isRead, createdAt])\n  @@map("notifications")\n}\n\nmodel Payment {\n  id             String        @id @default(uuid())\n  bookingId      String\n  tranId         String        @unique // SSLCommerz transaction id, generated server-side\n  valId          String? // set after gateway success, used for server-side validation\n  amount         Decimal       @db.Decimal(10, 2) // = booking.totalPrice at session creation\n  currency       String        @default("BDT")\n  status         PaymentStatus @default(INITIATED)\n  gatewayPageUrl String?\n  sslSessionKey  String?\n  cardType       String?\n  bankTranId     String?\n  paidAt         DateTime?\n  refundRefId    String? // SSLCommerz refund reference (set when a refund is initiated)\n  refundedAt     DateTime? // when the refund was initiated/settled\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  booking Booking @relation(fields: [bookingId], references: [id])\n\n  @@index([bookingId])\n  @@index([status])\n  @@map("payments")\n}\n\nmodel RefreshToken {\n  id        String    @id @default(uuid())\n  userId    String\n  hash      String    @unique // SHA-256 of the refresh JWT \u2014 never store the JWT itself\n  expiresAt DateTime\n  createdAt DateTime  @default(now())\n  revokedAt DateTime? // set when rotated or logged out\n\n  user User @relation(fields: [userId], references: [id])\n\n  @@index([userId, revokedAt])\n  @@map("refresh_tokens")\n}\n\nmodel Review {\n  id        String  @id @default(uuid())\n  rating    Int\n  comment   String\n  isDeleted Boolean @default(false)\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user    User        @relation("CustomerReviews", fields: [userId], references: [id])\n  package TourPackage @relation(fields: [packageId], references: [id])\n\n  @@unique([userId, packageId])\n  @@index([packageId])\n  @@map("reviews")\n}\n\n// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../../generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\nmodel TourPackage {\n  id          String        @id @default(uuid())\n  title       String\n  slug        String        @unique\n  description String\n  location    String\n  price       Decimal       @db.Decimal(10, 2)\n  duration    Int\n  rating      Float         @default(0)\n  images      String[]\n  status      PackageStatus @default(PENDING)\n  isDeleted   Boolean       @default(false)\n\n  categoryId String\n  agentId    String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  category      Category       @relation(fields: [categoryId], references: [id])\n  agent         User           @relation("AgentPackages", fields: [agentId], references: [id])\n  bookings      Booking[]\n  reviews       Review[]\n  wishlistItems WishlistItem[]\n\n  @@index([categoryId])\n  @@index([categoryId, price])\n  @@index([price])\n  @@index([status])\n  @@map("tour_packages")\n}\n\nmodel User {\n  id            String       @id @default(uuid())\n  name          String\n  email         String       @unique\n  password      String?\n  googleId      String?      @unique\n  phone         String?\n  avatarUrl     String?\n  role          Role         @default(USER)\n  status        UserStatus   @default(ACTIVE)\n  authProvider  AuthProvider @default(CREDENTIAL)\n  emailVerified Boolean      @default(false)\n  isDeleted     Boolean      @default(false)\n  tokenVersion  Int          @default(0)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages      TourPackage[]  @relation("AgentPackages")\n  bookings      Booking[]      @relation("CustomerBookings")\n  reviews       Review[]       @relation("CustomerReviews")\n  posts         BlogPost[]     @relation("AuthorPosts")\n  wishlist      WishlistItem[]\n  notifications Notification[]\n  comments      BlogComment[]  @relation("UserComments")\n  refreshTokens RefreshToken[]\n\n  @@index([role])\n  @@index([status])\n  @@map("users")\n}\n\nmodel WishlistItem {\n  id        String @id @default(uuid())\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n\n  user    User        @relation(fields: [userId], references: [id])\n  package TourPackage @relation(fields: [packageId], references: [id])\n\n  @@unique([userId, packageId])\n  @@index([userId, createdAt])\n  @@map("wishlist_items")\n}\n',
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
config2.runtimeDataModel = JSON.parse('{"models":{"BlogComment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"postId","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"parentId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"post","kind":"object","type":"BlogPost","relationName":"PostComments"},{"name":"user","kind":"object","type":"User","relationName":"UserComments"},{"name":"parent","kind":"object","type":"BlogComment","relationName":"CommentReplies"},{"name":"replies","kind":"object","type":"BlogComment","relationName":"CommentReplies"}],"dbName":"blog_comments"},"BlogPost":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"excerpt","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"coverImage","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PostStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"authorId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"author","kind":"object","type":"User","relationName":"AuthorPosts"},{"name":"comments","kind":"object","type":"BlogComment","relationName":"PostComments"}],"dbName":"blog_posts"},"Booking":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"travelDate","kind":"scalar","type":"DateTime"},{"name":"travelers","kind":"scalar","type":"Int"},{"name":"totalPrice","kind":"scalar","type":"Decimal"},{"name":"status","kind":"enum","type":"BookingStatus"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerBookings"},{"name":"package","kind":"object","type":"TourPackage","relationName":"BookingToTourPackage"},{"name":"payments","kind":"object","type":"Payment","relationName":"BookingToPayment"}],"dbName":"bookings"},"Category":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"CategoryToTourPackage"}],"dbName":"categories"},"ContactMessage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"isResolved","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"contact_messages"},"Notification":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"type","kind":"enum","type":"NotificationType"},{"name":"title","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"link","kind":"scalar","type":"String"},{"name":"isRead","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"NotificationToUser"}],"dbName":"notifications"},"Payment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"bookingId","kind":"scalar","type":"String"},{"name":"tranId","kind":"scalar","type":"String"},{"name":"valId","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Decimal"},{"name":"currency","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PaymentStatus"},{"name":"gatewayPageUrl","kind":"scalar","type":"String"},{"name":"sslSessionKey","kind":"scalar","type":"String"},{"name":"cardType","kind":"scalar","type":"String"},{"name":"bankTranId","kind":"scalar","type":"String"},{"name":"paidAt","kind":"scalar","type":"DateTime"},{"name":"refundRefId","kind":"scalar","type":"String"},{"name":"refundedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"booking","kind":"object","type":"Booking","relationName":"BookingToPayment"}],"dbName":"payments"},"RefreshToken":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"hash","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"revokedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"RefreshTokenToUser"}],"dbName":"refresh_tokens"},"Review":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"rating","kind":"scalar","type":"Int"},{"name":"comment","kind":"scalar","type":"String"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerReviews"},{"name":"package","kind":"object","type":"TourPackage","relationName":"ReviewToTourPackage"}],"dbName":"reviews"},"TourPackage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"location","kind":"scalar","type":"String"},{"name":"price","kind":"scalar","type":"Decimal"},{"name":"duration","kind":"scalar","type":"Int"},{"name":"rating","kind":"scalar","type":"Float"},{"name":"images","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PackageStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"categoryId","kind":"scalar","type":"String"},{"name":"agentId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"category","kind":"object","type":"Category","relationName":"CategoryToTourPackage"},{"name":"agent","kind":"object","type":"User","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"BookingToTourPackage"},{"name":"reviews","kind":"object","type":"Review","relationName":"ReviewToTourPackage"},{"name":"wishlistItems","kind":"object","type":"WishlistItem","relationName":"TourPackageToWishlistItem"}],"dbName":"tour_packages"},"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"googleId","kind":"scalar","type":"String"},{"name":"phone","kind":"scalar","type":"String"},{"name":"avatarUrl","kind":"scalar","type":"String"},{"name":"role","kind":"enum","type":"Role"},{"name":"status","kind":"enum","type":"UserStatus"},{"name":"authProvider","kind":"enum","type":"AuthProvider"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"tokenVersion","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"CustomerBookings"},{"name":"reviews","kind":"object","type":"Review","relationName":"CustomerReviews"},{"name":"posts","kind":"object","type":"BlogPost","relationName":"AuthorPosts"},{"name":"wishlist","kind":"object","type":"WishlistItem","relationName":"UserToWishlistItem"},{"name":"notifications","kind":"object","type":"Notification","relationName":"NotificationToUser"},{"name":"comments","kind":"object","type":"BlogComment","relationName":"UserComments"},{"name":"refreshTokens","kind":"object","type":"RefreshToken","relationName":"RefreshTokenToUser"}],"dbName":"users"},"WishlistItem":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"UserToWishlistItem"},{"name":"package","kind":"object","type":"TourPackage","relationName":"TourPackageToWishlistItem"}],"dbName":"wishlist_items"}},"enums":{},"types":{}}');
config2.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","packages","_count","category","agent","user","package","booking","payments","bookings","reviews","wishlistItems","posts","wishlist","notifications","comments","refreshTokens","author","post","parent","replies","BlogComment.findUnique","BlogComment.findUniqueOrThrow","BlogComment.findFirst","BlogComment.findFirstOrThrow","BlogComment.findMany","data","BlogComment.createOne","BlogComment.createMany","BlogComment.createManyAndReturn","BlogComment.updateOne","BlogComment.updateMany","BlogComment.updateManyAndReturn","create","update","BlogComment.upsertOne","BlogComment.deleteOne","BlogComment.deleteMany","having","_min","_max","BlogComment.groupBy","BlogComment.aggregate","BlogPost.findUnique","BlogPost.findUniqueOrThrow","BlogPost.findFirst","BlogPost.findFirstOrThrow","BlogPost.findMany","BlogPost.createOne","BlogPost.createMany","BlogPost.createManyAndReturn","BlogPost.updateOne","BlogPost.updateMany","BlogPost.updateManyAndReturn","BlogPost.upsertOne","BlogPost.deleteOne","BlogPost.deleteMany","BlogPost.groupBy","BlogPost.aggregate","Booking.findUnique","Booking.findUniqueOrThrow","Booking.findFirst","Booking.findFirstOrThrow","Booking.findMany","Booking.createOne","Booking.createMany","Booking.createManyAndReturn","Booking.updateOne","Booking.updateMany","Booking.updateManyAndReturn","Booking.upsertOne","Booking.deleteOne","Booking.deleteMany","_avg","_sum","Booking.groupBy","Booking.aggregate","Category.findUnique","Category.findUniqueOrThrow","Category.findFirst","Category.findFirstOrThrow","Category.findMany","Category.createOne","Category.createMany","Category.createManyAndReturn","Category.updateOne","Category.updateMany","Category.updateManyAndReturn","Category.upsertOne","Category.deleteOne","Category.deleteMany","Category.groupBy","Category.aggregate","ContactMessage.findUnique","ContactMessage.findUniqueOrThrow","ContactMessage.findFirst","ContactMessage.findFirstOrThrow","ContactMessage.findMany","ContactMessage.createOne","ContactMessage.createMany","ContactMessage.createManyAndReturn","ContactMessage.updateOne","ContactMessage.updateMany","ContactMessage.updateManyAndReturn","ContactMessage.upsertOne","ContactMessage.deleteOne","ContactMessage.deleteMany","ContactMessage.groupBy","ContactMessage.aggregate","Notification.findUnique","Notification.findUniqueOrThrow","Notification.findFirst","Notification.findFirstOrThrow","Notification.findMany","Notification.createOne","Notification.createMany","Notification.createManyAndReturn","Notification.updateOne","Notification.updateMany","Notification.updateManyAndReturn","Notification.upsertOne","Notification.deleteOne","Notification.deleteMany","Notification.groupBy","Notification.aggregate","Payment.findUnique","Payment.findUniqueOrThrow","Payment.findFirst","Payment.findFirstOrThrow","Payment.findMany","Payment.createOne","Payment.createMany","Payment.createManyAndReturn","Payment.updateOne","Payment.updateMany","Payment.updateManyAndReturn","Payment.upsertOne","Payment.deleteOne","Payment.deleteMany","Payment.groupBy","Payment.aggregate","RefreshToken.findUnique","RefreshToken.findUniqueOrThrow","RefreshToken.findFirst","RefreshToken.findFirstOrThrow","RefreshToken.findMany","RefreshToken.createOne","RefreshToken.createMany","RefreshToken.createManyAndReturn","RefreshToken.updateOne","RefreshToken.updateMany","RefreshToken.updateManyAndReturn","RefreshToken.upsertOne","RefreshToken.deleteOne","RefreshToken.deleteMany","RefreshToken.groupBy","RefreshToken.aggregate","Review.findUnique","Review.findUniqueOrThrow","Review.findFirst","Review.findFirstOrThrow","Review.findMany","Review.createOne","Review.createMany","Review.createManyAndReturn","Review.updateOne","Review.updateMany","Review.updateManyAndReturn","Review.upsertOne","Review.deleteOne","Review.deleteMany","Review.groupBy","Review.aggregate","TourPackage.findUnique","TourPackage.findUniqueOrThrow","TourPackage.findFirst","TourPackage.findFirstOrThrow","TourPackage.findMany","TourPackage.createOne","TourPackage.createMany","TourPackage.createManyAndReturn","TourPackage.updateOne","TourPackage.updateMany","TourPackage.updateManyAndReturn","TourPackage.upsertOne","TourPackage.deleteOne","TourPackage.deleteMany","TourPackage.groupBy","TourPackage.aggregate","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","User.upsertOne","User.deleteOne","User.deleteMany","User.groupBy","User.aggregate","WishlistItem.findUnique","WishlistItem.findUniqueOrThrow","WishlistItem.findFirst","WishlistItem.findFirstOrThrow","WishlistItem.findMany","WishlistItem.createOne","WishlistItem.createMany","WishlistItem.createManyAndReturn","WishlistItem.updateOne","WishlistItem.updateMany","WishlistItem.updateManyAndReturn","WishlistItem.upsertOne","WishlistItem.deleteOne","WishlistItem.deleteMany","WishlistItem.groupBy","WishlistItem.aggregate","AND","OR","NOT","id","userId","packageId","createdAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","name","email","password","googleId","phone","avatarUrl","Role","role","UserStatus","status","AuthProvider","authProvider","emailVerified","isDeleted","tokenVersion","updatedAt","every","some","none","title","slug","description","location","price","duration","rating","images","PackageStatus","categoryId","agentId","has","hasEvery","hasSome","comment","hash","expiresAt","revokedAt","bookingId","tranId","valId","amount","currency","PaymentStatus","gatewayPageUrl","sslSessionKey","cardType","bankTranId","paidAt","refundRefId","refundedAt","NotificationType","type","message","link","isRead","subject","isResolved","travelDate","travelers","totalPrice","BookingStatus","excerpt","content","coverImage","PostStatus","authorId","postId","parentId","userId_packageId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","push","increment","decrement","multiply","divide"]'),
  graph: "wAZxwAEPBwAAoQMAIBQAAKMDACAVAACkAwAgFgAA-QIAIN8BAACiAwAw4AEAACgAEOEBAACiAwAw4gEBAAAAAeMBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhrwIBAOsCACGzAgEA6wIAIbQCAQDsAgAhAQAAAAEAIBcFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIQUFAADmBQAgBgAA4AUAIAsAAJ4FACAMAACfBQAgDQAAoQUAIBcFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAAAAAeUBQADyAgAh-gEAALcDjQIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAAAAAYYCAQDrAgAhhwIBAOsCACGIAhAArwMAIYkCAgDxAgAhigIIALYDACGLAgAA_gIAII0CAQDrAgAhjgIBAOsCACEDAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAEAAAADACAPBwAAoQMAIAgAAKsDACAKAAC0AwAg3wEAALIDADDgAQAACQAQ4QEAALIDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA64CIoACQADyAgAhqgJAAPICACGrAgIA8QIAIawCEACvAwAhAwcAAOAFACAIAADjBQAgCgAA5QUAIA8HAAChAwAgCAAAqwMAIAoAALQDACDfAQAAsgMAMOABAAAJABDhAQAAsgMAMOIBAQAAAAHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH6AQAAswOuAiKAAkAA8gIAIaoCQADyAgAhqwICAPECACGsAhAArwMAIQMAAAAJACABAAAKADACAAALACAUCQAAsQMAIN8BAACuAwAw4AEAAA0AEOEBAACuAwAw4gEBAOsCACHlAUAA8gIAIfoBAACwA5wCIoACQADyAgAhlgIBAOsCACGXAgEA6wIAIZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhCQkAAOQFACCYAgAAwgMAIJwCAADCAwAgnQIAAMIDACCeAgAAwgMAIJ8CAADCAwAgoAIAAMIDACChAgAAwgMAIKICAADCAwAgFAkAALEDACDfAQAArgMAMOABAAANABDhAQAArgMAMOIBAQAAAAHlAUAA8gIAIfoBAACwA5wCIoACQADyAgAhlgIBAOsCACGXAgEAAAABmAIBAOwCACGZAhAArwMAIZoCAQDrAgAhnAIBAOwCACGdAgEA7AIAIZ4CAQDsAgAhnwIBAOwCACGgAkAAoAMAIaECAQDsAgAhogJAAKADACEDAAAADQAgAQAADgAwAgAADwAgAQAAAA0AIA0HAAChAwAgCAAAqwMAIN8BAACtAwAw4AEAABIAEOEBAACtAwAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhigICAPECACGSAgEA6wIAIQIHAADgBQAgCAAA4wUAIA4HAAChAwAgCAAAqwMAIN8BAACtAwAw4AEAABIAEOEBAACtAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhtQIAAKwDACADAAAAEgAgAQAAEwAwAgAAFAAgCQcAAKEDACAIAACrAwAg3wEAAKoDADDgAQAAFgAQ4QEAAKoDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIQIHAADgBQAgCAAA4wUAIAoHAAChAwAgCAAAqwMAIN8BAACqAwAw4AEAABYAEOEBAACqAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIbUCAACpAwAgAwAAABYAIAEAABcAMAIAABgAIAEAAAAJACABAAAAEgAgAQAAABYAIAMAAAAJACABAAAKADACAAALACADAAAAEgAgAQAAEwAwAgAAFAAgEBEAAPkCACATAAChAwAg3wEAAKcDADDgAQAAHwAQ4QEAAKcDADDiAQEA6wIAIeUBQADyAgAh-gEAAKgDsgIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAOsCACGuAgEA6wIAIa8CAQDrAgAhsAIBAOsCACGyAgEA6wIAIQIRAACjBQAgEwAA4AUAIBARAAD5AgAgEwAAoQMAIN8BAACnAwAw4AEAAB8AEOEBAACnAwAw4gEBAAAAAeUBQADyAgAh-gEAAKgDsgIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAAAAAa4CAQDrAgAhrwIBAOsCACGwAgEA6wIAIbICAQDrAgAhAwAAAB8AIAEAACAAMAIAACEAIAMAAAAWACABAAAXADACAAAYACAMBwAAoQMAIN8BAAClAwAw4AEAACQAEOEBAAClAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAhhAIBAOsCACGkAgAApgOkAiKlAgEA6wIAIaYCAQDsAgAhpwIgAPACACECBwAA4AUAIKYCAADCAwAgDAcAAKEDACDfAQAApQMAMOABAAAkABDhAQAApQMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhhAIBAOsCACGkAgAApgOkAiKlAgEA6wIAIaYCAQDsAgAhpwIgAPACACEDAAAAJAAgAQAAJQAwAgAAJgAgDwcAAKEDACAUAACjAwAgFQAApAMAIBYAAPkCACDfAQAAogMAMOABAAAoABDhAQAAogMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGvAgEA6wIAIbMCAQDrAgAhtAIBAOwCACEFBwAA4AUAIBQAAOEFACAVAADiBQAgFgAAowUAILQCAADCAwAgAwAAACgAIAEAACkAMAIAAAEAIAoHAAChAwAg3wEAAJ8DADDgAQAAKwAQ4QEAAJ8DADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACGTAgEA6wIAIZQCQADyAgAhlQJAAKADACECBwAA4AUAIJUCAADCAwAgCgcAAKEDACDfAQAAnwMAMOABAAArABDhAQAAnwMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhkwIBAAAAAZQCQADyAgAhlQJAAKADACEDAAAAKwAgAQAALAAwAgAALQAgAQAAAAMAIAEAAAAJACABAAAAEgAgAQAAAB8AIAEAAAAWACABAAAAJAAgAQAAACgAIAEAAAArACADAAAAKAAgAQAAKQAwAgAAAQAgAQAAACgAIAEAAAAoACADAAAAKAAgAQAAKQAwAgAAAQAgAQAAACgAIAEAAAABACADAAAAKAAgAQAAKQAwAgAAAQAgAwAAACgAIAEAACkAMAIAAAEAIAMAAAAoACABAAApADACAAABACAMBwAA_AMAIBQAAPsDACAVAAD_AwAgFgAA_QMAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABrwIBAAAAAbMCAQAAAAG0AgEAAAABARwAAEAAIAjiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAGzAgEAAAABtAIBAAAAAQEcAABCADABHAAAQgAwAQAAACgAIAwHAAD5AwAgFAAA7gMAIBUAAO8DACAWAADwAwAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIa8CAQC8AwAhswIBALwDACG0AgEAyAMAIQIAAAABACAcAABGACAI4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIa8CAQC8AwAhswIBALwDACG0AgEAyAMAIQIAAAAoACAcAABIACACAAAAKAAgHAAASAAgAQAAACgAIAMAAAABACAjAABAACAkAABGACABAAAAAQAgAQAAACgAIAQEAADdBQAgKQAA3wUAICoAAN4FACC0AgAAwgMAIAvfAQAAngMAMOABAABQABDhAQAAngMAMOIBAQDPAgAh4wEBAM8CACHlAUAA0AIAIf4BIADbAgAhgAJAANACACGvAgEAzwIAIbMCAQDPAgAhtAIBANcCACEDAAAAKAAgAQAATwAwKAAAUAAgAwAAACgAIAEAACkAMAIAAAEAIAEAAAAhACABAAAAIQAgAwAAAB8AIAEAACAAMAIAACEAIAMAAAAfACABAAAgADACAAAhACADAAAAHwAgAQAAIAAwAgAAIQAgDREAALAEACATAADcBQAg4gEBAAAAAeUBQAAAAAH6AQAAALICAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGuAgEAAAABrwIBAAAAAbACAQAAAAGyAgEAAAABARwAAFgAIAviAQEAAAAB5QFAAAAAAfoBAAAAsgIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAa4CAQAAAAGvAgEAAAABsAIBAAAAAbICAQAAAAEBHAAAWgAwARwAAFoAMA0RAAClBAAgEwAA2wUAIOIBAQC8AwAh5QFAAL0DACH6AQAAowSyAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIa4CAQC8AwAhrwIBALwDACGwAgEAvAMAIbICAQC8AwAhAgAAACEAIBwAAF0AIAviAQEAvAMAIeUBQAC9AwAh-gEAAKMEsgIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGuAgEAvAMAIa8CAQC8AwAhsAIBALwDACGyAgEAvAMAIQIAAAAfACAcAABfACACAAAAHwAgHAAAXwAgAwAAACEAICMAAFgAICQAAF0AIAEAAAAhACABAAAAHwAgAwQAANgFACApAADaBQAgKgAA2QUAIA7fAQAAmgMAMOABAABmABDhAQAAmgMAMOIBAQDPAgAh5QFAANACACH6AQAAmwOyAiL-ASAA2wIAIYACQADQAgAhhAIBAM8CACGFAgEAzwIAIa4CAQDPAgAhrwIBAM8CACGwAgEAzwIAIbICAQDPAgAhAwAAAB8AIAEAAGUAMCgAAGYAIAMAAAAfACABAAAgADACAAAhACABAAAACwAgAQAAAAsAIAMAAAAJACABAAAKADACAAALACADAAAACQAgAQAACgAwAgAACwAgAwAAAAkAIAEAAAoAMAIAAAsAIAwHAACOBQAgCAAA3AQAIAoAAN0EACDiAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACuAgKAAkAAAAABqgJAAAAAAasCAgAAAAGsAhAAAAABARwAAG4AIAniAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACuAgKAAkAAAAABqgJAAAAAAasCAgAAAAGsAhAAAAABARwAAHAAMAEcAABwADAMBwAAjAUAIAgAAMwEACAKAADNBAAg4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSuAiKAAkAAvQMAIaoCQAC9AwAhqwICAM0DACGsAhAAyQQAIQIAAAALACAcAABzACAJ4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSuAiKAAkAAvQMAIaoCQAC9AwAhqwICAM0DACGsAhAAyQQAIQIAAAAJACAcAAB1ACACAAAACQAgHAAAdQAgAwAAAAsAICMAAG4AICQAAHMAIAEAAAALACABAAAACQAgBQQAANMFACApAADWBQAgKgAA1QUAIEsAANQFACBMAADXBQAgDN8BAACWAwAw4AEAAHwAEOEBAACWAwAw4gEBAM8CACHjAQEAzwIAIeQBAQDPAgAh5QFAANACACH6AQAAlwOuAiKAAkAA0AIAIaoCQADQAgAhqwICANwCACGsAhAA_AIAIQMAAAAJACABAAB7ADAoAAB8ACADAAAACQAgAQAACgAwAgAACwAgCQMAAPMCACDfAQAAlQMAMOABAACCAQAQ4QEAAJUDADDiAQEAAAAB5QFAAPICACHxAQEAAAABgAJAAPICACGFAgEAAAABAQAAAH8AIAEAAAB_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_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQEcAAD6AQAwARwAAPoBADAKBwAAgQUAIAgAALwEACDiAQEAvAMAIeMBAQC8AwAh5AEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGKAgIAzQMAIZICAQC8AwAhAgAAABQAIBwAAP0BACAI4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhigICAM0DACGSAgEAvAMAIQIAAAASACAcAAD_AQAgAgAAABIAIBwAAP8BACADAAAAFAAgIwAA-AEAICQAAP0BACABAAAAFAAgAQAAABIAIAUEAACsBQAgKQAArwUAICoAAK4FACBLAACtBQAgTAAAsAUAIAvfAQAAhQMAMOABAACGAgAQ4QEAAIUDADDiAQEAzwIAIeMBAQDPAgAh5AEBAM8CACHlAUAA0AIAIf4BIADbAgAhgAJAANACACGKAgIA3AIAIZICAQDPAgAhAwAAABIAIAEAAIUCADAoAACGAgAgAwAAABIAIAEAABMAMAIAABQAIAEAAAAFACABAAAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgFAUAAJEFACAGAACrBQAgCwAAkgUAIAwAAJMFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAEBHAAAjgIAIA_iAQEAAAAB5QFAAAAAAfoBAAAAjQIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIQAAAAAYkCAgAAAAGKAggAAAABiwIAAJAFACCNAgEAAAABjgIBAAAAAQEcAACQAgAwARwAAJACADAUBQAA7AQAIAYAAKoFACALAADtBAAgDAAA7gQAIA0AAO8EACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIY4CAQC8AwAhAgAAAAUAIBwAAJMCACAP4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIQIAAAADACAcAACVAgAgAgAAAAMAIBwAAJUCACADAAAABQAgIwAAjgIAICQAAJMCACABAAAABQAgAQAAAAMAIAUEAAClBQAgKQAAqAUAICoAAKcFACBLAACmBQAgTAAAqQUAIBLfAQAA-wIAMOABAACcAgAQ4QEAAPsCADDiAQEAzwIAIeUBQADQAgAh-gEAAP8CjQIi_gEgANsCACGAAkAA0AIAIYQCAQDPAgAhhQIBAM8CACGGAgEAzwIAIYcCAQDPAgAhiAIQAPwCACGJAgIA3AIAIYoCCAD9AgAhiwIAAP4CACCNAgEAzwIAIY4CAQDPAgAhAwAAAAMAIAEAAJsCADAoAACcAgAgAwAAAAMAIAEAAAQAMAIAAAUAIBoDAADzAgAgCwAA9AIAIAwAAPUCACAOAAD2AgAgDwAA9wIAIBAAAPgCACARAAD5AgAgEgAA-gIAIN8BAADqAgAw4AEAAKICABDhAQAA6gIAMOIBAQAAAAHlAUAA8gIAIfEBAQDrAgAh8gEBAAAAAfMBAQDsAgAh9AEBAAAAAfUBAQDsAgAh9gEBAOwCACH4AQAA7QL4ASL6AQAA7gL6ASL8AQAA7wL8ASL9ASAA8AIAIf4BIADwAgAh_wECAPECACGAAkAA8gIAIQEAAACfAgAgAQAAAJ8CACAaAwAA8wIAIAsAAPQCACAMAAD1AgAgDgAA9gIAIA8AAPcCACAQAAD4AgAgEQAA-QIAIBIAAPoCACDfAQAA6gIAMOABAACiAgAQ4QEAAOoCADDiAQEA6wIAIeUBQADyAgAh8QEBAOsCACHyAQEA6wIAIfMBAQDsAgAh9AEBAOwCACH1AQEA7AIAIfYBAQDsAgAh-AEAAO0C-AEi-gEAAO4C-gEi_AEAAO8C_AEi_QEgAPACACH-ASAA8AIAIf8BAgDxAgAhgAJAAPICACEMAwAAnQUAIAsAAJ4FACAMAACfBQAgDgAAoAUAIA8AAKEFACAQAACiBQAgEQAAowUAIBIAAKQFACDzAQAAwgMAIPQBAADCAwAg9QEAAMIDACD2AQAAwgMAIAMAAACiAgAgAQAAowIAMAIAAJ8CACADAAAAogIAIAEAAKMCADACAACfAgAgAwAAAKICACABAACjAgAwAgAAnwIAIBcDAACVBQAgCwAAlgUAIAwAAJcFACAOAACYBQAgDwAAmQUAIBAAAJoFACARAACbBQAgEgAAnAUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQEcAACnAgAgD-IBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQEcAACpAgAwARwAAKkCADAXAwAAzgMAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACECAAAAnwIAIBwAAKwCACAP4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhAgAAAKICACAcAACuAgAgAgAAAKICACAcAACuAgAgAwAAAJ8CACAjAACnAgAgJAAArAIAIAEAAACfAgAgAQAAAKICACAJBAAAwwMAICkAAMYDACAqAADFAwAgSwAAxAMAIEwAAMcDACDzAQAAwgMAIPQBAADCAwAg9QEAAMIDACD2AQAAwgMAIBLfAQAA1gIAMOABAAC1AgAQ4QEAANYCADDiAQEAzwIAIeUBQADQAgAh8QEBAM8CACHyAQEAzwIAIfMBAQDXAgAh9AEBANcCACH1AQEA1wIAIfYBAQDXAgAh-AEAANgC-AEi-gEAANkC-gEi_AEAANoC_AEi_QEgANsCACH-ASAA2wIAIf8BAgDcAgAhgAJAANACACEDAAAAogIAIAEAALQCADAoAAC1AgAgAwAAAKICACABAACjAgAwAgAAnwIAIAEAAAAYACABAAAAGAAgAwAAABYAIAEAABcAMAIAABgAIAMAAAAWACABAAAXADACAAAYACADAAAAFgAgAQAAFwAwAgAAGAAgBgcAAMADACAIAADBAwAg4gEBAAAAAeMBAQAAAAHkAQEAAAAB5QFAAAAAAQEcAAC9AgAgBOIBAQAAAAHjAQEAAAAB5AEBAAAAAeUBQAAAAAEBHAAAvwIAMAEcAAC_AgAwBgcAAL4DACAIAAC_AwAg4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACECAAAAGAAgHAAAwgIAIATiAQEAvAMAIeMBAQC8AwAh5AEBALwDACHlAUAAvQMAIQIAAAAWACAcAADEAgAgAgAAABYAIBwAAMQCACADAAAAGAAgIwAAvQIAICQAAMICACABAAAAGAAgAQAAABYAIAMEAAC5AwAgKQAAuwMAICoAALoDACAH3wEAAM4CADDgAQAAywIAEOEBAADOAgAw4gEBAM8CACHjAQEAzwIAIeQBAQDPAgAh5QFAANACACEDAAAAFgAgAQAAygIAMCgAAMsCACADAAAAFgAgAQAAFwAwAgAAGAAgB98BAADOAgAw4AEAAMsCABDhAQAAzgIAMOIBAQDPAgAh4wEBAM8CACHkAQEAzwIAIeUBQADQAgAhDgQAANICACApAADVAgAgKgAA1QIAIOYBAQAAAAHnAQEAAAAE6AEBAAAABOkBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA1AIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAAQsEAADSAgAgKQAA0wIAICoAANMCACDmAUAAAAAB5wFAAAAABOgBQAAAAATpAUAAAAAB6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAANECACELBAAA0gIAICkAANMCACAqAADTAgAg5gFAAAAAAecBQAAAAAToAUAAAAAE6QFAAAAAAeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQADRAgAhCOYBAgAAAAHnAQIAAAAE6AECAAAABOkBAgAAAAHqAQIAAAAB6wECAAAAAewBAgAAAAHtAQIA0gIAIQjmAUAAAAAB5wFAAAAABOgBQAAAAATpAUAAAAAB6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAANMCACEOBAAA0gIAICkAANUCACAqAADVAgAg5gEBAAAAAecBAQAAAAToAQEAAAAE6QEBAAAAAeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQDUAgAh7gEBAAAAAe8BAQAAAAHwAQEAAAABC-YBAQAAAAHnAQEAAAAE6AEBAAAABOkBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA1QIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAARLfAQAA1gIAMOABAAC1AgAQ4QEAANYCADDiAQEAzwIAIeUBQADQAgAh8QEBAM8CACHyAQEAzwIAIfMBAQDXAgAh9AEBANcCACH1AQEA1wIAIfYBAQDXAgAh-AEAANgC-AEi-gEAANkC-gEi_AEAANoC_AEi_QEgANsCACH-ASAA2wIAIf8BAgDcAgAhgAJAANACACEOBAAA6AIAICkAAOkCACAqAADpAgAg5gEBAAAAAecBAQAAAAXoAQEAAAAF6QEBAAAAAeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQDnAgAh7gEBAAAAAe8BAQAAAAHwAQEAAAABBwQAANICACApAADmAgAgKgAA5gIAIOYBAAAA-AEC5wEAAAD4AQjoAQAAAPgBCO0BAADlAvgBIgcEAADSAgAgKQAA5AIAICoAAOQCACDmAQAAAPoBAucBAAAA-gEI6AEAAAD6AQjtAQAA4wL6ASIHBAAA0gIAICkAAOICACAqAADiAgAg5gEAAAD8AQLnAQAAAPwBCOgBAAAA_AEI7QEAAOEC_AEiBQQAANICACApAADgAgAgKgAA4AIAIOYBIAAAAAHtASAA3wIAIQ0EAADSAgAgKQAA0gIAICoAANICACBLAADeAgAgTAAA0gIAIOYBAgAAAAHnAQIAAAAE6AECAAAABOkBAgAAAAHqAQIAAAAB6wECAAAAAewBAgAAAAHtAQIA3QIAIQ0EAADSAgAgKQAA0gIAICoAANICACBLAADeAgAgTAAA0gIAIOYBAgAAAAHnAQIAAAAE6AECAAAABOkBAgAAAAHqAQIAAAAB6wECAAAAAewBAgAAAAHtAQIA3QIAIQjmAQgAAAAB5wEIAAAABOgBCAAAAATpAQgAAAAB6gEIAAAAAesBCAAAAAHsAQgAAAAB7QEIAN4CACEFBAAA0gIAICkAAOACACAqAADgAgAg5gEgAAAAAe0BIADfAgAhAuYBIAAAAAHtASAA4AIAIQcEAADSAgAgKQAA4gIAICoAAOICACDmAQAAAPwBAucBAAAA_AEI6AEAAAD8AQjtAQAA4QL8ASIE5gEAAAD8AQLnAQAAAPwBCOgBAAAA_AEI7QEAAOIC_AEiBwQAANICACApAADkAgAgKgAA5AIAIOYBAAAA-gEC5wEAAAD6AQjoAQAAAPoBCO0BAADjAvoBIgTmAQAAAPoBAucBAAAA-gEI6AEAAAD6AQjtAQAA5AL6ASIHBAAA0gIAICkAAOYCACAqAADmAgAg5gEAAAD4AQLnAQAAAPgBCOgBAAAA-AEI7QEAAOUC-AEiBOYBAAAA-AEC5wEAAAD4AQjoAQAAAPgBCO0BAADmAvgBIg4EAADoAgAgKQAA6QIAICoAAOkCACDmAQEAAAAB5wEBAAAABegBAQAAAAXpAQEAAAAB6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBAOcCACHuAQEAAAAB7wEBAAAAAfABAQAAAAEI5gECAAAAAecBAgAAAAXoAQIAAAAF6QECAAAAAeoBAgAAAAHrAQIAAAAB7AECAAAAAe0BAgDoAgAhC-YBAQAAAAHnAQEAAAAF6AEBAAAABekBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA6QIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAARoDAADzAgAgCwAA9AIAIAwAAPUCACAOAAD2AgAgDwAA9wIAIBAAAPgCACARAAD5AgAgEgAA-gIAIN8BAADqAgAw4AEAAKICABDhAQAA6gIAMOIBAQDrAgAh5QFAAPICACHxAQEA6wIAIfIBAQDrAgAh8wEBAOwCACH0AQEA7AIAIfUBAQDsAgAh9gEBAOwCACH4AQAA7QL4ASL6AQAA7gL6ASL8AQAA7wL8ASL9ASAA8AIAIf4BIADwAgAh_wECAPECACGAAkAA8gIAIQvmAQEAAAAB5wEBAAAABOgBAQAAAATpAQEAAAAB6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBANUCACHuAQEAAAAB7wEBAAAAAfABAQAAAAEL5gEBAAAAAecBAQAAAAXoAQEAAAAF6QEBAAAAAeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQDpAgAh7gEBAAAAAe8BAQAAAAHwAQEAAAABBOYBAAAA-AEC5wEAAAD4AQjoAQAAAPgBCO0BAADmAvgBIgTmAQAAAPoBAucBAAAA-gEI6AEAAAD6AQjtAQAA5AL6ASIE5gEAAAD8AQLnAQAAAPwBCOgBAAAA_AEI7QEAAOIC_AEiAuYBIAAAAAHtASAA4AIAIQjmAQIAAAAB5wECAAAABOgBAgAAAATpAQIAAAAB6gECAAAAAesBAgAAAAHsAQIAAAAB7QECANICACEI5gFAAAAAAecBQAAAAAToAUAAAAAE6QFAAAAAAeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQADTAgAhA4ECAAADACCCAgAAAwAggwIAAAMAIAOBAgAACQAgggIAAAkAIIMCAAAJACADgQIAABIAIIICAAASACCDAgAAEgAgA4ECAAAfACCCAgAAHwAggwIAAB8AIAOBAgAAFgAgggIAABYAIIMCAAAWACADgQIAACQAIIICAAAkACCDAgAAJAAgA4ECAAAoACCCAgAAKAAggwIAACgAIAOBAgAAKwAgggIAACsAIIMCAAArACAS3wEAAPsCADDgAQAAnAIAEOEBAAD7AgAw4gEBAM8CACHlAUAA0AIAIfoBAAD_Ao0CIv4BIADbAgAhgAJAANACACGEAgEAzwIAIYUCAQDPAgAhhgIBAM8CACGHAgEAzwIAIYgCEAD8AgAhiQICANwCACGKAggA_QIAIYsCAAD-AgAgjQIBAM8CACGOAgEAzwIAIQ0EAADSAgAgKQAAhAMAICoAAIQDACBLAACEAwAgTAAAhAMAIOYBEAAAAAHnARAAAAAE6AEQAAAABOkBEAAAAAHqARAAAAAB6wEQAAAAAewBEAAAAAHtARAAgwMAIQ0EAADSAgAgKQAA3gIAICoAAN4CACBLAADeAgAgTAAA3gIAIOYBCAAAAAHnAQgAAAAE6AEIAAAABOkBCAAAAAHqAQgAAAAB6wEIAAAAAewBCAAAAAHtAQgAggMAIQTmAQEAAAAFjwIBAAAAAZACAQAAAASRAgEAAAAEBwQAANICACApAACBAwAgKgAAgQMAIOYBAAAAjQIC5wEAAACNAgjoAQAAAI0CCO0BAACAA40CIgcEAADSAgAgKQAAgQMAICoAAIEDACDmAQAAAI0CAucBAAAAjQII6AEAAACNAgjtAQAAgAONAiIE5gEAAACNAgLnAQAAAI0CCOgBAAAAjQII7QEAAIEDjQIiDQQAANICACApAADeAgAgKgAA3gIAIEsAAN4CACBMAADeAgAg5gEIAAAAAecBCAAAAAToAQgAAAAE6QEIAAAAAeoBCAAAAAHrAQgAAAAB7AEIAAAAAe0BCACCAwAhDQQAANICACApAACEAwAgKgAAhAMAIEsAAIQDACBMAACEAwAg5gEQAAAAAecBEAAAAAToARAAAAAE6QEQAAAAAeoBEAAAAAHrARAAAAAB7AEQAAAAAe0BEACDAwAhCOYBEAAAAAHnARAAAAAE6AEQAAAABOkBEAAAAAHqARAAAAAB6wEQAAAAAewBEAAAAAHtARAAhAMAIQvfAQAAhQMAMOABAACGAgAQ4QEAAIUDADDiAQEAzwIAIeMBAQDPAgAh5AEBAM8CACHlAUAA0AIAIf4BIADbAgAhgAJAANACACGKAgIA3AIAIZICAQDPAgAhCd8BAACGAwAw4AEAAPABABDhAQAAhgMAMOIBAQDPAgAh4wEBAM8CACHlAUAA0AIAIZMCAQDPAgAhlAJAANACACGVAkAAhwMAIQsEAADoAgAgKQAAiQMAICoAAIkDACDmAUAAAAAB5wFAAAAABegBQAAAAAXpAUAAAAAB6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAAIgDACELBAAA6AIAICkAAIkDACAqAACJAwAg5gFAAAAAAecBQAAAAAXoAUAAAAAF6QFAAAAAAeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQACIAwAhCOYBQAAAAAHnAUAAAAAF6AFAAAAABekBQAAAAAHqAUAAAAAB6wFAAAAAAewBQAAAAAHtAUAAiQMAIRPfAQAAigMAMOABAADaAQAQ4QEAAIoDADDiAQEAzwIAIeUBQADQAgAh-gEAAIsDnAIigAJAANACACGWAgEAzwIAIZcCAQDPAgAhmAIBANcCACGZAhAA_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-AEAAO0C-AEi-gEAAO4C-gEi_AEAAO8C_AEi_QEgAPACACH-ASAA8AIAIf8BAgDxAgAhgAJAAPICACG2AgAAogIAILcCAACiAgAgDwcAAKEDACAUAACjAwAgFQAApAMAIBYAAPkCACDfAQAAogMAMOABAAAoABDhAQAAogMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGvAgEA6wIAIbMCAQDrAgAhtAIBAOwCACESEQAA-QIAIBMAAKEDACDfAQAApwMAMOABAAAfABDhAQAApwMAMOIBAQDrAgAh5QFAAPICACH6AQAAqAOyAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIa4CAQDrAgAhrwIBAOsCACGwAgEA6wIAIbICAQDrAgAhtgIAAB8AILcCAAAfACARBwAAoQMAIBQAAKMDACAVAACkAwAgFgAA-QIAIN8BAACiAwAw4AEAACgAEOEBAACiAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAh_gEgAPACACGAAkAA8gIAIa8CAQDrAgAhswIBAOsCACG0AgEA7AIAIbYCAAAoACC3AgAAKAAgDAcAAKEDACDfAQAApQMAMOABAAAkABDhAQAApQMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIYQCAQDrAgAhpAIAAKYDpAIipQIBAOsCACGmAgEA7AIAIacCIADwAgAhBOYBAAAApAIC5wEAAACkAgjoAQAAAKQCCO0BAACRA6QCIhARAAD5AgAgEwAAoQMAIN8BAACnAwAw4AEAAB8AEOEBAACnAwAw4gEBAOsCACHlAUAA8gIAIfoBAACoA7ICIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhrgIBAOsCACGvAgEA6wIAIbACAQDrAgAhsgIBAOsCACEE5gEAAACyAgLnAQAAALICCOgBAAAAsgII7QEAAJ0DsgIiAuMBAQAAAAHkAQEAAAABCQcAAKEDACAIAACrAwAg3wEAAKoDADDgAQAAFgAQ4QEAAKoDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIRkFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIbYCAAADACC3AgAAAwAgAuMBAQAAAAHkAQEAAAABDQcAAKEDACAIAACrAwAg3wEAAK0DADDgAQAAEgAQ4QEAAK0DADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhFAkAALEDACDfAQAArgMAMOABAAANABDhAQAArgMAMOIBAQDrAgAh5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAOsCACGYAgEA7AIAIZkCEACvAwAhmgIBAOsCACGcAgEA7AIAIZ0CAQDsAgAhngIBAOwCACGfAgEA7AIAIaACQACgAwAhoQIBAOwCACGiAkAAoAMAIQjmARAAAAAB5wEQAAAABOgBEAAAAATpARAAAAAB6gEQAAAAAesBEAAAAAHsARAAAAAB7QEQAIQDACEE5gEAAACcAgLnAQAAAJwCCOgBAAAAnAII7QEAAI0DnAIiEQcAAKEDACAIAACrAwAgCgAAtAMAIN8BAACyAwAw4AEAAAkAEOEBAACyAwAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH6AQAAswOuAiKAAkAA8gIAIaoCQADyAgAhqwICAPECACGsAhAArwMAIbYCAAAJACC3AgAACQAgDwcAAKEDACAIAACrAwAgCgAAtAMAIN8BAACyAwAw4AEAAAkAEOEBAACyAwAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH6AQAAswOuAiKAAkAA8gIAIaoCQADyAgAhqwICAPECACGsAhAArwMAIQTmAQAAAK4CAucBAAAArgII6AEAAACuAgjtAQAAmQOuAiIDgQIAAA0AIIICAAANACCDAgAADQAgFwUAALgDACAGAAChAwAgCwAA9AIAIAwAAPUCACANAAD3AgAg3wEAALUDADDgAQAAAwAQ4QEAALUDADDiAQEA6wIAIeUBQADyAgAh-gEAALcDjQIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAOsCACGGAgEA6wIAIYcCAQDrAgAhiAIQAK8DACGJAgIA8QIAIYoCCAC2AwAhiwIAAP4CACCNAgEA6wIAIY4CAQDrAgAhCOYBCAAAAAHnAQgAAAAE6AEIAAAABOkBCAAAAAHqAQgAAAAB6wEIAAAAAewBCAAAAAHtAQgA3gIAIQTmAQAAAI0CAucBAAAAjQII6AEAAACNAgjtAQAAgQONAiILAwAA8wIAIN8BAACVAwAw4AEAAIIBABDhAQAAlQMAMOIBAQDrAgAh5QFAAPICACHxAQEA6wIAIYACQADyAgAhhQIBAOsCACG2AgAAggEAILcCAACCAQAgAAAAAbsCAQAAAAEBuwJAAAAAAQUjAAC5BgAgJAAAvwYAILgCAAC6BgAguQIAAL4GACC-AgAAnwIAIAUjAAC3BgAgJAAAvAYAILgCAAC4BgAguQIAALsGACC-AgAABQAgAyMAALkGACC4AgAAugYAIL4CAACfAgAgAyMAALcGACC4AgAAuAYAIL4CAAAFACAAAAAAAAABuwIBAAAAAQG7AgAAAPgBAgG7AgAAAPoBAgG7AgAAAPwBAgG7AiAAAAABBbsCAgAAAAHCAgIAAAABwwICAAAAAcQCAgAAAAHFAgIAAAABCyMAAN4EADAkAADjBAAwuAIAAN8EADC5AgAA4AQAMLoCAADhBAAguwIAAOIEADC8AgAA4gQAML0CAADiBAAwvgIAAOIEADC_AgAA5AQAMMACAADlBAAwCyMAAL8EADAkAADEBAAwuAIAAMAEADC5AgAAwQQAMLoCAADCBAAguwIAAMMEADC8AgAAwwQAML0CAADDBAAwvgIAAMMEADC_AgAAxQQAMMACAADGBAAwCyMAALEEADAkAAC2BAAwuAIAALIEADC5AgAAswQAMLoCAAC0BAAguwIAALUEADC8AgAAtQQAML0CAAC1BAAwvgIAALUEADC_AgAAtwQAMMACAAC4BAAwCyMAAJkEADAkAACeBAAwuAIAAJoEADC5AgAAmwQAMLoCAACcBAAguwIAAJ0EADC8AgAAnQQAML0CAACdBAAwvgIAAJ0EADC_AgAAnwQAMMACAACgBAAwCyMAAI0EADAkAACSBAAwuAIAAI4EADC5AgAAjwQAMLoCAACQBAAguwIAAJEEADC8AgAAkQQAML0CAACRBAAwvgIAAJEEADC_AgAAkwQAMMACAACUBAAwCyMAAIAEADAkAACFBAAwuAIAAIEEADC5AgAAggQAMLoCAACDBAAguwIAAIQEADC8AgAAhAQAML0CAACEBAAwvgIAAIQEADC_AgAAhgQAMMACAACHBAAwCyMAAOMDADAkAADoAwAwuAIAAOQDADC5AgAA5QMAMLoCAADmAwAguwIAAOcDADC8AgAA5wMAML0CAADnAwAwvgIAAOcDADC_AgAA6QMAMMACAADqAwAwCyMAANYDADAkAADbAwAwuAIAANcDADC5AgAA2AMAMLoCAADZAwAguwIAANoDADC8AgAA2gMAML0CAADaAwAwvgIAANoDADC_AgAA3AMAMMACAADdAwAwBeIBAQAAAAHlAUAAAAABkwIBAAAAAZQCQAAAAAGVAkAAAAABAgAAAC0AICMAAOIDACADAAAALQAgIwAA4gMAICQAAOEDACABHAAAtgYAMAoHAAChAwAg3wEAAJ8DADDgAQAAKwAQ4QEAAJ8DADDiAQEAAAAB4wEBAOsCACHlAUAA8gIAIZMCAQAAAAGUAkAA8gIAIZUCQACgAwAhAgAAAC0AIBwAAOEDACACAAAA3gMAIBwAAN8DACAJ3wEAAN0DADDgAQAA3gMAEOEBAADdAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAhkwIBAOsCACGUAkAA8gIAIZUCQACgAwAhCd8BAADdAwAw4AEAAN4DABDhAQAA3QMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIZMCAQDrAgAhlAJAAPICACGVAkAAoAMAIQXiAQEAvAMAIeUBQAC9AwAhkwIBALwDACGUAkAAvQMAIZUCQADgAwAhAbsCQAAAAAEF4gEBALwDACHlAUAAvQMAIZMCAQC8AwAhlAJAAL0DACGVAkAA4AMAIQXiAQEAAAAB5QFAAAAAAZMCAQAAAAGUAkAAAAABlQJAAAAAAQoUAAD7AwAgFQAA_wMAIBYAAP0DACDiAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABrwIBAAAAAbMCAQAAAAG0AgEAAAABAgAAAAEAICMAAP4DACADAAAAAQAgIwAA_gMAICQAAO0DACABHAAAtQYAMA8HAAChAwAgFAAAowMAIBUAAKQDACAWAAD5AgAg3wEAAKIDADDgAQAAKAAQ4QEAAKIDADDiAQEAAAAB4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGvAgEA6wIAIbMCAQDrAgAhtAIBAOwCACECAAAAAQAgHAAA7QMAIAIAAADrAwAgHAAA7AMAIAvfAQAA6gMAMOABAADrAwAQ4QEAAOoDADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhrwIBAOsCACGzAgEA6wIAIbQCAQDsAgAhC98BAADqAwAw4AEAAOsDABDhAQAA6gMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGvAgEA6wIAIbMCAQDrAgAhtAIBAOwCACEH4gEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGvAgEAvAMAIbMCAQC8AwAhtAIBAMgDACEKFAAA7gMAIBUAAO8DACAWAADwAwAg4gEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGvAgEAvAMAIbMCAQC8AwAhtAIBAMgDACEFIwAAqQYAICQAALMGACC4AgAAqgYAILkCAACyBgAgvgIAACEAIAcjAAClBgAgJAAAsAYAILgCAACmBgAguQIAAK8GACC8AgAAKAAgvQIAACgAIL4CAAABACALIwAA8QMAMCQAAPUDADC4AgAA8gMAMLkCAADzAwAwugIAAPQDACC7AgAA5wMAMLwCAADnAwAwvQIAAOcDADC-AgAA5wMAML8CAAD2AwAwwAIAAOoDADAKBwAA_AMAIBQAAPsDACAWAAD9AwAg4gEBAAAAAeMBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGvAgEAAAABswIBAAAAAQIAAAABACAjAAD6AwAgAwAAAAEAICMAAPoDACAkAAD4AwAgARwAAK4GADACAAAAAQAgHAAA-AMAIAIAAADrAwAgHAAA9wMAIAfiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhrwIBALwDACGzAgEAvAMAIQoHAAD5AwAgFAAA7gMAIBYAAPADACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhrwIBALwDACGzAgEAvAMAIQUjAACnBgAgJAAArAYAILgCAACoBgAguQIAAKsGACC-AgAAnwIAIAoHAAD8AwAgFAAA-wMAIBYAAP0DACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAGzAgEAAAABAyMAAKkGACC4AgAAqgYAIL4CAAAhACADIwAApwYAILgCAACoBgAgvgIAAJ8CACAEIwAA8QMAMLgCAADyAwAwugIAAPQDACC-AgAA5wMAMAoUAAD7AwAgFQAA_wMAIBYAAP0DACDiAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABrwIBAAAAAbMCAQAAAAG0AgEAAAABAyMAAKUGACC4AgAApgYAIL4CAAABACAH4gEBAAAAAeUBQAAAAAGEAgEAAAABpAIAAACkAgKlAgEAAAABpgIBAAAAAacCIAAAAAECAAAAJgAgIwAAjAQAIAMAAAAmACAjAACMBAAgJAAAiwQAIAEcAACkBgAwDAcAAKEDACDfAQAApQMAMOABAAAkABDhAQAApQMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhhAIBAOsCACGkAgAApgOkAiKlAgEA6wIAIaYCAQDsAgAhpwIgAPACACECAAAAJgAgHAAAiwQAIAIAAACIBAAgHAAAiQQAIAvfAQAAhwQAMOABAACIBAAQ4QEAAIcEADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACGEAgEA6wIAIaQCAACmA6QCIqUCAQDrAgAhpgIBAOwCACGnAiAA8AIAIQvfAQAAhwQAMOABAACIBAAQ4QEAAIcEADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACGEAgEA6wIAIaQCAACmA6QCIqUCAQDrAgAhpgIBAOwCACGnAiAA8AIAIQfiAQEAvAMAIeUBQAC9AwAhhAIBALwDACGkAgAAigSkAiKlAgEAvAMAIaYCAQDIAwAhpwIgAMwDACEBuwIAAACkAgIH4gEBALwDACHlAUAAvQMAIYQCAQC8AwAhpAIAAIoEpAIipQIBALwDACGmAgEAyAMAIacCIADMAwAhB-IBAQAAAAHlAUAAAAABhAIBAAAAAaQCAAAApAICpQIBAAAAAaYCAQAAAAGnAiAAAAABBAgAAMEDACDiAQEAAAAB5AEBAAAAAeUBQAAAAAECAAAAGAAgIwAAmAQAIAMAAAAYACAjAACYBAAgJAAAlwQAIAEcAACjBgAwCgcAAKEDACAIAACrAwAg3wEAAKoDADDgAQAAFgAQ4QEAAKoDADDiAQEAAAAB4wEBAOsCACHkAQEA6wIAIeUBQADyAgAhtQIAAKkDACACAAAAGAAgHAAAlwQAIAIAAACVBAAgHAAAlgQAIAffAQAAlAQAMOABAACVBAAQ4QEAAJQEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIQffAQAAlAQAMOABAACVBAAQ4QEAAJQEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIQPiAQEAvAMAIeQBAQC8AwAh5QFAAL0DACEECAAAvwMAIOIBAQC8AwAh5AEBALwDACHlAUAAvQMAIQQIAADBAwAg4gEBAAAAAeQBAQAAAAHlAUAAAAABCxEAALAEACDiAQEAAAAB5QFAAAAAAfoBAAAAsgIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAa4CAQAAAAGvAgEAAAABsAIBAAAAAQIAAAAhACAjAACvBAAgAwAAACEAICMAAK8EACAkAACkBAAgARwAAKIGADAQEQAA-QIAIBMAAKEDACDfAQAApwMAMOABAAAfABDhAQAApwMAMOIBAQAAAAHlAUAA8gIAIfoBAACoA7ICIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQAAAAGuAgEA6wIAIa8CAQDrAgAhsAIBAOsCACGyAgEA6wIAIQIAAAAhACAcAACkBAAgAgAAAKEEACAcAACiBAAgDt8BAACgBAAw4AEAAKEEABDhAQAAoAQAMOIBAQDrAgAh5QFAAPICACH6AQAAqAOyAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIa4CAQDrAgAhrwIBAOsCACGwAgEA6wIAIbICAQDrAgAhDt8BAACgBAAw4AEAAKEEABDhAQAAoAQAMOIBAQDrAgAh5QFAAPICACH6AQAAqAOyAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIa4CAQDrAgAhrwIBAOsCACGwAgEA6wIAIbICAQDrAgAhCuIBAQC8AwAh5QFAAL0DACH6AQAAowSyAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIa4CAQC8AwAhrwIBALwDACGwAgEAvAMAIQG7AgAAALICAgsRAAClBAAg4gEBALwDACHlAUAAvQMAIfoBAACjBLICIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhrgIBALwDACGvAgEAvAMAIbACAQC8AwAhCyMAAKYEADAkAACqBAAwuAIAAKcEADC5AgAAqAQAMLoCAACpBAAguwIAAOcDADC8AgAA5wMAML0CAADnAwAwvgIAAOcDADC_AgAAqwQAMMACAADqAwAwCgcAAPwDACAVAAD_AwAgFgAA_QMAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABrwIBAAAAAbQCAQAAAAECAAAAAQAgIwAArgQAIAMAAAABACAjAACuBAAgJAAArQQAIAEcAAChBgAwAgAAAAEAIBwAAK0EACACAAAA6wMAIBwAAKwEACAH4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIa8CAQC8AwAhtAIBAMgDACEKBwAA-QMAIBUAAO8DACAWAADwAwAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIa8CAQC8AwAhtAIBAMgDACEKBwAA_AMAIBUAAP8DACAWAAD9AwAg4gEBAAAAAeMBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGvAgEAAAABtAIBAAAAAQsRAACwBAAg4gEBAAAAAeUBQAAAAAH6AQAAALICAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGuAgEAAAABrwIBAAAAAbACAQAAAAEEIwAApgQAMLgCAACnBAAwugIAAKkEACC-AgAA5wMAMAgIAAC-BAAg4gEBAAAAAeQBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQIAAAAUACAjAAC9BAAgAwAAABQAICMAAL0EACAkAAC7BAAgARwAAKAGADAOBwAAoQMAIAgAAKsDACDfAQAArQMAMOABAAASABDhAQAArQMAMOIBAQAAAAHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhigICAPECACGSAgEA6wIAIbUCAACsAwAgAgAAABQAIBwAALsEACACAAAAuQQAIBwAALoEACAL3wEAALgEADDgAQAAuQQAEOEBAAC4BAAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhigICAPECACGSAgEA6wIAIQvfAQAAuAQAMOABAAC5BAAQ4QEAALgEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhB-IBAQC8AwAh5AEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGKAgIAzQMAIZICAQC8AwAhCAgAALwEACDiAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhigICAM0DACGSAgEAvAMAIQUjAACbBgAgJAAAngYAILgCAACcBgAguQIAAJ0GACC-AgAABQAgCAgAAL4EACDiAQEAAAAB5AEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAYoCAgAAAAGSAgEAAAABAyMAAJsGACC4AgAAnAYAIL4CAAAFACAKCAAA3AQAIAoAAN0EACDiAQEAAAAB5AEBAAAAAeUBQAAAAAH6AQAAAK4CAoACQAAAAAGqAkAAAAABqwICAAAAAawCEAAAAAECAAAACwAgIwAA2wQAIAMAAAALACAjAADbBAAgJAAAywQAIAEcAACaBgAwDwcAAKEDACAIAACrAwAgCgAAtAMAIN8BAACyAwAw4AEAAAkAEOEBAACyAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA64CIoACQADyAgAhqgJAAPICACGrAgIA8QIAIawCEACvAwAhAgAAAAsAIBwAAMsEACACAAAAxwQAIBwAAMgEACAM3wEAAMYEADDgAQAAxwQAEOEBAADGBAAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH6AQAAswOuAiKAAkAA8gIAIaoCQADyAgAhqwICAPECACGsAhAArwMAIQzfAQAAxgQAMOABAADHBAAQ4QEAAMYEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA64CIoACQADyAgAhqgJAAPICACGrAgIA8QIAIawCEACvAwAhCOIBAQC8AwAh5AEBALwDACHlAUAAvQMAIfoBAADKBK4CIoACQAC9AwAhqgJAAL0DACGrAgIAzQMAIawCEADJBAAhBbsCEAAAAAHCAhAAAAABwwIQAAAAAcQCEAAAAAHFAhAAAAABAbsCAAAArgICCggAAMwEACAKAADNBAAg4gEBALwDACHkAQEAvAMAIeUBQAC9AwAh-gEAAMoErgIigAJAAL0DACGqAkAAvQMAIasCAgDNAwAhrAIQAMkEACEFIwAAlAYAICQAAJgGACC4AgAAlQYAILkCAACXBgAgvgIAAAUAIAsjAADOBAAwJAAA0wQAMLgCAADPBAAwuQIAANAEADC6AgAA0QQAILsCAADSBAAwvAIAANIEADC9AgAA0gQAML4CAADSBAAwvwIAANQEADDAAgAA1QQAMA_iAQEAAAAB5QFAAAAAAfoBAAAAnAICgAJAAAAAAZcCAQAAAAGYAgEAAAABmQIQAAAAAZoCAQAAAAGcAgEAAAABnQIBAAAAAZ4CAQAAAAGfAgEAAAABoAJAAAAAAaECAQAAAAGiAkAAAAABAgAAAA8AICMAANoEACADAAAADwAgIwAA2gQAICQAANkEACABHAAAlgYAMBQJAACxAwAg3wEAAK4DADDgAQAADQAQ4QEAAK4DADDiAQEAAAAB5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAAAAAZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhAgAAAA8AIBwAANkEACACAAAA1gQAIBwAANcEACAT3wEAANUEADDgAQAA1gQAEOEBAADVBAAw4gEBAOsCACHlAUAA8gIAIfoBAACwA5wCIoACQADyAgAhlgIBAOsCACGXAgEA6wIAIZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhE98BAADVBAAw4AEAANYEABDhAQAA1QQAMOIBAQDrAgAh5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAOsCACGYAgEA7AIAIZkCEACvAwAhmgIBAOsCACGcAgEA7AIAIZ0CAQDsAgAhngIBAOwCACGfAgEA7AIAIaACQACgAwAhoQIBAOwCACGiAkAAoAMAIQ_iAQEAvAMAIeUBQAC9AwAh-gEAANgEnAIigAJAAL0DACGXAgEAvAMAIZgCAQDIAwAhmQIQAMkEACGaAgEAvAMAIZwCAQDIAwAhnQIBAMgDACGeAgEAyAMAIZ8CAQDIAwAhoAJAAOADACGhAgEAyAMAIaICQADgAwAhAbsCAAAAnAICD-IBAQC8AwAh5QFAAL0DACH6AQAA2AScAiKAAkAAvQMAIZcCAQC8AwAhmAIBAMgDACGZAhAAyQQAIZoCAQC8AwAhnAIBAMgDACGdAgEAyAMAIZ4CAQDIAwAhnwIBAMgDACGgAkAA4AMAIaECAQDIAwAhogJAAOADACEP4gEBAAAAAeUBQAAAAAH6AQAAAJwCAoACQAAAAAGXAgEAAAABmAIBAAAAAZkCEAAAAAGaAgEAAAABnAIBAAAAAZ0CAQAAAAGeAgEAAAABnwIBAAAAAaACQAAAAAGhAgEAAAABogJAAAAAAQoIAADcBAAgCgAA3QQAIOIBAQAAAAHkAQEAAAAB5QFAAAAAAfoBAAAArgICgAJAAAAAAaoCQAAAAAGrAgIAAAABrAIQAAAAAQMjAACUBgAguAIAAJUGACC-AgAABQAgBCMAAM4EADC4AgAAzwQAMLoCAADRBAAgvgIAANIEADASBQAAkQUAIAsAAJIFACAMAACTBQAgDQAAlAUAIOIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII0CAQAAAAECAAAABQAgIwAAjwUAIAMAAAAFACAjAACPBQAgJAAA6wQAIAEcAACTBgAwFwUAALgDACAGAAChAwAgCwAA9AIAIAwAAPUCACANAAD3AgAg3wEAALUDADDgAQAAAwAQ4QEAALUDADDiAQEAAAAB5QFAAPICACH6AQAAtwONAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEAAAABhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIQIAAAAFACAcAADrBAAgAgAAAOYEACAcAADnBAAgEt8BAADlBAAw4AEAAOYEABDhAQAA5QQAMOIBAQDrAgAh5QFAAPICACH6AQAAtwONAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIYYCAQDrAgAhhwIBAOsCACGIAhAArwMAIYkCAgDxAgAhigIIALYDACGLAgAA_gIAII0CAQDrAgAhjgIBAOsCACES3wEAAOUEADDgAQAA5gQAEOEBAADlBAAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIQ7iAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIQW7AggAAAABwgIIAAAAAcMCCAAAAAHEAggAAAABxQIIAAAAAQK7AgEAAAAEwQIBAAAABQG7AgAAAI0CAhIFAADsBAAgCwAA7QQAIAwAAO4EACANAADvBAAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACEFIwAAgQYAICQAAJEGACC4AgAAggYAILkCAACQBgAgvgIAAH8AIAsjAACEBQAwJAAAiAUAMLgCAACFBQAwuQIAAIYFADC6AgAAhwUAILsCAADDBAAwvAIAAMMEADC9AgAAwwQAML4CAADDBAAwvwIAAIkFADDAAgAAxgQAMAsjAAD5BAAwJAAA_QQAMLgCAAD6BAAwuQIAAPsEADC6AgAA_AQAILsCAAC1BAAwvAIAALUEADC9AgAAtQQAML4CAAC1BAAwvwIAAP4EADDAAgAAuAQAMAsjAADwBAAwJAAA9AQAMLgCAADxBAAwuQIAAPIEADC6AgAA8wQAILsCAACRBAAwvAIAAJEEADC9AgAAkQQAML4CAACRBAAwvwIAAPUEADDAAgAAlAQAMAQHAADAAwAg4gEBAAAAAeMBAQAAAAHlAUAAAAABAgAAABgAICMAAPgEACADAAAAGAAgIwAA-AQAICQAAPcEACABHAAAjwYAMAIAAAAYACAcAAD3BAAgAgAAAJUEACAcAAD2BAAgA-IBAQC8AwAh4wEBALwDACHlAUAAvQMAIQQHAAC-AwAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAhBAcAAMADACDiAQEAAAAB4wEBAAAAAeUBQAAAAAEIBwAAgwUAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABigICAAAAAZICAQAAAAECAAAAFAAgIwAAggUAIAMAAAAUACAjAACCBQAgJAAAgAUAIAEcAACOBgAwAgAAABQAIBwAAIAFACACAAAAuQQAIBwAAP8EACAH4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIYoCAgDNAwAhkgIBALwDACEIBwAAgQUAIOIBAQC8AwAh4wEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGKAgIAzQMAIZICAQC8AwAhBSMAAIkGACAkAACMBgAguAIAAIoGACC5AgAAiwYAIL4CAACfAgAgCAcAAIMFACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAYoCAgAAAAGSAgEAAAABAyMAAIkGACC4AgAAigYAIL4CAACfAgAgCgcAAI4FACAKAADdBAAg4gEBAAAAAeMBAQAAAAHlAUAAAAAB-gEAAACuAgKAAkAAAAABqgJAAAAAAasCAgAAAAGsAhAAAAABAgAAAAsAICMAAI0FACADAAAACwAgIwAAjQUAICQAAIsFACABHAAAiAYAMAIAAAALACAcAACLBQAgAgAAAMcEACAcAACKBQAgCOIBAQC8AwAh4wEBALwDACHlAUAAvQMAIfoBAADKBK4CIoACQAC9AwAhqgJAAL0DACGrAgIAzQMAIawCEADJBAAhCgcAAIwFACAKAADNBAAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh-gEAAMoErgIigAJAAL0DACGqAkAAvQMAIasCAgDNAwAhrAIQAMkEACEFIwAAgwYAICQAAIYGACC4AgAAhAYAILkCAACFBgAgvgIAAJ8CACAKBwAAjgUAIAoAAN0EACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH6AQAAAK4CAoACQAAAAAGqAkAAAAABqwICAAAAAawCEAAAAAEDIwAAgwYAILgCAACEBgAgvgIAAJ8CACASBQAAkQUAIAsAAJIFACAMAACTBQAgDQAAlAUAIOIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII0CAQAAAAEBuwIBAAAABAMjAACBBgAguAIAAIIGACC-AgAAfwAgBCMAAIQFADC4AgAAhQUAMLoCAACHBQAgvgIAAMMEADAEIwAA-QQAMLgCAAD6BAAwugIAAPwEACC-AgAAtQQAMAQjAADwBAAwuAIAAPEEADC6AgAA8wQAIL4CAACRBAAwBCMAAN4EADC4AgAA3wQAMLoCAADhBAAgvgIAAOIEADAEIwAAvwQAMLgCAADABAAwugIAAMIEACC-AgAAwwQAMAQjAACxBAAwuAIAALIEADC6AgAAtAQAIL4CAAC1BAAwBCMAAJkEADC4AgAAmgQAMLoCAACcBAAgvgIAAJ0EADAEIwAAjQQAMLgCAACOBAAwugIAAJAEACC-AgAAkQQAMAQjAACABAAwuAIAAIEEADC6AgAAgwQAIL4CAACEBAAwBCMAAOMDADC4AgAA5AMAMLoCAADmAwAgvgIAAOcDADAEIwAA1gMAMLgCAADXAwAwugIAANkDACC-AgAA2gMAMAAAAAAAAAAAAAAAAAAFIwAA_AUAICQAAP8FACC4AgAA_QUAILkCAAD-BQAgvgIAAJ8CACADIwAA_AUAILgCAAD9BQAgvgIAAJ8CACAAAAAAAAAAAAUjAAD3BQAgJAAA-gUAILgCAAD4BQAguQIAAPkFACC-AgAAnwIAIAMjAAD3BQAguAIAAPgFACC-AgAAnwIAIAAAAAAABSMAAPIFACAkAAD1BQAguAIAAPMFACC5AgAA9AUAIL4CAAALACADIwAA8gUAILgCAADzBQAgvgIAAAsAIAAAAAUjAADtBQAgJAAA8AUAILgCAADuBQAguQIAAO8FACC-AgAAnwIAIAMjAADtBQAguAIAAO4FACC-AgAAnwIAIAAAAAAAAAsjAADJBQAwJAAAzQUAMLgCAADKBQAwuQIAAMsFADC6AgAAzAUAILsCAADiBAAwvAIAAOIEADC9AgAA4gQAML4CAADiBAAwvwIAAM4FADDAAgAA5QQAMBIGAACrBQAgCwAAkgUAIAwAAJMFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjgIBAAAAAQIAAAAFACAjAADRBQAgAwAAAAUAICMAANEFACAkAADQBQAgARwAAOwFADACAAAABQAgHAAA0AUAIAIAAADmBAAgHAAAzwUAIA7iAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCOAgEAvAMAIRIGAACqBQAgCwAA7QQAIAwAAO4EACANAADvBAAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjgIBALwDACESBgAAqwUAIAsAAJIFACAMAACTBQAgDQAAlAUAIOIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII4CAQAAAAEEIwAAyQUAMLgCAADKBQAwugIAAMwFACC-AgAA4gQAMAAAAAAAAAAABSMAAOcFACAkAADqBQAguAIAAOgFACC5AgAA6QUAIL4CAACfAgAgAyMAAOcFACC4AgAA6AUAIL4CAACfAgAgAAAADAMAAJ0FACALAACeBQAgDAAAnwUAIA4AAKAFACAPAAChBQAgEAAAogUAIBEAAKMFACASAACkBQAg8wEAAMIDACD0AQAAwgMAIPUBAADCAwAg9gEAAMIDACACEQAAowUAIBMAAOAFACAFBwAA4AUAIBQAAOEFACAVAADiBQAgFgAAowUAILQCAADCAwAgBQUAAOYFACAGAADgBQAgCwAAngUAIAwAAJ8FACANAAChBQAgAwcAAOAFACAIAADjBQAgCgAA5QUAIAABAwAAnQUAIBYDAACVBQAgCwAAlgUAIAwAAJcFACAPAACZBQAgEAAAmgUAIBEAAJsFACASAACcBQAg4gEBAAAAAeUBQAAAAAHxAQEAAAAB8gEBAAAAAfMBAQAAAAH0AQEAAAAB9QEBAAAAAfYBAQAAAAH4AQAAAPgBAvoBAAAA-gEC_AEAAAD8AQL9ASAAAAAB_gEgAAAAAf8BAgAAAAGAAkAAAAABAgAAAJ8CACAjAADnBQAgAwAAAKICACAjAADnBQAgJAAA6wUAIBgAAACiAgAgAwAAzgMAIAsAAM8DACAMAADQAwAgDwAA0gMAIBAAANMDACARAADUAwAgEgAA1QMAIBwAAOsFACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEWAwAAzgMAIAsAAM8DACAMAADQAwAgDwAA0gMAIBAAANMDACARAADUAwAgEgAA1QMAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIQ7iAQEAAAAB5QFAAAAAAfoBAAAAjQIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIQAAAAAYkCAgAAAAGKAggAAAABiwIAAJAFACCOAgEAAAABFgMAAJUFACALAACWBQAgDAAAlwUAIA4AAJgFACAPAACZBQAgEQAAmwUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAO0FACADAAAAogIAICMAAO0FACAkAADxBQAgGAAAAKICACADAADOAwAgCwAAzwMAIAwAANADACAOAADRAwAgDwAA0gMAIBEAANQDACASAADVAwAgHAAA8QUAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIRYDAADOAwAgCwAAzwMAIAwAANADACAOAADRAwAgDwAA0gMAIBEAANQDACASAADVAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhCwcAAI4FACAIAADcBAAg4gEBAAAAAeMBAQAAAAHkAQEAAAAB5QFAAAAAAfoBAAAArgICgAJAAAAAAaoCQAAAAAGrAgIAAAABrAIQAAAAAQIAAAALACAjAADyBQAgAwAAAAkAICMAAPIFACAkAAD2BQAgDQAAAAkAIAcAAIwFACAIAADMBAAgHAAA9gUAIOIBAQC8AwAh4wEBALwDACHkAQEAvAMAIeUBQAC9AwAh-gEAAMoErgIigAJAAL0DACGqAkAAvQMAIasCAgDNAwAhrAIQAMkEACELBwAAjAUAIAgAAMwEACDiAQEAvAMAIeMBAQC8AwAh5AEBALwDACHlAUAAvQMAIfoBAADKBK4CIoACQAC9AwAhqgJAAL0DACGrAgIAzQMAIawCEADJBAAhFgMAAJUFACALAACWBQAgDAAAlwUAIA4AAJgFACAPAACZBQAgEAAAmgUAIBEAAJsFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAPcFACADAAAAogIAICMAAPcFACAkAAD7BQAgGAAAAKICACADAADOAwAgCwAAzwMAIAwAANADACAOAADRAwAgDwAA0gMAIBAAANMDACARAADUAwAgHAAA-wUAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIRYDAADOAwAgCwAAzwMAIAwAANADACAOAADRAwAgDwAA0gMAIBAAANMDACARAADUAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgsAAJYFACAMAACXBQAgDgAAmAUAIA8AAJkFACAQAACaBQAgEQAAmwUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAPwFACADAAAAogIAICMAAPwFACAkAACABgAgGAAAAKICACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAgHAAAgAYAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIRYLAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhBeIBAQAAAAHlAUAAAAAB8QEBAAAAAYACQAAAAAGFAgEAAAABAgAAAH8AICMAAIEGACAWAwAAlQUAIAwAAJcFACAOAACYBQAgDwAAmQUAIBAAAJoFACARAACbBQAgEgAAnAUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQIAAACfAgAgIwAAgwYAIAMAAACiAgAgIwAAgwYAICQAAIcGACAYAAAAogIAIAMAAM4DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACAcAACHBgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEI4gEBAAAAAeMBAQAAAAHlAUAAAAAB-gEAAACuAgKAAkAAAAABqgJAAAAAAasCAgAAAAGsAhAAAAABFgMAAJUFACALAACWBQAgDgAAmAUAIA8AAJkFACAQAACaBQAgEQAAmwUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAIkGACADAAAAogIAICMAAIkGACAkAACNBgAgGAAAAKICACADAADOAwAgCwAAzwMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAgHAAAjQYAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIRYDAADOAwAgCwAAzwMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhB-IBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABigICAAAAAZICAQAAAAED4gEBAAAAAeMBAQAAAAHlAUAAAAABAwAAAIIBACAjAACBBgAgJAAAkgYAIAcAAACCAQAgHAAAkgYAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIYACQAC9AwAhhQIBALwDACEF4gEBALwDACHlAUAAvQMAIfEBAQC8AwAhgAJAAL0DACGFAgEAvAMAIQ7iAQEAAAAB5QFAAAAAAfoBAAAAjQIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIQAAAAAYkCAgAAAAGKAggAAAABiwIAAJAFACCNAgEAAAABEwUAAJEFACAGAACrBQAgDAAAkwUAIA0AAJQFACDiAQEAAAAB5QFAAAAAAfoBAAAAjQIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIQAAAAAYkCAgAAAAGKAggAAAABiwIAAJAFACCNAgEAAAABjgIBAAAAAQIAAAAFACAjAACUBgAgD-IBAQAAAAHlAUAAAAAB-gEAAACcAgKAAkAAAAABlwIBAAAAAZgCAQAAAAGZAhAAAAABmgIBAAAAAZwCAQAAAAGdAgEAAAABngIBAAAAAZ8CAQAAAAGgAkAAAAABoQIBAAAAAaICQAAAAAEDAAAAAwAgIwAAlAYAICQAAJkGACAVAAAAAwAgBQAA7AQAIAYAAKoFACAMAADuBAAgDQAA7wQAIBwAAJkGACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIY4CAQC8AwAhEwUAAOwEACAGAACqBQAgDAAA7gQAIA0AAO8EACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIY4CAQC8AwAhCOIBAQAAAAHkAQEAAAAB5QFAAAAAAfoBAAAArgICgAJAAAAAAaoCQAAAAAGrAgIAAAABrAIQAAAAARMFAACRBQAgBgAAqwUAIAsAAJIFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAECAAAABQAgIwAAmwYAIAMAAAADACAjAACbBgAgJAAAnwYAIBUAAAADACAFAADsBAAgBgAAqgUAIAsAAO0EACANAADvBAAgHAAAnwYAIOIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhjgIBALwDACETBQAA7AQAIAYAAKoFACALAADtBAAgDQAA7wQAIOIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhjgIBALwDACEH4gEBAAAAAeQBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQfiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAG0AgEAAAABCuIBAQAAAAHlAUAAAAAB-gEAAACyAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABrgIBAAAAAa8CAQAAAAGwAgEAAAABA-IBAQAAAAHkAQEAAAAB5QFAAAAAAQfiAQEAAAAB5QFAAAAAAYQCAQAAAAGkAgAAAKQCAqUCAQAAAAGmAgEAAAABpwIgAAAAAQsHAAD8AwAgFAAA-wMAIBUAAP8DACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAGzAgEAAAABtAIBAAAAAQIAAAABACAjAAClBgAgFgMAAJUFACALAACWBQAgDAAAlwUAIA4AAJgFACAPAACZBQAgEAAAmgUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAKcGACAMEwAA3AUAIOIBAQAAAAHlAUAAAAAB-gEAAACyAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABrgIBAAAAAa8CAQAAAAGwAgEAAAABsgIBAAAAAQIAAAAhACAjAACpBgAgAwAAAKICACAjAACnBgAgJAAArQYAIBgAAACiAgAgAwAAzgMAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEgAA1QMAIBwAAK0GACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEWAwAAzgMAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEgAA1QMAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIQfiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAGzAgEAAAABAwAAACgAICMAAKUGACAkAACxBgAgDQAAACgAIAcAAPkDACAUAADuAwAgFQAA7wMAIBwAALEGACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhrwIBALwDACGzAgEAvAMAIbQCAQDIAwAhCwcAAPkDACAUAADuAwAgFQAA7wMAIOIBAQC8AwAh4wEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGvAgEAvAMAIbMCAQC8AwAhtAIBAMgDACEDAAAAHwAgIwAAqQYAICQAALQGACAOAAAAHwAgEwAA2wUAIBwAALQGACDiAQEAvAMAIeUBQAC9AwAh-gEAAKMEsgIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGuAgEAvAMAIa8CAQC8AwAhsAIBALwDACGyAgEAvAMAIQwTAADbBQAg4gEBALwDACHlAUAAvQMAIfoBAACjBLICIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhrgIBALwDACGvAgEAvAMAIbACAQC8AwAhsgIBALwDACEH4gEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAGzAgEAAAABtAIBAAAAAQXiAQEAAAAB5QFAAAAAAZMCAQAAAAGUAkAAAAABlQJAAAAAARMFAACRBQAgBgAAqwUAIAsAAJIFACAMAACTBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAECAAAABQAgIwAAtwYAIBYDAACVBQAgCwAAlgUAIAwAAJcFACAOAACYBQAgEAAAmgUAIBEAAJsFACASAACcBQAg4gEBAAAAAeUBQAAAAAHxAQEAAAAB8gEBAAAAAfMBAQAAAAH0AQEAAAAB9QEBAAAAAfYBAQAAAAH4AQAAAPgBAvoBAAAA-gEC_AEAAAD8AQL9ASAAAAAB_gEgAAAAAf8BAgAAAAGAAkAAAAABAgAAAJ8CACAjAAC5BgAgAwAAAAMAICMAALcGACAkAAC9BgAgFQAAAAMAIAUAAOwEACAGAACqBQAgCwAA7QQAIAwAAO4EACAcAAC9BgAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIRMFAADsBAAgBgAAqgUAIAsAAO0EACAMAADuBAAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIQMAAACiAgAgIwAAuQYAICQAAMAGACAYAAAAogIAIAMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAQAADTAwAgEQAA1AMAIBIAANUDACAcAADABgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEFBAARBwADFAACFTkBFjoBAwQAEBE3ARMAAwkDBgQEAA8LHQcMHgoOIgIPIwsQJw0RKgESLg4GBAAMBQAFBgADCwwHDBUKDRkLAgMHBAQABgEDCAAEBAAJBwADCAAEChAIAQkABwEKEQACBwADCAAEAgcAAwgABAMLGgAMGwANHAABBwADAQcAAwgDLwALMAAMMQAOMgAPMwAQNAARNQASNgABETgAARY7AAADBwADFAACFUUBAwcAAxQAAhVLAQMEABYpABcqABgAAAADBAAWKQAXKgAYARMAAwETAAMDBAAdKQAeKgAfAAAAAwQAHSkAHioAHwIHAAMIAAQCBwADCAAEBQQAJCkAJyoAKEsAJUwAJgAAAAAABQQAJCkAJyoAKEsAJUwAJgAAAwQALSkALioALwAAAAMEAC0pAC4qAC8AAAADBAA1KQA2KgA3AAAAAwQANSkANioANwEHAAMBBwADAwQAPCkAPSoAPgAAAAMEADwpAD0qAD4BCQAHAQkABwUEAEMpAEYqAEdLAERMAEUAAAAAAAUEAEMpAEYqAEdLAERMAEUBBwADAQcAAwMEAEwpAE0qAE4AAAADBABMKQBNKgBOAgcAAwgABAIHAAMIAAQFBABTKQBWKgBXSwBUTABVAAAAAAAFBABTKQBWKgBXSwBUTABVAgUABQYAAwIFAAUGAAMFBABcKQBfKgBgSwBdTABeAAAAAAAFBABcKQBfKgBgSwBdTABeAAAFBABlKQBoKgBpSwBmTABnAAAAAAAFBABlKQBoKgBpSwBmTABnAgcAAwgABAIHAAMIAAQDBABuKQBvKgBwAAAAAwQAbikAbyoAcBcCARg8ARk9ARo-ARs_AR1BAR5DEh9EEyBHASFJEiJKFCVMASZNASdOEitRFSxSGS1TAi5UAi9VAjBWAjFXAjJZAjNbEjRcGjVeAjZgEjdhGzhiAjljAjpkEjtnHDxoID1pBz5qBz9rB0BsB0FtB0JvB0NxEkRyIUV0B0Z2Ekd3Ikh4B0l5B0p6Ek19I05-KU-AAQVQgQEFUYQBBVKFAQVThgEFVIgBBVWKARJWiwEqV40BBViPARJZkAErWpEBBVuSAQVckwESXZYBLF6XATBfmQExYJoBMWGdATFingExY58BMWShATFlowESZqQBMmemATFoqAESaakBM2qqATFrqwExbKwBEm2vATRusAE4b7EBDXCyAQ1xswENcrQBDXO1AQ10twENdbkBEna6ATl3vAENeL4BEnm_ATp6wAENe8EBDXzCARJ9xQE7fsYBP3_HAQiAAcgBCIEByQEIggHKAQiDAcsBCIQBzQEIhQHPARKGAdABQIcB0gEIiAHUARKJAdUBQYoB1gEIiwHXAQiMAdgBEo0B2wFCjgHcAUiPAd0BDpAB3gEOkQHfAQ6SAeABDpMB4QEOlAHjAQ6VAeUBEpYB5gFJlwHoAQ6YAeoBEpkB6wFKmgHsAQ6bAe0BDpwB7gESnQHxAUueAfIBT58B8wEKoAH0AQqhAfUBCqIB9gEKowH3AQqkAfkBCqUB-wESpgH8AVCnAf4BCqgBgAISqQGBAlGqAYICCqsBgwIKrAGEAhKtAYcCUq4BiAJYrwGJAgSwAYoCBLEBiwIEsgGMAgSzAY0CBLQBjwIEtQGRAhK2AZICWbcBlAIEuAGWAhK5AZcCWroBmAIEuwGZAgS8AZoCEr0BnQJbvgGeAmG_AaACA8ABoQIDwQGkAgPCAaUCA8MBpgIDxAGoAgPFAaoCEsYBqwJixwGtAgPIAa8CEskBsAJjygGxAgPLAbICA8wBswISzQG2AmTOAbcCas8BuAIL0AG5AgvRAboCC9IBuwIL0wG8AgvUAb4CC9UBwAIS1gHBAmvXAcMCC9gBxQIS2QHGAmzaAccCC9sByAIL3AHJAhLdAcwCbd4BzQJx"
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
  refundedAt: "refundedAt",
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
import crypto from "crypto";
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
import jwt from "jsonwebtoken";
var createToken = (payload, secret, expiresIn) => {
  const token = jwt.sign(payload, secret, expiresIn);
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
var sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
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
  const otpValue = crypto.randomInt(1e5, 1e6).toString();
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
  const otpValue = crypto.randomInt(1e5, 1e6).toString();
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
  const otp = crypto.randomInt(1e5, 1e6).toString();
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
    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: /* @__PURE__ */ new Date() }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } }
      })
    ]);
    throw new AppError(401, "Refresh token reuse detected. Please login again.");
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, "Refresh token has expired. Please login again.");
  }
  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: /* @__PURE__ */ new Date() }
    });
    return issueTokens(user, tx);
  });
};
var logout = async (userId) => {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: /* @__PURE__ */ new Date() }
  });
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } }
  });
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
    store_id: storeId,
    store_passwd: storePassword,
    refund_amount: options.refund_amount.toFixed(2),
    refund_remarks: options.refund_remarks,
    format: "json",
    v: "1"
  });
  if (options.refe_id) params.set("refe_id", options.refe_id);
  const res = await fetch(`${config_default.sslcommerz_refund_url}?${params.toString()}`, {
    method: "GET"
  });
  const text = await res.text();
  if (!res.ok) throw new AppError(502, `SSLCommerz refund failed (${res.status})`);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AppError(502, "SSLCommerz refund returned a non-JSON response");
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
    refundedAt: true
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
  try {
    const payments = await prisma.payment.findMany({
      where: { bookingId, status: PaymentStatus.REFUNDED }
    });
    if (payments.length === 0) return;
    const refundRefs = [];
    const outcomes = await Promise.allSettled(
      payments.map(async (payment) => {
        if (!payment.bankTranId) {
          console.error(
            `[refund] payment ${payment.id} has no bank_tran_id; gateway refund skipped.`
          );
          return;
        }
        const gateway = await sslcommerzRefund({
          bank_tran_id: payment.bankTranId,
          refund_amount: Number(payment.amount),
          refund_remarks: `Booking ${bookingId} cancelled - TripVerse`,
          refe_id: bookingId
        });
        if (gateway.status === "success" && gateway.refund_ref_id) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { refundRefId: gateway.refund_ref_id, refundedAt: /* @__PURE__ */ new Date() }
          });
          refundRefs.push(gateway.refund_ref_id);
        } else {
          console.error(
            `[refund] payment ${payment.id} rejected: ${gateway.errorReason ?? gateway.status ?? "unknown"}`
          );
        }
      })
    );
    void outcomes;
    if (refundRefs.length > 0) {
      void Promise.allSettled([
        sendRefundEmail({
          email: ctx.email,
          name: ctx.name,
          packageTitle: ctx.packageTitle,
          travelDate: ctx.travelDate,
          amount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
          refundRefId: refundRefs[0]
        })
      ]);
    }
  } catch (error) {
    console.error(
      `[refund] unexpected error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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
        where: { bookingId: id, status: PaymentStatus.SUCCESS },
        data: { status: PaymentStatus.REFUNDED }
      });
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
  if (to === BookingStatus.CANCELLED) {
    await issueRefunds(id, {
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
  return { ...updated, totalPrice: Number(updated.totalPrice) };
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FwcC50cyIsICIuLi9zcmMvY29uZmlnL2luZGV4LnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL25vdEZvdW5kLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudC50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2ludGVybmFsL2NsYXNzLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXMudHMiLCAiLi4vc3JjL3V0aWxzL2FwcEVycm9yLnRzIiwgIi4uL3NyYy9saWIvcHJpc21hLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguc2VydmljZS50cyIsICIuLi9zcmMvbGliL2dvb2dsZUF1dGgudHMiLCAiLi4vc3JjL2xpYi9yZWRpcy50cyIsICIuLi9zcmMvdXRpbHMvand0LnRzIiwgIi4uL3NyYy9saWIvbm9kZW1haWxlci50cyIsICIuLi9zcmMvdGVtcGxhdGVzL2luZGV4LnRzIiwgIi4uL3NyYy91dGlscy9hdXRoRW1haWwudHMiLCAiLi4vc3JjL3V0aWxzL2NhdGNoQXN5bmMudHMiLCAiLi4vc3JjL3V0aWxzL3NlbmRSZXNwb25zZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGgudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3QudHMiLCAiLi4vc3JjL21pZGRsZXdhcmUvYXV0aC50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9saWIvY2xvdWRpbmFyeS50cyIsICIuLi9zcmMvbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jb250YWN0L2NvbnRhY3Qucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL2VtYWlsLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbGliL3NzbGNvbW1lcnoudHMiLCAiLi4vc3JjL3V0aWxzL25vdGlmaWNhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcmV2aWV3L3Jldmlldy52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL3NsdWdpZnkudHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2Uuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nQ29tbWVudC5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jsb2cvYmxvZ0NvbW1lbnQuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2dDb21tZW50LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3Qucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3dpc2hsaXN0L3dpc2hsaXN0LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ub3RpZmljYXRpb24vbm90aWZpY2F0aW9uLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL25vdGlmaWNhdGlvbi9ub3RpZmljYXRpb24udmFsaWRhdGlvbi50cyIsICJpbmRleC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IGV4cHJlc3MsIHsgQXBwbGljYXRpb24sIE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xyXG5pbXBvcnQgY29ycyBmcm9tIFwiY29yc1wiO1xyXG5pbXBvcnQgY29va2llUGFyc2VyIGZyb20gXCJjb29raWUtcGFyc2VyXCI7XHJcbmltcG9ydCBoZWxtZXQgZnJvbSBcImhlbG1ldFwiO1xyXG5pbXBvcnQgbW9yZ2FuIGZyb20gXCJtb3JnYW5cIjtcclxuaW1wb3J0IHJhdGVMaW1pdCBmcm9tIFwiZXhwcmVzcy1yYXRlLWxpbWl0XCI7XHJcbmltcG9ydCBjb25maWcgZnJvbSBcIi4vY29uZmlnXCI7XHJcbmltcG9ydCBub3RGb3VuZEhhbmRsZXIgZnJvbSBcIi4vbWlkZGxld2FyZS9ub3RGb3VuZFwiO1xyXG5pbXBvcnQgZ2xvYmFsRXJyb3JIYW5kbGVyIGZyb20gXCIuL21pZGRsZXdhcmUvZ2xvYmFsRXJyb3JIYW5kbGVyXCI7XHJcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuL2xpYi9wcmlzbWFcIjtcclxuaW1wb3J0IHsgYXV0aFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYXV0aC9hdXRoLnJvdXRlXCI7XHJcbmltcG9ydCB7IHVzZXJSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZVwiO1xyXG5pbXBvcnQgeyB1cGxvYWRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBjb250YWN0Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9jb250YWN0L2NvbnRhY3Qucm91dGVcIjtcclxuaW1wb3J0IHsgYm9va2luZ1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlXCI7XHJcbmltcG9ydCB7IHJldmlld1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcmV2aWV3L3Jldmlldy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBjYXRlZ29yeVJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkucm91dGVcIjtcclxuaW1wb3J0IHsgcGFja2FnZVJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGFja2FnZS9wYWNrYWdlLnJvdXRlXCI7XHJcbmltcG9ydCB7IGJsb2dSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Jsb2cvYmxvZy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBkYXNoYm9hcmRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQucm91dGVcIjtcclxuaW1wb3J0IHsgcGF5bWVudFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnJvdXRlXCI7XHJcbmltcG9ydCB7IHdpc2hsaXN0Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBub3RpZmljYXRpb25Sb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL25vdGlmaWNhdGlvbi9ub3RpZmljYXRpb24ucm91dGVcIjtcclxuXHJcbmNvbnN0IGFwcDogQXBwbGljYXRpb24gPSBleHByZXNzKCk7XHJcblxyXG4vLyBSZW5kZXIvUmFpbHdheSBzaXQgYmVoaW5kIGEgcmV2ZXJzZSBwcm94eSBcdTIwMTQgbXVzdCBiZSBzZXQgYmVmb3JlIHRoZVxyXG4vLyByYXRlIGxpbWl0ZXIgb3IgaXQgd2lsbCBzZWUgdGhlIHByb3h5J3MgSVAgZm9yIGV2ZXJ5IHJlcXVlc3QgYW5kXHJcbi8vIGVmZmVjdGl2ZWx5IHJhdGUtbGltaXQgYWxsIHVzZXJzIHRvZ2V0aGVyLlxyXG5hcHAuc2V0KFwidHJ1c3QgcHJveHlcIiwgMSk7XHJcblxyXG5hcHAudXNlKGhlbG1ldCgpKTtcclxuXHJcbmFwcC51c2UoXHJcbiAgY29ycyh7XHJcbiAgICAvLyBEZXYgaG9zdCAobG9jYWxob3N0KSArIHByb2QgaG9zdCAoVmVyY2VsKSBib3RoIGFsbG93ZWQgc2lkZS1ieS1zaWRlLlxyXG4gICAgLy8gQ29uZmlnIHJlc29sdmVzIHNlbnNpYmxlIGRlZmF1bHRzIHNvIG5laXRoZXIgY2FuIGJlIGZhbHN5LlxyXG4gICAgb3JpZ2luOiBbY29uZmlnLmZyb250ZW5kX3VybF9kZXYsIGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZF0uZmlsdGVyKFxyXG4gICAgICAobyk6IG8gaXMgc3RyaW5nID0+IEJvb2xlYW4obyksXHJcbiAgICApLFxyXG4gICAgY3JlZGVudGlhbHM6IHRydWUsXHJcbiAgfSksXHJcbik7XHJcblxyXG5pZiAoY29uZmlnLm5vZGVfZW52ICE9PSBcInByb2R1Y3Rpb25cIikge1xyXG4gIGFwcC51c2UobW9yZ2FuKFwiZGV2XCIpKTtcclxufVxyXG5cclxuYXBwLnVzZShleHByZXNzLmpzb24oeyBsaW1pdDogXCIxMDBrYlwiIH0pKTtcclxuYXBwLnVzZShleHByZXNzLnVybGVuY29kZWQoeyBleHRlbmRlZDogdHJ1ZSwgbGltaXQ6IFwiMTAwa2JcIiB9KSk7XHJcbmFwcC51c2UoY29va2llUGFyc2VyKCkpO1xyXG5cclxuLy8gU3RyaWN0IGxpbWl0ZXIgXHUyMDE0IGF1dGggZW5kcG9pbnRzLCBicnV0ZS1mb3JjZSBwcm90ZWN0aW9uXHJcbmNvbnN0IGF1dGhMaW1pdGVyID0gcmF0ZUxpbWl0KHtcclxuICB3aW5kb3dNczogMTUgKiA2MCAqIDEwMDAsXHJcbiAgbGltaXQ6IDUsXHJcbiAgc3RhbmRhcmRIZWFkZXJzOiB0cnVlLFxyXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxyXG4gIG1lc3NhZ2U6IHtcclxuICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSBhdHRlbXB0cy4gUGxlYXNlIHRyeSBhZ2FpbiBpbiAxNSBtaW51dGVzLlwiLFxyXG4gIH0sXHJcbn0pO1xyXG5cclxuLy8gU3RhbmRhcmQgbGltaXRlciBcdTIwMTQgZXZlcnl0aGluZyBlbHNlIHVuZGVyIC9hcGlcclxuY29uc3QgYXBpTGltaXRlciA9IHJhdGVMaW1pdCh7XHJcbiAgd2luZG93TXM6IDE1ICogNjAgKiAxMDAwLFxyXG4gIGxpbWl0OiAxMDAsXHJcbiAgc3RhbmRhcmRIZWFkZXJzOiB0cnVlLFxyXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxyXG4gIG1lc3NhZ2U6IHtcclxuICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSByZXF1ZXN0cy4gUGxlYXNlIHRyeSBhZ2FpbiBsYXRlci5cIixcclxuICB9LFxyXG59KTtcclxuXHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvbG9naW5cIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL3JlZ2lzdGVyXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9kZW1vLWxvZ2luXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9nb29nbGVcIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL3ZlcmlmeS1lbWFpbFwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvcmVzZW5kLXZlcmlmaWNhdGlvblwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvZm9yZ290LXBhc3N3b3JkXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9yZXNldC1wYXNzd29yZFwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpXCIsIGFwaUxpbWl0ZXIpO1xyXG5cclxuLy8gUm9vdCByb3V0ZVxyXG5hcHAuZ2V0KFwiL1wiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgcmVzLnNlbmQoXCJXZWxjb21lIHRvIHRoZSBUcmlwVmVyc2UgQVBJIVwiKTtcclxufSk7XHJcblxyXG4vLyBIZWFsdGggY2hlY2sgXHUyMDE0IHJlYWwgREIgY29ubmVjdGl2aXR5IGNoZWNrLCBub3QgYSBzdGF0aWMgMjAwLlxyXG5hcHAuZ2V0KFwiL2hlYWx0aFwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUIDFgO1xyXG4gICAgcmVzLnN0YXR1cygyMDApLmpzb24oe1xyXG4gICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICBtZXNzYWdlOiBcIk9LXCIsXHJcbiAgICAgIGRiOiBcImNvbm5lY3RlZFwiLFxyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgIH0pO1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICByZXMuc3RhdHVzKDUwMykuanNvbih7XHJcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICBtZXNzYWdlOiBcIlNlcnZpY2UgdW5hdmFpbGFibGVcIixcclxuICAgICAgZGI6IFwiZGlzY29ubmVjdGVkXCIsXHJcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59KTtcclxuXHJcbi8vIFx1MjUwMFx1MjUwMCBGZWF0dXJlIHJvdXRlcyByZWdpc3RlciBoZXJlIGFzIGVhY2ggbW9kdWxlIGlzIGJ1aWx0IFx1MjUwMFx1MjUwMFxyXG5hcHAudXNlKFwiL2FwaS9hdXRoXCIsIGF1dGhSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS91c2Vyc1wiLCB1c2VyUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvdXBsb2Fkc1wiLCB1cGxvYWRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jb250YWN0XCIsIGNvbnRhY3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jYXRlZ29yaWVzXCIsIGNhdGVnb3J5Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvcGFja2FnZXNcIiwgcGFja2FnZVJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3Jldmlld3NcIiwgcmV2aWV3Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvYm9va2luZ3NcIiwgYm9va2luZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Jsb2dcIiwgYmxvZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Rhc2hib2FyZFwiLCBkYXNoYm9hcmRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9wYXltZW50c1wiLCBwYXltZW50Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvd2lzaGxpc3RcIiwgd2lzaGxpc3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9ub3RpZmljYXRpb25zXCIsIG5vdGlmaWNhdGlvblJvdXRlcyk7XHJcblxyXG5hcHAudXNlKG5vdEZvdW5kSGFuZGxlcik7XHJcbmFwcC51c2UoZ2xvYmFsRXJyb3JIYW5kbGVyKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGFwcDtcclxuIiwgImltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmRvdGVudi5jb25maWcoe1xuICBxdWlldDogdHJ1ZSxcbiAgcGF0aDogcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwiLmVudlwiKSxcbn0pO1xuXG4vLyBFdmVyeSBtb2R1bGUgcmVhZHMgY29uZmlnIHRocm91Z2ggdGhpcyB2YWxpZGF0ZWQgb2JqZWN0LCBuZXZlclxuLy8gcHJvY2Vzcy5lbnYgZGlyZWN0bHkgXHUyMDE0IGEgbWlzc2luZy9tYWxmb3JtZWQgdmFyIGZhaWxzIGxvdWRseSBhdCBib290XG4vLyBpbnN0ZWFkIG9mIHN1cmZhY2luZyBhcyBhIGNvbmZ1c2luZyBydW50aW1lIGVycm9yIG1pZC1yZXF1ZXN0LlxuY29uc3QgZW52U2NoZW1hID0gei5vYmplY3Qoe1xuICBQT1JUOiB6LnN0cmluZygpLmRlZmF1bHQoXCI0MDAwXCIpLFxuICBOT0RFX0VOVjogei5lbnVtKFtcImRldmVsb3BtZW50XCIsIFwicHJvZHVjdGlvblwiXSkuZGVmYXVsdChcImRldmVsb3BtZW50XCIpLFxuXG4gIC8vIEZyb250ZW5kIG9yaWdpbnMgZm9yIENPUlMgKyBwYXltZW50IHJlZGlyZWN0cy4gVGhlIGZyb250ZW5kIG1heSBub3QgYmVcbiAgLy8gZGVwbG95ZWQgeWV0IChvciBtYXkgYmUgcmVidWlsdCksIHNvIGJvdGggYXJlIG9wdGlvbmFsOiB0aGUgYmFja2VuZCBtdXN0XG4gIC8vIG5ldmVyIHJlZnVzZSB0byBib290IGp1c3QgYmVjYXVzZSBhIFVJIGhvc3QgaXNuJ3QgbGl2ZS4gUm91dGVzIHRoYXQgbmVlZCBhXG4gIC8vIHJlYWwgb3JpZ2luIChwYXltZW50IGNhbGxiYWNrIHJlZGlyZWN0cykgZmFsbCBiYWNrIHRvIHRoZSBiYWNrZW5kIFVSTC5cbiAgRlJPTlRFTkRfVVJMX0RFVjogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBGUk9OVEVORF9VUkxfUFJPRDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuXG4gIERBVEFCQVNFX1VSTDogei5zdHJpbmcoKS5taW4oMSwgXCJEQVRBQkFTRV9VUkwgaXMgcmVxdWlyZWRcIiksXG5cbiAgQkNSWVBUX1NBTFRfUk9VTkRTOiB6LnN0cmluZygpLmRlZmF1bHQoXCIxMFwiKSxcblxuICAvLyBPcHRpb25hbCBhZG1pbiBjcmVkZW50aWFscyB1c2VkIGJ5IHRoZSBzZWVkIHNjcmlwdCAoU3RlcCAxMykuIEZhbGxzIGJhY2tcbiAgLy8gdG8gZGVtby1hZG1pbkB0cmlwdmVyc2UuY29tIC8gZGVtbzEyMyB3aGVuIHVuc2V0LlxuICBBRE1JTl9FTUFJTDogei5zdHJpbmcoKS5lbWFpbCgpLm9wdGlvbmFsKCksXG4gIEFETUlOX1BBU1NXT1JEOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxuXG4gIC8vIFNTTENvbW1lcnogKFN0ZXAgMTYpIFx1MjAxNCBzYW5kYm94IHN0b3JlIGNyZWRzIHVudGlsIGdvLWxpdmUuIFNTTF9DT01NRVJaX1NBTkRCT1hcbiAgLy8gcGlja3MgdGhlIHNhbmRib3ggdnMgbGl2ZSBBUEkgYmFzZSBVUkwuIE9wdGlvbmFsIHNvIHRoZSBBUEkgYm9vdHMgKGhlYWx0aCxcbiAgLy8gYXV0aCwgY2F0YWxvZywgZXRjLikgZXZlbiB3aGVuIHRoZSBwYXltZW50IHN0b3JlIGlzbid0IGNvbmZpZ3VyZWQgeWV0IFx1MjAxNCB0aGVcbiAgLy8gcGF5bWVudCBlbmRwb2ludHMgdGhlbiBmYWlsIHdpdGggYSBjbGVhbiBcIm5vdCBjb25maWd1cmVkXCIgZXJyb3IgaW5zdGVhZCBvZlxuICAvLyB0YWtpbmcgdGhlIHdob2xlIGRlcGxveW1lbnQgZG93bi5cbiAgU1NMX0NPTU1FUlpfU1RPUkVfSUQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU1NMX0NPTU1FUlpfU0FOREJPWDogei5zdHJpbmcoKS5kZWZhdWx0KFwidHJ1ZVwiKSxcbiAgLy8gT3B0aW9uYWwgZXhwbGljaXQgZ2F0ZXdheS92YWxpZGF0b3IgYmFzZSBVUkxzIChHZWFyVXAgcGF0dGVybikuIERlZmF1bHRzIGFyZVxuICAvLyBkZXJpdmVkIGZyb20gU1NMX0NPTU1FUlpfU0FOREJPWCB3aGVuIGFic2VudC5cbiAgU1NMQ09NTUVSWl9JTklUX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBTU0xDT01NRVJaX1ZBTElEQVRFX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBTU0xDT01NRVJaX1JFRlVORF9VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICAvLyBQdWJsaWNseSByZWFjaGFibGUgYmFzZSBVUkwgdGhlIHBheW1lbnQgbW9kdWxlIHVzZXMgdG8gYnVpbGQgdGhlXG4gIC8vIFNTTENvbW1lcnogc3VjY2Vzcy9mYWlsL2NhbmNlbC9JUE4gY2FsbGJhY2sgVVJMcy4gTXVzdCBOT1QgYmUgbG9jYWxob3N0IGluXG4gIC8vIHNhbmRib3ggXHUyMDE0IHRoZSBnYXRld2F5IFBPU1RzIHRvIHRoZXNlIHNlcnZlci10by1zZXJ2ZXIuIE9wdGlvbmFsIGxpa2UgdGhlXG4gIC8vIHN0b3JlIGNyZWRzIGFib3ZlIChwYXltZW50LW9ubHkpLlxuICBCQUNLRU5EX1BVQkxJQ19VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICBKV1RfQUNDRVNTX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJKV1RfQUNDRVNTX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX1JFRlJFU0hfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkpXVF9SRUZSRVNIX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX0FDQ0VTU19FWFBJUkVTX0lOOiB6LnN0cmluZygpLmRlZmF1bHQoXCIxZFwiKSxcbiAgSldUX1JFRlJFU0hfRVhQSVJFU19JTjogei5zdHJpbmcoKS5kZWZhdWx0KFwiMzBkXCIpLFxuXG4gIC8vIEdvb2dsZSBPQXV0aCBpcyBvcHRpb25hbCBcdTIwMTQgc2VydmVyIGJvb3RzIHdpdGhvdXQgaXQ7IC9hcGkvYXV0aC9nb29nbGVcbiAgLy8gcmV0dXJucyBhIGNsZWFuIDQwMCB1bnRpbCBHT09HTEVfQ0xJRU5UX0lEIGlzIGNvbmZpZ3VyZWQuXG4gIEdPT0dMRV9DTElFTlRfSUQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcblxuICAvLyBCZXN0LWVmZm9ydCBjb250YWN0IGVtYWlscyAoUmVzZW5kKSBcdTIwMTQgYWx3YXlzIG9wdGlvbmFsOyBzdWJtaXNzaW9uc1xuICAvLyBzdWNjZWVkIGFuZCBlbWFpbHMgYmVjb21lIG5vLW9wcyB3aGVuIHRoZXNlIGFyZSBtaXNzaW5nLlxuICBSRVNFTkRfQVBJX0tFWTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBDT05UQUNUX1JFQ0VJVkVSX0VNQUlMOiB6LnN0cmluZygpLmVtYWlsKCkub3B0aW9uYWwoKSxcbiAgRU1BSUxfRlJPTTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIC8vIEVtYWlsIHZlcmlmaWNhdGlvbiArIHBhc3N3b3JkIHJlc2V0IChTdGVwIDIxKSBcdTIwMTQgUmVkaXMgT1RQIHN0b3JlICsgTm9kZW1haWxlci5cbiAgLy8gQWxsIG9wdGlvbmFsIHNvIHRoZSBhcHAgYm9vdHMgd2l0aG91dCB0aGVtIChlLmcuIFZlcmNlbCBwcm9kKTsgdGhlIGF1dGhcbiAgLy8gZW5kcG9pbnRzIHRoZW4gcmVzcG9uZCB3aXRoIGEgY2xlYW4gNTAzIFwibm90IGNvbmZpZ3VyZWRcIiBpbnN0ZWFkIG9mIGNyYXNoaW5nLlxuICBSRURJU19VU0VSOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFJFRElTX1BBU1NXT1JEOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFJFRElTX0hPU1Q6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgUkVESVNfUE9SVDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTTVRQX1VTRVI6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU01UUF9QQVNTV09SRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIENMT1VESU5BUllfQ0xPVURfTkFNRTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0NMT1VEX05BTUUgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX0tFWTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9LRVkgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9TRUNSRVQgaXMgcmVxdWlyZWRcIiksXG59KTtcblxuY29uc3QgcGFyc2VkID0gZW52U2NoZW1hLnNhZmVQYXJzZShwcm9jZXNzLmVudik7XG5cbmlmICghcGFyc2VkLnN1Y2Nlc3MpIHtcbiAgY29uc29sZS5lcnJvcihcIlx1Mjc0QyBJbnZhbGlkIGVudmlyb25tZW50IHZhcmlhYmxlczpcIik7XG4gIGNvbnNvbGUuZXJyb3IocGFyc2VkLmVycm9yLmZsYXR0ZW4oKS5maWVsZEVycm9ycyk7XG4gIHByb2Nlc3MuZXhpdCgxKTtcbn1cblxuY29uc3QgZW52ID0gcGFyc2VkLmRhdGE7XG5cbmNvbnN0IGNvbmZpZyA9IHtcbiAgcG9ydDogZW52LlBPUlQsXG4gIG5vZGVfZW52OiBlbnYuTk9ERV9FTlYsXG5cbiAgLy8gRnJvbnRlbmQgb3JpZ2lucyBmb3IgQ09SUyArIHBheW1lbnQgcmVkaXJlY3RzLiBMb2NhbGhvc3QgYWx3YXlzIHdpbnMgZm9yXG4gIC8vIGxvY2FsIHRlc3Rpbmc7IHByb2R1Y3Rpb24gdXNlcyB0aGUgVmVyY2VsIGZyb250ZW5kIFVSTCwgZmFsbGluZyBiYWNrIHRvIHRoZVxuICAvLyBiYWNrZW5kIFVSTCBzbyB0aGUgQVBJIHN0YXlzIHJlYWNoYWJsZSBldmVuIGJlZm9yZSB0aGUgVUkgaXMgZGVwbG95ZWQuXG4gIGZyb250ZW5kX3VybF9kZXY6IGVudi5GUk9OVEVORF9VUkxfREVWIHx8IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gIGZyb250ZW5kX3VybF9wcm9kOlxuICAgIGVudi5GUk9OVEVORF9VUkxfUFJPRCB8fCBlbnYuQkFDS0VORF9QVUJMSUNfVVJMIHx8IFwiXCIsXG5cbiAgZGF0YWJhc2VfdXJsOiBlbnYuREFUQUJBU0VfVVJMLFxuXG4gIGJjcnlwdF9zYWx0X3JvdW5kczogZW52LkJDUllQVF9TQUxUX1JPVU5EUyxcblxuICBhZG1pbl9lbWFpbDogZW52LkFETUlOX0VNQUlMLFxuICBhZG1pbl9wYXNzd29yZDogZW52LkFETUlOX1BBU1NXT1JELFxuXG4gIHNzbF9jb21tZXJ6X3N0b3JlX2lkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfSUQsXG4gIHNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQsXG4gIHNzbF9jb21tZXJ6X3NhbmRib3g6IGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIixcbiAgLy8gc2FuZGJveCBiYXNlIFVSTHMgKGZhbGxiYWNrIHdoZW4gdGhlIGV4cGxpY2l0IG92ZXJyaWRlIHZhcnMgYXJlIGFic2VudClcbiAgc3NsY29tbWVyel9pbml0X3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9JTklUX1VSTCA/P1xuICAgIChlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCJcbiAgICAgID8gXCJodHRwczovL3NhbmRib3guc3NsY29tbWVyei5jb20vZ3dwcm9jZXNzL3Y0L2FwaS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL2d3cHJvY2Vzcy92NC9hcGkucGhwXCIpLFxuICBzc2xjb21tZXJ6X3ZhbGlkYXRlX3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9WQUxJREFURV9VUkwgPz9cbiAgICAoZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiXG4gICAgICA/IFwiaHR0cHM6Ly9zYW5kYm94LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIiksXG4gIHNzbGNvbW1lcnpfcmVmdW5kX3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9SRUZVTkRfVVJMID8/XG4gICAgKGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIlxuICAgICAgPyBcImh0dHBzOi8vc2FuZGJveC5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL21lcmNoYW50VHJhbnNJRHZhbGlkYXRpb25BUEkucGhwXCJcbiAgICAgIDogXCJodHRwczovL3NlY3VyZXBheS5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL21lcmNoYW50VHJhbnNJRHZhbGlkYXRpb25BUEkucGhwXCIpLFxuICBiYWNrZW5kX3B1YmxpY191cmw6IGVudi5CQUNLRU5EX1BVQkxJQ19VUkwsXG5cbiAgand0X2FjY2Vzc19zZWNyZXQ6IGVudi5KV1RfQUNDRVNTX1NFQ1JFVCxcbiAgand0X3JlZnJlc2hfc2VjcmV0OiBlbnYuSldUX1JFRlJFU0hfU0VDUkVULFxuICBqd3RfYWNjZXNzX2V4cGlyZXNfaW46IGVudi5KV1RfQUNDRVNTX0VYUElSRVNfSU4sXG4gIGp3dF9yZWZyZXNoX2V4cGlyZXNfaW46IGVudi5KV1RfUkVGUkVTSF9FWFBJUkVTX0lOLFxuXG4gIGdvb2dsZV9jbGllbnRfaWQ6IGVudi5HT09HTEVfQ0xJRU5UX0lELFxuXG4gIHJlc2VuZF9hcGlfa2V5OiBlbnYuUkVTRU5EX0FQSV9LRVksXG4gIGNvbnRhY3RfcmVjZWl2ZXJfZW1haWw6IGVudi5DT05UQUNUX1JFQ0VJVkVSX0VNQUlMLFxuICBlbWFpbF9mcm9tOiBlbnYuRU1BSUxfRlJPTSxcblxuICAvLyBFbWFpbCB2ZXJpZmljYXRpb24gKyBwYXNzd29yZCByZXNldCAoU3RlcCAyMSlcbiAgcmVkaXNfdXNlcjogZW52LlJFRElTX1VTRVIsXG4gIHJlZGlzX3Bhc3N3b3JkOiBlbnYuUkVESVNfUEFTU1dPUkQsXG4gIHJlZGlzX2hvc3Q6IGVudi5SRURJU19IT1NULFxuICByZWRpc19wb3J0OiBlbnYuUkVESVNfUE9SVCxcbiAgc210cF91c2VyOiBlbnYuU01UUF9VU0VSLFxuICBzbXRwX3Bhc3N3b3JkOiBlbnYuU01UUF9QQVNTV09SRCxcblxuICBjbG91ZGluYXJ5X2Nsb3VkX25hbWU6IGVudi5DTE9VRElOQVJZX0NMT1VEX05BTUUsXG4gIGNsb3VkaW5hcnlfYXBpX2tleTogZW52LkNMT1VESU5BUllfQVBJX0tFWSxcbiAgY2xvdWRpbmFyeV9hcGlfc2VjcmV0OiBlbnYuQ0xPVURJTkFSWV9BUElfU0VDUkVULFxufTtcblxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgImltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuY29uc3Qgbm90Rm91bmRIYW5kbGVyID0gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkgPT4ge1xuICByZXMuc3RhdHVzKDQwNCkuanNvbih7XG4gICAgc3VjY2VzczogZmFsc2UsXG4gICAgc3RhdHVzQ29kZTogNDA0LFxuICAgIG1lc3NhZ2U6IFwiUm91dGUgbm90IGZvdW5kXCIsXG4gICAgcGF0aDogcmVxLm9yaWdpbmFsVXJsLFxuICAgIGRhdGU6IG5ldyBEYXRlKCksXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgbm90Rm91bmRIYW5kbGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgbXVsdGVyIGZyb20gXCJtdWx0ZXJcIjtcbmltcG9ydCB7IFpvZEVycm9yIH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbmNvbnN0IGdsb2JhbEVycm9ySGFuZGxlciA9IChcbiAgZXJyOiBhbnksXG4gIHJlcTogUmVxdWVzdCxcbiAgcmVzOiBSZXNwb25zZSxcbiAgbmV4dDogTmV4dEZ1bmN0aW9uLFxuKSA9PiB7XG4gIGlmIChjb25maWcubm9kZV9lbnYgIT09IFwicHJvZHVjdGlvblwiKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yOlwiLCBlcnIpO1xuICB9XG5cbiAgLy8gZGVmYXVsdCBmYWxsYmFja1xuICBsZXQgc3RhdHVzQ29kZTogbnVtYmVyID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gIGxldCBlcnJvck1lc3NhZ2U6IHN0cmluZyA9IGVycj8ubWVzc2FnZSB8fCBcIkludGVybmFsIFNlcnZlciBFcnJvclwiO1xuICBsZXQgZXJyb3JOYW1lOiBzdHJpbmcgPSBlcnI/Lm5hbWUgfHwgXCJFcnJvclwiO1xuXG4gIC8vIFpvZCB2YWxpZGF0aW9uIGVycm9yXG4gIGlmIChlcnIgaW5zdGFuY2VvZiBab2RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5pc3N1ZXMubWFwKChpKSA9PiBpLm1lc3NhZ2UpLmpvaW4oXCIsIFwiKTtcbiAgICBlcnJvck5hbWUgPSBcIlpvZEVycm9yXCI7XG4gIH1cblxuICAvLyBNdWx0ZXIgZmlsZSB1cGxvYWQgZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgbXVsdGVyLk11bHRlckVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JOYW1lID0gXCJNdWx0ZXJFcnJvclwiO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBlcnIuY29kZSA9PT0gXCJMSU1JVF9GSUxFX1NJWkVcIlxuICAgICAgICA/IFwiRmlsZSB0b28gbGFyZ2UuIE1heGltdW0gc2l6ZSBpcyA1TUIuXCJcbiAgICAgICAgOiBgVXBsb2FkIGZhaWxlZDogJHtlcnIuY29kZX1gO1xuICB9XG5cbiAgLy8gQ3VzdG9tIGZpbGUgdHlwZSByZWplY3Rpb24gZnJvbSB0aGUgbXVsdGVyIGZpbGVGaWx0ZXJcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgKGVyciBhcyBhbnkpLmNvZGUgPT09IFwiSU5WQUxJRF9GSUxFX1RZUEVcIikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICB9XG5cbiAgLy8gUHJpc21hIHZhbGlkYXRpb24gZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBcIllvdSBoYXZlIHByb3ZpZGVkIGluY29ycmVjdCBmaWVsZCB0eXBlIG9yIG1pc3NpbmcgcmVxdWlyZWQgZmllbGRzXCI7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3JcIjtcbiAgfVxuXG4gIC8vIFByaXNtYSBrbm93biBlcnJvcnNcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yKSB7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclwiO1xuXG4gICAgaWYgKGVyci5jb2RlID09PSBcIlAyMDAyXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkNPTkZMSUNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJUaGlzIHZhbHVlIGFscmVhZHkgZXhpc3RzXCI7XG4gICAgfSBlbHNlIGlmIChlcnIuY29kZSA9PT0gXCJQMjAwM1wiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5DT05GTElDVDtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiRm9yZWlnbiBrZXkgY29uc3RyYWludCBmYWlsZWRcIjtcbiAgICB9IGVsc2UgaWYgKGVyci5jb2RlID09PSBcIlAyMDI1XCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLk5PVF9GT1VORDtcbiAgICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICAgIFwiQW4gb3BlcmF0aW9uIGZhaWxlZCBiZWNhdXNlIG9uZSBvciBtb3JlIHJlcXVpcmVkIHJlY29yZHMgd2VyZSBub3QgZm91bmQuXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIERCIGNvbm5lY3Rpb24vaW5pdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvcikge1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclwiO1xuXG4gICAgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDBcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuVU5BVVRIT1JJWkVEO1xuICAgICAgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgXCJBdXRoZW50aWNhdGlvbiBmYWlsZWQgYWdhaW5zdCB0aGUgZGF0YWJhc2Ugc2VydmVyLiBQbGVhc2UgY2hlY2sgeW91ciBkYXRhYmFzZSBjcmVkZW50aWFscy5cIjtcbiAgICB9IGVsc2UgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDFcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuU0VSVklDRV9VTkFWQUlMQUJMRTtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiQ2FuJ3QgcmVhY2ggdGhlIGRhdGFiYXNlIHNlcnZlci5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIHVua25vd24gcmVxdWVzdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3JcIjtcbiAgICBlcnJvck1lc3NhZ2UgPSBcIkVycm9yIG9jY3VycmVkIGR1cmluZyBxdWVyeSBleGVjdXRpb25cIjtcbiAgfVxuXG4gIC8vIFlvdXIgY3VzdG9tIEFwcEVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEFwcEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGVyci5zdGF0dXNDb2RlO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIGVycm9yTmFtZSA9IGVyci5uYW1lIHx8IFwiQXBwRXJyb3JcIjtcbiAgfVxuXG4gIC8vIEZhbGxiYWNrIGZvciBvdGhlciB0aHJvd24gZXJyb3JzXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCI7XG4gICAgZXJyb3JOYW1lID0gZXJyLm5hbWUgfHwgXCJFcnJvclwiO1xuICB9XG5cbiAgcmVzLnN0YXR1cyhzdGF0dXNDb2RlKS5qc29uKHtcbiAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICBzdGF0dXNDb2RlLFxuICAgIG5hbWU6IGVycm9yTmFtZSxcbiAgICBtZXNzYWdlOiBlcnJvck1lc3NhZ2UsXG4gICAgZXJyb3I6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcImRldmVsb3BtZW50XCIgPyBlcnIuc3RhY2sgOiB1bmRlZmluZWQsXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZ2xvYmFsRXJyb3JIYW5kbGVyO1xuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogVGhpcyBmaWxlIHNob3VsZCBiZSB5b3VyIG1haW4gaW1wb3J0IHRvIHVzZSBQcmlzbWEuIFRocm91Z2ggaXQgeW91IGdldCBhY2Nlc3MgdG8gYWxsIHRoZSBtb2RlbHMsIGVudW1zLCBhbmQgaW5wdXQgdHlwZXMuXG4gKiBJZiB5b3UncmUgbG9va2luZyBmb3Igc29tZXRoaW5nIHlvdSBjYW4gaW1wb3J0IGluIHRoZSBjbGllbnQtc2lkZSBvZiB5b3VyIGFwcGxpY2F0aW9uLCBwbGVhc2UgcmVmZXIgdG8gdGhlIGBicm93c2VyLnRzYCBmaWxlIGluc3RlYWQuXG4gKlxuICogXHVEODNEXHVERkUyIFlvdSBjYW4gaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseS5cbiAqL1xuXG5pbXBvcnQgKiBhcyBwcm9jZXNzIGZyb20gJ25vZGU6cHJvY2VzcydcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJ1xuZ2xvYmFsVGhpc1snX19kaXJuYW1lJ10gPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKVxuXG5pbXBvcnQgKiBhcyBydW50aW1lIGZyb20gXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL2NsaWVudFwiXG5pbXBvcnQgKiBhcyAkRW51bXMgZnJvbSBcIi4vZW51bXNcIlxuaW1wb3J0ICogYXMgJENsYXNzIGZyb20gXCIuL2ludGVybmFsL2NsYXNzXCJcbmltcG9ydCAqIGFzIFByaXNtYSBmcm9tIFwiLi9pbnRlcm5hbC9wcmlzbWFOYW1lc3BhY2VcIlxuXG5leHBvcnQgKiBhcyAkRW51bXMgZnJvbSAnLi9lbnVtcydcbmV4cG9ydCAqIGZyb20gXCIuL2VudW1zXCJcbi8qKlxuICogIyMgUHJpc21hIENsaWVudFxuICogXG4gKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gKiB9KVxuICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dDb21tZW50c1xuICogY29uc3QgYmxvZ0NvbW1lbnRzID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KClcbiAqIGBgYFxuICogXG4gKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICovXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50ID0gJENsYXNzLmdldFByaXNtYUNsaWVudENsYXNzKClcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudDxMb2dPcHRzIGV4dGVuZHMgUHJpc21hLkxvZ0xldmVsID0gbmV2ZXIsIE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdLCBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncz4gPSAkQ2xhc3MuUHJpc21hQ2xpZW50PExvZ09wdHMsIE9taXRPcHRzLCBFeHRBcmdzPlxuZXhwb3J0IHsgUHJpc21hIH1cblxuLyoqXG4gKiBNb2RlbCBCbG9nQ29tbWVudFxuICogXG4gKi9cbmV4cG9ydCB0eXBlIEJsb2dDb21tZW50ID0gUHJpc21hLkJsb2dDb21tZW50TW9kZWxcbi8qKlxuICogTW9kZWwgQmxvZ1Bvc3RcbiAqIFxuICovXG5leHBvcnQgdHlwZSBCbG9nUG9zdCA9IFByaXNtYS5CbG9nUG9zdE1vZGVsXG4vKipcbiAqIE1vZGVsIEJvb2tpbmdcbiAqIFxuICovXG5leHBvcnQgdHlwZSBCb29raW5nID0gUHJpc21hLkJvb2tpbmdNb2RlbFxuLyoqXG4gKiBNb2RlbCBDYXRlZ29yeVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIENhdGVnb3J5ID0gUHJpc21hLkNhdGVnb3J5TW9kZWxcbi8qKlxuICogTW9kZWwgQ29udGFjdE1lc3NhZ2VcbiAqIFxuICovXG5leHBvcnQgdHlwZSBDb250YWN0TWVzc2FnZSA9IFByaXNtYS5Db250YWN0TWVzc2FnZU1vZGVsXG4vKipcbiAqIE1vZGVsIE5vdGlmaWNhdGlvblxuICogXG4gKi9cbmV4cG9ydCB0eXBlIE5vdGlmaWNhdGlvbiA9IFByaXNtYS5Ob3RpZmljYXRpb25Nb2RlbFxuLyoqXG4gKiBNb2RlbCBQYXltZW50XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUGF5bWVudCA9IFByaXNtYS5QYXltZW50TW9kZWxcbi8qKlxuICogTW9kZWwgUmVmcmVzaFRva2VuXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUmVmcmVzaFRva2VuID0gUHJpc21hLlJlZnJlc2hUb2tlbk1vZGVsXG4vKipcbiAqIE1vZGVsIFJldmlld1xuICogXG4gKi9cbmV4cG9ydCB0eXBlIFJldmlldyA9IFByaXNtYS5SZXZpZXdNb2RlbFxuLyoqXG4gKiBNb2RlbCBUb3VyUGFja2FnZVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFRvdXJQYWNrYWdlID0gUHJpc21hLlRvdXJQYWNrYWdlTW9kZWxcbi8qKlxuICogTW9kZWwgVXNlclxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFVzZXIgPSBQcmlzbWEuVXNlck1vZGVsXG4vKipcbiAqIE1vZGVsIFdpc2hsaXN0SXRlbVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFdpc2hsaXN0SXRlbSA9IFByaXNtYS5XaXNobGlzdEl0ZW1Nb2RlbFxuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogV0FSTklORzogVGhpcyBpcyBhbiBpbnRlcm5hbCBmaWxlIHRoYXQgaXMgc3ViamVjdCB0byBjaGFuZ2UhXG4gKlxuICogXHVEODNEXHVERUQxIFVuZGVyIG5vIGNpcmN1bXN0YW5jZXMgc2hvdWxkIHlvdSBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5ISBcdUQ4M0RcdURFRDFcbiAqXG4gKiBQbGVhc2UgaW1wb3J0IHRoZSBgUHJpc21hQ2xpZW50YCBjbGFzcyBmcm9tIHRoZSBgY2xpZW50LnRzYCBmaWxlIGluc3RlYWQuXG4gKi9cblxuaW1wb3J0ICogYXMgcnVudGltZSBmcm9tIFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9jbGllbnRcIlxuaW1wb3J0IHR5cGUgKiBhcyBQcmlzbWEgZnJvbSBcIi4vcHJpc21hTmFtZXNwYWNlXCJcblxuXG5jb25zdCBjb25maWc6IHJ1bnRpbWUuR2V0UHJpc21hQ2xpZW50Q29uZmlnID0ge1xuICBcInByZXZpZXdGZWF0dXJlc1wiOiBbXSxcbiAgXCJjbGllbnRWZXJzaW9uXCI6IFwiNy45LjFcIixcbiAgXCJlbmdpbmVWZXJzaW9uXCI6IFwiZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFwiLFxuICBcImFjdGl2ZVByb3ZpZGVyXCI6IFwicG9zdGdyZXNxbFwiLFxuICBcImlubGluZVNjaGVtYVwiOiBcIm1vZGVsIEJsb2dDb21tZW50IHtcXG4gIGlkICAgICAgICBTdHJpbmcgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBjb250ZW50ICAgU3RyaW5nICBAZGIuVGV4dFxcbiAgaXNEZWxldGVkIEJvb2xlYW4gQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBwb3N0SWQgICBTdHJpbmdcXG4gIHVzZXJJZCAgIFN0cmluZ1xcbiAgcGFyZW50SWQgU3RyaW5nP1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBvc3QgICAgQmxvZ1Bvc3QgICAgICBAcmVsYXRpb24oXFxcIlBvc3RDb21tZW50c1xcXCIsIGZpZWxkczogW3Bvc3RJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICB1c2VyICAgIFVzZXIgICAgICAgICAgQHJlbGF0aW9uKFxcXCJVc2VyQ29tbWVudHNcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFyZW50ICBCbG9nQ29tbWVudD8gIEByZWxhdGlvbihcXFwiQ29tbWVudFJlcGxpZXNcXFwiLCBmaWVsZHM6IFtwYXJlbnRJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICByZXBsaWVzIEJsb2dDb21tZW50W10gQHJlbGF0aW9uKFxcXCJDb21tZW50UmVwbGllc1xcXCIpXFxuXFxuICBAQGluZGV4KFtwb3N0SWQsIGlzRGVsZXRlZCwgY3JlYXRlZEF0XSlcXG4gIEBAaW5kZXgoW3BhcmVudElkXSlcXG4gIEBAbWFwKFxcXCJibG9nX2NvbW1lbnRzXFxcIilcXG59XFxuXFxubW9kZWwgQmxvZ1Bvc3Qge1xcbiAgaWQgICAgICAgICBTdHJpbmcgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0aXRsZSAgICAgIFN0cmluZ1xcbiAgc2x1ZyAgICAgICBTdHJpbmcgICAgIEB1bmlxdWVcXG4gIGV4Y2VycHQgICAgU3RyaW5nXFxuICBjb250ZW50ICAgIFN0cmluZ1xcbiAgY292ZXJJbWFnZSBTdHJpbmdcXG4gIHN0YXR1cyAgICAgUG9zdFN0YXR1cyBAZGVmYXVsdChEUkFGVClcXG4gIGlzRGVsZXRlZCAgQm9vbGVhbiAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGF1dGhvcklkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGF1dGhvciAgIFVzZXIgICAgICAgICAgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIsIGZpZWxkczogW2F1dGhvcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGNvbW1lbnRzIEJsb2dDb21tZW50W10gQHJlbGF0aW9uKFxcXCJQb3N0Q29tbWVudHNcXFwiKVxcblxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAaW5kZXgoW2F1dGhvcklkXSlcXG4gIEBAbWFwKFxcXCJibG9nX3Bvc3RzXFxcIilcXG59XFxuXFxubW9kZWwgQm9va2luZyB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRyYXZlbERhdGUgRGF0ZVRpbWVcXG4gIHRyYXZlbGVycyAgSW50XFxuICB0b3RhbFByaWNlIERlY2ltYWwgICAgICAgQGRiLkRlY2ltYWwoMTAsIDIpXFxuICBzdGF0dXMgICAgIEJvb2tpbmdTdGF0dXMgQGRlZmF1bHQoUEVORElORylcXG5cXG4gIHVzZXJJZCAgICBTdHJpbmdcXG4gIHBhY2thZ2VJZCBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICB1c2VyICAgICBVc2VyICAgICAgICBAcmVsYXRpb24oXFxcIkN1c3RvbWVyQm9va2luZ3NcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSAgVG91clBhY2thZ2UgQHJlbGF0aW9uKGZpZWxkczogW3BhY2thZ2VJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYXltZW50cyBQYXltZW50W11cXG5cXG4gIEBAaW5kZXgoW3VzZXJJZF0pXFxuICBAQGluZGV4KFtwYWNrYWdlSWRdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAaW5kZXgoW3VzZXJJZCwgcGFja2FnZUlkLCB0cmF2ZWxEYXRlXSlcXG4gIEBAbWFwKFxcXCJib29raW5nc1xcXCIpXFxufVxcblxcbm1vZGVsIENhdGVnb3J5IHtcXG4gIGlkICAgU3RyaW5nIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lIFN0cmluZyBAdW5pcXVlXFxuICBzbHVnIFN0cmluZyBAdW5pcXVlXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgcGFja2FnZXMgVG91clBhY2thZ2VbXVxcblxcbiAgQEBtYXAoXFxcImNhdGVnb3JpZXNcXFwiKVxcbn1cXG5cXG5tb2RlbCBDb250YWN0TWVzc2FnZSB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIG5hbWUgICAgICAgU3RyaW5nXFxuICBlbWFpbCAgICAgIFN0cmluZ1xcbiAgc3ViamVjdCAgICBTdHJpbmdcXG4gIG1lc3NhZ2UgICAgU3RyaW5nXFxuICBpc1Jlc29sdmVkIEJvb2xlYW4gQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgQEBpbmRleChbaXNSZXNvbHZlZF0pXFxuICBAQG1hcChcXFwiY29udGFjdF9tZXNzYWdlc1xcXCIpXFxufVxcblxcbmVudW0gUm9sZSB7XFxuICBVU0VSXFxuICBBR0VOVFxcbiAgQURNSU5cXG59XFxuXFxuZW51bSBVc2VyU3RhdHVzIHtcXG4gIEFDVElWRVxcbiAgU1VTUEVOREVEXFxufVxcblxcbmVudW0gQXV0aFByb3ZpZGVyIHtcXG4gIENSRURFTlRJQUxcXG4gIEdPT0dMRVxcbn1cXG5cXG5lbnVtIFBhY2thZ2VTdGF0dXMge1xcbiAgUEVORElOR1xcbiAgQVBQUk9WRURcXG4gIFJFSkVDVEVEXFxufVxcblxcbmVudW0gQm9va2luZ1N0YXR1cyB7XFxuICBQRU5ESU5HXFxuICBQQUlEXFxuICBDT05GSVJNRURcXG4gIENBTkNFTExFRFxcbiAgQ09NUExFVEVEXFxufVxcblxcbmVudW0gUGF5bWVudFN0YXR1cyB7XFxuICBJTklUSUFURURcXG4gIFNVQ0NFU1NcXG4gIEZBSUxFRFxcbiAgQ0FOQ0VMTEVEXFxuICBSRUZVTkRFRFxcbn1cXG5cXG5lbnVtIFBvc3RTdGF0dXMge1xcbiAgRFJBRlRcXG4gIFBVQkxJU0hFRFxcbn1cXG5cXG5lbnVtIE5vdGlmaWNhdGlvblR5cGUge1xcbiAgQk9PS0lOR19DUkVBVEVEXFxuICBCT09LSU5HX0NPTkZJUk1FRFxcbiAgQk9PS0lOR19DQU5DRUxMRURcXG4gIFBBQ0tBR0VfQVBQUk9WRURcXG4gIFBBQ0tBR0VfUkVKRUNURURcXG59XFxuXFxubW9kZWwgTm90aWZpY2F0aW9uIHtcXG4gIGlkICAgICAgU3RyaW5nICAgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdXNlcklkICBTdHJpbmdcXG4gIHR5cGUgICAgTm90aWZpY2F0aW9uVHlwZVxcbiAgdGl0bGUgICBTdHJpbmdcXG4gIG1lc3NhZ2UgU3RyaW5nXFxuICBsaW5rICAgIFN0cmluZz9cXG4gIGlzUmVhZCAgQm9vbGVhbiAgICAgICAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG5cXG4gIHVzZXIgVXNlciBAcmVsYXRpb24oZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW3VzZXJJZCwgaXNSZWFkLCBjcmVhdGVkQXRdKVxcbiAgQEBtYXAoXFxcIm5vdGlmaWNhdGlvbnNcXFwiKVxcbn1cXG5cXG5tb2RlbCBQYXltZW50IHtcXG4gIGlkICAgICAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIGJvb2tpbmdJZCAgICAgIFN0cmluZ1xcbiAgdHJhbklkICAgICAgICAgU3RyaW5nICAgICAgICBAdW5pcXVlIC8vIFNTTENvbW1lcnogdHJhbnNhY3Rpb24gaWQsIGdlbmVyYXRlZCBzZXJ2ZXItc2lkZVxcbiAgdmFsSWQgICAgICAgICAgU3RyaW5nPyAvLyBzZXQgYWZ0ZXIgZ2F0ZXdheSBzdWNjZXNzLCB1c2VkIGZvciBzZXJ2ZXItc2lkZSB2YWxpZGF0aW9uXFxuICBhbW91bnQgICAgICAgICBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKSAvLyA9IGJvb2tpbmcudG90YWxQcmljZSBhdCBzZXNzaW9uIGNyZWF0aW9uXFxuICBjdXJyZW5jeSAgICAgICBTdHJpbmcgICAgICAgIEBkZWZhdWx0KFxcXCJCRFRcXFwiKVxcbiAgc3RhdHVzICAgICAgICAgUGF5bWVudFN0YXR1cyBAZGVmYXVsdChJTklUSUFURUQpXFxuICBnYXRld2F5UGFnZVVybCBTdHJpbmc/XFxuICBzc2xTZXNzaW9uS2V5ICBTdHJpbmc/XFxuICBjYXJkVHlwZSAgICAgICBTdHJpbmc/XFxuICBiYW5rVHJhbklkICAgICBTdHJpbmc/XFxuICBwYWlkQXQgICAgICAgICBEYXRlVGltZT9cXG4gIHJlZnVuZFJlZklkICAgIFN0cmluZz8gLy8gU1NMQ29tbWVyeiByZWZ1bmQgcmVmZXJlbmNlIChzZXQgd2hlbiBhIHJlZnVuZCBpcyBpbml0aWF0ZWQpXFxuICByZWZ1bmRlZEF0ICAgICBEYXRlVGltZT8gLy8gd2hlbiB0aGUgcmVmdW5kIHdhcyBpbml0aWF0ZWQvc2V0dGxlZFxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGJvb2tpbmcgQm9va2luZyBAcmVsYXRpb24oZmllbGRzOiBbYm9va2luZ0lkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW2Jvb2tpbmdJZF0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInBheW1lbnRzXFxcIilcXG59XFxuXFxubW9kZWwgUmVmcmVzaFRva2VuIHtcXG4gIGlkICAgICAgICBTdHJpbmcgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHVzZXJJZCAgICBTdHJpbmdcXG4gIGhhc2ggICAgICBTdHJpbmcgICAgQHVuaXF1ZSAvLyBTSEEtMjU2IG9mIHRoZSByZWZyZXNoIEpXVCBcdTIwMTQgbmV2ZXIgc3RvcmUgdGhlIEpXVCBpdHNlbGZcXG4gIGV4cGlyZXNBdCBEYXRlVGltZVxcbiAgY3JlYXRlZEF0IERhdGVUaW1lICBAZGVmYXVsdChub3coKSlcXG4gIHJldm9rZWRBdCBEYXRlVGltZT8gLy8gc2V0IHdoZW4gcm90YXRlZCBvciBsb2dnZWQgb3V0XFxuXFxuICB1c2VyIFVzZXIgQHJlbGF0aW9uKGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuXFxuICBAQGluZGV4KFt1c2VySWQsIHJldm9rZWRBdF0pXFxuICBAQG1hcChcXFwicmVmcmVzaF90b2tlbnNcXFwiKVxcbn1cXG5cXG5tb2RlbCBSZXZpZXcge1xcbiAgaWQgICAgICAgIFN0cmluZyAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHJhdGluZyAgICBJbnRcXG4gIGNvbW1lbnQgICBTdHJpbmdcXG4gIGlzRGVsZXRlZCBCb29sZWFuIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgdXNlcklkICAgIFN0cmluZ1xcbiAgcGFja2FnZUlkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHVzZXIgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lclJldmlld3NcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pXFxuICBAQGluZGV4KFtwYWNrYWdlSWRdKVxcbiAgQEBtYXAoXFxcInJldmlld3NcXFwiKVxcbn1cXG5cXG4vLyBUaGlzIGlzIHlvdXIgUHJpc21hIHNjaGVtYSBmaWxlLFxcbi8vIGxlYXJuIG1vcmUgYWJvdXQgaXQgaW4gdGhlIGRvY3M6IGh0dHBzOi8vcHJpcy5seS9kL3ByaXNtYS1zY2hlbWFcXG5cXG5nZW5lcmF0b3IgY2xpZW50IHtcXG4gIHByb3ZpZGVyID0gXFxcInByaXNtYS1jbGllbnRcXFwiXFxuICBvdXRwdXQgICA9IFxcXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hXFxcIlxcbn1cXG5cXG5kYXRhc291cmNlIGRiIHtcXG4gIHByb3ZpZGVyID0gXFxcInBvc3RncmVzcWxcXFwiXFxufVxcblxcbm1vZGVsIFRvdXJQYWNrYWdlIHtcXG4gIGlkICAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRpdGxlICAgICAgIFN0cmluZ1xcbiAgc2x1ZyAgICAgICAgU3RyaW5nICAgICAgICBAdW5pcXVlXFxuICBkZXNjcmlwdGlvbiBTdHJpbmdcXG4gIGxvY2F0aW9uICAgIFN0cmluZ1xcbiAgcHJpY2UgICAgICAgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMilcXG4gIGR1cmF0aW9uICAgIEludFxcbiAgcmF0aW5nICAgICAgRmxvYXQgICAgICAgICBAZGVmYXVsdCgwKVxcbiAgaW1hZ2VzICAgICAgU3RyaW5nW11cXG4gIHN0YXR1cyAgICAgIFBhY2thZ2VTdGF0dXMgQGRlZmF1bHQoUEVORElORylcXG4gIGlzRGVsZXRlZCAgIEJvb2xlYW4gICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBjYXRlZ29yeUlkIFN0cmluZ1xcbiAgYWdlbnRJZCAgICBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBjYXRlZ29yeSAgICAgIENhdGVnb3J5ICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFtjYXRlZ29yeUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGFnZW50ICAgICAgICAgVXNlciAgICAgICAgICAgQHJlbGF0aW9uKFxcXCJBZ2VudFBhY2thZ2VzXFxcIiwgZmllbGRzOiBbYWdlbnRJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBib29raW5ncyAgICAgIEJvb2tpbmdbXVxcbiAgcmV2aWV3cyAgICAgICBSZXZpZXdbXVxcbiAgd2lzaGxpc3RJdGVtcyBXaXNobGlzdEl0ZW1bXVxcblxcbiAgQEBpbmRleChbY2F0ZWdvcnlJZF0pXFxuICBAQGluZGV4KFtjYXRlZ29yeUlkLCBwcmljZV0pXFxuICBAQGluZGV4KFtwcmljZV0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInRvdXJfcGFja2FnZXNcXFwiKVxcbn1cXG5cXG5tb2RlbCBVc2VyIHtcXG4gIGlkICAgICAgICAgICAgU3RyaW5nICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lICAgICAgICAgIFN0cmluZ1xcbiAgZW1haWwgICAgICAgICBTdHJpbmcgICAgICAgQHVuaXF1ZVxcbiAgcGFzc3dvcmQgICAgICBTdHJpbmc/XFxuICBnb29nbGVJZCAgICAgIFN0cmluZz8gICAgICBAdW5pcXVlXFxuICBwaG9uZSAgICAgICAgIFN0cmluZz9cXG4gIGF2YXRhclVybCAgICAgU3RyaW5nP1xcbiAgcm9sZSAgICAgICAgICBSb2xlICAgICAgICAgQGRlZmF1bHQoVVNFUilcXG4gIHN0YXR1cyAgICAgICAgVXNlclN0YXR1cyAgIEBkZWZhdWx0KEFDVElWRSlcXG4gIGF1dGhQcm92aWRlciAgQXV0aFByb3ZpZGVyIEBkZWZhdWx0KENSRURFTlRJQUwpXFxuICBlbWFpbFZlcmlmaWVkIEJvb2xlYW4gICAgICBAZGVmYXVsdChmYWxzZSlcXG4gIGlzRGVsZXRlZCAgICAgQm9vbGVhbiAgICAgIEBkZWZhdWx0KGZhbHNlKVxcbiAgdG9rZW5WZXJzaW9uICBJbnQgICAgICAgICAgQGRlZmF1bHQoMClcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBwYWNrYWdlcyAgICAgIFRvdXJQYWNrYWdlW10gIEByZWxhdGlvbihcXFwiQWdlbnRQYWNrYWdlc1xcXCIpXFxuICBib29raW5ncyAgICAgIEJvb2tpbmdbXSAgICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCIpXFxuICByZXZpZXdzICAgICAgIFJldmlld1tdICAgICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIilcXG4gIHBvc3RzICAgICAgICAgQmxvZ1Bvc3RbXSAgICAgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIpXFxuICB3aXNobGlzdCAgICAgIFdpc2hsaXN0SXRlbVtdXFxuICBub3RpZmljYXRpb25zIE5vdGlmaWNhdGlvbltdXFxuICBjb21tZW50cyAgICAgIEJsb2dDb21tZW50W10gIEByZWxhdGlvbihcXFwiVXNlckNvbW1lbnRzXFxcIilcXG4gIHJlZnJlc2hUb2tlbnMgUmVmcmVzaFRva2VuW11cXG5cXG4gIEBAaW5kZXgoW3JvbGVdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAbWFwKFxcXCJ1c2Vyc1xcXCIpXFxufVxcblxcbm1vZGVsIFdpc2hsaXN0SXRlbSB7XFxuICBpZCAgICAgICAgU3RyaW5nIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuXFxuICB1c2VyICAgIFVzZXIgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pXFxuICBAQGluZGV4KFt1c2VySWQsIGNyZWF0ZWRBdF0pXFxuICBAQG1hcChcXFwid2lzaGxpc3RfaXRlbXNcXFwiKVxcbn1cXG5cIixcbiAgXCJydW50aW1lRGF0YU1vZGVsXCI6IHtcbiAgICBcIm1vZGVsc1wiOiB7fSxcbiAgICBcImVudW1zXCI6IHt9LFxuICAgIFwidHlwZXNcIjoge31cbiAgfSxcbiAgXCJwYXJhbWV0ZXJpemF0aW9uU2NoZW1hXCI6IHtcbiAgICBcInN0cmluZ3NcIjogW10sXG4gICAgXCJncmFwaFwiOiBcIlwiXG4gIH1cbn1cblxuY29uZmlnLnJ1bnRpbWVEYXRhTW9kZWwgPSBKU09OLnBhcnNlKFwie1xcXCJtb2RlbHNcXFwiOntcXFwiQmxvZ0NvbW1lbnRcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNvbnRlbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBvc3RJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXJlbnRJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwb3N0XFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCbG9nUG9zdFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlBvc3RDb21tZW50c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJVc2VyQ29tbWVudHNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXJlbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ29tbWVudFJlcGxpZXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyZXBsaWVzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCbG9nQ29tbWVudFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkNvbW1lbnRSZXBsaWVzXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJibG9nX2NvbW1lbnRzXFxcIn0sXFxcIkJsb2dQb3N0XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0aXRsZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZXhjZXJwdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29udGVudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY292ZXJJbWFnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUG9zdFN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhvcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhvclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkF1dGhvclBvc3RzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29tbWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUG9zdENvbW1lbnRzXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJibG9nX3Bvc3RzXFxcIn0sXFxcIkJvb2tpbmdcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRyYXZlbERhdGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhdmVsZXJzXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0b3RhbFByaWNlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEZWNpbWFsXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1N0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lckJvb2tpbmdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBheW1lbnRzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYXltZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvUGF5bWVudFxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwifSxcXFwiQ2F0ZWdvcnlcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNsdWdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ2F0ZWdvcnlUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJjYXRlZ29yaWVzXFxcIn0sXFxcIkNvbnRhY3RNZXNzYWdlXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJuYW1lXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJlbWFpbFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3ViamVjdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibWVzc2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNSZXNvbHZlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJjb250YWN0X21lc3NhZ2VzXFxcIn0sXFxcIk5vdGlmaWNhdGlvblxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0eXBlXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiTm90aWZpY2F0aW9uVHlwZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRpdGxlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJtZXNzYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJsaW5rXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc1JlYWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIk5vdGlmaWNhdGlvblRvVXNlclxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwibm90aWZpY2F0aW9uc1xcXCJ9LFxcXCJQYXltZW50XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRyYW5JZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidmFsSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImFtb3VudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImN1cnJlbmN5XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYXltZW50U3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNzbFNlc3Npb25LZXlcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNhcmRUeXBlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJiYW5rVHJhbklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWlkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmdW5kUmVmSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJlZnVuZGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvUGF5bWVudFxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwicGF5bWVudHNcXFwifSxcXFwiUmVmcmVzaFRva2VuXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImhhc2hcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImV4cGlyZXNBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2b2tlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZWZyZXNoVG9rZW5Ub1VzZXJcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInJlZnJlc2hfdG9rZW5zXFxcIn0sXFxcIlJldmlld1xcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmF0aW5nXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb21tZW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZXZpZXdUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJyZXZpZXdzXFxcIn0sXFxcIlRvdXJQYWNrYWdlXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0aXRsZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZGVzY3JpcHRpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImxvY2F0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwcmljZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImR1cmF0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyYXRpbmdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkZsb2F0XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaW1hZ2VzXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYWNrYWdlU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2F0ZWdvcnlJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYWdlbnRJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjYXRlZ29yeVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQ2F0ZWdvcnlcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDYXRlZ29yeVRvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhZ2VudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkFnZW50UGFja2FnZXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmV2aWV3VG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIndpc2hsaXN0SXRlbXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIldpc2hsaXN0SXRlbVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlRvdXJQYWNrYWdlVG9XaXNobGlzdEl0ZW1cXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInRvdXJfcGFja2FnZXNcXFwifSxcXFwiVXNlclxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhc3N3b3JkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJnb29nbGVJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGhvbmVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF2YXRhclVybFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicm9sZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlJvbGVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aFByb3ZpZGVyXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQXV0aFByb3ZpZGVyXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxWZXJpZmllZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRva2VuVmVyc2lvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBZ2VudFBhY2thZ2VzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lckJvb2tpbmdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicG9zdHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dQb3N0XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQXV0aG9yUG9zdHNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ3aXNobGlzdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiV2lzaGxpc3RJdGVtXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVXNlclRvV2lzaGxpc3RJdGVtXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibm90aWZpY2F0aW9uc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiTm90aWZpY2F0aW9uXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiTm90aWZpY2F0aW9uVG9Vc2VyXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29tbWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVXNlckNvbW1lbnRzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmcmVzaFRva2Vuc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmVmcmVzaFRva2VuXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmVmcmVzaFRva2VuVG9Vc2VyXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJ1c2Vyc1xcXCJ9LFxcXCJXaXNobGlzdEl0ZW1cXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlVzZXJUb1dpc2hsaXN0SXRlbVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVG91clBhY2thZ2VUb1dpc2hsaXN0SXRlbVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwid2lzaGxpc3RfaXRlbXNcXFwifX0sXFxcImVudW1zXFxcIjp7fSxcXFwidHlwZXNcXFwiOnt9fVwiKVxuY29uZmlnLnBhcmFtZXRlcml6YXRpb25TY2hlbWEgPSB7XG4gIHN0cmluZ3M6IEpTT04ucGFyc2UoXCJbXFxcIndoZXJlXFxcIixcXFwib3JkZXJCeVxcXCIsXFxcImN1cnNvclxcXCIsXFxcInBhY2thZ2VzXFxcIixcXFwiX2NvdW50XFxcIixcXFwiY2F0ZWdvcnlcXFwiLFxcXCJhZ2VudFxcXCIsXFxcInVzZXJcXFwiLFxcXCJwYWNrYWdlXFxcIixcXFwiYm9va2luZ1xcXCIsXFxcInBheW1lbnRzXFxcIixcXFwiYm9va2luZ3NcXFwiLFxcXCJyZXZpZXdzXFxcIixcXFwid2lzaGxpc3RJdGVtc1xcXCIsXFxcInBvc3RzXFxcIixcXFwid2lzaGxpc3RcXFwiLFxcXCJub3RpZmljYXRpb25zXFxcIixcXFwiY29tbWVudHNcXFwiLFxcXCJyZWZyZXNoVG9rZW5zXFxcIixcXFwiYXV0aG9yXFxcIixcXFwicG9zdFxcXCIsXFxcInBhcmVudFxcXCIsXFxcInJlcGxpZXNcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kVW5pcXVlXFxcIixcXFwiQmxvZ0NvbW1lbnQuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kRmlyc3RcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQmxvZ0NvbW1lbnQuZmluZE1hbnlcXFwiLFxcXCJkYXRhXFxcIixcXFwiQmxvZ0NvbW1lbnQuY3JlYXRlT25lXFxcIixcXFwiQmxvZ0NvbW1lbnQuY3JlYXRlTWFueVxcXCIsXFxcIkJsb2dDb21tZW50LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCbG9nQ29tbWVudC51cGRhdGVPbmVcXFwiLFxcXCJCbG9nQ29tbWVudC51cGRhdGVNYW55XFxcIixcXFwiQmxvZ0NvbW1lbnQudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcImNyZWF0ZVxcXCIsXFxcInVwZGF0ZVxcXCIsXFxcIkJsb2dDb21tZW50LnVwc2VydE9uZVxcXCIsXFxcIkJsb2dDb21tZW50LmRlbGV0ZU9uZVxcXCIsXFxcIkJsb2dDb21tZW50LmRlbGV0ZU1hbnlcXFwiLFxcXCJoYXZpbmdcXFwiLFxcXCJfbWluXFxcIixcXFwiX21heFxcXCIsXFxcIkJsb2dDb21tZW50Lmdyb3VwQnlcXFwiLFxcXCJCbG9nQ29tbWVudC5hZ2dyZWdhdGVcXFwiLFxcXCJCbG9nUG9zdC5maW5kVW5pcXVlXFxcIixcXFwiQmxvZ1Bvc3QuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQmxvZ1Bvc3QuZmluZE1hbnlcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVPbmVcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVNYW55XFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU9uZVxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU1hbnlcXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQmxvZ1Bvc3QudXBzZXJ0T25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlT25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlTWFueVxcXCIsXFxcIkJsb2dQb3N0Lmdyb3VwQnlcXFwiLFxcXCJCbG9nUG9zdC5hZ2dyZWdhdGVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQm9va2luZy5maW5kRmlyc3RcXFwiLFxcXCJCb29raW5nLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJCb29raW5nLmZpbmRNYW55XFxcIixcXFwiQm9va2luZy5jcmVhdGVPbmVcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCb29raW5nLnVwZGF0ZU9uZVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJvb2tpbmcudXBzZXJ0T25lXFxcIixcXFwiQm9va2luZy5kZWxldGVPbmVcXFwiLFxcXCJCb29raW5nLmRlbGV0ZU1hbnlcXFwiLFxcXCJfYXZnXFxcIixcXFwiX3N1bVxcXCIsXFxcIkJvb2tpbmcuZ3JvdXBCeVxcXCIsXFxcIkJvb2tpbmcuYWdncmVnYXRlXFxcIixcXFwiQ2F0ZWdvcnkuZmluZFVuaXF1ZVxcXCIsXFxcIkNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNhdGVnb3J5LmZpbmRNYW55XFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlT25lXFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlTWFueVxcXCIsXFxcIkNhdGVnb3J5LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVPbmVcXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVNYW55XFxcIixcXFwiQ2F0ZWdvcnkudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNhdGVnb3J5LnVwc2VydE9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU1hbnlcXFwiLFxcXCJDYXRlZ29yeS5ncm91cEJ5XFxcIixcXFwiQ2F0ZWdvcnkuYWdncmVnYXRlXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZFVuaXF1ZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlT25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwc2VydE9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5ncm91cEJ5XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuYWdncmVnYXRlXFxcIixcXFwiTm90aWZpY2F0aW9uLmZpbmRVbmlxdWVcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZEZpcnN0XFxcIixcXFwiTm90aWZpY2F0aW9uLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZE1hbnlcXFwiLFxcXCJOb3RpZmljYXRpb24uY3JlYXRlT25lXFxcIixcXFwiTm90aWZpY2F0aW9uLmNyZWF0ZU1hbnlcXFwiLFxcXCJOb3RpZmljYXRpb24uY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIk5vdGlmaWNhdGlvbi51cGRhdGVPbmVcXFwiLFxcXCJOb3RpZmljYXRpb24udXBkYXRlTWFueVxcXCIsXFxcIk5vdGlmaWNhdGlvbi51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiTm90aWZpY2F0aW9uLnVwc2VydE9uZVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5kZWxldGVPbmVcXFwiLFxcXCJOb3RpZmljYXRpb24uZGVsZXRlTWFueVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5ncm91cEJ5XFxcIixcXFwiTm90aWZpY2F0aW9uLmFnZ3JlZ2F0ZVxcXCIsXFxcIlBheW1lbnQuZmluZFVuaXF1ZVxcXCIsXFxcIlBheW1lbnQuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJQYXltZW50LmZpbmRGaXJzdFxcXCIsXFxcIlBheW1lbnQuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlBheW1lbnQuZmluZE1hbnlcXFwiLFxcXCJQYXltZW50LmNyZWF0ZU9uZVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlTWFueVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlBheW1lbnQudXBkYXRlT25lXFxcIixcXFwiUGF5bWVudC51cGRhdGVNYW55XFxcIixcXFwiUGF5bWVudC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUGF5bWVudC51cHNlcnRPbmVcXFwiLFxcXCJQYXltZW50LmRlbGV0ZU9uZVxcXCIsXFxcIlBheW1lbnQuZGVsZXRlTWFueVxcXCIsXFxcIlBheW1lbnQuZ3JvdXBCeVxcXCIsXFxcIlBheW1lbnQuYWdncmVnYXRlXFxcIixcXFwiUmVmcmVzaFRva2VuLmZpbmRVbmlxdWVcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZEZpcnN0XFxcIixcXFwiUmVmcmVzaFRva2VuLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZE1hbnlcXFwiLFxcXCJSZWZyZXNoVG9rZW4uY3JlYXRlT25lXFxcIixcXFwiUmVmcmVzaFRva2VuLmNyZWF0ZU1hbnlcXFwiLFxcXCJSZWZyZXNoVG9rZW4uY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJlZnJlc2hUb2tlbi51cGRhdGVPbmVcXFwiLFxcXCJSZWZyZXNoVG9rZW4udXBkYXRlTWFueVxcXCIsXFxcIlJlZnJlc2hUb2tlbi51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUmVmcmVzaFRva2VuLnVwc2VydE9uZVxcXCIsXFxcIlJlZnJlc2hUb2tlbi5kZWxldGVPbmVcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZGVsZXRlTWFueVxcXCIsXFxcIlJlZnJlc2hUb2tlbi5ncm91cEJ5XFxcIixcXFwiUmVmcmVzaFRva2VuLmFnZ3JlZ2F0ZVxcXCIsXFxcIlJldmlldy5maW5kVW5pcXVlXFxcIixcXFwiUmV2aWV3LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRGaXJzdFxcXCIsXFxcIlJldmlldy5maW5kRmlyc3RPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU9uZVxcXCIsXFxcIlJldmlldy5jcmVhdGVNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJSZXZpZXcudXBkYXRlT25lXFxcIixcXFwiUmV2aWV3LnVwZGF0ZU1hbnlcXFwiLFxcXCJSZXZpZXcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJldmlldy51cHNlcnRPbmVcXFwiLFxcXCJSZXZpZXcuZGVsZXRlT25lXFxcIixcXFwiUmV2aWV3LmRlbGV0ZU1hbnlcXFwiLFxcXCJSZXZpZXcuZ3JvdXBCeVxcXCIsXFxcIlJldmlldy5hZ2dyZWdhdGVcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kVW5pcXVlXFxcIixcXFwiVG91clBhY2thZ2UuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiVG91clBhY2thZ2UuZmluZE1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVNYW55XFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVG91clBhY2thZ2UudXBzZXJ0T25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlT25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLmdyb3VwQnlcXFwiLFxcXCJUb3VyUGFja2FnZS5hZ2dyZWdhdGVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiVXNlci5maW5kRmlyc3RcXFwiLFxcXCJVc2VyLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJVc2VyLmZpbmRNYW55XFxcIixcXFwiVXNlci5jcmVhdGVPbmVcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJVc2VyLnVwZGF0ZU9uZVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlVzZXIudXBzZXJ0T25lXFxcIixcXFwiVXNlci5kZWxldGVPbmVcXFwiLFxcXCJVc2VyLmRlbGV0ZU1hbnlcXFwiLFxcXCJVc2VyLmdyb3VwQnlcXFwiLFxcXCJVc2VyLmFnZ3JlZ2F0ZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kVW5pcXVlXFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRGaXJzdFxcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLmNyZWF0ZU9uZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5jcmVhdGVNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJXaXNobGlzdEl0ZW0udXBkYXRlT25lXFxcIixcXFwiV2lzaGxpc3RJdGVtLnVwZGF0ZU1hbnlcXFwiLFxcXCJXaXNobGlzdEl0ZW0udXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIldpc2hsaXN0SXRlbS51cHNlcnRPbmVcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZGVsZXRlT25lXFxcIixcXFwiV2lzaGxpc3RJdGVtLmRlbGV0ZU1hbnlcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZ3JvdXBCeVxcXCIsXFxcIldpc2hsaXN0SXRlbS5hZ2dyZWdhdGVcXFwiLFxcXCJBTkRcXFwiLFxcXCJPUlxcXCIsXFxcIk5PVFxcXCIsXFxcImlkXFxcIixcXFwidXNlcklkXFxcIixcXFwicGFja2FnZUlkXFxcIixcXFwiY3JlYXRlZEF0XFxcIixcXFwiZXF1YWxzXFxcIixcXFwiaW5cXFwiLFxcXCJub3RJblxcXCIsXFxcImx0XFxcIixcXFwibHRlXFxcIixcXFwiZ3RcXFwiLFxcXCJndGVcXFwiLFxcXCJub3RcXFwiLFxcXCJjb250YWluc1xcXCIsXFxcInN0YXJ0c1dpdGhcXFwiLFxcXCJlbmRzV2l0aFxcXCIsXFxcIm5hbWVcXFwiLFxcXCJlbWFpbFxcXCIsXFxcInBhc3N3b3JkXFxcIixcXFwiZ29vZ2xlSWRcXFwiLFxcXCJwaG9uZVxcXCIsXFxcImF2YXRhclVybFxcXCIsXFxcIlJvbGVcXFwiLFxcXCJyb2xlXFxcIixcXFwiVXNlclN0YXR1c1xcXCIsXFxcInN0YXR1c1xcXCIsXFxcIkF1dGhQcm92aWRlclxcXCIsXFxcImF1dGhQcm92aWRlclxcXCIsXFxcImVtYWlsVmVyaWZpZWRcXFwiLFxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJ0b2tlblZlcnNpb25cXFwiLFxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJldmVyeVxcXCIsXFxcInNvbWVcXFwiLFxcXCJub25lXFxcIixcXFwidGl0bGVcXFwiLFxcXCJzbHVnXFxcIixcXFwiZGVzY3JpcHRpb25cXFwiLFxcXCJsb2NhdGlvblxcXCIsXFxcInByaWNlXFxcIixcXFwiZHVyYXRpb25cXFwiLFxcXCJyYXRpbmdcXFwiLFxcXCJpbWFnZXNcXFwiLFxcXCJQYWNrYWdlU3RhdHVzXFxcIixcXFwiY2F0ZWdvcnlJZFxcXCIsXFxcImFnZW50SWRcXFwiLFxcXCJoYXNcXFwiLFxcXCJoYXNFdmVyeVxcXCIsXFxcImhhc1NvbWVcXFwiLFxcXCJjb21tZW50XFxcIixcXFwiaGFzaFxcXCIsXFxcImV4cGlyZXNBdFxcXCIsXFxcInJldm9rZWRBdFxcXCIsXFxcImJvb2tpbmdJZFxcXCIsXFxcInRyYW5JZFxcXCIsXFxcInZhbElkXFxcIixcXFwiYW1vdW50XFxcIixcXFwiY3VycmVuY3lcXFwiLFxcXCJQYXltZW50U3RhdHVzXFxcIixcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJzc2xTZXNzaW9uS2V5XFxcIixcXFwiY2FyZFR5cGVcXFwiLFxcXCJiYW5rVHJhbklkXFxcIixcXFwicGFpZEF0XFxcIixcXFwicmVmdW5kUmVmSWRcXFwiLFxcXCJyZWZ1bmRlZEF0XFxcIixcXFwiTm90aWZpY2F0aW9uVHlwZVxcXCIsXFxcInR5cGVcXFwiLFxcXCJtZXNzYWdlXFxcIixcXFwibGlua1xcXCIsXFxcImlzUmVhZFxcXCIsXFxcInN1YmplY3RcXFwiLFxcXCJpc1Jlc29sdmVkXFxcIixcXFwidHJhdmVsRGF0ZVxcXCIsXFxcInRyYXZlbGVyc1xcXCIsXFxcInRvdGFsUHJpY2VcXFwiLFxcXCJCb29raW5nU3RhdHVzXFxcIixcXFwiZXhjZXJwdFxcXCIsXFxcImNvbnRlbnRcXFwiLFxcXCJjb3ZlckltYWdlXFxcIixcXFwiUG9zdFN0YXR1c1xcXCIsXFxcImF1dGhvcklkXFxcIixcXFwicG9zdElkXFxcIixcXFwicGFyZW50SWRcXFwiLFxcXCJ1c2VySWRfcGFja2FnZUlkXFxcIixcXFwiaXNcXFwiLFxcXCJpc05vdFxcXCIsXFxcImNvbm5lY3RPckNyZWF0ZVxcXCIsXFxcInVwc2VydFxcXCIsXFxcImNyZWF0ZU1hbnlcXFwiLFxcXCJzZXRcXFwiLFxcXCJkaXNjb25uZWN0XFxcIixcXFwiZGVsZXRlXFxcIixcXFwiY29ubmVjdFxcXCIsXFxcInVwZGF0ZU1hbnlcXFwiLFxcXCJkZWxldGVNYW55XFxcIixcXFwicHVzaFxcXCIsXFxcImluY3JlbWVudFxcXCIsXFxcImRlY3JlbWVudFxcXCIsXFxcIm11bHRpcGx5XFxcIixcXFwiZGl2aWRlXFxcIl1cIiksXG4gIGdyYXBoOiBcIndBWnh3QUVQQndBQW9RTUFJQlFBQUtNREFDQVZBQUNrQXdBZ0ZnQUEtUUlBSU44QkFBQ2lBd0F3NEFFQUFDZ0FFT0VCQUFDaUF3QXc0Z0VCQUFBQUFlTUJBUURyQWdBaDVRRkFBUElDQUNILUFTQUE4QUlBSVlBQ1FBRHlBZ0FocndJQkFPc0NBQ0d6QWdFQTZ3SUFJYlFDQVFEc0FnQWhBUUFBQUFFQUlCY0ZBQUM0QXdBZ0JnQUFvUU1BSUFzQUFQUUNBQ0FNQUFEMUFnQWdEUUFBOXdJQUlOOEJBQUMxQXdBdzRBRUFBQU1BRU9FQkFBQzFBd0F3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDM0E0MENJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUURyQWdBaGhnSUJBT3NDQUNHSEFnRUE2d0lBSVlnQ0VBQ3ZBd0FoaVFJQ0FQRUNBQ0dLQWdnQXRnTUFJWXNDQUFELUFnQWdqUUlCQU9zQ0FDR09BZ0VBNndJQUlRVUZBQURtQlFBZ0JnQUE0QVVBSUFzQUFKNEZBQ0FNQUFDZkJRQWdEUUFBb1FVQUlCY0ZBQUM0QXdBZ0JnQUFvUU1BSUFzQUFQUUNBQ0FNQUFEMUFnQWdEUUFBOXdJQUlOOEJBQUMxQXdBdzRBRUFBQU1BRU9FQkFBQzFBd0F3NGdFQkFBQUFBZVVCUUFEeUFnQWgtZ0VBQUxjRGpRSWlfZ0VnQVBBQ0FDR0FBa0FBOGdJQUlZUUNBUURyQWdBaGhRSUJBQUFBQVlZQ0FRRHJBZ0FoaHdJQkFPc0NBQ0dJQWhBQXJ3TUFJWWtDQWdEeEFnQWhpZ0lJQUxZREFDR0xBZ0FBX2dJQUlJMENBUURyQWdBaGpnSUJBT3NDQUNFREFBQUFBd0FnQVFBQUJBQXdBZ0FBQlFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlBRUFBQUFEQUNBUEJ3QUFvUU1BSUFnQUFLc0RBQ0FLQUFDMEF3QWczd0VBQUxJREFERGdBUUFBQ1FBUTRRRUFBTElEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDekE2NENJb0FDUUFEeUFnQWhxZ0pBQVBJQ0FDR3JBZ0lBOFFJQUlhd0NFQUN2QXdBaEF3Y0FBT0FGQUNBSUFBRGpCUUFnQ2dBQTVRVUFJQThIQUFDaEF3QWdDQUFBcXdNQUlBb0FBTFFEQUNEZkFRQUFzZ01BTU9BQkFBQUpBQkRoQVFBQXNnTUFNT0lCQVFBQUFBSGpBUUVBNndJQUllUUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFzd091QWlLQUFrQUE4Z0lBSWFvQ1FBRHlBZ0FocXdJQ0FQRUNBQ0dzQWhBQXJ3TUFJUU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FVQ1FBQXNRTUFJTjhCQUFDdUF3QXc0QUVBQUEwQUVPRUJBQUN1QXdBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ3dBNXdDSW9BQ1FBRHlBZ0FobGdJQkFPc0NBQ0dYQWdFQTZ3SUFJWmdDQVFEc0FnQWhtUUlRQUs4REFDR2FBZ0VBNndJQUlad0NBUURzQWdBaG5RSUJBT3dDQUNHZUFnRUE3QUlBSVo4Q0FRRHNBZ0Fob0FKQUFLQURBQ0doQWdFQTdBSUFJYUlDUUFDZ0F3QWhDUWtBQU9RRkFDQ1lBZ0FBd2dNQUlKd0NBQURDQXdBZ25RSUFBTUlEQUNDZUFnQUF3Z01BSUo4Q0FBRENBd0Fnb0FJQUFNSURBQ0NoQWdBQXdnTUFJS0lDQUFEQ0F3QWdGQWtBQUxFREFDRGZBUUFBcmdNQU1PQUJBQUFOQUJEaEFRQUFyZ01BTU9JQkFRQUFBQUhsQVVBQThnSUFJZm9CQUFDd0E1d0NJb0FDUUFEeUFnQWhsZ0lCQU9zQ0FDR1hBZ0VBQUFBQm1BSUJBT3dDQUNHWkFoQUFyd01BSVpvQ0FRRHJBZ0FobkFJQkFPd0NBQ0dkQWdFQTdBSUFJWjRDQVFEc0FnQWhud0lCQU93Q0FDR2dBa0FBb0FNQUlhRUNBUURzQWdBaG9nSkFBS0FEQUNFREFBQUFEUUFnQVFBQURnQXdBZ0FBRHdBZ0FRQUFBQTBBSUEwSEFBQ2hBd0FnQ0FBQXF3TUFJTjhCQUFDdEF3QXc0QUVBQUJJQUVPRUJBQUN0QXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVRQkFRRHJBZ0FoNVFGQUFQSUNBQ0gtQVNBQThBSUFJWUFDUUFEeUFnQWhpZ0lDQVBFQ0FDR1NBZ0VBNndJQUlRSUhBQURnQlFBZ0NBQUE0d1VBSUE0SEFBQ2hBd0FnQ0FBQXF3TUFJTjhCQUFDdEF3QXc0QUVBQUJJQUVPRUJBQUN0QXdBdzRnRUJBQUFBQWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0tBZ0lBOFFJQUlaSUNBUURyQWdBaHRRSUFBS3dEQUNBREFBQUFFZ0FnQVFBQUV3QXdBZ0FBRkFBZ0NRY0FBS0VEQUNBSUFBQ3JBd0FnM3dFQUFLb0RBRERnQVFBQUZnQVE0UUVBQUtvREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSVFJSEFBRGdCUUFnQ0FBQTR3VUFJQW9IQUFDaEF3QWdDQUFBcXdNQUlOOEJBQUNxQXdBdzRBRUFBQllBRU9FQkFBQ3FBd0F3NGdFQkFBQUFBZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUliVUNBQUNwQXdBZ0F3QUFBQllBSUFFQUFCY0FNQUlBQUJnQUlBRUFBQUFKQUNBQkFBQUFFZ0FnQVFBQUFCWUFJQU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnRUJFQUFQa0NBQ0FUQUFDaEF3QWczd0VBQUtjREFERGdBUUFBSHdBUTRRRUFBS2NEQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFLZ0RzZ0lpX2dFZ0FQQUNBQ0dBQWtBQThnSUFJWVFDQVFEckFnQWhoUUlCQU9zQ0FDR3VBZ0VBNndJQUlhOENBUURyQWdBaHNBSUJBT3NDQUNHeUFnRUE2d0lBSVFJUkFBQ2pCUUFnRXdBQTRBVUFJQkFSQUFENUFnQWdFd0FBb1FNQUlOOEJBQUNuQXdBdzRBRUFBQjhBRU9FQkFBQ25Bd0F3NGdFQkFBQUFBZVVCUUFEeUFnQWgtZ0VBQUtnRHNnSWlfZ0VnQVBBQ0FDR0FBa0FBOGdJQUlZUUNBUURyQWdBaGhRSUJBQUFBQWE0Q0FRRHJBZ0FocndJQkFPc0NBQ0d3QWdFQTZ3SUFJYklDQVFEckFnQWhBd0FBQUI4QUlBRUFBQ0FBTUFJQUFDRUFJQU1BQUFBV0FDQUJBQUFYQURBQ0FBQVlBQ0FNQndBQW9RTUFJTjhCQUFDbEF3QXc0QUVBQUNRQUVPRUJBQUNsQXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVVQlFBRHlBZ0FoaEFJQkFPc0NBQ0drQWdBQXBnT2tBaUtsQWdFQTZ3SUFJYVlDQVFEc0FnQWhwd0lnQVBBQ0FDRUNCd0FBNEFVQUlLWUNBQURDQXdBZ0RBY0FBS0VEQUNEZkFRQUFwUU1BTU9BQkFBQWtBQkRoQVFBQXBRTUFNT0lCQVFBQUFBSGpBUUVBNndJQUllVUJRQUR5QWdBaGhBSUJBT3NDQUNHa0FnQUFwZ09rQWlLbEFnRUE2d0lBSWFZQ0FRRHNBZ0FocHdJZ0FQQUNBQ0VEQUFBQUpBQWdBUUFBSlFBd0FnQUFKZ0FnRHdjQUFLRURBQ0FVQUFDakF3QWdGUUFBcEFNQUlCWUFBUGtDQUNEZkFRQUFvZ01BTU9BQkFBQW9BQkRoQVFBQW9nTUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlmNEJJQUR3QWdBaGdBSkFBUElDQUNHdkFnRUE2d0lBSWJNQ0FRRHJBZ0FodEFJQkFPd0NBQ0VGQndBQTRBVUFJQlFBQU9FRkFDQVZBQURpQlFBZ0ZnQUFvd1VBSUxRQ0FBRENBd0FnQXdBQUFDZ0FJQUVBQUNrQU1BSUFBQUVBSUFvSEFBQ2hBd0FnM3dFQUFKOERBRERnQVFBQUt3QVE0UUVBQUo4REFERGlBUUVBNndJQUllTUJBUURyQWdBaDVRRkFBUElDQUNHVEFnRUE2d0lBSVpRQ1FBRHlBZ0FobFFKQUFLQURBQ0VDQndBQTRBVUFJSlVDQUFEQ0F3QWdDZ2NBQUtFREFDRGZBUUFBbndNQU1PQUJBQUFyQUJEaEFRQUFud01BTU9JQkFRQUFBQUhqQVFFQTZ3SUFJZVVCUUFEeUFnQWhrd0lCQUFBQUFaUUNRQUR5QWdBaGxRSkFBS0FEQUNFREFBQUFLd0FnQVFBQUxBQXdBZ0FBTFFBZ0FRQUFBQU1BSUFFQUFBQUpBQ0FCQUFBQUVnQWdBUUFBQUI4QUlBRUFBQUFXQUNBQkFBQUFKQUFnQVFBQUFDZ0FJQUVBQUFBckFDQURBQUFBS0FBZ0FRQUFLUUF3QWdBQUFRQWdBUUFBQUNnQUlBRUFBQUFvQUNBREFBQUFLQUFnQVFBQUtRQXdBZ0FBQVFBZ0FRQUFBQ2dBSUFFQUFBQUJBQ0FEQUFBQUtBQWdBUUFBS1FBd0FnQUFBUUFnQXdBQUFDZ0FJQUVBQUNrQU1BSUFBQUVBSUFNQUFBQW9BQ0FCQUFBcEFEQUNBQUFCQUNBTUJ3QUFfQU1BSUJRQUFQc0RBQ0FWQUFEX0F3QWdGZ0FBX1FNQUlPSUJBUUFBQUFIakFRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQnJ3SUJBQUFBQWJNQ0FRQUFBQUcwQWdFQUFBQUJBUndBQUVBQUlBamlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFhOENBUUFBQUFHekFnRUFBQUFCdEFJQkFBQUFBUUVjQUFCQ0FEQUJIQUFBUWdBd0FRQUFBQ2dBSUF3SEFBRDVBd0FnRkFBQTdnTUFJQlVBQU84REFDQVdBQUR3QXdBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJYThDQVFDOEF3QWhzd0lCQUx3REFDRzBBZ0VBeUFNQUlRSUFBQUFCQUNBY0FBQkdBQ0FJNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUlhOENBUUM4QXdBaHN3SUJBTHdEQUNHMEFnRUF5QU1BSVFJQUFBQW9BQ0FjQUFCSUFDQUNBQUFBS0FBZ0hBQUFTQUFnQVFBQUFDZ0FJQU1BQUFBQkFDQWpBQUJBQUNBa0FBQkdBQ0FCQUFBQUFRQWdBUUFBQUNnQUlBUUVBQURkQlFBZ0tRQUEzd1VBSUNvQUFONEZBQ0MwQWdBQXdnTUFJQXZmQVFBQW5nTUFNT0FCQUFCUUFCRGhBUUFBbmdNQU1PSUJBUURQQWdBaDR3RUJBTThDQUNIbEFVQUEwQUlBSWY0QklBRGJBZ0FoZ0FKQUFOQUNBQ0d2QWdFQXp3SUFJYk1DQVFEUEFnQWh0QUlCQU5jQ0FDRURBQUFBS0FBZ0FRQUFUd0F3S0FBQVVBQWdBd0FBQUNnQUlBRUFBQ2tBTUFJQUFBRUFJQUVBQUFBaEFDQUJBQUFBSVFBZ0F3QUFBQjhBSUFFQUFDQUFNQUlBQUNFQUlBTUFBQUFmQUNBQkFBQWdBREFDQUFBaEFDQURBQUFBSHdBZ0FRQUFJQUF3QWdBQUlRQWdEUkVBQUxBRUFDQVRBQURjQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFMSUNBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUd1QWdFQUFBQUJyd0lCQUFBQUFiQUNBUUFBQUFHeUFnRUFBQUFCQVJ3QUFGZ0FJQXZpQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBc2dJQ19nRWdBQUFBQVlBQ1FBQUFBQUdFQWdFQUFBQUJoUUlCQUFBQUFhNENBUUFBQUFHdkFnRUFBQUFCc0FJQkFBQUFBYklDQVFBQUFBRUJIQUFBV2dBd0FSd0FBRm9BTUEwUkFBQ2xCQUFnRXdBQTJ3VUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBb3dTeUFpTC1BU0FBekFNQUlZQUNRQUM5QXdBaGhBSUJBTHdEQUNHRkFnRUF2QU1BSWE0Q0FRQzhBd0FocndJQkFMd0RBQ0d3QWdFQXZBTUFJYklDQVFDOEF3QWhBZ0FBQUNFQUlCd0FBRjBBSUF2aUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFLTUVzZ0lpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR3VBZ0VBdkFNQUlhOENBUUM4QXdBaHNBSUJBTHdEQUNHeUFnRUF2QU1BSVFJQUFBQWZBQ0FjQUFCZkFDQUNBQUFBSHdBZ0hBQUFYd0FnQXdBQUFDRUFJQ01BQUZnQUlDUUFBRjBBSUFFQUFBQWhBQ0FCQUFBQUh3QWdBd1FBQU5nRkFDQXBBQURhQlFBZ0tnQUEyUVVBSUE3ZkFRQUFtZ01BTU9BQkFBQm1BQkRoQVFBQW1nTUFNT0lCQVFEUEFnQWg1UUZBQU5BQ0FDSDZBUUFBbXdPeUFpTC1BU0FBMndJQUlZQUNRQURRQWdBaGhBSUJBTThDQUNHRkFnRUF6d0lBSWE0Q0FRRFBBZ0FocndJQkFNOENBQ0d3QWdFQXp3SUFJYklDQVFEUEFnQWhBd0FBQUI4QUlBRUFBR1VBTUNnQUFHWUFJQU1BQUFBZkFDQUJBQUFnQURBQ0FBQWhBQ0FCQUFBQUN3QWdBUUFBQUFzQUlBTUFBQUFKQUNBQkFBQUtBREFDQUFBTEFDQURBQUFBQ1FBZ0FRQUFDZ0F3QWdBQUN3QWdBd0FBQUFrQUlBRUFBQW9BTUFJQUFBc0FJQXdIQUFDT0JRQWdDQUFBM0FRQUlBb0FBTjBFQUNEaUFRRUFBQUFCNHdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN1QWdLQUFrQUFBQUFCcWdKQUFBQUFBYXNDQWdBQUFBR3NBaEFBQUFBQkFSd0FBRzRBSUFuaUFRRUFBQUFCNHdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN1QWdLQUFrQUFBQUFCcWdKQUFBQUFBYXNDQWdBQUFBR3NBaEFBQUFBQkFSd0FBSEFBTUFFY0FBQndBREFNQndBQWpBVUFJQWdBQU13RUFDQUtBQUROQkFBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVRQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQXlnU3VBaUtBQWtBQXZRTUFJYW9DUUFDOUF3QWhxd0lDQU0wREFDR3NBaEFBeVFRQUlRSUFBQUFMQUNBY0FBQnpBQ0FKNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVFCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBeWdTdUFpS0FBa0FBdlFNQUlhb0NRQUM5QXdBaHF3SUNBTTBEQUNHc0FoQUF5UVFBSVFJQUFBQUpBQ0FjQUFCMUFDQUNBQUFBQ1FBZ0hBQUFkUUFnQXdBQUFBc0FJQ01BQUc0QUlDUUFBSE1BSUFFQUFBQUxBQ0FCQUFBQUNRQWdCUVFBQU5NRkFDQXBBQURXQlFBZ0tnQUExUVVBSUVzQUFOUUZBQ0JNQUFEWEJRQWdETjhCQUFDV0F3QXc0QUVBQUh3QUVPRUJBQUNXQXdBdzRnRUJBTThDQUNIakFRRUF6d0lBSWVRQkFRRFBBZ0FoNVFGQUFOQUNBQ0g2QVFBQWx3T3VBaUtBQWtBQTBBSUFJYW9DUUFEUUFnQWhxd0lDQU53Q0FDR3NBaEFBX0FJQUlRTUFBQUFKQUNBQkFBQjdBREFvQUFCOEFDQURBQUFBQ1FBZ0FRQUFDZ0F3QWdBQUN3QWdDUU1BQVBNQ0FDRGZBUUFBbFFNQU1PQUJBQUNDQVFBUTRRRUFBSlVEQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0h4QVFFQUFBQUJnQUpBQVBJQ0FDR0ZBZ0VBQUFBQkFRQUFBSDhBSUFFQUFBQl9BQ0FKQXdBQTh3SUFJTjhCQUFDVkF3QXc0QUVBQUlJQkFCRGhBUUFBbFFNQU1PSUJBUURyQWdBaDVRRkFBUElDQUNIeEFRRUE2d0lBSVlBQ1FBRHlBZ0FoaFFJQkFPc0NBQ0VCQXdBQW5RVUFJQU1BQUFDQ0FRQWdBUUFBZ3dFQU1BSUFBSDhBSUFNQUFBQ0NBUUFnQVFBQWd3RUFNQUlBQUg4QUlBTUFBQUNDQVFBZ0FRQUFnd0VBTUFJQUFIOEFJQVlEQUFEU0JRQWc0Z0VCQUFBQUFlVUJRQUFBQUFIeEFRRUFBQUFCZ0FKQUFBQUFBWVVDQVFBQUFBRUJIQUFBaHdFQUlBWGlBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUdBQWtBQUFBQUJoUUlCQUFBQUFRRWNBQUNKQVFBd0FSd0FBSWtCQURBR0F3QUF5QVVBSU9JQkFRQzhBd0FoNVFGQUFMMERBQ0h4QVFFQXZBTUFJWUFDUUFDOUF3QWhoUUlCQUx3REFDRUNBQUFBZndBZ0hBQUFqQUVBSUFYaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0dBQWtBQXZRTUFJWVVDQVFDOEF3QWhBZ0FBQUlJQkFDQWNBQUNPQVFBZ0FnQUFBSUlCQUNBY0FBQ09BUUFnQXdBQUFIOEFJQ01BQUljQkFDQWtBQUNNQVFBZ0FRQUFBSDhBSUFFQUFBQ0NBUUFnQXdRQUFNVUZBQ0FwQUFESEJRQWdLZ0FBeGdVQUlBamZBUUFBbEFNQU1PQUJBQUNWQVFBUTRRRUFBSlFEQUREaUFRRUF6d0lBSWVVQlFBRFFBZ0FoOFFFQkFNOENBQ0dBQWtBQTBBSUFJWVVDQVFEUEFnQWhBd0FBQUlJQkFDQUJBQUNVQVFBd0tBQUFsUUVBSUFNQUFBQ0NBUUFnQVFBQWd3RUFNQUlBQUg4QUlBdmZBUUFBa3dNQU1PQUJBQUNiQVFBUTRRRUFBSk1EQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0h4QVFFQTZ3SUFJZklCQVFEckFnQWhnQUpBQVBJQ0FDR2xBZ0VBNndJQUlhZ0NBUURyQWdBaHFRSWdBUEFDQUNFQkFBQUFtQUVBSUFFQUFBQ1lBUUFnQzk4QkFBQ1RBd0F3NEFFQUFKc0JBQkRoQVFBQWt3TUFNT0lCQVFEckFnQWg1UUZBQVBJQ0FDSHhBUUVBNndJQUlmSUJBUURyQWdBaGdBSkFBUElDQUNHbEFnRUE2d0lBSWFnQ0FRRHJBZ0FocVFJZ0FQQUNBQ0VBQXdBQUFKc0JBQ0FCQUFDY0FRQXdBZ0FBbUFFQUlBTUFBQUNiQVFBZ0FRQUFuQUVBTUFJQUFKZ0JBQ0FEQUFBQW13RUFJQUVBQUp3QkFEQUNBQUNZQVFBZ0NPSUJBUUFBQUFIbEFVQUFBQUFCOFFFQkFBQUFBZklCQVFBQUFBR0FBa0FBQUFBQnBRSUJBQUFBQWFnQ0FRQUFBQUdwQWlBQUFBQUJBUndBQUtBQkFDQUk0Z0VCQUFBQUFlVUJRQUFBQUFIeEFRRUFBQUFCOGdFQkFBQUFBWUFDUUFBQUFBR2xBZ0VBQUFBQnFBSUJBQUFBQWFrQ0lBQUFBQUVCSEFBQW9nRUFNQUVjQUFDaUFRQXdDT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaGdBSkFBTDBEQUNHbEFnRUF2QU1BSWFnQ0FRQzhBd0FocVFJZ0FNd0RBQ0VDQUFBQW1BRUFJQndBQUtVQkFDQUk0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNHQUFrQUF2UU1BSWFVQ0FRQzhBd0FocUFJQkFMd0RBQ0dwQWlBQXpBTUFJUUlBQUFDYkFRQWdIQUFBcHdFQUlBSUFBQUNiQVFBZ0hBQUFwd0VBSUFNQUFBQ1lBUUFnSXdBQW9BRUFJQ1FBQUtVQkFDQUJBQUFBbUFFQUlBRUFBQUNiQVFBZ0F3UUFBTUlGQUNBcEFBREVCUUFnS2dBQXd3VUFJQXZmQVFBQWtnTUFNT0FCQUFDdUFRQVE0UUVBQUpJREFERGlBUUVBendJQUllVUJRQURRQWdBaDhRRUJBTThDQUNIeUFRRUF6d0lBSVlBQ1FBRFFBZ0FocFFJQkFNOENBQ0dvQWdFQXp3SUFJYWtDSUFEYkFnQWhBd0FBQUpzQkFDQUJBQUN0QVFBd0tBQUFyZ0VBSUFNQUFBQ2JBUUFnQVFBQW5BRUFNQUlBQUpnQkFDQUJBQUFBSmdBZ0FRQUFBQ1lBSUFNQUFBQWtBQ0FCQUFBbEFEQUNBQUFtQUNBREFBQUFKQUFnQVFBQUpRQXdBZ0FBSmdBZ0F3QUFBQ1FBSUFFQUFDVUFNQUlBQUNZQUlBa0hBQURCQlFBZzRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJoQUlCQUFBQUFhUUNBQUFBcEFJQ3BRSUJBQUFBQWFZQ0FRQUFBQUduQWlBQUFBQUJBUndBQUxZQkFDQUk0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCaEFJQkFBQUFBYVFDQUFBQXBBSUNwUUlCQUFBQUFhWUNBUUFBQUFHbkFpQUFBQUFCQVJ3QUFMZ0JBREFCSEFBQXVBRUFNQWtIQUFEQUJRQWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaGhBSUJBTHdEQUNHa0FnQUFpZ1NrQWlLbEFnRUF2QU1BSWFZQ0FRRElBd0FocHdJZ0FNd0RBQ0VDQUFBQUpnQWdIQUFBdXdFQUlBamlBUUVBdkFNQUllTUJBUUM4QXdBaDVRRkFBTDBEQUNHRUFnRUF2QU1BSWFRQ0FBQ0tCS1FDSXFVQ0FRQzhBd0FocGdJQkFNZ0RBQ0duQWlBQXpBTUFJUUlBQUFBa0FDQWNBQUM5QVFBZ0FnQUFBQ1FBSUJ3QUFMMEJBQ0FEQUFBQUpnQWdJd0FBdGdFQUlDUUFBTHNCQUNBQkFBQUFKZ0FnQVFBQUFDUUFJQVFFQUFDOUJRQWdLUUFBdndVQUlDb0FBTDRGQUNDbUFnQUF3Z01BSUF2ZkFRQUFqZ01BTU9BQkFBREVBUUFRNFFFQUFJNERBRERpQVFFQXp3SUFJZU1CQVFEUEFnQWg1UUZBQU5BQ0FDR0VBZ0VBendJQUlhUUNBQUNQQTZRQ0lxVUNBUURQQWdBaHBnSUJBTmNDQUNHbkFpQUEyd0lBSVFNQUFBQWtBQ0FCQUFEREFRQXdLQUFBeEFFQUlBTUFBQUFrQUNBQkFBQWxBREFDQUFBbUFDQUJBQUFBRHdBZ0FRQUFBQThBSUFNQUFBQU5BQ0FCQUFBT0FEQUNBQUFQQUNBREFBQUFEUUFnQVFBQURnQXdBZ0FBRHdBZ0F3QUFBQTBBSUFFQUFBNEFNQUlBQUE4QUlCRUpBQUM4QlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFKd0NBb0FDUUFBQUFBR1dBZ0VBQUFBQmx3SUJBQUFBQVpnQ0FRQUFBQUdaQWhBQUFBQUJtZ0lCQUFBQUFad0NBUUFBQUFHZEFnRUFBQUFCbmdJQkFBQUFBWjhDQVFBQUFBR2dBa0FBQUFBQm9RSUJBQUFBQWFJQ1FBQUFBQUVCSEFBQXpBRUFJQkRpQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBbkFJQ2dBSkFBQUFBQVpZQ0FRQUFBQUdYQWdFQUFBQUJtQUlCQUFBQUFaa0NFQUFBQUFHYUFnRUFBQUFCbkFJQkFBQUFBWjBDQVFBQUFBR2VBZ0VBQUFBQm53SUJBQUFBQWFBQ1FBQUFBQUdoQWdFQUFBQUJvZ0pBQUFBQUFRRWNBQURPQVFBd0FSd0FBTTRCQURBUkNRQUF1d1VBSU9JQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTJBU2NBaUtBQWtBQXZRTUFJWllDQVFDOEF3QWhsd0lCQUx3REFDR1lBZ0VBeUFNQUlaa0NFQURKQkFBaG1nSUJBTHdEQUNHY0FnRUF5QU1BSVowQ0FRRElBd0FobmdJQkFNZ0RBQ0dmQWdFQXlBTUFJYUFDUUFEZ0F3QWhvUUlCQU1nREFDR2lBa0FBNEFNQUlRSUFBQUFQQUNBY0FBRFJBUUFnRU9JQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTJBU2NBaUtBQWtBQXZRTUFJWllDQVFDOEF3QWhsd0lCQUx3REFDR1lBZ0VBeUFNQUlaa0NFQURKQkFBaG1nSUJBTHdEQUNHY0FnRUF5QU1BSVowQ0FRRElBd0FobmdJQkFNZ0RBQ0dmQWdFQXlBTUFJYUFDUUFEZ0F3QWhvUUlCQU1nREFDR2lBa0FBNEFNQUlRSUFBQUFOQUNBY0FBRFRBUUFnQWdBQUFBMEFJQndBQU5NQkFDQURBQUFBRHdBZ0l3QUF6QUVBSUNRQUFORUJBQ0FCQUFBQUR3QWdBUUFBQUEwQUlBMEVBQUMyQlFBZ0tRQUF1UVVBSUNvQUFMZ0ZBQ0JMQUFDM0JRQWdUQUFBdWdVQUlKZ0NBQURDQXdBZ25BSUFBTUlEQUNDZEFnQUF3Z01BSUo0Q0FBRENBd0FnbndJQUFNSURBQ0NnQWdBQXdnTUFJS0VDQUFEQ0F3QWdvZ0lBQU1JREFDQVQzd0VBQUlvREFERGdBUUFBMmdFQUVPRUJBQUNLQXdBdzRnRUJBTThDQUNIbEFVQUEwQUlBSWZvQkFBQ0xBNXdDSW9BQ1FBRFFBZ0FobGdJQkFNOENBQ0dYQWdFQXp3SUFJWmdDQVFEWEFnQWhtUUlRQVB3Q0FDR2FBZ0VBendJQUlad0NBUURYQWdBaG5RSUJBTmNDQUNHZUFnRUExd0lBSVo4Q0FRRFhBZ0Fob0FKQUFJY0RBQ0doQWdFQTF3SUFJYUlDUUFDSEF3QWhBd0FBQUEwQUlBRUFBTmtCQURBb0FBRGFBUUFnQXdBQUFBMEFJQUVBQUE0QU1BSUFBQThBSUFFQUFBQXRBQ0FCQUFBQUxRQWdBd0FBQUNzQUlBRUFBQ3dBTUFJQUFDMEFJQU1BQUFBckFDQUJBQUFzQURBQ0FBQXRBQ0FEQUFBQUt3QWdBUUFBTEFBd0FnQUFMUUFnQndjQUFMVUZBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFHVEFnRUFBQUFCbEFKQUFBQUFBWlVDUUFBQUFBRUJIQUFBNGdFQUlBYmlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUdUQWdFQUFBQUJsQUpBQUFBQUFaVUNRQUFBQUFFQkhBQUE1QUVBTUFFY0FBRGtBUUF3QndjQUFMUUZBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDR1RBZ0VBdkFNQUlaUUNRQUM5QXdBaGxRSkFBT0FEQUNFQ0FBQUFMUUFnSEFBQTV3RUFJQWJpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDR1RBZ0VBdkFNQUlaUUNRQUM5QXdBaGxRSkFBT0FEQUNFQ0FBQUFLd0FnSEFBQTZRRUFJQUlBQUFBckFDQWNBQURwQVFBZ0F3QUFBQzBBSUNNQUFPSUJBQ0FrQUFEbkFRQWdBUUFBQUMwQUlBRUFBQUFyQUNBRUJBQUFzUVVBSUNrQUFMTUZBQ0FxQUFDeUJRQWdsUUlBQU1JREFDQUozd0VBQUlZREFERGdBUUFBOEFFQUVPRUJBQUNHQXdBdzRnRUJBTThDQUNIakFRRUF6d0lBSWVVQlFBRFFBZ0Foa3dJQkFNOENBQ0dVQWtBQTBBSUFJWlVDUUFDSEF3QWhBd0FBQUNzQUlBRUFBTzhCQURBb0FBRHdBUUFnQXdBQUFDc0FJQUVBQUN3QU1BSUFBQzBBSUFFQUFBQVVBQ0FCQUFBQUZBQWdBd0FBQUJJQUlBRUFBQk1BTUFJQUFCUUFJQU1BQUFBU0FDQUJBQUFUQURBQ0FBQVVBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnQ2djQUFJTUZBQ0FJQUFDLUJBQWc0Z0VCQUFBQUFlTUJBUUFBQUFIa0FRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQmlnSUNBQUFBQVpJQ0FRQUFBQUVCSEFBQS1BRUFJQWppQVFFQUFBQUI0d0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCX2dFZ0FBQUFBWUFDUUFBQUFBR0tBZ0lBQUFBQmtnSUJBQUFBQVFFY0FBRDZBUUF3QVJ3QUFQb0JBREFLQndBQWdRVUFJQWdBQUx3RUFDRGlBUUVBdkFNQUllTUJBUUM4QXdBaDVBRUJBTHdEQUNIbEFVQUF2UU1BSWY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dLQWdJQXpRTUFJWklDQVFDOEF3QWhBZ0FBQUJRQUlCd0FBUDBCQUNBSTRnRUJBTHdEQUNIakFRRUF2QU1BSWVRQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhpZ0lDQU0wREFDR1NBZ0VBdkFNQUlRSUFBQUFTQUNBY0FBRF9BUUFnQWdBQUFCSUFJQndBQVA4QkFDQURBQUFBRkFBZ0l3QUEtQUVBSUNRQUFQMEJBQ0FCQUFBQUZBQWdBUUFBQUJJQUlBVUVBQUNzQlFBZ0tRQUFyd1VBSUNvQUFLNEZBQ0JMQUFDdEJRQWdUQUFBc0FVQUlBdmZBUUFBaFFNQU1PQUJBQUNHQWdBUTRRRUFBSVVEQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNUFFQkFNOENBQ0hsQVVBQTBBSUFJZjRCSUFEYkFnQWhnQUpBQU5BQ0FDR0tBZ0lBM0FJQUlaSUNBUURQQWdBaEF3QUFBQklBSUFFQUFJVUNBREFvQUFDR0FnQWdBd0FBQUJJQUlBRUFBQk1BTUFJQUFCUUFJQUVBQUFBRkFDQUJBQUFBQlFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlBTUFBQUFEQUNBQkFBQUVBREFDQUFBRkFDQURBQUFBQXdBZ0FRQUFCQUF3QWdBQUJRQWdGQVVBQUpFRkFDQUdBQUNyQlFBZ0N3QUFrZ1VBSUF3QUFKTUZBQ0FOQUFDVUJRQWc0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSTBDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDRUFBQUFBR0pBZ0lBQUFBQmlnSUlBQUFBQVlzQ0FBQ1FCUUFnalFJQkFBQUFBWTRDQVFBQUFBRUJIQUFBamdJQUlBX2lBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFqUUlDX2dFZ0FBQUFBWUFDUUFBQUFBR0VBZ0VBQUFBQmhRSUJBQUFBQVlZQ0FRQUFBQUdIQWdFQUFBQUJpQUlRQUFBQUFZa0NBZ0FBQUFHS0FnZ0FBQUFCaXdJQUFKQUZBQ0NOQWdFQUFBQUJqZ0lCQUFBQUFRRWNBQUNRQWdBd0FSd0FBSkFDQURBVUJRQUE3QVFBSUFZQUFLb0ZBQ0FMQUFEdEJBQWdEQUFBN2dRQUlBMEFBTzhFQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFPb0VqUUlpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR0dBZ0VBdkFNQUlZY0NBUUM4QXdBaGlBSVFBTWtFQUNHSkFnSUF6UU1BSVlvQ0NBRG9CQUFoaXdJQUFPa0VBQ0NOQWdFQXZBTUFJWTRDQVFDOEF3QWhBZ0FBQUFVQUlCd0FBSk1DQUNBUDRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBRHFCSTBDSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhoZ0lCQUx3REFDR0hBZ0VBdkFNQUlZZ0NFQURKQkFBaGlRSUNBTTBEQUNHS0FnZ0E2QVFBSVlzQ0FBRHBCQUFnalFJQkFMd0RBQ0dPQWdFQXZBTUFJUUlBQUFBREFDQWNBQUNWQWdBZ0FnQUFBQU1BSUJ3QUFKVUNBQ0FEQUFBQUJRQWdJd0FBamdJQUlDUUFBSk1DQUNBQkFBQUFCUUFnQVFBQUFBTUFJQVVFQUFDbEJRQWdLUUFBcUFVQUlDb0FBS2NGQUNCTEFBQ21CUUFnVEFBQXFRVUFJQkxmQVFBQS13SUFNT0FCQUFDY0FnQVE0UUVBQVBzQ0FERGlBUUVBendJQUllVUJRQURRQWdBaC1nRUFBUDhDalFJaV9nRWdBTnNDQUNHQUFrQUEwQUlBSVlRQ0FRRFBBZ0FoaFFJQkFNOENBQ0dHQWdFQXp3SUFJWWNDQVFEUEFnQWhpQUlRQVB3Q0FDR0pBZ0lBM0FJQUlZb0NDQUQ5QWdBaGl3SUFBUDRDQUNDTkFnRUF6d0lBSVk0Q0FRRFBBZ0FoQXdBQUFBTUFJQUVBQUpzQ0FEQW9BQUNjQWdBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlCb0RBQUR6QWdBZ0N3QUE5QUlBSUF3QUFQVUNBQ0FPQUFEMkFnQWdEd0FBOXdJQUlCQUFBUGdDQUNBUkFBRDVBZ0FnRWdBQS1nSUFJTjhCQUFEcUFnQXc0QUVBQUtJQ0FCRGhBUUFBNmdJQU1PSUJBUUFBQUFIbEFVQUE4Z0lBSWZFQkFRRHJBZ0FoOGdFQkFBQUFBZk1CQVFEc0FnQWg5QUVCQUFBQUFmVUJBUURzQWdBaDlnRUJBT3dDQUNINEFRQUE3UUw0QVNMNkFRQUE3Z0w2QVNMOEFRQUE3d0w4QVNMOUFTQUE4QUlBSWY0QklBRHdBZ0FoX3dFQ0FQRUNBQ0dBQWtBQThnSUFJUUVBQUFDZkFnQWdBUUFBQUo4Q0FDQWFBd0FBOHdJQUlBc0FBUFFDQUNBTUFBRDFBZ0FnRGdBQTlnSUFJQThBQVBjQ0FDQVFBQUQ0QWdBZ0VRQUEtUUlBSUJJQUFQb0NBQ0RmQVFBQTZnSUFNT0FCQUFDaUFnQVE0UUVBQU9vQ0FERGlBUUVBNndJQUllVUJRQUR5QWdBaDhRRUJBT3NDQUNIeUFRRUE2d0lBSWZNQkFRRHNBZ0FoOUFFQkFPd0NBQ0gxQVFFQTdBSUFJZllCQVFEc0FnQWgtQUVBQU8wQy1BRWktZ0VBQU80Qy1nRWlfQUVBQU84Q19BRWlfUUVnQVBBQ0FDSC1BU0FBOEFJQUlmOEJBZ0R4QWdBaGdBSkFBUElDQUNFTUF3QUFuUVVBSUFzQUFKNEZBQ0FNQUFDZkJRQWdEZ0FBb0FVQUlBOEFBS0VGQUNBUUFBQ2lCUUFnRVFBQW93VUFJQklBQUtRRkFDRHpBUUFBd2dNQUlQUUJBQURDQXdBZzlRRUFBTUlEQUNEMkFRQUF3Z01BSUFNQUFBQ2lBZ0FnQVFBQW93SUFNQUlBQUo4Q0FDQURBQUFBb2dJQUlBRUFBS01DQURBQ0FBQ2ZBZ0FnQXdBQUFLSUNBQ0FCQUFDakFnQXdBZ0FBbndJQUlCY0RBQUNWQlFBZ0N3QUFsZ1VBSUF3QUFKY0ZBQ0FPQUFDWUJRQWdEd0FBbVFVQUlCQUFBSm9GQUNBUkFBQ2JCUUFnRWdBQW5BVUFJT0lCQVFBQUFBSGxBVUFBQUFBQjhRRUJBQUFBQWZJQkFRQUFBQUh6QVFFQUFBQUI5QUVCQUFBQUFmVUJBUUFBQUFIMkFRRUFBQUFCLUFFQUFBRDRBUUw2QVFBQUFQb0JBdndCQUFBQV9BRUNfUUVnQUFBQUFmNEJJQUFBQUFIX0FRSUFBQUFCZ0FKQUFBQUFBUUVjQUFDbkFnQWdELUlCQVFBQUFBSGxBVUFBQUFBQjhRRUJBQUFBQWZJQkFRQUFBQUh6QVFFQUFBQUI5QUVCQUFBQUFmVUJBUUFBQUFIMkFRRUFBQUFCLUFFQUFBRDRBUUw2QVFBQUFQb0JBdndCQUFBQV9BRUNfUUVnQUFBQUFmNEJJQUFBQUFIX0FRSUFBQUFCZ0FKQUFBQUFBUUVjQUFDcEFnQXdBUndBQUtrQ0FEQVhBd0FBemdNQUlBc0FBTThEQUNBTUFBRFFBd0FnRGdBQTBRTUFJQThBQU5JREFDQVFBQURUQXdBZ0VRQUExQU1BSUJJQUFOVURBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDSHlBUUVBdkFNQUlmTUJBUURJQXdBaDlBRUJBTWdEQUNIMUFRRUF5QU1BSWZZQkFRRElBd0FoLUFFQUFNa0QtQUVpLWdFQUFNb0QtZ0VpX0FFQUFNc0RfQUVpX1FFZ0FNd0RBQ0gtQVNBQXpBTUFJZjhCQWdETkF3QWhnQUpBQUwwREFDRUNBQUFBbndJQUlCd0FBS3dDQUNBUDRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoQWdBQUFLSUNBQ0FjQUFDdUFnQWdBZ0FBQUtJQ0FDQWNBQUN1QWdBZ0F3QUFBSjhDQUNBakFBQ25BZ0FnSkFBQXJBSUFJQUVBQUFDZkFnQWdBUUFBQUtJQ0FDQUpCQUFBd3dNQUlDa0FBTVlEQUNBcUFBREZBd0FnU3dBQXhBTUFJRXdBQU1jREFDRHpBUUFBd2dNQUlQUUJBQURDQXdBZzlRRUFBTUlEQUNEMkFRQUF3Z01BSUJMZkFRQUExZ0lBTU9BQkFBQzFBZ0FRNFFFQUFOWUNBRERpQVFFQXp3SUFJZVVCUUFEUUFnQWg4UUVCQU04Q0FDSHlBUUVBendJQUlmTUJBUURYQWdBaDlBRUJBTmNDQUNIMUFRRUExd0lBSWZZQkFRRFhBZ0FoLUFFQUFOZ0MtQUVpLWdFQUFOa0MtZ0VpX0FFQUFOb0NfQUVpX1FFZ0FOc0NBQ0gtQVNBQTJ3SUFJZjhCQWdEY0FnQWhnQUpBQU5BQ0FDRURBQUFBb2dJQUlBRUFBTFFDQURBb0FBQzFBZ0FnQXdBQUFLSUNBQ0FCQUFDakFnQXdBZ0FBbndJQUlBRUFBQUFZQUNBQkFBQUFHQUFnQXdBQUFCWUFJQUVBQUJjQU1BSUFBQmdBSUFNQUFBQVdBQ0FCQUFBWEFEQUNBQUFZQUNBREFBQUFGZ0FnQVFBQUZ3QXdBZ0FBR0FBZ0JnY0FBTUFEQUNBSUFBREJBd0FnNGdFQkFBQUFBZU1CQVFBQUFBSGtBUUVBQUFBQjVRRkFBQUFBQVFFY0FBQzlBZ0FnQk9JQkFRQUFBQUhqQVFFQUFBQUI1QUVCQUFBQUFlVUJRQUFBQUFFQkhBQUF2d0lBTUFFY0FBQ19BZ0F3QmdjQUFMNERBQ0FJQUFDX0F3QWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNFQ0FBQUFHQUFnSEFBQXdnSUFJQVRpQVFFQXZBTUFJZU1CQVFDOEF3QWg1QUVCQUx3REFDSGxBVUFBdlFNQUlRSUFBQUFXQUNBY0FBREVBZ0FnQWdBQUFCWUFJQndBQU1RQ0FDQURBQUFBR0FBZ0l3QUF2UUlBSUNRQUFNSUNBQ0FCQUFBQUdBQWdBUUFBQUJZQUlBTUVBQUM1QXdBZ0tRQUF1d01BSUNvQUFMb0RBQ0FIM3dFQUFNNENBRERnQVFBQXl3SUFFT0VCQUFET0FnQXc0Z0VCQU04Q0FDSGpBUUVBendJQUllUUJBUURQQWdBaDVRRkFBTkFDQUNFREFBQUFGZ0FnQVFBQXlnSUFNQ2dBQU1zQ0FDQURBQUFBRmdBZ0FRQUFGd0F3QWdBQUdBQWdCOThCQUFET0FnQXc0QUVBQU1zQ0FCRGhBUUFBemdJQU1PSUJBUURQQWdBaDR3RUJBTThDQUNIa0FRRUF6d0lBSWVVQlFBRFFBZ0FoRGdRQUFOSUNBQ0FwQUFEVkFnQWdLZ0FBMVFJQUlPWUJBUUFBQUFIbkFRRUFBQUFFNkFFQkFBQUFCT2tCQVFBQUFBSHFBUUVBQUFBQjZ3RUJBQUFBQWV3QkFRQUFBQUh0QVFFQTFBSUFJZTRCQVFBQUFBSHZBUUVBQUFBQjhBRUJBQUFBQVFzRUFBRFNBZ0FnS1FBQTB3SUFJQ29BQU5NQ0FDRG1BVUFBQUFBQjV3RkFBQUFBQk9nQlFBQUFBQVRwQVVBQUFBQUI2Z0ZBQUFBQUFlc0JRQUFBQUFIc0FVQUFBQUFCN1FGQUFORUNBQ0VMQkFBQTBnSUFJQ2tBQU5NQ0FDQXFBQURUQWdBZzVnRkFBQUFBQWVjQlFBQUFBQVRvQVVBQUFBQUU2UUZBQUFBQUFlb0JRQUFBQUFIckFVQUFBQUFCN0FGQUFBQUFBZTBCUUFEUkFnQWhDT1lCQWdBQUFBSG5BUUlBQUFBRTZBRUNBQUFBQk9rQkFnQUFBQUhxQVFJQUFBQUI2d0VDQUFBQUFld0JBZ0FBQUFIdEFRSUEwZ0lBSVFqbUFVQUFBQUFCNXdGQUFBQUFCT2dCUUFBQUFBVHBBVUFBQUFBQjZnRkFBQUFBQWVzQlFBQUFBQUhzQVVBQUFBQUI3UUZBQU5NQ0FDRU9CQUFBMGdJQUlDa0FBTlVDQUNBcUFBRFZBZ0FnNWdFQkFBQUFBZWNCQVFBQUFBVG9BUUVBQUFBRTZRRUJBQUFBQWVvQkFRQUFBQUhyQVFFQUFBQUI3QUVCQUFBQUFlMEJBUURVQWdBaDdnRUJBQUFBQWU4QkFRQUFBQUh3QVFFQUFBQUJDLVlCQVFBQUFBSG5BUUVBQUFBRTZBRUJBQUFBQk9rQkFRQUFBQUhxQVFFQUFBQUI2d0VCQUFBQUFld0JBUUFBQUFIdEFRRUExUUlBSWU0QkFRQUFBQUh2QVFFQUFBQUI4QUVCQUFBQUFSTGZBUUFBMWdJQU1PQUJBQUMxQWdBUTRRRUFBTllDQUREaUFRRUF6d0lBSWVVQlFBRFFBZ0FoOFFFQkFNOENBQ0h5QVFFQXp3SUFJZk1CQVFEWEFnQWg5QUVCQU5jQ0FDSDFBUUVBMXdJQUlmWUJBUURYQWdBaC1BRUFBTmdDLUFFaS1nRUFBTmtDLWdFaV9BRUFBTm9DX0FFaV9RRWdBTnNDQUNILUFTQUEyd0lBSWY4QkFnRGNBZ0FoZ0FKQUFOQUNBQ0VPQkFBQTZBSUFJQ2tBQU9rQ0FDQXFBQURwQWdBZzVnRUJBQUFBQWVjQkFRQUFBQVhvQVFFQUFBQUY2UUVCQUFBQUFlb0JBUUFBQUFIckFRRUFBQUFCN0FFQkFBQUFBZTBCQVFEbkFnQWg3Z0VCQUFBQUFlOEJBUUFBQUFId0FRRUFBQUFCQndRQUFOSUNBQ0FwQUFEbUFnQWdLZ0FBNWdJQUlPWUJBQUFBLUFFQzV3RUFBQUQ0QVFqb0FRQUFBUGdCQ08wQkFBRGxBdmdCSWdjRUFBRFNBZ0FnS1FBQTVBSUFJQ29BQU9RQ0FDRG1BUUFBQVBvQkF1Y0JBQUFBLWdFSTZBRUFBQUQ2QVFqdEFRQUE0d0w2QVNJSEJBQUEwZ0lBSUNrQUFPSUNBQ0FxQUFEaUFnQWc1Z0VBQUFEOEFRTG5BUUFBQVB3QkNPZ0JBQUFBX0FFSTdRRUFBT0VDX0FFaUJRUUFBTklDQUNBcEFBRGdBZ0FnS2dBQTRBSUFJT1lCSUFBQUFBSHRBU0FBM3dJQUlRMEVBQURTQWdBZ0tRQUEwZ0lBSUNvQUFOSUNBQ0JMQUFEZUFnQWdUQUFBMGdJQUlPWUJBZ0FBQUFIbkFRSUFBQUFFNkFFQ0FBQUFCT2tCQWdBQUFBSHFBUUlBQUFBQjZ3RUNBQUFBQWV3QkFnQUFBQUh0QVFJQTNRSUFJUTBFQUFEU0FnQWdLUUFBMGdJQUlDb0FBTklDQUNCTEFBRGVBZ0FnVEFBQTBnSUFJT1lCQWdBQUFBSG5BUUlBQUFBRTZBRUNBQUFBQk9rQkFnQUFBQUhxQVFJQUFBQUI2d0VDQUFBQUFld0JBZ0FBQUFIdEFRSUEzUUlBSVFqbUFRZ0FBQUFCNXdFSUFBQUFCT2dCQ0FBQUFBVHBBUWdBQUFBQjZnRUlBQUFBQWVzQkNBQUFBQUhzQVFnQUFBQUI3UUVJQU40Q0FDRUZCQUFBMGdJQUlDa0FBT0FDQUNBcUFBRGdBZ0FnNWdFZ0FBQUFBZTBCSUFEZkFnQWhBdVlCSUFBQUFBSHRBU0FBNEFJQUlRY0VBQURTQWdBZ0tRQUE0Z0lBSUNvQUFPSUNBQ0RtQVFBQUFQd0JBdWNCQUFBQV9BRUk2QUVBQUFEOEFRanRBUUFBNFFMOEFTSUU1Z0VBQUFEOEFRTG5BUUFBQVB3QkNPZ0JBQUFBX0FFSTdRRUFBT0lDX0FFaUJ3UUFBTklDQUNBcEFBRGtBZ0FnS2dBQTVBSUFJT1lCQUFBQS1nRUM1d0VBQUFENkFRam9BUUFBQVBvQkNPMEJBQURqQXZvQklnVG1BUUFBQVBvQkF1Y0JBQUFBLWdFSTZBRUFBQUQ2QVFqdEFRQUE1QUw2QVNJSEJBQUEwZ0lBSUNrQUFPWUNBQ0FxQUFEbUFnQWc1Z0VBQUFENEFRTG5BUUFBQVBnQkNPZ0JBQUFBLUFFSTdRRUFBT1VDLUFFaUJPWUJBQUFBLUFFQzV3RUFBQUQ0QVFqb0FRQUFBUGdCQ08wQkFBRG1BdmdCSWc0RUFBRG9BZ0FnS1FBQTZRSUFJQ29BQU9rQ0FDRG1BUUVBQUFBQjV3RUJBQUFBQmVnQkFRQUFBQVhwQVFFQUFBQUI2Z0VCQUFBQUFlc0JBUUFBQUFIc0FRRUFBQUFCN1FFQkFPY0NBQ0h1QVFFQUFBQUI3d0VCQUFBQUFmQUJBUUFBQUFFSTVnRUNBQUFBQWVjQkFnQUFBQVhvQVFJQUFBQUY2UUVDQUFBQUFlb0JBZ0FBQUFIckFRSUFBQUFCN0FFQ0FBQUFBZTBCQWdEb0FnQWhDLVlCQVFBQUFBSG5BUUVBQUFBRjZBRUJBQUFBQmVrQkFRQUFBQUhxQVFFQUFBQUI2d0VCQUFBQUFld0JBUUFBQUFIdEFRRUE2UUlBSWU0QkFRQUFBQUh2QVFFQUFBQUI4QUVCQUFBQUFSb0RBQUR6QWdBZ0N3QUE5QUlBSUF3QUFQVUNBQ0FPQUFEMkFnQWdEd0FBOXdJQUlCQUFBUGdDQUNBUkFBRDVBZ0FnRWdBQS1nSUFJTjhCQUFEcUFnQXc0QUVBQUtJQ0FCRGhBUUFBNmdJQU1PSUJBUURyQWdBaDVRRkFBUElDQUNIeEFRRUE2d0lBSWZJQkFRRHJBZ0FoOHdFQkFPd0NBQ0gwQVFFQTdBSUFJZlVCQVFEc0FnQWg5Z0VCQU93Q0FDSDRBUUFBN1FMNEFTTDZBUUFBN2dMNkFTTDhBUUFBN3dMOEFTTDlBU0FBOEFJQUlmNEJJQUR3QWdBaF93RUNBUEVDQUNHQUFrQUE4Z0lBSVF2bUFRRUFBQUFCNXdFQkFBQUFCT2dCQVFBQUFBVHBBUUVBQUFBQjZnRUJBQUFBQWVzQkFRQUFBQUhzQVFFQUFBQUI3UUVCQU5VQ0FDSHVBUUVBQUFBQjd3RUJBQUFBQWZBQkFRQUFBQUVMNWdFQkFBQUFBZWNCQVFBQUFBWG9BUUVBQUFBRjZRRUJBQUFBQWVvQkFRQUFBQUhyQVFFQUFBQUI3QUVCQUFBQUFlMEJBUURwQWdBaDdnRUJBQUFBQWU4QkFRQUFBQUh3QVFFQUFBQUJCT1lCQUFBQS1BRUM1d0VBQUFENEFRam9BUUFBQVBnQkNPMEJBQURtQXZnQklnVG1BUUFBQVBvQkF1Y0JBQUFBLWdFSTZBRUFBQUQ2QVFqdEFRQUE1QUw2QVNJRTVnRUFBQUQ4QVFMbkFRQUFBUHdCQ09nQkFBQUFfQUVJN1FFQUFPSUNfQUVpQXVZQklBQUFBQUh0QVNBQTRBSUFJUWptQVFJQUFBQUI1d0VDQUFBQUJPZ0JBZ0FBQUFUcEFRSUFBQUFCNmdFQ0FBQUFBZXNCQWdBQUFBSHNBUUlBQUFBQjdRRUNBTklDQUNFSTVnRkFBQUFBQWVjQlFBQUFBQVRvQVVBQUFBQUU2UUZBQUFBQUFlb0JRQUFBQUFIckFVQUFBQUFCN0FGQUFBQUFBZTBCUUFEVEFnQWhBNEVDQUFBREFDQ0NBZ0FBQXdBZ2d3SUFBQU1BSUFPQkFnQUFDUUFnZ2dJQUFBa0FJSU1DQUFBSkFDQURnUUlBQUJJQUlJSUNBQUFTQUNDREFnQUFFZ0FnQTRFQ0FBQWZBQ0NDQWdBQUh3QWdnd0lBQUI4QUlBT0JBZ0FBRmdBZ2dnSUFBQllBSUlNQ0FBQVdBQ0FEZ1FJQUFDUUFJSUlDQUFBa0FDQ0RBZ0FBSkFBZ0E0RUNBQUFvQUNDQ0FnQUFLQUFnZ3dJQUFDZ0FJQU9CQWdBQUt3QWdnZ0lBQUNzQUlJTUNBQUFyQUNBUzN3RUFBUHNDQUREZ0FRQUFuQUlBRU9FQkFBRDdBZ0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZm9CQUFEX0FvMENJdjRCSUFEYkFnQWhnQUpBQU5BQ0FDR0VBZ0VBendJQUlZVUNBUURQQWdBaGhnSUJBTThDQUNHSEFnRUF6d0lBSVlnQ0VBRDhBZ0FoaVFJQ0FOd0NBQ0dLQWdnQV9RSUFJWXNDQUFELUFnQWdqUUlCQU04Q0FDR09BZ0VBendJQUlRMEVBQURTQWdBZ0tRQUFoQU1BSUNvQUFJUURBQ0JMQUFDRUF3QWdUQUFBaEFNQUlPWUJFQUFBQUFIbkFSQUFBQUFFNkFFUUFBQUFCT2tCRUFBQUFBSHFBUkFBQUFBQjZ3RVFBQUFBQWV3QkVBQUFBQUh0QVJBQWd3TUFJUTBFQUFEU0FnQWdLUUFBM2dJQUlDb0FBTjRDQUNCTEFBRGVBZ0FnVEFBQTNnSUFJT1lCQ0FBQUFBSG5BUWdBQUFBRTZBRUlBQUFBQk9rQkNBQUFBQUhxQVFnQUFBQUI2d0VJQUFBQUFld0JDQUFBQUFIdEFRZ0FnZ01BSVFUbUFRRUFBQUFGandJQkFBQUFBWkFDQVFBQUFBU1JBZ0VBQUFBRUJ3UUFBTklDQUNBcEFBQ0JBd0FnS2dBQWdRTUFJT1lCQUFBQWpRSUM1d0VBQUFDTkFnam9BUUFBQUkwQ0NPMEJBQUNBQTQwQ0lnY0VBQURTQWdBZ0tRQUFnUU1BSUNvQUFJRURBQ0RtQVFBQUFJMENBdWNCQUFBQWpRSUk2QUVBQUFDTkFnanRBUUFBZ0FPTkFpSUU1Z0VBQUFDTkFnTG5BUUFBQUkwQ0NPZ0JBQUFBalFJSTdRRUFBSUVEalFJaURRUUFBTklDQUNBcEFBRGVBZ0FnS2dBQTNnSUFJRXNBQU40Q0FDQk1BQURlQWdBZzVnRUlBQUFBQWVjQkNBQUFBQVRvQVFnQUFBQUU2UUVJQUFBQUFlb0JDQUFBQUFIckFRZ0FBQUFCN0FFSUFBQUFBZTBCQ0FDQ0F3QWhEUVFBQU5JQ0FDQXBBQUNFQXdBZ0tnQUFoQU1BSUVzQUFJUURBQ0JNQUFDRUF3QWc1Z0VRQUFBQUFlY0JFQUFBQUFUb0FSQUFBQUFFNlFFUUFBQUFBZW9CRUFBQUFBSHJBUkFBQUFBQjdBRVFBQUFBQWUwQkVBQ0RBd0FoQ09ZQkVBQUFBQUhuQVJBQUFBQUU2QUVRQUFBQUJPa0JFQUFBQUFIcUFSQUFBQUFCNndFUUFBQUFBZXdCRUFBQUFBSHRBUkFBaEFNQUlRdmZBUUFBaFFNQU1PQUJBQUNHQWdBUTRRRUFBSVVEQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNUFFQkFNOENBQ0hsQVVBQTBBSUFJZjRCSUFEYkFnQWhnQUpBQU5BQ0FDR0tBZ0lBM0FJQUlaSUNBUURQQWdBaENkOEJBQUNHQXdBdzRBRUFBUEFCQUJEaEFRQUFoZ01BTU9JQkFRRFBBZ0FoNHdFQkFNOENBQ0hsQVVBQTBBSUFJWk1DQVFEUEFnQWhsQUpBQU5BQ0FDR1ZBa0FBaHdNQUlRc0VBQURvQWdBZ0tRQUFpUU1BSUNvQUFJa0RBQ0RtQVVBQUFBQUI1d0ZBQUFBQUJlZ0JRQUFBQUFYcEFVQUFBQUFCNmdGQUFBQUFBZXNCUUFBQUFBSHNBVUFBQUFBQjdRRkFBSWdEQUNFTEJBQUE2QUlBSUNrQUFJa0RBQ0FxQUFDSkF3QWc1Z0ZBQUFBQUFlY0JRQUFBQUFYb0FVQUFBQUFGNlFGQUFBQUFBZW9CUUFBQUFBSHJBVUFBQUFBQjdBRkFBQUFBQWUwQlFBQ0lBd0FoQ09ZQlFBQUFBQUhuQVVBQUFBQUY2QUZBQUFBQUJla0JRQUFBQUFIcUFVQUFBQUFCNndGQUFBQUFBZXdCUUFBQUFBSHRBVUFBaVFNQUlSUGZBUUFBaWdNQU1PQUJBQURhQVFBUTRRRUFBSW9EQUREaUFRRUF6d0lBSWVVQlFBRFFBZ0FoLWdFQUFJc0RuQUlpZ0FKQUFOQUNBQ0dXQWdFQXp3SUFJWmNDQVFEUEFnQWhtQUlCQU5jQ0FDR1pBaEFBX0FJQUlab0NBUURQQWdBaG5BSUJBTmNDQUNHZEFnRUExd0lBSVo0Q0FRRFhBZ0FobndJQkFOY0NBQ0dnQWtBQWh3TUFJYUVDQVFEWEFnQWhvZ0pBQUljREFDRUhCQUFBMGdJQUlDa0FBSTBEQUNBcUFBQ05Bd0FnNWdFQUFBQ2NBZ0xuQVFBQUFKd0NDT2dCQUFBQW5BSUk3UUVBQUl3RG5BSWlCd1FBQU5JQ0FDQXBBQUNOQXdBZ0tnQUFqUU1BSU9ZQkFBQUFuQUlDNXdFQUFBQ2NBZ2pvQVFBQUFKd0NDTzBCQUFDTUE1d0NJZ1RtQVFBQUFKd0NBdWNCQUFBQW5BSUk2QUVBQUFDY0FnanRBUUFBalFPY0FpSUwzd0VBQUk0REFERGdBUUFBeEFFQUVPRUJBQUNPQXdBdzRnRUJBTThDQUNIakFRRUF6d0lBSWVVQlFBRFFBZ0FoaEFJQkFNOENBQ0drQWdBQWp3T2tBaUtsQWdFQXp3SUFJYVlDQVFEWEFnQWhwd0lnQU5zQ0FDRUhCQUFBMGdJQUlDa0FBSkVEQUNBcUFBQ1JBd0FnNWdFQUFBQ2tBZ0xuQVFBQUFLUUNDT2dCQUFBQXBBSUk3UUVBQUpBRHBBSWlCd1FBQU5JQ0FDQXBBQUNSQXdBZ0tnQUFrUU1BSU9ZQkFBQUFwQUlDNXdFQUFBQ2tBZ2pvQVFBQUFLUUNDTzBCQUFDUUE2UUNJZ1RtQVFBQUFLUUNBdWNCQUFBQXBBSUk2QUVBQUFDa0FnanRBUUFBa1FPa0FpSUwzd0VBQUpJREFERGdBUUFBcmdFQUVPRUJBQUNTQXdBdzRnRUJBTThDQUNIbEFVQUEwQUlBSWZFQkFRRFBBZ0FoOGdFQkFNOENBQ0dBQWtBQTBBSUFJYVVDQVFEUEFnQWhxQUlCQU04Q0FDR3BBaUFBMndJQUlRdmZBUUFBa3dNQU1PQUJBQUNiQVFBUTRRRUFBSk1EQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoOFFFQkFPc0NBQ0h5QVFFQTZ3SUFJWUFDUUFEeUFnQWhwUUlCQU9zQ0FDR29BZ0VBNndJQUlha0NJQUR3QWdBaENOOEJBQUNVQXdBdzRBRUFBSlVCQUJEaEFRQUFsQU1BTU9JQkFRRFBBZ0FoNVFGQUFOQUNBQ0h4QVFFQXp3SUFJWUFDUUFEUUFnQWhoUUlCQU04Q0FDRUpBd0FBOHdJQUlOOEJBQUNWQXdBdzRBRUFBSUlCQUJEaEFRQUFsUU1BTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0h4QVFFQTZ3SUFJWUFDUUFEeUFnQWhoUUlCQU9zQ0FDRU0zd0VBQUpZREFERGdBUUFBZkFBUTRRRUFBSllEQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNUFFQkFNOENBQ0hsQVVBQTBBSUFJZm9CQUFDWEE2NENJb0FDUUFEUUFnQWhxZ0pBQU5BQ0FDR3JBZ0lBM0FJQUlhd0NFQUQ4QWdBaEJ3UUFBTklDQUNBcEFBQ1pBd0FnS2dBQW1RTUFJT1lCQUFBQXJnSUM1d0VBQUFDdUFnam9BUUFBQUs0Q0NPMEJBQUNZQTY0Q0lnY0VBQURTQWdBZ0tRQUFtUU1BSUNvQUFKa0RBQ0RtQVFBQUFLNENBdWNCQUFBQXJnSUk2QUVBQUFDdUFnanRBUUFBbUFPdUFpSUU1Z0VBQUFDdUFnTG5BUUFBQUs0Q0NPZ0JBQUFBcmdJSTdRRUFBSmtEcmdJaUR0OEJBQUNhQXdBdzRBRUFBR1lBRU9FQkFBQ2FBd0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZm9CQUFDYkE3SUNJdjRCSUFEYkFnQWhnQUpBQU5BQ0FDR0VBZ0VBendJQUlZVUNBUURQQWdBaHJnSUJBTThDQUNHdkFnRUF6d0lBSWJBQ0FRRFBBZ0Foc2dJQkFNOENBQ0VIQkFBQTBnSUFJQ2tBQUowREFDQXFBQUNkQXdBZzVnRUFBQUN5QWdMbkFRQUFBTElDQ09nQkFBQUFzZ0lJN1FFQUFKd0RzZ0lpQndRQUFOSUNBQ0FwQUFDZEF3QWdLZ0FBblFNQUlPWUJBQUFBc2dJQzV3RUFBQUN5QWdqb0FRQUFBTElDQ08wQkFBQ2NBN0lDSWdUbUFRQUFBTElDQXVjQkFBQUFzZ0lJNkFFQUFBQ3lBZ2p0QVFBQW5RT3lBaUlMM3dFQUFKNERBRERnQVFBQVVBQVE0UUVBQUo0REFERGlBUUVBendJQUllTUJBUURQQWdBaDVRRkFBTkFDQUNILUFTQUEyd0lBSVlBQ1FBRFFBZ0FocndJQkFNOENBQ0d6QWdFQXp3SUFJYlFDQVFEWEFnQWhDZ2NBQUtFREFDRGZBUUFBbndNQU1PQUJBQUFyQUJEaEFRQUFud01BTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJWk1DQVFEckFnQWhsQUpBQVBJQ0FDR1ZBa0FBb0FNQUlRam1BVUFBQUFBQjV3RkFBQUFBQmVnQlFBQUFBQVhwQVVBQUFBQUI2Z0ZBQUFBQUFlc0JRQUFBQUFIc0FVQUFBQUFCN1FGQUFJa0RBQ0VjQXdBQTh3SUFJQXNBQVBRQ0FDQU1BQUQxQWdBZ0RnQUE5Z0lBSUE4QUFQY0NBQ0FRQUFENEFnQWdFUUFBLVFJQUlCSUFBUG9DQUNEZkFRQUE2Z0lBTU9BQkFBQ2lBZ0FRNFFFQUFPb0NBRERpQVFFQTZ3SUFJZVVCUUFEeUFnQWg4UUVCQU9zQ0FDSHlBUUVBNndJQUlmTUJBUURzQWdBaDlBRUJBT3dDQUNIMUFRRUE3QUlBSWZZQkFRRHNBZ0FoLUFFQUFPMEMtQUVpLWdFQUFPNEMtZ0VpX0FFQUFPOENfQUVpX1FFZ0FQQUNBQ0gtQVNBQThBSUFJZjhCQWdEeEFnQWhnQUpBQVBJQ0FDRzJBZ0FBb2dJQUlMY0NBQUNpQWdBZ0R3Y0FBS0VEQUNBVUFBQ2pBd0FnRlFBQXBBTUFJQllBQVBrQ0FDRGZBUUFBb2dNQU1PQUJBQUFvQUJEaEFRQUFvZ01BTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR3ZBZ0VBNndJQUliTUNBUURyQWdBaHRBSUJBT3dDQUNFU0VRQUEtUUlBSUJNQUFLRURBQ0RmQVFBQXB3TUFNT0FCQUFBZkFCRGhBUUFBcHdNQU1PSUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFxQU95QWlMLUFTQUE4QUlBSVlBQ1FBRHlBZ0FoaEFJQkFPc0NBQ0dGQWdFQTZ3SUFJYTRDQVFEckFnQWhyd0lCQU9zQ0FDR3dBZ0VBNndJQUliSUNBUURyQWdBaHRnSUFBQjhBSUxjQ0FBQWZBQ0FSQndBQW9RTUFJQlFBQUtNREFDQVZBQUNrQXdBZ0ZnQUEtUUlBSU44QkFBQ2lBd0F3NEFFQUFDZ0FFT0VCQUFDaUF3QXc0Z0VCQU9zQ0FDSGpBUUVBNndJQUllVUJRQUR5QWdBaF9nRWdBUEFDQUNHQUFrQUE4Z0lBSWE4Q0FRRHJBZ0Foc3dJQkFPc0NBQ0cwQWdFQTdBSUFJYllDQUFBb0FDQzNBZ0FBS0FBZ0RBY0FBS0VEQUNEZkFRQUFwUU1BTU9BQkFBQWtBQkRoQVFBQXBRTUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlZUUNBUURyQWdBaHBBSUFBS1lEcEFJaXBRSUJBT3NDQUNHbUFnRUE3QUlBSWFjQ0lBRHdBZ0FoQk9ZQkFBQUFwQUlDNXdFQUFBQ2tBZ2pvQVFBQUFLUUNDTzBCQUFDUkE2UUNJaEFSQUFENUFnQWdFd0FBb1FNQUlOOEJBQUNuQXdBdzRBRUFBQjhBRU9FQkFBQ25Bd0F3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDb0E3SUNJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUURyQWdBaHJnSUJBT3NDQUNHdkFnRUE2d0lBSWJBQ0FRRHJBZ0Foc2dJQkFPc0NBQ0VFNWdFQUFBQ3lBZ0xuQVFBQUFMSUNDT2dCQUFBQXNnSUk3UUVBQUowRHNnSWlBdU1CQVFBQUFBSGtBUUVBQUFBQkNRY0FBS0VEQUNBSUFBQ3JBd0FnM3dFQUFLb0RBRERnQVFBQUZnQVE0UUVBQUtvREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSVJrRkFBQzRBd0FnQmdBQW9RTUFJQXNBQVBRQ0FDQU1BQUQxQWdBZ0RRQUE5d0lBSU44QkFBQzFBd0F3NEFFQUFBTUFFT0VCQUFDMUF3QXc0Z0VCQU9zQ0FDSGxBVUFBOGdJQUlmb0JBQUMzQTQwQ0l2NEJJQUR3QWdBaGdBSkFBUElDQUNHRUFnRUE2d0lBSVlVQ0FRRHJBZ0FoaGdJQkFPc0NBQ0dIQWdFQTZ3SUFJWWdDRUFDdkF3QWhpUUlDQVBFQ0FDR0tBZ2dBdGdNQUlZc0NBQUQtQWdBZ2pRSUJBT3NDQUNHT0FnRUE2d0lBSWJZQ0FBQURBQ0MzQWdBQUF3QWdBdU1CQVFBQUFBSGtBUUVBQUFBQkRRY0FBS0VEQUNBSUFBQ3JBd0FnM3dFQUFLMERBRERnQVFBQUVnQVE0UUVBQUswREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0dLQWdJQThRSUFJWklDQVFEckFnQWhGQWtBQUxFREFDRGZBUUFBcmdNQU1PQUJBQUFOQUJEaEFRQUFyZ01BTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0g2QVFBQXNBT2NBaUtBQWtBQThnSUFJWllDQVFEckFnQWhsd0lCQU9zQ0FDR1lBZ0VBN0FJQUlaa0NFQUN2QXdBaG1nSUJBT3NDQUNHY0FnRUE3QUlBSVowQ0FRRHNBZ0FobmdJQkFPd0NBQ0dmQWdFQTdBSUFJYUFDUUFDZ0F3QWhvUUlCQU93Q0FDR2lBa0FBb0FNQUlRam1BUkFBQUFBQjV3RVFBQUFBQk9nQkVBQUFBQVRwQVJBQUFBQUI2Z0VRQUFBQUFlc0JFQUFBQUFIc0FSQUFBQUFCN1FFUUFJUURBQ0VFNWdFQUFBQ2NBZ0xuQVFBQUFKd0NDT2dCQUFBQW5BSUk3UUVBQUkwRG5BSWlFUWNBQUtFREFDQUlBQUNyQXdBZ0NnQUF0QU1BSU44QkFBQ3lBd0F3NEFFQUFBa0FFT0VCQUFDeUF3QXc0Z0VCQU9zQ0FDSGpBUUVBNndJQUllUUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFzd091QWlLQUFrQUE4Z0lBSWFvQ1FBRHlBZ0FocXdJQ0FQRUNBQ0dzQWhBQXJ3TUFJYllDQUFBSkFDQzNBZ0FBQ1FBZ0R3Y0FBS0VEQUNBSUFBQ3JBd0FnQ2dBQXRBTUFJTjhCQUFDeUF3QXc0QUVBQUFrQUVPRUJBQUN5QXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVRQkFRRHJBZ0FoNVFGQUFQSUNBQ0g2QVFBQXN3T3VBaUtBQWtBQThnSUFJYW9DUUFEeUFnQWhxd0lDQVBFQ0FDR3NBaEFBcndNQUlRVG1BUUFBQUs0Q0F1Y0JBQUFBcmdJSTZBRUFBQUN1QWdqdEFRQUFtUU91QWlJRGdRSUFBQTBBSUlJQ0FBQU5BQ0NEQWdBQURRQWdGd1VBQUxnREFDQUdBQUNoQXdBZ0N3QUE5QUlBSUF3QUFQVUNBQ0FOQUFEM0FnQWczd0VBQUxVREFERGdBUUFBQXdBUTRRRUFBTFVEQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFMY0RqUUlpX2dFZ0FQQUNBQ0dBQWtBQThnSUFJWVFDQVFEckFnQWhoUUlCQU9zQ0FDR0dBZ0VBNndJQUlZY0NBUURyQWdBaGlBSVFBSzhEQUNHSkFnSUE4UUlBSVlvQ0NBQzJBd0FoaXdJQUFQNENBQ0NOQWdFQTZ3SUFJWTRDQVFEckFnQWhDT1lCQ0FBQUFBSG5BUWdBQUFBRTZBRUlBQUFBQk9rQkNBQUFBQUhxQVFnQUFBQUI2d0VJQUFBQUFld0JDQUFBQUFIdEFRZ0EzZ0lBSVFUbUFRQUFBSTBDQXVjQkFBQUFqUUlJNkFFQUFBQ05BZ2p0QVFBQWdRT05BaUlMQXdBQTh3SUFJTjhCQUFDVkF3QXc0QUVBQUlJQkFCRGhBUUFBbFFNQU1PSUJBUURyQWdBaDVRRkFBUElDQUNIeEFRRUE2d0lBSVlBQ1FBRHlBZ0FoaFFJQkFPc0NBQ0cyQWdBQWdnRUFJTGNDQUFDQ0FRQWdBQUFBQWJzQ0FRQUFBQUVCdXdKQUFBQUFBUVVqQUFDNUJnQWdKQUFBdndZQUlMZ0NBQUM2QmdBZ3VRSUFBTDRHQUNDLUFnQUFud0lBSUFVakFBQzNCZ0FnSkFBQXZBWUFJTGdDQUFDNEJnQWd1UUlBQUxzR0FDQy1BZ0FBQlFBZ0F5TUFBTGtHQUNDNEFnQUF1Z1lBSUw0Q0FBQ2ZBZ0FnQXlNQUFMY0dBQ0M0QWdBQXVBWUFJTDRDQUFBRkFDQUFBQUFBQUFBQnV3SUJBQUFBQVFHN0FnQUFBUGdCQWdHN0FnQUFBUG9CQWdHN0FnQUFBUHdCQWdHN0FpQUFBQUFCQmJzQ0FnQUFBQUhDQWdJQUFBQUJ3d0lDQUFBQUFjUUNBZ0FBQUFIRkFnSUFBQUFCQ3lNQUFONEVBREFrQUFEakJBQXd1QUlBQU44RUFEQzVBZ0FBNEFRQU1Mb0NBQURoQkFBZ3V3SUFBT0lFQURDOEFnQUE0Z1FBTUwwQ0FBRGlCQUF3dmdJQUFPSUVBRENfQWdBQTVBUUFNTUFDQUFEbEJBQXdDeU1BQUw4RUFEQWtBQURFQkFBd3VBSUFBTUFFQURDNUFnQUF3UVFBTUxvQ0FBRENCQUFndXdJQUFNTUVBREM4QWdBQXd3UUFNTDBDQUFEREJBQXd2Z0lBQU1NRUFEQ19BZ0FBeFFRQU1NQUNBQURHQkFBd0N5TUFBTEVFQURBa0FBQzJCQUF3dUFJQUFMSUVBREM1QWdBQXN3UUFNTG9DQUFDMEJBQWd1d0lBQUxVRUFEQzhBZ0FBdFFRQU1MMENBQUMxQkFBd3ZnSUFBTFVFQURDX0FnQUF0d1FBTU1BQ0FBQzRCQUF3Q3lNQUFKa0VBREFrQUFDZUJBQXd1QUlBQUpvRUFEQzVBZ0FBbXdRQU1Mb0NBQUNjQkFBZ3V3SUFBSjBFQURDOEFnQUFuUVFBTUwwQ0FBQ2RCQUF3dmdJQUFKMEVBRENfQWdBQW53UUFNTUFDQUFDZ0JBQXdDeU1BQUkwRUFEQWtBQUNTQkFBd3VBSUFBSTRFQURDNUFnQUFqd1FBTUxvQ0FBQ1FCQUFndXdJQUFKRUVBREM4QWdBQWtRUUFNTDBDQUFDUkJBQXd2Z0lBQUpFRUFEQ19BZ0FBa3dRQU1NQUNBQUNVQkFBd0N5TUFBSUFFQURBa0FBQ0ZCQUF3dUFJQUFJRUVBREM1QWdBQWdnUUFNTG9DQUFDREJBQWd1d0lBQUlRRUFEQzhBZ0FBaEFRQU1MMENBQUNFQkFBd3ZnSUFBSVFFQURDX0FnQUFoZ1FBTU1BQ0FBQ0hCQUF3Q3lNQUFPTURBREFrQUFEb0F3QXd1QUlBQU9RREFEQzVBZ0FBNVFNQU1Mb0NBQURtQXdBZ3V3SUFBT2NEQURDOEFnQUE1d01BTUwwQ0FBRG5Bd0F3dmdJQUFPY0RBRENfQWdBQTZRTUFNTUFDQUFEcUF3QXdDeU1BQU5ZREFEQWtBQURiQXdBd3VBSUFBTmNEQURDNUFnQUEyQU1BTUxvQ0FBRFpBd0FndXdJQUFOb0RBREM4QWdBQTJnTUFNTDBDQUFEYUF3QXd2Z0lBQU5vREFEQ19BZ0FBM0FNQU1NQUNBQURkQXdBd0JlSUJBUUFBQUFIbEFVQUFBQUFCa3dJQkFBQUFBWlFDUUFBQUFBR1ZBa0FBQUFBQkFnQUFBQzBBSUNNQUFPSURBQ0FEQUFBQUxRQWdJd0FBNGdNQUlDUUFBT0VEQUNBQkhBQUF0Z1lBTUFvSEFBQ2hBd0FnM3dFQUFKOERBRERnQVFBQUt3QVE0UUVBQUo4REFERGlBUUVBQUFBQjR3RUJBT3NDQUNIbEFVQUE4Z0lBSVpNQ0FRQUFBQUdVQWtBQThnSUFJWlVDUUFDZ0F3QWhBZ0FBQUMwQUlCd0FBT0VEQUNBQ0FBQUEzZ01BSUJ3QUFOOERBQ0FKM3dFQUFOMERBRERnQVFBQTNnTUFFT0VCQUFEZEF3QXc0Z0VCQU9zQ0FDSGpBUUVBNndJQUllVUJRQUR5QWdBaGt3SUJBT3NDQUNHVUFrQUE4Z0lBSVpVQ1FBQ2dBd0FoQ2Q4QkFBRGRBd0F3NEFFQUFONERBQkRoQVFBQTNRTUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlaTUNBUURyQWdBaGxBSkFBUElDQUNHVkFrQUFvQU1BSVFYaUFRRUF2QU1BSWVVQlFBQzlBd0Foa3dJQkFMd0RBQ0dVQWtBQXZRTUFJWlVDUUFEZ0F3QWhBYnNDUUFBQUFBRUY0Z0VCQUx3REFDSGxBVUFBdlFNQUlaTUNBUUM4QXdBaGxBSkFBTDBEQUNHVkFrQUE0QU1BSVFYaUFRRUFBQUFCNVFGQUFBQUFBWk1DQVFBQUFBR1VBa0FBQUFBQmxRSkFBQUFBQVFvVUFBRDdBd0FnRlFBQV93TUFJQllBQVAwREFDRGlBUUVBQUFBQjVRRkFBQUFBQWY0QklBQUFBQUdBQWtBQUFBQUJyd0lCQUFBQUFiTUNBUUFBQUFHMEFnRUFBQUFCQWdBQUFBRUFJQ01BQVA0REFDQURBQUFBQVFBZ0l3QUFfZ01BSUNRQUFPMERBQ0FCSEFBQXRRWUFNQThIQUFDaEF3QWdGQUFBb3dNQUlCVUFBS1FEQUNBV0FBRDVBZ0FnM3dFQUFLSURBRERnQVFBQUtBQVE0UUVBQUtJREFERGlBUUVBQUFBQjR3RUJBT3NDQUNIbEFVQUE4Z0lBSWY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0d2QWdFQTZ3SUFJYk1DQVFEckFnQWh0QUlCQU93Q0FDRUNBQUFBQVFBZ0hBQUE3UU1BSUFJQUFBRHJBd0FnSEFBQTdBTUFJQXZmQVFBQTZnTUFNT0FCQUFEckF3QVE0UUVBQU9vREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVRRkFBUElDQUNILUFTQUE4QUlBSVlBQ1FBRHlBZ0FocndJQkFPc0NBQ0d6QWdFQTZ3SUFJYlFDQVFEc0FnQWhDOThCQUFEcUF3QXc0QUVBQU9zREFCRGhBUUFBNmdNQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIbEFVQUE4Z0lBSWY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0d2QWdFQTZ3SUFJYk1DQVFEckFnQWh0QUlCQU93Q0FDRUg0Z0VCQUx3REFDSGxBVUFBdlFNQUlmNEJJQURNQXdBaGdBSkFBTDBEQUNHdkFnRUF2QU1BSWJNQ0FRQzhBd0FodEFJQkFNZ0RBQ0VLRkFBQTdnTUFJQlVBQU84REFDQVdBQUR3QXdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWY0QklBRE1Bd0FoZ0FKQUFMMERBQ0d2QWdFQXZBTUFJYk1DQVFDOEF3QWh0QUlCQU1nREFDRUZJd0FBcVFZQUlDUUFBTE1HQUNDNEFnQUFxZ1lBSUxrQ0FBQ3lCZ0FndmdJQUFDRUFJQWNqQUFDbEJnQWdKQUFBc0FZQUlMZ0NBQUNtQmdBZ3VRSUFBSzhHQUNDOEFnQUFLQUFndlFJQUFDZ0FJTDRDQUFBQkFDQUxJd0FBOFFNQU1DUUFBUFVEQURDNEFnQUE4Z01BTUxrQ0FBRHpBd0F3dWdJQUFQUURBQ0M3QWdBQTV3TUFNTHdDQUFEbkF3QXd2UUlBQU9jREFEQy1BZ0FBNXdNQU1MOENBQUQyQXdBd3dBSUFBT29EQURBS0J3QUFfQU1BSUJRQUFQc0RBQ0FXQUFEOUF3QWc0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCX2dFZ0FBQUFBWUFDUUFBQUFBR3ZBZ0VBQUFBQnN3SUJBQUFBQVFJQUFBQUJBQ0FqQUFENkF3QWdBd0FBQUFFQUlDTUFBUG9EQUNBa0FBRDRBd0FnQVJ3QUFLNEdBREFDQUFBQUFRQWdIQUFBLUFNQUlBSUFBQURyQXdBZ0hBQUE5d01BSUFmaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhyd0lCQUx3REFDR3pBZ0VBdkFNQUlRb0hBQUQ1QXdBZ0ZBQUE3Z01BSUJZQUFQQURBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDSC1BU0FBekFNQUlZQUNRQUM5QXdBaHJ3SUJBTHdEQUNHekFnRUF2QU1BSVFVakFBQ25CZ0FnSkFBQXJBWUFJTGdDQUFDb0JnQWd1UUlBQUtzR0FDQy1BZ0FBbndJQUlBb0hBQUQ4QXdBZ0ZBQUEtd01BSUJZQUFQMERBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBYThDQVFBQUFBR3pBZ0VBQUFBQkF5TUFBS2tHQUNDNEFnQUFxZ1lBSUw0Q0FBQWhBQ0FESXdBQXB3WUFJTGdDQUFDb0JnQWd2Z0lBQUo4Q0FDQUVJd0FBOFFNQU1MZ0NBQUR5QXdBd3VnSUFBUFFEQUNDLUFnQUE1d01BTUFvVUFBRDdBd0FnRlFBQV93TUFJQllBQVAwREFDRGlBUUVBQUFBQjVRRkFBQUFBQWY0QklBQUFBQUdBQWtBQUFBQUJyd0lCQUFBQUFiTUNBUUFBQUFHMEFnRUFBQUFCQXlNQUFLVUdBQ0M0QWdBQXBnWUFJTDRDQUFBQkFDQUg0Z0VCQUFBQUFlVUJRQUFBQUFHRUFnRUFBQUFCcEFJQUFBQ2tBZ0tsQWdFQUFBQUJwZ0lCQUFBQUFhY0NJQUFBQUFFQ0FBQUFKZ0FnSXdBQWpBUUFJQU1BQUFBbUFDQWpBQUNNQkFBZ0pBQUFpd1FBSUFFY0FBQ2tCZ0F3REFjQUFLRURBQ0RmQVFBQXBRTUFNT0FCQUFBa0FCRGhBUUFBcFFNQU1PSUJBUUFBQUFIakFRRUE2d0lBSWVVQlFBRHlBZ0FoaEFJQkFPc0NBQ0drQWdBQXBnT2tBaUtsQWdFQTZ3SUFJYVlDQVFEc0FnQWhwd0lnQVBBQ0FDRUNBQUFBSmdBZ0hBQUFpd1FBSUFJQUFBQ0lCQUFnSEFBQWlRUUFJQXZmQVFBQWh3UUFNT0FCQUFDSUJBQVE0UUVBQUljRUFERGlBUUVBNndJQUllTUJBUURyQWdBaDVRRkFBUElDQUNHRUFnRUE2d0lBSWFRQ0FBQ21BNlFDSXFVQ0FRRHJBZ0FocGdJQkFPd0NBQ0duQWlBQThBSUFJUXZmQVFBQWh3UUFNT0FCQUFDSUJBQVE0UUVBQUljRUFERGlBUUVBNndJQUllTUJBUURyQWdBaDVRRkFBUElDQUNHRUFnRUE2d0lBSWFRQ0FBQ21BNlFDSXFVQ0FRRHJBZ0FocGdJQkFPd0NBQ0duQWlBQThBSUFJUWZpQVFFQXZBTUFJZVVCUUFDOUF3QWhoQUlCQUx3REFDR2tBZ0FBaWdTa0FpS2xBZ0VBdkFNQUlhWUNBUURJQXdBaHB3SWdBTXdEQUNFQnV3SUFBQUNrQWdJSDRnRUJBTHdEQUNIbEFVQUF2UU1BSVlRQ0FRQzhBd0FocEFJQUFJb0VwQUlpcFFJQkFMd0RBQ0dtQWdFQXlBTUFJYWNDSUFETUF3QWhCLUlCQVFBQUFBSGxBVUFBQUFBQmhBSUJBQUFBQWFRQ0FBQUFwQUlDcFFJQkFBQUFBYVlDQVFBQUFBR25BaUFBQUFBQkJBZ0FBTUVEQUNEaUFRRUFBQUFCNUFFQkFBQUFBZVVCUUFBQUFBRUNBQUFBR0FBZ0l3QUFtQVFBSUFNQUFBQVlBQ0FqQUFDWUJBQWdKQUFBbHdRQUlBRWNBQUNqQmdBd0NnY0FBS0VEQUNBSUFBQ3JBd0FnM3dFQUFLb0RBRERnQVFBQUZnQVE0UUVBQUtvREFERGlBUUVBQUFBQjR3RUJBT3NDQUNIa0FRRUE2d0lBSWVVQlFBRHlBZ0FodFFJQUFLa0RBQ0FDQUFBQUdBQWdIQUFBbHdRQUlBSUFBQUNWQkFBZ0hBQUFsZ1FBSUFmZkFRQUFsQVFBTU9BQkFBQ1ZCQUFRNFFFQUFKUUVBRERpQVFFQTZ3SUFJZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUlRZmZBUUFBbEFRQU1PQUJBQUNWQkFBUTRRRUFBSlFFQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJUVBpQVFFQXZBTUFJZVFCQVFDOEF3QWg1UUZBQUwwREFDRUVDQUFBdndNQUlPSUJBUUM4QXdBaDVBRUJBTHdEQUNIbEFVQUF2UU1BSVFRSUFBREJBd0FnNGdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQkN4RUFBTEFFQUNEaUFRRUFBQUFCNVFGQUFBQUFBZm9CQUFBQXNnSUNfZ0VnQUFBQUFZQUNRQUFBQUFHRUFnRUFBQUFCaFFJQkFBQUFBYTRDQVFBQUFBR3ZBZ0VBQUFBQnNBSUJBQUFBQVFJQUFBQWhBQ0FqQUFDdkJBQWdBd0FBQUNFQUlDTUFBSzhFQUNBa0FBQ2tCQUFnQVJ3QUFLSUdBREFRRVFBQS1RSUFJQk1BQUtFREFDRGZBUUFBcHdNQU1PQUJBQUFmQUJEaEFRQUFwd01BTU9JQkFRQUFBQUhsQVVBQThnSUFJZm9CQUFDb0E3SUNJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUUFBQUFHdUFnRUE2d0lBSWE4Q0FRRHJBZ0Foc0FJQkFPc0NBQ0d5QWdFQTZ3SUFJUUlBQUFBaEFDQWNBQUNrQkFBZ0FnQUFBS0VFQUNBY0FBQ2lCQUFnRHQ4QkFBQ2dCQUF3NEFFQUFLRUVBQkRoQVFBQW9BUUFNT0lCQVFEckFnQWg1UUZBQVBJQ0FDSDZBUUFBcUFPeUFpTC1BU0FBOEFJQUlZQUNRQUR5QWdBaGhBSUJBT3NDQUNHRkFnRUE2d0lBSWE0Q0FRRHJBZ0FocndJQkFPc0NBQ0d3QWdFQTZ3SUFJYklDQVFEckFnQWhEdDhCQUFDZ0JBQXc0QUVBQUtFRUFCRGhBUUFBb0FRQU1PSUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFxQU95QWlMLUFTQUE4QUlBSVlBQ1FBRHlBZ0FoaEFJQkFPc0NBQ0dGQWdFQTZ3SUFJYTRDQVFEckFnQWhyd0lCQU9zQ0FDR3dBZ0VBNndJQUliSUNBUURyQWdBaEN1SUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUFvd1N5QWlMLUFTQUF6QU1BSVlBQ1FBQzlBd0FoaEFJQkFMd0RBQ0dGQWdFQXZBTUFJYTRDQVFDOEF3QWhyd0lCQUx3REFDR3dBZ0VBdkFNQUlRRzdBZ0FBQUxJQ0Fnc1JBQUNsQkFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBQ2pCTElDSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhyZ0lCQUx3REFDR3ZBZ0VBdkFNQUliQUNBUUM4QXdBaEN5TUFBS1lFQURBa0FBQ3FCQUF3dUFJQUFLY0VBREM1QWdBQXFBUUFNTG9DQUFDcEJBQWd1d0lBQU9jREFEQzhBZ0FBNXdNQU1MMENBQURuQXdBd3ZnSUFBT2NEQURDX0FnQUFxd1FBTU1BQ0FBRHFBd0F3Q2djQUFQd0RBQ0FWQUFEX0F3QWdGZ0FBX1FNQUlPSUJBUUFBQUFIakFRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQnJ3SUJBQUFBQWJRQ0FRQUFBQUVDQUFBQUFRQWdJd0FBcmdRQUlBTUFBQUFCQUNBakFBQ3VCQUFnSkFBQXJRUUFJQUVjQUFDaEJnQXdBZ0FBQUFFQUlCd0FBSzBFQUNBQ0FBQUE2d01BSUJ3QUFLd0VBQ0FINGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUlhOENBUUM4QXdBaHRBSUJBTWdEQUNFS0J3QUEtUU1BSUJVQUFPOERBQ0FXQUFEd0F3QWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaF9nRWdBTXdEQUNHQUFrQUF2UU1BSWE4Q0FRQzhBd0FodEFJQkFNZ0RBQ0VLQndBQV9BTUFJQlVBQVA4REFDQVdBQUQ5QXdBZzRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJfZ0VnQUFBQUFZQUNRQUFBQUFHdkFnRUFBQUFCdEFJQkFBQUFBUXNSQUFDd0JBQWc0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBTElDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHdUFnRUFBQUFCcndJQkFBQUFBYkFDQVFBQUFBRUVJd0FBcGdRQU1MZ0NBQUNuQkFBd3VnSUFBS2tFQUNDLUFnQUE1d01BTUFnSUFBQy1CQUFnNGdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQl9nRWdBQUFBQVlBQ1FBQUFBQUdLQWdJQUFBQUJrZ0lCQUFBQUFRSUFBQUFVQUNBakFBQzlCQUFnQXdBQUFCUUFJQ01BQUwwRUFDQWtBQUM3QkFBZ0FSd0FBS0FHQURBT0J3QUFvUU1BSUFnQUFLc0RBQ0RmQVFBQXJRTUFNT0FCQUFBU0FCRGhBUUFBclFNQU1PSUJBUUFBQUFIakFRRUE2d0lBSWVRQkFRRHJBZ0FoNVFGQUFQSUNBQ0gtQVNBQThBSUFJWUFDUUFEeUFnQWhpZ0lDQVBFQ0FDR1NBZ0VBNndJQUliVUNBQUNzQXdBZ0FnQUFBQlFBSUJ3QUFMc0VBQ0FDQUFBQXVRUUFJQndBQUxvRUFDQUwzd0VBQUxnRUFERGdBUUFBdVFRQUVPRUJBQUM0QkFBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVRQkFRRHJBZ0FoNVFGQUFQSUNBQ0gtQVNBQThBSUFJWUFDUUFEeUFnQWhpZ0lDQVBFQ0FDR1NBZ0VBNndJQUlRdmZBUUFBdUFRQU1PQUJBQUM1QkFBUTRRRUFBTGdFQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0tBZ0lBOFFJQUlaSUNBUURyQWdBaEItSUJBUUM4QXdBaDVBRUJBTHdEQUNIbEFVQUF2UU1BSWY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dLQWdJQXpRTUFJWklDQVFDOEF3QWhDQWdBQUx3RUFDRGlBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNILUFTQUF6QU1BSVlBQ1FBQzlBd0FoaWdJQ0FNMERBQ0dTQWdFQXZBTUFJUVVqQUFDYkJnQWdKQUFBbmdZQUlMZ0NBQUNjQmdBZ3VRSUFBSjBHQUNDLUFnQUFCUUFnQ0FnQUFMNEVBQ0RpQVFFQUFBQUI1QUVCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBWW9DQWdBQUFBR1NBZ0VBQUFBQkF5TUFBSnNHQUNDNEFnQUFuQVlBSUw0Q0FBQUZBQ0FLQ0FBQTNBUUFJQW9BQU4wRUFDRGlBUUVBQUFBQjVBRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFLNENBb0FDUUFBQUFBR3FBa0FBQUFBQnF3SUNBQUFBQWF3Q0VBQUFBQUVDQUFBQUN3QWdJd0FBMndRQUlBTUFBQUFMQUNBakFBRGJCQUFnSkFBQXl3UUFJQUVjQUFDYUJnQXdEd2NBQUtFREFDQUlBQUNyQXdBZ0NnQUF0QU1BSU44QkFBQ3lBd0F3NEFFQUFBa0FFT0VCQUFDeUF3QXc0Z0VCQUFBQUFlTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ3pBNjRDSW9BQ1FBRHlBZ0FocWdKQUFQSUNBQ0dyQWdJQThRSUFJYXdDRUFDdkF3QWhBZ0FBQUFzQUlCd0FBTXNFQUNBQ0FBQUF4d1FBSUJ3QUFNZ0VBQ0FNM3dFQUFNWUVBRERnQVFBQXh3UUFFT0VCQUFER0JBQXc0Z0VCQU9zQ0FDSGpBUUVBNndJQUllUUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFzd091QWlLQUFrQUE4Z0lBSWFvQ1FBRHlBZ0FocXdJQ0FQRUNBQ0dzQWhBQXJ3TUFJUXpmQVFBQXhnUUFNT0FCQUFESEJBQVE0UUVBQU1ZRUFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ3pBNjRDSW9BQ1FBRHlBZ0FocWdKQUFQSUNBQ0dyQWdJQThRSUFJYXdDRUFDdkF3QWhDT0lCQVFDOEF3QWg1QUVCQUx3REFDSGxBVUFBdlFNQUlmb0JBQURLQks0Q0lvQUNRQUM5QXdBaHFnSkFBTDBEQUNHckFnSUF6UU1BSWF3Q0VBREpCQUFoQmJzQ0VBQUFBQUhDQWhBQUFBQUJ3d0lRQUFBQUFjUUNFQUFBQUFIRkFoQUFBQUFCQWJzQ0FBQUFyZ0lDQ2dnQUFNd0VBQ0FLQUFETkJBQWc0Z0VCQUx3REFDSGtBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBTW9FcmdJaWdBSkFBTDBEQUNHcUFrQUF2UU1BSWFzQ0FnRE5Bd0FockFJUUFNa0VBQ0VGSXdBQWxBWUFJQ1FBQUpnR0FDQzRBZ0FBbFFZQUlMa0NBQUNYQmdBZ3ZnSUFBQVVBSUFzakFBRE9CQUF3SkFBQTB3UUFNTGdDQUFEUEJBQXd1UUlBQU5BRUFEQzZBZ0FBMFFRQUlMc0NBQURTQkFBd3ZBSUFBTklFQURDOUFnQUEwZ1FBTUw0Q0FBRFNCQUF3dndJQUFOUUVBRERBQWdBQTFRUUFNQV9pQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBbkFJQ2dBSkFBQUFBQVpjQ0FRQUFBQUdZQWdFQUFBQUJtUUlRQUFBQUFab0NBUUFBQUFHY0FnRUFBQUFCblFJQkFBQUFBWjRDQVFBQUFBR2ZBZ0VBQUFBQm9BSkFBQUFBQWFFQ0FRQUFBQUdpQWtBQUFBQUJBZ0FBQUE4QUlDTUFBTm9FQUNBREFBQUFEd0FnSXdBQTJnUUFJQ1FBQU5rRUFDQUJIQUFBbGdZQU1CUUpBQUN4QXdBZzN3RUFBSzREQUREZ0FRQUFEUUFRNFFFQUFLNERBRERpQVFFQUFBQUI1UUZBQVBJQ0FDSDZBUUFBc0FPY0FpS0FBa0FBOGdJQUlaWUNBUURyQWdBaGx3SUJBQUFBQVpnQ0FRRHNBZ0FobVFJUUFLOERBQ0dhQWdFQTZ3SUFJWndDQVFEc0FnQWhuUUlCQU93Q0FDR2VBZ0VBN0FJQUlaOENBUURzQWdBaG9BSkFBS0FEQUNHaEFnRUE3QUlBSWFJQ1FBQ2dBd0FoQWdBQUFBOEFJQndBQU5rRUFDQUNBQUFBMWdRQUlCd0FBTmNFQUNBVDN3RUFBTlVFQUREZ0FRQUExZ1FBRU9FQkFBRFZCQUF3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDd0E1d0NJb0FDUUFEeUFnQWhsZ0lCQU9zQ0FDR1hBZ0VBNndJQUlaZ0NBUURzQWdBaG1RSVFBSzhEQUNHYUFnRUE2d0lBSVp3Q0FRRHNBZ0FoblFJQkFPd0NBQ0dlQWdFQTdBSUFJWjhDQVFEc0FnQWhvQUpBQUtBREFDR2hBZ0VBN0FJQUlhSUNRQUNnQXdBaEU5OEJBQURWQkFBdzRBRUFBTllFQUJEaEFRQUExUVFBTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0g2QVFBQXNBT2NBaUtBQWtBQThnSUFJWllDQVFEckFnQWhsd0lCQU9zQ0FDR1lBZ0VBN0FJQUlaa0NFQUN2QXdBaG1nSUJBT3NDQUNHY0FnRUE3QUlBSVowQ0FRRHNBZ0FobmdJQkFPd0NBQ0dmQWdFQTdBSUFJYUFDUUFDZ0F3QWhvUUlCQU93Q0FDR2lBa0FBb0FNQUlRX2lBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBTmdFbkFJaWdBSkFBTDBEQUNHWEFnRUF2QU1BSVpnQ0FRRElBd0FobVFJUUFNa0VBQ0dhQWdFQXZBTUFJWndDQVFESUF3QWhuUUlCQU1nREFDR2VBZ0VBeUFNQUlaOENBUURJQXdBaG9BSkFBT0FEQUNHaEFnRUF5QU1BSWFJQ1FBRGdBd0FoQWJzQ0FBQUFuQUlDRC1JQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTJBU2NBaUtBQWtBQXZRTUFJWmNDQVFDOEF3QWhtQUlCQU1nREFDR1pBaEFBeVFRQUlab0NBUUM4QXdBaG5BSUJBTWdEQUNHZEFnRUF5QU1BSVo0Q0FRRElBd0FobndJQkFNZ0RBQ0dnQWtBQTRBTUFJYUVDQVFESUF3QWhvZ0pBQU9BREFDRVA0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSndDQW9BQ1FBQUFBQUdYQWdFQUFBQUJtQUlCQUFBQUFaa0NFQUFBQUFHYUFnRUFBQUFCbkFJQkFBQUFBWjBDQVFBQUFBR2VBZ0VBQUFBQm53SUJBQUFBQWFBQ1FBQUFBQUdoQWdFQUFBQUJvZ0pBQUFBQUFRb0lBQURjQkFBZ0NnQUEzUVFBSU9JQkFRQUFBQUhrQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBcmdJQ2dBSkFBQUFBQWFvQ1FBQUFBQUdyQWdJQUFBQUJyQUlRQUFBQUFRTWpBQUNVQmdBZ3VBSUFBSlVHQUNDLUFnQUFCUUFnQkNNQUFNNEVBREM0QWdBQXp3UUFNTG9DQUFEUkJBQWd2Z0lBQU5JRUFEQVNCUUFBa1FVQUlBc0FBSklGQUNBTUFBQ1RCUUFnRFFBQWxBVUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNOQWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQmhnSUJBQUFBQVljQ0FRQUFBQUdJQWhBQUFBQUJpUUlDQUFBQUFZb0NDQUFBQUFHTEFnQUFrQVVBSUkwQ0FRQUFBQUVDQUFBQUJRQWdJd0FBandVQUlBTUFBQUFGQUNBakFBQ1BCUUFnSkFBQTZ3UUFJQUVjQUFDVEJnQXdGd1VBQUxnREFDQUdBQUNoQXdBZ0N3QUE5QUlBSUF3QUFQVUNBQ0FOQUFEM0FnQWczd0VBQUxVREFERGdBUUFBQXdBUTRRRUFBTFVEQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0g2QVFBQXR3T05BaUwtQVNBQThBSUFJWUFDUUFEeUFnQWhoQUlCQU9zQ0FDR0ZBZ0VBQUFBQmhnSUJBT3NDQUNHSEFnRUE2d0lBSVlnQ0VBQ3ZBd0FoaVFJQ0FQRUNBQ0dLQWdnQXRnTUFJWXNDQUFELUFnQWdqUUlCQU9zQ0FDR09BZ0VBNndJQUlRSUFBQUFGQUNBY0FBRHJCQUFnQWdBQUFPWUVBQ0FjQUFEbkJBQWdFdDhCQUFEbEJBQXc0QUVBQU9ZRUFCRGhBUUFBNVFRQU1PSUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUF0d09OQWlMLUFTQUE4QUlBSVlBQ1FBRHlBZ0FoaEFJQkFPc0NBQ0dGQWdFQTZ3SUFJWVlDQVFEckFnQWhod0lCQU9zQ0FDR0lBaEFBcndNQUlZa0NBZ0R4QWdBaGlnSUlBTFlEQUNHTEFnQUFfZ0lBSUkwQ0FRRHJBZ0FoamdJQkFPc0NBQ0VTM3dFQUFPVUVBRERnQVFBQTVnUUFFT0VCQUFEbEJBQXc0Z0VCQU9zQ0FDSGxBVUFBOGdJQUlmb0JBQUMzQTQwQ0l2NEJJQUR3QWdBaGdBSkFBUElDQUNHRUFnRUE2d0lBSVlVQ0FRRHJBZ0FoaGdJQkFPc0NBQ0dIQWdFQTZ3SUFJWWdDRUFDdkF3QWhpUUlDQVBFQ0FDR0tBZ2dBdGdNQUlZc0NBQUQtQWdBZ2pRSUJBT3NDQUNHT0FnRUE2d0lBSVE3aUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFPb0VqUUlpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR0dBZ0VBdkFNQUlZY0NBUUM4QXdBaGlBSVFBTWtFQUNHSkFnSUF6UU1BSVlvQ0NBRG9CQUFoaXdJQUFPa0VBQ0NOQWdFQXZBTUFJUVc3QWdnQUFBQUJ3Z0lJQUFBQUFjTUNDQUFBQUFIRUFnZ0FBQUFCeFFJSUFBQUFBUUs3QWdFQUFBQUV3UUlCQUFBQUJRRzdBZ0FBQUkwQ0FoSUZBQURzQkFBZ0N3QUE3UVFBSUF3QUFPNEVBQ0FOQUFEdkJBQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmb0JBQURxQkkwQ0l2NEJJQURNQXdBaGdBSkFBTDBEQUNHRUFnRUF2QU1BSVlVQ0FRQzhBd0FoaGdJQkFMd0RBQ0dIQWdFQXZBTUFJWWdDRUFESkJBQWhpUUlDQU0wREFDR0tBZ2dBNkFRQUlZc0NBQURwQkFBZ2pRSUJBTHdEQUNFRkl3QUFnUVlBSUNRQUFKRUdBQ0M0QWdBQWdnWUFJTGtDQUFDUUJnQWd2Z0lBQUg4QUlBc2pBQUNFQlFBd0pBQUFpQVVBTUxnQ0FBQ0ZCUUF3dVFJQUFJWUZBREM2QWdBQWh3VUFJTHNDQUFEREJBQXd2QUlBQU1NRUFEQzlBZ0FBd3dRQU1MNENBQUREQkFBd3Z3SUFBSWtGQUREQUFnQUF4Z1FBTUFzakFBRDVCQUF3SkFBQV9RUUFNTGdDQUFENkJBQXd1UUlBQVBzRUFEQzZBZ0FBX0FRQUlMc0NBQUMxQkFBd3ZBSUFBTFVFQURDOUFnQUF0UVFBTUw0Q0FBQzFCQUF3dndJQUFQNEVBRERBQWdBQXVBUUFNQXNqQUFEd0JBQXdKQUFBOUFRQU1MZ0NBQUR4QkFBd3VRSUFBUElFQURDNkFnQUE4d1FBSUxzQ0FBQ1JCQUF3dkFJQUFKRUVBREM5QWdBQWtRUUFNTDRDQUFDUkJBQXd2d0lBQVBVRUFEREFBZ0FBbEFRQU1BUUhBQURBQXdBZzRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJBZ0FBQUJnQUlDTUFBUGdFQUNBREFBQUFHQUFnSXdBQS1BUUFJQ1FBQVBjRUFDQUJIQUFBandZQU1BSUFBQUFZQUNBY0FBRDNCQUFnQWdBQUFKVUVBQ0FjQUFEMkJBQWdBLUlCQVFDOEF3QWg0d0VCQUx3REFDSGxBVUFBdlFNQUlRUUhBQUMtQXdBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoQkFjQUFNQURBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFFSUJ3QUFnd1VBSU9JQkFRQUFBQUhqQVFFQUFBQUI1UUZBQUFBQUFmNEJJQUFBQUFHQUFrQUFBQUFCaWdJQ0FBQUFBWklDQVFBQUFBRUNBQUFBRkFBZ0l3QUFnZ1VBSUFNQUFBQVVBQ0FqQUFDQ0JRQWdKQUFBZ0FVQUlBRWNBQUNPQmdBd0FnQUFBQlFBSUJ3QUFJQUZBQ0FDQUFBQXVRUUFJQndBQVA4RUFDQUg0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaF9nRWdBTXdEQUNHQUFrQUF2UU1BSVlvQ0FnRE5Bd0Foa2dJQkFMd0RBQ0VJQndBQWdRVUFJT0lCQVFDOEF3QWg0d0VCQUx3REFDSGxBVUFBdlFNQUlmNEJJQURNQXdBaGdBSkFBTDBEQUNHS0FnSUF6UU1BSVpJQ0FRQzhBd0FoQlNNQUFJa0dBQ0FrQUFDTUJnQWd1QUlBQUlvR0FDQzVBZ0FBaXdZQUlMNENBQUNmQWdBZ0NBY0FBSU1GQUNEaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQVlvQ0FnQUFBQUdTQWdFQUFBQUJBeU1BQUlrR0FDQzRBZ0FBaWdZQUlMNENBQUNmQWdBZ0NnY0FBSTRGQUNBS0FBRGRCQUFnNGdFQkFBQUFBZU1CQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN1QWdLQUFrQUFBQUFCcWdKQUFBQUFBYXNDQWdBQUFBR3NBaEFBQUFBQkFnQUFBQXNBSUNNQUFJMEZBQ0FEQUFBQUN3QWdJd0FBalFVQUlDUUFBSXNGQUNBQkhBQUFpQVlBTUFJQUFBQUxBQ0FjQUFDTEJRQWdBZ0FBQU1jRUFDQWNBQUNLQlFBZ0NPSUJBUUM4QXdBaDR3RUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBREtCSzRDSW9BQ1FBQzlBd0FocWdKQUFMMERBQ0dyQWdJQXpRTUFJYXdDRUFESkJBQWhDZ2NBQUl3RkFDQUtBQUROQkFBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFNb0VyZ0lpZ0FKQUFMMERBQ0dxQWtBQXZRTUFJYXNDQWdETkF3QWhyQUlRQU1rRUFDRUZJd0FBZ3dZQUlDUUFBSVlHQUNDNEFnQUFoQVlBSUxrQ0FBQ0ZCZ0FndmdJQUFKOENBQ0FLQndBQWpnVUFJQW9BQU4wRUFDRGlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFLNENBb0FDUUFBQUFBR3FBa0FBQUFBQnF3SUNBQUFBQWF3Q0VBQUFBQUVESXdBQWd3WUFJTGdDQUFDRUJnQWd2Z0lBQUo4Q0FDQVNCUUFBa1FVQUlBc0FBSklGQUNBTUFBQ1RCUUFnRFFBQWxBVUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNOQWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQmhnSUJBQUFBQVljQ0FRQUFBQUdJQWhBQUFBQUJpUUlDQUFBQUFZb0NDQUFBQUFHTEFnQUFrQVVBSUkwQ0FRQUFBQUVCdXdJQkFBQUFCQU1qQUFDQkJnQWd1QUlBQUlJR0FDQy1BZ0FBZndBZ0JDTUFBSVFGQURDNEFnQUFoUVVBTUxvQ0FBQ0hCUUFndmdJQUFNTUVBREFFSXdBQS1RUUFNTGdDQUFENkJBQXd1Z0lBQVB3RUFDQy1BZ0FBdFFRQU1BUWpBQUR3QkFBd3VBSUFBUEVFQURDNkFnQUE4d1FBSUw0Q0FBQ1JCQUF3QkNNQUFONEVBREM0QWdBQTN3UUFNTG9DQUFEaEJBQWd2Z0lBQU9JRUFEQUVJd0FBdndRQU1MZ0NBQURBQkFBd3VnSUFBTUlFQUNDLUFnQUF3d1FBTUFRakFBQ3hCQUF3dUFJQUFMSUVBREM2QWdBQXRBUUFJTDRDQUFDMUJBQXdCQ01BQUprRUFEQzRBZ0FBbWdRQU1Mb0NBQUNjQkFBZ3ZnSUFBSjBFQURBRUl3QUFqUVFBTUxnQ0FBQ09CQUF3dWdJQUFKQUVBQ0MtQWdBQWtRUUFNQVFqQUFDQUJBQXd1QUlBQUlFRUFEQzZBZ0FBZ3dRQUlMNENBQUNFQkFBd0JDTUFBT01EQURDNEFnQUE1QU1BTUxvQ0FBRG1Bd0FndmdJQUFPY0RBREFFSXdBQTFnTUFNTGdDQUFEWEF3QXd1Z0lBQU5rREFDQy1BZ0FBMmdNQU1BQUFBQUFBQUFBQUFBQUFBQUFGSXdBQV9BVUFJQ1FBQVA4RkFDQzRBZ0FBX1FVQUlMa0NBQUQtQlFBZ3ZnSUFBSjhDQUNBREl3QUFfQVVBSUxnQ0FBRDlCUUFndmdJQUFKOENBQ0FBQUFBQUFBQUFBQVVqQUFEM0JRQWdKQUFBLWdVQUlMZ0NBQUQ0QlFBZ3VRSUFBUGtGQUNDLUFnQUFud0lBSUFNakFBRDNCUUFndUFJQUFQZ0ZBQ0MtQWdBQW53SUFJQUFBQUFBQUJTTUFBUElGQUNBa0FBRDFCUUFndUFJQUFQTUZBQ0M1QWdBQTlBVUFJTDRDQUFBTEFDQURJd0FBOGdVQUlMZ0NBQUR6QlFBZ3ZnSUFBQXNBSUFBQUFBVWpBQUR0QlFBZ0pBQUE4QVVBSUxnQ0FBRHVCUUFndVFJQUFPOEZBQ0MtQWdBQW53SUFJQU1qQUFEdEJRQWd1QUlBQU80RkFDQy1BZ0FBbndJQUlBQUFBQUFBQUFzakFBREpCUUF3SkFBQXpRVUFNTGdDQUFES0JRQXd1UUlBQU1zRkFEQzZBZ0FBekFVQUlMc0NBQURpQkFBd3ZBSUFBT0lFQURDOUFnQUE0Z1FBTUw0Q0FBRGlCQUF3dndJQUFNNEZBRERBQWdBQTVRUUFNQklHQUFDckJRQWdDd0FBa2dVQUlBd0FBSk1GQUNBTkFBQ1VCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSDZBUUFBQUkwQ0F2NEJJQUFBQUFHQUFrQUFBQUFCaEFJQkFBQUFBWVVDQVFBQUFBR0dBZ0VBQUFBQmh3SUJBQUFBQVlnQ0VBQUFBQUdKQWdJQUFBQUJpZ0lJQUFBQUFZc0NBQUNRQlFBZ2pnSUJBQUFBQVFJQUFBQUZBQ0FqQUFEUkJRQWdBd0FBQUFVQUlDTUFBTkVGQUNBa0FBRFFCUUFnQVJ3QUFPd0ZBREFDQUFBQUJRQWdIQUFBMEFVQUlBSUFBQURtQkFBZ0hBQUF6d1VBSUE3aUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFPb0VqUUlpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR0dBZ0VBdkFNQUlZY0NBUUM4QXdBaGlBSVFBTWtFQUNHSkFnSUF6UU1BSVlvQ0NBRG9CQUFoaXdJQUFPa0VBQ0NPQWdFQXZBTUFJUklHQUFDcUJRQWdDd0FBN1FRQUlBd0FBTzRFQUNBTkFBRHZCQUFnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFEcUJJMENJdjRCSUFETUF3QWhnQUpBQUwwREFDR0VBZ0VBdkFNQUlZVUNBUUM4QXdBaGhnSUJBTHdEQUNHSEFnRUF2QU1BSVlnQ0VBREpCQUFoaVFJQ0FNMERBQ0dLQWdnQTZBUUFJWXNDQUFEcEJBQWdqZ0lCQUx3REFDRVNCZ0FBcXdVQUlBc0FBSklGQUNBTUFBQ1RCUUFnRFFBQWxBVUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNOQWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQmhnSUJBQUFBQVljQ0FRQUFBQUdJQWhBQUFBQUJpUUlDQUFBQUFZb0NDQUFBQUFHTEFnQUFrQVVBSUk0Q0FRQUFBQUVFSXdBQXlRVUFNTGdDQUFES0JRQXd1Z0lBQU13RkFDQy1BZ0FBNGdRQU1BQUFBQUFBQUFBQUJTTUFBT2NGQUNBa0FBRHFCUUFndUFJQUFPZ0ZBQ0M1QWdBQTZRVUFJTDRDQUFDZkFnQWdBeU1BQU9jRkFDQzRBZ0FBNkFVQUlMNENBQUNmQWdBZ0FBQUFEQU1BQUowRkFDQUxBQUNlQlFBZ0RBQUFud1VBSUE0QUFLQUZBQ0FQQUFDaEJRQWdFQUFBb2dVQUlCRUFBS01GQUNBU0FBQ2tCUUFnOHdFQUFNSURBQ0QwQVFBQXdnTUFJUFVCQUFEQ0F3QWc5Z0VBQU1JREFDQUNFUUFBb3dVQUlCTUFBT0FGQUNBRkJ3QUE0QVVBSUJRQUFPRUZBQ0FWQUFEaUJRQWdGZ0FBb3dVQUlMUUNBQURDQXdBZ0JRVUFBT1lGQUNBR0FBRGdCUUFnQ3dBQW5nVUFJQXdBQUo4RkFDQU5BQUNoQlFBZ0F3Y0FBT0FGQUNBSUFBRGpCUUFnQ2dBQTVRVUFJQUFCQXdBQW5RVUFJQllEQUFDVkJRQWdDd0FBbGdVQUlBd0FBSmNGQUNBUEFBQ1pCUUFnRUFBQW1nVUFJQkVBQUpzRkFDQVNBQUNjQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUh4QVFFQUFBQUI4Z0VCQUFBQUFmTUJBUUFBQUFIMEFRRUFBQUFCOVFFQkFBQUFBZllCQVFBQUFBSDRBUUFBQVBnQkF2b0JBQUFBLWdFQ19BRUFBQUQ4QVFMOUFTQUFBQUFCX2dFZ0FBQUFBZjhCQWdBQUFBR0FBa0FBQUFBQkFnQUFBSjhDQUNBakFBRG5CUUFnQXdBQUFLSUNBQ0FqQUFEbkJRQWdKQUFBNndVQUlCZ0FBQUNpQWdBZ0F3QUF6Z01BSUFzQUFNOERBQ0FNQUFEUUF3QWdEd0FBMGdNQUlCQUFBTk1EQUNBUkFBRFVBd0FnRWdBQTFRTUFJQndBQU9zRkFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFV0F3QUF6Z01BSUFzQUFNOERBQ0FNQUFEUUF3QWdEd0FBMGdNQUlCQUFBTk1EQUNBUkFBRFVBd0FnRWdBQTFRTUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaDh3RUJBTWdEQUNIMEFRRUF5QU1BSWZVQkFRRElBd0FoOWdFQkFNZ0RBQ0g0QVFBQXlRUDRBU0w2QVFBQXlnUDZBU0w4QVFBQXl3UDhBU0w5QVNBQXpBTUFJZjRCSUFETUF3QWhfd0VDQU0wREFDR0FBa0FBdlFNQUlRN2lBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFqUUlDX2dFZ0FBQUFBWUFDUUFBQUFBR0VBZ0VBQUFBQmhRSUJBQUFBQVlZQ0FRQUFBQUdIQWdFQUFBQUJpQUlRQUFBQUFZa0NBZ0FBQUFHS0FnZ0FBQUFCaXdJQUFKQUZBQ0NPQWdFQUFBQUJGZ01BQUpVRkFDQUxBQUNXQlFBZ0RBQUFsd1VBSUE0QUFKZ0ZBQ0FQQUFDWkJRQWdFUUFBbXdVQUlCSUFBSndGQUNEaUFRRUFBQUFCNVFGQUFBQUFBZkVCQVFBQUFBSHlBUUVBQUFBQjh3RUJBQUFBQWZRQkFRQUFBQUgxQVFFQUFBQUI5Z0VCQUFBQUFmZ0JBQUFBLUFFQy1nRUFBQUQ2QVFMOEFRQUFBUHdCQXYwQklBQUFBQUgtQVNBQUFBQUJfd0VDQUFBQUFZQUNRQUFBQUFFQ0FBQUFud0lBSUNNQUFPMEZBQ0FEQUFBQW9nSUFJQ01BQU8wRkFDQWtBQUR4QlFBZ0dBQUFBS0lDQUNBREFBRE9Bd0FnQ3dBQXp3TUFJQXdBQU5BREFDQU9BQURSQXdBZ0R3QUEwZ01BSUJFQUFOUURBQ0FTQUFEVkF3QWdIQUFBOFFVQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoOHdFQkFNZ0RBQ0gwQVFFQXlBTUFJZlVCQVFESUF3QWg5Z0VCQU1nREFDSDRBUUFBeVFQNEFTTDZBUUFBeWdQNkFTTDhBUUFBeXdQOEFTTDlBU0FBekFNQUlmNEJJQURNQXdBaF93RUNBTTBEQUNHQUFrQUF2UU1BSVJZREFBRE9Bd0FnQ3dBQXp3TUFJQXdBQU5BREFDQU9BQURSQXdBZ0R3QUEwZ01BSUJFQUFOUURBQ0FTQUFEVkF3QWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaEN3Y0FBSTRGQUNBSUFBRGNCQUFnNGdFQkFBQUFBZU1CQVFBQUFBSGtBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFyZ0lDZ0FKQUFBQUFBYW9DUUFBQUFBR3JBZ0lBQUFBQnJBSVFBQUFBQVFJQUFBQUxBQ0FqQUFEeUJRQWdBd0FBQUFrQUlDTUFBUElGQUNBa0FBRDJCUUFnRFFBQUFBa0FJQWNBQUl3RkFDQUlBQURNQkFBZ0hBQUE5Z1VBSU9JQkFRQzhBd0FoNHdFQkFMd0RBQ0hrQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQU1vRXJnSWlnQUpBQUwwREFDR3FBa0FBdlFNQUlhc0NBZ0ROQXdBaHJBSVFBTWtFQUNFTEJ3QUFqQVVBSUFnQUFNd0VBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1QUVCQUx3REFDSGxBVUFBdlFNQUlmb0JBQURLQks0Q0lvQUNRQUM5QXdBaHFnSkFBTDBEQUNHckFnSUF6UU1BSWF3Q0VBREpCQUFoRmdNQUFKVUZBQ0FMQUFDV0JRQWdEQUFBbHdVQUlBNEFBSmdGQUNBUEFBQ1pCUUFnRUFBQW1nVUFJQkVBQUpzRkFDRGlBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUh5QVFFQUFBQUI4d0VCQUFBQUFmUUJBUUFBQUFIMUFRRUFBQUFCOWdFQkFBQUFBZmdCQUFBQS1BRUMtZ0VBQUFENkFRTDhBUUFBQVB3QkF2MEJJQUFBQUFILUFTQUFBQUFCX3dFQ0FBQUFBWUFDUUFBQUFBRUNBQUFBbndJQUlDTUFBUGNGQUNBREFBQUFvZ0lBSUNNQUFQY0ZBQ0FrQUFEN0JRQWdHQUFBQUtJQ0FDQURBQURPQXdBZ0N3QUF6d01BSUF3QUFOQURBQ0FPQUFEUkF3QWdEd0FBMGdNQUlCQUFBTk1EQUNBUkFBRFVBd0FnSEFBQS13VUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaDh3RUJBTWdEQUNIMEFRRUF5QU1BSWZVQkFRRElBd0FoOWdFQkFNZ0RBQ0g0QVFBQXlRUDRBU0w2QVFBQXlnUDZBU0w4QVFBQXl3UDhBU0w5QVNBQXpBTUFJZjRCSUFETUF3QWhfd0VDQU0wREFDR0FBa0FBdlFNQUlSWURBQURPQXdBZ0N3QUF6d01BSUF3QUFOQURBQ0FPQUFEUkF3QWdEd0FBMGdNQUlCQUFBTk1EQUNBUkFBRFVBd0FnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZkVCQVFDOEF3QWg4Z0VCQUx3REFDSHpBUUVBeUFNQUlmUUJBUURJQXdBaDlRRUJBTWdEQUNIMkFRRUF5QU1BSWZnQkFBREpBX2dCSXZvQkFBREtBX29CSXZ3QkFBRExBX3dCSXYwQklBRE1Bd0FoX2dFZ0FNd0RBQ0hfQVFJQXpRTUFJWUFDUUFDOUF3QWhGZ3NBQUpZRkFDQU1BQUNYQlFBZ0RnQUFtQVVBSUE4QUFKa0ZBQ0FRQUFDYUJRQWdFUUFBbXdVQUlCSUFBSndGQUNEaUFRRUFBQUFCNVFGQUFBQUFBZkVCQVFBQUFBSHlBUUVBQUFBQjh3RUJBQUFBQWZRQkFRQUFBQUgxQVFFQUFBQUI5Z0VCQUFBQUFmZ0JBQUFBLUFFQy1nRUFBQUQ2QVFMOEFRQUFBUHdCQXYwQklBQUFBQUgtQVNBQUFBQUJfd0VDQUFBQUFZQUNRQUFBQUFFQ0FBQUFud0lBSUNNQUFQd0ZBQ0FEQUFBQW9nSUFJQ01BQVB3RkFDQWtBQUNBQmdBZ0dBQUFBS0lDQUNBTEFBRFBBd0FnREFBQTBBTUFJQTRBQU5FREFDQVBBQURTQXdBZ0VBQUEwd01BSUJFQUFOUURBQ0FTQUFEVkF3QWdIQUFBZ0FZQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoOHdFQkFNZ0RBQ0gwQVFFQXlBTUFJZlVCQVFESUF3QWg5Z0VCQU1nREFDSDRBUUFBeVFQNEFTTDZBUUFBeWdQNkFTTDhBUUFBeXdQOEFTTDlBU0FBekFNQUlmNEJJQURNQXdBaF93RUNBTTBEQUNHQUFrQUF2UU1BSVJZTEFBRFBBd0FnREFBQTBBTUFJQTRBQU5FREFDQVBBQURTQXdBZ0VBQUEwd01BSUJFQUFOUURBQ0FTQUFEVkF3QWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaEJlSUJBUUFBQUFIbEFVQUFBQUFCOFFFQkFBQUFBWUFDUUFBQUFBR0ZBZ0VBQUFBQkFnQUFBSDhBSUNNQUFJRUdBQ0FXQXdBQWxRVUFJQXdBQUpjRkFDQU9BQUNZQlFBZ0R3QUFtUVVBSUJBQUFKb0ZBQ0FSQUFDYkJRQWdFZ0FBbkFVQUlPSUJBUUFBQUFIbEFVQUFBQUFCOFFFQkFBQUFBZklCQVFBQUFBSHpBUUVBQUFBQjlBRUJBQUFBQWZVQkFRQUFBQUgyQVFFQUFBQUItQUVBQUFENEFRTDZBUUFBQVBvQkF2d0JBQUFBX0FFQ19RRWdBQUFBQWY0QklBQUFBQUhfQVFJQUFBQUJnQUpBQUFBQUFRSUFBQUNmQWdBZ0l3QUFnd1lBSUFNQUFBQ2lBZ0FnSXdBQWd3WUFJQ1FBQUljR0FDQVlBQUFBb2dJQUlBTUFBTTREQUNBTUFBRFFBd0FnRGdBQTBRTUFJQThBQU5JREFDQVFBQURUQXdBZ0VRQUExQU1BSUJJQUFOVURBQ0FjQUFDSEJnQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaEZnTUFBTTREQUNBTUFBRFFBd0FnRGdBQTBRTUFJQThBQU5JREFDQVFBQURUQXdBZ0VRQUExQU1BSUJJQUFOVURBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDSHlBUUVBdkFNQUlmTUJBUURJQXdBaDlBRUJBTWdEQUNIMUFRRUF5QU1BSWZZQkFRRElBd0FoLUFFQUFNa0QtQUVpLWdFQUFNb0QtZ0VpX0FFQUFNc0RfQUVpX1FFZ0FNd0RBQ0gtQVNBQXpBTUFJZjhCQWdETkF3QWhnQUpBQUwwREFDRUk0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3VBZ0tBQWtBQUFBQUJxZ0pBQUFBQUFhc0NBZ0FBQUFHc0FoQUFBQUFCRmdNQUFKVUZBQ0FMQUFDV0JRQWdEZ0FBbUFVQUlBOEFBSmtGQUNBUUFBQ2FCUUFnRVFBQW13VUFJQklBQUp3RkFDRGlBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUh5QVFFQUFBQUI4d0VCQUFBQUFmUUJBUUFBQUFIMUFRRUFBQUFCOWdFQkFBQUFBZmdCQUFBQS1BRUMtZ0VBQUFENkFRTDhBUUFBQVB3QkF2MEJJQUFBQUFILUFTQUFBQUFCX3dFQ0FBQUFBWUFDUUFBQUFBRUNBQUFBbndJQUlDTUFBSWtHQUNBREFBQUFvZ0lBSUNNQUFJa0dBQ0FrQUFDTkJnQWdHQUFBQUtJQ0FDQURBQURPQXdBZ0N3QUF6d01BSUE0QUFORURBQ0FQQUFEU0F3QWdFQUFBMHdNQUlCRUFBTlFEQUNBU0FBRFZBd0FnSEFBQWpRWUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaDh3RUJBTWdEQUNIMEFRRUF5QU1BSWZVQkFRRElBd0FoOWdFQkFNZ0RBQ0g0QVFBQXlRUDRBU0w2QVFBQXlnUDZBU0w4QVFBQXl3UDhBU0w5QVNBQXpBTUFJZjRCSUFETUF3QWhfd0VDQU0wREFDR0FBa0FBdlFNQUlSWURBQURPQXdBZ0N3QUF6d01BSUE0QUFORURBQ0FQQUFEU0F3QWdFQUFBMHdNQUlCRUFBTlFEQUNBU0FBRFZBd0FnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZkVCQVFDOEF3QWg4Z0VCQUx3REFDSHpBUUVBeUFNQUlmUUJBUURJQXdBaDlRRUJBTWdEQUNIMkFRRUF5QU1BSWZnQkFBREpBX2dCSXZvQkFBREtBX29CSXZ3QkFBRExBX3dCSXYwQklBRE1Bd0FoX2dFZ0FNd0RBQ0hfQVFJQXpRTUFJWUFDUUFDOUF3QWhCLUlCQVFBQUFBSGpBUUVBQUFBQjVRRkFBQUFBQWY0QklBQUFBQUdBQWtBQUFBQUJpZ0lDQUFBQUFaSUNBUUFBQUFFRDRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJBd0FBQUlJQkFDQWpBQUNCQmdBZ0pBQUFrZ1lBSUFjQUFBQ0NBUUFnSEFBQWtnWUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlZQUNRQUM5QXdBaGhRSUJBTHdEQUNFRjRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoZ0FKQUFMMERBQ0dGQWdFQXZBTUFJUTdpQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBalFJQ19nRWdBQUFBQVlBQ1FBQUFBQUdFQWdFQUFBQUJoUUlCQUFBQUFZWUNBUUFBQUFHSEFnRUFBQUFCaUFJUUFBQUFBWWtDQWdBQUFBR0tBZ2dBQUFBQml3SUFBSkFGQUNDTkFnRUFBQUFCRXdVQUFKRUZBQ0FHQUFDckJRQWdEQUFBa3dVQUlBMEFBSlFGQUNEaUFRRUFBQUFCNVFGQUFBQUFBZm9CQUFBQWpRSUNfZ0VnQUFBQUFZQUNRQUFBQUFHRUFnRUFBQUFCaFFJQkFBQUFBWVlDQVFBQUFBR0hBZ0VBQUFBQmlBSVFBQUFBQVlrQ0FnQUFBQUdLQWdnQUFBQUJpd0lBQUpBRkFDQ05BZ0VBQUFBQmpnSUJBQUFBQVFJQUFBQUZBQ0FqQUFDVUJnQWdELUlCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNjQWdLQUFrQUFBQUFCbHdJQkFBQUFBWmdDQVFBQUFBR1pBaEFBQUFBQm1nSUJBQUFBQVp3Q0FRQUFBQUdkQWdFQUFBQUJuZ0lCQUFBQUFaOENBUUFBQUFHZ0FrQUFBQUFCb1FJQkFBQUFBYUlDUUFBQUFBRURBQUFBQXdBZ0l3QUFsQVlBSUNRQUFKa0dBQ0FWQUFBQUF3QWdCUUFBN0FRQUlBWUFBS29GQUNBTUFBRHVCQUFnRFFBQTd3UUFJQndBQUprR0FDRGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBT29FalFJaV9nRWdBTXdEQUNHQUFrQUF2UU1BSVlRQ0FRQzhBd0FoaFFJQkFMd0RBQ0dHQWdFQXZBTUFJWWNDQVFDOEF3QWhpQUlRQU1rRUFDR0pBZ0lBelFNQUlZb0NDQURvQkFBaGl3SUFBT2tFQUNDTkFnRUF2QU1BSVk0Q0FRQzhBd0FoRXdVQUFPd0VBQ0FHQUFDcUJRQWdEQUFBN2dRQUlBMEFBTzhFQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFPb0VqUUlpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR0dBZ0VBdkFNQUlZY0NBUUM4QXdBaGlBSVFBTWtFQUNHSkFnSUF6UU1BSVlvQ0NBRG9CQUFoaXdJQUFPa0VBQ0NOQWdFQXZBTUFJWTRDQVFDOEF3QWhDT0lCQVFBQUFBSGtBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFyZ0lDZ0FKQUFBQUFBYW9DUUFBQUFBR3JBZ0lBQUFBQnJBSVFBQUFBQVJNRkFBQ1JCUUFnQmdBQXF3VUFJQXNBQUpJRkFDQU5BQUNVQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFJMENBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUdHQWdFQUFBQUJod0lCQUFBQUFZZ0NFQUFBQUFHSkFnSUFBQUFCaWdJSUFBQUFBWXNDQUFDUUJRQWdqUUlCQUFBQUFZNENBUUFBQUFFQ0FBQUFCUUFnSXdBQW13WUFJQU1BQUFBREFDQWpBQUNiQmdBZ0pBQUFud1lBSUJVQUFBQURBQ0FGQUFEc0JBQWdCZ0FBcWdVQUlBc0FBTzBFQUNBTkFBRHZCQUFnSEFBQW53WUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBNmdTTkFpTC1BU0FBekFNQUlZQUNRQUM5QXdBaGhBSUJBTHdEQUNHRkFnRUF2QU1BSVlZQ0FRQzhBd0FoaHdJQkFMd0RBQ0dJQWhBQXlRUUFJWWtDQWdETkF3QWhpZ0lJQU9nRUFDR0xBZ0FBNlFRQUlJMENBUUM4QXdBaGpnSUJBTHdEQUNFVEJRQUE3QVFBSUFZQUFLb0ZBQ0FMQUFEdEJBQWdEUUFBN3dRQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUE2Z1NOQWlMLUFTQUF6QU1BSVlBQ1FBQzlBd0FoaEFJQkFMd0RBQ0dGQWdFQXZBTUFJWVlDQVFDOEF3QWhod0lCQUx3REFDR0lBaEFBeVFRQUlZa0NBZ0ROQXdBaGlnSUlBT2dFQUNHTEFnQUE2UVFBSUkwQ0FRQzhBd0FoamdJQkFMd0RBQ0VINGdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQl9nRWdBQUFBQVlBQ1FBQUFBQUdLQWdJQUFBQUJrZ0lCQUFBQUFRZmlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFhOENBUUFBQUFHMEFnRUFBQUFCQ3VJQkFRQUFBQUhsQVVBQUFBQUItZ0VBQUFDeUFnTC1BU0FBQUFBQmdBSkFBQUFBQVlRQ0FRQUFBQUdGQWdFQUFBQUJyZ0lCQUFBQUFhOENBUUFBQUFHd0FnRUFBQUFCQS1JQkFRQUFBQUhrQVFFQUFBQUI1UUZBQUFBQUFRZmlBUUVBQUFBQjVRRkFBQUFBQVlRQ0FRQUFBQUdrQWdBQUFLUUNBcVVDQVFBQUFBR21BZ0VBQUFBQnB3SWdBQUFBQVFzSEFBRDhBd0FnRkFBQS13TUFJQlVBQVA4REFDRGlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFhOENBUUFBQUFHekFnRUFBQUFCdEFJQkFBQUFBUUlBQUFBQkFDQWpBQUNsQmdBZ0ZnTUFBSlVGQUNBTEFBQ1dCUUFnREFBQWx3VUFJQTRBQUpnRkFDQVBBQUNaQlFBZ0VBQUFtZ1VBSUJJQUFKd0ZBQ0RpQVFFQUFBQUI1UUZBQUFBQUFmRUJBUUFBQUFIeUFRRUFBQUFCOHdFQkFBQUFBZlFCQVFBQUFBSDFBUUVBQUFBQjlnRUJBQUFBQWZnQkFBQUEtQUVDLWdFQUFBRDZBUUw4QVFBQUFQd0JBdjBCSUFBQUFBSC1BU0FBQUFBQl93RUNBQUFBQVlBQ1FBQUFBQUVDQUFBQW53SUFJQ01BQUtjR0FDQU1Fd0FBM0FVQUlPSUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3lBZ0wtQVNBQUFBQUJnQUpBQUFBQUFZUUNBUUFBQUFHRkFnRUFBQUFCcmdJQkFBQUFBYThDQVFBQUFBR3dBZ0VBQUFBQnNnSUJBQUFBQVFJQUFBQWhBQ0FqQUFDcEJnQWdBd0FBQUtJQ0FDQWpBQUNuQmdBZ0pBQUFyUVlBSUJnQUFBQ2lBZ0FnQXdBQXpnTUFJQXNBQU04REFDQU1BQURRQXdBZ0RnQUEwUU1BSUE4QUFOSURBQ0FRQUFEVEF3QWdFZ0FBMVFNQUlCd0FBSzBHQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0h5QVFFQXZBTUFJZk1CQVFESUF3QWg5QUVCQU1nREFDSDFBUUVBeUFNQUlmWUJBUURJQXdBaC1BRUFBTWtELUFFaS1nRUFBTW9ELWdFaV9BRUFBTXNEX0FFaV9RRWdBTXdEQUNILUFTQUF6QU1BSWY4QkFnRE5Bd0FoZ0FKQUFMMERBQ0VXQXdBQXpnTUFJQXNBQU04REFDQU1BQURRQXdBZ0RnQUEwUU1BSUE4QUFOSURBQ0FRQUFEVEF3QWdFZ0FBMVFNQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoOHdFQkFNZ0RBQ0gwQVFFQXlBTUFJZlVCQVFESUF3QWg5Z0VCQU1nREFDSDRBUUFBeVFQNEFTTDZBUUFBeWdQNkFTTDhBUUFBeXdQOEFTTDlBU0FBekFNQUlmNEJJQURNQXdBaF93RUNBTTBEQUNHQUFrQUF2UU1BSVFmaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQWE4Q0FRQUFBQUd6QWdFQUFBQUJBd0FBQUNnQUlDTUFBS1VHQUNBa0FBQ3hCZ0FnRFFBQUFDZ0FJQWNBQVBrREFDQVVBQUR1QXdBZ0ZRQUE3d01BSUJ3QUFMRUdBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDSC1BU0FBekFNQUlZQUNRQUM5QXdBaHJ3SUJBTHdEQUNHekFnRUF2QU1BSWJRQ0FRRElBd0FoQ3djQUFQa0RBQ0FVQUFEdUF3QWdGUUFBN3dNQUlPSUJBUUM4QXdBaDR3RUJBTHdEQUNIbEFVQUF2UU1BSWY0QklBRE1Bd0FoZ0FKQUFMMERBQ0d2QWdFQXZBTUFJYk1DQVFDOEF3QWh0QUlCQU1nREFDRURBQUFBSHdBZ0l3QUFxUVlBSUNRQUFMUUdBQ0FPQUFBQUh3QWdFd0FBMndVQUlCd0FBTFFHQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFLTUVzZ0lpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR3VBZ0VBdkFNQUlhOENBUUM4QXdBaHNBSUJBTHdEQUNHeUFnRUF2QU1BSVF3VEFBRGJCUUFnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFDakJMSUNJdjRCSUFETUF3QWhnQUpBQUwwREFDR0VBZ0VBdkFNQUlZVUNBUUM4QXdBaHJnSUJBTHdEQUNHdkFnRUF2QU1BSWJBQ0FRQzhBd0Foc2dJQkFMd0RBQ0VINGdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQWE4Q0FRQUFBQUd6QWdFQUFBQUJ0QUlCQUFBQUFRWGlBUUVBQUFBQjVRRkFBQUFBQVpNQ0FRQUFBQUdVQWtBQUFBQUJsUUpBQUFBQUFSTUZBQUNSQlFBZ0JnQUFxd1VBSUFzQUFKSUZBQ0FNQUFDVEJRQWc0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSTBDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDRUFBQUFBR0pBZ0lBQUFBQmlnSUlBQUFBQVlzQ0FBQ1FCUUFnalFJQkFBQUFBWTRDQVFBQUFBRUNBQUFBQlFBZ0l3QUF0d1lBSUJZREFBQ1ZCUUFnQ3dBQWxnVUFJQXdBQUpjRkFDQU9BQUNZQlFBZ0VBQUFtZ1VBSUJFQUFKc0ZBQ0FTQUFDY0JRQWc0Z0VCQUFBQUFlVUJRQUFBQUFIeEFRRUFBQUFCOGdFQkFBQUFBZk1CQVFBQUFBSDBBUUVBQUFBQjlRRUJBQUFBQWZZQkFRQUFBQUg0QVFBQUFQZ0JBdm9CQUFBQS1nRUNfQUVBQUFEOEFRTDlBU0FBQUFBQl9nRWdBQUFBQWY4QkFnQUFBQUdBQWtBQUFBQUJBZ0FBQUo4Q0FDQWpBQUM1QmdBZ0F3QUFBQU1BSUNNQUFMY0dBQ0FrQUFDOUJnQWdGUUFBQUFNQUlBVUFBT3dFQUNBR0FBQ3FCUUFnQ3dBQTdRUUFJQXdBQU80RUFDQWNBQUM5QmdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBRHFCSTBDSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhoZ0lCQUx3REFDR0hBZ0VBdkFNQUlZZ0NFQURKQkFBaGlRSUNBTTBEQUNHS0FnZ0E2QVFBSVlzQ0FBRHBCQUFnalFJQkFMd0RBQ0dPQWdFQXZBTUFJUk1GQUFEc0JBQWdCZ0FBcWdVQUlBc0FBTzBFQUNBTUFBRHVCQUFnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFEcUJJMENJdjRCSUFETUF3QWhnQUpBQUwwREFDR0VBZ0VBdkFNQUlZVUNBUUM4QXdBaGhnSUJBTHdEQUNHSEFnRUF2QU1BSVlnQ0VBREpCQUFoaVFJQ0FNMERBQ0dLQWdnQTZBUUFJWXNDQUFEcEJBQWdqUUlCQUx3REFDR09BZ0VBdkFNQUlRTUFBQUNpQWdBZ0l3QUF1UVlBSUNRQUFNQUdBQ0FZQUFBQW9nSUFJQU1BQU00REFDQUxBQURQQXdBZ0RBQUEwQU1BSUE0QUFORURBQ0FRQUFEVEF3QWdFUUFBMUFNQUlCSUFBTlVEQUNBY0FBREFCZ0FnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZkVCQVFDOEF3QWg4Z0VCQUx3REFDSHpBUUVBeUFNQUlmUUJBUURJQXdBaDlRRUJBTWdEQUNIMkFRRUF5QU1BSWZnQkFBREpBX2dCSXZvQkFBREtBX29CSXZ3QkFBRExBX3dCSXYwQklBRE1Bd0FoX2dFZ0FNd0RBQ0hfQVFJQXpRTUFJWUFDUUFDOUF3QWhGZ01BQU00REFDQUxBQURQQXdBZ0RBQUEwQU1BSUE0QUFORURBQ0FRQUFEVEF3QWdFUUFBMUFNQUlCSUFBTlVEQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0h5QVFFQXZBTUFJZk1CQVFESUF3QWg5QUVCQU1nREFDSDFBUUVBeUFNQUlmWUJBUURJQXdBaC1BRUFBTWtELUFFaS1nRUFBTW9ELWdFaV9BRUFBTXNEX0FFaV9RRWdBTXdEQUNILUFTQUF6QU1BSWY4QkFnRE5Bd0FoZ0FKQUFMMERBQ0VGQkFBUkJ3QURGQUFDRlRrQkZqb0JBd1FBRUJFM0FSTUFBd2tEQmdRRUFBOExIUWNNSGdvT0lnSVBJd3NRSncwUktnRVNMZzRHQkFBTUJRQUZCZ0FEQ3d3SERCVUtEUmtMQWdNSEJBUUFCZ0VEQ0FBRUJBQUpCd0FEQ0FBRUNoQUlBUWtBQndFS0VRQUNCd0FEQ0FBRUFnY0FBd2dBQkFNTEdnQU1Hd0FOSEFBQkJ3QURBUWNBQXdnREx3QUxNQUFNTVFBT01nQVBNd0FRTkFBUk5RQVNOZ0FCRVRnQUFSWTdBQUFEQndBREZBQUNGVVVCQXdjQUF4UUFBaFZMQVFNRUFCWXBBQmNxQUJnQUFBQURCQUFXS1FBWEtnQVlBUk1BQXdFVEFBTURCQUFkS1FBZUtnQWZBQUFBQXdRQUhTa0FIaW9BSHdJSEFBTUlBQVFDQndBRENBQUVCUVFBSkNrQUp5b0FLRXNBSlV3QUpnQUFBQUFBQlFRQUpDa0FKeW9BS0VzQUpVd0FKZ0FBQXdRQUxTa0FMaW9BTHdBQUFBTUVBQzBwQUM0cUFDOEFBQUFEQkFBMUtRQTJLZ0EzQUFBQUF3UUFOU2tBTmlvQU53RUhBQU1CQndBREF3UUFQQ2tBUFNvQVBnQUFBQU1FQUR3cEFEMHFBRDRCQ1FBSEFRa0FCd1VFQUVNcEFFWXFBRWRMQUVSTUFFVUFBQUFBQUFVRUFFTXBBRVlxQUVkTEFFUk1BRVVCQndBREFRY0FBd01FQUV3cEFFMHFBRTRBQUFBREJBQk1LUUJOS2dCT0FnY0FBd2dBQkFJSEFBTUlBQVFGQkFCVEtRQldLZ0JYU3dCVVRBQlZBQUFBQUFBRkJBQlRLUUJXS2dCWFN3QlVUQUJWQWdVQUJRWUFBd0lGQUFVR0FBTUZCQUJjS1FCZktnQmdTd0JkVEFCZUFBQUFBQUFGQkFCY0tRQmZLZ0JnU3dCZFRBQmVBQUFGQkFCbEtRQm9LZ0JwU3dCbVRBQm5BQUFBQUFBRkJBQmxLUUJvS2dCcFN3Qm1UQUJuQWdjQUF3Z0FCQUlIQUFNSUFBUURCQUJ1S1FCdktnQndBQUFBQXdRQWJpa0FieW9BY0JjQ0FSZzhBUms5QVJvLUFSc19BUjFCQVI1REVoOUVFeUJIQVNGSkVpSktGQ1ZNQVNaTkFTZE9FaXRSRlN4U0dTMVRBaTVVQWk5VkFqQldBakZYQWpKWkFqTmJFalJjR2pWZUFqWmdFamRoR3poaUFqbGpBanBrRWp0bkhEeG9JRDFwQno1cUJ6OXJCMEJzQjBGdEIwSnZCME54RWtSeUlVVjBCMFoyRWtkM0lraDRCMGw1QjBwNkVrMTlJMDUtS1UtQUFRVlFnUUVGVVlRQkJWS0ZBUVZUaGdFRlZJZ0JCVldLQVJKV2l3RXFWNDBCQlZpUEFSSlprQUVyV3BFQkJWdVNBUVZja3dFU1haWUJMRjZYQVRCZm1RRXhZSm9CTVdHZEFURmluZ0V4WTU4Qk1XU2hBVEZsb3dFU1pxUUJNbWVtQVRGb3FBRVNhYWtCTTJxcUFURnJxd0V4Ykt3QkVtMnZBVFJ1c0FFNGI3RUJEWEN5QVExeHN3RU5jclFCRFhPMUFRMTB0d0VOZGJrQkVuYTZBVGwzdkFFTmVMNEJFbm1fQVRwNndBRU5lOEVCRFh6Q0FSSjl4UUU3ZnNZQlAzX0hBUWlBQWNnQkNJRUJ5UUVJZ2dIS0FRaURBY3NCQ0lRQnpRRUloUUhQQVJLR0FkQUJRSWNCMGdFSWlBSFVBUktKQWRVQlFZb0IxZ0VJaXdIWEFRaU1BZGdCRW8wQjJ3RkNqZ0hjQVVpUEFkMEJEcEFCM2dFT2tRSGZBUTZTQWVBQkRwTUI0UUVPbEFIakFRNlZBZVVCRXBZQjVnRkpsd0hvQVE2WUFlb0JFcGtCNndGS21nSHNBUTZiQWUwQkRwd0I3Z0VTblFIeEFVdWVBZklCVDU4Qjh3RUtvQUgwQVFxaEFmVUJDcUlCOWdFS293SDNBUXFrQWZrQkNxVUItd0VTcGdIOEFWQ25BZjRCQ3FnQmdBSVNxUUdCQWxHcUFZSUNDcXNCZ3dJS3JBR0VBaEt0QVljQ1VxNEJpQUpZcndHSkFnU3dBWW9DQkxFQml3SUVzZ0dNQWdTekFZMENCTFFCandJRXRRR1JBaEsyQVpJQ1diY0JsQUlFdUFHV0FoSzVBWmNDV3JvQm1BSUV1d0daQWdTOEFab0NFcjBCblFKYnZnR2VBbUdfQWFBQ0E4QUJvUUlEd1FHa0FnUENBYVVDQThNQnBnSUR4QUdvQWdQRkFhb0NFc1lCcXdKaXh3R3RBZ1BJQWE4Q0Vza0JzQUpqeWdHeEFnUExBYklDQTh3QnN3SVN6UUcyQW1UT0FiY0NhczhCdUFJTDBBRzVBZ3ZSQWJvQ0M5SUJ1d0lMMHdHOEFndlVBYjRDQzlVQndBSVMxZ0hCQW12WEFjTUNDOWdCeFFJUzJRSEdBbXphQWNjQ0M5c0J5QUlMM0FISkFoTGRBY3dDYmQ0QnpRSnhcIlxufVxuXG5hc3luYyBmdW5jdGlvbiBkZWNvZGVCYXNlNjRBc1dhc20od2FzbUJhc2U2NDogc3RyaW5nKTogUHJvbWlzZTxXZWJBc3NlbWJseS5Nb2R1bGU+IHtcbiAgY29uc3QgeyBCdWZmZXIgfSA9IGF3YWl0IGltcG9ydCgnbm9kZTpidWZmZXInKVxuICBjb25zdCB3YXNtQXJyYXkgPSBCdWZmZXIuZnJvbSh3YXNtQmFzZTY0LCAnYmFzZTY0JylcbiAgcmV0dXJuIG5ldyBXZWJBc3NlbWJseS5Nb2R1bGUod2FzbUFycmF5KVxufVxuXG5jb25maWcuY29tcGlsZXJXYXNtID0ge1xuICBnZXRSdW50aW1lOiBhc3luYyAoKSA9PiBhd2FpdCBpbXBvcnQoXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcucG9zdGdyZXNxbC5tanNcIiksXG5cbiAgZ2V0UXVlcnlDb21waWxlcldhc21Nb2R1bGU6IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB7IHdhc20gfSA9IGF3YWl0IGltcG9ydChcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvcXVlcnlfY29tcGlsZXJfZmFzdF9iZy5wb3N0Z3Jlc3FsLndhc20tYmFzZTY0Lm1qc1wiKVxuICAgIHJldHVybiBhd2FpdCBkZWNvZGVCYXNlNjRBc1dhc20od2FzbSlcbiAgfSxcblxuICBpbXBvcnROYW1lOiBcIi4vcXVlcnlfY29tcGlsZXJfZmFzdF9iZy5qc1wiXG59XG5cblxuXG5leHBvcnQgdHlwZSBMb2dPcHRpb25zPENsaWVudE9wdGlvbnMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9ucz4gPVxuICAnbG9nJyBleHRlbmRzIGtleW9mIENsaWVudE9wdGlvbnMgPyBDbGllbnRPcHRpb25zWydsb2cnXSBleHRlbmRzIEFycmF5PFByaXNtYS5Mb2dMZXZlbCB8IFByaXNtYS5Mb2dEZWZpbml0aW9uPiA/IFByaXNtYS5HZXRFdmVudHM8Q2xpZW50T3B0aW9uc1snbG9nJ10+IDogbmV2ZXIgOiBuZXZlclxuXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudENvbnN0cnVjdG9yIHtcbiAgICAvKipcbiAgICogIyMgUHJpc21hIENsaWVudFxuICAgKiBcbiAgICogVHlwZS1zYWZlIGRhdGFiYXNlIGNsaWVudCBmb3IgVHlwZVNjcmlwdFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gICAqIH0pXG4gICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nQ29tbWVudHNcbiAgICogY29uc3QgYmxvZ0NvbW1lbnRzID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KClcbiAgICogYGBgXG4gICAqIFxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICAgKi9cblxuICBuZXcgPFxuICAgIE9wdGlvbnMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9ucyA9IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zLFxuICAgIExvZ09wdHMgZXh0ZW5kcyBMb2dPcHRpb25zPE9wdGlvbnM+ID0gTG9nT3B0aW9uczxPcHRpb25zPixcbiAgICBPbWl0T3B0cyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10gPSBPcHRpb25zIGV4dGVuZHMgeyBvbWl0OiBpbmZlciBVIH0gPyBVIDogUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSxcbiAgICBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJnc1xuICA+KG9wdGlvbnM6IFByaXNtYS5QcmlzbWFDbGllbnRDb25zdHJ1Y3RvckFyZ3M8T3B0aW9ucz4pOiBQcmlzbWFDbGllbnQ8TG9nT3B0cywgT21pdE9wdHMsIEV4dEFyZ3M+XG59XG5cbi8qKlxuICogIyMgUHJpc21hIENsaWVudFxuICogXG4gKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gKiB9KVxuICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dDb21tZW50c1xuICogY29uc3QgYmxvZ0NvbW1lbnRzID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KClcbiAqIGBgYFxuICogXG4gKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICovXG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50PFxuICBpbiBMb2dPcHRzIGV4dGVuZHMgUHJpc21hLkxvZ0xldmVsID0gbmV2ZXIsXG4gIGluIG91dCBPbWl0T3B0cyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10gPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddLFxuICBpbiBvdXQgRXh0QXJncyBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3Ncbj4ge1xuICBbSzogc3ltYm9sXTogeyB0eXBlczogUHJpc21hLlR5cGVNYXA8RXh0QXJncz5bJ290aGVyJ10gfVxuXG4gICRvbjxWIGV4dGVuZHMgTG9nT3B0cz4oZXZlbnRUeXBlOiBWLCBjYWxsYmFjazogKGV2ZW50OiBWIGV4dGVuZHMgJ3F1ZXJ5JyA/IFByaXNtYS5RdWVyeUV2ZW50IDogUHJpc21hLkxvZ0V2ZW50KSA9PiB2b2lkKTogUHJpc21hQ2xpZW50O1xuXG4gIC8qKlxuICAgKiBDb25uZWN0IHdpdGggdGhlIGRhdGFiYXNlXG4gICAqL1xuICAkY29ubmVjdCgpOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTx2b2lkPjtcblxuICAvKipcbiAgICogRGlzY29ubmVjdCBmcm9tIHRoZSBkYXRhYmFzZVxuICAgKi9cbiAgJGRpc2Nvbm5lY3QoKTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8dm9pZD47XG5cbi8qKlxuICAgKiBFeGVjdXRlcyBhIHByZXBhcmVkIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIHJvd3MuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJGV4ZWN1dGVSYXdgVVBEQVRFIFVzZXIgU0VUIGNvb2wgPSAke3RydWV9IFdIRVJFIGVtYWlsID0gJHsndXNlckBlbWFpbC5jb20nfTtgXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkZXhlY3V0ZVJhdzxUID0gdW5rbm93bj4ocXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgUHJpc21hLlNxbCwgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPG51bWJlcj47XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIGEgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWQgcm93cy5cbiAgICogU3VzY2VwdGlibGUgdG8gU1FMIGluamVjdGlvbnMsIHNlZSBkb2N1bWVudGF0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRleGVjdXRlUmF3VW5zYWZlKCdVUERBVEUgVXNlciBTRVQgY29vbCA9ICQxIFdIRVJFIGVtYWlsID0gJDIgOycsIHRydWUsICd1c2VyQGVtYWlsLmNvbScpXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkZXhlY3V0ZVJhd1Vuc2FmZTxUID0gdW5rbm93bj4ocXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPG51bWJlcj47XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIGEgcHJlcGFyZWQgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBgU0VMRUNUYCBkYXRhLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRxdWVyeVJhd2BTRUxFQ1QgKiBGUk9NIFVzZXIgV0hFUkUgaWQgPSAkezF9IE9SIGVtYWlsID0gJHsndXNlckBlbWFpbC5jb20nfTtgXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkcXVlcnlSYXc8VCA9IHVua25vd24+KHF1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFByaXNtYS5TcWwsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxUPjtcblxuICAvKipcbiAgICogUGVyZm9ybXMgYSByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIGBTRUxFQ1RgIGRhdGEuXG4gICAqIFN1c2NlcHRpYmxlIHRvIFNRTCBpbmplY3Rpb25zLCBzZWUgZG9jdW1lbnRhdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdVbnNhZmUoJ1NFTEVDVCAqIEZST00gVXNlciBXSEVSRSBpZCA9ICQxIE9SIGVtYWlsID0gJDI7JywgMSwgJ3VzZXJAZW1haWwuY29tJylcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRxdWVyeVJhd1Vuc2FmZTxUID0gdW5rbm93bj4ocXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPFQ+O1xuXG5cbiAgLyoqXG4gICAqIEFsbG93cyB0aGUgcnVubmluZyBvZiBhIHNlcXVlbmNlIG9mIHJlYWQvd3JpdGUgb3BlcmF0aW9ucyB0aGF0IGFyZSBndWFyYW50ZWVkIHRvIGVpdGhlciBzdWNjZWVkIG9yIGZhaWwgYXMgYSB3aG9sZS5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IFtnZW9yZ2UsIGJvYiwgYWxpY2VdID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihbXG4gICAqICAgcHJpc21hLnVzZXIuY3JlYXRlKHsgZGF0YTogeyBuYW1lOiAnR2VvcmdlJyB9IH0pLFxuICAgKiAgIHByaXNtYS51c2VyLmNyZWF0ZSh7IGRhdGE6IHsgbmFtZTogJ0JvYicgfSB9KSxcbiAgICogICBwcmlzbWEudXNlci5jcmVhdGUoeyBkYXRhOiB7IG5hbWU6ICdBbGljZScgfSB9KSxcbiAgICogXSlcbiAgICogYGBgXG4gICAqIFxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9vcm0vcHJpc21hLWNsaWVudC9xdWVyaWVzL3RyYW5zYWN0aW9ucykuXG4gICAqL1xuICAkdHJhbnNhY3Rpb248UCBleHRlbmRzIFByaXNtYS5QcmlzbWFQcm9taXNlPGFueT5bXT4oYXJnOiBbLi4uUF0sIG9wdGlvbnM/OiB7IG1heFdhaXQ/OiBudW1iZXIsIHRpbWVvdXQ/OiBudW1iZXIsIGlzb2xhdGlvbkxldmVsPzogUHJpc21hLlRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgfSk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPHJ1bnRpbWUuVHlwZXMuVXRpbHMuVW53cmFwVHVwbGU8UD4+XG5cbiAgJHRyYW5zYWN0aW9uPFI+KGZuOiAocHJpc21hOiBPbWl0PFByaXNtYUNsaWVudCwgcnVudGltZS5JVFhDbGllbnREZW55TGlzdD4pID0+IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPFI+LCBvcHRpb25zPzogeyBtYXhXYWl0PzogbnVtYmVyLCB0aW1lb3V0PzogbnVtYmVyLCBpc29sYXRpb25MZXZlbD86IFByaXNtYS5UcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsIH0pOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxSPlxuXG4gICRleHRlbmRzOiBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRXh0ZW5kc0hvb2s8XCJleHRlbmRzXCIsIFByaXNtYS5UeXBlTWFwQ2I8T21pdE9wdHM+LCBFeHRBcmdzLCBydW50aW1lLlR5cGVzLlV0aWxzLkNhbGw8UHJpc21hLlR5cGVNYXBDYjxPbWl0T3B0cz4sIHtcbiAgICBleHRBcmdzOiBFeHRBcmdzXG4gIH0+PlxuXG4gICAgICAvKipcbiAgICogYHByaXNtYS5ibG9nQ29tbWVudGA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipCbG9nQ29tbWVudCoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ0NvbW1lbnRzXG4gICAgKiBjb25zdCBibG9nQ29tbWVudHMgPSBhd2FpdCBwcmlzbWEuYmxvZ0NvbW1lbnQuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGJsb2dDb21tZW50KCk6IFByaXNtYS5CbG9nQ29tbWVudERlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEuYmxvZ1Bvc3RgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQmxvZ1Bvc3QqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dQb3N0c1xuICAgICogY29uc3QgYmxvZ1Bvc3RzID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBibG9nUG9zdCgpOiBQcmlzbWEuQmxvZ1Bvc3REZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmJvb2tpbmdgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQm9va2luZyoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQm9va2luZ3NcbiAgICAqIGNvbnN0IGJvb2tpbmdzID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGJvb2tpbmcoKTogUHJpc21hLkJvb2tpbmdEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmNhdGVnb3J5YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkNhdGVnb3J5KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBDYXRlZ29yaWVzXG4gICAgKiBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBjYXRlZ29yeSgpOiBQcmlzbWEuQ2F0ZWdvcnlEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmNvbnRhY3RNZXNzYWdlYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkNvbnRhY3RNZXNzYWdlKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBDb250YWN0TWVzc2FnZXNcbiAgICAqIGNvbnN0IGNvbnRhY3RNZXNzYWdlcyA9IGF3YWl0IHByaXNtYS5jb250YWN0TWVzc2FnZS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgY29udGFjdE1lc3NhZ2UoKTogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5ub3RpZmljYXRpb25gOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqTm90aWZpY2F0aW9uKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBOb3RpZmljYXRpb25zXG4gICAgKiBjb25zdCBub3RpZmljYXRpb25zID0gYXdhaXQgcHJpc21hLm5vdGlmaWNhdGlvbi5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgbm90aWZpY2F0aW9uKCk6IFByaXNtYS5Ob3RpZmljYXRpb25EZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnBheW1lbnRgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqUGF5bWVudCoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgUGF5bWVudHNcbiAgICAqIGNvbnN0IHBheW1lbnRzID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHBheW1lbnQoKTogUHJpc21hLlBheW1lbnREZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnJlZnJlc2hUb2tlbmA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipSZWZyZXNoVG9rZW4qKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFJlZnJlc2hUb2tlbnNcbiAgICAqIGNvbnN0IHJlZnJlc2hUb2tlbnMgPSBhd2FpdCBwcmlzbWEucmVmcmVzaFRva2VuLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCByZWZyZXNoVG9rZW4oKTogUHJpc21hLlJlZnJlc2hUb2tlbkRlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEucmV2aWV3YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlJldmlldyoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgUmV2aWV3c1xuICAgICogY29uc3QgcmV2aWV3cyA9IGF3YWl0IHByaXNtYS5yZXZpZXcuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHJldmlldygpOiBQcmlzbWEuUmV2aWV3RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS50b3VyUGFja2FnZWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipUb3VyUGFja2FnZSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgVG91clBhY2thZ2VzXG4gICAgKiBjb25zdCB0b3VyUGFja2FnZXMgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHRvdXJQYWNrYWdlKCk6IFByaXNtYS5Ub3VyUGFja2FnZURlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEudXNlcmA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipVc2VyKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBVc2Vyc1xuICAgICogY29uc3QgdXNlcnMgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgdXNlcigpOiBQcmlzbWEuVXNlckRlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEud2lzaGxpc3RJdGVtYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKldpc2hsaXN0SXRlbSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgV2lzaGxpc3RJdGVtc1xuICAgICogY29uc3Qgd2lzaGxpc3RJdGVtcyA9IGF3YWl0IHByaXNtYS53aXNobGlzdEl0ZW0uZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHdpc2hsaXN0SXRlbSgpOiBQcmlzbWEuV2lzaGxpc3RJdGVtRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9Pjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFByaXNtYUNsaWVudENsYXNzKCk6IFByaXNtYUNsaWVudENvbnN0cnVjdG9yIHtcbiAgcmV0dXJuIHJ1bnRpbWUuZ2V0UHJpc21hQ2xpZW50KGNvbmZpZykgYXMgdW5rbm93biBhcyBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvclxufVxuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogV0FSTklORzogVGhpcyBpcyBhbiBpbnRlcm5hbCBmaWxlIHRoYXQgaXMgc3ViamVjdCB0byBjaGFuZ2UhXG4gKlxuICogXHVEODNEXHVERUQxIFVuZGVyIG5vIGNpcmN1bXN0YW5jZXMgc2hvdWxkIHlvdSBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5ISBcdUQ4M0RcdURFRDFcbiAqXG4gKiBBbGwgZXhwb3J0cyBmcm9tIHRoaXMgZmlsZSBhcmUgd3JhcHBlZCB1bmRlciBhIGBQcmlzbWFgIG5hbWVzcGFjZSBvYmplY3QgaW4gdGhlIGNsaWVudC50cyBmaWxlLlxuICogV2hpbGUgdGhpcyBlbmFibGVzIHBhcnRpYWwgYmFja3dhcmQgY29tcGF0aWJpbGl0eSwgaXQgaXMgbm90IHBhcnQgb2YgdGhlIHN0YWJsZSBwdWJsaWMgQVBJLlxuICpcbiAqIElmIHlvdSBhcmUgbG9va2luZyBmb3IgeW91ciBNb2RlbHMsIEVudW1zLCBhbmQgSW5wdXQgVHlwZXMsIHBsZWFzZSBpbXBvcnQgdGhlbSBmcm9tIHRoZSByZXNwZWN0aXZlXG4gKiBtb2RlbCBmaWxlcyBpbiB0aGUgYG1vZGVsYCBkaXJlY3RvcnkhXG4gKi9cblxuaW1wb3J0ICogYXMgcnVudGltZSBmcm9tIFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9jbGllbnRcIlxuaW1wb3J0IHR5cGUgKiBhcyBQcmlzbWEgZnJvbSBcIi4uL21vZGVsc1wiXG5pbXBvcnQgeyB0eXBlIFByaXNtYUNsaWVudCB9IGZyb20gXCIuL2NsYXNzXCJcblxuZXhwb3J0IHR5cGUgKiBmcm9tICcuLi9tb2RlbHMnXG5cbmV4cG9ydCB0eXBlIERNTUYgPSB0eXBlb2YgcnVudGltZS5ETU1GXG5cbmV4cG9ydCB0eXBlIFByaXNtYVByb21pc2U8VD4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5QcmlzbWFQcm9taXNlPFQ+XG5cbi8qKlxuICogUHJpc21hIEVycm9yc1xuICovXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclxuXG4vKipcbiAqIFJlLWV4cG9ydCBvZiBzcWwtdGVtcGxhdGUtdGFnXG4gKi9cbmV4cG9ydCBjb25zdCBzcWwgPSBydW50aW1lLnNxbHRhZ1xuZXhwb3J0IGNvbnN0IGVtcHR5ID0gcnVudGltZS5lbXB0eVxuZXhwb3J0IGNvbnN0IGpvaW4gPSBydW50aW1lLmpvaW5cbmV4cG9ydCBjb25zdCByYXcgPSBydW50aW1lLnJhd1xuZXhwb3J0IGNvbnN0IFNxbCA9IHJ1bnRpbWUuU3FsXG5leHBvcnQgdHlwZSBTcWwgPSBydW50aW1lLlNxbFxuXG5cblxuLyoqXG4gKiBEZWNpbWFsLmpzXG4gKi9cbmV4cG9ydCBjb25zdCBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5leHBvcnQgdHlwZSBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5cbmV4cG9ydCB0eXBlIERlY2ltYWxKc0xpa2UgPSBydW50aW1lLkRlY2ltYWxKc0xpa2VcblxuLyoqXG4qIEV4dGVuc2lvbnNcbiovXG5leHBvcnQgdHlwZSBFeHRlbnNpb24gPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuVXNlckFyZ3NcbmV4cG9ydCBjb25zdCBnZXRFeHRlbnNpb25Db250ZXh0ID0gcnVudGltZS5FeHRlbnNpb25zLmdldEV4dGVuc2lvbkNvbnRleHRcbmV4cG9ydCB0eXBlIEFyZ3M8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLkFyZ3M8VCwgRj5cbmV4cG9ydCB0eXBlIFBheWxvYWQ8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uID0gbmV2ZXI+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuUGF5bG9hZDxULCBGPlxuZXhwb3J0IHR5cGUgUmVzdWx0PFQsIEEsIEYgZXh0ZW5kcyBydW50aW1lLk9wZXJhdGlvbj4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5SZXN1bHQ8VCwgQSwgRj5cbmV4cG9ydCB0eXBlIEV4YWN0PEEsIFc+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuRXhhY3Q8QSwgVz5cblxuZXhwb3J0IHR5cGUgUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBzdHJpbmdcbiAgZW5naW5lOiBzdHJpbmdcbn1cblxuLyoqXG4gKiBQcmlzbWEgQ2xpZW50IEpTIHZlcnNpb246IDcuOS4xXG4gKiBRdWVyeSBFbmdpbmUgdmVyc2lvbjogZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFxuICovXG5leHBvcnQgY29uc3QgcHJpc21hVmVyc2lvbjogUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBcIjcuOS4xXCIsXG4gIGVuZ2luZTogXCJlOTIyMDg5YjdkNzUwMmFmZjQyNDlkNWRhMzQyMGY2ZmE1NWZjNmFkXCJcbn1cblxuLyoqXG4gKiBVdGlsaXR5IFR5cGVzXG4gKi9cblxuZXhwb3J0IHR5cGUgQnl0ZXMgPSBydW50aW1lLkJ5dGVzXG5leHBvcnQgdHlwZSBKc29uT2JqZWN0ID0gcnVudGltZS5Kc29uT2JqZWN0XG5leHBvcnQgdHlwZSBKc29uQXJyYXkgPSBydW50aW1lLkpzb25BcnJheVxuZXhwb3J0IHR5cGUgSnNvblZhbHVlID0gcnVudGltZS5Kc29uVmFsdWVcbmV4cG9ydCB0eXBlIElucHV0SnNvbk9iamVjdCA9IHJ1bnRpbWUuSW5wdXRKc29uT2JqZWN0XG5leHBvcnQgdHlwZSBJbnB1dEpzb25BcnJheSA9IHJ1bnRpbWUuSW5wdXRKc29uQXJyYXlcbmV4cG9ydCB0eXBlIElucHV0SnNvblZhbHVlID0gcnVudGltZS5JbnB1dEpzb25WYWx1ZVxuXG5cbmV4cG9ydCBjb25zdCBOdWxsVHlwZXMgPSB7XG4gIERiTnVsbDogcnVudGltZS5OdWxsVHlwZXMuRGJOdWxsIGFzIChuZXcgKHNlY3JldDogbmV2ZXIpID0+IHR5cGVvZiBydW50aW1lLkRiTnVsbCksXG4gIEpzb25OdWxsOiBydW50aW1lLk51bGxUeXBlcy5Kc29uTnVsbCBhcyAobmV3IChzZWNyZXQ6IG5ldmVyKSA9PiB0eXBlb2YgcnVudGltZS5Kc29uTnVsbCksXG4gIEFueU51bGw6IHJ1bnRpbWUuTnVsbFR5cGVzLkFueU51bGwgYXMgKG5ldyAoc2VjcmV0OiBuZXZlcikgPT4gdHlwZW9mIHJ1bnRpbWUuQW55TnVsbCksXG59XG4vKipcbiAqIEhlbHBlciBmb3IgZmlsdGVyaW5nIEpTT04gZW50cmllcyB0aGF0IGhhdmUgYG51bGxgIG9uIHRoZSBkYXRhYmFzZSAoZW1wdHkgb24gdGhlIGRiKVxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IERiTnVsbCA9IHJ1bnRpbWUuRGJOdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgaGF2ZSBKU09OIGBudWxsYCB2YWx1ZXMgKG5vdCBlbXB0eSBvbiB0aGUgZGIpXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgSnNvbk51bGwgPSBydW50aW1lLkpzb25OdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgYXJlIGBQcmlzbWEuRGJOdWxsYCBvciBgUHJpc21hLkpzb25OdWxsYFxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IEFueU51bGwgPSBydW50aW1lLkFueU51bGxcblxuXG50eXBlIFNlbGVjdEFuZEluY2x1ZGUgPSB7XG4gIHNlbGVjdDogYW55XG4gIGluY2x1ZGU6IGFueVxufVxuXG50eXBlIFNlbGVjdEFuZE9taXQgPSB7XG4gIHNlbGVjdDogYW55XG4gIG9taXQ6IGFueVxufVxuXG4vKipcbiAqIEZyb20gVCwgcGljayBhIHNldCBvZiBwcm9wZXJ0aWVzIHdob3NlIGtleXMgYXJlIGluIHRoZSB1bmlvbiBLXG4gKi9cbnR5cGUgUHJpc21hX19QaWNrPFQsIEsgZXh0ZW5kcyBrZXlvZiBUPiA9IHtcbiAgICBbUCBpbiBLXTogVFtQXTtcbn07XG5cbmV4cG9ydCB0eXBlIEVudW1lcmFibGU8VD4gPSBUIHwgQXJyYXk8VD47XG5cbi8qKlxuICogU3Vic2V0XG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAuIFNpbXBsZSB2ZXJzaW9uIG9mIEludGVyc2VjdGlvblxuICovXG5leHBvcnQgdHlwZSBTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlcjtcbn07XG5cbi8qKlxuICogUmVzb2x2ZWQgdHlwZSBvZiB0aGUgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBgUHJpc21hQ2xpZW50YCBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBXaGVuIGNhbGxlZCB3aXRob3V0IGEgbmFycm93ZXIgb3B0aW9ucyB0eXBlICh0aGUgY29tbW9uIGNhc2UpLCB0aGlzIHJlc29sdmVzXG4gKiB0byBgUHJpc21hQ2xpZW50T3B0aW9uc2AgZGlyZWN0bHksIHdoaWNoIHByb2R1Y2VzIGEgY2xlYXIgVHlwZVNjcmlwdCBlcnJvclxuICogbWVzc2FnZSAoYG5vdCBhc3NpZ25hYmxlIHRvIHBhcmFtZXRlciBvZiB0eXBlICdQcmlzbWFDbGllbnRPcHRpb25zJ2ApIHdoZW5cbiAqIHRoZSBhcmd1bWVudCBpcyBtaXNzaW5nIG9yIGluY29tcGxldGUuIFdoZW4gdGhlIHVzZXIgc3VwcGxpZXMgYSBuYXJyb3dlclxuICogb3B0aW9ucyB0eXBlIChlLmcuIHZpYSBhIGxpdGVyYWwpLCBpdCBmYWxscyBiYWNrIHRvIGBTdWJzZXRgIHRvIGtlZXBcbiAqIGZpbHRlcmluZyBvdXQgdW5rbm93biBwcm9wZXJ0aWVzLlxuICovXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvckFyZ3M8T3B0aW9ucyBleHRlbmRzIFByaXNtYUNsaWVudE9wdGlvbnM+ID1cbiAgW1ByaXNtYUNsaWVudE9wdGlvbnNdIGV4dGVuZHMgW09wdGlvbnNdID8gUHJpc21hQ2xpZW50T3B0aW9ucyA6IFN1YnNldDxPcHRpb25zLCBQcmlzbWFDbGllbnRPcHRpb25zPjtcblxuLyoqXG4gKiBTZWxlY3RTdWJzZXRcbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYC4gU2ltcGxlIHZlcnNpb24gb2YgSW50ZXJzZWN0aW9uLlxuICogQWRkaXRpb25hbGx5LCBpdCB2YWxpZGF0ZXMsIGlmIGJvdGggc2VsZWN0IGFuZCBpbmNsdWRlIGFyZSBwcmVzZW50LiBJZiB0aGUgY2FzZSwgaXQgZXJyb3JzLlxuICovXG5leHBvcnQgdHlwZSBTZWxlY3RTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlclxufSAmXG4gIChUIGV4dGVuZHMgU2VsZWN0QW5kSW5jbHVkZVxuICAgID8gJ1BsZWFzZSBlaXRoZXIgY2hvb3NlIGBzZWxlY3RgIG9yIGBpbmNsdWRlYC4nXG4gICAgOiBUIGV4dGVuZHMgU2VsZWN0QW5kT21pdFxuICAgICAgPyAnUGxlYXNlIGVpdGhlciBjaG9vc2UgYHNlbGVjdGAgb3IgYG9taXRgLidcbiAgICAgIDoge30pXG5cbi8qKlxuICogU3Vic2V0ICsgSW50ZXJzZWN0aW9uXG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAgYW5kIGludGVyc2VjdCBgS2BcbiAqL1xuZXhwb3J0IHR5cGUgU3Vic2V0SW50ZXJzZWN0aW9uPFQsIFUsIEs+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiBrZXkgZXh0ZW5kcyBrZXlvZiBVID8gVFtrZXldIDogbmV2ZXJcbn0gJlxuICBLXG5cbnR5cGUgV2l0aG91dDxULCBVPiA9IHsgW1AgaW4gRXhjbHVkZTxrZXlvZiBULCBrZXlvZiBVPl0/OiBuZXZlciB9O1xuXG4vKipcbiAqIFhPUiBpcyBuZWVkZWQgdG8gaGF2ZSBhIHJlYWwgbXV0dWFsbHkgZXhjbHVzaXZlIHVuaW9uIHR5cGVcbiAqIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQyMTIzNDA3L2RvZXMtdHlwZXNjcmlwdC1zdXBwb3J0LW11dHVhbGx5LWV4Y2x1c2l2ZS10eXBlc1xuICovXG5leHBvcnQgdHlwZSBYT1I8VCwgVT4gPVxuICBUIGV4dGVuZHMgb2JqZWN0ID9cbiAgVSBleHRlbmRzIG9iamVjdCA/XG4gICAgKChXaXRob3V0PFQsIFU+ICYgVSkgfCAoV2l0aG91dDxVLCBUPiAmIFQpKSAmIG9iamVjdFxuICA6IFUgOiBUXG5cblxuLyoqXG4gKiBJcyBUIGEgUmVjb3JkP1xuICovXG50eXBlIElzT2JqZWN0PFQgZXh0ZW5kcyBhbnk+ID0gVCBleHRlbmRzIEFycmF5PGFueT5cbj8gRmFsc2VcbjogVCBleHRlbmRzIERhdGVcbj8gRmFsc2VcbjogVCBleHRlbmRzIFVpbnQ4QXJyYXlcbj8gRmFsc2VcbjogVCBleHRlbmRzIEJpZ0ludFxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgb2JqZWN0XG4/IFRydWVcbjogRmFsc2VcblxuXG4vKipcbiAqIElmIGl0J3MgVFtdLCByZXR1cm4gVFxuICovXG5leHBvcnQgdHlwZSBVbkVudW1lcmF0ZTxUIGV4dGVuZHMgdW5rbm93bj4gPSBUIGV4dGVuZHMgQXJyYXk8aW5mZXIgVT4gPyBVIDogVFxuXG4vKipcbiAqIEZyb20gdHMtdG9vbGJlbHRcbiAqL1xuXG50eXBlIF9fRWl0aGVyPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gT21pdDxPLCBLPiAmXG4gIHtcbiAgICAvLyBNZXJnZSBhbGwgYnV0IEtcbiAgICBbUCBpbiBLXTogUHJpc21hX19QaWNrPE8sIFAgJiBrZXlvZiBPPiAvLyBXaXRoIEsgcG9zc2liaWxpdGllc1xuICB9W0tdXG5cbnR5cGUgRWl0aGVyU3RyaWN0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gU3RyaWN0PF9fRWl0aGVyPE8sIEs+PlxuXG50eXBlIEVpdGhlckxvb3NlPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gQ29tcHV0ZVJhdzxfX0VpdGhlcjxPLCBLPj5cblxudHlwZSBfRWl0aGVyPFxuICBPIGV4dGVuZHMgb2JqZWN0LFxuICBLIGV4dGVuZHMgS2V5LFxuICBzdHJpY3QgZXh0ZW5kcyBCb29sZWFuXG4+ID0ge1xuICAxOiBFaXRoZXJTdHJpY3Q8TywgSz5cbiAgMDogRWl0aGVyTG9vc2U8TywgSz5cbn1bc3RyaWN0XVxuXG5leHBvcnQgdHlwZSBFaXRoZXI8XG4gIE8gZXh0ZW5kcyBvYmplY3QsXG4gIEsgZXh0ZW5kcyBLZXksXG4gIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxXG4+ID0gTyBleHRlbmRzIHVua25vd24gPyBfRWl0aGVyPE8sIEssIHN0cmljdD4gOiBuZXZlclxuXG5leHBvcnQgdHlwZSBVbmlvbiA9IGFueVxuXG5leHBvcnQgdHlwZSBQYXRjaFVuZGVmaW5lZDxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gIFtLIGluIGtleW9mIE9dOiBPW0tdIGV4dGVuZHMgdW5kZWZpbmVkID8gQXQ8TzEsIEs+IDogT1tLXVxufSAmIHt9XG5cbi8qKiBIZWxwZXIgVHlwZXMgZm9yIFwiTWVyZ2VcIiAqKi9cbmV4cG9ydCB0eXBlIEludGVyc2VjdE9mPFUgZXh0ZW5kcyBVbmlvbj4gPSAoXG4gIFUgZXh0ZW5kcyB1bmtub3duID8gKGs6IFUpID0+IHZvaWQgOiBuZXZlclxuKSBleHRlbmRzIChrOiBpbmZlciBJKSA9PiB2b2lkXG4gID8gSVxuICA6IG5ldmVyXG5cbmV4cG9ydCB0eXBlIE92ZXJ3cml0ZTxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gICAgW0sgaW4ga2V5b2YgT106IEsgZXh0ZW5kcyBrZXlvZiBPMSA/IE8xW0tdIDogT1tLXTtcbn0gJiB7fTtcblxudHlwZSBfTWVyZ2U8VSBleHRlbmRzIG9iamVjdD4gPSBJbnRlcnNlY3RPZjxPdmVyd3JpdGU8VSwge1xuICAgIFtLIGluIGtleW9mIFVdLT86IEF0PFUsIEs+O1xufT4+O1xuXG50eXBlIEtleSA9IHN0cmluZyB8IG51bWJlciB8IHN5bWJvbDtcbnR5cGUgQXRTdHJpY3Q8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBPW0sgJiBrZXlvZiBPXTtcbnR5cGUgQXRMb29zZTxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IE8gZXh0ZW5kcyB1bmtub3duID8gQXRTdHJpY3Q8TywgSz4gOiBuZXZlcjtcbmV4cG9ydCB0eXBlIEF0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXksIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxPiA9IHtcbiAgICAxOiBBdFN0cmljdDxPLCBLPjtcbiAgICAwOiBBdExvb3NlPE8sIEs+O1xufVtzdHJpY3RdO1xuXG5leHBvcnQgdHlwZSBDb21wdXRlUmF3PEEgZXh0ZW5kcyBhbnk+ID0gQSBleHRlbmRzIEZ1bmN0aW9uID8gQSA6IHtcbiAgW0sgaW4ga2V5b2YgQV06IEFbS107XG59ICYge307XG5cbmV4cG9ydCB0eXBlIE9wdGlvbmFsRmxhdDxPPiA9IHtcbiAgW0sgaW4ga2V5b2YgT10/OiBPW0tdO1xufSAmIHt9O1xuXG50eXBlIF9SZWNvcmQ8SyBleHRlbmRzIGtleW9mIGFueSwgVD4gPSB7XG4gIFtQIGluIEtdOiBUO1xufTtcblxuLy8gY2F1c2UgdHlwZXNjcmlwdCBub3QgdG8gZXhwYW5kIHR5cGVzIGFuZCBwcmVzZXJ2ZSBuYW1lc1xudHlwZSBOb0V4cGFuZDxUPiA9IFQgZXh0ZW5kcyB1bmtub3duID8gVCA6IG5ldmVyO1xuXG4vLyB0aGlzIHR5cGUgYXNzdW1lcyB0aGUgcGFzc2VkIG9iamVjdCBpcyBlbnRpcmVseSBvcHRpb25hbFxuZXhwb3J0IHR5cGUgQXRMZWFzdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgc3RyaW5nPiA9IE5vRXhwYW5kPFxuICBPIGV4dGVuZHMgdW5rbm93blxuICA/IHwgKEsgZXh0ZW5kcyBrZXlvZiBPID8geyBbUCBpbiBLXTogT1tQXSB9ICYgTyA6IE8pXG4gICAgfCB7W1AgaW4ga2V5b2YgTyBhcyBQIGV4dGVuZHMgSyA/IFAgOiBuZXZlcl0tPzogT1tQXX0gJiBPXG4gIDogbmV2ZXI+O1xuXG50eXBlIF9TdHJpY3Q8VSwgX1UgPSBVPiA9IFUgZXh0ZW5kcyB1bmtub3duID8gVSAmIE9wdGlvbmFsRmxhdDxfUmVjb3JkPEV4Y2x1ZGU8S2V5czxfVT4sIGtleW9mIFU+LCBuZXZlcj4+IDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIFN0cmljdDxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X1N0cmljdDxVPj47XG4vKiogRW5kIEhlbHBlciBUeXBlcyBmb3IgXCJNZXJnZVwiICoqL1xuXG5leHBvcnQgdHlwZSBNZXJnZTxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X01lcmdlPFN0cmljdDxVPj4+O1xuXG5leHBvcnQgdHlwZSBCb29sZWFuID0gVHJ1ZSB8IEZhbHNlXG5cbmV4cG9ydCB0eXBlIFRydWUgPSAxXG5cbmV4cG9ydCB0eXBlIEZhbHNlID0gMFxuXG5leHBvcnQgdHlwZSBOb3Q8QiBleHRlbmRzIEJvb2xlYW4+ID0ge1xuICAwOiAxXG4gIDE6IDBcbn1bQl1cblxuZXhwb3J0IHR5cGUgRXh0ZW5kczxBMSBleHRlbmRzIGFueSwgQTIgZXh0ZW5kcyBhbnk+ID0gW0ExXSBleHRlbmRzIFtuZXZlcl1cbiAgPyAwIC8vIGFueXRoaW5nIGBuZXZlcmAgaXMgZmFsc2VcbiAgOiBBMSBleHRlbmRzIEEyXG4gID8gMVxuICA6IDBcblxuZXhwb3J0IHR5cGUgSGFzPFUgZXh0ZW5kcyBVbmlvbiwgVTEgZXh0ZW5kcyBVbmlvbj4gPSBOb3Q8XG4gIEV4dGVuZHM8RXhjbHVkZTxVMSwgVT4sIFUxPlxuPlxuXG5leHBvcnQgdHlwZSBPcjxCMSBleHRlbmRzIEJvb2xlYW4sIEIyIGV4dGVuZHMgQm9vbGVhbj4gPSB7XG4gIDA6IHtcbiAgICAwOiAwXG4gICAgMTogMVxuICB9XG4gIDE6IHtcbiAgICAwOiAxXG4gICAgMTogMVxuICB9XG59W0IxXVtCMl1cblxuZXhwb3J0IHR5cGUgS2V5czxVIGV4dGVuZHMgVW5pb24+ID0gVSBleHRlbmRzIHVua25vd24gPyBrZXlvZiBVIDogbmV2ZXJcblxuZXhwb3J0IHR5cGUgR2V0U2NhbGFyVHlwZTxULCBPPiA9IE8gZXh0ZW5kcyBvYmplY3QgPyB7XG4gIFtQIGluIGtleW9mIFRdOiBQIGV4dGVuZHMga2V5b2YgT1xuICAgID8gT1tQXVxuICAgIDogbmV2ZXJcbn0gOiBuZXZlclxuXG50eXBlIEZpZWxkUGF0aHM8XG4gIFQsXG4gIFUgPSBPbWl0PFQsICdfYXZnJyB8ICdfc3VtJyB8ICdfY291bnQnIHwgJ19taW4nIHwgJ19tYXgnPlxuPiA9IElzT2JqZWN0PFQ+IGV4dGVuZHMgVHJ1ZSA/IFUgOiBUXG5cbmV4cG9ydCB0eXBlIEdldEhhdmluZ0ZpZWxkczxUPiA9IHtcbiAgW0sgaW4ga2V5b2YgVF06IE9yPFxuICAgIE9yPEV4dGVuZHM8J09SJywgSz4sIEV4dGVuZHM8J0FORCcsIEs+PixcbiAgICBFeHRlbmRzPCdOT1QnLCBLPlxuICA+IGV4dGVuZHMgVHJ1ZVxuICAgID8gLy8gaW5mZXIgaXMgb25seSBuZWVkZWQgdG8gbm90IGhpdCBUUyBsaW1pdFxuICAgICAgLy8gYmFzZWQgb24gdGhlIGJyaWxsaWFudCBpZGVhIG9mIFBpZXJyZS1BbnRvaW5lIE1pbGxzXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzMwMTg4I2lzc3VlY29tbWVudC00Nzg5Mzg0MzdcbiAgICAgIFRbS10gZXh0ZW5kcyBpbmZlciBUS1xuICAgICAgPyBHZXRIYXZpbmdGaWVsZHM8VW5FbnVtZXJhdGU8VEs+IGV4dGVuZHMgb2JqZWN0ID8gTWVyZ2U8VW5FbnVtZXJhdGU8VEs+PiA6IG5ldmVyPlxuICAgICAgOiBuZXZlclxuICAgIDoge30gZXh0ZW5kcyBGaWVsZFBhdGhzPFRbS10+XG4gICAgPyBuZXZlclxuICAgIDogS1xufVtrZXlvZiBUXVxuXG4vKipcbiAqIENvbnZlcnQgdHVwbGUgdG8gdW5pb25cbiAqL1xudHlwZSBfVHVwbGVUb1VuaW9uPFQ+ID0gVCBleHRlbmRzIChpbmZlciBFKVtdID8gRSA6IG5ldmVyXG50eXBlIFR1cGxlVG9VbmlvbjxLIGV4dGVuZHMgcmVhZG9ubHkgYW55W10+ID0gX1R1cGxlVG9VbmlvbjxLPlxuZXhwb3J0IHR5cGUgTWF5YmVUdXBsZVRvVW5pb248VD4gPSBUIGV4dGVuZHMgYW55W10gPyBUdXBsZVRvVW5pb248VD4gOiBUXG5cbi8qKlxuICogTGlrZSBgUGlja2AsIGJ1dCBhZGRpdGlvbmFsbHkgY2FuIGFsc28gYWNjZXB0IGFuIGFycmF5IG9mIGtleXNcbiAqL1xuZXhwb3J0IHR5cGUgUGlja0VudW1lcmFibGU8VCwgSyBleHRlbmRzIEVudW1lcmFibGU8a2V5b2YgVD4gfCBrZXlvZiBUPiA9IFByaXNtYV9fUGljazxULCBNYXliZVR1cGxlVG9VbmlvbjxLPj5cblxuLyoqXG4gKiBFeGNsdWRlIGFsbCBrZXlzIHdpdGggdW5kZXJzY29yZXNcbiAqL1xuZXhwb3J0IHR5cGUgRXhjbHVkZVVuZGVyc2NvcmVLZXlzPFQgZXh0ZW5kcyBzdHJpbmc+ID0gVCBleHRlbmRzIGBfJHtzdHJpbmd9YCA/IG5ldmVyIDogVFxuXG5cbmV4cG9ydCB0eXBlIEZpZWxkUmVmPE1vZGVsLCBGaWVsZFR5cGU+ID0gcnVudGltZS5GaWVsZFJlZjxNb2RlbCwgRmllbGRUeXBlPlxuXG50eXBlIEZpZWxkUmVmSW5wdXRUeXBlPE1vZGVsLCBGaWVsZFR5cGU+ID0gTW9kZWwgZXh0ZW5kcyBuZXZlciA/IG5ldmVyIDogRmllbGRSZWY8TW9kZWwsIEZpZWxkVHlwZT5cblxuXG5leHBvcnQgY29uc3QgTW9kZWxOYW1lID0ge1xuICBCbG9nQ29tbWVudDogJ0Jsb2dDb21tZW50JyxcbiAgQmxvZ1Bvc3Q6ICdCbG9nUG9zdCcsXG4gIEJvb2tpbmc6ICdCb29raW5nJyxcbiAgQ2F0ZWdvcnk6ICdDYXRlZ29yeScsXG4gIENvbnRhY3RNZXNzYWdlOiAnQ29udGFjdE1lc3NhZ2UnLFxuICBOb3RpZmljYXRpb246ICdOb3RpZmljYXRpb24nLFxuICBQYXltZW50OiAnUGF5bWVudCcsXG4gIFJlZnJlc2hUb2tlbjogJ1JlZnJlc2hUb2tlbicsXG4gIFJldmlldzogJ1JldmlldycsXG4gIFRvdXJQYWNrYWdlOiAnVG91clBhY2thZ2UnLFxuICBVc2VyOiAnVXNlcicsXG4gIFdpc2hsaXN0SXRlbTogJ1dpc2hsaXN0SXRlbSdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgTW9kZWxOYW1lID0gKHR5cGVvZiBNb2RlbE5hbWUpW2tleW9mIHR5cGVvZiBNb2RlbE5hbWVdXG5cblxuXG5leHBvcnQgaW50ZXJmYWNlIFR5cGVNYXBDYjxHbG9iYWxPbWl0T3B0aW9ucyA9IHt9PiBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuVXRpbHMuRm48e2V4dEFyZ3M6IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgfSwgcnVudGltZS5UeXBlcy5VdGlscy5SZWNvcmQ8c3RyaW5nLCBhbnk+PiB7XG4gIHJldHVybnM6IFR5cGVNYXA8dGhpc1sncGFyYW1zJ11bJ2V4dEFyZ3MnXSwgR2xvYmFsT21pdE9wdGlvbnM+XG59XG5cbmV4cG9ydCB0eXBlIFR5cGVNYXA8RXh0QXJncyBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3MsIEdsb2JhbE9taXRPcHRpb25zID0ge30+ID0ge1xuICBnbG9iYWxPbWl0T3B0aW9uczoge1xuICAgIG9taXQ6IEdsb2JhbE9taXRPcHRpb25zXG4gIH1cbiAgbWV0YToge1xuICAgIG1vZGVsUHJvcHM6IFwiYmxvZ0NvbW1lbnRcIiB8IFwiYmxvZ1Bvc3RcIiB8IFwiYm9va2luZ1wiIHwgXCJjYXRlZ29yeVwiIHwgXCJjb250YWN0TWVzc2FnZVwiIHwgXCJub3RpZmljYXRpb25cIiB8IFwicGF5bWVudFwiIHwgXCJyZWZyZXNoVG9rZW5cIiB8IFwicmV2aWV3XCIgfCBcInRvdXJQYWNrYWdlXCIgfCBcInVzZXJcIiB8IFwid2lzaGxpc3RJdGVtXCJcbiAgICB0eElzb2xhdGlvbkxldmVsOiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsXG4gIH1cbiAgbW9kZWw6IHtcbiAgICBCbG9nQ29tbWVudDoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkJsb2dDb21tZW50RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudEZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudEZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnREZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudFVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudFVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudEFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUJsb2dDb21tZW50PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQmxvZ0NvbW1lbnRHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5CbG9nQ29tbWVudENvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBCbG9nUG9zdDoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRCbG9nUG9zdFBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkJsb2dQb3N0RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3REZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUJsb2dQb3N0PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQmxvZ1Bvc3RHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5CbG9nUG9zdENvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBCb29raW5nOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Cb29raW5nRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0RlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0RlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1Vwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVCb29raW5nPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0dyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Cb29raW5nR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Cb29raW5nQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIENhdGVnb3J5OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJENhdGVnb3J5UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQ2F0ZWdvcnlGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQ2F0ZWdvcnk+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5DYXRlZ29yeUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNhdGVnb3J5Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIENvbnRhY3RNZXNzYWdlOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQ29udGFjdE1lc3NhZ2U+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Db250YWN0TWVzc2FnZUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNvbnRhY3RNZXNzYWdlQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIE5vdGlmaWNhdGlvbjoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Ob3RpZmljYXRpb25GaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25GaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25GaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25EZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvblVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkRlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvblVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvblVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25BZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVOb3RpZmljYXRpb24+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25Hcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuTm90aWZpY2F0aW9uR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25Db3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLk5vdGlmaWNhdGlvbkNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBQYXltZW50OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFBheW1lbnRQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5QYXltZW50RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudERlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudERlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVQYXltZW50PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5QYXltZW50R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5QYXltZW50Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFJlZnJlc2hUb2tlbjoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5SZWZyZXNoVG9rZW5GaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5GaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5GaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5EZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlblVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkRlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlblVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlblVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5BZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVSZWZyZXNoVG9rZW4+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5Hcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUmVmcmVzaFRva2VuR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5Db3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJlZnJlc2hUb2tlbkNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBSZXZpZXc6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kUmV2aWV3UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUmV2aWV3RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1Vwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUmV2aWV3PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJldmlld0dyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5SZXZpZXdDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgVG91clBhY2thZ2U6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Ub3VyUGFja2FnZUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVUb3VyUGFja2FnZT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlRvdXJQYWNrYWdlR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVG91clBhY2thZ2VDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgVXNlcjoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRVc2VyUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuVXNlckZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlVXNlcj5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVXNlckdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVXNlckNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBXaXNobGlzdEl0ZW06IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1VcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1EZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1VcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1VcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbVVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlV2lzaGxpc3RJdGVtPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLldpc2hsaXN0SXRlbUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5XaXNobGlzdEl0ZW1Db3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0gJiB7XG4gIG90aGVyOiB7XG4gICAgcGF5bG9hZDogYW55XG4gICAgb3BlcmF0aW9uczoge1xuICAgICAgJGV4ZWN1dGVSYXc6IHtcbiAgICAgICAgYXJnczogW3F1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFNxbCwgLi4udmFsdWVzOiBhbnlbXV0sXG4gICAgICAgIHJlc3VsdDogYW55XG4gICAgICB9XG4gICAgICAkZXhlY3V0ZVJhd1Vuc2FmZToge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXV0sXG4gICAgICAgIHJlc3VsdDogYW55XG4gICAgICB9XG4gICAgICAkcXVlcnlSYXc6IHtcbiAgICAgICAgYXJnczogW3F1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFNxbCwgLi4udmFsdWVzOiBhbnlbXV0sXG4gICAgICAgIHJlc3VsdDogYW55XG4gICAgICB9XG4gICAgICAkcXVlcnlSYXdVbnNhZmU6IHtcbiAgICAgICAgYXJnczogW3F1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEVudW1zXG4gKi9cblxuZXhwb3J0IGNvbnN0IFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgPSBydW50aW1lLm1ha2VTdHJpY3RFbnVtKHtcbiAgUmVhZFVuY29tbWl0dGVkOiAnUmVhZFVuY29tbWl0dGVkJyxcbiAgUmVhZENvbW1pdHRlZDogJ1JlYWRDb21taXR0ZWQnLFxuICBSZXBlYXRhYmxlUmVhZDogJ1JlcGVhdGFibGVSZWFkJyxcbiAgU2VyaWFsaXphYmxlOiAnU2VyaWFsaXphYmxlJ1xufSBhcyBjb25zdClcblxuZXhwb3J0IHR5cGUgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCA9ICh0eXBlb2YgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbClba2V5b2YgdHlwZW9mIFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWxdXG5cblxuZXhwb3J0IGNvbnN0IEJsb2dDb21tZW50U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgY29udGVudDogJ2NvbnRlbnQnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICBwb3N0SWQ6ICdwb3N0SWQnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYXJlbnRJZDogJ3BhcmVudElkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBCbG9nQ29tbWVudFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQmxvZ0NvbW1lbnRTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCbG9nQ29tbWVudFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBleGNlcnB0OiAnZXhjZXJwdCcsXG4gIGNvbnRlbnQ6ICdjb250ZW50JyxcbiAgY292ZXJJbWFnZTogJ2NvdmVySW1hZ2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICBhdXRob3JJZDogJ2F1dGhvcklkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCbG9nUG9zdFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQm9va2luZ1NjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRyYXZlbERhdGU6ICd0cmF2ZWxEYXRlJyxcbiAgdHJhdmVsZXJzOiAndHJhdmVsZXJzJyxcbiAgdG90YWxQcmljZTogJ3RvdGFsUHJpY2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYWNrYWdlSWQ6ICdwYWNrYWdlSWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCb29raW5nU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgZW1haWw6ICdlbWFpbCcsXG4gIHN1YmplY3Q6ICdzdWJqZWN0JyxcbiAgbWVzc2FnZTogJ21lc3NhZ2UnLFxuICBpc1Jlc29sdmVkOiAnaXNSZXNvbHZlZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IE5vdGlmaWNhdGlvblNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHR5cGU6ICd0eXBlJyxcbiAgdGl0bGU6ICd0aXRsZScsXG4gIG1lc3NhZ2U6ICdtZXNzYWdlJyxcbiAgbGluazogJ2xpbmsnLFxuICBpc1JlYWQ6ICdpc1JlYWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE5vdGlmaWNhdGlvblNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgTm90aWZpY2F0aW9uU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgTm90aWZpY2F0aW9uU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBQYXltZW50U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgYm9va2luZ0lkOiAnYm9va2luZ0lkJyxcbiAgdHJhbklkOiAndHJhbklkJyxcbiAgdmFsSWQ6ICd2YWxJZCcsXG4gIGFtb3VudDogJ2Ftb3VudCcsXG4gIGN1cnJlbmN5OiAnY3VycmVuY3knLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBnYXRld2F5UGFnZVVybDogJ2dhdGV3YXlQYWdlVXJsJyxcbiAgc3NsU2Vzc2lvbktleTogJ3NzbFNlc3Npb25LZXknLFxuICBjYXJkVHlwZTogJ2NhcmRUeXBlJyxcbiAgYmFua1RyYW5JZDogJ2JhbmtUcmFuSWQnLFxuICBwYWlkQXQ6ICdwYWlkQXQnLFxuICByZWZ1bmRSZWZJZDogJ3JlZnVuZFJlZklkJyxcbiAgcmVmdW5kZWRBdDogJ3JlZnVuZGVkQXQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBheW1lbnRTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFBheW1lbnRTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBQYXltZW50U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBSZWZyZXNoVG9rZW5TY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBoYXNoOiAnaGFzaCcsXG4gIGV4cGlyZXNBdDogJ2V4cGlyZXNBdCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHJldm9rZWRBdDogJ3Jldm9rZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUmVmcmVzaFRva2VuU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBSZWZyZXNoVG9rZW5TY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBSZWZyZXNoVG9rZW5TY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFJldmlld1NjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHJhdGluZzogJ3JhdGluZycsXG4gIGNvbW1lbnQ6ICdjb21tZW50JyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgcGFja2FnZUlkOiAncGFja2FnZUlkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBSZXZpZXdTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFJldmlld1NjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFJldmlld1NjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBkZXNjcmlwdGlvbjogJ2Rlc2NyaXB0aW9uJyxcbiAgbG9jYXRpb246ICdsb2NhdGlvbicsXG4gIHByaWNlOiAncHJpY2UnLFxuICBkdXJhdGlvbjogJ2R1cmF0aW9uJyxcbiAgcmF0aW5nOiAncmF0aW5nJyxcbiAgaW1hZ2VzOiAnaW1hZ2VzJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgY2F0ZWdvcnlJZDogJ2NhdGVnb3J5SWQnLFxuICBhZ2VudElkOiAnYWdlbnRJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFVzZXJTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBuYW1lOiAnbmFtZScsXG4gIGVtYWlsOiAnZW1haWwnLFxuICBwYXNzd29yZDogJ3Bhc3N3b3JkJyxcbiAgZ29vZ2xlSWQ6ICdnb29nbGVJZCcsXG4gIHBob25lOiAncGhvbmUnLFxuICBhdmF0YXJVcmw6ICdhdmF0YXJVcmwnLFxuICByb2xlOiAncm9sZScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGF1dGhQcm92aWRlcjogJ2F1dGhQcm92aWRlcicsXG4gIGVtYWlsVmVyaWZpZWQ6ICdlbWFpbFZlcmlmaWVkJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgdG9rZW5WZXJzaW9uOiAndG9rZW5WZXJzaW9uJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBVc2VyU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBVc2VyU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgVXNlclNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgV2lzaGxpc3RJdGVtU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgcGFja2FnZUlkOiAncGFja2FnZUlkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBXaXNobGlzdEl0ZW1TY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFdpc2hsaXN0SXRlbVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFdpc2hsaXN0SXRlbVNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgU29ydE9yZGVyID0ge1xuICBhc2M6ICdhc2MnLFxuICBkZXNjOiAnZGVzYydcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgU29ydE9yZGVyID0gKHR5cGVvZiBTb3J0T3JkZXIpW2tleW9mIHR5cGVvZiBTb3J0T3JkZXJdXG5cblxuZXhwb3J0IGNvbnN0IFF1ZXJ5TW9kZSA9IHtcbiAgZGVmYXVsdDogJ2RlZmF1bHQnLFxuICBpbnNlbnNpdGl2ZTogJ2luc2Vuc2l0aXZlJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBRdWVyeU1vZGUgPSAodHlwZW9mIFF1ZXJ5TW9kZSlba2V5b2YgdHlwZW9mIFF1ZXJ5TW9kZV1cblxuXG5leHBvcnQgY29uc3QgTnVsbHNPcmRlciA9IHtcbiAgZmlyc3Q6ICdmaXJzdCcsXG4gIGxhc3Q6ICdsYXN0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBOdWxsc09yZGVyID0gKHR5cGVvZiBOdWxsc09yZGVyKVtrZXlvZiB0eXBlb2YgTnVsbHNPcmRlcl1cblxuXG5cbi8qKlxuICogRmllbGQgcmVmZXJlbmNlc1xuICovXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdTdHJpbmcnXG4gKi9cbmV4cG9ydCB0eXBlIFN0cmluZ0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1N0cmluZyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdTdHJpbmdbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdFN0cmluZ0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1N0cmluZ1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Jvb2xlYW4nXG4gKi9cbmV4cG9ydCB0eXBlIEJvb2xlYW5GaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29sZWFuJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RhdGVUaW1lJ1xuICovXG5leHBvcnQgdHlwZSBEYXRlVGltZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RhdGVUaW1lJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RhdGVUaW1lW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3REYXRlVGltZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RhdGVUaW1lW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUG9zdFN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBvc3RTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQb3N0U3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1Bvc3RTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Qb3N0U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUG9zdFN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0ludCdcbiAqL1xuZXhwb3J0IHR5cGUgSW50RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnSW50Jz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0ludFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0SW50RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnSW50W10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGVjaW1hbCdcbiAqL1xuZXhwb3J0IHR5cGUgRGVjaW1hbEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RlY2ltYWwnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGVjaW1hbFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RGVjaW1hbEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RlY2ltYWxbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29raW5nU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtQm9va2luZ1N0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Jvb2tpbmdTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQm9va2luZ1N0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bUJvb2tpbmdTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29raW5nU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnTm90aWZpY2F0aW9uVHlwZSdcbiAqL1xuZXhwb3J0IHR5cGUgRW51bU5vdGlmaWNhdGlvblR5cGVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdOb3RpZmljYXRpb25UeXBlJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ05vdGlmaWNhdGlvblR5cGVbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Ob3RpZmljYXRpb25UeXBlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnTm90aWZpY2F0aW9uVHlwZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BheW1lbnRTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1QYXltZW50U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGF5bWVudFN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYXltZW50U3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUGF5bWVudFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BheW1lbnRTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdGbG9hdCdcbiAqL1xuZXhwb3J0IHR5cGUgRmxvYXRGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdGbG9hdCc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdGbG9hdFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RmxvYXRGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdGbG9hdFtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BhY2thZ2VTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1QYWNrYWdlU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGFja2FnZVN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYWNrYWdlU3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUGFja2FnZVN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BhY2thZ2VTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdSb2xlJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUm9sZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1JvbGUnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUm9sZVtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVJvbGVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdSb2xlW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnVXNlclN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVVzZXJTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdVc2VyU3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1VzZXJTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Vc2VyU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnVXNlclN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0F1dGhQcm92aWRlcidcbiAqL1xuZXhwb3J0IHR5cGUgRW51bUF1dGhQcm92aWRlckZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0F1dGhQcm92aWRlcic+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdBdXRoUHJvdmlkZXJbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1BdXRoUHJvdmlkZXJGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdBdXRoUHJvdmlkZXJbXSc+XG4gICAgXG5cbi8qKlxuICogQmF0Y2ggUGF5bG9hZCBmb3IgdXBkYXRlTWFueSAmIGRlbGV0ZU1hbnkgJiBjcmVhdGVNYW55XG4gKi9cbmV4cG9ydCB0eXBlIEJhdGNoUGF5bG9hZCA9IHtcbiAgY291bnQ6IG51bWJlclxufVxuXG5leHBvcnQgY29uc3QgZGVmaW5lRXh0ZW5zaW9uID0gcnVudGltZS5FeHRlbnNpb25zLmRlZmluZUV4dGVuc2lvbiBhcyB1bmtub3duIGFzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5FeHRlbmRzSG9vazxcImRlZmluZVwiLCBUeXBlTWFwQ2IsIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncz5cbmV4cG9ydCB0eXBlIERlZmF1bHRQcmlzbWFDbGllbnQgPSBQcmlzbWFDbGllbnRcbmV4cG9ydCB0eXBlIEVycm9yRm9ybWF0ID0gJ3ByZXR0eScgfCAnY29sb3JsZXNzJyB8ICdtaW5pbWFsJ1xuLyoqXG4gKiBPcHRpb25zIGNvbW1vbiB0byBhbGwgdmFyaWFudHMgb2YgYFByaXNtYUNsaWVudE9wdGlvbnNgLCByZWdhcmRsZXNzIG9mIHdoZXRoZXIgeW91IGNvbm5lY3QgdG8geW91ciBkYXRhYmFzZSB0aHJvdWdoIGEgZHJpdmVyIGFkYXB0ZXIgb3IgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRCYXNlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBAZGVmYXVsdCBcImNvbG9ybGVzc1wiXG4gICAqL1xuICBlcnJvckZvcm1hdD86IEVycm9yRm9ybWF0XG4gIC8qKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogLy8gU2hvcnRoYW5kIGZvciBgZW1pdDogJ3N0ZG91dCdgXG4gICAqIGxvZzogWydxdWVyeScsICdpbmZvJywgJ3dhcm4nLCAnZXJyb3InXVxuICAgKiBcbiAgICogLy8gRW1pdCBhcyBldmVudHMgb25seVxuICAgKiBsb2c6IFtcbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAncXVlcnknIH0sXG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ2luZm8nIH0sXG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ3dhcm4nIH1cbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAnZXJyb3InIH1cbiAgICogXVxuICAgKiBcbiAgICogLyBFbWl0IGFzIGV2ZW50cyBhbmQgbG9nIHRvIHN0ZG91dFxuICAgKiBvZzogW1xuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICdxdWVyeScgfSxcbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAnaW5mbycgfSxcbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAnd2FybicgfVxuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICdlcnJvcicgfVxuICAgKiBcbiAgICogYGBgXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2xvZ2dpbmcpLlxuICAgKi9cbiAgbG9nPzogKExvZ0xldmVsIHwgTG9nRGVmaW5pdGlvbilbXVxuICAvKipcbiAgICogVGhlIGRlZmF1bHQgdmFsdWVzIGZvciB0cmFuc2FjdGlvbk9wdGlvbnNcbiAgICogbWF4V2FpdCA/PSAyMDAwXG4gICAqIHRpbWVvdXQgPz0gNTAwMFxuICAgKi9cbiAgdHJhbnNhY3Rpb25PcHRpb25zPzoge1xuICAgIG1heFdhaXQ/OiBudW1iZXJcbiAgICB0aW1lb3V0PzogbnVtYmVyXG4gICAgaXNvbGF0aW9uTGV2ZWw/OiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsXG4gIH1cbiAgLyoqXG4gICAqIEdsb2JhbCBjb25maWd1cmF0aW9uIGZvciBvbWl0dGluZyBtb2RlbCBmaWVsZHMgYnkgZGVmYXVsdC5cbiAgICogXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAgICogICBvbWl0OiB7XG4gICAqICAgICB1c2VyOiB7XG4gICAqICAgICAgIHBhc3N3b3JkOiB0cnVlXG4gICAqICAgICB9XG4gICAqICAgfVxuICAgKiB9KVxuICAgKiBgYGBcbiAgICovXG4gIG9taXQ/OiBHbG9iYWxPbWl0Q29uZmlnXG4gIC8qKlxuICAgKiBTUUwgY29tbWVudGVyIHBsdWdpbnMgdGhhdCBhZGQgbWV0YWRhdGEgdG8gU1FMIHF1ZXJpZXMgYXMgY29tbWVudHMuXG4gICAqIENvbW1lbnRzIGZvbGxvdyB0aGUgc3FsY29tbWVudGVyIGZvcm1hdDogaHR0cHM6Ly9nb29nbGUuZ2l0aHViLmlvL3NxbGNvbW1lbnRlci9cbiAgICogXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAgICogICBhZGFwdGVyLFxuICAgKiAgIGNvbW1lbnRzOiBbXG4gICAqICAgICB0cmFjZUNvbnRleHQoKSxcbiAgICogICAgIHF1ZXJ5SW5zaWdodHMoKSxcbiAgICogICBdLFxuICAgKiB9KVxuICAgKiBgYGBcbiAgICovXG4gIGNvbW1lbnRzPzogcnVudGltZS5TcWxDb21tZW50ZXJQbHVnaW5bXVxuICAvKipcbiAgICogT3B0aW9uYWwgbWF4aW11bSBzaXplIGZvciB0aGUgcXVlcnkgcGxhbiBjYWNoZS4gSWYgbm90IHByb3ZpZGVkLCBhIGRlZmF1bHQgc2l6ZSB3aWxsIGJlIHVzZWQuXG4gICAqIEEgdmFsdWUgb2YgYDBgIGNhbiBiZSB1c2VkIHRvIGRpc2FibGUgdGhlIGNhY2hlIGVudGlyZWx5LiBBIGhpZ2hlciBjYWNoZSBzaXplIGNhbiBpbXByb3ZlXG4gICAqIHBlcmZvcm1hbmNlIGZvciBhcHBsaWNhdGlvbnMgdGhhdCBleGVjdXRlIGEgbGFyZ2UgbnVtYmVyIG9mIHVuaXF1ZSBxdWVyaWVzLCB3aGlsZSBhIHNtYWxsZXJcbiAgICogY2FjaGUgc2l6ZSBjYW4gcmVkdWNlIG1lbW9yeSB1c2FnZS5cbiAgICogXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAgICogICBhZGFwdGVyLFxuICAgKiAgIHF1ZXJ5UGxhbkNhY2hlTWF4U2l6ZTogMTAwLFxuICAgKiB9KVxuICAgKiBgYGBcbiAgICovXG4gIHF1ZXJ5UGxhbkNhY2hlTWF4U2l6ZT86IG51bWJlclxufVxuXG4vKipcbiAqIGBQcmlzbWFDbGllbnRgIG9wdGlvbnMgZm9yIGNvbm5lY3RpbmcgdG8geW91ciBkYXRhYmFzZSB0aHJvdWdoIFByaXNtYSBBY2NlbGVyYXRlIGluc3RlYWQgb2YgYSBkcml2ZXIgYWRhcHRlci5cbiAqIFxuICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvYWNjZWxlcmF0ZVxuICovXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWNjZWxlcmF0ZVVybCBleHRlbmRzIFByaXNtYUNsaWVudEJhc2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSBQcmlzbWEgQWNjZWxlcmF0ZSBjb25uZWN0aW9uIFVSTC4gVXNlIHRoaXMgb3B0aW9uIHRvIGNvbm5lY3QgdG8geW91ciBkYXRhYmFzZSB0aHJvdWdoIFByaXNtYSBBY2NlbGVyYXRlIGluc3RlYWQgb2YgdXNpbmcgYSBkcml2ZXIgYWRhcHRlciB0byBjb25uZWN0IGRpcmVjdGx5LlxuICAgKiBcbiAgICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvYWNjZWxlcmF0ZVxuICAgKi9cbiAgYWNjZWxlcmF0ZVVybDogc3RyaW5nXG4gIGFkYXB0ZXI/OiBuZXZlclxufVxuXG4vKipcbiAqIGBQcmlzbWFDbGllbnRgIG9wdGlvbnMgZm9yIGNvbm5lY3RpbmcgdG8geW91ciBkYXRhYmFzZSB0aHJvdWdoIGEgZHJpdmVyIGFkYXB0ZXIuIFRoaXMgaXMgdGhlIGNvbW1vbiBjYXNlIGluIFByaXNtYSA3LlxuICogXG4gKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9kcml2ZXItYWRhcHRlcnNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFkYXB0ZXIgZXh0ZW5kcyBQcmlzbWFDbGllbnRCYXNlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBBIGRyaXZlciBhZGFwdGVyIHRoYXQgUHJpc21hQ2xpZW50IHVzZXMgdG8gY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlLCBzdWNoIGFzIHRoZSBvbmVzIHByb3ZpZGVkIGJ5IGBAcHJpc21hL2FkYXB0ZXItcGdgLCBgQHByaXNtYS9hZGFwdGVyLWxpYnNxbGAsIGBAcHJpc21hL2FkYXB0ZXItcGxhbmV0c2NhbGVgLCBldGMuXG4gICAqIFxuICAgKiBBIGRyaXZlciBhZGFwdGVyIGlzICoqcmVxdWlyZWQqKiB1bmxlc3MgeW91IGNvbm5lY3QgdG8geW91ciBkYXRhYmFzZSB0aHJvdWdoIFByaXNtYSBBY2NlbGVyYXRlIChpbiB3aGljaCBjYXNlIHVzZSBgYWNjZWxlcmF0ZVVybGAgaW5zdGVhZCkuXG4gICAqIFxuICAgKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9kcml2ZXItYWRhcHRlcnNcbiAgICogXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IFByaXNtYVBnIH0gZnJvbSAnQHByaXNtYS9hZGFwdGVyLXBnJ1xuICAgKiBpbXBvcnQgeyBQcmlzbWFDbGllbnQgfSBmcm9tICcuL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50J1xuICAgKiBcbiAgICogY29uc3QgYWRhcHRlciA9IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICAgKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHsgYWRhcHRlciB9KVxuICAgKiBgYGBcbiAgICovXG4gIGFkYXB0ZXI6IHJ1bnRpbWUuU3FsRHJpdmVyQWRhcHRlckZhY3RvcnlcbiAgYWNjZWxlcmF0ZVVybD86IG5ldmVyXG59XG5cbi8qKlxuICogT3B0aW9ucyBwYXNzZWQgdG8gdGhlIGBQcmlzbWFDbGllbnRgIGNvbnN0cnVjdG9yLlxuICogXG4gKiBBIGRyaXZlciBhZGFwdGVyIChvciwgYWx0ZXJuYXRpdmVseSwgYSBQcmlzbWEgQWNjZWxlcmF0ZSBVUkwpIGlzICoqcmVxdWlyZWQqKi4gU2VlIHtAbGluayBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFkYXB0ZXJ9IGFuZCB7QGxpbmsgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBY2NlbGVyYXRlVXJsfSBmb3IgdGhlIHR3byB2YXJpYW50cy4gQWxsIG90aGVyIHByb3BlcnRpZXMgbGl2ZSBpbiB7QGxpbmsgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnN9IGFuZCBhcmUgb3B0aW9uYWwuXG4gKiBcbiAqIExlYXJuIG1vcmUgYWJvdXQgZHJpdmVyIGFkYXB0ZXJzOiBodHRwczovL3ByaXMubHkvZC9kcml2ZXItYWRhcHRlcnNcbiAqL1xuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50T3B0aW9ucyA9IFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWNjZWxlcmF0ZVVybCB8IFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWRhcHRlclxuZXhwb3J0IHR5cGUgR2xvYmFsT21pdENvbmZpZyA9IHtcbiAgYmxvZ0NvbW1lbnQ/OiBQcmlzbWEuQmxvZ0NvbW1lbnRPbWl0XG4gIGJsb2dQb3N0PzogUHJpc21hLkJsb2dQb3N0T21pdFxuICBib29raW5nPzogUHJpc21hLkJvb2tpbmdPbWl0XG4gIGNhdGVnb3J5PzogUHJpc21hLkNhdGVnb3J5T21pdFxuICBjb250YWN0TWVzc2FnZT86IFByaXNtYS5Db250YWN0TWVzc2FnZU9taXRcbiAgbm90aWZpY2F0aW9uPzogUHJpc21hLk5vdGlmaWNhdGlvbk9taXRcbiAgcGF5bWVudD86IFByaXNtYS5QYXltZW50T21pdFxuICByZWZyZXNoVG9rZW4/OiBQcmlzbWEuUmVmcmVzaFRva2VuT21pdFxuICByZXZpZXc/OiBQcmlzbWEuUmV2aWV3T21pdFxuICB0b3VyUGFja2FnZT86IFByaXNtYS5Ub3VyUGFja2FnZU9taXRcbiAgdXNlcj86IFByaXNtYS5Vc2VyT21pdFxuICB3aXNobGlzdEl0ZW0/OiBQcmlzbWEuV2lzaGxpc3RJdGVtT21pdFxufVxuXG4vKiBUeXBlcyBmb3IgTG9nZ2luZyAqL1xuZXhwb3J0IHR5cGUgTG9nTGV2ZWwgPSAnaW5mbycgfCAncXVlcnknIHwgJ3dhcm4nIHwgJ2Vycm9yJ1xuZXhwb3J0IHR5cGUgTG9nRGVmaW5pdGlvbiA9IHtcbiAgbGV2ZWw6IExvZ0xldmVsXG4gIGVtaXQ6ICdzdGRvdXQnIHwgJ2V2ZW50J1xufVxuXG5leHBvcnQgdHlwZSBDaGVja0lzTG9nTGV2ZWw8VD4gPSBUIGV4dGVuZHMgTG9nTGV2ZWwgPyBUIDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIEdldExvZ1R5cGU8VD4gPSBDaGVja0lzTG9nTGV2ZWw8XG4gIFQgZXh0ZW5kcyBMb2dEZWZpbml0aW9uID8gVFsnbGV2ZWwnXSA6IFRcbj47XG5cbmV4cG9ydCB0eXBlIEdldEV2ZW50czxUIGV4dGVuZHMgYW55W10+ID0gVCBleHRlbmRzIEFycmF5PExvZ0xldmVsIHwgTG9nRGVmaW5pdGlvbj5cbiAgPyBHZXRMb2dUeXBlPFRbbnVtYmVyXT5cbiAgOiBuZXZlcjtcblxuZXhwb3J0IHR5cGUgUXVlcnlFdmVudCA9IHtcbiAgdGltZXN0YW1wOiBEYXRlXG4gIHF1ZXJ5OiBzdHJpbmdcbiAgcGFyYW1zOiBzdHJpbmdcbiAgZHVyYXRpb246IG51bWJlclxuICB0YXJnZXQ6IHN0cmluZ1xufVxuXG5leHBvcnQgdHlwZSBMb2dFdmVudCA9IHtcbiAgdGltZXN0YW1wOiBEYXRlXG4gIG1lc3NhZ2U6IHN0cmluZ1xuICB0YXJnZXQ6IHN0cmluZ1xufVxuLyogRW5kIFR5cGVzIGZvciBMb2dnaW5nICovXG5cblxuZXhwb3J0IHR5cGUgUHJpc21hQWN0aW9uID1cbiAgfCAnZmluZFVuaXF1ZSdcbiAgfCAnZmluZFVuaXF1ZU9yVGhyb3cnXG4gIHwgJ2ZpbmRNYW55J1xuICB8ICdmaW5kRmlyc3QnXG4gIHwgJ2ZpbmRGaXJzdE9yVGhyb3cnXG4gIHwgJ2NyZWF0ZSdcbiAgfCAnY3JlYXRlTWFueSdcbiAgfCAnY3JlYXRlTWFueUFuZFJldHVybidcbiAgfCAndXBkYXRlJ1xuICB8ICd1cGRhdGVNYW55J1xuICB8ICd1cGRhdGVNYW55QW5kUmV0dXJuJ1xuICB8ICd1cHNlcnQnXG4gIHwgJ2RlbGV0ZSdcbiAgfCAnZGVsZXRlTWFueSdcbiAgfCAnZXhlY3V0ZVJhdydcbiAgfCAncXVlcnlSYXcnXG4gIHwgJ2FnZ3JlZ2F0ZSdcbiAgfCAnY291bnQnXG4gIHwgJ3J1bkNvbW1hbmRSYXcnXG4gIHwgJ2ZpbmRSYXcnXG4gIHwgJ2dyb3VwQnknXG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgcHJveHkgYXZhaWxhYmxlIGluIGludGVyYWN0aXZlIHRyYW5zYWN0aW9ucy5cbiAqL1xuZXhwb3J0IHR5cGUgVHJhbnNhY3Rpb25DbGllbnQgPSBPbWl0PERlZmF1bHRQcmlzbWFDbGllbnQsIHJ1bnRpbWUuSVRYQ2xpZW50RGVueUxpc3Q+XG5cbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiogVGhpcyBmaWxlIGV4cG9ydHMgYWxsIGVudW0gcmVsYXRlZCB0eXBlcyBmcm9tIHRoZSBzY2hlbWEuXG4qXG4qIFx1RDgzRFx1REZFMiBZb3UgY2FuIGltcG9ydCB0aGlzIGZpbGUgZGlyZWN0bHkuXG4qL1xuXG5leHBvcnQgY29uc3QgUm9sZSA9IHtcbiAgVVNFUjogJ1VTRVInLFxuICBBR0VOVDogJ0FHRU5UJyxcbiAgQURNSU46ICdBRE1JTidcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUm9sZSA9ICh0eXBlb2YgUm9sZSlba2V5b2YgdHlwZW9mIFJvbGVdXG5cblxuZXhwb3J0IGNvbnN0IFVzZXJTdGF0dXMgPSB7XG4gIEFDVElWRTogJ0FDVElWRScsXG4gIFNVU1BFTkRFRDogJ1NVU1BFTkRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVXNlclN0YXR1cyA9ICh0eXBlb2YgVXNlclN0YXR1cylba2V5b2YgdHlwZW9mIFVzZXJTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IEF1dGhQcm92aWRlciA9IHtcbiAgQ1JFREVOVElBTDogJ0NSRURFTlRJQUwnLFxuICBHT09HTEU6ICdHT09HTEUnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEF1dGhQcm92aWRlciA9ICh0eXBlb2YgQXV0aFByb3ZpZGVyKVtrZXlvZiB0eXBlb2YgQXV0aFByb3ZpZGVyXVxuXG5cbmV4cG9ydCBjb25zdCBQYWNrYWdlU3RhdHVzID0ge1xuICBQRU5ESU5HOiAnUEVORElORycsXG4gIEFQUFJPVkVEOiAnQVBQUk9WRUQnLFxuICBSRUpFQ1RFRDogJ1JFSkVDVEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQYWNrYWdlU3RhdHVzID0gKHR5cGVvZiBQYWNrYWdlU3RhdHVzKVtrZXlvZiB0eXBlb2YgUGFja2FnZVN0YXR1c11cblxuXG5leHBvcnQgY29uc3QgQm9va2luZ1N0YXR1cyA9IHtcbiAgUEVORElORzogJ1BFTkRJTkcnLFxuICBQQUlEOiAnUEFJRCcsXG4gIENPTkZJUk1FRDogJ0NPTkZJUk1FRCcsXG4gIENBTkNFTExFRDogJ0NBTkNFTExFRCcsXG4gIENPTVBMRVRFRDogJ0NPTVBMRVRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQm9va2luZ1N0YXR1cyA9ICh0eXBlb2YgQm9va2luZ1N0YXR1cylba2V5b2YgdHlwZW9mIEJvb2tpbmdTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IFBheW1lbnRTdGF0dXMgPSB7XG4gIElOSVRJQVRFRDogJ0lOSVRJQVRFRCcsXG4gIFNVQ0NFU1M6ICdTVUNDRVNTJyxcbiAgRkFJTEVEOiAnRkFJTEVEJyxcbiAgQ0FOQ0VMTEVEOiAnQ0FOQ0VMTEVEJyxcbiAgUkVGVU5ERUQ6ICdSRUZVTkRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGF5bWVudFN0YXR1cyA9ICh0eXBlb2YgUGF5bWVudFN0YXR1cylba2V5b2YgdHlwZW9mIFBheW1lbnRTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IFBvc3RTdGF0dXMgPSB7XG4gIERSQUZUOiAnRFJBRlQnLFxuICBQVUJMSVNIRUQ6ICdQVUJMSVNIRUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBvc3RTdGF0dXMgPSAodHlwZW9mIFBvc3RTdGF0dXMpW2tleW9mIHR5cGVvZiBQb3N0U3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBOb3RpZmljYXRpb25UeXBlID0ge1xuICBCT09LSU5HX0NSRUFURUQ6ICdCT09LSU5HX0NSRUFURUQnLFxuICBCT09LSU5HX0NPTkZJUk1FRDogJ0JPT0tJTkdfQ09ORklSTUVEJyxcbiAgQk9PS0lOR19DQU5DRUxMRUQ6ICdCT09LSU5HX0NBTkNFTExFRCcsXG4gIFBBQ0tBR0VfQVBQUk9WRUQ6ICdQQUNLQUdFX0FQUFJPVkVEJyxcbiAgUEFDS0FHRV9SRUpFQ1RFRDogJ1BBQ0tBR0VfUkVKRUNURUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE5vdGlmaWNhdGlvblR5cGUgPSAodHlwZW9mIE5vdGlmaWNhdGlvblR5cGUpW2tleW9mIHR5cGVvZiBOb3RpZmljYXRpb25UeXBlXVxuIiwgIi8vIEFwcEVycm9yIGtlZXBzIHRoZSBleGFjdCBzYW1lIFwianVzdCB0aHJvdyBpdFwiIGVyZ29ub21pY3MgYnV0IGNhcnJpZXNcbi8vIGEgc3RhdHVzQ29kZSB0aGUgZ2xvYmFsIGhhbmRsZXIgY2FuIHJlYWQgKHNlZSBtaWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cykuXG5leHBvcnQgY2xhc3MgQXBwRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIHN0YXR1c0NvZGU6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihzdGF0dXNDb2RlOiBudW1iZXIsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9IFwiQXBwRXJyb3JcIjtcbiAgICB0aGlzLnN0YXR1c0NvZGUgPSBzdGF0dXNDb2RlO1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHRoaXMuY29uc3RydWN0b3IpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgUHJpc21hUGcgfSBmcm9tIFwiQHByaXNtYS9hZGFwdGVyLXBnXCI7XG5pbXBvcnQgeyBQcmlzbWFDbGllbnQgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG5jb25zdCBjb25uZWN0aW9uU3RyaW5nID0gY29uZmlnLmRhdGFiYXNlX3VybDtcblxuLy8gU2VydmVybGVzcy1mcmllbmRseSBwb29sOiBvbmUgY29ubmVjdGlvbiBwZXIgd2FybSBpbnN0YW5jZSBzbyBtYW55XG4vLyBjb25jdXJyZW50IGludm9jYXRpb25zIGNhbid0IGV4aGF1c3QgdGhlIGRhdGFiYXNlJ3MgY29ubmVjdGlvbiBsaW1pdC5cbi8vIExvY2FsL1ZNIHJ1bnMgYXJlIHVuYWZmZWN0ZWQgKGEgc2luZ2xlIHByb2Nlc3MgdXNlcyBvbmUgY29ubmVjdGlvbiBhbnl3YXkpLlxuY29uc3QgYWRhcHRlciA9IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmcsIG1heDogMSB9KTtcbmNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoeyBhZGFwdGVyIH0pO1xuXG5leHBvcnQgeyBwcmlzbWEgfTtcbiIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgYXV0aENvbnRyb2xsZXIgfSBmcm9tIFwiLi9hdXRoLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGF1dGhWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2F1dGgudmFsaWRhdGlvblwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIFJlZ2lzdGVyIFx1MjAxNCByb2xlIGlzIG9wdGlvbmFsIGFuZCByZXN0cmljdGVkIHRvIFVTRVIvQUdFTlQgaW4gdGhlIHNlcnZpY2VcbnJvdXRlci5wb3N0KFxuICBcIi9yZWdpc3RlclwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVnaXN0ZXJTY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlZ2lzdGVyVXNlcixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9sb2dpblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMubG9naW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmxvZ2luVXNlcixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9nb29nbGVcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmdvb2dsZUxvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5nb29nbGVMb2dpbixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9kZW1vLWxvZ2luXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5kZW1vTG9naW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmRlbW9Mb2dpbixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9yZWZyZXNoXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5yZWZyZXNoVG9rZW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlZnJlc2hUb2tlbixcbik7XG5cbnJvdXRlci5wb3N0KFwiL2xvZ291dFwiLCBhdXRoKCksIGF1dGhDb250cm9sbGVyLmxvZ291dFVzZXIpO1xuXG5yb3V0ZXIuZ2V0KFwiL21lXCIsIGF1dGgoKSwgYXV0aENvbnRyb2xsZXIuZ2V0TWUpO1xuXG4vLyBTdGVwIDIxIFx1MjAxNCBlbWFpbCB2ZXJpZmljYXRpb24gKyBwYXNzd29yZCByZXNldCAoYWxsIHB1YmxpYzsgcmF0ZS1saW1pdGVkIHZpYVxuLy8gYXV0aExpbWl0ZXIgaW4gYXBwLnRzIHRvIGJvdW5kIE9UUCBicnV0ZSBmb3JjZSArIGVtYWlsIGJvbWJpbmcpXG5yb3V0ZXIucG9zdChcbiAgXCIvdmVyaWZ5LWVtYWlsXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy52ZXJpZnlFbWFpbFNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIudmVyaWZ5RW1haWwsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVzZW5kLXZlcmlmaWNhdGlvblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVzZW5kVmVyaWZpY2F0aW9uU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZXNlbmRWZXJpZmljYXRpb24sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZm9yZ290LXBhc3N3b3JkXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5mb3Jnb3RQYXNzd29yZFNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIuZm9yZ290UGFzc3dvcmQsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVzZXQtcGFzc3dvcmRcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLnJlc2V0UGFzc3dvcmRTY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlc2V0UGFzc3dvcmQsXG4pO1xuXG5leHBvcnQgY29uc3QgYXV0aFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGF1dGhTZXJ2aWNlIH0gZnJvbSBcIi4vYXV0aC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuY29uc3QgaXNQcm9kdWN0aW9uID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiO1xuXG4vLyBEZXYgKGxvY2FsaG9zdDozMDAwIFx1MjE5MiA6NDAwMCkgaXMgc2FtZS1zaXRlIFx1MjE5MiBsYXggd29ya3Mgd2l0aCBzZWN1cmU6ZmFsc2UuXG4vLyBQcm9kIChjcm9zcy1zaXRlIGZyb250ZW5kL2JhY2tlbmQpIHJlcXVpcmVzIFNhbWVTaXRlPU5vbmUgKyBTZWN1cmUuXG5jb25zdCBjb29raWVPcHRpb25zOiB7XG4gIGh0dHBPbmx5OiB0cnVlO1xuICBzZWN1cmU6IGJvb2xlYW47XG4gIHNhbWVTaXRlOiBcImxheFwiIHwgXCJub25lXCI7XG59ID0ge1xuICBodHRwT25seTogdHJ1ZSxcbiAgc2VjdXJlOiBpc1Byb2R1Y3Rpb24sXG4gIHNhbWVTaXRlOiBpc1Byb2R1Y3Rpb24gPyBcIm5vbmVcIiA6IFwibGF4XCIsXG59O1xuXG5jb25zdCBBQ0NFU1NfQ09PS0lFX01BWF9BR0UgPSAyNCAqIDYwICogNjAgKiAxMDAwOyAvLyAxIGRheVxuY29uc3QgUkVGUkVTSF9DT09LSUVfTUFYX0FHRSA9IDMwICogMjQgKiA2MCAqIDYwICogMTAwMDsgLy8gMzAgZGF5c1xuXG5jb25zdCBzZXRBdXRoQ29va2llcyA9IChcbiAgcmVzOiBSZXNwb25zZSxcbiAgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH06IHsgYWNjZXNzVG9rZW46IHN0cmluZzsgcmVmcmVzaFRva2VuOiBzdHJpbmcgfSxcbikgPT4ge1xuICByZXMuY29va2llKFwiYWNjZXNzVG9rZW5cIiwgYWNjZXNzVG9rZW4sIHtcbiAgICAuLi5jb29raWVPcHRpb25zLFxuICAgIG1heEFnZTogQUNDRVNTX0NPT0tJRV9NQVhfQUdFLFxuICB9KTtcbiAgcmVzLmNvb2tpZShcInJlZnJlc2hUb2tlblwiLCByZWZyZXNoVG9rZW4sIHtcbiAgICAuLi5jb29raWVPcHRpb25zLFxuICAgIG1heEFnZTogUkVGUkVTSF9DT09LSUVfTUFYX0FHRSxcbiAgfSk7XG59O1xuXG5jb25zdCBjbGVhckF1dGhDb29raWVzID0gKHJlczogUmVzcG9uc2UpID0+IHtcbiAgcmVzLmNsZWFyQ29va2llKFwiYWNjZXNzVG9rZW5cIiwgY29va2llT3B0aW9ucyk7XG4gIHJlcy5jbGVhckNvb2tpZShcInJlZnJlc2hUb2tlblwiLCBjb29raWVPcHRpb25zKTtcbn07XG5cbi8vIFJlZ2lzdGVyIGNvbnRyb2xsZXIgXHUyMDE0IHN0YWdlcyB0aGUgYWNjb3VudCBpbiBSZWRpcyBhbmQgZW1haWxzIGFuIE9UUDsgdGhlXG4vLyB1c2VyIHJvdyBpcyBjcmVhdGVkIGJ5IHZlcmlmeS1lbWFpbC5cbmNvbnN0IHJlZ2lzdGVyVXNlciA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLnJlZ2lzdGVyVXNlcihyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJWZXJpZmljYXRpb24gT1RQIHNlbnQgdG8geW91ciBlbWFpbC5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBMb2dpbiBjb250cm9sbGVyXG5jb25zdCBsb2dpblVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmxvZ2luVXNlcihyZXEuYm9keSk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR29vZ2xlIGxvZ2luIChJRC10b2tlbiBmbG93KVxuY29uc3QgZ29vZ2xlTG9naW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmdvb2dsZUxvZ2luKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBEZW1vIGxvZ2luIGNvbnRyb2xsZXJcbmNvbnN0IGRlbW9Mb2dpbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9ID0gYXdhaXQgYXV0aFNlcnZpY2UuZGVtb0xvZ2luKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRlbW8gdXNlciBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFZlcmlmeSBlbWFpbCBjb250cm9sbGVyIFx1MjAxNCBjcmVhdGVzIHRoZSB1c2VyIGFuZCBhdXRvLWxvZ3MtaW4gKHRva2VucyBhc1xuLy8gY29va2llcyArIGJvZHkpLCBtaXJyb3JpbmcgdGhlIHJlZmVyZW5jZSBiYWNrZW5kLlxuY29uc3QgdmVyaWZ5RW1haWwgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLnZlcmlmeUVtYWlsKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkVtYWlsIHZlcmlmaWVkIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBSZXNlbmQgdmVyaWZpY2F0aW9uIGNvbnRyb2xsZXIgXHUyMDE0IGFsd2F5cyAyMDAgKG5vIGVudW1lcmF0aW9uKS5cbmNvbnN0IHJlc2VuZFZlcmlmaWNhdGlvbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLnJlc2VuZFZlcmlmaWNhdGlvbihyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVmVyaWZpY2F0aW9uIE9UUCBzZW50IHRvIHlvdXIgZW1haWwuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gRm9yZ290IHBhc3N3b3JkIGNvbnRyb2xsZXIgXHUyMDE0IGFsd2F5cyAyMDAgKG5vIGVudW1lcmF0aW9uKS5cbmNvbnN0IGZvcmdvdFBhc3N3b3JkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgYXdhaXQgYXV0aFNlcnZpY2UuZm9yZ290UGFzc3dvcmQocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOlxuICAgICAgICBcIklmIGFuIGFjY291bnQgd2l0aCB0aGF0IGVtYWlsIGV4aXN0cywgYSBwYXNzd29yZCByZXNldCBPVFAgaGFzIGJlZW4gc2VudC5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBSZXNldCBwYXNzd29yZCBjb250cm9sbGVyXG5jb25zdCByZXNldFBhc3N3b3JkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgYXdhaXQgYXV0aFNlcnZpY2UucmVzZXRQYXNzd29yZChyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFzc3dvcmQgcmVzZXQgc3VjY2Vzc2Z1bGx5LiBQbGVhc2UgbG9naW4gYWdhaW4uXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gUmVmcmVzaCB0b2tlbiBjb250cm9sbGVyXG5jb25zdCByZWZyZXNoVG9rZW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZWZyZXNoVG9rZW5Gcm9tQ29va2llID0gcmVxLmNvb2tpZXMucmVmcmVzaFRva2VuO1xuICAgIGNvbnN0IHJlZnJlc2hUb2tlbkZyb21Cb2R5ID0gcmVxLmJvZHk/LnJlZnJlc2hUb2tlbjtcblxuICAgIGlmICghcmVmcmVzaFRva2VuRnJvbUNvb2tpZSAmJiAhcmVmcmVzaFRva2VuRnJvbUJvZHkpIHtcbiAgICAgIHJldHVybiBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLlVOQVVUSE9SSVpFRCxcbiAgICAgICAgbWVzc2FnZTogXCJSZWZyZXNoIHRva2VuIGlzIHJlcXVpcmVkXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbiB9ID1cbiAgICAgIGF3YWl0IGF1dGhTZXJ2aWNlLnJlZnJlc2hUb2tlbih7XG4gICAgICAgIHJlZnJlc2hUb2tlbjogcmVmcmVzaFRva2VuRnJvbUNvb2tpZSB8fCByZWZyZXNoVG9rZW5Gcm9tQm9keSxcbiAgICAgIH0pO1xuXG4gICAgc2V0QXV0aENvb2tpZXMocmVzLCB7XG4gICAgICBhY2Nlc3NUb2tlbixcbiAgICAgIHJlZnJlc2hUb2tlbjogbmV3UmVmcmVzaFRva2VuLFxuICAgIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlRva2VuIHJlZnJlc2hlZCBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbjogbmV3UmVmcmVzaFRva2VuIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBMb2dvdXQgY29udHJvbGxlclxuY29uc3QgbG9nb3V0VXNlciA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBhd2FpdCBhdXRoU2VydmljZS5sb2dvdXQodXNlcklkKTtcbiAgICBjbGVhckF1dGhDb29raWVzKHJlcyk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBsb2dnZWQgb3V0IHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdldCBNZSBjb250cm9sbGVyXG5jb25zdCBnZXRNZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgYXV0aFNlcnZpY2UuZ2V0TWVGcm9tREIodXNlcklkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBhdXRoQ29udHJvbGxlciA9IHtcbiAgcmVnaXN0ZXJVc2VyLFxuICB2ZXJpZnlFbWFpbCxcbiAgcmVzZW5kVmVyaWZpY2F0aW9uLFxuICBmb3Jnb3RQYXNzd29yZCxcbiAgcmVzZXRQYXNzd29yZCxcbiAgbG9naW5Vc2VyLFxuICBnb29nbGVMb2dpbixcbiAgZGVtb0xvZ2luLFxuICByZWZyZXNoVG9rZW4sXG4gIGxvZ291dFVzZXIsXG4gIGdldE1lLFxufTsiLCAiaW1wb3J0IGJjcnlwdCBmcm9tIFwiYmNyeXB0anNcIjtcbmltcG9ydCBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuaW1wb3J0IHsgZGVjb2RlLCBKd3RQYXlsb2FkLCBTaWduT3B0aW9ucyB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IGdvb2dsZUNsaWVudCB9IGZyb20gXCIuLi8uLi9saWIvZ29vZ2xlQXV0aFwiO1xuaW1wb3J0IHsgZ2V0UmVkaXMgfSBmcm9tIFwiLi4vLi4vbGliL3JlZGlzXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgand0VXRpbHMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvand0XCI7XG5pbXBvcnQge1xuICBzZW5kRm9yZ290UGFzc3dvcmRPdHBFbWFpbCxcbiAgc2VuZFBhc3N3b3JkUmVzZXRTdWNjZXNzRW1haWwsXG4gIHNlbmRWZXJpZmljYXRpb25PdHBFbWFpbCxcbiAgc2VuZFdlbGNvbWVFbWFpbCxcbn0gZnJvbSBcIi4uLy4uL3V0aWxzL2F1dGhFbWFpbFwiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7XG4gIElBdXRoLFxuICBJRGVtb0xvZ2luUGF5bG9hZCxcbiAgSUZvcmdvdFBhc3N3b3JkUGF5bG9hZCxcbiAgSUdvb2dsZUxvZ2luUGF5bG9hZCxcbiAgSUxvZ2luVXNlcixcbiAgSVJlZnJlc2hUb2tlblBheWxvYWQsXG4gIElSZXNlbmRWZXJpZmljYXRpb25QYXlsb2FkLFxuICBJUmVzZXRQYXNzd29yZFBheWxvYWQsXG4gIElWZXJpZnlFbWFpbFBheWxvYWQsXG59IGZyb20gXCIuL2F1dGguaW50ZXJmYWNlXCI7XG5cbmNvbnN0IE9UUF9FWFBJUkFUSU9OX1NFQ09ORFMgPSA1ICogNjA7IC8vIDUgbWludXRlcyBcdTIwMTQgbWF0Y2hlcyB0aGUgcmVmZXJlbmNlIGJhY2tlbmRcblxuLy8gU0hBLTI1NiBvZiBhIHJlZnJlc2ggSldUIFx1MjAxNCB0aGUgcm90YXRpb24gbGVkZ2VyIHN0b3JlcyBvbmx5IHRoaXMgaGFzaCwgbmV2ZXJcbi8vIHRoZSB0b2tlbiBpdHNlbGYsIHNvIGEgREIgbGVhayBjYW4ndCBtaW50IHVzYWJsZSByZWZyZXNoIHRva2Vucy5cbmNvbnN0IHNoYTI1NiA9ICh2YWx1ZTogc3RyaW5nKSA9PlxuICBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUodmFsdWUpLmRpZ2VzdChcImhleFwiKTtcblxuLy8gUmVmcmVzaC10b2tlbiBleHBpcnkgcmVhZCBmcm9tIHRoZSBzaWduZWQgdG9rZW4ncyBgZXhwYCBzbyB0aGUgbGVkZ2VyIHJvd1xuLy8gYWx3YXlzIG1hdGNoZXMgSldUX1JFRlJFU0hfRVhQSVJFU19JTiBleGFjdGx5LlxuY29uc3QgcmVmcmVzaFRva2VuRXhwaXJlc0F0ID0gKHRva2VuOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcGF5bG9hZCA9IGRlY29kZSh0b2tlbikgYXMgSnd0UGF5bG9hZCB8IG51bGw7XG4gIHJldHVybiBwYXlsb2FkPy5leHAgPyBuZXcgRGF0ZShwYXlsb2FkLmV4cCAqIDEwMDApIDogbmV3IERhdGUoKTtcbn07XG5cbi8vIFJlZGlzIE9UUCBzdG9yZSBhY2Nlc3NvciBcdTIwMTQgNTAzIHdoZW4gdW5jb25maWd1cmVkIChuZXZlciBhIGJvb3QtdGltZSBjcmFzaCkuXG5jb25zdCBnZXRSZWRpc0NsaWVudCA9IGFzeW5jICgpID0+IHtcbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0UmVkaXMoKTtcbiAgaWYgKCFjbGllbnQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNTAzLCBcIkVtYWlsIHZlcmlmaWNhdGlvbiBpcyBub3QgY29uZmlndXJlZC5cIik7XG4gIH1cbiAgcmV0dXJuIGNsaWVudDtcbn07XG5cbmNvbnN0IGJ1aWxkVG9rZW5QYXlsb2FkID0gKHVzZXI6IHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICByb2xlOiBSb2xlO1xuICB0b2tlblZlcnNpb246IG51bWJlcjtcbn0pID0+ICh7XG4gIGlkOiB1c2VyLmlkLFxuICBuYW1lOiB1c2VyLm5hbWUsXG4gIGVtYWlsOiB1c2VyLmVtYWlsLFxuICByb2xlOiB1c2VyLnJvbGUsXG4gIHRva2VuVmVyc2lvbjogdXNlci50b2tlblZlcnNpb24sXG59KTtcblxuY29uc3QgaXNzdWVUb2tlbnMgPSBhc3luYyAoXG4gIHVzZXI6IHtcbiAgICBpZDogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBlbWFpbDogc3RyaW5nO1xuICAgIHJvbGU6IFJvbGU7XG4gICAgdG9rZW5WZXJzaW9uOiBudW1iZXI7XG4gIH0sXG4gIGNsaWVudDogUHJpc21hLlRyYW5zYWN0aW9uQ2xpZW50IHwgdHlwZW9mIHByaXNtYSA9IHByaXNtYSxcbikgPT4ge1xuICBjb25zdCB0b2tlblBheWxvYWQgPSBidWlsZFRva2VuUGF5bG9hZCh1c2VyKTtcblxuICBjb25zdCBhY2Nlc3NUb2tlbiA9IGp3dFV0aWxzLmNyZWF0ZVRva2VuKFxuICAgIHRva2VuUGF5bG9hZCxcbiAgICBjb25maWcuand0X2FjY2Vzc19zZWNyZXQsXG4gICAgeyBleHBpcmVzSW46IGNvbmZpZy5qd3RfYWNjZXNzX2V4cGlyZXNfaW4gfSBhcyBTaWduT3B0aW9ucyxcbiAgKTtcbiAgY29uc3QgcmVmcmVzaFRva2VuID0gand0VXRpbHMuY3JlYXRlVG9rZW4oXG4gICAgdG9rZW5QYXlsb2FkLFxuICAgIGNvbmZpZy5qd3RfcmVmcmVzaF9zZWNyZXQsXG4gICAgeyBleHBpcmVzSW46IGNvbmZpZy5qd3RfcmVmcmVzaF9leHBpcmVzX2luIH0gYXMgU2lnbk9wdGlvbnMsXG4gICk7XG5cbiAgLy8gUm90YXRpb24gbGVkZ2VyIFx1MjAxNCBwZXJzaXN0IGEgcm93IGtleWVkIGJ5IHRoZSByZWZyZXNoIHRva2VuJ3MgaGFzaC4gVGhlXG4gIC8vIEpXVCBpdHNlbGYgc3RheXMgaW4gdGhlIHJlc3BvbnNlIGV4YWN0bHkgYXMgYmVmb3JlLlxuICBhd2FpdCBjbGllbnQucmVmcmVzaFRva2VuLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgdXNlcklkOiB1c2VyLmlkLFxuICAgICAgaGFzaDogc2hhMjU2KHJlZnJlc2hUb2tlbiksXG4gICAgICBleHBpcmVzQXQ6IHJlZnJlc2hUb2tlbkV4cGlyZXNBdChyZWZyZXNoVG9rZW4pLFxuICAgIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfTtcbn07XG5cbmNvbnN0IHNhbml0aXplVXNlciA9IDxUIGV4dGVuZHMgeyBwYXNzd29yZDogc3RyaW5nIHwgbnVsbCB9Pih1c2VyOiBUKSA9PiB7XG4gIGNvbnN0IHsgcGFzc3dvcmQsIC4uLnJlc3QgfSA9IHVzZXI7XG4gIHJldHVybiByZXN0O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZ2lzdGVyIChzdGFnZWQgaW4gUmVkaXMsIHZlcmlmaWVkIHZpYSBPVFApIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gRm9sbG93cyB0aGUgcmVmZXJlbmNlIGJhY2tlbmQ6IGEgY3JlZGVudGlhbCBzaWdudXAgZG9lcyBOT1QgY3JlYXRlIGEgREIgcm93LlxuLy8gSXQgaGFzaGVzIHRoZSBwYXNzd29yZCwgc3RhZ2VzIHRoZSBwYXlsb2FkIGluIFJlZGlzLCBlbWFpbHMgYSA2LWRpZ2l0IE9UUCxcbi8vIGFuZCB0aGUgdXNlciByb3cgaXMgb25seSBjcmVhdGVkIG9uIHN1Y2Nlc3NmdWwgdmVyaWZpY2F0aW9uLlxuY29uc3QgcmVnaXN0ZXJVc2VyID0gYXN5bmMgKHBheWxvYWQ6IElBdXRoKSA9PiB7XG4gIGNvbnN0IHsgbmFtZSwgcGFzc3dvcmQsIHBob25lLCByb2xlIH0gPSBwYXlsb2FkO1xuICBjb25zdCBlbWFpbCA9IHBheWxvYWQuZW1haWwudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgLy8gT25seSB1c2Vycy9hZ2VudHMgY2FuIHNlbGYtcmVnaXN0ZXI7IGFkbWlucyBhcmUgY3JlYXRlZCB2aWEgZGVtby1sb2dpbi9zZWVkXG4gIGlmIChyb2xlICYmIHJvbGUgIT09IFwiVVNFUlwiICYmIHJvbGUgIT09IFwiQUdFTlRcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiUm9sZSBtdXN0IGJlIGVpdGhlciBVU0VSIG9yIEFHRU5UXCIpO1xuICB9XG5cbiAgY29uc3QgZXhpc3RpbmdVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgZW1haWwgfSxcbiAgfSk7XG4gIGlmIChleGlzdGluZ1VzZXIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIlVzZXIgd2l0aCB0aGlzIGVtYWlsIGFscmVhZHkgZXhpc3RzXCIpO1xuICB9XG5cbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0UmVkaXNDbGllbnQoKTtcblxuICAvLyBBIHJlZ2lzdHJhdGlvbiBpcyBhbHJlYWR5IHN0YWdlZCBmb3IgdGhpcyBlbWFpbCBcdTIwMTQgNDA5IGluc3RlYWQgb2Ygc2lsZW50bHlcbiAgLy8gb3ZlcndyaXRpbmcgdGhlIHBlbmRpbmcgT1RQL2RhdGEgKGFuIGF0dGFja2VyIG11c3Qgbm90IGJlIGFibGUgdG8ga2lsbCBhXG4gIC8vIHZpY3RpbSdzIGluLWZsaWdodCByZWdpc3RyYXRpb24pLiBUaGUgcGVuZGluZyBmbG93IGNvbnRpbnVlcyB2aWFcbiAgLy8gcmVzZW5kLXZlcmlmaWNhdGlvbi5cbiAgY29uc3QgcmVnaXN0cmF0aW9uRGF0YUtleSA9IGB0cmlwdmVyc2U6cmVnaXN0ZXItZGF0YToke2VtYWlsfWA7XG4gIGNvbnN0IHBlbmRpbmdSZWdpc3RyYXRpb24gPSBhd2FpdCBjbGllbnQuZ2V0KHJlZ2lzdHJhdGlvbkRhdGFLZXkpO1xuICBpZiAocGVuZGluZ1JlZ2lzdHJhdGlvbikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwOSxcbiAgICAgIFwiUmVnaXN0cmF0aW9uIGlzIHBlbmRpbmcgdmVyaWZpY2F0aW9uLiBDaGVjayB5b3VyIGVtYWlsIG9yIHJlc2VuZCB0aGUgT1RQLlwiLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBoYXNoZWRQYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgIHBhc3N3b3JkLFxuICAgIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSxcbiAgKTtcblxuICAvLyBSZWdpc3RyYXRpb24gT1RQICh0aGUgdmFsdWUgdGhlIHVzZXIgdHlwZXMgYmFjayBpbnRvIHRoZSBBUEkpXG4gIGNvbnN0IG90cEtleSA9IGB0cmlwdmVyc2U6cmVnaXN0ZXItb3RwOiR7ZW1haWx9YDtcbiAgY29uc3Qgb3RwVmFsdWUgPSBjcnlwdG8ucmFuZG9tSW50KDEwMDAwMCwgMTAwMDAwMCkudG9TdHJpbmcoKTtcblxuICBhd2FpdCBjbGllbnQuc2V0KG90cEtleSwgb3RwVmFsdWUsIHtcbiAgICBleHBpcmF0aW9uOiB7XG4gICAgICB0eXBlOiBcIkVYXCIsXG4gICAgICB2YWx1ZTogT1RQX0VYUElSQVRJT05fU0VDT05EUyxcbiAgICB9LFxuICB9KTtcblxuICAvLyBTdGFnZWQgcmVnaXN0cmF0aW9uIHBheWxvYWQgXHUyMDE0IHBhc3N3b3JkIGlzIGFscmVhZHkgaGFzaGVkIGhlcmUsIGV4YWN0bHlcbiAgLy8gbGlrZSB0aGUgcmVmZXJlbmNlLCBzbyBhIFJlZGlzIGxlYWsgbmV2ZXIgZXhwb3NlcyBhIHBsYWludGV4dCBwYXNzd29yZC5cbiAgY29uc3QgcmVkaXNVc2VyRGF0YVBheWxvYWQgPSB7XG4gICAgbmFtZSxcbiAgICBlbWFpbCxcbiAgICBwYXNzd29yZDogaGFzaGVkUGFzc3dvcmQsXG4gICAgcGhvbmUsXG4gICAgcm9sZTogcm9sZSB8fCBcIlVTRVJcIixcbiAgfTtcblxuICBhd2FpdCBjbGllbnQuc2V0KHJlZ2lzdHJhdGlvbkRhdGFLZXksIEpTT04uc3RyaW5naWZ5KHJlZGlzVXNlckRhdGFQYXlsb2FkKSwge1xuICAgIGV4cGlyYXRpb246IHtcbiAgICAgIHR5cGU6IFwiRVhcIixcbiAgICAgIHZhbHVlOiBPVFBfRVhQSVJBVElPTl9TRUNPTkRTLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIEJlc3QtZWZmb3J0IGVtYWlsIFx1MjAxNCBhIHNlbmQgZmFpbHVyZSBuZXZlciBmYWlscyByZWdpc3RyYXRpb24gKFRyaXBWZXJzZVxuICAvLyBjb252ZW50aW9uKTsgdGhlIHVzZXIgY2FuIHJlY292ZXIgdmlhIHJlc2VuZC12ZXJpZmljYXRpb24uXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kVmVyaWZpY2F0aW9uT3RwRW1haWwoeyBlbWFpbCwgbmFtZSwgb3RwOiBvdHBWYWx1ZSB9KSxcbiAgXSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgVmVyaWZ5IGVtYWlsIChjcmVhdGVzIHRoZSB1c2VyICsgYXV0by1sb2dpbikgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBGb2xsb3dzIHRoZSByZWZlcmVuY2UgYmFja2VuZDogT1RQIGlzIHJlYWQgZnJvbSBSZWRpcywgZGVsZXRlZCwgdGhlbiB0aGVcbi8vIHN0YWdlZCBwYXlsb2FkIGlzIG1hdGVyaWFsaXNlZCBhcyBhIHJlYWwgdXNlciByb3cgd2l0aCBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuLy8gYW5kIHRva2VucyBhcmUgaXNzdWVkIHNvIHRoZSB1c2VyIGlzIGxvZ2dlZCBpbiBpbW1lZGlhdGVseS5cbmNvbnN0IHZlcmlmeUVtYWlsID0gYXN5bmMgKHBheWxvYWQ6IElWZXJpZnlFbWFpbFBheWxvYWQpID0+IHtcbiAgY29uc3QgeyBvdHAgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IGVtYWlsID0gcGF5bG9hZC5lbWFpbC50cmltKCkudG9Mb3dlckNhc2UoKTtcblxuICAvLyBEZWZlbnNpdmUgXHUyMDE0IHJlZ2lzdHJhdGlvbiBhbHJlYWR5IDQwOXMgb24gYW4gZXhpc3RpbmcgZW1haWwsIHNvIGEgdXNlciByb3dcbiAgLy8gaGVyZSBtZWFucyB0aGUgZW1haWwgd2FzIHZlcmlmaWVkIGVhcmxpZXIgdGhyb3VnaCBhbm90aGVyIGZsb3cuXG4gIGNvbnN0IGlzVXNlckV4aXN0cyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBlbWFpbCB9IH0pO1xuICBpZiAoaXNVc2VyRXhpc3RzKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJFbWFpbCBpcyBhbHJlYWR5IHZlcmlmaWVkXCIpO1xuICB9XG5cbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0UmVkaXNDbGllbnQoKTtcblxuICBjb25zdCBvdHBLZXkgPSBgdHJpcHZlcnNlOnJlZ2lzdGVyLW90cDoke2VtYWlsfWA7XG4gIGNvbnN0IHJlZGlzT1RQID0gYXdhaXQgY2xpZW50LmdldChvdHBLZXkpO1xuXG4gIGlmICghcmVkaXNPVFAgfHwgcmVkaXNPVFAgIT09IG90cCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBvciBleHBpcmVkIE9UUC5cIik7XG4gIH1cblxuICAvLyBPVFAgaXMgc2luZ2xlLXVzZSBcdTIwMTQgZGVsZXRlIGl0IGJlZm9yZSB0aGUgdXNlciByb3cgaXMgY3JlYXRlZC5cbiAgYXdhaXQgY2xpZW50LmRlbChvdHBLZXkpO1xuXG4gIGNvbnN0IHJlZ2lzdHJhdGlvbkRhdGFLZXkgPSBgdHJpcHZlcnNlOnJlZ2lzdGVyLWRhdGE6JHtlbWFpbH1gO1xuICBjb25zdCByZWRpc1VzZXJEYXRhID0gYXdhaXQgY2xpZW50LmdldChyZWdpc3RyYXRpb25EYXRhS2V5KTtcblxuICBpZiAoIXJlZGlzVXNlckRhdGEpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgb3IgZXhwaXJlZCBPVFAuXCIpO1xuICB9XG5cbiAgY29uc3QgdXNlclBheWxvYWQgPSBKU09OLnBhcnNlKHJlZGlzVXNlckRhdGEpIGFzIElBdXRoO1xuXG4gIGNvbnN0IGNyZWF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICBuYW1lOiB1c2VyUGF5bG9hZC5uYW1lLFxuICAgICAgZW1haWw6IHVzZXJQYXlsb2FkLmVtYWlsLFxuICAgICAgcGFzc3dvcmQ6IHVzZXJQYXlsb2FkLnBhc3N3b3JkLFxuICAgICAgcGhvbmU6IHVzZXJQYXlsb2FkLnBob25lLFxuICAgICAgcm9sZTogdXNlclBheWxvYWQucm9sZSB8fCBcIlVTRVJcIixcbiAgICAgIGF1dGhQcm92aWRlcjogXCJDUkVERU5USUFMXCIsXG4gICAgICBzdGF0dXM6IFwiQUNUSVZFXCIsXG4gICAgICBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuICAgIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICAvLyBTdGFnZWQgcGF5bG9hZCBjb25zdW1lZCBcdTIwMTQgbm90aGluZyByZW1haW5zIGluIFJlZGlzLlxuICBhd2FpdCBjbGllbnQuZGVsKHJlZ2lzdHJhdGlvbkRhdGFLZXkpO1xuXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kV2VsY29tZUVtYWlsKHsgZW1haWw6IGNyZWF0ZWRVc2VyLmVtYWlsLCBuYW1lOiBjcmVhdGVkVXNlci5uYW1lIH0pLFxuICBdKTtcblxuICBjb25zdCB0b2tlbnMgPSBhd2FpdCBpc3N1ZVRva2VucyhjcmVhdGVkVXNlcik7XG5cbiAgcmV0dXJuIHsgLi4udG9rZW5zLCB1c2VyOiBjcmVhdGVkVXNlciB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlc2VuZCB2ZXJpZmljYXRpb24gT1RQIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gUmUtbWludHMgYSBmcmVzaCBPVFAgZm9yIGEgc3RpbGwtc3RhZ2VkIHJlZ2lzdHJhdGlvbi4gVW5pZm9ybSAyMDAgXHUyMDE0IGlmIHRoZVxuLy8gc3RhZ2luZyBkYXRhIGlzIGdvbmUgKG5ldmVyIHJlZ2lzdGVyZWQgLyBhbHJlYWR5IHZlcmlmaWVkKSB0aGlzIG5vLW9wcy5cbmNvbnN0IHJlc2VuZFZlcmlmaWNhdGlvbiA9IGFzeW5jIChwYXlsb2FkOiBJUmVzZW5kVmVyaWZpY2F0aW9uUGF5bG9hZCkgPT4ge1xuICBjb25zdCBlbWFpbCA9IHBheWxvYWQuZW1haWwudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0UmVkaXNDbGllbnQoKTtcblxuICBjb25zdCByZWdpc3RyYXRpb25EYXRhS2V5ID0gYHRyaXB2ZXJzZTpyZWdpc3Rlci1kYXRhOiR7ZW1haWx9YDtcbiAgY29uc3QgcmVkaXNVc2VyRGF0YSA9IGF3YWl0IGNsaWVudC5nZXQocmVnaXN0cmF0aW9uRGF0YUtleSk7XG5cbiAgaWYgKCFyZWRpc1VzZXJEYXRhKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgdXNlclBheWxvYWQgPSBKU09OLnBhcnNlKHJlZGlzVXNlckRhdGEpIGFzIElBdXRoO1xuXG4gIGNvbnN0IG90cEtleSA9IGB0cmlwdmVyc2U6cmVnaXN0ZXItb3RwOiR7ZW1haWx9YDtcbiAgY29uc3Qgb3RwVmFsdWUgPSBjcnlwdG8ucmFuZG9tSW50KDEwMDAwMCwgMTAwMDAwMCkudG9TdHJpbmcoKTtcblxuICBhd2FpdCBjbGllbnQuc2V0KG90cEtleSwgb3RwVmFsdWUsIHtcbiAgICBleHBpcmF0aW9uOiB7XG4gICAgICB0eXBlOiBcIkVYXCIsXG4gICAgICB2YWx1ZTogT1RQX0VYUElSQVRJT05fU0VDT05EUyxcbiAgICB9LFxuICB9KTtcblxuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZFZlcmlmaWNhdGlvbk90cEVtYWlsKHsgZW1haWwsIG5hbWU6IHVzZXJQYXlsb2FkLm5hbWUsIG90cDogb3RwVmFsdWUgfSksXG4gIF0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEZvcmdvdCBwYXNzd29yZCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIEVtYWlscyBhIHJlc2V0IE9UUCB0byB2ZXJpZmllZCBDUkVERU5USUFMIGFjY291bnRzLiBEZWxpYmVyYXRlbHkgcmV0dXJucyBhXG4vLyB1bmlmb3JtIDIwMCB3aGV0aGVyIG9yIG5vdCB0aGUgZW1haWwgZXhpc3RzIC8gaXMgZWxpZ2libGUgKG5vIGVudW1lcmF0aW9uIFx1MjAxNFxuLy8gdGhlIHJlZmVyZW5jZSB0aHJvd3MgXCJVc2VyIG5vdCBmb3VuZFwiLCBidXQgVHJpcFZlcnNlIG5ldmVyIGxlYWtzIGV4aXN0ZW5jZSkuXG5jb25zdCBmb3Jnb3RQYXNzd29yZCA9IGFzeW5jIChwYXlsb2FkOiBJRm9yZ290UGFzc3dvcmRQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IGVtYWlsID0gcGF5bG9hZC5lbWFpbC50cmltKCkudG9Mb3dlckNhc2UoKTtcblxuICBjb25zdCBpc1VzZXJFeGlzdHMgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgZW1haWwgfSB9KTtcblxuICBpZiAoXG4gICAgIWlzVXNlckV4aXN0cyB8fFxuICAgIGlzVXNlckV4aXN0cy5pc0RlbGV0ZWQgfHxcbiAgICBpc1VzZXJFeGlzdHMuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiIHx8XG4gICAgIWlzVXNlckV4aXN0cy5lbWFpbFZlcmlmaWVkIHx8XG4gICAgaXNVc2VyRXhpc3RzLmF1dGhQcm92aWRlciA9PT0gXCJHT09HTEVcIlxuICApIHtcbiAgICAvLyBHb29nbGUtb25seSBhY2NvdW50cyByZXNldCB2aWEgR29vZ2xlOyBldmVyeW9uZSBlbHNlIHNpbGVudGx5IG5vLW9wcy5cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBjbGllbnQgPSBhd2FpdCBnZXRSZWRpc0NsaWVudCgpO1xuXG4gIGNvbnN0IG90cCA9IGNyeXB0by5yYW5kb21JbnQoMTAwMDAwLCAxMDAwMDAwKS50b1N0cmluZygpO1xuICBjb25zdCBrZXkgPSBgdHJpcHZlcnNlOmZvcmdvdC1wYXNzd29yZC1vdHA6JHtpc1VzZXJFeGlzdHMuZW1haWx9YDtcblxuICBhd2FpdCBjbGllbnQuc2V0KGtleSwgb3RwLCB7XG4gICAgZXhwaXJhdGlvbjoge1xuICAgICAgdHlwZTogXCJFWFwiLFxuICAgICAgdmFsdWU6IE9UUF9FWFBJUkFUSU9OX1NFQ09ORFMsXG4gICAgfSxcbiAgfSk7XG5cbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRGb3Jnb3RQYXNzd29yZE90cEVtYWlsKHtcbiAgICAgIGVtYWlsOiBpc1VzZXJFeGlzdHMuZW1haWwsXG4gICAgICBuYW1lOiBpc1VzZXJFeGlzdHMubmFtZSxcbiAgICAgIG90cCxcbiAgICB9KSxcbiAgXSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVzZXQgcGFzc3dvcmQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBWYWxpZGF0ZXMgdGhlIE9UUCBhZ2FpbnN0IFJlZGlzLCB0aGVuIHJlcGxhY2VzIHRoZSBoYXNoIGFuZCBidW1wc1xuLy8gdG9rZW5WZXJzaW9uIHNvIGV2ZXJ5IGV4aXN0aW5nIHNlc3Npb24gZGllcyAoVHJpcFZlcnNlIGxvZ291dCBzZW1hbnRpY3MpLlxuY29uc3QgcmVzZXRQYXNzd29yZCA9IGFzeW5jIChwYXlsb2FkOiBJUmVzZXRQYXNzd29yZFBheWxvYWQpID0+IHtcbiAgY29uc3QgeyBuZXdQYXNzd29yZCwgb3RwIH0gPSBwYXlsb2FkO1xuICBjb25zdCBlbWFpbCA9IHBheWxvYWQuZW1haWwudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgY29uc3QgaXNVc2VyRXhpc3RzID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG5cbiAgaWYgKFxuICAgICFpc1VzZXJFeGlzdHMgfHxcbiAgICBpc1VzZXJFeGlzdHMuaXNEZWxldGVkIHx8XG4gICAgaXNVc2VyRXhpc3RzLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIiB8fFxuICAgIGlzVXNlckV4aXN0cy5hdXRoUHJvdmlkZXIgPT09IFwiR09PR0xFXCJcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIG9yIGV4cGlyZWQgT1RQLlwiKTtcbiAgfVxuXG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IGdldFJlZGlzQ2xpZW50KCk7XG5cbiAgY29uc3Qga2V5ID0gYHRyaXB2ZXJzZTpmb3Jnb3QtcGFzc3dvcmQtb3RwOiR7aXNVc2VyRXhpc3RzLmVtYWlsfWA7XG4gIGNvbnN0IHJlZGlzT1RQID0gYXdhaXQgY2xpZW50LmdldChrZXkpO1xuXG4gIGlmICghcmVkaXNPVFAgfHwgcmVkaXNPVFAgIT09IG90cCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBvciBleHBpcmVkIE9UUC5cIik7XG4gIH1cblxuICBjb25zdCBoYXNoZWROZXdQYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgIG5ld1Bhc3N3b3JkLFxuICAgIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSxcbiAgKTtcblxuICBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGVtYWlsOiBpc1VzZXJFeGlzdHMuZW1haWwgfSxcbiAgICBkYXRhOiB7XG4gICAgICBwYXNzd29yZDogaGFzaGVkTmV3UGFzc3dvcmQsXG4gICAgICB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gU2luZ2xlLXVzZSBPVFAgXHUyMDE0IGRlbGV0ZSBhZnRlciBhIHN1Y2Nlc3NmdWwgcmVzZXQuXG4gIGF3YWl0IGNsaWVudC5kZWwoa2V5KTtcblxuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZFBhc3N3b3JkUmVzZXRTdWNjZXNzRW1haWwoe1xuICAgICAgZW1haWw6IGlzVXNlckV4aXN0cy5lbWFpbCxcbiAgICAgIG5hbWU6IGlzVXNlckV4aXN0cy5uYW1lLFxuICAgIH0pLFxuICBdKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBMb2dpbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGxvZ2luVXNlciA9IGFzeW5jIChwYXlsb2FkOiBJTG9naW5Vc2VyKSA9PiB7XG4gIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBlbWFpbCB9LFxuICB9KTtcblxuICBpZiAoIXVzZXIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIkludmFsaWQgZW1haWwgb3IgcGFzc3dvcmRcIik7XG4gIH1cbiAgaWYgKHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGhhcyBiZWVuIGRlbGV0ZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGlzIHN1c3BlbmRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5hdXRoUHJvdmlkZXIgPT09IFwiR09PR0xFXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIlRoaXMgYWNjb3VudCB1c2VzIEdvb2dsZSBsb2dpbi4gUGxlYXNlIGxvZyBpbiB3aXRoIEdvb2dsZS5cIixcbiAgICApO1xuICB9XG5cbiAgY29uc3QgaXNQYXNzd29yZFZhbGlkID0gYXdhaXQgYmNyeXB0LmNvbXBhcmUocGFzc3dvcmQsIHVzZXIucGFzc3dvcmQgfHwgXCJcIik7XG4gIGlmICghaXNQYXNzd29yZFZhbGlkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJJbnZhbGlkIGVtYWlsIG9yIHBhc3N3b3JkXCIpO1xuICB9XG5cbiAgcmV0dXJuIGF3YWl0IGlzc3VlVG9rZW5zKHVzZXIpO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEdvb2dsZSBsb2dpbiAoSUQtdG9rZW4gZmxvdykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnb29nbGVMb2dpbiA9IGFzeW5jIChwYXlsb2FkOiBJR29vZ2xlTG9naW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgaWRUb2tlbiB9ID0gcGF5bG9hZDtcblxuICBpZiAoIWNvbmZpZy5nb29nbGVfY2xpZW50X2lkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJHb29nbGUgbG9naW4gaXMgbm90IGNvbmZpZ3VyZWQuIFBsZWFzZSBjb250YWN0IHN1cHBvcnQuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGxldCB0aWNrZXQ7XG4gIHRyeSB7XG4gICAgdGlja2V0ID0gYXdhaXQgZ29vZ2xlQ2xpZW50LnZlcmlmeUlkVG9rZW4oe1xuICAgICAgaWRUb2tlbixcbiAgICAgIGF1ZGllbmNlOiBjb25maWcuZ29vZ2xlX2NsaWVudF9pZCxcbiAgICB9KTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJJbnZhbGlkIEdvb2dsZSB0b2tlblwiKTtcbiAgfVxuXG4gIGNvbnN0IGdvb2dsZURhdGEgPSB0aWNrZXQuZ2V0UGF5bG9hZCgpO1xuICBpZiAoIWdvb2dsZURhdGEpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgR29vZ2xlIHRva2VuIHBheWxvYWRcIik7XG4gIH1cblxuICBjb25zdCB7IGVtYWlsLCBuYW1lLCBzdWIsIHBpY3R1cmUgfSA9IGdvb2dsZURhdGE7XG5cbiAgaWYgKCFlbWFpbCB8fCAhZ29vZ2xlRGF0YS5lbWFpbF92ZXJpZmllZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiR29vZ2xlIGFjY291bnQgZW1haWwgaXMgbm90IHZlcmlmaWVkXCIpO1xuICB9XG5cbiAgbGV0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgZ29vZ2xlSWQ6IHN1YiB9IH0pO1xuXG4gIC8vIEV4aXN0aW5nIHVzZXIgXHUyMTkyIGxpbmsgR29vZ2xlIGFjY291bnQgaWYgbm90IGFscmVhZHkgbGlua2VkXG4gIGlmICghdXNlciAmJiBlbWFpbCkge1xuICAgIHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgZW1haWwgfSB9KTtcbiAgICBpZiAodXNlcikge1xuICAgICAgaWYgKHVzZXIuZ29vZ2xlSWQgJiYgdXNlci5nb29nbGVJZCAhPT0gc3ViKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgICA0MDksXG4gICAgICAgICAgXCJFbWFpbCBpcyBhbHJlYWR5IGxpbmtlZCB0byBhbm90aGVyIEdvb2dsZSBhY2NvdW50XCIsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQ6IHVzZXIuaWQgfSxcbiAgICAgICAgZGF0YTogeyBnb29nbGVJZDogc3ViLCBlbWFpbFZlcmlmaWVkOiB0cnVlIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBCcmFuZCBuZXcgdXNlclxuICBpZiAoIXVzZXIpIHtcbiAgICBjb25zdCBsb2NhbFBhcnQgPSBlbWFpbC5zcGxpdChcIkBcIilbMF0gPz8gZW1haWw7XG4gICAgY29uc3QgZGlzcGxheU5hbWUgPSAobmFtZSA/PyBcIlwiKS50cmltKCkgfHwgbG9jYWxQYXJ0O1xuICAgIHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICBlbWFpbCxcbiAgICAgICAgbmFtZTogZGlzcGxheU5hbWUsXG4gICAgICAgIHBhc3N3b3JkOiBudWxsLFxuICAgICAgICBhdXRoUHJvdmlkZXI6IFwiR09PR0xFXCIsXG4gICAgICAgIGdvb2dsZUlkOiBzdWIsXG4gICAgICAgIGVtYWlsVmVyaWZpZWQ6IHRydWUsXG4gICAgICAgIHJvbGU6IFwiVVNFUlwiLFxuICAgICAgICBhdmF0YXJVcmw6IHBpY3R1cmUgfHwgbnVsbCxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCB0b2tlbnMgPSBhd2FpdCBpc3N1ZVRva2Vucyh1c2VyISk7XG4gIGNvbnN0IHNhbml0aXplZFVzZXIgPSBzYW5pdGl6ZVVzZXIodXNlciEpO1xuXG4gIHJldHVybiB7IC4uLnRva2VucywgdXNlcjogc2FuaXRpemVkVXNlciB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIERlbW8gbG9naW4gKGdyYWRpbmcpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgREVNT19QQVNTV09SRCA9IFwiZGVtbzEyM1wiO1xuXG5jb25zdCBkZW1vTG9naW4gPSBhc3luYyAocGF5bG9hZDogSURlbW9Mb2dpblBheWxvYWQpID0+IHtcbiAgY29uc3QgeyByb2xlIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGRlbW9Vc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBzZXJ0KHtcbiAgICB3aGVyZTogeyBlbWFpbDogYGRlbW8tJHtyb2xlLnRvTG93ZXJDYXNlKCl9QHRyaXB2ZXJzZS5jb21gIH0sXG4gICAgLy8gcmVzdXJyZWN0IGRlbW8gYWNjb3VudHMgdGhhdCBhbiBhZG1pbiBzdXNwZW5kZWQgb3Igc29mdC1kZWxldGVkXG4gICAgdXBkYXRlOiB7IHN0YXR1czogXCJBQ1RJVkVcIiwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIGNyZWF0ZToge1xuICAgICAgbmFtZTogYERlbW8gJHtyb2xlLmNoYXJBdCgwKSArIHJvbGUuc2xpY2UoMSkudG9Mb3dlckNhc2UoKX1gLFxuICAgICAgZW1haWw6IGBkZW1vLSR7cm9sZS50b0xvd2VyQ2FzZSgpfUB0cmlwdmVyc2UuY29tYCxcbiAgICAgIHBhc3N3b3JkOiBhd2FpdCBiY3J5cHQuaGFzaChERU1PX1BBU1NXT1JELCBOdW1iZXIoY29uZmlnLmJjcnlwdF9zYWx0X3JvdW5kcykpLFxuICAgICAgYXV0aFByb3ZpZGVyOiBcIkNSRURFTlRJQUxcIixcbiAgICAgIHJvbGUsXG4gICAgICBzdGF0dXM6IFwiQUNUSVZFXCIsXG4gICAgICBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuICAgIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4geyAuLi4oYXdhaXQgaXNzdWVUb2tlbnMoZGVtb1VzZXIpKSwgdXNlcjogZGVtb1VzZXIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZWZyZXNoIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcmVmcmVzaFRva2VuID0gYXN5bmMgKHBheWxvYWQ6IElSZWZyZXNoVG9rZW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgcmVmcmVzaFRva2VuOiBwcm92aWRlZFJlZnJlc2hUb2tlbiB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB2ZXJpZmllZCA9IGp3dFV0aWxzLnZlcmlmeVRva2VuKFxuICAgIHByb3ZpZGVkUmVmcmVzaFRva2VuLFxuICAgIGNvbmZpZy5qd3RfcmVmcmVzaF9zZWNyZXQsXG4gICk7XG5cbiAgaWYgKCF2ZXJpZmllZC5zdWNjZXNzKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgdmVyaWZpZWQuZXJyb3IpO1xuICB9XG5cbiAgY29uc3QgeyBpZCwgdG9rZW5WZXJzaW9uOiB0b2tlblRva2VuVmVyc2lvbiB9ID1cbiAgICB2ZXJpZmllZC5kYXRhIGFzIEp3dFBheWxvYWQgJiB7IHRva2VuVmVyc2lvbjogbnVtYmVyIH07XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBpcyBzdXNwZW5kZWRcIik7XG4gIH1cblxuICAvLyB0b2tlblZlcnNpb24gY2hhbmdlZCBcdTIxOTIgdG9rZW5zIHdlcmUgcmV2b2tlZCAobG9nb3V0IC8gcGFzc3dvcmQgY2hhbmdlKVxuICBpZiAodXNlci50b2tlblZlcnNpb24gIT09IHRva2VuVG9rZW5WZXJzaW9uKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJUb2tlbiBpcyBubyBsb25nZXIgdmFsaWQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIik7XG4gIH1cblxuICAvLyBPcHBvcnR1bmlzdGljIGhvdXNla2VlcGluZyBcdTIwMTQga2VlcCB0aGUgbGVkZ2VyIGZyb20gZ3Jvd2luZyB1bmJvdW5kZWRcbiAgLy8gd2l0aG91dCBhIGNyb246IGRyb3AgZXhwaXJlZCByb3dzIGFuZCByb3dzIHJldm9rZWQgbW9yZSB0aGFuIDcgZGF5cyBhZ28uXG4gIGNvbnN0IHdlZWtBZ28gPSBuZXcgRGF0ZShEYXRlLm5vdygpIC0gNyAqIDI0ICogNjAgKiA2MCAqIDEwMDApO1xuICBhd2FpdCBwcmlzbWEucmVmcmVzaFRva2VuLmRlbGV0ZU1hbnkoe1xuICAgIHdoZXJlOiB7XG4gICAgICBPUjogW3sgZXhwaXJlc0F0OiB7IGx0OiBuZXcgRGF0ZSgpIH0gfSwgeyByZXZva2VkQXQ6IHsgbHRlOiB3ZWVrQWdvIH0gfV0sXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gUm90YXRpb24gbGVkZ2VyIGxvb2t1cCBieSB0aGUgcHJlc2VudGVkIHRva2VuJ3MgaGFzaC5cbiAgY29uc3Qgcm93ID0gYXdhaXQgcHJpc21hLnJlZnJlc2hUb2tlbi5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBoYXNoOiBzaGEyNTYocHJvdmlkZWRSZWZyZXNoVG9rZW4pIH0sXG4gIH0pO1xuXG4gIC8vIE5ldmVyIGlzc3VlZCAob3IgYWxyZWFkeSBwcnVuZWQpIFx1MjE5MiByZWplY3QuXG4gIGlmICghcm93KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJJbnZhbGlkIHJlZnJlc2ggdG9rZW4uIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIik7XG4gIH1cblxuICAvLyBBIHJldm9rZWQgcm93IGlzIHRoZSB0aGVmdCBzaWduYXR1cmUgXHUyMDE0IHNvbWVvbmUgcmVwbGF5ZWQgYSByb3RhdGVkIHRva2VuLlxuICAvLyBLaWxsIHRoZSB3aG9sZSBmYW1pbHk6IGV2ZXJ5IG91dHN0YW5kaW5nIHRva2VuIGRpZXMgdmlhIHJldm9rZSArIGJ1bXAuXG4gIGlmIChyb3cucmV2b2tlZEF0KSB7XG4gICAgYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihbXG4gICAgICBwcmlzbWEucmVmcmVzaFRva2VuLnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyB1c2VySWQ6IHVzZXIuaWQsIHJldm9rZWRBdDogbnVsbCB9LFxuICAgICAgICBkYXRhOiB7IHJldm9rZWRBdDogbmV3IERhdGUoKSB9LFxuICAgICAgfSksXG4gICAgICBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogdXNlci5pZCB9LFxuICAgICAgICBkYXRhOiB7IHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICAgICAgfSksXG4gICAgXSk7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJSZWZyZXNoIHRva2VuIHJldXNlIGRldGVjdGVkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIpO1xuICB9XG5cbiAgLy8gTmF0dXJhbGx5IGV4cGlyZWQgXHUyMTkyIHJlamVjdCB3aXRob3V0IHRvdWNoaW5nIHRoZSBmYW1pbHkuXG4gIGlmIChyb3cuZXhwaXJlc0F0LmdldFRpbWUoKSA8PSBEYXRlLm5vdygpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJSZWZyZXNoIHRva2VuIGhhcyBleHBpcmVkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIpO1xuICB9XG5cbiAgLy8gVmFsaWQgXHUyMTkyIHJvdGF0ZTogcmV2b2tlIHRoZSBvbGQgcm93IGFuZCBtaW50K3BlcnNpc3QgdGhlIG5ldyBwYWlyXG4gIC8vIGF0b21pY2FsbHkgc28gdGhlIGNsaWVudCBjYW4gbmV2ZXIgZW5kIHVwIGhhbGYtcm90YXRlZC5cbiAgcmV0dXJuIHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgYXdhaXQgdHgucmVmcmVzaFRva2VuLnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcm93LmlkIH0sXG4gICAgICBkYXRhOiB7IHJldm9rZWRBdDogbmV3IERhdGUoKSB9LFxuICAgIH0pO1xuICAgIHJldHVybiBpc3N1ZVRva2Vucyh1c2VyLCB0eCk7XG4gIH0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIExvZ291dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGxvZ291dCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZykgPT4ge1xuICAvLyBSZXZva2UgdGhlIGxlZGdlciByb3dzIGZpcnN0LCB0aGVuIGJ1bXAgdG9rZW5WZXJzaW9uIChraWxscyBldmVyeXRoaW5nKS5cbiAgYXdhaXQgcHJpc21hLnJlZnJlc2hUb2tlbi51cGRhdGVNYW55KHtcbiAgICB3aGVyZTogeyB1c2VySWQsIHJldm9rZWRBdDogbnVsbCB9LFxuICAgIGRhdGE6IHsgcmV2b2tlZEF0OiBuZXcgRGF0ZSgpIH0sXG4gIH0pO1xuICBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBkYXRhOiB7IHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICB9KTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBHZXQgbWUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRNZUZyb21EQiA9IGFzeW5jICh1c2VySWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuXG4gIHJldHVybiB1c2VyO1xufTtcblxuZXhwb3J0IGNvbnN0IGF1dGhTZXJ2aWNlID0ge1xuICByZWdpc3RlclVzZXIsXG4gIHZlcmlmeUVtYWlsLFxuICByZXNlbmRWZXJpZmljYXRpb24sXG4gIGZvcmdvdFBhc3N3b3JkLFxuICByZXNldFBhc3N3b3JkLFxuICBsb2dpblVzZXIsXG4gIGdvb2dsZUxvZ2luLFxuICBkZW1vTG9naW4sXG4gIHJlZnJlc2hUb2tlbixcbiAgbG9nb3V0LFxuICBnZXRNZUZyb21EQixcbn07IiwgImltcG9ydCB7IE9BdXRoMkNsaWVudCB9IGZyb20gXCJnb29nbGUtYXV0aC1saWJyYXJ5XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuZXhwb3J0IGNvbnN0IGdvb2dsZUNsaWVudCA9IG5ldyBPQXV0aDJDbGllbnQoe1xuICBjbGllbnRJZDogY29uZmlnLmdvb2dsZV9jbGllbnRfaWQsXG59KTsiLCAiaW1wb3J0IHsgY3JlYXRlQ2xpZW50IH0gZnJvbSBcInJlZGlzXCI7XG5pbXBvcnQgdHlwZSB7IFJlZGlzQ2xpZW50VHlwZSB9IGZyb20gXCJyZWRpc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbi8vIFJlZGlzIE9UUCBzdG9yZSBmb3IgZW1haWwgdmVyaWZpY2F0aW9uICsgcGFzc3dvcmQgcmVzZXQgKFN0ZXAgMjEpIFx1MjAxNCBtaXJyb3JzXG4vLyB0aGUgcmVmZXJlbmNlIGJhY2tlbmQncyBub2RlLXJlZGlzIGNsaWVudC4gTnVsbCB3aGVuIHVuY29uZmlndXJlZCBzbyB0aGUgYXBwXG4vLyBzdGlsbCBib290cyAoZS5nLiBWZXJjZWwgcHJvZCk7IHRoZSBhdXRoIGVuZHBvaW50cyB0aGVuIGZhaWwgd2l0aCBhIGNsZWFuXG4vLyA1MDMgaW5zdGVhZCBvZiBjcmFzaGluZy5cbmV4cG9ydCBjb25zdCByZWRpc0NsaWVudCA9IGNvbmZpZy5yZWRpc19ob3N0XG4gID8gY3JlYXRlQ2xpZW50KHtcbiAgICAgIHVzZXJuYW1lOiBjb25maWcucmVkaXNfdXNlcixcbiAgICAgIHBhc3N3b3JkOiBjb25maWcucmVkaXNfcGFzc3dvcmQsXG4gICAgICBzb2NrZXQ6IHtcbiAgICAgICAgaG9zdDogY29uZmlnLnJlZGlzX2hvc3QsXG4gICAgICAgIHBvcnQ6IHBhcnNlSW50KGNvbmZpZy5yZWRpc19wb3J0IHx8IFwiNjM3OVwiKSxcbiAgICAgIH0sXG4gICAgfSlcbiAgOiBudWxsO1xuXG4vLyBMYXppbHktY29ubmVjdCBhY2Nlc3NvciBcdTIwMTQgY29ubmVjdCgpIGlzIGlkZW1wb3RlbnQsIHNvIHRoaXMgaXMgc2FmZSB0byBjYWxsXG4vLyBwZXIgcmVxdWVzdDsgdGhlIGNsaWVudCBpcyBhbHNvIGNvbm5lY3RlZCBvbmNlIGF0IGJvb3QgaW4gc2VydmVyLnRzLlxuZXhwb3J0IGNvbnN0IGdldFJlZGlzID0gYXN5bmMgKCk6IFByb21pc2U8UmVkaXNDbGllbnRUeXBlIHwgbnVsbD4gPT4ge1xuICBpZiAoIXJlZGlzQ2xpZW50KSByZXR1cm4gbnVsbDtcblxuICBpZiAoIXJlZGlzQ2xpZW50LmlzT3Blbikge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCByZWRpc0NsaWVudC5jb25uZWN0KCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIFwiW3JlZGlzXSBjb25uZWN0IGZhaWxlZDpcIixcbiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZWRpc0NsaWVudDtcbn07XG4iLCAiaW1wb3J0IGp3dCwgeyBKd3RQYXlsb2FkLCBTaWduT3B0aW9ucyB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcblxuY29uc3QgY3JlYXRlVG9rZW4gPSAoXG4gIHBheWxvYWQ6IEp3dFBheWxvYWQsXG4gIHNlY3JldDogc3RyaW5nLFxuICBleHBpcmVzSW46IFNpZ25PcHRpb25zLFxuKSA9PiB7XG4gIGNvbnN0IHRva2VuID0gand0LnNpZ24ocGF5bG9hZCwgc2VjcmV0LCBleHBpcmVzSW4pO1xuXG4gIHJldHVybiB0b2tlbjtcbn07XG5cbmNvbnN0IHZlcmlmeVRva2VuID0gKHRva2VuOiBzdHJpbmcsIHNlY3JldDogc3RyaW5nKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdmVyaWZpZWRUb2tlbiA9IGp3dC52ZXJpZnkodG9rZW4sIHNlY3JldCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBkYXRhOiB2ZXJpZmllZFRva2VuLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICBjb25zb2xlLmxvZyhcIlRva2VuIFZlcmlmaWNhdGlvbiBGYWlsZWQ6XCIsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogZXJyb3IubWVzc2FnZSxcbiAgICB9O1xuICB9XG59O1xuXG5leHBvcnQgY29uc3Qgand0VXRpbHMgPSB7XG4gIGNyZWF0ZVRva2VuLFxuICB2ZXJpZnlUb2tlbixcbn07XG4iLCAiaW1wb3J0IG5vZGVtYWlsZXIgZnJvbSBcIm5vZGVtYWlsZXJcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG4vLyBOb2RlbWFpbGVyIHRyYW5zcG9ydGVyIGZvciB0aGUgYXV0aCBlbWFpbHMgKFN0ZXAgMjEpIFx1MjAxNCBpZGVudGljYWwgdG8gdGhlXG4vLyByZWZlcmVuY2UgYmFja2VuZCAoR21haWwgYXBwLXBhc3N3b3JkIFNNVFApLiBOdWxsIHdoZW4gdW5jb25maWd1cmVkIHNvIHRoZVxuLy8gYXBwIHN0aWxsIGJvb3RzOyB0aGUgYXV0aCBlbWFpbCBoZWxwZXJzIHRoZW4gYmVjb21lIGJlc3QtZWZmb3J0IG5vLW9wcy5cbmV4cG9ydCBjb25zdCB0cmFuc3BvcnRlciA9XG4gIGNvbmZpZy5zbXRwX3VzZXIgJiYgY29uZmlnLnNtdHBfcGFzc3dvcmRcbiAgICA/IG5vZGVtYWlsZXIuY3JlYXRlVHJhbnNwb3J0KHtcbiAgICAgICAgc2VydmljZTogXCJnbWFpbFwiLFxuICAgICAgICBhdXRoOiB7XG4gICAgICAgICAgdXNlcjogY29uZmlnLnNtdHBfdXNlcixcbiAgICAgICAgICBwYXNzOiBjb25maWcuc210cF9wYXNzd29yZCxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgOiBudWxsO1xuIiwgImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgZWpzIGZyb20gXCJlanNcIjtcblxuLy8gUmVuZGVycyBhbiBFSlMgZW1haWwgdGVtcGxhdGUgYnkgbmFtZS4gVGhlIHRlbXBsYXRlIGRpcmVjdG9yeSBpcyByZXNvbHZlZCBhdFxuLy8gcnVudGltZSB3aXRoIGZhbGxiYWNrcyBzbyBpdCB3b3JrcyBpbiBldmVyeSBob3N0OlxuLy8gICAtIGRldiAoYHRzeCB3YXRjaGApIGFuZCBsb2NhbCBgZGlzdGAgcnVuIHdpdGggY3dkID0gcHJvamVjdCByb290IFx1MjE5MiBzcmMvdGVtcGxhdGVzXG4vLyAgIC0gdGhlIFZlcmNlbCBidW5kbGUgKGFwaS9pbmRleC5qcykgaGFzIHRoZSB0ZW1wbGF0ZXMgY29waWVkIHRvIGFwaS90ZW1wbGF0ZXMgXHUyMTkyIDxjd2Q+L3RlbXBsYXRlc1xuZXhwb3J0IGNvbnN0IHJlbmRlclRlbXBsYXRlID0gKG5hbWU6IHN0cmluZywgZGF0YTogb2JqZWN0KTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgXCJzcmMvdGVtcGxhdGVzXCIpLFxuICAgIHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBcInRlbXBsYXRlc1wiKSxcbiAgICBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgXCJhcGkvdGVtcGxhdGVzXCIpLFxuICBdO1xuXG4gIGNvbnN0IGRpciA9IGNhbmRpZGF0ZXMuZmluZCgoZCkgPT4gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oZCwgYCR7bmFtZX0uZWpzYCkpKTtcbiAgaWYgKCFkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEVtYWlsIHRlbXBsYXRlIFwiJHtuYW1lfS5lanNcIiBub3QgZm91bmRgKTtcbiAgfVxuXG4gIHJldHVybiBlanMucmVuZGVyRmlsZShwYXRoLmpvaW4oZGlyLCBgJHtuYW1lfS5lanNgKSwgZGF0YSk7XG59OyIsICJpbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcbmltcG9ydCB7IHRyYW5zcG9ydGVyIH0gZnJvbSBcIi4uL2xpYi9ub2RlbWFpbGVyXCI7XG5pbXBvcnQgeyByZW5kZXJUZW1wbGF0ZSB9IGZyb20gXCIuLi90ZW1wbGF0ZXNcIjtcblxuLy8gQmVzdC1lZmZvcnQgTm9kZW1haWxlciBzZW5kZXJzIGZvciB0aGUgYXV0aCBmbG93cyAoU3RlcCAyMSkgXHUyMDE0IG1pcnJvcnMgdGhlXG4vLyByZWZlcmVuY2UgYmFja2VuZCdzIHRyYW5zcG9ydGVyLnNlbmRNYWlsIGNhbGxzIHdpdGggRUpTIHRlbXBsYXRlcyByZW5kZXJlZFxuLy8gZnJvbSBgc3JjL3RlbXBsYXRlcy8qLmVqc2AuIEV2ZXJ5IGZhaWx1cmUgKG1pc3NpbmcgdGVtcGxhdGUsIFNNVFAgZXJyb3IpIGlzXG4vLyBjYXVnaHQgYW5kIGxvZ2dlZCBhcyBhIHdhcm4sIG5ldmVyIHRocm93biwgc28gaXQgY2FuJ3QgZmFpbCB0aGUgYnVzaW5lc3Ncbi8vIHdyaXRlIHRoYXQgdHJpZ2dlcmVkIGl0LiBDYWxsIHNpdGVzIGZpcmUgdGhlc2UgYXNcbi8vIGB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbc2VuZFgoLi4uKV0pYC5cblxuY29uc3QgT1RQX0VYUElSQVRJT05fTUlOVVRFUyA9IDU7XG5cbmludGVyZmFjZSBJQXV0aEVtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2VuZEF1dGhNYWlsKFxuICB0bzogc3RyaW5nLFxuICBzdWJqZWN0OiBzdHJpbmcsXG4gIGJ1aWxkOiAoKSA9PiBQcm9taXNlPHN0cmluZz4sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCF0cmFuc3BvcnRlcikge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gU01UUCBub3QgY29uZmlndXJlZDsgc2tpcHBpbmcgYXV0aCBlbWFpbC5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBodG1sID0gYXdhaXQgYnVpbGQoKTtcbiAgICBhd2FpdCB0cmFuc3BvcnRlci5zZW5kTWFpbCh7XG4gICAgICBmcm9tOiBjb25maWcuc210cF91c2VyIGFzIHN0cmluZyxcbiAgICAgIHRvLFxuICAgICAgc3ViamVjdCxcbiAgICAgIGh0bWwsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc3QgZGV0YWlsID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgIGNvbnNvbGUud2FybihgW2VtYWlsXSBmYWlsZWQgdG8gc2VuZCBcIiR7c3ViamVjdH1cIiB0byAke3RvfTogJHtkZXRhaWx9YCk7XG4gIH1cbn1cblxuLy8gU2VudCByaWdodCBhZnRlciBhIGNyZWRlbnRpYWwgcmVnaXN0cmF0aW9uIHN0YWdlcyBhbiBPVFAgaW4gUmVkaXMuXG5leHBvcnQgY29uc3Qgc2VuZFZlcmlmaWNhdGlvbk90cEVtYWlsID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQXV0aEVtYWlsRGV0YWlscyAmIHsgb3RwOiBzdHJpbmcgfSxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBhd2FpdCBzZW5kQXV0aE1haWwoZGV0YWlscy5lbWFpbCwgXCJFbWFpbCBWZXJpZmljYXRpb24gT1RQXCIsICgpID0+XG4gICAgcmVuZGVyVGVtcGxhdGUoXCJyZWdpc3RyYXRpb24tdXNlci1vdHBcIiwge1xuICAgICAgbmFtZTogZGV0YWlscy5uYW1lLFxuICAgICAgZW1haWw6IGRldGFpbHMuZW1haWwsXG4gICAgICBvdHA6IGRldGFpbHMub3RwLFxuICAgICAgZXhwaXJhdGlvbk1pbnV0ZXM6IE9UUF9FWFBJUkFUSU9OX01JTlVURVMsXG4gICAgfSksXG4gICk7XG59O1xuXG4vLyBTZW50IGJ5IHRoZSBmb3Jnb3QtcGFzc3dvcmQgZmxvdyB3aXRoIHRoZSByZXNldCBPVFAuXG5leHBvcnQgY29uc3Qgc2VuZEZvcmdvdFBhc3N3b3JkT3RwRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElBdXRoRW1haWxEZXRhaWxzICYgeyBvdHA6IHN0cmluZyB9LFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGF3YWl0IHNlbmRBdXRoTWFpbChkZXRhaWxzLmVtYWlsLCBcIkZvcmdvdCBQYXNzd29yZCBSZXNldCBPVFBcIiwgKCkgPT5cbiAgICByZW5kZXJUZW1wbGF0ZShcImZvcmdvdC1wYXNzd29yZFwiLCB7XG4gICAgICBuYW1lOiBkZXRhaWxzLm5hbWUsXG4gICAgICBvdHA6IGRldGFpbHMub3RwLFxuICAgICAgZXhwaXJhdGlvbk1pbnV0ZXM6IE9UUF9FWFBJUkFUSU9OX01JTlVURVMsXG4gICAgfSksXG4gICk7XG59O1xuXG4vLyBTZW50IGFmdGVyIGEgc3VjY2Vzc2Z1bCBlbWFpbCB2ZXJpZmljYXRpb24uIFRoZSBDVEEgbGlua3MgdG8gdGhlIGZyb250ZW5kXG4vLyAocHJvZCBVUkwgaW4gcHJvZHVjdGlvbiwgZGV2IFVSTCBvdGhlcndpc2UpOyBoaWRkZW4gd2hlbiBubyBVUkwgaXMgc2V0LlxuZXhwb3J0IGNvbnN0IHNlbmRXZWxjb21lRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElBdXRoRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGF3YWl0IHNlbmRBdXRoTWFpbChkZXRhaWxzLmVtYWlsLCBcIldlbGNvbWUgdG8gVHJpcFZlcnNlXCIsICgpID0+XG4gICAgcmVuZGVyVGVtcGxhdGUoXCJ3ZWxjb21lLWVtYWlsXCIsIHtcbiAgICAgIG5hbWU6IGRldGFpbHMubmFtZSxcbiAgICAgIGZyb250ZW5kVXJsOlxuICAgICAgICBjb25maWcubm9kZV9lbnYgPT09IFwicHJvZHVjdGlvblwiXG4gICAgICAgICAgPyBjb25maWcuZnJvbnRlbmRfdXJsX3Byb2RcbiAgICAgICAgICA6IGNvbmZpZy5mcm9udGVuZF91cmxfZGV2LFxuICAgIH0pLFxuICApO1xufTtcblxuLy8gU2VudCBhZnRlciBhIHN1Y2Nlc3NmdWwgcGFzc3dvcmQgcmVzZXQuXG5leHBvcnQgY29uc3Qgc2VuZFBhc3N3b3JkUmVzZXRTdWNjZXNzRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElBdXRoRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGF3YWl0IHNlbmRBdXRoTWFpbChkZXRhaWxzLmVtYWlsLCBcIlBhc3N3b3JkIFJlc2V0XCIsICgpID0+XG4gICAgcmVuZGVyVGVtcGxhdGUoXCJyZXNldC1wYXNzd29yZC1zdWNjZXNzXCIsIHtcbiAgICAgIG5hbWU6IGRldGFpbHMubmFtZSxcbiAgICB9KSxcbiAgKTtcbn07IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVxdWVzdEhhbmRsZXIsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGNvbnN0IGNhdGNoQXN5bmMgPSAoZm46IFJlcXVlc3RIYW5kbGVyKSA9PiB7XG4gIHJldHVybiBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZm4ocmVxLCByZXMsIG5leHQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICB9XG4gIH07XG59O1xuIiwgImltcG9ydCB7IFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxudHlwZSBUTWV0YSA9IHtcbiAgcGFnZTogbnVtYmVyO1xuICBsaW1pdDogbnVtYmVyO1xuICB0b3RhbDogbnVtYmVyO1xuICB0b3RhbFBhZ2VzOiBudW1iZXI7XG59O1xuXG50eXBlIFRSZXNwb25zZURhdGE8VD4gPSB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHN0YXR1c0NvZGU6IG51bWJlcjtcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBkYXRhOiBUO1xuICBtZXRhPzogVE1ldGE7XG59O1xuXG5leHBvcnQgY29uc3Qgc2VuZFJlc3BvbnNlID0gPFQ+KHJlczogUmVzcG9uc2UsIGRhdGE6IFRSZXNwb25zZURhdGE8VD4pID0+IHtcbiAgcmVzLnN0YXR1cyhkYXRhLnN0YXR1c0NvZGUpLmpzb24oe1xuICAgIHN1Y2Nlc3M6IGRhdGEuc3VjY2VzcyxcbiAgICBtZXNzYWdlOiBkYXRhLm1lc3NhZ2UsXG4gICAgZGF0YTogZGF0YS5kYXRhLFxuICAgIG1ldGE6IGRhdGEubWV0YSxcbiAgfSk7XG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcblxuY29uc3QgcmVnaXN0ZXJTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIG5hbWU6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTmFtZSBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMiwgXCJOYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgxMDAsIFwiTmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIiksXG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbFwiKSxcbiAgcGFzc3dvcmQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFzc3dvcmQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oNiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IGxlYXN0IDYgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoNzIsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBtb3N0IDcyIGNoYXJhY3RlcnNcIiksXG4gIHBob25lOiB6XG4gICAgLnN0cmluZygpXG4gICAgLm1heCgyMCwgXCJQaG9uZSBudW1iZXIgaXMgdG9vIGxvbmdcIilcbiAgICAub3B0aW9uYWwoKSxcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgbG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbFwiKSxcbiAgcGFzc3dvcmQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFzc3dvcmQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgZ29vZ2xlTG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkVG9rZW46IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiR29vZ2xlIGlkVG9rZW4gaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgZGVtb0xvZ2luU2NoZW1hID0gei5vYmplY3Qoe1xuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSwge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgcm9sZVwiLFxuICB9KSxcbn0pO1xuXG4vLyByZWZyZXNoVG9rZW4gbWF5IGNvbWUgZnJvbSB0aGUgaHR0cE9ubHkgY29va2llIE9SIHRoZSByZXF1ZXN0IGJvZHkgXHUyMDE0XG4vLyB2YWxpZGF0aW9uIGlzIGxlbmllbnQgaGVyZTsgdGhlIGNvbnRyb2xsZXIgaGFuZGxlcyBib3RoIHNvdXJjZXMuXG5jb25zdCByZWZyZXNoVG9rZW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJlZnJlc2hUb2tlbjogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBlbWFpbFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpO1xuXG5jb25zdCBvdHBTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJPVFAgaXMgcmVxdWlyZWRcIiB9KVxuICAubGVuZ3RoKDYsIFwiT1RQIG11c3QgYmUgZXhhY3RseSA2IGRpZ2l0c1wiKVxuICAucmVnZXgoL15cXGR7Nn0kLywgXCJPVFAgbXVzdCBiZSBleGFjdGx5IDYgZGlnaXRzXCIpO1xuXG5jb25zdCB2ZXJpZnlFbWFpbFNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IGVtYWlsU2NoZW1hLFxuICBvdHA6IG90cFNjaGVtYSxcbn0pO1xuXG5jb25zdCByZXNlbmRWZXJpZmljYXRpb25TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGVtYWlsOiBlbWFpbFNjaGVtYSxcbn0pO1xuXG5jb25zdCBmb3Jnb3RQYXNzd29yZFNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IGVtYWlsU2NoZW1hLFxufSk7XG5cbmNvbnN0IHJlc2V0UGFzc3dvcmRTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGVtYWlsOiBlbWFpbFNjaGVtYSxcbiAgb3RwOiBvdHBTY2hlbWEsXG4gIG5ld1Bhc3N3b3JkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk5ldyBwYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbig2LCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCg3MiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IG1vc3QgNzIgY2hhcmFjdGVyc1wiKSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUUmVnaXN0ZXJTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZWdpc3RlclNjaGVtYT47XG5leHBvcnQgdHlwZSBUTG9naW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBsb2dpblNjaGVtYT47XG5leHBvcnQgdHlwZSBUR29vZ2xlTG9naW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBnb29nbGVMb2dpblNjaGVtYT47XG5leHBvcnQgdHlwZSBUUmVmcmVzaFRva2VuU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgcmVmcmVzaFRva2VuU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRWZXJpZnlFbWFpbFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHZlcmlmeUVtYWlsU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRSZXNldFBhc3N3b3JkU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgcmVzZXRQYXNzd29yZFNjaGVtYT47XG5cbmV4cG9ydCBjb25zdCBhdXRoVmFsaWRhdGlvbnMgPSB7XG4gIHJlZ2lzdGVyU2NoZW1hLFxuICBsb2dpblNjaGVtYSxcbiAgZ29vZ2xlTG9naW5TY2hlbWEsXG4gIGRlbW9Mb2dpblNjaGVtYSxcbiAgcmVmcmVzaFRva2VuU2NoZW1hLFxuICB2ZXJpZnlFbWFpbFNjaGVtYSxcbiAgcmVzZW5kVmVyaWZpY2F0aW9uU2NoZW1hLFxuICBmb3Jnb3RQYXNzd29yZFNjaGVtYSxcbiAgcmVzZXRQYXNzd29yZFNjaGVtYSxcbn07IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgWm9kVHlwZSB9IGZyb20gXCJ6b2RcIjtcblxudHlwZSBWYWxpZGF0aW9uU2NoZW1hID0ge1xuICBib2R5PzogWm9kVHlwZTtcbiAgcXVlcnk/OiBab2RUeXBlO1xuICBwYXJhbXM/OiBab2RUeXBlO1xufTtcblxuLy8gUnVucyBab2Qgc2NoZW1hcyBhZ2FpbnN0IHJlcS5ib2R5L3F1ZXJ5L3BhcmFtcyBhbmQgcmVwbGFjZXMgdGhlIHBhcnNlZFxuLy8gdmFsdWVzIHNvIGRvd25zdHJlYW0gaGFuZGxlcnMgd29yayB3aXRoIHZhbGlkYXRlZCAoYW5kIHR5cGVkKSBkYXRhLlxuLy8gQW55IFpvZEVycm9yIHRocm93biBoZXJlIGlzIG1hcHBlZCB0byBhIDQwMCBieSBnbG9iYWxFcnJvckhhbmRsZXIuXG4vL1xuLy8gcmVxLmJvZHkgaXMgc2FmZWx5IHdyaXRhYmxlLCBidXQgaW4gRXhwcmVzcyA1IHJlcS5xdWVyeS9yZXEucGFyYW1zIGFyZVxuLy8gZ2V0dGVyLW9ubHkgXHUyMDE0IHRoZXkgbXVzdCBiZSByZWRlZmluZWQgdmlhIGRlZmluZVByb3BlcnR5IHRvIHN3YXAgaW4gdGhlXG4vLyBwYXJzZWQgdmFsdWVzLlxuY29uc3QgdmFsaWRhdGVSZXF1ZXN0ID0gKHNjaGVtYTogVmFsaWRhdGlvblNjaGVtYSkgPT4ge1xuICByZXR1cm4gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgaWYgKHNjaGVtYS5ib2R5KSB7XG4gICAgICByZXEuYm9keSA9IHNjaGVtYS5ib2R5LnBhcnNlKHJlcS5ib2R5KTtcbiAgICB9XG4gICAgaWYgKHNjaGVtYS5xdWVyeSkge1xuICAgICAgY29uc3QgcGFyc2VkUXVlcnkgPSBzY2hlbWEucXVlcnkucGFyc2UocmVxLnF1ZXJ5KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXEsIFwicXVlcnlcIiwge1xuICAgICAgICB2YWx1ZTogcGFyc2VkUXVlcnksXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKHNjaGVtYS5wYXJhbXMpIHtcbiAgICAgIGNvbnN0IHBhcnNlZFBhcmFtcyA9IHNjaGVtYS5wYXJhbXMucGFyc2UocmVxLnBhcmFtcyk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVxLCBcInBhcmFtc1wiLCB7XG4gICAgICAgIHZhbHVlOiBwYXJzZWRQYXJhbXMsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBuZXh0KCk7XG4gIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCB2YWxpZGF0ZVJlcXVlc3Q7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgSnd0UGF5bG9hZCB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgand0VXRpbHMgfSBmcm9tIFwiLi4vdXRpbHMvand0XCI7XG5cbi8vIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTikgXHUyMTkyIG9ubHkgdGhvc2Ugcm9sZXMgcGFzc1xuLy8gYXV0aCgpIFx1MjE5MiBhbnkgYXV0aGVudGljYXRlZCB1c2VyIHBhc3Nlc1xuY29uc3QgYXV0aCA9ICguLi5yZXF1aXJlZFJvbGVzOiBSb2xlW10pID0+IHtcbiAgcmV0dXJuIGNhdGNoQXN5bmMoYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdG9rZW4gPSByZXEuY29va2llcy5hY2Nlc3NUb2tlblxuICAgICAgPyByZXEuY29va2llcy5hY2Nlc3NUb2tlblxuICAgICAgOiByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uPy5zdGFydHNXaXRoKFwiQmVhcmVyIFwiKVxuICAgICAgICA/IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb24uc3BsaXQoXCIgXCIpWzFdXG4gICAgICAgIDogcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbjtcblxuICAgIC8vIDEuIHRva2VuIG11c3QgYmUgcHJlc2VudFxuICAgIGlmICghdG9rZW4pIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAxLFxuICAgICAgICBcIllvdSBhcmUgbm90IGxvZ2dlZCBpbi4gUGxlYXNlIGxvZ2luIHRvIGNvbnRpbnVlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyAyLiB2ZXJpZnkgdGhlIGFjY2VzcyB0b2tlblxuICAgIGNvbnN0IHZlcmlmaWVkVG9rZW4gPSBqd3RVdGlscy52ZXJpZnlUb2tlbihcbiAgICAgIHRva2VuLFxuICAgICAgY29uZmlnLmp3dF9hY2Nlc3Nfc2VjcmV0LFxuICAgICk7XG5cbiAgICBpZiAoIXZlcmlmaWVkVG9rZW4uc3VjY2Vzcykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgdmVyaWZpZWRUb2tlbi5lcnJvcik7XG4gICAgfVxuXG4gICAgY29uc3QgeyBpZCwgdG9rZW5WZXJzaW9uIH0gPSB2ZXJpZmllZFRva2VuLmRhdGEgYXMgSnd0UGF5bG9hZCAmIHtcbiAgICAgIHRva2VuVmVyc2lvbjogbnVtYmVyO1xuICAgIH07XG5cbiAgICAvLyAzLiByZS1mZXRjaCB1c2VyIHRvIGVuZm9yY2UgYWNjb3VudCBzdGF0ZSBvbiBldmVyeSByZXF1ZXN0XG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgd2hlcmU6IHsgaWQgfSxcbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJVc2VyIG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJVc2VyIGlzIHN1c3BlbmRlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydCBzZXJ2aWNlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA0LiB0b2tlblZlcnNpb24gbXVzdCBtYXRjaCBEQiAobG9nb3V0IC8gcGFzc3dvcmQgY2hhbmdlIGtpbGxzIG9sZCB0b2tlbnMpXG4gICAgaWYgKHVzZXIudG9rZW5WZXJzaW9uICE9PSB0b2tlblZlcnNpb24pIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAxLFxuICAgICAgICBcIlNlc3Npb24gaXMgbm8gbG9uZ2VyIHZhbGlkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDUuIGF1dGhvcml6YXRpb24gdXNlcyB0aGUgREIgcm9sZSwgbm90IHRoZSAocG9zc2libHkgc3RhbGUpIEpXVCByb2xlXG4gICAgaWYgKHJlcXVpcmVkUm9sZXMubGVuZ3RoICYmICFyZXF1aXJlZFJvbGVzLmluY2x1ZGVzKHVzZXIucm9sZSkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAzLFxuICAgICAgICBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gYWNjZXNzIHRoaXMgcm91dGUuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDYuIGF0dGFjaCB0aGUgYXV0aGVudGljYXRlZCB1c2VyIHRvIHRoZSByZXF1ZXN0XG4gICAgcmVxLnVzZXIgPSB7XG4gICAgICBpZDogdXNlci5pZCxcbiAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgIGVtYWlsOiB1c2VyLmVtYWlsLFxuICAgICAgcm9sZTogdXNlci5yb2xlLFxuICAgIH07XG5cbiAgICBuZXh0KCk7XG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYXV0aDsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHVzZXJDb250cm9sbGVyIH0gZnJvbSBcIi4vdXNlci5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyB1c2VyVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi91c2VyLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE93biBwcm9maWxlIFx1MjAxNCBhbnkgYXV0aGVudGljYXRlZCB1c2VyXG5yb3V0ZXIucGF0Y2goXG4gIFwiL3Byb2ZpbGVcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiB1c2VyVmFsaWRhdGlvbnMudXBkYXRlUHJvZmlsZVNjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIudXBkYXRlUHJvZmlsZSxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBsaXN0IHVzZXJzIHdpdGggZmlsdGVycyArIHBhZ2luYXRpb25cbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogdXNlclZhbGlkYXRpb25zLnVzZXJRdWVyeVNjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIuZ2V0VXNlcnMsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgcm9sZSBtYW5hZ2VtZW50XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9yb2xlXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiB1c2VyVmFsaWRhdGlvbnMudXNlclBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiB1c2VyVmFsaWRhdGlvbnMuY2hhbmdlUm9sZVNjaGVtYSxcbiAgfSksXG4gIHVzZXJDb250cm9sbGVyLmNoYW5nZVJvbGUsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgc3RhdHVzIG1hbmFnZW1lbnRcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogdXNlclZhbGlkYXRpb25zLmNoYW5nZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIHVzZXJDb250cm9sbGVyLmNoYW5nZVN0YXR1cyxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBzb2Z0IGRlbGV0ZVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLmRlbGV0ZVVzZXIsXG4pO1xuXG5leHBvcnQgY29uc3QgdXNlclJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHVzZXJTZXJ2aWNlIH0gZnJvbSBcIi4vdXNlci5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gVXBkYXRlIHByb2ZpbGUgY29udHJvbGxlclxuY29uc3QgdXBkYXRlUHJvZmlsZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UudXBkYXRlUHJvZmlsZSh1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQcm9maWxlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdldCBhbGwgdXNlcnMgKGFkbWluKVxuY29uc3QgZ2V0VXNlcnMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1c2VyU2VydmljZS5nZXRVc2VycyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXJzIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSB1c2VyIHJvbGUgKGFkbWluKVxuY29uc3QgY2hhbmdlUm9sZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgLy8gYW4gYWRtaW4gbXVzdCBub3QgZG93bmdyYWRlL2NoYW5nZSB0aGVpciBvd24gcm9sZVxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBjaGFuZ2UgeW91ciBvd24gcm9sZS5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5jaGFuZ2VSb2xlKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciByb2xlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSB1c2VyIHN0YXR1cyAoYWRtaW4pXG5jb25zdCBjaGFuZ2VTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IHN1c3BlbmQvYWN0aXZhdGUgdGhlaXIgb3duIGFjY291bnRcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgY2hhbmdlIHlvdXIgb3duIHN0YXR1cy5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5jaGFuZ2VTdGF0dXMoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBTb2Z0IGRlbGV0ZSB1c2VyIChhZG1pbilcbmNvbnN0IGRlbGV0ZVVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IGRlbGV0ZSB0aGVpciBvd24gYWNjb3VudFxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBkZWxldGUgeW91ciBvd24gYWNjb3VudC5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5kZWxldGVVc2VyKGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCB1c2VyQ29udHJvbGxlciA9IHtcbiAgdXBkYXRlUHJvZmlsZSxcbiAgZ2V0VXNlcnMsXG4gIGNoYW5nZVJvbGUsXG4gIGNoYW5nZVN0YXR1cyxcbiAgZGVsZXRlVXNlcixcbn07IiwgImltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBSb2xlLCBVc2VyU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7XG4gIElDaGFuZ2VSb2xlLFxuICBJQ2hhbmdlU3RhdHVzLFxuICBJVXBkYXRlUHJvZmlsZSxcbiAgSVVzZXJRdWVyeSxcbn0gZnJvbSBcIi4vdXNlci5pbnRlcmZhY2VcIjtcblxuY29uc3QgdmFsaWRhdGVBY3RpdmVVc2VyID0gYXN5bmMgKGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cbiAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJVc2VyIGlzIHN1c3BlbmRlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydCBzZXJ2aWNlLlwiKTtcbiAgfVxuXG4gIHJldHVybiB1c2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFVwZGF0ZSBwcm9maWxlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgdXBkYXRlUHJvZmlsZSA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSVVwZGF0ZVByb2ZpbGUpID0+IHtcbiAgY29uc3QgeyBuYW1lLCBwaG9uZSwgYXZhdGFyVXJsLCBjdXJyZW50UGFzc3dvcmQsIG5ld1Bhc3N3b3JkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlT3JUaHJvdyh7IHdoZXJlOiB7IGlkOiB1c2VySWQgfSB9KTtcblxuICBpZiAodXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaGFzIGJlZW4gZGVsZXRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5hdXRoUHJvdmlkZXIgPT09IFwiR09PR0xFXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDMsXG4gICAgICBcIkdvb2dsZSBhY2NvdW50cyBjYW5ub3QgY2hhbmdlIHBhc3N3b3JkLiBVc2UgR29vZ2xlIHNpZ24taW4gdG8gbWFuYWdlIHlvdXIgcHJvZmlsZS5cIixcbiAgICApO1xuICB9XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLlVzZXJVcGRhdGVJbnB1dCA9IHt9O1xuXG4gIGlmIChuYW1lKSBkYXRhLm5hbWUgPSBuYW1lO1xuICBpZiAocGhvbmUpIGRhdGEucGhvbmUgPSBwaG9uZTtcbiAgaWYgKGF2YXRhclVybCkgZGF0YS5hdmF0YXJVcmwgPSBhdmF0YXJVcmw7XG5cbiAgLy8gUGFzc3dvcmQgY2hhbmdlIHJlcXVpcmVzIGN1cnJlbnRQYXNzd29yZCArIG5ld1Bhc3N3b3JkXG4gIGlmIChuZXdQYXNzd29yZCkge1xuICAgIGlmICghY3VycmVudFBhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkN1cnJlbnQgcGFzc3dvcmQgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuICAgIGlmIChjdXJyZW50UGFzc3dvcmQgPT09IG5ld1Bhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIk5ldyBwYXNzd29yZCBtdXN0IGJlIGRpZmZlcmVudFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBpc01hdGNoID0gYXdhaXQgYmNyeXB0LmNvbXBhcmUoY3VycmVudFBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkIHx8IFwiXCIpO1xuICAgIGlmICghaXNNYXRjaCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGN1cnJlbnQgcGFzc3dvcmRcIik7XG4gICAgfVxuXG4gICAgZGF0YS5wYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgICAgbmV3UGFzc3dvcmQsXG4gICAgICBOdW1iZXIoY29uZmlnLmJjcnlwdF9zYWx0X3JvdW5kcyksXG4gICAgKTtcbiAgICBkYXRhLnRva2VuVmVyc2lvbiA9IHsgaW5jcmVtZW50OiAxIH07XG4gIH1cblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIGRhdGEsXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gdXBkYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IGxpc3QgdXNlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRVc2VycyA9IGFzeW5jIChxdWVyeTogSVVzZXJRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSB8fCAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0IHx8IDEwO1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVXNlcldoZXJlSW5wdXQgPSB7XG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgfTtcblxuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUuT1IgPSBbXG4gICAgICB7IG5hbWU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgIHsgZW1haWw6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICBdO1xuICB9XG4gIGlmIChxdWVyeS5yb2xlKSB3aGVyZS5yb2xlID0gcXVlcnkucm9sZTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuXG4gIGNvbnN0IFt1c2VycywgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS51c2VyLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgc2tpcDogKHBhZ2UgLSAxKSAqIGxpbWl0LFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEudXNlci5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IHVzZXJzLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IHVwZGF0ZSByb2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY2hhbmdlUm9sZSA9IGFzeW5jIChpZDogc3RyaW5nLCBwYXlsb2FkOiBJQ2hhbmdlUm9sZSkgPT4ge1xuICBjb25zdCB7IHJvbGUgfSA9IHBheWxvYWQ7XG5cbiAgYXdhaXQgdmFsaWRhdGVBY3RpdmVVc2VyKGlkKTtcblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IHJvbGUsIHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiB1cGRhdGUgc3RhdHVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY2hhbmdlU3RhdHVzID0gYXN5bmMgKGlkOiBzdHJpbmcsIHBheWxvYWQ6IElDaGFuZ2VTdGF0dXMpID0+IHtcbiAgY29uc3QgeyBzdGF0dXMgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YToge1xuICAgICAgc3RhdHVzLFxuICAgICAgLy8gcmVhY3RpdmF0aW5nIHByZXNlcnZlcyB0aGUgYWNjb3VudCB3aGlsZSBzdXNwZW5kaW5nIHJldm9rZXMgYWxsIHNlc3Npb25zXG4gICAgICAuLi4oc3RhdHVzID09PSBVc2VyU3RhdHVzLlNVU1BFTkRFRCAmJiB7IHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9KSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBzb2Z0IGRlbGV0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGRlbGV0ZVVzZXIgPSBhc3luYyAoaWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICBjb25zdCBkZWxldGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSwgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gZGVsZXRlZFVzZXI7XG59O1xuXG5leHBvcnQgY29uc3QgdXNlclNlcnZpY2UgPSB7XG4gIHVwZGF0ZVByb2ZpbGUsXG4gIGdldFVzZXJzLFxuICBjaGFuZ2VSb2xlLFxuICBjaGFuZ2VTdGF0dXMsXG4gIGRlbGV0ZVVzZXIsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUm9sZSwgVXNlclN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5cbmNvbnN0IHVwZGF0ZVByb2ZpbGVTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIG5hbWU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgICBwaG9uZTogelxuICAgICAgLnN0cmluZygpXG4gICAgICAudHJpbSgpXG4gICAgICAubWF4KDIwLCBcIlBob25lIG51bWJlciBpcyB0b28gbG9uZ1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gICAgYXZhdGFyVXJsOiB6LnN0cmluZygpLnRyaW0oKS51cmwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGltYWdlIFVSTFwiKS5vcHRpb25hbCgpLFxuICAgIGN1cnJlbnRQYXNzd29yZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgICBuZXdQYXNzd29yZDogelxuICAgICAgLnN0cmluZygpXG4gICAgICAubWluKDYsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBsZWFzdCA2IGNoYXJhY3RlcnNcIilcbiAgICAgIC5tYXgoNzIsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBtb3N0IDcyIGNoYXJhY3RlcnNcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICB9KVxuICAucmVmaW5lKFxuICAgIChkYXRhKSA9PlxuICAgICAgZGF0YS5uZXdQYXNzd29yZCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICBkYXRhLmN1cnJlbnRQYXNzd29yZCAhPT0gdW5kZWZpbmVkLFxuICAgIHsgbWVzc2FnZTogXCJDdXJyZW50IHBhc3N3b3JkIGlzIHJlcXVpcmVkIHRvIGNoYW5nZSBwYXNzd29yZFwiIH0sXG4gICk7XG5cbmNvbnN0IHVzZXJRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5vcHRpb25hbCgpLFxuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSkub3B0aW9uYWwoKSxcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oVXNlclN0YXR1cykub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCB1c2VyUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJVc2VyIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IGNoYW5nZVJvbGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlLCB7IHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgcm9sZVwiIH0pLFxufSk7XG5cbmNvbnN0IGNoYW5nZVN0YXR1c1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oVXNlclN0YXR1cywge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgc3RhdHVzXCIsXG4gIH0pLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRVcGRhdGVQcm9maWxlU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXBkYXRlUHJvZmlsZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUVXNlclF1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXNlclF1ZXJ5U2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IHVzZXJWYWxpZGF0aW9ucyA9IHtcbiAgdXBkYXRlUHJvZmlsZVNjaGVtYSxcbiAgdXNlclF1ZXJ5U2NoZW1hLFxuICB1c2VyUGFyYW1zU2NoZW1hLFxuICBjaGFuZ2VSb2xlU2NoZW1hLFxuICBjaGFuZ2VTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IG11bHRlciBmcm9tIFwibXVsdGVyXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB7IHVwbG9hZHNDb250cm9sbGVyIH0gZnJvbSBcIi4vdXBsb2Fkcy5jb250cm9sbGVyXCI7XG5cbmNvbnN0IHVwbG9hZCA9IG11bHRlcih7XG4gIHN0b3JhZ2U6IG11bHRlci5tZW1vcnlTdG9yYWdlKCksXG4gIGxpbWl0czogeyBmaWxlU2l6ZTogNSAqIDEwMjQgKiAxMDI0IH0sXG4gIGZpbGVGaWx0ZXI6IChfcmVxLCBmaWxlLCBjYikgPT4ge1xuICAgIGlmICgvXmltYWdlXFwvKGpwZWd8cG5nfHdlYnApJC8udGVzdChmaWxlLm1pbWV0eXBlKSkge1xuICAgICAgY2IobnVsbCwgdHJ1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKFxuICAgICAgICBPYmplY3QuYXNzaWduKG5ldyBFcnJvcihcIk9ubHkganBnLCBwbmcgb3Igd2VicCBpbWFnZXMgYXJlIGFsbG93ZWRcIiksIHtcbiAgICAgICAgICBjb2RlOiBcIklOVkFMSURfRklMRV9UWVBFXCIsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG4gIH0sXG59KTtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9pbWFnZVwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB1cGxvYWQuc2luZ2xlKFwiaW1hZ2VcIiksXG4gIHVwbG9hZHNDb250cm9sbGVyLnVwbG9hZEltYWdlLFxuKTtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5IH0gZnJvbSBcIi4vdXBsb2Fkcy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbi8vIFVwbG9hZCBhIHNpbmdsZSBpbWFnZSAoQUdFTlQvQURNSU4pIFx1MjE5MiBDbG91ZGluYXJ5XG5jb25zdCB1cGxvYWRJbWFnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGlmICghcmVxLmZpbGUpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW1hZ2UgZmlsZSBpcyByZXF1aXJlZFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeShyZXEuZmlsZSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJJbWFnZSB1cGxvYWRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgdXBsb2Fkc0NvbnRyb2xsZXIgPSB7XG4gIHVwbG9hZEltYWdlLFxufTsiLCAiaW1wb3J0IHsgdjIgYXMgY2xvdWRpbmFyeSB9IGZyb20gXCJjbG91ZGluYXJ5XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuY2xvdWRpbmFyeS5jb25maWcoe1xuICBjbG91ZF9uYW1lOiBjb25maWcuY2xvdWRpbmFyeV9jbG91ZF9uYW1lLFxuICBhcGlfa2V5OiBjb25maWcuY2xvdWRpbmFyeV9hcGlfa2V5LFxuICBhcGlfc2VjcmV0OiBjb25maWcuY2xvdWRpbmFyeV9hcGlfc2VjcmV0LFxufSk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsb3VkaW5hcnk7IiwgImltcG9ydCBjbG91ZGluYXJ5IGZyb20gXCIuLi8uLi9saWIvY2xvdWRpbmFyeVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5ID0gKFxuICBmaWxlOiBFeHByZXNzLk11bHRlci5GaWxlLFxuKTogUHJvbWlzZTx7IHVybDogc3RyaW5nOyBwdWJsaWNJZDogc3RyaW5nIH0+ID0+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCB1cGxvYWRTdHJlYW0gPSBjbG91ZGluYXJ5LnVwbG9hZGVyLnVwbG9hZF9zdHJlYW0oXG4gICAgICB7IGZvbGRlcjogXCJ0cmlwdmVyc2VcIiB9LFxuICAgICAgKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKGVycm9yIHx8ICFyZXN1bHQpIHtcbiAgICAgICAgICByZWplY3QobmV3IEFwcEVycm9yKDQwMCwgXCJJbWFnZSB1cGxvYWQgZmFpbGVkLiBQbGVhc2UgdHJ5IGFnYWluLlwiKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJlc29sdmUoeyB1cmw6IHJlc3VsdC5zZWN1cmVfdXJsLCBwdWJsaWNJZDogcmVzdWx0LnB1YmxpY19pZCB9KTtcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHVwbG9hZFN0cmVhbS5lbmQoZmlsZS5idWZmZXIpO1xuICB9KTtcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBjb250YWN0Q29udHJvbGxlciB9IGZyb20gXCIuL2NvbnRhY3QuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgY29udGFjdFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vY29udGFjdC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIHJvdXRlIChwdWJsaWMsIG5vIGF1dGgpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGNvbnRhY3RWYWxpZGF0aW9ucy5jcmVhdGVNZXNzYWdlU2NoZW1hIH0pLFxuICBjb250YWN0Q29udHJvbGxlci5jcmVhdGVNZXNzYWdlLFxuKTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIHJvdXRlIChhZG1pbiBvbmx5KVxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBjb250YWN0VmFsaWRhdGlvbnMuY29udGFjdFF1ZXJ5U2NoZW1hIH0pLFxuICBjb250YWN0Q29udHJvbGxlci5nZXRNZXNzYWdlcyxcbik7XG5cbi8vIDMuIE1hcmsgcmVzb2x2ZWQvdW5yZXNvbHZlZCByb3V0ZSAoYWRtaW4gb25seSlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBjb250YWN0VmFsaWRhdGlvbnMuY29udGFjdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBjb250YWN0VmFsaWRhdGlvbnMudXBkYXRlUmVzb2x2ZWRTY2hlbWEsXG4gIH0pLFxuICBjb250YWN0Q29udHJvbGxlci51cGRhdGVSZXNvbHZlZCxcbik7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgY29udGFjdFNlcnZpY2UgfSBmcm9tIFwiLi9jb250YWN0LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGNyZWF0ZU1lc3NhZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgY29udGFjdFNlcnZpY2UuY3JlYXRlTWVzc2FnZShyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJNZXNzYWdlIHNlbnQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbWVzc2FnZSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyBjb250cm9sbGVyIChhZG1pbiBvbmx5KVxuY29uc3QgZ2V0TWVzc2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb250YWN0U2VydmljZS5saXN0TWVzc2FnZXMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDb250YWN0IG1lc3NhZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gTWFyayByZXNvbHZlZC91bnJlc29sdmVkIGNvbnRyb2xsZXIgKGFkbWluIG9ubHkpXG5jb25zdCB1cGRhdGVSZXNvbHZlZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHsgaXNSZXNvbHZlZCB9ID0gcmVxLmJvZHk7XG5cbiAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgY29udGFjdFNlcnZpY2UucmVzb2x2ZU1lc3NhZ2UoaWQsIGlzUmVzb2x2ZWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIk1lc3NhZ2Ugc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbWVzc2FnZSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlTWVzc2FnZSxcbiAgZ2V0TWVzc2FnZXMsXG4gIHVwZGF0ZVJlc29sdmVkLFxufTsiLCAiaW1wb3J0IHsgUmVzZW5kIH0gZnJvbSBcInJlc2VuZFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cyB9IGZyb20gXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGFjdEVtYWlsRGV0YWlscyB7XG4gIG5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgc3ViamVjdDogc3RyaW5nO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGNyZWF0ZWRBdD86IERhdGU7XG59XG5cbi8vIExhemlseSBpbml0aWFsaXNlZCBzbyB0aGUgbW9kdWxlIGlzIGltcG9ydGFibGUgZXZlbiB3aGVuIFJFU0VORF9BUElfS0VZXG4vLyBpcyBub3QgY29uZmlndXJlZCAoZS5nLiBsb2NhbCBkZXYgLyBkZW1vIHdpdGhvdXQgZW1haWwpLlxubGV0IHJlc2VuZDogUmVzZW5kIHwgbnVsbCA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldFJlc2VuZCgpOiBSZXNlbmQgfCBudWxsIHtcbiAgaWYgKHJlc2VuZCkgcmV0dXJuIHJlc2VuZDtcbiAgaWYgKCFjb25maWcucmVzZW5kX2FwaV9rZXkpIHJldHVybiBudWxsO1xuICByZXNlbmQgPSBuZXcgUmVzZW5kKGNvbmZpZy5yZXNlbmRfYXBpX2tleSk7XG4gIHJldHVybiByZXNlbmQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVIdG1sKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdmFsdWVcbiAgICAucmVwbGFjZSgvJi9nLCBcIiZhbXA7XCIpXG4gICAgLnJlcGxhY2UoLzwvZywgXCImbHQ7XCIpXG4gICAgLnJlcGxhY2UoLz4vZywgXCImZ3Q7XCIpXG4gICAgLnJlcGxhY2UoL1wiL2csIFwiJnF1b3Q7XCIpXG4gICAgLnJlcGxhY2UoLycvZywgXCImIzAzOTtcIik7XG59XG5cbi8vIFdyYXBzIGEgUmVzZW5kIHNlbmQgc28gZmFpbHVyZXMgYmVjb21lIGEgc2luZ2xlIGNsZWFuIHdhcm5pbmcgbGluZSBpbnN0ZWFkXG4vLyBvZiB0aGUgU0RLJ3Mgbm9pc3kgbXVsdGktbGluZSBlcnJvci4gUmVzZW5kIGNhbiBsZWdpdGltYXRlbHkgcmVqZWN0IHNlbmRzXG4vLyAoZS5nLiB0aGUgZGVmYXVsdCBvbmJvYXJkaW5nQHJlc2VuZC5kZXYgc2VuZGVyIG1heSBvbmx5IGRlbGl2ZXIgdG8gdGhlXG4vLyBhY2NvdW50IG93bmVyKSwgc28gZW1haWxzIGFyZSBzdHJpY3RseSBiZXN0LWVmZm9ydC5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRXaXRoTG9nKFxuICBjbGllbnQ6IFJlc2VuZCxcbiAgc3ViamVjdDogc3RyaW5nLFxuICB0bzogc3RyaW5nW10sXG4gIGh0bWw6IHN0cmluZyxcbiAgcmVwbHlUbz86IHN0cmluZyxcbik6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIGF3YWl0IGNsaWVudC5lbWFpbHMuc2VuZCh7XG4gICAgICBmcm9tOiBjb25maWcuZW1haWxfZnJvbSB8fCBcIlRyaXBWZXJzZSA8b25ib2FyZGluZ0ByZXNlbmQuZGV2PlwiLFxuICAgICAgdG8sXG4gICAgICBzdWJqZWN0LFxuICAgICAgaHRtbCxcbiAgICAgIC4uLihyZXBseVRvID8geyByZXBseVRvIH0gOiB7fSksXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc3QgZGV0YWlsID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgIGNvbnNvbGUud2FybihgW2VtYWlsXSBzZW5kIGZhaWxlZCAoJHtzdWJqZWN0fSkgdG8gJHt0by5qb2luKFwiLCBcIil9OiAke2RldGFpbH1gKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgZW1haWxMYXlvdXQgPSAoY29udGVudDogc3RyaW5nKSA9PiBgXG4gIDxkaXYgc3R5bGU9XCJmb250LWZhbWlseTogQXJpYWwsIEhlbHZldGljYSwgc2Fucy1zZXJpZjsgbWF4LXdpZHRoOiA1NjBweDsgbWFyZ2luOiAwIGF1dG87IGNvbG9yOiAjMWExYTFhO1wiPlxuICAgIDxkaXYgc3R5bGU9XCJiYWNrZ3JvdW5kOiAjMGY3NjZlOyBwYWRkaW5nOiAyNHB4OyBib3JkZXItcmFkaXVzOiA4cHggOHB4IDAgMDtcIj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6ICNmZmZmZmY7IGZvbnQtc2l6ZTogMThweDsgZm9udC13ZWlnaHQ6IGJvbGQ7XCI+VHJpcFZlcnNlPC9zcGFuPlxuICAgIDwvZGl2PlxuICAgIDxkaXYgc3R5bGU9XCJib3JkZXI6IDFweCBzb2xpZCAjZTVlN2ViOyBib3JkZXItdG9wOiBub25lOyBwYWRkaW5nOiAzMnB4OyBib3JkZXItcmFkaXVzOiAwIDAgOHB4IDhweDtcIj5cbiAgICAgICR7Y29udGVudH1cbiAgICA8L2Rpdj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTJweDsgY29sb3I6ICM2YjcyODA7IG1hcmdpbi10b3A6IDE2cHg7IHRleHQtYWxpZ246IGNlbnRlcjtcIj5cbiAgICAgIFlvdSBhcmUgcmVjZWl2aW5nIHRoaXMgZW1haWwgYmVjYXVzZSBvZiBhY3Rpdml0eSBvbiBUcmlwVmVyc2UuXG4gICAgPC9wPlxuICA8L2Rpdj5cbmA7XG5cbi8vIE5vdGlmaWVzIHRoZSBzdXBwb3J0IGluYm94IGFib3V0IGEgbmV3IGNvbnRhY3QgZm9ybSBzdWJtaXNzaW9uLlxuZXhwb3J0IGNvbnN0IHNlbmRDb250YWN0Tm90aWZpY2F0aW9uID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQ29udGFjdEVtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zdCBjbGllbnQgPSBnZXRSZXNlbmQoKTtcbiAgaWYgKCFjbGllbnQgfHwgIWNvbmZpZy5jb250YWN0X3JlY2VpdmVyX2VtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGNvbnRhY3Qgbm90aWZpY2F0aW9uLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBjcmVhdGVkQXQgPSBkZXRhaWxzLmNyZWF0ZWRBdD8udG9JU09TdHJpbmcoKSA/PyBcImp1c3Qgbm93XCI7XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+TmV3IGNvbnRhY3QgbWVzc2FnZTwvaDI+XG4gICAgPHRhYmxlIHN0eWxlPVwid2lkdGg6IDEwMCU7IGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7IGZvbnQtc2l6ZTogMTRweDtcIj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwOyB3aWR0aDogMTIwcHg7XCI+TmFtZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5FbWFpbDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChkZXRhaWxzLmVtYWlsKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlN1YmplY3Q8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLnN1YmplY3QpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+UmVjZWl2ZWQ8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoY3JlYXRlZEF0KX08L3RkPlxuICAgICAgPC90cj5cbiAgICA8L3RhYmxlPlxuICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOiAxNnB4OyBwYWRkaW5nOiAxNnB4OyBiYWNrZ3JvdW5kOiAjZjlmYWZiOyBib3JkZXItcmFkaXVzOiA2cHg7IHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcIj5cbiAgICAgICR7ZXNjYXBlSHRtbChkZXRhaWxzLm1lc3NhZ2UpfVxuICAgIDwvZGl2PlxuICBgO1xuXG4gIGF3YWl0IHNlbmRXaXRoTG9nKFxuICAgIGNsaWVudCxcbiAgICBgTmV3IGNvbnRhY3QgbWVzc2FnZTogJHtkZXRhaWxzLnN1YmplY3R9YCxcbiAgICBbY29uZmlnLmNvbnRhY3RfcmVjZWl2ZXJfZW1haWxdLFxuICAgIGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICApO1xufTtcblxuLy8gU2VuZHMgYSBjb25maXJtYXRpb24gcmVwbHkgdG8gdGhlIHBlcnNvbiB3aG8gc3VibWl0dGVkIHRoZSBmb3JtLlxuZXhwb3J0IGNvbnN0IHNlbmRDb250YWN0QXV0b1JlcGx5ID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQ29udGFjdEVtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zdCBjbGllbnQgPSBnZXRSZXNlbmQoKTtcbiAgaWYgKCFjbGllbnQgfHwgIWRldGFpbHMuZW1haWwpIHtcbiAgICBjb25zb2xlLndhcm4oXCJbZW1haWxdIFJlc2VuZCBub3QgY29uZmlndXJlZDsgc2tpcHBpbmcgY29udGFjdCBhdXRvLXJlcGx5LlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCByZWNlaXZlckVtYWlsID0gY29uZmlnLmNvbnRhY3RfcmVjZWl2ZXJfZW1haWw7XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+VGhhbmtzIGZvciByZWFjaGluZyBvdXQsICR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfSE8L2gyPlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxNHB4OyBsaW5lLWhlaWdodDogMS42OyBjb2xvcjogIzM3NDE1MTtcIj5cbiAgICAgIFdlJmFwb3M7dmUgcmVjZWl2ZWQgeW91ciBtZXNzYWdlIGFib3V0XG4gICAgICA8c3Ryb25nPiZsZHF1bzske2VzY2FwZUh0bWwoZGV0YWlscy5zdWJqZWN0KX0mcmRxdW87PC9zdHJvbmc+IGFuZCBvdXIgc3VwcG9ydFxuICAgICAgdGVhbSB3aWxsIGdldCBiYWNrIHRvIHlvdSB3aXRoaW4gb25lIGJ1c2luZXNzIGRheS5cbiAgICA8L3A+XG4gIGA7XG5cbiAgYXdhaXQgc2VuZFdpdGhMb2coXG4gICAgY2xpZW50LFxuICAgIFwiV2UgcmVjZWl2ZWQgeW91ciBtZXNzYWdlIC0gVHJpcFZlcnNlXCIsXG4gICAgW2RldGFpbHMuZW1haWxdLFxuICAgIGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICAgIHJlY2VpdmVyRW1haWwsXG4gICk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQm9va2luZyBlbWFpbHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5leHBvcnQgaW50ZXJmYWNlIElCb29raW5nRW1haWxEZXRhaWxzIHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBwYWNrYWdlVGl0bGU6IHN0cmluZztcbiAgdHJhdmVsRGF0ZTogRGF0ZTtcbiAgdHJhdmVsZXJzOiBudW1iZXI7XG4gIHRvdGFsUHJpY2U6IG51bWJlcjtcbiAgc3RhdHVzOiBCb29raW5nU3RhdHVzO1xufVxuXG4vLyBJbmZvcm1zIHRoZSBjdXN0b21lciBhYm91dCBhIGJvb2tpbmcgY3JlYXRlL2NvbmZpcm0vY2FuY2VsLlxuLy8gQmVzdC1lZmZvcnQgbGlrZSB0aGUgY29udGFjdCBlbWFpbHMgXHUyMDE0IGEgZmFpbHVyZSBtdXN0IG5ldmVyIGZhaWwgdGhlIHJlcXVlc3QuXG5leHBvcnQgY29uc3Qgc2VuZEJvb2tpbmdFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSUJvb2tpbmdFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGJvb2tpbmcgZW1haWwuXCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHRyYXZlbERhdGUgPSBkZXRhaWxzLnRyYXZlbERhdGUudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCk7XG5cbiAgY29uc3Qgc3RhdHVzQ29weTogUmVjb3JkPFxuICAgIEJvb2tpbmdTdGF0dXMsXG4gICAgeyBzdWJqZWN0OiBzdHJpbmc7IGhlYWRpbmc6IHN0cmluZzsgYm9keTogc3RyaW5nIH1cbiAgPiA9IHtcbiAgICBbQm9va2luZ1N0YXR1cy5QRU5ESU5HXToge1xuICAgICAgc3ViamVjdDogXCJCb29raW5nIHJlY2VpdmVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIkJvb2tpbmcgcmVjZWl2ZWRcIixcbiAgICAgIGJvZHk6IFwiV2UndmUgcmVjZWl2ZWQgeW91ciBib29raW5nIHJlcXVlc3QuIFRoZSBhZ2VudCB3aWxsIGNvbmZpcm0gaXQgc2hvcnRseS5cIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLlBBSURdOiB7XG4gICAgICBzdWJqZWN0OiBcIlBheW1lbnQgcmVjZWl2ZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiUGF5bWVudCByZWNlaXZlZFwiLFxuICAgICAgYm9keTogXCJZb3VyIHBheW1lbnQgaGFzIGJlZW4gcmVjZWl2ZWQsIGFuZCB0aGUgYWdlbnQgd2lsbCBjb25maXJtIHlvdXIgYm9va2luZyBzaG9ydGx5LlwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXToge1xuICAgICAgc3ViamVjdDogXCJCb29raW5nIGNvbmZpcm1lZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJCb29raW5nIGNvbmZpcm1lZFwiLFxuICAgICAgYm9keTogXCJHcmVhdCBuZXdzIFx1MjAxNCB5b3VyIGJvb2tpbmcgaGFzIGJlZW4gY29uZmlybWVkLiBXZSBsb29rIGZvcndhcmQgdG8gaG9zdGluZyB5b3UhXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgY2FuY2VsbGVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIkJvb2tpbmcgY2FuY2VsbGVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgYm9va2luZyBoYXMgYmVlbiBjYW5jZWxsZWQuIElmIHRoaXMgd2Fzbid0IGV4cGVjdGVkLCBwbGVhc2UgY29udGFjdCBzdXBwb3J0LlwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09NUExFVEVEXToge1xuICAgICAgc3ViamVjdDogXCJUcmlwIGNvbXBsZXRlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJUcmlwIGNvbXBsZXRlZFwiLFxuICAgICAgYm9keTogXCJZb3VyIHRyaXAgaGFzIGJlZW4gbWFya2VkIGFzIGNvbXBsZXRlZC4gVGhhbmsgeW91IGZvciB0cmF2ZWxsaW5nIHdpdGggVHJpcFZlcnNlIVwiLFxuICAgIH0sXG4gIH07XG5cbiAgY29uc3QgY29weSA9IHN0YXR1c0NvcHlbZGV0YWlscy5zdGF0dXNdO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPiR7Y29weS5oZWFkaW5nfTwvaDI+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDE0cHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjMzc0MTUxO1wiPlxuICAgICAgSGkgJHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9LDxici8+XG4gICAgICAke2NvcHkuYm9keX1cbiAgICA8L3A+XG4gICAgPHRhYmxlIHN0eWxlPVwid2lkdGg6IDEwMCU7IGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7IGZvbnQtc2l6ZTogMTRweDtcIj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwOyB3aWR0aDogMTIwcHg7XCI+UGFja2FnZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGRldGFpbHMucGFja2FnZVRpdGxlKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRyYXZlbCBkYXRlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKHRyYXZlbERhdGUpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VHJhdmVsZXJzPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKFN0cmluZyhkZXRhaWxzLnRyYXZlbGVycykpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VG90YWw8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiYjMjU0Nzske2VzY2FwZUh0bWwoZGV0YWlscy50b3RhbFByaWNlLnRvRml4ZWQoMikpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgIDwvdGFibGU+XG4gIGA7XG5cbiAgYXdhaXQgc2VuZFdpdGhMb2coXG4gICAgY2xpZW50LFxuICAgIGNvcHkuc3ViamVjdCxcbiAgICBbZGV0YWlscy5lbWFpbF0sXG4gICAgZW1haWxMYXlvdXQoY29udGVudCksXG4gICk7XG59O1xuXG4vLyBJbmZvcm1zIHRoZSBjdXN0b21lciB0aGF0IGEgcGFpZCBib29raW5nIHdhcyBjYW5jZWxsZWQgYW5kIHRoZSBwYXltZW50IGhhc1xuLy8gYmVlbiByZWZ1bmRlZC4gQmVzdC1lZmZvcnQgbGlrZSB0aGUgb3RoZXIgZW1haWxzLlxuZXhwb3J0IGludGVyZmFjZSBJUmVmdW5kRW1haWxEZXRhaWxzIHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBwYWNrYWdlVGl0bGU6IHN0cmluZztcbiAgdHJhdmVsRGF0ZTogRGF0ZTtcbiAgYW1vdW50OiBudW1iZXI7XG4gIHJlZnVuZFJlZklkPzogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGNvbnN0IHNlbmRSZWZ1bmRFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSVJlZnVuZEVtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zdCBjbGllbnQgPSBnZXRSZXNlbmQoKTtcbiAgaWYgKCFjbGllbnQgfHwgIWRldGFpbHMuZW1haWwpIHtcbiAgICBjb25zb2xlLndhcm4oXCJbZW1haWxdIFJlc2VuZCBub3QgY29uZmlndXJlZDsgc2tpcHBpbmcgcmVmdW5kIGVtYWlsLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB0cmF2ZWxEYXRlID0gZGV0YWlscy50cmF2ZWxEYXRlLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPlJlZnVuZCBpc3N1ZWQ8L2gyPlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxNHB4OyBsaW5lLWhlaWdodDogMS42OyBjb2xvcjogIzM3NDE1MTtcIj5cbiAgICAgIEhpICR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfSw8YnIvPlxuICAgICAgWW91ciBib29raW5nIHdhcyBjYW5jZWxsZWQsIGFuZCA8c3Ryb25nPiYjMjU0Nzske2VzY2FwZUh0bWwoXG4gICAgICAgIGRldGFpbHMuYW1vdW50LnRvRml4ZWQoMiksXG4gICAgICApfTwvc3Ryb25nPiBoYXMgYmVlbiByZWZ1bmRlZCB0byB5b3VyIG9yaWdpbmFsIHBheW1lbnQgbWV0aG9kLiBQbGVhc2UgYWxsb3dcbiAgICAgIDUtMTAgYnVzaW5lc3MgZGF5cyBmb3IgdGhlIG1vbmV5IHRvIGFwcGVhci5cbiAgICA8L3A+XG4gICAgPHRhYmxlIHN0eWxlPVwid2lkdGg6IDEwMCU7IGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7IGZvbnQtc2l6ZTogMTRweDtcIj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwOyB3aWR0aDogMTIwcHg7XCI+UGFja2FnZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGRldGFpbHMucGFja2FnZVRpdGxlKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRyYXZlbCBkYXRlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKHRyYXZlbERhdGUpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+UmVmdW5kZWQgYW1vdW50PC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4mIzI1NDc7JHtlc2NhcGVIdG1sKGRldGFpbHMuYW1vdW50LnRvRml4ZWQoMikpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgJHtkZXRhaWxzLnJlZnVuZFJlZklkXG4gICAgICAgID8gYFxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+UmVmdW5kIHJlZmVyZW5jZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChkZXRhaWxzLnJlZnVuZFJlZklkKX08L3RkPlxuICAgICAgPC90cj5gXG4gICAgICAgIDogXCJcIn1cbiAgICA8L3RhYmxlPlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxM3B4OyBsaW5lLWhlaWdodDogMS42OyBjb2xvcjogIzZiNzI4MDsgbWFyZ2luLXRvcDogMTZweDtcIj5cbiAgICAgIElmIHlvdSBoYXZlIGFueSBxdWVzdGlvbnMgYWJvdXQgdGhpcyByZWZ1bmQsIHBsZWFzZSBjb250YWN0IHN1cHBvcnQuXG4gICAgPC9wPlxuICBgO1xuXG4gIGF3YWl0IHNlbmRXaXRoTG9nKFxuICAgIGNsaWVudCxcbiAgICBcIkJvb2tpbmcgY2FuY2VsbGVkICYgcmVmdW5kIGlzc3VlZCAtIFRyaXBWZXJzZVwiLFxuICAgIFtkZXRhaWxzLmVtYWlsXSxcbiAgICBlbWFpbExheW91dChjb250ZW50KSxcbiAgKTtcbn07IiwgImltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7XG4gIHNlbmRDb250YWN0QXV0b1JlcGx5LFxuICBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbixcbn0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQgeyBJQ29udGFjdFF1ZXJ5LCBJQ3JlYXRlQ29udGFjdFBheWxvYWQgfSBmcm9tIFwiLi9jb250YWN0LmludGVyZmFjZVwiO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIChwdWJsaWMpXG5jb25zdCBjcmVhdGVNZXNzYWdlID0gYXN5bmMgKHBheWxvYWQ6IElDcmVhdGVDb250YWN0UGF5bG9hZCkgPT4ge1xuICBjb25zdCBjcmVhdGVkTWVzc2FnZSA9IGF3YWl0IHByaXNtYS5jb250YWN0TWVzc2FnZS5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIG5hbWU6IHBheWxvYWQubmFtZSxcbiAgICAgIGVtYWlsOiBwYXlsb2FkLmVtYWlsLFxuICAgICAgc3ViamVjdDogcGF5bG9hZC5zdWJqZWN0LFxuICAgICAgbWVzc2FnZTogcGF5bG9hZC5tZXNzYWdlLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIEVtYWlscyBhcmUgYmVzdC1lZmZvcnQ6IGEgZmFpbHVyZSBoZXJlIG11c3QgbmV2ZXIgZmFpbCB0aGUgc3VibWlzc2lvblxuICAvLyAodGhlIG1lc3NhZ2UgaXMgYWxyZWFkeSBzYXZlZCB0byB0aGUgaW5ib3gpLlxuICBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRDb250YWN0Tm90aWZpY2F0aW9uKHsgLi4uY3JlYXRlZE1lc3NhZ2UsIGNyZWF0ZWRBdDogY3JlYXRlZE1lc3NhZ2UuY3JlYXRlZEF0IH0pLFxuICAgIHNlbmRDb250YWN0QXV0b1JlcGx5KHsgLi4uY3JlYXRlZE1lc3NhZ2UsIGNyZWF0ZWRBdDogY3JlYXRlZE1lc3NhZ2UuY3JlYXRlZEF0IH0pLFxuICBdKTtcblxuICByZXR1cm4gY3JlYXRlZE1lc3NhZ2U7XG59O1xuXG4vLyAyLiBMaXN0IGNvbnRhY3QgbWVzc2FnZXMgKGFkbWluIG9ubHksIHBhZ2luYXRlZCwgZmlsdGVyYWJsZSBieSBpc1Jlc29sdmVkKVxuY29uc3QgbGlzdE1lc3NhZ2VzID0gYXN5bmMgKHF1ZXJ5OiBJQ29udGFjdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Db250YWN0TWVzc2FnZVdoZXJlSW5wdXQgfCB1bmRlZmluZWQgPVxuICAgIHF1ZXJ5LmlzUmVzb2x2ZWQgPT09IHVuZGVmaW5lZFxuICAgICAgPyB1bmRlZmluZWRcbiAgICAgIDogeyBpc1Jlc29sdmVkOiBxdWVyeS5pc1Jlc29sdmVkIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuY29udGFjdE1lc3NhZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuY29udGFjdE1lc3NhZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG4vLyAzLiBNYXJrIGEgY29udGFjdCBtZXNzYWdlIHJlc29sdmVkL3VucmVzb2x2ZWQgKGFkbWluIG9ubHkpXG5jb25zdCByZXNvbHZlTWVzc2FnZSA9IGFzeW5jIChpZDogc3RyaW5nLCBpc1Jlc29sdmVkOiBib29sZWFuKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuY29udGFjdE1lc3NhZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGRhdGE6IHsgaXNSZXNvbHZlZCB9LFxuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBjb250YWN0U2VydmljZSA9IHtcbiAgY3JlYXRlTWVzc2FnZSxcbiAgbGlzdE1lc3NhZ2VzLFxuICByZXNvbHZlTWVzc2FnZSxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZU1lc3NhZ2VTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIG5hbWU6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTmFtZSBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMiwgXCJOYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgxMDAsIFwiTmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIiksXG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbCBhZGRyZXNzXCIpLFxuICBzdWJqZWN0OiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlN1YmplY3QgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAubWluKDIsIFwiU3ViamVjdCBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMjAwLCBcIlN1YmplY3QgbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpLFxuICBtZXNzYWdlOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk1lc3NhZ2UgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAubWluKDEwLCBcIk1lc3NhZ2UgbXVzdCBiZSBhdCBsZWFzdCAxMCBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgyMDAwLCBcIk1lc3NhZ2UgbXVzdCBiZSBhdCBtb3N0IDIwMDAgY2hhcmFjdGVyc1wiKSxcbn0pLnN0cmljdCgpO1xuXG5jb25zdCBjb250YWN0UXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIGlzUmVzb2x2ZWQ6IHpcbiAgICAuZW51bShbXCJ0cnVlXCIsIFwiZmFsc2VcIl0pXG4gICAgLm9wdGlvbmFsKClcbiAgICAudHJhbnNmb3JtKCh2YWwpID0+ICh2YWwgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IHZhbCA9PT0gXCJ0cnVlXCIpKSxcbn0pO1xuXG5jb25zdCBjb250YWN0UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJNZXNzYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVJlc29sdmVkU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBpc1Jlc29sdmVkOiB6LmJvb2xlYW4oe1xuICAgICAgcmVxdWlyZWRfZXJyb3I6IFwiaXNSZXNvbHZlZCBpcyByZXF1aXJlZFwiLFxuICAgICAgaW52YWxpZF90eXBlX2Vycm9yOiBcImlzUmVzb2x2ZWQgbXVzdCBiZSBhIGJvb2xlYW5cIixcbiAgICB9KSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IHR5cGVvZiBkYXRhLmlzUmVzb2x2ZWQgPT09IFwiYm9vbGVhblwiLCB7XG4gICAgbWVzc2FnZTogXCJpc1Jlc29sdmVkIG11c3QgYmUgYSBib29sZWFuXCIsXG4gIH0pO1xuXG5leHBvcnQgY29uc3QgY29udGFjdFZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVNZXNzYWdlU2NoZW1hLFxuICBjb250YWN0UXVlcnlTY2hlbWEsXG4gIGNvbnRhY3RQYXJhbXNTY2hlbWEsXG4gIHVwZGF0ZVJlc29sdmVkU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGJvb2tpbmdDb250cm9sbGVyIH0gZnJvbSBcIi4vYm9va2luZy5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBib29raW5nVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9ib29raW5nLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIENyZWF0ZSBib29raW5nIChjdXN0b21lciBvbmx5IFx1MjAxNCBhZ2VudHMgc2VsbCwgYWRtaW5zIG1hbmFnZSlcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBib29raW5nVmFsaWRhdGlvbnMuY3JlYXRlU2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5jcmVhdGVCb29raW5nLFxuKTtcblxuLy8gTXkgYm9va2luZ3MgXHUyMDE0IG93biBib29raW5ncyB3aXRoIGZpbHRlcnMgKyBwYWdpbmF0aW9uIChvd25lciBpcyBhbHdheXMgVVNFUilcbi8vIE5PVEU6IHJlZ2lzdGVyZWQgYmVmb3JlIFwiLzppZFwiIHNvIHRoZSBwYXJhbSByb3V0ZSBkb2Vzbid0IHN3YWxsb3cgaXQuXG5yb3V0ZXIuZ2V0KFxuICBcIi9teS1ib29raW5nc1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1F1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRNeUJvb2tpbmdzLFxuKTtcblxuLy8gQWdlbnQgYm9va2luZ3MgXHUyMDE0IHNjb3BlZCB0byBwYWNrYWdlcyB0aGUgYWdlbnQgb3duc1xucm91dGVyLmdldChcbiAgXCIvYWdlbnQtYm9va2luZ3NcIixcbiAgYXV0aChSb2xlLkFHRU5UKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nU2VhcmNoUXVlcnlTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmdldEFnZW50Qm9va2luZ3MsXG4pO1xuXG4vLyBCb29raW5nIGRldGFpbCBcdTIwMTQgb3duZXIgLyBwYWNrYWdlIGFnZW50IC8gYWRtaW5cbnJvdXRlci5nZXQoXG4gIFwiLzppZFwiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdQYXJhbXNTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmdldEJvb2tpbmdEZXRhaWwsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgYWxsIGJvb2tpbmdzXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nU2VhcmNoUXVlcnlTY2hlbWEgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLmdldEFsbEJvb2tpbmdzLFxuKTtcblxuLy8gU3RhdHVzIHRyYW5zaXRpb24gXHUyMDE0IHZhbGlkYXRlZCBhZ2FpbnN0IHRoZSBzdGF0ZSBtYWNoaW5lIGluIHRoZSBzZXJ2aWNlXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogYm9va2luZ1ZhbGlkYXRpb25zLnVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIGJvb2tpbmdDb250cm9sbGVyLnVwZGF0ZUJvb2tpbmdTdGF0dXMsXG4pO1xuXG5leHBvcnQgY29uc3QgYm9va2luZ1JvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGJvb2tpbmdTZXJ2aWNlIH0gZnJvbSBcIi4vYm9va2luZy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuY29uc3QgY3JlYXRlQm9va2luZyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBib29raW5nID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuY3JlYXRlQm9va2luZyh1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmcgY3JlYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBib29raW5nLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0TXlCb29raW5ncyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBib29raW5nU2VydmljZS5nZXRNeUJvb2tpbmdzKHVzZXJJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldEFnZW50Qm9va2luZ3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0QWdlbnRCb29raW5ncyh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRCb29raW5nRGV0YWlsID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBjb25zdCBib29raW5nID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0Qm9va2luZ0RldGFpbChpZCwgcmVxLnVzZXIhKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5nIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBib29raW5nLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0QWxsQm9va2luZ3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBib29raW5nU2VydmljZS5nZXRBbGxCb29raW5ncyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgdXBkYXRlQm9va2luZ1N0YXR1cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLnVwZGF0ZUJvb2tpbmdTdGF0dXMoXG4gICAgICBpZCxcbiAgICAgIHJlcS5ib2R5LFxuICAgICAgcmVxLnVzZXIhLFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZyBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBib29raW5nLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdDb250cm9sbGVyID0ge1xuICBjcmVhdGVCb29raW5nLFxuICBnZXRNeUJvb2tpbmdzLFxuICBnZXRBZ2VudEJvb2tpbmdzLFxuICBnZXRCb29raW5nRGV0YWlsLFxuICBnZXRBbGxCb29raW5ncyxcbiAgdXBkYXRlQm9va2luZ1N0YXR1cyxcbn07IiwgImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcblxuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnL2luZGV4XCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi91dGlscy9hcHBFcnJvclwiO1xuXG4vLyBQYXltZW50IGlzIGFuIG9wdGlvbmFsIGZlYXR1cmU6IHRoZSBBUEkgbXVzdCBib290IGFuZCBzZXJ2ZSBldmVyeXRoaW5nIGVsc2Vcbi8vIGV2ZW4gd2hlbiB0aGUgU1NMQ29tbWVyeiBzdG9yZSBpc24ndCBjb25maWd1cmVkIHlldC4gVGhlc2UgdGhyb3cgYSBjbGVhbiA0MDBcbi8vIG9uIHRoZSBwYXltZW50LW9ubHkgcGF0aHMgcmF0aGVyIHRoYW4gY3Jhc2ggdGhlIHdob2xlIGRlcGxveW1lbnQgYXQgYm9vdC5cbmNvbnN0IHJlcXVpcmVDb25maWcgPSAoKSA9PiB7XG4gIGlmICghY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX2lkIHx8ICFjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfcGFzc3dvcmQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIlNTTENvbW1lcnogaXMgbm90IGNvbmZpZ3VyZWQuIFNldCBTU0xfQ09NTUVSWl9TVE9SRV9JRCBhbmQgU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQuXCIsXG4gICAgKTtcbiAgfVxuICBpZiAoIWNvbmZpZy5iYWNrZW5kX3B1YmxpY191cmwpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIlNTTENvbW1lcnogaXMgbm90IGNvbmZpZ3VyZWQuIFNldCBCQUNLRU5EX1BVQkxJQ19VUkwgdG8gdGhlIHB1YmxpY2x5IHJlYWNoYWJsZSBiYWNrZW5kIFVSTC5cIixcbiAgICApO1xuICB9XG4gIHJldHVybiB7XG4gICAgc3RvcmVJZDogY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX2lkLFxuICAgIHN0b3JlUGFzc3dvcmQ6IGNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9wYXNzd29yZCxcbiAgfTtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3NsY29tbWVyekluaXRSZXN1bHQge1xuICBzdGF0dXM6IHN0cmluZztcbiAgZmFpbGVkcmVhc29uPzogc3RyaW5nO1xuICBzZXNzaW9ua2V5Pzogc3RyaW5nO1xuICBHYXRld2F5UGFnZVVSTD86IHN0cmluZztcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHtcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGVycm9yPzogc3RyaW5nO1xuICB2YWxfaWQ/OiBzdHJpbmc7XG4gIGFtb3VudD86IHN0cmluZztcbiAgY3VycmVuY3k/OiBzdHJpbmc7XG4gIGJhbmtfdHJhbl9pZD86IHN0cmluZztcbiAgY2FyZF90eXBlPzogc3RyaW5nO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3NsY29tbWVyelJlZnVuZFJlc3VsdCB7XG4gIEFQSUNvbm5lY3Q/OiBzdHJpbmc7XG4gIHN0YXR1cz86IHN0cmluZzsgLy8gc3VjY2VzcyB8IGZhaWxlZCB8IHByb2Nlc3NpbmdcbiAgZXJyb3JSZWFzb24/OiBzdHJpbmc7XG4gIHJlZnVuZF9yZWZfaWQ/OiBzdHJpbmc7XG4gIGJhbmtfdHJhbl9pZD86IHN0cmluZztcbiAgdHJhbnNfaWQ/OiBzdHJpbmc7XG4gIFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuLy8gU1NMQ29tbWVyeiB0cnVuY2F0ZXMgdHJhbl9pZCB0byAzMCBjaGFycyBcdTIwMTQgZGF0ZSArIHRpbWUgKyByYW5kb20gc2FsdCBzdGF5cyBzYWZlbHkgdW5kZXIuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVUcmFuSWQoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGBUUk5YX0lELSR7RGF0ZS5ub3coKX0tJHtyYW5kb21VVUlEKCkucmVwbGFjZSgvLS9nLCBcIlwiKS5zbGljZSgwLCA4KX1gO1xufVxuXG4vLyBJbml0aWF0ZXMgYSBnYXRld2F5IHNlc3Npb24uIFNlcnZlci10by1zZXJ2ZXIgUE9TVCwgZm9ybS1lbmNvZGVkLiBUaGUgZ2F0ZXdheVxuLy8gcmVzcG9uZHMgd2l0aCB0aGUgaG9zdGVkIGNoZWNrb3V0IFVSTCAoR2F0ZXdheVBhZ2VVUkwpIHRoZSBjdXN0b21lciBpcyBzZW50IHRvLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpJbml0KG9wdGlvbnM6IHtcbiAgdG90YWxfYW1vdW50OiBudW1iZXI7XG4gIHRyYW5faWQ6IHN0cmluZztcbiAgc3VjY2Vzc191cmw6IHN0cmluZztcbiAgZmFpbF91cmw6IHN0cmluZztcbiAgY2FuY2VsX3VybDogc3RyaW5nO1xuICBpcG5fdXJsOiBzdHJpbmc7XG4gIGN1c19uYW1lOiBzdHJpbmc7XG4gIGN1c19lbWFpbDogc3RyaW5nO1xuICBjdXNfcGhvbmU6IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpJbml0UmVzdWx0PiB7XG4gIGNvbnN0IHsgc3RvcmVJZCwgc3RvcmVQYXNzd29yZCB9ID0gcmVxdWlyZUNvbmZpZygpO1xuICBjb25zdCBib2R5ID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIHRvdGFsX2Ftb3VudDogb3B0aW9ucy50b3RhbF9hbW91bnQudG9GaXhlZCgyKSxcbiAgICBjdXJyZW5jeTogXCJCRFRcIixcbiAgICB0cmFuX2lkOiBvcHRpb25zLnRyYW5faWQsXG4gICAgc3VjY2Vzc191cmw6IG9wdGlvbnMuc3VjY2Vzc191cmwsXG4gICAgZmFpbF91cmw6IG9wdGlvbnMuZmFpbF91cmwsXG4gICAgY2FuY2VsX3VybDogb3B0aW9ucy5jYW5jZWxfdXJsLFxuICAgIGlwbl91cmw6IG9wdGlvbnMuaXBuX3VybCxcbiAgICBjdXNfbmFtZTogb3B0aW9ucy5jdXNfbmFtZSxcbiAgICBjdXNfZW1haWw6IG9wdGlvbnMuY3VzX2VtYWlsLFxuICAgIGN1c19hZGQxOiBcIk4vQVwiLFxuICAgIGN1c19hZGQyOiBcIk4vQVwiLFxuICAgIGN1c19jaXR5OiBcIk4vQVwiLFxuICAgIGN1c19zdGF0ZTogXCJOL0FcIixcbiAgICBjdXNfcG9zdGNvZGU6IFwiMTAwMFwiLFxuICAgIGN1c19jb3VudHJ5OiBcIkJhbmdsYWRlc2hcIixcbiAgICBjdXNfcGhvbmU6IG9wdGlvbnMuY3VzX3Bob25lLFxuICAgIHByb2R1Y3RfbmFtZTogXCJUcmlwVmVyc2UgVG91ciBCb29raW5nXCIsXG4gICAgc2hpcHBpbmdfbWV0aG9kOiBcIk5PXCIsXG4gIH0pO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGNvbmZpZy5zc2xjb21tZXJ6X2luaXRfdXJsLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCIgfSxcbiAgICBib2R5OiBib2R5LnRvU3RyaW5nKCksXG4gIH0pO1xuXG4gIGNvbnN0IHRleHQgPSBhd2FpdCByZXMudGV4dCgpO1xuICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgYFNTTENvbW1lcnogaW5pdCBmYWlsZWQgKCR7cmVzLnN0YXR1c30pYCk7XG5cbiAgbGV0IGRhdGE6IFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB0cnkge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKHRleHQpIGFzIFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBcIlNTTENvbW1lcnogaW5pdCByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlXCIpO1xuICB9XG5cbiAgLy8gVGhlIGdhdGV3YXkgcmVwb3J0cyBzdGF0dXMgaW4gVVBQRVJDQVNFIChcIlNVQ0NFU1NcIiAvIFwiRkFJTEVEXCIpOyBhbnkgb3RoZXJcbiAgLy8gc3RhdHVzLCBvciBhIHN1Y2Nlc3Mgd2l0aG91dCB0aGUgaG9zdGVkIGNoZWNrb3V0IFVSTCwgaXMgYSBmYWlsZWQgaW5pdC5cbiAgaWYgKGRhdGEuc3RhdHVzICE9PSBcIlNVQ0NFU1NcIiB8fCAhZGF0YS5HYXRld2F5UGFnZVVSTCkge1xuICAgIGNvbnN0IHJlYXNvbiA9IGRhdGEuZmFpbGVkcmVhc29uIHx8IGRhdGEuc3RhdHVzIHx8IFwidW5rbm93blwiO1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBgW3NzbGNvbW1lcnpdIGluaXQgcmVqZWN0ZWQgKHVybD0ke2NvbmZpZy5zc2xjb21tZXJ6X2luaXRfdXJsfSwgc2FuZGJveD0ke2NvbmZpZy5zc2xfY29tbWVyel9zYW5kYm94fSk6ICR7cmVhc29ufWAsXG4gICAgICBkYXRhLFxuICAgICk7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNTAyLFxuICAgICAgYFNTTENvbW1lcnogaW5pdCByZWplY3RlZDogJHtyZWFzb259LiBDaGVjayBTU0xfQ09NTUVSWl9TVE9SRV9JRCwgU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQsIFNTTF9DT01NRVJaX1NBTkRCT1ggYW5kIFNTTENPTU1FUlpfSU5JVF9VUkwgKHNlZSBzZXJ2ZXIgbG9ncykuYCxcbiAgICApO1xuICB9XG4gIHJldHVybiBkYXRhO1xufVxuXG4vLyBTZXJ2ZXItc2lkZSB2ZXJpZmljYXRpb24gb2YgYSBjb21wbGV0ZWQgdHJhbnNhY3Rpb24uIHN0YXR1czogVkFMSUQgLyBWQUxJREFURUQgL1xuLy8gSU5WQUxJRF9UUkFOU0FDVElPTiAvIEZBSUxFRC4gVkFMSURBVEVEIG1lYW5zIHRoZSB0cmFuc2FjdGlvbiB3YXMgdmVyaWZpZWQgYmVmb3JlXG4vLyAoaWRlbXBvdGVudCksIElOVkFMSURfVFJBTlNBQ1RJT04gbWVhbnMgdGhlIGFtb3VudC90cmFuc2FjdGlvbiBtaXNtYXRjaGVzLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpWYWxpZGF0ZShvcHRpb25zOiB7XG4gIHZhbF9pZDogc3RyaW5nO1xufSk6IFByb21pc2U8U3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ+IHtcbiAgY29uc3QgeyBzdG9yZUlkLCBzdG9yZVBhc3N3b3JkIH0gPSByZXF1aXJlQ29uZmlnKCk7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHZhbF9pZDogb3B0aW9ucy52YWxfaWQsXG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIGZvcm1hdDogXCJqc29uXCIsXG4gIH0pO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2NvbmZpZy5zc2xjb21tZXJ6X3ZhbGlkYXRlX3VybH0/JHtwYXJhbXMudG9TdHJpbmcoKX1gLCB7XG4gICAgbWV0aG9kOiBcIkdFVFwiLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IHZhbGlkYXRpb24gZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IHZhbGlkYXRpb24gcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn1cblxuLy8gSW5pdGlhdGVzIGEgcmVmdW5kIGFnYWluc3QgYSBzZXR0bGVkIHRyYW5zYWN0aW9uLiBiYW5rX3RyYW5faWQgaXMgdGhlXG4vLyBvcmlnaW5hbCB0cmFuc2FjdGlvbidzIGJhbmsgdHJhbnNhY3Rpb24gSUQgY2FwdHVyZWQgYXQgcGF5bWVudCB0aW1lLlxuLy8gc3RhdHVzOiBzdWNjZXNzIChpbml0aWF0ZWQpIHwgZmFpbGVkIHwgcHJvY2Vzc2luZyAoYWxyZWFkeSBpbml0aWF0ZWQpLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpSZWZ1bmQob3B0aW9uczoge1xuICBiYW5rX3RyYW5faWQ6IHN0cmluZztcbiAgcmVmdW5kX2Ftb3VudDogbnVtYmVyO1xuICByZWZ1bmRfcmVtYXJrczogc3RyaW5nO1xuICByZWZlX2lkPzogc3RyaW5nO1xufSk6IFByb21pc2U8U3NsY29tbWVyelJlZnVuZFJlc3VsdD4ge1xuICBjb25zdCB7IHN0b3JlSWQsIHN0b3JlUGFzc3dvcmQgfSA9IHJlcXVpcmVDb25maWcoKTtcbiAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgYmFua190cmFuX2lkOiBvcHRpb25zLmJhbmtfdHJhbl9pZCxcbiAgICBzdG9yZV9pZDogc3RvcmVJZCxcbiAgICBzdG9yZV9wYXNzd2Q6IHN0b3JlUGFzc3dvcmQsXG4gICAgcmVmdW5kX2Ftb3VudDogb3B0aW9ucy5yZWZ1bmRfYW1vdW50LnRvRml4ZWQoMiksXG4gICAgcmVmdW5kX3JlbWFya3M6IG9wdGlvbnMucmVmdW5kX3JlbWFya3MsXG4gICAgZm9ybWF0OiBcImpzb25cIixcbiAgICB2OiBcIjFcIixcbiAgfSk7XG4gIGlmIChvcHRpb25zLnJlZmVfaWQpIHBhcmFtcy5zZXQoXCJyZWZlX2lkXCIsIG9wdGlvbnMucmVmZV9pZCk7XG5cbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYCR7Y29uZmlnLnNzbGNvbW1lcnpfcmVmdW5kX3VybH0/JHtwYXJhbXMudG9TdHJpbmcoKX1gLCB7XG4gICAgbWV0aG9kOiBcIkdFVFwiLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IHJlZnVuZCBmYWlsZWQgKCR7cmVzLnN0YXR1c30pYCk7XG5cbiAgbGV0IGRhdGE6IFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ7XG4gIHRyeSB7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UodGV4dCkgYXMgU3NsY29tbWVyelJlZnVuZFJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IHJlZnVuZCByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlXCIpO1xuICB9XG4gIHJldHVybiBkYXRhO1xufSIsICJpbXBvcnQgeyBOb3RpZmljYXRpb25UeXBlIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi9saWIvcHJpc21hXCI7XG5cbi8vIEJlc3QtZWZmb3J0IGluLWFwcCBub3RpZmljYXRpb24gXHUyMDE0IG1pcnJvcnMgdGhlIGVtYWlsIGhlbHBlcnMuIEEgZmFpbHVyZSBpc1xuLy8gbG9nZ2VkIGFuZCBzd2FsbG93ZWQsIG5ldmVyIHRocm93biwgc28gYSBub3RpZmljYXRpb24gaW5zZXJ0IGNhbid0IGZhaWwgdGhlXG4vLyBidXNpbmVzcyB3cml0ZSB0aGF0IGNhdXNlZCBpdC4gQ2FsbCBzaXRlcyBmaXJlIGl0IGFzXG4vLyBgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW25vdGlmeSguLi4pXSlgLlxuZXhwb3J0IGNvbnN0IG5vdGlmeSA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHR5cGU6IE5vdGlmaWNhdGlvblR5cGUsXG4gIHRpdGxlOiBzdHJpbmcsXG4gIG1lc3NhZ2U6IHN0cmluZyxcbiAgbGluaz86IHN0cmluZyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICB0cnkge1xuICAgIGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24uY3JlYXRlKHtcbiAgICAgIGRhdGE6IHsgdXNlcklkLCB0eXBlLCB0aXRsZSwgbWVzc2FnZSwgbGluayB9LFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBgW25vdGlmaWNhdGlvbl0gZmFpbGVkIHRvIGNyZWF0ZSAke3R5cGV9IGZvciB1c2VyICR7dXNlcklkfTogJHtcbiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpXG4gICAgICB9YCxcbiAgICApO1xuICB9XG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMsIE5vdGlmaWNhdGlvblR5cGUsIFBhY2thZ2VTdGF0dXMsIFBheW1lbnRTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzc2xjb21tZXJ6UmVmdW5kIH0gZnJvbSBcIi4uLy4uL2xpYi9zc2xjb21tZXJ6XCI7XG5pbXBvcnQgeyBzZW5kQm9va2luZ0VtYWlsLCBzZW5kUmVmdW5kRW1haWwgfSBmcm9tIFwiLi4vLi4vdXRpbHMvZW1haWxcIjtcbmltcG9ydCB7IG5vdGlmeSB9IGZyb20gXCIuLi8uLi91dGlscy9ub3RpZmljYXRpb25cIjtcbmltcG9ydCB7XG4gIElCb29raW5nUXVlcnksXG4gIElCb29raW5nU2VhcmNoUXVlcnksXG4gIElDcmVhdGVCb29raW5nLFxuICBJVXBkYXRlQm9va2luZ1N0YXR1cyxcbn0gZnJvbSBcIi4vYm9va2luZy5pbnRlcmZhY2VcIjtcblxuLy8gQSBQRU5ESU5HIGJvb2tpbmcgb2xkZXIgdGhhbiB0aGlzIGlzIHRyZWF0ZWQgYXMgYW4gYWJhbmRvbmVkIGNoZWNrb3V0OlxuLy8gaXQncyBhdXRvLWNhbmNlbGxlZCBzbyB0aGUgdXNlciBjYW4gcmVib29rIHRoZSBzYW1lIHBhY2thZ2UrZGF0ZS5cbmNvbnN0IFNUQUxFX0JPT0tJTkdfSE9VUlMgPSAyNDtcblxuY29uc3QgdG9VVENNaWRuaWdodCA9IChkYXRlOiBEYXRlKSA9PlxuICBuZXcgRGF0ZShcbiAgICBEYXRlLlVUQyhkYXRlLmdldFVUQ0Z1bGxZZWFyKCksIGRhdGUuZ2V0VVRDTW9udGgoKSwgZGF0ZS5nZXRVVENEYXRlKCkpLFxuICApO1xuXG4vLyBcdTI1MDBcdTI1MDAgQWN0b3IgKyBvd25lcnNoaXAgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG50eXBlIEJvb2tpbmdBY3RvciA9IHsgaWQ6IHN0cmluZzsgcm9sZTogUm9sZSB9O1xuXG4vLyBTdHJ1Y3R1cmFsIHN1YnNldCBcdTIwMTQgb25seSB3aGF0IHRoZSBvd25lcnNoaXAgY2hlY2tzIG5lZWQuXG50eXBlIEJvb2tpbmdPd25lckluZm8gPSB7XG4gIHVzZXJJZDogc3RyaW5nO1xuICBwYWNrYWdlOiB7IGFnZW50SWQ6IHN0cmluZyB9O1xufTtcblxuLy8gQm9va2luZyBvd25lciwgdGhlIEFHRU5UIHdobyBvd25zIHRoZSBwYWNrYWdlLCBvciBBRE1JTiBcdTIwMTQgZnVsbCBtYW5hZ2Ugc2NvcGUuXG5jb25zdCBjYW5NYW5hZ2UgPSAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT5cbiAgYm9va2luZy51c2VySWQgPT09IGFjdG9yLmlkIHx8XG4gIChhY3Rvci5yb2xlID09PSBSb2xlLkFHRU5UICYmIGJvb2tpbmcucGFja2FnZS5hZ2VudElkID09PSBhY3Rvci5pZCkgfHxcbiAgYWN0b3Iucm9sZSA9PT0gUm9sZS5BRE1JTjtcblxuLy8gT25seSB0aGUgcGFja2FnZS1vd25pbmcgQUdFTlQgb3IgQURNSU4gY2FuIG1vdmUgYSBib29raW5nJ3MgbW9uZXkgc3RhdHVzXG4vLyAoUEVORElOR1x1MjE5MkNPTkZJUk1FRCwgQ09ORklSTUVEXHUyMTkyQ09NUExFVEVELCBDT05GSVJNRURcdTIxOTJQRU5ESU5HKS5cbmNvbnN0IGlzQWdlbnRPd25lck9yQWRtaW4gPSAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT5cbiAgYWN0b3Iucm9sZSA9PT0gUm9sZS5BRE1JTiB8fFxuICAoYWN0b3Iucm9sZSA9PT0gUm9sZS5BR0VOVCAmJiBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWQpO1xuXG4vLyBcdTI1MDBcdTI1MDAgU3RhdGUgbWFjaGluZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbnR5cGUgVHJhbnNpdGlvblJ1bGUgPSB7XG4gIGFsbG93ZWQ6IChib29raW5nOiBCb29raW5nT3duZXJJbmZvLCBhY3RvcjogQm9va2luZ0FjdG9yKSA9PiBib29sZWFuO1xuICByZXF1aXJlc1RyYXZlbERhdGVQYXNzZWQ/OiBib29sZWFuO1xuICBiZWZvcmVUcmF2ZWxEYXRlPzogYm9vbGVhbjtcbn07XG5cbmNvbnN0IFRSQU5TSVRJT05TOiBQYXJ0aWFsPFxuICBSZWNvcmQ8Qm9va2luZ1N0YXR1cywgUGFydGlhbDxSZWNvcmQ8Qm9va2luZ1N0YXR1cywgVHJhbnNpdGlvblJ1bGU+Pj5cbj4gPSB7XG4gIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXTogeyBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXTogeyBhbGxvd2VkOiBjYW5NYW5hZ2UgfSxcbiAgfSxcbiAgW0Jvb2tpbmdTdGF0dXMuUEFJRF06IHtcbiAgICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7IGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4gfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7IGFsbG93ZWQ6IGNhbk1hbmFnZSB9LFxuICB9LFxuICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09NUExFVEVEXToge1xuICAgICAgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbixcbiAgICAgIHJlcXVpcmVzVHJhdmVsRGF0ZVBhc3NlZDogdHJ1ZSxcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHsgYWxsb3dlZDogY2FuTWFuYWdlIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuUEVORElOR106IHtcbiAgICAgIGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4sXG4gICAgICBiZWZvcmVUcmF2ZWxEYXRlOiB0cnVlLFxuICAgIH0sXG4gIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVzcG9uc2UgbWFwcGluZyAoRGVjaW1hbCBcdTIxOTIgTnVtYmVyKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGJvb2tpbmdQYWNrYWdlU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0aXRsZTogdHJ1ZSxcbiAgICBzbHVnOiB0cnVlLFxuICAgIGxvY2F0aW9uOiB0cnVlLFxuICAgIGltYWdlczogdHJ1ZSxcbiAgICBwcmljZTogdHJ1ZSxcbiAgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIERldGFpbCB2aWV3IGFkZHMgYWdlbnRJZCAobmVlZGVkIGJ5IG93bmVyc2hpcCBjaGVja3MgaW4gdGhlIHNlcnZpY2UpLlxuY29uc3QgYm9va2luZ1BhY2thZ2VEZXRhaWxTZWxlY3QgPSB7XG4gIHNlbGVjdDoge1xuICAgIGlkOiB0cnVlLFxuICAgIHRpdGxlOiB0cnVlLFxuICAgIHNsdWc6IHRydWUsXG4gICAgbG9jYXRpb246IHRydWUsXG4gICAgaW1hZ2VzOiB0cnVlLFxuICAgIHByaWNlOiB0cnVlLFxuICAgIGFnZW50SWQ6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG5jb25zdCBib29raW5nVXNlclNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9LFxufSBhcyBjb25zdDtcblxuLy8gUGF5bWVudCBsZWRnZXIgc2hvd24gb24gdGhlIGJvb2tpbmcgZGV0YWlsIHBhZ2UgKGFtb3VudHMgc3RheSBEZWNpbWFsIGluIERCKS5cbmNvbnN0IGJvb2tpbmdQYXltZW50U2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0cmFuSWQ6IHRydWUsXG4gICAgYW1vdW50OiB0cnVlLFxuICAgIGN1cnJlbmN5OiB0cnVlLFxuICAgIHN0YXR1czogdHJ1ZSxcbiAgICBjYXJkVHlwZTogdHJ1ZSxcbiAgICBiYW5rVHJhbklkOiB0cnVlLFxuICAgIHZhbElkOiB0cnVlLFxuICAgIHBhaWRBdDogdHJ1ZSxcbiAgICByZWZ1bmRSZWZJZDogdHJ1ZSxcbiAgICByZWZ1bmRlZEF0OiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxuLy8gUGF5bWVudHMgb3JkZXJlZCBuZXdlc3QtZmlyc3Qgc28gY29uc3VtZXJzIGNhbiByZWx5IG9uIHBheW1lbnRzWzBdIGJlaW5nIHRoZVxuLy8gbGF0ZXN0IGF0dGVtcHQgKHVzZWQgZm9yIHRoZSB1c2VyIHBheW1lbnQtaGlzdG9yeSBcImxhdGVzdCBzdGF0dXNcIiByb3cpLlxuY29uc3QgYm9va2luZ1BheW1lbnRzSW5jbHVkZSA9IHtcbiAgLi4uYm9va2luZ1BheW1lbnRTZWxlY3QsXG4gIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiBhcyBjb25zdCB9LFxufSBhcyBjb25zdDtcblxudHlwZSBCb29raW5nV2l0UGFja2FnZSA9IFByaXNtYS5Cb29raW5nR2V0UGF5bG9hZDx7XG4gIGluY2x1ZGU6IHsgcGFja2FnZTogdHlwZW9mIGJvb2tpbmdQYWNrYWdlU2VsZWN0IH07XG59PjtcblxuLy8gUGF5bWVudHMgc2hvdyBvbiBsaXN0IHJvd3MgdG9vIChEb0Q6IFwibGlzdC9kZXRhaWwgbm93IGluY2x1ZGVzIHBheW1lbnRzXCIpLFxuLy8gbWFwcGVkIHRvIE51bWJlciBhdCB0aGUgYm91bmRhcnkgbGlrZSB0aGUgcmVzdCBvZiB0aGUgbW9uZXkgZmllbGRzLlxudHlwZSBCb29raW5nUGF5bWVudEl0ZW0gPSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRyYW5JZDogc3RyaW5nO1xuICBhbW91bnQ6IHVua25vd247XG4gIGN1cnJlbmN5OiBzdHJpbmc7XG4gIHN0YXR1czogc3RyaW5nO1xuICBjYXJkVHlwZTogc3RyaW5nIHwgbnVsbDtcbiAgYmFua1RyYW5JZDogc3RyaW5nIHwgbnVsbDtcbiAgdmFsSWQ6IHN0cmluZyB8IG51bGw7XG4gIHBhaWRBdDogRGF0ZSB8IG51bGw7XG59O1xuXG5jb25zdCBtYXBCb29raW5nTGlzdCA9IChib29raW5nOiBCb29raW5nV2l0UGFja2FnZSAmIHsgcGF5bWVudHM/OiBCb29raW5nUGF5bWVudEl0ZW1bXSB9KSA9PiAoe1xuICAuLi5ib29raW5nLFxuICB0b3RhbFByaWNlOiBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKSxcbiAgcGFja2FnZTogeyAuLi5ib29raW5nLnBhY2thZ2UsIHByaWNlOiBOdW1iZXIoYm9va2luZy5wYWNrYWdlLnByaWNlKSB9LFxuICBwYXltZW50czogYm9va2luZy5wYXltZW50cz8ubWFwKChwKSA9PiAoeyAuLi5wLCBhbW91bnQ6IE51bWJlcihwLmFtb3VudCkgfSkpLFxufSk7XG5cbi8vIFx1MjUwMFx1MjUwMCBDcmVhdGUgYm9va2luZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNyZWF0ZUJvb2tpbmcgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHBheWxvYWQ6IElDcmVhdGVCb29raW5nKSA9PiB7XG4gIGNvbnN0IHsgcGFja2FnZUlkLCB0cmF2ZWxlcnMgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IHRyYXZlbERhdGUgPSB0b1VUQ01pZG5pZ2h0KHBheWxvYWQudHJhdmVsRGF0ZSk7XG5cbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICB9KTtcbiAgaWYgKFxuICAgICF0b3VyUGFja2FnZSB8fFxuICAgIHRvdXJQYWNrYWdlLmlzRGVsZXRlZCB8fFxuICAgIHRvdXJQYWNrYWdlLnN0YXR1cyAhPT0gUGFja2FnZVN0YXR1cy5BUFBST1ZFRFxuICApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIlBhY2thZ2UgaXMgbm90IGF2YWlsYWJsZSBmb3IgYm9va2luZy5cIik7XG4gIH1cblxuICAvLyB0b3RhbFByaWNlIGlzIGNvbXB1dGVkIHNlcnZlci1zaWRlIGZyb20gdGhlIHBhY2thZ2UncyBjdXJyZW50IHByaWNlIFx1MjAxNFxuICAvLyBhbnl0aGluZyB0aGUgY2xpZW50IHNlbmRzIGlzIGlnbm9yZWQuXG4gIGNvbnN0IHRvdGFsUHJpY2UgPSBOdW1iZXIodG91clBhY2thZ2UucHJpY2UpICogdHJhdmVsZXJzO1xuXG4gIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgdHguYm9va2luZy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBwYWNrYWdlSWQsXG4gICAgICAgIHRyYXZlbERhdGUsXG4gICAgICAgIHN0YXR1czogQm9va2luZ1N0YXR1cy5QRU5ESU5HLFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgIH0pO1xuXG4gICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICBjb25zdCBpc1JlY2VudCA9XG4gICAgICAgIGV4aXN0aW5nLmNyZWF0ZWRBdC5nZXRUaW1lKCkgPj1cbiAgICAgICAgRGF0ZS5ub3coKSAtIFNUQUxFX0JPT0tJTkdfSE9VUlMgKiA2MCAqIDYwICogMTAwMDtcblxuICAgICAgaWYgKGlzUmVjZW50KSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgICA0MDksXG4gICAgICAgICAgXCJZb3UgYWxyZWFkeSBoYXZlIGEgcGVuZGluZyBib29raW5nIGZvciB0aGlzIHBhY2thZ2Ugb24gdGhpcyBkYXRlLlwiLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBhYmFuZG9uZWQgY2hlY2tvdXQgXHUyMDE0IGNhbmNlbCBpdCBpbiB0aGUgc2FtZSB0cmFuc2FjdGlvbiBhbmQgcmVib29rXG4gICAgICBhd2FpdCB0eC5ib29raW5nLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiBleGlzdGluZy5pZCB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB0eC5ib29raW5nLmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7IHVzZXJJZCwgcGFja2FnZUlkLCB0cmF2ZWxEYXRlLCB0cmF2ZWxlcnMsIHRvdGFsUHJpY2UgfSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gYmVzdC1lZmZvcnQgZW1haWwgXHUyMDE0IG5ldmVyIGZhaWxzIHRoZSByZXF1ZXN0XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0sXG4gIH0pO1xuICBpZiAodXNlcikge1xuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgICAgbmFtZTogdXNlci5uYW1lLFxuICAgICAgICBwYWNrYWdlVGl0bGU6IHRvdXJQYWNrYWdlLnRpdGxlLFxuICAgICAgICB0cmF2ZWxEYXRlLFxuICAgICAgICB0cmF2ZWxlcnMsXG4gICAgICAgIHRvdGFsUHJpY2UsXG4gICAgICAgIHN0YXR1czogQm9va2luZ1N0YXR1cy5QRU5ESU5HLFxuICAgICAgfSksXG4gICAgXSk7XG4gIH1cblxuICAvLyBiZXN0LWVmZm9ydCBpbi1hcHAgbm90aWZpY2F0aW9uIHRvIHRoZSBwYWNrYWdlIGFnZW50IChuZXZlciBmYWlscyByZXF1ZXN0KVxuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgbm90aWZ5KFxuICAgICAgdG91clBhY2thZ2UuYWdlbnRJZCxcbiAgICAgIE5vdGlmaWNhdGlvblR5cGUuQk9PS0lOR19DUkVBVEVELFxuICAgICAgXCJOZXcgYm9va2luZyByZWNlaXZlZFwiLFxuICAgICAgYEEgbmV3IGJvb2tpbmcgaGFzIGJlZW4gcGxhY2VkIGZvciBcIiR7dG91clBhY2thZ2UudGl0bGV9XCIuYCxcbiAgICAgIGAvZGFzaGJvYXJkL2FnZW50L2Jvb2tpbmdzLyR7Y3JlYXRlZC5pZH1gLFxuICAgICksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgLi4uY3JlYXRlZCxcbiAgICB0b3RhbFByaWNlOiBOdW1iZXIoY3JlYXRlZC50b3RhbFByaWNlKSxcbiAgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBMaXN0IGhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBwYWdpbmF0ZUJvb2tpbmcgPSBhc3luYyAoXG4gIHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQsXG4gIGluY2x1ZGU6IFByaXNtYS5Cb29raW5nSW5jbHVkZSxcbiAgcXVlcnk6IElCb29raW5nUXVlcnksXG4pID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgfHwgMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCB8fCAxMDtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ib29raW5nLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZSxcbiAgICAgIHNraXA6IChwYWdlIC0gMSkgKiBsaW1pdCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgfSksXG4gICAgcHJpc21hLmJvb2tpbmcuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTXkgYm9va2luZ3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRNeUJvb2tpbmdzID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBxdWVyeTogSUJvb2tpbmdRdWVyeSkgPT4ge1xuICBjb25zdCB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0geyB1c2VySWQgfTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhZ2luYXRlQm9va2luZyhcbiAgICB3aGVyZSxcbiAgICB7IHBhY2thZ2U6IGJvb2tpbmdQYWNrYWdlU2VsZWN0LCBwYXltZW50czogYm9va2luZ1BheW1lbnRzSW5jbHVkZSB9LFxuICAgIHF1ZXJ5LFxuICApO1xuICByZXR1cm4geyAuLi5yZXN1bHQsIGRhdGE6IHJlc3VsdC5kYXRhLm1hcChtYXBCb29raW5nTGlzdCkgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZ2VudCBib29raW5ncyAoc2NvcGVkIHRvIG93biBwYWNrYWdlcykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRBZ2VudEJvb2tpbmdzID0gYXN5bmMgKFxuICBhZ2VudElkOiBzdHJpbmcsXG4gIHF1ZXJ5OiBJQm9va2luZ1NlYXJjaFF1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7XG4gICAgcGFja2FnZTogeyBhZ2VudElkIH0sXG4gIH07XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIHdoZXJlLnBhY2thZ2UgPSB7XG4gICAgICBhZ2VudElkLFxuICAgICAgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0sXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhZ2luYXRlQm9va2luZyhcbiAgICB3aGVyZSxcbiAgICB7IHBhY2thZ2U6IGJvb2tpbmdQYWNrYWdlU2VsZWN0LCBwYXltZW50czogYm9va2luZ1BheW1lbnRzSW5jbHVkZSB9LFxuICAgIHF1ZXJ5LFxuICApO1xuICByZXR1cm4geyAuLi5yZXN1bHQsIGRhdGE6IHJlc3VsdC5kYXRhLm1hcChtYXBCb29raW5nTGlzdCkgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogYWxsIGJvb2tpbmdzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0QWxsQm9va2luZ3MgPSBhc3luYyAocXVlcnk6IElCb29raW5nU2VhcmNoUXVlcnkpID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHt9O1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICB3aGVyZS5wYWNrYWdlID0geyB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9O1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHtcbiAgICAgIHBhY2thZ2U6IGJvb2tpbmdQYWNrYWdlU2VsZWN0LFxuICAgICAgdXNlcjogYm9va2luZ1VzZXJTZWxlY3QsXG4gICAgICBwYXltZW50czogYm9va2luZ1BheW1lbnRzSW5jbHVkZSxcbiAgICB9LFxuICAgIHF1ZXJ5LFxuICApO1xuICByZXR1cm4geyAuLi5yZXN1bHQsIGRhdGE6IHJlc3VsdC5kYXRhLm1hcChtYXBCb29raW5nTGlzdCkgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBCb29raW5nIGRldGFpbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldEJvb2tpbmdEZXRhaWwgPSBhc3luYyAoaWQ6IHN0cmluZywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT4ge1xuICBjb25zdCBib29raW5nID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBwYWNrYWdlOiBib29raW5nUGFja2FnZURldGFpbFNlbGVjdCxcbiAgICAgIHVzZXI6IGJvb2tpbmdVc2VyU2VsZWN0LFxuICAgICAgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUsXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKCFib29raW5nKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJCb29raW5nIG5vdCBmb3VuZC5cIik7XG4gIH1cbiAgaWYgKCFjYW5NYW5hZ2UoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHZpZXcgdGhpcyBib29raW5nLlwiKTtcbiAgfVxuXG4gIHJldHVybiBtYXBCb29raW5nTGlzdChib29raW5nKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZWZ1bmQgKGJvb2tpbmcgY2FuY2VsbGVkIHdpdGggc2V0dGxlZCBtb25leSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBSdW5zIEFGVEVSIHRoZSBzdGF0dXMtdHJhbnNpdGlvbiB0cmFuc2FjdGlvbiBjb21taXRzLCBzbyBhIGdhdGV3YXkgZmFpbHVyZSBjYW5cbi8vIG5ldmVyIHJvbGwgYmFjayB0aGUgY2FuY2VsbGF0aW9uIGl0c2VsZi4gRWFjaCBzZXR0bGVkIHBheW1lbnQgaXMgcmVmdW5kZWQgdmlhXG4vLyB0aGUgU1NMQ29tbWVyeiBSZWZ1bmQgQVBJIGFuZCBpdHMgbGVkZ2VyIHJvdyBzdG9yZXMgdGhlIGdhdGV3YXkgcmVmZXJlbmNlLlxudHlwZSBSZWZ1bmRDb250ZXh0ID0ge1xuICBlbWFpbDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHBhY2thZ2VUaXRsZTogc3RyaW5nO1xuICB0cmF2ZWxEYXRlOiBEYXRlO1xufTtcblxuY29uc3QgaXNzdWVSZWZ1bmRzID0gYXN5bmMgKFxuICBib29raW5nSWQ6IHN0cmluZyxcbiAgY3R4OiBSZWZ1bmRDb250ZXh0LFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgcGF5bWVudHMgPSBhd2FpdCBwcmlzbWEucGF5bWVudC5maW5kTWFueSh7XG4gICAgICB3aGVyZTogeyBib29raW5nSWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5SRUZVTkRFRCB9LFxuICAgIH0pO1xuICAgIGlmIChwYXltZW50cy5sZW5ndGggPT09IDApIHJldHVybjtcblxuICAgIGNvbnN0IHJlZnVuZFJlZnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgb3V0Y29tZXMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoXG4gICAgICBwYXltZW50cy5tYXAoYXN5bmMgKHBheW1lbnQpID0+IHtcbiAgICAgICAgaWYgKCFwYXltZW50LmJhbmtUcmFuSWQpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgYFtyZWZ1bmRdIHBheW1lbnQgJHtwYXltZW50LmlkfSBoYXMgbm8gYmFua190cmFuX2lkOyBnYXRld2F5IHJlZnVuZCBza2lwcGVkLmAsXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZ2F0ZXdheSA9IGF3YWl0IHNzbGNvbW1lcnpSZWZ1bmQoe1xuICAgICAgICAgIGJhbmtfdHJhbl9pZDogcGF5bWVudC5iYW5rVHJhbklkLFxuICAgICAgICAgIHJlZnVuZF9hbW91bnQ6IE51bWJlcihwYXltZW50LmFtb3VudCksXG4gICAgICAgICAgcmVmdW5kX3JlbWFya3M6IGBCb29raW5nICR7Ym9va2luZ0lkfSBjYW5jZWxsZWQgLSBUcmlwVmVyc2VgLFxuICAgICAgICAgIHJlZmVfaWQ6IGJvb2tpbmdJZCxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChnYXRld2F5LnN0YXR1cyA9PT0gXCJzdWNjZXNzXCIgJiYgZ2F0ZXdheS5yZWZ1bmRfcmVmX2lkKSB7XG4gICAgICAgICAgYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlKHtcbiAgICAgICAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICAgICAgICBkYXRhOiB7IHJlZnVuZFJlZklkOiBnYXRld2F5LnJlZnVuZF9yZWZfaWQsIHJlZnVuZGVkQXQ6IG5ldyBEYXRlKCkgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZWZ1bmRSZWZzLnB1c2goZ2F0ZXdheS5yZWZ1bmRfcmVmX2lkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgYFtyZWZ1bmRdIHBheW1lbnQgJHtwYXltZW50LmlkfSByZWplY3RlZDogJHtnYXRld2F5LmVycm9yUmVhc29uID8/IGdhdGV3YXkuc3RhdHVzID8/IFwidW5rbm93blwifWAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcbiAgICAvLyBpbmRpdmlkdWFsIGZhaWx1cmVzIGFyZSBsb2dnZWQgYWJvdmUgYW5kIHN3YWxsb3dlZCBcdTIwMTQgbW9uZXkgc3RhdHVzIGFscmVhZHlcbiAgICAvLyBmbGlwcGVkIHRvIFJFRlVOREVELCBzbyB0aGUgY3VzdG9tZXIgc2VlcyBhIHJlZnVuZCByZWdhcmRsZXNzLlxuICAgIHZvaWQgb3V0Y29tZXM7XG5cbiAgICBpZiAocmVmdW5kUmVmcy5sZW5ndGggPiAwKSB7XG4gICAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICAgIHNlbmRSZWZ1bmRFbWFpbCh7XG4gICAgICAgICAgZW1haWw6IGN0eC5lbWFpbCxcbiAgICAgICAgICBuYW1lOiBjdHgubmFtZSxcbiAgICAgICAgICBwYWNrYWdlVGl0bGU6IGN0eC5wYWNrYWdlVGl0bGUsXG4gICAgICAgICAgdHJhdmVsRGF0ZTogY3R4LnRyYXZlbERhdGUsXG4gICAgICAgICAgYW1vdW50OiBwYXltZW50cy5yZWR1Y2UoKHN1bSwgcCkgPT4gc3VtICsgTnVtYmVyKHAuYW1vdW50KSwgMCksXG4gICAgICAgICAgcmVmdW5kUmVmSWQ6IHJlZnVuZFJlZnNbMF0sXG4gICAgICAgIH0pLFxuICAgICAgXSk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBgW3JlZnVuZF0gdW5leHBlY3RlZCBlcnJvcjogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCxcbiAgICApO1xuICB9XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgU3RhdHVzIHRyYW5zaXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCB1cGRhdGVCb29raW5nU3RhdHVzID0gYXN5bmMgKFxuICBpZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlQm9va2luZ1N0YXR1cyxcbiAgYWN0b3I6IEJvb2tpbmdBY3RvcixcbikgPT4ge1xuICBjb25zdCB7IHN0YXR1czogdG8gfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgYm9va2luZyA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgcGFja2FnZToge1xuICAgICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIGFnZW50SWQ6IHRydWUsIHRpdGxlOiB0cnVlIH0sXG4gICAgICB9LFxuICAgICAgdXNlcjogYm9va2luZ1VzZXJTZWxlY3QsXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKCFib29raW5nKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJCb29raW5nIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBpZiAoIWNhbk1hbmFnZShib29raW5nLCBhY3RvcikpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gcGVyZm9ybSB0aGlzIGFjdGlvbi5cIik7XG4gIH1cblxuICBjb25zdCBydWxlID0gVFJBTlNJVElPTlNbYm9va2luZy5zdGF0dXNdPy5bdG9dO1xuICBpZiAoIXJ1bGUpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBgQ2Fubm90IHRyYW5zaXRpb24gYm9va2luZyBmcm9tICR7Ym9va2luZy5zdGF0dXN9IHRvICR7dG99LmAsXG4gICAgKTtcbiAgfVxuICBpZiAoIXJ1bGUuYWxsb3dlZChib29raW5nLCBhY3RvcikpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gcGVyZm9ybSB0aGlzIGFjdGlvbi5cIik7XG4gIH1cblxuICBjb25zdCB0cmF2ZWxEYXkgPSB0b1VUQ01pZG5pZ2h0KGJvb2tpbmcudHJhdmVsRGF0ZSkuZ2V0VGltZSgpO1xuICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICBpZiAocnVsZS5yZXF1aXJlc1RyYXZlbERhdGVQYXNzZWQgJiYgdHJhdmVsRGF5ID4gbm93KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJCb29raW5nIGNhbiBvbmx5IGJlIGNvbXBsZXRlZCBhZnRlciB0aGUgdHJhdmVsIGRhdGUgaGFzIHBhc3NlZC5cIixcbiAgICApO1xuICB9XG4gIGlmIChydWxlLmJlZm9yZVRyYXZlbERhdGUgJiYgdHJhdmVsRGF5IDw9IG5vdykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiQm9va2luZyBjYW4gb25seSBiZSByZXZlcnRlZCBiZWZvcmUgdGhlIHRyYXZlbCBkYXRlLlwiLFxuICAgICk7XG4gIH1cblxuICAvLyBjb21wYXJlLWFuZC1zZXQ6IHRoZSB0cmFuc2l0aW9uIGFwcGxpZXMgb25seSBpZiB0aGUgcmVjb3JkZWQgc3RhdHVzIHN0aWxsXG4gIC8vIG1hdGNoZXMgXHUyMDE0IGEgY29uY3VycmVudCBjaGFuZ2UgbWFrZXMgY291bnQgMCBhbmQgdGhlIHJlcXVlc3QgZmFpbHMgc2FmZWx5LlxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0eC5ib29raW5nLnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQsIHN0YXR1czogYm9va2luZy5zdGF0dXMgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiB0byB9LFxuICAgIH0pO1xuICAgIGlmIChyZXN1bHQuY291bnQgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDA5LFxuICAgICAgICBcIkJvb2tpbmcgc3RhdHVzIGNoYW5nZWQgY29uY3VycmVudGx5LiBQbGVhc2UgdHJ5IGFnYWluLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBDYW5jZWxsaW5nIGEgcGFpZCBib29raW5nIG1hcmtzIGl0cyBtb25leSBhcyByZXR1cm5lZCAoUkVGVU5ERUQgZmxhZykuXG4gICAgLy8gQWJhbmRvbmVkIHNlc3Npb25zIGFyZSBjYW5jZWxsZWQuIFRoZSBnYXRld2F5IHJlZnVuZHMgKyByZWZ1bmQgZW1haWwgcnVuXG4gICAgLy8gYWZ0ZXIgdGhpcyB0cmFuc2FjdGlvbiBjb21taXRzIChpc3N1ZVJlZnVuZHMgaXMgYmVzdC1lZmZvcnQpLlxuICAgIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQpIHtcbiAgICAgIGF3YWl0IHR4LnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgICAgIHdoZXJlOiB7IGJvb2tpbmdJZDogaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5TVUNDRVNTIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLlJFRlVOREVEIH0sXG4gICAgICB9KTtcbiAgICAgIGF3YWl0IHR4LnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgICAgIHdoZXJlOiB7IGJvb2tpbmdJZDogaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHguYm9va2luZy5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcbiAgfSk7XG5cbiAgaWYgKCF1cGRhdGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJCb29raW5nIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICAvLyBiZXN0LWVmZm9ydCBnYXRld2F5IHJlZnVuZCArIHJlZnVuZCBlbWFpbCBmb3Igc2V0dGxlZCBtb25leSAobmV2ZXIgdGhyb3dzKVxuICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgYXdhaXQgaXNzdWVSZWZ1bmRzKGlkLCB7XG4gICAgICBlbWFpbDogYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgbmFtZTogYm9va2luZy51c2VyLm5hbWUsXG4gICAgICBwYWNrYWdlVGl0bGU6IGJvb2tpbmcucGFja2FnZS50aXRsZSxcbiAgICAgIHRyYXZlbERhdGU6IGJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIGJlc3QtZWZmb3J0IGVtYWlsIGZvciBtb25leS1zdGF0dXMgY2hhbmdlc1xuICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ09ORklSTUVEIHx8IHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgICBlbWFpbDogYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgICBuYW1lOiBib29raW5nLnVzZXIubmFtZSxcbiAgICAgICAgcGFja2FnZVRpdGxlOiBib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICAgIHRyYXZlbERhdGU6IGJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICAgICAgdHJhdmVsZXJzOiBib29raW5nLnRyYXZlbGVycyxcbiAgICAgICAgdG90YWxQcmljZTogTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSksXG4gICAgICAgIHN0YXR1czogdG8sXG4gICAgICB9KSxcbiAgICBdKTtcbiAgfVxuXG4gIC8vIGJlc3QtZWZmb3J0IGluLWFwcCBub3RpZmljYXRpb25zIChuZXZlciBmYWlscyByZXF1ZXN0KS4gUmVjaXBpZW50IG9mIGFcbiAgLy8gY2FuY2VsbGF0aW9uIGRlcGVuZHMgb24gdGhlIGFjdG9yOiB0aGUgY3VzdG9tZXIgY2FuY2VscyBcdTIxOTIgdGhlIGFnZW50IGhlYXJzO1xuICAvLyB0aGUgYWdlbnQgY2FuY2VscyBcdTIxOTIgdGhlIGN1c3RvbWVyIGhlYXJzOyBhbiBBRE1JTiBjYW5jZWxzIFx1MjE5MiBib3RoIGhlYXIsIHNpbmNlXG4gIC8vIHRoZSBhZG1pbiBhY3RzIG9uIGJlaGFsZiBvZiB0aGUgcGxhdGZvcm0sIG5vdCBlaXRoZXIgc2lkZS5cbiAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNPTkZJUk1FRCkge1xuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgIG5vdGlmeShcbiAgICAgICAgYm9va2luZy51c2VySWQsXG4gICAgICAgIE5vdGlmaWNhdGlvblR5cGUuQk9PS0lOR19DT05GSVJNRUQsXG4gICAgICAgIFwiQm9va2luZyBjb25maXJtZWRcIixcbiAgICAgICAgYFlvdXIgYm9va2luZyBmb3IgXCIke2Jvb2tpbmcucGFja2FnZS50aXRsZX1cIiBoYXMgYmVlbiBjb25maXJtZWQuYCxcbiAgICAgICAgYC9kYXNoYm9hcmQvYm9va2luZ3MvJHtpZH1gLFxuICAgICAgKSxcbiAgICBdKTtcbiAgfVxuXG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQpIHtcbiAgICBjb25zdCByZWNpcGllbnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGlmIChhY3Rvci5pZCA9PT0gYm9va2luZy51c2VySWQpIHtcbiAgICAgIHJlY2lwaWVudHMucHVzaChib29raW5nLnBhY2thZ2UuYWdlbnRJZCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGFjdG9yLnJvbGUgPT09IFJvbGUuQUdFTlQgJiZcbiAgICAgIGJvb2tpbmcucGFja2FnZS5hZ2VudElkID09PSBhY3Rvci5pZFxuICAgICkge1xuICAgICAgcmVjaXBpZW50cy5wdXNoKGJvb2tpbmcudXNlcklkKTtcbiAgICB9IGVsc2UgaWYgKGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU4pIHtcbiAgICAgIHJlY2lwaWVudHMucHVzaChib29raW5nLnVzZXJJZCwgYm9va2luZy5wYWNrYWdlLmFnZW50SWQpO1xuICAgIH1cblxuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgWy4uLm5ldyBTZXQocmVjaXBpZW50cyldLm1hcCgocmVjaXBpZW50SWQpID0+XG4gICAgICAgIG5vdGlmeShcbiAgICAgICAgICByZWNpcGllbnRJZCxcbiAgICAgICAgICBOb3RpZmljYXRpb25UeXBlLkJPT0tJTkdfQ0FOQ0VMTEVELFxuICAgICAgICAgIFwiQm9va2luZyBjYW5jZWxsZWRcIixcbiAgICAgICAgICBgVGhlIGJvb2tpbmcgZm9yIFwiJHtib29raW5nLnBhY2thZ2UudGl0bGV9XCIgaGFzIGJlZW4gY2FuY2VsbGVkLmAsXG4gICAgICAgICAgYC9kYXNoYm9hcmQvYm9va2luZ3MvJHtpZH1gLFxuICAgICAgICApLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHsgLi4udXBkYXRlZCwgdG90YWxQcmljZTogTnVtYmVyKHVwZGF0ZWQudG90YWxQcmljZSkgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBib29raW5nU2VydmljZSA9IHtcbiAgY3JlYXRlQm9va2luZyxcbiAgZ2V0TXlCb29raW5ncyxcbiAgZ2V0QWdlbnRCb29raW5ncyxcbiAgZ2V0QWxsQm9va2luZ3MsXG4gIGdldEJvb2tpbmdEZXRhaWwsXG4gIHVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5cbmNvbnN0IGNyZWF0ZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFja2FnZUlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG4gIHRyYXZlbERhdGU6IHouY29lcmNlLmRhdGUoe1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlRyYXZlbCBkYXRlIGlzIHJlcXVpcmVkXCIsXG4gICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlRyYXZlbCBkYXRlIG11c3QgYmUgYSB2YWxpZCBkYXRlXCIsXG4gIH0pLnJlZmluZShcbiAgICAoZGF0ZSkgPT4ge1xuICAgICAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpO1xuICAgICAgY29uc3QgdHJhdmVsRGF5ID0gbmV3IERhdGUoXG4gICAgICAgIERhdGUuVVRDKFxuICAgICAgICAgIGRhdGUuZ2V0VVRDRnVsbFllYXIoKSxcbiAgICAgICAgICBkYXRlLmdldFVUQ01vbnRoKCksXG4gICAgICAgICAgZGF0ZS5nZXRVVENEYXRlKCksXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgY29uc3QgdG9kYXlVVEMgPSBuZXcgRGF0ZShcbiAgICAgICAgRGF0ZS5VVEMoXG4gICAgICAgICAgdG9kYXkuZ2V0VVRDRnVsbFllYXIoKSxcbiAgICAgICAgICB0b2RheS5nZXRVVENNb250aCgpLFxuICAgICAgICAgIHRvZGF5LmdldFVUQ0RhdGUoKSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICByZXR1cm4gdHJhdmVsRGF5LmdldFRpbWUoKSA+PSB0b2RheVVUQy5nZXRUaW1lKCk7XG4gICAgfSxcbiAgICB7IG1lc3NhZ2U6IFwiVHJhdmVsIGRhdGUgY2Fubm90IGJlIGluIHRoZSBwYXN0LlwiIH0sXG4gICksXG4gIHRyYXZlbGVyczogelxuICAgIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJUcmF2ZWxlcnMgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5pbnQoXCJUcmF2ZWxlcnMgbXVzdCBiZSBhIHdob2xlIG51bWJlclwiKVxuICAgIC5taW4oMSwgXCJUcmF2ZWxlcnMgbXVzdCBiZSBhdCBsZWFzdCAxXCIpXG4gICAgLm1heCgyMCwgXCJUcmF2ZWxlcnMgbXVzdCBiZSBhdCBtb3N0IDIwXCIpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkJvb2tpbmcgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgYm9va2luZ1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBzdGF0dXM6IHoubmF0aXZlRW51bShCb29raW5nU3RhdHVzKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSA9IGJvb2tpbmdRdWVyeVNjaGVtYS5leHRlbmQoe1xuICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgdXBkYXRlU3RhdHVzU2NoZW1hID0gei5vYmplY3Qoe1xuICBzdGF0dXM6IHoubmF0aXZlRW51bShCb29raW5nU3RhdHVzLCB7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSBzdGF0dXNcIixcbiAgfSksXG59KTtcblxuZXhwb3J0IHR5cGUgVENyZWF0ZUJvb2tpbmdTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBjcmVhdGVTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEJvb2tpbmdRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGJvb2tpbmdRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRVcGRhdGVTdGF0dXNTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiB1cGRhdGVTdGF0dXNTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgYm9va2luZ1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVTY2hlbWEsXG4gIGJvb2tpbmdQYXJhbXNTY2hlbWEsXG4gIGJvb2tpbmdRdWVyeVNjaGVtYSxcbiAgYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hLFxuICB1cGRhdGVTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgcmV2aWV3Q29udHJvbGxlciB9IGZyb20gXCIuL3Jldmlldy5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyByZXZpZXdWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3Jldmlldy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgKFVTRVIgb25seSlcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiByZXZpZXdWYWxpZGF0aW9ucy5jcmVhdGVSZXZpZXdTY2hlbWEgfSksXG4gIHJldmlld0NvbnRyb2xsZXIuY3JlYXRlUmV2aWV3LFxuKTtcblxuLy8gMi4gTGlzdCByZXZpZXdzIGZvciBhIHBhY2thZ2UgKHB1YmxpYylcbnJvdXRlci5nZXQoXG4gIFwiL3BhY2thZ2UvOnBhY2thZ2VJZFwiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3UGFyYW1zU2NoZW1hLFxuICAgIHF1ZXJ5OiByZXZpZXdWYWxpZGF0aW9ucy5yZXZpZXdRdWVyeVNjaGVtYSxcbiAgfSksXG4gIHJldmlld0NvbnRyb2xsZXIuZ2V0UGFja2FnZVJldmlld3MsXG4pO1xuXG4vLyAzLiBVcGRhdGUgYSByZXZpZXcgKFVTRVIsIGF1dGhvciBvbmx5KSBcdTIwMTQgcmVnaXN0ZXJlZCBhZnRlciAvcGFja2FnZS86cGFja2FnZUlkXG4vLyAgICBzbyB0aGUgbGl0ZXJhbCBgL3BhY2thZ2VgIHNlZ21lbnQgaXMgbmV2ZXIgc3dhbGxvd2VkIGJ5IGAvOmlkYC5cbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHJldmlld1ZhbGlkYXRpb25zLnJldmlld0lkUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHJldmlld1ZhbGlkYXRpb25zLnVwZGF0ZVJldmlld1NjaGVtYSxcbiAgfSksXG4gIHJldmlld0NvbnRyb2xsZXIudXBkYXRlUmV2aWV3LFxuKTtcblxuLy8gNC4gRGVsZXRlIGEgcmV2aWV3IChhdXRob3Igb3IgQURNSU4pXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHJldmlld1ZhbGlkYXRpb25zLnJldmlld0lkUGFyYW1zU2NoZW1hIH0pLFxuICByZXZpZXdDb250cm9sbGVyLmRlbGV0ZVJldmlldyxcbik7XG5cbmV4cG9ydCBjb25zdCByZXZpZXdSb3V0ZXMgPSByb3V0ZXI7XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHJldmlld1NlcnZpY2UgfSBmcm9tIFwiLi9yZXZpZXcuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBhIHJldmlldyBjb250cm9sbGVyIChVU0VSIG9ubHkpXG5jb25zdCBjcmVhdGVSZXZpZXcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXZpZXdTZXJ2aWNlLmNyZWF0ZVJldmlldyh1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlJldmlldyBzdWJtaXR0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gTGlzdCBwYWNrYWdlIHJldmlld3MgY29udHJvbGxlciAocHVibGljKVxuY29uc3QgZ2V0UGFja2FnZVJldmlld3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSWQgPSBTdHJpbmcocmVxLnBhcmFtcy5wYWNrYWdlSWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJldmlld1NlcnZpY2UubGlzdFBhY2thZ2VSZXZpZXdzKHBhY2thZ2VJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJSZXZpZXdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gVXBkYXRlIGEgcmV2aWV3IGNvbnRyb2xsZXIgKFVTRVIsIGF1dGhvciBvbmx5KVxuY29uc3QgdXBkYXRlUmV2aWV3ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmV2aWV3U2VydmljZS51cGRhdGVSZXZpZXcodXNlcklkLCBpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlJldmlldyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIERlbGV0ZSBhIHJldmlldyBjb250cm9sbGVyIChhdXRob3Igb3IgQURNSU4pXG5jb25zdCBkZWxldGVSZXZpZXcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByb2xlID0gcmVxLnVzZXIhLnJvbGU7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmV2aWV3U2VydmljZS5kZWxldGVSZXZpZXcodXNlcklkLCByb2xlLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHJldmlld0NvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVJldmlldyxcbiAgZ2V0UGFja2FnZVJldmlld3MsXG4gIHVwZGF0ZVJldmlldyxcbiAgZGVsZXRlUmV2aWV3LFxufTtcbiIsICJpbXBvcnQgeyBQYWNrYWdlU3RhdHVzLCBCb29raW5nU3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQge1xuICBJQ3JlYXRlUmV2aWV3UGF5bG9hZCxcbiAgSVJldmlld1F1ZXJ5LFxuICBJVXBkYXRlUmV2aWV3UGF5bG9hZCxcbn0gZnJvbSBcIi4vcmV2aWV3LmludGVyZmFjZVwiO1xuXG4vLyBTaGFyZWQgcmF0aW5nIHJlY29tcHV0ZSBcdTIwMTQgdGhlIHNpbmdsZSBzb3VyY2Ugb2YgdHJ1dGggZm9yIHRoZSBwYWNrYWdlXG4vLyBhdmVyYWdlLiBjcmVhdGUvdXBkYXRlL2RlbGV0ZSBhbGwgY2FsbCBpdCBpbnNpZGUgdGhlaXIgb3duIHRyYW5zYWN0aW9uLCBhbmRcbi8vIHRoZSBhZ2dyZWdhdGUgYWx3YXlzIGZpbHRlcnMgYGlzRGVsZXRlZDogZmFsc2VgIHNvIGEgcmVtb3ZlZCByYXRpbmcgbmV2ZXJcbi8vIGNvdW50cyAob3RoZXJ3aXNlIGRlbGV0ZSB3b3VsZCByZWNvbXB1dGUgYW4gdW5jaGFuZ2VkIGF2ZXJhZ2UpLlxuY29uc3QgcmVjb21wdXRlUGFja2FnZVJhdGluZyA9IGFzeW5jIChcbiAgdHg6IFByaXNtYS5UcmFuc2FjdGlvbkNsaWVudCxcbiAgcGFja2FnZUlkOiBzdHJpbmcsXG4pOiBQcm9taXNlPG51bWJlcj4gPT4ge1xuICBjb25zdCB7IF9hdmcgfSA9IGF3YWl0IHR4LnJldmlldy5hZ2dyZWdhdGUoe1xuICAgIHdoZXJlOiB7IHBhY2thZ2VJZCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIF9hdmc6IHsgcmF0aW5nOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGNvbnN0IHJhdGluZyA9IE1hdGgucm91bmQoKF9hdmcucmF0aW5nID8/IDApICogMTApIC8gMTA7XG5cbiAgYXdhaXQgdHgudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YTogeyByYXRpbmcgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHJhdGluZztcbn07XG5cbi8vIDEuIENyZWF0ZSBhIHJldmlldyAoVVNFUiBvbmx5KSBcdTIwMTQgZ2F0ZWQsIHVuaXF1ZSBwZXIgdXNlcitwYWNrYWdlLCBhbmRcbi8vICAgIHJlY2FsY3VsYXRlcyB0aGUgcGFja2FnZSByYXRpbmcgaW4gdGhlIHNhbWUgdHJhbnNhY3Rpb24uXG5jb25zdCBjcmVhdGVSZXZpZXcgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHBheWxvYWQ6IElDcmVhdGVSZXZpZXdQYXlsb2FkKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIC8vIFBhY2thZ2UgbXVzdCBleGlzdCwgYmUgYXBwcm92ZWQsIGFuZCBub3QgYmUgZGVsZXRlZCBcdTIwMTQgYSByZXZpZXcgb2YgYVxuICAgIC8vIHBlbmRpbmcvcmVqZWN0ZWQvZGVsZXRlZCBwYWNrYWdlIGlzIG5vbnNlbnNlLlxuICAgIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgdHgudG91clBhY2thZ2UuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgYWdlbnRJZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgLy8gTm8gc2VsZi1yZXZpZXcgXHUyMDE0IGFuIGFnZW50IHJhdGluZyB0aGVpciBvd24gcGFja2FnZSBpcyBhIGNvbmZsaWN0IG9mIGludGVyZXN0LlxuICAgIGlmICh0b3VyUGFja2FnZS5hZ2VudElkID09PSB1c2VySWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGNhbm5vdCByZXZpZXcgeW91ciBvd24gcGFja2FnZS5cIik7XG4gICAgfVxuXG4gICAgLy8gT25seSBjdXN0b21lcnMgd2l0aCBhIGNvbXBsZXRlZCBib29raW5nIG1heSByZXZpZXcuXG4gICAgY29uc3QgY29tcGxldGVkQm9va2luZyA9IGF3YWl0IHR4LmJvb2tpbmcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCxcbiAgICAgIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghY29tcGxldGVkQm9va2luZykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDMsXG4gICAgICAgIFwiWW91IGNhbiBvbmx5IHJldmlldyBhIHBhY2thZ2UgYWZ0ZXIgY29tcGxldGluZyBhIGJvb2tpbmcuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIEZyaWVuZGx5IGR1cGxpY2F0ZSBjaGVjayBcdTIwMTQgQEB1bmlxdWUoW3VzZXJJZCwgcGFja2FnZUlkXSkgYmFja3N0b3BzIGFueVxuICAgIC8vIHJhY2UgdmlhIFAyMDAyIChtYXBwZWQgdG8gNDA5IGJ5IHRoZSBnbG9iYWwgaGFuZGxlcikuIERlbGliZXJhdGVseSBOT1RcbiAgICAvLyBmaWx0ZXJlZCBieSBpc0RlbGV0ZWQ6IHNvZnQgZGVsZXRlIGtlZXBzIHRoZSByb3csIHNvIHJlLXJldmlld2luZyBhZnRlclxuICAgIC8vIGEgZGVsZXRlIHN0aWxsIGZhaWxzIHdpdGggdGhpcyBmcmllbmRseSA0MDkuXG4gICAgY29uc3QgZXhpc3RpbmdSZXZpZXcgPSBhd2FpdCB0eC5yZXZpZXcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7IHVzZXJJZCwgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoZXhpc3RpbmdSZXZpZXcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiWW91IGhhdmUgYWxyZWFkeSByZXZpZXdlZCB0aGlzIHBhY2thZ2UuXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGNyZWF0ZWRSZXZpZXcgPSBhd2FpdCB0eC5yZXZpZXcuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICByYXRpbmc6IHBheWxvYWQucmF0aW5nLFxuICAgICAgICBjb21tZW50OiBwYXlsb2FkLmNvbW1lbnQsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmF0aW5nID0gYXdhaXQgcmVjb21wdXRlUGFja2FnZVJhdGluZyh0eCwgcGF5bG9hZC5wYWNrYWdlSWQpO1xuXG4gICAgcmV0dXJuIHsgcmV2aWV3OiBjcmVhdGVkUmV2aWV3LCByYXRpbmcgfTtcbiAgfSk7XG59O1xuXG4vLyAyLiBMaXN0IHJldmlld3MgZm9yIGEgcGFja2FnZSAocHVibGljKSBcdTIwMTQgcGFnaW5hdGVkOyB0aGUgcGFja2FnZSBtdXN0IGJlXG4vLyAgICBhcHByb3ZlZCBhbmQgbm90IGRlbGV0ZWQgc28gdW5wdWJsaXNoZWQgcGFja2FnZSByZXZpZXdzIG5ldmVyIGxlYWsuXG4vLyAgICBEZWxldGVkIHJldmlld3MgYXJlIGV4Y2x1ZGVkIHNvIGEgcmVtb3ZlZCByYXRpbmcgc3RvcHMgY291bnRpbmcuXG5jb25zdCBsaXN0UGFja2FnZVJldmlld3MgPSBhc3luYyAoXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuICBxdWVyeTogSVJldmlld1F1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIGlkOiBwYWNrYWdlSWQsXG4gICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmUgPSB7IHBhY2thZ2VJZCwgaXNEZWxldGVkOiBmYWxzZSB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnJldmlldy5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIHNlbGVjdDoge1xuICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgcmF0aW5nOiB0cnVlLFxuICAgICAgICBjb21tZW50OiB0cnVlLFxuICAgICAgICBjcmVhdGVkQXQ6IHRydWUsXG4gICAgICAgIHVwZGF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgdXNlcjogeyBzZWxlY3Q6IHsgbmFtZTogdHJ1ZSwgYXZhdGFyVXJsOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEucmV2aWV3LmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gMy4gVXBkYXRlIGEgcmV2aWV3IChVU0VSLCBhdXRob3Igb25seSkuIEEgZm9yZWlnbiBpZCBvciBhIHJlbW92ZWQgcmV2aWV3IGlzXG4vLyAgICBhIHVuaWZvcm0gNDA0IFx1MjAxNCBuZXZlciBhIGxlYWsuIFRoZSBwYWNrYWdlIGF2ZXJhZ2UgaXMgcmVjb21wdXRlZCBpbiB0aGVcbi8vICAgIHNhbWUgdHJhbnNhY3Rpb24uXG5jb25zdCB1cGRhdGVSZXZpZXcgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICByZXZpZXdJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlUmV2aWV3UGF5bG9hZCxcbikgPT4ge1xuICByZXR1cm4gcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHR4LnJldmlldy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJldmlld0lkLCB1c2VySWQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgcGFja2FnZUlkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlJldmlldyBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCB0eC5yZXZpZXcudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiByZXZpZXdJZCB9LFxuICAgICAgZGF0YToge1xuICAgICAgICAuLi4ocGF5bG9hZC5yYXRpbmcgIT09IHVuZGVmaW5lZCA/IHsgcmF0aW5nOiBwYXlsb2FkLnJhdGluZyB9IDoge30pLFxuICAgICAgICAuLi4ocGF5bG9hZC5jb21tZW50ICE9PSB1bmRlZmluZWQgPyB7IGNvbW1lbnQ6IHBheWxvYWQuY29tbWVudCB9IDoge30pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGF3YWl0IHJlY29tcHV0ZVBhY2thZ2VSYXRpbmcodHgsIGV4aXN0aW5nLnBhY2thZ2VJZCk7XG5cbiAgICAvLyBUaGUgcmVzcG9uc2UncyByYXRpbmcgaXMgdGhlIGF1dGhvcml0YXRpdmUgdmFsdWUgZnJvbSB0aGUgcGFja2FnZSByb3csXG4gICAgLy8gbm90IHRoZSBpbnB1dCBcdTIwMTQgdGhlIGNsaWVudCdzIGRpc3BsYXllZCBhdmVyYWdlIGlzIG5ldmVyIHN0YWxlLlxuICAgIGNvbnN0IGZyZXNoID0gYXdhaXQgdHgudG91clBhY2thZ2UuZmluZFVuaXF1ZSh7XG4gICAgICB3aGVyZTogeyBpZDogZXhpc3RpbmcucGFja2FnZUlkIH0sXG4gICAgICBzZWxlY3Q6IHsgcmF0aW5nOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4geyByZXZpZXc6IHVwZGF0ZWQsIHJhdGluZzogZnJlc2g/LnJhdGluZyA/PyAwIH07XG4gIH0pO1xufTtcblxuLy8gNC4gU29mdCBkZWxldGUgYSByZXZpZXcgKGF1dGhvciBvciBBRE1JTikgXHUyMDE0IHRoZSBhdmVyYWdlIGlzIHJlY29tcHV0ZWQgc28gdGhlXG4vLyAgICByZW1vdmVkIHJhdGluZyBzdG9wcyBjb3VudGluZy4gRm9yZWlnbiBpZCAvIHJlcGVhdCBkZWxldGUgXHUyMTkyIHVuaWZvcm0gNDA0LlxuY29uc3QgZGVsZXRlUmV2aWV3ID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcm9sZTogUm9sZSxcbiAgcmV2aWV3SWQ6IHN0cmluZyxcbikgPT4ge1xuICByZXR1cm4gcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHR4LnJldmlldy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJldmlld0lkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIHBhY2thZ2VJZDogdHJ1ZSwgdXNlcklkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlJldmlldyBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIGlmIChyb2xlICE9PSBSb2xlLkFETUlOICYmIGV4aXN0aW5nLnVzZXJJZCAhPT0gdXNlcklkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlJldmlldyBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlbW92ZWQgPSBhd2FpdCB0eC5yZXZpZXcudXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyBpZDogcmV2aWV3SWQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAocmVtb3ZlZC5jb3VudCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJSZXZpZXcgbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICBjb25zdCByYXRpbmcgPSBhd2FpdCByZWNvbXB1dGVQYWNrYWdlUmF0aW5nKHR4LCBleGlzdGluZy5wYWNrYWdlSWQpO1xuXG4gICAgcmV0dXJuIHsgcmV2aWV3SWQsIHJhdGluZyB9O1xuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCByZXZpZXdTZXJ2aWNlID0ge1xuICBjcmVhdGVSZXZpZXcsXG4gIGxpc3RQYWNrYWdlUmV2aWV3cyxcbiAgdXBkYXRlUmV2aWV3LFxuICBkZWxldGVSZXZpZXcsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVSZXZpZXdTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhY2thZ2VJZDogelxuICAgICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG4gICAgcmF0aW5nOiB6XG4gICAgICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiUmF0aW5nIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC5pbnQoXCJSYXRpbmcgbXVzdCBiZSBhIHdob2xlIG51bWJlclwiKVxuICAgICAgLm1pbigxLCBcIlJhdGluZyBtdXN0IGJlIGF0IGxlYXN0IDFcIilcbiAgICAgIC5tYXgoNSwgXCJSYXRpbmcgbXVzdCBiZSBhdCBtb3N0IDVcIiksXG4gICAgY29tbWVudDogelxuICAgICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbW1lbnQgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1pbigxLCBcIkNvbW1lbnQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgICAgIC5tYXgoMTAwMCwgXCJDb21tZW50IG11c3QgYmUgYXQgbW9zdCAxMDAwIGNoYXJhY3RlcnNcIiksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgcmV2aWV3UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWNrYWdlSWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG59KTtcblxuY29uc3QgcmV2aWV3UXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG59KTtcblxuY29uc3QgdXBkYXRlUmV2aWV3U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICByYXRpbmc6IHpcbiAgICAgIC5udW1iZXIoeyBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiUmF0aW5nIG11c3QgYmUgYSBudW1iZXJcIiB9KVxuICAgICAgLmludChcIlJhdGluZyBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyXCIpXG4gICAgICAubWluKDEsIFwiUmF0aW5nIG11c3QgYmUgYXQgbGVhc3QgMVwiKVxuICAgICAgLm1heCg1LCBcIlJhdGluZyBtdXN0IGJlIGF0IG1vc3QgNVwiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gICAgY29tbWVudDogelxuICAgICAgLnN0cmluZyh7IGludmFsaWRfdHlwZV9lcnJvcjogXCJDb21tZW50IG11c3QgYmUgYSBzdHJpbmdcIiB9KVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1pbigxLCBcIkNvbW1lbnQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgICAgIC5tYXgoMTAwMCwgXCJDb21tZW50IG11c3QgYmUgYXQgbW9zdCAxMDAwIGNoYXJhY3RlcnNcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KClcbiAgLnJlZmluZSgoZGF0YSkgPT4gZGF0YS5yYXRpbmcgIT09IHVuZGVmaW5lZCB8fCBkYXRhLmNvbW1lbnQgIT09IHVuZGVmaW5lZCwge1xuICAgIG1lc3NhZ2U6IFwiQXQgbGVhc3Qgb25lIG9mIHJhdGluZyBvciBjb21tZW50IG11c3QgYmUgcHJvdmlkZWRcIixcbiAgfSk7XG5cbmNvbnN0IHJldmlld0lkUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJSZXZpZXcgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oMSwgXCJSZXZpZXcgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG59KTtcblxuZXhwb3J0IGNvbnN0IHJldmlld1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVSZXZpZXdTY2hlbWEsXG4gIHJldmlld1BhcmFtc1NjaGVtYSxcbiAgcmV2aWV3UXVlcnlTY2hlbWEsXG4gIHVwZGF0ZVJldmlld1NjaGVtYSxcbiAgcmV2aWV3SWRQYXJhbXNTY2hlbWEsXG59O1xuIiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBjYXRlZ29yeUNvbnRyb2xsZXIgfSBmcm9tIFwiLi9jYXRlZ29yeS5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBjYXRlZ29yeVZhbGlkYXRpb25zIH0gZnJvbSBcIi4vY2F0ZWdvcnkudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gTGlzdCBhbGwgY2F0ZWdvcmllcyAocHVibGljLCBubyBhdXRoKVxucm91dGVyLmdldChcIi9cIiwgY2F0ZWdvcnlDb250cm9sbGVyLmdldEFsbENhdGVnb3JpZXMpO1xuXG4vLyAyLiBDcmVhdGUgY2F0ZWdvcnkgKGFkbWluKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBjYXRlZ29yeVZhbGlkYXRpb25zLmNyZWF0ZUNhdGVnb3J5U2NoZW1hIH0pLFxuICBjYXRlZ29yeUNvbnRyb2xsZXIuY3JlYXRlQ2F0ZWdvcnksXG4pO1xuXG4vLyAzLiBVcGRhdGUgY2F0ZWdvcnkgKGFkbWluKVxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY2F0ZWdvcnlQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogY2F0ZWdvcnlWYWxpZGF0aW9ucy51cGRhdGVDYXRlZ29yeVNjaGVtYSxcbiAgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci51cGRhdGVDYXRlZ29yeSxcbik7XG5cbi8vIDQuIERlbGV0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBjYXRlZ29yeVZhbGlkYXRpb25zLmNhdGVnb3J5UGFyYW1zU2NoZW1hIH0pLFxuICBjYXRlZ29yeUNvbnRyb2xsZXIuZGVsZXRlQ2F0ZWdvcnksXG4pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBjYXRlZ29yeVNlcnZpY2UgfSBmcm9tIFwiLi9jYXRlZ29yeS5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gQ3JlYXRlIGNhdGVnb3J5IGNvbnRyb2xsZXIgKGFkbWluKVxuY29uc3QgY3JlYXRlQ2F0ZWdvcnkgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBjYXRlZ29yeSA9IGF3YWl0IGNhdGVnb3J5U2VydmljZS5jcmVhdGVDYXRlZ29yeShyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJDYXRlZ29yeSBjcmVhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGNhdGVnb3J5LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR2V0IGFsbCBjYXRlZ29yaWVzIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGdldEFsbENhdGVnb3JpZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmdldEFsbENhdGVnb3JpZXMoKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgY2F0ZWdvcmllcyBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGNhdGVnb3JpZXMsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBVcGRhdGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCB1cGRhdGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgY29uc3QgY2F0ZWdvcnkgPSBhd2FpdCBjYXRlZ29yeVNlcnZpY2UudXBkYXRlQ2F0ZWdvcnkoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDYXRlZ29yeSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGNhdGVnb3J5LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gRGVsZXRlIGNhdGVnb3J5IGNvbnRyb2xsZXIgKGFkbWluKVxuY29uc3QgZGVsZXRlQ2F0ZWdvcnkgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGF3YWl0IGNhdGVnb3J5U2VydmljZS5kZWxldGVDYXRlZ29yeShpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ2F0ZWdvcnkgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlQ2F0ZWdvcnksXG4gIGdldEFsbENhdGVnb3JpZXMsXG4gIHVwZGF0ZUNhdGVnb3J5LFxuICBkZWxldGVDYXRlZ29yeSxcbn07IiwgIi8vIEJhbmdsYSAoQmVuZ2FsaSkgXHUyMTkyIExhdGluIGNvbnNvbmFudC92b3dlbCBtYXAsIGFwcGxpZWQgYmVmb3JlIGtlYmFiLWNhc2luZyBzb1xuLy8gQmFuZ2xhLWhlYXZ5IHRpdGxlcyBzdGlsbCBwcm9kdWNlIHJlYWRhYmxlIHNsdWdzIGluc3RlYWQgb2YgYmVpbmcgc3RyaXBwZWQgdG9cbi8vIGFuIGVtcHR5IHN0cmluZy5cbmNvbnN0IEJBTkdMQV9UT19MQVRJTjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgXHUwOTg1OiBcIm9cIixcbiAgXHUwOTg2OiBcImFcIixcbiAgXHUwOTg3OiBcImlcIixcbiAgXHUwOTg4OiBcImlcIixcbiAgXHUwOTg5OiBcInVcIixcbiAgXHUwOThBOiBcInVcIixcbiAgXHUwOThCOiBcInJpXCIsXG4gIFx1MDk4RjogXCJlXCIsXG4gIFx1MDk5MDogXCJvaVwiLFxuICBcdTA5OTM6IFwib1wiLFxuICBcdTA5OTQ6IFwib3VcIixcbiAgXHUwOTk1OiBcImthXCIsXG4gIFx1MDk5NjogXCJraGFcIixcbiAgXHUwOTk3OiBcImdhXCIsXG4gIFx1MDk5ODogXCJnaGFcIixcbiAgXHUwOTk5OiBcIm5nYVwiLFxuICBcdTA5OUE6IFwiY2hhXCIsXG4gIFx1MDk5QjogXCJjaGhhXCIsXG4gIFx1MDk5QzogXCJqYVwiLFxuICBcdTA5OUQ6IFwiamhhXCIsXG4gIFx1MDk5RTogXCJueWFcIixcbiAgXHUwOTlGOiBcInRhXCIsXG4gIFx1MDlBMDogXCJ0aGFcIixcbiAgXHUwOUExOiBcImRhXCIsXG4gIFx1MDlBMjogXCJkaGFcIixcbiAgXHUwOUEzOiBcIm5hXCIsXG4gIFx1MDlBNDogXCJ0YVwiLFxuICBcdTA5QTU6IFwidGhhXCIsXG4gIFx1MDlBNjogXCJkYVwiLFxuICBcdTA5QTc6IFwiZGhhXCIsXG4gIFx1MDlBODogXCJuYVwiLFxuICBcdTA5QUE6IFwicGFcIixcbiAgXHUwOUFCOiBcInBoYVwiLFxuICBcdTA5QUM6IFwiYmFcIixcbiAgXHUwOUFEOiBcImJoYVwiLFxuICBcdTA5QUU6IFwibWFcIixcbiAgXHUwOUFGOiBcInlhXCIsXG4gIFx1MDlCMDogXCJyYVwiLFxuICBcdTA5QjI6IFwibGFcIixcbiAgXHUwOUI2OiBcInNoYVwiLFxuICBcdTA5Qjc6IFwic2hhXCIsXG4gIFx1MDlCODogXCJzYVwiLFxuICBcdTA5Qjk6IFwiaGFcIixcbiAgXHUwOUExXHUwOUJDOiBcInJhXCIsXG4gIFx1MDlBMlx1MDlCQzogXCJyaGFcIixcbiAgXHUwOUFGXHUwOUJDOiBcInlhXCIsXG4gIFwiXHUwOTgyXCI6IFwibmdcIixcbiAgXCJcdTA5ODNcIjogXCJoXCIsXG4gIFwiXHUwOTgxXCI6IFwiXCIsXG4gIFwiXHUwOUNEXCI6IFwiXCIsXG4gIFwiXHUwOUM3XCI6IFwiZVwiLFxuICBcIlx1MDlDOFwiOiBcIm9pXCIsXG4gIFwiXHUwOUNCXCI6IFwib1wiLFxuICBcIlx1MDlDQ1wiOiBcIm91XCIsXG4gIFwiXHUwOUJFXCI6IFwiYVwiLFxuICBcIlx1MDlCRlwiOiBcImlcIixcbiAgXCJcdTA5QzBcIjogXCJpXCIsXG4gIFwiXHUwOUMxXCI6IFwidVwiLFxuICBcIlx1MDlDMlwiOiBcInVcIixcbiAgXCJcdTA5QzNcIjogXCJyaVwiLFxufTtcblxuY29uc3QgdHJhbnNsaXRlcmF0ZSA9ICh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcgPT5cbiAgWy4uLnRleHRdLm1hcCgoY2hhcikgPT4gQkFOR0xBX1RPX0xBVElOW2NoYXJdID8/IGNoYXIpLmpvaW4oXCJcIik7XG5cbi8vIFNoYXJlZCBrZWJhYi1jYXNlIHNsdWdpZmllciB1c2VkIGJ5IENhdGVnb3J5IGFuZCBUb3VyUGFja2FnZSBzbHVncy4gTm9uLUxhdGluXG4vLyBzY3JpcHRzIChlLmcuIEJhbmdsYSkgYXJlIHRyYW5zbGl0ZXJhdGVkIGZpcnN0OyBpZiB0aGUgcmVzdWx0IGlzIHN0aWxsIGVtcHR5XG4vLyB0aGUgY2FsbGVyIG1heSBzdXBwbHkgYSBgZmFsbGJhY2tgIChlLmcuIFwicGFja2FnZS08c2hvcnRJZD5cIikuXG5leHBvcnQgY29uc3Qgc2x1Z2lmeSA9ICh0ZXh0OiBzdHJpbmcsIGZhbGxiYWNrPzogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgY29uc3Qgc2x1ZyA9IHRyYW5zbGl0ZXJhdGUodGV4dClcbiAgICAudG9Mb3dlckNhc2UoKVxuICAgIC50cmltKClcbiAgICAucmVwbGFjZSgvW15cXHdcXHMtXS9nLCBcIlwiKVxuICAgIC5yZXBsYWNlKC9bXFxzXy1dKy9nLCBcIi1cIilcbiAgICAucmVwbGFjZSgvXi0rfC0rJC9nLCBcIlwiKTtcblxuICByZXR1cm4gc2x1ZyB8fCBmYWxsYmFjayB8fCBcIlwiO1xufTsiLCAiaW1wb3J0IHsgUGFja2FnZVN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2x1Z2lmeVwiO1xuaW1wb3J0IHsgSUNyZWF0ZUNhdGVnb3J5LCBJVXBkYXRlQ2F0ZWdvcnkgfSBmcm9tIFwiLi9jYXRlZ29yeS5pbnRlcmZhY2VcIjtcblxuLy8gRnJpZW5kbHkgNDA5IGZvciBAdW5pcXVlIGNvbmZsaWN0cyAobmFtZSBvciBzbHVnKSBpbnN0ZWFkIG9mIGEgcmF3IFAyMDAyLlxuLy8gZXhjbHVkZUlkIGxldHMgdXBkYXRlcyBza2lwIHRoZSB2ZXJ5IHJvdyBiZWluZyBlZGl0ZWQgc28gYSBuby1vcCByZW5hbWVcbi8vIGRvZXNuJ3QgZmFsc2UtNDA5IGFnYWluc3QgaXRzZWxmLlxuY29uc3QgYXNzZXJ0TmFtZUF2YWlsYWJsZSA9IGFzeW5jIChcbiAgbmFtZTogc3RyaW5nLFxuICBzbHVnOiBzdHJpbmcsXG4gIGV4Y2x1ZGVJZD86IHN0cmluZyxcbikgPT4ge1xuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7XG4gICAgICBPUjogW3sgbmFtZSB9LCB7IHNsdWcgfV0sXG4gICAgICAuLi4oZXhjbHVkZUlkID8geyBOT1Q6IHsgaWQ6IGV4Y2x1ZGVJZCB9IH0gOiB7fSksXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKGV4aXN0aW5nKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJBIGNhdGVnb3J5IHdpdGggdGhpcyBuYW1lIGFscmVhZHkgZXhpc3RzXCIpO1xuICB9XG59O1xuXG4vLyBDcmVhdGUgY2F0ZWdvcnkgKGFkbWluKVxuY29uc3QgY3JlYXRlQ2F0ZWdvcnkgPSBhc3luYyAocGF5bG9hZDogSUNyZWF0ZUNhdGVnb3J5KSA9PiB7XG4gIGNvbnN0IHsgbmFtZSB9ID0gcGF5bG9hZDtcbiAgY29uc3Qgc2x1ZyA9IHNsdWdpZnkobmFtZSk7XG5cbiAgYXdhaXQgYXNzZXJ0TmFtZUF2YWlsYWJsZShuYW1lLCBzbHVnKTtcblxuICByZXR1cm4gcHJpc21hLmNhdGVnb3J5LmNyZWF0ZSh7XG4gICAgZGF0YTogeyBuYW1lLCBzbHVnIH0sXG4gIH0pO1xufTtcblxuLy8gR2V0IGFsbCBjYXRlZ29yaWVzIChwdWJsaWMpIHdpdGggY291bnRzIG9mIGFwcHJvdmVkLCBub24tZGVsZXRlZCBwYWNrYWdlc1xuY29uc3QgZ2V0QWxsQ2F0ZWdvcmllcyA9IGFzeW5jICgpID0+IHtcbiAgcmV0dXJuIHByaXNtYS5jYXRlZ29yeS5maW5kTWFueSh7XG4gICAgb3JkZXJCeTogeyBuYW1lOiBcImFzY1wiIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgX2NvdW50OiB7XG4gICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgIHBhY2thZ2VzOiB7XG4gICAgICAgICAgICB3aGVyZToge1xuICAgICAgICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xufTtcblxuLy8gVXBkYXRlIGNhdGVnb3J5IG5hbWUgKHJlZ2VuZXJhdGVzIHNsdWcpIChhZG1pbilcbmNvbnN0IHVwZGF0ZUNhdGVnb3J5ID0gYXN5bmMgKGNhdGVnb3J5SWQ6IHN0cmluZywgcGF5bG9hZDogSVVwZGF0ZUNhdGVnb3J5KSA9PiB7XG4gIGNvbnN0IHsgbmFtZSB9ID0gcGF5bG9hZDtcbiAgY29uc3Qgc2x1ZyA9IHNsdWdpZnkobmFtZSk7XG5cbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93KHsgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSB9KTtcbiAgYXdhaXQgYXNzZXJ0TmFtZUF2YWlsYWJsZShuYW1lLCBzbHVnLCBjYXRlZ29yeUlkKTtcblxuICByZXR1cm4gcHJpc21hLmNhdGVnb3J5LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSxcbiAgICBkYXRhOiB7IG5hbWUsIHNsdWcgfSxcbiAgfSk7XG59O1xuXG4vLyBEZWxldGUgY2F0ZWdvcnkgKGFkbWluKSBcdTIwMTQgNDA5IHdoZW4gYW55IHBhY2thZ2UgcmVmZXJlbmNlcyBpdFxuY29uc3QgZGVsZXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kVW5pcXVlT3JUaHJvdyh7IHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0gfSk7XG5cbiAgY29uc3QgcGFja2FnZUNvdW50ID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHtcbiAgICB3aGVyZTogeyBjYXRlZ29yeUlkIH0sXG4gIH0pO1xuXG4gIGlmIChwYWNrYWdlQ291bnQgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDA5LFxuICAgICAgXCJDYW5ub3QgZGVsZXRlIGNhdGVnb3J5IHdpdGggYXNzb2NpYXRlZCBwYWNrYWdlcy4gUmVuYW1lIGl0IGluc3RlYWQuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGF3YWl0IHByaXNtYS5jYXRlZ29yeS5kZWxldGUoeyB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9IH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5U2VydmljZSA9IHtcbiAgY3JlYXRlQ2F0ZWdvcnksXG4gIGdldEFsbENhdGVnb3JpZXMsXG4gIHVwZGF0ZUNhdGVnb3J5LFxuICBkZWxldGVDYXRlZ29yeSxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IG5hbWVTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBuYW1lIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDIsIFwiQ2F0ZWdvcnkgbmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAubWF4KDEwMCwgXCJDYXRlZ29yeSBuYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY3JlYXRlQ2F0ZWdvcnlTY2hlbWEgPSB6Lm9iamVjdCh7IG5hbWU6IG5hbWVTY2hlbWEgfSkuc3RyaWN0KCk7XG5cbmNvbnN0IHVwZGF0ZUNhdGVnb3J5U2NoZW1hID0gei5vYmplY3QoeyBuYW1lOiBuYW1lU2NoZW1hIH0pLnN0cmljdCgpO1xuXG5jb25zdCBjYXRlZ29yeVBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ2F0ZWdvcnkgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZUNhdGVnb3J5U2NoZW1hLFxuICB1cGRhdGVDYXRlZ29yeVNjaGVtYSxcbiAgY2F0ZWdvcnlQYXJhbXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgcGFja2FnZUNvbnRyb2xsZXIgfSBmcm9tIFwiLi9wYWNrYWdlLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHBhY2thZ2VWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3BhY2thZ2UudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gTk9URTogYC9pbnRlcm5hbC8qYCByb3V0ZXMgTVVTVCBzdGF5IHJlZ2lzdGVyZWQgYmVmb3JlIGBHRVQgLzpzbHVnYCBiZWxvdyBcdTIwMTRcbi8vIEV4cHJlc3MgbWF0Y2hlcyB0b3AtZG93biwgYW5kIGEgbGl0ZXJhbCBzZWdtZW50IChgL2ludGVybmFsL2FsbGApIHdvdWxkXG4vLyBvdGhlcndpc2UgYmUgc3dhbGxvd2VkIGJ5IHRoZSBgOnNsdWdgIHBhcmFtIHJvdXRlIGFuZCA0MDQgZm9yZXZlci5cblxuLy8gMS4gTXkgcGFja2FnZXMgKGFnZW50KSBcdTIwMTQgc2VsZi1wcmV2aWV3IG9mIFBFTkRJTkcvUkVKRUNURUQgYmVmb3JlIGFwcHJvdmFsXG5yb3V0ZXIuZ2V0KFxuICBcIi9pbnRlcm5hbC9teS1wYWNrYWdlc1wiLFxuICBhdXRoKFJvbGUuQUdFTlQpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogcGFja2FnZVZhbGlkYXRpb25zLmludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRNeVBhY2thZ2VzLFxuKTtcblxuLy8gMi4gQWxsIHBhY2thZ2VzIChhZG1pbiBtb2RlcmF0aW9uIFVJKVxucm91dGVyLmdldChcbiAgXCIvaW50ZXJuYWwvYWxsXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMuaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldEFsbFBhY2thZ2VzLFxuKTtcblxuLy8gMy4gUHVibGljIHBhY2thZ2UgZGV0YWlsIGJ5IHNsdWdcbnJvdXRlci5nZXQoXG4gIFwiLzpzbHVnXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VTbHVnUGFyYW1zU2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRQYWNrYWdlQnlTbHVnLFxuKTtcblxuLy8gNC4gQ3JlYXRlIHBhY2thZ2UgKGFnZW50IGNyZWF0ZXMgb3duOyBhZG1pbiBjYW4gY3JlYXRlIGZvciBhbnkgYWdlbnQpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHBhY2thZ2VWYWxpZGF0aW9ucy5jcmVhdGVQYWNrYWdlU2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5jcmVhdGVQYWNrYWdlLFxuKTtcblxuLy8gNS4gQXBwcm92ZS9yZWplY3QgcGFja2FnZSAoYWRtaW4pIFx1MjAxNCByZWdpc3RlcmVkIGJlZm9yZSBQQVRDSCAvOmlkIGZvciBjbGFyaXR5XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHBhY2thZ2VWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5jaGFuZ2VQYWNrYWdlU3RhdHVzLFxuKTtcblxuLy8gNi4gVXBkYXRlIHBhY2thZ2UgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBwYWNrYWdlVmFsaWRhdGlvbnMudXBkYXRlUGFja2FnZVNjaGVtYSxcbiAgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLnVwZGF0ZVBhY2thZ2UsXG4pO1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSBwYWNrYWdlIChhZ2VudCBvd24gLyBhZG1pbiBhbnkpXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVBhcmFtc1NjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuc29mdERlbGV0ZVBhY2thZ2UsXG4pO1xuXG4vLyA4LiBQdWJsaWMgbGlzdGluZyBcdTIwMTQga2VwdCBsYXN0IHNvIG5vbmUgb2YgdGhlIGFib3ZlIHJvdXRlcyBhcmUgc2hhZG93ZWRcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VRdWVyeVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0UHVibGljUGFja2FnZXMsXG4pO1xuXG5leHBvcnQgY29uc3QgcGFja2FnZVJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHBhY2thZ2VTZXJ2aWNlIH0gZnJvbSBcIi4vcGFja2FnZS5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIHBhY2thZ2UgY29udHJvbGxlciAoQUdFTlQvQURNSU4pXG5jb25zdCBjcmVhdGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuY3JlYXRlUGFja2FnZShyZXEudXNlciEsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgY3JlYXRlZCBzdWNjZXNzZnVsbHkuIEl0IHdpbGwgYmUgdmlzaWJsZSBhZnRlciBhZG1pbiBhcHByb3ZhbC5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIFB1YmxpYyBsaXN0aW5nIGNvbnRyb2xsZXIgKGZpbHRlcnMgKyBwYWdpbmF0aW9uKVxuY29uc3QgZ2V0UHVibGljUGFja2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRQdWJsaWNQYWNrYWdlcyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gUHVibGljIHBhY2thZ2UgZGV0YWlsIGJ5IHNsdWdcbmNvbnN0IGdldFBhY2thZ2VCeVNsdWcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0UGFja2FnZUJ5U2x1ZyhzbHVnKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBBbGwgcGFja2FnZXMgY29udHJvbGxlciAoQURNSU4gbW9kZXJhdGlvbilcbmNvbnN0IGdldEFsbFBhY2thZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0QWxsUGFja2FnZXMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgcGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA1LiBNeSBwYWNrYWdlcyBjb250cm9sbGVyIChBR0VOVClcbmNvbnN0IGdldE15UGFja2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRNeVBhY2thZ2VzKHVzZXJJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJZb3VyIHBhY2thZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNi4gVXBkYXRlIHBhY2thZ2UgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3QgdXBkYXRlUGFja2FnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLnVwZGF0ZVBhY2thZ2UocmVxLnVzZXIhLCBpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA3LiBDaGFuZ2UgcGFja2FnZSBzdGF0dXMgY29udHJvbGxlciAoQURNSU4gYXBwcm92ZS9yZWplY3QpXG5jb25zdCBjaGFuZ2VQYWNrYWdlU3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuY2hhbmdlUGFja2FnZVN0YXR1cyhpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2Ugc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gOC4gU29mdCBkZWxldGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCBzb2Z0RGVsZXRlUGFja2FnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGF3YWl0IHBhY2thZ2VTZXJ2aWNlLnNvZnREZWxldGVQYWNrYWdlKHJlcS51c2VyISwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VDb250cm9sbGVyID0ge1xuICBjcmVhdGVQYWNrYWdlLFxuICBnZXRQdWJsaWNQYWNrYWdlcyxcbiAgZ2V0UGFja2FnZUJ5U2x1ZyxcbiAgZ2V0QWxsUGFja2FnZXMsXG4gIGdldE15UGFja2FnZXMsXG4gIHVwZGF0ZVBhY2thZ2UsXG4gIGNoYW5nZVBhY2thZ2VTdGF0dXMsXG4gIHNvZnREZWxldGVQYWNrYWdlLFxufTsiLCAiaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuaW1wb3J0IHsgUGFja2FnZVN0YXR1cywgUm9sZSwgTm90aWZpY2F0aW9uVHlwZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgbm90aWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL25vdGlmaWNhdGlvblwiO1xuaW1wb3J0IHsgc2x1Z2lmeSB9IGZyb20gXCIuLi8uLi91dGlscy9zbHVnaWZ5XCI7XG5pbXBvcnQge1xuICBJQ3JlYXRlUGFja2FnZVBheWxvYWQsXG4gIElJbnRlcm5hbFBhY2thZ2VRdWVyeSxcbiAgSVBhY2thZ2VRdWVyeSxcbiAgSVJlcXVlc3RVc2VyLFxuICBJVXBkYXRlUGFja2FnZVBheWxvYWQsXG4gIElVcGRhdGVTdGF0dXNQYXlsb2FkLFxufSBmcm9tIFwiLi9wYWNrYWdlLmludGVyZmFjZVwiO1xuXG4vLyBNb25leSBpcyBgRGVjaW1hbCgxMCwyKWAgaW4gdGhlIHNjaGVtYSAoQUdFTlRTLm1kKSBcdTIwMTQgbWFwIHRvIE51bWJlciBvbiByZXR1cm4uXG5jb25zdCBzZXJpYWxpemVQcmljZSA9IDxUIGV4dGVuZHMgeyBwcmljZTogUHJpc21hLkRlY2ltYWwgfT4ocm93OiBUKTogVCA9PiAoe1xuICAuLi5yb3csXG4gIHByaWNlOiBOdW1iZXIocm93LnByaWNlKSxcbn0pO1xuXG4vLyBQdWJsaWMgcGF5bG9hZHMgY2FycnkgdGhlIGFnZW50J3MgZGlzcGxheSBpbmZvIG9ubHkgXHUyMDE0IG5ldmVyIGVtYWlsLlxuZXhwb3J0IGNvbnN0IHB1YmxpY1BhY2thZ2VJbmNsdWRlID0ge1xuICBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICBhZ2VudDogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGF2YXRhclVybDogdHJ1ZSB9IH0sXG59IGFzIGNvbnN0O1xuXG5jb25zdCB2YWxpZGF0ZUNhdGVnb3J5ID0gYXN5bmMgKGNhdGVnb3J5SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBjYXRlZ29yeSA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIWNhdGVnb3J5KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGNhdGVnb3J5SWRcIik7XG4gIH1cbn07XG5cbi8vIFBhY2thZ2VzIG11c3QgYmUgb3duZWQgYnkgYSBsaXZlIEFHRU5UIFx1MjAxNCBvdGhlcndpc2UgdGhlIGJvb2tpbmcgc3RhdGVcbi8vIG1hY2hpbmUncyBcIkFHRU5UIChvd25zIHBhY2thZ2UpXCIgYnJhbmNoIGFuZCBhZ2VudC1ib29raW5ncyBzY29waW5nIGJyZWFrLlxuY29uc3QgdmFsaWRhdGVBZ2VudCA9IGFzeW5jIChhZ2VudElkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgYWdlbnQgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogYWdlbnRJZCB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgcm9sZTogdHJ1ZSwgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghYWdlbnQgfHwgYWdlbnQucm9sZSAhPT0gUm9sZS5BR0VOVCB8fCBhZ2VudC5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgYWdlbnRJZFwiKTtcbiAgfVxufTtcblxuLy8gQ29sbGlzaW9uLXNhZmUgc2x1ZzogYmFzZSBzbHVnIGZyb20gdGhlIHRpdGxlLCB0aGVuIGAtMmAsIGAtM2AsIC4uLiB1c2luZyBhXG4vLyBzaW5nbGUgcHJlZml4IHF1ZXJ5LiBQdXJlLUJhbmdsYS9lbW9qaSB0aXRsZXMgY2FuJ3Qgc2x1Z2lmeSBcdTIwMTQgZmFsbCBiYWNrIHRvXG4vLyBgcGFja2FnZS08c2hvcnRJZD5gIHNvIHRoZSBVUkwgaXMgYWx3YXlzIG1lYW5pbmdmdWwuXG5jb25zdCBnZW5lcmF0ZVVuaXF1ZVNsdWcgPSBhc3luYyAodGl0bGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gIGNvbnN0IGJhc2UgPSBzbHVnaWZ5KHRpdGxlKSB8fCBgcGFja2FnZS0ke3JhbmRvbVVVSUQoKS5zbGljZSgwLCA4KX1gO1xuXG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICB3aGVyZTogeyBzbHVnOiB7IHN0YXJ0c1dpdGg6IGJhc2UgfSB9LFxuICAgIHNlbGVjdDogeyBzbHVnOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGNvbnN0IHVzZWQgPSBuZXcgU2V0KGV4aXN0aW5nLm1hcCgocCkgPT4gcC5zbHVnKSk7XG4gIGlmICghdXNlZC5oYXMoYmFzZSkpIHtcbiAgICByZXR1cm4gYmFzZTtcbiAgfVxuXG4gIGxldCBzdWZmaXggPSAyO1xuICB3aGlsZSAodXNlZC5oYXMoYCR7YmFzZX0tJHtzdWZmaXh9YCkpIHtcbiAgICBzdWZmaXggKz0gMTtcbiAgfVxuICByZXR1cm4gYCR7YmFzZX0tJHtzdWZmaXh9YDtcbn07XG5cbi8vIDEuIENyZWF0ZSBhIHBhY2thZ2UgKEFHRU5UL0FETUlOKS4gTmV3IHBhY2thZ2VzIHN0YXJ0IFBFTkRJTkcgYW5kIG5ldmVyIGxlYWtcbi8vICAgIGludG8gcHVibGljIHF1ZXJpZXMgdW50aWwgYW4gYWRtaW4gYXBwcm92ZXMgdGhlbS5cbmNvbnN0IGNyZWF0ZVBhY2thZ2UgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYXlsb2FkOiBJQ3JlYXRlUGFja2FnZVBheWxvYWQpID0+IHtcbiAgYXdhaXQgdmFsaWRhdGVDYXRlZ29yeShwYXlsb2FkLmNhdGVnb3J5SWQpO1xuXG4gIC8vIEFETUlOIG1heSBjcmVhdGUgb24gYmVoYWxmIG9mIGFuIGFnZW50IChvcHRpb25hbCBhZ2VudElkKTsgQUdFTlQgYWx3YXlzXG4gIC8vIG93bnMgd2hhdCB0aGV5IGNyZWF0ZSBhbmQgbWF5IG5vdCBpbXBlcnNvbmF0ZSBhbm90aGVyIHVzZXIuXG4gIGxldCBhZ2VudElkOiBzdHJpbmc7XG4gIGlmICh1c2VyLnJvbGUgPT09IFJvbGUuQURNSU4pIHtcbiAgICBpZiAocGF5bG9hZC5hZ2VudElkKSB7XG4gICAgICBhd2FpdCB2YWxpZGF0ZUFnZW50KHBheWxvYWQuYWdlbnRJZCk7XG4gICAgICBhZ2VudElkID0gcGF5bG9hZC5hZ2VudElkO1xuICAgIH0gZWxzZSB7XG4gICAgICBhZ2VudElkID0gdXNlci5pZDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKHBheWxvYWQuYWdlbnRJZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJhZ2VudElkIGNhbiBvbmx5IGJlIHNldCBieSBhbiBhZG1pblwiKTtcbiAgICB9XG4gICAgYWdlbnRJZCA9IHVzZXIuaWQ7XG4gIH1cblxuICBjb25zdCBzbHVnID0gYXdhaXQgZ2VuZXJhdGVVbmlxdWVTbHVnKHBheWxvYWQudGl0bGUpO1xuXG4gIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICB0aXRsZTogcGF5bG9hZC50aXRsZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBwYXlsb2FkLmRlc2NyaXB0aW9uLFxuICAgICAgbG9jYXRpb246IHBheWxvYWQubG9jYXRpb24sXG4gICAgICBwcmljZTogcGF5bG9hZC5wcmljZSxcbiAgICAgIGR1cmF0aW9uOiBwYXlsb2FkLmR1cmF0aW9uLFxuICAgICAgY2F0ZWdvcnlJZDogcGF5bG9hZC5jYXRlZ29yeUlkLFxuICAgICAgaW1hZ2VzOiBwYXlsb2FkLmltYWdlcyxcbiAgICAgIGFnZW50SWQsXG4gICAgICBzbHVnLFxuICAgIH0sXG4gIH0pO1xuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZShjcmVhdGVkKTtcbn07XG5cbi8vIDIuIFB1YmxpYyBleHBsb3JlZCBsaXN0aW5nIFx1MjAxNCBBUFBST1ZFRCArIG5vdC1kZWxldGVkIG9ubHksIGZpbHRlcnMgKyBzb3J0aW5nLlxuY29uc3QgZ2V0UHVibGljUGFja2FnZXMgPSBhc3luYyAocXVlcnk6IElQYWNrYWdlUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCBmaWx0ZXJzOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0W10gPSBbXTtcblxuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgZmlsdGVycy5wdXNoKHtcbiAgICAgIE9SOiBbXG4gICAgICAgIHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgeyBkZXNjcmlwdGlvbjogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICB7IGxvY2F0aW9uOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG4gIGlmIChxdWVyeS5sb2NhdGlvbikge1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICBsb2NhdGlvbjogeyBjb250YWluczogcXVlcnkubG9jYXRpb24sIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9LFxuICAgIH0pO1xuICB9XG4gIGlmIChxdWVyeS5taW5QcmljZSAhPT0gdW5kZWZpbmVkIHx8IHF1ZXJ5Lm1heFByaWNlICE9PSB1bmRlZmluZWQpIHtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgcHJpY2U6IHtcbiAgICAgICAgLi4uKHF1ZXJ5Lm1pblByaWNlICE9PSB1bmRlZmluZWQgPyB7IGd0ZTogcXVlcnkubWluUHJpY2UgfSA6IHt9KSxcbiAgICAgICAgLi4uKHF1ZXJ5Lm1heFByaWNlICE9PSB1bmRlZmluZWQgPyB7IGx0ZTogcXVlcnkubWF4UHJpY2UgfSA6IHt9KSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5Lm1pblJhdGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZmlsdGVycy5wdXNoKHsgcmF0aW5nOiB7IGd0ZTogcXVlcnkubWluUmF0aW5nIH0gfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5Lm1heER1cmF0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICBmaWx0ZXJzLnB1c2goeyBkdXJhdGlvbjogeyBsdGU6IHF1ZXJ5Lm1heER1cmF0aW9uIH0gfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5LmNhdGVnb3J5KSB7XG4gICAgZmlsdGVycy5wdXNoKHsgY2F0ZWdvcnk6IHsgc2x1ZzogcXVlcnkuY2F0ZWdvcnkgfSB9KTtcbiAgfVxuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0ID0ge1xuICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIEFORDogZmlsdGVycy5sZW5ndGggPiAwID8gZmlsdGVycyA6IHVuZGVmaW5lZCxcbiAgfTtcblxuICBjb25zdCBzb3J0T3JkZXIgPSBxdWVyeS5zb3J0T3JkZXIgPz8gKHF1ZXJ5LnNvcnRCeSA9PT0gXCJuZXdlc3RcIiA/IFwiZGVzY1wiIDogXCJhc2NcIik7XG5cbiAgY29uc3Qgb3JkZXJCeU1hcDogUmVjb3JkPHN0cmluZywgUHJpc21hLlRvdXJQYWNrYWdlT3JkZXJCeVdpdGhSZWxhdGlvbklucHV0PiA9IHtcbiAgICBuZXdlc3Q6IHsgY3JlYXRlZEF0OiBzb3J0T3JkZXIgfSxcbiAgICBwcmljZTogeyBwcmljZTogc29ydE9yZGVyIH0sXG4gICAgcmF0aW5nOiB7IHJhdGluZzogc29ydE9yZGVyIH0sXG4gICAgdGl0bGU6IHsgdGl0bGU6IHNvcnRPcmRlciB9LFxuICB9O1xuXG4gIGNvbnN0IG9yZGVyQnkgPSBvcmRlckJ5TWFwW3F1ZXJ5LnNvcnRCeSA/PyBcIm5ld2VzdFwiXSA/PyBvcmRlckJ5TWFwLm5ld2VzdDtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIG9yZGVyQnksXG4gICAgICBpbmNsdWRlOiBwdWJsaWNQYWNrYWdlSW5jbHVkZSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVQcmljZSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMy4gUHVibGljIGRldGFpbCBieSBzbHVnIFx1MjAxNCBBUFBST1ZFRCArIG5vdC1kZWxldGVkIG9ubHkuXG5jb25zdCBnZXRQYWNrYWdlQnlTbHVnID0gYXN5bmMgKHNsdWc6IHN0cmluZykgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7IHNsdWcsIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIGluY2x1ZGU6IHB1YmxpY1BhY2thZ2VJbmNsdWRlLFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UodG91clBhY2thZ2UpO1xufTtcblxuLy8gNC4gQWxsIHBhY2thZ2VzIGZvciB0aGUgYWRtaW4gbW9kZXJhdGlvbiBVSSAoYW55IHN0YXR1cywgb3B0aW9uYWwgZmlsdGVycykuXG5jb25zdCBnZXRBbGxQYWNrYWdlcyA9IGFzeW5jIChxdWVyeTogSUludGVybmFsUGFja2FnZVF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXQgPSB7XG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc3RhdHVzID8geyBzdGF0dXM6IHF1ZXJ5LnN0YXR1cyB9IDoge30pLFxuICAgIC4uLihxdWVyeS5hZ2VudElkID8geyBhZ2VudElkOiBxdWVyeS5hZ2VudElkIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7XG4gICAgICAgIGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0sXG4gICAgICAgIGFnZW50OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVByaWNlKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyA1LiBBbiBhZ2VudCdzIG93biBwYWNrYWdlcyAoYW55IHN0YXR1cykgXHUyMDE0IHNlbGYtcHJldmlldyBiZWZvcmUgYXBwcm92YWwuXG5jb25zdCBnZXRNeVBhY2thZ2VzID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBxdWVyeTogSUludGVybmFsUGFja2FnZVF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXQgPSB7XG4gICAgYWdlbnRJZDogdXNlcklkLFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0gfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVByaWNlKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyBGZXRjaCArIG93bmVyc2hpcCBnYXRlIHNoYXJlZCBieSBQQVRDSCBhbmQgREVMRVRFLiBBRE1JTiBieXBhc3NlcyBvd25lcnNoaXA7XG4vLyBBR0VOVCBlZGl0cyBhcmUgY29uZmluZWQgdG8gdGhlaXIgb3duIHBhY2thZ2VzLlxuY29uc3QgZmluZE93bmVkUGFja2FnZSA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBhY2thZ2VJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiAmJiB0b3VyUGFja2FnZS5hZ2VudElkICE9PSB1c2VyLmlkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2FuIG9ubHkgYWN0IG9uIHlvdXIgb3duIHBhY2thZ2VzLlwiKTtcbiAgfVxuXG4gIHJldHVybiB0b3VyUGFja2FnZTtcbn07XG5cbi8vIDYuIFVwZGF0ZSBhIHBhY2thZ2UuIFNsdWcgbmV2ZXIgY2hhbmdlcyAoa2VlcHMgbGlua3MvYm9va21hcmtzIHZhbGlkKS5cbi8vICAgIEFHRU5UIGVkaXRzIHJlc2V0IHN0YXR1cyB0byBQRU5ESU5HOyBBRE1JTiBlZGl0cyBwcmVzZXJ2ZSBpdC5cbmNvbnN0IHVwZGF0ZVBhY2thZ2UgPSBhc3luYyAoXG4gIHVzZXI6IElSZXF1ZXN0VXNlcixcbiAgcGFja2FnZUlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQYWNrYWdlUGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IGZpbmRPd25lZFBhY2thZ2UodXNlciwgcGFja2FnZUlkKTtcblxuICBpZiAocGF5bG9hZC5jYXRlZ29yeUlkICE9PSB1bmRlZmluZWQpIHtcbiAgICBhd2FpdCB2YWxpZGF0ZUNhdGVnb3J5KHBheWxvYWQuY2F0ZWdvcnlJZCk7XG4gIH1cblxuICBjb25zdCBkYXRhOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVJbnB1dCA9IHtcbiAgICAuLi4ocGF5bG9hZC50aXRsZSAhPT0gdW5kZWZpbmVkID8geyB0aXRsZTogcGF5bG9hZC50aXRsZSB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmRlc2NyaXB0aW9uICE9PSB1bmRlZmluZWQgPyB7IGRlc2NyaXB0aW9uOiBwYXlsb2FkLmRlc2NyaXB0aW9uIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQubG9jYXRpb24gIT09IHVuZGVmaW5lZCA/IHsgbG9jYXRpb246IHBheWxvYWQubG9jYXRpb24gfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5wcmljZSAhPT0gdW5kZWZpbmVkID8geyBwcmljZTogcGF5bG9hZC5wcmljZSB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmR1cmF0aW9uICE9PSB1bmRlZmluZWQgPyB7IGR1cmF0aW9uOiBwYXlsb2FkLmR1cmF0aW9uIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuaW1hZ2VzICE9PSB1bmRlZmluZWQgPyB7IGltYWdlczogcGF5bG9hZC5pbWFnZXMgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5jYXRlZ29yeUlkICE9PSB1bmRlZmluZWRcbiAgICAgID8geyBjYXRlZ29yeTogeyBjb25uZWN0OiB7IGlkOiBwYXlsb2FkLmNhdGVnb3J5SWQgfSB9IH1cbiAgICAgIDoge30pLFxuICAgIC4uLih1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gPyB7IHN0YXR1czogUGFja2FnZVN0YXR1cy5QRU5ESU5HIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhLFxuICAgIGluY2x1ZGU6IHsgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSB9LFxuICB9KTtcblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UodXBkYXRlZCk7XG59O1xuXG4vLyA3LiBBcHByb3ZlL3JlamVjdCBhIHBhY2thZ2UgKGFkbWluKS5cbmNvbnN0IGNoYW5nZVBhY2thZ2VTdGF0dXMgPSBhc3luYyAoXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlU3RhdHVzUGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kVW5pcXVlT3JUaHJvdyh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICB9KTtcblxuICBpZiAodG91clBhY2thZ2UuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDYW5ub3QgY2hhbmdlIHRoZSBzdGF0dXMgb2YgYSBkZWxldGVkIHBhY2thZ2UuXCIpO1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhOiB7IHN0YXR1czogcGF5bG9hZC5zdGF0dXMgfSxcbiAgfSk7XG5cbiAgLy8gYmVzdC1lZmZvcnQgaW4tYXBwIG5vdGlmaWNhdGlvbiB0byB0aGUgc3VibWl0dGluZyBhZ2VudCAobmV2ZXIgZmFpbHMgcmVxdWVzdClcbiAgY29uc3Qgbm90aWZpZWQgPSB7XG4gICAgdHlwZTpcbiAgICAgIHBheWxvYWQuc3RhdHVzID09PSBQYWNrYWdlU3RhdHVzLkFQUFJPVkVEXG4gICAgICAgID8gTm90aWZpY2F0aW9uVHlwZS5QQUNLQUdFX0FQUFJPVkVEXG4gICAgICAgIDogTm90aWZpY2F0aW9uVHlwZS5QQUNLQUdFX1JFSkVDVEVELFxuICAgIHRpdGxlOlxuICAgICAgcGF5bG9hZC5zdGF0dXMgPT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgICAgICAgPyBcIlBhY2thZ2UgYXBwcm92ZWRcIlxuICAgICAgICA6IFwiUGFja2FnZSByZWplY3RlZFwiLFxuICAgIG1lc3NhZ2U6XG4gICAgICBwYXlsb2FkLnN0YXR1cyA9PT0gUGFja2FnZVN0YXR1cy5BUFBST1ZFRFxuICAgICAgICA/IGBZb3VyIHBhY2thZ2UgXCIke3RvdXJQYWNrYWdlLnRpdGxlfVwiIGhhcyBiZWVuIGFwcHJvdmVkIGFuZCBpcyBub3cgbGl2ZS5gXG4gICAgICAgIDogYFlvdXIgcGFja2FnZSBcIiR7dG91clBhY2thZ2UudGl0bGV9XCIgd2FzIHJlamVjdGVkLiBQbGVhc2UgcmV2aWV3IGFuZCByZXN1Ym1pdC5gLFxuICB9O1xuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgbm90aWZ5KFxuICAgICAgdG91clBhY2thZ2UuYWdlbnRJZCxcbiAgICAgIG5vdGlmaWVkLnR5cGUsXG4gICAgICBub3RpZmllZC50aXRsZSxcbiAgICAgIG5vdGlmaWVkLm1lc3NhZ2UsXG4gICAgICBgL2Rhc2hib2FyZC9hZ2VudC9wYWNrYWdlcy8ke3BhY2thZ2VJZH1gLFxuICAgICksXG4gIF0pO1xuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh1cGRhdGVkKTtcbn07XG5cbi8vIDguIFNvZnQgZGVsZXRlIChhZG1pbiBhbnksIGFnZW50IG93bikuXG5jb25zdCBzb2Z0RGVsZXRlUGFja2FnZSA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBhY2thZ2VJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IGZpbmRPd25lZFBhY2thZ2UodXNlciwgcGFja2FnZUlkKTtcblxuICByZXR1cm4gcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VTZXJ2aWNlID0ge1xuICBjcmVhdGVQYWNrYWdlLFxuICBnZXRQdWJsaWNQYWNrYWdlcyxcbiAgZ2V0UGFja2FnZUJ5U2x1ZyxcbiAgZ2V0QWxsUGFja2FnZXMsXG4gIGdldE15UGFja2FnZXMsXG4gIHVwZGF0ZVBhY2thZ2UsXG4gIGNoYW5nZVBhY2thZ2VTdGF0dXMsXG4gIHNvZnREZWxldGVQYWNrYWdlLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgdGl0bGVTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJUaXRsZSBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigzLCBcIlRpdGxlIG11c3QgYmUgYXQgbGVhc3QgMyBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMjAwLCBcIlRpdGxlIG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgZGVzY3JpcHRpb25TY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJEZXNjcmlwdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigxMCwgXCJEZXNjcmlwdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDEwIGNoYXJhY3RlcnNcIilcbiAgLm1heCgxMDAwMCwgXCJEZXNjcmlwdGlvbiBtdXN0IGJlIGF0IG1vc3QgMTAwMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgbG9jYXRpb25TY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJMb2NhdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigyLCBcIkxvY2F0aW9uIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMjAwLCBcIkxvY2F0aW9uIG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgcHJpY2VTY2hlbWEgPSB6XG4gIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJQcmljZSBpcyByZXF1aXJlZFwiIH0pXG4gIC5wb3NpdGl2ZShcIlByaWNlIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXJcIilcbiAgLnJlZmluZSgodmFsKSA9PiBNYXRoLnJvdW5kKHZhbCAqIDEwMCkgLyAxMDAgPT09IHZhbCwge1xuICAgIG1lc3NhZ2U6IFwiUHJpY2UgbXVzdCBoYXZlIGF0IG1vc3QgMiBkZWNpbWFsIHBsYWNlc1wiLFxuICB9KTtcblxuY29uc3QgZHVyYXRpb25TY2hlbWEgPSB6XG4gIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJEdXJhdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC5pbnQoXCJEdXJhdGlvbiBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyIG9mIGRheXNcIilcbiAgLm1pbigxLCBcIkR1cmF0aW9uIG11c3QgYmUgYXQgbGVhc3QgMSBkYXlcIik7XG5cbmNvbnN0IGNhdGVnb3J5SWRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gIC5taW4oMSwgXCJDYXRlZ29yeSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKTtcblxuY29uc3QgaW1hZ2VzU2NoZW1hID0gelxuICAuYXJyYXkoei5zdHJpbmcoKS51cmwoXCJFYWNoIGltYWdlIG11c3QgYmUgYSB2YWxpZCBVUkxcIikpXG4gIC5taW4oMSwgXCJBdCBsZWFzdCBvbmUgaW1hZ2UgaXMgcmVxdWlyZWRcIilcbiAgLm1heCg2LCBcIkF0IG1vc3QgNiBpbWFnZXMgYXJlIGFsbG93ZWRcIik7XG5cbmNvbnN0IGNyZWF0ZVBhY2thZ2VTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYSxcbiAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb25TY2hlbWEsXG4gICAgbG9jYXRpb246IGxvY2F0aW9uU2NoZW1hLFxuICAgIHByaWNlOiBwcmljZVNjaGVtYSxcbiAgICBkdXJhdGlvbjogZHVyYXRpb25TY2hlbWEsXG4gICAgY2F0ZWdvcnlJZDogY2F0ZWdvcnlJZFNjaGVtYSxcbiAgICBpbWFnZXM6IGltYWdlc1NjaGVtYSxcbiAgICBhZ2VudElkOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHVwZGF0ZVBhY2thZ2VTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGxvY2F0aW9uOiBsb2NhdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIHByaWNlOiBwcmljZVNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGR1cmF0aW9uOiBkdXJhdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNhdGVnb3J5SWQ6IGNhdGVnb3J5SWRTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBpbWFnZXM6IGltYWdlc1NjaGVtYS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KClcbiAgLnJlZmluZSgoZGF0YSkgPT4gT2JqZWN0LmtleXMoZGF0YSkubGVuZ3RoID4gMCwge1xuICAgIG1lc3NhZ2U6IFwiQXQgbGVhc3Qgb25lIGZpZWxkIG11c3QgYmUgcHJvdmlkZWQgdG8gdXBkYXRlXCIsXG4gIH0pO1xuXG5jb25zdCBwYWNrYWdlUXVlcnlTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICAgIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIGNhdGVnb3J5OiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBsb2NhdGlvbjogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgbWluUHJpY2U6IHouY29lcmNlLm51bWJlcigpLnBvc2l0aXZlKCkub3B0aW9uYWwoKSxcbiAgICBtYXhQcmljZTogei5jb2VyY2UubnVtYmVyKCkucG9zaXRpdmUoKS5vcHRpb25hbCgpLFxuICAgIG1pblJhdGluZzogei5jb2VyY2UubnVtYmVyKCkubWluKDApLm1heCg1KS5vcHRpb25hbCgpLFxuICAgIG1heER1cmF0aW9uOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgICBzb3J0Qnk6IHpcbiAgICAgIC5lbnVtKFtcIm5ld2VzdFwiLCBcInByaWNlXCIsIFwicmF0aW5nXCIsIFwidGl0bGVcIl0pXG4gICAgICAuZGVmYXVsdChcIm5ld2VzdFwiKSxcbiAgICBzb3J0T3JkZXI6IHouZW51bShbXCJhc2NcIiwgXCJkZXNjXCJdKS5vcHRpb25hbCgpLFxuICB9KVxuICAucmVmaW5lKChkYXRhKSA9PiB7XG4gICAgaWYgKGRhdGEubWluUHJpY2UgIT09IHVuZGVmaW5lZCAmJiBkYXRhLm1heFByaWNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBkYXRhLm1pblByaWNlIDw9IGRhdGEubWF4UHJpY2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9LCB7XG4gICAgbWVzc2FnZTogXCJtaW5QcmljZSBtdXN0IGJlIGxlc3MgdGhhbiBvciBlcXVhbCB0byBtYXhQcmljZVwiLFxuICAgIHBhdGg6IFtcIm1pblByaWNlXCJdLFxuICB9KTtcblxuY29uc3QgaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIHN0YXR1czogelxuICAgIC5lbnVtKFtcIlBFTkRJTkdcIiwgXCJBUFBST1ZFRFwiLCBcIlJFSkVDVEVEXCJdKVxuICAgIC50cmFuc2Zvcm0oKHZhbCkgPT4gdmFsIGFzIFwiUEVORElOR1wiIHwgXCJBUFBST1ZFRFwiIHwgXCJSRUpFQ1RFRFwiKVxuICAgIC5vcHRpb25hbCgpLFxuICBhZ2VudElkOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IHBhY2thZ2VQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgcGFja2FnZVNsdWdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHNsdWc6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBzbHVnIGlzIHJlcXVpcmVkXCIgfSkudHJpbSgpLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVTdGF0dXNTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHN0YXR1czogei5lbnVtKFtcIkFQUFJPVkVEXCIsIFwiUkVKRUNURURcIl0sIHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcIlN0YXR1cyBpcyByZXF1aXJlZFwiLFxuICAgICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlN0YXR1cyBtdXN0IGJlIEFQUFJPVkVEIG9yIFJFSkVDVEVEXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlUGFja2FnZVNjaGVtYSxcbiAgdXBkYXRlUGFja2FnZVNjaGVtYSxcbiAgcGFja2FnZVF1ZXJ5U2NoZW1hLFxuICBpbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSxcbiAgcGFja2FnZVBhcmFtc1NjaGVtYSxcbiAgcGFja2FnZVNsdWdQYXJhbXNTY2hlbWEsXG4gIHVwZGF0ZVN0YXR1c1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBibG9nQ29udHJvbGxlciB9IGZyb20gXCIuL2Jsb2cuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYmxvZ1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYmxvZy52YWxpZGF0aW9uXCI7XG5pbXBvcnQgeyBibG9nQ29tbWVudENvbnRyb2xsZXIgfSBmcm9tIFwiLi9ibG9nQ29tbWVudC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBibG9nQ29tbWVudFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYmxvZ0NvbW1lbnQudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gTk9URTogYC9pbnRlcm5hbC8qYCByb3V0ZXMgTVVTVCBzdGF5IHJlZ2lzdGVyZWQgYmVmb3JlIGBHRVQgLzpzbHVnYCBiZWxvdyBcdTIwMTRcbi8vIEV4cHJlc3MgbWF0Y2hlcyB0b3AtZG93biwgYW5kIGEgbGl0ZXJhbCBzZWdtZW50IChgL2ludGVybmFsL2FsbGApIHdvdWxkXG4vLyBvdGhlcndpc2UgYmUgc3dhbGxvd2VkIGJ5IHRoZSBgOnNsdWdgIHBhcmFtIHJvdXRlIGFuZCA0MDQgZm9yZXZlci5cblxuLy8gMS4gQWxsIHBvc3RzIChhZG1pbiBtb2RlcmF0aW9uIFVJKSBcdTIwMTQgcmVnaXN0ZXJlZCBiZWZvcmUgLzpzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi9pbnRlcm5hbC9hbGxcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJsb2dWYWxpZGF0aW9ucy5pbnRlcm5hbFF1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRBbGxQb3N0cyxcbik7XG5cbi8vIDFiLiBPd24gcG9zdHMgKFwiTXkgUG9zdHNcIiBVSSBmb3IgYWdlbnRzL2FkbWlucykgXHUyMDE0IGJlZm9yZSAvOnNsdWdcbnJvdXRlci5nZXQoXG4gIFwiL215LXBvc3RzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBibG9nVmFsaWRhdGlvbnMuaW50ZXJuYWxRdWVyeVNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0TXlQb3N0cyxcbik7XG5cbi8vIDIuIFB1YmxpYyBsaXN0aW5nIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5XG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJsb2dWYWxpZGF0aW9ucy5wdWJsaWNRdWVyeVNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0UHVibGljUG9zdHMsXG4pO1xuXG4vLyAzLiBQdWJsaWMgcG9zdCBkZXRhaWwgYnkgc2x1Z1xucm91dGVyLmdldChcbiAgXCIvOnNsdWdcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFNsdWdQYXJhbXNTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldFBvc3RCeVNsdWcsXG4pO1xuXG4vLyA0LiBDcmVhdGUgcG9zdCAoYWdlbnQvYWRtaW4gYXV0aG9ycyBvd24gcG9zdHM7IG5ldyBwb3N0cyBzdGFydCBEUkFGVClcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYmxvZ1ZhbGlkYXRpb25zLmNyZWF0ZVBvc3RTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmNyZWF0ZVBvc3QsXG4pO1xuXG4vLyBcdTI1MDBcdTI1MDAgQ29tbWVudHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBOT1RFOiB0aGlzIGJsb2NrIHN0YXlzIGJlZm9yZSBQQVRDSCAvOmlkL3N0YXR1cyBzbyBERUxFVEUgL2NvbW1lbnRzLzppZCBpc1xuLy8gbmV2ZXIgc2hhZG93ZWQgXHUyMDE0IGFuZCBubyBiYXJlIFBBVENIIC86c2x1ZyBvciBERUxFVEUgLzpzbHVnIGlzIGV2ZXIgYWRkZWQuXG5cbi8vIDRhLiBQdWJsaWMgY29tbWVudHMgZm9yIGEgcG9zdCAoUFVCTElTSEVEICsgbm9uLWRlbGV0ZWQgcG9zdCBvbmx5KVxucm91dGVyLmdldChcbiAgXCIvOnNsdWcvY29tbWVudHNcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0U2x1Z1BhcmFtc1NjaGVtYSxcbiAgICBxdWVyeTogYmxvZ0NvbW1lbnRWYWxpZGF0aW9ucy5jb21tZW50UXVlcnlTY2hlbWEsXG4gIH0pLFxuICBibG9nQ29tbWVudENvbnRyb2xsZXIuZ2V0UG9zdENvbW1lbnRzLFxuKTtcblxuLy8gNGIuIENyZWF0ZSBhIGNvbW1lbnQgKGFueSBhdXRoZW50aWNhdGVkIHVzZXIpXG5yb3V0ZXIucG9zdChcbiAgXCIvOnNsdWcvY29tbWVudHNcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RTbHVnUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJsb2dDb21tZW50VmFsaWRhdGlvbnMuY3JlYXRlQ29tbWVudFNjaGVtYSxcbiAgfSksXG4gIGJsb2dDb21tZW50Q29udHJvbGxlci5jcmVhdGVDb21tZW50LFxuKTtcblxuLy8gNGMuIFNvZnQgZGVsZXRlIGEgY29tbWVudCAob3duZXIgb3IgQURNSU4pXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi9jb21tZW50cy86aWRcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJsb2dDb21tZW50VmFsaWRhdGlvbnMuY29tbWVudFBhcmFtc1NjaGVtYSB9KSxcbiAgYmxvZ0NvbW1lbnRDb250cm9sbGVyLmRlbGV0ZUNvbW1lbnQsXG4pO1xuXG4vLyA1LiBQdWJsaXNoL3VucHVibGlzaCBwb3N0IChhZG1pbikgXHUyMDE0IHJlZ2lzdGVyZWQgYmVmb3JlIFBBVENIIC86aWQgZm9yIGNsYXJpdHlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogYmxvZ1ZhbGlkYXRpb25zLnVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIGJsb2dDb250cm9sbGVyLmNoYW5nZVBvc3RTdGF0dXMsXG4pO1xuXG4vLyA2LiBVcGRhdGUgcG9zdCAoYWdlbnQgb3duIC8gYWRtaW4gYW55KSBcdTIwMTQgYWdlbnQgZWRpdHMgcmVzZXQgdG8gRFJBRlRcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBibG9nVmFsaWRhdGlvbnMudXBkYXRlUG9zdFNjaGVtYSxcbiAgfSksXG4gIGJsb2dDb250cm9sbGVyLnVwZGF0ZVBvc3QsXG4pO1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSBwb3N0IChhZ2VudCBvd24gLyBhZG1pbiBhbnkpXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFBhcmFtc1NjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuc29mdERlbGV0ZVBvc3QsXG4pO1xuXG5leHBvcnQgY29uc3QgYmxvZ1JvdXRlcyA9IHJvdXRlcjtcbiIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgYmxvZ1NlcnZpY2UgfSBmcm9tIFwiLi9ibG9nLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgcG9zdCBjb250cm9sbGVyIChBR0VOVC9BRE1JTilcbmNvbnN0IGNyZWF0ZVBvc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5jcmVhdGVQb3N0KHJlcS51c2VyISwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCBjcmVhdGVkIHN1Y2Nlc3NmdWxseS4gSXQgd2lsbCBiZSB2aXNpYmxlIGFmdGVyIHB1Ymxpc2hpbmcuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBQdWJsaWMgbGlzdGluZyBjb250cm9sbGVyIChzZWFyY2ggKyBzb3J0ICsgcGFnaW5hdGlvbilcbmNvbnN0IGdldFB1YmxpY1Bvc3RzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0UHVibGljUG9zdHMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnXG5jb25zdCBnZXRQb3N0QnlTbHVnID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3Qgc2x1ZyA9IFN0cmluZyhyZXEucGFyYW1zLnNsdWcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldFBvc3RCeVNsdWcoc2x1Zyk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNC4gQWxsIHBvc3RzIGNvbnRyb2xsZXIgKEFETUlOIG1vZGVyYXRpb24pXG5jb25zdCBnZXRBbGxQb3N0cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldEFsbFBvc3RzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIHBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNGIuIE93biBwb3N0cyBjb250cm9sbGVyIChBR0VOVC9BRE1JTilcbmNvbnN0IGdldE15UG9zdHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRNeVBvc3RzKHJlcS51c2VyISwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDUuIFVwZGF0ZSBwb3N0IGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHVwZGF0ZVBvc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS51cGRhdGVQb3N0KHJlcS51c2VyISwgaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0IHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNi4gQ2hhbmdlIHBvc3Qgc3RhdHVzIGNvbnRyb2xsZXIgKEFETUlOIHB1Ymxpc2gvdW5wdWJsaXNoKVxuY29uc3QgY2hhbmdlUG9zdFN0YXR1cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmNoYW5nZVBvc3RTdGF0dXMoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0IHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBvc3QgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3Qgc29mdERlbGV0ZVBvc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBhd2FpdCBibG9nU2VydmljZS5zb2Z0RGVsZXRlUG9zdChyZXEudXNlciEsIGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBibG9nQ29udHJvbGxlciA9IHtcbiAgY3JlYXRlUG9zdCxcbiAgZ2V0UHVibGljUG9zdHMsXG4gIGdldFBvc3RCeVNsdWcsXG4gIGdldEFsbFBvc3RzLFxuICBnZXRNeVBvc3RzLFxuICB1cGRhdGVQb3N0LFxuICBjaGFuZ2VQb3N0U3RhdHVzLFxuICBzb2Z0RGVsZXRlUG9zdCxcbn07XG4iLCAiaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuaW1wb3J0IHsgUG9zdFN0YXR1cywgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2x1Z2lmeSB9IGZyb20gXCIuLi8uLi91dGlscy9zbHVnaWZ5XCI7XG5pbXBvcnQge1xuICBJQ3JlYXRlUG9zdFBheWxvYWQsXG4gIElJbnRlcm5hbFBvc3RRdWVyeSxcbiAgSVBvc3RRdWVyeSxcbiAgSVJlcXVlc3RVc2VyLFxuICBJVXBkYXRlUG9zdFBheWxvYWQsXG4gIElVcGRhdGVQb3N0U3RhdHVzUGF5bG9hZCxcbn0gZnJvbSBcIi4vYmxvZy5pbnRlcmZhY2VcIjtcblxuLy8gUHVibGljIHBheWxvYWRzIGNhcnJ5IHRoZSBhdXRob3IncyBkaXNwbGF5IGluZm8gb25seSBcdTIwMTQgbmV2ZXIgZW1haWwvcm9sZS5cbmV4cG9ydCBjb25zdCBwdWJsaWNBdXRob3JTZWxlY3QgPSB7XG4gIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgYXZhdGFyVXJsOiB0cnVlIH0sXG59O1xuXG4vLyBDb2xsaXNpb24tc2FmZSBzbHVnOiBiYXNlIHNsdWcgZnJvbSB0aGUgdGl0bGUsIHRoZW4gYC0yYCwgYC0zYCwgLi4uIHVzaW5nIGFcbi8vIHNpbmdsZSBwcmVmaXggcXVlcnkuIFB1cmUtQmFuZ2xhL2Vtb2ppIHRpdGxlcyBjYW4ndCBzbHVnaWZ5IFx1MjAxNCBmYWxsIGJhY2sgdG9cbi8vIGBibG9nLTxzaG9ydElkPmAgc28gdGhlIFVSTCBpcyBhbHdheXMgbWVhbmluZ2Z1bC5cbmNvbnN0IGdlbmVyYXRlVW5pcXVlU2x1ZyA9IGFzeW5jICh0aXRsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgY29uc3QgYmFzZSA9IHNsdWdpZnkodGl0bGUpIHx8IGBibG9nLSR7cmFuZG9tVVVJRCgpLnNsaWNlKDAsIDgpfWA7XG5cbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgIHdoZXJlOiB7IHNsdWc6IHsgc3RhcnRzV2l0aDogYmFzZSB9IH0sXG4gICAgc2VsZWN0OiB7IHNsdWc6IHRydWUgfSxcbiAgfSk7XG5cbiAgY29uc3QgdXNlZCA9IG5ldyBTZXQoZXhpc3RpbmcubWFwKChwKSA9PiBwLnNsdWcpKTtcbiAgaWYgKCF1c2VkLmhhcyhiYXNlKSkge1xuICAgIHJldHVybiBiYXNlO1xuICB9XG5cbiAgbGV0IHN1ZmZpeCA9IDI7XG4gIHdoaWxlICh1c2VkLmhhcyhgJHtiYXNlfS0ke3N1ZmZpeH1gKSkge1xuICAgIHN1ZmZpeCArPSAxO1xuICB9XG4gIHJldHVybiBgJHtiYXNlfS0ke3N1ZmZpeH1gO1xufTtcblxuLy8gMS4gQ3JlYXRlIGEgcG9zdCAoQUdFTlQvQURNSU4pLiBOZXcgcG9zdHMgc3RhcnQgRFJBRlQgYW5kIG5ldmVyIGxlYWsgaW50b1xuLy8gICAgcHVibGljIHF1ZXJpZXMgdW50aWwgYW4gYWRtaW4gcHVibGlzaGVzIHRoZW0uXG5jb25zdCBjcmVhdGVQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGF5bG9hZDogSUNyZWF0ZVBvc3RQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHNsdWcgPSBhd2FpdCBnZW5lcmF0ZVVuaXF1ZVNsdWcocGF5bG9hZC50aXRsZSk7XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIHRpdGxlOiBwYXlsb2FkLnRpdGxlLFxuICAgICAgZXhjZXJwdDogcGF5bG9hZC5leGNlcnB0LFxuICAgICAgY29udGVudDogcGF5bG9hZC5jb250ZW50LFxuICAgICAgY292ZXJJbWFnZTogcGF5bG9hZC5jb3ZlckltYWdlLFxuICAgICAgc2x1ZyxcbiAgICAgIGF1dGhvcklkOiB1c2VyLmlkLFxuICAgIH0sXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDIuIFB1YmxpYyBibG9nIGxpc3RpbmcgXHUyMDE0IFBVQkxJU0hFRCArIG5vdC1kZWxldGVkIG9ubHksIHNlYXJjaCArIHNvcnQuXG5jb25zdCBnZXRQdWJsaWNQb3N0cyA9IGFzeW5jIChxdWVyeTogSVBvc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQmxvZ1Bvc3RXaGVyZUlucHV0ID0ge1xuICAgIHN0YXR1czogUG9zdFN0YXR1cy5QVUJMSVNIRUQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc2VhcmNoXG4gICAgICA/IHtcbiAgICAgICAgICBPUjogW1xuICAgICAgICAgICAgeyB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICAgICAgeyBleGNlcnB0OiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfVxuICAgICAgOiB7fSksXG4gIH07XG5cbiAgY29uc3Qgc29ydE9yZGVyID0gcXVlcnkuc29ydE9yZGVyID8/IChxdWVyeS5zb3J0QnkgPT09IFwib2xkZXN0XCIgPyBcImFzY1wiIDogXCJkZXNjXCIpO1xuXG4gIGNvbnN0IG9yZGVyQnlNYXA6IFJlY29yZDxzdHJpbmcsIFByaXNtYS5CbG9nUG9zdE9yZGVyQnlXaXRoUmVsYXRpb25JbnB1dD4gPSB7XG4gICAgbmV3ZXN0OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICBvbGRlc3Q6IHsgY3JlYXRlZEF0OiBcImFzY1wiIH0sXG4gICAgdGl0bGU6IHsgdGl0bGU6IHNvcnRPcmRlciB9LFxuICB9O1xuXG4gIGNvbnN0IG9yZGVyQnkgPSBvcmRlckJ5TWFwW3F1ZXJ5LnNvcnRCeSA/PyBcIm5ld2VzdFwiXSA/PyBvcmRlckJ5TWFwLm5ld2VzdDtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIG9yZGVyQnksXG4gICAgICBzZWxlY3Q6IHtcbiAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgIHRpdGxlOiB0cnVlLFxuICAgICAgICBzbHVnOiB0cnVlLFxuICAgICAgICBleGNlcnB0OiB0cnVlLFxuICAgICAgICBjb3ZlckltYWdlOiB0cnVlLFxuICAgICAgICBjcmVhdGVkQXQ6IHRydWUsXG4gICAgICAgIHVwZGF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QsXG4gICAgICB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nUG9zdC5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMy4gUHVibGljIHBvc3QgZGV0YWlsIGJ5IHNsdWcgXHUyMDE0IFBVQkxJU0hFRCArIG5vdC1kZWxldGVkIG9ubHkuXG5jb25zdCBnZXRQb3N0QnlTbHVnID0gYXN5bmMgKHNsdWc6IHN0cmluZykgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHsgc2x1Zywgc3RhdHVzOiBQb3N0U3RhdHVzLlBVQkxJU0hFRCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG5cbiAgaWYgKCFwb3N0KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQb3N0IG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4gcG9zdDtcbn07XG5cbi8vIDQuIEFsbCBwb3N0cyBmb3IgdGhlIGFkbWluIG1vZGVyYXRpb24gVUkgKGFueSBzdGF0dXMsIG9wdGlvbmFsIGZpbHRlcikuXG5jb25zdCBnZXRBbGxQb3N0cyA9IGFzeW5jIChxdWVyeTogSUludGVybmFsUG9zdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5CbG9nUG9zdFdoZXJlSW5wdXQgPSB7XG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc3RhdHVzID8geyBzdGF0dXM6IHF1ZXJ5LnN0YXR1cyB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBhdXRob3I6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0gfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nUG9zdC5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gNGIuIFRoZSBjYWxsZXIncyBvd24gcG9zdHMgKEFHRU5UL0FETUlOIFwiTXkgUG9zdHNcIiBVSSkgXHUyMDE0IGFueSBzdGF0dXMsIHNpbmNlXG4vLyAgICAgYWdlbnRzIG11c3Qgc2VlIHRoZWlyIG93biBkcmFmdHMgYmVmb3JlIGFuIGFkbWluIHB1Ymxpc2hlcyB0aGVtLlxuY29uc3QgZ2V0TXlQb3N0cyA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHF1ZXJ5OiBJSW50ZXJuYWxQb3N0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkJsb2dQb3N0V2hlcmVJbnB1dCA9IHtcbiAgICBhdXRob3JJZDogdXNlci5pZCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zdGF0dXMgPyB7IHN0YXR1czogcXVlcnkuc3RhdHVzIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IGF1dGhvcjogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0gfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmJsb2dQb3N0LmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyBGZXRjaCArIG93bmVyc2hpcCBnYXRlIHNoYXJlZCBieSBQQVRDSCBhbmQgREVMRVRFLiBBRE1JTiBieXBhc3NlcyBvd25lcnNoaXA7XG4vLyBBR0VOVCBlZGl0cyBhcmUgY29uZmluZWQgdG8gdGhlaXIgb3duIHBvc3RzLlxuY29uc3QgZmluZE93bmVkUG9zdCA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBvc3RJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHBvc3QgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICB9KTtcblxuICBpZiAoIXBvc3QpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBvc3Qgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGlmICh1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gJiYgcG9zdC5hdXRob3JJZCAhPT0gdXNlci5pZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGNhbiBvbmx5IGFjdCBvbiB5b3VyIG93biBwb3N0cy5cIik7XG4gIH1cblxuICByZXR1cm4gcG9zdDtcbn07XG5cbi8vIDUuIFVwZGF0ZSBhIHBvc3QuIFNsdWcgbmV2ZXIgY2hhbmdlcyAoa2VlcHMgbGlua3MvYm9va21hcmtzIHZhbGlkKS5cbi8vICAgIEFHRU5UIGVkaXRzIHJlc2V0IHN0YXR1cyB0byBEUkFGVCAocmUtcHVibGlzaCB2aWEgLzppZC9zdGF0dXMpO1xuLy8gICAgQURNSU4gZWRpdHMgcHJlc2VydmUgc3RhdHVzLlxuY29uc3QgdXBkYXRlUG9zdCA9IGFzeW5jIChcbiAgdXNlcjogSVJlcXVlc3RVc2VyLFxuICBwb3N0SWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVBvc3RQYXlsb2FkLFxuKSA9PiB7XG4gIGF3YWl0IGZpbmRPd25lZFBvc3QodXNlciwgcG9zdElkKTtcblxuICBjb25zdCBkYXRhOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVJbnB1dCA9IHtcbiAgICAuLi4ocGF5bG9hZC50aXRsZSAhPT0gdW5kZWZpbmVkID8geyB0aXRsZTogcGF5bG9hZC50aXRsZSB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmV4Y2VycHQgIT09IHVuZGVmaW5lZCA/IHsgZXhjZXJwdDogcGF5bG9hZC5leGNlcnB0IH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuY29udGVudCAhPT0gdW5kZWZpbmVkID8geyBjb250ZW50OiBwYXlsb2FkLmNvbnRlbnQgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5jb3ZlckltYWdlICE9PSB1bmRlZmluZWRcbiAgICAgID8geyBjb3ZlckltYWdlOiBwYXlsb2FkLmNvdmVySW1hZ2UgfVxuICAgICAgOiB7fSksXG4gICAgLi4uKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiA/IHsgc3RhdHVzOiBQb3N0U3RhdHVzLkRSQUZUIH0gOiB7fSksXG4gIH07XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgICBkYXRhLFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG59O1xuXG4vLyA2LiBQdWJsaXNoL3VucHVibGlzaCBhIHBvc3QgKGFkbWluKS5cbmNvbnN0IGNoYW5nZVBvc3RTdGF0dXMgPSBhc3luYyAoXG4gIHBvc3RJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlUG9zdFN0YXR1c1BheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kVW5pcXVlT3JUaHJvdyh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICB9KTtcblxuICBpZiAocG9zdC5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkNhbm5vdCBjaGFuZ2UgdGhlIHN0YXR1cyBvZiBhIGRlbGV0ZWQgcG9zdC5cIik7XG4gIH1cblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICAgIGRhdGE6IHsgc3RhdHVzOiBwYXlsb2FkLnN0YXR1cyB9LFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG59O1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSAoYWRtaW4gYW55LCBhZ2VudCBvd24pLlxuY29uc3Qgc29mdERlbGV0ZVBvc3QgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwb3N0SWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBmaW5kT3duZWRQb3N0KHVzZXIsIHBvc3RJZCk7XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSB9LFxuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBibG9nU2VydmljZSA9IHtcbiAgY3JlYXRlUG9zdCxcbiAgZ2V0UHVibGljUG9zdHMsXG4gIGdldFBvc3RCeVNsdWcsXG4gIGdldEFsbFBvc3RzLFxuICBnZXRNeVBvc3RzLFxuICB1cGRhdGVQb3N0LFxuICBjaGFuZ2VQb3N0U3RhdHVzLFxuICBzb2Z0RGVsZXRlUG9zdCxcbn07XG4iLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgdGl0bGVTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJUaXRsZSBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigzLCBcIlRpdGxlIG11c3QgYmUgYXQgbGVhc3QgMyBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMjAwLCBcIlRpdGxlIG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgZXhjZXJwdFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkV4Y2VycHQgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMSwgXCJFeGNlcnB0IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gIC5tYXgoNTAwLCBcIkV4Y2VycHQgbXVzdCBiZSBhdCBtb3N0IDUwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBjb250ZW50U2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ29udGVudCBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigxLCBcIkNvbnRlbnQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgLm1heCgxMDAwMCwgXCJDb250ZW50IG11c3QgYmUgYXQgbW9zdCAxMDAwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBjb3ZlckltYWdlU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ292ZXIgaW1hZ2UgaXMgcmVxdWlyZWRcIiB9KVxuICAudXJsKFwiQ292ZXIgaW1hZ2UgbXVzdCBiZSBhIHZhbGlkIFVSTFwiKTtcblxuY29uc3QgY3JlYXRlUG9zdFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLFxuICAgIGV4Y2VycHQ6IGV4Y2VycHRTY2hlbWEsXG4gICAgY29udGVudDogY29udGVudFNjaGVtYSxcbiAgICBjb3ZlckltYWdlOiBjb3ZlckltYWdlU2NoZW1hLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHVwZGF0ZVBvc3RTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGV4Y2VycHQ6IGV4Y2VycHRTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBjb250ZW50OiBjb250ZW50U2NoZW1hLm9wdGlvbmFsKCksXG4gICAgY292ZXJJbWFnZTogY292ZXJJbWFnZVNjaGVtYS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KClcbiAgLnJlZmluZSgoZGF0YSkgPT4gT2JqZWN0LmtleXMoZGF0YSkubGVuZ3RoID4gMCwge1xuICAgIG1lc3NhZ2U6IFwiQXQgbGVhc3Qgb25lIGZpZWxkIG11c3QgYmUgcHJvdmlkZWQgdG8gdXBkYXRlXCIsXG4gIH0pO1xuXG5jb25zdCBwb3N0UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQb3N0IGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IHBvc3RTbHVnUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBzbHVnOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBvc3Qgc2x1ZyBpcyByZXF1aXJlZFwiIH0pLnRyaW0oKS5taW4oMSksXG59KTtcblxuY29uc3QgdXBkYXRlU3RhdHVzU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBzdGF0dXM6IHouZW51bShbXCJEUkFGVFwiLCBcIlBVQkxJU0hFRFwiXSwge1xuICAgICAgcmVxdWlyZWRfZXJyb3I6IFwiU3RhdHVzIGlzIHJlcXVpcmVkXCIsXG4gICAgICBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiU3RhdHVzIG11c3QgYmUgRFJBRlQgb3IgUFVCTElTSEVEXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgcHVibGljUXVlcnlTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICAgIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIHNvcnRCeTogei5lbnVtKFtcIm5ld2VzdFwiLCBcIm9sZGVzdFwiLCBcInRpdGxlXCJdKS5kZWZhdWx0KFwibmV3ZXN0XCIpLFxuICAgIHNvcnRPcmRlcjogei5lbnVtKFtcImFzY1wiLCBcImRlc2NcIl0pLm9wdGlvbmFsKCksXG4gIH0pO1xuXG5jb25zdCBpbnRlcm5hbFF1ZXJ5U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gICAgc3RhdHVzOiB6XG4gICAgICAuZW51bShbXCJEUkFGVFwiLCBcIlBVQkxJU0hFRFwiXSlcbiAgICAgIC50cmFuc2Zvcm0oKHZhbCkgPT4gdmFsIGFzIFwiRFJBRlRcIiB8IFwiUFVCTElTSEVEXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgfSk7XG5cbmV4cG9ydCBjb25zdCBibG9nVmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVBvc3RTY2hlbWEsXG4gIHVwZGF0ZVBvc3RTY2hlbWEsXG4gIHBvc3RQYXJhbXNTY2hlbWEsXG4gIHBvc3RTbHVnUGFyYW1zU2NoZW1hLFxuICB1cGRhdGVTdGF0dXNTY2hlbWEsXG4gIHB1YmxpY1F1ZXJ5U2NoZW1hLFxuICBpbnRlcm5hbFF1ZXJ5U2NoZW1hLFxufTtcbiIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgYmxvZ0NvbW1lbnRTZXJ2aWNlIH0gZnJvbSBcIi4vYmxvZ0NvbW1lbnQuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIFB1YmxpYyBjb21tZW50cyBmb3IgYSBwb3N0IGNvbnRyb2xsZXJcbmNvbnN0IGdldFBvc3RDb21tZW50cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHNsdWcgPSBTdHJpbmcocmVxLnBhcmFtcy5zbHVnKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nQ29tbWVudFNlcnZpY2UuZ2V0UG9zdENvbW1lbnRzKHNsdWcsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ29tbWVudHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBDcmVhdGUgYSBjb21tZW50IGNvbnRyb2xsZXIgKGFueSBhdXRoZW50aWNhdGVkIHVzZXIpXG5jb25zdCBjcmVhdGVDb21tZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3Qgc2x1ZyA9IFN0cmluZyhyZXEucGFyYW1zLnNsdWcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dDb21tZW50U2VydmljZS5jcmVhdGVDb21tZW50KHVzZXJJZCwgc2x1ZywgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiQ29tbWVudCBwb3N0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gU29mdCBkZWxldGUgY29tbWVudCBjb250cm9sbGVyIChvd25lciBvciBBRE1JTilcbmNvbnN0IGRlbGV0ZUNvbW1lbnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByb2xlID0gcmVxLnVzZXIhLnJvbGU7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgYXdhaXQgYmxvZ0NvbW1lbnRTZXJ2aWNlLmRlbGV0ZUNvbW1lbnQodXNlcklkLCByb2xlLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ29tbWVudCBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYmxvZ0NvbW1lbnRDb250cm9sbGVyID0ge1xuICBnZXRQb3N0Q29tbWVudHMsXG4gIGNyZWF0ZUNvbW1lbnQsXG4gIGRlbGV0ZUNvbW1lbnQsXG59OyIsICJpbXBvcnQgeyBQb3N0U3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBwdWJsaWNBdXRob3JTZWxlY3QgfSBmcm9tIFwiLi9ibG9nLnNlcnZpY2VcIjtcbmltcG9ydCB7IElDcmVhdGVDb21tZW50UGF5bG9hZCwgSUNvbW1lbnRRdWVyeSB9IGZyb20gXCIuL2Jsb2dDb21tZW50LmludGVyZmFjZVwiO1xuXG4vLyBTaGFyZWQgdmlzaWJpbGl0eSBydWxlOiBjb21tZW50cyBvbmx5IGV2ZXIgYXBwZWFyIHVuZGVyIGEgUFVCTElTSEVELFxuLy8gbm9uLWRlbGV0ZWQgcG9zdCBcdTIwMTQgdGhlIHNhbWUgcnVsZSBhcyBnZXRQb3N0QnlTbHVnLlxuY29uc3QgZ2V0UG9zdElkQnlTbHVnID0gYXN5bmMgKHNsdWc6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gIGNvbnN0IHBvc3QgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZEZpcnN0KHtcbiAgICB3aGVyZTogeyBzbHVnLCBzdGF0dXM6IFBvc3RTdGF0dXMuUFVCTElTSEVELCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghcG9zdCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUG9zdCBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc3QuaWQ7XG59O1xuXG4vLyAxLiBQdWJsaWMgY29tbWVudHMgZm9yIGEgcG9zdCBcdTIwMTQgdG9wLWxldmVsICsgdGhlaXIgcmVwbGllcyBpbiB0d28gcXVlcmllczpcbi8vICAgIHRvcC1sZXZlbCBuZXdlc3QtZmlyc3QsIHJlcGxpZXMgb2xkZXN0LWZpcnN0IChjb252ZXJzYXRpb24gb3JkZXIpLlxuY29uc3QgZ2V0UG9zdENvbW1lbnRzID0gYXN5bmMgKHNsdWc6IHN0cmluZywgcXVlcnk6IElDb21tZW50UXVlcnkpID0+IHtcbiAgY29uc3QgcG9zdElkID0gYXdhaXQgZ2V0UG9zdElkQnlTbHVnKHNsdWcpO1xuXG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3QgdG9wTGV2ZWxXaGVyZTogUHJpc21hLkJsb2dDb21tZW50V2hlcmVJbnB1dCA9IHtcbiAgICBwb3N0SWQsXG4gICAgcGFyZW50SWQ6IG51bGwsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgfTtcblxuICBjb25zdCBbdG9wTGV2ZWwsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYmxvZ0NvbW1lbnQuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHRvcExldmVsV2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IHVzZXI6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmJsb2dDb21tZW50LmNvdW50KHsgd2hlcmU6IHRvcExldmVsV2hlcmUgfSksXG4gIF0pO1xuXG4gIGNvbnN0IHJlcGxpZXMgPSB0b3BMZXZlbC5sZW5ndGggPiAwXG4gICAgPyBhd2FpdCBwcmlzbWEuYmxvZ0NvbW1lbnQuZmluZE1hbnkoe1xuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIHBvc3RJZCxcbiAgICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgICAgIHBhcmVudElkOiB7IGluOiB0b3BMZXZlbC5tYXAoKGMpID0+IGMuaWQpIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGluY2x1ZGU6IHsgdXNlcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gICAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImFzY1wiIH0sXG4gICAgICB9KVxuICAgIDogW107XG5cbiAgY29uc3QgcmVwbHlNYXAgPSBuZXcgTWFwPHN0cmluZywgdHlwZW9mIHJlcGxpZXM+KCk7XG4gIGZvciAoY29uc3QgcmVwbHkgb2YgcmVwbGllcykge1xuICAgIGNvbnN0IGxpc3QgPSByZXBseU1hcC5nZXQocmVwbHkucGFyZW50SWQhKSA/PyBbXTtcbiAgICBsaXN0LnB1c2gocmVwbHkpO1xuICAgIHJlcGx5TWFwLnNldChyZXBseS5wYXJlbnRJZCEsIGxpc3QpO1xuICB9XG5cbiAgY29uc3QgZGF0YSA9IHRvcExldmVsLm1hcCgoY29tbWVudCkgPT4gKHtcbiAgICAuLi5jb21tZW50LFxuICAgIHJlcGxpZXM6IHJlcGx5TWFwLmdldChjb21tZW50LmlkKSA/PyBbXSxcbiAgfSkpO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAyLiBDcmVhdGUgYSBjb21tZW50IChhbnkgYXV0aGVudGljYXRlZCB1c2VyKS4gT25lLWxldmVsIHJlcGxpZXMgb25seTogYVxuLy8gICAgcGFyZW50IG11c3QgYmUgYSB0b3AtbGV2ZWwgY29tbWVudCBvbiB0aGUgc2FtZSBwb3N0LlxuY29uc3QgY3JlYXRlQ29tbWVudCA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHNsdWc6IHN0cmluZyxcbiAgcGF5bG9hZDogSUNyZWF0ZUNvbW1lbnRQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHBvc3RJZCA9IGF3YWl0IGdldFBvc3RJZEJ5U2x1ZyhzbHVnKTtcblxuICBsZXQgcGFyZW50SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBpZiAocGF5bG9hZC5wYXJlbnRJZCkge1xuICAgIGNvbnN0IHBhcmVudCA9IGF3YWl0IHByaXNtYS5ibG9nQ29tbWVudC5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgaWQ6IHBheWxvYWQucGFyZW50SWQsXG4gICAgICAgIHBvc3RJZCxcbiAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIHBhcmVudElkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXBhcmVudCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJQYXJlbnQgY29tbWVudCBub3QgZm91bmQgb24gdGhpcyBwb3N0LlwiKTtcbiAgICB9XG5cbiAgICBpZiAocGFyZW50LnBhcmVudElkICE9PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIlJlcGxpZXMgdG8gcmVwbGllcyBhcmUgbm90IGFsbG93ZWQuXCIpO1xuICAgIH1cblxuICAgIHBhcmVudElkID0gcGFyZW50LmlkO1xuICB9XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nQ29tbWVudC5jcmVhdGUoe1xuICAgIGRhdGE6IHsgY29udGVudDogcGF5bG9hZC5jb250ZW50LCBwb3N0SWQsIHVzZXJJZCwgcGFyZW50SWQgfSxcbiAgICBpbmNsdWRlOiB7IHVzZXI6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDMuIFNvZnQgZGVsZXRlIGEgY29tbWVudCBcdTIwMTQgb3duZXIgb3IgQURNSU4uIEEgZm9yZWlnbiBpZCwgYW4gYWxyZWFkeS1kZWxldGVkXG4vLyAgICBjb21tZW50LCBvciBhIG5vbmV4aXN0ZW50IG9uZSBpcyBhIHVuaWZvcm0gNDA0IChuZXZlciBhIGxlYWspLlxuY29uc3QgZGVsZXRlQ29tbWVudCA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHJvbGU6IFJvbGUsXG4gIGNvbW1lbnRJZDogc3RyaW5nLFxuKSA9PiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS5ibG9nQ29tbWVudC51cGRhdGVNYW55KHtcbiAgICB3aGVyZToge1xuICAgICAgaWQ6IGNvbW1lbnRJZCxcbiAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICAuLi4ocm9sZSAhPT0gUm9sZS5BRE1JTiA/IHsgdXNlcklkIH0gOiB7fSksXG4gICAgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAocmVzdWx0LmNvdW50ID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJDb21tZW50IG5vdCBmb3VuZC5cIik7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBibG9nQ29tbWVudFNlcnZpY2UgPSB7XG4gIGdldFBvc3RDb21tZW50cyxcbiAgY3JlYXRlQ29tbWVudCxcbiAgZGVsZXRlQ29tbWVudCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZUNvbW1lbnRTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIGNvbnRlbnQ6IHpcbiAgICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb250ZW50IGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC50cmltKClcbiAgICAgIC5taW4oMSwgXCJDb250ZW50IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gICAgICAubWF4KDIwMDAsIFwiQ29udGVudCBtdXN0IGJlIGF0IG1vc3QgMjAwMCBjaGFyYWN0ZXJzXCIpLFxuICAgIHBhcmVudElkOiB6LnN0cmluZygpLm1pbigxLCBcInBhcmVudElkIG11c3Qgbm90IGJlIGVtcHR5XCIpLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgY29tbWVudFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ29tbWVudCBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbigxLCBcIkNvbW1lbnQgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG59KTtcblxuY29uc3QgY29tbWVudFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxufSk7XG5cbmV4cG9ydCBjb25zdCBibG9nQ29tbWVudFZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVDb21tZW50U2NoZW1hLFxuICBjb21tZW50UGFyYW1zU2NoZW1hLFxuICBjb21tZW50UXVlcnlTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgZGFzaGJvYXJkQ29udHJvbGxlciB9IGZyb20gXCIuL2Rhc2hib2FyZC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBkYXNoYm9hcmRWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2Rhc2hib2FyZC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBBZG1pbiBkYXNoYm9hcmQgXHUyMDE0IHBsYXRmb3JtLXdpZGUgYW5hbHl0aWNzXG5yb3V0ZXIuZ2V0KFxuICBcIi9hZG1pblwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogZGFzaGJvYXJkVmFsaWRhdGlvbnMuZGFzaGJvYXJkUXVlcnlTY2hlbWEgfSksXG4gIGRhc2hib2FyZENvbnRyb2xsZXIuZ2V0QWRtaW5EYXNoYm9hcmQsXG4pO1xuXG4vLyAyLiBBZ2VudCBkYXNoYm9hcmQgXHUyMDE0IG93biBwYWNrYWdlcy9ib29raW5ncy9yZXZlbnVlL3BlcmZvcm1hbmNlXG5yb3V0ZXIuZ2V0KFxuICBcIi9hZ2VudFwiLFxuICBhdXRoKFJvbGUuQUdFTlQpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogZGFzaGJvYXJkVmFsaWRhdGlvbnMuZGFzaGJvYXJkUXVlcnlTY2hlbWEgfSksXG4gIGRhc2hib2FyZENvbnRyb2xsZXIuZ2V0QWdlbnREYXNoYm9hcmQsXG4pO1xuXG4vLyAzLiBVc2VyIGRhc2hib2FyZCBcdTIwMTQgb3duIGJvb2tpbmdzL3VwY29taW5nL3NwZW5kXG5yb3V0ZXIuZ2V0KFxuICBcIi91c2VyXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGRhc2hib2FyZFZhbGlkYXRpb25zLmRhc2hib2FyZFF1ZXJ5U2NoZW1hIH0pLFxuICBkYXNoYm9hcmRDb250cm9sbGVyLmdldFVzZXJEYXNoYm9hcmQsXG4pO1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgZGFzaGJvYXJkU2VydmljZSB9IGZyb20gXCIuL2Rhc2hib2FyZC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQWRtaW4gZGFzaGJvYXJkIGNvbnRyb2xsZXIgKEFETUlOKVxuY29uc3QgZ2V0QWRtaW5EYXNoYm9hcmQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkYXNoYm9hcmRTZXJ2aWNlLmdldEFkbWluRGFzaGJvYXJkKFxuICAgICAgTnVtYmVyKHJlcS5xdWVyeS5kYXlzKSxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRhc2hib2FyZCBkYXRhIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gQWdlbnQgZGFzaGJvYXJkIGNvbnRyb2xsZXIgKEFHRU5UKVxuY29uc3QgZ2V0QWdlbnREYXNoYm9hcmQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkYXNoYm9hcmRTZXJ2aWNlLmdldEFnZW50RGFzaGJvYXJkKFxuICAgICAgdXNlcklkLFxuICAgICAgTnVtYmVyKHJlcS5xdWVyeS5kYXlzKSxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRhc2hib2FyZCBkYXRhIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gVXNlciBkYXNoYm9hcmQgY29udHJvbGxlciAoVVNFUilcbmNvbnN0IGdldFVzZXJEYXNoYm9hcmQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkYXNoYm9hcmRTZXJ2aWNlLmdldFVzZXJEYXNoYm9hcmQoXG4gICAgICB1c2VySWQsXG4gICAgICBOdW1iZXIocmVxLnF1ZXJ5LmRheXMpLFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGFzaGJvYXJkIGRhdGEgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkQ29udHJvbGxlciA9IHtcbiAgZ2V0QWRtaW5EYXNoYm9hcmQsXG4gIGdldEFnZW50RGFzaGJvYXJkLFxuICBnZXRVc2VyRGFzaGJvYXJkLFxufTsiLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzLCBQYWNrYWdlU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQge1xuICBJQWdlbnREYXNoYm9hcmQsXG4gIElBZG1pbkRhc2hib2FyZCxcbiAgSUJvb2tpbmdzQnlTdGF0dXMsXG4gIElSZXZlbnVlUG9pbnQsXG4gIElVc2VyRGFzaGJvYXJkLFxufSBmcm9tIFwiLi9kYXNoYm9hcmQuaW50ZXJmYWNlXCI7XG5cbi8vIE1vbmV5IGlzIGBEZWNpbWFsKDEwLDIpYCBpbiB0aGUgc2NoZW1hIChBR0VOVFMubWQpIFx1MjAxNCBtYXAgdG8gTnVtYmVyIG9uIHJldHVybi5cbmNvbnN0IHRvTnVtYmVyID0gKHZhbHVlOiB1bmtub3duKTogbnVtYmVyID0+IE51bWJlcih2YWx1ZSA/PyAwKTtcblxuLy8gQm9va2luZy1zdGF0dXMgYnJlYWtkb3duIHZpYSBncm91cEJ5ICsgX2NvdW50LiBPcHRpb25hbCBzY29wZSBsaW1pdHMgaXQgdG9cbi8vIGFuIGFnZW50J3Mgb3duIG5vbi1kZWxldGVkIHBhY2thZ2VzIG9yIGEgc2luZ2xlIHVzZXIncyBib29raW5ncy5cbmNvbnN0IGdldEJvb2tpbmdzQnlTdGF0dXMgPSBhc3luYyAoXG4gIHNjb3BlOiB7IGFnZW50SWQ/OiBzdHJpbmc7IHVzZXJJZD86IHN0cmluZyB9ID0ge30sXG4pOiBQcm9taXNlPElCb29raW5nc0J5U3RhdHVzW10+ID0+IHtcbiAgY29uc3QgZ3JvdXBlZCA9IGF3YWl0IHByaXNtYS5ib29raW5nLmdyb3VwQnkoe1xuICAgIGJ5OiBbXCJzdGF0dXNcIl0sXG4gICAgX2NvdW50OiB7IF9hbGw6IHRydWUgfSxcbiAgICB3aGVyZTogc2NvcGUuYWdlbnRJZFxuICAgICAgPyB7IHBhY2thZ2U6IHsgYWdlbnRJZDogc2NvcGUuYWdlbnRJZCwgaXNEZWxldGVkOiBmYWxzZSB9IH1cbiAgICAgIDogc2NvcGUudXNlcklkXG4gICAgICAgID8geyB1c2VySWQ6IHNjb3BlLnVzZXJJZCB9XG4gICAgICAgIDogdW5kZWZpbmVkLFxuICB9KTtcblxuICByZXR1cm4gZ3JvdXBlZFxuICAgIC5tYXAoKGcpID0+ICh7IHN0YXR1czogZy5zdGF0dXMsIGNvdW50OiBnLl9jb3VudC5fYWxsIH0pKVxuICAgIC5zb3J0KChhLCBiKSA9PiBiLmNvdW50IC0gYS5jb3VudCk7XG59O1xuXG4vLyBSZXZlbnVlIHRyZW5kOiBvbmUgcm93IHBlciBkYXkgZm9yIHRoZSBsYXN0IGBkYXlzYCBkYXlzLCBidWNrZXRpbmcgQ09NUExFVEVEXG4vLyBib29raW5ncyBieSB0aGVpciBgdXBkYXRlZEF0YCBcdTIwMTQgdGhlIHRpbWVzdGFtcCBvZiB0aGUgdHJhbnNpdGlvbiBpbnRvXG4vLyBDT01QTEVURUQgKGEgdGVybWluYWwgc3RhdGUsIHNvIGl0IGlzIHRoZSBsYXN0IHdyaXRlKS4gYGNyZWF0ZWRBdGAgaXMgd2hlblxuLy8gdGhlIGJvb2tpbmcgd2FzIG1hZGUgKFBFTkRJTkcpIGFuZCBuZXZlciBtb3Zlcywgd2hpY2ggd291bGQgbWlzLWRhdGUgcmV2ZW51ZVxuLy8gd2Vla3MgbGF0ZXIuIFBvc3RncmVzIGdlbmVyYXRlX3NlcmllcyBndWFyYW50ZWVzIGEgZGVuc2Ugc2VyaWVzICh6ZXJvLWZpbGxlZFxuLy8gZGF5cykgXHUyMDE0IGJldHRlciBhbmQgZmFzdGVyIHRoYW4gYSBwZXItZGF5IEpTIGxvb3AuIE9wdGlvbmFsIHNjb3BlOiBhbiBhZ2VudCdzXG4vLyBvd24gbm9uLWRlbGV0ZWQgcGFja2FnZXMsIG9yIGEgc2luZ2xlIHVzZXIncyBzcGVuZC5cbmNvbnN0IGdldFJldmVudWVPdmVyVGltZSA9IGFzeW5jIChcbiAgZGF5czogbnVtYmVyLFxuICBzY29wZTogeyBhZ2VudElkPzogc3RyaW5nOyB1c2VySWQ/OiBzdHJpbmcgfSA9IHt9LFxuKTogUHJvbWlzZTxJUmV2ZW51ZVBvaW50W10+ID0+IHtcbiAgY29uc3QgYWdlbnRTY29wZSA9IHNjb3BlLmFnZW50SWRcbiAgICA/IGBBTkQgYi5cInBhY2thZ2VJZFwiIElOIChcbiAgICAgICAgIFNFTEVDVCBwLlwiaWRcIlxuICAgICAgICAgRlJPTSBcInRvdXJfcGFja2FnZXNcIiBwXG4gICAgICAgICBXSEVSRSBwLlwiYWdlbnRJZFwiID0gJDJcbiAgICAgICAgICAgQU5EIHAuXCJpc0RlbGV0ZWRcIiA9IGZhbHNlXG4gICAgICAgKWBcbiAgICA6IFwiXCI7XG4gIGNvbnN0IHVzZXJTY29wZSA9IHNjb3BlLnVzZXJJZCA/IGBBTkQgYi5cInVzZXJJZFwiID0gJDJgIDogXCJcIjtcbiAgY29uc3Qgd2hlcmVDbGF1c2UgPSBzY29wZS5hZ2VudElkID8gYWdlbnRTY29wZSA6IHVzZXJTY29wZTtcblxuICBjb25zdCByb3dzID0gYXdhaXQgcHJpc21hLiRxdWVyeVJhd1Vuc2FmZTxcbiAgICB7IGRhdGU6IHN0cmluZzsgcmV2ZW51ZTogbnVtYmVyIH1bXVxuICA+KFxuICAgIGBcbiAgICBTRUxFQ1QgdG9fY2hhcihkYXlzLmQsICdZWVlZLU1NLUREJykgQVMgZGF0ZSxcbiAgICAgICAgICAgQ09BTEVTQ0UoU1VNKGIuXCJ0b3RhbFByaWNlXCIpLCAwKTo6ZmxvYXQ4IEFTIHJldmVudWVcbiAgICBGUk9NIGdlbmVyYXRlX3NlcmllcyhcbiAgICAgIENVUlJFTlRfREFURSAtIG1ha2VfaW50ZXJ2YWwoZGF5cyA9PiAkMTo6aW50IC0gMSksXG4gICAgICBDVVJSRU5UX0RBVEUsXG4gICAgICAnMSBkYXknOjppbnRlcnZhbFxuICAgICkgQVMgZGF5cyhkKVxuICAgIExFRlQgSk9JTiBcImJvb2tpbmdzXCIgYlxuICAgICAgT04gZGF0ZV90cnVuYygnZGF5JywgYi5cInVwZGF0ZWRBdFwiKTo6ZGF0ZSA9IGRheXMuZFxuICAgICAgQU5EIGIuXCJzdGF0dXNcIiA9ICdDT01QTEVURUQnXG4gICAgICAke3doZXJlQ2xhdXNlfVxuICAgIEdST1VQIEJZIGRheXMuZFxuICAgIE9SREVSIEJZIGRheXMuZCBBU0NcbiAgICBgLFxuICAgIGRheXMsXG4gICAgLi4uKHNjb3BlLmFnZW50SWQgfHwgc2NvcGUudXNlcklkID8gW3Njb3BlLmFnZW50SWQgPz8gc2NvcGUudXNlcklkXSA6IFtdKSxcbiAgKTtcblxuICByZXR1cm4gcm93cztcbn07XG5cbi8vIFBhY2thZ2UtaWQgc2NvcGUgZm9yIGJvb2tpbmcgcXVlcmllcy4gQ2FsbGVycyBzaG9ydC1jaXJjdWl0IHRoZSBlbXB0eSBjYXNlXG4vLyAoYW4gYWdlbnQgd2l0aCBubyBwYWNrYWdlcyksIGJ1dCBhbiBgaW46IFtdYCBmYWxsYmFjayBrZWVwcyB0aGUgdHlwZVxuLy8gbm9uLW51bGxhYmxlIHdoaWxlIHN0aWxsIG1hdGNoaW5nIG5vdGhpbmcgaWYgaXQgZXZlciBzbGlwcyB0aHJvdWdoLlxuY29uc3QgdG9QYWNrYWdlSWRTY29wZSA9IChcbiAgcGFja2FnZUlkczogc3RyaW5nW10sXG4pOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPT5cbiAgcGFja2FnZUlkcy5sZW5ndGhcbiAgICA/IHsgcGFja2FnZUlkOiB7IGluOiBwYWNrYWdlSWRzIH0gfVxuICAgIDogeyBwYWNrYWdlSWQ6IHsgaW46IFtdIH0gfTtcblxuLy8gMS4gQWRtaW4gZGFzaGJvYXJkIFx1MjAxNCBwbGF0Zm9ybS13aWRlIGNvdW50cywgYnJlYWtkb3ducyBhbmQgcmV2ZW51ZSB0cmVuZC5cbmNvbnN0IGdldEFkbWluRGFzaGJvYXJkID0gYXN5bmMgKGRheXM6IG51bWJlcik6IFByb21pc2U8SUFkbWluRGFzaGJvYXJkPiA9PiB7XG4gIGNvbnN0IFtcbiAgICB0b3RhbFVzZXJzLFxuICAgIHRvdGFsUGFja2FnZXMsXG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFJldmVudWUsXG4gICAgdXNlcnNCeVJvbGUsXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICBwYWNrYWdlc0J5Q2F0ZWdvcnksXG4gICAgcmV2ZW51ZU92ZXJUaW1lLFxuICBdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS51c2VyLmNvdW50KHsgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9IH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSB9KSxcbiAgICBwcmlzbWEuYm9va2luZy5jb3VudCgpLFxuICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICBfc3VtOiB7IHRvdGFsUHJpY2U6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEudXNlci5ncm91cEJ5KHtcbiAgICAgIGJ5OiBbXCJyb2xlXCJdLFxuICAgICAgX2NvdW50OiB7IF9hbGw6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICB9KSxcbiAgICBnZXRCb29raW5nc0J5U3RhdHVzKCksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlXG4gICAgICAuZ3JvdXBCeSh7XG4gICAgICAgIGJ5OiBbXCJjYXRlZ29yeUlkXCJdLFxuICAgICAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgICAgICB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICB9KVxuICAgICAgLnRoZW4oYXN5bmMgKGdyb3VwZWQpID0+IHtcbiAgICAgICAgY29uc3QgY2F0ZWdvcnlJZHMgPSBncm91cGVkLm1hcCgoZykgPT4gZy5jYXRlZ29yeUlkKTtcbiAgICAgICAgY29uc3QgY2F0ZWdvcmllcyA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kTWFueSh7XG4gICAgICAgICAgd2hlcmU6IHsgaWQ6IHsgaW46IGNhdGVnb3J5SWRzIH0gfSxcbiAgICAgICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IG5hbWVNYXAgPSBuZXcgTWFwKGNhdGVnb3JpZXMubWFwKChjKSA9PiBbYy5pZCwgYy5uYW1lXSkpO1xuXG4gICAgICAgIHJldHVybiBncm91cGVkXG4gICAgICAgICAgLm1hcCgoZykgPT4gKHtcbiAgICAgICAgICAgIGNhdGVnb3J5OiBuYW1lTWFwLmdldChnLmNhdGVnb3J5SWQpID8/IFwiVW5rbm93blwiLFxuICAgICAgICAgICAgY291bnQ6IGcuX2NvdW50Ll9hbGwsXG4gICAgICAgICAgfSkpXG4gICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KTtcbiAgICAgIH0pLFxuICAgIGdldFJldmVudWVPdmVyVGltZShkYXlzKSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbFVzZXJzLFxuICAgIHRvdGFsUGFja2FnZXMsXG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFJldmVudWU6IHRvTnVtYmVyKHRvdGFsUmV2ZW51ZS5fc3VtLnRvdGFsUHJpY2UpLFxuICAgIHVzZXJzQnlSb2xlOiB1c2Vyc0J5Um9sZVxuICAgICAgLm1hcCgoZykgPT4gKHsgcm9sZTogZy5yb2xlLCBjb3VudDogZy5fY291bnQuX2FsbCB9KSlcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBiLmNvdW50IC0gYS5jb3VudCksXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICBwYWNrYWdlc0J5Q2F0ZWdvcnksXG4gICAgcmV2ZW51ZU92ZXJUaW1lLFxuICB9O1xufTtcblxuLy8gMi4gQWdlbnQgZGFzaGJvYXJkIFx1MjAxNCBzY29wZWQgdG8gdGhlIGFnZW50J3Mgb3duIHBhY2thZ2VzLiBGZXRjaGVzIG93bmVkXG4vLyAgICBwYWNrYWdlIGlkcyBvbmNlLCB0aGVuIGV2ZXJ5IGFnZ3JlZ2F0ZSByZXVzZXMgdGhhdCBzY29wZSBzbyB0aGUgd2hvbGVcbi8vICAgIGJ1bmRsZSBpcyBvbmUgUHJvbWlzZS5hbGwgKG5vIHBlci1pdGVtIHF1ZXJpZXMpLlxuY29uc3QgZ2V0QWdlbnREYXNoYm9hcmQgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBkYXlzOiBudW1iZXIsXG4pOiBQcm9taXNlPElBZ2VudERhc2hib2FyZD4gPT4ge1xuICBjb25zdCBbb3duZWRQYWNrYWdlcywgYm9va2luZ3NCeVN0YXR1cywgYXZlcmFnZVJhdGluZ10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7IGFnZW50SWQ6IHVzZXJJZCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgfSksXG4gICAgZ2V0Qm9va2luZ3NCeVN0YXR1cyh7IGFnZW50SWQ6IHVzZXJJZCB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuYWdncmVnYXRlKHtcbiAgICAgIF9hdmc6IHsgcmF0aW5nOiB0cnVlIH0sXG4gICAgICB3aGVyZToge1xuICAgICAgICBhZ2VudElkOiB1c2VySWQsXG4gICAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSksXG4gIF0pO1xuXG4gIGNvbnN0IHBhY2thZ2VJZHMgPSBvd25lZFBhY2thZ2VzLm1hcCgocCkgPT4gcC5pZCk7XG5cbiAgLy8gQW4gYWdlbnQgd2l0aCBubyBwYWNrYWdlcyBtdXN0IHNlZSB6ZXJvcyBcdTIwMTQgc2NvcGUgaXMgdW5kZWZpbmVkIGZvciBhbiBlbXB0eVxuICAvLyBsaXN0LCBhbmQgYSBiYXJlIGB3aGVyZTogdW5kZWZpbmVkYCAvIGBBTkQ6IFt7fV1gIHdvdWxkIG90aGVyd2lzZSBtYXRjaCB0aGVcbiAgLy8gd2hvbGUgcGxhdGZvcm0gKGNyb3NzLWFnZW50IGRhdGEgbGVhaykuIFNob3J0LWNpcmN1aXQgaGVyZSBpbnN0ZWFkLlxuICBpZiAocGFja2FnZUlkcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4ge1xuICAgICAgdG90YWxQYWNrYWdlczogMCxcbiAgICAgIHRvdGFsQm9va2luZ3M6IDAsXG4gICAgICB0b3RhbFJldmVudWU6IDAsXG4gICAgICBhdmVyYWdlUmF0aW5nOiBNYXRoLnJvdW5kKChhdmVyYWdlUmF0aW5nLl9hdmcucmF0aW5nID8/IDApICogMTApIC8gMTAsXG4gICAgICBib29raW5nc0J5U3RhdHVzLFxuICAgICAgcmV2ZW51ZU92ZXJUaW1lOiBhd2FpdCBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cywgeyBhZ2VudElkOiB1c2VySWQgfSksXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHNjb3BlID0gdG9QYWNrYWdlSWRTY29wZShwYWNrYWdlSWRzKTtcblxuICBjb25zdCBbdG90YWxQYWNrYWdlcywgdG90YWxCb29raW5ncywgdG90YWxSZXZlbnVlLCByZXZlbnVlT3ZlclRpbWVdID1cbiAgICBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBwYWNrYWdlSWRzLmxlbmd0aCxcbiAgICAgIHByaXNtYS5ib29raW5nLmNvdW50KHsgd2hlcmU6IHNjb3BlIH0pLFxuICAgICAgcHJpc21hLmJvb2tpbmcuYWdncmVnYXRlKHtcbiAgICAgICAgX3N1bTogeyB0b3RhbFByaWNlOiB0cnVlIH0sXG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgQU5EOiBbc2NvcGUsIHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCB9XSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgZ2V0UmV2ZW51ZU92ZXJUaW1lKGRheXMsIHsgYWdlbnRJZDogdXNlcklkIH0pLFxuICAgIF0pO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxQYWNrYWdlcyxcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsUmV2ZW51ZTogdG9OdW1iZXIodG90YWxSZXZlbnVlLl9zdW0udG90YWxQcmljZSksXG4gICAgYXZlcmFnZVJhdGluZzogTWF0aC5yb3VuZCgoYXZlcmFnZVJhdGluZy5fYXZnLnJhdGluZyA/PyAwKSAqIDEwKSAvIDEwLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcmV2ZW51ZU92ZXJUaW1lLFxuICB9O1xufTtcblxuLy8gMy4gVXNlciBkYXNoYm9hcmQgXHUyMDE0IHRoZSB1c2VyJ3MgYm9va2luZ3MsIHNwZW5kLCBhbmQgdXBjb21pbmcgdHJpcHMuXG5jb25zdCBnZXRVc2VyRGFzaGJvYXJkID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgZGF5cyA9IDMwLFxuKTogUHJvbWlzZTxJVXNlckRhc2hib2FyZD4gPT4ge1xuICBjb25zdCBbdG90YWxCb29raW5ncywgdG90YWxTcGVuZCwgdXBjb21pbmcsIGJvb2tpbmdzQnlTdGF0dXMsIHJldmVudWVPdmVyVGltZV0gPVxuICAgIGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHByaXNtYS5ib29raW5nLmNvdW50KHsgd2hlcmU6IHsgdXNlcklkIH0gfSksXG4gICAgICBwcmlzbWEuYm9va2luZy5hZ2dyZWdhdGUoe1xuICAgICAgICBfc3VtOiB7IHRvdGFsUHJpY2U6IHRydWUgfSxcbiAgICAgICAgd2hlcmU6IHsgdXNlcklkLCBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVEIH0sXG4gICAgICB9KSxcbiAgICAgIHByaXNtYS5ib29raW5nLmZpbmRNYW55KHtcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICB1c2VySWQsXG4gICAgICAgICAgc3RhdHVzOiB7XG4gICAgICAgICAgICBpbjogW0Jvb2tpbmdTdGF0dXMuUEVORElORywgQm9va2luZ1N0YXR1cy5QQUlELCBCb29raW5nU3RhdHVzLkNPTkZJUk1FRF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cmF2ZWxEYXRlOiB7IGd0OiBuZXcgRGF0ZSgpIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgIGlkOiB0cnVlLFxuICAgICAgICAgIHRyYXZlbERhdGU6IHRydWUsXG4gICAgICAgICAgdHJhdmVsZXJzOiB0cnVlLFxuICAgICAgICAgIHRvdGFsUHJpY2U6IHRydWUsXG4gICAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICAgIHBhY2thZ2U6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCB0aXRsZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0sXG4gICAgICAgIH0sXG4gICAgICAgIG9yZGVyQnk6IHsgdHJhdmVsRGF0ZTogXCJhc2NcIiB9LFxuICAgICAgICB0YWtlOiA1LFxuICAgICAgfSksXG4gICAgICBnZXRCb29raW5nc0J5U3RhdHVzKHsgdXNlcklkIH0pLFxuICAgICAgZ2V0UmV2ZW51ZU92ZXJUaW1lKGRheXMsIHsgdXNlcklkIH0pLFxuICAgIF0pO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFNwZW5kOiB0b051bWJlcih0b3RhbFNwZW5kLl9zdW0udG90YWxQcmljZSksXG4gICAgdXBjb21pbmdDb3VudDogdXBjb21pbmcubGVuZ3RoLFxuICAgIHVwY29taW5nOiB1cGNvbWluZy5tYXAoKGIpID0+ICh7XG4gICAgICAuLi5iLFxuICAgICAgdG90YWxQcmljZTogTnVtYmVyKGIudG90YWxQcmljZSksXG4gICAgfSkpLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcmV2ZW51ZU92ZXJUaW1lLFxuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZFNlcnZpY2UgPSB7XG4gIGdldEFkbWluRGFzaGJvYXJkLFxuICBnZXRBZ2VudERhc2hib2FyZCxcbiAgZ2V0VXNlckRhc2hib2FyZCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGRhc2hib2FyZFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBkYXlzOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDM2NSkuZGVmYXVsdCgzMCksXG59KTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZFZhbGlkYXRpb25zID0ge1xuICBkYXNoYm9hcmRRdWVyeVNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBwYXltZW50Q29udHJvbGxlciB9IGZyb20gXCIuL3BheW1lbnQuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgcGF5bWVudFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vcGF5bWVudC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBPcGVuIGEgZ2F0ZXdheSBzZXNzaW9uIGZvciB0aGUgdXNlcidzIHBlbmRpbmcgYm9va2luZyAoVVNFUiBvbmx5KS5cbnJvdXRlci5wb3N0KFxuICBcIi9jcmVhdGVcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBwYXltZW50VmFsaWRhdGlvbnMuY3JlYXRlU2NoZW1hIH0pLFxuICBwYXltZW50Q29udHJvbGxlci5jcmVhdGVQYXltZW50LFxuKTtcblxuLy8gUHVibGljIFx1MjAxNCBTU0xDb21tZXJ6IFBPU1RzIHRoZSBvdXRjb21lIGhlcmUgKHN1Y2Nlc3MvZmFpbC9jYW5jZWwpIGFuZCB3ZVxuLy8gcmVkaXJlY3QgdGhlIGJyb3dzZXIgdG8gdGhlIGZyb250ZW5kIHJlc3VsdCBwYWdlLlxucm91dGVyLnBvc3QoXG4gIFwiL2NvbmZpcm1cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBxdWVyeTogcGF5bWVudFZhbGlkYXRpb25zLmNhbGxiYWNrUXVlcnlTY2hlbWEsXG4gICAgYm9keTogcGF5bWVudFZhbGlkYXRpb25zLmdhdGV3YXlSZXN1bHRTY2hlbWEsXG4gIH0pLFxuICBwYXltZW50Q29udHJvbGxlci5jb25maXJtUGF5bWVudCxcbik7XG5cbi8vIFB1YmxpYyBcdTIwMTQgU1NMQ29tbWVyeiBpbnN0YW50IHBheW1lbnQgbm90aWZpY2F0aW9uOyBzYW1lIGlkZW1wb3RlbnQgc2V0dGxlLlxucm91dGVyLnBvc3QoXG4gIFwiL2lwblwiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHF1ZXJ5OiBwYXltZW50VmFsaWRhdGlvbnMuY2FsbGJhY2tRdWVyeVNjaGVtYSxcbiAgICBib2R5OiBwYXltZW50VmFsaWRhdGlvbnMuZ2F0ZXdheVJlc3VsdFNjaGVtYSxcbiAgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmlwbixcbik7XG5cbmV4cG9ydCBjb25zdCBwYXltZW50Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcbmltcG9ydCB7IElHYXRld2F5UmVzdWx0IH0gZnJvbSBcIi4vcGF5bWVudC5pbnRlcmZhY2VcIjtcbmltcG9ydCB7IHBheW1lbnRTZXJ2aWNlIH0gZnJvbSBcIi4vcGF5bWVudC5zZXJ2aWNlXCI7XG5cbmNvbnN0IGNyZWF0ZVBheW1lbnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHBheW1lbnRTZXJ2aWNlLmNyZWF0ZVBheW1lbnRTZXNzaW9uKHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUGF5bWVudCBzZXNzaW9uIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogc2Vzc2lvbixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFB1YmxpYyBjYWxsYmFjayB0YXJnZXQgXHUyMDE0IFNTTENvbW1lcnogUE9TVHMgaGVyZSAoc2VydmVyLXRvLXNlcnZlcikgYWZ0ZXIgdGhlXG4vLyBzaG9wcGVyIGZpbmlzaGVzIGF0IHRoZSBnYXRld2F5LiBXZSBzZXR0bGUgdGhlIHBheW1lbnQsIHRoZW4gYm91bmNlIHRoZVxuLy8gYnJvd3NlciB0byB0aGUgZnJvbnRlbmQgcmVzdWx0IHBhZ2UuXG5jb25zdCBjb25maXJtUGF5bWVudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGJvb2tpbmdJZCA9IFN0cmluZyhyZXEucXVlcnkuYm9va2luZ0lkKTtcbiAgICBjb25zdCB0cmFuSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LnRyYW5JZCk7XG4gICAgY29uc3Qgc3RhdHVzID0gU3RyaW5nKHJlcS5xdWVyeS5zdGF0dXMgPz8gXCJmYWlsXCIpO1xuXG4gICAgYXdhaXQgcGF5bWVudFNlcnZpY2UucHJvY2Vzc0dhdGV3YXlSZXN1bHQoXG4gICAgICBib29raW5nSWQsXG4gICAgICB0cmFuSWQsXG4gICAgICByZXEuYm9keSBhcyBJR2F0ZXdheVJlc3VsdCxcbiAgICApO1xuXG4gICAgY29uc3QgcmVkaXJlY3RCYXNlID1cbiAgICAgIGNvbmZpZy5ub2RlX2VudiA9PT0gXCJwcm9kdWN0aW9uXCJcbiAgICAgICAgPyBjb25maWcuZnJvbnRlbmRfdXJsX3Byb2RcbiAgICAgICAgOiBjb25maWcuZnJvbnRlbmRfdXJsX2RldjtcbiAgICBjb25zdCBwYWdlID0gW1wic3VjY2Vzc1wiLCBcImZhaWxcIiwgXCJjYW5jZWxcIl0uaW5jbHVkZXMoc3RhdHVzKSA/IHN0YXR1cyA6IFwiZmFpbFwiO1xuXG4gICAgcmVzLnJlZGlyZWN0KDMwMiwgYCR7cmVkaXJlY3RCYXNlfS9wYXltZW50LyR7cGFnZX0/Ym9va2luZ0lkPSR7Ym9va2luZ0lkfWApO1xuICB9LFxuKTtcblxuLy8gUHVibGljIElQTiB0YXJnZXQgXHUyMDE0IHRoZSBnYXRld2F5IG5vdGlmaWVzIHVzIGhlcmUgaW5kZXBlbmRlbnRseSBvZiB0aGVcbi8vIHJlZGlyZWN0LiBTYW1lIGlkZW1wb3RlbnQgc2V0dGxlOyBhbHdheXMgYW5zd2VycyAyMDAgc28gdGhlIGdhdGV3YXkgc3RvcHMgcmV0cnlpbmcuXG5jb25zdCBpcG4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBib29raW5nSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LmJvb2tpbmdJZCk7XG4gICAgY29uc3QgdHJhbklkID0gU3RyaW5nKHJlcS5xdWVyeS50cmFuSWQpO1xuXG4gICAgYXdhaXQgcGF5bWVudFNlcnZpY2UucHJvY2Vzc0dhdGV3YXlSZXN1bHQoXG4gICAgICBib29raW5nSWQsXG4gICAgICB0cmFuSWQsXG4gICAgICByZXEuYm9keSBhcyBJR2F0ZXdheVJlc3VsdCxcbiAgICApO1xuXG4gICAgcmVzLnN0YXR1cygyMDApLnR5cGUoXCJ0ZXh0L3BsYWluXCIpLnNlbmQoXCJPS1wiKTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBwYXltZW50Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlUGF5bWVudCxcbiAgY29uZmlybVBheW1lbnQsXG4gIGlwbixcbn07IiwgImltcG9ydCB7IEJvb2tpbmdTdGF0dXMsIFBheW1lbnRTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgU3NsY29tbWVyekluaXRSZXN1bHQsIFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0LCBnZW5lcmF0ZVRyYW5JZCwgc3NsY29tbWVyekluaXQsIHNzbGNvbW1lcnpWYWxpZGF0ZSB9IGZyb20gXCIuLi8uLi9saWIvc3NsY29tbWVyelwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHNlbmRCb29raW5nRW1haWwgfSBmcm9tIFwiLi4vLi4vdXRpbHMvZW1haWxcIjtcbmltcG9ydCB7IElHYXRld2F5UmVzdWx0LCBJUGF5bWVudENyZWF0ZVJlcXVlc3QsIElQYXltZW50R2F0ZXdheU91dGNvbWUgfSBmcm9tIFwiLi9wYXltZW50LmludGVyZmFjZVwiO1xuXG4vLyBUaGUgZ2F0ZXdheSBQT1NUcyB0byB0aGVzZSBVUkxzIHNlcnZlci10by1zZXJ2ZXIsIHNvIHRoZSBob3N0IG11c3QgYmVcbi8vIHB1YmxpY2x5IHJlYWNoYWJsZSBcdTIwMTQgY29uZmlnLmJhY2tlbmRfcHVibGljX3VybCwgbmV2ZXIgbG9jYWxob3N0IGluIHNhbmRib3guXG5jb25zdCBidWlsZENhbGxiYWNrVXJsID0gKFxuICBib29raW5nSWQ6IHN0cmluZyxcbiAgdHJhbklkOiBzdHJpbmcsXG4gIGtpbmQ6IFwic3VjY2Vzc1wiIHwgXCJmYWlsXCIgfCBcImNhbmNlbFwiIHwgXCJpcG5cIixcbikgPT5cbiAgYCR7Y29uZmlnLmJhY2tlbmRfcHVibGljX3VybH0vYXBpL3BheW1lbnRzLyR7a2luZCA9PT0gXCJpcG5cIiA/IFwiaXBuXCIgOiBcImNvbmZpcm1cIn0/Ym9va2luZ0lkPSR7Ym9va2luZ0lkfSZ0cmFuSWQ9JHt0cmFuSWR9JHtcbiAgICBraW5kID09PSBcImlwblwiID8gXCJcIiA6IGAmc3RhdHVzPSR7a2luZH1gXG4gIH1gO1xuXG4vLyBPcGVucyBhbiBTU0xDb21tZXJ6IHNlc3Npb24gZm9yIGEgcGVuZGluZyBib29raW5nIHRoZSB1c2VyIG93bnMuIFRoZSBib29raW5nXG4vLyBhbW91bnQgaXMgZnJvemVuIGF0IGluaXRpYXRpb247IGl0IG5ldmVyIHJlLXJlYWRzIHRoZSBwYWNrYWdlIHByaWNlLlxuY29uc3QgY3JlYXRlUGF5bWVudFNlc3Npb24gPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJUGF5bWVudENyZWF0ZVJlcXVlc3QsXG4pOiBQcm9taXNlPHsgcGF5bWVudElkOiBzdHJpbmc7IHRyYW5JZDogc3RyaW5nOyBwYXltZW50VXJsOiBzdHJpbmcgfCBudWxsIH0+ID0+IHtcbiAgY29uc3QgeyBib29raW5nSWQgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgYm9va2luZyA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBib29raW5nSWQgfSxcbiAgICBpbmNsdWRlOiB7IHBhY2thZ2U6IHsgc2VsZWN0OiB7IHRpdGxlOiB0cnVlIH0gfSB9LFxuICB9KTtcbiAgaWYgKCFib29raW5nKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJCb29raW5nIG5vdCBmb3VuZC5cIik7XG4gIH1cbiAgaWYgKGJvb2tpbmcudXNlcklkICE9PSB1c2VySWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gcGF5IGZvciB0aGlzIGJvb2tpbmcuXCIpO1xuICB9XG4gIGlmIChib29raW5nLnN0YXR1cyA9PT0gQm9va2luZ1N0YXR1cy5QQUlEKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJUaGlzIGJvb2tpbmcgaXMgYWxyZWFkeSBwYWlkLlwiKTtcbiAgfVxuICBpZiAoYm9va2luZy5zdGF0dXMgIT09IEJvb2tpbmdTdGF0dXMuUEVORElORykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwOSxcbiAgICAgIGBDYW5ub3QgcGF5IGZvciBhIGJvb2tpbmcgaW4gJHtib29raW5nLnN0YXR1cy50b0xvd2VyQ2FzZSgpfSBzdGF0dXMuYCxcbiAgICApO1xuICB9XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBzZWxlY3Q6IHsgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUsIHBob25lOiB0cnVlIH0sXG4gIH0pO1xuICBpZiAoIXVzZXIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGNvbnN0IGFtb3VudCA9IE51bWJlcihib29raW5nLnRvdGFsUHJpY2UpO1xuICBjb25zdCB0cmFuSWQgPSBnZW5lcmF0ZVRyYW5JZCgpO1xuXG4gIC8vIE9uZSBsaXZlIHNlc3Npb24gcGVyIGJvb2tpbmc6IHRoZSBsZWRnZXIgcm93IGlzIGNyZWF0ZWQgYXRvbWljYWxseSB3aGlsZVxuICAvLyBzdXBlcnNlZGluZyBhbnkgYWJhbmRvbmVkIHNlc3Npb24sIHRoZW4gdGhlIGdhdGV3YXkgaXMgYXNrZWQuIFRoZSByb3dcbiAgLy8gc3Vydml2ZXMgcmVnYXJkbGVzcyBvZiB0aGUgZ2F0ZXdheSByZXNwb25zZSBcdTIwMTQgaW5pdCBmYWlsdXJlIGZsaXBzIGl0IHRvXG4gIC8vIEZBSUxFRCBiZWxvdyBzbyBhIHRydXRoZnVsIGVudHJ5IGFsd2F5cyBleGlzdHMuXG4gIGNvbnN0IHBheW1lbnQgPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGF3YWl0IHR4LnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyBib29raW5nSWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkNBTkNFTExFRCB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHR4LnBheW1lbnQuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgYm9va2luZ0lkLFxuICAgICAgICB0cmFuSWQsXG4gICAgICAgIGFtb3VudCxcbiAgICAgICAgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIGxldCBpbml0OiBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgdHJ5IHtcbiAgICBpbml0ID0gYXdhaXQgc3NsY29tbWVyekluaXQoe1xuICAgICAgdG90YWxfYW1vdW50OiBhbW91bnQsXG4gICAgICB0cmFuX2lkOiB0cmFuSWQsXG4gICAgICBzdWNjZXNzX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJzdWNjZXNzXCIpLFxuICAgICAgZmFpbF91cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwiZmFpbFwiKSxcbiAgICAgIGNhbmNlbF91cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwiY2FuY2VsXCIpLFxuICAgICAgaXBuX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJpcG5cIiksXG4gICAgICBjdXNfbmFtZTogdXNlci5uYW1lLFxuICAgICAgY3VzX2VtYWlsOiB1c2VyLmVtYWlsLFxuICAgICAgY3VzX3Bob25lOiB1c2VyLnBob25lID8/IFwiMDE3MTExMTExMTFcIixcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyBrZWVwIHRoZSBsZWRnZXIgdHJ1dGhmdWwgXHUyMDE0IHRoZSBzZXNzaW9uIG5ldmVyIHJlYWNoZWQgdGhlIGdhdGV3YXkuIFRoZVxuICAgIC8vIHN0YXR1cyBndWFyZCBtYWtlcyBhIGNvbmN1cnJlbnQgL2NyZWF0ZSB0aGF0IGFscmVhZHkgY2FuY2VsbGVkIHRoaXMgcm93XG4gICAgLy8gd2luIHRoZSByYWNlICh0aGF0IHJvdyBzdGF5cyBjYW5jZWxsZWQsIHRoaXMgb25lIGZhaWxzIG9ubHkgaWYgbGl2ZSkuXG4gICAgYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuRkFJTEVEIH0sXG4gICAgfSk7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICAvLyBzdG9yZSB0aGUgZ2F0ZXdheSBVUkxzIG9ubHkgaWYgdGhlIHJvdyBpcyBzdGlsbCB0aGUgbGl2ZSBzZXNzaW9uLlxuICBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgIGRhdGE6IHsgZ2F0ZXdheVBhZ2VVcmw6IGluaXQuR2F0ZXdheVBhZ2VVUkwsIHNzbFNlc3Npb25LZXk6IGluaXQuc2Vzc2lvbmtleSB9LFxuICB9KTtcblxuICByZXR1cm4ge1xuICAgIHBheW1lbnRJZDogcGF5bWVudC5pZCxcbiAgICB0cmFuSWQ6IHBheW1lbnQudHJhbklkLFxuICAgIHBheW1lbnRVcmw6IGluaXQuR2F0ZXdheVBhZ2VVUkwgPz8gbnVsbCxcbiAgfTtcbn07XG5cbi8vIFNlcnZlci1zaWRlIHZlcmlmaWNhdGlvbiBvZiBhIGNvbXBsZXRlZCB0cmFuc2FjdGlvbjogdGhlIHZhbGlkYXRvciByZXR1cm5zXG4vLyBWQUxJRCAoZmlyc3QgY2hlY2spIG9yIFZBTElEQVRFRCAoYWxyZWFkeSB2ZXJpZmllZCBiZWZvcmUpIHdpdGggdGhlIGFtb3VudC5cbi8vIEFueXRoaW5nIGVsc2UgXHUyMDE0IG9yIGEgbWlzbWF0Y2hlZCBhbW91bnQgXHUyMDE0IGZhaWxzIHRoZSBwYXltZW50LlxuY29uc3QgdmVyaWZ5U3VjY2VzcyA9IGFzeW5jIChcbiAgdmFsSWQ6IHN0cmluZyxcbiAgZXhwZWN0ZWRBbW91bnQ6IG51bWJlcixcbik6IFByb21pc2U8eyB2ZXJpZmllZDogU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQgfCBudWxsOyBtYXRjaGVzQW1vdW50OiBib29sZWFuIH0+ID0+IHtcbiAgbGV0IHZlcmlmaWVkOiBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCB8IG51bGwgPSBudWxsO1xuICB0cnkge1xuICAgIHZlcmlmaWVkID0gYXdhaXQgc3NsY29tbWVyelZhbGlkYXRlKHsgdmFsX2lkOiB2YWxJZCB9KTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gdmFsaWRhdG9yIHVucmVhY2hhYmxlIFx1MjAxNCBmYWlsIHRoZSBwYXltZW50IHJhdGhlciB0aGFuIGNyYXNoIHRoZSBjYWxsYmFja1xuICAgIHJldHVybiB7IHZlcmlmaWVkOiBudWxsLCBtYXRjaGVzQW1vdW50OiBmYWxzZSB9O1xuICB9XG5cbiAgY29uc3QgdmFsaWRTdGF0dXMgPVxuICAgIHZlcmlmaWVkLnN0YXR1cyA9PT0gXCJWQUxJRFwiIHx8IHZlcmlmaWVkLnN0YXR1cyA9PT0gXCJWQUxJREFURURcIjtcbiAgY29uc3QgbWF0Y2hlc0Ftb3VudCA9XG4gICAgdmVyaWZpZWQuYW1vdW50ICE9PSB1bmRlZmluZWQgJiYgTnVtYmVyKHZlcmlmaWVkLmFtb3VudCkgPT09IGV4cGVjdGVkQW1vdW50O1xuXG4gIHJldHVybiB7IHZlcmlmaWVkLCBtYXRjaGVzQW1vdW50OiB2YWxpZFN0YXR1cyAmJiBtYXRjaGVzQW1vdW50IH07XG59O1xuXG4vLyBTaGFyZWQgYnkgdGhlIGNvbmZpcm0gKHN1Y2Nlc3MvZmFpbC9jYW5jZWwpIGFuZCBJUE4gZW5kcG9pbnRzLiBJZGVtcG90ZW50OiBhXG4vLyBzZXR0bGVkIHBheW1lbnQgc2hvcnQtY2lyY3VpdHMsIHNvIHRoZSBkb3VibGUtZmlyaW5nIElQTiBuZXZlciBkb3VibGUtY2hhcmdlcy5cbmNvbnN0IHByb2Nlc3NHYXRld2F5UmVzdWx0ID0gYXN5bmMgKFxuICBib29raW5nSWQ6IHN0cmluZyxcbiAgdHJhbklkOiBzdHJpbmcsXG4gIHJlc3VsdDogSUdhdGV3YXlSZXN1bHQsXG4pOiBQcm9taXNlPElQYXltZW50R2F0ZXdheU91dGNvbWU+ID0+IHtcbiAgY29uc3QgcGF5bWVudCA9IGF3YWl0IHByaXNtYS5wYXltZW50LmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IHRyYW5JZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIGJvb2tpbmc6IHtcbiAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgIHVzZXI6IHsgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0gfSxcbiAgICAgICAgICBwYWNrYWdlOiB7IHNlbGVjdDogeyB0aXRsZTogdHJ1ZSB9IH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghcGF5bWVudCB8fCBwYXltZW50LmJvb2tpbmdJZCAhPT0gYm9va2luZ0lkKSB7XG4gICAgLy8gQSBjYWxsYmFjayBmb3IgYSBzZXNzaW9uIHdlIG5ldmVyIGNyZWF0ZWQgXHUyMDE0IG5vdGhpbmcgdG8gc2V0dGxlLlxuICAgIHJldHVybiB7IHBheW1lbnRTdGF0dXM6IFBheW1lbnRTdGF0dXMuRkFJTEVELCBib29raW5nU3RhdHVzOiBudWxsLCBjaGFuZ2VkOiBmYWxzZSB9O1xuICB9XG5cbiAgaWYgKHBheW1lbnQuc3RhdHVzID09PSBQYXltZW50U3RhdHVzLlNVQ0NFU1MpIHtcbiAgICByZXR1cm4ge1xuICAgICAgcGF5bWVudFN0YXR1czogUGF5bWVudFN0YXR1cy5TVUNDRVNTLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IGZhbHNlLFxuICAgIH07XG4gIH1cblxuICAvLyBDYW5jZWwgY2FsbGJhY2sgXHUyMDE0IHRoZSBzaG9wcGVyIGFiYW5kb25lZCBjaGVja291dCwgbm8gY2hhcmdlIHdhcyBtYWRlLlxuICBpZiAocmVzdWx0LmZhaWxfc3RhdHVzID09PSBcIkNBTkNFTExFRFwiIHx8IHJlc3VsdC5zdGF0dXMgPT09IFwiQ0FOQ0VMTEVEXCIpIHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICB9KTtcbiAgICByZXR1cm4ge1xuICAgICAgcGF5bWVudFN0YXR1czogdXBkYXRlZC5zdGF0dXMsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogdXBkYXRlZC5zdGF0dXMgIT09IHBheW1lbnQuc3RhdHVzLFxuICAgIH07XG4gIH1cblxuICAvLyBObyB2YWxfaWQgbWVhbnMgdGhlIGdhdGV3YXkgcmVwb3J0ZWQgYSBmYWlsdXJlIChmYWlsX3VybCkgXHUyMDE0IG5vdGhpbmcgdG8gdmVyaWZ5LlxuICBpZiAoIXJlc3VsdC52YWxfaWQpIHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQgfSxcbiAgICB9KTtcbiAgICByZXR1cm4ge1xuICAgICAgcGF5bWVudFN0YXR1czogdXBkYXRlZC5zdGF0dXMsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogdXBkYXRlZC5zdGF0dXMgIT09IHBheW1lbnQuc3RhdHVzLFxuICAgIH07XG4gIH1cblxuICAvLyBTdWNjZXNzIHBhdGg6IHZlcmlmeSBzZXJ2ZXItc2lkZSBhbmQgb25seSB0aGVuIG1hcmsgdGhlIGJvb2tpbmcgYXMgcGFpZC5cbiAgY29uc3QgeyB2ZXJpZmllZCwgbWF0Y2hlc0Ftb3VudCB9ID0gYXdhaXQgdmVyaWZ5U3VjY2VzcyhcbiAgICByZXN1bHQudmFsX2lkLFxuICAgIE51bWJlcihwYXltZW50LmFtb3VudCksXG4gICk7XG5cbiAgaWYgKCFtYXRjaGVzQW1vdW50KSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuRkFJTEVEIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IHVwZGF0ZWQuc3RhdHVzLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IHRydWUsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHNldHRsZWQgPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YToge1xuICAgICAgICBzdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyxcbiAgICAgICAgdmFsSWQ6IHJlc3VsdC52YWxfaWQsXG4gICAgICAgIGNhcmRUeXBlOiByZXN1bHQuY2FyZF90eXBlID8/IHZlcmlmaWVkPy5jYXJkX3R5cGUsXG4gICAgICAgIGJhbmtUcmFuSWQ6IHJlc3VsdC5iYW5rX3RyYW5faWQgPz8gdmVyaWZpZWQ/LmJhbmtfdHJhbl9pZCxcbiAgICAgICAgcGFpZEF0OiBuZXcgRGF0ZSgpLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIGNvbXBhcmUtYW5kLXNldDogb25seSBhIHN0aWxsLVBFTkRJTkcgYm9va2luZyBiZWNvbWVzIFBBSUQ7IGEgYm9va2luZyB0aGF0XG4gICAgLy8gd2FzIGNvbmN1cnJlbnRseSBjb25maXJtZWQgb3IgY2FuY2VsbGVkIGtlZXBzIGl0cyBzdGF0ZSwgdGhlIG1vbmV5IHN0YXlzIG9uLlxuICAgIGF3YWl0IHR4LmJvb2tpbmcudXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyBpZDogYm9va2luZ0lkLCBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEFJRCB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHVwZGF0ZWQ7XG4gIH0pO1xuXG4gIGNvbnN0IGJvb2tpbmdBZnRlciA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZDogYm9va2luZ0lkIH0gfSk7XG5cbiAgLy8gYmVzdC1lZmZvcnQgXCJwYXltZW50IHJlY2VpdmVkXCIgZW1haWwgXHUyMDE0IG5ldmVyIGZhaWxzIHRoZSBjYWxsYmFja1xuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZEJvb2tpbmdFbWFpbCh7XG4gICAgICBlbWFpbDogcGF5bWVudC5ib29raW5nLnVzZXIuZW1haWwsXG4gICAgICBuYW1lOiBwYXltZW50LmJvb2tpbmcudXNlci5uYW1lLFxuICAgICAgcGFja2FnZVRpdGxlOiBwYXltZW50LmJvb2tpbmcucGFja2FnZS50aXRsZSxcbiAgICAgIHRyYXZlbERhdGU6IHBheW1lbnQuYm9va2luZy50cmF2ZWxEYXRlLFxuICAgICAgdHJhdmVsZXJzOiBwYXltZW50LmJvb2tpbmcudHJhdmVsZXJzLFxuICAgICAgdG90YWxQcmljZTogTnVtYmVyKHBheW1lbnQuYW1vdW50KSxcbiAgICAgIHN0YXR1czogQm9va2luZ1N0YXR1cy5QQUlELFxuICAgIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIHBheW1lbnRTdGF0dXM6IHNldHRsZWQuc3RhdHVzLFxuICAgIGJvb2tpbmdTdGF0dXM6IGJvb2tpbmdBZnRlcj8uc3RhdHVzID8/IG51bGwsXG4gICAgY2hhbmdlZDogdHJ1ZSxcbiAgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBwYXltZW50U2VydmljZSA9IHtcbiAgY3JlYXRlUGF5bWVudFNlc3Npb24sXG4gIHByb2Nlc3NHYXRld2F5UmVzdWx0LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlU2NoZW1hID0gei5vYmplY3Qoe1xuICBib29raW5nSWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQm9va2luZyBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnV1aWQoXCJCb29raW5nIGlkIG11c3QgYmUgYSB2YWxpZCB1dWlkXCIpLFxufSk7XG5cbmNvbnN0IGNhbGxiYWNrUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGJvb2tpbmdJZDogei5zdHJpbmcoKS51dWlkKFwiQm9va2luZyBpZCBtdXN0IGJlIGEgdmFsaWQgdXVpZFwiKSxcbiAgdHJhbklkOiB6LnN0cmluZygpLm1pbigxKSxcbiAgc3RhdHVzOiB6LmVudW0oW1wic3VjY2Vzc1wiLCBcImZhaWxcIiwgXCJjYW5jZWxcIl0pLm9wdGlvbmFsKCksXG59KTtcblxuLy8gQm9keSBvZiB0aGUgZ2F0ZXdheSBQT1NUIFx1MjAxNCBvbmx5IGZpZWxkcyB3ZSBjb25zdW1lLCBhbGwgb3B0aW9uYWwgYmVjYXVzZSB0aGVcbi8vIHNoYXBlIGRpZmZlcnMgYmV0d2VlbiBzdWNjZXNzIC8gZmFpbCAvIGNhbmNlbCAvIElQTiBjYWxsYmFja3MuXG5jb25zdCBnYXRld2F5UmVzdWx0U2NoZW1hID0gei5vYmplY3Qoe1xuICB2YWxfaWQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgc3RhdHVzOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGZhaWxfc3RhdHVzOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGNhcmRfdHlwZTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBiYW5rX3RyYW5faWQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgY3VycmVuY3k6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgYW1vdW50OiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG59KTtcblxuZXhwb3J0IHR5cGUgVENyZWF0ZVBheW1lbnRTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBjcmVhdGVTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVENhbGxiYWNrUXVlcnlTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBjYWxsYmFja1F1ZXJ5U2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRHYXRld2F5UmVzdWx0U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgZ2F0ZXdheVJlc3VsdFNjaGVtYT47XG5cbmV4cG9ydCBjb25zdCBwYXltZW50VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVNjaGVtYSxcbiAgY2FsbGJhY2tRdWVyeVNjaGVtYSxcbiAgZ2F0ZXdheVJlc3VsdFNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyB3aXNobGlzdENvbnRyb2xsZXIgfSBmcm9tIFwiLi93aXNobGlzdC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyB3aXNobGlzdFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vd2lzaGxpc3QudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gU2F2ZSBhIHBhY2thZ2UgdG8gdGhlIHdpc2hsaXN0IChVU0VSIG9ubHkpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogd2lzaGxpc3RWYWxpZGF0aW9ucy5jcmVhdGVXaXNobGlzdFNjaGVtYSB9KSxcbiAgd2lzaGxpc3RDb250cm9sbGVyLmFkZFRvV2lzaGxpc3QsXG4pO1xuXG4vLyAyLiBNeSB3aXNobGlzdCAoVVNFUiBvbmx5KSBcdTIwMTQgcGFnaW5hdGVkLCBuZXdlc3QgZmlyc3RcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiB3aXNobGlzdFZhbGlkYXRpb25zLndpc2hsaXN0UXVlcnlTY2hlbWEgfSksXG4gIHdpc2hsaXN0Q29udHJvbGxlci5nZXRNeVdpc2hsaXN0LFxuKTtcblxuLy8gMy4gUmVtb3ZlIGEgcGFja2FnZSBmcm9tIHRoZSB3aXNobGlzdCAoVVNFUiBvbmx5KVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOnBhY2thZ2VJZFwiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogd2lzaGxpc3RWYWxpZGF0aW9ucy53aXNobGlzdFBhcmFtc1NjaGVtYSB9KSxcbiAgd2lzaGxpc3RDb250cm9sbGVyLnJlbW92ZUZyb21XaXNobGlzdCxcbik7XG5cbmV4cG9ydCBjb25zdCB3aXNobGlzdFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHdpc2hsaXN0U2VydmljZSB9IGZyb20gXCIuL3dpc2hsaXN0LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBTYXZlIGEgcGFja2FnZSB0byB0aGUgd2lzaGxpc3QgY29udHJvbGxlciAoVVNFUilcbmNvbnN0IGFkZFRvV2lzaGxpc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB3aXNobGlzdFNlcnZpY2UuYWRkVG9XaXNobGlzdCh1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgYWRkZWQgdG8gd2lzaGxpc3Qgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gTXkgd2lzaGxpc3QgY29udHJvbGxlciAoVVNFUilcbmNvbnN0IGdldE15V2lzaGxpc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB3aXNobGlzdFNlcnZpY2UuZ2V0TXlXaXNobGlzdCh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiV2lzaGxpc3QgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBSZW1vdmUgZnJvbSB3aXNobGlzdCBjb250cm9sbGVyIChVU0VSKSBcdTIwMTQgMjA0IHNvIGEgcmVwZWF0IGRlbGV0ZSBpcyBhXG4vLyAgICBuby1vcCBpbmRpc3Rpbmd1aXNoYWJsZSBmcm9tIGEgc3VjY2Vzc2Z1bCBvbmUgKG5vIGJvZHksIG5vIGVycm9yKS5cbmNvbnN0IHJlbW92ZUZyb21XaXNobGlzdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHBhY2thZ2VJZCA9IFN0cmluZyhyZXEucGFyYW1zLnBhY2thZ2VJZCk7XG5cbiAgICBhd2FpdCB3aXNobGlzdFNlcnZpY2UucmVtb3ZlRnJvbVdpc2hsaXN0KHVzZXJJZCwgcGFja2FnZUlkKTtcblxuICAgIHJlcy5zdGF0dXMoaHR0cFN0YXR1cy5OT19DT05URU5UKS5zZW5kKCk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3Qgd2lzaGxpc3RDb250cm9sbGVyID0ge1xuICBhZGRUb1dpc2hsaXN0LFxuICBnZXRNeVdpc2hsaXN0LFxuICByZW1vdmVGcm9tV2lzaGxpc3QsXG59OyIsICJpbXBvcnQgeyBQYWNrYWdlU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBwdWJsaWNQYWNrYWdlSW5jbHVkZSB9IGZyb20gXCIuLi9wYWNrYWdlL3BhY2thZ2Uuc2VydmljZVwiO1xuaW1wb3J0IHsgSUNyZWF0ZVdpc2hsaXN0UGF5bG9hZCwgSVdpc2hsaXN0UXVlcnkgfSBmcm9tIFwiLi93aXNobGlzdC5pbnRlcmZhY2VcIjtcblxuLy8gTW9uZXkgaXMgYERlY2ltYWwoMTAsMilgIGluIHRoZSBzY2hlbWEgKEFHRU5UUy5tZCkgXHUyMDE0IG1hcCB0byBOdW1iZXIgb24gcmV0dXJuLlxuY29uc3Qgc2VyaWFsaXplV2lzaGxpc3RJdGVtID0gPFxuICBUIGV4dGVuZHMgeyBwYWNrYWdlOiB7IHByaWNlOiBQcmlzbWEuRGVjaW1hbCB9IH0sXG4+KFxuICByb3c6IFQsXG4pOiBUID0+ICh7XG4gIC4uLnJvdyxcbiAgcGFja2FnZTogeyAuLi5yb3cucGFja2FnZSwgcHJpY2U6IE51bWJlcihyb3cucGFja2FnZS5wcmljZSkgfSxcbn0pO1xuXG4vLyAxLiBTYXZlIGEgcGFja2FnZSB0byB0aGUgd2lzaGxpc3QgKFVTRVIpIFx1MjAxNCBpZGVtcG90ZW50LiBUaGUgcGFja2FnZSBtdXN0IGJlXG4vLyAgICBBUFBST1ZFRCBhbmQgbm90IGRlbGV0ZWQsIG1pcnJvcmluZyB0aGUgcHVibGljLXBhY2thZ2UgdmlzaWJpbGl0eSBydWxlLlxuY29uc3QgYWRkVG9XaXNobGlzdCA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElDcmVhdGVXaXNobGlzdFBheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZEZpcnN0KHtcbiAgICB3aGVyZToge1xuICAgICAgaWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4gcHJpc21hLndpc2hsaXN0SXRlbS51cHNlcnQoe1xuICAgIHdoZXJlOiB7IHVzZXJJZF9wYWNrYWdlSWQ6IHsgdXNlcklkLCBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkIH0gfSxcbiAgICBjcmVhdGU6IHsgdXNlcklkLCBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkIH0sXG4gICAgdXBkYXRlOiB7fSxcbiAgfSk7XG59O1xuXG4vLyAyLiBQYWdpbmF0ZWQgd2lzaGxpc3QgKFVTRVIpIFx1MjAxNCBuZXdlc3QgZmlyc3QuIFJvd3Mgd2hvc2UgcGFja2FnZSB3YXMgbGF0ZXJcbi8vICAgIHNvZnQtZGVsZXRlZCBvciBkZW1vdGVkIG91dCBvZiBBUFBST1ZFRCBhcmUgZmlsdGVyZWQgYXQgcmVhZCB0aW1lLCBzbyB0aGVcbi8vICAgIHBhZ2UgbmV2ZXIgbGlzdHMgYSBwYWNrYWdlIHdob3NlIGRldGFpbCByb3V0ZSB3b3VsZCA0MDQuXG5jb25zdCBnZXRNeVdpc2hsaXN0ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBxdWVyeTogSVdpc2hsaXN0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLldpc2hsaXN0SXRlbVdoZXJlSW5wdXQgPSB7XG4gICAgdXNlcklkLFxuICAgIHBhY2thZ2U6IHsgaXNEZWxldGVkOiBmYWxzZSwgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVEIH0sXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEud2lzaGxpc3RJdGVtLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBwYWNrYWdlOiB7IGluY2x1ZGU6IHB1YmxpY1BhY2thZ2VJbmNsdWRlIH0gfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS53aXNobGlzdEl0ZW0uY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVXaXNobGlzdEl0ZW0pLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFJlbW92ZSBhIHBhY2thZ2UgZnJvbSB0aGUgd2lzaGxpc3QgKFVTRVIpIFx1MjAxNCBpZGVtcG90ZW50OyBhIG1pc3Npbmcgcm93IGlzXG4vLyAgICBhIG5vLW9wLCBuZXZlciBhbiBlcnJvci4gRGVsaWJlcmF0ZWx5IG5vIFwiY2xlYXIgYWxsXCIuXG5jb25zdCByZW1vdmVGcm9tV2lzaGxpc3QgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHBhY2thZ2VJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IHByaXNtYS53aXNobGlzdEl0ZW0uZGVsZXRlTWFueSh7XG4gICAgd2hlcmU6IHsgdXNlcklkLCBwYWNrYWdlSWQgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3Qgd2lzaGxpc3RTZXJ2aWNlID0ge1xuICBhZGRUb1dpc2hsaXN0LFxuICBnZXRNeVdpc2hsaXN0LFxuICByZW1vdmVGcm9tV2lzaGxpc3QsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVXaXNobGlzdFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFja2FnZUlkOiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCB3aXNobGlzdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFja2FnZUlkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oMSwgXCJQYWNrYWdlIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxufSk7XG5cbmNvbnN0IHdpc2hsaXN0UXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG59KTtcblxuZXhwb3J0IGNvbnN0IHdpc2hsaXN0VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVdpc2hsaXN0U2NoZW1hLFxuICB3aXNobGlzdFBhcmFtc1NjaGVtYSxcbiAgd2lzaGxpc3RRdWVyeVNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgbm90aWZpY2F0aW9uQ29udHJvbGxlciB9IGZyb20gXCIuL25vdGlmaWNhdGlvbi5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBub3RpZmljYXRpb25WYWxpZGF0aW9ucyB9IGZyb20gXCIuL25vdGlmaWNhdGlvbi52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBOT1RFOiBQQVRDSCAvcmVhZC1hbGwgTVVTVCBzdGF5IHJlZ2lzdGVyZWQgYmVmb3JlIFBBVENIIC86aWQvcmVhZCBcdTIwMTRcbi8vIEV4cHJlc3MgbWF0Y2hlcyB0b3AtZG93biwgYW5kIGAvcmVhZC1hbGxgIHdvdWxkIG90aGVyd2lzZSBiZSBzd2FsbG93ZWQgYnlcbi8vIHRoZSBgOmlkYCBwYXJhbSByb3V0ZS5cblxuLy8gMS4gTXkgbm90aWZpY2F0aW9ucyAoYW55IGF1dGhlbnRpY2F0ZWQgdXNlcikgXHUyMDE0IHBhZ2luYXRlZCwgb3B0aW9uYWwgP3VucmVhZD10cnVlXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogbm90aWZpY2F0aW9uVmFsaWRhdGlvbnMubm90aWZpY2F0aW9uUXVlcnlTY2hlbWEgfSksXG4gIG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIuZ2V0TXlOb3RpZmljYXRpb25zLFxuKTtcblxuLy8gMi4gVW5yZWFkIGNvdW50IGZvciB0aGUgYmVsbCBiYWRnZVxucm91dGVyLmdldChcbiAgXCIvdW5yZWFkLWNvdW50XCIsXG4gIGF1dGgoKSxcbiAgbm90aWZpY2F0aW9uQ29udHJvbGxlci5nZXRVbnJlYWRDb3VudCxcbik7XG5cbi8vIDMuIE1hcmsgYWxsIG15IG5vdGlmaWNhdGlvbnMgcmVhZFxucm91dGVyLnBhdGNoKFxuICBcIi9yZWFkLWFsbFwiLFxuICBhdXRoKCksXG4gIG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIubWFya0FsbEFzUmVhZCxcbik7XG5cbi8vIDQuIE1hcmsgb25lIG5vdGlmaWNhdGlvbiByZWFkIChvd25lciBvbmx5KVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvcmVhZFwiLFxuICBhdXRoKCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogbm90aWZpY2F0aW9uVmFsaWRhdGlvbnMubm90aWZpY2F0aW9uUGFyYW1zU2NoZW1hIH0pLFxuICBub3RpZmljYXRpb25Db250cm9sbGVyLm1hcmtBc1JlYWQsXG4pO1xuXG5leHBvcnQgY29uc3Qgbm90aWZpY2F0aW9uUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgbm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gXCIuL25vdGlmaWNhdGlvbi5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gTXkgbm90aWZpY2F0aW9ucyBjb250cm9sbGVyIChhbnkgYXV0aGVudGljYXRlZCB1c2VyKVxuY29uc3QgZ2V0TXlOb3RpZmljYXRpb25zID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbm90aWZpY2F0aW9uU2VydmljZS5nZXRNeU5vdGlmaWNhdGlvbnMoXG4gICAgICB1c2VySWQsXG4gICAgICByZXEucXVlcnksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJOb3RpZmljYXRpb25zIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gVW5yZWFkIGNvdW50IGNvbnRyb2xsZXIgKGJlbGwgYmFkZ2UpXG5jb25zdCBnZXRVbnJlYWRDb3VudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5vdGlmaWNhdGlvblNlcnZpY2UuZ2V0VW5yZWFkQ291bnQodXNlcklkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVbnJlYWQgY291bnQgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIE1hcmsgb25lIG5vdGlmaWNhdGlvbiByZWFkIGNvbnRyb2xsZXJcbmNvbnN0IG1hcmtBc1JlYWQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBub3RpZmljYXRpb25TZXJ2aWNlLm1hcmtBc1JlYWQodXNlcklkLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiTm90aWZpY2F0aW9uIG1hcmtlZCBhcyByZWFkLlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNC4gTWFyayBhbGwgbm90aWZpY2F0aW9ucyByZWFkIGNvbnRyb2xsZXJcbmNvbnN0IG1hcmtBbGxBc1JlYWQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBub3RpZmljYXRpb25TZXJ2aWNlLm1hcmtBbGxBc1JlYWQodXNlcklkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgbm90aWZpY2F0aW9ucyBtYXJrZWQgYXMgcmVhZC5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBub3RpZmljYXRpb25Db250cm9sbGVyID0ge1xuICBnZXRNeU5vdGlmaWNhdGlvbnMsXG4gIGdldFVucmVhZENvdW50LFxuICBtYXJrQXNSZWFkLFxuICBtYXJrQWxsQXNSZWFkLFxufTsiLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IElOb3RpZmljYXRpb25RdWVyeSB9IGZyb20gXCIuL25vdGlmaWNhdGlvbi5pbnRlcmZhY2VcIjtcblxuLy8gMS4gTXkgbm90aWZpY2F0aW9ucyAobmV3ZXN0IGZpcnN0KSBcdTIwMTQgb3B0aW9uYWwgP3VucmVhZD10cnVlIGZpbHRlci5cbmNvbnN0IGdldE15Tm90aWZpY2F0aW9ucyA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHF1ZXJ5OiBJTm90aWZpY2F0aW9uUXVlcnksXG4pID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAyMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLk5vdGlmaWNhdGlvbldoZXJlSW5wdXQgPSB7XG4gICAgdXNlcklkLFxuICAgIC4uLihxdWVyeS51bnJlYWQgPyB7IGlzUmVhZDogZmFsc2UgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ub3RpZmljYXRpb24uZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEubm90aWZpY2F0aW9uLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAyLiBVbnJlYWQgY291bnQgZm9yIHRoZSBiZWxsIGJhZGdlIFx1MjAxNCBzaW5nbGUgaW5kZXgtYmFja2VkIGNvdW50LlxuY29uc3QgZ2V0VW5yZWFkQ291bnQgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY291bnQgPSBhd2FpdCBwcmlzbWEubm90aWZpY2F0aW9uLmNvdW50KHtcbiAgICB3aGVyZTogeyB1c2VySWQsIGlzUmVhZDogZmFsc2UgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHsgY291bnQgfTtcbn07XG5cbi8vIDMuIE1hcmsgb25lIG5vdGlmaWNhdGlvbiByZWFkIChvd25lciBvbmx5IFx1MjAxNCBhIGZvcmVpZ24gaWQgaXMgYSA0MDQpLlxuY29uc3QgbWFya0FzUmVhZCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgaWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEubm90aWZpY2F0aW9uLnVwZGF0ZU1hbnkoe1xuICAgIHdoZXJlOiB7IGlkLCB1c2VySWQgfSxcbiAgICBkYXRhOiB7IGlzUmVhZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAocmVzdWx0LmNvdW50ID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJOb3RpZmljYXRpb24gbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiB7IGNvdW50OiByZXN1bHQuY291bnQgfTtcbn07XG5cbi8vIDQuIE1hcmsgYWxsIG15IG5vdGlmaWNhdGlvbnMgcmVhZCBcdTIwMTQgaWRlbXBvdGVudC5cbmNvbnN0IG1hcmtBbGxBc1JlYWQgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLm5vdGlmaWNhdGlvbi51cGRhdGVNYW55KHtcbiAgICB3aGVyZTogeyB1c2VySWQsIGlzUmVhZDogZmFsc2UgfSxcbiAgICBkYXRhOiB7IGlzUmVhZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4geyBjb3VudDogcmVzdWx0LmNvdW50IH07XG59O1xuXG5leHBvcnQgY29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IHtcbiAgZ2V0TXlOb3RpZmljYXRpb25zLFxuICBnZXRVbnJlYWRDb3VudCxcbiAgbWFya0FzUmVhZCxcbiAgbWFya0FsbEFzUmVhZCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IG5vdGlmaWNhdGlvblF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMjApLFxuICAvLyBcInRydWVcIi9cImZhbHNlXCIgc3RyaW5ncyBvbmx5IFx1MjAxNCB6LmNvZXJjZS5ib29sZWFuKCkgd291bGQgdHJlYXQgdGhlIHN0cmluZ1xuICAvLyBcImZhbHNlXCIgYXMgdHJ1dGh5LlxuICB1bnJlYWQ6IHpcbiAgICAuZW51bShbXCJ0cnVlXCIsIFwiZmFsc2VcIl0pXG4gICAgLnRyYW5zZm9ybSgodmFsdWUpID0+IHZhbHVlID09PSBcInRydWVcIilcbiAgICAub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBub3RpZmljYXRpb25QYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk5vdGlmaWNhdGlvbiBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbigxLCBcIk5vdGlmaWNhdGlvbiBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5leHBvcnQgY29uc3Qgbm90aWZpY2F0aW9uVmFsaWRhdGlvbnMgPSB7XG4gIG5vdGlmaWNhdGlvblF1ZXJ5U2NoZW1hLFxuICBub3RpZmljYXRpb25QYXJhbXNTY2hlbWEsXG59OyIsICIvLyBWZXJjZWwgc2VydmVybGVzcyBlbnRyeXBvaW50IFx1MjAxNCByZS1leHBvcnRzIHRoZSBzYW1lIEV4cHJlc3MgYXBwIHRoZSBsb2NhbFxuLy8gYnVpbGQgdXNlcy4gVmVyY2VsJ3MgQHZlcmNlbC9ub2RlIHJ1bnRpbWUgY29tcGlsZXMgYW5kIHdyYXBzIGl0OyB0aGUgYXBwIGlzXG4vLyBzcGxpdCBmcm9tIHNlcnZlci50cyAod2hpY2ggb25seSBzdGFydHMgdGhlIGxpc3RlbmVyKSBzbyB0aGUgdHdvIGhvc3RzIHNoYXJlXG4vLyBvbmUgcm91dGUgcmVnaXN0cnkuXG5pbXBvcnQgYXBwIGZyb20gXCIuLi9zcmMvYXBwXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGFwcDsiXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7O0FBQUEsT0FBTyxhQUErRDtBQUN0RSxPQUFPLFVBQVU7QUFDakIsT0FBTyxrQkFBa0I7QUFDekIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sWUFBWTtBQUNuQixPQUFPLGVBQWU7OztBQ0x0QixPQUFPLFlBQVk7QUFDbkIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsU0FBUztBQUVsQixPQUFPLE9BQU87QUFBQSxFQUNaLE9BQU87QUFBQSxFQUNQLE1BQU0sS0FBSyxLQUFLLFFBQVEsSUFBSSxHQUFHLE1BQU07QUFDdkMsQ0FBQztBQUtELElBQU0sWUFBWSxFQUFFLE9BQU87QUFBQSxFQUN6QixNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsTUFBTTtBQUFBLEVBQy9CLFVBQVUsRUFBRSxLQUFLLENBQUMsZUFBZSxZQUFZLENBQUMsRUFBRSxRQUFRLGFBQWE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTXJFLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUztBQUFBLEVBQzVDLG1CQUFtQixFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUztBQUFBLEVBRTdDLGNBQWMsRUFBRSxPQUFPLEVBQUUsSUFBSSxHQUFHLDBCQUEwQjtBQUFBLEVBRTFELG9CQUFvQixFQUFFLE9BQU8sRUFBRSxRQUFRLElBQUk7QUFBQTtBQUFBO0FBQUEsRUFJM0MsYUFBYSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUztBQUFBLEVBQ3pD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LFdBQVcsT0FBTyxLQUFjLFFBQWtCO0FBQ3hELE1BQUk7QUFDRixVQUFNLE9BQU87QUFDYixRQUFJLE9BQU8sR0FBRyxFQUFFLEtBQUs7QUFBQSxNQUNuQixTQUFTO0FBQUEsTUFDVCxTQUFTO0FBQUEsTUFDVCxJQUFJO0FBQUEsTUFDSixZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsSUFDcEMsQ0FBQztBQUFBLEVBQ0gsU0FBUyxPQUFPO0FBQ2QsUUFBSSxPQUFPLEdBQUcsRUFBRSxLQUFLO0FBQUEsTUFDbkIsU0FBUztBQUFBLE1BQ1QsU0FBUztBQUFBLE1BQ1QsSUFBSTtBQUFBLE1BQ0osWUFBVyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLElBQ3BDLENBQUM7QUFBQSxFQUNIO0FBQ0YsQ0FBQztBQUdELElBQUksSUFBSSxhQUFhLFVBQVU7QUFDL0IsSUFBSSxJQUFJLGNBQWMsVUFBVTtBQUNoQyxJQUFJLElBQUksZ0JBQWdCLFlBQVk7QUFDcEMsSUFBSSxJQUFJLGdCQUFnQixhQUFhO0FBQ3JDLElBQUksSUFBSSxtQkFBbUIsY0FBYztBQUN6QyxJQUFJLElBQUksaUJBQWlCLGFBQWE7QUFDdEMsSUFBSSxJQUFJLGdCQUFnQixZQUFZO0FBQ3BDLElBQUksSUFBSSxpQkFBaUIsYUFBYTtBQUN0QyxJQUFJLElBQUksYUFBYSxVQUFVO0FBQy9CLElBQUksSUFBSSxrQkFBa0IsZUFBZTtBQUN6QyxJQUFJLElBQUksaUJBQWlCLGFBQWE7QUFDdEMsSUFBSSxJQUFJLGlCQUFpQixjQUFjO0FBQ3ZDLElBQUksSUFBSSxzQkFBc0Isa0JBQWtCO0FBRWhELElBQUksSUFBSSxnQkFBZTtBQUN2QixJQUFJLElBQUksMEJBQWtCO0FBRTFCLElBQU8sY0FBUTs7O0ErRTNIZixJQUFPLGdCQUFROyIsCiAgIm5hbWVzIjogWyJwYXRoIiwgImNvbmZpZyIsICJCdWZmZXIiLCAiQW55TnVsbCIsICJEYk51bGwiLCAiRGVjaW1hbCIsICJKc29uTnVsbCIsICJOdWxsVHlwZXMiLCAiUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvciIsICJQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciIsICJQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciIsICJQcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yIiwgIlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciIsICJTcWwiLCAiZW1wdHkiLCAiam9pbiIsICJyYXciLCAicnVudGltZSIsICJodHRwU3RhdHVzIiwgInBhdGgiLCAicmVmcmVzaFRva2VuIiwgInJlZnJlc2hUb2tlbiIsICJyZWdpc3RlclVzZXIiLCAiaHR0cFN0YXR1cyIsICJsb2dpblVzZXIiLCAiZ29vZ2xlTG9naW4iLCAiZGVtb0xvZ2luIiwgInZlcmlmeUVtYWlsIiwgInJlc2VuZFZlcmlmaWNhdGlvbiIsICJmb3Jnb3RQYXNzd29yZCIsICJyZXNldFBhc3N3b3JkIiwgInoiLCAieiIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJiY3J5cHQiLCAiYmNyeXB0IiwgInVwZGF0ZVByb2ZpbGUiLCAiaHR0cFN0YXR1cyIsICJnZXRVc2VycyIsICJjaGFuZ2VSb2xlIiwgImNoYW5nZVN0YXR1cyIsICJkZWxldGVVc2VyIiwgInoiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJtdWx0ZXIiLCAiaHR0cFN0YXR1cyIsICJodHRwU3RhdHVzIiwgIm11bHRlciIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZU1lc3NhZ2UiLCAiaHR0cFN0YXR1cyIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlQm9va2luZyIsICJodHRwU3RhdHVzIiwgImdldE15Qm9va2luZ3MiLCAiZ2V0QWdlbnRCb29raW5ncyIsICJnZXRCb29raW5nRGV0YWlsIiwgImdldEFsbEJvb2tpbmdzIiwgInVwZGF0ZUJvb2tpbmdTdGF0dXMiLCAieiIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlUmV2aWV3IiwgImh0dHBTdGF0dXMiLCAidXBkYXRlUmV2aWV3IiwgImRlbGV0ZVJldmlldyIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlQ2F0ZWdvcnkiLCAiaHR0cFN0YXR1cyIsICJnZXRBbGxDYXRlZ29yaWVzIiwgInVwZGF0ZUNhdGVnb3J5IiwgImRlbGV0ZUNhdGVnb3J5IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJyYW5kb21VVUlEIiwgInJhbmRvbVVVSUQiLCAiY3JlYXRlUGFja2FnZSIsICJodHRwU3RhdHVzIiwgImdldFB1YmxpY1BhY2thZ2VzIiwgImdldFBhY2thZ2VCeVNsdWciLCAiZ2V0QWxsUGFja2FnZXMiLCAiZ2V0TXlQYWNrYWdlcyIsICJ1cGRhdGVQYWNrYWdlIiwgImNoYW5nZVBhY2thZ2VTdGF0dXMiLCAic29mdERlbGV0ZVBhY2thZ2UiLCAieiIsICJ1cGRhdGVTdGF0dXNTY2hlbWEiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJyYW5kb21VVUlEIiwgImdlbmVyYXRlVW5pcXVlU2x1ZyIsICJyYW5kb21VVUlEIiwgImNyZWF0ZVBvc3QiLCAiaHR0cFN0YXR1cyIsICJnZXRQdWJsaWNQb3N0cyIsICJnZXRQb3N0QnlTbHVnIiwgImdldEFsbFBvc3RzIiwgImdldE15UG9zdHMiLCAidXBkYXRlUG9zdCIsICJjaGFuZ2VQb3N0U3RhdHVzIiwgInNvZnREZWxldGVQb3N0IiwgInoiLCAidGl0bGVTY2hlbWEiLCAidXBkYXRlU3RhdHVzU2NoZW1hIiwgImh0dHBTdGF0dXMiLCAiZ2V0UG9zdENvbW1lbnRzIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlQ29tbWVudCIsICJkZWxldGVDb21tZW50IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJnZXRBZG1pbkRhc2hib2FyZCIsICJodHRwU3RhdHVzIiwgImdldEFnZW50RGFzaGJvYXJkIiwgImdldFVzZXJEYXNoYm9hcmQiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImh0dHBTdGF0dXMiLCAieiIsICJjcmVhdGVTY2hlbWEiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJhZGRUb1dpc2hsaXN0IiwgImh0dHBTdGF0dXMiLCAiZ2V0TXlXaXNobGlzdCIsICJyZW1vdmVGcm9tV2lzaGxpc3QiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImdldE15Tm90aWZpY2F0aW9ucyIsICJodHRwU3RhdHVzIiwgImdldFVucmVhZENvdW50IiwgIm1hcmtBc1JlYWQiLCAibWFya0FsbEFzUmVhZCIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiXQp9Cg==
