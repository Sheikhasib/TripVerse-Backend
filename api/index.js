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
  "inlineSchema": 'model BlogPost {\n  id         String     @id @default(uuid())\n  title      String\n  slug       String     @unique\n  excerpt    String\n  content    String\n  coverImage String\n  status     PostStatus @default(DRAFT)\n  isDeleted  Boolean    @default(false)\n\n  authorId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  author User @relation("AuthorPosts", fields: [authorId], references: [id])\n\n  @@index([status])\n  @@index([authorId])\n  @@map("blog_posts")\n}\n\nmodel Booking {\n  id         String        @id @default(uuid())\n  travelDate DateTime\n  travelers  Int\n  totalPrice Decimal       @db.Decimal(10, 2)\n  status     BookingStatus @default(PENDING)\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user     User        @relation("CustomerBookings", fields: [userId], references: [id])\n  package  TourPackage @relation(fields: [packageId], references: [id])\n  payments Payment[]\n\n  @@index([userId])\n  @@index([packageId])\n  @@index([status])\n  @@index([userId, packageId, travelDate])\n  @@map("bookings")\n}\n\nmodel Category {\n  id   String @id @default(uuid())\n  name String @unique\n  slug String @unique\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages TourPackage[]\n\n  @@map("categories")\n}\n\nmodel ContactMessage {\n  id         String  @id @default(uuid())\n  name       String\n  email      String\n  subject    String\n  message    String\n  isResolved Boolean @default(false)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@index([isResolved])\n  @@map("contact_messages")\n}\n\nenum Role {\n  USER\n  AGENT\n  ADMIN\n}\n\nenum UserStatus {\n  ACTIVE\n  SUSPENDED\n}\n\nenum AuthProvider {\n  CREDENTIAL\n  GOOGLE\n}\n\nenum PackageStatus {\n  PENDING\n  APPROVED\n  REJECTED\n}\n\nenum BookingStatus {\n  PENDING\n  PAID\n  CONFIRMED\n  CANCELLED\n  COMPLETED\n}\n\nenum PaymentStatus {\n  INITIATED\n  SUCCESS\n  FAILED\n  CANCELLED\n  REFUNDED\n}\n\nenum PostStatus {\n  DRAFT\n  PUBLISHED\n}\n\nenum NotificationType {\n  BOOKING_CREATED\n  BOOKING_CONFIRMED\n  BOOKING_CANCELLED\n  PACKAGE_APPROVED\n  PACKAGE_REJECTED\n}\n\nmodel Notification {\n  id      String           @id @default(uuid())\n  userId  String\n  type    NotificationType\n  title   String\n  message String\n  link    String?\n  isRead  Boolean          @default(false)\n\n  createdAt DateTime @default(now())\n\n  user User @relation(fields: [userId], references: [id])\n\n  @@index([userId, isRead, createdAt])\n  @@map("notifications")\n}\n\nmodel Payment {\n  id             String        @id @default(uuid())\n  bookingId      String\n  tranId         String        @unique // SSLCommerz transaction id, generated server-side\n  valId          String? // set after gateway success, used for server-side validation\n  amount         Decimal       @db.Decimal(10, 2) // = booking.totalPrice at session creation\n  currency       String        @default("BDT")\n  status         PaymentStatus @default(INITIATED)\n  gatewayPageUrl String?\n  sslSessionKey  String?\n  cardType       String?\n  bankTranId     String?\n  paidAt         DateTime?\n  refundRefId    String? // SSLCommerz refund reference (set when a refund is initiated)\n  refundedAt     DateTime? // when the refund was initiated/settled\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  booking Booking @relation(fields: [bookingId], references: [id])\n\n  @@index([bookingId])\n  @@index([status])\n  @@map("payments")\n}\n\nmodel Review {\n  id      String @id @default(uuid())\n  rating  Int\n  comment String\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user    User        @relation("CustomerReviews", fields: [userId], references: [id])\n  package TourPackage @relation(fields: [packageId], references: [id])\n\n  @@unique([userId, packageId])\n  @@index([packageId])\n  @@map("reviews")\n}\n\n// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../../generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\nmodel TourPackage {\n  id          String        @id @default(uuid())\n  title       String\n  slug        String        @unique\n  description String\n  location    String\n  price       Decimal       @db.Decimal(10, 2)\n  duration    Int\n  rating      Float         @default(0)\n  images      String[]\n  status      PackageStatus @default(PENDING)\n  isDeleted   Boolean       @default(false)\n\n  categoryId String\n  agentId    String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  category      Category       @relation(fields: [categoryId], references: [id])\n  agent         User           @relation("AgentPackages", fields: [agentId], references: [id])\n  bookings      Booking[]\n  reviews       Review[]\n  wishlistItems WishlistItem[]\n\n  @@index([categoryId])\n  @@index([categoryId, price])\n  @@index([price])\n  @@index([status])\n  @@map("tour_packages")\n}\n\nmodel User {\n  id            String       @id @default(uuid())\n  name          String\n  email         String       @unique\n  password      String?\n  googleId      String?      @unique\n  phone         String?\n  avatarUrl     String?\n  role          Role         @default(USER)\n  status        UserStatus   @default(ACTIVE)\n  authProvider  AuthProvider @default(CREDENTIAL)\n  emailVerified Boolean      @default(false)\n  isDeleted     Boolean      @default(false)\n  tokenVersion  Int          @default(0)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages      TourPackage[]  @relation("AgentPackages")\n  bookings      Booking[]      @relation("CustomerBookings")\n  reviews       Review[]       @relation("CustomerReviews")\n  posts         BlogPost[]     @relation("AuthorPosts")\n  wishlist      WishlistItem[]\n  notifications Notification[]\n\n  @@index([role])\n  @@index([status])\n  @@map("users")\n}\n\nmodel WishlistItem {\n  id        String @id @default(uuid())\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n\n  user    User        @relation(fields: [userId], references: [id])\n  package TourPackage @relation(fields: [packageId], references: [id])\n\n  @@unique([userId, packageId])\n  @@index([userId, createdAt])\n  @@map("wishlist_items")\n}\n',
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
config2.runtimeDataModel = JSON.parse('{"models":{"BlogPost":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"excerpt","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"coverImage","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PostStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"authorId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"author","kind":"object","type":"User","relationName":"AuthorPosts"}],"dbName":"blog_posts"},"Booking":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"travelDate","kind":"scalar","type":"DateTime"},{"name":"travelers","kind":"scalar","type":"Int"},{"name":"totalPrice","kind":"scalar","type":"Decimal"},{"name":"status","kind":"enum","type":"BookingStatus"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerBookings"},{"name":"package","kind":"object","type":"TourPackage","relationName":"BookingToTourPackage"},{"name":"payments","kind":"object","type":"Payment","relationName":"BookingToPayment"}],"dbName":"bookings"},"Category":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"CategoryToTourPackage"}],"dbName":"categories"},"ContactMessage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"isResolved","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"contact_messages"},"Notification":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"type","kind":"enum","type":"NotificationType"},{"name":"title","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"link","kind":"scalar","type":"String"},{"name":"isRead","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"NotificationToUser"}],"dbName":"notifications"},"Payment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"bookingId","kind":"scalar","type":"String"},{"name":"tranId","kind":"scalar","type":"String"},{"name":"valId","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Decimal"},{"name":"currency","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PaymentStatus"},{"name":"gatewayPageUrl","kind":"scalar","type":"String"},{"name":"sslSessionKey","kind":"scalar","type":"String"},{"name":"cardType","kind":"scalar","type":"String"},{"name":"bankTranId","kind":"scalar","type":"String"},{"name":"paidAt","kind":"scalar","type":"DateTime"},{"name":"refundRefId","kind":"scalar","type":"String"},{"name":"refundedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"booking","kind":"object","type":"Booking","relationName":"BookingToPayment"}],"dbName":"payments"},"Review":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"rating","kind":"scalar","type":"Int"},{"name":"comment","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerReviews"},{"name":"package","kind":"object","type":"TourPackage","relationName":"ReviewToTourPackage"}],"dbName":"reviews"},"TourPackage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"location","kind":"scalar","type":"String"},{"name":"price","kind":"scalar","type":"Decimal"},{"name":"duration","kind":"scalar","type":"Int"},{"name":"rating","kind":"scalar","type":"Float"},{"name":"images","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PackageStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"categoryId","kind":"scalar","type":"String"},{"name":"agentId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"category","kind":"object","type":"Category","relationName":"CategoryToTourPackage"},{"name":"agent","kind":"object","type":"User","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"BookingToTourPackage"},{"name":"reviews","kind":"object","type":"Review","relationName":"ReviewToTourPackage"},{"name":"wishlistItems","kind":"object","type":"WishlistItem","relationName":"TourPackageToWishlistItem"}],"dbName":"tour_packages"},"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"googleId","kind":"scalar","type":"String"},{"name":"phone","kind":"scalar","type":"String"},{"name":"avatarUrl","kind":"scalar","type":"String"},{"name":"role","kind":"enum","type":"Role"},{"name":"status","kind":"enum","type":"UserStatus"},{"name":"authProvider","kind":"enum","type":"AuthProvider"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"tokenVersion","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"CustomerBookings"},{"name":"reviews","kind":"object","type":"Review","relationName":"CustomerReviews"},{"name":"posts","kind":"object","type":"BlogPost","relationName":"AuthorPosts"},{"name":"wishlist","kind":"object","type":"WishlistItem","relationName":"UserToWishlistItem"},{"name":"notifications","kind":"object","type":"Notification","relationName":"NotificationToUser"}],"dbName":"users"},"WishlistItem":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"UserToWishlistItem"},{"name":"package","kind":"object","type":"TourPackage","relationName":"TourPackageToWishlistItem"}],"dbName":"wishlist_items"}},"enums":{},"types":{}}');
config2.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","packages","_count","category","agent","user","package","booking","payments","bookings","reviews","wishlistItems","posts","wishlist","notifications","author","BlogPost.findUnique","BlogPost.findUniqueOrThrow","BlogPost.findFirst","BlogPost.findFirstOrThrow","BlogPost.findMany","data","BlogPost.createOne","BlogPost.createMany","BlogPost.createManyAndReturn","BlogPost.updateOne","BlogPost.updateMany","BlogPost.updateManyAndReturn","create","update","BlogPost.upsertOne","BlogPost.deleteOne","BlogPost.deleteMany","having","_min","_max","BlogPost.groupBy","BlogPost.aggregate","Booking.findUnique","Booking.findUniqueOrThrow","Booking.findFirst","Booking.findFirstOrThrow","Booking.findMany","Booking.createOne","Booking.createMany","Booking.createManyAndReturn","Booking.updateOne","Booking.updateMany","Booking.updateManyAndReturn","Booking.upsertOne","Booking.deleteOne","Booking.deleteMany","_avg","_sum","Booking.groupBy","Booking.aggregate","Category.findUnique","Category.findUniqueOrThrow","Category.findFirst","Category.findFirstOrThrow","Category.findMany","Category.createOne","Category.createMany","Category.createManyAndReturn","Category.updateOne","Category.updateMany","Category.updateManyAndReturn","Category.upsertOne","Category.deleteOne","Category.deleteMany","Category.groupBy","Category.aggregate","ContactMessage.findUnique","ContactMessage.findUniqueOrThrow","ContactMessage.findFirst","ContactMessage.findFirstOrThrow","ContactMessage.findMany","ContactMessage.createOne","ContactMessage.createMany","ContactMessage.createManyAndReturn","ContactMessage.updateOne","ContactMessage.updateMany","ContactMessage.updateManyAndReturn","ContactMessage.upsertOne","ContactMessage.deleteOne","ContactMessage.deleteMany","ContactMessage.groupBy","ContactMessage.aggregate","Notification.findUnique","Notification.findUniqueOrThrow","Notification.findFirst","Notification.findFirstOrThrow","Notification.findMany","Notification.createOne","Notification.createMany","Notification.createManyAndReturn","Notification.updateOne","Notification.updateMany","Notification.updateManyAndReturn","Notification.upsertOne","Notification.deleteOne","Notification.deleteMany","Notification.groupBy","Notification.aggregate","Payment.findUnique","Payment.findUniqueOrThrow","Payment.findFirst","Payment.findFirstOrThrow","Payment.findMany","Payment.createOne","Payment.createMany","Payment.createManyAndReturn","Payment.updateOne","Payment.updateMany","Payment.updateManyAndReturn","Payment.upsertOne","Payment.deleteOne","Payment.deleteMany","Payment.groupBy","Payment.aggregate","Review.findUnique","Review.findUniqueOrThrow","Review.findFirst","Review.findFirstOrThrow","Review.findMany","Review.createOne","Review.createMany","Review.createManyAndReturn","Review.updateOne","Review.updateMany","Review.updateManyAndReturn","Review.upsertOne","Review.deleteOne","Review.deleteMany","Review.groupBy","Review.aggregate","TourPackage.findUnique","TourPackage.findUniqueOrThrow","TourPackage.findFirst","TourPackage.findFirstOrThrow","TourPackage.findMany","TourPackage.createOne","TourPackage.createMany","TourPackage.createManyAndReturn","TourPackage.updateOne","TourPackage.updateMany","TourPackage.updateManyAndReturn","TourPackage.upsertOne","TourPackage.deleteOne","TourPackage.deleteMany","TourPackage.groupBy","TourPackage.aggregate","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","User.upsertOne","User.deleteOne","User.deleteMany","User.groupBy","User.aggregate","WishlistItem.findUnique","WishlistItem.findUniqueOrThrow","WishlistItem.findFirst","WishlistItem.findFirstOrThrow","WishlistItem.findMany","WishlistItem.createOne","WishlistItem.createMany","WishlistItem.createManyAndReturn","WishlistItem.updateOne","WishlistItem.updateMany","WishlistItem.updateManyAndReturn","WishlistItem.upsertOne","WishlistItem.deleteOne","WishlistItem.deleteMany","WishlistItem.groupBy","WishlistItem.aggregate","AND","OR","NOT","id","userId","packageId","createdAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","name","email","password","googleId","phone","avatarUrl","Role","role","UserStatus","status","AuthProvider","authProvider","emailVerified","isDeleted","tokenVersion","updatedAt","every","some","none","title","slug","description","location","price","duration","rating","images","PackageStatus","categoryId","agentId","has","hasEvery","hasSome","comment","bookingId","tranId","valId","amount","currency","PaymentStatus","gatewayPageUrl","sslSessionKey","cardType","bankTranId","paidAt","refundRefId","refundedAt","NotificationType","type","message","link","isRead","subject","isResolved","travelDate","travelers","totalPrice","BookingStatus","excerpt","content","coverImage","PostStatus","authorId","userId_packageId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","push","increment","decrement","multiply","divide"]'),
  graph: "nwVfoAEPEQAA4AIAILoBAADhAgAwuwEAAB8AELwBAADhAgAwvQEBAAAAAcABQAC1AgAh1QEAAOICigIi2QEgALMCACHbAUAAtQIAId8BAQCuAgAh4AEBAAAAAYYCAQCuAgAhhwIBAK4CACGIAgEArgIAIYoCAQCuAgAhAQAAAAEAIBcFAADzAgAgBgAA4AIAIAsAALcCACAMAAC4AgAgDQAAugIAILoBAADwAgAwuwEAAAMAELwBAADwAgAwvQEBAK4CACHAAUAAtQIAIdUBAADyAugBItkBIACzAgAh2wFAALUCACHfAQEArgIAIeABAQCuAgAh4QEBAK4CACHiAQEArgIAIeMBEADpAgAh5AECALQCACHlAQgA8QIAIeYBAAC_AgAg6AEBAK4CACHpAQEArgIAIQUFAADdBAAgBgAA2QQAIAsAAKEEACAMAACiBAAgDQAApAQAIBcFAADzAgAgBgAA4AIAIAsAALcCACAMAAC4AgAgDQAAugIAILoBAADwAgAwuwEAAAMAELwBAADwAgAwvQEBAAAAAcABQAC1AgAh1QEAAPIC6AEi2QEgALMCACHbAUAAtQIAId8BAQCuAgAh4AEBAAAAAeEBAQCuAgAh4gEBAK4CACHjARAA6QIAIeQBAgC0AgAh5QEIAPECACHmAQAAvwIAIOgBAQCuAgAh6QEBAK4CACEDAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAEAAAADACAPBwAA4AIAIAgAAOUCACAKAADvAgAgugEAAO0CADC7AQAACQAQvAEAAO0CADC9AQEArgIAIb4BAQCuAgAhvwEBAK4CACHAAUAAtQIAIdUBAADuAoYCItsBQAC1AgAhggJAALUCACGDAgIAtAIAIYQCEADpAgAhAwcAANkEACAIAADaBAAgCgAA3AQAIA8HAADgAgAgCAAA5QIAIAoAAO8CACC6AQAA7QIAMLsBAAAJABC8AQAA7QIAML0BAQAAAAG-AQEArgIAIb8BAQCuAgAhwAFAALUCACHVAQAA7gKGAiLbAUAAtQIAIYICQAC1AgAhgwICALQCACGEAhAA6QIAIQMAAAAJACABAAAKADACAAALACAUCQAA7AIAILoBAADoAgAwuwEAAA0AELwBAADoAgAwvQEBAK4CACHAAUAAtQIAIdUBAADqAvQBItsBQAC1AgAh7gEBAK4CACHvAQEArgIAIfABAQCvAgAh8QEQAOkCACHyAQEArgIAIfQBAQCvAgAh9QEBAK8CACH2AQEArwIAIfcBAQCvAgAh-AFAAOsCACH5AQEArwIAIfoBQADrAgAhCQkAANsEACDwAQAA_QIAIPQBAAD9AgAg9QEAAP0CACD2AQAA_QIAIPcBAAD9AgAg-AEAAP0CACD5AQAA_QIAIPoBAAD9AgAgFAkAAOwCACC6AQAA6AIAMLsBAAANABC8AQAA6AIAML0BAQAAAAHAAUAAtQIAIdUBAADqAvQBItsBQAC1AgAh7gEBAK4CACHvAQEAAAAB8AEBAK8CACHxARAA6QIAIfIBAQCuAgAh9AEBAK8CACH1AQEArwIAIfYBAQCvAgAh9wEBAK8CACH4AUAA6wIAIfkBAQCvAgAh-gFAAOsCACEDAAAADQAgAQAADgAwAgAADwAgAQAAAA0AIAwHAADgAgAgCAAA5QIAILoBAADnAgAwuwEAABIAELwBAADnAgAwvQEBAK4CACG-AQEArgIAIb8BAQCuAgAhwAFAALUCACHbAUAAtQIAIeUBAgC0AgAh7QEBAK4CACECBwAA2QQAIAgAANoEACANBwAA4AIAIAgAAOUCACC6AQAA5wIAMLsBAAASABC8AQAA5wIAML0BAQAAAAG-AQEArgIAIb8BAQCuAgAhwAFAALUCACHbAUAAtQIAIeUBAgC0AgAh7QEBAK4CACGLAgAA5gIAIAMAAAASACABAAATADACAAAUACAJBwAA4AIAIAgAAOUCACC6AQAA5AIAMLsBAAAWABC8AQAA5AIAML0BAQCuAgAhvgEBAK4CACG_AQEArgIAIcABQAC1AgAhAgcAANkEACAIAADaBAAgCgcAAOACACAIAADlAgAgugEAAOQCADC7AQAAFgAQvAEAAOQCADC9AQEAAAABvgEBAK4CACG_AQEArgIAIcABQAC1AgAhiwIAAOMCACADAAAAFgAgAQAAFwAwAgAAGAAgAQAAAAkAIAEAAAASACABAAAAFgAgAwAAAAkAIAEAAAoAMAIAAAsAIAMAAAASACABAAATADACAAAUACAPEQAA4AIAILoBAADhAgAwuwEAAB8AELwBAADhAgAwvQEBAK4CACHAAUAAtQIAIdUBAADiAooCItkBIACzAgAh2wFAALUCACHfAQEArgIAIeABAQCuAgAhhgIBAK4CACGHAgEArgIAIYgCAQCuAgAhigIBAK4CACEBEQAA2QQAIAMAAAAfACABAAAgADACAAABACADAAAAFgAgAQAAFwAwAgAAGAAgDAcAAOACACC6AQAA3gIAMLsBAAAjABC8AQAA3gIAML0BAQCuAgAhvgEBAK4CACHAAUAAtQIAId8BAQCuAgAh_AEAAN8C_AEi_QEBAK4CACH-AQEArwIAIf8BIACzAgAhAgcAANkEACD-AQAA_QIAIAwHAADgAgAgugEAAN4CADC7AQAAIwAQvAEAAN4CADC9AQEAAAABvgEBAK4CACHAAUAAtQIAId8BAQCuAgAh_AEAAN8C_AEi_QEBAK4CACH-AQEArwIAIf8BIACzAgAhAwAAACMAIAEAACQAMAIAACUAIAEAAAADACABAAAACQAgAQAAABIAIAEAAAAfACABAAAAFgAgAQAAACMAIAEAAAABACADAAAAHwAgAQAAIAAwAgAAAQAgAwAAAB8AIAEAACAAMAIAAAEAIAMAAAAfACABAAAgADACAAABACAMEQAA2AQAIL0BAQAAAAHAAUAAAAAB1QEAAACKAgLZASAAAAAB2wFAAAAAAd8BAQAAAAHgAQEAAAABhgIBAAAAAYcCAQAAAAGIAgEAAAABigIBAAAAAQEXAAAxACALvQEBAAAAAcABQAAAAAHVAQAAAIoCAtkBIAAAAAHbAUAAAAAB3wEBAAAAAeABAQAAAAGGAgEAAAABhwIBAAAAAYgCAQAAAAGKAgEAAAABARcAADMAMAEXAAAzADAMEQAA1wQAIL0BAQD3AgAhwAFAAPgCACHVAQAAsgOKAiLZASAAhwMAIdsBQAD4AgAh3wEBAPcCACHgAQEA9wIAIYYCAQD3AgAhhwIBAPcCACGIAgEA9wIAIYoCAQD3AgAhAgAAAAEAIBcAADYAIAu9AQEA9wIAIcABQAD4AgAh1QEAALIDigIi2QEgAIcDACHbAUAA-AIAId8BAQD3AgAh4AEBAPcCACGGAgEA9wIAIYcCAQD3AgAhiAIBAPcCACGKAgEA9wIAIQIAAAAfACAXAAA4ACACAAAAHwAgFwAAOAAgAwAAAAEAIB4AADEAIB8AADYAIAEAAAABACABAAAAHwAgAwQAANQEACAkAADWBAAgJQAA1QQAIA66AQAA2gIAMLsBAAA_ABC8AQAA2gIAML0BAQCSAgAhwAFAAJMCACHVAQAA2wKKAiLZASAAngIAIdsBQACTAgAh3wEBAJICACHgAQEAkgIAIYYCAQCSAgAhhwIBAJICACGIAgEAkgIAIYoCAQCSAgAhAwAAAB8AIAEAAD4AMCMAAD8AIAMAAAAfACABAAAgADACAAABACABAAAACwAgAQAAAAsAIAMAAAAJACABAAAKADACAAALACADAAAACQAgAQAACgAwAgAACwAgAwAAAAkAIAEAAAoAMAIAAAsAIAwHAACTBAAgCAAA4QMAIAoAAOIDACC9AQEAAAABvgEBAAAAAb8BAQAAAAHAAUAAAAAB1QEAAACGAgLbAUAAAAABggJAAAAAAYMCAgAAAAGEAhAAAAABARcAAEcAIAm9AQEAAAABvgEBAAAAAb8BAQAAAAHAAUAAAAAB1QEAAACGAgLbAUAAAAABggJAAAAAAYMCAgAAAAGEAhAAAAABARcAAEkAMAEXAABJADAMBwAAkQQAIAgAANADACAKAADRAwAgvQEBAPcCACG-AQEA9wIAIb8BAQD3AgAhwAFAAPgCACHVAQAAzgOGAiLbAUAA-AIAIYICQAD4AgAhgwICAIgDACGEAhAAzQMAIQIAAAALACAXAABMACAJvQEBAPcCACG-AQEA9wIAIb8BAQD3AgAhwAFAAPgCACHVAQAAzgOGAiLbAUAA-AIAIYICQAD4AgAhgwICAIgDACGEAhAAzQMAIQIAAAAJACAXAABOACACAAAACQAgFwAATgAgAwAAAAsAIB4AAEcAIB8AAEwAIAEAAAALACABAAAACQAgBQQAAM8EACAkAADSBAAgJQAA0QQAIDYAANAEACA3AADTBAAgDLoBAADWAgAwuwEAAFUAELwBAADWAgAwvQEBAJICACG-AQEAkgIAIb8BAQCSAgAhwAFAAJMCACHVAQAA1wKGAiLbAUAAkwIAIYICQACTAgAhgwICAJ8CACGEAhAAvQIAIQMAAAAJACABAABUADAjAABVACADAAAACQAgAQAACgAwAgAACwAgCQMAALYCACC6AQAA1QIAMLsBAABbABC8AQAA1QIAML0BAQAAAAHAAUAAtQIAIcwBAQAAAAHbAUAAtQIAIeABAQAAAAEBAAAAWAAgAQAAAFgAIAkDAAC2AgAgugEAANUCADC7AQAAWwAQvAEAANUCADC9AQEArgIAIcABQAC1AgAhzAEBAK4CACHbAUAAtQIAIeABAQCuAgAhAQMAAKAEACADAAAAWwAgAQAAXAAwAgAAWAAgAwAAAFsAIAEAAFwAMAIAAFgAIAMAAABbACABAABcADACAABYACAGAwAAzgQAIL0BAQAAAAHAAUAAAAABzAEBAAAAAdsBQAAAAAHgAQEAAAABARcAAGAAIAW9AQEAAAABwAFAAAAAAcwBAQAAAAHbAUAAAAAB4AEBAAAAAQEXAABiADABFwAAYgAwBgMAAMQEACC9AQEA9wIAIcABQAD4AgAhzAEBAPcCACHbAUAA-AIAIeABAQD3AgAhAgAAAFgAIBcAAGUAIAW9AQEA9wIAIcABQAD4AgAhzAEBAPcCACHbAUAA-AIAIeABAQD3AgAhAgAAAFsAIBcAAGcAIAIAAABbACAXAABnACADAAAAWAAgHgAAYAAgHwAAZQAgAQAAAFgAIAEAAABbACADBAAAwQQAICQAAMMEACAlAADCBAAgCLoBAADUAgAwuwEAAG4AELwBAADUAgAwvQEBAJICACHAAUAAkwIAIcwBAQCSAgAh2wFAAJMCACHgAQEAkgIAIQMAAABbACABAABtADAjAABuACADAAAAWwAgAQAAXAAwAgAAWAAgC7oBAADTAgAwuwEAAHQAELwBAADTAgAwvQEBAAAAAcABQAC1AgAhzAEBAK4CACHNAQEArgIAIdsBQAC1AgAh_QEBAK4CACGAAgEArgIAIYECIACzAgAhAQAAAHEAIAEAAABxACALugEAANMCADC7AQAAdAAQvAEAANMCADC9AQEArgIAIcABQAC1AgAhzAEBAK4CACHNAQEArgIAIdsBQAC1AgAh_QEBAK4CACGAAgEArgIAIYECIACzAgAhAAMAAAB0ACABAAB1ADACAABxACADAAAAdAAgAQAAdQAwAgAAcQAgAwAAAHQAIAEAAHUAMAIAAHEAIAi9AQEAAAABwAFAAAAAAcwBAQAAAAHNAQEAAAAB2wFAAAAAAf0BAQAAAAGAAgEAAAABgQIgAAAAAQEXAAB5ACAIvQEBAAAAAcABQAAAAAHMAQEAAAABzQEBAAAAAdsBQAAAAAH9AQEAAAABgAIBAAAAAYECIAAAAAEBFwAAewAwARcAAHsAMAi9AQEA9wIAIcABQAD4AgAhzAEBAPcCACHNAQEA9wIAIdsBQAD4AgAh_QEBAPcCACGAAgEA9wIAIYECIACHAwAhAgAAAHEAIBcAAH4AIAi9AQEA9wIAIcABQAD4AgAhzAEBAPcCACHNAQEA9wIAIdsBQAD4AgAh_QEBAPcCACGAAgEA9wIAIYECIACHAwAhAgAAAHQAIBcAAIABACACAAAAdAAgFwAAgAEAIAMAAABxACAeAAB5ACAfAAB-ACABAAAAcQAgAQAAAHQAIAMEAAC-BAAgJAAAwAQAICUAAL8EACALugEAANICADC7AQAAhwEAELwBAADSAgAwvQEBAJICACHAAUAAkwIAIcwBAQCSAgAhzQEBAJICACHbAUAAkwIAIf0BAQCSAgAhgAIBAJICACGBAiAAngIAIQMAAAB0ACABAACGAQAwIwAAhwEAIAMAAAB0ACABAAB1ADACAABxACABAAAAJQAgAQAAACUAIAMAAAAjACABAAAkADACAAAlACADAAAAIwAgAQAAJAAwAgAAJQAgAwAAACMAIAEAACQAMAIAACUAIAkHAAC9BAAgvQEBAAAAAb4BAQAAAAHAAUAAAAAB3wEBAAAAAfwBAAAA_AEC_QEBAAAAAf4BAQAAAAH_ASAAAAABARcAAI8BACAIvQEBAAAAAb4BAQAAAAHAAUAAAAAB3wEBAAAAAfwBAAAA_AEC_QEBAAAAAf4BAQAAAAH_ASAAAAABARcAAJEBADABFwAAkQEAMAkHAAC8BAAgvQEBAPcCACG-AQEA9wIAIcABQAD4AgAh3wEBAPcCACH8AQAAmQP8ASL9AQEA9wIAIf4BAQCDAwAh_wEgAIcDACECAAAAJQAgFwAAlAEAIAi9AQEA9wIAIb4BAQD3AgAhwAFAAPgCACHfAQEA9wIAIfwBAACZA_wBIv0BAQD3AgAh_gEBAIMDACH_ASAAhwMAIQIAAAAjACAXAACWAQAgAgAAACMAIBcAAJYBACADAAAAJQAgHgAAjwEAIB8AAJQBACABAAAAJQAgAQAAACMAIAQEAAC5BAAgJAAAuwQAICUAALoEACD-AQAA_QIAIAu6AQAAzgIAMLsBAACdAQAQvAEAAM4CADC9AQEAkgIAIb4BAQCSAgAhwAFAAJMCACHfAQEAkgIAIfwBAADPAvwBIv0BAQCSAgAh_gEBAJoCACH_ASAAngIAIQMAAAAjACABAACcAQAwIwAAnQEAIAMAAAAjACABAAAkADACAAAlACABAAAADwAgAQAAAA8AIAMAAAANACABAAAOADACAAAPACADAAAADQAgAQAADgAwAgAADwAgAwAAAA0AIAEAAA4AMAIAAA8AIBEJAAC4BAAgvQEBAAAAAcABQAAAAAHVAQAAAPQBAtsBQAAAAAHuAQEAAAAB7wEBAAAAAfABAQAAAAHxARAAAAAB8gEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfcBAQAAAAH4AUAAAAAB-QEBAAAAAfoBQAAAAAEBFwAApQEAIBC9AQEAAAABwAFAAAAAAdUBAAAA9AEC2wFAAAAAAe4BAQAAAAHvAQEAAAAB8AEBAAAAAfEBEAAAAAHyAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB9wEBAAAAAfgBQAAAAAH5AQEAAAAB-gFAAAAAAQEXAACnAQAwARcAAKcBADARCQAAtwQAIL0BAQD3AgAhwAFAAPgCACHVAQAA3AP0ASLbAUAA-AIAIe4BAQD3AgAh7wEBAPcCACHwAQEAgwMAIfEBEADNAwAh8gEBAPcCACH0AQEAgwMAIfUBAQCDAwAh9gEBAIMDACH3AQEAgwMAIfgBQADdAwAh-QEBAIMDACH6AUAA3QMAIQIAAAAPACAXAACqAQAgEL0BAQD3AgAhwAFAAPgCACHVAQAA3AP0ASLbAUAA-AIAIe4BAQD3AgAh7wEBAPcCACHwAQEAgwMAIfEBEADNAwAh8gEBAPcCACH0AQEAgwMAIfUBAQCDAwAh9gEBAIMDACH3AQEAgwMAIfgBQADdAwAh-QEBAIMDACH6AUAA3QMAIQIAAAANACAXAACsAQAgAgAAAA0AIBcAAKwBACADAAAADwAgHgAApQEAIB8AAKoBACABAAAADwAgAQAAAA0AIA0EAACyBAAgJAAAtQQAICUAALQEACA2AACzBAAgNwAAtgQAIPABAAD9AgAg9AEAAP0CACD1AQAA_QIAIPYBAAD9AgAg9wEAAP0CACD4AQAA_QIAIPkBAAD9AgAg-gEAAP0CACATugEAAMcCADC7AQAAswEAELwBAADHAgAwvQEBAJICACHAAUAAkwIAIdUBAADIAvQBItsBQACTAgAh7gEBAJICACHvAQEAkgIAIfABAQCaAgAh8QEQAL0CACHyAQEAkgIAIfQBAQCaAgAh9QEBAJoCACH2AQEAmgIAIfcBAQCaAgAh-AFAAMkCACH5AQEAmgIAIfoBQADJAgAhAwAAAA0AIAEAALIBADAjAACzAQAgAwAAAA0AIAEAAA4AMAIAAA8AIAEAAAAUACABAAAAFAAgAwAAABIAIAEAABMAMAIAABQAIAMAAAASACABAAATADACAAAUACADAAAAEgAgAQAAEwAwAgAAFAAgCQcAAIgEACAIAADCAwAgvQEBAAAAAb4BAQAAAAG_AQEAAAABwAFAAAAAAdsBQAAAAAHlAQIAAAAB7QEBAAAAAQEXAAC7AQAgB70BAQAAAAG-AQEAAAABvwEBAAAAAcABQAAAAAHbAUAAAAAB5QECAAAAAe0BAQAAAAEBFwAAvQEAMAEXAAC9AQAwCQcAAIYEACAIAADAAwAgvQEBAPcCACG-AQEA9wIAIb8BAQD3AgAhwAFAAPgCACHbAUAA-AIAIeUBAgCIAwAh7QEBAPcCACECAAAAFAAgFwAAwAEAIAe9AQEA9wIAIb4BAQD3AgAhvwEBAPcCACHAAUAA-AIAIdsBQAD4AgAh5QECAIgDACHtAQEA9wIAIQIAAAASACAXAADCAQAgAgAAABIAIBcAAMIBACADAAAAFAAgHgAAuwEAIB8AAMABACABAAAAFAAgAQAAABIAIAUEAACtBAAgJAAAsAQAICUAAK8EACA2AACuBAAgNwAAsQQAIAq6AQAAxgIAMLsBAADJAQAQvAEAAMYCADC9AQEAkgIAIb4BAQCSAgAhvwEBAJICACHAAUAAkwIAIdsBQACTAgAh5QECAJ8CACHtAQEAkgIAIQMAAAASACABAADIAQAwIwAAyQEAIAMAAAASACABAAATADACAAAUACABAAAABQAgAQAAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIBQFAACWBAAgBgAArAQAIAsAAJcEACAMAACYBAAgDQAAmQQAIL0BAQAAAAHAAUAAAAAB1QEAAADoAQLZASAAAAAB2wFAAAAAAd8BAQAAAAHgAQEAAAAB4QEBAAAAAeIBAQAAAAHjARAAAAAB5AECAAAAAeUBCAAAAAHmAQAAlQQAIOgBAQAAAAHpAQEAAAABARcAANEBACAPvQEBAAAAAcABQAAAAAHVAQAAAOgBAtkBIAAAAAHbAUAAAAAB3wEBAAAAAeABAQAAAAHhAQEAAAAB4gEBAAAAAeMBEAAAAAHkAQIAAAAB5QEIAAAAAeYBAACVBAAg6AEBAAAAAekBAQAAAAEBFwAA0wEAMAEXAADTAQAwFAUAAPEDACAGAACrBAAgCwAA8gMAIAwAAPMDACANAAD0AwAgvQEBAPcCACHAAUAA-AIAIdUBAADvA-gBItkBIACHAwAh2wFAAPgCACHfAQEA9wIAIeABAQD3AgAh4QEBAPcCACHiAQEA9wIAIeMBEADNAwAh5AECAIgDACHlAQgA7QMAIeYBAADuAwAg6AEBAPcCACHpAQEA9wIAIQIAAAAFACAXAADWAQAgD70BAQD3AgAhwAFAAPgCACHVAQAA7wPoASLZASAAhwMAIdsBQAD4AgAh3wEBAPcCACHgAQEA9wIAIeEBAQD3AgAh4gEBAPcCACHjARAAzQMAIeQBAgCIAwAh5QEIAO0DACHmAQAA7gMAIOgBAQD3AgAh6QEBAPcCACECAAAAAwAgFwAA2AEAIAIAAAADACAXAADYAQAgAwAAAAUAIB4AANEBACAfAADWAQAgAQAAAAUAIAEAAAADACAFBAAApgQAICQAAKkEACAlAACoBAAgNgAApwQAIDcAAKoEACASugEAALwCADC7AQAA3wEAELwBAAC8AgAwvQEBAJICACHAAUAAkwIAIdUBAADAAugBItkBIACeAgAh2wFAAJMCACHfAQEAkgIAIeABAQCSAgAh4QEBAJICACHiAQEAkgIAIeMBEAC9AgAh5AECAJ8CACHlAQgAvgIAIeYBAAC_AgAg6AEBAJICACHpAQEAkgIAIQMAAAADACABAADeAQAwIwAA3wEAIAMAAAADACABAAAEADACAAAFACAYAwAAtgIAIAsAALcCACAMAAC4AgAgDgAAuQIAIA8AALoCACAQAAC7AgAgugEAAK0CADC7AQAA5QEAELwBAACtAgAwvQEBAAAAAcABQAC1AgAhzAEBAK4CACHNAQEAAAABzgEBAK8CACHPAQEAAAAB0AEBAK8CACHRAQEArwIAIdMBAACwAtMBItUBAACxAtUBItcBAACyAtcBItgBIACzAgAh2QEgALMCACHaAQIAtAIAIdsBQAC1AgAhAQAAAOIBACABAAAA4gEAIBgDAAC2AgAgCwAAtwIAIAwAALgCACAOAAC5AgAgDwAAugIAIBAAALsCACC6AQAArQIAMLsBAADlAQAQvAEAAK0CADC9AQEArgIAIcABQAC1AgAhzAEBAK4CACHNAQEArgIAIc4BAQCvAgAhzwEBAK8CACHQAQEArwIAIdEBAQCvAgAh0wEAALAC0wEi1QEAALEC1QEi1wEAALIC1wEi2AEgALMCACHZASAAswIAIdoBAgC0AgAh2wFAALUCACEKAwAAoAQAIAsAAKEEACAMAACiBAAgDgAAowQAIA8AAKQEACAQAAClBAAgzgEAAP0CACDPAQAA_QIAINABAAD9AgAg0QEAAP0CACADAAAA5QEAIAEAAOYBADACAADiAQAgAwAAAOUBACABAADmAQAwAgAA4gEAIAMAAADlAQAgAQAA5gEAMAIAAOIBACAVAwAAmgQAIAsAAJsEACAMAACcBAAgDgAAnQQAIA8AAJ4EACAQAACfBAAgvQEBAAAAAcABQAAAAAHMAQEAAAABzQEBAAAAAc4BAQAAAAHPAQEAAAAB0AEBAAAAAdEBAQAAAAHTAQAAANMBAtUBAAAA1QEC1wEAAADXAQLYASAAAAAB2QEgAAAAAdoBAgAAAAHbAUAAAAABARcAAOoBACAPvQEBAAAAAcABQAAAAAHMAQEAAAABzQEBAAAAAc4BAQAAAAHPAQEAAAAB0AEBAAAAAdEBAQAAAAHTAQAAANMBAtUBAAAA1QEC1wEAAADXAQLYASAAAAAB2QEgAAAAAdoBAgAAAAHbAUAAAAABARcAAOwBADABFwAA7AEAMBUDAACJAwAgCwAAigMAIAwAAIsDACAOAACMAwAgDwAAjQMAIBAAAI4DACC9AQEA9wIAIcABQAD4AgAhzAEBAPcCACHNAQEA9wIAIc4BAQCDAwAhzwEBAIMDACHQAQEAgwMAIdEBAQCDAwAh0wEAAIQD0wEi1QEAAIUD1QEi1wEAAIYD1wEi2AEgAIcDACHZASAAhwMAIdoBAgCIAwAh2wFAAPgCACECAAAA4gEAIBcAAO8BACAPvQEBAPcCACHAAUAA-AIAIcwBAQD3AgAhzQEBAPcCACHOAQEAgwMAIc8BAQCDAwAh0AEBAIMDACHRAQEAgwMAIdMBAACEA9MBItUBAACFA9UBItcBAACGA9cBItgBIACHAwAh2QEgAIcDACHaAQIAiAMAIdsBQAD4AgAhAgAAAOUBACAXAADxAQAgAgAAAOUBACAXAADxAQAgAwAAAOIBACAeAADqAQAgHwAA7wEAIAEAAADiAQAgAQAAAOUBACAJBAAA_gIAICQAAIEDACAlAACAAwAgNgAA_wIAIDcAAIIDACDOAQAA_QIAIM8BAAD9AgAg0AEAAP0CACDRAQAA_QIAIBK6AQAAmQIAMLsBAAD4AQAQvAEAAJkCADC9AQEAkgIAIcABQACTAgAhzAEBAJICACHNAQEAkgIAIc4BAQCaAgAhzwEBAJoCACHQAQEAmgIAIdEBAQCaAgAh0wEAAJsC0wEi1QEAAJwC1QEi1wEAAJ0C1wEi2AEgAJ4CACHZASAAngIAIdoBAgCfAgAh2wFAAJMCACEDAAAA5QEAIAEAAPcBADAjAAD4AQAgAwAAAOUBACABAADmAQAwAgAA4gEAIAEAAAAYACABAAAAGAAgAwAAABYAIAEAABcAMAIAABgAIAMAAAAWACABAAAXADACAAAYACADAAAAFgAgAQAAFwAwAgAAGAAgBgcAAPsCACAIAAD8AgAgvQEBAAAAAb4BAQAAAAG_AQEAAAABwAFAAAAAAQEXAACAAgAgBL0BAQAAAAG-AQEAAAABvwEBAAAAAcABQAAAAAEBFwAAggIAMAEXAACCAgAwBgcAAPkCACAIAAD6AgAgvQEBAPcCACG-AQEA9wIAIb8BAQD3AgAhwAFAAPgCACECAAAAGAAgFwAAhQIAIAS9AQEA9wIAIb4BAQD3AgAhvwEBAPcCACHAAUAA-AIAIQIAAAAWACAXAACHAgAgAgAAABYAIBcAAIcCACADAAAAGAAgHgAAgAIAIB8AAIUCACABAAAAGAAgAQAAABYAIAMEAAD0AgAgJAAA9gIAICUAAPUCACAHugEAAJECADC7AQAAjgIAELwBAACRAgAwvQEBAJICACG-AQEAkgIAIb8BAQCSAgAhwAFAAJMCACEDAAAAFgAgAQAAjQIAMCMAAI4CACADAAAAFgAgAQAAFwAwAgAAGAAgB7oBAACRAgAwuwEAAI4CABC8AQAAkQIAML0BAQCSAgAhvgEBAJICACG_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_AQEAkgIAIcABQACTAgAh2wFAAJMCACHlAQIAnwIAIe0BAQCSAgAhE7oBAADHAgAwuwEAALMBABC8AQAAxwIAML0BAQCSAgAhwAFAAJMCACHVAQAAyAL0ASLbAUAAkwIAIe4BAQCSAgAh7wEBAJICACHwAQEAmgIAIfEBEAC9AgAh8gEBAJICACH0AQEAmgIAIfUBAQCaAgAh9gEBAJoCACH3AQEAmgIAIfgBQADJAgAh-QEBAJoCACH6AUAAyQIAIQcEAACVAgAgJAAAzQIAICUAAM0CACDBAQAAAPQBAsIBAAAA9AEIwwEAAAD0AQjIAQAAzAL0ASILBAAAqwIAICQAAMsCACAlAADLAgAgwQFAAAAAAcIBQAAAAAXDAUAAAAAFxAFAAAAAAcUBQAAAAAHGAUAAAAABxwFAAAAAAcgBQADKAgAhCwQAAKsCACAkAADLAgAgJQAAywIAIMEBQAAAAAHCAUAAAAAFwwFAAAAABcQBQAAAAAHFAUAAAAABxgFAAAAAAccBQAAAAAHIAUAAygIAIQjBAUAAAAABwgFAAAAABcMBQAAAAAXEAUAAAAABxQFAAAAAAcYBQAAAAAHHAUAAAAAByAFAAMsCACEHBAAAlQIAICQAAM0CACAlAADNAgAgwQEAAAD0AQLCAQAAAPQBCMMBAAAA9AEIyAEAAMwC9AEiBMEBAAAA9AECwgEAAAD0AQjDAQAAAPQBCMgBAADNAvQBIgu6AQAAzgIAMLsBAACdAQAQvAEAAM4CADC9AQEAkgIAIb4BAQCSAgAhwAFAAJMCACHfAQEAkgIAIfwBAADPAvwBIv0BAQCSAgAh_gEBAJoCACH_ASAAngIAIQcEAACVAgAgJAAA0QIAICUAANECACDBAQAAAPwBAsIBAAAA_AEIwwEAAAD8AQjIAQAA0AL8ASIHBAAAlQIAICQAANECACAlAADRAgAgwQEAAAD8AQLCAQAAAPwBCMMBAAAA_AEIyAEAANAC_AEiBMEBAAAA_AECwgEAAAD8AQjDAQAAAPwBCMgBAADRAvwBIgu6AQAA0gIAMLsBAACHAQAQvAEAANICADC9AQEAkgIAIcABQACTAgAhzAEBAJICACHNAQEAkgIAIdsBQACTAgAh_QEBAJICACGAAgEAkgIAIYECIACeAgAhC7oBAADTAgAwuwEAAHQAELwBAADTAgAwvQEBAK4CACHAAUAAtQIAIcwBAQCuAgAhzQEBAK4CACHbAUAAtQIAIf0BAQCuAgAhgAIBAK4CACGBAiAAswIAIQi6AQAA1AIAMLsBAABuABC8AQAA1AIAML0BAQCSAgAhwAFAAJMCACHMAQEAkgIAIdsBQACTAgAh4AEBAJICACEJAwAAtgIAILoBAADVAgAwuwEAAFsAELwBAADVAgAwvQEBAK4CACHAAUAAtQIAIcwBAQCuAgAh2wFAALUCACHgAQEArgIAIQy6AQAA1gIAMLsBAABVABC8AQAA1gIAML0BAQCSAgAhvgEBAJICACG_AQEAkgIAIcABQACTAgAh1QEAANcChgIi2wFAAJMCACGCAkAAkwIAIYMCAgCfAgAhhAIQAL0CACEHBAAAlQIAICQAANkCACAlAADZAgAgwQEAAACGAgLCAQAAAIYCCMMBAAAAhgIIyAEAANgChgIiBwQAAJUCACAkAADZAgAgJQAA2QIAIMEBAAAAhgICwgEAAACGAgjDAQAAAIYCCMgBAADYAoYCIgTBAQAAAIYCAsIBAAAAhgIIwwEAAACGAgjIAQAA2QKGAiIOugEAANoCADC7AQAAPwAQvAEAANoCADC9AQEAkgIAIcABQACTAgAh1QEAANsCigIi2QEgAJ4CACHbAUAAkwIAId8BAQCSAgAh4AEBAJICACGGAgEAkgIAIYcCAQCSAgAhiAIBAJICACGKAgEAkgIAIQcEAACVAgAgJAAA3QIAICUAAN0CACDBAQAAAIoCAsIBAAAAigIIwwEAAACKAgjIAQAA3AKKAiIHBAAAlQIAICQAAN0CACAlAADdAgAgwQEAAACKAgLCAQAAAIoCCMMBAAAAigIIyAEAANwCigIiBMEBAAAAigICwgEAAACKAgjDAQAAAIoCCMgBAADdAooCIgwHAADgAgAgugEAAN4CADC7AQAAIwAQvAEAAN4CADC9AQEArgIAIb4BAQCuAgAhwAFAALUCACHfAQEArgIAIfwBAADfAvwBIv0BAQCuAgAh_gEBAK8CACH_ASAAswIAIQTBAQAAAPwBAsIBAAAA_AEIwwEAAAD8AQjIAQAA0QL8ASIaAwAAtgIAIAsAALcCACAMAAC4AgAgDgAAuQIAIA8AALoCACAQAAC7AgAgugEAAK0CADC7AQAA5QEAELwBAACtAgAwvQEBAK4CACHAAUAAtQIAIcwBAQCuAgAhzQEBAK4CACHOAQEArwIAIc8BAQCvAgAh0AEBAK8CACHRAQEArwIAIdMBAACwAtMBItUBAACxAtUBItcBAACyAtcBItgBIACzAgAh2QEgALMCACHaAQIAtAIAIdsBQAC1AgAhjAIAAOUBACCNAgAA5QEAIA8RAADgAgAgugEAAOECADC7AQAAHwAQvAEAAOECADC9AQEArgIAIcABQAC1AgAh1QEAAOICigIi2QEgALMCACHbAUAAtQIAId8BAQCuAgAh4AEBAK4CACGGAgEArgIAIYcCAQCuAgAhiAIBAK4CACGKAgEArgIAIQTBAQAAAIoCAsIBAAAAigIIwwEAAACKAgjIAQAA3QKKAiICvgEBAAAAAb8BAQAAAAEJBwAA4AIAIAgAAOUCACC6AQAA5AIAMLsBAAAWABC8AQAA5AIAML0BAQCuAgAhvgEBAK4CACG_AQEArgIAIcABQAC1AgAhGQUAAPMCACAGAADgAgAgCwAAtwIAIAwAALgCACANAAC6AgAgugEAAPACADC7AQAAAwAQvAEAAPACADC9AQEArgIAIcABQAC1AgAh1QEAAPIC6AEi2QEgALMCACHbAUAAtQIAId8BAQCuAgAh4AEBAK4CACHhAQEArgIAIeIBAQCuAgAh4wEQAOkCACHkAQIAtAIAIeUBCADxAgAh5gEAAL8CACDoAQEArgIAIekBAQCuAgAhjAIAAAMAII0CAAADACACvgEBAAAAAb8BAQAAAAEMBwAA4AIAIAgAAOUCACC6AQAA5wIAMLsBAAASABC8AQAA5wIAML0BAQCuAgAhvgEBAK4CACG_AQEArgIAIcABQAC1AgAh2wFAALUCACHlAQIAtAIAIe0BAQCuAgAhFAkAAOwCACC6AQAA6AIAMLsBAAANABC8AQAA6AIAML0BAQCuAgAhwAFAALUCACHVAQAA6gL0ASLbAUAAtQIAIe4BAQCuAgAh7wEBAK4CACHwAQEArwIAIfEBEADpAgAh8gEBAK4CACH0AQEArwIAIfUBAQCvAgAh9gEBAK8CACH3AQEArwIAIfgBQADrAgAh-QEBAK8CACH6AUAA6wIAIQjBARAAAAABwgEQAAAABMMBEAAAAATEARAAAAABxQEQAAAAAcYBEAAAAAHHARAAAAAByAEQAMUCACEEwQEAAAD0AQLCAQAAAPQBCMMBAAAA9AEIyAEAAM0C9AEiCMEBQAAAAAHCAUAAAAAFwwFAAAAABcQBQAAAAAHFAUAAAAABxgFAAAAAAccBQAAAAAHIAUAAywIAIREHAADgAgAgCAAA5QIAIAoAAO8CACC6AQAA7QIAMLsBAAAJABC8AQAA7QIAML0BAQCuAgAhvgEBAK4CACG_AQEArgIAIcABQAC1AgAh1QEAAO4ChgIi2wFAALUCACGCAkAAtQIAIYMCAgC0AgAhhAIQAOkCACGMAgAACQAgjQIAAAkAIA8HAADgAgAgCAAA5QIAIAoAAO8CACC6AQAA7QIAMLsBAAAJABC8AQAA7QIAML0BAQCuAgAhvgEBAK4CACG_AQEArgIAIcABQAC1AgAh1QEAAO4ChgIi2wFAALUCACGCAkAAtQIAIYMCAgC0AgAhhAIQAOkCACEEwQEAAACGAgLCAQAAAIYCCMMBAAAAhgIIyAEAANkChgIiA9wBAAANACDdAQAADQAg3gEAAA0AIBcFAADzAgAgBgAA4AIAIAsAALcCACAMAAC4AgAgDQAAugIAILoBAADwAgAwuwEAAAMAELwBAADwAgAwvQEBAK4CACHAAUAAtQIAIdUBAADyAugBItkBIACzAgAh2wFAALUCACHfAQEArgIAIeABAQCuAgAh4QEBAK4CACHiAQEArgIAIeMBEADpAgAh5AECALQCACHlAQgA8QIAIeYBAAC_AgAg6AEBAK4CACHpAQEArgIAIQjBAQgAAAABwgEIAAAABMMBCAAAAATEAQgAAAABxQEIAAAAAcYBCAAAAAHHAQgAAAAByAEIAKECACEEwQEAAADoAQLCAQAAAOgBCMMBAAAA6AEIyAEAAMIC6AEiCwMAALYCACC6AQAA1QIAMLsBAABbABC8AQAA1QIAML0BAQCuAgAhwAFAALUCACHMAQEArgIAIdsBQAC1AgAh4AEBAK4CACGMAgAAWwAgjQIAAFsAIAAAAAGRAgEAAAABAZECQAAAAAEFHgAAmAUAIB8AAJ4FACCOAgAAmQUAII8CAACdBQAglAIAAOIBACAFHgAAlgUAIB8AAJsFACCOAgAAlwUAII8CAACaBQAglAIAAAUAIAMeAACYBQAgjgIAAJkFACCUAgAA4gEAIAMeAACWBQAgjgIAAJcFACCUAgAABQAgAAAAAAAAAZECAQAAAAEBkQIAAADTAQIBkQIAAADVAQIBkQIAAADXAQIBkQIgAAAAAQWRAgIAAAABmAICAAAAAZkCAgAAAAGaAgIAAAABmwICAAAAAQseAADjAwAwHwAA6AMAMI4CAADkAwAwjwIAAOUDADCQAgAA5gMAIJECAADnAwAwkgIAAOcDADCTAgAA5wMAMJQCAADnAwAwlQIAAOkDADCWAgAA6gMAMAseAADDAwAwHwAAyAMAMI4CAADEAwAwjwIAAMUDADCQAgAAxgMAIJECAADHAwAwkgIAAMcDADCTAgAAxwMAMJQCAADHAwAwlQIAAMkDADCWAgAAygMAMAseAAC1AwAwHwAAugMAMI4CAAC2AwAwjwIAALcDADCQAgAAuAMAIJECAAC5AwAwkgIAALkDADCTAgAAuQMAMJQCAAC5AwAwlQIAALsDADCWAgAAvAMAMAseAACoAwAwHwAArQMAMI4CAACpAwAwjwIAAKoDADCQAgAAqwMAIJECAACsAwAwkgIAAKwDADCTAgAArAMAMJQCAACsAwAwlQIAAK4DADCWAgAArwMAMAseAACcAwAwHwAAoQMAMI4CAACdAwAwjwIAAJ4DADCQAgAAnwMAIJECAACgAwAwkgIAAKADADCTAgAAoAMAMJQCAACgAwAwlQIAAKIDADCWAgAAowMAMAseAACPAwAwHwAAlAMAMI4CAACQAwAwjwIAAJEDADCQAgAAkgMAIJECAACTAwAwkgIAAJMDADCTAgAAkwMAMJQCAACTAwAwlQIAAJUDADCWAgAAlgMAMAe9AQEAAAABwAFAAAAAAd8BAQAAAAH8AQAAAPwBAv0BAQAAAAH-AQEAAAAB_wEgAAAAAQIAAAAlACAeAACbAwAgAwAAACUAIB4AAJsDACAfAACaAwAgARcAAJUFADAMBwAA4AIAILoBAADeAgAwuwEAACMAELwBAADeAgAwvQEBAAAAAb4BAQCuAgAhwAFAALUCACHfAQEArgIAIfwBAADfAvwBIv0BAQCuAgAh_gEBAK8CACH_ASAAswIAIQIAAAAlACAXAACaAwAgAgAAAJcDACAXAACYAwAgC7oBAACWAwAwuwEAAJcDABC8AQAAlgMAML0BAQCuAgAhvgEBAK4CACHAAUAAtQIAId8BAQCuAgAh_AEAAN8C_AEi_QEBAK4CACH-AQEArwIAIf8BIACzAgAhC7oBAACWAwAwuwEAAJcDABC8AQAAlgMAML0BAQCuAgAhvgEBAK4CACHAAUAAtQIAId8BAQCuAgAh_AEAAN8C_AEi_QEBAK4CACH-AQEArwIAIf8BIACzAgAhB70BAQD3AgAhwAFAAPgCACHfAQEA9wIAIfwBAACZA_wBIv0BAQD3AgAh_gEBAIMDACH_ASAAhwMAIQGRAgAAAPwBAge9AQEA9wIAIcABQAD4AgAh3wEBAPcCACH8AQAAmQP8ASL9AQEA9wIAIf4BAQCDAwAh_wEgAIcDACEHvQEBAAAAAcABQAAAAAHfAQEAAAAB_AEAAAD8AQL9AQEAAAAB_gEBAAAAAf8BIAAAAAEECAAA_AIAIL0BAQAAAAG_AQEAAAABwAFAAAAAAQIAAAAYACAeAACnAwAgAwAAABgAIB4AAKcDACAfAACmAwAgARcAAJQFADAKBwAA4AIAIAgAAOUCACC6AQAA5AIAMLsBAAAWABC8AQAA5AIAML0BAQAAAAG-AQEArgIAIb8BAQCuAgAhwAFAALUCACGLAgAA4wIAIAIAAAAYACAXAACmAwAgAgAAAKQDACAXAAClAwAgB7oBAACjAwAwuwEAAKQDABC8AQAAowMAML0BAQCuAgAhvgEBAK4CACG_AQEArgIAIcABQAC1AgAhB7oBAACjAwAwuwEAAKQDABC8AQAAowMAML0BAQCuAgAhvgEBAK4CACG_AQEArgIAIcABQAC1AgAhA70BAQD3AgAhvwEBAPcCACHAAUAA-AIAIQQIAAD6AgAgvQEBAPcCACG_AQEA9wIAIcABQAD4AgAhBAgAAPwCACC9AQEAAAABvwEBAAAAAcABQAAAAAEKvQEBAAAAAcABQAAAAAHVAQAAAIoCAtkBIAAAAAHbAUAAAAAB3wEBAAAAAeABAQAAAAGGAgEAAAABhwIBAAAAAYgCAQAAAAECAAAAAQAgHgAAtAMAIAMAAAABACAeAAC0AwAgHwAAswMAIAEXAACTBQAwDxEAAOACACC6AQAA4QIAMLsBAAAfABC8AQAA4QIAML0BAQAAAAHAAUAAtQIAIdUBAADiAooCItkBIACzAgAh2wFAALUCACHfAQEArgIAIeABAQAAAAGGAgEArgIAIYcCAQCuAgAhiAIBAK4CACGKAgEArgIAIQIAAAABACAXAACzAwAgAgAAALADACAXAACxAwAgDroBAACvAwAwuwEAALADABC8AQAArwMAML0BAQCuAgAhwAFAALUCACHVAQAA4gKKAiLZASAAswIAIdsBQAC1AgAh3wEBAK4CACHgAQEArgIAIYYCAQCuAgAhhwIBAK4CACGIAgEArgIAIYoCAQCuAgAhDroBAACvAwAwuwEAALADABC8AQAArwMAML0BAQCuAgAhwAFAALUCACHVAQAA4gKKAiLZASAAswIAIdsBQAC1AgAh3wEBAK4CACHgAQEArgIAIYYCAQCuAgAhhwIBAK4CACGIAgEArgIAIYoCAQCuAgAhCr0BAQD3AgAhwAFAAPgCACHVAQAAsgOKAiLZASAAhwMAIdsBQAD4AgAh3wEBAPcCACHgAQEA9wIAIYYCAQD3AgAhhwIBAPcCACGIAgEA9wIAIQGRAgAAAIoCAgq9AQEA9wIAIcABQAD4AgAh1QEAALIDigIi2QEgAIcDACHbAUAA-AIAId8BAQD3AgAh4AEBAPcCACGGAgEA9wIAIYcCAQD3AgAhiAIBAPcCACEKvQEBAAAAAcABQAAAAAHVAQAAAIoCAtkBIAAAAAHbAUAAAAAB3wEBAAAAAeABAQAAAAGGAgEAAAABhwIBAAAAAYgCAQAAAAEHCAAAwgMAIL0BAQAAAAG_AQEAAAABwAFAAAAAAdsBQAAAAAHlAQIAAAAB7QEBAAAAAQIAAAAUACAeAADBAwAgAwAAABQAIB4AAMEDACAfAAC_AwAgARcAAJIFADANBwAA4AIAIAgAAOUCACC6AQAA5wIAMLsBAAASABC8AQAA5wIAML0BAQAAAAG-AQEArgIAIb8BAQCuAgAhwAFAALUCACHbAUAAtQIAIeUBAgC0AgAh7QEBAK4CACGLAgAA5gIAIAIAAAAUACAXAAC_AwAgAgAAAL0DACAXAAC-AwAgCroBAAC8AwAwuwEAAL0DABC8AQAAvAMAML0BAQCuAgAhvgEBAK4CACG_AQEArgIAIcABQAC1AgAh2wFAALUCACHlAQIAtAIAIe0BAQCuAgAhCroBAAC8AwAwuwEAAL0DABC8AQAAvAMAML0BAQCuAgAhvgEBAK4CACG_AQEArgIAIcABQAC1AgAh2wFAALUCACHlAQIAtAIAIe0BAQCuAgAhBr0BAQD3AgAhvwEBAPcCACHAAUAA-AIAIdsBQAD4AgAh5QECAIgDACHtAQEA9wIAIQcIAADAAwAgvQEBAPcCACG_AQEA9wIAIcABQAD4AgAh2wFAAPgCACHlAQIAiAMAIe0BAQD3AgAhBR4AAI0FACAfAACQBQAgjgIAAI4FACCPAgAAjwUAIJQCAAAFACAHCAAAwgMAIL0BAQAAAAG_AQEAAAABwAFAAAAAAdsBQAAAAAHlAQIAAAAB7QEBAAAAAQMeAACNBQAgjgIAAI4FACCUAgAABQAgCggAAOEDACAKAADiAwAgvQEBAAAAAb8BAQAAAAHAAUAAAAAB1QEAAACGAgLbAUAAAAABggJAAAAAAYMCAgAAAAGEAhAAAAABAgAAAAsAIB4AAOADACADAAAACwAgHgAA4AMAIB8AAM8DACABFwAAjAUAMA8HAADgAgAgCAAA5QIAIAoAAO8CACC6AQAA7QIAMLsBAAAJABC8AQAA7QIAML0BAQAAAAG-AQEArgIAIb8BAQCuAgAhwAFAALUCACHVAQAA7gKGAiLbAUAAtQIAIYICQAC1AgAhgwICALQCACGEAhAA6QIAIQIAAAALACAXAADPAwAgAgAAAMsDACAXAADMAwAgDLoBAADKAwAwuwEAAMsDABC8AQAAygMAML0BAQCuAgAhvgEBAK4CACG_AQEArgIAIcABQAC1AgAh1QEAAO4ChgIi2wFAALUCACGCAkAAtQIAIYMCAgC0AgAhhAIQAOkCACEMugEAAMoDADC7AQAAywMAELwBAADKAwAwvQEBAK4CACG-AQEArgIAIb8BAQCuAgAhwAFAALUCACHVAQAA7gKGAiLbAUAAtQIAIYICQAC1AgAhgwICALQCACGEAhAA6QIAIQi9AQEA9wIAIb8BAQD3AgAhwAFAAPgCACHVAQAAzgOGAiLbAUAA-AIAIYICQAD4AgAhgwICAIgDACGEAhAAzQMAIQWRAhAAAAABmAIQAAAAAZkCEAAAAAGaAhAAAAABmwIQAAAAAQGRAgAAAIYCAgoIAADQAwAgCgAA0QMAIL0BAQD3AgAhvwEBAPcCACHAAUAA-AIAIdUBAADOA4YCItsBQAD4AgAhggJAAPgCACGDAgIAiAMAIYQCEADNAwAhBR4AAIYFACAfAACKBQAgjgIAAIcFACCPAgAAiQUAIJQCAAAFACALHgAA0gMAMB8AANcDADCOAgAA0wMAMI8CAADUAwAwkAIAANUDACCRAgAA1gMAMJICAADWAwAwkwIAANYDADCUAgAA1gMAMJUCAADYAwAwlgIAANkDADAPvQEBAAAAAcABQAAAAAHVAQAAAPQBAtsBQAAAAAHvAQEAAAAB8AEBAAAAAfEBEAAAAAHyAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB9wEBAAAAAfgBQAAAAAH5AQEAAAAB-gFAAAAAAQIAAAAPACAeAADfAwAgAwAAAA8AIB4AAN8DACAfAADeAwAgARcAAIgFADAUCQAA7AIAILoBAADoAgAwuwEAAA0AELwBAADoAgAwvQEBAAAAAcABQAC1AgAh1QEAAOoC9AEi2wFAALUCACHuAQEArgIAIe8BAQAAAAHwAQEArwIAIfEBEADpAgAh8gEBAK4CACH0AQEArwIAIfUBAQCvAgAh9gEBAK8CACH3AQEArwIAIfgBQADrAgAh-QEBAK8CACH6AUAA6wIAIQIAAAAPACAXAADeAwAgAgAAANoDACAXAADbAwAgE7oBAADZAwAwuwEAANoDABC8AQAA2QMAML0BAQCuAgAhwAFAALUCACHVAQAA6gL0ASLbAUAAtQIAIe4BAQCuAgAh7wEBAK4CACHwAQEArwIAIfEBEADpAgAh8gEBAK4CACH0AQEArwIAIfUBAQCvAgAh9gEBAK8CACH3AQEArwIAIfgBQADrAgAh-QEBAK8CACH6AUAA6wIAIRO6AQAA2QMAMLsBAADaAwAQvAEAANkDADC9AQEArgIAIcABQAC1AgAh1QEAAOoC9AEi2wFAALUCACHuAQEArgIAIe8BAQCuAgAh8AEBAK8CACHxARAA6QIAIfIBAQCuAgAh9AEBAK8CACH1AQEArwIAIfYBAQCvAgAh9wEBAK8CACH4AUAA6wIAIfkBAQCvAgAh-gFAAOsCACEPvQEBAPcCACHAAUAA-AIAIdUBAADcA_QBItsBQAD4AgAh7wEBAPcCACHwAQEAgwMAIfEBEADNAwAh8gEBAPcCACH0AQEAgwMAIfUBAQCDAwAh9gEBAIMDACH3AQEAgwMAIfgBQADdAwAh-QEBAIMDACH6AUAA3QMAIQGRAgAAAPQBAgGRAkAAAAABD70BAQD3AgAhwAFAAPgCACHVAQAA3AP0ASLbAUAA-AIAIe8BAQD3AgAh8AEBAIMDACHxARAAzQMAIfIBAQD3AgAh9AEBAIMDACH1AQEAgwMAIfYBAQCDAwAh9wEBAIMDACH4AUAA3QMAIfkBAQCDAwAh-gFAAN0DACEPvQEBAAAAAcABQAAAAAHVAQAAAPQBAtsBQAAAAAHvAQEAAAAB8AEBAAAAAfEBEAAAAAHyAQEAAAAB9AEBAAAAAfUBAQAAAAH2AQEAAAAB9wEBAAAAAfgBQAAAAAH5AQEAAAAB-gFAAAAAAQoIAADhAwAgCgAA4gMAIL0BAQAAAAG_AQEAAAABwAFAAAAAAdUBAAAAhgIC2wFAAAAAAYICQAAAAAGDAgIAAAABhAIQAAAAAQMeAACGBQAgjgIAAIcFACCUAgAABQAgBB4AANIDADCOAgAA0wMAMJACAADVAwAglAIAANYDADASBQAAlgQAIAsAAJcEACAMAACYBAAgDQAAmQQAIL0BAQAAAAHAAUAAAAAB1QEAAADoAQLZASAAAAAB2wFAAAAAAd8BAQAAAAHgAQEAAAAB4QEBAAAAAeIBAQAAAAHjARAAAAAB5AECAAAAAeUBCAAAAAHmAQAAlQQAIOgBAQAAAAECAAAABQAgHgAAlAQAIAMAAAAFACAeAACUBAAgHwAA8AMAIAEXAACFBQAwFwUAAPMCACAGAADgAgAgCwAAtwIAIAwAALgCACANAAC6AgAgugEAAPACADC7AQAAAwAQvAEAAPACADC9AQEAAAABwAFAALUCACHVAQAA8gLoASLZASAAswIAIdsBQAC1AgAh3wEBAK4CACHgAQEAAAAB4QEBAK4CACHiAQEArgIAIeMBEADpAgAh5AECALQCACHlAQgA8QIAIeYBAAC_AgAg6AEBAK4CACHpAQEArgIAIQIAAAAFACAXAADwAwAgAgAAAOsDACAXAADsAwAgEroBAADqAwAwuwEAAOsDABC8AQAA6gMAML0BAQCuAgAhwAFAALUCACHVAQAA8gLoASLZASAAswIAIdsBQAC1AgAh3wEBAK4CACHgAQEArgIAIeEBAQCuAgAh4gEBAK4CACHjARAA6QIAIeQBAgC0AgAh5QEIAPECACHmAQAAvwIAIOgBAQCuAgAh6QEBAK4CACESugEAAOoDADC7AQAA6wMAELwBAADqAwAwvQEBAK4CACHAAUAAtQIAIdUBAADyAugBItkBIACzAgAh2wFAALUCACHfAQEArgIAIeABAQCuAgAh4QEBAK4CACHiAQEArgIAIeMBEADpAgAh5AECALQCACHlAQgA8QIAIeYBAAC_AgAg6AEBAK4CACHpAQEArgIAIQ69AQEA9wIAIcABQAD4AgAh1QEAAO8D6AEi2QEgAIcDACHbAUAA-AIAId8BAQD3AgAh4AEBAPcCACHhAQEA9wIAIeIBAQD3AgAh4wEQAM0DACHkAQIAiAMAIeUBCADtAwAh5gEAAO4DACDoAQEA9wIAIQWRAggAAAABmAIIAAAAAZkCCAAAAAGaAggAAAABmwIIAAAAAQKRAgEAAAAElwIBAAAABQGRAgAAAOgBAhIFAADxAwAgCwAA8gMAIAwAAPMDACANAAD0AwAgvQEBAPcCACHAAUAA-AIAIdUBAADvA-gBItkBIACHAwAh2wFAAPgCACHfAQEA9wIAIeABAQD3AgAh4QEBAPcCACHiAQEA9wIAIeMBEADNAwAh5AECAIgDACHlAQgA7QMAIeYBAADuAwAg6AEBAPcCACEFHgAA8wQAIB8AAIMFACCOAgAA9AQAII8CAACCBQAglAIAAFgAIAseAACJBAAwHwAAjQQAMI4CAACKBAAwjwIAAIsEADCQAgAAjAQAIJECAADHAwAwkgIAAMcDADCTAgAAxwMAMJQCAADHAwAwlQIAAI4EADCWAgAAygMAMAseAAD-AwAwHwAAggQAMI4CAAD_AwAwjwIAAIAEADCQAgAAgQQAIJECAAC5AwAwkgIAALkDADCTAgAAuQMAMJQCAAC5AwAwlQIAAIMEADCWAgAAvAMAMAseAAD1AwAwHwAA-QMAMI4CAAD2AwAwjwIAAPcDADCQAgAA-AMAIJECAACgAwAwkgIAAKADADCTAgAAoAMAMJQCAACgAwAwlQIAAPoDADCWAgAAowMAMAQHAAD7AgAgvQEBAAAAAb4BAQAAAAHAAUAAAAABAgAAABgAIB4AAP0DACADAAAAGAAgHgAA_QMAIB8AAPwDACABFwAAgQUAMAIAAAAYACAXAAD8AwAgAgAAAKQDACAXAAD7AwAgA70BAQD3AgAhvgEBAPcCACHAAUAA-AIAIQQHAAD5AgAgvQEBAPcCACG-AQEA9wIAIcABQAD4AgAhBAcAAPsCACC9AQEAAAABvgEBAAAAAcABQAAAAAEHBwAAiAQAIL0BAQAAAAG-AQEAAAABwAFAAAAAAdsBQAAAAAHlAQIAAAAB7QEBAAAAAQIAAAAUACAeAACHBAAgAwAAABQAIB4AAIcEACAfAACFBAAgARcAAIAFADACAAAAFAAgFwAAhQQAIAIAAAC9AwAgFwAAhAQAIAa9AQEA9wIAIb4BAQD3AgAhwAFAAPgCACHbAUAA-AIAIeUBAgCIAwAh7QEBAPcCACEHBwAAhgQAIL0BAQD3AgAhvgEBAPcCACHAAUAA-AIAIdsBQAD4AgAh5QECAIgDACHtAQEA9wIAIQUeAAD7BAAgHwAA_gQAII4CAAD8BAAgjwIAAP0EACCUAgAA4gEAIAcHAACIBAAgvQEBAAAAAb4BAQAAAAHAAUAAAAAB2wFAAAAAAeUBAgAAAAHtAQEAAAABAx4AAPsEACCOAgAA_AQAIJQCAADiAQAgCgcAAJMEACAKAADiAwAgvQEBAAAAAb4BAQAAAAHAAUAAAAAB1QEAAACGAgLbAUAAAAABggJAAAAAAYMCAgAAAAGEAhAAAAABAgAAAAsAIB4AAJIEACADAAAACwAgHgAAkgQAIB8AAJAEACABFwAA-gQAMAIAAAALACAXAACQBAAgAgAAAMsDACAXAACPBAAgCL0BAQD3AgAhvgEBAPcCACHAAUAA-AIAIdUBAADOA4YCItsBQAD4AgAhggJAAPgCACGDAgIAiAMAIYQCEADNAwAhCgcAAJEEACAKAADRAwAgvQEBAPcCACG-AQEA9wIAIcABQAD4AgAh1QEAAM4DhgIi2wFAAPgCACGCAkAA-AIAIYMCAgCIAwAhhAIQAM0DACEFHgAA9QQAIB8AAPgEACCOAgAA9gQAII8CAAD3BAAglAIAAOIBACAKBwAAkwQAIAoAAOIDACC9AQEAAAABvgEBAAAAAcABQAAAAAHVAQAAAIYCAtsBQAAAAAGCAkAAAAABgwICAAAAAYQCEAAAAAEDHgAA9QQAII4CAAD2BAAglAIAAOIBACASBQAAlgQAIAsAAJcEACAMAACYBAAgDQAAmQQAIL0BAQAAAAHAAUAAAAAB1QEAAADoAQLZASAAAAAB2wFAAAAAAd8BAQAAAAHgAQEAAAAB4QEBAAAAAeIBAQAAAAHjARAAAAAB5AECAAAAAeUBCAAAAAHmAQAAlQQAIOgBAQAAAAEBkQIBAAAABAMeAADzBAAgjgIAAPQEACCUAgAAWAAgBB4AAIkEADCOAgAAigQAMJACAACMBAAglAIAAMcDADAEHgAA_gMAMI4CAAD_AwAwkAIAAIEEACCUAgAAuQMAMAQeAAD1AwAwjgIAAPYDADCQAgAA-AMAIJQCAACgAwAwBB4AAOMDADCOAgAA5AMAMJACAADmAwAglAIAAOcDADAEHgAAwwMAMI4CAADEAwAwkAIAAMYDACCUAgAAxwMAMAQeAAC1AwAwjgIAALYDADCQAgAAuAMAIJQCAAC5AwAwBB4AAKgDADCOAgAAqQMAMJACAACrAwAglAIAAKwDADAEHgAAnAMAMI4CAACdAwAwkAIAAJ8DACCUAgAAoAMAMAQeAACPAwAwjgIAAJADADCQAgAAkgMAIJQCAACTAwAwAAAAAAAAAAAAAAAFHgAA7gQAIB8AAPEEACCOAgAA7wQAII8CAADwBAAglAIAAOIBACADHgAA7gQAII4CAADvBAAglAIAAOIBACAAAAAAAAAAAAAABR4AAOkEACAfAADsBAAgjgIAAOoEACCPAgAA6wQAIJQCAAALACADHgAA6QQAII4CAADqBAAglAIAAAsAIAAAAAUeAADkBAAgHwAA5wQAII4CAADlBAAgjwIAAOYEACCUAgAA4gEAIAMeAADkBAAgjgIAAOUEACCUAgAA4gEAIAAAAAAAAAseAADFBAAwHwAAyQQAMI4CAADGBAAwjwIAAMcEADCQAgAAyAQAIJECAADnAwAwkgIAAOcDADCTAgAA5wMAMJQCAADnAwAwlQIAAMoEADCWAgAA6gMAMBIGAACsBAAgCwAAlwQAIAwAAJgEACANAACZBAAgvQEBAAAAAcABQAAAAAHVAQAAAOgBAtkBIAAAAAHbAUAAAAAB3wEBAAAAAeABAQAAAAHhAQEAAAAB4gEBAAAAAeMBEAAAAAHkAQIAAAAB5QEIAAAAAeYBAACVBAAg6QEBAAAAAQIAAAAFACAeAADNBAAgAwAAAAUAIB4AAM0EACAfAADMBAAgARcAAOMEADACAAAABQAgFwAAzAQAIAIAAADrAwAgFwAAywQAIA69AQEA9wIAIcABQAD4AgAh1QEAAO8D6AEi2QEgAIcDACHbAUAA-AIAId8BAQD3AgAh4AEBAPcCACHhAQEA9wIAIeIBAQD3AgAh4wEQAM0DACHkAQIAiAMAIeUBCADtAwAh5gEAAO4DACDpAQEA9wIAIRIGAACrBAAgCwAA8gMAIAwAAPMDACANAAD0AwAgvQEBAPcCACHAAUAA-AIAIdUBAADvA-gBItkBIACHAwAh2wFAAPgCACHfAQEA9wIAIeABAQD3AgAh4QEBAPcCACHiAQEA9wIAIeMBEADNAwAh5AECAIgDACHlAQgA7QMAIeYBAADuAwAg6QEBAPcCACESBgAArAQAIAsAAJcEACAMAACYBAAgDQAAmQQAIL0BAQAAAAHAAUAAAAAB1QEAAADoAQLZASAAAAAB2wFAAAAAAd8BAQAAAAHgAQEAAAAB4QEBAAAAAeIBAQAAAAHjARAAAAAB5AECAAAAAeUBCAAAAAHmAQAAlQQAIOkBAQAAAAEEHgAAxQQAMI4CAADGBAAwkAIAAMgEACCUAgAA5wMAMAAAAAAAAAAABR4AAN4EACAfAADhBAAgjgIAAN8EACCPAgAA4AQAIJQCAADiAQAgAx4AAN4EACCOAgAA3wQAIJQCAADiAQAgCgMAAKAEACALAAChBAAgDAAAogQAIA4AAKMEACAPAACkBAAgEAAApQQAIM4BAAD9AgAgzwEAAP0CACDQAQAA_QIAINEBAAD9AgAgBQUAAN0EACAGAADZBAAgCwAAoQQAIAwAAKIEACANAACkBAAgAwcAANkEACAIAADaBAAgCgAA3AQAIAABAwAAoAQAIBQDAACaBAAgCwAAmwQAIAwAAJwEACAPAACeBAAgEAAAnwQAIL0BAQAAAAHAAUAAAAABzAEBAAAAAc0BAQAAAAHOAQEAAAABzwEBAAAAAdABAQAAAAHRAQEAAAAB0wEAAADTAQLVAQAAANUBAtcBAAAA1wEC2AEgAAAAAdkBIAAAAAHaAQIAAAAB2wFAAAAAAQIAAADiAQAgHgAA3gQAIAMAAADlAQAgHgAA3gQAIB8AAOIEACAWAAAA5QEAIAMAAIkDACALAACKAwAgDAAAiwMAIA8AAI0DACAQAACOAwAgFwAA4gQAIL0BAQD3AgAhwAFAAPgCACHMAQEA9wIAIc0BAQD3AgAhzgEBAIMDACHPAQEAgwMAIdABAQCDAwAh0QEBAIMDACHTAQAAhAPTASLVAQAAhQPVASLXAQAAhgPXASLYASAAhwMAIdkBIACHAwAh2gECAIgDACHbAUAA-AIAIRQDAACJAwAgCwAAigMAIAwAAIsDACAPAACNAwAgEAAAjgMAIL0BAQD3AgAhwAFAAPgCACHMAQEA9wIAIc0BAQD3AgAhzgEBAIMDACHPAQEAgwMAIdABAQCDAwAh0QEBAIMDACHTAQAAhAPTASLVAQAAhQPVASLXAQAAhgPXASLYASAAhwMAIdkBIACHAwAh2gECAIgDACHbAUAA-AIAIQ69AQEAAAABwAFAAAAAAdUBAAAA6AEC2QEgAAAAAdsBQAAAAAHfAQEAAAAB4AEBAAAAAeEBAQAAAAHiAQEAAAAB4wEQAAAAAeQBAgAAAAHlAQgAAAAB5gEAAJUEACDpAQEAAAABFAMAAJoEACALAACbBAAgDAAAnAQAIA4AAJ0EACAPAACeBAAgvQEBAAAAAcABQAAAAAHMAQEAAAABzQEBAAAAAc4BAQAAAAHPAQEAAAAB0AEBAAAAAdEBAQAAAAHTAQAAANMBAtUBAAAA1QEC1wEAAADXAQLYASAAAAAB2QEgAAAAAdoBAgAAAAHbAUAAAAABAgAAAOIBACAeAADkBAAgAwAAAOUBACAeAADkBAAgHwAA6AQAIBYAAADlAQAgAwAAiQMAIAsAAIoDACAMAACLAwAgDgAAjAMAIA8AAI0DACAXAADoBAAgvQEBAPcCACHAAUAA-AIAIcwBAQD3AgAhzQEBAPcCACHOAQEAgwMAIc8BAQCDAwAh0AEBAIMDACHRAQEAgwMAIdMBAACEA9MBItUBAACFA9UBItcBAACGA9cBItgBIACHAwAh2QEgAIcDACHaAQIAiAMAIdsBQAD4AgAhFAMAAIkDACALAACKAwAgDAAAiwMAIA4AAIwDACAPAACNAwAgvQEBAPcCACHAAUAA-AIAIcwBAQD3AgAhzQEBAPcCACHOAQEAgwMAIc8BAQCDAwAh0AEBAIMDACHRAQEAgwMAIdMBAACEA9MBItUBAACFA9UBItcBAACGA9cBItgBIACHAwAh2QEgAIcDACHaAQIAiAMAIdsBQAD4AgAhCwcAAJMEACAIAADhAwAgvQEBAAAAAb4BAQAAAAG_AQEAAAABwAFAAAAAAdUBAAAAhgIC2wFAAAAAAYICQAAAAAGDAgIAAAABhAIQAAAAAQIAAAALACAeAADpBAAgAwAAAAkAIB4AAOkEACAfAADtBAAgDQAAAAkAIAcAAJEEACAIAADQAwAgFwAA7QQAIL0BAQD3AgAhvgEBAPcCACG_AQEA9wIAIcABQAD4AgAh1QEAAM4DhgIi2wFAAPgCACGCAkAA-AIAIYMCAgCIAwAhhAIQAM0DACELBwAAkQQAIAgAANADACC9AQEA9wIAIb4BAQD3AgAhvwEBAPcCACHAAUAA-AIAIdUBAADOA4YCItsBQAD4AgAhggJAAPgCACGDAgIAiAMAIYQCEADNAwAhFAsAAJsEACAMAACcBAAgDgAAnQQAIA8AAJ4EACAQAACfBAAgvQEBAAAAAcABQAAAAAHMAQEAAAABzQEBAAAAAc4BAQAAAAHPAQEAAAAB0AEBAAAAAdEBAQAAAAHTAQAAANMBAtUBAAAA1QEC1wEAAADXAQLYASAAAAAB2QEgAAAAAdoBAgAAAAHbAUAAAAABAgAAAOIBACAeAADuBAAgAwAAAOUBACAeAADuBAAgHwAA8gQAIBYAAADlAQAgCwAAigMAIAwAAIsDACAOAACMAwAgDwAAjQMAIBAAAI4DACAXAADyBAAgvQEBAPcCACHAAUAA-AIAIcwBAQD3AgAhzQEBAPcCACHOAQEAgwMAIc8BAQCDAwAh0AEBAIMDACHRAQEAgwMAIdMBAACEA9MBItUBAACFA9UBItcBAACGA9cBItgBIACHAwAh2QEgAIcDACHaAQIAiAMAIdsBQAD4AgAhFAsAAIoDACAMAACLAwAgDgAAjAMAIA8AAI0DACAQAACOAwAgvQEBAPcCACHAAUAA-AIAIcwBAQD3AgAhzQEBAPcCACHOAQEAgwMAIc8BAQCDAwAh0AEBAIMDACHRAQEAgwMAIdMBAACEA9MBItUBAACFA9UBItcBAACGA9cBItgBIACHAwAh2QEgAIcDACHaAQIAiAMAIdsBQAD4AgAhBb0BAQAAAAHAAUAAAAABzAEBAAAAAdsBQAAAAAHgAQEAAAABAgAAAFgAIB4AAPMEACAUAwAAmgQAIAwAAJwEACAOAACdBAAgDwAAngQAIBAAAJ8EACC9AQEAAAABwAFAAAAAAcwBAQAAAAHNAQEAAAABzgEBAAAAAc8BAQAAAAHQAQEAAAAB0QEBAAAAAdMBAAAA0wEC1QEAAADVAQLXAQAAANcBAtgBIAAAAAHZASAAAAAB2gECAAAAAdsBQAAAAAECAAAA4gEAIB4AAPUEACADAAAA5QEAIB4AAPUEACAfAAD5BAAgFgAAAOUBACADAACJAwAgDAAAiwMAIA4AAIwDACAPAACNAwAgEAAAjgMAIBcAAPkEACC9AQEA9wIAIcABQAD4AgAhzAEBAPcCACHNAQEA9wIAIc4BAQCDAwAhzwEBAIMDACHQAQEAgwMAIdEBAQCDAwAh0wEAAIQD0wEi1QEAAIUD1QEi1wEAAIYD1wEi2AEgAIcDACHZASAAhwMAIdoBAgCIAwAh2wFAAPgCACEUAwAAiQMAIAwAAIsDACAOAACMAwAgDwAAjQMAIBAAAI4DACC9AQEA9wIAIcABQAD4AgAhzAEBAPcCACHNAQEA9wIAIc4BAQCDAwAhzwEBAIMDACHQAQEAgwMAIdEBAQCDAwAh0wEAAIQD0wEi1QEAAIUD1QEi1wEAAIYD1wEi2AEgAIcDACHZASAAhwMAIdoBAgCIAwAh2wFAAPgCACEIvQEBAAAAAb4BAQAAAAHAAUAAAAAB1QEAAACGAgLbAUAAAAABggJAAAAAAYMCAgAAAAGEAhAAAAABFAMAAJoEACALAACbBAAgDgAAnQQAIA8AAJ4EACAQAACfBAAgvQEBAAAAAcABQAAAAAHMAQEAAAABzQEBAAAAAc4BAQAAAAHPAQEAAAAB0AEBAAAAAdEBAQAAAAHTAQAAANMBAtUBAAAA1QEC1wEAAADXAQLYASAAAAAB2QEgAAAAAdoBAgAAAAHbAUAAAAABAgAAAOIBACAeAAD7BAAgAwAAAOUBACAeAAD7BAAgHwAA_wQAIBYAAADlAQAgAwAAiQMAIAsAAIoDACAOAACMAwAgDwAAjQMAIBAAAI4DACAXAAD_BAAgvQEBAPcCACHAAUAA-AIAIcwBAQD3AgAhzQEBAPcCACHOAQEAgwMAIc8BAQCDAwAh0AEBAIMDACHRAQEAgwMAIdMBAACEA9MBItUBAACFA9UBItcBAACGA9cBItgBIACHAwAh2QEgAIcDACHaAQIAiAMAIdsBQAD4AgAhFAMAAIkDACALAACKAwAgDgAAjAMAIA8AAI0DACAQAACOAwAgvQEBAPcCACHAAUAA-AIAIcwBAQD3AgAhzQEBAPcCACHOAQEAgwMAIc8BAQCDAwAh0AEBAIMDACHRAQEAgwMAIdMBAACEA9MBItUBAACFA9UBItcBAACGA9cBItgBIACHAwAh2QEgAIcDACHaAQIAiAMAIdsBQAD4AgAhBr0BAQAAAAG-AQEAAAABwAFAAAAAAdsBQAAAAAHlAQIAAAAB7QEBAAAAAQO9AQEAAAABvgEBAAAAAcABQAAAAAEDAAAAWwAgHgAA8wQAIB8AAIQFACAHAAAAWwAgFwAAhAUAIL0BAQD3AgAhwAFAAPgCACHMAQEA9wIAIdsBQAD4AgAh4AEBAPcCACEFvQEBAPcCACHAAUAA-AIAIcwBAQD3AgAh2wFAAPgCACHgAQEA9wIAIQ69AQEAAAABwAFAAAAAAdUBAAAA6AEC2QEgAAAAAdsBQAAAAAHfAQEAAAAB4AEBAAAAAeEBAQAAAAHiAQEAAAAB4wEQAAAAAeQBAgAAAAHlAQgAAAAB5gEAAJUEACDoAQEAAAABEwUAAJYEACAGAACsBAAgDAAAmAQAIA0AAJkEACC9AQEAAAABwAFAAAAAAdUBAAAA6AEC2QEgAAAAAdsBQAAAAAHfAQEAAAAB4AEBAAAAAeEBAQAAAAHiAQEAAAAB4wEQAAAAAeQBAgAAAAHlAQgAAAAB5gEAAJUEACDoAQEAAAAB6QEBAAAAAQIAAAAFACAeAACGBQAgD70BAQAAAAHAAUAAAAAB1QEAAAD0AQLbAUAAAAAB7wEBAAAAAfABAQAAAAHxARAAAAAB8gEBAAAAAfQBAQAAAAH1AQEAAAAB9gEBAAAAAfcBAQAAAAH4AUAAAAAB-QEBAAAAAfoBQAAAAAEDAAAAAwAgHgAAhgUAIB8AAIsFACAVAAAAAwAgBQAA8QMAIAYAAKsEACAMAADzAwAgDQAA9AMAIBcAAIsFACC9AQEA9wIAIcABQAD4AgAh1QEAAO8D6AEi2QEgAIcDACHbAUAA-AIAId8BAQD3AgAh4AEBAPcCACHhAQEA9wIAIeIBAQD3AgAh4wEQAM0DACHkAQIAiAMAIeUBCADtAwAh5gEAAO4DACDoAQEA9wIAIekBAQD3AgAhEwUAAPEDACAGAACrBAAgDAAA8wMAIA0AAPQDACC9AQEA9wIAIcABQAD4AgAh1QEAAO8D6AEi2QEgAIcDACHbAUAA-AIAId8BAQD3AgAh4AEBAPcCACHhAQEA9wIAIeIBAQD3AgAh4wEQAM0DACHkAQIAiAMAIeUBCADtAwAh5gEAAO4DACDoAQEA9wIAIekBAQD3AgAhCL0BAQAAAAG_AQEAAAABwAFAAAAAAdUBAAAAhgIC2wFAAAAAAYICQAAAAAGDAgIAAAABhAIQAAAAARMFAACWBAAgBgAArAQAIAsAAJcEACANAACZBAAgvQEBAAAAAcABQAAAAAHVAQAAAOgBAtkBIAAAAAHbAUAAAAAB3wEBAAAAAeABAQAAAAHhAQEAAAAB4gEBAAAAAeMBEAAAAAHkAQIAAAAB5QEIAAAAAeYBAACVBAAg6AEBAAAAAekBAQAAAAECAAAABQAgHgAAjQUAIAMAAAADACAeAACNBQAgHwAAkQUAIBUAAAADACAFAADxAwAgBgAAqwQAIAsAAPIDACANAAD0AwAgFwAAkQUAIL0BAQD3AgAhwAFAAPgCACHVAQAA7wPoASLZASAAhwMAIdsBQAD4AgAh3wEBAPcCACHgAQEA9wIAIeEBAQD3AgAh4gEBAPcCACHjARAAzQMAIeQBAgCIAwAh5QEIAO0DACHmAQAA7gMAIOgBAQD3AgAh6QEBAPcCACETBQAA8QMAIAYAAKsEACALAADyAwAgDQAA9AMAIL0BAQD3AgAhwAFAAPgCACHVAQAA7wPoASLZASAAhwMAIdsBQAD4AgAh3wEBAPcCACHgAQEA9wIAIeEBAQD3AgAh4gEBAPcCACHjARAAzQMAIeQBAgCIAwAh5QEIAO0DACHmAQAA7gMAIOgBAQD3AgAh6QEBAPcCACEGvQEBAAAAAb8BAQAAAAHAAUAAAAAB2wFAAAAAAeUBAgAAAAHtAQEAAAABCr0BAQAAAAHAAUAAAAAB1QEAAACKAgLZASAAAAAB2wFAAAAAAd8BAQAAAAHgAQEAAAABhgIBAAAAAYcCAQAAAAGIAgEAAAABA70BAQAAAAG_AQEAAAABwAFAAAAAAQe9AQEAAAABwAFAAAAAAd8BAQAAAAH8AQAAAPwBAv0BAQAAAAH-AQEAAAAB_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_JlOBAQ5UggEoVYMBJlaEASZXhQEOWIgBKVmJAS1aigEMW4sBDFyMAQxdjQEMXo4BDF-QAQxgkgEOYZMBLmKVAQxjlwEOZJgBL2WZAQxmmgEMZ5sBDmieATBpnwE0aqABB2uhAQdsogEHbaMBB26kAQdvpgEHcKgBDnGpATVyqwEHc60BDnSuATZ1rwEHdrABB3exAQ54tAE3ebUBPXq2AQl7twEJfLgBCX25AQl-ugEJf7wBCYABvgEOgQG_AT6CAcEBCYMBwwEOhAHEAT-FAcUBCYYBxgEJhwHHAQ6IAcoBQIkBywFGigHMAQOLAc0BA4wBzgEDjQHPAQOOAdABA48B0gEDkAHUAQ6RAdUBR5IB1wEDkwHZAQ6UAdoBSJUB2wEDlgHcAQOXAd0BDpgB4AFJmQHhAU-aAeMBApsB5AECnAHnAQKdAegBAp4B6QECnwHrAQKgAe0BDqEB7gFQogHwAQKjAfIBDqQB8wFRpQH0AQKmAfUBAqcB9gEOqAH5AVKpAfoBWKoB-wEKqwH8AQqsAf0BCq0B_gEKrgH_AQqvAYECCrABgwIOsQGEAlmyAYYCCrMBiAIOtAGJAlq1AYoCCrYBiwIKtwGMAg64AY8CW7kBkAJf"
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
  BlogPost: "BlogPost",
  Booking: "Booking",
  Category: "Category",
  ContactMessage: "ContactMessage",
  Notification: "Notification",
  Payment: "Payment",
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
var ReviewScalarFieldEnum = {
  id: "id",
  rating: "rating",
  comment: "comment",
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

// src/lib/googleAuth.ts
import { OAuth2Client } from "google-auth-library";
var googleClient = new OAuth2Client({
  clientId: config_default.google_client_id
});

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

// src/modules/auth/auth.service.ts
var buildTokenPayload = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  tokenVersion: user.tokenVersion
});
var issueTokens = (user) => {
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
  return { accessToken, refreshToken: refreshToken3 };
};
var sanitizeUser = (user) => {
  const { password, ...rest } = user;
  return rest;
};
var registerUser = async (payload) => {
  const { name, email, password, phone, role } = payload;
  if (role && role !== "USER" && role !== "AGENT") {
    throw new AppError(400, "Role must be either USER or AGENT");
  }
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  if (existingUser) {
    throw new AppError(409, "User with this email already exists");
  }
  const hashedPassword = await bcrypt.hash(
    password,
    Number(config_default.bcrypt_salt_rounds)
  );
  const createdUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      authProvider: "CREDENTIAL",
      role: role || "USER",
      phone
    },
    omit: { password: true }
  });
  return createdUser;
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
  return issueTokens(user);
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
  const tokens = issueTokens(user);
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
  return { ...issueTokens(demoUser), user: demoUser };
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
  return issueTokens(user);
};
var logout = async (userId) => {
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
    const user = await authService.registerUser(req.body);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus2.CREATED,
      message: "User Registered successfully.",
      data: user
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
var authValidations = {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  demoLoginSchema,
  refreshTokenSchema
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
    const { _avg } = await tx.review.aggregate({
      where: { packageId: payload.packageId },
      _avg: { rating: true }
    });
    const rating = Math.round((_avg.rating ?? 0) * 10) / 10;
    await tx.tourPackage.update({
      where: { id: payload.packageId },
      data: { rating }
    });
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
  const [data, total] = await Promise.all([
    prisma.review.findMany({
      where: { packageId },
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
    prisma.review.count({ where: { packageId } })
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
var reviewService = {
  createReview,
  listPackageReviews
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
var reviewController = {
  createReview: createReview2,
  getPackageReviews
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
var reviewValidations = {
  createReviewSchema,
  reviewParamsSchema,
  reviewQuerySchema
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
import httpStatus11 from "http-status";

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
      statusCode: httpStatus11.OK,
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
      statusCode: httpStatus11.OK,
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
      statusCode: httpStatus11.OK,
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
import { z as z10 } from "zod";
var dashboardQuerySchema = z10.object({
  days: z10.coerce.number().int().min(1).max(365).default(30)
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
import httpStatus12 from "http-status";

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
      statusCode: httpStatus12.CREATED,
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
import { z as z11 } from "zod";
var createSchema2 = z11.object({
  bookingId: z11.string({ required_error: "Booking id is required" }).uuid("Booking id must be a valid uuid")
});
var callbackQuerySchema = z11.object({
  bookingId: z11.string().uuid("Booking id must be a valid uuid"),
  tranId: z11.string().min(1),
  status: z11.enum(["success", "fail", "cancel"]).optional()
});
var gatewayResultSchema = z11.object({
  val_id: z11.string().optional(),
  status: z11.string().optional(),
  fail_status: z11.string().optional(),
  card_type: z11.string().optional(),
  bank_tran_id: z11.string().optional(),
  currency: z11.string().optional(),
  amount: z11.string().optional()
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
import httpStatus13 from "http-status";

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
      statusCode: httpStatus13.CREATED,
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
      statusCode: httpStatus13.OK,
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
    res.status(httpStatus13.NO_CONTENT).send();
  }
);
var wishlistController = {
  addToWishlist: addToWishlist2,
  getMyWishlist: getMyWishlist2,
  removeFromWishlist: removeFromWishlist2
};

// src/modules/wishlist/wishlist.validation.ts
import { z as z12 } from "zod";
var createWishlistSchema = z12.object({
  packageId: z12.string({ required_error: "Package id is required" }).min(1, "Package id must not be empty")
}).strict();
var wishlistParamsSchema = z12.object({
  packageId: z12.string({ required_error: "Package id is required" }).min(1, "Package id must not be empty")
});
var wishlistQuerySchema = z12.object({
  page: z12.coerce.number().int().min(1).default(1),
  limit: z12.coerce.number().int().min(1).max(50).default(10)
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
import httpStatus14 from "http-status";

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
      statusCode: httpStatus14.OK,
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
      statusCode: httpStatus14.OK,
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
      statusCode: httpStatus14.OK,
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
      statusCode: httpStatus14.OK,
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
import { z as z13 } from "zod";
var notificationQuerySchema = z13.object({
  page: z13.coerce.number().int().min(1).default(1),
  limit: z13.coerce.number().int().min(1).max(50).default(20),
  // "true"/"false" strings only — z.coerce.boolean() would treat the string
  // "false" as truthy.
  unread: z13.enum(["true", "false"]).transform((value) => value === "true").optional()
});
var notificationParamsSchema = z13.object({
  id: z13.string({ required_error: "Notification id is required" }).min(1, "Notification id must not be empty")
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FwcC50cyIsICIuLi9zcmMvY29uZmlnL2luZGV4LnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL25vdEZvdW5kLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudC50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2ludGVybmFsL2NsYXNzLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXMudHMiLCAiLi4vc3JjL3V0aWxzL2FwcEVycm9yLnRzIiwgIi4uL3NyYy9saWIvcHJpc21hLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguc2VydmljZS50cyIsICIuLi9zcmMvbGliL2dvb2dsZUF1dGgudHMiLCAiLi4vc3JjL3V0aWxzL2p3dC50cyIsICIuLi9zcmMvdXRpbHMvY2F0Y2hBc3luYy50cyIsICIuLi9zcmMvdXRpbHMvc2VuZFJlc3BvbnNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdC50cyIsICIuLi9zcmMvbWlkZGxld2FyZS9hdXRoLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL2xpYi9jbG91ZGluYXJ5LnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jb250YWN0L2NvbnRhY3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvdXRpbHMvZW1haWwudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9saWIvc3NsY29tbWVyei50cyIsICIuLi9zcmMvdXRpbHMvbm90aWZpY2F0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvcmV2aWV3L3Jldmlldy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkuY29udHJvbGxlci50cyIsICIuLi9zcmMvdXRpbHMvc2x1Z2lmeS50cyIsICIuLi9zcmMvbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvcGFja2FnZS9wYWNrYWdlLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jsb2cvYmxvZy5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BheW1lbnQvcGF5bWVudC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3dpc2hsaXN0L3dpc2hsaXN0LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3QudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ub3RpZmljYXRpb24vbm90aWZpY2F0aW9uLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL25vdGlmaWNhdGlvbi9ub3RpZmljYXRpb24uY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9ub3RpZmljYXRpb24vbm90aWZpY2F0aW9uLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi52YWxpZGF0aW9uLnRzIiwgImluZGV4LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgZXhwcmVzcywgeyBBcHBsaWNhdGlvbiwgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XHJcbmltcG9ydCBjb3JzIGZyb20gXCJjb3JzXCI7XHJcbmltcG9ydCBjb29raWVQYXJzZXIgZnJvbSBcImNvb2tpZS1wYXJzZXJcIjtcclxuaW1wb3J0IGhlbG1ldCBmcm9tIFwiaGVsbWV0XCI7XHJcbmltcG9ydCBtb3JnYW4gZnJvbSBcIm1vcmdhblwiO1xyXG5pbXBvcnQgcmF0ZUxpbWl0IGZyb20gXCJleHByZXNzLXJhdGUtbGltaXRcIjtcclxuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi9jb25maWdcIjtcclxuaW1wb3J0IG5vdEZvdW5kSGFuZGxlciBmcm9tIFwiLi9taWRkbGV3YXJlL25vdEZvdW5kXCI7XHJcbmltcG9ydCBnbG9iYWxFcnJvckhhbmRsZXIgZnJvbSBcIi4vbWlkZGxld2FyZS9nbG9iYWxFcnJvckhhbmRsZXJcIjtcclxuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4vbGliL3ByaXNtYVwiO1xyXG5pbXBvcnQgeyBhdXRoUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9hdXRoL2F1dGgucm91dGVcIjtcclxuaW1wb3J0IHsgdXNlclJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvdXNlci91c2VyLnJvdXRlXCI7XHJcbmltcG9ydCB7IHVwbG9hZFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLnJvdXRlXCI7XHJcbmltcG9ydCB7IGNvbnRhY3RSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBib29raW5nUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcucm91dGVcIjtcclxuaW1wb3J0IHsgcmV2aWV3Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnJvdXRlXCI7XHJcbmltcG9ydCB7IGNhdGVnb3J5Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBwYWNrYWdlUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2Uucm91dGVcIjtcclxuaW1wb3J0IHsgYmxvZ1JvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvYmxvZy9ibG9nLnJvdXRlXCI7XHJcbmltcG9ydCB7IGRhc2hib2FyZFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBwYXltZW50Um91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9wYXltZW50L3BheW1lbnQucm91dGVcIjtcclxuaW1wb3J0IHsgd2lzaGxpc3RSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3dpc2hsaXN0L3dpc2hsaXN0LnJvdXRlXCI7XHJcbmltcG9ydCB7IG5vdGlmaWNhdGlvblJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvbm90aWZpY2F0aW9uL25vdGlmaWNhdGlvbi5yb3V0ZVwiO1xyXG5cclxuY29uc3QgYXBwOiBBcHBsaWNhdGlvbiA9IGV4cHJlc3MoKTtcclxuXHJcbi8vIFJlbmRlci9SYWlsd2F5IHNpdCBiZWhpbmQgYSByZXZlcnNlIHByb3h5IFx1MjAxNCBtdXN0IGJlIHNldCBiZWZvcmUgdGhlXHJcbi8vIHJhdGUgbGltaXRlciBvciBpdCB3aWxsIHNlZSB0aGUgcHJveHkncyBJUCBmb3IgZXZlcnkgcmVxdWVzdCBhbmRcclxuLy8gZWZmZWN0aXZlbHkgcmF0ZS1saW1pdCBhbGwgdXNlcnMgdG9nZXRoZXIuXHJcbmFwcC5zZXQoXCJ0cnVzdCBwcm94eVwiLCAxKTtcclxuXHJcbmFwcC51c2UoaGVsbWV0KCkpO1xyXG5cclxuYXBwLnVzZShcclxuICBjb3JzKHtcclxuICAgIC8vIERldiBob3N0IChsb2NhbGhvc3QpICsgcHJvZCBob3N0IChWZXJjZWwpIGJvdGggYWxsb3dlZCBzaWRlLWJ5LXNpZGUuXHJcbiAgICAvLyBDb25maWcgcmVzb2x2ZXMgc2Vuc2libGUgZGVmYXVsdHMgc28gbmVpdGhlciBjYW4gYmUgZmFsc3kuXHJcbiAgICBvcmlnaW46IFtjb25maWcuZnJvbnRlbmRfdXJsX2RldiwgY29uZmlnLmZyb250ZW5kX3VybF9wcm9kXS5maWx0ZXIoXHJcbiAgICAgIChvKTogbyBpcyBzdHJpbmcgPT4gQm9vbGVhbihvKSxcclxuICAgICksXHJcbiAgICBjcmVkZW50aWFsczogdHJ1ZSxcclxuICB9KSxcclxuKTtcclxuXHJcbmlmIChjb25maWcubm9kZV9lbnYgIT09IFwicHJvZHVjdGlvblwiKSB7XHJcbiAgYXBwLnVzZShtb3JnYW4oXCJkZXZcIikpO1xyXG59XHJcblxyXG5hcHAudXNlKGV4cHJlc3MuanNvbih7IGxpbWl0OiBcIjEwMGtiXCIgfSkpO1xyXG5hcHAudXNlKGV4cHJlc3MudXJsZW5jb2RlZCh7IGV4dGVuZGVkOiB0cnVlLCBsaW1pdDogXCIxMDBrYlwiIH0pKTtcclxuYXBwLnVzZShjb29raWVQYXJzZXIoKSk7XHJcblxyXG4vLyBTdHJpY3QgbGltaXRlciBcdTIwMTQgYXV0aCBlbmRwb2ludHMsIGJydXRlLWZvcmNlIHByb3RlY3Rpb25cclxuY29uc3QgYXV0aExpbWl0ZXIgPSByYXRlTGltaXQoe1xyXG4gIHdpbmRvd01zOiAxNSAqIDYwICogMTAwMCxcclxuICBsaW1pdDogNSxcclxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXHJcbiAgbGVnYWN5SGVhZGVyczogZmFsc2UsXHJcbiAgbWVzc2FnZToge1xyXG4gICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICBtZXNzYWdlOiBcIlRvbyBtYW55IGF0dGVtcHRzLiBQbGVhc2UgdHJ5IGFnYWluIGluIDE1IG1pbnV0ZXMuXCIsXHJcbiAgfSxcclxufSk7XHJcblxyXG4vLyBTdGFuZGFyZCBsaW1pdGVyIFx1MjAxNCBldmVyeXRoaW5nIGVsc2UgdW5kZXIgL2FwaVxyXG5jb25zdCBhcGlMaW1pdGVyID0gcmF0ZUxpbWl0KHtcclxuICB3aW5kb3dNczogMTUgKiA2MCAqIDEwMDAsXHJcbiAgbGltaXQ6IDEwMCxcclxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXHJcbiAgbGVnYWN5SGVhZGVyczogZmFsc2UsXHJcbiAgbWVzc2FnZToge1xyXG4gICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICBtZXNzYWdlOiBcIlRvbyBtYW55IHJlcXVlc3RzLiBQbGVhc2UgdHJ5IGFnYWluIGxhdGVyLlwiLFxyXG4gIH0sXHJcbn0pO1xyXG5cclxuYXBwLnVzZShcIi9hcGkvYXV0aC9sb2dpblwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvcmVnaXN0ZXJcIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL2RlbW8tbG9naW5cIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL2dvb2dsZVwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpXCIsIGFwaUxpbWl0ZXIpO1xyXG5cclxuLy8gUm9vdCByb3V0ZVxyXG5hcHAuZ2V0KFwiL1wiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgcmVzLnNlbmQoXCJXZWxjb21lIHRvIHRoZSBUcmlwVmVyc2UgQVBJIVwiKTtcclxufSk7XHJcblxyXG4vLyBIZWFsdGggY2hlY2sgXHUyMDE0IHJlYWwgREIgY29ubmVjdGl2aXR5IGNoZWNrLCBub3QgYSBzdGF0aWMgMjAwLlxyXG5hcHAuZ2V0KFwiL2hlYWx0aFwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUIDFgO1xyXG4gICAgcmVzLnN0YXR1cygyMDApLmpzb24oe1xyXG4gICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICBtZXNzYWdlOiBcIk9LXCIsXHJcbiAgICAgIGRiOiBcImNvbm5lY3RlZFwiLFxyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgIH0pO1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICByZXMuc3RhdHVzKDUwMykuanNvbih7XHJcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICBtZXNzYWdlOiBcIlNlcnZpY2UgdW5hdmFpbGFibGVcIixcclxuICAgICAgZGI6IFwiZGlzY29ubmVjdGVkXCIsXHJcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59KTtcclxuXHJcbi8vIFx1MjUwMFx1MjUwMCBGZWF0dXJlIHJvdXRlcyByZWdpc3RlciBoZXJlIGFzIGVhY2ggbW9kdWxlIGlzIGJ1aWx0IFx1MjUwMFx1MjUwMFxyXG5hcHAudXNlKFwiL2FwaS9hdXRoXCIsIGF1dGhSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS91c2Vyc1wiLCB1c2VyUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvdXBsb2Fkc1wiLCB1cGxvYWRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jb250YWN0XCIsIGNvbnRhY3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jYXRlZ29yaWVzXCIsIGNhdGVnb3J5Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvcGFja2FnZXNcIiwgcGFja2FnZVJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3Jldmlld3NcIiwgcmV2aWV3Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvYm9va2luZ3NcIiwgYm9va2luZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Jsb2dcIiwgYmxvZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Rhc2hib2FyZFwiLCBkYXNoYm9hcmRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9wYXltZW50c1wiLCBwYXltZW50Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvd2lzaGxpc3RcIiwgd2lzaGxpc3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9ub3RpZmljYXRpb25zXCIsIG5vdGlmaWNhdGlvblJvdXRlcyk7XHJcblxyXG5hcHAudXNlKG5vdEZvdW5kSGFuZGxlcik7XHJcbmFwcC51c2UoZ2xvYmFsRXJyb3JIYW5kbGVyKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGFwcDtcclxuIiwgImltcG9ydCBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmRvdGVudi5jb25maWcoe1xuICBxdWlldDogdHJ1ZSxcbiAgcGF0aDogcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIFwiLmVudlwiKSxcbn0pO1xuXG4vLyBFdmVyeSBtb2R1bGUgcmVhZHMgY29uZmlnIHRocm91Z2ggdGhpcyB2YWxpZGF0ZWQgb2JqZWN0LCBuZXZlclxuLy8gcHJvY2Vzcy5lbnYgZGlyZWN0bHkgXHUyMDE0IGEgbWlzc2luZy9tYWxmb3JtZWQgdmFyIGZhaWxzIGxvdWRseSBhdCBib290XG4vLyBpbnN0ZWFkIG9mIHN1cmZhY2luZyBhcyBhIGNvbmZ1c2luZyBydW50aW1lIGVycm9yIG1pZC1yZXF1ZXN0LlxuY29uc3QgZW52U2NoZW1hID0gei5vYmplY3Qoe1xuICBQT1JUOiB6LnN0cmluZygpLmRlZmF1bHQoXCI0MDAwXCIpLFxuICBOT0RFX0VOVjogei5lbnVtKFtcImRldmVsb3BtZW50XCIsIFwicHJvZHVjdGlvblwiXSkuZGVmYXVsdChcImRldmVsb3BtZW50XCIpLFxuXG4gIC8vIEZyb250ZW5kIG9yaWdpbnMgZm9yIENPUlMgKyBwYXltZW50IHJlZGlyZWN0cy4gVGhlIGZyb250ZW5kIG1heSBub3QgYmVcbiAgLy8gZGVwbG95ZWQgeWV0IChvciBtYXkgYmUgcmVidWlsdCksIHNvIGJvdGggYXJlIG9wdGlvbmFsOiB0aGUgYmFja2VuZCBtdXN0XG4gIC8vIG5ldmVyIHJlZnVzZSB0byBib290IGp1c3QgYmVjYXVzZSBhIFVJIGhvc3QgaXNuJ3QgbGl2ZS4gUm91dGVzIHRoYXQgbmVlZCBhXG4gIC8vIHJlYWwgb3JpZ2luIChwYXltZW50IGNhbGxiYWNrIHJlZGlyZWN0cykgZmFsbCBiYWNrIHRvIHRoZSBiYWNrZW5kIFVSTC5cbiAgRlJPTlRFTkRfVVJMX0RFVjogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBGUk9OVEVORF9VUkxfUFJPRDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuXG4gIERBVEFCQVNFX1VSTDogei5zdHJpbmcoKS5taW4oMSwgXCJEQVRBQkFTRV9VUkwgaXMgcmVxdWlyZWRcIiksXG5cbiAgQkNSWVBUX1NBTFRfUk9VTkRTOiB6LnN0cmluZygpLmRlZmF1bHQoXCIxMFwiKSxcblxuICAvLyBPcHRpb25hbCBhZG1pbiBjcmVkZW50aWFscyB1c2VkIGJ5IHRoZSBzZWVkIHNjcmlwdCAoU3RlcCAxMykuIEZhbGxzIGJhY2tcbiAgLy8gdG8gZGVtby1hZG1pbkB0cmlwdmVyc2UuY29tIC8gZGVtbzEyMyB3aGVuIHVuc2V0LlxuICBBRE1JTl9FTUFJTDogei5zdHJpbmcoKS5lbWFpbCgpLm9wdGlvbmFsKCksXG4gIEFETUlOX1BBU1NXT1JEOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxuXG4gIC8vIFNTTENvbW1lcnogKFN0ZXAgMTYpIFx1MjAxNCBzYW5kYm94IHN0b3JlIGNyZWRzIHVudGlsIGdvLWxpdmUuIFNTTF9DT01NRVJaX1NBTkRCT1hcbiAgLy8gcGlja3MgdGhlIHNhbmRib3ggdnMgbGl2ZSBBUEkgYmFzZSBVUkwuIE9wdGlvbmFsIHNvIHRoZSBBUEkgYm9vdHMgKGhlYWx0aCxcbiAgLy8gYXV0aCwgY2F0YWxvZywgZXRjLikgZXZlbiB3aGVuIHRoZSBwYXltZW50IHN0b3JlIGlzbid0IGNvbmZpZ3VyZWQgeWV0IFx1MjAxNCB0aGVcbiAgLy8gcGF5bWVudCBlbmRwb2ludHMgdGhlbiBmYWlsIHdpdGggYSBjbGVhbiBcIm5vdCBjb25maWd1cmVkXCIgZXJyb3IgaW5zdGVhZCBvZlxuICAvLyB0YWtpbmcgdGhlIHdob2xlIGRlcGxveW1lbnQgZG93bi5cbiAgU1NMX0NPTU1FUlpfU1RPUkVfSUQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgU1NMX0NPTU1FUlpfU0FOREJPWDogei5zdHJpbmcoKS5kZWZhdWx0KFwidHJ1ZVwiKSxcbiAgLy8gT3B0aW9uYWwgZXhwbGljaXQgZ2F0ZXdheS92YWxpZGF0b3IgYmFzZSBVUkxzIChHZWFyVXAgcGF0dGVybikuIERlZmF1bHRzIGFyZVxuICAvLyBkZXJpdmVkIGZyb20gU1NMX0NPTU1FUlpfU0FOREJPWCB3aGVuIGFic2VudC5cbiAgU1NMQ09NTUVSWl9JTklUX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBTU0xDT01NRVJaX1ZBTElEQVRFX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuICBTU0xDT01NRVJaX1JFRlVORF9VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICAvLyBQdWJsaWNseSByZWFjaGFibGUgYmFzZSBVUkwgdGhlIHBheW1lbnQgbW9kdWxlIHVzZXMgdG8gYnVpbGQgdGhlXG4gIC8vIFNTTENvbW1lcnogc3VjY2Vzcy9mYWlsL2NhbmNlbC9JUE4gY2FsbGJhY2sgVVJMcy4gTXVzdCBOT1QgYmUgbG9jYWxob3N0IGluXG4gIC8vIHNhbmRib3ggXHUyMDE0IHRoZSBnYXRld2F5IFBPU1RzIHRvIHRoZXNlIHNlcnZlci10by1zZXJ2ZXIuIE9wdGlvbmFsIGxpa2UgdGhlXG4gIC8vIHN0b3JlIGNyZWRzIGFib3ZlIChwYXltZW50LW9ubHkpLlxuICBCQUNLRU5EX1BVQkxJQ19VUkw6IHouc3RyaW5nKCkudXJsKCkub3B0aW9uYWwoKSxcblxuICBKV1RfQUNDRVNTX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJKV1RfQUNDRVNTX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX1JFRlJFU0hfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkpXVF9SRUZSRVNIX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbiAgSldUX0FDQ0VTU19FWFBJUkVTX0lOOiB6LnN0cmluZygpLmRlZmF1bHQoXCIxZFwiKSxcbiAgSldUX1JFRlJFU0hfRVhQSVJFU19JTjogei5zdHJpbmcoKS5kZWZhdWx0KFwiMzBkXCIpLFxuXG4gIC8vIEdvb2dsZSBPQXV0aCBpcyBvcHRpb25hbCBcdTIwMTQgc2VydmVyIGJvb3RzIHdpdGhvdXQgaXQ7IC9hcGkvYXV0aC9nb29nbGVcbiAgLy8gcmV0dXJucyBhIGNsZWFuIDQwMCB1bnRpbCBHT09HTEVfQ0xJRU5UX0lEIGlzIGNvbmZpZ3VyZWQuXG4gIEdPT0dMRV9DTElFTlRfSUQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcblxuICAvLyBCZXN0LWVmZm9ydCBjb250YWN0IGVtYWlscyAoUmVzZW5kKSBcdTIwMTQgYWx3YXlzIG9wdGlvbmFsOyBzdWJtaXNzaW9uc1xuICAvLyBzdWNjZWVkIGFuZCBlbWFpbHMgYmVjb21lIG5vLW9wcyB3aGVuIHRoZXNlIGFyZSBtaXNzaW5nLlxuICBSRVNFTkRfQVBJX0tFWTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBDT05UQUNUX1JFQ0VJVkVSX0VNQUlMOiB6LnN0cmluZygpLmVtYWlsKCkub3B0aW9uYWwoKSxcbiAgRU1BSUxfRlJPTTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIENMT1VESU5BUllfQ0xPVURfTkFNRTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0NMT1VEX05BTUUgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX0tFWTogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9LRVkgaXMgcmVxdWlyZWRcIiksXG4gIENMT1VESU5BUllfQVBJX1NFQ1JFVDogei5zdHJpbmcoKS5taW4oMSwgXCJDTE9VRElOQVJZX0FQSV9TRUNSRVQgaXMgcmVxdWlyZWRcIiksXG59KTtcblxuY29uc3QgcGFyc2VkID0gZW52U2NoZW1hLnNhZmVQYXJzZShwcm9jZXNzLmVudik7XG5cbmlmICghcGFyc2VkLnN1Y2Nlc3MpIHtcbiAgY29uc29sZS5lcnJvcihcIlx1Mjc0QyBJbnZhbGlkIGVudmlyb25tZW50IHZhcmlhYmxlczpcIik7XG4gIGNvbnNvbGUuZXJyb3IocGFyc2VkLmVycm9yLmZsYXR0ZW4oKS5maWVsZEVycm9ycyk7XG4gIHByb2Nlc3MuZXhpdCgxKTtcbn1cblxuY29uc3QgZW52ID0gcGFyc2VkLmRhdGE7XG5cbmNvbnN0IGNvbmZpZyA9IHtcbiAgcG9ydDogZW52LlBPUlQsXG4gIG5vZGVfZW52OiBlbnYuTk9ERV9FTlYsXG5cbiAgLy8gRnJvbnRlbmQgb3JpZ2lucyBmb3IgQ09SUyArIHBheW1lbnQgcmVkaXJlY3RzLiBMb2NhbGhvc3QgYWx3YXlzIHdpbnMgZm9yXG4gIC8vIGxvY2FsIHRlc3Rpbmc7IHByb2R1Y3Rpb24gdXNlcyB0aGUgVmVyY2VsIGZyb250ZW5kIFVSTCwgZmFsbGluZyBiYWNrIHRvIHRoZVxuICAvLyBiYWNrZW5kIFVSTCBzbyB0aGUgQVBJIHN0YXlzIHJlYWNoYWJsZSBldmVuIGJlZm9yZSB0aGUgVUkgaXMgZGVwbG95ZWQuXG4gIGZyb250ZW5kX3VybF9kZXY6IGVudi5GUk9OVEVORF9VUkxfREVWIHx8IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gIGZyb250ZW5kX3VybF9wcm9kOlxuICAgIGVudi5GUk9OVEVORF9VUkxfUFJPRCB8fCBlbnYuQkFDS0VORF9QVUJMSUNfVVJMIHx8IFwiXCIsXG5cbiAgZGF0YWJhc2VfdXJsOiBlbnYuREFUQUJBU0VfVVJMLFxuXG4gIGJjcnlwdF9zYWx0X3JvdW5kczogZW52LkJDUllQVF9TQUxUX1JPVU5EUyxcblxuICBhZG1pbl9lbWFpbDogZW52LkFETUlOX0VNQUlMLFxuICBhZG1pbl9wYXNzd29yZDogZW52LkFETUlOX1BBU1NXT1JELFxuXG4gIHNzbF9jb21tZXJ6X3N0b3JlX2lkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfSUQsXG4gIHNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkOiBlbnYuU1NMX0NPTU1FUlpfU1RPUkVfUEFTU1dPUkQsXG4gIHNzbF9jb21tZXJ6X3NhbmRib3g6IGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIixcbiAgLy8gc2FuZGJveCBiYXNlIFVSTHMgKGZhbGxiYWNrIHdoZW4gdGhlIGV4cGxpY2l0IG92ZXJyaWRlIHZhcnMgYXJlIGFic2VudClcbiAgc3NsY29tbWVyel9pbml0X3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9JTklUX1VSTCA/P1xuICAgIChlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCJcbiAgICAgID8gXCJodHRwczovL3NhbmRib3guc3NsY29tbWVyei5jb20vZ3dwcm9jZXNzL3Y0L2FwaS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL2d3cHJvY2Vzcy92NC9hcGkucGhwXCIpLFxuICBzc2xjb21tZXJ6X3ZhbGlkYXRlX3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9WQUxJREFURV9VUkwgPz9cbiAgICAoZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiXG4gICAgICA/IFwiaHR0cHM6Ly9zYW5kYm94LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvdmFsaWRhdGlvbnNlcnZlckFQSS5waHBcIiksXG4gIHNzbGNvbW1lcnpfcmVmdW5kX3VybDpcbiAgICBlbnYuU1NMQ09NTUVSWl9SRUZVTkRfVVJMID8/XG4gICAgKGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIlxuICAgICAgPyBcImh0dHBzOi8vc2FuZGJveC5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL21lcmNoYW50VHJhbnNJRHZhbGlkYXRpb25BUEkucGhwXCJcbiAgICAgIDogXCJodHRwczovL3NlY3VyZXBheS5zc2xjb21tZXJ6LmNvbS92YWxpZGF0b3IvYXBpL21lcmNoYW50VHJhbnNJRHZhbGlkYXRpb25BUEkucGhwXCIpLFxuICBiYWNrZW5kX3B1YmxpY191cmw6IGVudi5CQUNLRU5EX1BVQkxJQ19VUkwsXG5cbiAgand0X2FjY2Vzc19zZWNyZXQ6IGVudi5KV1RfQUNDRVNTX1NFQ1JFVCxcbiAgand0X3JlZnJlc2hfc2VjcmV0OiBlbnYuSldUX1JFRlJFU0hfU0VDUkVULFxuICBqd3RfYWNjZXNzX2V4cGlyZXNfaW46IGVudi5KV1RfQUNDRVNTX0VYUElSRVNfSU4sXG4gIGp3dF9yZWZyZXNoX2V4cGlyZXNfaW46IGVudi5KV1RfUkVGUkVTSF9FWFBJUkVTX0lOLFxuXG4gIGdvb2dsZV9jbGllbnRfaWQ6IGVudi5HT09HTEVfQ0xJRU5UX0lELFxuXG4gIHJlc2VuZF9hcGlfa2V5OiBlbnYuUkVTRU5EX0FQSV9LRVksXG4gIGNvbnRhY3RfcmVjZWl2ZXJfZW1haWw6IGVudi5DT05UQUNUX1JFQ0VJVkVSX0VNQUlMLFxuICBlbWFpbF9mcm9tOiBlbnYuRU1BSUxfRlJPTSxcblxuICBjbG91ZGluYXJ5X2Nsb3VkX25hbWU6IGVudi5DTE9VRElOQVJZX0NMT1VEX05BTUUsXG4gIGNsb3VkaW5hcnlfYXBpX2tleTogZW52LkNMT1VESU5BUllfQVBJX0tFWSxcbiAgY2xvdWRpbmFyeV9hcGlfc2VjcmV0OiBlbnYuQ0xPVURJTkFSWV9BUElfU0VDUkVULFxufTtcblxuZXhwb3J0IGRlZmF1bHQgY29uZmlnO1xuIiwgImltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuY29uc3Qgbm90Rm91bmRIYW5kbGVyID0gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkgPT4ge1xuICByZXMuc3RhdHVzKDQwNCkuanNvbih7XG4gICAgc3VjY2VzczogZmFsc2UsXG4gICAgc3RhdHVzQ29kZTogNDA0LFxuICAgIG1lc3NhZ2U6IFwiUm91dGUgbm90IGZvdW5kXCIsXG4gICAgcGF0aDogcmVxLm9yaWdpbmFsVXJsLFxuICAgIGRhdGU6IG5ldyBEYXRlKCksXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgbm90Rm91bmRIYW5kbGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgbXVsdGVyIGZyb20gXCJtdWx0ZXJcIjtcbmltcG9ydCB7IFpvZEVycm9yIH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbmNvbnN0IGdsb2JhbEVycm9ySGFuZGxlciA9IChcbiAgZXJyOiBhbnksXG4gIHJlcTogUmVxdWVzdCxcbiAgcmVzOiBSZXNwb25zZSxcbiAgbmV4dDogTmV4dEZ1bmN0aW9uLFxuKSA9PiB7XG4gIGlmIChjb25maWcubm9kZV9lbnYgIT09IFwicHJvZHVjdGlvblwiKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yOlwiLCBlcnIpO1xuICB9XG5cbiAgLy8gZGVmYXVsdCBmYWxsYmFja1xuICBsZXQgc3RhdHVzQ29kZTogbnVtYmVyID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gIGxldCBlcnJvck1lc3NhZ2U6IHN0cmluZyA9IGVycj8ubWVzc2FnZSB8fCBcIkludGVybmFsIFNlcnZlciBFcnJvclwiO1xuICBsZXQgZXJyb3JOYW1lOiBzdHJpbmcgPSBlcnI/Lm5hbWUgfHwgXCJFcnJvclwiO1xuXG4gIC8vIFpvZCB2YWxpZGF0aW9uIGVycm9yXG4gIGlmIChlcnIgaW5zdGFuY2VvZiBab2RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5pc3N1ZXMubWFwKChpKSA9PiBpLm1lc3NhZ2UpLmpvaW4oXCIsIFwiKTtcbiAgICBlcnJvck5hbWUgPSBcIlpvZEVycm9yXCI7XG4gIH1cblxuICAvLyBNdWx0ZXIgZmlsZSB1cGxvYWQgZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgbXVsdGVyLk11bHRlckVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JOYW1lID0gXCJNdWx0ZXJFcnJvclwiO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBlcnIuY29kZSA9PT0gXCJMSU1JVF9GSUxFX1NJWkVcIlxuICAgICAgICA/IFwiRmlsZSB0b28gbGFyZ2UuIE1heGltdW0gc2l6ZSBpcyA1TUIuXCJcbiAgICAgICAgOiBgVXBsb2FkIGZhaWxlZDogJHtlcnIuY29kZX1gO1xuICB9XG5cbiAgLy8gQ3VzdG9tIGZpbGUgdHlwZSByZWplY3Rpb24gZnJvbSB0aGUgbXVsdGVyIGZpbGVGaWx0ZXJcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgKGVyciBhcyBhbnkpLmNvZGUgPT09IFwiSU5WQUxJRF9GSUxFX1RZUEVcIikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICB9XG5cbiAgLy8gUHJpc21hIHZhbGlkYXRpb24gZXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICBcIllvdSBoYXZlIHByb3ZpZGVkIGluY29ycmVjdCBmaWVsZCB0eXBlIG9yIG1pc3NpbmcgcmVxdWlyZWQgZmllbGRzXCI7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3JcIjtcbiAgfVxuXG4gIC8vIFByaXNtYSBrbm93biBlcnJvcnNcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgUHJpc21hLlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yKSB7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclwiO1xuXG4gICAgaWYgKGVyci5jb2RlID09PSBcIlAyMDAyXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkNPTkZMSUNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJUaGlzIHZhbHVlIGFscmVhZHkgZXhpc3RzXCI7XG4gICAgfSBlbHNlIGlmIChlcnIuY29kZSA9PT0gXCJQMjAwM1wiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5DT05GTElDVDtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiRm9yZWlnbiBrZXkgY29uc3RyYWludCBmYWlsZWRcIjtcbiAgICB9IGVsc2UgaWYgKGVyci5jb2RlID09PSBcIlAyMDI1XCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLk5PVF9GT1VORDtcbiAgICAgIGVycm9yTWVzc2FnZSA9XG4gICAgICAgIFwiQW4gb3BlcmF0aW9uIGZhaWxlZCBiZWNhdXNlIG9uZSBvciBtb3JlIHJlcXVpcmVkIHJlY29yZHMgd2VyZSBub3QgZm91bmQuXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkJBRF9SRVFVRVNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIERCIGNvbm5lY3Rpb24vaW5pdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvcikge1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclwiO1xuXG4gICAgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDBcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuVU5BVVRIT1JJWkVEO1xuICAgICAgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgXCJBdXRoZW50aWNhdGlvbiBmYWlsZWQgYWdhaW5zdCB0aGUgZGF0YWJhc2Ugc2VydmVyLiBQbGVhc2UgY2hlY2sgeW91ciBkYXRhYmFzZSBjcmVkZW50aWFscy5cIjtcbiAgICB9IGVsc2UgaWYgKGVyci5lcnJvckNvZGUgPT09IFwiUDEwMDFcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuU0VSVklDRV9VTkFWQUlMQUJMRTtcbiAgICAgIGVycm9yTWVzc2FnZSA9IFwiQ2FuJ3QgcmVhY2ggdGhlIGRhdGFiYXNlIHNlcnZlci5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpc21hIHVua25vd24gcmVxdWVzdCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvcikge1xuICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3JcIjtcbiAgICBlcnJvck1lc3NhZ2UgPSBcIkVycm9yIG9jY3VycmVkIGR1cmluZyBxdWVyeSBleGVjdXRpb25cIjtcbiAgfVxuXG4gIC8vIFlvdXIgY3VzdG9tIEFwcEVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEFwcEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGVyci5zdGF0dXNDb2RlO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgIGVycm9yTmFtZSA9IGVyci5uYW1lIHx8IFwiQXBwRXJyb3JcIjtcbiAgfVxuXG4gIC8vIEZhbGxiYWNrIGZvciBvdGhlciB0aHJvd24gZXJyb3JzXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgIGVycm9yTWVzc2FnZSA9IGVyci5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCI7XG4gICAgZXJyb3JOYW1lID0gZXJyLm5hbWUgfHwgXCJFcnJvclwiO1xuICB9XG5cbiAgcmVzLnN0YXR1cyhzdGF0dXNDb2RlKS5qc29uKHtcbiAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICBzdGF0dXNDb2RlLFxuICAgIG5hbWU6IGVycm9yTmFtZSxcbiAgICBtZXNzYWdlOiBlcnJvck1lc3NhZ2UsXG4gICAgZXJyb3I6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcImRldmVsb3BtZW50XCIgPyBlcnIuc3RhY2sgOiB1bmRlZmluZWQsXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgZ2xvYmFsRXJyb3JIYW5kbGVyO1xuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogVGhpcyBmaWxlIHNob3VsZCBiZSB5b3VyIG1haW4gaW1wb3J0IHRvIHVzZSBQcmlzbWEuIFRocm91Z2ggaXQgeW91IGdldCBhY2Nlc3MgdG8gYWxsIHRoZSBtb2RlbHMsIGVudW1zLCBhbmQgaW5wdXQgdHlwZXMuXG4gKiBJZiB5b3UncmUgbG9va2luZyBmb3Igc29tZXRoaW5nIHlvdSBjYW4gaW1wb3J0IGluIHRoZSBjbGllbnQtc2lkZSBvZiB5b3VyIGFwcGxpY2F0aW9uLCBwbGVhc2UgcmVmZXIgdG8gdGhlIGBicm93c2VyLnRzYCBmaWxlIGluc3RlYWQuXG4gKlxuICogXHVEODNEXHVERkUyIFlvdSBjYW4gaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseS5cbiAqL1xuXG5pbXBvcnQgKiBhcyBwcm9jZXNzIGZyb20gJ25vZGU6cHJvY2VzcydcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJ1xuZ2xvYmFsVGhpc1snX19kaXJuYW1lJ10gPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKVxuXG5pbXBvcnQgKiBhcyBydW50aW1lIGZyb20gXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL2NsaWVudFwiXG5pbXBvcnQgKiBhcyAkRW51bXMgZnJvbSBcIi4vZW51bXNcIlxuaW1wb3J0ICogYXMgJENsYXNzIGZyb20gXCIuL2ludGVybmFsL2NsYXNzXCJcbmltcG9ydCAqIGFzIFByaXNtYSBmcm9tIFwiLi9pbnRlcm5hbC9wcmlzbWFOYW1lc3BhY2VcIlxuXG5leHBvcnQgKiBhcyAkRW51bXMgZnJvbSAnLi9lbnVtcydcbmV4cG9ydCAqIGZyb20gXCIuL2VudW1zXCJcbi8qKlxuICogIyMgUHJpc21hIENsaWVudFxuICogXG4gKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAqICAgYWRhcHRlcjogbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gKiB9KVxuICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dQb3N0c1xuICogY29uc3QgYmxvZ1Bvc3RzID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KClcbiAqIGBgYFxuICogXG4gKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9jbGllbnQpLlxuICovXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50ID0gJENsYXNzLmdldFByaXNtYUNsaWVudENsYXNzKClcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudDxMb2dPcHRzIGV4dGVuZHMgUHJpc21hLkxvZ0xldmVsID0gbmV2ZXIsIE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbXCJvbWl0XCJdLCBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncz4gPSAkQ2xhc3MuUHJpc21hQ2xpZW50PExvZ09wdHMsIE9taXRPcHRzLCBFeHRBcmdzPlxuZXhwb3J0IHsgUHJpc21hIH1cblxuLyoqXG4gKiBNb2RlbCBCbG9nUG9zdFxuICogXG4gKi9cbmV4cG9ydCB0eXBlIEJsb2dQb3N0ID0gUHJpc21hLkJsb2dQb3N0TW9kZWxcbi8qKlxuICogTW9kZWwgQm9va2luZ1xuICogXG4gKi9cbmV4cG9ydCB0eXBlIEJvb2tpbmcgPSBQcmlzbWEuQm9va2luZ01vZGVsXG4vKipcbiAqIE1vZGVsIENhdGVnb3J5XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQ2F0ZWdvcnkgPSBQcmlzbWEuQ2F0ZWdvcnlNb2RlbFxuLyoqXG4gKiBNb2RlbCBDb250YWN0TWVzc2FnZVxuICogXG4gKi9cbmV4cG9ydCB0eXBlIENvbnRhY3RNZXNzYWdlID0gUHJpc21hLkNvbnRhY3RNZXNzYWdlTW9kZWxcbi8qKlxuICogTW9kZWwgTm90aWZpY2F0aW9uXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgTm90aWZpY2F0aW9uID0gUHJpc21hLk5vdGlmaWNhdGlvbk1vZGVsXG4vKipcbiAqIE1vZGVsIFBheW1lbnRcbiAqIFxuICovXG5leHBvcnQgdHlwZSBQYXltZW50ID0gUHJpc21hLlBheW1lbnRNb2RlbFxuLyoqXG4gKiBNb2RlbCBSZXZpZXdcbiAqIFxuICovXG5leHBvcnQgdHlwZSBSZXZpZXcgPSBQcmlzbWEuUmV2aWV3TW9kZWxcbi8qKlxuICogTW9kZWwgVG91clBhY2thZ2VcbiAqIFxuICovXG5leHBvcnQgdHlwZSBUb3VyUGFja2FnZSA9IFByaXNtYS5Ub3VyUGFja2FnZU1vZGVsXG4vKipcbiAqIE1vZGVsIFVzZXJcbiAqIFxuICovXG5leHBvcnQgdHlwZSBVc2VyID0gUHJpc21hLlVzZXJNb2RlbFxuLyoqXG4gKiBNb2RlbCBXaXNobGlzdEl0ZW1cbiAqIFxuICovXG5leHBvcnQgdHlwZSBXaXNobGlzdEl0ZW0gPSBQcmlzbWEuV2lzaGxpc3RJdGVtTW9kZWxcbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiAqIFdBUk5JTkc6IFRoaXMgaXMgYW4gaW50ZXJuYWwgZmlsZSB0aGF0IGlzIHN1YmplY3QgdG8gY2hhbmdlIVxuICpcbiAqIFx1RDgzRFx1REVEMSBVbmRlciBubyBjaXJjdW1zdGFuY2VzIHNob3VsZCB5b3UgaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseSEgXHVEODNEXHVERUQxXG4gKlxuICogUGxlYXNlIGltcG9ydCB0aGUgYFByaXNtYUNsaWVudGAgY2xhc3MgZnJvbSB0aGUgYGNsaWVudC50c2AgZmlsZSBpbnN0ZWFkLlxuICovXG5cbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSBcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvY2xpZW50XCJcbmltcG9ydCB0eXBlICogYXMgUHJpc21hIGZyb20gXCIuL3ByaXNtYU5hbWVzcGFjZVwiXG5cblxuY29uc3QgY29uZmlnOiBydW50aW1lLkdldFByaXNtYUNsaWVudENvbmZpZyA9IHtcbiAgXCJwcmV2aWV3RmVhdHVyZXNcIjogW10sXG4gIFwiY2xpZW50VmVyc2lvblwiOiBcIjcuOS4xXCIsXG4gIFwiZW5naW5lVmVyc2lvblwiOiBcImU5MjIwODliN2Q3NTAyYWZmNDI0OWQ1ZGEzNDIwZjZmYTU1ZmM2YWRcIixcbiAgXCJhY3RpdmVQcm92aWRlclwiOiBcInBvc3RncmVzcWxcIixcbiAgXCJpbmxpbmVTY2hlbWFcIjogXCJtb2RlbCBCbG9nUG9zdCB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRpdGxlICAgICAgU3RyaW5nXFxuICBzbHVnICAgICAgIFN0cmluZyAgICAgQHVuaXF1ZVxcbiAgZXhjZXJwdCAgICBTdHJpbmdcXG4gIGNvbnRlbnQgICAgU3RyaW5nXFxuICBjb3ZlckltYWdlIFN0cmluZ1xcbiAgc3RhdHVzICAgICBQb3N0U3RhdHVzIEBkZWZhdWx0KERSQUZUKVxcbiAgaXNEZWxldGVkICBCb29sZWFuICAgIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgYXV0aG9ySWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgYXV0aG9yIFVzZXIgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIsIGZpZWxkczogW2F1dGhvcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQGluZGV4KFthdXRob3JJZF0pXFxuICBAQG1hcChcXFwiYmxvZ19wb3N0c1xcXCIpXFxufVxcblxcbm1vZGVsIEJvb2tpbmcge1xcbiAgaWQgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0cmF2ZWxEYXRlIERhdGVUaW1lXFxuICB0cmF2ZWxlcnMgIEludFxcbiAgdG90YWxQcmljZSBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKVxcbiAgc3RhdHVzICAgICBCb29raW5nU3RhdHVzIEBkZWZhdWx0KFBFTkRJTkcpXFxuXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgdXNlciAgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lckJvb2tpbmdzXFxcIiwgZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIHBhY2thZ2UgIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGF5bWVudHMgUGF5bWVudFtdXFxuXFxuICBAQGluZGV4KFt1c2VySWRdKVxcbiAgQEBpbmRleChbcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQGluZGV4KFt1c2VySWQsIHBhY2thZ2VJZCwgdHJhdmVsRGF0ZV0pXFxuICBAQG1hcChcXFwiYm9va2luZ3NcXFwiKVxcbn1cXG5cXG5tb2RlbCBDYXRlZ29yeSB7XFxuICBpZCAgIFN0cmluZyBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgbmFtZSBTdHJpbmcgQHVuaXF1ZVxcbiAgc2x1ZyBTdHJpbmcgQHVuaXF1ZVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBhY2thZ2VzIFRvdXJQYWNrYWdlW11cXG5cXG4gIEBAbWFwKFxcXCJjYXRlZ29yaWVzXFxcIilcXG59XFxuXFxubW9kZWwgQ29udGFjdE1lc3NhZ2Uge1xcbiAgaWQgICAgICAgICBTdHJpbmcgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lICAgICAgIFN0cmluZ1xcbiAgZW1haWwgICAgICBTdHJpbmdcXG4gIHN1YmplY3QgICAgU3RyaW5nXFxuICBtZXNzYWdlICAgIFN0cmluZ1xcbiAgaXNSZXNvbHZlZCBCb29sZWFuIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIEBAaW5kZXgoW2lzUmVzb2x2ZWRdKVxcbiAgQEBtYXAoXFxcImNvbnRhY3RfbWVzc2FnZXNcXFwiKVxcbn1cXG5cXG5lbnVtIFJvbGUge1xcbiAgVVNFUlxcbiAgQUdFTlRcXG4gIEFETUlOXFxufVxcblxcbmVudW0gVXNlclN0YXR1cyB7XFxuICBBQ1RJVkVcXG4gIFNVU1BFTkRFRFxcbn1cXG5cXG5lbnVtIEF1dGhQcm92aWRlciB7XFxuICBDUkVERU5USUFMXFxuICBHT09HTEVcXG59XFxuXFxuZW51bSBQYWNrYWdlU3RhdHVzIHtcXG4gIFBFTkRJTkdcXG4gIEFQUFJPVkVEXFxuICBSRUpFQ1RFRFxcbn1cXG5cXG5lbnVtIEJvb2tpbmdTdGF0dXMge1xcbiAgUEVORElOR1xcbiAgUEFJRFxcbiAgQ09ORklSTUVEXFxuICBDQU5DRUxMRURcXG4gIENPTVBMRVRFRFxcbn1cXG5cXG5lbnVtIFBheW1lbnRTdGF0dXMge1xcbiAgSU5JVElBVEVEXFxuICBTVUNDRVNTXFxuICBGQUlMRURcXG4gIENBTkNFTExFRFxcbiAgUkVGVU5ERURcXG59XFxuXFxuZW51bSBQb3N0U3RhdHVzIHtcXG4gIERSQUZUXFxuICBQVUJMSVNIRURcXG59XFxuXFxuZW51bSBOb3RpZmljYXRpb25UeXBlIHtcXG4gIEJPT0tJTkdfQ1JFQVRFRFxcbiAgQk9PS0lOR19DT05GSVJNRURcXG4gIEJPT0tJTkdfQ0FOQ0VMTEVEXFxuICBQQUNLQUdFX0FQUFJPVkVEXFxuICBQQUNLQUdFX1JFSkVDVEVEXFxufVxcblxcbm1vZGVsIE5vdGlmaWNhdGlvbiB7XFxuICBpZCAgICAgIFN0cmluZyAgICAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHVzZXJJZCAgU3RyaW5nXFxuICB0eXBlICAgIE5vdGlmaWNhdGlvblR5cGVcXG4gIHRpdGxlICAgU3RyaW5nXFxuICBtZXNzYWdlIFN0cmluZ1xcbiAgbGluayAgICBTdHJpbmc/XFxuICBpc1JlYWQgIEJvb2xlYW4gICAgICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuXFxuICB1c2VyIFVzZXIgQHJlbGF0aW9uKGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuXFxuICBAQGluZGV4KFt1c2VySWQsIGlzUmVhZCwgY3JlYXRlZEF0XSlcXG4gIEBAbWFwKFxcXCJub3RpZmljYXRpb25zXFxcIilcXG59XFxuXFxubW9kZWwgUGF5bWVudCB7XFxuICBpZCAgICAgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBib29raW5nSWQgICAgICBTdHJpbmdcXG4gIHRyYW5JZCAgICAgICAgIFN0cmluZyAgICAgICAgQHVuaXF1ZSAvLyBTU0xDb21tZXJ6IHRyYW5zYWN0aW9uIGlkLCBnZW5lcmF0ZWQgc2VydmVyLXNpZGVcXG4gIHZhbElkICAgICAgICAgIFN0cmluZz8gLy8gc2V0IGFmdGVyIGdhdGV3YXkgc3VjY2VzcywgdXNlZCBmb3Igc2VydmVyLXNpZGUgdmFsaWRhdGlvblxcbiAgYW1vdW50ICAgICAgICAgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMikgLy8gPSBib29raW5nLnRvdGFsUHJpY2UgYXQgc2Vzc2lvbiBjcmVhdGlvblxcbiAgY3VycmVuY3kgICAgICAgU3RyaW5nICAgICAgICBAZGVmYXVsdChcXFwiQkRUXFxcIilcXG4gIHN0YXR1cyAgICAgICAgIFBheW1lbnRTdGF0dXMgQGRlZmF1bHQoSU5JVElBVEVEKVxcbiAgZ2F0ZXdheVBhZ2VVcmwgU3RyaW5nP1xcbiAgc3NsU2Vzc2lvbktleSAgU3RyaW5nP1xcbiAgY2FyZFR5cGUgICAgICAgU3RyaW5nP1xcbiAgYmFua1RyYW5JZCAgICAgU3RyaW5nP1xcbiAgcGFpZEF0ICAgICAgICAgRGF0ZVRpbWU/XFxuICByZWZ1bmRSZWZJZCAgICBTdHJpbmc/IC8vIFNTTENvbW1lcnogcmVmdW5kIHJlZmVyZW5jZSAoc2V0IHdoZW4gYSByZWZ1bmQgaXMgaW5pdGlhdGVkKVxcbiAgcmVmdW5kZWRBdCAgICAgRGF0ZVRpbWU/IC8vIHdoZW4gdGhlIHJlZnVuZCB3YXMgaW5pdGlhdGVkL3NldHRsZWRcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBib29raW5nIEJvb2tpbmcgQHJlbGF0aW9uKGZpZWxkczogW2Jvb2tpbmdJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuXFxuICBAQGluZGV4KFtib29raW5nSWRdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAbWFwKFxcXCJwYXltZW50c1xcXCIpXFxufVxcblxcbm1vZGVsIFJldmlldyB7XFxuICBpZCAgICAgIFN0cmluZyBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgcmF0aW5nICBJbnRcXG4gIGNvbW1lbnQgU3RyaW5nXFxuXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgdXNlciAgICBVc2VyICAgICAgICBAcmVsYXRpb24oXFxcIkN1c3RvbWVyUmV2aWV3c1xcXCIsIGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYWNrYWdlIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcblxcbiAgQEB1bmlxdWUoW3VzZXJJZCwgcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3BhY2thZ2VJZF0pXFxuICBAQG1hcChcXFwicmV2aWV3c1xcXCIpXFxufVxcblxcbi8vIFRoaXMgaXMgeW91ciBQcmlzbWEgc2NoZW1hIGZpbGUsXFxuLy8gbGVhcm4gbW9yZSBhYm91dCBpdCBpbiB0aGUgZG9jczogaHR0cHM6Ly9wcmlzLmx5L2QvcHJpc21hLXNjaGVtYVxcblxcbmdlbmVyYXRvciBjbGllbnQge1xcbiAgcHJvdmlkZXIgPSBcXFwicHJpc21hLWNsaWVudFxcXCJcXG4gIG91dHB1dCAgID0gXFxcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWFcXFwiXFxufVxcblxcbmRhdGFzb3VyY2UgZGIge1xcbiAgcHJvdmlkZXIgPSBcXFwicG9zdGdyZXNxbFxcXCJcXG59XFxuXFxubW9kZWwgVG91clBhY2thZ2Uge1xcbiAgaWQgICAgICAgICAgU3RyaW5nICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdGl0bGUgICAgICAgU3RyaW5nXFxuICBzbHVnICAgICAgICBTdHJpbmcgICAgICAgIEB1bmlxdWVcXG4gIGRlc2NyaXB0aW9uIFN0cmluZ1xcbiAgbG9jYXRpb24gICAgU3RyaW5nXFxuICBwcmljZSAgICAgICBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKVxcbiAgZHVyYXRpb24gICAgSW50XFxuICByYXRpbmcgICAgICBGbG9hdCAgICAgICAgIEBkZWZhdWx0KDApXFxuICBpbWFnZXMgICAgICBTdHJpbmdbXVxcbiAgc3RhdHVzICAgICAgUGFja2FnZVN0YXR1cyBAZGVmYXVsdChQRU5ESU5HKVxcbiAgaXNEZWxldGVkICAgQm9vbGVhbiAgICAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGNhdGVnb3J5SWQgU3RyaW5nXFxuICBhZ2VudElkICAgIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGNhdGVnb3J5ICAgICAgQ2F0ZWdvcnkgICAgICAgQHJlbGF0aW9uKGZpZWxkczogW2NhdGVnb3J5SWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgYWdlbnQgICAgICAgICBVc2VyICAgICAgICAgICBAcmVsYXRpb24oXFxcIkFnZW50UGFja2FnZXNcXFwiLCBmaWVsZHM6IFthZ2VudElkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGJvb2tpbmdzICAgICAgQm9va2luZ1tdXFxuICByZXZpZXdzICAgICAgIFJldmlld1tdXFxuICB3aXNobGlzdEl0ZW1zIFdpc2hsaXN0SXRlbVtdXFxuXFxuICBAQGluZGV4KFtjYXRlZ29yeUlkXSlcXG4gIEBAaW5kZXgoW2NhdGVnb3J5SWQsIHByaWNlXSlcXG4gIEBAaW5kZXgoW3ByaWNlXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQG1hcChcXFwidG91cl9wYWNrYWdlc1xcXCIpXFxufVxcblxcbm1vZGVsIFVzZXIge1xcbiAgaWQgICAgICAgICAgICBTdHJpbmcgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIG5hbWUgICAgICAgICAgU3RyaW5nXFxuICBlbWFpbCAgICAgICAgIFN0cmluZyAgICAgICBAdW5pcXVlXFxuICBwYXNzd29yZCAgICAgIFN0cmluZz9cXG4gIGdvb2dsZUlkICAgICAgU3RyaW5nPyAgICAgIEB1bmlxdWVcXG4gIHBob25lICAgICAgICAgU3RyaW5nP1xcbiAgYXZhdGFyVXJsICAgICBTdHJpbmc/XFxuICByb2xlICAgICAgICAgIFJvbGUgICAgICAgICBAZGVmYXVsdChVU0VSKVxcbiAgc3RhdHVzICAgICAgICBVc2VyU3RhdHVzICAgQGRlZmF1bHQoQUNUSVZFKVxcbiAgYXV0aFByb3ZpZGVyICBBdXRoUHJvdmlkZXIgQGRlZmF1bHQoQ1JFREVOVElBTClcXG4gIGVtYWlsVmVyaWZpZWQgQm9vbGVhbiAgICAgIEBkZWZhdWx0KGZhbHNlKVxcbiAgaXNEZWxldGVkICAgICBCb29sZWFuICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuICB0b2tlblZlcnNpb24gIEludCAgICAgICAgICBAZGVmYXVsdCgwKVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBhY2thZ2VzICAgICAgVG91clBhY2thZ2VbXSAgQHJlbGF0aW9uKFxcXCJBZ2VudFBhY2thZ2VzXFxcIilcXG4gIGJvb2tpbmdzICAgICAgQm9va2luZ1tdICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lckJvb2tpbmdzXFxcIilcXG4gIHJldmlld3MgICAgICAgUmV2aWV3W10gICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lclJldmlld3NcXFwiKVxcbiAgcG9zdHMgICAgICAgICBCbG9nUG9zdFtdICAgICBAcmVsYXRpb24oXFxcIkF1dGhvclBvc3RzXFxcIilcXG4gIHdpc2hsaXN0ICAgICAgV2lzaGxpc3RJdGVtW11cXG4gIG5vdGlmaWNhdGlvbnMgTm90aWZpY2F0aW9uW11cXG5cXG4gIEBAaW5kZXgoW3JvbGVdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAbWFwKFxcXCJ1c2Vyc1xcXCIpXFxufVxcblxcbm1vZGVsIFdpc2hsaXN0SXRlbSB7XFxuICBpZCAgICAgICAgU3RyaW5nIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuXFxuICB1c2VyICAgIFVzZXIgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pXFxuICBAQGluZGV4KFt1c2VySWQsIGNyZWF0ZWRBdF0pXFxuICBAQG1hcChcXFwid2lzaGxpc3RfaXRlbXNcXFwiKVxcbn1cXG5cIixcbiAgXCJydW50aW1lRGF0YU1vZGVsXCI6IHtcbiAgICBcIm1vZGVsc1wiOiB7fSxcbiAgICBcImVudW1zXCI6IHt9LFxuICAgIFwidHlwZXNcIjoge31cbiAgfSxcbiAgXCJwYXJhbWV0ZXJpemF0aW9uU2NoZW1hXCI6IHtcbiAgICBcInN0cmluZ3NcIjogW10sXG4gICAgXCJncmFwaFwiOiBcIlwiXG4gIH1cbn1cblxuY29uZmlnLnJ1bnRpbWVEYXRhTW9kZWwgPSBKU09OLnBhcnNlKFwie1xcXCJtb2RlbHNcXFwiOntcXFwiQmxvZ1Bvc3RcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRpdGxlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzbHVnXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJleGNlcnB0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb250ZW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb3ZlckltYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQb3N0U3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aG9ySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aG9yXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQXV0aG9yUG9zdHNcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImJsb2dfcG9zdHNcXFwifSxcXFwiQm9va2luZ1xcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhdmVsRGF0ZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0cmF2ZWxlcnNcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRvdGFsUHJpY2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRlY2ltYWxcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyQm9va2luZ3NcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGF5bWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlBheW1lbnRcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9QYXltZW50XFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJib29raW5nc1xcXCJ9LFxcXCJDYXRlZ29yeVxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDYXRlZ29yeVRvVG91clBhY2thZ2VcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImNhdGVnb3JpZXNcXFwifSxcXFwiQ29udGFjdE1lc3NhZ2VcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdWJqZWN0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJtZXNzYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc1Jlc29sdmVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImNvbnRhY3RfbWVzc2FnZXNcXFwifSxcXFwiTm90aWZpY2F0aW9uXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInR5cGVcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJOb3RpZmljYXRpb25UeXBlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidGl0bGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm1lc3NhZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImxpbmtcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzUmVhZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiTm90aWZpY2F0aW9uVG9Vc2VyXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJub3RpZmljYXRpb25zXFxcIn0sXFxcIlBheW1lbnRcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhbklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ2YWxJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYW1vdW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEZWNpbWFsXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3VycmVuY3lcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN0YXR1c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlBheW1lbnRTdGF0dXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJnYXRld2F5UGFnZVVybFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3NsU2Vzc2lvbktleVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2FyZFR5cGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJhbmtUcmFuSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhaWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyZWZ1bmRSZWZJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmdW5kZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9QYXltZW50XFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJwYXltZW50c1xcXCJ9LFxcXCJSZXZpZXdcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJhdGluZ1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY29tbWVudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyUmV2aWV3c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmV2aWV3VG9Ub3VyUGFja2FnZVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwicmV2aWV3c1xcXCJ9LFxcXCJUb3VyUGFja2FnZVxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidGl0bGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNsdWdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImRlc2NyaXB0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJsb2NhdGlvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicHJpY2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRlY2ltYWxcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJkdXJhdGlvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmF0aW5nXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJGbG9hdFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImltYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUGFja2FnZVN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNhdGVnb3J5SWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImFnZW50SWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2F0ZWdvcnlcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkNhdGVnb3J5XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ2F0ZWdvcnlUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYWdlbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBZ2VudFBhY2thZ2VzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJldmlld3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlJldmlld1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlJldmlld1RvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ3aXNobGlzdEl0ZW1zXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJXaXNobGlzdEl0ZW1cXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJUb3VyUGFja2FnZVRvV2lzaGxpc3RJdGVtXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJ0b3VyX3BhY2thZ2VzXFxcIn0sXFxcIlVzZXJcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXNzd29yZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZ29vZ2xlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBob25lXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhdmF0YXJVcmxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJvbGVcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJSb2xlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhQcm92aWRlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIkF1dGhQcm92aWRlclxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsVmVyaWZpZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0b2tlblZlcnNpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQWdlbnRQYWNrYWdlc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJldmlld3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlJldmlld1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyUmV2aWV3c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBvc3RzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCbG9nUG9zdFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkF1dGhvclBvc3RzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwid2lzaGxpc3RcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIldpc2hsaXN0SXRlbVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlVzZXJUb1dpc2hsaXN0SXRlbVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5vdGlmaWNhdGlvbnNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIk5vdGlmaWNhdGlvblxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIk5vdGlmaWNhdGlvblRvVXNlclxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwidXNlcnNcXFwifSxcXFwiV2lzaGxpc3RJdGVtXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJVc2VyVG9XaXNobGlzdEl0ZW1cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlRvdXJQYWNrYWdlVG9XaXNobGlzdEl0ZW1cXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcIndpc2hsaXN0X2l0ZW1zXFxcIn19LFxcXCJlbnVtc1xcXCI6e30sXFxcInR5cGVzXFxcIjp7fX1cIilcbmNvbmZpZy5wYXJhbWV0ZXJpemF0aW9uU2NoZW1hID0ge1xuICBzdHJpbmdzOiBKU09OLnBhcnNlKFwiW1xcXCJ3aGVyZVxcXCIsXFxcIm9yZGVyQnlcXFwiLFxcXCJjdXJzb3JcXFwiLFxcXCJwYWNrYWdlc1xcXCIsXFxcIl9jb3VudFxcXCIsXFxcImNhdGVnb3J5XFxcIixcXFwiYWdlbnRcXFwiLFxcXCJ1c2VyXFxcIixcXFwicGFja2FnZVxcXCIsXFxcImJvb2tpbmdcXFwiLFxcXCJwYXltZW50c1xcXCIsXFxcImJvb2tpbmdzXFxcIixcXFwicmV2aWV3c1xcXCIsXFxcIndpc2hsaXN0SXRlbXNcXFwiLFxcXCJwb3N0c1xcXCIsXFxcIndpc2hsaXN0XFxcIixcXFwibm90aWZpY2F0aW9uc1xcXCIsXFxcImF1dGhvclxcXCIsXFxcIkJsb2dQb3N0LmZpbmRVbmlxdWVcXFwiLFxcXCJCbG9nUG9zdC5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIkJsb2dQb3N0LmZpbmRGaXJzdFxcXCIsXFxcIkJsb2dQb3N0LmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJCbG9nUG9zdC5maW5kTWFueVxcXCIsXFxcImRhdGFcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVPbmVcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVNYW55XFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU9uZVxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU1hbnlcXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiY3JlYXRlXFxcIixcXFwidXBkYXRlXFxcIixcXFwiQmxvZ1Bvc3QudXBzZXJ0T25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlT25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlTWFueVxcXCIsXFxcImhhdmluZ1xcXCIsXFxcIl9taW5cXFwiLFxcXCJfbWF4XFxcIixcXFwiQmxvZ1Bvc3QuZ3JvdXBCeVxcXCIsXFxcIkJsb2dQb3N0LmFnZ3JlZ2F0ZVxcXCIsXFxcIkJvb2tpbmcuZmluZFVuaXF1ZVxcXCIsXFxcIkJvb2tpbmcuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCb29raW5nLmZpbmRGaXJzdFxcXCIsXFxcIkJvb2tpbmcuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkJvb2tpbmcuZmluZE1hbnlcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU9uZVxcXCIsXFxcIkJvb2tpbmcuY3JlYXRlTWFueVxcXCIsXFxcIkJvb2tpbmcuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJvb2tpbmcudXBkYXRlT25lXFxcIixcXFwiQm9va2luZy51cGRhdGVNYW55XFxcIixcXFwiQm9va2luZy51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQm9va2luZy51cHNlcnRPbmVcXFwiLFxcXCJCb29raW5nLmRlbGV0ZU9uZVxcXCIsXFxcIkJvb2tpbmcuZGVsZXRlTWFueVxcXCIsXFxcIl9hdmdcXFwiLFxcXCJfc3VtXFxcIixcXFwiQm9va2luZy5ncm91cEJ5XFxcIixcXFwiQm9va2luZy5hZ2dyZWdhdGVcXFwiLFxcXCJDYXRlZ29yeS5maW5kVW5pcXVlXFxcIixcXFwiQ2F0ZWdvcnkuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJDYXRlZ29yeS5maW5kRmlyc3RcXFwiLFxcXCJDYXRlZ29yeS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQ2F0ZWdvcnkuZmluZE1hbnlcXFwiLFxcXCJDYXRlZ29yeS5jcmVhdGVPbmVcXFwiLFxcXCJDYXRlZ29yeS5jcmVhdGVNYW55XFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNhdGVnb3J5LnVwZGF0ZU9uZVxcXCIsXFxcIkNhdGVnb3J5LnVwZGF0ZU1hbnlcXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQ2F0ZWdvcnkudXBzZXJ0T25lXFxcIixcXFwiQ2F0ZWdvcnkuZGVsZXRlT25lXFxcIixcXFwiQ2F0ZWdvcnkuZGVsZXRlTWFueVxcXCIsXFxcIkNhdGVnb3J5Lmdyb3VwQnlcXFwiLFxcXCJDYXRlZ29yeS5hZ2dyZWdhdGVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kVW5pcXVlXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kRmlyc3RcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZE1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5jcmVhdGVPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5jcmVhdGVNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwZGF0ZU9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwZGF0ZU1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBzZXJ0T25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZGVsZXRlT25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZGVsZXRlTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmdyb3VwQnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5hZ2dyZWdhdGVcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZFVuaXF1ZVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIk5vdGlmaWNhdGlvbi5maW5kRmlyc3RcXFwiLFxcXCJOb3RpZmljYXRpb24uZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIk5vdGlmaWNhdGlvbi5maW5kTWFueVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5jcmVhdGVPbmVcXFwiLFxcXCJOb3RpZmljYXRpb24uY3JlYXRlTWFueVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiTm90aWZpY2F0aW9uLnVwZGF0ZU9uZVxcXCIsXFxcIk5vdGlmaWNhdGlvbi51cGRhdGVNYW55XFxcIixcXFwiTm90aWZpY2F0aW9uLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJOb3RpZmljYXRpb24udXBzZXJ0T25lXFxcIixcXFwiTm90aWZpY2F0aW9uLmRlbGV0ZU9uZVxcXCIsXFxcIk5vdGlmaWNhdGlvbi5kZWxldGVNYW55XFxcIixcXFwiTm90aWZpY2F0aW9uLmdyb3VwQnlcXFwiLFxcXCJOb3RpZmljYXRpb24uYWdncmVnYXRlXFxcIixcXFwiUGF5bWVudC5maW5kVW5pcXVlXFxcIixcXFwiUGF5bWVudC5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlBheW1lbnQuZmluZEZpcnN0XFxcIixcXFwiUGF5bWVudC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiUGF5bWVudC5maW5kTWFueVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlT25lXFxcIixcXFwiUGF5bWVudC5jcmVhdGVNYW55XFxcIixcXFwiUGF5bWVudC5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUGF5bWVudC51cGRhdGVPbmVcXFwiLFxcXCJQYXltZW50LnVwZGF0ZU1hbnlcXFwiLFxcXCJQYXltZW50LnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJQYXltZW50LnVwc2VydE9uZVxcXCIsXFxcIlBheW1lbnQuZGVsZXRlT25lXFxcIixcXFwiUGF5bWVudC5kZWxldGVNYW55XFxcIixcXFwiUGF5bWVudC5ncm91cEJ5XFxcIixcXFwiUGF5bWVudC5hZ2dyZWdhdGVcXFwiLFxcXCJSZXZpZXcuZmluZFVuaXF1ZVxcXCIsXFxcIlJldmlldy5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlJldmlldy5maW5kRmlyc3RcXFwiLFxcXCJSZXZpZXcuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlJldmlldy5maW5kTWFueVxcXCIsXFxcIlJldmlldy5jcmVhdGVPbmVcXFwiLFxcXCJSZXZpZXcuY3JlYXRlTWFueVxcXCIsXFxcIlJldmlldy5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUmV2aWV3LnVwZGF0ZU9uZVxcXCIsXFxcIlJldmlldy51cGRhdGVNYW55XFxcIixcXFwiUmV2aWV3LnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJSZXZpZXcudXBzZXJ0T25lXFxcIixcXFwiUmV2aWV3LmRlbGV0ZU9uZVxcXCIsXFxcIlJldmlldy5kZWxldGVNYW55XFxcIixcXFwiUmV2aWV3Lmdyb3VwQnlcXFwiLFxcXCJSZXZpZXcuYWdncmVnYXRlXFxcIixcXFwiVG91clBhY2thZ2UuZmluZFVuaXF1ZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiVG91clBhY2thZ2UuZmluZEZpcnN0XFxcIixcXFwiVG91clBhY2thZ2UuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlRvdXJQYWNrYWdlLmZpbmRNYW55XFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlT25lXFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVNYW55XFxcIixcXFwiVG91clBhY2thZ2UudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwc2VydE9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmRlbGV0ZU9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmRlbGV0ZU1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS5ncm91cEJ5XFxcIixcXFwiVG91clBhY2thZ2UuYWdncmVnYXRlXFxcIixcXFwiVXNlci5maW5kVW5pcXVlXFxcIixcXFwiVXNlci5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlVzZXIuZmluZEZpcnN0XFxcIixcXFwiVXNlci5maW5kRmlyc3RPclRocm93XFxcIixcXFwiVXNlci5maW5kTWFueVxcXCIsXFxcIlVzZXIuY3JlYXRlT25lXFxcIixcXFwiVXNlci5jcmVhdGVNYW55XFxcIixcXFwiVXNlci5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVXNlci51cGRhdGVPbmVcXFwiLFxcXCJVc2VyLnVwZGF0ZU1hbnlcXFwiLFxcXCJVc2VyLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJVc2VyLnVwc2VydE9uZVxcXCIsXFxcIlVzZXIuZGVsZXRlT25lXFxcIixcXFwiVXNlci5kZWxldGVNYW55XFxcIixcXFwiVXNlci5ncm91cEJ5XFxcIixcXFwiVXNlci5hZ2dyZWdhdGVcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZmluZFVuaXF1ZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kRmlyc3RcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kTWFueVxcXCIsXFxcIldpc2hsaXN0SXRlbS5jcmVhdGVPbmVcXFwiLFxcXCJXaXNobGlzdEl0ZW0uY3JlYXRlTWFueVxcXCIsXFxcIldpc2hsaXN0SXRlbS5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiV2lzaGxpc3RJdGVtLnVwZGF0ZU9uZVxcXCIsXFxcIldpc2hsaXN0SXRlbS51cGRhdGVNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJXaXNobGlzdEl0ZW0udXBzZXJ0T25lXFxcIixcXFwiV2lzaGxpc3RJdGVtLmRlbGV0ZU9uZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5kZWxldGVNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLmdyb3VwQnlcXFwiLFxcXCJXaXNobGlzdEl0ZW0uYWdncmVnYXRlXFxcIixcXFwiQU5EXFxcIixcXFwiT1JcXFwiLFxcXCJOT1RcXFwiLFxcXCJpZFxcXCIsXFxcInVzZXJJZFxcXCIsXFxcInBhY2thZ2VJZFxcXCIsXFxcImNyZWF0ZWRBdFxcXCIsXFxcImVxdWFsc1xcXCIsXFxcImluXFxcIixcXFwibm90SW5cXFwiLFxcXCJsdFxcXCIsXFxcImx0ZVxcXCIsXFxcImd0XFxcIixcXFwiZ3RlXFxcIixcXFwibm90XFxcIixcXFwiY29udGFpbnNcXFwiLFxcXCJzdGFydHNXaXRoXFxcIixcXFwiZW5kc1dpdGhcXFwiLFxcXCJuYW1lXFxcIixcXFwiZW1haWxcXFwiLFxcXCJwYXNzd29yZFxcXCIsXFxcImdvb2dsZUlkXFxcIixcXFwicGhvbmVcXFwiLFxcXCJhdmF0YXJVcmxcXFwiLFxcXCJSb2xlXFxcIixcXFwicm9sZVxcXCIsXFxcIlVzZXJTdGF0dXNcXFwiLFxcXCJzdGF0dXNcXFwiLFxcXCJBdXRoUHJvdmlkZXJcXFwiLFxcXCJhdXRoUHJvdmlkZXJcXFwiLFxcXCJlbWFpbFZlcmlmaWVkXFxcIixcXFwiaXNEZWxldGVkXFxcIixcXFwidG9rZW5WZXJzaW9uXFxcIixcXFwidXBkYXRlZEF0XFxcIixcXFwiZXZlcnlcXFwiLFxcXCJzb21lXFxcIixcXFwibm9uZVxcXCIsXFxcInRpdGxlXFxcIixcXFwic2x1Z1xcXCIsXFxcImRlc2NyaXB0aW9uXFxcIixcXFwibG9jYXRpb25cXFwiLFxcXCJwcmljZVxcXCIsXFxcImR1cmF0aW9uXFxcIixcXFwicmF0aW5nXFxcIixcXFwiaW1hZ2VzXFxcIixcXFwiUGFja2FnZVN0YXR1c1xcXCIsXFxcImNhdGVnb3J5SWRcXFwiLFxcXCJhZ2VudElkXFxcIixcXFwiaGFzXFxcIixcXFwiaGFzRXZlcnlcXFwiLFxcXCJoYXNTb21lXFxcIixcXFwiY29tbWVudFxcXCIsXFxcImJvb2tpbmdJZFxcXCIsXFxcInRyYW5JZFxcXCIsXFxcInZhbElkXFxcIixcXFwiYW1vdW50XFxcIixcXFwiY3VycmVuY3lcXFwiLFxcXCJQYXltZW50U3RhdHVzXFxcIixcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJzc2xTZXNzaW9uS2V5XFxcIixcXFwiY2FyZFR5cGVcXFwiLFxcXCJiYW5rVHJhbklkXFxcIixcXFwicGFpZEF0XFxcIixcXFwicmVmdW5kUmVmSWRcXFwiLFxcXCJyZWZ1bmRlZEF0XFxcIixcXFwiTm90aWZpY2F0aW9uVHlwZVxcXCIsXFxcInR5cGVcXFwiLFxcXCJtZXNzYWdlXFxcIixcXFwibGlua1xcXCIsXFxcImlzUmVhZFxcXCIsXFxcInN1YmplY3RcXFwiLFxcXCJpc1Jlc29sdmVkXFxcIixcXFwidHJhdmVsRGF0ZVxcXCIsXFxcInRyYXZlbGVyc1xcXCIsXFxcInRvdGFsUHJpY2VcXFwiLFxcXCJCb29raW5nU3RhdHVzXFxcIixcXFwiZXhjZXJwdFxcXCIsXFxcImNvbnRlbnRcXFwiLFxcXCJjb3ZlckltYWdlXFxcIixcXFwiUG9zdFN0YXR1c1xcXCIsXFxcImF1dGhvcklkXFxcIixcXFwidXNlcklkX3BhY2thZ2VJZFxcXCIsXFxcImlzXFxcIixcXFwiaXNOb3RcXFwiLFxcXCJjb25uZWN0T3JDcmVhdGVcXFwiLFxcXCJ1cHNlcnRcXFwiLFxcXCJjcmVhdGVNYW55XFxcIixcXFwic2V0XFxcIixcXFwiZGlzY29ubmVjdFxcXCIsXFxcImRlbGV0ZVxcXCIsXFxcImNvbm5lY3RcXFwiLFxcXCJ1cGRhdGVNYW55XFxcIixcXFwiZGVsZXRlTWFueVxcXCIsXFxcInB1c2hcXFwiLFxcXCJpbmNyZW1lbnRcXFwiLFxcXCJkZWNyZW1lbnRcXFwiLFxcXCJtdWx0aXBseVxcXCIsXFxcImRpdmlkZVxcXCJdXCIpLFxuICBncmFwaDogXCJud1Zmb0FFUEVRQUE0QUlBSUxvQkFBRGhBZ0F3dXdFQUFCOEFFTHdCQUFEaEFnQXd2UUVCQUFBQUFjQUJRQUMxQWdBaDFRRUFBT0lDaWdJaTJRRWdBTE1DQUNIYkFVQUF0UUlBSWQ4QkFRQ3VBZ0FoNEFFQkFBQUFBWVlDQVFDdUFnQWhod0lCQUs0Q0FDR0lBZ0VBcmdJQUlZb0NBUUN1QWdBaEFRQUFBQUVBSUJjRkFBRHpBZ0FnQmdBQTRBSUFJQXNBQUxjQ0FDQU1BQUM0QWdBZ0RRQUF1Z0lBSUxvQkFBRHdBZ0F3dXdFQUFBTUFFTHdCQUFEd0FnQXd2UUVCQUs0Q0FDSEFBVUFBdFFJQUlkVUJBQUR5QXVnQkl0a0JJQUN6QWdBaDJ3RkFBTFVDQUNIZkFRRUFyZ0lBSWVBQkFRQ3VBZ0FoNFFFQkFLNENBQ0hpQVFFQXJnSUFJZU1CRUFEcEFnQWg1QUVDQUxRQ0FDSGxBUWdBOFFJQUllWUJBQUNfQWdBZzZBRUJBSzRDQUNIcEFRRUFyZ0lBSVFVRkFBRGRCQUFnQmdBQTJRUUFJQXNBQUtFRUFDQU1BQUNpQkFBZ0RRQUFwQVFBSUJjRkFBRHpBZ0FnQmdBQTRBSUFJQXNBQUxjQ0FDQU1BQUM0QWdBZ0RRQUF1Z0lBSUxvQkFBRHdBZ0F3dXdFQUFBTUFFTHdCQUFEd0FnQXd2UUVCQUFBQUFjQUJRQUMxQWdBaDFRRUFBUElDNkFFaTJRRWdBTE1DQUNIYkFVQUF0UUlBSWQ4QkFRQ3VBZ0FoNEFFQkFBQUFBZUVCQVFDdUFnQWg0Z0VCQUs0Q0FDSGpBUkFBNlFJQUllUUJBZ0MwQWdBaDVRRUlBUEVDQUNIbUFRQUF2d0lBSU9nQkFRQ3VBZ0FoNlFFQkFLNENBQ0VEQUFBQUF3QWdBUUFBQkFBd0FnQUFCUUFnQXdBQUFBTUFJQUVBQUFRQU1BSUFBQVVBSUFFQUFBQURBQ0FQQndBQTRBSUFJQWdBQU9VQ0FDQUtBQUR2QWdBZ3VnRUFBTzBDQURDN0FRQUFDUUFRdkFFQUFPMENBREM5QVFFQXJnSUFJYjRCQVFDdUFnQWh2d0VCQUs0Q0FDSEFBVUFBdFFJQUlkVUJBQUR1QW9ZQ0l0c0JRQUMxQWdBaGdnSkFBTFVDQUNHREFnSUF0QUlBSVlRQ0VBRHBBZ0FoQXdjQUFOa0VBQ0FJQUFEYUJBQWdDZ0FBM0FRQUlBOEhBQURnQWdBZ0NBQUE1UUlBSUFvQUFPOENBQ0M2QVFBQTdRSUFNTHNCQUFBSkFCQzhBUUFBN1FJQU1MMEJBUUFBQUFHLUFRRUFyZ0lBSWI4QkFRQ3VBZ0Fod0FGQUFMVUNBQ0hWQVFBQTdnS0dBaUxiQVVBQXRRSUFJWUlDUUFDMUFnQWhnd0lDQUxRQ0FDR0VBaEFBNlFJQUlRTUFBQUFKQUNBQkFBQUtBREFDQUFBTEFDQVVDUUFBN0FJQUlMb0JBQURvQWdBd3V3RUFBQTBBRUx3QkFBRG9BZ0F3dlFFQkFLNENBQ0hBQVVBQXRRSUFJZFVCQUFEcUF2UUJJdHNCUUFDMUFnQWg3Z0VCQUs0Q0FDSHZBUUVBcmdJQUlmQUJBUUN2QWdBaDhRRVFBT2tDQUNIeUFRRUFyZ0lBSWZRQkFRQ3ZBZ0FoOVFFQkFLOENBQ0gyQVFFQXJ3SUFJZmNCQVFDdkFnQWgtQUZBQU9zQ0FDSDVBUUVBcndJQUlmb0JRQURyQWdBaENRa0FBTnNFQUNEd0FRQUFfUUlBSVBRQkFBRDlBZ0FnOVFFQUFQMENBQ0QyQVFBQV9RSUFJUGNCQUFEOUFnQWctQUVBQVAwQ0FDRDVBUUFBX1FJQUlQb0JBQUQ5QWdBZ0ZBa0FBT3dDQUNDNkFRQUE2QUlBTUxzQkFBQU5BQkM4QVFBQTZBSUFNTDBCQVFBQUFBSEFBVUFBdFFJQUlkVUJBQURxQXZRQkl0c0JRQUMxQWdBaDdnRUJBSzRDQUNIdkFRRUFBQUFCOEFFQkFLOENBQ0h4QVJBQTZRSUFJZklCQVFDdUFnQWg5QUVCQUs4Q0FDSDFBUUVBcndJQUlmWUJBUUN2QWdBaDl3RUJBSzhDQUNINEFVQUE2d0lBSWZrQkFRQ3ZBZ0FoLWdGQUFPc0NBQ0VEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQVFBQUFBMEFJQXdIQUFEZ0FnQWdDQUFBNVFJQUlMb0JBQURuQWdBd3V3RUFBQklBRUx3QkFBRG5BZ0F3dlFFQkFLNENBQ0ctQVFFQXJnSUFJYjhCQVFDdUFnQWh3QUZBQUxVQ0FDSGJBVUFBdFFJQUllVUJBZ0MwQWdBaDdRRUJBSzRDQUNFQ0J3QUEyUVFBSUFnQUFOb0VBQ0FOQndBQTRBSUFJQWdBQU9VQ0FDQzZBUUFBNXdJQU1Mc0JBQUFTQUJDOEFRQUE1d0lBTUwwQkFRQUFBQUctQVFFQXJnSUFJYjhCQVFDdUFnQWh3QUZBQUxVQ0FDSGJBVUFBdFFJQUllVUJBZ0MwQWdBaDdRRUJBSzRDQUNHTEFnQUE1Z0lBSUFNQUFBQVNBQ0FCQUFBVEFEQUNBQUFVQUNBSkJ3QUE0QUlBSUFnQUFPVUNBQ0M2QVFBQTVBSUFNTHNCQUFBV0FCQzhBUUFBNUFJQU1MMEJBUUN1QWdBaHZnRUJBSzRDQUNHX0FRRUFyZ0lBSWNBQlFBQzFBZ0FoQWdjQUFOa0VBQ0FJQUFEYUJBQWdDZ2NBQU9BQ0FDQUlBQURsQWdBZ3VnRUFBT1FDQURDN0FRQUFGZ0FRdkFFQUFPUUNBREM5QVFFQUFBQUJ2Z0VCQUs0Q0FDR19BUUVBcmdJQUljQUJRQUMxQWdBaGl3SUFBT01DQUNBREFBQUFGZ0FnQVFBQUZ3QXdBZ0FBR0FBZ0FRQUFBQWtBSUFFQUFBQVNBQ0FCQUFBQUZnQWdBd0FBQUFrQUlBRUFBQW9BTUFJQUFBc0FJQU1BQUFBU0FDQUJBQUFUQURBQ0FBQVVBQ0FQRVFBQTRBSUFJTG9CQUFEaEFnQXd1d0VBQUI4QUVMd0JBQURoQWdBd3ZRRUJBSzRDQUNIQUFVQUF0UUlBSWRVQkFBRGlBb29DSXRrQklBQ3pBZ0FoMndGQUFMVUNBQ0hmQVFFQXJnSUFJZUFCQVFDdUFnQWhoZ0lCQUs0Q0FDR0hBZ0VBcmdJQUlZZ0NBUUN1QWdBaGlnSUJBSzRDQUNFQkVRQUEyUVFBSUFNQUFBQWZBQ0FCQUFBZ0FEQUNBQUFCQUNBREFBQUFGZ0FnQVFBQUZ3QXdBZ0FBR0FBZ0RBY0FBT0FDQUNDNkFRQUEzZ0lBTUxzQkFBQWpBQkM4QVFBQTNnSUFNTDBCQVFDdUFnQWh2Z0VCQUs0Q0FDSEFBVUFBdFFJQUlkOEJBUUN1QWdBaF9BRUFBTjhDX0FFaV9RRUJBSzRDQUNILUFRRUFyd0lBSWY4QklBQ3pBZ0FoQWdjQUFOa0VBQ0QtQVFBQV9RSUFJQXdIQUFEZ0FnQWd1Z0VBQU40Q0FEQzdBUUFBSXdBUXZBRUFBTjRDQURDOUFRRUFBQUFCdmdFQkFLNENBQ0hBQVVBQXRRSUFJZDhCQVFDdUFnQWhfQUVBQU44Q19BRWlfUUVCQUs0Q0FDSC1BUUVBcndJQUlmOEJJQUN6QWdBaEF3QUFBQ01BSUFFQUFDUUFNQUlBQUNVQUlBRUFBQUFEQUNBQkFBQUFDUUFnQVFBQUFCSUFJQUVBQUFBZkFDQUJBQUFBRmdBZ0FRQUFBQ01BSUFFQUFBQUJBQ0FEQUFBQUh3QWdBUUFBSUFBd0FnQUFBUUFnQXdBQUFCOEFJQUVBQUNBQU1BSUFBQUVBSUFNQUFBQWZBQ0FCQUFBZ0FEQUNBQUFCQUNBTUVRQUEyQVFBSUwwQkFRQUFBQUhBQVVBQUFBQUIxUUVBQUFDS0FnTFpBU0FBQUFBQjJ3RkFBQUFBQWQ4QkFRQUFBQUhnQVFFQUFBQUJoZ0lCQUFBQUFZY0NBUUFBQUFHSUFnRUFBQUFCaWdJQkFBQUFBUUVYQUFBeEFDQUx2UUVCQUFBQUFjQUJRQUFBQUFIVkFRQUFBSW9DQXRrQklBQUFBQUhiQVVBQUFBQUIzd0VCQUFBQUFlQUJBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDQVFBQUFBR0tBZ0VBQUFBQkFSY0FBRE1BTUFFWEFBQXpBREFNRVFBQTF3UUFJTDBCQVFEM0FnQWh3QUZBQVBnQ0FDSFZBUUFBc2dPS0FpTFpBU0FBaHdNQUlkc0JRQUQ0QWdBaDN3RUJBUGNDQUNIZ0FRRUE5d0lBSVlZQ0FRRDNBZ0FoaHdJQkFQY0NBQ0dJQWdFQTl3SUFJWW9DQVFEM0FnQWhBZ0FBQUFFQUlCY0FBRFlBSUF1OUFRRUE5d0lBSWNBQlFBRDRBZ0FoMVFFQUFMSURpZ0lpMlFFZ0FJY0RBQ0hiQVVBQS1BSUFJZDhCQVFEM0FnQWg0QUVCQVBjQ0FDR0dBZ0VBOXdJQUlZY0NBUUQzQWdBaGlBSUJBUGNDQUNHS0FnRUE5d0lBSVFJQUFBQWZBQ0FYQUFBNEFDQUNBQUFBSHdBZ0Z3QUFPQUFnQXdBQUFBRUFJQjRBQURFQUlCOEFBRFlBSUFFQUFBQUJBQ0FCQUFBQUh3QWdBd1FBQU5RRUFDQWtBQURXQkFBZ0pRQUExUVFBSUE2NkFRQUEyZ0lBTUxzQkFBQV9BQkM4QVFBQTJnSUFNTDBCQVFDU0FnQWh3QUZBQUpNQ0FDSFZBUUFBMndLS0FpTFpBU0FBbmdJQUlkc0JRQUNUQWdBaDN3RUJBSklDQUNIZ0FRRUFrZ0lBSVlZQ0FRQ1NBZ0FoaHdJQkFKSUNBQ0dJQWdFQWtnSUFJWW9DQVFDU0FnQWhBd0FBQUI4QUlBRUFBRDRBTUNNQUFEOEFJQU1BQUFBZkFDQUJBQUFnQURBQ0FBQUJBQ0FCQUFBQUN3QWdBUUFBQUFzQUlBTUFBQUFKQUNBQkFBQUtBREFDQUFBTEFDQURBQUFBQ1FBZ0FRQUFDZ0F3QWdBQUN3QWdBd0FBQUFrQUlBRUFBQW9BTUFJQUFBc0FJQXdIQUFDVEJBQWdDQUFBNFFNQUlBb0FBT0lEQUNDOUFRRUFBQUFCdmdFQkFBQUFBYjhCQVFBQUFBSEFBVUFBQUFBQjFRRUFBQUNHQWdMYkFVQUFBQUFCZ2dKQUFBQUFBWU1DQWdBQUFBR0VBaEFBQUFBQkFSY0FBRWNBSUFtOUFRRUFBQUFCdmdFQkFBQUFBYjhCQVFBQUFBSEFBVUFBQUFBQjFRRUFBQUNHQWdMYkFVQUFBQUFCZ2dKQUFBQUFBWU1DQWdBQUFBR0VBaEFBQUFBQkFSY0FBRWtBTUFFWEFBQkpBREFNQndBQWtRUUFJQWdBQU5BREFDQUtBQURSQXdBZ3ZRRUJBUGNDQUNHLUFRRUE5d0lBSWI4QkFRRDNBZ0Fod0FGQUFQZ0NBQ0hWQVFBQXpnT0dBaUxiQVVBQS1BSUFJWUlDUUFENEFnQWhnd0lDQUlnREFDR0VBaEFBelFNQUlRSUFBQUFMQUNBWEFBQk1BQ0FKdlFFQkFQY0NBQ0ctQVFFQTl3SUFJYjhCQVFEM0FnQWh3QUZBQVBnQ0FDSFZBUUFBemdPR0FpTGJBVUFBLUFJQUlZSUNRQUQ0QWdBaGd3SUNBSWdEQUNHRUFoQUF6UU1BSVFJQUFBQUpBQ0FYQUFCT0FDQUNBQUFBQ1FBZ0Z3QUFUZ0FnQXdBQUFBc0FJQjRBQUVjQUlCOEFBRXdBSUFFQUFBQUxBQ0FCQUFBQUNRQWdCUVFBQU04RUFDQWtBQURTQkFBZ0pRQUEwUVFBSURZQUFOQUVBQ0EzQUFEVEJBQWdETG9CQUFEV0FnQXd1d0VBQUZVQUVMd0JBQURXQWdBd3ZRRUJBSklDQUNHLUFRRUFrZ0lBSWI4QkFRQ1NBZ0Fod0FGQUFKTUNBQ0hWQVFBQTF3S0dBaUxiQVVBQWt3SUFJWUlDUUFDVEFnQWhnd0lDQUo4Q0FDR0VBaEFBdlFJQUlRTUFBQUFKQUNBQkFBQlVBREFqQUFCVkFDQURBQUFBQ1FBZ0FRQUFDZ0F3QWdBQUN3QWdDUU1BQUxZQ0FDQzZBUUFBMVFJQU1Mc0JBQUJiQUJDOEFRQUExUUlBTUwwQkFRQUFBQUhBQVVBQXRRSUFJY3dCQVFBQUFBSGJBVUFBdFFJQUllQUJBUUFBQUFFQkFBQUFXQUFnQVFBQUFGZ0FJQWtEQUFDMkFnQWd1Z0VBQU5VQ0FEQzdBUUFBV3dBUXZBRUFBTlVDQURDOUFRRUFyZ0lBSWNBQlFBQzFBZ0FoekFFQkFLNENBQ0hiQVVBQXRRSUFJZUFCQVFDdUFnQWhBUU1BQUtBRUFDQURBQUFBV3dBZ0FRQUFYQUF3QWdBQVdBQWdBd0FBQUZzQUlBRUFBRndBTUFJQUFGZ0FJQU1BQUFCYkFDQUJBQUJjQURBQ0FBQllBQ0FHQXdBQXpnUUFJTDBCQVFBQUFBSEFBVUFBQUFBQnpBRUJBQUFBQWRzQlFBQUFBQUhnQVFFQUFBQUJBUmNBQUdBQUlBVzlBUUVBQUFBQndBRkFBQUFBQWN3QkFRQUFBQUhiQVVBQUFBQUI0QUVCQUFBQUFRRVhBQUJpQURBQkZ3QUFZZ0F3QmdNQUFNUUVBQ0M5QVFFQTl3SUFJY0FCUUFENEFnQWh6QUVCQVBjQ0FDSGJBVUFBLUFJQUllQUJBUUQzQWdBaEFnQUFBRmdBSUJjQUFHVUFJQVc5QVFFQTl3SUFJY0FCUUFENEFnQWh6QUVCQVBjQ0FDSGJBVUFBLUFJQUllQUJBUUQzQWdBaEFnQUFBRnNBSUJjQUFHY0FJQUlBQUFCYkFDQVhBQUJuQUNBREFBQUFXQUFnSGdBQVlBQWdId0FBWlFBZ0FRQUFBRmdBSUFFQUFBQmJBQ0FEQkFBQXdRUUFJQ1FBQU1NRUFDQWxBQURDQkFBZ0NMb0JBQURVQWdBd3V3RUFBRzRBRUx3QkFBRFVBZ0F3dlFFQkFKSUNBQ0hBQVVBQWt3SUFJY3dCQVFDU0FnQWgyd0ZBQUpNQ0FDSGdBUUVBa2dJQUlRTUFBQUJiQUNBQkFBQnRBREFqQUFCdUFDQURBQUFBV3dBZ0FRQUFYQUF3QWdBQVdBQWdDN29CQUFEVEFnQXd1d0VBQUhRQUVMd0JBQURUQWdBd3ZRRUJBQUFBQWNBQlFBQzFBZ0FoekFFQkFLNENBQ0hOQVFFQXJnSUFJZHNCUUFDMUFnQWhfUUVCQUs0Q0FDR0FBZ0VBcmdJQUlZRUNJQUN6QWdBaEFRQUFBSEVBSUFFQUFBQnhBQ0FMdWdFQUFOTUNBREM3QVFBQWRBQVF2QUVBQU5NQ0FEQzlBUUVBcmdJQUljQUJRQUMxQWdBaHpBRUJBSzRDQUNITkFRRUFyZ0lBSWRzQlFBQzFBZ0FoX1FFQkFLNENBQ0dBQWdFQXJnSUFJWUVDSUFDekFnQWhBQU1BQUFCMEFDQUJBQUIxQURBQ0FBQnhBQ0FEQUFBQWRBQWdBUUFBZFFBd0FnQUFjUUFnQXdBQUFIUUFJQUVBQUhVQU1BSUFBSEVBSUFpOUFRRUFBQUFCd0FGQUFBQUFBY3dCQVFBQUFBSE5BUUVBQUFBQjJ3RkFBQUFBQWYwQkFRQUFBQUdBQWdFQUFBQUJnUUlnQUFBQUFRRVhBQUI1QUNBSXZRRUJBQUFBQWNBQlFBQUFBQUhNQVFFQUFBQUJ6UUVCQUFBQUFkc0JRQUFBQUFIOUFRRUFBQUFCZ0FJQkFBQUFBWUVDSUFBQUFBRUJGd0FBZXdBd0FSY0FBSHNBTUFpOUFRRUE5d0lBSWNBQlFBRDRBZ0FoekFFQkFQY0NBQ0hOQVFFQTl3SUFJZHNCUUFENEFnQWhfUUVCQVBjQ0FDR0FBZ0VBOXdJQUlZRUNJQUNIQXdBaEFnQUFBSEVBSUJjQUFINEFJQWk5QVFFQTl3SUFJY0FCUUFENEFnQWh6QUVCQVBjQ0FDSE5BUUVBOXdJQUlkc0JRQUQ0QWdBaF9RRUJBUGNDQUNHQUFnRUE5d0lBSVlFQ0lBQ0hBd0FoQWdBQUFIUUFJQmNBQUlBQkFDQUNBQUFBZEFBZ0Z3QUFnQUVBSUFNQUFBQnhBQ0FlQUFCNUFDQWZBQUItQUNBQkFBQUFjUUFnQVFBQUFIUUFJQU1FQUFDLUJBQWdKQUFBd0FRQUlDVUFBTDhFQUNBTHVnRUFBTklDQURDN0FRQUFod0VBRUx3QkFBRFNBZ0F3dlFFQkFKSUNBQ0hBQVVBQWt3SUFJY3dCQVFDU0FnQWh6UUVCQUpJQ0FDSGJBVUFBa3dJQUlmMEJBUUNTQWdBaGdBSUJBSklDQUNHQkFpQUFuZ0lBSVFNQUFBQjBBQ0FCQUFDR0FRQXdJd0FBaHdFQUlBTUFBQUIwQUNBQkFBQjFBREFDQUFCeEFDQUJBQUFBSlFBZ0FRQUFBQ1VBSUFNQUFBQWpBQ0FCQUFBa0FEQUNBQUFsQUNBREFBQUFJd0FnQVFBQUpBQXdBZ0FBSlFBZ0F3QUFBQ01BSUFFQUFDUUFNQUlBQUNVQUlBa0hBQUM5QkFBZ3ZRRUJBQUFBQWI0QkFRQUFBQUhBQVVBQUFBQUIzd0VCQUFBQUFmd0JBQUFBX0FFQ19RRUJBQUFBQWY0QkFRQUFBQUhfQVNBQUFBQUJBUmNBQUk4QkFDQUl2UUVCQUFBQUFiNEJBUUFBQUFIQUFVQUFBQUFCM3dFQkFBQUFBZndCQUFBQV9BRUNfUUVCQUFBQUFmNEJBUUFBQUFIX0FTQUFBQUFCQVJjQUFKRUJBREFCRndBQWtRRUFNQWtIQUFDOEJBQWd2UUVCQVBjQ0FDRy1BUUVBOXdJQUljQUJRQUQ0QWdBaDN3RUJBUGNDQUNIOEFRQUFtUVA4QVNMOUFRRUE5d0lBSWY0QkFRQ0RBd0FoX3dFZ0FJY0RBQ0VDQUFBQUpRQWdGd0FBbEFFQUlBaTlBUUVBOXdJQUliNEJBUUQzQWdBaHdBRkFBUGdDQUNIZkFRRUE5d0lBSWZ3QkFBQ1pBX3dCSXYwQkFRRDNBZ0FoX2dFQkFJTURBQ0hfQVNBQWh3TUFJUUlBQUFBakFDQVhBQUNXQVFBZ0FnQUFBQ01BSUJjQUFKWUJBQ0FEQUFBQUpRQWdIZ0FBandFQUlCOEFBSlFCQUNBQkFBQUFKUUFnQVFBQUFDTUFJQVFFQUFDNUJBQWdKQUFBdXdRQUlDVUFBTG9FQUNELUFRQUFfUUlBSUF1NkFRQUF6Z0lBTUxzQkFBQ2RBUUFRdkFFQUFNNENBREM5QVFFQWtnSUFJYjRCQVFDU0FnQWh3QUZBQUpNQ0FDSGZBUUVBa2dJQUlmd0JBQURQQXZ3Qkl2MEJBUUNTQWdBaF9nRUJBSm9DQUNIX0FTQUFuZ0lBSVFNQUFBQWpBQ0FCQUFDY0FRQXdJd0FBblFFQUlBTUFBQUFqQUNBQkFBQWtBREFDQUFBbEFDQUJBQUFBRHdBZ0FRQUFBQThBSUFNQUFBQU5BQ0FCQUFBT0FEQUNBQUFQQUNBREFBQUFEUUFnQVFBQURnQXdBZ0FBRHdBZ0F3QUFBQTBBSUFFQUFBNEFNQUlBQUE4QUlCRUpBQUM0QkFBZ3ZRRUJBQUFBQWNBQlFBQUFBQUhWQVFBQUFQUUJBdHNCUUFBQUFBSHVBUUVBQUFBQjd3RUJBQUFBQWZBQkFRQUFBQUh4QVJBQUFBQUI4Z0VCQUFBQUFmUUJBUUFBQUFIMUFRRUFBQUFCOWdFQkFBQUFBZmNCQVFBQUFBSDRBVUFBQUFBQi1RRUJBQUFBQWZvQlFBQUFBQUVCRndBQXBRRUFJQkM5QVFFQUFBQUJ3QUZBQUFBQUFkVUJBQUFBOUFFQzJ3RkFBQUFBQWU0QkFRQUFBQUh2QVFFQUFBQUI4QUVCQUFBQUFmRUJFQUFBQUFIeUFRRUFBQUFCOUFFQkFBQUFBZlVCQVFBQUFBSDJBUUVBQUFBQjl3RUJBQUFBQWZnQlFBQUFBQUg1QVFFQUFBQUItZ0ZBQUFBQUFRRVhBQUNuQVFBd0FSY0FBS2NCQURBUkNRQUF0d1FBSUwwQkFRRDNBZ0Fod0FGQUFQZ0NBQ0hWQVFBQTNBUDBBU0xiQVVBQS1BSUFJZTRCQVFEM0FnQWg3d0VCQVBjQ0FDSHdBUUVBZ3dNQUlmRUJFQUROQXdBaDhnRUJBUGNDQUNIMEFRRUFnd01BSWZVQkFRQ0RBd0FoOWdFQkFJTURBQ0gzQVFFQWd3TUFJZmdCUUFEZEF3QWgtUUVCQUlNREFDSDZBVUFBM1FNQUlRSUFBQUFQQUNBWEFBQ3FBUUFnRUwwQkFRRDNBZ0Fod0FGQUFQZ0NBQ0hWQVFBQTNBUDBBU0xiQVVBQS1BSUFJZTRCQVFEM0FnQWg3d0VCQVBjQ0FDSHdBUUVBZ3dNQUlmRUJFQUROQXdBaDhnRUJBUGNDQUNIMEFRRUFnd01BSWZVQkFRQ0RBd0FoOWdFQkFJTURBQ0gzQVFFQWd3TUFJZmdCUUFEZEF3QWgtUUVCQUlNREFDSDZBVUFBM1FNQUlRSUFBQUFOQUNBWEFBQ3NBUUFnQWdBQUFBMEFJQmNBQUt3QkFDQURBQUFBRHdBZ0hnQUFwUUVBSUI4QUFLb0JBQ0FCQUFBQUR3QWdBUUFBQUEwQUlBMEVBQUN5QkFBZ0pBQUF0UVFBSUNVQUFMUUVBQ0EyQUFDekJBQWdOd0FBdGdRQUlQQUJBQUQ5QWdBZzlBRUFBUDBDQUNEMUFRQUFfUUlBSVBZQkFBRDlBZ0FnOXdFQUFQMENBQ0Q0QVFBQV9RSUFJUGtCQUFEOUFnQWctZ0VBQVAwQ0FDQVR1Z0VBQU1jQ0FEQzdBUUFBc3dFQUVMd0JBQURIQWdBd3ZRRUJBSklDQUNIQUFVQUFrd0lBSWRVQkFBRElBdlFCSXRzQlFBQ1RBZ0FoN2dFQkFKSUNBQ0h2QVFFQWtnSUFJZkFCQVFDYUFnQWg4UUVRQUwwQ0FDSHlBUUVBa2dJQUlmUUJBUUNhQWdBaDlRRUJBSm9DQUNIMkFRRUFtZ0lBSWZjQkFRQ2FBZ0FoLUFGQUFNa0NBQ0g1QVFFQW1nSUFJZm9CUUFESkFnQWhBd0FBQUEwQUlBRUFBTElCQURBakFBQ3pBUUFnQXdBQUFBMEFJQUVBQUE0QU1BSUFBQThBSUFFQUFBQVVBQ0FCQUFBQUZBQWdBd0FBQUJJQUlBRUFBQk1BTUFJQUFCUUFJQU1BQUFBU0FDQUJBQUFUQURBQ0FBQVVBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnQ1FjQUFJZ0VBQ0FJQUFEQ0F3QWd2UUVCQUFBQUFiNEJBUUFBQUFHX0FRRUFBQUFCd0FGQUFBQUFBZHNCUUFBQUFBSGxBUUlBQUFBQjdRRUJBQUFBQVFFWEFBQzdBUUFnQjcwQkFRQUFBQUctQVFFQUFBQUJ2d0VCQUFBQUFjQUJRQUFBQUFIYkFVQUFBQUFCNVFFQ0FBQUFBZTBCQVFBQUFBRUJGd0FBdlFFQU1BRVhBQUM5QVFBd0NRY0FBSVlFQUNBSUFBREFBd0FndlFFQkFQY0NBQ0ctQVFFQTl3SUFJYjhCQVFEM0FnQWh3QUZBQVBnQ0FDSGJBVUFBLUFJQUllVUJBZ0NJQXdBaDdRRUJBUGNDQUNFQ0FBQUFGQUFnRndBQXdBRUFJQWU5QVFFQTl3SUFJYjRCQVFEM0FnQWh2d0VCQVBjQ0FDSEFBVUFBLUFJQUlkc0JRQUQ0QWdBaDVRRUNBSWdEQUNIdEFRRUE5d0lBSVFJQUFBQVNBQ0FYQUFEQ0FRQWdBZ0FBQUJJQUlCY0FBTUlCQUNBREFBQUFGQUFnSGdBQXV3RUFJQjhBQU1BQkFDQUJBQUFBRkFBZ0FRQUFBQklBSUFVRUFBQ3RCQUFnSkFBQXNBUUFJQ1VBQUs4RUFDQTJBQUN1QkFBZ053QUFzUVFBSUFxNkFRQUF4Z0lBTUxzQkFBREpBUUFRdkFFQUFNWUNBREM5QVFFQWtnSUFJYjRCQVFDU0FnQWh2d0VCQUpJQ0FDSEFBVUFBa3dJQUlkc0JRQUNUQWdBaDVRRUNBSjhDQUNIdEFRRUFrZ0lBSVFNQUFBQVNBQ0FCQUFESUFRQXdJd0FBeVFFQUlBTUFBQUFTQUNBQkFBQVRBREFDQUFBVUFDQUJBQUFBQlFBZ0FRQUFBQVVBSUFNQUFBQURBQ0FCQUFBRUFEQUNBQUFGQUNBREFBQUFBd0FnQVFBQUJBQXdBZ0FBQlFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlCUUZBQUNXQkFBZ0JnQUFyQVFBSUFzQUFKY0VBQ0FNQUFDWUJBQWdEUUFBbVFRQUlMMEJBUUFBQUFIQUFVQUFBQUFCMVFFQUFBRG9BUUxaQVNBQUFBQUIyd0ZBQUFBQUFkOEJBUUFBQUFIZ0FRRUFBQUFCNFFFQkFBQUFBZUlCQVFBQUFBSGpBUkFBQUFBQjVBRUNBQUFBQWVVQkNBQUFBQUhtQVFBQWxRUUFJT2dCQVFBQUFBSHBBUUVBQUFBQkFSY0FBTkVCQUNBUHZRRUJBQUFBQWNBQlFBQUFBQUhWQVFBQUFPZ0JBdGtCSUFBQUFBSGJBVUFBQUFBQjN3RUJBQUFBQWVBQkFRQUFBQUhoQVFFQUFBQUI0Z0VCQUFBQUFlTUJFQUFBQUFIa0FRSUFBQUFCNVFFSUFBQUFBZVlCQUFDVkJBQWc2QUVCQUFBQUFla0JBUUFBQUFFQkZ3QUEwd0VBTUFFWEFBRFRBUUF3RkFVQUFQRURBQ0FHQUFDckJBQWdDd0FBOGdNQUlBd0FBUE1EQUNBTkFBRDBBd0FndlFFQkFQY0NBQ0hBQVVBQS1BSUFJZFVCQUFEdkEtZ0JJdGtCSUFDSEF3QWgyd0ZBQVBnQ0FDSGZBUUVBOXdJQUllQUJBUUQzQWdBaDRRRUJBUGNDQUNIaUFRRUE5d0lBSWVNQkVBRE5Bd0FoNUFFQ0FJZ0RBQ0hsQVFnQTdRTUFJZVlCQUFEdUF3QWc2QUVCQVBjQ0FDSHBBUUVBOXdJQUlRSUFBQUFGQUNBWEFBRFdBUUFnRDcwQkFRRDNBZ0Fod0FGQUFQZ0NBQ0hWQVFBQTd3UG9BU0xaQVNBQWh3TUFJZHNCUUFENEFnQWgzd0VCQVBjQ0FDSGdBUUVBOXdJQUllRUJBUUQzQWdBaDRnRUJBUGNDQUNIakFSQUF6UU1BSWVRQkFnQ0lBd0FoNVFFSUFPMERBQ0htQVFBQTdnTUFJT2dCQVFEM0FnQWg2UUVCQVBjQ0FDRUNBQUFBQXdBZ0Z3QUEyQUVBSUFJQUFBQURBQ0FYQUFEWUFRQWdBd0FBQUFVQUlCNEFBTkVCQUNBZkFBRFdBUUFnQVFBQUFBVUFJQUVBQUFBREFDQUZCQUFBcGdRQUlDUUFBS2tFQUNBbEFBQ29CQUFnTmdBQXB3UUFJRGNBQUtvRUFDQVN1Z0VBQUx3Q0FEQzdBUUFBM3dFQUVMd0JBQUM4QWdBd3ZRRUJBSklDQUNIQUFVQUFrd0lBSWRVQkFBREFBdWdCSXRrQklBQ2VBZ0FoMndGQUFKTUNBQ0hmQVFFQWtnSUFJZUFCQVFDU0FnQWg0UUVCQUpJQ0FDSGlBUUVBa2dJQUllTUJFQUM5QWdBaDVBRUNBSjhDQUNIbEFRZ0F2Z0lBSWVZQkFBQ19BZ0FnNkFFQkFKSUNBQ0hwQVFFQWtnSUFJUU1BQUFBREFDQUJBQURlQVFBd0l3QUEzd0VBSUFNQUFBQURBQ0FCQUFBRUFEQUNBQUFGQUNBWUF3QUF0Z0lBSUFzQUFMY0NBQ0FNQUFDNEFnQWdEZ0FBdVFJQUlBOEFBTG9DQUNBUUFBQzdBZ0FndWdFQUFLMENBREM3QVFBQTVRRUFFTHdCQUFDdEFnQXd2UUVCQUFBQUFjQUJRQUMxQWdBaHpBRUJBSzRDQUNITkFRRUFBQUFCemdFQkFLOENBQ0hQQVFFQUFBQUIwQUVCQUs4Q0FDSFJBUUVBcndJQUlkTUJBQUN3QXRNQkl0VUJBQUN4QXRVQkl0Y0JBQUN5QXRjQkl0Z0JJQUN6QWdBaDJRRWdBTE1DQUNIYUFRSUF0QUlBSWRzQlFBQzFBZ0FoQVFBQUFPSUJBQ0FCQUFBQTRnRUFJQmdEQUFDMkFnQWdDd0FBdHdJQUlBd0FBTGdDQUNBT0FBQzVBZ0FnRHdBQXVnSUFJQkFBQUxzQ0FDQzZBUUFBclFJQU1Mc0JBQURsQVFBUXZBRUFBSzBDQURDOUFRRUFyZ0lBSWNBQlFBQzFBZ0FoekFFQkFLNENBQ0hOQVFFQXJnSUFJYzRCQVFDdkFnQWh6d0VCQUs4Q0FDSFFBUUVBcndJQUlkRUJBUUN2QWdBaDB3RUFBTEFDMHdFaTFRRUFBTEVDMVFFaTF3RUFBTElDMXdFaTJBRWdBTE1DQUNIWkFTQUFzd0lBSWRvQkFnQzBBZ0FoMndGQUFMVUNBQ0VLQXdBQW9BUUFJQXNBQUtFRUFDQU1BQUNpQkFBZ0RnQUFvd1FBSUE4QUFLUUVBQ0FRQUFDbEJBQWd6Z0VBQVAwQ0FDRFBBUUFBX1FJQUlOQUJBQUQ5QWdBZzBRRUFBUDBDQUNBREFBQUE1UUVBSUFFQUFPWUJBREFDQUFEaUFRQWdBd0FBQU9VQkFDQUJBQURtQVFBd0FnQUE0Z0VBSUFNQUFBRGxBUUFnQVFBQTVnRUFNQUlBQU9JQkFDQVZBd0FBbWdRQUlBc0FBSnNFQUNBTUFBQ2NCQUFnRGdBQW5RUUFJQThBQUo0RUFDQVFBQUNmQkFBZ3ZRRUJBQUFBQWNBQlFBQUFBQUhNQVFFQUFBQUJ6UUVCQUFBQUFjNEJBUUFBQUFIUEFRRUFBQUFCMEFFQkFBQUFBZEVCQVFBQUFBSFRBUUFBQU5NQkF0VUJBQUFBMVFFQzF3RUFBQURYQVFMWUFTQUFBQUFCMlFFZ0FBQUFBZG9CQWdBQUFBSGJBVUFBQUFBQkFSY0FBT29CQUNBUHZRRUJBQUFBQWNBQlFBQUFBQUhNQVFFQUFBQUJ6UUVCQUFBQUFjNEJBUUFBQUFIUEFRRUFBQUFCMEFFQkFBQUFBZEVCQVFBQUFBSFRBUUFBQU5NQkF0VUJBQUFBMVFFQzF3RUFBQURYQVFMWUFTQUFBQUFCMlFFZ0FBQUFBZG9CQWdBQUFBSGJBVUFBQUFBQkFSY0FBT3dCQURBQkZ3QUE3QUVBTUJVREFBQ0pBd0FnQ3dBQWlnTUFJQXdBQUlzREFDQU9BQUNNQXdBZ0R3QUFqUU1BSUJBQUFJNERBQ0M5QVFFQTl3SUFJY0FCUUFENEFnQWh6QUVCQVBjQ0FDSE5BUUVBOXdJQUljNEJBUUNEQXdBaHp3RUJBSU1EQUNIUUFRRUFnd01BSWRFQkFRQ0RBd0FoMHdFQUFJUUQwd0VpMVFFQUFJVUQxUUVpMXdFQUFJWUQxd0VpMkFFZ0FJY0RBQ0haQVNBQWh3TUFJZG9CQWdDSUF3QWgyd0ZBQVBnQ0FDRUNBQUFBNGdFQUlCY0FBTzhCQUNBUHZRRUJBUGNDQUNIQUFVQUEtQUlBSWN3QkFRRDNBZ0FoelFFQkFQY0NBQ0hPQVFFQWd3TUFJYzhCQVFDREF3QWgwQUVCQUlNREFDSFJBUUVBZ3dNQUlkTUJBQUNFQTlNQkl0VUJBQUNGQTlVQkl0Y0JBQUNHQTljQkl0Z0JJQUNIQXdBaDJRRWdBSWNEQUNIYUFRSUFpQU1BSWRzQlFBRDRBZ0FoQWdBQUFPVUJBQ0FYQUFEeEFRQWdBZ0FBQU9VQkFDQVhBQUR4QVFBZ0F3QUFBT0lCQUNBZUFBRHFBUUFnSHdBQTd3RUFJQUVBQUFEaUFRQWdBUUFBQU9VQkFDQUpCQUFBX2dJQUlDUUFBSUVEQUNBbEFBQ0FBd0FnTmdBQV93SUFJRGNBQUlJREFDRE9BUUFBX1FJQUlNOEJBQUQ5QWdBZzBBRUFBUDBDQUNEUkFRQUFfUUlBSUJLNkFRQUFtUUlBTUxzQkFBRDRBUUFRdkFFQUFKa0NBREM5QVFFQWtnSUFJY0FCUUFDVEFnQWh6QUVCQUpJQ0FDSE5BUUVBa2dJQUljNEJBUUNhQWdBaHp3RUJBSm9DQUNIUUFRRUFtZ0lBSWRFQkFRQ2FBZ0FoMHdFQUFKc0Mwd0VpMVFFQUFKd0MxUUVpMXdFQUFKMEMxd0VpMkFFZ0FKNENBQ0haQVNBQW5nSUFJZG9CQWdDZkFnQWgyd0ZBQUpNQ0FDRURBQUFBNVFFQUlBRUFBUGNCQURBakFBRDRBUUFnQXdBQUFPVUJBQ0FCQUFEbUFRQXdBZ0FBNGdFQUlBRUFBQUFZQUNBQkFBQUFHQUFnQXdBQUFCWUFJQUVBQUJjQU1BSUFBQmdBSUFNQUFBQVdBQ0FCQUFBWEFEQUNBQUFZQUNBREFBQUFGZ0FnQVFBQUZ3QXdBZ0FBR0FBZ0JnY0FBUHNDQUNBSUFBRDhBZ0FndlFFQkFBQUFBYjRCQVFBQUFBR19BUUVBQUFBQndBRkFBQUFBQVFFWEFBQ0FBZ0FnQkwwQkFRQUFBQUctQVFFQUFBQUJ2d0VCQUFBQUFjQUJRQUFBQUFFQkZ3QUFnZ0lBTUFFWEFBQ0NBZ0F3QmdjQUFQa0NBQ0FJQUFENkFnQWd2UUVCQVBjQ0FDRy1BUUVBOXdJQUliOEJBUUQzQWdBaHdBRkFBUGdDQUNFQ0FBQUFHQUFnRndBQWhRSUFJQVM5QVFFQTl3SUFJYjRCQVFEM0FnQWh2d0VCQVBjQ0FDSEFBVUFBLUFJQUlRSUFBQUFXQUNBWEFBQ0hBZ0FnQWdBQUFCWUFJQmNBQUljQ0FDQURBQUFBR0FBZ0hnQUFnQUlBSUI4QUFJVUNBQ0FCQUFBQUdBQWdBUUFBQUJZQUlBTUVBQUQwQWdBZ0pBQUE5Z0lBSUNVQUFQVUNBQ0FIdWdFQUFKRUNBREM3QVFBQWpnSUFFTHdCQUFDUkFnQXd2UUVCQUpJQ0FDRy1BUUVBa2dJQUliOEJBUUNTQWdBaHdBRkFBSk1DQUNFREFBQUFGZ0FnQVFBQWpRSUFNQ01BQUk0Q0FDQURBQUFBRmdBZ0FRQUFGd0F3QWdBQUdBQWdCN29CQUFDUkFnQXd1d0VBQUk0Q0FCQzhBUUFBa1FJQU1MMEJBUUNTQWdBaHZnRUJBSklDQUNHX0FRRUFrZ0lBSWNBQlFBQ1RBZ0FoRGdRQUFKVUNBQ0FrQUFDWUFnQWdKUUFBbUFJQUlNRUJBUUFBQUFIQ0FRRUFBQUFFd3dFQkFBQUFCTVFCQVFBQUFBSEZBUUVBQUFBQnhnRUJBQUFBQWNjQkFRQUFBQUhJQVFFQWx3SUFJY2tCQVFBQUFBSEtBUUVBQUFBQnl3RUJBQUFBQVFzRUFBQ1ZBZ0FnSkFBQWxnSUFJQ1VBQUpZQ0FDREJBVUFBQUFBQndnRkFBQUFBQk1NQlFBQUFBQVRFQVVBQUFBQUJ4UUZBQUFBQUFjWUJRQUFBQUFISEFVQUFBQUFCeUFGQUFKUUNBQ0VMQkFBQWxRSUFJQ1FBQUpZQ0FDQWxBQUNXQWdBZ3dRRkFBQUFBQWNJQlFBQUFBQVREQVVBQUFBQUV4QUZBQUFBQUFjVUJRQUFBQUFIR0FVQUFBQUFCeHdGQUFBQUFBY2dCUUFDVUFnQWhDTUVCQWdBQUFBSENBUUlBQUFBRXd3RUNBQUFBQk1RQkFnQUFBQUhGQVFJQUFBQUJ4Z0VDQUFBQUFjY0JBZ0FBQUFISUFRSUFsUUlBSVFqQkFVQUFBQUFCd2dGQUFBQUFCTU1CUUFBQUFBVEVBVUFBQUFBQnhRRkFBQUFBQWNZQlFBQUFBQUhIQVVBQUFBQUJ5QUZBQUpZQ0FDRU9CQUFBbFFJQUlDUUFBSmdDQUNBbEFBQ1lBZ0Fnd1FFQkFBQUFBY0lCQVFBQUFBVERBUUVBQUFBRXhBRUJBQUFBQWNVQkFRQUFBQUhHQVFFQUFBQUJ4d0VCQUFBQUFjZ0JBUUNYQWdBaHlRRUJBQUFBQWNvQkFRQUFBQUhMQVFFQUFBQUJDOEVCQVFBQUFBSENBUUVBQUFBRXd3RUJBQUFBQk1RQkFRQUFBQUhGQVFFQUFBQUJ4Z0VCQUFBQUFjY0JBUUFBQUFISUFRRUFtQUlBSWNrQkFRQUFBQUhLQVFFQUFBQUJ5d0VCQUFBQUFSSzZBUUFBbVFJQU1Mc0JBQUQ0QVFBUXZBRUFBSmtDQURDOUFRRUFrZ0lBSWNBQlFBQ1RBZ0FoekFFQkFKSUNBQ0hOQVFFQWtnSUFJYzRCQVFDYUFnQWh6d0VCQUpvQ0FDSFFBUUVBbWdJQUlkRUJBUUNhQWdBaDB3RUFBSnNDMHdFaTFRRUFBSndDMVFFaTF3RUFBSjBDMXdFaTJBRWdBSjRDQUNIWkFTQUFuZ0lBSWRvQkFnQ2ZBZ0FoMndGQUFKTUNBQ0VPQkFBQXF3SUFJQ1FBQUt3Q0FDQWxBQUNzQWdBZ3dRRUJBQUFBQWNJQkFRQUFBQVhEQVFFQUFBQUZ4QUVCQUFBQUFjVUJBUUFBQUFIR0FRRUFBQUFCeHdFQkFBQUFBY2dCQVFDcUFnQWh5UUVCQUFBQUFjb0JBUUFBQUFITEFRRUFBQUFCQndRQUFKVUNBQ0FrQUFDcEFnQWdKUUFBcVFJQUlNRUJBQUFBMHdFQ3dnRUFBQURUQVFqREFRQUFBTk1CQ01nQkFBQ29BdE1CSWdjRUFBQ1ZBZ0FnSkFBQXB3SUFJQ1VBQUtjQ0FDREJBUUFBQU5VQkFzSUJBQUFBMVFFSXd3RUFBQURWQVFqSUFRQUFwZ0xWQVNJSEJBQUFsUUlBSUNRQUFLVUNBQ0FsQUFDbEFnQWd3UUVBQUFEWEFRTENBUUFBQU5jQkNNTUJBQUFBMXdFSXlBRUFBS1FDMXdFaUJRUUFBSlVDQUNBa0FBQ2pBZ0FnSlFBQW93SUFJTUVCSUFBQUFBSElBU0FBb2dJQUlRMEVBQUNWQWdBZ0pBQUFsUUlBSUNVQUFKVUNBQ0EyQUFDaEFnQWdOd0FBbFFJQUlNRUJBZ0FBQUFIQ0FRSUFBQUFFd3dFQ0FBQUFCTVFCQWdBQUFBSEZBUUlBQUFBQnhnRUNBQUFBQWNjQkFnQUFBQUhJQVFJQW9BSUFJUTBFQUFDVkFnQWdKQUFBbFFJQUlDVUFBSlVDQUNBMkFBQ2hBZ0FnTndBQWxRSUFJTUVCQWdBQUFBSENBUUlBQUFBRXd3RUNBQUFBQk1RQkFnQUFBQUhGQVFJQUFBQUJ4Z0VDQUFBQUFjY0JBZ0FBQUFISUFRSUFvQUlBSVFqQkFRZ0FBQUFCd2dFSUFBQUFCTU1CQ0FBQUFBVEVBUWdBQUFBQnhRRUlBQUFBQWNZQkNBQUFBQUhIQVFnQUFBQUJ5QUVJQUtFQ0FDRUZCQUFBbFFJQUlDUUFBS01DQUNBbEFBQ2pBZ0Fnd1FFZ0FBQUFBY2dCSUFDaUFnQWhBc0VCSUFBQUFBSElBU0FBb3dJQUlRY0VBQUNWQWdBZ0pBQUFwUUlBSUNVQUFLVUNBQ0RCQVFBQUFOY0JBc0lCQUFBQTF3RUl3d0VBQUFEWEFRaklBUUFBcEFMWEFTSUV3UUVBQUFEWEFRTENBUUFBQU5jQkNNTUJBQUFBMXdFSXlBRUFBS1VDMXdFaUJ3UUFBSlVDQUNBa0FBQ25BZ0FnSlFBQXB3SUFJTUVCQUFBQTFRRUN3Z0VBQUFEVkFRakRBUUFBQU5VQkNNZ0JBQUNtQXRVQklnVEJBUUFBQU5VQkFzSUJBQUFBMVFFSXd3RUFBQURWQVFqSUFRQUFwd0xWQVNJSEJBQUFsUUlBSUNRQUFLa0NBQ0FsQUFDcEFnQWd3UUVBQUFEVEFRTENBUUFBQU5NQkNNTUJBQUFBMHdFSXlBRUFBS2dDMHdFaUJNRUJBQUFBMHdFQ3dnRUFBQURUQVFqREFRQUFBTk1CQ01nQkFBQ3BBdE1CSWc0RUFBQ3JBZ0FnSkFBQXJBSUFJQ1VBQUt3Q0FDREJBUUVBQUFBQndnRUJBQUFBQmNNQkFRQUFBQVhFQVFFQUFBQUJ4UUVCQUFBQUFjWUJBUUFBQUFISEFRRUFBQUFCeUFFQkFLb0NBQ0hKQVFFQUFBQUJ5Z0VCQUFBQUFjc0JBUUFBQUFFSXdRRUNBQUFBQWNJQkFnQUFBQVhEQVFJQUFBQUZ4QUVDQUFBQUFjVUJBZ0FBQUFIR0FRSUFBQUFCeHdFQ0FBQUFBY2dCQWdDckFnQWhDOEVCQVFBQUFBSENBUUVBQUFBRnd3RUJBQUFBQmNRQkFRQUFBQUhGQVFFQUFBQUJ4Z0VCQUFBQUFjY0JBUUFBQUFISUFRRUFyQUlBSWNrQkFRQUFBQUhLQVFFQUFBQUJ5d0VCQUFBQUFSZ0RBQUMyQWdBZ0N3QUF0d0lBSUF3QUFMZ0NBQ0FPQUFDNUFnQWdEd0FBdWdJQUlCQUFBTHNDQUNDNkFRQUFyUUlBTUxzQkFBRGxBUUFRdkFFQUFLMENBREM5QVFFQXJnSUFJY0FCUUFDMUFnQWh6QUVCQUs0Q0FDSE5BUUVBcmdJQUljNEJBUUN2QWdBaHp3RUJBSzhDQUNIUUFRRUFyd0lBSWRFQkFRQ3ZBZ0FoMHdFQUFMQUMwd0VpMVFFQUFMRUMxUUVpMXdFQUFMSUMxd0VpMkFFZ0FMTUNBQ0haQVNBQXN3SUFJZG9CQWdDMEFnQWgyd0ZBQUxVQ0FDRUx3UUVCQUFBQUFjSUJBUUFBQUFUREFRRUFBQUFFeEFFQkFBQUFBY1VCQVFBQUFBSEdBUUVBQUFBQnh3RUJBQUFBQWNnQkFRQ1lBZ0FoeVFFQkFBQUFBY29CQVFBQUFBSExBUUVBQUFBQkM4RUJBUUFBQUFIQ0FRRUFBQUFGd3dFQkFBQUFCY1FCQVFBQUFBSEZBUUVBQUFBQnhnRUJBQUFBQWNjQkFRQUFBQUhJQVFFQXJBSUFJY2tCQVFBQUFBSEtBUUVBQUFBQnl3RUJBQUFBQVFUQkFRQUFBTk1CQXNJQkFBQUEwd0VJd3dFQUFBRFRBUWpJQVFBQXFRTFRBU0lFd1FFQUFBRFZBUUxDQVFBQUFOVUJDTU1CQUFBQTFRRUl5QUVBQUtjQzFRRWlCTUVCQUFBQTF3RUN3Z0VBQUFEWEFRakRBUUFBQU5jQkNNZ0JBQUNsQXRjQklnTEJBU0FBQUFBQnlBRWdBS01DQUNFSXdRRUNBQUFBQWNJQkFnQUFBQVREQVFJQUFBQUV4QUVDQUFBQUFjVUJBZ0FBQUFIR0FRSUFBQUFCeHdFQ0FBQUFBY2dCQWdDVkFnQWhDTUVCUUFBQUFBSENBVUFBQUFBRXd3RkFBQUFBQk1RQlFBQUFBQUhGQVVBQUFBQUJ4Z0ZBQUFBQUFjY0JRQUFBQUFISUFVQUFsZ0lBSVFQY0FRQUFBd0FnM1FFQUFBTUFJTjRCQUFBREFDQUQzQUVBQUFrQUlOMEJBQUFKQUNEZUFRQUFDUUFnQTl3QkFBQVNBQ0RkQVFBQUVnQWczZ0VBQUJJQUlBUGNBUUFBSHdBZzNRRUFBQjhBSU40QkFBQWZBQ0FEM0FFQUFCWUFJTjBCQUFBV0FDRGVBUUFBRmdBZ0E5d0JBQUFqQUNEZEFRQUFJd0FnM2dFQUFDTUFJQks2QVFBQXZBSUFNTHNCQUFEZkFRQVF2QUVBQUx3Q0FEQzlBUUVBa2dJQUljQUJRQUNUQWdBaDFRRUFBTUFDNkFFaTJRRWdBSjRDQUNIYkFVQUFrd0lBSWQ4QkFRQ1NBZ0FoNEFFQkFKSUNBQ0hoQVFFQWtnSUFJZUlCQVFDU0FnQWg0d0VRQUwwQ0FDSGtBUUlBbndJQUllVUJDQUMtQWdBaDVnRUFBTDhDQUNEb0FRRUFrZ0lBSWVrQkFRQ1NBZ0FoRFFRQUFKVUNBQ0FrQUFERkFnQWdKUUFBeFFJQUlEWUFBTVVDQUNBM0FBREZBZ0Fnd1FFUUFBQUFBY0lCRUFBQUFBVERBUkFBQUFBRXhBRVFBQUFBQWNVQkVBQUFBQUhHQVJBQUFBQUJ4d0VRQUFBQUFjZ0JFQURFQWdBaERRUUFBSlVDQUNBa0FBQ2hBZ0FnSlFBQW9RSUFJRFlBQUtFQ0FDQTNBQUNoQWdBZ3dRRUlBQUFBQWNJQkNBQUFBQVREQVFnQUFBQUV4QUVJQUFBQUFjVUJDQUFBQUFIR0FRZ0FBQUFCeHdFSUFBQUFBY2dCQ0FEREFnQWhCTUVCQVFBQUFBWHFBUUVBQUFBQjZ3RUJBQUFBQk93QkFRQUFBQVFIQkFBQWxRSUFJQ1FBQU1JQ0FDQWxBQURDQWdBZ3dRRUFBQURvQVFMQ0FRQUFBT2dCQ01NQkFBQUE2QUVJeUFFQUFNRUM2QUVpQndRQUFKVUNBQ0FrQUFEQ0FnQWdKUUFBd2dJQUlNRUJBQUFBNkFFQ3dnRUFBQURvQVFqREFRQUFBT2dCQ01nQkFBREJBdWdCSWdUQkFRQUFBT2dCQXNJQkFBQUE2QUVJd3dFQUFBRG9BUWpJQVFBQXdnTG9BU0lOQkFBQWxRSUFJQ1FBQUtFQ0FDQWxBQUNoQWdBZ05nQUFvUUlBSURjQUFLRUNBQ0RCQVFnQUFBQUJ3Z0VJQUFBQUJNTUJDQUFBQUFURUFRZ0FBQUFCeFFFSUFBQUFBY1lCQ0FBQUFBSEhBUWdBQUFBQnlBRUlBTU1DQUNFTkJBQUFsUUlBSUNRQUFNVUNBQ0FsQUFERkFnQWdOZ0FBeFFJQUlEY0FBTVVDQUNEQkFSQUFBQUFCd2dFUUFBQUFCTU1CRUFBQUFBVEVBUkFBQUFBQnhRRVFBQUFBQWNZQkVBQUFBQUhIQVJBQUFBQUJ5QUVRQU1RQ0FDRUl3UUVRQUFBQUFjSUJFQUFBQUFUREFSQUFBQUFFeEFFUUFBQUFBY1VCRUFBQUFBSEdBUkFBQUFBQnh3RVFBQUFBQWNnQkVBREZBZ0FoQ3JvQkFBREdBZ0F3dXdFQUFNa0JBQkM4QVFBQXhnSUFNTDBCQVFDU0FnQWh2Z0VCQUpJQ0FDR19BUUVBa2dJQUljQUJRQUNUQWdBaDJ3RkFBSk1DQUNIbEFRSUFud0lBSWUwQkFRQ1NBZ0FoRTdvQkFBREhBZ0F3dXdFQUFMTUJBQkM4QVFBQXh3SUFNTDBCQVFDU0FnQWh3QUZBQUpNQ0FDSFZBUUFBeUFMMEFTTGJBVUFBa3dJQUllNEJBUUNTQWdBaDd3RUJBSklDQUNId0FRRUFtZ0lBSWZFQkVBQzlBZ0FoOGdFQkFKSUNBQ0gwQVFFQW1nSUFJZlVCQVFDYUFnQWg5Z0VCQUpvQ0FDSDNBUUVBbWdJQUlmZ0JRQURKQWdBaC1RRUJBSm9DQUNINkFVQUF5UUlBSVFjRUFBQ1ZBZ0FnSkFBQXpRSUFJQ1VBQU0wQ0FDREJBUUFBQVBRQkFzSUJBQUFBOUFFSXd3RUFBQUQwQVFqSUFRQUF6QUwwQVNJTEJBQUFxd0lBSUNRQUFNc0NBQ0FsQUFETEFnQWd3UUZBQUFBQUFjSUJRQUFBQUFYREFVQUFBQUFGeEFGQUFBQUFBY1VCUUFBQUFBSEdBVUFBQUFBQnh3RkFBQUFBQWNnQlFBREtBZ0FoQ3dRQUFLc0NBQ0FrQUFETEFnQWdKUUFBeXdJQUlNRUJRQUFBQUFIQ0FVQUFBQUFGd3dGQUFBQUFCY1FCUUFBQUFBSEZBVUFBQUFBQnhnRkFBQUFBQWNjQlFBQUFBQUhJQVVBQXlnSUFJUWpCQVVBQUFBQUJ3Z0ZBQUFBQUJjTUJRQUFBQUFYRUFVQUFBQUFCeFFGQUFBQUFBY1lCUUFBQUFBSEhBVUFBQUFBQnlBRkFBTXNDQUNFSEJBQUFsUUlBSUNRQUFNMENBQ0FsQUFETkFnQWd3UUVBQUFEMEFRTENBUUFBQVBRQkNNTUJBQUFBOUFFSXlBRUFBTXdDOUFFaUJNRUJBQUFBOUFFQ3dnRUFBQUQwQVFqREFRQUFBUFFCQ01nQkFBRE5BdlFCSWd1NkFRQUF6Z0lBTUxzQkFBQ2RBUUFRdkFFQUFNNENBREM5QVFFQWtnSUFJYjRCQVFDU0FnQWh3QUZBQUpNQ0FDSGZBUUVBa2dJQUlmd0JBQURQQXZ3Qkl2MEJBUUNTQWdBaF9nRUJBSm9DQUNIX0FTQUFuZ0lBSVFjRUFBQ1ZBZ0FnSkFBQTBRSUFJQ1VBQU5FQ0FDREJBUUFBQVB3QkFzSUJBQUFBX0FFSXd3RUFBQUQ4QVFqSUFRQUEwQUw4QVNJSEJBQUFsUUlBSUNRQUFORUNBQ0FsQUFEUkFnQWd3UUVBQUFEOEFRTENBUUFBQVB3QkNNTUJBQUFBX0FFSXlBRUFBTkFDX0FFaUJNRUJBQUFBX0FFQ3dnRUFBQUQ4QVFqREFRQUFBUHdCQ01nQkFBRFJBdndCSWd1NkFRQUEwZ0lBTUxzQkFBQ0hBUUFRdkFFQUFOSUNBREM5QVFFQWtnSUFJY0FCUUFDVEFnQWh6QUVCQUpJQ0FDSE5BUUVBa2dJQUlkc0JRQUNUQWdBaF9RRUJBSklDQUNHQUFnRUFrZ0lBSVlFQ0lBQ2VBZ0FoQzdvQkFBRFRBZ0F3dXdFQUFIUUFFTHdCQUFEVEFnQXd2UUVCQUs0Q0FDSEFBVUFBdFFJQUljd0JBUUN1QWdBaHpRRUJBSzRDQUNIYkFVQUF0UUlBSWYwQkFRQ3VBZ0FoZ0FJQkFLNENBQ0dCQWlBQXN3SUFJUWk2QVFBQTFBSUFNTHNCQUFCdUFCQzhBUUFBMUFJQU1MMEJBUUNTQWdBaHdBRkFBSk1DQUNITUFRRUFrZ0lBSWRzQlFBQ1RBZ0FoNEFFQkFKSUNBQ0VKQXdBQXRnSUFJTG9CQUFEVkFnQXd1d0VBQUZzQUVMd0JBQURWQWdBd3ZRRUJBSzRDQUNIQUFVQUF0UUlBSWN3QkFRQ3VBZ0FoMndGQUFMVUNBQ0hnQVFFQXJnSUFJUXk2QVFBQTFnSUFNTHNCQUFCVkFCQzhBUUFBMWdJQU1MMEJBUUNTQWdBaHZnRUJBSklDQUNHX0FRRUFrZ0lBSWNBQlFBQ1RBZ0FoMVFFQUFOY0NoZ0lpMndGQUFKTUNBQ0dDQWtBQWt3SUFJWU1DQWdDZkFnQWhoQUlRQUwwQ0FDRUhCQUFBbFFJQUlDUUFBTmtDQUNBbEFBRFpBZ0Fnd1FFQUFBQ0dBZ0xDQVFBQUFJWUNDTU1CQUFBQWhnSUl5QUVBQU5nQ2hnSWlCd1FBQUpVQ0FDQWtBQURaQWdBZ0pRQUEyUUlBSU1FQkFBQUFoZ0lDd2dFQUFBQ0dBZ2pEQVFBQUFJWUNDTWdCQUFEWUFvWUNJZ1RCQVFBQUFJWUNBc0lCQUFBQWhnSUl3d0VBQUFDR0FnaklBUUFBMlFLR0FpSU91Z0VBQU5vQ0FEQzdBUUFBUHdBUXZBRUFBTm9DQURDOUFRRUFrZ0lBSWNBQlFBQ1RBZ0FoMVFFQUFOc0NpZ0lpMlFFZ0FKNENBQ0hiQVVBQWt3SUFJZDhCQVFDU0FnQWg0QUVCQUpJQ0FDR0dBZ0VBa2dJQUlZY0NBUUNTQWdBaGlBSUJBSklDQUNHS0FnRUFrZ0lBSVFjRUFBQ1ZBZ0FnSkFBQTNRSUFJQ1VBQU4wQ0FDREJBUUFBQUlvQ0FzSUJBQUFBaWdJSXd3RUFBQUNLQWdqSUFRQUEzQUtLQWlJSEJBQUFsUUlBSUNRQUFOMENBQ0FsQUFEZEFnQWd3UUVBQUFDS0FnTENBUUFBQUlvQ0NNTUJBQUFBaWdJSXlBRUFBTndDaWdJaUJNRUJBQUFBaWdJQ3dnRUFBQUNLQWdqREFRQUFBSW9DQ01nQkFBRGRBb29DSWd3SEFBRGdBZ0FndWdFQUFONENBREM3QVFBQUl3QVF2QUVBQU40Q0FEQzlBUUVBcmdJQUliNEJBUUN1QWdBaHdBRkFBTFVDQUNIZkFRRUFyZ0lBSWZ3QkFBRGZBdndCSXYwQkFRQ3VBZ0FoX2dFQkFLOENBQ0hfQVNBQXN3SUFJUVRCQVFBQUFQd0JBc0lCQUFBQV9BRUl3d0VBQUFEOEFRaklBUUFBMFFMOEFTSWFBd0FBdGdJQUlBc0FBTGNDQUNBTUFBQzRBZ0FnRGdBQXVRSUFJQThBQUxvQ0FDQVFBQUM3QWdBZ3VnRUFBSzBDQURDN0FRQUE1UUVBRUx3QkFBQ3RBZ0F3dlFFQkFLNENBQ0hBQVVBQXRRSUFJY3dCQVFDdUFnQWh6UUVCQUs0Q0FDSE9BUUVBcndJQUljOEJBUUN2QWdBaDBBRUJBSzhDQUNIUkFRRUFyd0lBSWRNQkFBQ3dBdE1CSXRVQkFBQ3hBdFVCSXRjQkFBQ3lBdGNCSXRnQklBQ3pBZ0FoMlFFZ0FMTUNBQ0hhQVFJQXRBSUFJZHNCUUFDMUFnQWhqQUlBQU9VQkFDQ05BZ0FBNVFFQUlBOFJBQURnQWdBZ3VnRUFBT0VDQURDN0FRQUFId0FRdkFFQUFPRUNBREM5QVFFQXJnSUFJY0FCUUFDMUFnQWgxUUVBQU9JQ2lnSWkyUUVnQUxNQ0FDSGJBVUFBdFFJQUlkOEJBUUN1QWdBaDRBRUJBSzRDQUNHR0FnRUFyZ0lBSVljQ0FRQ3VBZ0FoaUFJQkFLNENBQ0dLQWdFQXJnSUFJUVRCQVFBQUFJb0NBc0lCQUFBQWlnSUl3d0VBQUFDS0FnaklBUUFBM1FLS0FpSUN2Z0VCQUFBQUFiOEJBUUFBQUFFSkJ3QUE0QUlBSUFnQUFPVUNBQ0M2QVFBQTVBSUFNTHNCQUFBV0FCQzhBUUFBNUFJQU1MMEJBUUN1QWdBaHZnRUJBSzRDQUNHX0FRRUFyZ0lBSWNBQlFBQzFBZ0FoR1FVQUFQTUNBQ0FHQUFEZ0FnQWdDd0FBdHdJQUlBd0FBTGdDQUNBTkFBQzZBZ0FndWdFQUFQQUNBREM3QVFBQUF3QVF2QUVBQVBBQ0FEQzlBUUVBcmdJQUljQUJRQUMxQWdBaDFRRUFBUElDNkFFaTJRRWdBTE1DQUNIYkFVQUF0UUlBSWQ4QkFRQ3VBZ0FoNEFFQkFLNENBQ0hoQVFFQXJnSUFJZUlCQVFDdUFnQWg0d0VRQU9rQ0FDSGtBUUlBdEFJQUllVUJDQUR4QWdBaDVnRUFBTDhDQUNEb0FRRUFyZ0lBSWVrQkFRQ3VBZ0FoakFJQUFBTUFJSTBDQUFBREFDQUN2Z0VCQUFBQUFiOEJBUUFBQUFFTUJ3QUE0QUlBSUFnQUFPVUNBQ0M2QVFBQTV3SUFNTHNCQUFBU0FCQzhBUUFBNXdJQU1MMEJBUUN1QWdBaHZnRUJBSzRDQUNHX0FRRUFyZ0lBSWNBQlFBQzFBZ0FoMndGQUFMVUNBQ0hsQVFJQXRBSUFJZTBCQVFDdUFnQWhGQWtBQU93Q0FDQzZBUUFBNkFJQU1Mc0JBQUFOQUJDOEFRQUE2QUlBTUwwQkFRQ3VBZ0Fod0FGQUFMVUNBQ0hWQVFBQTZnTDBBU0xiQVVBQXRRSUFJZTRCQVFDdUFnQWg3d0VCQUs0Q0FDSHdBUUVBcndJQUlmRUJFQURwQWdBaDhnRUJBSzRDQUNIMEFRRUFyd0lBSWZVQkFRQ3ZBZ0FoOWdFQkFLOENBQ0gzQVFFQXJ3SUFJZmdCUUFEckFnQWgtUUVCQUs4Q0FDSDZBVUFBNndJQUlRakJBUkFBQUFBQndnRVFBQUFBQk1NQkVBQUFBQVRFQVJBQUFBQUJ4UUVRQUFBQUFjWUJFQUFBQUFISEFSQUFBQUFCeUFFUUFNVUNBQ0VFd1FFQUFBRDBBUUxDQVFBQUFQUUJDTU1CQUFBQTlBRUl5QUVBQU0wQzlBRWlDTUVCUUFBQUFBSENBVUFBQUFBRnd3RkFBQUFBQmNRQlFBQUFBQUhGQVVBQUFBQUJ4Z0ZBQUFBQUFjY0JRQUFBQUFISUFVQUF5d0lBSVJFSEFBRGdBZ0FnQ0FBQTVRSUFJQW9BQU84Q0FDQzZBUUFBN1FJQU1Mc0JBQUFKQUJDOEFRQUE3UUlBTUwwQkFRQ3VBZ0FodmdFQkFLNENBQ0dfQVFFQXJnSUFJY0FCUUFDMUFnQWgxUUVBQU80Q2hnSWkyd0ZBQUxVQ0FDR0NBa0FBdFFJQUlZTUNBZ0MwQWdBaGhBSVFBT2tDQUNHTUFnQUFDUUFnalFJQUFBa0FJQThIQUFEZ0FnQWdDQUFBNVFJQUlBb0FBTzhDQUNDNkFRQUE3UUlBTUxzQkFBQUpBQkM4QVFBQTdRSUFNTDBCQVFDdUFnQWh2Z0VCQUs0Q0FDR19BUUVBcmdJQUljQUJRQUMxQWdBaDFRRUFBTzRDaGdJaTJ3RkFBTFVDQUNHQ0FrQUF0UUlBSVlNQ0FnQzBBZ0FoaEFJUUFPa0NBQ0VFd1FFQUFBQ0dBZ0xDQVFBQUFJWUNDTU1CQUFBQWhnSUl5QUVBQU5rQ2hnSWlBOXdCQUFBTkFDRGRBUUFBRFFBZzNnRUFBQTBBSUJjRkFBRHpBZ0FnQmdBQTRBSUFJQXNBQUxjQ0FDQU1BQUM0QWdBZ0RRQUF1Z0lBSUxvQkFBRHdBZ0F3dXdFQUFBTUFFTHdCQUFEd0FnQXd2UUVCQUs0Q0FDSEFBVUFBdFFJQUlkVUJBQUR5QXVnQkl0a0JJQUN6QWdBaDJ3RkFBTFVDQUNIZkFRRUFyZ0lBSWVBQkFRQ3VBZ0FoNFFFQkFLNENBQ0hpQVFFQXJnSUFJZU1CRUFEcEFnQWg1QUVDQUxRQ0FDSGxBUWdBOFFJQUllWUJBQUNfQWdBZzZBRUJBSzRDQUNIcEFRRUFyZ0lBSVFqQkFRZ0FBQUFCd2dFSUFBQUFCTU1CQ0FBQUFBVEVBUWdBQUFBQnhRRUlBQUFBQWNZQkNBQUFBQUhIQVFnQUFBQUJ5QUVJQUtFQ0FDRUV3UUVBQUFEb0FRTENBUUFBQU9nQkNNTUJBQUFBNkFFSXlBRUFBTUlDNkFFaUN3TUFBTFlDQUNDNkFRQUExUUlBTUxzQkFBQmJBQkM4QVFBQTFRSUFNTDBCQVFDdUFnQWh3QUZBQUxVQ0FDSE1BUUVBcmdJQUlkc0JRQUMxQWdBaDRBRUJBSzRDQUNHTUFnQUFXd0FnalFJQUFGc0FJQUFBQUFHUkFnRUFBQUFCQVpFQ1FBQUFBQUVGSGdBQW1BVUFJQjhBQUo0RkFDQ09BZ0FBbVFVQUlJOENBQUNkQlFBZ2xBSUFBT0lCQUNBRkhnQUFsZ1VBSUI4QUFKc0ZBQ0NPQWdBQWx3VUFJSThDQUFDYUJRQWdsQUlBQUFVQUlBTWVBQUNZQlFBZ2pnSUFBSmtGQUNDVUFnQUE0Z0VBSUFNZUFBQ1dCUUFnamdJQUFKY0ZBQ0NVQWdBQUJRQWdBQUFBQUFBQUFaRUNBUUFBQUFFQmtRSUFBQURUQVFJQmtRSUFBQURWQVFJQmtRSUFBQURYQVFJQmtRSWdBQUFBQVFXUkFnSUFBQUFCbUFJQ0FBQUFBWmtDQWdBQUFBR2FBZ0lBQUFBQm13SUNBQUFBQVFzZUFBRGpBd0F3SHdBQTZBTUFNSTRDQUFEa0F3QXdqd0lBQU9VREFEQ1FBZ0FBNWdNQUlKRUNBQURuQXdBd2tnSUFBT2NEQURDVEFnQUE1d01BTUpRQ0FBRG5Bd0F3bFFJQUFPa0RBRENXQWdBQTZnTUFNQXNlQUFEREF3QXdId0FBeUFNQU1JNENBQURFQXdBd2p3SUFBTVVEQURDUUFnQUF4Z01BSUpFQ0FBREhBd0F3a2dJQUFNY0RBRENUQWdBQXh3TUFNSlFDQUFESEF3QXdsUUlBQU1rREFEQ1dBZ0FBeWdNQU1Bc2VBQUMxQXdBd0h3QUF1Z01BTUk0Q0FBQzJBd0F3andJQUFMY0RBRENRQWdBQXVBTUFJSkVDQUFDNUF3QXdrZ0lBQUxrREFEQ1RBZ0FBdVFNQU1KUUNBQUM1QXdBd2xRSUFBTHNEQURDV0FnQUF2QU1BTUFzZUFBQ29Bd0F3SHdBQXJRTUFNSTRDQUFDcEF3QXdqd0lBQUtvREFEQ1FBZ0FBcXdNQUlKRUNBQUNzQXdBd2tnSUFBS3dEQURDVEFnQUFyQU1BTUpRQ0FBQ3NBd0F3bFFJQUFLNERBRENXQWdBQXJ3TUFNQXNlQUFDY0F3QXdId0FBb1FNQU1JNENBQUNkQXdBd2p3SUFBSjREQURDUUFnQUFud01BSUpFQ0FBQ2dBd0F3a2dJQUFLQURBRENUQWdBQW9BTUFNSlFDQUFDZ0F3QXdsUUlBQUtJREFEQ1dBZ0FBb3dNQU1Bc2VBQUNQQXdBd0h3QUFsQU1BTUk0Q0FBQ1FBd0F3andJQUFKRURBRENRQWdBQWtnTUFJSkVDQUFDVEF3QXdrZ0lBQUpNREFEQ1RBZ0FBa3dNQU1KUUNBQUNUQXdBd2xRSUFBSlVEQURDV0FnQUFsZ01BTUFlOUFRRUFBQUFCd0FGQUFBQUFBZDhCQVFBQUFBSDhBUUFBQVB3QkF2MEJBUUFBQUFILUFRRUFBQUFCX3dFZ0FBQUFBUUlBQUFBbEFDQWVBQUNiQXdBZ0F3QUFBQ1VBSUI0QUFKc0RBQ0FmQUFDYUF3QWdBUmNBQUpVRkFEQU1Cd0FBNEFJQUlMb0JBQURlQWdBd3V3RUFBQ01BRUx3QkFBRGVBZ0F3dlFFQkFBQUFBYjRCQVFDdUFnQWh3QUZBQUxVQ0FDSGZBUUVBcmdJQUlmd0JBQURmQXZ3Qkl2MEJBUUN1QWdBaF9nRUJBSzhDQUNIX0FTQUFzd0lBSVFJQUFBQWxBQ0FYQUFDYUF3QWdBZ0FBQUpjREFDQVhBQUNZQXdBZ0M3b0JBQUNXQXdBd3V3RUFBSmNEQUJDOEFRQUFsZ01BTUwwQkFRQ3VBZ0FodmdFQkFLNENBQ0hBQVVBQXRRSUFJZDhCQVFDdUFnQWhfQUVBQU44Q19BRWlfUUVCQUs0Q0FDSC1BUUVBcndJQUlmOEJJQUN6QWdBaEM3b0JBQUNXQXdBd3V3RUFBSmNEQUJDOEFRQUFsZ01BTUwwQkFRQ3VBZ0FodmdFQkFLNENBQ0hBQVVBQXRRSUFJZDhCQVFDdUFnQWhfQUVBQU44Q19BRWlfUUVCQUs0Q0FDSC1BUUVBcndJQUlmOEJJQUN6QWdBaEI3MEJBUUQzQWdBaHdBRkFBUGdDQUNIZkFRRUE5d0lBSWZ3QkFBQ1pBX3dCSXYwQkFRRDNBZ0FoX2dFQkFJTURBQ0hfQVNBQWh3TUFJUUdSQWdBQUFQd0JBZ2U5QVFFQTl3SUFJY0FCUUFENEFnQWgzd0VCQVBjQ0FDSDhBUUFBbVFQOEFTTDlBUUVBOXdJQUlmNEJBUUNEQXdBaF93RWdBSWNEQUNFSHZRRUJBQUFBQWNBQlFBQUFBQUhmQVFFQUFBQUJfQUVBQUFEOEFRTDlBUUVBQUFBQl9nRUJBQUFBQWY4QklBQUFBQUVFQ0FBQV9BSUFJTDBCQVFBQUFBR19BUUVBQUFBQndBRkFBQUFBQVFJQUFBQVlBQ0FlQUFDbkF3QWdBd0FBQUJnQUlCNEFBS2NEQUNBZkFBQ21Bd0FnQVJjQUFKUUZBREFLQndBQTRBSUFJQWdBQU9VQ0FDQzZBUUFBNUFJQU1Mc0JBQUFXQUJDOEFRQUE1QUlBTUwwQkFRQUFBQUctQVFFQXJnSUFJYjhCQVFDdUFnQWh3QUZBQUxVQ0FDR0xBZ0FBNHdJQUlBSUFBQUFZQUNBWEFBQ21Bd0FnQWdBQUFLUURBQ0FYQUFDbEF3QWdCN29CQUFDakF3QXd1d0VBQUtRREFCQzhBUUFBb3dNQU1MMEJBUUN1QWdBaHZnRUJBSzRDQUNHX0FRRUFyZ0lBSWNBQlFBQzFBZ0FoQjdvQkFBQ2pBd0F3dXdFQUFLUURBQkM4QVFBQW93TUFNTDBCQVFDdUFnQWh2Z0VCQUs0Q0FDR19BUUVBcmdJQUljQUJRQUMxQWdBaEE3MEJBUUQzQWdBaHZ3RUJBUGNDQUNIQUFVQUEtQUlBSVFRSUFBRDZBZ0FndlFFQkFQY0NBQ0dfQVFFQTl3SUFJY0FCUUFENEFnQWhCQWdBQVB3Q0FDQzlBUUVBQUFBQnZ3RUJBQUFBQWNBQlFBQUFBQUVLdlFFQkFBQUFBY0FCUUFBQUFBSFZBUUFBQUlvQ0F0a0JJQUFBQUFIYkFVQUFBQUFCM3dFQkFBQUFBZUFCQVFBQUFBR0dBZ0VBQUFBQmh3SUJBQUFBQVlnQ0FRQUFBQUVDQUFBQUFRQWdIZ0FBdEFNQUlBTUFBQUFCQUNBZUFBQzBBd0FnSHdBQXN3TUFJQUVYQUFDVEJRQXdEeEVBQU9BQ0FDQzZBUUFBNFFJQU1Mc0JBQUFmQUJDOEFRQUE0UUlBTUwwQkFRQUFBQUhBQVVBQXRRSUFJZFVCQUFEaUFvb0NJdGtCSUFDekFnQWgyd0ZBQUxVQ0FDSGZBUUVBcmdJQUllQUJBUUFBQUFHR0FnRUFyZ0lBSVljQ0FRQ3VBZ0FoaUFJQkFLNENBQ0dLQWdFQXJnSUFJUUlBQUFBQkFDQVhBQUN6QXdBZ0FnQUFBTEFEQUNBWEFBQ3hBd0FnRHJvQkFBQ3ZBd0F3dXdFQUFMQURBQkM4QVFBQXJ3TUFNTDBCQVFDdUFnQWh3QUZBQUxVQ0FDSFZBUUFBNGdLS0FpTFpBU0FBc3dJQUlkc0JRQUMxQWdBaDN3RUJBSzRDQUNIZ0FRRUFyZ0lBSVlZQ0FRQ3VBZ0FoaHdJQkFLNENBQ0dJQWdFQXJnSUFJWW9DQVFDdUFnQWhEcm9CQUFDdkF3QXd1d0VBQUxBREFCQzhBUUFBcndNQU1MMEJBUUN1QWdBaHdBRkFBTFVDQUNIVkFRQUE0Z0tLQWlMWkFTQUFzd0lBSWRzQlFBQzFBZ0FoM3dFQkFLNENBQ0hnQVFFQXJnSUFJWVlDQVFDdUFnQWhod0lCQUs0Q0FDR0lBZ0VBcmdJQUlZb0NBUUN1QWdBaENyMEJBUUQzQWdBaHdBRkFBUGdDQUNIVkFRQUFzZ09LQWlMWkFTQUFod01BSWRzQlFBRDRBZ0FoM3dFQkFQY0NBQ0hnQVFFQTl3SUFJWVlDQVFEM0FnQWhod0lCQVBjQ0FDR0lBZ0VBOXdJQUlRR1JBZ0FBQUlvQ0FncTlBUUVBOXdJQUljQUJRQUQ0QWdBaDFRRUFBTElEaWdJaTJRRWdBSWNEQUNIYkFVQUEtQUlBSWQ4QkFRRDNBZ0FoNEFFQkFQY0NBQ0dHQWdFQTl3SUFJWWNDQVFEM0FnQWhpQUlCQVBjQ0FDRUt2UUVCQUFBQUFjQUJRQUFBQUFIVkFRQUFBSW9DQXRrQklBQUFBQUhiQVVBQUFBQUIzd0VCQUFBQUFlQUJBUUFBQUFHR0FnRUFBQUFCaHdJQkFBQUFBWWdDQVFBQUFBRUhDQUFBd2dNQUlMMEJBUUFBQUFHX0FRRUFBQUFCd0FGQUFBQUFBZHNCUUFBQUFBSGxBUUlBQUFBQjdRRUJBQUFBQVFJQUFBQVVBQ0FlQUFEQkF3QWdBd0FBQUJRQUlCNEFBTUVEQUNBZkFBQ19Bd0FnQVJjQUFKSUZBREFOQndBQTRBSUFJQWdBQU9VQ0FDQzZBUUFBNXdJQU1Mc0JBQUFTQUJDOEFRQUE1d0lBTUwwQkFRQUFBQUctQVFFQXJnSUFJYjhCQVFDdUFnQWh3QUZBQUxVQ0FDSGJBVUFBdFFJQUllVUJBZ0MwQWdBaDdRRUJBSzRDQUNHTEFnQUE1Z0lBSUFJQUFBQVVBQ0FYQUFDX0F3QWdBZ0FBQUwwREFDQVhBQUMtQXdBZ0Nyb0JBQUM4QXdBd3V3RUFBTDBEQUJDOEFRQUF2QU1BTUwwQkFRQ3VBZ0FodmdFQkFLNENBQ0dfQVFFQXJnSUFJY0FCUUFDMUFnQWgyd0ZBQUxVQ0FDSGxBUUlBdEFJQUllMEJBUUN1QWdBaENyb0JBQUM4QXdBd3V3RUFBTDBEQUJDOEFRQUF2QU1BTUwwQkFRQ3VBZ0FodmdFQkFLNENBQ0dfQVFFQXJnSUFJY0FCUUFDMUFnQWgyd0ZBQUxVQ0FDSGxBUUlBdEFJQUllMEJBUUN1QWdBaEJyMEJBUUQzQWdBaHZ3RUJBUGNDQUNIQUFVQUEtQUlBSWRzQlFBRDRBZ0FoNVFFQ0FJZ0RBQ0h0QVFFQTl3SUFJUWNJQUFEQUF3QWd2UUVCQVBjQ0FDR19BUUVBOXdJQUljQUJRQUQ0QWdBaDJ3RkFBUGdDQUNIbEFRSUFpQU1BSWUwQkFRRDNBZ0FoQlI0QUFJMEZBQ0FmQUFDUUJRQWdqZ0lBQUk0RkFDQ1BBZ0FBandVQUlKUUNBQUFGQUNBSENBQUF3Z01BSUwwQkFRQUFBQUdfQVFFQUFBQUJ3QUZBQUFBQUFkc0JRQUFBQUFIbEFRSUFBQUFCN1FFQkFBQUFBUU1lQUFDTkJRQWdqZ0lBQUk0RkFDQ1VBZ0FBQlFBZ0NnZ0FBT0VEQUNBS0FBRGlBd0FndlFFQkFBQUFBYjhCQVFBQUFBSEFBVUFBQUFBQjFRRUFBQUNHQWdMYkFVQUFBQUFCZ2dKQUFBQUFBWU1DQWdBQUFBR0VBaEFBQUFBQkFnQUFBQXNBSUI0QUFPQURBQ0FEQUFBQUN3QWdIZ0FBNEFNQUlCOEFBTThEQUNBQkZ3QUFqQVVBTUE4SEFBRGdBZ0FnQ0FBQTVRSUFJQW9BQU84Q0FDQzZBUUFBN1FJQU1Mc0JBQUFKQUJDOEFRQUE3UUlBTUwwQkFRQUFBQUctQVFFQXJnSUFJYjhCQVFDdUFnQWh3QUZBQUxVQ0FDSFZBUUFBN2dLR0FpTGJBVUFBdFFJQUlZSUNRQUMxQWdBaGd3SUNBTFFDQUNHRUFoQUE2UUlBSVFJQUFBQUxBQ0FYQUFEUEF3QWdBZ0FBQU1zREFDQVhBQURNQXdBZ0RMb0JBQURLQXdBd3V3RUFBTXNEQUJDOEFRQUF5Z01BTUwwQkFRQ3VBZ0FodmdFQkFLNENBQ0dfQVFFQXJnSUFJY0FCUUFDMUFnQWgxUUVBQU80Q2hnSWkyd0ZBQUxVQ0FDR0NBa0FBdFFJQUlZTUNBZ0MwQWdBaGhBSVFBT2tDQUNFTXVnRUFBTW9EQURDN0FRQUF5d01BRUx3QkFBREtBd0F3dlFFQkFLNENBQ0ctQVFFQXJnSUFJYjhCQVFDdUFnQWh3QUZBQUxVQ0FDSFZBUUFBN2dLR0FpTGJBVUFBdFFJQUlZSUNRQUMxQWdBaGd3SUNBTFFDQUNHRUFoQUE2UUlBSVFpOUFRRUE5d0lBSWI4QkFRRDNBZ0Fod0FGQUFQZ0NBQ0hWQVFBQXpnT0dBaUxiQVVBQS1BSUFJWUlDUUFENEFnQWhnd0lDQUlnREFDR0VBaEFBelFNQUlRV1JBaEFBQUFBQm1BSVFBQUFBQVprQ0VBQUFBQUdhQWhBQUFBQUJtd0lRQUFBQUFRR1JBZ0FBQUlZQ0Fnb0lBQURRQXdBZ0NnQUEwUU1BSUwwQkFRRDNBZ0FodndFQkFQY0NBQ0hBQVVBQS1BSUFJZFVCQUFET0E0WUNJdHNCUUFENEFnQWhnZ0pBQVBnQ0FDR0RBZ0lBaUFNQUlZUUNFQUROQXdBaEJSNEFBSVlGQUNBZkFBQ0tCUUFnamdJQUFJY0ZBQ0NQQWdBQWlRVUFJSlFDQUFBRkFDQUxIZ0FBMGdNQU1COEFBTmNEQURDT0FnQUEwd01BTUk4Q0FBRFVBd0F3a0FJQUFOVURBQ0NSQWdBQTFnTUFNSklDQUFEV0F3QXdrd0lBQU5ZREFEQ1VBZ0FBMWdNQU1KVUNBQURZQXdBd2xnSUFBTmtEQURBUHZRRUJBQUFBQWNBQlFBQUFBQUhWQVFBQUFQUUJBdHNCUUFBQUFBSHZBUUVBQUFBQjhBRUJBQUFBQWZFQkVBQUFBQUh5QVFFQUFBQUI5QUVCQUFBQUFmVUJBUUFBQUFIMkFRRUFBQUFCOXdFQkFBQUFBZmdCUUFBQUFBSDVBUUVBQUFBQi1nRkFBQUFBQVFJQUFBQVBBQ0FlQUFEZkF3QWdBd0FBQUE4QUlCNEFBTjhEQUNBZkFBRGVBd0FnQVJjQUFJZ0ZBREFVQ1FBQTdBSUFJTG9CQUFEb0FnQXd1d0VBQUEwQUVMd0JBQURvQWdBd3ZRRUJBQUFBQWNBQlFBQzFBZ0FoMVFFQUFPb0M5QUVpMndGQUFMVUNBQ0h1QVFFQXJnSUFJZThCQVFBQUFBSHdBUUVBcndJQUlmRUJFQURwQWdBaDhnRUJBSzRDQUNIMEFRRUFyd0lBSWZVQkFRQ3ZBZ0FoOWdFQkFLOENBQ0gzQVFFQXJ3SUFJZmdCUUFEckFnQWgtUUVCQUs4Q0FDSDZBVUFBNndJQUlRSUFBQUFQQUNBWEFBRGVBd0FnQWdBQUFOb0RBQ0FYQUFEYkF3QWdFN29CQUFEWkF3QXd1d0VBQU5vREFCQzhBUUFBMlFNQU1MMEJBUUN1QWdBaHdBRkFBTFVDQUNIVkFRQUE2Z0wwQVNMYkFVQUF0UUlBSWU0QkFRQ3VBZ0FoN3dFQkFLNENBQ0h3QVFFQXJ3SUFJZkVCRUFEcEFnQWg4Z0VCQUs0Q0FDSDBBUUVBcndJQUlmVUJBUUN2QWdBaDlnRUJBSzhDQUNIM0FRRUFyd0lBSWZnQlFBRHJBZ0FoLVFFQkFLOENBQ0g2QVVBQTZ3SUFJUk82QVFBQTJRTUFNTHNCQUFEYUF3QVF2QUVBQU5rREFEQzlBUUVBcmdJQUljQUJRQUMxQWdBaDFRRUFBT29DOUFFaTJ3RkFBTFVDQUNIdUFRRUFyZ0lBSWU4QkFRQ3VBZ0FoOEFFQkFLOENBQ0h4QVJBQTZRSUFJZklCQVFDdUFnQWg5QUVCQUs4Q0FDSDFBUUVBcndJQUlmWUJBUUN2QWdBaDl3RUJBSzhDQUNINEFVQUE2d0lBSWZrQkFRQ3ZBZ0FoLWdGQUFPc0NBQ0VQdlFFQkFQY0NBQ0hBQVVBQS1BSUFJZFVCQUFEY0FfUUJJdHNCUUFENEFnQWg3d0VCQVBjQ0FDSHdBUUVBZ3dNQUlmRUJFQUROQXdBaDhnRUJBUGNDQUNIMEFRRUFnd01BSWZVQkFRQ0RBd0FoOWdFQkFJTURBQ0gzQVFFQWd3TUFJZmdCUUFEZEF3QWgtUUVCQUlNREFDSDZBVUFBM1FNQUlRR1JBZ0FBQVBRQkFnR1JBa0FBQUFBQkQ3MEJBUUQzQWdBaHdBRkFBUGdDQUNIVkFRQUEzQVAwQVNMYkFVQUEtQUlBSWU4QkFRRDNBZ0FoOEFFQkFJTURBQ0h4QVJBQXpRTUFJZklCQVFEM0FnQWg5QUVCQUlNREFDSDFBUUVBZ3dNQUlmWUJBUUNEQXdBaDl3RUJBSU1EQUNINEFVQUEzUU1BSWZrQkFRQ0RBd0FoLWdGQUFOMERBQ0VQdlFFQkFBQUFBY0FCUUFBQUFBSFZBUUFBQVBRQkF0c0JRQUFBQUFIdkFRRUFBQUFCOEFFQkFBQUFBZkVCRUFBQUFBSHlBUUVBQUFBQjlBRUJBQUFBQWZVQkFRQUFBQUgyQVFFQUFBQUI5d0VCQUFBQUFmZ0JRQUFBQUFINUFRRUFBQUFCLWdGQUFBQUFBUW9JQUFEaEF3QWdDZ0FBNGdNQUlMMEJBUUFBQUFHX0FRRUFBQUFCd0FGQUFBQUFBZFVCQUFBQWhnSUMyd0ZBQUFBQUFZSUNRQUFBQUFHREFnSUFBQUFCaEFJUUFBQUFBUU1lQUFDR0JRQWdqZ0lBQUljRkFDQ1VBZ0FBQlFBZ0JCNEFBTklEQURDT0FnQUEwd01BTUpBQ0FBRFZBd0FnbEFJQUFOWURBREFTQlFBQWxnUUFJQXNBQUpjRUFDQU1BQUNZQkFBZ0RRQUFtUVFBSUwwQkFRQUFBQUhBQVVBQUFBQUIxUUVBQUFEb0FRTFpBU0FBQUFBQjJ3RkFBQUFBQWQ4QkFRQUFBQUhnQVFFQUFBQUI0UUVCQUFBQUFlSUJBUUFBQUFIakFSQUFBQUFCNUFFQ0FBQUFBZVVCQ0FBQUFBSG1BUUFBbFFRQUlPZ0JBUUFBQUFFQ0FBQUFCUUFnSGdBQWxBUUFJQU1BQUFBRkFDQWVBQUNVQkFBZ0h3QUE4QU1BSUFFWEFBQ0ZCUUF3RndVQUFQTUNBQ0FHQUFEZ0FnQWdDd0FBdHdJQUlBd0FBTGdDQUNBTkFBQzZBZ0FndWdFQUFQQUNBREM3QVFBQUF3QVF2QUVBQVBBQ0FEQzlBUUVBQUFBQndBRkFBTFVDQUNIVkFRQUE4Z0xvQVNMWkFTQUFzd0lBSWRzQlFBQzFBZ0FoM3dFQkFLNENBQ0hnQVFFQUFBQUI0UUVCQUs0Q0FDSGlBUUVBcmdJQUllTUJFQURwQWdBaDVBRUNBTFFDQUNIbEFRZ0E4UUlBSWVZQkFBQ19BZ0FnNkFFQkFLNENBQ0hwQVFFQXJnSUFJUUlBQUFBRkFDQVhBQUR3QXdBZ0FnQUFBT3NEQUNBWEFBRHNBd0FnRXJvQkFBRHFBd0F3dXdFQUFPc0RBQkM4QVFBQTZnTUFNTDBCQVFDdUFnQWh3QUZBQUxVQ0FDSFZBUUFBOGdMb0FTTFpBU0FBc3dJQUlkc0JRQUMxQWdBaDN3RUJBSzRDQUNIZ0FRRUFyZ0lBSWVFQkFRQ3VBZ0FoNGdFQkFLNENBQ0hqQVJBQTZRSUFJZVFCQWdDMEFnQWg1UUVJQVBFQ0FDSG1BUUFBdndJQUlPZ0JBUUN1QWdBaDZRRUJBSzRDQUNFU3VnRUFBT29EQURDN0FRQUE2d01BRUx3QkFBRHFBd0F3dlFFQkFLNENBQ0hBQVVBQXRRSUFJZFVCQUFEeUF1Z0JJdGtCSUFDekFnQWgyd0ZBQUxVQ0FDSGZBUUVBcmdJQUllQUJBUUN1QWdBaDRRRUJBSzRDQUNIaUFRRUFyZ0lBSWVNQkVBRHBBZ0FoNUFFQ0FMUUNBQ0hsQVFnQThRSUFJZVlCQUFDX0FnQWc2QUVCQUs0Q0FDSHBBUUVBcmdJQUlRNjlBUUVBOXdJQUljQUJRQUQ0QWdBaDFRRUFBTzhENkFFaTJRRWdBSWNEQUNIYkFVQUEtQUlBSWQ4QkFRRDNBZ0FoNEFFQkFQY0NBQ0hoQVFFQTl3SUFJZUlCQVFEM0FnQWg0d0VRQU0wREFDSGtBUUlBaUFNQUllVUJDQUR0QXdBaDVnRUFBTzREQUNEb0FRRUE5d0lBSVFXUkFnZ0FBQUFCbUFJSUFBQUFBWmtDQ0FBQUFBR2FBZ2dBQUFBQm13SUlBQUFBQVFLUkFnRUFBQUFFbHdJQkFBQUFCUUdSQWdBQUFPZ0JBaElGQUFEeEF3QWdDd0FBOGdNQUlBd0FBUE1EQUNBTkFBRDBBd0FndlFFQkFQY0NBQ0hBQVVBQS1BSUFJZFVCQUFEdkEtZ0JJdGtCSUFDSEF3QWgyd0ZBQVBnQ0FDSGZBUUVBOXdJQUllQUJBUUQzQWdBaDRRRUJBUGNDQUNIaUFRRUE5d0lBSWVNQkVBRE5Bd0FoNUFFQ0FJZ0RBQ0hsQVFnQTdRTUFJZVlCQUFEdUF3QWc2QUVCQVBjQ0FDRUZIZ0FBOHdRQUlCOEFBSU1GQUNDT0FnQUE5QVFBSUk4Q0FBQ0NCUUFnbEFJQUFGZ0FJQXNlQUFDSkJBQXdId0FBalFRQU1JNENBQUNLQkFBd2p3SUFBSXNFQURDUUFnQUFqQVFBSUpFQ0FBREhBd0F3a2dJQUFNY0RBRENUQWdBQXh3TUFNSlFDQUFESEF3QXdsUUlBQUk0RUFEQ1dBZ0FBeWdNQU1Bc2VBQUQtQXdBd0h3QUFnZ1FBTUk0Q0FBRF9Bd0F3andJQUFJQUVBRENRQWdBQWdRUUFJSkVDQUFDNUF3QXdrZ0lBQUxrREFEQ1RBZ0FBdVFNQU1KUUNBQUM1QXdBd2xRSUFBSU1FQURDV0FnQUF2QU1BTUFzZUFBRDFBd0F3SHdBQS1RTUFNSTRDQUFEMkF3QXdqd0lBQVBjREFEQ1FBZ0FBLUFNQUlKRUNBQUNnQXdBd2tnSUFBS0FEQURDVEFnQUFvQU1BTUpRQ0FBQ2dBd0F3bFFJQUFQb0RBRENXQWdBQW93TUFNQVFIQUFEN0FnQWd2UUVCQUFBQUFiNEJBUUFBQUFIQUFVQUFBQUFCQWdBQUFCZ0FJQjRBQVAwREFDQURBQUFBR0FBZ0hnQUFfUU1BSUI4QUFQd0RBQ0FCRndBQWdRVUFNQUlBQUFBWUFDQVhBQUQ4QXdBZ0FnQUFBS1FEQUNBWEFBRDdBd0FnQTcwQkFRRDNBZ0FodmdFQkFQY0NBQ0hBQVVBQS1BSUFJUVFIQUFENUFnQWd2UUVCQVBjQ0FDRy1BUUVBOXdJQUljQUJRQUQ0QWdBaEJBY0FBUHNDQUNDOUFRRUFBQUFCdmdFQkFBQUFBY0FCUUFBQUFBRUhCd0FBaUFRQUlMMEJBUUFBQUFHLUFRRUFBQUFCd0FGQUFBQUFBZHNCUUFBQUFBSGxBUUlBQUFBQjdRRUJBQUFBQVFJQUFBQVVBQ0FlQUFDSEJBQWdBd0FBQUJRQUlCNEFBSWNFQUNBZkFBQ0ZCQUFnQVJjQUFJQUZBREFDQUFBQUZBQWdGd0FBaFFRQUlBSUFBQUM5QXdBZ0Z3QUFoQVFBSUFhOUFRRUE5d0lBSWI0QkFRRDNBZ0Fod0FGQUFQZ0NBQ0hiQVVBQS1BSUFJZVVCQWdDSUF3QWg3UUVCQVBjQ0FDRUhCd0FBaGdRQUlMMEJBUUQzQWdBaHZnRUJBUGNDQUNIQUFVQUEtQUlBSWRzQlFBRDRBZ0FoNVFFQ0FJZ0RBQ0h0QVFFQTl3SUFJUVVlQUFEN0JBQWdId0FBX2dRQUlJNENBQUQ4QkFBZ2p3SUFBUDBFQUNDVUFnQUE0Z0VBSUFjSEFBQ0lCQUFndlFFQkFBQUFBYjRCQVFBQUFBSEFBVUFBQUFBQjJ3RkFBQUFBQWVVQkFnQUFBQUh0QVFFQUFBQUJBeDRBQVBzRUFDQ09BZ0FBX0FRQUlKUUNBQURpQVFBZ0NnY0FBSk1FQUNBS0FBRGlBd0FndlFFQkFBQUFBYjRCQVFBQUFBSEFBVUFBQUFBQjFRRUFBQUNHQWdMYkFVQUFBQUFCZ2dKQUFBQUFBWU1DQWdBQUFBR0VBaEFBQUFBQkFnQUFBQXNBSUI0QUFKSUVBQ0FEQUFBQUN3QWdIZ0FBa2dRQUlCOEFBSkFFQUNBQkZ3QUEtZ1FBTUFJQUFBQUxBQ0FYQUFDUUJBQWdBZ0FBQU1zREFDQVhBQUNQQkFBZ0NMMEJBUUQzQWdBaHZnRUJBUGNDQUNIQUFVQUEtQUlBSWRVQkFBRE9BNFlDSXRzQlFBRDRBZ0FoZ2dKQUFQZ0NBQ0dEQWdJQWlBTUFJWVFDRUFETkF3QWhDZ2NBQUpFRUFDQUtBQURSQXdBZ3ZRRUJBUGNDQUNHLUFRRUE5d0lBSWNBQlFBRDRBZ0FoMVFFQUFNNERoZ0lpMndGQUFQZ0NBQ0dDQWtBQS1BSUFJWU1DQWdDSUF3QWhoQUlRQU0wREFDRUZIZ0FBOVFRQUlCOEFBUGdFQUNDT0FnQUE5Z1FBSUk4Q0FBRDNCQUFnbEFJQUFPSUJBQ0FLQndBQWt3UUFJQW9BQU9JREFDQzlBUUVBQUFBQnZnRUJBQUFBQWNBQlFBQUFBQUhWQVFBQUFJWUNBdHNCUUFBQUFBR0NBa0FBQUFBQmd3SUNBQUFBQVlRQ0VBQUFBQUVESGdBQTlRUUFJSTRDQUFEMkJBQWdsQUlBQU9JQkFDQVNCUUFBbGdRQUlBc0FBSmNFQUNBTUFBQ1lCQUFnRFFBQW1RUUFJTDBCQVFBQUFBSEFBVUFBQUFBQjFRRUFBQURvQVFMWkFTQUFBQUFCMndGQUFBQUFBZDhCQVFBQUFBSGdBUUVBQUFBQjRRRUJBQUFBQWVJQkFRQUFBQUhqQVJBQUFBQUI1QUVDQUFBQUFlVUJDQUFBQUFIbUFRQUFsUVFBSU9nQkFRQUFBQUVCa1FJQkFBQUFCQU1lQUFEekJBQWdqZ0lBQVBRRUFDQ1VBZ0FBV0FBZ0JCNEFBSWtFQURDT0FnQUFpZ1FBTUpBQ0FBQ01CQUFnbEFJQUFNY0RBREFFSGdBQV9nTUFNSTRDQUFEX0F3QXdrQUlBQUlFRUFDQ1VBZ0FBdVFNQU1BUWVBQUQxQXdBd2pnSUFBUFlEQURDUUFnQUEtQU1BSUpRQ0FBQ2dBd0F3QkI0QUFPTURBRENPQWdBQTVBTUFNSkFDQUFEbUF3QWdsQUlBQU9jREFEQUVIZ0FBd3dNQU1JNENBQURFQXdBd2tBSUFBTVlEQUNDVUFnQUF4d01BTUFRZUFBQzFBd0F3amdJQUFMWURBRENRQWdBQXVBTUFJSlFDQUFDNUF3QXdCQjRBQUtnREFEQ09BZ0FBcVFNQU1KQUNBQUNyQXdBZ2xBSUFBS3dEQURBRUhnQUFuQU1BTUk0Q0FBQ2RBd0F3a0FJQUFKOERBQ0NVQWdBQW9BTUFNQVFlQUFDUEF3QXdqZ0lBQUpBREFEQ1FBZ0FBa2dNQUlKUUNBQUNUQXdBd0FBQUFBQUFBQUFBQUFBQUZIZ0FBN2dRQUlCOEFBUEVFQUNDT0FnQUE3d1FBSUk4Q0FBRHdCQUFnbEFJQUFPSUJBQ0FESGdBQTdnUUFJSTRDQUFEdkJBQWdsQUlBQU9JQkFDQUFBQUFBQUFBQUFBQUFCUjRBQU9rRUFDQWZBQURzQkFBZ2pnSUFBT29FQUNDUEFnQUE2d1FBSUpRQ0FBQUxBQ0FESGdBQTZRUUFJSTRDQUFEcUJBQWdsQUlBQUFzQUlBQUFBQVVlQUFEa0JBQWdId0FBNXdRQUlJNENBQURsQkFBZ2p3SUFBT1lFQUNDVUFnQUE0Z0VBSUFNZUFBRGtCQUFnamdJQUFPVUVBQ0NVQWdBQTRnRUFJQUFBQUFBQUFBc2VBQURGQkFBd0h3QUF5UVFBTUk0Q0FBREdCQUF3andJQUFNY0VBRENRQWdBQXlBUUFJSkVDQUFEbkF3QXdrZ0lBQU9jREFEQ1RBZ0FBNXdNQU1KUUNBQURuQXdBd2xRSUFBTW9FQURDV0FnQUE2Z01BTUJJR0FBQ3NCQUFnQ3dBQWx3UUFJQXdBQUpnRUFDQU5BQUNaQkFBZ3ZRRUJBQUFBQWNBQlFBQUFBQUhWQVFBQUFPZ0JBdGtCSUFBQUFBSGJBVUFBQUFBQjN3RUJBQUFBQWVBQkFRQUFBQUhoQVFFQUFBQUI0Z0VCQUFBQUFlTUJFQUFBQUFIa0FRSUFBQUFCNVFFSUFBQUFBZVlCQUFDVkJBQWc2UUVCQUFBQUFRSUFBQUFGQUNBZUFBRE5CQUFnQXdBQUFBVUFJQjRBQU0wRUFDQWZBQURNQkFBZ0FSY0FBT01FQURBQ0FBQUFCUUFnRndBQXpBUUFJQUlBQUFEckF3QWdGd0FBeXdRQUlBNjlBUUVBOXdJQUljQUJRQUQ0QWdBaDFRRUFBTzhENkFFaTJRRWdBSWNEQUNIYkFVQUEtQUlBSWQ4QkFRRDNBZ0FoNEFFQkFQY0NBQ0hoQVFFQTl3SUFJZUlCQVFEM0FnQWg0d0VRQU0wREFDSGtBUUlBaUFNQUllVUJDQUR0QXdBaDVnRUFBTzREQUNEcEFRRUE5d0lBSVJJR0FBQ3JCQUFnQ3dBQThnTUFJQXdBQVBNREFDQU5BQUQwQXdBZ3ZRRUJBUGNDQUNIQUFVQUEtQUlBSWRVQkFBRHZBLWdCSXRrQklBQ0hBd0FoMndGQUFQZ0NBQ0hmQVFFQTl3SUFJZUFCQVFEM0FnQWg0UUVCQVBjQ0FDSGlBUUVBOXdJQUllTUJFQUROQXdBaDVBRUNBSWdEQUNIbEFRZ0E3UU1BSWVZQkFBRHVBd0FnNlFFQkFQY0NBQ0VTQmdBQXJBUUFJQXNBQUpjRUFDQU1BQUNZQkFBZ0RRQUFtUVFBSUwwQkFRQUFBQUhBQVVBQUFBQUIxUUVBQUFEb0FRTFpBU0FBQUFBQjJ3RkFBQUFBQWQ4QkFRQUFBQUhnQVFFQUFBQUI0UUVCQUFBQUFlSUJBUUFBQUFIakFSQUFBQUFCNUFFQ0FBQUFBZVVCQ0FBQUFBSG1BUUFBbFFRQUlPa0JBUUFBQUFFRUhnQUF4UVFBTUk0Q0FBREdCQUF3a0FJQUFNZ0VBQ0NVQWdBQTV3TUFNQUFBQUFBQUFBQUFCUjRBQU40RUFDQWZBQURoQkFBZ2pnSUFBTjhFQUNDUEFnQUE0QVFBSUpRQ0FBRGlBUUFnQXg0QUFONEVBQ0NPQWdBQTN3UUFJSlFDQUFEaUFRQWdDZ01BQUtBRUFDQUxBQUNoQkFBZ0RBQUFvZ1FBSUE0QUFLTUVBQ0FQQUFDa0JBQWdFQUFBcFFRQUlNNEJBQUQ5QWdBZ3p3RUFBUDBDQUNEUUFRQUFfUUlBSU5FQkFBRDlBZ0FnQlFVQUFOMEVBQ0FHQUFEWkJBQWdDd0FBb1FRQUlBd0FBS0lFQUNBTkFBQ2tCQUFnQXdjQUFOa0VBQ0FJQUFEYUJBQWdDZ0FBM0FRQUlBQUJBd0FBb0FRQUlCUURBQUNhQkFBZ0N3QUFtd1FBSUF3QUFKd0VBQ0FQQUFDZUJBQWdFQUFBbndRQUlMMEJBUUFBQUFIQUFVQUFBQUFCekFFQkFBQUFBYzBCQVFBQUFBSE9BUUVBQUFBQnp3RUJBQUFBQWRBQkFRQUFBQUhSQVFFQUFBQUIwd0VBQUFEVEFRTFZBUUFBQU5VQkF0Y0JBQUFBMXdFQzJBRWdBQUFBQWRrQklBQUFBQUhhQVFJQUFBQUIyd0ZBQUFBQUFRSUFBQURpQVFBZ0hnQUEzZ1FBSUFNQUFBRGxBUUFnSGdBQTNnUUFJQjhBQU9JRUFDQVdBQUFBNVFFQUlBTUFBSWtEQUNBTEFBQ0tBd0FnREFBQWl3TUFJQThBQUkwREFDQVFBQUNPQXdBZ0Z3QUE0Z1FBSUwwQkFRRDNBZ0Fod0FGQUFQZ0NBQ0hNQVFFQTl3SUFJYzBCQVFEM0FnQWh6Z0VCQUlNREFDSFBBUUVBZ3dNQUlkQUJBUUNEQXdBaDBRRUJBSU1EQUNIVEFRQUFoQVBUQVNMVkFRQUFoUVBWQVNMWEFRQUFoZ1BYQVNMWUFTQUFod01BSWRrQklBQ0hBd0FoMmdFQ0FJZ0RBQ0hiQVVBQS1BSUFJUlFEQUFDSkF3QWdDd0FBaWdNQUlBd0FBSXNEQUNBUEFBQ05Bd0FnRUFBQWpnTUFJTDBCQVFEM0FnQWh3QUZBQVBnQ0FDSE1BUUVBOXdJQUljMEJBUUQzQWdBaHpnRUJBSU1EQUNIUEFRRUFnd01BSWRBQkFRQ0RBd0FoMFFFQkFJTURBQ0hUQVFBQWhBUFRBU0xWQVFBQWhRUFZBU0xYQVFBQWhnUFhBU0xZQVNBQWh3TUFJZGtCSUFDSEF3QWgyZ0VDQUlnREFDSGJBVUFBLUFJQUlRNjlBUUVBQUFBQndBRkFBQUFBQWRVQkFBQUE2QUVDMlFFZ0FBQUFBZHNCUUFBQUFBSGZBUUVBQUFBQjRBRUJBQUFBQWVFQkFRQUFBQUhpQVFFQUFBQUI0d0VRQUFBQUFlUUJBZ0FBQUFIbEFRZ0FBQUFCNWdFQUFKVUVBQ0RwQVFFQUFBQUJGQU1BQUpvRUFDQUxBQUNiQkFBZ0RBQUFuQVFBSUE0QUFKMEVBQ0FQQUFDZUJBQWd2UUVCQUFBQUFjQUJRQUFBQUFITUFRRUFBQUFCelFFQkFBQUFBYzRCQVFBQUFBSFBBUUVBQUFBQjBBRUJBQUFBQWRFQkFRQUFBQUhUQVFBQUFOTUJBdFVCQUFBQTFRRUMxd0VBQUFEWEFRTFlBU0FBQUFBQjJRRWdBQUFBQWRvQkFnQUFBQUhiQVVBQUFBQUJBZ0FBQU9JQkFDQWVBQURrQkFBZ0F3QUFBT1VCQUNBZUFBRGtCQUFnSHdBQTZBUUFJQllBQUFEbEFRQWdBd0FBaVFNQUlBc0FBSW9EQUNBTUFBQ0xBd0FnRGdBQWpBTUFJQThBQUkwREFDQVhBQURvQkFBZ3ZRRUJBUGNDQUNIQUFVQUEtQUlBSWN3QkFRRDNBZ0FoelFFQkFQY0NBQ0hPQVFFQWd3TUFJYzhCQVFDREF3QWgwQUVCQUlNREFDSFJBUUVBZ3dNQUlkTUJBQUNFQTlNQkl0VUJBQUNGQTlVQkl0Y0JBQUNHQTljQkl0Z0JJQUNIQXdBaDJRRWdBSWNEQUNIYUFRSUFpQU1BSWRzQlFBRDRBZ0FoRkFNQUFJa0RBQ0FMQUFDS0F3QWdEQUFBaXdNQUlBNEFBSXdEQUNBUEFBQ05Bd0FndlFFQkFQY0NBQ0hBQVVBQS1BSUFJY3dCQVFEM0FnQWh6UUVCQVBjQ0FDSE9BUUVBZ3dNQUljOEJBUUNEQXdBaDBBRUJBSU1EQUNIUkFRRUFnd01BSWRNQkFBQ0VBOU1CSXRVQkFBQ0ZBOVVCSXRjQkFBQ0dBOWNCSXRnQklBQ0hBd0FoMlFFZ0FJY0RBQ0hhQVFJQWlBTUFJZHNCUUFENEFnQWhDd2NBQUpNRUFDQUlBQURoQXdBZ3ZRRUJBQUFBQWI0QkFRQUFBQUdfQVFFQUFBQUJ3QUZBQUFBQUFkVUJBQUFBaGdJQzJ3RkFBQUFBQVlJQ1FBQUFBQUdEQWdJQUFBQUJoQUlRQUFBQUFRSUFBQUFMQUNBZUFBRHBCQUFnQXdBQUFBa0FJQjRBQU9rRUFDQWZBQUR0QkFBZ0RRQUFBQWtBSUFjQUFKRUVBQ0FJQUFEUUF3QWdGd0FBN1FRQUlMMEJBUUQzQWdBaHZnRUJBUGNDQUNHX0FRRUE5d0lBSWNBQlFBRDRBZ0FoMVFFQUFNNERoZ0lpMndGQUFQZ0NBQ0dDQWtBQS1BSUFJWU1DQWdDSUF3QWhoQUlRQU0wREFDRUxCd0FBa1FRQUlBZ0FBTkFEQUNDOUFRRUE5d0lBSWI0QkFRRDNBZ0FodndFQkFQY0NBQ0hBQVVBQS1BSUFJZFVCQUFET0E0WUNJdHNCUUFENEFnQWhnZ0pBQVBnQ0FDR0RBZ0lBaUFNQUlZUUNFQUROQXdBaEZBc0FBSnNFQUNBTUFBQ2NCQUFnRGdBQW5RUUFJQThBQUo0RUFDQVFBQUNmQkFBZ3ZRRUJBQUFBQWNBQlFBQUFBQUhNQVFFQUFBQUJ6UUVCQUFBQUFjNEJBUUFBQUFIUEFRRUFBQUFCMEFFQkFBQUFBZEVCQVFBQUFBSFRBUUFBQU5NQkF0VUJBQUFBMVFFQzF3RUFBQURYQVFMWUFTQUFBQUFCMlFFZ0FBQUFBZG9CQWdBQUFBSGJBVUFBQUFBQkFnQUFBT0lCQUNBZUFBRHVCQUFnQXdBQUFPVUJBQ0FlQUFEdUJBQWdId0FBOGdRQUlCWUFBQURsQVFBZ0N3QUFpZ01BSUF3QUFJc0RBQ0FPQUFDTUF3QWdEd0FBalFNQUlCQUFBSTREQUNBWEFBRHlCQUFndlFFQkFQY0NBQ0hBQVVBQS1BSUFJY3dCQVFEM0FnQWh6UUVCQVBjQ0FDSE9BUUVBZ3dNQUljOEJBUUNEQXdBaDBBRUJBSU1EQUNIUkFRRUFnd01BSWRNQkFBQ0VBOU1CSXRVQkFBQ0ZBOVVCSXRjQkFBQ0dBOWNCSXRnQklBQ0hBd0FoMlFFZ0FJY0RBQ0hhQVFJQWlBTUFJZHNCUUFENEFnQWhGQXNBQUlvREFDQU1BQUNMQXdBZ0RnQUFqQU1BSUE4QUFJMERBQ0FRQUFDT0F3QWd2UUVCQVBjQ0FDSEFBVUFBLUFJQUljd0JBUUQzQWdBaHpRRUJBUGNDQUNIT0FRRUFnd01BSWM4QkFRQ0RBd0FoMEFFQkFJTURBQ0hSQVFFQWd3TUFJZE1CQUFDRUE5TUJJdFVCQUFDRkE5VUJJdGNCQUFDR0E5Y0JJdGdCSUFDSEF3QWgyUUVnQUljREFDSGFBUUlBaUFNQUlkc0JRQUQ0QWdBaEJiMEJBUUFBQUFIQUFVQUFBQUFCekFFQkFBQUFBZHNCUUFBQUFBSGdBUUVBQUFBQkFnQUFBRmdBSUI0QUFQTUVBQ0FVQXdBQW1nUUFJQXdBQUp3RUFDQU9BQUNkQkFBZ0R3QUFuZ1FBSUJBQUFKOEVBQ0M5QVFFQUFBQUJ3QUZBQUFBQUFjd0JBUUFBQUFITkFRRUFBQUFCemdFQkFBQUFBYzhCQVFBQUFBSFFBUUVBQUFBQjBRRUJBQUFBQWRNQkFBQUEwd0VDMVFFQUFBRFZBUUxYQVFBQUFOY0JBdGdCSUFBQUFBSFpBU0FBQUFBQjJnRUNBQUFBQWRzQlFBQUFBQUVDQUFBQTRnRUFJQjRBQVBVRUFDQURBQUFBNVFFQUlCNEFBUFVFQUNBZkFBRDVCQUFnRmdBQUFPVUJBQ0FEQUFDSkF3QWdEQUFBaXdNQUlBNEFBSXdEQUNBUEFBQ05Bd0FnRUFBQWpnTUFJQmNBQVBrRUFDQzlBUUVBOXdJQUljQUJRQUQ0QWdBaHpBRUJBUGNDQUNITkFRRUE5d0lBSWM0QkFRQ0RBd0FoendFQkFJTURBQ0hRQVFFQWd3TUFJZEVCQVFDREF3QWgwd0VBQUlRRDB3RWkxUUVBQUlVRDFRRWkxd0VBQUlZRDF3RWkyQUVnQUljREFDSFpBU0FBaHdNQUlkb0JBZ0NJQXdBaDJ3RkFBUGdDQUNFVUF3QUFpUU1BSUF3QUFJc0RBQ0FPQUFDTUF3QWdEd0FBalFNQUlCQUFBSTREQUNDOUFRRUE5d0lBSWNBQlFBRDRBZ0FoekFFQkFQY0NBQ0hOQVFFQTl3SUFJYzRCQVFDREF3QWh6d0VCQUlNREFDSFFBUUVBZ3dNQUlkRUJBUUNEQXdBaDB3RUFBSVFEMHdFaTFRRUFBSVVEMVFFaTF3RUFBSVlEMXdFaTJBRWdBSWNEQUNIWkFTQUFod01BSWRvQkFnQ0lBd0FoMndGQUFQZ0NBQ0VJdlFFQkFBQUFBYjRCQVFBQUFBSEFBVUFBQUFBQjFRRUFBQUNHQWdMYkFVQUFBQUFCZ2dKQUFBQUFBWU1DQWdBQUFBR0VBaEFBQUFBQkZBTUFBSm9FQUNBTEFBQ2JCQUFnRGdBQW5RUUFJQThBQUo0RUFDQVFBQUNmQkFBZ3ZRRUJBQUFBQWNBQlFBQUFBQUhNQVFFQUFBQUJ6UUVCQUFBQUFjNEJBUUFBQUFIUEFRRUFBQUFCMEFFQkFBQUFBZEVCQVFBQUFBSFRBUUFBQU5NQkF0VUJBQUFBMVFFQzF3RUFBQURYQVFMWUFTQUFBQUFCMlFFZ0FBQUFBZG9CQWdBQUFBSGJBVUFBQUFBQkFnQUFBT0lCQUNBZUFBRDdCQUFnQXdBQUFPVUJBQ0FlQUFEN0JBQWdId0FBX3dRQUlCWUFBQURsQVFBZ0F3QUFpUU1BSUFzQUFJb0RBQ0FPQUFDTUF3QWdEd0FBalFNQUlCQUFBSTREQUNBWEFBRF9CQUFndlFFQkFQY0NBQ0hBQVVBQS1BSUFJY3dCQVFEM0FnQWh6UUVCQVBjQ0FDSE9BUUVBZ3dNQUljOEJBUUNEQXdBaDBBRUJBSU1EQUNIUkFRRUFnd01BSWRNQkFBQ0VBOU1CSXRVQkFBQ0ZBOVVCSXRjQkFBQ0dBOWNCSXRnQklBQ0hBd0FoMlFFZ0FJY0RBQ0hhQVFJQWlBTUFJZHNCUUFENEFnQWhGQU1BQUlrREFDQUxBQUNLQXdBZ0RnQUFqQU1BSUE4QUFJMERBQ0FRQUFDT0F3QWd2UUVCQVBjQ0FDSEFBVUFBLUFJQUljd0JBUUQzQWdBaHpRRUJBUGNDQUNIT0FRRUFnd01BSWM4QkFRQ0RBd0FoMEFFQkFJTURBQ0hSQVFFQWd3TUFJZE1CQUFDRUE5TUJJdFVCQUFDRkE5VUJJdGNCQUFDR0E5Y0JJdGdCSUFDSEF3QWgyUUVnQUljREFDSGFBUUlBaUFNQUlkc0JRQUQ0QWdBaEJyMEJBUUFBQUFHLUFRRUFBQUFCd0FGQUFBQUFBZHNCUUFBQUFBSGxBUUlBQUFBQjdRRUJBQUFBQVFPOUFRRUFBQUFCdmdFQkFBQUFBY0FCUUFBQUFBRURBQUFBV3dBZ0hnQUE4d1FBSUI4QUFJUUZBQ0FIQUFBQVd3QWdGd0FBaEFVQUlMMEJBUUQzQWdBaHdBRkFBUGdDQUNITUFRRUE5d0lBSWRzQlFBRDRBZ0FoNEFFQkFQY0NBQ0VGdlFFQkFQY0NBQ0hBQVVBQS1BSUFJY3dCQVFEM0FnQWgyd0ZBQVBnQ0FDSGdBUUVBOXdJQUlRNjlBUUVBQUFBQndBRkFBQUFBQWRVQkFBQUE2QUVDMlFFZ0FBQUFBZHNCUUFBQUFBSGZBUUVBQUFBQjRBRUJBQUFBQWVFQkFRQUFBQUhpQVFFQUFBQUI0d0VRQUFBQUFlUUJBZ0FBQUFIbEFRZ0FBQUFCNWdFQUFKVUVBQ0RvQVFFQUFBQUJFd1VBQUpZRUFDQUdBQUNzQkFBZ0RBQUFtQVFBSUEwQUFKa0VBQ0M5QVFFQUFBQUJ3QUZBQUFBQUFkVUJBQUFBNkFFQzJRRWdBQUFBQWRzQlFBQUFBQUhmQVFFQUFBQUI0QUVCQUFBQUFlRUJBUUFBQUFIaUFRRUFBQUFCNHdFUUFBQUFBZVFCQWdBQUFBSGxBUWdBQUFBQjVnRUFBSlVFQUNEb0FRRUFBQUFCNlFFQkFBQUFBUUlBQUFBRkFDQWVBQUNHQlFBZ0Q3MEJBUUFBQUFIQUFVQUFBQUFCMVFFQUFBRDBBUUxiQVVBQUFBQUI3d0VCQUFBQUFmQUJBUUFBQUFIeEFSQUFBQUFCOGdFQkFBQUFBZlFCQVFBQUFBSDFBUUVBQUFBQjlnRUJBQUFBQWZjQkFRQUFBQUg0QVVBQUFBQUItUUVCQUFBQUFmb0JRQUFBQUFFREFBQUFBd0FnSGdBQWhnVUFJQjhBQUlzRkFDQVZBQUFBQXdBZ0JRQUE4UU1BSUFZQUFLc0VBQ0FNQUFEekF3QWdEUUFBOUFNQUlCY0FBSXNGQUNDOUFRRUE5d0lBSWNBQlFBRDRBZ0FoMVFFQUFPOEQ2QUVpMlFFZ0FJY0RBQ0hiQVVBQS1BSUFJZDhCQVFEM0FnQWg0QUVCQVBjQ0FDSGhBUUVBOXdJQUllSUJBUUQzQWdBaDR3RVFBTTBEQUNIa0FRSUFpQU1BSWVVQkNBRHRBd0FoNWdFQUFPNERBQ0RvQVFFQTl3SUFJZWtCQVFEM0FnQWhFd1VBQVBFREFDQUdBQUNyQkFBZ0RBQUE4d01BSUEwQUFQUURBQ0M5QVFFQTl3SUFJY0FCUUFENEFnQWgxUUVBQU84RDZBRWkyUUVnQUljREFDSGJBVUFBLUFJQUlkOEJBUUQzQWdBaDRBRUJBUGNDQUNIaEFRRUE5d0lBSWVJQkFRRDNBZ0FoNHdFUUFNMERBQ0hrQVFJQWlBTUFJZVVCQ0FEdEF3QWg1Z0VBQU80REFDRG9BUUVBOXdJQUlla0JBUUQzQWdBaENMMEJBUUFBQUFHX0FRRUFBQUFCd0FGQUFBQUFBZFVCQUFBQWhnSUMyd0ZBQUFBQUFZSUNRQUFBQUFHREFnSUFBQUFCaEFJUUFBQUFBUk1GQUFDV0JBQWdCZ0FBckFRQUlBc0FBSmNFQUNBTkFBQ1pCQUFndlFFQkFBQUFBY0FCUUFBQUFBSFZBUUFBQU9nQkF0a0JJQUFBQUFIYkFVQUFBQUFCM3dFQkFBQUFBZUFCQVFBQUFBSGhBUUVBQUFBQjRnRUJBQUFBQWVNQkVBQUFBQUhrQVFJQUFBQUI1UUVJQUFBQUFlWUJBQUNWQkFBZzZBRUJBQUFBQWVrQkFRQUFBQUVDQUFBQUJRQWdIZ0FBalFVQUlBTUFBQUFEQUNBZUFBQ05CUUFnSHdBQWtRVUFJQlVBQUFBREFDQUZBQUR4QXdBZ0JnQUFxd1FBSUFzQUFQSURBQ0FOQUFEMEF3QWdGd0FBa1FVQUlMMEJBUUQzQWdBaHdBRkFBUGdDQUNIVkFRQUE3d1BvQVNMWkFTQUFod01BSWRzQlFBRDRBZ0FoM3dFQkFQY0NBQ0hnQVFFQTl3SUFJZUVCQVFEM0FnQWg0Z0VCQVBjQ0FDSGpBUkFBelFNQUllUUJBZ0NJQXdBaDVRRUlBTzBEQUNIbUFRQUE3Z01BSU9nQkFRRDNBZ0FoNlFFQkFQY0NBQ0VUQlFBQThRTUFJQVlBQUtzRUFDQUxBQUR5QXdBZ0RRQUE5QU1BSUwwQkFRRDNBZ0Fod0FGQUFQZ0NBQ0hWQVFBQTd3UG9BU0xaQVNBQWh3TUFJZHNCUUFENEFnQWgzd0VCQVBjQ0FDSGdBUUVBOXdJQUllRUJBUUQzQWdBaDRnRUJBUGNDQUNIakFSQUF6UU1BSWVRQkFnQ0lBd0FoNVFFSUFPMERBQ0htQVFBQTdnTUFJT2dCQVFEM0FnQWg2UUVCQVBjQ0FDRUd2UUVCQUFBQUFiOEJBUUFBQUFIQUFVQUFBQUFCMndGQUFBQUFBZVVCQWdBQUFBSHRBUUVBQUFBQkNyMEJBUUFBQUFIQUFVQUFBQUFCMVFFQUFBQ0tBZ0xaQVNBQUFBQUIyd0ZBQUFBQUFkOEJBUUFBQUFIZ0FRRUFBQUFCaGdJQkFBQUFBWWNDQVFBQUFBR0lBZ0VBQUFBQkE3MEJBUUFBQUFHX0FRRUFBQUFCd0FGQUFBQUFBUWU5QVFFQUFBQUJ3QUZBQUFBQUFkOEJBUUFBQUFIOEFRQUFBUHdCQXYwQkFRQUFBQUgtQVFFQUFBQUJfd0VnQUFBQUFSTUZBQUNXQkFBZ0JnQUFyQVFBSUFzQUFKY0VBQ0FNQUFDWUJBQWd2UUVCQUFBQUFjQUJRQUFBQUFIVkFRQUFBT2dCQXRrQklBQUFBQUhiQVVBQUFBQUIzd0VCQUFBQUFlQUJBUUFBQUFIaEFRRUFBQUFCNGdFQkFBQUFBZU1CRUFBQUFBSGtBUUlBQUFBQjVRRUlBQUFBQWVZQkFBQ1ZCQUFnNkFFQkFBQUFBZWtCQVFBQUFBRUNBQUFBQlFBZ0hnQUFsZ1VBSUJRREFBQ2FCQUFnQ3dBQW13UUFJQXdBQUp3RUFDQU9BQUNkQkFBZ0VBQUFud1FBSUwwQkFRQUFBQUhBQVVBQUFBQUJ6QUVCQUFBQUFjMEJBUUFBQUFIT0FRRUFBQUFCendFQkFBQUFBZEFCQVFBQUFBSFJBUUVBQUFBQjB3RUFBQURUQVFMVkFRQUFBTlVCQXRjQkFBQUExd0VDMkFFZ0FBQUFBZGtCSUFBQUFBSGFBUUlBQUFBQjJ3RkFBQUFBQVFJQUFBRGlBUUFnSGdBQW1BVUFJQU1BQUFBREFDQWVBQUNXQlFBZ0h3QUFuQVVBSUJVQUFBQURBQ0FGQUFEeEF3QWdCZ0FBcXdRQUlBc0FBUElEQUNBTUFBRHpBd0FnRndBQW5BVUFJTDBCQVFEM0FnQWh3QUZBQVBnQ0FDSFZBUUFBN3dQb0FTTFpBU0FBaHdNQUlkc0JRQUQ0QWdBaDN3RUJBUGNDQUNIZ0FRRUE5d0lBSWVFQkFRRDNBZ0FoNGdFQkFQY0NBQ0hqQVJBQXpRTUFJZVFCQWdDSUF3QWg1UUVJQU8wREFDSG1BUUFBN2dNQUlPZ0JBUUQzQWdBaDZRRUJBUGNDQUNFVEJRQUE4UU1BSUFZQUFLc0VBQ0FMQUFEeUF3QWdEQUFBOHdNQUlMMEJBUUQzQWdBaHdBRkFBUGdDQUNIVkFRQUE3d1BvQVNMWkFTQUFod01BSWRzQlFBRDRBZ0FoM3dFQkFQY0NBQ0hnQVFFQTl3SUFJZUVCQVFEM0FnQWg0Z0VCQVBjQ0FDSGpBUkFBelFNQUllUUJBZ0NJQXdBaDVRRUlBTzBEQUNIbUFRQUE3Z01BSU9nQkFRRDNBZ0FoNlFFQkFQY0NBQ0VEQUFBQTVRRUFJQjRBQUpnRkFDQWZBQUNmQlFBZ0ZnQUFBT1VCQUNBREFBQ0pBd0FnQ3dBQWlnTUFJQXdBQUlzREFDQU9BQUNNQXdBZ0VBQUFqZ01BSUJjQUFKOEZBQ0M5QVFFQTl3SUFJY0FCUUFENEFnQWh6QUVCQVBjQ0FDSE5BUUVBOXdJQUljNEJBUUNEQXdBaHp3RUJBSU1EQUNIUUFRRUFnd01BSWRFQkFRQ0RBd0FoMHdFQUFJUUQwd0VpMVFFQUFJVUQxUUVpMXdFQUFJWUQxd0VpMkFFZ0FJY0RBQ0haQVNBQWh3TUFJZG9CQWdDSUF3QWgyd0ZBQVBnQ0FDRVVBd0FBaVFNQUlBc0FBSW9EQUNBTUFBQ0xBd0FnRGdBQWpBTUFJQkFBQUk0REFDQzlBUUVBOXdJQUljQUJRQUQ0QWdBaHpBRUJBUGNDQUNITkFRRUE5d0lBSWM0QkFRQ0RBd0FoendFQkFJTURBQ0hRQVFFQWd3TUFJZEVCQVFDREF3QWgwd0VBQUlRRDB3RWkxUUVBQUlVRDFRRWkxd0VBQUlZRDF3RWkyQUVnQUljREFDSFpBU0FBaHdNQUlkb0JBZ0NJQXdBaDJ3RkFBUGdDQUNFQkVRQUNCd01HQXdRQURRc2RCZ3dlQ1E0aEFROGlDaEFtREFZRUFBc0ZBQVFHQUFJTERBWU1GUWtOR1FvQ0F3Y0RCQUFGQVFNSUFBUUVBQWdIQUFJSUFBTUtFQWNCQ1FBR0FRb1JBQUlIQUFJSUFBTUNCd0FDQ0FBREF3c2FBQXdiQUEwY0FBRUhBQUlHQXljQUN5Z0FEQ2tBRGlvQUR5c0FFQ3dBQUFFUkFBSUJFUUFDQXdRQUVpUUFFeVVBRkFBQUFBTUVBQklrQUJNbEFCUUNCd0FDQ0FBREFnY0FBZ2dBQXdVRUFCa2tBQndsQUIwMkFCbzNBQnNBQUFBQUFBVUVBQmtrQUJ3bEFCMDJBQm8zQUJzQUFBTUVBQ0lrQUNNbEFDUUFBQUFEQkFBaUpBQWpKUUFrQUFBQUF3UUFLaVFBS3lVQUxBQUFBQU1FQUNva0FDc2xBQ3dCQndBQ0FRY0FBZ01FQURFa0FESWxBRE1BQUFBREJBQXhKQUF5SlFBekFRa0FCZ0VKQUFZRkJBQTRKQUE3SlFBOE5nQTVOd0E2QUFBQUFBQUZCQUE0SkFBN0pRQThOZ0E1TndBNkFnY0FBZ2dBQXdJSEFBSUlBQU1GQkFCQkpBQkVKUUJGTmdCQ053QkRBQUFBQUFBRkJBQkJKQUJFSlFCRk5nQkNOd0JEQWdVQUJBWUFBZ0lGQUFRR0FBSUZCQUJLSkFCTkpRQk9OZ0JMTndCTUFBQUFBQUFGQkFCS0pBQk5KUUJPTmdCTE53Qk1BQUFGQkFCVEpBQldKUUJYTmdCVU53QlZBQUFBQUFBRkJBQlRKQUJXSlFCWE5nQlVOd0JWQWdjQUFnZ0FBd0lIQUFJSUFBTURCQUJjSkFCZEpRQmVBQUFBQXdRQVhDUUFYU1VBWGhJQ0FSTXRBUlF1QVJVdkFSWXdBUmd5QVJrMERobzFEeHMzQVJ3NURoMDZFQ0E3QVNFOEFTSTlEaVpBRVNkQkZTaENCaWxEQmlwRUJpdEZCaXhHQmkxSUJpNUtEaTlMRmpCTkJqRlBEakpRRnpOUkJqUlNCalZURGpoV0dEbFhIanBaQkR0YUJEeGRCRDFlQkQ1ZkJEOWhCRUJqRGtGa0gwSm1CRU5vRGtScElFVnFCRVpyQkVkc0RraHZJVWx3SlVweUprdHpKa3gySmsxM0prNTRKazk2SmxCOERsRjlKMUpfSmxPQkFRNVVnZ0VvVllNQkpsYUVBU1pYaFFFT1dJZ0JLVm1KQVMxYWlnRU1XNHNCREZ5TUFReGRqUUVNWG80QkRGLVFBUXhna2dFT1laTUJMbUtWQVF4amx3RU9aSmdCTDJXWkFReG1tZ0VNWjVzQkRtaWVBVEJwbndFMGFxQUJCMnVoQVFkc29nRUhiYU1CQjI2a0FRZHZwZ0VIY0tnQkRuR3BBVFZ5cXdFSGM2MEJEblN1QVRaMXJ3RUhkckFCQjNleEFRNTR0QUUzZWJVQlBYcTJBUWw3dHdFSmZMZ0JDWDI1QVFsLXVnRUpmN3dCQ1lBQnZnRU9nUUdfQVQ2Q0FjRUJDWU1Cd3dFT2hBSEVBVC1GQWNVQkNZWUJ4Z0VKaHdISEFRNklBY29CUUlrQnl3RkdpZ0hNQVFPTEFjMEJBNHdCemdFRGpRSFBBUU9PQWRBQkE0OEIwZ0VEa0FIVUFRNlJBZFVCUjVJQjF3RURrd0haQVE2VUFkb0JTSlVCMndFRGxnSGNBUU9YQWQwQkRwZ0I0QUZKbVFIaEFVLWFBZU1CQXBzQjVBRUNuQUhuQVFLZEFlZ0JBcDRCNlFFQ253SHJBUUtnQWUwQkRxRUI3Z0ZRb2dId0FRS2pBZklCRHFRQjh3RlJwUUgwQVFLbUFmVUJBcWNCOWdFT3FBSDVBVktwQWZvQldLb0Itd0VLcXdIOEFRcXNBZjBCQ3EwQl9nRUtyZ0hfQVFxdkFZRUNDckFCZ3dJT3NRR0VBbG15QVlZQ0NyTUJpQUlPdEFHSkFscTFBWW9DQ3JZQml3SUt0d0dNQWc2NEFZOENXN2tCa0FKZlwiXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRlY29kZUJhc2U2NEFzV2FzbSh3YXNtQmFzZTY0OiBzdHJpbmcpOiBQcm9taXNlPFdlYkFzc2VtYmx5Lk1vZHVsZT4ge1xuICBjb25zdCB7IEJ1ZmZlciB9ID0gYXdhaXQgaW1wb3J0KCdub2RlOmJ1ZmZlcicpXG4gIGNvbnN0IHdhc21BcnJheSA9IEJ1ZmZlci5mcm9tKHdhc21CYXNlNjQsICdiYXNlNjQnKVxuICByZXR1cm4gbmV3IFdlYkFzc2VtYmx5Lk1vZHVsZSh3YXNtQXJyYXkpXG59XG5cbmNvbmZpZy5jb21waWxlcldhc20gPSB7XG4gIGdldFJ1bnRpbWU6IGFzeW5jICgpID0+IGF3YWl0IGltcG9ydChcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvcXVlcnlfY29tcGlsZXJfZmFzdF9iZy5wb3N0Z3Jlc3FsLm1qc1wiKSxcblxuICBnZXRRdWVyeUNvbXBpbGVyV2FzbU1vZHVsZTogYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHsgd2FzbSB9ID0gYXdhaXQgaW1wb3J0KFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9xdWVyeV9jb21waWxlcl9mYXN0X2JnLnBvc3RncmVzcWwud2FzbS1iYXNlNjQubWpzXCIpXG4gICAgcmV0dXJuIGF3YWl0IGRlY29kZUJhc2U2NEFzV2FzbSh3YXNtKVxuICB9LFxuXG4gIGltcG9ydE5hbWU6IFwiLi9xdWVyeV9jb21waWxlcl9mYXN0X2JnLmpzXCJcbn1cblxuXG5cbmV4cG9ydCB0eXBlIExvZ09wdGlvbnM8Q2xpZW50T3B0aW9ucyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zPiA9XG4gICdsb2cnIGV4dGVuZHMga2V5b2YgQ2xpZW50T3B0aW9ucyA/IENsaWVudE9wdGlvbnNbJ2xvZyddIGV4dGVuZHMgQXJyYXk8UHJpc21hLkxvZ0xldmVsIHwgUHJpc21hLkxvZ0RlZmluaXRpb24+ID8gUHJpc21hLkdldEV2ZW50czxDbGllbnRPcHRpb25zWydsb2cnXT4gOiBuZXZlciA6IG5ldmVyXG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50Q29uc3RydWN0b3Ige1xuICAgIC8qKlxuICAgKiAjIyBQcmlzbWEgQ2xpZW50XG4gICAqIFxuICAgKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAgICogICBhZGFwdGVyOiBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAgICogfSlcbiAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dQb3N0c1xuICAgKiBjb25zdCBibG9nUG9zdHMgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoKVxuICAgKiBgYGBcbiAgICogXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2NsaWVudCkuXG4gICAqL1xuXG4gIG5ldyA8XG4gICAgT3B0aW9ucyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnMsXG4gICAgTG9nT3B0cyBleHRlbmRzIExvZ09wdGlvbnM8T3B0aW9ucz4gPSBMb2dPcHRpb25zPE9wdGlvbnM+LFxuICAgIE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSA9IE9wdGlvbnMgZXh0ZW5kcyB7IG9taXQ6IGluZmVyIFUgfSA/IFUgOiBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddLFxuICAgIEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzXG4gID4ob3B0aW9uczogUHJpc21hLlByaXNtYUNsaWVudENvbnN0cnVjdG9yQXJnczxPcHRpb25zPik6IFByaXNtYUNsaWVudDxMb2dPcHRzLCBPbWl0T3B0cywgRXh0QXJncz5cbn1cblxuLyoqXG4gKiAjIyBQcmlzbWEgQ2xpZW50XG4gKiBcbiAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICogICBhZGFwdGVyOiBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAqIH0pXG4gKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ1Bvc3RzXG4gKiBjb25zdCBibG9nUG9zdHMgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoKVxuICogYGBgXG4gKiBcbiAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2NsaWVudCkuXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnQ8XG4gIGluIExvZ09wdHMgZXh0ZW5kcyBQcmlzbWEuTG9nTGV2ZWwgPSBuZXZlcixcbiAgaW4gb3V0IE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSA9IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10sXG4gIGluIG91dCBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJnc1xuPiB7XG4gIFtLOiBzeW1ib2xdOiB7IHR5cGVzOiBQcmlzbWEuVHlwZU1hcDxFeHRBcmdzPlsnb3RoZXInXSB9XG5cbiAgJG9uPFYgZXh0ZW5kcyBMb2dPcHRzPihldmVudFR5cGU6IFYsIGNhbGxiYWNrOiAoZXZlbnQ6IFYgZXh0ZW5kcyAncXVlcnknID8gUHJpc21hLlF1ZXJ5RXZlbnQgOiBQcmlzbWEuTG9nRXZlbnQpID0+IHZvaWQpOiBQcmlzbWFDbGllbnQ7XG5cbiAgLyoqXG4gICAqIENvbm5lY3Qgd2l0aCB0aGUgZGF0YWJhc2VcbiAgICovXG4gICRjb25uZWN0KCk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPHZvaWQ+O1xuXG4gIC8qKlxuICAgKiBEaXNjb25uZWN0IGZyb20gdGhlIGRhdGFiYXNlXG4gICAqL1xuICAkZGlzY29ubmVjdCgpOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTx2b2lkPjtcblxuLyoqXG4gICAqIEV4ZWN1dGVzIGEgcHJlcGFyZWQgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWQgcm93cy5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kZXhlY3V0ZVJhd2BVUERBVEUgVXNlciBTRVQgY29vbCA9ICR7dHJ1ZX0gV0hFUkUgZW1haWwgPSAkeyd1c2VyQGVtYWlsLmNvbSd9O2BcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRleGVjdXRlUmF3PFQgPSB1bmtub3duPihxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBQcmlzbWEuU3FsLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8bnVtYmVyPjtcblxuICAvKipcbiAgICogRXhlY3V0ZXMgYSByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIG51bWJlciBvZiBhZmZlY3RlZCByb3dzLlxuICAgKiBTdXNjZXB0aWJsZSB0byBTUUwgaW5qZWN0aW9ucywgc2VlIGRvY3VtZW50YXRpb24uXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJGV4ZWN1dGVSYXdVbnNhZmUoJ1VQREFURSBVc2VyIFNFVCBjb29sID0gJDEgV0hFUkUgZW1haWwgPSAkMiA7JywgdHJ1ZSwgJ3VzZXJAZW1haWwuY29tJylcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRleGVjdXRlUmF3VW5zYWZlPFQgPSB1bmtub3duPihxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8bnVtYmVyPjtcblxuICAvKipcbiAgICogUGVyZm9ybXMgYSBwcmVwYXJlZCByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIGBTRUxFQ1RgIGRhdGEuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3YFNFTEVDVCAqIEZST00gVXNlciBXSEVSRSBpZCA9ICR7MX0gT1IgZW1haWwgPSAkeyd1c2VyQGVtYWlsLmNvbSd9O2BcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRxdWVyeVJhdzxUID0gdW5rbm93bj4ocXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgUHJpc21hLlNxbCwgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPFQ+O1xuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBhIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgYFNFTEVDVGAgZGF0YS5cbiAgICogU3VzY2VwdGlibGUgdG8gU1FMIGluamVjdGlvbnMsIHNlZSBkb2N1bWVudGF0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRxdWVyeVJhd1Vuc2FmZSgnU0VMRUNUICogRlJPTSBVc2VyIFdIRVJFIGlkID0gJDEgT1IgZW1haWwgPSAkMjsnLCAxLCAndXNlckBlbWFpbC5jb20nKVxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJHF1ZXJ5UmF3VW5zYWZlPFQgPSB1bmtub3duPihxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8VD47XG5cblxuICAvKipcbiAgICogQWxsb3dzIHRoZSBydW5uaW5nIG9mIGEgc2VxdWVuY2Ugb2YgcmVhZC93cml0ZSBvcGVyYXRpb25zIHRoYXQgYXJlIGd1YXJhbnRlZWQgdG8gZWl0aGVyIHN1Y2NlZWQgb3IgZmFpbCBhcyBhIHdob2xlLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgW2dlb3JnZSwgYm9iLCBhbGljZV0gPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKFtcbiAgICogICBwcmlzbWEudXNlci5jcmVhdGUoeyBkYXRhOiB7IG5hbWU6ICdHZW9yZ2UnIH0gfSksXG4gICAqICAgcHJpc21hLnVzZXIuY3JlYXRlKHsgZGF0YTogeyBuYW1lOiAnQm9iJyB9IH0pLFxuICAgKiAgIHByaXNtYS51c2VyLmNyZWF0ZSh7IGRhdGE6IHsgbmFtZTogJ0FsaWNlJyB9IH0pLFxuICAgKiBdKVxuICAgKiBgYGBcbiAgICogXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vd3d3LnByaXNtYS5pby9kb2NzL29ybS9wcmlzbWEtY2xpZW50L3F1ZXJpZXMvdHJhbnNhY3Rpb25zKS5cbiAgICovXG4gICR0cmFuc2FjdGlvbjxQIGV4dGVuZHMgUHJpc21hLlByaXNtYVByb21pc2U8YW55PltdPihhcmc6IFsuLi5QXSwgb3B0aW9ucz86IHsgbWF4V2FpdD86IG51bWJlciwgdGltZW91dD86IG51bWJlciwgaXNvbGF0aW9uTGV2ZWw/OiBQcmlzbWEuVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCB9KTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8cnVudGltZS5UeXBlcy5VdGlscy5VbndyYXBUdXBsZTxQPj5cblxuICAkdHJhbnNhY3Rpb248Uj4oZm46IChwcmlzbWE6IE9taXQ8UHJpc21hQ2xpZW50LCBydW50aW1lLklUWENsaWVudERlbnlMaXN0PikgPT4gcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8Uj4sIG9wdGlvbnM/OiB7IG1heFdhaXQ/OiBudW1iZXIsIHRpbWVvdXQ/OiBudW1iZXIsIGlzb2xhdGlvbkxldmVsPzogUHJpc21hLlRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgfSk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPFI+XG5cbiAgJGV4dGVuZHM6IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5FeHRlbmRzSG9vazxcImV4dGVuZHNcIiwgUHJpc21hLlR5cGVNYXBDYjxPbWl0T3B0cz4sIEV4dEFyZ3MsIHJ1bnRpbWUuVHlwZXMuVXRpbHMuQ2FsbDxQcmlzbWEuVHlwZU1hcENiPE9taXRPcHRzPiwge1xuICAgIGV4dEFyZ3M6IEV4dEFyZ3NcbiAgfT4+XG5cbiAgICAgIC8qKlxuICAgKiBgcHJpc21hLmJsb2dQb3N0YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkJsb2dQb3N0KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nUG9zdHNcbiAgICAqIGNvbnN0IGJsb2dQb3N0cyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgYmxvZ1Bvc3QoKTogUHJpc21hLkJsb2dQb3N0RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5ib29raW5nYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkJvb2tpbmcqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJvb2tpbmdzXG4gICAgKiBjb25zdCBib29raW5ncyA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBib29raW5nKCk6IFByaXNtYS5Cb29raW5nRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5jYXRlZ29yeWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipDYXRlZ29yeSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQ2F0ZWdvcmllc1xuICAgICogY29uc3QgY2F0ZWdvcmllcyA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgY2F0ZWdvcnkoKTogUHJpc21hLkNhdGVnb3J5RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5jb250YWN0TWVzc2FnZWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipDb250YWN0TWVzc2FnZSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQ29udGFjdE1lc3NhZ2VzXG4gICAgKiBjb25zdCBjb250YWN0TWVzc2FnZXMgPSBhd2FpdCBwcmlzbWEuY29udGFjdE1lc3NhZ2UuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGNvbnRhY3RNZXNzYWdlKCk6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEubm90aWZpY2F0aW9uYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKk5vdGlmaWNhdGlvbioqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgTm90aWZpY2F0aW9uc1xuICAgICogY29uc3Qgbm90aWZpY2F0aW9ucyA9IGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24uZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IG5vdGlmaWNhdGlvbigpOiBQcmlzbWEuTm90aWZpY2F0aW9uRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5wYXltZW50YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlBheW1lbnQqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFBheW1lbnRzXG4gICAgKiBjb25zdCBwYXltZW50cyA9IGF3YWl0IHByaXNtYS5wYXltZW50LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBwYXltZW50KCk6IFByaXNtYS5QYXltZW50RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5yZXZpZXdgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqUmV2aWV3KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBSZXZpZXdzXG4gICAgKiBjb25zdCByZXZpZXdzID0gYXdhaXQgcHJpc21hLnJldmlldy5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgcmV2aWV3KCk6IFByaXNtYS5SZXZpZXdEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnRvdXJQYWNrYWdlYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlRvdXJQYWNrYWdlKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBUb3VyUGFja2FnZXNcbiAgICAqIGNvbnN0IHRvdXJQYWNrYWdlcyA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgdG91clBhY2thZ2UoKTogUHJpc21hLlRvdXJQYWNrYWdlRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS51c2VyYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlVzZXIqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFVzZXJzXG4gICAgKiBjb25zdCB1c2VycyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCB1c2VyKCk6IFByaXNtYS5Vc2VyRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS53aXNobGlzdEl0ZW1gOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqV2lzaGxpc3RJdGVtKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBXaXNobGlzdEl0ZW1zXG4gICAgKiBjb25zdCB3aXNobGlzdEl0ZW1zID0gYXdhaXQgcHJpc21hLndpc2hsaXN0SXRlbS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgd2lzaGxpc3RJdGVtKCk6IFByaXNtYS5XaXNobGlzdEl0ZW1EZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJpc21hQ2xpZW50Q2xhc3MoKTogUHJpc21hQ2xpZW50Q29uc3RydWN0b3Ige1xuICByZXR1cm4gcnVudGltZS5nZXRQcmlzbWFDbGllbnQoY29uZmlnKSBhcyB1bmtub3duIGFzIFByaXNtYUNsaWVudENvbnN0cnVjdG9yXG59XG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4gKiBXQVJOSU5HOiBUaGlzIGlzIGFuIGludGVybmFsIGZpbGUgdGhhdCBpcyBzdWJqZWN0IHRvIGNoYW5nZSFcbiAqXG4gKiBcdUQ4M0RcdURFRDEgVW5kZXIgbm8gY2lyY3Vtc3RhbmNlcyBzaG91bGQgeW91IGltcG9ydCB0aGlzIGZpbGUgZGlyZWN0bHkhIFx1RDgzRFx1REVEMVxuICpcbiAqIEFsbCBleHBvcnRzIGZyb20gdGhpcyBmaWxlIGFyZSB3cmFwcGVkIHVuZGVyIGEgYFByaXNtYWAgbmFtZXNwYWNlIG9iamVjdCBpbiB0aGUgY2xpZW50LnRzIGZpbGUuXG4gKiBXaGlsZSB0aGlzIGVuYWJsZXMgcGFydGlhbCBiYWNrd2FyZCBjb21wYXRpYmlsaXR5LCBpdCBpcyBub3QgcGFydCBvZiB0aGUgc3RhYmxlIHB1YmxpYyBBUEkuXG4gKlxuICogSWYgeW91IGFyZSBsb29raW5nIGZvciB5b3VyIE1vZGVscywgRW51bXMsIGFuZCBJbnB1dCBUeXBlcywgcGxlYXNlIGltcG9ydCB0aGVtIGZyb20gdGhlIHJlc3BlY3RpdmVcbiAqIG1vZGVsIGZpbGVzIGluIHRoZSBgbW9kZWxgIGRpcmVjdG9yeSFcbiAqL1xuXG5pbXBvcnQgKiBhcyBydW50aW1lIGZyb20gXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL2NsaWVudFwiXG5pbXBvcnQgdHlwZSAqIGFzIFByaXNtYSBmcm9tIFwiLi4vbW9kZWxzXCJcbmltcG9ydCB7IHR5cGUgUHJpc21hQ2xpZW50IH0gZnJvbSBcIi4vY2xhc3NcIlxuXG5leHBvcnQgdHlwZSAqIGZyb20gJy4uL21vZGVscydcblxuZXhwb3J0IHR5cGUgRE1NRiA9IHR5cGVvZiBydW50aW1lLkRNTUZcblxuZXhwb3J0IHR5cGUgUHJpc21hUHJvbWlzZTxUPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLlByaXNtYVByb21pc2U8VD5cblxuLyoqXG4gKiBQcmlzbWEgRXJyb3JzXG4gKi9cblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yXG5cbi8qKlxuICogUmUtZXhwb3J0IG9mIHNxbC10ZW1wbGF0ZS10YWdcbiAqL1xuZXhwb3J0IGNvbnN0IHNxbCA9IHJ1bnRpbWUuc3FsdGFnXG5leHBvcnQgY29uc3QgZW1wdHkgPSBydW50aW1lLmVtcHR5XG5leHBvcnQgY29uc3Qgam9pbiA9IHJ1bnRpbWUuam9pblxuZXhwb3J0IGNvbnN0IHJhdyA9IHJ1bnRpbWUucmF3XG5leHBvcnQgY29uc3QgU3FsID0gcnVudGltZS5TcWxcbmV4cG9ydCB0eXBlIFNxbCA9IHJ1bnRpbWUuU3FsXG5cblxuXG4vKipcbiAqIERlY2ltYWwuanNcbiAqL1xuZXhwb3J0IGNvbnN0IERlY2ltYWwgPSBydW50aW1lLkRlY2ltYWxcbmV4cG9ydCB0eXBlIERlY2ltYWwgPSBydW50aW1lLkRlY2ltYWxcblxuZXhwb3J0IHR5cGUgRGVjaW1hbEpzTGlrZSA9IHJ1bnRpbWUuRGVjaW1hbEpzTGlrZVxuXG4vKipcbiogRXh0ZW5zaW9uc1xuKi9cbmV4cG9ydCB0eXBlIEV4dGVuc2lvbiA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5Vc2VyQXJnc1xuZXhwb3J0IGNvbnN0IGdldEV4dGVuc2lvbkNvbnRleHQgPSBydW50aW1lLkV4dGVuc2lvbnMuZ2V0RXh0ZW5zaW9uQ29udGV4dFxuZXhwb3J0IHR5cGUgQXJnczxULCBGIGV4dGVuZHMgcnVudGltZS5PcGVyYXRpb24+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuQXJnczxULCBGPlxuZXhwb3J0IHR5cGUgUGF5bG9hZDxULCBGIGV4dGVuZHMgcnVudGltZS5PcGVyYXRpb24gPSBuZXZlcj4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5QYXlsb2FkPFQsIEY+XG5leHBvcnQgdHlwZSBSZXN1bHQ8VCwgQSwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLlJlc3VsdDxULCBBLCBGPlxuZXhwb3J0IHR5cGUgRXhhY3Q8QSwgVz4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5FeGFjdDxBLCBXPlxuXG5leHBvcnQgdHlwZSBQcmlzbWFWZXJzaW9uID0ge1xuICBjbGllbnQ6IHN0cmluZ1xuICBlbmdpbmU6IHN0cmluZ1xufVxuXG4vKipcbiAqIFByaXNtYSBDbGllbnQgSlMgdmVyc2lvbjogNy45LjFcbiAqIFF1ZXJ5IEVuZ2luZSB2ZXJzaW9uOiBlOTIyMDg5YjdkNzUwMmFmZjQyNDlkNWRhMzQyMGY2ZmE1NWZjNmFkXG4gKi9cbmV4cG9ydCBjb25zdCBwcmlzbWFWZXJzaW9uOiBQcmlzbWFWZXJzaW9uID0ge1xuICBjbGllbnQ6IFwiNy45LjFcIixcbiAgZW5naW5lOiBcImU5MjIwODliN2Q3NTAyYWZmNDI0OWQ1ZGEzNDIwZjZmYTU1ZmM2YWRcIlxufVxuXG4vKipcbiAqIFV0aWxpdHkgVHlwZXNcbiAqL1xuXG5leHBvcnQgdHlwZSBCeXRlcyA9IHJ1bnRpbWUuQnl0ZXNcbmV4cG9ydCB0eXBlIEpzb25PYmplY3QgPSBydW50aW1lLkpzb25PYmplY3RcbmV4cG9ydCB0eXBlIEpzb25BcnJheSA9IHJ1bnRpbWUuSnNvbkFycmF5XG5leHBvcnQgdHlwZSBKc29uVmFsdWUgPSBydW50aW1lLkpzb25WYWx1ZVxuZXhwb3J0IHR5cGUgSW5wdXRKc29uT2JqZWN0ID0gcnVudGltZS5JbnB1dEpzb25PYmplY3RcbmV4cG9ydCB0eXBlIElucHV0SnNvbkFycmF5ID0gcnVudGltZS5JbnB1dEpzb25BcnJheVxuZXhwb3J0IHR5cGUgSW5wdXRKc29uVmFsdWUgPSBydW50aW1lLklucHV0SnNvblZhbHVlXG5cblxuZXhwb3J0IGNvbnN0IE51bGxUeXBlcyA9IHtcbiAgRGJOdWxsOiBydW50aW1lLk51bGxUeXBlcy5EYk51bGwgYXMgKG5ldyAoc2VjcmV0OiBuZXZlcikgPT4gdHlwZW9mIHJ1bnRpbWUuRGJOdWxsKSxcbiAgSnNvbk51bGw6IHJ1bnRpbWUuTnVsbFR5cGVzLkpzb25OdWxsIGFzIChuZXcgKHNlY3JldDogbmV2ZXIpID0+IHR5cGVvZiBydW50aW1lLkpzb25OdWxsKSxcbiAgQW55TnVsbDogcnVudGltZS5OdWxsVHlwZXMuQW55TnVsbCBhcyAobmV3IChzZWNyZXQ6IG5ldmVyKSA9PiB0eXBlb2YgcnVudGltZS5BbnlOdWxsKSxcbn1cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgaGF2ZSBgbnVsbGAgb24gdGhlIGRhdGFiYXNlIChlbXB0eSBvbiB0aGUgZGIpXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgRGJOdWxsID0gcnVudGltZS5EYk51bGxcblxuLyoqXG4gKiBIZWxwZXIgZm9yIGZpbHRlcmluZyBKU09OIGVudHJpZXMgdGhhdCBoYXZlIEpTT04gYG51bGxgIHZhbHVlcyAobm90IGVtcHR5IG9uIHRoZSBkYilcbiAqXG4gKiBAc2VlIGh0dHBzOi8vd3d3LnByaXNtYS5pby9kb2NzL2NvbmNlcHRzL2NvbXBvbmVudHMvcHJpc21hLWNsaWVudC93b3JraW5nLXdpdGgtZmllbGRzL3dvcmtpbmctd2l0aC1qc29uLWZpZWxkcyNmaWx0ZXJpbmctb24tYS1qc29uLWZpZWxkXG4gKi9cbmV4cG9ydCBjb25zdCBKc29uTnVsbCA9IHJ1bnRpbWUuSnNvbk51bGxcblxuLyoqXG4gKiBIZWxwZXIgZm9yIGZpbHRlcmluZyBKU09OIGVudHJpZXMgdGhhdCBhcmUgYFByaXNtYS5EYk51bGxgIG9yIGBQcmlzbWEuSnNvbk51bGxgXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgQW55TnVsbCA9IHJ1bnRpbWUuQW55TnVsbFxuXG5cbnR5cGUgU2VsZWN0QW5kSW5jbHVkZSA9IHtcbiAgc2VsZWN0OiBhbnlcbiAgaW5jbHVkZTogYW55XG59XG5cbnR5cGUgU2VsZWN0QW5kT21pdCA9IHtcbiAgc2VsZWN0OiBhbnlcbiAgb21pdDogYW55XG59XG5cbi8qKlxuICogRnJvbSBULCBwaWNrIGEgc2V0IG9mIHByb3BlcnRpZXMgd2hvc2Uga2V5cyBhcmUgaW4gdGhlIHVuaW9uIEtcbiAqL1xudHlwZSBQcmlzbWFfX1BpY2s8VCwgSyBleHRlbmRzIGtleW9mIFQ+ID0ge1xuICAgIFtQIGluIEtdOiBUW1BdO1xufTtcblxuZXhwb3J0IHR5cGUgRW51bWVyYWJsZTxUPiA9IFQgfCBBcnJheTxUPjtcblxuLyoqXG4gKiBTdWJzZXRcbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYC4gU2ltcGxlIHZlcnNpb24gb2YgSW50ZXJzZWN0aW9uXG4gKi9cbmV4cG9ydCB0eXBlIFN1YnNldDxULCBVPiA9IHtcbiAgW2tleSBpbiBrZXlvZiBUXToga2V5IGV4dGVuZHMga2V5b2YgVSA/IFRba2V5XSA6IG5ldmVyO1xufTtcblxuLyoqXG4gKiBSZXNvbHZlZCB0eXBlIG9mIHRoZSBhcmd1bWVudCBwYXNzZWQgdG8gdGhlIGBQcmlzbWFDbGllbnRgIGNvbnN0cnVjdG9yLlxuICpcbiAqIFdoZW4gY2FsbGVkIHdpdGhvdXQgYSBuYXJyb3dlciBvcHRpb25zIHR5cGUgKHRoZSBjb21tb24gY2FzZSksIHRoaXMgcmVzb2x2ZXNcbiAqIHRvIGBQcmlzbWFDbGllbnRPcHRpb25zYCBkaXJlY3RseSwgd2hpY2ggcHJvZHVjZXMgYSBjbGVhciBUeXBlU2NyaXB0IGVycm9yXG4gKiBtZXNzYWdlIChgbm90IGFzc2lnbmFibGUgdG8gcGFyYW1ldGVyIG9mIHR5cGUgJ1ByaXNtYUNsaWVudE9wdGlvbnMnYCkgd2hlblxuICogdGhlIGFyZ3VtZW50IGlzIG1pc3Npbmcgb3IgaW5jb21wbGV0ZS4gV2hlbiB0aGUgdXNlciBzdXBwbGllcyBhIG5hcnJvd2VyXG4gKiBvcHRpb25zIHR5cGUgKGUuZy4gdmlhIGEgbGl0ZXJhbCksIGl0IGZhbGxzIGJhY2sgdG8gYFN1YnNldGAgdG8ga2VlcFxuICogZmlsdGVyaW5nIG91dCB1bmtub3duIHByb3BlcnRpZXMuXG4gKi9cbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudENvbnN0cnVjdG9yQXJnczxPcHRpb25zIGV4dGVuZHMgUHJpc21hQ2xpZW50T3B0aW9ucz4gPVxuICBbUHJpc21hQ2xpZW50T3B0aW9uc10gZXh0ZW5kcyBbT3B0aW9uc10gPyBQcmlzbWFDbGllbnRPcHRpb25zIDogU3Vic2V0PE9wdGlvbnMsIFByaXNtYUNsaWVudE9wdGlvbnM+O1xuXG4vKipcbiAqIFNlbGVjdFN1YnNldFxuICogQGRlc2MgRnJvbSBgVGAgcGljayBwcm9wZXJ0aWVzIHRoYXQgZXhpc3QgaW4gYFVgLiBTaW1wbGUgdmVyc2lvbiBvZiBJbnRlcnNlY3Rpb24uXG4gKiBBZGRpdGlvbmFsbHksIGl0IHZhbGlkYXRlcywgaWYgYm90aCBzZWxlY3QgYW5kIGluY2x1ZGUgYXJlIHByZXNlbnQuIElmIHRoZSBjYXNlLCBpdCBlcnJvcnMuXG4gKi9cbmV4cG9ydCB0eXBlIFNlbGVjdFN1YnNldDxULCBVPiA9IHtcbiAgW2tleSBpbiBrZXlvZiBUXToga2V5IGV4dGVuZHMga2V5b2YgVSA/IFRba2V5XSA6IG5ldmVyXG59ICZcbiAgKFQgZXh0ZW5kcyBTZWxlY3RBbmRJbmNsdWRlXG4gICAgPyAnUGxlYXNlIGVpdGhlciBjaG9vc2UgYHNlbGVjdGAgb3IgYGluY2x1ZGVgLidcbiAgICA6IFQgZXh0ZW5kcyBTZWxlY3RBbmRPbWl0XG4gICAgICA/ICdQbGVhc2UgZWl0aGVyIGNob29zZSBgc2VsZWN0YCBvciBgb21pdGAuJ1xuICAgICAgOiB7fSlcblxuLyoqXG4gKiBTdWJzZXQgKyBJbnRlcnNlY3Rpb25cbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYCBhbmQgaW50ZXJzZWN0IGBLYFxuICovXG5leHBvcnQgdHlwZSBTdWJzZXRJbnRlcnNlY3Rpb248VCwgVSwgSz4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlclxufSAmXG4gIEtcblxudHlwZSBXaXRob3V0PFQsIFU+ID0geyBbUCBpbiBFeGNsdWRlPGtleW9mIFQsIGtleW9mIFU+XT86IG5ldmVyIH07XG5cbi8qKlxuICogWE9SIGlzIG5lZWRlZCB0byBoYXZlIGEgcmVhbCBtdXR1YWxseSBleGNsdXNpdmUgdW5pb24gdHlwZVxuICogaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNDIxMjM0MDcvZG9lcy10eXBlc2NyaXB0LXN1cHBvcnQtbXV0dWFsbHktZXhjbHVzaXZlLXR5cGVzXG4gKi9cbmV4cG9ydCB0eXBlIFhPUjxULCBVPiA9XG4gIFQgZXh0ZW5kcyBvYmplY3QgP1xuICBVIGV4dGVuZHMgb2JqZWN0ID9cbiAgICAoKFdpdGhvdXQ8VCwgVT4gJiBVKSB8IChXaXRob3V0PFUsIFQ+ICYgVCkpICYgb2JqZWN0XG4gIDogVSA6IFRcblxuXG4vKipcbiAqIElzIFQgYSBSZWNvcmQ/XG4gKi9cbnR5cGUgSXNPYmplY3Q8VCBleHRlbmRzIGFueT4gPSBUIGV4dGVuZHMgQXJyYXk8YW55PlxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgRGF0ZVxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgVWludDhBcnJheVxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgQmlnSW50XG4/IEZhbHNlXG46IFQgZXh0ZW5kcyBvYmplY3Rcbj8gVHJ1ZVxuOiBGYWxzZVxuXG5cbi8qKlxuICogSWYgaXQncyBUW10sIHJldHVybiBUXG4gKi9cbmV4cG9ydCB0eXBlIFVuRW51bWVyYXRlPFQgZXh0ZW5kcyB1bmtub3duPiA9IFQgZXh0ZW5kcyBBcnJheTxpbmZlciBVPiA/IFUgOiBUXG5cbi8qKlxuICogRnJvbSB0cy10b29sYmVsdFxuICovXG5cbnR5cGUgX19FaXRoZXI8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBPbWl0PE8sIEs+ICZcbiAge1xuICAgIC8vIE1lcmdlIGFsbCBidXQgS1xuICAgIFtQIGluIEtdOiBQcmlzbWFfX1BpY2s8TywgUCAmIGtleW9mIE8+IC8vIFdpdGggSyBwb3NzaWJpbGl0aWVzXG4gIH1bS11cblxudHlwZSBFaXRoZXJTdHJpY3Q8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBTdHJpY3Q8X19FaXRoZXI8TywgSz4+XG5cbnR5cGUgRWl0aGVyTG9vc2U8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBDb21wdXRlUmF3PF9fRWl0aGVyPE8sIEs+PlxuXG50eXBlIF9FaXRoZXI8XG4gIE8gZXh0ZW5kcyBvYmplY3QsXG4gIEsgZXh0ZW5kcyBLZXksXG4gIHN0cmljdCBleHRlbmRzIEJvb2xlYW5cbj4gPSB7XG4gIDE6IEVpdGhlclN0cmljdDxPLCBLPlxuICAwOiBFaXRoZXJMb29zZTxPLCBLPlxufVtzdHJpY3RdXG5cbmV4cG9ydCB0eXBlIEVpdGhlcjxcbiAgTyBleHRlbmRzIG9iamVjdCxcbiAgSyBleHRlbmRzIEtleSxcbiAgc3RyaWN0IGV4dGVuZHMgQm9vbGVhbiA9IDFcbj4gPSBPIGV4dGVuZHMgdW5rbm93biA/IF9FaXRoZXI8TywgSywgc3RyaWN0PiA6IG5ldmVyXG5cbmV4cG9ydCB0eXBlIFVuaW9uID0gYW55XG5cbmV4cG9ydCB0eXBlIFBhdGNoVW5kZWZpbmVkPE8gZXh0ZW5kcyBvYmplY3QsIE8xIGV4dGVuZHMgb2JqZWN0PiA9IHtcbiAgW0sgaW4ga2V5b2YgT106IE9bS10gZXh0ZW5kcyB1bmRlZmluZWQgPyBBdDxPMSwgSz4gOiBPW0tdXG59ICYge31cblxuLyoqIEhlbHBlciBUeXBlcyBmb3IgXCJNZXJnZVwiICoqL1xuZXhwb3J0IHR5cGUgSW50ZXJzZWN0T2Y8VSBleHRlbmRzIFVuaW9uPiA9IChcbiAgVSBleHRlbmRzIHVua25vd24gPyAoazogVSkgPT4gdm9pZCA6IG5ldmVyXG4pIGV4dGVuZHMgKGs6IGluZmVyIEkpID0+IHZvaWRcbiAgPyBJXG4gIDogbmV2ZXJcblxuZXhwb3J0IHR5cGUgT3ZlcndyaXRlPE8gZXh0ZW5kcyBvYmplY3QsIE8xIGV4dGVuZHMgb2JqZWN0PiA9IHtcbiAgICBbSyBpbiBrZXlvZiBPXTogSyBleHRlbmRzIGtleW9mIE8xID8gTzFbS10gOiBPW0tdO1xufSAmIHt9O1xuXG50eXBlIF9NZXJnZTxVIGV4dGVuZHMgb2JqZWN0PiA9IEludGVyc2VjdE9mPE92ZXJ3cml0ZTxVLCB7XG4gICAgW0sgaW4ga2V5b2YgVV0tPzogQXQ8VSwgSz47XG59Pj47XG5cbnR5cGUgS2V5ID0gc3RyaW5nIHwgbnVtYmVyIHwgc3ltYm9sO1xudHlwZSBBdFN0cmljdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IE9bSyAmIGtleW9mIE9dO1xudHlwZSBBdExvb3NlPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gTyBleHRlbmRzIHVua25vd24gPyBBdFN0cmljdDxPLCBLPiA6IG5ldmVyO1xuZXhwb3J0IHR5cGUgQXQ8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleSwgc3RyaWN0IGV4dGVuZHMgQm9vbGVhbiA9IDE+ID0ge1xuICAgIDE6IEF0U3RyaWN0PE8sIEs+O1xuICAgIDA6IEF0TG9vc2U8TywgSz47XG59W3N0cmljdF07XG5cbmV4cG9ydCB0eXBlIENvbXB1dGVSYXc8QSBleHRlbmRzIGFueT4gPSBBIGV4dGVuZHMgRnVuY3Rpb24gPyBBIDoge1xuICBbSyBpbiBrZXlvZiBBXTogQVtLXTtcbn0gJiB7fTtcblxuZXhwb3J0IHR5cGUgT3B0aW9uYWxGbGF0PE8+ID0ge1xuICBbSyBpbiBrZXlvZiBPXT86IE9bS107XG59ICYge307XG5cbnR5cGUgX1JlY29yZDxLIGV4dGVuZHMga2V5b2YgYW55LCBUPiA9IHtcbiAgW1AgaW4gS106IFQ7XG59O1xuXG4vLyBjYXVzZSB0eXBlc2NyaXB0IG5vdCB0byBleHBhbmQgdHlwZXMgYW5kIHByZXNlcnZlIG5hbWVzXG50eXBlIE5vRXhwYW5kPFQ+ID0gVCBleHRlbmRzIHVua25vd24gPyBUIDogbmV2ZXI7XG5cbi8vIHRoaXMgdHlwZSBhc3N1bWVzIHRoZSBwYXNzZWQgb2JqZWN0IGlzIGVudGlyZWx5IG9wdGlvbmFsXG5leHBvcnQgdHlwZSBBdExlYXN0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBzdHJpbmc+ID0gTm9FeHBhbmQ8XG4gIE8gZXh0ZW5kcyB1bmtub3duXG4gID8gfCAoSyBleHRlbmRzIGtleW9mIE8gPyB7IFtQIGluIEtdOiBPW1BdIH0gJiBPIDogTylcbiAgICB8IHtbUCBpbiBrZXlvZiBPIGFzIFAgZXh0ZW5kcyBLID8gUCA6IG5ldmVyXS0/OiBPW1BdfSAmIE9cbiAgOiBuZXZlcj47XG5cbnR5cGUgX1N0cmljdDxVLCBfVSA9IFU+ID0gVSBleHRlbmRzIHVua25vd24gPyBVICYgT3B0aW9uYWxGbGF0PF9SZWNvcmQ8RXhjbHVkZTxLZXlzPF9VPiwga2V5b2YgVT4sIG5ldmVyPj4gOiBuZXZlcjtcblxuZXhwb3J0IHR5cGUgU3RyaWN0PFUgZXh0ZW5kcyBvYmplY3Q+ID0gQ29tcHV0ZVJhdzxfU3RyaWN0PFU+Pjtcbi8qKiBFbmQgSGVscGVyIFR5cGVzIGZvciBcIk1lcmdlXCIgKiovXG5cbmV4cG9ydCB0eXBlIE1lcmdlPFUgZXh0ZW5kcyBvYmplY3Q+ID0gQ29tcHV0ZVJhdzxfTWVyZ2U8U3RyaWN0PFU+Pj47XG5cbmV4cG9ydCB0eXBlIEJvb2xlYW4gPSBUcnVlIHwgRmFsc2VcblxuZXhwb3J0IHR5cGUgVHJ1ZSA9IDFcblxuZXhwb3J0IHR5cGUgRmFsc2UgPSAwXG5cbmV4cG9ydCB0eXBlIE5vdDxCIGV4dGVuZHMgQm9vbGVhbj4gPSB7XG4gIDA6IDFcbiAgMTogMFxufVtCXVxuXG5leHBvcnQgdHlwZSBFeHRlbmRzPEExIGV4dGVuZHMgYW55LCBBMiBleHRlbmRzIGFueT4gPSBbQTFdIGV4dGVuZHMgW25ldmVyXVxuICA/IDAgLy8gYW55dGhpbmcgYG5ldmVyYCBpcyBmYWxzZVxuICA6IEExIGV4dGVuZHMgQTJcbiAgPyAxXG4gIDogMFxuXG5leHBvcnQgdHlwZSBIYXM8VSBleHRlbmRzIFVuaW9uLCBVMSBleHRlbmRzIFVuaW9uPiA9IE5vdDxcbiAgRXh0ZW5kczxFeGNsdWRlPFUxLCBVPiwgVTE+XG4+XG5cbmV4cG9ydCB0eXBlIE9yPEIxIGV4dGVuZHMgQm9vbGVhbiwgQjIgZXh0ZW5kcyBCb29sZWFuPiA9IHtcbiAgMDoge1xuICAgIDA6IDBcbiAgICAxOiAxXG4gIH1cbiAgMToge1xuICAgIDA6IDFcbiAgICAxOiAxXG4gIH1cbn1bQjFdW0IyXVxuXG5leHBvcnQgdHlwZSBLZXlzPFUgZXh0ZW5kcyBVbmlvbj4gPSBVIGV4dGVuZHMgdW5rbm93biA/IGtleW9mIFUgOiBuZXZlclxuXG5leHBvcnQgdHlwZSBHZXRTY2FsYXJUeXBlPFQsIE8+ID0gTyBleHRlbmRzIG9iamVjdCA/IHtcbiAgW1AgaW4ga2V5b2YgVF06IFAgZXh0ZW5kcyBrZXlvZiBPXG4gICAgPyBPW1BdXG4gICAgOiBuZXZlclxufSA6IG5ldmVyXG5cbnR5cGUgRmllbGRQYXRoczxcbiAgVCxcbiAgVSA9IE9taXQ8VCwgJ19hdmcnIHwgJ19zdW0nIHwgJ19jb3VudCcgfCAnX21pbicgfCAnX21heCc+XG4+ID0gSXNPYmplY3Q8VD4gZXh0ZW5kcyBUcnVlID8gVSA6IFRcblxuZXhwb3J0IHR5cGUgR2V0SGF2aW5nRmllbGRzPFQ+ID0ge1xuICBbSyBpbiBrZXlvZiBUXTogT3I8XG4gICAgT3I8RXh0ZW5kczwnT1InLCBLPiwgRXh0ZW5kczwnQU5EJywgSz4+LFxuICAgIEV4dGVuZHM8J05PVCcsIEs+XG4gID4gZXh0ZW5kcyBUcnVlXG4gICAgPyAvLyBpbmZlciBpcyBvbmx5IG5lZWRlZCB0byBub3QgaGl0IFRTIGxpbWl0XG4gICAgICAvLyBiYXNlZCBvbiB0aGUgYnJpbGxpYW50IGlkZWEgb2YgUGllcnJlLUFudG9pbmUgTWlsbHNcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvMzAxODgjaXNzdWVjb21tZW50LTQ3ODkzODQzN1xuICAgICAgVFtLXSBleHRlbmRzIGluZmVyIFRLXG4gICAgICA/IEdldEhhdmluZ0ZpZWxkczxVbkVudW1lcmF0ZTxUSz4gZXh0ZW5kcyBvYmplY3QgPyBNZXJnZTxVbkVudW1lcmF0ZTxUSz4+IDogbmV2ZXI+XG4gICAgICA6IG5ldmVyXG4gICAgOiB7fSBleHRlbmRzIEZpZWxkUGF0aHM8VFtLXT5cbiAgICA/IG5ldmVyXG4gICAgOiBLXG59W2tleW9mIFRdXG5cbi8qKlxuICogQ29udmVydCB0dXBsZSB0byB1bmlvblxuICovXG50eXBlIF9UdXBsZVRvVW5pb248VD4gPSBUIGV4dGVuZHMgKGluZmVyIEUpW10gPyBFIDogbmV2ZXJcbnR5cGUgVHVwbGVUb1VuaW9uPEsgZXh0ZW5kcyByZWFkb25seSBhbnlbXT4gPSBfVHVwbGVUb1VuaW9uPEs+XG5leHBvcnQgdHlwZSBNYXliZVR1cGxlVG9VbmlvbjxUPiA9IFQgZXh0ZW5kcyBhbnlbXSA/IFR1cGxlVG9VbmlvbjxUPiA6IFRcblxuLyoqXG4gKiBMaWtlIGBQaWNrYCwgYnV0IGFkZGl0aW9uYWxseSBjYW4gYWxzbyBhY2NlcHQgYW4gYXJyYXkgb2Yga2V5c1xuICovXG5leHBvcnQgdHlwZSBQaWNrRW51bWVyYWJsZTxULCBLIGV4dGVuZHMgRW51bWVyYWJsZTxrZXlvZiBUPiB8IGtleW9mIFQ+ID0gUHJpc21hX19QaWNrPFQsIE1heWJlVHVwbGVUb1VuaW9uPEs+PlxuXG4vKipcbiAqIEV4Y2x1ZGUgYWxsIGtleXMgd2l0aCB1bmRlcnNjb3Jlc1xuICovXG5leHBvcnQgdHlwZSBFeGNsdWRlVW5kZXJzY29yZUtleXM8VCBleHRlbmRzIHN0cmluZz4gPSBUIGV4dGVuZHMgYF8ke3N0cmluZ31gID8gbmV2ZXIgOiBUXG5cblxuZXhwb3J0IHR5cGUgRmllbGRSZWY8TW9kZWwsIEZpZWxkVHlwZT4gPSBydW50aW1lLkZpZWxkUmVmPE1vZGVsLCBGaWVsZFR5cGU+XG5cbnR5cGUgRmllbGRSZWZJbnB1dFR5cGU8TW9kZWwsIEZpZWxkVHlwZT4gPSBNb2RlbCBleHRlbmRzIG5ldmVyID8gbmV2ZXIgOiBGaWVsZFJlZjxNb2RlbCwgRmllbGRUeXBlPlxuXG5cbmV4cG9ydCBjb25zdCBNb2RlbE5hbWUgPSB7XG4gIEJsb2dQb3N0OiAnQmxvZ1Bvc3QnLFxuICBCb29raW5nOiAnQm9va2luZycsXG4gIENhdGVnb3J5OiAnQ2F0ZWdvcnknLFxuICBDb250YWN0TWVzc2FnZTogJ0NvbnRhY3RNZXNzYWdlJyxcbiAgTm90aWZpY2F0aW9uOiAnTm90aWZpY2F0aW9uJyxcbiAgUGF5bWVudDogJ1BheW1lbnQnLFxuICBSZXZpZXc6ICdSZXZpZXcnLFxuICBUb3VyUGFja2FnZTogJ1RvdXJQYWNrYWdlJyxcbiAgVXNlcjogJ1VzZXInLFxuICBXaXNobGlzdEl0ZW06ICdXaXNobGlzdEl0ZW0nXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE1vZGVsTmFtZSA9ICh0eXBlb2YgTW9kZWxOYW1lKVtrZXlvZiB0eXBlb2YgTW9kZWxOYW1lXVxuXG5cblxuZXhwb3J0IGludGVyZmFjZSBUeXBlTWFwQ2I8R2xvYmFsT21pdE9wdGlvbnMgPSB7fT4gZXh0ZW5kcyBydW50aW1lLlR5cGVzLlV0aWxzLkZuPHtleHRBcmdzOiBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzIH0sIHJ1bnRpbWUuVHlwZXMuVXRpbHMuUmVjb3JkPHN0cmluZywgYW55Pj4ge1xuICByZXR1cm5zOiBUeXBlTWFwPHRoaXNbJ3BhcmFtcyddWydleHRBcmdzJ10sIEdsb2JhbE9taXRPcHRpb25zPlxufVxuXG5leHBvcnQgdHlwZSBUeXBlTWFwPEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzLCBHbG9iYWxPbWl0T3B0aW9ucyA9IHt9PiA9IHtcbiAgZ2xvYmFsT21pdE9wdGlvbnM6IHtcbiAgICBvbWl0OiBHbG9iYWxPbWl0T3B0aW9uc1xuICB9XG4gIG1ldGE6IHtcbiAgICBtb2RlbFByb3BzOiBcImJsb2dQb3N0XCIgfCBcImJvb2tpbmdcIiB8IFwiY2F0ZWdvcnlcIiB8IFwiY29udGFjdE1lc3NhZ2VcIiB8IFwibm90aWZpY2F0aW9uXCIgfCBcInBheW1lbnRcIiB8IFwicmV2aWV3XCIgfCBcInRvdXJQYWNrYWdlXCIgfCBcInVzZXJcIiB8IFwid2lzaGxpc3RJdGVtXCJcbiAgICB0eElzb2xhdGlvbkxldmVsOiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsXG4gIH1cbiAgbW9kZWw6IHtcbiAgICBCbG9nUG9zdDoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRCbG9nUG9zdFBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkJsb2dQb3N0RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3REZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUJsb2dQb3N0PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQmxvZ1Bvc3RHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5CbG9nUG9zdENvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBCb29raW5nOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Cb29raW5nRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0RlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0RlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1Vwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVCb29raW5nPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0dyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Cb29raW5nR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Cb29raW5nQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIENhdGVnb3J5OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJENhdGVnb3J5UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQ2F0ZWdvcnlGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQ2F0ZWdvcnk+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5DYXRlZ29yeUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNhdGVnb3J5Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIENvbnRhY3RNZXNzYWdlOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQ29udGFjdE1lc3NhZ2U+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Db250YWN0TWVzc2FnZUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNvbnRhY3RNZXNzYWdlQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIE5vdGlmaWNhdGlvbjoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Ob3RpZmljYXRpb25GaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25GaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25GaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25EZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvblVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kTm90aWZpY2F0aW9uUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvbkRlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvblVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLk5vdGlmaWNhdGlvblVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJE5vdGlmaWNhdGlvblBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuTm90aWZpY2F0aW9uVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiROb3RpZmljYXRpb25QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25BZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVOb3RpZmljYXRpb24+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25Hcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuTm90aWZpY2F0aW9uR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ob3RpZmljYXRpb25Db3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLk5vdGlmaWNhdGlvbkNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBQYXltZW50OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFBheW1lbnRQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5QYXltZW50RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudERlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudERlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVQYXltZW50PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5QYXltZW50R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5QYXltZW50Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFJldmlldzoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRSZXZpZXdQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5SZXZpZXdGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1VwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0RlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1VwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1VwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVSZXZpZXc+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUmV2aWV3R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJldmlld0NvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBUb3VyUGFja2FnZToge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlRvdXJQYWNrYWdlRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVRvdXJQYWNrYWdlPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVG91clBhY2thZ2VHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Ub3VyUGFja2FnZUNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBVc2VyOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFVzZXJQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Vc2VyRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckRlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckRlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVVc2VyPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Vc2VyR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Vc2VyQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFdpc2hsaXN0SXRlbToge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5XaXNobGlzdEl0ZW1GaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1EZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbVVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1BZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVXaXNobGlzdEl0ZW0+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1Hcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuV2lzaGxpc3RJdGVtR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1Db3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLldpc2hsaXN0SXRlbUNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufSAmIHtcbiAgb3RoZXI6IHtcbiAgICBwYXlsb2FkOiBhbnlcbiAgICBvcGVyYXRpb25zOiB7XG4gICAgICAkZXhlY3V0ZVJhdzoge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgU3FsLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRleGVjdXRlUmF3VW5zYWZlOiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRxdWVyeVJhdzoge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgU3FsLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRxdWVyeVJhd1Vuc2FmZToge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXV0sXG4gICAgICAgIHJlc3VsdDogYW55XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRW51bXNcbiAqL1xuXG5leHBvcnQgY29uc3QgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCA9IHJ1bnRpbWUubWFrZVN0cmljdEVudW0oe1xuICBSZWFkVW5jb21taXR0ZWQ6ICdSZWFkVW5jb21taXR0ZWQnLFxuICBSZWFkQ29tbWl0dGVkOiAnUmVhZENvbW1pdHRlZCcsXG4gIFJlcGVhdGFibGVSZWFkOiAnUmVwZWF0YWJsZVJlYWQnLFxuICBTZXJpYWxpemFibGU6ICdTZXJpYWxpemFibGUnXG59IGFzIGNvbnN0KVxuXG5leHBvcnQgdHlwZSBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsID0gKHR5cGVvZiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsKVtrZXlvZiB0eXBlb2YgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbF1cblxuXG5leHBvcnQgY29uc3QgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBleGNlcnB0OiAnZXhjZXJwdCcsXG4gIGNvbnRlbnQ6ICdjb250ZW50JyxcbiAgY292ZXJJbWFnZTogJ2NvdmVySW1hZ2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICBhdXRob3JJZDogJ2F1dGhvcklkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCbG9nUG9zdFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQm9va2luZ1NjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRyYXZlbERhdGU6ICd0cmF2ZWxEYXRlJyxcbiAgdHJhdmVsZXJzOiAndHJhdmVsZXJzJyxcbiAgdG90YWxQcmljZTogJ3RvdGFsUHJpY2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYWNrYWdlSWQ6ICdwYWNrYWdlSWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCb29raW5nU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgZW1haWw6ICdlbWFpbCcsXG4gIHN1YmplY3Q6ICdzdWJqZWN0JyxcbiAgbWVzc2FnZTogJ21lc3NhZ2UnLFxuICBpc1Jlc29sdmVkOiAnaXNSZXNvbHZlZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IE5vdGlmaWNhdGlvblNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHR5cGU6ICd0eXBlJyxcbiAgdGl0bGU6ICd0aXRsZScsXG4gIG1lc3NhZ2U6ICdtZXNzYWdlJyxcbiAgbGluazogJ2xpbmsnLFxuICBpc1JlYWQ6ICdpc1JlYWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE5vdGlmaWNhdGlvblNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgTm90aWZpY2F0aW9uU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgTm90aWZpY2F0aW9uU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBQYXltZW50U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgYm9va2luZ0lkOiAnYm9va2luZ0lkJyxcbiAgdHJhbklkOiAndHJhbklkJyxcbiAgdmFsSWQ6ICd2YWxJZCcsXG4gIGFtb3VudDogJ2Ftb3VudCcsXG4gIGN1cnJlbmN5OiAnY3VycmVuY3knLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBnYXRld2F5UGFnZVVybDogJ2dhdGV3YXlQYWdlVXJsJyxcbiAgc3NsU2Vzc2lvbktleTogJ3NzbFNlc3Npb25LZXknLFxuICBjYXJkVHlwZTogJ2NhcmRUeXBlJyxcbiAgYmFua1RyYW5JZDogJ2JhbmtUcmFuSWQnLFxuICBwYWlkQXQ6ICdwYWlkQXQnLFxuICByZWZ1bmRSZWZJZDogJ3JlZnVuZFJlZklkJyxcbiAgcmVmdW5kZWRBdDogJ3JlZnVuZGVkQXQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBheW1lbnRTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFBheW1lbnRTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBQYXltZW50U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBSZXZpZXdTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICByYXRpbmc6ICdyYXRpbmcnLFxuICBjb21tZW50OiAnY29tbWVudCcsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHBhY2thZ2VJZDogJ3BhY2thZ2VJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUmV2aWV3U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBSZXZpZXdTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBSZXZpZXdTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdGl0bGU6ICd0aXRsZScsXG4gIHNsdWc6ICdzbHVnJyxcbiAgZGVzY3JpcHRpb246ICdkZXNjcmlwdGlvbicsXG4gIGxvY2F0aW9uOiAnbG9jYXRpb24nLFxuICBwcmljZTogJ3ByaWNlJyxcbiAgZHVyYXRpb246ICdkdXJhdGlvbicsXG4gIHJhdGluZzogJ3JhdGluZycsXG4gIGltYWdlczogJ2ltYWdlcycsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIGNhdGVnb3J5SWQ6ICdjYXRlZ29yeUlkJyxcbiAgYWdlbnRJZDogJ2FnZW50SWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBVc2VyU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgbmFtZTogJ25hbWUnLFxuICBlbWFpbDogJ2VtYWlsJyxcbiAgcGFzc3dvcmQ6ICdwYXNzd29yZCcsXG4gIGdvb2dsZUlkOiAnZ29vZ2xlSWQnLFxuICBwaG9uZTogJ3Bob25lJyxcbiAgYXZhdGFyVXJsOiAnYXZhdGFyVXJsJyxcbiAgcm9sZTogJ3JvbGUnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBhdXRoUHJvdmlkZXI6ICdhdXRoUHJvdmlkZXInLFxuICBlbWFpbFZlcmlmaWVkOiAnZW1haWxWZXJpZmllZCcsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIHRva2VuVmVyc2lvbjogJ3Rva2VuVmVyc2lvbicsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVXNlclNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgVXNlclNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFVzZXJTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFdpc2hsaXN0SXRlbVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHBhY2thZ2VJZDogJ3BhY2thZ2VJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgV2lzaGxpc3RJdGVtU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBXaXNobGlzdEl0ZW1TY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBXaXNobGlzdEl0ZW1TY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFNvcnRPcmRlciA9IHtcbiAgYXNjOiAnYXNjJyxcbiAgZGVzYzogJ2Rlc2MnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFNvcnRPcmRlciA9ICh0eXBlb2YgU29ydE9yZGVyKVtrZXlvZiB0eXBlb2YgU29ydE9yZGVyXVxuXG5cbmV4cG9ydCBjb25zdCBRdWVyeU1vZGUgPSB7XG4gIGRlZmF1bHQ6ICdkZWZhdWx0JyxcbiAgaW5zZW5zaXRpdmU6ICdpbnNlbnNpdGl2ZSdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUXVlcnlNb2RlID0gKHR5cGVvZiBRdWVyeU1vZGUpW2tleW9mIHR5cGVvZiBRdWVyeU1vZGVdXG5cblxuZXhwb3J0IGNvbnN0IE51bGxzT3JkZXIgPSB7XG4gIGZpcnN0OiAnZmlyc3QnLFxuICBsYXN0OiAnbGFzdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgTnVsbHNPcmRlciA9ICh0eXBlb2YgTnVsbHNPcmRlcilba2V5b2YgdHlwZW9mIE51bGxzT3JkZXJdXG5cblxuXG4vKipcbiAqIEZpZWxkIHJlZmVyZW5jZXNcbiAqL1xuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnU3RyaW5nJ1xuICovXG5leHBvcnQgdHlwZSBTdHJpbmdGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdTdHJpbmcnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnU3RyaW5nW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RTdHJpbmdGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdTdHJpbmdbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQb3N0U3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUG9zdFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1Bvc3RTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUG9zdFN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBvc3RTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQb3N0U3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQm9vbGVhbidcbiAqL1xuZXhwb3J0IHR5cGUgQm9vbGVhbkZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Jvb2xlYW4nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGF0ZVRpbWUnXG4gKi9cbmV4cG9ydCB0eXBlIERhdGVUaW1lRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRGF0ZVRpbWUnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGF0ZVRpbWVbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdERhdGVUaW1lRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRGF0ZVRpbWVbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdJbnQnXG4gKi9cbmV4cG9ydCB0eXBlIEludEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0ludCc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdJbnRbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEludEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0ludFtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RlY2ltYWwnXG4gKi9cbmV4cG9ydCB0eXBlIERlY2ltYWxGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEZWNpbWFsJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RlY2ltYWxbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdERlY2ltYWxGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEZWNpbWFsW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQm9va2luZ1N0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bUJvb2tpbmdTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29raW5nU3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Jvb2tpbmdTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Cb29raW5nU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQm9va2luZ1N0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ05vdGlmaWNhdGlvblR5cGUnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Ob3RpZmljYXRpb25UeXBlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnTm90aWZpY2F0aW9uVHlwZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdOb3RpZmljYXRpb25UeXBlW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtTm90aWZpY2F0aW9uVHlwZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ05vdGlmaWNhdGlvblR5cGVbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYXltZW50U3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUGF5bWVudFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BheW1lbnRTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGF5bWVudFN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBheW1lbnRTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYXltZW50U3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRmxvYXQnXG4gKi9cbmV4cG9ydCB0eXBlIEZsb2F0RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRmxvYXQnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRmxvYXRbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEZsb2F0RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRmxvYXRbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYWNrYWdlU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUGFja2FnZVN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BhY2thZ2VTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGFja2FnZVN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBhY2thZ2VTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYWNrYWdlU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUm9sZSdcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVJvbGVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdSb2xlJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1JvbGVbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Sb2xlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUm9sZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1VzZXJTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Vc2VyU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnVXNlclN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdVc2VyU3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtVXNlclN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1VzZXJTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdBdXRoUHJvdmlkZXInXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1BdXRoUHJvdmlkZXJGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdBdXRoUHJvdmlkZXInPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQXV0aFByb3ZpZGVyW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtQXV0aFByb3ZpZGVyRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQXV0aFByb3ZpZGVyW10nPlxuICAgIFxuXG4vKipcbiAqIEJhdGNoIFBheWxvYWQgZm9yIHVwZGF0ZU1hbnkgJiBkZWxldGVNYW55ICYgY3JlYXRlTWFueVxuICovXG5leHBvcnQgdHlwZSBCYXRjaFBheWxvYWQgPSB7XG4gIGNvdW50OiBudW1iZXJcbn1cblxuZXhwb3J0IGNvbnN0IGRlZmluZUV4dGVuc2lvbiA9IHJ1bnRpbWUuRXh0ZW5zaW9ucy5kZWZpbmVFeHRlbnNpb24gYXMgdW5rbm93biBhcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRXh0ZW5kc0hvb2s8XCJkZWZpbmVcIiwgVHlwZU1hcENiLCBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3M+XG5leHBvcnQgdHlwZSBEZWZhdWx0UHJpc21hQ2xpZW50ID0gUHJpc21hQ2xpZW50XG5leHBvcnQgdHlwZSBFcnJvckZvcm1hdCA9ICdwcmV0dHknIHwgJ2NvbG9ybGVzcycgfCAnbWluaW1hbCdcbi8qKlxuICogT3B0aW9ucyBjb21tb24gdG8gYWxsIHZhcmlhbnRzIG9mIGBQcmlzbWFDbGllbnRPcHRpb25zYCwgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHlvdSBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBhIGRyaXZlciBhZGFwdGVyIG9yIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogQGRlZmF1bHQgXCJjb2xvcmxlc3NcIlxuICAgKi9cbiAgZXJyb3JGb3JtYXQ/OiBFcnJvckZvcm1hdFxuICAvKipcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIC8vIFNob3J0aGFuZCBmb3IgYGVtaXQ6ICdzdGRvdXQnYFxuICAgKiBsb2c6IFsncXVlcnknLCAnaW5mbycsICd3YXJuJywgJ2Vycm9yJ11cbiAgICogXG4gICAqIC8vIEVtaXQgYXMgZXZlbnRzIG9ubHlcbiAgICogbG9nOiBbXG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ3F1ZXJ5JyB9LFxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdpbmZvJyB9LFxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICd3YXJuJyB9XG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ2Vycm9yJyB9XG4gICAqIF1cbiAgICogXG4gICAqIC8gRW1pdCBhcyBldmVudHMgYW5kIGxvZyB0byBzdGRvdXRcbiAgICogb2c6IFtcbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAncXVlcnknIH0sXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ2luZm8nIH0sXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ3dhcm4nIH1cbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAnZXJyb3InIH1cbiAgICogXG4gICAqIGBgYFxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9sb2dnaW5nKS5cbiAgICovXG4gIGxvZz86IChMb2dMZXZlbCB8IExvZ0RlZmluaXRpb24pW11cbiAgLyoqXG4gICAqIFRoZSBkZWZhdWx0IHZhbHVlcyBmb3IgdHJhbnNhY3Rpb25PcHRpb25zXG4gICAqIG1heFdhaXQgPz0gMjAwMFxuICAgKiB0aW1lb3V0ID89IDUwMDBcbiAgICovXG4gIHRyYW5zYWN0aW9uT3B0aW9ucz86IHtcbiAgICBtYXhXYWl0PzogbnVtYmVyXG4gICAgdGltZW91dD86IG51bWJlclxuICAgIGlzb2xhdGlvbkxldmVsPzogVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbFxuICB9XG4gIC8qKlxuICAgKiBHbG9iYWwgY29uZmlndXJhdGlvbiBmb3Igb21pdHRpbmcgbW9kZWwgZmllbGRzIGJ5IGRlZmF1bHQuXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgb21pdDoge1xuICAgKiAgICAgdXNlcjoge1xuICAgKiAgICAgICBwYXNzd29yZDogdHJ1ZVxuICAgKiAgICAgfVxuICAgKiAgIH1cbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBvbWl0PzogR2xvYmFsT21pdENvbmZpZ1xuICAvKipcbiAgICogU1FMIGNvbW1lbnRlciBwbHVnaW5zIHRoYXQgYWRkIG1ldGFkYXRhIHRvIFNRTCBxdWVyaWVzIGFzIGNvbW1lbnRzLlxuICAgKiBDb21tZW50cyBmb2xsb3cgdGhlIHNxbGNvbW1lbnRlciBmb3JtYXQ6IGh0dHBzOi8vZ29vZ2xlLmdpdGh1Yi5pby9zcWxjb21tZW50ZXIvXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcixcbiAgICogICBjb21tZW50czogW1xuICAgKiAgICAgdHJhY2VDb250ZXh0KCksXG4gICAqICAgICBxdWVyeUluc2lnaHRzKCksXG4gICAqICAgXSxcbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBjb21tZW50cz86IHJ1bnRpbWUuU3FsQ29tbWVudGVyUGx1Z2luW11cbiAgLyoqXG4gICAqIE9wdGlvbmFsIG1heGltdW0gc2l6ZSBmb3IgdGhlIHF1ZXJ5IHBsYW4gY2FjaGUuIElmIG5vdCBwcm92aWRlZCwgYSBkZWZhdWx0IHNpemUgd2lsbCBiZSB1c2VkLlxuICAgKiBBIHZhbHVlIG9mIGAwYCBjYW4gYmUgdXNlZCB0byBkaXNhYmxlIHRoZSBjYWNoZSBlbnRpcmVseS4gQSBoaWdoZXIgY2FjaGUgc2l6ZSBjYW4gaW1wcm92ZVxuICAgKiBwZXJmb3JtYW5jZSBmb3IgYXBwbGljYXRpb25zIHRoYXQgZXhlY3V0ZSBhIGxhcmdlIG51bWJlciBvZiB1bmlxdWUgcXVlcmllcywgd2hpbGUgYSBzbWFsbGVyXG4gICAqIGNhY2hlIHNpemUgY2FuIHJlZHVjZSBtZW1vcnkgdXNhZ2UuXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcixcbiAgICogICBxdWVyeVBsYW5DYWNoZU1heFNpemU6IDEwMCxcbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBxdWVyeVBsYW5DYWNoZU1heFNpemU/OiBudW1iZXJcbn1cblxuLyoqXG4gKiBgUHJpc21hQ2xpZW50YCBvcHRpb25zIGZvciBjb25uZWN0aW5nIHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSBpbnN0ZWFkIG9mIGEgZHJpdmVyIGFkYXB0ZXIuXG4gKiBcbiAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2FjY2VsZXJhdGVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmwgZXh0ZW5kcyBQcmlzbWFDbGllbnRCYXNlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgUHJpc21hIEFjY2VsZXJhdGUgY29ubmVjdGlvbiBVUkwuIFVzZSB0aGlzIG9wdGlvbiB0byBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSBpbnN0ZWFkIG9mIHVzaW5nIGEgZHJpdmVyIGFkYXB0ZXIgdG8gY29ubmVjdCBkaXJlY3RseS5cbiAgICogXG4gICAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2FjY2VsZXJhdGVcbiAgICovXG4gIGFjY2VsZXJhdGVVcmw6IHN0cmluZ1xuICBhZGFwdGVyPzogbmV2ZXJcbn1cblxuLyoqXG4gKiBgUHJpc21hQ2xpZW50YCBvcHRpb25zIGZvciBjb25uZWN0aW5nIHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBhIGRyaXZlciBhZGFwdGVyLiBUaGlzIGlzIHRoZSBjb21tb24gY2FzZSBpbiBQcmlzbWEgNy5cbiAqIFxuICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyIGV4dGVuZHMgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogQSBkcml2ZXIgYWRhcHRlciB0aGF0IFByaXNtYUNsaWVudCB1c2VzIHRvIGNvbm5lY3QgdG8geW91ciBkYXRhYmFzZSwgc3VjaCBhcyB0aGUgb25lcyBwcm92aWRlZCBieSBgQHByaXNtYS9hZGFwdGVyLXBnYCwgYEBwcmlzbWEvYWRhcHRlci1saWJzcWxgLCBgQHByaXNtYS9hZGFwdGVyLXBsYW5ldHNjYWxlYCwgZXRjLlxuICAgKiBcbiAgICogQSBkcml2ZXIgYWRhcHRlciBpcyAqKnJlcXVpcmVkKiogdW5sZXNzIHlvdSBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSAoaW4gd2hpY2ggY2FzZSB1c2UgYGFjY2VsZXJhdGVVcmxgIGluc3RlYWQpLlxuICAgKiBcbiAgICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBQcmlzbWFQZyB9IGZyb20gJ0BwcmlzbWEvYWRhcHRlci1wZydcbiAgICogaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSAnLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudCdcbiAgICogXG4gICAqIGNvbnN0IGFkYXB0ZXIgPSBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7IGFkYXB0ZXIgfSlcbiAgICogYGBgXG4gICAqL1xuICBhZGFwdGVyOiBydW50aW1lLlNxbERyaXZlckFkYXB0ZXJGYWN0b3J5XG4gIGFjY2VsZXJhdGVVcmw/OiBuZXZlclxufVxuXG4vKipcbiAqIE9wdGlvbnMgcGFzc2VkIHRvIHRoZSBgUHJpc21hQ2xpZW50YCBjb25zdHJ1Y3Rvci5cbiAqIFxuICogQSBkcml2ZXIgYWRhcHRlciAob3IsIGFsdGVybmF0aXZlbHksIGEgUHJpc21hIEFjY2VsZXJhdGUgVVJMKSBpcyAqKnJlcXVpcmVkKiouIFNlZSB7QGxpbmsgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyfSBhbmQge0BsaW5rIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWNjZWxlcmF0ZVVybH0gZm9yIHRoZSB0d28gdmFyaWFudHMuIEFsbCBvdGhlciBwcm9wZXJ0aWVzIGxpdmUgaW4ge0BsaW5rIFByaXNtYUNsaWVudEJhc2VPcHRpb25zfSBhbmQgYXJlIG9wdGlvbmFsLlxuICogXG4gKiBMZWFybiBtb3JlIGFib3V0IGRyaXZlciBhZGFwdGVyczogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gKi9cbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudE9wdGlvbnMgPSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmwgfCBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFkYXB0ZXJcbmV4cG9ydCB0eXBlIEdsb2JhbE9taXRDb25maWcgPSB7XG4gIGJsb2dQb3N0PzogUHJpc21hLkJsb2dQb3N0T21pdFxuICBib29raW5nPzogUHJpc21hLkJvb2tpbmdPbWl0XG4gIGNhdGVnb3J5PzogUHJpc21hLkNhdGVnb3J5T21pdFxuICBjb250YWN0TWVzc2FnZT86IFByaXNtYS5Db250YWN0TWVzc2FnZU9taXRcbiAgbm90aWZpY2F0aW9uPzogUHJpc21hLk5vdGlmaWNhdGlvbk9taXRcbiAgcGF5bWVudD86IFByaXNtYS5QYXltZW50T21pdFxuICByZXZpZXc/OiBQcmlzbWEuUmV2aWV3T21pdFxuICB0b3VyUGFja2FnZT86IFByaXNtYS5Ub3VyUGFja2FnZU9taXRcbiAgdXNlcj86IFByaXNtYS5Vc2VyT21pdFxuICB3aXNobGlzdEl0ZW0/OiBQcmlzbWEuV2lzaGxpc3RJdGVtT21pdFxufVxuXG4vKiBUeXBlcyBmb3IgTG9nZ2luZyAqL1xuZXhwb3J0IHR5cGUgTG9nTGV2ZWwgPSAnaW5mbycgfCAncXVlcnknIHwgJ3dhcm4nIHwgJ2Vycm9yJ1xuZXhwb3J0IHR5cGUgTG9nRGVmaW5pdGlvbiA9IHtcbiAgbGV2ZWw6IExvZ0xldmVsXG4gIGVtaXQ6ICdzdGRvdXQnIHwgJ2V2ZW50J1xufVxuXG5leHBvcnQgdHlwZSBDaGVja0lzTG9nTGV2ZWw8VD4gPSBUIGV4dGVuZHMgTG9nTGV2ZWwgPyBUIDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIEdldExvZ1R5cGU8VD4gPSBDaGVja0lzTG9nTGV2ZWw8XG4gIFQgZXh0ZW5kcyBMb2dEZWZpbml0aW9uID8gVFsnbGV2ZWwnXSA6IFRcbj47XG5cbmV4cG9ydCB0eXBlIEdldEV2ZW50czxUIGV4dGVuZHMgYW55W10+ID0gVCBleHRlbmRzIEFycmF5PExvZ0xldmVsIHwgTG9nRGVmaW5pdGlvbj5cbiAgPyBHZXRMb2dUeXBlPFRbbnVtYmVyXT5cbiAgOiBuZXZlcjtcblxuZXhwb3J0IHR5cGUgUXVlcnlFdmVudCA9IHtcbiAgdGltZXN0YW1wOiBEYXRlXG4gIHF1ZXJ5OiBzdHJpbmdcbiAgcGFyYW1zOiBzdHJpbmdcbiAgZHVyYXRpb246IG51bWJlclxuICB0YXJnZXQ6IHN0cmluZ1xufVxuXG5leHBvcnQgdHlwZSBMb2dFdmVudCA9IHtcbiAgdGltZXN0YW1wOiBEYXRlXG4gIG1lc3NhZ2U6IHN0cmluZ1xuICB0YXJnZXQ6IHN0cmluZ1xufVxuLyogRW5kIFR5cGVzIGZvciBMb2dnaW5nICovXG5cblxuZXhwb3J0IHR5cGUgUHJpc21hQWN0aW9uID1cbiAgfCAnZmluZFVuaXF1ZSdcbiAgfCAnZmluZFVuaXF1ZU9yVGhyb3cnXG4gIHwgJ2ZpbmRNYW55J1xuICB8ICdmaW5kRmlyc3QnXG4gIHwgJ2ZpbmRGaXJzdE9yVGhyb3cnXG4gIHwgJ2NyZWF0ZSdcbiAgfCAnY3JlYXRlTWFueSdcbiAgfCAnY3JlYXRlTWFueUFuZFJldHVybidcbiAgfCAndXBkYXRlJ1xuICB8ICd1cGRhdGVNYW55J1xuICB8ICd1cGRhdGVNYW55QW5kUmV0dXJuJ1xuICB8ICd1cHNlcnQnXG4gIHwgJ2RlbGV0ZSdcbiAgfCAnZGVsZXRlTWFueSdcbiAgfCAnZXhlY3V0ZVJhdydcbiAgfCAncXVlcnlSYXcnXG4gIHwgJ2FnZ3JlZ2F0ZSdcbiAgfCAnY291bnQnXG4gIHwgJ3J1bkNvbW1hbmRSYXcnXG4gIHwgJ2ZpbmRSYXcnXG4gIHwgJ2dyb3VwQnknXG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgcHJveHkgYXZhaWxhYmxlIGluIGludGVyYWN0aXZlIHRyYW5zYWN0aW9ucy5cbiAqL1xuZXhwb3J0IHR5cGUgVHJhbnNhY3Rpb25DbGllbnQgPSBPbWl0PERlZmF1bHRQcmlzbWFDbGllbnQsIHJ1bnRpbWUuSVRYQ2xpZW50RGVueUxpc3Q+XG5cbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiogVGhpcyBmaWxlIGV4cG9ydHMgYWxsIGVudW0gcmVsYXRlZCB0eXBlcyBmcm9tIHRoZSBzY2hlbWEuXG4qXG4qIFx1RDgzRFx1REZFMiBZb3UgY2FuIGltcG9ydCB0aGlzIGZpbGUgZGlyZWN0bHkuXG4qL1xuXG5leHBvcnQgY29uc3QgUm9sZSA9IHtcbiAgVVNFUjogJ1VTRVInLFxuICBBR0VOVDogJ0FHRU5UJyxcbiAgQURNSU46ICdBRE1JTidcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUm9sZSA9ICh0eXBlb2YgUm9sZSlba2V5b2YgdHlwZW9mIFJvbGVdXG5cblxuZXhwb3J0IGNvbnN0IFVzZXJTdGF0dXMgPSB7XG4gIEFDVElWRTogJ0FDVElWRScsXG4gIFNVU1BFTkRFRDogJ1NVU1BFTkRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVXNlclN0YXR1cyA9ICh0eXBlb2YgVXNlclN0YXR1cylba2V5b2YgdHlwZW9mIFVzZXJTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IEF1dGhQcm92aWRlciA9IHtcbiAgQ1JFREVOVElBTDogJ0NSRURFTlRJQUwnLFxuICBHT09HTEU6ICdHT09HTEUnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEF1dGhQcm92aWRlciA9ICh0eXBlb2YgQXV0aFByb3ZpZGVyKVtrZXlvZiB0eXBlb2YgQXV0aFByb3ZpZGVyXVxuXG5cbmV4cG9ydCBjb25zdCBQYWNrYWdlU3RhdHVzID0ge1xuICBQRU5ESU5HOiAnUEVORElORycsXG4gIEFQUFJPVkVEOiAnQVBQUk9WRUQnLFxuICBSRUpFQ1RFRDogJ1JFSkVDVEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQYWNrYWdlU3RhdHVzID0gKHR5cGVvZiBQYWNrYWdlU3RhdHVzKVtrZXlvZiB0eXBlb2YgUGFja2FnZVN0YXR1c11cblxuXG5leHBvcnQgY29uc3QgQm9va2luZ1N0YXR1cyA9IHtcbiAgUEVORElORzogJ1BFTkRJTkcnLFxuICBQQUlEOiAnUEFJRCcsXG4gIENPTkZJUk1FRDogJ0NPTkZJUk1FRCcsXG4gIENBTkNFTExFRDogJ0NBTkNFTExFRCcsXG4gIENPTVBMRVRFRDogJ0NPTVBMRVRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQm9va2luZ1N0YXR1cyA9ICh0eXBlb2YgQm9va2luZ1N0YXR1cylba2V5b2YgdHlwZW9mIEJvb2tpbmdTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IFBheW1lbnRTdGF0dXMgPSB7XG4gIElOSVRJQVRFRDogJ0lOSVRJQVRFRCcsXG4gIFNVQ0NFU1M6ICdTVUNDRVNTJyxcbiAgRkFJTEVEOiAnRkFJTEVEJyxcbiAgQ0FOQ0VMTEVEOiAnQ0FOQ0VMTEVEJyxcbiAgUkVGVU5ERUQ6ICdSRUZVTkRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGF5bWVudFN0YXR1cyA9ICh0eXBlb2YgUGF5bWVudFN0YXR1cylba2V5b2YgdHlwZW9mIFBheW1lbnRTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IFBvc3RTdGF0dXMgPSB7XG4gIERSQUZUOiAnRFJBRlQnLFxuICBQVUJMSVNIRUQ6ICdQVUJMSVNIRUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBvc3RTdGF0dXMgPSAodHlwZW9mIFBvc3RTdGF0dXMpW2tleW9mIHR5cGVvZiBQb3N0U3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBOb3RpZmljYXRpb25UeXBlID0ge1xuICBCT09LSU5HX0NSRUFURUQ6ICdCT09LSU5HX0NSRUFURUQnLFxuICBCT09LSU5HX0NPTkZJUk1FRDogJ0JPT0tJTkdfQ09ORklSTUVEJyxcbiAgQk9PS0lOR19DQU5DRUxMRUQ6ICdCT09LSU5HX0NBTkNFTExFRCcsXG4gIFBBQ0tBR0VfQVBQUk9WRUQ6ICdQQUNLQUdFX0FQUFJPVkVEJyxcbiAgUEFDS0FHRV9SRUpFQ1RFRDogJ1BBQ0tBR0VfUkVKRUNURUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE5vdGlmaWNhdGlvblR5cGUgPSAodHlwZW9mIE5vdGlmaWNhdGlvblR5cGUpW2tleW9mIHR5cGVvZiBOb3RpZmljYXRpb25UeXBlXVxuIiwgIi8vIEFwcEVycm9yIGtlZXBzIHRoZSBleGFjdCBzYW1lIFwianVzdCB0aHJvdyBpdFwiIGVyZ29ub21pY3MgYnV0IGNhcnJpZXNcbi8vIGEgc3RhdHVzQ29kZSB0aGUgZ2xvYmFsIGhhbmRsZXIgY2FuIHJlYWQgKHNlZSBtaWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cykuXG5leHBvcnQgY2xhc3MgQXBwRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIHN0YXR1c0NvZGU6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihzdGF0dXNDb2RlOiBudW1iZXIsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9IFwiQXBwRXJyb3JcIjtcbiAgICB0aGlzLnN0YXR1c0NvZGUgPSBzdGF0dXNDb2RlO1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHRoaXMuY29uc3RydWN0b3IpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgUHJpc21hUGcgfSBmcm9tIFwiQHByaXNtYS9hZGFwdGVyLXBnXCI7XG5pbXBvcnQgeyBQcmlzbWFDbGllbnQgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG5jb25zdCBjb25uZWN0aW9uU3RyaW5nID0gY29uZmlnLmRhdGFiYXNlX3VybDtcblxuLy8gU2VydmVybGVzcy1mcmllbmRseSBwb29sOiBvbmUgY29ubmVjdGlvbiBwZXIgd2FybSBpbnN0YW5jZSBzbyBtYW55XG4vLyBjb25jdXJyZW50IGludm9jYXRpb25zIGNhbid0IGV4aGF1c3QgdGhlIGRhdGFiYXNlJ3MgY29ubmVjdGlvbiBsaW1pdC5cbi8vIExvY2FsL1ZNIHJ1bnMgYXJlIHVuYWZmZWN0ZWQgKGEgc2luZ2xlIHByb2Nlc3MgdXNlcyBvbmUgY29ubmVjdGlvbiBhbnl3YXkpLlxuY29uc3QgYWRhcHRlciA9IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmcsIG1heDogMSB9KTtcbmNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoeyBhZGFwdGVyIH0pO1xuXG5leHBvcnQgeyBwcmlzbWEgfTtcbiIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgYXV0aENvbnRyb2xsZXIgfSBmcm9tIFwiLi9hdXRoLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGF1dGhWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2F1dGgudmFsaWRhdGlvblwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIFJlZ2lzdGVyIFx1MjAxNCByb2xlIGlzIG9wdGlvbmFsIGFuZCByZXN0cmljdGVkIHRvIFVTRVIvQUdFTlQgaW4gdGhlIHNlcnZpY2VcbnJvdXRlci5wb3N0KFxuICBcIi9yZWdpc3RlclwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVnaXN0ZXJTY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlZ2lzdGVyVXNlcixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9sb2dpblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMubG9naW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmxvZ2luVXNlcixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9nb29nbGVcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmdvb2dsZUxvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5nb29nbGVMb2dpbixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9kZW1vLWxvZ2luXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5kZW1vTG9naW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmRlbW9Mb2dpbixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9yZWZyZXNoXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5yZWZyZXNoVG9rZW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlZnJlc2hUb2tlbixcbik7XG5cbnJvdXRlci5wb3N0KFwiL2xvZ291dFwiLCBhdXRoKCksIGF1dGhDb250cm9sbGVyLmxvZ291dFVzZXIpO1xuXG5yb3V0ZXIuZ2V0KFwiL21lXCIsIGF1dGgoKSwgYXV0aENvbnRyb2xsZXIuZ2V0TWUpO1xuXG5leHBvcnQgY29uc3QgYXV0aFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGF1dGhTZXJ2aWNlIH0gZnJvbSBcIi4vYXV0aC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuY29uc3QgaXNQcm9kdWN0aW9uID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiO1xuXG4vLyBEZXYgKGxvY2FsaG9zdDozMDAwIFx1MjE5MiA6NDAwMCkgaXMgc2FtZS1zaXRlIFx1MjE5MiBsYXggd29ya3Mgd2l0aCBzZWN1cmU6ZmFsc2UuXG4vLyBQcm9kIChjcm9zcy1zaXRlIGZyb250ZW5kL2JhY2tlbmQpIHJlcXVpcmVzIFNhbWVTaXRlPU5vbmUgKyBTZWN1cmUuXG5jb25zdCBjb29raWVPcHRpb25zOiB7XG4gIGh0dHBPbmx5OiB0cnVlO1xuICBzZWN1cmU6IGJvb2xlYW47XG4gIHNhbWVTaXRlOiBcImxheFwiIHwgXCJub25lXCI7XG59ID0ge1xuICBodHRwT25seTogdHJ1ZSxcbiAgc2VjdXJlOiBpc1Byb2R1Y3Rpb24sXG4gIHNhbWVTaXRlOiBpc1Byb2R1Y3Rpb24gPyBcIm5vbmVcIiA6IFwibGF4XCIsXG59O1xuXG5jb25zdCBBQ0NFU1NfQ09PS0lFX01BWF9BR0UgPSAyNCAqIDYwICogNjAgKiAxMDAwOyAvLyAxIGRheVxuY29uc3QgUkVGUkVTSF9DT09LSUVfTUFYX0FHRSA9IDMwICogMjQgKiA2MCAqIDYwICogMTAwMDsgLy8gMzAgZGF5c1xuXG5jb25zdCBzZXRBdXRoQ29va2llcyA9IChcbiAgcmVzOiBSZXNwb25zZSxcbiAgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH06IHsgYWNjZXNzVG9rZW46IHN0cmluZzsgcmVmcmVzaFRva2VuOiBzdHJpbmcgfSxcbikgPT4ge1xuICByZXMuY29va2llKFwiYWNjZXNzVG9rZW5cIiwgYWNjZXNzVG9rZW4sIHtcbiAgICAuLi5jb29raWVPcHRpb25zLFxuICAgIG1heEFnZTogQUNDRVNTX0NPT0tJRV9NQVhfQUdFLFxuICB9KTtcbiAgcmVzLmNvb2tpZShcInJlZnJlc2hUb2tlblwiLCByZWZyZXNoVG9rZW4sIHtcbiAgICAuLi5jb29raWVPcHRpb25zLFxuICAgIG1heEFnZTogUkVGUkVTSF9DT09LSUVfTUFYX0FHRSxcbiAgfSk7XG59O1xuXG5jb25zdCBjbGVhckF1dGhDb29raWVzID0gKHJlczogUmVzcG9uc2UpID0+IHtcbiAgcmVzLmNsZWFyQ29va2llKFwiYWNjZXNzVG9rZW5cIiwgY29va2llT3B0aW9ucyk7XG4gIHJlcy5jbGVhckNvb2tpZShcInJlZnJlc2hUb2tlblwiLCBjb29raWVPcHRpb25zKTtcbn07XG5cbi8vIFJlZ2lzdGVyIGNvbnRyb2xsZXJcbmNvbnN0IHJlZ2lzdGVyVXNlciA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhdXRoU2VydmljZS5yZWdpc3RlclVzZXIocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBSZWdpc3RlcmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBMb2dpbiBjb250cm9sbGVyXG5jb25zdCBsb2dpblVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmxvZ2luVXNlcihyZXEuYm9keSk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR29vZ2xlIGxvZ2luIChJRC10b2tlbiBmbG93KVxuY29uc3QgZ29vZ2xlTG9naW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmdvb2dsZUxvZ2luKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBEZW1vIGxvZ2luIGNvbnRyb2xsZXJcbmNvbnN0IGRlbW9Mb2dpbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9ID0gYXdhaXQgYXV0aFNlcnZpY2UuZGVtb0xvZ2luKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRlbW8gdXNlciBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFJlZnJlc2ggdG9rZW4gY29udHJvbGxlclxuY29uc3QgcmVmcmVzaFRva2VuID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVmcmVzaFRva2VuRnJvbUNvb2tpZSA9IHJlcS5jb29raWVzLnJlZnJlc2hUb2tlbjtcbiAgICBjb25zdCByZWZyZXNoVG9rZW5Gcm9tQm9keSA9IHJlcS5ib2R5Py5yZWZyZXNoVG9rZW47XG5cbiAgICBpZiAoIXJlZnJlc2hUb2tlbkZyb21Db29raWUgJiYgIXJlZnJlc2hUb2tlbkZyb21Cb2R5KSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5VTkFVVEhPUklaRUQsXG4gICAgICAgIG1lc3NhZ2U6IFwiUmVmcmVzaCB0b2tlbiBpcyByZXF1aXJlZFwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4gfSA9XG4gICAgICBhd2FpdCBhdXRoU2VydmljZS5yZWZyZXNoVG9rZW4oe1xuICAgICAgICByZWZyZXNoVG9rZW46IHJlZnJlc2hUb2tlbkZyb21Db29raWUgfHwgcmVmcmVzaFRva2VuRnJvbUJvZHksXG4gICAgICB9KTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywge1xuICAgICAgYWNjZXNzVG9rZW4sXG4gICAgICByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbixcbiAgICB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJUb2tlbiByZWZyZXNoZWQgc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbiB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gTG9nb3V0IGNvbnRyb2xsZXJcbmNvbnN0IGxvZ291dFVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgYXdhaXQgYXV0aFNlcnZpY2UubG9nb3V0KHVzZXJJZCk7XG4gICAgY2xlYXJBdXRoQ29va2llcyhyZXMpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgbG9nZ2VkIG91dCBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgTWUgY29udHJvbGxlclxuY29uc3QgZ2V0TWUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IGF1dGhTZXJ2aWNlLmdldE1lRnJvbURCKHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYXV0aENvbnRyb2xsZXIgPSB7XG4gIHJlZ2lzdGVyVXNlcixcbiAgbG9naW5Vc2VyLFxuICBnb29nbGVMb2dpbixcbiAgZGVtb0xvZ2luLFxuICByZWZyZXNoVG9rZW4sXG4gIGxvZ291dFVzZXIsXG4gIGdldE1lLFxufTsiLCAiaW1wb3J0IGJjcnlwdCBmcm9tIFwiYmNyeXB0anNcIjtcbmltcG9ydCB7IEp3dFBheWxvYWQsIFNpZ25PcHRpb25zIH0gZnJvbSBcImpzb253ZWJ0b2tlblwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgZ29vZ2xlQ2xpZW50IH0gZnJvbSBcIi4uLy4uL2xpYi9nb29nbGVBdXRoXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgand0VXRpbHMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvand0XCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7XG4gIElBdXRoLFxuICBJRGVtb0xvZ2luUGF5bG9hZCxcbiAgSUdvb2dsZUxvZ2luUGF5bG9hZCxcbiAgSUxvZ2luVXNlcixcbiAgSVJlZnJlc2hUb2tlblBheWxvYWQsXG59IGZyb20gXCIuL2F1dGguaW50ZXJmYWNlXCI7XG5cbmNvbnN0IGJ1aWxkVG9rZW5QYXlsb2FkID0gKHVzZXI6IHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICByb2xlOiBSb2xlO1xuICB0b2tlblZlcnNpb246IG51bWJlcjtcbn0pID0+ICh7XG4gIGlkOiB1c2VyLmlkLFxuICBuYW1lOiB1c2VyLm5hbWUsXG4gIGVtYWlsOiB1c2VyLmVtYWlsLFxuICByb2xlOiB1c2VyLnJvbGUsXG4gIHRva2VuVmVyc2lvbjogdXNlci50b2tlblZlcnNpb24sXG59KTtcblxuY29uc3QgaXNzdWVUb2tlbnMgPSAodXNlcjoge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIHJvbGU6IFJvbGU7XG4gIHRva2VuVmVyc2lvbjogbnVtYmVyO1xufSkgPT4ge1xuICBjb25zdCB0b2tlblBheWxvYWQgPSBidWlsZFRva2VuUGF5bG9hZCh1c2VyKTtcblxuICBjb25zdCBhY2Nlc3NUb2tlbiA9IGp3dFV0aWxzLmNyZWF0ZVRva2VuKFxuICAgIHRva2VuUGF5bG9hZCxcbiAgICBjb25maWcuand0X2FjY2Vzc19zZWNyZXQsXG4gICAgeyBleHBpcmVzSW46IGNvbmZpZy5qd3RfYWNjZXNzX2V4cGlyZXNfaW4gfSBhcyBTaWduT3B0aW9ucyxcbiAgKTtcbiAgY29uc3QgcmVmcmVzaFRva2VuID0gand0VXRpbHMuY3JlYXRlVG9rZW4oXG4gICAgdG9rZW5QYXlsb2FkLFxuICAgIGNvbmZpZy5qd3RfcmVmcmVzaF9zZWNyZXQsXG4gICAgeyBleHBpcmVzSW46IGNvbmZpZy5qd3RfcmVmcmVzaF9leHBpcmVzX2luIH0gYXMgU2lnbk9wdGlvbnMsXG4gICk7XG5cbiAgcmV0dXJuIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9O1xufTtcblxuY29uc3Qgc2FuaXRpemVVc2VyID0gPFQgZXh0ZW5kcyB7IHBhc3N3b3JkOiBzdHJpbmcgfCBudWxsIH0+KHVzZXI6IFQpID0+IHtcbiAgY29uc3QgeyBwYXNzd29yZCwgLi4ucmVzdCB9ID0gdXNlcjtcbiAgcmV0dXJuIHJlc3Q7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVnaXN0ZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCByZWdpc3RlclVzZXIgPSBhc3luYyAocGF5bG9hZDogSUF1dGgpID0+IHtcbiAgY29uc3QgeyBuYW1lLCBlbWFpbCwgcGFzc3dvcmQsIHBob25lLCByb2xlIH0gPSBwYXlsb2FkO1xuXG4gIC8vIE9ubHkgdXNlcnMvYWdlbnRzIGNhbiBzZWxmLXJlZ2lzdGVyOyBhZG1pbnMgYXJlIGNyZWF0ZWQgdmlhIGRlbW8tbG9naW4vc2VlZFxuICBpZiAocm9sZSAmJiByb2xlICE9PSBcIlVTRVJcIiAmJiByb2xlICE9PSBcIkFHRU5UXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIlJvbGUgbXVzdCBiZSBlaXRoZXIgVVNFUiBvciBBR0VOVFwiKTtcbiAgfVxuXG4gIGNvbnN0IGV4aXN0aW5nVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGVtYWlsIH0sXG4gIH0pO1xuICBpZiAoZXhpc3RpbmdVc2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJVc2VyIHdpdGggdGhpcyBlbWFpbCBhbHJlYWR5IGV4aXN0c1wiKTtcbiAgfVxuXG4gIGNvbnN0IGhhc2hlZFBhc3N3b3JkID0gYXdhaXQgYmNyeXB0Lmhhc2goXG4gICAgcGFzc3dvcmQsXG4gICAgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpLFxuICApO1xuXG4gIGNvbnN0IGNyZWF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICBuYW1lLFxuICAgICAgZW1haWwsXG4gICAgICBwYXNzd29yZDogaGFzaGVkUGFzc3dvcmQsXG4gICAgICBhdXRoUHJvdmlkZXI6IFwiQ1JFREVOVElBTFwiLFxuICAgICAgcm9sZTogcm9sZSB8fCBcIlVTRVJcIixcbiAgICAgIHBob25lLFxuICAgIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gY3JlYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTG9naW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBsb2dpblVzZXIgPSBhc3luYyAocGF5bG9hZDogSUxvZ2luVXNlcikgPT4ge1xuICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgZW1haWwgfSxcbiAgfSk7XG5cbiAgaWYgKCF1c2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJJbnZhbGlkIGVtYWlsIG9yIHBhc3N3b3JkXCIpO1xuICB9XG4gIGlmICh1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBpcyBzdXNwZW5kZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJUaGlzIGFjY291bnQgdXNlcyBHb29nbGUgbG9naW4uIFBsZWFzZSBsb2cgaW4gd2l0aCBHb29nbGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGlzUGFzc3dvcmRWYWxpZCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKHBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkIHx8IFwiXCIpO1xuICBpZiAoIWlzUGFzc3dvcmRWYWxpZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBlbWFpbCBvciBwYXNzd29yZFwiKTtcbiAgfVxuXG4gIHJldHVybiBpc3N1ZVRva2Vucyh1c2VyKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBHb29nbGUgbG9naW4gKElELXRva2VuIGZsb3cpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ29vZ2xlTG9naW4gPSBhc3luYyAocGF5bG9hZDogSUdvb2dsZUxvZ2luUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IGlkVG9rZW4gfSA9IHBheWxvYWQ7XG5cbiAgaWYgKCFjb25maWcuZ29vZ2xlX2NsaWVudF9pZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiR29vZ2xlIGxvZ2luIGlzIG5vdCBjb25maWd1cmVkLiBQbGVhc2UgY29udGFjdCBzdXBwb3J0LlwiLFxuICAgICk7XG4gIH1cblxuICBsZXQgdGlja2V0O1xuICB0cnkge1xuICAgIHRpY2tldCA9IGF3YWl0IGdvb2dsZUNsaWVudC52ZXJpZnlJZFRva2VuKHtcbiAgICAgIGlkVG9rZW4sXG4gICAgICBhdWRpZW5jZTogY29uZmlnLmdvb2dsZV9jbGllbnRfaWQsXG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBHb29nbGUgdG9rZW5cIik7XG4gIH1cblxuICBjb25zdCBnb29nbGVEYXRhID0gdGlja2V0LmdldFBheWxvYWQoKTtcbiAgaWYgKCFnb29nbGVEYXRhKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIEdvb2dsZSB0b2tlbiBwYXlsb2FkXCIpO1xuICB9XG5cbiAgY29uc3QgeyBlbWFpbCwgbmFtZSwgc3ViLCBwaWN0dXJlIH0gPSBnb29nbGVEYXRhO1xuXG4gIGlmICghZW1haWwgfHwgIWdvb2dsZURhdGEuZW1haWxfdmVyaWZpZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkdvb2dsZSBhY2NvdW50IGVtYWlsIGlzIG5vdCB2ZXJpZmllZFwiKTtcbiAgfVxuXG4gIGxldCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGdvb2dsZUlkOiBzdWIgfSB9KTtcblxuICAvLyBFeGlzdGluZyB1c2VyIFx1MjE5MiBsaW5rIEdvb2dsZSBhY2NvdW50IGlmIG5vdCBhbHJlYWR5IGxpbmtlZFxuICBpZiAoIXVzZXIgJiYgZW1haWwpIHtcbiAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG4gICAgaWYgKHVzZXIpIHtcbiAgICAgIGlmICh1c2VyLmdvb2dsZUlkICYmIHVzZXIuZ29vZ2xlSWQgIT09IHN1Yikge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgNDA5LFxuICAgICAgICAgIFwiRW1haWwgaXMgYWxyZWFkeSBsaW5rZWQgdG8gYW5vdGhlciBHb29nbGUgYWNjb3VudFwiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiB1c2VyLmlkIH0sXG4gICAgICAgIGRhdGE6IHsgZ29vZ2xlSWQ6IHN1YiwgZW1haWxWZXJpZmllZDogdHJ1ZSB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gQnJhbmQgbmV3IHVzZXJcbiAgaWYgKCF1c2VyKSB7XG4gICAgY29uc3QgbG9jYWxQYXJ0ID0gZW1haWwuc3BsaXQoXCJAXCIpWzBdID8/IGVtYWlsO1xuICAgIGNvbnN0IGRpc3BsYXlOYW1lID0gKG5hbWUgPz8gXCJcIikudHJpbSgpIHx8IGxvY2FsUGFydDtcbiAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgZW1haWwsXG4gICAgICAgIG5hbWU6IGRpc3BsYXlOYW1lLFxuICAgICAgICBwYXNzd29yZDogbnVsbCxcbiAgICAgICAgYXV0aFByb3ZpZGVyOiBcIkdPT0dMRVwiLFxuICAgICAgICBnb29nbGVJZDogc3ViLFxuICAgICAgICBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuICAgICAgICByb2xlOiBcIlVTRVJcIixcbiAgICAgICAgYXZhdGFyVXJsOiBwaWN0dXJlIHx8IG51bGwsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdG9rZW5zID0gaXNzdWVUb2tlbnModXNlciEpO1xuICBjb25zdCBzYW5pdGl6ZWRVc2VyID0gc2FuaXRpemVVc2VyKHVzZXIhKTtcblxuICByZXR1cm4geyAuLi50b2tlbnMsIHVzZXI6IHNhbml0aXplZFVzZXIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBEZW1vIGxvZ2luIChncmFkaW5nKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IERFTU9fUEFTU1dPUkQgPSBcImRlbW8xMjNcIjtcblxuY29uc3QgZGVtb0xvZ2luID0gYXN5bmMgKHBheWxvYWQ6IElEZW1vTG9naW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgcm9sZSB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBkZW1vVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwc2VydCh7XG4gICAgd2hlcmU6IHsgZW1haWw6IGBkZW1vLSR7cm9sZS50b0xvd2VyQ2FzZSgpfUB0cmlwdmVyc2UuY29tYCB9LFxuICAgIC8vIHJlc3VycmVjdCBkZW1vIGFjY291bnRzIHRoYXQgYW4gYWRtaW4gc3VzcGVuZGVkIG9yIHNvZnQtZGVsZXRlZFxuICAgIHVwZGF0ZTogeyBzdGF0dXM6IFwiQUNUSVZFXCIsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBjcmVhdGU6IHtcbiAgICAgIG5hbWU6IGBEZW1vICR7cm9sZS5jaGFyQXQoMCkgKyByb2xlLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCl9YCxcbiAgICAgIGVtYWlsOiBgZGVtby0ke3JvbGUudG9Mb3dlckNhc2UoKX1AdHJpcHZlcnNlLmNvbWAsXG4gICAgICBwYXNzd29yZDogYXdhaXQgYmNyeXB0Lmhhc2goREVNT19QQVNTV09SRCwgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpKSxcbiAgICAgIGF1dGhQcm92aWRlcjogXCJDUkVERU5USUFMXCIsXG4gICAgICByb2xlLFxuICAgICAgc3RhdHVzOiBcIkFDVElWRVwiLFxuICAgICAgZW1haWxWZXJpZmllZDogdHJ1ZSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHsgLi4uaXNzdWVUb2tlbnMoZGVtb1VzZXIpLCB1c2VyOiBkZW1vVXNlciB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZnJlc2ggXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCByZWZyZXNoVG9rZW4gPSBhc3luYyAocGF5bG9hZDogSVJlZnJlc2hUb2tlblBheWxvYWQpID0+IHtcbiAgY29uc3QgeyByZWZyZXNoVG9rZW46IHByb3ZpZGVkUmVmcmVzaFRva2VuIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHZlcmlmaWVkID0gand0VXRpbHMudmVyaWZ5VG9rZW4oXG4gICAgcHJvdmlkZWRSZWZyZXNoVG9rZW4sXG4gICAgY29uZmlnLmp3dF9yZWZyZXNoX3NlY3JldCxcbiAgKTtcblxuICBpZiAoIXZlcmlmaWVkLnN1Y2Nlc3MpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCB2ZXJpZmllZC5lcnJvcik7XG4gIH1cblxuICBjb25zdCB7IGlkLCB0b2tlblZlcnNpb246IHRva2VuVG9rZW5WZXJzaW9uIH0gPVxuICAgIHZlcmlmaWVkLmRhdGEgYXMgSnd0UGF5bG9hZCAmIHsgdG9rZW5WZXJzaW9uOiBudW1iZXIgfTtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG5cbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGhhcyBiZWVuIGRlbGV0ZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGlzIHN1c3BlbmRlZFwiKTtcbiAgfVxuXG4gIC8vIHRva2VuVmVyc2lvbiBjaGFuZ2VkIFx1MjE5MiB0b2tlbnMgd2VyZSByZXZva2VkIChsb2dvdXQgLyBwYXNzd29yZCBjaGFuZ2UpXG4gIGlmICh1c2VyLnRva2VuVmVyc2lvbiAhPT0gdG9rZW5Ub2tlblZlcnNpb24pIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIlRva2VuIGlzIG5vIGxvbmdlciB2YWxpZC4gUGxlYXNlIGxvZ2luIGFnYWluLlwiKTtcbiAgfVxuXG4gIHJldHVybiBpc3N1ZVRva2Vucyh1c2VyKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBMb2dvdXQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBsb2dvdXQgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgZGF0YTogeyB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSxcbiAgfSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgR2V0IG1lIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0TWVGcm9tREIgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICByZXR1cm4gdXNlcjtcbn07XG5cbmV4cG9ydCBjb25zdCBhdXRoU2VydmljZSA9IHtcbiAgcmVnaXN0ZXJVc2VyLFxuICBsb2dpblVzZXIsXG4gIGdvb2dsZUxvZ2luLFxuICBkZW1vTG9naW4sXG4gIHJlZnJlc2hUb2tlbixcbiAgbG9nb3V0LFxuICBnZXRNZUZyb21EQixcbn07IiwgImltcG9ydCB7IE9BdXRoMkNsaWVudCB9IGZyb20gXCJnb29nbGUtYXV0aC1saWJyYXJ5XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuZXhwb3J0IGNvbnN0IGdvb2dsZUNsaWVudCA9IG5ldyBPQXV0aDJDbGllbnQoe1xuICBjbGllbnRJZDogY29uZmlnLmdvb2dsZV9jbGllbnRfaWQsXG59KTsiLCAiaW1wb3J0IGp3dCwgeyBKd3RQYXlsb2FkLCBTaWduT3B0aW9ucyB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcblxuY29uc3QgY3JlYXRlVG9rZW4gPSAoXG4gIHBheWxvYWQ6IEp3dFBheWxvYWQsXG4gIHNlY3JldDogc3RyaW5nLFxuICBleHBpcmVzSW46IFNpZ25PcHRpb25zLFxuKSA9PiB7XG4gIGNvbnN0IHRva2VuID0gand0LnNpZ24ocGF5bG9hZCwgc2VjcmV0LCBleHBpcmVzSW4pO1xuXG4gIHJldHVybiB0b2tlbjtcbn07XG5cbmNvbnN0IHZlcmlmeVRva2VuID0gKHRva2VuOiBzdHJpbmcsIHNlY3JldDogc3RyaW5nKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdmVyaWZpZWRUb2tlbiA9IGp3dC52ZXJpZnkodG9rZW4sIHNlY3JldCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBkYXRhOiB2ZXJpZmllZFRva2VuLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICBjb25zb2xlLmxvZyhcIlRva2VuIFZlcmlmaWNhdGlvbiBGYWlsZWQ6XCIsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogZXJyb3IubWVzc2FnZSxcbiAgICB9O1xuICB9XG59O1xuXG5leHBvcnQgY29uc3Qgand0VXRpbHMgPSB7XG4gIGNyZWF0ZVRva2VuLFxuICB2ZXJpZnlUb2tlbixcbn07XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXF1ZXN0SGFuZGxlciwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5leHBvcnQgY29uc3QgY2F0Y2hBc3luYyA9IChmbjogUmVxdWVzdEhhbmRsZXIpID0+IHtcbiAgcmV0dXJuIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmbihyZXEsIHJlcywgbmV4dCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIG5leHQoZXJyb3IpO1xuICAgIH1cbiAgfTtcbn07XG4iLCAiaW1wb3J0IHsgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG50eXBlIFRNZXRhID0ge1xuICBwYWdlOiBudW1iZXI7XG4gIGxpbWl0OiBudW1iZXI7XG4gIHRvdGFsOiBudW1iZXI7XG4gIHRvdGFsUGFnZXM6IG51bWJlcjtcbn07XG5cbnR5cGUgVFJlc3BvbnNlRGF0YTxUPiA9IHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgc3RhdHVzQ29kZTogbnVtYmVyO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGRhdGE6IFQ7XG4gIG1ldGE/OiBUTWV0YTtcbn07XG5cbmV4cG9ydCBjb25zdCBzZW5kUmVzcG9uc2UgPSA8VD4ocmVzOiBSZXNwb25zZSwgZGF0YTogVFJlc3BvbnNlRGF0YTxUPikgPT4ge1xuICByZXMuc3RhdHVzKGRhdGEuc3RhdHVzQ29kZSkuanNvbih7XG4gICAgc3VjY2VzczogZGF0YS5zdWNjZXNzLFxuICAgIG1lc3NhZ2U6IGRhdGEubWVzc2FnZSxcbiAgICBkYXRhOiBkYXRhLmRhdGEsXG4gICAgbWV0YTogZGF0YS5tZXRhLFxuICB9KTtcbn07XG4iLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCByZWdpc3RlclNjaGVtYSA9IHoub2JqZWN0KHtcbiAgbmFtZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOYW1lIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKSxcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpLFxuICBwYXNzd29yZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbig2LCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCg3MiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IG1vc3QgNzIgY2hhcmFjdGVyc1wiKSxcbiAgcGhvbmU6IHpcbiAgICAuc3RyaW5nKClcbiAgICAubWF4KDIwLCBcIlBob25lIG51bWJlciBpcyB0b28gbG9uZ1wiKVxuICAgIC5vcHRpb25hbCgpLFxuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBsb2dpblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpLFxuICBwYXNzd29yZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBnb29nbGVMb2dpblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWRUb2tlbjogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJHb29nbGUgaWRUb2tlbiBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBkZW1vTG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlLCB7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSByb2xlXCIsXG4gIH0pLFxufSk7XG5cbi8vIHJlZnJlc2hUb2tlbiBtYXkgY29tZSBmcm9tIHRoZSBodHRwT25seSBjb29raWUgT1IgdGhlIHJlcXVlc3QgYm9keSBcdTIwMTRcbi8vIHZhbGlkYXRpb24gaXMgbGVuaWVudCBoZXJlOyB0aGUgY29udHJvbGxlciBoYW5kbGVzIGJvdGggc291cmNlcy5cbmNvbnN0IHJlZnJlc2hUb2tlblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcmVmcmVzaFRva2VuOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRSZWdpc3RlclNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHJlZ2lzdGVyU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRMb2dpblNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGxvZ2luU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRHb29nbGVMb2dpblNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGdvb2dsZUxvZ2luU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRSZWZyZXNoVG9rZW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZWZyZXNoVG9rZW5TY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgYXV0aFZhbGlkYXRpb25zID0ge1xuICByZWdpc3RlclNjaGVtYSxcbiAgbG9naW5TY2hlbWEsXG4gIGdvb2dsZUxvZ2luU2NoZW1hLFxuICBkZW1vTG9naW5TY2hlbWEsXG4gIHJlZnJlc2hUb2tlblNjaGVtYSxcbn07IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgWm9kVHlwZSB9IGZyb20gXCJ6b2RcIjtcblxudHlwZSBWYWxpZGF0aW9uU2NoZW1hID0ge1xuICBib2R5PzogWm9kVHlwZTtcbiAgcXVlcnk/OiBab2RUeXBlO1xuICBwYXJhbXM/OiBab2RUeXBlO1xufTtcblxuLy8gUnVucyBab2Qgc2NoZW1hcyBhZ2FpbnN0IHJlcS5ib2R5L3F1ZXJ5L3BhcmFtcyBhbmQgcmVwbGFjZXMgdGhlIHBhcnNlZFxuLy8gdmFsdWVzIHNvIGRvd25zdHJlYW0gaGFuZGxlcnMgd29yayB3aXRoIHZhbGlkYXRlZCAoYW5kIHR5cGVkKSBkYXRhLlxuLy8gQW55IFpvZEVycm9yIHRocm93biBoZXJlIGlzIG1hcHBlZCB0byBhIDQwMCBieSBnbG9iYWxFcnJvckhhbmRsZXIuXG4vL1xuLy8gcmVxLmJvZHkgaXMgc2FmZWx5IHdyaXRhYmxlLCBidXQgaW4gRXhwcmVzcyA1IHJlcS5xdWVyeS9yZXEucGFyYW1zIGFyZVxuLy8gZ2V0dGVyLW9ubHkgXHUyMDE0IHRoZXkgbXVzdCBiZSByZWRlZmluZWQgdmlhIGRlZmluZVByb3BlcnR5IHRvIHN3YXAgaW4gdGhlXG4vLyBwYXJzZWQgdmFsdWVzLlxuY29uc3QgdmFsaWRhdGVSZXF1ZXN0ID0gKHNjaGVtYTogVmFsaWRhdGlvblNjaGVtYSkgPT4ge1xuICByZXR1cm4gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgaWYgKHNjaGVtYS5ib2R5KSB7XG4gICAgICByZXEuYm9keSA9IHNjaGVtYS5ib2R5LnBhcnNlKHJlcS5ib2R5KTtcbiAgICB9XG4gICAgaWYgKHNjaGVtYS5xdWVyeSkge1xuICAgICAgY29uc3QgcGFyc2VkUXVlcnkgPSBzY2hlbWEucXVlcnkucGFyc2UocmVxLnF1ZXJ5KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXEsIFwicXVlcnlcIiwge1xuICAgICAgICB2YWx1ZTogcGFyc2VkUXVlcnksXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKHNjaGVtYS5wYXJhbXMpIHtcbiAgICAgIGNvbnN0IHBhcnNlZFBhcmFtcyA9IHNjaGVtYS5wYXJhbXMucGFyc2UocmVxLnBhcmFtcyk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVxLCBcInBhcmFtc1wiLCB7XG4gICAgICAgIHZhbHVlOiBwYXJzZWRQYXJhbXMsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBuZXh0KCk7XG4gIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCB2YWxpZGF0ZVJlcXVlc3Q7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgSnd0UGF5bG9hZCB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgand0VXRpbHMgfSBmcm9tIFwiLi4vdXRpbHMvand0XCI7XG5cbi8vIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTikgXHUyMTkyIG9ubHkgdGhvc2Ugcm9sZXMgcGFzc1xuLy8gYXV0aCgpIFx1MjE5MiBhbnkgYXV0aGVudGljYXRlZCB1c2VyIHBhc3Nlc1xuY29uc3QgYXV0aCA9ICguLi5yZXF1aXJlZFJvbGVzOiBSb2xlW10pID0+IHtcbiAgcmV0dXJuIGNhdGNoQXN5bmMoYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdG9rZW4gPSByZXEuY29va2llcy5hY2Nlc3NUb2tlblxuICAgICAgPyByZXEuY29va2llcy5hY2Nlc3NUb2tlblxuICAgICAgOiByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uPy5zdGFydHNXaXRoKFwiQmVhcmVyIFwiKVxuICAgICAgICA/IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb24uc3BsaXQoXCIgXCIpWzFdXG4gICAgICAgIDogcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbjtcblxuICAgIC8vIDEuIHRva2VuIG11c3QgYmUgcHJlc2VudFxuICAgIGlmICghdG9rZW4pIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAxLFxuICAgICAgICBcIllvdSBhcmUgbm90IGxvZ2dlZCBpbi4gUGxlYXNlIGxvZ2luIHRvIGNvbnRpbnVlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyAyLiB2ZXJpZnkgdGhlIGFjY2VzcyB0b2tlblxuICAgIGNvbnN0IHZlcmlmaWVkVG9rZW4gPSBqd3RVdGlscy52ZXJpZnlUb2tlbihcbiAgICAgIHRva2VuLFxuICAgICAgY29uZmlnLmp3dF9hY2Nlc3Nfc2VjcmV0LFxuICAgICk7XG5cbiAgICBpZiAoIXZlcmlmaWVkVG9rZW4uc3VjY2Vzcykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgdmVyaWZpZWRUb2tlbi5lcnJvcik7XG4gICAgfVxuXG4gICAgY29uc3QgeyBpZCwgdG9rZW5WZXJzaW9uIH0gPSB2ZXJpZmllZFRva2VuLmRhdGEgYXMgSnd0UGF5bG9hZCAmIHtcbiAgICAgIHRva2VuVmVyc2lvbjogbnVtYmVyO1xuICAgIH07XG5cbiAgICAvLyAzLiByZS1mZXRjaCB1c2VyIHRvIGVuZm9yY2UgYWNjb3VudCBzdGF0ZSBvbiBldmVyeSByZXF1ZXN0XG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgd2hlcmU6IHsgaWQgfSxcbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJVc2VyIG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJVc2VyIGlzIHN1c3BlbmRlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydCBzZXJ2aWNlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA0LiB0b2tlblZlcnNpb24gbXVzdCBtYXRjaCBEQiAobG9nb3V0IC8gcGFzc3dvcmQgY2hhbmdlIGtpbGxzIG9sZCB0b2tlbnMpXG4gICAgaWYgKHVzZXIudG9rZW5WZXJzaW9uICE9PSB0b2tlblZlcnNpb24pIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAxLFxuICAgICAgICBcIlNlc3Npb24gaXMgbm8gbG9uZ2VyIHZhbGlkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDUuIGF1dGhvcml6YXRpb24gdXNlcyB0aGUgREIgcm9sZSwgbm90IHRoZSAocG9zc2libHkgc3RhbGUpIEpXVCByb2xlXG4gICAgaWYgKHJlcXVpcmVkUm9sZXMubGVuZ3RoICYmICFyZXF1aXJlZFJvbGVzLmluY2x1ZGVzKHVzZXIucm9sZSkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAzLFxuICAgICAgICBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gYWNjZXNzIHRoaXMgcm91dGUuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDYuIGF0dGFjaCB0aGUgYXV0aGVudGljYXRlZCB1c2VyIHRvIHRoZSByZXF1ZXN0XG4gICAgcmVxLnVzZXIgPSB7XG4gICAgICBpZDogdXNlci5pZCxcbiAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgIGVtYWlsOiB1c2VyLmVtYWlsLFxuICAgICAgcm9sZTogdXNlci5yb2xlLFxuICAgIH07XG5cbiAgICBuZXh0KCk7XG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYXV0aDsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHVzZXJDb250cm9sbGVyIH0gZnJvbSBcIi4vdXNlci5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyB1c2VyVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi91c2VyLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE93biBwcm9maWxlIFx1MjAxNCBhbnkgYXV0aGVudGljYXRlZCB1c2VyXG5yb3V0ZXIucGF0Y2goXG4gIFwiL3Byb2ZpbGVcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiB1c2VyVmFsaWRhdGlvbnMudXBkYXRlUHJvZmlsZVNjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIudXBkYXRlUHJvZmlsZSxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBsaXN0IHVzZXJzIHdpdGggZmlsdGVycyArIHBhZ2luYXRpb25cbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogdXNlclZhbGlkYXRpb25zLnVzZXJRdWVyeVNjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIuZ2V0VXNlcnMsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgcm9sZSBtYW5hZ2VtZW50XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9yb2xlXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiB1c2VyVmFsaWRhdGlvbnMudXNlclBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiB1c2VyVmFsaWRhdGlvbnMuY2hhbmdlUm9sZVNjaGVtYSxcbiAgfSksXG4gIHVzZXJDb250cm9sbGVyLmNoYW5nZVJvbGUsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgc3RhdHVzIG1hbmFnZW1lbnRcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogdXNlclZhbGlkYXRpb25zLmNoYW5nZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIHVzZXJDb250cm9sbGVyLmNoYW5nZVN0YXR1cyxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBzb2Z0IGRlbGV0ZVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLmRlbGV0ZVVzZXIsXG4pO1xuXG5leHBvcnQgY29uc3QgdXNlclJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHVzZXJTZXJ2aWNlIH0gZnJvbSBcIi4vdXNlci5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gVXBkYXRlIHByb2ZpbGUgY29udHJvbGxlclxuY29uc3QgdXBkYXRlUHJvZmlsZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UudXBkYXRlUHJvZmlsZSh1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQcm9maWxlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdldCBhbGwgdXNlcnMgKGFkbWluKVxuY29uc3QgZ2V0VXNlcnMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1c2VyU2VydmljZS5nZXRVc2VycyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXJzIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSB1c2VyIHJvbGUgKGFkbWluKVxuY29uc3QgY2hhbmdlUm9sZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgLy8gYW4gYWRtaW4gbXVzdCBub3QgZG93bmdyYWRlL2NoYW5nZSB0aGVpciBvd24gcm9sZVxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBjaGFuZ2UgeW91ciBvd24gcm9sZS5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5jaGFuZ2VSb2xlKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciByb2xlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSB1c2VyIHN0YXR1cyAoYWRtaW4pXG5jb25zdCBjaGFuZ2VTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IHN1c3BlbmQvYWN0aXZhdGUgdGhlaXIgb3duIGFjY291bnRcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgY2hhbmdlIHlvdXIgb3duIHN0YXR1cy5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5jaGFuZ2VTdGF0dXMoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBTb2Z0IGRlbGV0ZSB1c2VyIChhZG1pbilcbmNvbnN0IGRlbGV0ZVVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IGRlbGV0ZSB0aGVpciBvd24gYWNjb3VudFxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBkZWxldGUgeW91ciBvd24gYWNjb3VudC5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5kZWxldGVVc2VyKGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCB1c2VyQ29udHJvbGxlciA9IHtcbiAgdXBkYXRlUHJvZmlsZSxcbiAgZ2V0VXNlcnMsXG4gIGNoYW5nZVJvbGUsXG4gIGNoYW5nZVN0YXR1cyxcbiAgZGVsZXRlVXNlcixcbn07IiwgImltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBSb2xlLCBVc2VyU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7XG4gIElDaGFuZ2VSb2xlLFxuICBJQ2hhbmdlU3RhdHVzLFxuICBJVXBkYXRlUHJvZmlsZSxcbiAgSVVzZXJRdWVyeSxcbn0gZnJvbSBcIi4vdXNlci5pbnRlcmZhY2VcIjtcblxuY29uc3QgdmFsaWRhdGVBY3RpdmVVc2VyID0gYXN5bmMgKGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cbiAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJVc2VyIGlzIHN1c3BlbmRlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydCBzZXJ2aWNlLlwiKTtcbiAgfVxuXG4gIHJldHVybiB1c2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFVwZGF0ZSBwcm9maWxlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgdXBkYXRlUHJvZmlsZSA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSVVwZGF0ZVByb2ZpbGUpID0+IHtcbiAgY29uc3QgeyBuYW1lLCBwaG9uZSwgYXZhdGFyVXJsLCBjdXJyZW50UGFzc3dvcmQsIG5ld1Bhc3N3b3JkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlT3JUaHJvdyh7IHdoZXJlOiB7IGlkOiB1c2VySWQgfSB9KTtcblxuICBpZiAodXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaGFzIGJlZW4gZGVsZXRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5hdXRoUHJvdmlkZXIgPT09IFwiR09PR0xFXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDMsXG4gICAgICBcIkdvb2dsZSBhY2NvdW50cyBjYW5ub3QgY2hhbmdlIHBhc3N3b3JkLiBVc2UgR29vZ2xlIHNpZ24taW4gdG8gbWFuYWdlIHlvdXIgcHJvZmlsZS5cIixcbiAgICApO1xuICB9XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLlVzZXJVcGRhdGVJbnB1dCA9IHt9O1xuXG4gIGlmIChuYW1lKSBkYXRhLm5hbWUgPSBuYW1lO1xuICBpZiAocGhvbmUpIGRhdGEucGhvbmUgPSBwaG9uZTtcbiAgaWYgKGF2YXRhclVybCkgZGF0YS5hdmF0YXJVcmwgPSBhdmF0YXJVcmw7XG5cbiAgLy8gUGFzc3dvcmQgY2hhbmdlIHJlcXVpcmVzIGN1cnJlbnRQYXNzd29yZCArIG5ld1Bhc3N3b3JkXG4gIGlmIChuZXdQYXNzd29yZCkge1xuICAgIGlmICghY3VycmVudFBhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkN1cnJlbnQgcGFzc3dvcmQgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuICAgIGlmIChjdXJyZW50UGFzc3dvcmQgPT09IG5ld1Bhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIk5ldyBwYXNzd29yZCBtdXN0IGJlIGRpZmZlcmVudFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBpc01hdGNoID0gYXdhaXQgYmNyeXB0LmNvbXBhcmUoY3VycmVudFBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkIHx8IFwiXCIpO1xuICAgIGlmICghaXNNYXRjaCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGN1cnJlbnQgcGFzc3dvcmRcIik7XG4gICAgfVxuXG4gICAgZGF0YS5wYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgICAgbmV3UGFzc3dvcmQsXG4gICAgICBOdW1iZXIoY29uZmlnLmJjcnlwdF9zYWx0X3JvdW5kcyksXG4gICAgKTtcbiAgICBkYXRhLnRva2VuVmVyc2lvbiA9IHsgaW5jcmVtZW50OiAxIH07XG4gIH1cblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIGRhdGEsXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gdXBkYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IGxpc3QgdXNlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRVc2VycyA9IGFzeW5jIChxdWVyeTogSVVzZXJRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSB8fCAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0IHx8IDEwO1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVXNlcldoZXJlSW5wdXQgPSB7XG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgfTtcblxuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUuT1IgPSBbXG4gICAgICB7IG5hbWU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgIHsgZW1haWw6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICBdO1xuICB9XG4gIGlmIChxdWVyeS5yb2xlKSB3aGVyZS5yb2xlID0gcXVlcnkucm9sZTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuXG4gIGNvbnN0IFt1c2VycywgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS51c2VyLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgc2tpcDogKHBhZ2UgLSAxKSAqIGxpbWl0LFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEudXNlci5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IHVzZXJzLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IHVwZGF0ZSByb2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY2hhbmdlUm9sZSA9IGFzeW5jIChpZDogc3RyaW5nLCBwYXlsb2FkOiBJQ2hhbmdlUm9sZSkgPT4ge1xuICBjb25zdCB7IHJvbGUgfSA9IHBheWxvYWQ7XG5cbiAgYXdhaXQgdmFsaWRhdGVBY3RpdmVVc2VyKGlkKTtcblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IHJvbGUsIHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiB1cGRhdGUgc3RhdHVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY2hhbmdlU3RhdHVzID0gYXN5bmMgKGlkOiBzdHJpbmcsIHBheWxvYWQ6IElDaGFuZ2VTdGF0dXMpID0+IHtcbiAgY29uc3QgeyBzdGF0dXMgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YToge1xuICAgICAgc3RhdHVzLFxuICAgICAgLy8gcmVhY3RpdmF0aW5nIHByZXNlcnZlcyB0aGUgYWNjb3VudCB3aGlsZSBzdXNwZW5kaW5nIHJldm9rZXMgYWxsIHNlc3Npb25zXG4gICAgICAuLi4oc3RhdHVzID09PSBVc2VyU3RhdHVzLlNVU1BFTkRFRCAmJiB7IHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9KSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBzb2Z0IGRlbGV0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGRlbGV0ZVVzZXIgPSBhc3luYyAoaWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICBjb25zdCBkZWxldGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSwgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gZGVsZXRlZFVzZXI7XG59O1xuXG5leHBvcnQgY29uc3QgdXNlclNlcnZpY2UgPSB7XG4gIHVwZGF0ZVByb2ZpbGUsXG4gIGdldFVzZXJzLFxuICBjaGFuZ2VSb2xlLFxuICBjaGFuZ2VTdGF0dXMsXG4gIGRlbGV0ZVVzZXIsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUm9sZSwgVXNlclN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5cbmNvbnN0IHVwZGF0ZVByb2ZpbGVTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIG5hbWU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgICBwaG9uZTogelxuICAgICAgLnN0cmluZygpXG4gICAgICAudHJpbSgpXG4gICAgICAubWF4KDIwLCBcIlBob25lIG51bWJlciBpcyB0b28gbG9uZ1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gICAgYXZhdGFyVXJsOiB6LnN0cmluZygpLnRyaW0oKS51cmwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGltYWdlIFVSTFwiKS5vcHRpb25hbCgpLFxuICAgIGN1cnJlbnRQYXNzd29yZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgICBuZXdQYXNzd29yZDogelxuICAgICAgLnN0cmluZygpXG4gICAgICAubWluKDYsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBsZWFzdCA2IGNoYXJhY3RlcnNcIilcbiAgICAgIC5tYXgoNzIsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBtb3N0IDcyIGNoYXJhY3RlcnNcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICB9KVxuICAucmVmaW5lKFxuICAgIChkYXRhKSA9PlxuICAgICAgZGF0YS5uZXdQYXNzd29yZCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICBkYXRhLmN1cnJlbnRQYXNzd29yZCAhPT0gdW5kZWZpbmVkLFxuICAgIHsgbWVzc2FnZTogXCJDdXJyZW50IHBhc3N3b3JkIGlzIHJlcXVpcmVkIHRvIGNoYW5nZSBwYXNzd29yZFwiIH0sXG4gICk7XG5cbmNvbnN0IHVzZXJRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5vcHRpb25hbCgpLFxuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSkub3B0aW9uYWwoKSxcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oVXNlclN0YXR1cykub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCB1c2VyUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJVc2VyIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IGNoYW5nZVJvbGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlLCB7IHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgcm9sZVwiIH0pLFxufSk7XG5cbmNvbnN0IGNoYW5nZVN0YXR1c1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oVXNlclN0YXR1cywge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgc3RhdHVzXCIsXG4gIH0pLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRVcGRhdGVQcm9maWxlU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXBkYXRlUHJvZmlsZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUVXNlclF1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXNlclF1ZXJ5U2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IHVzZXJWYWxpZGF0aW9ucyA9IHtcbiAgdXBkYXRlUHJvZmlsZVNjaGVtYSxcbiAgdXNlclF1ZXJ5U2NoZW1hLFxuICB1c2VyUGFyYW1zU2NoZW1hLFxuICBjaGFuZ2VSb2xlU2NoZW1hLFxuICBjaGFuZ2VTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IG11bHRlciBmcm9tIFwibXVsdGVyXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB7IHVwbG9hZHNDb250cm9sbGVyIH0gZnJvbSBcIi4vdXBsb2Fkcy5jb250cm9sbGVyXCI7XG5cbmNvbnN0IHVwbG9hZCA9IG11bHRlcih7XG4gIHN0b3JhZ2U6IG11bHRlci5tZW1vcnlTdG9yYWdlKCksXG4gIGxpbWl0czogeyBmaWxlU2l6ZTogNSAqIDEwMjQgKiAxMDI0IH0sXG4gIGZpbGVGaWx0ZXI6IChfcmVxLCBmaWxlLCBjYikgPT4ge1xuICAgIGlmICgvXmltYWdlXFwvKGpwZWd8cG5nfHdlYnApJC8udGVzdChmaWxlLm1pbWV0eXBlKSkge1xuICAgICAgY2IobnVsbCwgdHJ1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKFxuICAgICAgICBPYmplY3QuYXNzaWduKG5ldyBFcnJvcihcIk9ubHkganBnLCBwbmcgb3Igd2VicCBpbWFnZXMgYXJlIGFsbG93ZWRcIiksIHtcbiAgICAgICAgICBjb2RlOiBcIklOVkFMSURfRklMRV9UWVBFXCIsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG4gIH0sXG59KTtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9pbWFnZVwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB1cGxvYWQuc2luZ2xlKFwiaW1hZ2VcIiksXG4gIHVwbG9hZHNDb250cm9sbGVyLnVwbG9hZEltYWdlLFxuKTtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5IH0gZnJvbSBcIi4vdXBsb2Fkcy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbi8vIFVwbG9hZCBhIHNpbmdsZSBpbWFnZSAoQUdFTlQvQURNSU4pIFx1MjE5MiBDbG91ZGluYXJ5XG5jb25zdCB1cGxvYWRJbWFnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGlmICghcmVxLmZpbGUpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW1hZ2UgZmlsZSBpcyByZXF1aXJlZFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeShyZXEuZmlsZSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJJbWFnZSB1cGxvYWRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgdXBsb2Fkc0NvbnRyb2xsZXIgPSB7XG4gIHVwbG9hZEltYWdlLFxufTsiLCAiaW1wb3J0IHsgdjIgYXMgY2xvdWRpbmFyeSB9IGZyb20gXCJjbG91ZGluYXJ5XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuY2xvdWRpbmFyeS5jb25maWcoe1xuICBjbG91ZF9uYW1lOiBjb25maWcuY2xvdWRpbmFyeV9jbG91ZF9uYW1lLFxuICBhcGlfa2V5OiBjb25maWcuY2xvdWRpbmFyeV9hcGlfa2V5LFxuICBhcGlfc2VjcmV0OiBjb25maWcuY2xvdWRpbmFyeV9hcGlfc2VjcmV0LFxufSk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsb3VkaW5hcnk7IiwgImltcG9ydCBjbG91ZGluYXJ5IGZyb20gXCIuLi8uLi9saWIvY2xvdWRpbmFyeVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5ID0gKFxuICBmaWxlOiBFeHByZXNzLk11bHRlci5GaWxlLFxuKTogUHJvbWlzZTx7IHVybDogc3RyaW5nOyBwdWJsaWNJZDogc3RyaW5nIH0+ID0+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCB1cGxvYWRTdHJlYW0gPSBjbG91ZGluYXJ5LnVwbG9hZGVyLnVwbG9hZF9zdHJlYW0oXG4gICAgICB7IGZvbGRlcjogXCJ0cmlwdmVyc2VcIiB9LFxuICAgICAgKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKGVycm9yIHx8ICFyZXN1bHQpIHtcbiAgICAgICAgICByZWplY3QobmV3IEFwcEVycm9yKDQwMCwgXCJJbWFnZSB1cGxvYWQgZmFpbGVkLiBQbGVhc2UgdHJ5IGFnYWluLlwiKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJlc29sdmUoeyB1cmw6IHJlc3VsdC5zZWN1cmVfdXJsLCBwdWJsaWNJZDogcmVzdWx0LnB1YmxpY19pZCB9KTtcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHVwbG9hZFN0cmVhbS5lbmQoZmlsZS5idWZmZXIpO1xuICB9KTtcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBjb250YWN0Q29udHJvbGxlciB9IGZyb20gXCIuL2NvbnRhY3QuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgY29udGFjdFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vY29udGFjdC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIHJvdXRlIChwdWJsaWMsIG5vIGF1dGgpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGNvbnRhY3RWYWxpZGF0aW9ucy5jcmVhdGVNZXNzYWdlU2NoZW1hIH0pLFxuICBjb250YWN0Q29udHJvbGxlci5jcmVhdGVNZXNzYWdlLFxuKTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIHJvdXRlIChhZG1pbiBvbmx5KVxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBjb250YWN0VmFsaWRhdGlvbnMuY29udGFjdFF1ZXJ5U2NoZW1hIH0pLFxuICBjb250YWN0Q29udHJvbGxlci5nZXRNZXNzYWdlcyxcbik7XG5cbi8vIDMuIE1hcmsgcmVzb2x2ZWQvdW5yZXNvbHZlZCByb3V0ZSAoYWRtaW4gb25seSlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBjb250YWN0VmFsaWRhdGlvbnMuY29udGFjdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBjb250YWN0VmFsaWRhdGlvbnMudXBkYXRlUmVzb2x2ZWRTY2hlbWEsXG4gIH0pLFxuICBjb250YWN0Q29udHJvbGxlci51cGRhdGVSZXNvbHZlZCxcbik7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgY29udGFjdFNlcnZpY2UgfSBmcm9tIFwiLi9jb250YWN0LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGNyZWF0ZU1lc3NhZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgY29udGFjdFNlcnZpY2UuY3JlYXRlTWVzc2FnZShyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJNZXNzYWdlIHNlbnQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbWVzc2FnZSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyBjb250cm9sbGVyIChhZG1pbiBvbmx5KVxuY29uc3QgZ2V0TWVzc2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb250YWN0U2VydmljZS5saXN0TWVzc2FnZXMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDb250YWN0IG1lc3NhZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gTWFyayByZXNvbHZlZC91bnJlc29sdmVkIGNvbnRyb2xsZXIgKGFkbWluIG9ubHkpXG5jb25zdCB1cGRhdGVSZXNvbHZlZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHsgaXNSZXNvbHZlZCB9ID0gcmVxLmJvZHk7XG5cbiAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgY29udGFjdFNlcnZpY2UucmVzb2x2ZU1lc3NhZ2UoaWQsIGlzUmVzb2x2ZWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIk1lc3NhZ2Ugc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbWVzc2FnZSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlTWVzc2FnZSxcbiAgZ2V0TWVzc2FnZXMsXG4gIHVwZGF0ZVJlc29sdmVkLFxufTsiLCAiaW1wb3J0IHsgUmVzZW5kIH0gZnJvbSBcInJlc2VuZFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cyB9IGZyb20gXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGFjdEVtYWlsRGV0YWlscyB7XG4gIG5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgc3ViamVjdDogc3RyaW5nO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGNyZWF0ZWRBdD86IERhdGU7XG59XG5cbi8vIExhemlseSBpbml0aWFsaXNlZCBzbyB0aGUgbW9kdWxlIGlzIGltcG9ydGFibGUgZXZlbiB3aGVuIFJFU0VORF9BUElfS0VZXG4vLyBpcyBub3QgY29uZmlndXJlZCAoZS5nLiBsb2NhbCBkZXYgLyBkZW1vIHdpdGhvdXQgZW1haWwpLlxubGV0IHJlc2VuZDogUmVzZW5kIHwgbnVsbCA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldFJlc2VuZCgpOiBSZXNlbmQgfCBudWxsIHtcbiAgaWYgKHJlc2VuZCkgcmV0dXJuIHJlc2VuZDtcbiAgaWYgKCFjb25maWcucmVzZW5kX2FwaV9rZXkpIHJldHVybiBudWxsO1xuICByZXNlbmQgPSBuZXcgUmVzZW5kKGNvbmZpZy5yZXNlbmRfYXBpX2tleSk7XG4gIHJldHVybiByZXNlbmQ7XG59XG5cbmZ1bmN0aW9uIGVzY2FwZUh0bWwodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcbiAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIilcbiAgICAucmVwbGFjZSgvXCIvZywgXCImcXVvdDtcIilcbiAgICAucmVwbGFjZSgvJy9nLCBcIiYjMDM5O1wiKTtcbn1cblxuLy8gV3JhcHMgYSBSZXNlbmQgc2VuZCBzbyBmYWlsdXJlcyBiZWNvbWUgYSBzaW5nbGUgY2xlYW4gd2FybmluZyBsaW5lIGluc3RlYWRcbi8vIG9mIHRoZSBTREsncyBub2lzeSBtdWx0aS1saW5lIGVycm9yLiBSZXNlbmQgY2FuIGxlZ2l0aW1hdGVseSByZWplY3Qgc2VuZHNcbi8vIChlLmcuIHRoZSBkZWZhdWx0IG9uYm9hcmRpbmdAcmVzZW5kLmRldiBzZW5kZXIgbWF5IG9ubHkgZGVsaXZlciB0byB0aGVcbi8vIGFjY291bnQgb3duZXIpLCBzbyBlbWFpbHMgYXJlIHN0cmljdGx5IGJlc3QtZWZmb3J0LlxuYXN5bmMgZnVuY3Rpb24gc2VuZFdpdGhMb2coXG4gIGNsaWVudDogUmVzZW5kLFxuICBzdWJqZWN0OiBzdHJpbmcsXG4gIHRvOiBzdHJpbmdbXSxcbiAgaHRtbDogc3RyaW5nLFxuICByZXBseVRvPzogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgY2xpZW50LmVtYWlscy5zZW5kKHtcbiAgICAgIGZyb206IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCIsXG4gICAgICB0byxcbiAgICAgIHN1YmplY3QsXG4gICAgICBodG1sLFxuICAgICAgLi4uKHJlcGx5VG8gPyB7IHJlcGx5VG8gfSA6IHt9KSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zdCBkZXRhaWwgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgY29uc29sZS53YXJuKGBbZW1haWxdIHNlbmQgZmFpbGVkICgke3N1YmplY3R9KSB0byAke3RvLmpvaW4oXCIsIFwiKX06ICR7ZGV0YWlsfWApO1xuICB9XG59XG5cbmNvbnN0IGVtYWlsTGF5b3V0ID0gKGNvbnRlbnQ6IHN0cmluZykgPT4gYFxuICA8ZGl2IHN0eWxlPVwiZm9udC1mYW1pbHk6IEFyaWFsLCBIZWx2ZXRpY2EsIHNhbnMtc2VyaWY7IG1heC13aWR0aDogNTYwcHg7IG1hcmdpbjogMCBhdXRvOyBjb2xvcjogIzFhMWExYTtcIj5cbiAgICA8ZGl2IHN0eWxlPVwiYmFja2dyb3VuZDogIzBmNzY2ZTsgcGFkZGluZzogMjRweDsgYm9yZGVyLXJhZGl1czogOHB4IDhweCAwIDA7XCI+XG4gICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAjZmZmZmZmOyBmb250LXNpemU6IDE4cHg7IGZvbnQtd2VpZ2h0OiBib2xkO1wiPlRyaXBWZXJzZTwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IHN0eWxlPVwiYm9yZGVyOiAxcHggc29saWQgI2U1ZTdlYjsgYm9yZGVyLXRvcDogbm9uZTsgcGFkZGluZzogMzJweDsgYm9yZGVyLXJhZGl1czogMCAwIDhweCA4cHg7XCI+XG4gICAgICAke2NvbnRlbnR9XG4gICAgPC9kaXY+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDEycHg7IGNvbG9yOiAjNmI3MjgwOyBtYXJnaW4tdG9wOiAxNnB4OyB0ZXh0LWFsaWduOiBjZW50ZXI7XCI+XG4gICAgICBZb3UgYXJlIHJlY2VpdmluZyB0aGlzIGVtYWlsIGJlY2F1c2Ugb2YgYWN0aXZpdHkgb24gVHJpcFZlcnNlLlxuICAgIDwvcD5cbiAgPC9kaXY+XG5gO1xuXG4vLyBOb3RpZmllcyB0aGUgc3VwcG9ydCBpbmJveCBhYm91dCBhIG5ldyBjb250YWN0IGZvcm0gc3VibWlzc2lvbi5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbiA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBjb250YWN0IG5vdGlmaWNhdGlvbi5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgY3JlYXRlZEF0ID0gZGV0YWlscy5jcmVhdGVkQXQ/LnRvSVNPU3RyaW5nKCkgPz8gXCJqdXN0IG5vd1wiO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPk5ldyBjb250YWN0IG1lc3NhZ2U8L2gyPlxuICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlOyBmb250LXNpemU6IDE0cHg7XCI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDsgd2lkdGg6IDEyMHB4O1wiPk5hbWU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+RW1haWw8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoZGV0YWlscy5lbWFpbCl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5TdWJqZWN0PC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5zdWJqZWN0KX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlJlY2VpdmVkPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGNyZWF0ZWRBdCl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgPC90YWJsZT5cbiAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDogMTZweDsgcGFkZGluZzogMTZweDsgYmFja2dyb3VuZDogI2Y5ZmFmYjsgYm9yZGVyLXJhZGl1czogNnB4OyB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XCI+XG4gICAgICAke2VzY2FwZUh0bWwoZGV0YWlscy5tZXNzYWdlKX1cbiAgICA8L2Rpdj5cbiAgYDtcblxuICBhd2FpdCBzZW5kV2l0aExvZyhcbiAgICBjbGllbnQsXG4gICAgYE5ldyBjb250YWN0IG1lc3NhZ2U6ICR7ZGV0YWlscy5zdWJqZWN0fWAsXG4gICAgW2NvbmZpZy5jb250YWN0X3JlY2VpdmVyX2VtYWlsXSxcbiAgICBlbWFpbExheW91dChjb250ZW50KSxcbiAgKTtcbn07XG5cbi8vIFNlbmRzIGEgY29uZmlybWF0aW9uIHJlcGx5IHRvIHRoZSBwZXJzb24gd2hvIHN1Ym1pdHRlZCB0aGUgZm9ybS5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdEF1dG9SZXBseSA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGNvbnRhY3QgYXV0by1yZXBseS5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgcmVjZWl2ZXJFbWFpbCA9IGNvbmZpZy5jb250YWN0X3JlY2VpdmVyX2VtYWlsO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPlRoYW5rcyBmb3IgcmVhY2hpbmcgb3V0LCAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0hPC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBXZSZhcG9zO3ZlIHJlY2VpdmVkIHlvdXIgbWVzc2FnZSBhYm91dFxuICAgICAgPHN0cm9uZz4mbGRxdW87JHtlc2NhcGVIdG1sKGRldGFpbHMuc3ViamVjdCl9JnJkcXVvOzwvc3Ryb25nPiBhbmQgb3VyIHN1cHBvcnRcbiAgICAgIHRlYW0gd2lsbCBnZXQgYmFjayB0byB5b3Ugd2l0aGluIG9uZSBidXNpbmVzcyBkYXkuXG4gICAgPC9wPlxuICBgO1xuXG4gIGF3YWl0IHNlbmRXaXRoTG9nKFxuICAgIGNsaWVudCxcbiAgICBcIldlIHJlY2VpdmVkIHlvdXIgbWVzc2FnZSAtIFRyaXBWZXJzZVwiLFxuICAgIFtkZXRhaWxzLmVtYWlsXSxcbiAgICBlbWFpbExheW91dChjb250ZW50KSxcbiAgICByZWNlaXZlckVtYWlsLFxuICApO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEJvb2tpbmcgZW1haWxzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGludGVyZmFjZSBJQm9va2luZ0VtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG4gIHRyYXZlbGVyczogbnVtYmVyO1xuICB0b3RhbFByaWNlOiBudW1iZXI7XG4gIHN0YXR1czogQm9va2luZ1N0YXR1cztcbn1cblxuLy8gSW5mb3JtcyB0aGUgY3VzdG9tZXIgYWJvdXQgYSBib29raW5nIGNyZWF0ZS9jb25maXJtL2NhbmNlbC5cbi8vIEJlc3QtZWZmb3J0IGxpa2UgdGhlIGNvbnRhY3QgZW1haWxzIFx1MjAxNCBhIGZhaWx1cmUgbXVzdCBuZXZlciBmYWlsIHRoZSByZXF1ZXN0LlxuZXhwb3J0IGNvbnN0IHNlbmRCb29raW5nRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElCb29raW5nRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhZGV0YWlscy5lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBib29raW5nIGVtYWlsLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB0cmF2ZWxEYXRlID0gZGV0YWlscy50cmF2ZWxEYXRlLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApO1xuXG4gIGNvbnN0IHN0YXR1c0NvcHk6IFJlY29yZDxcbiAgICBCb29raW5nU3RhdHVzLFxuICAgIHsgc3ViamVjdDogc3RyaW5nOyBoZWFkaW5nOiBzdHJpbmc7IGJvZHk6IHN0cmluZyB9XG4gID4gPSB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuUEVORElOR106IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyByZWNlaXZlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJCb29raW5nIHJlY2VpdmVkXCIsXG4gICAgICBib2R5OiBcIldlJ3ZlIHJlY2VpdmVkIHlvdXIgYm9va2luZyByZXF1ZXN0LiBUaGUgYWdlbnQgd2lsbCBjb25maXJtIGl0IHNob3J0bHkuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5QQUlEXToge1xuICAgICAgc3ViamVjdDogXCJQYXltZW50IHJlY2VpdmVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIlBheW1lbnQgcmVjZWl2ZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciBwYXltZW50IGhhcyBiZWVuIHJlY2VpdmVkLCBhbmQgdGhlIGFnZW50IHdpbGwgY29uZmlybSB5b3VyIGJvb2tpbmcgc2hvcnRseS5cIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyBjb25maXJtZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyBjb25maXJtZWRcIixcbiAgICAgIGJvZHk6IFwiR3JlYXQgbmV3cyBcdTIwMTQgeW91ciBib29raW5nIGhhcyBiZWVuIGNvbmZpcm1lZC4gV2UgbG9vayBmb3J3YXJkIHRvIGhvc3RpbmcgeW91IVwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXToge1xuICAgICAgc3ViamVjdDogXCJCb29raW5nIGNhbmNlbGxlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJCb29raW5nIGNhbmNlbGxlZFwiLFxuICAgICAgYm9keTogXCJZb3VyIGJvb2tpbmcgaGFzIGJlZW4gY2FuY2VsbGVkLiBJZiB0aGlzIHdhc24ndCBleHBlY3RlZCwgcGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNPTVBMRVRFRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiVHJpcCBjb21wbGV0ZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiVHJpcCBjb21wbGV0ZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciB0cmlwIGhhcyBiZWVuIG1hcmtlZCBhcyBjb21wbGV0ZWQuIFRoYW5rIHlvdSBmb3IgdHJhdmVsbGluZyB3aXRoIFRyaXBWZXJzZSFcIixcbiAgICB9LFxuICB9O1xuXG4gIGNvbnN0IGNvcHkgPSBzdGF0dXNDb3B5W2RldGFpbHMuc3RhdHVzXTtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj4ke2NvcHkuaGVhZGluZ308L2gyPlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxNHB4OyBsaW5lLWhlaWdodDogMS42OyBjb2xvcjogIzM3NDE1MTtcIj5cbiAgICAgIEhpICR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfSw8YnIvPlxuICAgICAgJHtjb3B5LmJvZHl9XG4gICAgPC9wPlxuICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlOyBmb250LXNpemU6IDE0cHg7XCI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDsgd2lkdGg6IDEyMHB4O1wiPlBhY2thZ2U8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLnBhY2thZ2VUaXRsZSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWwgZGF0ZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbCh0cmF2ZWxEYXRlKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRyYXZlbGVyczwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChTdHJpbmcoZGV0YWlscy50cmF2ZWxlcnMpKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRvdGFsPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4mIzI1NDc7JHtlc2NhcGVIdG1sKGRldGFpbHMudG90YWxQcmljZS50b0ZpeGVkKDIpKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICA8L3RhYmxlPlxuICBgO1xuXG4gIGF3YWl0IHNlbmRXaXRoTG9nKFxuICAgIGNsaWVudCxcbiAgICBjb3B5LnN1YmplY3QsXG4gICAgW2RldGFpbHMuZW1haWxdLFxuICAgIGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICApO1xufTtcblxuLy8gSW5mb3JtcyB0aGUgY3VzdG9tZXIgdGhhdCBhIHBhaWQgYm9va2luZyB3YXMgY2FuY2VsbGVkIGFuZCB0aGUgcGF5bWVudCBoYXNcbi8vIGJlZW4gcmVmdW5kZWQuIEJlc3QtZWZmb3J0IGxpa2UgdGhlIG90aGVyIGVtYWlscy5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlZnVuZEVtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG4gIGFtb3VudDogbnVtYmVyO1xuICByZWZ1bmRSZWZJZD86IHN0cmluZyB8IG51bGw7XG59XG5cbmV4cG9ydCBjb25zdCBzZW5kUmVmdW5kRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElSZWZ1bmRFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIHJlZnVuZCBlbWFpbC5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgdHJhdmVsRGF0ZSA9IGRldGFpbHMudHJhdmVsRGF0ZS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKTtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5SZWZ1bmQgaXNzdWVkPC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBIaSAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0sPGJyLz5cbiAgICAgIFlvdXIgYm9va2luZyB3YXMgY2FuY2VsbGVkLCBhbmQgPHN0cm9uZz4mIzI1NDc7JHtlc2NhcGVIdG1sKFxuICAgICAgICBkZXRhaWxzLmFtb3VudC50b0ZpeGVkKDIpLFxuICAgICAgKX08L3N0cm9uZz4gaGFzIGJlZW4gcmVmdW5kZWQgdG8geW91ciBvcmlnaW5hbCBwYXltZW50IG1ldGhvZC4gUGxlYXNlIGFsbG93XG4gICAgICA1LTEwIGJ1c2luZXNzIGRheXMgZm9yIHRoZSBtb25leSB0byBhcHBlYXIuXG4gICAgPC9wPlxuICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlOyBmb250LXNpemU6IDE0cHg7XCI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDsgd2lkdGg6IDEyMHB4O1wiPlBhY2thZ2U8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLnBhY2thZ2VUaXRsZSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWwgZGF0ZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbCh0cmF2ZWxEYXRlKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlJlZnVuZGVkIGFtb3VudDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChkZXRhaWxzLmFtb3VudC50b0ZpeGVkKDIpKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgICR7ZGV0YWlscy5yZWZ1bmRSZWZJZFxuICAgICAgICA/IGBcbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlJlZnVuZCByZWZlcmVuY2U8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoZGV0YWlscy5yZWZ1bmRSZWZJZCl9PC90ZD5cbiAgICAgIDwvdHI+YFxuICAgICAgICA6IFwiXCJ9XG4gICAgPC90YWJsZT5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTNweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICM2YjcyODA7IG1hcmdpbi10b3A6IDE2cHg7XCI+XG4gICAgICBJZiB5b3UgaGF2ZSBhbnkgcXVlc3Rpb25zIGFib3V0IHRoaXMgcmVmdW5kLCBwbGVhc2UgY29udGFjdCBzdXBwb3J0LlxuICAgIDwvcD5cbiAgYDtcblxuICBhd2FpdCBzZW5kV2l0aExvZyhcbiAgICBjbGllbnQsXG4gICAgXCJCb29raW5nIGNhbmNlbGxlZCAmIHJlZnVuZCBpc3N1ZWQgLSBUcmlwVmVyc2VcIixcbiAgICBbZGV0YWlscy5lbWFpbF0sXG4gICAgZW1haWxMYXlvdXQoY29udGVudCksXG4gICk7XG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQge1xuICBzZW5kQ29udGFjdEF1dG9SZXBseSxcbiAgc2VuZENvbnRhY3ROb3RpZmljYXRpb24sXG59IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgSUNvbnRhY3RRdWVyeSwgSUNyZWF0ZUNvbnRhY3RQYXlsb2FkIH0gZnJvbSBcIi4vY29udGFjdC5pbnRlcmZhY2VcIjtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSAocHVibGljKVxuY29uc3QgY3JlYXRlTWVzc2FnZSA9IGFzeW5jIChwYXlsb2FkOiBJQ3JlYXRlQ29udGFjdFBheWxvYWQpID0+IHtcbiAgY29uc3QgY3JlYXRlZE1lc3NhZ2UgPSBhd2FpdCBwcmlzbWEuY29udGFjdE1lc3NhZ2UuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICBuYW1lOiBwYXlsb2FkLm5hbWUsXG4gICAgICBlbWFpbDogcGF5bG9hZC5lbWFpbCxcbiAgICAgIHN1YmplY3Q6IHBheWxvYWQuc3ViamVjdCxcbiAgICAgIG1lc3NhZ2U6IHBheWxvYWQubWVzc2FnZSxcbiAgICB9LFxuICB9KTtcblxuICAvLyBFbWFpbHMgYXJlIGJlc3QtZWZmb3J0OiBhIGZhaWx1cmUgaGVyZSBtdXN0IG5ldmVyIGZhaWwgdGhlIHN1Ym1pc3Npb25cbiAgLy8gKHRoZSBtZXNzYWdlIGlzIGFscmVhZHkgc2F2ZWQgdG8gdGhlIGluYm94KS5cbiAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbih7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgICBzZW5kQ29udGFjdEF1dG9SZXBseSh7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIGNyZWF0ZWRNZXNzYWdlO1xufTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIChhZG1pbiBvbmx5LCBwYWdpbmF0ZWQsIGZpbHRlcmFibGUgYnkgaXNSZXNvbHZlZClcbmNvbnN0IGxpc3RNZXNzYWdlcyA9IGFzeW5jIChxdWVyeTogSUNvbnRhY3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VXaGVyZUlucHV0IHwgdW5kZWZpbmVkID1cbiAgICBxdWVyeS5pc1Jlc29sdmVkID09PSB1bmRlZmluZWRcbiAgICAgID8gdW5kZWZpbmVkXG4gICAgICA6IHsgaXNSZXNvbHZlZDogcXVlcnkuaXNSZXNvbHZlZCB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gMy4gTWFyayBhIGNvbnRhY3QgbWVzc2FnZSByZXNvbHZlZC91bnJlc29sdmVkIChhZG1pbiBvbmx5KVxuY29uc3QgcmVzb2x2ZU1lc3NhZ2UgPSBhc3luYyAoaWQ6IHN0cmluZywgaXNSZXNvbHZlZDogYm9vbGVhbikgPT4ge1xuICByZXR1cm4gcHJpc21hLmNvbnRhY3RNZXNzYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IGlzUmVzb2x2ZWQgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgY29udGFjdFNlcnZpY2UgPSB7XG4gIGNyZWF0ZU1lc3NhZ2UsXG4gIGxpc3RNZXNzYWdlcyxcbiAgcmVzb2x2ZU1lc3NhZ2UsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVNZXNzYWdlU2NoZW1hID0gei5vYmplY3Qoe1xuICBuYW1lOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAubWluKDIsIFwiTmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpLFxuICBlbWFpbDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFbWFpbCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5lbWFpbChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWwgYWRkcmVzc1wiKSxcbiAgc3ViamVjdDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJTdWJqZWN0IGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIlN1YmplY3QgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDIwMCwgXCJTdWJqZWN0IG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKSxcbiAgbWVzc2FnZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJNZXNzYWdlIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigxMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbGVhc3QgMTAgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMjAwMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbW9zdCAyMDAwIGNoYXJhY3RlcnNcIiksXG59KS5zdHJpY3QoKTtcblxuY29uc3QgY29udGFjdFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBpc1Jlc29sdmVkOiB6XG4gICAgLmVudW0oW1widHJ1ZVwiLCBcImZhbHNlXCJdKVxuICAgIC5vcHRpb25hbCgpXG4gICAgLnRyYW5zZm9ybSgodmFsKSA9PiAodmFsID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiB2YWwgPT09IFwidHJ1ZVwiKSksXG59KTtcblxuY29uc3QgY29udGFjdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTWVzc2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVSZXNvbHZlZFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgaXNSZXNvbHZlZDogei5ib29sZWFuKHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcImlzUmVzb2x2ZWQgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJpc1Jlc29sdmVkIG11c3QgYmUgYSBib29sZWFuXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiB0eXBlb2YgZGF0YS5pc1Jlc29sdmVkID09PSBcImJvb2xlYW5cIiwge1xuICAgIG1lc3NhZ2U6IFwiaXNSZXNvbHZlZCBtdXN0IGJlIGEgYm9vbGVhblwiLFxuICB9KTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlTWVzc2FnZVNjaGVtYSxcbiAgY29udGFjdFF1ZXJ5U2NoZW1hLFxuICBjb250YWN0UGFyYW1zU2NoZW1hLFxuICB1cGRhdGVSZXNvbHZlZFNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBib29raW5nQ29udHJvbGxlciB9IGZyb20gXCIuL2Jvb2tpbmcuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYm9va2luZ1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYm9va2luZy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBDcmVhdGUgYm9va2luZyAoY3VzdG9tZXIgb25seSBcdTIwMTQgYWdlbnRzIHNlbGwsIGFkbWlucyBtYW5hZ2UpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYm9va2luZ1ZhbGlkYXRpb25zLmNyZWF0ZVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuY3JlYXRlQm9va2luZyxcbik7XG5cbi8vIE15IGJvb2tpbmdzIFx1MjAxNCBvd24gYm9va2luZ3Mgd2l0aCBmaWx0ZXJzICsgcGFnaW5hdGlvbiAob3duZXIgaXMgYWx3YXlzIFVTRVIpXG4vLyBOT1RFOiByZWdpc3RlcmVkIGJlZm9yZSBcIi86aWRcIiBzbyB0aGUgcGFyYW0gcm91dGUgZG9lc24ndCBzd2FsbG93IGl0Llxucm91dGVyLmdldChcbiAgXCIvbXktYm9va2luZ3NcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0TXlCb29raW5ncyxcbik7XG5cbi8vIEFnZW50IGJvb2tpbmdzIFx1MjAxNCBzY29wZWQgdG8gcGFja2FnZXMgdGhlIGFnZW50IG93bnNcbnJvdXRlci5nZXQoXG4gIFwiL2FnZW50LWJvb2tpbmdzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBZ2VudEJvb2tpbmdzLFxuKTtcblxuLy8gQm9va2luZyBkZXRhaWwgXHUyMDE0IG93bmVyIC8gcGFja2FnZSBhZ2VudCAvIGFkbWluXG5yb3V0ZXIuZ2V0KFxuICBcIi86aWRcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRCb29raW5nRGV0YWlsLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IGFsbCBib29raW5nc1xucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBbGxCb29raW5ncyxcbik7XG5cbi8vIFN0YXR1cyB0cmFuc2l0aW9uIFx1MjAxNCB2YWxpZGF0ZWQgYWdhaW5zdCB0aGUgc3RhdGUgbWFjaGluZSBpbiB0aGUgc2VydmljZVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJvb2tpbmdWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBib29raW5nQ29udHJvbGxlci51cGRhdGVCb29raW5nU3RhdHVzLFxuKTtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBib29raW5nU2VydmljZSB9IGZyb20gXCIuL2Jvb2tpbmcuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbmNvbnN0IGNyZWF0ZUJvb2tpbmcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmNyZWF0ZUJvb2tpbmcodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJCb29raW5nIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldE15Qm9va2luZ3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0TXlCb29raW5ncyh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRBZ2VudEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEFnZW50Qm9va2luZ3ModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0Qm9va2luZ0RldGFpbCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEJvb2tpbmdEZXRhaWwoaWQsIHJlcS51c2VyISk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldEFsbEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0QWxsQm9va2luZ3MocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IHVwZGF0ZUJvb2tpbmdTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS51cGRhdGVCb29raW5nU3RhdHVzKFxuICAgICAgaWQsXG4gICAgICByZXEuYm9keSxcbiAgICAgIHJlcS51c2VyISxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmcgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBib29raW5nQ29udHJvbGxlciA9IHtcbiAgY3JlYXRlQm9va2luZyxcbiAgZ2V0TXlCb29raW5ncyxcbiAgZ2V0QWdlbnRCb29raW5ncyxcbiAgZ2V0Qm9va2luZ0RldGFpbCxcbiAgZ2V0QWxsQm9va2luZ3MsXG4gIHVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59OyIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5cbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZy9pbmRleFwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuLy8gUGF5bWVudCBpcyBhbiBvcHRpb25hbCBmZWF0dXJlOiB0aGUgQVBJIG11c3QgYm9vdCBhbmQgc2VydmUgZXZlcnl0aGluZyBlbHNlXG4vLyBldmVuIHdoZW4gdGhlIFNTTENvbW1lcnogc3RvcmUgaXNuJ3QgY29uZmlndXJlZCB5ZXQuIFRoZXNlIHRocm93IGEgY2xlYW4gNDAwXG4vLyBvbiB0aGUgcGF5bWVudC1vbmx5IHBhdGhzIHJhdGhlciB0aGFuIGNyYXNoIHRoZSB3aG9sZSBkZXBsb3ltZW50IGF0IGJvb3QuXG5jb25zdCByZXF1aXJlQ29uZmlnID0gKCkgPT4ge1xuICBpZiAoIWNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9pZCB8fCAhY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJTU0xDb21tZXJ6IGlzIG5vdCBjb25maWd1cmVkLiBTZXQgU1NMX0NPTU1FUlpfU1RPUkVfSUQgYW5kIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELlwiLFxuICAgICk7XG4gIH1cbiAgaWYgKCFjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJTU0xDb21tZXJ6IGlzIG5vdCBjb25maWd1cmVkLiBTZXQgQkFDS0VORF9QVUJMSUNfVVJMIHRvIHRoZSBwdWJsaWNseSByZWFjaGFibGUgYmFja2VuZCBVUkwuXCIsXG4gICAgKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHN0b3JlSWQ6IGNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9pZCxcbiAgICBzdG9yZVBhc3N3b3JkOiBjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfcGFzc3dvcmQsXG4gIH07XG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpJbml0UmVzdWx0IHtcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGZhaWxlZHJlYXNvbj86IHN0cmluZztcbiAgc2Vzc2lvbmtleT86IHN0cmluZztcbiAgR2F0ZXdheVBhZ2VVUkw/OiBzdHJpbmc7XG4gIFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCB7XG4gIHN0YXR1czogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbiAgdmFsX2lkPzogc3RyaW5nO1xuICBhbW91bnQ/OiBzdHJpbmc7XG4gIGN1cnJlbmN5Pzogc3RyaW5nO1xuICBiYW5rX3RyYW5faWQ/OiBzdHJpbmc7XG4gIGNhcmRfdHlwZT86IHN0cmluZztcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQge1xuICBBUElDb25uZWN0Pzogc3RyaW5nO1xuICBzdGF0dXM/OiBzdHJpbmc7IC8vIHN1Y2Nlc3MgfCBmYWlsZWQgfCBwcm9jZXNzaW5nXG4gIGVycm9yUmVhc29uPzogc3RyaW5nO1xuICByZWZ1bmRfcmVmX2lkPzogc3RyaW5nO1xuICBiYW5rX3RyYW5faWQ/OiBzdHJpbmc7XG4gIHRyYW5zX2lkPzogc3RyaW5nO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbi8vIFNTTENvbW1lcnogdHJ1bmNhdGVzIHRyYW5faWQgdG8gMzAgY2hhcnMgXHUyMDE0IGRhdGUgKyB0aW1lICsgcmFuZG9tIHNhbHQgc3RheXMgc2FmZWx5IHVuZGVyLlxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlVHJhbklkKCk6IHN0cmluZyB7XG4gIHJldHVybiBgVFJOWF9JRC0ke0RhdGUubm93KCl9LSR7cmFuZG9tVVVJRCgpLnJlcGxhY2UoLy0vZywgXCJcIikuc2xpY2UoMCwgOCl9YDtcbn1cblxuLy8gSW5pdGlhdGVzIGEgZ2F0ZXdheSBzZXNzaW9uLiBTZXJ2ZXItdG8tc2VydmVyIFBPU1QsIGZvcm0tZW5jb2RlZC4gVGhlIGdhdGV3YXlcbi8vIHJlc3BvbmRzIHdpdGggdGhlIGhvc3RlZCBjaGVja291dCBVUkwgKEdhdGV3YXlQYWdlVVJMKSB0aGUgY3VzdG9tZXIgaXMgc2VudCB0by5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6SW5pdChvcHRpb25zOiB7XG4gIHRvdGFsX2Ftb3VudDogbnVtYmVyO1xuICB0cmFuX2lkOiBzdHJpbmc7XG4gIHN1Y2Nlc3NfdXJsOiBzdHJpbmc7XG4gIGZhaWxfdXJsOiBzdHJpbmc7XG4gIGNhbmNlbF91cmw6IHN0cmluZztcbiAgaXBuX3VybDogc3RyaW5nO1xuICBjdXNfbmFtZTogc3RyaW5nO1xuICBjdXNfZW1haWw6IHN0cmluZztcbiAgY3VzX3Bob25lOiBzdHJpbmc7XG59KTogUHJvbWlzZTxTc2xjb21tZXJ6SW5pdFJlc3VsdD4ge1xuICBjb25zdCB7IHN0b3JlSWQsIHN0b3JlUGFzc3dvcmQgfSA9IHJlcXVpcmVDb25maWcoKTtcbiAgY29uc3QgYm9keSA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICB0b3RhbF9hbW91bnQ6IG9wdGlvbnMudG90YWxfYW1vdW50LnRvRml4ZWQoMiksXG4gICAgY3VycmVuY3k6IFwiQkRUXCIsXG4gICAgdHJhbl9pZDogb3B0aW9ucy50cmFuX2lkLFxuICAgIHN1Y2Nlc3NfdXJsOiBvcHRpb25zLnN1Y2Nlc3NfdXJsLFxuICAgIGZhaWxfdXJsOiBvcHRpb25zLmZhaWxfdXJsLFxuICAgIGNhbmNlbF91cmw6IG9wdGlvbnMuY2FuY2VsX3VybCxcbiAgICBpcG5fdXJsOiBvcHRpb25zLmlwbl91cmwsXG4gICAgY3VzX25hbWU6IG9wdGlvbnMuY3VzX25hbWUsXG4gICAgY3VzX2VtYWlsOiBvcHRpb25zLmN1c19lbWFpbCxcbiAgICBjdXNfYWRkMTogXCJOL0FcIixcbiAgICBjdXNfYWRkMjogXCJOL0FcIixcbiAgICBjdXNfY2l0eTogXCJOL0FcIixcbiAgICBjdXNfc3RhdGU6IFwiTi9BXCIsXG4gICAgY3VzX3Bvc3Rjb2RlOiBcIjEwMDBcIixcbiAgICBjdXNfY291bnRyeTogXCJCYW5nbGFkZXNoXCIsXG4gICAgY3VzX3Bob25lOiBvcHRpb25zLmN1c19waG9uZSxcbiAgICBwcm9kdWN0X25hbWU6IFwiVHJpcFZlcnNlIFRvdXIgQm9va2luZ1wiLFxuICAgIHNoaXBwaW5nX21ldGhvZDogXCJOT1wiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChjb25maWcuc3NsY29tbWVyel9pbml0X3VybCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIH0sXG4gICAgYm9keTogYm9keS50b1N0cmluZygpLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IGluaXQgZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IGluaXQgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuXG4gIC8vIFRoZSBnYXRld2F5IHJlcG9ydHMgc3RhdHVzIGluIFVQUEVSQ0FTRSAoXCJTVUNDRVNTXCIgLyBcIkZBSUxFRFwiKTsgYW55IG90aGVyXG4gIC8vIHN0YXR1cywgb3IgYSBzdWNjZXNzIHdpdGhvdXQgdGhlIGhvc3RlZCBjaGVja291dCBVUkwsIGlzIGEgZmFpbGVkIGluaXQuXG4gIGlmIChkYXRhLnN0YXR1cyAhPT0gXCJTVUNDRVNTXCIgfHwgIWRhdGEuR2F0ZXdheVBhZ2VVUkwpIHtcbiAgICBjb25zdCByZWFzb24gPSBkYXRhLmZhaWxlZHJlYXNvbiB8fCBkYXRhLnN0YXR1cyB8fCBcInVua25vd25cIjtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtzc2xjb21tZXJ6XSBpbml0IHJlamVjdGVkICh1cmw9JHtjb25maWcuc3NsY29tbWVyel9pbml0X3VybH0sIHNhbmRib3g9JHtjb25maWcuc3NsX2NvbW1lcnpfc2FuZGJveH0pOiAke3JlYXNvbn1gLFxuICAgICAgZGF0YSxcbiAgICApO1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDUwMixcbiAgICAgIGBTU0xDb21tZXJ6IGluaXQgcmVqZWN0ZWQ6ICR7cmVhc29ufS4gQ2hlY2sgU1NMX0NPTU1FUlpfU1RPUkVfSUQsIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELCBTU0xfQ09NTUVSWl9TQU5EQk9YIGFuZCBTU0xDT01NRVJaX0lOSVRfVVJMIChzZWUgc2VydmVyIGxvZ3MpLmAsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn1cblxuLy8gU2VydmVyLXNpZGUgdmVyaWZpY2F0aW9uIG9mIGEgY29tcGxldGVkIHRyYW5zYWN0aW9uLiBzdGF0dXM6IFZBTElEIC8gVkFMSURBVEVEIC9cbi8vIElOVkFMSURfVFJBTlNBQ1RJT04gLyBGQUlMRUQuIFZBTElEQVRFRCBtZWFucyB0aGUgdHJhbnNhY3Rpb24gd2FzIHZlcmlmaWVkIGJlZm9yZVxuLy8gKGlkZW1wb3RlbnQpLCBJTlZBTElEX1RSQU5TQUNUSU9OIG1lYW5zIHRoZSBhbW91bnQvdHJhbnNhY3Rpb24gbWlzbWF0Y2hlcy5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6VmFsaWRhdGUob3B0aW9uczoge1xuICB2YWxfaWQ6IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0PiB7XG4gIGNvbnN0IHsgc3RvcmVJZCwgc3RvcmVQYXNzd29yZCB9ID0gcmVxdWlyZUNvbmZpZygpO1xuICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICB2YWxfaWQ6IG9wdGlvbnMudmFsX2lkLFxuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICBmb3JtYXQ6IFwianNvblwiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHtjb25maWcuc3NsY29tbWVyel92YWxpZGF0ZV91cmx9PyR7cGFyYW1zLnRvU3RyaW5nKCl9YCwge1xuICAgIG1ldGhvZDogXCJHRVRcIixcbiAgfSk7XG5cbiAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBgU1NMQ29tbWVyeiB2YWxpZGF0aW9uIGZhaWxlZCAoJHtyZXMuc3RhdHVzfSlgKTtcblxuICBsZXQgZGF0YTogU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ7XG4gIHRyeSB7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UodGV4dCkgYXMgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIFwiU1NMQ29tbWVyeiB2YWxpZGF0aW9uIHJldHVybmVkIGEgbm9uLUpTT04gcmVzcG9uc2VcIik7XG4gIH1cbiAgcmV0dXJuIGRhdGE7XG59XG5cbi8vIEluaXRpYXRlcyBhIHJlZnVuZCBhZ2FpbnN0IGEgc2V0dGxlZCB0cmFuc2FjdGlvbi4gYmFua190cmFuX2lkIGlzIHRoZVxuLy8gb3JpZ2luYWwgdHJhbnNhY3Rpb24ncyBiYW5rIHRyYW5zYWN0aW9uIElEIGNhcHR1cmVkIGF0IHBheW1lbnQgdGltZS5cbi8vIHN0YXR1czogc3VjY2VzcyAoaW5pdGlhdGVkKSB8IGZhaWxlZCB8IHByb2Nlc3NpbmcgKGFscmVhZHkgaW5pdGlhdGVkKS5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6UmVmdW5kKG9wdGlvbnM6IHtcbiAgYmFua190cmFuX2lkOiBzdHJpbmc7XG4gIHJlZnVuZF9hbW91bnQ6IG51bWJlcjtcbiAgcmVmdW5kX3JlbWFya3M6IHN0cmluZztcbiAgcmVmZV9pZD86IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ+IHtcbiAgY29uc3QgeyBzdG9yZUlkLCBzdG9yZVBhc3N3b3JkIH0gPSByZXF1aXJlQ29uZmlnKCk7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIGJhbmtfdHJhbl9pZDogb3B0aW9ucy5iYW5rX3RyYW5faWQsXG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIHJlZnVuZF9hbW91bnQ6IG9wdGlvbnMucmVmdW5kX2Ftb3VudC50b0ZpeGVkKDIpLFxuICAgIHJlZnVuZF9yZW1hcmtzOiBvcHRpb25zLnJlZnVuZF9yZW1hcmtzLFxuICAgIGZvcm1hdDogXCJqc29uXCIsXG4gICAgdjogXCIxXCIsXG4gIH0pO1xuICBpZiAob3B0aW9ucy5yZWZlX2lkKSBwYXJhbXMuc2V0KFwicmVmZV9pZFwiLCBvcHRpb25zLnJlZmVfaWQpO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2NvbmZpZy5zc2xjb21tZXJ6X3JlZnVuZF91cmx9PyR7cGFyYW1zLnRvU3RyaW5nKCl9YCwge1xuICAgIG1ldGhvZDogXCJHRVRcIixcbiAgfSk7XG5cbiAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBgU1NMQ29tbWVyeiByZWZ1bmQgZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6UmVmdW5kUmVzdWx0O1xuICB0cnkge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKHRleHQpIGFzIFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIFwiU1NMQ29tbWVyeiByZWZ1bmQgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn0iLCAiaW1wb3J0IHsgTm90aWZpY2F0aW9uVHlwZSB9IGZyb20gXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vbGliL3ByaXNtYVwiO1xuXG4vLyBCZXN0LWVmZm9ydCBpbi1hcHAgbm90aWZpY2F0aW9uIFx1MjAxNCBtaXJyb3JzIHRoZSBlbWFpbCBoZWxwZXJzLiBBIGZhaWx1cmUgaXNcbi8vIGxvZ2dlZCBhbmQgc3dhbGxvd2VkLCBuZXZlciB0aHJvd24sIHNvIGEgbm90aWZpY2F0aW9uIGluc2VydCBjYW4ndCBmYWlsIHRoZVxuLy8gYnVzaW5lc3Mgd3JpdGUgdGhhdCBjYXVzZWQgaXQuIENhbGwgc2l0ZXMgZmlyZSBpdCBhc1xuLy8gYHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtub3RpZnkoLi4uKV0pYC5cbmV4cG9ydCBjb25zdCBub3RpZnkgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICB0eXBlOiBOb3RpZmljYXRpb25UeXBlLFxuICB0aXRsZTogc3RyaW5nLFxuICBtZXNzYWdlOiBzdHJpbmcsXG4gIGxpbms/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBwcmlzbWEubm90aWZpY2F0aW9uLmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7IHVzZXJJZCwgdHlwZSwgdGl0bGUsIG1lc3NhZ2UsIGxpbmsgfSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtub3RpZmljYXRpb25dIGZhaWxlZCB0byBjcmVhdGUgJHt0eXBlfSBmb3IgdXNlciAke3VzZXJJZH06ICR7XG4gICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKVxuICAgICAgfWAsXG4gICAgKTtcbiAgfVxufTsiLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzLCBOb3RpZmljYXRpb25UeXBlLCBQYWNrYWdlU3RhdHVzLCBQYXltZW50U3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc3NsY29tbWVyelJlZnVuZCB9IGZyb20gXCIuLi8uLi9saWIvc3NsY29tbWVyelwiO1xuaW1wb3J0IHsgc2VuZEJvb2tpbmdFbWFpbCwgc2VuZFJlZnVuZEVtYWlsIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQgeyBub3RpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvbm90aWZpY2F0aW9uXCI7XG5pbXBvcnQge1xuICBJQm9va2luZ1F1ZXJ5LFxuICBJQm9va2luZ1NlYXJjaFF1ZXJ5LFxuICBJQ3JlYXRlQm9va2luZyxcbiAgSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59IGZyb20gXCIuL2Jvb2tpbmcuaW50ZXJmYWNlXCI7XG5cbi8vIEEgUEVORElORyBib29raW5nIG9sZGVyIHRoYW4gdGhpcyBpcyB0cmVhdGVkIGFzIGFuIGFiYW5kb25lZCBjaGVja291dDpcbi8vIGl0J3MgYXV0by1jYW5jZWxsZWQgc28gdGhlIHVzZXIgY2FuIHJlYm9vayB0aGUgc2FtZSBwYWNrYWdlK2RhdGUuXG5jb25zdCBTVEFMRV9CT09LSU5HX0hPVVJTID0gMjQ7XG5cbmNvbnN0IHRvVVRDTWlkbmlnaHQgPSAoZGF0ZTogRGF0ZSkgPT5cbiAgbmV3IERhdGUoXG4gICAgRGF0ZS5VVEMoZGF0ZS5nZXRVVENGdWxsWWVhcigpLCBkYXRlLmdldFVUQ01vbnRoKCksIGRhdGUuZ2V0VVRDRGF0ZSgpKSxcbiAgKTtcblxuLy8gXHUyNTAwXHUyNTAwIEFjdG9yICsgb3duZXJzaGlwIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxudHlwZSBCb29raW5nQWN0b3IgPSB7IGlkOiBzdHJpbmc7IHJvbGU6IFJvbGUgfTtcblxuLy8gU3RydWN0dXJhbCBzdWJzZXQgXHUyMDE0IG9ubHkgd2hhdCB0aGUgb3duZXJzaGlwIGNoZWNrcyBuZWVkLlxudHlwZSBCb29raW5nT3duZXJJbmZvID0ge1xuICB1c2VySWQ6IHN0cmluZztcbiAgcGFja2FnZTogeyBhZ2VudElkOiBzdHJpbmcgfTtcbn07XG5cbi8vIEJvb2tpbmcgb3duZXIsIHRoZSBBR0VOVCB3aG8gb3ducyB0aGUgcGFja2FnZSwgb3IgQURNSU4gXHUyMDE0IGZ1bGwgbWFuYWdlIHNjb3BlLlxuY29uc3QgY2FuTWFuYWdlID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGJvb2tpbmcudXNlcklkID09PSBhY3Rvci5pZCB8fFxuICAoYWN0b3Iucm9sZSA9PT0gUm9sZS5BR0VOVCAmJiBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWQpIHx8XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU47XG5cbi8vIE9ubHkgdGhlIHBhY2thZ2Utb3duaW5nIEFHRU5UIG9yIEFETUlOIGNhbiBtb3ZlIGEgYm9va2luZydzIG1vbmV5IHN0YXR1c1xuLy8gKFBFTkRJTkdcdTIxOTJDT05GSVJNRUQsIENPTkZJUk1FRFx1MjE5MkNPTVBMRVRFRCwgQ09ORklSTUVEXHUyMTkyUEVORElORykuXG5jb25zdCBpc0FnZW50T3duZXJPckFkbWluID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU4gfHxcbiAgKGFjdG9yLnJvbGUgPT09IFJvbGUuQUdFTlQgJiYgYm9va2luZy5wYWNrYWdlLmFnZW50SWQgPT09IGFjdG9yLmlkKTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXRlIG1hY2hpbmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG50eXBlIFRyYW5zaXRpb25SdWxlID0ge1xuICBhbGxvd2VkOiAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT4gYm9vbGVhbjtcbiAgcmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkPzogYm9vbGVhbjtcbiAgYmVmb3JlVHJhdmVsRGF0ZT86IGJvb2xlYW47XG59O1xuXG5jb25zdCBUUkFOU0lUSU9OUzogUGFydGlhbDxcbiAgUmVjb3JkPEJvb2tpbmdTdGF0dXMsIFBhcnRpYWw8UmVjb3JkPEJvb2tpbmdTdGF0dXMsIFRyYW5zaXRpb25SdWxlPj4+XG4+ID0ge1xuICBbQm9va2luZ1N0YXR1cy5QRU5ESU5HXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHsgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbiB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHsgYWxsb3dlZDogY2FuTWFuYWdlIH0sXG4gIH0sXG4gIFtCb29raW5nU3RhdHVzLlBBSURdOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXTogeyBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXTogeyBhbGxvd2VkOiBjYW5NYW5hZ2UgfSxcbiAgfSxcbiAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTVBMRVRFRF06IHtcbiAgICAgIGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4sXG4gICAgICByZXF1aXJlc1RyYXZlbERhdGVQYXNzZWQ6IHRydWUsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7IGFsbG93ZWQ6IGNhbk1hbmFnZSB9LFxuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluLFxuICAgICAgYmVmb3JlVHJhdmVsRGF0ZTogdHJ1ZSxcbiAgICB9LFxuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlc3BvbnNlIG1hcHBpbmcgKERlY2ltYWwgXHUyMTkyIE51bWJlcikgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBib29raW5nUGFja2FnZVNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdGl0bGU6IHRydWUsXG4gICAgc2x1ZzogdHJ1ZSxcbiAgICBsb2NhdGlvbjogdHJ1ZSxcbiAgICBpbWFnZXM6IHRydWUsXG4gICAgcHJpY2U6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG4vLyBEZXRhaWwgdmlldyBhZGRzIGFnZW50SWQgKG5lZWRlZCBieSBvd25lcnNoaXAgY2hlY2tzIGluIHRoZSBzZXJ2aWNlKS5cbmNvbnN0IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0aXRsZTogdHJ1ZSxcbiAgICBzbHVnOiB0cnVlLFxuICAgIGxvY2F0aW9uOiB0cnVlLFxuICAgIGltYWdlczogdHJ1ZSxcbiAgICBwcmljZTogdHJ1ZSxcbiAgICBhZ2VudElkOiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxuY29uc3QgYm9va2luZ1VzZXJTZWxlY3QgPSB7XG4gIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnQgbGVkZ2VyIHNob3duIG9uIHRoZSBib29raW5nIGRldGFpbCBwYWdlIChhbW91bnRzIHN0YXkgRGVjaW1hbCBpbiBEQikuXG5jb25zdCBib29raW5nUGF5bWVudFNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdHJhbklkOiB0cnVlLFxuICAgIGFtb3VudDogdHJ1ZSxcbiAgICBjdXJyZW5jeTogdHJ1ZSxcbiAgICBzdGF0dXM6IHRydWUsXG4gICAgY2FyZFR5cGU6IHRydWUsXG4gICAgYmFua1RyYW5JZDogdHJ1ZSxcbiAgICB2YWxJZDogdHJ1ZSxcbiAgICBwYWlkQXQ6IHRydWUsXG4gICAgcmVmdW5kUmVmSWQ6IHRydWUsXG4gICAgcmVmdW5kZWRBdDogdHJ1ZSxcbiAgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnRzIG9yZGVyZWQgbmV3ZXN0LWZpcnN0IHNvIGNvbnN1bWVycyBjYW4gcmVseSBvbiBwYXltZW50c1swXSBiZWluZyB0aGVcbi8vIGxhdGVzdCBhdHRlbXB0ICh1c2VkIGZvciB0aGUgdXNlciBwYXltZW50LWhpc3RvcnkgXCJsYXRlc3Qgc3RhdHVzXCIgcm93KS5cbmNvbnN0IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgPSB7XG4gIC4uLmJvb2tpbmdQYXltZW50U2VsZWN0LFxuICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgYXMgY29uc3QgfSxcbn0gYXMgY29uc3Q7XG5cbnR5cGUgQm9va2luZ1dpdFBhY2thZ2UgPSBQcmlzbWEuQm9va2luZ0dldFBheWxvYWQ8e1xuICBpbmNsdWRlOiB7IHBhY2thZ2U6IHR5cGVvZiBib29raW5nUGFja2FnZVNlbGVjdCB9O1xufT47XG5cbi8vIFBheW1lbnRzIHNob3cgb24gbGlzdCByb3dzIHRvbyAoRG9EOiBcImxpc3QvZGV0YWlsIG5vdyBpbmNsdWRlcyBwYXltZW50c1wiKSxcbi8vIG1hcHBlZCB0byBOdW1iZXIgYXQgdGhlIGJvdW5kYXJ5IGxpa2UgdGhlIHJlc3Qgb2YgdGhlIG1vbmV5IGZpZWxkcy5cbnR5cGUgQm9va2luZ1BheW1lbnRJdGVtID0ge1xuICBpZDogc3RyaW5nO1xuICB0cmFuSWQ6IHN0cmluZztcbiAgYW1vdW50OiB1bmtub3duO1xuICBjdXJyZW5jeTogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgY2FyZFR5cGU6IHN0cmluZyB8IG51bGw7XG4gIGJhbmtUcmFuSWQ6IHN0cmluZyB8IG51bGw7XG4gIHZhbElkOiBzdHJpbmcgfCBudWxsO1xuICBwYWlkQXQ6IERhdGUgfCBudWxsO1xufTtcblxuY29uc3QgbWFwQm9va2luZ0xpc3QgPSAoYm9va2luZzogQm9va2luZ1dpdFBhY2thZ2UgJiB7IHBheW1lbnRzPzogQm9va2luZ1BheW1lbnRJdGVtW10gfSkgPT4gKHtcbiAgLi4uYm9va2luZyxcbiAgdG90YWxQcmljZTogTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSksXG4gIHBhY2thZ2U6IHsgLi4uYm9va2luZy5wYWNrYWdlLCBwcmljZTogTnVtYmVyKGJvb2tpbmcucGFja2FnZS5wcmljZSkgfSxcbiAgcGF5bWVudHM6IGJvb2tpbmcucGF5bWVudHM/Lm1hcCgocCkgPT4gKHsgLi4ucCwgYW1vdW50OiBOdW1iZXIocC5hbW91bnQpIH0pKSxcbn0pO1xuXG4vLyBcdTI1MDBcdTI1MDAgQ3JlYXRlIGJvb2tpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBjcmVhdGVCb29raW5nID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBJQ3JlYXRlQm9va2luZykgPT4ge1xuICBjb25zdCB7IHBhY2thZ2VJZCwgdHJhdmVsZXJzIH0gPSBwYXlsb2FkO1xuICBjb25zdCB0cmF2ZWxEYXRlID0gdG9VVENNaWRuaWdodChwYXlsb2FkLnRyYXZlbERhdGUpO1xuXG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG4gIGlmIChcbiAgICAhdG91clBhY2thZ2UgfHxcbiAgICB0b3VyUGFja2FnZS5pc0RlbGV0ZWQgfHxcbiAgICB0b3VyUGFja2FnZS5zdGF0dXMgIT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJQYWNrYWdlIGlzIG5vdCBhdmFpbGFibGUgZm9yIGJvb2tpbmcuXCIpO1xuICB9XG5cbiAgLy8gdG90YWxQcmljZSBpcyBjb21wdXRlZCBzZXJ2ZXItc2lkZSBmcm9tIHRoZSBwYWNrYWdlJ3MgY3VycmVudCBwcmljZSBcdTIwMTRcbiAgLy8gYW55dGhpbmcgdGhlIGNsaWVudCBzZW5kcyBpcyBpZ25vcmVkLlxuICBjb25zdCB0b3RhbFByaWNlID0gTnVtYmVyKHRvdXJQYWNrYWdlLnByaWNlKSAqIHRyYXZlbGVycztcblxuICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHR4LmJvb2tpbmcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkLFxuICAgICAgICB0cmF2ZWxEYXRlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZykge1xuICAgICAgY29uc3QgaXNSZWNlbnQgPVxuICAgICAgICBleGlzdGluZy5jcmVhdGVkQXQuZ2V0VGltZSgpID49XG4gICAgICAgIERhdGUubm93KCkgLSBTVEFMRV9CT09LSU5HX0hPVVJTICogNjAgKiA2MCAqIDEwMDA7XG5cbiAgICAgIGlmIChpc1JlY2VudCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgNDA5LFxuICAgICAgICAgIFwiWW91IGFscmVhZHkgaGF2ZSBhIHBlbmRpbmcgYm9va2luZyBmb3IgdGhpcyBwYWNrYWdlIG9uIHRoaXMgZGF0ZS5cIixcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgLy8gYWJhbmRvbmVkIGNoZWNrb3V0IFx1MjAxNCBjYW5jZWwgaXQgaW4gdGhlIHNhbWUgdHJhbnNhY3Rpb24gYW5kIHJlYm9va1xuICAgICAgYXdhaXQgdHguYm9va2luZy51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogZXhpc3RpbmcuaWQgfSxcbiAgICAgICAgZGF0YTogeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHguYm9va2luZy5jcmVhdGUoe1xuICAgICAgZGF0YTogeyB1c2VySWQsIHBhY2thZ2VJZCwgdHJhdmVsRGF0ZSwgdHJhdmVsZXJzLCB0b3RhbFByaWNlIH0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IGVtYWlsIFx1MjAxNCBuZXZlciBmYWlscyB0aGUgcmVxdWVzdFxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9LFxuICB9KTtcbiAgaWYgKHVzZXIpIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgICAgcGFja2FnZVRpdGxlOiB0b3VyUGFja2FnZS50aXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZSxcbiAgICAgICAgdHJhdmVsZXJzLFxuICAgICAgICB0b3RhbFByaWNlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9XG5cbiAgLy8gYmVzdC1lZmZvcnQgaW4tYXBwIG5vdGlmaWNhdGlvbiB0byB0aGUgcGFja2FnZSBhZ2VudCAobmV2ZXIgZmFpbHMgcmVxdWVzdClcbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIG5vdGlmeShcbiAgICAgIHRvdXJQYWNrYWdlLmFnZW50SWQsXG4gICAgICBOb3RpZmljYXRpb25UeXBlLkJPT0tJTkdfQ1JFQVRFRCxcbiAgICAgIFwiTmV3IGJvb2tpbmcgcmVjZWl2ZWRcIixcbiAgICAgIGBBIG5ldyBib29raW5nIGhhcyBiZWVuIHBsYWNlZCBmb3IgXCIke3RvdXJQYWNrYWdlLnRpdGxlfVwiLmAsXG4gICAgICBgL2Rhc2hib2FyZC9hZ2VudC9ib29raW5ncy8ke2NyZWF0ZWQuaWR9YCxcbiAgICApLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIC4uLmNyZWF0ZWQsXG4gICAgdG90YWxQcmljZTogTnVtYmVyKGNyZWF0ZWQudG90YWxQcmljZSksXG4gIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTGlzdCBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcGFnaW5hdGVCb29raW5nID0gYXN5bmMgKFxuICB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0LFxuICBpbmNsdWRlOiBQcmlzbWEuQm9va2luZ0luY2x1ZGUsXG4gIHF1ZXJ5OiBJQm9va2luZ1F1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlIHx8IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgfHwgMTA7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYm9va2luZy5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGUsXG4gICAgICBza2lwOiAocGFnZSAtIDEpICogbGltaXQsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgIH0pLFxuICAgIHByaXNtYS5ib29raW5nLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIE15IGJvb2tpbmdzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0TXlCb29raW5ncyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElCb29raW5nUXVlcnkpID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHsgdXNlcklkIH07XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAgeyBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCwgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWdlbnQgYm9va2luZ3MgKHNjb3BlZCB0byBvd24gcGFja2FnZXMpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0QWdlbnRCb29raW5ncyA9IGFzeW5jIChcbiAgYWdlbnRJZDogc3RyaW5nLFxuICBxdWVyeTogSUJvb2tpbmdTZWFyY2hRdWVyeSxcbikgPT4ge1xuICBjb25zdCB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0ge1xuICAgIHBhY2thZ2U6IHsgYWdlbnRJZCB9LFxuICB9O1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICB3aGVyZS5wYWNrYWdlID0ge1xuICAgICAgYWdlbnRJZCxcbiAgICAgIHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9LFxuICAgIH07XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAgeyBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCwgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IGFsbCBib29raW5ncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldEFsbEJvb2tpbmdzID0gYXN5bmMgKHF1ZXJ5OiBJQm9va2luZ1NlYXJjaFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7fTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUucGFja2FnZSA9IHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhZ2luYXRlQm9va2luZyhcbiAgICB3aGVyZSxcbiAgICB7XG4gICAgICBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCxcbiAgICAgIHVzZXI6IGJvb2tpbmdVc2VyU2VsZWN0LFxuICAgICAgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUsXG4gICAgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQm9va2luZyBkZXRhaWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRCb29raW5nRGV0YWlsID0gYXN5bmMgKGlkOiBzdHJpbmcsIGFjdG9yOiBCb29raW5nQWN0b3IpID0+IHtcbiAgY29uc3QgYm9va2luZyA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgcGFja2FnZTogYm9va2luZ1BhY2thZ2VEZXRhaWxTZWxlY3QsXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICAgIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlLFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG4gIGlmICghY2FuTWFuYWdlKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byB2aWV3IHRoaXMgYm9va2luZy5cIik7XG4gIH1cblxuICByZXR1cm4gbWFwQm9va2luZ0xpc3QoYm9va2luZyk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVmdW5kIChib29raW5nIGNhbmNlbGxlZCB3aXRoIHNldHRsZWQgbW9uZXkpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gUnVucyBBRlRFUiB0aGUgc3RhdHVzLXRyYW5zaXRpb24gdHJhbnNhY3Rpb24gY29tbWl0cywgc28gYSBnYXRld2F5IGZhaWx1cmUgY2FuXG4vLyBuZXZlciByb2xsIGJhY2sgdGhlIGNhbmNlbGxhdGlvbiBpdHNlbGYuIEVhY2ggc2V0dGxlZCBwYXltZW50IGlzIHJlZnVuZGVkIHZpYVxuLy8gdGhlIFNTTENvbW1lcnogUmVmdW5kIEFQSSBhbmQgaXRzIGxlZGdlciByb3cgc3RvcmVzIHRoZSBnYXRld2F5IHJlZmVyZW5jZS5cbnR5cGUgUmVmdW5kQ29udGV4dCA9IHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBwYWNrYWdlVGl0bGU6IHN0cmluZztcbiAgdHJhdmVsRGF0ZTogRGF0ZTtcbn07XG5cbmNvbnN0IGlzc3VlUmVmdW5kcyA9IGFzeW5jIChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIGN0eDogUmVmdW5kQ29udGV4dCxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHBheW1lbnRzID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHsgYm9va2luZ0lkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuUkVGVU5ERUQgfSxcbiAgICB9KTtcbiAgICBpZiAocGF5bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICBjb25zdCByZWZ1bmRSZWZzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IG91dGNvbWVzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgcGF5bWVudHMubWFwKGFzeW5jIChwYXltZW50KSA9PiB7XG4gICAgICAgIGlmICghcGF5bWVudC5iYW5rVHJhbklkKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgIGBbcmVmdW5kXSBwYXltZW50ICR7cGF5bWVudC5pZH0gaGFzIG5vIGJhbmtfdHJhbl9pZDsgZ2F0ZXdheSByZWZ1bmQgc2tpcHBlZC5gLFxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGdhdGV3YXkgPSBhd2FpdCBzc2xjb21tZXJ6UmVmdW5kKHtcbiAgICAgICAgICBiYW5rX3RyYW5faWQ6IHBheW1lbnQuYmFua1RyYW5JZCxcbiAgICAgICAgICByZWZ1bmRfYW1vdW50OiBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICAgICAgICAgIHJlZnVuZF9yZW1hcmtzOiBgQm9va2luZyAke2Jvb2tpbmdJZH0gY2FuY2VsbGVkIC0gVHJpcFZlcnNlYCxcbiAgICAgICAgICByZWZlX2lkOiBib29raW5nSWQsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZ2F0ZXdheS5zdGF0dXMgPT09IFwic3VjY2Vzc1wiICYmIGdhdGV3YXkucmVmdW5kX3JlZl9pZCkge1xuICAgICAgICAgIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICAgICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgICAgICAgZGF0YTogeyByZWZ1bmRSZWZJZDogZ2F0ZXdheS5yZWZ1bmRfcmVmX2lkLCByZWZ1bmRlZEF0OiBuZXcgRGF0ZSgpIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmVmdW5kUmVmcy5wdXNoKGdhdGV3YXkucmVmdW5kX3JlZl9pZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgIGBbcmVmdW5kXSBwYXltZW50ICR7cGF5bWVudC5pZH0gcmVqZWN0ZWQ6ICR7Z2F0ZXdheS5lcnJvclJlYXNvbiA/PyBnYXRld2F5LnN0YXR1cyA/PyBcInVua25vd25cIn1gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gICAgLy8gaW5kaXZpZHVhbCBmYWlsdXJlcyBhcmUgbG9nZ2VkIGFib3ZlIGFuZCBzd2FsbG93ZWQgXHUyMDE0IG1vbmV5IHN0YXR1cyBhbHJlYWR5XG4gICAgLy8gZmxpcHBlZCB0byBSRUZVTkRFRCwgc28gdGhlIGN1c3RvbWVyIHNlZXMgYSByZWZ1bmQgcmVnYXJkbGVzcy5cbiAgICB2b2lkIG91dGNvbWVzO1xuXG4gICAgaWYgKHJlZnVuZFJlZnMubGVuZ3RoID4gMCkge1xuICAgICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgICBzZW5kUmVmdW5kRW1haWwoe1xuICAgICAgICAgIGVtYWlsOiBjdHguZW1haWwsXG4gICAgICAgICAgbmFtZTogY3R4Lm5hbWUsXG4gICAgICAgICAgcGFja2FnZVRpdGxlOiBjdHgucGFja2FnZVRpdGxlLFxuICAgICAgICAgIHRyYXZlbERhdGU6IGN0eC50cmF2ZWxEYXRlLFxuICAgICAgICAgIGFtb3VudDogcGF5bWVudHMucmVkdWNlKChzdW0sIHApID0+IHN1bSArIE51bWJlcihwLmFtb3VudCksIDApLFxuICAgICAgICAgIHJlZnVuZFJlZklkOiByZWZ1bmRSZWZzWzBdLFxuICAgICAgICB9KSxcbiAgICAgIF0pO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtyZWZ1bmRdIHVuZXhwZWN0ZWQgZXJyb3I6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsXG4gICAgKTtcbiAgfVxufTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXR1cyB0cmFuc2l0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgdXBkYXRlQm9va2luZ1N0YXR1cyA9IGFzeW5jIChcbiAgaWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG4gIGFjdG9yOiBCb29raW5nQWN0b3IsXG4pID0+IHtcbiAgY29uc3QgeyBzdGF0dXM6IHRvIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIHBhY2thZ2U6IHtcbiAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBhZ2VudElkOiB0cnVlLCB0aXRsZTogdHJ1ZSB9LFxuICAgICAgfSxcbiAgICAgIHVzZXI6IGJvb2tpbmdVc2VyU2VsZWN0LFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKCFjYW5NYW5hZ2UoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBlcmZvcm0gdGhpcyBhY3Rpb24uXCIpO1xuICB9XG5cbiAgY29uc3QgcnVsZSA9IFRSQU5TSVRJT05TW2Jvb2tpbmcuc3RhdHVzXT8uW3RvXTtcbiAgaWYgKCFydWxlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgYENhbm5vdCB0cmFuc2l0aW9uIGJvb2tpbmcgZnJvbSAke2Jvb2tpbmcuc3RhdHVzfSB0byAke3RvfS5gLFxuICAgICk7XG4gIH1cbiAgaWYgKCFydWxlLmFsbG93ZWQoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBlcmZvcm0gdGhpcyBhY3Rpb24uXCIpO1xuICB9XG5cbiAgY29uc3QgdHJhdmVsRGF5ID0gdG9VVENNaWRuaWdodChib29raW5nLnRyYXZlbERhdGUpLmdldFRpbWUoKTtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgaWYgKHJ1bGUucmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkICYmIHRyYXZlbERheSA+IG5vdykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiQm9va2luZyBjYW4gb25seSBiZSBjb21wbGV0ZWQgYWZ0ZXIgdGhlIHRyYXZlbCBkYXRlIGhhcyBwYXNzZWQuXCIsXG4gICAgKTtcbiAgfVxuICBpZiAocnVsZS5iZWZvcmVUcmF2ZWxEYXRlICYmIHRyYXZlbERheSA8PSBub3cpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkJvb2tpbmcgY2FuIG9ubHkgYmUgcmV2ZXJ0ZWQgYmVmb3JlIHRoZSB0cmF2ZWwgZGF0ZS5cIixcbiAgICApO1xuICB9XG5cbiAgLy8gY29tcGFyZS1hbmQtc2V0OiB0aGUgdHJhbnNpdGlvbiBhcHBsaWVzIG9ubHkgaWYgdGhlIHJlY29yZGVkIHN0YXR1cyBzdGlsbFxuICAvLyBtYXRjaGVzIFx1MjAxNCBhIGNvbmN1cnJlbnQgY2hhbmdlIG1ha2VzIGNvdW50IDAgYW5kIHRoZSByZXF1ZXN0IGZhaWxzIHNhZmVseS5cbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdHguYm9va2luZy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkLCBzdGF0dXM6IGJvb2tpbmcuc3RhdHVzIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogdG8gfSxcbiAgICB9KTtcbiAgICBpZiAocmVzdWx0LmNvdW50ID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwOSxcbiAgICAgICAgXCJCb29raW5nIHN0YXR1cyBjaGFuZ2VkIGNvbmN1cnJlbnRseS4gUGxlYXNlIHRyeSBhZ2Fpbi5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQ2FuY2VsbGluZyBhIHBhaWQgYm9va2luZyBtYXJrcyBpdHMgbW9uZXkgYXMgcmV0dXJuZWQgKFJFRlVOREVEIGZsYWcpLlxuICAgIC8vIEFiYW5kb25lZCBzZXNzaW9ucyBhcmUgY2FuY2VsbGVkLiBUaGUgZ2F0ZXdheSByZWZ1bmRzICsgcmVmdW5kIGVtYWlsIHJ1blxuICAgIC8vIGFmdGVyIHRoaXMgdHJhbnNhY3Rpb24gY29tbWl0cyAoaXNzdWVSZWZ1bmRzIGlzIGJlc3QtZWZmb3J0KS5cbiAgICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBib29raW5nSWQ6IGlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5SRUZVTkRFRCB9LFxuICAgICAgfSk7XG4gICAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBib29raW5nSWQ6IGlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkNBTkNFTExFRCB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHR4LmJvb2tpbmcuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIH0pO1xuXG4gIGlmICghdXBkYXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgLy8gYmVzdC1lZmZvcnQgZ2F0ZXdheSByZWZ1bmQgKyByZWZ1bmQgZW1haWwgZm9yIHNldHRsZWQgbW9uZXkgKG5ldmVyIHRocm93cylcbiAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgIGF3YWl0IGlzc3VlUmVmdW5kcyhpZCwge1xuICAgICAgZW1haWw6IGJvb2tpbmcudXNlci5lbWFpbCxcbiAgICAgIG5hbWU6IGJvb2tpbmcudXNlci5uYW1lLFxuICAgICAgcGFja2FnZVRpdGxlOiBib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICB0cmF2ZWxEYXRlOiBib29raW5nLnRyYXZlbERhdGUsXG4gICAgfSk7XG4gIH1cblxuICAvLyBiZXN0LWVmZm9ydCBlbWFpbCBmb3IgbW9uZXktc3RhdHVzIGNoYW5nZXNcbiAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNPTkZJUk1FRCB8fCB0byA9PT0gQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQpIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgICAgZW1haWw6IGJvb2tpbmcudXNlci5lbWFpbCxcbiAgICAgICAgbmFtZTogYm9va2luZy51c2VyLm5hbWUsXG4gICAgICAgIHBhY2thZ2VUaXRsZTogYm9va2luZy5wYWNrYWdlLnRpdGxlLFxuICAgICAgICB0cmF2ZWxEYXRlOiBib29raW5nLnRyYXZlbERhdGUsXG4gICAgICAgIHRyYXZlbGVyczogYm9va2luZy50cmF2ZWxlcnMsXG4gICAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihib29raW5nLnRvdGFsUHJpY2UpLFxuICAgICAgICBzdGF0dXM6IHRvLFxuICAgICAgfSksXG4gICAgXSk7XG4gIH1cblxuICAvLyBiZXN0LWVmZm9ydCBpbi1hcHAgbm90aWZpY2F0aW9ucyAobmV2ZXIgZmFpbHMgcmVxdWVzdCkuIFJlY2lwaWVudCBvZiBhXG4gIC8vIGNhbmNlbGxhdGlvbiBkZXBlbmRzIG9uIHRoZSBhY3RvcjogdGhlIGN1c3RvbWVyIGNhbmNlbHMgXHUyMTkyIHRoZSBhZ2VudCBoZWFycztcbiAgLy8gdGhlIGFnZW50IGNhbmNlbHMgXHUyMTkyIHRoZSBjdXN0b21lciBoZWFyczsgYW4gQURNSU4gY2FuY2VscyBcdTIxOTIgYm90aCBoZWFyLCBzaW5jZVxuICAvLyB0aGUgYWRtaW4gYWN0cyBvbiBiZWhhbGYgb2YgdGhlIHBsYXRmb3JtLCBub3QgZWl0aGVyIHNpZGUuXG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DT05GSVJNRUQpIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBub3RpZnkoXG4gICAgICAgIGJvb2tpbmcudXNlcklkLFxuICAgICAgICBOb3RpZmljYXRpb25UeXBlLkJPT0tJTkdfQ09ORklSTUVELFxuICAgICAgICBcIkJvb2tpbmcgY29uZmlybWVkXCIsXG4gICAgICAgIGBZb3VyIGJvb2tpbmcgZm9yIFwiJHtib29raW5nLnBhY2thZ2UudGl0bGV9XCIgaGFzIGJlZW4gY29uZmlybWVkLmAsXG4gICAgICAgIGAvZGFzaGJvYXJkL2Jvb2tpbmdzLyR7aWR9YCxcbiAgICAgICksXG4gICAgXSk7XG4gIH1cblxuICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgY29uc3QgcmVjaXBpZW50czogc3RyaW5nW10gPSBbXTtcbiAgICBpZiAoYWN0b3IuaWQgPT09IGJvb2tpbmcudXNlcklkKSB7XG4gICAgICByZWNpcGllbnRzLnB1c2goYm9va2luZy5wYWNrYWdlLmFnZW50SWQpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICBhY3Rvci5yb2xlID09PSBSb2xlLkFHRU5UICYmXG4gICAgICBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWRcbiAgICApIHtcbiAgICAgIHJlY2lwaWVudHMucHVzaChib29raW5nLnVzZXJJZCk7XG4gICAgfSBlbHNlIGlmIChhY3Rvci5yb2xlID09PSBSb2xlLkFETUlOKSB7XG4gICAgICByZWNpcGllbnRzLnB1c2goYm9va2luZy51c2VySWQsIGJvb2tpbmcucGFja2FnZS5hZ2VudElkKTtcbiAgICB9XG5cbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChcbiAgICAgIFsuLi5uZXcgU2V0KHJlY2lwaWVudHMpXS5tYXAoKHJlY2lwaWVudElkKSA9PlxuICAgICAgICBub3RpZnkoXG4gICAgICAgICAgcmVjaXBpZW50SWQsXG4gICAgICAgICAgTm90aWZpY2F0aW9uVHlwZS5CT09LSU5HX0NBTkNFTExFRCxcbiAgICAgICAgICBcIkJvb2tpbmcgY2FuY2VsbGVkXCIsXG4gICAgICAgICAgYFRoZSBib29raW5nIGZvciBcIiR7Ym9va2luZy5wYWNrYWdlLnRpdGxlfVwiIGhhcyBiZWVuIGNhbmNlbGxlZC5gLFxuICAgICAgICAgIGAvZGFzaGJvYXJkL2Jvb2tpbmdzLyR7aWR9YCxcbiAgICAgICAgKSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB7IC4uLnVwZGF0ZWQsIHRvdGFsUHJpY2U6IE51bWJlcih1cGRhdGVkLnRvdGFsUHJpY2UpIH07XG59O1xuXG5leHBvcnQgY29uc3QgYm9va2luZ1NlcnZpY2UgPSB7XG4gIGNyZWF0ZUJvb2tpbmcsXG4gIGdldE15Qm9va2luZ3MsXG4gIGdldEFnZW50Qm9va2luZ3MsXG4gIGdldEFsbEJvb2tpbmdzLFxuICBnZXRCb29raW5nRGV0YWlsLFxuICB1cGRhdGVCb29raW5nU3RhdHVzLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCBjcmVhdGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxuICB0cmF2ZWxEYXRlOiB6LmNvZXJjZS5kYXRlKHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJUcmF2ZWwgZGF0ZSBpcyByZXF1aXJlZFwiLFxuICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJUcmF2ZWwgZGF0ZSBtdXN0IGJlIGEgdmFsaWQgZGF0ZVwiLFxuICB9KS5yZWZpbmUoXG4gICAgKGRhdGUpID0+IHtcbiAgICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICAgIGNvbnN0IHRyYXZlbERheSA9IG5ldyBEYXRlKFxuICAgICAgICBEYXRlLlVUQyhcbiAgICAgICAgICBkYXRlLmdldFVUQ0Z1bGxZZWFyKCksXG4gICAgICAgICAgZGF0ZS5nZXRVVENNb250aCgpLFxuICAgICAgICAgIGRhdGUuZ2V0VVRDRGF0ZSgpLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IHRvZGF5VVRDID0gbmV3IERhdGUoXG4gICAgICAgIERhdGUuVVRDKFxuICAgICAgICAgIHRvZGF5LmdldFVUQ0Z1bGxZZWFyKCksXG4gICAgICAgICAgdG9kYXkuZ2V0VVRDTW9udGgoKSxcbiAgICAgICAgICB0b2RheS5nZXRVVENEYXRlKCksXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRyYXZlbERheS5nZXRUaW1lKCkgPj0gdG9kYXlVVEMuZ2V0VGltZSgpO1xuICAgIH0sXG4gICAgeyBtZXNzYWdlOiBcIlRyYXZlbCBkYXRlIGNhbm5vdCBiZSBpbiB0aGUgcGFzdC5cIiB9LFxuICApLFxuICB0cmF2ZWxlcnM6IHpcbiAgICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiVHJhdmVsZXJzIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAuaW50KFwiVHJhdmVsZXJzIG11c3QgYmUgYSB3aG9sZSBudW1iZXJcIilcbiAgICAubWluKDEsIFwiVHJhdmVsZXJzIG11c3QgYmUgYXQgbGVhc3QgMVwiKVxuICAgIC5tYXgoMjAsIFwiVHJhdmVsZXJzIG11c3QgYmUgYXQgbW9zdCAyMFwiKSxcbn0pO1xuXG5jb25zdCBib29raW5nUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJCb29raW5nIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oQm9va2luZ1N0YXR1cykub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBib29raW5nU2VhcmNoUXVlcnlTY2hlbWEgPSBib29raW5nUXVlcnlTY2hlbWEuZXh0ZW5kKHtcbiAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oQm9va2luZ1N0YXR1cywge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgc3RhdHVzXCIsXG4gIH0pLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRDcmVhdGVCb29raW5nU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY3JlYXRlU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRCb29raW5nUXVlcnlTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBib29raW5nUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUVXBkYXRlU3RhdHVzU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXBkYXRlU3RhdHVzU2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlU2NoZW1hLFxuICBib29raW5nUGFyYW1zU2NoZW1hLFxuICBib29raW5nUXVlcnlTY2hlbWEsXG4gIGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHJldmlld0NvbnRyb2xsZXIgfSBmcm9tIFwiLi9yZXZpZXcuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgcmV2aWV3VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9yZXZpZXcudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IChVU0VSIG9ubHkpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcmV2aWV3VmFsaWRhdGlvbnMuY3JlYXRlUmV2aWV3U2NoZW1hIH0pLFxuICByZXZpZXdDb250cm9sbGVyLmNyZWF0ZVJldmlldyxcbik7XG5cbi8vIDIuIExpc3QgcmV2aWV3cyBmb3IgYSBwYWNrYWdlIChwdWJsaWMpXG5yb3V0ZXIuZ2V0KFxuICBcIi9wYWNrYWdlLzpwYWNrYWdlSWRcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHJldmlld1ZhbGlkYXRpb25zLnJldmlld1BhcmFtc1NjaGVtYSxcbiAgICBxdWVyeTogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3UXVlcnlTY2hlbWEsXG4gIH0pLFxuICByZXZpZXdDb250cm9sbGVyLmdldFBhY2thZ2VSZXZpZXdzLFxuKTtcblxuZXhwb3J0IGNvbnN0IHJldmlld1JvdXRlcyA9IHJvdXRlcjtcbiIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgcmV2aWV3U2VydmljZSB9IGZyb20gXCIuL3Jldmlldy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IGNvbnRyb2xsZXIgKFVTRVIgb25seSlcbmNvbnN0IGNyZWF0ZVJldmlldyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJldmlld1NlcnZpY2UuY3JlYXRlUmV2aWV3KHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3IHN1Ym1pdHRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBMaXN0IHBhY2thZ2UgcmV2aWV3cyBjb250cm9sbGVyIChwdWJsaWMpXG5jb25zdCBnZXRQYWNrYWdlUmV2aWV3cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VJZCA9IFN0cmluZyhyZXEucGFyYW1zLnBhY2thZ2VJZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmV2aWV3U2VydmljZS5saXN0UGFja2FnZVJldmlld3MocGFja2FnZUlkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlJldmlld3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlUmV2aWV3LFxuICBnZXRQYWNrYWdlUmV2aWV3cyxcbn07XG4iLCAiaW1wb3J0IHsgUGFja2FnZVN0YXR1cywgQm9va2luZ1N0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IElDcmVhdGVSZXZpZXdQYXlsb2FkLCBJUmV2aWV3UXVlcnkgfSBmcm9tIFwiLi9yZXZpZXcuaW50ZXJmYWNlXCI7XG5cbi8vIDEuIENyZWF0ZSBhIHJldmlldyAoVVNFUiBvbmx5KSBcdTIwMTQgZ2F0ZWQsIHVuaXF1ZSBwZXIgdXNlcitwYWNrYWdlLCBhbmRcbi8vICAgIHJlY2FsY3VsYXRlcyB0aGUgcGFja2FnZSByYXRpbmcgaW4gdGhlIHNhbWUgdHJhbnNhY3Rpb24uXG5jb25zdCBjcmVhdGVSZXZpZXcgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHBheWxvYWQ6IElDcmVhdGVSZXZpZXdQYXlsb2FkKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIC8vIFBhY2thZ2UgbXVzdCBleGlzdCwgYmUgYXBwcm92ZWQsIGFuZCBub3QgYmUgZGVsZXRlZCBcdTIwMTQgYSByZXZpZXcgb2YgYVxuICAgIC8vIHBlbmRpbmcvcmVqZWN0ZWQvZGVsZXRlZCBwYWNrYWdlIGlzIG5vbnNlbnNlLlxuICAgIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgdHgudG91clBhY2thZ2UuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgYWdlbnRJZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgLy8gTm8gc2VsZi1yZXZpZXcgXHUyMDE0IGFuIGFnZW50IHJhdGluZyB0aGVpciBvd24gcGFja2FnZSBpcyBhIGNvbmZsaWN0IG9mIGludGVyZXN0LlxuICAgIGlmICh0b3VyUGFja2FnZS5hZ2VudElkID09PSB1c2VySWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGNhbm5vdCByZXZpZXcgeW91ciBvd24gcGFja2FnZS5cIik7XG4gICAgfVxuXG4gICAgLy8gT25seSBjdXN0b21lcnMgd2l0aCBhIGNvbXBsZXRlZCBib29raW5nIG1heSByZXZpZXcuXG4gICAgY29uc3QgY29tcGxldGVkQm9va2luZyA9IGF3YWl0IHR4LmJvb2tpbmcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCxcbiAgICAgIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghY29tcGxldGVkQm9va2luZykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDMsXG4gICAgICAgIFwiWW91IGNhbiBvbmx5IHJldmlldyBhIHBhY2thZ2UgYWZ0ZXIgY29tcGxldGluZyBhIGJvb2tpbmcuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIEZyaWVuZGx5IGR1cGxpY2F0ZSBjaGVjayBcdTIwMTQgQEB1bmlxdWUoW3VzZXJJZCwgcGFja2FnZUlkXSkgYmFja3N0b3BzIGFueVxuICAgIC8vIHJhY2UgdmlhIFAyMDAyIChtYXBwZWQgdG8gNDA5IGJ5IHRoZSBnbG9iYWwgaGFuZGxlcikuXG4gICAgY29uc3QgZXhpc3RpbmdSZXZpZXcgPSBhd2FpdCB0eC5yZXZpZXcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7IHVzZXJJZCwgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoZXhpc3RpbmdSZXZpZXcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiWW91IGhhdmUgYWxyZWFkeSByZXZpZXdlZCB0aGlzIHBhY2thZ2UuXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGNyZWF0ZWRSZXZpZXcgPSBhd2FpdCB0eC5yZXZpZXcuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICByYXRpbmc6IHBheWxvYWQucmF0aW5nLFxuICAgICAgICBjb21tZW50OiBwYXlsb2FkLmNvbW1lbnQsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gUmVjb21wdXRlIHRoZSBwYWNrYWdlIHJhdGluZyBmcm9tIGFsbCBvZiBpdHMgcmV2aWV3cywgcm91bmRlZCB0byBvbmVcbiAgICAvLyBkZWNpbWFsLCBpbnNpZGUgdGhlIHNhbWUgdHJhbnNhY3Rpb24gc28gYSBzdGFsZSBhdmVyYWdlIGlzIG5ldmVyIHdyaXR0ZW4uXG4gICAgY29uc3QgeyBfYXZnIH0gPSBhd2FpdCB0eC5yZXZpZXcuYWdncmVnYXRlKHtcbiAgICAgIHdoZXJlOiB7IHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQgfSxcbiAgICAgIF9hdmc6IHsgcmF0aW5nOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByYXRpbmcgPSBNYXRoLnJvdW5kKChfYXZnLnJhdGluZyA/PyAwKSAqIDEwKSAvIDEwO1xuXG4gICAgYXdhaXQgdHgudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9LFxuICAgICAgZGF0YTogeyByYXRpbmcgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB7IHJldmlldzogY3JlYXRlZFJldmlldywgcmF0aW5nIH07XG4gIH0pO1xufTtcblxuLy8gMi4gTGlzdCByZXZpZXdzIGZvciBhIHBhY2thZ2UgKHB1YmxpYykgXHUyMDE0IHBhZ2luYXRlZDsgdGhlIHBhY2thZ2UgbXVzdCBiZVxuLy8gICAgYXBwcm92ZWQgYW5kIG5vdCBkZWxldGVkIHNvIHVucHVibGlzaGVkIHBhY2thZ2UgcmV2aWV3cyBuZXZlciBsZWFrLlxuY29uc3QgbGlzdFBhY2thZ2VSZXZpZXdzID0gYXN5bmMgKFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcXVlcnk6IElSZXZpZXdRdWVyeSxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7XG4gICAgICBpZDogcGFja2FnZUlkLFxuICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnJldmlldy5maW5kTWFueSh7XG4gICAgICB3aGVyZTogeyBwYWNrYWdlSWQgfSxcbiAgICAgIHNlbGVjdDoge1xuICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgcmF0aW5nOiB0cnVlLFxuICAgICAgICBjb21tZW50OiB0cnVlLFxuICAgICAgICBjcmVhdGVkQXQ6IHRydWUsXG4gICAgICAgIHVwZGF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgdXNlcjogeyBzZWxlY3Q6IHsgbmFtZTogdHJ1ZSwgYXZhdGFyVXJsOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEucmV2aWV3LmNvdW50KHsgd2hlcmU6IHsgcGFja2FnZUlkIH0gfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IHJldmlld1NlcnZpY2UgPSB7XG4gIGNyZWF0ZVJldmlldyxcbiAgbGlzdFBhY2thZ2VSZXZpZXdzLFxufTtcbiIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVSZXZpZXdTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhY2thZ2VJZDogelxuICAgICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG4gICAgcmF0aW5nOiB6XG4gICAgICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiUmF0aW5nIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC5pbnQoXCJSYXRpbmcgbXVzdCBiZSBhIHdob2xlIG51bWJlclwiKVxuICAgICAgLm1pbigxLCBcIlJhdGluZyBtdXN0IGJlIGF0IGxlYXN0IDFcIilcbiAgICAgIC5tYXgoNSwgXCJSYXRpbmcgbXVzdCBiZSBhdCBtb3N0IDVcIiksXG4gICAgY29tbWVudDogelxuICAgICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbW1lbnQgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1pbigxLCBcIkNvbW1lbnQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgICAgIC5tYXgoMTAwMCwgXCJDb21tZW50IG11c3QgYmUgYXQgbW9zdCAxMDAwIGNoYXJhY3RlcnNcIiksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgcmV2aWV3UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWNrYWdlSWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG59KTtcblxuY29uc3QgcmV2aWV3UXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG59KTtcblxuZXhwb3J0IGNvbnN0IHJldmlld1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVSZXZpZXdTY2hlbWEsXG4gIHJldmlld1BhcmFtc1NjaGVtYSxcbiAgcmV2aWV3UXVlcnlTY2hlbWEsXG59O1xuIiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBjYXRlZ29yeUNvbnRyb2xsZXIgfSBmcm9tIFwiLi9jYXRlZ29yeS5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBjYXRlZ29yeVZhbGlkYXRpb25zIH0gZnJvbSBcIi4vY2F0ZWdvcnkudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gTGlzdCBhbGwgY2F0ZWdvcmllcyAocHVibGljLCBubyBhdXRoKVxucm91dGVyLmdldChcIi9cIiwgY2F0ZWdvcnlDb250cm9sbGVyLmdldEFsbENhdGVnb3JpZXMpO1xuXG4vLyAyLiBDcmVhdGUgY2F0ZWdvcnkgKGFkbWluKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBjYXRlZ29yeVZhbGlkYXRpb25zLmNyZWF0ZUNhdGVnb3J5U2NoZW1hIH0pLFxuICBjYXRlZ29yeUNvbnRyb2xsZXIuY3JlYXRlQ2F0ZWdvcnksXG4pO1xuXG4vLyAzLiBVcGRhdGUgY2F0ZWdvcnkgKGFkbWluKVxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY2F0ZWdvcnlQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogY2F0ZWdvcnlWYWxpZGF0aW9ucy51cGRhdGVDYXRlZ29yeVNjaGVtYSxcbiAgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci51cGRhdGVDYXRlZ29yeSxcbik7XG5cbi8vIDQuIERlbGV0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBjYXRlZ29yeVZhbGlkYXRpb25zLmNhdGVnb3J5UGFyYW1zU2NoZW1hIH0pLFxuICBjYXRlZ29yeUNvbnRyb2xsZXIuZGVsZXRlQ2F0ZWdvcnksXG4pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBjYXRlZ29yeVNlcnZpY2UgfSBmcm9tIFwiLi9jYXRlZ29yeS5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gQ3JlYXRlIGNhdGVnb3J5IGNvbnRyb2xsZXIgKGFkbWluKVxuY29uc3QgY3JlYXRlQ2F0ZWdvcnkgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBjYXRlZ29yeSA9IGF3YWl0IGNhdGVnb3J5U2VydmljZS5jcmVhdGVDYXRlZ29yeShyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJDYXRlZ29yeSBjcmVhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGNhdGVnb3J5LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR2V0IGFsbCBjYXRlZ29yaWVzIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGdldEFsbENhdGVnb3JpZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmdldEFsbENhdGVnb3JpZXMoKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgY2F0ZWdvcmllcyBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGNhdGVnb3JpZXMsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBVcGRhdGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCB1cGRhdGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgY29uc3QgY2F0ZWdvcnkgPSBhd2FpdCBjYXRlZ29yeVNlcnZpY2UudXBkYXRlQ2F0ZWdvcnkoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDYXRlZ29yeSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IGNhdGVnb3J5LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gRGVsZXRlIGNhdGVnb3J5IGNvbnRyb2xsZXIgKGFkbWluKVxuY29uc3QgZGVsZXRlQ2F0ZWdvcnkgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGF3YWl0IGNhdGVnb3J5U2VydmljZS5kZWxldGVDYXRlZ29yeShpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ2F0ZWdvcnkgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlQ2F0ZWdvcnksXG4gIGdldEFsbENhdGVnb3JpZXMsXG4gIHVwZGF0ZUNhdGVnb3J5LFxuICBkZWxldGVDYXRlZ29yeSxcbn07IiwgIi8vIEJhbmdsYSAoQmVuZ2FsaSkgXHUyMTkyIExhdGluIGNvbnNvbmFudC92b3dlbCBtYXAsIGFwcGxpZWQgYmVmb3JlIGtlYmFiLWNhc2luZyBzb1xuLy8gQmFuZ2xhLWhlYXZ5IHRpdGxlcyBzdGlsbCBwcm9kdWNlIHJlYWRhYmxlIHNsdWdzIGluc3RlYWQgb2YgYmVpbmcgc3RyaXBwZWQgdG9cbi8vIGFuIGVtcHR5IHN0cmluZy5cbmNvbnN0IEJBTkdMQV9UT19MQVRJTjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgXHUwOTg1OiBcIm9cIixcbiAgXHUwOTg2OiBcImFcIixcbiAgXHUwOTg3OiBcImlcIixcbiAgXHUwOTg4OiBcImlcIixcbiAgXHUwOTg5OiBcInVcIixcbiAgXHUwOThBOiBcInVcIixcbiAgXHUwOThCOiBcInJpXCIsXG4gIFx1MDk4RjogXCJlXCIsXG4gIFx1MDk5MDogXCJvaVwiLFxuICBcdTA5OTM6IFwib1wiLFxuICBcdTA5OTQ6IFwib3VcIixcbiAgXHUwOTk1OiBcImthXCIsXG4gIFx1MDk5NjogXCJraGFcIixcbiAgXHUwOTk3OiBcImdhXCIsXG4gIFx1MDk5ODogXCJnaGFcIixcbiAgXHUwOTk5OiBcIm5nYVwiLFxuICBcdTA5OUE6IFwiY2hhXCIsXG4gIFx1MDk5QjogXCJjaGhhXCIsXG4gIFx1MDk5QzogXCJqYVwiLFxuICBcdTA5OUQ6IFwiamhhXCIsXG4gIFx1MDk5RTogXCJueWFcIixcbiAgXHUwOTlGOiBcInRhXCIsXG4gIFx1MDlBMDogXCJ0aGFcIixcbiAgXHUwOUExOiBcImRhXCIsXG4gIFx1MDlBMjogXCJkaGFcIixcbiAgXHUwOUEzOiBcIm5hXCIsXG4gIFx1MDlBNDogXCJ0YVwiLFxuICBcdTA5QTU6IFwidGhhXCIsXG4gIFx1MDlBNjogXCJkYVwiLFxuICBcdTA5QTc6IFwiZGhhXCIsXG4gIFx1MDlBODogXCJuYVwiLFxuICBcdTA5QUE6IFwicGFcIixcbiAgXHUwOUFCOiBcInBoYVwiLFxuICBcdTA5QUM6IFwiYmFcIixcbiAgXHUwOUFEOiBcImJoYVwiLFxuICBcdTA5QUU6IFwibWFcIixcbiAgXHUwOUFGOiBcInlhXCIsXG4gIFx1MDlCMDogXCJyYVwiLFxuICBcdTA5QjI6IFwibGFcIixcbiAgXHUwOUI2OiBcInNoYVwiLFxuICBcdTA5Qjc6IFwic2hhXCIsXG4gIFx1MDlCODogXCJzYVwiLFxuICBcdTA5Qjk6IFwiaGFcIixcbiAgXHUwOUExXHUwOUJDOiBcInJhXCIsXG4gIFx1MDlBMlx1MDlCQzogXCJyaGFcIixcbiAgXHUwOUFGXHUwOUJDOiBcInlhXCIsXG4gIFwiXHUwOTgyXCI6IFwibmdcIixcbiAgXCJcdTA5ODNcIjogXCJoXCIsXG4gIFwiXHUwOTgxXCI6IFwiXCIsXG4gIFwiXHUwOUNEXCI6IFwiXCIsXG4gIFwiXHUwOUM3XCI6IFwiZVwiLFxuICBcIlx1MDlDOFwiOiBcIm9pXCIsXG4gIFwiXHUwOUNCXCI6IFwib1wiLFxuICBcIlx1MDlDQ1wiOiBcIm91XCIsXG4gIFwiXHUwOUJFXCI6IFwiYVwiLFxuICBcIlx1MDlCRlwiOiBcImlcIixcbiAgXCJcdTA5QzBcIjogXCJpXCIsXG4gIFwiXHUwOUMxXCI6IFwidVwiLFxuICBcIlx1MDlDMlwiOiBcInVcIixcbiAgXCJcdTA5QzNcIjogXCJyaVwiLFxufTtcblxuY29uc3QgdHJhbnNsaXRlcmF0ZSA9ICh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcgPT5cbiAgWy4uLnRleHRdLm1hcCgoY2hhcikgPT4gQkFOR0xBX1RPX0xBVElOW2NoYXJdID8/IGNoYXIpLmpvaW4oXCJcIik7XG5cbi8vIFNoYXJlZCBrZWJhYi1jYXNlIHNsdWdpZmllciB1c2VkIGJ5IENhdGVnb3J5IGFuZCBUb3VyUGFja2FnZSBzbHVncy4gTm9uLUxhdGluXG4vLyBzY3JpcHRzIChlLmcuIEJhbmdsYSkgYXJlIHRyYW5zbGl0ZXJhdGVkIGZpcnN0OyBpZiB0aGUgcmVzdWx0IGlzIHN0aWxsIGVtcHR5XG4vLyB0aGUgY2FsbGVyIG1heSBzdXBwbHkgYSBgZmFsbGJhY2tgIChlLmcuIFwicGFja2FnZS08c2hvcnRJZD5cIikuXG5leHBvcnQgY29uc3Qgc2x1Z2lmeSA9ICh0ZXh0OiBzdHJpbmcsIGZhbGxiYWNrPzogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgY29uc3Qgc2x1ZyA9IHRyYW5zbGl0ZXJhdGUodGV4dClcbiAgICAudG9Mb3dlckNhc2UoKVxuICAgIC50cmltKClcbiAgICAucmVwbGFjZSgvW15cXHdcXHMtXS9nLCBcIlwiKVxuICAgIC5yZXBsYWNlKC9bXFxzXy1dKy9nLCBcIi1cIilcbiAgICAucmVwbGFjZSgvXi0rfC0rJC9nLCBcIlwiKTtcblxuICByZXR1cm4gc2x1ZyB8fCBmYWxsYmFjayB8fCBcIlwiO1xufTsiLCAiaW1wb3J0IHsgUGFja2FnZVN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2x1Z2lmeVwiO1xuaW1wb3J0IHsgSUNyZWF0ZUNhdGVnb3J5LCBJVXBkYXRlQ2F0ZWdvcnkgfSBmcm9tIFwiLi9jYXRlZ29yeS5pbnRlcmZhY2VcIjtcblxuLy8gRnJpZW5kbHkgNDA5IGZvciBAdW5pcXVlIGNvbmZsaWN0cyAobmFtZSBvciBzbHVnKSBpbnN0ZWFkIG9mIGEgcmF3IFAyMDAyLlxuLy8gZXhjbHVkZUlkIGxldHMgdXBkYXRlcyBza2lwIHRoZSB2ZXJ5IHJvdyBiZWluZyBlZGl0ZWQgc28gYSBuby1vcCByZW5hbWVcbi8vIGRvZXNuJ3QgZmFsc2UtNDA5IGFnYWluc3QgaXRzZWxmLlxuY29uc3QgYXNzZXJ0TmFtZUF2YWlsYWJsZSA9IGFzeW5jIChcbiAgbmFtZTogc3RyaW5nLFxuICBzbHVnOiBzdHJpbmcsXG4gIGV4Y2x1ZGVJZD86IHN0cmluZyxcbikgPT4ge1xuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7XG4gICAgICBPUjogW3sgbmFtZSB9LCB7IHNsdWcgfV0sXG4gICAgICAuLi4oZXhjbHVkZUlkID8geyBOT1Q6IHsgaWQ6IGV4Y2x1ZGVJZCB9IH0gOiB7fSksXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKGV4aXN0aW5nKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJBIGNhdGVnb3J5IHdpdGggdGhpcyBuYW1lIGFscmVhZHkgZXhpc3RzXCIpO1xuICB9XG59O1xuXG4vLyBDcmVhdGUgY2F0ZWdvcnkgKGFkbWluKVxuY29uc3QgY3JlYXRlQ2F0ZWdvcnkgPSBhc3luYyAocGF5bG9hZDogSUNyZWF0ZUNhdGVnb3J5KSA9PiB7XG4gIGNvbnN0IHsgbmFtZSB9ID0gcGF5bG9hZDtcbiAgY29uc3Qgc2x1ZyA9IHNsdWdpZnkobmFtZSk7XG5cbiAgYXdhaXQgYXNzZXJ0TmFtZUF2YWlsYWJsZShuYW1lLCBzbHVnKTtcblxuICByZXR1cm4gcHJpc21hLmNhdGVnb3J5LmNyZWF0ZSh7XG4gICAgZGF0YTogeyBuYW1lLCBzbHVnIH0sXG4gIH0pO1xufTtcblxuLy8gR2V0IGFsbCBjYXRlZ29yaWVzIChwdWJsaWMpIHdpdGggY291bnRzIG9mIGFwcHJvdmVkLCBub24tZGVsZXRlZCBwYWNrYWdlc1xuY29uc3QgZ2V0QWxsQ2F0ZWdvcmllcyA9IGFzeW5jICgpID0+IHtcbiAgcmV0dXJuIHByaXNtYS5jYXRlZ29yeS5maW5kTWFueSh7XG4gICAgb3JkZXJCeTogeyBuYW1lOiBcImFzY1wiIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgX2NvdW50OiB7XG4gICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgIHBhY2thZ2VzOiB7XG4gICAgICAgICAgICB3aGVyZToge1xuICAgICAgICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xufTtcblxuLy8gVXBkYXRlIGNhdGVnb3J5IG5hbWUgKHJlZ2VuZXJhdGVzIHNsdWcpIChhZG1pbilcbmNvbnN0IHVwZGF0ZUNhdGVnb3J5ID0gYXN5bmMgKGNhdGVnb3J5SWQ6IHN0cmluZywgcGF5bG9hZDogSVVwZGF0ZUNhdGVnb3J5KSA9PiB7XG4gIGNvbnN0IHsgbmFtZSB9ID0gcGF5bG9hZDtcbiAgY29uc3Qgc2x1ZyA9IHNsdWdpZnkobmFtZSk7XG5cbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93KHsgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSB9KTtcbiAgYXdhaXQgYXNzZXJ0TmFtZUF2YWlsYWJsZShuYW1lLCBzbHVnLCBjYXRlZ29yeUlkKTtcblxuICByZXR1cm4gcHJpc21hLmNhdGVnb3J5LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSxcbiAgICBkYXRhOiB7IG5hbWUsIHNsdWcgfSxcbiAgfSk7XG59O1xuXG4vLyBEZWxldGUgY2F0ZWdvcnkgKGFkbWluKSBcdTIwMTQgNDA5IHdoZW4gYW55IHBhY2thZ2UgcmVmZXJlbmNlcyBpdFxuY29uc3QgZGVsZXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kVW5pcXVlT3JUaHJvdyh7IHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0gfSk7XG5cbiAgY29uc3QgcGFja2FnZUNvdW50ID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHtcbiAgICB3aGVyZTogeyBjYXRlZ29yeUlkIH0sXG4gIH0pO1xuXG4gIGlmIChwYWNrYWdlQ291bnQgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDA5LFxuICAgICAgXCJDYW5ub3QgZGVsZXRlIGNhdGVnb3J5IHdpdGggYXNzb2NpYXRlZCBwYWNrYWdlcy4gUmVuYW1lIGl0IGluc3RlYWQuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGF3YWl0IHByaXNtYS5jYXRlZ29yeS5kZWxldGUoeyB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9IH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5U2VydmljZSA9IHtcbiAgY3JlYXRlQ2F0ZWdvcnksXG4gIGdldEFsbENhdGVnb3JpZXMsXG4gIHVwZGF0ZUNhdGVnb3J5LFxuICBkZWxldGVDYXRlZ29yeSxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IG5hbWVTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBuYW1lIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDIsIFwiQ2F0ZWdvcnkgbmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAubWF4KDEwMCwgXCJDYXRlZ29yeSBuYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY3JlYXRlQ2F0ZWdvcnlTY2hlbWEgPSB6Lm9iamVjdCh7IG5hbWU6IG5hbWVTY2hlbWEgfSkuc3RyaWN0KCk7XG5cbmNvbnN0IHVwZGF0ZUNhdGVnb3J5U2NoZW1hID0gei5vYmplY3QoeyBuYW1lOiBuYW1lU2NoZW1hIH0pLnN0cmljdCgpO1xuXG5jb25zdCBjYXRlZ29yeVBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ2F0ZWdvcnkgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZUNhdGVnb3J5U2NoZW1hLFxuICB1cGRhdGVDYXRlZ29yeVNjaGVtYSxcbiAgY2F0ZWdvcnlQYXJhbXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgcGFja2FnZUNvbnRyb2xsZXIgfSBmcm9tIFwiLi9wYWNrYWdlLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHBhY2thZ2VWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3BhY2thZ2UudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gTk9URTogYC9pbnRlcm5hbC8qYCByb3V0ZXMgTVVTVCBzdGF5IHJlZ2lzdGVyZWQgYmVmb3JlIGBHRVQgLzpzbHVnYCBiZWxvdyBcdTIwMTRcbi8vIEV4cHJlc3MgbWF0Y2hlcyB0b3AtZG93biwgYW5kIGEgbGl0ZXJhbCBzZWdtZW50IChgL2ludGVybmFsL2FsbGApIHdvdWxkXG4vLyBvdGhlcndpc2UgYmUgc3dhbGxvd2VkIGJ5IHRoZSBgOnNsdWdgIHBhcmFtIHJvdXRlIGFuZCA0MDQgZm9yZXZlci5cblxuLy8gMS4gTXkgcGFja2FnZXMgKGFnZW50KSBcdTIwMTQgc2VsZi1wcmV2aWV3IG9mIFBFTkRJTkcvUkVKRUNURUQgYmVmb3JlIGFwcHJvdmFsXG5yb3V0ZXIuZ2V0KFxuICBcIi9pbnRlcm5hbC9teS1wYWNrYWdlc1wiLFxuICBhdXRoKFJvbGUuQUdFTlQpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogcGFja2FnZVZhbGlkYXRpb25zLmludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRNeVBhY2thZ2VzLFxuKTtcblxuLy8gMi4gQWxsIHBhY2thZ2VzIChhZG1pbiBtb2RlcmF0aW9uIFVJKVxucm91dGVyLmdldChcbiAgXCIvaW50ZXJuYWwvYWxsXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMuaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldEFsbFBhY2thZ2VzLFxuKTtcblxuLy8gMy4gUHVibGljIHBhY2thZ2UgZGV0YWlsIGJ5IHNsdWdcbnJvdXRlci5nZXQoXG4gIFwiLzpzbHVnXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VTbHVnUGFyYW1zU2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRQYWNrYWdlQnlTbHVnLFxuKTtcblxuLy8gNC4gQ3JlYXRlIHBhY2thZ2UgKGFnZW50IGNyZWF0ZXMgb3duOyBhZG1pbiBjYW4gY3JlYXRlIGZvciBhbnkgYWdlbnQpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHBhY2thZ2VWYWxpZGF0aW9ucy5jcmVhdGVQYWNrYWdlU2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5jcmVhdGVQYWNrYWdlLFxuKTtcblxuLy8gNS4gQXBwcm92ZS9yZWplY3QgcGFja2FnZSAoYWRtaW4pIFx1MjAxNCByZWdpc3RlcmVkIGJlZm9yZSBQQVRDSCAvOmlkIGZvciBjbGFyaXR5XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHBhY2thZ2VWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5jaGFuZ2VQYWNrYWdlU3RhdHVzLFxuKTtcblxuLy8gNi4gVXBkYXRlIHBhY2thZ2UgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBwYWNrYWdlVmFsaWRhdGlvbnMudXBkYXRlUGFja2FnZVNjaGVtYSxcbiAgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLnVwZGF0ZVBhY2thZ2UsXG4pO1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSBwYWNrYWdlIChhZ2VudCBvd24gLyBhZG1pbiBhbnkpXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVBhcmFtc1NjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuc29mdERlbGV0ZVBhY2thZ2UsXG4pO1xuXG4vLyA4LiBQdWJsaWMgbGlzdGluZyBcdTIwMTQga2VwdCBsYXN0IHNvIG5vbmUgb2YgdGhlIGFib3ZlIHJvdXRlcyBhcmUgc2hhZG93ZWRcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VRdWVyeVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0UHVibGljUGFja2FnZXMsXG4pO1xuXG5leHBvcnQgY29uc3QgcGFja2FnZVJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHBhY2thZ2VTZXJ2aWNlIH0gZnJvbSBcIi4vcGFja2FnZS5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIHBhY2thZ2UgY29udHJvbGxlciAoQUdFTlQvQURNSU4pXG5jb25zdCBjcmVhdGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuY3JlYXRlUGFja2FnZShyZXEudXNlciEsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgY3JlYXRlZCBzdWNjZXNzZnVsbHkuIEl0IHdpbGwgYmUgdmlzaWJsZSBhZnRlciBhZG1pbiBhcHByb3ZhbC5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIFB1YmxpYyBsaXN0aW5nIGNvbnRyb2xsZXIgKGZpbHRlcnMgKyBwYWdpbmF0aW9uKVxuY29uc3QgZ2V0UHVibGljUGFja2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRQdWJsaWNQYWNrYWdlcyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gUHVibGljIHBhY2thZ2UgZGV0YWlsIGJ5IHNsdWdcbmNvbnN0IGdldFBhY2thZ2VCeVNsdWcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0UGFja2FnZUJ5U2x1ZyhzbHVnKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBBbGwgcGFja2FnZXMgY29udHJvbGxlciAoQURNSU4gbW9kZXJhdGlvbilcbmNvbnN0IGdldEFsbFBhY2thZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0QWxsUGFja2FnZXMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgcGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA1LiBNeSBwYWNrYWdlcyBjb250cm9sbGVyIChBR0VOVClcbmNvbnN0IGdldE15UGFja2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRNeVBhY2thZ2VzKHVzZXJJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJZb3VyIHBhY2thZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNi4gVXBkYXRlIHBhY2thZ2UgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3QgdXBkYXRlUGFja2FnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLnVwZGF0ZVBhY2thZ2UocmVxLnVzZXIhLCBpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA3LiBDaGFuZ2UgcGFja2FnZSBzdGF0dXMgY29udHJvbGxlciAoQURNSU4gYXBwcm92ZS9yZWplY3QpXG5jb25zdCBjaGFuZ2VQYWNrYWdlU3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuY2hhbmdlUGFja2FnZVN0YXR1cyhpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2Ugc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gOC4gU29mdCBkZWxldGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCBzb2Z0RGVsZXRlUGFja2FnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGF3YWl0IHBhY2thZ2VTZXJ2aWNlLnNvZnREZWxldGVQYWNrYWdlKHJlcS51c2VyISwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VDb250cm9sbGVyID0ge1xuICBjcmVhdGVQYWNrYWdlLFxuICBnZXRQdWJsaWNQYWNrYWdlcyxcbiAgZ2V0UGFja2FnZUJ5U2x1ZyxcbiAgZ2V0QWxsUGFja2FnZXMsXG4gIGdldE15UGFja2FnZXMsXG4gIHVwZGF0ZVBhY2thZ2UsXG4gIGNoYW5nZVBhY2thZ2VTdGF0dXMsXG4gIHNvZnREZWxldGVQYWNrYWdlLFxufTsiLCAiaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuaW1wb3J0IHsgUGFja2FnZVN0YXR1cywgUm9sZSwgTm90aWZpY2F0aW9uVHlwZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgbm90aWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL25vdGlmaWNhdGlvblwiO1xuaW1wb3J0IHsgc2x1Z2lmeSB9IGZyb20gXCIuLi8uLi91dGlscy9zbHVnaWZ5XCI7XG5pbXBvcnQge1xuICBJQ3JlYXRlUGFja2FnZVBheWxvYWQsXG4gIElJbnRlcm5hbFBhY2thZ2VRdWVyeSxcbiAgSVBhY2thZ2VRdWVyeSxcbiAgSVJlcXVlc3RVc2VyLFxuICBJVXBkYXRlUGFja2FnZVBheWxvYWQsXG4gIElVcGRhdGVTdGF0dXNQYXlsb2FkLFxufSBmcm9tIFwiLi9wYWNrYWdlLmludGVyZmFjZVwiO1xuXG4vLyBNb25leSBpcyBgRGVjaW1hbCgxMCwyKWAgaW4gdGhlIHNjaGVtYSAoQUdFTlRTLm1kKSBcdTIwMTQgbWFwIHRvIE51bWJlciBvbiByZXR1cm4uXG5jb25zdCBzZXJpYWxpemVQcmljZSA9IDxUIGV4dGVuZHMgeyBwcmljZTogUHJpc21hLkRlY2ltYWwgfT4ocm93OiBUKTogVCA9PiAoe1xuICAuLi5yb3csXG4gIHByaWNlOiBOdW1iZXIocm93LnByaWNlKSxcbn0pO1xuXG4vLyBQdWJsaWMgcGF5bG9hZHMgY2FycnkgdGhlIGFnZW50J3MgZGlzcGxheSBpbmZvIG9ubHkgXHUyMDE0IG5ldmVyIGVtYWlsLlxuZXhwb3J0IGNvbnN0IHB1YmxpY1BhY2thZ2VJbmNsdWRlID0ge1xuICBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICBhZ2VudDogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGF2YXRhclVybDogdHJ1ZSB9IH0sXG59IGFzIGNvbnN0O1xuXG5jb25zdCB2YWxpZGF0ZUNhdGVnb3J5ID0gYXN5bmMgKGNhdGVnb3J5SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBjYXRlZ29yeSA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIWNhdGVnb3J5KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGNhdGVnb3J5SWRcIik7XG4gIH1cbn07XG5cbi8vIFBhY2thZ2VzIG11c3QgYmUgb3duZWQgYnkgYSBsaXZlIEFHRU5UIFx1MjAxNCBvdGhlcndpc2UgdGhlIGJvb2tpbmcgc3RhdGVcbi8vIG1hY2hpbmUncyBcIkFHRU5UIChvd25zIHBhY2thZ2UpXCIgYnJhbmNoIGFuZCBhZ2VudC1ib29raW5ncyBzY29waW5nIGJyZWFrLlxuY29uc3QgdmFsaWRhdGVBZ2VudCA9IGFzeW5jIChhZ2VudElkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgYWdlbnQgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogYWdlbnRJZCB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgcm9sZTogdHJ1ZSwgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghYWdlbnQgfHwgYWdlbnQucm9sZSAhPT0gUm9sZS5BR0VOVCB8fCBhZ2VudC5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgYWdlbnRJZFwiKTtcbiAgfVxufTtcblxuLy8gQ29sbGlzaW9uLXNhZmUgc2x1ZzogYmFzZSBzbHVnIGZyb20gdGhlIHRpdGxlLCB0aGVuIGAtMmAsIGAtM2AsIC4uLiB1c2luZyBhXG4vLyBzaW5nbGUgcHJlZml4IHF1ZXJ5LiBQdXJlLUJhbmdsYS9lbW9qaSB0aXRsZXMgY2FuJ3Qgc2x1Z2lmeSBcdTIwMTQgZmFsbCBiYWNrIHRvXG4vLyBgcGFja2FnZS08c2hvcnRJZD5gIHNvIHRoZSBVUkwgaXMgYWx3YXlzIG1lYW5pbmdmdWwuXG5jb25zdCBnZW5lcmF0ZVVuaXF1ZVNsdWcgPSBhc3luYyAodGl0bGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gIGNvbnN0IGJhc2UgPSBzbHVnaWZ5KHRpdGxlKSB8fCBgcGFja2FnZS0ke3JhbmRvbVVVSUQoKS5zbGljZSgwLCA4KX1gO1xuXG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICB3aGVyZTogeyBzbHVnOiB7IHN0YXJ0c1dpdGg6IGJhc2UgfSB9LFxuICAgIHNlbGVjdDogeyBzbHVnOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGNvbnN0IHVzZWQgPSBuZXcgU2V0KGV4aXN0aW5nLm1hcCgocCkgPT4gcC5zbHVnKSk7XG4gIGlmICghdXNlZC5oYXMoYmFzZSkpIHtcbiAgICByZXR1cm4gYmFzZTtcbiAgfVxuXG4gIGxldCBzdWZmaXggPSAyO1xuICB3aGlsZSAodXNlZC5oYXMoYCR7YmFzZX0tJHtzdWZmaXh9YCkpIHtcbiAgICBzdWZmaXggKz0gMTtcbiAgfVxuICByZXR1cm4gYCR7YmFzZX0tJHtzdWZmaXh9YDtcbn07XG5cbi8vIDEuIENyZWF0ZSBhIHBhY2thZ2UgKEFHRU5UL0FETUlOKS4gTmV3IHBhY2thZ2VzIHN0YXJ0IFBFTkRJTkcgYW5kIG5ldmVyIGxlYWtcbi8vICAgIGludG8gcHVibGljIHF1ZXJpZXMgdW50aWwgYW4gYWRtaW4gYXBwcm92ZXMgdGhlbS5cbmNvbnN0IGNyZWF0ZVBhY2thZ2UgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYXlsb2FkOiBJQ3JlYXRlUGFja2FnZVBheWxvYWQpID0+IHtcbiAgYXdhaXQgdmFsaWRhdGVDYXRlZ29yeShwYXlsb2FkLmNhdGVnb3J5SWQpO1xuXG4gIC8vIEFETUlOIG1heSBjcmVhdGUgb24gYmVoYWxmIG9mIGFuIGFnZW50IChvcHRpb25hbCBhZ2VudElkKTsgQUdFTlQgYWx3YXlzXG4gIC8vIG93bnMgd2hhdCB0aGV5IGNyZWF0ZSBhbmQgbWF5IG5vdCBpbXBlcnNvbmF0ZSBhbm90aGVyIHVzZXIuXG4gIGxldCBhZ2VudElkOiBzdHJpbmc7XG4gIGlmICh1c2VyLnJvbGUgPT09IFJvbGUuQURNSU4pIHtcbiAgICBpZiAocGF5bG9hZC5hZ2VudElkKSB7XG4gICAgICBhd2FpdCB2YWxpZGF0ZUFnZW50KHBheWxvYWQuYWdlbnRJZCk7XG4gICAgICBhZ2VudElkID0gcGF5bG9hZC5hZ2VudElkO1xuICAgIH0gZWxzZSB7XG4gICAgICBhZ2VudElkID0gdXNlci5pZDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKHBheWxvYWQuYWdlbnRJZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJhZ2VudElkIGNhbiBvbmx5IGJlIHNldCBieSBhbiBhZG1pblwiKTtcbiAgICB9XG4gICAgYWdlbnRJZCA9IHVzZXIuaWQ7XG4gIH1cblxuICBjb25zdCBzbHVnID0gYXdhaXQgZ2VuZXJhdGVVbmlxdWVTbHVnKHBheWxvYWQudGl0bGUpO1xuXG4gIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICB0aXRsZTogcGF5bG9hZC50aXRsZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBwYXlsb2FkLmRlc2NyaXB0aW9uLFxuICAgICAgbG9jYXRpb246IHBheWxvYWQubG9jYXRpb24sXG4gICAgICBwcmljZTogcGF5bG9hZC5wcmljZSxcbiAgICAgIGR1cmF0aW9uOiBwYXlsb2FkLmR1cmF0aW9uLFxuICAgICAgY2F0ZWdvcnlJZDogcGF5bG9hZC5jYXRlZ29yeUlkLFxuICAgICAgaW1hZ2VzOiBwYXlsb2FkLmltYWdlcyxcbiAgICAgIGFnZW50SWQsXG4gICAgICBzbHVnLFxuICAgIH0sXG4gIH0pO1xuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZShjcmVhdGVkKTtcbn07XG5cbi8vIDIuIFB1YmxpYyBleHBsb3JlZCBsaXN0aW5nIFx1MjAxNCBBUFBST1ZFRCArIG5vdC1kZWxldGVkIG9ubHksIGZpbHRlcnMgKyBzb3J0aW5nLlxuY29uc3QgZ2V0UHVibGljUGFja2FnZXMgPSBhc3luYyAocXVlcnk6IElQYWNrYWdlUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCBmaWx0ZXJzOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0W10gPSBbXTtcblxuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgZmlsdGVycy5wdXNoKHtcbiAgICAgIE9SOiBbXG4gICAgICAgIHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgeyBkZXNjcmlwdGlvbjogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICB7IGxvY2F0aW9uOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG4gIGlmIChxdWVyeS5sb2NhdGlvbikge1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICBsb2NhdGlvbjogeyBjb250YWluczogcXVlcnkubG9jYXRpb24sIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9LFxuICAgIH0pO1xuICB9XG4gIGlmIChxdWVyeS5taW5QcmljZSAhPT0gdW5kZWZpbmVkIHx8IHF1ZXJ5Lm1heFByaWNlICE9PSB1bmRlZmluZWQpIHtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgcHJpY2U6IHtcbiAgICAgICAgLi4uKHF1ZXJ5Lm1pblByaWNlICE9PSB1bmRlZmluZWQgPyB7IGd0ZTogcXVlcnkubWluUHJpY2UgfSA6IHt9KSxcbiAgICAgICAgLi4uKHF1ZXJ5Lm1heFByaWNlICE9PSB1bmRlZmluZWQgPyB7IGx0ZTogcXVlcnkubWF4UHJpY2UgfSA6IHt9KSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5Lm1pblJhdGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZmlsdGVycy5wdXNoKHsgcmF0aW5nOiB7IGd0ZTogcXVlcnkubWluUmF0aW5nIH0gfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5Lm1heER1cmF0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICBmaWx0ZXJzLnB1c2goeyBkdXJhdGlvbjogeyBsdGU6IHF1ZXJ5Lm1heER1cmF0aW9uIH0gfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5LmNhdGVnb3J5KSB7XG4gICAgZmlsdGVycy5wdXNoKHsgY2F0ZWdvcnk6IHsgc2x1ZzogcXVlcnkuY2F0ZWdvcnkgfSB9KTtcbiAgfVxuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0ID0ge1xuICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIEFORDogZmlsdGVycy5sZW5ndGggPiAwID8gZmlsdGVycyA6IHVuZGVmaW5lZCxcbiAgfTtcblxuICBjb25zdCBzb3J0T3JkZXIgPSBxdWVyeS5zb3J0T3JkZXIgPz8gKHF1ZXJ5LnNvcnRCeSA9PT0gXCJuZXdlc3RcIiA/IFwiZGVzY1wiIDogXCJhc2NcIik7XG5cbiAgY29uc3Qgb3JkZXJCeU1hcDogUmVjb3JkPHN0cmluZywgUHJpc21hLlRvdXJQYWNrYWdlT3JkZXJCeVdpdGhSZWxhdGlvbklucHV0PiA9IHtcbiAgICBuZXdlc3Q6IHsgY3JlYXRlZEF0OiBzb3J0T3JkZXIgfSxcbiAgICBwcmljZTogeyBwcmljZTogc29ydE9yZGVyIH0sXG4gICAgcmF0aW5nOiB7IHJhdGluZzogc29ydE9yZGVyIH0sXG4gICAgdGl0bGU6IHsgdGl0bGU6IHNvcnRPcmRlciB9LFxuICB9O1xuXG4gIGNvbnN0IG9yZGVyQnkgPSBvcmRlckJ5TWFwW3F1ZXJ5LnNvcnRCeSA/PyBcIm5ld2VzdFwiXSA/PyBvcmRlckJ5TWFwLm5ld2VzdDtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIG9yZGVyQnksXG4gICAgICBpbmNsdWRlOiBwdWJsaWNQYWNrYWdlSW5jbHVkZSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVQcmljZSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMy4gUHVibGljIGRldGFpbCBieSBzbHVnIFx1MjAxNCBBUFBST1ZFRCArIG5vdC1kZWxldGVkIG9ubHkuXG5jb25zdCBnZXRQYWNrYWdlQnlTbHVnID0gYXN5bmMgKHNsdWc6IHN0cmluZykgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7IHNsdWcsIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIGluY2x1ZGU6IHB1YmxpY1BhY2thZ2VJbmNsdWRlLFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UodG91clBhY2thZ2UpO1xufTtcblxuLy8gNC4gQWxsIHBhY2thZ2VzIGZvciB0aGUgYWRtaW4gbW9kZXJhdGlvbiBVSSAoYW55IHN0YXR1cywgb3B0aW9uYWwgZmlsdGVycykuXG5jb25zdCBnZXRBbGxQYWNrYWdlcyA9IGFzeW5jIChxdWVyeTogSUludGVybmFsUGFja2FnZVF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXQgPSB7XG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc3RhdHVzID8geyBzdGF0dXM6IHF1ZXJ5LnN0YXR1cyB9IDoge30pLFxuICAgIC4uLihxdWVyeS5hZ2VudElkID8geyBhZ2VudElkOiBxdWVyeS5hZ2VudElkIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7XG4gICAgICAgIGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0sXG4gICAgICAgIGFnZW50OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVByaWNlKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyA1LiBBbiBhZ2VudCdzIG93biBwYWNrYWdlcyAoYW55IHN0YXR1cykgXHUyMDE0IHNlbGYtcHJldmlldyBiZWZvcmUgYXBwcm92YWwuXG5jb25zdCBnZXRNeVBhY2thZ2VzID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBxdWVyeTogSUludGVybmFsUGFja2FnZVF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXQgPSB7XG4gICAgYWdlbnRJZDogdXNlcklkLFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0gfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVByaWNlKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyBGZXRjaCArIG93bmVyc2hpcCBnYXRlIHNoYXJlZCBieSBQQVRDSCBhbmQgREVMRVRFLiBBRE1JTiBieXBhc3NlcyBvd25lcnNoaXA7XG4vLyBBR0VOVCBlZGl0cyBhcmUgY29uZmluZWQgdG8gdGhlaXIgb3duIHBhY2thZ2VzLlxuY29uc3QgZmluZE93bmVkUGFja2FnZSA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBhY2thZ2VJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiAmJiB0b3VyUGFja2FnZS5hZ2VudElkICE9PSB1c2VyLmlkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2FuIG9ubHkgYWN0IG9uIHlvdXIgb3duIHBhY2thZ2VzLlwiKTtcbiAgfVxuXG4gIHJldHVybiB0b3VyUGFja2FnZTtcbn07XG5cbi8vIDYuIFVwZGF0ZSBhIHBhY2thZ2UuIFNsdWcgbmV2ZXIgY2hhbmdlcyAoa2VlcHMgbGlua3MvYm9va21hcmtzIHZhbGlkKS5cbi8vICAgIEFHRU5UIGVkaXRzIHJlc2V0IHN0YXR1cyB0byBQRU5ESU5HOyBBRE1JTiBlZGl0cyBwcmVzZXJ2ZSBpdC5cbmNvbnN0IHVwZGF0ZVBhY2thZ2UgPSBhc3luYyAoXG4gIHVzZXI6IElSZXF1ZXN0VXNlcixcbiAgcGFja2FnZUlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQYWNrYWdlUGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IGZpbmRPd25lZFBhY2thZ2UodXNlciwgcGFja2FnZUlkKTtcblxuICBpZiAocGF5bG9hZC5jYXRlZ29yeUlkICE9PSB1bmRlZmluZWQpIHtcbiAgICBhd2FpdCB2YWxpZGF0ZUNhdGVnb3J5KHBheWxvYWQuY2F0ZWdvcnlJZCk7XG4gIH1cblxuICBjb25zdCBkYXRhOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVJbnB1dCA9IHtcbiAgICAuLi4ocGF5bG9hZC50aXRsZSAhPT0gdW5kZWZpbmVkID8geyB0aXRsZTogcGF5bG9hZC50aXRsZSB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmRlc2NyaXB0aW9uICE9PSB1bmRlZmluZWQgPyB7IGRlc2NyaXB0aW9uOiBwYXlsb2FkLmRlc2NyaXB0aW9uIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQubG9jYXRpb24gIT09IHVuZGVmaW5lZCA/IHsgbG9jYXRpb246IHBheWxvYWQubG9jYXRpb24gfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5wcmljZSAhPT0gdW5kZWZpbmVkID8geyBwcmljZTogcGF5bG9hZC5wcmljZSB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmR1cmF0aW9uICE9PSB1bmRlZmluZWQgPyB7IGR1cmF0aW9uOiBwYXlsb2FkLmR1cmF0aW9uIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuaW1hZ2VzICE9PSB1bmRlZmluZWQgPyB7IGltYWdlczogcGF5bG9hZC5pbWFnZXMgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5jYXRlZ29yeUlkICE9PSB1bmRlZmluZWRcbiAgICAgID8geyBjYXRlZ29yeTogeyBjb25uZWN0OiB7IGlkOiBwYXlsb2FkLmNhdGVnb3J5SWQgfSB9IH1cbiAgICAgIDoge30pLFxuICAgIC4uLih1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gPyB7IHN0YXR1czogUGFja2FnZVN0YXR1cy5QRU5ESU5HIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhLFxuICAgIGluY2x1ZGU6IHsgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSB9LFxuICB9KTtcblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UodXBkYXRlZCk7XG59O1xuXG4vLyA3LiBBcHByb3ZlL3JlamVjdCBhIHBhY2thZ2UgKGFkbWluKS5cbmNvbnN0IGNoYW5nZVBhY2thZ2VTdGF0dXMgPSBhc3luYyAoXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlU3RhdHVzUGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kVW5pcXVlT3JUaHJvdyh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICB9KTtcblxuICBpZiAodG91clBhY2thZ2UuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDYW5ub3QgY2hhbmdlIHRoZSBzdGF0dXMgb2YgYSBkZWxldGVkIHBhY2thZ2UuXCIpO1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhOiB7IHN0YXR1czogcGF5bG9hZC5zdGF0dXMgfSxcbiAgfSk7XG5cbiAgLy8gYmVzdC1lZmZvcnQgaW4tYXBwIG5vdGlmaWNhdGlvbiB0byB0aGUgc3VibWl0dGluZyBhZ2VudCAobmV2ZXIgZmFpbHMgcmVxdWVzdClcbiAgY29uc3Qgbm90aWZpZWQgPSB7XG4gICAgdHlwZTpcbiAgICAgIHBheWxvYWQuc3RhdHVzID09PSBQYWNrYWdlU3RhdHVzLkFQUFJPVkVEXG4gICAgICAgID8gTm90aWZpY2F0aW9uVHlwZS5QQUNLQUdFX0FQUFJPVkVEXG4gICAgICAgIDogTm90aWZpY2F0aW9uVHlwZS5QQUNLQUdFX1JFSkVDVEVELFxuICAgIHRpdGxlOlxuICAgICAgcGF5bG9hZC5zdGF0dXMgPT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgICAgICAgPyBcIlBhY2thZ2UgYXBwcm92ZWRcIlxuICAgICAgICA6IFwiUGFja2FnZSByZWplY3RlZFwiLFxuICAgIG1lc3NhZ2U6XG4gICAgICBwYXlsb2FkLnN0YXR1cyA9PT0gUGFja2FnZVN0YXR1cy5BUFBST1ZFRFxuICAgICAgICA/IGBZb3VyIHBhY2thZ2UgXCIke3RvdXJQYWNrYWdlLnRpdGxlfVwiIGhhcyBiZWVuIGFwcHJvdmVkIGFuZCBpcyBub3cgbGl2ZS5gXG4gICAgICAgIDogYFlvdXIgcGFja2FnZSBcIiR7dG91clBhY2thZ2UudGl0bGV9XCIgd2FzIHJlamVjdGVkLiBQbGVhc2UgcmV2aWV3IGFuZCByZXN1Ym1pdC5gLFxuICB9O1xuICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgbm90aWZ5KFxuICAgICAgdG91clBhY2thZ2UuYWdlbnRJZCxcbiAgICAgIG5vdGlmaWVkLnR5cGUsXG4gICAgICBub3RpZmllZC50aXRsZSxcbiAgICAgIG5vdGlmaWVkLm1lc3NhZ2UsXG4gICAgICBgL2Rhc2hib2FyZC9hZ2VudC9wYWNrYWdlcy8ke3BhY2thZ2VJZH1gLFxuICAgICksXG4gIF0pO1xuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh1cGRhdGVkKTtcbn07XG5cbi8vIDguIFNvZnQgZGVsZXRlIChhZG1pbiBhbnksIGFnZW50IG93bikuXG5jb25zdCBzb2Z0RGVsZXRlUGFja2FnZSA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBhY2thZ2VJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IGZpbmRPd25lZFBhY2thZ2UodXNlciwgcGFja2FnZUlkKTtcblxuICByZXR1cm4gcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VTZXJ2aWNlID0ge1xuICBjcmVhdGVQYWNrYWdlLFxuICBnZXRQdWJsaWNQYWNrYWdlcyxcbiAgZ2V0UGFja2FnZUJ5U2x1ZyxcbiAgZ2V0QWxsUGFja2FnZXMsXG4gIGdldE15UGFja2FnZXMsXG4gIHVwZGF0ZVBhY2thZ2UsXG4gIGNoYW5nZVBhY2thZ2VTdGF0dXMsXG4gIHNvZnREZWxldGVQYWNrYWdlLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgdGl0bGVTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJUaXRsZSBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigzLCBcIlRpdGxlIG11c3QgYmUgYXQgbGVhc3QgMyBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMjAwLCBcIlRpdGxlIG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgZGVzY3JpcHRpb25TY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJEZXNjcmlwdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigxMCwgXCJEZXNjcmlwdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDEwIGNoYXJhY3RlcnNcIilcbiAgLm1heCgxMDAwMCwgXCJEZXNjcmlwdGlvbiBtdXN0IGJlIGF0IG1vc3QgMTAwMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgbG9jYXRpb25TY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJMb2NhdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigyLCBcIkxvY2F0aW9uIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMjAwLCBcIkxvY2F0aW9uIG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgcHJpY2VTY2hlbWEgPSB6XG4gIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJQcmljZSBpcyByZXF1aXJlZFwiIH0pXG4gIC5wb3NpdGl2ZShcIlByaWNlIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXJcIilcbiAgLnJlZmluZSgodmFsKSA9PiBNYXRoLnJvdW5kKHZhbCAqIDEwMCkgLyAxMDAgPT09IHZhbCwge1xuICAgIG1lc3NhZ2U6IFwiUHJpY2UgbXVzdCBoYXZlIGF0IG1vc3QgMiBkZWNpbWFsIHBsYWNlc1wiLFxuICB9KTtcblxuY29uc3QgZHVyYXRpb25TY2hlbWEgPSB6XG4gIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJEdXJhdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC5pbnQoXCJEdXJhdGlvbiBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyIG9mIGRheXNcIilcbiAgLm1pbigxLCBcIkR1cmF0aW9uIG11c3QgYmUgYXQgbGVhc3QgMSBkYXlcIik7XG5cbmNvbnN0IGNhdGVnb3J5SWRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gIC5taW4oMSwgXCJDYXRlZ29yeSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKTtcblxuY29uc3QgaW1hZ2VzU2NoZW1hID0gelxuICAuYXJyYXkoei5zdHJpbmcoKS51cmwoXCJFYWNoIGltYWdlIG11c3QgYmUgYSB2YWxpZCBVUkxcIikpXG4gIC5taW4oMSwgXCJBdCBsZWFzdCBvbmUgaW1hZ2UgaXMgcmVxdWlyZWRcIilcbiAgLm1heCg2LCBcIkF0IG1vc3QgNiBpbWFnZXMgYXJlIGFsbG93ZWRcIik7XG5cbmNvbnN0IGNyZWF0ZVBhY2thZ2VTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYSxcbiAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb25TY2hlbWEsXG4gICAgbG9jYXRpb246IGxvY2F0aW9uU2NoZW1hLFxuICAgIHByaWNlOiBwcmljZVNjaGVtYSxcbiAgICBkdXJhdGlvbjogZHVyYXRpb25TY2hlbWEsXG4gICAgY2F0ZWdvcnlJZDogY2F0ZWdvcnlJZFNjaGVtYSxcbiAgICBpbWFnZXM6IGltYWdlc1NjaGVtYSxcbiAgICBhZ2VudElkOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHVwZGF0ZVBhY2thZ2VTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGxvY2F0aW9uOiBsb2NhdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIHByaWNlOiBwcmljZVNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGR1cmF0aW9uOiBkdXJhdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNhdGVnb3J5SWQ6IGNhdGVnb3J5SWRTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBpbWFnZXM6IGltYWdlc1NjaGVtYS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KClcbiAgLnJlZmluZSgoZGF0YSkgPT4gT2JqZWN0LmtleXMoZGF0YSkubGVuZ3RoID4gMCwge1xuICAgIG1lc3NhZ2U6IFwiQXQgbGVhc3Qgb25lIGZpZWxkIG11c3QgYmUgcHJvdmlkZWQgdG8gdXBkYXRlXCIsXG4gIH0pO1xuXG5jb25zdCBwYWNrYWdlUXVlcnlTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICAgIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIGNhdGVnb3J5OiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBsb2NhdGlvbjogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgbWluUHJpY2U6IHouY29lcmNlLm51bWJlcigpLnBvc2l0aXZlKCkub3B0aW9uYWwoKSxcbiAgICBtYXhQcmljZTogei5jb2VyY2UubnVtYmVyKCkucG9zaXRpdmUoKS5vcHRpb25hbCgpLFxuICAgIG1pblJhdGluZzogei5jb2VyY2UubnVtYmVyKCkubWluKDApLm1heCg1KS5vcHRpb25hbCgpLFxuICAgIG1heER1cmF0aW9uOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgICBzb3J0Qnk6IHpcbiAgICAgIC5lbnVtKFtcIm5ld2VzdFwiLCBcInByaWNlXCIsIFwicmF0aW5nXCIsIFwidGl0bGVcIl0pXG4gICAgICAuZGVmYXVsdChcIm5ld2VzdFwiKSxcbiAgICBzb3J0T3JkZXI6IHouZW51bShbXCJhc2NcIiwgXCJkZXNjXCJdKS5vcHRpb25hbCgpLFxuICB9KVxuICAucmVmaW5lKChkYXRhKSA9PiB7XG4gICAgaWYgKGRhdGEubWluUHJpY2UgIT09IHVuZGVmaW5lZCAmJiBkYXRhLm1heFByaWNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBkYXRhLm1pblByaWNlIDw9IGRhdGEubWF4UHJpY2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9LCB7XG4gICAgbWVzc2FnZTogXCJtaW5QcmljZSBtdXN0IGJlIGxlc3MgdGhhbiBvciBlcXVhbCB0byBtYXhQcmljZVwiLFxuICAgIHBhdGg6IFtcIm1pblByaWNlXCJdLFxuICB9KTtcblxuY29uc3QgaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIHN0YXR1czogelxuICAgIC5lbnVtKFtcIlBFTkRJTkdcIiwgXCJBUFBST1ZFRFwiLCBcIlJFSkVDVEVEXCJdKVxuICAgIC50cmFuc2Zvcm0oKHZhbCkgPT4gdmFsIGFzIFwiUEVORElOR1wiIHwgXCJBUFBST1ZFRFwiIHwgXCJSRUpFQ1RFRFwiKVxuICAgIC5vcHRpb25hbCgpLFxuICBhZ2VudElkOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IHBhY2thZ2VQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgcGFja2FnZVNsdWdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHNsdWc6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBzbHVnIGlzIHJlcXVpcmVkXCIgfSkudHJpbSgpLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVTdGF0dXNTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHN0YXR1czogei5lbnVtKFtcIkFQUFJPVkVEXCIsIFwiUkVKRUNURURcIl0sIHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcIlN0YXR1cyBpcyByZXF1aXJlZFwiLFxuICAgICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlN0YXR1cyBtdXN0IGJlIEFQUFJPVkVEIG9yIFJFSkVDVEVEXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlUGFja2FnZVNjaGVtYSxcbiAgdXBkYXRlUGFja2FnZVNjaGVtYSxcbiAgcGFja2FnZVF1ZXJ5U2NoZW1hLFxuICBpbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSxcbiAgcGFja2FnZVBhcmFtc1NjaGVtYSxcbiAgcGFja2FnZVNsdWdQYXJhbXNTY2hlbWEsXG4gIHVwZGF0ZVN0YXR1c1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBibG9nQ29udHJvbGxlciB9IGZyb20gXCIuL2Jsb2cuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYmxvZ1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYmxvZy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBOT1RFOiBgL2ludGVybmFsLypgIHJvdXRlcyBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgYEdFVCAvOnNsdWdgIGJlbG93IFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYSBsaXRlcmFsIHNlZ21lbnQgKGAvaW50ZXJuYWwvYWxsYCkgd291bGRcbi8vIG90aGVyd2lzZSBiZSBzd2FsbG93ZWQgYnkgdGhlIGA6c2x1Z2AgcGFyYW0gcm91dGUgYW5kIDQwNCBmb3JldmVyLlxuXG4vLyAxLiBBbGwgcG9zdHMgKGFkbWluIG1vZGVyYXRpb24gVUkpIFx1MjAxNCByZWdpc3RlcmVkIGJlZm9yZSAvOnNsdWdcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL2FsbFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLmludGVybmFsUXVlcnlTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldEFsbFBvc3RzLFxuKTtcblxuLy8gMWIuIE93biBwb3N0cyAoXCJNeSBQb3N0c1wiIFVJIGZvciBhZ2VudHMvYWRtaW5zKSBcdTIwMTQgYmVmb3JlIC86c2x1Z1xucm91dGVyLmdldChcbiAgXCIvbXktcG9zdHNcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJsb2dWYWxpZGF0aW9ucy5pbnRlcm5hbFF1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRNeVBvc3RzLFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgXHUyMDE0IFBVQkxJU0hFRCArIG5vdC1kZWxldGVkIG9ubHlcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLnB1YmxpY1F1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRQdWJsaWNQb3N0cyxcbik7XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi86c2x1Z1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0U2x1Z1BhcmFtc1NjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0UG9zdEJ5U2x1Zyxcbik7XG5cbi8vIDQuIENyZWF0ZSBwb3N0IChhZ2VudC9hZG1pbiBhdXRob3JzIG93biBwb3N0czsgbmV3IHBvc3RzIHN0YXJ0IERSQUZUKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBibG9nVmFsaWRhdGlvbnMuY3JlYXRlUG9zdFNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuY3JlYXRlUG9zdCxcbik7XG5cbi8vIDUuIFB1Ymxpc2gvdW5wdWJsaXNoIHBvc3QgKGFkbWluKSBcdTIwMTQgcmVnaXN0ZXJlZCBiZWZvcmUgUEFUQ0ggLzppZCBmb3IgY2xhcml0eVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBibG9nVmFsaWRhdGlvbnMudXBkYXRlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuY2hhbmdlUG9zdFN0YXR1cyxcbik7XG5cbi8vIDYuIFVwZGF0ZSBwb3N0IChhZ2VudCBvd24gLyBhZG1pbiBhbnkpIFx1MjAxNCBhZ2VudCBlZGl0cyByZXNldCB0byBEUkFGVFxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJsb2dWYWxpZGF0aW9ucy51cGRhdGVQb3N0U2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIudXBkYXRlUG9zdCxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBvc3QgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5zb2Z0RGVsZXRlUG9zdCxcbik7XG5cbmV4cG9ydCBjb25zdCBibG9nUm91dGVzID0gcm91dGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBibG9nU2VydmljZSB9IGZyb20gXCIuL2Jsb2cuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBwb3N0IGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgY3JlYXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmNyZWF0ZVBvc3QocmVxLnVzZXIhLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQb3N0IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LiBJdCB3aWxsIGJlIHZpc2libGUgYWZ0ZXIgcHVibGlzaGluZy5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIFB1YmxpYyBsaXN0aW5nIGNvbnRyb2xsZXIgKHNlYXJjaCArIHNvcnQgKyBwYWdpbmF0aW9uKVxuY29uc3QgZ2V0UHVibGljUG9zdHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRQdWJsaWNQb3N0cyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gUHVibGljIHBvc3QgZGV0YWlsIGJ5IHNsdWdcbmNvbnN0IGdldFBvc3RCeVNsdWcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0UG9zdEJ5U2x1ZyhzbHVnKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0IHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBBbGwgcG9zdHMgY29udHJvbGxlciAoQURNSU4gbW9kZXJhdGlvbilcbmNvbnN0IGdldEFsbFBvc3RzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0QWxsUG9zdHMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgcG9zdHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0Yi4gT3duIHBvc3RzIGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgZ2V0TXlQb3N0cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldE15UG9zdHMocmVxLnVzZXIhLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNS4gVXBkYXRlIHBvc3QgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3QgdXBkYXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLnVwZGF0ZVBvc3QocmVxLnVzZXIhLCBpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA2LiBDaGFuZ2UgcG9zdCBzdGF0dXMgY29udHJvbGxlciAoQURNSU4gcHVibGlzaC91bnB1Ymxpc2gpXG5jb25zdCBjaGFuZ2VQb3N0U3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuY2hhbmdlUG9zdFN0YXR1cyhpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3Qgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNy4gU29mdCBkZWxldGUgcG9zdCBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCBzb2Z0RGVsZXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGF3YWl0IGJsb2dTZXJ2aWNlLnNvZnREZWxldGVQb3N0KHJlcS51c2VyISwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJsb2dDb250cm9sbGVyID0ge1xuICBjcmVhdGVQb3N0LFxuICBnZXRQdWJsaWNQb3N0cyxcbiAgZ2V0UG9zdEJ5U2x1ZyxcbiAgZ2V0QWxsUG9zdHMsXG4gIGdldE15UG9zdHMsXG4gIHVwZGF0ZVBvc3QsXG4gIGNoYW5nZVBvc3RTdGF0dXMsXG4gIHNvZnREZWxldGVQb3N0LFxufTtcbiIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyBQb3N0U3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVQb3N0UGF5bG9hZCxcbiAgSUludGVybmFsUG9zdFF1ZXJ5LFxuICBJUG9zdFF1ZXJ5LFxuICBJUmVxdWVzdFVzZXIsXG4gIElVcGRhdGVQb3N0UGF5bG9hZCxcbiAgSVVwZGF0ZVBvc3RTdGF0dXNQYXlsb2FkLFxufSBmcm9tIFwiLi9ibG9nLmludGVyZmFjZVwiO1xuXG4vLyBQdWJsaWMgcGF5bG9hZHMgY2FycnkgdGhlIGF1dGhvcidzIGRpc3BsYXkgaW5mbyBvbmx5IFx1MjAxNCBuZXZlciBlbWFpbC9yb2xlLlxuY29uc3QgcHVibGljQXV0aG9yU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGF2YXRhclVybDogdHJ1ZSB9LFxufTtcblxuLy8gQ29sbGlzaW9uLXNhZmUgc2x1ZzogYmFzZSBzbHVnIGZyb20gdGhlIHRpdGxlLCB0aGVuIGAtMmAsIGAtM2AsIC4uLiB1c2luZyBhXG4vLyBzaW5nbGUgcHJlZml4IHF1ZXJ5LiBQdXJlLUJhbmdsYS9lbW9qaSB0aXRsZXMgY2FuJ3Qgc2x1Z2lmeSBcdTIwMTQgZmFsbCBiYWNrIHRvXG4vLyBgYmxvZy08c2hvcnRJZD5gIHNvIHRoZSBVUkwgaXMgYWx3YXlzIG1lYW5pbmdmdWwuXG5jb25zdCBnZW5lcmF0ZVVuaXF1ZVNsdWcgPSBhc3luYyAodGl0bGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gIGNvbnN0IGJhc2UgPSBzbHVnaWZ5KHRpdGxlKSB8fCBgYmxvZy0ke3JhbmRvbVVVSUQoKS5zbGljZSgwLCA4KX1gO1xuXG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICB3aGVyZTogeyBzbHVnOiB7IHN0YXJ0c1dpdGg6IGJhc2UgfSB9LFxuICAgIHNlbGVjdDogeyBzbHVnOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGNvbnN0IHVzZWQgPSBuZXcgU2V0KGV4aXN0aW5nLm1hcCgocCkgPT4gcC5zbHVnKSk7XG4gIGlmICghdXNlZC5oYXMoYmFzZSkpIHtcbiAgICByZXR1cm4gYmFzZTtcbiAgfVxuXG4gIGxldCBzdWZmaXggPSAyO1xuICB3aGlsZSAodXNlZC5oYXMoYCR7YmFzZX0tJHtzdWZmaXh9YCkpIHtcbiAgICBzdWZmaXggKz0gMTtcbiAgfVxuICByZXR1cm4gYCR7YmFzZX0tJHtzdWZmaXh9YDtcbn07XG5cbi8vIDEuIENyZWF0ZSBhIHBvc3QgKEFHRU5UL0FETUlOKS4gTmV3IHBvc3RzIHN0YXJ0IERSQUZUIGFuZCBuZXZlciBsZWFrIGludG9cbi8vICAgIHB1YmxpYyBxdWVyaWVzIHVudGlsIGFuIGFkbWluIHB1Ymxpc2hlcyB0aGVtLlxuY29uc3QgY3JlYXRlUG9zdCA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBheWxvYWQ6IElDcmVhdGVQb3N0UGF5bG9hZCkgPT4ge1xuICBjb25zdCBzbHVnID0gYXdhaXQgZ2VuZXJhdGVVbmlxdWVTbHVnKHBheWxvYWQudGl0bGUpO1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICB0aXRsZTogcGF5bG9hZC50aXRsZSxcbiAgICAgIGV4Y2VycHQ6IHBheWxvYWQuZXhjZXJwdCxcbiAgICAgIGNvbnRlbnQ6IHBheWxvYWQuY29udGVudCxcbiAgICAgIGNvdmVySW1hZ2U6IHBheWxvYWQuY292ZXJJbWFnZSxcbiAgICAgIHNsdWcsXG4gICAgICBhdXRob3JJZDogdXNlci5pZCxcbiAgICB9LFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG59O1xuXG4vLyAyLiBQdWJsaWMgYmxvZyBsaXN0aW5nIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5LCBzZWFyY2ggKyBzb3J0LlxuY29uc3QgZ2V0UHVibGljUG9zdHMgPSBhc3luYyAocXVlcnk6IElQb3N0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkJsb2dQb3N0V2hlcmVJbnB1dCA9IHtcbiAgICBzdGF0dXM6IFBvc3RTdGF0dXMuUFVCTElTSEVELFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnNlYXJjaFxuICAgICAgPyB7XG4gICAgICAgICAgT1I6IFtcbiAgICAgICAgICAgIHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgICAgIHsgZXhjZXJwdDogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH1cbiAgICAgIDoge30pLFxuICB9O1xuXG4gIGNvbnN0IHNvcnRPcmRlciA9IHF1ZXJ5LnNvcnRPcmRlciA/PyAocXVlcnkuc29ydEJ5ID09PSBcIm9sZGVzdFwiID8gXCJhc2NcIiA6IFwiZGVzY1wiKTtcblxuICBjb25zdCBvcmRlckJ5TWFwOiBSZWNvcmQ8c3RyaW5nLCBQcmlzbWEuQmxvZ1Bvc3RPcmRlckJ5V2l0aFJlbGF0aW9uSW5wdXQ+ID0ge1xuICAgIG5ld2VzdDogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgb2xkZXN0OiB7IGNyZWF0ZWRBdDogXCJhc2NcIiB9LFxuICAgIHRpdGxlOiB7IHRpdGxlOiBzb3J0T3JkZXIgfSxcbiAgfTtcblxuICBjb25zdCBvcmRlckJ5ID0gb3JkZXJCeU1hcFtxdWVyeS5zb3J0QnkgPz8gXCJuZXdlc3RcIl0gPz8gb3JkZXJCeU1hcC5uZXdlc3Q7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5LFxuICAgICAgc2VsZWN0OiB7XG4gICAgICAgIGlkOiB0cnVlLFxuICAgICAgICB0aXRsZTogdHJ1ZSxcbiAgICAgICAgc2x1ZzogdHJ1ZSxcbiAgICAgICAgZXhjZXJwdDogdHJ1ZSxcbiAgICAgICAgY292ZXJJbWFnZTogdHJ1ZSxcbiAgICAgICAgY3JlYXRlZEF0OiB0cnVlLFxuICAgICAgICB1cGRhdGVkQXQ6IHRydWUsXG4gICAgICAgIGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0LFxuICAgICAgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5LlxuY29uc3QgZ2V0UG9zdEJ5U2x1ZyA9IGFzeW5jIChzbHVnOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7IHNsdWcsIHN0YXR1czogUG9zdFN0YXR1cy5QVUJMSVNIRUQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xuXG4gIGlmICghcG9zdCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUG9zdCBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc3Q7XG59O1xuXG4vLyA0LiBBbGwgcG9zdHMgZm9yIHRoZSBhZG1pbiBtb2RlcmF0aW9uIFVJIChhbnkgc3RhdHVzLCBvcHRpb25hbCBmaWx0ZXIpLlxuY29uc3QgZ2V0QWxsUG9zdHMgPSBhc3luYyAocXVlcnk6IElJbnRlcm5hbFBvc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQmxvZ1Bvc3RXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgYXV0aG9yOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDRiLiBUaGUgY2FsbGVyJ3Mgb3duIHBvc3RzIChBR0VOVC9BRE1JTiBcIk15IFBvc3RzXCIgVUkpIFx1MjAxNCBhbnkgc3RhdHVzLCBzaW5jZVxuLy8gICAgIGFnZW50cyBtdXN0IHNlZSB0aGVpciBvd24gZHJhZnRzIGJlZm9yZSBhbiBhZG1pbiBwdWJsaXNoZXMgdGhlbS5cbmNvbnN0IGdldE15UG9zdHMgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBxdWVyeTogSUludGVybmFsUG9zdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5CbG9nUG9zdFdoZXJlSW5wdXQgPSB7XG4gICAgYXV0aG9ySWQ6IHVzZXIuaWQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc3RhdHVzID8geyBzdGF0dXM6IHF1ZXJ5LnN0YXR1cyB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBhdXRob3I6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0gfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nUG9zdC5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gRmV0Y2ggKyBvd25lcnNoaXAgZ2F0ZSBzaGFyZWQgYnkgUEFUQ0ggYW5kIERFTEVURS4gQURNSU4gYnlwYXNzZXMgb3duZXJzaGlwO1xuLy8gQUdFTlQgZWRpdHMgYXJlIGNvbmZpbmVkIHRvIHRoZWlyIG93biBwb3N0cy5cbmNvbnN0IGZpbmRPd25lZFBvc3QgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwb3N0SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgfSk7XG5cbiAgaWYgKCFwb3N0KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQb3N0IG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBpZiAodXNlci5yb2xlICE9PSBSb2xlLkFETUlOICYmIHBvc3QuYXV0aG9ySWQgIT09IHVzZXIuaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW4gb25seSBhY3Qgb24geW91ciBvd24gcG9zdHMuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc3Q7XG59O1xuXG4vLyA1LiBVcGRhdGUgYSBwb3N0LiBTbHVnIG5ldmVyIGNoYW5nZXMgKGtlZXBzIGxpbmtzL2Jvb2ttYXJrcyB2YWxpZCkuXG4vLyAgICBBR0VOVCBlZGl0cyByZXNldCBzdGF0dXMgdG8gRFJBRlQgKHJlLXB1Ymxpc2ggdmlhIC86aWQvc3RhdHVzKTtcbi8vICAgIEFETUlOIGVkaXRzIHByZXNlcnZlIHN0YXR1cy5cbmNvbnN0IHVwZGF0ZVBvc3QgPSBhc3luYyAoXG4gIHVzZXI6IElSZXF1ZXN0VXNlcixcbiAgcG9zdElkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQb3N0UGF5bG9hZCxcbikgPT4ge1xuICBhd2FpdCBmaW5kT3duZWRQb3N0KHVzZXIsIHBvc3RJZCk7XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLkJsb2dQb3N0VXBkYXRlSW5wdXQgPSB7XG4gICAgLi4uKHBheWxvYWQudGl0bGUgIT09IHVuZGVmaW5lZCA/IHsgdGl0bGU6IHBheWxvYWQudGl0bGUgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5leGNlcnB0ICE9PSB1bmRlZmluZWQgPyB7IGV4Y2VycHQ6IHBheWxvYWQuZXhjZXJwdCB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNvbnRlbnQgIT09IHVuZGVmaW5lZCA/IHsgY29udGVudDogcGF5bG9hZC5jb250ZW50IH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuY292ZXJJbWFnZSAhPT0gdW5kZWZpbmVkXG4gICAgICA/IHsgY292ZXJJbWFnZTogcGF5bG9hZC5jb3ZlckltYWdlIH1cbiAgICAgIDoge30pLFxuICAgIC4uLih1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gPyB7IHN0YXR1czogUG9zdFN0YXR1cy5EUkFGVCB9IDoge30pLFxuICB9O1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gNi4gUHVibGlzaC91bnB1Ymxpc2ggYSBwb3N0IChhZG1pbikuXG5jb25zdCBjaGFuZ2VQb3N0U3RhdHVzID0gYXN5bmMgKFxuICBwb3N0SWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVBvc3RTdGF0dXNQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHBvc3QgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZFVuaXF1ZU9yVGhyb3coe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgfSk7XG5cbiAgaWYgKHBvc3QuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDYW5ub3QgY2hhbmdlIHRoZSBzdGF0dXMgb2YgYSBkZWxldGVkIHBvc3QuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgICBkYXRhOiB7IHN0YXR1czogcGF5bG9hZC5zdGF0dXMgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gNy4gU29mdCBkZWxldGUgKGFkbWluIGFueSwgYWdlbnQgb3duKS5cbmNvbnN0IHNvZnREZWxldGVQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcG9zdElkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUG9zdCh1c2VyLCBwb3N0SWQpO1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgYmxvZ1NlcnZpY2UgPSB7XG4gIGNyZWF0ZVBvc3QsXG4gIGdldFB1YmxpY1Bvc3RzLFxuICBnZXRQb3N0QnlTbHVnLFxuICBnZXRBbGxQb3N0cyxcbiAgZ2V0TXlQb3N0cyxcbiAgdXBkYXRlUG9zdCxcbiAgY2hhbmdlUG9zdFN0YXR1cyxcbiAgc29mdERlbGV0ZVBvc3QsXG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IHRpdGxlU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVGl0bGUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMywgXCJUaXRsZSBtdXN0IGJlIGF0IGxlYXN0IDMgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJUaXRsZSBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGV4Y2VycHRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFeGNlcnB0IGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEsIFwiRXhjZXJwdCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAubWF4KDUwMCwgXCJFeGNlcnB0IG11c3QgYmUgYXQgbW9zdCA1MDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY29udGVudFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbnRlbnQgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMSwgXCJDb250ZW50IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gIC5tYXgoMTAwMDAsIFwiQ29udGVudCBtdXN0IGJlIGF0IG1vc3QgMTAwMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY292ZXJJbWFnZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvdmVyIGltYWdlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnVybChcIkNvdmVyIGltYWdlIG11c3QgYmUgYSB2YWxpZCBVUkxcIik7XG5cbmNvbnN0IGNyZWF0ZVBvc3RTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYSxcbiAgICBleGNlcnB0OiBleGNlcnB0U2NoZW1hLFxuICAgIGNvbnRlbnQ6IGNvbnRlbnRTY2hlbWEsXG4gICAgY292ZXJJbWFnZTogY292ZXJJbWFnZVNjaGVtYSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVQb3N0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBleGNlcnB0OiBleGNlcnB0U2NoZW1hLm9wdGlvbmFsKCksXG4gICAgY29udGVudDogY29udGVudFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNvdmVySW1hZ2U6IGNvdmVySW1hZ2VTY2hlbWEub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IE9iamVjdC5rZXlzKGRhdGEpLmxlbmd0aCA+IDAsIHtcbiAgICBtZXNzYWdlOiBcIkF0IGxlYXN0IG9uZSBmaWVsZCBtdXN0IGJlIHByb3ZpZGVkIHRvIHVwZGF0ZVwiLFxuICB9KTtcblxuY29uc3QgcG9zdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUG9zdCBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBwb3N0U2x1Z1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc2x1Zzogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQb3N0IHNsdWcgaXMgcmVxdWlyZWRcIiB9KS50cmltKCkubWluKDEpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgc3RhdHVzOiB6LmVudW0oW1wiRFJBRlRcIiwgXCJQVUJMSVNIRURcIl0sIHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcIlN0YXR1cyBpcyByZXF1aXJlZFwiLFxuICAgICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlN0YXR1cyBtdXN0IGJlIERSQUZUIG9yIFBVQkxJU0hFRFwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHB1YmxpY1F1ZXJ5U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gICAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBzb3J0Qnk6IHouZW51bShbXCJuZXdlc3RcIiwgXCJvbGRlc3RcIiwgXCJ0aXRsZVwiXSkuZGVmYXVsdChcIm5ld2VzdFwiKSxcbiAgICBzb3J0T3JkZXI6IHouZW51bShbXCJhc2NcIiwgXCJkZXNjXCJdKS5vcHRpb25hbCgpLFxuICB9KTtcblxuY29uc3QgaW50ZXJuYWxRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHN0YXR1czogelxuICAgICAgLmVudW0oW1wiRFJBRlRcIiwgXCJQVUJMSVNIRURcIl0pXG4gICAgICAudHJhbnNmb3JtKCh2YWwpID0+IHZhbCBhcyBcIkRSQUZUXCIgfCBcIlBVQkxJU0hFRFwiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gIH0pO1xuXG5leHBvcnQgY29uc3QgYmxvZ1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVQb3N0U2NoZW1hLFxuICB1cGRhdGVQb3N0U2NoZW1hLFxuICBwb3N0UGFyYW1zU2NoZW1hLFxuICBwb3N0U2x1Z1BhcmFtc1NjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxuICBwdWJsaWNRdWVyeVNjaGVtYSxcbiAgaW50ZXJuYWxRdWVyeVNjaGVtYSxcbn07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGRhc2hib2FyZENvbnRyb2xsZXIgfSBmcm9tIFwiLi9kYXNoYm9hcmQuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgZGFzaGJvYXJkVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9kYXNoYm9hcmQudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQWRtaW4gZGFzaGJvYXJkIFx1MjAxNCBwbGF0Zm9ybS13aWRlIGFuYWx5dGljc1xucm91dGVyLmdldChcbiAgXCIvYWRtaW5cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGRhc2hib2FyZFZhbGlkYXRpb25zLmRhc2hib2FyZFF1ZXJ5U2NoZW1hIH0pLFxuICBkYXNoYm9hcmRDb250cm9sbGVyLmdldEFkbWluRGFzaGJvYXJkLFxuKTtcblxuLy8gMi4gQWdlbnQgZGFzaGJvYXJkIFx1MjAxNCBvd24gcGFja2FnZXMvYm9va2luZ3MvcmV2ZW51ZS9wZXJmb3JtYW5jZVxucm91dGVyLmdldChcbiAgXCIvYWdlbnRcIixcbiAgYXV0aChSb2xlLkFHRU5UKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGRhc2hib2FyZFZhbGlkYXRpb25zLmRhc2hib2FyZFF1ZXJ5U2NoZW1hIH0pLFxuICBkYXNoYm9hcmRDb250cm9sbGVyLmdldEFnZW50RGFzaGJvYXJkLFxuKTtcblxuLy8gMy4gVXNlciBkYXNoYm9hcmQgXHUyMDE0IG93biBib29raW5ncy91cGNvbWluZy9zcGVuZFxucm91dGVyLmdldChcbiAgXCIvdXNlclwiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBkYXNoYm9hcmRWYWxpZGF0aW9ucy5kYXNoYm9hcmRRdWVyeVNjaGVtYSB9KSxcbiAgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRVc2VyRGFzaGJvYXJkLFxuKTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGRhc2hib2FyZFNlcnZpY2UgfSBmcm9tIFwiLi9kYXNoYm9hcmQuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBjb250cm9sbGVyIChBRE1JTilcbmNvbnN0IGdldEFkbWluRGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRBZG1pbkRhc2hib2FyZChcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBjb250cm9sbGVyIChBR0VOVClcbmNvbnN0IGdldEFnZW50RGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRBZ2VudERhc2hib2FyZChcbiAgICAgIHVzZXJJZCxcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIGNvbnRyb2xsZXIgKFVTRVIpXG5jb25zdCBnZXRVc2VyRGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRVc2VyRGFzaGJvYXJkKFxuICAgICAgdXNlcklkLFxuICAgICAgTnVtYmVyKHJlcS5xdWVyeS5kYXlzKSxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRhc2hib2FyZCBkYXRhIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZENvbnRyb2xsZXIgPSB7XG4gIGdldEFkbWluRGFzaGJvYXJkLFxuICBnZXRBZ2VudERhc2hib2FyZCxcbiAgZ2V0VXNlckRhc2hib2FyZCxcbn07IiwgImltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cywgUGFja2FnZVN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHtcbiAgSUFnZW50RGFzaGJvYXJkLFxuICBJQWRtaW5EYXNoYm9hcmQsXG4gIElCb29raW5nc0J5U3RhdHVzLFxuICBJUmV2ZW51ZVBvaW50LFxuICBJVXNlckRhc2hib2FyZCxcbn0gZnJvbSBcIi4vZGFzaGJvYXJkLmludGVyZmFjZVwiO1xuXG4vLyBNb25leSBpcyBgRGVjaW1hbCgxMCwyKWAgaW4gdGhlIHNjaGVtYSAoQUdFTlRTLm1kKSBcdTIwMTQgbWFwIHRvIE51bWJlciBvbiByZXR1cm4uXG5jb25zdCB0b051bWJlciA9ICh2YWx1ZTogdW5rbm93bik6IG51bWJlciA9PiBOdW1iZXIodmFsdWUgPz8gMCk7XG5cbi8vIEJvb2tpbmctc3RhdHVzIGJyZWFrZG93biB2aWEgZ3JvdXBCeSArIF9jb3VudC4gT3B0aW9uYWwgc2NvcGUgbGltaXRzIGl0IHRvXG4vLyBhbiBhZ2VudCdzIG93biBub24tZGVsZXRlZCBwYWNrYWdlcyBvciBhIHNpbmdsZSB1c2VyJ3MgYm9va2luZ3MuXG5jb25zdCBnZXRCb29raW5nc0J5U3RhdHVzID0gYXN5bmMgKFxuICBzY29wZTogeyBhZ2VudElkPzogc3RyaW5nOyB1c2VySWQ/OiBzdHJpbmcgfSA9IHt9LFxuKTogUHJvbWlzZTxJQm9va2luZ3NCeVN0YXR1c1tdPiA9PiB7XG4gIGNvbnN0IGdyb3VwZWQgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5ncm91cEJ5KHtcbiAgICBieTogW1wic3RhdHVzXCJdLFxuICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgd2hlcmU6IHNjb3BlLmFnZW50SWRcbiAgICAgID8geyBwYWNrYWdlOiB7IGFnZW50SWQ6IHNjb3BlLmFnZW50SWQsIGlzRGVsZXRlZDogZmFsc2UgfSB9XG4gICAgICA6IHNjb3BlLnVzZXJJZFxuICAgICAgICA/IHsgdXNlcklkOiBzY29wZS51c2VySWQgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgfSk7XG5cbiAgcmV0dXJuIGdyb3VwZWRcbiAgICAubWFwKChnKSA9PiAoeyBzdGF0dXM6IGcuc3RhdHVzLCBjb3VudDogZy5fY291bnQuX2FsbCB9KSlcbiAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpO1xufTtcblxuLy8gUmV2ZW51ZSB0cmVuZDogb25lIHJvdyBwZXIgZGF5IGZvciB0aGUgbGFzdCBgZGF5c2AgZGF5cywgYnVja2V0aW5nIENPTVBMRVRFRFxuLy8gYm9va2luZ3MgYnkgdGhlaXIgYHVwZGF0ZWRBdGAgXHUyMDE0IHRoZSB0aW1lc3RhbXAgb2YgdGhlIHRyYW5zaXRpb24gaW50b1xuLy8gQ09NUExFVEVEIChhIHRlcm1pbmFsIHN0YXRlLCBzbyBpdCBpcyB0aGUgbGFzdCB3cml0ZSkuIGBjcmVhdGVkQXRgIGlzIHdoZW5cbi8vIHRoZSBib29raW5nIHdhcyBtYWRlIChQRU5ESU5HKSBhbmQgbmV2ZXIgbW92ZXMsIHdoaWNoIHdvdWxkIG1pcy1kYXRlIHJldmVudWVcbi8vIHdlZWtzIGxhdGVyLiBQb3N0Z3JlcyBnZW5lcmF0ZV9zZXJpZXMgZ3VhcmFudGVlcyBhIGRlbnNlIHNlcmllcyAoemVyby1maWxsZWRcbi8vIGRheXMpIFx1MjAxNCBiZXR0ZXIgYW5kIGZhc3RlciB0aGFuIGEgcGVyLWRheSBKUyBsb29wLiBPcHRpb25hbCBzY29wZTogYW4gYWdlbnQnc1xuLy8gb3duIG5vbi1kZWxldGVkIHBhY2thZ2VzLCBvciBhIHNpbmdsZSB1c2VyJ3Mgc3BlbmQuXG5jb25zdCBnZXRSZXZlbnVlT3ZlclRpbWUgPSBhc3luYyAoXG4gIGRheXM6IG51bWJlcixcbiAgc2NvcGU6IHsgYWdlbnRJZD86IHN0cmluZzsgdXNlcklkPzogc3RyaW5nIH0gPSB7fSxcbik6IFByb21pc2U8SVJldmVudWVQb2ludFtdPiA9PiB7XG4gIGNvbnN0IGFnZW50U2NvcGUgPSBzY29wZS5hZ2VudElkXG4gICAgPyBgQU5EIGIuXCJwYWNrYWdlSWRcIiBJTiAoXG4gICAgICAgICBTRUxFQ1QgcC5cImlkXCJcbiAgICAgICAgIEZST00gXCJ0b3VyX3BhY2thZ2VzXCIgcFxuICAgICAgICAgV0hFUkUgcC5cImFnZW50SWRcIiA9ICQyXG4gICAgICAgICAgIEFORCBwLlwiaXNEZWxldGVkXCIgPSBmYWxzZVxuICAgICAgIClgXG4gICAgOiBcIlwiO1xuICBjb25zdCB1c2VyU2NvcGUgPSBzY29wZS51c2VySWQgPyBgQU5EIGIuXCJ1c2VySWRcIiA9ICQyYCA6IFwiXCI7XG4gIGNvbnN0IHdoZXJlQ2xhdXNlID0gc2NvcGUuYWdlbnRJZCA/IGFnZW50U2NvcGUgOiB1c2VyU2NvcGU7XG5cbiAgY29uc3Qgcm93cyA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdVbnNhZmU8XG4gICAgeyBkYXRlOiBzdHJpbmc7IHJldmVudWU6IG51bWJlciB9W11cbiAgPihcbiAgICBgXG4gICAgU0VMRUNUIHRvX2NoYXIoZGF5cy5kLCAnWVlZWS1NTS1ERCcpIEFTIGRhdGUsXG4gICAgICAgICAgIENPQUxFU0NFKFNVTShiLlwidG90YWxQcmljZVwiKSwgMCk6OmZsb2F0OCBBUyByZXZlbnVlXG4gICAgRlJPTSBnZW5lcmF0ZV9zZXJpZXMoXG4gICAgICBDVVJSRU5UX0RBVEUgLSBtYWtlX2ludGVydmFsKGRheXMgPT4gJDE6OmludCAtIDEpLFxuICAgICAgQ1VSUkVOVF9EQVRFLFxuICAgICAgJzEgZGF5Jzo6aW50ZXJ2YWxcbiAgICApIEFTIGRheXMoZClcbiAgICBMRUZUIEpPSU4gXCJib29raW5nc1wiIGJcbiAgICAgIE9OIGRhdGVfdHJ1bmMoJ2RheScsIGIuXCJ1cGRhdGVkQXRcIik6OmRhdGUgPSBkYXlzLmRcbiAgICAgIEFORCBiLlwic3RhdHVzXCIgPSAnQ09NUExFVEVEJ1xuICAgICAgJHt3aGVyZUNsYXVzZX1cbiAgICBHUk9VUCBCWSBkYXlzLmRcbiAgICBPUkRFUiBCWSBkYXlzLmQgQVNDXG4gICAgYCxcbiAgICBkYXlzLFxuICAgIC4uLihzY29wZS5hZ2VudElkIHx8IHNjb3BlLnVzZXJJZCA/IFtzY29wZS5hZ2VudElkID8/IHNjb3BlLnVzZXJJZF0gOiBbXSksXG4gICk7XG5cbiAgcmV0dXJuIHJvd3M7XG59O1xuXG4vLyBQYWNrYWdlLWlkIHNjb3BlIGZvciBib29raW5nIHF1ZXJpZXMuIENhbGxlcnMgc2hvcnQtY2lyY3VpdCB0aGUgZW1wdHkgY2FzZVxuLy8gKGFuIGFnZW50IHdpdGggbm8gcGFja2FnZXMpLCBidXQgYW4gYGluOiBbXWAgZmFsbGJhY2sga2VlcHMgdGhlIHR5cGVcbi8vIG5vbi1udWxsYWJsZSB3aGlsZSBzdGlsbCBtYXRjaGluZyBub3RoaW5nIGlmIGl0IGV2ZXIgc2xpcHMgdGhyb3VnaC5cbmNvbnN0IHRvUGFja2FnZUlkU2NvcGUgPSAoXG4gIHBhY2thZ2VJZHM6IHN0cmluZ1tdLFxuKTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0+XG4gIHBhY2thZ2VJZHMubGVuZ3RoXG4gICAgPyB7IHBhY2thZ2VJZDogeyBpbjogcGFja2FnZUlkcyB9IH1cbiAgICA6IHsgcGFja2FnZUlkOiB7IGluOiBbXSB9IH07XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBcdTIwMTQgcGxhdGZvcm0td2lkZSBjb3VudHMsIGJyZWFrZG93bnMgYW5kIHJldmVudWUgdHJlbmQuXG5jb25zdCBnZXRBZG1pbkRhc2hib2FyZCA9IGFzeW5jIChkYXlzOiBudW1iZXIpOiBQcm9taXNlPElBZG1pbkRhc2hib2FyZD4gPT4ge1xuICBjb25zdCBbXG4gICAgdG90YWxVc2VycyxcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlLFxuICAgIHVzZXJzQnlSb2xlLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcGFja2FnZXNCeUNhdGVnb3J5LFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudXNlci5jb3VudCh7IHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0gfSksXG4gICAgcHJpc21hLmJvb2tpbmcuY291bnQoKSxcbiAgICBwcmlzbWEuYm9va2luZy5hZ2dyZWdhdGUoe1xuICAgICAgX3N1bTogeyB0b3RhbFByaWNlOiB0cnVlIH0sXG4gICAgICB3aGVyZTogeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVEIH0sXG4gICAgfSksXG4gICAgcHJpc21hLnVzZXIuZ3JvdXBCeSh7XG4gICAgICBieTogW1wicm9sZVwiXSxcbiAgICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgICB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgfSksXG4gICAgZ2V0Qm9va2luZ3NCeVN0YXR1cygpLFxuICAgIHByaXNtYS50b3VyUGFja2FnZVxuICAgICAgLmdyb3VwQnkoe1xuICAgICAgICBieTogW1wiY2F0ZWdvcnlJZFwiXSxcbiAgICAgICAgX2NvdW50OiB7IF9hbGw6IHRydWUgfSxcbiAgICAgICAgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgfSlcbiAgICAgIC50aGVuKGFzeW5jIChncm91cGVkKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhdGVnb3J5SWRzID0gZ3JvdXBlZC5tYXAoKGcpID0+IGcuY2F0ZWdvcnlJZCk7XG4gICAgICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZE1hbnkoe1xuICAgICAgICAgIHdoZXJlOiB7IGlkOiB7IGluOiBjYXRlZ29yeUlkcyB9IH0sXG4gICAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBuYW1lTWFwID0gbmV3IE1hcChjYXRlZ29yaWVzLm1hcCgoYykgPT4gW2MuaWQsIGMubmFtZV0pKTtcblxuICAgICAgICByZXR1cm4gZ3JvdXBlZFxuICAgICAgICAgIC5tYXAoKGcpID0+ICh7XG4gICAgICAgICAgICBjYXRlZ29yeTogbmFtZU1hcC5nZXQoZy5jYXRlZ29yeUlkKSA/PyBcIlVua25vd25cIixcbiAgICAgICAgICAgIGNvdW50OiBnLl9jb3VudC5fYWxsLFxuICAgICAgICAgIH0pKVxuICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLmNvdW50IC0gYS5jb3VudCk7XG4gICAgICB9KSxcbiAgICBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cyksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxVc2VycyxcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlOiB0b051bWJlcih0b3RhbFJldmVudWUuX3N1bS50b3RhbFByaWNlKSxcbiAgICB1c2Vyc0J5Um9sZTogdXNlcnNCeVJvbGVcbiAgICAgIC5tYXAoKGcpID0+ICh7IHJvbGU6IGcucm9sZSwgY291bnQ6IGcuX2NvdW50Ll9hbGwgfSkpXG4gICAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcGFja2FnZXNCeUNhdGVnb3J5LFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgfTtcbn07XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBcdTIwMTQgc2NvcGVkIHRvIHRoZSBhZ2VudCdzIG93biBwYWNrYWdlcy4gRmV0Y2hlcyBvd25lZFxuLy8gICAgcGFja2FnZSBpZHMgb25jZSwgdGhlbiBldmVyeSBhZ2dyZWdhdGUgcmV1c2VzIHRoYXQgc2NvcGUgc28gdGhlIHdob2xlXG4vLyAgICBidW5kbGUgaXMgb25lIFByb21pc2UuYWxsIChubyBwZXItaXRlbSBxdWVyaWVzKS5cbmNvbnN0IGdldEFnZW50RGFzaGJvYXJkID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgZGF5czogbnVtYmVyLFxuKTogUHJvbWlzZTxJQWdlbnREYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW293bmVkUGFja2FnZXMsIGJvb2tpbmdzQnlTdGF0dXMsIGF2ZXJhZ2VSYXRpbmddID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZTogeyBhZ2VudElkOiB1c2VySWQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pLFxuICAgIGdldEJvb2tpbmdzQnlTdGF0dXMoeyBhZ2VudElkOiB1c2VySWQgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmFnZ3JlZ2F0ZSh7XG4gICAgICBfYXZnOiB7IHJhdGluZzogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHtcbiAgICAgICAgYWdlbnRJZDogdXNlcklkLFxuICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgIH0pLFxuICBdKTtcblxuICBjb25zdCBwYWNrYWdlSWRzID0gb3duZWRQYWNrYWdlcy5tYXAoKHApID0+IHAuaWQpO1xuXG4gIC8vIEFuIGFnZW50IHdpdGggbm8gcGFja2FnZXMgbXVzdCBzZWUgemVyb3MgXHUyMDE0IHNjb3BlIGlzIHVuZGVmaW5lZCBmb3IgYW4gZW1wdHlcbiAgLy8gbGlzdCwgYW5kIGEgYmFyZSBgd2hlcmU6IHVuZGVmaW5lZGAgLyBgQU5EOiBbe31dYCB3b3VsZCBvdGhlcndpc2UgbWF0Y2ggdGhlXG4gIC8vIHdob2xlIHBsYXRmb3JtIChjcm9zcy1hZ2VudCBkYXRhIGxlYWspLiBTaG9ydC1jaXJjdWl0IGhlcmUgaW5zdGVhZC5cbiAgaWYgKHBhY2thZ2VJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRvdGFsUGFja2FnZXM6IDAsXG4gICAgICB0b3RhbEJvb2tpbmdzOiAwLFxuICAgICAgdG90YWxSZXZlbnVlOiAwLFxuICAgICAgYXZlcmFnZVJhdGluZzogTWF0aC5yb3VuZCgoYXZlcmFnZVJhdGluZy5fYXZnLnJhdGluZyA/PyAwKSAqIDEwKSAvIDEwLFxuICAgICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICAgIHJldmVudWVPdmVyVGltZTogYXdhaXQgZ2V0UmV2ZW51ZU92ZXJUaW1lKGRheXMsIHsgYWdlbnRJZDogdXNlcklkIH0pLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBzY29wZSA9IHRvUGFja2FnZUlkU2NvcGUocGFja2FnZUlkcyk7XG5cbiAgY29uc3QgW3RvdGFsUGFja2FnZXMsIHRvdGFsQm9va2luZ3MsIHRvdGFsUmV2ZW51ZSwgcmV2ZW51ZU92ZXJUaW1lXSA9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgcGFja2FnZUlkcy5sZW5ndGgsXG4gICAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlOiBzY29wZSB9KSxcbiAgICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIEFORDogW3Njb3BlLCB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfV0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIGdldFJldmVudWVPdmVyVGltZShkYXlzLCB7IGFnZW50SWQ6IHVzZXJJZCB9KSxcbiAgICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsUGFja2FnZXMsXG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFJldmVudWU6IHRvTnVtYmVyKHRvdGFsUmV2ZW51ZS5fc3VtLnRvdGFsUHJpY2UpLFxuICAgIGF2ZXJhZ2VSYXRpbmc6IE1hdGgucm91bmQoKGF2ZXJhZ2VSYXRpbmcuX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMCxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgfTtcbn07XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIFx1MjAxNCB0aGUgdXNlcidzIGJvb2tpbmdzLCBzcGVuZCwgYW5kIHVwY29taW5nIHRyaXBzLlxuY29uc3QgZ2V0VXNlckRhc2hib2FyZCA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIGRheXMgPSAzMCxcbik6IFByb21pc2U8SVVzZXJEYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW3RvdGFsQm9va2luZ3MsIHRvdGFsU3BlbmQsIHVwY29taW5nLCBib29raW5nc0J5U3RhdHVzLCByZXZlbnVlT3ZlclRpbWVdID1cbiAgICBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlOiB7IHVzZXJJZCB9IH0pLFxuICAgICAgcHJpc21hLmJvb2tpbmcuYWdncmVnYXRlKHtcbiAgICAgICAgX3N1bTogeyB0b3RhbFByaWNlOiB0cnVlIH0sXG4gICAgICAgIHdoZXJlOiB7IHVzZXJJZCwgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCB9LFxuICAgICAgfSksXG4gICAgICBwcmlzbWEuYm9va2luZy5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgdXNlcklkLFxuICAgICAgICAgIHN0YXR1czoge1xuICAgICAgICAgICAgaW46IFtCb29raW5nU3RhdHVzLlBFTkRJTkcsIEJvb2tpbmdTdGF0dXMuUEFJRCwgQm9va2luZ1N0YXR1cy5DT05GSVJNRURdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJhdmVsRGF0ZTogeyBndDogbmV3IERhdGUoKSB9LFxuICAgICAgICB9LFxuICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgICB0cmF2ZWxEYXRlOiB0cnVlLFxuICAgICAgICAgIHRyYXZlbGVyczogdHJ1ZSxcbiAgICAgICAgICB0b3RhbFByaWNlOiB0cnVlLFxuICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICBwYWNrYWdlOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgdGl0bGU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICAgICAgICB9LFxuICAgICAgICBvcmRlckJ5OiB7IHRyYXZlbERhdGU6IFwiYXNjXCIgfSxcbiAgICAgICAgdGFrZTogNSxcbiAgICAgIH0pLFxuICAgICAgZ2V0Qm9va2luZ3NCeVN0YXR1cyh7IHVzZXJJZCB9KSxcbiAgICAgIGdldFJldmVudWVPdmVyVGltZShkYXlzLCB7IHVzZXJJZCB9KSxcbiAgICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxTcGVuZDogdG9OdW1iZXIodG90YWxTcGVuZC5fc3VtLnRvdGFsUHJpY2UpLFxuICAgIHVwY29taW5nQ291bnQ6IHVwY29taW5nLmxlbmd0aCxcbiAgICB1cGNvbWluZzogdXBjb21pbmcubWFwKChiKSA9PiAoe1xuICAgICAgLi4uYixcbiAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihiLnRvdGFsUHJpY2UpLFxuICAgIH0pKSxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHJldmVudWVPdmVyVGltZSxcbiAgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRTZXJ2aWNlID0ge1xuICBnZXRBZG1pbkRhc2hib2FyZCxcbiAgZ2V0QWdlbnREYXNoYm9hcmQsXG4gIGdldFVzZXJEYXNoYm9hcmQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBkYXNoYm9hcmRRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZGF5czogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCgzNjUpLmRlZmF1bHQoMzApLFxufSk7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRWYWxpZGF0aW9ucyA9IHtcbiAgZGFzaGJvYXJkUXVlcnlTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgcGF5bWVudENvbnRyb2xsZXIgfSBmcm9tIFwiLi9wYXltZW50LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHBheW1lbnRWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3BheW1lbnQudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gT3BlbiBhIGdhdGV3YXkgc2Vzc2lvbiBmb3IgdGhlIHVzZXIncyBwZW5kaW5nIGJvb2tpbmcgKFVTRVIgb25seSkuXG5yb3V0ZXIucG9zdChcbiAgXCIvY3JlYXRlXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcGF5bWVudFZhbGlkYXRpb25zLmNyZWF0ZVNjaGVtYSB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuY3JlYXRlUGF5bWVudCxcbik7XG5cbi8vIFB1YmxpYyBcdTIwMTQgU1NMQ29tbWVyeiBQT1NUcyB0aGUgb3V0Y29tZSBoZXJlIChzdWNjZXNzL2ZhaWwvY2FuY2VsKSBhbmQgd2Vcbi8vIHJlZGlyZWN0IHRoZSBicm93c2VyIHRvIHRoZSBmcm9udGVuZCByZXN1bHQgcGFnZS5cbnJvdXRlci5wb3N0KFxuICBcIi9jb25maXJtXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcXVlcnk6IHBheW1lbnRWYWxpZGF0aW9ucy5jYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICAgIGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5nYXRld2F5UmVzdWx0U2NoZW1hLFxuICB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuY29uZmlybVBheW1lbnQsXG4pO1xuXG4vLyBQdWJsaWMgXHUyMDE0IFNTTENvbW1lcnogaW5zdGFudCBwYXltZW50IG5vdGlmaWNhdGlvbjsgc2FtZSBpZGVtcG90ZW50IHNldHRsZS5cbnJvdXRlci5wb3N0KFxuICBcIi9pcG5cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBxdWVyeTogcGF5bWVudFZhbGlkYXRpb25zLmNhbGxiYWNrUXVlcnlTY2hlbWEsXG4gICAgYm9keTogcGF5bWVudFZhbGlkYXRpb25zLmdhdGV3YXlSZXN1bHRTY2hlbWEsXG4gIH0pLFxuICBwYXltZW50Q29udHJvbGxlci5pcG4sXG4pO1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5pbXBvcnQgeyBJR2F0ZXdheVJlc3VsdCB9IGZyb20gXCIuL3BheW1lbnQuaW50ZXJmYWNlXCI7XG5pbXBvcnQgeyBwYXltZW50U2VydmljZSB9IGZyb20gXCIuL3BheW1lbnQuc2VydmljZVwiO1xuXG5jb25zdCBjcmVhdGVQYXltZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBwYXltZW50U2VydmljZS5jcmVhdGVQYXltZW50U2Vzc2lvbih1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlBheW1lbnQgc2Vzc2lvbiBjcmVhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHNlc3Npb24sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBQdWJsaWMgY2FsbGJhY2sgdGFyZ2V0IFx1MjAxNCBTU0xDb21tZXJ6IFBPU1RzIGhlcmUgKHNlcnZlci10by1zZXJ2ZXIpIGFmdGVyIHRoZVxuLy8gc2hvcHBlciBmaW5pc2hlcyBhdCB0aGUgZ2F0ZXdheS4gV2Ugc2V0dGxlIHRoZSBwYXltZW50LCB0aGVuIGJvdW5jZSB0aGVcbi8vIGJyb3dzZXIgdG8gdGhlIGZyb250ZW5kIHJlc3VsdCBwYWdlLlxuY29uc3QgY29uZmlybVBheW1lbnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBib29raW5nSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LmJvb2tpbmdJZCk7XG4gICAgY29uc3QgdHJhbklkID0gU3RyaW5nKHJlcS5xdWVyeS50cmFuSWQpO1xuICAgIGNvbnN0IHN0YXR1cyA9IFN0cmluZyhyZXEucXVlcnkuc3RhdHVzID8/IFwiZmFpbFwiKTtcblxuICAgIGF3YWl0IHBheW1lbnRTZXJ2aWNlLnByb2Nlc3NHYXRld2F5UmVzdWx0KFxuICAgICAgYm9va2luZ0lkLFxuICAgICAgdHJhbklkLFxuICAgICAgcmVxLmJvZHkgYXMgSUdhdGV3YXlSZXN1bHQsXG4gICAgKTtcblxuICAgIGNvbnN0IHJlZGlyZWN0QmFzZSA9XG4gICAgICBjb25maWcubm9kZV9lbnYgPT09IFwicHJvZHVjdGlvblwiXG4gICAgICAgID8gY29uZmlnLmZyb250ZW5kX3VybF9wcm9kXG4gICAgICAgIDogY29uZmlnLmZyb250ZW5kX3VybF9kZXY7XG4gICAgY29uc3QgcGFnZSA9IFtcInN1Y2Nlc3NcIiwgXCJmYWlsXCIsIFwiY2FuY2VsXCJdLmluY2x1ZGVzKHN0YXR1cykgPyBzdGF0dXMgOiBcImZhaWxcIjtcblxuICAgIHJlcy5yZWRpcmVjdCgzMDIsIGAke3JlZGlyZWN0QmFzZX0vcGF5bWVudC8ke3BhZ2V9P2Jvb2tpbmdJZD0ke2Jvb2tpbmdJZH1gKTtcbiAgfSxcbik7XG5cbi8vIFB1YmxpYyBJUE4gdGFyZ2V0IFx1MjAxNCB0aGUgZ2F0ZXdheSBub3RpZmllcyB1cyBoZXJlIGluZGVwZW5kZW50bHkgb2YgdGhlXG4vLyByZWRpcmVjdC4gU2FtZSBpZGVtcG90ZW50IHNldHRsZTsgYWx3YXlzIGFuc3dlcnMgMjAwIHNvIHRoZSBnYXRld2F5IHN0b3BzIHJldHJ5aW5nLlxuY29uc3QgaXBuID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgYm9va2luZ0lkID0gU3RyaW5nKHJlcS5xdWVyeS5ib29raW5nSWQpO1xuICAgIGNvbnN0IHRyYW5JZCA9IFN0cmluZyhyZXEucXVlcnkudHJhbklkKTtcblxuICAgIGF3YWl0IHBheW1lbnRTZXJ2aWNlLnByb2Nlc3NHYXRld2F5UmVzdWx0KFxuICAgICAgYm9va2luZ0lkLFxuICAgICAgdHJhbklkLFxuICAgICAgcmVxLmJvZHkgYXMgSUdhdGV3YXlSZXN1bHQsXG4gICAgKTtcblxuICAgIHJlcy5zdGF0dXMoMjAwKS50eXBlKFwidGV4dC9wbGFpblwiKS5zZW5kKFwiT0tcIik7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcGF5bWVudENvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBheW1lbnQsXG4gIGNvbmZpcm1QYXltZW50LFxuICBpcG4sXG59OyIsICJpbXBvcnQgeyBCb29raW5nU3RhdHVzLCBQYXltZW50U3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IFNzbGNvbW1lcnpJbml0UmVzdWx0LCBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCwgZ2VuZXJhdGVUcmFuSWQsIHNzbGNvbW1lcnpJbml0LCBzc2xjb21tZXJ6VmFsaWRhdGUgfSBmcm9tIFwiLi4vLi4vbGliL3NzbGNvbW1lcnpcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzZW5kQm9va2luZ0VtYWlsIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQgeyBJR2F0ZXdheVJlc3VsdCwgSVBheW1lbnRDcmVhdGVSZXF1ZXN0LCBJUGF5bWVudEdhdGV3YXlPdXRjb21lIH0gZnJvbSBcIi4vcGF5bWVudC5pbnRlcmZhY2VcIjtcblxuLy8gVGhlIGdhdGV3YXkgUE9TVHMgdG8gdGhlc2UgVVJMcyBzZXJ2ZXItdG8tc2VydmVyLCBzbyB0aGUgaG9zdCBtdXN0IGJlXG4vLyBwdWJsaWNseSByZWFjaGFibGUgXHUyMDE0IGNvbmZpZy5iYWNrZW5kX3B1YmxpY191cmwsIG5ldmVyIGxvY2FsaG9zdCBpbiBzYW5kYm94LlxuY29uc3QgYnVpbGRDYWxsYmFja1VybCA9IChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIHRyYW5JZDogc3RyaW5nLFxuICBraW5kOiBcInN1Y2Nlc3NcIiB8IFwiZmFpbFwiIHwgXCJjYW5jZWxcIiB8IFwiaXBuXCIsXG4pID0+XG4gIGAke2NvbmZpZy5iYWNrZW5kX3B1YmxpY191cmx9L2FwaS9wYXltZW50cy8ke2tpbmQgPT09IFwiaXBuXCIgPyBcImlwblwiIDogXCJjb25maXJtXCJ9P2Jvb2tpbmdJZD0ke2Jvb2tpbmdJZH0mdHJhbklkPSR7dHJhbklkfSR7XG4gICAga2luZCA9PT0gXCJpcG5cIiA/IFwiXCIgOiBgJnN0YXR1cz0ke2tpbmR9YFxuICB9YDtcblxuLy8gT3BlbnMgYW4gU1NMQ29tbWVyeiBzZXNzaW9uIGZvciBhIHBlbmRpbmcgYm9va2luZyB0aGUgdXNlciBvd25zLiBUaGUgYm9va2luZ1xuLy8gYW1vdW50IGlzIGZyb3plbiBhdCBpbml0aWF0aW9uOyBpdCBuZXZlciByZS1yZWFkcyB0aGUgcGFja2FnZSBwcmljZS5cbmNvbnN0IGNyZWF0ZVBheW1lbnRTZXNzaW9uID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVBheW1lbnRDcmVhdGVSZXF1ZXN0LFxuKTogUHJvbWlzZTx7IHBheW1lbnRJZDogc3RyaW5nOyB0cmFuSWQ6IHN0cmluZzsgcGF5bWVudFVybDogc3RyaW5nIHwgbnVsbCB9PiA9PiB7XG4gIGNvbnN0IHsgYm9va2luZ0lkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogYm9va2luZ0lkIH0sXG4gICAgaW5jbHVkZTogeyBwYWNrYWdlOiB7IHNlbGVjdDogeyB0aXRsZTogdHJ1ZSB9IH0gfSxcbiAgfSk7XG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG4gIGlmIChib29raW5nLnVzZXJJZCAhPT0gdXNlcklkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBheSBmb3IgdGhpcyBib29raW5nLlwiKTtcbiAgfVxuICBpZiAoYm9va2luZy5zdGF0dXMgPT09IEJvb2tpbmdTdGF0dXMuUEFJRCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiVGhpcyBib29raW5nIGlzIGFscmVhZHkgcGFpZC5cIik7XG4gIH1cbiAgaWYgKGJvb2tpbmcuc3RhdHVzICE9PSBCb29raW5nU3RhdHVzLlBFTkRJTkcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBgQ2Fubm90IHBheSBmb3IgYSBib29raW5nIGluICR7Ym9va2luZy5zdGF0dXMudG9Mb3dlckNhc2UoKX0gc3RhdHVzLmAsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlLCBwaG9uZTogdHJ1ZSB9LFxuICB9KTtcbiAgaWYgKCF1c2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBjb25zdCBhbW91bnQgPSBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKTtcbiAgY29uc3QgdHJhbklkID0gZ2VuZXJhdGVUcmFuSWQoKTtcblxuICAvLyBPbmUgbGl2ZSBzZXNzaW9uIHBlciBib29raW5nOiB0aGUgbGVkZ2VyIHJvdyBpcyBjcmVhdGVkIGF0b21pY2FsbHkgd2hpbGVcbiAgLy8gc3VwZXJzZWRpbmcgYW55IGFiYW5kb25lZCBzZXNzaW9uLCB0aGVuIHRoZSBnYXRld2F5IGlzIGFza2VkLiBUaGUgcm93XG4gIC8vIHN1cnZpdmVzIHJlZ2FyZGxlc3Mgb2YgdGhlIGdhdGV3YXkgcmVzcG9uc2UgXHUyMDE0IGluaXQgZmFpbHVyZSBmbGlwcyBpdCB0b1xuICAvLyBGQUlMRUQgYmVsb3cgc28gYSB0cnV0aGZ1bCBlbnRyeSBhbHdheXMgZXhpc3RzLlxuICBjb25zdCBwYXltZW50ID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgYm9va2luZ0lkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB0eC5wYXltZW50LmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIGJvb2tpbmdJZCxcbiAgICAgICAgdHJhbklkLFxuICAgICAgICBhbW91bnQsXG4gICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQsXG4gICAgICB9LFxuICAgIH0pO1xuICB9KTtcblxuICBsZXQgaW5pdDogU3NsY29tbWVyekluaXRSZXN1bHQ7XG4gIHRyeSB7XG4gICAgaW5pdCA9IGF3YWl0IHNzbGNvbW1lcnpJbml0KHtcbiAgICAgIHRvdGFsX2Ftb3VudDogYW1vdW50LFxuICAgICAgdHJhbl9pZDogdHJhbklkLFxuICAgICAgc3VjY2Vzc191cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwic3VjY2Vzc1wiKSxcbiAgICAgIGZhaWxfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImZhaWxcIiksXG4gICAgICBjYW5jZWxfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImNhbmNlbFwiKSxcbiAgICAgIGlwbl91cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwiaXBuXCIpLFxuICAgICAgY3VzX25hbWU6IHVzZXIubmFtZSxcbiAgICAgIGN1c19lbWFpbDogdXNlci5lbWFpbCxcbiAgICAgIGN1c19waG9uZTogdXNlci5waG9uZSA/PyBcIjAxNzExMTExMTExXCIsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgLy8ga2VlcCB0aGUgbGVkZ2VyIHRydXRoZnVsIFx1MjAxNCB0aGUgc2Vzc2lvbiBuZXZlciByZWFjaGVkIHRoZSBnYXRld2F5LiBUaGVcbiAgICAvLyBzdGF0dXMgZ3VhcmQgbWFrZXMgYSBjb25jdXJyZW50IC9jcmVhdGUgdGhhdCBhbHJlYWR5IGNhbmNlbGxlZCB0aGlzIHJvd1xuICAgIC8vIHdpbiB0aGUgcmFjZSAodGhhdCByb3cgc3RheXMgY2FuY2VsbGVkLCB0aGlzIG9uZSBmYWlscyBvbmx5IGlmIGxpdmUpLlxuICAgIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgLy8gc3RvcmUgdGhlIGdhdGV3YXkgVVJMcyBvbmx5IGlmIHRoZSByb3cgaXMgc3RpbGwgdGhlIGxpdmUgc2Vzc2lvbi5cbiAgYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICBkYXRhOiB7IGdhdGV3YXlQYWdlVXJsOiBpbml0LkdhdGV3YXlQYWdlVVJMLCBzc2xTZXNzaW9uS2V5OiBpbml0LnNlc3Npb25rZXkgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXltZW50SWQ6IHBheW1lbnQuaWQsXG4gICAgdHJhbklkOiBwYXltZW50LnRyYW5JZCxcbiAgICBwYXltZW50VXJsOiBpbml0LkdhdGV3YXlQYWdlVVJMID8/IG51bGwsXG4gIH07XG59O1xuXG4vLyBTZXJ2ZXItc2lkZSB2ZXJpZmljYXRpb24gb2YgYSBjb21wbGV0ZWQgdHJhbnNhY3Rpb246IHRoZSB2YWxpZGF0b3IgcmV0dXJuc1xuLy8gVkFMSUQgKGZpcnN0IGNoZWNrKSBvciBWQUxJREFURUQgKGFscmVhZHkgdmVyaWZpZWQgYmVmb3JlKSB3aXRoIHRoZSBhbW91bnQuXG4vLyBBbnl0aGluZyBlbHNlIFx1MjAxNCBvciBhIG1pc21hdGNoZWQgYW1vdW50IFx1MjAxNCBmYWlscyB0aGUgcGF5bWVudC5cbmNvbnN0IHZlcmlmeVN1Y2Nlc3MgPSBhc3luYyAoXG4gIHZhbElkOiBzdHJpbmcsXG4gIGV4cGVjdGVkQW1vdW50OiBudW1iZXIsXG4pOiBQcm9taXNlPHsgdmVyaWZpZWQ6IFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHwgbnVsbDsgbWF0Y2hlc0Ftb3VudDogYm9vbGVhbiB9PiA9PiB7XG4gIGxldCB2ZXJpZmllZDogU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQgfCBudWxsID0gbnVsbDtcbiAgdHJ5IHtcbiAgICB2ZXJpZmllZCA9IGF3YWl0IHNzbGNvbW1lcnpWYWxpZGF0ZSh7IHZhbF9pZDogdmFsSWQgfSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIHZhbGlkYXRvciB1bnJlYWNoYWJsZSBcdTIwMTQgZmFpbCB0aGUgcGF5bWVudCByYXRoZXIgdGhhbiBjcmFzaCB0aGUgY2FsbGJhY2tcbiAgICByZXR1cm4geyB2ZXJpZmllZDogbnVsbCwgbWF0Y2hlc0Ftb3VudDogZmFsc2UgfTtcbiAgfVxuXG4gIGNvbnN0IHZhbGlkU3RhdHVzID1cbiAgICB2ZXJpZmllZC5zdGF0dXMgPT09IFwiVkFMSURcIiB8fCB2ZXJpZmllZC5zdGF0dXMgPT09IFwiVkFMSURBVEVEXCI7XG4gIGNvbnN0IG1hdGNoZXNBbW91bnQgPVxuICAgIHZlcmlmaWVkLmFtb3VudCAhPT0gdW5kZWZpbmVkICYmIE51bWJlcih2ZXJpZmllZC5hbW91bnQpID09PSBleHBlY3RlZEFtb3VudDtcblxuICByZXR1cm4geyB2ZXJpZmllZCwgbWF0Y2hlc0Ftb3VudDogdmFsaWRTdGF0dXMgJiYgbWF0Y2hlc0Ftb3VudCB9O1xufTtcblxuLy8gU2hhcmVkIGJ5IHRoZSBjb25maXJtIChzdWNjZXNzL2ZhaWwvY2FuY2VsKSBhbmQgSVBOIGVuZHBvaW50cy4gSWRlbXBvdGVudDogYVxuLy8gc2V0dGxlZCBwYXltZW50IHNob3J0LWNpcmN1aXRzLCBzbyB0aGUgZG91YmxlLWZpcmluZyBJUE4gbmV2ZXIgZG91YmxlLWNoYXJnZXMuXG5jb25zdCBwcm9jZXNzR2F0ZXdheVJlc3VsdCA9IGFzeW5jIChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIHRyYW5JZDogc3RyaW5nLFxuICByZXN1bHQ6IElHYXRld2F5UmVzdWx0LFxuKTogUHJvbWlzZTxJUGF5bWVudEdhdGV3YXlPdXRjb21lPiA9PiB7XG4gIGNvbnN0IHBheW1lbnQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyB0cmFuSWQgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBib29raW5nOiB7XG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICB1c2VyOiB7IHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0sXG4gICAgICAgICAgcGFja2FnZTogeyBzZWxlY3Q6IHsgdGl0bGU6IHRydWUgfSB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIXBheW1lbnQgfHwgcGF5bWVudC5ib29raW5nSWQgIT09IGJvb2tpbmdJZCkge1xuICAgIC8vIEEgY2FsbGJhY2sgZm9yIGEgc2Vzc2lvbiB3ZSBuZXZlciBjcmVhdGVkIFx1MjAxNCBub3RoaW5nIHRvIHNldHRsZS5cbiAgICByZXR1cm4geyBwYXltZW50U3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCwgYm9va2luZ1N0YXR1czogbnVsbCwgY2hhbmdlZDogZmFsc2UgfTtcbiAgfVxuXG4gIGlmIChwYXltZW50LnN0YXR1cyA9PT0gUGF5bWVudFN0YXR1cy5TVUNDRVNTKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiBmYWxzZSxcbiAgICB9O1xuICB9XG5cbiAgLy8gQ2FuY2VsIGNhbGxiYWNrIFx1MjAxNCB0aGUgc2hvcHBlciBhYmFuZG9uZWQgY2hlY2tvdXQsIG5vIGNoYXJnZSB3YXMgbWFkZS5cbiAgaWYgKHJlc3VsdC5mYWlsX3N0YXR1cyA9PT0gXCJDQU5DRUxMRURcIiB8fCByZXN1bHQuc3RhdHVzID09PSBcIkNBTkNFTExFRFwiKSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IHVwZGF0ZWQuc3RhdHVzLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IHVwZGF0ZWQuc3RhdHVzICE9PSBwYXltZW50LnN0YXR1cyxcbiAgICB9O1xuICB9XG5cbiAgLy8gTm8gdmFsX2lkIG1lYW5zIHRoZSBnYXRld2F5IHJlcG9ydGVkIGEgZmFpbHVyZSAoZmFpbF91cmwpIFx1MjAxNCBub3RoaW5nIHRvIHZlcmlmeS5cbiAgaWYgKCFyZXN1bHQudmFsX2lkKSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuRkFJTEVEIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IHVwZGF0ZWQuc3RhdHVzLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IHVwZGF0ZWQuc3RhdHVzICE9PSBwYXltZW50LnN0YXR1cyxcbiAgICB9O1xuICB9XG5cbiAgLy8gU3VjY2VzcyBwYXRoOiB2ZXJpZnkgc2VydmVyLXNpZGUgYW5kIG9ubHkgdGhlbiBtYXJrIHRoZSBib29raW5nIGFzIHBhaWQuXG4gIGNvbnN0IHsgdmVyaWZpZWQsIG1hdGNoZXNBbW91bnQgfSA9IGF3YWl0IHZlcmlmeVN1Y2Nlc3MoXG4gICAgcmVzdWx0LnZhbF9pZCxcbiAgICBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICApO1xuXG4gIGlmICghbWF0Y2hlc0Ftb3VudCkge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB0cnVlLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBzZXR0bGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgdHgucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsXG4gICAgICAgIHZhbElkOiByZXN1bHQudmFsX2lkLFxuICAgICAgICBjYXJkVHlwZTogcmVzdWx0LmNhcmRfdHlwZSA/PyB2ZXJpZmllZD8uY2FyZF90eXBlLFxuICAgICAgICBiYW5rVHJhbklkOiByZXN1bHQuYmFua190cmFuX2lkID8/IHZlcmlmaWVkPy5iYW5rX3RyYW5faWQsXG4gICAgICAgIHBhaWRBdDogbmV3IERhdGUoKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBjb21wYXJlLWFuZC1zZXQ6IG9ubHkgYSBzdGlsbC1QRU5ESU5HIGJvb2tpbmcgYmVjb21lcyBQQUlEOyBhIGJvb2tpbmcgdGhhdFxuICAgIC8vIHdhcyBjb25jdXJyZW50bHkgY29uZmlybWVkIG9yIGNhbmNlbGxlZCBrZWVwcyBpdHMgc3RhdGUsIHRoZSBtb25leSBzdGF5cyBvbi5cbiAgICBhd2FpdCB0eC5ib29raW5nLnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCwgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBFTkRJTkcgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBBSUQgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB1cGRhdGVkO1xuICB9KTtcblxuICBjb25zdCBib29raW5nQWZ0ZXIgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCB9IH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IFwicGF5bWVudCByZWNlaXZlZFwiIGVtYWlsIFx1MjAxNCBuZXZlciBmYWlscyB0aGUgY2FsbGJhY2tcbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgZW1haWw6IHBheW1lbnQuYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgbmFtZTogcGF5bWVudC5ib29raW5nLnVzZXIubmFtZSxcbiAgICAgIHBhY2thZ2VUaXRsZTogcGF5bWVudC5ib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICB0cmF2ZWxEYXRlOiBwYXltZW50LmJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICAgIHRyYXZlbGVyczogcGF5bWVudC5ib29raW5nLnRyYXZlbGVycyxcbiAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihwYXltZW50LmFtb3VudCksXG4gICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEFJRCxcbiAgICB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXltZW50U3RhdHVzOiBzZXR0bGVkLnN0YXR1cyxcbiAgICBib29raW5nU3RhdHVzOiBib29raW5nQWZ0ZXI/LnN0YXR1cyA/PyBudWxsLFxuICAgIGNoYW5nZWQ6IHRydWUsXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFNlcnZpY2UgPSB7XG4gIGNyZWF0ZVBheW1lbnRTZXNzaW9uLFxuICBwcm9jZXNzR2F0ZXdheVJlc3VsdCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgYm9va2luZ0lkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkJvb2tpbmcgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC51dWlkKFwiQm9va2luZyBpZCBtdXN0IGJlIGEgdmFsaWQgdXVpZFwiKSxcbn0pO1xuXG5jb25zdCBjYWxsYmFja1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBib29raW5nSWQ6IHouc3RyaW5nKCkudXVpZChcIkJvb2tpbmcgaWQgbXVzdCBiZSBhIHZhbGlkIHV1aWRcIiksXG4gIHRyYW5JZDogei5zdHJpbmcoKS5taW4oMSksXG4gIHN0YXR1czogei5lbnVtKFtcInN1Y2Nlc3NcIiwgXCJmYWlsXCIsIFwiY2FuY2VsXCJdKS5vcHRpb25hbCgpLFxufSk7XG5cbi8vIEJvZHkgb2YgdGhlIGdhdGV3YXkgUE9TVCBcdTIwMTQgb25seSBmaWVsZHMgd2UgY29uc3VtZSwgYWxsIG9wdGlvbmFsIGJlY2F1c2UgdGhlXG4vLyBzaGFwZSBkaWZmZXJzIGJldHdlZW4gc3VjY2VzcyAvIGZhaWwgLyBjYW5jZWwgLyBJUE4gY2FsbGJhY2tzLlxuY29uc3QgZ2F0ZXdheVJlc3VsdFNjaGVtYSA9IHoub2JqZWN0KHtcbiAgdmFsX2lkOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHN0YXR1czogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBmYWlsX3N0YXR1czogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBjYXJkX3R5cGU6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgYmFua190cmFuX2lkOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGN1cnJlbmN5OiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGFtb3VudDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRDcmVhdGVQYXltZW50U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY3JlYXRlU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRDYWxsYmFja1F1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY2FsbGJhY2tRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUR2F0ZXdheVJlc3VsdFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGdhdGV3YXlSZXN1bHRTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVTY2hlbWEsXG4gIGNhbGxiYWNrUXVlcnlTY2hlbWEsXG4gIGdhdGV3YXlSZXN1bHRTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgd2lzaGxpc3RDb250cm9sbGVyIH0gZnJvbSBcIi4vd2lzaGxpc3QuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgd2lzaGxpc3RWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3dpc2hsaXN0LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIFNhdmUgYSBwYWNrYWdlIHRvIHRoZSB3aXNobGlzdCAoVVNFUiBvbmx5KVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHdpc2hsaXN0VmFsaWRhdGlvbnMuY3JlYXRlV2lzaGxpc3RTY2hlbWEgfSksXG4gIHdpc2hsaXN0Q29udHJvbGxlci5hZGRUb1dpc2hsaXN0LFxuKTtcblxuLy8gMi4gTXkgd2lzaGxpc3QgKFVTRVIgb25seSkgXHUyMDE0IHBhZ2luYXRlZCwgbmV3ZXN0IGZpcnN0XG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogd2lzaGxpc3RWYWxpZGF0aW9ucy53aXNobGlzdFF1ZXJ5U2NoZW1hIH0pLFxuICB3aXNobGlzdENvbnRyb2xsZXIuZ2V0TXlXaXNobGlzdCxcbik7XG5cbi8vIDMuIFJlbW92ZSBhIHBhY2thZ2UgZnJvbSB0aGUgd2lzaGxpc3QgKFVTRVIgb25seSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzpwYWNrYWdlSWRcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHdpc2hsaXN0VmFsaWRhdGlvbnMud2lzaGxpc3RQYXJhbXNTY2hlbWEgfSksXG4gIHdpc2hsaXN0Q29udHJvbGxlci5yZW1vdmVGcm9tV2lzaGxpc3QsXG4pO1xuXG5leHBvcnQgY29uc3Qgd2lzaGxpc3RSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyB3aXNobGlzdFNlcnZpY2UgfSBmcm9tIFwiLi93aXNobGlzdC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gU2F2ZSBhIHBhY2thZ2UgdG8gdGhlIHdpc2hsaXN0IGNvbnRyb2xsZXIgKFVTRVIpXG5jb25zdCBhZGRUb1dpc2hsaXN0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2lzaGxpc3RTZXJ2aWNlLmFkZFRvV2lzaGxpc3QodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIGFkZGVkIHRvIHdpc2hsaXN0IHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIE15IHdpc2hsaXN0IGNvbnRyb2xsZXIgKFVTRVIpXG5jb25zdCBnZXRNeVdpc2hsaXN0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2lzaGxpc3RTZXJ2aWNlLmdldE15V2lzaGxpc3QodXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIldpc2hsaXN0IHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gUmVtb3ZlIGZyb20gd2lzaGxpc3QgY29udHJvbGxlciAoVVNFUikgXHUyMDE0IDIwNCBzbyBhIHJlcGVhdCBkZWxldGUgaXMgYVxuLy8gICAgbm8tb3AgaW5kaXN0aW5ndWlzaGFibGUgZnJvbSBhIHN1Y2Nlc3NmdWwgb25lIChubyBib2R5LCBubyBlcnJvcikuXG5jb25zdCByZW1vdmVGcm9tV2lzaGxpc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCBwYWNrYWdlSWQgPSBTdHJpbmcocmVxLnBhcmFtcy5wYWNrYWdlSWQpO1xuXG4gICAgYXdhaXQgd2lzaGxpc3RTZXJ2aWNlLnJlbW92ZUZyb21XaXNobGlzdCh1c2VySWQsIHBhY2thZ2VJZCk7XG5cbiAgICByZXMuc3RhdHVzKGh0dHBTdGF0dXMuTk9fQ09OVEVOVCkuc2VuZCgpO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHdpc2hsaXN0Q29udHJvbGxlciA9IHtcbiAgYWRkVG9XaXNobGlzdCxcbiAgZ2V0TXlXaXNobGlzdCxcbiAgcmVtb3ZlRnJvbVdpc2hsaXN0LFxufTsiLCAiaW1wb3J0IHsgUGFja2FnZVN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgcHVibGljUGFja2FnZUluY2x1ZGUgfSBmcm9tIFwiLi4vcGFja2FnZS9wYWNrYWdlLnNlcnZpY2VcIjtcbmltcG9ydCB7IElDcmVhdGVXaXNobGlzdFBheWxvYWQsIElXaXNobGlzdFF1ZXJ5IH0gZnJvbSBcIi4vd2lzaGxpc3QuaW50ZXJmYWNlXCI7XG5cbi8vIE1vbmV5IGlzIGBEZWNpbWFsKDEwLDIpYCBpbiB0aGUgc2NoZW1hIChBR0VOVFMubWQpIFx1MjAxNCBtYXAgdG8gTnVtYmVyIG9uIHJldHVybi5cbmNvbnN0IHNlcmlhbGl6ZVdpc2hsaXN0SXRlbSA9IDxcbiAgVCBleHRlbmRzIHsgcGFja2FnZTogeyBwcmljZTogUHJpc21hLkRlY2ltYWwgfSB9LFxuPihcbiAgcm93OiBULFxuKTogVCA9PiAoe1xuICAuLi5yb3csXG4gIHBhY2thZ2U6IHsgLi4ucm93LnBhY2thZ2UsIHByaWNlOiBOdW1iZXIocm93LnBhY2thZ2UucHJpY2UpIH0sXG59KTtcblxuLy8gMS4gU2F2ZSBhIHBhY2thZ2UgdG8gdGhlIHdpc2hsaXN0IChVU0VSKSBcdTIwMTQgaWRlbXBvdGVudC4gVGhlIHBhY2thZ2UgbXVzdCBiZVxuLy8gICAgQVBQUk9WRUQgYW5kIG5vdCBkZWxldGVkLCBtaXJyb3JpbmcgdGhlIHB1YmxpYy1wYWNrYWdlIHZpc2liaWxpdHkgcnVsZS5cbmNvbnN0IGFkZFRvV2lzaGxpc3QgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJQ3JlYXRlV2lzaGxpc3RQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIGlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHByaXNtYS53aXNobGlzdEl0ZW0udXBzZXJ0KHtcbiAgICB3aGVyZTogeyB1c2VySWRfcGFja2FnZUlkOiB7IHVzZXJJZCwgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9IH0sXG4gICAgY3JlYXRlOiB7IHVzZXJJZCwgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9LFxuICAgIHVwZGF0ZToge30sXG4gIH0pO1xufTtcblxuLy8gMi4gUGFnaW5hdGVkIHdpc2hsaXN0IChVU0VSKSBcdTIwMTQgbmV3ZXN0IGZpcnN0LiBSb3dzIHdob3NlIHBhY2thZ2Ugd2FzIGxhdGVyXG4vLyAgICBzb2Z0LWRlbGV0ZWQgb3IgZGVtb3RlZCBvdXQgb2YgQVBQUk9WRUQgYXJlIGZpbHRlcmVkIGF0IHJlYWQgdGltZSwgc28gdGhlXG4vLyAgICBwYWdlIG5ldmVyIGxpc3RzIGEgcGFja2FnZSB3aG9zZSBkZXRhaWwgcm91dGUgd291bGQgNDA0LlxuY29uc3QgZ2V0TXlXaXNobGlzdCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElXaXNobGlzdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5XaXNobGlzdEl0ZW1XaGVyZUlucHV0ID0ge1xuICAgIHVzZXJJZCxcbiAgICBwYWNrYWdlOiB7IGlzRGVsZXRlZDogZmFsc2UsIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCB9LFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLndpc2hsaXN0SXRlbS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgcGFja2FnZTogeyBpbmNsdWRlOiBwdWJsaWNQYWNrYWdlSW5jbHVkZSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEud2lzaGxpc3RJdGVtLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplV2lzaGxpc3RJdGVtKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAzLiBSZW1vdmUgYSBwYWNrYWdlIGZyb20gdGhlIHdpc2hsaXN0IChVU0VSKSBcdTIwMTQgaWRlbXBvdGVudDsgYSBtaXNzaW5nIHJvdyBpc1xuLy8gICAgYSBuby1vcCwgbmV2ZXIgYW4gZXJyb3IuIERlbGliZXJhdGVseSBubyBcImNsZWFyIGFsbFwiLlxuY29uc3QgcmVtb3ZlRnJvbVdpc2hsaXN0ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYWNrYWdlSWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBwcmlzbWEud2lzaGxpc3RJdGVtLmRlbGV0ZU1hbnkoe1xuICAgIHdoZXJlOiB7IHVzZXJJZCwgcGFja2FnZUlkIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IHdpc2hsaXN0U2VydmljZSA9IHtcbiAgYWRkVG9XaXNobGlzdCxcbiAgZ2V0TXlXaXNobGlzdCxcbiAgcmVtb3ZlRnJvbVdpc2hsaXN0LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlV2lzaGxpc3RTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhY2thZ2VJZDogelxuICAgICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3Qgd2lzaGxpc3RQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5jb25zdCB3aXNobGlzdFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxufSk7XG5cbmV4cG9ydCBjb25zdCB3aXNobGlzdFZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVXaXNobGlzdFNjaGVtYSxcbiAgd2lzaGxpc3RQYXJhbXNTY2hlbWEsXG4gIHdpc2hsaXN0UXVlcnlTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24uY29udHJvbGxlclwiO1xuaW1wb3J0IHsgbm90aWZpY2F0aW9uVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24udmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gTk9URTogUEFUQ0ggL3JlYWQtYWxsIE1VU1Qgc3RheSByZWdpc3RlcmVkIGJlZm9yZSBQQVRDSCAvOmlkL3JlYWQgXHUyMDE0XG4vLyBFeHByZXNzIG1hdGNoZXMgdG9wLWRvd24sIGFuZCBgL3JlYWQtYWxsYCB3b3VsZCBvdGhlcndpc2UgYmUgc3dhbGxvd2VkIGJ5XG4vLyB0aGUgYDppZGAgcGFyYW0gcm91dGUuXG5cbi8vIDEuIE15IG5vdGlmaWNhdGlvbnMgKGFueSBhdXRoZW50aWNhdGVkIHVzZXIpIFx1MjAxNCBwYWdpbmF0ZWQsIG9wdGlvbmFsID91bnJlYWQ9dHJ1ZVxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IG5vdGlmaWNhdGlvblZhbGlkYXRpb25zLm5vdGlmaWNhdGlvblF1ZXJ5U2NoZW1hIH0pLFxuICBub3RpZmljYXRpb25Db250cm9sbGVyLmdldE15Tm90aWZpY2F0aW9ucyxcbik7XG5cbi8vIDIuIFVucmVhZCBjb3VudCBmb3IgdGhlIGJlbGwgYmFkZ2VcbnJvdXRlci5nZXQoXG4gIFwiL3VucmVhZC1jb3VudFwiLFxuICBhdXRoKCksXG4gIG5vdGlmaWNhdGlvbkNvbnRyb2xsZXIuZ2V0VW5yZWFkQ291bnQsXG4pO1xuXG4vLyAzLiBNYXJrIGFsbCBteSBub3RpZmljYXRpb25zIHJlYWRcbnJvdXRlci5wYXRjaChcbiAgXCIvcmVhZC1hbGxcIixcbiAgYXV0aCgpLFxuICBub3RpZmljYXRpb25Db250cm9sbGVyLm1hcmtBbGxBc1JlYWQsXG4pO1xuXG4vLyA0LiBNYXJrIG9uZSBub3RpZmljYXRpb24gcmVhZCAob3duZXIgb25seSlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3JlYWRcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IG5vdGlmaWNhdGlvblZhbGlkYXRpb25zLm5vdGlmaWNhdGlvblBhcmFtc1NjaGVtYSB9KSxcbiAgbm90aWZpY2F0aW9uQ29udHJvbGxlci5tYXJrQXNSZWFkLFxuKTtcblxuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvblJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IG5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24uc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIE15IG5vdGlmaWNhdGlvbnMgY29udHJvbGxlciAoYW55IGF1dGhlbnRpY2F0ZWQgdXNlcilcbmNvbnN0IGdldE15Tm90aWZpY2F0aW9ucyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5vdGlmaWNhdGlvblNlcnZpY2UuZ2V0TXlOb3RpZmljYXRpb25zKFxuICAgICAgdXNlcklkLFxuICAgICAgcmVxLnF1ZXJ5LFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiTm90aWZpY2F0aW9ucyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIFVucmVhZCBjb3VudCBjb250cm9sbGVyIChiZWxsIGJhZGdlKVxuY29uc3QgZ2V0VW5yZWFkQ291bnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBub3RpZmljYXRpb25TZXJ2aWNlLmdldFVucmVhZENvdW50KHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVW5yZWFkIGNvdW50IHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBNYXJrIG9uZSBub3RpZmljYXRpb24gcmVhZCBjb250cm9sbGVyXG5jb25zdCBtYXJrQXNSZWFkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbm90aWZpY2F0aW9uU2VydmljZS5tYXJrQXNSZWFkKHVzZXJJZCwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIk5vdGlmaWNhdGlvbiBtYXJrZWQgYXMgcmVhZC5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIE1hcmsgYWxsIG5vdGlmaWNhdGlvbnMgcmVhZCBjb250cm9sbGVyXG5jb25zdCBtYXJrQWxsQXNSZWFkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbm90aWZpY2F0aW9uU2VydmljZS5tYXJrQWxsQXNSZWFkKHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIG5vdGlmaWNhdGlvbnMgbWFya2VkIGFzIHJlYWQuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3Qgbm90aWZpY2F0aW9uQ29udHJvbGxlciA9IHtcbiAgZ2V0TXlOb3RpZmljYXRpb25zLFxuICBnZXRVbnJlYWRDb3VudCxcbiAgbWFya0FzUmVhZCxcbiAgbWFya0FsbEFzUmVhZCxcbn07IiwgImltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uUXVlcnkgfSBmcm9tIFwiLi9ub3RpZmljYXRpb24uaW50ZXJmYWNlXCI7XG5cbi8vIDEuIE15IG5vdGlmaWNhdGlvbnMgKG5ld2VzdCBmaXJzdCkgXHUyMDE0IG9wdGlvbmFsID91bnJlYWQ9dHJ1ZSBmaWx0ZXIuXG5jb25zdCBnZXRNeU5vdGlmaWNhdGlvbnMgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBxdWVyeTogSU5vdGlmaWNhdGlvblF1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMjA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ob3RpZmljYXRpb25XaGVyZUlucHV0ID0ge1xuICAgIHVzZXJJZCxcbiAgICAuLi4ocXVlcnkudW5yZWFkID8geyBpc1JlYWQ6IGZhbHNlIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEubm90aWZpY2F0aW9uLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLm5vdGlmaWNhdGlvbi5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMi4gVW5yZWFkIGNvdW50IGZvciB0aGUgYmVsbCBiYWRnZSBcdTIwMTQgc2luZ2xlIGluZGV4LWJhY2tlZCBjb3VudC5cbmNvbnN0IGdldFVucmVhZENvdW50ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNvdW50ID0gYXdhaXQgcHJpc21hLm5vdGlmaWNhdGlvbi5jb3VudCh7XG4gICAgd2hlcmU6IHsgdXNlcklkLCBpc1JlYWQ6IGZhbHNlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7IGNvdW50IH07XG59O1xuXG4vLyAzLiBNYXJrIG9uZSBub3RpZmljYXRpb24gcmVhZCAob3duZXIgb25seSBcdTIwMTQgYSBmb3JlaWduIGlkIGlzIGEgNDA0KS5cbmNvbnN0IG1hcmtBc1JlYWQgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLm5vdGlmaWNhdGlvbi51cGRhdGVNYW55KHtcbiAgICB3aGVyZTogeyBpZCwgdXNlcklkIH0sXG4gICAgZGF0YTogeyBpc1JlYWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKHJlc3VsdC5jb3VudCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiTm90aWZpY2F0aW9uIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4geyBjb3VudDogcmVzdWx0LmNvdW50IH07XG59O1xuXG4vLyA0LiBNYXJrIGFsbCBteSBub3RpZmljYXRpb25zIHJlYWQgXHUyMDE0IGlkZW1wb3RlbnQuXG5jb25zdCBtYXJrQWxsQXNSZWFkID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS5ub3RpZmljYXRpb24udXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHsgdXNlcklkLCBpc1JlYWQ6IGZhbHNlIH0sXG4gICAgZGF0YTogeyBpc1JlYWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHsgY291bnQ6IHJlc3VsdC5jb3VudCB9O1xufTtcblxuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSB7XG4gIGdldE15Tm90aWZpY2F0aW9ucyxcbiAgZ2V0VW5yZWFkQ291bnQsXG4gIG1hcmtBc1JlYWQsXG4gIG1hcmtBbGxBc1JlYWQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBub3RpZmljYXRpb25RdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDIwKSxcbiAgLy8gXCJ0cnVlXCIvXCJmYWxzZVwiIHN0cmluZ3Mgb25seSBcdTIwMTQgei5jb2VyY2UuYm9vbGVhbigpIHdvdWxkIHRyZWF0IHRoZSBzdHJpbmdcbiAgLy8gXCJmYWxzZVwiIGFzIHRydXRoeS5cbiAgdW5yZWFkOiB6XG4gICAgLmVudW0oW1widHJ1ZVwiLCBcImZhbHNlXCJdKVxuICAgIC50cmFuc2Zvcm0oKHZhbHVlKSA9PiB2YWx1ZSA9PT0gXCJ0cnVlXCIpXG4gICAgLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3Qgbm90aWZpY2F0aW9uUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOb3RpZmljYXRpb24gaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oMSwgXCJOb3RpZmljYXRpb24gaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG59KTtcblxuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvblZhbGlkYXRpb25zID0ge1xuICBub3RpZmljYXRpb25RdWVyeVNjaGVtYSxcbiAgbm90aWZpY2F0aW9uUGFyYW1zU2NoZW1hLFxufTsiLCAiLy8gVmVyY2VsIHNlcnZlcmxlc3MgZW50cnlwb2ludCBcdTIwMTQgcmUtZXhwb3J0cyB0aGUgc2FtZSBFeHByZXNzIGFwcCB0aGUgbG9jYWxcbi8vIGJ1aWxkIHVzZXMuIFZlcmNlbCdzIEB2ZXJjZWwvbm9kZSBydW50aW1lIGNvbXBpbGVzIGFuZCB3cmFwcyBpdDsgdGhlIGFwcCBpc1xuLy8gc3BsaXQgZnJvbSBzZXJ2ZXIudHMgKHdoaWNoIG9ubHkgc3RhcnRzIHRoZSBsaXN0ZW5lcikgc28gdGhlIHR3byBob3N0cyBzaGFyZVxuLy8gb25lIHJvdXRlIHJlZ2lzdHJ5LlxuaW1wb3J0IGFwcCBmcm9tIFwiLi4vc3JjL2FwcFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhcHA7Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7OztBQUFBLE9BQU8sYUFBK0Q7QUFDdEUsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFlBQVk7QUFDbkIsT0FBTyxlQUFlOzs7QUNMdEIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sVUFBVTtBQUNqQixTQUFTLFNBQVM7QUFFbEIsT0FBTyxPQUFPO0FBQUEsRUFDWixPQUFPO0FBQUEsRUFDUCxNQUFNLEtBQUssS0FBSyxRQUFRLElBQUksR0FBRyxNQUFNO0FBQ3ZDLENBQUM7QUFLRCxJQUFNLFlBQVksRUFBRSxPQUFPO0FBQUEsRUFDekIsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLE1BQU07QUFBQSxFQUMvQixVQUFVLEVBQUUsS0FBSyxDQUFDLGVBQWUsWUFBWSxDQUFDLEVBQUUsUUFBUSxhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1yRSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVM7QUFBQSxFQUM1QyxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVM7QUFBQSxFQUU3QyxjQUFjLEVBQUUsT0FBTyxFQUFFLElBQUksR0FBRywwQkFBMEI7QUFBQSxFQUUxRCxvQkFBb0IsRUFBRSxPQUFPLEVBQUUsUUFBUSxJQUFJO0FBQUE7QUFBQTtBQUFBLEVBSTNDLGFBQWEsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFNBQVM7QUFBQSxFQUN6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QixJQUFJLElBQUksMEJBQWtCO0FBRTFCLElBQU8sY0FBUTs7O0F3RXZIZixJQUFPLGdCQUFROyIsCiAgIm5hbWVzIjogWyJwYXRoIiwgImNvbmZpZyIsICJCdWZmZXIiLCAiQW55TnVsbCIsICJEYk51bGwiLCAiRGVjaW1hbCIsICJKc29uTnVsbCIsICJOdWxsVHlwZXMiLCAiUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvciIsICJQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciIsICJQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciIsICJQcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yIiwgIlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciIsICJTcWwiLCAiZW1wdHkiLCAiam9pbiIsICJyYXciLCAicnVudGltZSIsICJodHRwU3RhdHVzIiwgInJlZnJlc2hUb2tlbiIsICJyZWZyZXNoVG9rZW4iLCAicmVnaXN0ZXJVc2VyIiwgImh0dHBTdGF0dXMiLCAibG9naW5Vc2VyIiwgImdvb2dsZUxvZ2luIiwgImRlbW9Mb2dpbiIsICJ6IiwgInoiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiYmNyeXB0IiwgImJjcnlwdCIsICJ1cGRhdGVQcm9maWxlIiwgImh0dHBTdGF0dXMiLCAiZ2V0VXNlcnMiLCAiY2hhbmdlUm9sZSIsICJjaGFuZ2VTdGF0dXMiLCAiZGVsZXRlVXNlciIsICJ6IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAibXVsdGVyIiwgImh0dHBTdGF0dXMiLCAiaHR0cFN0YXR1cyIsICJtdWx0ZXIiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVNZXNzYWdlIiwgImh0dHBTdGF0dXMiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZUJvb2tpbmciLCAiaHR0cFN0YXR1cyIsICJnZXRNeUJvb2tpbmdzIiwgImdldEFnZW50Qm9va2luZ3MiLCAiZ2V0Qm9va2luZ0RldGFpbCIsICJnZXRBbGxCb29raW5ncyIsICJ1cGRhdGVCb29raW5nU3RhdHVzIiwgInoiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZVJldmlldyIsICJodHRwU3RhdHVzIiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVDYXRlZ29yeSIsICJodHRwU3RhdHVzIiwgImdldEFsbENhdGVnb3JpZXMiLCAidXBkYXRlQ2F0ZWdvcnkiLCAiZGVsZXRlQ2F0ZWdvcnkiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgInJhbmRvbVVVSUQiLCAicmFuZG9tVVVJRCIsICJjcmVhdGVQYWNrYWdlIiwgImh0dHBTdGF0dXMiLCAiZ2V0UHVibGljUGFja2FnZXMiLCAiZ2V0UGFja2FnZUJ5U2x1ZyIsICJnZXRBbGxQYWNrYWdlcyIsICJnZXRNeVBhY2thZ2VzIiwgInVwZGF0ZVBhY2thZ2UiLCAiY2hhbmdlUGFja2FnZVN0YXR1cyIsICJzb2Z0RGVsZXRlUGFja2FnZSIsICJ6IiwgInVwZGF0ZVN0YXR1c1NjaGVtYSIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgInJhbmRvbVVVSUQiLCAiZ2VuZXJhdGVVbmlxdWVTbHVnIiwgInJhbmRvbVVVSUQiLCAiY3JlYXRlUG9zdCIsICJodHRwU3RhdHVzIiwgImdldFB1YmxpY1Bvc3RzIiwgImdldFBvc3RCeVNsdWciLCAiZ2V0QWxsUG9zdHMiLCAiZ2V0TXlQb3N0cyIsICJ1cGRhdGVQb3N0IiwgImNoYW5nZVBvc3RTdGF0dXMiLCAic29mdERlbGV0ZVBvc3QiLCAieiIsICJ0aXRsZVNjaGVtYSIsICJ1cGRhdGVTdGF0dXNTY2hlbWEiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJnZXRBZG1pbkRhc2hib2FyZCIsICJodHRwU3RhdHVzIiwgImdldEFnZW50RGFzaGJvYXJkIiwgImdldFVzZXJEYXNoYm9hcmQiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImh0dHBTdGF0dXMiLCAieiIsICJjcmVhdGVTY2hlbWEiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJhZGRUb1dpc2hsaXN0IiwgImh0dHBTdGF0dXMiLCAiZ2V0TXlXaXNobGlzdCIsICJyZW1vdmVGcm9tV2lzaGxpc3QiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImdldE15Tm90aWZpY2F0aW9ucyIsICJodHRwU3RhdHVzIiwgImdldFVucmVhZENvdW50IiwgIm1hcmtBc1JlYWQiLCAibWFya0FsbEFzUmVhZCIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiXQp9Cg==
