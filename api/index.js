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
  graph: "wAZxwAEPBwAAoQMAIBQAAKMDACAVAACkAwAgFgAA-QIAIN8BAACiAwAw4AEAACgAEOEBAACiAwAw4gEBAAAAAeMBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhrwIBAOsCACGzAgEA6wIAIbQCAQDsAgAhAQAAAAEAIBcFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIQUFAADmBQAgBgAA4AUAIAsAAJ4FACAMAACfBQAgDQAAoQUAIBcFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAAAAAeUBQADyAgAh-gEAALcDjQIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAAAAAYYCAQDrAgAhhwIBAOsCACGIAhAArwMAIYkCAgDxAgAhigIIALYDACGLAgAA_gIAII0CAQDrAgAhjgIBAOsCACEDAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAEAAAADACAPBwAAoQMAIAgAAKsDACAKAAC0AwAg3wEAALIDADDgAQAACQAQ4QEAALIDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA64CIoACQADyAgAhqgJAAPICACGrAgIA8QIAIawCEACvAwAhAwcAAOAFACAIAADjBQAgCgAA5QUAIA8HAAChAwAgCAAAqwMAIAoAALQDACDfAQAAsgMAMOABAAAJABDhAQAAsgMAMOIBAQAAAAHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH6AQAAswOuAiKAAkAA8gIAIaoCQADyAgAhqwICAPECACGsAhAArwMAIQMAAAAJACABAAAKADACAAALACAUCQAAsQMAIN8BAACuAwAw4AEAAA0AEOEBAACuAwAw4gEBAOsCACHlAUAA8gIAIfoBAACwA5wCIoACQADyAgAhlgIBAOsCACGXAgEA6wIAIZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhCQkAAOQFACCYAgAAwgMAIJwCAADCAwAgnQIAAMIDACCeAgAAwgMAIJ8CAADCAwAgoAIAAMIDACChAgAAwgMAIKICAADCAwAgFAkAALEDACDfAQAArgMAMOABAAANABDhAQAArgMAMOIBAQAAAAHlAUAA8gIAIfoBAACwA5wCIoACQADyAgAhlgIBAOsCACGXAgEAAAABmAIBAOwCACGZAhAArwMAIZoCAQDrAgAhnAIBAOwCACGdAgEA7AIAIZ4CAQDsAgAhnwIBAOwCACGgAkAAoAMAIaECAQDsAgAhogJAAKADACEDAAAADQAgAQAADgAwAgAADwAgAQAAAA0AIA0HAAChAwAgCAAAqwMAIN8BAACtAwAw4AEAABIAEOEBAACtAwAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhigICAPECACGSAgEA6wIAIQIHAADgBQAgCAAA4wUAIA4HAAChAwAgCAAAqwMAIN8BAACtAwAw4AEAABIAEOEBAACtAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhtQIAAKwDACADAAAAEgAgAQAAEwAwAgAAFAAgCQcAAKEDACAIAACrAwAg3wEAAKoDADDgAQAAFgAQ4QEAAKoDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIQIHAADgBQAgCAAA4wUAIAoHAAChAwAgCAAAqwMAIN8BAACqAwAw4AEAABYAEOEBAACqAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIbUCAACpAwAgAwAAABYAIAEAABcAMAIAABgAIAEAAAAJACABAAAAEgAgAQAAABYAIAMAAAAJACABAAAKADACAAALACADAAAAEgAgAQAAEwAwAgAAFAAgEBEAAPkCACATAAChAwAg3wEAAKcDADDgAQAAHwAQ4QEAAKcDADDiAQEA6wIAIeUBQADyAgAh-gEAAKgDsgIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAOsCACGuAgEA6wIAIa8CAQDrAgAhsAIBAOsCACGyAgEA6wIAIQIRAACjBQAgEwAA4AUAIBARAAD5AgAgEwAAoQMAIN8BAACnAwAw4AEAAB8AEOEBAACnAwAw4gEBAAAAAeUBQADyAgAh-gEAAKgDsgIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAAAAAa4CAQDrAgAhrwIBAOsCACGwAgEA6wIAIbICAQDrAgAhAwAAAB8AIAEAACAAMAIAACEAIAMAAAAWACABAAAXADACAAAYACAMBwAAoQMAIN8BAAClAwAw4AEAACQAEOEBAAClAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAhhAIBAOsCACGkAgAApgOkAiKlAgEA6wIAIaYCAQDsAgAhpwIgAPACACECBwAA4AUAIKYCAADCAwAgDAcAAKEDACDfAQAApQMAMOABAAAkABDhAQAApQMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhhAIBAOsCACGkAgAApgOkAiKlAgEA6wIAIaYCAQDsAgAhpwIgAPACACEDAAAAJAAgAQAAJQAwAgAAJgAgDwcAAKEDACAUAACjAwAgFQAApAMAIBYAAPkCACDfAQAAogMAMOABAAAoABDhAQAAogMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGvAgEA6wIAIbMCAQDrAgAhtAIBAOwCACEFBwAA4AUAIBQAAOEFACAVAADiBQAgFgAAowUAILQCAADCAwAgAwAAACgAIAEAACkAMAIAAAEAIAoHAAChAwAg3wEAAJ8DADDgAQAAKwAQ4QEAAJ8DADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACGTAgEA6wIAIZQCQADyAgAhlQJAAKADACECBwAA4AUAIJUCAADCAwAgCgcAAKEDACDfAQAAnwMAMOABAAArABDhAQAAnwMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhkwIBAAAAAZQCQADyAgAhlQJAAKADACEDAAAAKwAgAQAALAAwAgAALQAgAQAAAAMAIAEAAAAJACABAAAAEgAgAQAAAB8AIAEAAAAWACABAAAAJAAgAQAAACgAIAEAAAArACADAAAAKAAgAQAAKQAwAgAAAQAgAQAAACgAIAEAAAAoACADAAAAKAAgAQAAKQAwAgAAAQAgAQAAACgAIAEAAAABACADAAAAKAAgAQAAKQAwAgAAAQAgAwAAACgAIAEAACkAMAIAAAEAIAMAAAAoACABAAApADACAAABACAMBwAA_AMAIBQAAPsDACAVAAD_AwAgFgAA_QMAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABrwIBAAAAAbMCAQAAAAG0AgEAAAABARwAAEAAIAjiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAGzAgEAAAABtAIBAAAAAQEcAABCADABHAAAQgAwAQAAACgAIAwHAAD5AwAgFAAA7gMAIBUAAO8DACAWAADwAwAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIa8CAQC8AwAhswIBALwDACG0AgEAyAMAIQIAAAABACAcAABGACAI4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIa8CAQC8AwAhswIBALwDACG0AgEAyAMAIQIAAAAoACAcAABIACACAAAAKAAgHAAASAAgAQAAACgAIAMAAAABACAjAABAACAkAABGACABAAAAAQAgAQAAACgAIAQEAADdBQAgKQAA3wUAICoAAN4FACC0AgAAwgMAIAvfAQAAngMAMOABAABQABDhAQAAngMAMOIBAQDPAgAh4wEBAM8CACHlAUAA0AIAIf4BIADbAgAhgAJAANACACGvAgEAzwIAIbMCAQDPAgAhtAIBANcCACEDAAAAKAAgAQAATwAwKAAAUAAgAwAAACgAIAEAACkAMAIAAAEAIAEAAAAhACABAAAAIQAgAwAAAB8AIAEAACAAMAIAACEAIAMAAAAfACABAAAgADACAAAhACADAAAAHwAgAQAAIAAwAgAAIQAgDREAALAEACATAADcBQAg4gEBAAAAAeUBQAAAAAH6AQAAALICAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGuAgEAAAABrwIBAAAAAbACAQAAAAGyAgEAAAABARwAAFgAIAviAQEAAAAB5QFAAAAAAfoBAAAAsgIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAa4CAQAAAAGvAgEAAAABsAIBAAAAAbICAQAAAAEBHAAAWgAwARwAAFoAMA0RAAClBAAgEwAA2wUAIOIBAQC8AwAh5QFAAL0DACH6AQAAowSyAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIa4CAQC8AwAhrwIBALwDACGwAgEAvAMAIbICAQC8AwAhAgAAACEAIBwAAF0AIAviAQEAvAMAIeUBQAC9AwAh-gEAAKMEsgIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGuAgEAvAMAIa8CAQC8AwAhsAIBALwDACGyAgEAvAMAIQIAAAAfACAcAABfACACAAAAHwAgHAAAXwAgAwAAACEAICMAAFgAICQAAF0AIAEAAAAhACABAAAAHwAgAwQAANgFACApAADaBQAgKgAA2QUAIA7fAQAAmgMAMOABAABmABDhAQAAmgMAMOIBAQDPAgAh5QFAANACACH6AQAAmwOyAiL-ASAA2wIAIYACQADQAgAhhAIBAM8CACGFAgEAzwIAIa4CAQDPAgAhrwIBAM8CACGwAgEAzwIAIbICAQDPAgAhAwAAAB8AIAEAAGUAMCgAAGYAIAMAAAAfACABAAAgADACAAAhACABAAAACwAgAQAAAAsAIAMAAAAJACABAAAKADACAAALACADAAAACQAgAQAACgAwAgAACwAgAwAAAAkAIAEAAAoAMAIAAAsAIAwHAACOBQAgCAAA3AQAIAoAAN0EACDiAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACuAgKAAkAAAAABqgJAAAAAAasCAgAAAAGsAhAAAAABARwAAG4AIAniAQEAAAAB4wEBAAAAAeQBAQAAAAHlAUAAAAAB-gEAAACuAgKAAkAAAAABqgJAAAAAAasCAgAAAAGsAhAAAAABARwAAHAAMAEcAABwADAMBwAAjAUAIAgAAMwEACAKAADNBAAg4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSuAiKAAkAAvQMAIaoCQAC9AwAhqwICAM0DACGsAhAAyQQAIQIAAAALACAcAABzACAJ4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH6AQAAygSuAiKAAkAAvQMAIaoCQAC9AwAhqwICAM0DACGsAhAAyQQAIQIAAAAJACAcAAB1ACACAAAACQAgHAAAdQAgAwAAAAsAICMAAG4AICQAAHMAIAEAAAALACABAAAACQAgBQQAANMFACApAADWBQAgKgAA1QUAIEsAANQFACBMAADXBQAgDN8BAACWAwAw4AEAAHwAEOEBAACWAwAw4gEBAM8CACHjAQEAzwIAIeQBAQDPAgAh5QFAANACACH6AQAAlwOuAiKAAkAA0AIAIaoCQADQAgAhqwICANwCACGsAhAA_AIAIQMAAAAJACABAAB7ADAoAAB8ACADAAAACQAgAQAACgAwAgAACwAgCQMAAPMCACDfAQAAlQMAMOABAACCAQAQ4QEAAJUDADDiAQEAAAAB5QFAAPICACHxAQEAAAABgAJAAPICACGFAgEAAAABAQAAAH8AIAEAAAB_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_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQEcAAD6AQAwARwAAPoBADAKBwAAgQUAIAgAALwEACDiAQEAvAMAIeMBAQC8AwAh5AEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGKAgIAzQMAIZICAQC8AwAhAgAAABQAIBwAAP0BACAI4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhigICAM0DACGSAgEAvAMAIQIAAAASACAcAAD_AQAgAgAAABIAIBwAAP8BACADAAAAFAAgIwAA-AEAICQAAP0BACABAAAAFAAgAQAAABIAIAUEAACsBQAgKQAArwUAICoAAK4FACBLAACtBQAgTAAAsAUAIAvfAQAAhQMAMOABAACGAgAQ4QEAAIUDADDiAQEAzwIAIeMBAQDPAgAh5AEBAM8CACHlAUAA0AIAIf4BIADbAgAhgAJAANACACGKAgIA3AIAIZICAQDPAgAhAwAAABIAIAEAAIUCADAoAACGAgAgAwAAABIAIAEAABMAMAIAABQAIAEAAAAFACABAAAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgFAUAAJEFACAGAACrBQAgCwAAkgUAIAwAAJMFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAEBHAAAjgIAIA_iAQEAAAAB5QFAAAAAAfoBAAAAjQIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIQAAAAAYkCAgAAAAGKAggAAAABiwIAAJAFACCNAgEAAAABjgIBAAAAAQEcAACQAgAwARwAAJACADAUBQAA7AQAIAYAAKoFACALAADtBAAgDAAA7gQAIA0AAO8EACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIY4CAQC8AwAhAgAAAAUAIBwAAJMCACAP4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIQIAAAADACAcAACVAgAgAgAAAAMAIBwAAJUCACADAAAABQAgIwAAjgIAICQAAJMCACABAAAABQAgAQAAAAMAIAUEAAClBQAgKQAAqAUAICoAAKcFACBLAACmBQAgTAAAqQUAIBLfAQAA-wIAMOABAACcAgAQ4QEAAPsCADDiAQEAzwIAIeUBQADQAgAh-gEAAP8CjQIi_gEgANsCACGAAkAA0AIAIYQCAQDPAgAhhQIBAM8CACGGAgEAzwIAIYcCAQDPAgAhiAIQAPwCACGJAgIA3AIAIYoCCAD9AgAhiwIAAP4CACCNAgEAzwIAIY4CAQDPAgAhAwAAAAMAIAEAAJsCADAoAACcAgAgAwAAAAMAIAEAAAQAMAIAAAUAIBoDAADzAgAgCwAA9AIAIAwAAPUCACAOAAD2AgAgDwAA9wIAIBAAAPgCACARAAD5AgAgEgAA-gIAIN8BAADqAgAw4AEAAKICABDhAQAA6gIAMOIBAQAAAAHlAUAA8gIAIfEBAQDrAgAh8gEBAAAAAfMBAQDsAgAh9AEBAAAAAfUBAQDsAgAh9gEBAOwCACH4AQAA7QL4ASL6AQAA7gL6ASL8AQAA7wL8ASL9ASAA8AIAIf4BIADwAgAh_wECAPECACGAAkAA8gIAIQEAAACfAgAgAQAAAJ8CACAaAwAA8wIAIAsAAPQCACAMAAD1AgAgDgAA9gIAIA8AAPcCACAQAAD4AgAgEQAA-QIAIBIAAPoCACDfAQAA6gIAMOABAACiAgAQ4QEAAOoCADDiAQEA6wIAIeUBQADyAgAh8QEBAOsCACHyAQEA6wIAIfMBAQDsAgAh9AEBAOwCACH1AQEA7AIAIfYBAQDsAgAh-AEAAO0C-AEi-gEAAO4C-gEi_AEAAO8C_AEi_QEgAPACACH-ASAA8AIAIf8BAgDxAgAhgAJAAPICACEMAwAAnQUAIAsAAJ4FACAMAACfBQAgDgAAoAUAIA8AAKEFACAQAACiBQAgEQAAowUAIBIAAKQFACDzAQAAwgMAIPQBAADCAwAg9QEAAMIDACD2AQAAwgMAIAMAAACiAgAgAQAAowIAMAIAAJ8CACADAAAAogIAIAEAAKMCADACAACfAgAgAwAAAKICACABAACjAgAwAgAAnwIAIBcDAACVBQAgCwAAlgUAIAwAAJcFACAOAACYBQAgDwAAmQUAIBAAAJoFACARAACbBQAgEgAAnAUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQEcAACnAgAgD-IBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQEcAACpAgAwARwAAKkCADAXAwAAzgMAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACECAAAAnwIAIBwAAKwCACAP4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhAgAAAKICACAcAACuAgAgAgAAAKICACAcAACuAgAgAwAAAJ8CACAjAACnAgAgJAAArAIAIAEAAACfAgAgAQAAAKICACAJBAAAwwMAICkAAMYDACAqAADFAwAgSwAAxAMAIEwAAMcDACDzAQAAwgMAIPQBAADCAwAg9QEAAMIDACD2AQAAwgMAIBLfAQAA1gIAMOABAAC1AgAQ4QEAANYCADDiAQEAzwIAIeUBQADQAgAh8QEBAM8CACHyAQEAzwIAIfMBAQDXAgAh9AEBANcCACH1AQEA1wIAIfYBAQDXAgAh-AEAANgC-AEi-gEAANkC-gEi_AEAANoC_AEi_QEgANsCACH-ASAA2wIAIf8BAgDcAgAhgAJAANACACEDAAAAogIAIAEAALQCADAoAAC1AgAgAwAAAKICACABAACjAgAwAgAAnwIAIAEAAAAYACABAAAAGAAgAwAAABYAIAEAABcAMAIAABgAIAMAAAAWACABAAAXADACAAAYACADAAAAFgAgAQAAFwAwAgAAGAAgBgcAAMADACAIAADBAwAg4gEBAAAAAeMBAQAAAAHkAQEAAAAB5QFAAAAAAQEcAAC9AgAgBOIBAQAAAAHjAQEAAAAB5AEBAAAAAeUBQAAAAAEBHAAAvwIAMAEcAAC_AgAwBgcAAL4DACAIAAC_AwAg4gEBALwDACHjAQEAvAMAIeQBAQC8AwAh5QFAAL0DACECAAAAGAAgHAAAwgIAIATiAQEAvAMAIeMBAQC8AwAh5AEBALwDACHlAUAAvQMAIQIAAAAWACAcAADEAgAgAgAAABYAIBwAAMQCACADAAAAGAAgIwAAvQIAICQAAMICACABAAAAGAAgAQAAABYAIAMEAAC5AwAgKQAAuwMAICoAALoDACAH3wEAAM4CADDgAQAAywIAEOEBAADOAgAw4gEBAM8CACHjAQEAzwIAIeQBAQDPAgAh5QFAANACACEDAAAAFgAgAQAAygIAMCgAAMsCACADAAAAFgAgAQAAFwAwAgAAGAAgB98BAADOAgAw4AEAAMsCABDhAQAAzgIAMOIBAQDPAgAh4wEBAM8CACHkAQEAzwIAIeUBQADQAgAhDgQAANICACApAADVAgAgKgAA1QIAIOYBAQAAAAHnAQEAAAAE6AEBAAAABOkBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA1AIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAAQsEAADSAgAgKQAA0wIAICoAANMCACDmAUAAAAAB5wFAAAAABOgBQAAAAATpAUAAAAAB6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAANECACELBAAA0gIAICkAANMCACAqAADTAgAg5gFAAAAAAecBQAAAAAToAUAAAAAE6QFAAAAAAeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQADRAgAhCOYBAgAAAAHnAQIAAAAE6AECAAAABOkBAgAAAAHqAQIAAAAB6wECAAAAAewBAgAAAAHtAQIA0gIAIQjmAUAAAAAB5wFAAAAABOgBQAAAAATpAUAAAAAB6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAANMCACEOBAAA0gIAICkAANUCACAqAADVAgAg5gEBAAAAAecBAQAAAAToAQEAAAAE6QEBAAAAAeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQDUAgAh7gEBAAAAAe8BAQAAAAHwAQEAAAABC-YBAQAAAAHnAQEAAAAE6AEBAAAABOkBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA1QIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAARLfAQAA1gIAMOABAAC1AgAQ4QEAANYCADDiAQEAzwIAIeUBQADQAgAh8QEBAM8CACHyAQEAzwIAIfMBAQDXAgAh9AEBANcCACH1AQEA1wIAIfYBAQDXAgAh-AEAANgC-AEi-gEAANkC-gEi_AEAANoC_AEi_QEgANsCACH-ASAA2wIAIf8BAgDcAgAhgAJAANACACEOBAAA6AIAICkAAOkCACAqAADpAgAg5gEBAAAAAecBAQAAAAXoAQEAAAAF6QEBAAAAAeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQDnAgAh7gEBAAAAAe8BAQAAAAHwAQEAAAABBwQAANICACApAADmAgAgKgAA5gIAIOYBAAAA-AEC5wEAAAD4AQjoAQAAAPgBCO0BAADlAvgBIgcEAADSAgAgKQAA5AIAICoAAOQCACDmAQAAAPoBAucBAAAA-gEI6AEAAAD6AQjtAQAA4wL6ASIHBAAA0gIAICkAAOICACAqAADiAgAg5gEAAAD8AQLnAQAAAPwBCOgBAAAA_AEI7QEAAOEC_AEiBQQAANICACApAADgAgAgKgAA4AIAIOYBIAAAAAHtASAA3wIAIQ0EAADSAgAgKQAA0gIAICoAANICACBLAADeAgAgTAAA0gIAIOYBAgAAAAHnAQIAAAAE6AECAAAABOkBAgAAAAHqAQIAAAAB6wECAAAAAewBAgAAAAHtAQIA3QIAIQ0EAADSAgAgKQAA0gIAICoAANICACBLAADeAgAgTAAA0gIAIOYBAgAAAAHnAQIAAAAE6AECAAAABOkBAgAAAAHqAQIAAAAB6wECAAAAAewBAgAAAAHtAQIA3QIAIQjmAQgAAAAB5wEIAAAABOgBCAAAAATpAQgAAAAB6gEIAAAAAesBCAAAAAHsAQgAAAAB7QEIAN4CACEFBAAA0gIAICkAAOACACAqAADgAgAg5gEgAAAAAe0BIADfAgAhAuYBIAAAAAHtASAA4AIAIQcEAADSAgAgKQAA4gIAICoAAOICACDmAQAAAPwBAucBAAAA_AEI6AEAAAD8AQjtAQAA4QL8ASIE5gEAAAD8AQLnAQAAAPwBCOgBAAAA_AEI7QEAAOIC_AEiBwQAANICACApAADkAgAgKgAA5AIAIOYBAAAA-gEC5wEAAAD6AQjoAQAAAPoBCO0BAADjAvoBIgTmAQAAAPoBAucBAAAA-gEI6AEAAAD6AQjtAQAA5AL6ASIHBAAA0gIAICkAAOYCACAqAADmAgAg5gEAAAD4AQLnAQAAAPgBCOgBAAAA-AEI7QEAAOUC-AEiBOYBAAAA-AEC5wEAAAD4AQjoAQAAAPgBCO0BAADmAvgBIg4EAADoAgAgKQAA6QIAICoAAOkCACDmAQEAAAAB5wEBAAAABegBAQAAAAXpAQEAAAAB6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBAOcCACHuAQEAAAAB7wEBAAAAAfABAQAAAAEI5gECAAAAAecBAgAAAAXoAQIAAAAF6QECAAAAAeoBAgAAAAHrAQIAAAAB7AECAAAAAe0BAgDoAgAhC-YBAQAAAAHnAQEAAAAF6AEBAAAABekBAQAAAAHqAQEAAAAB6wEBAAAAAewBAQAAAAHtAQEA6QIAIe4BAQAAAAHvAQEAAAAB8AEBAAAAARoDAADzAgAgCwAA9AIAIAwAAPUCACAOAAD2AgAgDwAA9wIAIBAAAPgCACARAAD5AgAgEgAA-gIAIN8BAADqAgAw4AEAAKICABDhAQAA6gIAMOIBAQDrAgAh5QFAAPICACHxAQEA6wIAIfIBAQDrAgAh8wEBAOwCACH0AQEA7AIAIfUBAQDsAgAh9gEBAOwCACH4AQAA7QL4ASL6AQAA7gL6ASL8AQAA7wL8ASL9ASAA8AIAIf4BIADwAgAh_wECAPECACGAAkAA8gIAIQvmAQEAAAAB5wEBAAAABOgBAQAAAATpAQEAAAAB6gEBAAAAAesBAQAAAAHsAQEAAAAB7QEBANUCACHuAQEAAAAB7wEBAAAAAfABAQAAAAEL5gEBAAAAAecBAQAAAAXoAQEAAAAF6QEBAAAAAeoBAQAAAAHrAQEAAAAB7AEBAAAAAe0BAQDpAgAh7gEBAAAAAe8BAQAAAAHwAQEAAAABBOYBAAAA-AEC5wEAAAD4AQjoAQAAAPgBCO0BAADmAvgBIgTmAQAAAPoBAucBAAAA-gEI6AEAAAD6AQjtAQAA5AL6ASIE5gEAAAD8AQLnAQAAAPwBCOgBAAAA_AEI7QEAAOIC_AEiAuYBIAAAAAHtASAA4AIAIQjmAQIAAAAB5wECAAAABOgBAgAAAATpAQIAAAAB6gECAAAAAesBAgAAAAHsAQIAAAAB7QECANICACEI5gFAAAAAAecBQAAAAAToAUAAAAAE6QFAAAAAAeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQADTAgAhA4ECAAADACCCAgAAAwAggwIAAAMAIAOBAgAACQAgggIAAAkAIIMCAAAJACADgQIAABIAIIICAAASACCDAgAAEgAgA4ECAAAfACCCAgAAHwAggwIAAB8AIAOBAgAAFgAgggIAABYAIIMCAAAWACADgQIAACQAIIICAAAkACCDAgAAJAAgA4ECAAAoACCCAgAAKAAggwIAACgAIAOBAgAAKwAgggIAACsAIIMCAAArACAS3wEAAPsCADDgAQAAnAIAEOEBAAD7AgAw4gEBAM8CACHlAUAA0AIAIfoBAAD_Ao0CIv4BIADbAgAhgAJAANACACGEAgEAzwIAIYUCAQDPAgAhhgIBAM8CACGHAgEAzwIAIYgCEAD8AgAhiQICANwCACGKAggA_QIAIYsCAAD-AgAgjQIBAM8CACGOAgEAzwIAIQ0EAADSAgAgKQAAhAMAICoAAIQDACBLAACEAwAgTAAAhAMAIOYBEAAAAAHnARAAAAAE6AEQAAAABOkBEAAAAAHqARAAAAAB6wEQAAAAAewBEAAAAAHtARAAgwMAIQ0EAADSAgAgKQAA3gIAICoAAN4CACBLAADeAgAgTAAA3gIAIOYBCAAAAAHnAQgAAAAE6AEIAAAABOkBCAAAAAHqAQgAAAAB6wEIAAAAAewBCAAAAAHtAQgAggMAIQTmAQEAAAAFjwIBAAAAAZACAQAAAASRAgEAAAAEBwQAANICACApAACBAwAgKgAAgQMAIOYBAAAAjQIC5wEAAACNAgjoAQAAAI0CCO0BAACAA40CIgcEAADSAgAgKQAAgQMAICoAAIEDACDmAQAAAI0CAucBAAAAjQII6AEAAACNAgjtAQAAgAONAiIE5gEAAACNAgLnAQAAAI0CCOgBAAAAjQII7QEAAIEDjQIiDQQAANICACApAADeAgAgKgAA3gIAIEsAAN4CACBMAADeAgAg5gEIAAAAAecBCAAAAAToAQgAAAAE6QEIAAAAAeoBCAAAAAHrAQgAAAAB7AEIAAAAAe0BCACCAwAhDQQAANICACApAACEAwAgKgAAhAMAIEsAAIQDACBMAACEAwAg5gEQAAAAAecBEAAAAAToARAAAAAE6QEQAAAAAeoBEAAAAAHrARAAAAAB7AEQAAAAAe0BEACDAwAhCOYBEAAAAAHnARAAAAAE6AEQAAAABOkBEAAAAAHqARAAAAAB6wEQAAAAAewBEAAAAAHtARAAhAMAIQvfAQAAhQMAMOABAACGAgAQ4QEAAIUDADDiAQEAzwIAIeMBAQDPAgAh5AEBAM8CACHlAUAA0AIAIf4BIADbAgAhgAJAANACACGKAgIA3AIAIZICAQDPAgAhCd8BAACGAwAw4AEAAPABABDhAQAAhgMAMOIBAQDPAgAh4wEBAM8CACHlAUAA0AIAIZMCAQDPAgAhlAJAANACACGVAkAAhwMAIQsEAADoAgAgKQAAiQMAICoAAIkDACDmAUAAAAAB5wFAAAAABegBQAAAAAXpAUAAAAAB6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAAIgDACELBAAA6AIAICkAAIkDACAqAACJAwAg5gFAAAAAAecBQAAAAAXoAUAAAAAF6QFAAAAAAeoBQAAAAAHrAUAAAAAB7AFAAAAAAe0BQACIAwAhCOYBQAAAAAHnAUAAAAAF6AFAAAAABekBQAAAAAHqAUAAAAAB6wFAAAAAAewBQAAAAAHtAUAAiQMAIRPfAQAAigMAMOABAADaAQAQ4QEAAIoDADDiAQEAzwIAIeUBQADQAgAh-gEAAIsDnAIigAJAANACACGWAgEAzwIAIZcCAQDPAgAhmAIBANcCACGZAhAA_AIAIZoCAQDPAgAhnAIBANcCACGdAgEA1wIAIZ4CAQDXAgAhnwIBANcCACGgAkAAhwMAIaECAQDXAgAhogJAAIcDACEHBAAA0gIAICkAAI0DACAqAACNAwAg5gEAAACcAgLnAQAAAJwCCOgBAAAAnAII7QEAAIwDnAIiBwQAANICACApAACNAwAgKgAAjQMAIOYBAAAAnAIC5wEAAACcAgjoAQAAAJwCCO0BAACMA5wCIgTmAQAAAJwCAucBAAAAnAII6AEAAACcAgjtAQAAjQOcAiIL3wEAAI4DADDgAQAAxAEAEOEBAACOAwAw4gEBAM8CACHjAQEAzwIAIeUBQADQAgAhhAIBAM8CACGkAgAAjwOkAiKlAgEAzwIAIaYCAQDXAgAhpwIgANsCACEHBAAA0gIAICkAAJEDACAqAACRAwAg5gEAAACkAgLnAQAAAKQCCOgBAAAApAII7QEAAJADpAIiBwQAANICACApAACRAwAgKgAAkQMAIOYBAAAApAIC5wEAAACkAgjoAQAAAKQCCO0BAACQA6QCIgTmAQAAAKQCAucBAAAApAII6AEAAACkAgjtAQAAkQOkAiIL3wEAAJIDADDgAQAArgEAEOEBAACSAwAw4gEBAM8CACHlAUAA0AIAIfEBAQDPAgAh8gEBAM8CACGAAkAA0AIAIaUCAQDPAgAhqAIBAM8CACGpAiAA2wIAIQvfAQAAkwMAMOABAACbAQAQ4QEAAJMDADDiAQEA6wIAIeUBQADyAgAh8QEBAOsCACHyAQEA6wIAIYACQADyAgAhpQIBAOsCACGoAgEA6wIAIakCIADwAgAhCN8BAACUAwAw4AEAAJUBABDhAQAAlAMAMOIBAQDPAgAh5QFAANACACHxAQEAzwIAIYACQADQAgAhhQIBAM8CACEJAwAA8wIAIN8BAACVAwAw4AEAAIIBABDhAQAAlQMAMOIBAQDrAgAh5QFAAPICACHxAQEA6wIAIYACQADyAgAhhQIBAOsCACEM3wEAAJYDADDgAQAAfAAQ4QEAAJYDADDiAQEAzwIAIeMBAQDPAgAh5AEBAM8CACHlAUAA0AIAIfoBAACXA64CIoACQADQAgAhqgJAANACACGrAgIA3AIAIawCEAD8AgAhBwQAANICACApAACZAwAgKgAAmQMAIOYBAAAArgIC5wEAAACuAgjoAQAAAK4CCO0BAACYA64CIgcEAADSAgAgKQAAmQMAICoAAJkDACDmAQAAAK4CAucBAAAArgII6AEAAACuAgjtAQAAmAOuAiIE5gEAAACuAgLnAQAAAK4CCOgBAAAArgII7QEAAJkDrgIiDt8BAACaAwAw4AEAAGYAEOEBAACaAwAw4gEBAM8CACHlAUAA0AIAIfoBAACbA7ICIv4BIADbAgAhgAJAANACACGEAgEAzwIAIYUCAQDPAgAhrgIBAM8CACGvAgEAzwIAIbACAQDPAgAhsgIBAM8CACEHBAAA0gIAICkAAJ0DACAqAACdAwAg5gEAAACyAgLnAQAAALICCOgBAAAAsgII7QEAAJwDsgIiBwQAANICACApAACdAwAgKgAAnQMAIOYBAAAAsgIC5wEAAACyAgjoAQAAALICCO0BAACcA7ICIgTmAQAAALICAucBAAAAsgII6AEAAACyAgjtAQAAnQOyAiIL3wEAAJ4DADDgAQAAUAAQ4QEAAJ4DADDiAQEAzwIAIeMBAQDPAgAh5QFAANACACH-ASAA2wIAIYACQADQAgAhrwIBAM8CACGzAgEAzwIAIbQCAQDXAgAhCgcAAKEDACDfAQAAnwMAMOABAAArABDhAQAAnwMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIZMCAQDrAgAhlAJAAPICACGVAkAAoAMAIQjmAUAAAAAB5wFAAAAABegBQAAAAAXpAUAAAAAB6gFAAAAAAesBQAAAAAHsAUAAAAAB7QFAAIkDACEcAwAA8wIAIAsAAPQCACAMAAD1AgAgDgAA9gIAIA8AAPcCACAQAAD4AgAgEQAA-QIAIBIAAPoCACDfAQAA6gIAMOABAACiAgAQ4QEAAOoCADDiAQEA6wIAIeUBQADyAgAh8QEBAOsCACHyAQEA6wIAIfMBAQDsAgAh9AEBAOwCACH1AQEA7AIAIfYBAQDsAgAh-AEAAO0C-AEi-gEAAO4C-gEi_AEAAO8C_AEi_QEgAPACACH-ASAA8AIAIf8BAgDxAgAhgAJAAPICACG2AgAAogIAILcCAACiAgAgDwcAAKEDACAUAACjAwAgFQAApAMAIBYAAPkCACDfAQAAogMAMOABAAAoABDhAQAAogMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGvAgEA6wIAIbMCAQDrAgAhtAIBAOwCACESEQAA-QIAIBMAAKEDACDfAQAApwMAMOABAAAfABDhAQAApwMAMOIBAQDrAgAh5QFAAPICACH6AQAAqAOyAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIa4CAQDrAgAhrwIBAOsCACGwAgEA6wIAIbICAQDrAgAhtgIAAB8AILcCAAAfACARBwAAoQMAIBQAAKMDACAVAACkAwAgFgAA-QIAIN8BAACiAwAw4AEAACgAEOEBAACiAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAh_gEgAPACACGAAkAA8gIAIa8CAQDrAgAhswIBAOsCACG0AgEA7AIAIbYCAAAoACC3AgAAKAAgDAcAAKEDACDfAQAApQMAMOABAAAkABDhAQAApQMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIYQCAQDrAgAhpAIAAKYDpAIipQIBAOsCACGmAgEA7AIAIacCIADwAgAhBOYBAAAApAIC5wEAAACkAgjoAQAAAKQCCO0BAACRA6QCIhARAAD5AgAgEwAAoQMAIN8BAACnAwAw4AEAAB8AEOEBAACnAwAw4gEBAOsCACHlAUAA8gIAIfoBAACoA7ICIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhrgIBAOsCACGvAgEA6wIAIbACAQDrAgAhsgIBAOsCACEE5gEAAACyAgLnAQAAALICCOgBAAAAsgII7QEAAJ0DsgIiAuMBAQAAAAHkAQEAAAABCQcAAKEDACAIAACrAwAg3wEAAKoDADDgAQAAFgAQ4QEAAKoDADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIRkFAAC4AwAgBgAAoQMAIAsAAPQCACAMAAD1AgAgDQAA9wIAIN8BAAC1AwAw4AEAAAMAEOEBAAC1AwAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIbYCAAADACC3AgAAAwAgAuMBAQAAAAHkAQEAAAABDQcAAKEDACAIAACrAwAg3wEAAK0DADDgAQAAEgAQ4QEAAK0DADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhFAkAALEDACDfAQAArgMAMOABAAANABDhAQAArgMAMOIBAQDrAgAh5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAOsCACGYAgEA7AIAIZkCEACvAwAhmgIBAOsCACGcAgEA7AIAIZ0CAQDsAgAhngIBAOwCACGfAgEA7AIAIaACQACgAwAhoQIBAOwCACGiAkAAoAMAIQjmARAAAAAB5wEQAAAABOgBEAAAAATpARAAAAAB6gEQAAAAAesBEAAAAAHsARAAAAAB7QEQAIQDACEE5gEAAACcAgLnAQAAAJwCCOgBAAAAnAII7QEAAI0DnAIiEQcAAKEDACAIAACrAwAgCgAAtAMAIN8BAACyAwAw4AEAAAkAEOEBAACyAwAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH6AQAAswOuAiKAAkAA8gIAIaoCQADyAgAhqwICAPECACGsAhAArwMAIbYCAAAJACC3AgAACQAgDwcAAKEDACAIAACrAwAgCgAAtAMAIN8BAACyAwAw4AEAAAkAEOEBAACyAwAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH6AQAAswOuAiKAAkAA8gIAIaoCQADyAgAhqwICAPECACGsAhAArwMAIQTmAQAAAK4CAucBAAAArgII6AEAAACuAgjtAQAAmQOuAiIDgQIAAA0AIIICAAANACCDAgAADQAgFwUAALgDACAGAAChAwAgCwAA9AIAIAwAAPUCACANAAD3AgAg3wEAALUDADDgAQAAAwAQ4QEAALUDADDiAQEA6wIAIeUBQADyAgAh-gEAALcDjQIi_gEgAPACACGAAkAA8gIAIYQCAQDrAgAhhQIBAOsCACGGAgEA6wIAIYcCAQDrAgAhiAIQAK8DACGJAgIA8QIAIYoCCAC2AwAhiwIAAP4CACCNAgEA6wIAIY4CAQDrAgAhCOYBCAAAAAHnAQgAAAAE6AEIAAAABOkBCAAAAAHqAQgAAAAB6wEIAAAAAewBCAAAAAHtAQgA3gIAIQTmAQAAAI0CAucBAAAAjQII6AEAAACNAgjtAQAAgQONAiILAwAA8wIAIN8BAACVAwAw4AEAAIIBABDhAQAAlQMAMOIBAQDrAgAh5QFAAPICACHxAQEA6wIAIYACQADyAgAhhQIBAOsCACG2AgAAggEAILcCAACCAQAgAAAAAbsCAQAAAAEBuwJAAAAAAQUjAAC5BgAgJAAAvwYAILgCAAC6BgAguQIAAL4GACC-AgAAnwIAIAUjAAC3BgAgJAAAvAYAILgCAAC4BgAguQIAALsGACC-AgAABQAgAyMAALkGACC4AgAAugYAIL4CAACfAgAgAyMAALcGACC4AgAAuAYAIL4CAAAFACAAAAAAAAABuwIBAAAAAQG7AgAAAPgBAgG7AgAAAPoBAgG7AgAAAPwBAgG7AiAAAAABBbsCAgAAAAHCAgIAAAABwwICAAAAAcQCAgAAAAHFAgIAAAABCyMAAN4EADAkAADjBAAwuAIAAN8EADC5AgAA4AQAMLoCAADhBAAguwIAAOIEADC8AgAA4gQAML0CAADiBAAwvgIAAOIEADC_AgAA5AQAMMACAADlBAAwCyMAAL8EADAkAADEBAAwuAIAAMAEADC5AgAAwQQAMLoCAADCBAAguwIAAMMEADC8AgAAwwQAML0CAADDBAAwvgIAAMMEADC_AgAAxQQAMMACAADGBAAwCyMAALEEADAkAAC2BAAwuAIAALIEADC5AgAAswQAMLoCAAC0BAAguwIAALUEADC8AgAAtQQAML0CAAC1BAAwvgIAALUEADC_AgAAtwQAMMACAAC4BAAwCyMAAJkEADAkAACeBAAwuAIAAJoEADC5AgAAmwQAMLoCAACcBAAguwIAAJ0EADC8AgAAnQQAML0CAACdBAAwvgIAAJ0EADC_AgAAnwQAMMACAACgBAAwCyMAAI0EADAkAACSBAAwuAIAAI4EADC5AgAAjwQAMLoCAACQBAAguwIAAJEEADC8AgAAkQQAML0CAACRBAAwvgIAAJEEADC_AgAAkwQAMMACAACUBAAwCyMAAIAEADAkAACFBAAwuAIAAIEEADC5AgAAggQAMLoCAACDBAAguwIAAIQEADC8AgAAhAQAML0CAACEBAAwvgIAAIQEADC_AgAAhgQAMMACAACHBAAwCyMAAOMDADAkAADoAwAwuAIAAOQDADC5AgAA5QMAMLoCAADmAwAguwIAAOcDADC8AgAA5wMAML0CAADnAwAwvgIAAOcDADC_AgAA6QMAMMACAADqAwAwCyMAANYDADAkAADbAwAwuAIAANcDADC5AgAA2AMAMLoCAADZAwAguwIAANoDADC8AgAA2gMAML0CAADaAwAwvgIAANoDADC_AgAA3AMAMMACAADdAwAwBeIBAQAAAAHlAUAAAAABkwIBAAAAAZQCQAAAAAGVAkAAAAABAgAAAC0AICMAAOIDACADAAAALQAgIwAA4gMAICQAAOEDACABHAAAtgYAMAoHAAChAwAg3wEAAJ8DADDgAQAAKwAQ4QEAAJ8DADDiAQEAAAAB4wEBAOsCACHlAUAA8gIAIZMCAQAAAAGUAkAA8gIAIZUCQACgAwAhAgAAAC0AIBwAAOEDACACAAAA3gMAIBwAAN8DACAJ3wEAAN0DADDgAQAA3gMAEOEBAADdAwAw4gEBAOsCACHjAQEA6wIAIeUBQADyAgAhkwIBAOsCACGUAkAA8gIAIZUCQACgAwAhCd8BAADdAwAw4AEAAN4DABDhAQAA3QMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIZMCAQDrAgAhlAJAAPICACGVAkAAoAMAIQXiAQEAvAMAIeUBQAC9AwAhkwIBALwDACGUAkAAvQMAIZUCQADgAwAhAbsCQAAAAAEF4gEBALwDACHlAUAAvQMAIZMCAQC8AwAhlAJAAL0DACGVAkAA4AMAIQXiAQEAAAAB5QFAAAAAAZMCAQAAAAGUAkAAAAABlQJAAAAAAQoUAAD7AwAgFQAA_wMAIBYAAP0DACDiAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABrwIBAAAAAbMCAQAAAAG0AgEAAAABAgAAAAEAICMAAP4DACADAAAAAQAgIwAA_gMAICQAAO0DACABHAAAtQYAMA8HAAChAwAgFAAAowMAIBUAAKQDACAWAAD5AgAg3wEAAKIDADDgAQAAKAAQ4QEAAKIDADDiAQEAAAAB4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGvAgEA6wIAIbMCAQDrAgAhtAIBAOwCACECAAAAAQAgHAAA7QMAIAIAAADrAwAgHAAA7AMAIAvfAQAA6gMAMOABAADrAwAQ4QEAAOoDADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhrwIBAOsCACGzAgEA6wIAIbQCAQDsAgAhC98BAADqAwAw4AEAAOsDABDhAQAA6gMAMOIBAQDrAgAh4wEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGvAgEA6wIAIbMCAQDrAgAhtAIBAOwCACEH4gEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGvAgEAvAMAIbMCAQC8AwAhtAIBAMgDACEKFAAA7gMAIBUAAO8DACAWAADwAwAg4gEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGvAgEAvAMAIbMCAQC8AwAhtAIBAMgDACEFIwAAqQYAICQAALMGACC4AgAAqgYAILkCAACyBgAgvgIAACEAIAcjAAClBgAgJAAAsAYAILgCAACmBgAguQIAAK8GACC8AgAAKAAgvQIAACgAIL4CAAABACALIwAA8QMAMCQAAPUDADC4AgAA8gMAMLkCAADzAwAwugIAAPQDACC7AgAA5wMAMLwCAADnAwAwvQIAAOcDADC-AgAA5wMAML8CAAD2AwAwwAIAAOoDADAKBwAA_AMAIBQAAPsDACAWAAD9AwAg4gEBAAAAAeMBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGvAgEAAAABswIBAAAAAQIAAAABACAjAAD6AwAgAwAAAAEAICMAAPoDACAkAAD4AwAgARwAAK4GADACAAAAAQAgHAAA-AMAIAIAAADrAwAgHAAA9wMAIAfiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhrwIBALwDACGzAgEAvAMAIQoHAAD5AwAgFAAA7gMAIBYAAPADACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhrwIBALwDACGzAgEAvAMAIQUjAACnBgAgJAAArAYAILgCAACoBgAguQIAAKsGACC-AgAAnwIAIAoHAAD8AwAgFAAA-wMAIBYAAP0DACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAGzAgEAAAABAyMAAKkGACC4AgAAqgYAIL4CAAAhACADIwAApwYAILgCAACoBgAgvgIAAJ8CACAEIwAA8QMAMLgCAADyAwAwugIAAPQDACC-AgAA5wMAMAoUAAD7AwAgFQAA_wMAIBYAAP0DACDiAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABrwIBAAAAAbMCAQAAAAG0AgEAAAABAyMAAKUGACC4AgAApgYAIL4CAAABACAH4gEBAAAAAeUBQAAAAAGEAgEAAAABpAIAAACkAgKlAgEAAAABpgIBAAAAAacCIAAAAAECAAAAJgAgIwAAjAQAIAMAAAAmACAjAACMBAAgJAAAiwQAIAEcAACkBgAwDAcAAKEDACDfAQAApQMAMOABAAAkABDhAQAApQMAMOIBAQAAAAHjAQEA6wIAIeUBQADyAgAhhAIBAOsCACGkAgAApgOkAiKlAgEA6wIAIaYCAQDsAgAhpwIgAPACACECAAAAJgAgHAAAiwQAIAIAAACIBAAgHAAAiQQAIAvfAQAAhwQAMOABAACIBAAQ4QEAAIcEADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACGEAgEA6wIAIaQCAACmA6QCIqUCAQDrAgAhpgIBAOwCACGnAiAA8AIAIQvfAQAAhwQAMOABAACIBAAQ4QEAAIcEADDiAQEA6wIAIeMBAQDrAgAh5QFAAPICACGEAgEA6wIAIaQCAACmA6QCIqUCAQDrAgAhpgIBAOwCACGnAiAA8AIAIQfiAQEAvAMAIeUBQAC9AwAhhAIBALwDACGkAgAAigSkAiKlAgEAvAMAIaYCAQDIAwAhpwIgAMwDACEBuwIAAACkAgIH4gEBALwDACHlAUAAvQMAIYQCAQC8AwAhpAIAAIoEpAIipQIBALwDACGmAgEAyAMAIacCIADMAwAhB-IBAQAAAAHlAUAAAAABhAIBAAAAAaQCAAAApAICpQIBAAAAAaYCAQAAAAGnAiAAAAABBAgAAMEDACDiAQEAAAAB5AEBAAAAAeUBQAAAAAECAAAAGAAgIwAAmAQAIAMAAAAYACAjAACYBAAgJAAAlwQAIAEcAACjBgAwCgcAAKEDACAIAACrAwAg3wEAAKoDADDgAQAAFgAQ4QEAAKoDADDiAQEAAAAB4wEBAOsCACHkAQEA6wIAIeUBQADyAgAhtQIAAKkDACACAAAAGAAgHAAAlwQAIAIAAACVBAAgHAAAlgQAIAffAQAAlAQAMOABAACVBAAQ4QEAAJQEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIQffAQAAlAQAMOABAACVBAAQ4QEAAJQEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIQPiAQEAvAMAIeQBAQC8AwAh5QFAAL0DACEECAAAvwMAIOIBAQC8AwAh5AEBALwDACHlAUAAvQMAIQQIAADBAwAg4gEBAAAAAeQBAQAAAAHlAUAAAAABCxEAALAEACDiAQEAAAAB5QFAAAAAAfoBAAAAsgIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAa4CAQAAAAGvAgEAAAABsAIBAAAAAQIAAAAhACAjAACvBAAgAwAAACEAICMAAK8EACAkAACkBAAgARwAAKIGADAQEQAA-QIAIBMAAKEDACDfAQAApwMAMOABAAAfABDhAQAApwMAMOIBAQAAAAHlAUAA8gIAIfoBAACoA7ICIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQAAAAGuAgEA6wIAIa8CAQDrAgAhsAIBAOsCACGyAgEA6wIAIQIAAAAhACAcAACkBAAgAgAAAKEEACAcAACiBAAgDt8BAACgBAAw4AEAAKEEABDhAQAAoAQAMOIBAQDrAgAh5QFAAPICACH6AQAAqAOyAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIa4CAQDrAgAhrwIBAOsCACGwAgEA6wIAIbICAQDrAgAhDt8BAACgBAAw4AEAAKEEABDhAQAAoAQAMOIBAQDrAgAh5QFAAPICACH6AQAAqAOyAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIa4CAQDrAgAhrwIBAOsCACGwAgEA6wIAIbICAQDrAgAhCuIBAQC8AwAh5QFAAL0DACH6AQAAowSyAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIa4CAQC8AwAhrwIBALwDACGwAgEAvAMAIQG7AgAAALICAgsRAAClBAAg4gEBALwDACHlAUAAvQMAIfoBAACjBLICIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhrgIBALwDACGvAgEAvAMAIbACAQC8AwAhCyMAAKYEADAkAACqBAAwuAIAAKcEADC5AgAAqAQAMLoCAACpBAAguwIAAOcDADC8AgAA5wMAML0CAADnAwAwvgIAAOcDADC_AgAAqwQAMMACAADqAwAwCgcAAPwDACAVAAD_AwAgFgAA_QMAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABrwIBAAAAAbQCAQAAAAECAAAAAQAgIwAArgQAIAMAAAABACAjAACuBAAgJAAArQQAIAEcAAChBgAwAgAAAAEAIBwAAK0EACACAAAA6wMAIBwAAKwEACAH4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIa8CAQC8AwAhtAIBAMgDACEKBwAA-QMAIBUAAO8DACAWAADwAwAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIa8CAQC8AwAhtAIBAMgDACEKBwAA_AMAIBUAAP8DACAWAAD9AwAg4gEBAAAAAeMBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGvAgEAAAABtAIBAAAAAQsRAACwBAAg4gEBAAAAAeUBQAAAAAH6AQAAALICAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGuAgEAAAABrwIBAAAAAbACAQAAAAEEIwAApgQAMLgCAACnBAAwugIAAKkEACC-AgAA5wMAMAgIAAC-BAAg4gEBAAAAAeQBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQIAAAAUACAjAAC9BAAgAwAAABQAICMAAL0EACAkAAC7BAAgARwAAKAGADAOBwAAoQMAIAgAAKsDACDfAQAArQMAMOABAAASABDhAQAArQMAMOIBAQAAAAHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhigICAPECACGSAgEA6wIAIbUCAACsAwAgAgAAABQAIBwAALsEACACAAAAuQQAIBwAALoEACAL3wEAALgEADDgAQAAuQQAEOEBAAC4BAAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH-ASAA8AIAIYACQADyAgAhigICAPECACGSAgEA6wIAIQvfAQAAuAQAMOABAAC5BAAQ4QEAALgEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIf4BIADwAgAhgAJAAPICACGKAgIA8QIAIZICAQDrAgAhB-IBAQC8AwAh5AEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGKAgIAzQMAIZICAQC8AwAhCAgAALwEACDiAQEAvAMAIeQBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhigICAM0DACGSAgEAvAMAIQUjAACbBgAgJAAAngYAILgCAACcBgAguQIAAJ0GACC-AgAABQAgCAgAAL4EACDiAQEAAAAB5AEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAYoCAgAAAAGSAgEAAAABAyMAAJsGACC4AgAAnAYAIL4CAAAFACAKCAAA3AQAIAoAAN0EACDiAQEAAAAB5AEBAAAAAeUBQAAAAAH6AQAAAK4CAoACQAAAAAGqAkAAAAABqwICAAAAAawCEAAAAAECAAAACwAgIwAA2wQAIAMAAAALACAjAADbBAAgJAAAywQAIAEcAACaBgAwDwcAAKEDACAIAACrAwAgCgAAtAMAIN8BAACyAwAw4AEAAAkAEOEBAACyAwAw4gEBAAAAAeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA64CIoACQADyAgAhqgJAAPICACGrAgIA8QIAIawCEACvAwAhAgAAAAsAIBwAAMsEACACAAAAxwQAIBwAAMgEACAM3wEAAMYEADDgAQAAxwQAEOEBAADGBAAw4gEBAOsCACHjAQEA6wIAIeQBAQDrAgAh5QFAAPICACH6AQAAswOuAiKAAkAA8gIAIaoCQADyAgAhqwICAPECACGsAhAArwMAIQzfAQAAxgQAMOABAADHBAAQ4QEAAMYEADDiAQEA6wIAIeMBAQDrAgAh5AEBAOsCACHlAUAA8gIAIfoBAACzA64CIoACQADyAgAhqgJAAPICACGrAgIA8QIAIawCEACvAwAhCOIBAQC8AwAh5AEBALwDACHlAUAAvQMAIfoBAADKBK4CIoACQAC9AwAhqgJAAL0DACGrAgIAzQMAIawCEADJBAAhBbsCEAAAAAHCAhAAAAABwwIQAAAAAcQCEAAAAAHFAhAAAAABAbsCAAAArgICCggAAMwEACAKAADNBAAg4gEBALwDACHkAQEAvAMAIeUBQAC9AwAh-gEAAMoErgIigAJAAL0DACGqAkAAvQMAIasCAgDNAwAhrAIQAMkEACEFIwAAlAYAICQAAJgGACC4AgAAlQYAILkCAACXBgAgvgIAAAUAIAsjAADOBAAwJAAA0wQAMLgCAADPBAAwuQIAANAEADC6AgAA0QQAILsCAADSBAAwvAIAANIEADC9AgAA0gQAML4CAADSBAAwvwIAANQEADDAAgAA1QQAMA_iAQEAAAAB5QFAAAAAAfoBAAAAnAICgAJAAAAAAZcCAQAAAAGYAgEAAAABmQIQAAAAAZoCAQAAAAGcAgEAAAABnQIBAAAAAZ4CAQAAAAGfAgEAAAABoAJAAAAAAaECAQAAAAGiAkAAAAABAgAAAA8AICMAANoEACADAAAADwAgIwAA2gQAICQAANkEACABHAAAlgYAMBQJAACxAwAg3wEAAK4DADDgAQAADQAQ4QEAAK4DADDiAQEAAAAB5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAAAAAZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhAgAAAA8AIBwAANkEACACAAAA1gQAIBwAANcEACAT3wEAANUEADDgAQAA1gQAEOEBAADVBAAw4gEBAOsCACHlAUAA8gIAIfoBAACwA5wCIoACQADyAgAhlgIBAOsCACGXAgEA6wIAIZgCAQDsAgAhmQIQAK8DACGaAgEA6wIAIZwCAQDsAgAhnQIBAOwCACGeAgEA7AIAIZ8CAQDsAgAhoAJAAKADACGhAgEA7AIAIaICQACgAwAhE98BAADVBAAw4AEAANYEABDhAQAA1QQAMOIBAQDrAgAh5QFAAPICACH6AQAAsAOcAiKAAkAA8gIAIZYCAQDrAgAhlwIBAOsCACGYAgEA7AIAIZkCEACvAwAhmgIBAOsCACGcAgEA7AIAIZ0CAQDsAgAhngIBAOwCACGfAgEA7AIAIaACQACgAwAhoQIBAOwCACGiAkAAoAMAIQ_iAQEAvAMAIeUBQAC9AwAh-gEAANgEnAIigAJAAL0DACGXAgEAvAMAIZgCAQDIAwAhmQIQAMkEACGaAgEAvAMAIZwCAQDIAwAhnQIBAMgDACGeAgEAyAMAIZ8CAQDIAwAhoAJAAOADACGhAgEAyAMAIaICQADgAwAhAbsCAAAAnAICD-IBAQC8AwAh5QFAAL0DACH6AQAA2AScAiKAAkAAvQMAIZcCAQC8AwAhmAIBAMgDACGZAhAAyQQAIZoCAQC8AwAhnAIBAMgDACGdAgEAyAMAIZ4CAQDIAwAhnwIBAMgDACGgAkAA4AMAIaECAQDIAwAhogJAAOADACEP4gEBAAAAAeUBQAAAAAH6AQAAAJwCAoACQAAAAAGXAgEAAAABmAIBAAAAAZkCEAAAAAGaAgEAAAABnAIBAAAAAZ0CAQAAAAGeAgEAAAABnwIBAAAAAaACQAAAAAGhAgEAAAABogJAAAAAAQoIAADcBAAgCgAA3QQAIOIBAQAAAAHkAQEAAAAB5QFAAAAAAfoBAAAArgICgAJAAAAAAaoCQAAAAAGrAgIAAAABrAIQAAAAAQMjAACUBgAguAIAAJUGACC-AgAABQAgBCMAAM4EADC4AgAAzwQAMLoCAADRBAAgvgIAANIEADASBQAAkQUAIAsAAJIFACAMAACTBQAgDQAAlAUAIOIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII0CAQAAAAECAAAABQAgIwAAjwUAIAMAAAAFACAjAACPBQAgJAAA6wQAIAEcAACTBgAwFwUAALgDACAGAAChAwAgCwAA9AIAIAwAAPUCACANAAD3AgAg3wEAALUDADDgAQAAAwAQ4QEAALUDADDiAQEAAAAB5QFAAPICACH6AQAAtwONAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEAAAABhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIQIAAAAFACAcAADrBAAgAgAAAOYEACAcAADnBAAgEt8BAADlBAAw4AEAAOYEABDhAQAA5QQAMOIBAQDrAgAh5QFAAPICACH6AQAAtwONAiL-ASAA8AIAIYACQADyAgAhhAIBAOsCACGFAgEA6wIAIYYCAQDrAgAhhwIBAOsCACGIAhAArwMAIYkCAgDxAgAhigIIALYDACGLAgAA_gIAII0CAQDrAgAhjgIBAOsCACES3wEAAOUEADDgAQAA5gQAEOEBAADlBAAw4gEBAOsCACHlAUAA8gIAIfoBAAC3A40CIv4BIADwAgAhgAJAAPICACGEAgEA6wIAIYUCAQDrAgAhhgIBAOsCACGHAgEA6wIAIYgCEACvAwAhiQICAPECACGKAggAtgMAIYsCAAD-AgAgjQIBAOsCACGOAgEA6wIAIQ7iAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIQW7AggAAAABwgIIAAAAAcMCCAAAAAHEAggAAAABxQIIAAAAAQK7AgEAAAAEwQIBAAAABQG7AgAAAI0CAhIFAADsBAAgCwAA7QQAIAwAAO4EACANAADvBAAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACEFIwAAgQYAICQAAJEGACC4AgAAggYAILkCAACQBgAgvgIAAH8AIAsjAACEBQAwJAAAiAUAMLgCAACFBQAwuQIAAIYFADC6AgAAhwUAILsCAADDBAAwvAIAAMMEADC9AgAAwwQAML4CAADDBAAwvwIAAIkFADDAAgAAxgQAMAsjAAD5BAAwJAAA_QQAMLgCAAD6BAAwuQIAAPsEADC6AgAA_AQAILsCAAC1BAAwvAIAALUEADC9AgAAtQQAML4CAAC1BAAwvwIAAP4EADDAAgAAuAQAMAsjAADwBAAwJAAA9AQAMLgCAADxBAAwuQIAAPIEADC6AgAA8wQAILsCAACRBAAwvAIAAJEEADC9AgAAkQQAML4CAACRBAAwvwIAAPUEADDAAgAAlAQAMAQHAADAAwAg4gEBAAAAAeMBAQAAAAHlAUAAAAABAgAAABgAICMAAPgEACADAAAAGAAgIwAA-AQAICQAAPcEACABHAAAjwYAMAIAAAAYACAcAAD3BAAgAgAAAJUEACAcAAD2BAAgA-IBAQC8AwAh4wEBALwDACHlAUAAvQMAIQQHAAC-AwAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAhBAcAAMADACDiAQEAAAAB4wEBAAAAAeUBQAAAAAEIBwAAgwUAIOIBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABigICAAAAAZICAQAAAAECAAAAFAAgIwAAggUAIAMAAAAUACAjAACCBQAgJAAAgAUAIAEcAACOBgAwAgAAABQAIBwAAIAFACACAAAAuQQAIBwAAP8EACAH4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh_gEgAMwDACGAAkAAvQMAIYoCAgDNAwAhkgIBALwDACEIBwAAgQUAIOIBAQC8AwAh4wEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGKAgIAzQMAIZICAQC8AwAhBSMAAIkGACAkAACMBgAguAIAAIoGACC5AgAAiwYAIL4CAACfAgAgCAcAAIMFACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAYoCAgAAAAGSAgEAAAABAyMAAIkGACC4AgAAigYAIL4CAACfAgAgCgcAAI4FACAKAADdBAAg4gEBAAAAAeMBAQAAAAHlAUAAAAAB-gEAAACuAgKAAkAAAAABqgJAAAAAAasCAgAAAAGsAhAAAAABAgAAAAsAICMAAI0FACADAAAACwAgIwAAjQUAICQAAIsFACABHAAAiAYAMAIAAAALACAcAACLBQAgAgAAAMcEACAcAACKBQAgCOIBAQC8AwAh4wEBALwDACHlAUAAvQMAIfoBAADKBK4CIoACQAC9AwAhqgJAAL0DACGrAgIAzQMAIawCEADJBAAhCgcAAIwFACAKAADNBAAg4gEBALwDACHjAQEAvAMAIeUBQAC9AwAh-gEAAMoErgIigAJAAL0DACGqAkAAvQMAIasCAgDNAwAhrAIQAMkEACEFIwAAgwYAICQAAIYGACC4AgAAhAYAILkCAACFBgAgvgIAAJ8CACAKBwAAjgUAIAoAAN0EACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH6AQAAAK4CAoACQAAAAAGqAkAAAAABqwICAAAAAawCEAAAAAEDIwAAgwYAILgCAACEBgAgvgIAAJ8CACASBQAAkQUAIAsAAJIFACAMAACTBQAgDQAAlAUAIOIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII0CAQAAAAEBuwIBAAAABAMjAACBBgAguAIAAIIGACC-AgAAfwAgBCMAAIQFADC4AgAAhQUAMLoCAACHBQAgvgIAAMMEADAEIwAA-QQAMLgCAAD6BAAwugIAAPwEACC-AgAAtQQAMAQjAADwBAAwuAIAAPEEADC6AgAA8wQAIL4CAACRBAAwBCMAAN4EADC4AgAA3wQAMLoCAADhBAAgvgIAAOIEADAEIwAAvwQAMLgCAADABAAwugIAAMIEACC-AgAAwwQAMAQjAACxBAAwuAIAALIEADC6AgAAtAQAIL4CAAC1BAAwBCMAAJkEADC4AgAAmgQAMLoCAACcBAAgvgIAAJ0EADAEIwAAjQQAMLgCAACOBAAwugIAAJAEACC-AgAAkQQAMAQjAACABAAwuAIAAIEEADC6AgAAgwQAIL4CAACEBAAwBCMAAOMDADC4AgAA5AMAMLoCAADmAwAgvgIAAOcDADAEIwAA1gMAMLgCAADXAwAwugIAANkDACC-AgAA2gMAMAAAAAAAAAAAAAAAAAAFIwAA_AUAICQAAP8FACC4AgAA_QUAILkCAAD-BQAgvgIAAJ8CACADIwAA_AUAILgCAAD9BQAgvgIAAJ8CACAAAAAAAAAAAAUjAAD3BQAgJAAA-gUAILgCAAD4BQAguQIAAPkFACC-AgAAnwIAIAMjAAD3BQAguAIAAPgFACC-AgAAnwIAIAAAAAAABSMAAPIFACAkAAD1BQAguAIAAPMFACC5AgAA9AUAIL4CAAALACADIwAA8gUAILgCAADzBQAgvgIAAAsAIAAAAAUjAADtBQAgJAAA8AUAILgCAADuBQAguQIAAO8FACC-AgAAnwIAIAMjAADtBQAguAIAAO4FACC-AgAAnwIAIAAAAAAAAAsjAADJBQAwJAAAzQUAMLgCAADKBQAwuQIAAMsFADC6AgAAzAUAILsCAADiBAAwvAIAAOIEADC9AgAA4gQAML4CAADiBAAwvwIAAM4FADDAAgAA5QQAMBIGAACrBQAgCwAAkgUAIAwAAJMFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjgIBAAAAAQIAAAAFACAjAADRBQAgAwAAAAUAICMAANEFACAkAADQBQAgARwAAOwFADACAAAABQAgHAAA0AUAIAIAAADmBAAgHAAAzwUAIA7iAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCOAgEAvAMAIRIGAACqBQAgCwAA7QQAIAwAAO4EACANAADvBAAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjgIBALwDACESBgAAqwUAIAsAAJIFACAMAACTBQAgDQAAlAUAIOIBAQAAAAHlAUAAAAAB-gEAAACNAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABhgIBAAAAAYcCAQAAAAGIAhAAAAABiQICAAAAAYoCCAAAAAGLAgAAkAUAII4CAQAAAAEEIwAAyQUAMLgCAADKBQAwugIAAMwFACC-AgAA4gQAMAAAAAAAAAAABSMAAOcFACAkAADqBQAguAIAAOgFACC5AgAA6QUAIL4CAACfAgAgAyMAAOcFACC4AgAA6AUAIL4CAACfAgAgAAAADAMAAJ0FACALAACeBQAgDAAAnwUAIA4AAKAFACAPAAChBQAgEAAAogUAIBEAAKMFACASAACkBQAg8wEAAMIDACD0AQAAwgMAIPUBAADCAwAg9gEAAMIDACACEQAAowUAIBMAAOAFACAFBwAA4AUAIBQAAOEFACAVAADiBQAgFgAAowUAILQCAADCAwAgBQUAAOYFACAGAADgBQAgCwAAngUAIAwAAJ8FACANAAChBQAgAwcAAOAFACAIAADjBQAgCgAA5QUAIAABAwAAnQUAIBYDAACVBQAgCwAAlgUAIAwAAJcFACAPAACZBQAgEAAAmgUAIBEAAJsFACASAACcBQAg4gEBAAAAAeUBQAAAAAHxAQEAAAAB8gEBAAAAAfMBAQAAAAH0AQEAAAAB9QEBAAAAAfYBAQAAAAH4AQAAAPgBAvoBAAAA-gEC_AEAAAD8AQL9ASAAAAAB_gEgAAAAAf8BAgAAAAGAAkAAAAABAgAAAJ8CACAjAADnBQAgAwAAAKICACAjAADnBQAgJAAA6wUAIBgAAACiAgAgAwAAzgMAIAsAAM8DACAMAADQAwAgDwAA0gMAIBAAANMDACARAADUAwAgEgAA1QMAIBwAAOsFACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEWAwAAzgMAIAsAAM8DACAMAADQAwAgDwAA0gMAIBAAANMDACARAADUAwAgEgAA1QMAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIQ7iAQEAAAAB5QFAAAAAAfoBAAAAjQIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIQAAAAAYkCAgAAAAGKAggAAAABiwIAAJAFACCOAgEAAAABFgMAAJUFACALAACWBQAgDAAAlwUAIA4AAJgFACAPAACZBQAgEQAAmwUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAO0FACADAAAAogIAICMAAO0FACAkAADxBQAgGAAAAKICACADAADOAwAgCwAAzwMAIAwAANADACAOAADRAwAgDwAA0gMAIBEAANQDACASAADVAwAgHAAA8QUAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIRYDAADOAwAgCwAAzwMAIAwAANADACAOAADRAwAgDwAA0gMAIBEAANQDACASAADVAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhCwcAAI4FACAIAADcBAAg4gEBAAAAAeMBAQAAAAHkAQEAAAAB5QFAAAAAAfoBAAAArgICgAJAAAAAAaoCQAAAAAGrAgIAAAABrAIQAAAAAQIAAAALACAjAADyBQAgAwAAAAkAICMAAPIFACAkAAD2BQAgDQAAAAkAIAcAAIwFACAIAADMBAAgHAAA9gUAIOIBAQC8AwAh4wEBALwDACHkAQEAvAMAIeUBQAC9AwAh-gEAAMoErgIigAJAAL0DACGqAkAAvQMAIasCAgDNAwAhrAIQAMkEACELBwAAjAUAIAgAAMwEACDiAQEAvAMAIeMBAQC8AwAh5AEBALwDACHlAUAAvQMAIfoBAADKBK4CIoACQAC9AwAhqgJAAL0DACGrAgIAzQMAIawCEADJBAAhFgMAAJUFACALAACWBQAgDAAAlwUAIA4AAJgFACAPAACZBQAgEAAAmgUAIBEAAJsFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAPcFACADAAAAogIAICMAAPcFACAkAAD7BQAgGAAAAKICACADAADOAwAgCwAAzwMAIAwAANADACAOAADRAwAgDwAA0gMAIBAAANMDACARAADUAwAgHAAA-wUAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIRYDAADOAwAgCwAAzwMAIAwAANADACAOAADRAwAgDwAA0gMAIBAAANMDACARAADUAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgsAAJYFACAMAACXBQAgDgAAmAUAIA8AAJkFACAQAACaBQAgEQAAmwUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAPwFACADAAAAogIAICMAAPwFACAkAACABgAgGAAAAKICACALAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAgHAAAgAYAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIRYLAADPAwAgDAAA0AMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhBeIBAQAAAAHlAUAAAAAB8QEBAAAAAYACQAAAAAGFAgEAAAABAgAAAH8AICMAAIEGACAWAwAAlQUAIAwAAJcFACAOAACYBQAgDwAAmQUAIBAAAJoFACARAACbBQAgEgAAnAUAIOIBAQAAAAHlAUAAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB-AEAAAD4AQL6AQAAAPoBAvwBAAAA_AEC_QEgAAAAAf4BIAAAAAH_AQIAAAABgAJAAAAAAQIAAACfAgAgIwAAgwYAIAMAAACiAgAgIwAAgwYAICQAAIcGACAYAAAAogIAIAMAAM4DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACAcAACHBgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEI4gEBAAAAAeMBAQAAAAHlAUAAAAAB-gEAAACuAgKAAkAAAAABqgJAAAAAAasCAgAAAAGsAhAAAAABFgMAAJUFACALAACWBQAgDgAAmAUAIA8AAJkFACAQAACaBQAgEQAAmwUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAIkGACADAAAAogIAICMAAIkGACAkAACNBgAgGAAAAKICACADAADOAwAgCwAAzwMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAgHAAAjQYAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIRYDAADOAwAgCwAAzwMAIA4AANEDACAPAADSAwAgEAAA0wMAIBEAANQDACASAADVAwAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhB-IBAQAAAAHjAQEAAAAB5QFAAAAAAf4BIAAAAAGAAkAAAAABigICAAAAAZICAQAAAAED4gEBAAAAAeMBAQAAAAHlAUAAAAABAwAAAIIBACAjAACBBgAgJAAAkgYAIAcAAACCAQAgHAAAkgYAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIYACQAC9AwAhhQIBALwDACEF4gEBALwDACHlAUAAvQMAIfEBAQC8AwAhgAJAAL0DACGFAgEAvAMAIQ7iAQEAAAAB5QFAAAAAAfoBAAAAjQIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIQAAAAAYkCAgAAAAGKAggAAAABiwIAAJAFACCNAgEAAAABEwUAAJEFACAGAACrBQAgDAAAkwUAIA0AAJQFACDiAQEAAAAB5QFAAAAAAfoBAAAAjQIC_gEgAAAAAYACQAAAAAGEAgEAAAABhQIBAAAAAYYCAQAAAAGHAgEAAAABiAIQAAAAAYkCAgAAAAGKAggAAAABiwIAAJAFACCNAgEAAAABjgIBAAAAAQIAAAAFACAjAACUBgAgD-IBAQAAAAHlAUAAAAAB-gEAAACcAgKAAkAAAAABlwIBAAAAAZgCAQAAAAGZAhAAAAABmgIBAAAAAZwCAQAAAAGdAgEAAAABngIBAAAAAZ8CAQAAAAGgAkAAAAABoQIBAAAAAaICQAAAAAEDAAAAAwAgIwAAlAYAICQAAJkGACAVAAAAAwAgBQAA7AQAIAYAAKoFACAMAADuBAAgDQAA7wQAIBwAAJkGACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIY4CAQC8AwAhEwUAAOwEACAGAACqBQAgDAAA7gQAIA0AAO8EACDiAQEAvAMAIeUBQAC9AwAh-gEAAOoEjQIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGGAgEAvAMAIYcCAQC8AwAhiAIQAMkEACGJAgIAzQMAIYoCCADoBAAhiwIAAOkEACCNAgEAvAMAIY4CAQC8AwAhCOIBAQAAAAHkAQEAAAAB5QFAAAAAAfoBAAAArgICgAJAAAAAAaoCQAAAAAGrAgIAAAABrAIQAAAAARMFAACRBQAgBgAAqwUAIAsAAJIFACANAACUBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAECAAAABQAgIwAAmwYAIAMAAAADACAjAACbBgAgJAAAnwYAIBUAAAADACAFAADsBAAgBgAAqgUAIAsAAO0EACANAADvBAAgHAAAnwYAIOIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhjgIBALwDACETBQAA7AQAIAYAAKoFACALAADtBAAgDQAA7wQAIOIBAQC8AwAh5QFAAL0DACH6AQAA6gSNAiL-ASAAzAMAIYACQAC9AwAhhAIBALwDACGFAgEAvAMAIYYCAQC8AwAhhwIBALwDACGIAhAAyQQAIYkCAgDNAwAhigIIAOgEACGLAgAA6QQAII0CAQC8AwAhjgIBALwDACEH4gEBAAAAAeQBAQAAAAHlAUAAAAAB_gEgAAAAAYACQAAAAAGKAgIAAAABkgIBAAAAAQfiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAG0AgEAAAABCuIBAQAAAAHlAUAAAAAB-gEAAACyAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABrgIBAAAAAa8CAQAAAAGwAgEAAAABA-IBAQAAAAHkAQEAAAAB5QFAAAAAAQfiAQEAAAAB5QFAAAAAAYQCAQAAAAGkAgAAAKQCAqUCAQAAAAGmAgEAAAABpwIgAAAAAQsHAAD8AwAgFAAA-wMAIBUAAP8DACDiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAGzAgEAAAABtAIBAAAAAQIAAAABACAjAAClBgAgFgMAAJUFACALAACWBQAgDAAAlwUAIA4AAJgFACAPAACZBQAgEAAAmgUAIBIAAJwFACDiAQEAAAAB5QFAAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfgBAAAA-AEC-gEAAAD6AQL8AQAAAPwBAv0BIAAAAAH-ASAAAAAB_wECAAAAAYACQAAAAAECAAAAnwIAICMAAKcGACAMEwAA3AUAIOIBAQAAAAHlAUAAAAAB-gEAAACyAgL-ASAAAAABgAJAAAAAAYQCAQAAAAGFAgEAAAABrgIBAAAAAa8CAQAAAAGwAgEAAAABsgIBAAAAAQIAAAAhACAjAACpBgAgAwAAAKICACAjAACnBgAgJAAArQYAIBgAAACiAgAgAwAAzgMAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEgAA1QMAIBwAAK0GACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEWAwAAzgMAIAsAAM8DACAMAADQAwAgDgAA0QMAIA8AANIDACAQAADTAwAgEgAA1QMAIOIBAQC8AwAh5QFAAL0DACHxAQEAvAMAIfIBAQC8AwAh8wEBAMgDACH0AQEAyAMAIfUBAQDIAwAh9gEBAMgDACH4AQAAyQP4ASL6AQAAygP6ASL8AQAAywP8ASL9ASAAzAMAIf4BIADMAwAh_wECAM0DACGAAkAAvQMAIQfiAQEAAAAB4wEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAGzAgEAAAABAwAAACgAICMAAKUGACAkAACxBgAgDQAAACgAIAcAAPkDACAUAADuAwAgFQAA7wMAIBwAALEGACDiAQEAvAMAIeMBAQC8AwAh5QFAAL0DACH-ASAAzAMAIYACQAC9AwAhrwIBALwDACGzAgEAvAMAIbQCAQDIAwAhCwcAAPkDACAUAADuAwAgFQAA7wMAIOIBAQC8AwAh4wEBALwDACHlAUAAvQMAIf4BIADMAwAhgAJAAL0DACGvAgEAvAMAIbMCAQC8AwAhtAIBAMgDACEDAAAAHwAgIwAAqQYAICQAALQGACAOAAAAHwAgEwAA2wUAIBwAALQGACDiAQEAvAMAIeUBQAC9AwAh-gEAAKMEsgIi_gEgAMwDACGAAkAAvQMAIYQCAQC8AwAhhQIBALwDACGuAgEAvAMAIa8CAQC8AwAhsAIBALwDACGyAgEAvAMAIQwTAADbBQAg4gEBALwDACHlAUAAvQMAIfoBAACjBLICIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhrgIBALwDACGvAgEAvAMAIbACAQC8AwAhsgIBALwDACEH4gEBAAAAAeUBQAAAAAH-ASAAAAABgAJAAAAAAa8CAQAAAAGzAgEAAAABtAIBAAAAAQXiAQEAAAAB5QFAAAAAAZMCAQAAAAGUAkAAAAABlQJAAAAAARMFAACRBQAgBgAAqwUAIAsAAJIFACAMAACTBQAg4gEBAAAAAeUBQAAAAAH6AQAAAI0CAv4BIAAAAAGAAkAAAAABhAIBAAAAAYUCAQAAAAGGAgEAAAABhwIBAAAAAYgCEAAAAAGJAgIAAAABigIIAAAAAYsCAACQBQAgjQIBAAAAAY4CAQAAAAECAAAABQAgIwAAtwYAIBYDAACVBQAgCwAAlgUAIAwAAJcFACAOAACYBQAgEAAAmgUAIBEAAJsFACASAACcBQAg4gEBAAAAAeUBQAAAAAHxAQEAAAAB8gEBAAAAAfMBAQAAAAH0AQEAAAAB9QEBAAAAAfYBAQAAAAH4AQAAAPgBAvoBAAAA-gEC_AEAAAD8AQL9ASAAAAAB_gEgAAAAAf8BAgAAAAGAAkAAAAABAgAAAJ8CACAjAAC5BgAgAwAAAAMAICMAALcGACAkAAC9BgAgFQAAAAMAIAUAAOwEACAGAACqBQAgCwAA7QQAIAwAAO4EACAcAAC9BgAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIRMFAADsBAAgBgAAqgUAIAsAAO0EACAMAADuBAAg4gEBALwDACHlAUAAvQMAIfoBAADqBI0CIv4BIADMAwAhgAJAAL0DACGEAgEAvAMAIYUCAQC8AwAhhgIBALwDACGHAgEAvAMAIYgCEADJBAAhiQICAM0DACGKAggA6AQAIYsCAADpBAAgjQIBALwDACGOAgEAvAMAIQMAAACiAgAgIwAAuQYAICQAAMAGACAYAAAAogIAIAMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAQAADTAwAgEQAA1AMAIBIAANUDACAcAADABgAg4gEBALwDACHlAUAAvQMAIfEBAQC8AwAh8gEBALwDACHzAQEAyAMAIfQBAQDIAwAh9QEBAMgDACH2AQEAyAMAIfgBAADJA_gBIvoBAADKA_oBIvwBAADLA_wBIv0BIADMAwAh_gEgAMwDACH_AQIAzQMAIYACQAC9AwAhFgMAAM4DACALAADPAwAgDAAA0AMAIA4AANEDACAQAADTAwAgEQAA1AMAIBIAANUDACDiAQEAvAMAIeUBQAC9AwAh8QEBALwDACHyAQEAvAMAIfMBAQDIAwAh9AEBAMgDACH1AQEAyAMAIfYBAQDIAwAh-AEAAMkD-AEi-gEAAMoD-gEi_AEAAMsD_AEi_QEgAMwDACH-ASAAzAMAIf8BAgDNAwAhgAJAAL0DACEFBAARBwADFAACFTkBFjoBAwQAEBE3ARMAAwkDBgQEAA8LHQcMHgoOIgIPIwsQJw0RKgESLg4GBAAMBQAFBgADCwwHDBUKDRkLAgMHBAQABgEDCAAEBAAJBwADCAAEChAIAQkABwEKEQACBwADCAAEAgcAAwgABAMLGgAMGwANHAABBwADAQcAAwgDLwALMAAMMQAOMgAPMwAQNAARNQASNgABETgAARY7AAADBwADFAACFUUBAwcAAxQAAhVLAQMEABYpABcqABgAAAADBAAWKQAXKgAYARMAAwETAAMDBAAdKQAeKgAfAAAAAwQAHSkAHioAHwIHAAMIAAQCBwADCAAEBQQAJCkAJyoAKEsAJUwAJgAAAAAABQQAJCkAJyoAKEsAJUwAJgAAAwQALSkALioALwAAAAMEAC0pAC4qAC8AAAADBAA1KQA2KgA3AAAAAwQANSkANioANwEHAAMBBwADAwQAPCkAPSoAPgAAAAMEADwpAD0qAD4BCQAHAQkABwUEAEMpAEYqAEdLAERMAEUAAAAAAAUEAEMpAEYqAEdLAERMAEUBBwADAQcAAwMEAEwpAE0qAE4AAAADBABMKQBNKgBOAgcAAwgABAIHAAMIAAQFBABTKQBWKgBXSwBUTABVAAAAAAAFBABTKQBWKgBXSwBUTABVAgUABQYAAwIFAAUGAAMFBABcKQBfKgBgSwBdTABeAAAAAAAFBABcKQBfKgBgSwBdTABeAAAFBABlKQBoKgBpSwBmTABnAAAAAAAFBABlKQBoKgBpSwBmTABnAgcAAwgABAIHAAMIAAQDBABuKQBvKgBwAAAAAwQAbikAbyoAcBcCARg8ARk9ARo-ARs_AR1BAR5DEh9EEyBHASFJEiJKFCVMASZNASdOEitRFSxSGS1TAi5UAi9VAjBWAjFXAjJZAjNbEjRcGjVeAjZgEjdhGzhiAjljAjpkEjtnHDxoID1pBz5qBz9rB0BsB0FtB0JvB0NxEkRyIUV0B0Z2Ekd3Ikh4B0l5B0p6Ek19I05-KU-AAQVQgQEFUYQBBVKFAQVThgEFVIgBBVWKARJWiwEqV40BBViPARJZkAErWpEBBVuSAQVckwESXZYBLF6XATBfmQExYJoBMWGdATFingExY58BMWShATFlowESZqQBMmemATFoqAESaakBM2qqATFrqwExbKwBEm2vATRusAE4b7EBDXCyAQ1xswENcrQBDXO1AQ10twENdbkBEna6ATl3vAENeL4BEnm_ATp6wAENe8EBDXzCARJ9xQE7fsYBP3_HAQiAAcgBCIEByQEIggHKAQiDAcsBCIQBzQEIhQHPARKGAdABQIcB0gEIiAHUARKJAdUBQYoB1gEIiwHXAQiMAdgBEo0B2wFCjgHcAUiPAd0BDpAB3gEOkQHfAQ6SAeABDpMB4QEOlAHjAQ6VAeUBEpYB5gFJlwHoAQ6YAeoBEpkB6wFKmgHsAQ6bAe0BDpwB7gESnQHxAUueAfIBT58B8wEKoAH0AQqhAfUBCqIB9gEKowH3AQqkAfkBCqUB-wESpgH8AVCnAf4BCqgBgAISqQGBAlGqAYICCqsBgwIKrAGEAhKtAYcCUq4BiAJYrwGJAgSwAYoCBLEBiwIEsgGMAgSzAY0CBLQBjwIEtQGRAhK2AZICWbcBlAIEuAGWAhK5AZcCWroBmAIEuwGZAgS8AZoCEr0BnQJbvgGeAmG_AaACA8ABoQIDwQGkAgPCAaUCA8MBpgIDxAGoAgPFAaoCEsYBqwJixwGtAgPIAa8CEskBsAJjygGxAgPLAbICA8wBswISzQG2AmTOAbcCas8BuAIL0AG5AgvRAboCC9IBuwIL0wG8AgvUAb4CC9UBwAIS1gHBAmvXAcMCC9gBxQIS2QHGAmzaAccCC9sByAIL3AHJAhLdAcwCbd4BzQJx"
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FwcC50cyIsICIuLi9zcmMvY29uZmlnL2luZGV4LnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL25vdEZvdW5kLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudC50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2ludGVybmFsL2NsYXNzLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXMudHMiLCAiLi4vc3JjL3V0aWxzL2FwcEVycm9yLnRzIiwgIi4uL3NyYy9saWIvcHJpc21hLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguc2VydmljZS50cyIsICIuLi9zcmMvbGliL2dvb2dsZUF1dGgudHMiLCAiLi4vc3JjL2xpYi9yZWRpcy50cyIsICIuLi9zcmMvdXRpbHMvand0LnRzIiwgIi4uL3NyYy9saWIvbm9kZW1haWxlci50cyIsICIuLi9zcmMvdGVtcGxhdGVzL2luZGV4LnRzIiwgIi4uL3NyYy91dGlscy9hdXRoRW1haWwudHMiLCAiLi4vc3JjL3V0aWxzL2NhdGNoQXN5bmMudHMiLCAiLi4vc3JjL3V0aWxzL3NlbmRSZXNwb25zZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGgudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3QudHMiLCAiLi4vc3JjL21pZGRsZXdhcmUvYXV0aC50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvdXNlci91c2VyLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9saWIvY2xvdWRpbmFyeS50cyIsICIuLi9zcmMvbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jb250YWN0L2NvbnRhY3Qucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL2VtYWlsLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbGliL3NzbGNvbW1lcnoudHMiLCAiLi4vc3JjL3V0aWxzL25vdGlmaWNhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcmV2aWV3L3Jldmlldy52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL3NsdWdpZnkudHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2Uuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nQ29tbWVudC5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jsb2cvYmxvZ0NvbW1lbnQuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2dDb21tZW50LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3Qucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3dpc2hsaXN0L3dpc2hsaXN0LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ub3RpZmljYXRpb24vbm90aWZpY2F0aW9uLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL25vdGlmaWNhdGlvbi9ub3RpZmljYXRpb24udmFsaWRhdGlvbi50cyIsICJpbmRleC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IGV4cHJlc3MsIHsgQXBwbGljYXRpb24sIE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xyXG5pbXBvcnQgY29ycyBmcm9tIFwiY29yc1wiO1xyXG5pbXBvcnQgY29va2llUGFyc2VyIGZyb20gXCJjb29raWUtcGFyc2VyXCI7XHJcbmltcG9ydCBoZWxtZXQgZnJvbSBcImhlbG1ldFwiO1xyXG5pbXBvcnQgbW9yZ2FuIGZyb20gXCJtb3JnYW5cIjtcclxuaW1wb3J0IHJhdGVMaW1pdCBmcm9tIFwiZXhwcmVzcy1yYXRlLWxpbWl0XCI7XHJcbmltcG9ydCBjb25maWcgZnJvbSBcIi4vY29uZmlnXCI7XHJcbmltcG9ydCBub3RGb3VuZEhhbmRsZXIgZnJvbSBcIi4vbWlkZGxld2FyZS9ub3RGb3VuZFwiO1xyXG5pbXBvcnQgZ2xvYmFsRXJyb3JIYW5kbGVyIGZyb20gXCIuL21pZGRsZXdhcmUvZ2xvYmFsRXJyb3JIYW5kbGVyXCI7XHJcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuL2xpYi9wcmlzbWFcIjtcclxuaW1wb3J0IHsgYXV0aFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYXV0aC9hdXRoLnJvdXRlXCI7XHJcbmltcG9ydCB7IHVzZXJSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZVwiO1xyXG5pbXBvcnQgeyB1cGxvYWRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBjb250YWN0Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9jb250YWN0L2NvbnRhY3Qucm91dGVcIjtcclxuaW1wb3J0IHsgYm9va2luZ1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlXCI7XHJcbmltcG9ydCB7IHJldmlld1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcmV2aWV3L3Jldmlldy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBjYXRlZ29yeVJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkucm91dGVcIjtcclxuaW1wb3J0IHsgcGFja2FnZVJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGFja2FnZS9wYWNrYWdlLnJvdXRlXCI7XHJcbmltcG9ydCB7IGJsb2dSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Jsb2cvYmxvZy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBkYXNoYm9hcmRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQucm91dGVcIjtcclxuaW1wb3J0IHsgcGF5bWVudFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnJvdXRlXCI7XHJcbmltcG9ydCB7IHdpc2hsaXN0Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBub3RpZmljYXRpb25Sb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL25vdGlmaWNhdGlvbi9ub3RpZmljYXRpb24ucm91dGVcIjtcclxuXHJcbmNvbnN0IGFwcDogQXBwbGljYXRpb24gPSBleHByZXNzKCk7XHJcblxyXG4vLyBSZW5kZXIvUmFpbHdheSBzaXQgYmVoaW5kIGEgcmV2ZXJzZSBwcm94eSBcdTIwMTQgbXVzdCBiZSBzZXQgYmVmb3JlIHRoZVxyXG4vLyByYXRlIGxpbWl0ZXIgb3IgaXQgd2lsbCBzZWUgdGhlIHByb3h5J3MgSVAgZm9yIGV2ZXJ5IHJlcXVlc3QgYW5kXHJcbi8vIGVmZmVjdGl2ZWx5IHJhdGUtbGltaXQgYWxsIHVzZXJzIHRvZ2V0aGVyLlxyXG5hcHAuc2V0KFwidHJ1c3QgcHJveHlcIiwgMSk7XHJcblxyXG5hcHAudXNlKGhlbG1ldCgpKTtcclxuXHJcbmFwcC51c2UoXHJcbiAgY29ycyh7XHJcbiAgICAvLyBEZXYgaG9zdCAobG9jYWxob3N0KSArIHByb2QgaG9zdCAoVmVyY2VsKSBib3RoIGFsbG93ZWQgc2lkZS1ieS1zaWRlLlxyXG4gICAgLy8gQ29uZmlnIHJlc29sdmVzIHNlbnNpYmxlIGRlZmF1bHRzIHNvIG5laXRoZXIgY2FuIGJlIGZhbHN5LlxyXG4gICAgb3JpZ2luOiBbY29uZmlnLmZyb250ZW5kX3VybF9kZXYsIGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZF0uZmlsdGVyKFxyXG4gICAgICAobyk6IG8gaXMgc3RyaW5nID0+IEJvb2xlYW4obyksXHJcbiAgICApLFxyXG4gICAgY3JlZGVudGlhbHM6IHRydWUsXHJcbiAgfSksXHJcbik7XHJcblxyXG5pZiAoY29uZmlnLm5vZGVfZW52ICE9PSBcInByb2R1Y3Rpb25cIikge1xyXG4gIGFwcC51c2UobW9yZ2FuKFwiZGV2XCIpKTtcclxufVxyXG5cclxuYXBwLnVzZShleHByZXNzLmpzb24oeyBsaW1pdDogXCIxMDBrYlwiIH0pKTtcclxuYXBwLnVzZShleHByZXNzLnVybGVuY29kZWQoeyBleHRlbmRlZDogdHJ1ZSwgbGltaXQ6IFwiMTAwa2JcIiB9KSk7XHJcbmFwcC51c2UoY29va2llUGFyc2VyKCkpO1xyXG5cclxuLy8gU3RyaWN0IGxpbWl0ZXIgXHUyMDE0IGF1dGggZW5kcG9pbnRzLCBicnV0ZS1mb3JjZSBwcm90ZWN0aW9uXHJcbmNvbnN0IGF1dGhMaW1pdGVyID0gcmF0ZUxpbWl0KHtcclxuICB3aW5kb3dNczogMTUgKiA2MCAqIDEwMDAsXHJcbiAgbGltaXQ6IDUsXHJcbiAgc3RhbmRhcmRIZWFkZXJzOiB0cnVlLFxyXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxyXG4gIG1lc3NhZ2U6IHtcclxuICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSBhdHRlbXB0cy4gUGxlYXNlIHRyeSBhZ2FpbiBpbiAxNSBtaW51dGVzLlwiLFxyXG4gIH0sXHJcbn0pO1xyXG5cclxuLy8gU3RhbmRhcmQgbGltaXRlciBcdTIwMTQgZXZlcnl0aGluZyBlbHNlIHVuZGVyIC9hcGlcclxuY29uc3QgYXBpTGltaXRlciA9IHJhdGVMaW1pdCh7XHJcbiAgd2luZG93TXM6IDE1ICogNjAgKiAxMDAwLFxyXG4gIGxpbWl0OiAxMDAsXHJcbiAgc3RhbmRhcmRIZWFkZXJzOiB0cnVlLFxyXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxyXG4gIG1lc3NhZ2U6IHtcclxuICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSByZXF1ZXN0cy4gUGxlYXNlIHRyeSBhZ2FpbiBsYXRlci5cIixcclxuICB9LFxyXG59KTtcclxuXHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvbG9naW5cIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL3JlZ2lzdGVyXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9kZW1vLWxvZ2luXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9nb29nbGVcIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL3ZlcmlmeS1lbWFpbFwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvcmVzZW5kLXZlcmlmaWNhdGlvblwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvZm9yZ290LXBhc3N3b3JkXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9yZXNldC1wYXNzd29yZFwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpXCIsIGFwaUxpbWl0ZXIpO1xyXG5cclxuLy8gUm9vdCByb3V0ZVxyXG5hcHAuZ2V0KFwiL1wiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgcmVzLnNlbmQoXCJXZWxjb21lIHRvIHRoZSBUcmlwVmVyc2UgQVBJIVwiKTtcclxufSk7XHJcblxyXG4vLyBIZWFsdGggY2hlY2sgXHUyMDE0IHJlYWwgREIgY29ubmVjdGl2aXR5IGNoZWNrLCBub3QgYSBzdGF0aWMgMjAwLlxyXG5hcHAuZ2V0KFwiL2hlYWx0aFwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUIDFgO1xyXG4gICAgcmVzLnN0YXR1cygyMDApLmpzb24oe1xyXG4gICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICBtZXNzYWdlOiBcIk9LXCIsXHJcbiAgICAgIGRiOiBcImNvbm5lY3RlZFwiLFxyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgIH0pO1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICByZXMuc3RhdHVzKDUwMykuanNvbih7XHJcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICBtZXNzYWdlOiBcIlNlcnZpY2UgdW5hdmFpbGFibGVcIixcclxuICAgICAgZGI6IFwiZGlzY29ubmVjdGVkXCIsXHJcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59KTtcclxuXHJcbi8vIFx1MjUwMFx1MjUwMCBGZWF0dXJlIHJvdXRlcyByZWdpc3RlciBoZXJlIGFzIGVhY2ggbW9kdWxlIGlzIGJ1aWx0IFx1MjUwMFx1MjUwMFxyXG5hcHAudXNlKFwiL2FwaS9hdXRoXCIsIGF1dGhSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS91c2Vyc1wiLCB1c2VyUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvdXBsb2Fkc1wiLCB1cGxvYWRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jb250YWN0XCIsIGNvbnRhY3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jYXRlZ29yaWVzXCIsIGNhdGVnb3J5Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvcGFja2FnZXNcIiwgcGFja2FnZVJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3Jldmlld3NcIiwgcmV2aWV3Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvYm9va2luZ3NcIiwgYm9va2luZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Jsb2dcIiwgYmxvZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Rhc2hib2FyZFwiLCBkYXNoYm9hcmRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9wYXltZW50c1wiLCBwYXltZW50Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvd2lzaGxpc3RcIiwgd2lzaGxpc3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9ub3RpZmljYXRpb25zXCIsIG5vdGlmaWNhdGlvblJvdXRlcyk7XHJcblxyXG5hcHAudXNlKG5vdEZvdW5kSGFuZGxlcik7XHJcbmFwcC51c2UoZ2xvYmFsRXJyb3JIYW5kbGVyKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGFwcDtcclxuIiwgImltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmRvdGVudi5jb25maWcoe1xuICBxdWlldDogdHJ1ZSxcbiAgcGF0aDogcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwiLmVudlwiKSxcbn0pO1xuXG4vLyBFdmVyeSBtb2R1bGUgcmVhZHMgY29uZmlnIHRocm91Z2ggdGhpcyB2YWxpZGF0ZWQgb2JqZWN0LCBuZXZlclxuLy8gcHJvY2Vzcy5lbnYgZGlyZWN0bHkgXHUyMDE0IGEgbWlzc2luZy9tYWxmb3JtZWQgdmFyIGZhaWxzIGxvdWRseSBhdCBib290XG4vLyBpbnN0ZWFkIG9mIHN1cmZhY2luZyBhcyBhIGNvbmZ1c2luZyBydW50aW1lIGVycm9yIG1pZC1yZXF1ZXN0LlxuY29uc3QgZW52U2NoZW1hID0gei5vYmplY3Qoe1xuICBQT1JUOiB6LnN0cmluZygpLmRlZmF1bHQoXCI0MDAwXCIpLFxuICBOT0RFX0VOVjogei5lbnVtKFtcImRldmVsb3BtZW50XCIsIFwicHJvZHVjdGlvblwiXSkuZGVmYXVsdChcImRldmVsb3BtZW50XCIpLFxuXG4gIC8vIEZyb250ZW5kIG9yaWdpbnMgZm9yIENPUlMgKyBwYXltZW50IHJlZGlyZWN0cy4gVGhlIGZyb250ZW5kIG1heSBub3QgYmVcbiAgLy8gZGVwbG95ZWQgeWV0IChvciBtYXkgYmUgcmVidWlsdCksIHNvIGJvdGggYXJlIG9wdGlvbmFsOiB0aGUgYmFja2VuZCBtdXN0XG4gIC8vIG5ldmVyIHJlZnVzZSB0byBib290IGp1c3QgYmVjYXVzZSBhIFVJIGhvc3QgaXNuJ3QgbGl2ZS4gUm91dGVzIHRoYXQgbmVlZCBhXG4gIC8vIHJlYWwgb3JpZ2luIChwYXltZW50IGNhbGxiYWNrIHJlZGlyZWN0cykgZmFsbCBiYWNrIHRvIHRoZSBiYWNrZW5kIFVSTC5cbiAgRlJPTlRFTkRfVVJMX0RFVjogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBGUk9OVEVORF9VUkxfUFJPRDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuXG4gIERBVEFCQVNFX1VSTDogei5zdHJpbmcoKS5taW4oMSwgXCJEQVRBQkFTRV9VUkwgaXMgcmVxdWlyZWRcIiksXG5cbiAgQkNSWVBUX1NBTFRfUk9VTkRTOiB6LnN0cmluZygpLmRlZmF1bHQoXCIxMFwiKSxcblxuICAvLyBPcHRpb25hbCBhZG1pbiBjcmVkZW50aWFscyB1c2VkIGJ5IHRoZSBzZWVkIHNjcmlwdCAoU3RlcCAxMykuIEZhbGxzIGJhY2tcbiAgLy8gdG8gZGVtby1hZG1pbkB0cmlwdmVyc2UuY29tIC8gZGVtbzEyMyB3aGVuIHVuc2V0LlxuICBBRE1JTl9FTUFJTDogei5zdHJpbmcoKS5lbWFpbCgpLm9wdGlvbmFsKCksXG4gIEFETUlOX1BBU1NXT1JEOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxuXG4gIC8vIFNTTENvbW1lcnogKFN0ZXAgMTYpIFx1MjAxNCBzYW5kYm94IHN0b3JlIGNyZWRzIHVudGlsIGdvLWxpdmUuIFNTTF9DT01NRVJaX1NBTkRCT1hcbiAgLy8gcGlja3MgdGhlIHNhbmRib3ggdnMgbGl2ZSBBUEkgYmFzZSBVUkwuIE9wdGlvbmFsIHNvIHRoZSBBUEkgYm9vdHMgKGhlYWx0aCxcbiAgLy8gYXV0aCwgY2F0YWxvZywgZXRjLikgZXZlbiB3aGVuIHRoZSBwYXltZW50IHN0b3JlIGlzbid0IGNvbmZpZ3VyZWQgeWV0IFx1MjAxNCB0aGVcbiAgLy8gcGF5bWVudCBlbmRwb2ludHMgdGhlbiBmYWlsIHdpdGggYSBjbGVhbiBcIm5vdCBjb25maWd1cmVkXCIgZXJyb3IgaW5zdGVhZCBvZlxuICAvLyB0YWtpbmcgdGhlIHdob2xlIGRlcGxveW1lbnQgZG93bi5cbiAgU1NMX0NPTU1FUlpfU1RPUkVfSUQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU1NMX0NPTU1FUlpfU0FOREJPWDogei5zdHJpbmcoKS5kZWZhdWx0KFwidHJ1ZVwiKSxcbiAgLy8gT3B0aW9uYWwgZXhwbGljaXQgZ2F0ZXdheS92YWxpZGF0b3IgYmFzZSBVUkxzIChHZWFyVXAgcGF0dGVybikuIERlZmF1bHRzIGFyZVxuICAvLyBkZXJpdmVkIGZyb20gU1NMX0NPTU1FUlpfU0FOREJPWCB3aGVuIGFic2VudC5cbiAgU1NMQ09NTUVSWl9JTklUX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBTU0xDT01NRVJaX1ZBTElEQVRFX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBTU0xDT01NRVJaX1JFRlVORF9VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICAvLyBQdWJsaWNseSByZWFjaGFibGUgYmFzZSBVUkwgdGhlIHBheW1lbnQgbW9kdWxlIHVzZXMgdG8gYnVpbGQgdGhlXG4gIC8vIFNTTENvbW1lcnogc3VjY2Vzcy9mYWlsL2NhbmNlbC9JUE4gY2FsbGJhY2sgVVJMcy4gTXVzdCBOT1QgYmUgbG9jYWxob3N0IGluXG4gIC8vIHNhbmRib3ggXHUyMDE0IHRoZSBnYXRld2F5IFBPU1RzIHRvIHRoZXNlIHNlcnZlci10by1zZXJ2ZXIuIE9wdGlvbmFsIGxpa2UgdGhlXG4gIC8vIHN0b3JlIGNyZWRzIGFib3ZlIChwYXltZW50LW9ubHkpLlxuICBCQUNLRU5EX1BVQkxJQ19VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICBKV1RfQUNDRVNTX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJKV1RfQUNDRVNTX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX1JFRlJFU0hfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkpXVF9SRUZSRVNIX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX0FDQ0VTU19FWFBJUkVTX0lOOiB6LnN0cmluZygpLmRlZmF1bHQoXCIxZFwiKSxcbiAgSldUX1JFRlJFU0hfRVhQSVJFU19JTjogei5zdHJpbmcoKS5kZWZhdWx0KFwiMzBkXCIpLFxuXG4gIC8vIEdvb2dsZSBPQXV0aCBpcyBvcHRpb25hbCBcdTIwMTQgc2VydmVyIGJvb3RzIHdpdGhvdXQgaXQ7IC9hcGkvYXV0aC9nb29nbGVcbiAgLy8gcmV0dXJucyBhIGNsZWFuIDQwMCB1bnRpbCBHT09HTEVfQ0xJRU5UX0lEIGlzIGNvbmZpZ3VyZWQuXG4gIEdPT0dMRV9DTElFTlRfSUQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcblxuICAvLyBCZXN0LWVmZm9ydCBjb250YWN0IGVtYWlscyAoUmVzZW5kKSBcdTIwMTQgYWx3YXlzIG9wdGlvbmFsOyBzdWJtaXNzaW9uc1xuICAvLyBzdWNjZWVkIGFuZCBlbWFpbHMgYmVjb21lIG5vLW9wcyB3aGVuIHRoZXNlIGFyZSBtaXNzaW5nLlxuICBSRVNFTkRfQVBJX0tFWTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBDT05UQUNUX1JFQ0VJVkVSX0VNQUlMOiB6LnN0cmluZygpLmVtYWlsKCkub3B0aW9uYWwoKSxcbiAgRU1BSUxfRlJPTTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIC8vIEVtYWlsIHZlcmlmaWNhdGlvbiArIHBhc3N3b3JkIHJlc2V0IChTdGVwIDIxKSBcdTIwMTQgUmVkaXMgT1RQIHN0b3JlICsgTm9kZW1haWxlci5cbiAgLy8gQWxsIG9wdGlvbmFsIHNvIHRoZSBhcHAgYm9vdHMgd2l0aG91dCB0aGVtIChlLmcuIFZlcmNlbCBwcm9kKTsgdGhlIGF1dGhcbiAgLy8gZW5kcG9pbnRzIHRoZW4gcmVzcG9uZCB3aXRoIGEgY2xlYW4gNTAzIFwibm90IGNvbmZpZ3VyZWRcIiBpbnN0ZWFkIG9mIGNyYXNoaW5nLlxuICBSRURJU19VU0VSOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFJFRElTX1BBU1NXT1JEOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIFJFRElTX0hPU1Q6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgUkVESVNfUE9SVDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTTVRQX1VTRVI6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU01UUF9QQVNTV09SRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIENMT1VESU5BUllfQ0xPVURfTkFNRTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0NMT1VEX05BTUUgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX0tFWTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9LRVkgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9TRUNSRVQgaXMgcmVxdWlyZWRcIiksXG59KTtcblxuY29uc3QgcGFyc2VkID0gZW52U2NoZW1hLnNhZmVQYXJzZShwcm9jZXNzLmVudik7XG5cbmlmICghcGFyc2VkLnN1Y2Nlc3MpIHtcbiAgY29uc29sZS5lcnJvcihcIlx1Mjc0QyBJbnZhbGlkIGVudmlyb25tZW50IHZhcmlhYmxlczpcIik7XG4gIGNvbnNvbGUuZXJyb3IocGFyc2VkLmVycm9yLmZsYXR0ZW4oKS5maWVsZEVycm9ycyk7XG4gIHByb2Nlc3MuZXhpdCgxKTtcbn1cblxuY29uc3QgZW52ID0gcGFyc2VkLmRhdGE7XG5cbmNvbnN0IGNvbmZpZyA9IHtcbiAgcG9ydDogZW52LlBPUlQsXG4gIG5vZGVfZW52OiBlbnYuTk9ERV9FTlYsXG5cbiAgLy8gRnJvbnRlbmQgb3JpZ2lucyBmb3IgQ09SUyArIHBheW1lbnQgcmVkaXJlY3RzLiBMb2NhbGhvc3QgYWx3YXlzIHdpbnMgZm9yXG4gIC8vIGxvY2FsIHRlc3Rpbmc7IHByb2R1Y3Rpb24gdXNlcyB0aGUgVmVyY2VsIGZyb250ZW5kIFVSTCwgZmFsbGluZyBiYWNrIHRvIHRoZVxuICAvLyBiYWNrZW5kIFVSTCBzbyB0aGUgQVBJIHN0YXlzIHJlYWNoYWJsZSBldmVuIGJlZm9yZSB0aGUgVUkgaXMgZGVwbG95ZWQuXG4gIGZyb250ZW5kX3VybF9kZXY6IGVudi5GUk9OVEVORF9VUkxfREVWIHx8IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gIGZyb250ZW5kX3VybF9wcm9kOlxuICAgIGVudi5GUk9OVEVORF9VUkxfUFJPRCB8fCBlbnYuQkFDS0VORF9QVUJMSUNfVVJMIHx8IFwiXCIsXG5cbiAgZGF0YWJhc2VfdXJsOiBlbnYuREFUQUJBU0VfVVJMLFxuXG4gIGJjcnlwdF9zYWx0X3JvdW5kczogZW52LkJDUllQVF9TQUxUX1JPVU5EUyxcblxuICBhZG1pbl9lbWFpbDogZW52LkFETUlOX0VNQUlMLFxuICBhZG1pbl9wYXNzd29yZDogZW52LkFETUlOX1BBU1NXT1JELFxuXG4gIHNzbF9jb21tZXJ6X3N0b3JlX2lkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfSUQsXG4gIHNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQsXG4gIHNzbF9jb21tZXJ6X3NhbmRib3g6IGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIixcbiAgLy8gc2FuZGJveCBiYXNlIFVSTHMgKGZhbGxiYWNrIHdoZW4gdGhlIGV4cGxpY2l0IG92ZXJyaWRlIHZhcnMgYXJlIGFic2VudClcbiAgc3NsY29tbWVyel9pbml0X3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9JTklUX1VSTCA/P1xuICAgIChlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCJcbiAgICAgID8gXCJodHRwczovL3NhbmRib3guc3NsY29tbWVyei5jb20vZ3dwcm9jZXNzL3Y0L2FwaS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL2d3cHJvY2Vzcy92NC9hcGkucGhwXCIpLFxuICBzc2xjb21tZXJ6X3ZhbGlkYXRlX3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9WQUxJREFURV9VUkwgPz9cbiAgICAoZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiXG4gICAgICA/IFwiaHR0cHM6Ly9zYW5kYm94LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIiksXG4gIHNzbGNvbW1lcnpfcmVmdW5kX3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9SRUZVTkRfVVJMID8/XG4gICAgKGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIlxuICAgICAgPyBcImh0dHBzOi8vc2FuZGJveC5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL21lcmNoYW50VHJhbnNJRHZhbGlkYXRpb25BUEkucGhwXCJcbiAgICAgIDogXCJodHRwczovL3NlY3VyZXBheS5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL21lcmNoYW50VHJhbnNJRHZhbGlkYXRpb25BUEkucGhwXCIpLFxuICBiYWNrZW5kX3B1YmxpY191cmw6IGVudi5CQUNLRU5EX1BVQkxJQ19VUkwsXG5cbiAgand0X2FjY2Vzc19zZWNyZXQ6IGVudi5KV1RfQUNDRVNTX1NFQ1JFVCxcbiAgand0X3JlZnJlc2hfc2VjcmV0OiBlbnYuSldUX1JFRlJFU0hfU0VDUkVULFxuICBqd3RfYWNjZXNzX2V4cGlyZXNfaW46IGVudi5KV1RfQUNDRVNTX0VYUElSRVNfSU4sXG4gIGp3dF9yZWZyZXNoX2V4cGlyZXNfaW46IGVudi5KV1RfUkVGUkVTSF9FWFBJUkVTX0lOLFxuXG4gIGdvb2dsZV9jbGllbnRfaWQ6IGVudi5HT09HTEVfQ0xJRU5UX0lELFxuXG4gIHJlc2VuZF9hcGlfa2V5OiBlbnYuUkVTRU5EX0FQSV9LRVksXG4gIGNvbnRhY3RfcmVjZWl2ZXJfZW1haWw6IGVudi5DT05UQUNUX1JFQ0VJVkVSX0VNQUlMLFxuICBlbWFpbF9mcm9tOiBlbnYuRU1BSUxfRlJPTSxcblxuICAvLyBFbWFpbCB2ZXJpZmljYXRpb24gKyBwYXNzd29yZCByZXNldCAoU3RlcCAyMSlcbiAgcmVkaXNfdXNlcjogZW52LlJFRElTX1VTRVIsXG4gIHJlZGlzX3Bhc3N3b3JkOiBlbnYuUkVESVNfUEFTU1dPUkQsXG4gIHJlZGlzX2hvc3Q6IGVudi5SRURJU19IT1NULFxuICByZWRpc19wb3J0OiBlbnYuUkVESVNfUE9SVCxcbiAgc210cF91c2VyOiBlbnYuU01UUF9VU0VSLFxuICBzbXRwX3Bhc3N3b3JkOiBlbnYuU01UUF9QQVNTV09SRCxcblxuICBjbG91ZGluYXJ5X2Nsb3VkX25hbWU6IGVudi5DTE9VRElOQVJZX0NMT1VEX05BTUUsXG4gIGNsb3VkaW5hcnlfYXBpX2tleTogZW52LkNMT1VESU5BUllfQVBJX0tFWSxcbiAgY2xvdWRpbmFyeV9hcGlfc2VjcmV0OiBlbnYuQ0xPVURJTkFSWV9BUElfU0VDUkVULFxufTtcblxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgImltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuY29uc3Qgbm90Rm91bmRIYW5kbGVyID0gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkgPT4ge1xuICByZXMuc3RhdHVzKDQwNCkuanNvbih7XG4gICAgc3VjY2VzczogZmFsc2UsXG4gICAgc3RhdHVzQ29kZTogNDA0LFxuICAgIG1lc3NhZ2U6IFwiUm91dGUgbm90IGZvdW5kXCIsXG4gICAgcGF0aDogcmVxLm9yaWdpbmFsVXJsLFxuICAgIGRhdGU6IG5ldyBEYXRlKCksXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgbm90Rm91bmRIYW5kbGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgbXVsdGVyIGZyb20gXCJtdWx0ZXJcIjtcbmltcG9ydCB7IFpvZEVycm9yIH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbmNvbnN0IGdsb2JhbEVycm9ySGFuZGxlciA9IChcbiAgZXJyOiBhbnksXG4gIHJlcTogUmVxdWVzdCxcbiAgcmVzOiBSZXNwb25zZSxcbiAgbmV4dDogTmV4dEZ1bmN0aW9uLFxuKSA9PiB7XG4gIGlmIChjb25maWcubm9kZV9lbnYgIT09IFwicHJvZHVjdGlvblwiKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yOlwiLCBlcnIpO1xuICB9XG5cbiAgLy8gZGVmYXVsdCBmYWxsYmFja1xuICBsZXQgc3RhdHVzQ29kZTogbnVtYmVyID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gIGxldCBlcnJvck1lc3NhZ2U6IHN0cmluZyA9IGVycj8ubWVzc2FnZSB8fCBcIkludGVybmFsIFNlcnZlciBFcnJvclwiO1xuICBsZXQgZXJyb3JOYW1lOiBzdHJpbmcgPSBlcnI/Lm5hbWUgfHwgXCJFcnJvclwiO1xuXG4gIC8vIFpvZCB2YWxpZGF0aW9uIGVycm9yXG4gIGlmIChlcnIgaW5zdGFuY2VvZiBab2RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5pc3N1ZXMubWFwKChpKSA9PiBpLm1lc3NhZ2UpLmpvaW4oXCIsIFwiKTtcbiAgICBlcnJvck5hbWUgPSBcIlpvZEVycm9yXCI7XG4gIH1cblxuICAvLyBNdWx0ZXIgZmlsZSB1cGxvYWQgZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgbXVsdGVyLk11bHRlckVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JOYW1lID0gXCJNdWx0ZXJFcnJvclwiO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBlcnIuY29kZSA9PT0gXCJMSU1JVF9GSUxFX1NJWkVcIlxuICAgICAgICA/IFwiRmlsZSB0b28gbGFyZ2UuIE1heGltdW0gc2l6ZSBpcyA1TUIuXCJcbiAgICAgICAgOiBgVXBsb2FkIGZhaWxlZDogJHtlcnIuY29kZX1gO1xuICB9XG5cbiAgLy8gQ3VzdG9tIGZpbGUgdHlwZSByZWplY3Rpb24gZnJvbSB0aGUgbXVsdGVyIGZpbGVGaWx0ZXJcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgKGVyciBhcyBhbnkpLmNvZGUgPT09IFwiSU5WQUxJRF9GSUxFX1RZUEVcIikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICB9XG5cbiAgLy8gUHJpc21hIHZhbGlkYXRpb24gZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBcIllvdSBoYXZlIHByb3ZpZGVkIGluY29ycmVjdCBmaWVsZCB0eXBlIG9yIG1pc3NpbmcgcmVxdWlyZWQgZmllbGRzXCI7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3JcIjtcbiAgfVxuXG4gIC8vIFByaXNtYSBrbm93biBlcnJvcnNcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yKSB7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclwiO1xuXG4gICAgaWYgKGVyci5jb2RlID09PSBcIlAyMDAyXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkNPTkZMSUNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJUaGlzIHZhbHVlIGFscmVhZHkgZXhpc3RzXCI7XG4gICAgfSBlbHNlIGlmIChlcnIuY29kZSA9PT0gXCJQMjAwM1wiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5DT05GTElDVDtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiRm9yZWlnbiBrZXkgY29uc3RyYWludCBmYWlsZWRcIjtcbiAgICB9IGVsc2UgaWYgKGVyci5jb2RlID09PSBcIlAyMDI1XCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLk5PVF9GT1VORDtcbiAgICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICAgIFwiQW4gb3BlcmF0aW9uIGZhaWxlZCBiZWNhdXNlIG9uZSBvciBtb3JlIHJlcXVpcmVkIHJlY29yZHMgd2VyZSBub3QgZm91bmQuXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIERCIGNvbm5lY3Rpb24vaW5pdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvcikge1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclwiO1xuXG4gICAgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDBcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuVU5BVVRIT1JJWkVEO1xuICAgICAgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgXCJBdXRoZW50aWNhdGlvbiBmYWlsZWQgYWdhaW5zdCB0aGUgZGF0YWJhc2Ugc2VydmVyLiBQbGVhc2UgY2hlY2sgeW91ciBkYXRhYmFzZSBjcmVkZW50aWFscy5cIjtcbiAgICB9IGVsc2UgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDFcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuU0VSVklDRV9VTkFWQUlMQUJMRTtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiQ2FuJ3QgcmVhY2ggdGhlIGRhdGFiYXNlIHNlcnZlci5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIHVua25vd24gcmVxdWVzdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3JcIjtcbiAgICBlcnJvck1lc3NhZ2UgPSBcIkVycm9yIG9jY3VycmVkIGR1cmluZyBxdWVyeSBleGVjdXRpb25cIjtcbiAgfVxuXG4gIC8vIFlvdXIgY3VzdG9tIEFwcEVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEFwcEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGVyci5zdGF0dXNDb2RlO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIGVycm9yTmFtZSA9IGVyci5uYW1lIHx8IFwiQXBwRXJyb3JcIjtcbiAgfVxuXG4gIC8vIEZhbGxiYWNrIGZvciBvdGhlciB0aHJvd24gZXJyb3JzXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCI7XG4gICAgZXJyb3JOYW1lID0gZXJyLm5hbWUgfHwgXCJFcnJvclwiO1xuICB9XG5cbiAgcmVzLnN0YXR1cyhzdGF0dXNDb2RlKS5qc29uKHtcbiAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICBzdGF0dXNDb2RlLFxuICAgIG5hbWU6IGVycm9yTmFtZSxcbiAgICBtZXNzYWdlOiBlcnJvck1lc3NhZ2UsXG4gICAgZXJyb3I6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcImRldmVsb3BtZW50XCIgPyBlcnIuc3RhY2sgOiB1bmRlZmluZWQsXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZ2xvYmFsRXJyb3JIYW5kbGVyO1xuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogVGhpcyBmaWxlIHNob3VsZCBiZSB5b3VyIG1haW4gaW1wb3J0IHRvIHVzZSBQcmlzbWEuIFRocm91Z2ggaXQgeW91IGdldCBhY2Nlc3MgdG8gYWxsIHRoZSBtb2RlbHMsIGVudW1zLCBhbmQgaW5wdXQgdHlwZXMuXG4gKiBJZiB5b3UncmUgbG9va2luZyBmb3Igc29tZXRoaW5nIHlvdSBjYW4gaW1wb3J0IGluIHRoZSBjbGllbnQtc2lkZSBvZiB5b3VyIGFwcGxpY2F0aW9uLCBwbGVhc2UgcmVmZXIgdG8gdGhlIGBicm93c2VyLnRzYCBmaWxlIGluc3RlYWQuXG4gKlxuICogXHVEODNEXHVERkUyIFlvdSBjYW4gaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseS5cbiAqL1xuXG5pbXBvcnQgKiBhcyBwcm9jZXNzIGZyb20gJ25vZGU6cHJvY2VzcydcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJ1xuZ2xvYmFsVGhpc1snX19kaXJuYW1lJ10gPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKVxuXG5pbXBvcnQgKiBhcyBydW50aW1lIGZyb20gXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL2NsaWVudFwiXG5pbXBvcnQgKiBhcyAkRW51bXMgZnJvbSBcIi4vZW51bXNcIlxuaW1wb3J0ICogYXMgJENsYXNzIGZyb20gXCIuL2ludGVybmFsL2NsYXNzXCJcbmltcG9ydCAqIGFzIFByaXNtYSBmcm9tIFwiLi9pbnRlcm5hbC9wcmlzbWFOYW1lc3BhY2VcIlxuXG5leHBvcnQgKiBhcyAkRW51bXMgZnJvbSAnLi9lbnVtcydcbmV4cG9ydCAqIGZyb20gXCIuL2VudW1zXCJcbi8qKlxuICogIyMgUHJpc21hIENsaWVudFxuICogXG4gKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gKiB9KVxuICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dDb21tZW50c1xuICogY29uc3QgYmxvZ0NvbW1lbnRzID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KClcbiAqIGBgYFxuICogXG4gKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICovXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50ID0gJENsYXNzLmdldFByaXNtYUNsaWVudENsYXNzKClcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudDxMb2dPcHRzIGV4dGVuZHMgUHJpc21hLkxvZ0xldmVsID0gbmV2ZXIsIE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdLCBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncz4gPSAkQ2xhc3MuUHJpc21hQ2xpZW50PExvZ09wdHMsIE9taXRPcHRzLCBFeHRBcmdzPlxuZXhwb3J0IHsgUHJpc21hIH1cblxuLyoqXG4gKiBNb2RlbCBCbG9nQ29tbWVudFxuICogXG4gKi9cbmV4cG9ydCB0eXBlIEJsb2dDb21tZW50ID0gUHJpc21hLkJsb2dDb21tZW50TW9kZWxcbi8qKlxuICogTW9kZWwgQmxvZ1Bvc3RcbiAqIFxuICovXG5leHBvcnQgdHlwZSBCbG9nUG9zdCA9IFByaXNtYS5CbG9nUG9zdE1vZGVsXG4vKipcbiAqIE1vZGVsIEJvb2tpbmdcbiAqIFxuICovXG5leHBvcnQgdHlwZSBCb29raW5nID0gUHJpc21hLkJvb2tpbmdNb2RlbFxuLyoqXG4gKiBNb2RlbCBDYXRlZ29yeVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIENhdGVnb3J5ID0gUHJpc21hLkNhdGVnb3J5TW9kZWxcbi8qKlxuICogTW9kZWwgQ29udGFjdE1lc3NhZ2VcbiAqIFxuICovXG5leHBvcnQgdHlwZSBDb250YWN0TWVzc2FnZSA9IFByaXNtYS5Db250YWN0TWVzc2FnZU1vZGVsXG4vKipcbiAqIE1vZGVsIE5vdGlmaWNhdGlvblxuICogXG4gKi9cbmV4cG9ydCB0eXBlIE5vdGlmaWNhdGlvbiA9IFByaXNtYS5Ob3RpZmljYXRpb25Nb2RlbFxuLyoqXG4gKiBNb2RlbCBQYXltZW50XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUGF5bWVudCA9IFByaXNtYS5QYXltZW50TW9kZWxcbi8qKlxuICogTW9kZWwgUmVmcmVzaFRva2VuXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUmVmcmVzaFRva2VuID0gUHJpc21hLlJlZnJlc2hUb2tlbk1vZGVsXG4vKipcbiAqIE1vZGVsIFJldmlld1xuICogXG4gKi9cbmV4cG9ydCB0eXBlIFJldmlldyA9IFByaXNtYS5SZXZpZXdNb2RlbFxuLyoqXG4gKiBNb2RlbCBUb3VyUGFja2FnZVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFRvdXJQYWNrYWdlID0gUHJpc21hLlRvdXJQYWNrYWdlTW9kZWxcbi8qKlxuICogTW9kZWwgVXNlclxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFVzZXIgPSBQcmlzbWEuVXNlck1vZGVsXG4vKipcbiAqIE1vZGVsIFdpc2hsaXN0SXRlbVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIFdpc2hsaXN0SXRlbSA9IFByaXNtYS5XaXNobGlzdEl0ZW1Nb2RlbFxuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogV0FSTklORzogVGhpcyBpcyBhbiBpbnRlcm5hbCBmaWxlIHRoYXQgaXMgc3ViamVjdCB0byBjaGFuZ2UhXG4gKlxuICogXHVEODNEXHVERUQxIFVuZGVyIG5vIGNpcmN1bXN0YW5jZXMgc2hvdWxkIHlvdSBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5ISBcdUQ4M0RcdURFRDFcbiAqXG4gKiBQbGVhc2UgaW1wb3J0IHRoZSBgUHJpc21hQ2xpZW50YCBjbGFzcyBmcm9tIHRoZSBgY2xpZW50LnRzYCBmaWxlIGluc3RlYWQuXG4gKi9cblxuaW1wb3J0ICogYXMgcnVudGltZSBmcm9tIFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9jbGllbnRcIlxuaW1wb3J0IHR5cGUgKiBhcyBQcmlzbWEgZnJvbSBcIi4vcHJpc21hTmFtZXNwYWNlXCJcblxuXG5jb25zdCBjb25maWc6IHJ1bnRpbWUuR2V0UHJpc21hQ2xpZW50Q29uZmlnID0ge1xuICBcInByZXZpZXdGZWF0dXJlc1wiOiBbXSxcbiAgXCJjbGllbnRWZXJzaW9uXCI6IFwiNy45LjFcIixcbiAgXCJlbmdpbmVWZXJzaW9uXCI6IFwiZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFwiLFxuICBcImFjdGl2ZVByb3ZpZGVyXCI6IFwicG9zdGdyZXNxbFwiLFxuICBcImlubGluZVNjaGVtYVwiOiBcIm1vZGVsIEJsb2dDb21tZW50IHtcXG4gIGlkICAgICAgICBTdHJpbmcgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBjb250ZW50ICAgU3RyaW5nICBAZGIuVGV4dFxcbiAgaXNEZWxldGVkIEJvb2xlYW4gQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBwb3N0SWQgICBTdHJpbmdcXG4gIHVzZXJJZCAgIFN0cmluZ1xcbiAgcGFyZW50SWQgU3RyaW5nP1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBvc3QgICAgQmxvZ1Bvc3QgICAgICBAcmVsYXRpb24oXFxcIlBvc3RDb21tZW50c1xcXCIsIGZpZWxkczogW3Bvc3RJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICB1c2VyICAgIFVzZXIgICAgICAgICAgQHJlbGF0aW9uKFxcXCJVc2VyQ29tbWVudHNcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFyZW50ICBCbG9nQ29tbWVudD8gIEByZWxhdGlvbihcXFwiQ29tbWVudFJlcGxpZXNcXFwiLCBmaWVsZHM6IFtwYXJlbnRJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICByZXBsaWVzIEJsb2dDb21tZW50W10gQHJlbGF0aW9uKFxcXCJDb21tZW50UmVwbGllc1xcXCIpXFxuXFxuICBAQGluZGV4KFtwb3N0SWQsIGlzRGVsZXRlZCwgY3JlYXRlZEF0XSlcXG4gIEBAaW5kZXgoW3BhcmVudElkXSlcXG4gIEBAbWFwKFxcXCJibG9nX2NvbW1lbnRzXFxcIilcXG59XFxuXFxubW9kZWwgQmxvZ1Bvc3Qge1xcbiAgaWQgICAgICAgICBTdHJpbmcgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0aXRsZSAgICAgIFN0cmluZ1xcbiAgc2x1ZyAgICAgICBTdHJpbmcgICAgIEB1bmlxdWVcXG4gIGV4Y2VycHQgICAgU3RyaW5nXFxuICBjb250ZW50ICAgIFN0cmluZ1xcbiAgY292ZXJJbWFnZSBTdHJpbmdcXG4gIHN0YXR1cyAgICAgUG9zdFN0YXR1cyBAZGVmYXVsdChEUkFGVClcXG4gIGlzRGVsZXRlZCAgQm9vbGVhbiAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGF1dGhvcklkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGF1dGhvciAgIFVzZXIgICAgICAgICAgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIsIGZpZWxkczogW2F1dGhvcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGNvbW1lbnRzIEJsb2dDb21tZW50W10gQHJlbGF0aW9uKFxcXCJQb3N0Q29tbWVudHNcXFwiKVxcblxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAaW5kZXgoW2F1dGhvcklkXSlcXG4gIEBAbWFwKFxcXCJibG9nX3Bvc3RzXFxcIilcXG59XFxuXFxubW9kZWwgQm9va2luZyB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRyYXZlbERhdGUgRGF0ZVRpbWVcXG4gIHRyYXZlbGVycyAgSW50XFxuICB0b3RhbFByaWNlIERlY2ltYWwgICAgICAgQGRiLkRlY2ltYWwoMTAsIDIpXFxuICBzdGF0dXMgICAgIEJvb2tpbmdTdGF0dXMgQGRlZmF1bHQoUEVORElORylcXG5cXG4gIHVzZXJJZCAgICBTdHJpbmdcXG4gIHBhY2thZ2VJZCBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICB1c2VyICAgICBVc2VyICAgICAgICBAcmVsYXRpb24oXFxcIkN1c3RvbWVyQm9va2luZ3NcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSAgVG91clBhY2thZ2UgQHJlbGF0aW9uKGZpZWxkczogW3BhY2thZ2VJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYXltZW50cyBQYXltZW50W11cXG5cXG4gIEBAaW5kZXgoW3VzZXJJZF0pXFxuICBAQGluZGV4KFtwYWNrYWdlSWRdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAaW5kZXgoW3VzZXJJZCwgcGFja2FnZUlkLCB0cmF2ZWxEYXRlXSlcXG4gIEBAbWFwKFxcXCJib29raW5nc1xcXCIpXFxufVxcblxcbm1vZGVsIENhdGVnb3J5IHtcXG4gIGlkICAgU3RyaW5nIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lIFN0cmluZyBAdW5pcXVlXFxuICBzbHVnIFN0cmluZyBAdW5pcXVlXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgcGFja2FnZXMgVG91clBhY2thZ2VbXVxcblxcbiAgQEBtYXAoXFxcImNhdGVnb3JpZXNcXFwiKVxcbn1cXG5cXG5tb2RlbCBDb250YWN0TWVzc2FnZSB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIG5hbWUgICAgICAgU3RyaW5nXFxuICBlbWFpbCAgICAgIFN0cmluZ1xcbiAgc3ViamVjdCAgICBTdHJpbmdcXG4gIG1lc3NhZ2UgICAgU3RyaW5nXFxuICBpc1Jlc29sdmVkIEJvb2xlYW4gQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgQEBpbmRleChbaXNSZXNvbHZlZF0pXFxuICBAQG1hcChcXFwiY29udGFjdF9tZXNzYWdlc1xcXCIpXFxufVxcblxcbmVudW0gUm9sZSB7XFxuICBVU0VSXFxuICBBR0VOVFxcbiAgQURNSU5cXG59XFxuXFxuZW51bSBVc2VyU3RhdHVzIHtcXG4gIEFDVElWRVxcbiAgU1VTUEVOREVEXFxufVxcblxcbmVudW0gQXV0aFByb3ZpZGVyIHtcXG4gIENSRURFTlRJQUxcXG4gIEdPT0dMRVxcbn1cXG5cXG5lbnVtIFBhY2thZ2VTdGF0dXMge1xcbiAgUEVORElOR1xcbiAgQVBQUk9WRURcXG4gIFJFSkVDVEVEXFxufVxcblxcbmVudW0gQm9va2luZ1N0YXR1cyB7XFxuICBQRU5ESU5HXFxuICBQQUlEXFxuICBDT05GSVJNRURcXG4gIENBTkNFTExFRFxcbiAgQ09NUExFVEVEXFxufVxcblxcbmVudW0gUGF5bWVudFN0YXR1cyB7XFxuICBJTklUSUFURURcXG4gIFNVQ0NFU1NcXG4gIEZBSUxFRFxcbiAgQ0FOQ0VMTEVEXFxuICBSRUZVTkRFRFxcbn1cXG5cXG5lbnVtIFBvc3RTdGF0dXMge1xcbiAgRFJBRlRcXG4gIFBVQkxJU0hFRFxcbn1cXG5cXG5lbnVtIE5vdGlmaWNhdGlvblR5cGUge1xcbiAgQk9PS0lOR19DUkVBVEVEXFxuICBCT09LSU5HX0NPTkZJUk1FRFxcbiAgQk9PS0lOR19DQU5DRUxMRURcXG4gIFBBQ0tBR0VfQVBQUk9WRURcXG4gIFBBQ0tBR0VfUkVKRUNURURcXG59XFxuXFxubW9kZWwgTm90aWZpY2F0aW9uIHtcXG4gIGlkICAgICAgU3RyaW5nICAgICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdXNlcklkICBTdHJpbmdcXG4gIHR5cGUgICAgTm90aWZpY2F0aW9uVHlwZVxcbiAgdGl0bGUgICBTdHJpbmdcXG4gIG1lc3NhZ2UgU3RyaW5nXFxuICBsaW5rICAgIFN0cmluZz9cXG4gIGlzUmVhZCAgQm9vbGVhbiAgICAgICAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG5cXG4gIHVzZXIgVXNlciBAcmVsYXRpb24oZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW3VzZXJJZCwgaXNSZWFkLCBjcmVhdGVkQXRdKVxcbiAgQEBtYXAoXFxcIm5vdGlmaWNhdGlvbnNcXFwiKVxcbn1cXG5cXG5tb2RlbCBQYXltZW50IHtcXG4gIGlkICAgICAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIGJvb2tpbmdJZCAgICAgIFN0cmluZ1xcbiAgdHJhbklkICAgICAgICAgU3RyaW5nICAgICAgICBAdW5pcXVlIC8vIFNTTENvbW1lcnogdHJhbnNhY3Rpb24gaWQsIGdlbmVyYXRlZCBzZXJ2ZXItc2lkZVxcbiAgdmFsSWQgICAgICAgICAgU3RyaW5nPyAvLyBzZXQgYWZ0ZXIgZ2F0ZXdheSBzdWNjZXNzLCB1c2VkIGZvciBzZXJ2ZXItc2lkZSB2YWxpZGF0aW9uXFxuICBhbW91bnQgICAgICAgICBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKSAvLyA9IGJvb2tpbmcudG90YWxQcmljZSBhdCBzZXNzaW9uIGNyZWF0aW9uXFxuICBjdXJyZW5jeSAgICAgICBTdHJpbmcgICAgICAgIEBkZWZhdWx0KFxcXCJCRFRcXFwiKVxcbiAgc3RhdHVzICAgICAgICAgUGF5bWVudFN0YXR1cyBAZGVmYXVsdChJTklUSUFURUQpXFxuICBnYXRld2F5UGFnZVVybCBTdHJpbmc/XFxuICBzc2xTZXNzaW9uS2V5ICBTdHJpbmc/XFxuICBjYXJkVHlwZSAgICAgICBTdHJpbmc/XFxuICBiYW5rVHJhbklkICAgICBTdHJpbmc/XFxuICBwYWlkQXQgICAgICAgICBEYXRlVGltZT9cXG4gIHJlZnVuZFJlZklkICAgIFN0cmluZz8gLy8gU1NMQ29tbWVyeiByZWZ1bmQgcmVmZXJlbmNlIChzZXQgd2hlbiBhIHJlZnVuZCBpcyBpbml0aWF0ZWQpXFxuICByZWZ1bmRlZEF0ICAgICBEYXRlVGltZT8gLy8gd2hlbiB0aGUgcmVmdW5kIHdhcyBpbml0aWF0ZWQvc2V0dGxlZFxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGJvb2tpbmcgQm9va2luZyBAcmVsYXRpb24oZmllbGRzOiBbYm9va2luZ0lkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW2Jvb2tpbmdJZF0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInBheW1lbnRzXFxcIilcXG59XFxuXFxubW9kZWwgUmVmcmVzaFRva2VuIHtcXG4gIGlkICAgICAgICBTdHJpbmcgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHVzZXJJZCAgICBTdHJpbmdcXG4gIGhhc2ggICAgICBTdHJpbmcgICAgQHVuaXF1ZSAvLyBTSEEtMjU2IG9mIHRoZSByZWZyZXNoIEpXVCBcdTIwMTQgbmV2ZXIgc3RvcmUgdGhlIEpXVCBpdHNlbGZcXG4gIGV4cGlyZXNBdCBEYXRlVGltZVxcbiAgY3JlYXRlZEF0IERhdGVUaW1lICBAZGVmYXVsdChub3coKSlcXG4gIHJldm9rZWRBdCBEYXRlVGltZT8gLy8gc2V0IHdoZW4gcm90YXRlZCBvciBsb2dnZWQgb3V0XFxuXFxuICB1c2VyIFVzZXIgQHJlbGF0aW9uKGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuXFxuICBAQGluZGV4KFt1c2VySWQsIHJldm9rZWRBdF0pXFxuICBAQG1hcChcXFwicmVmcmVzaF90b2tlbnNcXFwiKVxcbn1cXG5cXG5tb2RlbCBSZXZpZXcge1xcbiAgaWQgICAgICAgIFN0cmluZyAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHJhdGluZyAgICBJbnRcXG4gIGNvbW1lbnQgICBTdHJpbmdcXG4gIGlzRGVsZXRlZCBCb29sZWFuIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgdXNlcklkICAgIFN0cmluZ1xcbiAgcGFja2FnZUlkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHVzZXIgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lclJldmlld3NcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pXFxuICBAQGluZGV4KFtwYWNrYWdlSWRdKVxcbiAgQEBtYXAoXFxcInJldmlld3NcXFwiKVxcbn1cXG5cXG4vLyBUaGlzIGlzIHlvdXIgUHJpc21hIHNjaGVtYSBmaWxlLFxcbi8vIGxlYXJuIG1vcmUgYWJvdXQgaXQgaW4gdGhlIGRvY3M6IGh0dHBzOi8vcHJpcy5seS9kL3ByaXNtYS1zY2hlbWFcXG5cXG5nZW5lcmF0b3IgY2xpZW50IHtcXG4gIHByb3ZpZGVyID0gXFxcInByaXNtYS1jbGllbnRcXFwiXFxuICBvdXRwdXQgICA9IFxcXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hXFxcIlxcbn1cXG5cXG5kYXRhc291cmNlIGRiIHtcXG4gIHByb3ZpZGVyID0gXFxcInBvc3RncmVzcWxcXFwiXFxufVxcblxcbm1vZGVsIFRvdXJQYWNrYWdlIHtcXG4gIGlkICAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRpdGxlICAgICAgIFN0cmluZ1xcbiAgc2x1ZyAgICAgICAgU3RyaW5nICAgICAgICBAdW5pcXVlXFxuICBkZXNjcmlwdGlvbiBTdHJpbmdcXG4gIGxvY2F0aW9uICAgIFN0cmluZ1xcbiAgcHJpY2UgICAgICAgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMilcXG4gIGR1cmF0aW9uICAgIEludFxcbiAgcmF0aW5nICAgICAgRmxvYXQgICAgICAgICBAZGVmYXVsdCgwKVxcbiAgaW1hZ2VzICAgICAgU3RyaW5nW11cXG4gIHN0YXR1cyAgICAgIFBhY2thZ2VTdGF0dXMgQGRlZmF1bHQoUEVORElORylcXG4gIGlzRGVsZXRlZCAgIEJvb2xlYW4gICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBjYXRlZ29yeUlkIFN0cmluZ1xcbiAgYWdlbnRJZCAgICBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBjYXRlZ29yeSAgICAgIENhdGVnb3J5ICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFtjYXRlZ29yeUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGFnZW50ICAgICAgICAgVXNlciAgICAgICAgICAgQHJlbGF0aW9uKFxcXCJBZ2VudFBhY2thZ2VzXFxcIiwgZmllbGRzOiBbYWdlbnRJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBib29raW5ncyAgICAgIEJvb2tpbmdbXVxcbiAgcmV2aWV3cyAgICAgICBSZXZpZXdbXVxcbiAgd2lzaGxpc3RJdGVtcyBXaXNobGlzdEl0ZW1bXVxcblxcbiAgQEBpbmRleChbY2F0ZWdvcnlJZF0pXFxuICBAQGluZGV4KFtjYXRlZ29yeUlkLCBwcmljZV0pXFxuICBAQGluZGV4KFtwcmljZV0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInRvdXJfcGFja2FnZXNcXFwiKVxcbn1cXG5cXG5tb2RlbCBVc2VyIHtcXG4gIGlkICAgICAgICAgICAgU3RyaW5nICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lICAgICAgICAgIFN0cmluZ1xcbiAgZW1haWwgICAgICAgICBTdHJpbmcgICAgICAgQHVuaXF1ZVxcbiAgcGFzc3dvcmQgICAgICBTdHJpbmc/XFxuICBnb29nbGVJZCAgICAgIFN0cmluZz8gICAgICBAdW5pcXVlXFxuICBwaG9uZSAgICAgICAgIFN0cmluZz9cXG4gIGF2YXRhclVybCAgICAgU3RyaW5nP1xcbiAgcm9sZSAgICAgICAgICBSb2xlICAgICAgICAgQGRlZmF1bHQoVVNFUilcXG4gIHN0YXR1cyAgICAgICAgVXNlclN0YXR1cyAgIEBkZWZhdWx0KEFDVElWRSlcXG4gIGF1dGhQcm92aWRlciAgQXV0aFByb3ZpZGVyIEBkZWZhdWx0KENSRURFTlRJQUwpXFxuICBlbWFpbFZlcmlmaWVkIEJvb2xlYW4gICAgICBAZGVmYXVsdChmYWxzZSlcXG4gIGlzRGVsZXRlZCAgICAgQm9vbGVhbiAgICAgIEBkZWZhdWx0KGZhbHNlKVxcbiAgdG9rZW5WZXJzaW9uICBJbnQgICAgICAgICAgQGRlZmF1bHQoMClcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBwYWNrYWdlcyAgICAgIFRvdXJQYWNrYWdlW10gIEByZWxhdGlvbihcXFwiQWdlbnRQYWNrYWdlc1xcXCIpXFxuICBib29raW5ncyAgICAgIEJvb2tpbmdbXSAgICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCIpXFxuICByZXZpZXdzICAgICAgIFJldmlld1tdICAgICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIilcXG4gIHBvc3RzICAgICAgICAgQmxvZ1Bvc3RbXSAgICAgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIpXFxuICB3aXNobGlzdCAgICAgIFdpc2hsaXN0SXRlbVtdXFxuICBub3RpZmljYXRpb25zIE5vdGlmaWNhdGlvbltdXFxuICBjb21tZW50cyAgICAgIEJsb2dDb21tZW50W10gIEByZWxhdGlvbihcXFwiVXNlckNvbW1lbnRzXFxcIilcXG4gIHJlZnJlc2hUb2tlbnMgUmVmcmVzaFRva2VuW11cXG5cXG4gIEBAaW5kZXgoW3JvbGVdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAbWFwKFxcXCJ1c2Vyc1xcXCIpXFxufVxcblxcbm1vZGVsIFdpc2hsaXN0SXRlbSB7XFxuICBpZCAgICAgICAgU3RyaW5nIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuXFxuICB1c2VyICAgIFVzZXIgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pXFxuICBAQGluZGV4KFt1c2VySWQsIGNyZWF0ZWRBdF0pXFxuICBAQG1hcChcXFwid2lzaGxpc3RfaXRlbXNcXFwiKVxcbn1cXG5cIixcbiAgXCJydW50aW1lRGF0YU1vZGVsXCI6IHtcbiAgICBcIm1vZGVsc1wiOiB7fSxcbiAgICBcImVudW1zXCI6IHt9LFxuICAgIFwidHlwZXNcIjoge31cbiAgfSxcbiAgXCJwYXJhbWV0ZXJpemF0aW9uU2NoZW1hXCI6IHtcbiAgICBcInN0cmluZ3NcIjogW10sXG4gICAgXCJncmFwaFwiOiBcIlwiXG4gIH1cbn1cblxuY29uZmlnLnJ1bnRpbWVEYXRhTW9kZWwgPSBKU09OLnBhcnNlKFwie1xcXCJtb2RlbHNcXFwiOntcXFwiQmxvZ0NvbW1lbnRcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNvbnRlbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBvc3RJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXJlbnRJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwb3N0XFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCbG9nUG9zdFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlBvc3RDb21tZW50c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJVc2VyQ29tbWVudHNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXJlbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ29tbWVudFJlcGxpZXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyZXBsaWVzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCbG9nQ29tbWVudFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkNvbW1lbnRSZXBsaWVzXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJibG9nX2NvbW1lbnRzXFxcIn0sXFxcIkJsb2dQb3N0XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0aXRsZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZXhjZXJwdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29udGVudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY292ZXJJbWFnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUG9zdFN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhvcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhvclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkF1dGhvclBvc3RzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29tbWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUG9zdENvbW1lbnRzXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJibG9nX3Bvc3RzXFxcIn0sXFxcIkJvb2tpbmdcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRyYXZlbERhdGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhdmVsZXJzXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0b3RhbFByaWNlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEZWNpbWFsXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1N0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lckJvb2tpbmdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBheW1lbnRzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYXltZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvUGF5bWVudFxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwifSxcXFwiQ2F0ZWdvcnlcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNsdWdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ2F0ZWdvcnlUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJjYXRlZ29yaWVzXFxcIn0sXFxcIkNvbnRhY3RNZXNzYWdlXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJuYW1lXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJlbWFpbFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3ViamVjdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibWVzc2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNSZXNvbHZlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJjb250YWN0X21lc3NhZ2VzXFxcIn0sXFxcIk5vdGlmaWNhdGlvblxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0eXBlXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiTm90aWZpY2F0aW9uVHlwZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRpdGxlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJtZXNzYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJsaW5rXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc1JlYWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIk5vdGlmaWNhdGlvblRvVXNlclxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwibm90aWZpY2F0aW9uc1xcXCJ9LFxcXCJQYXltZW50XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRyYW5JZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidmFsSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImFtb3VudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImN1cnJlbmN5XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYXltZW50U3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNzbFNlc3Npb25LZXlcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNhcmRUeXBlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJiYW5rVHJhbklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWlkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmdW5kUmVmSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJlZnVuZGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvUGF5bWVudFxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwicGF5bWVudHNcXFwifSxcXFwiUmVmcmVzaFRva2VuXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImhhc2hcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImV4cGlyZXNBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2b2tlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZWZyZXNoVG9rZW5Ub1VzZXJcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInJlZnJlc2hfdG9rZW5zXFxcIn0sXFxcIlJldmlld1xcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmF0aW5nXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb21tZW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZXZpZXdUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJyZXZpZXdzXFxcIn0sXFxcIlRvdXJQYWNrYWdlXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0aXRsZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZGVzY3JpcHRpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImxvY2F0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwcmljZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImR1cmF0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyYXRpbmdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkZsb2F0XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaW1hZ2VzXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYWNrYWdlU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2F0ZWdvcnlJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYWdlbnRJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjYXRlZ29yeVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQ2F0ZWdvcnlcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDYXRlZ29yeVRvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhZ2VudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkFnZW50UGFja2FnZXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmV2aWV3VG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIndpc2hsaXN0SXRlbXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIldpc2hsaXN0SXRlbVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlRvdXJQYWNrYWdlVG9XaXNobGlzdEl0ZW1cXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInRvdXJfcGFja2FnZXNcXFwifSxcXFwiVXNlclxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhc3N3b3JkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJnb29nbGVJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGhvbmVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF2YXRhclVybFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicm9sZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlJvbGVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aFByb3ZpZGVyXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQXV0aFByb3ZpZGVyXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxWZXJpZmllZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRva2VuVmVyc2lvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBZ2VudFBhY2thZ2VzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lckJvb2tpbmdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicG9zdHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dQb3N0XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQXV0aG9yUG9zdHNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ3aXNobGlzdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiV2lzaGxpc3RJdGVtXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVXNlclRvV2lzaGxpc3RJdGVtXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibm90aWZpY2F0aW9uc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiTm90aWZpY2F0aW9uXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiTm90aWZpY2F0aW9uVG9Vc2VyXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29tbWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dDb21tZW50XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVXNlckNvbW1lbnRzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmcmVzaFRva2Vuc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmVmcmVzaFRva2VuXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmVmcmVzaFRva2VuVG9Vc2VyXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJ1c2Vyc1xcXCJ9LFxcXCJXaXNobGlzdEl0ZW1cXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlVzZXJUb1dpc2hsaXN0SXRlbVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVG91clBhY2thZ2VUb1dpc2hsaXN0SXRlbVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwid2lzaGxpc3RfaXRlbXNcXFwifX0sXFxcImVudW1zXFxcIjp7fSxcXFwidHlwZXNcXFwiOnt9fVwiKVxuY29uZmlnLnBhcmFtZXRlcml6YXRpb25TY2hlbWEgPSB7XG4gIHN0cmluZ3M6IEpTT04ucGFyc2UoXCJbXFxcIndoZXJlXFxcIixcXFwib3JkZXJCeVxcXCIsXFxcImN1cnNvclxcXCIsXFxcInBhY2thZ2VzXFxcIixcXFwiX2NvdW50XFxcIixcXFwiY2F0ZWdvcnlcXFwiLFxcXCJhZ2VudFxcXCIsXFxcInVzZXJcXFwiLFxcXCJwYWNrYWdlXFxcIixcXFwiYm9va2luZ1xcXCIsXFxcInBheW1lbnRzXFxcIixcXFwiYm9va2luZ3NcXFwiLFxcXCJyZXZpZXdzXFxcIixcXFwid2lzaGxpc3RJdGVtc1xcXCIsXFxcInBvc3RzXFxcIixcXFwid2lzaGxpc3RcXFwiLFxcXCJub3RpZmljYXRpb25zXFxcIixcXFwiY29tbWVudHNcXFwiLFxcXCJyZWZyZXNoVG9rZW5zXFxcIixcXFwiYXV0aG9yXFxcIixcXFwicG9zdFxcXCIsXFxcInBhcmVudFxcXCIsXFxcInJlcGxpZXNcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kVW5pcXVlXFxcIixcXFwiQmxvZ0NvbW1lbnQuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kRmlyc3RcXFwiLFxcXCJCbG9nQ29tbWVudC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQmxvZ0NvbW1lbnQuZmluZE1hbnlcXFwiLFxcXCJkYXRhXFxcIixcXFwiQmxvZ0NvbW1lbnQuY3JlYXRlT25lXFxcIixcXFwiQmxvZ0NvbW1lbnQuY3JlYXRlTWFueVxcXCIsXFxcIkJsb2dDb21tZW50LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCbG9nQ29tbWVudC51cGRhdGVPbmVcXFwiLFxcXCJCbG9nQ29tbWVudC51cGRhdGVNYW55XFxcIixcXFwiQmxvZ0NvbW1lbnQudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcImNyZWF0ZVxcXCIsXFxcInVwZGF0ZVxcXCIsXFxcIkJsb2dDb21tZW50LnVwc2VydE9uZVxcXCIsXFxcIkJsb2dDb21tZW50LmRlbGV0ZU9uZVxcXCIsXFxcIkJsb2dDb21tZW50LmRlbGV0ZU1hbnlcXFwiLFxcXCJoYXZpbmdcXFwiLFxcXCJfbWluXFxcIixcXFwiX21heFxcXCIsXFxcIkJsb2dDb21tZW50Lmdyb3VwQnlcXFwiLFxcXCJCbG9nQ29tbWVudC5hZ2dyZWdhdGVcXFwiLFxcXCJCbG9nUG9zdC5maW5kVW5pcXVlXFxcIixcXFwiQmxvZ1Bvc3QuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQmxvZ1Bvc3QuZmluZE1hbnlcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVPbmVcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVNYW55XFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU9uZVxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU1hbnlcXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQmxvZ1Bvc3QudXBzZXJ0T25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlT25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlTWFueVxcXCIsXFxcIkJsb2dQb3N0Lmdyb3VwQnlcXFwiLFxcXCJCbG9nUG9zdC5hZ2dyZWdhdGVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQm9va2luZy5maW5kRmlyc3RcXFwiLFxcXCJCb29raW5nLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJCb29raW5nLmZpbmRNYW55XFxcIixcXFwiQm9va2luZy5jcmVhdGVPbmVcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCb29raW5nLnVwZGF0ZU9uZVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJvb2tpbmcudXBzZXJ0T25lXFxcIixcXFwiQm9va2luZy5kZWxldGVPbmVcXFwiLFxcXCJCb29raW5nLmRlbGV0ZU1hbnlcXFwiLFxcXCJfYXZnXFxcIixcXFwiX3N1bVxcXCIsXFxcIkJvb2tpbmcuZ3JvdXBCeVxcXCIsXFxcIkJvb2tpbmcuYWdncmVnYXRlXFxcIixcXFwiQ2F0ZWdvcnkuZmluZFVuaXF1ZVxcXCIsXFxcIkNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNhdGVnb3J5LmZpbmRNYW55XFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlT25lXFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlTWFueVxcXCIsXFxcIkNhdGVnb3J5LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVPbmVcXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVNYW55XFxcIixcXFwiQ2F0ZWdvcnkudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNhdGVnb3J5LnVwc2VydE9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU1hbnlcXFwiLFxcXCJDYXRlZ29yeS5ncm91cEJ5XFxcIixcXFwiQ2F0ZWdvcnkuYWdncmVnYXRlXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZFVuaXF1ZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlT25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwc2VydE9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5ncm91cEJ5XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuYWdncmVnYXRlXFxcIixcXFwiTm90aWZpY2F0aW9uLmZpbmRVbmlxdWVcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZEZpcnN0XFxcIixcXFwiTm90aWZpY2F0aW9uLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZE1hbnlcXFwiLFxcXCJOb3RpZmljYXRpb24uY3JlYXRlT25lXFxcIixcXFwiTm90aWZpY2F0aW9uLmNyZWF0ZU1hbnlcXFwiLFxcXCJOb3RpZmljYXRpb24uY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIk5vdGlmaWNhdGlvbi51cGRhdGVPbmVcXFwiLFxcXCJOb3RpZmljYXRpb24udXBkYXRlTWFueVxcXCIsXFxcIk5vdGlmaWNhdGlvbi51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiTm90aWZpY2F0aW9uLnVwc2VydE9uZVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5kZWxldGVPbmVcXFwiLFxcXCJOb3RpZmljYXRpb24uZGVsZXRlTWFueVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5ncm91cEJ5XFxcIixcXFwiTm90aWZpY2F0aW9uLmFnZ3JlZ2F0ZVxcXCIsXFxcIlBheW1lbnQuZmluZFVuaXF1ZVxcXCIsXFxcIlBheW1lbnQuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJQYXltZW50LmZpbmRGaXJzdFxcXCIsXFxcIlBheW1lbnQuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlBheW1lbnQuZmluZE1hbnlcXFwiLFxcXCJQYXltZW50LmNyZWF0ZU9uZVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlTWFueVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlBheW1lbnQudXBkYXRlT25lXFxcIixcXFwiUGF5bWVudC51cGRhdGVNYW55XFxcIixcXFwiUGF5bWVudC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUGF5bWVudC51cHNlcnRPbmVcXFwiLFxcXCJQYXltZW50LmRlbGV0ZU9uZVxcXCIsXFxcIlBheW1lbnQuZGVsZXRlTWFueVxcXCIsXFxcIlBheW1lbnQuZ3JvdXBCeVxcXCIsXFxcIlBheW1lbnQuYWdncmVnYXRlXFxcIixcXFwiUmVmcmVzaFRva2VuLmZpbmRVbmlxdWVcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZEZpcnN0XFxcIixcXFwiUmVmcmVzaFRva2VuLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZmluZE1hbnlcXFwiLFxcXCJSZWZyZXNoVG9rZW4uY3JlYXRlT25lXFxcIixcXFwiUmVmcmVzaFRva2VuLmNyZWF0ZU1hbnlcXFwiLFxcXCJSZWZyZXNoVG9rZW4uY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJlZnJlc2hUb2tlbi51cGRhdGVPbmVcXFwiLFxcXCJSZWZyZXNoVG9rZW4udXBkYXRlTWFueVxcXCIsXFxcIlJlZnJlc2hUb2tlbi51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUmVmcmVzaFRva2VuLnVwc2VydE9uZVxcXCIsXFxcIlJlZnJlc2hUb2tlbi5kZWxldGVPbmVcXFwiLFxcXCJSZWZyZXNoVG9rZW4uZGVsZXRlTWFueVxcXCIsXFxcIlJlZnJlc2hUb2tlbi5ncm91cEJ5XFxcIixcXFwiUmVmcmVzaFRva2VuLmFnZ3JlZ2F0ZVxcXCIsXFxcIlJldmlldy5maW5kVW5pcXVlXFxcIixcXFwiUmV2aWV3LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRGaXJzdFxcXCIsXFxcIlJldmlldy5maW5kRmlyc3RPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU9uZVxcXCIsXFxcIlJldmlldy5jcmVhdGVNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJSZXZpZXcudXBkYXRlT25lXFxcIixcXFwiUmV2aWV3LnVwZGF0ZU1hbnlcXFwiLFxcXCJSZXZpZXcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJldmlldy51cHNlcnRPbmVcXFwiLFxcXCJSZXZpZXcuZGVsZXRlT25lXFxcIixcXFwiUmV2aWV3LmRlbGV0ZU1hbnlcXFwiLFxcXCJSZXZpZXcuZ3JvdXBCeVxcXCIsXFxcIlJldmlldy5hZ2dyZWdhdGVcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kVW5pcXVlXFxcIixcXFwiVG91clBhY2thZ2UuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiVG91clBhY2thZ2UuZmluZE1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVNYW55XFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVG91clBhY2thZ2UudXBzZXJ0T25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlT25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLmdyb3VwQnlcXFwiLFxcXCJUb3VyUGFja2FnZS5hZ2dyZWdhdGVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiVXNlci5maW5kRmlyc3RcXFwiLFxcXCJVc2VyLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJVc2VyLmZpbmRNYW55XFxcIixcXFwiVXNlci5jcmVhdGVPbmVcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJVc2VyLnVwZGF0ZU9uZVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlVzZXIudXBzZXJ0T25lXFxcIixcXFwiVXNlci5kZWxldGVPbmVcXFwiLFxcXCJVc2VyLmRlbGV0ZU1hbnlcXFwiLFxcXCJVc2VyLmdyb3VwQnlcXFwiLFxcXCJVc2VyLmFnZ3JlZ2F0ZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kVW5pcXVlXFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRGaXJzdFxcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiV2lzaGxpc3RJdGVtLmZpbmRNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLmNyZWF0ZU9uZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5jcmVhdGVNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJXaXNobGlzdEl0ZW0udXBkYXRlT25lXFxcIixcXFwiV2lzaGxpc3RJdGVtLnVwZGF0ZU1hbnlcXFwiLFxcXCJXaXNobGlzdEl0ZW0udXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIldpc2hsaXN0SXRlbS51cHNlcnRPbmVcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZGVsZXRlT25lXFxcIixcXFwiV2lzaGxpc3RJdGVtLmRlbGV0ZU1hbnlcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZ3JvdXBCeVxcXCIsXFxcIldpc2hsaXN0SXRlbS5hZ2dyZWdhdGVcXFwiLFxcXCJBTkRcXFwiLFxcXCJPUlxcXCIsXFxcIk5PVFxcXCIsXFxcImlkXFxcIixcXFwidXNlcklkXFxcIixcXFwicGFja2FnZUlkXFxcIixcXFwiY3JlYXRlZEF0XFxcIixcXFwiZXF1YWxzXFxcIixcXFwiaW5cXFwiLFxcXCJub3RJblxcXCIsXFxcImx0XFxcIixcXFwibHRlXFxcIixcXFwiZ3RcXFwiLFxcXCJndGVcXFwiLFxcXCJub3RcXFwiLFxcXCJjb250YWluc1xcXCIsXFxcInN0YXJ0c1dpdGhcXFwiLFxcXCJlbmRzV2l0aFxcXCIsXFxcIm5hbWVcXFwiLFxcXCJlbWFpbFxcXCIsXFxcInBhc3N3b3JkXFxcIixcXFwiZ29vZ2xlSWRcXFwiLFxcXCJwaG9uZVxcXCIsXFxcImF2YXRhclVybFxcXCIsXFxcIlJvbGVcXFwiLFxcXCJyb2xlXFxcIixcXFwiVXNlclN0YXR1c1xcXCIsXFxcInN0YXR1c1xcXCIsXFxcIkF1dGhQcm92aWRlclxcXCIsXFxcImF1dGhQcm92aWRlclxcXCIsXFxcImVtYWlsVmVyaWZpZWRcXFwiLFxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJ0b2tlblZlcnNpb25cXFwiLFxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJldmVyeVxcXCIsXFxcInNvbWVcXFwiLFxcXCJub25lXFxcIixcXFwidGl0bGVcXFwiLFxcXCJzbHVnXFxcIixcXFwiZGVzY3JpcHRpb25cXFwiLFxcXCJsb2NhdGlvblxcXCIsXFxcInByaWNlXFxcIixcXFwiZHVyYXRpb25cXFwiLFxcXCJyYXRpbmdcXFwiLFxcXCJpbWFnZXNcXFwiLFxcXCJQYWNrYWdlU3RhdHVzXFxcIixcXFwiY2F0ZWdvcnlJZFxcXCIsXFxcImFnZW50SWRcXFwiLFxcXCJoYXNcXFwiLFxcXCJoYXNFdmVyeVxcXCIsXFxcImhhc1NvbWVcXFwiLFxcXCJjb21tZW50XFxcIixcXFwiaGFzaFxcXCIsXFxcImV4cGlyZXNBdFxcXCIsXFxcInJldm9rZWRBdFxcXCIsXFxcImJvb2tpbmdJZFxcXCIsXFxcInRyYW5JZFxcXCIsXFxcInZhbElkXFxcIixcXFwiYW1vdW50XFxcIixcXFwiY3VycmVuY3lcXFwiLFxcXCJQYXltZW50U3RhdHVzXFxcIixcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJzc2xTZXNzaW9uS2V5XFxcIixcXFwiY2FyZFR5cGVcXFwiLFxcXCJiYW5rVHJhbklkXFxcIixcXFwicGFpZEF0XFxcIixcXFwicmVmdW5kUmVmSWRcXFwiLFxcXCJyZWZ1bmRlZEF0XFxcIixcXFwiTm90aWZpY2F0aW9uVHlwZVxcXCIsXFxcInR5cGVcXFwiLFxcXCJtZXNzYWdlXFxcIixcXFwibGlua1xcXCIsXFxcImlzUmVhZFxcXCIsXFxcInN1YmplY3RcXFwiLFxcXCJpc1Jlc29sdmVkXFxcIixcXFwidHJhdmVsRGF0ZVxcXCIsXFxcInRyYXZlbGVyc1xcXCIsXFxcInRvdGFsUHJpY2VcXFwiLFxcXCJCb29raW5nU3RhdHVzXFxcIixcXFwiZXhjZXJwdFxcXCIsXFxcImNvbnRlbnRcXFwiLFxcXCJjb3ZlckltYWdlXFxcIixcXFwiUG9zdFN0YXR1c1xcXCIsXFxcImF1dGhvcklkXFxcIixcXFwicG9zdElkXFxcIixcXFwicGFyZW50SWRcXFwiLFxcXCJ1c2VySWRfcGFja2FnZUlkXFxcIixcXFwiaXNcXFwiLFxcXCJpc05vdFxcXCIsXFxcImNvbm5lY3RPckNyZWF0ZVxcXCIsXFxcInVwc2VydFxcXCIsXFxcImNyZWF0ZU1hbnlcXFwiLFxcXCJzZXRcXFwiLFxcXCJkaXNjb25uZWN0XFxcIixcXFwiZGVsZXRlXFxcIixcXFwiY29ubmVjdFxcXCIsXFxcInVwZGF0ZU1hbnlcXFwiLFxcXCJkZWxldGVNYW55XFxcIixcXFwicHVzaFxcXCIsXFxcImluY3JlbWVudFxcXCIsXFxcImRlY3JlbWVudFxcXCIsXFxcIm11bHRpcGx5XFxcIixcXFwiZGl2aWRlXFxcIl1cIiksXG4gIGdyYXBoOiBcIndBWnh3QUVQQndBQW9RTUFJQlFBQUtNREFDQVZBQUNrQXdBZ0ZnQUEtUUlBSU44QkFBQ2lBd0F3NEFFQUFDZ0FFT0VCQUFDaUF3QXc0Z0VCQUFBQUFlTUJBUURyQWdBaDVRRkFBUElDQUNILUFTQUE4QUlBSVlBQ1FBRHlBZ0FocndJQkFPc0NBQ0d6QWdFQTZ3SUFJYlFDQVFEc0FnQWhBUUFBQUFFQUlCY0ZBQUM0QXdBZ0JnQUFvUU1BSUFzQUFQUUNBQ0FNQUFEMUFnQWdEUUFBOXdJQUlOOEJBQUMxQXdBdzRBRUFBQU1BRU9FQkFBQzFBd0F3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDM0E0MENJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUURyQWdBaGhnSUJBT3NDQUNHSEFnRUE2d0lBSVlnQ0VBQ3ZBd0FoaVFJQ0FQRUNBQ0dLQWdnQXRnTUFJWXNDQUFELUFnQWdqUUlCQU9zQ0FDR09BZ0VBNndJQUlRVUZBQURtQlFBZ0JnQUE0QVVBSUFzQUFKNEZBQ0FNQUFDZkJRQWdEUUFBb1FVQUlCY0ZBQUM0QXdBZ0JnQUFvUU1BSUFzQUFQUUNBQ0FNQUFEMUFnQWdEUUFBOXdJQUlOOEJBQUMxQXdBdzRBRUFBQU1BRU9FQkFBQzFBd0F3NGdFQkFBQUFBZVVCUUFEeUFnQWgtZ0VBQUxjRGpRSWlfZ0VnQVBBQ0FDR0FBa0FBOGdJQUlZUUNBUURyQWdBaGhRSUJBQUFBQVlZQ0FRRHJBZ0FoaHdJQkFPc0NBQ0dJQWhBQXJ3TUFJWWtDQWdEeEFnQWhpZ0lJQUxZREFDR0xBZ0FBX2dJQUlJMENBUURyQWdBaGpnSUJBT3NDQUNFREFBQUFBd0FnQVFBQUJBQXdBZ0FBQlFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlBRUFBQUFEQUNBUEJ3QUFvUU1BSUFnQUFLc0RBQ0FLQUFDMEF3QWczd0VBQUxJREFERGdBUUFBQ1FBUTRRRUFBTElEQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDekE2NENJb0FDUUFEeUFnQWhxZ0pBQVBJQ0FDR3JBZ0lBOFFJQUlhd0NFQUN2QXdBaEF3Y0FBT0FGQUNBSUFBRGpCUUFnQ2dBQTVRVUFJQThIQUFDaEF3QWdDQUFBcXdNQUlBb0FBTFFEQUNEZkFRQUFzZ01BTU9BQkFBQUpBQkRoQVFBQXNnTUFNT0lCQVFBQUFBSGpBUUVBNndJQUllUUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFzd091QWlLQUFrQUE4Z0lBSWFvQ1FBRHlBZ0FocXdJQ0FQRUNBQ0dzQWhBQXJ3TUFJUU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FVQ1FBQXNRTUFJTjhCQUFDdUF3QXc0QUVBQUEwQUVPRUJBQUN1QXdBdzRnRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ3dBNXdDSW9BQ1FBRHlBZ0FobGdJQkFPc0NBQ0dYQWdFQTZ3SUFJWmdDQVFEc0FnQWhtUUlRQUs4REFDR2FBZ0VBNndJQUlad0NBUURzQWdBaG5RSUJBT3dDQUNHZUFnRUE3QUlBSVo4Q0FRRHNBZ0Fob0FKQUFLQURBQ0doQWdFQTdBSUFJYUlDUUFDZ0F3QWhDUWtBQU9RRkFDQ1lBZ0FBd2dNQUlKd0NBQURDQXdBZ25RSUFBTUlEQUNDZUFnQUF3Z01BSUo4Q0FBRENBd0Fnb0FJQUFNSURBQ0NoQWdBQXdnTUFJS0lDQUFEQ0F3QWdGQWtBQUxFREFDRGZBUUFBcmdNQU1PQUJBQUFOQUJEaEFRQUFyZ01BTU9JQkFRQUFBQUhsQVVBQThnSUFJZm9CQUFDd0E1d0NJb0FDUUFEeUFnQWhsZ0lCQU9zQ0FDR1hBZ0VBQUFBQm1BSUJBT3dDQUNHWkFoQUFyd01BSVpvQ0FRRHJBZ0FobkFJQkFPd0NBQ0dkQWdFQTdBSUFJWjRDQVFEc0FnQWhud0lCQU93Q0FDR2dBa0FBb0FNQUlhRUNBUURzQWdBaG9nSkFBS0FEQUNFREFBQUFEUUFnQVFBQURnQXdBZ0FBRHdBZ0FRQUFBQTBBSUEwSEFBQ2hBd0FnQ0FBQXF3TUFJTjhCQUFDdEF3QXc0QUVBQUJJQUVPRUJBQUN0QXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVRQkFRRHJBZ0FoNVFGQUFQSUNBQ0gtQVNBQThBSUFJWUFDUUFEeUFnQWhpZ0lDQVBFQ0FDR1NBZ0VBNndJQUlRSUhBQURnQlFBZ0NBQUE0d1VBSUE0SEFBQ2hBd0FnQ0FBQXF3TUFJTjhCQUFDdEF3QXc0QUVBQUJJQUVPRUJBQUN0QXdBdzRnRUJBQUFBQWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0tBZ0lBOFFJQUlaSUNBUURyQWdBaHRRSUFBS3dEQUNBREFBQUFFZ0FnQVFBQUV3QXdBZ0FBRkFBZ0NRY0FBS0VEQUNBSUFBQ3JBd0FnM3dFQUFLb0RBRERnQVFBQUZnQVE0UUVBQUtvREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSVFJSEFBRGdCUUFnQ0FBQTR3VUFJQW9IQUFDaEF3QWdDQUFBcXdNQUlOOEJBQUNxQXdBdzRBRUFBQllBRU9FQkFBQ3FBd0F3NGdFQkFBQUFBZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUliVUNBQUNwQXdBZ0F3QUFBQllBSUFFQUFCY0FNQUlBQUJnQUlBRUFBQUFKQUNBQkFBQUFFZ0FnQVFBQUFCWUFJQU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnRUJFQUFQa0NBQ0FUQUFDaEF3QWczd0VBQUtjREFERGdBUUFBSHdBUTRRRUFBS2NEQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFLZ0RzZ0lpX2dFZ0FQQUNBQ0dBQWtBQThnSUFJWVFDQVFEckFnQWhoUUlCQU9zQ0FDR3VBZ0VBNndJQUlhOENBUURyQWdBaHNBSUJBT3NDQUNHeUFnRUE2d0lBSVFJUkFBQ2pCUUFnRXdBQTRBVUFJQkFSQUFENUFnQWdFd0FBb1FNQUlOOEJBQUNuQXdBdzRBRUFBQjhBRU9FQkFBQ25Bd0F3NGdFQkFBQUFBZVVCUUFEeUFnQWgtZ0VBQUtnRHNnSWlfZ0VnQVBBQ0FDR0FBa0FBOGdJQUlZUUNBUURyQWdBaGhRSUJBQUFBQWE0Q0FRRHJBZ0FocndJQkFPc0NBQ0d3QWdFQTZ3SUFJYklDQVFEckFnQWhBd0FBQUI4QUlBRUFBQ0FBTUFJQUFDRUFJQU1BQUFBV0FDQUJBQUFYQURBQ0FBQVlBQ0FNQndBQW9RTUFJTjhCQUFDbEF3QXc0QUVBQUNRQUVPRUJBQUNsQXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVVQlFBRHlBZ0FoaEFJQkFPc0NBQ0drQWdBQXBnT2tBaUtsQWdFQTZ3SUFJYVlDQVFEc0FnQWhwd0lnQVBBQ0FDRUNCd0FBNEFVQUlLWUNBQURDQXdBZ0RBY0FBS0VEQUNEZkFRQUFwUU1BTU9BQkFBQWtBQkRoQVFBQXBRTUFNT0lCQVFBQUFBSGpBUUVBNndJQUllVUJRQUR5QWdBaGhBSUJBT3NDQUNHa0FnQUFwZ09rQWlLbEFnRUE2d0lBSWFZQ0FRRHNBZ0FocHdJZ0FQQUNBQ0VEQUFBQUpBQWdBUUFBSlFBd0FnQUFKZ0FnRHdjQUFLRURBQ0FVQUFDakF3QWdGUUFBcEFNQUlCWUFBUGtDQUNEZkFRQUFvZ01BTU9BQkFBQW9BQkRoQVFBQW9nTUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlmNEJJQUR3QWdBaGdBSkFBUElDQUNHdkFnRUE2d0lBSWJNQ0FRRHJBZ0FodEFJQkFPd0NBQ0VGQndBQTRBVUFJQlFBQU9FRkFDQVZBQURpQlFBZ0ZnQUFvd1VBSUxRQ0FBRENBd0FnQXdBQUFDZ0FJQUVBQUNrQU1BSUFBQUVBSUFvSEFBQ2hBd0FnM3dFQUFKOERBRERnQVFBQUt3QVE0UUVBQUo4REFERGlBUUVBNndJQUllTUJBUURyQWdBaDVRRkFBUElDQUNHVEFnRUE2d0lBSVpRQ1FBRHlBZ0FobFFKQUFLQURBQ0VDQndBQTRBVUFJSlVDQUFEQ0F3QWdDZ2NBQUtFREFDRGZBUUFBbndNQU1PQUJBQUFyQUJEaEFRQUFud01BTU9JQkFRQUFBQUhqQVFFQTZ3SUFJZVVCUUFEeUFnQWhrd0lCQUFBQUFaUUNRQUR5QWdBaGxRSkFBS0FEQUNFREFBQUFLd0FnQVFBQUxBQXdBZ0FBTFFBZ0FRQUFBQU1BSUFFQUFBQUpBQ0FCQUFBQUVnQWdBUUFBQUI4QUlBRUFBQUFXQUNBQkFBQUFKQUFnQVFBQUFDZ0FJQUVBQUFBckFDQURBQUFBS0FBZ0FRQUFLUUF3QWdBQUFRQWdBUUFBQUNnQUlBRUFBQUFvQUNBREFBQUFLQUFnQVFBQUtRQXdBZ0FBQVFBZ0FRQUFBQ2dBSUFFQUFBQUJBQ0FEQUFBQUtBQWdBUUFBS1FBd0FnQUFBUUFnQXdBQUFDZ0FJQUVBQUNrQU1BSUFBQUVBSUFNQUFBQW9BQ0FCQUFBcEFEQUNBQUFCQUNBTUJ3QUFfQU1BSUJRQUFQc0RBQ0FWQUFEX0F3QWdGZ0FBX1FNQUlPSUJBUUFBQUFIakFRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQnJ3SUJBQUFBQWJNQ0FRQUFBQUcwQWdFQUFBQUJBUndBQUVBQUlBamlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFhOENBUUFBQUFHekFnRUFBQUFCdEFJQkFBQUFBUUVjQUFCQ0FEQUJIQUFBUWdBd0FRQUFBQ2dBSUF3SEFBRDVBd0FnRkFBQTdnTUFJQlVBQU84REFDQVdBQUR3QXdBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJYThDQVFDOEF3QWhzd0lCQUx3REFDRzBBZ0VBeUFNQUlRSUFBQUFCQUNBY0FBQkdBQ0FJNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUlhOENBUUM4QXdBaHN3SUJBTHdEQUNHMEFnRUF5QU1BSVFJQUFBQW9BQ0FjQUFCSUFDQUNBQUFBS0FBZ0hBQUFTQUFnQVFBQUFDZ0FJQU1BQUFBQkFDQWpBQUJBQUNBa0FBQkdBQ0FCQUFBQUFRQWdBUUFBQUNnQUlBUUVBQURkQlFBZ0tRQUEzd1VBSUNvQUFONEZBQ0MwQWdBQXdnTUFJQXZmQVFBQW5nTUFNT0FCQUFCUUFCRGhBUUFBbmdNQU1PSUJBUURQQWdBaDR3RUJBTThDQUNIbEFVQUEwQUlBSWY0QklBRGJBZ0FoZ0FKQUFOQUNBQ0d2QWdFQXp3SUFJYk1DQVFEUEFnQWh0QUlCQU5jQ0FDRURBQUFBS0FBZ0FRQUFUd0F3S0FBQVVBQWdBd0FBQUNnQUlBRUFBQ2tBTUFJQUFBRUFJQUVBQUFBaEFDQUJBQUFBSVFBZ0F3QUFBQjhBSUFFQUFDQUFNQUlBQUNFQUlBTUFBQUFmQUNBQkFBQWdBREFDQUFBaEFDQURBQUFBSHdBZ0FRQUFJQUF3QWdBQUlRQWdEUkVBQUxBRUFDQVRBQURjQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFMSUNBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUd1QWdFQUFBQUJyd0lCQUFBQUFiQUNBUUFBQUFHeUFnRUFBQUFCQVJ3QUFGZ0FJQXZpQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBc2dJQ19nRWdBQUFBQVlBQ1FBQUFBQUdFQWdFQUFBQUJoUUlCQUFBQUFhNENBUUFBQUFHdkFnRUFBQUFCc0FJQkFBQUFBYklDQVFBQUFBRUJIQUFBV2dBd0FSd0FBRm9BTUEwUkFBQ2xCQUFnRXdBQTJ3VUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBb3dTeUFpTC1BU0FBekFNQUlZQUNRQUM5QXdBaGhBSUJBTHdEQUNHRkFnRUF2QU1BSWE0Q0FRQzhBd0FocndJQkFMd0RBQ0d3QWdFQXZBTUFJYklDQVFDOEF3QWhBZ0FBQUNFQUlCd0FBRjBBSUF2aUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFLTUVzZ0lpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR3VBZ0VBdkFNQUlhOENBUUM4QXdBaHNBSUJBTHdEQUNHeUFnRUF2QU1BSVFJQUFBQWZBQ0FjQUFCZkFDQUNBQUFBSHdBZ0hBQUFYd0FnQXdBQUFDRUFJQ01BQUZnQUlDUUFBRjBBSUFFQUFBQWhBQ0FCQUFBQUh3QWdBd1FBQU5nRkFDQXBBQURhQlFBZ0tnQUEyUVVBSUE3ZkFRQUFtZ01BTU9BQkFBQm1BQkRoQVFBQW1nTUFNT0lCQVFEUEFnQWg1UUZBQU5BQ0FDSDZBUUFBbXdPeUFpTC1BU0FBMndJQUlZQUNRQURRQWdBaGhBSUJBTThDQUNHRkFnRUF6d0lBSWE0Q0FRRFBBZ0FocndJQkFNOENBQ0d3QWdFQXp3SUFJYklDQVFEUEFnQWhBd0FBQUI4QUlBRUFBR1VBTUNnQUFHWUFJQU1BQUFBZkFDQUJBQUFnQURBQ0FBQWhBQ0FCQUFBQUN3QWdBUUFBQUFzQUlBTUFBQUFKQUNBQkFBQUtBREFDQUFBTEFDQURBQUFBQ1FBZ0FRQUFDZ0F3QWdBQUN3QWdBd0FBQUFrQUlBRUFBQW9BTUFJQUFBc0FJQXdIQUFDT0JRQWdDQUFBM0FRQUlBb0FBTjBFQUNEaUFRRUFBQUFCNHdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN1QWdLQUFrQUFBQUFCcWdKQUFBQUFBYXNDQWdBQUFBR3NBaEFBQUFBQkFSd0FBRzRBSUFuaUFRRUFBQUFCNHdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN1QWdLQUFrQUFBQUFCcWdKQUFBQUFBYXNDQWdBQUFBR3NBaEFBQUFBQkFSd0FBSEFBTUFFY0FBQndBREFNQndBQWpBVUFJQWdBQU13RUFDQUtBQUROQkFBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVRQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQXlnU3VBaUtBQWtBQXZRTUFJYW9DUUFDOUF3QWhxd0lDQU0wREFDR3NBaEFBeVFRQUlRSUFBQUFMQUNBY0FBQnpBQ0FKNGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVFCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBeWdTdUFpS0FBa0FBdlFNQUlhb0NRQUM5QXdBaHF3SUNBTTBEQUNHc0FoQUF5UVFBSVFJQUFBQUpBQ0FjQUFCMUFDQUNBQUFBQ1FBZ0hBQUFkUUFnQXdBQUFBc0FJQ01BQUc0QUlDUUFBSE1BSUFFQUFBQUxBQ0FCQUFBQUNRQWdCUVFBQU5NRkFDQXBBQURXQlFBZ0tnQUExUVVBSUVzQUFOUUZBQ0JNQUFEWEJRQWdETjhCQUFDV0F3QXc0QUVBQUh3QUVPRUJBQUNXQXdBdzRnRUJBTThDQUNIakFRRUF6d0lBSWVRQkFRRFBBZ0FoNVFGQUFOQUNBQ0g2QVFBQWx3T3VBaUtBQWtBQTBBSUFJYW9DUUFEUUFnQWhxd0lDQU53Q0FDR3NBaEFBX0FJQUlRTUFBQUFKQUNBQkFBQjdBREFvQUFCOEFDQURBQUFBQ1FBZ0FRQUFDZ0F3QWdBQUN3QWdDUU1BQVBNQ0FDRGZBUUFBbFFNQU1PQUJBQUNDQVFBUTRRRUFBSlVEQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0h4QVFFQUFBQUJnQUpBQVBJQ0FDR0ZBZ0VBQUFBQkFRQUFBSDhBSUFFQUFBQl9BQ0FKQXdBQTh3SUFJTjhCQUFDVkF3QXc0QUVBQUlJQkFCRGhBUUFBbFFNQU1PSUJBUURyQWdBaDVRRkFBUElDQUNIeEFRRUE2d0lBSVlBQ1FBRHlBZ0FoaFFJQkFPc0NBQ0VCQXdBQW5RVUFJQU1BQUFDQ0FRQWdBUUFBZ3dFQU1BSUFBSDhBSUFNQUFBQ0NBUUFnQVFBQWd3RUFNQUlBQUg4QUlBTUFBQUNDQVFBZ0FRQUFnd0VBTUFJQUFIOEFJQVlEQUFEU0JRQWc0Z0VCQUFBQUFlVUJRQUFBQUFIeEFRRUFBQUFCZ0FKQUFBQUFBWVVDQVFBQUFBRUJIQUFBaHdFQUlBWGlBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUdBQWtBQUFBQUJoUUlCQUFBQUFRRWNBQUNKQVFBd0FSd0FBSWtCQURBR0F3QUF5QVVBSU9JQkFRQzhBd0FoNVFGQUFMMERBQ0h4QVFFQXZBTUFJWUFDUUFDOUF3QWhoUUlCQUx3REFDRUNBQUFBZndBZ0hBQUFqQUVBSUFYaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0dBQWtBQXZRTUFJWVVDQVFDOEF3QWhBZ0FBQUlJQkFDQWNBQUNPQVFBZ0FnQUFBSUlCQUNBY0FBQ09BUUFnQXdBQUFIOEFJQ01BQUljQkFDQWtBQUNNQVFBZ0FRQUFBSDhBSUFFQUFBQ0NBUUFnQXdRQUFNVUZBQ0FwQUFESEJRQWdLZ0FBeGdVQUlBamZBUUFBbEFNQU1PQUJBQUNWQVFBUTRRRUFBSlFEQUREaUFRRUF6d0lBSWVVQlFBRFFBZ0FoOFFFQkFNOENBQ0dBQWtBQTBBSUFJWVVDQVFEUEFnQWhBd0FBQUlJQkFDQUJBQUNVQVFBd0tBQUFsUUVBSUFNQUFBQ0NBUUFnQVFBQWd3RUFNQUlBQUg4QUlBdmZBUUFBa3dNQU1PQUJBQUNiQVFBUTRRRUFBSk1EQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0h4QVFFQTZ3SUFJZklCQVFEckFnQWhnQUpBQVBJQ0FDR2xBZ0VBNndJQUlhZ0NBUURyQWdBaHFRSWdBUEFDQUNFQkFBQUFtQUVBSUFFQUFBQ1lBUUFnQzk4QkFBQ1RBd0F3NEFFQUFKc0JBQkRoQVFBQWt3TUFNT0lCQVFEckFnQWg1UUZBQVBJQ0FDSHhBUUVBNndJQUlmSUJBUURyQWdBaGdBSkFBUElDQUNHbEFnRUE2d0lBSWFnQ0FRRHJBZ0FocVFJZ0FQQUNBQ0VBQXdBQUFKc0JBQ0FCQUFDY0FRQXdBZ0FBbUFFQUlBTUFBQUNiQVFBZ0FRQUFuQUVBTUFJQUFKZ0JBQ0FEQUFBQW13RUFJQUVBQUp3QkFEQUNBQUNZQVFBZ0NPSUJBUUFBQUFIbEFVQUFBQUFCOFFFQkFBQUFBZklCQVFBQUFBR0FBa0FBQUFBQnBRSUJBQUFBQWFnQ0FRQUFBQUdwQWlBQUFBQUJBUndBQUtBQkFDQUk0Z0VCQUFBQUFlVUJRQUFBQUFIeEFRRUFBQUFCOGdFQkFBQUFBWUFDUUFBQUFBR2xBZ0VBQUFBQnFBSUJBQUFBQWFrQ0lBQUFBQUVCSEFBQW9nRUFNQUVjQUFDaUFRQXdDT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaGdBSkFBTDBEQUNHbEFnRUF2QU1BSWFnQ0FRQzhBd0FocVFJZ0FNd0RBQ0VDQUFBQW1BRUFJQndBQUtVQkFDQUk0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNHQUFrQUF2UU1BSWFVQ0FRQzhBd0FocUFJQkFMd0RBQ0dwQWlBQXpBTUFJUUlBQUFDYkFRQWdIQUFBcHdFQUlBSUFBQUNiQVFBZ0hBQUFwd0VBSUFNQUFBQ1lBUUFnSXdBQW9BRUFJQ1FBQUtVQkFDQUJBQUFBbUFFQUlBRUFBQUNiQVFBZ0F3UUFBTUlGQUNBcEFBREVCUUFnS2dBQXd3VUFJQXZmQVFBQWtnTUFNT0FCQUFDdUFRQVE0UUVBQUpJREFERGlBUUVBendJQUllVUJRQURRQWdBaDhRRUJBTThDQUNIeUFRRUF6d0lBSVlBQ1FBRFFBZ0FocFFJQkFNOENBQ0dvQWdFQXp3SUFJYWtDSUFEYkFnQWhBd0FBQUpzQkFDQUJBQUN0QVFBd0tBQUFyZ0VBSUFNQUFBQ2JBUUFnQVFBQW5BRUFNQUlBQUpnQkFDQUJBQUFBSmdBZ0FRQUFBQ1lBSUFNQUFBQWtBQ0FCQUFBbEFEQUNBQUFtQUNBREFBQUFKQUFnQVFBQUpRQXdBZ0FBSmdBZ0F3QUFBQ1FBSUFFQUFDVUFNQUlBQUNZQUlBa0hBQURCQlFBZzRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJoQUlCQUFBQUFhUUNBQUFBcEFJQ3BRSUJBQUFBQWFZQ0FRQUFBQUduQWlBQUFBQUJBUndBQUxZQkFDQUk0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCaEFJQkFBQUFBYVFDQUFBQXBBSUNwUUlCQUFBQUFhWUNBUUFBQUFHbkFpQUFBQUFCQVJ3QUFMZ0JBREFCSEFBQXVBRUFNQWtIQUFEQUJRQWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaGhBSUJBTHdEQUNHa0FnQUFpZ1NrQWlLbEFnRUF2QU1BSWFZQ0FRRElBd0FocHdJZ0FNd0RBQ0VDQUFBQUpnQWdIQUFBdXdFQUlBamlBUUVBdkFNQUllTUJBUUM4QXdBaDVRRkFBTDBEQUNHRUFnRUF2QU1BSWFRQ0FBQ0tCS1FDSXFVQ0FRQzhBd0FocGdJQkFNZ0RBQ0duQWlBQXpBTUFJUUlBQUFBa0FDQWNBQUM5QVFBZ0FnQUFBQ1FBSUJ3QUFMMEJBQ0FEQUFBQUpnQWdJd0FBdGdFQUlDUUFBTHNCQUNBQkFBQUFKZ0FnQVFBQUFDUUFJQVFFQUFDOUJRQWdLUUFBdndVQUlDb0FBTDRGQUNDbUFnQUF3Z01BSUF2ZkFRQUFqZ01BTU9BQkFBREVBUUFRNFFFQUFJNERBRERpQVFFQXp3SUFJZU1CQVFEUEFnQWg1UUZBQU5BQ0FDR0VBZ0VBendJQUlhUUNBQUNQQTZRQ0lxVUNBUURQQWdBaHBnSUJBTmNDQUNHbkFpQUEyd0lBSVFNQUFBQWtBQ0FCQUFEREFRQXdLQUFBeEFFQUlBTUFBQUFrQUNBQkFBQWxBREFDQUFBbUFDQUJBQUFBRHdBZ0FRQUFBQThBSUFNQUFBQU5BQ0FCQUFBT0FEQUNBQUFQQUNBREFBQUFEUUFnQVFBQURnQXdBZ0FBRHdBZ0F3QUFBQTBBSUFFQUFBNEFNQUlBQUE4QUlCRUpBQUM4QlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFKd0NBb0FDUUFBQUFBR1dBZ0VBQUFBQmx3SUJBQUFBQVpnQ0FRQUFBQUdaQWhBQUFBQUJtZ0lCQUFBQUFad0NBUUFBQUFHZEFnRUFBQUFCbmdJQkFBQUFBWjhDQVFBQUFBR2dBa0FBQUFBQm9RSUJBQUFBQWFJQ1FBQUFBQUVCSEFBQXpBRUFJQkRpQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBbkFJQ2dBSkFBQUFBQVpZQ0FRQUFBQUdYQWdFQUFBQUJtQUlCQUFBQUFaa0NFQUFBQUFHYUFnRUFBQUFCbkFJQkFBQUFBWjBDQVFBQUFBR2VBZ0VBQUFBQm53SUJBQUFBQWFBQ1FBQUFBQUdoQWdFQUFBQUJvZ0pBQUFBQUFRRWNBQURPQVFBd0FSd0FBTTRCQURBUkNRQUF1d1VBSU9JQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTJBU2NBaUtBQWtBQXZRTUFJWllDQVFDOEF3QWhsd0lCQUx3REFDR1lBZ0VBeUFNQUlaa0NFQURKQkFBaG1nSUJBTHdEQUNHY0FnRUF5QU1BSVowQ0FRRElBd0FobmdJQkFNZ0RBQ0dmQWdFQXlBTUFJYUFDUUFEZ0F3QWhvUUlCQU1nREFDR2lBa0FBNEFNQUlRSUFBQUFQQUNBY0FBRFJBUUFnRU9JQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTJBU2NBaUtBQWtBQXZRTUFJWllDQVFDOEF3QWhsd0lCQUx3REFDR1lBZ0VBeUFNQUlaa0NFQURKQkFBaG1nSUJBTHdEQUNHY0FnRUF5QU1BSVowQ0FRRElBd0FobmdJQkFNZ0RBQ0dmQWdFQXlBTUFJYUFDUUFEZ0F3QWhvUUlCQU1nREFDR2lBa0FBNEFNQUlRSUFBQUFOQUNBY0FBRFRBUUFnQWdBQUFBMEFJQndBQU5NQkFDQURBQUFBRHdBZ0l3QUF6QUVBSUNRQUFORUJBQ0FCQUFBQUR3QWdBUUFBQUEwQUlBMEVBQUMyQlFBZ0tRQUF1UVVBSUNvQUFMZ0ZBQ0JMQUFDM0JRQWdUQUFBdWdVQUlKZ0NBQURDQXdBZ25BSUFBTUlEQUNDZEFnQUF3Z01BSUo0Q0FBRENBd0FnbndJQUFNSURBQ0NnQWdBQXdnTUFJS0VDQUFEQ0F3QWdvZ0lBQU1JREFDQVQzd0VBQUlvREFERGdBUUFBMmdFQUVPRUJBQUNLQXdBdzRnRUJBTThDQUNIbEFVQUEwQUlBSWZvQkFBQ0xBNXdDSW9BQ1FBRFFBZ0FobGdJQkFNOENBQ0dYQWdFQXp3SUFJWmdDQVFEWEFnQWhtUUlRQVB3Q0FDR2FBZ0VBendJQUlad0NBUURYQWdBaG5RSUJBTmNDQUNHZUFnRUExd0lBSVo4Q0FRRFhBZ0Fob0FKQUFJY0RBQ0doQWdFQTF3SUFJYUlDUUFDSEF3QWhBd0FBQUEwQUlBRUFBTmtCQURBb0FBRGFBUUFnQXdBQUFBMEFJQUVBQUE0QU1BSUFBQThBSUFFQUFBQXRBQ0FCQUFBQUxRQWdBd0FBQUNzQUlBRUFBQ3dBTUFJQUFDMEFJQU1BQUFBckFDQUJBQUFzQURBQ0FBQXRBQ0FEQUFBQUt3QWdBUUFBTEFBd0FnQUFMUUFnQndjQUFMVUZBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFHVEFnRUFBQUFCbEFKQUFBQUFBWlVDUUFBQUFBRUJIQUFBNGdFQUlBYmlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUdUQWdFQUFBQUJsQUpBQUFBQUFaVUNRQUFBQUFFQkhBQUE1QUVBTUFFY0FBRGtBUUF3QndjQUFMUUZBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDR1RBZ0VBdkFNQUlaUUNRQUM5QXdBaGxRSkFBT0FEQUNFQ0FBQUFMUUFnSEFBQTV3RUFJQWJpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDR1RBZ0VBdkFNQUlaUUNRQUM5QXdBaGxRSkFBT0FEQUNFQ0FBQUFLd0FnSEFBQTZRRUFJQUlBQUFBckFDQWNBQURwQVFBZ0F3QUFBQzBBSUNNQUFPSUJBQ0FrQUFEbkFRQWdBUUFBQUMwQUlBRUFBQUFyQUNBRUJBQUFzUVVBSUNrQUFMTUZBQ0FxQUFDeUJRQWdsUUlBQU1JREFDQUozd0VBQUlZREFERGdBUUFBOEFFQUVPRUJBQUNHQXdBdzRnRUJBTThDQUNIakFRRUF6d0lBSWVVQlFBRFFBZ0Foa3dJQkFNOENBQ0dVQWtBQTBBSUFJWlVDUUFDSEF3QWhBd0FBQUNzQUlBRUFBTzhCQURBb0FBRHdBUUFnQXdBQUFDc0FJQUVBQUN3QU1BSUFBQzBBSUFFQUFBQVVBQ0FCQUFBQUZBQWdBd0FBQUJJQUlBRUFBQk1BTUFJQUFCUUFJQU1BQUFBU0FDQUJBQUFUQURBQ0FBQVVBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnQ2djQUFJTUZBQ0FJQUFDLUJBQWc0Z0VCQUFBQUFlTUJBUUFBQUFIa0FRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQmlnSUNBQUFBQVpJQ0FRQUFBQUVCSEFBQS1BRUFJQWppQVFFQUFBQUI0d0VCQUFBQUFlUUJBUUFBQUFIbEFVQUFBQUFCX2dFZ0FBQUFBWUFDUUFBQUFBR0tBZ0lBQUFBQmtnSUJBQUFBQVFFY0FBRDZBUUF3QVJ3QUFQb0JBREFLQndBQWdRVUFJQWdBQUx3RUFDRGlBUUVBdkFNQUllTUJBUUM4QXdBaDVBRUJBTHdEQUNIbEFVQUF2UU1BSWY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dLQWdJQXpRTUFJWklDQVFDOEF3QWhBZ0FBQUJRQUlCd0FBUDBCQUNBSTRnRUJBTHdEQUNIakFRRUF2QU1BSWVRQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhpZ0lDQU0wREFDR1NBZ0VBdkFNQUlRSUFBQUFTQUNBY0FBRF9BUUFnQWdBQUFCSUFJQndBQVA4QkFDQURBQUFBRkFBZ0l3QUEtQUVBSUNRQUFQMEJBQ0FCQUFBQUZBQWdBUUFBQUJJQUlBVUVBQUNzQlFBZ0tRQUFyd1VBSUNvQUFLNEZBQ0JMQUFDdEJRQWdUQUFBc0FVQUlBdmZBUUFBaFFNQU1PQUJBQUNHQWdBUTRRRUFBSVVEQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNUFFQkFNOENBQ0hsQVVBQTBBSUFJZjRCSUFEYkFnQWhnQUpBQU5BQ0FDR0tBZ0lBM0FJQUlaSUNBUURQQWdBaEF3QUFBQklBSUFFQUFJVUNBREFvQUFDR0FnQWdBd0FBQUJJQUlBRUFBQk1BTUFJQUFCUUFJQUVBQUFBRkFDQUJBQUFBQlFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlBTUFBQUFEQUNBQkFBQUVBREFDQUFBRkFDQURBQUFBQXdBZ0FRQUFCQUF3QWdBQUJRQWdGQVVBQUpFRkFDQUdBQUNyQlFBZ0N3QUFrZ1VBSUF3QUFKTUZBQ0FOQUFDVUJRQWc0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSTBDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDRUFBQUFBR0pBZ0lBQUFBQmlnSUlBQUFBQVlzQ0FBQ1FCUUFnalFJQkFBQUFBWTRDQVFBQUFBRUJIQUFBamdJQUlBX2lBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFqUUlDX2dFZ0FBQUFBWUFDUUFBQUFBR0VBZ0VBQUFBQmhRSUJBQUFBQVlZQ0FRQUFBQUdIQWdFQUFBQUJpQUlRQUFBQUFZa0NBZ0FBQUFHS0FnZ0FBQUFCaXdJQUFKQUZBQ0NOQWdFQUFBQUJqZ0lCQUFBQUFRRWNBQUNRQWdBd0FSd0FBSkFDQURBVUJRQUE3QVFBSUFZQUFLb0ZBQ0FMQUFEdEJBQWdEQUFBN2dRQUlBMEFBTzhFQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFPb0VqUUlpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR0dBZ0VBdkFNQUlZY0NBUUM4QXdBaGlBSVFBTWtFQUNHSkFnSUF6UU1BSVlvQ0NBRG9CQUFoaXdJQUFPa0VBQ0NOQWdFQXZBTUFJWTRDQVFDOEF3QWhBZ0FBQUFVQUlCd0FBSk1DQUNBUDRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBRHFCSTBDSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhoZ0lCQUx3REFDR0hBZ0VBdkFNQUlZZ0NFQURKQkFBaGlRSUNBTTBEQUNHS0FnZ0E2QVFBSVlzQ0FBRHBCQUFnalFJQkFMd0RBQ0dPQWdFQXZBTUFJUUlBQUFBREFDQWNBQUNWQWdBZ0FnQUFBQU1BSUJ3QUFKVUNBQ0FEQUFBQUJRQWdJd0FBamdJQUlDUUFBSk1DQUNBQkFBQUFCUUFnQVFBQUFBTUFJQVVFQUFDbEJRQWdLUUFBcUFVQUlDb0FBS2NGQUNCTEFBQ21CUUFnVEFBQXFRVUFJQkxmQVFBQS13SUFNT0FCQUFDY0FnQVE0UUVBQVBzQ0FERGlBUUVBendJQUllVUJRQURRQWdBaC1nRUFBUDhDalFJaV9nRWdBTnNDQUNHQUFrQUEwQUlBSVlRQ0FRRFBBZ0FoaFFJQkFNOENBQ0dHQWdFQXp3SUFJWWNDQVFEUEFnQWhpQUlRQVB3Q0FDR0pBZ0lBM0FJQUlZb0NDQUQ5QWdBaGl3SUFBUDRDQUNDTkFnRUF6d0lBSVk0Q0FRRFBBZ0FoQXdBQUFBTUFJQUVBQUpzQ0FEQW9BQUNjQWdBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlCb0RBQUR6QWdBZ0N3QUE5QUlBSUF3QUFQVUNBQ0FPQUFEMkFnQWdEd0FBOXdJQUlCQUFBUGdDQUNBUkFBRDVBZ0FnRWdBQS1nSUFJTjhCQUFEcUFnQXc0QUVBQUtJQ0FCRGhBUUFBNmdJQU1PSUJBUUFBQUFIbEFVQUE4Z0lBSWZFQkFRRHJBZ0FoOGdFQkFBQUFBZk1CQVFEc0FnQWg5QUVCQUFBQUFmVUJBUURzQWdBaDlnRUJBT3dDQUNINEFRQUE3UUw0QVNMNkFRQUE3Z0w2QVNMOEFRQUE3d0w4QVNMOUFTQUE4QUlBSWY0QklBRHdBZ0FoX3dFQ0FQRUNBQ0dBQWtBQThnSUFJUUVBQUFDZkFnQWdBUUFBQUo4Q0FDQWFBd0FBOHdJQUlBc0FBUFFDQUNBTUFBRDFBZ0FnRGdBQTlnSUFJQThBQVBjQ0FDQVFBQUQ0QWdBZ0VRQUEtUUlBSUJJQUFQb0NBQ0RmQVFBQTZnSUFNT0FCQUFDaUFnQVE0UUVBQU9vQ0FERGlBUUVBNndJQUllVUJRQUR5QWdBaDhRRUJBT3NDQUNIeUFRRUE2d0lBSWZNQkFRRHNBZ0FoOUFFQkFPd0NBQ0gxQVFFQTdBSUFJZllCQVFEc0FnQWgtQUVBQU8wQy1BRWktZ0VBQU80Qy1nRWlfQUVBQU84Q19BRWlfUUVnQVBBQ0FDSC1BU0FBOEFJQUlmOEJBZ0R4QWdBaGdBSkFBUElDQUNFTUF3QUFuUVVBSUFzQUFKNEZBQ0FNQUFDZkJRQWdEZ0FBb0FVQUlBOEFBS0VGQUNBUUFBQ2lCUUFnRVFBQW93VUFJQklBQUtRRkFDRHpBUUFBd2dNQUlQUUJBQURDQXdBZzlRRUFBTUlEQUNEMkFRQUF3Z01BSUFNQUFBQ2lBZ0FnQVFBQW93SUFNQUlBQUo4Q0FDQURBQUFBb2dJQUlBRUFBS01DQURBQ0FBQ2ZBZ0FnQXdBQUFLSUNBQ0FCQUFDakFnQXdBZ0FBbndJQUlCY0RBQUNWQlFBZ0N3QUFsZ1VBSUF3QUFKY0ZBQ0FPQUFDWUJRQWdEd0FBbVFVQUlCQUFBSm9GQUNBUkFBQ2JCUUFnRWdBQW5BVUFJT0lCQVFBQUFBSGxBVUFBQUFBQjhRRUJBQUFBQWZJQkFRQUFBQUh6QVFFQUFBQUI5QUVCQUFBQUFmVUJBUUFBQUFIMkFRRUFBQUFCLUFFQUFBRDRBUUw2QVFBQUFQb0JBdndCQUFBQV9BRUNfUUVnQUFBQUFmNEJJQUFBQUFIX0FRSUFBQUFCZ0FKQUFBQUFBUUVjQUFDbkFnQWdELUlCQVFBQUFBSGxBVUFBQUFBQjhRRUJBQUFBQWZJQkFRQUFBQUh6QVFFQUFBQUI5QUVCQUFBQUFmVUJBUUFBQUFIMkFRRUFBQUFCLUFFQUFBRDRBUUw2QVFBQUFQb0JBdndCQUFBQV9BRUNfUUVnQUFBQUFmNEJJQUFBQUFIX0FRSUFBQUFCZ0FKQUFBQUFBUUVjQUFDcEFnQXdBUndBQUtrQ0FEQVhBd0FBemdNQUlBc0FBTThEQUNBTUFBRFFBd0FnRGdBQTBRTUFJQThBQU5JREFDQVFBQURUQXdBZ0VRQUExQU1BSUJJQUFOVURBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDSHlBUUVBdkFNQUlmTUJBUURJQXdBaDlBRUJBTWdEQUNIMUFRRUF5QU1BSWZZQkFRRElBd0FoLUFFQUFNa0QtQUVpLWdFQUFNb0QtZ0VpX0FFQUFNc0RfQUVpX1FFZ0FNd0RBQ0gtQVNBQXpBTUFJZjhCQWdETkF3QWhnQUpBQUwwREFDRUNBQUFBbndJQUlCd0FBS3dDQUNBUDRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoOGdFQkFMd0RBQ0h6QVFFQXlBTUFJZlFCQVFESUF3QWg5UUVCQU1nREFDSDJBUUVBeUFNQUlmZ0JBQURKQV9nQkl2b0JBQURLQV9vQkl2d0JBQURMQV93Qkl2MEJJQURNQXdBaF9nRWdBTXdEQUNIX0FRSUF6UU1BSVlBQ1FBQzlBd0FoQWdBQUFLSUNBQ0FjQUFDdUFnQWdBZ0FBQUtJQ0FDQWNBQUN1QWdBZ0F3QUFBSjhDQUNBakFBQ25BZ0FnSkFBQXJBSUFJQUVBQUFDZkFnQWdBUUFBQUtJQ0FDQUpCQUFBd3dNQUlDa0FBTVlEQUNBcUFBREZBd0FnU3dBQXhBTUFJRXdBQU1jREFDRHpBUUFBd2dNQUlQUUJBQURDQXdBZzlRRUFBTUlEQUNEMkFRQUF3Z01BSUJMZkFRQUExZ0lBTU9BQkFBQzFBZ0FRNFFFQUFOWUNBRERpQVFFQXp3SUFJZVVCUUFEUUFnQWg4UUVCQU04Q0FDSHlBUUVBendJQUlmTUJBUURYQWdBaDlBRUJBTmNDQUNIMUFRRUExd0lBSWZZQkFRRFhBZ0FoLUFFQUFOZ0MtQUVpLWdFQUFOa0MtZ0VpX0FFQUFOb0NfQUVpX1FFZ0FOc0NBQ0gtQVNBQTJ3SUFJZjhCQWdEY0FnQWhnQUpBQU5BQ0FDRURBQUFBb2dJQUlBRUFBTFFDQURBb0FBQzFBZ0FnQXdBQUFLSUNBQ0FCQUFDakFnQXdBZ0FBbndJQUlBRUFBQUFZQUNBQkFBQUFHQUFnQXdBQUFCWUFJQUVBQUJjQU1BSUFBQmdBSUFNQUFBQVdBQ0FCQUFBWEFEQUNBQUFZQUNBREFBQUFGZ0FnQVFBQUZ3QXdBZ0FBR0FBZ0JnY0FBTUFEQUNBSUFBREJBd0FnNGdFQkFBQUFBZU1CQVFBQUFBSGtBUUVBQUFBQjVRRkFBQUFBQVFFY0FBQzlBZ0FnQk9JQkFRQUFBQUhqQVFFQUFBQUI1QUVCQUFBQUFlVUJRQUFBQUFFQkhBQUF2d0lBTUFFY0FBQ19BZ0F3QmdjQUFMNERBQ0FJQUFDX0F3QWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNFQ0FBQUFHQUFnSEFBQXdnSUFJQVRpQVFFQXZBTUFJZU1CQVFDOEF3QWg1QUVCQUx3REFDSGxBVUFBdlFNQUlRSUFBQUFXQUNBY0FBREVBZ0FnQWdBQUFCWUFJQndBQU1RQ0FDQURBQUFBR0FBZ0l3QUF2UUlBSUNRQUFNSUNBQ0FCQUFBQUdBQWdBUUFBQUJZQUlBTUVBQUM1QXdBZ0tRQUF1d01BSUNvQUFMb0RBQ0FIM3dFQUFNNENBRERnQVFBQXl3SUFFT0VCQUFET0FnQXc0Z0VCQU04Q0FDSGpBUUVBendJQUllUUJBUURQQWdBaDVRRkFBTkFDQUNFREFBQUFGZ0FnQVFBQXlnSUFNQ2dBQU1zQ0FDQURBQUFBRmdBZ0FRQUFGd0F3QWdBQUdBQWdCOThCQUFET0FnQXc0QUVBQU1zQ0FCRGhBUUFBemdJQU1PSUJBUURQQWdBaDR3RUJBTThDQUNIa0FRRUF6d0lBSWVVQlFBRFFBZ0FoRGdRQUFOSUNBQ0FwQUFEVkFnQWdLZ0FBMVFJQUlPWUJBUUFBQUFIbkFRRUFBQUFFNkFFQkFBQUFCT2tCQVFBQUFBSHFBUUVBQUFBQjZ3RUJBQUFBQWV3QkFRQUFBQUh0QVFFQTFBSUFJZTRCQVFBQUFBSHZBUUVBQUFBQjhBRUJBQUFBQVFzRUFBRFNBZ0FnS1FBQTB3SUFJQ29BQU5NQ0FDRG1BVUFBQUFBQjV3RkFBQUFBQk9nQlFBQUFBQVRwQVVBQUFBQUI2Z0ZBQUFBQUFlc0JRQUFBQUFIc0FVQUFBQUFCN1FGQUFORUNBQ0VMQkFBQTBnSUFJQ2tBQU5NQ0FDQXFBQURUQWdBZzVnRkFBQUFBQWVjQlFBQUFBQVRvQVVBQUFBQUU2UUZBQUFBQUFlb0JRQUFBQUFIckFVQUFBQUFCN0FGQUFBQUFBZTBCUUFEUkFnQWhDT1lCQWdBQUFBSG5BUUlBQUFBRTZBRUNBQUFBQk9rQkFnQUFBQUhxQVFJQUFBQUI2d0VDQUFBQUFld0JBZ0FBQUFIdEFRSUEwZ0lBSVFqbUFVQUFBQUFCNXdGQUFBQUFCT2dCUUFBQUFBVHBBVUFBQUFBQjZnRkFBQUFBQWVzQlFBQUFBQUhzQVVBQUFBQUI3UUZBQU5NQ0FDRU9CQUFBMGdJQUlDa0FBTlVDQUNBcUFBRFZBZ0FnNWdFQkFBQUFBZWNCQVFBQUFBVG9BUUVBQUFBRTZRRUJBQUFBQWVvQkFRQUFBQUhyQVFFQUFBQUI3QUVCQUFBQUFlMEJBUURVQWdBaDdnRUJBQUFBQWU4QkFRQUFBQUh3QVFFQUFBQUJDLVlCQVFBQUFBSG5BUUVBQUFBRTZBRUJBQUFBQk9rQkFRQUFBQUhxQVFFQUFBQUI2d0VCQUFBQUFld0JBUUFBQUFIdEFRRUExUUlBSWU0QkFRQUFBQUh2QVFFQUFBQUI4QUVCQUFBQUFSTGZBUUFBMWdJQU1PQUJBQUMxQWdBUTRRRUFBTllDQUREaUFRRUF6d0lBSWVVQlFBRFFBZ0FoOFFFQkFNOENBQ0h5QVFFQXp3SUFJZk1CQVFEWEFnQWg5QUVCQU5jQ0FDSDFBUUVBMXdJQUlmWUJBUURYQWdBaC1BRUFBTmdDLUFFaS1nRUFBTmtDLWdFaV9BRUFBTm9DX0FFaV9RRWdBTnNDQUNILUFTQUEyd0lBSWY4QkFnRGNBZ0FoZ0FKQUFOQUNBQ0VPQkFBQTZBSUFJQ2tBQU9rQ0FDQXFBQURwQWdBZzVnRUJBQUFBQWVjQkFRQUFBQVhvQVFFQUFBQUY2UUVCQUFBQUFlb0JBUUFBQUFIckFRRUFBQUFCN0FFQkFBQUFBZTBCQVFEbkFnQWg3Z0VCQUFBQUFlOEJBUUFBQUFId0FRRUFBQUFCQndRQUFOSUNBQ0FwQUFEbUFnQWdLZ0FBNWdJQUlPWUJBQUFBLUFFQzV3RUFBQUQ0QVFqb0FRQUFBUGdCQ08wQkFBRGxBdmdCSWdjRUFBRFNBZ0FnS1FBQTVBSUFJQ29BQU9RQ0FDRG1BUUFBQVBvQkF1Y0JBQUFBLWdFSTZBRUFBQUQ2QVFqdEFRQUE0d0w2QVNJSEJBQUEwZ0lBSUNrQUFPSUNBQ0FxQUFEaUFnQWc1Z0VBQUFEOEFRTG5BUUFBQVB3QkNPZ0JBQUFBX0FFSTdRRUFBT0VDX0FFaUJRUUFBTklDQUNBcEFBRGdBZ0FnS2dBQTRBSUFJT1lCSUFBQUFBSHRBU0FBM3dJQUlRMEVBQURTQWdBZ0tRQUEwZ0lBSUNvQUFOSUNBQ0JMQUFEZUFnQWdUQUFBMGdJQUlPWUJBZ0FBQUFIbkFRSUFBQUFFNkFFQ0FBQUFCT2tCQWdBQUFBSHFBUUlBQUFBQjZ3RUNBQUFBQWV3QkFnQUFBQUh0QVFJQTNRSUFJUTBFQUFEU0FnQWdLUUFBMGdJQUlDb0FBTklDQUNCTEFBRGVBZ0FnVEFBQTBnSUFJT1lCQWdBQUFBSG5BUUlBQUFBRTZBRUNBQUFBQk9rQkFnQUFBQUhxQVFJQUFBQUI2d0VDQUFBQUFld0JBZ0FBQUFIdEFRSUEzUUlBSVFqbUFRZ0FBQUFCNXdFSUFBQUFCT2dCQ0FBQUFBVHBBUWdBQUFBQjZnRUlBQUFBQWVzQkNBQUFBQUhzQVFnQUFBQUI3UUVJQU40Q0FDRUZCQUFBMGdJQUlDa0FBT0FDQUNBcUFBRGdBZ0FnNWdFZ0FBQUFBZTBCSUFEZkFnQWhBdVlCSUFBQUFBSHRBU0FBNEFJQUlRY0VBQURTQWdBZ0tRQUE0Z0lBSUNvQUFPSUNBQ0RtQVFBQUFQd0JBdWNCQUFBQV9BRUk2QUVBQUFEOEFRanRBUUFBNFFMOEFTSUU1Z0VBQUFEOEFRTG5BUUFBQVB3QkNPZ0JBQUFBX0FFSTdRRUFBT0lDX0FFaUJ3UUFBTklDQUNBcEFBRGtBZ0FnS2dBQTVBSUFJT1lCQUFBQS1nRUM1d0VBQUFENkFRam9BUUFBQVBvQkNPMEJBQURqQXZvQklnVG1BUUFBQVBvQkF1Y0JBQUFBLWdFSTZBRUFBQUQ2QVFqdEFRQUE1QUw2QVNJSEJBQUEwZ0lBSUNrQUFPWUNBQ0FxQUFEbUFnQWc1Z0VBQUFENEFRTG5BUUFBQVBnQkNPZ0JBQUFBLUFFSTdRRUFBT1VDLUFFaUJPWUJBQUFBLUFFQzV3RUFBQUQ0QVFqb0FRQUFBUGdCQ08wQkFBRG1BdmdCSWc0RUFBRG9BZ0FnS1FBQTZRSUFJQ29BQU9rQ0FDRG1BUUVBQUFBQjV3RUJBQUFBQmVnQkFRQUFBQVhwQVFFQUFBQUI2Z0VCQUFBQUFlc0JBUUFBQUFIc0FRRUFBQUFCN1FFQkFPY0NBQ0h1QVFFQUFBQUI3d0VCQUFBQUFmQUJBUUFBQUFFSTVnRUNBQUFBQWVjQkFnQUFBQVhvQVFJQUFBQUY2UUVDQUFBQUFlb0JBZ0FBQUFIckFRSUFBQUFCN0FFQ0FBQUFBZTBCQWdEb0FnQWhDLVlCQVFBQUFBSG5BUUVBQUFBRjZBRUJBQUFBQmVrQkFRQUFBQUhxQVFFQUFBQUI2d0VCQUFBQUFld0JBUUFBQUFIdEFRRUE2UUlBSWU0QkFRQUFBQUh2QVFFQUFBQUI4QUVCQUFBQUFSb0RBQUR6QWdBZ0N3QUE5QUlBSUF3QUFQVUNBQ0FPQUFEMkFnQWdEd0FBOXdJQUlCQUFBUGdDQUNBUkFBRDVBZ0FnRWdBQS1nSUFJTjhCQUFEcUFnQXc0QUVBQUtJQ0FCRGhBUUFBNmdJQU1PSUJBUURyQWdBaDVRRkFBUElDQUNIeEFRRUE2d0lBSWZJQkFRRHJBZ0FoOHdFQkFPd0NBQ0gwQVFFQTdBSUFJZlVCQVFEc0FnQWg5Z0VCQU93Q0FDSDRBUUFBN1FMNEFTTDZBUUFBN2dMNkFTTDhBUUFBN3dMOEFTTDlBU0FBOEFJQUlmNEJJQUR3QWdBaF93RUNBUEVDQUNHQUFrQUE4Z0lBSVF2bUFRRUFBQUFCNXdFQkFBQUFCT2dCQVFBQUFBVHBBUUVBQUFBQjZnRUJBQUFBQWVzQkFRQUFBQUhzQVFFQUFBQUI3UUVCQU5VQ0FDSHVBUUVBQUFBQjd3RUJBQUFBQWZBQkFRQUFBQUVMNWdFQkFBQUFBZWNCQVFBQUFBWG9BUUVBQUFBRjZRRUJBQUFBQWVvQkFRQUFBQUhyQVFFQUFBQUI3QUVCQUFBQUFlMEJBUURwQWdBaDdnRUJBQUFBQWU4QkFRQUFBQUh3QVFFQUFBQUJCT1lCQUFBQS1BRUM1d0VBQUFENEFRam9BUUFBQVBnQkNPMEJBQURtQXZnQklnVG1BUUFBQVBvQkF1Y0JBQUFBLWdFSTZBRUFBQUQ2QVFqdEFRQUE1QUw2QVNJRTVnRUFBQUQ4QVFMbkFRQUFBUHdCQ09nQkFBQUFfQUVJN1FFQUFPSUNfQUVpQXVZQklBQUFBQUh0QVNBQTRBSUFJUWptQVFJQUFBQUI1d0VDQUFBQUJPZ0JBZ0FBQUFUcEFRSUFBQUFCNmdFQ0FBQUFBZXNCQWdBQUFBSHNBUUlBQUFBQjdRRUNBTklDQUNFSTVnRkFBQUFBQWVjQlFBQUFBQVRvQVVBQUFBQUU2UUZBQUFBQUFlb0JRQUFBQUFIckFVQUFBQUFCN0FGQUFBQUFBZTBCUUFEVEFnQWhBNEVDQUFBREFDQ0NBZ0FBQXdBZ2d3SUFBQU1BSUFPQkFnQUFDUUFnZ2dJQUFBa0FJSU1DQUFBSkFDQURnUUlBQUJJQUlJSUNBQUFTQUNDREFnQUFFZ0FnQTRFQ0FBQWZBQ0NDQWdBQUh3QWdnd0lBQUI4QUlBT0JBZ0FBRmdBZ2dnSUFBQllBSUlNQ0FBQVdBQ0FEZ1FJQUFDUUFJSUlDQUFBa0FDQ0RBZ0FBSkFBZ0E0RUNBQUFvQUNDQ0FnQUFLQUFnZ3dJQUFDZ0FJQU9CQWdBQUt3QWdnZ0lBQUNzQUlJTUNBQUFyQUNBUzN3RUFBUHNDQUREZ0FRQUFuQUlBRU9FQkFBRDdBZ0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZm9CQUFEX0FvMENJdjRCSUFEYkFnQWhnQUpBQU5BQ0FDR0VBZ0VBendJQUlZVUNBUURQQWdBaGhnSUJBTThDQUNHSEFnRUF6d0lBSVlnQ0VBRDhBZ0FoaVFJQ0FOd0NBQ0dLQWdnQV9RSUFJWXNDQUFELUFnQWdqUUlCQU04Q0FDR09BZ0VBendJQUlRMEVBQURTQWdBZ0tRQUFoQU1BSUNvQUFJUURBQ0JMQUFDRUF3QWdUQUFBaEFNQUlPWUJFQUFBQUFIbkFSQUFBQUFFNkFFUUFBQUFCT2tCRUFBQUFBSHFBUkFBQUFBQjZ3RVFBQUFBQWV3QkVBQUFBQUh0QVJBQWd3TUFJUTBFQUFEU0FnQWdLUUFBM2dJQUlDb0FBTjRDQUNCTEFBRGVBZ0FnVEFBQTNnSUFJT1lCQ0FBQUFBSG5BUWdBQUFBRTZBRUlBQUFBQk9rQkNBQUFBQUhxQVFnQUFBQUI2d0VJQUFBQUFld0JDQUFBQUFIdEFRZ0FnZ01BSVFUbUFRRUFBQUFGandJQkFBQUFBWkFDQVFBQUFBU1JBZ0VBQUFBRUJ3UUFBTklDQUNBcEFBQ0JBd0FnS2dBQWdRTUFJT1lCQUFBQWpRSUM1d0VBQUFDTkFnam9BUUFBQUkwQ0NPMEJBQUNBQTQwQ0lnY0VBQURTQWdBZ0tRQUFnUU1BSUNvQUFJRURBQ0RtQVFBQUFJMENBdWNCQUFBQWpRSUk2QUVBQUFDTkFnanRBUUFBZ0FPTkFpSUU1Z0VBQUFDTkFnTG5BUUFBQUkwQ0NPZ0JBQUFBalFJSTdRRUFBSUVEalFJaURRUUFBTklDQUNBcEFBRGVBZ0FnS2dBQTNnSUFJRXNBQU40Q0FDQk1BQURlQWdBZzVnRUlBQUFBQWVjQkNBQUFBQVRvQVFnQUFBQUU2UUVJQUFBQUFlb0JDQUFBQUFIckFRZ0FBQUFCN0FFSUFBQUFBZTBCQ0FDQ0F3QWhEUVFBQU5JQ0FDQXBBQUNFQXdBZ0tnQUFoQU1BSUVzQUFJUURBQ0JNQUFDRUF3QWc1Z0VRQUFBQUFlY0JFQUFBQUFUb0FSQUFBQUFFNlFFUUFBQUFBZW9CRUFBQUFBSHJBUkFBQUFBQjdBRVFBQUFBQWUwQkVBQ0RBd0FoQ09ZQkVBQUFBQUhuQVJBQUFBQUU2QUVRQUFBQUJPa0JFQUFBQUFIcUFSQUFBQUFCNndFUUFBQUFBZXdCRUFBQUFBSHRBUkFBaEFNQUlRdmZBUUFBaFFNQU1PQUJBQUNHQWdBUTRRRUFBSVVEQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNUFFQkFNOENBQ0hsQVVBQTBBSUFJZjRCSUFEYkFnQWhnQUpBQU5BQ0FDR0tBZ0lBM0FJQUlaSUNBUURQQWdBaENkOEJBQUNHQXdBdzRBRUFBUEFCQUJEaEFRQUFoZ01BTU9JQkFRRFBBZ0FoNHdFQkFNOENBQ0hsQVVBQTBBSUFJWk1DQVFEUEFnQWhsQUpBQU5BQ0FDR1ZBa0FBaHdNQUlRc0VBQURvQWdBZ0tRQUFpUU1BSUNvQUFJa0RBQ0RtQVVBQUFBQUI1d0ZBQUFBQUJlZ0JRQUFBQUFYcEFVQUFBQUFCNmdGQUFBQUFBZXNCUUFBQUFBSHNBVUFBQUFBQjdRRkFBSWdEQUNFTEJBQUE2QUlBSUNrQUFJa0RBQ0FxQUFDSkF3QWc1Z0ZBQUFBQUFlY0JRQUFBQUFYb0FVQUFBQUFGNlFGQUFBQUFBZW9CUUFBQUFBSHJBVUFBQUFBQjdBRkFBQUFBQWUwQlFBQ0lBd0FoQ09ZQlFBQUFBQUhuQVVBQUFBQUY2QUZBQUFBQUJla0JRQUFBQUFIcUFVQUFBQUFCNndGQUFBQUFBZXdCUUFBQUFBSHRBVUFBaVFNQUlSUGZBUUFBaWdNQU1PQUJBQURhQVFBUTRRRUFBSW9EQUREaUFRRUF6d0lBSWVVQlFBRFFBZ0FoLWdFQUFJc0RuQUlpZ0FKQUFOQUNBQ0dXQWdFQXp3SUFJWmNDQVFEUEFnQWhtQUlCQU5jQ0FDR1pBaEFBX0FJQUlab0NBUURQQWdBaG5BSUJBTmNDQUNHZEFnRUExd0lBSVo0Q0FRRFhBZ0FobndJQkFOY0NBQ0dnQWtBQWh3TUFJYUVDQVFEWEFnQWhvZ0pBQUljREFDRUhCQUFBMGdJQUlDa0FBSTBEQUNBcUFBQ05Bd0FnNWdFQUFBQ2NBZ0xuQVFBQUFKd0NDT2dCQUFBQW5BSUk3UUVBQUl3RG5BSWlCd1FBQU5JQ0FDQXBBQUNOQXdBZ0tnQUFqUU1BSU9ZQkFBQUFuQUlDNXdFQUFBQ2NBZ2pvQVFBQUFKd0NDTzBCQUFDTUE1d0NJZ1RtQVFBQUFKd0NBdWNCQUFBQW5BSUk2QUVBQUFDY0FnanRBUUFBalFPY0FpSUwzd0VBQUk0REFERGdBUUFBeEFFQUVPRUJBQUNPQXdBdzRnRUJBTThDQUNIakFRRUF6d0lBSWVVQlFBRFFBZ0FoaEFJQkFNOENBQ0drQWdBQWp3T2tBaUtsQWdFQXp3SUFJYVlDQVFEWEFnQWhwd0lnQU5zQ0FDRUhCQUFBMGdJQUlDa0FBSkVEQUNBcUFBQ1JBd0FnNWdFQUFBQ2tBZ0xuQVFBQUFLUUNDT2dCQUFBQXBBSUk3UUVBQUpBRHBBSWlCd1FBQU5JQ0FDQXBBQUNSQXdBZ0tnQUFrUU1BSU9ZQkFBQUFwQUlDNXdFQUFBQ2tBZ2pvQVFBQUFLUUNDTzBCQUFDUUE2UUNJZ1RtQVFBQUFLUUNBdWNCQUFBQXBBSUk2QUVBQUFDa0FnanRBUUFBa1FPa0FpSUwzd0VBQUpJREFERGdBUUFBcmdFQUVPRUJBQUNTQXdBdzRnRUJBTThDQUNIbEFVQUEwQUlBSWZFQkFRRFBBZ0FoOGdFQkFNOENBQ0dBQWtBQTBBSUFJYVVDQVFEUEFnQWhxQUlCQU04Q0FDR3BBaUFBMndJQUlRdmZBUUFBa3dNQU1PQUJBQUNiQVFBUTRRRUFBSk1EQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoOFFFQkFPc0NBQ0h5QVFFQTZ3SUFJWUFDUUFEeUFnQWhwUUlCQU9zQ0FDR29BZ0VBNndJQUlha0NJQUR3QWdBaENOOEJBQUNVQXdBdzRBRUFBSlVCQUJEaEFRQUFsQU1BTU9JQkFRRFBBZ0FoNVFGQUFOQUNBQ0h4QVFFQXp3SUFJWUFDUUFEUUFnQWhoUUlCQU04Q0FDRUpBd0FBOHdJQUlOOEJBQUNWQXdBdzRBRUFBSUlCQUJEaEFRQUFsUU1BTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0h4QVFFQTZ3SUFJWUFDUUFEeUFnQWhoUUlCQU9zQ0FDRU0zd0VBQUpZREFERGdBUUFBZkFBUTRRRUFBSllEQUREaUFRRUF6d0lBSWVNQkFRRFBBZ0FoNUFFQkFNOENBQ0hsQVVBQTBBSUFJZm9CQUFDWEE2NENJb0FDUUFEUUFnQWhxZ0pBQU5BQ0FDR3JBZ0lBM0FJQUlhd0NFQUQ4QWdBaEJ3UUFBTklDQUNBcEFBQ1pBd0FnS2dBQW1RTUFJT1lCQUFBQXJnSUM1d0VBQUFDdUFnam9BUUFBQUs0Q0NPMEJBQUNZQTY0Q0lnY0VBQURTQWdBZ0tRQUFtUU1BSUNvQUFKa0RBQ0RtQVFBQUFLNENBdWNCQUFBQXJnSUk2QUVBQUFDdUFnanRBUUFBbUFPdUFpSUU1Z0VBQUFDdUFnTG5BUUFBQUs0Q0NPZ0JBQUFBcmdJSTdRRUFBSmtEcmdJaUR0OEJBQUNhQXdBdzRBRUFBR1lBRU9FQkFBQ2FBd0F3NGdFQkFNOENBQ0hsQVVBQTBBSUFJZm9CQUFDYkE3SUNJdjRCSUFEYkFnQWhnQUpBQU5BQ0FDR0VBZ0VBendJQUlZVUNBUURQQWdBaHJnSUJBTThDQUNHdkFnRUF6d0lBSWJBQ0FRRFBBZ0Foc2dJQkFNOENBQ0VIQkFBQTBnSUFJQ2tBQUowREFDQXFBQUNkQXdBZzVnRUFBQUN5QWdMbkFRQUFBTElDQ09nQkFBQUFzZ0lJN1FFQUFKd0RzZ0lpQndRQUFOSUNBQ0FwQUFDZEF3QWdLZ0FBblFNQUlPWUJBQUFBc2dJQzV3RUFBQUN5QWdqb0FRQUFBTElDQ08wQkFBQ2NBN0lDSWdUbUFRQUFBTElDQXVjQkFBQUFzZ0lJNkFFQUFBQ3lBZ2p0QVFBQW5RT3lBaUlMM3dFQUFKNERBRERnQVFBQVVBQVE0UUVBQUo0REFERGlBUUVBendJQUllTUJBUURQQWdBaDVRRkFBTkFDQUNILUFTQUEyd0lBSVlBQ1FBRFFBZ0FocndJQkFNOENBQ0d6QWdFQXp3SUFJYlFDQVFEWEFnQWhDZ2NBQUtFREFDRGZBUUFBbndNQU1PQUJBQUFyQUJEaEFRQUFud01BTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJWk1DQVFEckFnQWhsQUpBQVBJQ0FDR1ZBa0FBb0FNQUlRam1BVUFBQUFBQjV3RkFBQUFBQmVnQlFBQUFBQVhwQVVBQUFBQUI2Z0ZBQUFBQUFlc0JRQUFBQUFIc0FVQUFBQUFCN1FGQUFJa0RBQ0VjQXdBQTh3SUFJQXNBQVBRQ0FDQU1BQUQxQWdBZ0RnQUE5Z0lBSUE4QUFQY0NBQ0FRQUFENEFnQWdFUUFBLVFJQUlCSUFBUG9DQUNEZkFRQUE2Z0lBTU9BQkFBQ2lBZ0FRNFFFQUFPb0NBRERpQVFFQTZ3SUFJZVVCUUFEeUFnQWg4UUVCQU9zQ0FDSHlBUUVBNndJQUlmTUJBUURzQWdBaDlBRUJBT3dDQUNIMUFRRUE3QUlBSWZZQkFRRHNBZ0FoLUFFQUFPMEMtQUVpLWdFQUFPNEMtZ0VpX0FFQUFPOENfQUVpX1FFZ0FQQUNBQ0gtQVNBQThBSUFJZjhCQWdEeEFnQWhnQUpBQVBJQ0FDRzJBZ0FBb2dJQUlMY0NBQUNpQWdBZ0R3Y0FBS0VEQUNBVUFBQ2pBd0FnRlFBQXBBTUFJQllBQVBrQ0FDRGZBUUFBb2dNQU1PQUJBQUFvQUJEaEFRQUFvZ01BTU9JQkFRRHJBZ0FoNHdFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR3ZBZ0VBNndJQUliTUNBUURyQWdBaHRBSUJBT3dDQUNFU0VRQUEtUUlBSUJNQUFLRURBQ0RmQVFBQXB3TUFNT0FCQUFBZkFCRGhBUUFBcHdNQU1PSUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFxQU95QWlMLUFTQUE4QUlBSVlBQ1FBRHlBZ0FoaEFJQkFPc0NBQ0dGQWdFQTZ3SUFJYTRDQVFEckFnQWhyd0lCQU9zQ0FDR3dBZ0VBNndJQUliSUNBUURyQWdBaHRnSUFBQjhBSUxjQ0FBQWZBQ0FSQndBQW9RTUFJQlFBQUtNREFDQVZBQUNrQXdBZ0ZnQUEtUUlBSU44QkFBQ2lBd0F3NEFFQUFDZ0FFT0VCQUFDaUF3QXc0Z0VCQU9zQ0FDSGpBUUVBNndJQUllVUJRQUR5QWdBaF9nRWdBUEFDQUNHQUFrQUE4Z0lBSWE4Q0FRRHJBZ0Foc3dJQkFPc0NBQ0cwQWdFQTdBSUFJYllDQUFBb0FDQzNBZ0FBS0FBZ0RBY0FBS0VEQUNEZkFRQUFwUU1BTU9BQkFBQWtBQkRoQVFBQXBRTUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlZUUNBUURyQWdBaHBBSUFBS1lEcEFJaXBRSUJBT3NDQUNHbUFnRUE3QUlBSWFjQ0lBRHdBZ0FoQk9ZQkFBQUFwQUlDNXdFQUFBQ2tBZ2pvQVFBQUFLUUNDTzBCQUFDUkE2UUNJaEFSQUFENUFnQWdFd0FBb1FNQUlOOEJBQUNuQXdBdzRBRUFBQjhBRU9FQkFBQ25Bd0F3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDb0E3SUNJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUURyQWdBaHJnSUJBT3NDQUNHdkFnRUE2d0lBSWJBQ0FRRHJBZ0Foc2dJQkFPc0NBQ0VFNWdFQUFBQ3lBZ0xuQVFBQUFMSUNDT2dCQUFBQXNnSUk3UUVBQUowRHNnSWlBdU1CQVFBQUFBSGtBUUVBQUFBQkNRY0FBS0VEQUNBSUFBQ3JBd0FnM3dFQUFLb0RBRERnQVFBQUZnQVE0UUVBQUtvREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSVJrRkFBQzRBd0FnQmdBQW9RTUFJQXNBQVBRQ0FDQU1BQUQxQWdBZ0RRQUE5d0lBSU44QkFBQzFBd0F3NEFFQUFBTUFFT0VCQUFDMUF3QXc0Z0VCQU9zQ0FDSGxBVUFBOGdJQUlmb0JBQUMzQTQwQ0l2NEJJQUR3QWdBaGdBSkFBUElDQUNHRUFnRUE2d0lBSVlVQ0FRRHJBZ0FoaGdJQkFPc0NBQ0dIQWdFQTZ3SUFJWWdDRUFDdkF3QWhpUUlDQVBFQ0FDR0tBZ2dBdGdNQUlZc0NBQUQtQWdBZ2pRSUJBT3NDQUNHT0FnRUE2d0lBSWJZQ0FBQURBQ0MzQWdBQUF3QWdBdU1CQVFBQUFBSGtBUUVBQUFBQkRRY0FBS0VEQUNBSUFBQ3JBd0FnM3dFQUFLMERBRERnQVFBQUVnQVE0UUVBQUswREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0dLQWdJQThRSUFJWklDQVFEckFnQWhGQWtBQUxFREFDRGZBUUFBcmdNQU1PQUJBQUFOQUJEaEFRQUFyZ01BTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0g2QVFBQXNBT2NBaUtBQWtBQThnSUFJWllDQVFEckFnQWhsd0lCQU9zQ0FDR1lBZ0VBN0FJQUlaa0NFQUN2QXdBaG1nSUJBT3NDQUNHY0FnRUE3QUlBSVowQ0FRRHNBZ0FobmdJQkFPd0NBQ0dmQWdFQTdBSUFJYUFDUUFDZ0F3QWhvUUlCQU93Q0FDR2lBa0FBb0FNQUlRam1BUkFBQUFBQjV3RVFBQUFBQk9nQkVBQUFBQVRwQVJBQUFBQUI2Z0VRQUFBQUFlc0JFQUFBQUFIc0FSQUFBQUFCN1FFUUFJUURBQ0VFNWdFQUFBQ2NBZ0xuQVFBQUFKd0NDT2dCQUFBQW5BSUk3UUVBQUkwRG5BSWlFUWNBQUtFREFDQUlBQUNyQXdBZ0NnQUF0QU1BSU44QkFBQ3lBd0F3NEFFQUFBa0FFT0VCQUFDeUF3QXc0Z0VCQU9zQ0FDSGpBUUVBNndJQUllUUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFzd091QWlLQUFrQUE4Z0lBSWFvQ1FBRHlBZ0FocXdJQ0FQRUNBQ0dzQWhBQXJ3TUFJYllDQUFBSkFDQzNBZ0FBQ1FBZ0R3Y0FBS0VEQUNBSUFBQ3JBd0FnQ2dBQXRBTUFJTjhCQUFDeUF3QXc0QUVBQUFrQUVPRUJBQUN5QXdBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVRQkFRRHJBZ0FoNVFGQUFQSUNBQ0g2QVFBQXN3T3VBaUtBQWtBQThnSUFJYW9DUUFEeUFnQWhxd0lDQVBFQ0FDR3NBaEFBcndNQUlRVG1BUUFBQUs0Q0F1Y0JBQUFBcmdJSTZBRUFBQUN1QWdqdEFRQUFtUU91QWlJRGdRSUFBQTBBSUlJQ0FBQU5BQ0NEQWdBQURRQWdGd1VBQUxnREFDQUdBQUNoQXdBZ0N3QUE5QUlBSUF3QUFQVUNBQ0FOQUFEM0FnQWczd0VBQUxVREFERGdBUUFBQXdBUTRRRUFBTFVEQUREaUFRRUE2d0lBSWVVQlFBRHlBZ0FoLWdFQUFMY0RqUUlpX2dFZ0FQQUNBQ0dBQWtBQThnSUFJWVFDQVFEckFnQWhoUUlCQU9zQ0FDR0dBZ0VBNndJQUlZY0NBUURyQWdBaGlBSVFBSzhEQUNHSkFnSUE4UUlBSVlvQ0NBQzJBd0FoaXdJQUFQNENBQ0NOQWdFQTZ3SUFJWTRDQVFEckFnQWhDT1lCQ0FBQUFBSG5BUWdBQUFBRTZBRUlBQUFBQk9rQkNBQUFBQUhxQVFnQUFBQUI2d0VJQUFBQUFld0JDQUFBQUFIdEFRZ0EzZ0lBSVFUbUFRQUFBSTBDQXVjQkFBQUFqUUlJNkFFQUFBQ05BZ2p0QVFBQWdRT05BaUlMQXdBQTh3SUFJTjhCQUFDVkF3QXc0QUVBQUlJQkFCRGhBUUFBbFFNQU1PSUJBUURyQWdBaDVRRkFBUElDQUNIeEFRRUE2d0lBSVlBQ1FBRHlBZ0FoaFFJQkFPc0NBQ0cyQWdBQWdnRUFJTGNDQUFDQ0FRQWdBQUFBQWJzQ0FRQUFBQUVCdXdKQUFBQUFBUVVqQUFDNUJnQWdKQUFBdndZQUlMZ0NBQUM2QmdBZ3VRSUFBTDRHQUNDLUFnQUFud0lBSUFVakFBQzNCZ0FnSkFBQXZBWUFJTGdDQUFDNEJnQWd1UUlBQUxzR0FDQy1BZ0FBQlFBZ0F5TUFBTGtHQUNDNEFnQUF1Z1lBSUw0Q0FBQ2ZBZ0FnQXlNQUFMY0dBQ0M0QWdBQXVBWUFJTDRDQUFBRkFDQUFBQUFBQUFBQnV3SUJBQUFBQVFHN0FnQUFBUGdCQWdHN0FnQUFBUG9CQWdHN0FnQUFBUHdCQWdHN0FpQUFBQUFCQmJzQ0FnQUFBQUhDQWdJQUFBQUJ3d0lDQUFBQUFjUUNBZ0FBQUFIRkFnSUFBQUFCQ3lNQUFONEVBREFrQUFEakJBQXd1QUlBQU44RUFEQzVBZ0FBNEFRQU1Mb0NBQURoQkFBZ3V3SUFBT0lFQURDOEFnQUE0Z1FBTUwwQ0FBRGlCQUF3dmdJQUFPSUVBRENfQWdBQTVBUUFNTUFDQUFEbEJBQXdDeU1BQUw4RUFEQWtBQURFQkFBd3VBSUFBTUFFQURDNUFnQUF3UVFBTUxvQ0FBRENCQUFndXdJQUFNTUVBREM4QWdBQXd3UUFNTDBDQUFEREJBQXd2Z0lBQU1NRUFEQ19BZ0FBeFFRQU1NQUNBQURHQkFBd0N5TUFBTEVFQURBa0FBQzJCQUF3dUFJQUFMSUVBREM1QWdBQXN3UUFNTG9DQUFDMEJBQWd1d0lBQUxVRUFEQzhBZ0FBdFFRQU1MMENBQUMxQkFBd3ZnSUFBTFVFQURDX0FnQUF0d1FBTU1BQ0FBQzRCQUF3Q3lNQUFKa0VBREFrQUFDZUJBQXd1QUlBQUpvRUFEQzVBZ0FBbXdRQU1Mb0NBQUNjQkFBZ3V3SUFBSjBFQURDOEFnQUFuUVFBTUwwQ0FBQ2RCQUF3dmdJQUFKMEVBRENfQWdBQW53UUFNTUFDQUFDZ0JBQXdDeU1BQUkwRUFEQWtBQUNTQkFBd3VBSUFBSTRFQURDNUFnQUFqd1FBTUxvQ0FBQ1FCQUFndXdJQUFKRUVBREM4QWdBQWtRUUFNTDBDQUFDUkJBQXd2Z0lBQUpFRUFEQ19BZ0FBa3dRQU1NQUNBQUNVQkFBd0N5TUFBSUFFQURBa0FBQ0ZCQUF3dUFJQUFJRUVBREM1QWdBQWdnUUFNTG9DQUFDREJBQWd1d0lBQUlRRUFEQzhBZ0FBaEFRQU1MMENBQUNFQkFBd3ZnSUFBSVFFQURDX0FnQUFoZ1FBTU1BQ0FBQ0hCQUF3Q3lNQUFPTURBREFrQUFEb0F3QXd1QUlBQU9RREFEQzVBZ0FBNVFNQU1Mb0NBQURtQXdBZ3V3SUFBT2NEQURDOEFnQUE1d01BTUwwQ0FBRG5Bd0F3dmdJQUFPY0RBRENfQWdBQTZRTUFNTUFDQUFEcUF3QXdDeU1BQU5ZREFEQWtBQURiQXdBd3VBSUFBTmNEQURDNUFnQUEyQU1BTUxvQ0FBRFpBd0FndXdJQUFOb0RBREM4QWdBQTJnTUFNTDBDQUFEYUF3QXd2Z0lBQU5vREFEQ19BZ0FBM0FNQU1NQUNBQURkQXdBd0JlSUJBUUFBQUFIbEFVQUFBQUFCa3dJQkFBQUFBWlFDUUFBQUFBR1ZBa0FBQUFBQkFnQUFBQzBBSUNNQUFPSURBQ0FEQUFBQUxRQWdJd0FBNGdNQUlDUUFBT0VEQUNBQkhBQUF0Z1lBTUFvSEFBQ2hBd0FnM3dFQUFKOERBRERnQVFBQUt3QVE0UUVBQUo4REFERGlBUUVBQUFBQjR3RUJBT3NDQUNIbEFVQUE4Z0lBSVpNQ0FRQUFBQUdVQWtBQThnSUFJWlVDUUFDZ0F3QWhBZ0FBQUMwQUlCd0FBT0VEQUNBQ0FBQUEzZ01BSUJ3QUFOOERBQ0FKM3dFQUFOMERBRERnQVFBQTNnTUFFT0VCQUFEZEF3QXc0Z0VCQU9zQ0FDSGpBUUVBNndJQUllVUJRQUR5QWdBaGt3SUJBT3NDQUNHVUFrQUE4Z0lBSVpVQ1FBQ2dBd0FoQ2Q4QkFBRGRBd0F3NEFFQUFONERBQkRoQVFBQTNRTUFNT0lCQVFEckFnQWg0d0VCQU9zQ0FDSGxBVUFBOGdJQUlaTUNBUURyQWdBaGxBSkFBUElDQUNHVkFrQUFvQU1BSVFYaUFRRUF2QU1BSWVVQlFBQzlBd0Foa3dJQkFMd0RBQ0dVQWtBQXZRTUFJWlVDUUFEZ0F3QWhBYnNDUUFBQUFBRUY0Z0VCQUx3REFDSGxBVUFBdlFNQUlaTUNBUUM4QXdBaGxBSkFBTDBEQUNHVkFrQUE0QU1BSVFYaUFRRUFBQUFCNVFGQUFBQUFBWk1DQVFBQUFBR1VBa0FBQUFBQmxRSkFBQUFBQVFvVUFBRDdBd0FnRlFBQV93TUFJQllBQVAwREFDRGlBUUVBQUFBQjVRRkFBQUFBQWY0QklBQUFBQUdBQWtBQUFBQUJyd0lCQUFBQUFiTUNBUUFBQUFHMEFnRUFBQUFCQWdBQUFBRUFJQ01BQVA0REFDQURBQUFBQVFBZ0l3QUFfZ01BSUNRQUFPMERBQ0FCSEFBQXRRWUFNQThIQUFDaEF3QWdGQUFBb3dNQUlCVUFBS1FEQUNBV0FBRDVBZ0FnM3dFQUFLSURBRERnQVFBQUtBQVE0UUVBQUtJREFERGlBUUVBQUFBQjR3RUJBT3NDQUNIbEFVQUE4Z0lBSWY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0d2QWdFQTZ3SUFJYk1DQVFEckFnQWh0QUlCQU93Q0FDRUNBQUFBQVFBZ0hBQUE3UU1BSUFJQUFBRHJBd0FnSEFBQTdBTUFJQXZmQVFBQTZnTUFNT0FCQUFEckF3QVE0UUVBQU9vREFERGlBUUVBNndJQUllTUJBUURyQWdBaDVRRkFBUElDQUNILUFTQUE4QUlBSVlBQ1FBRHlBZ0FocndJQkFPc0NBQ0d6QWdFQTZ3SUFJYlFDQVFEc0FnQWhDOThCQUFEcUF3QXc0QUVBQU9zREFCRGhBUUFBNmdNQU1PSUJBUURyQWdBaDR3RUJBT3NDQUNIbEFVQUE4Z0lBSWY0QklBRHdBZ0FoZ0FKQUFQSUNBQ0d2QWdFQTZ3SUFJYk1DQVFEckFnQWh0QUlCQU93Q0FDRUg0Z0VCQUx3REFDSGxBVUFBdlFNQUlmNEJJQURNQXdBaGdBSkFBTDBEQUNHdkFnRUF2QU1BSWJNQ0FRQzhBd0FodEFJQkFNZ0RBQ0VLRkFBQTdnTUFJQlVBQU84REFDQVdBQUR3QXdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWY0QklBRE1Bd0FoZ0FKQUFMMERBQ0d2QWdFQXZBTUFJYk1DQVFDOEF3QWh0QUlCQU1nREFDRUZJd0FBcVFZQUlDUUFBTE1HQUNDNEFnQUFxZ1lBSUxrQ0FBQ3lCZ0FndmdJQUFDRUFJQWNqQUFDbEJnQWdKQUFBc0FZQUlMZ0NBQUNtQmdBZ3VRSUFBSzhHQUNDOEFnQUFLQUFndlFJQUFDZ0FJTDRDQUFBQkFDQUxJd0FBOFFNQU1DUUFBUFVEQURDNEFnQUE4Z01BTUxrQ0FBRHpBd0F3dWdJQUFQUURBQ0M3QWdBQTV3TUFNTHdDQUFEbkF3QXd2UUlBQU9jREFEQy1BZ0FBNXdNQU1MOENBQUQyQXdBd3dBSUFBT29EQURBS0J3QUFfQU1BSUJRQUFQc0RBQ0FXQUFEOUF3QWc0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCX2dFZ0FBQUFBWUFDUUFBQUFBR3ZBZ0VBQUFBQnN3SUJBQUFBQVFJQUFBQUJBQ0FqQUFENkF3QWdBd0FBQUFFQUlDTUFBUG9EQUNBa0FBRDRBd0FnQVJ3QUFLNEdBREFDQUFBQUFRQWdIQUFBLUFNQUlBSUFBQURyQXdBZ0hBQUE5d01BSUFmaUFRRUF2QU1BSWVNQkFRQzhBd0FoNVFGQUFMMERBQ0gtQVNBQXpBTUFJWUFDUUFDOUF3QWhyd0lCQUx3REFDR3pBZ0VBdkFNQUlRb0hBQUQ1QXdBZ0ZBQUE3Z01BSUJZQUFQQURBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDSC1BU0FBekFNQUlZQUNRQUM5QXdBaHJ3SUJBTHdEQUNHekFnRUF2QU1BSVFVakFBQ25CZ0FnSkFBQXJBWUFJTGdDQUFDb0JnQWd1UUlBQUtzR0FDQy1BZ0FBbndJQUlBb0hBQUQ4QXdBZ0ZBQUEtd01BSUJZQUFQMERBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBYThDQVFBQUFBR3pBZ0VBQUFBQkF5TUFBS2tHQUNDNEFnQUFxZ1lBSUw0Q0FBQWhBQ0FESXdBQXB3WUFJTGdDQUFDb0JnQWd2Z0lBQUo4Q0FDQUVJd0FBOFFNQU1MZ0NBQUR5QXdBd3VnSUFBUFFEQUNDLUFnQUE1d01BTUFvVUFBRDdBd0FnRlFBQV93TUFJQllBQVAwREFDRGlBUUVBQUFBQjVRRkFBQUFBQWY0QklBQUFBQUdBQWtBQUFBQUJyd0lCQUFBQUFiTUNBUUFBQUFHMEFnRUFBQUFCQXlNQUFLVUdBQ0M0QWdBQXBnWUFJTDRDQUFBQkFDQUg0Z0VCQUFBQUFlVUJRQUFBQUFHRUFnRUFBQUFCcEFJQUFBQ2tBZ0tsQWdFQUFBQUJwZ0lCQUFBQUFhY0NJQUFBQUFFQ0FBQUFKZ0FnSXdBQWpBUUFJQU1BQUFBbUFDQWpBQUNNQkFBZ0pBQUFpd1FBSUFFY0FBQ2tCZ0F3REFjQUFLRURBQ0RmQVFBQXBRTUFNT0FCQUFBa0FCRGhBUUFBcFFNQU1PSUJBUUFBQUFIakFRRUE2d0lBSWVVQlFBRHlBZ0FoaEFJQkFPc0NBQ0drQWdBQXBnT2tBaUtsQWdFQTZ3SUFJYVlDQVFEc0FnQWhwd0lnQVBBQ0FDRUNBQUFBSmdBZ0hBQUFpd1FBSUFJQUFBQ0lCQUFnSEFBQWlRUUFJQXZmQVFBQWh3UUFNT0FCQUFDSUJBQVE0UUVBQUljRUFERGlBUUVBNndJQUllTUJBUURyQWdBaDVRRkFBUElDQUNHRUFnRUE2d0lBSWFRQ0FBQ21BNlFDSXFVQ0FRRHJBZ0FocGdJQkFPd0NBQ0duQWlBQThBSUFJUXZmQVFBQWh3UUFNT0FCQUFDSUJBQVE0UUVBQUljRUFERGlBUUVBNndJQUllTUJBUURyQWdBaDVRRkFBUElDQUNHRUFnRUE2d0lBSWFRQ0FBQ21BNlFDSXFVQ0FRRHJBZ0FocGdJQkFPd0NBQ0duQWlBQThBSUFJUWZpQVFFQXZBTUFJZVVCUUFDOUF3QWhoQUlCQUx3REFDR2tBZ0FBaWdTa0FpS2xBZ0VBdkFNQUlhWUNBUURJQXdBaHB3SWdBTXdEQUNFQnV3SUFBQUNrQWdJSDRnRUJBTHdEQUNIbEFVQUF2UU1BSVlRQ0FRQzhBd0FocEFJQUFJb0VwQUlpcFFJQkFMd0RBQ0dtQWdFQXlBTUFJYWNDSUFETUF3QWhCLUlCQVFBQUFBSGxBVUFBQUFBQmhBSUJBQUFBQWFRQ0FBQUFwQUlDcFFJQkFBQUFBYVlDQVFBQUFBR25BaUFBQUFBQkJBZ0FBTUVEQUNEaUFRRUFBQUFCNUFFQkFBQUFBZVVCUUFBQUFBRUNBQUFBR0FBZ0l3QUFtQVFBSUFNQUFBQVlBQ0FqQUFDWUJBQWdKQUFBbHdRQUlBRWNBQUNqQmdBd0NnY0FBS0VEQUNBSUFBQ3JBd0FnM3dFQUFLb0RBRERnQVFBQUZnQVE0UUVBQUtvREFERGlBUUVBQUFBQjR3RUJBT3NDQUNIa0FRRUE2d0lBSWVVQlFBRHlBZ0FodFFJQUFLa0RBQ0FDQUFBQUdBQWdIQUFBbHdRQUlBSUFBQUNWQkFBZ0hBQUFsZ1FBSUFmZkFRQUFsQVFBTU9BQkFBQ1ZCQUFRNFFFQUFKUUVBRERpQVFFQTZ3SUFJZU1CQVFEckFnQWg1QUVCQU9zQ0FDSGxBVUFBOGdJQUlRZmZBUUFBbEFRQU1PQUJBQUNWQkFBUTRRRUFBSlFFQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJUVBpQVFFQXZBTUFJZVFCQVFDOEF3QWg1UUZBQUwwREFDRUVDQUFBdndNQUlPSUJBUUM4QXdBaDVBRUJBTHdEQUNIbEFVQUF2UU1BSVFRSUFBREJBd0FnNGdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQkN4RUFBTEFFQUNEaUFRRUFBQUFCNVFGQUFBQUFBZm9CQUFBQXNnSUNfZ0VnQUFBQUFZQUNRQUFBQUFHRUFnRUFBQUFCaFFJQkFBQUFBYTRDQVFBQUFBR3ZBZ0VBQUFBQnNBSUJBQUFBQVFJQUFBQWhBQ0FqQUFDdkJBQWdBd0FBQUNFQUlDTUFBSzhFQUNBa0FBQ2tCQUFnQVJ3QUFLSUdBREFRRVFBQS1RSUFJQk1BQUtFREFDRGZBUUFBcHdNQU1PQUJBQUFmQUJEaEFRQUFwd01BTU9JQkFRQUFBQUhsQVVBQThnSUFJZm9CQUFDb0E3SUNJdjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0VBZ0VBNndJQUlZVUNBUUFBQUFHdUFnRUE2d0lBSWE4Q0FRRHJBZ0Foc0FJQkFPc0NBQ0d5QWdFQTZ3SUFJUUlBQUFBaEFDQWNBQUNrQkFBZ0FnQUFBS0VFQUNBY0FBQ2lCQUFnRHQ4QkFBQ2dCQUF3NEFFQUFLRUVBQkRoQVFBQW9BUUFNT0lCQVFEckFnQWg1UUZBQVBJQ0FDSDZBUUFBcUFPeUFpTC1BU0FBOEFJQUlZQUNRQUR5QWdBaGhBSUJBT3NDQUNHRkFnRUE2d0lBSWE0Q0FRRHJBZ0FocndJQkFPc0NBQ0d3QWdFQTZ3SUFJYklDQVFEckFnQWhEdDhCQUFDZ0JBQXc0QUVBQUtFRUFCRGhBUUFBb0FRQU1PSUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFxQU95QWlMLUFTQUE4QUlBSVlBQ1FBRHlBZ0FoaEFJQkFPc0NBQ0dGQWdFQTZ3SUFJYTRDQVFEckFnQWhyd0lCQU9zQ0FDR3dBZ0VBNndJQUliSUNBUURyQWdBaEN1SUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUFvd1N5QWlMLUFTQUF6QU1BSVlBQ1FBQzlBd0FoaEFJQkFMd0RBQ0dGQWdFQXZBTUFJYTRDQVFDOEF3QWhyd0lCQUx3REFDR3dBZ0VBdkFNQUlRRzdBZ0FBQUxJQ0Fnc1JBQUNsQkFBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBQ2pCTElDSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhyZ0lCQUx3REFDR3ZBZ0VBdkFNQUliQUNBUUM4QXdBaEN5TUFBS1lFQURBa0FBQ3FCQUF3dUFJQUFLY0VBREM1QWdBQXFBUUFNTG9DQUFDcEJBQWd1d0lBQU9jREFEQzhBZ0FBNXdNQU1MMENBQURuQXdBd3ZnSUFBT2NEQURDX0FnQUFxd1FBTU1BQ0FBRHFBd0F3Q2djQUFQd0RBQ0FWQUFEX0F3QWdGZ0FBX1FNQUlPSUJBUUFBQUFIakFRRUFBQUFCNVFGQUFBQUFBZjRCSUFBQUFBR0FBa0FBQUFBQnJ3SUJBQUFBQWJRQ0FRQUFBQUVDQUFBQUFRQWdJd0FBcmdRQUlBTUFBQUFCQUNBakFBQ3VCQUFnSkFBQXJRUUFJQUVjQUFDaEJnQXdBZ0FBQUFFQUlCd0FBSzBFQUNBQ0FBQUE2d01BSUJ3QUFLd0VBQ0FINGdFQkFMd0RBQ0hqQVFFQXZBTUFJZVVCUUFDOUF3QWhfZ0VnQU13REFDR0FBa0FBdlFNQUlhOENBUUM4QXdBaHRBSUJBTWdEQUNFS0J3QUEtUU1BSUJVQUFPOERBQ0FXQUFEd0F3QWc0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaF9nRWdBTXdEQUNHQUFrQUF2UU1BSWE4Q0FRQzhBd0FodEFJQkFNZ0RBQ0VLQndBQV9BTUFJQlVBQVA4REFDQVdBQUQ5QXdBZzRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJfZ0VnQUFBQUFZQUNRQUFBQUFHdkFnRUFBQUFCdEFJQkFBQUFBUXNSQUFDd0JBQWc0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBTElDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHdUFnRUFBQUFCcndJQkFBQUFBYkFDQVFBQUFBRUVJd0FBcGdRQU1MZ0NBQUNuQkFBd3VnSUFBS2tFQUNDLUFnQUE1d01BTUFnSUFBQy1CQUFnNGdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQl9nRWdBQUFBQVlBQ1FBQUFBQUdLQWdJQUFBQUJrZ0lCQUFBQUFRSUFBQUFVQUNBakFBQzlCQUFnQXdBQUFCUUFJQ01BQUwwRUFDQWtBQUM3QkFBZ0FSd0FBS0FHQURBT0J3QUFvUU1BSUFnQUFLc0RBQ0RmQVFBQXJRTUFNT0FCQUFBU0FCRGhBUUFBclFNQU1PSUJBUUFBQUFIakFRRUE2d0lBSWVRQkFRRHJBZ0FoNVFGQUFQSUNBQ0gtQVNBQThBSUFJWUFDUUFEeUFnQWhpZ0lDQVBFQ0FDR1NBZ0VBNndJQUliVUNBQUNzQXdBZ0FnQUFBQlFBSUJ3QUFMc0VBQ0FDQUFBQXVRUUFJQndBQUxvRUFDQUwzd0VBQUxnRUFERGdBUUFBdVFRQUVPRUJBQUM0QkFBdzRnRUJBT3NDQUNIakFRRUE2d0lBSWVRQkFRRHJBZ0FoNVFGQUFQSUNBQ0gtQVNBQThBSUFJWUFDUUFEeUFnQWhpZ0lDQVBFQ0FDR1NBZ0VBNndJQUlRdmZBUUFBdUFRQU1PQUJBQUM1QkFBUTRRRUFBTGdFQUREaUFRRUE2d0lBSWVNQkFRRHJBZ0FoNUFFQkFPc0NBQ0hsQVVBQThnSUFJZjRCSUFEd0FnQWhnQUpBQVBJQ0FDR0tBZ0lBOFFJQUlaSUNBUURyQWdBaEItSUJBUUM4QXdBaDVBRUJBTHdEQUNIbEFVQUF2UU1BSWY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dLQWdJQXpRTUFJWklDQVFDOEF3QWhDQWdBQUx3RUFDRGlBUUVBdkFNQUllUUJBUUM4QXdBaDVRRkFBTDBEQUNILUFTQUF6QU1BSVlBQ1FBQzlBd0FoaWdJQ0FNMERBQ0dTQWdFQXZBTUFJUVVqQUFDYkJnQWdKQUFBbmdZQUlMZ0NBQUNjQmdBZ3VRSUFBSjBHQUNDLUFnQUFCUUFnQ0FnQUFMNEVBQ0RpQVFFQUFBQUI1QUVCQUFBQUFlVUJRQUFBQUFILUFTQUFBQUFCZ0FKQUFBQUFBWW9DQWdBQUFBR1NBZ0VBQUFBQkF5TUFBSnNHQUNDNEFnQUFuQVlBSUw0Q0FBQUZBQ0FLQ0FBQTNBUUFJQW9BQU4wRUFDRGlBUUVBQUFBQjVBRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFLNENBb0FDUUFBQUFBR3FBa0FBQUFBQnF3SUNBQUFBQWF3Q0VBQUFBQUVDQUFBQUN3QWdJd0FBMndRQUlBTUFBQUFMQUNBakFBRGJCQUFnSkFBQXl3UUFJQUVjQUFDYUJnQXdEd2NBQUtFREFDQUlBQUNyQXdBZ0NnQUF0QU1BSU44QkFBQ3lBd0F3NEFFQUFBa0FFT0VCQUFDeUF3QXc0Z0VCQUFBQUFlTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ3pBNjRDSW9BQ1FBRHlBZ0FocWdKQUFQSUNBQ0dyQWdJQThRSUFJYXdDRUFDdkF3QWhBZ0FBQUFzQUlCd0FBTXNFQUNBQ0FBQUF4d1FBSUJ3QUFNZ0VBQ0FNM3dFQUFNWUVBRERnQVFBQXh3UUFFT0VCQUFER0JBQXc0Z0VCQU9zQ0FDSGpBUUVBNndJQUllUUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUFzd091QWlLQUFrQUE4Z0lBSWFvQ1FBRHlBZ0FocXdJQ0FQRUNBQ0dzQWhBQXJ3TUFJUXpmQVFBQXhnUUFNT0FCQUFESEJBQVE0UUVBQU1ZRUFERGlBUUVBNndJQUllTUJBUURyQWdBaDVBRUJBT3NDQUNIbEFVQUE4Z0lBSWZvQkFBQ3pBNjRDSW9BQ1FBRHlBZ0FocWdKQUFQSUNBQ0dyQWdJQThRSUFJYXdDRUFDdkF3QWhDT0lCQVFDOEF3QWg1QUVCQUx3REFDSGxBVUFBdlFNQUlmb0JBQURLQks0Q0lvQUNRQUM5QXdBaHFnSkFBTDBEQUNHckFnSUF6UU1BSWF3Q0VBREpCQUFoQmJzQ0VBQUFBQUhDQWhBQUFBQUJ3d0lRQUFBQUFjUUNFQUFBQUFIRkFoQUFBQUFCQWJzQ0FBQUFyZ0lDQ2dnQUFNd0VBQ0FLQUFETkJBQWc0Z0VCQUx3REFDSGtBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBTW9FcmdJaWdBSkFBTDBEQUNHcUFrQUF2UU1BSWFzQ0FnRE5Bd0FockFJUUFNa0VBQ0VGSXdBQWxBWUFJQ1FBQUpnR0FDQzRBZ0FBbFFZQUlMa0NBQUNYQmdBZ3ZnSUFBQVVBSUFzakFBRE9CQUF3SkFBQTB3UUFNTGdDQUFEUEJBQXd1UUlBQU5BRUFEQzZBZ0FBMFFRQUlMc0NBQURTQkFBd3ZBSUFBTklFQURDOUFnQUEwZ1FBTUw0Q0FBRFNCQUF3dndJQUFOUUVBRERBQWdBQTFRUUFNQV9pQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBbkFJQ2dBSkFBQUFBQVpjQ0FRQUFBQUdZQWdFQUFBQUJtUUlRQUFBQUFab0NBUUFBQUFHY0FnRUFBQUFCblFJQkFBQUFBWjRDQVFBQUFBR2ZBZ0VBQUFBQm9BSkFBQUFBQWFFQ0FRQUFBQUdpQWtBQUFBQUJBZ0FBQUE4QUlDTUFBTm9FQUNBREFBQUFEd0FnSXdBQTJnUUFJQ1FBQU5rRUFDQUJIQUFBbGdZQU1CUUpBQUN4QXdBZzN3RUFBSzREQUREZ0FRQUFEUUFRNFFFQUFLNERBRERpQVFFQUFBQUI1UUZBQVBJQ0FDSDZBUUFBc0FPY0FpS0FBa0FBOGdJQUlaWUNBUURyQWdBaGx3SUJBQUFBQVpnQ0FRRHNBZ0FobVFJUUFLOERBQ0dhQWdFQTZ3SUFJWndDQVFEc0FnQWhuUUlCQU93Q0FDR2VBZ0VBN0FJQUlaOENBUURzQWdBaG9BSkFBS0FEQUNHaEFnRUE3QUlBSWFJQ1FBQ2dBd0FoQWdBQUFBOEFJQndBQU5rRUFDQUNBQUFBMWdRQUlCd0FBTmNFQUNBVDN3RUFBTlVFQUREZ0FRQUExZ1FBRU9FQkFBRFZCQUF3NGdFQkFPc0NBQ0hsQVVBQThnSUFJZm9CQUFDd0E1d0NJb0FDUUFEeUFnQWhsZ0lCQU9zQ0FDR1hBZ0VBNndJQUlaZ0NBUURzQWdBaG1RSVFBSzhEQUNHYUFnRUE2d0lBSVp3Q0FRRHNBZ0FoblFJQkFPd0NBQ0dlQWdFQTdBSUFJWjhDQVFEc0FnQWhvQUpBQUtBREFDR2hBZ0VBN0FJQUlhSUNRQUNnQXdBaEU5OEJBQURWQkFBdzRBRUFBTllFQUJEaEFRQUExUVFBTU9JQkFRRHJBZ0FoNVFGQUFQSUNBQ0g2QVFBQXNBT2NBaUtBQWtBQThnSUFJWllDQVFEckFnQWhsd0lCQU9zQ0FDR1lBZ0VBN0FJQUlaa0NFQUN2QXdBaG1nSUJBT3NDQUNHY0FnRUE3QUlBSVowQ0FRRHNBZ0FobmdJQkFPd0NBQ0dmQWdFQTdBSUFJYUFDUUFDZ0F3QWhvUUlCQU93Q0FDR2lBa0FBb0FNQUlRX2lBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBTmdFbkFJaWdBSkFBTDBEQUNHWEFnRUF2QU1BSVpnQ0FRRElBd0FobVFJUUFNa0VBQ0dhQWdFQXZBTUFJWndDQVFESUF3QWhuUUlCQU1nREFDR2VBZ0VBeUFNQUlaOENBUURJQXdBaG9BSkFBT0FEQUNHaEFnRUF5QU1BSWFJQ1FBRGdBd0FoQWJzQ0FBQUFuQUlDRC1JQkFRQzhBd0FoNVFGQUFMMERBQ0g2QVFBQTJBU2NBaUtBQWtBQXZRTUFJWmNDQVFDOEF3QWhtQUlCQU1nREFDR1pBaEFBeVFRQUlab0NBUUM4QXdBaG5BSUJBTWdEQUNHZEFnRUF5QU1BSVo0Q0FRRElBd0FobndJQkFNZ0RBQ0dnQWtBQTRBTUFJYUVDQVFESUF3QWhvZ0pBQU9BREFDRVA0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSndDQW9BQ1FBQUFBQUdYQWdFQUFBQUJtQUlCQUFBQUFaa0NFQUFBQUFHYUFnRUFBQUFCbkFJQkFBQUFBWjBDQVFBQUFBR2VBZ0VBQUFBQm53SUJBQUFBQWFBQ1FBQUFBQUdoQWdFQUFBQUJvZ0pBQUFBQUFRb0lBQURjQkFBZ0NnQUEzUVFBSU9JQkFRQUFBQUhrQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBcmdJQ2dBSkFBQUFBQWFvQ1FBQUFBQUdyQWdJQUFBQUJyQUlRQUFBQUFRTWpBQUNVQmdBZ3VBSUFBSlVHQUNDLUFnQUFCUUFnQkNNQUFNNEVBREM0QWdBQXp3UUFNTG9DQUFEUkJBQWd2Z0lBQU5JRUFEQVNCUUFBa1FVQUlBc0FBSklGQUNBTUFBQ1RCUUFnRFFBQWxBVUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNOQWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQmhnSUJBQUFBQVljQ0FRQUFBQUdJQWhBQUFBQUJpUUlDQUFBQUFZb0NDQUFBQUFHTEFnQUFrQVVBSUkwQ0FRQUFBQUVDQUFBQUJRQWdJd0FBandVQUlBTUFBQUFGQUNBakFBQ1BCUUFnSkFBQTZ3UUFJQUVjQUFDVEJnQXdGd1VBQUxnREFDQUdBQUNoQXdBZ0N3QUE5QUlBSUF3QUFQVUNBQ0FOQUFEM0FnQWczd0VBQUxVREFERGdBUUFBQXdBUTRRRUFBTFVEQUREaUFRRUFBQUFCNVFGQUFQSUNBQ0g2QVFBQXR3T05BaUwtQVNBQThBSUFJWUFDUUFEeUFnQWhoQUlCQU9zQ0FDR0ZBZ0VBQUFBQmhnSUJBT3NDQUNHSEFnRUE2d0lBSVlnQ0VBQ3ZBd0FoaVFJQ0FQRUNBQ0dLQWdnQXRnTUFJWXNDQUFELUFnQWdqUUlCQU9zQ0FDR09BZ0VBNndJQUlRSUFBQUFGQUNBY0FBRHJCQUFnQWdBQUFPWUVBQ0FjQUFEbkJBQWdFdDhCQUFEbEJBQXc0QUVBQU9ZRUFCRGhBUUFBNVFRQU1PSUJBUURyQWdBaDVRRkFBUElDQUNINkFRQUF0d09OQWlMLUFTQUE4QUlBSVlBQ1FBRHlBZ0FoaEFJQkFPc0NBQ0dGQWdFQTZ3SUFJWVlDQVFEckFnQWhod0lCQU9zQ0FDR0lBaEFBcndNQUlZa0NBZ0R4QWdBaGlnSUlBTFlEQUNHTEFnQUFfZ0lBSUkwQ0FRRHJBZ0FoamdJQkFPc0NBQ0VTM3dFQUFPVUVBRERnQVFBQTVnUUFFT0VCQUFEbEJBQXc0Z0VCQU9zQ0FDSGxBVUFBOGdJQUlmb0JBQUMzQTQwQ0l2NEJJQUR3QWdBaGdBSkFBUElDQUNHRUFnRUE2d0lBSVlVQ0FRRHJBZ0FoaGdJQkFPc0NBQ0dIQWdFQTZ3SUFJWWdDRUFDdkF3QWhpUUlDQVBFQ0FDR0tBZ2dBdGdNQUlZc0NBQUQtQWdBZ2pRSUJBT3NDQUNHT0FnRUE2d0lBSVE3aUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFPb0VqUUlpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR0dBZ0VBdkFNQUlZY0NBUUM4QXdBaGlBSVFBTWtFQUNHSkFnSUF6UU1BSVlvQ0NBRG9CQUFoaXdJQUFPa0VBQ0NOQWdFQXZBTUFJUVc3QWdnQUFBQUJ3Z0lJQUFBQUFjTUNDQUFBQUFIRUFnZ0FBQUFCeFFJSUFBQUFBUUs3QWdFQUFBQUV3UUlCQUFBQUJRRzdBZ0FBQUkwQ0FoSUZBQURzQkFBZ0N3QUE3UVFBSUF3QUFPNEVBQ0FOQUFEdkJBQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmb0JBQURxQkkwQ0l2NEJJQURNQXdBaGdBSkFBTDBEQUNHRUFnRUF2QU1BSVlVQ0FRQzhBd0FoaGdJQkFMd0RBQ0dIQWdFQXZBTUFJWWdDRUFESkJBQWhpUUlDQU0wREFDR0tBZ2dBNkFRQUlZc0NBQURwQkFBZ2pRSUJBTHdEQUNFRkl3QUFnUVlBSUNRQUFKRUdBQ0M0QWdBQWdnWUFJTGtDQUFDUUJnQWd2Z0lBQUg4QUlBc2pBQUNFQlFBd0pBQUFpQVVBTUxnQ0FBQ0ZCUUF3dVFJQUFJWUZBREM2QWdBQWh3VUFJTHNDQUFEREJBQXd2QUlBQU1NRUFEQzlBZ0FBd3dRQU1MNENBQUREQkFBd3Z3SUFBSWtGQUREQUFnQUF4Z1FBTUFzakFBRDVCQUF3SkFBQV9RUUFNTGdDQUFENkJBQXd1UUlBQVBzRUFEQzZBZ0FBX0FRQUlMc0NBQUMxQkFBd3ZBSUFBTFVFQURDOUFnQUF0UVFBTUw0Q0FBQzFCQUF3dndJQUFQNEVBRERBQWdBQXVBUUFNQXNqQUFEd0JBQXdKQUFBOUFRQU1MZ0NBQUR4QkFBd3VRSUFBUElFQURDNkFnQUE4d1FBSUxzQ0FBQ1JCQUF3dkFJQUFKRUVBREM5QWdBQWtRUUFNTDRDQUFDUkJBQXd2d0lBQVBVRUFEREFBZ0FBbEFRQU1BUUhBQURBQXdBZzRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJBZ0FBQUJnQUlDTUFBUGdFQUNBREFBQUFHQUFnSXdBQS1BUUFJQ1FBQVBjRUFDQUJIQUFBandZQU1BSUFBQUFZQUNBY0FBRDNCQUFnQWdBQUFKVUVBQ0FjQUFEMkJBQWdBLUlCQVFDOEF3QWg0d0VCQUx3REFDSGxBVUFBdlFNQUlRUUhBQUMtQXdBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoQkFjQUFNQURBQ0RpQVFFQUFBQUI0d0VCQUFBQUFlVUJRQUFBQUFFSUJ3QUFnd1VBSU9JQkFRQUFBQUhqQVFFQUFBQUI1UUZBQUFBQUFmNEJJQUFBQUFHQUFrQUFBQUFCaWdJQ0FBQUFBWklDQVFBQUFBRUNBQUFBRkFBZ0l3QUFnZ1VBSUFNQUFBQVVBQ0FqQUFDQ0JRQWdKQUFBZ0FVQUlBRWNBQUNPQmdBd0FnQUFBQlFBSUJ3QUFJQUZBQ0FDQUFBQXVRUUFJQndBQVA4RUFDQUg0Z0VCQUx3REFDSGpBUUVBdkFNQUllVUJRQUM5QXdBaF9nRWdBTXdEQUNHQUFrQUF2UU1BSVlvQ0FnRE5Bd0Foa2dJQkFMd0RBQ0VJQndBQWdRVUFJT0lCQVFDOEF3QWg0d0VCQUx3REFDSGxBVUFBdlFNQUlmNEJJQURNQXdBaGdBSkFBTDBEQUNHS0FnSUF6UU1BSVpJQ0FRQzhBd0FoQlNNQUFJa0dBQ0FrQUFDTUJnQWd1QUlBQUlvR0FDQzVBZ0FBaXdZQUlMNENBQUNmQWdBZ0NBY0FBSU1GQUNEaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQVlvQ0FnQUFBQUdTQWdFQUFBQUJBeU1BQUlrR0FDQzRBZ0FBaWdZQUlMNENBQUNmQWdBZ0NnY0FBSTRGQUNBS0FBRGRCQUFnNGdFQkFBQUFBZU1CQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUN1QWdLQUFrQUFBQUFCcWdKQUFBQUFBYXNDQWdBQUFBR3NBaEFBQUFBQkFnQUFBQXNBSUNNQUFJMEZBQ0FEQUFBQUN3QWdJd0FBalFVQUlDUUFBSXNGQUNBQkhBQUFpQVlBTUFJQUFBQUxBQ0FjQUFDTEJRQWdBZ0FBQU1jRUFDQWNBQUNLQlFBZ0NPSUJBUUM4QXdBaDR3RUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBREtCSzRDSW9BQ1FBQzlBd0FocWdKQUFMMERBQ0dyQWdJQXpRTUFJYXdDRUFESkJBQWhDZ2NBQUl3RkFDQUtBQUROQkFBZzRnRUJBTHdEQUNIakFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFNb0VyZ0lpZ0FKQUFMMERBQ0dxQWtBQXZRTUFJYXNDQWdETkF3QWhyQUlRQU1rRUFDRUZJd0FBZ3dZQUlDUUFBSVlHQUNDNEFnQUFoQVlBSUxrQ0FBQ0ZCZ0FndmdJQUFKOENBQ0FLQndBQWpnVUFJQW9BQU4wRUFDRGlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFLNENBb0FDUUFBQUFBR3FBa0FBQUFBQnF3SUNBQUFBQWF3Q0VBQUFBQUVESXdBQWd3WUFJTGdDQUFDRUJnQWd2Z0lBQUo4Q0FDQVNCUUFBa1FVQUlBc0FBSklGQUNBTUFBQ1RCUUFnRFFBQWxBVUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNOQWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQmhnSUJBQUFBQVljQ0FRQUFBQUdJQWhBQUFBQUJpUUlDQUFBQUFZb0NDQUFBQUFHTEFnQUFrQVVBSUkwQ0FRQUFBQUVCdXdJQkFBQUFCQU1qQUFDQkJnQWd1QUlBQUlJR0FDQy1BZ0FBZndBZ0JDTUFBSVFGQURDNEFnQUFoUVVBTUxvQ0FBQ0hCUUFndmdJQUFNTUVBREFFSXdBQS1RUUFNTGdDQUFENkJBQXd1Z0lBQVB3RUFDQy1BZ0FBdFFRQU1BUWpBQUR3QkFBd3VBSUFBUEVFQURDNkFnQUE4d1FBSUw0Q0FBQ1JCQUF3QkNNQUFONEVBREM0QWdBQTN3UUFNTG9DQUFEaEJBQWd2Z0lBQU9JRUFEQUVJd0FBdndRQU1MZ0NBQURBQkFBd3VnSUFBTUlFQUNDLUFnQUF3d1FBTUFRakFBQ3hCQUF3dUFJQUFMSUVBREM2QWdBQXRBUUFJTDRDQUFDMUJBQXdCQ01BQUprRUFEQzRBZ0FBbWdRQU1Mb0NBQUNjQkFBZ3ZnSUFBSjBFQURBRUl3QUFqUVFBTUxnQ0FBQ09CQUF3dWdJQUFKQUVBQ0MtQWdBQWtRUUFNQVFqQUFDQUJBQXd1QUlBQUlFRUFEQzZBZ0FBZ3dRQUlMNENBQUNFQkFBd0JDTUFBT01EQURDNEFnQUE1QU1BTUxvQ0FBRG1Bd0FndmdJQUFPY0RBREFFSXdBQTFnTUFNTGdDQUFEWEF3QXd1Z0lBQU5rREFDQy1BZ0FBMmdNQU1BQUFBQUFBQUFBQUFBQUFBQUFGSXdBQV9BVUFJQ1FBQVA4RkFDQzRBZ0FBX1FVQUlMa0NBQUQtQlFBZ3ZnSUFBSjhDQUNBREl3QUFfQVVBSUxnQ0FBRDlCUUFndmdJQUFKOENBQ0FBQUFBQUFBQUFBQVVqQUFEM0JRQWdKQUFBLWdVQUlMZ0NBQUQ0QlFBZ3VRSUFBUGtGQUNDLUFnQUFud0lBSUFNakFBRDNCUUFndUFJQUFQZ0ZBQ0MtQWdBQW53SUFJQUFBQUFBQUJTTUFBUElGQUNBa0FBRDFCUUFndUFJQUFQTUZBQ0M1QWdBQTlBVUFJTDRDQUFBTEFDQURJd0FBOGdVQUlMZ0NBQUR6QlFBZ3ZnSUFBQXNBSUFBQUFBVWpBQUR0QlFBZ0pBQUE4QVVBSUxnQ0FBRHVCUUFndVFJQUFPOEZBQ0MtQWdBQW53SUFJQU1qQUFEdEJRQWd1QUlBQU80RkFDQy1BZ0FBbndJQUlBQUFBQUFBQUFzakFBREpCUUF3SkFBQXpRVUFNTGdDQUFES0JRQXd1UUlBQU1zRkFEQzZBZ0FBekFVQUlMc0NBQURpQkFBd3ZBSUFBT0lFQURDOUFnQUE0Z1FBTUw0Q0FBRGlCQUF3dndJQUFNNEZBRERBQWdBQTVRUUFNQklHQUFDckJRQWdDd0FBa2dVQUlBd0FBSk1GQUNBTkFBQ1VCUUFnNGdFQkFBQUFBZVVCUUFBQUFBSDZBUUFBQUkwQ0F2NEJJQUFBQUFHQUFrQUFBQUFCaEFJQkFBQUFBWVVDQVFBQUFBR0dBZ0VBQUFBQmh3SUJBQUFBQVlnQ0VBQUFBQUdKQWdJQUFBQUJpZ0lJQUFBQUFZc0NBQUNRQlFBZ2pnSUJBQUFBQVFJQUFBQUZBQ0FqQUFEUkJRQWdBd0FBQUFVQUlDTUFBTkVGQUNBa0FBRFFCUUFnQVJ3QUFPd0ZBREFDQUFBQUJRQWdIQUFBMEFVQUlBSUFBQURtQkFBZ0hBQUF6d1VBSUE3aUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFPb0VqUUlpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR0dBZ0VBdkFNQUlZY0NBUUM4QXdBaGlBSVFBTWtFQUNHSkFnSUF6UU1BSVlvQ0NBRG9CQUFoaXdJQUFPa0VBQ0NPQWdFQXZBTUFJUklHQUFDcUJRQWdDd0FBN1FRQUlBd0FBTzRFQUNBTkFBRHZCQUFnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFEcUJJMENJdjRCSUFETUF3QWhnQUpBQUwwREFDR0VBZ0VBdkFNQUlZVUNBUUM4QXdBaGhnSUJBTHdEQUNHSEFnRUF2QU1BSVlnQ0VBREpCQUFoaVFJQ0FNMERBQ0dLQWdnQTZBUUFJWXNDQUFEcEJBQWdqZ0lCQUx3REFDRVNCZ0FBcXdVQUlBc0FBSklGQUNBTUFBQ1RCUUFnRFFBQWxBVUFJT0lCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNOQWdMLUFTQUFBQUFCZ0FKQUFBQUFBWVFDQVFBQUFBR0ZBZ0VBQUFBQmhnSUJBQUFBQVljQ0FRQUFBQUdJQWhBQUFBQUJpUUlDQUFBQUFZb0NDQUFBQUFHTEFnQUFrQVVBSUk0Q0FRQUFBQUVFSXdBQXlRVUFNTGdDQUFES0JRQXd1Z0lBQU13RkFDQy1BZ0FBNGdRQU1BQUFBQUFBQUFBQUJTTUFBT2NGQUNBa0FBRHFCUUFndUFJQUFPZ0ZBQ0M1QWdBQTZRVUFJTDRDQUFDZkFnQWdBeU1BQU9jRkFDQzRBZ0FBNkFVQUlMNENBQUNmQWdBZ0FBQUFEQU1BQUowRkFDQUxBQUNlQlFBZ0RBQUFud1VBSUE0QUFLQUZBQ0FQQUFDaEJRQWdFQUFBb2dVQUlCRUFBS01GQUNBU0FBQ2tCUUFnOHdFQUFNSURBQ0QwQVFBQXdnTUFJUFVCQUFEQ0F3QWc5Z0VBQU1JREFDQUNFUUFBb3dVQUlCTUFBT0FGQUNBRkJ3QUE0QVVBSUJRQUFPRUZBQ0FWQUFEaUJRQWdGZ0FBb3dVQUlMUUNBQURDQXdBZ0JRVUFBT1lGQUNBR0FBRGdCUUFnQ3dBQW5nVUFJQXdBQUo4RkFDQU5BQUNoQlFBZ0F3Y0FBT0FGQUNBSUFBRGpCUUFnQ2dBQTVRVUFJQUFCQXdBQW5RVUFJQllEQUFDVkJRQWdDd0FBbGdVQUlBd0FBSmNGQUNBUEFBQ1pCUUFnRUFBQW1nVUFJQkVBQUpzRkFDQVNBQUNjQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUh4QVFFQUFBQUI4Z0VCQUFBQUFmTUJBUUFBQUFIMEFRRUFBQUFCOVFFQkFBQUFBZllCQVFBQUFBSDRBUUFBQVBnQkF2b0JBQUFBLWdFQ19BRUFBQUQ4QVFMOUFTQUFBQUFCX2dFZ0FBQUFBZjhCQWdBQUFBR0FBa0FBQUFBQkFnQUFBSjhDQUNBakFBRG5CUUFnQXdBQUFLSUNBQ0FqQUFEbkJRQWdKQUFBNndVQUlCZ0FBQUNpQWdBZ0F3QUF6Z01BSUFzQUFNOERBQ0FNQUFEUUF3QWdEd0FBMGdNQUlCQUFBTk1EQUNBUkFBRFVBd0FnRWdBQTFRTUFJQndBQU9zRkFDRGlBUUVBdkFNQUllVUJRQUM5QXdBaDhRRUJBTHdEQUNIeUFRRUF2QU1BSWZNQkFRRElBd0FoOUFFQkFNZ0RBQ0gxQVFFQXlBTUFJZllCQVFESUF3QWgtQUVBQU1rRC1BRWktZ0VBQU1vRC1nRWlfQUVBQU1zRF9BRWlfUUVnQU13REFDSC1BU0FBekFNQUlmOEJBZ0ROQXdBaGdBSkFBTDBEQUNFV0F3QUF6Z01BSUFzQUFNOERBQ0FNQUFEUUF3QWdEd0FBMGdNQUlCQUFBTk1EQUNBUkFBRFVBd0FnRWdBQTFRTUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaDh3RUJBTWdEQUNIMEFRRUF5QU1BSWZVQkFRRElBd0FoOWdFQkFNZ0RBQ0g0QVFBQXlRUDRBU0w2QVFBQXlnUDZBU0w4QVFBQXl3UDhBU0w5QVNBQXpBTUFJZjRCSUFETUF3QWhfd0VDQU0wREFDR0FBa0FBdlFNQUlRN2lBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFqUUlDX2dFZ0FBQUFBWUFDUUFBQUFBR0VBZ0VBQUFBQmhRSUJBQUFBQVlZQ0FRQUFBQUdIQWdFQUFBQUJpQUlRQUFBQUFZa0NBZ0FBQUFHS0FnZ0FBQUFCaXdJQUFKQUZBQ0NPQWdFQUFBQUJGZ01BQUpVRkFDQUxBQUNXQlFBZ0RBQUFsd1VBSUE0QUFKZ0ZBQ0FQQUFDWkJRQWdFUUFBbXdVQUlCSUFBSndGQUNEaUFRRUFBQUFCNVFGQUFBQUFBZkVCQVFBQUFBSHlBUUVBQUFBQjh3RUJBQUFBQWZRQkFRQUFBQUgxQVFFQUFBQUI5Z0VCQUFBQUFmZ0JBQUFBLUFFQy1nRUFBQUQ2QVFMOEFRQUFBUHdCQXYwQklBQUFBQUgtQVNBQUFBQUJfd0VDQUFBQUFZQUNRQUFBQUFFQ0FBQUFud0lBSUNNQUFPMEZBQ0FEQUFBQW9nSUFJQ01BQU8wRkFDQWtBQUR4QlFBZ0dBQUFBS0lDQUNBREFBRE9Bd0FnQ3dBQXp3TUFJQXdBQU5BREFDQU9BQURSQXdBZ0R3QUEwZ01BSUJFQUFOUURBQ0FTQUFEVkF3QWdIQUFBOFFVQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoOHdFQkFNZ0RBQ0gwQVFFQXlBTUFJZlVCQVFESUF3QWg5Z0VCQU1nREFDSDRBUUFBeVFQNEFTTDZBUUFBeWdQNkFTTDhBUUFBeXdQOEFTTDlBU0FBekFNQUlmNEJJQURNQXdBaF93RUNBTTBEQUNHQUFrQUF2UU1BSVJZREFBRE9Bd0FnQ3dBQXp3TUFJQXdBQU5BREFDQU9BQURSQXdBZ0R3QUEwZ01BSUJFQUFOUURBQ0FTQUFEVkF3QWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaEN3Y0FBSTRGQUNBSUFBRGNCQUFnNGdFQkFBQUFBZU1CQVFBQUFBSGtBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFyZ0lDZ0FKQUFBQUFBYW9DUUFBQUFBR3JBZ0lBQUFBQnJBSVFBQUFBQVFJQUFBQUxBQ0FqQUFEeUJRQWdBd0FBQUFrQUlDTUFBUElGQUNBa0FBRDJCUUFnRFFBQUFBa0FJQWNBQUl3RkFDQUlBQURNQkFBZ0hBQUE5Z1VBSU9JQkFRQzhBd0FoNHdFQkFMd0RBQ0hrQVFFQXZBTUFJZVVCUUFDOUF3QWgtZ0VBQU1vRXJnSWlnQUpBQUwwREFDR3FBa0FBdlFNQUlhc0NBZ0ROQXdBaHJBSVFBTWtFQUNFTEJ3QUFqQVVBSUFnQUFNd0VBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1QUVCQUx3REFDSGxBVUFBdlFNQUlmb0JBQURLQks0Q0lvQUNRQUM5QXdBaHFnSkFBTDBEQUNHckFnSUF6UU1BSWF3Q0VBREpCQUFoRmdNQUFKVUZBQ0FMQUFDV0JRQWdEQUFBbHdVQUlBNEFBSmdGQUNBUEFBQ1pCUUFnRUFBQW1nVUFJQkVBQUpzRkFDRGlBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUh5QVFFQUFBQUI4d0VCQUFBQUFmUUJBUUFBQUFIMUFRRUFBQUFCOWdFQkFBQUFBZmdCQUFBQS1BRUMtZ0VBQUFENkFRTDhBUUFBQVB3QkF2MEJJQUFBQUFILUFTQUFBQUFCX3dFQ0FBQUFBWUFDUUFBQUFBRUNBQUFBbndJQUlDTUFBUGNGQUNBREFBQUFvZ0lBSUNNQUFQY0ZBQ0FrQUFEN0JRQWdHQUFBQUtJQ0FDQURBQURPQXdBZ0N3QUF6d01BSUF3QUFOQURBQ0FPQUFEUkF3QWdEd0FBMGdNQUlCQUFBTk1EQUNBUkFBRFVBd0FnSEFBQS13VUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaDh3RUJBTWdEQUNIMEFRRUF5QU1BSWZVQkFRRElBd0FoOWdFQkFNZ0RBQ0g0QVFBQXlRUDRBU0w2QVFBQXlnUDZBU0w4QVFBQXl3UDhBU0w5QVNBQXpBTUFJZjRCSUFETUF3QWhfd0VDQU0wREFDR0FBa0FBdlFNQUlSWURBQURPQXdBZ0N3QUF6d01BSUF3QUFOQURBQ0FPQUFEUkF3QWdEd0FBMGdNQUlCQUFBTk1EQUNBUkFBRFVBd0FnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZkVCQVFDOEF3QWg4Z0VCQUx3REFDSHpBUUVBeUFNQUlmUUJBUURJQXdBaDlRRUJBTWdEQUNIMkFRRUF5QU1BSWZnQkFBREpBX2dCSXZvQkFBREtBX29CSXZ3QkFBRExBX3dCSXYwQklBRE1Bd0FoX2dFZ0FNd0RBQ0hfQVFJQXpRTUFJWUFDUUFDOUF3QWhGZ3NBQUpZRkFDQU1BQUNYQlFBZ0RnQUFtQVVBSUE4QUFKa0ZBQ0FRQUFDYUJRQWdFUUFBbXdVQUlCSUFBSndGQUNEaUFRRUFBQUFCNVFGQUFBQUFBZkVCQVFBQUFBSHlBUUVBQUFBQjh3RUJBQUFBQWZRQkFRQUFBQUgxQVFFQUFBQUI5Z0VCQUFBQUFmZ0JBQUFBLUFFQy1nRUFBQUQ2QVFMOEFRQUFBUHdCQXYwQklBQUFBQUgtQVNBQUFBQUJfd0VDQUFBQUFZQUNRQUFBQUFFQ0FBQUFud0lBSUNNQUFQd0ZBQ0FEQUFBQW9nSUFJQ01BQVB3RkFDQWtBQUNBQmdBZ0dBQUFBS0lDQUNBTEFBRFBBd0FnREFBQTBBTUFJQTRBQU5FREFDQVBBQURTQXdBZ0VBQUEwd01BSUJFQUFOUURBQ0FTQUFEVkF3QWdIQUFBZ0FZQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoOHdFQkFNZ0RBQ0gwQVFFQXlBTUFJZlVCQVFESUF3QWg5Z0VCQU1nREFDSDRBUUFBeVFQNEFTTDZBUUFBeWdQNkFTTDhBUUFBeXdQOEFTTDlBU0FBekFNQUlmNEJJQURNQXdBaF93RUNBTTBEQUNHQUFrQUF2UU1BSVJZTEFBRFBBd0FnREFBQTBBTUFJQTRBQU5FREFDQVBBQURTQXdBZ0VBQUEwd01BSUJFQUFOUURBQ0FTQUFEVkF3QWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaEJlSUJBUUFBQUFIbEFVQUFBQUFCOFFFQkFBQUFBWUFDUUFBQUFBR0ZBZ0VBQUFBQkFnQUFBSDhBSUNNQUFJRUdBQ0FXQXdBQWxRVUFJQXdBQUpjRkFDQU9BQUNZQlFBZ0R3QUFtUVVBSUJBQUFKb0ZBQ0FSQUFDYkJRQWdFZ0FBbkFVQUlPSUJBUUFBQUFIbEFVQUFBQUFCOFFFQkFBQUFBZklCQVFBQUFBSHpBUUVBQUFBQjlBRUJBQUFBQWZVQkFRQUFBQUgyQVFFQUFBQUItQUVBQUFENEFRTDZBUUFBQVBvQkF2d0JBQUFBX0FFQ19RRWdBQUFBQWY0QklBQUFBQUhfQVFJQUFBQUJnQUpBQUFBQUFRSUFBQUNmQWdBZ0l3QUFnd1lBSUFNQUFBQ2lBZ0FnSXdBQWd3WUFJQ1FBQUljR0FDQVlBQUFBb2dJQUlBTUFBTTREQUNBTUFBRFFBd0FnRGdBQTBRTUFJQThBQU5JREFDQVFBQURUQXdBZ0VRQUExQU1BSUJJQUFOVURBQ0FjQUFDSEJnQWc0Z0VCQUx3REFDSGxBVUFBdlFNQUlmRUJBUUM4QXdBaDhnRUJBTHdEQUNIekFRRUF5QU1BSWZRQkFRRElBd0FoOVFFQkFNZ0RBQ0gyQVFFQXlBTUFJZmdCQUFESkFfZ0JJdm9CQUFES0Ffb0JJdndCQUFETEFfd0JJdjBCSUFETUF3QWhfZ0VnQU13REFDSF9BUUlBelFNQUlZQUNRQUM5QXdBaEZnTUFBTTREQUNBTUFBRFFBd0FnRGdBQTBRTUFJQThBQU5JREFDQVFBQURUQXdBZ0VRQUExQU1BSUJJQUFOVURBQ0RpQVFFQXZBTUFJZVVCUUFDOUF3QWg4UUVCQUx3REFDSHlBUUVBdkFNQUlmTUJBUURJQXdBaDlBRUJBTWdEQUNIMUFRRUF5QU1BSWZZQkFRRElBd0FoLUFFQUFNa0QtQUVpLWdFQUFNb0QtZ0VpX0FFQUFNc0RfQUVpX1FFZ0FNd0RBQ0gtQVNBQXpBTUFJZjhCQWdETkF3QWhnQUpBQUwwREFDRUk0Z0VCQUFBQUFlTUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3VBZ0tBQWtBQUFBQUJxZ0pBQUFBQUFhc0NBZ0FBQUFHc0FoQUFBQUFCRmdNQUFKVUZBQ0FMQUFDV0JRQWdEZ0FBbUFVQUlBOEFBSmtGQUNBUUFBQ2FCUUFnRVFBQW13VUFJQklBQUp3RkFDRGlBUUVBQUFBQjVRRkFBQUFBQWZFQkFRQUFBQUh5QVFFQUFBQUI4d0VCQUFBQUFmUUJBUUFBQUFIMUFRRUFBQUFCOWdFQkFBQUFBZmdCQUFBQS1BRUMtZ0VBQUFENkFRTDhBUUFBQVB3QkF2MEJJQUFBQUFILUFTQUFBQUFCX3dFQ0FBQUFBWUFDUUFBQUFBRUNBQUFBbndJQUlDTUFBSWtHQUNBREFBQUFvZ0lBSUNNQUFJa0dBQ0FrQUFDTkJnQWdHQUFBQUtJQ0FDQURBQURPQXdBZ0N3QUF6d01BSUE0QUFORURBQ0FQQUFEU0F3QWdFQUFBMHdNQUlCRUFBTlFEQUNBU0FBRFZBd0FnSEFBQWpRWUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlmSUJBUUM4QXdBaDh3RUJBTWdEQUNIMEFRRUF5QU1BSWZVQkFRRElBd0FoOWdFQkFNZ0RBQ0g0QVFBQXlRUDRBU0w2QVFBQXlnUDZBU0w4QVFBQXl3UDhBU0w5QVNBQXpBTUFJZjRCSUFETUF3QWhfd0VDQU0wREFDR0FBa0FBdlFNQUlSWURBQURPQXdBZ0N3QUF6d01BSUE0QUFORURBQ0FQQUFEU0F3QWdFQUFBMHdNQUlCRUFBTlFEQUNBU0FBRFZBd0FnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZkVCQVFDOEF3QWg4Z0VCQUx3REFDSHpBUUVBeUFNQUlmUUJBUURJQXdBaDlRRUJBTWdEQUNIMkFRRUF5QU1BSWZnQkFBREpBX2dCSXZvQkFBREtBX29CSXZ3QkFBRExBX3dCSXYwQklBRE1Bd0FoX2dFZ0FNd0RBQ0hfQVFJQXpRTUFJWUFDUUFDOUF3QWhCLUlCQVFBQUFBSGpBUUVBQUFBQjVRRkFBQUFBQWY0QklBQUFBQUdBQWtBQUFBQUJpZ0lDQUFBQUFaSUNBUUFBQUFFRDRnRUJBQUFBQWVNQkFRQUFBQUhsQVVBQUFBQUJBd0FBQUlJQkFDQWpBQUNCQmdBZ0pBQUFrZ1lBSUFjQUFBQ0NBUUFnSEFBQWtnWUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSHhBUUVBdkFNQUlZQUNRQUM5QXdBaGhRSUJBTHdEQUNFRjRnRUJBTHdEQUNIbEFVQUF2UU1BSWZFQkFRQzhBd0FoZ0FKQUFMMERBQ0dGQWdFQXZBTUFJUTdpQVFFQUFBQUI1UUZBQUFBQUFmb0JBQUFBalFJQ19nRWdBQUFBQVlBQ1FBQUFBQUdFQWdFQUFBQUJoUUlCQUFBQUFZWUNBUUFBQUFHSEFnRUFBQUFCaUFJUUFBQUFBWWtDQWdBQUFBR0tBZ2dBQUFBQml3SUFBSkFGQUNDTkFnRUFBQUFCRXdVQUFKRUZBQ0FHQUFDckJRQWdEQUFBa3dVQUlBMEFBSlFGQUNEaUFRRUFBQUFCNVFGQUFBQUFBZm9CQUFBQWpRSUNfZ0VnQUFBQUFZQUNRQUFBQUFHRUFnRUFBQUFCaFFJQkFBQUFBWVlDQVFBQUFBR0hBZ0VBQUFBQmlBSVFBQUFBQVlrQ0FnQUFBQUdLQWdnQUFBQUJpd0lBQUpBRkFDQ05BZ0VBQUFBQmpnSUJBQUFBQVFJQUFBQUZBQ0FqQUFDVUJnQWdELUlCQVFBQUFBSGxBVUFBQUFBQi1nRUFBQUNjQWdLQUFrQUFBQUFCbHdJQkFBQUFBWmdDQVFBQUFBR1pBaEFBQUFBQm1nSUJBQUFBQVp3Q0FRQUFBQUdkQWdFQUFBQUJuZ0lCQUFBQUFaOENBUUFBQUFHZ0FrQUFBQUFCb1FJQkFBQUFBYUlDUUFBQUFBRURBQUFBQXdBZ0l3QUFsQVlBSUNRQUFKa0dBQ0FWQUFBQUF3QWdCUUFBN0FRQUlBWUFBS29GQUNBTUFBRHVCQUFnRFFBQTd3UUFJQndBQUprR0FDRGlBUUVBdkFNQUllVUJRQUM5QXdBaC1nRUFBT29FalFJaV9nRWdBTXdEQUNHQUFrQUF2UU1BSVlRQ0FRQzhBd0FoaFFJQkFMd0RBQ0dHQWdFQXZBTUFJWWNDQVFDOEF3QWhpQUlRQU1rRUFDR0pBZ0lBelFNQUlZb0NDQURvQkFBaGl3SUFBT2tFQUNDTkFnRUF2QU1BSVk0Q0FRQzhBd0FoRXdVQUFPd0VBQ0FHQUFDcUJRQWdEQUFBN2dRQUlBMEFBTzhFQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFPb0VqUUlpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR0dBZ0VBdkFNQUlZY0NBUUM4QXdBaGlBSVFBTWtFQUNHSkFnSUF6UU1BSVlvQ0NBRG9CQUFoaXdJQUFPa0VBQ0NOQWdFQXZBTUFJWTRDQVFDOEF3QWhDT0lCQVFBQUFBSGtBUUVBQUFBQjVRRkFBQUFBQWZvQkFBQUFyZ0lDZ0FKQUFBQUFBYW9DUUFBQUFBR3JBZ0lBQUFBQnJBSVFBQUFBQVJNRkFBQ1JCUUFnQmdBQXF3VUFJQXNBQUpJRkFDQU5BQUNVQlFBZzRnRUJBQUFBQWVVQlFBQUFBQUg2QVFBQUFJMENBdjRCSUFBQUFBR0FBa0FBQUFBQmhBSUJBQUFBQVlVQ0FRQUFBQUdHQWdFQUFBQUJod0lCQUFBQUFZZ0NFQUFBQUFHSkFnSUFBQUFCaWdJSUFBQUFBWXNDQUFDUUJRQWdqUUlCQUFBQUFZNENBUUFBQUFFQ0FBQUFCUUFnSXdBQW13WUFJQU1BQUFBREFDQWpBQUNiQmdBZ0pBQUFud1lBSUJVQUFBQURBQ0FGQUFEc0JBQWdCZ0FBcWdVQUlBc0FBTzBFQUNBTkFBRHZCQUFnSEFBQW53WUFJT0lCQVFDOEF3QWg1UUZBQUwwREFDSDZBUUFBNmdTTkFpTC1BU0FBekFNQUlZQUNRQUM5QXdBaGhBSUJBTHdEQUNHRkFnRUF2QU1BSVlZQ0FRQzhBd0FoaHdJQkFMd0RBQ0dJQWhBQXlRUUFJWWtDQWdETkF3QWhpZ0lJQU9nRUFDR0xBZ0FBNlFRQUlJMENBUUM4QXdBaGpnSUJBTHdEQUNFVEJRQUE3QVFBSUFZQUFLb0ZBQ0FMQUFEdEJBQWdEUUFBN3dRQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNINkFRQUE2Z1NOQWlMLUFTQUF6QU1BSVlBQ1FBQzlBd0FoaEFJQkFMd0RBQ0dGQWdFQXZBTUFJWVlDQVFDOEF3QWhod0lCQUx3REFDR0lBaEFBeVFRQUlZa0NBZ0ROQXdBaGlnSUlBT2dFQUNHTEFnQUE2UVFBSUkwQ0FRQzhBd0FoamdJQkFMd0RBQ0VINGdFQkFBQUFBZVFCQVFBQUFBSGxBVUFBQUFBQl9nRWdBQUFBQVlBQ1FBQUFBQUdLQWdJQUFBQUJrZ0lCQUFBQUFRZmlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFhOENBUUFBQUFHMEFnRUFBQUFCQ3VJQkFRQUFBQUhsQVVBQUFBQUItZ0VBQUFDeUFnTC1BU0FBQUFBQmdBSkFBQUFBQVlRQ0FRQUFBQUdGQWdFQUFBQUJyZ0lCQUFBQUFhOENBUUFBQUFHd0FnRUFBQUFCQS1JQkFRQUFBQUhrQVFFQUFBQUI1UUZBQUFBQUFRZmlBUUVBQUFBQjVRRkFBQUFBQVlRQ0FRQUFBQUdrQWdBQUFLUUNBcVVDQVFBQUFBR21BZ0VBQUFBQnB3SWdBQUFBQVFzSEFBRDhBd0FnRkFBQS13TUFJQlVBQVA4REFDRGlBUUVBQUFBQjR3RUJBQUFBQWVVQlFBQUFBQUgtQVNBQUFBQUJnQUpBQUFBQUFhOENBUUFBQUFHekFnRUFBQUFCdEFJQkFBQUFBUUlBQUFBQkFDQWpBQUNsQmdBZ0ZnTUFBSlVGQUNBTEFBQ1dCUUFnREFBQWx3VUFJQTRBQUpnRkFDQVBBQUNaQlFBZ0VBQUFtZ1VBSUJJQUFKd0ZBQ0RpQVFFQUFBQUI1UUZBQUFBQUFmRUJBUUFBQUFIeUFRRUFBQUFCOHdFQkFBQUFBZlFCQVFBQUFBSDFBUUVBQUFBQjlnRUJBQUFBQWZnQkFBQUEtQUVDLWdFQUFBRDZBUUw4QVFBQUFQd0JBdjBCSUFBQUFBSC1BU0FBQUFBQl93RUNBQUFBQVlBQ1FBQUFBQUVDQUFBQW53SUFJQ01BQUtjR0FDQU1Fd0FBM0FVQUlPSUJBUUFBQUFIbEFVQUFBQUFCLWdFQUFBQ3lBZ0wtQVNBQUFBQUJnQUpBQUFBQUFZUUNBUUFBQUFHRkFnRUFBQUFCcmdJQkFBQUFBYThDQVFBQUFBR3dBZ0VBQUFBQnNnSUJBQUFBQVFJQUFBQWhBQ0FqQUFDcEJnQWdBd0FBQUtJQ0FDQWpBQUNuQmdBZ0pBQUFyUVlBSUJnQUFBQ2lBZ0FnQXdBQXpnTUFJQXNBQU04REFDQU1BQURRQXdBZ0RnQUEwUU1BSUE4QUFOSURBQ0FRQUFEVEF3QWdFZ0FBMVFNQUlCd0FBSzBHQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0h5QVFFQXZBTUFJZk1CQVFESUF3QWg5QUVCQU1nREFDSDFBUUVBeUFNQUlmWUJBUURJQXdBaC1BRUFBTWtELUFFaS1nRUFBTW9ELWdFaV9BRUFBTXNEX0FFaV9RRWdBTXdEQUNILUFTQUF6QU1BSWY4QkFnRE5Bd0FoZ0FKQUFMMERBQ0VXQXdBQXpnTUFJQXNBQU04REFDQU1BQURRQXdBZ0RnQUEwUU1BSUE4QUFOSURBQ0FRQUFEVEF3QWdFZ0FBMVFNQUlPSUJBUUM4QXdBaDVRRkFBTDBEQUNIeEFRRUF2QU1BSWZJQkFRQzhBd0FoOHdFQkFNZ0RBQ0gwQVFFQXlBTUFJZlVCQVFESUF3QWg5Z0VCQU1nREFDSDRBUUFBeVFQNEFTTDZBUUFBeWdQNkFTTDhBUUFBeXdQOEFTTDlBU0FBekFNQUlmNEJJQURNQXdBaF93RUNBTTBEQUNHQUFrQUF2UU1BSVFmaUFRRUFBQUFCNHdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQWE4Q0FRQUFBQUd6QWdFQUFBQUJBd0FBQUNnQUlDTUFBS1VHQUNBa0FBQ3hCZ0FnRFFBQUFDZ0FJQWNBQVBrREFDQVVBQUR1QXdBZ0ZRQUE3d01BSUJ3QUFMRUdBQ0RpQVFFQXZBTUFJZU1CQVFDOEF3QWg1UUZBQUwwREFDSC1BU0FBekFNQUlZQUNRQUM5QXdBaHJ3SUJBTHdEQUNHekFnRUF2QU1BSWJRQ0FRRElBd0FoQ3djQUFQa0RBQ0FVQUFEdUF3QWdGUUFBN3dNQUlPSUJBUUM4QXdBaDR3RUJBTHdEQUNIbEFVQUF2UU1BSWY0QklBRE1Bd0FoZ0FKQUFMMERBQ0d2QWdFQXZBTUFJYk1DQVFDOEF3QWh0QUlCQU1nREFDRURBQUFBSHdBZ0l3QUFxUVlBSUNRQUFMUUdBQ0FPQUFBQUh3QWdFd0FBMndVQUlCd0FBTFFHQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoLWdFQUFLTUVzZ0lpX2dFZ0FNd0RBQ0dBQWtBQXZRTUFJWVFDQVFDOEF3QWhoUUlCQUx3REFDR3VBZ0VBdkFNQUlhOENBUUM4QXdBaHNBSUJBTHdEQUNHeUFnRUF2QU1BSVF3VEFBRGJCUUFnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFDakJMSUNJdjRCSUFETUF3QWhnQUpBQUwwREFDR0VBZ0VBdkFNQUlZVUNBUUM4QXdBaHJnSUJBTHdEQUNHdkFnRUF2QU1BSWJBQ0FRQzhBd0Foc2dJQkFMd0RBQ0VINGdFQkFBQUFBZVVCUUFBQUFBSC1BU0FBQUFBQmdBSkFBQUFBQWE4Q0FRQUFBQUd6QWdFQUFBQUJ0QUlCQUFBQUFRWGlBUUVBQUFBQjVRRkFBQUFBQVpNQ0FRQUFBQUdVQWtBQUFBQUJsUUpBQUFBQUFSTUZBQUNSQlFBZ0JnQUFxd1VBSUFzQUFKSUZBQ0FNQUFDVEJRQWc0Z0VCQUFBQUFlVUJRQUFBQUFINkFRQUFBSTBDQXY0QklBQUFBQUdBQWtBQUFBQUJoQUlCQUFBQUFZVUNBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDRUFBQUFBR0pBZ0lBQUFBQmlnSUlBQUFBQVlzQ0FBQ1FCUUFnalFJQkFBQUFBWTRDQVFBQUFBRUNBQUFBQlFBZ0l3QUF0d1lBSUJZREFBQ1ZCUUFnQ3dBQWxnVUFJQXdBQUpjRkFDQU9BQUNZQlFBZ0VBQUFtZ1VBSUJFQUFKc0ZBQ0FTQUFDY0JRQWc0Z0VCQUFBQUFlVUJRQUFBQUFIeEFRRUFBQUFCOGdFQkFBQUFBZk1CQVFBQUFBSDBBUUVBQUFBQjlRRUJBQUFBQWZZQkFRQUFBQUg0QVFBQUFQZ0JBdm9CQUFBQS1nRUNfQUVBQUFEOEFRTDlBU0FBQUFBQl9nRWdBQUFBQWY4QkFnQUFBQUdBQWtBQUFBQUJBZ0FBQUo4Q0FDQWpBQUM1QmdBZ0F3QUFBQU1BSUNNQUFMY0dBQ0FrQUFDOUJnQWdGUUFBQUFNQUlBVUFBT3dFQUNBR0FBQ3FCUUFnQ3dBQTdRUUFJQXdBQU80RUFDQWNBQUM5QmdBZzRnRUJBTHdEQUNIbEFVQUF2UU1BSWZvQkFBRHFCSTBDSXY0QklBRE1Bd0FoZ0FKQUFMMERBQ0dFQWdFQXZBTUFJWVVDQVFDOEF3QWhoZ0lCQUx3REFDR0hBZ0VBdkFNQUlZZ0NFQURKQkFBaGlRSUNBTTBEQUNHS0FnZ0E2QVFBSVlzQ0FBRHBCQUFnalFJQkFMd0RBQ0dPQWdFQXZBTUFJUk1GQUFEc0JBQWdCZ0FBcWdVQUlBc0FBTzBFQUNBTUFBRHVCQUFnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZm9CQUFEcUJJMENJdjRCSUFETUF3QWhnQUpBQUwwREFDR0VBZ0VBdkFNQUlZVUNBUUM4QXdBaGhnSUJBTHdEQUNHSEFnRUF2QU1BSVlnQ0VBREpCQUFoaVFJQ0FNMERBQ0dLQWdnQTZBUUFJWXNDQUFEcEJBQWdqUUlCQUx3REFDR09BZ0VBdkFNQUlRTUFBQUNpQWdBZ0l3QUF1UVlBSUNRQUFNQUdBQ0FZQUFBQW9nSUFJQU1BQU00REFDQUxBQURQQXdBZ0RBQUEwQU1BSUE0QUFORURBQ0FRQUFEVEF3QWdFUUFBMUFNQUlCSUFBTlVEQUNBY0FBREFCZ0FnNGdFQkFMd0RBQ0hsQVVBQXZRTUFJZkVCQVFDOEF3QWg4Z0VCQUx3REFDSHpBUUVBeUFNQUlmUUJBUURJQXdBaDlRRUJBTWdEQUNIMkFRRUF5QU1BSWZnQkFBREpBX2dCSXZvQkFBREtBX29CSXZ3QkFBRExBX3dCSXYwQklBRE1Bd0FoX2dFZ0FNd0RBQ0hfQVFJQXpRTUFJWUFDUUFDOUF3QWhGZ01BQU00REFDQUxBQURQQXdBZ0RBQUEwQU1BSUE0QUFORURBQ0FRQUFEVEF3QWdFUUFBMUFNQUlCSUFBTlVEQUNEaUFRRUF2QU1BSWVVQlFBQzlBd0FoOFFFQkFMd0RBQ0h5QVFFQXZBTUFJZk1CQVFESUF3QWg5QUVCQU1nREFDSDFBUUVBeUFNQUlmWUJBUURJQXdBaC1BRUFBTWtELUFFaS1nRUFBTW9ELWdFaV9BRUFBTXNEX0FFaV9RRWdBTXdEQUNILUFTQUF6QU1BSWY4QkFnRE5Bd0FoZ0FKQUFMMERBQ0VGQkFBUkJ3QURGQUFDRlRrQkZqb0JBd1FBRUJFM0FSTUFBd2tEQmdRRUFBOExIUWNNSGdvT0lnSVBJd3NRSncwUktnRVNMZzRHQkFBTUJRQUZCZ0FEQ3d3SERCVUtEUmtMQWdNSEJBUUFCZ0VEQ0FBRUJBQUpCd0FEQ0FBRUNoQUlBUWtBQndFS0VRQUNCd0FEQ0FBRUFnY0FBd2dBQkFNTEdnQU1Hd0FOSEFBQkJ3QURBUWNBQXdnREx3QUxNQUFNTVFBT01nQVBNd0FRTkFBUk5RQVNOZ0FCRVRnQUFSWTdBQUFEQndBREZBQUNGVVVCQXdjQUF4UUFBaFZMQVFNRUFCWXBBQmNxQUJnQUFBQURCQUFXS1FBWEtnQVlBUk1BQXdFVEFBTURCQUFkS1FBZUtnQWZBQUFBQXdRQUhTa0FIaW9BSHdJSEFBTUlBQVFDQndBRENBQUVCUVFBSkNrQUp5b0FLRXNBSlV3QUpnQUFBQUFBQlFRQUpDa0FKeW9BS0VzQUpVd0FKZ0FBQXdRQUxTa0FMaW9BTHdBQUFBTUVBQzBwQUM0cUFDOEFBQUFEQkFBMUtRQTJLZ0EzQUFBQUF3UUFOU2tBTmlvQU53RUhBQU1CQndBREF3UUFQQ2tBUFNvQVBnQUFBQU1FQUR3cEFEMHFBRDRCQ1FBSEFRa0FCd1VFQUVNcEFFWXFBRWRMQUVSTUFFVUFBQUFBQUFVRUFFTXBBRVlxQUVkTEFFUk1BRVVCQndBREFRY0FBd01FQUV3cEFFMHFBRTRBQUFBREJBQk1LUUJOS2dCT0FnY0FBd2dBQkFJSEFBTUlBQVFGQkFCVEtRQldLZ0JYU3dCVVRBQlZBQUFBQUFBRkJBQlRLUUJXS2dCWFN3QlVUQUJWQWdVQUJRWUFBd0lGQUFVR0FBTUZCQUJjS1FCZktnQmdTd0JkVEFCZUFBQUFBQUFGQkFCY0tRQmZLZ0JnU3dCZFRBQmVBQUFGQkFCbEtRQm9LZ0JwU3dCbVRBQm5BQUFBQUFBRkJBQmxLUUJvS2dCcFN3Qm1UQUJuQWdjQUF3Z0FCQUlIQUFNSUFBUURCQUJ1S1FCdktnQndBQUFBQXdRQWJpa0FieW9BY0JjQ0FSZzhBUms5QVJvLUFSc19BUjFCQVI1REVoOUVFeUJIQVNGSkVpSktGQ1ZNQVNaTkFTZE9FaXRSRlN4U0dTMVRBaTVVQWk5VkFqQldBakZYQWpKWkFqTmJFalJjR2pWZUFqWmdFamRoR3poaUFqbGpBanBrRWp0bkhEeG9JRDFwQno1cUJ6OXJCMEJzQjBGdEIwSnZCME54RWtSeUlVVjBCMFoyRWtkM0lraDRCMGw1QjBwNkVrMTlJMDUtS1UtQUFRVlFnUUVGVVlRQkJWS0ZBUVZUaGdFRlZJZ0JCVldLQVJKV2l3RXFWNDBCQlZpUEFSSlprQUVyV3BFQkJWdVNBUVZja3dFU1haWUJMRjZYQVRCZm1RRXhZSm9CTVdHZEFURmluZ0V4WTU4Qk1XU2hBVEZsb3dFU1pxUUJNbWVtQVRGb3FBRVNhYWtCTTJxcUFURnJxd0V4Ykt3QkVtMnZBVFJ1c0FFNGI3RUJEWEN5QVExeHN3RU5jclFCRFhPMUFRMTB0d0VOZGJrQkVuYTZBVGwzdkFFTmVMNEJFbm1fQVRwNndBRU5lOEVCRFh6Q0FSSjl4UUU3ZnNZQlAzX0hBUWlBQWNnQkNJRUJ5UUVJZ2dIS0FRaURBY3NCQ0lRQnpRRUloUUhQQVJLR0FkQUJRSWNCMGdFSWlBSFVBUktKQWRVQlFZb0IxZ0VJaXdIWEFRaU1BZGdCRW8wQjJ3RkNqZ0hjQVVpUEFkMEJEcEFCM2dFT2tRSGZBUTZTQWVBQkRwTUI0UUVPbEFIakFRNlZBZVVCRXBZQjVnRkpsd0hvQVE2WUFlb0JFcGtCNndGS21nSHNBUTZiQWUwQkRwd0I3Z0VTblFIeEFVdWVBZklCVDU4Qjh3RUtvQUgwQVFxaEFmVUJDcUlCOWdFS293SDNBUXFrQWZrQkNxVUItd0VTcGdIOEFWQ25BZjRCQ3FnQmdBSVNxUUdCQWxHcUFZSUNDcXNCZ3dJS3JBR0VBaEt0QVljQ1VxNEJpQUpZcndHSkFnU3dBWW9DQkxFQml3SUVzZ0dNQWdTekFZMENCTFFCandJRXRRR1JBaEsyQVpJQ1diY0JsQUlFdUFHV0FoSzVBWmNDV3JvQm1BSUV1d0daQWdTOEFab0NFcjBCblFKYnZnR2VBbUdfQWFBQ0E4QUJvUUlEd1FHa0FnUENBYVVDQThNQnBnSUR4QUdvQWdQRkFhb0NFc1lCcXdKaXh3R3RBZ1BJQWE4Q0Vza0JzQUpqeWdHeEFnUExBYklDQTh3QnN3SVN6UUcyQW1UT0FiY0NhczhCdUFJTDBBRzVBZ3ZSQWJvQ0M5SUJ1d0lMMHdHOEFndlVBYjRDQzlVQndBSVMxZ0hCQW12WEFjTUNDOWdCeFFJUzJRSEdBbXphQWNjQ0M5c0J5QUlMM0FISkFoTGRBY3dDYmQ0QnpRSnhcIlxufVxuXG5hc3luYyBmdW5jdGlvbiBkZWNvZGVCYXNlNjRBc1dhc20od2FzbUJhc2U2NDogc3RyaW5nKTogUHJvbWlzZTxXZWJBc3NlbWJseS5Nb2R1bGU+IHtcbiAgY29uc3QgeyBCdWZmZXIgfSA9IGF3YWl0IGltcG9ydCgnbm9kZTpidWZmZXInKVxuICBjb25zdCB3YXNtQXJyYXkgPSBCdWZmZXIuZnJvbSh3YXNtQmFzZTY0LCAnYmFzZTY0JylcbiAgcmV0dXJuIG5ldyBXZWJBc3NlbWJseS5Nb2R1bGUod2FzbUFycmF5KVxufVxuXG5jb25maWcuY29tcGlsZXJXYXNtID0ge1xuICBnZXRSdW50aW1lOiBhc3luYyAoKSA9PiBhd2FpdCBpbXBvcnQoXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcucG9zdGdyZXNxbC5tanNcIiksXG5cbiAgZ2V0UXVlcnlDb21waWxlcldhc21Nb2R1bGU6IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB7IHdhc20gfSA9IGF3YWl0IGltcG9ydChcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvcXVlcnlfY29tcGlsZXJfZmFzdF9iZy5wb3N0Z3Jlc3FsLndhc20tYmFzZTY0Lm1qc1wiKVxuICAgIHJldHVybiBhd2FpdCBkZWNvZGVCYXNlNjRBc1dhc20od2FzbSlcbiAgfSxcblxuICBpbXBvcnROYW1lOiBcIi4vcXVlcnlfY29tcGlsZXJfZmFzdF9iZy5qc1wiXG59XG5cblxuXG5leHBvcnQgdHlwZSBMb2dPcHRpb25zPENsaWVudE9wdGlvbnMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9ucz4gPVxuICAnbG9nJyBleHRlbmRzIGtleW9mIENsaWVudE9wdGlvbnMgPyBDbGllbnRPcHRpb25zWydsb2cnXSBleHRlbmRzIEFycmF5PFByaXNtYS5Mb2dMZXZlbCB8IFByaXNtYS5Mb2dEZWZpbml0aW9uPiA/IFByaXNtYS5HZXRFdmVudHM8Q2xpZW50T3B0aW9uc1snbG9nJ10+IDogbmV2ZXIgOiBuZXZlclxuXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudENvbnN0cnVjdG9yIHtcbiAgICAvKipcbiAgICogIyMgUHJpc21hIENsaWVudFxuICAgKiBcbiAgICogVHlwZS1zYWZlIGRhdGFiYXNlIGNsaWVudCBmb3IgVHlwZVNjcmlwdFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gICAqIH0pXG4gICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nQ29tbWVudHNcbiAgICogY29uc3QgYmxvZ0NvbW1lbnRzID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KClcbiAgICogYGBgXG4gICAqIFxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICAgKi9cblxuICBuZXcgPFxuICAgIE9wdGlvbnMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9ucyA9IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zLFxuICAgIExvZ09wdHMgZXh0ZW5kcyBMb2dPcHRpb25zPE9wdGlvbnM+ID0gTG9nT3B0aW9uczxPcHRpb25zPixcbiAgICBPbWl0T3B0cyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10gPSBPcHRpb25zIGV4dGVuZHMgeyBvbWl0OiBpbmZlciBVIH0gPyBVIDogUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSxcbiAgICBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJnc1xuICA+KG9wdGlvbnM6IFByaXNtYS5QcmlzbWFDbGllbnRDb25zdHJ1Y3RvckFyZ3M8T3B0aW9ucz4pOiBQcmlzbWFDbGllbnQ8TG9nT3B0cywgT21pdE9wdHMsIEV4dEFyZ3M+XG59XG5cbi8qKlxuICogIyMgUHJpc21hIENsaWVudFxuICogXG4gKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gKiB9KVxuICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dDb21tZW50c1xuICogY29uc3QgYmxvZ0NvbW1lbnRzID0gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KClcbiAqIGBgYFxuICogXG4gKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICovXG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50PFxuICBpbiBMb2dPcHRzIGV4dGVuZHMgUHJpc21hLkxvZ0xldmVsID0gbmV2ZXIsXG4gIGluIG91dCBPbWl0T3B0cyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10gPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddLFxuICBpbiBvdXQgRXh0QXJncyBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3Ncbj4ge1xuICBbSzogc3ltYm9sXTogeyB0eXBlczogUHJpc21hLlR5cGVNYXA8RXh0QXJncz5bJ290aGVyJ10gfVxuXG4gICRvbjxWIGV4dGVuZHMgTG9nT3B0cz4oZXZlbnRUeXBlOiBWLCBjYWxsYmFjazogKGV2ZW50OiBWIGV4dGVuZHMgJ3F1ZXJ5JyA/IFByaXNtYS5RdWVyeUV2ZW50IDogUHJpc21hLkxvZ0V2ZW50KSA9PiB2b2lkKTogUHJpc21hQ2xpZW50O1xuXG4gIC8qKlxuICAgKiBDb25uZWN0IHdpdGggdGhlIGRhdGFiYXNlXG4gICAqL1xuICAkY29ubmVjdCgpOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTx2b2lkPjtcblxuICAvKipcbiAgICogRGlzY29ubmVjdCBmcm9tIHRoZSBkYXRhYmFzZVxuICAgKi9cbiAgJGRpc2Nvbm5lY3QoKTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8dm9pZD47XG5cbi8qKlxuICAgKiBFeGVjdXRlcyBhIHByZXBhcmVkIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIHJvd3MuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJGV4ZWN1dGVSYXdgVVBEQVRFIFVzZXIgU0VUIGNvb2wgPSAke3RydWV9IFdIRVJFIGVtYWlsID0gJHsndXNlckBlbWFpbC5jb20nfTtgXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkZXhlY3V0ZVJhdzxUID0gdW5rbm93bj4ocXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgUHJpc21hLlNxbCwgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPG51bWJlcj47XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIGEgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWQgcm93cy5cbiAgICogU3VzY2VwdGlibGUgdG8gU1FMIGluamVjdGlvbnMsIHNlZSBkb2N1bWVudGF0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRleGVjdXRlUmF3VW5zYWZlKCdVUERBVEUgVXNlciBTRVQgY29vbCA9ICQxIFdIRVJFIGVtYWlsID0gJDIgOycsIHRydWUsICd1c2VyQGVtYWlsLmNvbScpXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkZXhlY3V0ZVJhd1Vuc2FmZTxUID0gdW5rbm93bj4ocXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPG51bWJlcj47XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIGEgcHJlcGFyZWQgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBgU0VMRUNUYCBkYXRhLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRxdWVyeVJhd2BTRUxFQ1QgKiBGUk9NIFVzZXIgV0hFUkUgaWQgPSAkezF9IE9SIGVtYWlsID0gJHsndXNlckBlbWFpbC5jb20nfTtgXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkcXVlcnlSYXc8VCA9IHVua25vd24+KHF1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFByaXNtYS5TcWwsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxUPjtcblxuICAvKipcbiAgICogUGVyZm9ybXMgYSByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIGBTRUxFQ1RgIGRhdGEuXG4gICAqIFN1c2NlcHRpYmxlIHRvIFNRTCBpbmplY3Rpb25zLCBzZWUgZG9jdW1lbnRhdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdVbnNhZmUoJ1NFTEVDVCAqIEZST00gVXNlciBXSEVSRSBpZCA9ICQxIE9SIGVtYWlsID0gJDI7JywgMSwgJ3VzZXJAZW1haWwuY29tJylcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRxdWVyeVJhd1Vuc2FmZTxUID0gdW5rbm93bj4ocXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPFQ+O1xuXG5cbiAgLyoqXG4gICAqIEFsbG93cyB0aGUgcnVubmluZyBvZiBhIHNlcXVlbmNlIG9mIHJlYWQvd3JpdGUgb3BlcmF0aW9ucyB0aGF0IGFyZSBndWFyYW50ZWVkIHRvIGVpdGhlciBzdWNjZWVkIG9yIGZhaWwgYXMgYSB3aG9sZS5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IFtnZW9yZ2UsIGJvYiwgYWxpY2VdID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihbXG4gICAqICAgcHJpc21hLnVzZXIuY3JlYXRlKHsgZGF0YTogeyBuYW1lOiAnR2VvcmdlJyB9IH0pLFxuICAgKiAgIHByaXNtYS51c2VyLmNyZWF0ZSh7IGRhdGE6IHsgbmFtZTogJ0JvYicgfSB9KSxcbiAgICogICBwcmlzbWEudXNlci5jcmVhdGUoeyBkYXRhOiB7IG5hbWU6ICdBbGljZScgfSB9KSxcbiAgICogXSlcbiAgICogYGBgXG4gICAqIFxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9vcm0vcHJpc21hLWNsaWVudC9xdWVyaWVzL3RyYW5zYWN0aW9ucykuXG4gICAqL1xuICAkdHJhbnNhY3Rpb248UCBleHRlbmRzIFByaXNtYS5QcmlzbWFQcm9taXNlPGFueT5bXT4oYXJnOiBbLi4uUF0sIG9wdGlvbnM/OiB7IG1heFdhaXQ/OiBudW1iZXIsIHRpbWVvdXQ/OiBudW1iZXIsIGlzb2xhdGlvbkxldmVsPzogUHJpc21hLlRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgfSk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPHJ1bnRpbWUuVHlwZXMuVXRpbHMuVW53cmFwVHVwbGU8UD4+XG5cbiAgJHRyYW5zYWN0aW9uPFI+KGZuOiAocHJpc21hOiBPbWl0PFByaXNtYUNsaWVudCwgcnVudGltZS5JVFhDbGllbnREZW55TGlzdD4pID0+IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPFI+LCBvcHRpb25zPzogeyBtYXhXYWl0PzogbnVtYmVyLCB0aW1lb3V0PzogbnVtYmVyLCBpc29sYXRpb25MZXZlbD86IFByaXNtYS5UcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsIH0pOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxSPlxuXG4gICRleHRlbmRzOiBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRXh0ZW5kc0hvb2s8XCJleHRlbmRzXCIsIFByaXNtYS5UeXBlTWFwQ2I8T21pdE9wdHM+LCBFeHRBcmdzLCBydW50aW1lLlR5cGVzLlV0aWxzLkNhbGw8UHJpc21hLlR5cGVNYXBDYjxPbWl0T3B0cz4sIHtcbiAgICBleHRBcmdzOiBFeHRBcmdzXG4gIH0+PlxuXG4gICAgICAvKipcbiAgICogYHByaXNtYS5ibG9nQ29tbWVudGA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipCbG9nQ29tbWVudCoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ0NvbW1lbnRzXG4gICAgKiBjb25zdCBibG9nQ29tbWVudHMgPSBhd2FpdCBwcmlzbWEuYmxvZ0NvbW1lbnQuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGJsb2dDb21tZW50KCk6IFByaXNtYS5CbG9nQ29tbWVudERlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEuYmxvZ1Bvc3RgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQmxvZ1Bvc3QqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dQb3N0c1xuICAgICogY29uc3QgYmxvZ1Bvc3RzID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBibG9nUG9zdCgpOiBQcmlzbWEuQmxvZ1Bvc3REZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmJvb2tpbmdgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQm9va2luZyoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQm9va2luZ3NcbiAgICAqIGNvbnN0IGJvb2tpbmdzID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGJvb2tpbmcoKTogUHJpc21hLkJvb2tpbmdEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmNhdGVnb3J5YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkNhdGVnb3J5KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBDYXRlZ29yaWVzXG4gICAgKiBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBjYXRlZ29yeSgpOiBQcmlzbWEuQ2F0ZWdvcnlEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmNvbnRhY3RNZXNzYWdlYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkNvbnRhY3RNZXNzYWdlKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBDb250YWN0TWVzc2FnZXNcbiAgICAqIGNvbnN0IGNvbnRhY3RNZXNzYWdlcyA9IGF3YWl0IHByaXNtYS5jb250YWN0TWVzc2FnZS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgY29udGFjdE1lc3NhZ2UoKTogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5ub3RpZmljYXRpb25gOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqTm90aWZpY2F0aW9uKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBOb3RpZmljYXRpb25zXG4gICAgKiBjb25zdCBub3RpZmljYXRpb25zID0gYXdhaXQgcHJpc21hLm5vdGlmaWNhdGlvbi5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgbm90aWZpY2F0aW9uKCk6IFByaXNtYS5Ob3RpZmljYXRpb25EZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnBheW1lbnRgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqUGF5bWVudCoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgUGF5bWVudHNcbiAgICAqIGNvbnN0IHBheW1lbnRzID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHBheW1lbnQoKTogUHJpc21hLlBheW1lbnREZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnJlZnJlc2hUb2tlbmA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipSZWZyZXNoVG9rZW4qKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFJlZnJlc2hUb2tlbnNcbiAgICAqIGNvbnN0IHJlZnJlc2hUb2tlbnMgPSBhd2FpdCBwcmlzbWEucmVmcmVzaFRva2VuLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCByZWZyZXNoVG9rZW4oKTogUHJpc21hLlJlZnJlc2hUb2tlbkRlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEucmV2aWV3YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlJldmlldyoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgUmV2aWV3c1xuICAgICogY29uc3QgcmV2aWV3cyA9IGF3YWl0IHByaXNtYS5yZXZpZXcuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHJldmlldygpOiBQcmlzbWEuUmV2aWV3RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS50b3VyUGFja2FnZWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipUb3VyUGFja2FnZSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgVG91clBhY2thZ2VzXG4gICAgKiBjb25zdCB0b3VyUGFja2FnZXMgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHRvdXJQYWNrYWdlKCk6IFByaXNtYS5Ub3VyUGFja2FnZURlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEudXNlcmA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipVc2VyKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBVc2Vyc1xuICAgICogY29uc3QgdXNlcnMgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgdXNlcigpOiBQcmlzbWEuVXNlckRlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEud2lzaGxpc3RJdGVtYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKldpc2hsaXN0SXRlbSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgV2lzaGxpc3RJdGVtc1xuICAgICogY29uc3Qgd2lzaGxpc3RJdGVtcyA9IGF3YWl0IHByaXNtYS53aXNobGlzdEl0ZW0uZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHdpc2hsaXN0SXRlbSgpOiBQcmlzbWEuV2lzaGxpc3RJdGVtRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9Pjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFByaXNtYUNsaWVudENsYXNzKCk6IFByaXNtYUNsaWVudENvbnN0cnVjdG9yIHtcbiAgcmV0dXJuIHJ1bnRpbWUuZ2V0UHJpc21hQ2xpZW50KGNvbmZpZykgYXMgdW5rbm93biBhcyBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvclxufVxuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogV0FSTklORzogVGhpcyBpcyBhbiBpbnRlcm5hbCBmaWxlIHRoYXQgaXMgc3ViamVjdCB0byBjaGFuZ2UhXG4gKlxuICogXHVEODNEXHVERUQxIFVuZGVyIG5vIGNpcmN1bXN0YW5jZXMgc2hvdWxkIHlvdSBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5ISBcdUQ4M0RcdURFRDFcbiAqXG4gKiBBbGwgZXhwb3J0cyBmcm9tIHRoaXMgZmlsZSBhcmUgd3JhcHBlZCB1bmRlciBhIGBQcmlzbWFgIG5hbWVzcGFjZSBvYmplY3QgaW4gdGhlIGNsaWVudC50cyBmaWxlLlxuICogV2hpbGUgdGhpcyBlbmFibGVzIHBhcnRpYWwgYmFja3dhcmQgY29tcGF0aWJpbGl0eSwgaXQgaXMgbm90IHBhcnQgb2YgdGhlIHN0YWJsZSBwdWJsaWMgQVBJLlxuICpcbiAqIElmIHlvdSBhcmUgbG9va2luZyBmb3IgeW91ciBNb2RlbHMsIEVudW1zLCBhbmQgSW5wdXQgVHlwZXMsIHBsZWFzZSBpbXBvcnQgdGhlbSBmcm9tIHRoZSByZXNwZWN0aXZlXG4gKiBtb2RlbCBmaWxlcyBpbiB0aGUgYG1vZGVsYCBkaXJlY3RvcnkhXG4gKi9cblxuaW1wb3J0ICogYXMgcnVudGltZSBmcm9tIFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9jbGllbnRcIlxuaW1wb3J0IHR5cGUgKiBhcyBQcmlzbWEgZnJvbSBcIi4uL21vZGVsc1wiXG5pbXBvcnQgeyB0eXBlIFByaXNtYUNsaWVudCB9IGZyb20gXCIuL2NsYXNzXCJcblxuZXhwb3J0IHR5cGUgKiBmcm9tICcuLi9tb2RlbHMnXG5cbmV4cG9ydCB0eXBlIERNTUYgPSB0eXBlb2YgcnVudGltZS5ETU1GXG5cbmV4cG9ydCB0eXBlIFByaXNtYVByb21pc2U8VD4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5QcmlzbWFQcm9taXNlPFQ+XG5cbi8qKlxuICogUHJpc21hIEVycm9yc1xuICovXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclxuXG4vKipcbiAqIFJlLWV4cG9ydCBvZiBzcWwtdGVtcGxhdGUtdGFnXG4gKi9cbmV4cG9ydCBjb25zdCBzcWwgPSBydW50aW1lLnNxbHRhZ1xuZXhwb3J0IGNvbnN0IGVtcHR5ID0gcnVudGltZS5lbXB0eVxuZXhwb3J0IGNvbnN0IGpvaW4gPSBydW50aW1lLmpvaW5cbmV4cG9ydCBjb25zdCByYXcgPSBydW50aW1lLnJhd1xuZXhwb3J0IGNvbnN0IFNxbCA9IHJ1bnRpbWUuU3FsXG5leHBvcnQgdHlwZSBTcWwgPSBydW50aW1lLlNxbFxuXG5cblxuLyoqXG4gKiBEZWNpbWFsLmpzXG4gKi9cbmV4cG9ydCBjb25zdCBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5leHBvcnQgdHlwZSBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5cbmV4cG9ydCB0eXBlIERlY2ltYWxKc0xpa2UgPSBydW50aW1lLkRlY2ltYWxKc0xpa2VcblxuLyoqXG4qIEV4dGVuc2lvbnNcbiovXG5leHBvcnQgdHlwZSBFeHRlbnNpb24gPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuVXNlckFyZ3NcbmV4cG9ydCBjb25zdCBnZXRFeHRlbnNpb25Db250ZXh0ID0gcnVudGltZS5FeHRlbnNpb25zLmdldEV4dGVuc2lvbkNvbnRleHRcbmV4cG9ydCB0eXBlIEFyZ3M8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLkFyZ3M8VCwgRj5cbmV4cG9ydCB0eXBlIFBheWxvYWQ8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uID0gbmV2ZXI+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuUGF5bG9hZDxULCBGPlxuZXhwb3J0IHR5cGUgUmVzdWx0PFQsIEEsIEYgZXh0ZW5kcyBydW50aW1lLk9wZXJhdGlvbj4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5SZXN1bHQ8VCwgQSwgRj5cbmV4cG9ydCB0eXBlIEV4YWN0PEEsIFc+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuRXhhY3Q8QSwgVz5cblxuZXhwb3J0IHR5cGUgUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBzdHJpbmdcbiAgZW5naW5lOiBzdHJpbmdcbn1cblxuLyoqXG4gKiBQcmlzbWEgQ2xpZW50IEpTIHZlcnNpb246IDcuOS4xXG4gKiBRdWVyeSBFbmdpbmUgdmVyc2lvbjogZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFxuICovXG5leHBvcnQgY29uc3QgcHJpc21hVmVyc2lvbjogUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBcIjcuOS4xXCIsXG4gIGVuZ2luZTogXCJlOTIyMDg5YjdkNzUwMmFmZjQyNDlkNWRhMzQyMGY2ZmE1NWZjNmFkXCJcbn1cblxuLyoqXG4gKiBVdGlsaXR5IFR5cGVzXG4gKi9cblxuZXhwb3J0IHR5cGUgQnl0ZXMgPSBydW50aW1lLkJ5dGVzXG5leHBvcnQgdHlwZSBKc29uT2JqZWN0ID0gcnVudGltZS5Kc29uT2JqZWN0XG5leHBvcnQgdHlwZSBKc29uQXJyYXkgPSBydW50aW1lLkpzb25BcnJheVxuZXhwb3J0IHR5cGUgSnNvblZhbHVlID0gcnVudGltZS5Kc29uVmFsdWVcbmV4cG9ydCB0eXBlIElucHV0SnNvbk9iamVjdCA9IHJ1bnRpbWUuSW5wdXRKc29uT2JqZWN0XG5leHBvcnQgdHlwZSBJbnB1dEpzb25BcnJheSA9IHJ1bnRpbWUuSW5wdXRKc29uQXJyYXlcbmV4cG9ydCB0eXBlIElucHV0SnNvblZhbHVlID0gcnVudGltZS5JbnB1dEpzb25WYWx1ZVxuXG5cbmV4cG9ydCBjb25zdCBOdWxsVHlwZXMgPSB7XG4gIERiTnVsbDogcnVudGltZS5OdWxsVHlwZXMuRGJOdWxsIGFzIChuZXcgKHNlY3JldDogbmV2ZXIpID0+IHR5cGVvZiBydW50aW1lLkRiTnVsbCksXG4gIEpzb25OdWxsOiBydW50aW1lLk51bGxUeXBlcy5Kc29uTnVsbCBhcyAobmV3IChzZWNyZXQ6IG5ldmVyKSA9PiB0eXBlb2YgcnVudGltZS5Kc29uTnVsbCksXG4gIEFueU51bGw6IHJ1bnRpbWUuTnVsbFR5cGVzLkFueU51bGwgYXMgKG5ldyAoc2VjcmV0OiBuZXZlcikgPT4gdHlwZW9mIHJ1bnRpbWUuQW55TnVsbCksXG59XG4vKipcbiAqIEhlbHBlciBmb3IgZmlsdGVyaW5nIEpTT04gZW50cmllcyB0aGF0IGhhdmUgYG51bGxgIG9uIHRoZSBkYXRhYmFzZSAoZW1wdHkgb24gdGhlIGRiKVxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IERiTnVsbCA9IHJ1bnRpbWUuRGJOdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgaGF2ZSBKU09OIGBudWxsYCB2YWx1ZXMgKG5vdCBlbXB0eSBvbiB0aGUgZGIpXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgSnNvbk51bGwgPSBydW50aW1lLkpzb25OdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgYXJlIGBQcmlzbWEuRGJOdWxsYCBvciBgUHJpc21hLkpzb25OdWxsYFxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IEFueU51bGwgPSBydW50aW1lLkFueU51bGxcblxuXG50eXBlIFNlbGVjdEFuZEluY2x1ZGUgPSB7XG4gIHNlbGVjdDogYW55XG4gIGluY2x1ZGU6IGFueVxufVxuXG50eXBlIFNlbGVjdEFuZE9taXQgPSB7XG4gIHNlbGVjdDogYW55XG4gIG9taXQ6IGFueVxufVxuXG4vKipcbiAqIEZyb20gVCwgcGljayBhIHNldCBvZiBwcm9wZXJ0aWVzIHdob3NlIGtleXMgYXJlIGluIHRoZSB1bmlvbiBLXG4gKi9cbnR5cGUgUHJpc21hX19QaWNrPFQsIEsgZXh0ZW5kcyBrZXlvZiBUPiA9IHtcbiAgICBbUCBpbiBLXTogVFtQXTtcbn07XG5cbmV4cG9ydCB0eXBlIEVudW1lcmFibGU8VD4gPSBUIHwgQXJyYXk8VD47XG5cbi8qKlxuICogU3Vic2V0XG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAuIFNpbXBsZSB2ZXJzaW9uIG9mIEludGVyc2VjdGlvblxuICovXG5leHBvcnQgdHlwZSBTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlcjtcbn07XG5cbi8qKlxuICogUmVzb2x2ZWQgdHlwZSBvZiB0aGUgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBgUHJpc21hQ2xpZW50YCBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBXaGVuIGNhbGxlZCB3aXRob3V0IGEgbmFycm93ZXIgb3B0aW9ucyB0eXBlICh0aGUgY29tbW9uIGNhc2UpLCB0aGlzIHJlc29sdmVzXG4gKiB0byBgUHJpc21hQ2xpZW50T3B0aW9uc2AgZGlyZWN0bHksIHdoaWNoIHByb2R1Y2VzIGEgY2xlYXIgVHlwZVNjcmlwdCBlcnJvclxuICogbWVzc2FnZSAoYG5vdCBhc3NpZ25hYmxlIHRvIHBhcmFtZXRlciBvZiB0eXBlICdQcmlzbWFDbGllbnRPcHRpb25zJ2ApIHdoZW5cbiAqIHRoZSBhcmd1bWVudCBpcyBtaXNzaW5nIG9yIGluY29tcGxldGUuIFdoZW4gdGhlIHVzZXIgc3VwcGxpZXMgYSBuYXJyb3dlclxuICogb3B0aW9ucyB0eXBlIChlLmcuIHZpYSBhIGxpdGVyYWwpLCBpdCBmYWxscyBiYWNrIHRvIGBTdWJzZXRgIHRvIGtlZXBcbiAqIGZpbHRlcmluZyBvdXQgdW5rbm93biBwcm9wZXJ0aWVzLlxuICovXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvckFyZ3M8T3B0aW9ucyBleHRlbmRzIFByaXNtYUNsaWVudE9wdGlvbnM+ID1cbiAgW1ByaXNtYUNsaWVudE9wdGlvbnNdIGV4dGVuZHMgW09wdGlvbnNdID8gUHJpc21hQ2xpZW50T3B0aW9ucyA6IFN1YnNldDxPcHRpb25zLCBQcmlzbWFDbGllbnRPcHRpb25zPjtcblxuLyoqXG4gKiBTZWxlY3RTdWJzZXRcbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYC4gU2ltcGxlIHZlcnNpb24gb2YgSW50ZXJzZWN0aW9uLlxuICogQWRkaXRpb25hbGx5LCBpdCB2YWxpZGF0ZXMsIGlmIGJvdGggc2VsZWN0IGFuZCBpbmNsdWRlIGFyZSBwcmVzZW50LiBJZiB0aGUgY2FzZSwgaXQgZXJyb3JzLlxuICovXG5leHBvcnQgdHlwZSBTZWxlY3RTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlclxufSAmXG4gIChUIGV4dGVuZHMgU2VsZWN0QW5kSW5jbHVkZVxuICAgID8gJ1BsZWFzZSBlaXRoZXIgY2hvb3NlIGBzZWxlY3RgIG9yIGBpbmNsdWRlYC4nXG4gICAgOiBUIGV4dGVuZHMgU2VsZWN0QW5kT21pdFxuICAgICAgPyAnUGxlYXNlIGVpdGhlciBjaG9vc2UgYHNlbGVjdGAgb3IgYG9taXRgLidcbiAgICAgIDoge30pXG5cbi8qKlxuICogU3Vic2V0ICsgSW50ZXJzZWN0aW9uXG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAgYW5kIGludGVyc2VjdCBgS2BcbiAqL1xuZXhwb3J0IHR5cGUgU3Vic2V0SW50ZXJzZWN0aW9uPFQsIFUsIEs+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiBrZXkgZXh0ZW5kcyBrZXlvZiBVID8gVFtrZXldIDogbmV2ZXJcbn0gJlxuICBLXG5cbnR5cGUgV2l0aG91dDxULCBVPiA9IHsgW1AgaW4gRXhjbHVkZTxrZXlvZiBULCBrZXlvZiBVPl0/OiBuZXZlciB9O1xuXG4vKipcbiAqIFhPUiBpcyBuZWVkZWQgdG8gaGF2ZSBhIHJlYWwgbXV0dWFsbHkgZXhjbHVzaXZlIHVuaW9uIHR5cGVcbiAqIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQyMTIzNDA3L2RvZXMtdHlwZXNjcmlwdC1zdXBwb3J0LW11dHVhbGx5LWV4Y2x1c2l2ZS10eXBlc1xuICovXG5leHBvcnQgdHlwZSBYT1I8VCwgVT4gPVxuICBUIGV4dGVuZHMgb2JqZWN0ID9cbiAgVSBleHRlbmRzIG9iamVjdCA/XG4gICAgKChXaXRob3V0PFQsIFU+ICYgVSkgfCAoV2l0aG91dDxVLCBUPiAmIFQpKSAmIG9iamVjdFxuICA6IFUgOiBUXG5cblxuLyoqXG4gKiBJcyBUIGEgUmVjb3JkP1xuICovXG50eXBlIElzT2JqZWN0PFQgZXh0ZW5kcyBhbnk+ID0gVCBleHRlbmRzIEFycmF5PGFueT5cbj8gRmFsc2VcbjogVCBleHRlbmRzIERhdGVcbj8gRmFsc2VcbjogVCBleHRlbmRzIFVpbnQ4QXJyYXlcbj8gRmFsc2VcbjogVCBleHRlbmRzIEJpZ0ludFxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgb2JqZWN0XG4/IFRydWVcbjogRmFsc2VcblxuXG4vKipcbiAqIElmIGl0J3MgVFtdLCByZXR1cm4gVFxuICovXG5leHBvcnQgdHlwZSBVbkVudW1lcmF0ZTxUIGV4dGVuZHMgdW5rbm93bj4gPSBUIGV4dGVuZHMgQXJyYXk8aW5mZXIgVT4gPyBVIDogVFxuXG4vKipcbiAqIEZyb20gdHMtdG9vbGJlbHRcbiAqL1xuXG50eXBlIF9fRWl0aGVyPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gT21pdDxPLCBLPiAmXG4gIHtcbiAgICAvLyBNZXJnZSBhbGwgYnV0IEtcbiAgICBbUCBpbiBLXTogUHJpc21hX19QaWNrPE8sIFAgJiBrZXlvZiBPPiAvLyBXaXRoIEsgcG9zc2liaWxpdGllc1xuICB9W0tdXG5cbnR5cGUgRWl0aGVyU3RyaWN0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gU3RyaWN0PF9fRWl0aGVyPE8sIEs+PlxuXG50eXBlIEVpdGhlckxvb3NlPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gQ29tcHV0ZVJhdzxfX0VpdGhlcjxPLCBLPj5cblxudHlwZSBfRWl0aGVyPFxuICBPIGV4dGVuZHMgb2JqZWN0LFxuICBLIGV4dGVuZHMgS2V5LFxuICBzdHJpY3QgZXh0ZW5kcyBCb29sZWFuXG4+ID0ge1xuICAxOiBFaXRoZXJTdHJpY3Q8TywgSz5cbiAgMDogRWl0aGVyTG9vc2U8TywgSz5cbn1bc3RyaWN0XVxuXG5leHBvcnQgdHlwZSBFaXRoZXI8XG4gIE8gZXh0ZW5kcyBvYmplY3QsXG4gIEsgZXh0ZW5kcyBLZXksXG4gIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxXG4+ID0gTyBleHRlbmRzIHVua25vd24gPyBfRWl0aGVyPE8sIEssIHN0cmljdD4gOiBuZXZlclxuXG5leHBvcnQgdHlwZSBVbmlvbiA9IGFueVxuXG5leHBvcnQgdHlwZSBQYXRjaFVuZGVmaW5lZDxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gIFtLIGluIGtleW9mIE9dOiBPW0tdIGV4dGVuZHMgdW5kZWZpbmVkID8gQXQ8TzEsIEs+IDogT1tLXVxufSAmIHt9XG5cbi8qKiBIZWxwZXIgVHlwZXMgZm9yIFwiTWVyZ2VcIiAqKi9cbmV4cG9ydCB0eXBlIEludGVyc2VjdE9mPFUgZXh0ZW5kcyBVbmlvbj4gPSAoXG4gIFUgZXh0ZW5kcyB1bmtub3duID8gKGs6IFUpID0+IHZvaWQgOiBuZXZlclxuKSBleHRlbmRzIChrOiBpbmZlciBJKSA9PiB2b2lkXG4gID8gSVxuICA6IG5ldmVyXG5cbmV4cG9ydCB0eXBlIE92ZXJ3cml0ZTxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gICAgW0sgaW4ga2V5b2YgT106IEsgZXh0ZW5kcyBrZXlvZiBPMSA/IE8xW0tdIDogT1tLXTtcbn0gJiB7fTtcblxudHlwZSBfTWVyZ2U8VSBleHRlbmRzIG9iamVjdD4gPSBJbnRlcnNlY3RPZjxPdmVyd3JpdGU8VSwge1xuICAgIFtLIGluIGtleW9mIFVdLT86IEF0PFUsIEs+O1xufT4+O1xuXG50eXBlIEtleSA9IHN0cmluZyB8IG51bWJlciB8IHN5bWJvbDtcbnR5cGUgQXRTdHJpY3Q8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBPW0sgJiBrZXlvZiBPXTtcbnR5cGUgQXRMb29zZTxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IE8gZXh0ZW5kcyB1bmtub3duID8gQXRTdHJpY3Q8TywgSz4gOiBuZXZlcjtcbmV4cG9ydCB0eXBlIEF0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXksIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxPiA9IHtcbiAgICAxOiBBdFN0cmljdDxPLCBLPjtcbiAgICAwOiBBdExvb3NlPE8sIEs+O1xufVtzdHJpY3RdO1xuXG5leHBvcnQgdHlwZSBDb21wdXRlUmF3PEEgZXh0ZW5kcyBhbnk+ID0gQSBleHRlbmRzIEZ1bmN0aW9uID8gQSA6IHtcbiAgW0sgaW4ga2V5b2YgQV06IEFbS107XG59ICYge307XG5cbmV4cG9ydCB0eXBlIE9wdGlvbmFsRmxhdDxPPiA9IHtcbiAgW0sgaW4ga2V5b2YgT10/OiBPW0tdO1xufSAmIHt9O1xuXG50eXBlIF9SZWNvcmQ8SyBleHRlbmRzIGtleW9mIGFueSwgVD4gPSB7XG4gIFtQIGluIEtdOiBUO1xufTtcblxuLy8gY2F1c2UgdHlwZXNjcmlwdCBub3QgdG8gZXhwYW5kIHR5cGVzIGFuZCBwcmVzZXJ2ZSBuYW1lc1xudHlwZSBOb0V4cGFuZDxUPiA9IFQgZXh0ZW5kcyB1bmtub3duID8gVCA6IG5ldmVyO1xuXG4vLyB0aGlzIHR5cGUgYXNzdW1lcyB0aGUgcGFzc2VkIG9iamVjdCBpcyBlbnRpcmVseSBvcHRpb25hbFxuZXhwb3J0IHR5cGUgQXRMZWFzdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgc3RyaW5nPiA9IE5vRXhwYW5kPFxuICBPIGV4dGVuZHMgdW5rbm93blxuICA/IHwgKEsgZXh0ZW5kcyBrZXlvZiBPID8geyBbUCBpbiBLXTogT1tQXSB9ICYgTyA6IE8pXG4gICAgfCB7W1AgaW4ga2V5b2YgTyBhcyBQIGV4dGVuZHMgSyA/IFAgOiBuZXZlcl0tPzogT1tQXX0gJiBPXG4gIDogbmV2ZXI+O1xuXG50eXBlIF9TdHJpY3Q8VSwgX1UgPSBVPiA9IFUgZXh0ZW5kcyB1bmtub3duID8gVSAmIE9wdGlvbmFsRmxhdDxfUmVjb3JkPEV4Y2x1ZGU8S2V5czxfVT4sIGtleW9mIFU+LCBuZXZlcj4+IDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIFN0cmljdDxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X1N0cmljdDxVPj47XG4vKiogRW5kIEhlbHBlciBUeXBlcyBmb3IgXCJNZXJnZVwiICoqL1xuXG5leHBvcnQgdHlwZSBNZXJnZTxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X01lcmdlPFN0cmljdDxVPj4+O1xuXG5leHBvcnQgdHlwZSBCb29sZWFuID0gVHJ1ZSB8IEZhbHNlXG5cbmV4cG9ydCB0eXBlIFRydWUgPSAxXG5cbmV4cG9ydCB0eXBlIEZhbHNlID0gMFxuXG5leHBvcnQgdHlwZSBOb3Q8QiBleHRlbmRzIEJvb2xlYW4+ID0ge1xuICAwOiAxXG4gIDE6IDBcbn1bQl1cblxuZXhwb3J0IHR5cGUgRXh0ZW5kczxBMSBleHRlbmRzIGFueSwgQTIgZXh0ZW5kcyBhbnk+ID0gW0ExXSBleHRlbmRzIFtuZXZlcl1cbiAgPyAwIC8vIGFueXRoaW5nIGBuZXZlcmAgaXMgZmFsc2VcbiAgOiBBMSBleHRlbmRzIEEyXG4gID8gMVxuICA6IDBcblxuZXhwb3J0IHR5cGUgSGFzPFUgZXh0ZW5kcyBVbmlvbiwgVTEgZXh0ZW5kcyBVbmlvbj4gPSBOb3Q8XG4gIEV4dGVuZHM8RXhjbHVkZTxVMSwgVT4sIFUxPlxuPlxuXG5leHBvcnQgdHlwZSBPcjxCMSBleHRlbmRzIEJvb2xlYW4sIEIyIGV4dGVuZHMgQm9vbGVhbj4gPSB7XG4gIDA6IHtcbiAgICAwOiAwXG4gICAgMTogMVxuICB9XG4gIDE6IHtcbiAgICAwOiAxXG4gICAgMTogMVxuICB9XG59W0IxXVtCMl1cblxuZXhwb3J0IHR5cGUgS2V5czxVIGV4dGVuZHMgVW5pb24+ID0gVSBleHRlbmRzIHVua25vd24gPyBrZXlvZiBVIDogbmV2ZXJcblxuZXhwb3J0IHR5cGUgR2V0U2NhbGFyVHlwZTxULCBPPiA9IE8gZXh0ZW5kcyBvYmplY3QgPyB7XG4gIFtQIGluIGtleW9mIFRdOiBQIGV4dGVuZHMga2V5b2YgT1xuICAgID8gT1tQXVxuICAgIDogbmV2ZXJcbn0gOiBuZXZlclxuXG50eXBlIEZpZWxkUGF0aHM8XG4gIFQsXG4gIFUgPSBPbWl0PFQsICdfYXZnJyB8ICdfc3VtJyB8ICdfY291bnQnIHwgJ19taW4nIHwgJ19tYXgnPlxuPiA9IElzT2JqZWN0PFQ+IGV4dGVuZHMgVHJ1ZSA/IFUgOiBUXG5cbmV4cG9ydCB0eXBlIEdldEhhdmluZ0ZpZWxkczxUPiA9IHtcbiAgW0sgaW4ga2V5b2YgVF06IE9yPFxuICAgIE9yPEV4dGVuZHM8J09SJywgSz4sIEV4dGVuZHM8J0FORCcsIEs+PixcbiAgICBFeHRlbmRzPCdOT1QnLCBLPlxuICA+IGV4dGVuZHMgVHJ1ZVxuICAgID8gLy8gaW5mZXIgaXMgb25seSBuZWVkZWQgdG8gbm90IGhpdCBUUyBsaW1pdFxuICAgICAgLy8gYmFzZWQgb24gdGhlIGJyaWxsaWFudCBpZGVhIG9mIFBpZXJyZS1BbnRvaW5lIE1pbGxzXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzMwMTg4I2lzc3VlY29tbWVudC00Nzg5Mzg0MzdcbiAgICAgIFRbS10gZXh0ZW5kcyBpbmZlciBUS1xuICAgICAgPyBHZXRIYXZpbmdGaWVsZHM8VW5FbnVtZXJhdGU8VEs+IGV4dGVuZHMgb2JqZWN0ID8gTWVyZ2U8VW5FbnVtZXJhdGU8VEs+PiA6IG5ldmVyPlxuICAgICAgOiBuZXZlclxuICAgIDoge30gZXh0ZW5kcyBGaWVsZFBhdGhzPFRbS10+XG4gICAgPyBuZXZlclxuICAgIDogS1xufVtrZXlvZiBUXVxuXG4vKipcbiAqIENvbnZlcnQgdHVwbGUgdG8gdW5pb25cbiAqL1xudHlwZSBfVHVwbGVUb1VuaW9uPFQ+ID0gVCBleHRlbmRzIChpbmZlciBFKVtdID8gRSA6IG5ldmVyXG50eXBlIFR1cGxlVG9VbmlvbjxLIGV4dGVuZHMgcmVhZG9ubHkgYW55W10+ID0gX1R1cGxlVG9VbmlvbjxLPlxuZXhwb3J0IHR5cGUgTWF5YmVUdXBsZVRvVW5pb248VD4gPSBUIGV4dGVuZHMgYW55W10gPyBUdXBsZVRvVW5pb248VD4gOiBUXG5cbi8qKlxuICogTGlrZSBgUGlja2AsIGJ1dCBhZGRpdGlvbmFsbHkgY2FuIGFsc28gYWNjZXB0IGFuIGFycmF5IG9mIGtleXNcbiAqL1xuZXhwb3J0IHR5cGUgUGlja0VudW1lcmFibGU8VCwgSyBleHRlbmRzIEVudW1lcmFibGU8a2V5b2YgVD4gfCBrZXlvZiBUPiA9IFByaXNtYV9fUGljazxULCBNYXliZVR1cGxlVG9VbmlvbjxLPj5cblxuLyoqXG4gKiBFeGNsdWRlIGFsbCBrZXlzIHdpdGggdW5kZXJzY29yZXNcbiAqL1xuZXhwb3J0IHR5cGUgRXhjbHVkZVVuZGVyc2NvcmVLZXlzPFQgZXh0ZW5kcyBzdHJpbmc+ID0gVCBleHRlbmRzIGBfJHtzdHJpbmd9YCA/IG5ldmVyIDogVFxuXG5cbmV4cG9ydCB0eXBlIEZpZWxkUmVmPE1vZGVsLCBGaWVsZFR5cGU+ID0gcnVudGltZS5GaWVsZFJlZjxNb2RlbCwgRmllbGRUeXBlPlxuXG50eXBlIEZpZWxkUmVmSW5wdXRUeXBlPE1vZGVsLCBGaWVsZFR5cGU+ID0gTW9kZWwgZXh0ZW5kcyBuZXZlciA/IG5ldmVyIDogRmllbGRSZWY8TW9kZWwsIEZpZWxkVHlwZT5cblxuXG5leHBvcnQgY29uc3QgTW9kZWxOYW1lID0ge1xuICBCbG9nQ29tbWVudDogJ0Jsb2dDb21tZW50JyxcbiAgQmxvZ1Bvc3Q6ICdCbG9nUG9zdCcsXG4gIEJvb2tpbmc6ICdCb29raW5nJyxcbiAgQ2F0ZWdvcnk6ICdDYXRlZ29yeScsXG4gIENvbnRhY3RNZXNzYWdlOiAnQ29udGFjdE1lc3NhZ2UnLFxuICBOb3RpZmljYXRpb246ICdOb3RpZmljYXRpb24nLFxuICBQYXltZW50OiAnUGF5bWVudCcsXG4gIFJlZnJlc2hUb2tlbjogJ1JlZnJlc2hUb2tlbicsXG4gIFJldmlldzogJ1JldmlldycsXG4gIFRvdXJQYWNrYWdlOiAnVG91clBhY2thZ2UnLFxuICBVc2VyOiAnVXNlcicsXG4gIFdpc2hsaXN0SXRlbTogJ1dpc2hsaXN0SXRlbSdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgTW9kZWxOYW1lID0gKHR5cGVvZiBNb2RlbE5hbWUpW2tleW9mIHR5cGVvZiBNb2RlbE5hbWVdXG5cblxuXG5leHBvcnQgaW50ZXJmYWNlIFR5cGVNYXBDYjxHbG9iYWxPbWl0T3B0aW9ucyA9IHt9PiBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuVXRpbHMuRm48e2V4dEFyZ3M6IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgfSwgcnVudGltZS5UeXBlcy5VdGlscy5SZWNvcmQ8c3RyaW5nLCBhbnk+PiB7XG4gIHJldHVybnM6IFR5cGVNYXA8dGhpc1sncGFyYW1zJ11bJ2V4dEFyZ3MnXSwgR2xvYmFsT21pdE9wdGlvbnM+XG59XG5cbmV4cG9ydCB0eXBlIFR5cGVNYXA8RXh0QXJncyBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3MsIEdsb2JhbE9taXRPcHRpb25zID0ge30+ID0ge1xuICBnbG9iYWxPbWl0T3B0aW9uczoge1xuICAgIG9taXQ6IEdsb2JhbE9taXRPcHRpb25zXG4gIH1cbiAgbWV0YToge1xuICAgIG1vZGVsUHJvcHM6IFwiYmxvZ0NvbW1lbnRcIiB8IFwiYmxvZ1Bvc3RcIiB8IFwiYm9va2luZ1wiIHwgXCJjYXRlZ29yeVwiIHwgXCJjb250YWN0TWVzc2FnZVwiIHwgXCJub3RpZmljYXRpb25cIiB8IFwicGF5bWVudFwiIHwgXCJyZWZyZXNoVG9rZW5cIiB8IFwicmV2aWV3XCIgfCBcInRvdXJQYWNrYWdlXCIgfCBcInVzZXJcIiB8IFwid2lzaGxpc3RJdGVtXCJcbiAgICB0eElzb2xhdGlvbkxldmVsOiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsXG4gIH1cbiAgbW9kZWw6IHtcbiAgICBCbG9nQ29tbWVudDoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkJsb2dDb21tZW50RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudEZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudEZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nQ29tbWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnREZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudFVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dDb21tZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudFVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ0NvbW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nQ29tbWVudEFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUJsb2dDb21tZW50PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ0NvbW1lbnRHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQmxvZ0NvbW1lbnRHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dDb21tZW50Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5CbG9nQ29tbWVudENvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBCbG9nUG9zdDoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRCbG9nUG9zdFBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkJsb2dQb3N0RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3REZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUJsb2dQb3N0PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQmxvZ1Bvc3RHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5CbG9nUG9zdENvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBCb29raW5nOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Cb29raW5nRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0RlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0RlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1Vwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVCb29raW5nPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0dyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Cb29raW5nR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Cb29raW5nQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIENhdGVnb3J5OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJENhdGVnb3J5UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQ2F0ZWdvcnlGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQ2F0ZWdvcnk+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5DYXRlZ29yeUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNhdGVnb3J5Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIENvbnRhY3RNZXNzYWdlOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQ29udGFjdE1lc3NhZ2U+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Db250YWN0TWVzc2FnZUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNvbnRhY3RNZXNzYWdlQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIE5vdGlmaWNhdGlvbjoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Ob3RpZmljYXRpb25GaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25GaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25GaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25EZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvblVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkRlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvblVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvblVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25BZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVOb3RpZmljYXRpb24+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25Hcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuTm90aWZpY2F0aW9uR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25Db3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLk5vdGlmaWNhdGlvbkNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBQYXltZW50OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFBheW1lbnRQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5QYXltZW50RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudERlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudERlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVQYXltZW50PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5QYXltZW50R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5QYXltZW50Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFJlZnJlc2hUb2tlbjoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5SZWZyZXNoVG9rZW5GaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5GaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5GaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5EZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlblVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmVmcmVzaFRva2VuUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlbkRlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlblVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJlZnJlc2hUb2tlblVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJlZnJlc2hUb2tlblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmVmcmVzaFRva2VuVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZWZyZXNoVG9rZW5QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5BZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVSZWZyZXNoVG9rZW4+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5Hcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUmVmcmVzaFRva2VuR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZWZyZXNoVG9rZW5Db3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJlZnJlc2hUb2tlbkNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBSZXZpZXc6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kUmV2aWV3UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUmV2aWV3RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1Vwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUmV2aWV3PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJldmlld0dyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5SZXZpZXdDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgVG91clBhY2thZ2U6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Ub3VyUGFja2FnZUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVUb3VyUGFja2FnZT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlRvdXJQYWNrYWdlR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVG91clBhY2thZ2VDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgVXNlcjoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRVc2VyUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuVXNlckZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlVXNlcj5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVXNlckdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVXNlckNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBXaXNobGlzdEl0ZW06IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1VcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1EZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1VcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1VcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbVVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlV2lzaGxpc3RJdGVtPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLldpc2hsaXN0SXRlbUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5XaXNobGlzdEl0ZW1Db3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0gJiB7XG4gIG90aGVyOiB7XG4gICAgcGF5bG9hZDogYW55XG4gICAgb3BlcmF0aW9uczoge1xuICAgICAgJGV4ZWN1dGVSYXc6IHtcbiAgICAgICAgYXJnczogW3F1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFNxbCwgLi4udmFsdWVzOiBhbnlbXV0sXG4gICAgICAgIHJlc3VsdDogYW55XG4gICAgICB9XG4gICAgICAkZXhlY3V0ZVJhd1Vuc2FmZToge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXV0sXG4gICAgICAgIHJlc3VsdDogYW55XG4gICAgICB9XG4gICAgICAkcXVlcnlSYXc6IHtcbiAgICAgICAgYXJnczogW3F1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFNxbCwgLi4udmFsdWVzOiBhbnlbXV0sXG4gICAgICAgIHJlc3VsdDogYW55XG4gICAgICB9XG4gICAgICAkcXVlcnlSYXdVbnNhZmU6IHtcbiAgICAgICAgYXJnczogW3F1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEVudW1zXG4gKi9cblxuZXhwb3J0IGNvbnN0IFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgPSBydW50aW1lLm1ha2VTdHJpY3RFbnVtKHtcbiAgUmVhZFVuY29tbWl0dGVkOiAnUmVhZFVuY29tbWl0dGVkJyxcbiAgUmVhZENvbW1pdHRlZDogJ1JlYWRDb21taXR0ZWQnLFxuICBSZXBlYXRhYmxlUmVhZDogJ1JlcGVhdGFibGVSZWFkJyxcbiAgU2VyaWFsaXphYmxlOiAnU2VyaWFsaXphYmxlJ1xufSBhcyBjb25zdClcblxuZXhwb3J0IHR5cGUgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCA9ICh0eXBlb2YgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbClba2V5b2YgdHlwZW9mIFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWxdXG5cblxuZXhwb3J0IGNvbnN0IEJsb2dDb21tZW50U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgY29udGVudDogJ2NvbnRlbnQnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICBwb3N0SWQ6ICdwb3N0SWQnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYXJlbnRJZDogJ3BhcmVudElkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBCbG9nQ29tbWVudFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQmxvZ0NvbW1lbnRTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCbG9nQ29tbWVudFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBleGNlcnB0OiAnZXhjZXJwdCcsXG4gIGNvbnRlbnQ6ICdjb250ZW50JyxcbiAgY292ZXJJbWFnZTogJ2NvdmVySW1hZ2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICBhdXRob3JJZDogJ2F1dGhvcklkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCbG9nUG9zdFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQm9va2luZ1NjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRyYXZlbERhdGU6ICd0cmF2ZWxEYXRlJyxcbiAgdHJhdmVsZXJzOiAndHJhdmVsZXJzJyxcbiAgdG90YWxQcmljZTogJ3RvdGFsUHJpY2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYWNrYWdlSWQ6ICdwYWNrYWdlSWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCb29raW5nU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgZW1haWw6ICdlbWFpbCcsXG4gIHN1YmplY3Q6ICdzdWJqZWN0JyxcbiAgbWVzc2FnZTogJ21lc3NhZ2UnLFxuICBpc1Jlc29sdmVkOiAnaXNSZXNvbHZlZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IE5vdGlmaWNhdGlvblNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHR5cGU6ICd0eXBlJyxcbiAgdGl0bGU6ICd0aXRsZScsXG4gIG1lc3NhZ2U6ICdtZXNzYWdlJyxcbiAgbGluazogJ2xpbmsnLFxuICBpc1JlYWQ6ICdpc1JlYWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE5vdGlmaWNhdGlvblNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgTm90aWZpY2F0aW9uU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgTm90aWZpY2F0aW9uU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBQYXltZW50U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgYm9va2luZ0lkOiAnYm9va2luZ0lkJyxcbiAgdHJhbklkOiAndHJhbklkJyxcbiAgdmFsSWQ6ICd2YWxJZCcsXG4gIGFtb3VudDogJ2Ftb3VudCcsXG4gIGN1cnJlbmN5OiAnY3VycmVuY3knLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBnYXRld2F5UGFnZVVybDogJ2dhdGV3YXlQYWdlVXJsJyxcbiAgc3NsU2Vzc2lvbktleTogJ3NzbFNlc3Npb25LZXknLFxuICBjYXJkVHlwZTogJ2NhcmRUeXBlJyxcbiAgYmFua1RyYW5JZDogJ2JhbmtUcmFuSWQnLFxuICBwYWlkQXQ6ICdwYWlkQXQnLFxuICByZWZ1bmRSZWZJZDogJ3JlZnVuZFJlZklkJyxcbiAgcmVmdW5kZWRBdDogJ3JlZnVuZGVkQXQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBheW1lbnRTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFBheW1lbnRTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBQYXltZW50U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBSZWZyZXNoVG9rZW5TY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBoYXNoOiAnaGFzaCcsXG4gIGV4cGlyZXNBdDogJ2V4cGlyZXNBdCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHJldm9rZWRBdDogJ3Jldm9rZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUmVmcmVzaFRva2VuU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBSZWZyZXNoVG9rZW5TY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBSZWZyZXNoVG9rZW5TY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFJldmlld1NjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHJhdGluZzogJ3JhdGluZycsXG4gIGNvbW1lbnQ6ICdjb21tZW50JyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgcGFja2FnZUlkOiAncGFja2FnZUlkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBSZXZpZXdTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFJldmlld1NjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFJldmlld1NjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBkZXNjcmlwdGlvbjogJ2Rlc2NyaXB0aW9uJyxcbiAgbG9jYXRpb246ICdsb2NhdGlvbicsXG4gIHByaWNlOiAncHJpY2UnLFxuICBkdXJhdGlvbjogJ2R1cmF0aW9uJyxcbiAgcmF0aW5nOiAncmF0aW5nJyxcbiAgaW1hZ2VzOiAnaW1hZ2VzJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgY2F0ZWdvcnlJZDogJ2NhdGVnb3J5SWQnLFxuICBhZ2VudElkOiAnYWdlbnRJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFVzZXJTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBuYW1lOiAnbmFtZScsXG4gIGVtYWlsOiAnZW1haWwnLFxuICBwYXNzd29yZDogJ3Bhc3N3b3JkJyxcbiAgZ29vZ2xlSWQ6ICdnb29nbGVJZCcsXG4gIHBob25lOiAncGhvbmUnLFxuICBhdmF0YXJVcmw6ICdhdmF0YXJVcmwnLFxuICByb2xlOiAncm9sZScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGF1dGhQcm92aWRlcjogJ2F1dGhQcm92aWRlcicsXG4gIGVtYWlsVmVyaWZpZWQ6ICdlbWFpbFZlcmlmaWVkJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgdG9rZW5WZXJzaW9uOiAndG9rZW5WZXJzaW9uJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBVc2VyU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBVc2VyU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgVXNlclNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgV2lzaGxpc3RJdGVtU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgcGFja2FnZUlkOiAncGFja2FnZUlkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBXaXNobGlzdEl0ZW1TY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFdpc2hsaXN0SXRlbVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFdpc2hsaXN0SXRlbVNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgU29ydE9yZGVyID0ge1xuICBhc2M6ICdhc2MnLFxuICBkZXNjOiAnZGVzYydcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgU29ydE9yZGVyID0gKHR5cGVvZiBTb3J0T3JkZXIpW2tleW9mIHR5cGVvZiBTb3J0T3JkZXJdXG5cblxuZXhwb3J0IGNvbnN0IFF1ZXJ5TW9kZSA9IHtcbiAgZGVmYXVsdDogJ2RlZmF1bHQnLFxuICBpbnNlbnNpdGl2ZTogJ2luc2Vuc2l0aXZlJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBRdWVyeU1vZGUgPSAodHlwZW9mIFF1ZXJ5TW9kZSlba2V5b2YgdHlwZW9mIFF1ZXJ5TW9kZV1cblxuXG5leHBvcnQgY29uc3QgTnVsbHNPcmRlciA9IHtcbiAgZmlyc3Q6ICdmaXJzdCcsXG4gIGxhc3Q6ICdsYXN0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBOdWxsc09yZGVyID0gKHR5cGVvZiBOdWxsc09yZGVyKVtrZXlvZiB0eXBlb2YgTnVsbHNPcmRlcl1cblxuXG5cbi8qKlxuICogRmllbGQgcmVmZXJlbmNlc1xuICovXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdTdHJpbmcnXG4gKi9cbmV4cG9ydCB0eXBlIFN0cmluZ0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1N0cmluZyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdTdHJpbmdbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdFN0cmluZ0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1N0cmluZ1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Jvb2xlYW4nXG4gKi9cbmV4cG9ydCB0eXBlIEJvb2xlYW5GaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29sZWFuJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RhdGVUaW1lJ1xuICovXG5leHBvcnQgdHlwZSBEYXRlVGltZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RhdGVUaW1lJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RhdGVUaW1lW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3REYXRlVGltZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RhdGVUaW1lW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUG9zdFN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBvc3RTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQb3N0U3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1Bvc3RTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Qb3N0U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUG9zdFN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0ludCdcbiAqL1xuZXhwb3J0IHR5cGUgSW50RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnSW50Jz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0ludFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0SW50RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnSW50W10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGVjaW1hbCdcbiAqL1xuZXhwb3J0IHR5cGUgRGVjaW1hbEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RlY2ltYWwnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGVjaW1hbFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RGVjaW1hbEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RlY2ltYWxbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29raW5nU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtQm9va2luZ1N0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Jvb2tpbmdTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQm9va2luZ1N0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bUJvb2tpbmdTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29raW5nU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnTm90aWZpY2F0aW9uVHlwZSdcbiAqL1xuZXhwb3J0IHR5cGUgRW51bU5vdGlmaWNhdGlvblR5cGVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdOb3RpZmljYXRpb25UeXBlJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ05vdGlmaWNhdGlvblR5cGVbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Ob3RpZmljYXRpb25UeXBlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnTm90aWZpY2F0aW9uVHlwZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BheW1lbnRTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1QYXltZW50U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGF5bWVudFN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYXltZW50U3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUGF5bWVudFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BheW1lbnRTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdGbG9hdCdcbiAqL1xuZXhwb3J0IHR5cGUgRmxvYXRGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdGbG9hdCc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdGbG9hdFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RmxvYXRGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdGbG9hdFtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BhY2thZ2VTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1QYWNrYWdlU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGFja2FnZVN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYWNrYWdlU3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUGFja2FnZVN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BhY2thZ2VTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdSb2xlJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUm9sZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1JvbGUnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUm9sZVtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVJvbGVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdSb2xlW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnVXNlclN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVVzZXJTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdVc2VyU3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1VzZXJTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Vc2VyU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnVXNlclN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0F1dGhQcm92aWRlcidcbiAqL1xuZXhwb3J0IHR5cGUgRW51bUF1dGhQcm92aWRlckZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0F1dGhQcm92aWRlcic+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdBdXRoUHJvdmlkZXJbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1BdXRoUHJvdmlkZXJGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdBdXRoUHJvdmlkZXJbXSc+XG4gICAgXG5cbi8qKlxuICogQmF0Y2ggUGF5bG9hZCBmb3IgdXBkYXRlTWFueSAmIGRlbGV0ZU1hbnkgJiBjcmVhdGVNYW55XG4gKi9cbmV4cG9ydCB0eXBlIEJhdGNoUGF5bG9hZCA9IHtcbiAgY291bnQ6IG51bWJlclxufVxuXG5leHBvcnQgY29uc3QgZGVmaW5lRXh0ZW5zaW9uID0gcnVudGltZS5FeHRlbnNpb25zLmRlZmluZUV4dGVuc2lvbiBhcyB1bmtub3duIGFzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5FeHRlbmRzSG9vazxcImRlZmluZVwiLCBUeXBlTWFwQ2IsIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncz5cbmV4cG9ydCB0eXBlIERlZmF1bHRQcmlzbWFDbGllbnQgPSBQcmlzbWFDbGllbnRcbmV4cG9ydCB0eXBlIEVycm9yRm9ybWF0ID0gJ3ByZXR0eScgfCAnY29sb3JsZXNzJyB8ICdtaW5pbWFsJ1xuLyoqXG4gKiBPcHRpb25zIGNvbW1vbiB0byBhbGwgdmFyaWFudHMgb2YgYFByaXNtYUNsaWVudE9wdGlvbnNgLCByZWdhcmRsZXNzIG9mIHdoZXRoZXIgeW91IGNvbm5lY3QgdG8geW91ciBkYXRhYmFzZSB0aHJvdWdoIGEgZHJpdmVyIGFkYXB0ZXIgb3IgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRCYXNlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBAZGVmYXVsdCBcImNvbG9ybGVzc1wiXG4gICAqL1xuICBlcnJvckZvcm1hdD86IEVycm9yRm9ybWF0XG4gIC8qKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogLy8gU2hvcnRoYW5kIGZvciBgZW1pdDogJ3N0ZG91dCdgXG4gICAqIGxvZzogWydxdWVyeScsICdpbmZvJywgJ3dhcm4nLCAnZXJyb3InXVxuICAgKiBcbiAgICogLy8gRW1pdCBhcyBldmVudHMgb25seVxuICAgKiBsb2c6IFtcbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAncXVlcnknIH0sXG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ2luZm8nIH0sXG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ3dhcm4nIH1cbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAnZXJyb3InIH1cbiAgICogXVxuICAgKiBcbiAgICogLyBFbWl0IGFzIGV2ZW50cyBhbmQgbG9nIHRvIHN0ZG91dFxuICAgKiBvZzogW1xuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICdxdWVyeScgfSxcbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAnaW5mbycgfSxcbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAnd2FybicgfVxuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICdlcnJvcicgfVxuICAgKiBcbiAgICogYGBgXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2xvZ2dpbmcpLlxuICAgKi9cbiAgbG9nPzogKExvZ0xldmVsIHwgTG9nRGVmaW5pdGlvbilbXVxuICAvKipcbiAgICogVGhlIGRlZmF1bHQgdmFsdWVzIGZvciB0cmFuc2FjdGlvbk9wdGlvbnNcbiAgICogbWF4V2FpdCA/PSAyMDAwXG4gICAqIHRpbWVvdXQgPz0gNTAwMFxuICAgKi9cbiAgdHJhbnNhY3Rpb25PcHRpb25zPzoge1xuICAgIG1heFdhaXQ/OiBudW1iZXJcbiAgICB0aW1lb3V0PzogbnVtYmVyXG4gICAgaXNvbGF0aW9uTGV2ZWw/OiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsXG4gIH1cbiAgLyoqXG4gICAqIEdsb2JhbCBjb25maWd1cmF0aW9uIGZvciBvbWl0dGluZyBtb2RlbCBmaWVsZHMgYnkgZGVmYXVsdC5cbiAgICogXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAgICogICBvbWl0OiB7XG4gICAqICAgICB1c2VyOiB7XG4gICAqICAgICAgIHBhc3N3b3JkOiB0cnVlXG4gICAqICAgICB9XG4gICAqICAgfVxuICAgKiB9KVxuICAgKiBgYGBcbiAgICovXG4gIG9taXQ/OiBHbG9iYWxPbWl0Q29uZmlnXG4gIC8qKlxuICAgKiBTUUwgY29tbWVudGVyIHBsdWdpbnMgdGhhdCBhZGQgbWV0YWRhdGEgdG8gU1FMIHF1ZXJpZXMgYXMgY29tbWVudHMuXG4gICAqIENvbW1lbnRzIGZvbGxvdyB0aGUgc3FsY29tbWVudGVyIGZvcm1hdDogaHR0cHM6Ly9nb29nbGUuZ2l0aHViLmlvL3NxbGNvbW1lbnRlci9cbiAgICogXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAgICogICBhZGFwdGVyLFxuICAgKiAgIGNvbW1lbnRzOiBbXG4gICAqICAgICB0cmFjZUNvbnRleHQoKSxcbiAgICogICAgIHF1ZXJ5SW5zaWdodHMoKSxcbiAgICogICBdLFxuICAgKiB9KVxuICAgKiBgYGBcbiAgICovXG4gIGNvbW1lbnRzPzogcnVudGltZS5TcWxDb21tZW50ZXJQbHVnaW5bXVxuICAvKipcbiAgICogT3B0aW9uYWwgbWF4aW11bSBzaXplIGZvciB0aGUgcXVlcnkgcGxhbiBjYWNoZS4gSWYgbm90IHByb3ZpZGVkLCBhIGRlZmF1bHQgc2l6ZSB3aWxsIGJlIHVzZWQuXG4gICAqIEEgdmFsdWUgb2YgYDBgIGNhbiBiZSB1c2VkIHRvIGRpc2FibGUgdGhlIGNhY2hlIGVudGlyZWx5LiBBIGhpZ2hlciBjYWNoZSBzaXplIGNhbiBpbXByb3ZlXG4gICAqIHBlcmZvcm1hbmNlIGZvciBhcHBsaWNhdGlvbnMgdGhhdCBleGVjdXRlIGEgbGFyZ2UgbnVtYmVyIG9mIHVuaXF1ZSBxdWVyaWVzLCB3aGlsZSBhIHNtYWxsZXJcbiAgICogY2FjaGUgc2l6ZSBjYW4gcmVkdWNlIG1lbW9yeSB1c2FnZS5cbiAgICogXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAgICogICBhZGFwdGVyLFxuICAgKiAgIHF1ZXJ5UGxhbkNhY2hlTWF4U2l6ZTogMTAwLFxuICAgKiB9KVxuICAgKiBgYGBcbiAgICovXG4gIHF1ZXJ5UGxhbkNhY2hlTWF4U2l6ZT86IG51bWJlclxufVxuXG4vKipcbiAqIGBQcmlzbWFDbGllbnRgIG9wdGlvbnMgZm9yIGNvbm5lY3RpbmcgdG8geW91ciBkYXRhYmFzZSB0aHJvdWdoIFByaXNtYSBBY2NlbGVyYXRlIGluc3RlYWQgb2YgYSBkcml2ZXIgYWRhcHRlci5cbiAqIFxuICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvYWNjZWxlcmF0ZVxuICovXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWNjZWxlcmF0ZVVybCBleHRlbmRzIFByaXNtYUNsaWVudEJhc2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSBQcmlzbWEgQWNjZWxlcmF0ZSBjb25uZWN0aW9uIFVSTC4gVXNlIHRoaXMgb3B0aW9uIHRvIGNvbm5lY3QgdG8geW91ciBkYXRhYmFzZSB0aHJvdWdoIFByaXNtYSBBY2NlbGVyYXRlIGluc3RlYWQgb2YgdXNpbmcgYSBkcml2ZXIgYWRhcHRlciB0byBjb25uZWN0IGRpcmVjdGx5LlxuICAgKiBcbiAgICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvYWNjZWxlcmF0ZVxuICAgKi9cbiAgYWNjZWxlcmF0ZVVybDogc3RyaW5nXG4gIGFkYXB0ZXI/OiBuZXZlclxufVxuXG4vKipcbiAqIGBQcmlzbWFDbGllbnRgIG9wdGlvbnMgZm9yIGNvbm5lY3RpbmcgdG8geW91ciBkYXRhYmFzZSB0aHJvdWdoIGEgZHJpdmVyIGFkYXB0ZXIuIFRoaXMgaXMgdGhlIGNvbW1vbiBjYXNlIGluIFByaXNtYSA3LlxuICogXG4gKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9kcml2ZXItYWRhcHRlcnNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFkYXB0ZXIgZXh0ZW5kcyBQcmlzbWFDbGllbnRCYXNlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBBIGRyaXZlciBhZGFwdGVyIHRoYXQgUHJpc21hQ2xpZW50IHVzZXMgdG8gY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlLCBzdWNoIGFzIHRoZSBvbmVzIHByb3ZpZGVkIGJ5IGBAcHJpc21hL2FkYXB0ZXItcGdgLCBgQHByaXNtYS9hZGFwdGVyLWxpYnNxbGAsIGBAcHJpc21hL2FkYXB0ZXItcGxhbmV0c2NhbGVgLCBldGMuXG4gICAqIFxuICAgKiBBIGRyaXZlciBhZGFwdGVyIGlzICoqcmVxdWlyZWQqKiB1bmxlc3MgeW91IGNvbm5lY3QgdG8geW91ciBkYXRhYmFzZSB0aHJvdWdoIFByaXNtYSBBY2NlbGVyYXRlIChpbiB3aGljaCBjYXNlIHVzZSBgYWNjZWxlcmF0ZVVybGAgaW5zdGVhZCkuXG4gICAqIFxuICAgKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9kcml2ZXItYWRhcHRlcnNcbiAgICogXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IFByaXNtYVBnIH0gZnJvbSAnQHByaXNtYS9hZGFwdGVyLXBnJ1xuICAgKiBpbXBvcnQgeyBQcmlzbWFDbGllbnQgfSBmcm9tICcuL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50J1xuICAgKiBcbiAgICogY29uc3QgYWRhcHRlciA9IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICAgKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHsgYWRhcHRlciB9KVxuICAgKiBgYGBcbiAgICovXG4gIGFkYXB0ZXI6IHJ1bnRpbWUuU3FsRHJpdmVyQWRhcHRlckZhY3RvcnlcbiAgYWNjZWxlcmF0ZVVybD86IG5ldmVyXG59XG5cbi8qKlxuICogT3B0aW9ucyBwYXNzZWQgdG8gdGhlIGBQcmlzbWFDbGllbnRgIGNvbnN0cnVjdG9yLlxuICogXG4gKiBBIGRyaXZlciBhZGFwdGVyIChvciwgYWx0ZXJuYXRpdmVseSwgYSBQcmlzbWEgQWNjZWxlcmF0ZSBVUkwpIGlzICoqcmVxdWlyZWQqKi4gU2VlIHtAbGluayBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFkYXB0ZXJ9IGFuZCB7QGxpbmsgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBY2NlbGVyYXRlVXJsfSBmb3IgdGhlIHR3byB2YXJpYW50cy4gQWxsIG90aGVyIHByb3BlcnRpZXMgbGl2ZSBpbiB7QGxpbmsgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnN9IGFuZCBhcmUgb3B0aW9uYWwuXG4gKiBcbiAqIExlYXJuIG1vcmUgYWJvdXQgZHJpdmVyIGFkYXB0ZXJzOiBodHRwczovL3ByaXMubHkvZC9kcml2ZXItYWRhcHRlcnNcbiAqL1xuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50T3B0aW9ucyA9IFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWNjZWxlcmF0ZVVybCB8IFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWRhcHRlclxuZXhwb3J0IHR5cGUgR2xvYmFsT21pdENvbmZpZyA9IHtcbiAgYmxvZ0NvbW1lbnQ/OiBQcmlzbWEuQmxvZ0NvbW1lbnRPbWl0XG4gIGJsb2dQb3N0PzogUHJpc21hLkJsb2dQb3N0T21pdFxuICBib29raW5nPzogUHJpc21hLkJvb2tpbmdPbWl0XG4gIGNhdGVnb3J5PzogUHJpc21hLkNhdGVnb3J5T21pdFxuICBjb250YWN0TWVzc2FnZT86IFByaXNtYS5Db250YWN0TWVzc2FnZU9taXRcbiAgbm90aWZpY2F0aW9uPzogUHJpc21hLk5vdGlmaWNhdGlvbk9taXRcbiAgcGF5bWVudD86IFByaXNtYS5QYXltZW50T21pdFxuICByZWZyZXNoVG9rZW4/OiBQcmlzbWEuUmVmcmVzaFRva2VuT21pdFxuICByZXZpZXc/OiBQcmlzbWEuUmV2aWV3T21pdFxuICB0b3VyUGFja2FnZT86IFByaXNtYS5Ub3VyUGFja2FnZU9taXRcbiAgdXNlcj86IFByaXNtYS5Vc2VyT21pdFxuICB3aXNobGlzdEl0ZW0/OiBQcmlzbWEuV2lzaGxpc3RJdGVtT21pdFxufVxuXG4vKiBUeXBlcyBmb3IgTG9nZ2luZyAqL1xuZXhwb3J0IHR5cGUgTG9nTGV2ZWwgPSAnaW5mbycgfCAncXVlcnknIHwgJ3dhcm4nIHwgJ2Vycm9yJ1xuZXhwb3J0IHR5cGUgTG9nRGVmaW5pdGlvbiA9IHtcbiAgbGV2ZWw6IExvZ0xldmVsXG4gIGVtaXQ6ICdzdGRvdXQnIHwgJ2V2ZW50J1xufVxuXG5leHBvcnQgdHlwZSBDaGVja0lzTG9nTGV2ZWw8VD4gPSBUIGV4dGVuZHMgTG9nTGV2ZWwgPyBUIDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIEdldExvZ1R5cGU8VD4gPSBDaGVja0lzTG9nTGV2ZWw8XG4gIFQgZXh0ZW5kcyBMb2dEZWZpbml0aW9uID8gVFsnbGV2ZWwnXSA6IFRcbj47XG5cbmV4cG9ydCB0eXBlIEdldEV2ZW50czxUIGV4dGVuZHMgYW55W10+ID0gVCBleHRlbmRzIEFycmF5PExvZ0xldmVsIHwgTG9nRGVmaW5pdGlvbj5cbiAgPyBHZXRMb2dUeXBlPFRbbnVtYmVyXT5cbiAgOiBuZXZlcjtcblxuZXhwb3J0IHR5cGUgUXVlcnlFdmVudCA9IHtcbiAgdGltZXN0YW1wOiBEYXRlXG4gIHF1ZXJ5OiBzdHJpbmdcbiAgcGFyYW1zOiBzdHJpbmdcbiAgZHVyYXRpb246IG51bWJlclxuICB0YXJnZXQ6IHN0cmluZ1xufVxuXG5leHBvcnQgdHlwZSBMb2dFdmVudCA9IHtcbiAgdGltZXN0YW1wOiBEYXRlXG4gIG1lc3NhZ2U6IHN0cmluZ1xuICB0YXJnZXQ6IHN0cmluZ1xufVxuLyogRW5kIFR5cGVzIGZvciBMb2dnaW5nICovXG5cblxuZXhwb3J0IHR5cGUgUHJpc21hQWN0aW9uID1cbiAgfCAnZmluZFVuaXF1ZSdcbiAgfCAnZmluZFVuaXF1ZU9yVGhyb3cnXG4gIHwgJ2ZpbmRNYW55J1xuICB8ICdmaW5kRmlyc3QnXG4gIHwgJ2ZpbmRGaXJzdE9yVGhyb3cnXG4gIHwgJ2NyZWF0ZSdcbiAgfCAnY3JlYXRlTWFueSdcbiAgfCAnY3JlYXRlTWFueUFuZFJldHVybidcbiAgfCAndXBkYXRlJ1xuICB8ICd1cGRhdGVNYW55J1xuICB8ICd1cGRhdGVNYW55QW5kUmV0dXJuJ1xuICB8ICd1cHNlcnQnXG4gIHwgJ2RlbGV0ZSdcbiAgfCAnZGVsZXRlTWFueSdcbiAgfCAnZXhlY3V0ZVJhdydcbiAgfCAncXVlcnlSYXcnXG4gIHwgJ2FnZ3JlZ2F0ZSdcbiAgfCAnY291bnQnXG4gIHwgJ3J1bkNvbW1hbmRSYXcnXG4gIHwgJ2ZpbmRSYXcnXG4gIHwgJ2dyb3VwQnknXG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgcHJveHkgYXZhaWxhYmxlIGluIGludGVyYWN0aXZlIHRyYW5zYWN0aW9ucy5cbiAqL1xuZXhwb3J0IHR5cGUgVHJhbnNhY3Rpb25DbGllbnQgPSBPbWl0PERlZmF1bHRQcmlzbWFDbGllbnQsIHJ1bnRpbWUuSVRYQ2xpZW50RGVueUxpc3Q+XG5cbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiogVGhpcyBmaWxlIGV4cG9ydHMgYWxsIGVudW0gcmVsYXRlZCB0eXBlcyBmcm9tIHRoZSBzY2hlbWEuXG4qXG4qIFx1RDgzRFx1REZFMiBZb3UgY2FuIGltcG9ydCB0aGlzIGZpbGUgZGlyZWN0bHkuXG4qL1xuXG5leHBvcnQgY29uc3QgUm9sZSA9IHtcbiAgVVNFUjogJ1VTRVInLFxuICBBR0VOVDogJ0FHRU5UJyxcbiAgQURNSU46ICdBRE1JTidcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUm9sZSA9ICh0eXBlb2YgUm9sZSlba2V5b2YgdHlwZW9mIFJvbGVdXG5cblxuZXhwb3J0IGNvbnN0IFVzZXJTdGF0dXMgPSB7XG4gIEFDVElWRTogJ0FDVElWRScsXG4gIFNVU1BFTkRFRDogJ1NVU1BFTkRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVXNlclN0YXR1cyA9ICh0eXBlb2YgVXNlclN0YXR1cylba2V5b2YgdHlwZW9mIFVzZXJTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IEF1dGhQcm92aWRlciA9IHtcbiAgQ1JFREVOVElBTDogJ0NSRURFTlRJQUwnLFxuICBHT09HTEU6ICdHT09HTEUnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEF1dGhQcm92aWRlciA9ICh0eXBlb2YgQXV0aFByb3ZpZGVyKVtrZXlvZiB0eXBlb2YgQXV0aFByb3ZpZGVyXVxuXG5cbmV4cG9ydCBjb25zdCBQYWNrYWdlU3RhdHVzID0ge1xuICBQRU5ESU5HOiAnUEVORElORycsXG4gIEFQUFJPVkVEOiAnQVBQUk9WRUQnLFxuICBSRUpFQ1RFRDogJ1JFSkVDVEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQYWNrYWdlU3RhdHVzID0gKHR5cGVvZiBQYWNrYWdlU3RhdHVzKVtrZXlvZiB0eXBlb2YgUGFja2FnZVN0YXR1c11cblxuXG5leHBvcnQgY29uc3QgQm9va2luZ1N0YXR1cyA9IHtcbiAgUEVORElORzogJ1BFTkRJTkcnLFxuICBQQUlEOiAnUEFJRCcsXG4gIENPTkZJUk1FRDogJ0NPTkZJUk1FRCcsXG4gIENBTkNFTExFRDogJ0NBTkNFTExFRCcsXG4gIENPTVBMRVRFRDogJ0NPTVBMRVRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQm9va2luZ1N0YXR1cyA9ICh0eXBlb2YgQm9va2luZ1N0YXR1cylba2V5b2YgdHlwZW9mIEJvb2tpbmdTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IFBheW1lbnRTdGF0dXMgPSB7XG4gIElOSVRJQVRFRDogJ0lOSVRJQVRFRCcsXG4gIFNVQ0NFU1M6ICdTVUNDRVNTJyxcbiAgRkFJTEVEOiAnRkFJTEVEJyxcbiAgQ0FOQ0VMTEVEOiAnQ0FOQ0VMTEVEJyxcbiAgUkVGVU5ERUQ6ICdSRUZVTkRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGF5bWVudFN0YXR1cyA9ICh0eXBlb2YgUGF5bWVudFN0YXR1cylba2V5b2YgdHlwZW9mIFBheW1lbnRTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IFBvc3RTdGF0dXMgPSB7XG4gIERSQUZUOiAnRFJBRlQnLFxuICBQVUJMSVNIRUQ6ICdQVUJMSVNIRUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBvc3RTdGF0dXMgPSAodHlwZW9mIFBvc3RTdGF0dXMpW2tleW9mIHR5cGVvZiBQb3N0U3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBOb3RpZmljYXRpb25UeXBlID0ge1xuICBCT09LSU5HX0NSRUFURUQ6ICdCT09LSU5HX0NSRUFURUQnLFxuICBCT09LSU5HX0NPTkZJUk1FRDogJ0JPT0tJTkdfQ09ORklSTUVEJyxcbiAgQk9PS0lOR19DQU5DRUxMRUQ6ICdCT09LSU5HX0NBTkNFTExFRCcsXG4gIFBBQ0tBR0VfQVBQUk9WRUQ6ICdQQUNLQUdFX0FQUFJPVkVEJyxcbiAgUEFDS0FHRV9SRUpFQ1RFRDogJ1BBQ0tBR0VfUkVKRUNURUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE5vdGlmaWNhdGlvblR5cGUgPSAodHlwZW9mIE5vdGlmaWNhdGlvblR5cGUpW2tleW9mIHR5cGVvZiBOb3RpZmljYXRpb25UeXBlXVxuIiwgIi8vIEFwcEVycm9yIGtlZXBzIHRoZSBleGFjdCBzYW1lIFwianVzdCB0aHJvdyBpdFwiIGVyZ29ub21pY3MgYnV0IGNhcnJpZXNcbi8vIGEgc3RhdHVzQ29kZSB0aGUgZ2xvYmFsIGhhbmRsZXIgY2FuIHJlYWQgKHNlZSBtaWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cykuXG5leHBvcnQgY2xhc3MgQXBwRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIHN0YXR1c0NvZGU6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihzdGF0dXNDb2RlOiBudW1iZXIsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9IFwiQXBwRXJyb3JcIjtcbiAgICB0aGlzLnN0YXR1c0NvZGUgPSBzdGF0dXNDb2RlO1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHRoaXMuY29uc3RydWN0b3IpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgUHJpc21hUGcgfSBmcm9tIFwiQHByaXNtYS9hZGFwdGVyLXBnXCI7XG5pbXBvcnQgeyBQcmlzbWFDbGllbnQgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG5jb25zdCBjb25uZWN0aW9uU3RyaW5nID0gY29uZmlnLmRhdGFiYXNlX3VybDtcblxuLy8gU2VydmVybGVzcy1mcmllbmRseSBwb29sOiBvbmUgY29ubmVjdGlvbiBwZXIgd2FybSBpbnN0YW5jZSBzbyBtYW55XG4vLyBjb25jdXJyZW50IGludm9jYXRpb25zIGNhbid0IGV4aGF1c3QgdGhlIGRhdGFiYXNlJ3MgY29ubmVjdGlvbiBsaW1pdC5cbi8vIExvY2FsL1ZNIHJ1bnMgYXJlIHVuYWZmZWN0ZWQgKGEgc2luZ2xlIHByb2Nlc3MgdXNlcyBvbmUgY29ubmVjdGlvbiBhbnl3YXkpLlxuY29uc3QgYWRhcHRlciA9IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmcsIG1heDogMSB9KTtcbmNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoeyBhZGFwdGVyIH0pO1xuXG5leHBvcnQgeyBwcmlzbWEgfTtcbiIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgYXV0aENvbnRyb2xsZXIgfSBmcm9tIFwiLi9hdXRoLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGF1dGhWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2F1dGgudmFsaWRhdGlvblwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIFJlZ2lzdGVyIFx1MjAxNCByb2xlIGlzIG9wdGlvbmFsIGFuZCByZXN0cmljdGVkIHRvIFVTRVIvQUdFTlQgaW4gdGhlIHNlcnZpY2VcbnJvdXRlci5wb3N0KFxuICBcIi9yZWdpc3RlclwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVnaXN0ZXJTY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlZ2lzdGVyVXNlcixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9sb2dpblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMubG9naW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmxvZ2luVXNlcixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9nb29nbGVcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmdvb2dsZUxvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5nb29nbGVMb2dpbixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9kZW1vLWxvZ2luXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5kZW1vTG9naW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmRlbW9Mb2dpbixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9yZWZyZXNoXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5yZWZyZXNoVG9rZW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlZnJlc2hUb2tlbixcbik7XG5cbnJvdXRlci5wb3N0KFwiL2xvZ291dFwiLCBhdXRoKCksIGF1dGhDb250cm9sbGVyLmxvZ291dFVzZXIpO1xuXG5yb3V0ZXIuZ2V0KFwiL21lXCIsIGF1dGgoKSwgYXV0aENvbnRyb2xsZXIuZ2V0TWUpO1xuXG4vLyBTdGVwIDIxIFx1MjAxNCBlbWFpbCB2ZXJpZmljYXRpb24gKyBwYXNzd29yZCByZXNldCAoYWxsIHB1YmxpYzsgcmF0ZS1saW1pdGVkIHZpYVxuLy8gYXV0aExpbWl0ZXIgaW4gYXBwLnRzIHRvIGJvdW5kIE9UUCBicnV0ZSBmb3JjZSArIGVtYWlsIGJvbWJpbmcpXG5yb3V0ZXIucG9zdChcbiAgXCIvdmVyaWZ5LWVtYWlsXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy52ZXJpZnlFbWFpbFNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIudmVyaWZ5RW1haWwsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVzZW5kLXZlcmlmaWNhdGlvblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVzZW5kVmVyaWZpY2F0aW9uU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZXNlbmRWZXJpZmljYXRpb24sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZm9yZ290LXBhc3N3b3JkXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5mb3Jnb3RQYXNzd29yZFNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIuZm9yZ290UGFzc3dvcmQsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVzZXQtcGFzc3dvcmRcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLnJlc2V0UGFzc3dvcmRTY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlc2V0UGFzc3dvcmQsXG4pO1xuXG5leHBvcnQgY29uc3QgYXV0aFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGF1dGhTZXJ2aWNlIH0gZnJvbSBcIi4vYXV0aC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuY29uc3QgaXNQcm9kdWN0aW9uID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiO1xuXG4vLyBEZXYgKGxvY2FsaG9zdDozMDAwIFx1MjE5MiA6NDAwMCkgaXMgc2FtZS1zaXRlIFx1MjE5MiBsYXggd29ya3Mgd2l0aCBzZWN1cmU6ZmFsc2UuXG4vLyBQcm9kIChjcm9zcy1zaXRlIGZyb250ZW5kL2JhY2tlbmQpIHJlcXVpcmVzIFNhbWVTaXRlPU5vbmUgKyBTZWN1cmUuXG5jb25zdCBjb29raWVPcHRpb25zOiB7XG4gIGh0dHBPbmx5OiB0cnVlO1xuICBzZWN1cmU6IGJvb2xlYW47XG4gIHNhbWVTaXRlOiBcImxheFwiIHwgXCJub25lXCI7XG59ID0ge1xuICBodHRwT25seTogdHJ1ZSxcbiAgc2VjdXJlOiBpc1Byb2R1Y3Rpb24sXG4gIHNhbWVTaXRlOiBpc1Byb2R1Y3Rpb24gPyBcIm5vbmVcIiA6IFwibGF4XCIsXG59O1xuXG5jb25zdCBBQ0NFU1NfQ09PS0lFX01BWF9BR0UgPSAyNCAqIDYwICogNjAgKiAxMDAwOyAvLyAxIGRheVxuY29uc3QgUkVGUkVTSF9DT09LSUVfTUFYX0FHRSA9IDMwICogMjQgKiA2MCAqIDYwICogMTAwMDsgLy8gMzAgZGF5c1xuXG5jb25zdCBzZXRBdXRoQ29va2llcyA9IChcbiAgcmVzOiBSZXNwb25zZSxcbiAgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH06IHsgYWNjZXNzVG9rZW46IHN0cmluZzsgcmVmcmVzaFRva2VuOiBzdHJpbmcgfSxcbikgPT4ge1xuICByZXMuY29va2llKFwiYWNjZXNzVG9rZW5cIiwgYWNjZXNzVG9rZW4sIHtcbiAgICAuLi5jb29raWVPcHRpb25zLFxuICAgIG1heEFnZTogQUNDRVNTX0NPT0tJRV9NQVhfQUdFLFxuICB9KTtcbiAgcmVzLmNvb2tpZShcInJlZnJlc2hUb2tlblwiLCByZWZyZXNoVG9rZW4sIHtcbiAgICAuLi5jb29raWVPcHRpb25zLFxuICAgIG1heEFnZTogUkVGUkVTSF9DT09LSUVfTUFYX0FHRSxcbiAgfSk7XG59O1xuXG5jb25zdCBjbGVhckF1dGhDb29raWVzID0gKHJlczogUmVzcG9uc2UpID0+IHtcbiAgcmVzLmNsZWFyQ29va2llKFwiYWNjZXNzVG9rZW5cIiwgY29va2llT3B0aW9ucyk7XG4gIHJlcy5jbGVhckNvb2tpZShcInJlZnJlc2hUb2tlblwiLCBjb29raWVPcHRpb25zKTtcbn07XG5cbi8vIFJlZ2lzdGVyIGNvbnRyb2xsZXIgXHUyMDE0IHN0YWdlcyB0aGUgYWNjb3VudCBpbiBSZWRpcyBhbmQgZW1haWxzIGFuIE9UUDsgdGhlXG4vLyB1c2VyIHJvdyBpcyBjcmVhdGVkIGJ5IHZlcmlmeS1lbWFpbC5cbmNvbnN0IHJlZ2lzdGVyVXNlciA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLnJlZ2lzdGVyVXNlcihyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJWZXJpZmljYXRpb24gT1RQIHNlbnQgdG8geW91ciBlbWFpbC5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBMb2dpbiBjb250cm9sbGVyXG5jb25zdCBsb2dpblVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmxvZ2luVXNlcihyZXEuYm9keSk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR29vZ2xlIGxvZ2luIChJRC10b2tlbiBmbG93KVxuY29uc3QgZ29vZ2xlTG9naW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmdvb2dsZUxvZ2luKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBEZW1vIGxvZ2luIGNvbnRyb2xsZXJcbmNvbnN0IGRlbW9Mb2dpbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9ID0gYXdhaXQgYXV0aFNlcnZpY2UuZGVtb0xvZ2luKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRlbW8gdXNlciBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFZlcmlmeSBlbWFpbCBjb250cm9sbGVyIFx1MjAxNCBjcmVhdGVzIHRoZSB1c2VyIGFuZCBhdXRvLWxvZ3MtaW4gKHRva2VucyBhc1xuLy8gY29va2llcyArIGJvZHkpLCBtaXJyb3JpbmcgdGhlIHJlZmVyZW5jZSBiYWNrZW5kLlxuY29uc3QgdmVyaWZ5RW1haWwgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLnZlcmlmeUVtYWlsKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkVtYWlsIHZlcmlmaWVkIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBSZXNlbmQgdmVyaWZpY2F0aW9uIGNvbnRyb2xsZXIgXHUyMDE0IGFsd2F5cyAyMDAgKG5vIGVudW1lcmF0aW9uKS5cbmNvbnN0IHJlc2VuZFZlcmlmaWNhdGlvbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLnJlc2VuZFZlcmlmaWNhdGlvbihyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVmVyaWZpY2F0aW9uIE9UUCBzZW50IHRvIHlvdXIgZW1haWwuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gRm9yZ290IHBhc3N3b3JkIGNvbnRyb2xsZXIgXHUyMDE0IGFsd2F5cyAyMDAgKG5vIGVudW1lcmF0aW9uKS5cbmNvbnN0IGZvcmdvdFBhc3N3b3JkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgYXdhaXQgYXV0aFNlcnZpY2UuZm9yZ290UGFzc3dvcmQocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOlxuICAgICAgICBcIklmIGFuIGFjY291bnQgd2l0aCB0aGF0IGVtYWlsIGV4aXN0cywgYSBwYXNzd29yZCByZXNldCBPVFAgaGFzIGJlZW4gc2VudC5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBSZXNldCBwYXNzd29yZCBjb250cm9sbGVyXG5jb25zdCByZXNldFBhc3N3b3JkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgYXdhaXQgYXV0aFNlcnZpY2UucmVzZXRQYXNzd29yZChyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFzc3dvcmQgcmVzZXQgc3VjY2Vzc2Z1bGx5LiBQbGVhc2UgbG9naW4gYWdhaW4uXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gUmVmcmVzaCB0b2tlbiBjb250cm9sbGVyXG5jb25zdCByZWZyZXNoVG9rZW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZWZyZXNoVG9rZW5Gcm9tQ29va2llID0gcmVxLmNvb2tpZXMucmVmcmVzaFRva2VuO1xuICAgIGNvbnN0IHJlZnJlc2hUb2tlbkZyb21Cb2R5ID0gcmVxLmJvZHk/LnJlZnJlc2hUb2tlbjtcblxuICAgIGlmICghcmVmcmVzaFRva2VuRnJvbUNvb2tpZSAmJiAhcmVmcmVzaFRva2VuRnJvbUJvZHkpIHtcbiAgICAgIHJldHVybiBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLlVOQVVUSE9SSVpFRCxcbiAgICAgICAgbWVzc2FnZTogXCJSZWZyZXNoIHRva2VuIGlzIHJlcXVpcmVkXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbiB9ID1cbiAgICAgIGF3YWl0IGF1dGhTZXJ2aWNlLnJlZnJlc2hUb2tlbih7XG4gICAgICAgIHJlZnJlc2hUb2tlbjogcmVmcmVzaFRva2VuRnJvbUNvb2tpZSB8fCByZWZyZXNoVG9rZW5Gcm9tQm9keSxcbiAgICAgIH0pO1xuXG4gICAgc2V0QXV0aENvb2tpZXMocmVzLCB7XG4gICAgICBhY2Nlc3NUb2tlbixcbiAgICAgIHJlZnJlc2hUb2tlbjogbmV3UmVmcmVzaFRva2VuLFxuICAgIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlRva2VuIHJlZnJlc2hlZCBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbjogbmV3UmVmcmVzaFRva2VuIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBMb2dvdXQgY29udHJvbGxlclxuY29uc3QgbG9nb3V0VXNlciA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBhd2FpdCBhdXRoU2VydmljZS5sb2dvdXQodXNlcklkKTtcbiAgICBjbGVhckF1dGhDb29raWVzKHJlcyk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBsb2dnZWQgb3V0IHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdldCBNZSBjb250cm9sbGVyXG5jb25zdCBnZXRNZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgYXV0aFNlcnZpY2UuZ2V0TWVGcm9tREIodXNlcklkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBhdXRoQ29udHJvbGxlciA9IHtcbiAgcmVnaXN0ZXJVc2VyLFxuICB2ZXJpZnlFbWFpbCxcbiAgcmVzZW5kVmVyaWZpY2F0aW9uLFxuICBmb3Jnb3RQYXNzd29yZCxcbiAgcmVzZXRQYXNzd29yZCxcbiAgbG9naW5Vc2VyLFxuICBnb29nbGVMb2dpbixcbiAgZGVtb0xvZ2luLFxuICByZWZyZXNoVG9rZW4sXG4gIGxvZ291dFVzZXIsXG4gIGdldE1lLFxufTsiLCAiaW1wb3J0IGJjcnlwdCBmcm9tIFwiYmNyeXB0anNcIjtcbmltcG9ydCBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuaW1wb3J0IHsgZGVjb2RlLCBKd3RQYXlsb2FkLCBTaWduT3B0aW9ucyB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IGdvb2dsZUNsaWVudCB9IGZyb20gXCIuLi8uLi9saWIvZ29vZ2xlQXV0aFwiO1xuaW1wb3J0IHsgZ2V0UmVkaXMgfSBmcm9tIFwiLi4vLi4vbGliL3JlZGlzXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgand0VXRpbHMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvand0XCI7XG5pbXBvcnQge1xuICBzZW5kRm9yZ290UGFzc3dvcmRPdHBFbWFpbCxcbiAgc2VuZFBhc3N3b3JkUmVzZXRTdWNjZXNzRW1haWwsXG4gIHNlbmRWZXJpZmljYXRpb25PdHBFbWFpbCxcbiAgc2VuZFdlbGNvbWVFbWFpbCxcbn0gZnJvbSBcIi4uLy4uL3V0aWxzL2F1dGhFbWFpbFwiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7XG4gIElBdXRoLFxuICBJRGVtb0xvZ2luUGF5bG9hZCxcbiAgSUZvcmdvdFBhc3N3b3JkUGF5bG9hZCxcbiAgSUdvb2dsZUxvZ2luUGF5bG9hZCxcbiAgSUxvZ2luVXNlcixcbiAgSVJlZnJlc2hUb2tlblBheWxvYWQsXG4gIElSZXNlbmRWZXJpZmljYXRpb25QYXlsb2FkLFxuICBJUmVzZXRQYXNzd29yZFBheWxvYWQsXG4gIElWZXJpZnlFbWFpbFBheWxvYWQsXG59IGZyb20gXCIuL2F1dGguaW50ZXJmYWNlXCI7XG5cbmNvbnN0IE9UUF9FWFBJUkFUSU9OX1NFQ09ORFMgPSA1ICogNjA7IC8vIDUgbWludXRlcyBcdTIwMTQgbWF0Y2hlcyB0aGUgcmVmZXJlbmNlIGJhY2tlbmRcblxuLy8gU0hBLTI1NiBvZiBhIHJlZnJlc2ggSldUIFx1MjAxNCB0aGUgcm90YXRpb24gbGVkZ2VyIHN0b3JlcyBvbmx5IHRoaXMgaGFzaCwgbmV2ZXJcbi8vIHRoZSB0b2tlbiBpdHNlbGYsIHNvIGEgREIgbGVhayBjYW4ndCBtaW50IHVzYWJsZSByZWZyZXNoIHRva2Vucy5cbmNvbnN0IHNoYTI1NiA9ICh2YWx1ZTogc3RyaW5nKSA9PlxuICBjcnlwdG8uY3JlYXRlSGFzaChcInNoYTI1NlwiKS51cGRhdGUodmFsdWUpLmRpZ2VzdChcImhleFwiKTtcblxuLy8gUmVmcmVzaC10b2tlbiBleHBpcnkgcmVhZCBmcm9tIHRoZSBzaWduZWQgdG9rZW4ncyBgZXhwYCBzbyB0aGUgbGVkZ2VyIHJvd1xuLy8gYWx3YXlzIG1hdGNoZXMgSldUX1JFRlJFU0hfRVhQSVJFU19JTiBleGFjdGx5LlxuY29uc3QgcmVmcmVzaFRva2VuRXhwaXJlc0F0ID0gKHRva2VuOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcGF5bG9hZCA9IGRlY29kZSh0b2tlbikgYXMgSnd0UGF5bG9hZCB8IG51bGw7XG4gIHJldHVybiBwYXlsb2FkPy5leHAgPyBuZXcgRGF0ZShwYXlsb2FkLmV4cCAqIDEwMDApIDogbmV3IERhdGUoKTtcbn07XG5cbi8vIFJlZGlzIE9UUCBzdG9yZSBhY2Nlc3NvciBcdTIwMTQgNTAzIHdoZW4gdW5jb25maWd1cmVkIChuZXZlciBhIGJvb3QtdGltZSBjcmFzaCkuXG5jb25zdCBnZXRSZWRpc0NsaWVudCA9IGFzeW5jICgpID0+IHtcbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0UmVkaXMoKTtcbiAgaWYgKCFjbGllbnQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNTAzLCBcIkVtYWlsIHZlcmlmaWNhdGlvbiBpcyBub3QgY29uZmlndXJlZC5cIik7XG4gIH1cbiAgcmV0dXJuIGNsaWVudDtcbn07XG5cbmNvbnN0IGJ1aWxkVG9rZW5QYXlsb2FkID0gKHVzZXI6IHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICByb2xlOiBSb2xlO1xuICB0b2tlblZlcnNpb246IG51bWJlcjtcbn0pID0+ICh7XG4gIGlkOiB1c2VyLmlkLFxuICBuYW1lOiB1c2VyLm5hbWUsXG4gIGVtYWlsOiB1c2VyLmVtYWlsLFxuICByb2xlOiB1c2VyLnJvbGUsXG4gIHRva2VuVmVyc2lvbjogdXNlci50b2tlblZlcnNpb24sXG59KTtcblxuY29uc3QgaXNzdWVUb2tlbnMgPSBhc3luYyAoXG4gIHVzZXI6IHtcbiAgICBpZDogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBlbWFpbDogc3RyaW5nO1xuICAgIHJvbGU6IFJvbGU7XG4gICAgdG9rZW5WZXJzaW9uOiBudW1iZXI7XG4gIH0sXG4gIGNsaWVudDogUHJpc21hLlRyYW5zYWN0aW9uQ2xpZW50IHwgdHlwZW9mIHByaXNtYSA9IHByaXNtYSxcbikgPT4ge1xuICBjb25zdCB0b2tlblBheWxvYWQgPSBidWlsZFRva2VuUGF5bG9hZCh1c2VyKTtcblxuICBjb25zdCBhY2Nlc3NUb2tlbiA9IGp3dFV0aWxzLmNyZWF0ZVRva2VuKFxuICAgIHRva2VuUGF5bG9hZCxcbiAgICBjb25maWcuand0X2FjY2Vzc19zZWNyZXQsXG4gICAgeyBleHBpcmVzSW46IGNvbmZpZy5qd3RfYWNjZXNzX2V4cGlyZXNfaW4gfSBhcyBTaWduT3B0aW9ucyxcbiAgKTtcbiAgY29uc3QgcmVmcmVzaFRva2VuID0gand0VXRpbHMuY3JlYXRlVG9rZW4oXG4gICAgdG9rZW5QYXlsb2FkLFxuICAgIGNvbmZpZy5qd3RfcmVmcmVzaF9zZWNyZXQsXG4gICAgeyBleHBpcmVzSW46IGNvbmZpZy5qd3RfcmVmcmVzaF9leHBpcmVzX2luIH0gYXMgU2lnbk9wdGlvbnMsXG4gICk7XG5cbiAgLy8gUm90YXRpb24gbGVkZ2VyIFx1MjAxNCBwZXJzaXN0IGEgcm93IGtleWVkIGJ5IHRoZSByZWZyZXNoIHRva2VuJ3MgaGFzaC4gVGhlXG4gIC8vIEpXVCBpdHNlbGYgc3RheXMgaW4gdGhlIHJlc3BvbnNlIGV4YWN0bHkgYXMgYmVmb3JlLlxuICBhd2FpdCBjbGllbnQucmVmcmVzaFRva2VuLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgdXNlcklkOiB1c2VyLmlkLFxuICAgICAgaGFzaDogc2hhMjU2KHJlZnJlc2hUb2tlbiksXG4gICAgICBleHBpcmVzQXQ6IHJlZnJlc2hUb2tlbkV4cGlyZXNBdChyZWZyZXNoVG9rZW4pLFxuICAgIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfTtcbn07XG5cbmNvbnN0IHNhbml0aXplVXNlciA9IDxUIGV4dGVuZHMgeyBwYXNzd29yZDogc3RyaW5nIHwgbnVsbCB9Pih1c2VyOiBUKSA9PiB7XG4gIGNvbnN0IHsgcGFzc3dvcmQsIC4uLnJlc3QgfSA9IHVzZXI7XG4gIHJldHVybiByZXN0O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZ2lzdGVyIChzdGFnZWQgaW4gUmVkaXMsIHZlcmlmaWVkIHZpYSBPVFApIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gRm9sbG93cyB0aGUgcmVmZXJlbmNlIGJhY2tlbmQ6IGEgY3JlZGVudGlhbCBzaWdudXAgZG9lcyBOT1QgY3JlYXRlIGEgREIgcm93LlxuLy8gSXQgaGFzaGVzIHRoZSBwYXNzd29yZCwgc3RhZ2VzIHRoZSBwYXlsb2FkIGluIFJlZGlzLCBlbWFpbHMgYSA2LWRpZ2l0IE9UUCxcbi8vIGFuZCB0aGUgdXNlciByb3cgaXMgb25seSBjcmVhdGVkIG9uIHN1Y2Nlc3NmdWwgdmVyaWZpY2F0aW9uLlxuY29uc3QgcmVnaXN0ZXJVc2VyID0gYXN5bmMgKHBheWxvYWQ6IElBdXRoKSA9PiB7XG4gIGNvbnN0IHsgbmFtZSwgcGFzc3dvcmQsIHBob25lLCByb2xlIH0gPSBwYXlsb2FkO1xuICBjb25zdCBlbWFpbCA9IHBheWxvYWQuZW1haWwudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgLy8gT25seSB1c2Vycy9hZ2VudHMgY2FuIHNlbGYtcmVnaXN0ZXI7IGFkbWlucyBhcmUgY3JlYXRlZCB2aWEgZGVtby1sb2dpbi9zZWVkXG4gIGlmIChyb2xlICYmIHJvbGUgIT09IFwiVVNFUlwiICYmIHJvbGUgIT09IFwiQUdFTlRcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiUm9sZSBtdXN0IGJlIGVpdGhlciBVU0VSIG9yIEFHRU5UXCIpO1xuICB9XG5cbiAgY29uc3QgZXhpc3RpbmdVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgZW1haWwgfSxcbiAgfSk7XG4gIGlmIChleGlzdGluZ1VzZXIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIlVzZXIgd2l0aCB0aGlzIGVtYWlsIGFscmVhZHkgZXhpc3RzXCIpO1xuICB9XG5cbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0UmVkaXNDbGllbnQoKTtcblxuICAvLyBBIHJlZ2lzdHJhdGlvbiBpcyBhbHJlYWR5IHN0YWdlZCBmb3IgdGhpcyBlbWFpbCBcdTIwMTQgNDA5IGluc3RlYWQgb2Ygc2lsZW50bHlcbiAgLy8gb3ZlcndyaXRpbmcgdGhlIHBlbmRpbmcgT1RQL2RhdGEgKGFuIGF0dGFja2VyIG11c3Qgbm90IGJlIGFibGUgdG8ga2lsbCBhXG4gIC8vIHZpY3RpbSdzIGluLWZsaWdodCByZWdpc3RyYXRpb24pLiBUaGUgcGVuZGluZyBmbG93IGNvbnRpbnVlcyB2aWFcbiAgLy8gcmVzZW5kLXZlcmlmaWNhdGlvbi5cbiAgY29uc3QgcmVnaXN0cmF0aW9uRGF0YUtleSA9IGB0cmlwdmVyc2U6cmVnaXN0ZXItZGF0YToke2VtYWlsfWA7XG4gIGNvbnN0IHBlbmRpbmdSZWdpc3RyYXRpb24gPSBhd2FpdCBjbGllbnQuZ2V0KHJlZ2lzdHJhdGlvbkRhdGFLZXkpO1xuICBpZiAocGVuZGluZ1JlZ2lzdHJhdGlvbikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwOSxcbiAgICAgIFwiUmVnaXN0cmF0aW9uIGlzIHBlbmRpbmcgdmVyaWZpY2F0aW9uLiBDaGVjayB5b3VyIGVtYWlsIG9yIHJlc2VuZCB0aGUgT1RQLlwiLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBoYXNoZWRQYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgIHBhc3N3b3JkLFxuICAgIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSxcbiAgKTtcblxuICAvLyBSZWdpc3RyYXRpb24gT1RQICh0aGUgdmFsdWUgdGhlIHVzZXIgdHlwZXMgYmFjayBpbnRvIHRoZSBBUEkpXG4gIGNvbnN0IG90cEtleSA9IGB0cmlwdmVyc2U6cmVnaXN0ZXItb3RwOiR7ZW1haWx9YDtcbiAgY29uc3Qgb3RwVmFsdWUgPSBjcnlwdG8ucmFuZG9tSW50KDEwMDAwMCwgMTAwMDAwMCkudG9TdHJpbmcoKTtcblxuICBhd2FpdCBjbGllbnQuc2V0KG90cEtleSwgb3RwVmFsdWUsIHtcbiAgICBleHBpcmF0aW9uOiB7XG4gICAgICB0eXBlOiBcIkVYXCIsXG4gICAgICB2YWx1ZTogT1RQX0VYUElSQVRJT05fU0VDT05EUyxcbiAgICB9LFxuICB9KTtcblxuICAvLyBTdGFnZWQgcmVnaXN0cmF0aW9uIHBheWxvYWQgXHUyMDE0IHBhc3N3b3JkIGlzIGFscmVhZHkgaGFzaGVkIGhlcmUsIGV4YWN0bHlcbiAgLy8gbGlrZSB0aGUgcmVmZXJlbmNlLCBzbyBhIFJlZGlzIGxlYWsgbmV2ZXIgZXhwb3NlcyBhIHBsYWludGV4dCBwYXNzd29yZC5cbiAgY29uc3QgcmVkaXNVc2VyRGF0YVBheWxvYWQgPSB7XG4gICAgbmFtZSxcbiAgICBlbWFpbCxcbiAgICBwYXNzd29yZDogaGFzaGVkUGFzc3dvcmQsXG4gICAgcGhvbmUsXG4gICAgcm9sZTogcm9sZSB8fCBcIlVTRVJcIixcbiAgfTtcblxuICBhd2FpdCBjbGllbnQuc2V0KHJlZ2lzdHJhdGlvbkRhdGFLZXksIEpTT04uc3RyaW5naWZ5KHJlZGlzVXNlckRhdGFQYXlsb2FkKSwge1xuICAgIGV4cGlyYXRpb246IHtcbiAgICAgIHR5cGU6IFwiRVhcIixcbiAgICAgIHZhbHVlOiBPVFBfRVhQSVJBVElPTl9TRUNPTkRTLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIEJlc3QtZWZmb3J0IGVtYWlsIFx1MjAxNCBhIHNlbmQgZmFpbHVyZSBuZXZlciBmYWlscyByZWdpc3RyYXRpb24gKFRyaXBWZXJzZVxuICAvLyBjb252ZW50aW9uKTsgdGhlIHVzZXIgY2FuIHJlY292ZXIgdmlhIHJlc2VuZC12ZXJpZmljYXRpb24uXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kVmVyaWZpY2F0aW9uT3RwRW1haWwoeyBlbWFpbCwgbmFtZSwgb3RwOiBvdHBWYWx1ZSB9KSxcbiAgXSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgVmVyaWZ5IGVtYWlsIChjcmVhdGVzIHRoZSB1c2VyICsgYXV0by1sb2dpbikgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBGb2xsb3dzIHRoZSByZWZlcmVuY2UgYmFja2VuZDogT1RQIGlzIHJlYWQgZnJvbSBSZWRpcywgZGVsZXRlZCwgdGhlbiB0aGVcbi8vIHN0YWdlZCBwYXlsb2FkIGlzIG1hdGVyaWFsaXNlZCBhcyBhIHJlYWwgdXNlciByb3cgd2l0aCBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuLy8gYW5kIHRva2VucyBhcmUgaXNzdWVkIHNvIHRoZSB1c2VyIGlzIGxvZ2dlZCBpbiBpbW1lZGlhdGVseS5cbmNvbnN0IHZlcmlmeUVtYWlsID0gYXN5bmMgKHBheWxvYWQ6IElWZXJpZnlFbWFpbFBheWxvYWQpID0+IHtcbiAgY29uc3QgeyBvdHAgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IGVtYWlsID0gcGF5bG9hZC5lbWFpbC50cmltKCkudG9Mb3dlckNhc2UoKTtcblxuICAvLyBEZWZlbnNpdmUgXHUyMDE0IHJlZ2lzdHJhdGlvbiBhbHJlYWR5IDQwOXMgb24gYW4gZXhpc3RpbmcgZW1haWwsIHNvIGEgdXNlciByb3dcbiAgLy8gaGVyZSBtZWFucyB0aGUgZW1haWwgd2FzIHZlcmlmaWVkIGVhcmxpZXIgdGhyb3VnaCBhbm90aGVyIGZsb3cuXG4gIGNvbnN0IGlzVXNlckV4aXN0cyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBlbWFpbCB9IH0pO1xuICBpZiAoaXNVc2VyRXhpc3RzKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJFbWFpbCBpcyBhbHJlYWR5IHZlcmlmaWVkXCIpO1xuICB9XG5cbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0UmVkaXNDbGllbnQoKTtcblxuICBjb25zdCBvdHBLZXkgPSBgdHJpcHZlcnNlOnJlZ2lzdGVyLW90cDoke2VtYWlsfWA7XG4gIGNvbnN0IHJlZGlzT1RQID0gYXdhaXQgY2xpZW50LmdldChvdHBLZXkpO1xuXG4gIGlmICghcmVkaXNPVFAgfHwgcmVkaXNPVFAgIT09IG90cCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBvciBleHBpcmVkIE9UUC5cIik7XG4gIH1cblxuICAvLyBPVFAgaXMgc2luZ2xlLXVzZSBcdTIwMTQgZGVsZXRlIGl0IGJlZm9yZSB0aGUgdXNlciByb3cgaXMgY3JlYXRlZC5cbiAgYXdhaXQgY2xpZW50LmRlbChvdHBLZXkpO1xuXG4gIGNvbnN0IHJlZ2lzdHJhdGlvbkRhdGFLZXkgPSBgdHJpcHZlcnNlOnJlZ2lzdGVyLWRhdGE6JHtlbWFpbH1gO1xuICBjb25zdCByZWRpc1VzZXJEYXRhID0gYXdhaXQgY2xpZW50LmdldChyZWdpc3RyYXRpb25EYXRhS2V5KTtcblxuICBpZiAoIXJlZGlzVXNlckRhdGEpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgb3IgZXhwaXJlZCBPVFAuXCIpO1xuICB9XG5cbiAgY29uc3QgdXNlclBheWxvYWQgPSBKU09OLnBhcnNlKHJlZGlzVXNlckRhdGEpIGFzIElBdXRoO1xuXG4gIGNvbnN0IGNyZWF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICBuYW1lOiB1c2VyUGF5bG9hZC5uYW1lLFxuICAgICAgZW1haWw6IHVzZXJQYXlsb2FkLmVtYWlsLFxuICAgICAgcGFzc3dvcmQ6IHVzZXJQYXlsb2FkLnBhc3N3b3JkLFxuICAgICAgcGhvbmU6IHVzZXJQYXlsb2FkLnBob25lLFxuICAgICAgcm9sZTogdXNlclBheWxvYWQucm9sZSB8fCBcIlVTRVJcIixcbiAgICAgIGF1dGhQcm92aWRlcjogXCJDUkVERU5USUFMXCIsXG4gICAgICBzdGF0dXM6IFwiQUNUSVZFXCIsXG4gICAgICBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuICAgIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICAvLyBTdGFnZWQgcGF5bG9hZCBjb25zdW1lZCBcdTIwMTQgbm90aGluZyByZW1haW5zIGluIFJlZGlzLlxuICBhd2FpdCBjbGllbnQuZGVsKHJlZ2lzdHJhdGlvbkRhdGFLZXkpO1xuXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kV2VsY29tZUVtYWlsKHsgZW1haWw6IGNyZWF0ZWRVc2VyLmVtYWlsLCBuYW1lOiBjcmVhdGVkVXNlci5uYW1lIH0pLFxuICBdKTtcblxuICBjb25zdCB0b2tlbnMgPSBhd2FpdCBpc3N1ZVRva2VucyhjcmVhdGVkVXNlcik7XG5cbiAgcmV0dXJuIHsgLi4udG9rZW5zLCB1c2VyOiBjcmVhdGVkVXNlciB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlc2VuZCB2ZXJpZmljYXRpb24gT1RQIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gUmUtbWludHMgYSBmcmVzaCBPVFAgZm9yIGEgc3RpbGwtc3RhZ2VkIHJlZ2lzdHJhdGlvbi4gVW5pZm9ybSAyMDAgXHUyMDE0IGlmIHRoZVxuLy8gc3RhZ2luZyBkYXRhIGlzIGdvbmUgKG5ldmVyIHJlZ2lzdGVyZWQgLyBhbHJlYWR5IHZlcmlmaWVkKSB0aGlzIG5vLW9wcy5cbmNvbnN0IHJlc2VuZFZlcmlmaWNhdGlvbiA9IGFzeW5jIChwYXlsb2FkOiBJUmVzZW5kVmVyaWZpY2F0aW9uUGF5bG9hZCkgPT4ge1xuICBjb25zdCBlbWFpbCA9IHBheWxvYWQuZW1haWwudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0UmVkaXNDbGllbnQoKTtcblxuICBjb25zdCByZWdpc3RyYXRpb25EYXRhS2V5ID0gYHRyaXB2ZXJzZTpyZWdpc3Rlci1kYXRhOiR7ZW1haWx9YDtcbiAgY29uc3QgcmVkaXNVc2VyRGF0YSA9IGF3YWl0IGNsaWVudC5nZXQocmVnaXN0cmF0aW9uRGF0YUtleSk7XG5cbiAgaWYgKCFyZWRpc1VzZXJEYXRhKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgdXNlclBheWxvYWQgPSBKU09OLnBhcnNlKHJlZGlzVXNlckRhdGEpIGFzIElBdXRoO1xuXG4gIGNvbnN0IG90cEtleSA9IGB0cmlwdmVyc2U6cmVnaXN0ZXItb3RwOiR7ZW1haWx9YDtcbiAgY29uc3Qgb3RwVmFsdWUgPSBjcnlwdG8ucmFuZG9tSW50KDEwMDAwMCwgMTAwMDAwMCkudG9TdHJpbmcoKTtcblxuICBhd2FpdCBjbGllbnQuc2V0KG90cEtleSwgb3RwVmFsdWUsIHtcbiAgICBleHBpcmF0aW9uOiB7XG4gICAgICB0eXBlOiBcIkVYXCIsXG4gICAgICB2YWx1ZTogT1RQX0VYUElSQVRJT05fU0VDT05EUyxcbiAgICB9LFxuICB9KTtcblxuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZFZlcmlmaWNhdGlvbk90cEVtYWlsKHsgZW1haWwsIG5hbWU6IHVzZXJQYXlsb2FkLm5hbWUsIG90cDogb3RwVmFsdWUgfSksXG4gIF0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEZvcmdvdCBwYXNzd29yZCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIEVtYWlscyBhIHJlc2V0IE9UUCB0byB2ZXJpZmllZCBDUkVERU5USUFMIGFjY291bnRzLiBEZWxpYmVyYXRlbHkgcmV0dXJucyBhXG4vLyB1bmlmb3JtIDIwMCB3aGV0aGVyIG9yIG5vdCB0aGUgZW1haWwgZXhpc3RzIC8gaXMgZWxpZ2libGUgKG5vIGVudW1lcmF0aW9uIFx1MjAxNFxuLy8gdGhlIHJlZmVyZW5jZSB0aHJvd3MgXCJVc2VyIG5vdCBmb3VuZFwiLCBidXQgVHJpcFZlcnNlIG5ldmVyIGxlYWtzIGV4aXN0ZW5jZSkuXG5jb25zdCBmb3Jnb3RQYXNzd29yZCA9IGFzeW5jIChwYXlsb2FkOiBJRm9yZ290UGFzc3dvcmRQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IGVtYWlsID0gcGF5bG9hZC5lbWFpbC50cmltKCkudG9Mb3dlckNhc2UoKTtcblxuICBjb25zdCBpc1VzZXJFeGlzdHMgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgZW1haWwgfSB9KTtcblxuICBpZiAoXG4gICAgIWlzVXNlckV4aXN0cyB8fFxuICAgIGlzVXNlckV4aXN0cy5pc0RlbGV0ZWQgfHxcbiAgICBpc1VzZXJFeGlzdHMuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiIHx8XG4gICAgIWlzVXNlckV4aXN0cy5lbWFpbFZlcmlmaWVkIHx8XG4gICAgaXNVc2VyRXhpc3RzLmF1dGhQcm92aWRlciA9PT0gXCJHT09HTEVcIlxuICApIHtcbiAgICAvLyBHb29nbGUtb25seSBhY2NvdW50cyByZXNldCB2aWEgR29vZ2xlOyBldmVyeW9uZSBlbHNlIHNpbGVudGx5IG5vLW9wcy5cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBjbGllbnQgPSBhd2FpdCBnZXRSZWRpc0NsaWVudCgpO1xuXG4gIGNvbnN0IG90cCA9IGNyeXB0by5yYW5kb21JbnQoMTAwMDAwLCAxMDAwMDAwKS50b1N0cmluZygpO1xuICBjb25zdCBrZXkgPSBgdHJpcHZlcnNlOmZvcmdvdC1wYXNzd29yZC1vdHA6JHtpc1VzZXJFeGlzdHMuZW1haWx9YDtcblxuICBhd2FpdCBjbGllbnQuc2V0KGtleSwgb3RwLCB7XG4gICAgZXhwaXJhdGlvbjoge1xuICAgICAgdHlwZTogXCJFWFwiLFxuICAgICAgdmFsdWU6IE9UUF9FWFBJUkFUSU9OX1NFQ09ORFMsXG4gICAgfSxcbiAgfSk7XG5cbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRGb3Jnb3RQYXNzd29yZE90cEVtYWlsKHtcbiAgICAgIGVtYWlsOiBpc1VzZXJFeGlzdHMuZW1haWwsXG4gICAgICBuYW1lOiBpc1VzZXJFeGlzdHMubmFtZSxcbiAgICAgIG90cCxcbiAgICB9KSxcbiAgXSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVzZXQgcGFzc3dvcmQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBWYWxpZGF0ZXMgdGhlIE9UUCBhZ2FpbnN0IFJlZGlzLCB0aGVuIHJlcGxhY2VzIHRoZSBoYXNoIGFuZCBidW1wc1xuLy8gdG9rZW5WZXJzaW9uIHNvIGV2ZXJ5IGV4aXN0aW5nIHNlc3Npb24gZGllcyAoVHJpcFZlcnNlIGxvZ291dCBzZW1hbnRpY3MpLlxuY29uc3QgcmVzZXRQYXNzd29yZCA9IGFzeW5jIChwYXlsb2FkOiBJUmVzZXRQYXNzd29yZFBheWxvYWQpID0+IHtcbiAgY29uc3QgeyBuZXdQYXNzd29yZCwgb3RwIH0gPSBwYXlsb2FkO1xuICBjb25zdCBlbWFpbCA9IHBheWxvYWQuZW1haWwudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgY29uc3QgaXNVc2VyRXhpc3RzID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG5cbiAgaWYgKFxuICAgICFpc1VzZXJFeGlzdHMgfHxcbiAgICBpc1VzZXJFeGlzdHMuaXNEZWxldGVkIHx8XG4gICAgaXNVc2VyRXhpc3RzLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIiB8fFxuICAgIGlzVXNlckV4aXN0cy5hdXRoUHJvdmlkZXIgPT09IFwiR09PR0xFXCJcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIG9yIGV4cGlyZWQgT1RQLlwiKTtcbiAgfVxuXG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IGdldFJlZGlzQ2xpZW50KCk7XG5cbiAgY29uc3Qga2V5ID0gYHRyaXB2ZXJzZTpmb3Jnb3QtcGFzc3dvcmQtb3RwOiR7aXNVc2VyRXhpc3RzLmVtYWlsfWA7XG4gIGNvbnN0IHJlZGlzT1RQID0gYXdhaXQgY2xpZW50LmdldChrZXkpO1xuXG4gIGlmICghcmVkaXNPVFAgfHwgcmVkaXNPVFAgIT09IG90cCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBvciBleHBpcmVkIE9UUC5cIik7XG4gIH1cblxuICBjb25zdCBoYXNoZWROZXdQYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgIG5ld1Bhc3N3b3JkLFxuICAgIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSxcbiAgKTtcblxuICBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGVtYWlsOiBpc1VzZXJFeGlzdHMuZW1haWwgfSxcbiAgICBkYXRhOiB7XG4gICAgICBwYXNzd29yZDogaGFzaGVkTmV3UGFzc3dvcmQsXG4gICAgICB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gU2luZ2xlLXVzZSBPVFAgXHUyMDE0IGRlbGV0ZSBhZnRlciBhIHN1Y2Nlc3NmdWwgcmVzZXQuXG4gIGF3YWl0IGNsaWVudC5kZWwoa2V5KTtcblxuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgc2VuZFBhc3N3b3JkUmVzZXRTdWNjZXNzRW1haWwoe1xuICAgICAgZW1haWw6IGlzVXNlckV4aXN0cy5lbWFpbCxcbiAgICAgIG5hbWU6IGlzVXNlckV4aXN0cy5uYW1lLFxuICAgIH0pLFxuICBdKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBMb2dpbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGxvZ2luVXNlciA9IGFzeW5jIChwYXlsb2FkOiBJTG9naW5Vc2VyKSA9PiB7XG4gIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBlbWFpbCB9LFxuICB9KTtcblxuICBpZiAoIXVzZXIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIkludmFsaWQgZW1haWwgb3IgcGFzc3dvcmRcIik7XG4gIH1cbiAgaWYgKHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGhhcyBiZWVuIGRlbGV0ZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGlzIHN1c3BlbmRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5hdXRoUHJvdmlkZXIgPT09IFwiR09PR0xFXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIlRoaXMgYWNjb3VudCB1c2VzIEdvb2dsZSBsb2dpbi4gUGxlYXNlIGxvZyBpbiB3aXRoIEdvb2dsZS5cIixcbiAgICApO1xuICB9XG5cbiAgY29uc3QgaXNQYXNzd29yZFZhbGlkID0gYXdhaXQgYmNyeXB0LmNvbXBhcmUocGFzc3dvcmQsIHVzZXIucGFzc3dvcmQgfHwgXCJcIik7XG4gIGlmICghaXNQYXNzd29yZFZhbGlkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJJbnZhbGlkIGVtYWlsIG9yIHBhc3N3b3JkXCIpO1xuICB9XG5cbiAgcmV0dXJuIGF3YWl0IGlzc3VlVG9rZW5zKHVzZXIpO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEdvb2dsZSBsb2dpbiAoSUQtdG9rZW4gZmxvdykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnb29nbGVMb2dpbiA9IGFzeW5jIChwYXlsb2FkOiBJR29vZ2xlTG9naW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgaWRUb2tlbiB9ID0gcGF5bG9hZDtcblxuICBpZiAoIWNvbmZpZy5nb29nbGVfY2xpZW50X2lkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJHb29nbGUgbG9naW4gaXMgbm90IGNvbmZpZ3VyZWQuIFBsZWFzZSBjb250YWN0IHN1cHBvcnQuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGxldCB0aWNrZXQ7XG4gIHRyeSB7XG4gICAgdGlja2V0ID0gYXdhaXQgZ29vZ2xlQ2xpZW50LnZlcmlmeUlkVG9rZW4oe1xuICAgICAgaWRUb2tlbixcbiAgICAgIGF1ZGllbmNlOiBjb25maWcuZ29vZ2xlX2NsaWVudF9pZCxcbiAgICB9KTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJJbnZhbGlkIEdvb2dsZSB0b2tlblwiKTtcbiAgfVxuXG4gIGNvbnN0IGdvb2dsZURhdGEgPSB0aWNrZXQuZ2V0UGF5bG9hZCgpO1xuICBpZiAoIWdvb2dsZURhdGEpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgR29vZ2xlIHRva2VuIHBheWxvYWRcIik7XG4gIH1cblxuICBjb25zdCB7IGVtYWlsLCBuYW1lLCBzdWIsIHBpY3R1cmUgfSA9IGdvb2dsZURhdGE7XG5cbiAgaWYgKCFlbWFpbCB8fCAhZ29vZ2xlRGF0YS5lbWFpbF92ZXJpZmllZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiR29vZ2xlIGFjY291bnQgZW1haWwgaXMgbm90IHZlcmlmaWVkXCIpO1xuICB9XG5cbiAgbGV0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgZ29vZ2xlSWQ6IHN1YiB9IH0pO1xuXG4gIC8vIEV4aXN0aW5nIHVzZXIgXHUyMTkyIGxpbmsgR29vZ2xlIGFjY291bnQgaWYgbm90IGFscmVhZHkgbGlua2VkXG4gIGlmICghdXNlciAmJiBlbWFpbCkge1xuICAgIHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgZW1haWwgfSB9KTtcbiAgICBpZiAodXNlcikge1xuICAgICAgaWYgKHVzZXIuZ29vZ2xlSWQgJiYgdXNlci5nb29nbGVJZCAhPT0gc3ViKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgICA0MDksXG4gICAgICAgICAgXCJFbWFpbCBpcyBhbHJlYWR5IGxpbmtlZCB0byBhbm90aGVyIEdvb2dsZSBhY2NvdW50XCIsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQ6IHVzZXIuaWQgfSxcbiAgICAgICAgZGF0YTogeyBnb29nbGVJZDogc3ViLCBlbWFpbFZlcmlmaWVkOiB0cnVlIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBCcmFuZCBuZXcgdXNlclxuICBpZiAoIXVzZXIpIHtcbiAgICBjb25zdCBsb2NhbFBhcnQgPSBlbWFpbC5zcGxpdChcIkBcIilbMF0gPz8gZW1haWw7XG4gICAgY29uc3QgZGlzcGxheU5hbWUgPSAobmFtZSA/PyBcIlwiKS50cmltKCkgfHwgbG9jYWxQYXJ0O1xuICAgIHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICBlbWFpbCxcbiAgICAgICAgbmFtZTogZGlzcGxheU5hbWUsXG4gICAgICAgIHBhc3N3b3JkOiBudWxsLFxuICAgICAgICBhdXRoUHJvdmlkZXI6IFwiR09PR0xFXCIsXG4gICAgICAgIGdvb2dsZUlkOiBzdWIsXG4gICAgICAgIGVtYWlsVmVyaWZpZWQ6IHRydWUsXG4gICAgICAgIHJvbGU6IFwiVVNFUlwiLFxuICAgICAgICBhdmF0YXJVcmw6IHBpY3R1cmUgfHwgbnVsbCxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCB0b2tlbnMgPSBhd2FpdCBpc3N1ZVRva2Vucyh1c2VyISk7XG4gIGNvbnN0IHNhbml0aXplZFVzZXIgPSBzYW5pdGl6ZVVzZXIodXNlciEpO1xuXG4gIHJldHVybiB7IC4uLnRva2VucywgdXNlcjogc2FuaXRpemVkVXNlciB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIERlbW8gbG9naW4gKGdyYWRpbmcpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgREVNT19QQVNTV09SRCA9IFwiZGVtbzEyM1wiO1xuXG5jb25zdCBkZW1vTG9naW4gPSBhc3luYyAocGF5bG9hZDogSURlbW9Mb2dpblBheWxvYWQpID0+IHtcbiAgY29uc3QgeyByb2xlIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGRlbW9Vc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBzZXJ0KHtcbiAgICB3aGVyZTogeyBlbWFpbDogYGRlbW8tJHtyb2xlLnRvTG93ZXJDYXNlKCl9QHRyaXB2ZXJzZS5jb21gIH0sXG4gICAgLy8gcmVzdXJyZWN0IGRlbW8gYWNjb3VudHMgdGhhdCBhbiBhZG1pbiBzdXNwZW5kZWQgb3Igc29mdC1kZWxldGVkXG4gICAgdXBkYXRlOiB7IHN0YXR1czogXCJBQ1RJVkVcIiwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIGNyZWF0ZToge1xuICAgICAgbmFtZTogYERlbW8gJHtyb2xlLmNoYXJBdCgwKSArIHJvbGUuc2xpY2UoMSkudG9Mb3dlckNhc2UoKX1gLFxuICAgICAgZW1haWw6IGBkZW1vLSR7cm9sZS50b0xvd2VyQ2FzZSgpfUB0cmlwdmVyc2UuY29tYCxcbiAgICAgIHBhc3N3b3JkOiBhd2FpdCBiY3J5cHQuaGFzaChERU1PX1BBU1NXT1JELCBOdW1iZXIoY29uZmlnLmJjcnlwdF9zYWx0X3JvdW5kcykpLFxuICAgICAgYXV0aFByb3ZpZGVyOiBcIkNSRURFTlRJQUxcIixcbiAgICAgIHJvbGUsXG4gICAgICBzdGF0dXM6IFwiQUNUSVZFXCIsXG4gICAgICBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuICAgIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4geyAuLi4oYXdhaXQgaXNzdWVUb2tlbnMoZGVtb1VzZXIpKSwgdXNlcjogZGVtb1VzZXIgfTtcbn07XG5cbi8vIFJldXNlIGRldGVjdGVkIFx1MjE5MiBraWxsIHRoZSB3aG9sZSBmYW1pbHk6IGV2ZXJ5IG91dHN0YW5kaW5nIHRva2VuIGRpZXMgdmlhXG4vLyByZXZva2UgKyB0b2tlblZlcnNpb24gYnVtcC4gU2FtZSBzaGFwZSBhcyBsb2dvdXQuXG5jb25zdCByZXZva2VGYW1pbHkgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihbXG4gICAgcHJpc21hLnJlZnJlc2hUb2tlbi51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IHVzZXJJZCwgcmV2b2tlZEF0OiBudWxsIH0sXG4gICAgICBkYXRhOiB7IHJldm9rZWRBdDogbmV3IERhdGUoKSB9LFxuICAgIH0pLFxuICAgIHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgICBkYXRhOiB7IHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICAgIH0pLFxuICBdKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZWZyZXNoIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcmVmcmVzaFRva2VuID0gYXN5bmMgKHBheWxvYWQ6IElSZWZyZXNoVG9rZW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgcmVmcmVzaFRva2VuOiBwcm92aWRlZFJlZnJlc2hUb2tlbiB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB2ZXJpZmllZCA9IGp3dFV0aWxzLnZlcmlmeVRva2VuKFxuICAgIHByb3ZpZGVkUmVmcmVzaFRva2VuLFxuICAgIGNvbmZpZy5qd3RfcmVmcmVzaF9zZWNyZXQsXG4gICk7XG5cbiAgaWYgKCF2ZXJpZmllZC5zdWNjZXNzKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgdmVyaWZpZWQuZXJyb3IpO1xuICB9XG5cbiAgY29uc3QgeyBpZCwgdG9rZW5WZXJzaW9uOiB0b2tlblRva2VuVmVyc2lvbiB9ID1cbiAgICB2ZXJpZmllZC5kYXRhIGFzIEp3dFBheWxvYWQgJiB7IHRva2VuVmVyc2lvbjogbnVtYmVyIH07XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBpcyBzdXNwZW5kZWRcIik7XG4gIH1cblxuICAvLyB0b2tlblZlcnNpb24gY2hhbmdlZCBcdTIxOTIgdG9rZW5zIHdlcmUgcmV2b2tlZCAobG9nb3V0IC8gcGFzc3dvcmQgY2hhbmdlKVxuICBpZiAodXNlci50b2tlblZlcnNpb24gIT09IHRva2VuVG9rZW5WZXJzaW9uKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJUb2tlbiBpcyBubyBsb25nZXIgdmFsaWQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIik7XG4gIH1cblxuICAvLyBPcHBvcnR1bmlzdGljIGhvdXNla2VlcGluZyBcdTIwMTQga2VlcCB0aGUgbGVkZ2VyIGZyb20gZ3Jvd2luZyB1bmJvdW5kZWRcbiAgLy8gd2l0aG91dCBhIGNyb246IGRyb3AgZXhwaXJlZCByb3dzIGFuZCByb3dzIHJldm9rZWQgbW9yZSB0aGFuIDcgZGF5cyBhZ28uXG4gIGNvbnN0IHdlZWtBZ28gPSBuZXcgRGF0ZShEYXRlLm5vdygpIC0gNyAqIDI0ICogNjAgKiA2MCAqIDEwMDApO1xuICBhd2FpdCBwcmlzbWEucmVmcmVzaFRva2VuLmRlbGV0ZU1hbnkoe1xuICAgIHdoZXJlOiB7XG4gICAgICBPUjogW3sgZXhwaXJlc0F0OiB7IGx0OiBuZXcgRGF0ZSgpIH0gfSwgeyByZXZva2VkQXQ6IHsgbHRlOiB3ZWVrQWdvIH0gfV0sXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gUm90YXRpb24gbGVkZ2VyIGxvb2t1cCBieSB0aGUgcHJlc2VudGVkIHRva2VuJ3MgaGFzaC5cbiAgY29uc3Qgcm93ID0gYXdhaXQgcHJpc21hLnJlZnJlc2hUb2tlbi5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBoYXNoOiBzaGEyNTYocHJvdmlkZWRSZWZyZXNoVG9rZW4pIH0sXG4gIH0pO1xuXG4gIC8vIE5ldmVyIGlzc3VlZCAob3IgYWxyZWFkeSBwcnVuZWQpIFx1MjE5MiByZWplY3QuXG4gIGlmICghcm93KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJJbnZhbGlkIHJlZnJlc2ggdG9rZW4uIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIik7XG4gIH1cblxuICAvLyBBIHJldm9rZWQgcm93IGlzIHRoZSB0aGVmdCBzaWduYXR1cmUgXHUyMDE0IHNvbWVvbmUgcmVwbGF5ZWQgYSByb3RhdGVkIHRva2VuLlxuICBpZiAocm93LnJldm9rZWRBdCkge1xuICAgIGF3YWl0IHJldm9rZUZhbWlseSh1c2VyLmlkKTtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIlJlZnJlc2ggdG9rZW4gcmV1c2UgZGV0ZWN0ZWQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIik7XG4gIH1cblxuICAvLyBOYXR1cmFsbHkgZXhwaXJlZCBcdTIxOTIgcmVqZWN0IHdpdGhvdXQgdG91Y2hpbmcgdGhlIGZhbWlseS5cbiAgaWYgKHJvdy5leHBpcmVzQXQuZ2V0VGltZSgpIDw9IERhdGUubm93KCkpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIlJlZnJlc2ggdG9rZW4gaGFzIGV4cGlyZWQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIik7XG4gIH1cblxuICAvLyBWYWxpZCBcdTIxOTIgcm90YXRlLiBUaGUgQ0FTIG9uIGByZXZva2VkQXQ6IG51bGxgIG1ha2VzIHJvdGF0aW9uIGFcbiAgLy8gY29tcGFyZS1hbmQtc3dhcDogb2YgdHdvIHRydWx5LWNvbmN1cnJlbnQgcHJlc2VudHMgb2YgdGhlIHNhbWUgdG9rZW4gb25seVxuICAvLyBvbmUgd2luczsgdGhlIGxvc2VyJ3MgdXBkYXRlTWFueSByZXR1cm5zIGNvdW50IDAgXHUyMTkyIGZhbWlseSBudWtlLiBUaGUgbnVrZVxuICAvLyBtdXN0IHJ1biBBRlRFUiB0aGUgdHJhbnNhY3Rpb24gY29tbWl0cyBcdTIwMTQgdGhyb3dpbmcgaW5zaWRlIHRoZSBpbnRlcmFjdGl2ZVxuICAvLyB0eCB3b3VsZCByb2xsIGl0IGJhY2sgYW5kIHNpbGVudGx5IHVuZG8gdGhlIG51a2UuXG4gIGNvbnN0IG91dGNvbWUgPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IHJvdGF0ZWQgPSBhd2FpdCB0eC5yZWZyZXNoVG9rZW4udXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyBpZDogcm93LmlkLCByZXZva2VkQXQ6IG51bGwgfSxcbiAgICAgIGRhdGE6IHsgcmV2b2tlZEF0OiBuZXcgRGF0ZSgpIH0sXG4gICAgfSk7XG5cbiAgICBpZiAocm90YXRlZC5jb3VudCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFwiTE9TVFwiIGFzIGNvbnN0O1xuICAgIH1cblxuICAgIGNvbnN0IHRva2VucyA9IGF3YWl0IGlzc3VlVG9rZW5zKHVzZXIsIHR4KTtcbiAgICByZXR1cm4geyB0b2tlbnMgfSBhcyBjb25zdDtcbiAgfSk7XG5cbiAgaWYgKG91dGNvbWUgPT09IFwiTE9TVFwiKSB7XG4gICAgYXdhaXQgcmV2b2tlRmFtaWx5KHVzZXIuaWQpO1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiUmVmcmVzaCB0b2tlbiByZXVzZSBkZXRlY3RlZC4gUGxlYXNlIGxvZ2luIGFnYWluLlwiKTtcbiAgfVxuXG4gIHJldHVybiBvdXRjb21lLnRva2Vucztcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBMb2dvdXQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBsb2dvdXQgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpID0+IHtcbiAgLy8gUmV2b2tlIHRoZSBsZWRnZXIgcm93cywgdGhlbiBidW1wIHRva2VuVmVyc2lvbiAoa2lsbHMgZXZlcnl0aGluZykuXG4gIGF3YWl0IHJldm9rZUZhbWlseSh1c2VySWQpO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEdldCBtZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldE1lRnJvbURCID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgcmV0dXJuIHVzZXI7XG59O1xuXG5leHBvcnQgY29uc3QgYXV0aFNlcnZpY2UgPSB7XG4gIHJlZ2lzdGVyVXNlcixcbiAgdmVyaWZ5RW1haWwsXG4gIHJlc2VuZFZlcmlmaWNhdGlvbixcbiAgZm9yZ290UGFzc3dvcmQsXG4gIHJlc2V0UGFzc3dvcmQsXG4gIGxvZ2luVXNlcixcbiAgZ29vZ2xlTG9naW4sXG4gIGRlbW9Mb2dpbixcbiAgcmVmcmVzaFRva2VuLFxuICBsb2dvdXQsXG4gIGdldE1lRnJvbURCLFxufTsiLCAiaW1wb3J0IHsgT0F1dGgyQ2xpZW50IH0gZnJvbSBcImdvb2dsZS1hdXRoLWxpYnJhcnlcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG5leHBvcnQgY29uc3QgZ29vZ2xlQ2xpZW50ID0gbmV3IE9BdXRoMkNsaWVudCh7XG4gIGNsaWVudElkOiBjb25maWcuZ29vZ2xlX2NsaWVudF9pZCxcbn0pOyIsICJpbXBvcnQgeyBjcmVhdGVDbGllbnQgfSBmcm9tIFwicmVkaXNcIjtcbmltcG9ydCB0eXBlIHsgUmVkaXNDbGllbnRUeXBlIH0gZnJvbSBcInJlZGlzXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuLy8gUmVkaXMgT1RQIHN0b3JlIGZvciBlbWFpbCB2ZXJpZmljYXRpb24gKyBwYXNzd29yZCByZXNldCAoU3RlcCAyMSkgXHUyMDE0IG1pcnJvcnNcbi8vIHRoZSByZWZlcmVuY2UgYmFja2VuZCdzIG5vZGUtcmVkaXMgY2xpZW50LiBOdWxsIHdoZW4gdW5jb25maWd1cmVkIHNvIHRoZSBhcHBcbi8vIHN0aWxsIGJvb3RzIChlLmcuIFZlcmNlbCBwcm9kKTsgdGhlIGF1dGggZW5kcG9pbnRzIHRoZW4gZmFpbCB3aXRoIGEgY2xlYW5cbi8vIDUwMyBpbnN0ZWFkIG9mIGNyYXNoaW5nLlxuZXhwb3J0IGNvbnN0IHJlZGlzQ2xpZW50ID0gY29uZmlnLnJlZGlzX2hvc3RcbiAgPyBjcmVhdGVDbGllbnQoe1xuICAgICAgdXNlcm5hbWU6IGNvbmZpZy5yZWRpc191c2VyLFxuICAgICAgcGFzc3dvcmQ6IGNvbmZpZy5yZWRpc19wYXNzd29yZCxcbiAgICAgIHNvY2tldDoge1xuICAgICAgICBob3N0OiBjb25maWcucmVkaXNfaG9zdCxcbiAgICAgICAgcG9ydDogcGFyc2VJbnQoY29uZmlnLnJlZGlzX3BvcnQgfHwgXCI2Mzc5XCIpLFxuICAgICAgfSxcbiAgICB9KVxuICA6IG51bGw7XG5cbi8vIExhemlseS1jb25uZWN0IGFjY2Vzc29yIFx1MjAxNCBjb25uZWN0KCkgaXMgaWRlbXBvdGVudCwgc28gdGhpcyBpcyBzYWZlIHRvIGNhbGxcbi8vIHBlciByZXF1ZXN0OyB0aGUgY2xpZW50IGlzIGFsc28gY29ubmVjdGVkIG9uY2UgYXQgYm9vdCBpbiBzZXJ2ZXIudHMuXG5leHBvcnQgY29uc3QgZ2V0UmVkaXMgPSBhc3luYyAoKTogUHJvbWlzZTxSZWRpc0NsaWVudFR5cGUgfCBudWxsPiA9PiB7XG4gIGlmICghcmVkaXNDbGllbnQpIHJldHVybiBudWxsO1xuXG4gIGlmICghcmVkaXNDbGllbnQuaXNPcGVuKSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHJlZGlzQ2xpZW50LmNvbm5lY3QoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgXCJbcmVkaXNdIGNvbm5lY3QgZmFpbGVkOlwiLFxuICAgICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICApO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlZGlzQ2xpZW50O1xufTtcbiIsICJpbXBvcnQgY3J5cHRvIGZyb20gXCJjcnlwdG9cIjtcbmltcG9ydCBqd3QsIHsgSnd0UGF5bG9hZCwgU2lnbk9wdGlvbnMgfSBmcm9tIFwianNvbndlYnRva2VuXCI7XG5cbmNvbnN0IGNyZWF0ZVRva2VuID0gKFxuICBwYXlsb2FkOiBKd3RQYXlsb2FkLFxuICBzZWNyZXQ6IHN0cmluZyxcbiAgZXhwaXJlc0luOiBTaWduT3B0aW9ucyxcbikgPT4ge1xuICAvLyBqdGkgZ3VhcmFudGVlcyBieXRlLXVuaXF1ZSB0b2tlbnMgZXZlbiB3aXRoaW4gdGhlIHNhbWUgaWF0IHNlY29uZCBcdTIwMTRcbiAgLy8gb3RoZXJ3aXNlIHR3byB0b2tlbnMgbWludGVkIGZvciB0aGUgc2FtZSB1c2VyIGluIG9uZSBzZWNvbmQgY29sbGlkZSBvblxuICAvLyB0aGUgcmVmcmVzaC1sZWRnZXIgdW5pcXVlIGhhc2ggKFN0ZXAgMjIpLlxuICBjb25zdCB0b2tlbiA9IGp3dC5zaWduKHsgLi4ucGF5bG9hZCwganRpOiBjcnlwdG8ucmFuZG9tVVVJRCgpIH0sIHNlY3JldCwgZXhwaXJlc0luKTtcblxuICByZXR1cm4gdG9rZW47XG59O1xuXG5jb25zdCB2ZXJpZnlUb2tlbiA9ICh0b2tlbjogc3RyaW5nLCBzZWNyZXQ6IHN0cmluZykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHZlcmlmaWVkVG9rZW4gPSBqd3QudmVyaWZ5KHRva2VuLCBzZWNyZXQpO1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgZGF0YTogdmVyaWZpZWRUb2tlbixcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgY29uc29sZS5sb2coXCJUb2tlbiBWZXJpZmljYXRpb24gRmFpbGVkOlwiLCBlcnJvcik7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgfTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGp3dFV0aWxzID0ge1xuICBjcmVhdGVUb2tlbixcbiAgdmVyaWZ5VG9rZW4sXG59O1xuIiwgImltcG9ydCBub2RlbWFpbGVyIGZyb20gXCJub2RlbWFpbGVyXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuLy8gTm9kZW1haWxlciB0cmFuc3BvcnRlciBmb3IgdGhlIGF1dGggZW1haWxzIChTdGVwIDIxKSBcdTIwMTQgaWRlbnRpY2FsIHRvIHRoZVxuLy8gcmVmZXJlbmNlIGJhY2tlbmQgKEdtYWlsIGFwcC1wYXNzd29yZCBTTVRQKS4gTnVsbCB3aGVuIHVuY29uZmlndXJlZCBzbyB0aGVcbi8vIGFwcCBzdGlsbCBib290czsgdGhlIGF1dGggZW1haWwgaGVscGVycyB0aGVuIGJlY29tZSBiZXN0LWVmZm9ydCBuby1vcHMuXG5leHBvcnQgY29uc3QgdHJhbnNwb3J0ZXIgPVxuICBjb25maWcuc210cF91c2VyICYmIGNvbmZpZy5zbXRwX3Bhc3N3b3JkXG4gICAgPyBub2RlbWFpbGVyLmNyZWF0ZVRyYW5zcG9ydCh7XG4gICAgICAgIHNlcnZpY2U6IFwiZ21haWxcIixcbiAgICAgICAgYXV0aDoge1xuICAgICAgICAgIHVzZXI6IGNvbmZpZy5zbXRwX3VzZXIsXG4gICAgICAgICAgcGFzczogY29uZmlnLnNtdHBfcGFzc3dvcmQsXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgIDogbnVsbDtcbiIsICJpbXBvcnQgZnMgZnJvbSBcImZzXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IGVqcyBmcm9tIFwiZWpzXCI7XG5cbi8vIFJlbmRlcnMgYW4gRUpTIGVtYWlsIHRlbXBsYXRlIGJ5IG5hbWUuIFRoZSB0ZW1wbGF0ZSBkaXJlY3RvcnkgaXMgcmVzb2x2ZWQgYXRcbi8vIHJ1bnRpbWUgd2l0aCBmYWxsYmFja3Mgc28gaXQgd29ya3MgaW4gZXZlcnkgaG9zdDpcbi8vICAgLSBkZXYgKGB0c3ggd2F0Y2hgKSBhbmQgbG9jYWwgYGRpc3RgIHJ1biB3aXRoIGN3ZCA9IHByb2plY3Qgcm9vdCBcdTIxOTIgc3JjL3RlbXBsYXRlc1xuLy8gICAtIHRoZSBWZXJjZWwgYnVuZGxlIChhcGkvaW5kZXguanMpIGhhcyB0aGUgdGVtcGxhdGVzIGNvcGllZCB0byBhcGkvdGVtcGxhdGVzIFx1MjE5MiA8Y3dkPi90ZW1wbGF0ZXNcbmV4cG9ydCBjb25zdCByZW5kZXJUZW1wbGF0ZSA9IChuYW1lOiBzdHJpbmcsIGRhdGE6IG9iamVjdCk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gIGNvbnN0IGNhbmRpZGF0ZXMgPSBbXG4gICAgcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwic3JjL3RlbXBsYXRlc1wiKSxcbiAgICBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgXCJ0ZW1wbGF0ZXNcIiksXG4gICAgcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwiYXBpL3RlbXBsYXRlc1wiKSxcbiAgXTtcblxuICBjb25zdCBkaXIgPSBjYW5kaWRhdGVzLmZpbmQoKGQpID0+IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKGQsIGAke25hbWV9LmVqc2ApKSk7XG4gIGlmICghZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFbWFpbCB0ZW1wbGF0ZSBcIiR7bmFtZX0uZWpzXCIgbm90IGZvdW5kYCk7XG4gIH1cblxuICByZXR1cm4gZWpzLnJlbmRlckZpbGUocGF0aC5qb2luKGRpciwgYCR7bmFtZX0uZWpzYCksIGRhdGEpO1xufTsiLCAiaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5pbXBvcnQgeyB0cmFuc3BvcnRlciB9IGZyb20gXCIuLi9saWIvbm9kZW1haWxlclwiO1xuaW1wb3J0IHsgcmVuZGVyVGVtcGxhdGUgfSBmcm9tIFwiLi4vdGVtcGxhdGVzXCI7XG5cbi8vIEJlc3QtZWZmb3J0IE5vZGVtYWlsZXIgc2VuZGVycyBmb3IgdGhlIGF1dGggZmxvd3MgKFN0ZXAgMjEpIFx1MjAxNCBtaXJyb3JzIHRoZVxuLy8gcmVmZXJlbmNlIGJhY2tlbmQncyB0cmFuc3BvcnRlci5zZW5kTWFpbCBjYWxscyB3aXRoIEVKUyB0ZW1wbGF0ZXMgcmVuZGVyZWRcbi8vIGZyb20gYHNyYy90ZW1wbGF0ZXMvKi5lanNgLiBFdmVyeSBmYWlsdXJlIChtaXNzaW5nIHRlbXBsYXRlLCBTTVRQIGVycm9yKSBpc1xuLy8gY2F1Z2h0IGFuZCBsb2dnZWQgYXMgYSB3YXJuLCBuZXZlciB0aHJvd24sIHNvIGl0IGNhbid0IGZhaWwgdGhlIGJ1c2luZXNzXG4vLyB3cml0ZSB0aGF0IHRyaWdnZXJlZCBpdC4gQ2FsbCBzaXRlcyBmaXJlIHRoZXNlIGFzXG4vLyBgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW3NlbmRYKC4uLildKWAuXG5cbmNvbnN0IE9UUF9FWFBJUkFUSU9OX01JTlVURVMgPSA1O1xuXG5pbnRlcmZhY2UgSUF1dGhFbWFpbERldGFpbHMge1xuICBlbWFpbDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRBdXRoTWFpbChcbiAgdG86IHN0cmluZyxcbiAgc3ViamVjdDogc3RyaW5nLFxuICBidWlsZDogKCkgPT4gUHJvbWlzZTxzdHJpbmc+LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghdHJhbnNwb3J0ZXIpIHtcbiAgICBjb25zb2xlLndhcm4oXCJbZW1haWxdIFNNVFAgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGF1dGggZW1haWwuXCIpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgaHRtbCA9IGF3YWl0IGJ1aWxkKCk7XG4gICAgYXdhaXQgdHJhbnNwb3J0ZXIuc2VuZE1haWwoe1xuICAgICAgZnJvbTogY29uZmlnLnNtdHBfdXNlciBhcyBzdHJpbmcsXG4gICAgICB0byxcbiAgICAgIHN1YmplY3QsXG4gICAgICBodG1sLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnN0IGRldGFpbCA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICBjb25zb2xlLndhcm4oYFtlbWFpbF0gZmFpbGVkIHRvIHNlbmQgXCIke3N1YmplY3R9XCIgdG8gJHt0b306ICR7ZGV0YWlsfWApO1xuICB9XG59XG5cbi8vIFNlbnQgcmlnaHQgYWZ0ZXIgYSBjcmVkZW50aWFsIHJlZ2lzdHJhdGlvbiBzdGFnZXMgYW4gT1RQIGluIFJlZGlzLlxuZXhwb3J0IGNvbnN0IHNlbmRWZXJpZmljYXRpb25PdHBFbWFpbCA9IGFzeW5jIChcbiAgZGV0YWlsczogSUF1dGhFbWFpbERldGFpbHMgJiB7IG90cDogc3RyaW5nIH0sXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgYXdhaXQgc2VuZEF1dGhNYWlsKGRldGFpbHMuZW1haWwsIFwiRW1haWwgVmVyaWZpY2F0aW9uIE9UUFwiLCAoKSA9PlxuICAgIHJlbmRlclRlbXBsYXRlKFwicmVnaXN0cmF0aW9uLXVzZXItb3RwXCIsIHtcbiAgICAgIG5hbWU6IGRldGFpbHMubmFtZSxcbiAgICAgIGVtYWlsOiBkZXRhaWxzLmVtYWlsLFxuICAgICAgb3RwOiBkZXRhaWxzLm90cCxcbiAgICAgIGV4cGlyYXRpb25NaW51dGVzOiBPVFBfRVhQSVJBVElPTl9NSU5VVEVTLFxuICAgIH0pLFxuICApO1xufTtcblxuLy8gU2VudCBieSB0aGUgZm9yZ290LXBhc3N3b3JkIGZsb3cgd2l0aCB0aGUgcmVzZXQgT1RQLlxuZXhwb3J0IGNvbnN0IHNlbmRGb3Jnb3RQYXNzd29yZE90cEVtYWlsID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQXV0aEVtYWlsRGV0YWlscyAmIHsgb3RwOiBzdHJpbmcgfSxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBhd2FpdCBzZW5kQXV0aE1haWwoZGV0YWlscy5lbWFpbCwgXCJGb3Jnb3QgUGFzc3dvcmQgUmVzZXQgT1RQXCIsICgpID0+XG4gICAgcmVuZGVyVGVtcGxhdGUoXCJmb3Jnb3QtcGFzc3dvcmRcIiwge1xuICAgICAgbmFtZTogZGV0YWlscy5uYW1lLFxuICAgICAgb3RwOiBkZXRhaWxzLm90cCxcbiAgICAgIGV4cGlyYXRpb25NaW51dGVzOiBPVFBfRVhQSVJBVElPTl9NSU5VVEVTLFxuICAgIH0pLFxuICApO1xufTtcblxuLy8gU2VudCBhZnRlciBhIHN1Y2Nlc3NmdWwgZW1haWwgdmVyaWZpY2F0aW9uLiBUaGUgQ1RBIGxpbmtzIHRvIHRoZSBmcm9udGVuZFxuLy8gKHByb2QgVVJMIGluIHByb2R1Y3Rpb24sIGRldiBVUkwgb3RoZXJ3aXNlKTsgaGlkZGVuIHdoZW4gbm8gVVJMIGlzIHNldC5cbmV4cG9ydCBjb25zdCBzZW5kV2VsY29tZUVtYWlsID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQXV0aEVtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBhd2FpdCBzZW5kQXV0aE1haWwoZGV0YWlscy5lbWFpbCwgXCJXZWxjb21lIHRvIFRyaXBWZXJzZVwiLCAoKSA9PlxuICAgIHJlbmRlclRlbXBsYXRlKFwid2VsY29tZS1lbWFpbFwiLCB7XG4gICAgICBuYW1lOiBkZXRhaWxzLm5hbWUsXG4gICAgICBmcm9udGVuZFVybDpcbiAgICAgICAgY29uZmlnLm5vZGVfZW52ID09PSBcInByb2R1Y3Rpb25cIlxuICAgICAgICAgID8gY29uZmlnLmZyb250ZW5kX3VybF9wcm9kXG4gICAgICAgICAgOiBjb25maWcuZnJvbnRlbmRfdXJsX2RldixcbiAgICB9KSxcbiAgKTtcbn07XG5cbi8vIFNlbnQgYWZ0ZXIgYSBzdWNjZXNzZnVsIHBhc3N3b3JkIHJlc2V0LlxuZXhwb3J0IGNvbnN0IHNlbmRQYXNzd29yZFJlc2V0U3VjY2Vzc0VtYWlsID0gYXN5bmMgKFxuICBkZXRhaWxzOiBJQXV0aEVtYWlsRGV0YWlscyxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBhd2FpdCBzZW5kQXV0aE1haWwoZGV0YWlscy5lbWFpbCwgXCJQYXNzd29yZCBSZXNldFwiLCAoKSA9PlxuICAgIHJlbmRlclRlbXBsYXRlKFwicmVzZXQtcGFzc3dvcmQtc3VjY2Vzc1wiLCB7XG4gICAgICBuYW1lOiBkZXRhaWxzLm5hbWUsXG4gICAgfSksXG4gICk7XG59OyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlcXVlc3RIYW5kbGVyLCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5cbmV4cG9ydCBjb25zdCBjYXRjaEFzeW5jID0gKGZuOiBSZXF1ZXN0SGFuZGxlcikgPT4ge1xuICByZXR1cm4gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZuKHJlcSwgcmVzLCBuZXh0KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbmV4dChlcnJvcik7XG4gICAgfVxuICB9O1xufTtcbiIsICJpbXBvcnQgeyBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5cbnR5cGUgVE1ldGEgPSB7XG4gIHBhZ2U6IG51bWJlcjtcbiAgbGltaXQ6IG51bWJlcjtcbiAgdG90YWw6IG51bWJlcjtcbiAgdG90YWxQYWdlczogbnVtYmVyO1xufTtcblxudHlwZSBUUmVzcG9uc2VEYXRhPFQ+ID0ge1xuICBzdWNjZXNzOiBib29sZWFuO1xuICBzdGF0dXNDb2RlOiBudW1iZXI7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgZGF0YTogVDtcbiAgbWV0YT86IFRNZXRhO1xufTtcblxuZXhwb3J0IGNvbnN0IHNlbmRSZXNwb25zZSA9IDxUPihyZXM6IFJlc3BvbnNlLCBkYXRhOiBUUmVzcG9uc2VEYXRhPFQ+KSA9PiB7XG4gIHJlcy5zdGF0dXMoZGF0YS5zdGF0dXNDb2RlKS5qc29uKHtcbiAgICBzdWNjZXNzOiBkYXRhLnN1Y2Nlc3MsXG4gICAgbWVzc2FnZTogZGF0YS5tZXNzYWdlLFxuICAgIGRhdGE6IGRhdGEuZGF0YSxcbiAgICBtZXRhOiBkYXRhLm1ldGEsXG4gIH0pO1xufTtcbiIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5cbmNvbnN0IHJlZ2lzdGVyU2NoZW1hID0gei5vYmplY3Qoe1xuICBuYW1lOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAubWluKDIsIFwiTmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpLFxuICBlbWFpbDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFbWFpbCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5lbWFpbChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWxcIiksXG4gIHBhc3N3b3JkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhc3N3b3JkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDYsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBsZWFzdCA2IGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDcyLCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbW9zdCA3MiBjaGFyYWN0ZXJzXCIpLFxuICBwaG9uZTogelxuICAgIC5zdHJpbmcoKVxuICAgIC5tYXgoMjAsIFwiUGhvbmUgbnVtYmVyIGlzIHRvbyBsb25nXCIpXG4gICAgLm9wdGlvbmFsKCksXG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IGxvZ2luU2NoZW1hID0gei5vYmplY3Qoe1xuICBlbWFpbDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFbWFpbCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5lbWFpbChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWxcIiksXG4gIHBhc3N3b3JkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhc3N3b3JkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IGdvb2dsZUxvZ2luU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZFRva2VuOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkdvb2dsZSBpZFRva2VuIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IGRlbW9Mb2dpblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUsIHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHJvbGVcIixcbiAgfSksXG59KTtcblxuLy8gcmVmcmVzaFRva2VuIG1heSBjb21lIGZyb20gdGhlIGh0dHBPbmx5IGNvb2tpZSBPUiB0aGUgcmVxdWVzdCBib2R5IFx1MjAxNFxuLy8gdmFsaWRhdGlvbiBpcyBsZW5pZW50IGhlcmU7IHRoZSBjb250cm9sbGVyIGhhbmRsZXMgYm90aCBzb3VyY2VzLlxuY29uc3QgcmVmcmVzaFRva2VuU2NoZW1hID0gei5vYmplY3Qoe1xuICByZWZyZXNoVG9rZW46IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgZW1haWxTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFbWFpbCBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbFwiKTtcblxuY29uc3Qgb3RwU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiT1RQIGlzIHJlcXVpcmVkXCIgfSlcbiAgLmxlbmd0aCg2LCBcIk9UUCBtdXN0IGJlIGV4YWN0bHkgNiBkaWdpdHNcIilcbiAgLnJlZ2V4KC9eXFxkezZ9JC8sIFwiT1RQIG11c3QgYmUgZXhhY3RseSA2IGRpZ2l0c1wiKTtcblxuY29uc3QgdmVyaWZ5RW1haWxTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGVtYWlsOiBlbWFpbFNjaGVtYSxcbiAgb3RwOiBvdHBTY2hlbWEsXG59KTtcblxuY29uc3QgcmVzZW5kVmVyaWZpY2F0aW9uU2NoZW1hID0gei5vYmplY3Qoe1xuICBlbWFpbDogZW1haWxTY2hlbWEsXG59KTtcblxuY29uc3QgZm9yZ290UGFzc3dvcmRTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGVtYWlsOiBlbWFpbFNjaGVtYSxcbn0pO1xuXG5jb25zdCByZXNldFBhc3N3b3JkU2NoZW1hID0gei5vYmplY3Qoe1xuICBlbWFpbDogZW1haWxTY2hlbWEsXG4gIG90cDogb3RwU2NoZW1hLFxuICBuZXdQYXNzd29yZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOZXcgcGFzc3dvcmQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oNiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IGxlYXN0IDYgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoNzIsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBtb3N0IDcyIGNoYXJhY3RlcnNcIiksXG59KTtcblxuZXhwb3J0IHR5cGUgVFJlZ2lzdGVyU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgcmVnaXN0ZXJTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVExvZ2luU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgbG9naW5TY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEdvb2dsZUxvZ2luU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgZ29vZ2xlTG9naW5TY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFJlZnJlc2hUb2tlblNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHJlZnJlc2hUb2tlblNjaGVtYT47XG5leHBvcnQgdHlwZSBUVmVyaWZ5RW1haWxTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiB2ZXJpZnlFbWFpbFNjaGVtYT47XG5leHBvcnQgdHlwZSBUUmVzZXRQYXNzd29yZFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHJlc2V0UGFzc3dvcmRTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgYXV0aFZhbGlkYXRpb25zID0ge1xuICByZWdpc3RlclNjaGVtYSxcbiAgbG9naW5TY2hlbWEsXG4gIGdvb2dsZUxvZ2luU2NoZW1hLFxuICBkZW1vTG9naW5TY2hlbWEsXG4gIHJlZnJlc2hUb2tlblNjaGVtYSxcbiAgdmVyaWZ5RW1haWxTY2hlbWEsXG4gIHJlc2VuZFZlcmlmaWNhdGlvblNjaGVtYSxcbiAgZm9yZ290UGFzc3dvcmRTY2hlbWEsXG4gIHJlc2V0UGFzc3dvcmRTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFpvZFR5cGUgfSBmcm9tIFwiem9kXCI7XG5cbnR5cGUgVmFsaWRhdGlvblNjaGVtYSA9IHtcbiAgYm9keT86IFpvZFR5cGU7XG4gIHF1ZXJ5PzogWm9kVHlwZTtcbiAgcGFyYW1zPzogWm9kVHlwZTtcbn07XG5cbi8vIFJ1bnMgWm9kIHNjaGVtYXMgYWdhaW5zdCByZXEuYm9keS9xdWVyeS9wYXJhbXMgYW5kIHJlcGxhY2VzIHRoZSBwYXJzZWRcbi8vIHZhbHVlcyBzbyBkb3duc3RyZWFtIGhhbmRsZXJzIHdvcmsgd2l0aCB2YWxpZGF0ZWQgKGFuZCB0eXBlZCkgZGF0YS5cbi8vIEFueSBab2RFcnJvciB0aHJvd24gaGVyZSBpcyBtYXBwZWQgdG8gYSA0MDAgYnkgZ2xvYmFsRXJyb3JIYW5kbGVyLlxuLy9cbi8vIHJlcS5ib2R5IGlzIHNhZmVseSB3cml0YWJsZSwgYnV0IGluIEV4cHJlc3MgNSByZXEucXVlcnkvcmVxLnBhcmFtcyBhcmVcbi8vIGdldHRlci1vbmx5IFx1MjAxNCB0aGV5IG11c3QgYmUgcmVkZWZpbmVkIHZpYSBkZWZpbmVQcm9wZXJ0eSB0byBzd2FwIGluIHRoZVxuLy8gcGFyc2VkIHZhbHVlcy5cbmNvbnN0IHZhbGlkYXRlUmVxdWVzdCA9IChzY2hlbWE6IFZhbGlkYXRpb25TY2hlbWEpID0+IHtcbiAgcmV0dXJuIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGlmIChzY2hlbWEuYm9keSkge1xuICAgICAgcmVxLmJvZHkgPSBzY2hlbWEuYm9keS5wYXJzZShyZXEuYm9keSk7XG4gICAgfVxuICAgIGlmIChzY2hlbWEucXVlcnkpIHtcbiAgICAgIGNvbnN0IHBhcnNlZFF1ZXJ5ID0gc2NoZW1hLnF1ZXJ5LnBhcnNlKHJlcS5xdWVyeSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVxLCBcInF1ZXJ5XCIsIHtcbiAgICAgICAgdmFsdWU6IHBhcnNlZFF1ZXJ5LFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChzY2hlbWEucGFyYW1zKSB7XG4gICAgICBjb25zdCBwYXJzZWRQYXJhbXMgPSBzY2hlbWEucGFyYW1zLnBhcnNlKHJlcS5wYXJhbXMpO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHJlcSwgXCJwYXJhbXNcIiwge1xuICAgICAgICB2YWx1ZTogcGFyc2VkUGFyYW1zLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgbmV4dCgpO1xuICB9O1xufTtcblxuZXhwb3J0IGRlZmF1bHQgdmFsaWRhdGVSZXF1ZXN0OyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IEp3dFBheWxvYWQgfSBmcm9tIFwianNvbndlYnRva2VuXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IGp3dFV0aWxzIH0gZnJvbSBcIi4uL3V0aWxzL2p3dFwiO1xuXG4vLyBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pIFx1MjE5MiBvbmx5IHRob3NlIHJvbGVzIHBhc3Ncbi8vIGF1dGgoKSBcdTIxOTIgYW55IGF1dGhlbnRpY2F0ZWQgdXNlciBwYXNzZXNcbmNvbnN0IGF1dGggPSAoLi4ucmVxdWlyZWRSb2xlczogUm9sZVtdKSA9PiB7XG4gIHJldHVybiBjYXRjaEFzeW5jKGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLmNvb2tpZXMuYWNjZXNzVG9rZW5cbiAgICAgID8gcmVxLmNvb2tpZXMuYWNjZXNzVG9rZW5cbiAgICAgIDogcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbj8uc3RhcnRzV2l0aChcIkJlYXJlciBcIilcbiAgICAgICAgPyByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uLnNwbGl0KFwiIFwiKVsxXVxuICAgICAgICA6IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb247XG5cbiAgICAvLyAxLiB0b2tlbiBtdXN0IGJlIHByZXNlbnRcbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMSxcbiAgICAgICAgXCJZb3UgYXJlIG5vdCBsb2dnZWQgaW4uIFBsZWFzZSBsb2dpbiB0byBjb250aW51ZS5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gMi4gdmVyaWZ5IHRoZSBhY2Nlc3MgdG9rZW5cbiAgICBjb25zdCB2ZXJpZmllZFRva2VuID0gand0VXRpbHMudmVyaWZ5VG9rZW4oXG4gICAgICB0b2tlbixcbiAgICAgIGNvbmZpZy5qd3RfYWNjZXNzX3NlY3JldCxcbiAgICApO1xuXG4gICAgaWYgKCF2ZXJpZmllZFRva2VuLnN1Y2Nlc3MpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIHZlcmlmaWVkVG9rZW4uZXJyb3IpO1xuICAgIH1cblxuICAgIGNvbnN0IHsgaWQsIHRva2VuVmVyc2lvbiB9ID0gdmVyaWZpZWRUb2tlbi5kYXRhIGFzIEp3dFBheWxvYWQgJiB7XG4gICAgICB0b2tlblZlcnNpb246IG51bWJlcjtcbiAgICB9O1xuXG4gICAgLy8gMy4gcmUtZmV0Y2ggdXNlciB0byBlbmZvcmNlIGFjY291bnQgc3RhdGUgb24gZXZlcnkgcmVxdWVzdFxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiVXNlciBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDMsXG4gICAgICAgIFwiVXNlciBpcyBzdXNwZW5kZWQuIFBsZWFzZSBjb250YWN0IHN1cHBvcnQgc2VydmljZS5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gNC4gdG9rZW5WZXJzaW9uIG11c3QgbWF0Y2ggREIgKGxvZ291dCAvIHBhc3N3b3JkIGNoYW5nZSBraWxscyBvbGQgdG9rZW5zKVxuICAgIGlmICh1c2VyLnRva2VuVmVyc2lvbiAhPT0gdG9rZW5WZXJzaW9uKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMSxcbiAgICAgICAgXCJTZXNzaW9uIGlzIG5vIGxvbmdlciB2YWxpZC4gUGxlYXNlIGxvZ2luIGFnYWluLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA1LiBhdXRob3JpemF0aW9uIHVzZXMgdGhlIERCIHJvbGUsIG5vdCB0aGUgKHBvc3NpYmx5IHN0YWxlKSBKV1Qgcm9sZVxuICAgIGlmIChyZXF1aXJlZFJvbGVzLmxlbmd0aCAmJiAhcmVxdWlyZWRSb2xlcy5pbmNsdWRlcyh1c2VyLnJvbGUpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIGFjY2VzcyB0aGlzIHJvdXRlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA2LiBhdHRhY2ggdGhlIGF1dGhlbnRpY2F0ZWQgdXNlciB0byB0aGUgcmVxdWVzdFxuICAgIHJlcS51c2VyID0ge1xuICAgICAgaWQ6IHVzZXIuaWQsXG4gICAgICBuYW1lOiB1c2VyLm5hbWUsXG4gICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgIHJvbGU6IHVzZXIucm9sZSxcbiAgICB9O1xuXG4gICAgbmV4dCgpO1xuICB9KTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGF1dGg7IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyB1c2VyQ29udHJvbGxlciB9IGZyb20gXCIuL3VzZXIuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgdXNlclZhbGlkYXRpb25zIH0gZnJvbSBcIi4vdXNlci52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBPd24gcHJvZmlsZSBcdTIwMTQgYW55IGF1dGhlbnRpY2F0ZWQgdXNlclxucm91dGVyLnBhdGNoKFxuICBcIi9wcm9maWxlXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogdXNlclZhbGlkYXRpb25zLnVwZGF0ZVByb2ZpbGVTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLnVwZGF0ZVByb2ZpbGUsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgbGlzdCB1c2VycyB3aXRoIGZpbHRlcnMgKyBwYWdpbmF0aW9uXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHVzZXJWYWxpZGF0aW9ucy51c2VyUXVlcnlTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLmdldFVzZXJzLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IHJvbGUgbWFuYWdlbWVudFxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvcm9sZVwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogdXNlclZhbGlkYXRpb25zLmNoYW5nZVJvbGVTY2hlbWEsXG4gIH0pLFxuICB1c2VyQ29udHJvbGxlci5jaGFuZ2VSb2xlLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IHN0YXR1cyBtYW5hZ2VtZW50XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHVzZXJWYWxpZGF0aW9ucy51c2VyUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHVzZXJWYWxpZGF0aW9ucy5jaGFuZ2VTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICB1c2VyQ29udHJvbGxlci5jaGFuZ2VTdGF0dXMsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgc29mdCBkZWxldGVcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHVzZXJWYWxpZGF0aW9ucy51c2VyUGFyYW1zU2NoZW1hIH0pLFxuICB1c2VyQ29udHJvbGxlci5kZWxldGVVc2VyLFxuKTtcblxuZXhwb3J0IGNvbnN0IHVzZXJSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyB1c2VyU2VydmljZSB9IGZyb20gXCIuL3VzZXIuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIFVwZGF0ZSBwcm9maWxlIGNvbnRyb2xsZXJcbmNvbnN0IHVwZGF0ZVByb2ZpbGUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHVzZXJTZXJ2aWNlLnVwZGF0ZVByb2ZpbGUodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUHJvZmlsZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgYWxsIHVzZXJzIChhZG1pbilcbmNvbnN0IGdldFVzZXJzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXNlclNlcnZpY2UuZ2V0VXNlcnMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VycyBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBVcGRhdGUgdXNlciByb2xlIChhZG1pbilcbmNvbnN0IGNoYW5nZVJvbGUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IGRvd25ncmFkZS9jaGFuZ2UgdGhlaXIgb3duIHJvbGVcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgY2hhbmdlIHlvdXIgb3duIHJvbGUuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuY2hhbmdlUm9sZShpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgcm9sZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBVcGRhdGUgdXNlciBzdGF0dXMgKGFkbWluKVxuY29uc3QgY2hhbmdlU3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICAvLyBhbiBhZG1pbiBtdXN0IG5vdCBzdXNwZW5kL2FjdGl2YXRlIHRoZWlyIG93biBhY2NvdW50XG4gICAgaWYgKGlkID09PSByZXEudXNlcj8uaWQpIHtcbiAgICAgIHJldHVybiBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkZPUkJJRERFTixcbiAgICAgICAgbWVzc2FnZTogXCJZb3UgY2Fubm90IGNoYW5nZSB5b3VyIG93biBzdGF0dXMuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuY2hhbmdlU3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gU29mdCBkZWxldGUgdXNlciAoYWRtaW4pXG5jb25zdCBkZWxldGVVc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICAvLyBhbiBhZG1pbiBtdXN0IG5vdCBkZWxldGUgdGhlaXIgb3duIGFjY291bnRcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgZGVsZXRlIHlvdXIgb3duIGFjY291bnQuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuZGVsZXRlVXNlcihpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgdXNlckNvbnRyb2xsZXIgPSB7XG4gIHVwZGF0ZVByb2ZpbGUsXG4gIGdldFVzZXJzLFxuICBjaGFuZ2VSb2xlLFxuICBjaGFuZ2VTdGF0dXMsXG4gIGRlbGV0ZVVzZXIsXG59OyIsICJpbXBvcnQgYmNyeXB0IGZyb20gXCJiY3J5cHRqc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgUm9sZSwgVXNlclN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQge1xuICBJQ2hhbmdlUm9sZSxcbiAgSUNoYW5nZVN0YXR1cyxcbiAgSVVwZGF0ZVByb2ZpbGUsXG4gIElVc2VyUXVlcnksXG59IGZyb20gXCIuL3VzZXIuaW50ZXJmYWNlXCI7XG5cbmNvbnN0IHZhbGlkYXRlQWN0aXZlVXNlciA9IGFzeW5jIChpZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcblxuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiVXNlciBpcyBzdXNwZW5kZWQuIFBsZWFzZSBjb250YWN0IHN1cHBvcnQgc2VydmljZS5cIik7XG4gIH1cblxuICByZXR1cm4gdXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBVcGRhdGUgcHJvZmlsZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHVwZGF0ZVByb2ZpbGUgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHBheWxvYWQ6IElVcGRhdGVQcm9maWxlKSA9PiB7XG4gIGNvbnN0IHsgbmFtZSwgcGhvbmUsIGF2YXRhclVybCwgY3VycmVudFBhc3N3b3JkLCBuZXdQYXNzd29yZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogdXNlcklkIH0gfSk7XG5cbiAgaWYgKHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGhhcyBiZWVuIGRlbGV0ZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAzLFxuICAgICAgXCJHb29nbGUgYWNjb3VudHMgY2Fubm90IGNoYW5nZSBwYXNzd29yZC4gVXNlIEdvb2dsZSBzaWduLWluIHRvIG1hbmFnZSB5b3VyIHByb2ZpbGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5Vc2VyVXBkYXRlSW5wdXQgPSB7fTtcblxuICBpZiAobmFtZSkgZGF0YS5uYW1lID0gbmFtZTtcbiAgaWYgKHBob25lKSBkYXRhLnBob25lID0gcGhvbmU7XG4gIGlmIChhdmF0YXJVcmwpIGRhdGEuYXZhdGFyVXJsID0gYXZhdGFyVXJsO1xuXG4gIC8vIFBhc3N3b3JkIGNoYW5nZSByZXF1aXJlcyBjdXJyZW50UGFzc3dvcmQgKyBuZXdQYXNzd29yZFxuICBpZiAobmV3UGFzc3dvcmQpIHtcbiAgICBpZiAoIWN1cnJlbnRQYXNzd29yZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDdXJyZW50IHBhc3N3b3JkIGlzIHJlcXVpcmVkXCIpO1xuICAgIH1cbiAgICBpZiAoY3VycmVudFBhc3N3b3JkID09PSBuZXdQYXNzd29yZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJOZXcgcGFzc3dvcmQgbXVzdCBiZSBkaWZmZXJlbnRcIik7XG4gICAgfVxuXG4gICAgY29uc3QgaXNNYXRjaCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKGN1cnJlbnRQYXNzd29yZCwgdXNlci5wYXNzd29yZCB8fCBcIlwiKTtcbiAgICBpZiAoIWlzTWF0Y2gpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBjdXJyZW50IHBhc3N3b3JkXCIpO1xuICAgIH1cblxuICAgIGRhdGEucGFzc3dvcmQgPSBhd2FpdCBiY3J5cHQuaGFzaChcbiAgICAgIG5ld1Bhc3N3b3JkLFxuICAgICAgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpLFxuICAgICk7XG4gICAgZGF0YS50b2tlblZlcnNpb24gPSB7IGluY3JlbWVudDogMSB9O1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBkYXRhLFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBsaXN0IHVzZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0VXNlcnMgPSBhc3luYyAocXVlcnk6IElVc2VyUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgfHwgMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCB8fCAxMDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlVzZXJXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gIH07XG5cbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIHdoZXJlLk9SID0gW1xuICAgICAgeyBuYW1lOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICB7IGVtYWlsOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgXTtcbiAgfVxuICBpZiAocXVlcnkucm9sZSkgd2hlcmUucm9sZSA9IHF1ZXJ5LnJvbGU7XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcblxuICBjb25zdCBbdXNlcnMsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudXNlci5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIHNraXA6IChwYWdlIC0gMSkgKiBsaW1pdCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gICAgfSksXG4gICAgcHJpc21hLnVzZXIuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiB1c2VycyxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiB1cGRhdGUgcm9sZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNoYW5nZVJvbGUgPSBhc3luYyAoaWQ6IHN0cmluZywgcGF5bG9hZDogSUNoYW5nZVJvbGUpID0+IHtcbiAgY29uc3QgeyByb2xlIH0gPSBwYXlsb2FkO1xuXG4gIGF3YWl0IHZhbGlkYXRlQWN0aXZlVXNlcihpZCk7XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YTogeyByb2xlLCB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB1cGRhdGVkVXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogdXBkYXRlIHN0YXR1cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNoYW5nZVN0YXR1cyA9IGFzeW5jIChpZDogc3RyaW5nLCBwYXlsb2FkOiBJQ2hhbmdlU3RhdHVzKSA9PiB7XG4gIGNvbnN0IHsgc3RhdHVzIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuXG4gIGNvbnN0IHVwZGF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGRhdGE6IHtcbiAgICAgIHN0YXR1cyxcbiAgICAgIC8vIHJlYWN0aXZhdGluZyBwcmVzZXJ2ZXMgdGhlIGFjY291bnQgd2hpbGUgc3VzcGVuZGluZyByZXZva2VzIGFsbCBzZXNzaW9uc1xuICAgICAgLi4uKHN0YXR1cyA9PT0gVXNlclN0YXR1cy5TVVNQRU5ERUQgJiYgeyB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSksXG4gICAgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB1cGRhdGVkVXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogc29mdCBkZWxldGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBkZWxldGVVc2VyID0gYXN5bmMgKGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgY29uc3QgZGVsZXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUsIHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGRlbGV0ZWRVc2VyO1xufTtcblxuZXhwb3J0IGNvbnN0IHVzZXJTZXJ2aWNlID0ge1xuICB1cGRhdGVQcm9maWxlLFxuICBnZXRVc2VycyxcbiAgY2hhbmdlUm9sZSxcbiAgY2hhbmdlU3RhdHVzLFxuICBkZWxldGVVc2VyLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IFJvbGUsIFVzZXJTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCB1cGRhdGVQcm9maWxlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBuYW1lOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC50cmltKClcbiAgICAgIC5taW4oMiwgXCJOYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gICAgcGhvbmU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1heCgyMCwgXCJQaG9uZSBudW1iZXIgaXMgdG9vIGxvbmdcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICAgIGF2YXRhclVybDogei5zdHJpbmcoKS50cmltKCkudXJsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBpbWFnZSBVUkxcIikub3B0aW9uYWwoKSxcbiAgICBjdXJyZW50UGFzc3dvcmQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG4gICAgbmV3UGFzc3dvcmQ6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLm1pbig2LCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzXCIpXG4gICAgICAubWF4KDcyLCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbW9zdCA3MiBjaGFyYWN0ZXJzXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnJlZmluZShcbiAgICAoZGF0YSkgPT5cbiAgICAgIGRhdGEubmV3UGFzc3dvcmQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgZGF0YS5jdXJyZW50UGFzc3dvcmQgIT09IHVuZGVmaW5lZCxcbiAgICB7IG1lc3NhZ2U6IFwiQ3VycmVudCBwYXNzd29yZCBpcyByZXF1aXJlZCB0byBjaGFuZ2UgcGFzc3dvcmRcIiB9LFxuICApO1xuXG5jb25zdCB1c2VyUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkub3B0aW9uYWwoKSxcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUpLm9wdGlvbmFsKCksXG4gIHN0YXR1czogei5uYXRpdmVFbnVtKFVzZXJTdGF0dXMpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgdXNlclBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVXNlciBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBjaGFuZ2VSb2xlU2NoZW1hID0gei5vYmplY3Qoe1xuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSwgeyByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHJvbGVcIiB9KSxcbn0pO1xuXG5jb25zdCBjaGFuZ2VTdGF0dXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHN0YXR1czogei5uYXRpdmVFbnVtKFVzZXJTdGF0dXMsIHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHN0YXR1c1wiLFxuICB9KSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUVXBkYXRlUHJvZmlsZVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHVwZGF0ZVByb2ZpbGVTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFVzZXJRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHVzZXJRdWVyeVNjaGVtYT47XG5cbmV4cG9ydCBjb25zdCB1c2VyVmFsaWRhdGlvbnMgPSB7XG4gIHVwZGF0ZVByb2ZpbGVTY2hlbWEsXG4gIHVzZXJRdWVyeVNjaGVtYSxcbiAgdXNlclBhcmFtc1NjaGVtYSxcbiAgY2hhbmdlUm9sZVNjaGVtYSxcbiAgY2hhbmdlU3RhdHVzU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBtdWx0ZXIgZnJvbSBcIm11bHRlclwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgeyB1cGxvYWRzQ29udHJvbGxlciB9IGZyb20gXCIuL3VwbG9hZHMuY29udHJvbGxlclwiO1xuXG5jb25zdCB1cGxvYWQgPSBtdWx0ZXIoe1xuICBzdG9yYWdlOiBtdWx0ZXIubWVtb3J5U3RvcmFnZSgpLFxuICBsaW1pdHM6IHsgZmlsZVNpemU6IDUgKiAxMDI0ICogMTAyNCB9LFxuICBmaWxlRmlsdGVyOiAoX3JlcSwgZmlsZSwgY2IpID0+IHtcbiAgICBpZiAoL15pbWFnZVxcLyhqcGVnfHBuZ3x3ZWJwKSQvLnRlc3QoZmlsZS5taW1ldHlwZSkpIHtcbiAgICAgIGNiKG51bGwsIHRydWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYihcbiAgICAgICAgT2JqZWN0LmFzc2lnbihuZXcgRXJyb3IoXCJPbmx5IGpwZywgcG5nIG9yIHdlYnAgaW1hZ2VzIGFyZSBhbGxvd2VkXCIpLCB7XG4gICAgICAgICAgY29kZTogXCJJTlZBTElEX0ZJTEVfVFlQRVwiLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfVxuICB9LFxufSk7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvaW1hZ2VcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdXBsb2FkLnNpbmdsZShcImltYWdlXCIpLFxuICB1cGxvYWRzQ29udHJvbGxlci51cGxvYWRJbWFnZSxcbik7XG5cbmV4cG9ydCBjb25zdCB1cGxvYWRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeSB9IGZyb20gXCIuL3VwbG9hZHMuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuXG4vLyBVcGxvYWQgYSBzaW5nbGUgaW1hZ2UgKEFHRU5UL0FETUlOKSBcdTIxOTIgQ2xvdWRpbmFyeVxuY29uc3QgdXBsb2FkSW1hZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBpZiAoIXJlcS5maWxlKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkltYWdlIGZpbGUgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXBsb2FkSW1hZ2VUb0Nsb3VkaW5hcnkocmVxLmZpbGUpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiSW1hZ2UgdXBsb2FkZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZHNDb250cm9sbGVyID0ge1xuICB1cGxvYWRJbWFnZSxcbn07IiwgImltcG9ydCB7IHYyIGFzIGNsb3VkaW5hcnkgfSBmcm9tIFwiY2xvdWRpbmFyeVwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmNsb3VkaW5hcnkuY29uZmlnKHtcbiAgY2xvdWRfbmFtZTogY29uZmlnLmNsb3VkaW5hcnlfY2xvdWRfbmFtZSxcbiAgYXBpX2tleTogY29uZmlnLmNsb3VkaW5hcnlfYXBpX2tleSxcbiAgYXBpX3NlY3JldDogY29uZmlnLmNsb3VkaW5hcnlfYXBpX3NlY3JldCxcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBjbG91ZGluYXJ5OyIsICJpbXBvcnQgY2xvdWRpbmFyeSBmcm9tIFwiLi4vLi4vbGliL2Nsb3VkaW5hcnlcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbmV4cG9ydCBjb25zdCB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeSA9IChcbiAgZmlsZTogRXhwcmVzcy5NdWx0ZXIuRmlsZSxcbik6IFByb21pc2U8eyB1cmw6IHN0cmluZzsgcHVibGljSWQ6IHN0cmluZyB9PiA9PiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3QgdXBsb2FkU3RyZWFtID0gY2xvdWRpbmFyeS51cGxvYWRlci51cGxvYWRfc3RyZWFtKFxuICAgICAgeyBmb2xkZXI6IFwidHJpcHZlcnNlXCIgfSxcbiAgICAgIChlcnJvciwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChlcnJvciB8fCAhcmVzdWx0KSB7XG4gICAgICAgICAgcmVqZWN0KG5ldyBBcHBFcnJvcig0MDAsIFwiSW1hZ2UgdXBsb2FkIGZhaWxlZC4gUGxlYXNlIHRyeSBhZ2Fpbi5cIikpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICByZXNvbHZlKHsgdXJsOiByZXN1bHQuc2VjdXJlX3VybCwgcHVibGljSWQ6IHJlc3VsdC5wdWJsaWNfaWQgfSk7XG4gICAgICB9LFxuICAgICk7XG5cbiAgICB1cGxvYWRTdHJlYW0uZW5kKGZpbGUuYnVmZmVyKTtcbiAgfSk7XG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgY29udGFjdENvbnRyb2xsZXIgfSBmcm9tIFwiLi9jb250YWN0LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGNvbnRhY3RWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2NvbnRhY3QudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSByb3V0ZSAocHVibGljLCBubyBhdXRoKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBjb250YWN0VmFsaWRhdGlvbnMuY3JlYXRlTWVzc2FnZVNjaGVtYSB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIuY3JlYXRlTWVzc2FnZSxcbik7XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyByb3V0ZSAoYWRtaW4gb25seSlcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogY29udGFjdFZhbGlkYXRpb25zLmNvbnRhY3RRdWVyeVNjaGVtYSB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIuZ2V0TWVzc2FnZXMsXG4pO1xuXG4vLyAzLiBNYXJrIHJlc29sdmVkL3VucmVzb2x2ZWQgcm91dGUgKGFkbWluIG9ubHkpXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogY29udGFjdFZhbGlkYXRpb25zLmNvbnRhY3RQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogY29udGFjdFZhbGlkYXRpb25zLnVwZGF0ZVJlc29sdmVkU2NoZW1hLFxuICB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIudXBkYXRlUmVzb2x2ZWQsXG4pO1xuXG5leHBvcnQgY29uc3QgY29udGFjdFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGNvbnRhY3RTZXJ2aWNlIH0gZnJvbSBcIi4vY29udGFjdC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSBjb250cm9sbGVyIChwdWJsaWMpXG5jb25zdCBjcmVhdGVNZXNzYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IGNvbnRhY3RTZXJ2aWNlLmNyZWF0ZU1lc3NhZ2UocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiTWVzc2FnZSBzZW50IHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG1lc3NhZ2UsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBMaXN0IGNvbnRhY3QgbWVzc2FnZXMgY29udHJvbGxlciAoYWRtaW4gb25seSlcbmNvbnN0IGdldE1lc3NhZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGFjdFNlcnZpY2UubGlzdE1lc3NhZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ29udGFjdCBtZXNzYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIE1hcmsgcmVzb2x2ZWQvdW5yZXNvbHZlZCBjb250cm9sbGVyIChhZG1pbiBvbmx5KVxuY29uc3QgdXBkYXRlUmVzb2x2ZWQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCB7IGlzUmVzb2x2ZWQgfSA9IHJlcS5ib2R5O1xuXG4gICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IGNvbnRhY3RTZXJ2aWNlLnJlc29sdmVNZXNzYWdlKGlkLCBpc1Jlc29sdmVkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJNZXNzYWdlIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG1lc3NhZ2UsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgY29udGFjdENvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZU1lc3NhZ2UsXG4gIGdldE1lc3NhZ2VzLFxuICB1cGRhdGVSZXNvbHZlZCxcbn07IiwgImltcG9ydCB7IFJlc2VuZCB9IGZyb20gXCJyZXNlbmRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRhY3RFbWFpbERldGFpbHMge1xuICBuYW1lOiBzdHJpbmc7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIHN1YmplY3Q6IHN0cmluZztcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBjcmVhdGVkQXQ/OiBEYXRlO1xufVxuXG4vLyBMYXppbHkgaW5pdGlhbGlzZWQgc28gdGhlIG1vZHVsZSBpcyBpbXBvcnRhYmxlIGV2ZW4gd2hlbiBSRVNFTkRfQVBJX0tFWVxuLy8gaXMgbm90IGNvbmZpZ3VyZWQgKGUuZy4gbG9jYWwgZGV2IC8gZGVtbyB3aXRob3V0IGVtYWlsKS5cbmxldCByZXNlbmQ6IFJlc2VuZCB8IG51bGwgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXRSZXNlbmQoKTogUmVzZW5kIHwgbnVsbCB7XG4gIGlmIChyZXNlbmQpIHJldHVybiByZXNlbmQ7XG4gIGlmICghY29uZmlnLnJlc2VuZF9hcGlfa2V5KSByZXR1cm4gbnVsbDtcbiAgcmVzZW5kID0gbmV3IFJlc2VuZChjb25maWcucmVzZW5kX2FwaV9rZXkpO1xuICByZXR1cm4gcmVzZW5kO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlSHRtbCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHZhbHVlXG4gICAgLnJlcGxhY2UoLyYvZywgXCImYW1wO1wiKVxuICAgIC5yZXBsYWNlKC88L2csIFwiJmx0O1wiKVxuICAgIC5yZXBsYWNlKC8+L2csIFwiJmd0O1wiKVxuICAgIC5yZXBsYWNlKC9cIi9nLCBcIiZxdW90O1wiKVxuICAgIC5yZXBsYWNlKC8nL2csIFwiJiMwMzk7XCIpO1xufVxuXG4vLyBXcmFwcyBhIFJlc2VuZCBzZW5kIHNvIGZhaWx1cmVzIGJlY29tZSBhIHNpbmdsZSBjbGVhbiB3YXJuaW5nIGxpbmUgaW5zdGVhZFxuLy8gb2YgdGhlIFNESydzIG5vaXN5IG11bHRpLWxpbmUgZXJyb3IuIFJlc2VuZCBjYW4gbGVnaXRpbWF0ZWx5IHJlamVjdCBzZW5kc1xuLy8gKGUuZy4gdGhlIGRlZmF1bHQgb25ib2FyZGluZ0ByZXNlbmQuZGV2IHNlbmRlciBtYXkgb25seSBkZWxpdmVyIHRvIHRoZVxuLy8gYWNjb3VudCBvd25lciksIHNvIGVtYWlscyBhcmUgc3RyaWN0bHkgYmVzdC1lZmZvcnQuXG5hc3luYyBmdW5jdGlvbiBzZW5kV2l0aExvZyhcbiAgY2xpZW50OiBSZXNlbmQsXG4gIHN1YmplY3Q6IHN0cmluZyxcbiAgdG86IHN0cmluZ1tdLFxuICBodG1sOiBzdHJpbmcsXG4gIHJlcGx5VG8/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBjbGllbnQuZW1haWxzLnNlbmQoe1xuICAgICAgZnJvbTogY29uZmlnLmVtYWlsX2Zyb20gfHwgXCJUcmlwVmVyc2UgPG9uYm9hcmRpbmdAcmVzZW5kLmRldj5cIixcbiAgICAgIHRvLFxuICAgICAgc3ViamVjdCxcbiAgICAgIGh0bWwsXG4gICAgICAuLi4ocmVwbHlUbyA/IHsgcmVwbHlUbyB9IDoge30pLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnN0IGRldGFpbCA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICBjb25zb2xlLndhcm4oYFtlbWFpbF0gc2VuZCBmYWlsZWQgKCR7c3ViamVjdH0pIHRvICR7dG8uam9pbihcIiwgXCIpfTogJHtkZXRhaWx9YCk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGVtYWlsTGF5b3V0ID0gKGNvbnRlbnQ6IHN0cmluZykgPT4gYFxuICA8ZGl2IHN0eWxlPVwiZm9udC1mYW1pbHk6IEFyaWFsLCBIZWx2ZXRpY2EsIHNhbnMtc2VyaWY7IG1heC13aWR0aDogNTYwcHg7IG1hcmdpbjogMCBhdXRvOyBjb2xvcjogIzFhMWExYTtcIj5cbiAgICA8ZGl2IHN0eWxlPVwiYmFja2dyb3VuZDogIzBmNzY2ZTsgcGFkZGluZzogMjRweDsgYm9yZGVyLXJhZGl1czogOHB4IDhweCAwIDA7XCI+XG4gICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAjZmZmZmZmOyBmb250LXNpemU6IDE4cHg7IGZvbnQtd2VpZ2h0OiBib2xkO1wiPlRyaXBWZXJzZTwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IHN0eWxlPVwiYm9yZGVyOiAxcHggc29saWQgI2U1ZTdlYjsgYm9yZGVyLXRvcDogbm9uZTsgcGFkZGluZzogMzJweDsgYm9yZGVyLXJhZGl1czogMCAwIDhweCA4cHg7XCI+XG4gICAgICAke2NvbnRlbnR9XG4gICAgPC9kaXY+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDEycHg7IGNvbG9yOiAjNmI3MjgwOyBtYXJnaW4tdG9wOiAxNnB4OyB0ZXh0LWFsaWduOiBjZW50ZXI7XCI+XG4gICAgICBZb3UgYXJlIHJlY2VpdmluZyB0aGlzIGVtYWlsIGJlY2F1c2Ugb2YgYWN0aXZpdHkgb24gVHJpcFZlcnNlLlxuICAgIDwvcD5cbiAgPC9kaXY+XG5gO1xuXG4vLyBOb3RpZmllcyB0aGUgc3VwcG9ydCBpbmJveCBhYm91dCBhIG5ldyBjb250YWN0IGZvcm0gc3VibWlzc2lvbi5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbiA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBjb250YWN0IG5vdGlmaWNhdGlvbi5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgY3JlYXRlZEF0ID0gZGV0YWlscy5jcmVhdGVkQXQ/LnRvSVNPU3RyaW5nKCkgPz8gXCJqdXN0IG5vd1wiO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPk5ldyBjb250YWN0IG1lc3NhZ2U8L2gyPlxuICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlOyBmb250LXNpemU6IDE0cHg7XCI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDsgd2lkdGg6IDEyMHB4O1wiPk5hbWU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+RW1haWw8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoZGV0YWlscy5lbWFpbCl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5TdWJqZWN0PC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5zdWJqZWN0KX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlJlY2VpdmVkPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGNyZWF0ZWRBdCl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgPC90YWJsZT5cbiAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDogMTZweDsgcGFkZGluZzogMTZweDsgYmFja2dyb3VuZDogI2Y5ZmFmYjsgYm9yZGVyLXJhZGl1czogNnB4OyB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XCI+XG4gICAgICAke2VzY2FwZUh0bWwoZGV0YWlscy5tZXNzYWdlKX1cbiAgICA8L2Rpdj5cbiAgYDtcblxuICBhd2FpdCBzZW5kV2l0aExvZyhcbiAgICBjbGllbnQsXG4gICAgYE5ldyBjb250YWN0IG1lc3NhZ2U6ICR7ZGV0YWlscy5zdWJqZWN0fWAsXG4gICAgW2NvbmZpZy5jb250YWN0X3JlY2VpdmVyX2VtYWlsXSxcbiAgICBlbWFpbExheW91dChjb250ZW50KSxcbiAgKTtcbn07XG5cbi8vIFNlbmRzIGEgY29uZmlybWF0aW9uIHJlcGx5IHRvIHRoZSBwZXJzb24gd2hvIHN1Ym1pdHRlZCB0aGUgZm9ybS5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdEF1dG9SZXBseSA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGNvbnRhY3QgYXV0by1yZXBseS5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgcmVjZWl2ZXJFbWFpbCA9IGNvbmZpZy5jb250YWN0X3JlY2VpdmVyX2VtYWlsO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPlRoYW5rcyBmb3IgcmVhY2hpbmcgb3V0LCAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0hPC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBXZSZhcG9zO3ZlIHJlY2VpdmVkIHlvdXIgbWVzc2FnZSBhYm91dFxuICAgICAgPHN0cm9uZz4mbGRxdW87JHtlc2NhcGVIdG1sKGRldGFpbHMuc3ViamVjdCl9JnJkcXVvOzwvc3Ryb25nPiBhbmQgb3VyIHN1cHBvcnRcbiAgICAgIHRlYW0gd2lsbCBnZXQgYmFjayB0byB5b3Ugd2l0aGluIG9uZSBidXNpbmVzcyBkYXkuXG4gICAgPC9wPlxuICBgO1xuXG4gIGF3YWl0IHNlbmRXaXRoTG9nKFxuICAgIGNsaWVudCxcbiAgICBcIldlIHJlY2VpdmVkIHlvdXIgbWVzc2FnZSAtIFRyaXBWZXJzZVwiLFxuICAgIFtkZXRhaWxzLmVtYWlsXSxcbiAgICBlbWFpbExheW91dChjb250ZW50KSxcbiAgICByZWNlaXZlckVtYWlsLFxuICApO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEJvb2tpbmcgZW1haWxzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGludGVyZmFjZSBJQm9va2luZ0VtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG4gIHRyYXZlbGVyczogbnVtYmVyO1xuICB0b3RhbFByaWNlOiBudW1iZXI7XG4gIHN0YXR1czogQm9va2luZ1N0YXR1cztcbn1cblxuLy8gSW5mb3JtcyB0aGUgY3VzdG9tZXIgYWJvdXQgYSBib29raW5nIGNyZWF0ZS9jb25maXJtL2NhbmNlbC5cbi8vIEJlc3QtZWZmb3J0IGxpa2UgdGhlIGNvbnRhY3QgZW1haWxzIFx1MjAxNCBhIGZhaWx1cmUgbXVzdCBuZXZlciBmYWlsIHRoZSByZXF1ZXN0LlxuZXhwb3J0IGNvbnN0IHNlbmRCb29raW5nRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElCb29raW5nRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhZGV0YWlscy5lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBib29raW5nIGVtYWlsLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB0cmF2ZWxEYXRlID0gZGV0YWlscy50cmF2ZWxEYXRlLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApO1xuXG4gIGNvbnN0IHN0YXR1c0NvcHk6IFJlY29yZDxcbiAgICBCb29raW5nU3RhdHVzLFxuICAgIHsgc3ViamVjdDogc3RyaW5nOyBoZWFkaW5nOiBzdHJpbmc7IGJvZHk6IHN0cmluZyB9XG4gID4gPSB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuUEVORElOR106IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyByZWNlaXZlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJCb29raW5nIHJlY2VpdmVkXCIsXG4gICAgICBib2R5OiBcIldlJ3ZlIHJlY2VpdmVkIHlvdXIgYm9va2luZyByZXF1ZXN0LiBUaGUgYWdlbnQgd2lsbCBjb25maXJtIGl0IHNob3J0bHkuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5QQUlEXToge1xuICAgICAgc3ViamVjdDogXCJQYXltZW50IHJlY2VpdmVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIlBheW1lbnQgcmVjZWl2ZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciBwYXltZW50IGhhcyBiZWVuIHJlY2VpdmVkLCBhbmQgdGhlIGFnZW50IHdpbGwgY29uZmlybSB5b3VyIGJvb2tpbmcgc2hvcnRseS5cIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyBjb25maXJtZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyBjb25maXJtZWRcIixcbiAgICAgIGJvZHk6IFwiR3JlYXQgbmV3cyBcdTIwMTQgeW91ciBib29raW5nIGhhcyBiZWVuIGNvbmZpcm1lZC4gV2UgbG9vayBmb3J3YXJkIHRvIGhvc3RpbmcgeW91IVwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXToge1xuICAgICAgc3ViamVjdDogXCJCb29raW5nIGNhbmNlbGxlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJCb29raW5nIGNhbmNlbGxlZFwiLFxuICAgICAgYm9keTogXCJZb3VyIGJvb2tpbmcgaGFzIGJlZW4gY2FuY2VsbGVkLiBJZiB0aGlzIHdhc24ndCBleHBlY3RlZCwgcGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNPTVBMRVRFRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiVHJpcCBjb21wbGV0ZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiVHJpcCBjb21wbGV0ZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciB0cmlwIGhhcyBiZWVuIG1hcmtlZCBhcyBjb21wbGV0ZWQuIFRoYW5rIHlvdSBmb3IgdHJhdmVsbGluZyB3aXRoIFRyaXBWZXJzZSFcIixcbiAgICB9LFxuICB9O1xuXG4gIGNvbnN0IGNvcHkgPSBzdGF0dXNDb3B5W2RldGFpbHMuc3RhdHVzXTtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj4ke2NvcHkuaGVhZGluZ308L2gyPlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxNHB4OyBsaW5lLWhlaWdodDogMS42OyBjb2xvcjogIzM3NDE1MTtcIj5cbiAgICAgIEhpICR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfSw8YnIvPlxuICAgICAgJHtjb3B5LmJvZHl9XG4gICAgPC9wPlxuICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlOyBmb250LXNpemU6IDE0cHg7XCI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDsgd2lkdGg6IDEyMHB4O1wiPlBhY2thZ2U8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLnBhY2thZ2VUaXRsZSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWwgZGF0ZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbCh0cmF2ZWxEYXRlKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRyYXZlbGVyczwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChTdHJpbmcoZGV0YWlscy50cmF2ZWxlcnMpKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRvdGFsPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4mIzI1NDc7JHtlc2NhcGVIdG1sKGRldGFpbHMudG90YWxQcmljZS50b0ZpeGVkKDIpKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICA8L3RhYmxlPlxuICBgO1xuXG4gIGF3YWl0IHNlbmRXaXRoTG9nKFxuICAgIGNsaWVudCxcbiAgICBjb3B5LnN1YmplY3QsXG4gICAgW2RldGFpbHMuZW1haWxdLFxuICAgIGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICApO1xufTtcblxuLy8gSW5mb3JtcyB0aGUgY3VzdG9tZXIgdGhhdCBhIHBhaWQgYm9va2luZyB3YXMgY2FuY2VsbGVkIGFuZCB0aGUgcGF5bWVudCBoYXNcbi8vIGJlZW4gcmVmdW5kZWQuIEJlc3QtZWZmb3J0IGxpa2UgdGhlIG90aGVyIGVtYWlscy5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlZnVuZEVtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG4gIGFtb3VudDogbnVtYmVyO1xuICByZWZ1bmRSZWZJZD86IHN0cmluZyB8IG51bGw7XG59XG5cbmV4cG9ydCBjb25zdCBzZW5kUmVmdW5kRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElSZWZ1bmRFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIHJlZnVuZCBlbWFpbC5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgdHJhdmVsRGF0ZSA9IGRldGFpbHMudHJhdmVsRGF0ZS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKTtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5SZWZ1bmQgaXNzdWVkPC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBIaSAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0sPGJyLz5cbiAgICAgIFlvdXIgYm9va2luZyB3YXMgY2FuY2VsbGVkLCBhbmQgPHN0cm9uZz4mIzI1NDc7JHtlc2NhcGVIdG1sKFxuICAgICAgICBkZXRhaWxzLmFtb3VudC50b0ZpeGVkKDIpLFxuICAgICAgKX08L3N0cm9uZz4gaGFzIGJlZW4gcmVmdW5kZWQgdG8geW91ciBvcmlnaW5hbCBwYXltZW50IG1ldGhvZC4gUGxlYXNlIGFsbG93XG4gICAgICA1LTEwIGJ1c2luZXNzIGRheXMgZm9yIHRoZSBtb25leSB0byBhcHBlYXIuXG4gICAgPC9wPlxuICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlOyBmb250LXNpemU6IDE0cHg7XCI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDsgd2lkdGg6IDEyMHB4O1wiPlBhY2thZ2U8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLnBhY2thZ2VUaXRsZSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWwgZGF0ZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbCh0cmF2ZWxEYXRlKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlJlZnVuZGVkIGFtb3VudDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChkZXRhaWxzLmFtb3VudC50b0ZpeGVkKDIpKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgICR7ZGV0YWlscy5yZWZ1bmRSZWZJZFxuICAgICAgICA/IGBcbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlJlZnVuZCByZWZlcmVuY2U8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoZGV0YWlscy5yZWZ1bmRSZWZJZCl9PC90ZD5cbiAgICAgIDwvdHI+YFxuICAgICAgICA6IFwiXCJ9XG4gICAgPC90YWJsZT5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTNweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICM2YjcyODA7IG1hcmdpbi10b3A6IDE2cHg7XCI+XG4gICAgICBJZiB5b3UgaGF2ZSBhbnkgcXVlc3Rpb25zIGFib3V0IHRoaXMgcmVmdW5kLCBwbGVhc2UgY29udGFjdCBzdXBwb3J0LlxuICAgIDwvcD5cbiAgYDtcblxuICBhd2FpdCBzZW5kV2l0aExvZyhcbiAgICBjbGllbnQsXG4gICAgXCJCb29raW5nIGNhbmNlbGxlZCAmIHJlZnVuZCBpc3N1ZWQgLSBUcmlwVmVyc2VcIixcbiAgICBbZGV0YWlscy5lbWFpbF0sXG4gICAgZW1haWxMYXlvdXQoY29udGVudCksXG4gICk7XG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQge1xuICBzZW5kQ29udGFjdEF1dG9SZXBseSxcbiAgc2VuZENvbnRhY3ROb3RpZmljYXRpb24sXG59IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgSUNvbnRhY3RRdWVyeSwgSUNyZWF0ZUNvbnRhY3RQYXlsb2FkIH0gZnJvbSBcIi4vY29udGFjdC5pbnRlcmZhY2VcIjtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSAocHVibGljKVxuY29uc3QgY3JlYXRlTWVzc2FnZSA9IGFzeW5jIChwYXlsb2FkOiBJQ3JlYXRlQ29udGFjdFBheWxvYWQpID0+IHtcbiAgY29uc3QgY3JlYXRlZE1lc3NhZ2UgPSBhd2FpdCBwcmlzbWEuY29udGFjdE1lc3NhZ2UuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICBuYW1lOiBwYXlsb2FkLm5hbWUsXG4gICAgICBlbWFpbDogcGF5bG9hZC5lbWFpbCxcbiAgICAgIHN1YmplY3Q6IHBheWxvYWQuc3ViamVjdCxcbiAgICAgIG1lc3NhZ2U6IHBheWxvYWQubWVzc2FnZSxcbiAgICB9LFxuICB9KTtcblxuICAvLyBFbWFpbHMgYXJlIGJlc3QtZWZmb3J0OiBhIGZhaWx1cmUgaGVyZSBtdXN0IG5ldmVyIGZhaWwgdGhlIHN1Ym1pc3Npb25cbiAgLy8gKHRoZSBtZXNzYWdlIGlzIGFscmVhZHkgc2F2ZWQgdG8gdGhlIGluYm94KS5cbiAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbih7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgICBzZW5kQ29udGFjdEF1dG9SZXBseSh7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIGNyZWF0ZWRNZXNzYWdlO1xufTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIChhZG1pbiBvbmx5LCBwYWdpbmF0ZWQsIGZpbHRlcmFibGUgYnkgaXNSZXNvbHZlZClcbmNvbnN0IGxpc3RNZXNzYWdlcyA9IGFzeW5jIChxdWVyeTogSUNvbnRhY3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VXaGVyZUlucHV0IHwgdW5kZWZpbmVkID1cbiAgICBxdWVyeS5pc1Jlc29sdmVkID09PSB1bmRlZmluZWRcbiAgICAgID8gdW5kZWZpbmVkXG4gICAgICA6IHsgaXNSZXNvbHZlZDogcXVlcnkuaXNSZXNvbHZlZCB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gMy4gTWFyayBhIGNvbnRhY3QgbWVzc2FnZSByZXNvbHZlZC91bnJlc29sdmVkIChhZG1pbiBvbmx5KVxuY29uc3QgcmVzb2x2ZU1lc3NhZ2UgPSBhc3luYyAoaWQ6IHN0cmluZywgaXNSZXNvbHZlZDogYm9vbGVhbikgPT4ge1xuICByZXR1cm4gcHJpc21hLmNvbnRhY3RNZXNzYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IGlzUmVzb2x2ZWQgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgY29udGFjdFNlcnZpY2UgPSB7XG4gIGNyZWF0ZU1lc3NhZ2UsXG4gIGxpc3RNZXNzYWdlcyxcbiAgcmVzb2x2ZU1lc3NhZ2UsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVNZXNzYWdlU2NoZW1hID0gei5vYmplY3Qoe1xuICBuYW1lOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAubWluKDIsIFwiTmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpLFxuICBlbWFpbDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFbWFpbCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5lbWFpbChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWwgYWRkcmVzc1wiKSxcbiAgc3ViamVjdDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJTdWJqZWN0IGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIlN1YmplY3QgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDIwMCwgXCJTdWJqZWN0IG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKSxcbiAgbWVzc2FnZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJNZXNzYWdlIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigxMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbGVhc3QgMTAgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMjAwMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbW9zdCAyMDAwIGNoYXJhY3RlcnNcIiksXG59KS5zdHJpY3QoKTtcblxuY29uc3QgY29udGFjdFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBpc1Jlc29sdmVkOiB6XG4gICAgLmVudW0oW1widHJ1ZVwiLCBcImZhbHNlXCJdKVxuICAgIC5vcHRpb25hbCgpXG4gICAgLnRyYW5zZm9ybSgodmFsKSA9PiAodmFsID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiB2YWwgPT09IFwidHJ1ZVwiKSksXG59KTtcblxuY29uc3QgY29udGFjdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTWVzc2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVSZXNvbHZlZFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgaXNSZXNvbHZlZDogei5ib29sZWFuKHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcImlzUmVzb2x2ZWQgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJpc1Jlc29sdmVkIG11c3QgYmUgYSBib29sZWFuXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiB0eXBlb2YgZGF0YS5pc1Jlc29sdmVkID09PSBcImJvb2xlYW5cIiwge1xuICAgIG1lc3NhZ2U6IFwiaXNSZXNvbHZlZCBtdXN0IGJlIGEgYm9vbGVhblwiLFxuICB9KTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlTWVzc2FnZVNjaGVtYSxcbiAgY29udGFjdFF1ZXJ5U2NoZW1hLFxuICBjb250YWN0UGFyYW1zU2NoZW1hLFxuICB1cGRhdGVSZXNvbHZlZFNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBib29raW5nQ29udHJvbGxlciB9IGZyb20gXCIuL2Jvb2tpbmcuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYm9va2luZ1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYm9va2luZy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBDcmVhdGUgYm9va2luZyAoY3VzdG9tZXIgb25seSBcdTIwMTQgYWdlbnRzIHNlbGwsIGFkbWlucyBtYW5hZ2UpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYm9va2luZ1ZhbGlkYXRpb25zLmNyZWF0ZVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuY3JlYXRlQm9va2luZyxcbik7XG5cbi8vIE15IGJvb2tpbmdzIFx1MjAxNCBvd24gYm9va2luZ3Mgd2l0aCBmaWx0ZXJzICsgcGFnaW5hdGlvbiAob3duZXIgaXMgYWx3YXlzIFVTRVIpXG4vLyBOT1RFOiByZWdpc3RlcmVkIGJlZm9yZSBcIi86aWRcIiBzbyB0aGUgcGFyYW0gcm91dGUgZG9lc24ndCBzd2FsbG93IGl0Llxucm91dGVyLmdldChcbiAgXCIvbXktYm9va2luZ3NcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0TXlCb29raW5ncyxcbik7XG5cbi8vIEFnZW50IGJvb2tpbmdzIFx1MjAxNCBzY29wZWQgdG8gcGFja2FnZXMgdGhlIGFnZW50IG93bnNcbnJvdXRlci5nZXQoXG4gIFwiL2FnZW50LWJvb2tpbmdzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBZ2VudEJvb2tpbmdzLFxuKTtcblxuLy8gQm9va2luZyBkZXRhaWwgXHUyMDE0IG93bmVyIC8gcGFja2FnZSBhZ2VudCAvIGFkbWluXG5yb3V0ZXIuZ2V0KFxuICBcIi86aWRcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRCb29raW5nRGV0YWlsLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IGFsbCBib29raW5nc1xucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBbGxCb29raW5ncyxcbik7XG5cbi8vIFN0YXR1cyB0cmFuc2l0aW9uIFx1MjAxNCB2YWxpZGF0ZWQgYWdhaW5zdCB0aGUgc3RhdGUgbWFjaGluZSBpbiB0aGUgc2VydmljZVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJvb2tpbmdWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBib29raW5nQ29udHJvbGxlci51cGRhdGVCb29raW5nU3RhdHVzLFxuKTtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBib29raW5nU2VydmljZSB9IGZyb20gXCIuL2Jvb2tpbmcuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbmNvbnN0IGNyZWF0ZUJvb2tpbmcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmNyZWF0ZUJvb2tpbmcodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJCb29raW5nIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldE15Qm9va2luZ3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0TXlCb29raW5ncyh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRBZ2VudEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEFnZW50Qm9va2luZ3ModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0Qm9va2luZ0RldGFpbCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEJvb2tpbmdEZXRhaWwoaWQsIHJlcS51c2VyISk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldEFsbEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0QWxsQm9va2luZ3MocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IHVwZGF0ZUJvb2tpbmdTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS51cGRhdGVCb29raW5nU3RhdHVzKFxuICAgICAgaWQsXG4gICAgICByZXEuYm9keSxcbiAgICAgIHJlcS51c2VyISxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmcgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBib29raW5nQ29udHJvbGxlciA9IHtcbiAgY3JlYXRlQm9va2luZyxcbiAgZ2V0TXlCb29raW5ncyxcbiAgZ2V0QWdlbnRCb29raW5ncyxcbiAgZ2V0Qm9va2luZ0RldGFpbCxcbiAgZ2V0QWxsQm9va2luZ3MsXG4gIHVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59OyIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5cbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZy9pbmRleFwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuLy8gUGF5bWVudCBpcyBhbiBvcHRpb25hbCBmZWF0dXJlOiB0aGUgQVBJIG11c3QgYm9vdCBhbmQgc2VydmUgZXZlcnl0aGluZyBlbHNlXG4vLyBldmVuIHdoZW4gdGhlIFNTTENvbW1lcnogc3RvcmUgaXNuJ3QgY29uZmlndXJlZCB5ZXQuIFRoZXNlIHRocm93IGEgY2xlYW4gNDAwXG4vLyBvbiB0aGUgcGF5bWVudC1vbmx5IHBhdGhzIHJhdGhlciB0aGFuIGNyYXNoIHRoZSB3aG9sZSBkZXBsb3ltZW50IGF0IGJvb3QuXG5jb25zdCByZXF1aXJlQ29uZmlnID0gKCkgPT4ge1xuICBpZiAoIWNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9pZCB8fCAhY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJTU0xDb21tZXJ6IGlzIG5vdCBjb25maWd1cmVkLiBTZXQgU1NMX0NPTU1FUlpfU1RPUkVfSUQgYW5kIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELlwiLFxuICAgICk7XG4gIH1cbiAgaWYgKCFjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJTU0xDb21tZXJ6IGlzIG5vdCBjb25maWd1cmVkLiBTZXQgQkFDS0VORF9QVUJMSUNfVVJMIHRvIHRoZSBwdWJsaWNseSByZWFjaGFibGUgYmFja2VuZCBVUkwuXCIsXG4gICAgKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHN0b3JlSWQ6IGNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9pZCxcbiAgICBzdG9yZVBhc3N3b3JkOiBjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfcGFzc3dvcmQsXG4gIH07XG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpJbml0UmVzdWx0IHtcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGZhaWxlZHJlYXNvbj86IHN0cmluZztcbiAgc2Vzc2lvbmtleT86IHN0cmluZztcbiAgR2F0ZXdheVBhZ2VVUkw/OiBzdHJpbmc7XG4gIFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCB7XG4gIHN0YXR1czogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbiAgdmFsX2lkPzogc3RyaW5nO1xuICBhbW91bnQ/OiBzdHJpbmc7XG4gIGN1cnJlbmN5Pzogc3RyaW5nO1xuICBiYW5rX3RyYW5faWQ/OiBzdHJpbmc7XG4gIGNhcmRfdHlwZT86IHN0cmluZztcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQge1xuICBBUElDb25uZWN0Pzogc3RyaW5nO1xuICBzdGF0dXM/OiBzdHJpbmc7IC8vIHN1Y2Nlc3MgfCBmYWlsZWQgfCBwcm9jZXNzaW5nXG4gIGVycm9yUmVhc29uPzogc3RyaW5nO1xuICByZWZ1bmRfcmVmX2lkPzogc3RyaW5nO1xuICBiYW5rX3RyYW5faWQ/OiBzdHJpbmc7XG4gIHRyYW5zX2lkPzogc3RyaW5nO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbi8vIFNTTENvbW1lcnogdHJ1bmNhdGVzIHRyYW5faWQgdG8gMzAgY2hhcnMgXHUyMDE0IGRhdGUgKyB0aW1lICsgcmFuZG9tIHNhbHQgc3RheXMgc2FmZWx5IHVuZGVyLlxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlVHJhbklkKCk6IHN0cmluZyB7XG4gIHJldHVybiBgVFJOWF9JRC0ke0RhdGUubm93KCl9LSR7cmFuZG9tVVVJRCgpLnJlcGxhY2UoLy0vZywgXCJcIikuc2xpY2UoMCwgOCl9YDtcbn1cblxuLy8gSW5pdGlhdGVzIGEgZ2F0ZXdheSBzZXNzaW9uLiBTZXJ2ZXItdG8tc2VydmVyIFBPU1QsIGZvcm0tZW5jb2RlZC4gVGhlIGdhdGV3YXlcbi8vIHJlc3BvbmRzIHdpdGggdGhlIGhvc3RlZCBjaGVja291dCBVUkwgKEdhdGV3YXlQYWdlVVJMKSB0aGUgY3VzdG9tZXIgaXMgc2VudCB0by5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6SW5pdChvcHRpb25zOiB7XG4gIHRvdGFsX2Ftb3VudDogbnVtYmVyO1xuICB0cmFuX2lkOiBzdHJpbmc7XG4gIHN1Y2Nlc3NfdXJsOiBzdHJpbmc7XG4gIGZhaWxfdXJsOiBzdHJpbmc7XG4gIGNhbmNlbF91cmw6IHN0cmluZztcbiAgaXBuX3VybDogc3RyaW5nO1xuICBjdXNfbmFtZTogc3RyaW5nO1xuICBjdXNfZW1haWw6IHN0cmluZztcbiAgY3VzX3Bob25lOiBzdHJpbmc7XG59KTogUHJvbWlzZTxTc2xjb21tZXJ6SW5pdFJlc3VsdD4ge1xuICBjb25zdCB7IHN0b3JlSWQsIHN0b3JlUGFzc3dvcmQgfSA9IHJlcXVpcmVDb25maWcoKTtcbiAgY29uc3QgYm9keSA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICB0b3RhbF9hbW91bnQ6IG9wdGlvbnMudG90YWxfYW1vdW50LnRvRml4ZWQoMiksXG4gICAgY3VycmVuY3k6IFwiQkRUXCIsXG4gICAgdHJhbl9pZDogb3B0aW9ucy50cmFuX2lkLFxuICAgIHN1Y2Nlc3NfdXJsOiBvcHRpb25zLnN1Y2Nlc3NfdXJsLFxuICAgIGZhaWxfdXJsOiBvcHRpb25zLmZhaWxfdXJsLFxuICAgIGNhbmNlbF91cmw6IG9wdGlvbnMuY2FuY2VsX3VybCxcbiAgICBpcG5fdXJsOiBvcHRpb25zLmlwbl91cmwsXG4gICAgY3VzX25hbWU6IG9wdGlvbnMuY3VzX25hbWUsXG4gICAgY3VzX2VtYWlsOiBvcHRpb25zLmN1c19lbWFpbCxcbiAgICBjdXNfYWRkMTogXCJOL0FcIixcbiAgICBjdXNfYWRkMjogXCJOL0FcIixcbiAgICBjdXNfY2l0eTogXCJOL0FcIixcbiAgICBjdXNfc3RhdGU6IFwiTi9BXCIsXG4gICAgY3VzX3Bvc3Rjb2RlOiBcIjEwMDBcIixcbiAgICBjdXNfY291bnRyeTogXCJCYW5nbGFkZXNoXCIsXG4gICAgY3VzX3Bob25lOiBvcHRpb25zLmN1c19waG9uZSxcbiAgICBwcm9kdWN0X25hbWU6IFwiVHJpcFZlcnNlIFRvdXIgQm9va2luZ1wiLFxuICAgIHNoaXBwaW5nX21ldGhvZDogXCJOT1wiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChjb25maWcuc3NsY29tbWVyel9pbml0X3VybCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIH0sXG4gICAgYm9keTogYm9keS50b1N0cmluZygpLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IGluaXQgZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IGluaXQgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuXG4gIC8vIFRoZSBnYXRld2F5IHJlcG9ydHMgc3RhdHVzIGluIFVQUEVSQ0FTRSAoXCJTVUNDRVNTXCIgLyBcIkZBSUxFRFwiKTsgYW55IG90aGVyXG4gIC8vIHN0YXR1cywgb3IgYSBzdWNjZXNzIHdpdGhvdXQgdGhlIGhvc3RlZCBjaGVja291dCBVUkwsIGlzIGEgZmFpbGVkIGluaXQuXG4gIGlmIChkYXRhLnN0YXR1cyAhPT0gXCJTVUNDRVNTXCIgfHwgIWRhdGEuR2F0ZXdheVBhZ2VVUkwpIHtcbiAgICBjb25zdCByZWFzb24gPSBkYXRhLmZhaWxlZHJlYXNvbiB8fCBkYXRhLnN0YXR1cyB8fCBcInVua25vd25cIjtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtzc2xjb21tZXJ6XSBpbml0IHJlamVjdGVkICh1cmw9JHtjb25maWcuc3NsY29tbWVyel9pbml0X3VybH0sIHNhbmRib3g9JHtjb25maWcuc3NsX2NvbW1lcnpfc2FuZGJveH0pOiAke3JlYXNvbn1gLFxuICAgICAgZGF0YSxcbiAgICApO1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDUwMixcbiAgICAgIGBTU0xDb21tZXJ6IGluaXQgcmVqZWN0ZWQ6ICR7cmVhc29ufS4gQ2hlY2sgU1NMX0NPTU1FUlpfU1RPUkVfSUQsIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELCBTU0xfQ09NTUVSWl9TQU5EQk9YIGFuZCBTU0xDT01NRVJaX0lOSVRfVVJMIChzZWUgc2VydmVyIGxvZ3MpLmAsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn1cblxuLy8gU2VydmVyLXNpZGUgdmVyaWZpY2F0aW9uIG9mIGEgY29tcGxldGVkIHRyYW5zYWN0aW9uLiBzdGF0dXM6IFZBTElEIC8gVkFMSURBVEVEIC9cbi8vIElOVkFMSURfVFJBTlNBQ1RJT04gLyBGQUlMRUQuIFZBTElEQVRFRCBtZWFucyB0aGUgdHJhbnNhY3Rpb24gd2FzIHZlcmlmaWVkIGJlZm9yZVxuLy8gKGlkZW1wb3RlbnQpLCBJTlZBTElEX1RSQU5TQUNUSU9OIG1lYW5zIHRoZSBhbW91bnQvdHJhbnNhY3Rpb24gbWlzbWF0Y2hlcy5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6VmFsaWRhdGUob3B0aW9uczoge1xuICB2YWxfaWQ6IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0PiB7XG4gIGNvbnN0IHsgc3RvcmVJZCwgc3RvcmVQYXNzd29yZCB9ID0gcmVxdWlyZUNvbmZpZygpO1xuICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICB2YWxfaWQ6IG9wdGlvbnMudmFsX2lkLFxuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICBmb3JtYXQ6IFwianNvblwiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHtjb25maWcuc3NsY29tbWVyel92YWxpZGF0ZV91cmx9PyR7cGFyYW1zLnRvU3RyaW5nKCl9YCwge1xuICAgIG1ldGhvZDogXCJHRVRcIixcbiAgfSk7XG5cbiAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBgU1NMQ29tbWVyeiB2YWxpZGF0aW9uIGZhaWxlZCAoJHtyZXMuc3RhdHVzfSlgKTtcblxuICBsZXQgZGF0YTogU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ7XG4gIHRyeSB7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UodGV4dCkgYXMgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIFwiU1NMQ29tbWVyeiB2YWxpZGF0aW9uIHJldHVybmVkIGEgbm9uLUpTT04gcmVzcG9uc2VcIik7XG4gIH1cbiAgcmV0dXJuIGRhdGE7XG59XG5cbi8vIEluaXRpYXRlcyBhIHJlZnVuZCBhZ2FpbnN0IGEgc2V0dGxlZCB0cmFuc2FjdGlvbi4gYmFua190cmFuX2lkIGlzIHRoZVxuLy8gb3JpZ2luYWwgdHJhbnNhY3Rpb24ncyBiYW5rIHRyYW5zYWN0aW9uIElEIGNhcHR1cmVkIGF0IHBheW1lbnQgdGltZS5cbi8vIHN0YXR1czogc3VjY2VzcyAoaW5pdGlhdGVkKSB8IGZhaWxlZCB8IHByb2Nlc3NpbmcgKGFscmVhZHkgaW5pdGlhdGVkKS5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6UmVmdW5kKG9wdGlvbnM6IHtcbiAgYmFua190cmFuX2lkOiBzdHJpbmc7XG4gIHJlZnVuZF9hbW91bnQ6IG51bWJlcjtcbiAgcmVmdW5kX3JlbWFya3M6IHN0cmluZztcbiAgcmVmZV9pZD86IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ+IHtcbiAgY29uc3QgeyBzdG9yZUlkLCBzdG9yZVBhc3N3b3JkIH0gPSByZXF1aXJlQ29uZmlnKCk7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIGJhbmtfdHJhbl9pZDogb3B0aW9ucy5iYW5rX3RyYW5faWQsXG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIHJlZnVuZF9hbW91bnQ6IG9wdGlvbnMucmVmdW5kX2Ftb3VudC50b0ZpeGVkKDIpLFxuICAgIHJlZnVuZF9yZW1hcmtzOiBvcHRpb25zLnJlZnVuZF9yZW1hcmtzLFxuICAgIGZvcm1hdDogXCJqc29uXCIsXG4gICAgdjogXCIxXCIsXG4gIH0pO1xuICBpZiAob3B0aW9ucy5yZWZlX2lkKSBwYXJhbXMuc2V0KFwicmVmZV9pZFwiLCBvcHRpb25zLnJlZmVfaWQpO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2NvbmZpZy5zc2xjb21tZXJ6X3JlZnVuZF91cmx9PyR7cGFyYW1zLnRvU3RyaW5nKCl9YCwge1xuICAgIG1ldGhvZDogXCJHRVRcIixcbiAgfSk7XG5cbiAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBgU1NMQ29tbWVyeiByZWZ1bmQgZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6UmVmdW5kUmVzdWx0O1xuICB0cnkge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKHRleHQpIGFzIFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIFwiU1NMQ29tbWVyeiByZWZ1bmQgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn0iLCAiaW1wb3J0IHsgTm90aWZpY2F0aW9uVHlwZSB9IGZyb20gXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vbGliL3ByaXNtYVwiO1xuXG4vLyBCZXN0LWVmZm9ydCBpbi1hcHAgbm90aWZpY2F0aW9uIFx1MjAxNCBtaXJyb3JzIHRoZSBlbWFpbCBoZWxwZXJzLiBBIGZhaWx1cmUgaXNcbi8vIGxvZ2dlZCBhbmQgc3dhbGxvd2VkLCBuZXZlciB0aHJvd24sIHNvIGEgbm90aWZpY2F0aW9uIGluc2VydCBjYW4ndCBmYWlsIHRoZVxuLy8gYnVzaW5lc3Mgd3JpdGUgdGhhdCBjYXVzZWQgaXQuIENhbGwgc2l0ZXMgZmlyZSBpdCBhc1xuLy8gYHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtub3RpZnkoLi4uKV0pYC5cbmV4cG9ydCBjb25zdCBub3RpZnkgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICB0eXBlOiBOb3RpZmljYXRpb25UeXBlLFxuICB0aXRsZTogc3RyaW5nLFxuICBtZXNzYWdlOiBzdHJpbmcsXG4gIGxpbms/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBwcmlzbWEubm90aWZpY2F0aW9uLmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7IHVzZXJJZCwgdHlwZSwgdGl0bGUsIG1lc3NhZ2UsIGxpbmsgfSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtub3RpZmljYXRpb25dIGZhaWxlZCB0byBjcmVhdGUgJHt0eXBlfSBmb3IgdXNlciAke3VzZXJJZH06ICR7XG4gICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKVxuICAgICAgfWAsXG4gICAgKTtcbiAgfVxufTsiLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzLCBOb3RpZmljYXRpb25UeXBlLCBQYWNrYWdlU3RhdHVzLCBQYXltZW50U3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc3NsY29tbWVyelJlZnVuZCB9IGZyb20gXCIuLi8uLi9saWIvc3NsY29tbWVyelwiO1xuaW1wb3J0IHsgc2VuZEJvb2tpbmdFbWFpbCwgc2VuZFJlZnVuZEVtYWlsIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQgeyBub3RpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvbm90aWZpY2F0aW9uXCI7XG5pbXBvcnQge1xuICBJQm9va2luZ1F1ZXJ5LFxuICBJQm9va2luZ1NlYXJjaFF1ZXJ5LFxuICBJQ3JlYXRlQm9va2luZyxcbiAgSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59IGZyb20gXCIuL2Jvb2tpbmcuaW50ZXJmYWNlXCI7XG5cbi8vIEEgUEVORElORyBib29raW5nIG9sZGVyIHRoYW4gdGhpcyBpcyB0cmVhdGVkIGFzIGFuIGFiYW5kb25lZCBjaGVja291dDpcbi8vIGl0J3MgYXV0by1jYW5jZWxsZWQgc28gdGhlIHVzZXIgY2FuIHJlYm9vayB0aGUgc2FtZSBwYWNrYWdlK2RhdGUuXG5jb25zdCBTVEFMRV9CT09LSU5HX0hPVVJTID0gMjQ7XG5cbmNvbnN0IHRvVVRDTWlkbmlnaHQgPSAoZGF0ZTogRGF0ZSkgPT5cbiAgbmV3IERhdGUoXG4gICAgRGF0ZS5VVEMoZGF0ZS5nZXRVVENGdWxsWWVhcigpLCBkYXRlLmdldFVUQ01vbnRoKCksIGRhdGUuZ2V0VVRDRGF0ZSgpKSxcbiAgKTtcblxuLy8gXHUyNTAwXHUyNTAwIEFjdG9yICsgb3duZXJzaGlwIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxudHlwZSBCb29raW5nQWN0b3IgPSB7IGlkOiBzdHJpbmc7IHJvbGU6IFJvbGUgfTtcblxuLy8gU3RydWN0dXJhbCBzdWJzZXQgXHUyMDE0IG9ubHkgd2hhdCB0aGUgb3duZXJzaGlwIGNoZWNrcyBuZWVkLlxudHlwZSBCb29raW5nT3duZXJJbmZvID0ge1xuICB1c2VySWQ6IHN0cmluZztcbiAgcGFja2FnZTogeyBhZ2VudElkOiBzdHJpbmcgfTtcbn07XG5cbi8vIEJvb2tpbmcgb3duZXIsIHRoZSBBR0VOVCB3aG8gb3ducyB0aGUgcGFja2FnZSwgb3IgQURNSU4gXHUyMDE0IGZ1bGwgbWFuYWdlIHNjb3BlLlxuY29uc3QgY2FuTWFuYWdlID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGJvb2tpbmcudXNlcklkID09PSBhY3Rvci5pZCB8fFxuICAoYWN0b3Iucm9sZSA9PT0gUm9sZS5BR0VOVCAmJiBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWQpIHx8XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU47XG5cbi8vIE9ubHkgdGhlIHBhY2thZ2Utb3duaW5nIEFHRU5UIG9yIEFETUlOIGNhbiBtb3ZlIGEgYm9va2luZydzIG1vbmV5IHN0YXR1c1xuLy8gKFBFTkRJTkdcdTIxOTJDT05GSVJNRUQsIENPTkZJUk1FRFx1MjE5MkNPTVBMRVRFRCwgQ09ORklSTUVEXHUyMTkyUEVORElORykuXG5jb25zdCBpc0FnZW50T3duZXJPckFkbWluID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU4gfHxcbiAgKGFjdG9yLnJvbGUgPT09IFJvbGUuQUdFTlQgJiYgYm9va2luZy5wYWNrYWdlLmFnZW50SWQgPT09IGFjdG9yLmlkKTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXRlIG1hY2hpbmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG50eXBlIFRyYW5zaXRpb25SdWxlID0ge1xuICBhbGxvd2VkOiAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT4gYm9vbGVhbjtcbiAgcmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkPzogYm9vbGVhbjtcbiAgYmVmb3JlVHJhdmVsRGF0ZT86IGJvb2xlYW47XG59O1xuXG5jb25zdCBUUkFOU0lUSU9OUzogUGFydGlhbDxcbiAgUmVjb3JkPEJvb2tpbmdTdGF0dXMsIFBhcnRpYWw8UmVjb3JkPEJvb2tpbmdTdGF0dXMsIFRyYW5zaXRpb25SdWxlPj4+XG4+ID0ge1xuICBbQm9va2luZ1N0YXR1cy5QRU5ESU5HXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHsgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbiB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHsgYWxsb3dlZDogY2FuTWFuYWdlIH0sXG4gIH0sXG4gIFtCb29raW5nU3RhdHVzLlBBSURdOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXTogeyBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXTogeyBhbGxvd2VkOiBjYW5NYW5hZ2UgfSxcbiAgfSxcbiAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTVBMRVRFRF06IHtcbiAgICAgIGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4sXG4gICAgICByZXF1aXJlc1RyYXZlbERhdGVQYXNzZWQ6IHRydWUsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7IGFsbG93ZWQ6IGNhbk1hbmFnZSB9LFxuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluLFxuICAgICAgYmVmb3JlVHJhdmVsRGF0ZTogdHJ1ZSxcbiAgICB9LFxuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlc3BvbnNlIG1hcHBpbmcgKERlY2ltYWwgXHUyMTkyIE51bWJlcikgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBib29raW5nUGFja2FnZVNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdGl0bGU6IHRydWUsXG4gICAgc2x1ZzogdHJ1ZSxcbiAgICBsb2NhdGlvbjogdHJ1ZSxcbiAgICBpbWFnZXM6IHRydWUsXG4gICAgcHJpY2U6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG4vLyBEZXRhaWwgdmlldyBhZGRzIGFnZW50SWQgKG5lZWRlZCBieSBvd25lcnNoaXAgY2hlY2tzIGluIHRoZSBzZXJ2aWNlKS5cbmNvbnN0IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0aXRsZTogdHJ1ZSxcbiAgICBzbHVnOiB0cnVlLFxuICAgIGxvY2F0aW9uOiB0cnVlLFxuICAgIGltYWdlczogdHJ1ZSxcbiAgICBwcmljZTogdHJ1ZSxcbiAgICBhZ2VudElkOiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxuY29uc3QgYm9va2luZ1VzZXJTZWxlY3QgPSB7XG4gIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnQgbGVkZ2VyIHNob3duIG9uIHRoZSBib29raW5nIGRldGFpbCBwYWdlIChhbW91bnRzIHN0YXkgRGVjaW1hbCBpbiBEQikuXG5jb25zdCBib29raW5nUGF5bWVudFNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdHJhbklkOiB0cnVlLFxuICAgIGFtb3VudDogdHJ1ZSxcbiAgICBjdXJyZW5jeTogdHJ1ZSxcbiAgICBzdGF0dXM6IHRydWUsXG4gICAgY2FyZFR5cGU6IHRydWUsXG4gICAgYmFua1RyYW5JZDogdHJ1ZSxcbiAgICB2YWxJZDogdHJ1ZSxcbiAgICBwYWlkQXQ6IHRydWUsXG4gICAgcmVmdW5kUmVmSWQ6IHRydWUsXG4gICAgcmVmdW5kZWRBdDogdHJ1ZSxcbiAgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnRzIG9yZGVyZWQgbmV3ZXN0LWZpcnN0IHNvIGNvbnN1bWVycyBjYW4gcmVseSBvbiBwYXltZW50c1swXSBiZWluZyB0aGVcbi8vIGxhdGVzdCBhdHRlbXB0ICh1c2VkIGZvciB0aGUgdXNlciBwYXltZW50LWhpc3RvcnkgXCJsYXRlc3Qgc3RhdHVzXCIgcm93KS5cbmNvbnN0IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgPSB7XG4gIC4uLmJvb2tpbmdQYXltZW50U2VsZWN0LFxuICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgYXMgY29uc3QgfSxcbn0gYXMgY29uc3Q7XG5cbnR5cGUgQm9va2luZ1dpdFBhY2thZ2UgPSBQcmlzbWEuQm9va2luZ0dldFBheWxvYWQ8e1xuICBpbmNsdWRlOiB7IHBhY2thZ2U6IHR5cGVvZiBib29raW5nUGFja2FnZVNlbGVjdCB9O1xufT47XG5cbi8vIFBheW1lbnRzIHNob3cgb24gbGlzdCByb3dzIHRvbyAoRG9EOiBcImxpc3QvZGV0YWlsIG5vdyBpbmNsdWRlcyBwYXltZW50c1wiKSxcbi8vIG1hcHBlZCB0byBOdW1iZXIgYXQgdGhlIGJvdW5kYXJ5IGxpa2UgdGhlIHJlc3Qgb2YgdGhlIG1vbmV5IGZpZWxkcy5cbnR5cGUgQm9va2luZ1BheW1lbnRJdGVtID0ge1xuICBpZDogc3RyaW5nO1xuICB0cmFuSWQ6IHN0cmluZztcbiAgYW1vdW50OiB1bmtub3duO1xuICBjdXJyZW5jeTogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgY2FyZFR5cGU6IHN0cmluZyB8IG51bGw7XG4gIGJhbmtUcmFuSWQ6IHN0cmluZyB8IG51bGw7XG4gIHZhbElkOiBzdHJpbmcgfCBudWxsO1xuICBwYWlkQXQ6IERhdGUgfCBudWxsO1xufTtcblxuY29uc3QgbWFwQm9va2luZ0xpc3QgPSAoYm9va2luZzogQm9va2luZ1dpdFBhY2thZ2UgJiB7IHBheW1lbnRzPzogQm9va2luZ1BheW1lbnRJdGVtW10gfSkgPT4gKHtcbiAgLi4uYm9va2luZyxcbiAgdG90YWxQcmljZTogTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSksXG4gIHBhY2thZ2U6IHsgLi4uYm9va2luZy5wYWNrYWdlLCBwcmljZTogTnVtYmVyKGJvb2tpbmcucGFja2FnZS5wcmljZSkgfSxcbiAgcGF5bWVudHM6IGJvb2tpbmcucGF5bWVudHM/Lm1hcCgocCkgPT4gKHsgLi4ucCwgYW1vdW50OiBOdW1iZXIocC5hbW91bnQpIH0pKSxcbn0pO1xuXG4vLyBcdTI1MDBcdTI1MDAgQ3JlYXRlIGJvb2tpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBjcmVhdGVCb29raW5nID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBJQ3JlYXRlQm9va2luZykgPT4ge1xuICBjb25zdCB7IHBhY2thZ2VJZCwgdHJhdmVsZXJzIH0gPSBwYXlsb2FkO1xuICBjb25zdCB0cmF2ZWxEYXRlID0gdG9VVENNaWRuaWdodChwYXlsb2FkLnRyYXZlbERhdGUpO1xuXG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG4gIGlmIChcbiAgICAhdG91clBhY2thZ2UgfHxcbiAgICB0b3VyUGFja2FnZS5pc0RlbGV0ZWQgfHxcbiAgICB0b3VyUGFja2FnZS5zdGF0dXMgIT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJQYWNrYWdlIGlzIG5vdCBhdmFpbGFibGUgZm9yIGJvb2tpbmcuXCIpO1xuICB9XG5cbiAgLy8gdG90YWxQcmljZSBpcyBjb21wdXRlZCBzZXJ2ZXItc2lkZSBmcm9tIHRoZSBwYWNrYWdlJ3MgY3VycmVudCBwcmljZSBcdTIwMTRcbiAgLy8gYW55dGhpbmcgdGhlIGNsaWVudCBzZW5kcyBpcyBpZ25vcmVkLlxuICBjb25zdCB0b3RhbFByaWNlID0gTnVtYmVyKHRvdXJQYWNrYWdlLnByaWNlKSAqIHRyYXZlbGVycztcblxuICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHR4LmJvb2tpbmcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkLFxuICAgICAgICB0cmF2ZWxEYXRlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZykge1xuICAgICAgY29uc3QgaXNSZWNlbnQgPVxuICAgICAgICBleGlzdGluZy5jcmVhdGVkQXQuZ2V0VGltZSgpID49XG4gICAgICAgIERhdGUubm93KCkgLSBTVEFMRV9CT09LSU5HX0hPVVJTICogNjAgKiA2MCAqIDEwMDA7XG5cbiAgICAgIGlmIChpc1JlY2VudCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgNDA5LFxuICAgICAgICAgIFwiWW91IGFscmVhZHkgaGF2ZSBhIHBlbmRpbmcgYm9va2luZyBmb3IgdGhpcyBwYWNrYWdlIG9uIHRoaXMgZGF0ZS5cIixcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgLy8gYWJhbmRvbmVkIGNoZWNrb3V0IFx1MjAxNCBjYW5jZWwgaXQgaW4gdGhlIHNhbWUgdHJhbnNhY3Rpb24gYW5kIHJlYm9va1xuICAgICAgYXdhaXQgdHguYm9va2luZy51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogZXhpc3RpbmcuaWQgfSxcbiAgICAgICAgZGF0YTogeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHguYm9va2luZy5jcmVhdGUoe1xuICAgICAgZGF0YTogeyB1c2VySWQsIHBhY2thZ2VJZCwgdHJhdmVsRGF0ZSwgdHJhdmVsZXJzLCB0b3RhbFByaWNlIH0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IGVtYWlsIFx1MjAxNCBuZXZlciBmYWlscyB0aGUgcmVxdWVzdFxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9LFxuICB9KTtcbiAgaWYgKHVzZXIpIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgICAgcGFja2FnZVRpdGxlOiB0b3VyUGFja2FnZS50aXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZSxcbiAgICAgICAgdHJhdmVsZXJzLFxuICAgICAgICB0b3RhbFByaWNlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9XG5cbiAgLy8gYmVzdC1lZmZvcnQgaW4tYXBwIG5vdGlmaWNhdGlvbiB0byB0aGUgcGFja2FnZSBhZ2VudCAobmV2ZXIgZmFpbHMgcmVxdWVzdClcbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIG5vdGlmeShcbiAgICAgIHRvdXJQYWNrYWdlLmFnZW50SWQsXG4gICAgICBOb3RpZmljYXRpb25UeXBlLkJPT0tJTkdfQ1JFQVRFRCxcbiAgICAgIFwiTmV3IGJvb2tpbmcgcmVjZWl2ZWRcIixcbiAgICAgIGBBIG5ldyBib29raW5nIGhhcyBiZWVuIHBsYWNlZCBmb3IgXCIke3RvdXJQYWNrYWdlLnRpdGxlfVwiLmAsXG4gICAgICBgL2Rhc2hib2FyZC9hZ2VudC9ib29raW5ncy8ke2NyZWF0ZWQuaWR9YCxcbiAgICApLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIC4uLmNyZWF0ZWQsXG4gICAgdG90YWxQcmljZTogTnVtYmVyKGNyZWF0ZWQudG90YWxQcmljZSksXG4gIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTGlzdCBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcGFnaW5hdGVCb29raW5nID0gYXN5bmMgKFxuICB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0LFxuICBpbmNsdWRlOiBQcmlzbWEuQm9va2luZ0luY2x1ZGUsXG4gIHF1ZXJ5OiBJQm9va2luZ1F1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlIHx8IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgfHwgMTA7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYm9va2luZy5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGUsXG4gICAgICBza2lwOiAocGFnZSAtIDEpICogbGltaXQsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgIH0pLFxuICAgIHByaXNtYS5ib29raW5nLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIE15IGJvb2tpbmdzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0TXlCb29raW5ncyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElCb29raW5nUXVlcnkpID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHsgdXNlcklkIH07XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAgeyBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCwgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWdlbnQgYm9va2luZ3MgKHNjb3BlZCB0byBvd24gcGFja2FnZXMpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0QWdlbnRCb29raW5ncyA9IGFzeW5jIChcbiAgYWdlbnRJZDogc3RyaW5nLFxuICBxdWVyeTogSUJvb2tpbmdTZWFyY2hRdWVyeSxcbikgPT4ge1xuICBjb25zdCB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0ge1xuICAgIHBhY2thZ2U6IHsgYWdlbnRJZCB9LFxuICB9O1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICB3aGVyZS5wYWNrYWdlID0ge1xuICAgICAgYWdlbnRJZCxcbiAgICAgIHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9LFxuICAgIH07XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAgeyBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCwgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IGFsbCBib29raW5ncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldEFsbEJvb2tpbmdzID0gYXN5bmMgKHF1ZXJ5OiBJQm9va2luZ1NlYXJjaFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7fTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUucGFja2FnZSA9IHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhZ2luYXRlQm9va2luZyhcbiAgICB3aGVyZSxcbiAgICB7XG4gICAgICBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCxcbiAgICAgIHVzZXI6IGJvb2tpbmdVc2VyU2VsZWN0LFxuICAgICAgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUsXG4gICAgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQm9va2luZyBkZXRhaWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRCb29raW5nRGV0YWlsID0gYXN5bmMgKGlkOiBzdHJpbmcsIGFjdG9yOiBCb29raW5nQWN0b3IpID0+IHtcbiAgY29uc3QgYm9va2luZyA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgcGFja2FnZTogYm9va2luZ1BhY2thZ2VEZXRhaWxTZWxlY3QsXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICAgIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlLFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG4gIGlmICghY2FuTWFuYWdlKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byB2aWV3IHRoaXMgYm9va2luZy5cIik7XG4gIH1cblxuICByZXR1cm4gbWFwQm9va2luZ0xpc3QoYm9va2luZyk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVmdW5kIChib29raW5nIGNhbmNlbGxlZCB3aXRoIHNldHRsZWQgbW9uZXkpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gUnVucyBBRlRFUiB0aGUgc3RhdHVzLXRyYW5zaXRpb24gdHJhbnNhY3Rpb24gY29tbWl0cywgc28gYSBnYXRld2F5IGZhaWx1cmUgY2FuXG4vLyBuZXZlciByb2xsIGJhY2sgdGhlIGNhbmNlbGxhdGlvbiBpdHNlbGYuIEVhY2ggc2V0dGxlZCBwYXltZW50IGlzIHJlZnVuZGVkIHZpYVxuLy8gdGhlIFNTTENvbW1lcnogUmVmdW5kIEFQSSBhbmQgaXRzIGxlZGdlciByb3cgc3RvcmVzIHRoZSBnYXRld2F5IHJlZmVyZW5jZS5cbnR5cGUgUmVmdW5kQ29udGV4dCA9IHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBwYWNrYWdlVGl0bGU6IHN0cmluZztcbiAgdHJhdmVsRGF0ZTogRGF0ZTtcbn07XG5cbmNvbnN0IGlzc3VlUmVmdW5kcyA9IGFzeW5jIChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIGN0eDogUmVmdW5kQ29udGV4dCxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHBheW1lbnRzID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHsgYm9va2luZ0lkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuUkVGVU5ERUQgfSxcbiAgICB9KTtcbiAgICBpZiAocGF5bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICBjb25zdCByZWZ1bmRSZWZzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IG91dGNvbWVzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgcGF5bWVudHMubWFwKGFzeW5jIChwYXltZW50KSA9PiB7XG4gICAgICAgIGlmICghcGF5bWVudC5iYW5rVHJhbklkKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgIGBbcmVmdW5kXSBwYXltZW50ICR7cGF5bWVudC5pZH0gaGFzIG5vIGJhbmtfdHJhbl9pZDsgZ2F0ZXdheSByZWZ1bmQgc2tpcHBlZC5gLFxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGdhdGV3YXkgPSBhd2FpdCBzc2xjb21tZXJ6UmVmdW5kKHtcbiAgICAgICAgICBiYW5rX3RyYW5faWQ6IHBheW1lbnQuYmFua1RyYW5JZCxcbiAgICAgICAgICByZWZ1bmRfYW1vdW50OiBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICAgICAgICAgIHJlZnVuZF9yZW1hcmtzOiBgQm9va2luZyAke2Jvb2tpbmdJZH0gY2FuY2VsbGVkIC0gVHJpcFZlcnNlYCxcbiAgICAgICAgICByZWZlX2lkOiBib29raW5nSWQsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZ2F0ZXdheS5zdGF0dXMgPT09IFwic3VjY2Vzc1wiICYmIGdhdGV3YXkucmVmdW5kX3JlZl9pZCkge1xuICAgICAgICAgIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICAgICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgICAgICAgZGF0YTogeyByZWZ1bmRSZWZJZDogZ2F0ZXdheS5yZWZ1bmRfcmVmX2lkLCByZWZ1bmRlZEF0OiBuZXcgRGF0ZSgpIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmVmdW5kUmVmcy5wdXNoKGdhdGV3YXkucmVmdW5kX3JlZl9pZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgIGBbcmVmdW5kXSBwYXltZW50ICR7cGF5bWVudC5pZH0gcmVqZWN0ZWQ6ICR7Z2F0ZXdheS5lcnJvclJlYXNvbiA/PyBnYXRld2F5LnN0YXR1cyA/PyBcInVua25vd25cIn1gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gICAgLy8gaW5kaXZpZHVhbCBmYWlsdXJlcyBhcmUgbG9nZ2VkIGFib3ZlIGFuZCBzd2FsbG93ZWQgXHUyMDE0IG1vbmV5IHN0YXR1cyBhbHJlYWR5XG4gICAgLy8gZmxpcHBlZCB0byBSRUZVTkRFRCwgc28gdGhlIGN1c3RvbWVyIHNlZXMgYSByZWZ1bmQgcmVnYXJkbGVzcy5cbiAgICB2b2lkIG91dGNvbWVzO1xuXG4gICAgaWYgKHJlZnVuZFJlZnMubGVuZ3RoID4gMCkge1xuICAgICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgICBzZW5kUmVmdW5kRW1haWwoe1xuICAgICAgICAgIGVtYWlsOiBjdHguZW1haWwsXG4gICAgICAgICAgbmFtZTogY3R4Lm5hbWUsXG4gICAgICAgICAgcGFja2FnZVRpdGxlOiBjdHgucGFja2FnZVRpdGxlLFxuICAgICAgICAgIHRyYXZlbERhdGU6IGN0eC50cmF2ZWxEYXRlLFxuICAgICAgICAgIGFtb3VudDogcGF5bWVudHMucmVkdWNlKChzdW0sIHApID0+IHN1bSArIE51bWJlcihwLmFtb3VudCksIDApLFxuICAgICAgICAgIHJlZnVuZFJlZklkOiByZWZ1bmRSZWZzWzBdLFxuICAgICAgICB9KSxcbiAgICAgIF0pO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtyZWZ1bmRdIHVuZXhwZWN0ZWQgZXJyb3I6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsXG4gICAgKTtcbiAgfVxufTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXR1cyB0cmFuc2l0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgdXBkYXRlQm9va2luZ1N0YXR1cyA9IGFzeW5jIChcbiAgaWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG4gIGFjdG9yOiBCb29raW5nQWN0b3IsXG4pID0+IHtcbiAgY29uc3QgeyBzdGF0dXM6IHRvIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIHBhY2thZ2U6IHtcbiAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBhZ2VudElkOiB0cnVlLCB0aXRsZTogdHJ1ZSB9LFxuICAgICAgfSxcbiAgICAgIHVzZXI6IGJvb2tpbmdVc2VyU2VsZWN0LFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKCFjYW5NYW5hZ2UoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBlcmZvcm0gdGhpcyBhY3Rpb24uXCIpO1xuICB9XG5cbiAgY29uc3QgcnVsZSA9IFRSQU5TSVRJT05TW2Jvb2tpbmcuc3RhdHVzXT8uW3RvXTtcbiAgaWYgKCFydWxlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgYENhbm5vdCB0cmFuc2l0aW9uIGJvb2tpbmcgZnJvbSAke2Jvb2tpbmcuc3RhdHVzfSB0byAke3RvfS5gLFxuICAgICk7XG4gIH1cbiAgaWYgKCFydWxlLmFsbG93ZWQoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBlcmZvcm0gdGhpcyBhY3Rpb24uXCIpO1xuICB9XG5cbiAgY29uc3QgdHJhdmVsRGF5ID0gdG9VVENNaWRuaWdodChib29raW5nLnRyYXZlbERhdGUpLmdldFRpbWUoKTtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgaWYgKHJ1bGUucmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkICYmIHRyYXZlbERheSA+IG5vdykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiQm9va2luZyBjYW4gb25seSBiZSBjb21wbGV0ZWQgYWZ0ZXIgdGhlIHRyYXZlbCBkYXRlIGhhcyBwYXNzZWQuXCIsXG4gICAgKTtcbiAgfVxuICBpZiAocnVsZS5iZWZvcmVUcmF2ZWxEYXRlICYmIHRyYXZlbERheSA8PSBub3cpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkJvb2tpbmcgY2FuIG9ubHkgYmUgcmV2ZXJ0ZWQgYmVmb3JlIHRoZSB0cmF2ZWwgZGF0ZS5cIixcbiAgICApO1xuICB9XG5cbiAgLy8gY29tcGFyZS1hbmQtc2V0OiB0aGUgdHJhbnNpdGlvbiBhcHBsaWVzIG9ubHkgaWYgdGhlIHJlY29yZGVkIHN0YXR1cyBzdGlsbFxuICAvLyBtYXRjaGVzIFx1MjAxNCBhIGNvbmN1cnJlbnQgY2hhbmdlIG1ha2VzIGNvdW50IDAgYW5kIHRoZSByZXF1ZXN0IGZhaWxzIHNhZmVseS5cbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdHguYm9va2luZy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkLCBzdGF0dXM6IGJvb2tpbmcuc3RhdHVzIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogdG8gfSxcbiAgICB9KTtcbiAgICBpZiAocmVzdWx0LmNvdW50ID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwOSxcbiAgICAgICAgXCJCb29raW5nIHN0YXR1cyBjaGFuZ2VkIGNvbmN1cnJlbnRseS4gUGxlYXNlIHRyeSBhZ2Fpbi5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQ2FuY2VsbGluZyBhIHBhaWQgYm9va2luZyBtYXJrcyBpdHMgbW9uZXkgYXMgcmV0dXJuZWQgKFJFRlVOREVEIGZsYWcpLlxuICAgIC8vIEFiYW5kb25lZCBzZXNzaW9ucyBhcmUgY2FuY2VsbGVkLiBUaGUgZ2F0ZXdheSByZWZ1bmRzICsgcmVmdW5kIGVtYWlsIHJ1blxuICAgIC8vIGFmdGVyIHRoaXMgdHJhbnNhY3Rpb24gY29tbWl0cyAoaXNzdWVSZWZ1bmRzIGlzIGJlc3QtZWZmb3J0KS5cbiAgICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBib29raW5nSWQ6IGlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5SRUZVTkRFRCB9LFxuICAgICAgfSk7XG4gICAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBib29raW5nSWQ6IGlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkNBTkNFTExFRCB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHR4LmJvb2tpbmcuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIH0pO1xuXG4gIGlmICghdXBkYXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgLy8gYmVzdC1lZmZvcnQgZ2F0ZXdheSByZWZ1bmQgKyByZWZ1bmQgZW1haWwgZm9yIHNldHRsZWQgbW9uZXkgKG5ldmVyIHRocm93cylcbiAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgIGF3YWl0IGlzc3VlUmVmdW5kcyhpZCwge1xuICAgICAgZW1haWw6IGJvb2tpbmcudXNlci5lbWFpbCxcbiAgICAgIG5hbWU6IGJvb2tpbmcudXNlci5uYW1lLFxuICAgICAgcGFja2FnZVRpdGxlOiBib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICB0cmF2ZWxEYXRlOiBib29raW5nLnRyYXZlbERhdGUsXG4gICAgfSk7XG4gIH1cblxuICAvLyBiZXN0LWVmZm9ydCBlbWFpbCBmb3IgbW9uZXktc3RhdHVzIGNoYW5nZXNcbiAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNPTkZJUk1FRCB8fCB0byA9PT0gQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQpIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgICAgZW1haWw6IGJvb2tpbmcudXNlci5lbWFpbCxcbiAgICAgICAgbmFtZTogYm9va2luZy51c2VyLm5hbWUsXG4gICAgICAgIHBhY2thZ2VUaXRsZTogYm9va2luZy5wYWNrYWdlLnRpdGxlLFxuICAgICAgICB0cmF2ZWxEYXRlOiBib29raW5nLnRyYXZlbERhdGUsXG4gICAgICAgIHRyYXZlbGVyczogYm9va2luZy50cmF2ZWxlcnMsXG4gICAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihib29raW5nLnRvdGFsUHJpY2UpLFxuICAgICAgICBzdGF0dXM6IHRvLFxuICAgICAgfSksXG4gICAgXSk7XG4gIH1cblxuICAvLyBiZXN0LWVmZm9ydCBpbi1hcHAgbm90aWZpY2F0aW9ucyAobmV2ZXIgZmFpbHMgcmVxdWVzdCkuIFJlY2lwaWVudCBvZiBhXG4gIC8vIGNhbmNlbGxhdGlvbiBkZXBlbmRzIG9uIHRoZSBhY3RvcjogdGhlIGN1c3RvbWVyIGNhbmNlbHMgXHUyMTkyIHRoZSBhZ2VudCBoZWFycztcbiAgLy8gdGhlIGFnZW50IGNhbmNlbHMgXHUyMTkyIHRoZSBjdXN0b21lciBoZWFyczsgYW4gQURNSU4gY2FuY2VscyBcdTIxOTIgYm90aCBoZWFyLCBzaW5jZVxuICAvLyB0aGUgYWRtaW4gYWN0cyBvbiBiZWhhbGYgb2YgdGhlIHBsYXRmb3JtLCBub3QgZWl0aGVyIHNpZGUuXG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DT05GSVJNRUQpIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBub3RpZnkoXG4gICAgICAgIGJvb2tpbmcudXNlcklkLFxuICAgICAgICBOb3RpZmljYXRpb25UeXBlLkJPT0tJTkdfQ09ORklSTUVELFxuICAgICAgICBcIkJvb2tpbmcgY29uZmlybWVkXCIsXG4gICAgICAgIGBZb3VyIGJvb2tpbmcgZm9yIFwiJHtib29raW5nLnBhY2thZ2UudGl0bGV9XCIgaGFzIGJlZW4gY29uZmlybWVkLmAsXG4gICAgICAgIGAvZGFzaGJvYXJkL2Jvb2tpbmdzLyR7aWR9YCxcbiAgICAgICksXG4gICAgXSk7XG4gIH1cblxuICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgY29uc3QgcmVjaXBpZW50czogc3RyaW5nW10gPSBbXTtcbiAgICBpZiAoYWN0b3IuaWQgPT09IGJvb2tpbmcudXNlcklkKSB7XG4gICAgICByZWNpcGllbnRzLnB1c2goYm9va2luZy5wYWNrYWdlLmFnZW50SWQpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICBhY3Rvci5yb2xlID09PSBSb2xlLkFHRU5UICYmXG4gICAgICBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWRcbiAgICApIHtcbiAgICAgIHJlY2lwaWVudHMucHVzaChib29raW5nLnVzZXJJZCk7XG4gICAgfSBlbHNlIGlmIChhY3Rvci5yb2xlID09PSBSb2xlLkFETUlOKSB7XG4gICAgICByZWNpcGllbnRzLnB1c2goYm9va2luZy51c2VySWQsIGJvb2tpbmcucGFja2FnZS5hZ2VudElkKTtcbiAgICB9XG5cbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChcbiAgICAgIFsuLi5uZXcgU2V0KHJlY2lwaWVudHMpXS5tYXAoKHJlY2lwaWVudElkKSA9PlxuICAgICAgICBub3RpZnkoXG4gICAgICAgICAgcmVjaXBpZW50SWQsXG4gICAgICAgICAgTm90aWZpY2F0aW9uVHlwZS5CT09LSU5HX0NBTkNFTExFRCxcbiAgICAgICAgICBcIkJvb2tpbmcgY2FuY2VsbGVkXCIsXG4gICAgICAgICAgYFRoZSBib29raW5nIGZvciBcIiR7Ym9va2luZy5wYWNrYWdlLnRpdGxlfVwiIGhhcyBiZWVuIGNhbmNlbGxlZC5gLFxuICAgICAgICAgIGAvZGFzaGJvYXJkL2Jvb2tpbmdzLyR7aWR9YCxcbiAgICAgICAgKSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB7IC4uLnVwZGF0ZWQsIHRvdGFsUHJpY2U6IE51bWJlcih1cGRhdGVkLnRvdGFsUHJpY2UpIH07XG59O1xuXG5leHBvcnQgY29uc3QgYm9va2luZ1NlcnZpY2UgPSB7XG4gIGNyZWF0ZUJvb2tpbmcsXG4gIGdldE15Qm9va2luZ3MsXG4gIGdldEFnZW50Qm9va2luZ3MsXG4gIGdldEFsbEJvb2tpbmdzLFxuICBnZXRCb29raW5nRGV0YWlsLFxuICB1cGRhdGVCb29raW5nU3RhdHVzLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCBjcmVhdGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxuICB0cmF2ZWxEYXRlOiB6LmNvZXJjZS5kYXRlKHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJUcmF2ZWwgZGF0ZSBpcyByZXF1aXJlZFwiLFxuICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJUcmF2ZWwgZGF0ZSBtdXN0IGJlIGEgdmFsaWQgZGF0ZVwiLFxuICB9KS5yZWZpbmUoXG4gICAgKGRhdGUpID0+IHtcbiAgICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICAgIGNvbnN0IHRyYXZlbERheSA9IG5ldyBEYXRlKFxuICAgICAgICBEYXRlLlVUQyhcbiAgICAgICAgICBkYXRlLmdldFVUQ0Z1bGxZZWFyKCksXG4gICAgICAgICAgZGF0ZS5nZXRVVENNb250aCgpLFxuICAgICAgICAgIGRhdGUuZ2V0VVRDRGF0ZSgpLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IHRvZGF5VVRDID0gbmV3IERhdGUoXG4gICAgICAgIERhdGUuVVRDKFxuICAgICAgICAgIHRvZGF5LmdldFVUQ0Z1bGxZZWFyKCksXG4gICAgICAgICAgdG9kYXkuZ2V0VVRDTW9udGgoKSxcbiAgICAgICAgICB0b2RheS5nZXRVVENEYXRlKCksXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRyYXZlbERheS5nZXRUaW1lKCkgPj0gdG9kYXlVVEMuZ2V0VGltZSgpO1xuICAgIH0sXG4gICAgeyBtZXNzYWdlOiBcIlRyYXZlbCBkYXRlIGNhbm5vdCBiZSBpbiB0aGUgcGFzdC5cIiB9LFxuICApLFxuICB0cmF2ZWxlcnM6IHpcbiAgICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiVHJhdmVsZXJzIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAuaW50KFwiVHJhdmVsZXJzIG11c3QgYmUgYSB3aG9sZSBudW1iZXJcIilcbiAgICAubWluKDEsIFwiVHJhdmVsZXJzIG11c3QgYmUgYXQgbGVhc3QgMVwiKVxuICAgIC5tYXgoMjAsIFwiVHJhdmVsZXJzIG11c3QgYmUgYXQgbW9zdCAyMFwiKSxcbn0pO1xuXG5jb25zdCBib29raW5nUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJCb29raW5nIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oQm9va2luZ1N0YXR1cykub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBib29raW5nU2VhcmNoUXVlcnlTY2hlbWEgPSBib29raW5nUXVlcnlTY2hlbWEuZXh0ZW5kKHtcbiAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oQm9va2luZ1N0YXR1cywge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgc3RhdHVzXCIsXG4gIH0pLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRDcmVhdGVCb29raW5nU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY3JlYXRlU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRCb29raW5nUXVlcnlTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBib29raW5nUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUVXBkYXRlU3RhdHVzU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXBkYXRlU3RhdHVzU2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlU2NoZW1hLFxuICBib29raW5nUGFyYW1zU2NoZW1hLFxuICBib29raW5nUXVlcnlTY2hlbWEsXG4gIGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHJldmlld0NvbnRyb2xsZXIgfSBmcm9tIFwiLi9yZXZpZXcuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgcmV2aWV3VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9yZXZpZXcudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IChVU0VSIG9ubHkpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcmV2aWV3VmFsaWRhdGlvbnMuY3JlYXRlUmV2aWV3U2NoZW1hIH0pLFxuICByZXZpZXdDb250cm9sbGVyLmNyZWF0ZVJldmlldyxcbik7XG5cbi8vIDIuIExpc3QgcmV2aWV3cyBmb3IgYSBwYWNrYWdlIChwdWJsaWMpXG5yb3V0ZXIuZ2V0KFxuICBcIi9wYWNrYWdlLzpwYWNrYWdlSWRcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHJldmlld1ZhbGlkYXRpb25zLnJldmlld1BhcmFtc1NjaGVtYSxcbiAgICBxdWVyeTogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3UXVlcnlTY2hlbWEsXG4gIH0pLFxuICByZXZpZXdDb250cm9sbGVyLmdldFBhY2thZ2VSZXZpZXdzLFxuKTtcblxuLy8gMy4gVXBkYXRlIGEgcmV2aWV3IChVU0VSLCBhdXRob3Igb25seSkgXHUyMDE0IHJlZ2lzdGVyZWQgYWZ0ZXIgL3BhY2thZ2UvOnBhY2thZ2VJZFxuLy8gICAgc28gdGhlIGxpdGVyYWwgYC9wYWNrYWdlYCBzZWdtZW50IGlzIG5ldmVyIHN3YWxsb3dlZCBieSBgLzppZGAuXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiByZXZpZXdWYWxpZGF0aW9ucy5yZXZpZXdJZFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiByZXZpZXdWYWxpZGF0aW9ucy51cGRhdGVSZXZpZXdTY2hlbWEsXG4gIH0pLFxuICByZXZpZXdDb250cm9sbGVyLnVwZGF0ZVJldmlldyxcbik7XG5cbi8vIDQuIERlbGV0ZSBhIHJldmlldyAoYXV0aG9yIG9yIEFETUlOKVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiByZXZpZXdWYWxpZGF0aW9ucy5yZXZpZXdJZFBhcmFtc1NjaGVtYSB9KSxcbiAgcmV2aWV3Q29udHJvbGxlci5kZWxldGVSZXZpZXcsXG4pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3Um91dGVzID0gcm91dGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyByZXZpZXdTZXJ2aWNlIH0gZnJvbSBcIi4vcmV2aWV3LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgY29udHJvbGxlciAoVVNFUiBvbmx5KVxuY29uc3QgY3JlYXRlUmV2aWV3ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmV2aWV3U2VydmljZS5jcmVhdGVSZXZpZXcodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJSZXZpZXcgc3VibWl0dGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIExpc3QgcGFja2FnZSByZXZpZXdzIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGdldFBhY2thZ2VSZXZpZXdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUlkID0gU3RyaW5nKHJlcS5wYXJhbXMucGFja2FnZUlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXZpZXdTZXJ2aWNlLmxpc3RQYWNrYWdlUmV2aWV3cyhwYWNrYWdlSWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFVwZGF0ZSBhIHJldmlldyBjb250cm9sbGVyIChVU0VSLCBhdXRob3Igb25seSlcbmNvbnN0IHVwZGF0ZVJldmlldyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJldmlld1NlcnZpY2UudXBkYXRlUmV2aWV3KHVzZXJJZCwgaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJSZXZpZXcgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBEZWxldGUgYSByZXZpZXcgY29udHJvbGxlciAoYXV0aG9yIG9yIEFETUlOKVxuY29uc3QgZGVsZXRlUmV2aWV3ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3Qgcm9sZSA9IHJlcS51c2VyIS5yb2xlO1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJldmlld1NlcnZpY2UuZGVsZXRlUmV2aWV3KHVzZXJJZCwgcm9sZSwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlJldmlldyBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCByZXZpZXdDb250cm9sbGVyID0ge1xuICBjcmVhdGVSZXZpZXcsXG4gIGdldFBhY2thZ2VSZXZpZXdzLFxuICB1cGRhdGVSZXZpZXcsXG4gIGRlbGV0ZVJldmlldyxcbn07XG4iLCAiaW1wb3J0IHsgUGFja2FnZVN0YXR1cywgQm9va2luZ1N0YXR1cywgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHtcbiAgSUNyZWF0ZVJldmlld1BheWxvYWQsXG4gIElSZXZpZXdRdWVyeSxcbiAgSVVwZGF0ZVJldmlld1BheWxvYWQsXG59IGZyb20gXCIuL3Jldmlldy5pbnRlcmZhY2VcIjtcblxuLy8gU2hhcmVkIHJhdGluZyByZWNvbXB1dGUgXHUyMDE0IHRoZSBzaW5nbGUgc291cmNlIG9mIHRydXRoIGZvciB0aGUgcGFja2FnZVxuLy8gYXZlcmFnZS4gY3JlYXRlL3VwZGF0ZS9kZWxldGUgYWxsIGNhbGwgaXQgaW5zaWRlIHRoZWlyIG93biB0cmFuc2FjdGlvbiwgYW5kXG4vLyB0aGUgYWdncmVnYXRlIGFsd2F5cyBmaWx0ZXJzIGBpc0RlbGV0ZWQ6IGZhbHNlYCBzbyBhIHJlbW92ZWQgcmF0aW5nIG5ldmVyXG4vLyBjb3VudHMgKG90aGVyd2lzZSBkZWxldGUgd291bGQgcmVjb21wdXRlIGFuIHVuY2hhbmdlZCBhdmVyYWdlKS5cbmNvbnN0IHJlY29tcHV0ZVBhY2thZ2VSYXRpbmcgPSBhc3luYyAoXG4gIHR4OiBQcmlzbWEuVHJhbnNhY3Rpb25DbGllbnQsXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuKTogUHJvbWlzZTxudW1iZXI+ID0+IHtcbiAgY29uc3QgeyBfYXZnIH0gPSBhd2FpdCB0eC5yZXZpZXcuYWdncmVnYXRlKHtcbiAgICB3aGVyZTogeyBwYWNrYWdlSWQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBfYXZnOiB7IHJhdGluZzogdHJ1ZSB9LFxuICB9KTtcblxuICBjb25zdCByYXRpbmcgPSBNYXRoLnJvdW5kKChfYXZnLnJhdGluZyA/PyAwKSAqIDEwKSAvIDEwO1xuXG4gIGF3YWl0IHR4LnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGE6IHsgcmF0aW5nIH0sXG4gIH0pO1xuXG4gIHJldHVybiByYXRpbmc7XG59O1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgKFVTRVIgb25seSkgXHUyMDE0IGdhdGVkLCB1bmlxdWUgcGVyIHVzZXIrcGFja2FnZSwgYW5kXG4vLyAgICByZWNhbGN1bGF0ZXMgdGhlIHBhY2thZ2UgcmF0aW5nIGluIHRoZSBzYW1lIHRyYW5zYWN0aW9uLlxuY29uc3QgY3JlYXRlUmV2aWV3ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBJQ3JlYXRlUmV2aWV3UGF5bG9hZCkgPT4ge1xuICByZXR1cm4gcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICAvLyBQYWNrYWdlIG11c3QgZXhpc3QsIGJlIGFwcHJvdmVkLCBhbmQgbm90IGJlIGRlbGV0ZWQgXHUyMDE0IGEgcmV2aWV3IG9mIGFcbiAgICAvLyBwZW5kaW5nL3JlamVjdGVkL2RlbGV0ZWQgcGFja2FnZSBpcyBub25zZW5zZS5cbiAgICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHR4LnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICBpZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIGFnZW50SWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghdG91clBhY2thZ2UpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIC8vIE5vIHNlbGYtcmV2aWV3IFx1MjAxNCBhbiBhZ2VudCByYXRpbmcgdGhlaXIgb3duIHBhY2thZ2UgaXMgYSBjb25mbGljdCBvZiBpbnRlcmVzdC5cbiAgICBpZiAodG91clBhY2thZ2UuYWdlbnRJZCA9PT0gdXNlcklkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW5ub3QgcmV2aWV3IHlvdXIgb3duIHBhY2thZ2UuXCIpO1xuICAgIH1cblxuICAgIC8vIE9ubHkgY3VzdG9tZXJzIHdpdGggYSBjb21wbGV0ZWQgYm9va2luZyBtYXkgcmV2aWV3LlxuICAgIGNvbnN0IGNvbXBsZXRlZEJvb2tpbmcgPSBhd2FpdCB0eC5ib29raW5nLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICAgIHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQsXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIWNvbXBsZXRlZEJvb2tpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAzLFxuICAgICAgICBcIllvdSBjYW4gb25seSByZXZpZXcgYSBwYWNrYWdlIGFmdGVyIGNvbXBsZXRpbmcgYSBib29raW5nLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBGcmllbmRseSBkdXBsaWNhdGUgY2hlY2sgXHUyMDE0IEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pIGJhY2tzdG9wcyBhbnlcbiAgICAvLyByYWNlIHZpYSBQMjAwMiAobWFwcGVkIHRvIDQwOSBieSB0aGUgZ2xvYmFsIGhhbmRsZXIpLiBEZWxpYmVyYXRlbHkgTk9UXG4gICAgLy8gZmlsdGVyZWQgYnkgaXNEZWxldGVkOiBzb2Z0IGRlbGV0ZSBrZWVwcyB0aGUgcm93LCBzbyByZS1yZXZpZXdpbmcgYWZ0ZXJcbiAgICAvLyBhIGRlbGV0ZSBzdGlsbCBmYWlscyB3aXRoIHRoaXMgZnJpZW5kbHkgNDA5LlxuICAgIGNvbnN0IGV4aXN0aW5nUmV2aWV3ID0gYXdhaXQgdHgucmV2aWV3LmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZTogeyB1c2VySWQsIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKGV4aXN0aW5nUmV2aWV3KSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIllvdSBoYXZlIGFscmVhZHkgcmV2aWV3ZWQgdGhpcyBwYWNrYWdlLlwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBjcmVhdGVkUmV2aWV3ID0gYXdhaXQgdHgucmV2aWV3LmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgICAgcmF0aW5nOiBwYXlsb2FkLnJhdGluZyxcbiAgICAgICAgY29tbWVudDogcGF5bG9hZC5jb21tZW50LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJhdGluZyA9IGF3YWl0IHJlY29tcHV0ZVBhY2thZ2VSYXRpbmcodHgsIHBheWxvYWQucGFja2FnZUlkKTtcblxuICAgIHJldHVybiB7IHJldmlldzogY3JlYXRlZFJldmlldywgcmF0aW5nIH07XG4gIH0pO1xufTtcblxuLy8gMi4gTGlzdCByZXZpZXdzIGZvciBhIHBhY2thZ2UgKHB1YmxpYykgXHUyMDE0IHBhZ2luYXRlZDsgdGhlIHBhY2thZ2UgbXVzdCBiZVxuLy8gICAgYXBwcm92ZWQgYW5kIG5vdCBkZWxldGVkIHNvIHVucHVibGlzaGVkIHBhY2thZ2UgcmV2aWV3cyBuZXZlciBsZWFrLlxuLy8gICAgRGVsZXRlZCByZXZpZXdzIGFyZSBleGNsdWRlZCBzbyBhIHJlbW92ZWQgcmF0aW5nIHN0b3BzIGNvdW50aW5nLlxuY29uc3QgbGlzdFBhY2thZ2VSZXZpZXdzID0gYXN5bmMgKFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcXVlcnk6IElSZXZpZXdRdWVyeSxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7XG4gICAgICBpZDogcGFja2FnZUlkLFxuICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlID0geyBwYWNrYWdlSWQsIGlzRGVsZXRlZDogZmFsc2UgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5yZXZpZXcuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBzZWxlY3Q6IHtcbiAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgIHJhdGluZzogdHJ1ZSxcbiAgICAgICAgY29tbWVudDogdHJ1ZSxcbiAgICAgICAgY3JlYXRlZEF0OiB0cnVlLFxuICAgICAgICB1cGRhdGVkQXQ6IHRydWUsXG4gICAgICAgIHVzZXI6IHsgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGF2YXRhclVybDogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnJldmlldy5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFVwZGF0ZSBhIHJldmlldyAoVVNFUiwgYXV0aG9yIG9ubHkpLiBBIGZvcmVpZ24gaWQgb3IgYSByZW1vdmVkIHJldmlldyBpc1xuLy8gICAgYSB1bmlmb3JtIDQwNCBcdTIwMTQgbmV2ZXIgYSBsZWFrLiBUaGUgcGFja2FnZSBhdmVyYWdlIGlzIHJlY29tcHV0ZWQgaW4gdGhlXG4vLyAgICBzYW1lIHRyYW5zYWN0aW9uLlxuY29uc3QgdXBkYXRlUmV2aWV3ID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcmV2aWV3SWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVJldmlld1BheWxvYWQsXG4pID0+IHtcbiAgcmV0dXJuIHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCB0eC5yZXZpZXcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7IGlkOiByZXZpZXdJZCwgdXNlcklkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIHBhY2thZ2VJZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFleGlzdGluZykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJSZXZpZXcgbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgdHgucmV2aWV3LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcmV2aWV3SWQgfSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgLi4uKHBheWxvYWQucmF0aW5nICE9PSB1bmRlZmluZWQgPyB7IHJhdGluZzogcGF5bG9hZC5yYXRpbmcgfSA6IHt9KSxcbiAgICAgICAgLi4uKHBheWxvYWQuY29tbWVudCAhPT0gdW5kZWZpbmVkID8geyBjb21tZW50OiBwYXlsb2FkLmNvbW1lbnQgfSA6IHt9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBhd2FpdCByZWNvbXB1dGVQYWNrYWdlUmF0aW5nKHR4LCBleGlzdGluZy5wYWNrYWdlSWQpO1xuXG4gICAgLy8gVGhlIHJlc3BvbnNlJ3MgcmF0aW5nIGlzIHRoZSBhdXRob3JpdGF0aXZlIHZhbHVlIGZyb20gdGhlIHBhY2thZ2Ugcm93LFxuICAgIC8vIG5vdCB0aGUgaW5wdXQgXHUyMDE0IHRoZSBjbGllbnQncyBkaXNwbGF5ZWQgYXZlcmFnZSBpcyBuZXZlciBzdGFsZS5cbiAgICBjb25zdCBmcmVzaCA9IGF3YWl0IHR4LnRvdXJQYWNrYWdlLmZpbmRVbmlxdWUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IGV4aXN0aW5nLnBhY2thZ2VJZCB9LFxuICAgICAgc2VsZWN0OiB7IHJhdGluZzogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgcmV2aWV3OiB1cGRhdGVkLCByYXRpbmc6IGZyZXNoPy5yYXRpbmcgPz8gMCB9O1xuICB9KTtcbn07XG5cbi8vIDQuIFNvZnQgZGVsZXRlIGEgcmV2aWV3IChhdXRob3Igb3IgQURNSU4pIFx1MjAxNCB0aGUgYXZlcmFnZSBpcyByZWNvbXB1dGVkIHNvIHRoZVxuLy8gICAgcmVtb3ZlZCByYXRpbmcgc3RvcHMgY291bnRpbmcuIEZvcmVpZ24gaWQgLyByZXBlYXQgZGVsZXRlIFx1MjE5MiB1bmlmb3JtIDQwNC5cbmNvbnN0IGRlbGV0ZVJldmlldyA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHJvbGU6IFJvbGUsXG4gIHJldmlld0lkOiBzdHJpbmcsXG4pID0+IHtcbiAgcmV0dXJuIHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCB0eC5yZXZpZXcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7IGlkOiByZXZpZXdJZCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBwYWNrYWdlSWQ6IHRydWUsIHVzZXJJZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFleGlzdGluZykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJSZXZpZXcgbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICBpZiAocm9sZSAhPT0gUm9sZS5BRE1JTiAmJiBleGlzdGluZy51c2VySWQgIT09IHVzZXJJZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJSZXZpZXcgbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICBjb25zdCByZW1vdmVkID0gYXdhaXQgdHgucmV2aWV3LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJldmlld0lkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHJlbW92ZWQuY291bnQgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUmV2aWV3IG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgcmF0aW5nID0gYXdhaXQgcmVjb21wdXRlUGFja2FnZVJhdGluZyh0eCwgZXhpc3RpbmcucGFja2FnZUlkKTtcblxuICAgIHJldHVybiB7IHJldmlld0lkLCByYXRpbmcgfTtcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgcmV2aWV3U2VydmljZSA9IHtcbiAgY3JlYXRlUmV2aWV3LFxuICBsaXN0UGFja2FnZVJldmlld3MsXG4gIHVwZGF0ZVJldmlldyxcbiAgZGVsZXRlUmV2aWV3LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlUmV2aWV3U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWNrYWdlSWQ6IHpcbiAgICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC5taW4oMSwgXCJQYWNrYWdlIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxuICAgIHJhdGluZzogelxuICAgICAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIlJhdGluZyBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAuaW50KFwiUmF0aW5nIG11c3QgYmUgYSB3aG9sZSBudW1iZXJcIilcbiAgICAgIC5taW4oMSwgXCJSYXRpbmcgbXVzdCBiZSBhdCBsZWFzdCAxXCIpXG4gICAgICAubWF4KDUsIFwiUmF0aW5nIG11c3QgYmUgYXQgbW9zdCA1XCIpLFxuICAgIGNvbW1lbnQ6IHpcbiAgICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb21tZW50IGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC50cmltKClcbiAgICAgIC5taW4oMSwgXCJDb21tZW50IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gICAgICAubWF4KDEwMDAsIFwiQ29tbWVudCBtdXN0IGJlIGF0IG1vc3QgMTAwMCBjaGFyYWN0ZXJzXCIpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHJldmlld1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFja2FnZUlkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oMSwgXCJQYWNrYWdlIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxufSk7XG5cbmNvbnN0IHJldmlld1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVJldmlld1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcmF0aW5nOiB6XG4gICAgICAubnVtYmVyKHsgaW52YWxpZF90eXBlX2Vycm9yOiBcIlJhdGluZyBtdXN0IGJlIGEgbnVtYmVyXCIgfSlcbiAgICAgIC5pbnQoXCJSYXRpbmcgbXVzdCBiZSBhIHdob2xlIG51bWJlclwiKVxuICAgICAgLm1pbigxLCBcIlJhdGluZyBtdXN0IGJlIGF0IGxlYXN0IDFcIilcbiAgICAgIC5tYXgoNSwgXCJSYXRpbmcgbXVzdCBiZSBhdCBtb3N0IDVcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICAgIGNvbW1lbnQ6IHpcbiAgICAgIC5zdHJpbmcoeyBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiQ29tbWVudCBtdXN0IGJlIGEgc3RyaW5nXCIgfSlcbiAgICAgIC50cmltKClcbiAgICAgIC5taW4oMSwgXCJDb21tZW50IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gICAgICAubWF4KDEwMDAsIFwiQ29tbWVudCBtdXN0IGJlIGF0IG1vc3QgMTAwMCBjaGFyYWN0ZXJzXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IGRhdGEucmF0aW5nICE9PSB1bmRlZmluZWQgfHwgZGF0YS5jb21tZW50ICE9PSB1bmRlZmluZWQsIHtcbiAgICBtZXNzYWdlOiBcIkF0IGxlYXN0IG9uZSBvZiByYXRpbmcgb3IgY29tbWVudCBtdXN0IGJlIHByb3ZpZGVkXCIsXG4gIH0pO1xuXG5jb25zdCByZXZpZXdJZFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUmV2aWV3IGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiUmV2aWV3IGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxufSk7XG5cbmV4cG9ydCBjb25zdCByZXZpZXdWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlUmV2aWV3U2NoZW1hLFxuICByZXZpZXdQYXJhbXNTY2hlbWEsXG4gIHJldmlld1F1ZXJ5U2NoZW1hLFxuICB1cGRhdGVSZXZpZXdTY2hlbWEsXG4gIHJldmlld0lkUGFyYW1zU2NoZW1hLFxufTtcbiIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgY2F0ZWdvcnlDb250cm9sbGVyIH0gZnJvbSBcIi4vY2F0ZWdvcnkuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgY2F0ZWdvcnlWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2NhdGVnb3J5LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIExpc3QgYWxsIGNhdGVnb3JpZXMgKHB1YmxpYywgbm8gYXV0aClcbnJvdXRlci5nZXQoXCIvXCIsIGNhdGVnb3J5Q29udHJvbGxlci5nZXRBbGxDYXRlZ29yaWVzKTtcblxuLy8gMi4gQ3JlYXRlIGNhdGVnb3J5IChhZG1pbilcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogY2F0ZWdvcnlWYWxpZGF0aW9ucy5jcmVhdGVDYXRlZ29yeVNjaGVtYSB9KSxcbiAgY2F0ZWdvcnlDb250cm9sbGVyLmNyZWF0ZUNhdGVnb3J5LFxuKTtcblxuLy8gMy4gVXBkYXRlIGNhdGVnb3J5IChhZG1pbilcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBjYXRlZ29yeVZhbGlkYXRpb25zLmNhdGVnb3J5UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGNhdGVnb3J5VmFsaWRhdGlvbnMudXBkYXRlQ2F0ZWdvcnlTY2hlbWEsXG4gIH0pLFxuICBjYXRlZ29yeUNvbnRyb2xsZXIudXBkYXRlQ2F0ZWdvcnksXG4pO1xuXG4vLyA0LiBEZWxldGUgY2F0ZWdvcnkgKGFkbWluKVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogY2F0ZWdvcnlWYWxpZGF0aW9ucy5jYXRlZ29yeVBhcmFtc1NjaGVtYSB9KSxcbiAgY2F0ZWdvcnlDb250cm9sbGVyLmRlbGV0ZUNhdGVnb3J5LFxuKTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgY2F0ZWdvcnlTZXJ2aWNlIH0gZnJvbSBcIi4vY2F0ZWdvcnkuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIENyZWF0ZSBjYXRlZ29yeSBjb250cm9sbGVyIChhZG1pbilcbmNvbnN0IGNyZWF0ZUNhdGVnb3J5ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgY2F0ZWdvcnkgPSBhd2FpdCBjYXRlZ29yeVNlcnZpY2UuY3JlYXRlQ2F0ZWdvcnkocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiQ2F0ZWdvcnkgY3JlYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBjYXRlZ29yeSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdldCBhbGwgY2F0ZWdvcmllcyBjb250cm9sbGVyIChwdWJsaWMpXG5jb25zdCBnZXRBbGxDYXRlZ29yaWVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgY2F0ZWdvcmllcyA9IGF3YWl0IGNhdGVnb3J5U2VydmljZS5nZXRBbGxDYXRlZ29yaWVzKCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIGNhdGVnb3JpZXMgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBjYXRlZ29yaWVzLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gVXBkYXRlIGNhdGVnb3J5IGNvbnRyb2xsZXIgKGFkbWluKVxuY29uc3QgdXBkYXRlQ2F0ZWdvcnkgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLnVwZGF0ZUNhdGVnb3J5KGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ2F0ZWdvcnkgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBjYXRlZ29yeSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIERlbGV0ZSBjYXRlZ29yeSBjb250cm9sbGVyIChhZG1pbilcbmNvbnN0IGRlbGV0ZUNhdGVnb3J5ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBhd2FpdCBjYXRlZ29yeVNlcnZpY2UuZGVsZXRlQ2F0ZWdvcnkoaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeUNvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZUNhdGVnb3J5LFxuICBnZXRBbGxDYXRlZ29yaWVzLFxuICB1cGRhdGVDYXRlZ29yeSxcbiAgZGVsZXRlQ2F0ZWdvcnksXG59OyIsICIvLyBCYW5nbGEgKEJlbmdhbGkpIFx1MjE5MiBMYXRpbiBjb25zb25hbnQvdm93ZWwgbWFwLCBhcHBsaWVkIGJlZm9yZSBrZWJhYi1jYXNpbmcgc29cbi8vIEJhbmdsYS1oZWF2eSB0aXRsZXMgc3RpbGwgcHJvZHVjZSByZWFkYWJsZSBzbHVncyBpbnN0ZWFkIG9mIGJlaW5nIHN0cmlwcGVkIHRvXG4vLyBhbiBlbXB0eSBzdHJpbmcuXG5jb25zdCBCQU5HTEFfVE9fTEFUSU46IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIFx1MDk4NTogXCJvXCIsXG4gIFx1MDk4NjogXCJhXCIsXG4gIFx1MDk4NzogXCJpXCIsXG4gIFx1MDk4ODogXCJpXCIsXG4gIFx1MDk4OTogXCJ1XCIsXG4gIFx1MDk4QTogXCJ1XCIsXG4gIFx1MDk4QjogXCJyaVwiLFxuICBcdTA5OEY6IFwiZVwiLFxuICBcdTA5OTA6IFwib2lcIixcbiAgXHUwOTkzOiBcIm9cIixcbiAgXHUwOTk0OiBcIm91XCIsXG4gIFx1MDk5NTogXCJrYVwiLFxuICBcdTA5OTY6IFwia2hhXCIsXG4gIFx1MDk5NzogXCJnYVwiLFxuICBcdTA5OTg6IFwiZ2hhXCIsXG4gIFx1MDk5OTogXCJuZ2FcIixcbiAgXHUwOTlBOiBcImNoYVwiLFxuICBcdTA5OUI6IFwiY2hoYVwiLFxuICBcdTA5OUM6IFwiamFcIixcbiAgXHUwOTlEOiBcImpoYVwiLFxuICBcdTA5OUU6IFwibnlhXCIsXG4gIFx1MDk5RjogXCJ0YVwiLFxuICBcdTA5QTA6IFwidGhhXCIsXG4gIFx1MDlBMTogXCJkYVwiLFxuICBcdTA5QTI6IFwiZGhhXCIsXG4gIFx1MDlBMzogXCJuYVwiLFxuICBcdTA5QTQ6IFwidGFcIixcbiAgXHUwOUE1OiBcInRoYVwiLFxuICBcdTA5QTY6IFwiZGFcIixcbiAgXHUwOUE3OiBcImRoYVwiLFxuICBcdTA5QTg6IFwibmFcIixcbiAgXHUwOUFBOiBcInBhXCIsXG4gIFx1MDlBQjogXCJwaGFcIixcbiAgXHUwOUFDOiBcImJhXCIsXG4gIFx1MDlBRDogXCJiaGFcIixcbiAgXHUwOUFFOiBcIm1hXCIsXG4gIFx1MDlBRjogXCJ5YVwiLFxuICBcdTA5QjA6IFwicmFcIixcbiAgXHUwOUIyOiBcImxhXCIsXG4gIFx1MDlCNjogXCJzaGFcIixcbiAgXHUwOUI3OiBcInNoYVwiLFxuICBcdTA5Qjg6IFwic2FcIixcbiAgXHUwOUI5OiBcImhhXCIsXG4gIFx1MDlBMVx1MDlCQzogXCJyYVwiLFxuICBcdTA5QTJcdTA5QkM6IFwicmhhXCIsXG4gIFx1MDlBRlx1MDlCQzogXCJ5YVwiLFxuICBcIlx1MDk4MlwiOiBcIm5nXCIsXG4gIFwiXHUwOTgzXCI6IFwiaFwiLFxuICBcIlx1MDk4MVwiOiBcIlwiLFxuICBcIlx1MDlDRFwiOiBcIlwiLFxuICBcIlx1MDlDN1wiOiBcImVcIixcbiAgXCJcdTA5QzhcIjogXCJvaVwiLFxuICBcIlx1MDlDQlwiOiBcIm9cIixcbiAgXCJcdTA5Q0NcIjogXCJvdVwiLFxuICBcIlx1MDlCRVwiOiBcImFcIixcbiAgXCJcdTA5QkZcIjogXCJpXCIsXG4gIFwiXHUwOUMwXCI6IFwiaVwiLFxuICBcIlx1MDlDMVwiOiBcInVcIixcbiAgXCJcdTA5QzJcIjogXCJ1XCIsXG4gIFwiXHUwOUMzXCI6IFwicmlcIixcbn07XG5cbmNvbnN0IHRyYW5zbGl0ZXJhdGUgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nID0+XG4gIFsuLi50ZXh0XS5tYXAoKGNoYXIpID0+IEJBTkdMQV9UT19MQVRJTltjaGFyXSA/PyBjaGFyKS5qb2luKFwiXCIpO1xuXG4vLyBTaGFyZWQga2ViYWItY2FzZSBzbHVnaWZpZXIgdXNlZCBieSBDYXRlZ29yeSBhbmQgVG91clBhY2thZ2Ugc2x1Z3MuIE5vbi1MYXRpblxuLy8gc2NyaXB0cyAoZS5nLiBCYW5nbGEpIGFyZSB0cmFuc2xpdGVyYXRlZCBmaXJzdDsgaWYgdGhlIHJlc3VsdCBpcyBzdGlsbCBlbXB0eVxuLy8gdGhlIGNhbGxlciBtYXkgc3VwcGx5IGEgYGZhbGxiYWNrYCAoZS5nLiBcInBhY2thZ2UtPHNob3J0SWQ+XCIpLlxuZXhwb3J0IGNvbnN0IHNsdWdpZnkgPSAodGV4dDogc3RyaW5nLCBmYWxsYmFjaz86IHN0cmluZyk6IHN0cmluZyA9PiB7XG4gIGNvbnN0IHNsdWcgPSB0cmFuc2xpdGVyYXRlKHRleHQpXG4gICAgLnRvTG93ZXJDYXNlKClcbiAgICAudHJpbSgpXG4gICAgLnJlcGxhY2UoL1teXFx3XFxzLV0vZywgXCJcIilcbiAgICAucmVwbGFjZSgvW1xcc18tXSsvZywgXCItXCIpXG4gICAgLnJlcGxhY2UoL14tK3wtKyQvZywgXCJcIik7XG5cbiAgcmV0dXJuIHNsdWcgfHwgZmFsbGJhY2sgfHwgXCJcIjtcbn07IiwgImltcG9ydCB7IFBhY2thZ2VTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7IElDcmVhdGVDYXRlZ29yeSwgSVVwZGF0ZUNhdGVnb3J5IH0gZnJvbSBcIi4vY2F0ZWdvcnkuaW50ZXJmYWNlXCI7XG5cbi8vIEZyaWVuZGx5IDQwOSBmb3IgQHVuaXF1ZSBjb25mbGljdHMgKG5hbWUgb3Igc2x1ZykgaW5zdGVhZCBvZiBhIHJhdyBQMjAwMi5cbi8vIGV4Y2x1ZGVJZCBsZXRzIHVwZGF0ZXMgc2tpcCB0aGUgdmVyeSByb3cgYmVpbmcgZWRpdGVkIHNvIGEgbm8tb3AgcmVuYW1lXG4vLyBkb2Vzbid0IGZhbHNlLTQwOSBhZ2FpbnN0IGl0c2VsZi5cbmNvbnN0IGFzc2VydE5hbWVBdmFpbGFibGUgPSBhc3luYyAoXG4gIG5hbWU6IHN0cmluZyxcbiAgc2x1Zzogc3RyaW5nLFxuICBleGNsdWRlSWQ/OiBzdHJpbmcsXG4pID0+IHtcbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZEZpcnN0KHtcbiAgICB3aGVyZToge1xuICAgICAgT1I6IFt7IG5hbWUgfSwgeyBzbHVnIH1dLFxuICAgICAgLi4uKGV4Y2x1ZGVJZCA/IHsgTk9UOiB7IGlkOiBleGNsdWRlSWQgfSB9IDoge30pLFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmIChleGlzdGluZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiQSBjYXRlZ29yeSB3aXRoIHRoaXMgbmFtZSBhbHJlYWR5IGV4aXN0c1wiKTtcbiAgfVxufTtcblxuLy8gQ3JlYXRlIGNhdGVnb3J5IChhZG1pbilcbmNvbnN0IGNyZWF0ZUNhdGVnb3J5ID0gYXN5bmMgKHBheWxvYWQ6IElDcmVhdGVDYXRlZ29yeSkgPT4ge1xuICBjb25zdCB7IG5hbWUgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IHNsdWcgPSBzbHVnaWZ5KG5hbWUpO1xuXG4gIGF3YWl0IGFzc2VydE5hbWVBdmFpbGFibGUobmFtZSwgc2x1Zyk7XG5cbiAgcmV0dXJuIHByaXNtYS5jYXRlZ29yeS5jcmVhdGUoe1xuICAgIGRhdGE6IHsgbmFtZSwgc2x1ZyB9LFxuICB9KTtcbn07XG5cbi8vIEdldCBhbGwgY2F0ZWdvcmllcyAocHVibGljKSB3aXRoIGNvdW50cyBvZiBhcHByb3ZlZCwgbm9uLWRlbGV0ZWQgcGFja2FnZXNcbmNvbnN0IGdldEFsbENhdGVnb3JpZXMgPSBhc3luYyAoKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkuZmluZE1hbnkoe1xuICAgIG9yZGVyQnk6IHsgbmFtZTogXCJhc2NcIiB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIF9jb3VudDoge1xuICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICBwYWNrYWdlczoge1xuICAgICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcbn07XG5cbi8vIFVwZGF0ZSBjYXRlZ29yeSBuYW1lIChyZWdlbmVyYXRlcyBzbHVnKSAoYWRtaW4pXG5jb25zdCB1cGRhdGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcsIHBheWxvYWQ6IElVcGRhdGVDYXRlZ29yeSkgPT4ge1xuICBjb25zdCB7IG5hbWUgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IHNsdWcgPSBzbHVnaWZ5KG5hbWUpO1xuXG4gIGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kVW5pcXVlT3JUaHJvdyh7IHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0gfSk7XG4gIGF3YWl0IGFzc2VydE5hbWVBdmFpbGFibGUobmFtZSwgc2x1ZywgY2F0ZWdvcnlJZCk7XG5cbiAgcmV0dXJuIHByaXNtYS5jYXRlZ29yeS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0sXG4gICAgZGF0YTogeyBuYW1lLCBzbHVnIH0sXG4gIH0pO1xufTtcblxuLy8gRGVsZXRlIGNhdGVnb3J5IChhZG1pbikgXHUyMDE0IDQwOSB3aGVuIGFueSBwYWNrYWdlIHJlZmVyZW5jZXMgaXRcbmNvbnN0IGRlbGV0ZUNhdGVnb3J5ID0gYXN5bmMgKGNhdGVnb3J5SWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9IH0pO1xuXG4gIGNvbnN0IHBhY2thZ2VDb3VudCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7XG4gICAgd2hlcmU6IHsgY2F0ZWdvcnlJZCB9LFxuICB9KTtcblxuICBpZiAocGFja2FnZUNvdW50ID4gMCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwOSxcbiAgICAgIFwiQ2Fubm90IGRlbGV0ZSBjYXRlZ29yeSB3aXRoIGFzc29jaWF0ZWQgcGFja2FnZXMuIFJlbmFtZSBpdCBpbnN0ZWFkLlwiLFxuICAgICk7XG4gIH1cblxuICBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZGVsZXRlKHsgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeVNlcnZpY2UgPSB7XG4gIGNyZWF0ZUNhdGVnb3J5LFxuICBnZXRBbGxDYXRlZ29yaWVzLFxuICB1cGRhdGVDYXRlZ29yeSxcbiAgZGVsZXRlQ2F0ZWdvcnksXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBuYW1lU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ2F0ZWdvcnkgbmFtZSBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigyLCBcIkNhdGVnb3J5IG5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgLm1heCgxMDAsIFwiQ2F0ZWdvcnkgbmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGNyZWF0ZUNhdGVnb3J5U2NoZW1hID0gei5vYmplY3QoeyBuYW1lOiBuYW1lU2NoZW1hIH0pLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVDYXRlZ29yeVNjaGVtYSA9IHoub2JqZWN0KHsgbmFtZTogbmFtZVNjaGVtYSB9KS5zdHJpY3QoKTtcblxuY29uc3QgY2F0ZWdvcnlQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNhdGVnb3J5IGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeVZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVDYXRlZ29yeVNjaGVtYSxcbiAgdXBkYXRlQ2F0ZWdvcnlTY2hlbWEsXG4gIGNhdGVnb3J5UGFyYW1zU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHBhY2thZ2VDb250cm9sbGVyIH0gZnJvbSBcIi4vcGFja2FnZS5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBwYWNrYWdlVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9wYWNrYWdlLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE5PVEU6IGAvaW50ZXJuYWwvKmAgcm91dGVzIE1VU1Qgc3RheSByZWdpc3RlcmVkIGJlZm9yZSBgR0VUIC86c2x1Z2AgYmVsb3cgXHUyMDE0XG4vLyBFeHByZXNzIG1hdGNoZXMgdG9wLWRvd24sIGFuZCBhIGxpdGVyYWwgc2VnbWVudCAoYC9pbnRlcm5hbC9hbGxgKSB3b3VsZFxuLy8gb3RoZXJ3aXNlIGJlIHN3YWxsb3dlZCBieSB0aGUgYDpzbHVnYCBwYXJhbSByb3V0ZSBhbmQgNDA0IGZvcmV2ZXIuXG5cbi8vIDEuIE15IHBhY2thZ2VzIChhZ2VudCkgXHUyMDE0IHNlbGYtcHJldmlldyBvZiBQRU5ESU5HL1JFSkVDVEVEIGJlZm9yZSBhcHByb3ZhbFxucm91dGVyLmdldChcbiAgXCIvaW50ZXJuYWwvbXktcGFja2FnZXNcIixcbiAgYXV0aChSb2xlLkFHRU5UKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHBhY2thZ2VWYWxpZGF0aW9ucy5pbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0TXlQYWNrYWdlcyxcbik7XG5cbi8vIDIuIEFsbCBwYWNrYWdlcyAoYWRtaW4gbW9kZXJhdGlvbiBVSSlcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL2FsbFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogcGFja2FnZVZhbGlkYXRpb25zLmludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRBbGxQYWNrYWdlcyxcbik7XG5cbi8vIDMuIFB1YmxpYyBwYWNrYWdlIGRldGFpbCBieSBzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi86c2x1Z1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlU2x1Z1BhcmFtc1NjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0UGFja2FnZUJ5U2x1Zyxcbik7XG5cbi8vIDQuIENyZWF0ZSBwYWNrYWdlIChhZ2VudCBjcmVhdGVzIG93bjsgYWRtaW4gY2FuIGNyZWF0ZSBmb3IgYW55IGFnZW50KVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBwYWNrYWdlVmFsaWRhdGlvbnMuY3JlYXRlUGFja2FnZVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuY3JlYXRlUGFja2FnZSxcbik7XG5cbi8vIDUuIEFwcHJvdmUvcmVqZWN0IHBhY2thZ2UgKGFkbWluKSBcdTIwMTQgcmVnaXN0ZXJlZCBiZWZvcmUgUEFUQ0ggLzppZCBmb3IgY2xhcml0eVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBwYWNrYWdlVmFsaWRhdGlvbnMudXBkYXRlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuY2hhbmdlUGFja2FnZVN0YXR1cyxcbik7XG5cbi8vIDYuIFVwZGF0ZSBwYWNrYWdlIChhZ2VudCBvd24gLyBhZG1pbiBhbnkpXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLnVwZGF0ZVBhY2thZ2VTY2hlbWEsXG4gIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci51cGRhdGVQYWNrYWdlLFxuKTtcblxuLy8gNy4gU29mdCBkZWxldGUgcGFja2FnZSAoYWdlbnQgb3duIC8gYWRtaW4gYW55KVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VQYXJhbXNTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLnNvZnREZWxldGVQYWNrYWdlLFxuKTtcblxuLy8gOC4gUHVibGljIGxpc3RpbmcgXHUyMDE0IGtlcHQgbGFzdCBzbyBub25lIG9mIHRoZSBhYm92ZSByb3V0ZXMgYXJlIHNoYWRvd2VkXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUXVlcnlTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldFB1YmxpY1BhY2thZ2VzLFxuKTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBwYWNrYWdlU2VydmljZSB9IGZyb20gXCIuL3BhY2thZ2Uuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBwYWNrYWdlIGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgY3JlYXRlUGFja2FnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmNyZWF0ZVBhY2thZ2UocmVxLnVzZXIhLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LiBJdCB3aWxsIGJlIHZpc2libGUgYWZ0ZXIgYWRtaW4gYXBwcm92YWwuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBQdWJsaWMgbGlzdGluZyBjb250cm9sbGVyIChmaWx0ZXJzICsgcGFnaW5hdGlvbilcbmNvbnN0IGdldFB1YmxpY1BhY2thZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0UHVibGljUGFja2FnZXMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFB1YmxpYyBwYWNrYWdlIGRldGFpbCBieSBzbHVnXG5jb25zdCBnZXRQYWNrYWdlQnlTbHVnID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3Qgc2x1ZyA9IFN0cmluZyhyZXEucGFyYW1zLnNsdWcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldFBhY2thZ2VCeVNsdWcoc2x1Zyk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNC4gQWxsIHBhY2thZ2VzIGNvbnRyb2xsZXIgKEFETUlOIG1vZGVyYXRpb24pXG5jb25zdCBnZXRBbGxQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldEFsbFBhY2thZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIHBhY2thZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNS4gTXkgcGFja2FnZXMgY29udHJvbGxlciAoQUdFTlQpXG5jb25zdCBnZXRNeVBhY2thZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0TXlQYWNrYWdlcyh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiWW91ciBwYWNrYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDYuIFVwZGF0ZSBwYWNrYWdlIGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHVwZGF0ZVBhY2thZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS51cGRhdGVQYWNrYWdlKHJlcS51c2VyISwgaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNy4gQ2hhbmdlIHBhY2thZ2Ugc3RhdHVzIGNvbnRyb2xsZXIgKEFETUlOIGFwcHJvdmUvcmVqZWN0KVxuY29uc3QgY2hhbmdlUGFja2FnZVN0YXR1cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmNoYW5nZVBhY2thZ2VTdGF0dXMoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDguIFNvZnQgZGVsZXRlIHBhY2thZ2UgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3Qgc29mdERlbGV0ZVBhY2thZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBhd2FpdCBwYWNrYWdlU2VydmljZS5zb2Z0RGVsZXRlUGFja2FnZShyZXEudXNlciEsIGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlQ29udHJvbGxlciA9IHtcbiAgY3JlYXRlUGFja2FnZSxcbiAgZ2V0UHVibGljUGFja2FnZXMsXG4gIGdldFBhY2thZ2VCeVNsdWcsXG4gIGdldEFsbFBhY2thZ2VzLFxuICBnZXRNeVBhY2thZ2VzLFxuICB1cGRhdGVQYWNrYWdlLFxuICBjaGFuZ2VQYWNrYWdlU3RhdHVzLFxuICBzb2Z0RGVsZXRlUGFja2FnZSxcbn07IiwgImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcbmltcG9ydCB7IFBhY2thZ2VTdGF0dXMsIFJvbGUsIE5vdGlmaWNhdGlvblR5cGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IG5vdGlmeSB9IGZyb20gXCIuLi8uLi91dGlscy9ub3RpZmljYXRpb25cIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2x1Z2lmeVwiO1xuaW1wb3J0IHtcbiAgSUNyZWF0ZVBhY2thZ2VQYXlsb2FkLFxuICBJSW50ZXJuYWxQYWNrYWdlUXVlcnksXG4gIElQYWNrYWdlUXVlcnksXG4gIElSZXF1ZXN0VXNlcixcbiAgSVVwZGF0ZVBhY2thZ2VQYXlsb2FkLFxuICBJVXBkYXRlU3RhdHVzUGF5bG9hZCxcbn0gZnJvbSBcIi4vcGFja2FnZS5pbnRlcmZhY2VcIjtcblxuLy8gTW9uZXkgaXMgYERlY2ltYWwoMTAsMilgIGluIHRoZSBzY2hlbWEgKEFHRU5UUy5tZCkgXHUyMDE0IG1hcCB0byBOdW1iZXIgb24gcmV0dXJuLlxuY29uc3Qgc2VyaWFsaXplUHJpY2UgPSA8VCBleHRlbmRzIHsgcHJpY2U6IFByaXNtYS5EZWNpbWFsIH0+KHJvdzogVCk6IFQgPT4gKHtcbiAgLi4ucm93LFxuICBwcmljZTogTnVtYmVyKHJvdy5wcmljZSksXG59KTtcblxuLy8gUHVibGljIHBheWxvYWRzIGNhcnJ5IHRoZSBhZ2VudCdzIGRpc3BsYXkgaW5mbyBvbmx5IFx1MjAxNCBuZXZlciBlbWFpbC5cbmV4cG9ydCBjb25zdCBwdWJsaWNQYWNrYWdlSW5jbHVkZSA9IHtcbiAgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgYWdlbnQ6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSB9LFxufSBhcyBjb25zdDtcblxuY29uc3QgdmFsaWRhdGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2F0ZWdvcnkgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCFjYXRlZ29yeSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBjYXRlZ29yeUlkXCIpO1xuICB9XG59O1xuXG4vLyBQYWNrYWdlcyBtdXN0IGJlIG93bmVkIGJ5IGEgbGl2ZSBBR0VOVCBcdTIwMTQgb3RoZXJ3aXNlIHRoZSBib29raW5nIHN0YXRlXG4vLyBtYWNoaW5lJ3MgXCJBR0VOVCAob3ducyBwYWNrYWdlKVwiIGJyYW5jaCBhbmQgYWdlbnQtYm9va2luZ3Mgc2NvcGluZyBicmVhay5cbmNvbnN0IHZhbGlkYXRlQWdlbnQgPSBhc3luYyAoYWdlbnRJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGFnZW50ID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGFnZW50SWQgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIHJvbGU6IHRydWUsIGlzRGVsZXRlZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIWFnZW50IHx8IGFnZW50LnJvbGUgIT09IFJvbGUuQUdFTlQgfHwgYWdlbnQuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGFnZW50SWRcIik7XG4gIH1cbn07XG5cbi8vIENvbGxpc2lvbi1zYWZlIHNsdWc6IGJhc2Ugc2x1ZyBmcm9tIHRoZSB0aXRsZSwgdGhlbiBgLTJgLCBgLTNgLCAuLi4gdXNpbmcgYVxuLy8gc2luZ2xlIHByZWZpeCBxdWVyeS4gUHVyZS1CYW5nbGEvZW1vamkgdGl0bGVzIGNhbid0IHNsdWdpZnkgXHUyMDE0IGZhbGwgYmFjayB0b1xuLy8gYHBhY2thZ2UtPHNob3J0SWQ+YCBzbyB0aGUgVVJMIGlzIGFsd2F5cyBtZWFuaW5nZnVsLlxuY29uc3QgZ2VuZXJhdGVVbmlxdWVTbHVnID0gYXN5bmMgKHRpdGxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICBjb25zdCBiYXNlID0gc2x1Z2lmeSh0aXRsZSkgfHwgYHBhY2thZ2UtJHtyYW5kb21VVUlEKCkuc2xpY2UoMCwgOCl9YDtcblxuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgd2hlcmU6IHsgc2x1ZzogeyBzdGFydHNXaXRoOiBiYXNlIH0gfSxcbiAgICBzZWxlY3Q6IHsgc2x1ZzogdHJ1ZSB9LFxuICB9KTtcblxuICBjb25zdCB1c2VkID0gbmV3IFNldChleGlzdGluZy5tYXAoKHApID0+IHAuc2x1ZykpO1xuICBpZiAoIXVzZWQuaGFzKGJhc2UpKSB7XG4gICAgcmV0dXJuIGJhc2U7XG4gIH1cblxuICBsZXQgc3VmZml4ID0gMjtcbiAgd2hpbGUgKHVzZWQuaGFzKGAke2Jhc2V9LSR7c3VmZml4fWApKSB7XG4gICAgc3VmZml4ICs9IDE7XG4gIH1cbiAgcmV0dXJuIGAke2Jhc2V9LSR7c3VmZml4fWA7XG59O1xuXG4vLyAxLiBDcmVhdGUgYSBwYWNrYWdlIChBR0VOVC9BRE1JTikuIE5ldyBwYWNrYWdlcyBzdGFydCBQRU5ESU5HIGFuZCBuZXZlciBsZWFrXG4vLyAgICBpbnRvIHB1YmxpYyBxdWVyaWVzIHVudGlsIGFuIGFkbWluIGFwcHJvdmVzIHRoZW0uXG5jb25zdCBjcmVhdGVQYWNrYWdlID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGF5bG9hZDogSUNyZWF0ZVBhY2thZ2VQYXlsb2FkKSA9PiB7XG4gIGF3YWl0IHZhbGlkYXRlQ2F0ZWdvcnkocGF5bG9hZC5jYXRlZ29yeUlkKTtcblxuICAvLyBBRE1JTiBtYXkgY3JlYXRlIG9uIGJlaGFsZiBvZiBhbiBhZ2VudCAob3B0aW9uYWwgYWdlbnRJZCk7IEFHRU5UIGFsd2F5c1xuICAvLyBvd25zIHdoYXQgdGhleSBjcmVhdGUgYW5kIG1heSBub3QgaW1wZXJzb25hdGUgYW5vdGhlciB1c2VyLlxuICBsZXQgYWdlbnRJZDogc3RyaW5nO1xuICBpZiAodXNlci5yb2xlID09PSBSb2xlLkFETUlOKSB7XG4gICAgaWYgKHBheWxvYWQuYWdlbnRJZCkge1xuICAgICAgYXdhaXQgdmFsaWRhdGVBZ2VudChwYXlsb2FkLmFnZW50SWQpO1xuICAgICAgYWdlbnRJZCA9IHBheWxvYWQuYWdlbnRJZDtcbiAgICB9IGVsc2Uge1xuICAgICAgYWdlbnRJZCA9IHVzZXIuaWQ7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChwYXlsb2FkLmFnZW50SWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiYWdlbnRJZCBjYW4gb25seSBiZSBzZXQgYnkgYW4gYWRtaW5cIik7XG4gICAgfVxuICAgIGFnZW50SWQgPSB1c2VyLmlkO1xuICB9XG5cbiAgY29uc3Qgc2x1ZyA9IGF3YWl0IGdlbmVyYXRlVW5pcXVlU2x1ZyhwYXlsb2FkLnRpdGxlKTtcblxuICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgdGl0bGU6IHBheWxvYWQudGl0bGUsXG4gICAgICBkZXNjcmlwdGlvbjogcGF5bG9hZC5kZXNjcmlwdGlvbixcbiAgICAgIGxvY2F0aW9uOiBwYXlsb2FkLmxvY2F0aW9uLFxuICAgICAgcHJpY2U6IHBheWxvYWQucHJpY2UsXG4gICAgICBkdXJhdGlvbjogcGF5bG9hZC5kdXJhdGlvbixcbiAgICAgIGNhdGVnb3J5SWQ6IHBheWxvYWQuY2F0ZWdvcnlJZCxcbiAgICAgIGltYWdlczogcGF5bG9hZC5pbWFnZXMsXG4gICAgICBhZ2VudElkLFxuICAgICAgc2x1ZyxcbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UoY3JlYXRlZCk7XG59O1xuXG4vLyAyLiBQdWJsaWMgZXhwbG9yZWQgbGlzdGluZyBcdTIwMTQgQVBQUk9WRUQgKyBub3QtZGVsZXRlZCBvbmx5LCBmaWx0ZXJzICsgc29ydGluZy5cbmNvbnN0IGdldFB1YmxpY1BhY2thZ2VzID0gYXN5bmMgKHF1ZXJ5OiBJUGFja2FnZVF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3QgZmlsdGVyczogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dFtdID0gW107XG5cbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICBPUjogW1xuICAgICAgICB7IHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgIHsgZGVzY3JpcHRpb246IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgeyBsb2NhdGlvbjogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubG9jYXRpb24pIHtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgbG9jYXRpb246IHsgY29udGFpbnM6IHF1ZXJ5LmxvY2F0aW9uLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubWluUHJpY2UgIT09IHVuZGVmaW5lZCB8fCBxdWVyeS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZmlsdGVycy5wdXNoKHtcbiAgICAgIHByaWNlOiB7XG4gICAgICAgIC4uLihxdWVyeS5taW5QcmljZSAhPT0gdW5kZWZpbmVkID8geyBndGU6IHF1ZXJ5Lm1pblByaWNlIH0gOiB7fSksXG4gICAgICAgIC4uLihxdWVyeS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkID8geyBsdGU6IHF1ZXJ5Lm1heFByaWNlIH0gOiB7fSksXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG4gIGlmIChxdWVyeS5taW5SYXRpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7IHJhdGluZzogeyBndGU6IHF1ZXJ5Lm1pblJhdGluZyB9IH0pO1xuICB9XG4gIGlmIChxdWVyeS5tYXhEdXJhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZmlsdGVycy5wdXNoKHsgZHVyYXRpb246IHsgbHRlOiBxdWVyeS5tYXhEdXJhdGlvbiB9IH0pO1xuICB9XG4gIGlmIChxdWVyeS5jYXRlZ29yeSkge1xuICAgIGZpbHRlcnMucHVzaCh7IGNhdGVnb3J5OiB7IHNsdWc6IHF1ZXJ5LmNhdGVnb3J5IH0gfSk7XG4gIH1cblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICBBTkQ6IGZpbHRlcnMubGVuZ3RoID4gMCA/IGZpbHRlcnMgOiB1bmRlZmluZWQsXG4gIH07XG5cbiAgY29uc3Qgc29ydE9yZGVyID0gcXVlcnkuc29ydE9yZGVyID8/IChxdWVyeS5zb3J0QnkgPT09IFwibmV3ZXN0XCIgPyBcImRlc2NcIiA6IFwiYXNjXCIpO1xuXG4gIGNvbnN0IG9yZGVyQnlNYXA6IFJlY29yZDxzdHJpbmcsIFByaXNtYS5Ub3VyUGFja2FnZU9yZGVyQnlXaXRoUmVsYXRpb25JbnB1dD4gPSB7XG4gICAgbmV3ZXN0OiB7IGNyZWF0ZWRBdDogc29ydE9yZGVyIH0sXG4gICAgcHJpY2U6IHsgcHJpY2U6IHNvcnRPcmRlciB9LFxuICAgIHJhdGluZzogeyByYXRpbmc6IHNvcnRPcmRlciB9LFxuICAgIHRpdGxlOiB7IHRpdGxlOiBzb3J0T3JkZXIgfSxcbiAgfTtcblxuICBjb25zdCBvcmRlckJ5ID0gb3JkZXJCeU1hcFtxdWVyeS5zb3J0QnkgPz8gXCJuZXdlc3RcIl0gPz8gb3JkZXJCeU1hcC5uZXdlc3Q7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5LFxuICAgICAgaW5jbHVkZTogcHVibGljUGFja2FnZUluY2x1ZGUsXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFB1YmxpYyBkZXRhaWwgYnkgc2x1ZyBcdTIwMTQgQVBQUk9WRUQgKyBub3QtZGVsZXRlZCBvbmx5LlxuY29uc3QgZ2V0UGFja2FnZUJ5U2x1ZyA9IGFzeW5jIChzbHVnOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZEZpcnN0KHtcbiAgICB3aGVyZTogeyBzbHVnLCBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBpbmNsdWRlOiBwdWJsaWNQYWNrYWdlSW5jbHVkZSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKHRvdXJQYWNrYWdlKTtcbn07XG5cbi8vIDQuIEFsbCBwYWNrYWdlcyBmb3IgdGhlIGFkbWluIG1vZGVyYXRpb24gVUkgKGFueSBzdGF0dXMsIG9wdGlvbmFsIGZpbHRlcnMpLlxuY29uc3QgZ2V0QWxsUGFja2FnZXMgPSBhc3luYyAocXVlcnk6IElJbnRlcm5hbFBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgICAuLi4ocXVlcnkuYWdlbnRJZCA/IHsgYWdlbnRJZDogcXVlcnkuYWdlbnRJZCB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICAgICAgICBhZ2VudDogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVQcmljZSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gNS4gQW4gYWdlbnQncyBvd24gcGFja2FnZXMgKGFueSBzdGF0dXMpIFx1MjAxNCBzZWxmLXByZXZpZXcgYmVmb3JlIGFwcHJvdmFsLlxuY29uc3QgZ2V0TXlQYWNrYWdlcyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElJbnRlcm5hbFBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0ID0ge1xuICAgIGFnZW50SWQ6IHVzZXJJZCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVQcmljZSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gRmV0Y2ggKyBvd25lcnNoaXAgZ2F0ZSBzaGFyZWQgYnkgUEFUQ0ggYW5kIERFTEVURS4gQURNSU4gYnlwYXNzZXMgb3duZXJzaGlwO1xuLy8gQUdFTlQgZWRpdHMgYXJlIGNvbmZpbmVkIHRvIHRoZWlyIG93biBwYWNrYWdlcy5cbmNvbnN0IGZpbmRPd25lZFBhY2thZ2UgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYWNrYWdlSWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGlmICh1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gJiYgdG91clBhY2thZ2UuYWdlbnRJZCAhPT0gdXNlci5pZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGNhbiBvbmx5IGFjdCBvbiB5b3VyIG93biBwYWNrYWdlcy5cIik7XG4gIH1cblxuICByZXR1cm4gdG91clBhY2thZ2U7XG59O1xuXG4vLyA2LiBVcGRhdGUgYSBwYWNrYWdlLiBTbHVnIG5ldmVyIGNoYW5nZXMgKGtlZXBzIGxpbmtzL2Jvb2ttYXJrcyB2YWxpZCkuXG4vLyAgICBBR0VOVCBlZGl0cyByZXNldCBzdGF0dXMgdG8gUEVORElORzsgQURNSU4gZWRpdHMgcHJlc2VydmUgaXQuXG5jb25zdCB1cGRhdGVQYWNrYWdlID0gYXN5bmMgKFxuICB1c2VyOiBJUmVxdWVzdFVzZXIsXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlUGFja2FnZVBheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBmaW5kT3duZWRQYWNrYWdlKHVzZXIsIHBhY2thZ2VJZCk7XG5cbiAgaWYgKHBheWxvYWQuY2F0ZWdvcnlJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgYXdhaXQgdmFsaWRhdGVDYXRlZ29yeShwYXlsb2FkLmNhdGVnb3J5SWQpO1xuICB9XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlSW5wdXQgPSB7XG4gICAgLi4uKHBheWxvYWQudGl0bGUgIT09IHVuZGVmaW5lZCA/IHsgdGl0bGU6IHBheWxvYWQudGl0bGUgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5kZXNjcmlwdGlvbiAhPT0gdW5kZWZpbmVkID8geyBkZXNjcmlwdGlvbjogcGF5bG9hZC5kZXNjcmlwdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmxvY2F0aW9uICE9PSB1bmRlZmluZWQgPyB7IGxvY2F0aW9uOiBwYXlsb2FkLmxvY2F0aW9uIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQucHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgcHJpY2U6IHBheWxvYWQucHJpY2UgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5kdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8geyBkdXJhdGlvbjogcGF5bG9hZC5kdXJhdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmltYWdlcyAhPT0gdW5kZWZpbmVkID8geyBpbWFnZXM6IHBheWxvYWQuaW1hZ2VzIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuY2F0ZWdvcnlJZCAhPT0gdW5kZWZpbmVkXG4gICAgICA/IHsgY2F0ZWdvcnk6IHsgY29ubmVjdDogeyBpZDogcGF5bG9hZC5jYXRlZ29yeUlkIH0gfSB9XG4gICAgICA6IHt9KSxcbiAgICAuLi4odXNlci5yb2xlICE9PSBSb2xlLkFETUlOID8geyBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuUEVORElORyB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YSxcbiAgICBpbmNsdWRlOiB7IGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0gfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKHVwZGF0ZWQpO1xufTtcblxuLy8gNy4gQXBwcm92ZS9yZWplY3QgYSBwYWNrYWdlIChhZG1pbikuXG5jb25zdCBjaGFuZ2VQYWNrYWdlU3RhdHVzID0gYXN5bmMgKFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVN0YXR1c1BheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZFVuaXF1ZU9yVGhyb3coe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG5cbiAgaWYgKHRvdXJQYWNrYWdlLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiQ2Fubm90IGNoYW5nZSB0aGUgc3RhdHVzIG9mIGEgZGVsZXRlZCBwYWNrYWdlLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YTogeyBzdGF0dXM6IHBheWxvYWQuc3RhdHVzIH0sXG4gIH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IGluLWFwcCBub3RpZmljYXRpb24gdG8gdGhlIHN1Ym1pdHRpbmcgYWdlbnQgKG5ldmVyIGZhaWxzIHJlcXVlc3QpXG4gIGNvbnN0IG5vdGlmaWVkID0ge1xuICAgIHR5cGU6XG4gICAgICBwYXlsb2FkLnN0YXR1cyA9PT0gUGFja2FnZVN0YXR1cy5BUFBST1ZFRFxuICAgICAgICA/IE5vdGlmaWNhdGlvblR5cGUuUEFDS0FHRV9BUFBST1ZFRFxuICAgICAgICA6IE5vdGlmaWNhdGlvblR5cGUuUEFDS0FHRV9SRUpFQ1RFRCxcbiAgICB0aXRsZTpcbiAgICAgIHBheWxvYWQuc3RhdHVzID09PSBQYWNrYWdlU3RhdHVzLkFQUFJPVkVEXG4gICAgICAgID8gXCJQYWNrYWdlIGFwcHJvdmVkXCJcbiAgICAgICAgOiBcIlBhY2thZ2UgcmVqZWN0ZWRcIixcbiAgICBtZXNzYWdlOlxuICAgICAgcGF5bG9hZC5zdGF0dXMgPT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgICAgICAgPyBgWW91ciBwYWNrYWdlIFwiJHt0b3VyUGFja2FnZS50aXRsZX1cIiBoYXMgYmVlbiBhcHByb3ZlZCBhbmQgaXMgbm93IGxpdmUuYFxuICAgICAgICA6IGBZb3VyIHBhY2thZ2UgXCIke3RvdXJQYWNrYWdlLnRpdGxlfVwiIHdhcyByZWplY3RlZC4gUGxlYXNlIHJldmlldyBhbmQgcmVzdWJtaXQuYCxcbiAgfTtcbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIG5vdGlmeShcbiAgICAgIHRvdXJQYWNrYWdlLmFnZW50SWQsXG4gICAgICBub3RpZmllZC50eXBlLFxuICAgICAgbm90aWZpZWQudGl0bGUsXG4gICAgICBub3RpZmllZC5tZXNzYWdlLFxuICAgICAgYC9kYXNoYm9hcmQvYWdlbnQvcGFja2FnZXMvJHtwYWNrYWdlSWR9YCxcbiAgICApLFxuICBdKTtcblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UodXBkYXRlZCk7XG59O1xuXG4vLyA4LiBTb2Z0IGRlbGV0ZSAoYWRtaW4gYW55LCBhZ2VudCBvd24pLlxuY29uc3Qgc29mdERlbGV0ZVBhY2thZ2UgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYWNrYWdlSWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBmaW5kT3duZWRQYWNrYWdlKHVzZXIsIHBhY2thZ2VJZCk7XG5cbiAgcmV0dXJuIHByaXNtYS50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSB9LFxuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlU2VydmljZSA9IHtcbiAgY3JlYXRlUGFja2FnZSxcbiAgZ2V0UHVibGljUGFja2FnZXMsXG4gIGdldFBhY2thZ2VCeVNsdWcsXG4gIGdldEFsbFBhY2thZ2VzLFxuICBnZXRNeVBhY2thZ2VzLFxuICB1cGRhdGVQYWNrYWdlLFxuICBjaGFuZ2VQYWNrYWdlU3RhdHVzLFxuICBzb2Z0RGVsZXRlUGFja2FnZSxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IHRpdGxlU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVGl0bGUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMywgXCJUaXRsZSBtdXN0IGJlIGF0IGxlYXN0IDMgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJUaXRsZSBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGRlc2NyaXB0aW9uU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRGVzY3JpcHRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMTAsIFwiRGVzY3JpcHRpb24gbXVzdCBiZSBhdCBsZWFzdCAxMCBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMTAwMDAsIFwiRGVzY3JpcHRpb24gbXVzdCBiZSBhdCBtb3N0IDEwMDAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGxvY2F0aW9uU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTG9jYXRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMiwgXCJMb2NhdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJMb2NhdGlvbiBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IHByaWNlU2NoZW1hID0gelxuICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiUHJpY2UgaXMgcmVxdWlyZWRcIiB9KVxuICAucG9zaXRpdmUoXCJQcmljZSBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIpXG4gIC5yZWZpbmUoKHZhbCkgPT4gTWF0aC5yb3VuZCh2YWwgKiAxMDApIC8gMTAwID09PSB2YWwsIHtcbiAgICBtZXNzYWdlOiBcIlByaWNlIG11c3QgaGF2ZSBhdCBtb3N0IDIgZGVjaW1hbCBwbGFjZXNcIixcbiAgfSk7XG5cbmNvbnN0IGR1cmF0aW9uU2NoZW1hID0gelxuICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiRHVyYXRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAuaW50KFwiRHVyYXRpb24gbXVzdCBiZSBhIHdob2xlIG51bWJlciBvZiBkYXlzXCIpXG4gIC5taW4oMSwgXCJEdXJhdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDEgZGF5XCIpO1xuXG5jb25zdCBjYXRlZ29yeUlkU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ2F0ZWdvcnkgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAubWluKDEsIFwiQ2F0ZWdvcnkgaWQgbXVzdCBub3QgYmUgZW1wdHlcIik7XG5cbmNvbnN0IGltYWdlc1NjaGVtYSA9IHpcbiAgLmFycmF5KHouc3RyaW5nKCkudXJsKFwiRWFjaCBpbWFnZSBtdXN0IGJlIGEgdmFsaWQgVVJMXCIpKVxuICAubWluKDEsIFwiQXQgbGVhc3Qgb25lIGltYWdlIGlzIHJlcXVpcmVkXCIpXG4gIC5tYXgoNiwgXCJBdCBtb3N0IDYgaW1hZ2VzIGFyZSBhbGxvd2VkXCIpO1xuXG5jb25zdCBjcmVhdGVQYWNrYWdlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEsXG4gICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uU2NoZW1hLFxuICAgIGxvY2F0aW9uOiBsb2NhdGlvblNjaGVtYSxcbiAgICBwcmljZTogcHJpY2VTY2hlbWEsXG4gICAgZHVyYXRpb246IGR1cmF0aW9uU2NoZW1hLFxuICAgIGNhdGVnb3J5SWQ6IGNhdGVnb3J5SWRTY2hlbWEsXG4gICAgaW1hZ2VzOiBpbWFnZXNTY2hlbWEsXG4gICAgYWdlbnRJZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVQYWNrYWdlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBsb2NhdGlvbjogbG9jYXRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBwcmljZTogcHJpY2VTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBkdXJhdGlvbjogZHVyYXRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBjYXRlZ29yeUlkOiBjYXRlZ29yeUlkU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgaW1hZ2VzOiBpbWFnZXNTY2hlbWEub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IE9iamVjdC5rZXlzKGRhdGEpLmxlbmd0aCA+IDAsIHtcbiAgICBtZXNzYWdlOiBcIkF0IGxlYXN0IG9uZSBmaWVsZCBtdXN0IGJlIHByb3ZpZGVkIHRvIHVwZGF0ZVwiLFxuICB9KTtcblxuY29uc3QgcGFja2FnZVF1ZXJ5U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gICAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBjYXRlZ29yeTogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgbG9jYXRpb246IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIG1pblByaWNlOiB6LmNvZXJjZS5udW1iZXIoKS5wb3NpdGl2ZSgpLm9wdGlvbmFsKCksXG4gICAgbWF4UHJpY2U6IHouY29lcmNlLm51bWJlcigpLnBvc2l0aXZlKCkub3B0aW9uYWwoKSxcbiAgICBtaW5SYXRpbmc6IHouY29lcmNlLm51bWJlcigpLm1pbigwKS5tYXgoNSkub3B0aW9uYWwoKSxcbiAgICBtYXhEdXJhdGlvbjogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm9wdGlvbmFsKCksXG4gICAgc29ydEJ5OiB6XG4gICAgICAuZW51bShbXCJuZXdlc3RcIiwgXCJwcmljZVwiLCBcInJhdGluZ1wiLCBcInRpdGxlXCJdKVxuICAgICAgLmRlZmF1bHQoXCJuZXdlc3RcIiksXG4gICAgc29ydE9yZGVyOiB6LmVudW0oW1wiYXNjXCIsIFwiZGVzY1wiXSkub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnJlZmluZSgoZGF0YSkgPT4ge1xuICAgIGlmIChkYXRhLm1pblByaWNlICE9PSB1bmRlZmluZWQgJiYgZGF0YS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gZGF0YS5taW5QcmljZSA8PSBkYXRhLm1heFByaWNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSwge1xuICAgIG1lc3NhZ2U6IFwibWluUHJpY2UgbXVzdCBiZSBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gbWF4UHJpY2VcIixcbiAgICBwYXRoOiBbXCJtaW5QcmljZVwiXSxcbiAgfSk7XG5cbmNvbnN0IGludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBzdGF0dXM6IHpcbiAgICAuZW51bShbXCJQRU5ESU5HXCIsIFwiQVBQUk9WRURcIiwgXCJSRUpFQ1RFRFwiXSlcbiAgICAudHJhbnNmb3JtKCh2YWwpID0+IHZhbCBhcyBcIlBFTkRJTkdcIiB8IFwiQVBQUk9WRURcIiB8IFwiUkVKRUNURURcIilcbiAgICAub3B0aW9uYWwoKSxcbiAgYWdlbnRJZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBwYWNrYWdlUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IHBhY2thZ2VTbHVnUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBzbHVnOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2Ugc2x1ZyBpcyByZXF1aXJlZFwiIH0pLnRyaW0oKS5taW4oMSksXG59KTtcblxuY29uc3QgdXBkYXRlU3RhdHVzU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBzdGF0dXM6IHouZW51bShbXCJBUFBST1ZFRFwiLCBcIlJFSkVDVEVEXCJdLCB7XG4gICAgICByZXF1aXJlZF9lcnJvcjogXCJTdGF0dXMgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJTdGF0dXMgbXVzdCBiZSBBUFBST1ZFRCBvciBSRUpFQ1RFRFwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlVmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVBhY2thZ2VTY2hlbWEsXG4gIHVwZGF0ZVBhY2thZ2VTY2hlbWEsXG4gIHBhY2thZ2VRdWVyeVNjaGVtYSxcbiAgaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEsXG4gIHBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gIHBhY2thZ2VTbHVnUGFyYW1zU2NoZW1hLFxuICB1cGRhdGVTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgYmxvZ0NvbnRyb2xsZXIgfSBmcm9tIFwiLi9ibG9nLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGJsb2dWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2Jsb2cudmFsaWRhdGlvblwiO1xuaW1wb3J0IHsgYmxvZ0NvbW1lbnRDb250cm9sbGVyIH0gZnJvbSBcIi4vYmxvZ0NvbW1lbnQuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYmxvZ0NvbW1lbnRWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2Jsb2dDb21tZW50LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE5PVEU6IGAvaW50ZXJuYWwvKmAgcm91dGVzIE1VU1Qgc3RheSByZWdpc3RlcmVkIGJlZm9yZSBgR0VUIC86c2x1Z2AgYmVsb3cgXHUyMDE0XG4vLyBFeHByZXNzIG1hdGNoZXMgdG9wLWRvd24sIGFuZCBhIGxpdGVyYWwgc2VnbWVudCAoYC9pbnRlcm5hbC9hbGxgKSB3b3VsZFxuLy8gb3RoZXJ3aXNlIGJlIHN3YWxsb3dlZCBieSB0aGUgYDpzbHVnYCBwYXJhbSByb3V0ZSBhbmQgNDA0IGZvcmV2ZXIuXG5cbi8vIDEuIEFsbCBwb3N0cyAoYWRtaW4gbW9kZXJhdGlvbiBVSSkgXHUyMDE0IHJlZ2lzdGVyZWQgYmVmb3JlIC86c2x1Z1xucm91dGVyLmdldChcbiAgXCIvaW50ZXJuYWwvYWxsXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBibG9nVmFsaWRhdGlvbnMuaW50ZXJuYWxRdWVyeVNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0QWxsUG9zdHMsXG4pO1xuXG4vLyAxYi4gT3duIHBvc3RzIChcIk15IFBvc3RzXCIgVUkgZm9yIGFnZW50cy9hZG1pbnMpIFx1MjAxNCBiZWZvcmUgLzpzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi9teS1wb3N0c1wiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLmludGVybmFsUXVlcnlTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldE15UG9zdHMsXG4pO1xuXG4vLyAyLiBQdWJsaWMgbGlzdGluZyBcdTIwMTQgUFVCTElTSEVEICsgbm90LWRlbGV0ZWQgb25seVxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBibG9nVmFsaWRhdGlvbnMucHVibGljUXVlcnlTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldFB1YmxpY1Bvc3RzLFxuKTtcblxuLy8gMy4gUHVibGljIHBvc3QgZGV0YWlsIGJ5IHNsdWdcbnJvdXRlci5nZXQoXG4gIFwiLzpzbHVnXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RTbHVnUGFyYW1zU2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRQb3N0QnlTbHVnLFxuKTtcblxuLy8gNC4gQ3JlYXRlIHBvc3QgKGFnZW50L2FkbWluIGF1dGhvcnMgb3duIHBvc3RzOyBuZXcgcG9zdHMgc3RhcnQgRFJBRlQpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGJsb2dWYWxpZGF0aW9ucy5jcmVhdGVQb3N0U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5jcmVhdGVQb3N0LFxuKTtcblxuLy8gXHUyNTAwXHUyNTAwIENvbW1lbnRzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gTk9URTogdGhpcyBibG9jayBzdGF5cyBiZWZvcmUgUEFUQ0ggLzppZC9zdGF0dXMgc28gREVMRVRFIC9jb21tZW50cy86aWQgaXNcbi8vIG5ldmVyIHNoYWRvd2VkIFx1MjAxNCBhbmQgbm8gYmFyZSBQQVRDSCAvOnNsdWcgb3IgREVMRVRFIC86c2x1ZyBpcyBldmVyIGFkZGVkLlxuXG4vLyA0YS4gUHVibGljIGNvbW1lbnRzIGZvciBhIHBvc3QgKFBVQkxJU0hFRCArIG5vbi1kZWxldGVkIHBvc3Qgb25seSlcbnJvdXRlci5nZXQoXG4gIFwiLzpzbHVnL2NvbW1lbnRzXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFNsdWdQYXJhbXNTY2hlbWEsXG4gICAgcXVlcnk6IGJsb2dDb21tZW50VmFsaWRhdGlvbnMuY29tbWVudFF1ZXJ5U2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbW1lbnRDb250cm9sbGVyLmdldFBvc3RDb21tZW50cyxcbik7XG5cbi8vIDRiLiBDcmVhdGUgYSBjb21tZW50IChhbnkgYXV0aGVudGljYXRlZCB1c2VyKVxucm91dGVyLnBvc3QoXG4gIFwiLzpzbHVnL2NvbW1lbnRzXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0U2x1Z1BhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBibG9nQ29tbWVudFZhbGlkYXRpb25zLmNyZWF0ZUNvbW1lbnRTY2hlbWEsXG4gIH0pLFxuICBibG9nQ29tbWVudENvbnRyb2xsZXIuY3JlYXRlQ29tbWVudCxcbik7XG5cbi8vIDRjLiBTb2Z0IGRlbGV0ZSBhIGNvbW1lbnQgKG93bmVyIG9yIEFETUlOKVxucm91dGVyLmRlbGV0ZShcbiAgXCIvY29tbWVudHMvOmlkXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBibG9nQ29tbWVudFZhbGlkYXRpb25zLmNvbW1lbnRQYXJhbXNTY2hlbWEgfSksXG4gIGJsb2dDb21tZW50Q29udHJvbGxlci5kZWxldGVDb21tZW50LFxuKTtcblxuLy8gNS4gUHVibGlzaC91bnB1Ymxpc2ggcG9zdCAoYWRtaW4pIFx1MjAxNCByZWdpc3RlcmVkIGJlZm9yZSBQQVRDSCAvOmlkIGZvciBjbGFyaXR5XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJsb2dWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBibG9nQ29udHJvbGxlci5jaGFuZ2VQb3N0U3RhdHVzLFxuKTtcblxuLy8gNi4gVXBkYXRlIHBvc3QgKGFnZW50IG93biAvIGFkbWluIGFueSkgXHUyMDE0IGFnZW50IGVkaXRzIHJlc2V0IHRvIERSQUZUXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogYmxvZ1ZhbGlkYXRpb25zLnVwZGF0ZVBvc3RTY2hlbWEsXG4gIH0pLFxuICBibG9nQ29udHJvbGxlci51cGRhdGVQb3N0LFxuKTtcblxuLy8gNy4gU29mdCBkZWxldGUgcG9zdCAoYWdlbnQgb3duIC8gYWRtaW4gYW55KVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RQYXJhbXNTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLnNvZnREZWxldGVQb3N0LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJsb2dSb3V0ZXMgPSByb3V0ZXI7XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGJsb2dTZXJ2aWNlIH0gZnJvbSBcIi4vYmxvZy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIHBvc3QgY29udHJvbGxlciAoQUdFTlQvQURNSU4pXG5jb25zdCBjcmVhdGVQb3N0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuY3JlYXRlUG9zdChyZXEudXNlciEsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgY3JlYXRlZCBzdWNjZXNzZnVsbHkuIEl0IHdpbGwgYmUgdmlzaWJsZSBhZnRlciBwdWJsaXNoaW5nLlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgY29udHJvbGxlciAoc2VhcmNoICsgc29ydCArIHBhZ2luYXRpb24pXG5jb25zdCBnZXRQdWJsaWNQb3N0cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldFB1YmxpY1Bvc3RzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBQdWJsaWMgcG9zdCBkZXRhaWwgYnkgc2x1Z1xuY29uc3QgZ2V0UG9zdEJ5U2x1ZyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHNsdWcgPSBTdHJpbmcocmVxLnBhcmFtcy5zbHVnKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRQb3N0QnlTbHVnKHNsdWcpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIEFsbCBwb3N0cyBjb250cm9sbGVyIChBRE1JTiBtb2RlcmF0aW9uKVxuY29uc3QgZ2V0QWxsUG9zdHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRBbGxQb3N0cyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBwb3N0cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDRiLiBPd24gcG9zdHMgY29udHJvbGxlciAoQUdFTlQvQURNSU4pXG5jb25zdCBnZXRNeVBvc3RzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0TXlQb3N0cyhyZXEudXNlciEsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA1LiBVcGRhdGUgcG9zdCBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCB1cGRhdGVQb3N0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UudXBkYXRlUG9zdChyZXEudXNlciEsIGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDYuIENoYW5nZSBwb3N0IHN0YXR1cyBjb250cm9sbGVyIChBRE1JTiBwdWJsaXNoL3VucHVibGlzaClcbmNvbnN0IGNoYW5nZVBvc3RTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5jaGFuZ2VQb3N0U3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSBwb3N0IGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHNvZnREZWxldGVQb3N0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgYXdhaXQgYmxvZ1NlcnZpY2Uuc29mdERlbGV0ZVBvc3QocmVxLnVzZXIhLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYmxvZ0NvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBvc3QsXG4gIGdldFB1YmxpY1Bvc3RzLFxuICBnZXRQb3N0QnlTbHVnLFxuICBnZXRBbGxQb3N0cyxcbiAgZ2V0TXlQb3N0cyxcbiAgdXBkYXRlUG9zdCxcbiAgY2hhbmdlUG9zdFN0YXR1cyxcbiAgc29mdERlbGV0ZVBvc3QsXG59O1xuIiwgImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcbmltcG9ydCB7IFBvc3RTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2x1Z2lmeVwiO1xuaW1wb3J0IHtcbiAgSUNyZWF0ZVBvc3RQYXlsb2FkLFxuICBJSW50ZXJuYWxQb3N0UXVlcnksXG4gIElQb3N0UXVlcnksXG4gIElSZXF1ZXN0VXNlcixcbiAgSVVwZGF0ZVBvc3RQYXlsb2FkLFxuICBJVXBkYXRlUG9zdFN0YXR1c1BheWxvYWQsXG59IGZyb20gXCIuL2Jsb2cuaW50ZXJmYWNlXCI7XG5cbi8vIFB1YmxpYyBwYXlsb2FkcyBjYXJyeSB0aGUgYXV0aG9yJ3MgZGlzcGxheSBpbmZvIG9ubHkgXHUyMDE0IG5ldmVyIGVtYWlsL3JvbGUuXG5leHBvcnQgY29uc3QgcHVibGljQXV0aG9yU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGF2YXRhclVybDogdHJ1ZSB9LFxufTtcblxuLy8gQ29sbGlzaW9uLXNhZmUgc2x1ZzogYmFzZSBzbHVnIGZyb20gdGhlIHRpdGxlLCB0aGVuIGAtMmAsIGAtM2AsIC4uLiB1c2luZyBhXG4vLyBzaW5nbGUgcHJlZml4IHF1ZXJ5LiBQdXJlLUJhbmdsYS9lbW9qaSB0aXRsZXMgY2FuJ3Qgc2x1Z2lmeSBcdTIwMTQgZmFsbCBiYWNrIHRvXG4vLyBgYmxvZy08c2hvcnRJZD5gIHNvIHRoZSBVUkwgaXMgYWx3YXlzIG1lYW5pbmdmdWwuXG5jb25zdCBnZW5lcmF0ZVVuaXF1ZVNsdWcgPSBhc3luYyAodGl0bGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gIGNvbnN0IGJhc2UgPSBzbHVnaWZ5KHRpdGxlKSB8fCBgYmxvZy0ke3JhbmRvbVVVSUQoKS5zbGljZSgwLCA4KX1gO1xuXG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICB3aGVyZTogeyBzbHVnOiB7IHN0YXJ0c1dpdGg6IGJhc2UgfSB9LFxuICAgIHNlbGVjdDogeyBzbHVnOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGNvbnN0IHVzZWQgPSBuZXcgU2V0KGV4aXN0aW5nLm1hcCgocCkgPT4gcC5zbHVnKSk7XG4gIGlmICghdXNlZC5oYXMoYmFzZSkpIHtcbiAgICByZXR1cm4gYmFzZTtcbiAgfVxuXG4gIGxldCBzdWZmaXggPSAyO1xuICB3aGlsZSAodXNlZC5oYXMoYCR7YmFzZX0tJHtzdWZmaXh9YCkpIHtcbiAgICBzdWZmaXggKz0gMTtcbiAgfVxuICByZXR1cm4gYCR7YmFzZX0tJHtzdWZmaXh9YDtcbn07XG5cbi8vIDEuIENyZWF0ZSBhIHBvc3QgKEFHRU5UL0FETUlOKS4gTmV3IHBvc3RzIHN0YXJ0IERSQUZUIGFuZCBuZXZlciBsZWFrIGludG9cbi8vICAgIHB1YmxpYyBxdWVyaWVzIHVudGlsIGFuIGFkbWluIHB1Ymxpc2hlcyB0aGVtLlxuY29uc3QgY3JlYXRlUG9zdCA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBheWxvYWQ6IElDcmVhdGVQb3N0UGF5bG9hZCkgPT4ge1xuICBjb25zdCBzbHVnID0gYXdhaXQgZ2VuZXJhdGVVbmlxdWVTbHVnKHBheWxvYWQudGl0bGUpO1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICB0aXRsZTogcGF5bG9hZC50aXRsZSxcbiAgICAgIGV4Y2VycHQ6IHBheWxvYWQuZXhjZXJwdCxcbiAgICAgIGNvbnRlbnQ6IHBheWxvYWQuY29udGVudCxcbiAgICAgIGNvdmVySW1hZ2U6IHBheWxvYWQuY292ZXJJbWFnZSxcbiAgICAgIHNsdWcsXG4gICAgICBhdXRob3JJZDogdXNlci5pZCxcbiAgICB9LFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG59O1xuXG4vLyAyLiBQdWJsaWMgYmxvZyBsaXN0aW5nIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5LCBzZWFyY2ggKyBzb3J0LlxuY29uc3QgZ2V0UHVibGljUG9zdHMgPSBhc3luYyAocXVlcnk6IElQb3N0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkJsb2dQb3N0V2hlcmVJbnB1dCA9IHtcbiAgICBzdGF0dXM6IFBvc3RTdGF0dXMuUFVCTElTSEVELFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnNlYXJjaFxuICAgICAgPyB7XG4gICAgICAgICAgT1I6IFtcbiAgICAgICAgICAgIHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgICAgIHsgZXhjZXJwdDogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH1cbiAgICAgIDoge30pLFxuICB9O1xuXG4gIGNvbnN0IHNvcnRPcmRlciA9IHF1ZXJ5LnNvcnRPcmRlciA/PyAocXVlcnkuc29ydEJ5ID09PSBcIm9sZGVzdFwiID8gXCJhc2NcIiA6IFwiZGVzY1wiKTtcblxuICBjb25zdCBvcmRlckJ5TWFwOiBSZWNvcmQ8c3RyaW5nLCBQcmlzbWEuQmxvZ1Bvc3RPcmRlckJ5V2l0aFJlbGF0aW9uSW5wdXQ+ID0ge1xuICAgIG5ld2VzdDogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgb2xkZXN0OiB7IGNyZWF0ZWRBdDogXCJhc2NcIiB9LFxuICAgIHRpdGxlOiB7IHRpdGxlOiBzb3J0T3JkZXIgfSxcbiAgfTtcblxuICBjb25zdCBvcmRlckJ5ID0gb3JkZXJCeU1hcFtxdWVyeS5zb3J0QnkgPz8gXCJuZXdlc3RcIl0gPz8gb3JkZXJCeU1hcC5uZXdlc3Q7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5LFxuICAgICAgc2VsZWN0OiB7XG4gICAgICAgIGlkOiB0cnVlLFxuICAgICAgICB0aXRsZTogdHJ1ZSxcbiAgICAgICAgc2x1ZzogdHJ1ZSxcbiAgICAgICAgZXhjZXJwdDogdHJ1ZSxcbiAgICAgICAgY292ZXJJbWFnZTogdHJ1ZSxcbiAgICAgICAgY3JlYXRlZEF0OiB0cnVlLFxuICAgICAgICB1cGRhdGVkQXQ6IHRydWUsXG4gICAgICAgIGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0LFxuICAgICAgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5LlxuY29uc3QgZ2V0UG9zdEJ5U2x1ZyA9IGFzeW5jIChzbHVnOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7IHNsdWcsIHN0YXR1czogUG9zdFN0YXR1cy5QVUJMSVNIRUQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xuXG4gIGlmICghcG9zdCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUG9zdCBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc3Q7XG59O1xuXG4vLyA0LiBBbGwgcG9zdHMgZm9yIHRoZSBhZG1pbiBtb2RlcmF0aW9uIFVJIChhbnkgc3RhdHVzLCBvcHRpb25hbCBmaWx0ZXIpLlxuY29uc3QgZ2V0QWxsUG9zdHMgPSBhc3luYyAocXVlcnk6IElJbnRlcm5hbFBvc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQmxvZ1Bvc3RXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgYXV0aG9yOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDRiLiBUaGUgY2FsbGVyJ3Mgb3duIHBvc3RzIChBR0VOVC9BRE1JTiBcIk15IFBvc3RzXCIgVUkpIFx1MjAxNCBhbnkgc3RhdHVzLCBzaW5jZVxuLy8gICAgIGFnZW50cyBtdXN0IHNlZSB0aGVpciBvd24gZHJhZnRzIGJlZm9yZSBhbiBhZG1pbiBwdWJsaXNoZXMgdGhlbS5cbmNvbnN0IGdldE15UG9zdHMgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBxdWVyeTogSUludGVybmFsUG9zdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5CbG9nUG9zdFdoZXJlSW5wdXQgPSB7XG4gICAgYXV0aG9ySWQ6IHVzZXIuaWQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc3RhdHVzID8geyBzdGF0dXM6IHF1ZXJ5LnN0YXR1cyB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBhdXRob3I6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0gfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nUG9zdC5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gRmV0Y2ggKyBvd25lcnNoaXAgZ2F0ZSBzaGFyZWQgYnkgUEFUQ0ggYW5kIERFTEVURS4gQURNSU4gYnlwYXNzZXMgb3duZXJzaGlwO1xuLy8gQUdFTlQgZWRpdHMgYXJlIGNvbmZpbmVkIHRvIHRoZWlyIG93biBwb3N0cy5cbmNvbnN0IGZpbmRPd25lZFBvc3QgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwb3N0SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgfSk7XG5cbiAgaWYgKCFwb3N0KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQb3N0IG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBpZiAodXNlci5yb2xlICE9PSBSb2xlLkFETUlOICYmIHBvc3QuYXV0aG9ySWQgIT09IHVzZXIuaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW4gb25seSBhY3Qgb24geW91ciBvd24gcG9zdHMuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc3Q7XG59O1xuXG4vLyA1LiBVcGRhdGUgYSBwb3N0LiBTbHVnIG5ldmVyIGNoYW5nZXMgKGtlZXBzIGxpbmtzL2Jvb2ttYXJrcyB2YWxpZCkuXG4vLyAgICBBR0VOVCBlZGl0cyByZXNldCBzdGF0dXMgdG8gRFJBRlQgKHJlLXB1Ymxpc2ggdmlhIC86aWQvc3RhdHVzKTtcbi8vICAgIEFETUlOIGVkaXRzIHByZXNlcnZlIHN0YXR1cy5cbmNvbnN0IHVwZGF0ZVBvc3QgPSBhc3luYyAoXG4gIHVzZXI6IElSZXF1ZXN0VXNlcixcbiAgcG9zdElkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQb3N0UGF5bG9hZCxcbikgPT4ge1xuICBhd2FpdCBmaW5kT3duZWRQb3N0KHVzZXIsIHBvc3RJZCk7XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLkJsb2dQb3N0VXBkYXRlSW5wdXQgPSB7XG4gICAgLi4uKHBheWxvYWQudGl0bGUgIT09IHVuZGVmaW5lZCA/IHsgdGl0bGU6IHBheWxvYWQudGl0bGUgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5leGNlcnB0ICE9PSB1bmRlZmluZWQgPyB7IGV4Y2VycHQ6IHBheWxvYWQuZXhjZXJwdCB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNvbnRlbnQgIT09IHVuZGVmaW5lZCA/IHsgY29udGVudDogcGF5bG9hZC5jb250ZW50IH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuY292ZXJJbWFnZSAhPT0gdW5kZWZpbmVkXG4gICAgICA/IHsgY292ZXJJbWFnZTogcGF5bG9hZC5jb3ZlckltYWdlIH1cbiAgICAgIDoge30pLFxuICAgIC4uLih1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gPyB7IHN0YXR1czogUG9zdFN0YXR1cy5EUkFGVCB9IDoge30pLFxuICB9O1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gNi4gUHVibGlzaC91bnB1Ymxpc2ggYSBwb3N0IChhZG1pbikuXG5jb25zdCBjaGFuZ2VQb3N0U3RhdHVzID0gYXN5bmMgKFxuICBwb3N0SWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVBvc3RTdGF0dXNQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHBvc3QgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZFVuaXF1ZU9yVGhyb3coe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgfSk7XG5cbiAgaWYgKHBvc3QuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDYW5ub3QgY2hhbmdlIHRoZSBzdGF0dXMgb2YgYSBkZWxldGVkIHBvc3QuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgICBkYXRhOiB7IHN0YXR1czogcGF5bG9hZC5zdGF0dXMgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gNy4gU29mdCBkZWxldGUgKGFkbWluIGFueSwgYWdlbnQgb3duKS5cbmNvbnN0IHNvZnREZWxldGVQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcG9zdElkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUG9zdCh1c2VyLCBwb3N0SWQpO1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgYmxvZ1NlcnZpY2UgPSB7XG4gIGNyZWF0ZVBvc3QsXG4gIGdldFB1YmxpY1Bvc3RzLFxuICBnZXRQb3N0QnlTbHVnLFxuICBnZXRBbGxQb3N0cyxcbiAgZ2V0TXlQb3N0cyxcbiAgdXBkYXRlUG9zdCxcbiAgY2hhbmdlUG9zdFN0YXR1cyxcbiAgc29mdERlbGV0ZVBvc3QsXG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IHRpdGxlU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVGl0bGUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMywgXCJUaXRsZSBtdXN0IGJlIGF0IGxlYXN0IDMgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJUaXRsZSBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGV4Y2VycHRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFeGNlcnB0IGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEsIFwiRXhjZXJwdCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAubWF4KDUwMCwgXCJFeGNlcnB0IG11c3QgYmUgYXQgbW9zdCA1MDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY29udGVudFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbnRlbnQgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMSwgXCJDb250ZW50IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gIC5tYXgoMTAwMDAsIFwiQ29udGVudCBtdXN0IGJlIGF0IG1vc3QgMTAwMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY292ZXJJbWFnZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvdmVyIGltYWdlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnVybChcIkNvdmVyIGltYWdlIG11c3QgYmUgYSB2YWxpZCBVUkxcIik7XG5cbmNvbnN0IGNyZWF0ZVBvc3RTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYSxcbiAgICBleGNlcnB0OiBleGNlcnB0U2NoZW1hLFxuICAgIGNvbnRlbnQ6IGNvbnRlbnRTY2hlbWEsXG4gICAgY292ZXJJbWFnZTogY292ZXJJbWFnZVNjaGVtYSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVQb3N0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBleGNlcnB0OiBleGNlcnB0U2NoZW1hLm9wdGlvbmFsKCksXG4gICAgY29udGVudDogY29udGVudFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNvdmVySW1hZ2U6IGNvdmVySW1hZ2VTY2hlbWEub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IE9iamVjdC5rZXlzKGRhdGEpLmxlbmd0aCA+IDAsIHtcbiAgICBtZXNzYWdlOiBcIkF0IGxlYXN0IG9uZSBmaWVsZCBtdXN0IGJlIHByb3ZpZGVkIHRvIHVwZGF0ZVwiLFxuICB9KTtcblxuY29uc3QgcG9zdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUG9zdCBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBwb3N0U2x1Z1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc2x1Zzogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQb3N0IHNsdWcgaXMgcmVxdWlyZWRcIiB9KS50cmltKCkubWluKDEpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgc3RhdHVzOiB6LmVudW0oW1wiRFJBRlRcIiwgXCJQVUJMSVNIRURcIl0sIHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcIlN0YXR1cyBpcyByZXF1aXJlZFwiLFxuICAgICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlN0YXR1cyBtdXN0IGJlIERSQUZUIG9yIFBVQkxJU0hFRFwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHB1YmxpY1F1ZXJ5U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gICAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBzb3J0Qnk6IHouZW51bShbXCJuZXdlc3RcIiwgXCJvbGRlc3RcIiwgXCJ0aXRsZVwiXSkuZGVmYXVsdChcIm5ld2VzdFwiKSxcbiAgICBzb3J0T3JkZXI6IHouZW51bShbXCJhc2NcIiwgXCJkZXNjXCJdKS5vcHRpb25hbCgpLFxuICB9KTtcblxuY29uc3QgaW50ZXJuYWxRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHN0YXR1czogelxuICAgICAgLmVudW0oW1wiRFJBRlRcIiwgXCJQVUJMSVNIRURcIl0pXG4gICAgICAudHJhbnNmb3JtKCh2YWwpID0+IHZhbCBhcyBcIkRSQUZUXCIgfCBcIlBVQkxJU0hFRFwiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gIH0pO1xuXG5leHBvcnQgY29uc3QgYmxvZ1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVQb3N0U2NoZW1hLFxuICB1cGRhdGVQb3N0U2NoZW1hLFxuICBwb3N0UGFyYW1zU2NoZW1hLFxuICBwb3N0U2x1Z1BhcmFtc1NjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxuICBwdWJsaWNRdWVyeVNjaGVtYSxcbiAgaW50ZXJuYWxRdWVyeVNjaGVtYSxcbn07XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGJsb2dDb21tZW50U2VydmljZSB9IGZyb20gXCIuL2Jsb2dDb21tZW50LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBQdWJsaWMgY29tbWVudHMgZm9yIGEgcG9zdCBjb250cm9sbGVyXG5jb25zdCBnZXRQb3N0Q29tbWVudHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ0NvbW1lbnRTZXJ2aWNlLmdldFBvc3RDb21tZW50cyhzbHVnLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNvbW1lbnRzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gQ3JlYXRlIGEgY29tbWVudCBjb250cm9sbGVyIChhbnkgYXV0aGVudGljYXRlZCB1c2VyKVxuY29uc3QgY3JlYXRlQ29tbWVudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHNsdWcgPSBTdHJpbmcocmVxLnBhcmFtcy5zbHVnKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nQ29tbWVudFNlcnZpY2UuY3JlYXRlQ29tbWVudCh1c2VySWQsIHNsdWcsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIkNvbW1lbnQgcG9zdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFNvZnQgZGVsZXRlIGNvbW1lbnQgY29udHJvbGxlciAob3duZXIgb3IgQURNSU4pXG5jb25zdCBkZWxldGVDb21tZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3Qgcm9sZSA9IHJlcS51c2VyIS5yb2xlO1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGF3YWl0IGJsb2dDb21tZW50U2VydmljZS5kZWxldGVDb21tZW50KHVzZXJJZCwgcm9sZSwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNvbW1lbnQgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJsb2dDb21tZW50Q29udHJvbGxlciA9IHtcbiAgZ2V0UG9zdENvbW1lbnRzLFxuICBjcmVhdGVDb21tZW50LFxuICBkZWxldGVDb21tZW50LFxufTsiLCAiaW1wb3J0IHsgUG9zdFN0YXR1cywgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgcHVibGljQXV0aG9yU2VsZWN0IH0gZnJvbSBcIi4vYmxvZy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBJQ3JlYXRlQ29tbWVudFBheWxvYWQsIElDb21tZW50UXVlcnkgfSBmcm9tIFwiLi9ibG9nQ29tbWVudC5pbnRlcmZhY2VcIjtcblxuLy8gU2hhcmVkIHZpc2liaWxpdHkgcnVsZTogY29tbWVudHMgb25seSBldmVyIGFwcGVhciB1bmRlciBhIFBVQkxJU0hFRCxcbi8vIG5vbi1kZWxldGVkIHBvc3QgXHUyMDE0IHRoZSBzYW1lIHJ1bGUgYXMgZ2V0UG9zdEJ5U2x1Zy5cbmNvbnN0IGdldFBvc3RJZEJ5U2x1ZyA9IGFzeW5jIChzbHVnOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHsgc2x1Zywgc3RhdHVzOiBQb3N0U3RhdHVzLlBVQkxJU0hFRCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIXBvc3QpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBvc3Qgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwb3N0LmlkO1xufTtcblxuLy8gMS4gUHVibGljIGNvbW1lbnRzIGZvciBhIHBvc3QgXHUyMDE0IHRvcC1sZXZlbCArIHRoZWlyIHJlcGxpZXMgaW4gdHdvIHF1ZXJpZXM6XG4vLyAgICB0b3AtbGV2ZWwgbmV3ZXN0LWZpcnN0LCByZXBsaWVzIG9sZGVzdC1maXJzdCAoY29udmVyc2F0aW9uIG9yZGVyKS5cbmNvbnN0IGdldFBvc3RDb21tZW50cyA9IGFzeW5jIChzbHVnOiBzdHJpbmcsIHF1ZXJ5OiBJQ29tbWVudFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBvc3RJZCA9IGF3YWl0IGdldFBvc3RJZEJ5U2x1ZyhzbHVnKTtcblxuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHRvcExldmVsV2hlcmU6IFByaXNtYS5CbG9nQ29tbWVudFdoZXJlSW5wdXQgPSB7XG4gICAgcG9zdElkLFxuICAgIHBhcmVudElkOiBudWxsLFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gIH07XG5cbiAgY29uc3QgW3RvcExldmVsLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB0b3BMZXZlbFdoZXJlLFxuICAgICAgaW5jbHVkZTogeyB1c2VyOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nQ29tbWVudC5jb3VudCh7IHdoZXJlOiB0b3BMZXZlbFdoZXJlIH0pLFxuICBdKTtcblxuICBjb25zdCByZXBsaWVzID0gdG9wTGV2ZWwubGVuZ3RoID4gMFxuICAgID8gYXdhaXQgcHJpc21hLmJsb2dDb21tZW50LmZpbmRNYW55KHtcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBwb3N0SWQsXG4gICAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgICAgICBwYXJlbnRJZDogeyBpbjogdG9wTGV2ZWwubWFwKChjKSA9PiBjLmlkKSB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmNsdWRlOiB7IHVzZXI6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICAgICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJhc2NcIiB9LFxuICAgICAgfSlcbiAgICA6IFtdO1xuXG4gIGNvbnN0IHJlcGx5TWFwID0gbmV3IE1hcDxzdHJpbmcsIHR5cGVvZiByZXBsaWVzPigpO1xuICBmb3IgKGNvbnN0IHJlcGx5IG9mIHJlcGxpZXMpIHtcbiAgICBjb25zdCBsaXN0ID0gcmVwbHlNYXAuZ2V0KHJlcGx5LnBhcmVudElkISkgPz8gW107XG4gICAgbGlzdC5wdXNoKHJlcGx5KTtcbiAgICByZXBseU1hcC5zZXQocmVwbHkucGFyZW50SWQhLCBsaXN0KTtcbiAgfVxuXG4gIGNvbnN0IGRhdGEgPSB0b3BMZXZlbC5tYXAoKGNvbW1lbnQpID0+ICh7XG4gICAgLi4uY29tbWVudCxcbiAgICByZXBsaWVzOiByZXBseU1hcC5nZXQoY29tbWVudC5pZCkgPz8gW10sXG4gIH0pKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMi4gQ3JlYXRlIGEgY29tbWVudCAoYW55IGF1dGhlbnRpY2F0ZWQgdXNlcikuIE9uZS1sZXZlbCByZXBsaWVzIG9ubHk6IGFcbi8vICAgIHBhcmVudCBtdXN0IGJlIGEgdG9wLWxldmVsIGNvbW1lbnQgb24gdGhlIHNhbWUgcG9zdC5cbmNvbnN0IGNyZWF0ZUNvbW1lbnQgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBzbHVnOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElDcmVhdGVDb21tZW50UGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCBwb3N0SWQgPSBhd2FpdCBnZXRQb3N0SWRCeVNsdWcoc2x1Zyk7XG5cbiAgbGV0IHBhcmVudElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgaWYgKHBheWxvYWQucGFyZW50SWQpIHtcbiAgICBjb25zdCBwYXJlbnQgPSBhd2FpdCBwcmlzbWEuYmxvZ0NvbW1lbnQuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGlkOiBwYXlsb2FkLnBhcmVudElkLFxuICAgICAgICBwb3N0SWQsXG4gICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBwYXJlbnRJZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFwYXJlbnQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiUGFyZW50IGNvbW1lbnQgbm90IGZvdW5kIG9uIHRoaXMgcG9zdC5cIik7XG4gICAgfVxuXG4gICAgaWYgKHBhcmVudC5wYXJlbnRJZCAhPT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJSZXBsaWVzIHRvIHJlcGxpZXMgYXJlIG5vdCBhbGxvd2VkLlwiKTtcbiAgICB9XG5cbiAgICBwYXJlbnRJZCA9IHBhcmVudC5pZDtcbiAgfVxuXG4gIHJldHVybiBwcmlzbWEuYmxvZ0NvbW1lbnQuY3JlYXRlKHtcbiAgICBkYXRhOiB7IGNvbnRlbnQ6IHBheWxvYWQuY29udGVudCwgcG9zdElkLCB1c2VySWQsIHBhcmVudElkIH0sXG4gICAgaW5jbHVkZTogeyB1c2VyOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG59O1xuXG4vLyAzLiBTb2Z0IGRlbGV0ZSBhIGNvbW1lbnQgXHUyMDE0IG93bmVyIG9yIEFETUlOLiBBIGZvcmVpZ24gaWQsIGFuIGFscmVhZHktZGVsZXRlZFxuLy8gICAgY29tbWVudCwgb3IgYSBub25leGlzdGVudCBvbmUgaXMgYSB1bmlmb3JtIDQwNCAobmV2ZXIgYSBsZWFrKS5cbmNvbnN0IGRlbGV0ZUNvbW1lbnQgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICByb2xlOiBSb2xlLFxuICBjb21tZW50SWQ6IHN0cmluZyxcbikgPT4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuYmxvZ0NvbW1lbnQudXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHtcbiAgICAgIGlkOiBjb21tZW50SWQsXG4gICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgLi4uKHJvbGUgIT09IFJvbGUuQURNSU4gPyB7IHVzZXJJZCB9IDoge30pLFxuICAgIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKHJlc3VsdC5jb3VudCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQ29tbWVudCBub3QgZm91bmQuXCIpO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgYmxvZ0NvbW1lbnRTZXJ2aWNlID0ge1xuICBnZXRQb3N0Q29tbWVudHMsXG4gIGNyZWF0ZUNvbW1lbnQsXG4gIGRlbGV0ZUNvbW1lbnQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVDb21tZW50U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBjb250ZW50OiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ29udGVudCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAudHJpbSgpXG4gICAgICAubWluKDEsIFwiQ29udGVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAgICAgLm1heCgyMDAwLCBcIkNvbnRlbnQgbXVzdCBiZSBhdCBtb3N0IDIwMDAgY2hhcmFjdGVyc1wiKSxcbiAgICBwYXJlbnRJZDogei5zdHJpbmcoKS5taW4oMSwgXCJwYXJlbnRJZCBtdXN0IG5vdCBiZSBlbXB0eVwiKS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IGNvbW1lbnRQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbW1lbnQgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oMSwgXCJDb21tZW50IGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxufSk7XG5cbmNvbnN0IGNvbW1lbnRRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgYmxvZ0NvbW1lbnRWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlQ29tbWVudFNjaGVtYSxcbiAgY29tbWVudFBhcmFtc1NjaGVtYSxcbiAgY29tbWVudFF1ZXJ5U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGRhc2hib2FyZENvbnRyb2xsZXIgfSBmcm9tIFwiLi9kYXNoYm9hcmQuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgZGFzaGJvYXJkVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9kYXNoYm9hcmQudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQWRtaW4gZGFzaGJvYXJkIFx1MjAxNCBwbGF0Zm9ybS13aWRlIGFuYWx5dGljc1xucm91dGVyLmdldChcbiAgXCIvYWRtaW5cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGRhc2hib2FyZFZhbGlkYXRpb25zLmRhc2hib2FyZFF1ZXJ5U2NoZW1hIH0pLFxuICBkYXNoYm9hcmRDb250cm9sbGVyLmdldEFkbWluRGFzaGJvYXJkLFxuKTtcblxuLy8gMi4gQWdlbnQgZGFzaGJvYXJkIFx1MjAxNCBvd24gcGFja2FnZXMvYm9va2luZ3MvcmV2ZW51ZS9wZXJmb3JtYW5jZVxucm91dGVyLmdldChcbiAgXCIvYWdlbnRcIixcbiAgYXV0aChSb2xlLkFHRU5UKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGRhc2hib2FyZFZhbGlkYXRpb25zLmRhc2hib2FyZFF1ZXJ5U2NoZW1hIH0pLFxuICBkYXNoYm9hcmRDb250cm9sbGVyLmdldEFnZW50RGFzaGJvYXJkLFxuKTtcblxuLy8gMy4gVXNlciBkYXNoYm9hcmQgXHUyMDE0IG93biBib29raW5ncy91cGNvbWluZy9zcGVuZFxucm91dGVyLmdldChcbiAgXCIvdXNlclwiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBkYXNoYm9hcmRWYWxpZGF0aW9ucy5kYXNoYm9hcmRRdWVyeVNjaGVtYSB9KSxcbiAgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRVc2VyRGFzaGJvYXJkLFxuKTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGRhc2hib2FyZFNlcnZpY2UgfSBmcm9tIFwiLi9kYXNoYm9hcmQuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBjb250cm9sbGVyIChBRE1JTilcbmNvbnN0IGdldEFkbWluRGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRBZG1pbkRhc2hib2FyZChcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBjb250cm9sbGVyIChBR0VOVClcbmNvbnN0IGdldEFnZW50RGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRBZ2VudERhc2hib2FyZChcbiAgICAgIHVzZXJJZCxcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIGNvbnRyb2xsZXIgKFVTRVIpXG5jb25zdCBnZXRVc2VyRGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRVc2VyRGFzaGJvYXJkKFxuICAgICAgdXNlcklkLFxuICAgICAgTnVtYmVyKHJlcS5xdWVyeS5kYXlzKSxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRhc2hib2FyZCBkYXRhIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZENvbnRyb2xsZXIgPSB7XG4gIGdldEFkbWluRGFzaGJvYXJkLFxuICBnZXRBZ2VudERhc2hib2FyZCxcbiAgZ2V0VXNlckRhc2hib2FyZCxcbn07IiwgImltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cywgUGFja2FnZVN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHtcbiAgSUFnZW50RGFzaGJvYXJkLFxuICBJQWRtaW5EYXNoYm9hcmQsXG4gIElCb29raW5nc0J5U3RhdHVzLFxuICBJUmV2ZW51ZVBvaW50LFxuICBJVXNlckRhc2hib2FyZCxcbn0gZnJvbSBcIi4vZGFzaGJvYXJkLmludGVyZmFjZVwiO1xuXG4vLyBNb25leSBpcyBgRGVjaW1hbCgxMCwyKWAgaW4gdGhlIHNjaGVtYSAoQUdFTlRTLm1kKSBcdTIwMTQgbWFwIHRvIE51bWJlciBvbiByZXR1cm4uXG5jb25zdCB0b051bWJlciA9ICh2YWx1ZTogdW5rbm93bik6IG51bWJlciA9PiBOdW1iZXIodmFsdWUgPz8gMCk7XG5cbi8vIEJvb2tpbmctc3RhdHVzIGJyZWFrZG93biB2aWEgZ3JvdXBCeSArIF9jb3VudC4gT3B0aW9uYWwgc2NvcGUgbGltaXRzIGl0IHRvXG4vLyBhbiBhZ2VudCdzIG93biBub24tZGVsZXRlZCBwYWNrYWdlcyBvciBhIHNpbmdsZSB1c2VyJ3MgYm9va2luZ3MuXG5jb25zdCBnZXRCb29raW5nc0J5U3RhdHVzID0gYXN5bmMgKFxuICBzY29wZTogeyBhZ2VudElkPzogc3RyaW5nOyB1c2VySWQ/OiBzdHJpbmcgfSA9IHt9LFxuKTogUHJvbWlzZTxJQm9va2luZ3NCeVN0YXR1c1tdPiA9PiB7XG4gIGNvbnN0IGdyb3VwZWQgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5ncm91cEJ5KHtcbiAgICBieTogW1wic3RhdHVzXCJdLFxuICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgd2hlcmU6IHNjb3BlLmFnZW50SWRcbiAgICAgID8geyBwYWNrYWdlOiB7IGFnZW50SWQ6IHNjb3BlLmFnZW50SWQsIGlzRGVsZXRlZDogZmFsc2UgfSB9XG4gICAgICA6IHNjb3BlLnVzZXJJZFxuICAgICAgICA/IHsgdXNlcklkOiBzY29wZS51c2VySWQgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgfSk7XG5cbiAgcmV0dXJuIGdyb3VwZWRcbiAgICAubWFwKChnKSA9PiAoeyBzdGF0dXM6IGcuc3RhdHVzLCBjb3VudDogZy5fY291bnQuX2FsbCB9KSlcbiAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpO1xufTtcblxuLy8gUmV2ZW51ZSB0cmVuZDogb25lIHJvdyBwZXIgZGF5IGZvciB0aGUgbGFzdCBgZGF5c2AgZGF5cywgYnVja2V0aW5nIENPTVBMRVRFRFxuLy8gYm9va2luZ3MgYnkgdGhlaXIgYHVwZGF0ZWRBdGAgXHUyMDE0IHRoZSB0aW1lc3RhbXAgb2YgdGhlIHRyYW5zaXRpb24gaW50b1xuLy8gQ09NUExFVEVEIChhIHRlcm1pbmFsIHN0YXRlLCBzbyBpdCBpcyB0aGUgbGFzdCB3cml0ZSkuIGBjcmVhdGVkQXRgIGlzIHdoZW5cbi8vIHRoZSBib29raW5nIHdhcyBtYWRlIChQRU5ESU5HKSBhbmQgbmV2ZXIgbW92ZXMsIHdoaWNoIHdvdWxkIG1pcy1kYXRlIHJldmVudWVcbi8vIHdlZWtzIGxhdGVyLiBQb3N0Z3JlcyBnZW5lcmF0ZV9zZXJpZXMgZ3VhcmFudGVlcyBhIGRlbnNlIHNlcmllcyAoemVyby1maWxsZWRcbi8vIGRheXMpIFx1MjAxNCBiZXR0ZXIgYW5kIGZhc3RlciB0aGFuIGEgcGVyLWRheSBKUyBsb29wLiBPcHRpb25hbCBzY29wZTogYW4gYWdlbnQnc1xuLy8gb3duIG5vbi1kZWxldGVkIHBhY2thZ2VzLCBvciBhIHNpbmdsZSB1c2VyJ3Mgc3BlbmQuXG5jb25zdCBnZXRSZXZlbnVlT3ZlclRpbWUgPSBhc3luYyAoXG4gIGRheXM6IG51bWJlcixcbiAgc2NvcGU6IHsgYWdlbnRJZD86IHN0cmluZzsgdXNlcklkPzogc3RyaW5nIH0gPSB7fSxcbik6IFByb21pc2U8SVJldmVudWVQb2ludFtdPiA9PiB7XG4gIGNvbnN0IGFnZW50U2NvcGUgPSBzY29wZS5hZ2VudElkXG4gICAgPyBgQU5EIGIuXCJwYWNrYWdlSWRcIiBJTiAoXG4gICAgICAgICBTRUxFQ1QgcC5cImlkXCJcbiAgICAgICAgIEZST00gXCJ0b3VyX3BhY2thZ2VzXCIgcFxuICAgICAgICAgV0hFUkUgcC5cImFnZW50SWRcIiA9ICQyXG4gICAgICAgICAgIEFORCBwLlwiaXNEZWxldGVkXCIgPSBmYWxzZVxuICAgICAgIClgXG4gICAgOiBcIlwiO1xuICBjb25zdCB1c2VyU2NvcGUgPSBzY29wZS51c2VySWQgPyBgQU5EIGIuXCJ1c2VySWRcIiA9ICQyYCA6IFwiXCI7XG4gIGNvbnN0IHdoZXJlQ2xhdXNlID0gc2NvcGUuYWdlbnRJZCA/IGFnZW50U2NvcGUgOiB1c2VyU2NvcGU7XG5cbiAgY29uc3Qgcm93cyA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdVbnNhZmU8XG4gICAgeyBkYXRlOiBzdHJpbmc7IHJldmVudWU6IG51bWJlciB9W11cbiAgPihcbiAgICBgXG4gICAgU0VMRUNUIHRvX2NoYXIoZGF5cy5kLCAnWVlZWS1NTS1ERCcpIEFTIGRhdGUsXG4gICAgICAgICAgIENPQUxFU0NFKFNVTShiLlwidG90YWxQcmljZVwiKSwgMCk6OmZsb2F0OCBBUyByZXZlbnVlXG4gICAgRlJPTSBnZW5lcmF0ZV9zZXJpZXMoXG4gICAgICBDVVJSRU5UX0RBVEUgLSBtYWtlX2ludGVydmFsKGRheXMgPT4gJDE6OmludCAtIDEpLFxuICAgICAgQ1VSUkVOVF9EQVRFLFxuICAgICAgJzEgZGF5Jzo6aW50ZXJ2YWxcbiAgICApIEFTIGRheXMoZClcbiAgICBMRUZUIEpPSU4gXCJib29raW5nc1wiIGJcbiAgICAgIE9OIGRhdGVfdHJ1bmMoJ2RheScsIGIuXCJ1cGRhdGVkQXRcIik6OmRhdGUgPSBkYXlzLmRcbiAgICAgIEFORCBiLlwic3RhdHVzXCIgPSAnQ09NUExFVEVEJ1xuICAgICAgJHt3aGVyZUNsYXVzZX1cbiAgICBHUk9VUCBCWSBkYXlzLmRcbiAgICBPUkRFUiBCWSBkYXlzLmQgQVNDXG4gICAgYCxcbiAgICBkYXlzLFxuICAgIC4uLihzY29wZS5hZ2VudElkIHx8IHNjb3BlLnVzZXJJZCA/IFtzY29wZS5hZ2VudElkID8/IHNjb3BlLnVzZXJJZF0gOiBbXSksXG4gICk7XG5cbiAgcmV0dXJuIHJvd3M7XG59O1xuXG4vLyBQYWNrYWdlLWlkIHNjb3BlIGZvciBib29raW5nIHF1ZXJpZXMuIENhbGxlcnMgc2hvcnQtY2lyY3VpdCB0aGUgZW1wdHkgY2FzZVxuLy8gKGFuIGFnZW50IHdpdGggbm8gcGFja2FnZXMpLCBidXQgYW4gYGluOiBbXWAgZmFsbGJhY2sga2VlcHMgdGhlIHR5cGVcbi8vIG5vbi1udWxsYWJsZSB3aGlsZSBzdGlsbCBtYXRjaGluZyBub3RoaW5nIGlmIGl0IGV2ZXIgc2xpcHMgdGhyb3VnaC5cbmNvbnN0IHRvUGFja2FnZUlkU2NvcGUgPSAoXG4gIHBhY2thZ2VJZHM6IHN0cmluZ1tdLFxuKTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0+XG4gIHBhY2thZ2VJZHMubGVuZ3RoXG4gICAgPyB7IHBhY2thZ2VJZDogeyBpbjogcGFja2FnZUlkcyB9IH1cbiAgICA6IHsgcGFja2FnZUlkOiB7IGluOiBbXSB9IH07XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBcdTIwMTQgcGxhdGZvcm0td2lkZSBjb3VudHMsIGJyZWFrZG93bnMgYW5kIHJldmVudWUgdHJlbmQuXG5jb25zdCBnZXRBZG1pbkRhc2hib2FyZCA9IGFzeW5jIChkYXlzOiBudW1iZXIpOiBQcm9taXNlPElBZG1pbkRhc2hib2FyZD4gPT4ge1xuICBjb25zdCBbXG4gICAgdG90YWxVc2VycyxcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlLFxuICAgIHVzZXJzQnlSb2xlLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcGFja2FnZXNCeUNhdGVnb3J5LFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudXNlci5jb3VudCh7IHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0gfSksXG4gICAgcHJpc21hLmJvb2tpbmcuY291bnQoKSxcbiAgICBwcmlzbWEuYm9va2luZy5hZ2dyZWdhdGUoe1xuICAgICAgX3N1bTogeyB0b3RhbFByaWNlOiB0cnVlIH0sXG4gICAgICB3aGVyZTogeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVEIH0sXG4gICAgfSksXG4gICAgcHJpc21hLnVzZXIuZ3JvdXBCeSh7XG4gICAgICBieTogW1wicm9sZVwiXSxcbiAgICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgICB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgfSksXG4gICAgZ2V0Qm9va2luZ3NCeVN0YXR1cygpLFxuICAgIHByaXNtYS50b3VyUGFja2FnZVxuICAgICAgLmdyb3VwQnkoe1xuICAgICAgICBieTogW1wiY2F0ZWdvcnlJZFwiXSxcbiAgICAgICAgX2NvdW50OiB7IF9hbGw6IHRydWUgfSxcbiAgICAgICAgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgfSlcbiAgICAgIC50aGVuKGFzeW5jIChncm91cGVkKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhdGVnb3J5SWRzID0gZ3JvdXBlZC5tYXAoKGcpID0+IGcuY2F0ZWdvcnlJZCk7XG4gICAgICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZE1hbnkoe1xuICAgICAgICAgIHdoZXJlOiB7IGlkOiB7IGluOiBjYXRlZ29yeUlkcyB9IH0sXG4gICAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBuYW1lTWFwID0gbmV3IE1hcChjYXRlZ29yaWVzLm1hcCgoYykgPT4gW2MuaWQsIGMubmFtZV0pKTtcblxuICAgICAgICByZXR1cm4gZ3JvdXBlZFxuICAgICAgICAgIC5tYXAoKGcpID0+ICh7XG4gICAgICAgICAgICBjYXRlZ29yeTogbmFtZU1hcC5nZXQoZy5jYXRlZ29yeUlkKSA/PyBcIlVua25vd25cIixcbiAgICAgICAgICAgIGNvdW50OiBnLl9jb3VudC5fYWxsLFxuICAgICAgICAgIH0pKVxuICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLmNvdW50IC0gYS5jb3VudCk7XG4gICAgICB9KSxcbiAgICBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cyksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxVc2VycyxcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlOiB0b051bWJlcih0b3RhbFJldmVudWUuX3N1bS50b3RhbFByaWNlKSxcbiAgICB1c2Vyc0J5Um9sZTogdXNlcnNCeVJvbGVcbiAgICAgIC5tYXAoKGcpID0+ICh7IHJvbGU6IGcucm9sZSwgY291bnQ6IGcuX2NvdW50Ll9hbGwgfSkpXG4gICAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcGFja2FnZXNCeUNhdGVnb3J5LFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgfTtcbn07XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBcdTIwMTQgc2NvcGVkIHRvIHRoZSBhZ2VudCdzIG93biBwYWNrYWdlcy4gRmV0Y2hlcyBvd25lZFxuLy8gICAgcGFja2FnZSBpZHMgb25jZSwgdGhlbiBldmVyeSBhZ2dyZWdhdGUgcmV1c2VzIHRoYXQgc2NvcGUgc28gdGhlIHdob2xlXG4vLyAgICBidW5kbGUgaXMgb25lIFByb21pc2UuYWxsIChubyBwZXItaXRlbSBxdWVyaWVzKS5cbmNvbnN0IGdldEFnZW50RGFzaGJvYXJkID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgZGF5czogbnVtYmVyLFxuKTogUHJvbWlzZTxJQWdlbnREYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW293bmVkUGFja2FnZXMsIGJvb2tpbmdzQnlTdGF0dXMsIGF2ZXJhZ2VSYXRpbmddID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZTogeyBhZ2VudElkOiB1c2VySWQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pLFxuICAgIGdldEJvb2tpbmdzQnlTdGF0dXMoeyBhZ2VudElkOiB1c2VySWQgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmFnZ3JlZ2F0ZSh7XG4gICAgICBfYXZnOiB7IHJhdGluZzogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHtcbiAgICAgICAgYWdlbnRJZDogdXNlcklkLFxuICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgIH0pLFxuICBdKTtcblxuICBjb25zdCBwYWNrYWdlSWRzID0gb3duZWRQYWNrYWdlcy5tYXAoKHApID0+IHAuaWQpO1xuXG4gIC8vIEFuIGFnZW50IHdpdGggbm8gcGFja2FnZXMgbXVzdCBzZWUgemVyb3MgXHUyMDE0IHNjb3BlIGlzIHVuZGVmaW5lZCBmb3IgYW4gZW1wdHlcbiAgLy8gbGlzdCwgYW5kIGEgYmFyZSBgd2hlcmU6IHVuZGVmaW5lZGAgLyBgQU5EOiBbe31dYCB3b3VsZCBvdGhlcndpc2UgbWF0Y2ggdGhlXG4gIC8vIHdob2xlIHBsYXRmb3JtIChjcm9zcy1hZ2VudCBkYXRhIGxlYWspLiBTaG9ydC1jaXJjdWl0IGhlcmUgaW5zdGVhZC5cbiAgaWYgKHBhY2thZ2VJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRvdGFsUGFja2FnZXM6IDAsXG4gICAgICB0b3RhbEJvb2tpbmdzOiAwLFxuICAgICAgdG90YWxSZXZlbnVlOiAwLFxuICAgICAgYXZlcmFnZVJhdGluZzogTWF0aC5yb3VuZCgoYXZlcmFnZVJhdGluZy5fYXZnLnJhdGluZyA/PyAwKSAqIDEwKSAvIDEwLFxuICAgICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICAgIHJldmVudWVPdmVyVGltZTogYXdhaXQgZ2V0UmV2ZW51ZU92ZXJUaW1lKGRheXMsIHsgYWdlbnRJZDogdXNlcklkIH0pLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBzY29wZSA9IHRvUGFja2FnZUlkU2NvcGUocGFja2FnZUlkcyk7XG5cbiAgY29uc3QgW3RvdGFsUGFja2FnZXMsIHRvdGFsQm9va2luZ3MsIHRvdGFsUmV2ZW51ZSwgcmV2ZW51ZU92ZXJUaW1lXSA9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgcGFja2FnZUlkcy5sZW5ndGgsXG4gICAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlOiBzY29wZSB9KSxcbiAgICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIEFORDogW3Njb3BlLCB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfV0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIGdldFJldmVudWVPdmVyVGltZShkYXlzLCB7IGFnZW50SWQ6IHVzZXJJZCB9KSxcbiAgICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsUGFja2FnZXMsXG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFJldmVudWU6IHRvTnVtYmVyKHRvdGFsUmV2ZW51ZS5fc3VtLnRvdGFsUHJpY2UpLFxuICAgIGF2ZXJhZ2VSYXRpbmc6IE1hdGgucm91bmQoKGF2ZXJhZ2VSYXRpbmcuX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMCxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgfTtcbn07XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIFx1MjAxNCB0aGUgdXNlcidzIGJvb2tpbmdzLCBzcGVuZCwgYW5kIHVwY29taW5nIHRyaXBzLlxuY29uc3QgZ2V0VXNlckRhc2hib2FyZCA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIGRheXMgPSAzMCxcbik6IFByb21pc2U8SVVzZXJEYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW3RvdGFsQm9va2luZ3MsIHRvdGFsU3BlbmQsIHVwY29taW5nLCBib29raW5nc0J5U3RhdHVzLCByZXZlbnVlT3ZlclRpbWVdID1cbiAgICBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlOiB7IHVzZXJJZCB9IH0pLFxuICAgICAgcHJpc21hLmJvb2tpbmcuYWdncmVnYXRlKHtcbiAgICAgICAgX3N1bTogeyB0b3RhbFByaWNlOiB0cnVlIH0sXG4gICAgICAgIHdoZXJlOiB7IHVzZXJJZCwgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCB9LFxuICAgICAgfSksXG4gICAgICBwcmlzbWEuYm9va2luZy5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgdXNlcklkLFxuICAgICAgICAgIHN0YXR1czoge1xuICAgICAgICAgICAgaW46IFtCb29raW5nU3RhdHVzLlBFTkRJTkcsIEJvb2tpbmdTdGF0dXMuUEFJRCwgQm9va2luZ1N0YXR1cy5DT05GSVJNRURdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJhdmVsRGF0ZTogeyBndDogbmV3IERhdGUoKSB9LFxuICAgICAgICB9LFxuICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgICB0cmF2ZWxEYXRlOiB0cnVlLFxuICAgICAgICAgIHRyYXZlbGVyczogdHJ1ZSxcbiAgICAgICAgICB0b3RhbFByaWNlOiB0cnVlLFxuICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICBwYWNrYWdlOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgdGl0bGU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICAgICAgICB9LFxuICAgICAgICBvcmRlckJ5OiB7IHRyYXZlbERhdGU6IFwiYXNjXCIgfSxcbiAgICAgICAgdGFrZTogNSxcbiAgICAgIH0pLFxuICAgICAgZ2V0Qm9va2luZ3NCeVN0YXR1cyh7IHVzZXJJZCB9KSxcbiAgICAgIGdldFJldmVudWVPdmVyVGltZShkYXlzLCB7IHVzZXJJZCB9KSxcbiAgICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxTcGVuZDogdG9OdW1iZXIodG90YWxTcGVuZC5fc3VtLnRvdGFsUHJpY2UpLFxuICAgIHVwY29taW5nQ291bnQ6IHVwY29taW5nLmxlbmd0aCxcbiAgICB1cGNvbWluZzogdXBjb21pbmcubWFwKChiKSA9PiAoe1xuICAgICAgLi4uYixcbiAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihiLnRvdGFsUHJpY2UpLFxuICAgIH0pKSxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRTZXJ2aWNlID0ge1xuICBnZXRBZG1pbkRhc2hib2FyZCxcbiAgZ2V0QWdlbnREYXNoYm9hcmQsXG4gIGdldFVzZXJEYXNoYm9hcmQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBkYXNoYm9hcmRRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZGF5czogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCgzNjUpLmRlZmF1bHQoMzApLFxufSk7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRWYWxpZGF0aW9ucyA9IHtcbiAgZGFzaGJvYXJkUXVlcnlTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgcGF5bWVudENvbnRyb2xsZXIgfSBmcm9tIFwiLi9wYXltZW50LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHBheW1lbnRWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3BheW1lbnQudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gT3BlbiBhIGdhdGV3YXkgc2Vzc2lvbiBmb3IgdGhlIHVzZXIncyBwZW5kaW5nIGJvb2tpbmcgKFVTRVIgb25seSkuXG5yb3V0ZXIucG9zdChcbiAgXCIvY3JlYXRlXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcGF5bWVudFZhbGlkYXRpb25zLmNyZWF0ZVNjaGVtYSB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuY3JlYXRlUGF5bWVudCxcbik7XG5cbi8vIFB1YmxpYyBcdTIwMTQgU1NMQ29tbWVyeiBQT1NUcyB0aGUgb3V0Y29tZSBoZXJlIChzdWNjZXNzL2ZhaWwvY2FuY2VsKSBhbmQgd2Vcbi8vIHJlZGlyZWN0IHRoZSBicm93c2VyIHRvIHRoZSBmcm9udGVuZCByZXN1bHQgcGFnZS5cbnJvdXRlci5wb3N0KFxuICBcIi9jb25maXJtXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcXVlcnk6IHBheW1lbnRWYWxpZGF0aW9ucy5jYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICAgIGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5nYXRld2F5UmVzdWx0U2NoZW1hLFxuICB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuY29uZmlybVBheW1lbnQsXG4pO1xuXG4vLyBQdWJsaWMgXHUyMDE0IFNTTENvbW1lcnogaW5zdGFudCBwYXltZW50IG5vdGlmaWNhdGlvbjsgc2FtZSBpZGVtcG90ZW50IHNldHRsZS5cbnJvdXRlci5wb3N0KFxuICBcIi9pcG5cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBxdWVyeTogcGF5bWVudFZhbGlkYXRpb25zLmNhbGxiYWNrUXVlcnlTY2hlbWEsXG4gICAgYm9keTogcGF5bWVudFZhbGlkYXRpb25zLmdhdGV3YXlSZXN1bHRTY2hlbWEsXG4gIH0pLFxuICBwYXltZW50Q29udHJvbGxlci5pcG4sXG4pO1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5pbXBvcnQgeyBJR2F0ZXdheVJlc3VsdCB9IGZyb20gXCIuL3BheW1lbnQuaW50ZXJmYWNlXCI7XG5pbXBvcnQgeyBwYXltZW50U2VydmljZSB9IGZyb20gXCIuL3BheW1lbnQuc2VydmljZVwiO1xuXG5jb25zdCBjcmVhdGVQYXltZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBwYXltZW50U2VydmljZS5jcmVhdGVQYXltZW50U2Vzc2lvbih1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlBheW1lbnQgc2Vzc2lvbiBjcmVhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHNlc3Npb24sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBQdWJsaWMgY2FsbGJhY2sgdGFyZ2V0IFx1MjAxNCBTU0xDb21tZXJ6IFBPU1RzIGhlcmUgKHNlcnZlci10by1zZXJ2ZXIpIGFmdGVyIHRoZVxuLy8gc2hvcHBlciBmaW5pc2hlcyBhdCB0aGUgZ2F0ZXdheS4gV2Ugc2V0dGxlIHRoZSBwYXltZW50LCB0aGVuIGJvdW5jZSB0aGVcbi8vIGJyb3dzZXIgdG8gdGhlIGZyb250ZW5kIHJlc3VsdCBwYWdlLlxuY29uc3QgY29uZmlybVBheW1lbnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBib29raW5nSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LmJvb2tpbmdJZCk7XG4gICAgY29uc3QgdHJhbklkID0gU3RyaW5nKHJlcS5xdWVyeS50cmFuSWQpO1xuICAgIGNvbnN0IHN0YXR1cyA9IFN0cmluZyhyZXEucXVlcnkuc3RhdHVzID8/IFwiZmFpbFwiKTtcblxuICAgIGF3YWl0IHBheW1lbnRTZXJ2aWNlLnByb2Nlc3NHYXRld2F5UmVzdWx0KFxuICAgICAgYm9va2luZ0lkLFxuICAgICAgdHJhbklkLFxuICAgICAgcmVxLmJvZHkgYXMgSUdhdGV3YXlSZXN1bHQsXG4gICAgKTtcblxuICAgIGNvbnN0IHJlZGlyZWN0QmFzZSA9XG4gICAgICBjb25maWcubm9kZV9lbnYgPT09IFwicHJvZHVjdGlvblwiXG4gICAgICAgID8gY29uZmlnLmZyb250ZW5kX3VybF9wcm9kXG4gICAgICAgIDogY29uZmlnLmZyb250ZW5kX3VybF9kZXY7XG4gICAgY29uc3QgcGFnZSA9IFtcInN1Y2Nlc3NcIiwgXCJmYWlsXCIsIFwiY2FuY2VsXCJdLmluY2x1ZGVzKHN0YXR1cykgPyBzdGF0dXMgOiBcImZhaWxcIjtcblxuICAgIHJlcy5yZWRpcmVjdCgzMDIsIGAke3JlZGlyZWN0QmFzZX0vcGF5bWVudC8ke3BhZ2V9P2Jvb2tpbmdJZD0ke2Jvb2tpbmdJZH1gKTtcbiAgfSxcbik7XG5cbi8vIFB1YmxpYyBJUE4gdGFyZ2V0IFx1MjAxNCB0aGUgZ2F0ZXdheSBub3RpZmllcyB1cyBoZXJlIGluZGVwZW5kZW50bHkgb2YgdGhlXG4vLyByZWRpcmVjdC4gU2FtZSBpZGVtcG90ZW50IHNldHRsZTsgYWx3YXlzIGFuc3dlcnMgMjAwIHNvIHRoZSBnYXRld2F5IHN0b3BzIHJldHJ5aW5nLlxuY29uc3QgaXBuID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgYm9va2luZ0lkID0gU3RyaW5nKHJlcS5xdWVyeS5ib29raW5nSWQpO1xuICAgIGNvbnN0IHRyYW5JZCA9IFN0cmluZyhyZXEucXVlcnkudHJhbklkKTtcblxuICAgIGF3YWl0IHBheW1lbnRTZXJ2aWNlLnByb2Nlc3NHYXRld2F5UmVzdWx0KFxuICAgICAgYm9va2luZ0lkLFxuICAgICAgdHJhbklkLFxuICAgICAgcmVxLmJvZHkgYXMgSUdhdGV3YXlSZXN1bHQsXG4gICAgKTtcblxuICAgIHJlcy5zdGF0dXMoMjAwKS50eXBlKFwidGV4dC9wbGFpblwiKS5zZW5kKFwiT0tcIik7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcGF5bWVudENvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBheW1lbnQsXG4gIGNvbmZpcm1QYXltZW50LFxuICBpcG4sXG59OyIsICJpbXBvcnQgeyBCb29raW5nU3RhdHVzLCBQYXltZW50U3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IFNzbGNvbW1lcnpJbml0UmVzdWx0LCBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCwgZ2VuZXJhdGVUcmFuSWQsIHNzbGNvbW1lcnpJbml0LCBzc2xjb21tZXJ6VmFsaWRhdGUgfSBmcm9tIFwiLi4vLi4vbGliL3NzbGNvbW1lcnpcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzZW5kQm9va2luZ0VtYWlsIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQgeyBJR2F0ZXdheVJlc3VsdCwgSVBheW1lbnRDcmVhdGVSZXF1ZXN0LCBJUGF5bWVudEdhdGV3YXlPdXRjb21lIH0gZnJvbSBcIi4vcGF5bWVudC5pbnRlcmZhY2VcIjtcblxuLy8gVGhlIGdhdGV3YXkgUE9TVHMgdG8gdGhlc2UgVVJMcyBzZXJ2ZXItdG8tc2VydmVyLCBzbyB0aGUgaG9zdCBtdXN0IGJlXG4vLyBwdWJsaWNseSByZWFjaGFibGUgXHUyMDE0IGNvbmZpZy5iYWNrZW5kX3B1YmxpY191cmwsIG5ldmVyIGxvY2FsaG9zdCBpbiBzYW5kYm94LlxuY29uc3QgYnVpbGRDYWxsYmFja1VybCA9IChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIHRyYW5JZDogc3RyaW5nLFxuICBraW5kOiBcInN1Y2Nlc3NcIiB8IFwiZmFpbFwiIHwgXCJjYW5jZWxcIiB8IFwiaXBuXCIsXG4pID0+XG4gIGAke2NvbmZpZy5iYWNrZW5kX3B1YmxpY191cmx9L2FwaS9wYXltZW50cy8ke2tpbmQgPT09IFwiaXBuXCIgPyBcImlwblwiIDogXCJjb25maXJtXCJ9P2Jvb2tpbmdJZD0ke2Jvb2tpbmdJZH0mdHJhbklkPSR7dHJhbklkfSR7XG4gICAga2luZCA9PT0gXCJpcG5cIiA/IFwiXCIgOiBgJnN0YXR1cz0ke2tpbmR9YFxuICB9YDtcblxuLy8gT3BlbnMgYW4gU1NMQ29tbWVyeiBzZXNzaW9uIGZvciBhIHBlbmRpbmcgYm9va2luZyB0aGUgdXNlciBvd25zLiBUaGUgYm9va2luZ1xuLy8gYW1vdW50IGlzIGZyb3plbiBhdCBpbml0aWF0aW9uOyBpdCBuZXZlciByZS1yZWFkcyB0aGUgcGFja2FnZSBwcmljZS5cbmNvbnN0IGNyZWF0ZVBheW1lbnRTZXNzaW9uID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVBheW1lbnRDcmVhdGVSZXF1ZXN0LFxuKTogUHJvbWlzZTx7IHBheW1lbnRJZDogc3RyaW5nOyB0cmFuSWQ6IHN0cmluZzsgcGF5bWVudFVybDogc3RyaW5nIHwgbnVsbCB9PiA9PiB7XG4gIGNvbnN0IHsgYm9va2luZ0lkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogYm9va2luZ0lkIH0sXG4gICAgaW5jbHVkZTogeyBwYWNrYWdlOiB7IHNlbGVjdDogeyB0aXRsZTogdHJ1ZSB9IH0gfSxcbiAgfSk7XG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG4gIGlmIChib29raW5nLnVzZXJJZCAhPT0gdXNlcklkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBheSBmb3IgdGhpcyBib29raW5nLlwiKTtcbiAgfVxuICBpZiAoYm9va2luZy5zdGF0dXMgPT09IEJvb2tpbmdTdGF0dXMuUEFJRCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiVGhpcyBib29raW5nIGlzIGFscmVhZHkgcGFpZC5cIik7XG4gIH1cbiAgaWYgKGJvb2tpbmcuc3RhdHVzICE9PSBCb29raW5nU3RhdHVzLlBFTkRJTkcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBgQ2Fubm90IHBheSBmb3IgYSBib29raW5nIGluICR7Ym9va2luZy5zdGF0dXMudG9Mb3dlckNhc2UoKX0gc3RhdHVzLmAsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlLCBwaG9uZTogdHJ1ZSB9LFxuICB9KTtcbiAgaWYgKCF1c2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBjb25zdCBhbW91bnQgPSBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKTtcbiAgY29uc3QgdHJhbklkID0gZ2VuZXJhdGVUcmFuSWQoKTtcblxuICAvLyBPbmUgbGl2ZSBzZXNzaW9uIHBlciBib29raW5nOiB0aGUgbGVkZ2VyIHJvdyBpcyBjcmVhdGVkIGF0b21pY2FsbHkgd2hpbGVcbiAgLy8gc3VwZXJzZWRpbmcgYW55IGFiYW5kb25lZCBzZXNzaW9uLCB0aGVuIHRoZSBnYXRld2F5IGlzIGFza2VkLiBUaGUgcm93XG4gIC8vIHN1cnZpdmVzIHJlZ2FyZGxlc3Mgb2YgdGhlIGdhdGV3YXkgcmVzcG9uc2UgXHUyMDE0IGluaXQgZmFpbHVyZSBmbGlwcyBpdCB0b1xuICAvLyBGQUlMRUQgYmVsb3cgc28gYSB0cnV0aGZ1bCBlbnRyeSBhbHdheXMgZXhpc3RzLlxuICBjb25zdCBwYXltZW50ID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgYm9va2luZ0lkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB0eC5wYXltZW50LmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIGJvb2tpbmdJZCxcbiAgICAgICAgdHJhbklkLFxuICAgICAgICBhbW91bnQsXG4gICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQsXG4gICAgICB9LFxuICAgIH0pO1xuICB9KTtcblxuICBsZXQgaW5pdDogU3NsY29tbWVyekluaXRSZXN1bHQ7XG4gIHRyeSB7XG4gICAgaW5pdCA9IGF3YWl0IHNzbGNvbW1lcnpJbml0KHtcbiAgICAgIHRvdGFsX2Ftb3VudDogYW1vdW50LFxuICAgICAgdHJhbl9pZDogdHJhbklkLFxuICAgICAgc3VjY2Vzc191cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwic3VjY2Vzc1wiKSxcbiAgICAgIGZhaWxfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImZhaWxcIiksXG4gICAgICBjYW5jZWxfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImNhbmNlbFwiKSxcbiAgICAgIGlwbl91cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwiaXBuXCIpLFxuICAgICAgY3VzX25hbWU6IHVzZXIubmFtZSxcbiAgICAgIGN1c19lbWFpbDogdXNlci5lbWFpbCxcbiAgICAgIGN1c19waG9uZTogdXNlci5waG9uZSA/PyBcIjAxNzExMTExMTExXCIsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgLy8ga2VlcCB0aGUgbGVkZ2VyIHRydXRoZnVsIFx1MjAxNCB0aGUgc2Vzc2lvbiBuZXZlciByZWFjaGVkIHRoZSBnYXRld2F5LiBUaGVcbiAgICAvLyBzdGF0dXMgZ3VhcmQgbWFrZXMgYSBjb25jdXJyZW50IC9jcmVhdGUgdGhhdCBhbHJlYWR5IGNhbmNlbGxlZCB0aGlzIHJvd1xuICAgIC8vIHdpbiB0aGUgcmFjZSAodGhhdCByb3cgc3RheXMgY2FuY2VsbGVkLCB0aGlzIG9uZSBmYWlscyBvbmx5IGlmIGxpdmUpLlxuICAgIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgLy8gc3RvcmUgdGhlIGdhdGV3YXkgVVJMcyBvbmx5IGlmIHRoZSByb3cgaXMgc3RpbGwgdGhlIGxpdmUgc2Vzc2lvbi5cbiAgYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICBkYXRhOiB7IGdhdGV3YXlQYWdlVXJsOiBpbml0LkdhdGV3YXlQYWdlVVJMLCBzc2xTZXNzaW9uS2V5OiBpbml0LnNlc3Npb25rZXkgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXltZW50SWQ6IHBheW1lbnQuaWQsXG4gICAgdHJhbklkOiBwYXltZW50LnRyYW5JZCxcbiAgICBwYXltZW50VXJsOiBpbml0LkdhdGV3YXlQYWdlVVJMID8/IG51bGwsXG4gIH07XG59O1xuXG4vLyBTZXJ2ZXItc2lkZSB2ZXJpZmljYXRpb24gb2YgYSBjb21wbGV0ZWQgdHJhbnNhY3Rpb246IHRoZSB2YWxpZGF0b3IgcmV0dXJuc1xuLy8gVkFMSUQgKGZpcnN0IGNoZWNrKSBvciBWQUxJREFURUQgKGFscmVhZHkgdmVyaWZpZWQgYmVmb3JlKSB3aXRoIHRoZSBhbW91bnQuXG4vLyBBbnl0aGluZyBlbHNlIFx1MjAxNCBvciBhIG1pc21hdGNoZWQgYW1vdW50IFx1MjAxNCBmYWlscyB0aGUgcGF5bWVudC5cbmNvbnN0IHZlcmlmeVN1Y2Nlc3MgPSBhc3luYyAoXG4gIHZhbElkOiBzdHJpbmcsXG4gIGV4cGVjdGVkQW1vdW50OiBudW1iZXIsXG4pOiBQcm9taXNlPHsgdmVyaWZpZWQ6IFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHwgbnVsbDsgbWF0Y2hlc0Ftb3VudDogYm9vbGVhbiB9PiA9PiB7XG4gIGxldCB2ZXJpZmllZDogU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQgfCBudWxsID0gbnVsbDtcbiAgdHJ5IHtcbiAgICB2ZXJpZmllZCA9IGF3YWl0IHNzbGNvbW1lcnpWYWxpZGF0ZSh7IHZhbF9pZDogdmFsSWQgfSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIHZhbGlkYXRvciB1bnJlYWNoYWJsZSBcdTIwMTQgZmFpbCB0aGUgcGF5bWVudCByYXRoZXIgdGhhbiBjcmFzaCB0aGUgY2FsbGJhY2tcbiAgICByZXR1cm4geyB2ZXJpZmllZDogbnVsbCwgbWF0Y2hlc0Ftb3VudDogZmFsc2UgfTtcbiAgfVxuXG4gIGNvbnN0IHZhbGlkU3RhdHVzID1cbiAgICB2ZXJpZmllZC5zdGF0dXMgPT09IFwiVkFMSURcIiB8fCB2ZXJpZmllZC5zdGF0dXMgPT09IFwiVkFMSURBVEVEXCI7XG4gIGNvbnN0IG1hdGNoZXNBbW91bnQgPVxuICAgIHZlcmlmaWVkLmFtb3VudCAhPT0gdW5kZWZpbmVkICYmIE51bWJlcih2ZXJpZmllZC5hbW91bnQpID09PSBleHBlY3RlZEFtb3VudDtcblxuICByZXR1cm4geyB2ZXJpZmllZCwgbWF0Y2hlc0Ftb3VudDogdmFsaWRTdGF0dXMgJiYgbWF0Y2hlc0Ftb3VudCB9O1xufTtcblxuLy8gU2hhcmVkIGJ5IHRoZSBjb25maXJtIChzdWNjZXNzL2ZhaWwvY2FuY2VsKSBhbmQgSVBOIGVuZHBvaW50cy4gSWRlbXBvdGVudDogYVxuLy8gc2V0dGxlZCBwYXltZW50IHNob3J0LWNpcmN1aXRzLCBzbyB0aGUgZG91YmxlLWZpcmluZyBJUE4gbmV2ZXIgZG91YmxlLWNoYXJnZXMuXG5jb25zdCBwcm9jZXNzR2F0ZXdheVJlc3VsdCA9IGFzeW5jIChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIHRyYW5JZDogc3RyaW5nLFxuICByZXN1bHQ6IElHYXRld2F5UmVzdWx0LFxuKTogUHJvbWlzZTxJUGF5bWVudEdhdGV3YXlPdXRjb21lPiA9PiB7XG4gIGNvbnN0IHBheW1lbnQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyB0cmFuSWQgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBib29raW5nOiB7XG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICB1c2VyOiB7IHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0sXG4gICAgICAgICAgcGFja2FnZTogeyBzZWxlY3Q6IHsgdGl0bGU6IHRydWUgfSB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIXBheW1lbnQgfHwgcGF5bWVudC5ib29raW5nSWQgIT09IGJvb2tpbmdJZCkge1xuICAgIC8vIEEgY2FsbGJhY2sgZm9yIGEgc2Vzc2lvbiB3ZSBuZXZlciBjcmVhdGVkIFx1MjAxNCBub3RoaW5nIHRvIHNldHRsZS5cbiAgICByZXR1cm4geyBwYXltZW50U3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCwgYm9va2luZ1N0YXR1czogbnVsbCwgY2hhbmdlZDogZmFsc2UgfTtcbiAgfVxuXG4gIGlmIChwYXltZW50LnN0YXR1cyA9PT0gUGF5bWVudFN0YXR1cy5TVUNDRVNTKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiBmYWxzZSxcbiAgICB9O1xuICB9XG5cbiAgLy8gQ2FuY2VsIGNhbGxiYWNrIFx1MjAxNCB0aGUgc2hvcHBlciBhYmFuZG9uZWQgY2hlY2tvdXQsIG5vIGNoYXJnZSB3YXMgbWFkZS5cbiAgaWYgKHJlc3VsdC5mYWlsX3N0YXR1cyA9PT0gXCJDQU5DRUxMRURcIiB8fCByZXN1bHQuc3RhdHVzID09PSBcIkNBTkNFTExFRFwiKSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IHVwZGF0ZWQuc3RhdHVzLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IHVwZGF0ZWQuc3RhdHVzICE9PSBwYXltZW50LnN0YXR1cyxcbiAgICB9O1xuICB9XG5cbiAgLy8gTm8gdmFsX2lkIG1lYW5zIHRoZSBnYXRld2F5IHJlcG9ydGVkIGEgZmFpbHVyZSAoZmFpbF91cmwpIFx1MjAxNCBub3RoaW5nIHRvIHZlcmlmeS5cbiAgaWYgKCFyZXN1bHQudmFsX2lkKSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuRkFJTEVEIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IHVwZGF0ZWQuc3RhdHVzLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IHVwZGF0ZWQuc3RhdHVzICE9PSBwYXltZW50LnN0YXR1cyxcbiAgICB9O1xuICB9XG5cbiAgLy8gU3VjY2VzcyBwYXRoOiB2ZXJpZnkgc2VydmVyLXNpZGUgYW5kIG9ubHkgdGhlbiBtYXJrIHRoZSBib29raW5nIGFzIHBhaWQuXG4gIGNvbnN0IHsgdmVyaWZpZWQsIG1hdGNoZXNBbW91bnQgfSA9IGF3YWl0IHZlcmlmeVN1Y2Nlc3MoXG4gICAgcmVzdWx0LnZhbF9pZCxcbiAgICBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICApO1xuXG4gIGlmICghbWF0Y2hlc0Ftb3VudCkge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB0cnVlLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBzZXR0bGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgdHgucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsXG4gICAgICAgIHZhbElkOiByZXN1bHQudmFsX2lkLFxuICAgICAgICBjYXJkVHlwZTogcmVzdWx0LmNhcmRfdHlwZSA/PyB2ZXJpZmllZD8uY2FyZF90eXBlLFxuICAgICAgICBiYW5rVHJhbklkOiByZXN1bHQuYmFua190cmFuX2lkID8/IHZlcmlmaWVkPy5iYW5rX3RyYW5faWQsXG4gICAgICAgIHBhaWRBdDogbmV3IERhdGUoKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBjb21wYXJlLWFuZC1zZXQ6IG9ubHkgYSBzdGlsbC1QRU5ESU5HIGJvb2tpbmcgYmVjb21lcyBQQUlEOyBhIGJvb2tpbmcgdGhhdFxuICAgIC8vIHdhcyBjb25jdXJyZW50bHkgY29uZmlybWVkIG9yIGNhbmNlbGxlZCBrZWVwcyBpdHMgc3RhdGUsIHRoZSBtb25leSBzdGF5cyBvbi5cbiAgICBhd2FpdCB0eC5ib29raW5nLnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCwgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBFTkRJTkcgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBBSUQgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB1cGRhdGVkO1xuICB9KTtcblxuICBjb25zdCBib29raW5nQWZ0ZXIgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCB9IH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IFwicGF5bWVudCByZWNlaXZlZFwiIGVtYWlsIFx1MjAxNCBuZXZlciBmYWlscyB0aGUgY2FsbGJhY2tcbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgZW1haWw6IHBheW1lbnQuYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgbmFtZTogcGF5bWVudC5ib29raW5nLnVzZXIubmFtZSxcbiAgICAgIHBhY2thZ2VUaXRsZTogcGF5bWVudC5ib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICB0cmF2ZWxEYXRlOiBwYXltZW50LmJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICAgIHRyYXZlbGVyczogcGF5bWVudC5ib29raW5nLnRyYXZlbGVycyxcbiAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihwYXltZW50LmFtb3VudCksXG4gICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEFJRCxcbiAgICB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXltZW50U3RhdHVzOiBzZXR0bGVkLnN0YXR1cyxcbiAgICBib29raW5nU3RhdHVzOiBib29raW5nQWZ0ZXI/LnN0YXR1cyA/PyBudWxsLFxuICAgIGNoYW5nZWQ6IHRydWUsXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFNlcnZpY2UgPSB7XG4gIGNyZWF0ZVBheW1lbnRTZXNzaW9uLFxuICBwcm9jZXNzR2F0ZXdheVJlc3VsdCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgYm9va2luZ0lkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkJvb2tpbmcgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC51dWlkKFwiQm9va2luZyBpZCBtdXN0IGJlIGEgdmFsaWQgdXVpZFwiKSxcbn0pO1xuXG5jb25zdCBjYWxsYmFja1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBib29raW5nSWQ6IHouc3RyaW5nKCkudXVpZChcIkJvb2tpbmcgaWQgbXVzdCBiZSBhIHZhbGlkIHV1aWRcIiksXG4gIHRyYW5JZDogei5zdHJpbmcoKS5taW4oMSksXG4gIHN0YXR1czogei5lbnVtKFtcInN1Y2Nlc3NcIiwgXCJmYWlsXCIsIFwiY2FuY2VsXCJdKS5vcHRpb25hbCgpLFxufSk7XG5cbi8vIEJvZHkgb2YgdGhlIGdhdGV3YXkgUE9TVCBcdTIwMTQgb25seSBmaWVsZHMgd2UgY29uc3VtZSwgYWxsIG9wdGlvbmFsIGJlY2F1c2UgdGhlXG4vLyBzaGFwZSBkaWZmZXJzIGJldHdlZW4gc3VjY2VzcyAvIGZhaWwgLyBjYW5jZWwgLyBJUE4gY2FsbGJhY2tzLlxuY29uc3QgZ2F0ZXdheVJlc3VsdFNjaGVtYSA9IHoub2JqZWN0KHtcbiAgdmFsX2lkOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHN0YXR1czogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBmYWlsX3N0YXR1czogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBjYXJkX3R5cGU6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgYmFua190cmFuX2lkOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGN1cnJlbmN5OiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGFtb3VudDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRDcmVhdGVQYXltZW50U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY3JlYXRlU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRDYWxsYmFja1F1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY2FsbGJhY2tRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUR2F0ZXdheVJlc3VsdFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGdhdGV3YXlSZXN1bHRTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVTY2hlbWEsXG4gIGNhbGxiYWNrUXVlcnlTY2hlbWEsXG4gIGdhdGV3YXlSZXN1bHRTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgd2lzaGxpc3RDb250cm9sbGVyIH0gZnJvbSBcIi4vd2lzaGxpc3QuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgd2lzaGxpc3RWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3dpc2hsaXN0LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIFNhdmUgYSBwYWNrYWdlIHRvIHRoZSB3aXNobGlzdCAoVVNFUiBvbmx5KVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHdpc2hsaXN0VmFsaWRhdGlvbnMuY3JlYXRlV2lzaGxpc3RTY2hlbWEgfSksXG4gIHdpc2hsaXN0Q29udHJvbGxlci5hZGRUb1dpc2hsaXN0LFxuKTtcblxuLy8gMi4gTXkgd2lzaGxpc3QgKFVTRVIgb25seSkgXHUyMDE0IHBhZ2luYXRlZCwgbmV3ZXN0IGZpcnN0XG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogd2lzaGxpc3RWYWxpZGF0aW9ucy53aXNobGlzdFF1ZXJ5U2NoZW1hIH0pLFxuICB3aXNobGlzdENvbnRyb2xsZXIuZ2V0TXlXaXNobGlzdCxcbik7XG5cbi8vIDMuIFJlbW92ZSBhIHBhY2thZ2UgZnJvbSB0aGUgd2lzaGxpc3QgKFVTRVIgb25seSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzpwYWNrYWdlSWRcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHdpc2hsaXN0VmFsaWRhdGlvbnMud2lzaGxpc3RQYXJhbXNTY2hlbWEgfSksXG4gIHdpc2hsaXN0Q29udHJvbGxlci5yZW1vdmVGcm9tV2lzaGxpc3QsXG4pO1xuXG5leHBvcnQgY29uc3Qgd2lzaGxpc3RSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyB3aXNobGlzdFNlcnZpY2UgfSBmcm9tIFwiLi93aXNobGlzdC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gU2F2ZSBhIHBhY2thZ2UgdG8gdGhlIHdpc2hsaXN0IGNvbnRyb2xsZXIgKFVTRVIpXG5jb25zdCBhZGRUb1dpc2hsaXN0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2lzaGxpc3RTZXJ2aWNlLmFkZFRvV2lzaGxpc3QodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIGFkZGVkIHRvIHdpc2hsaXN0IHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIE15IHdpc2hsaXN0IGNvbnRyb2xsZXIgKFVTRVIpXG5jb25zdCBnZXRNeVdpc2hsaXN0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2lzaGxpc3RTZXJ2aWNlLmdldE15V2lzaGxpc3QodXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIldpc2hsaXN0IHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gUmVtb3ZlIGZyb20gd2lzaGxpc3QgY29udHJvbGxlciAoVVNFUikgXHUyMDE0IDIwNCBzbyBhIHJlcGVhdCBkZWxldGUgaXMgYVxuLy8gICAgbm8tb3AgaW5kaXN0aW5ndWlzaGFibGUgZnJvbSBhIHN1Y2Nlc3NmdWwgb25lIChubyBib2R5LCBubyBlcnJvcikuXG5jb25zdCByZW1vdmVGcm9tV2lzaGxpc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCBwYWNrYWdlSWQgPSBTdHJpbmcocmVxLnBhcmFtcy5wYWNrYWdlSWQpO1xuXG4gICAgYXdhaXQgd2lzaGxpc3RTZXJ2aWNlLnJlbW92ZUZyb21XaXNobGlzdCh1c2VySWQsIHBhY2thZ2VJZCk7XG5cbiAgICByZXMuc3RhdHVzKGh0dHBTdGF0dXMuTk9fQ09OVEVOVCkuc2VuZCgpO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHdpc2hsaXN0Q29udHJvbGxlciA9IHtcbiAgYWRkVG9XaXNobGlzdCxcbiAgZ2V0TXlXaXNobGlzdCxcbiAgcmVtb3ZlRnJvbVdpc2hsaXN0LFxufTsiLCAiaW1wb3J0IHsgUGFja2FnZVN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgcHVibGljUGFja2FnZUluY2x1ZGUgfSBmcm9tIFwiLi4vcGFja2FnZS9wYWNrYWdlLnNlcnZpY2VcIjtcbmltcG9ydCB7IElDcmVhdGVXaXNobGlzdFBheWxvYWQsIElXaXNobGlzdFF1ZXJ5IH0gZnJvbSBcIi4vd2lzaGxpc3QuaW50ZXJmYWNlXCI7XG5cbi8vIE1vbmV5IGlzIGBEZWNpbWFsKDEwLDIpYCBpbiB0aGUgc2NoZW1hIChBR0VOVFMubWQpIFx1MjAxNCBtYXAgdG8gTnVtYmVyIG9uIHJldHVybi5cbmNvbnN0IHNlcmlhbGl6ZVdpc2hsaXN0SXRlbSA9IDxcbiAgVCBleHRlbmRzIHsgcGFja2FnZTogeyBwcmljZTogUHJpc21hLkRlY2ltYWwgfSB9LFxuPihcbiAgcm93OiBULFxuKTogVCA9PiAoe1xuICAuLi5yb3csXG4gIHBhY2thZ2U6IHsgLi4ucm93LnBhY2thZ2UsIHByaWNlOiBOdW1iZXIocm93LnBhY2thZ2UucHJpY2UpIH0sXG59KTtcblxuLy8gMS4gU2F2ZSBhIHBhY2thZ2UgdG8gdGhlIHdpc2hsaXN0IChVU0VSKSBcdTIwMTQgaWRlbXBvdGVudC4gVGhlIHBhY2thZ2UgbXVzdCBiZVxuLy8gICAgQVBQUk9WRUQgYW5kIG5vdCBkZWxldGVkLCBtaXJyb3JpbmcgdGhlIHB1YmxpYy1wYWNrYWdlIHZpc2liaWxpdHkgcnVsZS5cbmNvbnN0IGFkZFRvV2lzaGxpc3QgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJQ3JlYXRlV2lzaGxpc3RQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIGlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHByaXNtYS53aXNobGlzdEl0ZW0udXBzZXJ0KHtcbiAgICB3aGVyZTogeyB1c2VySWRfcGFja2FnZUlkOiB7IHVzZXJJZCwgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9IH0sXG4gICAgY3JlYXRlOiB7IHVzZXJJZCwgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9LFxuICAgIHVwZGF0ZToge30sXG4gIH0pO1xufTtcblxuLy8gMi4gUGFnaW5hdGVkIHdpc2hsaXN0IChVU0VSKSBcdTIwMTQgbmV3ZXN0IGZpcnN0LiBSb3dzIHdob3NlIHBhY2thZ2Ugd2FzIGxhdGVyXG4vLyAgICBzb2Z0LWRlbGV0ZWQgb3IgZGVtb3RlZCBvdXQgb2YgQVBQUk9WRUQgYXJlIGZpbHRlcmVkIGF0IHJlYWQgdGltZSwgc28gdGhlXG4vLyAgICBwYWdlIG5ldmVyIGxpc3RzIGEgcGFja2FnZSB3aG9zZSBkZXRhaWwgcm91dGUgd291bGQgNDA0LlxuY29uc3QgZ2V0TXlXaXNobGlzdCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElXaXNobGlzdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5XaXNobGlzdEl0ZW1XaGVyZUlucHV0ID0ge1xuICAgIHVzZXJJZCxcbiAgICBwYWNrYWdlOiB7IGlzRGVsZXRlZDogZmFsc2UsIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCB9LFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLndpc2hsaXN0SXRlbS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgcGFja2FnZTogeyBpbmNsdWRlOiBwdWJsaWNQYWNrYWdlSW5jbHVkZSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEud2lzaGxpc3RJdGVtLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplV2lzaGxpc3RJdGVtKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAzLiBSZW1vdmUgYSBwYWNrYWdlIGZyb20gdGhlIHdpc2hsaXN0IChVU0VSKSBcdTIwMTQgaWRlbXBvdGVudDsgYSBtaXNzaW5nIHJvdyBpc1xuLy8gICAgYSBuby1vcCwgbmV2ZXIgYW4gZXJyb3IuIERlbGliZXJhdGVseSBubyBcImNsZWFyIGFsbFwiLlxuY29uc3QgcmVtb3ZlRnJvbVdpc2hsaXN0ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYWNrYWdlSWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBwcmlzbWEud2lzaGxpc3RJdGVtLmRlbGV0ZU1hbnkoe1xuICAgIHdoZXJlOiB7IHVzZXJJZCwgcGFja2FnZUlkIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IHdpc2hsaXN0U2VydmljZSA9IHtcbiAgYWRkVG9XaXNobGlzdCxcbiAgZ2V0TXlXaXNobGlzdCxcbiAgcmVtb3ZlRnJvbVdpc2hsaXN0LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlV2lzaGxpc3RTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhY2thZ2VJZDogelxuICAgICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3Qgd2lzaGxpc3RQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5jb25zdCB3aXNobGlzdFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxufSk7XG5cbmV4cG9ydCBjb25zdCB3aXNobGlzdFZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVXaXNobGlzdFNjaGVtYSxcbiAgd2lzaGxpc3RQYXJhbXNTY2hlbWEsXG4gIHdpc2hsaXN0UXVlcnlTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24uY29udHJvbGxlclwiO1xuaW1wb3J0IHsgbm90aWZpY2F0aW9uVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24udmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gTk9URTogUEFUQ0ggL3JlYWQtYWxsIE1VU1Qgc3RheSByZWdpc3RlcmVkIGJlZm9yZSBQQVRDSCAvOmlkL3JlYWQgXHUyMDE0XG4vLyBFeHByZXNzIG1hdGNoZXMgdG9wLWRvd24sIGFuZCBgL3JlYWQtYWxsYCB3b3VsZCBvdGhlcndpc2UgYmUgc3dhbGxvd2VkIGJ5XG4vLyB0aGUgYDppZGAgcGFyYW0gcm91dGUuXG5cbi8vIDEuIE15IG5vdGlmaWNhdGlvbnMgKGFueSBhdXRoZW50aWNhdGVkIHVzZXIpIFx1MjAxNCBwYWdpbmF0ZWQsIG9wdGlvbmFsID91bnJlYWQ9dHJ1ZVxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IG5vdGlmaWNhdGlvblZhbGlkYXRpb25zLm5vdGlmaWNhdGlvblF1ZXJ5U2NoZW1hIH0pLFxuICBub3RpZmljYXRpb25Db250cm9sbGVyLmdldE15Tm90aWZpY2F0aW9ucyxcbik7XG5cbi8vIDIuIFVucmVhZCBjb3VudCBmb3IgdGhlIGJlbGwgYmFkZ2VcbnJvdXRlci5nZXQoXG4gIFwiL3VucmVhZC1jb3VudFwiLFxuICBhdXRoKCksXG4gIG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIuZ2V0VW5yZWFkQ291bnQsXG4pO1xuXG4vLyAzLiBNYXJrIGFsbCBteSBub3RpZmljYXRpb25zIHJlYWRcbnJvdXRlci5wYXRjaChcbiAgXCIvcmVhZC1hbGxcIixcbiAgYXV0aCgpLFxuICBub3RpZmljYXRpb25Db250cm9sbGVyLm1hcmtBbGxBc1JlYWQsXG4pO1xuXG4vLyA0LiBNYXJrIG9uZSBub3RpZmljYXRpb24gcmVhZCAob3duZXIgb25seSlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3JlYWRcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IG5vdGlmaWNhdGlvblZhbGlkYXRpb25zLm5vdGlmaWNhdGlvblBhcmFtc1NjaGVtYSB9KSxcbiAgbm90aWZpY2F0aW9uQ29udHJvbGxlci5tYXJrQXNSZWFkLFxuKTtcblxuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvblJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IG5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24uc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIE15IG5vdGlmaWNhdGlvbnMgY29udHJvbGxlciAoYW55IGF1dGhlbnRpY2F0ZWQgdXNlcilcbmNvbnN0IGdldE15Tm90aWZpY2F0aW9ucyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5vdGlmaWNhdGlvblNlcnZpY2UuZ2V0TXlOb3RpZmljYXRpb25zKFxuICAgICAgdXNlcklkLFxuICAgICAgcmVxLnF1ZXJ5LFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiTm90aWZpY2F0aW9ucyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIFVucmVhZCBjb3VudCBjb250cm9sbGVyIChiZWxsIGJhZGdlKVxuY29uc3QgZ2V0VW5yZWFkQ291bnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBub3RpZmljYXRpb25TZXJ2aWNlLmdldFVucmVhZENvdW50KHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVW5yZWFkIGNvdW50IHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBNYXJrIG9uZSBub3RpZmljYXRpb24gcmVhZCBjb250cm9sbGVyXG5jb25zdCBtYXJrQXNSZWFkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbm90aWZpY2F0aW9uU2VydmljZS5tYXJrQXNSZWFkKHVzZXJJZCwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIk5vdGlmaWNhdGlvbiBtYXJrZWQgYXMgcmVhZC5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIE1hcmsgYWxsIG5vdGlmaWNhdGlvbnMgcmVhZCBjb250cm9sbGVyXG5jb25zdCBtYXJrQWxsQXNSZWFkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbm90aWZpY2F0aW9uU2VydmljZS5tYXJrQWxsQXNSZWFkKHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIG5vdGlmaWNhdGlvbnMgbWFya2VkIGFzIHJlYWQuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3Qgbm90aWZpY2F0aW9uQ29udHJvbGxlciA9IHtcbiAgZ2V0TXlOb3RpZmljYXRpb25zLFxuICBnZXRVbnJlYWRDb3VudCxcbiAgbWFya0FzUmVhZCxcbiAgbWFya0FsbEFzUmVhZCxcbn07IiwgImltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uUXVlcnkgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24uaW50ZXJmYWNlXCI7XG5cbi8vIDEuIE15IG5vdGlmaWNhdGlvbnMgKG5ld2VzdCBmaXJzdCkgXHUyMDE0IG9wdGlvbmFsID91bnJlYWQ9dHJ1ZSBmaWx0ZXIuXG5jb25zdCBnZXRNeU5vdGlmaWNhdGlvbnMgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBxdWVyeTogSU5vdGlmaWNhdGlvblF1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMjA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ob3RpZmljYXRpb25XaGVyZUlucHV0ID0ge1xuICAgIHVzZXJJZCxcbiAgICAuLi4ocXVlcnkudW5yZWFkID8geyBpc1JlYWQ6IGZhbHNlIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEubm90aWZpY2F0aW9uLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLm5vdGlmaWNhdGlvbi5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMi4gVW5yZWFkIGNvdW50IGZvciB0aGUgYmVsbCBiYWRnZSBcdTIwMTQgc2luZ2xlIGluZGV4LWJhY2tlZCBjb3VudC5cbmNvbnN0IGdldFVucmVhZENvdW50ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNvdW50ID0gYXdhaXQgcHJpc21hLm5vdGlmaWNhdGlvbi5jb3VudCh7XG4gICAgd2hlcmU6IHsgdXNlcklkLCBpc1JlYWQ6IGZhbHNlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7IGNvdW50IH07XG59O1xuXG4vLyAzLiBNYXJrIG9uZSBub3RpZmljYXRpb24gcmVhZCAob3duZXIgb25seSBcdTIwMTQgYSBmb3JlaWduIGlkIGlzIGEgNDA0KS5cbmNvbnN0IG1hcmtBc1JlYWQgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLm5vdGlmaWNhdGlvbi51cGRhdGVNYW55KHtcbiAgICB3aGVyZTogeyBpZCwgdXNlcklkIH0sXG4gICAgZGF0YTogeyBpc1JlYWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKHJlc3VsdC5jb3VudCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiTm90aWZpY2F0aW9uIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4geyBjb3VudDogcmVzdWx0LmNvdW50IH07XG59O1xuXG4vLyA0LiBNYXJrIGFsbCBteSBub3RpZmljYXRpb25zIHJlYWQgXHUyMDE0IGlkZW1wb3RlbnQuXG5jb25zdCBtYXJrQWxsQXNSZWFkID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24udXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHsgdXNlcklkLCBpc1JlYWQ6IGZhbHNlIH0sXG4gICAgZGF0YTogeyBpc1JlYWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHsgY291bnQ6IHJlc3VsdC5jb3VudCB9O1xufTtcblxuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSB7XG4gIGdldE15Tm90aWZpY2F0aW9ucyxcbiAgZ2V0VW5yZWFkQ291bnQsXG4gIG1hcmtBc1JlYWQsXG4gIG1hcmtBbGxBc1JlYWQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBub3RpZmljYXRpb25RdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDIwKSxcbiAgLy8gXCJ0cnVlXCIvXCJmYWxzZVwiIHN0cmluZ3Mgb25seSBcdTIwMTQgei5jb2VyY2UuYm9vbGVhbigpIHdvdWxkIHRyZWF0IHRoZSBzdHJpbmdcbiAgLy8gXCJmYWxzZVwiIGFzIHRydXRoeS5cbiAgdW5yZWFkOiB6XG4gICAgLmVudW0oW1widHJ1ZVwiLCBcImZhbHNlXCJdKVxuICAgIC50cmFuc2Zvcm0oKHZhbHVlKSA9PiB2YWx1ZSA9PT0gXCJ0cnVlXCIpXG4gICAgLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3Qgbm90aWZpY2F0aW9uUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOb3RpZmljYXRpb24gaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oMSwgXCJOb3RpZmljYXRpb24gaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG59KTtcblxuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvblZhbGlkYXRpb25zID0ge1xuICBub3RpZmljYXRpb25RdWVyeVNjaGVtYSxcbiAgbm90aWZpY2F0aW9uUGFyYW1zU2NoZW1hLFxufTsiLCAiLy8gVmVyY2VsIHNlcnZlcmxlc3MgZW50cnlwb2ludCBcdTIwMTQgcmUtZXhwb3J0cyB0aGUgc2FtZSBFeHByZXNzIGFwcCB0aGUgbG9jYWxcbi8vIGJ1aWxkIHVzZXMuIFZlcmNlbCdzIEB2ZXJjZWwvbm9kZSBydW50aW1lIGNvbXBpbGVzIGFuZCB3cmFwcyBpdDsgdGhlIGFwcCBpc1xuLy8gc3BsaXQgZnJvbSBzZXJ2ZXIudHMgKHdoaWNoIG9ubHkgc3RhcnRzIHRoZSBsaXN0ZW5lcikgc28gdGhlIHR3byBob3N0cyBzaGFyZVxuLy8gb25lIHJvdXRlIHJlZ2lzdHJ5LlxuaW1wb3J0IGFwcCBmcm9tIFwiLi4vc3JjL2FwcFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhcHA7Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7OztBQUFBLE9BQU8sYUFBK0Q7QUFDdEUsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFlBQVk7QUFDbkIsT0FBTyxlQUFlOzs7QUNMdEIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sVUFBVTtBQUNqQixTQUFTLFNBQVM7QUFFbEIsT0FBTyxPQUFPO0FBQUEsRUFDWixPQUFPO0FBQUEsRUFDUCxNQUFNLEtBQUssS0FBSyxRQUFRLElBQUksR0FBRyxNQUFNO0FBQ3ZDLENBQUM7QUFLRCxJQUFNLFlBQVksRUFBRSxPQUFPO0FBQUEsRUFDekIsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLE1BQU07QUFBQSxFQUMvQixVQUFVLEVBQUUsS0FBSyxDQUFDLGVBQWUsWUFBWSxDQUFDLEVBQUUsUUFBUSxhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1yRSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVM7QUFBQSxFQUM1QyxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVM7QUFBQSxFQUU3QyxjQUFjLEVBQUUsT0FBTyxFQUFFLElBQUksR0FBRywwQkFBMEI7QUFBQSxFQUUxRCxvQkFBb0IsRUFBRSxPQUFPLEVBQUUsUUFBUSxJQUFJO0FBQUE7QUFBQTtBQUFBLEVBSTNDLGFBQWEsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFNBQVM7QUFBQSxFQUN6QyxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLEVBQUUsU0FBUztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU8zQyxzQkFBc0IsRUFBRSxPQUFPLEVBQUUsU0FBUztBQUFBLEVBQzFDLDRCQUE0QixFQUFF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O0FBQ0YsVUFBTSxPQUFPO0FBQ2IsUUFBSSxPQUFPLEdBQUcsRUFBRSxLQUFLO0FBQUEsTUFDbkIsU0FBUztBQUFBLE1BQ1QsU0FBUztBQUFBLE1BQ1QsSUFBSTtBQUFBLE1BQ0osWUFBVyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLElBQ3BDLENBQUM7QUFBQSxFQUNILFNBQVMsT0FBTztBQUNkLFFBQUksT0FBTyxHQUFHLEVBQUUsS0FBSztBQUFBLE1BQ25CLFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULElBQUk7QUFBQSxNQUNKLFlBQVcsb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxJQUNwQyxDQUFDO0FBQUEsRUFDSDtBQUNGLENBQUM7QUFHRCxJQUFJLElBQUksYUFBYSxVQUFVO0FBQy9CLElBQUksSUFBSSxjQUFjLFVBQVU7QUFDaEMsSUFBSSxJQUFJLGdCQUFnQixZQUFZO0FBQ3BDLElBQUksSUFBSSxnQkFBZ0IsYUFBYTtBQUNyQyxJQUFJLElBQUksbUJBQW1CLGNBQWM7QUFDekMsSUFBSSxJQUFJLGlCQUFpQixhQUFhO0FBQ3RDLElBQUksSUFBSSxnQkFBZ0IsWUFBWTtBQUNwQyxJQUFJLElBQUksaUJBQWlCLGFBQWE7QUFDdEMsSUFBSSxJQUFJLGFBQWEsVUFBVTtBQUMvQixJQUFJLElBQUksa0JBQWtCLGVBQWU7QUFDekMsSUFBSSxJQUFJLGlCQUFpQixhQUFhO0FBQ3RDLElBQUksSUFBSSxpQkFBaUIsY0FBYztBQUN2QyxJQUFJLElBQUksc0JBQXNCLGtCQUFrQjtBQUVoRCxJQUFJLElBQUksZ0JBQWU7QUFDdkIsSUFBSSxJQUFJLDBCQUFrQjtBQUUxQixJQUFPLGNBQVE7OztBK0UzSGYsSUFBTyxnQkFBUTsiLAogICJuYW1lcyI6IFsicGF0aCIsICJjb25maWciLCAiQnVmZmVyIiwgIkFueU51bGwiLCAiRGJOdWxsIiwgIkRlY2ltYWwiLCAiSnNvbk51bGwiLCAiTnVsbFR5cGVzIiwgIlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IiLCAiUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IiLCAiUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3IiLCAiUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciIsICJQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IiLCAiU3FsIiwgImVtcHR5IiwgImpvaW4iLCAicmF3IiwgInJ1bnRpbWUiLCAiaHR0cFN0YXR1cyIsICJjcnlwdG8iLCAicGF0aCIsICJjcnlwdG8iLCAicmVmcmVzaFRva2VuIiwgInJlZnJlc2hUb2tlbiIsICJyZWdpc3RlclVzZXIiLCAiaHR0cFN0YXR1cyIsICJsb2dpblVzZXIiLCAiZ29vZ2xlTG9naW4iLCAiZGVtb0xvZ2luIiwgInZlcmlmeUVtYWlsIiwgInJlc2VuZFZlcmlmaWNhdGlvbiIsICJmb3Jnb3RQYXNzd29yZCIsICJyZXNldFBhc3N3b3JkIiwgInoiLCAieiIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJiY3J5cHQiLCAiYmNyeXB0IiwgInVwZGF0ZVByb2ZpbGUiLCAiaHR0cFN0YXR1cyIsICJnZXRVc2VycyIsICJjaGFuZ2VSb2xlIiwgImNoYW5nZVN0YXR1cyIsICJkZWxldGVVc2VyIiwgInoiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJtdWx0ZXIiLCAiaHR0cFN0YXR1cyIsICJodHRwU3RhdHVzIiwgIm11bHRlciIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZU1lc3NhZ2UiLCAiaHR0cFN0YXR1cyIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlQm9va2luZyIsICJodHRwU3RhdHVzIiwgImdldE15Qm9va2luZ3MiLCAiZ2V0QWdlbnRCb29raW5ncyIsICJnZXRCb29raW5nRGV0YWlsIiwgImdldEFsbEJvb2tpbmdzIiwgInVwZGF0ZUJvb2tpbmdTdGF0dXMiLCAieiIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlUmV2aWV3IiwgImh0dHBTdGF0dXMiLCAidXBkYXRlUmV2aWV3IiwgImRlbGV0ZVJldmlldyIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlQ2F0ZWdvcnkiLCAiaHR0cFN0YXR1cyIsICJnZXRBbGxDYXRlZ29yaWVzIiwgInVwZGF0ZUNhdGVnb3J5IiwgImRlbGV0ZUNhdGVnb3J5IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJyYW5kb21VVUlEIiwgInJhbmRvbVVVSUQiLCAiY3JlYXRlUGFja2FnZSIsICJodHRwU3RhdHVzIiwgImdldFB1YmxpY1BhY2thZ2VzIiwgImdldFBhY2thZ2VCeVNsdWciLCAiZ2V0QWxsUGFja2FnZXMiLCAiZ2V0TXlQYWNrYWdlcyIsICJ1cGRhdGVQYWNrYWdlIiwgImNoYW5nZVBhY2thZ2VTdGF0dXMiLCAic29mdERlbGV0ZVBhY2thZ2UiLCAieiIsICJ1cGRhdGVTdGF0dXNTY2hlbWEiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJyYW5kb21VVUlEIiwgImdlbmVyYXRlVW5pcXVlU2x1ZyIsICJyYW5kb21VVUlEIiwgImNyZWF0ZVBvc3QiLCAiaHR0cFN0YXR1cyIsICJnZXRQdWJsaWNQb3N0cyIsICJnZXRQb3N0QnlTbHVnIiwgImdldEFsbFBvc3RzIiwgImdldE15UG9zdHMiLCAidXBkYXRlUG9zdCIsICJjaGFuZ2VQb3N0U3RhdHVzIiwgInNvZnREZWxldGVQb3N0IiwgInoiLCAidGl0bGVTY2hlbWEiLCAidXBkYXRlU3RhdHVzU2NoZW1hIiwgImh0dHBTdGF0dXMiLCAiZ2V0UG9zdENvbW1lbnRzIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlQ29tbWVudCIsICJkZWxldGVDb21tZW50IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJnZXRBZG1pbkRhc2hib2FyZCIsICJodHRwU3RhdHVzIiwgImdldEFnZW50RGFzaGJvYXJkIiwgImdldFVzZXJEYXNoYm9hcmQiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImh0dHBTdGF0dXMiLCAieiIsICJjcmVhdGVTY2hlbWEiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJhZGRUb1dpc2hsaXN0IiwgImh0dHBTdGF0dXMiLCAiZ2V0TXlXaXNobGlzdCIsICJyZW1vdmVGcm9tV2lzaGxpc3QiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImdldE15Tm90aWZpY2F0aW9ucyIsICJodHRwU3RhdHVzIiwgImdldFVucmVhZENvdW50IiwgIm1hcmtBc1JlYWQiLCAibWFya0FsbEFzUmVhZCIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiXQp9Cg==
