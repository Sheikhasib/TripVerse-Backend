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
  "inlineSchema": 'model BlogPost {\n  id         String     @id @default(uuid())\n  title      String\n  slug       String     @unique\n  excerpt    String\n  content    String\n  coverImage String\n  status     PostStatus @default(DRAFT)\n  isDeleted  Boolean    @default(false)\n\n  authorId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  author User @relation("AuthorPosts", fields: [authorId], references: [id])\n\n  @@index([status])\n  @@index([authorId])\n  @@map("blog_posts")\n}\n\nmodel Booking {\n  id         String        @id @default(uuid())\n  travelDate DateTime\n  travelers  Int\n  totalPrice Decimal       @db.Decimal(10, 2)\n  status     BookingStatus @default(PENDING)\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user     User        @relation("CustomerBookings", fields: [userId], references: [id])\n  package  TourPackage @relation(fields: [packageId], references: [id])\n  payments Payment[]\n\n  @@index([userId])\n  @@index([packageId])\n  @@index([status])\n  @@index([userId, packageId, travelDate])\n  @@map("bookings")\n}\n\nmodel Category {\n  id   String @id @default(uuid())\n  name String @unique\n  slug String @unique\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages TourPackage[]\n\n  @@map("categories")\n}\n\nmodel ContactMessage {\n  id         String  @id @default(uuid())\n  name       String\n  email      String\n  subject    String\n  message    String\n  isResolved Boolean @default(false)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@index([isResolved])\n  @@map("contact_messages")\n}\n\nenum Role {\n  USER\n  AGENT\n  ADMIN\n}\n\nenum UserStatus {\n  ACTIVE\n  SUSPENDED\n}\n\nenum AuthProvider {\n  CREDENTIAL\n  GOOGLE\n}\n\nenum PackageStatus {\n  PENDING\n  APPROVED\n  REJECTED\n}\n\nenum BookingStatus {\n  PENDING\n  PAID\n  CONFIRMED\n  CANCELLED\n  COMPLETED\n}\n\nenum PaymentStatus {\n  INITIATED\n  SUCCESS\n  FAILED\n  CANCELLED\n  REFUNDED\n}\n\nenum PostStatus {\n  DRAFT\n  PUBLISHED\n}\n\nmodel Payment {\n  id             String        @id @default(uuid())\n  bookingId      String\n  tranId         String        @unique // SSLCommerz transaction id, generated server-side\n  valId          String? // set after gateway success, used for server-side validation\n  amount         Decimal       @db.Decimal(10, 2) // = booking.totalPrice at session creation\n  currency       String        @default("BDT")\n  status         PaymentStatus @default(INITIATED)\n  gatewayPageUrl String?\n  sslSessionKey  String?\n  cardType       String?\n  bankTranId     String?\n  paidAt         DateTime?\n  refundRefId    String? // SSLCommerz refund reference (set when a refund is initiated)\n  refundedAt     DateTime? // when the refund was initiated/settled\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  booking Booking @relation(fields: [bookingId], references: [id])\n\n  @@index([bookingId])\n  @@index([status])\n  @@map("payments")\n}\n\nmodel Review {\n  id      String @id @default(uuid())\n  rating  Int\n  comment String\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user    User        @relation("CustomerReviews", fields: [userId], references: [id])\n  package TourPackage @relation(fields: [packageId], references: [id])\n\n  @@unique([userId, packageId])\n  @@index([packageId])\n  @@map("reviews")\n}\n\n// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../../generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\nmodel TourPackage {\n  id          String        @id @default(uuid())\n  title       String\n  slug        String        @unique\n  description String\n  location    String\n  price       Decimal       @db.Decimal(10, 2)\n  duration    Int\n  rating      Float         @default(0)\n  images      String[]\n  status      PackageStatus @default(PENDING)\n  isDeleted   Boolean       @default(false)\n\n  categoryId String\n  agentId    String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  category      Category       @relation(fields: [categoryId], references: [id])\n  agent         User           @relation("AgentPackages", fields: [agentId], references: [id])\n  bookings      Booking[]\n  reviews       Review[]\n  wishlistItems WishlistItem[]\n\n  @@index([categoryId])\n  @@index([categoryId, price])\n  @@index([price])\n  @@index([status])\n  @@map("tour_packages")\n}\n\nmodel User {\n  id            String       @id @default(uuid())\n  name          String\n  email         String       @unique\n  password      String?\n  googleId      String?      @unique\n  phone         String?\n  avatarUrl     String?\n  role          Role         @default(USER)\n  status        UserStatus   @default(ACTIVE)\n  authProvider  AuthProvider @default(CREDENTIAL)\n  emailVerified Boolean      @default(false)\n  isDeleted     Boolean      @default(false)\n  tokenVersion  Int          @default(0)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages TourPackage[]  @relation("AgentPackages")\n  bookings Booking[]      @relation("CustomerBookings")\n  reviews  Review[]       @relation("CustomerReviews")\n  posts    BlogPost[]     @relation("AuthorPosts")\n  wishlist WishlistItem[]\n\n  @@index([role])\n  @@index([status])\n  @@map("users")\n}\n\nmodel WishlistItem {\n  id        String @id @default(uuid())\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n\n  user    User        @relation(fields: [userId], references: [id])\n  package TourPackage @relation(fields: [packageId], references: [id])\n\n  @@unique([userId, packageId])\n  @@index([userId, createdAt])\n  @@map("wishlist_items")\n}\n',
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
config2.runtimeDataModel = JSON.parse('{"models":{"BlogPost":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"excerpt","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"coverImage","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PostStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"authorId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"author","kind":"object","type":"User","relationName":"AuthorPosts"}],"dbName":"blog_posts"},"Booking":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"travelDate","kind":"scalar","type":"DateTime"},{"name":"travelers","kind":"scalar","type":"Int"},{"name":"totalPrice","kind":"scalar","type":"Decimal"},{"name":"status","kind":"enum","type":"BookingStatus"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerBookings"},{"name":"package","kind":"object","type":"TourPackage","relationName":"BookingToTourPackage"},{"name":"payments","kind":"object","type":"Payment","relationName":"BookingToPayment"}],"dbName":"bookings"},"Category":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"CategoryToTourPackage"}],"dbName":"categories"},"ContactMessage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"isResolved","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"contact_messages"},"Payment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"bookingId","kind":"scalar","type":"String"},{"name":"tranId","kind":"scalar","type":"String"},{"name":"valId","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Decimal"},{"name":"currency","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PaymentStatus"},{"name":"gatewayPageUrl","kind":"scalar","type":"String"},{"name":"sslSessionKey","kind":"scalar","type":"String"},{"name":"cardType","kind":"scalar","type":"String"},{"name":"bankTranId","kind":"scalar","type":"String"},{"name":"paidAt","kind":"scalar","type":"DateTime"},{"name":"refundRefId","kind":"scalar","type":"String"},{"name":"refundedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"booking","kind":"object","type":"Booking","relationName":"BookingToPayment"}],"dbName":"payments"},"Review":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"rating","kind":"scalar","type":"Int"},{"name":"comment","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerReviews"},{"name":"package","kind":"object","type":"TourPackage","relationName":"ReviewToTourPackage"}],"dbName":"reviews"},"TourPackage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"location","kind":"scalar","type":"String"},{"name":"price","kind":"scalar","type":"Decimal"},{"name":"duration","kind":"scalar","type":"Int"},{"name":"rating","kind":"scalar","type":"Float"},{"name":"images","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PackageStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"categoryId","kind":"scalar","type":"String"},{"name":"agentId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"category","kind":"object","type":"Category","relationName":"CategoryToTourPackage"},{"name":"agent","kind":"object","type":"User","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"BookingToTourPackage"},{"name":"reviews","kind":"object","type":"Review","relationName":"ReviewToTourPackage"},{"name":"wishlistItems","kind":"object","type":"WishlistItem","relationName":"TourPackageToWishlistItem"}],"dbName":"tour_packages"},"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"googleId","kind":"scalar","type":"String"},{"name":"phone","kind":"scalar","type":"String"},{"name":"avatarUrl","kind":"scalar","type":"String"},{"name":"role","kind":"enum","type":"Role"},{"name":"status","kind":"enum","type":"UserStatus"},{"name":"authProvider","kind":"enum","type":"AuthProvider"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"tokenVersion","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"CustomerBookings"},{"name":"reviews","kind":"object","type":"Review","relationName":"CustomerReviews"},{"name":"posts","kind":"object","type":"BlogPost","relationName":"AuthorPosts"},{"name":"wishlist","kind":"object","type":"WishlistItem","relationName":"UserToWishlistItem"}],"dbName":"users"},"WishlistItem":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"UserToWishlistItem"},{"name":"package","kind":"object","type":"TourPackage","relationName":"TourPackageToWishlistItem"}],"dbName":"wishlist_items"}},"enums":{},"types":{}}');
config2.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","packages","_count","category","agent","user","package","booking","payments","bookings","reviews","wishlistItems","posts","wishlist","author","BlogPost.findUnique","BlogPost.findUniqueOrThrow","BlogPost.findFirst","BlogPost.findFirstOrThrow","BlogPost.findMany","data","BlogPost.createOne","BlogPost.createMany","BlogPost.createManyAndReturn","BlogPost.updateOne","BlogPost.updateMany","BlogPost.updateManyAndReturn","create","update","BlogPost.upsertOne","BlogPost.deleteOne","BlogPost.deleteMany","having","_min","_max","BlogPost.groupBy","BlogPost.aggregate","Booking.findUnique","Booking.findUniqueOrThrow","Booking.findFirst","Booking.findFirstOrThrow","Booking.findMany","Booking.createOne","Booking.createMany","Booking.createManyAndReturn","Booking.updateOne","Booking.updateMany","Booking.updateManyAndReturn","Booking.upsertOne","Booking.deleteOne","Booking.deleteMany","_avg","_sum","Booking.groupBy","Booking.aggregate","Category.findUnique","Category.findUniqueOrThrow","Category.findFirst","Category.findFirstOrThrow","Category.findMany","Category.createOne","Category.createMany","Category.createManyAndReturn","Category.updateOne","Category.updateMany","Category.updateManyAndReturn","Category.upsertOne","Category.deleteOne","Category.deleteMany","Category.groupBy","Category.aggregate","ContactMessage.findUnique","ContactMessage.findUniqueOrThrow","ContactMessage.findFirst","ContactMessage.findFirstOrThrow","ContactMessage.findMany","ContactMessage.createOne","ContactMessage.createMany","ContactMessage.createManyAndReturn","ContactMessage.updateOne","ContactMessage.updateMany","ContactMessage.updateManyAndReturn","ContactMessage.upsertOne","ContactMessage.deleteOne","ContactMessage.deleteMany","ContactMessage.groupBy","ContactMessage.aggregate","Payment.findUnique","Payment.findUniqueOrThrow","Payment.findFirst","Payment.findFirstOrThrow","Payment.findMany","Payment.createOne","Payment.createMany","Payment.createManyAndReturn","Payment.updateOne","Payment.updateMany","Payment.updateManyAndReturn","Payment.upsertOne","Payment.deleteOne","Payment.deleteMany","Payment.groupBy","Payment.aggregate","Review.findUnique","Review.findUniqueOrThrow","Review.findFirst","Review.findFirstOrThrow","Review.findMany","Review.createOne","Review.createMany","Review.createManyAndReturn","Review.updateOne","Review.updateMany","Review.updateManyAndReturn","Review.upsertOne","Review.deleteOne","Review.deleteMany","Review.groupBy","Review.aggregate","TourPackage.findUnique","TourPackage.findUniqueOrThrow","TourPackage.findFirst","TourPackage.findFirstOrThrow","TourPackage.findMany","TourPackage.createOne","TourPackage.createMany","TourPackage.createManyAndReturn","TourPackage.updateOne","TourPackage.updateMany","TourPackage.updateManyAndReturn","TourPackage.upsertOne","TourPackage.deleteOne","TourPackage.deleteMany","TourPackage.groupBy","TourPackage.aggregate","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","User.upsertOne","User.deleteOne","User.deleteMany","User.groupBy","User.aggregate","WishlistItem.findUnique","WishlistItem.findUniqueOrThrow","WishlistItem.findFirst","WishlistItem.findFirstOrThrow","WishlistItem.findMany","WishlistItem.createOne","WishlistItem.createMany","WishlistItem.createManyAndReturn","WishlistItem.updateOne","WishlistItem.updateMany","WishlistItem.updateManyAndReturn","WishlistItem.upsertOne","WishlistItem.deleteOne","WishlistItem.deleteMany","WishlistItem.groupBy","WishlistItem.aggregate","AND","OR","NOT","id","userId","packageId","createdAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","name","email","password","googleId","phone","avatarUrl","Role","role","UserStatus","status","AuthProvider","authProvider","emailVerified","isDeleted","tokenVersion","updatedAt","every","some","none","title","slug","description","location","price","duration","rating","images","PackageStatus","categoryId","agentId","has","hasEvery","hasSome","comment","bookingId","tranId","valId","amount","currency","PaymentStatus","gatewayPageUrl","sslSessionKey","cardType","bankTranId","paidAt","refundRefId","refundedAt","subject","message","isResolved","travelDate","travelers","totalPrice","BookingStatus","excerpt","content","coverImage","PostStatus","authorId","userId_packageId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","push","increment","decrement","multiply","divide"]'),
  graph: "4gRXkAEPEAAAwAIAIKkBAAC-AgAwqgEAAB8AEKsBAAC-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-AgAwqgEAAB8AEKsBAAC-AgAwrAEBAJMCACGvAUAAmgIAIcQBAAC_AvUBIsgBIACYAgAhygFAAJoCACHOAQEAkwIAIc8BAQCTAgAh8QEBAJMCACHyAQEAkwIAIfMBAQCTAgAh9QEBAJMCACEBEAAAogQAIAMAAAAfACABAAAgADACAAABACADAAAAFgAgAQAAFwAwAgAAGAAgAQAAAAMAIAEAAAAJACABAAAAEgAgAQAAAB8AIAEAAAAWACABAAAAAQAgAwAAAB8AIAEAACAAMAIAAAEAIAMAAAAfACABAAAgADACAAABACADAAAAHwAgAQAAIAAwAgAAAQAgDBAAAKEEACCsAQEAAAABrwFAAAAAAcQBAAAA9QECyAEgAAAAAcoBQAAAAAHOAQEAAAABzwEBAAAAAfEBAQAAAAHyAQEAAAAB8wEBAAAAAfUBAQAAAAEBFgAALAAgC6wBAQAAAAGvAUAAAAABxAEAAAD1AQLIASAAAAABygFAAAAAAc4BAQAAAAHPAQEAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAAB9QEBAAAAAQEWAAAuADABFgAALgAwDBAAAKAEACCsAQEA1QIAIa8BQADWAgAhxAEAAIID9QEiyAEgAOUCACHKAUAA1gIAIc4BAQDVAgAhzwEBANUCACHxAQEA1QIAIfIBAQDVAgAh8wEBANUCACH1AQEA1QIAIQIAAAABACAWAAAxACALrAEBANUCACGvAUAA1gIAIcQBAACCA_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_wEAIeUBAQD_AQAh5gEBAP8BACHnAUAArQIAIegBAQD_AQAh6QFAAK0CACEDAAAADQAgAQAAlwEAMCIAAJgBACADAAAADQAgAQAADgAwAgAADwAgAQAAABQAIAEAAAAUACADAAAAEgAgAQAAEwAwAgAAFAAgAwAAABIAIAEAABMAMAIAABQAIAMAAAASACABAAATADACAAAUACAJBwAA2AMAIAgAAJIDACCsAQEAAAABrQEBAAAAAa4BAQAAAAGvAUAAAAABygFAAAAAAdQBAgAAAAHcAQEAAAABARYAAKABACAHrAEBAAAAAa0BAQAAAAGuAQEAAAABrwFAAAAAAcoBQAAAAAHUAQIAAAAB3AEBAAAAAQEWAACiAQAwARYAAKIBADAJBwAA1gMAIAgAAJADACCsAQEA1QIAIa0BAQDVAgAhrgEBANUCACGvAUAA1gIAIcoBQADWAgAh1AECAOYCACHcAQEA1QIAIQIAAAAUACAWAAClAQAgB6wBAQDVAgAhrQEBANUCACGuAQEA1QIAIa8BQADWAgAhygFAANYCACHUAQIA5gIAIdwBAQDVAgAhAgAAABIAIBYAAKcBACACAAAAEgAgFgAApwEAIAMAAAAUACAdAACgAQAgHgAApQEAIAEAAAAUACABAAAAEgAgBQQAAPsDACAjAAD-AwAgJAAA_QMAIDUAAPwDACA2AAD_AwAgCqkBAACqAgAwqgEAAK4BABCrAQAAqgIAMKwBAQD3AQAhrQEBAPcBACGuAQEA9wEAIa8BQAD4AQAhygFAAPgBACHUAQIAhAIAIdwBAQD3AQAhAwAAABIAIAEAAK0BADAiAACuAQAgAwAAABIAIAEAABMAMAIAABQAIAEAAAAFACABAAAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgFAUAAOYDACAGAAD6AwAgCwAA5wMAIAwAAOgDACANAADpAwAgrAEBAAAAAa8BQAAAAAHEAQAAANcBAsgBIAAAAAHKAUAAAAABzgEBAAAAAc8BAQAAAAHQAQEAAAAB0QEBAAAAAdIBEAAAAAHTAQIAAAAB1AEIAAAAAdUBAADlAwAg1wEBAAAAAdgBAQAAAAEBFgAAtgEAIA-sAQEAAAABrwFAAAAAAcQBAAAA1wECyAEgAAAAAcoBQAAAAAHOAQEAAAABzwEBAAAAAdABAQAAAAHRAQEAAAAB0gEQAAAAAdMBAgAAAAHUAQgAAAAB1QEAAOUDACDXAQEAAAAB2AEBAAAAAQEWAAC4AQAwARYAALgBADAUBQAAwQMAIAYAAPkDACALAADCAwAgDAAAwwMAIA0AAMQDACCsAQEA1QIAIa8BQADWAgAhxAEAAL8D1wEiyAEgAOUCACHKAUAA1gIAIc4BAQDVAgAhzwEBANUCACHQAQEA1QIAIdEBAQDVAgAh0gEQAJ0DACHTAQIA5gIAIdQBCAC9AwAh1QEAAL4DACDXAQEA1QIAIdgBAQDVAgAhAgAAAAUAIBYAALsBACAPrAEBANUCACGvAUAA1gIAIcQBAAC_A9cBIsgBIADlAgAhygFAANYCACHOAQEA1QIAIc8BAQDVAgAh0AEBANUCACHRAQEA1QIAIdIBEACdAwAh0wECAOYCACHUAQgAvQMAIdUBAAC-AwAg1wEBANUCACHYAQEA1QIAIQIAAAADACAWAAC9AQAgAgAAAAMAIBYAAL0BACADAAAABQAgHQAAtgEAIB4AALsBACABAAAABQAgAQAAAAMAIAUEAAD0AwAgIwAA9wMAICQAAPYDACA1AAD1AwAgNgAA-AMAIBKpAQAAoAIAMKoBAADEAQAQqwEAAKACADCsAQEA9wEAIa8BQAD4AQAhxAEAAKQC1wEiyAEgAIMCACHKAUAA-AEAIc4BAQD3AQAhzwEBAPcBACHQAQEA9wEAIdEBAQD3AQAh0gEQAKECACHTAQIAhAIAIdQBCACiAgAh1QEAAKMCACDXAQEA9wEAIdgBAQD3AQAhAwAAAAMAIAEAAMMBADAiAADEAQAgAwAAAAMAIAEAAAQAMAIAAAUAIBcDAACbAgAgCwAAnAIAIAwAAJ0CACAOAACeAgAgDwAAnwIAIKkBAACSAgAwqgEAAMoBABCrAQAAkgIAMKwBAQAAAAGvAUAAmgIAIbsBAQCTAgAhvAEBAAAAAb0BAQCUAgAhvgEBAAAAAb8BAQCUAgAhwAEBAJQCACHCAQAAlQLCASLEAQAAlgLEASLGAQAAlwLGASLHASAAmAIAIcgBIACYAgAhyQECAJkCACHKAUAAmgIAIQEAAADHAQAgAQAAAMcBACAXAwAAmwIAIAsAAJwCACAMAACdAgAgDgAAngIAIA8AAJ8CACCpAQAAkgIAMKoBAADKAQAQqwEAAJICADCsAQEAkwIAIa8BQACaAgAhuwEBAJMCACG8AQEAkwIAIb0BAQCUAgAhvgEBAJQCACG_AQEAlAIAIcABAQCUAgAhwgEAAJUCwgEixAEAAJYCxAEixgEAAJcCxgEixwEgAJgCACHIASAAmAIAIckBAgCZAgAhygFAAJoCACEJAwAA7wMAIAsAAPADACAMAADxAwAgDgAA8gMAIA8AAPMDACC9AQAA2wIAIL4BAADbAgAgvwEAANsCACDAAQAA2wIAIAMAAADKAQAgAQAAywEAMAIAAMcBACADAAAAygEAIAEAAMsBADACAADHAQAgAwAAAMoBACABAADLAQAwAgAAxwEAIBQDAADqAwAgCwAA6wMAIAwAAOwDACAOAADtAwAgDwAA7gMAIKwBAQAAAAGvAUAAAAABuwEBAAAAAbwBAQAAAAG9AQEAAAABvgEBAAAAAb8BAQAAAAHAAQEAAAABwgEAAADCAQLEAQAAAMQBAsYBAAAAxgECxwEgAAAAAcgBIAAAAAHJAQIAAAABygFAAAAAAQEWAADPAQAgD6wBAQAAAAGvAUAAAAABuwEBAAAAAbwBAQAAAAG9AQEAAAABvgEBAAAAAb8BAQAAAAHAAQEAAAABwgEAAADCAQLEAQAAAMQBAsYBAAAAxgECxwEgAAAAAcgBIAAAAAHJAQIAAAABygFAAAAAAQEWAADRAQAwARYAANEBADAUAwAA5wIAIAsAAOgCACAMAADpAgAgDgAA6gIAIA8AAOsCACCsAQEA1QIAIa8BQADWAgAhuwEBANUCACG8AQEA1QIAIb0BAQDhAgAhvgEBAOECACG_AQEA4QIAIcABAQDhAgAhwgEAAOICwgEixAEAAOMCxAEixgEAAOQCxgEixwEgAOUCACHIASAA5QIAIckBAgDmAgAhygFAANYCACECAAAAxwEAIBYAANQBACAPrAEBANUCACGvAUAA1gIAIbsBAQDVAgAhvAEBANUCACG9AQEA4QIAIb4BAQDhAgAhvwEBAOECACHAAQEA4QIAIcIBAADiAsIBIsQBAADjAsQBIsYBAADkAsYBIscBIADlAgAhyAEgAOUCACHJAQIA5gIAIcoBQADWAgAhAgAAAMoBACAWAADWAQAgAgAAAMoBACAWAADWAQAgAwAAAMcBACAdAADPAQAgHgAA1AEAIAEAAADHAQAgAQAAAMoBACAJBAAA3AIAICMAAN8CACAkAADeAgAgNQAA3QIAIDYAAOACACC9AQAA2wIAIL4BAADbAgAgvwEAANsCACDAAQAA2wIAIBKpAQAA_gEAMKoBAADdAQAQqwEAAP4BADCsAQEA9wEAIa8BQAD4AQAhuwEBAPcBACG8AQEA9wEAIb0BAQD_AQAhvgEBAP8BACG_AQEA_wEAIcABAQD_AQAhwgEAAIACwgEixAEAAIECxAEixgEAAIICxgEixwEgAIMCACHIASAAgwIAIckBAgCEAgAhygFAAPgBACEDAAAAygEAIAEAANwBADAiAADdAQAgAwAAAMoBACABAADLAQAwAgAAxwEAIAEAAAAYACABAAAAGAAgAwAAABYAIAEAABcAMAIAABgAIAMAAAAWACABAAAXADACAAAYACADAAAAFgAgAQAAFwAwAgAAGAAgBgcAANkCACAIAADaAgAgrAEBAAAAAa0BAQAAAAGuAQEAAAABrwFAAAAAAQEWAADlAQAgBKwBAQAAAAGtAQEAAAABrgEBAAAAAa8BQAAAAAEBFgAA5wEAMAEWAADnAQAwBgcAANcCACAIAADYAgAgrAEBANUCACGtAQEA1QIAIa4BAQDVAgAhrwFAANYCACECAAAAGAAgFgAA6gEAIASsAQEA1QIAIa0BAQDVAgAhrgEBANUCACGvAUAA1gIAIQIAAAAWACAWAADsAQAgAgAAABYAIBYAAOwBACADAAAAGAAgHQAA5QEAIB4AAOoBACABAAAAGAAgAQAAABYAIAMEAADSAgAgIwAA1AIAICQAANMCACAHqQEAAPYBADCqAQAA8wEAEKsBAAD2AQAwrAEBAPcBACGtAQEA9wEAIa4BAQD3AQAhrwFAAPgBACEDAAAAFgAgAQAA8gEAMCIAAPMBACADAAAAFgAgAQAAFwAwAgAAGAAgB6kBAAD2AQAwqgEAAPMBABCrAQAA9gEAMKwBAQD3AQAhrQEBAPcBACGuAQEA9wEAIa8BQAD4AQAhDgQAAPoBACAjAAD9AQAgJAAA_QEAILABAQAAAAGxAQEAAAAEsgEBAAAABLMBAQAAAAG0AQEAAAABtQEBAAAAAbYBAQAAAAG3AQEA_AEAIbgBAQAAAAG5AQEAAAABugEBAAAAAQsEAAD6AQAgIwAA-wEAICQAAPsBACCwAUAAAAABsQFAAAAABLIBQAAAAASzAUAAAAABtAFAAAAAAbUBQAAAAAG2AUAAAAABtwFAAPkBACELBAAA-gEAICMAAPsBACAkAAD7AQAgsAFAAAAAAbEBQAAAAASyAUAAAAAEswFAAAAAAbQBQAAAAAG1AUAAAAABtgFAAAAAAbcBQAD5AQAhCLABAgAAAAGxAQIAAAAEsgECAAAABLMBAgAAAAG0AQIAAAABtQECAAAAAbYBAgAAAAG3AQIA-gEAIQiwAUAAAAABsQFAAAAABLIBQAAAAASzAUAAAAABtAFAAAAAAbUBQAAAAAG2AUAAAAABtwFAAPsBACEOBAAA-gEAICMAAP0BACAkAAD9AQAgsAEBAAAAAbEBAQAAAASyAQEAAAAEswEBAAAAAbQBAQAAAAG1AQEAAAABtgEBAAAAAbcBAQD8AQAhuAEBAAAAAbkBAQAAAAG6AQEAAAABC7ABAQAAAAGxAQEAAAAEsgEBAAAABLMBAQAAAAG0AQEAAAABtQEBAAAAAbYBAQAAAAG3AQEA_QEAIbgBAQAAAAG5AQEAAAABugEBAAAAARKpAQAA_gEAMKoBAADdAQAQqwEAAP4BADCsAQEA9wEAIa8BQAD4AQAhuwEBAPcBACG8AQEA9wEAIb0BAQD_AQAhvgEBAP8BACG_AQEA_wEAIcABAQD_AQAhwgEAAIACwgEixAEAAIECxAEixgEAAIICxgEixwEgAIMCACHIASAAgwIAIckBAgCEAgAhygFAAPgBACEOBAAAkAIAICMAAJECACAkAACRAgAgsAEBAAAAAbEBAQAAAAWyAQEAAAAFswEBAAAAAbQBAQAAAAG1AQEAAAABtgEBAAAAAbcBAQCPAgAhuAEBAAAAAbkBAQAAAAG6AQEAAAABBwQAAPoBACAjAACOAgAgJAAAjgIAILABAAAAwgECsQEAAADCAQiyAQAAAMIBCLcBAACNAsIBIgcEAAD6AQAgIwAAjAIAICQAAIwCACCwAQAAAMQBArEBAAAAxAEIsgEAAADEAQi3AQAAiwLEASIHBAAA-gEAICMAAIoCACAkAACKAgAgsAEAAADGAQKxAQAAAMYBCLIBAAAAxgEItwEAAIkCxgEiBQQAAPoBACAjAACIAgAgJAAAiAIAILABIAAAAAG3ASAAhwIAIQ0EAAD6AQAgIwAA-gEAICQAAPoBACA1AACGAgAgNgAA-gEAILABAgAAAAGxAQIAAAAEsgECAAAABLMBAgAAAAG0AQIAAAABtQECAAAAAbYBAgAAAAG3AQIAhQIAIQ0EAAD6AQAgIwAA-gEAICQAAPoBACA1AACGAgAgNgAA-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_wEAIeUBAQD_AQAh5gEBAP8BACHnAUAArQIAIegBAQD_AQAh6QFAAK0CACEHBAAA-gEAICMAALECACAkAACxAgAgsAEAAADjAQKxAQAAAOMBCLIBAAAA4wEItwEAALAC4wEiCwQAAJACACAjAACvAgAgJAAArwIAILABQAAAAAGxAUAAAAAFsgFAAAAABbMBQAAAAAG0AUAAAAABtQFAAAAAAbYBQAAAAAG3AUAArgIAIQsEAACQAgAgIwAArwIAICQAAK8CACCwAUAAAAABsQFAAAAABbIBQAAAAAWzAUAAAAABtAFAAAAAAbUBQAAAAAG2AUAAAAABtwFAAK4CACEIsAFAAAAAAbEBQAAAAAWyAUAAAAAFswFAAAAAAbQBQAAAAAG1AUAAAAABtgFAAAAAAbcBQACvAgAhBwQAAPoBACAjAACxAgAgJAAAsQIAILABAAAA4wECsQEAAADjAQiyAQAAAOMBCLcBAACwAuMBIgSwAQAAAOMBArEBAAAA4wEIsgEAAADjAQi3AQAAsQLjASILqQEAALICADCqAQAAggEAEKsBAACyAgAwrAEBAPcBACGvAUAA-AEAIbsBAQD3AQAhvAEBAPcBACHKAUAA-AEAIeoBAQD3AQAh6wEBAPcBACHsASAAgwIAIQupAQAAswIAMKoBAABvABCrAQAAswIAMKwBAQCTAgAhrwFAAJoCACG7AQEAkwIAIbwBAQCTAgAhygFAAJoCACHqAQEAkwIAIesBAQCTAgAh7AEgAJgCACEIqQEAALQCADCqAQAAaQAQqwEAALQCADCsAQEA9wEAIa8BQAD4AQAhuwEBAPcBACHKAUAA-AEAIc8BAQD3AQAhCQMAAJsCACCpAQAAtQIAMKoBAABWABCrAQAAtQIAMKwBAQCTAgAhrwFAAJoCACG7AQEAkwIAIcoBQACaAgAhzwEBAJMCACEMqQEAALYCADCqAQAAUAAQqwEAALYCADCsAQEA9wEAIa0BAQD3AQAhrgEBAPcBACGvAUAA-AEAIcQBAAC3AvEBIsoBQAD4AQAh7QFAAPgBACHuAQIAhAIAIe8BEAChAgAhBwQAAPoBACAjAAC5AgAgJAAAuQIAILABAAAA8QECsQEAAADxAQiyAQAAAPEBCLcBAAC4AvEBIgcEAAD6AQAgIwAAuQIAICQAALkCACCwAQAAAPEBArEBAAAA8QEIsgEAAADxAQi3AQAAuALxASIEsAEAAADxAQKxAQAAAPEBCLIBAAAA8QEItwEAALkC8QEiDqkBAAC6AgAwqgEAADoAEKsBAAC6AgAwrAEBAPcBACGvAUAA-AEAIcQBAAC7AvUBIsgBIACDAgAhygFAAPgBACHOAQEA9wEAIc8BAQD3AQAh8QEBAPcBACHyAQEA9wEAIfMBAQD3AQAh9QEBAPcBACEHBAAA-gEAICMAAL0CACAkAAC9AgAgsAEAAAD1AQKxAQAAAPUBCLIBAAAA9QEItwEAALwC9QEiBwQAAPoBACAjAAC9AgAgJAAAvQIAILABAAAA9QECsQEAAAD1AQiyAQAAAPUBCLcBAAC8AvUBIgSwAQAAAPUBArEBAAAA9QEIsgEAAAD1AQi3AQAAvQL1ASIPEAAAwAIAIKkBAAC-AgAwqgEAAB8AEKsBAAC-AgAwrAEBAJMCACGvAUAAmgIAIcQBAAC_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_AFAAAAAAQUdAADbBAAgHgAA4QQAIPkBAADcBAAg-gEAAOAEACD_AQAAxwEAIAUdAADZBAAgHgAA3gQAIPkBAADaBAAg-gEAAN0EACD_AQAABQAgAx0AANsEACD5AQAA3AQAIP8BAADHAQAgAx0AANkEACD5AQAA2gQAIP8BAAAFACAAAAAAAAAB_AEBAAAAAQH8AQAAAMIBAgH8AQAAAMQBAgH8AQAAAMYBAgH8ASAAAAABBfwBAgAAAAGDAgIAAAABhAICAAAAAYUCAgAAAAGGAgIAAAABCx0AALMDADAeAAC4AwAw-QEAALQDADD6AQAAtQMAMPsBAAC2AwAg_AEAALcDADD9AQAAtwMAMP4BAAC3AwAw_wEAALcDADCAAgAAuQMAMIECAAC6AwAwCx0AAJMDADAeAACYAwAw-QEAAJQDADD6AQAAlQMAMPsBAACWAwAg_AEAAJcDADD9AQAAlwMAMP4BAACXAwAw_wEAAJcDADCAAgAAmQMAMIECAACaAwAwCx0AAIUDADAeAACKAwAw-QEAAIYDADD6AQAAhwMAMPsBAACIAwAg_AEAAIkDADD9AQAAiQMAMP4BAACJAwAw_wEAAIkDADCAAgAAiwMAMIECAACMAwAwCx0AAPgCADAeAAD9AgAw-QEAAPkCADD6AQAA-gIAMPsBAAD7AgAg_AEAAPwCADD9AQAA_AIAMP4BAAD8AgAw_wEAAPwCADCAAgAA_gIAMIECAAD_AgAwCx0AAOwCADAeAADxAgAw-QEAAO0CADD6AQAA7gIAMPsBAADvAgAg_AEAAPACADD9AQAA8AIAMP4BAADwAgAw_wEAAPACADCAAgAA8gIAMIECAADzAgAwBAgAANoCACCsAQEAAAABrgEBAAAAAa8BQAAAAAECAAAAGAAgHQAA9wIAIAMAAAAYACAdAAD3AgAgHgAA9gIAIAEWAADYBAAwCgcAAMACACAIAADDAgAgqQEAAMICADCqAQAAFgAQqwEAAMICADCsAQEAAAABrQEBAJMCACGuAQEAkwIAIa8BQACaAgAh9gEAAMECACACAAAAGAAgFgAA9gIAIAIAAAD0AgAgFgAA9QIAIAepAQAA8wIAMKoBAAD0AgAQqwEAAPMCADCsAQEAkwIAIa0BAQCTAgAhrgEBAJMCACGvAUAAmgIAIQepAQAA8wIAMKoBAAD0AgAQqwEAAPMCADCsAQEAkwIAIa0BAQCTAgAhrgEBAJMCACGvAUAAmgIAIQOsAQEA1QIAIa4BAQDVAgAhrwFAANYCACEECAAA2AIAIKwBAQDVAgAhrgEBANUCACGvAUAA1gIAIQQIAADaAgAgrAEBAAAAAa4BAQAAAAGvAUAAAAABCqwBAQAAAAGvAUAAAAABxAEAAAD1AQLIASAAAAABygFAAAAAAc4BAQAAAAHPAQEAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAABAgAAAAEAIB0AAIQDACADAAAAAQAgHQAAhAMAIB4AAIMDACABFgAA1wQAMA8QAADAAgAgqQEAAL4CADCqAQAAHwAQqwEAAL4CADCsAQEAAAABrwFAAJoCACHEAQAAvwL1ASLIASAAmAIAIcoBQACaAgAhzgEBAJMCACHPAQEAAAAB8QEBAJMCACHyAQEAkwIAIfMBAQCTAgAh9QEBAJMCACECAAAAAQAgFgAAgwMAIAIAAACAAwAgFgAAgQMAIA6pAQAA_wIAMKoBAACAAwAQqwEAAP8CADCsAQEAkwIAIa8BQACaAgAhxAEAAL8C9QEiyAEgAJgCACHKAUAAmgIAIc4BAQCTAgAhzwEBAJMCACHxAQEAkwIAIfIBAQCTAgAh8wEBAJMCACH1AQEAkwIAIQ6pAQAA_wIAMKoBAACAAwAQqwEAAP8CADCsAQEAkwIAIa8BQACaAgAhxAEAAL8C9QEiyAEgAJgCACHKAUAAmgIAIc4BAQCTAgAhzwEBAJMCACHxAQEAkwIAIfIBAQCTAgAh8wEBAJMCACH1AQEAkwIAIQqsAQEA1QIAIa8BQADWAgAhxAEAAIID9QEiyAEgAOUCACHKAUAA1gIAIc4BAQDVAgAhzwEBANUCACHxAQEA1QIAIfIBAQDVAgAh8wEBANUCACEB_AEAAAD1AQIKrAEBANUCACGvAUAA1gIAIcQBAACCA_UBIsgBIADlAgAhygFAANYCACHOAQEA1QIAIc8BAQDVAgAh8QEBANUCACHyAQEA1QIAIfMBAQDVAgAhCqwBAQAAAAGvAUAAAAABxAEAAAD1AQLIASAAAAABygFAAAAAAc4BAQAAAAHPAQEAAAAB8QEBAAAAAfIBAQAAAAHzAQEAAAABBwgAAJIDACCsAQEAAAABrgEBAAAAAa8BQAAAAAHKAUAAAAAB1AECAAAAAdwBAQAAAAECAAAAFAAgHQAAkQMAIAMAAAAUACAdAACRAwAgHgAAjwMAIAEWAADWBAAwDQcAAMACACAIAADDAgAgqQEAAMUCADCqAQAAEgAQqwEAAMUCADCsAQEAAAABrQEBAJMCACGuAQEAkwIAIa8BQACaAgAhygFAAJoCACHUAQIAmQIAIdwBAQCTAgAh9gEAAMQCACACAAAAFAAgFgAAjwMAIAIAAACNAwAgFgAAjgMAIAqpAQAAjAMAMKoBAACNAwAQqwEAAIwDADCsAQEAkwIAIa0BAQCTAgAhrgEBAJMCACGvAUAAmgIAIcoBQACaAgAh1AECAJkCACHcAQEAkwIAIQqpAQAAjAMAMKoBAACNAwAQqwEAAIwDADCsAQEAkwIAIa0BAQCTAgAhrgEBAJMCACGvAUAAmgIAIcoBQACaAgAh1AECAJkCACHcAQEAkwIAIQasAQEA1QIAIa4BAQDVAgAhrwFAANYCACHKAUAA1gIAIdQBAgDmAgAh3AEBANUCACEHCAAAkAMAIKwBAQDVAgAhrgEBANUCACGvAUAA1gIAIcoBQADWAgAh1AECAOYCACHcAQEA1QIAIQUdAADRBAAgHgAA1AQAIPkBAADSBAAg-gEAANMEACD_AQAABQAgBwgAAJIDACCsAQEAAAABrgEBAAAAAa8BQAAAAAHKAUAAAAAB1AECAAAAAdwBAQAAAAEDHQAA0QQAIPkBAADSBAAg_wEAAAUAIAoIAACxAwAgCgAAsgMAIKwBAQAAAAGuAQEAAAABrwFAAAAAAcQBAAAA8QECygFAAAAAAe0BQAAAAAHuAQIAAAAB7wEQAAAAAQIAAAALACAdAACwAwAgAwAAAAsAIB0AALADACAeAACfAwAgARYAANAEADAPBwAAwAIAIAgAAMMCACAKAADNAgAgqQEAAMsCADCqAQAACQAQqwEAAMsCADCsAQEAAAABrQEBAJMCACGuAQEAkwIAIa8BQACaAgAhxAEAAMwC8QEiygFAAJoCACHtAUAAmgIAIe4BAgCZAgAh7wEQAMcCACECAAAACwAgFgAAnwMAIAIAAACbAwAgFgAAnAMAIAypAQAAmgMAMKoBAACbAwAQqwEAAJoDADCsAQEAkwIAIa0BAQCTAgAhrgEBAJMCACGvAUAAmgIAIcQBAADMAvEBIsoBQACaAgAh7QFAAJoCACHuAQIAmQIAIe8BEADHAgAhDKkBAACaAwAwqgEAAJsDABCrAQAAmgMAMKwBAQCTAgAhrQEBAJMCACGuAQEAkwIAIa8BQACaAgAhxAEAAMwC8QEiygFAAJoCACHtAUAAmgIAIe4BAgCZAgAh7wEQAMcCACEIrAEBANUCACGuAQEA1QIAIa8BQADWAgAhxAEAAJ4D8QEiygFAANYCACHtAUAA1gIAIe4BAgDmAgAh7wEQAJ0DACEF_AEQAAAAAYMCEAAAAAGEAhAAAAABhQIQAAAAAYYCEAAAAAEB_AEAAADxAQIKCAAAoAMAIAoAAKEDACCsAQEA1QIAIa4BAQDVAgAhrwFAANYCACHEAQAAngPxASLKAUAA1gIAIe0BQADWAgAh7gECAOYCACHvARAAnQMAIQUdAADKBAAgHgAAzgQAIPkBAADLBAAg-gEAAM0EACD_AQAABQAgCx0AAKIDADAeAACnAwAw-QEAAKMDADD6AQAApAMAMPsBAAClAwAg_AEAAKYDADD9AQAApgMAMP4BAACmAwAw_wEAAKYDADCAAgAAqAMAMIECAACpAwAwD6wBAQAAAAGvAUAAAAABxAEAAADjAQLKAUAAAAAB3gEBAAAAAd8BAQAAAAHgARAAAAAB4QEBAAAAAeMBAQAAAAHkAQEAAAAB5QEBAAAAAeYBAQAAAAHnAUAAAAAB6AEBAAAAAekBQAAAAAECAAAADwAgHQAArwMAIAMAAAAPACAdAACvAwAgHgAArgMAIAEWAADMBAAwFAkAAMoCACCpAQAAxgIAMKoBAAANABCrAQAAxgIAMKwBAQAAAAGvAUAAmgIAIcQBAADIAuMBIsoBQACaAgAh3QEBAJMCACHeAQEAAAAB3wEBAJQCACHgARAAxwIAIeEBAQCTAgAh4wEBAJQCACHkAQEAlAIAIeUBAQCUAgAh5gEBAJQCACHnAUAAyQIAIegBAQCUAgAh6QFAAMkCACECAAAADwAgFgAArgMAIAIAAACqAwAgFgAAqwMAIBOpAQAAqQMAMKoBAACqAwAQqwEAAKkDADCsAQEAkwIAIa8BQACaAgAhxAEAAMgC4wEiygFAAJoCACHdAQEAkwIAId4BAQCTAgAh3wEBAJQCACHgARAAxwIAIeEBAQCTAgAh4wEBAJQCACHkAQEAlAIAIeUBAQCUAgAh5gEBAJQCACHnAUAAyQIAIegBAQCUAgAh6QFAAMkCACETqQEAAKkDADCqAQAAqgMAEKsBAACpAwAwrAEBAJMCACGvAUAAmgIAIcQBAADIAuMBIsoBQACaAgAh3QEBAJMCACHeAQEAkwIAId8BAQCUAgAh4AEQAMcCACHhAQEAkwIAIeMBAQCUAgAh5AEBAJQCACHlAQEAlAIAIeYBAQCUAgAh5wFAAMkCACHoAQEAlAIAIekBQADJAgAhD6wBAQDVAgAhrwFAANYCACHEAQAArAPjASLKAUAA1gIAId4BAQDVAgAh3wEBAOECACHgARAAnQMAIeEBAQDVAgAh4wEBAOECACHkAQEA4QIAIeUBAQDhAgAh5gEBAOECACHnAUAArQMAIegBAQDhAgAh6QFAAK0DACEB_AEAAADjAQIB_AFAAAAAAQ-sAQEA1QIAIa8BQADWAgAhxAEAAKwD4wEiygFAANYCACHeAQEA1QIAId8BAQDhAgAh4AEQAJ0DACHhAQEA1QIAIeMBAQDhAgAh5AEBAOECACHlAQEA4QIAIeYBAQDhAgAh5wFAAK0DACHoAQEA4QIAIekBQACtAwAhD6wBAQAAAAGvAUAAAAABxAEAAADjAQLKAUAAAAAB3gEBAAAAAd8BAQAAAAHgARAAAAAB4QEBAAAAAeMBAQAAAAHkAQEAAAAB5QEBAAAAAeYBAQAAAAHnAUAAAAAB6AEBAAAAAekBQAAAAAEKCAAAsQMAIAoAALIDACCsAQEAAAABrgEBAAAAAa8BQAAAAAHEAQAAAPEBAsoBQAAAAAHtAUAAAAAB7gECAAAAAe8BEAAAAAEDHQAAygQAIPkBAADLBAAg_wEAAAUAIAQdAACiAwAw-QEAAKMDADD7AQAApQMAIP8BAACmAwAwEgUAAOYDACALAADnAwAgDAAA6AMAIA0AAOkDACCsAQEAAAABrwFAAAAAAcQBAAAA1wECyAEgAAAAAcoBQAAAAAHOAQEAAAABzwEBAAAAAdABAQAAAAHRAQEAAAAB0gEQAAAAAdMBAgAAAAHUAQgAAAAB1QEAAOUDACDXAQEAAAABAgAAAAUAIB0AAOQDACADAAAABQAgHQAA5AMAIB4AAMADACABFgAAyQQAMBcFAADRAgAgBgAAwAIAIAsAAJwCACAMAACdAgAgDQAAnwIAIKkBAADOAgAwqgEAAAMAEKsBAADOAgAwrAEBAAAAAa8BQACaAgAhxAEAANAC1wEiyAEgAJgCACHKAUAAmgIAIc4BAQCTAgAhzwEBAAAAAdABAQCTAgAh0QEBAJMCACHSARAAxwIAIdMBAgCZAgAh1AEIAM8CACHVAQAAowIAINcBAQCTAgAh2AEBAJMCACECAAAABQAgFgAAwAMAIAIAAAC7AwAgFgAAvAMAIBKpAQAAugMAMKoBAAC7AwAQqwEAALoDADCsAQEAkwIAIa8BQACaAgAhxAEAANAC1wEiyAEgAJgCACHKAUAAmgIAIc4BAQCTAgAhzwEBAJMCACHQAQEAkwIAIdEBAQCTAgAh0gEQAMcCACHTAQIAmQIAIdQBCADPAgAh1QEAAKMCACDXAQEAkwIAIdgBAQCTAgAhEqkBAAC6AwAwqgEAALsDABCrAQAAugMAMKwBAQCTAgAhrwFAAJoCACHEAQAA0ALXASLIASAAmAIAIcoBQACaAgAhzgEBAJMCACHPAQEAkwIAIdABAQCTAgAh0QEBAJMCACHSARAAxwIAIdMBAgCZAgAh1AEIAM8CACHVAQAAowIAINcBAQCTAgAh2AEBAJMCACEOrAEBANUCACGvAUAA1gIAIcQBAAC_A9cBIsgBIADlAgAhygFAANYCACHOAQEA1QIAIc8BAQDVAgAh0AEBANUCACHRAQEA1QIAIdIBEACdAwAh0wECAOYCACHUAQgAvQMAIdUBAAC-AwAg1wEBANUCACEF_AEIAAAAAYMCCAAAAAGEAggAAAABhQIIAAAAAYYCCAAAAAEC_AEBAAAABIICAQAAAAUB_AEAAADXAQISBQAAwQMAIAsAAMIDACAMAADDAwAgDQAAxAMAIKwBAQDVAgAhrwFAANYCACHEAQAAvwPXASLIASAA5QIAIcoBQADWAgAhzgEBANUCACHPAQEA1QIAIdABAQDVAgAh0QEBANUCACHSARAAnQMAIdMBAgDmAgAh1AEIAL0DACHVAQAAvgMAINcBAQDVAgAhBR0AALcEACAeAADHBAAg-QEAALgEACD6AQAAxgQAIP8BAABTACALHQAA2QMAMB4AAN0DADD5AQAA2gMAMPoBAADbAwAw-wEAANwDACD8AQAAlwMAMP0BAACXAwAw_gEAAJcDADD_AQAAlwMAMIACAADeAwAwgQIAAJoDADALHQAAzgMAMB4AANIDADD5AQAAzwMAMPoBAADQAwAw-wEAANEDACD8AQAAiQMAMP0BAACJAwAw_gEAAIkDADD_AQAAiQMAMIACAADTAwAwgQIAAIwDADALHQAAxQMAMB4AAMkDADD5AQAAxgMAMPoBAADHAwAw-wEAAMgDACD8AQAA8AIAMP0BAADwAgAw_gEAAPACADD_AQAA8AIAMIACAADKAwAwgQIAAPMCADAEBwAA2QIAIKwBAQAAAAGtAQEAAAABrwFAAAAAAQIAAAAYACAdAADNAwAgAwAAABgAIB0AAM0DACAeAADMAwAgARYAAMUEADACAAAAGAAgFgAAzAMAIAIAAAD0AgAgFgAAywMAIAOsAQEA1QIAIa0BAQDVAgAhrwFAANYCACEEBwAA1wIAIKwBAQDVAgAhrQEBANUCACGvAUAA1gIAIQQHAADZAgAgrAEBAAAAAa0BAQAAAAGvAUAAAAABBwcAANgDACCsAQEAAAABrQEBAAAAAa8BQAAAAAHKAUAAAAAB1AECAAAAAdwBAQAAAAECAAAAFAAgHQAA1wMAIAMAAAAUACAdAADXAwAgHgAA1QMAIAEWAADEBAAwAgAAABQAIBYAANUDACACAAAAjQMAIBYAANQDACAGrAEBANUCACGtAQEA1QIAIa8BQADWAgAhygFAANYCACHUAQIA5gIAIdwBAQDVAgAhBwcAANYDACCsAQEA1QIAIa0BAQDVAgAhrwFAANYCACHKAUAA1gIAIdQBAgDmAgAh3AEBANUCACEFHQAAvwQAIB4AAMIEACD5AQAAwAQAIPoBAADBBAAg_wEAAMcBACAHBwAA2AMAIKwBAQAAAAGtAQEAAAABrwFAAAAAAcoBQAAAAAHUAQIAAAAB3AEBAAAAAQMdAAC_BAAg-QEAAMAEACD_AQAAxwEAIAoHAADjAwAgCgAAsgMAIKwBAQAAAAGtAQEAAAABrwFAAAAAAcQBAAAA8QECygFAAAAAAe0BQAAAAAHuAQIAAAAB7wEQAAAAAQIAAAALACAdAADiAwAgAwAAAAsAIB0AAOIDACAeAADgAwAgARYAAL4EADACAAAACwAgFgAA4AMAIAIAAACbAwAgFgAA3wMAIAisAQEA1QIAIa0BAQDVAgAhrwFAANYCACHEAQAAngPxASLKAUAA1gIAIe0BQADWAgAh7gECAOYCACHvARAAnQMAIQoHAADhAwAgCgAAoQMAIKwBAQDVAgAhrQEBANUCACGvAUAA1gIAIcQBAACeA_EBIsoBQADWAgAh7QFAANYCACHuAQIA5gIAIe8BEACdAwAhBR0AALkEACAeAAC8BAAg-QEAALoEACD6AQAAuwQAIP8BAADHAQAgCgcAAOMDACAKAACyAwAgrAEBAAAAAa0BAQAAAAGvAUAAAAABxAEAAADxAQLKAUAAAAAB7QFAAAAAAe4BAgAAAAHvARAAAAABAx0AALkEACD5AQAAugQAIP8BAADHAQAgEgUAAOYDACALAADnAwAgDAAA6AMAIA0AAOkDACCsAQEAAAABrwFAAAAAAcQBAAAA1wECyAEgAAAAAcoBQAAAAAHOAQEAAAABzwEBAAAAAdABAQAAAAHRAQEAAAAB0gEQAAAAAdMBAgAAAAHUAQgAAAAB1QEAAOUDACDXAQEAAAABAfwBAQAAAAQDHQAAtwQAIPkBAAC4BAAg_wEAAFMAIAQdAADZAwAw-QEAANoDADD7AQAA3AMAIP8BAACXAwAwBB0AAM4DADD5AQAAzwMAMPsBAADRAwAg_wEAAIkDADAEHQAAxQMAMPkBAADGAwAw-wEAAMgDACD_AQAA8AIAMAQdAACzAwAw-QEAALQDADD7AQAAtgMAIP8BAAC3AwAwBB0AAJMDADD5AQAAlAMAMPsBAACWAwAg_wEAAJcDADAEHQAAhQMAMPkBAACGAwAw-wEAAIgDACD_AQAAiQMAMAQdAAD4AgAw-QEAAPkCADD7AQAA-wIAIP8BAAD8AgAwBB0AAOwCADD5AQAA7QIAMPsBAADvAgAg_wEAAPACADAAAAAAAAAAAAAABR0AALIEACAeAAC1BAAg-QEAALMEACD6AQAAtAQAIP8BAADHAQAgAx0AALIEACD5AQAAswQAIP8BAADHAQAgAAAAAAAAAAAAAAUdAACtBAAgHgAAsAQAIPkBAACuBAAg-gEAAK8EACD_AQAACwAgAx0AAK0EACD5AQAArgQAIP8BAAALACAAAAAAAAALHQAAjgQAMB4AAJIEADD5AQAAjwQAMPoBAACQBAAw-wEAAJEEACD8AQAAtwMAMP0BAAC3AwAw_gEAALcDADD_AQAAtwMAMIACAACTBAAwgQIAALoDADASBgAA-gMAIAsAAOcDACAMAADoAwAgDQAA6QMAIKwBAQAAAAGvAUAAAAABxAEAAADXAQLIASAAAAABygFAAAAAAc4BAQAAAAHPAQEAAAAB0AEBAAAAAdEBAQAAAAHSARAAAAAB0wECAAAAAdQBCAAAAAHVAQAA5QMAINgBAQAAAAECAAAABQAgHQAAlgQAIAMAAAAFACAdAACWBAAgHgAAlQQAIAEWAACsBAAwAgAAAAUAIBYAAJUEACACAAAAuwMAIBYAAJQEACAOrAEBANUCACGvAUAA1gIAIcQBAAC_A9cBIsgBIADlAgAhygFAANYCACHOAQEA1QIAIc8BAQDVAgAh0AEBANUCACHRAQEA1QIAIdIBEACdAwAh0wECAOYCACHUAQgAvQMAIdUBAAC-AwAg2AEBANUCACESBgAA-QMAIAsAAMIDACAMAADDAwAgDQAAxAMAIKwBAQDVAgAhrwFAANYCACHEAQAAvwPXASLIASAA5QIAIcoBQADWAgAhzgEBANUCACHPAQEA1QIAIdABAQDVAgAh0QEBANUCACHSARAAnQMAIdMBAgDmAgAh1AEIAL0DACHVAQAAvgMAINgBAQDVAgAhEgYAAPoDACALAADnAwAgDAAA6AMAIA0AAOkDACCsAQEAAAABrwFAAAAAAcQBAAAA1wECyAEgAAAAAcoBQAAAAAHOAQEAAAABzwEBAAAAAdABAQAAAAHRAQEAAAAB0gEQAAAAAdMBAgAAAAHUAQgAAAAB1QEAAOUDACDYAQEAAAABBB0AAI4EADD5AQAAjwQAMPsBAACRBAAg_wEAALcDADAAAAAAAAAAAAUdAACnBAAgHgAAqgQAIPkBAACoBAAg-gEAAKkEACD_AQAAxwEAIAMdAACnBAAg-QEAAKgEACD_AQAAxwEAIAkDAADvAwAgCwAA8AMAIAwAAPEDACAOAADyAwAgDwAA8wMAIL0BAADbAgAgvgEAANsCACC_AQAA2wIAIMABAADbAgAgBQUAAKYEACAGAACiBAAgCwAA8AMAIAwAAPEDACANAADzAwAgAwcAAKIEACAIAACjBAAgCgAApQQAIAABAwAA7wMAIBMDAADqAwAgCwAA6wMAIAwAAOwDACAPAADuAwAgrAEBAAAAAa8BQAAAAAG7AQEAAAABvAEBAAAAAb0BAQAAAAG-AQEAAAABvwEBAAAAAcABAQAAAAHCAQAAAMIBAsQBAAAAxAECxgEAAADGAQLHASAAAAAByAEgAAAAAckBAgAAAAHKAUAAAAABAgAAAMcBACAdAACnBAAgAwAAAMoBACAdAACnBAAgHgAAqwQAIBUAAADKAQAgAwAA5wIAIAsAAOgCACAMAADpAgAgDwAA6wIAIBYAAKsEACCsAQEA1QIAIa8BQADWAgAhuwEBANUCACG8AQEA1QIAIb0BAQDhAgAhvgEBAOECACG_AQEA4QIAIcABAQDhAgAhwgEAAOICwgEixAEAAOMCxAEixgEAAOQCxgEixwEgAOUCACHIASAA5QIAIckBAgDmAgAhygFAANYCACETAwAA5wIAIAsAAOgCACAMAADpAgAgDwAA6wIAIKwBAQDVAgAhrwFAANYCACG7AQEA1QIAIbwBAQDVAgAhvQEBAOECACG-AQEA4QIAIb8BAQDhAgAhwAEBAOECACHCAQAA4gLCASLEAQAA4wLEASLGAQAA5ALGASLHASAA5QIAIcgBIADlAgAhyQECAOYCACHKAUAA1gIAIQ6sAQEAAAABrwFAAAAAAcQBAAAA1wECyAEgAAAAAcoBQAAAAAHOAQEAAAABzwEBAAAAAdABAQAAAAHRAQEAAAAB0gEQAAAAAdMBAgAAAAHUAQgAAAAB1QEAAOUDACDYAQEAAAABCwcAAOMDACAIAACxAwAgrAEBAAAAAa0BAQAAAAGuAQEAAAABrwFAAAAAAcQBAAAA8QECygFAAAAAAe0BQAAAAAHuAQIAAAAB7wEQAAAAAQIAAAALACAdAACtBAAgAwAAAAkAIB0AAK0EACAeAACxBAAgDQAAAAkAIAcAAOEDACAIAACgAwAgFgAAsQQAIKwBAQDVAgAhrQEBANUCACGuAQEA1QIAIa8BQADWAgAhxAEAAJ4D8QEiygFAANYCACHtAUAA1gIAIe4BAgDmAgAh7wEQAJ0DACELBwAA4QMAIAgAAKADACCsAQEA1QIAIa0BAQDVAgAhrgEBANUCACGvAUAA1gIAIcQBAACeA_EBIsoBQADWAgAh7QFAANYCACHuAQIA5gIAIe8BEACdAwAhEwsAAOsDACAMAADsAwAgDgAA7QMAIA8AAO4DACCsAQEAAAABrwFAAAAAAbsBAQAAAAG8AQEAAAABvQEBAAAAAb4BAQAAAAG_AQEAAAABwAEBAAAAAcIBAAAAwgECxAEAAADEAQLGAQAAAMYBAscBIAAAAAHIASAAAAAByQECAAAAAcoBQAAAAAECAAAAxwEAIB0AALIEACADAAAAygEAIB0AALIEACAeAAC2BAAgFQAAAMoBACALAADoAgAgDAAA6QIAIA4AAOoCACAPAADrAgAgFgAAtgQAIKwBAQDVAgAhrwFAANYCACG7AQEA1QIAIbwBAQDVAgAhvQEBAOECACG-AQEA4QIAIb8BAQDhAgAhwAEBAOECACHCAQAA4gLCASLEAQAA4wLEASLGAQAA5ALGASLHASAA5QIAIcgBIADlAgAhyQECAOYCACHKAUAA1gIAIRMLAADoAgAgDAAA6QIAIA4AAOoCACAPAADrAgAgrAEBANUCACGvAUAA1gIAIbsBAQDVAgAhvAEBANUCACG9AQEA4QIAIb4BAQDhAgAhvwEBAOECACHAAQEA4QIAIcIBAADiAsIBIsQBAADjAsQBIsYBAADkAsYBIscBIADlAgAhyAEgAOUCACHJAQIA5gIAIcoBQADWAgAhBawBAQAAAAGvAUAAAAABuwEBAAAAAcoBQAAAAAHPAQEAAAABAgAAAFMAIB0AALcEACATAwAA6gMAIAwAAOwDACAOAADtAwAgDwAA7gMAIKwBAQAAAAGvAUAAAAABuwEBAAAAAbwBAQAAAAG9AQEAAAABvgEBAAAAAb8BAQAAAAHAAQEAAAABwgEAAADCAQLEAQAAAMQBAsYBAAAAxgECxwEgAAAAAcgBIAAAAAHJAQIAAAABygFAAAAAAQIAAADHAQAgHQAAuQQAIAMAAADKAQAgHQAAuQQAIB4AAL0EACAVAAAAygEAIAMAAOcCACAMAADpAgAgDgAA6gIAIA8AAOsCACAWAAC9BAAgrAEBANUCACGvAUAA1gIAIbsBAQDVAgAhvAEBANUCACG9AQEA4QIAIb4BAQDhAgAhvwEBAOECACHAAQEA4QIAIcIBAADiAsIBIsQBAADjAsQBIsYBAADkAsYBIscBIADlAgAhyAEgAOUCACHJAQIA5gIAIcoBQADWAgAhEwMAAOcCACAMAADpAgAgDgAA6gIAIA8AAOsCACCsAQEA1QIAIa8BQADWAgAhuwEBANUCACG8AQEA1QIAIb0BAQDhAgAhvgEBAOECACG_AQEA4QIAIcABAQDhAgAhwgEAAOICwgEixAEAAOMCxAEixgEAAOQCxgEixwEgAOUCACHIASAA5QIAIckBAgDmAgAhygFAANYCACEIrAEBAAAAAa0BAQAAAAGvAUAAAAABxAEAAADxAQLKAUAAAAAB7QFAAAAAAe4BAgAAAAHvARAAAAABEwMAAOoDACALAADrAwAgDgAA7QMAIA8AAO4DACCsAQEAAAABrwFAAAAAAbsBAQAAAAG8AQEAAAABvQEBAAAAAb4BAQAAAAG_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_A9cBIsgBIADlAgAhygFAANYCACHOAQEA1QIAIc8BAQDVAgAh0AEBANUCACHRAQEA1QIAIdIBEACdAwAh0wECAOYCACHUAQgAvQMAIdUBAAC-AwAg1wEBANUCACHYAQEA1QIAIRMFAADBAwAgBgAA-QMAIAsAAMIDACAMAADDAwAgrAEBANUCACGvAUAA1gIAIcQBAAC_A9cBIsgBIADlAgAhygFAANYCACHOAQEA1QIAIc8BAQDVAgAh0AEBANUCACHRAQEA1QIAIdIBEACdAwAh0wECAOYCACHUAQgAvQMAIdUBAAC-AwAg1wEBANUCACHYAQEA1QIAIQMAAADKAQAgHQAA2wQAIB4AAOIEACAVAAAAygEAIAMAAOcCACALAADoAgAgDAAA6QIAIA4AAOoCACAWAADiBAAgrAEBANUCACGvAUAA1gIAIbsBAQDVAgAhvAEBANUCACG9AQEA4QIAIb4BAQDhAgAhvwEBAOECACHAAQEA4QIAIcIBAADiAsIBIsQBAADjAsQBIsYBAADkAsYBIscBIADlAgAhyAEgAOUCACHJAQIA5gIAIcoBQADWAgAhEwMAAOcCACALAADoAgAgDAAA6QIAIA4AAOoCACCsAQEA1QIAIa8BQADWAgAhuwEBANUCACG8AQEA1QIAIb0BAQDhAgAhvgEBAOECACG_AQEA4QIAIcABAQDhAgAhwgEAAOICwgEixAEAAOMCxAEixgEAAOQCxgEixwEgAOUCACHIASAA5QIAIckBAgDmAgAhygFAANYCACEBEAACBgMGAwQADAsdBgweCQ4hAQ8iCgYEAAsFAAQGAAILDAYMFQkNGQoCAwcDBAAFAQMIAAQEAAgHAAIIAAMKEAcBCQAGAQoRAAIHAAIIAAMCBwACCAADAwsaAAwbAA0cAAUDIwALJAAMJQAOJgAPJwAAARAAAgEQAAIDBAARIwASJAATAAAAAwQAESMAEiQAEwIHAAIIAAMCBwACCAADBQQAGCMAGyQAHDUAGTYAGgAAAAAABQQAGCMAGyQAHDUAGTYAGgAAAwQAISMAIiQAIwAAAAMEACEjACIkACMAAAADBAApIwAqJAArAAAAAwQAKSMAKiQAKwEJAAYBCQAGBQQAMCMAMyQANDUAMTYAMgAAAAAABQQAMCMAMyQANDUAMTYAMgIHAAIIAAMCBwACCAADBQQAOSMAPCQAPTUAOjYAOwAAAAAABQQAOSMAPCQAPTUAOjYAOwIFAAQGAAICBQAEBgACBQQAQiMARSQARjUAQzYARAAAAAAABQQAQiMARSQARjUAQzYARAAABQQASyMATiQATzUATDYATQAAAAAABQQASyMATiQATzUATDYATQIHAAIIAAMCBwACCAADAwQAVCMAVSQAVgAAAAMEAFQjAFUkAFYRAgESKAETKQEUKgEVKwEXLQEYLw0ZMA4aMgEbNA0cNQ8fNgEgNwEhOA0lOxAmPBQnPQYoPgYpPwYqQAYrQQYsQwYtRQ0uRhUvSAYwSg0xSxYyTAYzTQY0Tg03URc4Uh05VAQ6VQQ7WAQ8WQQ9WgQ-XAQ_Xg1AXx5BYQRCYw1DZB9EZQRFZgRGZw1HaiBIayRJbSVKbiVLcSVMciVNcyVOdSVPdw1QeCZReiVSfA1TfSdUfiVVfyVWgAENV4MBKFiEASxZhQEHWoYBB1uHAQdciAEHXYkBB16LAQdfjQENYI4BLWGQAQdikgENY5MBLmSUAQdllQEHZpYBDWeZAS9omgE1aZsBCWqcAQlrnQEJbJ4BCW2fAQluoQEJb6MBDXCkATZxpgEJcqgBDXOpATd0qgEJdasBCXasAQ13rwE4eLABPnmxAQN6sgEDe7MBA3y0AQN9tQEDfrcBA3-5AQ2AAboBP4EBvAEDggG-AQ2DAb8BQIQBwAEDhQHBAQOGAcIBDYcBxQFBiAHGAUeJAcgBAooByQECiwHMAQKMAc0BAo0BzgECjgHQAQKPAdIBDZAB0wFIkQHVAQKSAdcBDZMB2AFJlAHZAQKVAdoBApYB2wENlwHeAUqYAd8BUJkB4AEKmgHhAQqbAeIBCpwB4wEKnQHkAQqeAeYBCp8B6AENoAHpAVGhAesBCqIB7QENowHuAVKkAe8BCqUB8AEKpgHxAQ2nAfQBU6gB9QFX"
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
app.use(notFound_default);
app.use(globalErrorHandler_default);
var app_default = app;

// api/index.ts
var index_default = app_default;
export {
  index_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FwcC50cyIsICIuLi9zcmMvY29uZmlnL2luZGV4LnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL25vdEZvdW5kLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudC50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2ludGVybmFsL2NsYXNzLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXMudHMiLCAiLi4vc3JjL3V0aWxzL2FwcEVycm9yLnRzIiwgIi4uL3NyYy9saWIvcHJpc21hLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguc2VydmljZS50cyIsICIuLi9zcmMvbGliL2dvb2dsZUF1dGgudHMiLCAiLi4vc3JjL3V0aWxzL2p3dC50cyIsICIuLi9zcmMvdXRpbHMvY2F0Y2hBc3luYy50cyIsICIuLi9zcmMvdXRpbHMvc2VuZFJlc3BvbnNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdC50cyIsICIuLi9zcmMvbWlkZGxld2FyZS9hdXRoLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL2xpYi9jbG91ZGluYXJ5LnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jb250YWN0L2NvbnRhY3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvdXRpbHMvZW1haWwudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9saWIvc3NsY29tbWVyei50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcmV2aWV3L3Jldmlldy52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL3NsdWdpZnkudHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2Uuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3Qucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy93aXNobGlzdC93aXNobGlzdC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3dpc2hsaXN0L3dpc2hsaXN0LnZhbGlkYXRpb24udHMiLCAiaW5kZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCBleHByZXNzLCB7IEFwcGxpY2F0aW9uLCBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcclxuaW1wb3J0IGNvcnMgZnJvbSBcImNvcnNcIjtcclxuaW1wb3J0IGNvb2tpZVBhcnNlciBmcm9tIFwiY29va2llLXBhcnNlclwiO1xyXG5pbXBvcnQgaGVsbWV0IGZyb20gXCJoZWxtZXRcIjtcclxuaW1wb3J0IG1vcmdhbiBmcm9tIFwibW9yZ2FuXCI7XHJcbmltcG9ydCByYXRlTGltaXQgZnJvbSBcImV4cHJlc3MtcmF0ZS1saW1pdFwiO1xyXG5pbXBvcnQgY29uZmlnIGZyb20gXCIuL2NvbmZpZ1wiO1xyXG5pbXBvcnQgbm90Rm91bmRIYW5kbGVyIGZyb20gXCIuL21pZGRsZXdhcmUvbm90Rm91bmRcIjtcclxuaW1wb3J0IGdsb2JhbEVycm9ySGFuZGxlciBmcm9tIFwiLi9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlclwiO1xyXG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi9saWIvcHJpc21hXCI7XHJcbmltcG9ydCB7IGF1dGhSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyB1c2VyUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy91c2VyL3VzZXIucm91dGVcIjtcclxuaW1wb3J0IHsgdXBsb2FkUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMucm91dGVcIjtcclxuaW1wb3J0IHsgY29udGFjdFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvY29udGFjdC9jb250YWN0LnJvdXRlXCI7XHJcbmltcG9ydCB7IGJvb2tpbmdSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyByZXZpZXdSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3Jldmlldy9yZXZpZXcucm91dGVcIjtcclxuaW1wb3J0IHsgY2F0ZWdvcnlSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlXCI7XHJcbmltcG9ydCB7IHBhY2thZ2VSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBibG9nUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9ibG9nL2Jsb2cucm91dGVcIjtcclxuaW1wb3J0IHsgZGFzaGJvYXJkUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLnJvdXRlXCI7XHJcbmltcG9ydCB7IHBheW1lbnRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3BheW1lbnQvcGF5bWVudC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyB3aXNobGlzdFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvd2lzaGxpc3Qvd2lzaGxpc3Qucm91dGVcIjtcclxuXHJcbmNvbnN0IGFwcDogQXBwbGljYXRpb24gPSBleHByZXNzKCk7XHJcblxyXG4vLyBSZW5kZXIvUmFpbHdheSBzaXQgYmVoaW5kIGEgcmV2ZXJzZSBwcm94eSBcdTIwMTQgbXVzdCBiZSBzZXQgYmVmb3JlIHRoZVxyXG4vLyByYXRlIGxpbWl0ZXIgb3IgaXQgd2lsbCBzZWUgdGhlIHByb3h5J3MgSVAgZm9yIGV2ZXJ5IHJlcXVlc3QgYW5kXHJcbi8vIGVmZmVjdGl2ZWx5IHJhdGUtbGltaXQgYWxsIHVzZXJzIHRvZ2V0aGVyLlxyXG5hcHAuc2V0KFwidHJ1c3QgcHJveHlcIiwgMSk7XHJcblxyXG5hcHAudXNlKGhlbG1ldCgpKTtcclxuXHJcbmFwcC51c2UoXHJcbiAgY29ycyh7XHJcbiAgICAvLyBEZXYgaG9zdCAobG9jYWxob3N0KSArIHByb2QgaG9zdCAoVmVyY2VsKSBib3RoIGFsbG93ZWQgc2lkZS1ieS1zaWRlLlxyXG4gICAgLy8gQ29uZmlnIHJlc29sdmVzIHNlbnNpYmxlIGRlZmF1bHRzIHNvIG5laXRoZXIgY2FuIGJlIGZhbHN5LlxyXG4gICAgb3JpZ2luOiBbY29uZmlnLmZyb250ZW5kX3VybF9kZXYsIGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZF0uZmlsdGVyKFxyXG4gICAgICAobyk6IG8gaXMgc3RyaW5nID0+IEJvb2xlYW4obyksXHJcbiAgICApLFxyXG4gICAgY3JlZGVudGlhbHM6IHRydWUsXHJcbiAgfSksXHJcbik7XHJcblxyXG5pZiAoY29uZmlnLm5vZGVfZW52ICE9PSBcInByb2R1Y3Rpb25cIikge1xyXG4gIGFwcC51c2UobW9yZ2FuKFwiZGV2XCIpKTtcclxufVxyXG5cclxuYXBwLnVzZShleHByZXNzLmpzb24oeyBsaW1pdDogXCIxMDBrYlwiIH0pKTtcclxuYXBwLnVzZShleHByZXNzLnVybGVuY29kZWQoeyBleHRlbmRlZDogdHJ1ZSwgbGltaXQ6IFwiMTAwa2JcIiB9KSk7XHJcbmFwcC51c2UoY29va2llUGFyc2VyKCkpO1xyXG5cclxuLy8gU3RyaWN0IGxpbWl0ZXIgXHUyMDE0IGF1dGggZW5kcG9pbnRzLCBicnV0ZS1mb3JjZSBwcm90ZWN0aW9uXHJcbmNvbnN0IGF1dGhMaW1pdGVyID0gcmF0ZUxpbWl0KHtcclxuICB3aW5kb3dNczogMTUgKiA2MCAqIDEwMDAsXHJcbiAgbGltaXQ6IDUsXHJcbiAgc3RhbmRhcmRIZWFkZXJzOiB0cnVlLFxyXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxyXG4gIG1lc3NhZ2U6IHtcclxuICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSBhdHRlbXB0cy4gUGxlYXNlIHRyeSBhZ2FpbiBpbiAxNSBtaW51dGVzLlwiLFxyXG4gIH0sXHJcbn0pO1xyXG5cclxuLy8gU3RhbmRhcmQgbGltaXRlciBcdTIwMTQgZXZlcnl0aGluZyBlbHNlIHVuZGVyIC9hcGlcclxuY29uc3QgYXBpTGltaXRlciA9IHJhdGVMaW1pdCh7XHJcbiAgd2luZG93TXM6IDE1ICogNjAgKiAxMDAwLFxyXG4gIGxpbWl0OiAxMDAsXHJcbiAgc3RhbmRhcmRIZWFkZXJzOiB0cnVlLFxyXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxyXG4gIG1lc3NhZ2U6IHtcclxuICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgbWVzc2FnZTogXCJUb28gbWFueSByZXF1ZXN0cy4gUGxlYXNlIHRyeSBhZ2FpbiBsYXRlci5cIixcclxuICB9LFxyXG59KTtcclxuXHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvbG9naW5cIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL3JlZ2lzdGVyXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9kZW1vLWxvZ2luXCIsIGF1dGhMaW1pdGVyKTtcclxuYXBwLnVzZShcIi9hcGkvYXV0aC9nb29nbGVcIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaVwiLCBhcGlMaW1pdGVyKTtcclxuXHJcbi8vIFJvb3Qgcm91dGVcclxuYXBwLmdldChcIi9cIiwgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkgPT4ge1xyXG4gIHJlcy5zZW5kKFwiV2VsY29tZSB0byB0aGUgVHJpcFZlcnNlIEFQSSFcIik7XHJcbn0pO1xyXG5cclxuLy8gSGVhbHRoIGNoZWNrIFx1MjAxNCByZWFsIERCIGNvbm5lY3Rpdml0eSBjaGVjaywgbm90IGEgc3RhdGljIDIwMC5cclxuYXBwLmdldChcIi9oZWFsdGhcIiwgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkgPT4ge1xyXG4gIHRyeSB7XHJcbiAgICBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3YFNFTEVDVCAxYDtcclxuICAgIHJlcy5zdGF0dXMoMjAwKS5qc29uKHtcclxuICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgbWVzc2FnZTogXCJPS1wiLFxyXG4gICAgICBkYjogXCJjb25uZWN0ZWRcIixcclxuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICB9KTtcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgcmVzLnN0YXR1cyg1MDMpLmpzb24oe1xyXG4gICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgbWVzc2FnZTogXCJTZXJ2aWNlIHVuYXZhaWxhYmxlXCIsXHJcbiAgICAgIGRiOiBcImRpc2Nvbm5lY3RlZFwiLFxyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgIH0pO1xyXG4gIH1cclxufSk7XHJcblxyXG4vLyBcdTI1MDBcdTI1MDAgRmVhdHVyZSByb3V0ZXMgcmVnaXN0ZXIgaGVyZSBhcyBlYWNoIG1vZHVsZSBpcyBidWlsdCBcdTI1MDBcdTI1MDBcclxuYXBwLnVzZShcIi9hcGkvYXV0aFwiLCBhdXRoUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvdXNlcnNcIiwgdXNlclJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3VwbG9hZHNcIiwgdXBsb2FkUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvY29udGFjdFwiLCBjb250YWN0Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvY2F0ZWdvcmllc1wiLCBjYXRlZ29yeVJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3BhY2thZ2VzXCIsIHBhY2thZ2VSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9yZXZpZXdzXCIsIHJldmlld1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Jvb2tpbmdzXCIsIGJvb2tpbmdSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9ibG9nXCIsIGJsb2dSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9kYXNoYm9hcmRcIiwgZGFzaGJvYXJkUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvcGF5bWVudHNcIiwgcGF5bWVudFJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3dpc2hsaXN0XCIsIHdpc2hsaXN0Um91dGVzKTtcclxuXHJcbmFwcC51c2Uobm90Rm91bmRIYW5kbGVyKTtcclxuYXBwLnVzZShnbG9iYWxFcnJvckhhbmRsZXIpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgYXBwO1xyXG4iLCAiaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuZG90ZW52LmNvbmZpZyh7XG4gIHF1aWV0OiB0cnVlLFxuICBwYXRoOiBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgXCIuZW52XCIpLFxufSk7XG5cbi8vIEV2ZXJ5IG1vZHVsZSByZWFkcyBjb25maWcgdGhyb3VnaCB0aGlzIHZhbGlkYXRlZCBvYmplY3QsIG5ldmVyXG4vLyBwcm9jZXNzLmVudiBkaXJlY3RseSBcdTIwMTQgYSBtaXNzaW5nL21hbGZvcm1lZCB2YXIgZmFpbHMgbG91ZGx5IGF0IGJvb3Rcbi8vIGluc3RlYWQgb2Ygc3VyZmFjaW5nIGFzIGEgY29uZnVzaW5nIHJ1bnRpbWUgZXJyb3IgbWlkLXJlcXVlc3QuXG5jb25zdCBlbnZTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIFBPUlQ6IHouc3RyaW5nKCkuZGVmYXVsdChcIjQwMDBcIiksXG4gIE5PREVfRU5WOiB6LmVudW0oW1wiZGV2ZWxvcG1lbnRcIiwgXCJwcm9kdWN0aW9uXCJdKS5kZWZhdWx0KFwiZGV2ZWxvcG1lbnRcIiksXG5cbiAgLy8gRnJvbnRlbmQgb3JpZ2lucyBmb3IgQ09SUyArIHBheW1lbnQgcmVkaXJlY3RzLiBUaGUgZnJvbnRlbmQgbWF5IG5vdCBiZVxuICAvLyBkZXBsb3llZCB5ZXQgKG9yIG1heSBiZSByZWJ1aWx0KSwgc28gYm90aCBhcmUgb3B0aW9uYWw6IHRoZSBiYWNrZW5kIG11c3RcbiAgLy8gbmV2ZXIgcmVmdXNlIHRvIGJvb3QganVzdCBiZWNhdXNlIGEgVUkgaG9zdCBpc24ndCBsaXZlLiBSb3V0ZXMgdGhhdCBuZWVkIGFcbiAgLy8gcmVhbCBvcmlnaW4gKHBheW1lbnQgY2FsbGJhY2sgcmVkaXJlY3RzKSBmYWxsIGJhY2sgdG8gdGhlIGJhY2tlbmQgVVJMLlxuICBGUk9OVEVORF9VUkxfREVWOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG4gIEZST05URU5EX1VSTF9QUk9EOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG5cbiAgREFUQUJBU0VfVVJMOiB6LnN0cmluZygpLm1pbigxLCBcIkRBVEFCQVNFX1VSTCBpcyByZXF1aXJlZFwiKSxcblxuICBCQ1JZUFRfU0FMVF9ST1VORFM6IHouc3RyaW5nKCkuZGVmYXVsdChcIjEwXCIpLFxuXG4gIC8vIE9wdGlvbmFsIGFkbWluIGNyZWRlbnRpYWxzIHVzZWQgYnkgdGhlIHNlZWQgc2NyaXB0IChTdGVwIDEzKS4gRmFsbHMgYmFja1xuICAvLyB0byBkZW1vLWFkbWluQHRyaXB2ZXJzZS5jb20gLyBkZW1vMTIzIHdoZW4gdW5zZXQuXG4gIEFETUlOX0VNQUlMOiB6LnN0cmluZygpLmVtYWlsKCkub3B0aW9uYWwoKSxcbiAgQURNSU5fUEFTU1dPUkQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG5cbiAgLy8gU1NMQ29tbWVyeiAoU3RlcCAxNikgXHUyMDE0IHNhbmRib3ggc3RvcmUgY3JlZHMgdW50aWwgZ28tbGl2ZS4gU1NMX0NPTU1FUlpfU0FOREJPWFxuICAvLyBwaWNrcyB0aGUgc2FuZGJveCB2cyBsaXZlIEFQSSBiYXNlIFVSTC4gT3B0aW9uYWwgc28gdGhlIEFQSSBib290cyAoaGVhbHRoLFxuICAvLyBhdXRoLCBjYXRhbG9nLCBldGMuKSBldmVuIHdoZW4gdGhlIHBheW1lbnQgc3RvcmUgaXNuJ3QgY29uZmlndXJlZCB5ZXQgXHUyMDE0IHRoZVxuICAvLyBwYXltZW50IGVuZHBvaW50cyB0aGVuIGZhaWwgd2l0aCBhIGNsZWFuIFwibm90IGNvbmZpZ3VyZWRcIiBlcnJvciBpbnN0ZWFkIG9mXG4gIC8vIHRha2luZyB0aGUgd2hvbGUgZGVwbG95bWVudCBkb3duLlxuICBTU0xfQ09NTUVSWl9TVE9SRV9JRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTU0xfQ09NTUVSWl9TVE9SRV9QQVNTV09SRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTU0xfQ09NTUVSWl9TQU5EQk9YOiB6LnN0cmluZygpLmRlZmF1bHQoXCJ0cnVlXCIpLFxuICAvLyBPcHRpb25hbCBleHBsaWNpdCBnYXRld2F5L3ZhbGlkYXRvciBiYXNlIFVSTHMgKEdlYXJVcCBwYXR0ZXJuKS4gRGVmYXVsdHMgYXJlXG4gIC8vIGRlcml2ZWQgZnJvbSBTU0xfQ09NTUVSWl9TQU5EQk9YIHdoZW4gYWJzZW50LlxuICBTU0xDT01NRVJaX0lOSVRfVVJMOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG4gIFNTTENPTU1FUlpfVkFMSURBVEVfVVJMOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG4gIFNTTENPTU1FUlpfUkVGVU5EX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuXG4gIC8vIFB1YmxpY2x5IHJlYWNoYWJsZSBiYXNlIFVSTCB0aGUgcGF5bWVudCBtb2R1bGUgdXNlcyB0byBidWlsZCB0aGVcbiAgLy8gU1NMQ29tbWVyeiBzdWNjZXNzL2ZhaWwvY2FuY2VsL0lQTiBjYWxsYmFjayBVUkxzLiBNdXN0IE5PVCBiZSBsb2NhbGhvc3QgaW5cbiAgLy8gc2FuZGJveCBcdTIwMTQgdGhlIGdhdGV3YXkgUE9TVHMgdG8gdGhlc2Ugc2VydmVyLXRvLXNlcnZlci4gT3B0aW9uYWwgbGlrZSB0aGVcbiAgLy8gc3RvcmUgY3JlZHMgYWJvdmUgKHBheW1lbnQtb25seSkuXG4gIEJBQ0tFTkRfUFVCTElDX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuXG4gIEpXVF9BQ0NFU1NfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkpXVF9BQ0NFU1NfU0VDUkVUIGlzIHJlcXVpcmVkXCIpLFxuICBKV1RfUkVGUkVTSF9TRUNSRVQ6IHouc3RyaW5nKCkubWluKDEsIFwiSldUX1JFRlJFU0hfU0VDUkVUIGlzIHJlcXVpcmVkXCIpLFxuICBKV1RfQUNDRVNTX0VYUElSRVNfSU46IHouc3RyaW5nKCkuZGVmYXVsdChcIjFkXCIpLFxuICBKV1RfUkVGUkVTSF9FWFBJUkVTX0lOOiB6LnN0cmluZygpLmRlZmF1bHQoXCIzMGRcIiksXG5cbiAgLy8gR29vZ2xlIE9BdXRoIGlzIG9wdGlvbmFsIFx1MjAxNCBzZXJ2ZXIgYm9vdHMgd2l0aG91dCBpdDsgL2FwaS9hdXRoL2dvb2dsZVxuICAvLyByZXR1cm5zIGEgY2xlYW4gNDAwIHVudGlsIEdPT0dMRV9DTElFTlRfSUQgaXMgY29uZmlndXJlZC5cbiAgR09PR0xFX0NMSUVOVF9JRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIC8vIEJlc3QtZWZmb3J0IGNvbnRhY3QgZW1haWxzIChSZXNlbmQpIFx1MjAxNCBhbHdheXMgb3B0aW9uYWw7IHN1Ym1pc3Npb25zXG4gIC8vIHN1Y2NlZWQgYW5kIGVtYWlscyBiZWNvbWUgbm8tb3BzIHdoZW4gdGhlc2UgYXJlIG1pc3NpbmcuXG4gIFJFU0VORF9BUElfS0VZOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIENPTlRBQ1RfUkVDRUlWRVJfRU1BSUw6IHouc3RyaW5nKCkuZW1haWwoKS5vcHRpb25hbCgpLFxuICBFTUFJTF9GUk9NOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG5cbiAgQ0xPVURJTkFSWV9DTE9VRF9OQU1FOiB6LnN0cmluZygpLm1pbigxLCBcIkNMT1VESU5BUllfQ0xPVURfTkFNRSBpcyByZXF1aXJlZFwiKSxcbiAgQ0xPVURJTkFSWV9BUElfS0VZOiB6LnN0cmluZygpLm1pbigxLCBcIkNMT1VESU5BUllfQVBJX0tFWSBpcyByZXF1aXJlZFwiKSxcbiAgQ0xPVURJTkFSWV9BUElfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkNMT1VESU5BUllfQVBJX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbn0pO1xuXG5jb25zdCBwYXJzZWQgPSBlbnZTY2hlbWEuc2FmZVBhcnNlKHByb2Nlc3MuZW52KTtcblxuaWYgKCFwYXJzZWQuc3VjY2Vzcykge1xuICBjb25zb2xlLmVycm9yKFwiXHUyNzRDIEludmFsaWQgZW52aXJvbm1lbnQgdmFyaWFibGVzOlwiKTtcbiAgY29uc29sZS5lcnJvcihwYXJzZWQuZXJyb3IuZmxhdHRlbigpLmZpZWxkRXJyb3JzKTtcbiAgcHJvY2Vzcy5leGl0KDEpO1xufVxuXG5jb25zdCBlbnYgPSBwYXJzZWQuZGF0YTtcblxuY29uc3QgY29uZmlnID0ge1xuICBwb3J0OiBlbnYuUE9SVCxcbiAgbm9kZV9lbnY6IGVudi5OT0RFX0VOVixcblxuICAvLyBGcm9udGVuZCBvcmlnaW5zIGZvciBDT1JTICsgcGF5bWVudCByZWRpcmVjdHMuIExvY2FsaG9zdCBhbHdheXMgd2lucyBmb3JcbiAgLy8gbG9jYWwgdGVzdGluZzsgcHJvZHVjdGlvbiB1c2VzIHRoZSBWZXJjZWwgZnJvbnRlbmQgVVJMLCBmYWxsaW5nIGJhY2sgdG8gdGhlXG4gIC8vIGJhY2tlbmQgVVJMIHNvIHRoZSBBUEkgc3RheXMgcmVhY2hhYmxlIGV2ZW4gYmVmb3JlIHRoZSBVSSBpcyBkZXBsb3llZC5cbiAgZnJvbnRlbmRfdXJsX2RldjogZW52LkZST05URU5EX1VSTF9ERVYgfHwgXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgZnJvbnRlbmRfdXJsX3Byb2Q6XG4gICAgZW52LkZST05URU5EX1VSTF9QUk9EIHx8IGVudi5CQUNLRU5EX1BVQkxJQ19VUkwgfHwgXCJcIixcblxuICBkYXRhYmFzZV91cmw6IGVudi5EQVRBQkFTRV9VUkwsXG5cbiAgYmNyeXB0X3NhbHRfcm91bmRzOiBlbnYuQkNSWVBUX1NBTFRfUk9VTkRTLFxuXG4gIGFkbWluX2VtYWlsOiBlbnYuQURNSU5fRU1BSUwsXG4gIGFkbWluX3Bhc3N3b3JkOiBlbnYuQURNSU5fUEFTU1dPUkQsXG5cbiAgc3NsX2NvbW1lcnpfc3RvcmVfaWQ6IGVudi5TU0xfQ09NTUVSWl9TVE9SRV9JRCxcbiAgc3NsX2NvbW1lcnpfc3RvcmVfcGFzc3dvcmQ6IGVudi5TU0xfQ09NTUVSWl9TVE9SRV9QQVNTV09SRCxcbiAgc3NsX2NvbW1lcnpfc2FuZGJveDogZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiLFxuICAvLyBzYW5kYm94IGJhc2UgVVJMcyAoZmFsbGJhY2sgd2hlbiB0aGUgZXhwbGljaXQgb3ZlcnJpZGUgdmFycyBhcmUgYWJzZW50KVxuICBzc2xjb21tZXJ6X2luaXRfdXJsOlxuICAgIGVudi5TU0xDT01NRVJaX0lOSVRfVVJMID8/XG4gICAgKGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIlxuICAgICAgPyBcImh0dHBzOi8vc2FuZGJveC5zc2xjb21tZXJ6LmNvbS9nd3Byb2Nlc3MvdjQvYXBpLnBocFwiXG4gICAgICA6IFwiaHR0cHM6Ly9zZWN1cmVwYXkuc3NsY29tbWVyei5jb20vZ3dwcm9jZXNzL3Y0L2FwaS5waHBcIiksXG4gIHNzbGNvbW1lcnpfdmFsaWRhdGVfdXJsOlxuICAgIGVudi5TU0xDT01NRVJaX1ZBTElEQVRFX1VSTCA/P1xuICAgIChlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCJcbiAgICAgID8gXCJodHRwczovL3NhbmRib3guc3NsY29tbWVyei5jb20vdmFsaWRhdG9yL2FwaS92YWxpZGF0aW9uc2VydmVyQVBJLnBocFwiXG4gICAgICA6IFwiaHR0cHM6Ly9zZWN1cmVwYXkuc3NsY29tbWVyei5jb20vdmFsaWRhdG9yL2FwaS92YWxpZGF0aW9uc2VydmVyQVBJLnBocFwiKSxcbiAgc3NsY29tbWVyel9yZWZ1bmRfdXJsOlxuICAgIGVudi5TU0xDT01NRVJaX1JFRlVORF9VUkwgPz9cbiAgICAoZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiXG4gICAgICA/IFwiaHR0cHM6Ly9zYW5kYm94LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvbWVyY2hhbnRUcmFuc0lEdmFsaWRhdGlvbkFQSS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvbWVyY2hhbnRUcmFuc0lEdmFsaWRhdGlvbkFQSS5waHBcIiksXG4gIGJhY2tlbmRfcHVibGljX3VybDogZW52LkJBQ0tFTkRfUFVCTElDX1VSTCxcblxuICBqd3RfYWNjZXNzX3NlY3JldDogZW52LkpXVF9BQ0NFU1NfU0VDUkVULFxuICBqd3RfcmVmcmVzaF9zZWNyZXQ6IGVudi5KV1RfUkVGUkVTSF9TRUNSRVQsXG4gIGp3dF9hY2Nlc3NfZXhwaXJlc19pbjogZW52LkpXVF9BQ0NFU1NfRVhQSVJFU19JTixcbiAgand0X3JlZnJlc2hfZXhwaXJlc19pbjogZW52LkpXVF9SRUZSRVNIX0VYUElSRVNfSU4sXG5cbiAgZ29vZ2xlX2NsaWVudF9pZDogZW52LkdPT0dMRV9DTElFTlRfSUQsXG5cbiAgcmVzZW5kX2FwaV9rZXk6IGVudi5SRVNFTkRfQVBJX0tFWSxcbiAgY29udGFjdF9yZWNlaXZlcl9lbWFpbDogZW52LkNPTlRBQ1RfUkVDRUlWRVJfRU1BSUwsXG4gIGVtYWlsX2Zyb206IGVudi5FTUFJTF9GUk9NLFxuXG4gIGNsb3VkaW5hcnlfY2xvdWRfbmFtZTogZW52LkNMT1VESU5BUllfQ0xPVURfTkFNRSxcbiAgY2xvdWRpbmFyeV9hcGlfa2V5OiBlbnYuQ0xPVURJTkFSWV9BUElfS0VZLFxuICBjbG91ZGluYXJ5X2FwaV9zZWNyZXQ6IGVudi5DTE9VRElOQVJZX0FQSV9TRUNSRVQsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjb25maWc7XG4iLCAiaW1wb3J0IHsgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5jb25zdCBub3RGb3VuZEhhbmRsZXIgPSAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHJlcy5zdGF0dXMoNDA0KS5qc29uKHtcbiAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICBzdGF0dXNDb2RlOiA0MDQsXG4gICAgbWVzc2FnZTogXCJSb3V0ZSBub3QgZm91bmRcIixcbiAgICBwYXRoOiByZXEub3JpZ2luYWxVcmwsXG4gICAgZGF0ZTogbmV3IERhdGUoKSxcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBub3RGb3VuZEhhbmRsZXI7XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCBtdWx0ZXIgZnJvbSBcIm11bHRlclwiO1xuaW1wb3J0IHsgWm9kRXJyb3IgfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuY29uc3QgZ2xvYmFsRXJyb3JIYW5kbGVyID0gKFxuICBlcnI6IGFueSxcbiAgcmVxOiBSZXF1ZXN0LFxuICByZXM6IFJlc3BvbnNlLFxuICBuZXh0OiBOZXh0RnVuY3Rpb24sXG4pID0+IHtcbiAgaWYgKGNvbmZpZy5ub2RlX2VudiAhPT0gXCJwcm9kdWN0aW9uXCIpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3I6XCIsIGVycik7XG4gIH1cblxuICAvLyBkZWZhdWx0IGZhbGxiYWNrXG4gIGxldCBzdGF0dXNDb2RlOiBudW1iZXIgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgbGV0IGVycm9yTWVzc2FnZTogc3RyaW5nID0gZXJyPy5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCI7XG4gIGxldCBlcnJvck5hbWU6IHN0cmluZyA9IGVycj8ubmFtZSB8fCBcIkVycm9yXCI7XG5cbiAgLy8gWm9kIHZhbGlkYXRpb24gZXJyb3JcbiAgaWYgKGVyciBpbnN0YW5jZW9mIFpvZEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLmlzc3Vlcy5tYXAoKGkpID0+IGkubWVzc2FnZSkuam9pbihcIiwgXCIpO1xuICAgIGVycm9yTmFtZSA9IFwiWm9kRXJyb3JcIjtcbiAgfVxuXG4gIC8vIE11bHRlciBmaWxlIHVwbG9hZCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBtdWx0ZXIuTXVsdGVyRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5CQURfUkVRVUVTVDtcbiAgICBlcnJvck5hbWUgPSBcIk11bHRlckVycm9yXCI7XG4gICAgZXJyb3JNZXNzYWdlID1cbiAgICAgIGVyci5jb2RlID09PSBcIkxJTUlUX0ZJTEVfU0laRVwiXG4gICAgICAgID8gXCJGaWxlIHRvbyBsYXJnZS4gTWF4aW11bSBzaXplIGlzIDVNQi5cIlxuICAgICAgICA6IGBVcGxvYWQgZmFpbGVkOiAke2Vyci5jb2RlfWA7XG4gIH1cblxuICAvLyBDdXN0b20gZmlsZSB0eXBlIHJlamVjdGlvbiBmcm9tIHRoZSBtdWx0ZXIgZmlsZUZpbHRlclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvciAmJiAoZXJyIGFzIGFueSkuY29kZSA9PT0gXCJJTlZBTElEX0ZJTEVfVFlQRVwiKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gIH1cblxuICAvLyBQcmlzbWEgdmFsaWRhdGlvbiBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID1cbiAgICAgIFwiWW91IGhhdmUgcHJvdmlkZWQgaW5jb3JyZWN0IGZpZWxkIHR5cGUgb3IgbWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIjtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclwiO1xuICB9XG5cbiAgLy8gUHJpc21hIGtub3duIGVycm9yc1xuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IpIHtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yXCI7XG5cbiAgICBpZiAoZXJyLmNvZGUgPT09IFwiUDIwMDJcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQ09ORkxJQ1Q7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBcIlRoaXMgdmFsdWUgYWxyZWFkeSBleGlzdHNcIjtcbiAgICB9IGVsc2UgaWYgKGVyci5jb2RlID09PSBcIlAyMDAzXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkNPTkZMSUNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJGb3JlaWduIGtleSBjb25zdHJhaW50IGZhaWxlZFwiO1xuICAgIH0gZWxzZSBpZiAoZXJyLmNvZGUgPT09IFwiUDIwMjVcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuTk9UX0ZPVU5EO1xuICAgICAgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgXCJBbiBvcGVyYXRpb24gZmFpbGVkIGJlY2F1c2Ugb25lIG9yIG1vcmUgcmVxdWlyZWQgcmVjb3JkcyB3ZXJlIG5vdCBmb3VuZC5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICB9XG4gIH1cblxuICAvLyBQcmlzbWEgREIgY29ubmVjdGlvbi9pbml0IGVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIFByaXNtYS5QcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yKSB7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yXCI7XG5cbiAgICBpZiAoZXJyLmVycm9yQ29kZSA9PT0gXCJQMTAwMFwiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5VTkFVVEhPUklaRUQ7XG4gICAgICBlcnJvck1lc3NhZ2UgPVxuICAgICAgICBcIkF1dGhlbnRpY2F0aW9uIGZhaWxlZCBhZ2FpbnN0IHRoZSBkYXRhYmFzZSBzZXJ2ZXIuIFBsZWFzZSBjaGVjayB5b3VyIGRhdGFiYXNlIGNyZWRlbnRpYWxzLlwiO1xuICAgIH0gZWxzZSBpZiAoZXJyLmVycm9yQ29kZSA9PT0gXCJQMTAwMVwiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5TRVJWSUNFX1VOQVZBSUxBQkxFO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJDYW4ndCByZWFjaCB0aGUgZGF0YWJhc2Ugc2VydmVyLlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICB9XG4gIH1cblxuICAvLyBQcmlzbWEgdW5rbm93biByZXF1ZXN0IGVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIFByaXNtYS5QcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclwiO1xuICAgIGVycm9yTWVzc2FnZSA9IFwiRXJyb3Igb2NjdXJyZWQgZHVyaW5nIHF1ZXJ5IGV4ZWN1dGlvblwiO1xuICB9XG5cbiAgLy8gWW91ciBjdXN0b20gQXBwRXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgQXBwRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gZXJyLnN0YXR1c0NvZGU7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgZXJyb3JOYW1lID0gZXJyLm5hbWUgfHwgXCJBcHBFcnJvclwiO1xuICB9XG5cbiAgLy8gRmFsbGJhY2sgZm9yIG90aGVyIHRocm93biBlcnJvcnNcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2UgfHwgXCJJbnRlcm5hbCBTZXJ2ZXIgRXJyb3JcIjtcbiAgICBlcnJvck5hbWUgPSBlcnIubmFtZSB8fCBcIkVycm9yXCI7XG4gIH1cblxuICByZXMuc3RhdHVzKHN0YXR1c0NvZGUpLmpzb24oe1xuICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgIHN0YXR1c0NvZGUsXG4gICAgbmFtZTogZXJyb3JOYW1lLFxuICAgIG1lc3NhZ2U6IGVycm9yTWVzc2FnZSxcbiAgICBlcnJvcjogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwiZGV2ZWxvcG1lbnRcIiA/IGVyci5zdGFjayA6IHVuZGVmaW5lZCxcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBnbG9iYWxFcnJvckhhbmRsZXI7XG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4gKiBUaGlzIGZpbGUgc2hvdWxkIGJlIHlvdXIgbWFpbiBpbXBvcnQgdG8gdXNlIFByaXNtYS4gVGhyb3VnaCBpdCB5b3UgZ2V0IGFjY2VzcyB0byBhbGwgdGhlIG1vZGVscywgZW51bXMsIGFuZCBpbnB1dCB0eXBlcy5cbiAqIElmIHlvdSdyZSBsb29raW5nIGZvciBzb21ldGhpbmcgeW91IGNhbiBpbXBvcnQgaW4gdGhlIGNsaWVudC1zaWRlIG9mIHlvdXIgYXBwbGljYXRpb24sIHBsZWFzZSByZWZlciB0byB0aGUgYGJyb3dzZXIudHNgIGZpbGUgaW5zdGVhZC5cbiAqXG4gKiBcdUQ4M0RcdURGRTIgWW91IGNhbiBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5LlxuICovXG5cbmltcG9ydCAqIGFzIHByb2Nlc3MgZnJvbSAnbm9kZTpwcm9jZXNzJ1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAnbm9kZTp1cmwnXG5nbG9iYWxUaGlzWydfX2Rpcm5hbWUnXSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpXG5cbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSBcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvY2xpZW50XCJcbmltcG9ydCAqIGFzICRFbnVtcyBmcm9tIFwiLi9lbnVtc1wiXG5pbXBvcnQgKiBhcyAkQ2xhc3MgZnJvbSBcIi4vaW50ZXJuYWwvY2xhc3NcIlxuaW1wb3J0ICogYXMgUHJpc21hIGZyb20gXCIuL2ludGVybmFsL3ByaXNtYU5hbWVzcGFjZVwiXG5cbmV4cG9ydCAqIGFzICRFbnVtcyBmcm9tICcuL2VudW1zJ1xuZXhwb3J0ICogZnJvbSBcIi4vZW51bXNcIlxuLyoqXG4gKiAjIyBQcmlzbWEgQ2xpZW50XG4gKiBcbiAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICogICBhZGFwdGVyOiBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAqIH0pXG4gKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ1Bvc3RzXG4gKiBjb25zdCBibG9nUG9zdHMgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoKVxuICogYGBgXG4gKiBcbiAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2NsaWVudCkuXG4gKi9cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnQgPSAkQ2xhc3MuZ2V0UHJpc21hQ2xpZW50Q2xhc3MoKVxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50PExvZ09wdHMgZXh0ZW5kcyBQcmlzbWEuTG9nTGV2ZWwgPSBuZXZlciwgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1tcIm9taXRcIl0gPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1tcIm9taXRcIl0sIEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzPiA9ICRDbGFzcy5QcmlzbWFDbGllbnQ8TG9nT3B0cywgT21pdE9wdHMsIEV4dEFyZ3M+XG5leHBvcnQgeyBQcmlzbWEgfVxuXG4vKipcbiAqIE1vZGVsIEJsb2dQb3N0XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQmxvZ1Bvc3QgPSBQcmlzbWEuQmxvZ1Bvc3RNb2RlbFxuLyoqXG4gKiBNb2RlbCBCb29raW5nXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQm9va2luZyA9IFByaXNtYS5Cb29raW5nTW9kZWxcbi8qKlxuICogTW9kZWwgQ2F0ZWdvcnlcbiAqIFxuICovXG5leHBvcnQgdHlwZSBDYXRlZ29yeSA9IFByaXNtYS5DYXRlZ29yeU1vZGVsXG4vKipcbiAqIE1vZGVsIENvbnRhY3RNZXNzYWdlXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQ29udGFjdE1lc3NhZ2UgPSBQcmlzbWEuQ29udGFjdE1lc3NhZ2VNb2RlbFxuLyoqXG4gKiBNb2RlbCBQYXltZW50XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUGF5bWVudCA9IFByaXNtYS5QYXltZW50TW9kZWxcbi8qKlxuICogTW9kZWwgUmV2aWV3XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUmV2aWV3ID0gUHJpc21hLlJldmlld01vZGVsXG4vKipcbiAqIE1vZGVsIFRvdXJQYWNrYWdlXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgVG91clBhY2thZ2UgPSBQcmlzbWEuVG91clBhY2thZ2VNb2RlbFxuLyoqXG4gKiBNb2RlbCBVc2VyXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgVXNlciA9IFByaXNtYS5Vc2VyTW9kZWxcbi8qKlxuICogTW9kZWwgV2lzaGxpc3RJdGVtXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgV2lzaGxpc3RJdGVtID0gUHJpc21hLldpc2hsaXN0SXRlbU1vZGVsXG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4gKiBXQVJOSU5HOiBUaGlzIGlzIGFuIGludGVybmFsIGZpbGUgdGhhdCBpcyBzdWJqZWN0IHRvIGNoYW5nZSFcbiAqXG4gKiBcdUQ4M0RcdURFRDEgVW5kZXIgbm8gY2lyY3Vtc3RhbmNlcyBzaG91bGQgeW91IGltcG9ydCB0aGlzIGZpbGUgZGlyZWN0bHkhIFx1RDgzRFx1REVEMVxuICpcbiAqIFBsZWFzZSBpbXBvcnQgdGhlIGBQcmlzbWFDbGllbnRgIGNsYXNzIGZyb20gdGhlIGBjbGllbnQudHNgIGZpbGUgaW5zdGVhZC5cbiAqL1xuXG5pbXBvcnQgKiBhcyBydW50aW1lIGZyb20gXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL2NsaWVudFwiXG5pbXBvcnQgdHlwZSAqIGFzIFByaXNtYSBmcm9tIFwiLi9wcmlzbWFOYW1lc3BhY2VcIlxuXG5cbmNvbnN0IGNvbmZpZzogcnVudGltZS5HZXRQcmlzbWFDbGllbnRDb25maWcgPSB7XG4gIFwicHJldmlld0ZlYXR1cmVzXCI6IFtdLFxuICBcImNsaWVudFZlcnNpb25cIjogXCI3LjkuMVwiLFxuICBcImVuZ2luZVZlcnNpb25cIjogXCJlOTIyMDg5YjdkNzUwMmFmZjQyNDlkNWRhMzQyMGY2ZmE1NWZjNmFkXCIsXG4gIFwiYWN0aXZlUHJvdmlkZXJcIjogXCJwb3N0Z3Jlc3FsXCIsXG4gIFwiaW5saW5lU2NoZW1hXCI6IFwibW9kZWwgQmxvZ1Bvc3Qge1xcbiAgaWQgICAgICAgICBTdHJpbmcgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0aXRsZSAgICAgIFN0cmluZ1xcbiAgc2x1ZyAgICAgICBTdHJpbmcgICAgIEB1bmlxdWVcXG4gIGV4Y2VycHQgICAgU3RyaW5nXFxuICBjb250ZW50ICAgIFN0cmluZ1xcbiAgY292ZXJJbWFnZSBTdHJpbmdcXG4gIHN0YXR1cyAgICAgUG9zdFN0YXR1cyBAZGVmYXVsdChEUkFGVClcXG4gIGlzRGVsZXRlZCAgQm9vbGVhbiAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGF1dGhvcklkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGF1dGhvciBVc2VyIEByZWxhdGlvbihcXFwiQXV0aG9yUG9zdHNcXFwiLCBmaWVsZHM6IFthdXRob3JJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBpbmRleChbYXV0aG9ySWRdKVxcbiAgQEBtYXAoXFxcImJsb2dfcG9zdHNcXFwiKVxcbn1cXG5cXG5tb2RlbCBCb29raW5nIHtcXG4gIGlkICAgICAgICAgU3RyaW5nICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdHJhdmVsRGF0ZSBEYXRlVGltZVxcbiAgdHJhdmVsZXJzICBJbnRcXG4gIHRvdGFsUHJpY2UgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMilcXG4gIHN0YXR1cyAgICAgQm9va2luZ1N0YXR1cyBAZGVmYXVsdChQRU5ESU5HKVxcblxcbiAgdXNlcklkICAgIFN0cmluZ1xcbiAgcGFja2FnZUlkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHVzZXIgICAgIFVzZXIgICAgICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCIsIGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYWNrYWdlICBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIHBheW1lbnRzIFBheW1lbnRbXVxcblxcbiAgQEBpbmRleChbdXNlcklkXSlcXG4gIEBAaW5kZXgoW3BhY2thZ2VJZF0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBpbmRleChbdXNlcklkLCBwYWNrYWdlSWQsIHRyYXZlbERhdGVdKVxcbiAgQEBtYXAoXFxcImJvb2tpbmdzXFxcIilcXG59XFxuXFxubW9kZWwgQ2F0ZWdvcnkge1xcbiAgaWQgICBTdHJpbmcgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIG5hbWUgU3RyaW5nIEB1bmlxdWVcXG4gIHNsdWcgU3RyaW5nIEB1bmlxdWVcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBwYWNrYWdlcyBUb3VyUGFja2FnZVtdXFxuXFxuICBAQG1hcChcXFwiY2F0ZWdvcmllc1xcXCIpXFxufVxcblxcbm1vZGVsIENvbnRhY3RNZXNzYWdlIHtcXG4gIGlkICAgICAgICAgU3RyaW5nICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgbmFtZSAgICAgICBTdHJpbmdcXG4gIGVtYWlsICAgICAgU3RyaW5nXFxuICBzdWJqZWN0ICAgIFN0cmluZ1xcbiAgbWVzc2FnZSAgICBTdHJpbmdcXG4gIGlzUmVzb2x2ZWQgQm9vbGVhbiBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBAQGluZGV4KFtpc1Jlc29sdmVkXSlcXG4gIEBAbWFwKFxcXCJjb250YWN0X21lc3NhZ2VzXFxcIilcXG59XFxuXFxuZW51bSBSb2xlIHtcXG4gIFVTRVJcXG4gIEFHRU5UXFxuICBBRE1JTlxcbn1cXG5cXG5lbnVtIFVzZXJTdGF0dXMge1xcbiAgQUNUSVZFXFxuICBTVVNQRU5ERURcXG59XFxuXFxuZW51bSBBdXRoUHJvdmlkZXIge1xcbiAgQ1JFREVOVElBTFxcbiAgR09PR0xFXFxufVxcblxcbmVudW0gUGFja2FnZVN0YXR1cyB7XFxuICBQRU5ESU5HXFxuICBBUFBST1ZFRFxcbiAgUkVKRUNURURcXG59XFxuXFxuZW51bSBCb29raW5nU3RhdHVzIHtcXG4gIFBFTkRJTkdcXG4gIFBBSURcXG4gIENPTkZJUk1FRFxcbiAgQ0FOQ0VMTEVEXFxuICBDT01QTEVURURcXG59XFxuXFxuZW51bSBQYXltZW50U3RhdHVzIHtcXG4gIElOSVRJQVRFRFxcbiAgU1VDQ0VTU1xcbiAgRkFJTEVEXFxuICBDQU5DRUxMRURcXG4gIFJFRlVOREVEXFxufVxcblxcbmVudW0gUG9zdFN0YXR1cyB7XFxuICBEUkFGVFxcbiAgUFVCTElTSEVEXFxufVxcblxcbm1vZGVsIFBheW1lbnQge1xcbiAgaWQgICAgICAgICAgICAgU3RyaW5nICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgYm9va2luZ0lkICAgICAgU3RyaW5nXFxuICB0cmFuSWQgICAgICAgICBTdHJpbmcgICAgICAgIEB1bmlxdWUgLy8gU1NMQ29tbWVyeiB0cmFuc2FjdGlvbiBpZCwgZ2VuZXJhdGVkIHNlcnZlci1zaWRlXFxuICB2YWxJZCAgICAgICAgICBTdHJpbmc/IC8vIHNldCBhZnRlciBnYXRld2F5IHN1Y2Nlc3MsIHVzZWQgZm9yIHNlcnZlci1zaWRlIHZhbGlkYXRpb25cXG4gIGFtb3VudCAgICAgICAgIERlY2ltYWwgICAgICAgQGRiLkRlY2ltYWwoMTAsIDIpIC8vID0gYm9va2luZy50b3RhbFByaWNlIGF0IHNlc3Npb24gY3JlYXRpb25cXG4gIGN1cnJlbmN5ICAgICAgIFN0cmluZyAgICAgICAgQGRlZmF1bHQoXFxcIkJEVFxcXCIpXFxuICBzdGF0dXMgICAgICAgICBQYXltZW50U3RhdHVzIEBkZWZhdWx0KElOSVRJQVRFRClcXG4gIGdhdGV3YXlQYWdlVXJsIFN0cmluZz9cXG4gIHNzbFNlc3Npb25LZXkgIFN0cmluZz9cXG4gIGNhcmRUeXBlICAgICAgIFN0cmluZz9cXG4gIGJhbmtUcmFuSWQgICAgIFN0cmluZz9cXG4gIHBhaWRBdCAgICAgICAgIERhdGVUaW1lP1xcbiAgcmVmdW5kUmVmSWQgICAgU3RyaW5nPyAvLyBTU0xDb21tZXJ6IHJlZnVuZCByZWZlcmVuY2UgKHNldCB3aGVuIGEgcmVmdW5kIGlzIGluaXRpYXRlZClcXG4gIHJlZnVuZGVkQXQgICAgIERhdGVUaW1lPyAvLyB3aGVuIHRoZSByZWZ1bmQgd2FzIGluaXRpYXRlZC9zZXR0bGVkXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgYm9va2luZyBCb29raW5nIEByZWxhdGlvbihmaWVsZHM6IFtib29raW5nSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcblxcbiAgQEBpbmRleChbYm9va2luZ0lkXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQG1hcChcXFwicGF5bWVudHNcXFwiKVxcbn1cXG5cXG5tb2RlbCBSZXZpZXcge1xcbiAgaWQgICAgICBTdHJpbmcgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHJhdGluZyAgSW50XFxuICBjb21tZW50IFN0cmluZ1xcblxcbiAgdXNlcklkICAgIFN0cmluZ1xcbiAgcGFja2FnZUlkIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHVzZXIgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lclJldmlld3NcXFwiLCBmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pXFxuICBAQGluZGV4KFtwYWNrYWdlSWRdKVxcbiAgQEBtYXAoXFxcInJldmlld3NcXFwiKVxcbn1cXG5cXG4vLyBUaGlzIGlzIHlvdXIgUHJpc21hIHNjaGVtYSBmaWxlLFxcbi8vIGxlYXJuIG1vcmUgYWJvdXQgaXQgaW4gdGhlIGRvY3M6IGh0dHBzOi8vcHJpcy5seS9kL3ByaXNtYS1zY2hlbWFcXG5cXG5nZW5lcmF0b3IgY2xpZW50IHtcXG4gIHByb3ZpZGVyID0gXFxcInByaXNtYS1jbGllbnRcXFwiXFxuICBvdXRwdXQgICA9IFxcXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hXFxcIlxcbn1cXG5cXG5kYXRhc291cmNlIGRiIHtcXG4gIHByb3ZpZGVyID0gXFxcInBvc3RncmVzcWxcXFwiXFxufVxcblxcbm1vZGVsIFRvdXJQYWNrYWdlIHtcXG4gIGlkICAgICAgICAgIFN0cmluZyAgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRpdGxlICAgICAgIFN0cmluZ1xcbiAgc2x1ZyAgICAgICAgU3RyaW5nICAgICAgICBAdW5pcXVlXFxuICBkZXNjcmlwdGlvbiBTdHJpbmdcXG4gIGxvY2F0aW9uICAgIFN0cmluZ1xcbiAgcHJpY2UgICAgICAgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMilcXG4gIGR1cmF0aW9uICAgIEludFxcbiAgcmF0aW5nICAgICAgRmxvYXQgICAgICAgICBAZGVmYXVsdCgwKVxcbiAgaW1hZ2VzICAgICAgU3RyaW5nW11cXG4gIHN0YXR1cyAgICAgIFBhY2thZ2VTdGF0dXMgQGRlZmF1bHQoUEVORElORylcXG4gIGlzRGVsZXRlZCAgIEJvb2xlYW4gICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuXFxuICBjYXRlZ29yeUlkIFN0cmluZ1xcbiAgYWdlbnRJZCAgICBTdHJpbmdcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBjYXRlZ29yeSAgICAgIENhdGVnb3J5ICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFtjYXRlZ29yeUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIGFnZW50ICAgICAgICAgVXNlciAgICAgICAgICAgQHJlbGF0aW9uKFxcXCJBZ2VudFBhY2thZ2VzXFxcIiwgZmllbGRzOiBbYWdlbnRJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBib29raW5ncyAgICAgIEJvb2tpbmdbXVxcbiAgcmV2aWV3cyAgICAgICBSZXZpZXdbXVxcbiAgd2lzaGxpc3RJdGVtcyBXaXNobGlzdEl0ZW1bXVxcblxcbiAgQEBpbmRleChbY2F0ZWdvcnlJZF0pXFxuICBAQGluZGV4KFtjYXRlZ29yeUlkLCBwcmljZV0pXFxuICBAQGluZGV4KFtwcmljZV0pXFxuICBAQGluZGV4KFtzdGF0dXNdKVxcbiAgQEBtYXAoXFxcInRvdXJfcGFja2FnZXNcXFwiKVxcbn1cXG5cXG5tb2RlbCBVc2VyIHtcXG4gIGlkICAgICAgICAgICAgU3RyaW5nICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lICAgICAgICAgIFN0cmluZ1xcbiAgZW1haWwgICAgICAgICBTdHJpbmcgICAgICAgQHVuaXF1ZVxcbiAgcGFzc3dvcmQgICAgICBTdHJpbmc/XFxuICBnb29nbGVJZCAgICAgIFN0cmluZz8gICAgICBAdW5pcXVlXFxuICBwaG9uZSAgICAgICAgIFN0cmluZz9cXG4gIGF2YXRhclVybCAgICAgU3RyaW5nP1xcbiAgcm9sZSAgICAgICAgICBSb2xlICAgICAgICAgQGRlZmF1bHQoVVNFUilcXG4gIHN0YXR1cyAgICAgICAgVXNlclN0YXR1cyAgIEBkZWZhdWx0KEFDVElWRSlcXG4gIGF1dGhQcm92aWRlciAgQXV0aFByb3ZpZGVyIEBkZWZhdWx0KENSRURFTlRJQUwpXFxuICBlbWFpbFZlcmlmaWVkIEJvb2xlYW4gICAgICBAZGVmYXVsdChmYWxzZSlcXG4gIGlzRGVsZXRlZCAgICAgQm9vbGVhbiAgICAgIEBkZWZhdWx0KGZhbHNlKVxcbiAgdG9rZW5WZXJzaW9uICBJbnQgICAgICAgICAgQGRlZmF1bHQoMClcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBwYWNrYWdlcyBUb3VyUGFja2FnZVtdICBAcmVsYXRpb24oXFxcIkFnZW50UGFja2FnZXNcXFwiKVxcbiAgYm9va2luZ3MgQm9va2luZ1tdICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lckJvb2tpbmdzXFxcIilcXG4gIHJldmlld3MgIFJldmlld1tdICAgICAgIEByZWxhdGlvbihcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIilcXG4gIHBvc3RzICAgIEJsb2dQb3N0W10gICAgIEByZWxhdGlvbihcXFwiQXV0aG9yUG9zdHNcXFwiKVxcbiAgd2lzaGxpc3QgV2lzaGxpc3RJdGVtW11cXG5cXG4gIEBAaW5kZXgoW3JvbGVdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAbWFwKFxcXCJ1c2Vyc1xcXCIpXFxufVxcblxcbm1vZGVsIFdpc2hsaXN0SXRlbSB7XFxuICBpZCAgICAgICAgU3RyaW5nIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuXFxuICB1c2VyICAgIFVzZXIgICAgICAgIEByZWxhdGlvbihmaWVsZHM6IFt1c2VySWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGFja2FnZSBUb3VyUGFja2FnZSBAcmVsYXRpb24oZmllbGRzOiBbcGFja2FnZUlkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pXFxuICBAQGluZGV4KFt1c2VySWQsIGNyZWF0ZWRBdF0pXFxuICBAQG1hcChcXFwid2lzaGxpc3RfaXRlbXNcXFwiKVxcbn1cXG5cIixcbiAgXCJydW50aW1lRGF0YU1vZGVsXCI6IHtcbiAgICBcIm1vZGVsc1wiOiB7fSxcbiAgICBcImVudW1zXCI6IHt9LFxuICAgIFwidHlwZXNcIjoge31cbiAgfSxcbiAgXCJwYXJhbWV0ZXJpemF0aW9uU2NoZW1hXCI6IHtcbiAgICBcInN0cmluZ3NcIjogW10sXG4gICAgXCJncmFwaFwiOiBcIlwiXG4gIH1cbn1cblxuY29uZmlnLnJ1bnRpbWVEYXRhTW9kZWwgPSBKU09OLnBhcnNlKFwie1xcXCJtb2RlbHNcXFwiOntcXFwiQmxvZ1Bvc3RcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRpdGxlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzbHVnXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJleGNlcnB0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb250ZW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb3ZlckltYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQb3N0U3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aG9ySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aG9yXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQXV0aG9yUG9zdHNcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImJsb2dfcG9zdHNcXFwifSxcXFwiQm9va2luZ1xcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidHJhdmVsRGF0ZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0cmF2ZWxlcnNcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRvdGFsUHJpY2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRlY2ltYWxcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlcklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyQm9va2luZ3NcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGF5bWVudHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlBheW1lbnRcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJCb29raW5nVG9QYXltZW50XFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJib29raW5nc1xcXCJ9LFxcXCJDYXRlZ29yeVxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDYXRlZ29yeVRvVG91clBhY2thZ2VcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImNhdGVnb3JpZXNcXFwifSxcXFwiQ29udGFjdE1lc3NhZ2VcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdWJqZWN0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJtZXNzYWdlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc1Jlc29sdmVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImNvbnRhY3RfbWVzc2FnZXNcXFwifSxcXFwiUGF5bWVudFxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ0lkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0cmFuSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInZhbElkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhbW91bnRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRlY2ltYWxcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjdXJyZW5jeVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUGF5bWVudFN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImdhdGV3YXlQYWdlVXJsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzc2xTZXNzaW9uS2V5XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjYXJkVHlwZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYmFua1RyYW5JZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFpZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJlZnVuZFJlZklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyZWZ1bmRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1BheW1lbnRcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInBheW1lbnRzXFxcIn0sXFxcIlJldmlld1xcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmF0aW5nXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjb21tZW50XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZXZpZXdUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJyZXZpZXdzXFxcIn0sXFxcIlRvdXJQYWNrYWdlXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0aXRsZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic2x1Z1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZGVzY3JpcHRpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImxvY2F0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwcmljZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImR1cmF0aW9uXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJJbnRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyYXRpbmdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkZsb2F0XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaW1hZ2VzXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYWNrYWdlU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiaXNEZWxldGVkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29sZWFuXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY2F0ZWdvcnlJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYWdlbnRJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjYXRlZ29yeVxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQ2F0ZWdvcnlcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDYXRlZ29yeVRvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhZ2VudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkFnZW50UGFja2FnZXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9va2luZ1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1RvdXJQYWNrYWdlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiUmV2aWV3VG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIndpc2hsaXN0SXRlbXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIldpc2hsaXN0SXRlbVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlRvdXJQYWNrYWdlVG9XaXNobGlzdEl0ZW1cXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInRvdXJfcGFja2FnZXNcXFwifSxcXFwiVXNlclxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhc3N3b3JkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJnb29nbGVJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGhvbmVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF2YXRhclVybFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicm9sZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlJvbGVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyU3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYXV0aFByb3ZpZGVyXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQXV0aFByb3ZpZGVyXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxWZXJpZmllZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzRGVsZXRlZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiQm9vbGVhblxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRva2VuVmVyc2lvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVG91clBhY2thZ2VcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBZ2VudFBhY2thZ2VzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiYm9va2luZ3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lckJvb2tpbmdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmV2aWV3c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUmV2aWV3XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJSZXZpZXdzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicG9zdHNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIkJsb2dQb3N0XFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQXV0aG9yUG9zdHNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ3aXNobGlzdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiV2lzaGxpc3RJdGVtXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVXNlclRvV2lzaGxpc3RJdGVtXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJ1c2Vyc1xcXCJ9LFxcXCJXaXNobGlzdEl0ZW1cXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXNlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlVzZXJUb1dpc2hsaXN0SXRlbVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiVG91clBhY2thZ2VUb1dpc2hsaXN0SXRlbVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwid2lzaGxpc3RfaXRlbXNcXFwifX0sXFxcImVudW1zXFxcIjp7fSxcXFwidHlwZXNcXFwiOnt9fVwiKVxuY29uZmlnLnBhcmFtZXRlcml6YXRpb25TY2hlbWEgPSB7XG4gIHN0cmluZ3M6IEpTT04ucGFyc2UoXCJbXFxcIndoZXJlXFxcIixcXFwib3JkZXJCeVxcXCIsXFxcImN1cnNvclxcXCIsXFxcInBhY2thZ2VzXFxcIixcXFwiX2NvdW50XFxcIixcXFwiY2F0ZWdvcnlcXFwiLFxcXCJhZ2VudFxcXCIsXFxcInVzZXJcXFwiLFxcXCJwYWNrYWdlXFxcIixcXFwiYm9va2luZ1xcXCIsXFxcInBheW1lbnRzXFxcIixcXFwiYm9va2luZ3NcXFwiLFxcXCJyZXZpZXdzXFxcIixcXFwid2lzaGxpc3RJdGVtc1xcXCIsXFxcInBvc3RzXFxcIixcXFwid2lzaGxpc3RcXFwiLFxcXCJhdXRob3JcXFwiLFxcXCJCbG9nUG9zdC5maW5kVW5pcXVlXFxcIixcXFwiQmxvZ1Bvc3QuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RcXFwiLFxcXCJCbG9nUG9zdC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQmxvZ1Bvc3QuZmluZE1hbnlcXFwiLFxcXCJkYXRhXFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlT25lXFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlTWFueVxcXCIsXFxcIkJsb2dQb3N0LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVPbmVcXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVNYW55XFxcIixcXFwiQmxvZ1Bvc3QudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcImNyZWF0ZVxcXCIsXFxcInVwZGF0ZVxcXCIsXFxcIkJsb2dQb3N0LnVwc2VydE9uZVxcXCIsXFxcIkJsb2dQb3N0LmRlbGV0ZU9uZVxcXCIsXFxcIkJsb2dQb3N0LmRlbGV0ZU1hbnlcXFwiLFxcXCJoYXZpbmdcXFwiLFxcXCJfbWluXFxcIixcXFwiX21heFxcXCIsXFxcIkJsb2dQb3N0Lmdyb3VwQnlcXFwiLFxcXCJCbG9nUG9zdC5hZ2dyZWdhdGVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVcXFwiLFxcXCJCb29raW5nLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQm9va2luZy5maW5kRmlyc3RcXFwiLFxcXCJCb29raW5nLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJCb29raW5nLmZpbmRNYW55XFxcIixcXFwiQm9va2luZy5jcmVhdGVPbmVcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJCb29raW5nLnVwZGF0ZU9uZVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueVxcXCIsXFxcIkJvb2tpbmcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJvb2tpbmcudXBzZXJ0T25lXFxcIixcXFwiQm9va2luZy5kZWxldGVPbmVcXFwiLFxcXCJCb29raW5nLmRlbGV0ZU1hbnlcXFwiLFxcXCJfYXZnXFxcIixcXFwiX3N1bVxcXCIsXFxcIkJvb2tpbmcuZ3JvdXBCeVxcXCIsXFxcIkJvb2tpbmcuYWdncmVnYXRlXFxcIixcXFwiQ2F0ZWdvcnkuZmluZFVuaXF1ZVxcXCIsXFxcIkNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0XFxcIixcXFwiQ2F0ZWdvcnkuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNhdGVnb3J5LmZpbmRNYW55XFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlT25lXFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlTWFueVxcXCIsXFxcIkNhdGVnb3J5LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVPbmVcXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVNYW55XFxcIixcXFwiQ2F0ZWdvcnkudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNhdGVnb3J5LnVwc2VydE9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU9uZVxcXCIsXFxcIkNhdGVnb3J5LmRlbGV0ZU1hbnlcXFwiLFxcXCJDYXRlZ29yeS5ncm91cEJ5XFxcIixcXFwiQ2F0ZWdvcnkuYWdncmVnYXRlXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZFVuaXF1ZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmZpbmRNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlT25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwc2VydE9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmRlbGV0ZU1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5ncm91cEJ5XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuYWdncmVnYXRlXFxcIixcXFwiUGF5bWVudC5maW5kVW5pcXVlXFxcIixcXFwiUGF5bWVudC5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlBheW1lbnQuZmluZEZpcnN0XFxcIixcXFwiUGF5bWVudC5maW5kRmlyc3RPclRocm93XFxcIixcXFwiUGF5bWVudC5maW5kTWFueVxcXCIsXFxcIlBheW1lbnQuY3JlYXRlT25lXFxcIixcXFwiUGF5bWVudC5jcmVhdGVNYW55XFxcIixcXFwiUGF5bWVudC5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUGF5bWVudC51cGRhdGVPbmVcXFwiLFxcXCJQYXltZW50LnVwZGF0ZU1hbnlcXFwiLFxcXCJQYXltZW50LnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJQYXltZW50LnVwc2VydE9uZVxcXCIsXFxcIlBheW1lbnQuZGVsZXRlT25lXFxcIixcXFwiUGF5bWVudC5kZWxldGVNYW55XFxcIixcXFwiUGF5bWVudC5ncm91cEJ5XFxcIixcXFwiUGF5bWVudC5hZ2dyZWdhdGVcXFwiLFxcXCJSZXZpZXcuZmluZFVuaXF1ZVxcXCIsXFxcIlJldmlldy5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlJldmlldy5maW5kRmlyc3RcXFwiLFxcXCJSZXZpZXcuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlJldmlldy5maW5kTWFueVxcXCIsXFxcIlJldmlldy5jcmVhdGVPbmVcXFwiLFxcXCJSZXZpZXcuY3JlYXRlTWFueVxcXCIsXFxcIlJldmlldy5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiUmV2aWV3LnVwZGF0ZU9uZVxcXCIsXFxcIlJldmlldy51cGRhdGVNYW55XFxcIixcXFwiUmV2aWV3LnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJSZXZpZXcudXBzZXJ0T25lXFxcIixcXFwiUmV2aWV3LmRlbGV0ZU9uZVxcXCIsXFxcIlJldmlldy5kZWxldGVNYW55XFxcIixcXFwiUmV2aWV3Lmdyb3VwQnlcXFwiLFxcXCJSZXZpZXcuYWdncmVnYXRlXFxcIixcXFwiVG91clBhY2thZ2UuZmluZFVuaXF1ZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiVG91clBhY2thZ2UuZmluZEZpcnN0XFxcIixcXFwiVG91clBhY2thZ2UuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIlRvdXJQYWNrYWdlLmZpbmRNYW55XFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlT25lXFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVNYW55XFxcIixcXFwiVG91clBhY2thZ2UudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwc2VydE9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmRlbGV0ZU9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLmRlbGV0ZU1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS5ncm91cEJ5XFxcIixcXFwiVG91clBhY2thZ2UuYWdncmVnYXRlXFxcIixcXFwiVXNlci5maW5kVW5pcXVlXFxcIixcXFwiVXNlci5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIlVzZXIuZmluZEZpcnN0XFxcIixcXFwiVXNlci5maW5kRmlyc3RPclRocm93XFxcIixcXFwiVXNlci5maW5kTWFueVxcXCIsXFxcIlVzZXIuY3JlYXRlT25lXFxcIixcXFwiVXNlci5jcmVhdGVNYW55XFxcIixcXFwiVXNlci5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVXNlci51cGRhdGVPbmVcXFwiLFxcXCJVc2VyLnVwZGF0ZU1hbnlcXFwiLFxcXCJVc2VyLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJVc2VyLnVwc2VydE9uZVxcXCIsXFxcIlVzZXIuZGVsZXRlT25lXFxcIixcXFwiVXNlci5kZWxldGVNYW55XFxcIixcXFwiVXNlci5ncm91cEJ5XFxcIixcXFwiVXNlci5hZ2dyZWdhdGVcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZmluZFVuaXF1ZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kRmlyc3RcXFwiLFxcXCJXaXNobGlzdEl0ZW0uZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIldpc2hsaXN0SXRlbS5maW5kTWFueVxcXCIsXFxcIldpc2hsaXN0SXRlbS5jcmVhdGVPbmVcXFwiLFxcXCJXaXNobGlzdEl0ZW0uY3JlYXRlTWFueVxcXCIsXFxcIldpc2hsaXN0SXRlbS5jcmVhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiV2lzaGxpc3RJdGVtLnVwZGF0ZU9uZVxcXCIsXFxcIldpc2hsaXN0SXRlbS51cGRhdGVNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLnVwZGF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJXaXNobGlzdEl0ZW0udXBzZXJ0T25lXFxcIixcXFwiV2lzaGxpc3RJdGVtLmRlbGV0ZU9uZVxcXCIsXFxcIldpc2hsaXN0SXRlbS5kZWxldGVNYW55XFxcIixcXFwiV2lzaGxpc3RJdGVtLmdyb3VwQnlcXFwiLFxcXCJXaXNobGlzdEl0ZW0uYWdncmVnYXRlXFxcIixcXFwiQU5EXFxcIixcXFwiT1JcXFwiLFxcXCJOT1RcXFwiLFxcXCJpZFxcXCIsXFxcInVzZXJJZFxcXCIsXFxcInBhY2thZ2VJZFxcXCIsXFxcImNyZWF0ZWRBdFxcXCIsXFxcImVxdWFsc1xcXCIsXFxcImluXFxcIixcXFwibm90SW5cXFwiLFxcXCJsdFxcXCIsXFxcImx0ZVxcXCIsXFxcImd0XFxcIixcXFwiZ3RlXFxcIixcXFwibm90XFxcIixcXFwiY29udGFpbnNcXFwiLFxcXCJzdGFydHNXaXRoXFxcIixcXFwiZW5kc1dpdGhcXFwiLFxcXCJuYW1lXFxcIixcXFwiZW1haWxcXFwiLFxcXCJwYXNzd29yZFxcXCIsXFxcImdvb2dsZUlkXFxcIixcXFwicGhvbmVcXFwiLFxcXCJhdmF0YXJVcmxcXFwiLFxcXCJSb2xlXFxcIixcXFwicm9sZVxcXCIsXFxcIlVzZXJTdGF0dXNcXFwiLFxcXCJzdGF0dXNcXFwiLFxcXCJBdXRoUHJvdmlkZXJcXFwiLFxcXCJhdXRoUHJvdmlkZXJcXFwiLFxcXCJlbWFpbFZlcmlmaWVkXFxcIixcXFwiaXNEZWxldGVkXFxcIixcXFwidG9rZW5WZXJzaW9uXFxcIixcXFwidXBkYXRlZEF0XFxcIixcXFwiZXZlcnlcXFwiLFxcXCJzb21lXFxcIixcXFwibm9uZVxcXCIsXFxcInRpdGxlXFxcIixcXFwic2x1Z1xcXCIsXFxcImRlc2NyaXB0aW9uXFxcIixcXFwibG9jYXRpb25cXFwiLFxcXCJwcmljZVxcXCIsXFxcImR1cmF0aW9uXFxcIixcXFwicmF0aW5nXFxcIixcXFwiaW1hZ2VzXFxcIixcXFwiUGFja2FnZVN0YXR1c1xcXCIsXFxcImNhdGVnb3J5SWRcXFwiLFxcXCJhZ2VudElkXFxcIixcXFwiaGFzXFxcIixcXFwiaGFzRXZlcnlcXFwiLFxcXCJoYXNTb21lXFxcIixcXFwiY29tbWVudFxcXCIsXFxcImJvb2tpbmdJZFxcXCIsXFxcInRyYW5JZFxcXCIsXFxcInZhbElkXFxcIixcXFwiYW1vdW50XFxcIixcXFwiY3VycmVuY3lcXFwiLFxcXCJQYXltZW50U3RhdHVzXFxcIixcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJzc2xTZXNzaW9uS2V5XFxcIixcXFwiY2FyZFR5cGVcXFwiLFxcXCJiYW5rVHJhbklkXFxcIixcXFwicGFpZEF0XFxcIixcXFwicmVmdW5kUmVmSWRcXFwiLFxcXCJyZWZ1bmRlZEF0XFxcIixcXFwic3ViamVjdFxcXCIsXFxcIm1lc3NhZ2VcXFwiLFxcXCJpc1Jlc29sdmVkXFxcIixcXFwidHJhdmVsRGF0ZVxcXCIsXFxcInRyYXZlbGVyc1xcXCIsXFxcInRvdGFsUHJpY2VcXFwiLFxcXCJCb29raW5nU3RhdHVzXFxcIixcXFwiZXhjZXJwdFxcXCIsXFxcImNvbnRlbnRcXFwiLFxcXCJjb3ZlckltYWdlXFxcIixcXFwiUG9zdFN0YXR1c1xcXCIsXFxcImF1dGhvcklkXFxcIixcXFwidXNlcklkX3BhY2thZ2VJZFxcXCIsXFxcImlzXFxcIixcXFwiaXNOb3RcXFwiLFxcXCJjb25uZWN0T3JDcmVhdGVcXFwiLFxcXCJ1cHNlcnRcXFwiLFxcXCJjcmVhdGVNYW55XFxcIixcXFwic2V0XFxcIixcXFwiZGlzY29ubmVjdFxcXCIsXFxcImRlbGV0ZVxcXCIsXFxcImNvbm5lY3RcXFwiLFxcXCJ1cGRhdGVNYW55XFxcIixcXFwiZGVsZXRlTWFueVxcXCIsXFxcInB1c2hcXFwiLFxcXCJpbmNyZW1lbnRcXFwiLFxcXCJkZWNyZW1lbnRcXFwiLFxcXCJtdWx0aXBseVxcXCIsXFxcImRpdmlkZVxcXCJdXCIpLFxuICBncmFwaDogXCI0Z1JYa0FFUEVBQUF3QUlBSUtrQkFBQy1BZ0F3cWdFQUFCOEFFS3NCQUFDLUFnQXdyQUVCQUFBQUFhOEJRQUNhQWdBaHhBRUFBTDhDOVFFaXlBRWdBSmdDQUNIS0FVQUFtZ0lBSWM0QkFRQ1RBZ0FoendFQkFBQUFBZkVCQVFDVEFnQWg4Z0VCQUpNQ0FDSHpBUUVBa3dJQUlmVUJBUUNUQWdBaEFRQUFBQUVBSUJjRkFBRFJBZ0FnQmdBQXdBSUFJQXNBQUp3Q0FDQU1BQUNkQWdBZ0RRQUFud0lBSUtrQkFBRE9BZ0F3cWdFQUFBTUFFS3NCQUFET0FnQXdyQUVCQUpNQ0FDR3ZBVUFBbWdJQUljUUJBQURRQXRjQklzZ0JJQUNZQWdBaHlnRkFBSm9DQUNIT0FRRUFrd0lBSWM4QkFRQ1RBZ0FoMEFFQkFKTUNBQ0hSQVFFQWt3SUFJZElCRUFESEFnQWgwd0VDQUprQ0FDSFVBUWdBendJQUlkVUJBQUNqQWdBZzF3RUJBSk1DQUNIWUFRRUFrd0lBSVFVRkFBQ21CQUFnQmdBQW9nUUFJQXNBQVBBREFDQU1BQUR4QXdBZ0RRQUE4d01BSUJjRkFBRFJBZ0FnQmdBQXdBSUFJQXNBQUp3Q0FDQU1BQUNkQWdBZ0RRQUFud0lBSUtrQkFBRE9BZ0F3cWdFQUFBTUFFS3NCQUFET0FnQXdyQUVCQUFBQUFhOEJRQUNhQWdBaHhBRUFBTkFDMXdFaXlBRWdBSmdDQUNIS0FVQUFtZ0lBSWM0QkFRQ1RBZ0FoendFQkFBQUFBZEFCQVFDVEFnQWgwUUVCQUpNQ0FDSFNBUkFBeHdJQUlkTUJBZ0NaQWdBaDFBRUlBTThDQUNIVkFRQUFvd0lBSU5jQkFRQ1RBZ0FoMkFFQkFKTUNBQ0VEQUFBQUF3QWdBUUFBQkFBd0FnQUFCUUFnQXdBQUFBTUFJQUVBQUFRQU1BSUFBQVVBSUFFQUFBQURBQ0FQQndBQXdBSUFJQWdBQU1NQ0FDQUtBQUROQWdBZ3FRRUFBTXNDQURDcUFRQUFDUUFRcXdFQUFNc0NBRENzQVFFQWt3SUFJYTBCQVFDVEFnQWhyZ0VCQUpNQ0FDR3ZBVUFBbWdJQUljUUJBQURNQXZFQklzb0JRQUNhQWdBaDdRRkFBSm9DQUNIdUFRSUFtUUlBSWU4QkVBREhBZ0FoQXdjQUFLSUVBQ0FJQUFDakJBQWdDZ0FBcFFRQUlBOEhBQURBQWdBZ0NBQUF3d0lBSUFvQUFNMENBQ0NwQVFBQXl3SUFNS29CQUFBSkFCQ3JBUUFBeXdJQU1Ld0JBUUFBQUFHdEFRRUFrd0lBSWE0QkFRQ1RBZ0FocndGQUFKb0NBQ0hFQVFBQXpBTHhBU0xLQVVBQW1nSUFJZTBCUUFDYUFnQWg3Z0VDQUprQ0FDSHZBUkFBeHdJQUlRTUFBQUFKQUNBQkFBQUtBREFDQUFBTEFDQVVDUUFBeWdJQUlLa0JBQURHQWdBd3FnRUFBQTBBRUtzQkFBREdBZ0F3ckFFQkFKTUNBQ0d2QVVBQW1nSUFJY1FCQUFESUF1TUJJc29CUUFDYUFnQWgzUUVCQUpNQ0FDSGVBUUVBa3dJQUlkOEJBUUNVQWdBaDRBRVFBTWNDQUNIaEFRRUFrd0lBSWVNQkFRQ1VBZ0FoNUFFQkFKUUNBQ0hsQVFFQWxBSUFJZVlCQVFDVUFnQWg1d0ZBQU1rQ0FDSG9BUUVBbEFJQUlla0JRQURKQWdBaENRa0FBS1FFQUNEZkFRQUEyd0lBSU9NQkFBRGJBZ0FnNUFFQUFOc0NBQ0RsQVFBQTJ3SUFJT1lCQUFEYkFnQWc1d0VBQU5zQ0FDRG9BUUFBMndJQUlPa0JBQURiQWdBZ0ZBa0FBTW9DQUNDcEFRQUF4Z0lBTUtvQkFBQU5BQkNyQVFBQXhnSUFNS3dCQVFBQUFBR3ZBVUFBbWdJQUljUUJBQURJQXVNQklzb0JRQUNhQWdBaDNRRUJBSk1DQUNIZUFRRUFBQUFCM3dFQkFKUUNBQ0hnQVJBQXh3SUFJZUVCQVFDVEFnQWg0d0VCQUpRQ0FDSGtBUUVBbEFJQUllVUJBUUNVQWdBaDVnRUJBSlFDQUNIbkFVQUF5UUlBSWVnQkFRQ1VBZ0FoNlFGQUFNa0NBQ0VEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQVFBQUFBMEFJQXdIQUFEQUFnQWdDQUFBd3dJQUlLa0JBQURGQWdBd3FnRUFBQklBRUtzQkFBREZBZ0F3ckFFQkFKTUNBQ0d0QVFFQWt3SUFJYTRCQVFDVEFnQWhyd0ZBQUpvQ0FDSEtBVUFBbWdJQUlkUUJBZ0NaQWdBaDNBRUJBSk1DQUNFQ0J3QUFvZ1FBSUFnQUFLTUVBQ0FOQndBQXdBSUFJQWdBQU1NQ0FDQ3BBUUFBeFFJQU1Lb0JBQUFTQUJDckFRQUF4UUlBTUt3QkFRQUFBQUd0QVFFQWt3SUFJYTRCQVFDVEFnQWhyd0ZBQUpvQ0FDSEtBVUFBbWdJQUlkUUJBZ0NaQWdBaDNBRUJBSk1DQUNIMkFRQUF4QUlBSUFNQUFBQVNBQ0FCQUFBVEFEQUNBQUFVQUNBSkJ3QUF3QUlBSUFnQUFNTUNBQ0NwQVFBQXdnSUFNS29CQUFBV0FCQ3JBUUFBd2dJQU1Ld0JBUUNUQWdBaHJRRUJBSk1DQUNHdUFRRUFrd0lBSWE4QlFBQ2FBZ0FoQWdjQUFLSUVBQ0FJQUFDakJBQWdDZ2NBQU1BQ0FDQUlBQUREQWdBZ3FRRUFBTUlDQURDcUFRQUFGZ0FRcXdFQUFNSUNBRENzQVFFQUFBQUJyUUVCQUpNQ0FDR3VBUUVBa3dJQUlhOEJRQUNhQWdBaDlnRUFBTUVDQUNBREFBQUFGZ0FnQVFBQUZ3QXdBZ0FBR0FBZ0FRQUFBQWtBSUFFQUFBQVNBQ0FCQUFBQUZnQWdBd0FBQUFrQUlBRUFBQW9BTUFJQUFBc0FJQU1BQUFBU0FDQUJBQUFUQURBQ0FBQVVBQ0FQRUFBQXdBSUFJS2tCQUFDLUFnQXdxZ0VBQUI4QUVLc0JBQUMtQWdBd3JBRUJBSk1DQUNHdkFVQUFtZ0lBSWNRQkFBQ19BdlVCSXNnQklBQ1lBZ0FoeWdGQUFKb0NBQ0hPQVFFQWt3SUFJYzhCQVFDVEFnQWg4UUVCQUpNQ0FDSHlBUUVBa3dJQUlmTUJBUUNUQWdBaDlRRUJBSk1DQUNFQkVBQUFvZ1FBSUFNQUFBQWZBQ0FCQUFBZ0FEQUNBQUFCQUNBREFBQUFGZ0FnQVFBQUZ3QXdBZ0FBR0FBZ0FRQUFBQU1BSUFFQUFBQUpBQ0FCQUFBQUVnQWdBUUFBQUI4QUlBRUFBQUFXQUNBQkFBQUFBUUFnQXdBQUFCOEFJQUVBQUNBQU1BSUFBQUVBSUFNQUFBQWZBQ0FCQUFBZ0FEQUNBQUFCQUNBREFBQUFId0FnQVFBQUlBQXdBZ0FBQVFBZ0RCQUFBS0VFQUNDc0FRRUFBQUFCcndGQUFBQUFBY1FCQUFBQTlRRUN5QUVnQUFBQUFjb0JRQUFBQUFIT0FRRUFBQUFCendFQkFBQUFBZkVCQVFBQUFBSHlBUUVBQUFBQjh3RUJBQUFBQWZVQkFRQUFBQUVCRmdBQUxBQWdDNndCQVFBQUFBR3ZBVUFBQUFBQnhBRUFBQUQxQVFMSUFTQUFBQUFCeWdGQUFBQUFBYzRCQVFBQUFBSFBBUUVBQUFBQjhRRUJBQUFBQWZJQkFRQUFBQUh6QVFFQUFBQUI5UUVCQUFBQUFRRVdBQUF1QURBQkZnQUFMZ0F3REJBQUFLQUVBQ0NzQVFFQTFRSUFJYThCUUFEV0FnQWh4QUVBQUlJRDlRRWl5QUVnQU9VQ0FDSEtBVUFBMWdJQUljNEJBUURWQWdBaHp3RUJBTlVDQUNIeEFRRUExUUlBSWZJQkFRRFZBZ0FoOHdFQkFOVUNBQ0gxQVFFQTFRSUFJUUlBQUFBQkFDQVdBQUF4QUNBTHJBRUJBTlVDQUNHdkFVQUExZ0lBSWNRQkFBQ0NBX1VCSXNnQklBRGxBZ0FoeWdGQUFOWUNBQ0hPQVFFQTFRSUFJYzhCQVFEVkFnQWg4UUVCQU5VQ0FDSHlBUUVBMVFJQUlmTUJBUURWQWdBaDlRRUJBTlVDQUNFQ0FBQUFId0FnRmdBQU13QWdBZ0FBQUI4QUlCWUFBRE1BSUFNQUFBQUJBQ0FkQUFBc0FDQWVBQUF4QUNBQkFBQUFBUUFnQVFBQUFCOEFJQU1FQUFDZEJBQWdJd0FBbndRQUlDUUFBSjRFQUNBT3FRRUFBTG9DQURDcUFRQUFPZ0FRcXdFQUFMb0NBRENzQVFFQTl3RUFJYThCUUFENEFRQWh4QUVBQUxzQzlRRWl5QUVnQUlNQ0FDSEtBVUFBLUFFQUljNEJBUUQzQVFBaHp3RUJBUGNCQUNIeEFRRUE5d0VBSWZJQkFRRDNBUUFoOHdFQkFQY0JBQ0gxQVFFQTl3RUFJUU1BQUFBZkFDQUJBQUE1QURBaUFBQTZBQ0FEQUFBQUh3QWdBUUFBSUFBd0FnQUFBUUFnQVFBQUFBc0FJQUVBQUFBTEFDQURBQUFBQ1FBZ0FRQUFDZ0F3QWdBQUN3QWdBd0FBQUFrQUlBRUFBQW9BTUFJQUFBc0FJQU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FNQndBQTR3TUFJQWdBQUxFREFDQUtBQUN5QXdBZ3JBRUJBQUFBQWEwQkFRQUFBQUd1QVFFQUFBQUJyd0ZBQUFBQUFjUUJBQUFBOFFFQ3lnRkFBQUFBQWUwQlFBQUFBQUh1QVFJQUFBQUI3d0VRQUFBQUFRRVdBQUJDQUNBSnJBRUJBQUFBQWEwQkFRQUFBQUd1QVFFQUFBQUJyd0ZBQUFBQUFjUUJBQUFBOFFFQ3lnRkFBQUFBQWUwQlFBQUFBQUh1QVFJQUFBQUI3d0VRQUFBQUFRRVdBQUJFQURBQkZnQUFSQUF3REFjQUFPRURBQ0FJQUFDZ0F3QWdDZ0FBb1FNQUlLd0JBUURWQWdBaHJRRUJBTlVDQUNHdUFRRUExUUlBSWE4QlFBRFdBZ0FoeEFFQUFKNEQ4UUVpeWdGQUFOWUNBQ0h0QVVBQTFnSUFJZTRCQWdEbUFnQWg3d0VRQUowREFDRUNBQUFBQ3dBZ0ZnQUFSd0FnQ2F3QkFRRFZBZ0FoclFFQkFOVUNBQ0d1QVFFQTFRSUFJYThCUUFEV0FnQWh4QUVBQUo0RDhRRWl5Z0ZBQU5ZQ0FDSHRBVUFBMWdJQUllNEJBZ0RtQWdBaDd3RVFBSjBEQUNFQ0FBQUFDUUFnRmdBQVNRQWdBZ0FBQUFrQUlCWUFBRWtBSUFNQUFBQUxBQ0FkQUFCQ0FDQWVBQUJIQUNBQkFBQUFDd0FnQVFBQUFBa0FJQVVFQUFDWUJBQWdJd0FBbXdRQUlDUUFBSm9FQUNBMUFBQ1pCQUFnTmdBQW5BUUFJQXlwQVFBQXRnSUFNS29CQUFCUUFCQ3JBUUFBdGdJQU1Ld0JBUUQzQVFBaHJRRUJBUGNCQUNHdUFRRUE5d0VBSWE4QlFBRDRBUUFoeEFFQUFMY0M4UUVpeWdGQUFQZ0JBQ0h0QVVBQS1BRUFJZTRCQWdDRUFnQWg3d0VRQUtFQ0FDRURBQUFBQ1FBZ0FRQUFUd0F3SWdBQVVBQWdBd0FBQUFrQUlBRUFBQW9BTUFJQUFBc0FJQWtEQUFDYkFnQWdxUUVBQUxVQ0FEQ3FBUUFBVmdBUXF3RUFBTFVDQURDc0FRRUFBQUFCcndGQUFKb0NBQ0c3QVFFQUFBQUJ5Z0ZBQUpvQ0FDSFBBUUVBQUFBQkFRQUFBRk1BSUFFQUFBQlRBQ0FKQXdBQW13SUFJS2tCQUFDMUFnQXdxZ0VBQUZZQUVLc0JBQUMxQWdBd3JBRUJBSk1DQUNHdkFVQUFtZ0lBSWJzQkFRQ1RBZ0FoeWdGQUFKb0NBQ0hQQVFFQWt3SUFJUUVEQUFEdkF3QWdBd0FBQUZZQUlBRUFBRmNBTUFJQUFGTUFJQU1BQUFCV0FDQUJBQUJYQURBQ0FBQlRBQ0FEQUFBQVZnQWdBUUFBVndBd0FnQUFVd0FnQmdNQUFKY0VBQ0NzQVFFQUFBQUJyd0ZBQUFBQUFic0JBUUFBQUFIS0FVQUFBQUFCendFQkFBQUFBUUVXQUFCYkFDQUZyQUVCQUFBQUFhOEJRQUFBQUFHN0FRRUFBQUFCeWdGQUFBQUFBYzhCQVFBQUFBRUJGZ0FBWFFBd0FSWUFBRjBBTUFZREFBQ05CQUFnckFFQkFOVUNBQ0d2QVVBQTFnSUFJYnNCQVFEVkFnQWh5Z0ZBQU5ZQ0FDSFBBUUVBMVFJQUlRSUFBQUJUQUNBV0FBQmdBQ0FGckFFQkFOVUNBQ0d2QVVBQTFnSUFJYnNCQVFEVkFnQWh5Z0ZBQU5ZQ0FDSFBBUUVBMVFJQUlRSUFBQUJXQUNBV0FBQmlBQ0FDQUFBQVZnQWdGZ0FBWWdBZ0F3QUFBRk1BSUIwQUFGc0FJQjRBQUdBQUlBRUFBQUJUQUNBQkFBQUFWZ0FnQXdRQUFJb0VBQ0FqQUFDTUJBQWdKQUFBaXdRQUlBaXBBUUFBdEFJQU1Lb0JBQUJwQUJDckFRQUF0QUlBTUt3QkFRRDNBUUFocndGQUFQZ0JBQ0c3QVFFQTl3RUFJY29CUUFENEFRQWh6d0VCQVBjQkFDRURBQUFBVmdBZ0FRQUFhQUF3SWdBQWFRQWdBd0FBQUZZQUlBRUFBRmNBTUFJQUFGTUFJQXVwQVFBQXN3SUFNS29CQUFCdkFCQ3JBUUFBc3dJQU1Ld0JBUUFBQUFHdkFVQUFtZ0lBSWJzQkFRQ1RBZ0FodkFFQkFKTUNBQ0hLQVVBQW1nSUFJZW9CQVFDVEFnQWg2d0VCQUpNQ0FDSHNBU0FBbUFJQUlRRUFBQUJzQUNBQkFBQUFiQUFnQzZrQkFBQ3pBZ0F3cWdFQUFHOEFFS3NCQUFDekFnQXdyQUVCQUpNQ0FDR3ZBVUFBbWdJQUlic0JBUUNUQWdBaHZBRUJBSk1DQUNIS0FVQUFtZ0lBSWVvQkFRQ1RBZ0FoNndFQkFKTUNBQ0hzQVNBQW1BSUFJUUFEQUFBQWJ3QWdBUUFBY0FBd0FnQUFiQUFnQXdBQUFHOEFJQUVBQUhBQU1BSUFBR3dBSUFNQUFBQnZBQ0FCQUFCd0FEQUNBQUJzQUNBSXJBRUJBQUFBQWE4QlFBQUFBQUc3QVFFQUFBQUJ2QUVCQUFBQUFjb0JRQUFBQUFIcUFRRUFBQUFCNndFQkFBQUFBZXdCSUFBQUFBRUJGZ0FBZEFBZ0NLd0JBUUFBQUFHdkFVQUFBQUFCdXdFQkFBQUFBYndCQVFBQUFBSEtBVUFBQUFBQjZnRUJBQUFBQWVzQkFRQUFBQUhzQVNBQUFBQUJBUllBQUhZQU1BRVdBQUIyQURBSXJBRUJBTlVDQUNHdkFVQUExZ0lBSWJzQkFRRFZBZ0FodkFFQkFOVUNBQ0hLQVVBQTFnSUFJZW9CQVFEVkFnQWg2d0VCQU5VQ0FDSHNBU0FBNVFJQUlRSUFBQUJzQUNBV0FBQjVBQ0FJckFFQkFOVUNBQ0d2QVVBQTFnSUFJYnNCQVFEVkFnQWh2QUVCQU5VQ0FDSEtBVUFBMWdJQUllb0JBUURWQWdBaDZ3RUJBTlVDQUNIc0FTQUE1UUlBSVFJQUFBQnZBQ0FXQUFCN0FDQUNBQUFBYndBZ0ZnQUFld0FnQXdBQUFHd0FJQjBBQUhRQUlCNEFBSGtBSUFFQUFBQnNBQ0FCQUFBQWJ3QWdBd1FBQUljRUFDQWpBQUNKQkFBZ0pBQUFpQVFBSUF1cEFRQUFzZ0lBTUtvQkFBQ0NBUUFRcXdFQUFMSUNBRENzQVFFQTl3RUFJYThCUUFENEFRQWh1d0VCQVBjQkFDRzhBUUVBOXdFQUljb0JRQUQ0QVFBaDZnRUJBUGNCQUNIckFRRUE5d0VBSWV3QklBQ0RBZ0FoQXdBQUFHOEFJQUVBQUlFQkFEQWlBQUNDQVFBZ0F3QUFBRzhBSUFFQUFIQUFNQUlBQUd3QUlBRUFBQUFQQUNBQkFBQUFEd0FnQXdBQUFBMEFJQUVBQUE0QU1BSUFBQThBSUFNQUFBQU5BQ0FCQUFBT0FEQUNBQUFQQUNBREFBQUFEUUFnQVFBQURnQXdBZ0FBRHdBZ0VRa0FBSVlFQUNDc0FRRUFBQUFCcndGQUFBQUFBY1FCQUFBQTR3RUN5Z0ZBQUFBQUFkMEJBUUFBQUFIZUFRRUFBQUFCM3dFQkFBQUFBZUFCRUFBQUFBSGhBUUVBQUFBQjR3RUJBQUFBQWVRQkFRQUFBQUhsQVFFQUFBQUI1Z0VCQUFBQUFlY0JRQUFBQUFIb0FRRUFBQUFCNlFGQUFBQUFBUUVXQUFDS0FRQWdFS3dCQVFBQUFBR3ZBVUFBQUFBQnhBRUFBQURqQVFMS0FVQUFBQUFCM1FFQkFBQUFBZDRCQVFBQUFBSGZBUUVBQUFBQjRBRVFBQUFBQWVFQkFRQUFBQUhqQVFFQUFBQUI1QUVCQUFBQUFlVUJBUUFBQUFIbUFRRUFBQUFCNXdGQUFBQUFBZWdCQVFBQUFBSHBBVUFBQUFBQkFSWUFBSXdCQURBQkZnQUFqQUVBTUJFSkFBQ0ZCQUFnckFFQkFOVUNBQ0d2QVVBQTFnSUFJY1FCQUFDc0EtTUJJc29CUUFEV0FnQWgzUUVCQU5VQ0FDSGVBUUVBMVFJQUlkOEJBUURoQWdBaDRBRVFBSjBEQUNIaEFRRUExUUlBSWVNQkFRRGhBZ0FoNUFFQkFPRUNBQ0hsQVFFQTRRSUFJZVlCQVFEaEFnQWg1d0ZBQUswREFDSG9BUUVBNFFJQUlla0JRQUN0QXdBaEFnQUFBQThBSUJZQUFJOEJBQ0FRckFFQkFOVUNBQ0d2QVVBQTFnSUFJY1FCQUFDc0EtTUJJc29CUUFEV0FnQWgzUUVCQU5VQ0FDSGVBUUVBMVFJQUlkOEJBUURoQWdBaDRBRVFBSjBEQUNIaEFRRUExUUlBSWVNQkFRRGhBZ0FoNUFFQkFPRUNBQ0hsQVFFQTRRSUFJZVlCQVFEaEFnQWg1d0ZBQUswREFDSG9BUUVBNFFJQUlla0JRQUN0QXdBaEFnQUFBQTBBSUJZQUFKRUJBQ0FDQUFBQURRQWdGZ0FBa1FFQUlBTUFBQUFQQUNBZEFBQ0tBUUFnSGdBQWp3RUFJQUVBQUFBUEFDQUJBQUFBRFFBZ0RRUUFBSUFFQUNBakFBQ0RCQUFnSkFBQWdnUUFJRFVBQUlFRUFDQTJBQUNFQkFBZzN3RUFBTnNDQUNEakFRQUEyd0lBSU9RQkFBRGJBZ0FnNVFFQUFOc0NBQ0RtQVFBQTJ3SUFJT2NCQUFEYkFnQWc2QUVBQU5zQ0FDRHBBUUFBMndJQUlCT3BBUUFBcXdJQU1Lb0JBQUNZQVFBUXF3RUFBS3NDQURDc0FRRUE5d0VBSWE4QlFBRDRBUUFoeEFFQUFLd0M0d0VpeWdGQUFQZ0JBQ0hkQVFFQTl3RUFJZDRCQVFEM0FRQWgzd0VCQVA4QkFDSGdBUkFBb1FJQUllRUJBUUQzQVFBaDR3RUJBUDhCQUNIa0FRRUFfd0VBSWVVQkFRRF9BUUFoNWdFQkFQOEJBQ0huQVVBQXJRSUFJZWdCQVFEX0FRQWg2UUZBQUswQ0FDRURBQUFBRFFBZ0FRQUFsd0VBTUNJQUFKZ0JBQ0FEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQVFBQUFCUUFJQUVBQUFBVUFDQURBQUFBRWdBZ0FRQUFFd0F3QWdBQUZBQWdBd0FBQUJJQUlBRUFBQk1BTUFJQUFCUUFJQU1BQUFBU0FDQUJBQUFUQURBQ0FBQVVBQ0FKQndBQTJBTUFJQWdBQUpJREFDQ3NBUUVBQUFBQnJRRUJBQUFBQWE0QkFRQUFBQUd2QVVBQUFBQUJ5Z0ZBQUFBQUFkUUJBZ0FBQUFIY0FRRUFBQUFCQVJZQUFLQUJBQ0FIckFFQkFBQUFBYTBCQVFBQUFBR3VBUUVBQUFBQnJ3RkFBQUFBQWNvQlFBQUFBQUhVQVFJQUFBQUIzQUVCQUFBQUFRRVdBQUNpQVFBd0FSWUFBS0lCQURBSkJ3QUExZ01BSUFnQUFKQURBQ0NzQVFFQTFRSUFJYTBCQVFEVkFnQWhyZ0VCQU5VQ0FDR3ZBVUFBMWdJQUljb0JRQURXQWdBaDFBRUNBT1lDQUNIY0FRRUExUUlBSVFJQUFBQVVBQ0FXQUFDbEFRQWdCNndCQVFEVkFnQWhyUUVCQU5VQ0FDR3VBUUVBMVFJQUlhOEJRQURXQWdBaHlnRkFBTllDQUNIVUFRSUE1Z0lBSWR3QkFRRFZBZ0FoQWdBQUFCSUFJQllBQUtjQkFDQUNBQUFBRWdBZ0ZnQUFwd0VBSUFNQUFBQVVBQ0FkQUFDZ0FRQWdIZ0FBcFFFQUlBRUFBQUFVQUNBQkFBQUFFZ0FnQlFRQUFQc0RBQ0FqQUFELUF3QWdKQUFBX1FNQUlEVUFBUHdEQUNBMkFBRF9Bd0FnQ3FrQkFBQ3FBZ0F3cWdFQUFLNEJBQkNyQVFBQXFnSUFNS3dCQVFEM0FRQWhyUUVCQVBjQkFDR3VBUUVBOXdFQUlhOEJRQUQ0QVFBaHlnRkFBUGdCQUNIVUFRSUFoQUlBSWR3QkFRRDNBUUFoQXdBQUFCSUFJQUVBQUswQkFEQWlBQUN1QVFBZ0F3QUFBQklBSUFFQUFCTUFNQUlBQUJRQUlBRUFBQUFGQUNBQkFBQUFCUUFnQXdBQUFBTUFJQUVBQUFRQU1BSUFBQVVBSUFNQUFBQURBQ0FCQUFBRUFEQUNBQUFGQUNBREFBQUFBd0FnQVFBQUJBQXdBZ0FBQlFBZ0ZBVUFBT1lEQUNBR0FBRDZBd0FnQ3dBQTV3TUFJQXdBQU9nREFDQU5BQURwQXdBZ3JBRUJBQUFBQWE4QlFBQUFBQUhFQVFBQUFOY0JBc2dCSUFBQUFBSEtBVUFBQUFBQnpnRUJBQUFBQWM4QkFRQUFBQUhRQVFFQUFBQUIwUUVCQUFBQUFkSUJFQUFBQUFIVEFRSUFBQUFCMUFFSUFBQUFBZFVCQUFEbEF3QWcxd0VCQUFBQUFkZ0JBUUFBQUFFQkZnQUF0Z0VBSUEtc0FRRUFBQUFCcndGQUFBQUFBY1FCQUFBQTF3RUN5QUVnQUFBQUFjb0JRQUFBQUFIT0FRRUFBQUFCendFQkFBQUFBZEFCQVFBQUFBSFJBUUVBQUFBQjBnRVFBQUFBQWRNQkFnQUFBQUhVQVFnQUFBQUIxUUVBQU9VREFDRFhBUUVBQUFBQjJBRUJBQUFBQVFFV0FBQzRBUUF3QVJZQUFMZ0JBREFVQlFBQXdRTUFJQVlBQVBrREFDQUxBQURDQXdBZ0RBQUF3d01BSUEwQUFNUURBQ0NzQVFFQTFRSUFJYThCUUFEV0FnQWh4QUVBQUw4RDF3RWl5QUVnQU9VQ0FDSEtBVUFBMWdJQUljNEJBUURWQWdBaHp3RUJBTlVDQUNIUUFRRUExUUlBSWRFQkFRRFZBZ0FoMGdFUUFKMERBQ0hUQVFJQTVnSUFJZFFCQ0FDOUF3QWgxUUVBQUw0REFDRFhBUUVBMVFJQUlkZ0JBUURWQWdBaEFnQUFBQVVBSUJZQUFMc0JBQ0FQckFFQkFOVUNBQ0d2QVVBQTFnSUFJY1FCQUFDX0E5Y0JJc2dCSUFEbEFnQWh5Z0ZBQU5ZQ0FDSE9BUUVBMVFJQUljOEJBUURWQWdBaDBBRUJBTlVDQUNIUkFRRUExUUlBSWRJQkVBQ2RBd0FoMHdFQ0FPWUNBQ0hVQVFnQXZRTUFJZFVCQUFDLUF3QWcxd0VCQU5VQ0FDSFlBUUVBMVFJQUlRSUFBQUFEQUNBV0FBQzlBUUFnQWdBQUFBTUFJQllBQUwwQkFDQURBQUFBQlFBZ0hRQUF0Z0VBSUI0QUFMc0JBQ0FCQUFBQUJRQWdBUUFBQUFNQUlBVUVBQUQwQXdBZ0l3QUE5d01BSUNRQUFQWURBQ0ExQUFEMUF3QWdOZ0FBLUFNQUlCS3BBUUFBb0FJQU1Lb0JBQURFQVFBUXF3RUFBS0FDQURDc0FRRUE5d0VBSWE4QlFBRDRBUUFoeEFFQUFLUUMxd0VpeUFFZ0FJTUNBQ0hLQVVBQS1BRUFJYzRCQVFEM0FRQWh6d0VCQVBjQkFDSFFBUUVBOXdFQUlkRUJBUUQzQVFBaDBnRVFBS0VDQUNIVEFRSUFoQUlBSWRRQkNBQ2lBZ0FoMVFFQUFLTUNBQ0RYQVFFQTl3RUFJZGdCQVFEM0FRQWhBd0FBQUFNQUlBRUFBTU1CQURBaUFBREVBUUFnQXdBQUFBTUFJQUVBQUFRQU1BSUFBQVVBSUJjREFBQ2JBZ0FnQ3dBQW5BSUFJQXdBQUowQ0FDQU9BQUNlQWdBZ0R3QUFud0lBSUtrQkFBQ1NBZ0F3cWdFQUFNb0JBQkNyQVFBQWtnSUFNS3dCQVFBQUFBR3ZBVUFBbWdJQUlic0JBUUNUQWdBaHZBRUJBQUFBQWIwQkFRQ1VBZ0FodmdFQkFBQUFBYjhCQVFDVUFnQWh3QUVCQUpRQ0FDSENBUUFBbFFMQ0FTTEVBUUFBbGdMRUFTTEdBUUFBbHdMR0FTTEhBU0FBbUFJQUljZ0JJQUNZQWdBaHlRRUNBSmtDQUNIS0FVQUFtZ0lBSVFFQUFBREhBUUFnQVFBQUFNY0JBQ0FYQXdBQW13SUFJQXNBQUp3Q0FDQU1BQUNkQWdBZ0RnQUFuZ0lBSUE4QUFKOENBQ0NwQVFBQWtnSUFNS29CQUFES0FRQVFxd0VBQUpJQ0FEQ3NBUUVBa3dJQUlhOEJRQUNhQWdBaHV3RUJBSk1DQUNHOEFRRUFrd0lBSWIwQkFRQ1VBZ0FodmdFQkFKUUNBQ0dfQVFFQWxBSUFJY0FCQVFDVUFnQWh3Z0VBQUpVQ3dnRWl4QUVBQUpZQ3hBRWl4Z0VBQUpjQ3hnRWl4d0VnQUpnQ0FDSElBU0FBbUFJQUlja0JBZ0NaQWdBaHlnRkFBSm9DQUNFSkF3QUE3d01BSUFzQUFQQURBQ0FNQUFEeEF3QWdEZ0FBOGdNQUlBOEFBUE1EQUNDOUFRQUEyd0lBSUw0QkFBRGJBZ0FndndFQUFOc0NBQ0RBQVFBQTJ3SUFJQU1BQUFES0FRQWdBUUFBeXdFQU1BSUFBTWNCQUNBREFBQUF5Z0VBSUFFQUFNc0JBREFDQUFESEFRQWdBd0FBQU1vQkFDQUJBQURMQVFBd0FnQUF4d0VBSUJRREFBRHFBd0FnQ3dBQTZ3TUFJQXdBQU93REFDQU9BQUR0QXdBZ0R3QUE3Z01BSUt3QkFRQUFBQUd2QVVBQUFBQUJ1d0VCQUFBQUFid0JBUUFBQUFHOUFRRUFBQUFCdmdFQkFBQUFBYjhCQVFBQUFBSEFBUUVBQUFBQndnRUFBQURDQVFMRUFRQUFBTVFCQXNZQkFBQUF4Z0VDeHdFZ0FBQUFBY2dCSUFBQUFBSEpBUUlBQUFBQnlnRkFBQUFBQVFFV0FBRFBBUUFnRDZ3QkFRQUFBQUd2QVVBQUFBQUJ1d0VCQUFBQUFid0JBUUFBQUFHOUFRRUFBQUFCdmdFQkFBQUFBYjhCQVFBQUFBSEFBUUVBQUFBQndnRUFBQURDQVFMRUFRQUFBTVFCQXNZQkFBQUF4Z0VDeHdFZ0FBQUFBY2dCSUFBQUFBSEpBUUlBQUFBQnlnRkFBQUFBQVFFV0FBRFJBUUF3QVJZQUFORUJBREFVQXdBQTV3SUFJQXNBQU9nQ0FDQU1BQURwQWdBZ0RnQUE2Z0lBSUE4QUFPc0NBQ0NzQVFFQTFRSUFJYThCUUFEV0FnQWh1d0VCQU5VQ0FDRzhBUUVBMVFJQUliMEJBUURoQWdBaHZnRUJBT0VDQUNHX0FRRUE0UUlBSWNBQkFRRGhBZ0Fod2dFQUFPSUN3Z0VpeEFFQUFPTUN4QUVpeGdFQUFPUUN4Z0VpeHdFZ0FPVUNBQ0hJQVNBQTVRSUFJY2tCQWdEbUFnQWh5Z0ZBQU5ZQ0FDRUNBQUFBeHdFQUlCWUFBTlFCQUNBUHJBRUJBTlVDQUNHdkFVQUExZ0lBSWJzQkFRRFZBZ0FodkFFQkFOVUNBQ0c5QVFFQTRRSUFJYjRCQVFEaEFnQWh2d0VCQU9FQ0FDSEFBUUVBNFFJQUljSUJBQURpQXNJQklzUUJBQURqQXNRQklzWUJBQURrQXNZQklzY0JJQURsQWdBaHlBRWdBT1VDQUNISkFRSUE1Z0lBSWNvQlFBRFdBZ0FoQWdBQUFNb0JBQ0FXQUFEV0FRQWdBZ0FBQU1vQkFDQVdBQURXQVFBZ0F3QUFBTWNCQUNBZEFBRFBBUUFnSGdBQTFBRUFJQUVBQUFESEFRQWdBUUFBQU1vQkFDQUpCQUFBM0FJQUlDTUFBTjhDQUNBa0FBRGVBZ0FnTlFBQTNRSUFJRFlBQU9BQ0FDQzlBUUFBMndJQUlMNEJBQURiQWdBZ3Z3RUFBTnNDQUNEQUFRQUEyd0lBSUJLcEFRQUFfZ0VBTUtvQkFBRGRBUUFRcXdFQUFQNEJBRENzQVFFQTl3RUFJYThCUUFENEFRQWh1d0VCQVBjQkFDRzhBUUVBOXdFQUliMEJBUURfQVFBaHZnRUJBUDhCQUNHX0FRRUFfd0VBSWNBQkFRRF9BUUFod2dFQUFJQUN3Z0VpeEFFQUFJRUN4QUVpeGdFQUFJSUN4Z0VpeHdFZ0FJTUNBQ0hJQVNBQWd3SUFJY2tCQWdDRUFnQWh5Z0ZBQVBnQkFDRURBQUFBeWdFQUlBRUFBTndCQURBaUFBRGRBUUFnQXdBQUFNb0JBQ0FCQUFETEFRQXdBZ0FBeHdFQUlBRUFBQUFZQUNBQkFBQUFHQUFnQXdBQUFCWUFJQUVBQUJjQU1BSUFBQmdBSUFNQUFBQVdBQ0FCQUFBWEFEQUNBQUFZQUNBREFBQUFGZ0FnQVFBQUZ3QXdBZ0FBR0FBZ0JnY0FBTmtDQUNBSUFBRGFBZ0FnckFFQkFBQUFBYTBCQVFBQUFBR3VBUUVBQUFBQnJ3RkFBQUFBQVFFV0FBRGxBUUFnQkt3QkFRQUFBQUd0QVFFQUFBQUJyZ0VCQUFBQUFhOEJRQUFBQUFFQkZnQUE1d0VBTUFFV0FBRG5BUUF3QmdjQUFOY0NBQ0FJQUFEWUFnQWdyQUVCQU5VQ0FDR3RBUUVBMVFJQUlhNEJBUURWQWdBaHJ3RkFBTllDQUNFQ0FBQUFHQUFnRmdBQTZnRUFJQVNzQVFFQTFRSUFJYTBCQVFEVkFnQWhyZ0VCQU5VQ0FDR3ZBVUFBMWdJQUlRSUFBQUFXQUNBV0FBRHNBUUFnQWdBQUFCWUFJQllBQU93QkFDQURBQUFBR0FBZ0hRQUE1UUVBSUI0QUFPb0JBQ0FCQUFBQUdBQWdBUUFBQUJZQUlBTUVBQURTQWdBZ0l3QUExQUlBSUNRQUFOTUNBQ0FIcVFFQUFQWUJBRENxQVFBQTh3RUFFS3NCQUFEMkFRQXdyQUVCQVBjQkFDR3RBUUVBOXdFQUlhNEJBUUQzQVFBaHJ3RkFBUGdCQUNFREFBQUFGZ0FnQVFBQThnRUFNQ0lBQVBNQkFDQURBQUFBRmdBZ0FRQUFGd0F3QWdBQUdBQWdCNmtCQUFEMkFRQXdxZ0VBQVBNQkFCQ3JBUUFBOWdFQU1Ld0JBUUQzQVFBaHJRRUJBUGNCQUNHdUFRRUE5d0VBSWE4QlFBRDRBUUFoRGdRQUFQb0JBQ0FqQUFEOUFRQWdKQUFBX1FFQUlMQUJBUUFBQUFHeEFRRUFBQUFFc2dFQkFBQUFCTE1CQVFBQUFBRzBBUUVBQUFBQnRRRUJBQUFBQWJZQkFRQUFBQUczQVFFQV9BRUFJYmdCQVFBQUFBRzVBUUVBQUFBQnVnRUJBQUFBQVFzRUFBRDZBUUFnSXdBQS13RUFJQ1FBQVBzQkFDQ3dBVUFBQUFBQnNRRkFBQUFBQkxJQlFBQUFBQVN6QVVBQUFBQUJ0QUZBQUFBQUFiVUJRQUFBQUFHMkFVQUFBQUFCdHdGQUFQa0JBQ0VMQkFBQS1nRUFJQ01BQVBzQkFDQWtBQUQ3QVFBZ3NBRkFBQUFBQWJFQlFBQUFBQVN5QVVBQUFBQUVzd0ZBQUFBQUFiUUJRQUFBQUFHMUFVQUFBQUFCdGdGQUFBQUFBYmNCUUFENUFRQWhDTEFCQWdBQUFBR3hBUUlBQUFBRXNnRUNBQUFBQkxNQkFnQUFBQUcwQVFJQUFBQUJ0UUVDQUFBQUFiWUJBZ0FBQUFHM0FRSUEtZ0VBSVFpd0FVQUFBQUFCc1FGQUFBQUFCTElCUUFBQUFBU3pBVUFBQUFBQnRBRkFBQUFBQWJVQlFBQUFBQUcyQVVBQUFBQUJ0d0ZBQVBzQkFDRU9CQUFBLWdFQUlDTUFBUDBCQUNBa0FBRDlBUUFnc0FFQkFBQUFBYkVCQVFBQUFBU3lBUUVBQUFBRXN3RUJBQUFBQWJRQkFRQUFBQUcxQVFFQUFBQUJ0Z0VCQUFBQUFiY0JBUUQ4QVFBaHVBRUJBQUFBQWJrQkFRQUFBQUc2QVFFQUFBQUJDN0FCQVFBQUFBR3hBUUVBQUFBRXNnRUJBQUFBQkxNQkFRQUFBQUcwQVFFQUFBQUJ0UUVCQUFBQUFiWUJBUUFBQUFHM0FRRUFfUUVBSWJnQkFRQUFBQUc1QVFFQUFBQUJ1Z0VCQUFBQUFSS3BBUUFBX2dFQU1Lb0JBQURkQVFBUXF3RUFBUDRCQURDc0FRRUE5d0VBSWE4QlFBRDRBUUFodXdFQkFQY0JBQ0c4QVFFQTl3RUFJYjBCQVFEX0FRQWh2Z0VCQVA4QkFDR19BUUVBX3dFQUljQUJBUURfQVFBaHdnRUFBSUFDd2dFaXhBRUFBSUVDeEFFaXhnRUFBSUlDeGdFaXh3RWdBSU1DQUNISUFTQUFnd0lBSWNrQkFnQ0VBZ0FoeWdGQUFQZ0JBQ0VPQkFBQWtBSUFJQ01BQUpFQ0FDQWtBQUNSQWdBZ3NBRUJBQUFBQWJFQkFRQUFBQVd5QVFFQUFBQUZzd0VCQUFBQUFiUUJBUUFBQUFHMUFRRUFBQUFCdGdFQkFBQUFBYmNCQVFDUEFnQWh1QUVCQUFBQUFia0JBUUFBQUFHNkFRRUFBQUFCQndRQUFQb0JBQ0FqQUFDT0FnQWdKQUFBamdJQUlMQUJBQUFBd2dFQ3NRRUFBQURDQVFpeUFRQUFBTUlCQ0xjQkFBQ05Bc0lCSWdjRUFBRDZBUUFnSXdBQWpBSUFJQ1FBQUl3Q0FDQ3dBUUFBQU1RQkFyRUJBQUFBeEFFSXNnRUFBQURFQVFpM0FRQUFpd0xFQVNJSEJBQUEtZ0VBSUNNQUFJb0NBQ0FrQUFDS0FnQWdzQUVBQUFER0FRS3hBUUFBQU1ZQkNMSUJBQUFBeGdFSXR3RUFBSWtDeGdFaUJRUUFBUG9CQUNBakFBQ0lBZ0FnSkFBQWlBSUFJTEFCSUFBQUFBRzNBU0FBaHdJQUlRMEVBQUQ2QVFBZ0l3QUEtZ0VBSUNRQUFQb0JBQ0ExQUFDR0FnQWdOZ0FBLWdFQUlMQUJBZ0FBQUFHeEFRSUFBQUFFc2dFQ0FBQUFCTE1CQWdBQUFBRzBBUUlBQUFBQnRRRUNBQUFBQWJZQkFnQUFBQUczQVFJQWhRSUFJUTBFQUFENkFRQWdJd0FBLWdFQUlDUUFBUG9CQUNBMUFBQ0dBZ0FnTmdBQS1nRUFJTEFCQWdBQUFBR3hBUUlBQUFBRXNnRUNBQUFBQkxNQkFnQUFBQUcwQVFJQUFBQUJ0UUVDQUFBQUFiWUJBZ0FBQUFHM0FRSUFoUUlBSVFpd0FRZ0FBQUFCc1FFSUFBQUFCTElCQ0FBQUFBU3pBUWdBQUFBQnRBRUlBQUFBQWJVQkNBQUFBQUcyQVFnQUFBQUJ0d0VJQUlZQ0FDRUZCQUFBLWdFQUlDTUFBSWdDQUNBa0FBQ0lBZ0Fnc0FFZ0FBQUFBYmNCSUFDSEFnQWhBckFCSUFBQUFBRzNBU0FBaUFJQUlRY0VBQUQ2QVFBZ0l3QUFpZ0lBSUNRQUFJb0NBQ0N3QVFBQUFNWUJBckVCQUFBQXhnRUlzZ0VBQUFER0FRaTNBUUFBaVFMR0FTSUVzQUVBQUFER0FRS3hBUUFBQU1ZQkNMSUJBQUFBeGdFSXR3RUFBSW9DeGdFaUJ3UUFBUG9CQUNBakFBQ01BZ0FnSkFBQWpBSUFJTEFCQUFBQXhBRUNzUUVBQUFERUFRaXlBUUFBQU1RQkNMY0JBQUNMQXNRQklnU3dBUUFBQU1RQkFyRUJBQUFBeEFFSXNnRUFBQURFQVFpM0FRQUFqQUxFQVNJSEJBQUEtZ0VBSUNNQUFJNENBQ0FrQUFDT0FnQWdzQUVBQUFEQ0FRS3hBUUFBQU1JQkNMSUJBQUFBd2dFSXR3RUFBSTBDd2dFaUJMQUJBQUFBd2dFQ3NRRUFBQURDQVFpeUFRQUFBTUlCQ0xjQkFBQ09Bc0lCSWc0RUFBQ1FBZ0FnSXdBQWtRSUFJQ1FBQUpFQ0FDQ3dBUUVBQUFBQnNRRUJBQUFBQmJJQkFRQUFBQVd6QVFFQUFBQUJ0QUVCQUFBQUFiVUJBUUFBQUFHMkFRRUFBQUFCdHdFQkFJOENBQ0c0QVFFQUFBQUJ1UUVCQUFBQUFib0JBUUFBQUFFSXNBRUNBQUFBQWJFQkFnQUFBQVd5QVFJQUFBQUZzd0VDQUFBQUFiUUJBZ0FBQUFHMUFRSUFBQUFCdGdFQ0FBQUFBYmNCQWdDUUFnQWhDN0FCQVFBQUFBR3hBUUVBQUFBRnNnRUJBQUFBQmJNQkFRQUFBQUcwQVFFQUFBQUJ0UUVCQUFBQUFiWUJBUUFBQUFHM0FRRUFrUUlBSWJnQkFRQUFBQUc1QVFFQUFBQUJ1Z0VCQUFBQUFSY0RBQUNiQWdBZ0N3QUFuQUlBSUF3QUFKMENBQ0FPQUFDZUFnQWdEd0FBbndJQUlLa0JBQUNTQWdBd3FnRUFBTW9CQUJDckFRQUFrZ0lBTUt3QkFRQ1RBZ0FocndGQUFKb0NBQ0c3QVFFQWt3SUFJYndCQVFDVEFnQWh2UUVCQUpRQ0FDRy1BUUVBbEFJQUliOEJBUUNVQWdBaHdBRUJBSlFDQUNIQ0FRQUFsUUxDQVNMRUFRQUFsZ0xFQVNMR0FRQUFsd0xHQVNMSEFTQUFtQUlBSWNnQklBQ1lBZ0FoeVFFQ0FKa0NBQ0hLQVVBQW1nSUFJUXV3QVFFQUFBQUJzUUVCQUFBQUJMSUJBUUFBQUFTekFRRUFBQUFCdEFFQkFBQUFBYlVCQVFBQUFBRzJBUUVBQUFBQnR3RUJBUDBCQUNHNEFRRUFBQUFCdVFFQkFBQUFBYm9CQVFBQUFBRUxzQUVCQUFBQUFiRUJBUUFBQUFXeUFRRUFBQUFGc3dFQkFBQUFBYlFCQVFBQUFBRzFBUUVBQUFBQnRnRUJBQUFBQWJjQkFRQ1JBZ0FodUFFQkFBQUFBYmtCQVFBQUFBRzZBUUVBQUFBQkJMQUJBQUFBd2dFQ3NRRUFBQURDQVFpeUFRQUFBTUlCQ0xjQkFBQ09Bc0lCSWdTd0FRQUFBTVFCQXJFQkFBQUF4QUVJc2dFQUFBREVBUWkzQVFBQWpBTEVBU0lFc0FFQUFBREdBUUt4QVFBQUFNWUJDTElCQUFBQXhnRUl0d0VBQUlvQ3hnRWlBckFCSUFBQUFBRzNBU0FBaUFJQUlRaXdBUUlBQUFBQnNRRUNBQUFBQkxJQkFnQUFBQVN6QVFJQUFBQUJ0QUVDQUFBQUFiVUJBZ0FBQUFHMkFRSUFBQUFCdHdFQ0FQb0JBQ0VJc0FGQUFBQUFBYkVCUUFBQUFBU3lBVUFBQUFBRXN3RkFBQUFBQWJRQlFBQUFBQUcxQVVBQUFBQUJ0Z0ZBQUFBQUFiY0JRQUQ3QVFBaEE4c0JBQUFEQUNETUFRQUFBd0FnelFFQUFBTUFJQVBMQVFBQUNRQWd6QUVBQUFrQUlNMEJBQUFKQUNBRHl3RUFBQklBSU13QkFBQVNBQ0ROQVFBQUVnQWdBOHNCQUFBZkFDRE1BUUFBSHdBZ3pRRUFBQjhBSUFQTEFRQUFGZ0FnekFFQUFCWUFJTTBCQUFBV0FDQVNxUUVBQUtBQ0FEQ3FBUUFBeEFFQUVLc0JBQUNnQWdBd3JBRUJBUGNCQUNHdkFVQUEtQUVBSWNRQkFBQ2tBdGNCSXNnQklBQ0RBZ0FoeWdGQUFQZ0JBQ0hPQVFFQTl3RUFJYzhCQVFEM0FRQWgwQUVCQVBjQkFDSFJBUUVBOXdFQUlkSUJFQUNoQWdBaDB3RUNBSVFDQUNIVUFRZ0FvZ0lBSWRVQkFBQ2pBZ0FnMXdFQkFQY0JBQ0hZQVFFQTl3RUFJUTBFQUFENkFRQWdJd0FBcVFJQUlDUUFBS2tDQUNBMUFBQ3BBZ0FnTmdBQXFRSUFJTEFCRUFBQUFBR3hBUkFBQUFBRXNnRVFBQUFBQkxNQkVBQUFBQUcwQVJBQUFBQUJ0UUVRQUFBQUFiWUJFQUFBQUFHM0FSQUFxQUlBSVEwRUFBRDZBUUFnSXdBQWhnSUFJQ1FBQUlZQ0FDQTFBQUNHQWdBZ05nQUFoZ0lBSUxBQkNBQUFBQUd4QVFnQUFBQUVzZ0VJQUFBQUJMTUJDQUFBQUFHMEFRZ0FBQUFCdFFFSUFBQUFBYllCQ0FBQUFBRzNBUWdBcHdJQUlRU3dBUUVBQUFBRjJRRUJBQUFBQWRvQkFRQUFBQVRiQVFFQUFBQUVCd1FBQVBvQkFDQWpBQUNtQWdBZ0pBQUFwZ0lBSUxBQkFBQUExd0VDc1FFQUFBRFhBUWl5QVFBQUFOY0JDTGNCQUFDbEF0Y0JJZ2NFQUFENkFRQWdJd0FBcGdJQUlDUUFBS1lDQUNDd0FRQUFBTmNCQXJFQkFBQUExd0VJc2dFQUFBRFhBUWkzQVFBQXBRTFhBU0lFc0FFQUFBRFhBUUt4QVFBQUFOY0JDTElCQUFBQTF3RUl0d0VBQUtZQzF3RWlEUVFBQVBvQkFDQWpBQUNHQWdBZ0pBQUFoZ0lBSURVQUFJWUNBQ0EyQUFDR0FnQWdzQUVJQUFBQUFiRUJDQUFBQUFTeUFRZ0FBQUFFc3dFSUFBQUFBYlFCQ0FBQUFBRzFBUWdBQUFBQnRnRUlBQUFBQWJjQkNBQ25BZ0FoRFFRQUFQb0JBQ0FqQUFDcEFnQWdKQUFBcVFJQUlEVUFBS2tDQUNBMkFBQ3BBZ0Fnc0FFUUFBQUFBYkVCRUFBQUFBU3lBUkFBQUFBRXN3RVFBQUFBQWJRQkVBQUFBQUcxQVJBQUFBQUJ0Z0VRQUFBQUFiY0JFQUNvQWdBaENMQUJFQUFBQUFHeEFSQUFBQUFFc2dFUUFBQUFCTE1CRUFBQUFBRzBBUkFBQUFBQnRRRVFBQUFBQWJZQkVBQUFBQUczQVJBQXFRSUFJUXFwQVFBQXFnSUFNS29CQUFDdUFRQVFxd0VBQUtvQ0FEQ3NBUUVBOXdFQUlhMEJBUUQzQVFBaHJnRUJBUGNCQUNHdkFVQUEtQUVBSWNvQlFBRDRBUUFoMUFFQ0FJUUNBQ0hjQVFFQTl3RUFJUk9wQVFBQXF3SUFNS29CQUFDWUFRQVFxd0VBQUtzQ0FEQ3NBUUVBOXdFQUlhOEJRQUQ0QVFBaHhBRUFBS3dDNHdFaXlnRkFBUGdCQUNIZEFRRUE5d0VBSWQ0QkFRRDNBUUFoM3dFQkFQOEJBQ0hnQVJBQW9RSUFJZUVCQVFEM0FRQWg0d0VCQVA4QkFDSGtBUUVBX3dFQUllVUJBUURfQVFBaDVnRUJBUDhCQUNIbkFVQUFyUUlBSWVnQkFRRF9BUUFoNlFGQUFLMENBQ0VIQkFBQS1nRUFJQ01BQUxFQ0FDQWtBQUN4QWdBZ3NBRUFBQURqQVFLeEFRQUFBT01CQ0xJQkFBQUE0d0VJdHdFQUFMQUM0d0VpQ3dRQUFKQUNBQ0FqQUFDdkFnQWdKQUFBcndJQUlMQUJRQUFBQUFHeEFVQUFBQUFGc2dGQUFBQUFCYk1CUUFBQUFBRzBBVUFBQUFBQnRRRkFBQUFBQWJZQlFBQUFBQUczQVVBQXJnSUFJUXNFQUFDUUFnQWdJd0FBcndJQUlDUUFBSzhDQUNDd0FVQUFBQUFCc1FGQUFBQUFCYklCUUFBQUFBV3pBVUFBQUFBQnRBRkFBQUFBQWJVQlFBQUFBQUcyQVVBQUFBQUJ0d0ZBQUs0Q0FDRUlzQUZBQUFBQUFiRUJRQUFBQUFXeUFVQUFBQUFGc3dGQUFBQUFBYlFCUUFBQUFBRzFBVUFBQUFBQnRnRkFBQUFBQWJjQlFBQ3ZBZ0FoQndRQUFQb0JBQ0FqQUFDeEFnQWdKQUFBc1FJQUlMQUJBQUFBNHdFQ3NRRUFBQURqQVFpeUFRQUFBT01CQ0xjQkFBQ3dBdU1CSWdTd0FRQUFBT01CQXJFQkFBQUE0d0VJc2dFQUFBRGpBUWkzQVFBQXNRTGpBU0lMcVFFQUFMSUNBRENxQVFBQWdnRUFFS3NCQUFDeUFnQXdyQUVCQVBjQkFDR3ZBVUFBLUFFQUlic0JBUUQzQVFBaHZBRUJBUGNCQUNIS0FVQUEtQUVBSWVvQkFRRDNBUUFoNndFQkFQY0JBQ0hzQVNBQWd3SUFJUXVwQVFBQXN3SUFNS29CQUFCdkFCQ3JBUUFBc3dJQU1Ld0JBUUNUQWdBaHJ3RkFBSm9DQUNHN0FRRUFrd0lBSWJ3QkFRQ1RBZ0FoeWdGQUFKb0NBQ0hxQVFFQWt3SUFJZXNCQVFDVEFnQWg3QUVnQUpnQ0FDRUlxUUVBQUxRQ0FEQ3FBUUFBYVFBUXF3RUFBTFFDQURDc0FRRUE5d0VBSWE4QlFBRDRBUUFodXdFQkFQY0JBQ0hLQVVBQS1BRUFJYzhCQVFEM0FRQWhDUU1BQUpzQ0FDQ3BBUUFBdFFJQU1Lb0JBQUJXQUJDckFRQUF0UUlBTUt3QkFRQ1RBZ0FocndGQUFKb0NBQ0c3QVFFQWt3SUFJY29CUUFDYUFnQWh6d0VCQUpNQ0FDRU1xUUVBQUxZQ0FEQ3FBUUFBVUFBUXF3RUFBTFlDQURDc0FRRUE5d0VBSWEwQkFRRDNBUUFocmdFQkFQY0JBQ0d2QVVBQS1BRUFJY1FCQUFDM0F2RUJJc29CUUFENEFRQWg3UUZBQVBnQkFDSHVBUUlBaEFJQUllOEJFQUNoQWdBaEJ3UUFBUG9CQUNBakFBQzVBZ0FnSkFBQXVRSUFJTEFCQUFBQThRRUNzUUVBQUFEeEFRaXlBUUFBQVBFQkNMY0JBQUM0QXZFQklnY0VBQUQ2QVFBZ0l3QUF1UUlBSUNRQUFMa0NBQ0N3QVFBQUFQRUJBckVCQUFBQThRRUlzZ0VBQUFEeEFRaTNBUUFBdUFMeEFTSUVzQUVBQUFEeEFRS3hBUUFBQVBFQkNMSUJBQUFBOFFFSXR3RUFBTGtDOFFFaURxa0JBQUM2QWdBd3FnRUFBRG9BRUtzQkFBQzZBZ0F3ckFFQkFQY0JBQ0d2QVVBQS1BRUFJY1FCQUFDN0F2VUJJc2dCSUFDREFnQWh5Z0ZBQVBnQkFDSE9BUUVBOXdFQUljOEJBUUQzQVFBaDhRRUJBUGNCQUNIeUFRRUE5d0VBSWZNQkFRRDNBUUFoOVFFQkFQY0JBQ0VIQkFBQS1nRUFJQ01BQUwwQ0FDQWtBQUM5QWdBZ3NBRUFBQUQxQVFLeEFRQUFBUFVCQ0xJQkFBQUE5UUVJdHdFQUFMd0M5UUVpQndRQUFQb0JBQ0FqQUFDOUFnQWdKQUFBdlFJQUlMQUJBQUFBOVFFQ3NRRUFBQUQxQVFpeUFRQUFBUFVCQ0xjQkFBQzhBdlVCSWdTd0FRQUFBUFVCQXJFQkFBQUE5UUVJc2dFQUFBRDFBUWkzQVFBQXZRTDFBU0lQRUFBQXdBSUFJS2tCQUFDLUFnQXdxZ0VBQUI4QUVLc0JBQUMtQWdBd3JBRUJBSk1DQUNHdkFVQUFtZ0lBSWNRQkFBQ19BdlVCSXNnQklBQ1lBZ0FoeWdGQUFKb0NBQ0hPQVFFQWt3SUFJYzhCQVFDVEFnQWg4UUVCQUpNQ0FDSHlBUUVBa3dJQUlmTUJBUUNUQWdBaDlRRUJBSk1DQUNFRXNBRUFBQUQxQVFLeEFRQUFBUFVCQ0xJQkFBQUE5UUVJdHdFQUFMMEM5UUVpR1FNQUFKc0NBQ0FMQUFDY0FnQWdEQUFBblFJQUlBNEFBSjRDQUNBUEFBQ2ZBZ0FncVFFQUFKSUNBRENxQVFBQXlnRUFFS3NCQUFDU0FnQXdyQUVCQUpNQ0FDR3ZBVUFBbWdJQUlic0JBUUNUQWdBaHZBRUJBSk1DQUNHOUFRRUFsQUlBSWI0QkFRQ1VBZ0FodndFQkFKUUNBQ0hBQVFFQWxBSUFJY0lCQUFDVkFzSUJJc1FCQUFDV0FzUUJJc1lCQUFDWEFzWUJJc2NCSUFDWUFnQWh5QUVnQUpnQ0FDSEpBUUlBbVFJQUljb0JRQUNhQWdBaDl3RUFBTW9CQUNENEFRQUF5Z0VBSUFLdEFRRUFBQUFCcmdFQkFBQUFBUWtIQUFEQUFnQWdDQUFBd3dJQUlLa0JBQURDQWdBd3FnRUFBQllBRUtzQkFBRENBZ0F3ckFFQkFKTUNBQ0d0QVFFQWt3SUFJYTRCQVFDVEFnQWhyd0ZBQUpvQ0FDRVpCUUFBMFFJQUlBWUFBTUFDQUNBTEFBQ2NBZ0FnREFBQW5RSUFJQTBBQUo4Q0FDQ3BBUUFBemdJQU1Lb0JBQUFEQUJDckFRQUF6Z0lBTUt3QkFRQ1RBZ0FocndGQUFKb0NBQ0hFQVFBQTBBTFhBU0xJQVNBQW1BSUFJY29CUUFDYUFnQWh6Z0VCQUpNQ0FDSFBBUUVBa3dJQUlkQUJBUUNUQWdBaDBRRUJBSk1DQUNIU0FSQUF4d0lBSWRNQkFnQ1pBZ0FoMUFFSUFNOENBQ0hWQVFBQW93SUFJTmNCQVFDVEFnQWgyQUVCQUpNQ0FDSDNBUUFBQXdBZy1BRUFBQU1BSUFLdEFRRUFBQUFCcmdFQkFBQUFBUXdIQUFEQUFnQWdDQUFBd3dJQUlLa0JBQURGQWdBd3FnRUFBQklBRUtzQkFBREZBZ0F3ckFFQkFKTUNBQ0d0QVFFQWt3SUFJYTRCQVFDVEFnQWhyd0ZBQUpvQ0FDSEtBVUFBbWdJQUlkUUJBZ0NaQWdBaDNBRUJBSk1DQUNFVUNRQUF5Z0lBSUtrQkFBREdBZ0F3cWdFQUFBMEFFS3NCQUFER0FnQXdyQUVCQUpNQ0FDR3ZBVUFBbWdJQUljUUJBQURJQXVNQklzb0JRQUNhQWdBaDNRRUJBSk1DQUNIZUFRRUFrd0lBSWQ4QkFRQ1VBZ0FoNEFFUUFNY0NBQ0hoQVFFQWt3SUFJZU1CQVFDVUFnQWg1QUVCQUpRQ0FDSGxBUUVBbEFJQUllWUJBUUNVQWdBaDV3RkFBTWtDQUNIb0FRRUFsQUlBSWVrQlFBREpBZ0FoQ0xBQkVBQUFBQUd4QVJBQUFBQUVzZ0VRQUFBQUJMTUJFQUFBQUFHMEFSQUFBQUFCdFFFUUFBQUFBYllCRUFBQUFBRzNBUkFBcVFJQUlRU3dBUUFBQU9NQkFyRUJBQUFBNHdFSXNnRUFBQURqQVFpM0FRQUFzUUxqQVNJSXNBRkFBQUFBQWJFQlFBQUFBQVd5QVVBQUFBQUZzd0ZBQUFBQUFiUUJRQUFBQUFHMUFVQUFBQUFCdGdGQUFBQUFBYmNCUUFDdkFnQWhFUWNBQU1BQ0FDQUlBQUREQWdBZ0NnQUF6UUlBSUtrQkFBRExBZ0F3cWdFQUFBa0FFS3NCQUFETEFnQXdyQUVCQUpNQ0FDR3RBUUVBa3dJQUlhNEJBUUNUQWdBaHJ3RkFBSm9DQUNIRUFRQUF6QUx4QVNMS0FVQUFtZ0lBSWUwQlFBQ2FBZ0FoN2dFQ0FKa0NBQ0h2QVJBQXh3SUFJZmNCQUFBSkFDRDRBUUFBQ1FBZ0R3Y0FBTUFDQUNBSUFBRERBZ0FnQ2dBQXpRSUFJS2tCQUFETEFnQXdxZ0VBQUFrQUVLc0JBQURMQWdBd3JBRUJBSk1DQUNHdEFRRUFrd0lBSWE0QkFRQ1RBZ0FocndGQUFKb0NBQ0hFQVFBQXpBTHhBU0xLQVVBQW1nSUFJZTBCUUFDYUFnQWg3Z0VDQUprQ0FDSHZBUkFBeHdJQUlRU3dBUUFBQVBFQkFyRUJBQUFBOFFFSXNnRUFBQUR4QVFpM0FRQUF1UUx4QVNJRHl3RUFBQTBBSU13QkFBQU5BQ0ROQVFBQURRQWdGd1VBQU5FQ0FDQUdBQURBQWdBZ0N3QUFuQUlBSUF3QUFKMENBQ0FOQUFDZkFnQWdxUUVBQU00Q0FEQ3FBUUFBQXdBUXF3RUFBTTRDQURDc0FRRUFrd0lBSWE4QlFBQ2FBZ0FoeEFFQUFOQUMxd0VpeUFFZ0FKZ0NBQ0hLQVVBQW1nSUFJYzRCQVFDVEFnQWh6d0VCQUpNQ0FDSFFBUUVBa3dJQUlkRUJBUUNUQWdBaDBnRVFBTWNDQUNIVEFRSUFtUUlBSWRRQkNBRFBBZ0FoMVFFQUFLTUNBQ0RYQVFFQWt3SUFJZGdCQVFDVEFnQWhDTEFCQ0FBQUFBR3hBUWdBQUFBRXNnRUlBQUFBQkxNQkNBQUFBQUcwQVFnQUFBQUJ0UUVJQUFBQUFiWUJDQUFBQUFHM0FRZ0FoZ0lBSVFTd0FRQUFBTmNCQXJFQkFBQUExd0VJc2dFQUFBRFhBUWkzQVFBQXBnTFhBU0lMQXdBQW13SUFJS2tCQUFDMUFnQXdxZ0VBQUZZQUVLc0JBQUMxQWdBd3JBRUJBSk1DQUNHdkFVQUFtZ0lBSWJzQkFRQ1RBZ0FoeWdGQUFKb0NBQ0hQQVFFQWt3SUFJZmNCQUFCV0FDRDRBUUFBVmdBZ0FBQUFBZndCQVFBQUFBRUJfQUZBQUFBQUFRVWRBQURiQkFBZ0hnQUE0UVFBSVBrQkFBRGNCQUFnLWdFQUFPQUVBQ0RfQVFBQXh3RUFJQVVkQUFEWkJBQWdIZ0FBM2dRQUlQa0JBQURhQkFBZy1nRUFBTjBFQUNEX0FRQUFCUUFnQXgwQUFOc0VBQ0Q1QVFBQTNBUUFJUDhCQUFESEFRQWdBeDBBQU5rRUFDRDVBUUFBMmdRQUlQOEJBQUFGQUNBQUFBQUFBQUFCX0FFQkFBQUFBUUg4QVFBQUFNSUJBZ0g4QVFBQUFNUUJBZ0g4QVFBQUFNWUJBZ0g4QVNBQUFBQUJCZndCQWdBQUFBR0RBZ0lBQUFBQmhBSUNBQUFBQVlVQ0FnQUFBQUdHQWdJQUFBQUJDeDBBQUxNREFEQWVBQUM0QXdBdy1RRUFBTFFEQURENkFRQUF0UU1BTVBzQkFBQzJBd0FnX0FFQUFMY0RBREQ5QVFBQXR3TUFNUDRCQUFDM0F3QXdfd0VBQUxjREFEQ0FBZ0FBdVFNQU1JRUNBQUM2QXdBd0N4MEFBSk1EQURBZUFBQ1lBd0F3LVFFQUFKUURBREQ2QVFBQWxRTUFNUHNCQUFDV0F3QWdfQUVBQUpjREFERDlBUUFBbHdNQU1QNEJBQUNYQXdBd193RUFBSmNEQURDQUFnQUFtUU1BTUlFQ0FBQ2FBd0F3Q3gwQUFJVURBREFlQUFDS0F3QXctUUVBQUlZREFERDZBUUFBaHdNQU1Qc0JBQUNJQXdBZ19BRUFBSWtEQUREOUFRQUFpUU1BTVA0QkFBQ0pBd0F3X3dFQUFJa0RBRENBQWdBQWl3TUFNSUVDQUFDTUF3QXdDeDBBQVBnQ0FEQWVBQUQ5QWdBdy1RRUFBUGtDQURENkFRQUEtZ0lBTVBzQkFBRDdBZ0FnX0FFQUFQd0NBREQ5QVFBQV9BSUFNUDRCQUFEOEFnQXdfd0VBQVB3Q0FEQ0FBZ0FBX2dJQU1JRUNBQURfQWdBd0N4MEFBT3dDQURBZUFBRHhBZ0F3LVFFQUFPMENBREQ2QVFBQTdnSUFNUHNCQUFEdkFnQWdfQUVBQVBBQ0FERDlBUUFBOEFJQU1QNEJBQUR3QWdBd193RUFBUEFDQURDQUFnQUE4Z0lBTUlFQ0FBRHpBZ0F3QkFnQUFOb0NBQ0NzQVFFQUFBQUJyZ0VCQUFBQUFhOEJRQUFBQUFFQ0FBQUFHQUFnSFFBQTl3SUFJQU1BQUFBWUFDQWRBQUQzQWdBZ0hnQUE5Z0lBSUFFV0FBRFlCQUF3Q2djQUFNQUNBQ0FJQUFEREFnQWdxUUVBQU1JQ0FEQ3FBUUFBRmdBUXF3RUFBTUlDQURDc0FRRUFBQUFCclFFQkFKTUNBQ0d1QVFFQWt3SUFJYThCUUFDYUFnQWg5Z0VBQU1FQ0FDQUNBQUFBR0FBZ0ZnQUE5Z0lBSUFJQUFBRDBBZ0FnRmdBQTlRSUFJQWVwQVFBQTh3SUFNS29CQUFEMEFnQVFxd0VBQVBNQ0FEQ3NBUUVBa3dJQUlhMEJBUUNUQWdBaHJnRUJBSk1DQUNHdkFVQUFtZ0lBSVFlcEFRQUE4d0lBTUtvQkFBRDBBZ0FRcXdFQUFQTUNBRENzQVFFQWt3SUFJYTBCQVFDVEFnQWhyZ0VCQUpNQ0FDR3ZBVUFBbWdJQUlRT3NBUUVBMVFJQUlhNEJBUURWQWdBaHJ3RkFBTllDQUNFRUNBQUEyQUlBSUt3QkFRRFZBZ0FocmdFQkFOVUNBQ0d2QVVBQTFnSUFJUVFJQUFEYUFnQWdyQUVCQUFBQUFhNEJBUUFBQUFHdkFVQUFBQUFCQ3F3QkFRQUFBQUd2QVVBQUFBQUJ4QUVBQUFEMUFRTElBU0FBQUFBQnlnRkFBQUFBQWM0QkFRQUFBQUhQQVFFQUFBQUI4UUVCQUFBQUFmSUJBUUFBQUFIekFRRUFBQUFCQWdBQUFBRUFJQjBBQUlRREFDQURBQUFBQVFBZ0hRQUFoQU1BSUI0QUFJTURBQ0FCRmdBQTF3UUFNQThRQUFEQUFnQWdxUUVBQUw0Q0FEQ3FBUUFBSHdBUXF3RUFBTDRDQURDc0FRRUFBQUFCcndGQUFKb0NBQ0hFQVFBQXZ3TDFBU0xJQVNBQW1BSUFJY29CUUFDYUFnQWh6Z0VCQUpNQ0FDSFBBUUVBQUFBQjhRRUJBSk1DQUNIeUFRRUFrd0lBSWZNQkFRQ1RBZ0FoOVFFQkFKTUNBQ0VDQUFBQUFRQWdGZ0FBZ3dNQUlBSUFBQUNBQXdBZ0ZnQUFnUU1BSUE2cEFRQUFfd0lBTUtvQkFBQ0FBd0FRcXdFQUFQOENBRENzQVFFQWt3SUFJYThCUUFDYUFnQWh4QUVBQUw4QzlRRWl5QUVnQUpnQ0FDSEtBVUFBbWdJQUljNEJBUUNUQWdBaHp3RUJBSk1DQUNIeEFRRUFrd0lBSWZJQkFRQ1RBZ0FoOHdFQkFKTUNBQ0gxQVFFQWt3SUFJUTZwQVFBQV93SUFNS29CQUFDQUF3QVFxd0VBQVA4Q0FEQ3NBUUVBa3dJQUlhOEJRQUNhQWdBaHhBRUFBTDhDOVFFaXlBRWdBSmdDQUNIS0FVQUFtZ0lBSWM0QkFRQ1RBZ0FoendFQkFKTUNBQ0h4QVFFQWt3SUFJZklCQVFDVEFnQWg4d0VCQUpNQ0FDSDFBUUVBa3dJQUlRcXNBUUVBMVFJQUlhOEJRQURXQWdBaHhBRUFBSUlEOVFFaXlBRWdBT1VDQUNIS0FVQUExZ0lBSWM0QkFRRFZBZ0FoendFQkFOVUNBQ0h4QVFFQTFRSUFJZklCQVFEVkFnQWg4d0VCQU5VQ0FDRUJfQUVBQUFEMUFRSUtyQUVCQU5VQ0FDR3ZBVUFBMWdJQUljUUJBQUNDQV9VQklzZ0JJQURsQWdBaHlnRkFBTllDQUNIT0FRRUExUUlBSWM4QkFRRFZBZ0FoOFFFQkFOVUNBQ0h5QVFFQTFRSUFJZk1CQVFEVkFnQWhDcXdCQVFBQUFBR3ZBVUFBQUFBQnhBRUFBQUQxQVFMSUFTQUFBQUFCeWdGQUFBQUFBYzRCQVFBQUFBSFBBUUVBQUFBQjhRRUJBQUFBQWZJQkFRQUFBQUh6QVFFQUFBQUJCd2dBQUpJREFDQ3NBUUVBQUFBQnJnRUJBQUFBQWE4QlFBQUFBQUhLQVVBQUFBQUIxQUVDQUFBQUFkd0JBUUFBQUFFQ0FBQUFGQUFnSFFBQWtRTUFJQU1BQUFBVUFDQWRBQUNSQXdBZ0hnQUFqd01BSUFFV0FBRFdCQUF3RFFjQUFNQUNBQ0FJQUFEREFnQWdxUUVBQU1VQ0FEQ3FBUUFBRWdBUXF3RUFBTVVDQURDc0FRRUFBQUFCclFFQkFKTUNBQ0d1QVFFQWt3SUFJYThCUUFDYUFnQWh5Z0ZBQUpvQ0FDSFVBUUlBbVFJQUlkd0JBUUNUQWdBaDlnRUFBTVFDQUNBQ0FBQUFGQUFnRmdBQWp3TUFJQUlBQUFDTkF3QWdGZ0FBamdNQUlBcXBBUUFBakFNQU1Lb0JBQUNOQXdBUXF3RUFBSXdEQURDc0FRRUFrd0lBSWEwQkFRQ1RBZ0FocmdFQkFKTUNBQ0d2QVVBQW1nSUFJY29CUUFDYUFnQWgxQUVDQUprQ0FDSGNBUUVBa3dJQUlRcXBBUUFBakFNQU1Lb0JBQUNOQXdBUXF3RUFBSXdEQURDc0FRRUFrd0lBSWEwQkFRQ1RBZ0FocmdFQkFKTUNBQ0d2QVVBQW1nSUFJY29CUUFDYUFnQWgxQUVDQUprQ0FDSGNBUUVBa3dJQUlRYXNBUUVBMVFJQUlhNEJBUURWQWdBaHJ3RkFBTllDQUNIS0FVQUExZ0lBSWRRQkFnRG1BZ0FoM0FFQkFOVUNBQ0VIQ0FBQWtBTUFJS3dCQVFEVkFnQWhyZ0VCQU5VQ0FDR3ZBVUFBMWdJQUljb0JRQURXQWdBaDFBRUNBT1lDQUNIY0FRRUExUUlBSVFVZEFBRFJCQUFnSGdBQTFBUUFJUGtCQUFEU0JBQWctZ0VBQU5NRUFDRF9BUUFBQlFBZ0J3Z0FBSklEQUNDc0FRRUFBQUFCcmdFQkFBQUFBYThCUUFBQUFBSEtBVUFBQUFBQjFBRUNBQUFBQWR3QkFRQUFBQUVESFFBQTBRUUFJUGtCQUFEU0JBQWdfd0VBQUFVQUlBb0lBQUN4QXdBZ0NnQUFzZ01BSUt3QkFRQUFBQUd1QVFFQUFBQUJyd0ZBQUFBQUFjUUJBQUFBOFFFQ3lnRkFBQUFBQWUwQlFBQUFBQUh1QVFJQUFBQUI3d0VRQUFBQUFRSUFBQUFMQUNBZEFBQ3dBd0FnQXdBQUFBc0FJQjBBQUxBREFDQWVBQUNmQXdBZ0FSWUFBTkFFQURBUEJ3QUF3QUlBSUFnQUFNTUNBQ0FLQUFETkFnQWdxUUVBQU1zQ0FEQ3FBUUFBQ1FBUXF3RUFBTXNDQURDc0FRRUFBQUFCclFFQkFKTUNBQ0d1QVFFQWt3SUFJYThCUUFDYUFnQWh4QUVBQU13QzhRRWl5Z0ZBQUpvQ0FDSHRBVUFBbWdJQUllNEJBZ0NaQWdBaDd3RVFBTWNDQUNFQ0FBQUFDd0FnRmdBQW53TUFJQUlBQUFDYkF3QWdGZ0FBbkFNQUlBeXBBUUFBbWdNQU1Lb0JBQUNiQXdBUXF3RUFBSm9EQURDc0FRRUFrd0lBSWEwQkFRQ1RBZ0FocmdFQkFKTUNBQ0d2QVVBQW1nSUFJY1FCQUFETUF2RUJJc29CUUFDYUFnQWg3UUZBQUpvQ0FDSHVBUUlBbVFJQUllOEJFQURIQWdBaERLa0JBQUNhQXdBd3FnRUFBSnNEQUJDckFRQUFtZ01BTUt3QkFRQ1RBZ0FoclFFQkFKTUNBQ0d1QVFFQWt3SUFJYThCUUFDYUFnQWh4QUVBQU13QzhRRWl5Z0ZBQUpvQ0FDSHRBVUFBbWdJQUllNEJBZ0NaQWdBaDd3RVFBTWNDQUNFSXJBRUJBTlVDQUNHdUFRRUExUUlBSWE4QlFBRFdBZ0FoeEFFQUFKNEQ4UUVpeWdGQUFOWUNBQ0h0QVVBQTFnSUFJZTRCQWdEbUFnQWg3d0VRQUowREFDRUZfQUVRQUFBQUFZTUNFQUFBQUFHRUFoQUFBQUFCaFFJUUFBQUFBWVlDRUFBQUFBRUJfQUVBQUFEeEFRSUtDQUFBb0FNQUlBb0FBS0VEQUNDc0FRRUExUUlBSWE0QkFRRFZBZ0FocndGQUFOWUNBQ0hFQVFBQW5nUHhBU0xLQVVBQTFnSUFJZTBCUUFEV0FnQWg3Z0VDQU9ZQ0FDSHZBUkFBblFNQUlRVWRBQURLQkFBZ0hnQUF6Z1FBSVBrQkFBRExCQUFnLWdFQUFNMEVBQ0RfQVFBQUJRQWdDeDBBQUtJREFEQWVBQUNuQXdBdy1RRUFBS01EQURENkFRQUFwQU1BTVBzQkFBQ2xBd0FnX0FFQUFLWURBREQ5QVFBQXBnTUFNUDRCQUFDbUF3QXdfd0VBQUtZREFEQ0FBZ0FBcUFNQU1JRUNBQUNwQXdBd0Q2d0JBUUFBQUFHdkFVQUFBQUFCeEFFQUFBRGpBUUxLQVVBQUFBQUIzZ0VCQUFBQUFkOEJBUUFBQUFIZ0FSQUFBQUFCNFFFQkFBQUFBZU1CQVFBQUFBSGtBUUVBQUFBQjVRRUJBQUFBQWVZQkFRQUFBQUhuQVVBQUFBQUI2QUVCQUFBQUFla0JRQUFBQUFFQ0FBQUFEd0FnSFFBQXJ3TUFJQU1BQUFBUEFDQWRBQUN2QXdBZ0hnQUFyZ01BSUFFV0FBRE1CQUF3RkFrQUFNb0NBQ0NwQVFBQXhnSUFNS29CQUFBTkFCQ3JBUUFBeGdJQU1Ld0JBUUFBQUFHdkFVQUFtZ0lBSWNRQkFBRElBdU1CSXNvQlFBQ2FBZ0FoM1FFQkFKTUNBQ0hlQVFFQUFBQUIzd0VCQUpRQ0FDSGdBUkFBeHdJQUllRUJBUUNUQWdBaDR3RUJBSlFDQUNIa0FRRUFsQUlBSWVVQkFRQ1VBZ0FoNWdFQkFKUUNBQ0huQVVBQXlRSUFJZWdCQVFDVUFnQWg2UUZBQU1rQ0FDRUNBQUFBRHdBZ0ZnQUFyZ01BSUFJQUFBQ3FBd0FnRmdBQXF3TUFJQk9wQVFBQXFRTUFNS29CQUFDcUF3QVFxd0VBQUtrREFEQ3NBUUVBa3dJQUlhOEJRQUNhQWdBaHhBRUFBTWdDNHdFaXlnRkFBSm9DQUNIZEFRRUFrd0lBSWQ0QkFRQ1RBZ0FoM3dFQkFKUUNBQ0hnQVJBQXh3SUFJZUVCQVFDVEFnQWg0d0VCQUpRQ0FDSGtBUUVBbEFJQUllVUJBUUNVQWdBaDVnRUJBSlFDQUNIbkFVQUF5UUlBSWVnQkFRQ1VBZ0FoNlFGQUFNa0NBQ0VUcVFFQUFLa0RBRENxQVFBQXFnTUFFS3NCQUFDcEF3QXdyQUVCQUpNQ0FDR3ZBVUFBbWdJQUljUUJBQURJQXVNQklzb0JRQUNhQWdBaDNRRUJBSk1DQUNIZUFRRUFrd0lBSWQ4QkFRQ1VBZ0FoNEFFUUFNY0NBQ0hoQVFFQWt3SUFJZU1CQVFDVUFnQWg1QUVCQUpRQ0FDSGxBUUVBbEFJQUllWUJBUUNVQWdBaDV3RkFBTWtDQUNIb0FRRUFsQUlBSWVrQlFBREpBZ0FoRDZ3QkFRRFZBZ0FocndGQUFOWUNBQ0hFQVFBQXJBUGpBU0xLQVVBQTFnSUFJZDRCQVFEVkFnQWgzd0VCQU9FQ0FDSGdBUkFBblFNQUllRUJBUURWQWdBaDR3RUJBT0VDQUNIa0FRRUE0UUlBSWVVQkFRRGhBZ0FoNWdFQkFPRUNBQ0huQVVBQXJRTUFJZWdCQVFEaEFnQWg2UUZBQUswREFDRUJfQUVBQUFEakFRSUJfQUZBQUFBQUFRLXNBUUVBMVFJQUlhOEJRQURXQWdBaHhBRUFBS3dENHdFaXlnRkFBTllDQUNIZUFRRUExUUlBSWQ4QkFRRGhBZ0FoNEFFUUFKMERBQ0hoQVFFQTFRSUFJZU1CQVFEaEFnQWg1QUVCQU9FQ0FDSGxBUUVBNFFJQUllWUJBUURoQWdBaDV3RkFBSzBEQUNIb0FRRUE0UUlBSWVrQlFBQ3RBd0FoRDZ3QkFRQUFBQUd2QVVBQUFBQUJ4QUVBQUFEakFRTEtBVUFBQUFBQjNnRUJBQUFBQWQ4QkFRQUFBQUhnQVJBQUFBQUI0UUVCQUFBQUFlTUJBUUFBQUFIa0FRRUFBQUFCNVFFQkFBQUFBZVlCQVFBQUFBSG5BVUFBQUFBQjZBRUJBQUFBQWVrQlFBQUFBQUVLQ0FBQXNRTUFJQW9BQUxJREFDQ3NBUUVBQUFBQnJnRUJBQUFBQWE4QlFBQUFBQUhFQVFBQUFQRUJBc29CUUFBQUFBSHRBVUFBQUFBQjdnRUNBQUFBQWU4QkVBQUFBQUVESFFBQXlnUUFJUGtCQUFETEJBQWdfd0VBQUFVQUlBUWRBQUNpQXdBdy1RRUFBS01EQUREN0FRQUFwUU1BSVA4QkFBQ21Bd0F3RWdVQUFPWURBQ0FMQUFEbkF3QWdEQUFBNkFNQUlBMEFBT2tEQUNDc0FRRUFBQUFCcndGQUFBQUFBY1FCQUFBQTF3RUN5QUVnQUFBQUFjb0JRQUFBQUFIT0FRRUFBQUFCendFQkFBQUFBZEFCQVFBQUFBSFJBUUVBQUFBQjBnRVFBQUFBQWRNQkFnQUFBQUhVQVFnQUFBQUIxUUVBQU9VREFDRFhBUUVBQUFBQkFnQUFBQVVBSUIwQUFPUURBQ0FEQUFBQUJRQWdIUUFBNUFNQUlCNEFBTUFEQUNBQkZnQUF5UVFBTUJjRkFBRFJBZ0FnQmdBQXdBSUFJQXNBQUp3Q0FDQU1BQUNkQWdBZ0RRQUFud0lBSUtrQkFBRE9BZ0F3cWdFQUFBTUFFS3NCQUFET0FnQXdyQUVCQUFBQUFhOEJRQUNhQWdBaHhBRUFBTkFDMXdFaXlBRWdBSmdDQUNIS0FVQUFtZ0lBSWM0QkFRQ1RBZ0FoendFQkFBQUFBZEFCQVFDVEFnQWgwUUVCQUpNQ0FDSFNBUkFBeHdJQUlkTUJBZ0NaQWdBaDFBRUlBTThDQUNIVkFRQUFvd0lBSU5jQkFRQ1RBZ0FoMkFFQkFKTUNBQ0VDQUFBQUJRQWdGZ0FBd0FNQUlBSUFBQUM3QXdBZ0ZnQUF2QU1BSUJLcEFRQUF1Z01BTUtvQkFBQzdBd0FRcXdFQUFMb0RBRENzQVFFQWt3SUFJYThCUUFDYUFnQWh4QUVBQU5BQzF3RWl5QUVnQUpnQ0FDSEtBVUFBbWdJQUljNEJBUUNUQWdBaHp3RUJBSk1DQUNIUUFRRUFrd0lBSWRFQkFRQ1RBZ0FoMGdFUUFNY0NBQ0hUQVFJQW1RSUFJZFFCQ0FEUEFnQWgxUUVBQUtNQ0FDRFhBUUVBa3dJQUlkZ0JBUUNUQWdBaEVxa0JBQUM2QXdBd3FnRUFBTHNEQUJDckFRQUF1Z01BTUt3QkFRQ1RBZ0FocndGQUFKb0NBQ0hFQVFBQTBBTFhBU0xJQVNBQW1BSUFJY29CUUFDYUFnQWh6Z0VCQUpNQ0FDSFBBUUVBa3dJQUlkQUJBUUNUQWdBaDBRRUJBSk1DQUNIU0FSQUF4d0lBSWRNQkFnQ1pBZ0FoMUFFSUFNOENBQ0hWQVFBQW93SUFJTmNCQVFDVEFnQWgyQUVCQUpNQ0FDRU9yQUVCQU5VQ0FDR3ZBVUFBMWdJQUljUUJBQUNfQTljQklzZ0JJQURsQWdBaHlnRkFBTllDQUNIT0FRRUExUUlBSWM4QkFRRFZBZ0FoMEFFQkFOVUNBQ0hSQVFFQTFRSUFJZElCRUFDZEF3QWgwd0VDQU9ZQ0FDSFVBUWdBdlFNQUlkVUJBQUMtQXdBZzF3RUJBTlVDQUNFRl9BRUlBQUFBQVlNQ0NBQUFBQUdFQWdnQUFBQUJoUUlJQUFBQUFZWUNDQUFBQUFFQ19BRUJBQUFBQklJQ0FRQUFBQVVCX0FFQUFBRFhBUUlTQlFBQXdRTUFJQXNBQU1JREFDQU1BQUREQXdBZ0RRQUF4QU1BSUt3QkFRRFZBZ0FocndGQUFOWUNBQ0hFQVFBQXZ3UFhBU0xJQVNBQTVRSUFJY29CUUFEV0FnQWh6Z0VCQU5VQ0FDSFBBUUVBMVFJQUlkQUJBUURWQWdBaDBRRUJBTlVDQUNIU0FSQUFuUU1BSWRNQkFnRG1BZ0FoMUFFSUFMMERBQ0hWQVFBQXZnTUFJTmNCQVFEVkFnQWhCUjBBQUxjRUFDQWVBQURIQkFBZy1RRUFBTGdFQUNENkFRQUF4Z1FBSVA4QkFBQlRBQ0FMSFFBQTJRTUFNQjRBQU4wREFERDVBUUFBMmdNQU1Qb0JBQURiQXdBdy13RUFBTndEQUNEOEFRQUFsd01BTVAwQkFBQ1hBd0F3X2dFQUFKY0RBRERfQVFBQWx3TUFNSUFDQUFEZUF3QXdnUUlBQUpvREFEQUxIUUFBemdNQU1CNEFBTklEQURENUFRQUF6d01BTVBvQkFBRFFBd0F3LXdFQUFORURBQ0Q4QVFBQWlRTUFNUDBCQUFDSkF3QXdfZ0VBQUlrREFERF9BUUFBaVFNQU1JQUNBQURUQXdBd2dRSUFBSXdEQURBTEhRQUF4UU1BTUI0QUFNa0RBREQ1QVFBQXhnTUFNUG9CQUFESEF3QXctd0VBQU1nREFDRDhBUUFBOEFJQU1QMEJBQUR3QWdBd19nRUFBUEFDQUREX0FRQUE4QUlBTUlBQ0FBREtBd0F3Z1FJQUFQTUNBREFFQndBQTJRSUFJS3dCQVFBQUFBR3RBUUVBQUFBQnJ3RkFBQUFBQVFJQUFBQVlBQ0FkQUFETkF3QWdBd0FBQUJnQUlCMEFBTTBEQUNBZUFBRE1Bd0FnQVJZQUFNVUVBREFDQUFBQUdBQWdGZ0FBekFNQUlBSUFBQUQwQWdBZ0ZnQUF5d01BSUFPc0FRRUExUUlBSWEwQkFRRFZBZ0FocndGQUFOWUNBQ0VFQndBQTF3SUFJS3dCQVFEVkFnQWhyUUVCQU5VQ0FDR3ZBVUFBMWdJQUlRUUhBQURaQWdBZ3JBRUJBQUFBQWEwQkFRQUFBQUd2QVVBQUFBQUJCd2NBQU5nREFDQ3NBUUVBQUFBQnJRRUJBQUFBQWE4QlFBQUFBQUhLQVVBQUFBQUIxQUVDQUFBQUFkd0JBUUFBQUFFQ0FBQUFGQUFnSFFBQTF3TUFJQU1BQUFBVUFDQWRBQURYQXdBZ0hnQUExUU1BSUFFV0FBREVCQUF3QWdBQUFCUUFJQllBQU5VREFDQUNBQUFBalFNQUlCWUFBTlFEQUNBR3JBRUJBTlVDQUNHdEFRRUExUUlBSWE4QlFBRFdBZ0FoeWdGQUFOWUNBQ0hVQVFJQTVnSUFJZHdCQVFEVkFnQWhCd2NBQU5ZREFDQ3NBUUVBMVFJQUlhMEJBUURWQWdBaHJ3RkFBTllDQUNIS0FVQUExZ0lBSWRRQkFnRG1BZ0FoM0FFQkFOVUNBQ0VGSFFBQXZ3UUFJQjRBQU1JRUFDRDVBUUFBd0FRQUlQb0JBQURCQkFBZ193RUFBTWNCQUNBSEJ3QUEyQU1BSUt3QkFRQUFBQUd0QVFFQUFBQUJyd0ZBQUFBQUFjb0JRQUFBQUFIVUFRSUFBQUFCM0FFQkFBQUFBUU1kQUFDX0JBQWctUUVBQU1BRUFDRF9BUUFBeHdFQUlBb0hBQURqQXdBZ0NnQUFzZ01BSUt3QkFRQUFBQUd0QVFFQUFBQUJyd0ZBQUFBQUFjUUJBQUFBOFFFQ3lnRkFBQUFBQWUwQlFBQUFBQUh1QVFJQUFBQUI3d0VRQUFBQUFRSUFBQUFMQUNBZEFBRGlBd0FnQXdBQUFBc0FJQjBBQU9JREFDQWVBQURnQXdBZ0FSWUFBTDRFQURBQ0FBQUFDd0FnRmdBQTRBTUFJQUlBQUFDYkF3QWdGZ0FBM3dNQUlBaXNBUUVBMVFJQUlhMEJBUURWQWdBaHJ3RkFBTllDQUNIRUFRQUFuZ1B4QVNMS0FVQUExZ0lBSWUwQlFBRFdBZ0FoN2dFQ0FPWUNBQ0h2QVJBQW5RTUFJUW9IQUFEaEF3QWdDZ0FBb1FNQUlLd0JBUURWQWdBaHJRRUJBTlVDQUNHdkFVQUExZ0lBSWNRQkFBQ2VBX0VCSXNvQlFBRFdBZ0FoN1FGQUFOWUNBQ0h1QVFJQTVnSUFJZThCRUFDZEF3QWhCUjBBQUxrRUFDQWVBQUM4QkFBZy1RRUFBTG9FQUNENkFRQUF1d1FBSVA4QkFBREhBUUFnQ2djQUFPTURBQ0FLQUFDeUF3QWdyQUVCQUFBQUFhMEJBUUFBQUFHdkFVQUFBQUFCeEFFQUFBRHhBUUxLQVVBQUFBQUI3UUZBQUFBQUFlNEJBZ0FBQUFIdkFSQUFBQUFCQXgwQUFMa0VBQ0Q1QVFBQXVnUUFJUDhCQUFESEFRQWdFZ1VBQU9ZREFDQUxBQURuQXdBZ0RBQUE2QU1BSUEwQUFPa0RBQ0NzQVFFQUFBQUJyd0ZBQUFBQUFjUUJBQUFBMXdFQ3lBRWdBQUFBQWNvQlFBQUFBQUhPQVFFQUFBQUJ6d0VCQUFBQUFkQUJBUUFBQUFIUkFRRUFBQUFCMGdFUUFBQUFBZE1CQWdBQUFBSFVBUWdBQUFBQjFRRUFBT1VEQUNEWEFRRUFBQUFCQWZ3QkFRQUFBQVFESFFBQXR3UUFJUGtCQUFDNEJBQWdfd0VBQUZNQUlBUWRBQURaQXdBdy1RRUFBTm9EQUREN0FRQUEzQU1BSVA4QkFBQ1hBd0F3QkIwQUFNNERBREQ1QVFBQXp3TUFNUHNCQUFEUkF3QWdfd0VBQUlrREFEQUVIUUFBeFFNQU1Qa0JBQURHQXdBdy13RUFBTWdEQUNEX0FRQUE4QUlBTUFRZEFBQ3pBd0F3LVFFQUFMUURBREQ3QVFBQXRnTUFJUDhCQUFDM0F3QXdCQjBBQUpNREFERDVBUUFBbEFNQU1Qc0JBQUNXQXdBZ193RUFBSmNEQURBRUhRQUFoUU1BTVBrQkFBQ0dBd0F3LXdFQUFJZ0RBQ0RfQVFBQWlRTUFNQVFkQUFENEFnQXctUUVBQVBrQ0FERDdBUUFBLXdJQUlQOEJBQUQ4QWdBd0JCMEFBT3dDQURENUFRQUE3UUlBTVBzQkFBRHZBZ0FnX3dFQUFQQUNBREFBQUFBQUFBQUFBQUFBQlIwQUFMSUVBQ0FlQUFDMUJBQWctUUVBQUxNRUFDRDZBUUFBdEFRQUlQOEJBQURIQVFBZ0F4MEFBTElFQUNENUFRQUFzd1FBSVA4QkFBREhBUUFnQUFBQUFBQUFBQUFBQUFVZEFBQ3RCQUFnSGdBQXNBUUFJUGtCQUFDdUJBQWctZ0VBQUs4RUFDRF9BUUFBQ3dBZ0F4MEFBSzBFQUNENUFRQUFyZ1FBSVA4QkFBQUxBQ0FBQUFBQUFBQUxIUUFBamdRQU1CNEFBSklFQURENUFRQUFqd1FBTVBvQkFBQ1FCQUF3LXdFQUFKRUVBQ0Q4QVFBQXR3TUFNUDBCQUFDM0F3QXdfZ0VBQUxjREFERF9BUUFBdHdNQU1JQUNBQUNUQkFBd2dRSUFBTG9EQURBU0JnQUEtZ01BSUFzQUFPY0RBQ0FNQUFEb0F3QWdEUUFBNlFNQUlLd0JBUUFBQUFHdkFVQUFBQUFCeEFFQUFBRFhBUUxJQVNBQUFBQUJ5Z0ZBQUFBQUFjNEJBUUFBQUFIUEFRRUFBQUFCMEFFQkFBQUFBZEVCQVFBQUFBSFNBUkFBQUFBQjB3RUNBQUFBQWRRQkNBQUFBQUhWQVFBQTVRTUFJTmdCQVFBQUFBRUNBQUFBQlFBZ0hRQUFsZ1FBSUFNQUFBQUZBQ0FkQUFDV0JBQWdIZ0FBbFFRQUlBRVdBQUNzQkFBd0FnQUFBQVVBSUJZQUFKVUVBQ0FDQUFBQXV3TUFJQllBQUpRRUFDQU9yQUVCQU5VQ0FDR3ZBVUFBMWdJQUljUUJBQUNfQTljQklzZ0JJQURsQWdBaHlnRkFBTllDQUNIT0FRRUExUUlBSWM4QkFRRFZBZ0FoMEFFQkFOVUNBQ0hSQVFFQTFRSUFJZElCRUFDZEF3QWgwd0VDQU9ZQ0FDSFVBUWdBdlFNQUlkVUJBQUMtQXdBZzJBRUJBTlVDQUNFU0JnQUEtUU1BSUFzQUFNSURBQ0FNQUFEREF3QWdEUUFBeEFNQUlLd0JBUURWQWdBaHJ3RkFBTllDQUNIRUFRQUF2d1BYQVNMSUFTQUE1UUlBSWNvQlFBRFdBZ0FoemdFQkFOVUNBQ0hQQVFFQTFRSUFJZEFCQVFEVkFnQWgwUUVCQU5VQ0FDSFNBUkFBblFNQUlkTUJBZ0RtQWdBaDFBRUlBTDBEQUNIVkFRQUF2Z01BSU5nQkFRRFZBZ0FoRWdZQUFQb0RBQ0FMQUFEbkF3QWdEQUFBNkFNQUlBMEFBT2tEQUNDc0FRRUFBQUFCcndGQUFBQUFBY1FCQUFBQTF3RUN5QUVnQUFBQUFjb0JRQUFBQUFIT0FRRUFBQUFCendFQkFBQUFBZEFCQVFBQUFBSFJBUUVBQUFBQjBnRVFBQUFBQWRNQkFnQUFBQUhVQVFnQUFBQUIxUUVBQU9VREFDRFlBUUVBQUFBQkJCMEFBSTRFQURENUFRQUFqd1FBTVBzQkFBQ1JCQUFnX3dFQUFMY0RBREFBQUFBQUFBQUFBQVVkQUFDbkJBQWdIZ0FBcWdRQUlQa0JBQUNvQkFBZy1nRUFBS2tFQUNEX0FRQUF4d0VBSUFNZEFBQ25CQUFnLVFFQUFLZ0VBQ0RfQVFBQXh3RUFJQWtEQUFEdkF3QWdDd0FBOEFNQUlBd0FBUEVEQUNBT0FBRHlBd0FnRHdBQTh3TUFJTDBCQUFEYkFnQWd2Z0VBQU5zQ0FDQ19BUUFBMndJQUlNQUJBQURiQWdBZ0JRVUFBS1lFQUNBR0FBQ2lCQUFnQ3dBQThBTUFJQXdBQVBFREFDQU5BQUR6QXdBZ0F3Y0FBS0lFQUNBSUFBQ2pCQUFnQ2dBQXBRUUFJQUFCQXdBQTd3TUFJQk1EQUFEcUF3QWdDd0FBNndNQUlBd0FBT3dEQUNBUEFBRHVBd0FnckFFQkFBQUFBYThCUUFBQUFBRzdBUUVBQUFBQnZBRUJBQUFBQWIwQkFRQUFBQUctQVFFQUFBQUJ2d0VCQUFBQUFjQUJBUUFBQUFIQ0FRQUFBTUlCQXNRQkFBQUF4QUVDeGdFQUFBREdBUUxIQVNBQUFBQUJ5QUVnQUFBQUFja0JBZ0FBQUFIS0FVQUFBQUFCQWdBQUFNY0JBQ0FkQUFDbkJBQWdBd0FBQU1vQkFDQWRBQUNuQkFBZ0hnQUFxd1FBSUJVQUFBREtBUUFnQXdBQTV3SUFJQXNBQU9nQ0FDQU1BQURwQWdBZ0R3QUE2d0lBSUJZQUFLc0VBQ0NzQVFFQTFRSUFJYThCUUFEV0FnQWh1d0VCQU5VQ0FDRzhBUUVBMVFJQUliMEJBUURoQWdBaHZnRUJBT0VDQUNHX0FRRUE0UUlBSWNBQkFRRGhBZ0Fod2dFQUFPSUN3Z0VpeEFFQUFPTUN4QUVpeGdFQUFPUUN4Z0VpeHdFZ0FPVUNBQ0hJQVNBQTVRSUFJY2tCQWdEbUFnQWh5Z0ZBQU5ZQ0FDRVRBd0FBNXdJQUlBc0FBT2dDQUNBTUFBRHBBZ0FnRHdBQTZ3SUFJS3dCQVFEVkFnQWhyd0ZBQU5ZQ0FDRzdBUUVBMVFJQUlid0JBUURWQWdBaHZRRUJBT0VDQUNHLUFRRUE0UUlBSWI4QkFRRGhBZ0Fod0FFQkFPRUNBQ0hDQVFBQTRnTENBU0xFQVFBQTR3TEVBU0xHQVFBQTVBTEdBU0xIQVNBQTVRSUFJY2dCSUFEbEFnQWh5UUVDQU9ZQ0FDSEtBVUFBMWdJQUlRNnNBUUVBQUFBQnJ3RkFBQUFBQWNRQkFBQUExd0VDeUFFZ0FBQUFBY29CUUFBQUFBSE9BUUVBQUFBQnp3RUJBQUFBQWRBQkFRQUFBQUhSQVFFQUFBQUIwZ0VRQUFBQUFkTUJBZ0FBQUFIVUFRZ0FBQUFCMVFFQUFPVURBQ0RZQVFFQUFBQUJDd2NBQU9NREFDQUlBQUN4QXdBZ3JBRUJBQUFBQWEwQkFRQUFBQUd1QVFFQUFBQUJyd0ZBQUFBQUFjUUJBQUFBOFFFQ3lnRkFBQUFBQWUwQlFBQUFBQUh1QVFJQUFBQUI3d0VRQUFBQUFRSUFBQUFMQUNBZEFBQ3RCQUFnQXdBQUFBa0FJQjBBQUswRUFDQWVBQUN4QkFBZ0RRQUFBQWtBSUFjQUFPRURBQ0FJQUFDZ0F3QWdGZ0FBc1FRQUlLd0JBUURWQWdBaHJRRUJBTlVDQUNHdUFRRUExUUlBSWE4QlFBRFdBZ0FoeEFFQUFKNEQ4UUVpeWdGQUFOWUNBQ0h0QVVBQTFnSUFJZTRCQWdEbUFnQWg3d0VRQUowREFDRUxCd0FBNFFNQUlBZ0FBS0FEQUNDc0FRRUExUUlBSWEwQkFRRFZBZ0FocmdFQkFOVUNBQ0d2QVVBQTFnSUFJY1FCQUFDZUFfRUJJc29CUUFEV0FnQWg3UUZBQU5ZQ0FDSHVBUUlBNWdJQUllOEJFQUNkQXdBaEV3c0FBT3NEQUNBTUFBRHNBd0FnRGdBQTdRTUFJQThBQU80REFDQ3NBUUVBQUFBQnJ3RkFBQUFBQWJzQkFRQUFBQUc4QVFFQUFBQUJ2UUVCQUFBQUFiNEJBUUFBQUFHX0FRRUFBQUFCd0FFQkFBQUFBY0lCQUFBQXdnRUN4QUVBQUFERUFRTEdBUUFBQU1ZQkFzY0JJQUFBQUFISUFTQUFBQUFCeVFFQ0FBQUFBY29CUUFBQUFBRUNBQUFBeHdFQUlCMEFBTElFQUNBREFBQUF5Z0VBSUIwQUFMSUVBQ0FlQUFDMkJBQWdGUUFBQU1vQkFDQUxBQURvQWdBZ0RBQUE2UUlBSUE0QUFPb0NBQ0FQQUFEckFnQWdGZ0FBdGdRQUlLd0JBUURWQWdBaHJ3RkFBTllDQUNHN0FRRUExUUlBSWJ3QkFRRFZBZ0FodlFFQkFPRUNBQ0ctQVFFQTRRSUFJYjhCQVFEaEFnQWh3QUVCQU9FQ0FDSENBUUFBNGdMQ0FTTEVBUUFBNHdMRUFTTEdBUUFBNUFMR0FTTEhBU0FBNVFJQUljZ0JJQURsQWdBaHlRRUNBT1lDQUNIS0FVQUExZ0lBSVJNTEFBRG9BZ0FnREFBQTZRSUFJQTRBQU9vQ0FDQVBBQURyQWdBZ3JBRUJBTlVDQUNHdkFVQUExZ0lBSWJzQkFRRFZBZ0FodkFFQkFOVUNBQ0c5QVFFQTRRSUFJYjRCQVFEaEFnQWh2d0VCQU9FQ0FDSEFBUUVBNFFJQUljSUJBQURpQXNJQklzUUJBQURqQXNRQklzWUJBQURrQXNZQklzY0JJQURsQWdBaHlBRWdBT1VDQUNISkFRSUE1Z0lBSWNvQlFBRFdBZ0FoQmF3QkFRQUFBQUd2QVVBQUFBQUJ1d0VCQUFBQUFjb0JRQUFBQUFIUEFRRUFBQUFCQWdBQUFGTUFJQjBBQUxjRUFDQVRBd0FBNmdNQUlBd0FBT3dEQUNBT0FBRHRBd0FnRHdBQTdnTUFJS3dCQVFBQUFBR3ZBVUFBQUFBQnV3RUJBQUFBQWJ3QkFRQUFBQUc5QVFFQUFBQUJ2Z0VCQUFBQUFiOEJBUUFBQUFIQUFRRUFBQUFCd2dFQUFBRENBUUxFQVFBQUFNUUJBc1lCQUFBQXhnRUN4d0VnQUFBQUFjZ0JJQUFBQUFISkFRSUFBQUFCeWdGQUFBQUFBUUlBQUFESEFRQWdIUUFBdVFRQUlBTUFBQURLQVFBZ0hRQUF1UVFBSUI0QUFMMEVBQ0FWQUFBQXlnRUFJQU1BQU9jQ0FDQU1BQURwQWdBZ0RnQUE2Z0lBSUE4QUFPc0NBQ0FXQUFDOUJBQWdyQUVCQU5VQ0FDR3ZBVUFBMWdJQUlic0JBUURWQWdBaHZBRUJBTlVDQUNHOUFRRUE0UUlBSWI0QkFRRGhBZ0FodndFQkFPRUNBQ0hBQVFFQTRRSUFJY0lCQUFEaUFzSUJJc1FCQUFEakFzUUJJc1lCQUFEa0FzWUJJc2NCSUFEbEFnQWh5QUVnQU9VQ0FDSEpBUUlBNWdJQUljb0JRQURXQWdBaEV3TUFBT2NDQUNBTUFBRHBBZ0FnRGdBQTZnSUFJQThBQU9zQ0FDQ3NBUUVBMVFJQUlhOEJRQURXQWdBaHV3RUJBTlVDQUNHOEFRRUExUUlBSWIwQkFRRGhBZ0FodmdFQkFPRUNBQ0dfQVFFQTRRSUFJY0FCQVFEaEFnQWh3Z0VBQU9JQ3dnRWl4QUVBQU9NQ3hBRWl4Z0VBQU9RQ3hnRWl4d0VnQU9VQ0FDSElBU0FBNVFJQUlja0JBZ0RtQWdBaHlnRkFBTllDQUNFSXJBRUJBQUFBQWEwQkFRQUFBQUd2QVVBQUFBQUJ4QUVBQUFEeEFRTEtBVUFBQUFBQjdRRkFBQUFBQWU0QkFnQUFBQUh2QVJBQUFBQUJFd01BQU9vREFDQUxBQURyQXdBZ0RnQUE3UU1BSUE4QUFPNERBQ0NzQVFFQUFBQUJyd0ZBQUFBQUFic0JBUUFBQUFHOEFRRUFBQUFCdlFFQkFBQUFBYjRCQVFBQUFBR19BUUVBQUFBQndBRUJBQUFBQWNJQkFBQUF3Z0VDeEFFQUFBREVBUUxHQVFBQUFNWUJBc2NCSUFBQUFBSElBU0FBQUFBQnlRRUNBQUFBQWNvQlFBQUFBQUVDQUFBQXh3RUFJQjBBQUw4RUFDQURBQUFBeWdFQUlCMEFBTDhFQUNBZUFBRERCQUFnRlFBQUFNb0JBQ0FEQUFEbkFnQWdDd0FBNkFJQUlBNEFBT29DQUNBUEFBRHJBZ0FnRmdBQXd3UUFJS3dCQVFEVkFnQWhyd0ZBQU5ZQ0FDRzdBUUVBMVFJQUlid0JBUURWQWdBaHZRRUJBT0VDQUNHLUFRRUE0UUlBSWI4QkFRRGhBZ0Fod0FFQkFPRUNBQ0hDQVFBQTRnTENBU0xFQVFBQTR3TEVBU0xHQVFBQTVBTEdBU0xIQVNBQTVRSUFJY2dCSUFEbEFnQWh5UUVDQU9ZQ0FDSEtBVUFBMWdJQUlSTURBQURuQWdBZ0N3QUE2QUlBSUE0QUFPb0NBQ0FQQUFEckFnQWdyQUVCQU5VQ0FDR3ZBVUFBMWdJQUlic0JBUURWQWdBaHZBRUJBTlVDQUNHOUFRRUE0UUlBSWI0QkFRRGhBZ0FodndFQkFPRUNBQ0hBQVFFQTRRSUFJY0lCQUFEaUFzSUJJc1FCQUFEakFzUUJJc1lCQUFEa0FzWUJJc2NCSUFEbEFnQWh5QUVnQU9VQ0FDSEpBUUlBNWdJQUljb0JRQURXQWdBaEJxd0JBUUFBQUFHdEFRRUFBQUFCcndGQUFBQUFBY29CUUFBQUFBSFVBUUlBQUFBQjNBRUJBQUFBQVFPc0FRRUFBQUFCclFFQkFBQUFBYThCUUFBQUFBRURBQUFBVmdBZ0hRQUF0d1FBSUI0QUFNZ0VBQ0FIQUFBQVZnQWdGZ0FBeUFRQUlLd0JBUURWQWdBaHJ3RkFBTllDQUNHN0FRRUExUUlBSWNvQlFBRFdBZ0FoendFQkFOVUNBQ0VGckFFQkFOVUNBQ0d2QVVBQTFnSUFJYnNCQVFEVkFnQWh5Z0ZBQU5ZQ0FDSFBBUUVBMVFJQUlRNnNBUUVBQUFBQnJ3RkFBQUFBQWNRQkFBQUExd0VDeUFFZ0FBQUFBY29CUUFBQUFBSE9BUUVBQUFBQnp3RUJBQUFBQWRBQkFRQUFBQUhSQVFFQUFBQUIwZ0VRQUFBQUFkTUJBZ0FBQUFIVUFRZ0FBQUFCMVFFQUFPVURBQ0RYQVFFQUFBQUJFd1VBQU9ZREFDQUdBQUQ2QXdBZ0RBQUE2QU1BSUEwQUFPa0RBQ0NzQVFFQUFBQUJyd0ZBQUFBQUFjUUJBQUFBMXdFQ3lBRWdBQUFBQWNvQlFBQUFBQUhPQVFFQUFBQUJ6d0VCQUFBQUFkQUJBUUFBQUFIUkFRRUFBQUFCMGdFUUFBQUFBZE1CQWdBQUFBSFVBUWdBQUFBQjFRRUFBT1VEQUNEWEFRRUFBQUFCMkFFQkFBQUFBUUlBQUFBRkFDQWRBQURLQkFBZ0Q2d0JBUUFBQUFHdkFVQUFBQUFCeEFFQUFBRGpBUUxLQVVBQUFBQUIzZ0VCQUFBQUFkOEJBUUFBQUFIZ0FSQUFBQUFCNFFFQkFBQUFBZU1CQVFBQUFBSGtBUUVBQUFBQjVRRUJBQUFBQWVZQkFRQUFBQUhuQVVBQUFBQUI2QUVCQUFBQUFla0JRQUFBQUFFREFBQUFBd0FnSFFBQXlnUUFJQjRBQU04RUFDQVZBQUFBQXdBZ0JRQUF3UU1BSUFZQUFQa0RBQ0FNQUFEREF3QWdEUUFBeEFNQUlCWUFBTThFQUNDc0FRRUExUUlBSWE4QlFBRFdBZ0FoeEFFQUFMOEQxd0VpeUFFZ0FPVUNBQ0hLQVVBQTFnSUFJYzRCQVFEVkFnQWh6d0VCQU5VQ0FDSFFBUUVBMVFJQUlkRUJBUURWQWdBaDBnRVFBSjBEQUNIVEFRSUE1Z0lBSWRRQkNBQzlBd0FoMVFFQUFMNERBQ0RYQVFFQTFRSUFJZGdCQVFEVkFnQWhFd1VBQU1FREFDQUdBQUQ1QXdBZ0RBQUF3d01BSUEwQUFNUURBQ0NzQVFFQTFRSUFJYThCUUFEV0FnQWh4QUVBQUw4RDF3RWl5QUVnQU9VQ0FDSEtBVUFBMWdJQUljNEJBUURWQWdBaHp3RUJBTlVDQUNIUUFRRUExUUlBSWRFQkFRRFZBZ0FoMGdFUUFKMERBQ0hUQVFJQTVnSUFJZFFCQ0FDOUF3QWgxUUVBQUw0REFDRFhBUUVBMVFJQUlkZ0JBUURWQWdBaENLd0JBUUFBQUFHdUFRRUFBQUFCcndGQUFBQUFBY1FCQUFBQThRRUN5Z0ZBQUFBQUFlMEJRQUFBQUFIdUFRSUFBQUFCN3dFUUFBQUFBUk1GQUFEbUF3QWdCZ0FBLWdNQUlBc0FBT2NEQUNBTkFBRHBBd0FnckFFQkFBQUFBYThCUUFBQUFBSEVBUUFBQU5jQkFzZ0JJQUFBQUFIS0FVQUFBQUFCemdFQkFBQUFBYzhCQVFBQUFBSFFBUUVBQUFBQjBRRUJBQUFBQWRJQkVBQUFBQUhUQVFJQUFBQUIxQUVJQUFBQUFkVUJBQURsQXdBZzF3RUJBQUFBQWRnQkFRQUFBQUVDQUFBQUJRQWdIUUFBMFFRQUlBTUFBQUFEQUNBZEFBRFJCQUFnSGdBQTFRUUFJQlVBQUFBREFDQUZBQURCQXdBZ0JnQUEtUU1BSUFzQUFNSURBQ0FOQUFERUF3QWdGZ0FBMVFRQUlLd0JBUURWQWdBaHJ3RkFBTllDQUNIRUFRQUF2d1BYQVNMSUFTQUE1UUlBSWNvQlFBRFdBZ0FoemdFQkFOVUNBQ0hQQVFFQTFRSUFJZEFCQVFEVkFnQWgwUUVCQU5VQ0FDSFNBUkFBblFNQUlkTUJBZ0RtQWdBaDFBRUlBTDBEQUNIVkFRQUF2Z01BSU5jQkFRRFZBZ0FoMkFFQkFOVUNBQ0VUQlFBQXdRTUFJQVlBQVBrREFDQUxBQURDQXdBZ0RRQUF4QU1BSUt3QkFRRFZBZ0FocndGQUFOWUNBQ0hFQVFBQXZ3UFhBU0xJQVNBQTVRSUFJY29CUUFEV0FnQWh6Z0VCQU5VQ0FDSFBBUUVBMVFJQUlkQUJBUURWQWdBaDBRRUJBTlVDQUNIU0FSQUFuUU1BSWRNQkFnRG1BZ0FoMUFFSUFMMERBQ0hWQVFBQXZnTUFJTmNCQVFEVkFnQWgyQUVCQU5VQ0FDRUdyQUVCQUFBQUFhNEJBUUFBQUFHdkFVQUFBQUFCeWdGQUFBQUFBZFFCQWdBQUFBSGNBUUVBQUFBQkNxd0JBUUFBQUFHdkFVQUFBQUFCeEFFQUFBRDFBUUxJQVNBQUFBQUJ5Z0ZBQUFBQUFjNEJBUUFBQUFIUEFRRUFBQUFCOFFFQkFBQUFBZklCQVFBQUFBSHpBUUVBQUFBQkE2d0JBUUFBQUFHdUFRRUFBQUFCcndGQUFBQUFBUk1GQUFEbUF3QWdCZ0FBLWdNQUlBc0FBT2NEQUNBTUFBRG9Bd0FnckFFQkFBQUFBYThCUUFBQUFBSEVBUUFBQU5jQkFzZ0JJQUFBQUFIS0FVQUFBQUFCemdFQkFBQUFBYzhCQVFBQUFBSFFBUUVBQUFBQjBRRUJBQUFBQWRJQkVBQUFBQUhUQVFJQUFBQUIxQUVJQUFBQUFkVUJBQURsQXdBZzF3RUJBQUFBQWRnQkFRQUFBQUVDQUFBQUJRQWdIUUFBMlFRQUlCTURBQURxQXdBZ0N3QUE2d01BSUF3QUFPd0RBQ0FPQUFEdEF3QWdyQUVCQUFBQUFhOEJRQUFBQUFHN0FRRUFBQUFCdkFFQkFBQUFBYjBCQVFBQUFBRy1BUUVBQUFBQnZ3RUJBQUFBQWNBQkFRQUFBQUhDQVFBQUFNSUJBc1FCQUFBQXhBRUN4Z0VBQUFER0FRTEhBU0FBQUFBQnlBRWdBQUFBQWNrQkFnQUFBQUhLQVVBQUFBQUJBZ0FBQU1jQkFDQWRBQURiQkFBZ0F3QUFBQU1BSUIwQUFOa0VBQ0FlQUFEZkJBQWdGUUFBQUFNQUlBVUFBTUVEQUNBR0FBRDVBd0FnQ3dBQXdnTUFJQXdBQU1NREFDQVdBQURmQkFBZ3JBRUJBTlVDQUNHdkFVQUExZ0lBSWNRQkFBQ19BOWNCSXNnQklBRGxBZ0FoeWdGQUFOWUNBQ0hPQVFFQTFRSUFJYzhCQVFEVkFnQWgwQUVCQU5VQ0FDSFJBUUVBMVFJQUlkSUJFQUNkQXdBaDB3RUNBT1lDQUNIVUFRZ0F2UU1BSWRVQkFBQy1Bd0FnMXdFQkFOVUNBQ0hZQVFFQTFRSUFJUk1GQUFEQkF3QWdCZ0FBLVFNQUlBc0FBTUlEQUNBTUFBRERBd0FnckFFQkFOVUNBQ0d2QVVBQTFnSUFJY1FCQUFDX0E5Y0JJc2dCSUFEbEFnQWh5Z0ZBQU5ZQ0FDSE9BUUVBMVFJQUljOEJBUURWQWdBaDBBRUJBTlVDQUNIUkFRRUExUUlBSWRJQkVBQ2RBd0FoMHdFQ0FPWUNBQ0hVQVFnQXZRTUFJZFVCQUFDLUF3QWcxd0VCQU5VQ0FDSFlBUUVBMVFJQUlRTUFBQURLQVFBZ0hRQUEyd1FBSUI0QUFPSUVBQ0FWQUFBQXlnRUFJQU1BQU9jQ0FDQUxBQURvQWdBZ0RBQUE2UUlBSUE0QUFPb0NBQ0FXQUFEaUJBQWdyQUVCQU5VQ0FDR3ZBVUFBMWdJQUlic0JBUURWQWdBaHZBRUJBTlVDQUNHOUFRRUE0UUlBSWI0QkFRRGhBZ0FodndFQkFPRUNBQ0hBQVFFQTRRSUFJY0lCQUFEaUFzSUJJc1FCQUFEakFzUUJJc1lCQUFEa0FzWUJJc2NCSUFEbEFnQWh5QUVnQU9VQ0FDSEpBUUlBNWdJQUljb0JRQURXQWdBaEV3TUFBT2NDQUNBTEFBRG9BZ0FnREFBQTZRSUFJQTRBQU9vQ0FDQ3NBUUVBMVFJQUlhOEJRQURXQWdBaHV3RUJBTlVDQUNHOEFRRUExUUlBSWIwQkFRRGhBZ0FodmdFQkFPRUNBQ0dfQVFFQTRRSUFJY0FCQVFEaEFnQWh3Z0VBQU9JQ3dnRWl4QUVBQU9NQ3hBRWl4Z0VBQU9RQ3hnRWl4d0VnQU9VQ0FDSElBU0FBNVFJQUlja0JBZ0RtQWdBaHlnRkFBTllDQUNFQkVBQUNCZ01HQXdRQURBc2RCZ3dlQ1E0aEFROGlDZ1lFQUFzRkFBUUdBQUlMREFZTUZRa05HUW9DQXdjREJBQUZBUU1JQUFRRUFBZ0hBQUlJQUFNS0VBY0JDUUFHQVFvUkFBSUhBQUlJQUFNQ0J3QUNDQUFEQXdzYUFBd2JBQTBjQUFVREl3QUxKQUFNSlFBT0pnQVBKd0FBQVJBQUFnRVFBQUlEQkFBUkl3QVNKQUFUQUFBQUF3UUFFU01BRWlRQUV3SUhBQUlJQUFNQ0J3QUNDQUFEQlFRQUdDTUFHeVFBSERVQUdUWUFHZ0FBQUFBQUJRUUFHQ01BR3lRQUhEVUFHVFlBR2dBQUF3UUFJU01BSWlRQUl3QUFBQU1FQUNFakFDSWtBQ01BQUFBREJBQXBJd0FxSkFBckFBQUFBd1FBS1NNQUtpUUFLd0VKQUFZQkNRQUdCUVFBTUNNQU15UUFORFVBTVRZQU1nQUFBQUFBQlFRQU1DTUFNeVFBTkRVQU1UWUFNZ0lIQUFJSUFBTUNCd0FDQ0FBREJRUUFPU01BUENRQVBUVUFPallBT3dBQUFBQUFCUVFBT1NNQVBDUUFQVFVBT2pZQU93SUZBQVFHQUFJQ0JRQUVCZ0FDQlFRQVFpTUFSU1FBUmpVQVF6WUFSQUFBQUFBQUJRUUFRaU1BUlNRQVJqVUFRellBUkFBQUJRUUFTeU1BVGlRQVR6VUFURFlBVFFBQUFBQUFCUVFBU3lNQVRpUUFUelVBVERZQVRRSUhBQUlJQUFNQ0J3QUNDQUFEQXdRQVZDTUFWU1FBVmdBQUFBTUVBRlFqQUZVa0FGWVJBZ0VTS0FFVEtRRVVLZ0VWS3dFWExRRVlMdzBaTUE0YU1nRWJOQTBjTlE4Zk5nRWdOd0VoT0EwbE94QW1QQlFuUFFZb1BnWXBQd1lxUUFZclFRWXNRd1l0UlEwdVJoVXZTQVl3U2cweFN4WXlUQVl6VFFZMFRnMDNVUmM0VWgwNVZBUTZWUVE3V0FROFdRUTlXZ1EtWEFRX1hnMUFYeDVCWVFSQ1l3MURaQjlFWlFSRlpnUkdadzFIYWlCSWF5UkpiU1ZLYmlWTGNTVk1jaVZOY3lWT2RTVlBkdzFRZUNaUmVpVlNmQTFUZlNkVWZpVlZmeVZXZ0FFTlY0TUJLRmlFQVN4WmhRRUhXb1lCQjF1SEFRZGNpQUVIWFlrQkIxNkxBUWRmalFFTllJNEJMV0dRQVFkaWtnRU5ZNU1CTG1TVUFRZGxsUUVIWnBZQkRXZVpBUzlvbWdFMWFac0JDV3FjQVFscm5RRUpiSjRCQ1cyZkFRbHVvUUVKYjZNQkRYQ2tBVFp4cGdFSmNxZ0JEWE9wQVRkMHFnRUpkYXNCQ1hhc0FRMTNyd0U0ZUxBQlBubXhBUU42c2dFRGU3TUJBM3kwQVFOOXRRRURmcmNCQTMtNUFRMkFBYm9CUDRFQnZBRURnZ0ctQVEyREFiOEJRSVFCd0FFRGhRSEJBUU9HQWNJQkRZY0J4UUZCaUFIR0FVZUpBY2dCQW9vQnlRRUNpd0hNQVFLTUFjMEJBbzBCemdFQ2pnSFFBUUtQQWRJQkRaQUIwd0ZJa1FIVkFRS1NBZGNCRFpNQjJBRkpsQUhaQVFLVkFkb0JBcFlCMndFTmx3SGVBVXFZQWQ4QlVKa0I0QUVLbWdIaEFRcWJBZUlCQ3B3QjR3RUtuUUhrQVFxZUFlWUJDcDhCNkFFTm9BSHBBVkdoQWVzQkNxSUI3UUVOb3dIdUFWS2tBZThCQ3FVQjhBRUtwZ0h4QVEybkFmUUJVNmdCOVFGWFwiXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRlY29kZUJhc2U2NEFzV2FzbSh3YXNtQmFzZTY0OiBzdHJpbmcpOiBQcm9taXNlPFdlYkFzc2VtYmx5Lk1vZHVsZT4ge1xuICBjb25zdCB7IEJ1ZmZlciB9ID0gYXdhaXQgaW1wb3J0KCdub2RlOmJ1ZmZlcicpXG4gIGNvbnN0IHdhc21BcnJheSA9IEJ1ZmZlci5mcm9tKHdhc21CYXNlNjQsICdiYXNlNjQnKVxuICByZXR1cm4gbmV3IFdlYkFzc2VtYmx5Lk1vZHVsZSh3YXNtQXJyYXkpXG59XG5cbmNvbmZpZy5jb21waWxlcldhc20gPSB7XG4gIGdldFJ1bnRpbWU6IGFzeW5jICgpID0+IGF3YWl0IGltcG9ydChcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvcXVlcnlfY29tcGlsZXJfZmFzdF9iZy5wb3N0Z3Jlc3FsLm1qc1wiKSxcblxuICBnZXRRdWVyeUNvbXBpbGVyV2FzbU1vZHVsZTogYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHsgd2FzbSB9ID0gYXdhaXQgaW1wb3J0KFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9xdWVyeV9jb21waWxlcl9mYXN0X2JnLnBvc3RncmVzcWwud2FzbS1iYXNlNjQubWpzXCIpXG4gICAgcmV0dXJuIGF3YWl0IGRlY29kZUJhc2U2NEFzV2FzbSh3YXNtKVxuICB9LFxuXG4gIGltcG9ydE5hbWU6IFwiLi9xdWVyeV9jb21waWxlcl9mYXN0X2JnLmpzXCJcbn1cblxuXG5cbmV4cG9ydCB0eXBlIExvZ09wdGlvbnM8Q2xpZW50T3B0aW9ucyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zPiA9XG4gICdsb2cnIGV4dGVuZHMga2V5b2YgQ2xpZW50T3B0aW9ucyA/IENsaWVudE9wdGlvbnNbJ2xvZyddIGV4dGVuZHMgQXJyYXk8UHJpc21hLkxvZ0xldmVsIHwgUHJpc21hLkxvZ0RlZmluaXRpb24+ID8gUHJpc21hLkdldEV2ZW50czxDbGllbnRPcHRpb25zWydsb2cnXT4gOiBuZXZlciA6IG5ldmVyXG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50Q29uc3RydWN0b3Ige1xuICAgIC8qKlxuICAgKiAjIyBQcmlzbWEgQ2xpZW50XG4gICAqIFxuICAgKiBUeXBlLXNhZmUgZGF0YWJhc2UgY2xpZW50IGZvciBUeXBlU2NyaXB0XG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHtcbiAgICogICBhZGFwdGVyOiBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAgICogfSlcbiAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dQb3N0c1xuICAgKiBjb25zdCBibG9nUG9zdHMgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoKVxuICAgKiBgYGBcbiAgICogXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2NsaWVudCkuXG4gICAqL1xuXG4gIG5ldyA8XG4gICAgT3B0aW9ucyBleHRlbmRzIFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnMsXG4gICAgTG9nT3B0cyBleHRlbmRzIExvZ09wdGlvbnM8T3B0aW9ucz4gPSBMb2dPcHRpb25zPE9wdGlvbnM+LFxuICAgIE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSA9IE9wdGlvbnMgZXh0ZW5kcyB7IG9taXQ6IGluZmVyIFUgfSA/IFUgOiBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddLFxuICAgIEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzXG4gID4ob3B0aW9uczogUHJpc21hLlByaXNtYUNsaWVudENvbnN0cnVjdG9yQXJnczxPcHRpb25zPik6IFByaXNtYUNsaWVudDxMb2dPcHRzLCBPbWl0T3B0cywgRXh0QXJncz5cbn1cblxuLyoqXG4gKiAjIyBQcmlzbWEgQ2xpZW50XG4gKiBcbiAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICogICBhZGFwdGVyOiBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAqIH0pXG4gKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ1Bvc3RzXG4gKiBjb25zdCBibG9nUG9zdHMgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoKVxuICogYGBgXG4gKiBcbiAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2NsaWVudCkuXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnQ8XG4gIGluIExvZ09wdHMgZXh0ZW5kcyBQcmlzbWEuTG9nTGV2ZWwgPSBuZXZlcixcbiAgaW4gb3V0IE9taXRPcHRzIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSA9IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10sXG4gIGluIG91dCBFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJnc1xuPiB7XG4gIFtLOiBzeW1ib2xdOiB7IHR5cGVzOiBQcmlzbWEuVHlwZU1hcDxFeHRBcmdzPlsnb3RoZXInXSB9XG5cbiAgJG9uPFYgZXh0ZW5kcyBMb2dPcHRzPihldmVudFR5cGU6IFYsIGNhbGxiYWNrOiAoZXZlbnQ6IFYgZXh0ZW5kcyAncXVlcnknID8gUHJpc21hLlF1ZXJ5RXZlbnQgOiBQcmlzbWEuTG9nRXZlbnQpID0+IHZvaWQpOiBQcmlzbWFDbGllbnQ7XG5cbiAgLyoqXG4gICAqIENvbm5lY3Qgd2l0aCB0aGUgZGF0YWJhc2VcbiAgICovXG4gICRjb25uZWN0KCk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPHZvaWQ+O1xuXG4gIC8qKlxuICAgKiBEaXNjb25uZWN0IGZyb20gdGhlIGRhdGFiYXNlXG4gICAqL1xuICAkZGlzY29ubmVjdCgpOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTx2b2lkPjtcblxuLyoqXG4gICAqIEV4ZWN1dGVzIGEgcHJlcGFyZWQgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWQgcm93cy5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kZXhlY3V0ZVJhd2BVUERBVEUgVXNlciBTRVQgY29vbCA9ICR7dHJ1ZX0gV0hFUkUgZW1haWwgPSAkeyd1c2VyQGVtYWlsLmNvbSd9O2BcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRleGVjdXRlUmF3PFQgPSB1bmtub3duPihxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBQcmlzbWEuU3FsLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8bnVtYmVyPjtcblxuICAvKipcbiAgICogRXhlY3V0ZXMgYSByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIG51bWJlciBvZiBhZmZlY3RlZCByb3dzLlxuICAgKiBTdXNjZXB0aWJsZSB0byBTUUwgaW5qZWN0aW9ucywgc2VlIGRvY3VtZW50YXRpb24uXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJGV4ZWN1dGVSYXdVbnNhZmUoJ1VQREFURSBVc2VyIFNFVCBjb29sID0gJDEgV0hFUkUgZW1haWwgPSAkMiA7JywgdHJ1ZSwgJ3VzZXJAZW1haWwuY29tJylcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRleGVjdXRlUmF3VW5zYWZlPFQgPSB1bmtub3duPihxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8bnVtYmVyPjtcblxuICAvKipcbiAgICogUGVyZm9ybXMgYSBwcmVwYXJlZCByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIGBTRUxFQ1RgIGRhdGEuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3YFNFTEVDVCAqIEZST00gVXNlciBXSEVSRSBpZCA9ICR7MX0gT1IgZW1haWwgPSAkeyd1c2VyQGVtYWlsLmNvbSd9O2BcbiAgICogYGBgXG4gICAqXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL3Jhdy1xdWVyaWVzKS5cbiAgICovXG4gICRxdWVyeVJhdzxUID0gdW5rbm93bj4ocXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgUHJpc21hLlNxbCwgLi4udmFsdWVzOiBhbnlbXSk6IFByaXNtYS5QcmlzbWFQcm9taXNlPFQ+O1xuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBhIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgYFNFTEVDVGAgZGF0YS5cbiAgICogU3VzY2VwdGlibGUgdG8gU1FMIGluamVjdGlvbnMsIHNlZSBkb2N1bWVudGF0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRxdWVyeVJhd1Vuc2FmZSgnU0VMRUNUICogRlJPTSBVc2VyIFdIRVJFIGlkID0gJDEgT1IgZW1haWwgPSAkMjsnLCAxLCAndXNlckBlbWFpbC5jb20nKVxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJHF1ZXJ5UmF3VW5zYWZlPFQgPSB1bmtub3duPihxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8VD47XG5cblxuICAvKipcbiAgICogQWxsb3dzIHRoZSBydW5uaW5nIG9mIGEgc2VxdWVuY2Ugb2YgcmVhZC93cml0ZSBvcGVyYXRpb25zIHRoYXQgYXJlIGd1YXJhbnRlZWQgdG8gZWl0aGVyIHN1Y2NlZWQgb3IgZmFpbCBhcyBhIHdob2xlLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgW2dlb3JnZSwgYm9iLCBhbGljZV0gPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKFtcbiAgICogICBwcmlzbWEudXNlci5jcmVhdGUoeyBkYXRhOiB7IG5hbWU6ICdHZW9yZ2UnIH0gfSksXG4gICAqICAgcHJpc21hLnVzZXIuY3JlYXRlKHsgZGF0YTogeyBuYW1lOiAnQm9iJyB9IH0pLFxuICAgKiAgIHByaXNtYS51c2VyLmNyZWF0ZSh7IGRhdGE6IHsgbmFtZTogJ0FsaWNlJyB9IH0pLFxuICAgKiBdKVxuICAgKiBgYGBcbiAgICogXG4gICAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vd3d3LnByaXNtYS5pby9kb2NzL29ybS9wcmlzbWEtY2xpZW50L3F1ZXJpZXMvdHJhbnNhY3Rpb25zKS5cbiAgICovXG4gICR0cmFuc2FjdGlvbjxQIGV4dGVuZHMgUHJpc21hLlByaXNtYVByb21pc2U8YW55PltdPihhcmc6IFsuLi5QXSwgb3B0aW9ucz86IHsgbWF4V2FpdD86IG51bWJlciwgdGltZW91dD86IG51bWJlciwgaXNvbGF0aW9uTGV2ZWw/OiBQcmlzbWEuVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCB9KTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8cnVudGltZS5UeXBlcy5VdGlscy5VbndyYXBUdXBsZTxQPj5cblxuICAkdHJhbnNhY3Rpb248Uj4oZm46IChwcmlzbWE6IE9taXQ8UHJpc21hQ2xpZW50LCBydW50aW1lLklUWENsaWVudERlbnlMaXN0PikgPT4gcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8Uj4sIG9wdGlvbnM/OiB7IG1heFdhaXQ/OiBudW1iZXIsIHRpbWVvdXQ/OiBudW1iZXIsIGlzb2xhdGlvbkxldmVsPzogUHJpc21hLlRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgfSk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPFI+XG5cbiAgJGV4dGVuZHM6IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5FeHRlbmRzSG9vazxcImV4dGVuZHNcIiwgUHJpc21hLlR5cGVNYXBDYjxPbWl0T3B0cz4sIEV4dEFyZ3MsIHJ1bnRpbWUuVHlwZXMuVXRpbHMuQ2FsbDxQcmlzbWEuVHlwZU1hcENiPE9taXRPcHRzPiwge1xuICAgIGV4dEFyZ3M6IEV4dEFyZ3NcbiAgfT4+XG5cbiAgICAgIC8qKlxuICAgKiBgcHJpc21hLmJsb2dQb3N0YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkJsb2dQb3N0KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nUG9zdHNcbiAgICAqIGNvbnN0IGJsb2dQb3N0cyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgYmxvZ1Bvc3QoKTogUHJpc21hLkJsb2dQb3N0RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5ib29raW5nYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkJvb2tpbmcqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJvb2tpbmdzXG4gICAgKiBjb25zdCBib29raW5ncyA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBib29raW5nKCk6IFByaXNtYS5Cb29raW5nRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5jYXRlZ29yeWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipDYXRlZ29yeSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQ2F0ZWdvcmllc1xuICAgICogY29uc3QgY2F0ZWdvcmllcyA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgY2F0ZWdvcnkoKTogUHJpc21hLkNhdGVnb3J5RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5jb250YWN0TWVzc2FnZWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipDb250YWN0TWVzc2FnZSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQ29udGFjdE1lc3NhZ2VzXG4gICAgKiBjb25zdCBjb250YWN0TWVzc2FnZXMgPSBhd2FpdCBwcmlzbWEuY29udGFjdE1lc3NhZ2UuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGNvbnRhY3RNZXNzYWdlKCk6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEucGF5bWVudGA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipQYXltZW50KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBQYXltZW50c1xuICAgICogY29uc3QgcGF5bWVudHMgPSBhd2FpdCBwcmlzbWEucGF5bWVudC5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgcGF5bWVudCgpOiBQcmlzbWEuUGF5bWVudERlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEucmV2aWV3YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlJldmlldyoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgUmV2aWV3c1xuICAgICogY29uc3QgcmV2aWV3cyA9IGF3YWl0IHByaXNtYS5yZXZpZXcuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHJldmlldygpOiBQcmlzbWEuUmV2aWV3RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS50b3VyUGFja2FnZWA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipUb3VyUGFja2FnZSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgVG91clBhY2thZ2VzXG4gICAgKiBjb25zdCB0b3VyUGFja2FnZXMgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHRvdXJQYWNrYWdlKCk6IFByaXNtYS5Ub3VyUGFja2FnZURlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEudXNlcmA6IEV4cG9zZXMgQ1JVRCBvcGVyYXRpb25zIGZvciB0aGUgKipVc2VyKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBVc2Vyc1xuICAgICogY29uc3QgdXNlcnMgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgdXNlcigpOiBQcmlzbWEuVXNlckRlbGVnYXRlPEV4dEFyZ3MsIHsgb21pdDogT21pdE9wdHMgfT47XG5cbiAgLyoqXG4gICAqIGBwcmlzbWEud2lzaGxpc3RJdGVtYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKldpc2hsaXN0SXRlbSoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgV2lzaGxpc3RJdGVtc1xuICAgICogY29uc3Qgd2lzaGxpc3RJdGVtcyA9IGF3YWl0IHByaXNtYS53aXNobGlzdEl0ZW0uZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IHdpc2hsaXN0SXRlbSgpOiBQcmlzbWEuV2lzaGxpc3RJdGVtRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9Pjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFByaXNtYUNsaWVudENsYXNzKCk6IFByaXNtYUNsaWVudENvbnN0cnVjdG9yIHtcbiAgcmV0dXJuIHJ1bnRpbWUuZ2V0UHJpc21hQ2xpZW50KGNvbmZpZykgYXMgdW5rbm93biBhcyBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvclxufVxuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogV0FSTklORzogVGhpcyBpcyBhbiBpbnRlcm5hbCBmaWxlIHRoYXQgaXMgc3ViamVjdCB0byBjaGFuZ2UhXG4gKlxuICogXHVEODNEXHVERUQxIFVuZGVyIG5vIGNpcmN1bXN0YW5jZXMgc2hvdWxkIHlvdSBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5ISBcdUQ4M0RcdURFRDFcbiAqXG4gKiBBbGwgZXhwb3J0cyBmcm9tIHRoaXMgZmlsZSBhcmUgd3JhcHBlZCB1bmRlciBhIGBQcmlzbWFgIG5hbWVzcGFjZSBvYmplY3QgaW4gdGhlIGNsaWVudC50cyBmaWxlLlxuICogV2hpbGUgdGhpcyBlbmFibGVzIHBhcnRpYWwgYmFja3dhcmQgY29tcGF0aWJpbGl0eSwgaXQgaXMgbm90IHBhcnQgb2YgdGhlIHN0YWJsZSBwdWJsaWMgQVBJLlxuICpcbiAqIElmIHlvdSBhcmUgbG9va2luZyBmb3IgeW91ciBNb2RlbHMsIEVudW1zLCBhbmQgSW5wdXQgVHlwZXMsIHBsZWFzZSBpbXBvcnQgdGhlbSBmcm9tIHRoZSByZXNwZWN0aXZlXG4gKiBtb2RlbCBmaWxlcyBpbiB0aGUgYG1vZGVsYCBkaXJlY3RvcnkhXG4gKi9cblxuaW1wb3J0ICogYXMgcnVudGltZSBmcm9tIFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9jbGllbnRcIlxuaW1wb3J0IHR5cGUgKiBhcyBQcmlzbWEgZnJvbSBcIi4uL21vZGVsc1wiXG5pbXBvcnQgeyB0eXBlIFByaXNtYUNsaWVudCB9IGZyb20gXCIuL2NsYXNzXCJcblxuZXhwb3J0IHR5cGUgKiBmcm9tICcuLi9tb2RlbHMnXG5cbmV4cG9ydCB0eXBlIERNTUYgPSB0eXBlb2YgcnVudGltZS5ETU1GXG5cbmV4cG9ydCB0eXBlIFByaXNtYVByb21pc2U8VD4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5QcmlzbWFQcm9taXNlPFQ+XG5cbi8qKlxuICogUHJpc21hIEVycm9yc1xuICovXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclxuXG4vKipcbiAqIFJlLWV4cG9ydCBvZiBzcWwtdGVtcGxhdGUtdGFnXG4gKi9cbmV4cG9ydCBjb25zdCBzcWwgPSBydW50aW1lLnNxbHRhZ1xuZXhwb3J0IGNvbnN0IGVtcHR5ID0gcnVudGltZS5lbXB0eVxuZXhwb3J0IGNvbnN0IGpvaW4gPSBydW50aW1lLmpvaW5cbmV4cG9ydCBjb25zdCByYXcgPSBydW50aW1lLnJhd1xuZXhwb3J0IGNvbnN0IFNxbCA9IHJ1bnRpbWUuU3FsXG5leHBvcnQgdHlwZSBTcWwgPSBydW50aW1lLlNxbFxuXG5cblxuLyoqXG4gKiBEZWNpbWFsLmpzXG4gKi9cbmV4cG9ydCBjb25zdCBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5leHBvcnQgdHlwZSBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5cbmV4cG9ydCB0eXBlIERlY2ltYWxKc0xpa2UgPSBydW50aW1lLkRlY2ltYWxKc0xpa2VcblxuLyoqXG4qIEV4dGVuc2lvbnNcbiovXG5leHBvcnQgdHlwZSBFeHRlbnNpb24gPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuVXNlckFyZ3NcbmV4cG9ydCBjb25zdCBnZXRFeHRlbnNpb25Db250ZXh0ID0gcnVudGltZS5FeHRlbnNpb25zLmdldEV4dGVuc2lvbkNvbnRleHRcbmV4cG9ydCB0eXBlIEFyZ3M8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLkFyZ3M8VCwgRj5cbmV4cG9ydCB0eXBlIFBheWxvYWQ8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uID0gbmV2ZXI+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuUGF5bG9hZDxULCBGPlxuZXhwb3J0IHR5cGUgUmVzdWx0PFQsIEEsIEYgZXh0ZW5kcyBydW50aW1lLk9wZXJhdGlvbj4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5SZXN1bHQ8VCwgQSwgRj5cbmV4cG9ydCB0eXBlIEV4YWN0PEEsIFc+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuRXhhY3Q8QSwgVz5cblxuZXhwb3J0IHR5cGUgUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBzdHJpbmdcbiAgZW5naW5lOiBzdHJpbmdcbn1cblxuLyoqXG4gKiBQcmlzbWEgQ2xpZW50IEpTIHZlcnNpb246IDcuOS4xXG4gKiBRdWVyeSBFbmdpbmUgdmVyc2lvbjogZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFxuICovXG5leHBvcnQgY29uc3QgcHJpc21hVmVyc2lvbjogUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBcIjcuOS4xXCIsXG4gIGVuZ2luZTogXCJlOTIyMDg5YjdkNzUwMmFmZjQyNDlkNWRhMzQyMGY2ZmE1NWZjNmFkXCJcbn1cblxuLyoqXG4gKiBVdGlsaXR5IFR5cGVzXG4gKi9cblxuZXhwb3J0IHR5cGUgQnl0ZXMgPSBydW50aW1lLkJ5dGVzXG5leHBvcnQgdHlwZSBKc29uT2JqZWN0ID0gcnVudGltZS5Kc29uT2JqZWN0XG5leHBvcnQgdHlwZSBKc29uQXJyYXkgPSBydW50aW1lLkpzb25BcnJheVxuZXhwb3J0IHR5cGUgSnNvblZhbHVlID0gcnVudGltZS5Kc29uVmFsdWVcbmV4cG9ydCB0eXBlIElucHV0SnNvbk9iamVjdCA9IHJ1bnRpbWUuSW5wdXRKc29uT2JqZWN0XG5leHBvcnQgdHlwZSBJbnB1dEpzb25BcnJheSA9IHJ1bnRpbWUuSW5wdXRKc29uQXJyYXlcbmV4cG9ydCB0eXBlIElucHV0SnNvblZhbHVlID0gcnVudGltZS5JbnB1dEpzb25WYWx1ZVxuXG5cbmV4cG9ydCBjb25zdCBOdWxsVHlwZXMgPSB7XG4gIERiTnVsbDogcnVudGltZS5OdWxsVHlwZXMuRGJOdWxsIGFzIChuZXcgKHNlY3JldDogbmV2ZXIpID0+IHR5cGVvZiBydW50aW1lLkRiTnVsbCksXG4gIEpzb25OdWxsOiBydW50aW1lLk51bGxUeXBlcy5Kc29uTnVsbCBhcyAobmV3IChzZWNyZXQ6IG5ldmVyKSA9PiB0eXBlb2YgcnVudGltZS5Kc29uTnVsbCksXG4gIEFueU51bGw6IHJ1bnRpbWUuTnVsbFR5cGVzLkFueU51bGwgYXMgKG5ldyAoc2VjcmV0OiBuZXZlcikgPT4gdHlwZW9mIHJ1bnRpbWUuQW55TnVsbCksXG59XG4vKipcbiAqIEhlbHBlciBmb3IgZmlsdGVyaW5nIEpTT04gZW50cmllcyB0aGF0IGhhdmUgYG51bGxgIG9uIHRoZSBkYXRhYmFzZSAoZW1wdHkgb24gdGhlIGRiKVxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IERiTnVsbCA9IHJ1bnRpbWUuRGJOdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgaGF2ZSBKU09OIGBudWxsYCB2YWx1ZXMgKG5vdCBlbXB0eSBvbiB0aGUgZGIpXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgSnNvbk51bGwgPSBydW50aW1lLkpzb25OdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgYXJlIGBQcmlzbWEuRGJOdWxsYCBvciBgUHJpc21hLkpzb25OdWxsYFxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IEFueU51bGwgPSBydW50aW1lLkFueU51bGxcblxuXG50eXBlIFNlbGVjdEFuZEluY2x1ZGUgPSB7XG4gIHNlbGVjdDogYW55XG4gIGluY2x1ZGU6IGFueVxufVxuXG50eXBlIFNlbGVjdEFuZE9taXQgPSB7XG4gIHNlbGVjdDogYW55XG4gIG9taXQ6IGFueVxufVxuXG4vKipcbiAqIEZyb20gVCwgcGljayBhIHNldCBvZiBwcm9wZXJ0aWVzIHdob3NlIGtleXMgYXJlIGluIHRoZSB1bmlvbiBLXG4gKi9cbnR5cGUgUHJpc21hX19QaWNrPFQsIEsgZXh0ZW5kcyBrZXlvZiBUPiA9IHtcbiAgICBbUCBpbiBLXTogVFtQXTtcbn07XG5cbmV4cG9ydCB0eXBlIEVudW1lcmFibGU8VD4gPSBUIHwgQXJyYXk8VD47XG5cbi8qKlxuICogU3Vic2V0XG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAuIFNpbXBsZSB2ZXJzaW9uIG9mIEludGVyc2VjdGlvblxuICovXG5leHBvcnQgdHlwZSBTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlcjtcbn07XG5cbi8qKlxuICogUmVzb2x2ZWQgdHlwZSBvZiB0aGUgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBgUHJpc21hQ2xpZW50YCBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBXaGVuIGNhbGxlZCB3aXRob3V0IGEgbmFycm93ZXIgb3B0aW9ucyB0eXBlICh0aGUgY29tbW9uIGNhc2UpLCB0aGlzIHJlc29sdmVzXG4gKiB0byBgUHJpc21hQ2xpZW50T3B0aW9uc2AgZGlyZWN0bHksIHdoaWNoIHByb2R1Y2VzIGEgY2xlYXIgVHlwZVNjcmlwdCBlcnJvclxuICogbWVzc2FnZSAoYG5vdCBhc3NpZ25hYmxlIHRvIHBhcmFtZXRlciBvZiB0eXBlICdQcmlzbWFDbGllbnRPcHRpb25zJ2ApIHdoZW5cbiAqIHRoZSBhcmd1bWVudCBpcyBtaXNzaW5nIG9yIGluY29tcGxldGUuIFdoZW4gdGhlIHVzZXIgc3VwcGxpZXMgYSBuYXJyb3dlclxuICogb3B0aW9ucyB0eXBlIChlLmcuIHZpYSBhIGxpdGVyYWwpLCBpdCBmYWxscyBiYWNrIHRvIGBTdWJzZXRgIHRvIGtlZXBcbiAqIGZpbHRlcmluZyBvdXQgdW5rbm93biBwcm9wZXJ0aWVzLlxuICovXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvckFyZ3M8T3B0aW9ucyBleHRlbmRzIFByaXNtYUNsaWVudE9wdGlvbnM+ID1cbiAgW1ByaXNtYUNsaWVudE9wdGlvbnNdIGV4dGVuZHMgW09wdGlvbnNdID8gUHJpc21hQ2xpZW50T3B0aW9ucyA6IFN1YnNldDxPcHRpb25zLCBQcmlzbWFDbGllbnRPcHRpb25zPjtcblxuLyoqXG4gKiBTZWxlY3RTdWJzZXRcbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYC4gU2ltcGxlIHZlcnNpb24gb2YgSW50ZXJzZWN0aW9uLlxuICogQWRkaXRpb25hbGx5LCBpdCB2YWxpZGF0ZXMsIGlmIGJvdGggc2VsZWN0IGFuZCBpbmNsdWRlIGFyZSBwcmVzZW50LiBJZiB0aGUgY2FzZSwgaXQgZXJyb3JzLlxuICovXG5leHBvcnQgdHlwZSBTZWxlY3RTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlclxufSAmXG4gIChUIGV4dGVuZHMgU2VsZWN0QW5kSW5jbHVkZVxuICAgID8gJ1BsZWFzZSBlaXRoZXIgY2hvb3NlIGBzZWxlY3RgIG9yIGBpbmNsdWRlYC4nXG4gICAgOiBUIGV4dGVuZHMgU2VsZWN0QW5kT21pdFxuICAgICAgPyAnUGxlYXNlIGVpdGhlciBjaG9vc2UgYHNlbGVjdGAgb3IgYG9taXRgLidcbiAgICAgIDoge30pXG5cbi8qKlxuICogU3Vic2V0ICsgSW50ZXJzZWN0aW9uXG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAgYW5kIGludGVyc2VjdCBgS2BcbiAqL1xuZXhwb3J0IHR5cGUgU3Vic2V0SW50ZXJzZWN0aW9uPFQsIFUsIEs+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiBrZXkgZXh0ZW5kcyBrZXlvZiBVID8gVFtrZXldIDogbmV2ZXJcbn0gJlxuICBLXG5cbnR5cGUgV2l0aG91dDxULCBVPiA9IHsgW1AgaW4gRXhjbHVkZTxrZXlvZiBULCBrZXlvZiBVPl0/OiBuZXZlciB9O1xuXG4vKipcbiAqIFhPUiBpcyBuZWVkZWQgdG8gaGF2ZSBhIHJlYWwgbXV0dWFsbHkgZXhjbHVzaXZlIHVuaW9uIHR5cGVcbiAqIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQyMTIzNDA3L2RvZXMtdHlwZXNjcmlwdC1zdXBwb3J0LW11dHVhbGx5LWV4Y2x1c2l2ZS10eXBlc1xuICovXG5leHBvcnQgdHlwZSBYT1I8VCwgVT4gPVxuICBUIGV4dGVuZHMgb2JqZWN0ID9cbiAgVSBleHRlbmRzIG9iamVjdCA/XG4gICAgKChXaXRob3V0PFQsIFU+ICYgVSkgfCAoV2l0aG91dDxVLCBUPiAmIFQpKSAmIG9iamVjdFxuICA6IFUgOiBUXG5cblxuLyoqXG4gKiBJcyBUIGEgUmVjb3JkP1xuICovXG50eXBlIElzT2JqZWN0PFQgZXh0ZW5kcyBhbnk+ID0gVCBleHRlbmRzIEFycmF5PGFueT5cbj8gRmFsc2VcbjogVCBleHRlbmRzIERhdGVcbj8gRmFsc2VcbjogVCBleHRlbmRzIFVpbnQ4QXJyYXlcbj8gRmFsc2VcbjogVCBleHRlbmRzIEJpZ0ludFxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgb2JqZWN0XG4/IFRydWVcbjogRmFsc2VcblxuXG4vKipcbiAqIElmIGl0J3MgVFtdLCByZXR1cm4gVFxuICovXG5leHBvcnQgdHlwZSBVbkVudW1lcmF0ZTxUIGV4dGVuZHMgdW5rbm93bj4gPSBUIGV4dGVuZHMgQXJyYXk8aW5mZXIgVT4gPyBVIDogVFxuXG4vKipcbiAqIEZyb20gdHMtdG9vbGJlbHRcbiAqL1xuXG50eXBlIF9fRWl0aGVyPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gT21pdDxPLCBLPiAmXG4gIHtcbiAgICAvLyBNZXJnZSBhbGwgYnV0IEtcbiAgICBbUCBpbiBLXTogUHJpc21hX19QaWNrPE8sIFAgJiBrZXlvZiBPPiAvLyBXaXRoIEsgcG9zc2liaWxpdGllc1xuICB9W0tdXG5cbnR5cGUgRWl0aGVyU3RyaWN0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gU3RyaWN0PF9fRWl0aGVyPE8sIEs+PlxuXG50eXBlIEVpdGhlckxvb3NlPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gQ29tcHV0ZVJhdzxfX0VpdGhlcjxPLCBLPj5cblxudHlwZSBfRWl0aGVyPFxuICBPIGV4dGVuZHMgb2JqZWN0LFxuICBLIGV4dGVuZHMgS2V5LFxuICBzdHJpY3QgZXh0ZW5kcyBCb29sZWFuXG4+ID0ge1xuICAxOiBFaXRoZXJTdHJpY3Q8TywgSz5cbiAgMDogRWl0aGVyTG9vc2U8TywgSz5cbn1bc3RyaWN0XVxuXG5leHBvcnQgdHlwZSBFaXRoZXI8XG4gIE8gZXh0ZW5kcyBvYmplY3QsXG4gIEsgZXh0ZW5kcyBLZXksXG4gIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxXG4+ID0gTyBleHRlbmRzIHVua25vd24gPyBfRWl0aGVyPE8sIEssIHN0cmljdD4gOiBuZXZlclxuXG5leHBvcnQgdHlwZSBVbmlvbiA9IGFueVxuXG5leHBvcnQgdHlwZSBQYXRjaFVuZGVmaW5lZDxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gIFtLIGluIGtleW9mIE9dOiBPW0tdIGV4dGVuZHMgdW5kZWZpbmVkID8gQXQ8TzEsIEs+IDogT1tLXVxufSAmIHt9XG5cbi8qKiBIZWxwZXIgVHlwZXMgZm9yIFwiTWVyZ2VcIiAqKi9cbmV4cG9ydCB0eXBlIEludGVyc2VjdE9mPFUgZXh0ZW5kcyBVbmlvbj4gPSAoXG4gIFUgZXh0ZW5kcyB1bmtub3duID8gKGs6IFUpID0+IHZvaWQgOiBuZXZlclxuKSBleHRlbmRzIChrOiBpbmZlciBJKSA9PiB2b2lkXG4gID8gSVxuICA6IG5ldmVyXG5cbmV4cG9ydCB0eXBlIE92ZXJ3cml0ZTxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gICAgW0sgaW4ga2V5b2YgT106IEsgZXh0ZW5kcyBrZXlvZiBPMSA/IE8xW0tdIDogT1tLXTtcbn0gJiB7fTtcblxudHlwZSBfTWVyZ2U8VSBleHRlbmRzIG9iamVjdD4gPSBJbnRlcnNlY3RPZjxPdmVyd3JpdGU8VSwge1xuICAgIFtLIGluIGtleW9mIFVdLT86IEF0PFUsIEs+O1xufT4+O1xuXG50eXBlIEtleSA9IHN0cmluZyB8IG51bWJlciB8IHN5bWJvbDtcbnR5cGUgQXRTdHJpY3Q8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBPW0sgJiBrZXlvZiBPXTtcbnR5cGUgQXRMb29zZTxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IE8gZXh0ZW5kcyB1bmtub3duID8gQXRTdHJpY3Q8TywgSz4gOiBuZXZlcjtcbmV4cG9ydCB0eXBlIEF0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXksIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxPiA9IHtcbiAgICAxOiBBdFN0cmljdDxPLCBLPjtcbiAgICAwOiBBdExvb3NlPE8sIEs+O1xufVtzdHJpY3RdO1xuXG5leHBvcnQgdHlwZSBDb21wdXRlUmF3PEEgZXh0ZW5kcyBhbnk+ID0gQSBleHRlbmRzIEZ1bmN0aW9uID8gQSA6IHtcbiAgW0sgaW4ga2V5b2YgQV06IEFbS107XG59ICYge307XG5cbmV4cG9ydCB0eXBlIE9wdGlvbmFsRmxhdDxPPiA9IHtcbiAgW0sgaW4ga2V5b2YgT10/OiBPW0tdO1xufSAmIHt9O1xuXG50eXBlIF9SZWNvcmQ8SyBleHRlbmRzIGtleW9mIGFueSwgVD4gPSB7XG4gIFtQIGluIEtdOiBUO1xufTtcblxuLy8gY2F1c2UgdHlwZXNjcmlwdCBub3QgdG8gZXhwYW5kIHR5cGVzIGFuZCBwcmVzZXJ2ZSBuYW1lc1xudHlwZSBOb0V4cGFuZDxUPiA9IFQgZXh0ZW5kcyB1bmtub3duID8gVCA6IG5ldmVyO1xuXG4vLyB0aGlzIHR5cGUgYXNzdW1lcyB0aGUgcGFzc2VkIG9iamVjdCBpcyBlbnRpcmVseSBvcHRpb25hbFxuZXhwb3J0IHR5cGUgQXRMZWFzdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgc3RyaW5nPiA9IE5vRXhwYW5kPFxuICBPIGV4dGVuZHMgdW5rbm93blxuICA/IHwgKEsgZXh0ZW5kcyBrZXlvZiBPID8geyBbUCBpbiBLXTogT1tQXSB9ICYgTyA6IE8pXG4gICAgfCB7W1AgaW4ga2V5b2YgTyBhcyBQIGV4dGVuZHMgSyA/IFAgOiBuZXZlcl0tPzogT1tQXX0gJiBPXG4gIDogbmV2ZXI+O1xuXG50eXBlIF9TdHJpY3Q8VSwgX1UgPSBVPiA9IFUgZXh0ZW5kcyB1bmtub3duID8gVSAmIE9wdGlvbmFsRmxhdDxfUmVjb3JkPEV4Y2x1ZGU8S2V5czxfVT4sIGtleW9mIFU+LCBuZXZlcj4+IDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIFN0cmljdDxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X1N0cmljdDxVPj47XG4vKiogRW5kIEhlbHBlciBUeXBlcyBmb3IgXCJNZXJnZVwiICoqL1xuXG5leHBvcnQgdHlwZSBNZXJnZTxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X01lcmdlPFN0cmljdDxVPj4+O1xuXG5leHBvcnQgdHlwZSBCb29sZWFuID0gVHJ1ZSB8IEZhbHNlXG5cbmV4cG9ydCB0eXBlIFRydWUgPSAxXG5cbmV4cG9ydCB0eXBlIEZhbHNlID0gMFxuXG5leHBvcnQgdHlwZSBOb3Q8QiBleHRlbmRzIEJvb2xlYW4+ID0ge1xuICAwOiAxXG4gIDE6IDBcbn1bQl1cblxuZXhwb3J0IHR5cGUgRXh0ZW5kczxBMSBleHRlbmRzIGFueSwgQTIgZXh0ZW5kcyBhbnk+ID0gW0ExXSBleHRlbmRzIFtuZXZlcl1cbiAgPyAwIC8vIGFueXRoaW5nIGBuZXZlcmAgaXMgZmFsc2VcbiAgOiBBMSBleHRlbmRzIEEyXG4gID8gMVxuICA6IDBcblxuZXhwb3J0IHR5cGUgSGFzPFUgZXh0ZW5kcyBVbmlvbiwgVTEgZXh0ZW5kcyBVbmlvbj4gPSBOb3Q8XG4gIEV4dGVuZHM8RXhjbHVkZTxVMSwgVT4sIFUxPlxuPlxuXG5leHBvcnQgdHlwZSBPcjxCMSBleHRlbmRzIEJvb2xlYW4sIEIyIGV4dGVuZHMgQm9vbGVhbj4gPSB7XG4gIDA6IHtcbiAgICAwOiAwXG4gICAgMTogMVxuICB9XG4gIDE6IHtcbiAgICAwOiAxXG4gICAgMTogMVxuICB9XG59W0IxXVtCMl1cblxuZXhwb3J0IHR5cGUgS2V5czxVIGV4dGVuZHMgVW5pb24+ID0gVSBleHRlbmRzIHVua25vd24gPyBrZXlvZiBVIDogbmV2ZXJcblxuZXhwb3J0IHR5cGUgR2V0U2NhbGFyVHlwZTxULCBPPiA9IE8gZXh0ZW5kcyBvYmplY3QgPyB7XG4gIFtQIGluIGtleW9mIFRdOiBQIGV4dGVuZHMga2V5b2YgT1xuICAgID8gT1tQXVxuICAgIDogbmV2ZXJcbn0gOiBuZXZlclxuXG50eXBlIEZpZWxkUGF0aHM8XG4gIFQsXG4gIFUgPSBPbWl0PFQsICdfYXZnJyB8ICdfc3VtJyB8ICdfY291bnQnIHwgJ19taW4nIHwgJ19tYXgnPlxuPiA9IElzT2JqZWN0PFQ+IGV4dGVuZHMgVHJ1ZSA/IFUgOiBUXG5cbmV4cG9ydCB0eXBlIEdldEhhdmluZ0ZpZWxkczxUPiA9IHtcbiAgW0sgaW4ga2V5b2YgVF06IE9yPFxuICAgIE9yPEV4dGVuZHM8J09SJywgSz4sIEV4dGVuZHM8J0FORCcsIEs+PixcbiAgICBFeHRlbmRzPCdOT1QnLCBLPlxuICA+IGV4dGVuZHMgVHJ1ZVxuICAgID8gLy8gaW5mZXIgaXMgb25seSBuZWVkZWQgdG8gbm90IGhpdCBUUyBsaW1pdFxuICAgICAgLy8gYmFzZWQgb24gdGhlIGJyaWxsaWFudCBpZGVhIG9mIFBpZXJyZS1BbnRvaW5lIE1pbGxzXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzMwMTg4I2lzc3VlY29tbWVudC00Nzg5Mzg0MzdcbiAgICAgIFRbS10gZXh0ZW5kcyBpbmZlciBUS1xuICAgICAgPyBHZXRIYXZpbmdGaWVsZHM8VW5FbnVtZXJhdGU8VEs+IGV4dGVuZHMgb2JqZWN0ID8gTWVyZ2U8VW5FbnVtZXJhdGU8VEs+PiA6IG5ldmVyPlxuICAgICAgOiBuZXZlclxuICAgIDoge30gZXh0ZW5kcyBGaWVsZFBhdGhzPFRbS10+XG4gICAgPyBuZXZlclxuICAgIDogS1xufVtrZXlvZiBUXVxuXG4vKipcbiAqIENvbnZlcnQgdHVwbGUgdG8gdW5pb25cbiAqL1xudHlwZSBfVHVwbGVUb1VuaW9uPFQ+ID0gVCBleHRlbmRzIChpbmZlciBFKVtdID8gRSA6IG5ldmVyXG50eXBlIFR1cGxlVG9VbmlvbjxLIGV4dGVuZHMgcmVhZG9ubHkgYW55W10+ID0gX1R1cGxlVG9VbmlvbjxLPlxuZXhwb3J0IHR5cGUgTWF5YmVUdXBsZVRvVW5pb248VD4gPSBUIGV4dGVuZHMgYW55W10gPyBUdXBsZVRvVW5pb248VD4gOiBUXG5cbi8qKlxuICogTGlrZSBgUGlja2AsIGJ1dCBhZGRpdGlvbmFsbHkgY2FuIGFsc28gYWNjZXB0IGFuIGFycmF5IG9mIGtleXNcbiAqL1xuZXhwb3J0IHR5cGUgUGlja0VudW1lcmFibGU8VCwgSyBleHRlbmRzIEVudW1lcmFibGU8a2V5b2YgVD4gfCBrZXlvZiBUPiA9IFByaXNtYV9fUGljazxULCBNYXliZVR1cGxlVG9VbmlvbjxLPj5cblxuLyoqXG4gKiBFeGNsdWRlIGFsbCBrZXlzIHdpdGggdW5kZXJzY29yZXNcbiAqL1xuZXhwb3J0IHR5cGUgRXhjbHVkZVVuZGVyc2NvcmVLZXlzPFQgZXh0ZW5kcyBzdHJpbmc+ID0gVCBleHRlbmRzIGBfJHtzdHJpbmd9YCA/IG5ldmVyIDogVFxuXG5cbmV4cG9ydCB0eXBlIEZpZWxkUmVmPE1vZGVsLCBGaWVsZFR5cGU+ID0gcnVudGltZS5GaWVsZFJlZjxNb2RlbCwgRmllbGRUeXBlPlxuXG50eXBlIEZpZWxkUmVmSW5wdXRUeXBlPE1vZGVsLCBGaWVsZFR5cGU+ID0gTW9kZWwgZXh0ZW5kcyBuZXZlciA/IG5ldmVyIDogRmllbGRSZWY8TW9kZWwsIEZpZWxkVHlwZT5cblxuXG5leHBvcnQgY29uc3QgTW9kZWxOYW1lID0ge1xuICBCbG9nUG9zdDogJ0Jsb2dQb3N0JyxcbiAgQm9va2luZzogJ0Jvb2tpbmcnLFxuICBDYXRlZ29yeTogJ0NhdGVnb3J5JyxcbiAgQ29udGFjdE1lc3NhZ2U6ICdDb250YWN0TWVzc2FnZScsXG4gIFBheW1lbnQ6ICdQYXltZW50JyxcbiAgUmV2aWV3OiAnUmV2aWV3JyxcbiAgVG91clBhY2thZ2U6ICdUb3VyUGFja2FnZScsXG4gIFVzZXI6ICdVc2VyJyxcbiAgV2lzaGxpc3RJdGVtOiAnV2lzaGxpc3RJdGVtJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBNb2RlbE5hbWUgPSAodHlwZW9mIE1vZGVsTmFtZSlba2V5b2YgdHlwZW9mIE1vZGVsTmFtZV1cblxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgVHlwZU1hcENiPEdsb2JhbE9taXRPcHRpb25zID0ge30+IGV4dGVuZHMgcnVudGltZS5UeXBlcy5VdGlscy5Gbjx7ZXh0QXJnczogcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyB9LCBydW50aW1lLlR5cGVzLlV0aWxzLlJlY29yZDxzdHJpbmcsIGFueT4+IHtcbiAgcmV0dXJuczogVHlwZU1hcDx0aGlzWydwYXJhbXMnXVsnZXh0QXJncyddLCBHbG9iYWxPbWl0T3B0aW9ucz5cbn1cblxuZXhwb3J0IHR5cGUgVHlwZU1hcDxFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncywgR2xvYmFsT21pdE9wdGlvbnMgPSB7fT4gPSB7XG4gIGdsb2JhbE9taXRPcHRpb25zOiB7XG4gICAgb21pdDogR2xvYmFsT21pdE9wdGlvbnNcbiAgfVxuICBtZXRhOiB7XG4gICAgbW9kZWxQcm9wczogXCJibG9nUG9zdFwiIHwgXCJib29raW5nXCIgfCBcImNhdGVnb3J5XCIgfCBcImNvbnRhY3RNZXNzYWdlXCIgfCBcInBheW1lbnRcIiB8IFwicmV2aWV3XCIgfCBcInRvdXJQYWNrYWdlXCIgfCBcInVzZXJcIiB8IFwid2lzaGxpc3RJdGVtXCJcbiAgICB0eElzb2xhdGlvbkxldmVsOiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsXG4gIH1cbiAgbW9kZWw6IHtcbiAgICBCbG9nUG9zdDoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRCbG9nUG9zdFBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkJsb2dQb3N0RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3REZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUJsb2dQb3N0PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQmxvZ1Bvc3RHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5CbG9nUG9zdENvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBCb29raW5nOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Cb29raW5nRmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0ZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0RlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0RlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1Vwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVCb29raW5nPlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0dyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Cb29raW5nR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nQ291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Cb29raW5nQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIENhdGVnb3J5OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJENhdGVnb3J5UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQ2F0ZWdvcnlGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQ2F0ZWdvcnk+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5DYXRlZ29yeUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNhdGVnb3J5Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIENvbnRhY3RNZXNzYWdlOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQ29udGFjdE1lc3NhZ2U+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Db250YWN0TWVzc2FnZUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNvbnRhY3RNZXNzYWdlQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFBheW1lbnQ6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kUGF5bWVudFBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlBheW1lbnRGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVBheW1lbnQ+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlBheW1lbnRHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlBheW1lbnRDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgUmV2aWV3OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFJldmlld1BheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlJldmlld0ZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0RlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0FnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVJldmlldz5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0dyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5SZXZpZXdHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUmV2aWV3Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFRvdXJQYWNrYWdlOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuVG91clBhY2thZ2VGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlVG91clBhY2thZ2U+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5Ub3VyUGFja2FnZUdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlRvdXJQYWNrYWdlQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFVzZXI6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kVXNlclBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLlVzZXJGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVVzZXI+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlVzZXJHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlVzZXJDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgV2lzaGxpc3RJdGVtOiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLldpc2hsaXN0SXRlbUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1GaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1DcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1DcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1DcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbURlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRXaXNobGlzdEl0ZW1QYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuV2lzaGxpc3RJdGVtVXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kV2lzaGxpc3RJdGVtUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5XaXNobGlzdEl0ZW1VcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFdpc2hsaXN0SXRlbVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUFnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZVdpc2hsaXN0SXRlbT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5XaXNobGlzdEl0ZW1Hcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLldpc2hsaXN0SXRlbUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuV2lzaGxpc3RJdGVtQ291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59ICYge1xuICBvdGhlcjoge1xuICAgIHBheWxvYWQ6IGFueVxuICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICRleGVjdXRlUmF3OiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBTcWwsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJGV4ZWN1dGVSYXdVbnNhZmU6IHtcbiAgICAgICAgYXJnczogW3F1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJHF1ZXJ5UmF3OiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBTcWwsIC4uLnZhbHVlczogYW55W11dLFxuICAgICAgICByZXN1bHQ6IGFueVxuICAgICAgfVxuICAgICAgJHF1ZXJ5UmF3VW5zYWZlOiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBFbnVtc1xuICovXG5cbmV4cG9ydCBjb25zdCBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsID0gcnVudGltZS5tYWtlU3RyaWN0RW51bSh7XG4gIFJlYWRVbmNvbW1pdHRlZDogJ1JlYWRVbmNvbW1pdHRlZCcsXG4gIFJlYWRDb21taXR0ZWQ6ICdSZWFkQ29tbWl0dGVkJyxcbiAgUmVwZWF0YWJsZVJlYWQ6ICdSZXBlYXRhYmxlUmVhZCcsXG4gIFNlcmlhbGl6YWJsZTogJ1NlcmlhbGl6YWJsZSdcbn0gYXMgY29uc3QpXG5cbmV4cG9ydCB0eXBlIFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwgPSAodHlwZW9mIFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWwpW2tleW9mIHR5cGVvZiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsXVxuXG5cbmV4cG9ydCBjb25zdCBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRpdGxlOiAndGl0bGUnLFxuICBzbHVnOiAnc2x1ZycsXG4gIGV4Y2VycHQ6ICdleGNlcnB0JyxcbiAgY29udGVudDogJ2NvbnRlbnQnLFxuICBjb3ZlckltYWdlOiAnY292ZXJJbWFnZScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGlzRGVsZXRlZDogJ2lzRGVsZXRlZCcsXG4gIGF1dGhvcklkOiAnYXV0aG9ySWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJsb2dQb3N0U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIEJsb2dQb3N0U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBCb29raW5nU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgdHJhdmVsRGF0ZTogJ3RyYXZlbERhdGUnLFxuICB0cmF2ZWxlcnM6ICd0cmF2ZWxlcnMnLFxuICB0b3RhbFByaWNlOiAndG90YWxQcmljZScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIHVzZXJJZDogJ3VzZXJJZCcsXG4gIHBhY2thZ2VJZDogJ3BhY2thZ2VJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQm9va2luZ1NjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQm9va2luZ1NjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIEJvb2tpbmdTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IENhdGVnb3J5U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgbmFtZTogJ25hbWUnLFxuICBzbHVnOiAnc2x1ZycsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQ2F0ZWdvcnlTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQ2F0ZWdvcnlTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgbmFtZTogJ25hbWUnLFxuICBlbWFpbDogJ2VtYWlsJyxcbiAgc3ViamVjdDogJ3N1YmplY3QnLFxuICBtZXNzYWdlOiAnbWVzc2FnZScsXG4gIGlzUmVzb2x2ZWQ6ICdpc1Jlc29sdmVkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgUGF5bWVudFNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIGJvb2tpbmdJZDogJ2Jvb2tpbmdJZCcsXG4gIHRyYW5JZDogJ3RyYW5JZCcsXG4gIHZhbElkOiAndmFsSWQnLFxuICBhbW91bnQ6ICdhbW91bnQnLFxuICBjdXJyZW5jeTogJ2N1cnJlbmN5JyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgZ2F0ZXdheVBhZ2VVcmw6ICdnYXRld2F5UGFnZVVybCcsXG4gIHNzbFNlc3Npb25LZXk6ICdzc2xTZXNzaW9uS2V5JyxcbiAgY2FyZFR5cGU6ICdjYXJkVHlwZScsXG4gIGJhbmtUcmFuSWQ6ICdiYW5rVHJhbklkJyxcbiAgcGFpZEF0OiAncGFpZEF0JyxcbiAgcmVmdW5kUmVmSWQ6ICdyZWZ1bmRSZWZJZCcsXG4gIHJlZnVuZGVkQXQ6ICdyZWZ1bmRlZEF0JyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQYXltZW50U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBQYXltZW50U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgUGF5bWVudFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgUmV2aWV3U2NhbGFyRmllbGRFbnVtID0ge1xuICBpZDogJ2lkJyxcbiAgcmF0aW5nOiAncmF0aW5nJyxcbiAgY29tbWVudDogJ2NvbW1lbnQnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYWNrYWdlSWQ6ICdwYWNrYWdlSWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFJldmlld1NjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgUmV2aWV3U2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgUmV2aWV3U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRpdGxlOiAndGl0bGUnLFxuICBzbHVnOiAnc2x1ZycsXG4gIGRlc2NyaXB0aW9uOiAnZGVzY3JpcHRpb24nLFxuICBsb2NhdGlvbjogJ2xvY2F0aW9uJyxcbiAgcHJpY2U6ICdwcmljZScsXG4gIGR1cmF0aW9uOiAnZHVyYXRpb24nLFxuICByYXRpbmc6ICdyYXRpbmcnLFxuICBpbWFnZXM6ICdpbWFnZXMnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICBjYXRlZ29yeUlkOiAnY2F0ZWdvcnlJZCcsXG4gIGFnZW50SWQ6ICdhZ2VudElkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBUb3VyUGFja2FnZVNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgVXNlclNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgZW1haWw6ICdlbWFpbCcsXG4gIHBhc3N3b3JkOiAncGFzc3dvcmQnLFxuICBnb29nbGVJZDogJ2dvb2dsZUlkJyxcbiAgcGhvbmU6ICdwaG9uZScsXG4gIGF2YXRhclVybDogJ2F2YXRhclVybCcsXG4gIHJvbGU6ICdyb2xlJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgYXV0aFByb3ZpZGVyOiAnYXV0aFByb3ZpZGVyJyxcbiAgZW1haWxWZXJpZmllZDogJ2VtYWlsVmVyaWZpZWQnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICB0b2tlblZlcnNpb246ICd0b2tlblZlcnNpb24nLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFVzZXJTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFVzZXJTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBVc2VyU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBXaXNobGlzdEl0ZW1TY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYWNrYWdlSWQ6ICdwYWNrYWdlSWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFdpc2hsaXN0SXRlbVNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgV2lzaGxpc3RJdGVtU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgV2lzaGxpc3RJdGVtU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBTb3J0T3JkZXIgPSB7XG4gIGFzYzogJ2FzYycsXG4gIGRlc2M6ICdkZXNjJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBTb3J0T3JkZXIgPSAodHlwZW9mIFNvcnRPcmRlcilba2V5b2YgdHlwZW9mIFNvcnRPcmRlcl1cblxuXG5leHBvcnQgY29uc3QgUXVlcnlNb2RlID0ge1xuICBkZWZhdWx0OiAnZGVmYXVsdCcsXG4gIGluc2Vuc2l0aXZlOiAnaW5zZW5zaXRpdmUnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5TW9kZSA9ICh0eXBlb2YgUXVlcnlNb2RlKVtrZXlvZiB0eXBlb2YgUXVlcnlNb2RlXVxuXG5cbmV4cG9ydCBjb25zdCBOdWxsc09yZGVyID0ge1xuICBmaXJzdDogJ2ZpcnN0JyxcbiAgbGFzdDogJ2xhc3QnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE51bGxzT3JkZXIgPSAodHlwZW9mIE51bGxzT3JkZXIpW2tleW9mIHR5cGVvZiBOdWxsc09yZGVyXVxuXG5cblxuLyoqXG4gKiBGaWVsZCByZWZlcmVuY2VzXG4gKi9cblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1N0cmluZydcbiAqL1xuZXhwb3J0IHR5cGUgU3RyaW5nRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnU3RyaW5nJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1N0cmluZ1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0U3RyaW5nRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnU3RyaW5nW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUG9zdFN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBvc3RTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQb3N0U3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1Bvc3RTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Qb3N0U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUG9zdFN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Jvb2xlYW4nXG4gKi9cbmV4cG9ydCB0eXBlIEJvb2xlYW5GaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29sZWFuJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RhdGVUaW1lJ1xuICovXG5leHBvcnQgdHlwZSBEYXRlVGltZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RhdGVUaW1lJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0RhdGVUaW1lW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3REYXRlVGltZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RhdGVUaW1lW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnSW50J1xuICovXG5leHBvcnQgdHlwZSBJbnRGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdJbnQnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnSW50W10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RJbnRGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdJbnRbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEZWNpbWFsJ1xuICovXG5leHBvcnQgdHlwZSBEZWNpbWFsRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRGVjaW1hbCc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEZWNpbWFsW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3REZWNpbWFsRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRGVjaW1hbFtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Jvb2tpbmdTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Cb29raW5nU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQm9va2luZ1N0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29raW5nU3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtQm9va2luZ1N0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Jvb2tpbmdTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYXltZW50U3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUGF5bWVudFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BheW1lbnRTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGF5bWVudFN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBheW1lbnRTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYXltZW50U3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRmxvYXQnXG4gKi9cbmV4cG9ydCB0eXBlIEZsb2F0RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRmxvYXQnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRmxvYXRbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEZsb2F0RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnRmxvYXRbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQYWNrYWdlU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtUGFja2FnZVN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1BhY2thZ2VTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGFja2FnZVN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVBhY2thZ2VTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYWNrYWdlU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUm9sZSdcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVJvbGVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdSb2xlJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1JvbGVbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1Sb2xlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUm9sZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1VzZXJTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Vc2VyU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnVXNlclN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdVc2VyU3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtVXNlclN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1VzZXJTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdBdXRoUHJvdmlkZXInXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1BdXRoUHJvdmlkZXJGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdBdXRoUHJvdmlkZXInPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQXV0aFByb3ZpZGVyW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtQXV0aFByb3ZpZGVyRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQXV0aFByb3ZpZGVyW10nPlxuICAgIFxuXG4vKipcbiAqIEJhdGNoIFBheWxvYWQgZm9yIHVwZGF0ZU1hbnkgJiBkZWxldGVNYW55ICYgY3JlYXRlTWFueVxuICovXG5leHBvcnQgdHlwZSBCYXRjaFBheWxvYWQgPSB7XG4gIGNvdW50OiBudW1iZXJcbn1cblxuZXhwb3J0IGNvbnN0IGRlZmluZUV4dGVuc2lvbiA9IHJ1bnRpbWUuRXh0ZW5zaW9ucy5kZWZpbmVFeHRlbnNpb24gYXMgdW5rbm93biBhcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRXh0ZW5kc0hvb2s8XCJkZWZpbmVcIiwgVHlwZU1hcENiLCBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3M+XG5leHBvcnQgdHlwZSBEZWZhdWx0UHJpc21hQ2xpZW50ID0gUHJpc21hQ2xpZW50XG5leHBvcnQgdHlwZSBFcnJvckZvcm1hdCA9ICdwcmV0dHknIHwgJ2NvbG9ybGVzcycgfCAnbWluaW1hbCdcbi8qKlxuICogT3B0aW9ucyBjb21tb24gdG8gYWxsIHZhcmlhbnRzIG9mIGBQcmlzbWFDbGllbnRPcHRpb25zYCwgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHlvdSBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBhIGRyaXZlciBhZGFwdGVyIG9yIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogQGRlZmF1bHQgXCJjb2xvcmxlc3NcIlxuICAgKi9cbiAgZXJyb3JGb3JtYXQ/OiBFcnJvckZvcm1hdFxuICAvKipcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIC8vIFNob3J0aGFuZCBmb3IgYGVtaXQ6ICdzdGRvdXQnYFxuICAgKiBsb2c6IFsncXVlcnknLCAnaW5mbycsICd3YXJuJywgJ2Vycm9yJ11cbiAgICogXG4gICAqIC8vIEVtaXQgYXMgZXZlbnRzIG9ubHlcbiAgICogbG9nOiBbXG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ3F1ZXJ5JyB9LFxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdpbmZvJyB9LFxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICd3YXJuJyB9XG4gICAqICAgeyBlbWl0OiAnZXZlbnQnLCBsZXZlbDogJ2Vycm9yJyB9XG4gICAqIF1cbiAgICogXG4gICAqIC8gRW1pdCBhcyBldmVudHMgYW5kIGxvZyB0byBzdGRvdXRcbiAgICogb2c6IFtcbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAncXVlcnknIH0sXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ2luZm8nIH0sXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ3dhcm4nIH1cbiAgICogIHsgZW1pdDogJ3N0ZG91dCcsIGxldmVsOiAnZXJyb3InIH1cbiAgICogXG4gICAqIGBgYFxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9sb2dnaW5nKS5cbiAgICovXG4gIGxvZz86IChMb2dMZXZlbCB8IExvZ0RlZmluaXRpb24pW11cbiAgLyoqXG4gICAqIFRoZSBkZWZhdWx0IHZhbHVlcyBmb3IgdHJhbnNhY3Rpb25PcHRpb25zXG4gICAqIG1heFdhaXQgPz0gMjAwMFxuICAgKiB0aW1lb3V0ID89IDUwMDBcbiAgICovXG4gIHRyYW5zYWN0aW9uT3B0aW9ucz86IHtcbiAgICBtYXhXYWl0PzogbnVtYmVyXG4gICAgdGltZW91dD86IG51bWJlclxuICAgIGlzb2xhdGlvbkxldmVsPzogVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbFxuICB9XG4gIC8qKlxuICAgKiBHbG9iYWwgY29uZmlndXJhdGlvbiBmb3Igb21pdHRpbmcgbW9kZWwgZmllbGRzIGJ5IGRlZmF1bHQuXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgb21pdDoge1xuICAgKiAgICAgdXNlcjoge1xuICAgKiAgICAgICBwYXNzd29yZDogdHJ1ZVxuICAgKiAgICAgfVxuICAgKiAgIH1cbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBvbWl0PzogR2xvYmFsT21pdENvbmZpZ1xuICAvKipcbiAgICogU1FMIGNvbW1lbnRlciBwbHVnaW5zIHRoYXQgYWRkIG1ldGFkYXRhIHRvIFNRTCBxdWVyaWVzIGFzIGNvbW1lbnRzLlxuICAgKiBDb21tZW50cyBmb2xsb3cgdGhlIHNxbGNvbW1lbnRlciBmb3JtYXQ6IGh0dHBzOi8vZ29vZ2xlLmdpdGh1Yi5pby9zcWxjb21tZW50ZXIvXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcixcbiAgICogICBjb21tZW50czogW1xuICAgKiAgICAgdHJhY2VDb250ZXh0KCksXG4gICAqICAgICBxdWVyeUluc2lnaHRzKCksXG4gICAqICAgXSxcbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBjb21tZW50cz86IHJ1bnRpbWUuU3FsQ29tbWVudGVyUGx1Z2luW11cbiAgLyoqXG4gICAqIE9wdGlvbmFsIG1heGltdW0gc2l6ZSBmb3IgdGhlIHF1ZXJ5IHBsYW4gY2FjaGUuIElmIG5vdCBwcm92aWRlZCwgYSBkZWZhdWx0IHNpemUgd2lsbCBiZSB1c2VkLlxuICAgKiBBIHZhbHVlIG9mIGAwYCBjYW4gYmUgdXNlZCB0byBkaXNhYmxlIHRoZSBjYWNoZSBlbnRpcmVseS4gQSBoaWdoZXIgY2FjaGUgc2l6ZSBjYW4gaW1wcm92ZVxuICAgKiBwZXJmb3JtYW5jZSBmb3IgYXBwbGljYXRpb25zIHRoYXQgZXhlY3V0ZSBhIGxhcmdlIG51bWJlciBvZiB1bmlxdWUgcXVlcmllcywgd2hpbGUgYSBzbWFsbGVyXG4gICAqIGNhY2hlIHNpemUgY2FuIHJlZHVjZSBtZW1vcnkgdXNhZ2UuXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gICAqICAgYWRhcHRlcixcbiAgICogICBxdWVyeVBsYW5DYWNoZU1heFNpemU6IDEwMCxcbiAgICogfSlcbiAgICogYGBgXG4gICAqL1xuICBxdWVyeVBsYW5DYWNoZU1heFNpemU/OiBudW1iZXJcbn1cblxuLyoqXG4gKiBgUHJpc21hQ2xpZW50YCBvcHRpb25zIGZvciBjb25uZWN0aW5nIHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSBpbnN0ZWFkIG9mIGEgZHJpdmVyIGFkYXB0ZXIuXG4gKiBcbiAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2FjY2VsZXJhdGVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmwgZXh0ZW5kcyBQcmlzbWFDbGllbnRCYXNlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgUHJpc21hIEFjY2VsZXJhdGUgY29ubmVjdGlvbiBVUkwuIFVzZSB0aGlzIG9wdGlvbiB0byBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSBpbnN0ZWFkIG9mIHVzaW5nIGEgZHJpdmVyIGFkYXB0ZXIgdG8gY29ubmVjdCBkaXJlY3RseS5cbiAgICogXG4gICAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2FjY2VsZXJhdGVcbiAgICovXG4gIGFjY2VsZXJhdGVVcmw6IHN0cmluZ1xuICBhZGFwdGVyPzogbmV2ZXJcbn1cblxuLyoqXG4gKiBgUHJpc21hQ2xpZW50YCBvcHRpb25zIGZvciBjb25uZWN0aW5nIHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBhIGRyaXZlciBhZGFwdGVyLiBUaGlzIGlzIHRoZSBjb21tb24gY2FzZSBpbiBQcmlzbWEgNy5cbiAqIFxuICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyIGV4dGVuZHMgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogQSBkcml2ZXIgYWRhcHRlciB0aGF0IFByaXNtYUNsaWVudCB1c2VzIHRvIGNvbm5lY3QgdG8geW91ciBkYXRhYmFzZSwgc3VjaCBhcyB0aGUgb25lcyBwcm92aWRlZCBieSBgQHByaXNtYS9hZGFwdGVyLXBnYCwgYEBwcmlzbWEvYWRhcHRlci1saWJzcWxgLCBgQHByaXNtYS9hZGFwdGVyLXBsYW5ldHNjYWxlYCwgZXRjLlxuICAgKiBcbiAgICogQSBkcml2ZXIgYWRhcHRlciBpcyAqKnJlcXVpcmVkKiogdW5sZXNzIHlvdSBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UgdGhyb3VnaCBQcmlzbWEgQWNjZWxlcmF0ZSAoaW4gd2hpY2ggY2FzZSB1c2UgYGFjY2VsZXJhdGVVcmxgIGluc3RlYWQpLlxuICAgKiBcbiAgICogTGVhcm4gbW9yZTogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gICAqIFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBQcmlzbWFQZyB9IGZyb20gJ0BwcmlzbWEvYWRhcHRlci1wZydcbiAgICogaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSAnLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudCdcbiAgICogXG4gICAqIGNvbnN0IGFkYXB0ZXIgPSBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAgICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7IGFkYXB0ZXIgfSlcbiAgICogYGBgXG4gICAqL1xuICBhZGFwdGVyOiBydW50aW1lLlNxbERyaXZlckFkYXB0ZXJGYWN0b3J5XG4gIGFjY2VsZXJhdGVVcmw/OiBuZXZlclxufVxuXG4vKipcbiAqIE9wdGlvbnMgcGFzc2VkIHRvIHRoZSBgUHJpc21hQ2xpZW50YCBjb25zdHJ1Y3Rvci5cbiAqIFxuICogQSBkcml2ZXIgYWRhcHRlciAob3IsIGFsdGVybmF0aXZlbHksIGEgUHJpc21hIEFjY2VsZXJhdGUgVVJMKSBpcyAqKnJlcXVpcmVkKiouIFNlZSB7QGxpbmsgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyfSBhbmQge0BsaW5rIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWNjZWxlcmF0ZVVybH0gZm9yIHRoZSB0d28gdmFyaWFudHMuIEFsbCBvdGhlciBwcm9wZXJ0aWVzIGxpdmUgaW4ge0BsaW5rIFByaXNtYUNsaWVudEJhc2VPcHRpb25zfSBhbmQgYXJlIG9wdGlvbmFsLlxuICogXG4gKiBMZWFybiBtb3JlIGFib3V0IGRyaXZlciBhZGFwdGVyczogaHR0cHM6Ly9wcmlzLmx5L2QvZHJpdmVyLWFkYXB0ZXJzXG4gKi9cbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudE9wdGlvbnMgPSBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmwgfCBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFkYXB0ZXJcbmV4cG9ydCB0eXBlIEdsb2JhbE9taXRDb25maWcgPSB7XG4gIGJsb2dQb3N0PzogUHJpc21hLkJsb2dQb3N0T21pdFxuICBib29raW5nPzogUHJpc21hLkJvb2tpbmdPbWl0XG4gIGNhdGVnb3J5PzogUHJpc21hLkNhdGVnb3J5T21pdFxuICBjb250YWN0TWVzc2FnZT86IFByaXNtYS5Db250YWN0TWVzc2FnZU9taXRcbiAgcGF5bWVudD86IFByaXNtYS5QYXltZW50T21pdFxuICByZXZpZXc/OiBQcmlzbWEuUmV2aWV3T21pdFxuICB0b3VyUGFja2FnZT86IFByaXNtYS5Ub3VyUGFja2FnZU9taXRcbiAgdXNlcj86IFByaXNtYS5Vc2VyT21pdFxuICB3aXNobGlzdEl0ZW0/OiBQcmlzbWEuV2lzaGxpc3RJdGVtT21pdFxufVxuXG4vKiBUeXBlcyBmb3IgTG9nZ2luZyAqL1xuZXhwb3J0IHR5cGUgTG9nTGV2ZWwgPSAnaW5mbycgfCAncXVlcnknIHwgJ3dhcm4nIHwgJ2Vycm9yJ1xuZXhwb3J0IHR5cGUgTG9nRGVmaW5pdGlvbiA9IHtcbiAgbGV2ZWw6IExvZ0xldmVsXG4gIGVtaXQ6ICdzdGRvdXQnIHwgJ2V2ZW50J1xufVxuXG5leHBvcnQgdHlwZSBDaGVja0lzTG9nTGV2ZWw8VD4gPSBUIGV4dGVuZHMgTG9nTGV2ZWwgPyBUIDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIEdldExvZ1R5cGU8VD4gPSBDaGVja0lzTG9nTGV2ZWw8XG4gIFQgZXh0ZW5kcyBMb2dEZWZpbml0aW9uID8gVFsnbGV2ZWwnXSA6IFRcbj47XG5cbmV4cG9ydCB0eXBlIEdldEV2ZW50czxUIGV4dGVuZHMgYW55W10+ID0gVCBleHRlbmRzIEFycmF5PExvZ0xldmVsIHwgTG9nRGVmaW5pdGlvbj5cbiAgPyBHZXRMb2dUeXBlPFRbbnVtYmVyXT5cbiAgOiBuZXZlcjtcblxuZXhwb3J0IHR5cGUgUXVlcnlFdmVudCA9IHtcbiAgdGltZXN0YW1wOiBEYXRlXG4gIHF1ZXJ5OiBzdHJpbmdcbiAgcGFyYW1zOiBzdHJpbmdcbiAgZHVyYXRpb246IG51bWJlclxuICB0YXJnZXQ6IHN0cmluZ1xufVxuXG5leHBvcnQgdHlwZSBMb2dFdmVudCA9IHtcbiAgdGltZXN0YW1wOiBEYXRlXG4gIG1lc3NhZ2U6IHN0cmluZ1xuICB0YXJnZXQ6IHN0cmluZ1xufVxuLyogRW5kIFR5cGVzIGZvciBMb2dnaW5nICovXG5cblxuZXhwb3J0IHR5cGUgUHJpc21hQWN0aW9uID1cbiAgfCAnZmluZFVuaXF1ZSdcbiAgfCAnZmluZFVuaXF1ZU9yVGhyb3cnXG4gIHwgJ2ZpbmRNYW55J1xuICB8ICdmaW5kRmlyc3QnXG4gIHwgJ2ZpbmRGaXJzdE9yVGhyb3cnXG4gIHwgJ2NyZWF0ZSdcbiAgfCAnY3JlYXRlTWFueSdcbiAgfCAnY3JlYXRlTWFueUFuZFJldHVybidcbiAgfCAndXBkYXRlJ1xuICB8ICd1cGRhdGVNYW55J1xuICB8ICd1cGRhdGVNYW55QW5kUmV0dXJuJ1xuICB8ICd1cHNlcnQnXG4gIHwgJ2RlbGV0ZSdcbiAgfCAnZGVsZXRlTWFueSdcbiAgfCAnZXhlY3V0ZVJhdydcbiAgfCAncXVlcnlSYXcnXG4gIHwgJ2FnZ3JlZ2F0ZSdcbiAgfCAnY291bnQnXG4gIHwgJ3J1bkNvbW1hbmRSYXcnXG4gIHwgJ2ZpbmRSYXcnXG4gIHwgJ2dyb3VwQnknXG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgcHJveHkgYXZhaWxhYmxlIGluIGludGVyYWN0aXZlIHRyYW5zYWN0aW9ucy5cbiAqL1xuZXhwb3J0IHR5cGUgVHJhbnNhY3Rpb25DbGllbnQgPSBPbWl0PERlZmF1bHRQcmlzbWFDbGllbnQsIHJ1bnRpbWUuSVRYQ2xpZW50RGVueUxpc3Q+XG5cbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiogVGhpcyBmaWxlIGV4cG9ydHMgYWxsIGVudW0gcmVsYXRlZCB0eXBlcyBmcm9tIHRoZSBzY2hlbWEuXG4qXG4qIFx1RDgzRFx1REZFMiBZb3UgY2FuIGltcG9ydCB0aGlzIGZpbGUgZGlyZWN0bHkuXG4qL1xuXG5leHBvcnQgY29uc3QgUm9sZSA9IHtcbiAgVVNFUjogJ1VTRVInLFxuICBBR0VOVDogJ0FHRU5UJyxcbiAgQURNSU46ICdBRE1JTidcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUm9sZSA9ICh0eXBlb2YgUm9sZSlba2V5b2YgdHlwZW9mIFJvbGVdXG5cblxuZXhwb3J0IGNvbnN0IFVzZXJTdGF0dXMgPSB7XG4gIEFDVElWRTogJ0FDVElWRScsXG4gIFNVU1BFTkRFRDogJ1NVU1BFTkRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVXNlclN0YXR1cyA9ICh0eXBlb2YgVXNlclN0YXR1cylba2V5b2YgdHlwZW9mIFVzZXJTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IEF1dGhQcm92aWRlciA9IHtcbiAgQ1JFREVOVElBTDogJ0NSRURFTlRJQUwnLFxuICBHT09HTEU6ICdHT09HTEUnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEF1dGhQcm92aWRlciA9ICh0eXBlb2YgQXV0aFByb3ZpZGVyKVtrZXlvZiB0eXBlb2YgQXV0aFByb3ZpZGVyXVxuXG5cbmV4cG9ydCBjb25zdCBQYWNrYWdlU3RhdHVzID0ge1xuICBQRU5ESU5HOiAnUEVORElORycsXG4gIEFQUFJPVkVEOiAnQVBQUk9WRUQnLFxuICBSRUpFQ1RFRDogJ1JFSkVDVEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQYWNrYWdlU3RhdHVzID0gKHR5cGVvZiBQYWNrYWdlU3RhdHVzKVtrZXlvZiB0eXBlb2YgUGFja2FnZVN0YXR1c11cblxuXG5leHBvcnQgY29uc3QgQm9va2luZ1N0YXR1cyA9IHtcbiAgUEVORElORzogJ1BFTkRJTkcnLFxuICBQQUlEOiAnUEFJRCcsXG4gIENPTkZJUk1FRDogJ0NPTkZJUk1FRCcsXG4gIENBTkNFTExFRDogJ0NBTkNFTExFRCcsXG4gIENPTVBMRVRFRDogJ0NPTVBMRVRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQm9va2luZ1N0YXR1cyA9ICh0eXBlb2YgQm9va2luZ1N0YXR1cylba2V5b2YgdHlwZW9mIEJvb2tpbmdTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IFBheW1lbnRTdGF0dXMgPSB7XG4gIElOSVRJQVRFRDogJ0lOSVRJQVRFRCcsXG4gIFNVQ0NFU1M6ICdTVUNDRVNTJyxcbiAgRkFJTEVEOiAnRkFJTEVEJyxcbiAgQ0FOQ0VMTEVEOiAnQ0FOQ0VMTEVEJyxcbiAgUkVGVU5ERUQ6ICdSRUZVTkRFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGF5bWVudFN0YXR1cyA9ICh0eXBlb2YgUGF5bWVudFN0YXR1cylba2V5b2YgdHlwZW9mIFBheW1lbnRTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IFBvc3RTdGF0dXMgPSB7XG4gIERSQUZUOiAnRFJBRlQnLFxuICBQVUJMSVNIRUQ6ICdQVUJMSVNIRUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBvc3RTdGF0dXMgPSAodHlwZW9mIFBvc3RTdGF0dXMpW2tleW9mIHR5cGVvZiBQb3N0U3RhdHVzXVxuIiwgIi8vIEFwcEVycm9yIGtlZXBzIHRoZSBleGFjdCBzYW1lIFwianVzdCB0aHJvdyBpdFwiIGVyZ29ub21pY3MgYnV0IGNhcnJpZXNcbi8vIGEgc3RhdHVzQ29kZSB0aGUgZ2xvYmFsIGhhbmRsZXIgY2FuIHJlYWQgKHNlZSBtaWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cykuXG5leHBvcnQgY2xhc3MgQXBwRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIHN0YXR1c0NvZGU6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihzdGF0dXNDb2RlOiBudW1iZXIsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9IFwiQXBwRXJyb3JcIjtcbiAgICB0aGlzLnN0YXR1c0NvZGUgPSBzdGF0dXNDb2RlO1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHRoaXMuY29uc3RydWN0b3IpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgUHJpc21hUGcgfSBmcm9tIFwiQHByaXNtYS9hZGFwdGVyLXBnXCI7XG5pbXBvcnQgeyBQcmlzbWFDbGllbnQgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuXG5jb25zdCBjb25uZWN0aW9uU3RyaW5nID0gY29uZmlnLmRhdGFiYXNlX3VybDtcblxuLy8gU2VydmVybGVzcy1mcmllbmRseSBwb29sOiBvbmUgY29ubmVjdGlvbiBwZXIgd2FybSBpbnN0YW5jZSBzbyBtYW55XG4vLyBjb25jdXJyZW50IGludm9jYXRpb25zIGNhbid0IGV4aGF1c3QgdGhlIGRhdGFiYXNlJ3MgY29ubmVjdGlvbiBsaW1pdC5cbi8vIExvY2FsL1ZNIHJ1bnMgYXJlIHVuYWZmZWN0ZWQgKGEgc2luZ2xlIHByb2Nlc3MgdXNlcyBvbmUgY29ubmVjdGlvbiBhbnl3YXkpLlxuY29uc3QgYWRhcHRlciA9IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmcsIG1heDogMSB9KTtcbmNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoeyBhZGFwdGVyIH0pO1xuXG5leHBvcnQgeyBwcmlzbWEgfTtcbiIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgYXV0aENvbnRyb2xsZXIgfSBmcm9tIFwiLi9hdXRoLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGF1dGhWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2F1dGgudmFsaWRhdGlvblwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIFJlZ2lzdGVyIFx1MjAxNCByb2xlIGlzIG9wdGlvbmFsIGFuZCByZXN0cmljdGVkIHRvIFVTRVIvQUdFTlQgaW4gdGhlIHNlcnZpY2VcbnJvdXRlci5wb3N0KFxuICBcIi9yZWdpc3RlclwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVnaXN0ZXJTY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlZ2lzdGVyVXNlcixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9sb2dpblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMubG9naW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmxvZ2luVXNlcixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9nb29nbGVcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmdvb2dsZUxvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5nb29nbGVMb2dpbixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9kZW1vLWxvZ2luXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5kZW1vTG9naW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLmRlbW9Mb2dpbixcbik7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9yZWZyZXNoXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5yZWZyZXNoVG9rZW5TY2hlbWEgfSksXG4gIGF1dGhDb250cm9sbGVyLnJlZnJlc2hUb2tlbixcbik7XG5cbnJvdXRlci5wb3N0KFwiL2xvZ291dFwiLCBhdXRoKCksIGF1dGhDb250cm9sbGVyLmxvZ291dFVzZXIpO1xuXG5yb3V0ZXIuZ2V0KFwiL21lXCIsIGF1dGgoKSwgYXV0aENvbnRyb2xsZXIuZ2V0TWUpO1xuXG5leHBvcnQgY29uc3QgYXV0aFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGF1dGhTZXJ2aWNlIH0gZnJvbSBcIi4vYXV0aC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuY29uc3QgaXNQcm9kdWN0aW9uID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiO1xuXG4vLyBEZXYgKGxvY2FsaG9zdDozMDAwIFx1MjE5MiA6NDAwMCkgaXMgc2FtZS1zaXRlIFx1MjE5MiBsYXggd29ya3Mgd2l0aCBzZWN1cmU6ZmFsc2UuXG4vLyBQcm9kIChjcm9zcy1zaXRlIGZyb250ZW5kL2JhY2tlbmQpIHJlcXVpcmVzIFNhbWVTaXRlPU5vbmUgKyBTZWN1cmUuXG5jb25zdCBjb29raWVPcHRpb25zOiB7XG4gIGh0dHBPbmx5OiB0cnVlO1xuICBzZWN1cmU6IGJvb2xlYW47XG4gIHNhbWVTaXRlOiBcImxheFwiIHwgXCJub25lXCI7XG59ID0ge1xuICBodHRwT25seTogdHJ1ZSxcbiAgc2VjdXJlOiBpc1Byb2R1Y3Rpb24sXG4gIHNhbWVTaXRlOiBpc1Byb2R1Y3Rpb24gPyBcIm5vbmVcIiA6IFwibGF4XCIsXG59O1xuXG5jb25zdCBBQ0NFU1NfQ09PS0lFX01BWF9BR0UgPSAyNCAqIDYwICogNjAgKiAxMDAwOyAvLyAxIGRheVxuY29uc3QgUkVGUkVTSF9DT09LSUVfTUFYX0FHRSA9IDMwICogMjQgKiA2MCAqIDYwICogMTAwMDsgLy8gMzAgZGF5c1xuXG5jb25zdCBzZXRBdXRoQ29va2llcyA9IChcbiAgcmVzOiBSZXNwb25zZSxcbiAgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH06IHsgYWNjZXNzVG9rZW46IHN0cmluZzsgcmVmcmVzaFRva2VuOiBzdHJpbmcgfSxcbikgPT4ge1xuICByZXMuY29va2llKFwiYWNjZXNzVG9rZW5cIiwgYWNjZXNzVG9rZW4sIHtcbiAgICAuLi5jb29raWVPcHRpb25zLFxuICAgIG1heEFnZTogQUNDRVNTX0NPT0tJRV9NQVhfQUdFLFxuICB9KTtcbiAgcmVzLmNvb2tpZShcInJlZnJlc2hUb2tlblwiLCByZWZyZXNoVG9rZW4sIHtcbiAgICAuLi5jb29raWVPcHRpb25zLFxuICAgIG1heEFnZTogUkVGUkVTSF9DT09LSUVfTUFYX0FHRSxcbiAgfSk7XG59O1xuXG5jb25zdCBjbGVhckF1dGhDb29raWVzID0gKHJlczogUmVzcG9uc2UpID0+IHtcbiAgcmVzLmNsZWFyQ29va2llKFwiYWNjZXNzVG9rZW5cIiwgY29va2llT3B0aW9ucyk7XG4gIHJlcy5jbGVhckNvb2tpZShcInJlZnJlc2hUb2tlblwiLCBjb29raWVPcHRpb25zKTtcbn07XG5cbi8vIFJlZ2lzdGVyIGNvbnRyb2xsZXJcbmNvbnN0IHJlZ2lzdGVyVXNlciA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhdXRoU2VydmljZS5yZWdpc3RlclVzZXIocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBSZWdpc3RlcmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBMb2dpbiBjb250cm9sbGVyXG5jb25zdCBsb2dpblVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmxvZ2luVXNlcihyZXEuYm9keSk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR29vZ2xlIGxvZ2luIChJRC10b2tlbiBmbG93KVxuY29uc3QgZ29vZ2xlTG9naW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmdvb2dsZUxvZ2luKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBEZW1vIGxvZ2luIGNvbnRyb2xsZXJcbmNvbnN0IGRlbW9Mb2dpbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9ID0gYXdhaXQgYXV0aFNlcnZpY2UuZGVtb0xvZ2luKFxuICAgICAgcmVxLmJvZHksXG4gICAgKTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0pO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRlbW8gdXNlciBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFJlZnJlc2ggdG9rZW4gY29udHJvbGxlclxuY29uc3QgcmVmcmVzaFRva2VuID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVmcmVzaFRva2VuRnJvbUNvb2tpZSA9IHJlcS5jb29raWVzLnJlZnJlc2hUb2tlbjtcbiAgICBjb25zdCByZWZyZXNoVG9rZW5Gcm9tQm9keSA9IHJlcS5ib2R5Py5yZWZyZXNoVG9rZW47XG5cbiAgICBpZiAoIXJlZnJlc2hUb2tlbkZyb21Db29raWUgJiYgIXJlZnJlc2hUb2tlbkZyb21Cb2R5KSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5VTkFVVEhPUklaRUQsXG4gICAgICAgIG1lc3NhZ2U6IFwiUmVmcmVzaCB0b2tlbiBpcyByZXF1aXJlZFwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4gfSA9XG4gICAgICBhd2FpdCBhdXRoU2VydmljZS5yZWZyZXNoVG9rZW4oe1xuICAgICAgICByZWZyZXNoVG9rZW46IHJlZnJlc2hUb2tlbkZyb21Db29raWUgfHwgcmVmcmVzaFRva2VuRnJvbUJvZHksXG4gICAgICB9KTtcblxuICAgIHNldEF1dGhDb29raWVzKHJlcywge1xuICAgICAgYWNjZXNzVG9rZW4sXG4gICAgICByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbixcbiAgICB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJUb2tlbiByZWZyZXNoZWQgc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW46IG5ld1JlZnJlc2hUb2tlbiB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gTG9nb3V0IGNvbnRyb2xsZXJcbmNvbnN0IGxvZ291dFVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgYXdhaXQgYXV0aFNlcnZpY2UubG9nb3V0KHVzZXJJZCk7XG4gICAgY2xlYXJBdXRoQ29va2llcyhyZXMpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgbG9nZ2VkIG91dCBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgTWUgY29udHJvbGxlclxuY29uc3QgZ2V0TWUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IGF1dGhTZXJ2aWNlLmdldE1lRnJvbURCKHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYXV0aENvbnRyb2xsZXIgPSB7XG4gIHJlZ2lzdGVyVXNlcixcbiAgbG9naW5Vc2VyLFxuICBnb29nbGVMb2dpbixcbiAgZGVtb0xvZ2luLFxuICByZWZyZXNoVG9rZW4sXG4gIGxvZ291dFVzZXIsXG4gIGdldE1lLFxufTsiLCAiaW1wb3J0IGJjcnlwdCBmcm9tIFwiYmNyeXB0anNcIjtcbmltcG9ydCB7IEp3dFBheWxvYWQsIFNpZ25PcHRpb25zIH0gZnJvbSBcImpzb253ZWJ0b2tlblwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgZ29vZ2xlQ2xpZW50IH0gZnJvbSBcIi4uLy4uL2xpYi9nb29nbGVBdXRoXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgand0VXRpbHMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvand0XCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7XG4gIElBdXRoLFxuICBJRGVtb0xvZ2luUGF5bG9hZCxcbiAgSUdvb2dsZUxvZ2luUGF5bG9hZCxcbiAgSUxvZ2luVXNlcixcbiAgSVJlZnJlc2hUb2tlblBheWxvYWQsXG59IGZyb20gXCIuL2F1dGguaW50ZXJmYWNlXCI7XG5cbmNvbnN0IGJ1aWxkVG9rZW5QYXlsb2FkID0gKHVzZXI6IHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICByb2xlOiBSb2xlO1xuICB0b2tlblZlcnNpb246IG51bWJlcjtcbn0pID0+ICh7XG4gIGlkOiB1c2VyLmlkLFxuICBuYW1lOiB1c2VyLm5hbWUsXG4gIGVtYWlsOiB1c2VyLmVtYWlsLFxuICByb2xlOiB1c2VyLnJvbGUsXG4gIHRva2VuVmVyc2lvbjogdXNlci50b2tlblZlcnNpb24sXG59KTtcblxuY29uc3QgaXNzdWVUb2tlbnMgPSAodXNlcjoge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIHJvbGU6IFJvbGU7XG4gIHRva2VuVmVyc2lvbjogbnVtYmVyO1xufSkgPT4ge1xuICBjb25zdCB0b2tlblBheWxvYWQgPSBidWlsZFRva2VuUGF5bG9hZCh1c2VyKTtcblxuICBjb25zdCBhY2Nlc3NUb2tlbiA9IGp3dFV0aWxzLmNyZWF0ZVRva2VuKFxuICAgIHRva2VuUGF5bG9hZCxcbiAgICBjb25maWcuand0X2FjY2Vzc19zZWNyZXQsXG4gICAgeyBleHBpcmVzSW46IGNvbmZpZy5qd3RfYWNjZXNzX2V4cGlyZXNfaW4gfSBhcyBTaWduT3B0aW9ucyxcbiAgKTtcbiAgY29uc3QgcmVmcmVzaFRva2VuID0gand0VXRpbHMuY3JlYXRlVG9rZW4oXG4gICAgdG9rZW5QYXlsb2FkLFxuICAgIGNvbmZpZy5qd3RfcmVmcmVzaF9zZWNyZXQsXG4gICAgeyBleHBpcmVzSW46IGNvbmZpZy5qd3RfcmVmcmVzaF9leHBpcmVzX2luIH0gYXMgU2lnbk9wdGlvbnMsXG4gICk7XG5cbiAgcmV0dXJuIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9O1xufTtcblxuY29uc3Qgc2FuaXRpemVVc2VyID0gPFQgZXh0ZW5kcyB7IHBhc3N3b3JkOiBzdHJpbmcgfCBudWxsIH0+KHVzZXI6IFQpID0+IHtcbiAgY29uc3QgeyBwYXNzd29yZCwgLi4ucmVzdCB9ID0gdXNlcjtcbiAgcmV0dXJuIHJlc3Q7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVnaXN0ZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCByZWdpc3RlclVzZXIgPSBhc3luYyAocGF5bG9hZDogSUF1dGgpID0+IHtcbiAgY29uc3QgeyBuYW1lLCBlbWFpbCwgcGFzc3dvcmQsIHBob25lLCByb2xlIH0gPSBwYXlsb2FkO1xuXG4gIC8vIE9ubHkgdXNlcnMvYWdlbnRzIGNhbiBzZWxmLXJlZ2lzdGVyOyBhZG1pbnMgYXJlIGNyZWF0ZWQgdmlhIGRlbW8tbG9naW4vc2VlZFxuICBpZiAocm9sZSAmJiByb2xlICE9PSBcIlVTRVJcIiAmJiByb2xlICE9PSBcIkFHRU5UXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIlJvbGUgbXVzdCBiZSBlaXRoZXIgVVNFUiBvciBBR0VOVFwiKTtcbiAgfVxuXG4gIGNvbnN0IGV4aXN0aW5nVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGVtYWlsIH0sXG4gIH0pO1xuICBpZiAoZXhpc3RpbmdVc2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJVc2VyIHdpdGggdGhpcyBlbWFpbCBhbHJlYWR5IGV4aXN0c1wiKTtcbiAgfVxuXG4gIGNvbnN0IGhhc2hlZFBhc3N3b3JkID0gYXdhaXQgYmNyeXB0Lmhhc2goXG4gICAgcGFzc3dvcmQsXG4gICAgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpLFxuICApO1xuXG4gIGNvbnN0IGNyZWF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICBuYW1lLFxuICAgICAgZW1haWwsXG4gICAgICBwYXNzd29yZDogaGFzaGVkUGFzc3dvcmQsXG4gICAgICBhdXRoUHJvdmlkZXI6IFwiQ1JFREVOVElBTFwiLFxuICAgICAgcm9sZTogcm9sZSB8fCBcIlVTRVJcIixcbiAgICAgIHBob25lLFxuICAgIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gY3JlYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTG9naW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBsb2dpblVzZXIgPSBhc3luYyAocGF5bG9hZDogSUxvZ2luVXNlcikgPT4ge1xuICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgZW1haWwgfSxcbiAgfSk7XG5cbiAgaWYgKCF1c2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJJbnZhbGlkIGVtYWlsIG9yIHBhc3N3b3JkXCIpO1xuICB9XG4gIGlmICh1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBpcyBzdXNwZW5kZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJUaGlzIGFjY291bnQgdXNlcyBHb29nbGUgbG9naW4uIFBsZWFzZSBsb2cgaW4gd2l0aCBHb29nbGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGlzUGFzc3dvcmRWYWxpZCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKHBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkIHx8IFwiXCIpO1xuICBpZiAoIWlzUGFzc3dvcmRWYWxpZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBlbWFpbCBvciBwYXNzd29yZFwiKTtcbiAgfVxuXG4gIHJldHVybiBpc3N1ZVRva2Vucyh1c2VyKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBHb29nbGUgbG9naW4gKElELXRva2VuIGZsb3cpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ29vZ2xlTG9naW4gPSBhc3luYyAocGF5bG9hZDogSUdvb2dsZUxvZ2luUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IGlkVG9rZW4gfSA9IHBheWxvYWQ7XG5cbiAgaWYgKCFjb25maWcuZ29vZ2xlX2NsaWVudF9pZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiR29vZ2xlIGxvZ2luIGlzIG5vdCBjb25maWd1cmVkLiBQbGVhc2UgY29udGFjdCBzdXBwb3J0LlwiLFxuICAgICk7XG4gIH1cblxuICBsZXQgdGlja2V0O1xuICB0cnkge1xuICAgIHRpY2tldCA9IGF3YWl0IGdvb2dsZUNsaWVudC52ZXJpZnlJZFRva2VuKHtcbiAgICAgIGlkVG9rZW4sXG4gICAgICBhdWRpZW5jZTogY29uZmlnLmdvb2dsZV9jbGllbnRfaWQsXG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBHb29nbGUgdG9rZW5cIik7XG4gIH1cblxuICBjb25zdCBnb29nbGVEYXRhID0gdGlja2V0LmdldFBheWxvYWQoKTtcbiAgaWYgKCFnb29nbGVEYXRhKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIEdvb2dsZSB0b2tlbiBwYXlsb2FkXCIpO1xuICB9XG5cbiAgY29uc3QgeyBlbWFpbCwgbmFtZSwgc3ViLCBwaWN0dXJlIH0gPSBnb29nbGVEYXRhO1xuXG4gIGlmICghZW1haWwgfHwgIWdvb2dsZURhdGEuZW1haWxfdmVyaWZpZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkdvb2dsZSBhY2NvdW50IGVtYWlsIGlzIG5vdCB2ZXJpZmllZFwiKTtcbiAgfVxuXG4gIGxldCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGdvb2dsZUlkOiBzdWIgfSB9KTtcblxuICAvLyBFeGlzdGluZyB1c2VyIFx1MjE5MiBsaW5rIEdvb2dsZSBhY2NvdW50IGlmIG5vdCBhbHJlYWR5IGxpbmtlZFxuICBpZiAoIXVzZXIgJiYgZW1haWwpIHtcbiAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG4gICAgaWYgKHVzZXIpIHtcbiAgICAgIGlmICh1c2VyLmdvb2dsZUlkICYmIHVzZXIuZ29vZ2xlSWQgIT09IHN1Yikge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgNDA5LFxuICAgICAgICAgIFwiRW1haWwgaXMgYWxyZWFkeSBsaW5rZWQgdG8gYW5vdGhlciBHb29nbGUgYWNjb3VudFwiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiB1c2VyLmlkIH0sXG4gICAgICAgIGRhdGE6IHsgZ29vZ2xlSWQ6IHN1YiwgZW1haWxWZXJpZmllZDogdHJ1ZSB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gQnJhbmQgbmV3IHVzZXJcbiAgaWYgKCF1c2VyKSB7XG4gICAgY29uc3QgbG9jYWxQYXJ0ID0gZW1haWwuc3BsaXQoXCJAXCIpWzBdID8/IGVtYWlsO1xuICAgIGNvbnN0IGRpc3BsYXlOYW1lID0gKG5hbWUgPz8gXCJcIikudHJpbSgpIHx8IGxvY2FsUGFydDtcbiAgICB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgZW1haWwsXG4gICAgICAgIG5hbWU6IGRpc3BsYXlOYW1lLFxuICAgICAgICBwYXNzd29yZDogbnVsbCxcbiAgICAgICAgYXV0aFByb3ZpZGVyOiBcIkdPT0dMRVwiLFxuICAgICAgICBnb29nbGVJZDogc3ViLFxuICAgICAgICBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuICAgICAgICByb2xlOiBcIlVTRVJcIixcbiAgICAgICAgYXZhdGFyVXJsOiBwaWN0dXJlIHx8IG51bGwsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdG9rZW5zID0gaXNzdWVUb2tlbnModXNlciEpO1xuICBjb25zdCBzYW5pdGl6ZWRVc2VyID0gc2FuaXRpemVVc2VyKHVzZXIhKTtcblxuICByZXR1cm4geyAuLi50b2tlbnMsIHVzZXI6IHNhbml0aXplZFVzZXIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBEZW1vIGxvZ2luIChncmFkaW5nKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IERFTU9fUEFTU1dPUkQgPSBcImRlbW8xMjNcIjtcblxuY29uc3QgZGVtb0xvZ2luID0gYXN5bmMgKHBheWxvYWQ6IElEZW1vTG9naW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgcm9sZSB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBkZW1vVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwc2VydCh7XG4gICAgd2hlcmU6IHsgZW1haWw6IGBkZW1vLSR7cm9sZS50b0xvd2VyQ2FzZSgpfUB0cmlwdmVyc2UuY29tYCB9LFxuICAgIC8vIHJlc3VycmVjdCBkZW1vIGFjY291bnRzIHRoYXQgYW4gYWRtaW4gc3VzcGVuZGVkIG9yIHNvZnQtZGVsZXRlZFxuICAgIHVwZGF0ZTogeyBzdGF0dXM6IFwiQUNUSVZFXCIsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBjcmVhdGU6IHtcbiAgICAgIG5hbWU6IGBEZW1vICR7cm9sZS5jaGFyQXQoMCkgKyByb2xlLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCl9YCxcbiAgICAgIGVtYWlsOiBgZGVtby0ke3JvbGUudG9Mb3dlckNhc2UoKX1AdHJpcHZlcnNlLmNvbWAsXG4gICAgICBwYXNzd29yZDogYXdhaXQgYmNyeXB0Lmhhc2goREVNT19QQVNTV09SRCwgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpKSxcbiAgICAgIGF1dGhQcm92aWRlcjogXCJDUkVERU5USUFMXCIsXG4gICAgICByb2xlLFxuICAgICAgc3RhdHVzOiBcIkFDVElWRVwiLFxuICAgICAgZW1haWxWZXJpZmllZDogdHJ1ZSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHsgLi4uaXNzdWVUb2tlbnMoZGVtb1VzZXIpLCB1c2VyOiBkZW1vVXNlciB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZnJlc2ggXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCByZWZyZXNoVG9rZW4gPSBhc3luYyAocGF5bG9hZDogSVJlZnJlc2hUb2tlblBheWxvYWQpID0+IHtcbiAgY29uc3QgeyByZWZyZXNoVG9rZW46IHByb3ZpZGVkUmVmcmVzaFRva2VuIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHZlcmlmaWVkID0gand0VXRpbHMudmVyaWZ5VG9rZW4oXG4gICAgcHJvdmlkZWRSZWZyZXNoVG9rZW4sXG4gICAgY29uZmlnLmp3dF9yZWZyZXNoX3NlY3JldCxcbiAgKTtcblxuICBpZiAoIXZlcmlmaWVkLnN1Y2Nlc3MpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCB2ZXJpZmllZC5lcnJvcik7XG4gIH1cblxuICBjb25zdCB7IGlkLCB0b2tlblZlcnNpb246IHRva2VuVG9rZW5WZXJzaW9uIH0gPVxuICAgIHZlcmlmaWVkLmRhdGEgYXMgSnd0UGF5bG9hZCAmIHsgdG9rZW5WZXJzaW9uOiBudW1iZXIgfTtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG5cbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGhhcyBiZWVuIGRlbGV0ZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGlzIHN1c3BlbmRlZFwiKTtcbiAgfVxuXG4gIC8vIHRva2VuVmVyc2lvbiBjaGFuZ2VkIFx1MjE5MiB0b2tlbnMgd2VyZSByZXZva2VkIChsb2dvdXQgLyBwYXNzd29yZCBjaGFuZ2UpXG4gIGlmICh1c2VyLnRva2VuVmVyc2lvbiAhPT0gdG9rZW5Ub2tlblZlcnNpb24pIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIlRva2VuIGlzIG5vIGxvbmdlciB2YWxpZC4gUGxlYXNlIGxvZ2luIGFnYWluLlwiKTtcbiAgfVxuXG4gIHJldHVybiBpc3N1ZVRva2Vucyh1c2VyKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBMb2dvdXQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBsb2dvdXQgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgZGF0YTogeyB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSxcbiAgfSk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgR2V0IG1lIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0TWVGcm9tREIgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICByZXR1cm4gdXNlcjtcbn07XG5cbmV4cG9ydCBjb25zdCBhdXRoU2VydmljZSA9IHtcbiAgcmVnaXN0ZXJVc2VyLFxuICBsb2dpblVzZXIsXG4gIGdvb2dsZUxvZ2luLFxuICBkZW1vTG9naW4sXG4gIHJlZnJlc2hUb2tlbixcbiAgbG9nb3V0LFxuICBnZXRNZUZyb21EQixcbn07IiwgImltcG9ydCB7IE9BdXRoMkNsaWVudCB9IGZyb20gXCJnb29nbGUtYXV0aC1saWJyYXJ5XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuZXhwb3J0IGNvbnN0IGdvb2dsZUNsaWVudCA9IG5ldyBPQXV0aDJDbGllbnQoe1xuICBjbGllbnRJZDogY29uZmlnLmdvb2dsZV9jbGllbnRfaWQsXG59KTsiLCAiaW1wb3J0IGp3dCwgeyBKd3RQYXlsb2FkLCBTaWduT3B0aW9ucyB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcblxuY29uc3QgY3JlYXRlVG9rZW4gPSAoXG4gIHBheWxvYWQ6IEp3dFBheWxvYWQsXG4gIHNlY3JldDogc3RyaW5nLFxuICBleHBpcmVzSW46IFNpZ25PcHRpb25zLFxuKSA9PiB7XG4gIGNvbnN0IHRva2VuID0gand0LnNpZ24ocGF5bG9hZCwgc2VjcmV0LCBleHBpcmVzSW4pO1xuXG4gIHJldHVybiB0b2tlbjtcbn07XG5cbmNvbnN0IHZlcmlmeVRva2VuID0gKHRva2VuOiBzdHJpbmcsIHNlY3JldDogc3RyaW5nKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdmVyaWZpZWRUb2tlbiA9IGp3dC52ZXJpZnkodG9rZW4sIHNlY3JldCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBkYXRhOiB2ZXJpZmllZFRva2VuLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICBjb25zb2xlLmxvZyhcIlRva2VuIFZlcmlmaWNhdGlvbiBGYWlsZWQ6XCIsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogZXJyb3IubWVzc2FnZSxcbiAgICB9O1xuICB9XG59O1xuXG5leHBvcnQgY29uc3Qgand0VXRpbHMgPSB7XG4gIGNyZWF0ZVRva2VuLFxuICB2ZXJpZnlUb2tlbixcbn07XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXF1ZXN0SGFuZGxlciwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5leHBvcnQgY29uc3QgY2F0Y2hBc3luYyA9IChmbjogUmVxdWVzdEhhbmRsZXIpID0+IHtcbiAgcmV0dXJuIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmbihyZXEsIHJlcywgbmV4dCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIG5leHQoZXJyb3IpO1xuICAgIH1cbiAgfTtcbn07XG4iLCAiaW1wb3J0IHsgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG50eXBlIFRNZXRhID0ge1xuICBwYWdlOiBudW1iZXI7XG4gIGxpbWl0OiBudW1iZXI7XG4gIHRvdGFsOiBudW1iZXI7XG4gIHRvdGFsUGFnZXM6IG51bWJlcjtcbn07XG5cbnR5cGUgVFJlc3BvbnNlRGF0YTxUPiA9IHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgc3RhdHVzQ29kZTogbnVtYmVyO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGRhdGE6IFQ7XG4gIG1ldGE/OiBUTWV0YTtcbn07XG5cbmV4cG9ydCBjb25zdCBzZW5kUmVzcG9uc2UgPSA8VD4ocmVzOiBSZXNwb25zZSwgZGF0YTogVFJlc3BvbnNlRGF0YTxUPikgPT4ge1xuICByZXMuc3RhdHVzKGRhdGEuc3RhdHVzQ29kZSkuanNvbih7XG4gICAgc3VjY2VzczogZGF0YS5zdWNjZXNzLFxuICAgIG1lc3NhZ2U6IGRhdGEubWVzc2FnZSxcbiAgICBkYXRhOiBkYXRhLmRhdGEsXG4gICAgbWV0YTogZGF0YS5tZXRhLFxuICB9KTtcbn07XG4iLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCByZWdpc3RlclNjaGVtYSA9IHoub2JqZWN0KHtcbiAgbmFtZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJOYW1lIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKSxcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpLFxuICBwYXNzd29yZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbig2LCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCg3MiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IG1vc3QgNzIgY2hhcmFjdGVyc1wiKSxcbiAgcGhvbmU6IHpcbiAgICAuc3RyaW5nKClcbiAgICAubWF4KDIwLCBcIlBob25lIG51bWJlciBpcyB0b28gbG9uZ1wiKVxuICAgIC5vcHRpb25hbCgpLFxuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBsb2dpblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZW1haWw6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRW1haWwgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAuZW1haWwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsXCIpLFxuICBwYXNzd29yZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYXNzd29yZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBnb29nbGVMb2dpblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWRUb2tlbjogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJHb29nbGUgaWRUb2tlbiBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBkZW1vTG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlLCB7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSByb2xlXCIsXG4gIH0pLFxufSk7XG5cbi8vIHJlZnJlc2hUb2tlbiBtYXkgY29tZSBmcm9tIHRoZSBodHRwT25seSBjb29raWUgT1IgdGhlIHJlcXVlc3QgYm9keSBcdTIwMTRcbi8vIHZhbGlkYXRpb24gaXMgbGVuaWVudCBoZXJlOyB0aGUgY29udHJvbGxlciBoYW5kbGVzIGJvdGggc291cmNlcy5cbmNvbnN0IHJlZnJlc2hUb2tlblNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcmVmcmVzaFRva2VuOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRSZWdpc3RlclNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHJlZ2lzdGVyU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRMb2dpblNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGxvZ2luU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRHb29nbGVMb2dpblNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGdvb2dsZUxvZ2luU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRSZWZyZXNoVG9rZW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZWZyZXNoVG9rZW5TY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgYXV0aFZhbGlkYXRpb25zID0ge1xuICByZWdpc3RlclNjaGVtYSxcbiAgbG9naW5TY2hlbWEsXG4gIGdvb2dsZUxvZ2luU2NoZW1hLFxuICBkZW1vTG9naW5TY2hlbWEsXG4gIHJlZnJlc2hUb2tlblNjaGVtYSxcbn07IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgWm9kVHlwZSB9IGZyb20gXCJ6b2RcIjtcblxudHlwZSBWYWxpZGF0aW9uU2NoZW1hID0ge1xuICBib2R5PzogWm9kVHlwZTtcbiAgcXVlcnk/OiBab2RUeXBlO1xuICBwYXJhbXM/OiBab2RUeXBlO1xufTtcblxuLy8gUnVucyBab2Qgc2NoZW1hcyBhZ2FpbnN0IHJlcS5ib2R5L3F1ZXJ5L3BhcmFtcyBhbmQgcmVwbGFjZXMgdGhlIHBhcnNlZFxuLy8gdmFsdWVzIHNvIGRvd25zdHJlYW0gaGFuZGxlcnMgd29yayB3aXRoIHZhbGlkYXRlZCAoYW5kIHR5cGVkKSBkYXRhLlxuLy8gQW55IFpvZEVycm9yIHRocm93biBoZXJlIGlzIG1hcHBlZCB0byBhIDQwMCBieSBnbG9iYWxFcnJvckhhbmRsZXIuXG4vL1xuLy8gcmVxLmJvZHkgaXMgc2FmZWx5IHdyaXRhYmxlLCBidXQgaW4gRXhwcmVzcyA1IHJlcS5xdWVyeS9yZXEucGFyYW1zIGFyZVxuLy8gZ2V0dGVyLW9ubHkgXHUyMDE0IHRoZXkgbXVzdCBiZSByZWRlZmluZWQgdmlhIGRlZmluZVByb3BlcnR5IHRvIHN3YXAgaW4gdGhlXG4vLyBwYXJzZWQgdmFsdWVzLlxuY29uc3QgdmFsaWRhdGVSZXF1ZXN0ID0gKHNjaGVtYTogVmFsaWRhdGlvblNjaGVtYSkgPT4ge1xuICByZXR1cm4gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgaWYgKHNjaGVtYS5ib2R5KSB7XG4gICAgICByZXEuYm9keSA9IHNjaGVtYS5ib2R5LnBhcnNlKHJlcS5ib2R5KTtcbiAgICB9XG4gICAgaWYgKHNjaGVtYS5xdWVyeSkge1xuICAgICAgY29uc3QgcGFyc2VkUXVlcnkgPSBzY2hlbWEucXVlcnkucGFyc2UocmVxLnF1ZXJ5KTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXEsIFwicXVlcnlcIiwge1xuICAgICAgICB2YWx1ZTogcGFyc2VkUXVlcnksXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKHNjaGVtYS5wYXJhbXMpIHtcbiAgICAgIGNvbnN0IHBhcnNlZFBhcmFtcyA9IHNjaGVtYS5wYXJhbXMucGFyc2UocmVxLnBhcmFtcyk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVxLCBcInBhcmFtc1wiLCB7XG4gICAgICAgIHZhbHVlOiBwYXJzZWRQYXJhbXMsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBuZXh0KCk7XG4gIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCB2YWxpZGF0ZVJlcXVlc3Q7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgSnd0UGF5bG9hZCB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgand0VXRpbHMgfSBmcm9tIFwiLi4vdXRpbHMvand0XCI7XG5cbi8vIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTikgXHUyMTkyIG9ubHkgdGhvc2Ugcm9sZXMgcGFzc1xuLy8gYXV0aCgpIFx1MjE5MiBhbnkgYXV0aGVudGljYXRlZCB1c2VyIHBhc3Nlc1xuY29uc3QgYXV0aCA9ICguLi5yZXF1aXJlZFJvbGVzOiBSb2xlW10pID0+IHtcbiAgcmV0dXJuIGNhdGNoQXN5bmMoYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdG9rZW4gPSByZXEuY29va2llcy5hY2Nlc3NUb2tlblxuICAgICAgPyByZXEuY29va2llcy5hY2Nlc3NUb2tlblxuICAgICAgOiByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uPy5zdGFydHNXaXRoKFwiQmVhcmVyIFwiKVxuICAgICAgICA/IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb24uc3BsaXQoXCIgXCIpWzFdXG4gICAgICAgIDogcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbjtcblxuICAgIC8vIDEuIHRva2VuIG11c3QgYmUgcHJlc2VudFxuICAgIGlmICghdG9rZW4pIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAxLFxuICAgICAgICBcIllvdSBhcmUgbm90IGxvZ2dlZCBpbi4gUGxlYXNlIGxvZ2luIHRvIGNvbnRpbnVlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyAyLiB2ZXJpZnkgdGhlIGFjY2VzcyB0b2tlblxuICAgIGNvbnN0IHZlcmlmaWVkVG9rZW4gPSBqd3RVdGlscy52ZXJpZnlUb2tlbihcbiAgICAgIHRva2VuLFxuICAgICAgY29uZmlnLmp3dF9hY2Nlc3Nfc2VjcmV0LFxuICAgICk7XG5cbiAgICBpZiAoIXZlcmlmaWVkVG9rZW4uc3VjY2Vzcykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgdmVyaWZpZWRUb2tlbi5lcnJvcik7XG4gICAgfVxuXG4gICAgY29uc3QgeyBpZCwgdG9rZW5WZXJzaW9uIH0gPSB2ZXJpZmllZFRva2VuLmRhdGEgYXMgSnd0UGF5bG9hZCAmIHtcbiAgICAgIHRva2VuVmVyc2lvbjogbnVtYmVyO1xuICAgIH07XG5cbiAgICAvLyAzLiByZS1mZXRjaCB1c2VyIHRvIGVuZm9yY2UgYWNjb3VudCBzdGF0ZSBvbiBldmVyeSByZXF1ZXN0XG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgd2hlcmU6IHsgaWQgfSxcbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJVc2VyIG5vdCBmb3VuZC5cIik7XG4gICAgfVxuXG4gICAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJVc2VyIGlzIHN1c3BlbmRlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydCBzZXJ2aWNlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA0LiB0b2tlblZlcnNpb24gbXVzdCBtYXRjaCBEQiAobG9nb3V0IC8gcGFzc3dvcmQgY2hhbmdlIGtpbGxzIG9sZCB0b2tlbnMpXG4gICAgaWYgKHVzZXIudG9rZW5WZXJzaW9uICE9PSB0b2tlblZlcnNpb24pIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAxLFxuICAgICAgICBcIlNlc3Npb24gaXMgbm8gbG9uZ2VyIHZhbGlkLiBQbGVhc2UgbG9naW4gYWdhaW4uXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDUuIGF1dGhvcml6YXRpb24gdXNlcyB0aGUgREIgcm9sZSwgbm90IHRoZSAocG9zc2libHkgc3RhbGUpIEpXVCByb2xlXG4gICAgaWYgKHJlcXVpcmVkUm9sZXMubGVuZ3RoICYmICFyZXF1aXJlZFJvbGVzLmluY2x1ZGVzKHVzZXIucm9sZSkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAzLFxuICAgICAgICBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gYWNjZXNzIHRoaXMgcm91dGUuXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIDYuIGF0dGFjaCB0aGUgYXV0aGVudGljYXRlZCB1c2VyIHRvIHRoZSByZXF1ZXN0XG4gICAgcmVxLnVzZXIgPSB7XG4gICAgICBpZDogdXNlci5pZCxcbiAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgIGVtYWlsOiB1c2VyLmVtYWlsLFxuICAgICAgcm9sZTogdXNlci5yb2xlLFxuICAgIH07XG5cbiAgICBuZXh0KCk7XG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYXV0aDsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHVzZXJDb250cm9sbGVyIH0gZnJvbSBcIi4vdXNlci5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyB1c2VyVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi91c2VyLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE93biBwcm9maWxlIFx1MjAxNCBhbnkgYXV0aGVudGljYXRlZCB1c2VyXG5yb3V0ZXIucGF0Y2goXG4gIFwiL3Byb2ZpbGVcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiB1c2VyVmFsaWRhdGlvbnMudXBkYXRlUHJvZmlsZVNjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIudXBkYXRlUHJvZmlsZSxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBsaXN0IHVzZXJzIHdpdGggZmlsdGVycyArIHBhZ2luYXRpb25cbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogdXNlclZhbGlkYXRpb25zLnVzZXJRdWVyeVNjaGVtYSB9KSxcbiAgdXNlckNvbnRyb2xsZXIuZ2V0VXNlcnMsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgcm9sZSBtYW5hZ2VtZW50XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9yb2xlXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiB1c2VyVmFsaWRhdGlvbnMudXNlclBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiB1c2VyVmFsaWRhdGlvbnMuY2hhbmdlUm9sZVNjaGVtYSxcbiAgfSksXG4gIHVzZXJDb250cm9sbGVyLmNoYW5nZVJvbGUsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgc3RhdHVzIG1hbmFnZW1lbnRcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogdXNlclZhbGlkYXRpb25zLmNoYW5nZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIHVzZXJDb250cm9sbGVyLmNoYW5nZVN0YXR1cyxcbik7XG5cbi8vIEFkbWluIFx1MjAxNCBzb2Z0IGRlbGV0ZVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLmRlbGV0ZVVzZXIsXG4pO1xuXG5leHBvcnQgY29uc3QgdXNlclJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHVzZXJTZXJ2aWNlIH0gZnJvbSBcIi4vdXNlci5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gVXBkYXRlIHByb2ZpbGUgY29udHJvbGxlclxuY29uc3QgdXBkYXRlUHJvZmlsZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UudXBkYXRlUHJvZmlsZSh1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQcm9maWxlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdldCBhbGwgdXNlcnMgKGFkbWluKVxuY29uc3QgZ2V0VXNlcnMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1c2VyU2VydmljZS5nZXRVc2VycyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXJzIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSB1c2VyIHJvbGUgKGFkbWluKVxuY29uc3QgY2hhbmdlUm9sZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgLy8gYW4gYWRtaW4gbXVzdCBub3QgZG93bmdyYWRlL2NoYW5nZSB0aGVpciBvd24gcm9sZVxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBjaGFuZ2UgeW91ciBvd24gcm9sZS5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5jaGFuZ2VSb2xlKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciByb2xlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSB1c2VyIHN0YXR1cyAoYWRtaW4pXG5jb25zdCBjaGFuZ2VTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IHN1c3BlbmQvYWN0aXZhdGUgdGhlaXIgb3duIGFjY291bnRcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgY2hhbmdlIHlvdXIgb3duIHN0YXR1cy5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5jaGFuZ2VTdGF0dXMoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBTb2Z0IGRlbGV0ZSB1c2VyIChhZG1pbilcbmNvbnN0IGRlbGV0ZVVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IGRlbGV0ZSB0aGVpciBvd24gYWNjb3VudFxuICAgIGlmIChpZCA9PT0gcmVxLnVzZXI/LmlkKSB7XG4gICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5GT1JCSURERU4sXG4gICAgICAgIG1lc3NhZ2U6IFwiWW91IGNhbm5vdCBkZWxldGUgeW91ciBvd24gYWNjb3VudC5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB1c2VyU2VydmljZS5kZWxldGVVc2VyKGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogdXNlcixcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCB1c2VyQ29udHJvbGxlciA9IHtcbiAgdXBkYXRlUHJvZmlsZSxcbiAgZ2V0VXNlcnMsXG4gIGNoYW5nZVJvbGUsXG4gIGNoYW5nZVN0YXR1cyxcbiAgZGVsZXRlVXNlcixcbn07IiwgImltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBSb2xlLCBVc2VyU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7XG4gIElDaGFuZ2VSb2xlLFxuICBJQ2hhbmdlU3RhdHVzLFxuICBJVXBkYXRlUHJvZmlsZSxcbiAgSVVzZXJRdWVyeSxcbn0gZnJvbSBcIi4vdXNlci5pbnRlcmZhY2VcIjtcblxuY29uc3QgdmFsaWRhdGVBY3RpdmVVc2VyID0gYXN5bmMgKGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cbiAgaWYgKHVzZXIuc3RhdHVzID09PSBcIlNVU1BFTkRFRFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJVc2VyIGlzIHN1c3BlbmRlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydCBzZXJ2aWNlLlwiKTtcbiAgfVxuXG4gIHJldHVybiB1c2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFVwZGF0ZSBwcm9maWxlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgdXBkYXRlUHJvZmlsZSA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSVVwZGF0ZVByb2ZpbGUpID0+IHtcbiAgY29uc3QgeyBuYW1lLCBwaG9uZSwgYXZhdGFyVXJsLCBjdXJyZW50UGFzc3dvcmQsIG5ld1Bhc3N3b3JkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlT3JUaHJvdyh7IHdoZXJlOiB7IGlkOiB1c2VySWQgfSB9KTtcblxuICBpZiAodXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaGFzIGJlZW4gZGVsZXRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5hdXRoUHJvdmlkZXIgPT09IFwiR09PR0xFXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDMsXG4gICAgICBcIkdvb2dsZSBhY2NvdW50cyBjYW5ub3QgY2hhbmdlIHBhc3N3b3JkLiBVc2UgR29vZ2xlIHNpZ24taW4gdG8gbWFuYWdlIHlvdXIgcHJvZmlsZS5cIixcbiAgICApO1xuICB9XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLlVzZXJVcGRhdGVJbnB1dCA9IHt9O1xuXG4gIGlmIChuYW1lKSBkYXRhLm5hbWUgPSBuYW1lO1xuICBpZiAocGhvbmUpIGRhdGEucGhvbmUgPSBwaG9uZTtcbiAgaWYgKGF2YXRhclVybCkgZGF0YS5hdmF0YXJVcmwgPSBhdmF0YXJVcmw7XG5cbiAgLy8gUGFzc3dvcmQgY2hhbmdlIHJlcXVpcmVzIGN1cnJlbnRQYXNzd29yZCArIG5ld1Bhc3N3b3JkXG4gIGlmIChuZXdQYXNzd29yZCkge1xuICAgIGlmICghY3VycmVudFBhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkN1cnJlbnQgcGFzc3dvcmQgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuICAgIGlmIChjdXJyZW50UGFzc3dvcmQgPT09IG5ld1Bhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIk5ldyBwYXNzd29yZCBtdXN0IGJlIGRpZmZlcmVudFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBpc01hdGNoID0gYXdhaXQgYmNyeXB0LmNvbXBhcmUoY3VycmVudFBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkIHx8IFwiXCIpO1xuICAgIGlmICghaXNNYXRjaCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGN1cnJlbnQgcGFzc3dvcmRcIik7XG4gICAgfVxuXG4gICAgZGF0YS5wYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgICAgbmV3UGFzc3dvcmQsXG4gICAgICBOdW1iZXIoY29uZmlnLmJjcnlwdF9zYWx0X3JvdW5kcyksXG4gICAgKTtcbiAgICBkYXRhLnRva2VuVmVyc2lvbiA9IHsgaW5jcmVtZW50OiAxIH07XG4gIH1cblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIGRhdGEsXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gdXBkYXRlZFVzZXI7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IGxpc3QgdXNlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRVc2VycyA9IGFzeW5jIChxdWVyeTogSVVzZXJRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSB8fCAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0IHx8IDEwO1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVXNlcldoZXJlSW5wdXQgPSB7XG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgfTtcblxuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUuT1IgPSBbXG4gICAgICB7IG5hbWU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgIHsgZW1haWw6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICBdO1xuICB9XG4gIGlmIChxdWVyeS5yb2xlKSB3aGVyZS5yb2xlID0gcXVlcnkucm9sZTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuXG4gIGNvbnN0IFt1c2VycywgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS51c2VyLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgc2tpcDogKHBhZ2UgLSAxKSAqIGxpbWl0LFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEudXNlci5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IHVzZXJzLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IHVwZGF0ZSByb2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY2hhbmdlUm9sZSA9IGFzeW5jIChpZDogc3RyaW5nLCBwYXlsb2FkOiBJQ2hhbmdlUm9sZSkgPT4ge1xuICBjb25zdCB7IHJvbGUgfSA9IHBheWxvYWQ7XG5cbiAgYXdhaXQgdmFsaWRhdGVBY3RpdmVVc2VyKGlkKTtcblxuICBjb25zdCB1cGRhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IHJvbGUsIHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiB1cGRhdGUgc3RhdHVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgY2hhbmdlU3RhdHVzID0gYXN5bmMgKGlkOiBzdHJpbmcsIHBheWxvYWQ6IElDaGFuZ2VTdGF0dXMpID0+IHtcbiAgY29uc3QgeyBzdGF0dXMgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YToge1xuICAgICAgc3RhdHVzLFxuICAgICAgLy8gcmVhY3RpdmF0aW5nIHByZXNlcnZlcyB0aGUgYWNjb3VudCB3aGlsZSBzdXNwZW5kaW5nIHJldm9rZXMgYWxsIHNlc3Npb25zXG4gICAgICAuLi4oc3RhdHVzID09PSBVc2VyU3RhdHVzLlNVU1BFTkRFRCAmJiB7IHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9KSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBzb2Z0IGRlbGV0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGRlbGV0ZVVzZXIgPSBhc3luYyAoaWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmRcIik7XG4gIH1cblxuICBjb25zdCBkZWxldGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSwgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICByZXR1cm4gZGVsZXRlZFVzZXI7XG59O1xuXG5leHBvcnQgY29uc3QgdXNlclNlcnZpY2UgPSB7XG4gIHVwZGF0ZVByb2ZpbGUsXG4gIGdldFVzZXJzLFxuICBjaGFuZ2VSb2xlLFxuICBjaGFuZ2VTdGF0dXMsXG4gIGRlbGV0ZVVzZXIsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgUm9sZSwgVXNlclN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5cbmNvbnN0IHVwZGF0ZVByb2ZpbGVTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIG5hbWU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1pbigyLCBcIk5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgICBwaG9uZTogelxuICAgICAgLnN0cmluZygpXG4gICAgICAudHJpbSgpXG4gICAgICAubWF4KDIwLCBcIlBob25lIG51bWJlciBpcyB0b28gbG9uZ1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gICAgYXZhdGFyVXJsOiB6LnN0cmluZygpLnRyaW0oKS51cmwoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGltYWdlIFVSTFwiKS5vcHRpb25hbCgpLFxuICAgIGN1cnJlbnRQYXNzd29yZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgICBuZXdQYXNzd29yZDogelxuICAgICAgLnN0cmluZygpXG4gICAgICAubWluKDYsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBsZWFzdCA2IGNoYXJhY3RlcnNcIilcbiAgICAgIC5tYXgoNzIsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBtb3N0IDcyIGNoYXJhY3RlcnNcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICB9KVxuICAucmVmaW5lKFxuICAgIChkYXRhKSA9PlxuICAgICAgZGF0YS5uZXdQYXNzd29yZCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICBkYXRhLmN1cnJlbnRQYXNzd29yZCAhPT0gdW5kZWZpbmVkLFxuICAgIHsgbWVzc2FnZTogXCJDdXJyZW50IHBhc3N3b3JkIGlzIHJlcXVpcmVkIHRvIGNoYW5nZSBwYXNzd29yZFwiIH0sXG4gICk7XG5cbmNvbnN0IHVzZXJRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5vcHRpb25hbCgpLFxuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSkub3B0aW9uYWwoKSxcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oVXNlclN0YXR1cykub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCB1c2VyUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJVc2VyIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IGNoYW5nZVJvbGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJvbGU6IHoubmF0aXZlRW51bShSb2xlLCB7IHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgcm9sZVwiIH0pLFxufSk7XG5cbmNvbnN0IGNoYW5nZVN0YXR1c1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc3RhdHVzOiB6Lm5hdGl2ZUVudW0oVXNlclN0YXR1cywge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgc3RhdHVzXCIsXG4gIH0pLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRVcGRhdGVQcm9maWxlU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXBkYXRlUHJvZmlsZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUVXNlclF1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgdXNlclF1ZXJ5U2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IHVzZXJWYWxpZGF0aW9ucyA9IHtcbiAgdXBkYXRlUHJvZmlsZVNjaGVtYSxcbiAgdXNlclF1ZXJ5U2NoZW1hLFxuICB1c2VyUGFyYW1zU2NoZW1hLFxuICBjaGFuZ2VSb2xlU2NoZW1hLFxuICBjaGFuZ2VTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IG11bHRlciBmcm9tIFwibXVsdGVyXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB7IHVwbG9hZHNDb250cm9sbGVyIH0gZnJvbSBcIi4vdXBsb2Fkcy5jb250cm9sbGVyXCI7XG5cbmNvbnN0IHVwbG9hZCA9IG11bHRlcih7XG4gIHN0b3JhZ2U6IG11bHRlci5tZW1vcnlTdG9yYWdlKCksXG4gIGxpbWl0czogeyBmaWxlU2l6ZTogNSAqIDEwMjQgKiAxMDI0IH0sXG4gIGZpbGVGaWx0ZXI6IChfcmVxLCBmaWxlLCBjYikgPT4ge1xuICAgIGlmICgvXmltYWdlXFwvKGpwZWd8cG5nfHdlYnApJC8udGVzdChmaWxlLm1pbWV0eXBlKSkge1xuICAgICAgY2IobnVsbCwgdHJ1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiKFxuICAgICAgICBPYmplY3QuYXNzaWduKG5ldyBFcnJvcihcIk9ubHkganBnLCBwbmcgb3Igd2VicCBpbWFnZXMgYXJlIGFsbG93ZWRcIiksIHtcbiAgICAgICAgICBjb2RlOiBcIklOVkFMSURfRklMRV9UWVBFXCIsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG4gIH0sXG59KTtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbnJvdXRlci5wb3N0KFxuICBcIi9pbWFnZVwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB1cGxvYWQuc2luZ2xlKFwiaW1hZ2VcIiksXG4gIHVwbG9hZHNDb250cm9sbGVyLnVwbG9hZEltYWdlLFxuKTtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5IH0gZnJvbSBcIi4vdXBsb2Fkcy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbi8vIFVwbG9hZCBhIHNpbmdsZSBpbWFnZSAoQUdFTlQvQURNSU4pIFx1MjE5MiBDbG91ZGluYXJ5XG5jb25zdCB1cGxvYWRJbWFnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGlmICghcmVxLmZpbGUpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW1hZ2UgZmlsZSBpcyByZXF1aXJlZFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeShyZXEuZmlsZSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJJbWFnZSB1cGxvYWRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgdXBsb2Fkc0NvbnRyb2xsZXIgPSB7XG4gIHVwbG9hZEltYWdlLFxufTsiLCAiaW1wb3J0IHsgdjIgYXMgY2xvdWRpbmFyeSB9IGZyb20gXCJjbG91ZGluYXJ5XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuY2xvdWRpbmFyeS5jb25maWcoe1xuICBjbG91ZF9uYW1lOiBjb25maWcuY2xvdWRpbmFyeV9jbG91ZF9uYW1lLFxuICBhcGlfa2V5OiBjb25maWcuY2xvdWRpbmFyeV9hcGlfa2V5LFxuICBhcGlfc2VjcmV0OiBjb25maWcuY2xvdWRpbmFyeV9hcGlfc2VjcmV0LFxufSk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsb3VkaW5hcnk7IiwgImltcG9ydCBjbG91ZGluYXJ5IGZyb20gXCIuLi8uLi9saWIvY2xvdWRpbmFyeVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZEltYWdlVG9DbG91ZGluYXJ5ID0gKFxuICBmaWxlOiBFeHByZXNzLk11bHRlci5GaWxlLFxuKTogUHJvbWlzZTx7IHVybDogc3RyaW5nOyBwdWJsaWNJZDogc3RyaW5nIH0+ID0+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCB1cGxvYWRTdHJlYW0gPSBjbG91ZGluYXJ5LnVwbG9hZGVyLnVwbG9hZF9zdHJlYW0oXG4gICAgICB7IGZvbGRlcjogXCJ0cmlwdmVyc2VcIiB9LFxuICAgICAgKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKGVycm9yIHx8ICFyZXN1bHQpIHtcbiAgICAgICAgICByZWplY3QobmV3IEFwcEVycm9yKDQwMCwgXCJJbWFnZSB1cGxvYWQgZmFpbGVkLiBQbGVhc2UgdHJ5IGFnYWluLlwiKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJlc29sdmUoeyB1cmw6IHJlc3VsdC5zZWN1cmVfdXJsLCBwdWJsaWNJZDogcmVzdWx0LnB1YmxpY19pZCB9KTtcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHVwbG9hZFN0cmVhbS5lbmQoZmlsZS5idWZmZXIpO1xuICB9KTtcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBjb250YWN0Q29udHJvbGxlciB9IGZyb20gXCIuL2NvbnRhY3QuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgY29udGFjdFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vY29udGFjdC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIHJvdXRlIChwdWJsaWMsIG5vIGF1dGgpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGNvbnRhY3RWYWxpZGF0aW9ucy5jcmVhdGVNZXNzYWdlU2NoZW1hIH0pLFxuICBjb250YWN0Q29udHJvbGxlci5jcmVhdGVNZXNzYWdlLFxuKTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIHJvdXRlIChhZG1pbiBvbmx5KVxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBjb250YWN0VmFsaWRhdGlvbnMuY29udGFjdFF1ZXJ5U2NoZW1hIH0pLFxuICBjb250YWN0Q29udHJvbGxlci5nZXRNZXNzYWdlcyxcbik7XG5cbi8vIDMuIE1hcmsgcmVzb2x2ZWQvdW5yZXNvbHZlZCByb3V0ZSAoYWRtaW4gb25seSlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBjb250YWN0VmFsaWRhdGlvbnMuY29udGFjdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBjb250YWN0VmFsaWRhdGlvbnMudXBkYXRlUmVzb2x2ZWRTY2hlbWEsXG4gIH0pLFxuICBjb250YWN0Q29udHJvbGxlci51cGRhdGVSZXNvbHZlZCxcbik7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgY29udGFjdFNlcnZpY2UgfSBmcm9tIFwiLi9jb250YWN0LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgY29udGFjdCBtZXNzYWdlIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGNyZWF0ZU1lc3NhZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgY29udGFjdFNlcnZpY2UuY3JlYXRlTWVzc2FnZShyZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJNZXNzYWdlIHNlbnQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbWVzc2FnZSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyBjb250cm9sbGVyIChhZG1pbiBvbmx5KVxuY29uc3QgZ2V0TWVzc2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb250YWN0U2VydmljZS5saXN0TWVzc2FnZXMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDb250YWN0IG1lc3NhZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gTWFyayByZXNvbHZlZC91bnJlc29sdmVkIGNvbnRyb2xsZXIgKGFkbWluIG9ubHkpXG5jb25zdCB1cGRhdGVSZXNvbHZlZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHsgaXNSZXNvbHZlZCB9ID0gcmVxLmJvZHk7XG5cbiAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgY29udGFjdFNlcnZpY2UucmVzb2x2ZU1lc3NhZ2UoaWQsIGlzUmVzb2x2ZWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIk1lc3NhZ2Ugc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbWVzc2FnZSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBjb250YWN0Q29udHJvbGxlciA9IHtcbiAgY3JlYXRlTWVzc2FnZSxcbiAgZ2V0TWVzc2FnZXMsXG4gIHVwZGF0ZVJlc29sdmVkLFxufTsiLCAiaW1wb3J0IHsgUmVzZW5kIH0gZnJvbSBcInJlc2VuZFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cyB9IGZyb20gXCIuLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGFjdEVtYWlsRGV0YWlscyB7XG4gIG5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgc3ViamVjdDogc3RyaW5nO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGNyZWF0ZWRBdD86IERhdGU7XG59XG5cbi8vIExhemlseSBpbml0aWFsaXNlZCBzbyB0aGUgbW9kdWxlIGlzIGltcG9ydGFibGUgZXZlbiB3aGVuIFJFU0VORF9BUElfS0VZXG4vLyBpcyBub3QgY29uZmlndXJlZCAoZS5nLiBsb2NhbCBkZXYgLyBkZW1vIHdpdGhvdXQgZW1haWwpLlxubGV0IHJlc2VuZDogUmVzZW5kIHwgbnVsbCA9IG51bGw7XG5cbmZ1bmN0aW9uIGdldFJlc2VuZCgpOiBSZXNlbmQgfCBudWxsIHtcbiAgaWYgKHJlc2VuZCkgcmV0dXJuIHJlc2VuZDtcbiAgaWYgKCFjb25maWcucmVzZW5kX2FwaV9rZXkpIHJldHVybiBudWxsO1xuICByZXNlbmQgPSBuZXcgUmVzZW5kKGNvbmZpZy5yZXNlbmRfYXBpX2tleSk7XG4gIHJldHVybiByZXNlbmQ7XG59XG5cbmZ1bmN0aW9uIGVzY2FwZUh0bWwodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcbiAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIilcbiAgICAucmVwbGFjZSgvXCIvZywgXCImcXVvdDtcIilcbiAgICAucmVwbGFjZSgvJy9nLCBcIiYjMDM5O1wiKTtcbn1cblxuLy8gV3JhcHMgYSBSZXNlbmQgc2VuZCBzbyBmYWlsdXJlcyBiZWNvbWUgYSBzaW5nbGUgY2xlYW4gd2FybmluZyBsaW5lIGluc3RlYWRcbi8vIG9mIHRoZSBTREsncyBub2lzeSBtdWx0aS1saW5lIGVycm9yLiBSZXNlbmQgY2FuIGxlZ2l0aW1hdGVseSByZWplY3Qgc2VuZHNcbi8vIChlLmcuIHRoZSBkZWZhdWx0IG9uYm9hcmRpbmdAcmVzZW5kLmRldiBzZW5kZXIgbWF5IG9ubHkgZGVsaXZlciB0byB0aGVcbi8vIGFjY291bnQgb3duZXIpLCBzbyBlbWFpbHMgYXJlIHN0cmljdGx5IGJlc3QtZWZmb3J0LlxuYXN5bmMgZnVuY3Rpb24gc2VuZFdpdGhMb2coXG4gIGNsaWVudDogUmVzZW5kLFxuICBzdWJqZWN0OiBzdHJpbmcsXG4gIHRvOiBzdHJpbmdbXSxcbiAgaHRtbDogc3RyaW5nLFxuICByZXBseVRvPzogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgY2xpZW50LmVtYWlscy5zZW5kKHtcbiAgICAgIGZyb206IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCIsXG4gICAgICB0byxcbiAgICAgIHN1YmplY3QsXG4gICAgICBodG1sLFxuICAgICAgLi4uKHJlcGx5VG8gPyB7IHJlcGx5VG8gfSA6IHt9KSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zdCBkZXRhaWwgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgY29uc29sZS53YXJuKGBbZW1haWxdIHNlbmQgZmFpbGVkICgke3N1YmplY3R9KSB0byAke3RvLmpvaW4oXCIsIFwiKX06ICR7ZGV0YWlsfWApO1xuICB9XG59XG5cbmNvbnN0IGVtYWlsTGF5b3V0ID0gKGNvbnRlbnQ6IHN0cmluZykgPT4gYFxuICA8ZGl2IHN0eWxlPVwiZm9udC1mYW1pbHk6IEFyaWFsLCBIZWx2ZXRpY2EsIHNhbnMtc2VyaWY7IG1heC13aWR0aDogNTYwcHg7IG1hcmdpbjogMCBhdXRvOyBjb2xvcjogIzFhMWExYTtcIj5cbiAgICA8ZGl2IHN0eWxlPVwiYmFja2dyb3VuZDogIzBmNzY2ZTsgcGFkZGluZzogMjRweDsgYm9yZGVyLXJhZGl1czogOHB4IDhweCAwIDA7XCI+XG4gICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAjZmZmZmZmOyBmb250LXNpemU6IDE4cHg7IGZvbnQtd2VpZ2h0OiBib2xkO1wiPlRyaXBWZXJzZTwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IHN0eWxlPVwiYm9yZGVyOiAxcHggc29saWQgI2U1ZTdlYjsgYm9yZGVyLXRvcDogbm9uZTsgcGFkZGluZzogMzJweDsgYm9yZGVyLXJhZGl1czogMCAwIDhweCA4cHg7XCI+XG4gICAgICAke2NvbnRlbnR9XG4gICAgPC9kaXY+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDEycHg7IGNvbG9yOiAjNmI3MjgwOyBtYXJnaW4tdG9wOiAxNnB4OyB0ZXh0LWFsaWduOiBjZW50ZXI7XCI+XG4gICAgICBZb3UgYXJlIHJlY2VpdmluZyB0aGlzIGVtYWlsIGJlY2F1c2Ugb2YgYWN0aXZpdHkgb24gVHJpcFZlcnNlLlxuICAgIDwvcD5cbiAgPC9kaXY+XG5gO1xuXG4vLyBOb3RpZmllcyB0aGUgc3VwcG9ydCBpbmJveCBhYm91dCBhIG5ldyBjb250YWN0IGZvcm0gc3VibWlzc2lvbi5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbiA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBjb250YWN0IG5vdGlmaWNhdGlvbi5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgY3JlYXRlZEF0ID0gZGV0YWlscy5jcmVhdGVkQXQ/LnRvSVNPU3RyaW5nKCkgPz8gXCJqdXN0IG5vd1wiO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPk5ldyBjb250YWN0IG1lc3NhZ2U8L2gyPlxuICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlOyBmb250LXNpemU6IDE0cHg7XCI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDsgd2lkdGg6IDEyMHB4O1wiPk5hbWU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+RW1haWw8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoZGV0YWlscy5lbWFpbCl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5TdWJqZWN0PC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5zdWJqZWN0KX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlJlY2VpdmVkPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGNyZWF0ZWRBdCl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgPC90YWJsZT5cbiAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDogMTZweDsgcGFkZGluZzogMTZweDsgYmFja2dyb3VuZDogI2Y5ZmFmYjsgYm9yZGVyLXJhZGl1czogNnB4OyB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7XCI+XG4gICAgICAke2VzY2FwZUh0bWwoZGV0YWlscy5tZXNzYWdlKX1cbiAgICA8L2Rpdj5cbiAgYDtcblxuICBhd2FpdCBzZW5kV2l0aExvZyhcbiAgICBjbGllbnQsXG4gICAgYE5ldyBjb250YWN0IG1lc3NhZ2U6ICR7ZGV0YWlscy5zdWJqZWN0fWAsXG4gICAgW2NvbmZpZy5jb250YWN0X3JlY2VpdmVyX2VtYWlsXSxcbiAgICBlbWFpbExheW91dChjb250ZW50KSxcbiAgKTtcbn07XG5cbi8vIFNlbmRzIGEgY29uZmlybWF0aW9uIHJlcGx5IHRvIHRoZSBwZXJzb24gd2hvIHN1Ym1pdHRlZCB0aGUgZm9ybS5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdEF1dG9SZXBseSA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGNvbnRhY3QgYXV0by1yZXBseS5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgcmVjZWl2ZXJFbWFpbCA9IGNvbmZpZy5jb250YWN0X3JlY2VpdmVyX2VtYWlsO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgPGgyIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZm9udC1zaXplOiAxOHB4O1wiPlRoYW5rcyBmb3IgcmVhY2hpbmcgb3V0LCAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0hPC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBXZSZhcG9zO3ZlIHJlY2VpdmVkIHlvdXIgbWVzc2FnZSBhYm91dFxuICAgICAgPHN0cm9uZz4mbGRxdW87JHtlc2NhcGVIdG1sKGRldGFpbHMuc3ViamVjdCl9JnJkcXVvOzwvc3Ryb25nPiBhbmQgb3VyIHN1cHBvcnRcbiAgICAgIHRlYW0gd2lsbCBnZXQgYmFjayB0byB5b3Ugd2l0aGluIG9uZSBidXNpbmVzcyBkYXkuXG4gICAgPC9wPlxuICBgO1xuXG4gIGF3YWl0IHNlbmRXaXRoTG9nKFxuICAgIGNsaWVudCxcbiAgICBcIldlIHJlY2VpdmVkIHlvdXIgbWVzc2FnZSAtIFRyaXBWZXJzZVwiLFxuICAgIFtkZXRhaWxzLmVtYWlsXSxcbiAgICBlbWFpbExheW91dChjb250ZW50KSxcbiAgICByZWNlaXZlckVtYWlsLFxuICApO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEJvb2tpbmcgZW1haWxzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGludGVyZmFjZSBJQm9va2luZ0VtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG4gIHRyYXZlbGVyczogbnVtYmVyO1xuICB0b3RhbFByaWNlOiBudW1iZXI7XG4gIHN0YXR1czogQm9va2luZ1N0YXR1cztcbn1cblxuLy8gSW5mb3JtcyB0aGUgY3VzdG9tZXIgYWJvdXQgYSBib29raW5nIGNyZWF0ZS9jb25maXJtL2NhbmNlbC5cbi8vIEJlc3QtZWZmb3J0IGxpa2UgdGhlIGNvbnRhY3QgZW1haWxzIFx1MjAxNCBhIGZhaWx1cmUgbXVzdCBuZXZlciBmYWlsIHRoZSByZXF1ZXN0LlxuZXhwb3J0IGNvbnN0IHNlbmRCb29raW5nRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElCb29raW5nRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhZGV0YWlscy5lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBib29raW5nIGVtYWlsLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB0cmF2ZWxEYXRlID0gZGV0YWlscy50cmF2ZWxEYXRlLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApO1xuXG4gIGNvbnN0IHN0YXR1c0NvcHk6IFJlY29yZDxcbiAgICBCb29raW5nU3RhdHVzLFxuICAgIHsgc3ViamVjdDogc3RyaW5nOyBoZWFkaW5nOiBzdHJpbmc7IGJvZHk6IHN0cmluZyB9XG4gID4gPSB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuUEVORElOR106IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyByZWNlaXZlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJCb29raW5nIHJlY2VpdmVkXCIsXG4gICAgICBib2R5OiBcIldlJ3ZlIHJlY2VpdmVkIHlvdXIgYm9va2luZyByZXF1ZXN0LiBUaGUgYWdlbnQgd2lsbCBjb25maXJtIGl0IHNob3J0bHkuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5QQUlEXToge1xuICAgICAgc3ViamVjdDogXCJQYXltZW50IHJlY2VpdmVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIlBheW1lbnQgcmVjZWl2ZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciBwYXltZW50IGhhcyBiZWVuIHJlY2VpdmVkLCBhbmQgdGhlIGFnZW50IHdpbGwgY29uZmlybSB5b3VyIGJvb2tpbmcgc2hvcnRseS5cIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyBjb25maXJtZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyBjb25maXJtZWRcIixcbiAgICAgIGJvZHk6IFwiR3JlYXQgbmV3cyBcdTIwMTQgeW91ciBib29raW5nIGhhcyBiZWVuIGNvbmZpcm1lZC4gV2UgbG9vayBmb3J3YXJkIHRvIGhvc3RpbmcgeW91IVwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXToge1xuICAgICAgc3ViamVjdDogXCJCb29raW5nIGNhbmNlbGxlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJCb29raW5nIGNhbmNlbGxlZFwiLFxuICAgICAgYm9keTogXCJZb3VyIGJvb2tpbmcgaGFzIGJlZW4gY2FuY2VsbGVkLiBJZiB0aGlzIHdhc24ndCBleHBlY3RlZCwgcGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNPTVBMRVRFRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiVHJpcCBjb21wbGV0ZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiVHJpcCBjb21wbGV0ZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciB0cmlwIGhhcyBiZWVuIG1hcmtlZCBhcyBjb21wbGV0ZWQuIFRoYW5rIHlvdSBmb3IgdHJhdmVsbGluZyB3aXRoIFRyaXBWZXJzZSFcIixcbiAgICB9LFxuICB9O1xuXG4gIGNvbnN0IGNvcHkgPSBzdGF0dXNDb3B5W2RldGFpbHMuc3RhdHVzXTtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj4ke2NvcHkuaGVhZGluZ308L2gyPlxuICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxNHB4OyBsaW5lLWhlaWdodDogMS42OyBjb2xvcjogIzM3NDE1MTtcIj5cbiAgICAgIEhpICR7ZXNjYXBlSHRtbChkZXRhaWxzLm5hbWUpfSw8YnIvPlxuICAgICAgJHtjb3B5LmJvZHl9XG4gICAgPC9wPlxuICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlOyBmb250LXNpemU6IDE0cHg7XCI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDsgd2lkdGg6IDEyMHB4O1wiPlBhY2thZ2U8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLnBhY2thZ2VUaXRsZSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWwgZGF0ZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbCh0cmF2ZWxEYXRlKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRyYXZlbGVyczwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChTdHJpbmcoZGV0YWlscy50cmF2ZWxlcnMpKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlRvdGFsPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4mIzI1NDc7JHtlc2NhcGVIdG1sKGRldGFpbHMudG90YWxQcmljZS50b0ZpeGVkKDIpKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICA8L3RhYmxlPlxuICBgO1xuXG4gIGF3YWl0IHNlbmRXaXRoTG9nKFxuICAgIGNsaWVudCxcbiAgICBjb3B5LnN1YmplY3QsXG4gICAgW2RldGFpbHMuZW1haWxdLFxuICAgIGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICApO1xufTtcblxuLy8gSW5mb3JtcyB0aGUgY3VzdG9tZXIgdGhhdCBhIHBhaWQgYm9va2luZyB3YXMgY2FuY2VsbGVkIGFuZCB0aGUgcGF5bWVudCBoYXNcbi8vIGJlZW4gcmVmdW5kZWQuIEJlc3QtZWZmb3J0IGxpa2UgdGhlIG90aGVyIGVtYWlscy5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlZnVuZEVtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG4gIGFtb3VudDogbnVtYmVyO1xuICByZWZ1bmRSZWZJZD86IHN0cmluZyB8IG51bGw7XG59XG5cbmV4cG9ydCBjb25zdCBzZW5kUmVmdW5kRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElSZWZ1bmRFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIHJlZnVuZCBlbWFpbC5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgdHJhdmVsRGF0ZSA9IGRldGFpbHMudHJhdmVsRGF0ZS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKTtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5SZWZ1bmQgaXNzdWVkPC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBIaSAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0sPGJyLz5cbiAgICAgIFlvdXIgYm9va2luZyB3YXMgY2FuY2VsbGVkLCBhbmQgPHN0cm9uZz4mIzI1NDc7JHtlc2NhcGVIdG1sKFxuICAgICAgICBkZXRhaWxzLmFtb3VudC50b0ZpeGVkKDIpLFxuICAgICAgKX08L3N0cm9uZz4gaGFzIGJlZW4gcmVmdW5kZWQgdG8geW91ciBvcmlnaW5hbCBwYXltZW50IG1ldGhvZC4gUGxlYXNlIGFsbG93XG4gICAgICA1LTEwIGJ1c2luZXNzIGRheXMgZm9yIHRoZSBtb25leSB0byBhcHBlYXIuXG4gICAgPC9wPlxuICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlOyBmb250LXNpemU6IDE0cHg7XCI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDsgd2lkdGg6IDEyMHB4O1wiPlBhY2thZ2U8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChkZXRhaWxzLnBhY2thZ2VUaXRsZSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWwgZGF0ZTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbCh0cmF2ZWxEYXRlKX08L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlJlZnVuZGVkIGFtb3VudDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChkZXRhaWxzLmFtb3VudC50b0ZpeGVkKDIpKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgICR7ZGV0YWlscy5yZWZ1bmRSZWZJZFxuICAgICAgICA/IGBcbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPlJlZnVuZCByZWZlcmVuY2U8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoZGV0YWlscy5yZWZ1bmRSZWZJZCl9PC90ZD5cbiAgICAgIDwvdHI+YFxuICAgICAgICA6IFwiXCJ9XG4gICAgPC90YWJsZT5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTNweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICM2YjcyODA7IG1hcmdpbi10b3A6IDE2cHg7XCI+XG4gICAgICBJZiB5b3UgaGF2ZSBhbnkgcXVlc3Rpb25zIGFib3V0IHRoaXMgcmVmdW5kLCBwbGVhc2UgY29udGFjdCBzdXBwb3J0LlxuICAgIDwvcD5cbiAgYDtcblxuICBhd2FpdCBzZW5kV2l0aExvZyhcbiAgICBjbGllbnQsXG4gICAgXCJCb29raW5nIGNhbmNlbGxlZCAmIHJlZnVuZCBpc3N1ZWQgLSBUcmlwVmVyc2VcIixcbiAgICBbZGV0YWlscy5lbWFpbF0sXG4gICAgZW1haWxMYXlvdXQoY29udGVudCksXG4gICk7XG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQge1xuICBzZW5kQ29udGFjdEF1dG9SZXBseSxcbiAgc2VuZENvbnRhY3ROb3RpZmljYXRpb24sXG59IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgSUNvbnRhY3RRdWVyeSwgSUNyZWF0ZUNvbnRhY3RQYXlsb2FkIH0gZnJvbSBcIi4vY29udGFjdC5pbnRlcmZhY2VcIjtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSAocHVibGljKVxuY29uc3QgY3JlYXRlTWVzc2FnZSA9IGFzeW5jIChwYXlsb2FkOiBJQ3JlYXRlQ29udGFjdFBheWxvYWQpID0+IHtcbiAgY29uc3QgY3JlYXRlZE1lc3NhZ2UgPSBhd2FpdCBwcmlzbWEuY29udGFjdE1lc3NhZ2UuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICBuYW1lOiBwYXlsb2FkLm5hbWUsXG4gICAgICBlbWFpbDogcGF5bG9hZC5lbWFpbCxcbiAgICAgIHN1YmplY3Q6IHBheWxvYWQuc3ViamVjdCxcbiAgICAgIG1lc3NhZ2U6IHBheWxvYWQubWVzc2FnZSxcbiAgICB9LFxuICB9KTtcblxuICAvLyBFbWFpbHMgYXJlIGJlc3QtZWZmb3J0OiBhIGZhaWx1cmUgaGVyZSBtdXN0IG5ldmVyIGZhaWwgdGhlIHN1Ym1pc3Npb25cbiAgLy8gKHRoZSBtZXNzYWdlIGlzIGFscmVhZHkgc2F2ZWQgdG8gdGhlIGluYm94KS5cbiAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbih7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgICBzZW5kQ29udGFjdEF1dG9SZXBseSh7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIGNyZWF0ZWRNZXNzYWdlO1xufTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIChhZG1pbiBvbmx5LCBwYWdpbmF0ZWQsIGZpbHRlcmFibGUgYnkgaXNSZXNvbHZlZClcbmNvbnN0IGxpc3RNZXNzYWdlcyA9IGFzeW5jIChxdWVyeTogSUNvbnRhY3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VXaGVyZUlucHV0IHwgdW5kZWZpbmVkID1cbiAgICBxdWVyeS5pc1Jlc29sdmVkID09PSB1bmRlZmluZWRcbiAgICAgID8gdW5kZWZpbmVkXG4gICAgICA6IHsgaXNSZXNvbHZlZDogcXVlcnkuaXNSZXNvbHZlZCB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gMy4gTWFyayBhIGNvbnRhY3QgbWVzc2FnZSByZXNvbHZlZC91bnJlc29sdmVkIChhZG1pbiBvbmx5KVxuY29uc3QgcmVzb2x2ZU1lc3NhZ2UgPSBhc3luYyAoaWQ6IHN0cmluZywgaXNSZXNvbHZlZDogYm9vbGVhbikgPT4ge1xuICByZXR1cm4gcHJpc21hLmNvbnRhY3RNZXNzYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IGlzUmVzb2x2ZWQgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgY29udGFjdFNlcnZpY2UgPSB7XG4gIGNyZWF0ZU1lc3NhZ2UsXG4gIGxpc3RNZXNzYWdlcyxcbiAgcmVzb2x2ZU1lc3NhZ2UsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVNZXNzYWdlU2NoZW1hID0gei5vYmplY3Qoe1xuICBuYW1lOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAubWluKDIsIFwiTmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpLFxuICBlbWFpbDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFbWFpbCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5lbWFpbChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWwgYWRkcmVzc1wiKSxcbiAgc3ViamVjdDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJTdWJqZWN0IGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIlN1YmplY3QgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDIwMCwgXCJTdWJqZWN0IG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKSxcbiAgbWVzc2FnZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJNZXNzYWdlIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigxMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbGVhc3QgMTAgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMjAwMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbW9zdCAyMDAwIGNoYXJhY3RlcnNcIiksXG59KS5zdHJpY3QoKTtcblxuY29uc3QgY29udGFjdFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBpc1Jlc29sdmVkOiB6XG4gICAgLmVudW0oW1widHJ1ZVwiLCBcImZhbHNlXCJdKVxuICAgIC5vcHRpb25hbCgpXG4gICAgLnRyYW5zZm9ybSgodmFsKSA9PiAodmFsID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiB2YWwgPT09IFwidHJ1ZVwiKSksXG59KTtcblxuY29uc3QgY29udGFjdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTWVzc2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVSZXNvbHZlZFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgaXNSZXNvbHZlZDogei5ib29sZWFuKHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcImlzUmVzb2x2ZWQgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJpc1Jlc29sdmVkIG11c3QgYmUgYSBib29sZWFuXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiB0eXBlb2YgZGF0YS5pc1Jlc29sdmVkID09PSBcImJvb2xlYW5cIiwge1xuICAgIG1lc3NhZ2U6IFwiaXNSZXNvbHZlZCBtdXN0IGJlIGEgYm9vbGVhblwiLFxuICB9KTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlTWVzc2FnZVNjaGVtYSxcbiAgY29udGFjdFF1ZXJ5U2NoZW1hLFxuICBjb250YWN0UGFyYW1zU2NoZW1hLFxuICB1cGRhdGVSZXNvbHZlZFNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBib29raW5nQ29udHJvbGxlciB9IGZyb20gXCIuL2Jvb2tpbmcuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYm9va2luZ1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYm9va2luZy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBDcmVhdGUgYm9va2luZyAoY3VzdG9tZXIgb25seSBcdTIwMTQgYWdlbnRzIHNlbGwsIGFkbWlucyBtYW5hZ2UpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYm9va2luZ1ZhbGlkYXRpb25zLmNyZWF0ZVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuY3JlYXRlQm9va2luZyxcbik7XG5cbi8vIE15IGJvb2tpbmdzIFx1MjAxNCBvd24gYm9va2luZ3Mgd2l0aCBmaWx0ZXJzICsgcGFnaW5hdGlvbiAob3duZXIgaXMgYWx3YXlzIFVTRVIpXG4vLyBOT1RFOiByZWdpc3RlcmVkIGJlZm9yZSBcIi86aWRcIiBzbyB0aGUgcGFyYW0gcm91dGUgZG9lc24ndCBzd2FsbG93IGl0Llxucm91dGVyLmdldChcbiAgXCIvbXktYm9va2luZ3NcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0TXlCb29raW5ncyxcbik7XG5cbi8vIEFnZW50IGJvb2tpbmdzIFx1MjAxNCBzY29wZWQgdG8gcGFja2FnZXMgdGhlIGFnZW50IG93bnNcbnJvdXRlci5nZXQoXG4gIFwiL2FnZW50LWJvb2tpbmdzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBZ2VudEJvb2tpbmdzLFxuKTtcblxuLy8gQm9va2luZyBkZXRhaWwgXHUyMDE0IG93bmVyIC8gcGFja2FnZSBhZ2VudCAvIGFkbWluXG5yb3V0ZXIuZ2V0KFxuICBcIi86aWRcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRCb29raW5nRGV0YWlsLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IGFsbCBib29raW5nc1xucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBbGxCb29raW5ncyxcbik7XG5cbi8vIFN0YXR1cyB0cmFuc2l0aW9uIFx1MjAxNCB2YWxpZGF0ZWQgYWdhaW5zdCB0aGUgc3RhdGUgbWFjaGluZSBpbiB0aGUgc2VydmljZVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJvb2tpbmdWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBib29raW5nQ29udHJvbGxlci51cGRhdGVCb29raW5nU3RhdHVzLFxuKTtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBib29raW5nU2VydmljZSB9IGZyb20gXCIuL2Jvb2tpbmcuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbmNvbnN0IGNyZWF0ZUJvb2tpbmcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmNyZWF0ZUJvb2tpbmcodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJCb29raW5nIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldE15Qm9va2luZ3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0TXlCb29raW5ncyh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRBZ2VudEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEFnZW50Qm9va2luZ3ModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0Qm9va2luZ0RldGFpbCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEJvb2tpbmdEZXRhaWwoaWQsIHJlcS51c2VyISk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldEFsbEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0QWxsQm9va2luZ3MocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IHVwZGF0ZUJvb2tpbmdTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS51cGRhdGVCb29raW5nU3RhdHVzKFxuICAgICAgaWQsXG4gICAgICByZXEuYm9keSxcbiAgICAgIHJlcS51c2VyISxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmcgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBib29raW5nQ29udHJvbGxlciA9IHtcbiAgY3JlYXRlQm9va2luZyxcbiAgZ2V0TXlCb29raW5ncyxcbiAgZ2V0QWdlbnRCb29raW5ncyxcbiAgZ2V0Qm9va2luZ0RldGFpbCxcbiAgZ2V0QWxsQm9va2luZ3MsXG4gIHVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59OyIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5cbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZy9pbmRleFwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuLy8gUGF5bWVudCBpcyBhbiBvcHRpb25hbCBmZWF0dXJlOiB0aGUgQVBJIG11c3QgYm9vdCBhbmQgc2VydmUgZXZlcnl0aGluZyBlbHNlXG4vLyBldmVuIHdoZW4gdGhlIFNTTENvbW1lcnogc3RvcmUgaXNuJ3QgY29uZmlndXJlZCB5ZXQuIFRoZXNlIHRocm93IGEgY2xlYW4gNDAwXG4vLyBvbiB0aGUgcGF5bWVudC1vbmx5IHBhdGhzIHJhdGhlciB0aGFuIGNyYXNoIHRoZSB3aG9sZSBkZXBsb3ltZW50IGF0IGJvb3QuXG5jb25zdCByZXF1aXJlQ29uZmlnID0gKCkgPT4ge1xuICBpZiAoIWNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9pZCB8fCAhY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJTU0xDb21tZXJ6IGlzIG5vdCBjb25maWd1cmVkLiBTZXQgU1NMX0NPTU1FUlpfU1RPUkVfSUQgYW5kIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELlwiLFxuICAgICk7XG4gIH1cbiAgaWYgKCFjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJTU0xDb21tZXJ6IGlzIG5vdCBjb25maWd1cmVkLiBTZXQgQkFDS0VORF9QVUJMSUNfVVJMIHRvIHRoZSBwdWJsaWNseSByZWFjaGFibGUgYmFja2VuZCBVUkwuXCIsXG4gICAgKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHN0b3JlSWQ6IGNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9pZCxcbiAgICBzdG9yZVBhc3N3b3JkOiBjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfcGFzc3dvcmQsXG4gIH07XG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpJbml0UmVzdWx0IHtcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGZhaWxlZHJlYXNvbj86IHN0cmluZztcbiAgc2Vzc2lvbmtleT86IHN0cmluZztcbiAgR2F0ZXdheVBhZ2VVUkw/OiBzdHJpbmc7XG4gIFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCB7XG4gIHN0YXR1czogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbiAgdmFsX2lkPzogc3RyaW5nO1xuICBhbW91bnQ/OiBzdHJpbmc7XG4gIGN1cnJlbmN5Pzogc3RyaW5nO1xuICBiYW5rX3RyYW5faWQ/OiBzdHJpbmc7XG4gIGNhcmRfdHlwZT86IHN0cmluZztcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQge1xuICBBUElDb25uZWN0Pzogc3RyaW5nO1xuICBzdGF0dXM/OiBzdHJpbmc7IC8vIHN1Y2Nlc3MgfCBmYWlsZWQgfCBwcm9jZXNzaW5nXG4gIGVycm9yUmVhc29uPzogc3RyaW5nO1xuICByZWZ1bmRfcmVmX2lkPzogc3RyaW5nO1xuICBiYW5rX3RyYW5faWQ/OiBzdHJpbmc7XG4gIHRyYW5zX2lkPzogc3RyaW5nO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbi8vIFNTTENvbW1lcnogdHJ1bmNhdGVzIHRyYW5faWQgdG8gMzAgY2hhcnMgXHUyMDE0IGRhdGUgKyB0aW1lICsgcmFuZG9tIHNhbHQgc3RheXMgc2FmZWx5IHVuZGVyLlxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlVHJhbklkKCk6IHN0cmluZyB7XG4gIHJldHVybiBgVFJOWF9JRC0ke0RhdGUubm93KCl9LSR7cmFuZG9tVVVJRCgpLnJlcGxhY2UoLy0vZywgXCJcIikuc2xpY2UoMCwgOCl9YDtcbn1cblxuLy8gSW5pdGlhdGVzIGEgZ2F0ZXdheSBzZXNzaW9uLiBTZXJ2ZXItdG8tc2VydmVyIFBPU1QsIGZvcm0tZW5jb2RlZC4gVGhlIGdhdGV3YXlcbi8vIHJlc3BvbmRzIHdpdGggdGhlIGhvc3RlZCBjaGVja291dCBVUkwgKEdhdGV3YXlQYWdlVVJMKSB0aGUgY3VzdG9tZXIgaXMgc2VudCB0by5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6SW5pdChvcHRpb25zOiB7XG4gIHRvdGFsX2Ftb3VudDogbnVtYmVyO1xuICB0cmFuX2lkOiBzdHJpbmc7XG4gIHN1Y2Nlc3NfdXJsOiBzdHJpbmc7XG4gIGZhaWxfdXJsOiBzdHJpbmc7XG4gIGNhbmNlbF91cmw6IHN0cmluZztcbiAgaXBuX3VybDogc3RyaW5nO1xuICBjdXNfbmFtZTogc3RyaW5nO1xuICBjdXNfZW1haWw6IHN0cmluZztcbiAgY3VzX3Bob25lOiBzdHJpbmc7XG59KTogUHJvbWlzZTxTc2xjb21tZXJ6SW5pdFJlc3VsdD4ge1xuICBjb25zdCB7IHN0b3JlSWQsIHN0b3JlUGFzc3dvcmQgfSA9IHJlcXVpcmVDb25maWcoKTtcbiAgY29uc3QgYm9keSA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICB0b3RhbF9hbW91bnQ6IG9wdGlvbnMudG90YWxfYW1vdW50LnRvRml4ZWQoMiksXG4gICAgY3VycmVuY3k6IFwiQkRUXCIsXG4gICAgdHJhbl9pZDogb3B0aW9ucy50cmFuX2lkLFxuICAgIHN1Y2Nlc3NfdXJsOiBvcHRpb25zLnN1Y2Nlc3NfdXJsLFxuICAgIGZhaWxfdXJsOiBvcHRpb25zLmZhaWxfdXJsLFxuICAgIGNhbmNlbF91cmw6IG9wdGlvbnMuY2FuY2VsX3VybCxcbiAgICBpcG5fdXJsOiBvcHRpb25zLmlwbl91cmwsXG4gICAgY3VzX25hbWU6IG9wdGlvbnMuY3VzX25hbWUsXG4gICAgY3VzX2VtYWlsOiBvcHRpb25zLmN1c19lbWFpbCxcbiAgICBjdXNfYWRkMTogXCJOL0FcIixcbiAgICBjdXNfYWRkMjogXCJOL0FcIixcbiAgICBjdXNfY2l0eTogXCJOL0FcIixcbiAgICBjdXNfc3RhdGU6IFwiTi9BXCIsXG4gICAgY3VzX3Bvc3Rjb2RlOiBcIjEwMDBcIixcbiAgICBjdXNfY291bnRyeTogXCJCYW5nbGFkZXNoXCIsXG4gICAgY3VzX3Bob25lOiBvcHRpb25zLmN1c19waG9uZSxcbiAgICBwcm9kdWN0X25hbWU6IFwiVHJpcFZlcnNlIFRvdXIgQm9va2luZ1wiLFxuICAgIHNoaXBwaW5nX21ldGhvZDogXCJOT1wiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChjb25maWcuc3NsY29tbWVyel9pbml0X3VybCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIH0sXG4gICAgYm9keTogYm9keS50b1N0cmluZygpLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IGluaXQgZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IGluaXQgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuXG4gIC8vIFRoZSBnYXRld2F5IHJlcG9ydHMgc3RhdHVzIGluIFVQUEVSQ0FTRSAoXCJTVUNDRVNTXCIgLyBcIkZBSUxFRFwiKTsgYW55IG90aGVyXG4gIC8vIHN0YXR1cywgb3IgYSBzdWNjZXNzIHdpdGhvdXQgdGhlIGhvc3RlZCBjaGVja291dCBVUkwsIGlzIGEgZmFpbGVkIGluaXQuXG4gIGlmIChkYXRhLnN0YXR1cyAhPT0gXCJTVUNDRVNTXCIgfHwgIWRhdGEuR2F0ZXdheVBhZ2VVUkwpIHtcbiAgICBjb25zdCByZWFzb24gPSBkYXRhLmZhaWxlZHJlYXNvbiB8fCBkYXRhLnN0YXR1cyB8fCBcInVua25vd25cIjtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtzc2xjb21tZXJ6XSBpbml0IHJlamVjdGVkICh1cmw9JHtjb25maWcuc3NsY29tbWVyel9pbml0X3VybH0sIHNhbmRib3g9JHtjb25maWcuc3NsX2NvbW1lcnpfc2FuZGJveH0pOiAke3JlYXNvbn1gLFxuICAgICAgZGF0YSxcbiAgICApO1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDUwMixcbiAgICAgIGBTU0xDb21tZXJ6IGluaXQgcmVqZWN0ZWQ6ICR7cmVhc29ufS4gQ2hlY2sgU1NMX0NPTU1FUlpfU1RPUkVfSUQsIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELCBTU0xfQ09NTUVSWl9TQU5EQk9YIGFuZCBTU0xDT01NRVJaX0lOSVRfVVJMIChzZWUgc2VydmVyIGxvZ3MpLmAsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn1cblxuLy8gU2VydmVyLXNpZGUgdmVyaWZpY2F0aW9uIG9mIGEgY29tcGxldGVkIHRyYW5zYWN0aW9uLiBzdGF0dXM6IFZBTElEIC8gVkFMSURBVEVEIC9cbi8vIElOVkFMSURfVFJBTlNBQ1RJT04gLyBGQUlMRUQuIFZBTElEQVRFRCBtZWFucyB0aGUgdHJhbnNhY3Rpb24gd2FzIHZlcmlmaWVkIGJlZm9yZVxuLy8gKGlkZW1wb3RlbnQpLCBJTlZBTElEX1RSQU5TQUNUSU9OIG1lYW5zIHRoZSBhbW91bnQvdHJhbnNhY3Rpb24gbWlzbWF0Y2hlcy5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6VmFsaWRhdGUob3B0aW9uczoge1xuICB2YWxfaWQ6IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0PiB7XG4gIGNvbnN0IHsgc3RvcmVJZCwgc3RvcmVQYXNzd29yZCB9ID0gcmVxdWlyZUNvbmZpZygpO1xuICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICB2YWxfaWQ6IG9wdGlvbnMudmFsX2lkLFxuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICBmb3JtYXQ6IFwianNvblwiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHtjb25maWcuc3NsY29tbWVyel92YWxpZGF0ZV91cmx9PyR7cGFyYW1zLnRvU3RyaW5nKCl9YCwge1xuICAgIG1ldGhvZDogXCJHRVRcIixcbiAgfSk7XG5cbiAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBgU1NMQ29tbWVyeiB2YWxpZGF0aW9uIGZhaWxlZCAoJHtyZXMuc3RhdHVzfSlgKTtcblxuICBsZXQgZGF0YTogU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ7XG4gIHRyeSB7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UodGV4dCkgYXMgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIFwiU1NMQ29tbWVyeiB2YWxpZGF0aW9uIHJldHVybmVkIGEgbm9uLUpTT04gcmVzcG9uc2VcIik7XG4gIH1cbiAgcmV0dXJuIGRhdGE7XG59XG5cbi8vIEluaXRpYXRlcyBhIHJlZnVuZCBhZ2FpbnN0IGEgc2V0dGxlZCB0cmFuc2FjdGlvbi4gYmFua190cmFuX2lkIGlzIHRoZVxuLy8gb3JpZ2luYWwgdHJhbnNhY3Rpb24ncyBiYW5rIHRyYW5zYWN0aW9uIElEIGNhcHR1cmVkIGF0IHBheW1lbnQgdGltZS5cbi8vIHN0YXR1czogc3VjY2VzcyAoaW5pdGlhdGVkKSB8IGZhaWxlZCB8IHByb2Nlc3NpbmcgKGFscmVhZHkgaW5pdGlhdGVkKS5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6UmVmdW5kKG9wdGlvbnM6IHtcbiAgYmFua190cmFuX2lkOiBzdHJpbmc7XG4gIHJlZnVuZF9hbW91bnQ6IG51bWJlcjtcbiAgcmVmdW5kX3JlbWFya3M6IHN0cmluZztcbiAgcmVmZV9pZD86IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ+IHtcbiAgY29uc3QgeyBzdG9yZUlkLCBzdG9yZVBhc3N3b3JkIH0gPSByZXF1aXJlQ29uZmlnKCk7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIGJhbmtfdHJhbl9pZDogb3B0aW9ucy5iYW5rX3RyYW5faWQsXG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIHJlZnVuZF9hbW91bnQ6IG9wdGlvbnMucmVmdW5kX2Ftb3VudC50b0ZpeGVkKDIpLFxuICAgIHJlZnVuZF9yZW1hcmtzOiBvcHRpb25zLnJlZnVuZF9yZW1hcmtzLFxuICAgIGZvcm1hdDogXCJqc29uXCIsXG4gICAgdjogXCIxXCIsXG4gIH0pO1xuICBpZiAob3B0aW9ucy5yZWZlX2lkKSBwYXJhbXMuc2V0KFwicmVmZV9pZFwiLCBvcHRpb25zLnJlZmVfaWQpO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2NvbmZpZy5zc2xjb21tZXJ6X3JlZnVuZF91cmx9PyR7cGFyYW1zLnRvU3RyaW5nKCl9YCwge1xuICAgIG1ldGhvZDogXCJHRVRcIixcbiAgfSk7XG5cbiAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBgU1NMQ29tbWVyeiByZWZ1bmQgZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6UmVmdW5kUmVzdWx0O1xuICB0cnkge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKHRleHQpIGFzIFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIFwiU1NMQ29tbWVyeiByZWZ1bmQgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn0iLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzLCBQYWNrYWdlU3RhdHVzLCBQYXltZW50U3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc3NsY29tbWVyelJlZnVuZCB9IGZyb20gXCIuLi8uLi9saWIvc3NsY29tbWVyelwiO1xuaW1wb3J0IHsgc2VuZEJvb2tpbmdFbWFpbCwgc2VuZFJlZnVuZEVtYWlsIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQge1xuICBJQm9va2luZ1F1ZXJ5LFxuICBJQm9va2luZ1NlYXJjaFF1ZXJ5LFxuICBJQ3JlYXRlQm9va2luZyxcbiAgSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59IGZyb20gXCIuL2Jvb2tpbmcuaW50ZXJmYWNlXCI7XG5cbi8vIEEgUEVORElORyBib29raW5nIG9sZGVyIHRoYW4gdGhpcyBpcyB0cmVhdGVkIGFzIGFuIGFiYW5kb25lZCBjaGVja291dDpcbi8vIGl0J3MgYXV0by1jYW5jZWxsZWQgc28gdGhlIHVzZXIgY2FuIHJlYm9vayB0aGUgc2FtZSBwYWNrYWdlK2RhdGUuXG5jb25zdCBTVEFMRV9CT09LSU5HX0hPVVJTID0gMjQ7XG5cbmNvbnN0IHRvVVRDTWlkbmlnaHQgPSAoZGF0ZTogRGF0ZSkgPT5cbiAgbmV3IERhdGUoXG4gICAgRGF0ZS5VVEMoZGF0ZS5nZXRVVENGdWxsWWVhcigpLCBkYXRlLmdldFVUQ01vbnRoKCksIGRhdGUuZ2V0VVRDRGF0ZSgpKSxcbiAgKTtcblxuLy8gXHUyNTAwXHUyNTAwIEFjdG9yICsgb3duZXJzaGlwIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxudHlwZSBCb29raW5nQWN0b3IgPSB7IGlkOiBzdHJpbmc7IHJvbGU6IFJvbGUgfTtcblxuLy8gU3RydWN0dXJhbCBzdWJzZXQgXHUyMDE0IG9ubHkgd2hhdCB0aGUgb3duZXJzaGlwIGNoZWNrcyBuZWVkLlxudHlwZSBCb29raW5nT3duZXJJbmZvID0ge1xuICB1c2VySWQ6IHN0cmluZztcbiAgcGFja2FnZTogeyBhZ2VudElkOiBzdHJpbmcgfTtcbn07XG5cbi8vIEJvb2tpbmcgb3duZXIsIHRoZSBBR0VOVCB3aG8gb3ducyB0aGUgcGFja2FnZSwgb3IgQURNSU4gXHUyMDE0IGZ1bGwgbWFuYWdlIHNjb3BlLlxuY29uc3QgY2FuTWFuYWdlID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGJvb2tpbmcudXNlcklkID09PSBhY3Rvci5pZCB8fFxuICAoYWN0b3Iucm9sZSA9PT0gUm9sZS5BR0VOVCAmJiBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWQpIHx8XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU47XG5cbi8vIE9ubHkgdGhlIHBhY2thZ2Utb3duaW5nIEFHRU5UIG9yIEFETUlOIGNhbiBtb3ZlIGEgYm9va2luZydzIG1vbmV5IHN0YXR1c1xuLy8gKFBFTkRJTkdcdTIxOTJDT05GSVJNRUQsIENPTkZJUk1FRFx1MjE5MkNPTVBMRVRFRCwgQ09ORklSTUVEXHUyMTkyUEVORElORykuXG5jb25zdCBpc0FnZW50T3duZXJPckFkbWluID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU4gfHxcbiAgKGFjdG9yLnJvbGUgPT09IFJvbGUuQUdFTlQgJiYgYm9va2luZy5wYWNrYWdlLmFnZW50SWQgPT09IGFjdG9yLmlkKTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXRlIG1hY2hpbmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG50eXBlIFRyYW5zaXRpb25SdWxlID0ge1xuICBhbGxvd2VkOiAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT4gYm9vbGVhbjtcbiAgcmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkPzogYm9vbGVhbjtcbiAgYmVmb3JlVHJhdmVsRGF0ZT86IGJvb2xlYW47XG59O1xuXG5jb25zdCBUUkFOU0lUSU9OUzogUGFydGlhbDxcbiAgUmVjb3JkPEJvb2tpbmdTdGF0dXMsIFBhcnRpYWw8UmVjb3JkPEJvb2tpbmdTdGF0dXMsIFRyYW5zaXRpb25SdWxlPj4+XG4+ID0ge1xuICBbQm9va2luZ1N0YXR1cy5QRU5ESU5HXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHsgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbiB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHsgYWxsb3dlZDogY2FuTWFuYWdlIH0sXG4gIH0sXG4gIFtCb29raW5nU3RhdHVzLlBBSURdOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXTogeyBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXTogeyBhbGxvd2VkOiBjYW5NYW5hZ2UgfSxcbiAgfSxcbiAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTVBMRVRFRF06IHtcbiAgICAgIGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4sXG4gICAgICByZXF1aXJlc1RyYXZlbERhdGVQYXNzZWQ6IHRydWUsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7IGFsbG93ZWQ6IGNhbk1hbmFnZSB9LFxuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluLFxuICAgICAgYmVmb3JlVHJhdmVsRGF0ZTogdHJ1ZSxcbiAgICB9LFxuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlc3BvbnNlIG1hcHBpbmcgKERlY2ltYWwgXHUyMTkyIE51bWJlcikgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBib29raW5nUGFja2FnZVNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdGl0bGU6IHRydWUsXG4gICAgc2x1ZzogdHJ1ZSxcbiAgICBsb2NhdGlvbjogdHJ1ZSxcbiAgICBpbWFnZXM6IHRydWUsXG4gICAgcHJpY2U6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG4vLyBEZXRhaWwgdmlldyBhZGRzIGFnZW50SWQgKG5lZWRlZCBieSBvd25lcnNoaXAgY2hlY2tzIGluIHRoZSBzZXJ2aWNlKS5cbmNvbnN0IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0aXRsZTogdHJ1ZSxcbiAgICBzbHVnOiB0cnVlLFxuICAgIGxvY2F0aW9uOiB0cnVlLFxuICAgIGltYWdlczogdHJ1ZSxcbiAgICBwcmljZTogdHJ1ZSxcbiAgICBhZ2VudElkOiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxuY29uc3QgYm9va2luZ1VzZXJTZWxlY3QgPSB7XG4gIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnQgbGVkZ2VyIHNob3duIG9uIHRoZSBib29raW5nIGRldGFpbCBwYWdlIChhbW91bnRzIHN0YXkgRGVjaW1hbCBpbiBEQikuXG5jb25zdCBib29raW5nUGF5bWVudFNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdHJhbklkOiB0cnVlLFxuICAgIGFtb3VudDogdHJ1ZSxcbiAgICBjdXJyZW5jeTogdHJ1ZSxcbiAgICBzdGF0dXM6IHRydWUsXG4gICAgY2FyZFR5cGU6IHRydWUsXG4gICAgYmFua1RyYW5JZDogdHJ1ZSxcbiAgICB2YWxJZDogdHJ1ZSxcbiAgICBwYWlkQXQ6IHRydWUsXG4gICAgcmVmdW5kUmVmSWQ6IHRydWUsXG4gICAgcmVmdW5kZWRBdDogdHJ1ZSxcbiAgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnRzIG9yZGVyZWQgbmV3ZXN0LWZpcnN0IHNvIGNvbnN1bWVycyBjYW4gcmVseSBvbiBwYXltZW50c1swXSBiZWluZyB0aGVcbi8vIGxhdGVzdCBhdHRlbXB0ICh1c2VkIGZvciB0aGUgdXNlciBwYXltZW50LWhpc3RvcnkgXCJsYXRlc3Qgc3RhdHVzXCIgcm93KS5cbmNvbnN0IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgPSB7XG4gIC4uLmJvb2tpbmdQYXltZW50U2VsZWN0LFxuICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgYXMgY29uc3QgfSxcbn0gYXMgY29uc3Q7XG5cbnR5cGUgQm9va2luZ1dpdFBhY2thZ2UgPSBQcmlzbWEuQm9va2luZ0dldFBheWxvYWQ8e1xuICBpbmNsdWRlOiB7IHBhY2thZ2U6IHR5cGVvZiBib29raW5nUGFja2FnZVNlbGVjdCB9O1xufT47XG5cbi8vIFBheW1lbnRzIHNob3cgb24gbGlzdCByb3dzIHRvbyAoRG9EOiBcImxpc3QvZGV0YWlsIG5vdyBpbmNsdWRlcyBwYXltZW50c1wiKSxcbi8vIG1hcHBlZCB0byBOdW1iZXIgYXQgdGhlIGJvdW5kYXJ5IGxpa2UgdGhlIHJlc3Qgb2YgdGhlIG1vbmV5IGZpZWxkcy5cbnR5cGUgQm9va2luZ1BheW1lbnRJdGVtID0ge1xuICBpZDogc3RyaW5nO1xuICB0cmFuSWQ6IHN0cmluZztcbiAgYW1vdW50OiB1bmtub3duO1xuICBjdXJyZW5jeTogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgY2FyZFR5cGU6IHN0cmluZyB8IG51bGw7XG4gIGJhbmtUcmFuSWQ6IHN0cmluZyB8IG51bGw7XG4gIHZhbElkOiBzdHJpbmcgfCBudWxsO1xuICBwYWlkQXQ6IERhdGUgfCBudWxsO1xufTtcblxuY29uc3QgbWFwQm9va2luZ0xpc3QgPSAoYm9va2luZzogQm9va2luZ1dpdFBhY2thZ2UgJiB7IHBheW1lbnRzPzogQm9va2luZ1BheW1lbnRJdGVtW10gfSkgPT4gKHtcbiAgLi4uYm9va2luZyxcbiAgdG90YWxQcmljZTogTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSksXG4gIHBhY2thZ2U6IHsgLi4uYm9va2luZy5wYWNrYWdlLCBwcmljZTogTnVtYmVyKGJvb2tpbmcucGFja2FnZS5wcmljZSkgfSxcbiAgcGF5bWVudHM6IGJvb2tpbmcucGF5bWVudHM/Lm1hcCgocCkgPT4gKHsgLi4ucCwgYW1vdW50OiBOdW1iZXIocC5hbW91bnQpIH0pKSxcbn0pO1xuXG4vLyBcdTI1MDBcdTI1MDAgQ3JlYXRlIGJvb2tpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBjcmVhdGVCb29raW5nID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBJQ3JlYXRlQm9va2luZykgPT4ge1xuICBjb25zdCB7IHBhY2thZ2VJZCwgdHJhdmVsZXJzIH0gPSBwYXlsb2FkO1xuICBjb25zdCB0cmF2ZWxEYXRlID0gdG9VVENNaWRuaWdodChwYXlsb2FkLnRyYXZlbERhdGUpO1xuXG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG4gIGlmIChcbiAgICAhdG91clBhY2thZ2UgfHxcbiAgICB0b3VyUGFja2FnZS5pc0RlbGV0ZWQgfHxcbiAgICB0b3VyUGFja2FnZS5zdGF0dXMgIT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJQYWNrYWdlIGlzIG5vdCBhdmFpbGFibGUgZm9yIGJvb2tpbmcuXCIpO1xuICB9XG5cbiAgLy8gdG90YWxQcmljZSBpcyBjb21wdXRlZCBzZXJ2ZXItc2lkZSBmcm9tIHRoZSBwYWNrYWdlJ3MgY3VycmVudCBwcmljZSBcdTIwMTRcbiAgLy8gYW55dGhpbmcgdGhlIGNsaWVudCBzZW5kcyBpcyBpZ25vcmVkLlxuICBjb25zdCB0b3RhbFByaWNlID0gTnVtYmVyKHRvdXJQYWNrYWdlLnByaWNlKSAqIHRyYXZlbGVycztcblxuICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHR4LmJvb2tpbmcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkLFxuICAgICAgICB0cmF2ZWxEYXRlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZykge1xuICAgICAgY29uc3QgaXNSZWNlbnQgPVxuICAgICAgICBleGlzdGluZy5jcmVhdGVkQXQuZ2V0VGltZSgpID49XG4gICAgICAgIERhdGUubm93KCkgLSBTVEFMRV9CT09LSU5HX0hPVVJTICogNjAgKiA2MCAqIDEwMDA7XG5cbiAgICAgIGlmIChpc1JlY2VudCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgNDA5LFxuICAgICAgICAgIFwiWW91IGFscmVhZHkgaGF2ZSBhIHBlbmRpbmcgYm9va2luZyBmb3IgdGhpcyBwYWNrYWdlIG9uIHRoaXMgZGF0ZS5cIixcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgLy8gYWJhbmRvbmVkIGNoZWNrb3V0IFx1MjAxNCBjYW5jZWwgaXQgaW4gdGhlIHNhbWUgdHJhbnNhY3Rpb24gYW5kIHJlYm9va1xuICAgICAgYXdhaXQgdHguYm9va2luZy51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogZXhpc3RpbmcuaWQgfSxcbiAgICAgICAgZGF0YTogeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHguYm9va2luZy5jcmVhdGUoe1xuICAgICAgZGF0YTogeyB1c2VySWQsIHBhY2thZ2VJZCwgdHJhdmVsRGF0ZSwgdHJhdmVsZXJzLCB0b3RhbFByaWNlIH0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IGVtYWlsIFx1MjAxNCBuZXZlciBmYWlscyB0aGUgcmVxdWVzdFxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9LFxuICB9KTtcbiAgaWYgKHVzZXIpIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgICAgcGFja2FnZVRpdGxlOiB0b3VyUGFja2FnZS50aXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZSxcbiAgICAgICAgdHJhdmVsZXJzLFxuICAgICAgICB0b3RhbFByaWNlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAuLi5jcmVhdGVkLFxuICAgIHRvdGFsUHJpY2U6IE51bWJlcihjcmVhdGVkLnRvdGFsUHJpY2UpLFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIExpc3QgaGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHBhZ2luYXRlQm9va2luZyA9IGFzeW5jIChcbiAgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCxcbiAgaW5jbHVkZTogUHJpc21hLkJvb2tpbmdJbmNsdWRlLFxuICBxdWVyeTogSUJvb2tpbmdRdWVyeSxcbikgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSB8fCAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0IHx8IDEwO1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlLFxuICAgICAgc2tpcDogKHBhZ2UgLSAxKSAqIGxpbWl0LFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBNeSBib29raW5ncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldE15Qm9va2luZ3MgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJQm9va2luZ1F1ZXJ5KSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7IHVzZXJJZCB9O1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHsgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFnZW50IGJvb2tpbmdzIChzY29wZWQgdG8gb3duIHBhY2thZ2VzKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldEFnZW50Qm9va2luZ3MgPSBhc3luYyAoXG4gIGFnZW50SWQ6IHN0cmluZyxcbiAgcXVlcnk6IElCb29raW5nU2VhcmNoUXVlcnksXG4pID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHtcbiAgICBwYWNrYWdlOiB7IGFnZW50SWQgfSxcbiAgfTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUucGFja2FnZSA9IHtcbiAgICAgIGFnZW50SWQsXG4gICAgICB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHsgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBhbGwgYm9va2luZ3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRBbGxCb29raW5ncyA9IGFzeW5jIChxdWVyeTogSUJvb2tpbmdTZWFyY2hRdWVyeSkgPT4ge1xuICBjb25zdCB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0ge307XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIHdoZXJlLnBhY2thZ2UgPSB7IHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH07XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAge1xuICAgICAgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICAgIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlLFxuICAgIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEJvb2tpbmcgZGV0YWlsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0Qm9va2luZ0RldGFpbCA9IGFzeW5jIChpZDogc3RyaW5nLCBhY3RvcjogQm9va2luZ0FjdG9yKSA9PiB7XG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIHBhY2thZ2U6IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0LFxuICAgICAgdXNlcjogYm9va2luZ1VzZXJTZWxlY3QsXG4gICAgICBwYXltZW50czogYm9va2luZ1BheW1lbnRzSW5jbHVkZSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuICBpZiAoIWNhbk1hbmFnZShib29raW5nLCBhY3RvcikpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gdmlldyB0aGlzIGJvb2tpbmcuXCIpO1xuICB9XG5cbiAgcmV0dXJuIG1hcEJvb2tpbmdMaXN0KGJvb2tpbmcpO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZnVuZCAoYm9va2luZyBjYW5jZWxsZWQgd2l0aCBzZXR0bGVkIG1vbmV5KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFJ1bnMgQUZURVIgdGhlIHN0YXR1cy10cmFuc2l0aW9uIHRyYW5zYWN0aW9uIGNvbW1pdHMsIHNvIGEgZ2F0ZXdheSBmYWlsdXJlIGNhblxuLy8gbmV2ZXIgcm9sbCBiYWNrIHRoZSBjYW5jZWxsYXRpb24gaXRzZWxmLiBFYWNoIHNldHRsZWQgcGF5bWVudCBpcyByZWZ1bmRlZCB2aWFcbi8vIHRoZSBTU0xDb21tZXJ6IFJlZnVuZCBBUEkgYW5kIGl0cyBsZWRnZXIgcm93IHN0b3JlcyB0aGUgZ2F0ZXdheSByZWZlcmVuY2UuXG50eXBlIFJlZnVuZENvbnRleHQgPSB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG59O1xuXG5jb25zdCBpc3N1ZVJlZnVuZHMgPSBhc3luYyAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICBjdHg6IFJlZnVuZENvbnRleHQsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXltZW50cyA9IGF3YWl0IHByaXNtYS5wYXltZW50LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7IGJvb2tpbmdJZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLlJFRlVOREVEIH0sXG4gICAgfSk7XG4gICAgaWYgKHBheW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgY29uc3QgcmVmdW5kUmVmczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBvdXRjb21lcyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChcbiAgICAgIHBheW1lbnRzLm1hcChhc3luYyAocGF5bWVudCkgPT4ge1xuICAgICAgICBpZiAoIXBheW1lbnQuYmFua1RyYW5JZCkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICBgW3JlZnVuZF0gcGF5bWVudCAke3BheW1lbnQuaWR9IGhhcyBubyBiYW5rX3RyYW5faWQ7IGdhdGV3YXkgcmVmdW5kIHNraXBwZWQuYCxcbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBnYXRld2F5ID0gYXdhaXQgc3NsY29tbWVyelJlZnVuZCh7XG4gICAgICAgICAgYmFua190cmFuX2lkOiBwYXltZW50LmJhbmtUcmFuSWQsXG4gICAgICAgICAgcmVmdW5kX2Ftb3VudDogTnVtYmVyKHBheW1lbnQuYW1vdW50KSxcbiAgICAgICAgICByZWZ1bmRfcmVtYXJrczogYEJvb2tpbmcgJHtib29raW5nSWR9IGNhbmNlbGxlZCAtIFRyaXBWZXJzZWAsXG4gICAgICAgICAgcmVmZV9pZDogYm9va2luZ0lkLFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGdhdGV3YXkuc3RhdHVzID09PSBcInN1Y2Nlc3NcIiAmJiBnYXRld2F5LnJlZnVuZF9yZWZfaWQpIHtcbiAgICAgICAgICBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgICAgICAgIGRhdGE6IHsgcmVmdW5kUmVmSWQ6IGdhdGV3YXkucmVmdW5kX3JlZl9pZCwgcmVmdW5kZWRBdDogbmV3IERhdGUoKSB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJlZnVuZFJlZnMucHVzaChnYXRld2F5LnJlZnVuZF9yZWZfaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICBgW3JlZnVuZF0gcGF5bWVudCAke3BheW1lbnQuaWR9IHJlamVjdGVkOiAke2dhdGV3YXkuZXJyb3JSZWFzb24gPz8gZ2F0ZXdheS5zdGF0dXMgPz8gXCJ1bmtub3duXCJ9YCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICAgIC8vIGluZGl2aWR1YWwgZmFpbHVyZXMgYXJlIGxvZ2dlZCBhYm92ZSBhbmQgc3dhbGxvd2VkIFx1MjAxNCBtb25leSBzdGF0dXMgYWxyZWFkeVxuICAgIC8vIGZsaXBwZWQgdG8gUkVGVU5ERUQsIHNvIHRoZSBjdXN0b21lciBzZWVzIGEgcmVmdW5kIHJlZ2FyZGxlc3MuXG4gICAgdm9pZCBvdXRjb21lcztcblxuICAgIGlmIChyZWZ1bmRSZWZzLmxlbmd0aCA+IDApIHtcbiAgICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgICAgc2VuZFJlZnVuZEVtYWlsKHtcbiAgICAgICAgICBlbWFpbDogY3R4LmVtYWlsLFxuICAgICAgICAgIG5hbWU6IGN0eC5uYW1lLFxuICAgICAgICAgIHBhY2thZ2VUaXRsZTogY3R4LnBhY2thZ2VUaXRsZSxcbiAgICAgICAgICB0cmF2ZWxEYXRlOiBjdHgudHJhdmVsRGF0ZSxcbiAgICAgICAgICBhbW91bnQ6IHBheW1lbnRzLnJlZHVjZSgoc3VtLCBwKSA9PiBzdW0gKyBOdW1iZXIocC5hbW91bnQpLCAwKSxcbiAgICAgICAgICByZWZ1bmRSZWZJZDogcmVmdW5kUmVmc1swXSxcbiAgICAgICAgfSksXG4gICAgICBdKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGBbcmVmdW5kXSB1bmV4cGVjdGVkIGVycm9yOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gLFxuICAgICk7XG4gIH1cbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBTdGF0dXMgdHJhbnNpdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHVwZGF0ZUJvb2tpbmdTdGF0dXMgPSBhc3luYyAoXG4gIGlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVCb29raW5nU3RhdHVzLFxuICBhY3RvcjogQm9va2luZ0FjdG9yLFxuKSA9PiB7XG4gIGNvbnN0IHsgc3RhdHVzOiB0byB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBib29raW5nID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBwYWNrYWdlOiB7XG4gICAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgYWdlbnRJZDogdHJ1ZSwgdGl0bGU6IHRydWUgfSxcbiAgICAgIH0sXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGlmICghY2FuTWFuYWdlKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwZXJmb3JtIHRoaXMgYWN0aW9uLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHJ1bGUgPSBUUkFOU0lUSU9OU1tib29raW5nLnN0YXR1c10/Llt0b107XG4gIGlmICghcnVsZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIGBDYW5ub3QgdHJhbnNpdGlvbiBib29raW5nIGZyb20gJHtib29raW5nLnN0YXR1c30gdG8gJHt0b30uYCxcbiAgICApO1xuICB9XG4gIGlmICghcnVsZS5hbGxvd2VkKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwZXJmb3JtIHRoaXMgYWN0aW9uLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHRyYXZlbERheSA9IHRvVVRDTWlkbmlnaHQoYm9va2luZy50cmF2ZWxEYXRlKS5nZXRUaW1lKCk7XG4gIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gIGlmIChydWxlLnJlcXVpcmVzVHJhdmVsRGF0ZVBhc3NlZCAmJiB0cmF2ZWxEYXkgPiBub3cpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkJvb2tpbmcgY2FuIG9ubHkgYmUgY29tcGxldGVkIGFmdGVyIHRoZSB0cmF2ZWwgZGF0ZSBoYXMgcGFzc2VkLlwiLFxuICAgICk7XG4gIH1cbiAgaWYgKHJ1bGUuYmVmb3JlVHJhdmVsRGF0ZSAmJiB0cmF2ZWxEYXkgPD0gbm93KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJCb29raW5nIGNhbiBvbmx5IGJlIHJldmVydGVkIGJlZm9yZSB0aGUgdHJhdmVsIGRhdGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIC8vIGNvbXBhcmUtYW5kLXNldDogdGhlIHRyYW5zaXRpb24gYXBwbGllcyBvbmx5IGlmIHRoZSByZWNvcmRlZCBzdGF0dXMgc3RpbGxcbiAgLy8gbWF0Y2hlcyBcdTIwMTQgYSBjb25jdXJyZW50IGNoYW5nZSBtYWtlcyBjb3VudCAwIGFuZCB0aGUgcmVxdWVzdCBmYWlscyBzYWZlbHkuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHR4LmJvb2tpbmcudXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyBpZCwgc3RhdHVzOiBib29raW5nLnN0YXR1cyB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IHRvIH0sXG4gICAgfSk7XG4gICAgaWYgKHJlc3VsdC5jb3VudCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDksXG4gICAgICAgIFwiQm9va2luZyBzdGF0dXMgY2hhbmdlZCBjb25jdXJyZW50bHkuIFBsZWFzZSB0cnkgYWdhaW4uXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIENhbmNlbGxpbmcgYSBwYWlkIGJvb2tpbmcgbWFya3MgaXRzIG1vbmV5IGFzIHJldHVybmVkIChSRUZVTkRFRCBmbGFnKS5cbiAgICAvLyBBYmFuZG9uZWQgc2Vzc2lvbnMgYXJlIGNhbmNlbGxlZC4gVGhlIGdhdGV3YXkgcmVmdW5kcyArIHJlZnVuZCBlbWFpbCBydW5cbiAgICAvLyBhZnRlciB0aGlzIHRyYW5zYWN0aW9uIGNvbW1pdHMgKGlzc3VlUmVmdW5kcyBpcyBiZXN0LWVmZm9ydCkuXG4gICAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgICAgd2hlcmU6IHsgYm9va2luZ0lkOiBpZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MgfSxcbiAgICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuUkVGVU5ERUQgfSxcbiAgICAgIH0pO1xuICAgICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgICAgd2hlcmU6IHsgYm9va2luZ0lkOiBpZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB0eC5ib29raW5nLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICB9KTtcblxuICBpZiAoIXVwZGF0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIC8vIGJlc3QtZWZmb3J0IGdhdGV3YXkgcmVmdW5kICsgcmVmdW5kIGVtYWlsIGZvciBzZXR0bGVkIG1vbmV5IChuZXZlciB0aHJvd3MpXG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQpIHtcbiAgICBhd2FpdCBpc3N1ZVJlZnVuZHMoaWQsIHtcbiAgICAgIGVtYWlsOiBib29raW5nLnVzZXIuZW1haWwsXG4gICAgICBuYW1lOiBib29raW5nLnVzZXIubmFtZSxcbiAgICAgIHBhY2thZ2VUaXRsZTogYm9va2luZy5wYWNrYWdlLnRpdGxlLFxuICAgICAgdHJhdmVsRGF0ZTogYm9va2luZy50cmF2ZWxEYXRlLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gYmVzdC1lZmZvcnQgZW1haWwgZm9yIG1vbmV5LXN0YXR1cyBjaGFuZ2VzXG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DT05GSVJNRUQgfHwgdG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgc2VuZEJvb2tpbmdFbWFpbCh7XG4gICAgICAgIGVtYWlsOiBib29raW5nLnVzZXIuZW1haWwsXG4gICAgICAgIG5hbWU6IGJvb2tpbmcudXNlci5uYW1lLFxuICAgICAgICBwYWNrYWdlVGl0bGU6IGJvb2tpbmcucGFja2FnZS50aXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZTogYm9va2luZy50cmF2ZWxEYXRlLFxuICAgICAgICB0cmF2ZWxlcnM6IGJvb2tpbmcudHJhdmVsZXJzLFxuICAgICAgICB0b3RhbFByaWNlOiBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKSxcbiAgICAgICAgc3RhdHVzOiB0byxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9XG5cbiAgcmV0dXJuIHsgLi4udXBkYXRlZCwgdG90YWxQcmljZTogTnVtYmVyKHVwZGF0ZWQudG90YWxQcmljZSkgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBib29raW5nU2VydmljZSA9IHtcbiAgY3JlYXRlQm9va2luZyxcbiAgZ2V0TXlCb29raW5ncyxcbiAgZ2V0QWdlbnRCb29raW5ncyxcbiAgZ2V0QWxsQm9va2luZ3MsXG4gIGdldEJvb2tpbmdEZXRhaWwsXG4gIHVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5cbmNvbnN0IGNyZWF0ZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFja2FnZUlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG4gIHRyYXZlbERhdGU6IHouY29lcmNlLmRhdGUoe1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlRyYXZlbCBkYXRlIGlzIHJlcXVpcmVkXCIsXG4gICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlRyYXZlbCBkYXRlIG11c3QgYmUgYSB2YWxpZCBkYXRlXCIsXG4gIH0pLnJlZmluZShcbiAgICAoZGF0ZSkgPT4ge1xuICAgICAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpO1xuICAgICAgY29uc3QgdHJhdmVsRGF5ID0gbmV3IERhdGUoXG4gICAgICAgIERhdGUuVVRDKFxuICAgICAgICAgIGRhdGUuZ2V0VVRDRnVsbFllYXIoKSxcbiAgICAgICAgICBkYXRlLmdldFVUQ01vbnRoKCksXG4gICAgICAgICAgZGF0ZS5nZXRVVENEYXRlKCksXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgY29uc3QgdG9kYXlVVEMgPSBuZXcgRGF0ZShcbiAgICAgICAgRGF0ZS5VVEMoXG4gICAgICAgICAgdG9kYXkuZ2V0VVRDRnVsbFllYXIoKSxcbiAgICAgICAgICB0b2RheS5nZXRVVENNb250aCgpLFxuICAgICAgICAgIHRvZGF5LmdldFVUQ0RhdGUoKSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICByZXR1cm4gdHJhdmVsRGF5LmdldFRpbWUoKSA+PSB0b2RheVVUQy5nZXRUaW1lKCk7XG4gICAgfSxcbiAgICB7IG1lc3NhZ2U6IFwiVHJhdmVsIGRhdGUgY2Fubm90IGJlIGluIHRoZSBwYXN0LlwiIH0sXG4gICksXG4gIHRyYXZlbGVyczogelxuICAgIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJUcmF2ZWxlcnMgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5pbnQoXCJUcmF2ZWxlcnMgbXVzdCBiZSBhIHdob2xlIG51bWJlclwiKVxuICAgIC5taW4oMSwgXCJUcmF2ZWxlcnMgbXVzdCBiZSBhdCBsZWFzdCAxXCIpXG4gICAgLm1heCgyMCwgXCJUcmF2ZWxlcnMgbXVzdCBiZSBhdCBtb3N0IDIwXCIpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkJvb2tpbmcgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgYm9va2luZ1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBzdGF0dXM6IHoubmF0aXZlRW51bShCb29raW5nU3RhdHVzKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSA9IGJvb2tpbmdRdWVyeVNjaGVtYS5leHRlbmQoe1xuICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgdXBkYXRlU3RhdHVzU2NoZW1hID0gei5vYmplY3Qoe1xuICBzdGF0dXM6IHoubmF0aXZlRW51bShCb29raW5nU3RhdHVzLCB7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSBzdGF0dXNcIixcbiAgfSksXG59KTtcblxuZXhwb3J0IHR5cGUgVENyZWF0ZUJvb2tpbmdTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBjcmVhdGVTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEJvb2tpbmdRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGJvb2tpbmdRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRVcGRhdGVTdGF0dXNTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiB1cGRhdGVTdGF0dXNTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgYm9va2luZ1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVTY2hlbWEsXG4gIGJvb2tpbmdQYXJhbXNTY2hlbWEsXG4gIGJvb2tpbmdRdWVyeVNjaGVtYSxcbiAgYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hLFxuICB1cGRhdGVTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgcmV2aWV3Q29udHJvbGxlciB9IGZyb20gXCIuL3Jldmlldy5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyByZXZpZXdWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3Jldmlldy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgKFVTRVIgb25seSlcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiByZXZpZXdWYWxpZGF0aW9ucy5jcmVhdGVSZXZpZXdTY2hlbWEgfSksXG4gIHJldmlld0NvbnRyb2xsZXIuY3JlYXRlUmV2aWV3LFxuKTtcblxuLy8gMi4gTGlzdCByZXZpZXdzIGZvciBhIHBhY2thZ2UgKHB1YmxpYylcbnJvdXRlci5nZXQoXG4gIFwiL3BhY2thZ2UvOnBhY2thZ2VJZFwiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3UGFyYW1zU2NoZW1hLFxuICAgIHF1ZXJ5OiByZXZpZXdWYWxpZGF0aW9ucy5yZXZpZXdRdWVyeVNjaGVtYSxcbiAgfSksXG4gIHJldmlld0NvbnRyb2xsZXIuZ2V0UGFja2FnZVJldmlld3MsXG4pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3Um91dGVzID0gcm91dGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyByZXZpZXdTZXJ2aWNlIH0gZnJvbSBcIi4vcmV2aWV3LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgY29udHJvbGxlciAoVVNFUiBvbmx5KVxuY29uc3QgY3JlYXRlUmV2aWV3ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmV2aWV3U2VydmljZS5jcmVhdGVSZXZpZXcodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJSZXZpZXcgc3VibWl0dGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIExpc3QgcGFja2FnZSByZXZpZXdzIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGdldFBhY2thZ2VSZXZpZXdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUlkID0gU3RyaW5nKHJlcS5wYXJhbXMucGFja2FnZUlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXZpZXdTZXJ2aWNlLmxpc3RQYWNrYWdlUmV2aWV3cyhwYWNrYWdlSWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCByZXZpZXdDb250cm9sbGVyID0ge1xuICBjcmVhdGVSZXZpZXcsXG4gIGdldFBhY2thZ2VSZXZpZXdzLFxufTtcbiIsICJpbXBvcnQgeyBQYWNrYWdlU3RhdHVzLCBCb29raW5nU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgSUNyZWF0ZVJldmlld1BheWxvYWQsIElSZXZpZXdRdWVyeSB9IGZyb20gXCIuL3Jldmlldy5pbnRlcmZhY2VcIjtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IChVU0VSIG9ubHkpIFx1MjAxNCBnYXRlZCwgdW5pcXVlIHBlciB1c2VyK3BhY2thZ2UsIGFuZFxuLy8gICAgcmVjYWxjdWxhdGVzIHRoZSBwYWNrYWdlIHJhdGluZyBpbiB0aGUgc2FtZSB0cmFuc2FjdGlvbi5cbmNvbnN0IGNyZWF0ZVJldmlldyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSUNyZWF0ZVJldmlld1BheWxvYWQpID0+IHtcbiAgcmV0dXJuIHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgLy8gUGFja2FnZSBtdXN0IGV4aXN0LCBiZSBhcHByb3ZlZCwgYW5kIG5vdCBiZSBkZWxldGVkIFx1MjAxNCBhIHJldmlldyBvZiBhXG4gICAgLy8gcGVuZGluZy9yZWplY3RlZC9kZWxldGVkIHBhY2thZ2UgaXMgbm9uc2Vuc2UuXG4gICAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCB0eC50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgaWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBhZ2VudElkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICAvLyBObyBzZWxmLXJldmlldyBcdTIwMTQgYW4gYWdlbnQgcmF0aW5nIHRoZWlyIG93biBwYWNrYWdlIGlzIGEgY29uZmxpY3Qgb2YgaW50ZXJlc3QuXG4gICAgaWYgKHRvdXJQYWNrYWdlLmFnZW50SWQgPT09IHVzZXJJZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2Fubm90IHJldmlldyB5b3VyIG93biBwYWNrYWdlLlwiKTtcbiAgICB9XG5cbiAgICAvLyBPbmx5IGN1c3RvbWVycyB3aXRoIGEgY29tcGxldGVkIGJvb2tpbmcgbWF5IHJldmlldy5cbiAgICBjb25zdCBjb21wbGV0ZWRCb29raW5nID0gYXdhaXQgdHguYm9va2luZy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVELFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFjb21wbGV0ZWRCb29raW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJZb3UgY2FuIG9ubHkgcmV2aWV3IGEgcGFja2FnZSBhZnRlciBjb21wbGV0aW5nIGEgYm9va2luZy5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gRnJpZW5kbHkgZHVwbGljYXRlIGNoZWNrIFx1MjAxNCBAQHVuaXF1ZShbdXNlcklkLCBwYWNrYWdlSWRdKSBiYWNrc3RvcHMgYW55XG4gICAgLy8gcmFjZSB2aWEgUDIwMDIgKG1hcHBlZCB0byA0MDkgYnkgdGhlIGdsb2JhbCBoYW5kbGVyKS5cbiAgICBjb25zdCBleGlzdGluZ1JldmlldyA9IGF3YWl0IHR4LnJldmlldy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHsgdXNlcklkLCBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZ1Jldmlldykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJZb3UgaGF2ZSBhbHJlYWR5IHJldmlld2VkIHRoaXMgcGFja2FnZS5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgY3JlYXRlZFJldmlldyA9IGF3YWl0IHR4LnJldmlldy5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICAgIHJhdGluZzogcGF5bG9hZC5yYXRpbmcsXG4gICAgICAgIGNvbW1lbnQ6IHBheWxvYWQuY29tbWVudCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBSZWNvbXB1dGUgdGhlIHBhY2thZ2UgcmF0aW5nIGZyb20gYWxsIG9mIGl0cyByZXZpZXdzLCByb3VuZGVkIHRvIG9uZVxuICAgIC8vIGRlY2ltYWwsIGluc2lkZSB0aGUgc2FtZSB0cmFuc2FjdGlvbiBzbyBhIHN0YWxlIGF2ZXJhZ2UgaXMgbmV2ZXIgd3JpdHRlbi5cbiAgICBjb25zdCB7IF9hdmcgfSA9IGF3YWl0IHR4LnJldmlldy5hZ2dyZWdhdGUoe1xuICAgICAgd2hlcmU6IHsgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9LFxuICAgICAgX2F2ZzogeyByYXRpbmc6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJhdGluZyA9IE1hdGgucm91bmQoKF9hdmcucmF0aW5nID8/IDApICogMTApIC8gMTA7XG5cbiAgICBhd2FpdCB0eC50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheWxvYWQucGFja2FnZUlkIH0sXG4gICAgICBkYXRhOiB7IHJhdGluZyB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgcmV2aWV3OiBjcmVhdGVkUmV2aWV3LCByYXRpbmcgfTtcbiAgfSk7XG59O1xuXG4vLyAyLiBMaXN0IHJldmlld3MgZm9yIGEgcGFja2FnZSAocHVibGljKSBcdTIwMTQgcGFnaW5hdGVkOyB0aGUgcGFja2FnZSBtdXN0IGJlXG4vLyAgICBhcHByb3ZlZCBhbmQgbm90IGRlbGV0ZWQgc28gdW5wdWJsaXNoZWQgcGFja2FnZSByZXZpZXdzIG5ldmVyIGxlYWsuXG5jb25zdCBsaXN0UGFja2FnZVJldmlld3MgPSBhc3luYyAoXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuICBxdWVyeTogSVJldmlld1F1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIGlkOiBwYWNrYWdlSWQsXG4gICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEucmV2aWV3LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7IHBhY2thZ2VJZCB9LFxuICAgICAgc2VsZWN0OiB7XG4gICAgICAgIGlkOiB0cnVlLFxuICAgICAgICByYXRpbmc6IHRydWUsXG4gICAgICAgIGNvbW1lbnQ6IHRydWUsXG4gICAgICAgIGNyZWF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgdXBkYXRlZEF0OiB0cnVlLFxuICAgICAgICB1c2VyOiB7IHNlbGVjdDogeyBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5yZXZpZXcuY291bnQoeyB3aGVyZTogeyBwYWNrYWdlSWQgfSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgcmV2aWV3U2VydmljZSA9IHtcbiAgY3JlYXRlUmV2aWV3LFxuICBsaXN0UGFja2FnZVJldmlld3MsXG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVJldmlld1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFja2FnZUlkOiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbiAgICByYXRpbmc6IHpcbiAgICAgIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJSYXRpbmcgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLmludChcIlJhdGluZyBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyXCIpXG4gICAgICAubWluKDEsIFwiUmF0aW5nIG11c3QgYmUgYXQgbGVhc3QgMVwiKVxuICAgICAgLm1heCg1LCBcIlJhdGluZyBtdXN0IGJlIGF0IG1vc3QgNVwiKSxcbiAgICBjb21tZW50OiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ29tbWVudCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAudHJpbSgpXG4gICAgICAubWluKDEsIFwiQ29tbWVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAgICAgLm1heCgxMDAwLCBcIkNvbW1lbnQgbXVzdCBiZSBhdCBtb3N0IDEwMDAgY2hhcmFjdGVyc1wiKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCByZXZpZXdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5jb25zdCByZXZpZXdRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVJldmlld1NjaGVtYSxcbiAgcmV2aWV3UGFyYW1zU2NoZW1hLFxuICByZXZpZXdRdWVyeVNjaGVtYSxcbn07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGNhdGVnb3J5Q29udHJvbGxlciB9IGZyb20gXCIuL2NhdGVnb3J5LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGNhdGVnb3J5VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9jYXRlZ29yeS52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBMaXN0IGFsbCBjYXRlZ29yaWVzIChwdWJsaWMsIG5vIGF1dGgpXG5yb3V0ZXIuZ2V0KFwiL1wiLCBjYXRlZ29yeUNvbnRyb2xsZXIuZ2V0QWxsQ2F0ZWdvcmllcyk7XG5cbi8vIDIuIENyZWF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY3JlYXRlQ2F0ZWdvcnlTY2hlbWEgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci5jcmVhdGVDYXRlZ29yeSxcbik7XG5cbi8vIDMuIFVwZGF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogY2F0ZWdvcnlWYWxpZGF0aW9ucy5jYXRlZ29yeVBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBjYXRlZ29yeVZhbGlkYXRpb25zLnVwZGF0ZUNhdGVnb3J5U2NoZW1hLFxuICB9KSxcbiAgY2F0ZWdvcnlDb250cm9sbGVyLnVwZGF0ZUNhdGVnb3J5LFxuKTtcblxuLy8gNC4gRGVsZXRlIGNhdGVnb3J5IChhZG1pbilcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY2F0ZWdvcnlQYXJhbXNTY2hlbWEgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci5kZWxldGVDYXRlZ29yeSxcbik7XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeVJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGNhdGVnb3J5U2VydmljZSB9IGZyb20gXCIuL2NhdGVnb3J5LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyBDcmVhdGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCBjcmVhdGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmNyZWF0ZUNhdGVnb3J5KHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcnksXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgYWxsIGNhdGVnb3JpZXMgY29udHJvbGxlciAocHVibGljKVxuY29uc3QgZ2V0QWxsQ2F0ZWdvcmllcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBhd2FpdCBjYXRlZ29yeVNlcnZpY2UuZ2V0QWxsQ2F0ZWdvcmllcygpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBjYXRlZ29yaWVzIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcmllcyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSBjYXRlZ29yeSBjb250cm9sbGVyIChhZG1pbilcbmNvbnN0IHVwZGF0ZUNhdGVnb3J5ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBjb25zdCBjYXRlZ29yeSA9IGF3YWl0IGNhdGVnb3J5U2VydmljZS51cGRhdGVDYXRlZ29yeShpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcnksXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBEZWxldGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCBkZWxldGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmRlbGV0ZUNhdGVnb3J5KGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDYXRlZ29yeSBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlDb250cm9sbGVyID0ge1xuICBjcmVhdGVDYXRlZ29yeSxcbiAgZ2V0QWxsQ2F0ZWdvcmllcyxcbiAgdXBkYXRlQ2F0ZWdvcnksXG4gIGRlbGV0ZUNhdGVnb3J5LFxufTsiLCAiLy8gQmFuZ2xhIChCZW5nYWxpKSBcdTIxOTIgTGF0aW4gY29uc29uYW50L3Zvd2VsIG1hcCwgYXBwbGllZCBiZWZvcmUga2ViYWItY2FzaW5nIHNvXG4vLyBCYW5nbGEtaGVhdnkgdGl0bGVzIHN0aWxsIHByb2R1Y2UgcmVhZGFibGUgc2x1Z3MgaW5zdGVhZCBvZiBiZWluZyBzdHJpcHBlZCB0b1xuLy8gYW4gZW1wdHkgc3RyaW5nLlxuY29uc3QgQkFOR0xBX1RPX0xBVElOOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBcdTA5ODU6IFwib1wiLFxuICBcdTA5ODY6IFwiYVwiLFxuICBcdTA5ODc6IFwiaVwiLFxuICBcdTA5ODg6IFwiaVwiLFxuICBcdTA5ODk6IFwidVwiLFxuICBcdTA5OEE6IFwidVwiLFxuICBcdTA5OEI6IFwicmlcIixcbiAgXHUwOThGOiBcImVcIixcbiAgXHUwOTkwOiBcIm9pXCIsXG4gIFx1MDk5MzogXCJvXCIsXG4gIFx1MDk5NDogXCJvdVwiLFxuICBcdTA5OTU6IFwia2FcIixcbiAgXHUwOTk2OiBcImtoYVwiLFxuICBcdTA5OTc6IFwiZ2FcIixcbiAgXHUwOTk4OiBcImdoYVwiLFxuICBcdTA5OTk6IFwibmdhXCIsXG4gIFx1MDk5QTogXCJjaGFcIixcbiAgXHUwOTlCOiBcImNoaGFcIixcbiAgXHUwOTlDOiBcImphXCIsXG4gIFx1MDk5RDogXCJqaGFcIixcbiAgXHUwOTlFOiBcIm55YVwiLFxuICBcdTA5OUY6IFwidGFcIixcbiAgXHUwOUEwOiBcInRoYVwiLFxuICBcdTA5QTE6IFwiZGFcIixcbiAgXHUwOUEyOiBcImRoYVwiLFxuICBcdTA5QTM6IFwibmFcIixcbiAgXHUwOUE0OiBcInRhXCIsXG4gIFx1MDlBNTogXCJ0aGFcIixcbiAgXHUwOUE2OiBcImRhXCIsXG4gIFx1MDlBNzogXCJkaGFcIixcbiAgXHUwOUE4OiBcIm5hXCIsXG4gIFx1MDlBQTogXCJwYVwiLFxuICBcdTA5QUI6IFwicGhhXCIsXG4gIFx1MDlBQzogXCJiYVwiLFxuICBcdTA5QUQ6IFwiYmhhXCIsXG4gIFx1MDlBRTogXCJtYVwiLFxuICBcdTA5QUY6IFwieWFcIixcbiAgXHUwOUIwOiBcInJhXCIsXG4gIFx1MDlCMjogXCJsYVwiLFxuICBcdTA5QjY6IFwic2hhXCIsXG4gIFx1MDlCNzogXCJzaGFcIixcbiAgXHUwOUI4OiBcInNhXCIsXG4gIFx1MDlCOTogXCJoYVwiLFxuICBcdTA5QTFcdTA5QkM6IFwicmFcIixcbiAgXHUwOUEyXHUwOUJDOiBcInJoYVwiLFxuICBcdTA5QUZcdTA5QkM6IFwieWFcIixcbiAgXCJcdTA5ODJcIjogXCJuZ1wiLFxuICBcIlx1MDk4M1wiOiBcImhcIixcbiAgXCJcdTA5ODFcIjogXCJcIixcbiAgXCJcdTA5Q0RcIjogXCJcIixcbiAgXCJcdTA5QzdcIjogXCJlXCIsXG4gIFwiXHUwOUM4XCI6IFwib2lcIixcbiAgXCJcdTA5Q0JcIjogXCJvXCIsXG4gIFwiXHUwOUNDXCI6IFwib3VcIixcbiAgXCJcdTA5QkVcIjogXCJhXCIsXG4gIFwiXHUwOUJGXCI6IFwiaVwiLFxuICBcIlx1MDlDMFwiOiBcImlcIixcbiAgXCJcdTA5QzFcIjogXCJ1XCIsXG4gIFwiXHUwOUMyXCI6IFwidVwiLFxuICBcIlx1MDlDM1wiOiBcInJpXCIsXG59O1xuXG5jb25zdCB0cmFuc2xpdGVyYXRlID0gKHRleHQ6IHN0cmluZyk6IHN0cmluZyA9PlxuICBbLi4udGV4dF0ubWFwKChjaGFyKSA9PiBCQU5HTEFfVE9fTEFUSU5bY2hhcl0gPz8gY2hhcikuam9pbihcIlwiKTtcblxuLy8gU2hhcmVkIGtlYmFiLWNhc2Ugc2x1Z2lmaWVyIHVzZWQgYnkgQ2F0ZWdvcnkgYW5kIFRvdXJQYWNrYWdlIHNsdWdzLiBOb24tTGF0aW5cbi8vIHNjcmlwdHMgKGUuZy4gQmFuZ2xhKSBhcmUgdHJhbnNsaXRlcmF0ZWQgZmlyc3Q7IGlmIHRoZSByZXN1bHQgaXMgc3RpbGwgZW1wdHlcbi8vIHRoZSBjYWxsZXIgbWF5IHN1cHBseSBhIGBmYWxsYmFja2AgKGUuZy4gXCJwYWNrYWdlLTxzaG9ydElkPlwiKS5cbmV4cG9ydCBjb25zdCBzbHVnaWZ5ID0gKHRleHQ6IHN0cmluZywgZmFsbGJhY2s/OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICBjb25zdCBzbHVnID0gdHJhbnNsaXRlcmF0ZSh0ZXh0KVxuICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgLnRyaW0oKVxuICAgIC5yZXBsYWNlKC9bXlxcd1xccy1dL2csIFwiXCIpXG4gICAgLnJlcGxhY2UoL1tcXHNfLV0rL2csIFwiLVwiKVxuICAgIC5yZXBsYWNlKC9eLSt8LSskL2csIFwiXCIpO1xuXG4gIHJldHVybiBzbHVnIHx8IGZhbGxiYWNrIHx8IFwiXCI7XG59OyIsICJpbXBvcnQgeyBQYWNrYWdlU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2x1Z2lmeSB9IGZyb20gXCIuLi8uLi91dGlscy9zbHVnaWZ5XCI7XG5pbXBvcnQgeyBJQ3JlYXRlQ2F0ZWdvcnksIElVcGRhdGVDYXRlZ29yeSB9IGZyb20gXCIuL2NhdGVnb3J5LmludGVyZmFjZVwiO1xuXG4vLyBGcmllbmRseSA0MDkgZm9yIEB1bmlxdWUgY29uZmxpY3RzIChuYW1lIG9yIHNsdWcpIGluc3RlYWQgb2YgYSByYXcgUDIwMDIuXG4vLyBleGNsdWRlSWQgbGV0cyB1cGRhdGVzIHNraXAgdGhlIHZlcnkgcm93IGJlaW5nIGVkaXRlZCBzbyBhIG5vLW9wIHJlbmFtZVxuLy8gZG9lc24ndCBmYWxzZS00MDkgYWdhaW5zdCBpdHNlbGYuXG5jb25zdCBhc3NlcnROYW1lQXZhaWxhYmxlID0gYXN5bmMgKFxuICBuYW1lOiBzdHJpbmcsXG4gIHNsdWc6IHN0cmluZyxcbiAgZXhjbHVkZUlkPzogc3RyaW5nLFxuKSA9PiB7XG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIE9SOiBbeyBuYW1lIH0sIHsgc2x1ZyB9XSxcbiAgICAgIC4uLihleGNsdWRlSWQgPyB7IE5PVDogeyBpZDogZXhjbHVkZUlkIH0gfSA6IHt9KSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoZXhpc3RpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIkEgY2F0ZWdvcnkgd2l0aCB0aGlzIG5hbWUgYWxyZWFkeSBleGlzdHNcIik7XG4gIH1cbn07XG5cbi8vIENyZWF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5jb25zdCBjcmVhdGVDYXRlZ29yeSA9IGFzeW5jIChwYXlsb2FkOiBJQ3JlYXRlQ2F0ZWdvcnkpID0+IHtcbiAgY29uc3QgeyBuYW1lIH0gPSBwYXlsb2FkO1xuICBjb25zdCBzbHVnID0gc2x1Z2lmeShuYW1lKTtcblxuICBhd2FpdCBhc3NlcnROYW1lQXZhaWxhYmxlKG5hbWUsIHNsdWcpO1xuXG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkuY3JlYXRlKHtcbiAgICBkYXRhOiB7IG5hbWUsIHNsdWcgfSxcbiAgfSk7XG59O1xuXG4vLyBHZXQgYWxsIGNhdGVnb3JpZXMgKHB1YmxpYykgd2l0aCBjb3VudHMgb2YgYXBwcm92ZWQsIG5vbi1kZWxldGVkIHBhY2thZ2VzXG5jb25zdCBnZXRBbGxDYXRlZ29yaWVzID0gYXN5bmMgKCkgPT4ge1xuICByZXR1cm4gcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KHtcbiAgICBvcmRlckJ5OiB7IG5hbWU6IFwiYXNjXCIgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBfY291bnQ6IHtcbiAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgcGFja2FnZXM6IHtcbiAgICAgICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgICAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG59O1xuXG4vLyBVcGRhdGUgY2F0ZWdvcnkgbmFtZSAocmVnZW5lcmF0ZXMgc2x1ZykgKGFkbWluKVxuY29uc3QgdXBkYXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nLCBwYXlsb2FkOiBJVXBkYXRlQ2F0ZWdvcnkpID0+IHtcbiAgY29uc3QgeyBuYW1lIH0gPSBwYXlsb2FkO1xuICBjb25zdCBzbHVnID0gc2x1Z2lmeShuYW1lKTtcblxuICBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9IH0pO1xuICBhd2FpdCBhc3NlcnROYW1lQXZhaWxhYmxlKG5hbWUsIHNsdWcsIGNhdGVnb3J5SWQpO1xuXG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9LFxuICAgIGRhdGE6IHsgbmFtZSwgc2x1ZyB9LFxuICB9KTtcbn07XG5cbi8vIERlbGV0ZSBjYXRlZ29yeSAoYWRtaW4pIFx1MjAxNCA0MDkgd2hlbiBhbnkgcGFja2FnZSByZWZlcmVuY2VzIGl0XG5jb25zdCBkZWxldGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93KHsgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSB9KTtcblxuICBjb25zdCBwYWNrYWdlQ291bnQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuY291bnQoe1xuICAgIHdoZXJlOiB7IGNhdGVnb3J5SWQgfSxcbiAgfSk7XG5cbiAgaWYgKHBhY2thZ2VDb3VudCA+IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBcIkNhbm5vdCBkZWxldGUgY2F0ZWdvcnkgd2l0aCBhc3NvY2lhdGVkIHBhY2thZ2VzLiBSZW5hbWUgaXQgaW5zdGVhZC5cIixcbiAgICApO1xuICB9XG5cbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmRlbGV0ZSh7IHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0gfSk7XG59O1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlTZXJ2aWNlID0ge1xuICBjcmVhdGVDYXRlZ29yeSxcbiAgZ2V0QWxsQ2F0ZWdvcmllcyxcbiAgdXBkYXRlQ2F0ZWdvcnksXG4gIGRlbGV0ZUNhdGVnb3J5LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgbmFtZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNhdGVnb3J5IG5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMiwgXCJDYXRlZ29yeSBuYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMTAwLCBcIkNhdGVnb3J5IG5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBjcmVhdGVDYXRlZ29yeVNjaGVtYSA9IHoub2JqZWN0KHsgbmFtZTogbmFtZVNjaGVtYSB9KS5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlQ2F0ZWdvcnlTY2hlbWEgPSB6Lm9iamVjdCh7IG5hbWU6IG5hbWVTY2hlbWEgfSkuc3RyaWN0KCk7XG5cbmNvbnN0IGNhdGVnb3J5UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlQ2F0ZWdvcnlTY2hlbWEsXG4gIHVwZGF0ZUNhdGVnb3J5U2NoZW1hLFxuICBjYXRlZ29yeVBhcmFtc1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBwYWNrYWdlQ29udHJvbGxlciB9IGZyb20gXCIuL3BhY2thZ2UuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgcGFja2FnZVZhbGlkYXRpb25zIH0gZnJvbSBcIi4vcGFja2FnZS52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBOT1RFOiBgL2ludGVybmFsLypgIHJvdXRlcyBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgYEdFVCAvOnNsdWdgIGJlbG93IFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYSBsaXRlcmFsIHNlZ21lbnQgKGAvaW50ZXJuYWwvYWxsYCkgd291bGRcbi8vIG90aGVyd2lzZSBiZSBzd2FsbG93ZWQgYnkgdGhlIGA6c2x1Z2AgcGFyYW0gcm91dGUgYW5kIDQwNCBmb3JldmVyLlxuXG4vLyAxLiBNeSBwYWNrYWdlcyAoYWdlbnQpIFx1MjAxNCBzZWxmLXByZXZpZXcgb2YgUEVORElORy9SRUpFQ1RFRCBiZWZvcmUgYXBwcm92YWxcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL215LXBhY2thZ2VzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMuaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldE15UGFja2FnZXMsXG4pO1xuXG4vLyAyLiBBbGwgcGFja2FnZXMgKGFkbWluIG1vZGVyYXRpb24gVUkpXG5yb3V0ZXIuZ2V0KFxuICBcIi9pbnRlcm5hbC9hbGxcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHBhY2thZ2VWYWxpZGF0aW9ucy5pbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0QWxsUGFja2FnZXMsXG4pO1xuXG4vLyAzLiBQdWJsaWMgcGFja2FnZSBkZXRhaWwgYnkgc2x1Z1xucm91dGVyLmdldChcbiAgXCIvOnNsdWdcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVNsdWdQYXJhbXNTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldFBhY2thZ2VCeVNsdWcsXG4pO1xuXG4vLyA0LiBDcmVhdGUgcGFja2FnZSAoYWdlbnQgY3JlYXRlcyBvd247IGFkbWluIGNhbiBjcmVhdGUgZm9yIGFueSBhZ2VudClcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLmNyZWF0ZVBhY2thZ2VTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmNyZWF0ZVBhY2thZ2UsXG4pO1xuXG4vLyA1LiBBcHByb3ZlL3JlamVjdCBwYWNrYWdlIChhZG1pbikgXHUyMDE0IHJlZ2lzdGVyZWQgYmVmb3JlIFBBVENIIC86aWQgZm9yIGNsYXJpdHlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLnVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmNoYW5nZVBhY2thZ2VTdGF0dXMsXG4pO1xuXG4vLyA2LiBVcGRhdGUgcGFja2FnZSAoYWdlbnQgb3duIC8gYWRtaW4gYW55KVxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHBhY2thZ2VWYWxpZGF0aW9ucy51cGRhdGVQYWNrYWdlU2NoZW1hLFxuICB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIudXBkYXRlUGFja2FnZSxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBhY2thZ2UgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5zb2Z0RGVsZXRlUGFja2FnZSxcbik7XG5cbi8vIDguIFB1YmxpYyBsaXN0aW5nIFx1MjAxNCBrZXB0IGxhc3Qgc28gbm9uZSBvZiB0aGUgYWJvdmUgcm91dGVzIGFyZSBzaGFkb3dlZFxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVF1ZXJ5U2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRQdWJsaWNQYWNrYWdlcyxcbik7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgcGFja2FnZVNlcnZpY2UgfSBmcm9tIFwiLi9wYWNrYWdlLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVC9BRE1JTilcbmNvbnN0IGNyZWF0ZVBhY2thZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5jcmVhdGVQYWNrYWdlKHJlcS51c2VyISwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseS4gSXQgd2lsbCBiZSB2aXNpYmxlIGFmdGVyIGFkbWluIGFwcHJvdmFsLlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgY29udHJvbGxlciAoZmlsdGVycyArIHBhZ2luYXRpb24pXG5jb25zdCBnZXRQdWJsaWNQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldFB1YmxpY1BhY2thZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBQdWJsaWMgcGFja2FnZSBkZXRhaWwgYnkgc2x1Z1xuY29uc3QgZ2V0UGFja2FnZUJ5U2x1ZyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHNsdWcgPSBTdHJpbmcocmVxLnBhcmFtcy5zbHVnKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRQYWNrYWdlQnlTbHVnKHNsdWcpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIEFsbCBwYWNrYWdlcyBjb250cm9sbGVyIChBRE1JTiBtb2RlcmF0aW9uKVxuY29uc3QgZ2V0QWxsUGFja2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRBbGxQYWNrYWdlcyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBwYWNrYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDUuIE15IHBhY2thZ2VzIGNvbnRyb2xsZXIgKEFHRU5UKVxuY29uc3QgZ2V0TXlQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldE15UGFja2FnZXModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIllvdXIgcGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA2LiBVcGRhdGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCB1cGRhdGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UudXBkYXRlUGFja2FnZShyZXEudXNlciEsIGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDcuIENoYW5nZSBwYWNrYWdlIHN0YXR1cyBjb250cm9sbGVyIChBRE1JTiBhcHByb3ZlL3JlamVjdClcbmNvbnN0IGNoYW5nZVBhY2thZ2VTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5jaGFuZ2VQYWNrYWdlU3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA4LiBTb2Z0IGRlbGV0ZSBwYWNrYWdlIGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHNvZnREZWxldGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgYXdhaXQgcGFja2FnZVNlcnZpY2Uuc29mdERlbGV0ZVBhY2thZ2UocmVxLnVzZXIhLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcGFja2FnZUNvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBhY2thZ2UsXG4gIGdldFB1YmxpY1BhY2thZ2VzLFxuICBnZXRQYWNrYWdlQnlTbHVnLFxuICBnZXRBbGxQYWNrYWdlcyxcbiAgZ2V0TXlQYWNrYWdlcyxcbiAgdXBkYXRlUGFja2FnZSxcbiAgY2hhbmdlUGFja2FnZVN0YXR1cyxcbiAgc29mdERlbGV0ZVBhY2thZ2UsXG59OyIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyBQYWNrYWdlU3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVQYWNrYWdlUGF5bG9hZCxcbiAgSUludGVybmFsUGFja2FnZVF1ZXJ5LFxuICBJUGFja2FnZVF1ZXJ5LFxuICBJUmVxdWVzdFVzZXIsXG4gIElVcGRhdGVQYWNrYWdlUGF5bG9hZCxcbiAgSVVwZGF0ZVN0YXR1c1BheWxvYWQsXG59IGZyb20gXCIuL3BhY2thZ2UuaW50ZXJmYWNlXCI7XG5cbi8vIE1vbmV5IGlzIGBEZWNpbWFsKDEwLDIpYCBpbiB0aGUgc2NoZW1hIChBR0VOVFMubWQpIFx1MjAxNCBtYXAgdG8gTnVtYmVyIG9uIHJldHVybi5cbmNvbnN0IHNlcmlhbGl6ZVByaWNlID0gPFQgZXh0ZW5kcyB7IHByaWNlOiBQcmlzbWEuRGVjaW1hbCB9Pihyb3c6IFQpOiBUID0+ICh7XG4gIC4uLnJvdyxcbiAgcHJpY2U6IE51bWJlcihyb3cucHJpY2UpLFxufSk7XG5cbi8vIFB1YmxpYyBwYXlsb2FkcyBjYXJyeSB0aGUgYWdlbnQncyBkaXNwbGF5IGluZm8gb25seSBcdTIwMTQgbmV2ZXIgZW1haWwuXG5leHBvcnQgY29uc3QgcHVibGljUGFja2FnZUluY2x1ZGUgPSB7XG4gIGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0sXG4gIGFnZW50OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgYXZhdGFyVXJsOiB0cnVlIH0gfSxcbn0gYXMgY29uc3Q7XG5cbmNvbnN0IHZhbGlkYXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghY2F0ZWdvcnkpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgY2F0ZWdvcnlJZFwiKTtcbiAgfVxufTtcblxuLy8gUGFja2FnZXMgbXVzdCBiZSBvd25lZCBieSBhIGxpdmUgQUdFTlQgXHUyMDE0IG90aGVyd2lzZSB0aGUgYm9va2luZyBzdGF0ZVxuLy8gbWFjaGluZSdzIFwiQUdFTlQgKG93bnMgcGFja2FnZSlcIiBicmFuY2ggYW5kIGFnZW50LWJvb2tpbmdzIHNjb3BpbmcgYnJlYWsuXG5jb25zdCB2YWxpZGF0ZUFnZW50ID0gYXN5bmMgKGFnZW50SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBhZ2VudCA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBhZ2VudElkIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlLCByb2xlOiB0cnVlLCBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCFhZ2VudCB8fCBhZ2VudC5yb2xlICE9PSBSb2xlLkFHRU5UIHx8IGFnZW50LmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBhZ2VudElkXCIpO1xuICB9XG59O1xuXG4vLyBDb2xsaXNpb24tc2FmZSBzbHVnOiBiYXNlIHNsdWcgZnJvbSB0aGUgdGl0bGUsIHRoZW4gYC0yYCwgYC0zYCwgLi4uIHVzaW5nIGFcbi8vIHNpbmdsZSBwcmVmaXggcXVlcnkuIFB1cmUtQmFuZ2xhL2Vtb2ppIHRpdGxlcyBjYW4ndCBzbHVnaWZ5IFx1MjAxNCBmYWxsIGJhY2sgdG9cbi8vIGBwYWNrYWdlLTxzaG9ydElkPmAgc28gdGhlIFVSTCBpcyBhbHdheXMgbWVhbmluZ2Z1bC5cbmNvbnN0IGdlbmVyYXRlVW5pcXVlU2x1ZyA9IGFzeW5jICh0aXRsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgY29uc3QgYmFzZSA9IHNsdWdpZnkodGl0bGUpIHx8IGBwYWNrYWdlLSR7cmFuZG9tVVVJRCgpLnNsaWNlKDAsIDgpfWA7XG5cbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgIHdoZXJlOiB7IHNsdWc6IHsgc3RhcnRzV2l0aDogYmFzZSB9IH0sXG4gICAgc2VsZWN0OiB7IHNsdWc6IHRydWUgfSxcbiAgfSk7XG5cbiAgY29uc3QgdXNlZCA9IG5ldyBTZXQoZXhpc3RpbmcubWFwKChwKSA9PiBwLnNsdWcpKTtcbiAgaWYgKCF1c2VkLmhhcyhiYXNlKSkge1xuICAgIHJldHVybiBiYXNlO1xuICB9XG5cbiAgbGV0IHN1ZmZpeCA9IDI7XG4gIHdoaWxlICh1c2VkLmhhcyhgJHtiYXNlfS0ke3N1ZmZpeH1gKSkge1xuICAgIHN1ZmZpeCArPSAxO1xuICB9XG4gIHJldHVybiBgJHtiYXNlfS0ke3N1ZmZpeH1gO1xufTtcblxuLy8gMS4gQ3JlYXRlIGEgcGFja2FnZSAoQUdFTlQvQURNSU4pLiBOZXcgcGFja2FnZXMgc3RhcnQgUEVORElORyBhbmQgbmV2ZXIgbGVha1xuLy8gICAgaW50byBwdWJsaWMgcXVlcmllcyB1bnRpbCBhbiBhZG1pbiBhcHByb3ZlcyB0aGVtLlxuY29uc3QgY3JlYXRlUGFja2FnZSA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBheWxvYWQ6IElDcmVhdGVQYWNrYWdlUGF5bG9hZCkgPT4ge1xuICBhd2FpdCB2YWxpZGF0ZUNhdGVnb3J5KHBheWxvYWQuY2F0ZWdvcnlJZCk7XG5cbiAgLy8gQURNSU4gbWF5IGNyZWF0ZSBvbiBiZWhhbGYgb2YgYW4gYWdlbnQgKG9wdGlvbmFsIGFnZW50SWQpOyBBR0VOVCBhbHdheXNcbiAgLy8gb3ducyB3aGF0IHRoZXkgY3JlYXRlIGFuZCBtYXkgbm90IGltcGVyc29uYXRlIGFub3RoZXIgdXNlci5cbiAgbGV0IGFnZW50SWQ6IHN0cmluZztcbiAgaWYgKHVzZXIucm9sZSA9PT0gUm9sZS5BRE1JTikge1xuICAgIGlmIChwYXlsb2FkLmFnZW50SWQpIHtcbiAgICAgIGF3YWl0IHZhbGlkYXRlQWdlbnQocGF5bG9hZC5hZ2VudElkKTtcbiAgICAgIGFnZW50SWQgPSBwYXlsb2FkLmFnZW50SWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFnZW50SWQgPSB1c2VyLmlkO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAocGF5bG9hZC5hZ2VudElkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcImFnZW50SWQgY2FuIG9ubHkgYmUgc2V0IGJ5IGFuIGFkbWluXCIpO1xuICAgIH1cbiAgICBhZ2VudElkID0gdXNlci5pZDtcbiAgfVxuXG4gIGNvbnN0IHNsdWcgPSBhd2FpdCBnZW5lcmF0ZVVuaXF1ZVNsdWcocGF5bG9hZC50aXRsZSk7XG5cbiAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIHRpdGxlOiBwYXlsb2FkLnRpdGxlLFxuICAgICAgZGVzY3JpcHRpb246IHBheWxvYWQuZGVzY3JpcHRpb24sXG4gICAgICBsb2NhdGlvbjogcGF5bG9hZC5sb2NhdGlvbixcbiAgICAgIHByaWNlOiBwYXlsb2FkLnByaWNlLFxuICAgICAgZHVyYXRpb246IHBheWxvYWQuZHVyYXRpb24sXG4gICAgICBjYXRlZ29yeUlkOiBwYXlsb2FkLmNhdGVnb3J5SWQsXG4gICAgICBpbWFnZXM6IHBheWxvYWQuaW1hZ2VzLFxuICAgICAgYWdlbnRJZCxcbiAgICAgIHNsdWcsXG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKGNyZWF0ZWQpO1xufTtcblxuLy8gMi4gUHVibGljIGV4cGxvcmVkIGxpc3RpbmcgXHUyMDE0IEFQUFJPVkVEICsgbm90LWRlbGV0ZWQgb25seSwgZmlsdGVycyArIHNvcnRpbmcuXG5jb25zdCBnZXRQdWJsaWNQYWNrYWdlcyA9IGFzeW5jIChxdWVyeTogSVBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IGZpbHRlcnM6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXRbXSA9IFtdO1xuXG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgT1I6IFtcbiAgICAgICAgeyB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICB7IGRlc2NyaXB0aW9uOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgIHsgbG9jYXRpb246IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5LmxvY2F0aW9uKSB7XG4gICAgZmlsdGVycy5wdXNoKHtcbiAgICAgIGxvY2F0aW9uOiB7IGNvbnRhaW5zOiBxdWVyeS5sb2NhdGlvbiwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0sXG4gICAgfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5Lm1pblByaWNlICE9PSB1bmRlZmluZWQgfHwgcXVlcnkubWF4UHJpY2UgIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICBwcmljZToge1xuICAgICAgICAuLi4ocXVlcnkubWluUHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgZ3RlOiBxdWVyeS5taW5QcmljZSB9IDoge30pLFxuICAgICAgICAuLi4ocXVlcnkubWF4UHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgbHRlOiBxdWVyeS5tYXhQcmljZSB9IDoge30pLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubWluUmF0aW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBmaWx0ZXJzLnB1c2goeyByYXRpbmc6IHsgZ3RlOiBxdWVyeS5taW5SYXRpbmcgfSB9KTtcbiAgfVxuICBpZiAocXVlcnkubWF4RHVyYXRpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7IGR1cmF0aW9uOiB7IGx0ZTogcXVlcnkubWF4RHVyYXRpb24gfSB9KTtcbiAgfVxuICBpZiAocXVlcnkuY2F0ZWdvcnkpIHtcbiAgICBmaWx0ZXJzLnB1c2goeyBjYXRlZ29yeTogeyBzbHVnOiBxdWVyeS5jYXRlZ29yeSB9IH0pO1xuICB9XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXQgPSB7XG4gICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgQU5EOiBmaWx0ZXJzLmxlbmd0aCA+IDAgPyBmaWx0ZXJzIDogdW5kZWZpbmVkLFxuICB9O1xuXG4gIGNvbnN0IHNvcnRPcmRlciA9IHF1ZXJ5LnNvcnRPcmRlciA/PyAocXVlcnkuc29ydEJ5ID09PSBcIm5ld2VzdFwiID8gXCJkZXNjXCIgOiBcImFzY1wiKTtcblxuICBjb25zdCBvcmRlckJ5TWFwOiBSZWNvcmQ8c3RyaW5nLCBQcmlzbWEuVG91clBhY2thZ2VPcmRlckJ5V2l0aFJlbGF0aW9uSW5wdXQ+ID0ge1xuICAgIG5ld2VzdDogeyBjcmVhdGVkQXQ6IHNvcnRPcmRlciB9LFxuICAgIHByaWNlOiB7IHByaWNlOiBzb3J0T3JkZXIgfSxcbiAgICByYXRpbmc6IHsgcmF0aW5nOiBzb3J0T3JkZXIgfSxcbiAgICB0aXRsZTogeyB0aXRsZTogc29ydE9yZGVyIH0sXG4gIH07XG5cbiAgY29uc3Qgb3JkZXJCeSA9IG9yZGVyQnlNYXBbcXVlcnkuc29ydEJ5ID8/IFwibmV3ZXN0XCJdID8/IG9yZGVyQnlNYXAubmV3ZXN0O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeSxcbiAgICAgIGluY2x1ZGU6IHB1YmxpY1BhY2thZ2VJbmNsdWRlLFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVByaWNlKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAzLiBQdWJsaWMgZGV0YWlsIGJ5IHNsdWcgXHUyMDE0IEFQUFJPVkVEICsgbm90LWRlbGV0ZWQgb25seS5cbmNvbnN0IGdldFBhY2thZ2VCeVNsdWcgPSBhc3luYyAoc2x1Zzogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHsgc2x1Zywgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgaW5jbHVkZTogcHVibGljUGFja2FnZUluY2x1ZGUsXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh0b3VyUGFja2FnZSk7XG59O1xuXG4vLyA0LiBBbGwgcGFja2FnZXMgZm9yIHRoZSBhZG1pbiBtb2RlcmF0aW9uIFVJIChhbnkgc3RhdHVzLCBvcHRpb25hbCBmaWx0ZXJzKS5cbmNvbnN0IGdldEFsbFBhY2thZ2VzID0gYXN5bmMgKHF1ZXJ5OiBJSW50ZXJuYWxQYWNrYWdlUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zdGF0dXMgPyB7IHN0YXR1czogcXVlcnkuc3RhdHVzIH0gOiB7fSksXG4gICAgLi4uKHF1ZXJ5LmFnZW50SWQgPyB7IGFnZW50SWQ6IHF1ZXJ5LmFnZW50SWQgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgICAgICAgYWdlbnQ6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDUuIEFuIGFnZW50J3Mgb3duIHBhY2thZ2VzIChhbnkgc3RhdHVzKSBcdTIwMTQgc2VsZi1wcmV2aWV3IGJlZm9yZSBhcHByb3ZhbC5cbmNvbnN0IGdldE15UGFja2FnZXMgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJSW50ZXJuYWxQYWNrYWdlUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBhZ2VudElkOiB1c2VySWQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIEZldGNoICsgb3duZXJzaGlwIGdhdGUgc2hhcmVkIGJ5IFBBVENIIGFuZCBERUxFVEUuIEFETUlOIGJ5cGFzc2VzIG93bmVyc2hpcDtcbi8vIEFHRU5UIGVkaXRzIGFyZSBjb25maW5lZCB0byB0aGVpciBvd24gcGFja2FnZXMuXG5jb25zdCBmaW5kT3duZWRQYWNrYWdlID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGFja2FnZUlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBpZiAodXNlci5yb2xlICE9PSBSb2xlLkFETUlOICYmIHRvdXJQYWNrYWdlLmFnZW50SWQgIT09IHVzZXIuaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW4gb25seSBhY3Qgb24geW91ciBvd24gcGFja2FnZXMuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHRvdXJQYWNrYWdlO1xufTtcblxuLy8gNi4gVXBkYXRlIGEgcGFja2FnZS4gU2x1ZyBuZXZlciBjaGFuZ2VzIChrZWVwcyBsaW5rcy9ib29rbWFya3MgdmFsaWQpLlxuLy8gICAgQUdFTlQgZWRpdHMgcmVzZXQgc3RhdHVzIHRvIFBFTkRJTkc7IEFETUlOIGVkaXRzIHByZXNlcnZlIGl0LlxuY29uc3QgdXBkYXRlUGFja2FnZSA9IGFzeW5jIChcbiAgdXNlcjogSVJlcXVlc3RVc2VyLFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVBhY2thZ2VQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgZmluZE93bmVkUGFja2FnZSh1c2VyLCBwYWNrYWdlSWQpO1xuXG4gIGlmIChwYXlsb2FkLmNhdGVnb3J5SWQgIT09IHVuZGVmaW5lZCkge1xuICAgIGF3YWl0IHZhbGlkYXRlQ2F0ZWdvcnkocGF5bG9hZC5jYXRlZ29yeUlkKTtcbiAgfVxuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5Ub3VyUGFja2FnZVVwZGF0ZUlucHV0ID0ge1xuICAgIC4uLihwYXlsb2FkLnRpdGxlICE9PSB1bmRlZmluZWQgPyB7IHRpdGxlOiBwYXlsb2FkLnRpdGxlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZGVzY3JpcHRpb24gIT09IHVuZGVmaW5lZCA/IHsgZGVzY3JpcHRpb246IHBheWxvYWQuZGVzY3JpcHRpb24gfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5sb2NhdGlvbiAhPT0gdW5kZWZpbmVkID8geyBsb2NhdGlvbjogcGF5bG9hZC5sb2NhdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLnByaWNlICE9PSB1bmRlZmluZWQgPyB7IHByaWNlOiBwYXlsb2FkLnByaWNlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZHVyYXRpb24gIT09IHVuZGVmaW5lZCA/IHsgZHVyYXRpb246IHBheWxvYWQuZHVyYXRpb24gfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5pbWFnZXMgIT09IHVuZGVmaW5lZCA/IHsgaW1hZ2VzOiBwYXlsb2FkLmltYWdlcyB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNhdGVnb3J5SWQgIT09IHVuZGVmaW5lZFxuICAgICAgPyB7IGNhdGVnb3J5OiB7IGNvbm5lY3Q6IHsgaWQ6IHBheWxvYWQuY2F0ZWdvcnlJZCB9IH0gfVxuICAgICAgOiB7fSksXG4gICAgLi4uKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiA/IHsgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLlBFTkRJTkcgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGEsXG4gICAgaW5jbHVkZTogeyBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9IH0sXG4gIH0pO1xuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh1cGRhdGVkKTtcbn07XG5cbi8vIDcuIEFwcHJvdmUvcmVqZWN0IGEgcGFja2FnZSAoYWRtaW4pLlxuY29uc3QgY2hhbmdlUGFja2FnZVN0YXR1cyA9IGFzeW5jIChcbiAgcGFja2FnZUlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVTdGF0dXNQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWVPclRocm93KHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gIH0pO1xuXG4gIGlmICh0b3VyUGFja2FnZS5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkNhbm5vdCBjaGFuZ2UgdGhlIHN0YXR1cyBvZiBhIGRlbGV0ZWQgcGFja2FnZS5cIik7XG4gIH1cblxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGE6IHsgc3RhdHVzOiBwYXlsb2FkLnN0YXR1cyB9LFxuICB9KTtcblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UodXBkYXRlZCk7XG59O1xuXG4vLyA4LiBTb2Z0IGRlbGV0ZSAoYWRtaW4gYW55LCBhZ2VudCBvd24pLlxuY29uc3Qgc29mdERlbGV0ZVBhY2thZ2UgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYWNrYWdlSWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBmaW5kT3duZWRQYWNrYWdlKHVzZXIsIHBhY2thZ2VJZCk7XG5cbiAgcmV0dXJuIHByaXNtYS50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSB9LFxuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlU2VydmljZSA9IHtcbiAgY3JlYXRlUGFja2FnZSxcbiAgZ2V0UHVibGljUGFja2FnZXMsXG4gIGdldFBhY2thZ2VCeVNsdWcsXG4gIGdldEFsbFBhY2thZ2VzLFxuICBnZXRNeVBhY2thZ2VzLFxuICB1cGRhdGVQYWNrYWdlLFxuICBjaGFuZ2VQYWNrYWdlU3RhdHVzLFxuICBzb2Z0RGVsZXRlUGFja2FnZSxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IHRpdGxlU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVGl0bGUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMywgXCJUaXRsZSBtdXN0IGJlIGF0IGxlYXN0IDMgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJUaXRsZSBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGRlc2NyaXB0aW9uU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRGVzY3JpcHRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMTAsIFwiRGVzY3JpcHRpb24gbXVzdCBiZSBhdCBsZWFzdCAxMCBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMTAwMDAsIFwiRGVzY3JpcHRpb24gbXVzdCBiZSBhdCBtb3N0IDEwMDAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGxvY2F0aW9uU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTG9jYXRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMiwgXCJMb2NhdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJMb2NhdGlvbiBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IHByaWNlU2NoZW1hID0gelxuICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiUHJpY2UgaXMgcmVxdWlyZWRcIiB9KVxuICAucG9zaXRpdmUoXCJQcmljZSBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIpXG4gIC5yZWZpbmUoKHZhbCkgPT4gTWF0aC5yb3VuZCh2YWwgKiAxMDApIC8gMTAwID09PSB2YWwsIHtcbiAgICBtZXNzYWdlOiBcIlByaWNlIG11c3QgaGF2ZSBhdCBtb3N0IDIgZGVjaW1hbCBwbGFjZXNcIixcbiAgfSk7XG5cbmNvbnN0IGR1cmF0aW9uU2NoZW1hID0gelxuICAubnVtYmVyKHsgcmVxdWlyZWRfZXJyb3I6IFwiRHVyYXRpb24gaXMgcmVxdWlyZWRcIiB9KVxuICAuaW50KFwiRHVyYXRpb24gbXVzdCBiZSBhIHdob2xlIG51bWJlciBvZiBkYXlzXCIpXG4gIC5taW4oMSwgXCJEdXJhdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDEgZGF5XCIpO1xuXG5jb25zdCBjYXRlZ29yeUlkU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ2F0ZWdvcnkgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAubWluKDEsIFwiQ2F0ZWdvcnkgaWQgbXVzdCBub3QgYmUgZW1wdHlcIik7XG5cbmNvbnN0IGltYWdlc1NjaGVtYSA9IHpcbiAgLmFycmF5KHouc3RyaW5nKCkudXJsKFwiRWFjaCBpbWFnZSBtdXN0IGJlIGEgdmFsaWQgVVJMXCIpKVxuICAubWluKDEsIFwiQXQgbGVhc3Qgb25lIGltYWdlIGlzIHJlcXVpcmVkXCIpXG4gIC5tYXgoNiwgXCJBdCBtb3N0IDYgaW1hZ2VzIGFyZSBhbGxvd2VkXCIpO1xuXG5jb25zdCBjcmVhdGVQYWNrYWdlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEsXG4gICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uU2NoZW1hLFxuICAgIGxvY2F0aW9uOiBsb2NhdGlvblNjaGVtYSxcbiAgICBwcmljZTogcHJpY2VTY2hlbWEsXG4gICAgZHVyYXRpb246IGR1cmF0aW9uU2NoZW1hLFxuICAgIGNhdGVnb3J5SWQ6IGNhdGVnb3J5SWRTY2hlbWEsXG4gICAgaW1hZ2VzOiBpbWFnZXNTY2hlbWEsXG4gICAgYWdlbnRJZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVQYWNrYWdlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBsb2NhdGlvbjogbG9jYXRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBwcmljZTogcHJpY2VTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBkdXJhdGlvbjogZHVyYXRpb25TY2hlbWEub3B0aW9uYWwoKSxcbiAgICBjYXRlZ29yeUlkOiBjYXRlZ29yeUlkU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgaW1hZ2VzOiBpbWFnZXNTY2hlbWEub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IE9iamVjdC5rZXlzKGRhdGEpLmxlbmd0aCA+IDAsIHtcbiAgICBtZXNzYWdlOiBcIkF0IGxlYXN0IG9uZSBmaWVsZCBtdXN0IGJlIHByb3ZpZGVkIHRvIHVwZGF0ZVwiLFxuICB9KTtcblxuY29uc3QgcGFja2FnZVF1ZXJ5U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gICAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBjYXRlZ29yeTogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgbG9jYXRpb246IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIG1pblByaWNlOiB6LmNvZXJjZS5udW1iZXIoKS5wb3NpdGl2ZSgpLm9wdGlvbmFsKCksXG4gICAgbWF4UHJpY2U6IHouY29lcmNlLm51bWJlcigpLnBvc2l0aXZlKCkub3B0aW9uYWwoKSxcbiAgICBtaW5SYXRpbmc6IHouY29lcmNlLm51bWJlcigpLm1pbigwKS5tYXgoNSkub3B0aW9uYWwoKSxcbiAgICBtYXhEdXJhdGlvbjogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm9wdGlvbmFsKCksXG4gICAgc29ydEJ5OiB6XG4gICAgICAuZW51bShbXCJuZXdlc3RcIiwgXCJwcmljZVwiLCBcInJhdGluZ1wiLCBcInRpdGxlXCJdKVxuICAgICAgLmRlZmF1bHQoXCJuZXdlc3RcIiksXG4gICAgc29ydE9yZGVyOiB6LmVudW0oW1wiYXNjXCIsIFwiZGVzY1wiXSkub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnJlZmluZSgoZGF0YSkgPT4ge1xuICAgIGlmIChkYXRhLm1pblByaWNlICE9PSB1bmRlZmluZWQgJiYgZGF0YS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gZGF0YS5taW5QcmljZSA8PSBkYXRhLm1heFByaWNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSwge1xuICAgIG1lc3NhZ2U6IFwibWluUHJpY2UgbXVzdCBiZSBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gbWF4UHJpY2VcIixcbiAgICBwYXRoOiBbXCJtaW5QcmljZVwiXSxcbiAgfSk7XG5cbmNvbnN0IGludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBzdGF0dXM6IHpcbiAgICAuZW51bShbXCJQRU5ESU5HXCIsIFwiQVBQUk9WRURcIiwgXCJSRUpFQ1RFRFwiXSlcbiAgICAudHJhbnNmb3JtKCh2YWwpID0+IHZhbCBhcyBcIlBFTkRJTkdcIiB8IFwiQVBQUk9WRURcIiB8IFwiUkVKRUNURURcIilcbiAgICAub3B0aW9uYWwoKSxcbiAgYWdlbnRJZDogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCBwYWNrYWdlUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IHBhY2thZ2VTbHVnUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBzbHVnOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2Ugc2x1ZyBpcyByZXF1aXJlZFwiIH0pLnRyaW0oKS5taW4oMSksXG59KTtcblxuY29uc3QgdXBkYXRlU3RhdHVzU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBzdGF0dXM6IHouZW51bShbXCJBUFBST1ZFRFwiLCBcIlJFSkVDVEVEXCJdLCB7XG4gICAgICByZXF1aXJlZF9lcnJvcjogXCJTdGF0dXMgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJTdGF0dXMgbXVzdCBiZSBBUFBST1ZFRCBvciBSRUpFQ1RFRFwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlVmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVBhY2thZ2VTY2hlbWEsXG4gIHVwZGF0ZVBhY2thZ2VTY2hlbWEsXG4gIHBhY2thZ2VRdWVyeVNjaGVtYSxcbiAgaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEsXG4gIHBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gIHBhY2thZ2VTbHVnUGFyYW1zU2NoZW1hLFxuICB1cGRhdGVTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgYmxvZ0NvbnRyb2xsZXIgfSBmcm9tIFwiLi9ibG9nLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGJsb2dWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2Jsb2cudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gTk9URTogYC9pbnRlcm5hbC8qYCByb3V0ZXMgTVVTVCBzdGF5IHJlZ2lzdGVyZWQgYmVmb3JlIGBHRVQgLzpzbHVnYCBiZWxvdyBcdTIwMTRcbi8vIEV4cHJlc3MgbWF0Y2hlcyB0b3AtZG93biwgYW5kIGEgbGl0ZXJhbCBzZWdtZW50IChgL2ludGVybmFsL2FsbGApIHdvdWxkXG4vLyBvdGhlcndpc2UgYmUgc3dhbGxvd2VkIGJ5IHRoZSBgOnNsdWdgIHBhcmFtIHJvdXRlIGFuZCA0MDQgZm9yZXZlci5cblxuLy8gMS4gQWxsIHBvc3RzIChhZG1pbiBtb2RlcmF0aW9uIFVJKSBcdTIwMTQgcmVnaXN0ZXJlZCBiZWZvcmUgLzpzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi9pbnRlcm5hbC9hbGxcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJsb2dWYWxpZGF0aW9ucy5pbnRlcm5hbFF1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRBbGxQb3N0cyxcbik7XG5cbi8vIDFiLiBPd24gcG9zdHMgKFwiTXkgUG9zdHNcIiBVSSBmb3IgYWdlbnRzL2FkbWlucykgXHUyMDE0IGJlZm9yZSAvOnNsdWdcbnJvdXRlci5nZXQoXG4gIFwiL215LXBvc3RzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBibG9nVmFsaWRhdGlvbnMuaW50ZXJuYWxRdWVyeVNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0TXlQb3N0cyxcbik7XG5cbi8vIDIuIFB1YmxpYyBsaXN0aW5nIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5XG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJsb2dWYWxpZGF0aW9ucy5wdWJsaWNRdWVyeVNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0UHVibGljUG9zdHMsXG4pO1xuXG4vLyAzLiBQdWJsaWMgcG9zdCBkZXRhaWwgYnkgc2x1Z1xucm91dGVyLmdldChcbiAgXCIvOnNsdWdcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFNsdWdQYXJhbXNTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldFBvc3RCeVNsdWcsXG4pO1xuXG4vLyA0LiBDcmVhdGUgcG9zdCAoYWdlbnQvYWRtaW4gYXV0aG9ycyBvd24gcG9zdHM7IG5ldyBwb3N0cyBzdGFydCBEUkFGVClcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYmxvZ1ZhbGlkYXRpb25zLmNyZWF0ZVBvc3RTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmNyZWF0ZVBvc3QsXG4pO1xuXG4vLyA1LiBQdWJsaXNoL3VucHVibGlzaCBwb3N0IChhZG1pbikgXHUyMDE0IHJlZ2lzdGVyZWQgYmVmb3JlIFBBVENIIC86aWQgZm9yIGNsYXJpdHlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogYmxvZ1ZhbGlkYXRpb25zLnVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIGJsb2dDb250cm9sbGVyLmNoYW5nZVBvc3RTdGF0dXMsXG4pO1xuXG4vLyA2LiBVcGRhdGUgcG9zdCAoYWdlbnQgb3duIC8gYWRtaW4gYW55KSBcdTIwMTQgYWdlbnQgZWRpdHMgcmVzZXQgdG8gRFJBRlRcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBibG9nVmFsaWRhdGlvbnMudXBkYXRlUG9zdFNjaGVtYSxcbiAgfSksXG4gIGJsb2dDb250cm9sbGVyLnVwZGF0ZVBvc3QsXG4pO1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSBwb3N0IChhZ2VudCBvd24gLyBhZG1pbiBhbnkpXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFBhcmFtc1NjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuc29mdERlbGV0ZVBvc3QsXG4pO1xuXG5leHBvcnQgY29uc3QgYmxvZ1JvdXRlcyA9IHJvdXRlcjtcbiIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgYmxvZ1NlcnZpY2UgfSBmcm9tIFwiLi9ibG9nLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgcG9zdCBjb250cm9sbGVyIChBR0VOVC9BRE1JTilcbmNvbnN0IGNyZWF0ZVBvc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5jcmVhdGVQb3N0KHJlcS51c2VyISwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCBjcmVhdGVkIHN1Y2Nlc3NmdWxseS4gSXQgd2lsbCBiZSB2aXNpYmxlIGFmdGVyIHB1Ymxpc2hpbmcuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBQdWJsaWMgbGlzdGluZyBjb250cm9sbGVyIChzZWFyY2ggKyBzb3J0ICsgcGFnaW5hdGlvbilcbmNvbnN0IGdldFB1YmxpY1Bvc3RzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0UHVibGljUG9zdHMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnXG5jb25zdCBnZXRQb3N0QnlTbHVnID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3Qgc2x1ZyA9IFN0cmluZyhyZXEucGFyYW1zLnNsdWcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldFBvc3RCeVNsdWcoc2x1Zyk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNC4gQWxsIHBvc3RzIGNvbnRyb2xsZXIgKEFETUlOIG1vZGVyYXRpb24pXG5jb25zdCBnZXRBbGxQb3N0cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldEFsbFBvc3RzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIHBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNGIuIE93biBwb3N0cyBjb250cm9sbGVyIChBR0VOVC9BRE1JTilcbmNvbnN0IGdldE15UG9zdHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRNeVBvc3RzKHJlcS51c2VyISwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDUuIFVwZGF0ZSBwb3N0IGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHVwZGF0ZVBvc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS51cGRhdGVQb3N0KHJlcS51c2VyISwgaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0IHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNi4gQ2hhbmdlIHBvc3Qgc3RhdHVzIGNvbnRyb2xsZXIgKEFETUlOIHB1Ymxpc2gvdW5wdWJsaXNoKVxuY29uc3QgY2hhbmdlUG9zdFN0YXR1cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmNoYW5nZVBvc3RTdGF0dXMoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0IHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBvc3QgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3Qgc29mdERlbGV0ZVBvc3QgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBhd2FpdCBibG9nU2VydmljZS5zb2Z0RGVsZXRlUG9zdChyZXEudXNlciEsIGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBibG9nQ29udHJvbGxlciA9IHtcbiAgY3JlYXRlUG9zdCxcbiAgZ2V0UHVibGljUG9zdHMsXG4gIGdldFBvc3RCeVNsdWcsXG4gIGdldEFsbFBvc3RzLFxuICBnZXRNeVBvc3RzLFxuICB1cGRhdGVQb3N0LFxuICBjaGFuZ2VQb3N0U3RhdHVzLFxuICBzb2Z0RGVsZXRlUG9zdCxcbn07XG4iLCAiaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuaW1wb3J0IHsgUG9zdFN0YXR1cywgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2x1Z2lmeSB9IGZyb20gXCIuLi8uLi91dGlscy9zbHVnaWZ5XCI7XG5pbXBvcnQge1xuICBJQ3JlYXRlUG9zdFBheWxvYWQsXG4gIElJbnRlcm5hbFBvc3RRdWVyeSxcbiAgSVBvc3RRdWVyeSxcbiAgSVJlcXVlc3RVc2VyLFxuICBJVXBkYXRlUG9zdFBheWxvYWQsXG4gIElVcGRhdGVQb3N0U3RhdHVzUGF5bG9hZCxcbn0gZnJvbSBcIi4vYmxvZy5pbnRlcmZhY2VcIjtcblxuLy8gUHVibGljIHBheWxvYWRzIGNhcnJ5IHRoZSBhdXRob3IncyBkaXNwbGF5IGluZm8gb25seSBcdTIwMTQgbmV2ZXIgZW1haWwvcm9sZS5cbmNvbnN0IHB1YmxpY0F1dGhvclNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSxcbn07XG5cbi8vIENvbGxpc2lvbi1zYWZlIHNsdWc6IGJhc2Ugc2x1ZyBmcm9tIHRoZSB0aXRsZSwgdGhlbiBgLTJgLCBgLTNgLCAuLi4gdXNpbmcgYVxuLy8gc2luZ2xlIHByZWZpeCBxdWVyeS4gUHVyZS1CYW5nbGEvZW1vamkgdGl0bGVzIGNhbid0IHNsdWdpZnkgXHUyMDE0IGZhbGwgYmFjayB0b1xuLy8gYGJsb2ctPHNob3J0SWQ+YCBzbyB0aGUgVVJMIGlzIGFsd2F5cyBtZWFuaW5nZnVsLlxuY29uc3QgZ2VuZXJhdGVVbmlxdWVTbHVnID0gYXN5bmMgKHRpdGxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICBjb25zdCBiYXNlID0gc2x1Z2lmeSh0aXRsZSkgfHwgYGJsb2ctJHtyYW5kb21VVUlEKCkuc2xpY2UoMCwgOCl9YDtcblxuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgd2hlcmU6IHsgc2x1ZzogeyBzdGFydHNXaXRoOiBiYXNlIH0gfSxcbiAgICBzZWxlY3Q6IHsgc2x1ZzogdHJ1ZSB9LFxuICB9KTtcblxuICBjb25zdCB1c2VkID0gbmV3IFNldChleGlzdGluZy5tYXAoKHApID0+IHAuc2x1ZykpO1xuICBpZiAoIXVzZWQuaGFzKGJhc2UpKSB7XG4gICAgcmV0dXJuIGJhc2U7XG4gIH1cblxuICBsZXQgc3VmZml4ID0gMjtcbiAgd2hpbGUgKHVzZWQuaGFzKGAke2Jhc2V9LSR7c3VmZml4fWApKSB7XG4gICAgc3VmZml4ICs9IDE7XG4gIH1cbiAgcmV0dXJuIGAke2Jhc2V9LSR7c3VmZml4fWA7XG59O1xuXG4vLyAxLiBDcmVhdGUgYSBwb3N0IChBR0VOVC9BRE1JTikuIE5ldyBwb3N0cyBzdGFydCBEUkFGVCBhbmQgbmV2ZXIgbGVhayBpbnRvXG4vLyAgICBwdWJsaWMgcXVlcmllcyB1bnRpbCBhbiBhZG1pbiBwdWJsaXNoZXMgdGhlbS5cbmNvbnN0IGNyZWF0ZVBvc3QgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYXlsb2FkOiBJQ3JlYXRlUG9zdFBheWxvYWQpID0+IHtcbiAgY29uc3Qgc2x1ZyA9IGF3YWl0IGdlbmVyYXRlVW5pcXVlU2x1ZyhwYXlsb2FkLnRpdGxlKTtcblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgdGl0bGU6IHBheWxvYWQudGl0bGUsXG4gICAgICBleGNlcnB0OiBwYXlsb2FkLmV4Y2VycHQsXG4gICAgICBjb250ZW50OiBwYXlsb2FkLmNvbnRlbnQsXG4gICAgICBjb3ZlckltYWdlOiBwYXlsb2FkLmNvdmVySW1hZ2UsXG4gICAgICBzbHVnLFxuICAgICAgYXV0aG9ySWQ6IHVzZXIuaWQsXG4gICAgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gMi4gUHVibGljIGJsb2cgbGlzdGluZyBcdTIwMTQgUFVCTElTSEVEICsgbm90LWRlbGV0ZWQgb25seSwgc2VhcmNoICsgc29ydC5cbmNvbnN0IGdldFB1YmxpY1Bvc3RzID0gYXN5bmMgKHF1ZXJ5OiBJUG9zdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5CbG9nUG9zdFdoZXJlSW5wdXQgPSB7XG4gICAgc3RhdHVzOiBQb3N0U3RhdHVzLlBVQkxJU0hFRCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zZWFyY2hcbiAgICAgID8ge1xuICAgICAgICAgIE9SOiBbXG4gICAgICAgICAgICB7IHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgICAgICB7IGV4Y2VycHQ6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9XG4gICAgICA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBzb3J0T3JkZXIgPSBxdWVyeS5zb3J0T3JkZXIgPz8gKHF1ZXJ5LnNvcnRCeSA9PT0gXCJvbGRlc3RcIiA/IFwiYXNjXCIgOiBcImRlc2NcIik7XG5cbiAgY29uc3Qgb3JkZXJCeU1hcDogUmVjb3JkPHN0cmluZywgUHJpc21hLkJsb2dQb3N0T3JkZXJCeVdpdGhSZWxhdGlvbklucHV0PiA9IHtcbiAgICBuZXdlc3Q6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgIG9sZGVzdDogeyBjcmVhdGVkQXQ6IFwiYXNjXCIgfSxcbiAgICB0aXRsZTogeyB0aXRsZTogc29ydE9yZGVyIH0sXG4gIH07XG5cbiAgY29uc3Qgb3JkZXJCeSA9IG9yZGVyQnlNYXBbcXVlcnkuc29ydEJ5ID8/IFwibmV3ZXN0XCJdID8/IG9yZGVyQnlNYXAubmV3ZXN0O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeSxcbiAgICAgIHNlbGVjdDoge1xuICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgdGl0bGU6IHRydWUsXG4gICAgICAgIHNsdWc6IHRydWUsXG4gICAgICAgIGV4Y2VycHQ6IHRydWUsXG4gICAgICAgIGNvdmVySW1hZ2U6IHRydWUsXG4gICAgICAgIGNyZWF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgdXBkYXRlZEF0OiB0cnVlLFxuICAgICAgICBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCxcbiAgICAgIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmJsb2dQb3N0LmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyAzLiBQdWJsaWMgcG9zdCBkZXRhaWwgYnkgc2x1ZyBcdTIwMTQgUFVCTElTSEVEICsgbm90LWRlbGV0ZWQgb25seS5cbmNvbnN0IGdldFBvc3RCeVNsdWcgPSBhc3luYyAoc2x1Zzogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHBvc3QgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZEZpcnN0KHtcbiAgICB3aGVyZTogeyBzbHVnLCBzdGF0dXM6IFBvc3RTdGF0dXMuUFVCTElTSEVELCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcblxuICBpZiAoIXBvc3QpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBvc3Qgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwb3N0O1xufTtcblxuLy8gNC4gQWxsIHBvc3RzIGZvciB0aGUgYWRtaW4gbW9kZXJhdGlvbiBVSSAoYW55IHN0YXR1cywgb3B0aW9uYWwgZmlsdGVyKS5cbmNvbnN0IGdldEFsbFBvc3RzID0gYXN5bmMgKHF1ZXJ5OiBJSW50ZXJuYWxQb3N0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkJsb2dQb3N0V2hlcmVJbnB1dCA9IHtcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zdGF0dXMgPyB7IHN0YXR1czogcXVlcnkuc3RhdHVzIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IGF1dGhvcjogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0gfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmJsb2dQb3N0LmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyA0Yi4gVGhlIGNhbGxlcidzIG93biBwb3N0cyAoQUdFTlQvQURNSU4gXCJNeSBQb3N0c1wiIFVJKSBcdTIwMTQgYW55IHN0YXR1cywgc2luY2Vcbi8vICAgICBhZ2VudHMgbXVzdCBzZWUgdGhlaXIgb3duIGRyYWZ0cyBiZWZvcmUgYW4gYWRtaW4gcHVibGlzaGVzIHRoZW0uXG5jb25zdCBnZXRNeVBvc3RzID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcXVlcnk6IElJbnRlcm5hbFBvc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQmxvZ1Bvc3RXaGVyZUlucHV0ID0ge1xuICAgIGF1dGhvcklkOiB1c2VyLmlkLFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgYXV0aG9yOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIEZldGNoICsgb3duZXJzaGlwIGdhdGUgc2hhcmVkIGJ5IFBBVENIIGFuZCBERUxFVEUuIEFETUlOIGJ5cGFzc2VzIG93bmVyc2hpcDtcbi8vIEFHRU5UIGVkaXRzIGFyZSBjb25maW5lZCB0byB0aGVpciBvd24gcG9zdHMuXG5jb25zdCBmaW5kT3duZWRQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcG9zdElkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gIH0pO1xuXG4gIGlmICghcG9zdCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUG9zdCBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiAmJiBwb3N0LmF1dGhvcklkICE9PSB1c2VyLmlkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2FuIG9ubHkgYWN0IG9uIHlvdXIgb3duIHBvc3RzLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwb3N0O1xufTtcblxuLy8gNS4gVXBkYXRlIGEgcG9zdC4gU2x1ZyBuZXZlciBjaGFuZ2VzIChrZWVwcyBsaW5rcy9ib29rbWFya3MgdmFsaWQpLlxuLy8gICAgQUdFTlQgZWRpdHMgcmVzZXQgc3RhdHVzIHRvIERSQUZUIChyZS1wdWJsaXNoIHZpYSAvOmlkL3N0YXR1cyk7XG4vLyAgICBBRE1JTiBlZGl0cyBwcmVzZXJ2ZSBzdGF0dXMuXG5jb25zdCB1cGRhdGVQb3N0ID0gYXN5bmMgKFxuICB1c2VyOiBJUmVxdWVzdFVzZXIsXG4gIHBvc3RJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlUG9zdFBheWxvYWQsXG4pID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUG9zdCh1c2VyLCBwb3N0SWQpO1xuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZUlucHV0ID0ge1xuICAgIC4uLihwYXlsb2FkLnRpdGxlICE9PSB1bmRlZmluZWQgPyB7IHRpdGxlOiBwYXlsb2FkLnRpdGxlIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuZXhjZXJwdCAhPT0gdW5kZWZpbmVkID8geyBleGNlcnB0OiBwYXlsb2FkLmV4Y2VycHQgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5jb250ZW50ICE9PSB1bmRlZmluZWQgPyB7IGNvbnRlbnQ6IHBheWxvYWQuY29udGVudCB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNvdmVySW1hZ2UgIT09IHVuZGVmaW5lZFxuICAgICAgPyB7IGNvdmVySW1hZ2U6IHBheWxvYWQuY292ZXJJbWFnZSB9XG4gICAgICA6IHt9KSxcbiAgICAuLi4odXNlci5yb2xlICE9PSBSb2xlLkFETUlOID8geyBzdGF0dXM6IFBvc3RTdGF0dXMuRFJBRlQgfSA6IHt9KSxcbiAgfTtcblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICAgIGRhdGEsXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDYuIFB1Ymxpc2gvdW5wdWJsaXNoIGEgcG9zdCAoYWRtaW4pLlxuY29uc3QgY2hhbmdlUG9zdFN0YXR1cyA9IGFzeW5jIChcbiAgcG9zdElkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQb3N0U3RhdHVzUGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRVbmlxdWVPclRocm93KHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gIH0pO1xuXG4gIGlmIChwb3N0LmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiQ2Fubm90IGNoYW5nZSB0aGUgc3RhdHVzIG9mIGEgZGVsZXRlZCBwb3N0LlwiKTtcbiAgfVxuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YTogeyBzdGF0dXM6IHBheWxvYWQuc3RhdHVzIH0sXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDcuIFNvZnQgZGVsZXRlIChhZG1pbiBhbnksIGFnZW50IG93bikuXG5jb25zdCBzb2Z0RGVsZXRlUG9zdCA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBvc3RJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IGZpbmRPd25lZFBvc3QodXNlciwgcG9zdElkKTtcblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGJsb2dTZXJ2aWNlID0ge1xuICBjcmVhdGVQb3N0LFxuICBnZXRQdWJsaWNQb3N0cyxcbiAgZ2V0UG9zdEJ5U2x1ZyxcbiAgZ2V0QWxsUG9zdHMsXG4gIGdldE15UG9zdHMsXG4gIHVwZGF0ZVBvc3QsXG4gIGNoYW5nZVBvc3RTdGF0dXMsXG4gIHNvZnREZWxldGVQb3N0LFxufTtcbiIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCB0aXRsZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlRpdGxlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDMsIFwiVGl0bGUgbXVzdCBiZSBhdCBsZWFzdCAzIGNoYXJhY3RlcnNcIilcbiAgLm1heCgyMDAsIFwiVGl0bGUgbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBleGNlcnB0U2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiRXhjZXJwdCBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigxLCBcIkV4Y2VycHQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgLm1heCg1MDAsIFwiRXhjZXJwdCBtdXN0IGJlIGF0IG1vc3QgNTAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGNvbnRlbnRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb250ZW50IGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEsIFwiQ29udGVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAubWF4KDEwMDAwLCBcIkNvbnRlbnQgbXVzdCBiZSBhdCBtb3N0IDEwMDAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGNvdmVySW1hZ2VTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb3ZlciBpbWFnZSBpcyByZXF1aXJlZFwiIH0pXG4gIC51cmwoXCJDb3ZlciBpbWFnZSBtdXN0IGJlIGEgdmFsaWQgVVJMXCIpO1xuXG5jb25zdCBjcmVhdGVQb3N0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEsXG4gICAgZXhjZXJwdDogZXhjZXJwdFNjaGVtYSxcbiAgICBjb250ZW50OiBjb250ZW50U2NoZW1hLFxuICAgIGNvdmVySW1hZ2U6IGNvdmVySW1hZ2VTY2hlbWEsXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlUG9zdFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgZXhjZXJwdDogZXhjZXJwdFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNvbnRlbnQ6IGNvbnRlbnRTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBjb3ZlckltYWdlOiBjb3ZlckltYWdlU2NoZW1hLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiBPYmplY3Qua2V5cyhkYXRhKS5sZW5ndGggPiAwLCB7XG4gICAgbWVzc2FnZTogXCJBdCBsZWFzdCBvbmUgZmllbGQgbXVzdCBiZSBwcm92aWRlZCB0byB1cGRhdGVcIixcbiAgfSk7XG5cbmNvbnN0IHBvc3RQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBvc3QgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgcG9zdFNsdWdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHNsdWc6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUG9zdCBzbHVnIGlzIHJlcXVpcmVkXCIgfSkudHJpbSgpLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVTdGF0dXNTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHN0YXR1czogei5lbnVtKFtcIkRSQUZUXCIsIFwiUFVCTElTSEVEXCJdLCB7XG4gICAgICByZXF1aXJlZF9lcnJvcjogXCJTdGF0dXMgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJTdGF0dXMgbXVzdCBiZSBEUkFGVCBvciBQVUJMSVNIRURcIixcbiAgICB9KSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCBwdWJsaWNRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgc29ydEJ5OiB6LmVudW0oW1wibmV3ZXN0XCIsIFwib2xkZXN0XCIsIFwidGl0bGVcIl0pLmRlZmF1bHQoXCJuZXdlc3RcIiksXG4gICAgc29ydE9yZGVyOiB6LmVudW0oW1wiYXNjXCIsIFwiZGVzY1wiXSkub3B0aW9uYWwoKSxcbiAgfSk7XG5cbmNvbnN0IGludGVybmFsUXVlcnlTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICAgIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgICBzdGF0dXM6IHpcbiAgICAgIC5lbnVtKFtcIkRSQUZUXCIsIFwiUFVCTElTSEVEXCJdKVxuICAgICAgLnRyYW5zZm9ybSgodmFsKSA9PiB2YWwgYXMgXCJEUkFGVFwiIHwgXCJQVUJMSVNIRURcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICB9KTtcblxuZXhwb3J0IGNvbnN0IGJsb2dWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlUG9zdFNjaGVtYSxcbiAgdXBkYXRlUG9zdFNjaGVtYSxcbiAgcG9zdFBhcmFtc1NjaGVtYSxcbiAgcG9zdFNsdWdQYXJhbXNTY2hlbWEsXG4gIHVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgcHVibGljUXVlcnlTY2hlbWEsXG4gIGludGVybmFsUXVlcnlTY2hlbWEsXG59O1xuIiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBkYXNoYm9hcmRDb250cm9sbGVyIH0gZnJvbSBcIi4vZGFzaGJvYXJkLmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGRhc2hib2FyZFZhbGlkYXRpb25zIH0gZnJvbSBcIi4vZGFzaGJvYXJkLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBcdTIwMTQgcGxhdGZvcm0td2lkZSBhbmFseXRpY3NcbnJvdXRlci5nZXQoXG4gIFwiL2FkbWluXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBkYXNoYm9hcmRWYWxpZGF0aW9ucy5kYXNoYm9hcmRRdWVyeVNjaGVtYSB9KSxcbiAgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRBZG1pbkRhc2hib2FyZCxcbik7XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBcdTIwMTQgb3duIHBhY2thZ2VzL2Jvb2tpbmdzL3JldmVudWUvcGVyZm9ybWFuY2VcbnJvdXRlci5nZXQoXG4gIFwiL2FnZW50XCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBkYXNoYm9hcmRWYWxpZGF0aW9ucy5kYXNoYm9hcmRRdWVyeVNjaGVtYSB9KSxcbiAgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRBZ2VudERhc2hib2FyZCxcbik7XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIFx1MjAxNCBvd24gYm9va2luZ3MvdXBjb21pbmcvc3BlbmRcbnJvdXRlci5nZXQoXG4gIFwiL3VzZXJcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogZGFzaGJvYXJkVmFsaWRhdGlvbnMuZGFzaGJvYXJkUXVlcnlTY2hlbWEgfSksXG4gIGRhc2hib2FyZENvbnRyb2xsZXIuZ2V0VXNlckRhc2hib2FyZCxcbik7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBkYXNoYm9hcmRTZXJ2aWNlIH0gZnJvbSBcIi4vZGFzaGJvYXJkLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBBZG1pbiBkYXNoYm9hcmQgY29udHJvbGxlciAoQURNSU4pXG5jb25zdCBnZXRBZG1pbkRhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0QWRtaW5EYXNoYm9hcmQoXG4gICAgICBOdW1iZXIocmVxLnF1ZXJ5LmRheXMpLFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGFzaGJvYXJkIGRhdGEgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBBZ2VudCBkYXNoYm9hcmQgY29udHJvbGxlciAoQUdFTlQpXG5jb25zdCBnZXRBZ2VudERhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0QWdlbnREYXNoYm9hcmQoXG4gICAgICB1c2VySWQsXG4gICAgICBOdW1iZXIocmVxLnF1ZXJ5LmRheXMpLFxuICAgICk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGFzaGJvYXJkIGRhdGEgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBVc2VyIGRhc2hib2FyZCBjb250cm9sbGVyIChVU0VSKVxuY29uc3QgZ2V0VXNlckRhc2hib2FyZCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRhc2hib2FyZFNlcnZpY2UuZ2V0VXNlckRhc2hib2FyZChcbiAgICAgIHVzZXJJZCxcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRDb250cm9sbGVyID0ge1xuICBnZXRBZG1pbkRhc2hib2FyZCxcbiAgZ2V0QWdlbnREYXNoYm9hcmQsXG4gIGdldFVzZXJEYXNoYm9hcmQsXG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMsIFBhY2thZ2VTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7XG4gIElBZ2VudERhc2hib2FyZCxcbiAgSUFkbWluRGFzaGJvYXJkLFxuICBJQm9va2luZ3NCeVN0YXR1cyxcbiAgSVJldmVudWVQb2ludCxcbiAgSVVzZXJEYXNoYm9hcmQsXG59IGZyb20gXCIuL2Rhc2hib2FyZC5pbnRlcmZhY2VcIjtcblxuLy8gTW9uZXkgaXMgYERlY2ltYWwoMTAsMilgIGluIHRoZSBzY2hlbWEgKEFHRU5UUy5tZCkgXHUyMDE0IG1hcCB0byBOdW1iZXIgb24gcmV0dXJuLlxuY29uc3QgdG9OdW1iZXIgPSAodmFsdWU6IHVua25vd24pOiBudW1iZXIgPT4gTnVtYmVyKHZhbHVlID8/IDApO1xuXG4vLyBCb29raW5nLXN0YXR1cyBicmVha2Rvd24gdmlhIGdyb3VwQnkgKyBfY291bnQuIE9wdGlvbmFsIHNjb3BlIGxpbWl0cyBpdCB0b1xuLy8gYW4gYWdlbnQncyBvd24gbm9uLWRlbGV0ZWQgcGFja2FnZXMgb3IgYSBzaW5nbGUgdXNlcidzIGJvb2tpbmdzLlxuY29uc3QgZ2V0Qm9va2luZ3NCeVN0YXR1cyA9IGFzeW5jIChcbiAgc2NvcGU6IHsgYWdlbnRJZD86IHN0cmluZzsgdXNlcklkPzogc3RyaW5nIH0gPSB7fSxcbik6IFByb21pc2U8SUJvb2tpbmdzQnlTdGF0dXNbXT4gPT4ge1xuICBjb25zdCBncm91cGVkID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZ3JvdXBCeSh7XG4gICAgYnk6IFtcInN0YXR1c1wiXSxcbiAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgIHdoZXJlOiBzY29wZS5hZ2VudElkXG4gICAgICA/IHsgcGFja2FnZTogeyBhZ2VudElkOiBzY29wZS5hZ2VudElkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0gfVxuICAgICAgOiBzY29wZS51c2VySWRcbiAgICAgICAgPyB7IHVzZXJJZDogc2NvcGUudXNlcklkIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gIH0pO1xuXG4gIHJldHVybiBncm91cGVkXG4gICAgLm1hcCgoZykgPT4gKHsgc3RhdHVzOiBnLnN0YXR1cywgY291bnQ6IGcuX2NvdW50Ll9hbGwgfSkpXG4gICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KTtcbn07XG5cbi8vIFJldmVudWUgdHJlbmQ6IG9uZSByb3cgcGVyIGRheSBmb3IgdGhlIGxhc3QgYGRheXNgIGRheXMsIGJ1Y2tldGluZyBDT01QTEVURURcbi8vIGJvb2tpbmdzIGJ5IHRoZWlyIGB1cGRhdGVkQXRgIFx1MjAxNCB0aGUgdGltZXN0YW1wIG9mIHRoZSB0cmFuc2l0aW9uIGludG9cbi8vIENPTVBMRVRFRCAoYSB0ZXJtaW5hbCBzdGF0ZSwgc28gaXQgaXMgdGhlIGxhc3Qgd3JpdGUpLiBgY3JlYXRlZEF0YCBpcyB3aGVuXG4vLyB0aGUgYm9va2luZyB3YXMgbWFkZSAoUEVORElORykgYW5kIG5ldmVyIG1vdmVzLCB3aGljaCB3b3VsZCBtaXMtZGF0ZSByZXZlbnVlXG4vLyB3ZWVrcyBsYXRlci4gUG9zdGdyZXMgZ2VuZXJhdGVfc2VyaWVzIGd1YXJhbnRlZXMgYSBkZW5zZSBzZXJpZXMgKHplcm8tZmlsbGVkXG4vLyBkYXlzKSBcdTIwMTQgYmV0dGVyIGFuZCBmYXN0ZXIgdGhhbiBhIHBlci1kYXkgSlMgbG9vcC4gT3B0aW9uYWwgc2NvcGU6IGFuIGFnZW50J3Ncbi8vIG93biBub24tZGVsZXRlZCBwYWNrYWdlcywgb3IgYSBzaW5nbGUgdXNlcidzIHNwZW5kLlxuY29uc3QgZ2V0UmV2ZW51ZU92ZXJUaW1lID0gYXN5bmMgKFxuICBkYXlzOiBudW1iZXIsXG4gIHNjb3BlOiB7IGFnZW50SWQ/OiBzdHJpbmc7IHVzZXJJZD86IHN0cmluZyB9ID0ge30sXG4pOiBQcm9taXNlPElSZXZlbnVlUG9pbnRbXT4gPT4ge1xuICBjb25zdCBhZ2VudFNjb3BlID0gc2NvcGUuYWdlbnRJZFxuICAgID8gYEFORCBiLlwicGFja2FnZUlkXCIgSU4gKFxuICAgICAgICAgU0VMRUNUIHAuXCJpZFwiXG4gICAgICAgICBGUk9NIFwidG91cl9wYWNrYWdlc1wiIHBcbiAgICAgICAgIFdIRVJFIHAuXCJhZ2VudElkXCIgPSAkMlxuICAgICAgICAgICBBTkQgcC5cImlzRGVsZXRlZFwiID0gZmFsc2VcbiAgICAgICApYFxuICAgIDogXCJcIjtcbiAgY29uc3QgdXNlclNjb3BlID0gc2NvcGUudXNlcklkID8gYEFORCBiLlwidXNlcklkXCIgPSAkMmAgOiBcIlwiO1xuICBjb25zdCB3aGVyZUNsYXVzZSA9IHNjb3BlLmFnZW50SWQgPyBhZ2VudFNjb3BlIDogdXNlclNjb3BlO1xuXG4gIGNvbnN0IHJvd3MgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3VW5zYWZlPFxuICAgIHsgZGF0ZTogc3RyaW5nOyByZXZlbnVlOiBudW1iZXIgfVtdXG4gID4oXG4gICAgYFxuICAgIFNFTEVDVCB0b19jaGFyKGRheXMuZCwgJ1lZWVktTU0tREQnKSBBUyBkYXRlLFxuICAgICAgICAgICBDT0FMRVNDRShTVU0oYi5cInRvdGFsUHJpY2VcIiksIDApOjpmbG9hdDggQVMgcmV2ZW51ZVxuICAgIEZST00gZ2VuZXJhdGVfc2VyaWVzKFxuICAgICAgQ1VSUkVOVF9EQVRFIC0gbWFrZV9pbnRlcnZhbChkYXlzID0+ICQxOjppbnQgLSAxKSxcbiAgICAgIENVUlJFTlRfREFURSxcbiAgICAgICcxIGRheSc6OmludGVydmFsXG4gICAgKSBBUyBkYXlzKGQpXG4gICAgTEVGVCBKT0lOIFwiYm9va2luZ3NcIiBiXG4gICAgICBPTiBkYXRlX3RydW5jKCdkYXknLCBiLlwidXBkYXRlZEF0XCIpOjpkYXRlID0gZGF5cy5kXG4gICAgICBBTkQgYi5cInN0YXR1c1wiID0gJ0NPTVBMRVRFRCdcbiAgICAgICR7d2hlcmVDbGF1c2V9XG4gICAgR1JPVVAgQlkgZGF5cy5kXG4gICAgT1JERVIgQlkgZGF5cy5kIEFTQ1xuICAgIGAsXG4gICAgZGF5cyxcbiAgICAuLi4oc2NvcGUuYWdlbnRJZCB8fCBzY29wZS51c2VySWQgPyBbc2NvcGUuYWdlbnRJZCA/PyBzY29wZS51c2VySWRdIDogW10pLFxuICApO1xuXG4gIHJldHVybiByb3dzO1xufTtcblxuLy8gUGFja2FnZS1pZCBzY29wZSBmb3IgYm9va2luZyBxdWVyaWVzLiBDYWxsZXJzIHNob3J0LWNpcmN1aXQgdGhlIGVtcHR5IGNhc2Vcbi8vIChhbiBhZ2VudCB3aXRoIG5vIHBhY2thZ2VzKSwgYnV0IGFuIGBpbjogW11gIGZhbGxiYWNrIGtlZXBzIHRoZSB0eXBlXG4vLyBub24tbnVsbGFibGUgd2hpbGUgc3RpbGwgbWF0Y2hpbmcgbm90aGluZyBpZiBpdCBldmVyIHNsaXBzIHRocm91Z2guXG5jb25zdCB0b1BhY2thZ2VJZFNjb3BlID0gKFxuICBwYWNrYWdlSWRzOiBzdHJpbmdbXSxcbik6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9PlxuICBwYWNrYWdlSWRzLmxlbmd0aFxuICAgID8geyBwYWNrYWdlSWQ6IHsgaW46IHBhY2thZ2VJZHMgfSB9XG4gICAgOiB7IHBhY2thZ2VJZDogeyBpbjogW10gfSB9O1xuXG4vLyAxLiBBZG1pbiBkYXNoYm9hcmQgXHUyMDE0IHBsYXRmb3JtLXdpZGUgY291bnRzLCBicmVha2Rvd25zIGFuZCByZXZlbnVlIHRyZW5kLlxuY29uc3QgZ2V0QWRtaW5EYXNoYm9hcmQgPSBhc3luYyAoZGF5czogbnVtYmVyKTogUHJvbWlzZTxJQWRtaW5EYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW1xuICAgIHRvdGFsVXNlcnMsXG4gICAgdG90YWxQYWNrYWdlcyxcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsUmV2ZW51ZSxcbiAgICB1c2Vyc0J5Um9sZSxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHBhY2thZ2VzQnlDYXRlZ29yeSxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnVzZXIuY291bnQoeyB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0gfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9IH0pLFxuICAgIHByaXNtYS5ib29raW5nLmNvdW50KCksXG4gICAgcHJpc21hLmJvb2tpbmcuYWdncmVnYXRlKHtcbiAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCB9LFxuICAgIH0pLFxuICAgIHByaXNtYS51c2VyLmdyb3VwQnkoe1xuICAgICAgYnk6IFtcInJvbGVcIl0sXG4gICAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIH0pLFxuICAgIGdldEJvb2tpbmdzQnlTdGF0dXMoKSxcbiAgICBwcmlzbWEudG91clBhY2thZ2VcbiAgICAgIC5ncm91cEJ5KHtcbiAgICAgICAgYnk6IFtcImNhdGVnb3J5SWRcIl0sXG4gICAgICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgICAgIHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIH0pXG4gICAgICAudGhlbihhc3luYyAoZ3JvdXBlZCkgPT4ge1xuICAgICAgICBjb25zdCBjYXRlZ29yeUlkcyA9IGdyb3VwZWQubWFwKChnKSA9PiBnLmNhdGVnb3J5SWQpO1xuICAgICAgICBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KHtcbiAgICAgICAgICB3aGVyZTogeyBpZDogeyBpbjogY2F0ZWdvcnlJZHMgfSB9LFxuICAgICAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9LFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgbmFtZU1hcCA9IG5ldyBNYXAoY2F0ZWdvcmllcy5tYXAoKGMpID0+IFtjLmlkLCBjLm5hbWVdKSk7XG5cbiAgICAgICAgcmV0dXJuIGdyb3VwZWRcbiAgICAgICAgICAubWFwKChnKSA9PiAoe1xuICAgICAgICAgICAgY2F0ZWdvcnk6IG5hbWVNYXAuZ2V0KGcuY2F0ZWdvcnlJZCkgPz8gXCJVbmtub3duXCIsXG4gICAgICAgICAgICBjb3VudDogZy5fY291bnQuX2FsbCxcbiAgICAgICAgICB9KSlcbiAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpO1xuICAgICAgfSksXG4gICAgZ2V0UmV2ZW51ZU92ZXJUaW1lKGRheXMpLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsVXNlcnMsXG4gICAgdG90YWxQYWNrYWdlcyxcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsUmV2ZW51ZTogdG9OdW1iZXIodG90YWxSZXZlbnVlLl9zdW0udG90YWxQcmljZSksXG4gICAgdXNlcnNCeVJvbGU6IHVzZXJzQnlSb2xlXG4gICAgICAubWFwKChnKSA9PiAoeyByb2xlOiBnLnJvbGUsIGNvdW50OiBnLl9jb3VudC5fYWxsIH0pKVxuICAgICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KSxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHBhY2thZ2VzQnlDYXRlZ29yeSxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIH07XG59O1xuXG4vLyAyLiBBZ2VudCBkYXNoYm9hcmQgXHUyMDE0IHNjb3BlZCB0byB0aGUgYWdlbnQncyBvd24gcGFja2FnZXMuIEZldGNoZXMgb3duZWRcbi8vICAgIHBhY2thZ2UgaWRzIG9uY2UsIHRoZW4gZXZlcnkgYWdncmVnYXRlIHJldXNlcyB0aGF0IHNjb3BlIHNvIHRoZSB3aG9sZVxuLy8gICAgYnVuZGxlIGlzIG9uZSBQcm9taXNlLmFsbCAobm8gcGVyLWl0ZW0gcXVlcmllcykuXG5jb25zdCBnZXRBZ2VudERhc2hib2FyZCA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIGRheXM6IG51bWJlcixcbik6IFByb21pc2U8SUFnZW50RGFzaGJvYXJkPiA9PiB7XG4gIGNvbnN0IFtvd25lZFBhY2thZ2VzLCBib29raW5nc0J5U3RhdHVzLCBhdmVyYWdlUmF0aW5nXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHsgYWdlbnRJZDogdXNlcklkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KSxcbiAgICBnZXRCb29raW5nc0J5U3RhdHVzKHsgYWdlbnRJZDogdXNlcklkIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5hZ2dyZWdhdGUoe1xuICAgICAgX2F2ZzogeyByYXRpbmc6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGFnZW50SWQ6IHVzZXJJZCxcbiAgICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSk7XG5cbiAgY29uc3QgcGFja2FnZUlkcyA9IG93bmVkUGFja2FnZXMubWFwKChwKSA9PiBwLmlkKTtcblxuICAvLyBBbiBhZ2VudCB3aXRoIG5vIHBhY2thZ2VzIG11c3Qgc2VlIHplcm9zIFx1MjAxNCBzY29wZSBpcyB1bmRlZmluZWQgZm9yIGFuIGVtcHR5XG4gIC8vIGxpc3QsIGFuZCBhIGJhcmUgYHdoZXJlOiB1bmRlZmluZWRgIC8gYEFORDogW3t9XWAgd291bGQgb3RoZXJ3aXNlIG1hdGNoIHRoZVxuICAvLyB3aG9sZSBwbGF0Zm9ybSAoY3Jvc3MtYWdlbnQgZGF0YSBsZWFrKS4gU2hvcnQtY2lyY3VpdCBoZXJlIGluc3RlYWQuXG4gIGlmIChwYWNrYWdlSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB7XG4gICAgICB0b3RhbFBhY2thZ2VzOiAwLFxuICAgICAgdG90YWxCb29raW5nczogMCxcbiAgICAgIHRvdGFsUmV2ZW51ZTogMCxcbiAgICAgIGF2ZXJhZ2VSYXRpbmc6IE1hdGgucm91bmQoKGF2ZXJhZ2VSYXRpbmcuX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMCxcbiAgICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgICByZXZlbnVlT3ZlclRpbWU6IGF3YWl0IGdldFJldmVudWVPdmVyVGltZShkYXlzLCB7IGFnZW50SWQ6IHVzZXJJZCB9KSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgc2NvcGUgPSB0b1BhY2thZ2VJZFNjb3BlKHBhY2thZ2VJZHMpO1xuXG4gIGNvbnN0IFt0b3RhbFBhY2thZ2VzLCB0b3RhbEJvb2tpbmdzLCB0b3RhbFJldmVudWUsIHJldmVudWVPdmVyVGltZV0gPVxuICAgIGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHBhY2thZ2VJZHMubGVuZ3RoLFxuICAgICAgcHJpc21hLmJvb2tpbmcuY291bnQoeyB3aGVyZTogc2NvcGUgfSksXG4gICAgICBwcmlzbWEuYm9va2luZy5hZ2dyZWdhdGUoe1xuICAgICAgICBfc3VtOiB7IHRvdGFsUHJpY2U6IHRydWUgfSxcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBBTkQ6IFtzY29wZSwgeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVEIH1dLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cywgeyBhZ2VudElkOiB1c2VySWQgfSksXG4gICAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlOiB0b051bWJlcih0b3RhbFJldmVudWUuX3N1bS50b3RhbFByaWNlKSxcbiAgICBhdmVyYWdlUmF0aW5nOiBNYXRoLnJvdW5kKChhdmVyYWdlUmF0aW5nLl9hdmcucmF0aW5nID8/IDApICogMTApIC8gMTAsXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIH07XG59O1xuXG4vLyAzLiBVc2VyIGRhc2hib2FyZCBcdTIwMTQgdGhlIHVzZXIncyBib29raW5ncywgc3BlbmQsIGFuZCB1cGNvbWluZyB0cmlwcy5cbmNvbnN0IGdldFVzZXJEYXNoYm9hcmQgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBkYXlzID0gMzAsXG4pOiBQcm9taXNlPElVc2VyRGFzaGJvYXJkPiA9PiB7XG4gIGNvbnN0IFt0b3RhbEJvb2tpbmdzLCB0b3RhbFNwZW5kLCB1cGNvbWluZywgYm9va2luZ3NCeVN0YXR1cywgcmV2ZW51ZU92ZXJUaW1lXSA9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgcHJpc21hLmJvb2tpbmcuY291bnQoeyB3aGVyZTogeyB1c2VySWQgfSB9KSxcbiAgICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgICB3aGVyZTogeyB1c2VySWQsIHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfSxcbiAgICAgIH0pLFxuICAgICAgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoe1xuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIHVzZXJJZCxcbiAgICAgICAgICBzdGF0dXM6IHtcbiAgICAgICAgICAgIGluOiBbQm9va2luZ1N0YXR1cy5QRU5ESU5HLCBCb29raW5nU3RhdHVzLlBBSUQsIEJvb2tpbmdTdGF0dXMuQ09ORklSTUVEXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRyYXZlbERhdGU6IHsgZ3Q6IG5ldyBEYXRlKCkgfSxcbiAgICAgICAgfSxcbiAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgICAgdHJhdmVsRGF0ZTogdHJ1ZSxcbiAgICAgICAgICB0cmF2ZWxlcnM6IHRydWUsXG4gICAgICAgICAgdG90YWxQcmljZTogdHJ1ZSxcbiAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgcGFja2FnZTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIHRpdGxlOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgICAgICAgfSxcbiAgICAgICAgb3JkZXJCeTogeyB0cmF2ZWxEYXRlOiBcImFzY1wiIH0sXG4gICAgICAgIHRha2U6IDUsXG4gICAgICB9KSxcbiAgICAgIGdldEJvb2tpbmdzQnlTdGF0dXMoeyB1c2VySWQgfSksXG4gICAgICBnZXRSZXZlbnVlT3ZlclRpbWUoZGF5cywgeyB1c2VySWQgfSksXG4gICAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsU3BlbmQ6IHRvTnVtYmVyKHRvdGFsU3BlbmQuX3N1bS50b3RhbFByaWNlKSxcbiAgICB1cGNvbWluZ0NvdW50OiB1cGNvbWluZy5sZW5ndGgsXG4gICAgdXBjb21pbmc6IHVwY29taW5nLm1hcCgoYikgPT4gKHtcbiAgICAgIC4uLmIsXG4gICAgICB0b3RhbFByaWNlOiBOdW1iZXIoYi50b3RhbFByaWNlKSxcbiAgICB9KSksXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkU2VydmljZSA9IHtcbiAgZ2V0QWRtaW5EYXNoYm9hcmQsXG4gIGdldEFnZW50RGFzaGJvYXJkLFxuICBnZXRVc2VyRGFzaGJvYXJkLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgZGFzaGJvYXJkUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGRheXM6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoMzY1KS5kZWZhdWx0KDMwKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkVmFsaWRhdGlvbnMgPSB7XG4gIGRhc2hib2FyZFF1ZXJ5U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHBheW1lbnRDb250cm9sbGVyIH0gZnJvbSBcIi4vcGF5bWVudC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBwYXltZW50VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9wYXltZW50LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE9wZW4gYSBnYXRld2F5IHNlc3Npb24gZm9yIHRoZSB1c2VyJ3MgcGVuZGluZyBib29raW5nIChVU0VSIG9ubHkpLlxucm91dGVyLnBvc3QoXG4gIFwiL2NyZWF0ZVwiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5jcmVhdGVTY2hlbWEgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmNyZWF0ZVBheW1lbnQsXG4pO1xuXG4vLyBQdWJsaWMgXHUyMDE0IFNTTENvbW1lcnogUE9TVHMgdGhlIG91dGNvbWUgaGVyZSAoc3VjY2Vzcy9mYWlsL2NhbmNlbCkgYW5kIHdlXG4vLyByZWRpcmVjdCB0aGUgYnJvd3NlciB0byB0aGUgZnJvbnRlbmQgcmVzdWx0IHBhZ2UuXG5yb3V0ZXIucG9zdChcbiAgXCIvY29uZmlybVwiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHF1ZXJ5OiBwYXltZW50VmFsaWRhdGlvbnMuY2FsbGJhY2tRdWVyeVNjaGVtYSxcbiAgICBib2R5OiBwYXltZW50VmFsaWRhdGlvbnMuZ2F0ZXdheVJlc3VsdFNjaGVtYSxcbiAgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmNvbmZpcm1QYXltZW50LFxuKTtcblxuLy8gUHVibGljIFx1MjAxNCBTU0xDb21tZXJ6IGluc3RhbnQgcGF5bWVudCBub3RpZmljYXRpb247IHNhbWUgaWRlbXBvdGVudCBzZXR0bGUuXG5yb3V0ZXIucG9zdChcbiAgXCIvaXBuXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcXVlcnk6IHBheW1lbnRWYWxpZGF0aW9ucy5jYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICAgIGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5nYXRld2F5UmVzdWx0U2NoZW1hLFxuICB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuaXBuLFxuKTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuaW1wb3J0IHsgSUdhdGV3YXlSZXN1bHQgfSBmcm9tIFwiLi9wYXltZW50LmludGVyZmFjZVwiO1xuaW1wb3J0IHsgcGF5bWVudFNlcnZpY2UgfSBmcm9tIFwiLi9wYXltZW50LnNlcnZpY2VcIjtcblxuY29uc3QgY3JlYXRlUGF5bWVudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgcGF5bWVudFNlcnZpY2UuY3JlYXRlUGF5bWVudFNlc3Npb24odXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQYXltZW50IHNlc3Npb24gY3JlYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBzZXNzaW9uLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gUHVibGljIGNhbGxiYWNrIHRhcmdldCBcdTIwMTQgU1NMQ29tbWVyeiBQT1NUcyBoZXJlIChzZXJ2ZXItdG8tc2VydmVyKSBhZnRlciB0aGVcbi8vIHNob3BwZXIgZmluaXNoZXMgYXQgdGhlIGdhdGV3YXkuIFdlIHNldHRsZSB0aGUgcGF5bWVudCwgdGhlbiBib3VuY2UgdGhlXG4vLyBicm93c2VyIHRvIHRoZSBmcm9udGVuZCByZXN1bHQgcGFnZS5cbmNvbnN0IGNvbmZpcm1QYXltZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgYm9va2luZ0lkID0gU3RyaW5nKHJlcS5xdWVyeS5ib29raW5nSWQpO1xuICAgIGNvbnN0IHRyYW5JZCA9IFN0cmluZyhyZXEucXVlcnkudHJhbklkKTtcbiAgICBjb25zdCBzdGF0dXMgPSBTdHJpbmcocmVxLnF1ZXJ5LnN0YXR1cyA/PyBcImZhaWxcIik7XG5cbiAgICBhd2FpdCBwYXltZW50U2VydmljZS5wcm9jZXNzR2F0ZXdheVJlc3VsdChcbiAgICAgIGJvb2tpbmdJZCxcbiAgICAgIHRyYW5JZCxcbiAgICAgIHJlcS5ib2R5IGFzIElHYXRld2F5UmVzdWx0LFxuICAgICk7XG5cbiAgICBjb25zdCByZWRpcmVjdEJhc2UgPVxuICAgICAgY29uZmlnLm5vZGVfZW52ID09PSBcInByb2R1Y3Rpb25cIlxuICAgICAgICA/IGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZFxuICAgICAgICA6IGNvbmZpZy5mcm9udGVuZF91cmxfZGV2O1xuICAgIGNvbnN0IHBhZ2UgPSBbXCJzdWNjZXNzXCIsIFwiZmFpbFwiLCBcImNhbmNlbFwiXS5pbmNsdWRlcyhzdGF0dXMpID8gc3RhdHVzIDogXCJmYWlsXCI7XG5cbiAgICByZXMucmVkaXJlY3QoMzAyLCBgJHtyZWRpcmVjdEJhc2V9L3BheW1lbnQvJHtwYWdlfT9ib29raW5nSWQ9JHtib29raW5nSWR9YCk7XG4gIH0sXG4pO1xuXG4vLyBQdWJsaWMgSVBOIHRhcmdldCBcdTIwMTQgdGhlIGdhdGV3YXkgbm90aWZpZXMgdXMgaGVyZSBpbmRlcGVuZGVudGx5IG9mIHRoZVxuLy8gcmVkaXJlY3QuIFNhbWUgaWRlbXBvdGVudCBzZXR0bGU7IGFsd2F5cyBhbnN3ZXJzIDIwMCBzbyB0aGUgZ2F0ZXdheSBzdG9wcyByZXRyeWluZy5cbmNvbnN0IGlwbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGJvb2tpbmdJZCA9IFN0cmluZyhyZXEucXVlcnkuYm9va2luZ0lkKTtcbiAgICBjb25zdCB0cmFuSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LnRyYW5JZCk7XG5cbiAgICBhd2FpdCBwYXltZW50U2VydmljZS5wcm9jZXNzR2F0ZXdheVJlc3VsdChcbiAgICAgIGJvb2tpbmdJZCxcbiAgICAgIHRyYW5JZCxcbiAgICAgIHJlcS5ib2R5IGFzIElHYXRld2F5UmVzdWx0LFxuICAgICk7XG5cbiAgICByZXMuc3RhdHVzKDIwMCkudHlwZShcInRleHQvcGxhaW5cIikuc2VuZChcIk9LXCIpO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRDb250cm9sbGVyID0ge1xuICBjcmVhdGVQYXltZW50LFxuICBjb25maXJtUGF5bWVudCxcbiAgaXBuLFxufTsiLCAiaW1wb3J0IHsgQm9va2luZ1N0YXR1cywgUGF5bWVudFN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBTc2xjb21tZXJ6SW5pdFJlc3VsdCwgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQsIGdlbmVyYXRlVHJhbklkLCBzc2xjb21tZXJ6SW5pdCwgc3NsY29tbWVyelZhbGlkYXRlIH0gZnJvbSBcIi4uLy4uL2xpYi9zc2xjb21tZXJ6XCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2VuZEJvb2tpbmdFbWFpbCB9IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgSUdhdGV3YXlSZXN1bHQsIElQYXltZW50Q3JlYXRlUmVxdWVzdCwgSVBheW1lbnRHYXRld2F5T3V0Y29tZSB9IGZyb20gXCIuL3BheW1lbnQuaW50ZXJmYWNlXCI7XG5cbi8vIFRoZSBnYXRld2F5IFBPU1RzIHRvIHRoZXNlIFVSTHMgc2VydmVyLXRvLXNlcnZlciwgc28gdGhlIGhvc3QgbXVzdCBiZVxuLy8gcHVibGljbHkgcmVhY2hhYmxlIFx1MjAxNCBjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsLCBuZXZlciBsb2NhbGhvc3QgaW4gc2FuZGJveC5cbmNvbnN0IGJ1aWxkQ2FsbGJhY2tVcmwgPSAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICB0cmFuSWQ6IHN0cmluZyxcbiAga2luZDogXCJzdWNjZXNzXCIgfCBcImZhaWxcIiB8IFwiY2FuY2VsXCIgfCBcImlwblwiLFxuKSA9PlxuICBgJHtjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsfS9hcGkvcGF5bWVudHMvJHtraW5kID09PSBcImlwblwiID8gXCJpcG5cIiA6IFwiY29uZmlybVwifT9ib29raW5nSWQ9JHtib29raW5nSWR9JnRyYW5JZD0ke3RyYW5JZH0ke1xuICAgIGtpbmQgPT09IFwiaXBuXCIgPyBcIlwiIDogYCZzdGF0dXM9JHtraW5kfWBcbiAgfWA7XG5cbi8vIE9wZW5zIGFuIFNTTENvbW1lcnogc2Vzc2lvbiBmb3IgYSBwZW5kaW5nIGJvb2tpbmcgdGhlIHVzZXIgb3ducy4gVGhlIGJvb2tpbmdcbi8vIGFtb3VudCBpcyBmcm96ZW4gYXQgaW5pdGlhdGlvbjsgaXQgbmV2ZXIgcmUtcmVhZHMgdGhlIHBhY2thZ2UgcHJpY2UuXG5jb25zdCBjcmVhdGVQYXltZW50U2Vzc2lvbiA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElQYXltZW50Q3JlYXRlUmVxdWVzdCxcbik6IFByb21pc2U8eyBwYXltZW50SWQ6IHN0cmluZzsgdHJhbklkOiBzdHJpbmc7IHBheW1lbnRVcmw6IHN0cmluZyB8IG51bGwgfT4gPT4ge1xuICBjb25zdCB7IGJvb2tpbmdJZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBib29raW5nID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCB9LFxuICAgIGluY2x1ZGU6IHsgcGFja2FnZTogeyBzZWxlY3Q6IHsgdGl0bGU6IHRydWUgfSB9IH0sXG4gIH0pO1xuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuICBpZiAoYm9va2luZy51c2VySWQgIT09IHVzZXJJZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwYXkgZm9yIHRoaXMgYm9va2luZy5cIik7XG4gIH1cbiAgaWYgKGJvb2tpbmcuc3RhdHVzID09PSBCb29raW5nU3RhdHVzLlBBSUQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIlRoaXMgYm9va2luZyBpcyBhbHJlYWR5IHBhaWQuXCIpO1xuICB9XG4gIGlmIChib29raW5nLnN0YXR1cyAhPT0gQm9va2luZ1N0YXR1cy5QRU5ESU5HKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDA5LFxuICAgICAgYENhbm5vdCBwYXkgZm9yIGEgYm9va2luZyBpbiAke2Jvb2tpbmcuc3RhdHVzLnRvTG93ZXJDYXNlKCl9IHN0YXR1cy5gLFxuICAgICk7XG4gIH1cblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSwgcGhvbmU6IHRydWUgfSxcbiAgfSk7XG4gIGlmICghdXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgY29uc3QgYW1vdW50ID0gTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSk7XG4gIGNvbnN0IHRyYW5JZCA9IGdlbmVyYXRlVHJhbklkKCk7XG5cbiAgLy8gT25lIGxpdmUgc2Vzc2lvbiBwZXIgYm9va2luZzogdGhlIGxlZGdlciByb3cgaXMgY3JlYXRlZCBhdG9taWNhbGx5IHdoaWxlXG4gIC8vIHN1cGVyc2VkaW5nIGFueSBhYmFuZG9uZWQgc2Vzc2lvbiwgdGhlbiB0aGUgZ2F0ZXdheSBpcyBhc2tlZC4gVGhlIHJvd1xuICAvLyBzdXJ2aXZlcyByZWdhcmRsZXNzIG9mIHRoZSBnYXRld2F5IHJlc3BvbnNlIFx1MjAxNCBpbml0IGZhaWx1cmUgZmxpcHMgaXQgdG9cbiAgLy8gRkFJTEVEIGJlbG93IHNvIGEgdHJ1dGhmdWwgZW50cnkgYWx3YXlzIGV4aXN0cy5cbiAgY29uc3QgcGF5bWVudCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGJvb2tpbmdJZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHgucGF5bWVudC5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICBib29raW5nSWQsXG4gICAgICAgIHRyYW5JZCxcbiAgICAgICAgYW1vdW50LFxuICAgICAgICBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVELFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgbGV0IGluaXQ6IFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB0cnkge1xuICAgIGluaXQgPSBhd2FpdCBzc2xjb21tZXJ6SW5pdCh7XG4gICAgICB0b3RhbF9hbW91bnQ6IGFtb3VudCxcbiAgICAgIHRyYW5faWQ6IHRyYW5JZCxcbiAgICAgIHN1Y2Nlc3NfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcInN1Y2Nlc3NcIiksXG4gICAgICBmYWlsX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJmYWlsXCIpLFxuICAgICAgY2FuY2VsX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJjYW5jZWxcIiksXG4gICAgICBpcG5fdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImlwblwiKSxcbiAgICAgIGN1c19uYW1lOiB1c2VyLm5hbWUsXG4gICAgICBjdXNfZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICBjdXNfcGhvbmU6IHVzZXIucGhvbmUgPz8gXCIwMTcxMTExMTExMVwiLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIGtlZXAgdGhlIGxlZGdlciB0cnV0aGZ1bCBcdTIwMTQgdGhlIHNlc3Npb24gbmV2ZXIgcmVhY2hlZCB0aGUgZ2F0ZXdheS4gVGhlXG4gICAgLy8gc3RhdHVzIGd1YXJkIG1ha2VzIGEgY29uY3VycmVudCAvY3JlYXRlIHRoYXQgYWxyZWFkeSBjYW5jZWxsZWQgdGhpcyByb3dcbiAgICAvLyB3aW4gdGhlIHJhY2UgKHRoYXQgcm93IHN0YXlzIGNhbmNlbGxlZCwgdGhpcyBvbmUgZmFpbHMgb25seSBpZiBsaXZlKS5cbiAgICBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQgfSxcbiAgICB9KTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIC8vIHN0b3JlIHRoZSBnYXRld2F5IFVSTHMgb25seSBpZiB0aGUgcm93IGlzIHN0aWxsIHRoZSBsaXZlIHNlc3Npb24uXG4gIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgZGF0YTogeyBnYXRld2F5UGFnZVVybDogaW5pdC5HYXRld2F5UGFnZVVSTCwgc3NsU2Vzc2lvbktleTogaW5pdC5zZXNzaW9ua2V5IH0sXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgcGF5bWVudElkOiBwYXltZW50LmlkLFxuICAgIHRyYW5JZDogcGF5bWVudC50cmFuSWQsXG4gICAgcGF5bWVudFVybDogaW5pdC5HYXRld2F5UGFnZVVSTCA/PyBudWxsLFxuICB9O1xufTtcblxuLy8gU2VydmVyLXNpZGUgdmVyaWZpY2F0aW9uIG9mIGEgY29tcGxldGVkIHRyYW5zYWN0aW9uOiB0aGUgdmFsaWRhdG9yIHJldHVybnNcbi8vIFZBTElEIChmaXJzdCBjaGVjaykgb3IgVkFMSURBVEVEIChhbHJlYWR5IHZlcmlmaWVkIGJlZm9yZSkgd2l0aCB0aGUgYW1vdW50LlxuLy8gQW55dGhpbmcgZWxzZSBcdTIwMTQgb3IgYSBtaXNtYXRjaGVkIGFtb3VudCBcdTIwMTQgZmFpbHMgdGhlIHBheW1lbnQuXG5jb25zdCB2ZXJpZnlTdWNjZXNzID0gYXN5bmMgKFxuICB2YWxJZDogc3RyaW5nLFxuICBleHBlY3RlZEFtb3VudDogbnVtYmVyLFxuKTogUHJvbWlzZTx7IHZlcmlmaWVkOiBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCB8IG51bGw7IG1hdGNoZXNBbW91bnQ6IGJvb2xlYW4gfT4gPT4ge1xuICBsZXQgdmVyaWZpZWQ6IFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHwgbnVsbCA9IG51bGw7XG4gIHRyeSB7XG4gICAgdmVyaWZpZWQgPSBhd2FpdCBzc2xjb21tZXJ6VmFsaWRhdGUoeyB2YWxfaWQ6IHZhbElkIH0pO1xuICB9IGNhdGNoIHtcbiAgICAvLyB2YWxpZGF0b3IgdW5yZWFjaGFibGUgXHUyMDE0IGZhaWwgdGhlIHBheW1lbnQgcmF0aGVyIHRoYW4gY3Jhc2ggdGhlIGNhbGxiYWNrXG4gICAgcmV0dXJuIHsgdmVyaWZpZWQ6IG51bGwsIG1hdGNoZXNBbW91bnQ6IGZhbHNlIH07XG4gIH1cblxuICBjb25zdCB2YWxpZFN0YXR1cyA9XG4gICAgdmVyaWZpZWQuc3RhdHVzID09PSBcIlZBTElEXCIgfHwgdmVyaWZpZWQuc3RhdHVzID09PSBcIlZBTElEQVRFRFwiO1xuICBjb25zdCBtYXRjaGVzQW1vdW50ID1cbiAgICB2ZXJpZmllZC5hbW91bnQgIT09IHVuZGVmaW5lZCAmJiBOdW1iZXIodmVyaWZpZWQuYW1vdW50KSA9PT0gZXhwZWN0ZWRBbW91bnQ7XG5cbiAgcmV0dXJuIHsgdmVyaWZpZWQsIG1hdGNoZXNBbW91bnQ6IHZhbGlkU3RhdHVzICYmIG1hdGNoZXNBbW91bnQgfTtcbn07XG5cbi8vIFNoYXJlZCBieSB0aGUgY29uZmlybSAoc3VjY2Vzcy9mYWlsL2NhbmNlbCkgYW5kIElQTiBlbmRwb2ludHMuIElkZW1wb3RlbnQ6IGFcbi8vIHNldHRsZWQgcGF5bWVudCBzaG9ydC1jaXJjdWl0cywgc28gdGhlIGRvdWJsZS1maXJpbmcgSVBOIG5ldmVyIGRvdWJsZS1jaGFyZ2VzLlxuY29uc3QgcHJvY2Vzc0dhdGV3YXlSZXN1bHQgPSBhc3luYyAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICB0cmFuSWQ6IHN0cmluZyxcbiAgcmVzdWx0OiBJR2F0ZXdheVJlc3VsdCxcbik6IFByb21pc2U8SVBheW1lbnRHYXRld2F5T3V0Y29tZT4gPT4ge1xuICBjb25zdCBwYXltZW50ID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgdHJhbklkIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgYm9va2luZzoge1xuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgdXNlcjogeyBzZWxlY3Q6IHsgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9LFxuICAgICAgICAgIHBhY2thZ2U6IHsgc2VsZWN0OiB7IHRpdGxlOiB0cnVlIH0gfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKCFwYXltZW50IHx8IHBheW1lbnQuYm9va2luZ0lkICE9PSBib29raW5nSWQpIHtcbiAgICAvLyBBIGNhbGxiYWNrIGZvciBhIHNlc3Npb24gd2UgbmV2ZXIgY3JlYXRlZCBcdTIwMTQgbm90aGluZyB0byBzZXR0bGUuXG4gICAgcmV0dXJuIHsgcGF5bWVudFN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQsIGJvb2tpbmdTdGF0dXM6IG51bGwsIGNoYW5nZWQ6IGZhbHNlIH07XG4gIH1cblxuICBpZiAocGF5bWVudC5zdGF0dXMgPT09IFBheW1lbnRTdGF0dXMuU1VDQ0VTUykge1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogZmFsc2UsXG4gICAgfTtcbiAgfVxuXG4gIC8vIENhbmNlbCBjYWxsYmFjayBcdTIwMTQgdGhlIHNob3BwZXIgYWJhbmRvbmVkIGNoZWNrb3V0LCBubyBjaGFyZ2Ugd2FzIG1hZGUuXG4gIGlmIChyZXN1bHQuZmFpbF9zdGF0dXMgPT09IFwiQ0FOQ0VMTEVEXCIgfHwgcmVzdWx0LnN0YXR1cyA9PT0gXCJDQU5DRUxMRURcIikge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkNBTkNFTExFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB1cGRhdGVkLnN0YXR1cyAhPT0gcGF5bWVudC5zdGF0dXMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIE5vIHZhbF9pZCBtZWFucyB0aGUgZ2F0ZXdheSByZXBvcnRlZCBhIGZhaWx1cmUgKGZhaWxfdXJsKSBcdTIwMTQgbm90aGluZyB0byB2ZXJpZnkuXG4gIGlmICghcmVzdWx0LnZhbF9pZCkge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB1cGRhdGVkLnN0YXR1cyAhPT0gcGF5bWVudC5zdGF0dXMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIFN1Y2Nlc3MgcGF0aDogdmVyaWZ5IHNlcnZlci1zaWRlIGFuZCBvbmx5IHRoZW4gbWFyayB0aGUgYm9va2luZyBhcyBwYWlkLlxuICBjb25zdCB7IHZlcmlmaWVkLCBtYXRjaGVzQW1vdW50IH0gPSBhd2FpdCB2ZXJpZnlTdWNjZXNzKFxuICAgIHJlc3VsdC52YWxfaWQsXG4gICAgTnVtYmVyKHBheW1lbnQuYW1vdW50KSxcbiAgKTtcblxuICBpZiAoIW1hdGNoZXNBbW91bnQpIHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQgfSxcbiAgICB9KTtcbiAgICByZXR1cm4ge1xuICAgICAgcGF5bWVudFN0YXR1czogdXBkYXRlZC5zdGF0dXMsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogdHJ1ZSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgc2V0dGxlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHR4LnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5TVUNDRVNTLFxuICAgICAgICB2YWxJZDogcmVzdWx0LnZhbF9pZCxcbiAgICAgICAgY2FyZFR5cGU6IHJlc3VsdC5jYXJkX3R5cGUgPz8gdmVyaWZpZWQ/LmNhcmRfdHlwZSxcbiAgICAgICAgYmFua1RyYW5JZDogcmVzdWx0LmJhbmtfdHJhbl9pZCA/PyB2ZXJpZmllZD8uYmFua190cmFuX2lkLFxuICAgICAgICBwYWlkQXQ6IG5ldyBEYXRlKCksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gY29tcGFyZS1hbmQtc2V0OiBvbmx5IGEgc3RpbGwtUEVORElORyBib29raW5nIGJlY29tZXMgUEFJRDsgYSBib29raW5nIHRoYXRcbiAgICAvLyB3YXMgY29uY3VycmVudGx5IGNvbmZpcm1lZCBvciBjYW5jZWxsZWQga2VlcHMgaXRzIHN0YXRlLCB0aGUgbW9uZXkgc3RheXMgb24uXG4gICAgYXdhaXQgdHguYm9va2luZy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiBib29raW5nSWQsIHN0YXR1czogQm9va2luZ1N0YXR1cy5QRU5ESU5HIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5QQUlEIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdXBkYXRlZDtcbiAgfSk7XG5cbiAgY29uc3QgYm9va2luZ0FmdGVyID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkOiBib29raW5nSWQgfSB9KTtcblxuICAvLyBiZXN0LWVmZm9ydCBcInBheW1lbnQgcmVjZWl2ZWRcIiBlbWFpbCBcdTIwMTQgbmV2ZXIgZmFpbHMgdGhlIGNhbGxiYWNrXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgIGVtYWlsOiBwYXltZW50LmJvb2tpbmcudXNlci5lbWFpbCxcbiAgICAgIG5hbWU6IHBheW1lbnQuYm9va2luZy51c2VyLm5hbWUsXG4gICAgICBwYWNrYWdlVGl0bGU6IHBheW1lbnQuYm9va2luZy5wYWNrYWdlLnRpdGxlLFxuICAgICAgdHJhdmVsRGF0ZTogcGF5bWVudC5ib29raW5nLnRyYXZlbERhdGUsXG4gICAgICB0cmF2ZWxlcnM6IHBheW1lbnQuYm9va2luZy50cmF2ZWxlcnMsXG4gICAgICB0b3RhbFByaWNlOiBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBBSUQsXG4gICAgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgcGF5bWVudFN0YXR1czogc2V0dGxlZC5zdGF0dXMsXG4gICAgYm9va2luZ1N0YXR1czogYm9va2luZ0FmdGVyPy5zdGF0dXMgPz8gbnVsbCxcbiAgICBjaGFuZ2VkOiB0cnVlLFxuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRTZXJ2aWNlID0ge1xuICBjcmVhdGVQYXltZW50U2Vzc2lvbixcbiAgcHJvY2Vzc0dhdGV3YXlSZXN1bHQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGJvb2tpbmdJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJCb29raW5nIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudXVpZChcIkJvb2tpbmcgaWQgbXVzdCBiZSBhIHZhbGlkIHV1aWRcIiksXG59KTtcblxuY29uc3QgY2FsbGJhY2tRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgYm9va2luZ0lkOiB6LnN0cmluZygpLnV1aWQoXCJCb29raW5nIGlkIG11c3QgYmUgYSB2YWxpZCB1dWlkXCIpLFxuICB0cmFuSWQ6IHouc3RyaW5nKCkubWluKDEpLFxuICBzdGF0dXM6IHouZW51bShbXCJzdWNjZXNzXCIsIFwiZmFpbFwiLCBcImNhbmNlbFwiXSkub3B0aW9uYWwoKSxcbn0pO1xuXG4vLyBCb2R5IG9mIHRoZSBnYXRld2F5IFBPU1QgXHUyMDE0IG9ubHkgZmllbGRzIHdlIGNvbnN1bWUsIGFsbCBvcHRpb25hbCBiZWNhdXNlIHRoZVxuLy8gc2hhcGUgZGlmZmVycyBiZXR3ZWVuIHN1Y2Nlc3MgLyBmYWlsIC8gY2FuY2VsIC8gSVBOIGNhbGxiYWNrcy5cbmNvbnN0IGdhdGV3YXlSZXN1bHRTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHZhbF9pZDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBzdGF0dXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgZmFpbF9zdGF0dXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgY2FyZF90eXBlOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGJhbmtfdHJhbl9pZDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBjdXJyZW5jeTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBhbW91bnQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUQ3JlYXRlUGF5bWVudFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNyZWF0ZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQ2FsbGJhY2tRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNhbGxiYWNrUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEdhdGV3YXlSZXN1bHRTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBnYXRld2F5UmVzdWx0U2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlU2NoZW1hLFxuICBjYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICBnYXRld2F5UmVzdWx0U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHdpc2hsaXN0Q29udHJvbGxlciB9IGZyb20gXCIuL3dpc2hsaXN0LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHdpc2hsaXN0VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi93aXNobGlzdC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBTYXZlIGEgcGFja2FnZSB0byB0aGUgd2lzaGxpc3QgKFVTRVIgb25seSlcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiB3aXNobGlzdFZhbGlkYXRpb25zLmNyZWF0ZVdpc2hsaXN0U2NoZW1hIH0pLFxuICB3aXNobGlzdENvbnRyb2xsZXIuYWRkVG9XaXNobGlzdCxcbik7XG5cbi8vIDIuIE15IHdpc2hsaXN0IChVU0VSIG9ubHkpIFx1MjAxNCBwYWdpbmF0ZWQsIG5ld2VzdCBmaXJzdFxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHdpc2hsaXN0VmFsaWRhdGlvbnMud2lzaGxpc3RRdWVyeVNjaGVtYSB9KSxcbiAgd2lzaGxpc3RDb250cm9sbGVyLmdldE15V2lzaGxpc3QsXG4pO1xuXG4vLyAzLiBSZW1vdmUgYSBwYWNrYWdlIGZyb20gdGhlIHdpc2hsaXN0IChVU0VSIG9ubHkpXG5yb3V0ZXIuZGVsZXRlKFxuICBcIi86cGFja2FnZUlkXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiB3aXNobGlzdFZhbGlkYXRpb25zLndpc2hsaXN0UGFyYW1zU2NoZW1hIH0pLFxuICB3aXNobGlzdENvbnRyb2xsZXIucmVtb3ZlRnJvbVdpc2hsaXN0LFxuKTtcblxuZXhwb3J0IGNvbnN0IHdpc2hsaXN0Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgd2lzaGxpc3RTZXJ2aWNlIH0gZnJvbSBcIi4vd2lzaGxpc3Quc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIFNhdmUgYSBwYWNrYWdlIHRvIHRoZSB3aXNobGlzdCBjb250cm9sbGVyIChVU0VSKVxuY29uc3QgYWRkVG9XaXNobGlzdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpc2hsaXN0U2VydmljZS5hZGRUb1dpc2hsaXN0KHVzZXJJZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBhZGRlZCB0byB3aXNobGlzdCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBNeSB3aXNobGlzdCBjb250cm9sbGVyIChVU0VSKVxuY29uc3QgZ2V0TXlXaXNobGlzdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpc2hsaXN0U2VydmljZS5nZXRNeVdpc2hsaXN0KHVzZXJJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJXaXNobGlzdCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFJlbW92ZSBmcm9tIHdpc2hsaXN0IGNvbnRyb2xsZXIgKFVTRVIpIFx1MjAxNCAyMDQgc28gYSByZXBlYXQgZGVsZXRlIGlzIGFcbi8vICAgIG5vLW9wIGluZGlzdGluZ3Vpc2hhYmxlIGZyb20gYSBzdWNjZXNzZnVsIG9uZSAobm8gYm9keSwgbm8gZXJyb3IpLlxuY29uc3QgcmVtb3ZlRnJvbVdpc2hsaXN0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcGFja2FnZUlkID0gU3RyaW5nKHJlcS5wYXJhbXMucGFja2FnZUlkKTtcblxuICAgIGF3YWl0IHdpc2hsaXN0U2VydmljZS5yZW1vdmVGcm9tV2lzaGxpc3QodXNlcklkLCBwYWNrYWdlSWQpO1xuXG4gICAgcmVzLnN0YXR1cyhodHRwU3RhdHVzLk5PX0NPTlRFTlQpLnNlbmQoKTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCB3aXNobGlzdENvbnRyb2xsZXIgPSB7XG4gIGFkZFRvV2lzaGxpc3QsXG4gIGdldE15V2lzaGxpc3QsXG4gIHJlbW92ZUZyb21XaXNobGlzdCxcbn07IiwgImltcG9ydCB7IFBhY2thZ2VTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHB1YmxpY1BhY2thZ2VJbmNsdWRlIH0gZnJvbSBcIi4uL3BhY2thZ2UvcGFja2FnZS5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBJQ3JlYXRlV2lzaGxpc3RQYXlsb2FkLCBJV2lzaGxpc3RRdWVyeSB9IGZyb20gXCIuL3dpc2hsaXN0LmludGVyZmFjZVwiO1xuXG4vLyBNb25leSBpcyBgRGVjaW1hbCgxMCwyKWAgaW4gdGhlIHNjaGVtYSAoQUdFTlRTLm1kKSBcdTIwMTQgbWFwIHRvIE51bWJlciBvbiByZXR1cm4uXG5jb25zdCBzZXJpYWxpemVXaXNobGlzdEl0ZW0gPSA8XG4gIFQgZXh0ZW5kcyB7IHBhY2thZ2U6IHsgcHJpY2U6IFByaXNtYS5EZWNpbWFsIH0gfSxcbj4oXG4gIHJvdzogVCxcbik6IFQgPT4gKHtcbiAgLi4ucm93LFxuICBwYWNrYWdlOiB7IC4uLnJvdy5wYWNrYWdlLCBwcmljZTogTnVtYmVyKHJvdy5wYWNrYWdlLnByaWNlKSB9LFxufSk7XG5cbi8vIDEuIFNhdmUgYSBwYWNrYWdlIHRvIHRoZSB3aXNobGlzdCAoVVNFUikgXHUyMDE0IGlkZW1wb3RlbnQuIFRoZSBwYWNrYWdlIG11c3QgYmVcbi8vICAgIEFQUFJPVkVEIGFuZCBub3QgZGVsZXRlZCwgbWlycm9yaW5nIHRoZSBwdWJsaWMtcGFja2FnZSB2aXNpYmlsaXR5IHJ1bGUuXG5jb25zdCBhZGRUb1dpc2hsaXN0ID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSUNyZWF0ZVdpc2hsaXN0UGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7XG4gICAgICBpZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIHJldHVybiBwcmlzbWEud2lzaGxpc3RJdGVtLnVwc2VydCh7XG4gICAgd2hlcmU6IHsgdXNlcklkX3BhY2thZ2VJZDogeyB1c2VySWQsIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQgfSB9LFxuICAgIGNyZWF0ZTogeyB1c2VySWQsIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQgfSxcbiAgICB1cGRhdGU6IHt9LFxuICB9KTtcbn07XG5cbi8vIDIuIFBhZ2luYXRlZCB3aXNobGlzdCAoVVNFUikgXHUyMDE0IG5ld2VzdCBmaXJzdC4gUm93cyB3aG9zZSBwYWNrYWdlIHdhcyBsYXRlclxuLy8gICAgc29mdC1kZWxldGVkIG9yIGRlbW90ZWQgb3V0IG9mIEFQUFJPVkVEIGFyZSBmaWx0ZXJlZCBhdCByZWFkIHRpbWUsIHNvIHRoZVxuLy8gICAgcGFnZSBuZXZlciBsaXN0cyBhIHBhY2thZ2Ugd2hvc2UgZGV0YWlsIHJvdXRlIHdvdWxkIDQwNC5cbmNvbnN0IGdldE15V2lzaGxpc3QgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJV2lzaGxpc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuV2lzaGxpc3RJdGVtV2hlcmVJbnB1dCA9IHtcbiAgICB1c2VySWQsXG4gICAgcGFja2FnZTogeyBpc0RlbGV0ZWQ6IGZhbHNlLCBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQgfSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS53aXNobGlzdEl0ZW0uZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IHBhY2thZ2U6IHsgaW5jbHVkZTogcHVibGljUGFja2FnZUluY2x1ZGUgfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLndpc2hsaXN0SXRlbS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVdpc2hsaXN0SXRlbSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMy4gUmVtb3ZlIGEgcGFja2FnZSBmcm9tIHRoZSB3aXNobGlzdCAoVVNFUikgXHUyMDE0IGlkZW1wb3RlbnQ7IGEgbWlzc2luZyByb3cgaXNcbi8vICAgIGEgbm8tb3AsIG5ldmVyIGFuIGVycm9yLiBEZWxpYmVyYXRlbHkgbm8gXCJjbGVhciBhbGxcIi5cbmNvbnN0IHJlbW92ZUZyb21XaXNobGlzdCA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGFja2FnZUlkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLndpc2hsaXN0SXRlbS5kZWxldGVNYW55KHtcbiAgICB3aGVyZTogeyB1c2VySWQsIHBhY2thZ2VJZCB9LFxuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCB3aXNobGlzdFNlcnZpY2UgPSB7XG4gIGFkZFRvV2lzaGxpc3QsXG4gIGdldE15V2lzaGxpc3QsXG4gIHJlbW92ZUZyb21XaXNobGlzdCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVdpc2hsaXN0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWNrYWdlSWQ6IHpcbiAgICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC5taW4oMSwgXCJQYWNrYWdlIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHdpc2hsaXN0UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWNrYWdlSWQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLm1pbigxLCBcIlBhY2thZ2UgaWQgbXVzdCBub3QgYmUgZW1wdHlcIiksXG59KTtcblxuY29uc3Qgd2lzaGxpc3RRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbn0pO1xuXG5leHBvcnQgY29uc3Qgd2lzaGxpc3RWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlV2lzaGxpc3RTY2hlbWEsXG4gIHdpc2hsaXN0UGFyYW1zU2NoZW1hLFxuICB3aXNobGlzdFF1ZXJ5U2NoZW1hLFxufTsiLCAiLy8gVmVyY2VsIHNlcnZlcmxlc3MgZW50cnlwb2ludCBcdTIwMTQgcmUtZXhwb3J0cyB0aGUgc2FtZSBFeHByZXNzIGFwcCB0aGUgbG9jYWxcbi8vIGJ1aWxkIHVzZXMuIFZlcmNlbCdzIEB2ZXJjZWwvbm9kZSBydW50aW1lIGNvbXBpbGVzIGFuZCB3cmFwcyBpdDsgdGhlIGFwcCBpc1xuLy8gc3BsaXQgZnJvbSBzZXJ2ZXIudHMgKHdoaWNoIG9ubHkgc3RhcnRzIHRoZSBsaXN0ZW5lcikgc28gdGhlIHR3byBob3N0cyBzaGFyZVxuLy8gb25lIHJvdXRlIHJlZ2lzdHJ5LlxuaW1wb3J0IGFwcCBmcm9tIFwiLi4vc3JjL2FwcFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhcHA7Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7OztBQUFBLE9BQU8sYUFBK0Q7QUFDdEUsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU8s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O0FBQy9CLElBQUksSUFBSSxrQkFBa0IsZUFBZTtBQUN6QyxJQUFJLElBQUksaUJBQWlCLGFBQWE7QUFDdEMsSUFBSSxJQUFJLGlCQUFpQixjQUFjO0FBRXZDLElBQUksSUFBSSxnQkFBZTtBQUN2QixJQUFJLElBQUksMEJBQWtCO0FBRTFCLElBQU8sY0FBUTs7O0FtRXJIZixJQUFPLGdCQUFROyIsCiAgIm5hbWVzIjogWyJwYXRoIiwgImNvbmZpZyIsICJCdWZmZXIiLCAiQW55TnVsbCIsICJEYk51bGwiLCAiRGVjaW1hbCIsICJKc29uTnVsbCIsICJOdWxsVHlwZXMiLCAiUHJpc21hQ2xpZW50SW5pdGlhbGl6YXRpb25FcnJvciIsICJQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciIsICJQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciIsICJQcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yIiwgIlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciIsICJTcWwiLCAiZW1wdHkiLCAiam9pbiIsICJyYXciLCAicnVudGltZSIsICJodHRwU3RhdHVzIiwgInJlZnJlc2hUb2tlbiIsICJyZWZyZXNoVG9rZW4iLCAicmVnaXN0ZXJVc2VyIiwgImh0dHBTdGF0dXMiLCAibG9naW5Vc2VyIiwgImdvb2dsZUxvZ2luIiwgImRlbW9Mb2dpbiIsICJ6IiwgInoiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiYmNyeXB0IiwgImJjcnlwdCIsICJ1cGRhdGVQcm9maWxlIiwgImh0dHBTdGF0dXMiLCAiZ2V0VXNlcnMiLCAiY2hhbmdlUm9sZSIsICJjaGFuZ2VTdGF0dXMiLCAiZGVsZXRlVXNlciIsICJ6IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAibXVsdGVyIiwgImh0dHBTdGF0dXMiLCAiaHR0cFN0YXR1cyIsICJtdWx0ZXIiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVNZXNzYWdlIiwgImh0dHBTdGF0dXMiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZUJvb2tpbmciLCAiaHR0cFN0YXR1cyIsICJnZXRNeUJvb2tpbmdzIiwgImdldEFnZW50Qm9va2luZ3MiLCAiZ2V0Qm9va2luZ0RldGFpbCIsICJnZXRBbGxCb29raW5ncyIsICJ1cGRhdGVCb29raW5nU3RhdHVzIiwgInoiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZVJldmlldyIsICJodHRwU3RhdHVzIiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVDYXRlZ29yeSIsICJodHRwU3RhdHVzIiwgImdldEFsbENhdGVnb3JpZXMiLCAidXBkYXRlQ2F0ZWdvcnkiLCAiZGVsZXRlQ2F0ZWdvcnkiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgInJhbmRvbVVVSUQiLCAicmFuZG9tVVVJRCIsICJjcmVhdGVQYWNrYWdlIiwgImh0dHBTdGF0dXMiLCAiZ2V0UHVibGljUGFja2FnZXMiLCAiZ2V0UGFja2FnZUJ5U2x1ZyIsICJnZXRBbGxQYWNrYWdlcyIsICJnZXRNeVBhY2thZ2VzIiwgInVwZGF0ZVBhY2thZ2UiLCAiY2hhbmdlUGFja2FnZVN0YXR1cyIsICJzb2Z0RGVsZXRlUGFja2FnZSIsICJ6IiwgInVwZGF0ZVN0YXR1c1NjaGVtYSIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgInJhbmRvbVVVSUQiLCAiZ2VuZXJhdGVVbmlxdWVTbHVnIiwgInJhbmRvbVVVSUQiLCAiY3JlYXRlUG9zdCIsICJodHRwU3RhdHVzIiwgImdldFB1YmxpY1Bvc3RzIiwgImdldFBvc3RCeVNsdWciLCAiZ2V0QWxsUG9zdHMiLCAiZ2V0TXlQb3N0cyIsICJ1cGRhdGVQb3N0IiwgImNoYW5nZVBvc3RTdGF0dXMiLCAic29mdERlbGV0ZVBvc3QiLCAieiIsICJ0aXRsZVNjaGVtYSIsICJ1cGRhdGVTdGF0dXNTY2hlbWEiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJnZXRBZG1pbkRhc2hib2FyZCIsICJodHRwU3RhdHVzIiwgImdldEFnZW50RGFzaGJvYXJkIiwgImdldFVzZXJEYXNoYm9hcmQiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImh0dHBTdGF0dXMiLCAieiIsICJjcmVhdGVTY2hlbWEiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJhZGRUb1dpc2hsaXN0IiwgImh0dHBTdGF0dXMiLCAiZ2V0TXlXaXNobGlzdCIsICJyZW1vdmVGcm9tV2lzaGxpc3QiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIl0KfQo=
