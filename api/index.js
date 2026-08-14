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
  "inlineSchema": 'model BlogPost {\n  id         String     @id @default(uuid())\n  title      String\n  slug       String     @unique\n  excerpt    String\n  content    String\n  coverImage String\n  status     PostStatus @default(DRAFT)\n  isDeleted  Boolean    @default(false)\n\n  authorId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  author User @relation("AuthorPosts", fields: [authorId], references: [id])\n\n  @@index([status])\n  @@index([authorId])\n  @@map("blog_posts")\n}\n\nmodel Booking {\n  id         String        @id @default(uuid())\n  travelDate DateTime\n  travelers  Int\n  totalPrice Decimal       @db.Decimal(10, 2)\n  status     BookingStatus @default(PENDING)\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user     User        @relation("CustomerBookings", fields: [userId], references: [id])\n  package  TourPackage @relation(fields: [packageId], references: [id])\n  payments Payment[]\n\n  @@index([userId])\n  @@index([packageId])\n  @@index([status])\n  @@index([userId, packageId, travelDate])\n  @@map("bookings")\n}\n\nmodel Category {\n  id   String @id @default(uuid())\n  name String @unique\n  slug String @unique\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages TourPackage[]\n\n  @@map("categories")\n}\n\nmodel ContactMessage {\n  id         String  @id @default(uuid())\n  name       String\n  email      String\n  subject    String\n  message    String\n  isResolved Boolean @default(false)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@index([isResolved])\n  @@map("contact_messages")\n}\n\nenum Role {\n  USER\n  AGENT\n  ADMIN\n}\n\nenum UserStatus {\n  ACTIVE\n  SUSPENDED\n}\n\nenum AuthProvider {\n  CREDENTIAL\n  GOOGLE\n}\n\nenum PackageStatus {\n  PENDING\n  APPROVED\n  REJECTED\n}\n\nenum BookingStatus {\n  PENDING\n  PAID\n  CONFIRMED\n  CANCELLED\n  COMPLETED\n}\n\nenum PaymentStatus {\n  INITIATED\n  SUCCESS\n  FAILED\n  CANCELLED\n  REFUNDED\n}\n\nenum PostStatus {\n  DRAFT\n  PUBLISHED\n}\n\nmodel Payment {\n  id             String        @id @default(uuid())\n  bookingId      String\n  tranId         String        @unique // SSLCommerz transaction id, generated server-side\n  valId          String? // set after gateway success, used for server-side validation\n  amount         Decimal       @db.Decimal(10, 2) // = booking.totalPrice at session creation\n  currency       String        @default("BDT")\n  status         PaymentStatus @default(INITIATED)\n  gatewayPageUrl String?\n  sslSessionKey  String?\n  cardType       String?\n  bankTranId     String?\n  paidAt         DateTime?\n  refundRefId    String? // SSLCommerz refund reference (set when a refund is initiated)\n  refundedAt     DateTime? // when the refund was initiated/settled\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  booking Booking @relation(fields: [bookingId], references: [id])\n\n  @@index([bookingId])\n  @@index([status])\n  @@map("payments")\n}\n\nmodel Review {\n  id      String @id @default(uuid())\n  rating  Int\n  comment String\n\n  userId    String\n  packageId String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  user    User        @relation("CustomerReviews", fields: [userId], references: [id])\n  package TourPackage @relation(fields: [packageId], references: [id])\n\n  @@unique([userId, packageId])\n  @@index([packageId])\n  @@map("reviews")\n}\n\n// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../../generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\nmodel TourPackage {\n  id          String        @id @default(uuid())\n  title       String\n  slug        String        @unique\n  description String\n  location    String\n  price       Decimal       @db.Decimal(10, 2)\n  duration    Int\n  rating      Float         @default(0)\n  images      String[]\n  status      PackageStatus @default(PENDING)\n  isDeleted   Boolean       @default(false)\n\n  categoryId String\n  agentId    String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  category Category  @relation(fields: [categoryId], references: [id])\n  agent    User      @relation("AgentPackages", fields: [agentId], references: [id])\n  bookings Booking[]\n  reviews  Review[]\n\n  @@index([categoryId])\n  @@index([categoryId, price])\n  @@index([price])\n  @@index([status])\n  @@map("tour_packages")\n}\n\nmodel User {\n  id            String       @id @default(uuid())\n  name          String\n  email         String       @unique\n  password      String?\n  googleId      String?      @unique\n  phone         String?\n  avatarUrl     String?\n  role          Role         @default(USER)\n  status        UserStatus   @default(ACTIVE)\n  authProvider  AuthProvider @default(CREDENTIAL)\n  emailVerified Boolean      @default(false)\n  isDeleted     Boolean      @default(false)\n  tokenVersion  Int          @default(0)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  packages TourPackage[] @relation("AgentPackages")\n  bookings Booking[]     @relation("CustomerBookings")\n  reviews  Review[]      @relation("CustomerReviews")\n  posts    BlogPost[]    @relation("AuthorPosts")\n\n  @@index([role])\n  @@index([status])\n  @@map("users")\n}\n',
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
config2.runtimeDataModel = JSON.parse('{"models":{"BlogPost":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"excerpt","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"coverImage","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PostStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"authorId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"author","kind":"object","type":"User","relationName":"AuthorPosts"}],"dbName":"blog_posts"},"Booking":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"travelDate","kind":"scalar","type":"DateTime"},{"name":"travelers","kind":"scalar","type":"Int"},{"name":"totalPrice","kind":"scalar","type":"Decimal"},{"name":"status","kind":"enum","type":"BookingStatus"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerBookings"},{"name":"package","kind":"object","type":"TourPackage","relationName":"BookingToTourPackage"},{"name":"payments","kind":"object","type":"Payment","relationName":"BookingToPayment"}],"dbName":"bookings"},"Category":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"CategoryToTourPackage"}],"dbName":"categories"},"ContactMessage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"isResolved","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"contact_messages"},"Payment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"bookingId","kind":"scalar","type":"String"},{"name":"tranId","kind":"scalar","type":"String"},{"name":"valId","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Decimal"},{"name":"currency","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PaymentStatus"},{"name":"gatewayPageUrl","kind":"scalar","type":"String"},{"name":"sslSessionKey","kind":"scalar","type":"String"},{"name":"cardType","kind":"scalar","type":"String"},{"name":"bankTranId","kind":"scalar","type":"String"},{"name":"paidAt","kind":"scalar","type":"DateTime"},{"name":"refundRefId","kind":"scalar","type":"String"},{"name":"refundedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"booking","kind":"object","type":"Booking","relationName":"BookingToPayment"}],"dbName":"payments"},"Review":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"rating","kind":"scalar","type":"Int"},{"name":"comment","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"packageId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"CustomerReviews"},{"name":"package","kind":"object","type":"TourPackage","relationName":"ReviewToTourPackage"}],"dbName":"reviews"},"TourPackage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"location","kind":"scalar","type":"String"},{"name":"price","kind":"scalar","type":"Decimal"},{"name":"duration","kind":"scalar","type":"Int"},{"name":"rating","kind":"scalar","type":"Float"},{"name":"images","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PackageStatus"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"categoryId","kind":"scalar","type":"String"},{"name":"agentId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"category","kind":"object","type":"Category","relationName":"CategoryToTourPackage"},{"name":"agent","kind":"object","type":"User","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"BookingToTourPackage"},{"name":"reviews","kind":"object","type":"Review","relationName":"ReviewToTourPackage"}],"dbName":"tour_packages"},"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"googleId","kind":"scalar","type":"String"},{"name":"phone","kind":"scalar","type":"String"},{"name":"avatarUrl","kind":"scalar","type":"String"},{"name":"role","kind":"enum","type":"Role"},{"name":"status","kind":"enum","type":"UserStatus"},{"name":"authProvider","kind":"enum","type":"AuthProvider"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"tokenVersion","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"packages","kind":"object","type":"TourPackage","relationName":"AgentPackages"},{"name":"bookings","kind":"object","type":"Booking","relationName":"CustomerBookings"},{"name":"reviews","kind":"object","type":"Review","relationName":"CustomerReviews"},{"name":"posts","kind":"object","type":"BlogPost","relationName":"AuthorPosts"}],"dbName":"users"}},"enums":{},"types":{}}');
config2.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","packages","_count","category","agent","user","package","booking","payments","bookings","reviews","posts","author","BlogPost.findUnique","BlogPost.findUniqueOrThrow","BlogPost.findFirst","BlogPost.findFirstOrThrow","BlogPost.findMany","data","BlogPost.createOne","BlogPost.createMany","BlogPost.createManyAndReturn","BlogPost.updateOne","BlogPost.updateMany","BlogPost.updateManyAndReturn","create","update","BlogPost.upsertOne","BlogPost.deleteOne","BlogPost.deleteMany","having","_min","_max","BlogPost.groupBy","BlogPost.aggregate","Booking.findUnique","Booking.findUniqueOrThrow","Booking.findFirst","Booking.findFirstOrThrow","Booking.findMany","Booking.createOne","Booking.createMany","Booking.createManyAndReturn","Booking.updateOne","Booking.updateMany","Booking.updateManyAndReturn","Booking.upsertOne","Booking.deleteOne","Booking.deleteMany","_avg","_sum","Booking.groupBy","Booking.aggregate","Category.findUnique","Category.findUniqueOrThrow","Category.findFirst","Category.findFirstOrThrow","Category.findMany","Category.createOne","Category.createMany","Category.createManyAndReturn","Category.updateOne","Category.updateMany","Category.updateManyAndReturn","Category.upsertOne","Category.deleteOne","Category.deleteMany","Category.groupBy","Category.aggregate","ContactMessage.findUnique","ContactMessage.findUniqueOrThrow","ContactMessage.findFirst","ContactMessage.findFirstOrThrow","ContactMessage.findMany","ContactMessage.createOne","ContactMessage.createMany","ContactMessage.createManyAndReturn","ContactMessage.updateOne","ContactMessage.updateMany","ContactMessage.updateManyAndReturn","ContactMessage.upsertOne","ContactMessage.deleteOne","ContactMessage.deleteMany","ContactMessage.groupBy","ContactMessage.aggregate","Payment.findUnique","Payment.findUniqueOrThrow","Payment.findFirst","Payment.findFirstOrThrow","Payment.findMany","Payment.createOne","Payment.createMany","Payment.createManyAndReturn","Payment.updateOne","Payment.updateMany","Payment.updateManyAndReturn","Payment.upsertOne","Payment.deleteOne","Payment.deleteMany","Payment.groupBy","Payment.aggregate","Review.findUnique","Review.findUniqueOrThrow","Review.findFirst","Review.findFirstOrThrow","Review.findMany","Review.createOne","Review.createMany","Review.createManyAndReturn","Review.updateOne","Review.updateMany","Review.updateManyAndReturn","Review.upsertOne","Review.deleteOne","Review.deleteMany","Review.groupBy","Review.aggregate","TourPackage.findUnique","TourPackage.findUniqueOrThrow","TourPackage.findFirst","TourPackage.findFirstOrThrow","TourPackage.findMany","TourPackage.createOne","TourPackage.createMany","TourPackage.createManyAndReturn","TourPackage.updateOne","TourPackage.updateMany","TourPackage.updateManyAndReturn","TourPackage.upsertOne","TourPackage.deleteOne","TourPackage.deleteMany","TourPackage.groupBy","TourPackage.aggregate","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","User.upsertOne","User.deleteOne","User.deleteMany","User.groupBy","User.aggregate","AND","OR","NOT","id","name","email","password","googleId","phone","avatarUrl","Role","role","UserStatus","status","AuthProvider","authProvider","emailVerified","isDeleted","tokenVersion","createdAt","updatedAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","every","some","none","title","slug","description","location","price","duration","rating","images","PackageStatus","categoryId","agentId","has","hasEvery","hasSome","comment","userId","packageId","bookingId","tranId","valId","amount","currency","PaymentStatus","gatewayPageUrl","sslSessionKey","cardType","bankTranId","paidAt","refundRefId","refundedAt","subject","message","isResolved","travelDate","travelers","totalPrice","BookingStatus","excerpt","content","coverImage","PostStatus","authorId","userId_packageId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","push","increment","decrement","multiply","divide"]'),
  graph: "lARPgAEPDgAAoQIAIJcBAACfAgAwmAEAABoAEJkBAACfAgAwmgEBAAAAAaQBAACgAuMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAAAAAd8BAQD1AQAh4AEBAPUBACHhAQEA9QEAIeMBAQD1AQAhAQAAAAEAIBYFAACwAgAgBgAAoQIAIAsAAP4BACAMAAD_AQAglwEAAK0CADCYAQAAAwAQmQEAAK0CADCaAQEA9QEAIaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACG8AQEA9QEAIb0BAQD1AQAhvgEQAKYCACG_AQIA-wEAIcABCACuAgAhwQEAAIQCACDDAQEA9QEAIcQBAQD1AQAhBAUAAOQDACAGAADgAwAgCwAArwMAIAwAALADACAWBQAAsAIAIAYAAKECACALAAD-AQAgDAAA_wEAIJcBAACtAgAwmAEAAAMAEJkBAACtAgAwmgEBAAAAAaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAAAAAbwBAQD1AQAhvQEBAPUBACG-ARAApgIAIb8BAgD7AQAhwAEIAK4CACHBAQAAhAIAIMMBAQD1AQAhxAEBAPUBACEDAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAEAAAADACAPBwAAoQIAIAgAAKQCACAKAACsAgAglwEAAKoCADCYAQAACQAQmQEAAKoCADCaAQEA9QEAIaQBAACrAt8BIqoBQAD8AQAhqwFAAPwBACHJAQEA9QEAIcoBAQD1AQAh2wFAAPwBACHcAQIA-wEAId0BEACmAgAhAwcAAOADACAIAADhAwAgCgAA4wMAIA8HAAChAgAgCAAApAIAIAoAAKwCACCXAQAAqgIAMJgBAAAJABCZAQAAqgIAMJoBAQAAAAGkAQAAqwLfASKqAUAA_AEAIasBQAD8AQAhyQEBAPUBACHKAQEA9QEAIdsBQAD8AQAh3AECAPsBACHdARAApgIAIQMAAAAJACABAAAKADACAAALACAUCQAAqQIAIJcBAAClAgAwmAEAAA0AEJkBAAClAgAwmgEBAPUBACGkAQAApwLRASKqAUAA_AEAIasBQAD8AQAhywEBAPUBACHMAQEA9QEAIc0BAQD2AQAhzgEQAKYCACHPAQEA9QEAIdEBAQD2AQAh0gEBAPYBACHTAQEA9gEAIdQBAQD2AQAh1QFAAKgCACHWAQEA9gEAIdcBQACoAgAhCQkAAOIDACDNAQAAsQIAINEBAACxAgAg0gEAALECACDTAQAAsQIAINQBAACxAgAg1QEAALECACDWAQAAsQIAINcBAACxAgAgFAkAAKkCACCXAQAApQIAMJgBAAANABCZAQAApQIAMJoBAQAAAAGkAQAApwLRASKqAUAA_AEAIasBQAD8AQAhywEBAPUBACHMAQEAAAABzQEBAPYBACHOARAApgIAIc8BAQD1AQAh0QEBAPYBACHSAQEA9gEAIdMBAQD2AQAh1AEBAPYBACHVAUAAqAIAIdYBAQD2AQAh1wFAAKgCACEDAAAADQAgAQAADgAwAgAADwAgAQAAAA0AIAwHAAChAgAgCAAApAIAIJcBAACjAgAwmAEAABIAEJkBAACjAgAwmgEBAPUBACGqAUAA_AEAIasBQAD8AQAhwAECAPsBACHIAQEA9QEAIckBAQD1AQAhygEBAPUBACECBwAA4AMAIAgAAOEDACANBwAAoQIAIAgAAKQCACCXAQAAowIAMJgBAAASABCZAQAAowIAMJoBAQAAAAGqAUAA_AEAIasBQAD8AQAhwAECAPsBACHIAQEA9QEAIckBAQD1AQAhygEBAPUBACHkAQAAogIAIAMAAAASACABAAATADACAAAUACABAAAACQAgAQAAABIAIAMAAAAJACABAAAKADACAAALACADAAAAEgAgAQAAEwAwAgAAFAAgDw4AAKECACCXAQAAnwIAMJgBAAAaABCZAQAAnwIAMJoBAQD1AQAhpAEAAKAC4wEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAId8BAQD1AQAh4AEBAPUBACHhAQEA9QEAIeMBAQD1AQAhAQ4AAOADACADAAAAGgAgAQAAGwAwAgAAAQAgAQAAAAMAIAEAAAAJACABAAAAEgAgAQAAABoAIAEAAAABACADAAAAGgAgAQAAGwAwAgAAAQAgAwAAABoAIAEAABsAMAIAAAEAIAMAAAAaACABAAAbADACAAABACAMDgAA3wMAIJoBAQAAAAGkAQAAAOMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAAB3wEBAAAAAeABAQAAAAHhAQEAAAAB4wEBAAAAAQEUAAAlACALmgEBAAAAAaQBAAAA4wECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAHfAQEAAAAB4AEBAAAAAeEBAQAAAAHjAQEAAAABARQAACcAMAEUAAAnADAMDgAA3gMAIJoBAQC3AgAhpAEAAM0C4wEiqAEgALwCACGqAUAAvgIAIasBQAC-AgAhugEBALcCACG7AQEAtwIAId8BAQC3AgAh4AEBALcCACHhAQEAtwIAIeMBAQC3AgAhAgAAAAEAIBQAACoAIAuaAQEAtwIAIaQBAADNAuMBIqgBIAC8AgAhqgFAAL4CACGrAUAAvgIAIboBAQC3AgAhuwEBALcCACHfAQEAtwIAIeABAQC3AgAh4QEBALcCACHjAQEAtwIAIQIAAAAaACAUAAAsACACAAAAGgAgFAAALAAgAwAAAAEAIBsAACUAIBwAACoAIAEAAAABACABAAAAGgAgAwQAANsDACAhAADdAwAgIgAA3AMAIA6XAQAAmwIAMJgBAAAzABCZAQAAmwIAMJoBAQDaAQAhpAEAAJwC4wEiqAEgAN8BACGqAUAA4QEAIasBQADhAQAhugEBANoBACG7AQEA2gEAId8BAQDaAQAh4AEBANoBACHhAQEA2gEAIeMBAQDaAQAhAwAAABoAIAEAADIAMCAAADMAIAMAAAAaACABAAAbADACAAABACABAAAACwAgAQAAAAsAIAMAAAAJACABAAAKADACAAALACADAAAACQAgAQAACgAwAgAACwAgAwAAAAkAIAEAAAoAMAIAAAsAIAwHAACkAwAgCAAA_AIAIAoAAP0CACCaAQEAAAABpAEAAADfAQKqAUAAAAABqwFAAAAAAckBAQAAAAHKAQEAAAAB2wFAAAAAAdwBAgAAAAHdARAAAAABARQAADsAIAmaAQEAAAABpAEAAADfAQKqAUAAAAABqwFAAAAAAckBAQAAAAHKAQEAAAAB2wFAAAAAAdwBAgAAAAHdARAAAAABARQAAD0AMAEUAAA9ADAMBwAAogMAIAgAAOsCACAKAADsAgAgmgEBALcCACGkAQAA6QLfASKqAUAAvgIAIasBQAC-AgAhyQEBALcCACHKAQEAtwIAIdsBQAC-AgAh3AECAL0CACHdARAA6AIAIQIAAAALACAUAABAACAJmgEBALcCACGkAQAA6QLfASKqAUAAvgIAIasBQAC-AgAhyQEBALcCACHKAQEAtwIAIdsBQAC-AgAh3AECAL0CACHdARAA6AIAIQIAAAAJACAUAABCACACAAAACQAgFAAAQgAgAwAAAAsAIBsAADsAIBwAAEAAIAEAAAALACABAAAACQAgBQQAANYDACAhAADZAwAgIgAA2AMAIDMAANcDACA0AADaAwAgDJcBAACXAgAwmAEAAEkAEJkBAACXAgAwmgEBANoBACGkAQAAmALfASKqAUAA4QEAIasBQADhAQAhyQEBANoBACHKAQEA2gEAIdsBQADhAQAh3AECAOABACHdARAAggIAIQMAAAAJACABAABIADAgAABJACADAAAACQAgAQAACgAwAgAACwAgCQMAAP0BACCXAQAAlgIAMJgBAABPABCZAQAAlgIAMJoBAQAAAAGbAQEAAAABqgFAAPwBACGrAUAA_AEAIbsBAQAAAAEBAAAATAAgAQAAAEwAIAkDAAD9AQAglwEAAJYCADCYAQAATwAQmQEAAJYCADCaAQEA9QEAIZsBAQD1AQAhqgFAAPwBACGrAUAA_AEAIbsBAQD1AQAhAQMAAK4DACADAAAATwAgAQAAUAAwAgAATAAgAwAAAE8AIAEAAFAAMAIAAEwAIAMAAABPACABAABQADACAABMACAGAwAA1QMAIJoBAQAAAAGbAQEAAAABqgFAAAAAAasBQAAAAAG7AQEAAAABARQAAFQAIAWaAQEAAAABmwEBAAAAAaoBQAAAAAGrAUAAAAABuwEBAAAAAQEUAABWADABFAAAVgAwBgMAAMsDACCaAQEAtwIAIZsBAQC3AgAhqgFAAL4CACGrAUAAvgIAIbsBAQC3AgAhAgAAAEwAIBQAAFkAIAWaAQEAtwIAIZsBAQC3AgAhqgFAAL4CACGrAUAAvgIAIbsBAQC3AgAhAgAAAE8AIBQAAFsAIAIAAABPACAUAABbACADAAAATAAgGwAAVAAgHAAAWQAgAQAAAEwAIAEAAABPACADBAAAyAMAICEAAMoDACAiAADJAwAgCJcBAACVAgAwmAEAAGIAEJkBAACVAgAwmgEBANoBACGbAQEA2gEAIaoBQADhAQAhqwFAAOEBACG7AQEA2gEAIQMAAABPACABAABhADAgAABiACADAAAATwAgAQAAUAAwAgAATAAgC5cBAACUAgAwmAEAAGgAEJkBAACUAgAwmgEBAAAAAZsBAQD1AQAhnAEBAPUBACGqAUAA_AEAIasBQAD8AQAh2AEBAPUBACHZAQEA9QEAIdoBIAD6AQAhAQAAAGUAIAEAAABlACALlwEAAJQCADCYAQAAaAAQmQEAAJQCADCaAQEA9QEAIZsBAQD1AQAhnAEBAPUBACGqAUAA_AEAIasBQAD8AQAh2AEBAPUBACHZAQEA9QEAIdoBIAD6AQAhAAMAAABoACABAABpADACAABlACADAAAAaAAgAQAAaQAwAgAAZQAgAwAAAGgAIAEAAGkAMAIAAGUAIAiaAQEAAAABmwEBAAAAAZwBAQAAAAGqAUAAAAABqwFAAAAAAdgBAQAAAAHZAQEAAAAB2gEgAAAAAQEUAABtACAImgEBAAAAAZsBAQAAAAGcAQEAAAABqgFAAAAAAasBQAAAAAHYAQEAAAAB2QEBAAAAAdoBIAAAAAEBFAAAbwAwARQAAG8AMAiaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGqAUAAvgIAIasBQAC-AgAh2AEBALcCACHZAQEAtwIAIdoBIAC8AgAhAgAAAGUAIBQAAHIAIAiaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGqAUAAvgIAIasBQAC-AgAh2AEBALcCACHZAQEAtwIAIdoBIAC8AgAhAgAAAGgAIBQAAHQAIAIAAABoACAUAAB0ACADAAAAZQAgGwAAbQAgHAAAcgAgAQAAAGUAIAEAAABoACADBAAAxQMAICEAAMcDACAiAADGAwAgC5cBAACTAgAwmAEAAHsAEJkBAACTAgAwmgEBANoBACGbAQEA2gEAIZwBAQDaAQAhqgFAAOEBACGrAUAA4QEAIdgBAQDaAQAh2QEBANoBACHaASAA3wEAIQMAAABoACABAAB6ADAgAAB7ACADAAAAaAAgAQAAaQAwAgAAZQAgAQAAAA8AIAEAAAAPACADAAAADQAgAQAADgAwAgAADwAgAwAAAA0AIAEAAA4AMAIAAA8AIAMAAAANACABAAAOADACAAAPACARCQAAxAMAIJoBAQAAAAGkAQAAANEBAqoBQAAAAAGrAUAAAAABywEBAAAAAcwBAQAAAAHNAQEAAAABzgEQAAAAAc8BAQAAAAHRAQEAAAAB0gEBAAAAAdMBAQAAAAHUAQEAAAAB1QFAAAAAAdYBAQAAAAHXAUAAAAABARQAAIMBACAQmgEBAAAAAaQBAAAA0QECqgFAAAAAAasBQAAAAAHLAQEAAAABzAEBAAAAAc0BAQAAAAHOARAAAAABzwEBAAAAAdEBAQAAAAHSAQEAAAAB0wEBAAAAAdQBAQAAAAHVAUAAAAAB1gEBAAAAAdcBQAAAAAEBFAAAhQEAMAEUAACFAQAwEQkAAMMDACCaAQEAtwIAIaQBAAD3AtEBIqoBQAC-AgAhqwFAAL4CACHLAQEAtwIAIcwBAQC3AgAhzQEBALgCACHOARAA6AIAIc8BAQC3AgAh0QEBALgCACHSAQEAuAIAIdMBAQC4AgAh1AEBALgCACHVAUAA-AIAIdYBAQC4AgAh1wFAAPgCACECAAAADwAgFAAAiAEAIBCaAQEAtwIAIaQBAAD3AtEBIqoBQAC-AgAhqwFAAL4CACHLAQEAtwIAIcwBAQC3AgAhzQEBALgCACHOARAA6AIAIc8BAQC3AgAh0QEBALgCACHSAQEAuAIAIdMBAQC4AgAh1AEBALgCACHVAUAA-AIAIdYBAQC4AgAh1wFAAPgCACECAAAADQAgFAAAigEAIAIAAAANACAUAACKAQAgAwAAAA8AIBsAAIMBACAcAACIAQAgAQAAAA8AIAEAAAANACANBAAAvgMAICEAAMEDACAiAADAAwAgMwAAvwMAIDQAAMIDACDNAQAAsQIAINEBAACxAgAg0gEAALECACDTAQAAsQIAINQBAACxAgAg1QEAALECACDWAQAAsQIAINcBAACxAgAgE5cBAACMAgAwmAEAAJEBABCZAQAAjAIAMJoBAQDaAQAhpAEAAI0C0QEiqgFAAOEBACGrAUAA4QEAIcsBAQDaAQAhzAEBANoBACHNAQEA2wEAIc4BEACCAgAhzwEBANoBACHRAQEA2wEAIdIBAQDbAQAh0wEBANsBACHUAQEA2wEAIdUBQACOAgAh1gEBANsBACHXAUAAjgIAIQMAAAANACABAACQAQAwIAAAkQEAIAMAAAANACABAAAOADACAAAPACABAAAAFAAgAQAAABQAIAMAAAASACABAAATADACAAAUACADAAAAEgAgAQAAEwAwAgAAFAAgAwAAABIAIAEAABMAMAIAABQAIAkHAACZAwAgCAAA3QIAIJoBAQAAAAGqAUAAAAABqwFAAAAAAcABAgAAAAHIAQEAAAAByQEBAAAAAcoBAQAAAAEBFAAAmQEAIAeaAQEAAAABqgFAAAAAAasBQAAAAAHAAQIAAAAByAEBAAAAAckBAQAAAAHKAQEAAAABARQAAJsBADABFAAAmwEAMAkHAACXAwAgCAAA2wIAIJoBAQC3AgAhqgFAAL4CACGrAUAAvgIAIcABAgC9AgAhyAEBALcCACHJAQEAtwIAIcoBAQC3AgAhAgAAABQAIBQAAJ4BACAHmgEBALcCACGqAUAAvgIAIasBQAC-AgAhwAECAL0CACHIAQEAtwIAIckBAQC3AgAhygEBALcCACECAAAAEgAgFAAAoAEAIAIAAAASACAUAACgAQAgAwAAABQAIBsAAJkBACAcAACeAQAgAQAAABQAIAEAAAASACAFBAAAuQMAICEAALwDACAiAAC7AwAgMwAAugMAIDQAAL0DACAKlwEAAIsCADCYAQAApwEAEJkBAACLAgAwmgEBANoBACGqAUAA4QEAIasBQADhAQAhwAECAOABACHIAQEA2gEAIckBAQDaAQAhygEBANoBACEDAAAAEgAgAQAApgEAMCAAAKcBACADAAAAEgAgAQAAEwAwAgAAFAAgAQAAAAUAIAEAAAAFACADAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACATBQAApwMAIAYAALgDACALAACoAwAgDAAAqQMAIJoBAQAAAAGkAQAAAMMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAABvAEBAAAAAb0BAQAAAAG-ARAAAAABvwECAAAAAcABCAAAAAHBAQAApgMAIMMBAQAAAAHEAQEAAAABARQAAK8BACAPmgEBAAAAAaQBAAAAwwECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAG8AQEAAAABvQEBAAAAAb4BEAAAAAG_AQIAAAABwAEIAAAAAcEBAACmAwAgwwEBAAAAAcQBAQAAAAEBFAAAsQEAMAEUAACxAQAwEwUAAIwDACAGAAC3AwAgCwAAjQMAIAwAAI4DACCaAQEAtwIAIaQBAACKA8MBIqgBIAC8AgAhqgFAAL4CACGrAUAAvgIAIboBAQC3AgAhuwEBALcCACG8AQEAtwIAIb0BAQC3AgAhvgEQAOgCACG_AQIAvQIAIcABCACIAwAhwQEAAIkDACDDAQEAtwIAIcQBAQC3AgAhAgAAAAUAIBQAALQBACAPmgEBALcCACGkAQAAigPDASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAhvAEBALcCACG9AQEAtwIAIb4BEADoAgAhvwECAL0CACHAAQgAiAMAIcEBAACJAwAgwwEBALcCACHEAQEAtwIAIQIAAAADACAUAAC2AQAgAgAAAAMAIBQAALYBACADAAAABQAgGwAArwEAIBwAALQBACABAAAABQAgAQAAAAMAIAUEAACyAwAgIQAAtQMAICIAALQDACAzAACzAwAgNAAAtgMAIBKXAQAAgQIAMJgBAAC9AQAQmQEAAIECADCaAQEA2gEAIaQBAACFAsMBIqgBIADfAQAhqgFAAOEBACGrAUAA4QEAIboBAQDaAQAhuwEBANoBACG8AQEA2gEAIb0BAQDaAQAhvgEQAIICACG_AQIA4AEAIcABCACDAgAhwQEAAIQCACDDAQEA2gEAIcQBAQDaAQAhAwAAAAMAIAEAALwBADAgAAC9AQAgAwAAAAMAIAEAAAQAMAIAAAUAIBYDAAD9AQAgCwAA_gEAIAwAAP8BACANAACAAgAglwEAAPQBADCYAQAAwwEAEJkBAAD0AQAwmgEBAAAAAZsBAQD1AQAhnAEBAAAAAZ0BAQD2AQAhngEBAAAAAZ8BAQD2AQAhoAEBAPYBACGiAQAA9wGiASKkAQAA-AGkASKmAQAA-QGmASKnASAA-gEAIagBIAD6AQAhqQECAPsBACGqAUAA_AEAIasBQAD8AQAhAQAAAMABACABAAAAwAEAIBYDAAD9AQAgCwAA_gEAIAwAAP8BACANAACAAgAglwEAAPQBADCYAQAAwwEAEJkBAAD0AQAwmgEBAPUBACGbAQEA9QEAIZwBAQD1AQAhnQEBAPYBACGeAQEA9gEAIZ8BAQD2AQAhoAEBAPYBACGiAQAA9wGiASKkAQAA-AGkASKmAQAA-QGmASKnASAA-gEAIagBIAD6AQAhqQECAPsBACGqAUAA_AEAIasBQAD8AQAhCAMAAK4DACALAACvAwAgDAAAsAMAIA0AALEDACCdAQAAsQIAIJ4BAACxAgAgnwEAALECACCgAQAAsQIAIAMAAADDAQAgAQAAxAEAMAIAAMABACADAAAAwwEAIAEAAMQBADACAADAAQAgAwAAAMMBACABAADEAQAwAgAAwAEAIBMDAACqAwAgCwAAqwMAIAwAAKwDACANAACtAwAgmgEBAAAAAZsBAQAAAAGcAQEAAAABnQEBAAAAAZ4BAQAAAAGfAQEAAAABoAEBAAAAAaIBAAAAogECpAEAAACkAQKmAQAAAKYBAqcBIAAAAAGoASAAAAABqQECAAAAAaoBQAAAAAGrAUAAAAABARQAAMgBACAPmgEBAAAAAZsBAQAAAAGcAQEAAAABnQEBAAAAAZ4BAQAAAAGfAQEAAAABoAEBAAAAAaIBAAAAogECpAEAAACkAQKmAQAAAKYBAqcBIAAAAAGoASAAAAABqQECAAAAAaoBQAAAAAGrAUAAAAABARQAAMoBADABFAAAygEAMBMDAAC_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-AQAgDAAA_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_AEAIdgBAQD1AQAh2QEBAPUBACHaASAA-gEAIQiXAQAAlQIAMJgBAABiABCZAQAAlQIAMJoBAQDaAQAhmwEBANoBACGqAUAA4QEAIasBQADhAQAhuwEBANoBACEJAwAA_QEAIJcBAACWAgAwmAEAAE8AEJkBAACWAgAwmgEBAPUBACGbAQEA9QEAIaoBQAD8AQAhqwFAAPwBACG7AQEA9QEAIQyXAQAAlwIAMJgBAABJABCZAQAAlwIAMJoBAQDaAQAhpAEAAJgC3wEiqgFAAOEBACGrAUAA4QEAIckBAQDaAQAhygEBANoBACHbAUAA4QEAIdwBAgDgAQAh3QEQAIICACEHBAAA4wEAICEAAJoCACAiAACaAgAgrAEAAADfAQKtAQAAAN8BCK4BAAAA3wEIswEAAJkC3wEiBwQAAOMBACAhAACaAgAgIgAAmgIAIKwBAAAA3wECrQEAAADfAQiuAQAAAN8BCLMBAACZAt8BIgSsAQAAAN8BAq0BAAAA3wEIrgEAAADfAQizAQAAmgLfASIOlwEAAJsCADCYAQAAMwAQmQEAAJsCADCaAQEA2gEAIaQBAACcAuMBIqgBIADfAQAhqgFAAOEBACGrAUAA4QEAIboBAQDaAQAhuwEBANoBACHfAQEA2gEAIeABAQDaAQAh4QEBANoBACHjAQEA2gEAIQcEAADjAQAgIQAAngIAICIAAJ4CACCsAQAAAOMBAq0BAAAA4wEIrgEAAADjAQizAQAAnQLjASIHBAAA4wEAICEAAJ4CACAiAACeAgAgrAEAAADjAQKtAQAAAOMBCK4BAAAA4wEIswEAAJ0C4wEiBKwBAAAA4wECrQEAAADjAQiuAQAAAOMBCLMBAACeAuMBIg8OAAChAgAglwEAAJ8CADCYAQAAGgAQmQEAAJ8CADCaAQEA9QEAIaQBAACgAuMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACHfAQEA9QEAIeABAQD1AQAh4QEBAPUBACHjAQEA9QEAIQSsAQAAAOMBAq0BAAAA4wEIrgEAAADjAQizAQAAngLjASIYAwAA_QEAIAsAAP4BACAMAAD_AQAgDQAAgAIAIJcBAAD0AQAwmAEAAMMBABCZAQAA9AEAMJoBAQD1AQAhmwEBAPUBACGcAQEA9QEAIZ0BAQD2AQAhngEBAPYBACGfAQEA9gEAIaABAQD2AQAhogEAAPcBogEipAEAAPgBpAEipgEAAPkBpgEipwEgAPoBACGoASAA-gEAIakBAgD7AQAhqgFAAPwBACGrAUAA_AEAIeUBAADDAQAg5gEAAMMBACACyQEBAAAAAcoBAQAAAAEMBwAAoQIAIAgAAKQCACCXAQAAowIAMJgBAAASABCZAQAAowIAMJoBAQD1AQAhqgFAAPwBACGrAUAA_AEAIcABAgD7AQAhyAEBAPUBACHJAQEA9QEAIcoBAQD1AQAhGAUAALACACAGAAChAgAgCwAA_gEAIAwAAP8BACCXAQAArQIAMJgBAAADABCZAQAArQIAMJoBAQD1AQAhpAEAAK8CwwEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEA9QEAIbwBAQD1AQAhvQEBAPUBACG-ARAApgIAIb8BAgD7AQAhwAEIAK4CACHBAQAAhAIAIMMBAQD1AQAhxAEBAPUBACHlAQAAAwAg5gEAAAMAIBQJAACpAgAglwEAAKUCADCYAQAADQAQmQEAAKUCADCaAQEA9QEAIaQBAACnAtEBIqoBQAD8AQAhqwFAAPwBACHLAQEA9QEAIcwBAQD1AQAhzQEBAPYBACHOARAApgIAIc8BAQD1AQAh0QEBAPYBACHSAQEA9gEAIdMBAQD2AQAh1AEBAPYBACHVAUAAqAIAIdYBAQD2AQAh1wFAAKgCACEIrAEQAAAAAa0BEAAAAASuARAAAAAErwEQAAAAAbABEAAAAAGxARAAAAABsgEQAAAAAbMBEACKAgAhBKwBAAAA0QECrQEAAADRAQiuAQAAANEBCLMBAACSAtEBIgisAUAAAAABrQFAAAAABa4BQAAAAAWvAUAAAAABsAFAAAAAAbEBQAAAAAGyAUAAAAABswFAAJACACERBwAAoQIAIAgAAKQCACAKAACsAgAglwEAAKoCADCYAQAACQAQmQEAAKoCADCaAQEA9QEAIaQBAACrAt8BIqoBQAD8AQAhqwFAAPwBACHJAQEA9QEAIcoBAQD1AQAh2wFAAPwBACHcAQIA-wEAId0BEACmAgAh5QEAAAkAIOYBAAAJACAPBwAAoQIAIAgAAKQCACAKAACsAgAglwEAAKoCADCYAQAACQAQmQEAAKoCADCaAQEA9QEAIaQBAACrAt8BIqoBQAD8AQAhqwFAAPwBACHJAQEA9QEAIcoBAQD1AQAh2wFAAPwBACHcAQIA-wEAId0BEACmAgAhBKwBAAAA3wECrQEAAADfAQiuAQAAAN8BCLMBAACaAt8BIgO3AQAADQAguAEAAA0AILkBAAANACAWBQAAsAIAIAYAAKECACALAAD-AQAgDAAA_wEAIJcBAACtAgAwmAEAAAMAEJkBAACtAgAwmgEBAPUBACGkAQAArwLDASKoASAA-gEAIaoBQAD8AQAhqwFAAPwBACG6AQEA9QEAIbsBAQD1AQAhvAEBAPUBACG9AQEA9QEAIb4BEACmAgAhvwECAPsBACHAAQgArgIAIcEBAACEAgAgwwEBAPUBACHEAQEA9QEAIQisAQgAAAABrQEIAAAABK4BCAAAAASvAQgAAAABsAEIAAAAAbEBCAAAAAGyAQgAAAABswEIAOYBACEErAEAAADDAQKtAQAAAMMBCK4BAAAAwwEIswEAAIcCwwEiCwMAAP0BACCXAQAAlgIAMJgBAABPABCZAQAAlgIAMJoBAQD1AQAhmwEBAPUBACGqAUAA_AEAIasBQAD8AQAhuwEBAPUBACHlAQAATwAg5gEAAE8AIAAAAAAAAAHqAQEAAAABAeoBAQAAAAEB6gEAAACiAQIB6gEAAACkAQIB6gEAAACmAQIB6gEgAAAAAQXqAQIAAAAB8QECAAAAAfIBAgAAAAHzAQIAAAAB9AECAAAAAQHqAUAAAAABCxsAAP4CADAcAACDAwAw5wEAAP8CADDoAQAAgAMAMOkBAACBAwAg6gEAAIIDADDrAQAAggMAMOwBAACCAwAw7QEAAIIDADDuAQAAhAMAMO8BAACFAwAwCxsAAN4CADAcAADjAgAw5wEAAN8CADDoAQAA4AIAMOkBAADhAgAg6gEAAOICADDrAQAA4gIAMOwBAADiAgAw7QEAAOICADDuAQAA5AIAMO8BAADlAgAwCxsAANACADAcAADVAgAw5wEAANECADDoAQAA0gIAMOkBAADTAgAg6gEAANQCADDrAQAA1AIAMOwBAADUAgAw7QEAANQCADDuAQAA1gIAMO8BAADXAgAwCxsAAMMCADAcAADIAgAw5wEAAMQCADDoAQAAxQIAMOkBAADGAgAg6gEAAMcCADDrAQAAxwIAMOwBAADHAgAw7QEAAMcCADDuAQAAyQIAMO8BAADKAgAwCpoBAQAAAAGkAQAAAOMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAAB3wEBAAAAAeABAQAAAAHhAQEAAAABAgAAAAEAIBsAAM8CACADAAAAAQAgGwAAzwIAIBwAAM4CACABFAAAlAQAMA8OAAChAgAglwEAAJ8CADCYAQAAGgAQmQEAAJ8CADCaAQEAAAABpAEAAKAC4wEiqAEgAPoBACGqAUAA_AEAIasBQAD8AQAhugEBAPUBACG7AQEAAAAB3wEBAPUBACHgAQEA9QEAIeEBAQD1AQAh4wEBAPUBACECAAAAAQAgFAAAzgIAIAIAAADLAgAgFAAAzAIAIA6XAQAAygIAMJgBAADLAgAQmQEAAMoCADCaAQEA9QEAIaQBAACgAuMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACHfAQEA9QEAIeABAQD1AQAh4QEBAPUBACHjAQEA9QEAIQ6XAQAAygIAMJgBAADLAgAQmQEAAMoCADCaAQEA9QEAIaQBAACgAuMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACHfAQEA9QEAIeABAQD1AQAh4QEBAPUBACHjAQEA9QEAIQqaAQEAtwIAIaQBAADNAuMBIqgBIAC8AgAhqgFAAL4CACGrAUAAvgIAIboBAQC3AgAhuwEBALcCACHfAQEAtwIAIeABAQC3AgAh4QEBALcCACEB6gEAAADjAQIKmgEBALcCACGkAQAAzQLjASKoASAAvAIAIaoBQAC-AgAhqwFAAL4CACG6AQEAtwIAIbsBAQC3AgAh3wEBALcCACHgAQEAtwIAIeEBAQC3AgAhCpoBAQAAAAGkAQAAAOMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAAB3wEBAAAAAeABAQAAAAHhAQEAAAABBwgAAN0CACCaAQEAAAABqgFAAAAAAasBQAAAAAHAAQIAAAAByAEBAAAAAcoBAQAAAAECAAAAFAAgGwAA3AIAIAMAAAAUACAbAADcAgAgHAAA2gIAIAEUAACTBAAwDQcAAKECACAIAACkAgAglwEAAKMCADCYAQAAEgAQmQEAAKMCADCaAQEAAAABqgFAAPwBACGrAUAA_AEAIcABAgD7AQAhyAEBAPUBACHJAQEA9QEAIcoBAQD1AQAh5AEAAKICACACAAAAFAAgFAAA2gIAIAIAAADYAgAgFAAA2QIAIAqXAQAA1wIAMJgBAADYAgAQmQEAANcCADCaAQEA9QEAIaoBQAD8AQAhqwFAAPwBACHAAQIA-wEAIcgBAQD1AQAhyQEBAPUBACHKAQEA9QEAIQqXAQAA1wIAMJgBAADYAgAQmQEAANcCADCaAQEA9QEAIaoBQAD8AQAhqwFAAPwBACHAAQIA-wEAIcgBAQD1AQAhyQEBAPUBACHKAQEA9QEAIQaaAQEAtwIAIaoBQAC-AgAhqwFAAL4CACHAAQIAvQIAIcgBAQC3AgAhygEBALcCACEHCAAA2wIAIJoBAQC3AgAhqgFAAL4CACGrAUAAvgIAIcABAgC9AgAhyAEBALcCACHKAQEAtwIAIQUbAACOBAAgHAAAkQQAIOcBAACPBAAg6AEAAJAEACDtAQAABQAgBwgAAN0CACCaAQEAAAABqgFAAAAAAasBQAAAAAHAAQIAAAAByAEBAAAAAcoBAQAAAAEDGwAAjgQAIOcBAACPBAAg7QEAAAUAIAoIAAD8AgAgCgAA_QIAIJoBAQAAAAGkAQAAAN8BAqoBQAAAAAGrAUAAAAABygEBAAAAAdsBQAAAAAHcAQIAAAAB3QEQAAAAAQIAAAALACAbAAD7AgAgAwAAAAsAIBsAAPsCACAcAADqAgAgARQAAI0EADAPBwAAoQIAIAgAAKQCACAKAACsAgAglwEAAKoCADCYAQAACQAQmQEAAKoCADCaAQEAAAABpAEAAKsC3wEiqgFAAPwBACGrAUAA_AEAIckBAQD1AQAhygEBAPUBACHbAUAA_AEAIdwBAgD7AQAh3QEQAKYCACECAAAACwAgFAAA6gIAIAIAAADmAgAgFAAA5wIAIAyXAQAA5QIAMJgBAADmAgAQmQEAAOUCADCaAQEA9QEAIaQBAACrAt8BIqoBQAD8AQAhqwFAAPwBACHJAQEA9QEAIcoBAQD1AQAh2wFAAPwBACHcAQIA-wEAId0BEACmAgAhDJcBAADlAgAwmAEAAOYCABCZAQAA5QIAMJoBAQD1AQAhpAEAAKsC3wEiqgFAAPwBACGrAUAA_AEAIckBAQD1AQAhygEBAPUBACHbAUAA_AEAIdwBAgD7AQAh3QEQAKYCACEImgEBALcCACGkAQAA6QLfASKqAUAAvgIAIasBQAC-AgAhygEBALcCACHbAUAAvgIAIdwBAgC9AgAh3QEQAOgCACEF6gEQAAAAAfEBEAAAAAHyARAAAAAB8wEQAAAAAfQBEAAAAAEB6gEAAADfAQIKCAAA6wIAIAoAAOwCACCaAQEAtwIAIaQBAADpAt8BIqoBQAC-AgAhqwFAAL4CACHKAQEAtwIAIdsBQAC-AgAh3AECAL0CACHdARAA6AIAIQUbAACHBAAgHAAAiwQAIOcBAACIBAAg6AEAAIoEACDtAQAABQAgCxsAAO0CADAcAADyAgAw5wEAAO4CADDoAQAA7wIAMOkBAADwAgAg6gEAAPECADDrAQAA8QIAMOwBAADxAgAw7QEAAPECADDuAQAA8wIAMO8BAAD0AgAwD5oBAQAAAAGkAQAAANEBAqoBQAAAAAGrAUAAAAABzAEBAAAAAc0BAQAAAAHOARAAAAABzwEBAAAAAdEBAQAAAAHSAQEAAAAB0wEBAAAAAdQBAQAAAAHVAUAAAAAB1gEBAAAAAdcBQAAAAAECAAAADwAgGwAA-gIAIAMAAAAPACAbAAD6AgAgHAAA-QIAIAEUAACJBAAwFAkAAKkCACCXAQAApQIAMJgBAAANABCZAQAApQIAMJoBAQAAAAGkAQAApwLRASKqAUAA_AEAIasBQAD8AQAhywEBAPUBACHMAQEAAAABzQEBAPYBACHOARAApgIAIc8BAQD1AQAh0QEBAPYBACHSAQEA9gEAIdMBAQD2AQAh1AEBAPYBACHVAUAAqAIAIdYBAQD2AQAh1wFAAKgCACECAAAADwAgFAAA-QIAIAIAAAD1AgAgFAAA9gIAIBOXAQAA9AIAMJgBAAD1AgAQmQEAAPQCADCaAQEA9QEAIaQBAACnAtEBIqoBQAD8AQAhqwFAAPwBACHLAQEA9QEAIcwBAQD1AQAhzQEBAPYBACHOARAApgIAIc8BAQD1AQAh0QEBAPYBACHSAQEA9gEAIdMBAQD2AQAh1AEBAPYBACHVAUAAqAIAIdYBAQD2AQAh1wFAAKgCACETlwEAAPQCADCYAQAA9QIAEJkBAAD0AgAwmgEBAPUBACGkAQAApwLRASKqAUAA_AEAIasBQAD8AQAhywEBAPUBACHMAQEA9QEAIc0BAQD2AQAhzgEQAKYCACHPAQEA9QEAIdEBAQD2AQAh0gEBAPYBACHTAQEA9gEAIdQBAQD2AQAh1QFAAKgCACHWAQEA9gEAIdcBQACoAgAhD5oBAQC3AgAhpAEAAPcC0QEiqgFAAL4CACGrAUAAvgIAIcwBAQC3AgAhzQEBALgCACHOARAA6AIAIc8BAQC3AgAh0QEBALgCACHSAQEAuAIAIdMBAQC4AgAh1AEBALgCACHVAUAA-AIAIdYBAQC4AgAh1wFAAPgCACEB6gEAAADRAQIB6gFAAAAAAQ-aAQEAtwIAIaQBAAD3AtEBIqoBQAC-AgAhqwFAAL4CACHMAQEAtwIAIc0BAQC4AgAhzgEQAOgCACHPAQEAtwIAIdEBAQC4AgAh0gEBALgCACHTAQEAuAIAIdQBAQC4AgAh1QFAAPgCACHWAQEAuAIAIdcBQAD4AgAhD5oBAQAAAAGkAQAAANEBAqoBQAAAAAGrAUAAAAABzAEBAAAAAc0BAQAAAAHOARAAAAABzwEBAAAAAdEBAQAAAAHSAQEAAAAB0wEBAAAAAdQBAQAAAAHVAUAAAAAB1gEBAAAAAdcBQAAAAAEKCAAA_AIAIAoAAP0CACCaAQEAAAABpAEAAADfAQKqAUAAAAABqwFAAAAAAcoBAQAAAAHbAUAAAAAB3AECAAAAAd0BEAAAAAEDGwAAhwQAIOcBAACIBAAg7QEAAAUAIAQbAADtAgAw5wEAAO4CADDpAQAA8AIAIO0BAADxAgAwEQUAAKcDACALAACoAwAgDAAAqQMAIJoBAQAAAAGkAQAAAMMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAABvAEBAAAAAb0BAQAAAAG-ARAAAAABvwECAAAAAcABCAAAAAHBAQAApgMAIMMBAQAAAAECAAAABQAgGwAApQMAIAMAAAAFACAbAAClAwAgHAAAiwMAIAEUAACGBAAwFgUAALACACAGAAChAgAgCwAA_gEAIAwAAP8BACCXAQAArQIAMJgBAAADABCZAQAArQIAMJoBAQAAAAGkAQAArwLDASKoASAA-gEAIaoBQAD8AQAhqwFAAPwBACG6AQEA9QEAIbsBAQAAAAG8AQEA9QEAIb0BAQD1AQAhvgEQAKYCACG_AQIA-wEAIcABCACuAgAhwQEAAIQCACDDAQEA9QEAIcQBAQD1AQAhAgAAAAUAIBQAAIsDACACAAAAhgMAIBQAAIcDACASlwEAAIUDADCYAQAAhgMAEJkBAACFAwAwmgEBAPUBACGkAQAArwLDASKoASAA-gEAIaoBQAD8AQAhqwFAAPwBACG6AQEA9QEAIbsBAQD1AQAhvAEBAPUBACG9AQEA9QEAIb4BEACmAgAhvwECAPsBACHAAQgArgIAIcEBAACEAgAgwwEBAPUBACHEAQEA9QEAIRKXAQAAhQMAMJgBAACGAwAQmQEAAIUDADCaAQEA9QEAIaQBAACvAsMBIqgBIAD6AQAhqgFAAPwBACGrAUAA_AEAIboBAQD1AQAhuwEBAPUBACG8AQEA9QEAIb0BAQD1AQAhvgEQAKYCACG_AQIA-wEAIcABCACuAgAhwQEAAIQCACDDAQEA9QEAIcQBAQD1AQAhDpoBAQC3AgAhpAEAAIoDwwEiqAEgALwCACGqAUAAvgIAIasBQAC-AgAhugEBALcCACG7AQEAtwIAIbwBAQC3AgAhvQEBALcCACG-ARAA6AIAIb8BAgC9AgAhwAEIAIgDACHBAQAAiQMAIMMBAQC3AgAhBeoBCAAAAAHxAQgAAAAB8gEIAAAAAfMBCAAAAAH0AQgAAAABAuoBAQAAAATwAQEAAAAFAeoBAAAAwwECEQUAAIwDACALAACNAwAgDAAAjgMAIJoBAQC3AgAhpAEAAIoDwwEiqAEgALwCACGqAUAAvgIAIasBQAC-AgAhugEBALcCACG7AQEAtwIAIbwBAQC3AgAhvQEBALcCACG-ARAA6AIAIb8BAgC9AgAhwAEIAIgDACHBAQAAiQMAIMMBAQC3AgAhBRsAAPUDACAcAACEBAAg5wEAAPYDACDoAQAAgwQAIO0BAABMACALGwAAmgMAMBwAAJ4DADDnAQAAmwMAMOgBAACcAwAw6QEAAJ0DACDqAQAA4gIAMOsBAADiAgAw7AEAAOICADDtAQAA4gIAMO4BAACfAwAw7wEAAOUCADALGwAAjwMAMBwAAJMDADDnAQAAkAMAMOgBAACRAwAw6QEAAJIDACDqAQAA1AIAMOsBAADUAgAw7AEAANQCADDtAQAA1AIAMO4BAACUAwAw7wEAANcCADAHBwAAmQMAIJoBAQAAAAGqAUAAAAABqwFAAAAAAcABAgAAAAHIAQEAAAAByQEBAAAAAQIAAAAUACAbAACYAwAgAwAAABQAIBsAAJgDACAcAACWAwAgARQAAIIEADACAAAAFAAgFAAAlgMAIAIAAADYAgAgFAAAlQMAIAaaAQEAtwIAIaoBQAC-AgAhqwFAAL4CACHAAQIAvQIAIcgBAQC3AgAhyQEBALcCACEHBwAAlwMAIJoBAQC3AgAhqgFAAL4CACGrAUAAvgIAIcABAgC9AgAhyAEBALcCACHJAQEAtwIAIQUbAAD9AwAgHAAAgAQAIOcBAAD-AwAg6AEAAP8DACDtAQAAwAEAIAcHAACZAwAgmgEBAAAAAaoBQAAAAAGrAUAAAAABwAECAAAAAcgBAQAAAAHJAQEAAAABAxsAAP0DACDnAQAA_gMAIO0BAADAAQAgCgcAAKQDACAKAAD9AgAgmgEBAAAAAaQBAAAA3wECqgFAAAAAAasBQAAAAAHJAQEAAAAB2wFAAAAAAdwBAgAAAAHdARAAAAABAgAAAAsAIBsAAKMDACADAAAACwAgGwAAowMAIBwAAKEDACABFAAA_AMAMAIAAAALACAUAAChAwAgAgAAAOYCACAUAACgAwAgCJoBAQC3AgAhpAEAAOkC3wEiqgFAAL4CACGrAUAAvgIAIckBAQC3AgAh2wFAAL4CACHcAQIAvQIAId0BEADoAgAhCgcAAKIDACAKAADsAgAgmgEBALcCACGkAQAA6QLfASKqAUAAvgIAIasBQAC-AgAhyQEBALcCACHbAUAAvgIAIdwBAgC9AgAh3QEQAOgCACEFGwAA9wMAIBwAAPoDACDnAQAA-AMAIOgBAAD5AwAg7QEAAMABACAKBwAApAMAIAoAAP0CACCaAQEAAAABpAEAAADfAQKqAUAAAAABqwFAAAAAAckBAQAAAAHbAUAAAAAB3AECAAAAAd0BEAAAAAEDGwAA9wMAIOcBAAD4AwAg7QEAAMABACARBQAApwMAIAsAAKgDACAMAACpAwAgmgEBAAAAAaQBAAAAwwECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAG8AQEAAAABvQEBAAAAAb4BEAAAAAG_AQIAAAABwAEIAAAAAcEBAACmAwAgwwEBAAAAAQHqAQEAAAAEAxsAAPUDACDnAQAA9gMAIO0BAABMACAEGwAAmgMAMOcBAACbAwAw6QEAAJ0DACDtAQAA4gIAMAQbAACPAwAw5wEAAJADADDpAQAAkgMAIO0BAADUAgAwBBsAAP4CADDnAQAA_wIAMOkBAACBAwAg7QEAAIIDADAEGwAA3gIAMOcBAADfAgAw6QEAAOECACDtAQAA4gIAMAQbAADQAgAw5wEAANECADDpAQAA0wIAIO0BAADUAgAwBBsAAMMCADDnAQAAxAIAMOkBAADGAgAg7QEAAMcCADAAAAAAAAAAAAAFGwAA8AMAIBwAAPMDACDnAQAA8QMAIOgBAADyAwAg7QEAAMABACADGwAA8AMAIOcBAADxAwAg7QEAAMABACAAAAAAAAAAAAAABRsAAOsDACAcAADuAwAg5wEAAOwDACDoAQAA7QMAIO0BAAALACADGwAA6wMAIOcBAADsAwAg7QEAAAsAIAAAAAAAAAsbAADMAwAwHAAA0AMAMOcBAADNAwAw6AEAAM4DADDpAQAAzwMAIOoBAACCAwAw6wEAAIIDADDsAQAAggMAMO0BAACCAwAw7gEAANEDADDvAQAAhQMAMBEGAAC4AwAgCwAAqAMAIAwAAKkDACCaAQEAAAABpAEAAADDAQKoASAAAAABqgFAAAAAAasBQAAAAAG6AQEAAAABuwEBAAAAAbwBAQAAAAG9AQEAAAABvgEQAAAAAb8BAgAAAAHAAQgAAAABwQEAAKYDACDEAQEAAAABAgAAAAUAIBsAANQDACADAAAABQAgGwAA1AMAIBwAANMDACABFAAA6gMAMAIAAAAFACAUAADTAwAgAgAAAIYDACAUAADSAwAgDpoBAQC3AgAhpAEAAIoDwwEiqAEgALwCACGqAUAAvgIAIasBQAC-AgAhugEBALcCACG7AQEAtwIAIbwBAQC3AgAhvQEBALcCACG-ARAA6AIAIb8BAgC9AgAhwAEIAIgDACHBAQAAiQMAIMQBAQC3AgAhEQYAALcDACALAACNAwAgDAAAjgMAIJoBAQC3AgAhpAEAAIoDwwEiqAEgALwCACGqAUAAvgIAIasBQAC-AgAhugEBALcCACG7AQEAtwIAIbwBAQC3AgAhvQEBALcCACG-ARAA6AIAIb8BAgC9AgAhwAEIAIgDACHBAQAAiQMAIMQBAQC3AgAhEQYAALgDACALAACoAwAgDAAAqQMAIJoBAQAAAAGkAQAAAMMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAABvAEBAAAAAb0BAQAAAAG-ARAAAAABvwECAAAAAcABCAAAAAHBAQAApgMAIMQBAQAAAAEEGwAAzAMAMOcBAADNAwAw6QEAAM8DACDtAQAAggMAMAAAAAAAAAAABRsAAOUDACAcAADoAwAg5wEAAOYDACDoAQAA5wMAIO0BAADAAQAgAxsAAOUDACDnAQAA5gMAIO0BAADAAQAgCAMAAK4DACALAACvAwAgDAAAsAMAIA0AALEDACCdAQAAsQIAIJ4BAACxAgAgnwEAALECACCgAQAAsQIAIAQFAADkAwAgBgAA4AMAIAsAAK8DACAMAACwAwAgAwcAAOADACAIAADhAwAgCgAA4wMAIAABAwAArgMAIBIDAACqAwAgCwAAqwMAIAwAAKwDACCaAQEAAAABmwEBAAAAAZwBAQAAAAGdAQEAAAABngEBAAAAAZ8BAQAAAAGgAQEAAAABogEAAACiAQKkAQAAAKQBAqYBAAAApgECpwEgAAAAAagBIAAAAAGpAQIAAAABqgFAAAAAAasBQAAAAAECAAAAwAEAIBsAAOUDACADAAAAwwEAIBsAAOUDACAcAADpAwAgFAAAAMMBACADAAC_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_AgAgDAAAwQIAIA0AAMICACCaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGdAQEAuAIAIZ4BAQC4AgAhnwEBALgCACGgAQEAuAIAIaIBAAC5AqIBIqQBAAC6AqQBIqYBAAC7AqYBIqcBIAC8AgAhqAEgALwCACGpAQIAvQIAIaoBQAC-AgAhqwFAAL4CACEImgEBAAAAAaQBAAAA3wECqgFAAAAAAasBQAAAAAHJAQEAAAAB2wFAAAAAAdwBAgAAAAHdARAAAAABEgMAAKoDACALAACrAwAgDQAArQMAIJoBAQAAAAGbAQEAAAABnAEBAAAAAZ0BAQAAAAGeAQEAAAABnwEBAAAAAaABAQAAAAGiAQAAAKIBAqQBAAAApAECpgEAAACmAQKnASAAAAABqAEgAAAAAakBAgAAAAGqAUAAAAABqwFAAAAAAQIAAADAAQAgGwAA_QMAIAMAAADDAQAgGwAA_QMAIBwAAIEEACAUAAAAwwEAIAMAAL8CACALAADAAgAgDQAAwgIAIBQAAIEEACCaAQEAtwIAIZsBAQC3AgAhnAEBALcCACGdAQEAuAIAIZ4BAQC4AgAhnwEBALgCACGgAQEAuAIAIaIBAAC5AqIBIqQBAAC6AqQBIqYBAAC7AqYBIqcBIAC8AgAhqAEgALwCACGpAQIAvQIAIaoBQAC-AgAhqwFAAL4CACESAwAAvwIAIAsAAMACACANAADCAgAgmgEBALcCACGbAQEAtwIAIZwBAQC3AgAhnQEBALgCACGeAQEAuAIAIZ8BAQC4AgAhoAEBALgCACGiAQAAuQKiASKkAQAAugKkASKmAQAAuwKmASKnASAAvAIAIagBIAC8AgAhqQECAL0CACGqAUAAvgIAIasBQAC-AgAhBpoBAQAAAAGqAUAAAAABqwFAAAAAAcABAgAAAAHIAQEAAAAByQEBAAAAAQMAAABPACAbAAD1AwAgHAAAhQQAIAcAAABPACAUAACFBAAgmgEBALcCACGbAQEAtwIAIaoBQAC-AgAhqwFAAL4CACG7AQEAtwIAIQWaAQEAtwIAIZsBAQC3AgAhqgFAAL4CACGrAUAAvgIAIbsBAQC3AgAhDpoBAQAAAAGkAQAAAMMBAqgBIAAAAAGqAUAAAAABqwFAAAAAAboBAQAAAAG7AQEAAAABvAEBAAAAAb0BAQAAAAG-ARAAAAABvwECAAAAAcABCAAAAAHBAQAApgMAIMMBAQAAAAESBQAApwMAIAYAALgDACAMAACpAwAgmgEBAAAAAaQBAAAAwwECqAEgAAAAAaoBQAAAAAGrAUAAAAABugEBAAAAAbsBAQAAAAG8AQEAAAABvQEBAAAAAb4BEAAAAAG_AQIAAAABwAEIAAAAAcEBAACmAwAgwwEBAAAAAcQBAQAAAAECAAAABQAgGwAAhwQAIA-aAQEAAAABpAEAAADRAQKqAUAAAAABqwFAAAAAAcwBAQAAAAHNAQEAAAABzgEQAAAAAc8BAQAAAAHRAQEAAAAB0gEBAAAAAdMBAQAAAAHUAQEAAAAB1QFAAAAAAdYBAQAAAAHXAUAAAAABAwAAAAMAIBsAAIcEACAcAACMBAAgFAAAAAMAIAUAAIwDACAGAAC3AwAgDAAAjgMAIBQAAIwEACCaAQEAtwIAIaQBAACKA8MBIqgBIAC8AgAhqgFAAL4CACGrAUAAvgIAIboBAQC3AgAhuwEBALcCACG8AQEAtwIAIb0BAQC3AgAhvgEQAOgCACG_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_tQEDgAG3AQyBAbgBP4IBuQEDgwG6AQOEAbsBDIUBvgFAhgG_AUaHAcEBAogBwgECiQHFAQKKAcYBAosBxwECjAHJAQKNAcsBDI4BzAFHjwHOAQKQAdABDJEB0QFIkgHSAQKTAdMBApQB1AEMlQHXAUmWAdgBTw"
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
  User: "User"
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
  const from = config_default.email_from || "TripVerse <onboarding@resend.dev>";
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
  await client.emails.send({
    from,
    to: [config_default.contact_receiver_email],
    subject: `New contact message: ${details.subject}`,
    html: emailLayout(content)
  });
};
var sendContactAutoReply = async (details) => {
  const client = getResend();
  if (!client || !details.email) {
    console.warn("[email] Resend not configured; skipping contact auto-reply.");
    return;
  }
  const from = config_default.email_from || "TripVerse <onboarding@resend.dev>";
  const receiverEmail = config_default.contact_receiver_email;
  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">Thanks for reaching out, ${escapeHtml(details.name)}!</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      We&apos;ve received your message about
      <strong>&ldquo;${escapeHtml(details.subject)}&rdquo;</strong> and our support
      team will get back to you within one business day.
    </p>
  `;
  await client.emails.send({
    from,
    to: [details.email],
    replyTo: receiverEmail,
    subject: "We received your message - TripVerse",
    html: emailLayout(content)
  });
};
var sendBookingEmail = async (details) => {
  const client = getResend();
  if (!client || !details.email) {
    console.warn("[email] Resend not configured; skipping booking email.");
    return;
  }
  const from = config_default.email_from || "TripVerse <onboarding@resend.dev>";
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
  await client.emails.send({
    from,
    to: [details.email],
    subject: copy.subject,
    html: emailLayout(content)
  });
};
var sendRefundEmail = async (details) => {
  const client = getResend();
  if (!client || !details.email) {
    console.warn("[email] Resend not configured; skipping refund email.");
    return;
  }
  const from = config_default.email_from || "TripVerse <onboarding@resend.dev>";
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
  await client.emails.send({
    from,
    to: [details.email],
    subject: "Booking cancelled & refund issued - TripVerse",
    html: emailLayout(content)
  });
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
  if (data.status !== "success" || !data.GatewayPageURL) {
    throw new AppError(502, `SSLCommerz init rejected: ${data.failedreason ?? data.status}`);
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
var getBookingsByStatus = async (agentId) => {
  const grouped = await prisma.booking.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: agentId ? { package: { agentId, isDeleted: false } } : void 0
  });
  return grouped.map((g) => ({ status: g.status, count: g._count._all })).sort((a, b) => b.count - a.count);
};
var getRevenueOverTime = async (days, agentId) => {
  const scope = agentId ? `AND b."packageId" IN (
         SELECT p."id"
         FROM "tour_packages" p
         WHERE p."agentId" = $2
           AND p."isDeleted" = false
       )` : "";
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
      ${scope}
    GROUP BY days.d
    ORDER BY days.d ASC
    `,
    days,
    ...agentId ? [agentId] : []
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
    getBookingsByStatus(userId),
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
      revenueOverTime: await getRevenueOverTime(days, userId)
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
    getRevenueOverTime(days, userId)
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
var getUserDashboard = async (userId) => {
  const [totalBookings, totalSpend, upcoming] = await Promise.all([
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
    })
  ]);
  return {
    totalBookings,
    totalSpend: toNumber(totalSpend._sum.totalPrice),
    upcomingCount: upcoming.length,
    upcoming: upcoming.map((b) => ({
      ...b,
      totalPrice: Number(b.totalPrice)
    }))
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
    const result = await dashboardService.getUserDashboard(userId);
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
router10.get("/user", auth_default(Role.USER), dashboardController.getUserDashboard);
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
app.use(notFound_default);
app.use(globalErrorHandler_default);
var app_default = app;

// api/index.ts
var index_default = app_default;
export {
  index_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FwcC50cyIsICIuLi9zcmMvY29uZmlnL2luZGV4LnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL25vdEZvdW5kLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudC50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2ludGVybmFsL2NsYXNzLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXMudHMiLCAiLi4vc3JjL3V0aWxzL2FwcEVycm9yLnRzIiwgIi4uL3NyYy9saWIvcHJpc21hLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguc2VydmljZS50cyIsICIuLi9zcmMvbGliL2dvb2dsZUF1dGgudHMiLCAiLi4vc3JjL3V0aWxzL2p3dC50cyIsICIuLi9zcmMvdXRpbHMvY2F0Y2hBc3luYy50cyIsICIuLi9zcmMvdXRpbHMvc2VuZFJlc3BvbnNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdC50cyIsICIuLi9zcmMvbWlkZGxld2FyZS9hdXRoLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL2xpYi9jbG91ZGluYXJ5LnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jb250YWN0L2NvbnRhY3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvdXRpbHMvZW1haWwudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9saWIvc3NsY29tbWVyei50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcmV2aWV3L3Jldmlldy52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL3NsdWdpZnkudHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2Uuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnZhbGlkYXRpb24udHMiLCAiaW5kZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCBleHByZXNzLCB7IEFwcGxpY2F0aW9uLCBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcclxuaW1wb3J0IGNvcnMgZnJvbSBcImNvcnNcIjtcclxuaW1wb3J0IGNvb2tpZVBhcnNlciBmcm9tIFwiY29va2llLXBhcnNlclwiO1xyXG5pbXBvcnQgaGVsbWV0IGZyb20gXCJoZWxtZXRcIjtcclxuaW1wb3J0IG1vcmdhbiBmcm9tIFwibW9yZ2FuXCI7XHJcbmltcG9ydCByYXRlTGltaXQgZnJvbSBcImV4cHJlc3MtcmF0ZS1saW1pdFwiO1xyXG5pbXBvcnQgY29uZmlnIGZyb20gXCIuL2NvbmZpZ1wiO1xyXG5pbXBvcnQgbm90Rm91bmRIYW5kbGVyIGZyb20gXCIuL21pZGRsZXdhcmUvbm90Rm91bmRcIjtcclxuaW1wb3J0IGdsb2JhbEVycm9ySGFuZGxlciBmcm9tIFwiLi9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlclwiO1xyXG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi9saWIvcHJpc21hXCI7XHJcbmltcG9ydCB7IGF1dGhSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyB1c2VyUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy91c2VyL3VzZXIucm91dGVcIjtcclxuaW1wb3J0IHsgdXBsb2FkUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMucm91dGVcIjtcclxuaW1wb3J0IHsgY29udGFjdFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvY29udGFjdC9jb250YWN0LnJvdXRlXCI7XHJcbmltcG9ydCB7IGJvb2tpbmdSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyByZXZpZXdSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3Jldmlldy9yZXZpZXcucm91dGVcIjtcclxuaW1wb3J0IHsgY2F0ZWdvcnlSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlXCI7XHJcbmltcG9ydCB7IHBhY2thZ2VSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBibG9nUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9ibG9nL2Jsb2cucm91dGVcIjtcclxuaW1wb3J0IHsgZGFzaGJvYXJkUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLnJvdXRlXCI7XHJcbmltcG9ydCB7IHBheW1lbnRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3BheW1lbnQvcGF5bWVudC5yb3V0ZVwiO1xyXG5cclxuY29uc3QgYXBwOiBBcHBsaWNhdGlvbiA9IGV4cHJlc3MoKTtcclxuXHJcbi8vIFJlbmRlci9SYWlsd2F5IHNpdCBiZWhpbmQgYSByZXZlcnNlIHByb3h5IFx1MjAxNCBtdXN0IGJlIHNldCBiZWZvcmUgdGhlXHJcbi8vIHJhdGUgbGltaXRlciBvciBpdCB3aWxsIHNlZSB0aGUgcHJveHkncyBJUCBmb3IgZXZlcnkgcmVxdWVzdCBhbmRcclxuLy8gZWZmZWN0aXZlbHkgcmF0ZS1saW1pdCBhbGwgdXNlcnMgdG9nZXRoZXIuXHJcbmFwcC5zZXQoXCJ0cnVzdCBwcm94eVwiLCAxKTtcclxuXHJcbmFwcC51c2UoaGVsbWV0KCkpO1xyXG5cclxuYXBwLnVzZShcclxuICBjb3JzKHtcclxuICAgIC8vIERldiBob3N0IChsb2NhbGhvc3QpICsgcHJvZCBob3N0IChWZXJjZWwpIGJvdGggYWxsb3dlZCBzaWRlLWJ5LXNpZGUuXHJcbiAgICAvLyBDb25maWcgcmVzb2x2ZXMgc2Vuc2libGUgZGVmYXVsdHMgc28gbmVpdGhlciBjYW4gYmUgZmFsc3kuXHJcbiAgICBvcmlnaW46IFtjb25maWcuZnJvbnRlbmRfdXJsX2RldiwgY29uZmlnLmZyb250ZW5kX3VybF9wcm9kXS5maWx0ZXIoXHJcbiAgICAgIChvKTogbyBpcyBzdHJpbmcgPT4gQm9vbGVhbihvKSxcclxuICAgICksXHJcbiAgICBjcmVkZW50aWFsczogdHJ1ZSxcclxuICB9KSxcclxuKTtcclxuXHJcbmlmIChjb25maWcubm9kZV9lbnYgIT09IFwicHJvZHVjdGlvblwiKSB7XHJcbiAgYXBwLnVzZShtb3JnYW4oXCJkZXZcIikpO1xyXG59XHJcblxyXG5hcHAudXNlKGV4cHJlc3MuanNvbih7IGxpbWl0OiBcIjEwMGtiXCIgfSkpO1xyXG5hcHAudXNlKGV4cHJlc3MudXJsZW5jb2RlZCh7IGV4dGVuZGVkOiB0cnVlLCBsaW1pdDogXCIxMDBrYlwiIH0pKTtcclxuYXBwLnVzZShjb29raWVQYXJzZXIoKSk7XHJcblxyXG4vLyBTdHJpY3QgbGltaXRlciBcdTIwMTQgYXV0aCBlbmRwb2ludHMsIGJydXRlLWZvcmNlIHByb3RlY3Rpb25cclxuY29uc3QgYXV0aExpbWl0ZXIgPSByYXRlTGltaXQoe1xyXG4gIHdpbmRvd01zOiAxNSAqIDYwICogMTAwMCxcclxuICBsaW1pdDogNSxcclxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXHJcbiAgbGVnYWN5SGVhZGVyczogZmFsc2UsXHJcbiAgbWVzc2FnZToge1xyXG4gICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICBtZXNzYWdlOiBcIlRvbyBtYW55IGF0dGVtcHRzLiBQbGVhc2UgdHJ5IGFnYWluIGluIDE1IG1pbnV0ZXMuXCIsXHJcbiAgfSxcclxufSk7XHJcblxyXG4vLyBTdGFuZGFyZCBsaW1pdGVyIFx1MjAxNCBldmVyeXRoaW5nIGVsc2UgdW5kZXIgL2FwaVxyXG5jb25zdCBhcGlMaW1pdGVyID0gcmF0ZUxpbWl0KHtcclxuICB3aW5kb3dNczogMTUgKiA2MCAqIDEwMDAsXHJcbiAgbGltaXQ6IDEwMCxcclxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXHJcbiAgbGVnYWN5SGVhZGVyczogZmFsc2UsXHJcbiAgbWVzc2FnZToge1xyXG4gICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICBtZXNzYWdlOiBcIlRvbyBtYW55IHJlcXVlc3RzLiBQbGVhc2UgdHJ5IGFnYWluIGxhdGVyLlwiLFxyXG4gIH0sXHJcbn0pO1xyXG5cclxuYXBwLnVzZShcIi9hcGkvYXV0aC9sb2dpblwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvcmVnaXN0ZXJcIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL2RlbW8tbG9naW5cIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL2dvb2dsZVwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpXCIsIGFwaUxpbWl0ZXIpO1xyXG5cclxuLy8gUm9vdCByb3V0ZVxyXG5hcHAuZ2V0KFwiL1wiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgcmVzLnNlbmQoXCJXZWxjb21lIHRvIHRoZSBUcmlwVmVyc2UgQVBJIVwiKTtcclxufSk7XHJcblxyXG4vLyBIZWFsdGggY2hlY2sgXHUyMDE0IHJlYWwgREIgY29ubmVjdGl2aXR5IGNoZWNrLCBub3QgYSBzdGF0aWMgMjAwLlxyXG5hcHAuZ2V0KFwiL2hlYWx0aFwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUIDFgO1xyXG4gICAgcmVzLnN0YXR1cygyMDApLmpzb24oe1xyXG4gICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICBtZXNzYWdlOiBcIk9LXCIsXHJcbiAgICAgIGRiOiBcImNvbm5lY3RlZFwiLFxyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgIH0pO1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICByZXMuc3RhdHVzKDUwMykuanNvbih7XHJcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICBtZXNzYWdlOiBcIlNlcnZpY2UgdW5hdmFpbGFibGVcIixcclxuICAgICAgZGI6IFwiZGlzY29ubmVjdGVkXCIsXHJcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59KTtcclxuXHJcbi8vIFx1MjUwMFx1MjUwMCBGZWF0dXJlIHJvdXRlcyByZWdpc3RlciBoZXJlIGFzIGVhY2ggbW9kdWxlIGlzIGJ1aWx0IFx1MjUwMFx1MjUwMFxyXG5hcHAudXNlKFwiL2FwaS9hdXRoXCIsIGF1dGhSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS91c2Vyc1wiLCB1c2VyUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvdXBsb2Fkc1wiLCB1cGxvYWRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jb250YWN0XCIsIGNvbnRhY3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jYXRlZ29yaWVzXCIsIGNhdGVnb3J5Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvcGFja2FnZXNcIiwgcGFja2FnZVJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3Jldmlld3NcIiwgcmV2aWV3Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvYm9va2luZ3NcIiwgYm9va2luZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Jsb2dcIiwgYmxvZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Rhc2hib2FyZFwiLCBkYXNoYm9hcmRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9wYXltZW50c1wiLCBwYXltZW50Um91dGVzKTtcclxuXHJcbmFwcC51c2Uobm90Rm91bmRIYW5kbGVyKTtcclxuYXBwLnVzZShnbG9iYWxFcnJvckhhbmRsZXIpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgYXBwO1xyXG4iLCAiaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuZG90ZW52LmNvbmZpZyh7XG4gIHF1aWV0OiB0cnVlLFxuICBwYXRoOiBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgXCIuZW52XCIpLFxufSk7XG5cbi8vIEV2ZXJ5IG1vZHVsZSByZWFkcyBjb25maWcgdGhyb3VnaCB0aGlzIHZhbGlkYXRlZCBvYmplY3QsIG5ldmVyXG4vLyBwcm9jZXNzLmVudiBkaXJlY3RseSBcdTIwMTQgYSBtaXNzaW5nL21hbGZvcm1lZCB2YXIgZmFpbHMgbG91ZGx5IGF0IGJvb3Rcbi8vIGluc3RlYWQgb2Ygc3VyZmFjaW5nIGFzIGEgY29uZnVzaW5nIHJ1bnRpbWUgZXJyb3IgbWlkLXJlcXVlc3QuXG5jb25zdCBlbnZTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIFBPUlQ6IHouc3RyaW5nKCkuZGVmYXVsdChcIjQwMDBcIiksXG4gIE5PREVfRU5WOiB6LmVudW0oW1wiZGV2ZWxvcG1lbnRcIiwgXCJwcm9kdWN0aW9uXCJdKS5kZWZhdWx0KFwiZGV2ZWxvcG1lbnRcIiksXG5cbiAgLy8gRnJvbnRlbmQgb3JpZ2lucyBmb3IgQ09SUyArIHBheW1lbnQgcmVkaXJlY3RzLiBUaGUgZnJvbnRlbmQgbWF5IG5vdCBiZVxuICAvLyBkZXBsb3llZCB5ZXQgKG9yIG1heSBiZSByZWJ1aWx0KSwgc28gYm90aCBhcmUgb3B0aW9uYWw6IHRoZSBiYWNrZW5kIG11c3RcbiAgLy8gbmV2ZXIgcmVmdXNlIHRvIGJvb3QganVzdCBiZWNhdXNlIGEgVUkgaG9zdCBpc24ndCBsaXZlLiBSb3V0ZXMgdGhhdCBuZWVkIGFcbiAgLy8gcmVhbCBvcmlnaW4gKHBheW1lbnQgY2FsbGJhY2sgcmVkaXJlY3RzKSBmYWxsIGJhY2sgdG8gdGhlIGJhY2tlbmQgVVJMLlxuICBGUk9OVEVORF9VUkxfREVWOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG4gIEZST05URU5EX1VSTF9QUk9EOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG5cbiAgREFUQUJBU0VfVVJMOiB6LnN0cmluZygpLm1pbigxLCBcIkRBVEFCQVNFX1VSTCBpcyByZXF1aXJlZFwiKSxcblxuICBCQ1JZUFRfU0FMVF9ST1VORFM6IHouc3RyaW5nKCkuZGVmYXVsdChcIjEwXCIpLFxuXG4gIC8vIE9wdGlvbmFsIGFkbWluIGNyZWRlbnRpYWxzIHVzZWQgYnkgdGhlIHNlZWQgc2NyaXB0IChTdGVwIDEzKS4gRmFsbHMgYmFja1xuICAvLyB0byBkZW1vLWFkbWluQHRyaXB2ZXJzZS5jb20gLyBkZW1vMTIzIHdoZW4gdW5zZXQuXG4gIEFETUlOX0VNQUlMOiB6LnN0cmluZygpLmVtYWlsKCkub3B0aW9uYWwoKSxcbiAgQURNSU5fUEFTU1dPUkQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG5cbiAgLy8gU1NMQ29tbWVyeiAoU3RlcCAxNikgXHUyMDE0IHNhbmRib3ggc3RvcmUgY3JlZHMgdW50aWwgZ28tbGl2ZS4gU1NMX0NPTU1FUlpfU0FOREJPWFxuICAvLyBwaWNrcyB0aGUgc2FuZGJveCB2cyBsaXZlIEFQSSBiYXNlIFVSTC4gT3B0aW9uYWwgc28gdGhlIEFQSSBib290cyAoaGVhbHRoLFxuICAvLyBhdXRoLCBjYXRhbG9nLCBldGMuKSBldmVuIHdoZW4gdGhlIHBheW1lbnQgc3RvcmUgaXNuJ3QgY29uZmlndXJlZCB5ZXQgXHUyMDE0IHRoZVxuICAvLyBwYXltZW50IGVuZHBvaW50cyB0aGVuIGZhaWwgd2l0aCBhIGNsZWFuIFwibm90IGNvbmZpZ3VyZWRcIiBlcnJvciBpbnN0ZWFkIG9mXG4gIC8vIHRha2luZyB0aGUgd2hvbGUgZGVwbG95bWVudCBkb3duLlxuICBTU0xfQ09NTUVSWl9TVE9SRV9JRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTU0xfQ09NTUVSWl9TVE9SRV9QQVNTV09SRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTU0xfQ09NTUVSWl9TQU5EQk9YOiB6LnN0cmluZygpLmRlZmF1bHQoXCJ0cnVlXCIpLFxuICAvLyBPcHRpb25hbCBleHBsaWNpdCBnYXRld2F5L3ZhbGlkYXRvciBiYXNlIFVSTHMgKEdlYXJVcCBwYXR0ZXJuKS4gRGVmYXVsdHMgYXJlXG4gIC8vIGRlcml2ZWQgZnJvbSBTU0xfQ09NTUVSWl9TQU5EQk9YIHdoZW4gYWJzZW50LlxuICBTU0xDT01NRVJaX0lOSVRfVVJMOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG4gIFNTTENPTU1FUlpfVkFMSURBVEVfVVJMOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG4gIFNTTENPTU1FUlpfUkVGVU5EX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuXG4gIC8vIFB1YmxpY2x5IHJlYWNoYWJsZSBiYXNlIFVSTCB0aGUgcGF5bWVudCBtb2R1bGUgdXNlcyB0byBidWlsZCB0aGVcbiAgLy8gU1NMQ29tbWVyeiBzdWNjZXNzL2ZhaWwvY2FuY2VsL0lQTiBjYWxsYmFjayBVUkxzLiBNdXN0IE5PVCBiZSBsb2NhbGhvc3QgaW5cbiAgLy8gc2FuZGJveCBcdTIwMTQgdGhlIGdhdGV3YXkgUE9TVHMgdG8gdGhlc2Ugc2VydmVyLXRvLXNlcnZlci4gT3B0aW9uYWwgbGlrZSB0aGVcbiAgLy8gc3RvcmUgY3JlZHMgYWJvdmUgKHBheW1lbnQtb25seSkuXG4gIEJBQ0tFTkRfUFVCTElDX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuXG4gIEpXVF9BQ0NFU1NfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkpXVF9BQ0NFU1NfU0VDUkVUIGlzIHJlcXVpcmVkXCIpLFxuICBKV1RfUkVGUkVTSF9TRUNSRVQ6IHouc3RyaW5nKCkubWluKDEsIFwiSldUX1JFRlJFU0hfU0VDUkVUIGlzIHJlcXVpcmVkXCIpLFxuICBKV1RfQUNDRVNTX0VYUElSRVNfSU46IHouc3RyaW5nKCkuZGVmYXVsdChcIjFkXCIpLFxuICBKV1RfUkVGUkVTSF9FWFBJUkVTX0lOOiB6LnN0cmluZygpLmRlZmF1bHQoXCIzMGRcIiksXG5cbiAgLy8gR29vZ2xlIE9BdXRoIGlzIG9wdGlvbmFsIFx1MjAxNCBzZXJ2ZXIgYm9vdHMgd2l0aG91dCBpdDsgL2FwaS9hdXRoL2dvb2dsZVxuICAvLyByZXR1cm5zIGEgY2xlYW4gNDAwIHVudGlsIEdPT0dMRV9DTElFTlRfSUQgaXMgY29uZmlndXJlZC5cbiAgR09PR0xFX0NMSUVOVF9JRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIC8vIEJlc3QtZWZmb3J0IGNvbnRhY3QgZW1haWxzIChSZXNlbmQpIFx1MjAxNCBhbHdheXMgb3B0aW9uYWw7IHN1Ym1pc3Npb25zXG4gIC8vIHN1Y2NlZWQgYW5kIGVtYWlscyBiZWNvbWUgbm8tb3BzIHdoZW4gdGhlc2UgYXJlIG1pc3NpbmcuXG4gIFJFU0VORF9BUElfS0VZOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIENPTlRBQ1RfUkVDRUlWRVJfRU1BSUw6IHouc3RyaW5nKCkuZW1haWwoKS5vcHRpb25hbCgpLFxuICBFTUFJTF9GUk9NOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG5cbiAgQ0xPVURJTkFSWV9DTE9VRF9OQU1FOiB6LnN0cmluZygpLm1pbigxLCBcIkNMT1VESU5BUllfQ0xPVURfTkFNRSBpcyByZXF1aXJlZFwiKSxcbiAgQ0xPVURJTkFSWV9BUElfS0VZOiB6LnN0cmluZygpLm1pbigxLCBcIkNMT1VESU5BUllfQVBJX0tFWSBpcyByZXF1aXJlZFwiKSxcbiAgQ0xPVURJTkFSWV9BUElfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkNMT1VESU5BUllfQVBJX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbn0pO1xuXG5jb25zdCBwYXJzZWQgPSBlbnZTY2hlbWEuc2FmZVBhcnNlKHByb2Nlc3MuZW52KTtcblxuaWYgKCFwYXJzZWQuc3VjY2Vzcykge1xuICBjb25zb2xlLmVycm9yKFwiXHUyNzRDIEludmFsaWQgZW52aXJvbm1lbnQgdmFyaWFibGVzOlwiKTtcbiAgY29uc29sZS5lcnJvcihwYXJzZWQuZXJyb3IuZmxhdHRlbigpLmZpZWxkRXJyb3JzKTtcbiAgcHJvY2Vzcy5leGl0KDEpO1xufVxuXG5jb25zdCBlbnYgPSBwYXJzZWQuZGF0YTtcblxuY29uc3QgY29uZmlnID0ge1xuICBwb3J0OiBlbnYuUE9SVCxcbiAgbm9kZV9lbnY6IGVudi5OT0RFX0VOVixcblxuICAvLyBGcm9udGVuZCBvcmlnaW5zIGZvciBDT1JTICsgcGF5bWVudCByZWRpcmVjdHMuIExvY2FsaG9zdCBhbHdheXMgd2lucyBmb3JcbiAgLy8gbG9jYWwgdGVzdGluZzsgcHJvZHVjdGlvbiB1c2VzIHRoZSBWZXJjZWwgZnJvbnRlbmQgVVJMLCBmYWxsaW5nIGJhY2sgdG8gdGhlXG4gIC8vIGJhY2tlbmQgVVJMIHNvIHRoZSBBUEkgc3RheXMgcmVhY2hhYmxlIGV2ZW4gYmVmb3JlIHRoZSBVSSBpcyBkZXBsb3llZC5cbiAgZnJvbnRlbmRfdXJsX2RldjogZW52LkZST05URU5EX1VSTF9ERVYgfHwgXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgZnJvbnRlbmRfdXJsX3Byb2Q6XG4gICAgZW52LkZST05URU5EX1VSTF9QUk9EIHx8IGVudi5CQUNLRU5EX1BVQkxJQ19VUkwgfHwgXCJcIixcblxuICBkYXRhYmFzZV91cmw6IGVudi5EQVRBQkFTRV9VUkwsXG5cbiAgYmNyeXB0X3NhbHRfcm91bmRzOiBlbnYuQkNSWVBUX1NBTFRfUk9VTkRTLFxuXG4gIGFkbWluX2VtYWlsOiBlbnYuQURNSU5fRU1BSUwsXG4gIGFkbWluX3Bhc3N3b3JkOiBlbnYuQURNSU5fUEFTU1dPUkQsXG5cbiAgc3NsX2NvbW1lcnpfc3RvcmVfaWQ6IGVudi5TU0xfQ09NTUVSWl9TVE9SRV9JRCxcbiAgc3NsX2NvbW1lcnpfc3RvcmVfcGFzc3dvcmQ6IGVudi5TU0xfQ09NTUVSWl9TVE9SRV9QQVNTV09SRCxcbiAgc3NsX2NvbW1lcnpfc2FuZGJveDogZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiLFxuICAvLyBzYW5kYm94IGJhc2UgVVJMcyAoZmFsbGJhY2sgd2hlbiB0aGUgZXhwbGljaXQgb3ZlcnJpZGUgdmFycyBhcmUgYWJzZW50KVxuICBzc2xjb21tZXJ6X2luaXRfdXJsOlxuICAgIGVudi5TU0xDT01NRVJaX0lOSVRfVVJMID8/XG4gICAgKGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIlxuICAgICAgPyBcImh0dHBzOi8vc2FuZGJveC5zc2xjb21tZXJ6LmNvbS9nd3Byb2Nlc3MvdjQvYXBpLnBocFwiXG4gICAgICA6IFwiaHR0cHM6Ly9zZWN1cmVwYXkuc3NsY29tbWVyei5jb20vZ3dwcm9jZXNzL3Y0L2FwaS5waHBcIiksXG4gIHNzbGNvbW1lcnpfdmFsaWRhdGVfdXJsOlxuICAgIGVudi5TU0xDT01NRVJaX1ZBTElEQVRFX1VSTCA/P1xuICAgIChlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCJcbiAgICAgID8gXCJodHRwczovL3NhbmRib3guc3NsY29tbWVyei5jb20vdmFsaWRhdG9yL2FwaS92YWxpZGF0aW9uc2VydmVyQVBJLnBocFwiXG4gICAgICA6IFwiaHR0cHM6Ly9zZWN1cmVwYXkuc3NsY29tbWVyei5jb20vdmFsaWRhdG9yL2FwaS92YWxpZGF0aW9uc2VydmVyQVBJLnBocFwiKSxcbiAgc3NsY29tbWVyel9yZWZ1bmRfdXJsOlxuICAgIGVudi5TU0xDT01NRVJaX1JFRlVORF9VUkwgPz9cbiAgICAoZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiXG4gICAgICA/IFwiaHR0cHM6Ly9zYW5kYm94LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvbWVyY2hhbnRUcmFuc0lEdmFsaWRhdGlvbkFQSS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvbWVyY2hhbnRUcmFuc0lEdmFsaWRhdGlvbkFQSS5waHBcIiksXG4gIGJhY2tlbmRfcHVibGljX3VybDogZW52LkJBQ0tFTkRfUFVCTElDX1VSTCxcblxuICBqd3RfYWNjZXNzX3NlY3JldDogZW52LkpXVF9BQ0NFU1NfU0VDUkVULFxuICBqd3RfcmVmcmVzaF9zZWNyZXQ6IGVudi5KV1RfUkVGUkVTSF9TRUNSRVQsXG4gIGp3dF9hY2Nlc3NfZXhwaXJlc19pbjogZW52LkpXVF9BQ0NFU1NfRVhQSVJFU19JTixcbiAgand0X3JlZnJlc2hfZXhwaXJlc19pbjogZW52LkpXVF9SRUZSRVNIX0VYUElSRVNfSU4sXG5cbiAgZ29vZ2xlX2NsaWVudF9pZDogZW52LkdPT0dMRV9DTElFTlRfSUQsXG5cbiAgcmVzZW5kX2FwaV9rZXk6IGVudi5SRVNFTkRfQVBJX0tFWSxcbiAgY29udGFjdF9yZWNlaXZlcl9lbWFpbDogZW52LkNPTlRBQ1RfUkVDRUlWRVJfRU1BSUwsXG4gIGVtYWlsX2Zyb206IGVudi5FTUFJTF9GUk9NLFxuXG4gIGNsb3VkaW5hcnlfY2xvdWRfbmFtZTogZW52LkNMT1VESU5BUllfQ0xPVURfTkFNRSxcbiAgY2xvdWRpbmFyeV9hcGlfa2V5OiBlbnYuQ0xPVURJTkFSWV9BUElfS0VZLFxuICBjbG91ZGluYXJ5X2FwaV9zZWNyZXQ6IGVudi5DTE9VRElOQVJZX0FQSV9TRUNSRVQsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjb25maWc7XG4iLCAiaW1wb3J0IHsgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5jb25zdCBub3RGb3VuZEhhbmRsZXIgPSAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHJlcy5zdGF0dXMoNDA0KS5qc29uKHtcbiAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICBzdGF0dXNDb2RlOiA0MDQsXG4gICAgbWVzc2FnZTogXCJSb3V0ZSBub3QgZm91bmRcIixcbiAgICBwYXRoOiByZXEub3JpZ2luYWxVcmwsXG4gICAgZGF0ZTogbmV3IERhdGUoKSxcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBub3RGb3VuZEhhbmRsZXI7XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCBtdWx0ZXIgZnJvbSBcIm11bHRlclwiO1xuaW1wb3J0IHsgWm9kRXJyb3IgfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuY29uc3QgZ2xvYmFsRXJyb3JIYW5kbGVyID0gKFxuICBlcnI6IGFueSxcbiAgcmVxOiBSZXF1ZXN0LFxuICByZXM6IFJlc3BvbnNlLFxuICBuZXh0OiBOZXh0RnVuY3Rpb24sXG4pID0+IHtcbiAgaWYgKGNvbmZpZy5ub2RlX2VudiAhPT0gXCJwcm9kdWN0aW9uXCIpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3I6XCIsIGVycik7XG4gIH1cblxuICAvLyBkZWZhdWx0IGZhbGxiYWNrXG4gIGxldCBzdGF0dXNDb2RlOiBudW1iZXIgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgbGV0IGVycm9yTWVzc2FnZTogc3RyaW5nID0gZXJyPy5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCI7XG4gIGxldCBlcnJvck5hbWU6IHN0cmluZyA9IGVycj8ubmFtZSB8fCBcIkVycm9yXCI7XG5cbiAgLy8gWm9kIHZhbGlkYXRpb24gZXJyb3JcbiAgaWYgKGVyciBpbnN0YW5jZW9mIFpvZEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLmlzc3Vlcy5tYXAoKGkpID0+IGkubWVzc2FnZSkuam9pbihcIiwgXCIpO1xuICAgIGVycm9yTmFtZSA9IFwiWm9kRXJyb3JcIjtcbiAgfVxuXG4gIC8vIE11bHRlciBmaWxlIHVwbG9hZCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBtdWx0ZXIuTXVsdGVyRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5CQURfUkVRVUVTVDtcbiAgICBlcnJvck5hbWUgPSBcIk11bHRlckVycm9yXCI7XG4gICAgZXJyb3JNZXNzYWdlID1cbiAgICAgIGVyci5jb2RlID09PSBcIkxJTUlUX0ZJTEVfU0laRVwiXG4gICAgICAgID8gXCJGaWxlIHRvbyBsYXJnZS4gTWF4aW11bSBzaXplIGlzIDVNQi5cIlxuICAgICAgICA6IGBVcGxvYWQgZmFpbGVkOiAke2Vyci5jb2RlfWA7XG4gIH1cblxuICAvLyBDdXN0b20gZmlsZSB0eXBlIHJlamVjdGlvbiBmcm9tIHRoZSBtdWx0ZXIgZmlsZUZpbHRlclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvciAmJiAoZXJyIGFzIGFueSkuY29kZSA9PT0gXCJJTlZBTElEX0ZJTEVfVFlQRVwiKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gIH1cblxuICAvLyBQcmlzbWEgdmFsaWRhdGlvbiBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID1cbiAgICAgIFwiWW91IGhhdmUgcHJvdmlkZWQgaW5jb3JyZWN0IGZpZWxkIHR5cGUgb3IgbWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIjtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclwiO1xuICB9XG5cbiAgLy8gUHJpc21hIGtub3duIGVycm9yc1xuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IpIHtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yXCI7XG5cbiAgICBpZiAoZXJyLmNvZGUgPT09IFwiUDIwMDJcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQ09ORkxJQ1Q7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBcIlRoaXMgdmFsdWUgYWxyZWFkeSBleGlzdHNcIjtcbiAgICB9IGVsc2UgaWYgKGVyci5jb2RlID09PSBcIlAyMDAzXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkNPTkZMSUNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJGb3JlaWduIGtleSBjb25zdHJhaW50IGZhaWxlZFwiO1xuICAgIH0gZWxzZSBpZiAoZXJyLmNvZGUgPT09IFwiUDIwMjVcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuTk9UX0ZPVU5EO1xuICAgICAgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgXCJBbiBvcGVyYXRpb24gZmFpbGVkIGJlY2F1c2Ugb25lIG9yIG1vcmUgcmVxdWlyZWQgcmVjb3JkcyB3ZXJlIG5vdCBmb3VuZC5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICB9XG4gIH1cblxuICAvLyBQcmlzbWEgREIgY29ubmVjdGlvbi9pbml0IGVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIFByaXNtYS5QcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yKSB7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yXCI7XG5cbiAgICBpZiAoZXJyLmVycm9yQ29kZSA9PT0gXCJQMTAwMFwiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5VTkFVVEhPUklaRUQ7XG4gICAgICBlcnJvck1lc3NhZ2UgPVxuICAgICAgICBcIkF1dGhlbnRpY2F0aW9uIGZhaWxlZCBhZ2FpbnN0IHRoZSBkYXRhYmFzZSBzZXJ2ZXIuIFBsZWFzZSBjaGVjayB5b3VyIGRhdGFiYXNlIGNyZWRlbnRpYWxzLlwiO1xuICAgIH0gZWxzZSBpZiAoZXJyLmVycm9yQ29kZSA9PT0gXCJQMTAwMVwiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5TRVJWSUNFX1VOQVZBSUxBQkxFO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJDYW4ndCByZWFjaCB0aGUgZGF0YWJhc2Ugc2VydmVyLlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICB9XG4gIH1cblxuICAvLyBQcmlzbWEgdW5rbm93biByZXF1ZXN0IGVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIFByaXNtYS5QcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclwiO1xuICAgIGVycm9yTWVzc2FnZSA9IFwiRXJyb3Igb2NjdXJyZWQgZHVyaW5nIHF1ZXJ5IGV4ZWN1dGlvblwiO1xuICB9XG5cbiAgLy8gWW91ciBjdXN0b20gQXBwRXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgQXBwRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gZXJyLnN0YXR1c0NvZGU7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgZXJyb3JOYW1lID0gZXJyLm5hbWUgfHwgXCJBcHBFcnJvclwiO1xuICB9XG5cbiAgLy8gRmFsbGJhY2sgZm9yIG90aGVyIHRocm93biBlcnJvcnNcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2UgfHwgXCJJbnRlcm5hbCBTZXJ2ZXIgRXJyb3JcIjtcbiAgICBlcnJvck5hbWUgPSBlcnIubmFtZSB8fCBcIkVycm9yXCI7XG4gIH1cblxuICByZXMuc3RhdHVzKHN0YXR1c0NvZGUpLmpzb24oe1xuICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgIHN0YXR1c0NvZGUsXG4gICAgbmFtZTogZXJyb3JOYW1lLFxuICAgIG1lc3NhZ2U6IGVycm9yTWVzc2FnZSxcbiAgICBlcnJvcjogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwiZGV2ZWxvcG1lbnRcIiA/IGVyci5zdGFjayA6IHVuZGVmaW5lZCxcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBnbG9iYWxFcnJvckhhbmRsZXI7XG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4gKiBUaGlzIGZpbGUgc2hvdWxkIGJlIHlvdXIgbWFpbiBpbXBvcnQgdG8gdXNlIFByaXNtYS4gVGhyb3VnaCBpdCB5b3UgZ2V0IGFjY2VzcyB0byBhbGwgdGhlIG1vZGVscywgZW51bXMsIGFuZCBpbnB1dCB0eXBlcy5cbiAqIElmIHlvdSdyZSBsb29raW5nIGZvciBzb21ldGhpbmcgeW91IGNhbiBpbXBvcnQgaW4gdGhlIGNsaWVudC1zaWRlIG9mIHlvdXIgYXBwbGljYXRpb24sIHBsZWFzZSByZWZlciB0byB0aGUgYGJyb3dzZXIudHNgIGZpbGUgaW5zdGVhZC5cbiAqXG4gKiBcdUQ4M0RcdURGRTIgWW91IGNhbiBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5LlxuICovXG5cbmltcG9ydCAqIGFzIHByb2Nlc3MgZnJvbSAnbm9kZTpwcm9jZXNzJ1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAnbm9kZTp1cmwnXG5nbG9iYWxUaGlzWydfX2Rpcm5hbWUnXSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpXG5cbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSBcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvY2xpZW50XCJcbmltcG9ydCAqIGFzICRFbnVtcyBmcm9tIFwiLi9lbnVtc1wiXG5pbXBvcnQgKiBhcyAkQ2xhc3MgZnJvbSBcIi4vaW50ZXJuYWwvY2xhc3NcIlxuaW1wb3J0ICogYXMgUHJpc21hIGZyb20gXCIuL2ludGVybmFsL3ByaXNtYU5hbWVzcGFjZVwiXG5cbmV4cG9ydCAqIGFzICRFbnVtcyBmcm9tICcuL2VudW1zJ1xuZXhwb3J0ICogZnJvbSBcIi4vZW51bXNcIlxuLyoqXG4gKiAjIyBQcmlzbWEgQ2xpZW50XG4gKiBcbiAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICogICBhZGFwdGVyOiBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAqIH0pXG4gKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ1Bvc3RzXG4gKiBjb25zdCBibG9nUG9zdHMgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoKVxuICogYGBgXG4gKiBcbiAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2NsaWVudCkuXG4gKi9cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnQgPSAkQ2xhc3MuZ2V0UHJpc21hQ2xpZW50Q2xhc3MoKVxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50PExvZ09wdHMgZXh0ZW5kcyBQcmlzbWEuTG9nTGV2ZWwgPSBuZXZlciwgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1tcIm9taXRcIl0gPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1tcIm9taXRcIl0sIEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzPiA9ICRDbGFzcy5QcmlzbWFDbGllbnQ8TG9nT3B0cywgT21pdE9wdHMsIEV4dEFyZ3M+XG5leHBvcnQgeyBQcmlzbWEgfVxuXG4vKipcbiAqIE1vZGVsIEJsb2dQb3N0XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQmxvZ1Bvc3QgPSBQcmlzbWEuQmxvZ1Bvc3RNb2RlbFxuLyoqXG4gKiBNb2RlbCBCb29raW5nXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQm9va2luZyA9IFByaXNtYS5Cb29raW5nTW9kZWxcbi8qKlxuICogTW9kZWwgQ2F0ZWdvcnlcbiAqIFxuICovXG5leHBvcnQgdHlwZSBDYXRlZ29yeSA9IFByaXNtYS5DYXRlZ29yeU1vZGVsXG4vKipcbiAqIE1vZGVsIENvbnRhY3RNZXNzYWdlXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQ29udGFjdE1lc3NhZ2UgPSBQcmlzbWEuQ29udGFjdE1lc3NhZ2VNb2RlbFxuLyoqXG4gKiBNb2RlbCBQYXltZW50XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUGF5bWVudCA9IFByaXNtYS5QYXltZW50TW9kZWxcbi8qKlxuICogTW9kZWwgUmV2aWV3XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUmV2aWV3ID0gUHJpc21hLlJldmlld01vZGVsXG4vKipcbiAqIE1vZGVsIFRvdXJQYWNrYWdlXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgVG91clBhY2thZ2UgPSBQcmlzbWEuVG91clBhY2thZ2VNb2RlbFxuLyoqXG4gKiBNb2RlbCBVc2VyXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgVXNlciA9IFByaXNtYS5Vc2VyTW9kZWxcbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiAqIFdBUk5JTkc6IFRoaXMgaXMgYW4gaW50ZXJuYWwgZmlsZSB0aGF0IGlzIHN1YmplY3QgdG8gY2hhbmdlIVxuICpcbiAqIFx1RDgzRFx1REVEMSBVbmRlciBubyBjaXJjdW1zdGFuY2VzIHNob3VsZCB5b3UgaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseSEgXHVEODNEXHVERUQxXG4gKlxuICogUGxlYXNlIGltcG9ydCB0aGUgYFByaXNtYUNsaWVudGAgY2xhc3MgZnJvbSB0aGUgYGNsaWVudC50c2AgZmlsZSBpbnN0ZWFkLlxuICovXG5cbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSBcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvY2xpZW50XCJcbmltcG9ydCB0eXBlICogYXMgUHJpc21hIGZyb20gXCIuL3ByaXNtYU5hbWVzcGFjZVwiXG5cblxuY29uc3QgY29uZmlnOiBydW50aW1lLkdldFByaXNtYUNsaWVudENvbmZpZyA9IHtcbiAgXCJwcmV2aWV3RmVhdHVyZXNcIjogW10sXG4gIFwiY2xpZW50VmVyc2lvblwiOiBcIjcuOS4xXCIsXG4gIFwiZW5naW5lVmVyc2lvblwiOiBcImU5MjIwODliN2Q3NTAyYWZmNDI0OWQ1ZGEzNDIwZjZmYTU1ZmM2YWRcIixcbiAgXCJhY3RpdmVQcm92aWRlclwiOiBcInBvc3RncmVzcWxcIixcbiAgXCJpbmxpbmVTY2hlbWFcIjogXCJtb2RlbCBCbG9nUG9zdCB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRpdGxlICAgICAgU3RyaW5nXFxuICBzbHVnICAgICAgIFN0cmluZyAgICAgQHVuaXF1ZVxcbiAgZXhjZXJwdCAgICBTdHJpbmdcXG4gIGNvbnRlbnQgICAgU3RyaW5nXFxuICBjb3ZlckltYWdlIFN0cmluZ1xcbiAgc3RhdHVzICAgICBQb3N0U3RhdHVzIEBkZWZhdWx0KERSQUZUKVxcbiAgaXNEZWxldGVkICBCb29sZWFuICAgIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgYXV0aG9ySWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgYXV0aG9yIFVzZXIgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIsIGZpZWxkczogW2F1dGhvcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQGluZGV4KFthdXRob3JJZF0pXFxuICBAQG1hcChcXFwiYmxvZ19wb3N0c1xcXCIpXFxufVxcblxcbm1vZGVsIEJvb2tpbmcge1xcbiAgaWQgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0cmF2ZWxEYXRlIERhdGVUaW1lXFxuICB0cmF2ZWxlcnMgIEludFxcbiAgdG90YWxQcmljZSBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKVxcbiAgc3RhdHVzICAgICBCb29raW5nU3RhdHVzIEBkZWZhdWx0KFBFTkRJTkcpXFxuXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgdXNlciAgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lckJvb2tpbmdzXFxcIiwgZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIHBhY2thZ2UgIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGF5bWVudHMgUGF5bWVudFtdXFxuXFxuICBAQGluZGV4KFt1c2VySWRdKVxcbiAgQEBpbmRleChbcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQGluZGV4KFt1c2VySWQsIHBhY2thZ2VJZCwgdHJhdmVsRGF0ZV0pXFxuICBAQG1hcChcXFwiYm9va2luZ3NcXFwiKVxcbn1cXG5cXG5tb2RlbCBDYXRlZ29yeSB7XFxuICBpZCAgIFN0cmluZyBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgbmFtZSBTdHJpbmcgQHVuaXF1ZVxcbiAgc2x1ZyBTdHJpbmcgQHVuaXF1ZVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBhY2thZ2VzIFRvdXJQYWNrYWdlW11cXG5cXG4gIEBAbWFwKFxcXCJjYXRlZ29yaWVzXFxcIilcXG59XFxuXFxubW9kZWwgQ29udGFjdE1lc3NhZ2Uge1xcbiAgaWQgICAgICAgICBTdHJpbmcgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lICAgICAgIFN0cmluZ1xcbiAgZW1haWwgICAgICBTdHJpbmdcXG4gIHN1YmplY3QgICAgU3RyaW5nXFxuICBtZXNzYWdlICAgIFN0cmluZ1xcbiAgaXNSZXNvbHZlZCBCb29sZWFuIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIEBAaW5kZXgoW2lzUmVzb2x2ZWRdKVxcbiAgQEBtYXAoXFxcImNvbnRhY3RfbWVzc2FnZXNcXFwiKVxcbn1cXG5cXG5lbnVtIFJvbGUge1xcbiAgVVNFUlxcbiAgQUdFTlRcXG4gIEFETUlOXFxufVxcblxcbmVudW0gVXNlclN0YXR1cyB7XFxuICBBQ1RJVkVcXG4gIFNVU1BFTkRFRFxcbn1cXG5cXG5lbnVtIEF1dGhQcm92aWRlciB7XFxuICBDUkVERU5USUFMXFxuICBHT09HTEVcXG59XFxuXFxuZW51bSBQYWNrYWdlU3RhdHVzIHtcXG4gIFBFTkRJTkdcXG4gIEFQUFJPVkVEXFxuICBSRUpFQ1RFRFxcbn1cXG5cXG5lbnVtIEJvb2tpbmdTdGF0dXMge1xcbiAgUEVORElOR1xcbiAgUEFJRFxcbiAgQ09ORklSTUVEXFxuICBDQU5DRUxMRURcXG4gIENPTVBMRVRFRFxcbn1cXG5cXG5lbnVtIFBheW1lbnRTdGF0dXMge1xcbiAgSU5JVElBVEVEXFxuICBTVUNDRVNTXFxuICBGQUlMRURcXG4gIENBTkNFTExFRFxcbiAgUkVGVU5ERURcXG59XFxuXFxuZW51bSBQb3N0U3RhdHVzIHtcXG4gIERSQUZUXFxuICBQVUJMSVNIRURcXG59XFxuXFxubW9kZWwgUGF5bWVudCB7XFxuICBpZCAgICAgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBib29raW5nSWQgICAgICBTdHJpbmdcXG4gIHRyYW5JZCAgICAgICAgIFN0cmluZyAgICAgICAgQHVuaXF1ZSAvLyBTU0xDb21tZXJ6IHRyYW5zYWN0aW9uIGlkLCBnZW5lcmF0ZWQgc2VydmVyLXNpZGVcXG4gIHZhbElkICAgICAgICAgIFN0cmluZz8gLy8gc2V0IGFmdGVyIGdhdGV3YXkgc3VjY2VzcywgdXNlZCBmb3Igc2VydmVyLXNpZGUgdmFsaWRhdGlvblxcbiAgYW1vdW50ICAgICAgICAgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMikgLy8gPSBib29raW5nLnRvdGFsUHJpY2UgYXQgc2Vzc2lvbiBjcmVhdGlvblxcbiAgY3VycmVuY3kgICAgICAgU3RyaW5nICAgICAgICBAZGVmYXVsdChcXFwiQkRUXFxcIilcXG4gIHN0YXR1cyAgICAgICAgIFBheW1lbnRTdGF0dXMgQGRlZmF1bHQoSU5JVElBVEVEKVxcbiAgZ2F0ZXdheVBhZ2VVcmwgU3RyaW5nP1xcbiAgc3NsU2Vzc2lvbktleSAgU3RyaW5nP1xcbiAgY2FyZFR5cGUgICAgICAgU3RyaW5nP1xcbiAgYmFua1RyYW5JZCAgICAgU3RyaW5nP1xcbiAgcGFpZEF0ICAgICAgICAgRGF0ZVRpbWU/XFxuICByZWZ1bmRSZWZJZCAgICBTdHJpbmc/IC8vIFNTTENvbW1lcnogcmVmdW5kIHJlZmVyZW5jZSAoc2V0IHdoZW4gYSByZWZ1bmQgaXMgaW5pdGlhdGVkKVxcbiAgcmVmdW5kZWRBdCAgICAgRGF0ZVRpbWU/IC8vIHdoZW4gdGhlIHJlZnVuZCB3YXMgaW5pdGlhdGVkL3NldHRsZWRcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBib29raW5nIEJvb2tpbmcgQHJlbGF0aW9uKGZpZWxkczogW2Jvb2tpbmdJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuXFxuICBAQGluZGV4KFtib29raW5nSWRdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAbWFwKFxcXCJwYXltZW50c1xcXCIpXFxufVxcblxcbm1vZGVsIFJldmlldyB7XFxuICBpZCAgICAgIFN0cmluZyBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgcmF0aW5nICBJbnRcXG4gIGNvbW1lbnQgU3RyaW5nXFxuXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgdXNlciAgICBVc2VyICAgICAgICBAcmVsYXRpb24oXFxcIkN1c3RvbWVyUmV2aWV3c1xcXCIsIGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYWNrYWdlIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcblxcbiAgQEB1bmlxdWUoW3VzZXJJZCwgcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3BhY2thZ2VJZF0pXFxuICBAQG1hcChcXFwicmV2aWV3c1xcXCIpXFxufVxcblxcbi8vIFRoaXMgaXMgeW91ciBQcmlzbWEgc2NoZW1hIGZpbGUsXFxuLy8gbGVhcm4gbW9yZSBhYm91dCBpdCBpbiB0aGUgZG9jczogaHR0cHM6Ly9wcmlzLmx5L2QvcHJpc21hLXNjaGVtYVxcblxcbmdlbmVyYXRvciBjbGllbnQge1xcbiAgcHJvdmlkZXIgPSBcXFwicHJpc21hLWNsaWVudFxcXCJcXG4gIG91dHB1dCAgID0gXFxcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWFcXFwiXFxufVxcblxcbmRhdGFzb3VyY2UgZGIge1xcbiAgcHJvdmlkZXIgPSBcXFwicG9zdGdyZXNxbFxcXCJcXG59XFxuXFxubW9kZWwgVG91clBhY2thZ2Uge1xcbiAgaWQgICAgICAgICAgU3RyaW5nICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdGl0bGUgICAgICAgU3RyaW5nXFxuICBzbHVnICAgICAgICBTdHJpbmcgICAgICAgIEB1bmlxdWVcXG4gIGRlc2NyaXB0aW9uIFN0cmluZ1xcbiAgbG9jYXRpb24gICAgU3RyaW5nXFxuICBwcmljZSAgICAgICBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKVxcbiAgZHVyYXRpb24gICAgSW50XFxuICByYXRpbmcgICAgICBGbG9hdCAgICAgICAgIEBkZWZhdWx0KDApXFxuICBpbWFnZXMgICAgICBTdHJpbmdbXVxcbiAgc3RhdHVzICAgICAgUGFja2FnZVN0YXR1cyBAZGVmYXVsdChQRU5ESU5HKVxcbiAgaXNEZWxldGVkICAgQm9vbGVhbiAgICAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGNhdGVnb3J5SWQgU3RyaW5nXFxuICBhZ2VudElkICAgIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGNhdGVnb3J5IENhdGVnb3J5ICBAcmVsYXRpb24oZmllbGRzOiBbY2F0ZWdvcnlJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBhZ2VudCAgICBVc2VyICAgICAgQHJlbGF0aW9uKFxcXCJBZ2VudFBhY2thZ2VzXFxcIiwgZmllbGRzOiBbYWdlbnRJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBib29raW5ncyBCb29raW5nW11cXG4gIHJldmlld3MgIFJldmlld1tdXFxuXFxuICBAQGluZGV4KFtjYXRlZ29yeUlkXSlcXG4gIEBAaW5kZXgoW2NhdGVnb3J5SWQsIHByaWNlXSlcXG4gIEBAaW5kZXgoW3ByaWNlXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQG1hcChcXFwidG91cl9wYWNrYWdlc1xcXCIpXFxufVxcblxcbm1vZGVsIFVzZXIge1xcbiAgaWQgICAgICAgICAgICBTdHJpbmcgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIG5hbWUgICAgICAgICAgU3RyaW5nXFxuICBlbWFpbCAgICAgICAgIFN0cmluZyAgICAgICBAdW5pcXVlXFxuICBwYXNzd29yZCAgICAgIFN0cmluZz9cXG4gIGdvb2dsZUlkICAgICAgU3RyaW5nPyAgICAgIEB1bmlxdWVcXG4gIHBob25lICAgICAgICAgU3RyaW5nP1xcbiAgYXZhdGFyVXJsICAgICBTdHJpbmc/XFxuICByb2xlICAgICAgICAgIFJvbGUgICAgICAgICBAZGVmYXVsdChVU0VSKVxcbiAgc3RhdHVzICAgICAgICBVc2VyU3RhdHVzICAgQGRlZmF1bHQoQUNUSVZFKVxcbiAgYXV0aFByb3ZpZGVyICBBdXRoUHJvdmlkZXIgQGRlZmF1bHQoQ1JFREVOVElBTClcXG4gIGVtYWlsVmVyaWZpZWQgQm9vbGVhbiAgICAgIEBkZWZhdWx0KGZhbHNlKVxcbiAgaXNEZWxldGVkICAgICBCb29sZWFuICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuICB0b2tlblZlcnNpb24gIEludCAgICAgICAgICBAZGVmYXVsdCgwKVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBhY2thZ2VzIFRvdXJQYWNrYWdlW10gQHJlbGF0aW9uKFxcXCJBZ2VudFBhY2thZ2VzXFxcIilcXG4gIGJvb2tpbmdzIEJvb2tpbmdbXSAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lckJvb2tpbmdzXFxcIilcXG4gIHJldmlld3MgIFJldmlld1tdICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lclJldmlld3NcXFwiKVxcbiAgcG9zdHMgICAgQmxvZ1Bvc3RbXSAgICBAcmVsYXRpb24oXFxcIkF1dGhvclBvc3RzXFxcIilcXG5cXG4gIEBAaW5kZXgoW3JvbGVdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAbWFwKFxcXCJ1c2Vyc1xcXCIpXFxufVxcblwiLFxuICBcInJ1bnRpbWVEYXRhTW9kZWxcIjoge1xuICAgIFwibW9kZWxzXCI6IHt9LFxuICAgIFwiZW51bXNcIjoge30sXG4gICAgXCJ0eXBlc1wiOiB7fVxuICB9LFxuICBcInBhcmFtZXRlcml6YXRpb25TY2hlbWFcIjoge1xuICAgIFwic3RyaW5nc1wiOiBbXSxcbiAgICBcImdyYXBoXCI6IFwiXCJcbiAgfVxufVxuXG5jb25maWcucnVudGltZURhdGFNb2RlbCA9IEpTT04ucGFyc2UoXCJ7XFxcIm1vZGVsc1xcXCI6e1xcXCJCbG9nUG9zdFxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidGl0bGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNsdWdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImV4Y2VycHRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNvbnRlbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNvdmVySW1hZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN0YXR1c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlBvc3RTdGF0dXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhdXRob3JJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhdXRob3JcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBdXRob3JQb3N0c1xcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwiYmxvZ19wb3N0c1xcXCJ9LFxcXCJCb29raW5nXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0cmF2ZWxEYXRlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRyYXZlbGVyc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidG90YWxQcmljZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN0YXR1c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdTdGF0dXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXltZW50c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUGF5bWVudFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1BheW1lbnRcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImJvb2tpbmdzXFxcIn0sXFxcIkNhdGVnb3J5XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJuYW1lXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzbHVnXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkNhdGVnb3J5VG9Ub3VyUGFja2FnZVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwiY2F0ZWdvcmllc1xcXCJ9LFxcXCJDb250YWN0TWVzc2FnZVxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN1YmplY3RcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm1lc3NhZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzUmVzb2x2ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwiY29udGFjdF9tZXNzYWdlc1xcXCJ9LFxcXCJQYXltZW50XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRyYW5JZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidmFsSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImFtb3VudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImN1cnJlbmN5XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYXltZW50U3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNzbFNlc3Npb25LZXlcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNhcmRUeXBlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJiYW5rVHJhbklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWlkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmdW5kUmVmSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJlZnVuZGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvUGF5bWVudFxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwicGF5bWVudHNcXFwifSxcXFwiUmV2aWV3XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyYXRpbmdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNvbW1lbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lclJldmlld3NcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlJldmlld1RvVG91clBhY2thZ2VcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInJldmlld3NcXFwifSxcXFwiVG91clBhY2thZ2VcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRpdGxlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzbHVnXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJkZXNjcmlwdGlvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibG9jYXRpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInByaWNlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEZWNpbWFsXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZHVyYXRpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJhdGluZ1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRmxvYXRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpbWFnZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN0YXR1c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlBhY2thZ2VTdGF0dXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjYXRlZ29yeUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhZ2VudElkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNhdGVnb3J5XFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJDYXRlZ29yeVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkNhdGVnb3J5VG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImFnZW50XFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQWdlbnRQYWNrYWdlc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyZXZpZXdzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJSZXZpZXdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZXZpZXdUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJ0b3VyX3BhY2thZ2VzXFxcIn0sXFxcIlVzZXJcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXNzd29yZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZ29vZ2xlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBob25lXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhdmF0YXJVcmxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJvbGVcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJSb2xlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhQcm92aWRlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIkF1dGhQcm92aWRlclxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsVmVyaWZpZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0b2tlblZlcnNpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQWdlbnRQYWNrYWdlc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJldmlld3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlJldmlld1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyUmV2aWV3c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBvc3RzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCbG9nUG9zdFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkF1dGhvclBvc3RzXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJ1c2Vyc1xcXCJ9fSxcXFwiZW51bXNcXFwiOnt9LFxcXCJ0eXBlc1xcXCI6e319XCIpXG5jb25maWcucGFyYW1ldGVyaXphdGlvblNjaGVtYSA9IHtcbiAgc3RyaW5nczogSlNPTi5wYXJzZShcIltcXFwid2hlcmVcXFwiLFxcXCJvcmRlckJ5XFxcIixcXFwiY3Vyc29yXFxcIixcXFwicGFja2FnZXNcXFwiLFxcXCJfY291bnRcXFwiLFxcXCJjYXRlZ29yeVxcXCIsXFxcImFnZW50XFxcIixcXFwidXNlclxcXCIsXFxcInBhY2thZ2VcXFwiLFxcXCJib29raW5nXFxcIixcXFwicGF5bWVudHNcXFwiLFxcXCJib29raW5nc1xcXCIsXFxcInJldmlld3NcXFwiLFxcXCJwb3N0c1xcXCIsXFxcImF1dGhvclxcXCIsXFxcIkJsb2dQb3N0LmZpbmRVbmlxdWVcXFwiLFxcXCJCbG9nUG9zdC5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIkJsb2dQb3N0LmZpbmRGaXJzdFxcXCIsXFxcIkJsb2dQb3N0LmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJCbG9nUG9zdC5maW5kTWFueVxcXCIsXFxcImRhdGFcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVPbmVcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVNYW55XFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU9uZVxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU1hbnlcXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiY3JlYXRlXFxcIixcXFwidXBkYXRlXFxcIixcXFwiQmxvZ1Bvc3QudXBzZXJ0T25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlT25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlTWFueVxcXCIsXFxcImhhdmluZ1xcXCIsXFxcIl9taW5cXFwiLFxcXCJfbWF4XFxcIixcXFwiQmxvZ1Bvc3QuZ3JvdXBCeVxcXCIsXFxcIkJsb2dQb3N0LmFnZ3JlZ2F0ZVxcXCIsXFxcIkJvb2tpbmcuZmluZFVuaXF1ZVxcXCIsXFxcIkJvb2tpbmcuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCb29raW5nLmZpbmRGaXJzdFxcXCIsXFxcIkJvb2tpbmcuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkJvb2tpbmcuZmluZE1hbnlcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU9uZVxcXCIsXFxcIkJvb2tpbmcuY3JlYXRlTWFueVxcXCIsXFxcIkJvb2tpbmcuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJvb2tpbmcudXBkYXRlT25lXFxcIixcXFwiQm9va2luZy51cGRhdGVNYW55XFxcIixcXFwiQm9va2luZy51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQm9va2luZy51cHNlcnRPbmVcXFwiLFxcXCJCb29raW5nLmRlbGV0ZU9uZVxcXCIsXFxcIkJvb2tpbmcuZGVsZXRlTWFueVxcXCIsXFxcIl9hdmdcXFwiLFxcXCJfc3VtXFxcIixcXFwiQm9va2luZy5ncm91cEJ5XFxcIixcXFwiQm9va2luZy5hZ2dyZWdhdGVcXFwiLFxcXCJDYXRlZ29yeS5maW5kVW5pcXVlXFxcIixcXFwiQ2F0ZWdvcnkuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJDYXRlZ29yeS5maW5kRmlyc3RcXFwiLFxcXCJDYXRlZ29yeS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQ2F0ZWdvcnkuZmluZE1hbnlcXFwiLFxcXCJDYXRlZ29yeS5jcmVhdGVPbmVcXFwiLFxcXCJDYXRlZ29yeS5jcmVhdGVNYW55XFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNhdGVnb3J5LnVwZGF0ZU9uZVxcXCIsXFxcIkNhdGVnb3J5LnVwZGF0ZU1hbnlcXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQ2F0ZWdvcnkudXBzZXJ0T25lXFxcIixcXFwiQ2F0ZWdvcnkuZGVsZXRlT25lXFxcIixcXFwiQ2F0ZWdvcnkuZGVsZXRlTWFueVxcXCIsXFxcIkNhdGVnb3J5Lmdyb3VwQnlcXFwiLFxcXCJDYXRlZ29yeS5hZ2dyZWdhdGVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kVW5pcXVlXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kRmlyc3RcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZE1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5jcmVhdGVPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5jcmVhdGVNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwZGF0ZU9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwZGF0ZU1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBzZXJ0T25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZGVsZXRlT25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZGVsZXRlTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmdyb3VwQnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5hZ2dyZWdhdGVcXFwiLFxcXCJQYXltZW50LmZpbmRVbmlxdWVcXFwiLFxcXCJQYXltZW50LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiUGF5bWVudC5maW5kRmlyc3RcXFwiLFxcXCJQYXltZW50LmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJQYXltZW50LmZpbmRNYW55XFxcIixcXFwiUGF5bWVudC5jcmVhdGVPbmVcXFwiLFxcXCJQYXltZW50LmNyZWF0ZU1hbnlcXFwiLFxcXCJQYXltZW50LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJQYXltZW50LnVwZGF0ZU9uZVxcXCIsXFxcIlBheW1lbnQudXBkYXRlTWFueVxcXCIsXFxcIlBheW1lbnQudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlBheW1lbnQudXBzZXJ0T25lXFxcIixcXFwiUGF5bWVudC5kZWxldGVPbmVcXFwiLFxcXCJQYXltZW50LmRlbGV0ZU1hbnlcXFwiLFxcXCJQYXltZW50Lmdyb3VwQnlcXFwiLFxcXCJQYXltZW50LmFnZ3JlZ2F0ZVxcXCIsXFxcIlJldmlldy5maW5kVW5pcXVlXFxcIixcXFwiUmV2aWV3LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRGaXJzdFxcXCIsXFxcIlJldmlldy5maW5kRmlyc3RPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU9uZVxcXCIsXFxcIlJldmlldy5jcmVhdGVNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJSZXZpZXcudXBkYXRlT25lXFxcIixcXFwiUmV2aWV3LnVwZGF0ZU1hbnlcXFwiLFxcXCJSZXZpZXcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJldmlldy51cHNlcnRPbmVcXFwiLFxcXCJSZXZpZXcuZGVsZXRlT25lXFxcIixcXFwiUmV2aWV3LmRlbGV0ZU1hbnlcXFwiLFxcXCJSZXZpZXcuZ3JvdXBCeVxcXCIsXFxcIlJldmlldy5hZ2dyZWdhdGVcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kVW5pcXVlXFxcIixcXFwiVG91clBhY2thZ2UuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiVG91clBhY2thZ2UuZmluZE1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVNYW55XFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVG91clBhY2thZ2UudXBzZXJ0T25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlT25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLmdyb3VwQnlcXFwiLFxcXCJUb3VyUGFja2FnZS5hZ2dyZWdhdGVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiVXNlci5maW5kRmlyc3RcXFwiLFxcXCJVc2VyLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJVc2VyLmZpbmRNYW55XFxcIixcXFwiVXNlci5jcmVhdGVPbmVcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJVc2VyLnVwZGF0ZU9uZVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlVzZXIudXBzZXJ0T25lXFxcIixcXFwiVXNlci5kZWxldGVPbmVcXFwiLFxcXCJVc2VyLmRlbGV0ZU1hbnlcXFwiLFxcXCJVc2VyLmdyb3VwQnlcXFwiLFxcXCJVc2VyLmFnZ3JlZ2F0ZVxcXCIsXFxcIkFORFxcXCIsXFxcIk9SXFxcIixcXFwiTk9UXFxcIixcXFwiaWRcXFwiLFxcXCJuYW1lXFxcIixcXFwiZW1haWxcXFwiLFxcXCJwYXNzd29yZFxcXCIsXFxcImdvb2dsZUlkXFxcIixcXFwicGhvbmVcXFwiLFxcXCJhdmF0YXJVcmxcXFwiLFxcXCJSb2xlXFxcIixcXFwicm9sZVxcXCIsXFxcIlVzZXJTdGF0dXNcXFwiLFxcXCJzdGF0dXNcXFwiLFxcXCJBdXRoUHJvdmlkZXJcXFwiLFxcXCJhdXRoUHJvdmlkZXJcXFwiLFxcXCJlbWFpbFZlcmlmaWVkXFxcIixcXFwiaXNEZWxldGVkXFxcIixcXFwidG9rZW5WZXJzaW9uXFxcIixcXFwiY3JlYXRlZEF0XFxcIixcXFwidXBkYXRlZEF0XFxcIixcXFwiZXF1YWxzXFxcIixcXFwiaW5cXFwiLFxcXCJub3RJblxcXCIsXFxcImx0XFxcIixcXFwibHRlXFxcIixcXFwiZ3RcXFwiLFxcXCJndGVcXFwiLFxcXCJub3RcXFwiLFxcXCJjb250YWluc1xcXCIsXFxcInN0YXJ0c1dpdGhcXFwiLFxcXCJlbmRzV2l0aFxcXCIsXFxcImV2ZXJ5XFxcIixcXFwic29tZVxcXCIsXFxcIm5vbmVcXFwiLFxcXCJ0aXRsZVxcXCIsXFxcInNsdWdcXFwiLFxcXCJkZXNjcmlwdGlvblxcXCIsXFxcImxvY2F0aW9uXFxcIixcXFwicHJpY2VcXFwiLFxcXCJkdXJhdGlvblxcXCIsXFxcInJhdGluZ1xcXCIsXFxcImltYWdlc1xcXCIsXFxcIlBhY2thZ2VTdGF0dXNcXFwiLFxcXCJjYXRlZ29yeUlkXFxcIixcXFwiYWdlbnRJZFxcXCIsXFxcImhhc1xcXCIsXFxcImhhc0V2ZXJ5XFxcIixcXFwiaGFzU29tZVxcXCIsXFxcImNvbW1lbnRcXFwiLFxcXCJ1c2VySWRcXFwiLFxcXCJwYWNrYWdlSWRcXFwiLFxcXCJib29raW5nSWRcXFwiLFxcXCJ0cmFuSWRcXFwiLFxcXCJ2YWxJZFxcXCIsXFxcImFtb3VudFxcXCIsXFxcImN1cnJlbmN5XFxcIixcXFwiUGF5bWVudFN0YXR1c1xcXCIsXFxcImdhdGV3YXlQYWdlVXJsXFxcIixcXFwic3NsU2Vzc2lvbktleVxcXCIsXFxcImNhcmRUeXBlXFxcIixcXFwiYmFua1RyYW5JZFxcXCIsXFxcInBhaWRBdFxcXCIsXFxcInJlZnVuZFJlZklkXFxcIixcXFwicmVmdW5kZWRBdFxcXCIsXFxcInN1YmplY3RcXFwiLFxcXCJtZXNzYWdlXFxcIixcXFwiaXNSZXNvbHZlZFxcXCIsXFxcInRyYXZlbERhdGVcXFwiLFxcXCJ0cmF2ZWxlcnNcXFwiLFxcXCJ0b3RhbFByaWNlXFxcIixcXFwiQm9va2luZ1N0YXR1c1xcXCIsXFxcImV4Y2VycHRcXFwiLFxcXCJjb250ZW50XFxcIixcXFwiY292ZXJJbWFnZVxcXCIsXFxcIlBvc3RTdGF0dXNcXFwiLFxcXCJhdXRob3JJZFxcXCIsXFxcInVzZXJJZF9wYWNrYWdlSWRcXFwiLFxcXCJpc1xcXCIsXFxcImlzTm90XFxcIixcXFwiY29ubmVjdE9yQ3JlYXRlXFxcIixcXFwidXBzZXJ0XFxcIixcXFwiY3JlYXRlTWFueVxcXCIsXFxcInNldFxcXCIsXFxcImRpc2Nvbm5lY3RcXFwiLFxcXCJkZWxldGVcXFwiLFxcXCJjb25uZWN0XFxcIixcXFwidXBkYXRlTWFueVxcXCIsXFxcImRlbGV0ZU1hbnlcXFwiLFxcXCJwdXNoXFxcIixcXFwiaW5jcmVtZW50XFxcIixcXFwiZGVjcmVtZW50XFxcIixcXFwibXVsdGlwbHlcXFwiLFxcXCJkaXZpZGVcXFwiXVwiKSxcbiAgZ3JhcGg6IFwibEFSUGdBRVBEZ0FBb1FJQUlKY0JBQUNmQWdBd21BRUFBQm9BRUprQkFBQ2ZBZ0F3bWdFQkFBQUFBYVFCQUFDZ0F1TUJJcWdCSUFENkFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlib0JBUUQxQVFBaHV3RUJBQUFBQWQ4QkFRRDFBUUFoNEFFQkFQVUJBQ0hoQVFFQTlRRUFJZU1CQVFEMUFRQWhBUUFBQUFFQUlCWUZBQUN3QWdBZ0JnQUFvUUlBSUFzQUFQNEJBQ0FNQUFEX0FRQWdsd0VBQUswQ0FEQ1lBUUFBQXdBUW1RRUFBSzBDQURDYUFRRUE5UUVBSWFRQkFBQ3ZBc01CSXFnQklBRDZBUUFocWdGQUFQd0JBQ0dyQVVBQV9BRUFJYm9CQVFEMUFRQWh1d0VCQVBVQkFDRzhBUUVBOVFFQUliMEJBUUQxQVFBaHZnRVFBS1lDQUNHX0FRSUEtd0VBSWNBQkNBQ3VBZ0Fod1FFQUFJUUNBQ0REQVFFQTlRRUFJY1FCQVFEMUFRQWhCQVVBQU9RREFDQUdBQURnQXdBZ0N3QUFyd01BSUF3QUFMQURBQ0FXQlFBQXNBSUFJQVlBQUtFQ0FDQUxBQUQtQVFBZ0RBQUFfd0VBSUpjQkFBQ3RBZ0F3bUFFQUFBTUFFSmtCQUFDdEFnQXdtZ0VCQUFBQUFhUUJBQUN2QXNNQklxZ0JJQUQ2QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJvQkFRRDFBUUFodXdFQkFBQUFBYndCQVFEMUFRQWh2UUVCQVBVQkFDRy1BUkFBcGdJQUliOEJBZ0Q3QVFBaHdBRUlBSzRDQUNIQkFRQUFoQUlBSU1NQkFRRDFBUUFoeEFFQkFQVUJBQ0VEQUFBQUF3QWdBUUFBQkFBd0FnQUFCUUFnQXdBQUFBTUFJQUVBQUFRQU1BSUFBQVVBSUFFQUFBQURBQ0FQQndBQW9RSUFJQWdBQUtRQ0FDQUtBQUNzQWdBZ2x3RUFBS29DQURDWUFRQUFDUUFRbVFFQUFLb0NBRENhQVFFQTlRRUFJYVFCQUFDckF0OEJJcW9CUUFEOEFRQWhxd0ZBQVB3QkFDSEpBUUVBOVFFQUljb0JBUUQxQVFBaDJ3RkFBUHdCQUNIY0FRSUEtd0VBSWQwQkVBQ21BZ0FoQXdjQUFPQURBQ0FJQUFEaEF3QWdDZ0FBNHdNQUlBOEhBQUNoQWdBZ0NBQUFwQUlBSUFvQUFLd0NBQ0NYQVFBQXFnSUFNSmdCQUFBSkFCQ1pBUUFBcWdJQU1Kb0JBUUFBQUFHa0FRQUFxd0xmQVNLcUFVQUFfQUVBSWFzQlFBRDhBUUFoeVFFQkFQVUJBQ0hLQVFFQTlRRUFJZHNCUUFEOEFRQWgzQUVDQVBzQkFDSGRBUkFBcGdJQUlRTUFBQUFKQUNBQkFBQUtBREFDQUFBTEFDQVVDUUFBcVFJQUlKY0JBQUNsQWdBd21BRUFBQTBBRUprQkFBQ2xBZ0F3bWdFQkFQVUJBQ0drQVFBQXB3TFJBU0txQVVBQV9BRUFJYXNCUUFEOEFRQWh5d0VCQVBVQkFDSE1BUUVBOVFFQUljMEJBUUQyQVFBaHpnRVFBS1lDQUNIUEFRRUE5UUVBSWRFQkFRRDJBUUFoMGdFQkFQWUJBQ0hUQVFFQTlnRUFJZFFCQVFEMkFRQWgxUUZBQUtnQ0FDSFdBUUVBOWdFQUlkY0JRQUNvQWdBaENRa0FBT0lEQUNETkFRQUFzUUlBSU5FQkFBQ3hBZ0FnMGdFQUFMRUNBQ0RUQVFBQXNRSUFJTlFCQUFDeEFnQWcxUUVBQUxFQ0FDRFdBUUFBc1FJQUlOY0JBQUN4QWdBZ0ZBa0FBS2tDQUNDWEFRQUFwUUlBTUpnQkFBQU5BQkNaQVFBQXBRSUFNSm9CQVFBQUFBR2tBUUFBcHdMUkFTS3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHl3RUJBUFVCQUNITUFRRUFBQUFCelFFQkFQWUJBQ0hPQVJBQXBnSUFJYzhCQVFEMUFRQWgwUUVCQVBZQkFDSFNBUUVBOWdFQUlkTUJBUUQyQVFBaDFBRUJBUFlCQUNIVkFVQUFxQUlBSWRZQkFRRDJBUUFoMXdGQUFLZ0NBQ0VEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQVFBQUFBMEFJQXdIQUFDaEFnQWdDQUFBcEFJQUlKY0JBQUNqQWdBd21BRUFBQklBRUprQkFBQ2pBZ0F3bWdFQkFQVUJBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWh3QUVDQVBzQkFDSElBUUVBOVFFQUlja0JBUUQxQVFBaHlnRUJBUFVCQUNFQ0J3QUE0QU1BSUFnQUFPRURBQ0FOQndBQW9RSUFJQWdBQUtRQ0FDQ1hBUUFBb3dJQU1KZ0JBQUFTQUJDWkFRQUFvd0lBTUpvQkFRQUFBQUdxQVVBQV9BRUFJYXNCUUFEOEFRQWh3QUVDQVBzQkFDSElBUUVBOVFFQUlja0JBUUQxQVFBaHlnRUJBUFVCQUNIa0FRQUFvZ0lBSUFNQUFBQVNBQ0FCQUFBVEFEQUNBQUFVQUNBQkFBQUFDUUFnQVFBQUFCSUFJQU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnRHc0QUFLRUNBQ0NYQVFBQW53SUFNSmdCQUFBYUFCQ1pBUUFBbndJQU1Kb0JBUUQxQVFBaHBBRUFBS0FDNHdFaXFBRWdBUG9CQUNHcUFVQUFfQUVBSWFzQlFBRDhBUUFodWdFQkFQVUJBQ0c3QVFFQTlRRUFJZDhCQVFEMUFRQWg0QUVCQVBVQkFDSGhBUUVBOVFFQUllTUJBUUQxQVFBaEFRNEFBT0FEQUNBREFBQUFHZ0FnQVFBQUd3QXdBZ0FBQVFBZ0FRQUFBQU1BSUFFQUFBQUpBQ0FCQUFBQUVnQWdBUUFBQUJvQUlBRUFBQUFCQUNBREFBQUFHZ0FnQVFBQUd3QXdBZ0FBQVFBZ0F3QUFBQm9BSUFFQUFCc0FNQUlBQUFFQUlBTUFBQUFhQUNBQkFBQWJBREFDQUFBQkFDQU1EZ0FBM3dNQUlKb0JBUUFBQUFHa0FRQUFBT01CQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCM3dFQkFBQUFBZUFCQVFBQUFBSGhBUUVBQUFBQjR3RUJBQUFBQVFFVUFBQWxBQ0FMbWdFQkFBQUFBYVFCQUFBQTR3RUNxQUVnQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCdWdFQkFBQUFBYnNCQVFBQUFBSGZBUUVBQUFBQjRBRUJBQUFBQWVFQkFRQUFBQUhqQVFFQUFBQUJBUlFBQUNjQU1BRVVBQUFuQURBTURnQUEzZ01BSUpvQkFRQzNBZ0FocEFFQUFNMEM0d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlkOEJBUUMzQWdBaDRBRUJBTGNDQUNIaEFRRUF0d0lBSWVNQkFRQzNBZ0FoQWdBQUFBRUFJQlFBQUNvQUlBdWFBUUVBdHdJQUlhUUJBQUROQXVNQklxZ0JJQUM4QWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSWJvQkFRQzNBZ0FodXdFQkFMY0NBQ0hmQVFFQXR3SUFJZUFCQVFDM0FnQWg0UUVCQUxjQ0FDSGpBUUVBdHdJQUlRSUFBQUFhQUNBVUFBQXNBQ0FDQUFBQUdnQWdGQUFBTEFBZ0F3QUFBQUVBSUJzQUFDVUFJQndBQUNvQUlBRUFBQUFCQUNBQkFBQUFHZ0FnQXdRQUFOc0RBQ0FoQUFEZEF3QWdJZ0FBM0FNQUlBNlhBUUFBbXdJQU1KZ0JBQUF6QUJDWkFRQUFtd0lBTUpvQkFRRGFBUUFocEFFQUFKd0M0d0VpcUFFZ0FOOEJBQ0dxQVVBQTRRRUFJYXNCUUFEaEFRQWh1Z0VCQU5vQkFDRzdBUUVBMmdFQUlkOEJBUURhQVFBaDRBRUJBTm9CQUNIaEFRRUEyZ0VBSWVNQkFRRGFBUUFoQXdBQUFCb0FJQUVBQURJQU1DQUFBRE1BSUFNQUFBQWFBQ0FCQUFBYkFEQUNBQUFCQUNBQkFBQUFDd0FnQVFBQUFBc0FJQU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FEQUFBQUNRQWdBUUFBQ2dBd0FnQUFDd0FnQXdBQUFBa0FJQUVBQUFvQU1BSUFBQXNBSUF3SEFBQ2tBd0FnQ0FBQV9BSUFJQW9BQVAwQ0FDQ2FBUUVBQUFBQnBBRUFBQURmQVFLcUFVQUFBQUFCcXdGQUFBQUFBY2tCQVFBQUFBSEtBUUVBQUFBQjJ3RkFBQUFBQWR3QkFnQUFBQUhkQVJBQUFBQUJBUlFBQURzQUlBbWFBUUVBQUFBQnBBRUFBQURmQVFLcUFVQUFBQUFCcXdGQUFBQUFBY2tCQVFBQUFBSEtBUUVBQUFBQjJ3RkFBQUFBQWR3QkFnQUFBQUhkQVJBQUFBQUJBUlFBQUQwQU1BRVVBQUE5QURBTUJ3QUFvZ01BSUFnQUFPc0NBQ0FLQUFEc0FnQWdtZ0VCQUxjQ0FDR2tBUUFBNlFMZkFTS3FBVUFBdmdJQUlhc0JRQUMtQWdBaHlRRUJBTGNDQUNIS0FRRUF0d0lBSWRzQlFBQy1BZ0FoM0FFQ0FMMENBQ0hkQVJBQTZBSUFJUUlBQUFBTEFDQVVBQUJBQUNBSm1nRUJBTGNDQUNHa0FRQUE2UUxmQVNLcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoeVFFQkFMY0NBQ0hLQVFFQXR3SUFJZHNCUUFDLUFnQWgzQUVDQUwwQ0FDSGRBUkFBNkFJQUlRSUFBQUFKQUNBVUFBQkNBQ0FDQUFBQUNRQWdGQUFBUWdBZ0F3QUFBQXNBSUJzQUFEc0FJQndBQUVBQUlBRUFBQUFMQUNBQkFBQUFDUUFnQlFRQUFOWURBQ0FoQUFEWkF3QWdJZ0FBMkFNQUlETUFBTmNEQUNBMEFBRGFBd0FnREpjQkFBQ1hBZ0F3bUFFQUFFa0FFSmtCQUFDWEFnQXdtZ0VCQU5vQkFDR2tBUUFBbUFMZkFTS3FBVUFBNFFFQUlhc0JRQURoQVFBaHlRRUJBTm9CQUNIS0FRRUEyZ0VBSWRzQlFBRGhBUUFoM0FFQ0FPQUJBQ0hkQVJBQWdnSUFJUU1BQUFBSkFDQUJBQUJJQURBZ0FBQkpBQ0FEQUFBQUNRQWdBUUFBQ2dBd0FnQUFDd0FnQ1FNQUFQMEJBQ0NYQVFBQWxnSUFNSmdCQUFCUEFCQ1pBUUFBbGdJQU1Kb0JBUUFBQUFHYkFRRUFBQUFCcWdGQUFQd0JBQ0dyQVVBQV9BRUFJYnNCQVFBQUFBRUJBQUFBVEFBZ0FRQUFBRXdBSUFrREFBRDlBUUFnbHdFQUFKWUNBRENZQVFBQVR3QVFtUUVBQUpZQ0FEQ2FBUUVBOVFFQUlac0JBUUQxQVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJzQkFRRDFBUUFoQVFNQUFLNERBQ0FEQUFBQVR3QWdBUUFBVUFBd0FnQUFUQUFnQXdBQUFFOEFJQUVBQUZBQU1BSUFBRXdBSUFNQUFBQlBBQ0FCQUFCUUFEQUNBQUJNQUNBR0F3QUExUU1BSUpvQkFRQUFBQUdiQVFFQUFBQUJxZ0ZBQUFBQUFhc0JRQUFBQUFHN0FRRUFBQUFCQVJRQUFGUUFJQVdhQVFFQUFBQUJtd0VCQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCdXdFQkFBQUFBUUVVQUFCV0FEQUJGQUFBVmdBd0JnTUFBTXNEQUNDYUFRRUF0d0lBSVpzQkFRQzNBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYnNCQVFDM0FnQWhBZ0FBQUV3QUlCUUFBRmtBSUFXYUFRRUF0d0lBSVpzQkFRQzNBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYnNCQVFDM0FnQWhBZ0FBQUU4QUlCUUFBRnNBSUFJQUFBQlBBQ0FVQUFCYkFDQURBQUFBVEFBZ0d3QUFWQUFnSEFBQVdRQWdBUUFBQUV3QUlBRUFBQUJQQUNBREJBQUF5QU1BSUNFQUFNb0RBQ0FpQUFESkF3QWdDSmNCQUFDVkFnQXdtQUVBQUdJQUVKa0JBQUNWQWdBd21nRUJBTm9CQUNHYkFRRUEyZ0VBSWFvQlFBRGhBUUFocXdGQUFPRUJBQ0c3QVFFQTJnRUFJUU1BQUFCUEFDQUJBQUJoQURBZ0FBQmlBQ0FEQUFBQVR3QWdBUUFBVUFBd0FnQUFUQUFnQzVjQkFBQ1VBZ0F3bUFFQUFHZ0FFSmtCQUFDVUFnQXdtZ0VCQUFBQUFac0JBUUQxQVFBaG5BRUJBUFVCQUNHcUFVQUFfQUVBSWFzQlFBRDhBUUFoMkFFQkFQVUJBQ0haQVFFQTlRRUFJZG9CSUFENkFRQWhBUUFBQUdVQUlBRUFBQUJsQUNBTGx3RUFBSlFDQURDWUFRQUFhQUFRbVFFQUFKUUNBRENhQVFFQTlRRUFJWnNCQVFEMUFRQWhuQUVCQVBVQkFDR3FBVUFBX0FFQUlhc0JRQUQ4QVFBaDJBRUJBUFVCQUNIWkFRRUE5UUVBSWRvQklBRDZBUUFoQUFNQUFBQm9BQ0FCQUFCcEFEQUNBQUJsQUNBREFBQUFhQUFnQVFBQWFRQXdBZ0FBWlFBZ0F3QUFBR2dBSUFFQUFHa0FNQUlBQUdVQUlBaWFBUUVBQUFBQm13RUJBQUFBQVp3QkFRQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFkZ0JBUUFBQUFIWkFRRUFBQUFCMmdFZ0FBQUFBUUVVQUFCdEFDQUltZ0VCQUFBQUFac0JBUUFBQUFHY0FRRUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBSFlBUUVBQUFBQjJRRUJBQUFBQWRvQklBQUFBQUVCRkFBQWJ3QXdBUlFBQUc4QU1BaWFBUUVBdHdJQUlac0JBUUMzQWdBaG5BRUJBTGNDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoMkFFQkFMY0NBQ0haQVFFQXR3SUFJZG9CSUFDOEFnQWhBZ0FBQUdVQUlCUUFBSElBSUFpYUFRRUF0d0lBSVpzQkFRQzNBZ0FobkFFQkFMY0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWgyQUVCQUxjQ0FDSFpBUUVBdHdJQUlkb0JJQUM4QWdBaEFnQUFBR2dBSUJRQUFIUUFJQUlBQUFCb0FDQVVBQUIwQUNBREFBQUFaUUFnR3dBQWJRQWdIQUFBY2dBZ0FRQUFBR1VBSUFFQUFBQm9BQ0FEQkFBQXhRTUFJQ0VBQU1jREFDQWlBQURHQXdBZ0M1Y0JBQUNUQWdBd21BRUFBSHNBRUprQkFBQ1RBZ0F3bWdFQkFOb0JBQ0diQVFFQTJnRUFJWndCQVFEYUFRQWhxZ0ZBQU9FQkFDR3JBVUFBNFFFQUlkZ0JBUURhQVFBaDJRRUJBTm9CQUNIYUFTQUEzd0VBSVFNQUFBQm9BQ0FCQUFCNkFEQWdBQUI3QUNBREFBQUFhQUFnQVFBQWFRQXdBZ0FBWlFBZ0FRQUFBQThBSUFFQUFBQVBBQ0FEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQXdBQUFBMEFJQUVBQUE0QU1BSUFBQThBSUFNQUFBQU5BQ0FCQUFBT0FEQUNBQUFQQUNBUkNRQUF4QU1BSUpvQkFRQUFBQUdrQVFBQUFORUJBcW9CUUFBQUFBR3JBVUFBQUFBQnl3RUJBQUFBQWN3QkFRQUFBQUhOQVFFQUFBQUJ6Z0VRQUFBQUFjOEJBUUFBQUFIUkFRRUFBQUFCMGdFQkFBQUFBZE1CQVFBQUFBSFVBUUVBQUFBQjFRRkFBQUFBQWRZQkFRQUFBQUhYQVVBQUFBQUJBUlFBQUlNQkFDQVFtZ0VCQUFBQUFhUUJBQUFBMFFFQ3FnRkFBQUFBQWFzQlFBQUFBQUhMQVFFQUFBQUJ6QUVCQUFBQUFjMEJBUUFBQUFIT0FSQUFBQUFCendFQkFBQUFBZEVCQVFBQUFBSFNBUUVBQUFBQjB3RUJBQUFBQWRRQkFRQUFBQUhWQVVBQUFBQUIxZ0VCQUFBQUFkY0JRQUFBQUFFQkZBQUFoUUVBTUFFVUFBQ0ZBUUF3RVFrQUFNTURBQ0NhQVFFQXR3SUFJYVFCQUFEM0F0RUJJcW9CUUFDLUFnQWhxd0ZBQUw0Q0FDSExBUUVBdHdJQUljd0JBUUMzQWdBaHpRRUJBTGdDQUNIT0FSQUE2QUlBSWM4QkFRQzNBZ0FoMFFFQkFMZ0NBQ0hTQVFFQXVBSUFJZE1CQVFDNEFnQWgxQUVCQUxnQ0FDSFZBVUFBLUFJQUlkWUJBUUM0QWdBaDF3RkFBUGdDQUNFQ0FBQUFEd0FnRkFBQWlBRUFJQkNhQVFFQXR3SUFJYVFCQUFEM0F0RUJJcW9CUUFDLUFnQWhxd0ZBQUw0Q0FDSExBUUVBdHdJQUljd0JBUUMzQWdBaHpRRUJBTGdDQUNIT0FSQUE2QUlBSWM4QkFRQzNBZ0FoMFFFQkFMZ0NBQ0hTQVFFQXVBSUFJZE1CQVFDNEFnQWgxQUVCQUxnQ0FDSFZBVUFBLUFJQUlkWUJBUUM0QWdBaDF3RkFBUGdDQUNFQ0FBQUFEUUFnRkFBQWlnRUFJQUlBQUFBTkFDQVVBQUNLQVFBZ0F3QUFBQThBSUJzQUFJTUJBQ0FjQUFDSUFRQWdBUUFBQUE4QUlBRUFBQUFOQUNBTkJBQUF2Z01BSUNFQUFNRURBQ0FpQUFEQUF3QWdNd0FBdndNQUlEUUFBTUlEQUNETkFRQUFzUUlBSU5FQkFBQ3hBZ0FnMGdFQUFMRUNBQ0RUQVFBQXNRSUFJTlFCQUFDeEFnQWcxUUVBQUxFQ0FDRFdBUUFBc1FJQUlOY0JBQUN4QWdBZ0U1Y0JBQUNNQWdBd21BRUFBSkVCQUJDWkFRQUFqQUlBTUpvQkFRRGFBUUFocEFFQUFJMEMwUUVpcWdGQUFPRUJBQ0dyQVVBQTRRRUFJY3NCQVFEYUFRQWh6QUVCQU5vQkFDSE5BUUVBMndFQUljNEJFQUNDQWdBaHp3RUJBTm9CQUNIUkFRRUEyd0VBSWRJQkFRRGJBUUFoMHdFQkFOc0JBQ0hVQVFFQTJ3RUFJZFVCUUFDT0FnQWgxZ0VCQU5zQkFDSFhBVUFBamdJQUlRTUFBQUFOQUNBQkFBQ1FBUUF3SUFBQWtRRUFJQU1BQUFBTkFDQUJBQUFPQURBQ0FBQVBBQ0FCQUFBQUZBQWdBUUFBQUJRQUlBTUFBQUFTQUNBQkFBQVRBREFDQUFBVUFDQURBQUFBRWdBZ0FRQUFFd0F3QWdBQUZBQWdBd0FBQUJJQUlBRUFBQk1BTUFJQUFCUUFJQWtIQUFDWkF3QWdDQUFBM1FJQUlKb0JBUUFBQUFHcUFVQUFBQUFCcXdGQUFBQUFBY0FCQWdBQUFBSElBUUVBQUFBQnlRRUJBQUFBQWNvQkFRQUFBQUVCRkFBQW1RRUFJQWVhQVFFQUFBQUJxZ0ZBQUFBQUFhc0JRQUFBQUFIQUFRSUFBQUFCeUFFQkFBQUFBY2tCQVFBQUFBSEtBUUVBQUFBQkFSUUFBSnNCQURBQkZBQUFtd0VBTUFrSEFBQ1hBd0FnQ0FBQTJ3SUFJSm9CQVFDM0FnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljQUJBZ0M5QWdBaHlBRUJBTGNDQUNISkFRRUF0d0lBSWNvQkFRQzNBZ0FoQWdBQUFCUUFJQlFBQUo0QkFDQUhtZ0VCQUxjQ0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaHdBRUNBTDBDQUNISUFRRUF0d0lBSWNrQkFRQzNBZ0FoeWdFQkFMY0NBQ0VDQUFBQUVnQWdGQUFBb0FFQUlBSUFBQUFTQUNBVUFBQ2dBUUFnQXdBQUFCUUFJQnNBQUprQkFDQWNBQUNlQVFBZ0FRQUFBQlFBSUFFQUFBQVNBQ0FGQkFBQXVRTUFJQ0VBQUx3REFDQWlBQUM3QXdBZ013QUF1Z01BSURRQUFMMERBQ0FLbHdFQUFJc0NBRENZQVFBQXB3RUFFSmtCQUFDTEFnQXdtZ0VCQU5vQkFDR3FBVUFBNFFFQUlhc0JRQURoQVFBaHdBRUNBT0FCQUNISUFRRUEyZ0VBSWNrQkFRRGFBUUFoeWdFQkFOb0JBQ0VEQUFBQUVnQWdBUUFBcGdFQU1DQUFBS2NCQUNBREFBQUFFZ0FnQVFBQUV3QXdBZ0FBRkFBZ0FRQUFBQVVBSUFFQUFBQUZBQ0FEQUFBQUF3QWdBUUFBQkFBd0FnQUFCUUFnQXdBQUFBTUFJQUVBQUFRQU1BSUFBQVVBSUFNQUFBQURBQ0FCQUFBRUFEQUNBQUFGQUNBVEJRQUFwd01BSUFZQUFMZ0RBQ0FMQUFDb0F3QWdEQUFBcVFNQUlKb0JBUUFBQUFHa0FRQUFBTU1CQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCdkFFQkFBQUFBYjBCQVFBQUFBRy1BUkFBQUFBQnZ3RUNBQUFBQWNBQkNBQUFBQUhCQVFBQXBnTUFJTU1CQVFBQUFBSEVBUUVBQUFBQkFSUUFBSzhCQUNBUG1nRUJBQUFBQWFRQkFBQUF3d0VDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUc4QVFFQUFBQUJ2UUVCQUFBQUFiNEJFQUFBQUFHX0FRSUFBQUFCd0FFSUFBQUFBY0VCQUFDbUF3QWd3d0VCQUFBQUFjUUJBUUFBQUFFQkZBQUFzUUVBTUFFVUFBQ3hBUUF3RXdVQUFJd0RBQ0FHQUFDM0F3QWdDd0FBalFNQUlBd0FBSTREQUNDYUFRRUF0d0lBSWFRQkFBQ0tBOE1CSXFnQklBQzhBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYm9CQVFDM0FnQWh1d0VCQUxjQ0FDRzhBUUVBdHdJQUliMEJBUUMzQWdBaHZnRVFBT2dDQUNHX0FRSUF2UUlBSWNBQkNBQ0lBd0Fod1FFQUFJa0RBQ0REQVFFQXR3SUFJY1FCQVFDM0FnQWhBZ0FBQUFVQUlCUUFBTFFCQUNBUG1nRUJBTGNDQUNHa0FRQUFpZ1BEQVNLb0FTQUF2QUlBSWFvQlFBQy1BZ0FocXdGQUFMNENBQ0c2QVFFQXR3SUFJYnNCQVFDM0FnQWh2QUVCQUxjQ0FDRzlBUUVBdHdJQUliNEJFQURvQWdBaHZ3RUNBTDBDQUNIQUFRZ0FpQU1BSWNFQkFBQ0pBd0Fnd3dFQkFMY0NBQ0hFQVFFQXR3SUFJUUlBQUFBREFDQVVBQUMyQVFBZ0FnQUFBQU1BSUJRQUFMWUJBQ0FEQUFBQUJRQWdHd0FBcndFQUlCd0FBTFFCQUNBQkFBQUFCUUFnQVFBQUFBTUFJQVVFQUFDeUF3QWdJUUFBdFFNQUlDSUFBTFFEQUNBekFBQ3pBd0FnTkFBQXRnTUFJQktYQVFBQWdRSUFNSmdCQUFDOUFRQVFtUUVBQUlFQ0FEQ2FBUUVBMmdFQUlhUUJBQUNGQXNNQklxZ0JJQURmQVFBaHFnRkFBT0VCQUNHckFVQUE0UUVBSWJvQkFRRGFBUUFodXdFQkFOb0JBQ0c4QVFFQTJnRUFJYjBCQVFEYUFRQWh2Z0VRQUlJQ0FDR19BUUlBNEFFQUljQUJDQUNEQWdBaHdRRUFBSVFDQUNEREFRRUEyZ0VBSWNRQkFRRGFBUUFoQXdBQUFBTUFJQUVBQUx3QkFEQWdBQUM5QVFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlCWURBQUQ5QVFBZ0N3QUFfZ0VBSUF3QUFQOEJBQ0FOQUFDQUFnQWdsd0VBQVBRQkFEQ1lBUUFBd3dFQUVKa0JBQUQwQVFBd21nRUJBQUFBQVpzQkFRRDFBUUFobkFFQkFBQUFBWjBCQVFEMkFRQWhuZ0VCQUFBQUFaOEJBUUQyQVFBaG9BRUJBUFlCQUNHaUFRQUE5d0dpQVNLa0FRQUEtQUdrQVNLbUFRQUEtUUdtQVNLbkFTQUEtZ0VBSWFnQklBRDZBUUFocVFFQ0FQc0JBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWhBUUFBQU1BQkFDQUJBQUFBd0FFQUlCWURBQUQ5QVFBZ0N3QUFfZ0VBSUF3QUFQOEJBQ0FOQUFDQUFnQWdsd0VBQVBRQkFEQ1lBUUFBd3dFQUVKa0JBQUQwQVFBd21nRUJBUFVCQUNHYkFRRUE5UUVBSVp3QkFRRDFBUUFoblFFQkFQWUJBQ0dlQVFFQTlnRUFJWjhCQVFEMkFRQWhvQUVCQVBZQkFDR2lBUUFBOXdHaUFTS2tBUUFBLUFHa0FTS21BUUFBLVFHbUFTS25BU0FBLWdFQUlhZ0JJQUQ2QVFBaHFRRUNBUHNCQUNHcUFVQUFfQUVBSWFzQlFBRDhBUUFoQ0FNQUFLNERBQ0FMQUFDdkF3QWdEQUFBc0FNQUlBMEFBTEVEQUNDZEFRQUFzUUlBSUo0QkFBQ3hBZ0FnbndFQUFMRUNBQ0NnQVFBQXNRSUFJQU1BQUFEREFRQWdBUUFBeEFFQU1BSUFBTUFCQUNBREFBQUF3d0VBSUFFQUFNUUJBREFDQUFEQUFRQWdBd0FBQU1NQkFDQUJBQURFQVFBd0FnQUF3QUVBSUJNREFBQ3FBd0FnQ3dBQXF3TUFJQXdBQUt3REFDQU5BQUN0QXdBZ21nRUJBQUFBQVpzQkFRQUFBQUdjQVFFQUFBQUJuUUVCQUFBQUFaNEJBUUFBQUFHZkFRRUFBQUFCb0FFQkFBQUFBYUlCQUFBQW9nRUNwQUVBQUFDa0FRS21BUUFBQUtZQkFxY0JJQUFBQUFHb0FTQUFBQUFCcVFFQ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQkFSUUFBTWdCQUNBUG1nRUJBQUFBQVpzQkFRQUFBQUdjQVFFQUFBQUJuUUVCQUFBQUFaNEJBUUFBQUFHZkFRRUFBQUFCb0FFQkFBQUFBYUlCQUFBQW9nRUNwQUVBQUFDa0FRS21BUUFBQUtZQkFxY0JJQUFBQUFHb0FTQUFBQUFCcVFFQ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQkFSUUFBTW9CQURBQkZBQUF5Z0VBTUJNREFBQ19BZ0FnQ3dBQXdBSUFJQXdBQU1FQ0FDQU5BQURDQWdBZ21nRUJBTGNDQUNHYkFRRUF0d0lBSVp3QkFRQzNBZ0FoblFFQkFMZ0NBQ0dlQVFFQXVBSUFJWjhCQVFDNEFnQWhvQUVCQUxnQ0FDR2lBUUFBdVFLaUFTS2tBUUFBdWdLa0FTS21BUUFBdXdLbUFTS25BU0FBdkFJQUlhZ0JJQUM4QWdBaHFRRUNBTDBDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoQWdBQUFNQUJBQ0FVQUFETkFRQWdENW9CQVFDM0FnQWhtd0VCQUxjQ0FDR2NBUUVBdHdJQUlaMEJBUUM0QWdBaG5nRUJBTGdDQUNHZkFRRUF1QUlBSWFBQkFRQzRBZ0Fob2dFQUFMa0NvZ0VpcEFFQUFMb0NwQUVpcGdFQUFMc0NwZ0VpcHdFZ0FMd0NBQ0dvQVNBQXZBSUFJYWtCQWdDOUFnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlRSUFBQUREQVFBZ0ZBQUF6d0VBSUFJQUFBRERBUUFnRkFBQXp3RUFJQU1BQUFEQUFRQWdHd0FBeUFFQUlCd0FBTTBCQUNBQkFBQUF3QUVBSUFFQUFBRERBUUFnQ1FRQUFMSUNBQ0FoQUFDMUFnQWdJZ0FBdEFJQUlETUFBTE1DQUNBMEFBQzJBZ0FnblFFQUFMRUNBQ0NlQVFBQXNRSUFJSjhCQUFDeEFnQWdvQUVBQUxFQ0FDQVNsd0VBQU5rQkFEQ1lBUUFBMWdFQUVKa0JBQURaQVFBd21nRUJBTm9CQUNHYkFRRUEyZ0VBSVp3QkFRRGFBUUFoblFFQkFOc0JBQ0dlQVFFQTJ3RUFJWjhCQVFEYkFRQWhvQUVCQU5zQkFDR2lBUUFBM0FHaUFTS2tBUUFBM1FHa0FTS21BUUFBM2dHbUFTS25BU0FBM3dFQUlhZ0JJQURmQVFBaHFRRUNBT0FCQUNHcUFVQUE0UUVBSWFzQlFBRGhBUUFoQXdBQUFNTUJBQ0FCQUFEVkFRQXdJQUFBMWdFQUlBTUFBQUREQVFBZ0FRQUF4QUVBTUFJQUFNQUJBQ0FTbHdFQUFOa0JBRENZQVFBQTFnRUFFSmtCQUFEWkFRQXdtZ0VCQU5vQkFDR2JBUUVBMmdFQUlad0JBUURhQVFBaG5RRUJBTnNCQUNHZUFRRUEyd0VBSVo4QkFRRGJBUUFob0FFQkFOc0JBQ0dpQVFBQTNBR2lBU0trQVFBQTNRR2tBU0ttQVFBQTNnR21BU0tuQVNBQTN3RUFJYWdCSUFEZkFRQWhxUUVDQU9BQkFDR3FBVUFBNFFFQUlhc0JRQURoQVFBaERnUUFBT01CQUNBaEFBRHpBUUFnSWdBQTh3RUFJS3dCQVFBQUFBR3RBUUVBQUFBRXJnRUJBQUFBQks4QkFRQUFBQUd3QVFFQUFBQUJzUUVCQUFBQUFiSUJBUUFBQUFHekFRRUE4Z0VBSWJRQkFRQUFBQUcxQVFFQUFBQUJ0Z0VCQUFBQUFRNEVBQUR3QVFBZ0lRQUE4UUVBSUNJQUFQRUJBQ0NzQVFFQUFBQUJyUUVCQUFBQUJhNEJBUUFBQUFXdkFRRUFBQUFCc0FFQkFBQUFBYkVCQVFBQUFBR3lBUUVBQUFBQnN3RUJBTzhCQUNHMEFRRUFBQUFCdFFFQkFBQUFBYllCQVFBQUFBRUhCQUFBNHdFQUlDRUFBTzRCQUNBaUFBRHVBUUFnckFFQUFBQ2lBUUt0QVFBQUFLSUJDSzRCQUFBQW9nRUlzd0VBQU8wQm9nRWlCd1FBQU9NQkFDQWhBQURzQVFBZ0lnQUE3QUVBSUt3QkFBQUFwQUVDclFFQUFBQ2tBUWl1QVFBQUFLUUJDTE1CQUFEckFhUUJJZ2NFQUFEakFRQWdJUUFBNmdFQUlDSUFBT29CQUNDc0FRQUFBS1lCQXEwQkFBQUFwZ0VJcmdFQUFBQ21BUWl6QVFBQTZRR21BU0lGQkFBQTR3RUFJQ0VBQU9nQkFDQWlBQURvQVFBZ3JBRWdBQUFBQWJNQklBRG5BUUFoRFFRQUFPTUJBQ0FoQUFEakFRQWdJZ0FBNHdFQUlETUFBT1lCQUNBMEFBRGpBUUFnckFFQ0FBQUFBYTBCQWdBQUFBU3VBUUlBQUFBRXJ3RUNBQUFBQWJBQkFnQUFBQUd4QVFJQUFBQUJzZ0VDQUFBQUFiTUJBZ0RsQVFBaEN3UUFBT01CQUNBaEFBRGtBUUFnSWdBQTVBRUFJS3dCUUFBQUFBR3RBVUFBQUFBRXJnRkFBQUFBQks4QlFBQUFBQUd3QVVBQUFBQUJzUUZBQUFBQUFiSUJRQUFBQUFHekFVQUE0Z0VBSVFzRUFBRGpBUUFnSVFBQTVBRUFJQ0lBQU9RQkFDQ3NBVUFBQUFBQnJRRkFBQUFBQks0QlFBQUFBQVN2QVVBQUFBQUJzQUZBQUFBQUFiRUJRQUFBQUFHeUFVQUFBQUFCc3dGQUFPSUJBQ0VJckFFQ0FBQUFBYTBCQWdBQUFBU3VBUUlBQUFBRXJ3RUNBQUFBQWJBQkFnQUFBQUd4QVFJQUFBQUJzZ0VDQUFBQUFiTUJBZ0RqQVFBaENLd0JRQUFBQUFHdEFVQUFBQUFFcmdGQUFBQUFCSzhCUUFBQUFBR3dBVUFBQUFBQnNRRkFBQUFBQWJJQlFBQUFBQUd6QVVBQTVBRUFJUTBFQUFEakFRQWdJUUFBNHdFQUlDSUFBT01CQUNBekFBRG1BUUFnTkFBQTR3RUFJS3dCQWdBQUFBR3RBUUlBQUFBRXJnRUNBQUFBQks4QkFnQUFBQUd3QVFJQUFBQUJzUUVDQUFBQUFiSUJBZ0FBQUFHekFRSUE1UUVBSVFpc0FRZ0FBQUFCclFFSUFBQUFCSzRCQ0FBQUFBU3ZBUWdBQUFBQnNBRUlBQUFBQWJFQkNBQUFBQUd5QVFnQUFBQUJzd0VJQU9ZQkFDRUZCQUFBNHdFQUlDRUFBT2dCQUNBaUFBRG9BUUFnckFFZ0FBQUFBYk1CSUFEbkFRQWhBcXdCSUFBQUFBR3pBU0FBNkFFQUlRY0VBQURqQVFBZ0lRQUE2Z0VBSUNJQUFPb0JBQ0NzQVFBQUFLWUJBcTBCQUFBQXBnRUlyZ0VBQUFDbUFRaXpBUUFBNlFHbUFTSUVyQUVBQUFDbUFRS3RBUUFBQUtZQkNLNEJBQUFBcGdFSXN3RUFBT29CcGdFaUJ3UUFBT01CQUNBaEFBRHNBUUFnSWdBQTdBRUFJS3dCQUFBQXBBRUNyUUVBQUFDa0FRaXVBUUFBQUtRQkNMTUJBQURyQWFRQklnU3NBUUFBQUtRQkFxMEJBQUFBcEFFSXJnRUFBQUNrQVFpekFRQUE3QUdrQVNJSEJBQUE0d0VBSUNFQUFPNEJBQ0FpQUFEdUFRQWdyQUVBQUFDaUFRS3RBUUFBQUtJQkNLNEJBQUFBb2dFSXN3RUFBTzBCb2dFaUJLd0JBQUFBb2dFQ3JRRUFBQUNpQVFpdUFRQUFBS0lCQ0xNQkFBRHVBYUlCSWc0RUFBRHdBUUFnSVFBQThRRUFJQ0lBQVBFQkFDQ3NBUUVBQUFBQnJRRUJBQUFBQmE0QkFRQUFBQVd2QVFFQUFBQUJzQUVCQUFBQUFiRUJBUUFBQUFHeUFRRUFBQUFCc3dFQkFPOEJBQ0cwQVFFQUFBQUJ0UUVCQUFBQUFiWUJBUUFBQUFFSXJBRUNBQUFBQWEwQkFnQUFBQVd1QVFJQUFBQUZyd0VDQUFBQUFiQUJBZ0FBQUFHeEFRSUFBQUFCc2dFQ0FBQUFBYk1CQWdEd0FRQWhDNndCQVFBQUFBR3RBUUVBQUFBRnJnRUJBQUFBQmE4QkFRQUFBQUd3QVFFQUFBQUJzUUVCQUFBQUFiSUJBUUFBQUFHekFRRUE4UUVBSWJRQkFRQUFBQUcxQVFFQUFBQUJ0Z0VCQUFBQUFRNEVBQURqQVFBZ0lRQUE4d0VBSUNJQUFQTUJBQ0NzQVFFQUFBQUJyUUVCQUFBQUJLNEJBUUFBQUFTdkFRRUFBQUFCc0FFQkFBQUFBYkVCQVFBQUFBR3lBUUVBQUFBQnN3RUJBUElCQUNHMEFRRUFBQUFCdFFFQkFBQUFBYllCQVFBQUFBRUxyQUVCQUFBQUFhMEJBUUFBQUFTdUFRRUFBQUFFcndFQkFBQUFBYkFCQVFBQUFBR3hBUUVBQUFBQnNnRUJBQUFBQWJNQkFRRHpBUUFodEFFQkFBQUFBYlVCQVFBQUFBRzJBUUVBQUFBQkZnTUFBUDBCQUNBTEFBRC1BUUFnREFBQV93RUFJQTBBQUlBQ0FDQ1hBUUFBOUFFQU1KZ0JBQUREQVFBUW1RRUFBUFFCQURDYUFRRUE5UUVBSVpzQkFRRDFBUUFobkFFQkFQVUJBQ0dkQVFFQTlnRUFJWjRCQVFEMkFRQWhud0VCQVBZQkFDR2dBUUVBOWdFQUlhSUJBQUQzQWFJQklxUUJBQUQ0QWFRQklxWUJBQUQ1QWFZQklxY0JJQUQ2QVFBaHFBRWdBUG9CQUNHcEFRSUEtd0VBSWFvQlFBRDhBUUFocXdGQUFQd0JBQ0VMckFFQkFBQUFBYTBCQVFBQUFBU3VBUUVBQUFBRXJ3RUJBQUFBQWJBQkFRQUFBQUd4QVFFQUFBQUJzZ0VCQUFBQUFiTUJBUUR6QVFBaHRBRUJBQUFBQWJVQkFRQUFBQUcyQVFFQUFBQUJDNndCQVFBQUFBR3RBUUVBQUFBRnJnRUJBQUFBQmE4QkFRQUFBQUd3QVFFQUFBQUJzUUVCQUFBQUFiSUJBUUFBQUFHekFRRUE4UUVBSWJRQkFRQUFBQUcxQVFFQUFBQUJ0Z0VCQUFBQUFRU3NBUUFBQUtJQkFxMEJBQUFBb2dFSXJnRUFBQUNpQVFpekFRQUE3Z0dpQVNJRXJBRUFBQUNrQVFLdEFRQUFBS1FCQ0s0QkFBQUFwQUVJc3dFQUFPd0JwQUVpQkt3QkFBQUFwZ0VDclFFQUFBQ21BUWl1QVFBQUFLWUJDTE1CQUFEcUFhWUJJZ0tzQVNBQUFBQUJzd0VnQU9nQkFDRUlyQUVDQUFBQUFhMEJBZ0FBQUFTdUFRSUFBQUFFcndFQ0FBQUFBYkFCQWdBQUFBR3hBUUlBQUFBQnNnRUNBQUFBQWJNQkFnRGpBUUFoQ0t3QlFBQUFBQUd0QVVBQUFBQUVyZ0ZBQUFBQUJLOEJRQUFBQUFHd0FVQUFBQUFCc1FGQUFBQUFBYklCUUFBQUFBR3pBVUFBNUFFQUlRTzNBUUFBQXdBZ3VBRUFBQU1BSUxrQkFBQURBQ0FEdHdFQUFBa0FJTGdCQUFBSkFDQzVBUUFBQ1FBZ0E3Y0JBQUFTQUNDNEFRQUFFZ0FndVFFQUFCSUFJQU8zQVFBQUdnQWd1QUVBQUJvQUlMa0JBQUFhQUNBU2x3RUFBSUVDQURDWUFRQUF2UUVBRUprQkFBQ0JBZ0F3bWdFQkFOb0JBQ0drQVFBQWhRTERBU0tvQVNBQTN3RUFJYW9CUUFEaEFRQWhxd0ZBQU9FQkFDRzZBUUVBMmdFQUlic0JBUURhQVFBaHZBRUJBTm9CQUNHOUFRRUEyZ0VBSWI0QkVBQ0NBZ0FodndFQ0FPQUJBQ0hBQVFnQWd3SUFJY0VCQUFDRUFnQWd3d0VCQU5vQkFDSEVBUUVBMmdFQUlRMEVBQURqQVFBZ0lRQUFpZ0lBSUNJQUFJb0NBQ0F6QUFDS0FnQWdOQUFBaWdJQUlLd0JFQUFBQUFHdEFSQUFBQUFFcmdFUUFBQUFCSzhCRUFBQUFBR3dBUkFBQUFBQnNRRVFBQUFBQWJJQkVBQUFBQUd6QVJBQWlRSUFJUTBFQUFEakFRQWdJUUFBNWdFQUlDSUFBT1lCQUNBekFBRG1BUUFnTkFBQTVnRUFJS3dCQ0FBQUFBR3RBUWdBQUFBRXJnRUlBQUFBQks4QkNBQUFBQUd3QVFnQUFBQUJzUUVJQUFBQUFiSUJDQUFBQUFHekFRZ0FpQUlBSVFTc0FRRUFBQUFGeFFFQkFBQUFBY1lCQVFBQUFBVEhBUUVBQUFBRUJ3UUFBT01CQUNBaEFBQ0hBZ0FnSWdBQWh3SUFJS3dCQUFBQXd3RUNyUUVBQUFEREFRaXVBUUFBQU1NQkNMTUJBQUNHQXNNQklnY0VBQURqQVFBZ0lRQUFod0lBSUNJQUFJY0NBQ0NzQVFBQUFNTUJBcTBCQUFBQXd3RUlyZ0VBQUFEREFRaXpBUUFBaGdMREFTSUVyQUVBQUFEREFRS3RBUUFBQU1NQkNLNEJBQUFBd3dFSXN3RUFBSWNDd3dFaURRUUFBT01CQUNBaEFBRG1BUUFnSWdBQTVnRUFJRE1BQU9ZQkFDQTBBQURtQVFBZ3JBRUlBQUFBQWEwQkNBQUFBQVN1QVFnQUFBQUVyd0VJQUFBQUFiQUJDQUFBQUFHeEFRZ0FBQUFCc2dFSUFBQUFBYk1CQ0FDSUFnQWhEUVFBQU9NQkFDQWhBQUNLQWdBZ0lnQUFpZ0lBSURNQUFJb0NBQ0EwQUFDS0FnQWdyQUVRQUFBQUFhMEJFQUFBQUFTdUFSQUFBQUFFcndFUUFBQUFBYkFCRUFBQUFBR3hBUkFBQUFBQnNnRVFBQUFBQWJNQkVBQ0pBZ0FoQ0t3QkVBQUFBQUd0QVJBQUFBQUVyZ0VRQUFBQUJLOEJFQUFBQUFHd0FSQUFBQUFCc1FFUUFBQUFBYklCRUFBQUFBR3pBUkFBaWdJQUlRcVhBUUFBaXdJQU1KZ0JBQUNuQVFBUW1RRUFBSXNDQURDYUFRRUEyZ0VBSWFvQlFBRGhBUUFocXdGQUFPRUJBQ0hBQVFJQTRBRUFJY2dCQVFEYUFRQWh5UUVCQU5vQkFDSEtBUUVBMmdFQUlST1hBUUFBakFJQU1KZ0JBQUNSQVFBUW1RRUFBSXdDQURDYUFRRUEyZ0VBSWFRQkFBQ05BdEVCSXFvQlFBRGhBUUFocXdGQUFPRUJBQ0hMQVFFQTJnRUFJY3dCQVFEYUFRQWh6UUVCQU5zQkFDSE9BUkFBZ2dJQUljOEJBUURhQVFBaDBRRUJBTnNCQUNIU0FRRUEyd0VBSWRNQkFRRGJBUUFoMUFFQkFOc0JBQ0hWQVVBQWpnSUFJZFlCQVFEYkFRQWgxd0ZBQUk0Q0FDRUhCQUFBNHdFQUlDRUFBSklDQUNBaUFBQ1NBZ0FnckFFQUFBRFJBUUt0QVFBQUFORUJDSzRCQUFBQTBRRUlzd0VBQUpFQzBRRWlDd1FBQVBBQkFDQWhBQUNRQWdBZ0lnQUFrQUlBSUt3QlFBQUFBQUd0QVVBQUFBQUZyZ0ZBQUFBQUJhOEJRQUFBQUFHd0FVQUFBQUFCc1FGQUFBQUFBYklCUUFBQUFBR3pBVUFBandJQUlRc0VBQUR3QVFBZ0lRQUFrQUlBSUNJQUFKQUNBQ0NzQVVBQUFBQUJyUUZBQUFBQUJhNEJRQUFBQUFXdkFVQUFBQUFCc0FGQUFBQUFBYkVCUUFBQUFBR3lBVUFBQUFBQnN3RkFBSThDQUNFSXJBRkFBQUFBQWEwQlFBQUFBQVd1QVVBQUFBQUZyd0ZBQUFBQUFiQUJRQUFBQUFHeEFVQUFBQUFCc2dGQUFBQUFBYk1CUUFDUUFnQWhCd1FBQU9NQkFDQWhBQUNTQWdBZ0lnQUFrZ0lBSUt3QkFBQUEwUUVDclFFQUFBRFJBUWl1QVFBQUFORUJDTE1CQUFDUkF0RUJJZ1NzQVFBQUFORUJBcTBCQUFBQTBRRUlyZ0VBQUFEUkFRaXpBUUFBa2dMUkFTSUxsd0VBQUpNQ0FEQ1lBUUFBZXdBUW1RRUFBSk1DQURDYUFRRUEyZ0VBSVpzQkFRRGFBUUFobkFFQkFOb0JBQ0dxQVVBQTRRRUFJYXNCUUFEaEFRQWgyQUVCQU5vQkFDSFpBUUVBMmdFQUlkb0JJQURmQVFBaEM1Y0JBQUNVQWdBd21BRUFBR2dBRUprQkFBQ1VBZ0F3bWdFQkFQVUJBQ0diQVFFQTlRRUFJWndCQVFEMUFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlkZ0JBUUQxQVFBaDJRRUJBUFVCQUNIYUFTQUEtZ0VBSVFpWEFRQUFsUUlBTUpnQkFBQmlBQkNaQVFBQWxRSUFNSm9CQVFEYUFRQWhtd0VCQU5vQkFDR3FBVUFBNFFFQUlhc0JRQURoQVFBaHV3RUJBTm9CQUNFSkF3QUFfUUVBSUpjQkFBQ1dBZ0F3bUFFQUFFOEFFSmtCQUFDV0FnQXdtZ0VCQVBVQkFDR2JBUUVBOVFFQUlhb0JRQUQ4QVFBaHF3RkFBUHdCQUNHN0FRRUE5UUVBSVF5WEFRQUFsd0lBTUpnQkFBQkpBQkNaQVFBQWx3SUFNSm9CQVFEYUFRQWhwQUVBQUpnQzN3RWlxZ0ZBQU9FQkFDR3JBVUFBNFFFQUlja0JBUURhQVFBaHlnRUJBTm9CQUNIYkFVQUE0UUVBSWR3QkFnRGdBUUFoM1FFUUFJSUNBQ0VIQkFBQTR3RUFJQ0VBQUpvQ0FDQWlBQUNhQWdBZ3JBRUFBQURmQVFLdEFRQUFBTjhCQ0s0QkFBQUEzd0VJc3dFQUFKa0Mzd0VpQndRQUFPTUJBQ0FoQUFDYUFnQWdJZ0FBbWdJQUlLd0JBQUFBM3dFQ3JRRUFBQURmQVFpdUFRQUFBTjhCQ0xNQkFBQ1pBdDhCSWdTc0FRQUFBTjhCQXEwQkFBQUEzd0VJcmdFQUFBRGZBUWl6QVFBQW1nTGZBU0lPbHdFQUFKc0NBRENZQVFBQU13QVFtUUVBQUpzQ0FEQ2FBUUVBMmdFQUlhUUJBQUNjQXVNQklxZ0JJQURmQVFBaHFnRkFBT0VCQUNHckFVQUE0UUVBSWJvQkFRRGFBUUFodXdFQkFOb0JBQ0hmQVFFQTJnRUFJZUFCQVFEYUFRQWg0UUVCQU5vQkFDSGpBUUVBMmdFQUlRY0VBQURqQVFBZ0lRQUFuZ0lBSUNJQUFKNENBQ0NzQVFBQUFPTUJBcTBCQUFBQTR3RUlyZ0VBQUFEakFRaXpBUUFBblFMakFTSUhCQUFBNHdFQUlDRUFBSjRDQUNBaUFBQ2VBZ0FnckFFQUFBRGpBUUt0QVFBQUFPTUJDSzRCQUFBQTR3RUlzd0VBQUowQzR3RWlCS3dCQUFBQTR3RUNyUUVBQUFEakFRaXVBUUFBQU9NQkNMTUJBQUNlQXVNQklnOE9BQUNoQWdBZ2x3RUFBSjhDQURDWUFRQUFHZ0FRbVFFQUFKOENBRENhQVFFQTlRRUFJYVFCQUFDZ0F1TUJJcWdCSUFENkFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlib0JBUUQxQVFBaHV3RUJBUFVCQUNIZkFRRUE5UUVBSWVBQkFRRDFBUUFoNFFFQkFQVUJBQ0hqQVFFQTlRRUFJUVNzQVFBQUFPTUJBcTBCQUFBQTR3RUlyZ0VBQUFEakFRaXpBUUFBbmdMakFTSVlBd0FBX1FFQUlBc0FBUDRCQUNBTUFBRF9BUUFnRFFBQWdBSUFJSmNCQUFEMEFRQXdtQUVBQU1NQkFCQ1pBUUFBOUFFQU1Kb0JBUUQxQVFBaG13RUJBUFVCQUNHY0FRRUE5UUVBSVowQkFRRDJBUUFobmdFQkFQWUJBQ0dmQVFFQTlnRUFJYUFCQVFEMkFRQWhvZ0VBQVBjQm9nRWlwQUVBQVBnQnBBRWlwZ0VBQVBrQnBnRWlwd0VnQVBvQkFDR29BU0FBLWdFQUlha0JBZ0Q3QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWVVQkFBRERBUUFnNWdFQUFNTUJBQ0FDeVFFQkFBQUFBY29CQVFBQUFBRU1Cd0FBb1FJQUlBZ0FBS1FDQUNDWEFRQUFvd0lBTUpnQkFBQVNBQkNaQVFBQW93SUFNSm9CQVFEMUFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUljQUJBZ0Q3QVFBaHlBRUJBUFVCQUNISkFRRUE5UUVBSWNvQkFRRDFBUUFoR0FVQUFMQUNBQ0FHQUFDaEFnQWdDd0FBX2dFQUlBd0FBUDhCQUNDWEFRQUFyUUlBTUpnQkFBQURBQkNaQVFBQXJRSUFNSm9CQVFEMUFRQWhwQUVBQUs4Q3d3RWlxQUVnQVBvQkFDR3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHVnRUJBUFVCQUNHN0FRRUE5UUVBSWJ3QkFRRDFBUUFodlFFQkFQVUJBQ0ctQVJBQXBnSUFJYjhCQWdEN0FRQWh3QUVJQUs0Q0FDSEJBUUFBaEFJQUlNTUJBUUQxQVFBaHhBRUJBUFVCQUNIbEFRQUFBd0FnNWdFQUFBTUFJQlFKQUFDcEFnQWdsd0VBQUtVQ0FEQ1lBUUFBRFFBUW1RRUFBS1VDQURDYUFRRUE5UUVBSWFRQkFBQ25BdEVCSXFvQlFBRDhBUUFocXdGQUFQd0JBQ0hMQVFFQTlRRUFJY3dCQVFEMUFRQWh6UUVCQVBZQkFDSE9BUkFBcGdJQUljOEJBUUQxQVFBaDBRRUJBUFlCQUNIU0FRRUE5Z0VBSWRNQkFRRDJBUUFoMUFFQkFQWUJBQ0hWQVVBQXFBSUFJZFlCQVFEMkFRQWgxd0ZBQUtnQ0FDRUlyQUVRQUFBQUFhMEJFQUFBQUFTdUFSQUFBQUFFcndFUUFBQUFBYkFCRUFBQUFBR3hBUkFBQUFBQnNnRVFBQUFBQWJNQkVBQ0tBZ0FoQkt3QkFBQUEwUUVDclFFQUFBRFJBUWl1QVFBQUFORUJDTE1CQUFDU0F0RUJJZ2lzQVVBQUFBQUJyUUZBQUFBQUJhNEJRQUFBQUFXdkFVQUFBQUFCc0FGQUFBQUFBYkVCUUFBQUFBR3lBVUFBQUFBQnN3RkFBSkFDQUNFUkJ3QUFvUUlBSUFnQUFLUUNBQ0FLQUFDc0FnQWdsd0VBQUtvQ0FEQ1lBUUFBQ1FBUW1RRUFBS29DQURDYUFRRUE5UUVBSWFRQkFBQ3JBdDhCSXFvQlFBRDhBUUFocXdGQUFQd0JBQ0hKQVFFQTlRRUFJY29CQVFEMUFRQWgyd0ZBQVB3QkFDSGNBUUlBLXdFQUlkMEJFQUNtQWdBaDVRRUFBQWtBSU9ZQkFBQUpBQ0FQQndBQW9RSUFJQWdBQUtRQ0FDQUtBQUNzQWdBZ2x3RUFBS29DQURDWUFRQUFDUUFRbVFFQUFLb0NBRENhQVFFQTlRRUFJYVFCQUFDckF0OEJJcW9CUUFEOEFRQWhxd0ZBQVB3QkFDSEpBUUVBOVFFQUljb0JBUUQxQVFBaDJ3RkFBUHdCQUNIY0FRSUEtd0VBSWQwQkVBQ21BZ0FoQkt3QkFBQUEzd0VDclFFQUFBRGZBUWl1QVFBQUFOOEJDTE1CQUFDYUF0OEJJZ08zQVFBQURRQWd1QUVBQUEwQUlMa0JBQUFOQUNBV0JRQUFzQUlBSUFZQUFLRUNBQ0FMQUFELUFRQWdEQUFBX3dFQUlKY0JBQUN0QWdBd21BRUFBQU1BRUprQkFBQ3RBZ0F3bWdFQkFQVUJBQ0drQVFBQXJ3TERBU0tvQVNBQS1nRUFJYW9CUUFEOEFRQWhxd0ZBQVB3QkFDRzZBUUVBOVFFQUlic0JBUUQxQVFBaHZBRUJBUFVCQUNHOUFRRUE5UUVBSWI0QkVBQ21BZ0FodndFQ0FQc0JBQ0hBQVFnQXJnSUFJY0VCQUFDRUFnQWd3d0VCQVBVQkFDSEVBUUVBOVFFQUlRaXNBUWdBQUFBQnJRRUlBQUFBQks0QkNBQUFBQVN2QVFnQUFBQUJzQUVJQUFBQUFiRUJDQUFBQUFHeUFRZ0FBQUFCc3dFSUFPWUJBQ0VFckFFQUFBRERBUUt0QVFBQUFNTUJDSzRCQUFBQXd3RUlzd0VBQUljQ3d3RWlDd01BQVAwQkFDQ1hBUUFBbGdJQU1KZ0JBQUJQQUJDWkFRQUFsZ0lBTUpvQkFRRDFBUUFobXdFQkFQVUJBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWh1d0VCQVBVQkFDSGxBUUFBVHdBZzVnRUFBRThBSUFBQUFBQUFBQUhxQVFFQUFBQUJBZW9CQVFBQUFBRUI2Z0VBQUFDaUFRSUI2Z0VBQUFDa0FRSUI2Z0VBQUFDbUFRSUI2Z0VnQUFBQUFRWHFBUUlBQUFBQjhRRUNBQUFBQWZJQkFnQUFBQUh6QVFJQUFBQUI5QUVDQUFBQUFRSHFBVUFBQUFBQkN4c0FBUDRDQURBY0FBQ0RBd0F3NXdFQUFQOENBRERvQVFBQWdBTUFNT2tCQUFDQkF3QWc2Z0VBQUlJREFERHJBUUFBZ2dNQU1Pd0JBQUNDQXdBdzdRRUFBSUlEQUREdUFRQUFoQU1BTU84QkFBQ0ZBd0F3Q3hzQUFONENBREFjQUFEakFnQXc1d0VBQU44Q0FERG9BUUFBNEFJQU1Pa0JBQURoQWdBZzZnRUFBT0lDQUREckFRQUE0Z0lBTU93QkFBRGlBZ0F3N1FFQUFPSUNBRER1QVFBQTVBSUFNTzhCQUFEbEFnQXdDeHNBQU5BQ0FEQWNBQURWQWdBdzV3RUFBTkVDQUREb0FRQUEwZ0lBTU9rQkFBRFRBZ0FnNmdFQUFOUUNBRERyQVFBQTFBSUFNT3dCQUFEVUFnQXc3UUVBQU5RQ0FERHVBUUFBMWdJQU1POEJBQURYQWdBd0N4c0FBTU1DQURBY0FBRElBZ0F3NXdFQUFNUUNBRERvQVFBQXhRSUFNT2tCQUFER0FnQWc2Z0VBQU1jQ0FERHJBUUFBeHdJQU1Pd0JBQURIQWdBdzdRRUFBTWNDQUREdUFRQUF5UUlBTU84QkFBREtBZ0F3Q3BvQkFRQUFBQUdrQVFBQUFPTUJBcWdCSUFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWJvQkFRQUFBQUc3QVFFQUFBQUIzd0VCQUFBQUFlQUJBUUFBQUFIaEFRRUFBQUFCQWdBQUFBRUFJQnNBQU04Q0FDQURBQUFBQVFBZ0d3QUF6d0lBSUJ3QUFNNENBQ0FCRkFBQWxBUUFNQThPQUFDaEFnQWdsd0VBQUo4Q0FEQ1lBUUFBR2dBUW1RRUFBSjhDQURDYUFRRUFBQUFCcEFFQUFLQUM0d0VpcUFFZ0FQb0JBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWh1Z0VCQVBVQkFDRzdBUUVBQUFBQjN3RUJBUFVCQUNIZ0FRRUE5UUVBSWVFQkFRRDFBUUFoNHdFQkFQVUJBQ0VDQUFBQUFRQWdGQUFBemdJQUlBSUFBQURMQWdBZ0ZBQUF6QUlBSUE2WEFRQUF5Z0lBTUpnQkFBRExBZ0FRbVFFQUFNb0NBRENhQVFFQTlRRUFJYVFCQUFDZ0F1TUJJcWdCSUFENkFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlib0JBUUQxQVFBaHV3RUJBUFVCQUNIZkFRRUE5UUVBSWVBQkFRRDFBUUFoNFFFQkFQVUJBQ0hqQVFFQTlRRUFJUTZYQVFBQXlnSUFNSmdCQUFETEFnQVFtUUVBQU1vQ0FEQ2FBUUVBOVFFQUlhUUJBQUNnQXVNQklxZ0JJQUQ2QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJvQkFRRDFBUUFodXdFQkFQVUJBQ0hmQVFFQTlRRUFJZUFCQVFEMUFRQWg0UUVCQVBVQkFDSGpBUUVBOVFFQUlRcWFBUUVBdHdJQUlhUUJBQUROQXVNQklxZ0JJQUM4QWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSWJvQkFRQzNBZ0FodXdFQkFMY0NBQ0hmQVFFQXR3SUFJZUFCQVFDM0FnQWg0UUVCQUxjQ0FDRUI2Z0VBQUFEakFRSUttZ0VCQUxjQ0FDR2tBUUFBelFMakFTS29BU0FBdkFJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNHNkFRRUF0d0lBSWJzQkFRQzNBZ0FoM3dFQkFMY0NBQ0hnQVFFQXR3SUFJZUVCQVFDM0FnQWhDcG9CQVFBQUFBR2tBUUFBQU9NQkFxZ0JJQUFBQUFHcUFVQUFBQUFCcXdGQUFBQUFBYm9CQVFBQUFBRzdBUUVBQUFBQjN3RUJBQUFBQWVBQkFRQUFBQUhoQVFFQUFBQUJCd2dBQU4wQ0FDQ2FBUUVBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUhBQVFJQUFBQUJ5QUVCQUFBQUFjb0JBUUFBQUFFQ0FBQUFGQUFnR3dBQTNBSUFJQU1BQUFBVUFDQWJBQURjQWdBZ0hBQUEyZ0lBSUFFVUFBQ1RCQUF3RFFjQUFLRUNBQ0FJQUFDa0FnQWdsd0VBQUtNQ0FEQ1lBUUFBRWdBUW1RRUFBS01DQURDYUFRRUFBQUFCcWdGQUFQd0JBQ0dyQVVBQV9BRUFJY0FCQWdEN0FRQWh5QUVCQVBVQkFDSEpBUUVBOVFFQUljb0JBUUQxQVFBaDVBRUFBS0lDQUNBQ0FBQUFGQUFnRkFBQTJnSUFJQUlBQUFEWUFnQWdGQUFBMlFJQUlBcVhBUUFBMXdJQU1KZ0JBQURZQWdBUW1RRUFBTmNDQURDYUFRRUE5UUVBSWFvQlFBRDhBUUFocXdGQUFQd0JBQ0hBQVFJQS13RUFJY2dCQVFEMUFRQWh5UUVCQVBVQkFDSEtBUUVBOVFFQUlRcVhBUUFBMXdJQU1KZ0JBQURZQWdBUW1RRUFBTmNDQURDYUFRRUE5UUVBSWFvQlFBRDhBUUFocXdGQUFQd0JBQ0hBQVFJQS13RUFJY2dCQVFEMUFRQWh5UUVCQVBVQkFDSEtBUUVBOVFFQUlRYWFBUUVBdHdJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNIQUFRSUF2UUlBSWNnQkFRQzNBZ0FoeWdFQkFMY0NBQ0VIQ0FBQTJ3SUFJSm9CQVFDM0FnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljQUJBZ0M5QWdBaHlBRUJBTGNDQUNIS0FRRUF0d0lBSVFVYkFBQ09CQUFnSEFBQWtRUUFJT2NCQUFDUEJBQWc2QUVBQUpBRUFDRHRBUUFBQlFBZ0J3Z0FBTjBDQUNDYUFRRUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBSEFBUUlBQUFBQnlBRUJBQUFBQWNvQkFRQUFBQUVER3dBQWpnUUFJT2NCQUFDUEJBQWc3UUVBQUFVQUlBb0lBQUQ4QWdBZ0NnQUFfUUlBSUpvQkFRQUFBQUdrQVFBQUFOOEJBcW9CUUFBQUFBR3JBVUFBQUFBQnlnRUJBQUFBQWRzQlFBQUFBQUhjQVFJQUFBQUIzUUVRQUFBQUFRSUFBQUFMQUNBYkFBRDdBZ0FnQXdBQUFBc0FJQnNBQVBzQ0FDQWNBQURxQWdBZ0FSUUFBSTBFQURBUEJ3QUFvUUlBSUFnQUFLUUNBQ0FLQUFDc0FnQWdsd0VBQUtvQ0FEQ1lBUUFBQ1FBUW1RRUFBS29DQURDYUFRRUFBQUFCcEFFQUFLc0Mzd0VpcWdGQUFQd0JBQ0dyQVVBQV9BRUFJY2tCQVFEMUFRQWh5Z0VCQVBVQkFDSGJBVUFBX0FFQUlkd0JBZ0Q3QVFBaDNRRVFBS1lDQUNFQ0FBQUFDd0FnRkFBQTZnSUFJQUlBQUFEbUFnQWdGQUFBNXdJQUlBeVhBUUFBNVFJQU1KZ0JBQURtQWdBUW1RRUFBT1VDQURDYUFRRUE5UUVBSWFRQkFBQ3JBdDhCSXFvQlFBRDhBUUFocXdGQUFQd0JBQ0hKQVFFQTlRRUFJY29CQVFEMUFRQWgyd0ZBQVB3QkFDSGNBUUlBLXdFQUlkMEJFQUNtQWdBaERKY0JBQURsQWdBd21BRUFBT1lDQUJDWkFRQUE1UUlBTUpvQkFRRDFBUUFocEFFQUFLc0Mzd0VpcWdGQUFQd0JBQ0dyQVVBQV9BRUFJY2tCQVFEMUFRQWh5Z0VCQVBVQkFDSGJBVUFBX0FFQUlkd0JBZ0Q3QVFBaDNRRVFBS1lDQUNFSW1nRUJBTGNDQUNHa0FRQUE2UUxmQVNLcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoeWdFQkFMY0NBQ0hiQVVBQXZnSUFJZHdCQWdDOUFnQWgzUUVRQU9nQ0FDRUY2Z0VRQUFBQUFmRUJFQUFBQUFIeUFSQUFBQUFCOHdFUUFBQUFBZlFCRUFBQUFBRUI2Z0VBQUFEZkFRSUtDQUFBNndJQUlBb0FBT3dDQUNDYUFRRUF0d0lBSWFRQkFBRHBBdDhCSXFvQlFBQy1BZ0FocXdGQUFMNENBQ0hLQVFFQXR3SUFJZHNCUUFDLUFnQWgzQUVDQUwwQ0FDSGRBUkFBNkFJQUlRVWJBQUNIQkFBZ0hBQUFpd1FBSU9jQkFBQ0lCQUFnNkFFQUFJb0VBQ0R0QVFBQUJRQWdDeHNBQU8wQ0FEQWNBQUR5QWdBdzV3RUFBTzRDQUREb0FRQUE3d0lBTU9rQkFBRHdBZ0FnNmdFQUFQRUNBRERyQVFBQThRSUFNT3dCQUFEeEFnQXc3UUVBQVBFQ0FERHVBUUFBOHdJQU1POEJBQUQwQWdBd0Q1b0JBUUFBQUFHa0FRQUFBTkVCQXFvQlFBQUFBQUdyQVVBQUFBQUJ6QUVCQUFBQUFjMEJBUUFBQUFIT0FSQUFBQUFCendFQkFBQUFBZEVCQVFBQUFBSFNBUUVBQUFBQjB3RUJBQUFBQWRRQkFRQUFBQUhWQVVBQUFBQUIxZ0VCQUFBQUFkY0JRQUFBQUFFQ0FBQUFEd0FnR3dBQS1nSUFJQU1BQUFBUEFDQWJBQUQ2QWdBZ0hBQUEtUUlBSUFFVUFBQ0pCQUF3RkFrQUFLa0NBQ0NYQVFBQXBRSUFNSmdCQUFBTkFCQ1pBUUFBcFFJQU1Kb0JBUUFBQUFHa0FRQUFwd0xSQVNLcUFVQUFfQUVBSWFzQlFBRDhBUUFoeXdFQkFQVUJBQ0hNQVFFQUFBQUJ6UUVCQVBZQkFDSE9BUkFBcGdJQUljOEJBUUQxQVFBaDBRRUJBUFlCQUNIU0FRRUE5Z0VBSWRNQkFRRDJBUUFoMUFFQkFQWUJBQ0hWQVVBQXFBSUFJZFlCQVFEMkFRQWgxd0ZBQUtnQ0FDRUNBQUFBRHdBZ0ZBQUEtUUlBSUFJQUFBRDFBZ0FnRkFBQTlnSUFJQk9YQVFBQTlBSUFNSmdCQUFEMUFnQVFtUUVBQVBRQ0FEQ2FBUUVBOVFFQUlhUUJBQUNuQXRFQklxb0JRQUQ4QVFBaHF3RkFBUHdCQUNITEFRRUE5UUVBSWN3QkFRRDFBUUFoelFFQkFQWUJBQ0hPQVJBQXBnSUFJYzhCQVFEMUFRQWgwUUVCQVBZQkFDSFNBUUVBOWdFQUlkTUJBUUQyQVFBaDFBRUJBUFlCQUNIVkFVQUFxQUlBSWRZQkFRRDJBUUFoMXdGQUFLZ0NBQ0VUbHdFQUFQUUNBRENZQVFBQTlRSUFFSmtCQUFEMEFnQXdtZ0VCQVBVQkFDR2tBUUFBcHdMUkFTS3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHl3RUJBUFVCQUNITUFRRUE5UUVBSWMwQkFRRDJBUUFoemdFUUFLWUNBQ0hQQVFFQTlRRUFJZEVCQVFEMkFRQWgwZ0VCQVBZQkFDSFRBUUVBOWdFQUlkUUJBUUQyQVFBaDFRRkFBS2dDQUNIV0FRRUE5Z0VBSWRjQlFBQ29BZ0FoRDVvQkFRQzNBZ0FocEFFQUFQY0MwUUVpcWdGQUFMNENBQ0dyQVVBQXZnSUFJY3dCQVFDM0FnQWh6UUVCQUxnQ0FDSE9BUkFBNkFJQUljOEJBUUMzQWdBaDBRRUJBTGdDQUNIU0FRRUF1QUlBSWRNQkFRQzRBZ0FoMUFFQkFMZ0NBQ0hWQVVBQS1BSUFJZFlCQVFDNEFnQWgxd0ZBQVBnQ0FDRUI2Z0VBQUFEUkFRSUI2Z0ZBQUFBQUFRLWFBUUVBdHdJQUlhUUJBQUQzQXRFQklxb0JRQUMtQWdBaHF3RkFBTDRDQUNITUFRRUF0d0lBSWMwQkFRQzRBZ0FoemdFUUFPZ0NBQ0hQQVFFQXR3SUFJZEVCQVFDNEFnQWgwZ0VCQUxnQ0FDSFRBUUVBdUFJQUlkUUJBUUM0QWdBaDFRRkFBUGdDQUNIV0FRRUF1QUlBSWRjQlFBRDRBZ0FoRDVvQkFRQUFBQUdrQVFBQUFORUJBcW9CUUFBQUFBR3JBVUFBQUFBQnpBRUJBQUFBQWMwQkFRQUFBQUhPQVJBQUFBQUJ6d0VCQUFBQUFkRUJBUUFBQUFIU0FRRUFBQUFCMHdFQkFBQUFBZFFCQVFBQUFBSFZBVUFBQUFBQjFnRUJBQUFBQWRjQlFBQUFBQUVLQ0FBQV9BSUFJQW9BQVAwQ0FDQ2FBUUVBQUFBQnBBRUFBQURmQVFLcUFVQUFBQUFCcXdGQUFBQUFBY29CQVFBQUFBSGJBVUFBQUFBQjNBRUNBQUFBQWQwQkVBQUFBQUVER3dBQWh3UUFJT2NCQUFDSUJBQWc3UUVBQUFVQUlBUWJBQUR0QWdBdzV3RUFBTzRDQUREcEFRQUE4QUlBSU8wQkFBRHhBZ0F3RVFVQUFLY0RBQ0FMQUFDb0F3QWdEQUFBcVFNQUlKb0JBUUFBQUFHa0FRQUFBTU1CQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCdkFFQkFBQUFBYjBCQVFBQUFBRy1BUkFBQUFBQnZ3RUNBQUFBQWNBQkNBQUFBQUhCQVFBQXBnTUFJTU1CQVFBQUFBRUNBQUFBQlFBZ0d3QUFwUU1BSUFNQUFBQUZBQ0FiQUFDbEF3QWdIQUFBaXdNQUlBRVVBQUNHQkFBd0ZnVUFBTEFDQUNBR0FBQ2hBZ0FnQ3dBQV9nRUFJQXdBQVA4QkFDQ1hBUUFBclFJQU1KZ0JBQUFEQUJDWkFRQUFyUUlBTUpvQkFRQUFBQUdrQVFBQXJ3TERBU0tvQVNBQS1nRUFJYW9CUUFEOEFRQWhxd0ZBQVB3QkFDRzZBUUVBOVFFQUlic0JBUUFBQUFHOEFRRUE5UUVBSWIwQkFRRDFBUUFodmdFUUFLWUNBQ0dfQVFJQS13RUFJY0FCQ0FDdUFnQWh3UUVBQUlRQ0FDRERBUUVBOVFFQUljUUJBUUQxQVFBaEFnQUFBQVVBSUJRQUFJc0RBQ0FDQUFBQWhnTUFJQlFBQUljREFDQVNsd0VBQUlVREFEQ1lBUUFBaGdNQUVKa0JBQUNGQXdBd21nRUJBUFVCQUNHa0FRQUFyd0xEQVNLb0FTQUEtZ0VBSWFvQlFBRDhBUUFocXdGQUFQd0JBQ0c2QVFFQTlRRUFJYnNCQVFEMUFRQWh2QUVCQVBVQkFDRzlBUUVBOVFFQUliNEJFQUNtQWdBaHZ3RUNBUHNCQUNIQUFRZ0FyZ0lBSWNFQkFBQ0VBZ0Fnd3dFQkFQVUJBQ0hFQVFFQTlRRUFJUktYQVFBQWhRTUFNSmdCQUFDR0F3QVFtUUVBQUlVREFEQ2FBUUVBOVFFQUlhUUJBQUN2QXNNQklxZ0JJQUQ2QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJvQkFRRDFBUUFodXdFQkFQVUJBQ0c4QVFFQTlRRUFJYjBCQVFEMUFRQWh2Z0VRQUtZQ0FDR19BUUlBLXdFQUljQUJDQUN1QWdBaHdRRUFBSVFDQUNEREFRRUE5UUVBSWNRQkFRRDFBUUFoRHBvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTU1CQVFDM0FnQWhCZW9CQ0FBQUFBSHhBUWdBQUFBQjhnRUlBQUFBQWZNQkNBQUFBQUgwQVFnQUFBQUJBdW9CQVFBQUFBVHdBUUVBQUFBRkFlb0JBQUFBd3dFQ0VRVUFBSXdEQUNBTEFBQ05Bd0FnREFBQWpnTUFJSm9CQVFDM0FnQWhwQUVBQUlvRHd3RWlxQUVnQUx3Q0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaHVnRUJBTGNDQUNHN0FRRUF0d0lBSWJ3QkFRQzNBZ0FodlFFQkFMY0NBQ0ctQVJBQTZBSUFJYjhCQWdDOUFnQWh3QUVJQUlnREFDSEJBUUFBaVFNQUlNTUJBUUMzQWdBaEJSc0FBUFVEQUNBY0FBQ0VCQUFnNXdFQUFQWURBQ0RvQVFBQWd3UUFJTzBCQUFCTUFDQUxHd0FBbWdNQU1Cd0FBSjREQUREbkFRQUFtd01BTU9nQkFBQ2NBd0F3NlFFQUFKMERBQ0RxQVFBQTRnSUFNT3NCQUFEaUFnQXc3QUVBQU9JQ0FERHRBUUFBNGdJQU1PNEJBQUNmQXdBdzd3RUFBT1VDQURBTEd3QUFqd01BTUJ3QUFKTURBRERuQVFBQWtBTUFNT2dCQUFDUkF3QXc2UUVBQUpJREFDRHFBUUFBMUFJQU1Pc0JBQURVQWdBdzdBRUFBTlFDQUREdEFRQUExQUlBTU80QkFBQ1VBd0F3N3dFQUFOY0NBREFIQndBQW1RTUFJSm9CQVFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWNBQkFnQUFBQUhJQVFFQUFBQUJ5UUVCQUFBQUFRSUFBQUFVQUNBYkFBQ1lBd0FnQXdBQUFCUUFJQnNBQUpnREFDQWNBQUNXQXdBZ0FSUUFBSUlFQURBQ0FBQUFGQUFnRkFBQWxnTUFJQUlBQUFEWUFnQWdGQUFBbFFNQUlBYWFBUUVBdHdJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNIQUFRSUF2UUlBSWNnQkFRQzNBZ0FoeVFFQkFMY0NBQ0VIQndBQWx3TUFJSm9CQVFDM0FnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljQUJBZ0M5QWdBaHlBRUJBTGNDQUNISkFRRUF0d0lBSVFVYkFBRDlBd0FnSEFBQWdBUUFJT2NCQUFELUF3QWc2QUVBQVA4REFDRHRBUUFBd0FFQUlBY0hBQUNaQXdBZ21nRUJBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJ3QUVDQUFBQUFjZ0JBUUFBQUFISkFRRUFBQUFCQXhzQUFQMERBQ0RuQVFBQV9nTUFJTzBCQUFEQUFRQWdDZ2NBQUtRREFDQUtBQUQ5QWdBZ21nRUJBQUFBQWFRQkFBQUEzd0VDcWdGQUFBQUFBYXNCUUFBQUFBSEpBUUVBQUFBQjJ3RkFBQUFBQWR3QkFnQUFBQUhkQVJBQUFBQUJBZ0FBQUFzQUlCc0FBS01EQUNBREFBQUFDd0FnR3dBQW93TUFJQndBQUtFREFDQUJGQUFBX0FNQU1BSUFBQUFMQUNBVUFBQ2hBd0FnQWdBQUFPWUNBQ0FVQUFDZ0F3QWdDSm9CQVFDM0FnQWhwQUVBQU9rQzN3RWlxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlja0JBUUMzQWdBaDJ3RkFBTDRDQUNIY0FRSUF2UUlBSWQwQkVBRG9BZ0FoQ2djQUFLSURBQ0FLQUFEc0FnQWdtZ0VCQUxjQ0FDR2tBUUFBNlFMZkFTS3FBVUFBdmdJQUlhc0JRQUMtQWdBaHlRRUJBTGNDQUNIYkFVQUF2Z0lBSWR3QkFnQzlBZ0FoM1FFUUFPZ0NBQ0VGR3dBQTl3TUFJQndBQVBvREFDRG5BUUFBLUFNQUlPZ0JBQUQ1QXdBZzdRRUFBTUFCQUNBS0J3QUFwQU1BSUFvQUFQMENBQ0NhQVFFQUFBQUJwQUVBQUFEZkFRS3FBVUFBQUFBQnF3RkFBQUFBQWNrQkFRQUFBQUhiQVVBQUFBQUIzQUVDQUFBQUFkMEJFQUFBQUFFREd3QUE5d01BSU9jQkFBRDRBd0FnN1FFQUFNQUJBQ0FSQlFBQXB3TUFJQXNBQUtnREFDQU1BQUNwQXdBZ21nRUJBQUFBQWFRQkFBQUF3d0VDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUc4QVFFQUFBQUJ2UUVCQUFBQUFiNEJFQUFBQUFHX0FRSUFBQUFCd0FFSUFBQUFBY0VCQUFDbUF3QWd3d0VCQUFBQUFRSHFBUUVBQUFBRUF4c0FBUFVEQUNEbkFRQUE5Z01BSU8wQkFBQk1BQ0FFR3dBQW1nTUFNT2NCQUFDYkF3QXc2UUVBQUowREFDRHRBUUFBNGdJQU1BUWJBQUNQQXdBdzV3RUFBSkFEQUREcEFRQUFrZ01BSU8wQkFBRFVBZ0F3QkJzQUFQNENBRERuQVFBQV93SUFNT2tCQUFDQkF3QWc3UUVBQUlJREFEQUVHd0FBM2dJQU1PY0JBQURmQWdBdzZRRUFBT0VDQUNEdEFRQUE0Z0lBTUFRYkFBRFFBZ0F3NXdFQUFORUNBRERwQVFBQTB3SUFJTzBCQUFEVUFnQXdCQnNBQU1NQ0FERG5BUUFBeEFJQU1Pa0JBQURHQWdBZzdRRUFBTWNDQURBQUFBQUFBQUFBQUFBRkd3QUE4QU1BSUJ3QUFQTURBQ0RuQVFBQThRTUFJT2dCQUFEeUF3QWc3UUVBQU1BQkFDQURHd0FBOEFNQUlPY0JBQUR4QXdBZzdRRUFBTUFCQUNBQUFBQUFBQUFBQUFBQUJSc0FBT3NEQUNBY0FBRHVBd0FnNXdFQUFPd0RBQ0RvQVFBQTdRTUFJTzBCQUFBTEFDQURHd0FBNndNQUlPY0JBQURzQXdBZzdRRUFBQXNBSUFBQUFBQUFBQXNiQUFETUF3QXdIQUFBMEFNQU1PY0JBQUROQXdBdzZBRUFBTTREQUREcEFRQUF6d01BSU9vQkFBQ0NBd0F3NndFQUFJSURBRERzQVFBQWdnTUFNTzBCQUFDQ0F3QXc3Z0VBQU5FREFERHZBUUFBaFFNQU1CRUdBQUM0QXdBZ0N3QUFxQU1BSUF3QUFLa0RBQ0NhQVFFQUFBQUJwQUVBQUFEREFRS29BU0FBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUc2QVFFQUFBQUJ1d0VCQUFBQUFid0JBUUFBQUFHOUFRRUFBQUFCdmdFUUFBQUFBYjhCQWdBQUFBSEFBUWdBQUFBQndRRUFBS1lEQUNERUFRRUFBQUFCQWdBQUFBVUFJQnNBQU5RREFDQURBQUFBQlFBZ0d3QUExQU1BSUJ3QUFOTURBQ0FCRkFBQTZnTUFNQUlBQUFBRkFDQVVBQURUQXdBZ0FnQUFBSVlEQUNBVUFBRFNBd0FnRHBvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTVFCQVFDM0FnQWhFUVlBQUxjREFDQUxBQUNOQXdBZ0RBQUFqZ01BSUpvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTVFCQVFDM0FnQWhFUVlBQUxnREFDQUxBQUNvQXdBZ0RBQUFxUU1BSUpvQkFRQUFBQUdrQVFBQUFNTUJBcWdCSUFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWJvQkFRQUFBQUc3QVFFQUFBQUJ2QUVCQUFBQUFiMEJBUUFBQUFHLUFSQUFBQUFCdndFQ0FBQUFBY0FCQ0FBQUFBSEJBUUFBcGdNQUlNUUJBUUFBQUFFRUd3QUF6QU1BTU9jQkFBRE5Bd0F3NlFFQUFNOERBQ0R0QVFBQWdnTUFNQUFBQUFBQUFBQUFCUnNBQU9VREFDQWNBQURvQXdBZzV3RUFBT1lEQUNEb0FRQUE1d01BSU8wQkFBREFBUUFnQXhzQUFPVURBQ0RuQVFBQTVnTUFJTzBCQUFEQUFRQWdDQU1BQUs0REFDQUxBQUN2QXdBZ0RBQUFzQU1BSUEwQUFMRURBQ0NkQVFBQXNRSUFJSjRCQUFDeEFnQWdud0VBQUxFQ0FDQ2dBUUFBc1FJQUlBUUZBQURrQXdBZ0JnQUE0QU1BSUFzQUFLOERBQ0FNQUFDd0F3QWdBd2NBQU9BREFDQUlBQURoQXdBZ0NnQUE0d01BSUFBQkF3QUFyZ01BSUJJREFBQ3FBd0FnQ3dBQXF3TUFJQXdBQUt3REFDQ2FBUUVBQUFBQm13RUJBQUFBQVp3QkFRQUFBQUdkQVFFQUFBQUJuZ0VCQUFBQUFaOEJBUUFBQUFHZ0FRRUFBQUFCb2dFQUFBQ2lBUUtrQVFBQUFLUUJBcVlCQUFBQXBnRUNwd0VnQUFBQUFhZ0JJQUFBQUFHcEFRSUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBRUNBQUFBd0FFQUlCc0FBT1VEQUNBREFBQUF3d0VBSUJzQUFPVURBQ0FjQUFEcEF3QWdGQUFBQU1NQkFDQURBQUNfQWdBZ0N3QUF3QUlBSUF3QUFNRUNBQ0FVQUFEcEF3QWdtZ0VCQUxjQ0FDR2JBUUVBdHdJQUlad0JBUUMzQWdBaG5RRUJBTGdDQUNHZUFRRUF1QUlBSVo4QkFRQzRBZ0Fob0FFQkFMZ0NBQ0dpQVFBQXVRS2lBU0trQVFBQXVnS2tBU0ttQVFBQXV3S21BU0tuQVNBQXZBSUFJYWdCSUFDOEFnQWhxUUVDQUwwQ0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaEVnTUFBTDhDQUNBTEFBREFBZ0FnREFBQXdRSUFJSm9CQVFDM0FnQWhtd0VCQUxjQ0FDR2NBUUVBdHdJQUlaMEJBUUM0QWdBaG5nRUJBTGdDQUNHZkFRRUF1QUlBSWFBQkFRQzRBZ0Fob2dFQUFMa0NvZ0VpcEFFQUFMb0NwQUVpcGdFQUFMc0NwZ0VpcHdFZ0FMd0NBQ0dvQVNBQXZBSUFJYWtCQWdDOUFnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlRNmFBUUVBQUFBQnBBRUFBQUREQVFLb0FTQUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBRzZBUUVBQUFBQnV3RUJBQUFBQWJ3QkFRQUFBQUc5QVFFQUFBQUJ2Z0VRQUFBQUFiOEJBZ0FBQUFIQUFRZ0FBQUFCd1FFQUFLWURBQ0RFQVFFQUFBQUJDd2NBQUtRREFDQUlBQUQ4QWdBZ21nRUJBQUFBQWFRQkFBQUEzd0VDcWdGQUFBQUFBYXNCUUFBQUFBSEpBUUVBQUFBQnlnRUJBQUFBQWRzQlFBQUFBQUhjQVFJQUFBQUIzUUVRQUFBQUFRSUFBQUFMQUNBYkFBRHJBd0FnQXdBQUFBa0FJQnNBQU9zREFDQWNBQUR2QXdBZ0RRQUFBQWtBSUFjQUFLSURBQ0FJQUFEckFnQWdGQUFBN3dNQUlKb0JBUUMzQWdBaHBBRUFBT2tDM3dFaXFnRkFBTDRDQUNHckFVQUF2Z0lBSWNrQkFRQzNBZ0FoeWdFQkFMY0NBQ0hiQVVBQXZnSUFJZHdCQWdDOUFnQWgzUUVRQU9nQ0FDRUxCd0FBb2dNQUlBZ0FBT3NDQUNDYUFRRUF0d0lBSWFRQkFBRHBBdDhCSXFvQlFBQy1BZ0FocXdGQUFMNENBQ0hKQVFFQXR3SUFJY29CQVFDM0FnQWgyd0ZBQUw0Q0FDSGNBUUlBdlFJQUlkMEJFQURvQWdBaEVnc0FBS3NEQUNBTUFBQ3NBd0FnRFFBQXJRTUFJSm9CQVFBQUFBR2JBUUVBQUFBQm5BRUJBQUFBQVowQkFRQUFBQUdlQVFFQUFBQUJud0VCQUFBQUFhQUJBUUFBQUFHaUFRQUFBS0lCQXFRQkFBQUFwQUVDcGdFQUFBQ21BUUtuQVNBQUFBQUJxQUVnQUFBQUFha0JBZ0FBQUFHcUFVQUFBQUFCcXdGQUFBQUFBUUlBQUFEQUFRQWdHd0FBOEFNQUlBTUFBQUREQVFBZ0d3QUE4QU1BSUJ3QUFQUURBQ0FVQUFBQXd3RUFJQXNBQU1BQ0FDQU1BQURCQWdBZ0RRQUF3Z0lBSUJRQUFQUURBQ0NhQVFFQXR3SUFJWnNCQVFDM0FnQWhuQUVCQUxjQ0FDR2RBUUVBdUFJQUlaNEJBUUM0QWdBaG53RUJBTGdDQUNHZ0FRRUF1QUlBSWFJQkFBQzVBcUlCSXFRQkFBQzZBcVFCSXFZQkFBQzdBcVlCSXFjQklBQzhBZ0FocUFFZ0FMd0NBQ0dwQVFJQXZRSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRVNDd0FBd0FJQUlBd0FBTUVDQUNBTkFBRENBZ0FnbWdFQkFMY0NBQ0diQVFFQXR3SUFJWndCQVFDM0FnQWhuUUVCQUxnQ0FDR2VBUUVBdUFJQUlaOEJBUUM0QWdBaG9BRUJBTGdDQUNHaUFRQUF1UUtpQVNLa0FRQUF1Z0trQVNLbUFRQUF1d0ttQVNLbkFTQUF2QUlBSWFnQklBQzhBZ0FocVFFQ0FMMENBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWhCWm9CQVFBQUFBR2JBUUVBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUc3QVFFQUFBQUJBZ0FBQUV3QUlCc0FBUFVEQUNBU0F3QUFxZ01BSUF3QUFLd0RBQ0FOQUFDdEF3QWdtZ0VCQUFBQUFac0JBUUFBQUFHY0FRRUFBQUFCblFFQkFBQUFBWjRCQVFBQUFBR2ZBUUVBQUFBQm9BRUJBQUFBQWFJQkFBQUFvZ0VDcEFFQUFBQ2tBUUttQVFBQUFLWUJBcWNCSUFBQUFBR29BU0FBQUFBQnFRRUNBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJBZ0FBQU1BQkFDQWJBQUQzQXdBZ0F3QUFBTU1CQUNBYkFBRDNBd0FnSEFBQS13TUFJQlFBQUFEREFRQWdBd0FBdndJQUlBd0FBTUVDQUNBTkFBRENBZ0FnRkFBQS13TUFJSm9CQVFDM0FnQWhtd0VCQUxjQ0FDR2NBUUVBdHdJQUlaMEJBUUM0QWdBaG5nRUJBTGdDQUNHZkFRRUF1QUlBSWFBQkFRQzRBZ0Fob2dFQUFMa0NvZ0VpcEFFQUFMb0NwQUVpcGdFQUFMc0NwZ0VpcHdFZ0FMd0NBQ0dvQVNBQXZBSUFJYWtCQWdDOUFnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlSSURBQUNfQWdBZ0RBQUF3UUlBSUEwQUFNSUNBQ0NhQVFFQXR3SUFJWnNCQVFDM0FnQWhuQUVCQUxjQ0FDR2RBUUVBdUFJQUlaNEJBUUM0QWdBaG53RUJBTGdDQUNHZ0FRRUF1QUlBSWFJQkFBQzVBcUlCSXFRQkFBQzZBcVFCSXFZQkFBQzdBcVlCSXFjQklBQzhBZ0FocUFFZ0FMd0NBQ0dwQVFJQXZRSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRUltZ0VCQUFBQUFhUUJBQUFBM3dFQ3FnRkFBQUFBQWFzQlFBQUFBQUhKQVFFQUFBQUIyd0ZBQUFBQUFkd0JBZ0FBQUFIZEFSQUFBQUFCRWdNQUFLb0RBQ0FMQUFDckF3QWdEUUFBclFNQUlKb0JBUUFBQUFHYkFRRUFBQUFCbkFFQkFBQUFBWjBCQVFBQUFBR2VBUUVBQUFBQm53RUJBQUFBQWFBQkFRQUFBQUdpQVFBQUFLSUJBcVFCQUFBQXBBRUNwZ0VBQUFDbUFRS25BU0FBQUFBQnFBRWdBQUFBQWFrQkFnQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFRSUFBQURBQVFBZ0d3QUFfUU1BSUFNQUFBRERBUUFnR3dBQV9RTUFJQndBQUlFRUFDQVVBQUFBd3dFQUlBTUFBTDhDQUNBTEFBREFBZ0FnRFFBQXdnSUFJQlFBQUlFRUFDQ2FBUUVBdHdJQUlac0JBUUMzQWdBaG5BRUJBTGNDQUNHZEFRRUF1QUlBSVo0QkFRQzRBZ0FobndFQkFMZ0NBQ0dnQVFFQXVBSUFJYUlCQUFDNUFxSUJJcVFCQUFDNkFxUUJJcVlCQUFDN0FxWUJJcWNCSUFDOEFnQWhxQUVnQUx3Q0FDR3BBUUlBdlFJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNFU0F3QUF2d0lBSUFzQUFNQUNBQ0FOQUFEQ0FnQWdtZ0VCQUxjQ0FDR2JBUUVBdHdJQUlad0JBUUMzQWdBaG5RRUJBTGdDQUNHZUFRRUF1QUlBSVo4QkFRQzRBZ0Fob0FFQkFMZ0NBQ0dpQVFBQXVRS2lBU0trQVFBQXVnS2tBU0ttQVFBQXV3S21BU0tuQVNBQXZBSUFJYWdCSUFDOEFnQWhxUUVDQUwwQ0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaEJwb0JBUUFBQUFHcUFVQUFBQUFCcXdGQUFBQUFBY0FCQWdBQUFBSElBUUVBQUFBQnlRRUJBQUFBQVFNQUFBQlBBQ0FiQUFEMUF3QWdIQUFBaFFRQUlBY0FBQUJQQUNBVUFBQ0ZCQUFnbWdFQkFMY0NBQ0diQVFFQXR3SUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRzdBUUVBdHdJQUlRV2FBUUVBdHdJQUlac0JBUUMzQWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSWJzQkFRQzNBZ0FoRHBvQkFRQUFBQUdrQVFBQUFNTUJBcWdCSUFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWJvQkFRQUFBQUc3QVFFQUFBQUJ2QUVCQUFBQUFiMEJBUUFBQUFHLUFSQUFBQUFCdndFQ0FBQUFBY0FCQ0FBQUFBSEJBUUFBcGdNQUlNTUJBUUFBQUFFU0JRQUFwd01BSUFZQUFMZ0RBQ0FNQUFDcEF3QWdtZ0VCQUFBQUFhUUJBQUFBd3dFQ3FBRWdBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJ1Z0VCQUFBQUFic0JBUUFBQUFHOEFRRUFBQUFCdlFFQkFBQUFBYjRCRUFBQUFBR19BUUlBQUFBQndBRUlBQUFBQWNFQkFBQ21Bd0Fnd3dFQkFBQUFBY1FCQVFBQUFBRUNBQUFBQlFBZ0d3QUFod1FBSUEtYUFRRUFBQUFCcEFFQUFBRFJBUUtxQVVBQUFBQUJxd0ZBQUFBQUFjd0JBUUFBQUFITkFRRUFBQUFCemdFUUFBQUFBYzhCQVFBQUFBSFJBUUVBQUFBQjBnRUJBQUFBQWRNQkFRQUFBQUhVQVFFQUFBQUIxUUZBQUFBQUFkWUJBUUFBQUFIWEFVQUFBQUFCQXdBQUFBTUFJQnNBQUljRUFDQWNBQUNNQkFBZ0ZBQUFBQU1BSUFVQUFJd0RBQ0FHQUFDM0F3QWdEQUFBamdNQUlCUUFBSXdFQUNDYUFRRUF0d0lBSWFRQkFBQ0tBOE1CSXFnQklBQzhBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYm9CQVFDM0FnQWh1d0VCQUxjQ0FDRzhBUUVBdHdJQUliMEJBUUMzQWdBaHZnRVFBT2dDQUNHX0FRSUF2UUlBSWNBQkNBQ0lBd0Fod1FFQUFJa0RBQ0REQVFFQXR3SUFJY1FCQVFDM0FnQWhFZ1VBQUl3REFDQUdBQUMzQXdBZ0RBQUFqZ01BSUpvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTU1CQVFDM0FnQWh4QUVCQUxjQ0FDRUltZ0VCQUFBQUFhUUJBQUFBM3dFQ3FnRkFBQUFBQWFzQlFBQUFBQUhLQVFFQUFBQUIyd0ZBQUFBQUFkd0JBZ0FBQUFIZEFSQUFBQUFCRWdVQUFLY0RBQ0FHQUFDNEF3QWdDd0FBcUFNQUlKb0JBUUFBQUFHa0FRQUFBTU1CQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCdkFFQkFBQUFBYjBCQVFBQUFBRy1BUkFBQUFBQnZ3RUNBQUFBQWNBQkNBQUFBQUhCQVFBQXBnTUFJTU1CQVFBQUFBSEVBUUVBQUFBQkFnQUFBQVVBSUJzQUFJNEVBQ0FEQUFBQUF3QWdHd0FBamdRQUlCd0FBSklFQUNBVUFBQUFBd0FnQlFBQWpBTUFJQVlBQUxjREFDQUxBQUNOQXdBZ0ZBQUFrZ1FBSUpvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTU1CQVFDM0FnQWh4QUVCQUxjQ0FDRVNCUUFBakFNQUlBWUFBTGNEQUNBTEFBQ05Bd0FnbWdFQkFMY0NBQ0drQVFBQWlnUERBU0tvQVNBQXZBSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRzZBUUVBdHdJQUlic0JBUUMzQWdBaHZBRUJBTGNDQUNHOUFRRUF0d0lBSWI0QkVBRG9BZ0FodndFQ0FMMENBQ0hBQVFnQWlBTUFJY0VCQUFDSkF3QWd3d0VCQUxjQ0FDSEVBUUVBdHdJQUlRYWFBUUVBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUhBQVFJQUFBQUJ5QUVCQUFBQUFjb0JBUUFBQUFFS21nRUJBQUFBQWFRQkFBQUE0d0VDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUhmQVFFQUFBQUI0QUVCQUFBQUFlRUJBUUFBQUFFQkRnQUNCUU1HQXdRQUN3c1lCZ3daQ1EwY0FRVUVBQW9GQUFRR0FBSUxEQVlNRlFrQ0F3Y0RCQUFGQVFNSUFBUUVBQWdIQUFJSUFBTUtFQWNCQ1FBR0FRb1JBQUlIQUFJSUFBTUNDeFlBREJjQUJBTWRBQXNlQUF3ZkFBMGdBQUFCRGdBQ0FRNEFBZ01FQUJBaEFCRWlBQklBQUFBREJBQVFJUUFSSWdBU0FnY0FBZ2dBQXdJSEFBSUlBQU1GQkFBWElRQWFJZ0FiTXdBWU5BQVpBQUFBQUFBRkJBQVhJUUFhSWdBYk13QVlOQUFaQUFBREJBQWdJUUFoSWdBaUFBQUFBd1FBSUNFQUlTSUFJZ0FBQUFNRUFDZ2hBQ2tpQUNvQUFBQURCQUFvSVFBcElnQXFBUWtBQmdFSkFBWUZCQUF2SVFBeUlnQXpNd0F3TkFBeEFBQUFBQUFGQkFBdklRQXlJZ0F6TXdBd05BQXhBZ2NBQWdnQUF3SUhBQUlJQUFNRkJBQTRJUUE3SWdBOE13QTVOQUE2QUFBQUFBQUZCQUE0SVFBN0lnQThNd0E1TkFBNkFnVUFCQVlBQWdJRkFBUUdBQUlGQkFCQklRQkVJZ0JGTXdCQ05BQkRBQUFBQUFBRkJBQkJJUUJFSWdCRk13QkNOQUJEQUFBRkJBQktJUUJOSWdCT013QkxOQUJNQUFBQUFBQUZCQUJLSVFCTklnQk9Nd0JMTkFCTUR3SUJFQ0VCRVNJQkVpTUJFeVFCRlNZQkZpZ01GeWtOR0NzQkdTME1HaTRPSFM4QkhqQUJIekVNSXpRUEpEVVRKVFlHSmpjR0p6Z0dLRGtHS1RvR0tqd0dLejRNTEQ4VUxVRUdMa01NTDBRVk1FVUdNVVlHTWtjTU5Vb1dOa3NjTjAwRU9FNEVPVkVFT2xJRU8xTUVQRlVFUFZjTVBsZ2RQMW9FUUZ3TVFWMGVRbDRFUTE4RVJHQU1SV01mUm1RalIyWWtTR2NrU1dva1Ntc2tTMndrVEc0a1RYQU1UbkVsVDNNa1VIVU1VWFltVW5ja1UzZ2tWSGtNVlh3blZuMHJWMzRIV0g4SFdZQUJCMXFCQVFkYmdnRUhYSVFCQjEyR0FReGVod0VzWDRrQkIyQ0xBUXhoakFFdFlvMEJCMk9PQVFka2p3RU1aWklCTG1hVEFUUm5sQUVKYUpVQkNXbVdBUWxxbHdFSmE1Z0JDV3lhQVFsdG5BRU1icDBCTlctZkFRbHdvUUVNY2FJQk5uS2pBUWx6cEFFSmRLVUJESFdvQVRkMnFRRTlkNm9CQTNpckFRTjVyQUVEZXEwQkEzdXVBUU44c0FFRGZiSUJESDZ6QVQ1X3RRRURnQUczQVF5QkFiZ0JQNElCdVFFRGd3RzZBUU9FQWJzQkRJVUJ2Z0ZBaGdHX0FVYUhBY0VCQW9nQndnRUNpUUhGQVFLS0FjWUJBb3NCeHdFQ2pBSEpBUUtOQWNzQkRJNEJ6QUZIandIT0FRS1FBZEFCREpFQjBRRklrZ0hTQVFLVEFkTUJBcFFCMUFFTWxRSFhBVW1XQWRnQlR3XCJcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGVjb2RlQmFzZTY0QXNXYXNtKHdhc21CYXNlNjQ6IHN0cmluZyk6IFByb21pc2U8V2ViQXNzZW1ibHkuTW9kdWxlPiB7XG4gIGNvbnN0IHsgQnVmZmVyIH0gPSBhd2FpdCBpbXBvcnQoJ25vZGU6YnVmZmVyJylcbiAgY29uc3Qgd2FzbUFycmF5ID0gQnVmZmVyLmZyb20od2FzbUJhc2U2NCwgJ2Jhc2U2NCcpXG4gIHJldHVybiBuZXcgV2ViQXNzZW1ibHkuTW9kdWxlKHdhc21BcnJheSlcbn1cblxuY29uZmlnLmNvbXBpbGVyV2FzbSA9IHtcbiAgZ2V0UnVudGltZTogYXN5bmMgKCkgPT4gYXdhaXQgaW1wb3J0KFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9xdWVyeV9jb21waWxlcl9mYXN0X2JnLnBvc3RncmVzcWwubWpzXCIpLFxuXG4gIGdldFF1ZXJ5Q29tcGlsZXJXYXNtTW9kdWxlOiBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgeyB3YXNtIH0gPSBhd2FpdCBpbXBvcnQoXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcucG9zdGdyZXNxbC53YXNtLWJhc2U2NC5tanNcIilcbiAgICByZXR1cm4gYXdhaXQgZGVjb2RlQmFzZTY0QXNXYXNtKHdhc20pXG4gIH0sXG5cbiAgaW1wb3J0TmFtZTogXCIuL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcuanNcIlxufVxuXG5cblxuZXhwb3J0IHR5cGUgTG9nT3B0aW9uczxDbGllbnRPcHRpb25zIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnM+ID1cbiAgJ2xvZycgZXh0ZW5kcyBrZXlvZiBDbGllbnRPcHRpb25zID8gQ2xpZW50T3B0aW9uc1snbG9nJ10gZXh0ZW5kcyBBcnJheTxQcmlzbWEuTG9nTGV2ZWwgfCBQcmlzbWEuTG9nRGVmaW5pdGlvbj4gPyBQcmlzbWEuR2V0RXZlbnRzPENsaWVudE9wdGlvbnNbJ2xvZyddPiA6IG5ldmVyIDogbmV2ZXJcblxuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvciB7XG4gICAgLyoqXG4gICAqICMjIFByaXNtYSBDbGllbnRcbiAgICogXG4gICAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXI6IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICAgKiB9KVxuICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ1Bvc3RzXG4gICAqIGNvbnN0IGJsb2dQb3N0cyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSgpXG4gICAqIGBgYFxuICAgKiBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvY2xpZW50KS5cbiAgICovXG5cbiAgbmV3IDxcbiAgICBPcHRpb25zIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnMgPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9ucyxcbiAgICBMb2dPcHRzIGV4dGVuZHMgTG9nT3B0aW9uczxPcHRpb25zPiA9IExvZ09wdGlvbnM8T3B0aW9ucz4sXG4gICAgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddID0gT3B0aW9ucyBleHRlbmRzIHsgb21pdDogaW5mZXIgVSB9ID8gVSA6IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10sXG4gICAgRXh0QXJncyBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3NcbiAgPihvcHRpb25zOiBQcmlzbWEuUHJpc21hQ2xpZW50Q29uc3RydWN0b3JBcmdzPE9wdGlvbnM+KTogUHJpc21hQ2xpZW50PExvZ09wdHMsIE9taXRPcHRzLCBFeHRBcmdzPlxufVxuXG4vKipcbiAqICMjIFByaXNtYSBDbGllbnRcbiAqIFxuICogVHlwZS1zYWZlIGRhdGFiYXNlIGNsaWVudCBmb3IgVHlwZVNjcmlwdFxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gKiAgIGFkYXB0ZXI6IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICogfSlcbiAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nUG9zdHNcbiAqIGNvbnN0IGJsb2dQb3N0cyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSgpXG4gKiBgYGBcbiAqIFxuICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvY2xpZW50KS5cbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudDxcbiAgaW4gTG9nT3B0cyBleHRlbmRzIFByaXNtYS5Mb2dMZXZlbCA9IG5ldmVyLFxuICBpbiBvdXQgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSxcbiAgaW4gb3V0IEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzXG4+IHtcbiAgW0s6IHN5bWJvbF06IHsgdHlwZXM6IFByaXNtYS5UeXBlTWFwPEV4dEFyZ3M+WydvdGhlciddIH1cblxuICAkb248ViBleHRlbmRzIExvZ09wdHM+KGV2ZW50VHlwZTogViwgY2FsbGJhY2s6IChldmVudDogViBleHRlbmRzICdxdWVyeScgPyBQcmlzbWEuUXVlcnlFdmVudCA6IFByaXNtYS5Mb2dFdmVudCkgPT4gdm9pZCk6IFByaXNtYUNsaWVudDtcblxuICAvKipcbiAgICogQ29ubmVjdCB3aXRoIHRoZSBkYXRhYmFzZVxuICAgKi9cbiAgJGNvbm5lY3QoKTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8dm9pZD47XG5cbiAgLyoqXG4gICAqIERpc2Nvbm5lY3QgZnJvbSB0aGUgZGF0YWJhc2VcbiAgICovXG4gICRkaXNjb25uZWN0KCk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPHZvaWQ+O1xuXG4vKipcbiAgICogRXhlY3V0ZXMgYSBwcmVwYXJlZCByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIG51bWJlciBvZiBhZmZlY3RlZCByb3dzLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRleGVjdXRlUmF3YFVQREFURSBVc2VyIFNFVCBjb29sID0gJHt0cnVlfSBXSEVSRSBlbWFpbCA9ICR7J3VzZXJAZW1haWwuY29tJ307YFxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJGV4ZWN1dGVSYXc8VCA9IHVua25vd24+KHF1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFByaXNtYS5TcWwsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxudW1iZXI+O1xuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyBhIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIHJvd3MuXG4gICAqIFN1c2NlcHRpYmxlIHRvIFNRTCBpbmplY3Rpb25zLCBzZWUgZG9jdW1lbnRhdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kZXhlY3V0ZVJhd1Vuc2FmZSgnVVBEQVRFIFVzZXIgU0VUIGNvb2wgPSAkMSBXSEVSRSBlbWFpbCA9ICQyIDsnLCB0cnVlLCAndXNlckBlbWFpbC5jb20nKVxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJGV4ZWN1dGVSYXdVbnNhZmU8VCA9IHVua25vd24+KHF1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxudW1iZXI+O1xuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBhIHByZXBhcmVkIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgYFNFTEVDVGAgZGF0YS5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUICogRlJPTSBVc2VyIFdIRVJFIGlkID0gJHsxfSBPUiBlbWFpbCA9ICR7J3VzZXJAZW1haWwuY29tJ307YFxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJHF1ZXJ5UmF3PFQgPSB1bmtub3duPihxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBQcmlzbWEuU3FsLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8VD47XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIGEgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBgU0VMRUNUYCBkYXRhLlxuICAgKiBTdXNjZXB0aWJsZSB0byBTUUwgaW5qZWN0aW9ucywgc2VlIGRvY3VtZW50YXRpb24uXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3VW5zYWZlKCdTRUxFQ1QgKiBGUk9NIFVzZXIgV0hFUkUgaWQgPSAkMSBPUiBlbWFpbCA9ICQyOycsIDEsICd1c2VyQGVtYWlsLmNvbScpXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkcXVlcnlSYXdVbnNhZmU8VCA9IHVua25vd24+KHF1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxUPjtcblxuXG4gIC8qKlxuICAgKiBBbGxvd3MgdGhlIHJ1bm5pbmcgb2YgYSBzZXF1ZW5jZSBvZiByZWFkL3dyaXRlIG9wZXJhdGlvbnMgdGhhdCBhcmUgZ3VhcmFudGVlZCB0byBlaXRoZXIgc3VjY2VlZCBvciBmYWlsIGFzIGEgd2hvbGUuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBbZ2VvcmdlLCBib2IsIGFsaWNlXSA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oW1xuICAgKiAgIHByaXNtYS51c2VyLmNyZWF0ZSh7IGRhdGE6IHsgbmFtZTogJ0dlb3JnZScgfSB9KSxcbiAgICogICBwcmlzbWEudXNlci5jcmVhdGUoeyBkYXRhOiB7IG5hbWU6ICdCb2InIH0gfSksXG4gICAqICAgcHJpc21hLnVzZXIuY3JlYXRlKHsgZGF0YTogeyBuYW1lOiAnQWxpY2UnIH0gfSksXG4gICAqIF0pXG4gICAqIGBgYFxuICAgKiBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3Mvb3JtL3ByaXNtYS1jbGllbnQvcXVlcmllcy90cmFuc2FjdGlvbnMpLlxuICAgKi9cbiAgJHRyYW5zYWN0aW9uPFAgZXh0ZW5kcyBQcmlzbWEuUHJpc21hUHJvbWlzZTxhbnk+W10+KGFyZzogWy4uLlBdLCBvcHRpb25zPzogeyBtYXhXYWl0PzogbnVtYmVyLCB0aW1lb3V0PzogbnVtYmVyLCBpc29sYXRpb25MZXZlbD86IFByaXNtYS5UcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsIH0pOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxydW50aW1lLlR5cGVzLlV0aWxzLlVud3JhcFR1cGxlPFA+PlxuXG4gICR0cmFuc2FjdGlvbjxSPihmbjogKHByaXNtYTogT21pdDxQcmlzbWFDbGllbnQsIHJ1bnRpbWUuSVRYQ2xpZW50RGVueUxpc3Q+KSA9PiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxSPiwgb3B0aW9ucz86IHsgbWF4V2FpdD86IG51bWJlciwgdGltZW91dD86IG51bWJlciwgaXNvbGF0aW9uTGV2ZWw/OiBQcmlzbWEuVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCB9KTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8Uj5cblxuICAkZXh0ZW5kczogcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkV4dGVuZHNIb29rPFwiZXh0ZW5kc1wiLCBQcmlzbWEuVHlwZU1hcENiPE9taXRPcHRzPiwgRXh0QXJncywgcnVudGltZS5UeXBlcy5VdGlscy5DYWxsPFByaXNtYS5UeXBlTWFwQ2I8T21pdE9wdHM+LCB7XG4gICAgZXh0QXJnczogRXh0QXJnc1xuICB9Pj5cblxuICAgICAgLyoqXG4gICAqIGBwcmlzbWEuYmxvZ1Bvc3RgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQmxvZ1Bvc3QqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dQb3N0c1xuICAgICogY29uc3QgYmxvZ1Bvc3RzID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBibG9nUG9zdCgpOiBQcmlzbWEuQmxvZ1Bvc3REZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmJvb2tpbmdgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQm9va2luZyoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQm9va2luZ3NcbiAgICAqIGNvbnN0IGJvb2tpbmdzID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGJvb2tpbmcoKTogUHJpc21hLkJvb2tpbmdEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmNhdGVnb3J5YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkNhdGVnb3J5KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBDYXRlZ29yaWVzXG4gICAgKiBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBjYXRlZ29yeSgpOiBQcmlzbWEuQ2F0ZWdvcnlEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmNvbnRhY3RNZXNzYWdlYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkNvbnRhY3RNZXNzYWdlKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBDb250YWN0TWVzc2FnZXNcbiAgICAqIGNvbnN0IGNvbnRhY3RNZXNzYWdlcyA9IGF3YWl0IHByaXNtYS5jb250YWN0TWVzc2FnZS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgY29udGFjdE1lc3NhZ2UoKTogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5wYXltZW50YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlBheW1lbnQqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFBheW1lbnRzXG4gICAgKiBjb25zdCBwYXltZW50cyA9IGF3YWl0IHByaXNtYS5wYXltZW50LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBwYXltZW50KCk6IFByaXNtYS5QYXltZW50RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5yZXZpZXdgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqUmV2aWV3KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBSZXZpZXdzXG4gICAgKiBjb25zdCByZXZpZXdzID0gYXdhaXQgcHJpc21hLnJldmlldy5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgcmV2aWV3KCk6IFByaXNtYS5SZXZpZXdEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnRvdXJQYWNrYWdlYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlRvdXJQYWNrYWdlKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBUb3VyUGFja2FnZXNcbiAgICAqIGNvbnN0IHRvdXJQYWNrYWdlcyA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgdG91clBhY2thZ2UoKTogUHJpc21hLlRvdXJQYWNrYWdlRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS51c2VyYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlVzZXIqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFVzZXJzXG4gICAgKiBjb25zdCB1c2VycyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCB1c2VyKCk6IFByaXNtYS5Vc2VyRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9Pjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFByaXNtYUNsaWVudENsYXNzKCk6IFByaXNtYUNsaWVudENvbnN0cnVjdG9yIHtcbiAgcmV0dXJuIHJ1bnRpbWUuZ2V0UHJpc21hQ2xpZW50KGNvbmZpZykgYXMgdW5rbm93biBhcyBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvclxufVxuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogV0FSTklORzogVGhpcyBpcyBhbiBpbnRlcm5hbCBmaWxlIHRoYXQgaXMgc3ViamVjdCB0byBjaGFuZ2UhXG4gKlxuICogXHVEODNEXHVERUQxIFVuZGVyIG5vIGNpcmN1bXN0YW5jZXMgc2hvdWxkIHlvdSBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5ISBcdUQ4M0RcdURFRDFcbiAqXG4gKiBBbGwgZXhwb3J0cyBmcm9tIHRoaXMgZmlsZSBhcmUgd3JhcHBlZCB1bmRlciBhIGBQcmlzbWFgIG5hbWVzcGFjZSBvYmplY3QgaW4gdGhlIGNsaWVudC50cyBmaWxlLlxuICogV2hpbGUgdGhpcyBlbmFibGVzIHBhcnRpYWwgYmFja3dhcmQgY29tcGF0aWJpbGl0eSwgaXQgaXMgbm90IHBhcnQgb2YgdGhlIHN0YWJsZSBwdWJsaWMgQVBJLlxuICpcbiAqIElmIHlvdSBhcmUgbG9va2luZyBmb3IgeW91ciBNb2RlbHMsIEVudW1zLCBhbmQgSW5wdXQgVHlwZXMsIHBsZWFzZSBpbXBvcnQgdGhlbSBmcm9tIHRoZSByZXNwZWN0aXZlXG4gKiBtb2RlbCBmaWxlcyBpbiB0aGUgYG1vZGVsYCBkaXJlY3RvcnkhXG4gKi9cblxuaW1wb3J0ICogYXMgcnVudGltZSBmcm9tIFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9jbGllbnRcIlxuaW1wb3J0IHR5cGUgKiBhcyBQcmlzbWEgZnJvbSBcIi4uL21vZGVsc1wiXG5pbXBvcnQgeyB0eXBlIFByaXNtYUNsaWVudCB9IGZyb20gXCIuL2NsYXNzXCJcblxuZXhwb3J0IHR5cGUgKiBmcm9tICcuLi9tb2RlbHMnXG5cbmV4cG9ydCB0eXBlIERNTUYgPSB0eXBlb2YgcnVudGltZS5ETU1GXG5cbmV4cG9ydCB0eXBlIFByaXNtYVByb21pc2U8VD4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5QcmlzbWFQcm9taXNlPFQ+XG5cbi8qKlxuICogUHJpc21hIEVycm9yc1xuICovXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclxuXG4vKipcbiAqIFJlLWV4cG9ydCBvZiBzcWwtdGVtcGxhdGUtdGFnXG4gKi9cbmV4cG9ydCBjb25zdCBzcWwgPSBydW50aW1lLnNxbHRhZ1xuZXhwb3J0IGNvbnN0IGVtcHR5ID0gcnVudGltZS5lbXB0eVxuZXhwb3J0IGNvbnN0IGpvaW4gPSBydW50aW1lLmpvaW5cbmV4cG9ydCBjb25zdCByYXcgPSBydW50aW1lLnJhd1xuZXhwb3J0IGNvbnN0IFNxbCA9IHJ1bnRpbWUuU3FsXG5leHBvcnQgdHlwZSBTcWwgPSBydW50aW1lLlNxbFxuXG5cblxuLyoqXG4gKiBEZWNpbWFsLmpzXG4gKi9cbmV4cG9ydCBjb25zdCBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5leHBvcnQgdHlwZSBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5cbmV4cG9ydCB0eXBlIERlY2ltYWxKc0xpa2UgPSBydW50aW1lLkRlY2ltYWxKc0xpa2VcblxuLyoqXG4qIEV4dGVuc2lvbnNcbiovXG5leHBvcnQgdHlwZSBFeHRlbnNpb24gPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuVXNlckFyZ3NcbmV4cG9ydCBjb25zdCBnZXRFeHRlbnNpb25Db250ZXh0ID0gcnVudGltZS5FeHRlbnNpb25zLmdldEV4dGVuc2lvbkNvbnRleHRcbmV4cG9ydCB0eXBlIEFyZ3M8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLkFyZ3M8VCwgRj5cbmV4cG9ydCB0eXBlIFBheWxvYWQ8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uID0gbmV2ZXI+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuUGF5bG9hZDxULCBGPlxuZXhwb3J0IHR5cGUgUmVzdWx0PFQsIEEsIEYgZXh0ZW5kcyBydW50aW1lLk9wZXJhdGlvbj4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5SZXN1bHQ8VCwgQSwgRj5cbmV4cG9ydCB0eXBlIEV4YWN0PEEsIFc+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuRXhhY3Q8QSwgVz5cblxuZXhwb3J0IHR5cGUgUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBzdHJpbmdcbiAgZW5naW5lOiBzdHJpbmdcbn1cblxuLyoqXG4gKiBQcmlzbWEgQ2xpZW50IEpTIHZlcnNpb246IDcuOS4xXG4gKiBRdWVyeSBFbmdpbmUgdmVyc2lvbjogZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFxuICovXG5leHBvcnQgY29uc3QgcHJpc21hVmVyc2lvbjogUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBcIjcuOS4xXCIsXG4gIGVuZ2luZTogXCJlOTIyMDg5YjdkNzUwMmFmZjQyNDlkNWRhMzQyMGY2ZmE1NWZjNmFkXCJcbn1cblxuLyoqXG4gKiBVdGlsaXR5IFR5cGVzXG4gKi9cblxuZXhwb3J0IHR5cGUgQnl0ZXMgPSBydW50aW1lLkJ5dGVzXG5leHBvcnQgdHlwZSBKc29uT2JqZWN0ID0gcnVudGltZS5Kc29uT2JqZWN0XG5leHBvcnQgdHlwZSBKc29uQXJyYXkgPSBydW50aW1lLkpzb25BcnJheVxuZXhwb3J0IHR5cGUgSnNvblZhbHVlID0gcnVudGltZS5Kc29uVmFsdWVcbmV4cG9ydCB0eXBlIElucHV0SnNvbk9iamVjdCA9IHJ1bnRpbWUuSW5wdXRKc29uT2JqZWN0XG5leHBvcnQgdHlwZSBJbnB1dEpzb25BcnJheSA9IHJ1bnRpbWUuSW5wdXRKc29uQXJyYXlcbmV4cG9ydCB0eXBlIElucHV0SnNvblZhbHVlID0gcnVudGltZS5JbnB1dEpzb25WYWx1ZVxuXG5cbmV4cG9ydCBjb25zdCBOdWxsVHlwZXMgPSB7XG4gIERiTnVsbDogcnVudGltZS5OdWxsVHlwZXMuRGJOdWxsIGFzIChuZXcgKHNlY3JldDogbmV2ZXIpID0+IHR5cGVvZiBydW50aW1lLkRiTnVsbCksXG4gIEpzb25OdWxsOiBydW50aW1lLk51bGxUeXBlcy5Kc29uTnVsbCBhcyAobmV3IChzZWNyZXQ6IG5ldmVyKSA9PiB0eXBlb2YgcnVudGltZS5Kc29uTnVsbCksXG4gIEFueU51bGw6IHJ1bnRpbWUuTnVsbFR5cGVzLkFueU51bGwgYXMgKG5ldyAoc2VjcmV0OiBuZXZlcikgPT4gdHlwZW9mIHJ1bnRpbWUuQW55TnVsbCksXG59XG4vKipcbiAqIEhlbHBlciBmb3IgZmlsdGVyaW5nIEpTT04gZW50cmllcyB0aGF0IGhhdmUgYG51bGxgIG9uIHRoZSBkYXRhYmFzZSAoZW1wdHkgb24gdGhlIGRiKVxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IERiTnVsbCA9IHJ1bnRpbWUuRGJOdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgaGF2ZSBKU09OIGBudWxsYCB2YWx1ZXMgKG5vdCBlbXB0eSBvbiB0aGUgZGIpXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgSnNvbk51bGwgPSBydW50aW1lLkpzb25OdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgYXJlIGBQcmlzbWEuRGJOdWxsYCBvciBgUHJpc21hLkpzb25OdWxsYFxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IEFueU51bGwgPSBydW50aW1lLkFueU51bGxcblxuXG50eXBlIFNlbGVjdEFuZEluY2x1ZGUgPSB7XG4gIHNlbGVjdDogYW55XG4gIGluY2x1ZGU6IGFueVxufVxuXG50eXBlIFNlbGVjdEFuZE9taXQgPSB7XG4gIHNlbGVjdDogYW55XG4gIG9taXQ6IGFueVxufVxuXG4vKipcbiAqIEZyb20gVCwgcGljayBhIHNldCBvZiBwcm9wZXJ0aWVzIHdob3NlIGtleXMgYXJlIGluIHRoZSB1bmlvbiBLXG4gKi9cbnR5cGUgUHJpc21hX19QaWNrPFQsIEsgZXh0ZW5kcyBrZXlvZiBUPiA9IHtcbiAgICBbUCBpbiBLXTogVFtQXTtcbn07XG5cbmV4cG9ydCB0eXBlIEVudW1lcmFibGU8VD4gPSBUIHwgQXJyYXk8VD47XG5cbi8qKlxuICogU3Vic2V0XG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAuIFNpbXBsZSB2ZXJzaW9uIG9mIEludGVyc2VjdGlvblxuICovXG5leHBvcnQgdHlwZSBTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlcjtcbn07XG5cbi8qKlxuICogUmVzb2x2ZWQgdHlwZSBvZiB0aGUgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBgUHJpc21hQ2xpZW50YCBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBXaGVuIGNhbGxlZCB3aXRob3V0IGEgbmFycm93ZXIgb3B0aW9ucyB0eXBlICh0aGUgY29tbW9uIGNhc2UpLCB0aGlzIHJlc29sdmVzXG4gKiB0byBgUHJpc21hQ2xpZW50T3B0aW9uc2AgZGlyZWN0bHksIHdoaWNoIHByb2R1Y2VzIGEgY2xlYXIgVHlwZVNjcmlwdCBlcnJvclxuICogbWVzc2FnZSAoYG5vdCBhc3NpZ25hYmxlIHRvIHBhcmFtZXRlciBvZiB0eXBlICdQcmlzbWFDbGllbnRPcHRpb25zJ2ApIHdoZW5cbiAqIHRoZSBhcmd1bWVudCBpcyBtaXNzaW5nIG9yIGluY29tcGxldGUuIFdoZW4gdGhlIHVzZXIgc3VwcGxpZXMgYSBuYXJyb3dlclxuICogb3B0aW9ucyB0eXBlIChlLmcuIHZpYSBhIGxpdGVyYWwpLCBpdCBmYWxscyBiYWNrIHRvIGBTdWJzZXRgIHRvIGtlZXBcbiAqIGZpbHRlcmluZyBvdXQgdW5rbm93biBwcm9wZXJ0aWVzLlxuICovXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvckFyZ3M8T3B0aW9ucyBleHRlbmRzIFByaXNtYUNsaWVudE9wdGlvbnM+ID1cbiAgW1ByaXNtYUNsaWVudE9wdGlvbnNdIGV4dGVuZHMgW09wdGlvbnNdID8gUHJpc21hQ2xpZW50T3B0aW9ucyA6IFN1YnNldDxPcHRpb25zLCBQcmlzbWFDbGllbnRPcHRpb25zPjtcblxuLyoqXG4gKiBTZWxlY3RTdWJzZXRcbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYC4gU2ltcGxlIHZlcnNpb24gb2YgSW50ZXJzZWN0aW9uLlxuICogQWRkaXRpb25hbGx5LCBpdCB2YWxpZGF0ZXMsIGlmIGJvdGggc2VsZWN0IGFuZCBpbmNsdWRlIGFyZSBwcmVzZW50LiBJZiB0aGUgY2FzZSwgaXQgZXJyb3JzLlxuICovXG5leHBvcnQgdHlwZSBTZWxlY3RTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlclxufSAmXG4gIChUIGV4dGVuZHMgU2VsZWN0QW5kSW5jbHVkZVxuICAgID8gJ1BsZWFzZSBlaXRoZXIgY2hvb3NlIGBzZWxlY3RgIG9yIGBpbmNsdWRlYC4nXG4gICAgOiBUIGV4dGVuZHMgU2VsZWN0QW5kT21pdFxuICAgICAgPyAnUGxlYXNlIGVpdGhlciBjaG9vc2UgYHNlbGVjdGAgb3IgYG9taXRgLidcbiAgICAgIDoge30pXG5cbi8qKlxuICogU3Vic2V0ICsgSW50ZXJzZWN0aW9uXG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAgYW5kIGludGVyc2VjdCBgS2BcbiAqL1xuZXhwb3J0IHR5cGUgU3Vic2V0SW50ZXJzZWN0aW9uPFQsIFUsIEs+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiBrZXkgZXh0ZW5kcyBrZXlvZiBVID8gVFtrZXldIDogbmV2ZXJcbn0gJlxuICBLXG5cbnR5cGUgV2l0aG91dDxULCBVPiA9IHsgW1AgaW4gRXhjbHVkZTxrZXlvZiBULCBrZXlvZiBVPl0/OiBuZXZlciB9O1xuXG4vKipcbiAqIFhPUiBpcyBuZWVkZWQgdG8gaGF2ZSBhIHJlYWwgbXV0dWFsbHkgZXhjbHVzaXZlIHVuaW9uIHR5cGVcbiAqIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQyMTIzNDA3L2RvZXMtdHlwZXNjcmlwdC1zdXBwb3J0LW11dHVhbGx5LWV4Y2x1c2l2ZS10eXBlc1xuICovXG5leHBvcnQgdHlwZSBYT1I8VCwgVT4gPVxuICBUIGV4dGVuZHMgb2JqZWN0ID9cbiAgVSBleHRlbmRzIG9iamVjdCA/XG4gICAgKChXaXRob3V0PFQsIFU+ICYgVSkgfCAoV2l0aG91dDxVLCBUPiAmIFQpKSAmIG9iamVjdFxuICA6IFUgOiBUXG5cblxuLyoqXG4gKiBJcyBUIGEgUmVjb3JkP1xuICovXG50eXBlIElzT2JqZWN0PFQgZXh0ZW5kcyBhbnk+ID0gVCBleHRlbmRzIEFycmF5PGFueT5cbj8gRmFsc2VcbjogVCBleHRlbmRzIERhdGVcbj8gRmFsc2VcbjogVCBleHRlbmRzIFVpbnQ4QXJyYXlcbj8gRmFsc2VcbjogVCBleHRlbmRzIEJpZ0ludFxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgb2JqZWN0XG4/IFRydWVcbjogRmFsc2VcblxuXG4vKipcbiAqIElmIGl0J3MgVFtdLCByZXR1cm4gVFxuICovXG5leHBvcnQgdHlwZSBVbkVudW1lcmF0ZTxUIGV4dGVuZHMgdW5rbm93bj4gPSBUIGV4dGVuZHMgQXJyYXk8aW5mZXIgVT4gPyBVIDogVFxuXG4vKipcbiAqIEZyb20gdHMtdG9vbGJlbHRcbiAqL1xuXG50eXBlIF9fRWl0aGVyPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gT21pdDxPLCBLPiAmXG4gIHtcbiAgICAvLyBNZXJnZSBhbGwgYnV0IEtcbiAgICBbUCBpbiBLXTogUHJpc21hX19QaWNrPE8sIFAgJiBrZXlvZiBPPiAvLyBXaXRoIEsgcG9zc2liaWxpdGllc1xuICB9W0tdXG5cbnR5cGUgRWl0aGVyU3RyaWN0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gU3RyaWN0PF9fRWl0aGVyPE8sIEs+PlxuXG50eXBlIEVpdGhlckxvb3NlPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gQ29tcHV0ZVJhdzxfX0VpdGhlcjxPLCBLPj5cblxudHlwZSBfRWl0aGVyPFxuICBPIGV4dGVuZHMgb2JqZWN0LFxuICBLIGV4dGVuZHMgS2V5LFxuICBzdHJpY3QgZXh0ZW5kcyBCb29sZWFuXG4+ID0ge1xuICAxOiBFaXRoZXJTdHJpY3Q8TywgSz5cbiAgMDogRWl0aGVyTG9vc2U8TywgSz5cbn1bc3RyaWN0XVxuXG5leHBvcnQgdHlwZSBFaXRoZXI8XG4gIE8gZXh0ZW5kcyBvYmplY3QsXG4gIEsgZXh0ZW5kcyBLZXksXG4gIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxXG4+ID0gTyBleHRlbmRzIHVua25vd24gPyBfRWl0aGVyPE8sIEssIHN0cmljdD4gOiBuZXZlclxuXG5leHBvcnQgdHlwZSBVbmlvbiA9IGFueVxuXG5leHBvcnQgdHlwZSBQYXRjaFVuZGVmaW5lZDxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gIFtLIGluIGtleW9mIE9dOiBPW0tdIGV4dGVuZHMgdW5kZWZpbmVkID8gQXQ8TzEsIEs+IDogT1tLXVxufSAmIHt9XG5cbi8qKiBIZWxwZXIgVHlwZXMgZm9yIFwiTWVyZ2VcIiAqKi9cbmV4cG9ydCB0eXBlIEludGVyc2VjdE9mPFUgZXh0ZW5kcyBVbmlvbj4gPSAoXG4gIFUgZXh0ZW5kcyB1bmtub3duID8gKGs6IFUpID0+IHZvaWQgOiBuZXZlclxuKSBleHRlbmRzIChrOiBpbmZlciBJKSA9PiB2b2lkXG4gID8gSVxuICA6IG5ldmVyXG5cbmV4cG9ydCB0eXBlIE92ZXJ3cml0ZTxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gICAgW0sgaW4ga2V5b2YgT106IEsgZXh0ZW5kcyBrZXlvZiBPMSA/IE8xW0tdIDogT1tLXTtcbn0gJiB7fTtcblxudHlwZSBfTWVyZ2U8VSBleHRlbmRzIG9iamVjdD4gPSBJbnRlcnNlY3RPZjxPdmVyd3JpdGU8VSwge1xuICAgIFtLIGluIGtleW9mIFVdLT86IEF0PFUsIEs+O1xufT4+O1xuXG50eXBlIEtleSA9IHN0cmluZyB8IG51bWJlciB8IHN5bWJvbDtcbnR5cGUgQXRTdHJpY3Q8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBPW0sgJiBrZXlvZiBPXTtcbnR5cGUgQXRMb29zZTxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IE8gZXh0ZW5kcyB1bmtub3duID8gQXRTdHJpY3Q8TywgSz4gOiBuZXZlcjtcbmV4cG9ydCB0eXBlIEF0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXksIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxPiA9IHtcbiAgICAxOiBBdFN0cmljdDxPLCBLPjtcbiAgICAwOiBBdExvb3NlPE8sIEs+O1xufVtzdHJpY3RdO1xuXG5leHBvcnQgdHlwZSBDb21wdXRlUmF3PEEgZXh0ZW5kcyBhbnk+ID0gQSBleHRlbmRzIEZ1bmN0aW9uID8gQSA6IHtcbiAgW0sgaW4ga2V5b2YgQV06IEFbS107XG59ICYge307XG5cbmV4cG9ydCB0eXBlIE9wdGlvbmFsRmxhdDxPPiA9IHtcbiAgW0sgaW4ga2V5b2YgT10/OiBPW0tdO1xufSAmIHt9O1xuXG50eXBlIF9SZWNvcmQ8SyBleHRlbmRzIGtleW9mIGFueSwgVD4gPSB7XG4gIFtQIGluIEtdOiBUO1xufTtcblxuLy8gY2F1c2UgdHlwZXNjcmlwdCBub3QgdG8gZXhwYW5kIHR5cGVzIGFuZCBwcmVzZXJ2ZSBuYW1lc1xudHlwZSBOb0V4cGFuZDxUPiA9IFQgZXh0ZW5kcyB1bmtub3duID8gVCA6IG5ldmVyO1xuXG4vLyB0aGlzIHR5cGUgYXNzdW1lcyB0aGUgcGFzc2VkIG9iamVjdCBpcyBlbnRpcmVseSBvcHRpb25hbFxuZXhwb3J0IHR5cGUgQXRMZWFzdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgc3RyaW5nPiA9IE5vRXhwYW5kPFxuICBPIGV4dGVuZHMgdW5rbm93blxuICA/IHwgKEsgZXh0ZW5kcyBrZXlvZiBPID8geyBbUCBpbiBLXTogT1tQXSB9ICYgTyA6IE8pXG4gICAgfCB7W1AgaW4ga2V5b2YgTyBhcyBQIGV4dGVuZHMgSyA/IFAgOiBuZXZlcl0tPzogT1tQXX0gJiBPXG4gIDogbmV2ZXI+O1xuXG50eXBlIF9TdHJpY3Q8VSwgX1UgPSBVPiA9IFUgZXh0ZW5kcyB1bmtub3duID8gVSAmIE9wdGlvbmFsRmxhdDxfUmVjb3JkPEV4Y2x1ZGU8S2V5czxfVT4sIGtleW9mIFU+LCBuZXZlcj4+IDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIFN0cmljdDxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X1N0cmljdDxVPj47XG4vKiogRW5kIEhlbHBlciBUeXBlcyBmb3IgXCJNZXJnZVwiICoqL1xuXG5leHBvcnQgdHlwZSBNZXJnZTxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X01lcmdlPFN0cmljdDxVPj4+O1xuXG5leHBvcnQgdHlwZSBCb29sZWFuID0gVHJ1ZSB8IEZhbHNlXG5cbmV4cG9ydCB0eXBlIFRydWUgPSAxXG5cbmV4cG9ydCB0eXBlIEZhbHNlID0gMFxuXG5leHBvcnQgdHlwZSBOb3Q8QiBleHRlbmRzIEJvb2xlYW4+ID0ge1xuICAwOiAxXG4gIDE6IDBcbn1bQl1cblxuZXhwb3J0IHR5cGUgRXh0ZW5kczxBMSBleHRlbmRzIGFueSwgQTIgZXh0ZW5kcyBhbnk+ID0gW0ExXSBleHRlbmRzIFtuZXZlcl1cbiAgPyAwIC8vIGFueXRoaW5nIGBuZXZlcmAgaXMgZmFsc2VcbiAgOiBBMSBleHRlbmRzIEEyXG4gID8gMVxuICA6IDBcblxuZXhwb3J0IHR5cGUgSGFzPFUgZXh0ZW5kcyBVbmlvbiwgVTEgZXh0ZW5kcyBVbmlvbj4gPSBOb3Q8XG4gIEV4dGVuZHM8RXhjbHVkZTxVMSwgVT4sIFUxPlxuPlxuXG5leHBvcnQgdHlwZSBPcjxCMSBleHRlbmRzIEJvb2xlYW4sIEIyIGV4dGVuZHMgQm9vbGVhbj4gPSB7XG4gIDA6IHtcbiAgICAwOiAwXG4gICAgMTogMVxuICB9XG4gIDE6IHtcbiAgICAwOiAxXG4gICAgMTogMVxuICB9XG59W0IxXVtCMl1cblxuZXhwb3J0IHR5cGUgS2V5czxVIGV4dGVuZHMgVW5pb24+ID0gVSBleHRlbmRzIHVua25vd24gPyBrZXlvZiBVIDogbmV2ZXJcblxuZXhwb3J0IHR5cGUgR2V0U2NhbGFyVHlwZTxULCBPPiA9IE8gZXh0ZW5kcyBvYmplY3QgPyB7XG4gIFtQIGluIGtleW9mIFRdOiBQIGV4dGVuZHMga2V5b2YgT1xuICAgID8gT1tQXVxuICAgIDogbmV2ZXJcbn0gOiBuZXZlclxuXG50eXBlIEZpZWxkUGF0aHM8XG4gIFQsXG4gIFUgPSBPbWl0PFQsICdfYXZnJyB8ICdfc3VtJyB8ICdfY291bnQnIHwgJ19taW4nIHwgJ19tYXgnPlxuPiA9IElzT2JqZWN0PFQ+IGV4dGVuZHMgVHJ1ZSA/IFUgOiBUXG5cbmV4cG9ydCB0eXBlIEdldEhhdmluZ0ZpZWxkczxUPiA9IHtcbiAgW0sgaW4ga2V5b2YgVF06IE9yPFxuICAgIE9yPEV4dGVuZHM8J09SJywgSz4sIEV4dGVuZHM8J0FORCcsIEs+PixcbiAgICBFeHRlbmRzPCdOT1QnLCBLPlxuICA+IGV4dGVuZHMgVHJ1ZVxuICAgID8gLy8gaW5mZXIgaXMgb25seSBuZWVkZWQgdG8gbm90IGhpdCBUUyBsaW1pdFxuICAgICAgLy8gYmFzZWQgb24gdGhlIGJyaWxsaWFudCBpZGVhIG9mIFBpZXJyZS1BbnRvaW5lIE1pbGxzXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzMwMTg4I2lzc3VlY29tbWVudC00Nzg5Mzg0MzdcbiAgICAgIFRbS10gZXh0ZW5kcyBpbmZlciBUS1xuICAgICAgPyBHZXRIYXZpbmdGaWVsZHM8VW5FbnVtZXJhdGU8VEs+IGV4dGVuZHMgb2JqZWN0ID8gTWVyZ2U8VW5FbnVtZXJhdGU8VEs+PiA6IG5ldmVyPlxuICAgICAgOiBuZXZlclxuICAgIDoge30gZXh0ZW5kcyBGaWVsZFBhdGhzPFRbS10+XG4gICAgPyBuZXZlclxuICAgIDogS1xufVtrZXlvZiBUXVxuXG4vKipcbiAqIENvbnZlcnQgdHVwbGUgdG8gdW5pb25cbiAqL1xudHlwZSBfVHVwbGVUb1VuaW9uPFQ+ID0gVCBleHRlbmRzIChpbmZlciBFKVtdID8gRSA6IG5ldmVyXG50eXBlIFR1cGxlVG9VbmlvbjxLIGV4dGVuZHMgcmVhZG9ubHkgYW55W10+ID0gX1R1cGxlVG9VbmlvbjxLPlxuZXhwb3J0IHR5cGUgTWF5YmVUdXBsZVRvVW5pb248VD4gPSBUIGV4dGVuZHMgYW55W10gPyBUdXBsZVRvVW5pb248VD4gOiBUXG5cbi8qKlxuICogTGlrZSBgUGlja2AsIGJ1dCBhZGRpdGlvbmFsbHkgY2FuIGFsc28gYWNjZXB0IGFuIGFycmF5IG9mIGtleXNcbiAqL1xuZXhwb3J0IHR5cGUgUGlja0VudW1lcmFibGU8VCwgSyBleHRlbmRzIEVudW1lcmFibGU8a2V5b2YgVD4gfCBrZXlvZiBUPiA9IFByaXNtYV9fUGljazxULCBNYXliZVR1cGxlVG9VbmlvbjxLPj5cblxuLyoqXG4gKiBFeGNsdWRlIGFsbCBrZXlzIHdpdGggdW5kZXJzY29yZXNcbiAqL1xuZXhwb3J0IHR5cGUgRXhjbHVkZVVuZGVyc2NvcmVLZXlzPFQgZXh0ZW5kcyBzdHJpbmc+ID0gVCBleHRlbmRzIGBfJHtzdHJpbmd9YCA/IG5ldmVyIDogVFxuXG5cbmV4cG9ydCB0eXBlIEZpZWxkUmVmPE1vZGVsLCBGaWVsZFR5cGU+ID0gcnVudGltZS5GaWVsZFJlZjxNb2RlbCwgRmllbGRUeXBlPlxuXG50eXBlIEZpZWxkUmVmSW5wdXRUeXBlPE1vZGVsLCBGaWVsZFR5cGU+ID0gTW9kZWwgZXh0ZW5kcyBuZXZlciA/IG5ldmVyIDogRmllbGRSZWY8TW9kZWwsIEZpZWxkVHlwZT5cblxuXG5leHBvcnQgY29uc3QgTW9kZWxOYW1lID0ge1xuICBCbG9nUG9zdDogJ0Jsb2dQb3N0JyxcbiAgQm9va2luZzogJ0Jvb2tpbmcnLFxuICBDYXRlZ29yeTogJ0NhdGVnb3J5JyxcbiAgQ29udGFjdE1lc3NhZ2U6ICdDb250YWN0TWVzc2FnZScsXG4gIFBheW1lbnQ6ICdQYXltZW50JyxcbiAgUmV2aWV3OiAnUmV2aWV3JyxcbiAgVG91clBhY2thZ2U6ICdUb3VyUGFja2FnZScsXG4gIFVzZXI6ICdVc2VyJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBNb2RlbE5hbWUgPSAodHlwZW9mIE1vZGVsTmFtZSlba2V5b2YgdHlwZW9mIE1vZGVsTmFtZV1cblxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgVHlwZU1hcENiPEdsb2JhbE9taXRPcHRpb25zID0ge30+IGV4dGVuZHMgcnVudGltZS5UeXBlcy5VdGlscy5Gbjx7ZXh0QXJnczogcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyB9LCBydW50aW1lLlR5cGVzLlV0aWxzLlJlY29yZDxzdHJpbmcsIGFueT4+IHtcbiAgcmV0dXJuczogVHlwZU1hcDx0aGlzWydwYXJhbXMnXVsnZXh0QXJncyddLCBHbG9iYWxPbWl0T3B0aW9ucz5cbn1cblxuZXhwb3J0IHR5cGUgVHlwZU1hcDxFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncywgR2xvYmFsT21pdE9wdGlvbnMgPSB7fT4gPSB7XG4gIGdsb2JhbE9taXRPcHRpb25zOiB7XG4gICAgb21pdDogR2xvYmFsT21pdE9wdGlvbnNcbiAgfVxuICBtZXRhOiB7XG4gICAgbW9kZWxQcm9wczogXCJibG9nUG9zdFwiIHwgXCJib29raW5nXCIgfCBcImNhdGVnb3J5XCIgfCBcImNvbnRhY3RNZXNzYWdlXCIgfCBcInBheW1lbnRcIiB8IFwicmV2aWV3XCIgfCBcInRvdXJQYWNrYWdlXCIgfCBcInVzZXJcIlxuICAgIHR4SXNvbGF0aW9uTGV2ZWw6IFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWxcbiAgfVxuICBtb2RlbDoge1xuICAgIEJsb2dQb3N0OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQmxvZ1Bvc3RGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdERlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3REZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQmxvZ1Bvc3Q+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5CbG9nUG9zdEdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJsb2dQb3N0Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIEJvb2tpbmc6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQm9va2luZ1BheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkJvb2tpbmdGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1VwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1VwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0FnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUJvb2tpbmc+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJvb2tpbmdHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJvb2tpbmdDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQ2F0ZWdvcnk6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5DYXRlZ29yeUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVDYXRlZ29yeT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNhdGVnb3J5R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ2F0ZWdvcnlDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQ29udGFjdE1lc3NhZ2U6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVDb250YWN0TWVzc2FnZT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNvbnRhY3RNZXNzYWdlR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ29udGFjdE1lc3NhZ2VDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgUGF5bWVudDoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRQYXltZW50UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUGF5bWVudEZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnREZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnREZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUGF5bWVudD5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUGF5bWVudEdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUGF5bWVudENvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBSZXZpZXc6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kUmV2aWV3UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUmV2aWV3RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1Vwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUmV2aWV3PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJldmlld0dyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5SZXZpZXdDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgVG91clBhY2thZ2U6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Ub3VyUGFja2FnZUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVUb3VyUGFja2FnZT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlRvdXJQYWNrYWdlR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVG91clBhY2thZ2VDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgVXNlcjoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRVc2VyUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuVXNlckZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlVXNlcj5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVXNlckdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVXNlckNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufSAmIHtcbiAgb3RoZXI6IHtcbiAgICBwYXlsb2FkOiBhbnlcbiAgICBvcGVyYXRpb25zOiB7XG4gICAgICAkZXhlY3V0ZVJhdzoge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgU3FsLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRleGVjdXRlUmF3VW5zYWZlOiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRxdWVyeVJhdzoge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgU3FsLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRxdWVyeVJhd1Vuc2FmZToge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXV0sXG4gICAgICAgIHJlc3VsdDogYW55XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRW51bXNcbiAqL1xuXG5leHBvcnQgY29uc3QgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCA9IHJ1bnRpbWUubWFrZVN0cmljdEVudW0oe1xuICBSZWFkVW5jb21taXR0ZWQ6ICdSZWFkVW5jb21taXR0ZWQnLFxuICBSZWFkQ29tbWl0dGVkOiAnUmVhZENvbW1pdHRlZCcsXG4gIFJlcGVhdGFibGVSZWFkOiAnUmVwZWF0YWJsZVJlYWQnLFxuICBTZXJpYWxpemFibGU6ICdTZXJpYWxpemFibGUnXG59IGFzIGNvbnN0KVxuXG5leHBvcnQgdHlwZSBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsID0gKHR5cGVvZiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsKVtrZXlvZiB0eXBlb2YgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbF1cblxuXG5leHBvcnQgY29uc3QgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBleGNlcnB0OiAnZXhjZXJwdCcsXG4gIGNvbnRlbnQ6ICdjb250ZW50JyxcbiAgY292ZXJJbWFnZTogJ2NvdmVySW1hZ2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICBhdXRob3JJZDogJ2F1dGhvcklkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCbG9nUG9zdFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQm9va2luZ1NjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRyYXZlbERhdGU6ICd0cmF2ZWxEYXRlJyxcbiAgdHJhdmVsZXJzOiAndHJhdmVsZXJzJyxcbiAgdG90YWxQcmljZTogJ3RvdGFsUHJpY2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYWNrYWdlSWQ6ICdwYWNrYWdlSWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCb29raW5nU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgZW1haWw6ICdlbWFpbCcsXG4gIHN1YmplY3Q6ICdzdWJqZWN0JyxcbiAgbWVzc2FnZTogJ21lc3NhZ2UnLFxuICBpc1Jlc29sdmVkOiAnaXNSZXNvbHZlZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFBheW1lbnRTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBib29raW5nSWQ6ICdib29raW5nSWQnLFxuICB0cmFuSWQ6ICd0cmFuSWQnLFxuICB2YWxJZDogJ3ZhbElkJyxcbiAgYW1vdW50OiAnYW1vdW50JyxcbiAgY3VycmVuY3k6ICdjdXJyZW5jeScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGdhdGV3YXlQYWdlVXJsOiAnZ2F0ZXdheVBhZ2VVcmwnLFxuICBzc2xTZXNzaW9uS2V5OiAnc3NsU2Vzc2lvbktleScsXG4gIGNhcmRUeXBlOiAnY2FyZFR5cGUnLFxuICBiYW5rVHJhbklkOiAnYmFua1RyYW5JZCcsXG4gIHBhaWRBdDogJ3BhaWRBdCcsXG4gIHJlZnVuZFJlZklkOiAncmVmdW5kUmVmSWQnLFxuICByZWZ1bmRlZEF0OiAncmVmdW5kZWRBdCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGF5bWVudFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgUGF5bWVudFNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFBheW1lbnRTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFJldmlld1NjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHJhdGluZzogJ3JhdGluZycsXG4gIGNvbW1lbnQ6ICdjb21tZW50JyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgcGFja2FnZUlkOiAncGFja2FnZUlkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBSZXZpZXdTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFJldmlld1NjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFJldmlld1NjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBkZXNjcmlwdGlvbjogJ2Rlc2NyaXB0aW9uJyxcbiAgbG9jYXRpb246ICdsb2NhdGlvbicsXG4gIHByaWNlOiAncHJpY2UnLFxuICBkdXJhdGlvbjogJ2R1cmF0aW9uJyxcbiAgcmF0aW5nOiAncmF0aW5nJyxcbiAgaW1hZ2VzOiAnaW1hZ2VzJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgY2F0ZWdvcnlJZDogJ2NhdGVnb3J5SWQnLFxuICBhZ2VudElkOiAnYWdlbnRJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFVzZXJTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBuYW1lOiAnbmFtZScsXG4gIGVtYWlsOiAnZW1haWwnLFxuICBwYXNzd29yZDogJ3Bhc3N3b3JkJyxcbiAgZ29vZ2xlSWQ6ICdnb29nbGVJZCcsXG4gIHBob25lOiAncGhvbmUnLFxuICBhdmF0YXJVcmw6ICdhdmF0YXJVcmwnLFxuICByb2xlOiAncm9sZScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGF1dGhQcm92aWRlcjogJ2F1dGhQcm92aWRlcicsXG4gIGVtYWlsVmVyaWZpZWQ6ICdlbWFpbFZlcmlmaWVkJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgdG9rZW5WZXJzaW9uOiAndG9rZW5WZXJzaW9uJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBVc2VyU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBVc2VyU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgVXNlclNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgU29ydE9yZGVyID0ge1xuICBhc2M6ICdhc2MnLFxuICBkZXNjOiAnZGVzYydcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgU29ydE9yZGVyID0gKHR5cGVvZiBTb3J0T3JkZXIpW2tleW9mIHR5cGVvZiBTb3J0T3JkZXJdXG5cblxuZXhwb3J0IGNvbnN0IFF1ZXJ5TW9kZSA9IHtcbiAgZGVmYXVsdDogJ2RlZmF1bHQnLFxuICBpbnNlbnNpdGl2ZTogJ2luc2Vuc2l0aXZlJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBRdWVyeU1vZGUgPSAodHlwZW9mIFF1ZXJ5TW9kZSlba2V5b2YgdHlwZW9mIFF1ZXJ5TW9kZV1cblxuXG5leHBvcnQgY29uc3QgTnVsbHNPcmRlciA9IHtcbiAgZmlyc3Q6ICdmaXJzdCcsXG4gIGxhc3Q6ICdsYXN0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBOdWxsc09yZGVyID0gKHR5cGVvZiBOdWxsc09yZGVyKVtrZXlvZiB0eXBlb2YgTnVsbHNPcmRlcl1cblxuXG5cbi8qKlxuICogRmllbGQgcmVmZXJlbmNlc1xuICovXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdTdHJpbmcnXG4gKi9cbmV4cG9ydCB0eXBlIFN0cmluZ0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1N0cmluZyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdTdHJpbmdbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdFN0cmluZ0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1N0cmluZ1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1Bvc3RTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Qb3N0U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUG9zdFN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQb3N0U3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUG9zdFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1Bvc3RTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29sZWFuJ1xuICovXG5leHBvcnQgdHlwZSBCb29sZWFuRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQm9vbGVhbic+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEYXRlVGltZSdcbiAqL1xuZXhwb3J0IHR5cGUgRGF0ZVRpbWVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEYXRlVGltZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEYXRlVGltZVtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RGF0ZVRpbWVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEYXRlVGltZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0ludCdcbiAqL1xuZXhwb3J0IHR5cGUgSW50RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnSW50Jz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0ludFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0SW50RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnSW50W10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGVjaW1hbCdcbiAqL1xuZXhwb3J0IHR5cGUgRGVjaW1hbEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RlY2ltYWwnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGVjaW1hbFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RGVjaW1hbEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RlY2ltYWxbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29raW5nU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtQm9va2luZ1N0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Jvb2tpbmdTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQm9va2luZ1N0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bUJvb2tpbmdTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29raW5nU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGF5bWVudFN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBheW1lbnRTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYXltZW50U3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BheW1lbnRTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1QYXltZW50U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGF5bWVudFN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Zsb2F0J1xuICovXG5leHBvcnQgdHlwZSBGbG9hdEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Zsb2F0Jz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Zsb2F0W10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RGbG9hdEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Zsb2F0W10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGFja2FnZVN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBhY2thZ2VTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYWNrYWdlU3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BhY2thZ2VTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1QYWNrYWdlU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGFja2FnZVN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1JvbGUnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Sb2xlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUm9sZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdSb2xlW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUm9sZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1JvbGVbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdVc2VyU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtVXNlclN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1VzZXJTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnVXNlclN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVVzZXJTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdVc2VyU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQXV0aFByb3ZpZGVyJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtQXV0aFByb3ZpZGVyRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQXV0aFByb3ZpZGVyJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0F1dGhQcm92aWRlcltdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bUF1dGhQcm92aWRlckZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0F1dGhQcm92aWRlcltdJz5cbiAgICBcblxuLyoqXG4gKiBCYXRjaCBQYXlsb2FkIGZvciB1cGRhdGVNYW55ICYgZGVsZXRlTWFueSAmIGNyZWF0ZU1hbnlcbiAqL1xuZXhwb3J0IHR5cGUgQmF0Y2hQYXlsb2FkID0ge1xuICBjb3VudDogbnVtYmVyXG59XG5cbmV4cG9ydCBjb25zdCBkZWZpbmVFeHRlbnNpb24gPSBydW50aW1lLkV4dGVuc2lvbnMuZGVmaW5lRXh0ZW5zaW9uIGFzIHVua25vd24gYXMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkV4dGVuZHNIb29rPFwiZGVmaW5lXCIsIFR5cGVNYXBDYiwgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzPlxuZXhwb3J0IHR5cGUgRGVmYXVsdFByaXNtYUNsaWVudCA9IFByaXNtYUNsaWVudFxuZXhwb3J0IHR5cGUgRXJyb3JGb3JtYXQgPSAncHJldHR5JyB8ICdjb2xvcmxlc3MnIHwgJ21pbmltYWwnXG4vKipcbiAqIE9wdGlvbnMgY29tbW9uIHRvIGFsbCB2YXJpYW50cyBvZiBgUHJpc21hQ2xpZW50T3B0aW9uc2AsIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB5b3UgY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggYSBkcml2ZXIgYWRhcHRlciBvciB0aHJvdWdoIFByaXNtYSBBY2NlbGVyYXRlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudEJhc2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIEBkZWZhdWx0IFwiY29sb3JsZXNzXCJcbiAgICovXG4gIGVycm9yRm9ybWF0PzogRXJyb3JGb3JtYXRcbiAgLyoqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiAvLyBTaG9ydGhhbmQgZm9yIGBlbWl0OiAnc3Rkb3V0J2BcbiAgICogbG9nOiBbJ3F1ZXJ5JywgJ2luZm8nLCAnd2FybicsICdlcnJvciddXG4gICAqIFxuICAgKiAvLyBFbWl0IGFzIGV2ZW50cyBvbmx5XG4gICAqIGxvZzogW1xuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdxdWVyeScgfSxcbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAnaW5mbycgfSxcbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAnd2FybicgfVxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdlcnJvcicgfVxuICAgKiBdXG4gICAqIFxuICAgKiAvIEVtaXQgYXMgZXZlbnRzIGFuZCBsb2cgdG8gc3Rkb3V0XG4gICAqIG9nOiBbXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ3F1ZXJ5JyB9LFxuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICdpbmZvJyB9LFxuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICd3YXJuJyB9XG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ2Vycm9yJyB9XG4gICAqIFxuICAgKiBgYGBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvbG9nZ2luZykuXG4gICAqL1xuICBsb2c/OiAoTG9nTGV2ZWwgfCBMb2dEZWZpbml0aW9uKVtdXG4gIC8qKlxuICAgKiBUaGUgZGVmYXVsdCB2YWx1ZXMgZm9yIHRyYW5zYWN0aW9uT3B0aW9uc1xuICAgKiBtYXhXYWl0ID89IDIwMDBcbiAgICogdGltZW91dCA/PSA1MDAwXG4gICAqL1xuICB0cmFuc2FjdGlvbk9wdGlvbnM/OiB7XG4gICAgbWF4V2FpdD86IG51bWJlclxuICAgIHRpbWVvdXQ/OiBudW1iZXJcbiAgICBpc29sYXRpb25MZXZlbD86IFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWxcbiAgfVxuICAvKipcbiAgICogR2xvYmFsIGNvbmZpZ3VyYXRpb24gZm9yIG9taXR0aW5nIG1vZGVsIGZpZWxkcyBieSBkZWZhdWx0LlxuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIG9taXQ6IHtcbiAgICogICAgIHVzZXI6IHtcbiAgICogICAgICAgcGFzc3dvcmQ6IHRydWVcbiAgICogICAgIH1cbiAgICogICB9XG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgb21pdD86IEdsb2JhbE9taXRDb25maWdcbiAgLyoqXG4gICAqIFNRTCBjb21tZW50ZXIgcGx1Z2lucyB0aGF0IGFkZCBtZXRhZGF0YSB0byBTUUwgcXVlcmllcyBhcyBjb21tZW50cy5cbiAgICogQ29tbWVudHMgZm9sbG93IHRoZSBzcWxjb21tZW50ZXIgZm9ybWF0OiBodHRwczovL2dvb2dsZS5naXRodWIuaW8vc3FsY29tbWVudGVyL1xuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXIsXG4gICAqICAgY29tbWVudHM6IFtcbiAgICogICAgIHRyYWNlQ29udGV4dCgpLFxuICAgKiAgICAgcXVlcnlJbnNpZ2h0cygpLFxuICAgKiAgIF0sXG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgY29tbWVudHM/OiBydW50aW1lLlNxbENvbW1lbnRlclBsdWdpbltdXG4gIC8qKlxuICAgKiBPcHRpb25hbCBtYXhpbXVtIHNpemUgZm9yIHRoZSBxdWVyeSBwbGFuIGNhY2hlLiBJZiBub3QgcHJvdmlkZWQsIGEgZGVmYXVsdCBzaXplIHdpbGwgYmUgdXNlZC5cbiAgICogQSB2YWx1ZSBvZiBgMGAgY2FuIGJlIHVzZWQgdG8gZGlzYWJsZSB0aGUgY2FjaGUgZW50aXJlbHkuIEEgaGlnaGVyIGNhY2hlIHNpemUgY2FuIGltcHJvdmVcbiAgICogcGVyZm9ybWFuY2UgZm9yIGFwcGxpY2F0aW9ucyB0aGF0IGV4ZWN1dGUgYSBsYXJnZSBudW1iZXIgb2YgdW5pcXVlIHF1ZXJpZXMsIHdoaWxlIGEgc21hbGxlclxuICAgKiBjYWNoZSBzaXplIGNhbiByZWR1Y2UgbWVtb3J5IHVzYWdlLlxuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXIsXG4gICAqICAgcXVlcnlQbGFuQ2FjaGVNYXhTaXplOiAxMDAsXG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgcXVlcnlQbGFuQ2FjaGVNYXhTaXplPzogbnVtYmVyXG59XG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgb3B0aW9ucyBmb3IgY29ubmVjdGluZyB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgaW5zdGVhZCBvZiBhIGRyaXZlciBhZGFwdGVyLlxuICogXG4gKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9hY2NlbGVyYXRlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBY2NlbGVyYXRlVXJsIGV4dGVuZHMgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIFByaXNtYSBBY2NlbGVyYXRlIGNvbm5lY3Rpb24gVVJMLiBVc2UgdGhpcyBvcHRpb24gdG8gY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgaW5zdGVhZCBvZiB1c2luZyBhIGRyaXZlciBhZGFwdGVyIHRvIGNvbm5lY3QgZGlyZWN0bHkuXG4gICAqIFxuICAgKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9hY2NlbGVyYXRlXG4gICAqL1xuICBhY2NlbGVyYXRlVXJsOiBzdHJpbmdcbiAgYWRhcHRlcj86IG5ldmVyXG59XG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgb3B0aW9ucyBmb3IgY29ubmVjdGluZyB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggYSBkcml2ZXIgYWRhcHRlci4gVGhpcyBpcyB0aGUgY29tbW9uIGNhc2UgaW4gUHJpc21hIDcuXG4gKiBcbiAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWRhcHRlciBleHRlbmRzIFByaXNtYUNsaWVudEJhc2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIEEgZHJpdmVyIGFkYXB0ZXIgdGhhdCBQcmlzbWFDbGllbnQgdXNlcyB0byBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UsIHN1Y2ggYXMgdGhlIG9uZXMgcHJvdmlkZWQgYnkgYEBwcmlzbWEvYWRhcHRlci1wZ2AsIGBAcHJpc21hL2FkYXB0ZXItbGlic3FsYCwgYEBwcmlzbWEvYWRhcHRlci1wbGFuZXRzY2FsZWAsIGV0Yy5cbiAgICogXG4gICAqIEEgZHJpdmVyIGFkYXB0ZXIgaXMgKipyZXF1aXJlZCoqIHVubGVzcyB5b3UgY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgKGluIHdoaWNoIGNhc2UgdXNlIGBhY2NlbGVyYXRlVXJsYCBpbnN0ZWFkKS5cbiAgICogXG4gICAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgUHJpc21hUGcgfSBmcm9tICdAcHJpc21hL2FkYXB0ZXItcGcnXG4gICAqIGltcG9ydCB7IFByaXNtYUNsaWVudCB9IGZyb20gJy4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnQnXG4gICAqIFxuICAgKiBjb25zdCBhZGFwdGVyID0gbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoeyBhZGFwdGVyIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgYWRhcHRlcjogcnVudGltZS5TcWxEcml2ZXJBZGFwdGVyRmFjdG9yeVxuICBhY2NlbGVyYXRlVXJsPzogbmV2ZXJcbn1cblxuLyoqXG4gKiBPcHRpb25zIHBhc3NlZCB0byB0aGUgYFByaXNtYUNsaWVudGAgY29uc3RydWN0b3IuXG4gKiBcbiAqIEEgZHJpdmVyIGFkYXB0ZXIgKG9yLCBhbHRlcm5hdGl2ZWx5LCBhIFByaXNtYSBBY2NlbGVyYXRlIFVSTCkgaXMgKipyZXF1aXJlZCoqLiBTZWUge0BsaW5rIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWRhcHRlcn0gYW5kIHtAbGluayBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmx9IGZvciB0aGUgdHdvIHZhcmlhbnRzLiBBbGwgb3RoZXIgcHJvcGVydGllcyBsaXZlIGluIHtAbGluayBQcmlzbWFDbGllbnRCYXNlT3B0aW9uc30gYW5kIGFyZSBvcHRpb25hbC5cbiAqIFxuICogTGVhcm4gbW9yZSBhYm91dCBkcml2ZXIgYWRhcHRlcnM6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICovXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRPcHRpb25zID0gUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBY2NlbGVyYXRlVXJsIHwgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyXG5leHBvcnQgdHlwZSBHbG9iYWxPbWl0Q29uZmlnID0ge1xuICBibG9nUG9zdD86IFByaXNtYS5CbG9nUG9zdE9taXRcbiAgYm9va2luZz86IFByaXNtYS5Cb29raW5nT21pdFxuICBjYXRlZ29yeT86IFByaXNtYS5DYXRlZ29yeU9taXRcbiAgY29udGFjdE1lc3NhZ2U/OiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VPbWl0XG4gIHBheW1lbnQ/OiBQcmlzbWEuUGF5bWVudE9taXRcbiAgcmV2aWV3PzogUHJpc21hLlJldmlld09taXRcbiAgdG91clBhY2thZ2U/OiBQcmlzbWEuVG91clBhY2thZ2VPbWl0XG4gIHVzZXI/OiBQcmlzbWEuVXNlck9taXRcbn1cblxuLyogVHlwZXMgZm9yIExvZ2dpbmcgKi9cbmV4cG9ydCB0eXBlIExvZ0xldmVsID0gJ2luZm8nIHwgJ3F1ZXJ5JyB8ICd3YXJuJyB8ICdlcnJvcidcbmV4cG9ydCB0eXBlIExvZ0RlZmluaXRpb24gPSB7XG4gIGxldmVsOiBMb2dMZXZlbFxuICBlbWl0OiAnc3Rkb3V0JyB8ICdldmVudCdcbn1cblxuZXhwb3J0IHR5cGUgQ2hlY2tJc0xvZ0xldmVsPFQ+ID0gVCBleHRlbmRzIExvZ0xldmVsID8gVCA6IG5ldmVyO1xuXG5leHBvcnQgdHlwZSBHZXRMb2dUeXBlPFQ+ID0gQ2hlY2tJc0xvZ0xldmVsPFxuICBUIGV4dGVuZHMgTG9nRGVmaW5pdGlvbiA/IFRbJ2xldmVsJ10gOiBUXG4+O1xuXG5leHBvcnQgdHlwZSBHZXRFdmVudHM8VCBleHRlbmRzIGFueVtdPiA9IFQgZXh0ZW5kcyBBcnJheTxMb2dMZXZlbCB8IExvZ0RlZmluaXRpb24+XG4gID8gR2V0TG9nVHlwZTxUW251bWJlcl0+XG4gIDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5RXZlbnQgPSB7XG4gIHRpbWVzdGFtcDogRGF0ZVxuICBxdWVyeTogc3RyaW5nXG4gIHBhcmFtczogc3RyaW5nXG4gIGR1cmF0aW9uOiBudW1iZXJcbiAgdGFyZ2V0OiBzdHJpbmdcbn1cblxuZXhwb3J0IHR5cGUgTG9nRXZlbnQgPSB7XG4gIHRpbWVzdGFtcDogRGF0ZVxuICBtZXNzYWdlOiBzdHJpbmdcbiAgdGFyZ2V0OiBzdHJpbmdcbn1cbi8qIEVuZCBUeXBlcyBmb3IgTG9nZ2luZyAqL1xuXG5cbmV4cG9ydCB0eXBlIFByaXNtYUFjdGlvbiA9XG4gIHwgJ2ZpbmRVbmlxdWUnXG4gIHwgJ2ZpbmRVbmlxdWVPclRocm93J1xuICB8ICdmaW5kTWFueSdcbiAgfCAnZmluZEZpcnN0J1xuICB8ICdmaW5kRmlyc3RPclRocm93J1xuICB8ICdjcmVhdGUnXG4gIHwgJ2NyZWF0ZU1hbnknXG4gIHwgJ2NyZWF0ZU1hbnlBbmRSZXR1cm4nXG4gIHwgJ3VwZGF0ZSdcbiAgfCAndXBkYXRlTWFueSdcbiAgfCAndXBkYXRlTWFueUFuZFJldHVybidcbiAgfCAndXBzZXJ0J1xuICB8ICdkZWxldGUnXG4gIHwgJ2RlbGV0ZU1hbnknXG4gIHwgJ2V4ZWN1dGVSYXcnXG4gIHwgJ3F1ZXJ5UmF3J1xuICB8ICdhZ2dyZWdhdGUnXG4gIHwgJ2NvdW50J1xuICB8ICdydW5Db21tYW5kUmF3J1xuICB8ICdmaW5kUmF3J1xuICB8ICdncm91cEJ5J1xuXG4vKipcbiAqIGBQcmlzbWFDbGllbnRgIHByb3h5IGF2YWlsYWJsZSBpbiBpbnRlcmFjdGl2ZSB0cmFuc2FjdGlvbnMuXG4gKi9cbmV4cG9ydCB0eXBlIFRyYW5zYWN0aW9uQ2xpZW50ID0gT21pdDxEZWZhdWx0UHJpc21hQ2xpZW50LCBydW50aW1lLklUWENsaWVudERlbnlMaXN0PlxuXG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4qIFRoaXMgZmlsZSBleHBvcnRzIGFsbCBlbnVtIHJlbGF0ZWQgdHlwZXMgZnJvbSB0aGUgc2NoZW1hLlxuKlxuKiBcdUQ4M0RcdURGRTIgWW91IGNhbiBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5LlxuKi9cblxuZXhwb3J0IGNvbnN0IFJvbGUgPSB7XG4gIFVTRVI6ICdVU0VSJyxcbiAgQUdFTlQ6ICdBR0VOVCcsXG4gIEFETUlOOiAnQURNSU4nXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFJvbGUgPSAodHlwZW9mIFJvbGUpW2tleW9mIHR5cGVvZiBSb2xlXVxuXG5cbmV4cG9ydCBjb25zdCBVc2VyU3RhdHVzID0ge1xuICBBQ1RJVkU6ICdBQ1RJVkUnLFxuICBTVVNQRU5ERUQ6ICdTVVNQRU5ERUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFVzZXJTdGF0dXMgPSAodHlwZW9mIFVzZXJTdGF0dXMpW2tleW9mIHR5cGVvZiBVc2VyU3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBBdXRoUHJvdmlkZXIgPSB7XG4gIENSRURFTlRJQUw6ICdDUkVERU5USUFMJyxcbiAgR09PR0xFOiAnR09PR0xFJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBBdXRoUHJvdmlkZXIgPSAodHlwZW9mIEF1dGhQcm92aWRlcilba2V5b2YgdHlwZW9mIEF1dGhQcm92aWRlcl1cblxuXG5leHBvcnQgY29uc3QgUGFja2FnZVN0YXR1cyA9IHtcbiAgUEVORElORzogJ1BFTkRJTkcnLFxuICBBUFBST1ZFRDogJ0FQUFJPVkVEJyxcbiAgUkVKRUNURUQ6ICdSRUpFQ1RFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGFja2FnZVN0YXR1cyA9ICh0eXBlb2YgUGFja2FnZVN0YXR1cylba2V5b2YgdHlwZW9mIFBhY2thZ2VTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IEJvb2tpbmdTdGF0dXMgPSB7XG4gIFBFTkRJTkc6ICdQRU5ESU5HJyxcbiAgUEFJRDogJ1BBSUQnLFxuICBDT05GSVJNRUQ6ICdDT05GSVJNRUQnLFxuICBDQU5DRUxMRUQ6ICdDQU5DRUxMRUQnLFxuICBDT01QTEVURUQ6ICdDT01QTEVURUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJvb2tpbmdTdGF0dXMgPSAodHlwZW9mIEJvb2tpbmdTdGF0dXMpW2tleW9mIHR5cGVvZiBCb29raW5nU3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBQYXltZW50U3RhdHVzID0ge1xuICBJTklUSUFURUQ6ICdJTklUSUFURUQnLFxuICBTVUNDRVNTOiAnU1VDQ0VTUycsXG4gIEZBSUxFRDogJ0ZBSUxFRCcsXG4gIENBTkNFTExFRDogJ0NBTkNFTExFRCcsXG4gIFJFRlVOREVEOiAnUkVGVU5ERUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBheW1lbnRTdGF0dXMgPSAodHlwZW9mIFBheW1lbnRTdGF0dXMpW2tleW9mIHR5cGVvZiBQYXltZW50U3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBQb3N0U3RhdHVzID0ge1xuICBEUkFGVDogJ0RSQUZUJyxcbiAgUFVCTElTSEVEOiAnUFVCTElTSEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQb3N0U3RhdHVzID0gKHR5cGVvZiBQb3N0U3RhdHVzKVtrZXlvZiB0eXBlb2YgUG9zdFN0YXR1c11cbiIsICIvLyBBcHBFcnJvciBrZWVwcyB0aGUgZXhhY3Qgc2FtZSBcImp1c3QgdGhyb3cgaXRcIiBlcmdvbm9taWNzIGJ1dCBjYXJyaWVzXG4vLyBhIHN0YXR1c0NvZGUgdGhlIGdsb2JhbCBoYW5kbGVyIGNhbiByZWFkIChzZWUgbWlkZGxld2FyZS9nbG9iYWxFcnJvckhhbmRsZXIudHMpLlxuZXhwb3J0IGNsYXNzIEFwcEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBzdGF0dXNDb2RlOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3Ioc3RhdHVzQ29kZTogbnVtYmVyLCBtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSBcIkFwcEVycm9yXCI7XG4gICAgdGhpcy5zdGF0dXNDb2RlID0gc3RhdHVzQ29kZTtcbiAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IFByaXNtYVBnIH0gZnJvbSBcIkBwcmlzbWEvYWRhcHRlci1wZ1wiO1xuaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuY29uc3QgY29ubmVjdGlvblN0cmluZyA9IGNvbmZpZy5kYXRhYmFzZV91cmw7XG5cbi8vIFNlcnZlcmxlc3MtZnJpZW5kbHkgcG9vbDogb25lIGNvbm5lY3Rpb24gcGVyIHdhcm0gaW5zdGFuY2Ugc28gbWFueVxuLy8gY29uY3VycmVudCBpbnZvY2F0aW9ucyBjYW4ndCBleGhhdXN0IHRoZSBkYXRhYmFzZSdzIGNvbm5lY3Rpb24gbGltaXQuXG4vLyBMb2NhbC9WTSBydW5zIGFyZSB1bmFmZmVjdGVkIChhIHNpbmdsZSBwcm9jZXNzIHVzZXMgb25lIGNvbm5lY3Rpb24gYW55d2F5KS5cbmNvbnN0IGFkYXB0ZXIgPSBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nLCBtYXg6IDEgfSk7XG5jb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHsgYWRhcHRlciB9KTtcblxuZXhwb3J0IHsgcHJpc21hIH07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IGF1dGhDb250cm9sbGVyIH0gZnJvbSBcIi4vYXV0aC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBhdXRoVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9hdXRoLnZhbGlkYXRpb25cIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBSZWdpc3RlciBcdTIwMTQgcm9sZSBpcyBvcHRpb25hbCBhbmQgcmVzdHJpY3RlZCB0byBVU0VSL0FHRU5UIGluIHRoZSBzZXJ2aWNlXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVnaXN0ZXJcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLnJlZ2lzdGVyU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZWdpc3RlclVzZXIsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvbG9naW5cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmxvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5sb2dpblVzZXIsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZ29vZ2xlXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5nb29nbGVMb2dpblNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIuZ29vZ2xlTG9naW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZGVtby1sb2dpblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMuZGVtb0xvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5kZW1vTG9naW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVmcmVzaFwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVmcmVzaFRva2VuU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZWZyZXNoVG9rZW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcIi9sb2dvdXRcIiwgYXV0aCgpLCBhdXRoQ29udHJvbGxlci5sb2dvdXRVc2VyKTtcblxucm91dGVyLmdldChcIi9tZVwiLCBhdXRoKCksIGF1dGhDb250cm9sbGVyLmdldE1lKTtcblxuZXhwb3J0IGNvbnN0IGF1dGhSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBhdXRoU2VydmljZSB9IGZyb20gXCIuL2F1dGguc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbmNvbnN0IGlzUHJvZHVjdGlvbiA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcInByb2R1Y3Rpb25cIjtcblxuLy8gRGV2IChsb2NhbGhvc3Q6MzAwMCBcdTIxOTIgOjQwMDApIGlzIHNhbWUtc2l0ZSBcdTIxOTIgbGF4IHdvcmtzIHdpdGggc2VjdXJlOmZhbHNlLlxuLy8gUHJvZCAoY3Jvc3Mtc2l0ZSBmcm9udGVuZC9iYWNrZW5kKSByZXF1aXJlcyBTYW1lU2l0ZT1Ob25lICsgU2VjdXJlLlxuY29uc3QgY29va2llT3B0aW9uczoge1xuICBodHRwT25seTogdHJ1ZTtcbiAgc2VjdXJlOiBib29sZWFuO1xuICBzYW1lU2l0ZTogXCJsYXhcIiB8IFwibm9uZVwiO1xufSA9IHtcbiAgaHR0cE9ubHk6IHRydWUsXG4gIHNlY3VyZTogaXNQcm9kdWN0aW9uLFxuICBzYW1lU2l0ZTogaXNQcm9kdWN0aW9uID8gXCJub25lXCIgOiBcImxheFwiLFxufTtcblxuY29uc3QgQUNDRVNTX0NPT0tJRV9NQVhfQUdFID0gMjQgKiA2MCAqIDYwICogMTAwMDsgLy8gMSBkYXlcbmNvbnN0IFJFRlJFU0hfQ09PS0lFX01BWF9BR0UgPSAzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDA7IC8vIDMwIGRheXNcblxuY29uc3Qgc2V0QXV0aENvb2tpZXMgPSAoXG4gIHJlczogUmVzcG9uc2UsXG4gIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9OiB7IGFjY2Vzc1Rva2VuOiBzdHJpbmc7IHJlZnJlc2hUb2tlbjogc3RyaW5nIH0sXG4pID0+IHtcbiAgcmVzLmNvb2tpZShcImFjY2Vzc1Rva2VuXCIsIGFjY2Vzc1Rva2VuLCB7XG4gICAgLi4uY29va2llT3B0aW9ucyxcbiAgICBtYXhBZ2U6IEFDQ0VTU19DT09LSUVfTUFYX0FHRSxcbiAgfSk7XG4gIHJlcy5jb29raWUoXCJyZWZyZXNoVG9rZW5cIiwgcmVmcmVzaFRva2VuLCB7XG4gICAgLi4uY29va2llT3B0aW9ucyxcbiAgICBtYXhBZ2U6IFJFRlJFU0hfQ09PS0lFX01BWF9BR0UsXG4gIH0pO1xufTtcblxuY29uc3QgY2xlYXJBdXRoQ29va2llcyA9IChyZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHJlcy5jbGVhckNvb2tpZShcImFjY2Vzc1Rva2VuXCIsIGNvb2tpZU9wdGlvbnMpO1xuICByZXMuY2xlYXJDb29raWUoXCJyZWZyZXNoVG9rZW5cIiwgY29va2llT3B0aW9ucyk7XG59O1xuXG4vLyBSZWdpc3RlciBjb250cm9sbGVyXG5jb25zdCByZWdpc3RlclVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgYXV0aFNlcnZpY2UucmVnaXN0ZXJVc2VyKHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgUmVnaXN0ZXJlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gTG9naW4gY29udHJvbGxlclxuY29uc3QgbG9naW5Vc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0gPSBhd2FpdCBhdXRoU2VydmljZS5sb2dpblVzZXIocmVxLmJvZHkpO1xuXG4gICAgc2V0QXV0aENvb2tpZXMocmVzLCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdvb2dsZSBsb2dpbiAoSUQtdG9rZW4gZmxvdylcbmNvbnN0IGdvb2dsZUxvZ2luID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0gPSBhd2FpdCBhdXRoU2VydmljZS5nb29nbGVMb2dpbihcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gRGVtbyBsb2dpbiBjb250cm9sbGVyXG5jb25zdCBkZW1vTG9naW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmRlbW9Mb2dpbihcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEZW1vIHVzZXIgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBSZWZyZXNoIHRva2VuIGNvbnRyb2xsZXJcbmNvbnN0IHJlZnJlc2hUb2tlbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlZnJlc2hUb2tlbkZyb21Db29raWUgPSByZXEuY29va2llcy5yZWZyZXNoVG9rZW47XG4gICAgY29uc3QgcmVmcmVzaFRva2VuRnJvbUJvZHkgPSByZXEuYm9keT8ucmVmcmVzaFRva2VuO1xuXG4gICAgaWYgKCFyZWZyZXNoVG9rZW5Gcm9tQ29va2llICYmICFyZWZyZXNoVG9rZW5Gcm9tQm9keSkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuVU5BVVRIT1JJWkVELFxuICAgICAgICBtZXNzYWdlOiBcIlJlZnJlc2ggdG9rZW4gaXMgcmVxdWlyZWRcIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbjogbmV3UmVmcmVzaFRva2VuIH0gPVxuICAgICAgYXdhaXQgYXV0aFNlcnZpY2UucmVmcmVzaFRva2VuKHtcbiAgICAgICAgcmVmcmVzaFRva2VuOiByZWZyZXNoVG9rZW5Gcm9tQ29va2llIHx8IHJlZnJlc2hUb2tlbkZyb21Cb2R5LFxuICAgICAgfSk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHtcbiAgICAgIGFjY2Vzc1Rva2VuLFxuICAgICAgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4sXG4gICAgfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVG9rZW4gcmVmcmVzaGVkIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4gfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIExvZ291dCBjb250cm9sbGVyXG5jb25zdCBsb2dvdXRVc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLmxvZ291dCh1c2VySWQpO1xuICAgIGNsZWFyQXV0aENvb2tpZXMocmVzKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBvdXQgc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR2V0IE1lIGNvbnRyb2xsZXJcbmNvbnN0IGdldE1lID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhdXRoU2VydmljZS5nZXRNZUZyb21EQih1c2VySWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGF1dGhDb250cm9sbGVyID0ge1xuICByZWdpc3RlclVzZXIsXG4gIGxvZ2luVXNlcixcbiAgZ29vZ2xlTG9naW4sXG4gIGRlbW9Mb2dpbixcbiAgcmVmcmVzaFRva2VuLFxuICBsb2dvdXRVc2VyLFxuICBnZXRNZSxcbn07IiwgImltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5pbXBvcnQgeyBKd3RQYXlsb2FkLCBTaWduT3B0aW9ucyB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IGdvb2dsZUNsaWVudCB9IGZyb20gXCIuLi8uLi9saWIvZ29vZ2xlQXV0aFwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IGp3dFV0aWxzIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2p3dFwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQge1xuICBJQXV0aCxcbiAgSURlbW9Mb2dpblBheWxvYWQsXG4gIElHb29nbGVMb2dpblBheWxvYWQsXG4gIElMb2dpblVzZXIsXG4gIElSZWZyZXNoVG9rZW5QYXlsb2FkLFxufSBmcm9tIFwiLi9hdXRoLmludGVyZmFjZVwiO1xuXG5jb25zdCBidWlsZFRva2VuUGF5bG9hZCA9ICh1c2VyOiB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgcm9sZTogUm9sZTtcbiAgdG9rZW5WZXJzaW9uOiBudW1iZXI7XG59KSA9PiAoe1xuICBpZDogdXNlci5pZCxcbiAgbmFtZTogdXNlci5uYW1lLFxuICBlbWFpbDogdXNlci5lbWFpbCxcbiAgcm9sZTogdXNlci5yb2xlLFxuICB0b2tlblZlcnNpb246IHVzZXIudG9rZW5WZXJzaW9uLFxufSk7XG5cbmNvbnN0IGlzc3VlVG9rZW5zID0gKHVzZXI6IHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICByb2xlOiBSb2xlO1xuICB0b2tlblZlcnNpb246IG51bWJlcjtcbn0pID0+IHtcbiAgY29uc3QgdG9rZW5QYXlsb2FkID0gYnVpbGRUb2tlblBheWxvYWQodXNlcik7XG5cbiAgY29uc3QgYWNjZXNzVG9rZW4gPSBqd3RVdGlscy5jcmVhdGVUb2tlbihcbiAgICB0b2tlblBheWxvYWQsXG4gICAgY29uZmlnLmp3dF9hY2Nlc3Nfc2VjcmV0LFxuICAgIHsgZXhwaXJlc0luOiBjb25maWcuand0X2FjY2Vzc19leHBpcmVzX2luIH0gYXMgU2lnbk9wdGlvbnMsXG4gICk7XG4gIGNvbnN0IHJlZnJlc2hUb2tlbiA9IGp3dFV0aWxzLmNyZWF0ZVRva2VuKFxuICAgIHRva2VuUGF5bG9hZCxcbiAgICBjb25maWcuand0X3JlZnJlc2hfc2VjcmV0LFxuICAgIHsgZXhwaXJlc0luOiBjb25maWcuand0X3JlZnJlc2hfZXhwaXJlc19pbiB9IGFzIFNpZ25PcHRpb25zLFxuICApO1xuXG4gIHJldHVybiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfTtcbn07XG5cbmNvbnN0IHNhbml0aXplVXNlciA9IDxUIGV4dGVuZHMgeyBwYXNzd29yZDogc3RyaW5nIHwgbnVsbCB9Pih1c2VyOiBUKSA9PiB7XG4gIGNvbnN0IHsgcGFzc3dvcmQsIC4uLnJlc3QgfSA9IHVzZXI7XG4gIHJldHVybiByZXN0O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZ2lzdGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcmVnaXN0ZXJVc2VyID0gYXN5bmMgKHBheWxvYWQ6IElBdXRoKSA9PiB7XG4gIGNvbnN0IHsgbmFtZSwgZW1haWwsIHBhc3N3b3JkLCBwaG9uZSwgcm9sZSB9ID0gcGF5bG9hZDtcblxuICAvLyBPbmx5IHVzZXJzL2FnZW50cyBjYW4gc2VsZi1yZWdpc3RlcjsgYWRtaW5zIGFyZSBjcmVhdGVkIHZpYSBkZW1vLWxvZ2luL3NlZWRcbiAgaWYgKHJvbGUgJiYgcm9sZSAhPT0gXCJVU0VSXCIgJiYgcm9sZSAhPT0gXCJBR0VOVFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJSb2xlIG11c3QgYmUgZWl0aGVyIFVTRVIgb3IgQUdFTlRcIik7XG4gIH1cblxuICBjb25zdCBleGlzdGluZ1VzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBlbWFpbCB9LFxuICB9KTtcbiAgaWYgKGV4aXN0aW5nVXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiVXNlciB3aXRoIHRoaXMgZW1haWwgYWxyZWFkeSBleGlzdHNcIik7XG4gIH1cblxuICBjb25zdCBoYXNoZWRQYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgIHBhc3N3b3JkLFxuICAgIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSxcbiAgKTtcblxuICBjb25zdCBjcmVhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgbmFtZSxcbiAgICAgIGVtYWlsLFxuICAgICAgcGFzc3dvcmQ6IGhhc2hlZFBhc3N3b3JkLFxuICAgICAgYXV0aFByb3ZpZGVyOiBcIkNSRURFTlRJQUxcIixcbiAgICAgIHJvbGU6IHJvbGUgfHwgXCJVU0VSXCIsXG4gICAgICBwaG9uZSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGNyZWF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIExvZ2luIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgbG9naW5Vc2VyID0gYXN5bmMgKHBheWxvYWQ6IElMb2dpblVzZXIpID0+IHtcbiAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGVtYWlsIH0sXG4gIH0pO1xuXG4gIGlmICghdXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBlbWFpbCBvciBwYXNzd29yZFwiKTtcbiAgfVxuICBpZiAodXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaGFzIGJlZW4gZGVsZXRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaXMgc3VzcGVuZGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLmF1dGhQcm92aWRlciA9PT0gXCJHT09HTEVcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiVGhpcyBhY2NvdW50IHVzZXMgR29vZ2xlIGxvZ2luLiBQbGVhc2UgbG9nIGluIHdpdGggR29vZ2xlLlwiLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBpc1Bhc3N3b3JkVmFsaWQgPSBhd2FpdCBiY3J5cHQuY29tcGFyZShwYXNzd29yZCwgdXNlci5wYXNzd29yZCB8fCBcIlwiKTtcbiAgaWYgKCFpc1Bhc3N3b3JkVmFsaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIkludmFsaWQgZW1haWwgb3IgcGFzc3dvcmRcIik7XG4gIH1cblxuICByZXR1cm4gaXNzdWVUb2tlbnModXNlcik7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgR29vZ2xlIGxvZ2luIChJRC10b2tlbiBmbG93KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdvb2dsZUxvZ2luID0gYXN5bmMgKHBheWxvYWQ6IElHb29nbGVMb2dpblBheWxvYWQpID0+IHtcbiAgY29uc3QgeyBpZFRva2VuIH0gPSBwYXlsb2FkO1xuXG4gIGlmICghY29uZmlnLmdvb2dsZV9jbGllbnRfaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkdvb2dsZSBsb2dpbiBpcyBub3QgY29uZmlndXJlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cIixcbiAgICApO1xuICB9XG5cbiAgbGV0IHRpY2tldDtcbiAgdHJ5IHtcbiAgICB0aWNrZXQgPSBhd2FpdCBnb29nbGVDbGllbnQudmVyaWZ5SWRUb2tlbih7XG4gICAgICBpZFRva2VuLFxuICAgICAgYXVkaWVuY2U6IGNvbmZpZy5nb29nbGVfY2xpZW50X2lkLFxuICAgIH0pO1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIkludmFsaWQgR29vZ2xlIHRva2VuXCIpO1xuICB9XG5cbiAgY29uc3QgZ29vZ2xlRGF0YSA9IHRpY2tldC5nZXRQYXlsb2FkKCk7XG4gIGlmICghZ29vZ2xlRGF0YSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBHb29nbGUgdG9rZW4gcGF5bG9hZFwiKTtcbiAgfVxuXG4gIGNvbnN0IHsgZW1haWwsIG5hbWUsIHN1YiwgcGljdHVyZSB9ID0gZ29vZ2xlRGF0YTtcblxuICBpZiAoIWVtYWlsIHx8ICFnb29nbGVEYXRhLmVtYWlsX3ZlcmlmaWVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJHb29nbGUgYWNjb3VudCBlbWFpbCBpcyBub3QgdmVyaWZpZWRcIik7XG4gIH1cblxuICBsZXQgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBnb29nbGVJZDogc3ViIH0gfSk7XG5cbiAgLy8gRXhpc3RpbmcgdXNlciBcdTIxOTIgbGluayBHb29nbGUgYWNjb3VudCBpZiBub3QgYWxyZWFkeSBsaW5rZWRcbiAgaWYgKCF1c2VyICYmIGVtYWlsKSB7XG4gICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBlbWFpbCB9IH0pO1xuICAgIGlmICh1c2VyKSB7XG4gICAgICBpZiAodXNlci5nb29nbGVJZCAmJiB1c2VyLmdvb2dsZUlkICE9PSBzdWIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICAgIDQwOSxcbiAgICAgICAgICBcIkVtYWlsIGlzIGFscmVhZHkgbGlua2VkIHRvIGFub3RoZXIgR29vZ2xlIGFjY291bnRcIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogdXNlci5pZCB9LFxuICAgICAgICBkYXRhOiB7IGdvb2dsZUlkOiBzdWIsIGVtYWlsVmVyaWZpZWQ6IHRydWUgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIEJyYW5kIG5ldyB1c2VyXG4gIGlmICghdXNlcikge1xuICAgIGNvbnN0IGxvY2FsUGFydCA9IGVtYWlsLnNwbGl0KFwiQFwiKVswXSA/PyBlbWFpbDtcbiAgICBjb25zdCBkaXNwbGF5TmFtZSA9IChuYW1lID8/IFwiXCIpLnRyaW0oKSB8fCBsb2NhbFBhcnQ7XG4gICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIGVtYWlsLFxuICAgICAgICBuYW1lOiBkaXNwbGF5TmFtZSxcbiAgICAgICAgcGFzc3dvcmQ6IG51bGwsXG4gICAgICAgIGF1dGhQcm92aWRlcjogXCJHT09HTEVcIixcbiAgICAgICAgZ29vZ2xlSWQ6IHN1YixcbiAgICAgICAgZW1haWxWZXJpZmllZDogdHJ1ZSxcbiAgICAgICAgcm9sZTogXCJVU0VSXCIsXG4gICAgICAgIGF2YXRhclVybDogcGljdHVyZSB8fCBudWxsLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHRva2VucyA9IGlzc3VlVG9rZW5zKHVzZXIhKTtcbiAgY29uc3Qgc2FuaXRpemVkVXNlciA9IHNhbml0aXplVXNlcih1c2VyISk7XG5cbiAgcmV0dXJuIHsgLi4udG9rZW5zLCB1c2VyOiBzYW5pdGl6ZWRVc2VyIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgRGVtbyBsb2dpbiAoZ3JhZGluZykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBERU1PX1BBU1NXT1JEID0gXCJkZW1vMTIzXCI7XG5cbmNvbnN0IGRlbW9Mb2dpbiA9IGFzeW5jIChwYXlsb2FkOiBJRGVtb0xvZ2luUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IHJvbGUgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgZGVtb1VzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cHNlcnQoe1xuICAgIHdoZXJlOiB7IGVtYWlsOiBgZGVtby0ke3JvbGUudG9Mb3dlckNhc2UoKX1AdHJpcHZlcnNlLmNvbWAgfSxcbiAgICAvLyByZXN1cnJlY3QgZGVtbyBhY2NvdW50cyB0aGF0IGFuIGFkbWluIHN1c3BlbmRlZCBvciBzb2Z0LWRlbGV0ZWRcbiAgICB1cGRhdGU6IHsgc3RhdHVzOiBcIkFDVElWRVwiLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgY3JlYXRlOiB7XG4gICAgICBuYW1lOiBgRGVtbyAke3JvbGUuY2hhckF0KDApICsgcm9sZS5zbGljZSgxKS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBlbWFpbDogYGRlbW8tJHtyb2xlLnRvTG93ZXJDYXNlKCl9QHRyaXB2ZXJzZS5jb21gLFxuICAgICAgcGFzc3dvcmQ6IGF3YWl0IGJjcnlwdC5oYXNoKERFTU9fUEFTU1dPUkQsIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSksXG4gICAgICBhdXRoUHJvdmlkZXI6IFwiQ1JFREVOVElBTFwiLFxuICAgICAgcm9sZSxcbiAgICAgIHN0YXR1czogXCJBQ1RJVkVcIixcbiAgICAgIGVtYWlsVmVyaWZpZWQ6IHRydWUsXG4gICAgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7IC4uLmlzc3VlVG9rZW5zKGRlbW9Vc2VyKSwgdXNlcjogZGVtb1VzZXIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZWZyZXNoIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcmVmcmVzaFRva2VuID0gYXN5bmMgKHBheWxvYWQ6IElSZWZyZXNoVG9rZW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgcmVmcmVzaFRva2VuOiBwcm92aWRlZFJlZnJlc2hUb2tlbiB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB2ZXJpZmllZCA9IGp3dFV0aWxzLnZlcmlmeVRva2VuKFxuICAgIHByb3ZpZGVkUmVmcmVzaFRva2VuLFxuICAgIGNvbmZpZy5qd3RfcmVmcmVzaF9zZWNyZXQsXG4gICk7XG5cbiAgaWYgKCF2ZXJpZmllZC5zdWNjZXNzKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgdmVyaWZpZWQuZXJyb3IpO1xuICB9XG5cbiAgY29uc3QgeyBpZCwgdG9rZW5WZXJzaW9uOiB0b2tlblRva2VuVmVyc2lvbiB9ID1cbiAgICB2ZXJpZmllZC5kYXRhIGFzIEp3dFBheWxvYWQgJiB7IHRva2VuVmVyc2lvbjogbnVtYmVyIH07XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBpcyBzdXNwZW5kZWRcIik7XG4gIH1cblxuICAvLyB0b2tlblZlcnNpb24gY2hhbmdlZCBcdTIxOTIgdG9rZW5zIHdlcmUgcmV2b2tlZCAobG9nb3V0IC8gcGFzc3dvcmQgY2hhbmdlKVxuICBpZiAodXNlci50b2tlblZlcnNpb24gIT09IHRva2VuVG9rZW5WZXJzaW9uKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJUb2tlbiBpcyBubyBsb25nZXIgdmFsaWQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIik7XG4gIH1cblxuICByZXR1cm4gaXNzdWVUb2tlbnModXNlcik7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTG9nb3V0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgbG9nb3V0ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIGRhdGE6IHsgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0sXG4gIH0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEdldCBtZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldE1lRnJvbURCID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgcmV0dXJuIHVzZXI7XG59O1xuXG5leHBvcnQgY29uc3QgYXV0aFNlcnZpY2UgPSB7XG4gIHJlZ2lzdGVyVXNlcixcbiAgbG9naW5Vc2VyLFxuICBnb29nbGVMb2dpbixcbiAgZGVtb0xvZ2luLFxuICByZWZyZXNoVG9rZW4sXG4gIGxvZ291dCxcbiAgZ2V0TWVGcm9tREIsXG59OyIsICJpbXBvcnQgeyBPQXV0aDJDbGllbnQgfSBmcm9tIFwiZ29vZ2xlLWF1dGgtbGlicmFyeVwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmV4cG9ydCBjb25zdCBnb29nbGVDbGllbnQgPSBuZXcgT0F1dGgyQ2xpZW50KHtcbiAgY2xpZW50SWQ6IGNvbmZpZy5nb29nbGVfY2xpZW50X2lkLFxufSk7IiwgImltcG9ydCBqd3QsIHsgSnd0UGF5bG9hZCwgU2lnbk9wdGlvbnMgfSBmcm9tIFwianNvbndlYnRva2VuXCI7XG5cbmNvbnN0IGNyZWF0ZVRva2VuID0gKFxuICBwYXlsb2FkOiBKd3RQYXlsb2FkLFxuICBzZWNyZXQ6IHN0cmluZyxcbiAgZXhwaXJlc0luOiBTaWduT3B0aW9ucyxcbikgPT4ge1xuICBjb25zdCB0b2tlbiA9IGp3dC5zaWduKHBheWxvYWQsIHNlY3JldCwgZXhwaXJlc0luKTtcblxuICByZXR1cm4gdG9rZW47XG59O1xuXG5jb25zdCB2ZXJpZnlUb2tlbiA9ICh0b2tlbjogc3RyaW5nLCBzZWNyZXQ6IHN0cmluZykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHZlcmlmaWVkVG9rZW4gPSBqd3QudmVyaWZ5KHRva2VuLCBzZWNyZXQpO1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgZGF0YTogdmVyaWZpZWRUb2tlbixcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgY29uc29sZS5sb2coXCJUb2tlbiBWZXJpZmljYXRpb24gRmFpbGVkOlwiLCBlcnJvcik7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgfTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGp3dFV0aWxzID0ge1xuICBjcmVhdGVUb2tlbixcbiAgdmVyaWZ5VG9rZW4sXG59O1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVxdWVzdEhhbmRsZXIsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGNvbnN0IGNhdGNoQXN5bmMgPSAoZm46IFJlcXVlc3RIYW5kbGVyKSA9PiB7XG4gIHJldHVybiBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZm4ocmVxLCByZXMsIG5leHQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICB9XG4gIH07XG59O1xuIiwgImltcG9ydCB7IFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxudHlwZSBUTWV0YSA9IHtcbiAgcGFnZTogbnVtYmVyO1xuICBsaW1pdDogbnVtYmVyO1xuICB0b3RhbDogbnVtYmVyO1xuICB0b3RhbFBhZ2VzOiBudW1iZXI7XG59O1xuXG50eXBlIFRSZXNwb25zZURhdGE8VD4gPSB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHN0YXR1c0NvZGU6IG51bWJlcjtcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBkYXRhOiBUO1xuICBtZXRhPzogVE1ldGE7XG59O1xuXG5leHBvcnQgY29uc3Qgc2VuZFJlc3BvbnNlID0gPFQ+KHJlczogUmVzcG9uc2UsIGRhdGE6IFRSZXNwb25zZURhdGE8VD4pID0+IHtcbiAgcmVzLnN0YXR1cyhkYXRhLnN0YXR1c0NvZGUpLmpzb24oe1xuICAgIHN1Y2Nlc3M6IGRhdGEuc3VjY2VzcyxcbiAgICBtZXNzYWdlOiBkYXRhLm1lc3NhZ2UsXG4gICAgZGF0YTogZGF0YS5kYXRhLFxuICAgIG1ldGE6IGRhdGEubWV0YSxcbiAgfSk7XG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcblxuY29uc3QgcmVnaXN0ZXJTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIG5hbWU6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTmFtZSBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMiwgXCJOYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgxMDAsIFwiTmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIiksXG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbFwiKSxcbiAgcGFzc3dvcmQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFzc3dvcmQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oNiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IGxlYXN0IDYgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoNzIsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBtb3N0IDcyIGNoYXJhY3RlcnNcIiksXG4gIHBob25lOiB6XG4gICAgLnN0cmluZygpXG4gICAgLm1heCgyMCwgXCJQaG9uZSBudW1iZXIgaXMgdG9vIGxvbmdcIilcbiAgICAub3B0aW9uYWwoKSxcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgbG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbFwiKSxcbiAgcGFzc3dvcmQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFzc3dvcmQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgZ29vZ2xlTG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkVG9rZW46IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiR29vZ2xlIGlkVG9rZW4gaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgZGVtb0xvZ2luU2NoZW1hID0gei5vYmplY3Qoe1xuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSwge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgcm9sZVwiLFxuICB9KSxcbn0pO1xuXG4vLyByZWZyZXNoVG9rZW4gbWF5IGNvbWUgZnJvbSB0aGUgaHR0cE9ubHkgY29va2llIE9SIHRoZSByZXF1ZXN0IGJvZHkgXHUyMDE0XG4vLyB2YWxpZGF0aW9uIGlzIGxlbmllbnQgaGVyZTsgdGhlIGNvbnRyb2xsZXIgaGFuZGxlcyBib3RoIHNvdXJjZXMuXG5jb25zdCByZWZyZXNoVG9rZW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJlZnJlc2hUb2tlbjogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUUmVnaXN0ZXJTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZWdpc3RlclNjaGVtYT47XG5leHBvcnQgdHlwZSBUTG9naW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBsb2dpblNjaGVtYT47XG5leHBvcnQgdHlwZSBUR29vZ2xlTG9naW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBnb29nbGVMb2dpblNjaGVtYT47XG5leHBvcnQgdHlwZSBUUmVmcmVzaFRva2VuU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgcmVmcmVzaFRva2VuU2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IGF1dGhWYWxpZGF0aW9ucyA9IHtcbiAgcmVnaXN0ZXJTY2hlbWEsXG4gIGxvZ2luU2NoZW1hLFxuICBnb29nbGVMb2dpblNjaGVtYSxcbiAgZGVtb0xvZ2luU2NoZW1hLFxuICByZWZyZXNoVG9rZW5TY2hlbWEsXG59OyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFpvZFR5cGUgfSBmcm9tIFwiem9kXCI7XG5cbnR5cGUgVmFsaWRhdGlvblNjaGVtYSA9IHtcbiAgYm9keT86IFpvZFR5cGU7XG4gIHF1ZXJ5PzogWm9kVHlwZTtcbiAgcGFyYW1zPzogWm9kVHlwZTtcbn07XG5cbi8vIFJ1bnMgWm9kIHNjaGVtYXMgYWdhaW5zdCByZXEuYm9keS9xdWVyeS9wYXJhbXMgYW5kIHJlcGxhY2VzIHRoZSBwYXJzZWRcbi8vIHZhbHVlcyBzbyBkb3duc3RyZWFtIGhhbmRsZXJzIHdvcmsgd2l0aCB2YWxpZGF0ZWQgKGFuZCB0eXBlZCkgZGF0YS5cbi8vIEFueSBab2RFcnJvciB0aHJvd24gaGVyZSBpcyBtYXBwZWQgdG8gYSA0MDAgYnkgZ2xvYmFsRXJyb3JIYW5kbGVyLlxuLy9cbi8vIHJlcS5ib2R5IGlzIHNhZmVseSB3cml0YWJsZSwgYnV0IGluIEV4cHJlc3MgNSByZXEucXVlcnkvcmVxLnBhcmFtcyBhcmVcbi8vIGdldHRlci1vbmx5IFx1MjAxNCB0aGV5IG11c3QgYmUgcmVkZWZpbmVkIHZpYSBkZWZpbmVQcm9wZXJ0eSB0byBzd2FwIGluIHRoZVxuLy8gcGFyc2VkIHZhbHVlcy5cbmNvbnN0IHZhbGlkYXRlUmVxdWVzdCA9IChzY2hlbWE6IFZhbGlkYXRpb25TY2hlbWEpID0+IHtcbiAgcmV0dXJuIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGlmIChzY2hlbWEuYm9keSkge1xuICAgICAgcmVxLmJvZHkgPSBzY2hlbWEuYm9keS5wYXJzZShyZXEuYm9keSk7XG4gICAgfVxuICAgIGlmIChzY2hlbWEucXVlcnkpIHtcbiAgICAgIGNvbnN0IHBhcnNlZFF1ZXJ5ID0gc2NoZW1hLnF1ZXJ5LnBhcnNlKHJlcS5xdWVyeSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVxLCBcInF1ZXJ5XCIsIHtcbiAgICAgICAgdmFsdWU6IHBhcnNlZFF1ZXJ5LFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChzY2hlbWEucGFyYW1zKSB7XG4gICAgICBjb25zdCBwYXJzZWRQYXJhbXMgPSBzY2hlbWEucGFyYW1zLnBhcnNlKHJlcS5wYXJhbXMpO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHJlcSwgXCJwYXJhbXNcIiwge1xuICAgICAgICB2YWx1ZTogcGFyc2VkUGFyYW1zLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgbmV4dCgpO1xuICB9O1xufTtcblxuZXhwb3J0IGRlZmF1bHQgdmFsaWRhdGVSZXF1ZXN0OyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IEp3dFBheWxvYWQgfSBmcm9tIFwianNvbndlYnRva2VuXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IGp3dFV0aWxzIH0gZnJvbSBcIi4uL3V0aWxzL2p3dFwiO1xuXG4vLyBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pIFx1MjE5MiBvbmx5IHRob3NlIHJvbGVzIHBhc3Ncbi8vIGF1dGgoKSBcdTIxOTIgYW55IGF1dGhlbnRpY2F0ZWQgdXNlciBwYXNzZXNcbmNvbnN0IGF1dGggPSAoLi4ucmVxdWlyZWRSb2xlczogUm9sZVtdKSA9PiB7XG4gIHJldHVybiBjYXRjaEFzeW5jKGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLmNvb2tpZXMuYWNjZXNzVG9rZW5cbiAgICAgID8gcmVxLmNvb2tpZXMuYWNjZXNzVG9rZW5cbiAgICAgIDogcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbj8uc3RhcnRzV2l0aChcIkJlYXJlciBcIilcbiAgICAgICAgPyByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uLnNwbGl0KFwiIFwiKVsxXVxuICAgICAgICA6IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb247XG5cbiAgICAvLyAxLiB0b2tlbiBtdXN0IGJlIHByZXNlbnRcbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMSxcbiAgICAgICAgXCJZb3UgYXJlIG5vdCBsb2dnZWQgaW4uIFBsZWFzZSBsb2dpbiB0byBjb250aW51ZS5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gMi4gdmVyaWZ5IHRoZSBhY2Nlc3MgdG9rZW5cbiAgICBjb25zdCB2ZXJpZmllZFRva2VuID0gand0VXRpbHMudmVyaWZ5VG9rZW4oXG4gICAgICB0b2tlbixcbiAgICAgIGNvbmZpZy5qd3RfYWNjZXNzX3NlY3JldCxcbiAgICApO1xuXG4gICAgaWYgKCF2ZXJpZmllZFRva2VuLnN1Y2Nlc3MpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIHZlcmlmaWVkVG9rZW4uZXJyb3IpO1xuICAgIH1cblxuICAgIGNvbnN0IHsgaWQsIHRva2VuVmVyc2lvbiB9ID0gdmVyaWZpZWRUb2tlbi5kYXRhIGFzIEp3dFBheWxvYWQgJiB7XG4gICAgICB0b2tlblZlcnNpb246IG51bWJlcjtcbiAgICB9O1xuXG4gICAgLy8gMy4gcmUtZmV0Y2ggdXNlciB0byBlbmZvcmNlIGFjY291bnQgc3RhdGUgb24gZXZlcnkgcmVxdWVzdFxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiVXNlciBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDMsXG4gICAgICAgIFwiVXNlciBpcyBzdXNwZW5kZWQuIFBsZWFzZSBjb250YWN0IHN1cHBvcnQgc2VydmljZS5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gNC4gdG9rZW5WZXJzaW9uIG11c3QgbWF0Y2ggREIgKGxvZ291dCAvIHBhc3N3b3JkIGNoYW5nZSBraWxscyBvbGQgdG9rZW5zKVxuICAgIGlmICh1c2VyLnRva2VuVmVyc2lvbiAhPT0gdG9rZW5WZXJzaW9uKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMSxcbiAgICAgICAgXCJTZXNzaW9uIGlzIG5vIGxvbmdlciB2YWxpZC4gUGxlYXNlIGxvZ2luIGFnYWluLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA1LiBhdXRob3JpemF0aW9uIHVzZXMgdGhlIERCIHJvbGUsIG5vdCB0aGUgKHBvc3NpYmx5IHN0YWxlKSBKV1Qgcm9sZVxuICAgIGlmIChyZXF1aXJlZFJvbGVzLmxlbmd0aCAmJiAhcmVxdWlyZWRSb2xlcy5pbmNsdWRlcyh1c2VyLnJvbGUpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIGFjY2VzcyB0aGlzIHJvdXRlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA2LiBhdHRhY2ggdGhlIGF1dGhlbnRpY2F0ZWQgdXNlciB0byB0aGUgcmVxdWVzdFxuICAgIHJlcS51c2VyID0ge1xuICAgICAgaWQ6IHVzZXIuaWQsXG4gICAgICBuYW1lOiB1c2VyLm5hbWUsXG4gICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgIHJvbGU6IHVzZXIucm9sZSxcbiAgICB9O1xuXG4gICAgbmV4dCgpO1xuICB9KTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGF1dGg7IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyB1c2VyQ29udHJvbGxlciB9IGZyb20gXCIuL3VzZXIuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgdXNlclZhbGlkYXRpb25zIH0gZnJvbSBcIi4vdXNlci52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBPd24gcHJvZmlsZSBcdTIwMTQgYW55IGF1dGhlbnRpY2F0ZWQgdXNlclxucm91dGVyLnBhdGNoKFxuICBcIi9wcm9maWxlXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogdXNlclZhbGlkYXRpb25zLnVwZGF0ZVByb2ZpbGVTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLnVwZGF0ZVByb2ZpbGUsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgbGlzdCB1c2VycyB3aXRoIGZpbHRlcnMgKyBwYWdpbmF0aW9uXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHVzZXJWYWxpZGF0aW9ucy51c2VyUXVlcnlTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLmdldFVzZXJzLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IHJvbGUgbWFuYWdlbWVudFxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvcm9sZVwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogdXNlclZhbGlkYXRpb25zLmNoYW5nZVJvbGVTY2hlbWEsXG4gIH0pLFxuICB1c2VyQ29udHJvbGxlci5jaGFuZ2VSb2xlLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IHN0YXR1cyBtYW5hZ2VtZW50XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHVzZXJWYWxpZGF0aW9ucy51c2VyUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHVzZXJWYWxpZGF0aW9ucy5jaGFuZ2VTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICB1c2VyQ29udHJvbGxlci5jaGFuZ2VTdGF0dXMsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgc29mdCBkZWxldGVcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHVzZXJWYWxpZGF0aW9ucy51c2VyUGFyYW1zU2NoZW1hIH0pLFxuICB1c2VyQ29udHJvbGxlci5kZWxldGVVc2VyLFxuKTtcblxuZXhwb3J0IGNvbnN0IHVzZXJSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyB1c2VyU2VydmljZSB9IGZyb20gXCIuL3VzZXIuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIFVwZGF0ZSBwcm9maWxlIGNvbnRyb2xsZXJcbmNvbnN0IHVwZGF0ZVByb2ZpbGUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHVzZXJTZXJ2aWNlLnVwZGF0ZVByb2ZpbGUodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUHJvZmlsZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgYWxsIHVzZXJzIChhZG1pbilcbmNvbnN0IGdldFVzZXJzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXNlclNlcnZpY2UuZ2V0VXNlcnMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VycyBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBVcGRhdGUgdXNlciByb2xlIChhZG1pbilcbmNvbnN0IGNoYW5nZVJvbGUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IGRvd25ncmFkZS9jaGFuZ2UgdGhlaXIgb3duIHJvbGVcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgY2hhbmdlIHlvdXIgb3duIHJvbGUuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuY2hhbmdlUm9sZShpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgcm9sZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBVcGRhdGUgdXNlciBzdGF0dXMgKGFkbWluKVxuY29uc3QgY2hhbmdlU3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICAvLyBhbiBhZG1pbiBtdXN0IG5vdCBzdXNwZW5kL2FjdGl2YXRlIHRoZWlyIG93biBhY2NvdW50XG4gICAgaWYgKGlkID09PSByZXEudXNlcj8uaWQpIHtcbiAgICAgIHJldHVybiBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkZPUkJJRERFTixcbiAgICAgICAgbWVzc2FnZTogXCJZb3UgY2Fubm90IGNoYW5nZSB5b3VyIG93biBzdGF0dXMuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuY2hhbmdlU3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gU29mdCBkZWxldGUgdXNlciAoYWRtaW4pXG5jb25zdCBkZWxldGVVc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICAvLyBhbiBhZG1pbiBtdXN0IG5vdCBkZWxldGUgdGhlaXIgb3duIGFjY291bnRcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgZGVsZXRlIHlvdXIgb3duIGFjY291bnQuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuZGVsZXRlVXNlcihpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgdXNlckNvbnRyb2xsZXIgPSB7XG4gIHVwZGF0ZVByb2ZpbGUsXG4gIGdldFVzZXJzLFxuICBjaGFuZ2VSb2xlLFxuICBjaGFuZ2VTdGF0dXMsXG4gIGRlbGV0ZVVzZXIsXG59OyIsICJpbXBvcnQgYmNyeXB0IGZyb20gXCJiY3J5cHRqc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgUm9sZSwgVXNlclN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQge1xuICBJQ2hhbmdlUm9sZSxcbiAgSUNoYW5nZVN0YXR1cyxcbiAgSVVwZGF0ZVByb2ZpbGUsXG4gIElVc2VyUXVlcnksXG59IGZyb20gXCIuL3VzZXIuaW50ZXJmYWNlXCI7XG5cbmNvbnN0IHZhbGlkYXRlQWN0aXZlVXNlciA9IGFzeW5jIChpZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcblxuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiVXNlciBpcyBzdXNwZW5kZWQuIFBsZWFzZSBjb250YWN0IHN1cHBvcnQgc2VydmljZS5cIik7XG4gIH1cblxuICByZXR1cm4gdXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBVcGRhdGUgcHJvZmlsZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHVwZGF0ZVByb2ZpbGUgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHBheWxvYWQ6IElVcGRhdGVQcm9maWxlKSA9PiB7XG4gIGNvbnN0IHsgbmFtZSwgcGhvbmUsIGF2YXRhclVybCwgY3VycmVudFBhc3N3b3JkLCBuZXdQYXNzd29yZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogdXNlcklkIH0gfSk7XG5cbiAgaWYgKHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGhhcyBiZWVuIGRlbGV0ZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAzLFxuICAgICAgXCJHb29nbGUgYWNjb3VudHMgY2Fubm90IGNoYW5nZSBwYXNzd29yZC4gVXNlIEdvb2dsZSBzaWduLWluIHRvIG1hbmFnZSB5b3VyIHByb2ZpbGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5Vc2VyVXBkYXRlSW5wdXQgPSB7fTtcblxuICBpZiAobmFtZSkgZGF0YS5uYW1lID0gbmFtZTtcbiAgaWYgKHBob25lKSBkYXRhLnBob25lID0gcGhvbmU7XG4gIGlmIChhdmF0YXJVcmwpIGRhdGEuYXZhdGFyVXJsID0gYXZhdGFyVXJsO1xuXG4gIC8vIFBhc3N3b3JkIGNoYW5nZSByZXF1aXJlcyBjdXJyZW50UGFzc3dvcmQgKyBuZXdQYXNzd29yZFxuICBpZiAobmV3UGFzc3dvcmQpIHtcbiAgICBpZiAoIWN1cnJlbnRQYXNzd29yZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDdXJyZW50IHBhc3N3b3JkIGlzIHJlcXVpcmVkXCIpO1xuICAgIH1cbiAgICBpZiAoY3VycmVudFBhc3N3b3JkID09PSBuZXdQYXNzd29yZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJOZXcgcGFzc3dvcmQgbXVzdCBiZSBkaWZmZXJlbnRcIik7XG4gICAgfVxuXG4gICAgY29uc3QgaXNNYXRjaCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKGN1cnJlbnRQYXNzd29yZCwgdXNlci5wYXNzd29yZCB8fCBcIlwiKTtcbiAgICBpZiAoIWlzTWF0Y2gpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBjdXJyZW50IHBhc3N3b3JkXCIpO1xuICAgIH1cblxuICAgIGRhdGEucGFzc3dvcmQgPSBhd2FpdCBiY3J5cHQuaGFzaChcbiAgICAgIG5ld1Bhc3N3b3JkLFxuICAgICAgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpLFxuICAgICk7XG4gICAgZGF0YS50b2tlblZlcnNpb24gPSB7IGluY3JlbWVudDogMSB9O1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBkYXRhLFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBsaXN0IHVzZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0VXNlcnMgPSBhc3luYyAocXVlcnk6IElVc2VyUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgfHwgMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCB8fCAxMDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlVzZXJXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gIH07XG5cbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIHdoZXJlLk9SID0gW1xuICAgICAgeyBuYW1lOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICB7IGVtYWlsOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgXTtcbiAgfVxuICBpZiAocXVlcnkucm9sZSkgd2hlcmUucm9sZSA9IHF1ZXJ5LnJvbGU7XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcblxuICBjb25zdCBbdXNlcnMsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudXNlci5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIHNraXA6IChwYWdlIC0gMSkgKiBsaW1pdCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gICAgfSksXG4gICAgcHJpc21hLnVzZXIuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiB1c2VycyxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiB1cGRhdGUgcm9sZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNoYW5nZVJvbGUgPSBhc3luYyAoaWQ6IHN0cmluZywgcGF5bG9hZDogSUNoYW5nZVJvbGUpID0+IHtcbiAgY29uc3QgeyByb2xlIH0gPSBwYXlsb2FkO1xuXG4gIGF3YWl0IHZhbGlkYXRlQWN0aXZlVXNlcihpZCk7XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YTogeyByb2xlLCB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB1cGRhdGVkVXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogdXBkYXRlIHN0YXR1cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNoYW5nZVN0YXR1cyA9IGFzeW5jIChpZDogc3RyaW5nLCBwYXlsb2FkOiBJQ2hhbmdlU3RhdHVzKSA9PiB7XG4gIGNvbnN0IHsgc3RhdHVzIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuXG4gIGNvbnN0IHVwZGF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGRhdGE6IHtcbiAgICAgIHN0YXR1cyxcbiAgICAgIC8vIHJlYWN0aXZhdGluZyBwcmVzZXJ2ZXMgdGhlIGFjY291bnQgd2hpbGUgc3VzcGVuZGluZyByZXZva2VzIGFsbCBzZXNzaW9uc1xuICAgICAgLi4uKHN0YXR1cyA9PT0gVXNlclN0YXR1cy5TVVNQRU5ERUQgJiYgeyB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSksXG4gICAgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB1cGRhdGVkVXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogc29mdCBkZWxldGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBkZWxldGVVc2VyID0gYXN5bmMgKGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgY29uc3QgZGVsZXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUsIHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGRlbGV0ZWRVc2VyO1xufTtcblxuZXhwb3J0IGNvbnN0IHVzZXJTZXJ2aWNlID0ge1xuICB1cGRhdGVQcm9maWxlLFxuICBnZXRVc2VycyxcbiAgY2hhbmdlUm9sZSxcbiAgY2hhbmdlU3RhdHVzLFxuICBkZWxldGVVc2VyLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IFJvbGUsIFVzZXJTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCB1cGRhdGVQcm9maWxlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBuYW1lOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC50cmltKClcbiAgICAgIC5taW4oMiwgXCJOYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gICAgcGhvbmU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1heCgyMCwgXCJQaG9uZSBudW1iZXIgaXMgdG9vIGxvbmdcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICAgIGF2YXRhclVybDogei5zdHJpbmcoKS50cmltKCkudXJsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBpbWFnZSBVUkxcIikub3B0aW9uYWwoKSxcbiAgICBjdXJyZW50UGFzc3dvcmQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG4gICAgbmV3UGFzc3dvcmQ6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLm1pbig2LCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzXCIpXG4gICAgICAubWF4KDcyLCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbW9zdCA3MiBjaGFyYWN0ZXJzXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnJlZmluZShcbiAgICAoZGF0YSkgPT5cbiAgICAgIGRhdGEubmV3UGFzc3dvcmQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgZGF0YS5jdXJyZW50UGFzc3dvcmQgIT09IHVuZGVmaW5lZCxcbiAgICB7IG1lc3NhZ2U6IFwiQ3VycmVudCBwYXNzd29yZCBpcyByZXF1aXJlZCB0byBjaGFuZ2UgcGFzc3dvcmRcIiB9LFxuICApO1xuXG5jb25zdCB1c2VyUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkub3B0aW9uYWwoKSxcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUpLm9wdGlvbmFsKCksXG4gIHN0YXR1czogei5uYXRpdmVFbnVtKFVzZXJTdGF0dXMpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgdXNlclBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVXNlciBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBjaGFuZ2VSb2xlU2NoZW1hID0gei5vYmplY3Qoe1xuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSwgeyByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHJvbGVcIiB9KSxcbn0pO1xuXG5jb25zdCBjaGFuZ2VTdGF0dXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHN0YXR1czogei5uYXRpdmVFbnVtKFVzZXJTdGF0dXMsIHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHN0YXR1c1wiLFxuICB9KSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUVXBkYXRlUHJvZmlsZVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHVwZGF0ZVByb2ZpbGVTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFVzZXJRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHVzZXJRdWVyeVNjaGVtYT47XG5cbmV4cG9ydCBjb25zdCB1c2VyVmFsaWRhdGlvbnMgPSB7XG4gIHVwZGF0ZVByb2ZpbGVTY2hlbWEsXG4gIHVzZXJRdWVyeVNjaGVtYSxcbiAgdXNlclBhcmFtc1NjaGVtYSxcbiAgY2hhbmdlUm9sZVNjaGVtYSxcbiAgY2hhbmdlU3RhdHVzU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBtdWx0ZXIgZnJvbSBcIm11bHRlclwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgeyB1cGxvYWRzQ29udHJvbGxlciB9IGZyb20gXCIuL3VwbG9hZHMuY29udHJvbGxlclwiO1xuXG5jb25zdCB1cGxvYWQgPSBtdWx0ZXIoe1xuICBzdG9yYWdlOiBtdWx0ZXIubWVtb3J5U3RvcmFnZSgpLFxuICBsaW1pdHM6IHsgZmlsZVNpemU6IDUgKiAxMDI0ICogMTAyNCB9LFxuICBmaWxlRmlsdGVyOiAoX3JlcSwgZmlsZSwgY2IpID0+IHtcbiAgICBpZiAoL15pbWFnZVxcLyhqcGVnfHBuZ3x3ZWJwKSQvLnRlc3QoZmlsZS5taW1ldHlwZSkpIHtcbiAgICAgIGNiKG51bGwsIHRydWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYihcbiAgICAgICAgT2JqZWN0LmFzc2lnbihuZXcgRXJyb3IoXCJPbmx5IGpwZywgcG5nIG9yIHdlYnAgaW1hZ2VzIGFyZSBhbGxvd2VkXCIpLCB7XG4gICAgICAgICAgY29kZTogXCJJTlZBTElEX0ZJTEVfVFlQRVwiLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfVxuICB9LFxufSk7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvaW1hZ2VcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdXBsb2FkLnNpbmdsZShcImltYWdlXCIpLFxuICB1cGxvYWRzQ29udHJvbGxlci51cGxvYWRJbWFnZSxcbik7XG5cbmV4cG9ydCBjb25zdCB1cGxvYWRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeSB9IGZyb20gXCIuL3VwbG9hZHMuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuXG4vLyBVcGxvYWQgYSBzaW5nbGUgaW1hZ2UgKEFHRU5UL0FETUlOKSBcdTIxOTIgQ2xvdWRpbmFyeVxuY29uc3QgdXBsb2FkSW1hZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBpZiAoIXJlcS5maWxlKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkltYWdlIGZpbGUgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXBsb2FkSW1hZ2VUb0Nsb3VkaW5hcnkocmVxLmZpbGUpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiSW1hZ2UgdXBsb2FkZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZHNDb250cm9sbGVyID0ge1xuICB1cGxvYWRJbWFnZSxcbn07IiwgImltcG9ydCB7IHYyIGFzIGNsb3VkaW5hcnkgfSBmcm9tIFwiY2xvdWRpbmFyeVwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmNsb3VkaW5hcnkuY29uZmlnKHtcbiAgY2xvdWRfbmFtZTogY29uZmlnLmNsb3VkaW5hcnlfY2xvdWRfbmFtZSxcbiAgYXBpX2tleTogY29uZmlnLmNsb3VkaW5hcnlfYXBpX2tleSxcbiAgYXBpX3NlY3JldDogY29uZmlnLmNsb3VkaW5hcnlfYXBpX3NlY3JldCxcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBjbG91ZGluYXJ5OyIsICJpbXBvcnQgY2xvdWRpbmFyeSBmcm9tIFwiLi4vLi4vbGliL2Nsb3VkaW5hcnlcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbmV4cG9ydCBjb25zdCB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeSA9IChcbiAgZmlsZTogRXhwcmVzcy5NdWx0ZXIuRmlsZSxcbik6IFByb21pc2U8eyB1cmw6IHN0cmluZzsgcHVibGljSWQ6IHN0cmluZyB9PiA9PiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3QgdXBsb2FkU3RyZWFtID0gY2xvdWRpbmFyeS51cGxvYWRlci51cGxvYWRfc3RyZWFtKFxuICAgICAgeyBmb2xkZXI6IFwidHJpcHZlcnNlXCIgfSxcbiAgICAgIChlcnJvciwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChlcnJvciB8fCAhcmVzdWx0KSB7XG4gICAgICAgICAgcmVqZWN0KG5ldyBBcHBFcnJvcig0MDAsIFwiSW1hZ2UgdXBsb2FkIGZhaWxlZC4gUGxlYXNlIHRyeSBhZ2Fpbi5cIikpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICByZXNvbHZlKHsgdXJsOiByZXN1bHQuc2VjdXJlX3VybCwgcHVibGljSWQ6IHJlc3VsdC5wdWJsaWNfaWQgfSk7XG4gICAgICB9LFxuICAgICk7XG5cbiAgICB1cGxvYWRTdHJlYW0uZW5kKGZpbGUuYnVmZmVyKTtcbiAgfSk7XG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgY29udGFjdENvbnRyb2xsZXIgfSBmcm9tIFwiLi9jb250YWN0LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGNvbnRhY3RWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2NvbnRhY3QudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSByb3V0ZSAocHVibGljLCBubyBhdXRoKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBjb250YWN0VmFsaWRhdGlvbnMuY3JlYXRlTWVzc2FnZVNjaGVtYSB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIuY3JlYXRlTWVzc2FnZSxcbik7XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyByb3V0ZSAoYWRtaW4gb25seSlcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogY29udGFjdFZhbGlkYXRpb25zLmNvbnRhY3RRdWVyeVNjaGVtYSB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIuZ2V0TWVzc2FnZXMsXG4pO1xuXG4vLyAzLiBNYXJrIHJlc29sdmVkL3VucmVzb2x2ZWQgcm91dGUgKGFkbWluIG9ubHkpXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogY29udGFjdFZhbGlkYXRpb25zLmNvbnRhY3RQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogY29udGFjdFZhbGlkYXRpb25zLnVwZGF0ZVJlc29sdmVkU2NoZW1hLFxuICB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIudXBkYXRlUmVzb2x2ZWQsXG4pO1xuXG5leHBvcnQgY29uc3QgY29udGFjdFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGNvbnRhY3RTZXJ2aWNlIH0gZnJvbSBcIi4vY29udGFjdC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSBjb250cm9sbGVyIChwdWJsaWMpXG5jb25zdCBjcmVhdGVNZXNzYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IGNvbnRhY3RTZXJ2aWNlLmNyZWF0ZU1lc3NhZ2UocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiTWVzc2FnZSBzZW50IHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG1lc3NhZ2UsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBMaXN0IGNvbnRhY3QgbWVzc2FnZXMgY29udHJvbGxlciAoYWRtaW4gb25seSlcbmNvbnN0IGdldE1lc3NhZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGFjdFNlcnZpY2UubGlzdE1lc3NhZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ29udGFjdCBtZXNzYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIE1hcmsgcmVzb2x2ZWQvdW5yZXNvbHZlZCBjb250cm9sbGVyIChhZG1pbiBvbmx5KVxuY29uc3QgdXBkYXRlUmVzb2x2ZWQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCB7IGlzUmVzb2x2ZWQgfSA9IHJlcS5ib2R5O1xuXG4gICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IGNvbnRhY3RTZXJ2aWNlLnJlc29sdmVNZXNzYWdlKGlkLCBpc1Jlc29sdmVkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJNZXNzYWdlIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG1lc3NhZ2UsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgY29udGFjdENvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZU1lc3NhZ2UsXG4gIGdldE1lc3NhZ2VzLFxuICB1cGRhdGVSZXNvbHZlZCxcbn07IiwgImltcG9ydCB7IFJlc2VuZCB9IGZyb20gXCJyZXNlbmRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRhY3RFbWFpbERldGFpbHMge1xuICBuYW1lOiBzdHJpbmc7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIHN1YmplY3Q6IHN0cmluZztcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBjcmVhdGVkQXQ/OiBEYXRlO1xufVxuXG4vLyBMYXppbHkgaW5pdGlhbGlzZWQgc28gdGhlIG1vZHVsZSBpcyBpbXBvcnRhYmxlIGV2ZW4gd2hlbiBSRVNFTkRfQVBJX0tFWVxuLy8gaXMgbm90IGNvbmZpZ3VyZWQgKGUuZy4gbG9jYWwgZGV2IC8gZGVtbyB3aXRob3V0IGVtYWlsKS5cbmxldCByZXNlbmQ6IFJlc2VuZCB8IG51bGwgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXRSZXNlbmQoKTogUmVzZW5kIHwgbnVsbCB7XG4gIGlmIChyZXNlbmQpIHJldHVybiByZXNlbmQ7XG4gIGlmICghY29uZmlnLnJlc2VuZF9hcGlfa2V5KSByZXR1cm4gbnVsbDtcbiAgcmVzZW5kID0gbmV3IFJlc2VuZChjb25maWcucmVzZW5kX2FwaV9rZXkpO1xuICByZXR1cm4gcmVzZW5kO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVIdG1sKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdmFsdWVcbiAgICAucmVwbGFjZSgvJi9nLCBcIiZhbXA7XCIpXG4gICAgLnJlcGxhY2UoLzwvZywgXCImbHQ7XCIpXG4gICAgLnJlcGxhY2UoLz4vZywgXCImZ3Q7XCIpXG4gICAgLnJlcGxhY2UoL1wiL2csIFwiJnF1b3Q7XCIpXG4gICAgLnJlcGxhY2UoLycvZywgXCImIzAzOTtcIik7XG59XG5cbmNvbnN0IGVtYWlsTGF5b3V0ID0gKGNvbnRlbnQ6IHN0cmluZykgPT4gYFxuICA8ZGl2IHN0eWxlPVwiZm9udC1mYW1pbHk6IEFyaWFsLCBIZWx2ZXRpY2EsIHNhbnMtc2VyaWY7IG1heC13aWR0aDogNTYwcHg7IG1hcmdpbjogMCBhdXRvOyBjb2xvcjogIzFhMWExYTtcIj5cbiAgICA8ZGl2IHN0eWxlPVwiYmFja2dyb3VuZDogIzBmNzY2ZTsgcGFkZGluZzogMjRweDsgYm9yZGVyLXJhZGl1czogOHB4IDhweCAwIDA7XCI+XG4gICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAjZmZmZmZmOyBmb250LXNpemU6IDE4cHg7IGZvbnQtd2VpZ2h0OiBib2xkO1wiPlRyaXBWZXJzZTwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IHN0eWxlPVwiYm9yZGVyOiAxcHggc29saWQgI2U1ZTdlYjsgYm9yZGVyLXRvcDogbm9uZTsgcGFkZGluZzogMzJweDsgYm9yZGVyLXJhZGl1czogMCAwIDhweCA4cHg7XCI+XG4gICAgICAke2NvbnRlbnR9XG4gICAgPC9kaXY+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDEycHg7IGNvbG9yOiAjNmI3MjgwOyBtYXJnaW4tdG9wOiAxNnB4OyB0ZXh0LWFsaWduOiBjZW50ZXI7XCI+XG4gICAgICBZb3UgYXJlIHJlY2VpdmluZyB0aGlzIGVtYWlsIGJlY2F1c2Ugb2YgYWN0aXZpdHkgb24gVHJpcFZlcnNlLlxuICAgIDwvcD5cbiAgPC9kaXY+XG5gO1xuXG4vLyBOb3RpZmllcyB0aGUgc3VwcG9ydCBpbmJveCBhYm91dCBhIG5ldyBjb250YWN0IGZvcm0gc3VibWlzc2lvbi5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbiA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBjb250YWN0IG5vdGlmaWNhdGlvbi5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZnJvbSA9IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCI7XG4gIGNvbnN0IGNyZWF0ZWRBdCA9IGRldGFpbHMuY3JlYXRlZEF0Py50b0lTT1N0cmluZygpID8/IFwianVzdCBub3dcIjtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5OZXcgY29udGFjdCBtZXNzYWdlPC9oMj5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5OYW1lPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPkVtYWlsPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGRldGFpbHMuZW1haWwpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+U3ViamVjdDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGRldGFpbHMuc3ViamVjdCl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWNlaXZlZDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChjcmVhdGVkQXQpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgIDwvdGFibGU+XG4gICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6IDE2cHg7IHBhZGRpbmc6IDE2cHg7IGJhY2tncm91bmQ6ICNmOWZhZmI7IGJvcmRlci1yYWRpdXM6IDZweDsgd2hpdGUtc3BhY2U6IHByZS13cmFwO1wiPlxuICAgICAgJHtlc2NhcGVIdG1sKGRldGFpbHMubWVzc2FnZSl9XG4gICAgPC9kaXY+XG4gIGA7XG5cbiAgYXdhaXQgY2xpZW50LmVtYWlscy5zZW5kKHtcbiAgICBmcm9tLFxuICAgIHRvOiBbY29uZmlnLmNvbnRhY3RfcmVjZWl2ZXJfZW1haWxdLFxuICAgIHN1YmplY3Q6IGBOZXcgY29udGFjdCBtZXNzYWdlOiAke2RldGFpbHMuc3ViamVjdH1gLFxuICAgIGh0bWw6IGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICB9KTtcbn07XG5cbi8vIFNlbmRzIGEgY29uZmlybWF0aW9uIHJlcGx5IHRvIHRoZSBwZXJzb24gd2hvIHN1Ym1pdHRlZCB0aGUgZm9ybS5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdEF1dG9SZXBseSA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGNvbnRhY3QgYXV0by1yZXBseS5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZnJvbSA9IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCI7XG4gIGNvbnN0IHJlY2VpdmVyRW1haWwgPSBjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbDtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5UaGFua3MgZm9yIHJlYWNoaW5nIG91dCwgJHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9ITwvaDI+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDE0cHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjMzc0MTUxO1wiPlxuICAgICAgV2UmYXBvczt2ZSByZWNlaXZlZCB5b3VyIG1lc3NhZ2UgYWJvdXRcbiAgICAgIDxzdHJvbmc+JmxkcXVvOyR7ZXNjYXBlSHRtbChkZXRhaWxzLnN1YmplY3QpfSZyZHF1bzs8L3N0cm9uZz4gYW5kIG91ciBzdXBwb3J0XG4gICAgICB0ZWFtIHdpbGwgZ2V0IGJhY2sgdG8geW91IHdpdGhpbiBvbmUgYnVzaW5lc3MgZGF5LlxuICAgIDwvcD5cbiAgYDtcblxuICBhd2FpdCBjbGllbnQuZW1haWxzLnNlbmQoe1xuICAgIGZyb20sXG4gICAgdG86IFtkZXRhaWxzLmVtYWlsXSxcbiAgICByZXBseVRvOiByZWNlaXZlckVtYWlsLFxuICAgIHN1YmplY3Q6IFwiV2UgcmVjZWl2ZWQgeW91ciBtZXNzYWdlIC0gVHJpcFZlcnNlXCIsXG4gICAgaHRtbDogZW1haWxMYXlvdXQoY29udGVudCksXG4gIH0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEJvb2tpbmcgZW1haWxzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGludGVyZmFjZSBJQm9va2luZ0VtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG4gIHRyYXZlbGVyczogbnVtYmVyO1xuICB0b3RhbFByaWNlOiBudW1iZXI7XG4gIHN0YXR1czogQm9va2luZ1N0YXR1cztcbn1cblxuLy8gSW5mb3JtcyB0aGUgY3VzdG9tZXIgYWJvdXQgYSBib29raW5nIGNyZWF0ZS9jb25maXJtL2NhbmNlbC5cbi8vIEJlc3QtZWZmb3J0IGxpa2UgdGhlIGNvbnRhY3QgZW1haWxzIFx1MjAxNCBhIGZhaWx1cmUgbXVzdCBuZXZlciBmYWlsIHRoZSByZXF1ZXN0LlxuZXhwb3J0IGNvbnN0IHNlbmRCb29raW5nRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElCb29raW5nRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhZGV0YWlscy5lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBib29raW5nIGVtYWlsLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBmcm9tID0gY29uZmlnLmVtYWlsX2Zyb20gfHwgXCJUcmlwVmVyc2UgPG9uYm9hcmRpbmdAcmVzZW5kLmRldj5cIjtcbiAgY29uc3QgdHJhdmVsRGF0ZSA9IGRldGFpbHMudHJhdmVsRGF0ZS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKTtcblxuICBjb25zdCBzdGF0dXNDb3B5OiBSZWNvcmQ8XG4gICAgQm9va2luZ1N0YXR1cyxcbiAgICB7IHN1YmplY3Q6IHN0cmluZzsgaGVhZGluZzogc3RyaW5nOyBib2R5OiBzdHJpbmcgfVxuICA+ID0ge1xuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgcmVjZWl2ZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyByZWNlaXZlZFwiLFxuICAgICAgYm9keTogXCJXZSd2ZSByZWNlaXZlZCB5b3VyIGJvb2tpbmcgcmVxdWVzdC4gVGhlIGFnZW50IHdpbGwgY29uZmlybSBpdCBzaG9ydGx5LlwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuUEFJRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiUGF5bWVudCByZWNlaXZlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJQYXltZW50IHJlY2VpdmVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgcGF5bWVudCBoYXMgYmVlbiByZWNlaXZlZCwgYW5kIHRoZSBhZ2VudCB3aWxsIGNvbmZpcm0geW91ciBib29raW5nIHNob3J0bHkuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgY29uZmlybWVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIkJvb2tpbmcgY29uZmlybWVkXCIsXG4gICAgICBib2R5OiBcIkdyZWF0IG5ld3MgXHUyMDE0IHlvdXIgYm9va2luZyBoYXMgYmVlbiBjb25maXJtZWQuIFdlIGxvb2sgZm9yd2FyZCB0byBob3N0aW5nIHlvdSFcIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyBjYW5jZWxsZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyBjYW5jZWxsZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciBib29raW5nIGhhcyBiZWVuIGNhbmNlbGxlZC4gSWYgdGhpcyB3YXNuJ3QgZXhwZWN0ZWQsIHBsZWFzZSBjb250YWN0IHN1cHBvcnQuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DT01QTEVURURdOiB7XG4gICAgICBzdWJqZWN0OiBcIlRyaXAgY29tcGxldGVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIlRyaXAgY29tcGxldGVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgdHJpcCBoYXMgYmVlbiBtYXJrZWQgYXMgY29tcGxldGVkLiBUaGFuayB5b3UgZm9yIHRyYXZlbGxpbmcgd2l0aCBUcmlwVmVyc2UhXCIsXG4gICAgfSxcbiAgfTtcblxuICBjb25zdCBjb3B5ID0gc3RhdHVzQ29weVtkZXRhaWxzLnN0YXR1c107XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+JHtjb3B5LmhlYWRpbmd9PC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBIaSAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0sPGJyLz5cbiAgICAgICR7Y29weS5ib2R5fVxuICAgIDwvcD5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5QYWNrYWdlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5wYWNrYWdlVGl0bGUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VHJhdmVsIGRhdGU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwodHJhdmVsRGF0ZSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWxlcnM8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoU3RyaW5nKGRldGFpbHMudHJhdmVsZXJzKSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5Ub3RhbDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChkZXRhaWxzLnRvdGFsUHJpY2UudG9GaXhlZCgyKSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgPC90YWJsZT5cbiAgYDtcblxuICBhd2FpdCBjbGllbnQuZW1haWxzLnNlbmQoe1xuICAgIGZyb20sXG4gICAgdG86IFtkZXRhaWxzLmVtYWlsXSxcbiAgICBzdWJqZWN0OiBjb3B5LnN1YmplY3QsXG4gICAgaHRtbDogZW1haWxMYXlvdXQoY29udGVudCksXG4gIH0pO1xufTtcblxuLy8gSW5mb3JtcyB0aGUgY3VzdG9tZXIgdGhhdCBhIHBhaWQgYm9va2luZyB3YXMgY2FuY2VsbGVkIGFuZCB0aGUgcGF5bWVudCBoYXNcbi8vIGJlZW4gcmVmdW5kZWQuIEJlc3QtZWZmb3J0IGxpa2UgdGhlIG90aGVyIGVtYWlscy5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlZnVuZEVtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG4gIGFtb3VudDogbnVtYmVyO1xuICByZWZ1bmRSZWZJZD86IHN0cmluZyB8IG51bGw7XG59XG5cbmV4cG9ydCBjb25zdCBzZW5kUmVmdW5kRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElSZWZ1bmRFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIHJlZnVuZCBlbWFpbC5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZnJvbSA9IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCI7XG4gIGNvbnN0IHRyYXZlbERhdGUgPSBkZXRhaWxzLnRyYXZlbERhdGUudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCk7XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+UmVmdW5kIGlzc3VlZDwvaDI+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDE0cHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjMzc0MTUxO1wiPlxuICAgICAgSGkgJHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9LDxici8+XG4gICAgICBZb3VyIGJvb2tpbmcgd2FzIGNhbmNlbGxlZCwgYW5kIDxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChcbiAgICAgICAgZGV0YWlscy5hbW91bnQudG9GaXhlZCgyKSxcbiAgICAgICl9PC9zdHJvbmc+IGhhcyBiZWVuIHJlZnVuZGVkIHRvIHlvdXIgb3JpZ2luYWwgcGF5bWVudCBtZXRob2QuIFBsZWFzZSBhbGxvd1xuICAgICAgNS0xMCBidXNpbmVzcyBkYXlzIGZvciB0aGUgbW9uZXkgdG8gYXBwZWFyLlxuICAgIDwvcD5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5QYWNrYWdlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5wYWNrYWdlVGl0bGUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VHJhdmVsIGRhdGU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwodHJhdmVsRGF0ZSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWZ1bmRlZCBhbW91bnQ8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiYjMjU0Nzske2VzY2FwZUh0bWwoZGV0YWlscy5hbW91bnQudG9GaXhlZCgyKSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICAke2RldGFpbHMucmVmdW5kUmVmSWRcbiAgICAgICAgPyBgXG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWZ1bmQgcmVmZXJlbmNlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGRldGFpbHMucmVmdW5kUmVmSWQpfTwvdGQ+XG4gICAgICA8L3RyPmBcbiAgICAgICAgOiBcIlwifVxuICAgIDwvdGFibGU+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDEzcHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjNmI3MjgwOyBtYXJnaW4tdG9wOiAxNnB4O1wiPlxuICAgICAgSWYgeW91IGhhdmUgYW55IHF1ZXN0aW9ucyBhYm91dCB0aGlzIHJlZnVuZCwgcGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cbiAgICA8L3A+XG4gIGA7XG5cbiAgYXdhaXQgY2xpZW50LmVtYWlscy5zZW5kKHtcbiAgICBmcm9tLFxuICAgIHRvOiBbZGV0YWlscy5lbWFpbF0sXG4gICAgc3ViamVjdDogXCJCb29raW5nIGNhbmNlbGxlZCAmIHJlZnVuZCBpc3N1ZWQgLSBUcmlwVmVyc2VcIixcbiAgICBodG1sOiBlbWFpbExheW91dChjb250ZW50KSxcbiAgfSk7XG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQge1xuICBzZW5kQ29udGFjdEF1dG9SZXBseSxcbiAgc2VuZENvbnRhY3ROb3RpZmljYXRpb24sXG59IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgSUNvbnRhY3RRdWVyeSwgSUNyZWF0ZUNvbnRhY3RQYXlsb2FkIH0gZnJvbSBcIi4vY29udGFjdC5pbnRlcmZhY2VcIjtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSAocHVibGljKVxuY29uc3QgY3JlYXRlTWVzc2FnZSA9IGFzeW5jIChwYXlsb2FkOiBJQ3JlYXRlQ29udGFjdFBheWxvYWQpID0+IHtcbiAgY29uc3QgY3JlYXRlZE1lc3NhZ2UgPSBhd2FpdCBwcmlzbWEuY29udGFjdE1lc3NhZ2UuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICBuYW1lOiBwYXlsb2FkLm5hbWUsXG4gICAgICBlbWFpbDogcGF5bG9hZC5lbWFpbCxcbiAgICAgIHN1YmplY3Q6IHBheWxvYWQuc3ViamVjdCxcbiAgICAgIG1lc3NhZ2U6IHBheWxvYWQubWVzc2FnZSxcbiAgICB9LFxuICB9KTtcblxuICAvLyBFbWFpbHMgYXJlIGJlc3QtZWZmb3J0OiBhIGZhaWx1cmUgaGVyZSBtdXN0IG5ldmVyIGZhaWwgdGhlIHN1Ym1pc3Npb25cbiAgLy8gKHRoZSBtZXNzYWdlIGlzIGFscmVhZHkgc2F2ZWQgdG8gdGhlIGluYm94KS5cbiAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbih7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgICBzZW5kQ29udGFjdEF1dG9SZXBseSh7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIGNyZWF0ZWRNZXNzYWdlO1xufTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIChhZG1pbiBvbmx5LCBwYWdpbmF0ZWQsIGZpbHRlcmFibGUgYnkgaXNSZXNvbHZlZClcbmNvbnN0IGxpc3RNZXNzYWdlcyA9IGFzeW5jIChxdWVyeTogSUNvbnRhY3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VXaGVyZUlucHV0IHwgdW5kZWZpbmVkID1cbiAgICBxdWVyeS5pc1Jlc29sdmVkID09PSB1bmRlZmluZWRcbiAgICAgID8gdW5kZWZpbmVkXG4gICAgICA6IHsgaXNSZXNvbHZlZDogcXVlcnkuaXNSZXNvbHZlZCB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gMy4gTWFyayBhIGNvbnRhY3QgbWVzc2FnZSByZXNvbHZlZC91bnJlc29sdmVkIChhZG1pbiBvbmx5KVxuY29uc3QgcmVzb2x2ZU1lc3NhZ2UgPSBhc3luYyAoaWQ6IHN0cmluZywgaXNSZXNvbHZlZDogYm9vbGVhbikgPT4ge1xuICByZXR1cm4gcHJpc21hLmNvbnRhY3RNZXNzYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IGlzUmVzb2x2ZWQgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgY29udGFjdFNlcnZpY2UgPSB7XG4gIGNyZWF0ZU1lc3NhZ2UsXG4gIGxpc3RNZXNzYWdlcyxcbiAgcmVzb2x2ZU1lc3NhZ2UsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVNZXNzYWdlU2NoZW1hID0gei5vYmplY3Qoe1xuICBuYW1lOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAubWluKDIsIFwiTmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpLFxuICBlbWFpbDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFbWFpbCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5lbWFpbChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWwgYWRkcmVzc1wiKSxcbiAgc3ViamVjdDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJTdWJqZWN0IGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIlN1YmplY3QgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDIwMCwgXCJTdWJqZWN0IG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKSxcbiAgbWVzc2FnZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJNZXNzYWdlIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigxMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbGVhc3QgMTAgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMjAwMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbW9zdCAyMDAwIGNoYXJhY3RlcnNcIiksXG59KS5zdHJpY3QoKTtcblxuY29uc3QgY29udGFjdFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBpc1Jlc29sdmVkOiB6XG4gICAgLmVudW0oW1widHJ1ZVwiLCBcImZhbHNlXCJdKVxuICAgIC5vcHRpb25hbCgpXG4gICAgLnRyYW5zZm9ybSgodmFsKSA9PiAodmFsID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiB2YWwgPT09IFwidHJ1ZVwiKSksXG59KTtcblxuY29uc3QgY29udGFjdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTWVzc2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVSZXNvbHZlZFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgaXNSZXNvbHZlZDogei5ib29sZWFuKHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcImlzUmVzb2x2ZWQgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJpc1Jlc29sdmVkIG11c3QgYmUgYSBib29sZWFuXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiB0eXBlb2YgZGF0YS5pc1Jlc29sdmVkID09PSBcImJvb2xlYW5cIiwge1xuICAgIG1lc3NhZ2U6IFwiaXNSZXNvbHZlZCBtdXN0IGJlIGEgYm9vbGVhblwiLFxuICB9KTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlTWVzc2FnZVNjaGVtYSxcbiAgY29udGFjdFF1ZXJ5U2NoZW1hLFxuICBjb250YWN0UGFyYW1zU2NoZW1hLFxuICB1cGRhdGVSZXNvbHZlZFNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBib29raW5nQ29udHJvbGxlciB9IGZyb20gXCIuL2Jvb2tpbmcuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYm9va2luZ1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYm9va2luZy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBDcmVhdGUgYm9va2luZyAoY3VzdG9tZXIgb25seSBcdTIwMTQgYWdlbnRzIHNlbGwsIGFkbWlucyBtYW5hZ2UpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYm9va2luZ1ZhbGlkYXRpb25zLmNyZWF0ZVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuY3JlYXRlQm9va2luZyxcbik7XG5cbi8vIE15IGJvb2tpbmdzIFx1MjAxNCBvd24gYm9va2luZ3Mgd2l0aCBmaWx0ZXJzICsgcGFnaW5hdGlvbiAob3duZXIgaXMgYWx3YXlzIFVTRVIpXG4vLyBOT1RFOiByZWdpc3RlcmVkIGJlZm9yZSBcIi86aWRcIiBzbyB0aGUgcGFyYW0gcm91dGUgZG9lc24ndCBzd2FsbG93IGl0Llxucm91dGVyLmdldChcbiAgXCIvbXktYm9va2luZ3NcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0TXlCb29raW5ncyxcbik7XG5cbi8vIEFnZW50IGJvb2tpbmdzIFx1MjAxNCBzY29wZWQgdG8gcGFja2FnZXMgdGhlIGFnZW50IG93bnNcbnJvdXRlci5nZXQoXG4gIFwiL2FnZW50LWJvb2tpbmdzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBZ2VudEJvb2tpbmdzLFxuKTtcblxuLy8gQm9va2luZyBkZXRhaWwgXHUyMDE0IG93bmVyIC8gcGFja2FnZSBhZ2VudCAvIGFkbWluXG5yb3V0ZXIuZ2V0KFxuICBcIi86aWRcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRCb29raW5nRGV0YWlsLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IGFsbCBib29raW5nc1xucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBbGxCb29raW5ncyxcbik7XG5cbi8vIFN0YXR1cyB0cmFuc2l0aW9uIFx1MjAxNCB2YWxpZGF0ZWQgYWdhaW5zdCB0aGUgc3RhdGUgbWFjaGluZSBpbiB0aGUgc2VydmljZVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJvb2tpbmdWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBib29raW5nQ29udHJvbGxlci51cGRhdGVCb29raW5nU3RhdHVzLFxuKTtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBib29raW5nU2VydmljZSB9IGZyb20gXCIuL2Jvb2tpbmcuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbmNvbnN0IGNyZWF0ZUJvb2tpbmcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmNyZWF0ZUJvb2tpbmcodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJCb29raW5nIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldE15Qm9va2luZ3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0TXlCb29raW5ncyh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRBZ2VudEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEFnZW50Qm9va2luZ3ModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0Qm9va2luZ0RldGFpbCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEJvb2tpbmdEZXRhaWwoaWQsIHJlcS51c2VyISk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldEFsbEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0QWxsQm9va2luZ3MocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IHVwZGF0ZUJvb2tpbmdTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS51cGRhdGVCb29raW5nU3RhdHVzKFxuICAgICAgaWQsXG4gICAgICByZXEuYm9keSxcbiAgICAgIHJlcS51c2VyISxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmcgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBib29raW5nQ29udHJvbGxlciA9IHtcbiAgY3JlYXRlQm9va2luZyxcbiAgZ2V0TXlCb29raW5ncyxcbiAgZ2V0QWdlbnRCb29raW5ncyxcbiAgZ2V0Qm9va2luZ0RldGFpbCxcbiAgZ2V0QWxsQm9va2luZ3MsXG4gIHVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59OyIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5cbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZy9pbmRleFwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuLy8gUGF5bWVudCBpcyBhbiBvcHRpb25hbCBmZWF0dXJlOiB0aGUgQVBJIG11c3QgYm9vdCBhbmQgc2VydmUgZXZlcnl0aGluZyBlbHNlXG4vLyBldmVuIHdoZW4gdGhlIFNTTENvbW1lcnogc3RvcmUgaXNuJ3QgY29uZmlndXJlZCB5ZXQuIFRoZXNlIHRocm93IGEgY2xlYW4gNDAwXG4vLyBvbiB0aGUgcGF5bWVudC1vbmx5IHBhdGhzIHJhdGhlciB0aGFuIGNyYXNoIHRoZSB3aG9sZSBkZXBsb3ltZW50IGF0IGJvb3QuXG5jb25zdCByZXF1aXJlQ29uZmlnID0gKCkgPT4ge1xuICBpZiAoIWNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9pZCB8fCAhY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJTU0xDb21tZXJ6IGlzIG5vdCBjb25maWd1cmVkLiBTZXQgU1NMX0NPTU1FUlpfU1RPUkVfSUQgYW5kIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELlwiLFxuICAgICk7XG4gIH1cbiAgaWYgKCFjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJTU0xDb21tZXJ6IGlzIG5vdCBjb25maWd1cmVkLiBTZXQgQkFDS0VORF9QVUJMSUNfVVJMIHRvIHRoZSBwdWJsaWNseSByZWFjaGFibGUgYmFja2VuZCBVUkwuXCIsXG4gICAgKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHN0b3JlSWQ6IGNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9pZCxcbiAgICBzdG9yZVBhc3N3b3JkOiBjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfcGFzc3dvcmQsXG4gIH07XG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpJbml0UmVzdWx0IHtcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGZhaWxlZHJlYXNvbj86IHN0cmluZztcbiAgc2Vzc2lvbmtleT86IHN0cmluZztcbiAgR2F0ZXdheVBhZ2VVUkw/OiBzdHJpbmc7XG4gIFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCB7XG4gIHN0YXR1czogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbiAgdmFsX2lkPzogc3RyaW5nO1xuICBhbW91bnQ/OiBzdHJpbmc7XG4gIGN1cnJlbmN5Pzogc3RyaW5nO1xuICBiYW5rX3RyYW5faWQ/OiBzdHJpbmc7XG4gIGNhcmRfdHlwZT86IHN0cmluZztcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQge1xuICBBUElDb25uZWN0Pzogc3RyaW5nO1xuICBzdGF0dXM/OiBzdHJpbmc7IC8vIHN1Y2Nlc3MgfCBmYWlsZWQgfCBwcm9jZXNzaW5nXG4gIGVycm9yUmVhc29uPzogc3RyaW5nO1xuICByZWZ1bmRfcmVmX2lkPzogc3RyaW5nO1xuICBiYW5rX3RyYW5faWQ/OiBzdHJpbmc7XG4gIHRyYW5zX2lkPzogc3RyaW5nO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbi8vIFNTTENvbW1lcnogdHJ1bmNhdGVzIHRyYW5faWQgdG8gMzAgY2hhcnMgXHUyMDE0IGRhdGUgKyB0aW1lICsgcmFuZG9tIHNhbHQgc3RheXMgc2FmZWx5IHVuZGVyLlxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlVHJhbklkKCk6IHN0cmluZyB7XG4gIHJldHVybiBgVFJOWF9JRC0ke0RhdGUubm93KCl9LSR7cmFuZG9tVVVJRCgpLnJlcGxhY2UoLy0vZywgXCJcIikuc2xpY2UoMCwgOCl9YDtcbn1cblxuLy8gSW5pdGlhdGVzIGEgZ2F0ZXdheSBzZXNzaW9uLiBTZXJ2ZXItdG8tc2VydmVyIFBPU1QsIGZvcm0tZW5jb2RlZC4gVGhlIGdhdGV3YXlcbi8vIHJlc3BvbmRzIHdpdGggdGhlIGhvc3RlZCBjaGVja291dCBVUkwgKEdhdGV3YXlQYWdlVVJMKSB0aGUgY3VzdG9tZXIgaXMgc2VudCB0by5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6SW5pdChvcHRpb25zOiB7XG4gIHRvdGFsX2Ftb3VudDogbnVtYmVyO1xuICB0cmFuX2lkOiBzdHJpbmc7XG4gIHN1Y2Nlc3NfdXJsOiBzdHJpbmc7XG4gIGZhaWxfdXJsOiBzdHJpbmc7XG4gIGNhbmNlbF91cmw6IHN0cmluZztcbiAgaXBuX3VybDogc3RyaW5nO1xuICBjdXNfbmFtZTogc3RyaW5nO1xuICBjdXNfZW1haWw6IHN0cmluZztcbiAgY3VzX3Bob25lOiBzdHJpbmc7XG59KTogUHJvbWlzZTxTc2xjb21tZXJ6SW5pdFJlc3VsdD4ge1xuICBjb25zdCB7IHN0b3JlSWQsIHN0b3JlUGFzc3dvcmQgfSA9IHJlcXVpcmVDb25maWcoKTtcbiAgY29uc3QgYm9keSA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICB0b3RhbF9hbW91bnQ6IG9wdGlvbnMudG90YWxfYW1vdW50LnRvRml4ZWQoMiksXG4gICAgY3VycmVuY3k6IFwiQkRUXCIsXG4gICAgdHJhbl9pZDogb3B0aW9ucy50cmFuX2lkLFxuICAgIHN1Y2Nlc3NfdXJsOiBvcHRpb25zLnN1Y2Nlc3NfdXJsLFxuICAgIGZhaWxfdXJsOiBvcHRpb25zLmZhaWxfdXJsLFxuICAgIGNhbmNlbF91cmw6IG9wdGlvbnMuY2FuY2VsX3VybCxcbiAgICBpcG5fdXJsOiBvcHRpb25zLmlwbl91cmwsXG4gICAgY3VzX25hbWU6IG9wdGlvbnMuY3VzX25hbWUsXG4gICAgY3VzX2VtYWlsOiBvcHRpb25zLmN1c19lbWFpbCxcbiAgICBjdXNfYWRkMTogXCJOL0FcIixcbiAgICBjdXNfYWRkMjogXCJOL0FcIixcbiAgICBjdXNfY2l0eTogXCJOL0FcIixcbiAgICBjdXNfc3RhdGU6IFwiTi9BXCIsXG4gICAgY3VzX3Bvc3Rjb2RlOiBcIjEwMDBcIixcbiAgICBjdXNfY291bnRyeTogXCJCYW5nbGFkZXNoXCIsXG4gICAgY3VzX3Bob25lOiBvcHRpb25zLmN1c19waG9uZSxcbiAgICBwcm9kdWN0X25hbWU6IFwiVHJpcFZlcnNlIFRvdXIgQm9va2luZ1wiLFxuICAgIHNoaXBwaW5nX21ldGhvZDogXCJOT1wiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChjb25maWcuc3NsY29tbWVyel9pbml0X3VybCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIH0sXG4gICAgYm9keTogYm9keS50b1N0cmluZygpLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IGluaXQgZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IGluaXQgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuXG4gIGlmIChkYXRhLnN0YXR1cyAhPT0gXCJzdWNjZXNzXCIgfHwgIWRhdGEuR2F0ZXdheVBhZ2VVUkwpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBgU1NMQ29tbWVyeiBpbml0IHJlamVjdGVkOiAke2RhdGEuZmFpbGVkcmVhc29uID8/IGRhdGEuc3RhdHVzfWApO1xuICB9XG4gIHJldHVybiBkYXRhO1xufVxuXG4vLyBTZXJ2ZXItc2lkZSB2ZXJpZmljYXRpb24gb2YgYSBjb21wbGV0ZWQgdHJhbnNhY3Rpb24uIHN0YXR1czogVkFMSUQgLyBWQUxJREFURUQgL1xuLy8gSU5WQUxJRF9UUkFOU0FDVElPTiAvIEZBSUxFRC4gVkFMSURBVEVEIG1lYW5zIHRoZSB0cmFuc2FjdGlvbiB3YXMgdmVyaWZpZWQgYmVmb3JlXG4vLyAoaWRlbXBvdGVudCksIElOVkFMSURfVFJBTlNBQ1RJT04gbWVhbnMgdGhlIGFtb3VudC90cmFuc2FjdGlvbiBtaXNtYXRjaGVzLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpWYWxpZGF0ZShvcHRpb25zOiB7XG4gIHZhbF9pZDogc3RyaW5nO1xufSk6IFByb21pc2U8U3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ+IHtcbiAgY29uc3QgeyBzdG9yZUlkLCBzdG9yZVBhc3N3b3JkIH0gPSByZXF1aXJlQ29uZmlnKCk7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHZhbF9pZDogb3B0aW9ucy52YWxfaWQsXG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIGZvcm1hdDogXCJqc29uXCIsXG4gIH0pO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2NvbmZpZy5zc2xjb21tZXJ6X3ZhbGlkYXRlX3VybH0/JHtwYXJhbXMudG9TdHJpbmcoKX1gLCB7XG4gICAgbWV0aG9kOiBcIkdFVFwiLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IHZhbGlkYXRpb24gZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IHZhbGlkYXRpb24gcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn1cblxuLy8gSW5pdGlhdGVzIGEgcmVmdW5kIGFnYWluc3QgYSBzZXR0bGVkIHRyYW5zYWN0aW9uLiBiYW5rX3RyYW5faWQgaXMgdGhlXG4vLyBvcmlnaW5hbCB0cmFuc2FjdGlvbidzIGJhbmsgdHJhbnNhY3Rpb24gSUQgY2FwdHVyZWQgYXQgcGF5bWVudCB0aW1lLlxuLy8gc3RhdHVzOiBzdWNjZXNzIChpbml0aWF0ZWQpIHwgZmFpbGVkIHwgcHJvY2Vzc2luZyAoYWxyZWFkeSBpbml0aWF0ZWQpLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNzbGNvbW1lcnpSZWZ1bmQob3B0aW9uczoge1xuICBiYW5rX3RyYW5faWQ6IHN0cmluZztcbiAgcmVmdW5kX2Ftb3VudDogbnVtYmVyO1xuICByZWZ1bmRfcmVtYXJrczogc3RyaW5nO1xuICByZWZlX2lkPzogc3RyaW5nO1xufSk6IFByb21pc2U8U3NsY29tbWVyelJlZnVuZFJlc3VsdD4ge1xuICBjb25zdCB7IHN0b3JlSWQsIHN0b3JlUGFzc3dvcmQgfSA9IHJlcXVpcmVDb25maWcoKTtcbiAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgYmFua190cmFuX2lkOiBvcHRpb25zLmJhbmtfdHJhbl9pZCxcbiAgICBzdG9yZV9pZDogc3RvcmVJZCxcbiAgICBzdG9yZV9wYXNzd2Q6IHN0b3JlUGFzc3dvcmQsXG4gICAgcmVmdW5kX2Ftb3VudDogb3B0aW9ucy5yZWZ1bmRfYW1vdW50LnRvRml4ZWQoMiksXG4gICAgcmVmdW5kX3JlbWFya3M6IG9wdGlvbnMucmVmdW5kX3JlbWFya3MsXG4gICAgZm9ybWF0OiBcImpzb25cIixcbiAgICB2OiBcIjFcIixcbiAgfSk7XG4gIGlmIChvcHRpb25zLnJlZmVfaWQpIHBhcmFtcy5zZXQoXCJyZWZlX2lkXCIsIG9wdGlvbnMucmVmZV9pZCk7XG5cbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYCR7Y29uZmlnLnNzbGNvbW1lcnpfcmVmdW5kX3VybH0/JHtwYXJhbXMudG9TdHJpbmcoKX1gLCB7XG4gICAgbWV0aG9kOiBcIkdFVFwiLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IHJlZnVuZCBmYWlsZWQgKCR7cmVzLnN0YXR1c30pYCk7XG5cbiAgbGV0IGRhdGE6IFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ7XG4gIHRyeSB7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UodGV4dCkgYXMgU3NsY29tbWVyelJlZnVuZFJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IHJlZnVuZCByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlXCIpO1xuICB9XG4gIHJldHVybiBkYXRhO1xufSIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMsIFBhY2thZ2VTdGF0dXMsIFBheW1lbnRTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzc2xjb21tZXJ6UmVmdW5kIH0gZnJvbSBcIi4uLy4uL2xpYi9zc2xjb21tZXJ6XCI7XG5pbXBvcnQgeyBzZW5kQm9va2luZ0VtYWlsLCBzZW5kUmVmdW5kRW1haWwgfSBmcm9tIFwiLi4vLi4vdXRpbHMvZW1haWxcIjtcbmltcG9ydCB7XG4gIElCb29raW5nUXVlcnksXG4gIElCb29raW5nU2VhcmNoUXVlcnksXG4gIElDcmVhdGVCb29raW5nLFxuICBJVXBkYXRlQm9va2luZ1N0YXR1cyxcbn0gZnJvbSBcIi4vYm9va2luZy5pbnRlcmZhY2VcIjtcblxuLy8gQSBQRU5ESU5HIGJvb2tpbmcgb2xkZXIgdGhhbiB0aGlzIGlzIHRyZWF0ZWQgYXMgYW4gYWJhbmRvbmVkIGNoZWNrb3V0OlxuLy8gaXQncyBhdXRvLWNhbmNlbGxlZCBzbyB0aGUgdXNlciBjYW4gcmVib29rIHRoZSBzYW1lIHBhY2thZ2UrZGF0ZS5cbmNvbnN0IFNUQUxFX0JPT0tJTkdfSE9VUlMgPSAyNDtcblxuY29uc3QgdG9VVENNaWRuaWdodCA9IChkYXRlOiBEYXRlKSA9PlxuICBuZXcgRGF0ZShcbiAgICBEYXRlLlVUQyhkYXRlLmdldFVUQ0Z1bGxZZWFyKCksIGRhdGUuZ2V0VVRDTW9udGgoKSwgZGF0ZS5nZXRVVENEYXRlKCkpLFxuICApO1xuXG4vLyBcdTI1MDBcdTI1MDAgQWN0b3IgKyBvd25lcnNoaXAgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG50eXBlIEJvb2tpbmdBY3RvciA9IHsgaWQ6IHN0cmluZzsgcm9sZTogUm9sZSB9O1xuXG4vLyBTdHJ1Y3R1cmFsIHN1YnNldCBcdTIwMTQgb25seSB3aGF0IHRoZSBvd25lcnNoaXAgY2hlY2tzIG5lZWQuXG50eXBlIEJvb2tpbmdPd25lckluZm8gPSB7XG4gIHVzZXJJZDogc3RyaW5nO1xuICBwYWNrYWdlOiB7IGFnZW50SWQ6IHN0cmluZyB9O1xufTtcblxuLy8gQm9va2luZyBvd25lciwgdGhlIEFHRU5UIHdobyBvd25zIHRoZSBwYWNrYWdlLCBvciBBRE1JTiBcdTIwMTQgZnVsbCBtYW5hZ2Ugc2NvcGUuXG5jb25zdCBjYW5NYW5hZ2UgPSAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT5cbiAgYm9va2luZy51c2VySWQgPT09IGFjdG9yLmlkIHx8XG4gIChhY3Rvci5yb2xlID09PSBSb2xlLkFHRU5UICYmIGJvb2tpbmcucGFja2FnZS5hZ2VudElkID09PSBhY3Rvci5pZCkgfHxcbiAgYWN0b3Iucm9sZSA9PT0gUm9sZS5BRE1JTjtcblxuLy8gT25seSB0aGUgcGFja2FnZS1vd25pbmcgQUdFTlQgb3IgQURNSU4gY2FuIG1vdmUgYSBib29raW5nJ3MgbW9uZXkgc3RhdHVzXG4vLyAoUEVORElOR1x1MjE5MkNPTkZJUk1FRCwgQ09ORklSTUVEXHUyMTkyQ09NUExFVEVELCBDT05GSVJNRURcdTIxOTJQRU5ESU5HKS5cbmNvbnN0IGlzQWdlbnRPd25lck9yQWRtaW4gPSAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT5cbiAgYWN0b3Iucm9sZSA9PT0gUm9sZS5BRE1JTiB8fFxuICAoYWN0b3Iucm9sZSA9PT0gUm9sZS5BR0VOVCAmJiBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWQpO1xuXG4vLyBcdTI1MDBcdTI1MDAgU3RhdGUgbWFjaGluZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbnR5cGUgVHJhbnNpdGlvblJ1bGUgPSB7XG4gIGFsbG93ZWQ6IChib29raW5nOiBCb29raW5nT3duZXJJbmZvLCBhY3RvcjogQm9va2luZ0FjdG9yKSA9PiBib29sZWFuO1xuICByZXF1aXJlc1RyYXZlbERhdGVQYXNzZWQ/OiBib29sZWFuO1xuICBiZWZvcmVUcmF2ZWxEYXRlPzogYm9vbGVhbjtcbn07XG5cbmNvbnN0IFRSQU5TSVRJT05TOiBQYXJ0aWFsPFxuICBSZWNvcmQ8Qm9va2luZ1N0YXR1cywgUGFydGlhbDxSZWNvcmQ8Qm9va2luZ1N0YXR1cywgVHJhbnNpdGlvblJ1bGU+Pj5cbj4gPSB7XG4gIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXTogeyBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXTogeyBhbGxvd2VkOiBjYW5NYW5hZ2UgfSxcbiAgfSxcbiAgW0Jvb2tpbmdTdGF0dXMuUEFJRF06IHtcbiAgICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7IGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4gfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7IGFsbG93ZWQ6IGNhbk1hbmFnZSB9LFxuICB9LFxuICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09NUExFVEVEXToge1xuICAgICAgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbixcbiAgICAgIHJlcXVpcmVzVHJhdmVsRGF0ZVBhc3NlZDogdHJ1ZSxcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHsgYWxsb3dlZDogY2FuTWFuYWdlIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuUEVORElOR106IHtcbiAgICAgIGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4sXG4gICAgICBiZWZvcmVUcmF2ZWxEYXRlOiB0cnVlLFxuICAgIH0sXG4gIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVzcG9uc2UgbWFwcGluZyAoRGVjaW1hbCBcdTIxOTIgTnVtYmVyKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGJvb2tpbmdQYWNrYWdlU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0aXRsZTogdHJ1ZSxcbiAgICBzbHVnOiB0cnVlLFxuICAgIGxvY2F0aW9uOiB0cnVlLFxuICAgIGltYWdlczogdHJ1ZSxcbiAgICBwcmljZTogdHJ1ZSxcbiAgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIERldGFpbCB2aWV3IGFkZHMgYWdlbnRJZCAobmVlZGVkIGJ5IG93bmVyc2hpcCBjaGVja3MgaW4gdGhlIHNlcnZpY2UpLlxuY29uc3QgYm9va2luZ1BhY2thZ2VEZXRhaWxTZWxlY3QgPSB7XG4gIHNlbGVjdDoge1xuICAgIGlkOiB0cnVlLFxuICAgIHRpdGxlOiB0cnVlLFxuICAgIHNsdWc6IHRydWUsXG4gICAgbG9jYXRpb246IHRydWUsXG4gICAgaW1hZ2VzOiB0cnVlLFxuICAgIHByaWNlOiB0cnVlLFxuICAgIGFnZW50SWQ6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG5jb25zdCBib29raW5nVXNlclNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9LFxufSBhcyBjb25zdDtcblxuLy8gUGF5bWVudCBsZWRnZXIgc2hvd24gb24gdGhlIGJvb2tpbmcgZGV0YWlsIHBhZ2UgKGFtb3VudHMgc3RheSBEZWNpbWFsIGluIERCKS5cbmNvbnN0IGJvb2tpbmdQYXltZW50U2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0cmFuSWQ6IHRydWUsXG4gICAgYW1vdW50OiB0cnVlLFxuICAgIGN1cnJlbmN5OiB0cnVlLFxuICAgIHN0YXR1czogdHJ1ZSxcbiAgICBjYXJkVHlwZTogdHJ1ZSxcbiAgICBiYW5rVHJhbklkOiB0cnVlLFxuICAgIHZhbElkOiB0cnVlLFxuICAgIHBhaWRBdDogdHJ1ZSxcbiAgICByZWZ1bmRSZWZJZDogdHJ1ZSxcbiAgICByZWZ1bmRlZEF0OiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxuLy8gUGF5bWVudHMgb3JkZXJlZCBuZXdlc3QtZmlyc3Qgc28gY29uc3VtZXJzIGNhbiByZWx5IG9uIHBheW1lbnRzWzBdIGJlaW5nIHRoZVxuLy8gbGF0ZXN0IGF0dGVtcHQgKHVzZWQgZm9yIHRoZSB1c2VyIHBheW1lbnQtaGlzdG9yeSBcImxhdGVzdCBzdGF0dXNcIiByb3cpLlxuY29uc3QgYm9va2luZ1BheW1lbnRzSW5jbHVkZSA9IHtcbiAgLi4uYm9va2luZ1BheW1lbnRTZWxlY3QsXG4gIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiBhcyBjb25zdCB9LFxufSBhcyBjb25zdDtcblxudHlwZSBCb29raW5nV2l0UGFja2FnZSA9IFByaXNtYS5Cb29raW5nR2V0UGF5bG9hZDx7XG4gIGluY2x1ZGU6IHsgcGFja2FnZTogdHlwZW9mIGJvb2tpbmdQYWNrYWdlU2VsZWN0IH07XG59PjtcblxuLy8gUGF5bWVudHMgc2hvdyBvbiBsaXN0IHJvd3MgdG9vIChEb0Q6IFwibGlzdC9kZXRhaWwgbm93IGluY2x1ZGVzIHBheW1lbnRzXCIpLFxuLy8gbWFwcGVkIHRvIE51bWJlciBhdCB0aGUgYm91bmRhcnkgbGlrZSB0aGUgcmVzdCBvZiB0aGUgbW9uZXkgZmllbGRzLlxudHlwZSBCb29raW5nUGF5bWVudEl0ZW0gPSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRyYW5JZDogc3RyaW5nO1xuICBhbW91bnQ6IHVua25vd247XG4gIGN1cnJlbmN5OiBzdHJpbmc7XG4gIHN0YXR1czogc3RyaW5nO1xuICBjYXJkVHlwZTogc3RyaW5nIHwgbnVsbDtcbiAgYmFua1RyYW5JZDogc3RyaW5nIHwgbnVsbDtcbiAgdmFsSWQ6IHN0cmluZyB8IG51bGw7XG4gIHBhaWRBdDogRGF0ZSB8IG51bGw7XG59O1xuXG5jb25zdCBtYXBCb29raW5nTGlzdCA9IChib29raW5nOiBCb29raW5nV2l0UGFja2FnZSAmIHsgcGF5bWVudHM/OiBCb29raW5nUGF5bWVudEl0ZW1bXSB9KSA9PiAoe1xuICAuLi5ib29raW5nLFxuICB0b3RhbFByaWNlOiBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKSxcbiAgcGFja2FnZTogeyAuLi5ib29raW5nLnBhY2thZ2UsIHByaWNlOiBOdW1iZXIoYm9va2luZy5wYWNrYWdlLnByaWNlKSB9LFxuICBwYXltZW50czogYm9va2luZy5wYXltZW50cz8ubWFwKChwKSA9PiAoeyAuLi5wLCBhbW91bnQ6IE51bWJlcihwLmFtb3VudCkgfSkpLFxufSk7XG5cbi8vIFx1MjUwMFx1MjUwMCBDcmVhdGUgYm9va2luZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNyZWF0ZUJvb2tpbmcgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHBheWxvYWQ6IElDcmVhdGVCb29raW5nKSA9PiB7XG4gIGNvbnN0IHsgcGFja2FnZUlkLCB0cmF2ZWxlcnMgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IHRyYXZlbERhdGUgPSB0b1VUQ01pZG5pZ2h0KHBheWxvYWQudHJhdmVsRGF0ZSk7XG5cbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICB9KTtcbiAgaWYgKFxuICAgICF0b3VyUGFja2FnZSB8fFxuICAgIHRvdXJQYWNrYWdlLmlzRGVsZXRlZCB8fFxuICAgIHRvdXJQYWNrYWdlLnN0YXR1cyAhPT0gUGFja2FnZVN0YXR1cy5BUFBST1ZFRFxuICApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIlBhY2thZ2UgaXMgbm90IGF2YWlsYWJsZSBmb3IgYm9va2luZy5cIik7XG4gIH1cblxuICAvLyB0b3RhbFByaWNlIGlzIGNvbXB1dGVkIHNlcnZlci1zaWRlIGZyb20gdGhlIHBhY2thZ2UncyBjdXJyZW50IHByaWNlIFx1MjAxNFxuICAvLyBhbnl0aGluZyB0aGUgY2xpZW50IHNlbmRzIGlzIGlnbm9yZWQuXG4gIGNvbnN0IHRvdGFsUHJpY2UgPSBOdW1iZXIodG91clBhY2thZ2UucHJpY2UpICogdHJhdmVsZXJzO1xuXG4gIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgdHguYm9va2luZy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBwYWNrYWdlSWQsXG4gICAgICAgIHRyYXZlbERhdGUsXG4gICAgICAgIHN0YXR1czogQm9va2luZ1N0YXR1cy5QRU5ESU5HLFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgIH0pO1xuXG4gICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICBjb25zdCBpc1JlY2VudCA9XG4gICAgICAgIGV4aXN0aW5nLmNyZWF0ZWRBdC5nZXRUaW1lKCkgPj1cbiAgICAgICAgRGF0ZS5ub3coKSAtIFNUQUxFX0JPT0tJTkdfSE9VUlMgKiA2MCAqIDYwICogMTAwMDtcblxuICAgICAgaWYgKGlzUmVjZW50KSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgICA0MDksXG4gICAgICAgICAgXCJZb3UgYWxyZWFkeSBoYXZlIGEgcGVuZGluZyBib29raW5nIGZvciB0aGlzIHBhY2thZ2Ugb24gdGhpcyBkYXRlLlwiLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBhYmFuZG9uZWQgY2hlY2tvdXQgXHUyMDE0IGNhbmNlbCBpdCBpbiB0aGUgc2FtZSB0cmFuc2FjdGlvbiBhbmQgcmVib29rXG4gICAgICBhd2FpdCB0eC5ib29raW5nLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiBleGlzdGluZy5pZCB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB0eC5ib29raW5nLmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7IHVzZXJJZCwgcGFja2FnZUlkLCB0cmF2ZWxEYXRlLCB0cmF2ZWxlcnMsIHRvdGFsUHJpY2UgfSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gYmVzdC1lZmZvcnQgZW1haWwgXHUyMDE0IG5ldmVyIGZhaWxzIHRoZSByZXF1ZXN0XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0sXG4gIH0pO1xuICBpZiAodXNlcikge1xuICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgICAgbmFtZTogdXNlci5uYW1lLFxuICAgICAgICBwYWNrYWdlVGl0bGU6IHRvdXJQYWNrYWdlLnRpdGxlLFxuICAgICAgICB0cmF2ZWxEYXRlLFxuICAgICAgICB0cmF2ZWxlcnMsXG4gICAgICAgIHRvdGFsUHJpY2UsXG4gICAgICAgIHN0YXR1czogQm9va2luZ1N0YXR1cy5QRU5ESU5HLFxuICAgICAgfSksXG4gICAgXSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLmNyZWF0ZWQsXG4gICAgdG90YWxQcmljZTogTnVtYmVyKGNyZWF0ZWQudG90YWxQcmljZSksXG4gIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTGlzdCBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcGFnaW5hdGVCb29raW5nID0gYXN5bmMgKFxuICB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0LFxuICBpbmNsdWRlOiBQcmlzbWEuQm9va2luZ0luY2x1ZGUsXG4gIHF1ZXJ5OiBJQm9va2luZ1F1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlIHx8IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgfHwgMTA7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYm9va2luZy5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGUsXG4gICAgICBza2lwOiAocGFnZSAtIDEpICogbGltaXQsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgIH0pLFxuICAgIHByaXNtYS5ib29raW5nLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIE15IGJvb2tpbmdzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0TXlCb29raW5ncyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElCb29raW5nUXVlcnkpID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHsgdXNlcklkIH07XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAgeyBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCwgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWdlbnQgYm9va2luZ3MgKHNjb3BlZCB0byBvd24gcGFja2FnZXMpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0QWdlbnRCb29raW5ncyA9IGFzeW5jIChcbiAgYWdlbnRJZDogc3RyaW5nLFxuICBxdWVyeTogSUJvb2tpbmdTZWFyY2hRdWVyeSxcbikgPT4ge1xuICBjb25zdCB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0ge1xuICAgIHBhY2thZ2U6IHsgYWdlbnRJZCB9LFxuICB9O1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG4gIGlmIChxdWVyeS5zZWFyY2gpIHtcbiAgICB3aGVyZS5wYWNrYWdlID0ge1xuICAgICAgYWdlbnRJZCxcbiAgICAgIHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9LFxuICAgIH07XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAgeyBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCwgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQWRtaW46IGFsbCBib29raW5ncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldEFsbEJvb2tpbmdzID0gYXN5bmMgKHF1ZXJ5OiBJQm9va2luZ1NlYXJjaFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7fTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUucGFja2FnZSA9IHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhZ2luYXRlQm9va2luZyhcbiAgICB3aGVyZSxcbiAgICB7XG4gICAgICBwYWNrYWdlOiBib29raW5nUGFja2FnZVNlbGVjdCxcbiAgICAgIHVzZXI6IGJvb2tpbmdVc2VyU2VsZWN0LFxuICAgICAgcGF5bWVudHM6IGJvb2tpbmdQYXltZW50c0luY2x1ZGUsXG4gICAgfSxcbiAgICBxdWVyeSxcbiAgKTtcbiAgcmV0dXJuIHsgLi4ucmVzdWx0LCBkYXRhOiByZXN1bHQuZGF0YS5tYXAobWFwQm9va2luZ0xpc3QpIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQm9va2luZyBkZXRhaWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRCb29raW5nRGV0YWlsID0gYXN5bmMgKGlkOiBzdHJpbmcsIGFjdG9yOiBCb29raW5nQWN0b3IpID0+IHtcbiAgY29uc3QgYm9va2luZyA9IGF3YWl0IHByaXNtYS5ib29raW5nLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgcGFja2FnZTogYm9va2luZ1BhY2thZ2VEZXRhaWxTZWxlY3QsXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICAgIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlLFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG4gIGlmICghY2FuTWFuYWdlKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byB2aWV3IHRoaXMgYm9va2luZy5cIik7XG4gIH1cblxuICByZXR1cm4gbWFwQm9va2luZ0xpc3QoYm9va2luZyk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVmdW5kIChib29raW5nIGNhbmNlbGxlZCB3aXRoIHNldHRsZWQgbW9uZXkpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gUnVucyBBRlRFUiB0aGUgc3RhdHVzLXRyYW5zaXRpb24gdHJhbnNhY3Rpb24gY29tbWl0cywgc28gYSBnYXRld2F5IGZhaWx1cmUgY2FuXG4vLyBuZXZlciByb2xsIGJhY2sgdGhlIGNhbmNlbGxhdGlvbiBpdHNlbGYuIEVhY2ggc2V0dGxlZCBwYXltZW50IGlzIHJlZnVuZGVkIHZpYVxuLy8gdGhlIFNTTENvbW1lcnogUmVmdW5kIEFQSSBhbmQgaXRzIGxlZGdlciByb3cgc3RvcmVzIHRoZSBnYXRld2F5IHJlZmVyZW5jZS5cbnR5cGUgUmVmdW5kQ29udGV4dCA9IHtcbiAgZW1haWw6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBwYWNrYWdlVGl0bGU6IHN0cmluZztcbiAgdHJhdmVsRGF0ZTogRGF0ZTtcbn07XG5cbmNvbnN0IGlzc3VlUmVmdW5kcyA9IGFzeW5jIChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIGN0eDogUmVmdW5kQ29udGV4dCxcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHBheW1lbnRzID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHsgYm9va2luZ0lkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuUkVGVU5ERUQgfSxcbiAgICB9KTtcbiAgICBpZiAocGF5bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICBjb25zdCByZWZ1bmRSZWZzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IG91dGNvbWVzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFxuICAgICAgcGF5bWVudHMubWFwKGFzeW5jIChwYXltZW50KSA9PiB7XG4gICAgICAgIGlmICghcGF5bWVudC5iYW5rVHJhbklkKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgIGBbcmVmdW5kXSBwYXltZW50ICR7cGF5bWVudC5pZH0gaGFzIG5vIGJhbmtfdHJhbl9pZDsgZ2F0ZXdheSByZWZ1bmQgc2tpcHBlZC5gLFxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGdhdGV3YXkgPSBhd2FpdCBzc2xjb21tZXJ6UmVmdW5kKHtcbiAgICAgICAgICBiYW5rX3RyYW5faWQ6IHBheW1lbnQuYmFua1RyYW5JZCxcbiAgICAgICAgICByZWZ1bmRfYW1vdW50OiBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICAgICAgICAgIHJlZnVuZF9yZW1hcmtzOiBgQm9va2luZyAke2Jvb2tpbmdJZH0gY2FuY2VsbGVkIC0gVHJpcFZlcnNlYCxcbiAgICAgICAgICByZWZlX2lkOiBib29raW5nSWQsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZ2F0ZXdheS5zdGF0dXMgPT09IFwic3VjY2Vzc1wiICYmIGdhdGV3YXkucmVmdW5kX3JlZl9pZCkge1xuICAgICAgICAgIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICAgICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgICAgICAgZGF0YTogeyByZWZ1bmRSZWZJZDogZ2F0ZXdheS5yZWZ1bmRfcmVmX2lkLCByZWZ1bmRlZEF0OiBuZXcgRGF0ZSgpIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmVmdW5kUmVmcy5wdXNoKGdhdGV3YXkucmVmdW5kX3JlZl9pZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgIGBbcmVmdW5kXSBwYXltZW50ICR7cGF5bWVudC5pZH0gcmVqZWN0ZWQ6ICR7Z2F0ZXdheS5lcnJvclJlYXNvbiA/PyBnYXRld2F5LnN0YXR1cyA/PyBcInVua25vd25cIn1gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gICAgLy8gaW5kaXZpZHVhbCBmYWlsdXJlcyBhcmUgbG9nZ2VkIGFib3ZlIGFuZCBzd2FsbG93ZWQgXHUyMDE0IG1vbmV5IHN0YXR1cyBhbHJlYWR5XG4gICAgLy8gZmxpcHBlZCB0byBSRUZVTkRFRCwgc28gdGhlIGN1c3RvbWVyIHNlZXMgYSByZWZ1bmQgcmVnYXJkbGVzcy5cbiAgICB2b2lkIG91dGNvbWVzO1xuXG4gICAgaWYgKHJlZnVuZFJlZnMubGVuZ3RoID4gMCkge1xuICAgICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgICBzZW5kUmVmdW5kRW1haWwoe1xuICAgICAgICAgIGVtYWlsOiBjdHguZW1haWwsXG4gICAgICAgICAgbmFtZTogY3R4Lm5hbWUsXG4gICAgICAgICAgcGFja2FnZVRpdGxlOiBjdHgucGFja2FnZVRpdGxlLFxuICAgICAgICAgIHRyYXZlbERhdGU6IGN0eC50cmF2ZWxEYXRlLFxuICAgICAgICAgIGFtb3VudDogcGF5bWVudHMucmVkdWNlKChzdW0sIHApID0+IHN1bSArIE51bWJlcihwLmFtb3VudCksIDApLFxuICAgICAgICAgIHJlZnVuZFJlZklkOiByZWZ1bmRSZWZzWzBdLFxuICAgICAgICB9KSxcbiAgICAgIF0pO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtyZWZ1bmRdIHVuZXhwZWN0ZWQgZXJyb3I6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsXG4gICAgKTtcbiAgfVxufTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXR1cyB0cmFuc2l0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgdXBkYXRlQm9va2luZ1N0YXR1cyA9IGFzeW5jIChcbiAgaWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG4gIGFjdG9yOiBCb29raW5nQWN0b3IsXG4pID0+IHtcbiAgY29uc3QgeyBzdGF0dXM6IHRvIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIHBhY2thZ2U6IHtcbiAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBhZ2VudElkOiB0cnVlLCB0aXRsZTogdHJ1ZSB9LFxuICAgICAgfSxcbiAgICAgIHVzZXI6IGJvb2tpbmdVc2VyU2VsZWN0LFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKCFjYW5NYW5hZ2UoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBlcmZvcm0gdGhpcyBhY3Rpb24uXCIpO1xuICB9XG5cbiAgY29uc3QgcnVsZSA9IFRSQU5TSVRJT05TW2Jvb2tpbmcuc3RhdHVzXT8uW3RvXTtcbiAgaWYgKCFydWxlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgYENhbm5vdCB0cmFuc2l0aW9uIGJvb2tpbmcgZnJvbSAke2Jvb2tpbmcuc3RhdHVzfSB0byAke3RvfS5gLFxuICAgICk7XG4gIH1cbiAgaWYgKCFydWxlLmFsbG93ZWQoYm9va2luZywgYWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBlcmZvcm0gdGhpcyBhY3Rpb24uXCIpO1xuICB9XG5cbiAgY29uc3QgdHJhdmVsRGF5ID0gdG9VVENNaWRuaWdodChib29raW5nLnRyYXZlbERhdGUpLmdldFRpbWUoKTtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgaWYgKHJ1bGUucmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkICYmIHRyYXZlbERheSA+IG5vdykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiQm9va2luZyBjYW4gb25seSBiZSBjb21wbGV0ZWQgYWZ0ZXIgdGhlIHRyYXZlbCBkYXRlIGhhcyBwYXNzZWQuXCIsXG4gICAgKTtcbiAgfVxuICBpZiAocnVsZS5iZWZvcmVUcmF2ZWxEYXRlICYmIHRyYXZlbERheSA8PSBub3cpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkJvb2tpbmcgY2FuIG9ubHkgYmUgcmV2ZXJ0ZWQgYmVmb3JlIHRoZSB0cmF2ZWwgZGF0ZS5cIixcbiAgICApO1xuICB9XG5cbiAgLy8gY29tcGFyZS1hbmQtc2V0OiB0aGUgdHJhbnNpdGlvbiBhcHBsaWVzIG9ubHkgaWYgdGhlIHJlY29yZGVkIHN0YXR1cyBzdGlsbFxuICAvLyBtYXRjaGVzIFx1MjAxNCBhIGNvbmN1cnJlbnQgY2hhbmdlIG1ha2VzIGNvdW50IDAgYW5kIHRoZSByZXF1ZXN0IGZhaWxzIHNhZmVseS5cbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdHguYm9va2luZy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkLCBzdGF0dXM6IGJvb2tpbmcuc3RhdHVzIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogdG8gfSxcbiAgICB9KTtcbiAgICBpZiAocmVzdWx0LmNvdW50ID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwOSxcbiAgICAgICAgXCJCb29raW5nIHN0YXR1cyBjaGFuZ2VkIGNvbmN1cnJlbnRseS4gUGxlYXNlIHRyeSBhZ2Fpbi5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQ2FuY2VsbGluZyBhIHBhaWQgYm9va2luZyBtYXJrcyBpdHMgbW9uZXkgYXMgcmV0dXJuZWQgKFJFRlVOREVEIGZsYWcpLlxuICAgIC8vIEFiYW5kb25lZCBzZXNzaW9ucyBhcmUgY2FuY2VsbGVkLiBUaGUgZ2F0ZXdheSByZWZ1bmRzICsgcmVmdW5kIGVtYWlsIHJ1blxuICAgIC8vIGFmdGVyIHRoaXMgdHJhbnNhY3Rpb24gY29tbWl0cyAoaXNzdWVSZWZ1bmRzIGlzIGJlc3QtZWZmb3J0KS5cbiAgICBpZiAodG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBib29raW5nSWQ6IGlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5SRUZVTkRFRCB9LFxuICAgICAgfSk7XG4gICAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgICB3aGVyZTogeyBib29raW5nSWQ6IGlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkNBTkNFTExFRCB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHR4LmJvb2tpbmcuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkIH0gfSk7XG4gIH0pO1xuXG4gIGlmICghdXBkYXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgLy8gYmVzdC1lZmZvcnQgZ2F0ZXdheSByZWZ1bmQgKyByZWZ1bmQgZW1haWwgZm9yIHNldHRsZWQgbW9uZXkgKG5ldmVyIHRocm93cylcbiAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgIGF3YWl0IGlzc3VlUmVmdW5kcyhpZCwge1xuICAgICAgZW1haWw6IGJvb2tpbmcudXNlci5lbWFpbCxcbiAgICAgIG5hbWU6IGJvb2tpbmcudXNlci5uYW1lLFxuICAgICAgcGFja2FnZVRpdGxlOiBib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICB0cmF2ZWxEYXRlOiBib29raW5nLnRyYXZlbERhdGUsXG4gICAgfSk7XG4gIH1cblxuICAvLyBiZXN0LWVmZm9ydCBlbWFpbCBmb3IgbW9uZXktc3RhdHVzIGNoYW5nZXNcbiAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNPTkZJUk1FRCB8fCB0byA9PT0gQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQpIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgICAgZW1haWw6IGJvb2tpbmcudXNlci5lbWFpbCxcbiAgICAgICAgbmFtZTogYm9va2luZy51c2VyLm5hbWUsXG4gICAgICAgIHBhY2thZ2VUaXRsZTogYm9va2luZy5wYWNrYWdlLnRpdGxlLFxuICAgICAgICB0cmF2ZWxEYXRlOiBib29raW5nLnRyYXZlbERhdGUsXG4gICAgICAgIHRyYXZlbGVyczogYm9va2luZy50cmF2ZWxlcnMsXG4gICAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihib29raW5nLnRvdGFsUHJpY2UpLFxuICAgICAgICBzdGF0dXM6IHRvLFxuICAgICAgfSksXG4gICAgXSk7XG4gIH1cblxuICByZXR1cm4geyAuLi51cGRhdGVkLCB0b3RhbFByaWNlOiBOdW1iZXIodXBkYXRlZC50b3RhbFByaWNlKSB9O1xufTtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdTZXJ2aWNlID0ge1xuICBjcmVhdGVCb29raW5nLFxuICBnZXRNeUJvb2tpbmdzLFxuICBnZXRBZ2VudEJvb2tpbmdzLFxuICBnZXRBbGxCb29raW5ncyxcbiAgZ2V0Qm9va2luZ0RldGFpbCxcbiAgdXBkYXRlQm9va2luZ1N0YXR1cyxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcblxuY29uc3QgY3JlYXRlU2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWNrYWdlSWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbiAgdHJhdmVsRGF0ZTogei5jb2VyY2UuZGF0ZSh7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiVHJhdmVsIGRhdGUgaXMgcmVxdWlyZWRcIixcbiAgICBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiVHJhdmVsIGRhdGUgbXVzdCBiZSBhIHZhbGlkIGRhdGVcIixcbiAgfSkucmVmaW5lKFxuICAgIChkYXRlKSA9PiB7XG4gICAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XG4gICAgICBjb25zdCB0cmF2ZWxEYXkgPSBuZXcgRGF0ZShcbiAgICAgICAgRGF0ZS5VVEMoXG4gICAgICAgICAgZGF0ZS5nZXRVVENGdWxsWWVhcigpLFxuICAgICAgICAgIGRhdGUuZ2V0VVRDTW9udGgoKSxcbiAgICAgICAgICBkYXRlLmdldFVUQ0RhdGUoKSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBjb25zdCB0b2RheVVUQyA9IG5ldyBEYXRlKFxuICAgICAgICBEYXRlLlVUQyhcbiAgICAgICAgICB0b2RheS5nZXRVVENGdWxsWWVhcigpLFxuICAgICAgICAgIHRvZGF5LmdldFVUQ01vbnRoKCksXG4gICAgICAgICAgdG9kYXkuZ2V0VVRDRGF0ZSgpLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIHJldHVybiB0cmF2ZWxEYXkuZ2V0VGltZSgpID49IHRvZGF5VVRDLmdldFRpbWUoKTtcbiAgICB9LFxuICAgIHsgbWVzc2FnZTogXCJUcmF2ZWwgZGF0ZSBjYW5ub3QgYmUgaW4gdGhlIHBhc3QuXCIgfSxcbiAgKSxcbiAgdHJhdmVsZXJzOiB6XG4gICAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIlRyYXZlbGVycyBpcyByZXF1aXJlZFwiIH0pXG4gICAgLmludChcIlRyYXZlbGVycyBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyXCIpXG4gICAgLm1pbigxLCBcIlRyYXZlbGVycyBtdXN0IGJlIGF0IGxlYXN0IDFcIilcbiAgICAubWF4KDIwLCBcIlRyYXZlbGVycyBtdXN0IGJlIGF0IG1vc3QgMjBcIiksXG59KTtcblxuY29uc3QgYm9va2luZ1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQm9va2luZyBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBib29raW5nUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIHN0YXR1czogei5uYXRpdmVFbnVtKEJvb2tpbmdTdGF0dXMpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hID0gYm9va2luZ1F1ZXJ5U2NoZW1hLmV4dGVuZCh7XG4gIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkub3B0aW9uYWwoKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVTdGF0dXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHN0YXR1czogei5uYXRpdmVFbnVtKEJvb2tpbmdTdGF0dXMsIHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHN0YXR1c1wiLFxuICB9KSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUQ3JlYXRlQm9va2luZ1NjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNyZWF0ZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQm9va2luZ1F1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgYm9va2luZ1F1ZXJ5U2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRCb29raW5nU2VhcmNoUXVlcnlTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBib29raW5nU2VhcmNoUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFVwZGF0ZVN0YXR1c1NjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHVwZGF0ZVN0YXR1c1NjaGVtYT47XG5cbmV4cG9ydCBjb25zdCBib29raW5nVmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVNjaGVtYSxcbiAgYm9va2luZ1BhcmFtc1NjaGVtYSxcbiAgYm9va2luZ1F1ZXJ5U2NoZW1hLFxuICBib29raW5nU2VhcmNoUXVlcnlTY2hlbWEsXG4gIHVwZGF0ZVN0YXR1c1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyByZXZpZXdDb250cm9sbGVyIH0gZnJvbSBcIi4vcmV2aWV3LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHJldmlld1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vcmV2aWV3LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIENyZWF0ZSBhIHJldmlldyAoVVNFUiBvbmx5KVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHJldmlld1ZhbGlkYXRpb25zLmNyZWF0ZVJldmlld1NjaGVtYSB9KSxcbiAgcmV2aWV3Q29udHJvbGxlci5jcmVhdGVSZXZpZXcsXG4pO1xuXG4vLyAyLiBMaXN0IHJldmlld3MgZm9yIGEgcGFja2FnZSAocHVibGljKVxucm91dGVyLmdldChcbiAgXCIvcGFja2FnZS86cGFja2FnZUlkXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiByZXZpZXdWYWxpZGF0aW9ucy5yZXZpZXdQYXJhbXNTY2hlbWEsXG4gICAgcXVlcnk6IHJldmlld1ZhbGlkYXRpb25zLnJldmlld1F1ZXJ5U2NoZW1hLFxuICB9KSxcbiAgcmV2aWV3Q29udHJvbGxlci5nZXRQYWNrYWdlUmV2aWV3cyxcbik7XG5cbmV4cG9ydCBjb25zdCByZXZpZXdSb3V0ZXMgPSByb3V0ZXI7XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IHJldmlld1NlcnZpY2UgfSBmcm9tIFwiLi9yZXZpZXcuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBhIHJldmlldyBjb250cm9sbGVyIChVU0VSIG9ubHkpXG5jb25zdCBjcmVhdGVSZXZpZXcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXZpZXdTZXJ2aWNlLmNyZWF0ZVJldmlldyh1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlJldmlldyBzdWJtaXR0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gTGlzdCBwYWNrYWdlIHJldmlld3MgY29udHJvbGxlciAocHVibGljKVxuY29uc3QgZ2V0UGFja2FnZVJldmlld3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSWQgPSBTdHJpbmcocmVxLnBhcmFtcy5wYWNrYWdlSWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJldmlld1NlcnZpY2UubGlzdFBhY2thZ2VSZXZpZXdzKHBhY2thZ2VJZCwgcmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJSZXZpZXdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHJldmlld0NvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVJldmlldyxcbiAgZ2V0UGFja2FnZVJldmlld3MsXG59O1xuIiwgImltcG9ydCB7IFBhY2thZ2VTdGF0dXMsIEJvb2tpbmdTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBJQ3JlYXRlUmV2aWV3UGF5bG9hZCwgSVJldmlld1F1ZXJ5IH0gZnJvbSBcIi4vcmV2aWV3LmludGVyZmFjZVwiO1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgKFVTRVIgb25seSkgXHUyMDE0IGdhdGVkLCB1bmlxdWUgcGVyIHVzZXIrcGFja2FnZSwgYW5kXG4vLyAgICByZWNhbGN1bGF0ZXMgdGhlIHBhY2thZ2UgcmF0aW5nIGluIHRoZSBzYW1lIHRyYW5zYWN0aW9uLlxuY29uc3QgY3JlYXRlUmV2aWV3ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBJQ3JlYXRlUmV2aWV3UGF5bG9hZCkgPT4ge1xuICByZXR1cm4gcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICAvLyBQYWNrYWdlIG11c3QgZXhpc3QsIGJlIGFwcHJvdmVkLCBhbmQgbm90IGJlIGRlbGV0ZWQgXHUyMDE0IGEgcmV2aWV3IG9mIGFcbiAgICAvLyBwZW5kaW5nL3JlamVjdGVkL2RlbGV0ZWQgcGFja2FnZSBpcyBub25zZW5zZS5cbiAgICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHR4LnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICBpZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIGFnZW50SWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmICghdG91clBhY2thZ2UpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIC8vIE5vIHNlbGYtcmV2aWV3IFx1MjAxNCBhbiBhZ2VudCByYXRpbmcgdGhlaXIgb3duIHBhY2thZ2UgaXMgYSBjb25mbGljdCBvZiBpbnRlcmVzdC5cbiAgICBpZiAodG91clBhY2thZ2UuYWdlbnRJZCA9PT0gdXNlcklkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW5ub3QgcmV2aWV3IHlvdXIgb3duIHBhY2thZ2UuXCIpO1xuICAgIH1cblxuICAgIC8vIE9ubHkgY3VzdG9tZXJzIHdpdGggYSBjb21wbGV0ZWQgYm9va2luZyBtYXkgcmV2aWV3LlxuICAgIGNvbnN0IGNvbXBsZXRlZEJvb2tpbmcgPSBhd2FpdCB0eC5ib29raW5nLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICAgIHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQsXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIWNvbXBsZXRlZEJvb2tpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgNDAzLFxuICAgICAgICBcIllvdSBjYW4gb25seSByZXZpZXcgYSBwYWNrYWdlIGFmdGVyIGNvbXBsZXRpbmcgYSBib29raW5nLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBGcmllbmRseSBkdXBsaWNhdGUgY2hlY2sgXHUyMDE0IEBAdW5pcXVlKFt1c2VySWQsIHBhY2thZ2VJZF0pIGJhY2tzdG9wcyBhbnlcbiAgICAvLyByYWNlIHZpYSBQMjAwMiAobWFwcGVkIHRvIDQwOSBieSB0aGUgZ2xvYmFsIGhhbmRsZXIpLlxuICAgIGNvbnN0IGV4aXN0aW5nUmV2aWV3ID0gYXdhaXQgdHgucmV2aWV3LmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZTogeyB1c2VySWQsIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKGV4aXN0aW5nUmV2aWV3KSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIllvdSBoYXZlIGFscmVhZHkgcmV2aWV3ZWQgdGhpcyBwYWNrYWdlLlwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBjcmVhdGVkUmV2aWV3ID0gYXdhaXQgdHgucmV2aWV3LmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCxcbiAgICAgICAgcmF0aW5nOiBwYXlsb2FkLnJhdGluZyxcbiAgICAgICAgY29tbWVudDogcGF5bG9hZC5jb21tZW50LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFJlY29tcHV0ZSB0aGUgcGFja2FnZSByYXRpbmcgZnJvbSBhbGwgb2YgaXRzIHJldmlld3MsIHJvdW5kZWQgdG8gb25lXG4gICAgLy8gZGVjaW1hbCwgaW5zaWRlIHRoZSBzYW1lIHRyYW5zYWN0aW9uIHNvIGEgc3RhbGUgYXZlcmFnZSBpcyBuZXZlciB3cml0dGVuLlxuICAgIGNvbnN0IHsgX2F2ZyB9ID0gYXdhaXQgdHgucmV2aWV3LmFnZ3JlZ2F0ZSh7XG4gICAgICB3aGVyZTogeyBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkIH0sXG4gICAgICBfYXZnOiB7IHJhdGluZzogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmF0aW5nID0gTWF0aC5yb3VuZCgoX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMDtcblxuICAgIGF3YWl0IHR4LnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bG9hZC5wYWNrYWdlSWQgfSxcbiAgICAgIGRhdGE6IHsgcmF0aW5nIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4geyByZXZpZXc6IGNyZWF0ZWRSZXZpZXcsIHJhdGluZyB9O1xuICB9KTtcbn07XG5cbi8vIDIuIExpc3QgcmV2aWV3cyBmb3IgYSBwYWNrYWdlIChwdWJsaWMpIFx1MjAxNCBwYWdpbmF0ZWQ7IHRoZSBwYWNrYWdlIG11c3QgYmVcbi8vICAgIGFwcHJvdmVkIGFuZCBub3QgZGVsZXRlZCBzbyB1bnB1Ymxpc2hlZCBwYWNrYWdlIHJldmlld3MgbmV2ZXIgbGVhay5cbmNvbnN0IGxpc3RQYWNrYWdlUmV2aWV3cyA9IGFzeW5jIChcbiAgcGFja2FnZUlkOiBzdHJpbmcsXG4gIHF1ZXJ5OiBJUmV2aWV3UXVlcnksXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZEZpcnN0KHtcbiAgICB3aGVyZToge1xuICAgICAgaWQ6IHBhY2thZ2VJZCxcbiAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5yZXZpZXcuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHsgcGFja2FnZUlkIH0sXG4gICAgICBzZWxlY3Q6IHtcbiAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgIHJhdGluZzogdHJ1ZSxcbiAgICAgICAgY29tbWVudDogdHJ1ZSxcbiAgICAgICAgY3JlYXRlZEF0OiB0cnVlLFxuICAgICAgICB1cGRhdGVkQXQ6IHRydWUsXG4gICAgICAgIHVzZXI6IHsgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGF2YXRhclVybDogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnJldmlldy5jb3VudCh7IHdoZXJlOiB7IHBhY2thZ2VJZCB9IH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbmV4cG9ydCBjb25zdCByZXZpZXdTZXJ2aWNlID0ge1xuICBjcmVhdGVSZXZpZXcsXG4gIGxpc3RQYWNrYWdlUmV2aWV3cyxcbn07XG4iLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgY3JlYXRlUmV2aWV3U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWNrYWdlSWQ6IHpcbiAgICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC5taW4oMSwgXCJQYWNrYWdlIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxuICAgIHJhdGluZzogelxuICAgICAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIlJhdGluZyBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAuaW50KFwiUmF0aW5nIG11c3QgYmUgYSB3aG9sZSBudW1iZXJcIilcbiAgICAgIC5taW4oMSwgXCJSYXRpbmcgbXVzdCBiZSBhdCBsZWFzdCAxXCIpXG4gICAgICAubWF4KDUsIFwiUmF0aW5nIG11c3QgYmUgYXQgbW9zdCA1XCIpLFxuICAgIGNvbW1lbnQ6IHpcbiAgICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDb21tZW50IGlzIHJlcXVpcmVkXCIgfSlcbiAgICAgIC50cmltKClcbiAgICAgIC5taW4oMSwgXCJDb21tZW50IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gICAgICAubWF4KDEwMDAsIFwiQ29tbWVudCBtdXN0IGJlIGF0IG1vc3QgMTAwMCBjaGFyYWN0ZXJzXCIpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHJldmlld1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFja2FnZUlkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oMSwgXCJQYWNrYWdlIGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpLFxufSk7XG5cbmNvbnN0IHJldmlld1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxufSk7XG5cbmV4cG9ydCBjb25zdCByZXZpZXdWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlUmV2aWV3U2NoZW1hLFxuICByZXZpZXdQYXJhbXNTY2hlbWEsXG4gIHJldmlld1F1ZXJ5U2NoZW1hLFxufTtcbiIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgY2F0ZWdvcnlDb250cm9sbGVyIH0gZnJvbSBcIi4vY2F0ZWdvcnkuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgY2F0ZWdvcnlWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2NhdGVnb3J5LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIDEuIExpc3QgYWxsIGNhdGVnb3JpZXMgKHB1YmxpYywgbm8gYXV0aClcbnJvdXRlci5nZXQoXCIvXCIsIGNhdGVnb3J5Q29udHJvbGxlci5nZXRBbGxDYXRlZ29yaWVzKTtcblxuLy8gMi4gQ3JlYXRlIGNhdGVnb3J5IChhZG1pbilcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogY2F0ZWdvcnlWYWxpZGF0aW9ucy5jcmVhdGVDYXRlZ29yeVNjaGVtYSB9KSxcbiAgY2F0ZWdvcnlDb250cm9sbGVyLmNyZWF0ZUNhdGVnb3J5LFxuKTtcblxuLy8gMy4gVXBkYXRlIGNhdGVnb3J5IChhZG1pbilcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBjYXRlZ29yeVZhbGlkYXRpb25zLmNhdGVnb3J5UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGNhdGVnb3J5VmFsaWRhdGlvbnMudXBkYXRlQ2F0ZWdvcnlTY2hlbWEsXG4gIH0pLFxuICBjYXRlZ29yeUNvbnRyb2xsZXIudXBkYXRlQ2F0ZWdvcnksXG4pO1xuXG4vLyA0LiBEZWxldGUgY2F0ZWdvcnkgKGFkbWluKVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogY2F0ZWdvcnlWYWxpZGF0aW9ucy5jYXRlZ29yeVBhcmFtc1NjaGVtYSB9KSxcbiAgY2F0ZWdvcnlDb250cm9sbGVyLmRlbGV0ZUNhdGVnb3J5LFxuKTtcblxuZXhwb3J0IGNvbnN0IGNhdGVnb3J5Um91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgY2F0ZWdvcnlTZXJ2aWNlIH0gZnJvbSBcIi4vY2F0ZWdvcnkuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIENyZWF0ZSBjYXRlZ29yeSBjb250cm9sbGVyIChhZG1pbilcbmNvbnN0IGNyZWF0ZUNhdGVnb3J5ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgY2F0ZWdvcnkgPSBhd2FpdCBjYXRlZ29yeVNlcnZpY2UuY3JlYXRlQ2F0ZWdvcnkocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiQ2F0ZWdvcnkgY3JlYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBjYXRlZ29yeSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdldCBhbGwgY2F0ZWdvcmllcyBjb250cm9sbGVyIChwdWJsaWMpXG5jb25zdCBnZXRBbGxDYXRlZ29yaWVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgY2F0ZWdvcmllcyA9IGF3YWl0IGNhdGVnb3J5U2VydmljZS5nZXRBbGxDYXRlZ29yaWVzKCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIGNhdGVnb3JpZXMgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBjYXRlZ29yaWVzLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gVXBkYXRlIGNhdGVnb3J5IGNvbnRyb2xsZXIgKGFkbWluKVxuY29uc3QgdXBkYXRlQ2F0ZWdvcnkgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLnVwZGF0ZUNhdGVnb3J5KGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ2F0ZWdvcnkgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBjYXRlZ29yeSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIERlbGV0ZSBjYXRlZ29yeSBjb250cm9sbGVyIChhZG1pbilcbmNvbnN0IGRlbGV0ZUNhdGVnb3J5ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBhd2FpdCBjYXRlZ29yeVNlcnZpY2UuZGVsZXRlQ2F0ZWdvcnkoaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeUNvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZUNhdGVnb3J5LFxuICBnZXRBbGxDYXRlZ29yaWVzLFxuICB1cGRhdGVDYXRlZ29yeSxcbiAgZGVsZXRlQ2F0ZWdvcnksXG59OyIsICIvLyBCYW5nbGEgKEJlbmdhbGkpIFx1MjE5MiBMYXRpbiBjb25zb25hbnQvdm93ZWwgbWFwLCBhcHBsaWVkIGJlZm9yZSBrZWJhYi1jYXNpbmcgc29cbi8vIEJhbmdsYS1oZWF2eSB0aXRsZXMgc3RpbGwgcHJvZHVjZSByZWFkYWJsZSBzbHVncyBpbnN0ZWFkIG9mIGJlaW5nIHN0cmlwcGVkIHRvXG4vLyBhbiBlbXB0eSBzdHJpbmcuXG5jb25zdCBCQU5HTEFfVE9fTEFUSU46IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIFx1MDk4NTogXCJvXCIsXG4gIFx1MDk4NjogXCJhXCIsXG4gIFx1MDk4NzogXCJpXCIsXG4gIFx1MDk4ODogXCJpXCIsXG4gIFx1MDk4OTogXCJ1XCIsXG4gIFx1MDk4QTogXCJ1XCIsXG4gIFx1MDk4QjogXCJyaVwiLFxuICBcdTA5OEY6IFwiZVwiLFxuICBcdTA5OTA6IFwib2lcIixcbiAgXHUwOTkzOiBcIm9cIixcbiAgXHUwOTk0OiBcIm91XCIsXG4gIFx1MDk5NTogXCJrYVwiLFxuICBcdTA5OTY6IFwia2hhXCIsXG4gIFx1MDk5NzogXCJnYVwiLFxuICBcdTA5OTg6IFwiZ2hhXCIsXG4gIFx1MDk5OTogXCJuZ2FcIixcbiAgXHUwOTlBOiBcImNoYVwiLFxuICBcdTA5OUI6IFwiY2hoYVwiLFxuICBcdTA5OUM6IFwiamFcIixcbiAgXHUwOTlEOiBcImpoYVwiLFxuICBcdTA5OUU6IFwibnlhXCIsXG4gIFx1MDk5RjogXCJ0YVwiLFxuICBcdTA5QTA6IFwidGhhXCIsXG4gIFx1MDlBMTogXCJkYVwiLFxuICBcdTA5QTI6IFwiZGhhXCIsXG4gIFx1MDlBMzogXCJuYVwiLFxuICBcdTA5QTQ6IFwidGFcIixcbiAgXHUwOUE1OiBcInRoYVwiLFxuICBcdTA5QTY6IFwiZGFcIixcbiAgXHUwOUE3OiBcImRoYVwiLFxuICBcdTA5QTg6IFwibmFcIixcbiAgXHUwOUFBOiBcInBhXCIsXG4gIFx1MDlBQjogXCJwaGFcIixcbiAgXHUwOUFDOiBcImJhXCIsXG4gIFx1MDlBRDogXCJiaGFcIixcbiAgXHUwOUFFOiBcIm1hXCIsXG4gIFx1MDlBRjogXCJ5YVwiLFxuICBcdTA5QjA6IFwicmFcIixcbiAgXHUwOUIyOiBcImxhXCIsXG4gIFx1MDlCNjogXCJzaGFcIixcbiAgXHUwOUI3OiBcInNoYVwiLFxuICBcdTA5Qjg6IFwic2FcIixcbiAgXHUwOUI5OiBcImhhXCIsXG4gIFx1MDlBMVx1MDlCQzogXCJyYVwiLFxuICBcdTA5QTJcdTA5QkM6IFwicmhhXCIsXG4gIFx1MDlBRlx1MDlCQzogXCJ5YVwiLFxuICBcIlx1MDk4MlwiOiBcIm5nXCIsXG4gIFwiXHUwOTgzXCI6IFwiaFwiLFxuICBcIlx1MDk4MVwiOiBcIlwiLFxuICBcIlx1MDlDRFwiOiBcIlwiLFxuICBcIlx1MDlDN1wiOiBcImVcIixcbiAgXCJcdTA5QzhcIjogXCJvaVwiLFxuICBcIlx1MDlDQlwiOiBcIm9cIixcbiAgXCJcdTA5Q0NcIjogXCJvdVwiLFxuICBcIlx1MDlCRVwiOiBcImFcIixcbiAgXCJcdTA5QkZcIjogXCJpXCIsXG4gIFwiXHUwOUMwXCI6IFwiaVwiLFxuICBcIlx1MDlDMVwiOiBcInVcIixcbiAgXCJcdTA5QzJcIjogXCJ1XCIsXG4gIFwiXHUwOUMzXCI6IFwicmlcIixcbn07XG5cbmNvbnN0IHRyYW5zbGl0ZXJhdGUgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nID0+XG4gIFsuLi50ZXh0XS5tYXAoKGNoYXIpID0+IEJBTkdMQV9UT19MQVRJTltjaGFyXSA/PyBjaGFyKS5qb2luKFwiXCIpO1xuXG4vLyBTaGFyZWQga2ViYWItY2FzZSBzbHVnaWZpZXIgdXNlZCBieSBDYXRlZ29yeSBhbmQgVG91clBhY2thZ2Ugc2x1Z3MuIE5vbi1MYXRpblxuLy8gc2NyaXB0cyAoZS5nLiBCYW5nbGEpIGFyZSB0cmFuc2xpdGVyYXRlZCBmaXJzdDsgaWYgdGhlIHJlc3VsdCBpcyBzdGlsbCBlbXB0eVxuLy8gdGhlIGNhbGxlciBtYXkgc3VwcGx5IGEgYGZhbGxiYWNrYCAoZS5nLiBcInBhY2thZ2UtPHNob3J0SWQ+XCIpLlxuZXhwb3J0IGNvbnN0IHNsdWdpZnkgPSAodGV4dDogc3RyaW5nLCBmYWxsYmFjaz86IHN0cmluZyk6IHN0cmluZyA9PiB7XG4gIGNvbnN0IHNsdWcgPSB0cmFuc2xpdGVyYXRlKHRleHQpXG4gICAgLnRvTG93ZXJDYXNlKClcbiAgICAudHJpbSgpXG4gICAgLnJlcGxhY2UoL1teXFx3XFxzLV0vZywgXCJcIilcbiAgICAucmVwbGFjZSgvW1xcc18tXSsvZywgXCItXCIpXG4gICAgLnJlcGxhY2UoL14tK3wtKyQvZywgXCJcIik7XG5cbiAgcmV0dXJuIHNsdWcgfHwgZmFsbGJhY2sgfHwgXCJcIjtcbn07IiwgImltcG9ydCB7IFBhY2thZ2VTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7IElDcmVhdGVDYXRlZ29yeSwgSVVwZGF0ZUNhdGVnb3J5IH0gZnJvbSBcIi4vY2F0ZWdvcnkuaW50ZXJmYWNlXCI7XG5cbi8vIEZyaWVuZGx5IDQwOSBmb3IgQHVuaXF1ZSBjb25mbGljdHMgKG5hbWUgb3Igc2x1ZykgaW5zdGVhZCBvZiBhIHJhdyBQMjAwMi5cbi8vIGV4Y2x1ZGVJZCBsZXRzIHVwZGF0ZXMgc2tpcCB0aGUgdmVyeSByb3cgYmVpbmcgZWRpdGVkIHNvIGEgbm8tb3AgcmVuYW1lXG4vLyBkb2Vzbid0IGZhbHNlLTQwOSBhZ2FpbnN0IGl0c2VsZi5cbmNvbnN0IGFzc2VydE5hbWVBdmFpbGFibGUgPSBhc3luYyAoXG4gIG5hbWU6IHN0cmluZyxcbiAgc2x1Zzogc3RyaW5nLFxuICBleGNsdWRlSWQ/OiBzdHJpbmcsXG4pID0+IHtcbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZEZpcnN0KHtcbiAgICB3aGVyZToge1xuICAgICAgT1I6IFt7IG5hbWUgfSwgeyBzbHVnIH1dLFxuICAgICAgLi4uKGV4Y2x1ZGVJZCA/IHsgTk9UOiB7IGlkOiBleGNsdWRlSWQgfSB9IDoge30pLFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmIChleGlzdGluZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiQSBjYXRlZ29yeSB3aXRoIHRoaXMgbmFtZSBhbHJlYWR5IGV4aXN0c1wiKTtcbiAgfVxufTtcblxuLy8gQ3JlYXRlIGNhdGVnb3J5IChhZG1pbilcbmNvbnN0IGNyZWF0ZUNhdGVnb3J5ID0gYXN5bmMgKHBheWxvYWQ6IElDcmVhdGVDYXRlZ29yeSkgPT4ge1xuICBjb25zdCB7IG5hbWUgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IHNsdWcgPSBzbHVnaWZ5KG5hbWUpO1xuXG4gIGF3YWl0IGFzc2VydE5hbWVBdmFpbGFibGUobmFtZSwgc2x1Zyk7XG5cbiAgcmV0dXJuIHByaXNtYS5jYXRlZ29yeS5jcmVhdGUoe1xuICAgIGRhdGE6IHsgbmFtZSwgc2x1ZyB9LFxuICB9KTtcbn07XG5cbi8vIEdldCBhbGwgY2F0ZWdvcmllcyAocHVibGljKSB3aXRoIGNvdW50cyBvZiBhcHByb3ZlZCwgbm9uLWRlbGV0ZWQgcGFja2FnZXNcbmNvbnN0IGdldEFsbENhdGVnb3JpZXMgPSBhc3luYyAoKSA9PiB7XG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkuZmluZE1hbnkoe1xuICAgIG9yZGVyQnk6IHsgbmFtZTogXCJhc2NcIiB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIF9jb3VudDoge1xuICAgICAgICBzZWxlY3Q6IHtcbiAgICAgICAgICBwYWNrYWdlczoge1xuICAgICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcbn07XG5cbi8vIFVwZGF0ZSBjYXRlZ29yeSBuYW1lIChyZWdlbmVyYXRlcyBzbHVnKSAoYWRtaW4pXG5jb25zdCB1cGRhdGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcsIHBheWxvYWQ6IElVcGRhdGVDYXRlZ29yeSkgPT4ge1xuICBjb25zdCB7IG5hbWUgfSA9IHBheWxvYWQ7XG4gIGNvbnN0IHNsdWcgPSBzbHVnaWZ5KG5hbWUpO1xuXG4gIGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kVW5pcXVlT3JUaHJvdyh7IHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0gfSk7XG4gIGF3YWl0IGFzc2VydE5hbWVBdmFpbGFibGUobmFtZSwgc2x1ZywgY2F0ZWdvcnlJZCk7XG5cbiAgcmV0dXJuIHByaXNtYS5jYXRlZ29yeS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0sXG4gICAgZGF0YTogeyBuYW1lLCBzbHVnIH0sXG4gIH0pO1xufTtcblxuLy8gRGVsZXRlIGNhdGVnb3J5IChhZG1pbikgXHUyMDE0IDQwOSB3aGVuIGFueSBwYWNrYWdlIHJlZmVyZW5jZXMgaXRcbmNvbnN0IGRlbGV0ZUNhdGVnb3J5ID0gYXN5bmMgKGNhdGVnb3J5SWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9IH0pO1xuXG4gIGNvbnN0IHBhY2thZ2VDb3VudCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7XG4gICAgd2hlcmU6IHsgY2F0ZWdvcnlJZCB9LFxuICB9KTtcblxuICBpZiAocGFja2FnZUNvdW50ID4gMCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwOSxcbiAgICAgIFwiQ2Fubm90IGRlbGV0ZSBjYXRlZ29yeSB3aXRoIGFzc29jaWF0ZWQgcGFja2FnZXMuIFJlbmFtZSBpdCBpbnN0ZWFkLlwiLFxuICAgICk7XG4gIH1cblxuICBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZGVsZXRlKHsgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeVNlcnZpY2UgPSB7XG4gIGNyZWF0ZUNhdGVnb3J5LFxuICBnZXRBbGxDYXRlZ29yaWVzLFxuICB1cGRhdGVDYXRlZ29yeSxcbiAgZGVsZXRlQ2F0ZWdvcnksXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBuYW1lU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ2F0ZWdvcnkgbmFtZSBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigyLCBcIkNhdGVnb3J5IG5hbWUgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgLm1heCgxMDAsIFwiQ2F0ZWdvcnkgbmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGNyZWF0ZUNhdGVnb3J5U2NoZW1hID0gei5vYmplY3QoeyBuYW1lOiBuYW1lU2NoZW1hIH0pLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVDYXRlZ29yeVNjaGVtYSA9IHoub2JqZWN0KHsgbmFtZTogbmFtZVNjaGVtYSB9KS5zdHJpY3QoKTtcblxuY29uc3QgY2F0ZWdvcnlQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNhdGVnb3J5IGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeVZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVDYXRlZ29yeVNjaGVtYSxcbiAgdXBkYXRlQ2F0ZWdvcnlTY2hlbWEsXG4gIGNhdGVnb3J5UGFyYW1zU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHBhY2thZ2VDb250cm9sbGVyIH0gZnJvbSBcIi4vcGFja2FnZS5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBwYWNrYWdlVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9wYWNrYWdlLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE5PVEU6IGAvaW50ZXJuYWwvKmAgcm91dGVzIE1VU1Qgc3RheSByZWdpc3RlcmVkIGJlZm9yZSBgR0VUIC86c2x1Z2AgYmVsb3cgXHUyMDE0XG4vLyBFeHByZXNzIG1hdGNoZXMgdG9wLWRvd24sIGFuZCBhIGxpdGVyYWwgc2VnbWVudCAoYC9pbnRlcm5hbC9hbGxgKSB3b3VsZFxuLy8gb3RoZXJ3aXNlIGJlIHN3YWxsb3dlZCBieSB0aGUgYDpzbHVnYCBwYXJhbSByb3V0ZSBhbmQgNDA0IGZvcmV2ZXIuXG5cbi8vIDEuIE15IHBhY2thZ2VzIChhZ2VudCkgXHUyMDE0IHNlbGYtcHJldmlldyBvZiBQRU5ESU5HL1JFSkVDVEVEIGJlZm9yZSBhcHByb3ZhbFxucm91dGVyLmdldChcbiAgXCIvaW50ZXJuYWwvbXktcGFja2FnZXNcIixcbiAgYXV0aChSb2xlLkFHRU5UKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHBhY2thZ2VWYWxpZGF0aW9ucy5pbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0TXlQYWNrYWdlcyxcbik7XG5cbi8vIDIuIEFsbCBwYWNrYWdlcyAoYWRtaW4gbW9kZXJhdGlvbiBVSSlcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL2FsbFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogcGFja2FnZVZhbGlkYXRpb25zLmludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRBbGxQYWNrYWdlcyxcbik7XG5cbi8vIDMuIFB1YmxpYyBwYWNrYWdlIGRldGFpbCBieSBzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi86c2x1Z1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlU2x1Z1BhcmFtc1NjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0UGFja2FnZUJ5U2x1Zyxcbik7XG5cbi8vIDQuIENyZWF0ZSBwYWNrYWdlIChhZ2VudCBjcmVhdGVzIG93bjsgYWRtaW4gY2FuIGNyZWF0ZSBmb3IgYW55IGFnZW50KVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBwYWNrYWdlVmFsaWRhdGlvbnMuY3JlYXRlUGFja2FnZVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuY3JlYXRlUGFja2FnZSxcbik7XG5cbi8vIDUuIEFwcHJvdmUvcmVqZWN0IHBhY2thZ2UgKGFkbWluKSBcdTIwMTQgcmVnaXN0ZXJlZCBiZWZvcmUgUEFUQ0ggLzppZCBmb3IgY2xhcml0eVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBwYWNrYWdlVmFsaWRhdGlvbnMudXBkYXRlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuY2hhbmdlUGFja2FnZVN0YXR1cyxcbik7XG5cbi8vIDYuIFVwZGF0ZSBwYWNrYWdlIChhZ2VudCBvd24gLyBhZG1pbiBhbnkpXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLnVwZGF0ZVBhY2thZ2VTY2hlbWEsXG4gIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci51cGRhdGVQYWNrYWdlLFxuKTtcblxuLy8gNy4gU29mdCBkZWxldGUgcGFja2FnZSAoYWdlbnQgb3duIC8gYWRtaW4gYW55KVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VQYXJhbXNTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLnNvZnREZWxldGVQYWNrYWdlLFxuKTtcblxuLy8gOC4gUHVibGljIGxpc3RpbmcgXHUyMDE0IGtlcHQgbGFzdCBzbyBub25lIG9mIHRoZSBhYm92ZSByb3V0ZXMgYXJlIHNoYWRvd2VkXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUXVlcnlTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldFB1YmxpY1BhY2thZ2VzLFxuKTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBwYWNrYWdlU2VydmljZSB9IGZyb20gXCIuL3BhY2thZ2Uuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBwYWNrYWdlIGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgY3JlYXRlUGFja2FnZSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmNyZWF0ZVBhY2thZ2UocmVxLnVzZXIhLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LiBJdCB3aWxsIGJlIHZpc2libGUgYWZ0ZXIgYWRtaW4gYXBwcm92YWwuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBQdWJsaWMgbGlzdGluZyBjb250cm9sbGVyIChmaWx0ZXJzICsgcGFnaW5hdGlvbilcbmNvbnN0IGdldFB1YmxpY1BhY2thZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0UHVibGljUGFja2FnZXMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFB1YmxpYyBwYWNrYWdlIGRldGFpbCBieSBzbHVnXG5jb25zdCBnZXRQYWNrYWdlQnlTbHVnID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3Qgc2x1ZyA9IFN0cmluZyhyZXEucGFyYW1zLnNsdWcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldFBhY2thZ2VCeVNsdWcoc2x1Zyk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNC4gQWxsIHBhY2thZ2VzIGNvbnRyb2xsZXIgKEFETUlOIG1vZGVyYXRpb24pXG5jb25zdCBnZXRBbGxQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldEFsbFBhY2thZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQWxsIHBhY2thZ2VzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNS4gTXkgcGFja2FnZXMgY29udHJvbGxlciAoQUdFTlQpXG5jb25zdCBnZXRNeVBhY2thZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UuZ2V0TXlQYWNrYWdlcyh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiWW91ciBwYWNrYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDYuIFVwZGF0ZSBwYWNrYWdlIGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHVwZGF0ZVBhY2thZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS51cGRhdGVQYWNrYWdlKHJlcS51c2VyISwgaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNy4gQ2hhbmdlIHBhY2thZ2Ugc3RhdHVzIGNvbnRyb2xsZXIgKEFETUlOIGFwcHJvdmUvcmVqZWN0KVxuY29uc3QgY2hhbmdlUGFja2FnZVN0YXR1cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmNoYW5nZVBhY2thZ2VTdGF0dXMoaWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDguIFNvZnQgZGVsZXRlIHBhY2thZ2UgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3Qgc29mdERlbGV0ZVBhY2thZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBhd2FpdCBwYWNrYWdlU2VydmljZS5zb2Z0RGVsZXRlUGFja2FnZShyZXEudXNlciEsIGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQYWNrYWdlIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogbnVsbCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlQ29udHJvbGxlciA9IHtcbiAgY3JlYXRlUGFja2FnZSxcbiAgZ2V0UHVibGljUGFja2FnZXMsXG4gIGdldFBhY2thZ2VCeVNsdWcsXG4gIGdldEFsbFBhY2thZ2VzLFxuICBnZXRNeVBhY2thZ2VzLFxuICB1cGRhdGVQYWNrYWdlLFxuICBjaGFuZ2VQYWNrYWdlU3RhdHVzLFxuICBzb2Z0RGVsZXRlUGFja2FnZSxcbn07IiwgImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcbmltcG9ydCB7IFBhY2thZ2VTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2x1Z2lmeVwiO1xuaW1wb3J0IHtcbiAgSUNyZWF0ZVBhY2thZ2VQYXlsb2FkLFxuICBJSW50ZXJuYWxQYWNrYWdlUXVlcnksXG4gIElQYWNrYWdlUXVlcnksXG4gIElSZXF1ZXN0VXNlcixcbiAgSVVwZGF0ZVBhY2thZ2VQYXlsb2FkLFxuICBJVXBkYXRlU3RhdHVzUGF5bG9hZCxcbn0gZnJvbSBcIi4vcGFja2FnZS5pbnRlcmZhY2VcIjtcblxuLy8gTW9uZXkgaXMgYERlY2ltYWwoMTAsMilgIGluIHRoZSBzY2hlbWEgKEFHRU5UUy5tZCkgXHUyMDE0IG1hcCB0byBOdW1iZXIgb24gcmV0dXJuLlxuY29uc3Qgc2VyaWFsaXplUHJpY2UgPSA8VCBleHRlbmRzIHsgcHJpY2U6IFByaXNtYS5EZWNpbWFsIH0+KHJvdzogVCk6IFQgPT4gKHtcbiAgLi4ucm93LFxuICBwcmljZTogTnVtYmVyKHJvdy5wcmljZSksXG59KTtcblxuLy8gUHVibGljIHBheWxvYWRzIGNhcnJ5IHRoZSBhZ2VudCdzIGRpc3BsYXkgaW5mbyBvbmx5IFx1MjAxNCBuZXZlciBlbWFpbC5cbmNvbnN0IHB1YmxpY1BhY2thZ2VJbmNsdWRlID0ge1xuICBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICBhZ2VudDogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGF2YXRhclVybDogdHJ1ZSB9IH0sXG59IGFzIGNvbnN0O1xuXG5jb25zdCB2YWxpZGF0ZUNhdGVnb3J5ID0gYXN5bmMgKGNhdGVnb3J5SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBjYXRlZ29yeSA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIWNhdGVnb3J5KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGNhdGVnb3J5SWRcIik7XG4gIH1cbn07XG5cbi8vIFBhY2thZ2VzIG11c3QgYmUgb3duZWQgYnkgYSBsaXZlIEFHRU5UIFx1MjAxNCBvdGhlcndpc2UgdGhlIGJvb2tpbmcgc3RhdGVcbi8vIG1hY2hpbmUncyBcIkFHRU5UIChvd25zIHBhY2thZ2UpXCIgYnJhbmNoIGFuZCBhZ2VudC1ib29raW5ncyBzY29waW5nIGJyZWFrLlxuY29uc3QgdmFsaWRhdGVBZ2VudCA9IGFzeW5jIChhZ2VudElkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgYWdlbnQgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogYWdlbnRJZCB9LFxuICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgcm9sZTogdHJ1ZSwgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghYWdlbnQgfHwgYWdlbnQucm9sZSAhPT0gUm9sZS5BR0VOVCB8fCBhZ2VudC5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkludmFsaWQgYWdlbnRJZFwiKTtcbiAgfVxufTtcblxuLy8gQ29sbGlzaW9uLXNhZmUgc2x1ZzogYmFzZSBzbHVnIGZyb20gdGhlIHRpdGxlLCB0aGVuIGAtMmAsIGAtM2AsIC4uLiB1c2luZyBhXG4vLyBzaW5nbGUgcHJlZml4IHF1ZXJ5LiBQdXJlLUJhbmdsYS9lbW9qaSB0aXRsZXMgY2FuJ3Qgc2x1Z2lmeSBcdTIwMTQgZmFsbCBiYWNrIHRvXG4vLyBgcGFja2FnZS08c2hvcnRJZD5gIHNvIHRoZSBVUkwgaXMgYWx3YXlzIG1lYW5pbmdmdWwuXG5jb25zdCBnZW5lcmF0ZVVuaXF1ZVNsdWcgPSBhc3luYyAodGl0bGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gIGNvbnN0IGJhc2UgPSBzbHVnaWZ5KHRpdGxlKSB8fCBgcGFja2FnZS0ke3JhbmRvbVVVSUQoKS5zbGljZSgwLCA4KX1gO1xuXG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICB3aGVyZTogeyBzbHVnOiB7IHN0YXJ0c1dpdGg6IGJhc2UgfSB9LFxuICAgIHNlbGVjdDogeyBzbHVnOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGNvbnN0IHVzZWQgPSBuZXcgU2V0KGV4aXN0aW5nLm1hcCgocCkgPT4gcC5zbHVnKSk7XG4gIGlmICghdXNlZC5oYXMoYmFzZSkpIHtcbiAgICByZXR1cm4gYmFzZTtcbiAgfVxuXG4gIGxldCBzdWZmaXggPSAyO1xuICB3aGlsZSAodXNlZC5oYXMoYCR7YmFzZX0tJHtzdWZmaXh9YCkpIHtcbiAgICBzdWZmaXggKz0gMTtcbiAgfVxuICByZXR1cm4gYCR7YmFzZX0tJHtzdWZmaXh9YDtcbn07XG5cbi8vIDEuIENyZWF0ZSBhIHBhY2thZ2UgKEFHRU5UL0FETUlOKS4gTmV3IHBhY2thZ2VzIHN0YXJ0IFBFTkRJTkcgYW5kIG5ldmVyIGxlYWtcbi8vICAgIGludG8gcHVibGljIHF1ZXJpZXMgdW50aWwgYW4gYWRtaW4gYXBwcm92ZXMgdGhlbS5cbmNvbnN0IGNyZWF0ZVBhY2thZ2UgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYXlsb2FkOiBJQ3JlYXRlUGFja2FnZVBheWxvYWQpID0+IHtcbiAgYXdhaXQgdmFsaWRhdGVDYXRlZ29yeShwYXlsb2FkLmNhdGVnb3J5SWQpO1xuXG4gIC8vIEFETUlOIG1heSBjcmVhdGUgb24gYmVoYWxmIG9mIGFuIGFnZW50IChvcHRpb25hbCBhZ2VudElkKTsgQUdFTlQgYWx3YXlzXG4gIC8vIG93bnMgd2hhdCB0aGV5IGNyZWF0ZSBhbmQgbWF5IG5vdCBpbXBlcnNvbmF0ZSBhbm90aGVyIHVzZXIuXG4gIGxldCBhZ2VudElkOiBzdHJpbmc7XG4gIGlmICh1c2VyLnJvbGUgPT09IFJvbGUuQURNSU4pIHtcbiAgICBpZiAocGF5bG9hZC5hZ2VudElkKSB7XG4gICAgICBhd2FpdCB2YWxpZGF0ZUFnZW50KHBheWxvYWQuYWdlbnRJZCk7XG4gICAgICBhZ2VudElkID0gcGF5bG9hZC5hZ2VudElkO1xuICAgIH0gZWxzZSB7XG4gICAgICBhZ2VudElkID0gdXNlci5pZDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKHBheWxvYWQuYWdlbnRJZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJhZ2VudElkIGNhbiBvbmx5IGJlIHNldCBieSBhbiBhZG1pblwiKTtcbiAgICB9XG4gICAgYWdlbnRJZCA9IHVzZXIuaWQ7XG4gIH1cblxuICBjb25zdCBzbHVnID0gYXdhaXQgZ2VuZXJhdGVVbmlxdWVTbHVnKHBheWxvYWQudGl0bGUpO1xuXG4gIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICB0aXRsZTogcGF5bG9hZC50aXRsZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBwYXlsb2FkLmRlc2NyaXB0aW9uLFxuICAgICAgbG9jYXRpb246IHBheWxvYWQubG9jYXRpb24sXG4gICAgICBwcmljZTogcGF5bG9hZC5wcmljZSxcbiAgICAgIGR1cmF0aW9uOiBwYXlsb2FkLmR1cmF0aW9uLFxuICAgICAgY2F0ZWdvcnlJZDogcGF5bG9hZC5jYXRlZ29yeUlkLFxuICAgICAgaW1hZ2VzOiBwYXlsb2FkLmltYWdlcyxcbiAgICAgIGFnZW50SWQsXG4gICAgICBzbHVnLFxuICAgIH0sXG4gIH0pO1xuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZShjcmVhdGVkKTtcbn07XG5cbi8vIDIuIFB1YmxpYyBleHBsb3JlZCBsaXN0aW5nIFx1MjAxNCBBUFBST1ZFRCArIG5vdC1kZWxldGVkIG9ubHksIGZpbHRlcnMgKyBzb3J0aW5nLlxuY29uc3QgZ2V0UHVibGljUGFja2FnZXMgPSBhc3luYyAocXVlcnk6IElQYWNrYWdlUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCBmaWx0ZXJzOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0W10gPSBbXTtcblxuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgZmlsdGVycy5wdXNoKHtcbiAgICAgIE9SOiBbXG4gICAgICAgIHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgeyBkZXNjcmlwdGlvbjogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICB7IGxvY2F0aW9uOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG4gIGlmIChxdWVyeS5sb2NhdGlvbikge1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICBsb2NhdGlvbjogeyBjb250YWluczogcXVlcnkubG9jYXRpb24sIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9LFxuICAgIH0pO1xuICB9XG4gIGlmIChxdWVyeS5taW5QcmljZSAhPT0gdW5kZWZpbmVkIHx8IHF1ZXJ5Lm1heFByaWNlICE9PSB1bmRlZmluZWQpIHtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgcHJpY2U6IHtcbiAgICAgICAgLi4uKHF1ZXJ5Lm1pblByaWNlICE9PSB1bmRlZmluZWQgPyB7IGd0ZTogcXVlcnkubWluUHJpY2UgfSA6IHt9KSxcbiAgICAgICAgLi4uKHF1ZXJ5Lm1heFByaWNlICE9PSB1bmRlZmluZWQgPyB7IGx0ZTogcXVlcnkubWF4UHJpY2UgfSA6IHt9KSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5Lm1pblJhdGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZmlsdGVycy5wdXNoKHsgcmF0aW5nOiB7IGd0ZTogcXVlcnkubWluUmF0aW5nIH0gfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5Lm1heER1cmF0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICBmaWx0ZXJzLnB1c2goeyBkdXJhdGlvbjogeyBsdGU6IHF1ZXJ5Lm1heER1cmF0aW9uIH0gfSk7XG4gIH1cbiAgaWYgKHF1ZXJ5LmNhdGVnb3J5KSB7XG4gICAgZmlsdGVycy5wdXNoKHsgY2F0ZWdvcnk6IHsgc2x1ZzogcXVlcnkuY2F0ZWdvcnkgfSB9KTtcbiAgfVxuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0ID0ge1xuICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIEFORDogZmlsdGVycy5sZW5ndGggPiAwID8gZmlsdGVycyA6IHVuZGVmaW5lZCxcbiAgfTtcblxuICBjb25zdCBzb3J0T3JkZXIgPSBxdWVyeS5zb3J0T3JkZXIgPz8gKHF1ZXJ5LnNvcnRCeSA9PT0gXCJuZXdlc3RcIiA/IFwiZGVzY1wiIDogXCJhc2NcIik7XG5cbiAgY29uc3Qgb3JkZXJCeU1hcDogUmVjb3JkPHN0cmluZywgUHJpc21hLlRvdXJQYWNrYWdlT3JkZXJCeVdpdGhSZWxhdGlvbklucHV0PiA9IHtcbiAgICBuZXdlc3Q6IHsgY3JlYXRlZEF0OiBzb3J0T3JkZXIgfSxcbiAgICBwcmljZTogeyBwcmljZTogc29ydE9yZGVyIH0sXG4gICAgcmF0aW5nOiB7IHJhdGluZzogc29ydE9yZGVyIH0sXG4gICAgdGl0bGU6IHsgdGl0bGU6IHNvcnRPcmRlciB9LFxuICB9O1xuXG4gIGNvbnN0IG9yZGVyQnkgPSBvcmRlckJ5TWFwW3F1ZXJ5LnNvcnRCeSA/PyBcIm5ld2VzdFwiXSA/PyBvcmRlckJ5TWFwLm5ld2VzdDtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIG9yZGVyQnksXG4gICAgICBpbmNsdWRlOiBwdWJsaWNQYWNrYWdlSW5jbHVkZSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVQcmljZSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMy4gUHVibGljIGRldGFpbCBieSBzbHVnIFx1MjAxNCBBUFBST1ZFRCArIG5vdC1kZWxldGVkIG9ubHkuXG5jb25zdCBnZXRQYWNrYWdlQnlTbHVnID0gYXN5bmMgKHNsdWc6IHN0cmluZykgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7IHNsdWcsIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIGluY2x1ZGU6IHB1YmxpY1BhY2thZ2VJbmNsdWRlLFxuICB9KTtcblxuICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQYWNrYWdlIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UodG91clBhY2thZ2UpO1xufTtcblxuLy8gNC4gQWxsIHBhY2thZ2VzIGZvciB0aGUgYWRtaW4gbW9kZXJhdGlvbiBVSSAoYW55IHN0YXR1cywgb3B0aW9uYWwgZmlsdGVycykuXG5jb25zdCBnZXRBbGxQYWNrYWdlcyA9IGFzeW5jIChxdWVyeTogSUludGVybmFsUGFja2FnZVF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXQgPSB7XG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc3RhdHVzID8geyBzdGF0dXM6IHF1ZXJ5LnN0YXR1cyB9IDoge30pLFxuICAgIC4uLihxdWVyeS5hZ2VudElkID8geyBhZ2VudElkOiBxdWVyeS5hZ2VudElkIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7XG4gICAgICAgIGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0sXG4gICAgICAgIGFnZW50OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVByaWNlKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyA1LiBBbiBhZ2VudCdzIG93biBwYWNrYWdlcyAoYW55IHN0YXR1cykgXHUyMDE0IHNlbGYtcHJldmlldyBiZWZvcmUgYXBwcm92YWwuXG5jb25zdCBnZXRNeVBhY2thZ2VzID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBxdWVyeTogSUludGVybmFsUGFja2FnZVF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Ub3VyUGFja2FnZVdoZXJlSW5wdXQgPSB7XG4gICAgYWdlbnRJZDogdXNlcklkLFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0gfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGE6IGRhdGEubWFwKHNlcmlhbGl6ZVByaWNlKSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyBGZXRjaCArIG93bmVyc2hpcCBnYXRlIHNoYXJlZCBieSBQQVRDSCBhbmQgREVMRVRFLiBBRE1JTiBieXBhc3NlcyBvd25lcnNoaXA7XG4vLyBBR0VOVCBlZGl0cyBhcmUgY29uZmluZWQgdG8gdGhlaXIgb3duIHBhY2thZ2VzLlxuY29uc3QgZmluZE93bmVkUGFja2FnZSA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBhY2thZ2VJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgaWYgKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiAmJiB0b3VyUGFja2FnZS5hZ2VudElkICE9PSB1c2VyLmlkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2FuIG9ubHkgYWN0IG9uIHlvdXIgb3duIHBhY2thZ2VzLlwiKTtcbiAgfVxuXG4gIHJldHVybiB0b3VyUGFja2FnZTtcbn07XG5cbi8vIDYuIFVwZGF0ZSBhIHBhY2thZ2UuIFNsdWcgbmV2ZXIgY2hhbmdlcyAoa2VlcHMgbGlua3MvYm9va21hcmtzIHZhbGlkKS5cbi8vICAgIEFHRU5UIGVkaXRzIHJlc2V0IHN0YXR1cyB0byBQRU5ESU5HOyBBRE1JTiBlZGl0cyBwcmVzZXJ2ZSBpdC5cbmNvbnN0IHVwZGF0ZVBhY2thZ2UgPSBhc3luYyAoXG4gIHVzZXI6IElSZXF1ZXN0VXNlcixcbiAgcGFja2FnZUlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQYWNrYWdlUGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IGZpbmRPd25lZFBhY2thZ2UodXNlciwgcGFja2FnZUlkKTtcblxuICBpZiAocGF5bG9hZC5jYXRlZ29yeUlkICE9PSB1bmRlZmluZWQpIHtcbiAgICBhd2FpdCB2YWxpZGF0ZUNhdGVnb3J5KHBheWxvYWQuY2F0ZWdvcnlJZCk7XG4gIH1cblxuICBjb25zdCBkYXRhOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVJbnB1dCA9IHtcbiAgICAuLi4ocGF5bG9hZC50aXRsZSAhPT0gdW5kZWZpbmVkID8geyB0aXRsZTogcGF5bG9hZC50aXRsZSB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmRlc2NyaXB0aW9uICE9PSB1bmRlZmluZWQgPyB7IGRlc2NyaXB0aW9uOiBwYXlsb2FkLmRlc2NyaXB0aW9uIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQubG9jYXRpb24gIT09IHVuZGVmaW5lZCA/IHsgbG9jYXRpb246IHBheWxvYWQubG9jYXRpb24gfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5wcmljZSAhPT0gdW5kZWZpbmVkID8geyBwcmljZTogcGF5bG9hZC5wcmljZSB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmR1cmF0aW9uICE9PSB1bmRlZmluZWQgPyB7IGR1cmF0aW9uOiBwYXlsb2FkLmR1cmF0aW9uIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuaW1hZ2VzICE9PSB1bmRlZmluZWQgPyB7IGltYWdlczogcGF5bG9hZC5pbWFnZXMgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5jYXRlZ29yeUlkICE9PSB1bmRlZmluZWRcbiAgICAgID8geyBjYXRlZ29yeTogeyBjb25uZWN0OiB7IGlkOiBwYXlsb2FkLmNhdGVnb3J5SWQgfSB9IH1cbiAgICAgIDoge30pLFxuICAgIC4uLih1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gPyB7IHN0YXR1czogUGFja2FnZVN0YXR1cy5QRU5ESU5HIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhLFxuICAgIGluY2x1ZGU6IHsgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSB9LFxuICB9KTtcblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UodXBkYXRlZCk7XG59O1xuXG4vLyA3LiBBcHByb3ZlL3JlamVjdCBhIHBhY2thZ2UgKGFkbWluKS5cbmNvbnN0IGNoYW5nZVBhY2thZ2VTdGF0dXMgPSBhc3luYyAoXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlU3RhdHVzUGF5bG9hZCxcbikgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kVW5pcXVlT3JUaHJvdyh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICB9KTtcblxuICBpZiAodG91clBhY2thZ2UuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDYW5ub3QgY2hhbmdlIHRoZSBzdGF0dXMgb2YgYSBkZWxldGVkIHBhY2thZ2UuXCIpO1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgICBkYXRhOiB7IHN0YXR1czogcGF5bG9hZC5zdGF0dXMgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKHVwZGF0ZWQpO1xufTtcblxuLy8gOC4gU29mdCBkZWxldGUgKGFkbWluIGFueSwgYWdlbnQgb3duKS5cbmNvbnN0IHNvZnREZWxldGVQYWNrYWdlID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGFja2FnZUlkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUGFja2FnZSh1c2VyLCBwYWNrYWdlSWQpO1xuXG4gIHJldHVybiBwcmlzbWEudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgcGFja2FnZVNlcnZpY2UgPSB7XG4gIGNyZWF0ZVBhY2thZ2UsXG4gIGdldFB1YmxpY1BhY2thZ2VzLFxuICBnZXRQYWNrYWdlQnlTbHVnLFxuICBnZXRBbGxQYWNrYWdlcyxcbiAgZ2V0TXlQYWNrYWdlcyxcbiAgdXBkYXRlUGFja2FnZSxcbiAgY2hhbmdlUGFja2FnZVN0YXR1cyxcbiAgc29mdERlbGV0ZVBhY2thZ2UsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCB0aXRsZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlRpdGxlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDMsIFwiVGl0bGUgbXVzdCBiZSBhdCBsZWFzdCAzIGNoYXJhY3RlcnNcIilcbiAgLm1heCgyMDAsIFwiVGl0bGUgbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBkZXNjcmlwdGlvblNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkRlc2NyaXB0aW9uIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEwLCBcIkRlc2NyaXB0aW9uIG11c3QgYmUgYXQgbGVhc3QgMTAgY2hhcmFjdGVyc1wiKVxuICAubWF4KDEwMDAwLCBcIkRlc2NyaXB0aW9uIG11c3QgYmUgYXQgbW9zdCAxMDAwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBsb2NhdGlvblNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkxvY2F0aW9uIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDIsIFwiTG9jYXRpb24gbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgLm1heCgyMDAsIFwiTG9jYXRpb24gbXVzdCBiZSBhdCBtb3N0IDIwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBwcmljZVNjaGVtYSA9IHpcbiAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIlByaWNlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnBvc2l0aXZlKFwiUHJpY2UgbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiKVxuICAucmVmaW5lKCh2YWwpID0+IE1hdGgucm91bmQodmFsICogMTAwKSAvIDEwMCA9PT0gdmFsLCB7XG4gICAgbWVzc2FnZTogXCJQcmljZSBtdXN0IGhhdmUgYXQgbW9zdCAyIGRlY2ltYWwgcGxhY2VzXCIsXG4gIH0pO1xuXG5jb25zdCBkdXJhdGlvblNjaGVtYSA9IHpcbiAgLm51bWJlcih7IHJlcXVpcmVkX2Vycm9yOiBcIkR1cmF0aW9uIGlzIHJlcXVpcmVkXCIgfSlcbiAgLmludChcIkR1cmF0aW9uIG11c3QgYmUgYSB3aG9sZSBudW1iZXIgb2YgZGF5c1wiKVxuICAubWluKDEsIFwiRHVyYXRpb24gbXVzdCBiZSBhdCBsZWFzdCAxIGRheVwiKTtcblxuY29uc3QgY2F0ZWdvcnlJZFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNhdGVnb3J5IGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgLm1pbigxLCBcIkNhdGVnb3J5IGlkIG11c3Qgbm90IGJlIGVtcHR5XCIpO1xuXG5jb25zdCBpbWFnZXNTY2hlbWEgPSB6XG4gIC5hcnJheSh6LnN0cmluZygpLnVybChcIkVhY2ggaW1hZ2UgbXVzdCBiZSBhIHZhbGlkIFVSTFwiKSlcbiAgLm1pbigxLCBcIkF0IGxlYXN0IG9uZSBpbWFnZSBpcyByZXF1aXJlZFwiKVxuICAubWF4KDYsIFwiQXQgbW9zdCA2IGltYWdlcyBhcmUgYWxsb3dlZFwiKTtcblxuY29uc3QgY3JlYXRlUGFja2FnZVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLFxuICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvblNjaGVtYSxcbiAgICBsb2NhdGlvbjogbG9jYXRpb25TY2hlbWEsXG4gICAgcHJpY2U6IHByaWNlU2NoZW1hLFxuICAgIGR1cmF0aW9uOiBkdXJhdGlvblNjaGVtYSxcbiAgICBjYXRlZ29yeUlkOiBjYXRlZ29yeUlkU2NoZW1hLFxuICAgIGltYWdlczogaW1hZ2VzU2NoZW1hLFxuICAgIGFnZW50SWQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlUGFja2FnZVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgbG9jYXRpb246IGxvY2F0aW9uU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgcHJpY2U6IHByaWNlU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgZHVyYXRpb246IGR1cmF0aW9uU2NoZW1hLm9wdGlvbmFsKCksXG4gICAgY2F0ZWdvcnlJZDogY2F0ZWdvcnlJZFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGltYWdlczogaW1hZ2VzU2NoZW1hLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiBPYmplY3Qua2V5cyhkYXRhKS5sZW5ndGggPiAwLCB7XG4gICAgbWVzc2FnZTogXCJBdCBsZWFzdCBvbmUgZmllbGQgbXVzdCBiZSBwcm92aWRlZCB0byB1cGRhdGVcIixcbiAgfSk7XG5cbmNvbnN0IHBhY2thZ2VRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgY2F0ZWdvcnk6IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIGxvY2F0aW9uOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBtaW5QcmljZTogei5jb2VyY2UubnVtYmVyKCkucG9zaXRpdmUoKS5vcHRpb25hbCgpLFxuICAgIG1heFByaWNlOiB6LmNvZXJjZS5udW1iZXIoKS5wb3NpdGl2ZSgpLm9wdGlvbmFsKCksXG4gICAgbWluUmF0aW5nOiB6LmNvZXJjZS5udW1iZXIoKS5taW4oMCkubWF4KDUpLm9wdGlvbmFsKCksXG4gICAgbWF4RHVyYXRpb246IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5vcHRpb25hbCgpLFxuICAgIHNvcnRCeTogelxuICAgICAgLmVudW0oW1wibmV3ZXN0XCIsIFwicHJpY2VcIiwgXCJyYXRpbmdcIiwgXCJ0aXRsZVwiXSlcbiAgICAgIC5kZWZhdWx0KFwibmV3ZXN0XCIpLFxuICAgIHNvcnRPcmRlcjogei5lbnVtKFtcImFzY1wiLCBcImRlc2NcIl0pLm9wdGlvbmFsKCksXG4gIH0pXG4gIC5yZWZpbmUoKGRhdGEpID0+IHtcbiAgICBpZiAoZGF0YS5taW5QcmljZSAhPT0gdW5kZWZpbmVkICYmIGRhdGEubWF4UHJpY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGRhdGEubWluUHJpY2UgPD0gZGF0YS5tYXhQcmljZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sIHtcbiAgICBtZXNzYWdlOiBcIm1pblByaWNlIG11c3QgYmUgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIG1heFByaWNlXCIsXG4gICAgcGF0aDogW1wibWluUHJpY2VcIl0sXG4gIH0pO1xuXG5jb25zdCBpbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgc3RhdHVzOiB6XG4gICAgLmVudW0oW1wiUEVORElOR1wiLCBcIkFQUFJPVkVEXCIsIFwiUkVKRUNURURcIl0pXG4gICAgLnRyYW5zZm9ybSgodmFsKSA9PiB2YWwgYXMgXCJQRU5ESU5HXCIgfCBcIkFQUFJPVkVEXCIgfCBcIlJFSkVDVEVEXCIpXG4gICAgLm9wdGlvbmFsKCksXG4gIGFnZW50SWQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgcGFja2FnZVBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBwYWNrYWdlU2x1Z1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc2x1Zzogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIHNsdWcgaXMgcmVxdWlyZWRcIiB9KS50cmltKCkubWluKDEpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgc3RhdHVzOiB6LmVudW0oW1wiQVBQUk9WRURcIiwgXCJSRUpFQ1RFRFwiXSwge1xuICAgICAgcmVxdWlyZWRfZXJyb3I6IFwiU3RhdHVzIGlzIHJlcXVpcmVkXCIsXG4gICAgICBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiU3RhdHVzIG11c3QgYmUgQVBQUk9WRUQgb3IgUkVKRUNURURcIixcbiAgICB9KSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5leHBvcnQgY29uc3QgcGFja2FnZVZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVQYWNrYWdlU2NoZW1hLFxuICB1cGRhdGVQYWNrYWdlU2NoZW1hLFxuICBwYWNrYWdlUXVlcnlTY2hlbWEsXG4gIGludGVybmFsUGFja2FnZVF1ZXJ5U2NoZW1hLFxuICBwYWNrYWdlUGFyYW1zU2NoZW1hLFxuICBwYWNrYWdlU2x1Z1BhcmFtc1NjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGJsb2dDb250cm9sbGVyIH0gZnJvbSBcIi4vYmxvZy5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBibG9nVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9ibG9nLnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE5PVEU6IGAvaW50ZXJuYWwvKmAgcm91dGVzIE1VU1Qgc3RheSByZWdpc3RlcmVkIGJlZm9yZSBgR0VUIC86c2x1Z2AgYmVsb3cgXHUyMDE0XG4vLyBFeHByZXNzIG1hdGNoZXMgdG9wLWRvd24sIGFuZCBhIGxpdGVyYWwgc2VnbWVudCAoYC9pbnRlcm5hbC9hbGxgKSB3b3VsZFxuLy8gb3RoZXJ3aXNlIGJlIHN3YWxsb3dlZCBieSB0aGUgYDpzbHVnYCBwYXJhbSByb3V0ZSBhbmQgNDA0IGZvcmV2ZXIuXG5cbi8vIDEuIEFsbCBwb3N0cyAoYWRtaW4gbW9kZXJhdGlvbiBVSSkgXHUyMDE0IHJlZ2lzdGVyZWQgYmVmb3JlIC86c2x1Z1xucm91dGVyLmdldChcbiAgXCIvaW50ZXJuYWwvYWxsXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBibG9nVmFsaWRhdGlvbnMuaW50ZXJuYWxRdWVyeVNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0QWxsUG9zdHMsXG4pO1xuXG4vLyAxYi4gT3duIHBvc3RzIChcIk15IFBvc3RzXCIgVUkgZm9yIGFnZW50cy9hZG1pbnMpIFx1MjAxNCBiZWZvcmUgLzpzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi9teS1wb3N0c1wiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLmludGVybmFsUXVlcnlTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldE15UG9zdHMsXG4pO1xuXG4vLyAyLiBQdWJsaWMgbGlzdGluZyBcdTIwMTQgUFVCTElTSEVEICsgbm90LWRlbGV0ZWQgb25seVxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBibG9nVmFsaWRhdGlvbnMucHVibGljUXVlcnlTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldFB1YmxpY1Bvc3RzLFxuKTtcblxuLy8gMy4gUHVibGljIHBvc3QgZGV0YWlsIGJ5IHNsdWdcbnJvdXRlci5nZXQoXG4gIFwiLzpzbHVnXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RTbHVnUGFyYW1zU2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRQb3N0QnlTbHVnLFxuKTtcblxuLy8gNC4gQ3JlYXRlIHBvc3QgKGFnZW50L2FkbWluIGF1dGhvcnMgb3duIHBvc3RzOyBuZXcgcG9zdHMgc3RhcnQgRFJBRlQpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGJsb2dWYWxpZGF0aW9ucy5jcmVhdGVQb3N0U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5jcmVhdGVQb3N0LFxuKTtcblxuLy8gNS4gUHVibGlzaC91bnB1Ymxpc2ggcG9zdCAoYWRtaW4pIFx1MjAxNCByZWdpc3RlcmVkIGJlZm9yZSBQQVRDSCAvOmlkIGZvciBjbGFyaXR5XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJsb2dWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBibG9nQ29udHJvbGxlci5jaGFuZ2VQb3N0U3RhdHVzLFxuKTtcblxuLy8gNi4gVXBkYXRlIHBvc3QgKGFnZW50IG93biAvIGFkbWluIGFueSkgXHUyMDE0IGFnZW50IGVkaXRzIHJlc2V0IHRvIERSQUZUXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogYmxvZ1ZhbGlkYXRpb25zLnVwZGF0ZVBvc3RTY2hlbWEsXG4gIH0pLFxuICBibG9nQ29udHJvbGxlci51cGRhdGVQb3N0LFxuKTtcblxuLy8gNy4gU29mdCBkZWxldGUgcG9zdCAoYWdlbnQgb3duIC8gYWRtaW4gYW55KVxucm91dGVyLmRlbGV0ZShcbiAgXCIvOmlkXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCwgUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHBhcmFtczogYmxvZ1ZhbGlkYXRpb25zLnBvc3RQYXJhbXNTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLnNvZnREZWxldGVQb3N0LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJsb2dSb3V0ZXMgPSByb3V0ZXI7XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGJsb2dTZXJ2aWNlIH0gZnJvbSBcIi4vYmxvZy5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIHBvc3QgY29udHJvbGxlciAoQUdFTlQvQURNSU4pXG5jb25zdCBjcmVhdGVQb3N0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuY3JlYXRlUG9zdChyZXEudXNlciEsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgY3JlYXRlZCBzdWNjZXNzZnVsbHkuIEl0IHdpbGwgYmUgdmlzaWJsZSBhZnRlciBwdWJsaXNoaW5nLlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgY29udHJvbGxlciAoc2VhcmNoICsgc29ydCArIHBhZ2luYXRpb24pXG5jb25zdCBnZXRQdWJsaWNQb3N0cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldFB1YmxpY1Bvc3RzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBQdWJsaWMgcG9zdCBkZXRhaWwgYnkgc2x1Z1xuY29uc3QgZ2V0UG9zdEJ5U2x1ZyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHNsdWcgPSBTdHJpbmcocmVxLnBhcmFtcy5zbHVnKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRQb3N0QnlTbHVnKHNsdWcpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIEFsbCBwb3N0cyBjb250cm9sbGVyIChBRE1JTiBtb2RlcmF0aW9uKVxuY29uc3QgZ2V0QWxsUG9zdHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRBbGxQb3N0cyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBwb3N0cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDRiLiBPd24gcG9zdHMgY29udHJvbGxlciAoQUdFTlQvQURNSU4pXG5jb25zdCBnZXRNeVBvc3RzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0TXlQb3N0cyhyZXEudXNlciEsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA1LiBVcGRhdGUgcG9zdCBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCB1cGRhdGVQb3N0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UudXBkYXRlUG9zdChyZXEudXNlciEsIGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDYuIENoYW5nZSBwb3N0IHN0YXR1cyBjb250cm9sbGVyIChBRE1JTiBwdWJsaXNoL3VucHVibGlzaClcbmNvbnN0IGNoYW5nZVBvc3RTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5jaGFuZ2VQb3N0U3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSBwb3N0IGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHNvZnREZWxldGVQb3N0ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgYXdhaXQgYmxvZ1NlcnZpY2Uuc29mdERlbGV0ZVBvc3QocmVxLnVzZXIhLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUG9zdCBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYmxvZ0NvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBvc3QsXG4gIGdldFB1YmxpY1Bvc3RzLFxuICBnZXRQb3N0QnlTbHVnLFxuICBnZXRBbGxQb3N0cyxcbiAgZ2V0TXlQb3N0cyxcbiAgdXBkYXRlUG9zdCxcbiAgY2hhbmdlUG9zdFN0YXR1cyxcbiAgc29mdERlbGV0ZVBvc3QsXG59O1xuIiwgImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tIFwibm9kZTpjcnlwdG9cIjtcbmltcG9ydCB7IFBvc3RTdGF0dXMsIFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi4vLi4vbGliL3ByaXNtYVwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2x1Z2lmeVwiO1xuaW1wb3J0IHtcbiAgSUNyZWF0ZVBvc3RQYXlsb2FkLFxuICBJSW50ZXJuYWxQb3N0UXVlcnksXG4gIElQb3N0UXVlcnksXG4gIElSZXF1ZXN0VXNlcixcbiAgSVVwZGF0ZVBvc3RQYXlsb2FkLFxuICBJVXBkYXRlUG9zdFN0YXR1c1BheWxvYWQsXG59IGZyb20gXCIuL2Jsb2cuaW50ZXJmYWNlXCI7XG5cbi8vIFB1YmxpYyBwYXlsb2FkcyBjYXJyeSB0aGUgYXV0aG9yJ3MgZGlzcGxheSBpbmZvIG9ubHkgXHUyMDE0IG5ldmVyIGVtYWlsL3JvbGUuXG5jb25zdCBwdWJsaWNBdXRob3JTZWxlY3QgPSB7XG4gIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgYXZhdGFyVXJsOiB0cnVlIH0sXG59O1xuXG4vLyBDb2xsaXNpb24tc2FmZSBzbHVnOiBiYXNlIHNsdWcgZnJvbSB0aGUgdGl0bGUsIHRoZW4gYC0yYCwgYC0zYCwgLi4uIHVzaW5nIGFcbi8vIHNpbmdsZSBwcmVmaXggcXVlcnkuIFB1cmUtQmFuZ2xhL2Vtb2ppIHRpdGxlcyBjYW4ndCBzbHVnaWZ5IFx1MjAxNCBmYWxsIGJhY2sgdG9cbi8vIGBibG9nLTxzaG9ydElkPmAgc28gdGhlIFVSTCBpcyBhbHdheXMgbWVhbmluZ2Z1bC5cbmNvbnN0IGdlbmVyYXRlVW5pcXVlU2x1ZyA9IGFzeW5jICh0aXRsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgY29uc3QgYmFzZSA9IHNsdWdpZnkodGl0bGUpIHx8IGBibG9nLSR7cmFuZG9tVVVJRCgpLnNsaWNlKDAsIDgpfWA7XG5cbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgIHdoZXJlOiB7IHNsdWc6IHsgc3RhcnRzV2l0aDogYmFzZSB9IH0sXG4gICAgc2VsZWN0OiB7IHNsdWc6IHRydWUgfSxcbiAgfSk7XG5cbiAgY29uc3QgdXNlZCA9IG5ldyBTZXQoZXhpc3RpbmcubWFwKChwKSA9PiBwLnNsdWcpKTtcbiAgaWYgKCF1c2VkLmhhcyhiYXNlKSkge1xuICAgIHJldHVybiBiYXNlO1xuICB9XG5cbiAgbGV0IHN1ZmZpeCA9IDI7XG4gIHdoaWxlICh1c2VkLmhhcyhgJHtiYXNlfS0ke3N1ZmZpeH1gKSkge1xuICAgIHN1ZmZpeCArPSAxO1xuICB9XG4gIHJldHVybiBgJHtiYXNlfS0ke3N1ZmZpeH1gO1xufTtcblxuLy8gMS4gQ3JlYXRlIGEgcG9zdCAoQUdFTlQvQURNSU4pLiBOZXcgcG9zdHMgc3RhcnQgRFJBRlQgYW5kIG5ldmVyIGxlYWsgaW50b1xuLy8gICAgcHVibGljIHF1ZXJpZXMgdW50aWwgYW4gYWRtaW4gcHVibGlzaGVzIHRoZW0uXG5jb25zdCBjcmVhdGVQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGF5bG9hZDogSUNyZWF0ZVBvc3RQYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHNsdWcgPSBhd2FpdCBnZW5lcmF0ZVVuaXF1ZVNsdWcocGF5bG9hZC50aXRsZSk7XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC5jcmVhdGUoe1xuICAgIGRhdGE6IHtcbiAgICAgIHRpdGxlOiBwYXlsb2FkLnRpdGxlLFxuICAgICAgZXhjZXJwdDogcGF5bG9hZC5leGNlcnB0LFxuICAgICAgY29udGVudDogcGF5bG9hZC5jb250ZW50LFxuICAgICAgY292ZXJJbWFnZTogcGF5bG9hZC5jb3ZlckltYWdlLFxuICAgICAgc2x1ZyxcbiAgICAgIGF1dGhvcklkOiB1c2VyLmlkLFxuICAgIH0sXG4gICAgaW5jbHVkZTogeyBhdXRob3I6IHB1YmxpY0F1dGhvclNlbGVjdCB9LFxuICB9KTtcbn07XG5cbi8vIDIuIFB1YmxpYyBibG9nIGxpc3RpbmcgXHUyMDE0IFBVQkxJU0hFRCArIG5vdC1kZWxldGVkIG9ubHksIHNlYXJjaCArIHNvcnQuXG5jb25zdCBnZXRQdWJsaWNQb3N0cyA9IGFzeW5jIChxdWVyeTogSVBvc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQmxvZ1Bvc3RXaGVyZUlucHV0ID0ge1xuICAgIHN0YXR1czogUG9zdFN0YXR1cy5QVUJMSVNIRUQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc2VhcmNoXG4gICAgICA/IHtcbiAgICAgICAgICBPUjogW1xuICAgICAgICAgICAgeyB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICAgICAgeyBleGNlcnB0OiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfVxuICAgICAgOiB7fSksXG4gIH07XG5cbiAgY29uc3Qgc29ydE9yZGVyID0gcXVlcnkuc29ydE9yZGVyID8/IChxdWVyeS5zb3J0QnkgPT09IFwib2xkZXN0XCIgPyBcImFzY1wiIDogXCJkZXNjXCIpO1xuXG4gIGNvbnN0IG9yZGVyQnlNYXA6IFJlY29yZDxzdHJpbmcsIFByaXNtYS5CbG9nUG9zdE9yZGVyQnlXaXRoUmVsYXRpb25JbnB1dD4gPSB7XG4gICAgbmV3ZXN0OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICBvbGRlc3Q6IHsgY3JlYXRlZEF0OiBcImFzY1wiIH0sXG4gICAgdGl0bGU6IHsgdGl0bGU6IHNvcnRPcmRlciB9LFxuICB9O1xuXG4gIGNvbnN0IG9yZGVyQnkgPSBvcmRlckJ5TWFwW3F1ZXJ5LnNvcnRCeSA/PyBcIm5ld2VzdFwiXSA/PyBvcmRlckJ5TWFwLm5ld2VzdDtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIG9yZGVyQnksXG4gICAgICBzZWxlY3Q6IHtcbiAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgIHRpdGxlOiB0cnVlLFxuICAgICAgICBzbHVnOiB0cnVlLFxuICAgICAgICBleGNlcnB0OiB0cnVlLFxuICAgICAgICBjb3ZlckltYWdlOiB0cnVlLFxuICAgICAgICBjcmVhdGVkQXQ6IHRydWUsXG4gICAgICAgIHVwZGF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QsXG4gICAgICB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nUG9zdC5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gMy4gUHVibGljIHBvc3QgZGV0YWlsIGJ5IHNsdWcgXHUyMDE0IFBVQkxJU0hFRCArIG5vdC1kZWxldGVkIG9ubHkuXG5jb25zdCBnZXRQb3N0QnlTbHVnID0gYXN5bmMgKHNsdWc6IHN0cmluZykgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHsgc2x1Zywgc3RhdHVzOiBQb3N0U3RhdHVzLlBVQkxJU0hFRCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG5cbiAgaWYgKCFwb3N0KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQb3N0IG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICByZXR1cm4gcG9zdDtcbn07XG5cbi8vIDQuIEFsbCBwb3N0cyBmb3IgdGhlIGFkbWluIG1vZGVyYXRpb24gVUkgKGFueSBzdGF0dXMsIG9wdGlvbmFsIGZpbHRlcikuXG5jb25zdCBnZXRBbGxQb3N0cyA9IGFzeW5jIChxdWVyeTogSUludGVybmFsUG9zdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5CbG9nUG9zdFdoZXJlSW5wdXQgPSB7XG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc3RhdHVzID8geyBzdGF0dXM6IHF1ZXJ5LnN0YXR1cyB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBhdXRob3I6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0gfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nUG9zdC5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gNGIuIFRoZSBjYWxsZXIncyBvd24gcG9zdHMgKEFHRU5UL0FETUlOIFwiTXkgUG9zdHNcIiBVSSkgXHUyMDE0IGFueSBzdGF0dXMsIHNpbmNlXG4vLyAgICAgYWdlbnRzIG11c3Qgc2VlIHRoZWlyIG93biBkcmFmdHMgYmVmb3JlIGFuIGFkbWluIHB1Ymxpc2hlcyB0aGVtLlxuY29uc3QgZ2V0TXlQb3N0cyA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHF1ZXJ5OiBJSW50ZXJuYWxQb3N0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkJsb2dQb3N0V2hlcmVJbnB1dCA9IHtcbiAgICBhdXRob3JJZDogdXNlci5pZCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIC4uLihxdWVyeS5zdGF0dXMgPyB7IHN0YXR1czogcXVlcnkuc3RhdHVzIH0gOiB7fSksXG4gIH07XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlOiB7IGF1dGhvcjogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0gfSB9LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmJsb2dQb3N0LmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7IHBhZ2UsIGxpbWl0LCB0b3RhbCwgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpIH0sXG4gIH07XG59O1xuXG4vLyBGZXRjaCArIG93bmVyc2hpcCBnYXRlIHNoYXJlZCBieSBQQVRDSCBhbmQgREVMRVRFLiBBRE1JTiBieXBhc3NlcyBvd25lcnNoaXA7XG4vLyBBR0VOVCBlZGl0cyBhcmUgY29uZmluZWQgdG8gdGhlaXIgb3duIHBvc3RzLlxuY29uc3QgZmluZE93bmVkUG9zdCA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBvc3RJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHBvc3QgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICB9KTtcblxuICBpZiAoIXBvc3QpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBvc3Qgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGlmICh1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gJiYgcG9zdC5hdXRob3JJZCAhPT0gdXNlci5pZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGNhbiBvbmx5IGFjdCBvbiB5b3VyIG93biBwb3N0cy5cIik7XG4gIH1cblxuICByZXR1cm4gcG9zdDtcbn07XG5cbi8vIDUuIFVwZGF0ZSBhIHBvc3QuIFNsdWcgbmV2ZXIgY2hhbmdlcyAoa2VlcHMgbGlua3MvYm9va21hcmtzIHZhbGlkKS5cbi8vICAgIEFHRU5UIGVkaXRzIHJlc2V0IHN0YXR1cyB0byBEUkFGVCAocmUtcHVibGlzaCB2aWEgLzppZC9zdGF0dXMpO1xuLy8gICAgQURNSU4gZWRpdHMgcHJlc2VydmUgc3RhdHVzLlxuY29uc3QgdXBkYXRlUG9zdCA9IGFzeW5jIChcbiAgdXNlcjogSVJlcXVlc3RVc2VyLFxuICBwb3N0SWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVBvc3RQYXlsb2FkLFxuKSA9PiB7XG4gIGF3YWl0IGZpbmRPd25lZFBvc3QodXNlciwgcG9zdElkKTtcblxuICBjb25zdCBkYXRhOiBQcmlzbWEuQmxvZ1Bvc3RVcGRhdGVJbnB1dCA9IHtcbiAgICAuLi4ocGF5bG9hZC50aXRsZSAhPT0gdW5kZWZpbmVkID8geyB0aXRsZTogcGF5bG9hZC50aXRsZSB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmV4Y2VycHQgIT09IHVuZGVmaW5lZCA/IHsgZXhjZXJwdDogcGF5bG9hZC5leGNlcnB0IH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuY29udGVudCAhPT0gdW5kZWZpbmVkID8geyBjb250ZW50OiBwYXlsb2FkLmNvbnRlbnQgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5jb3ZlckltYWdlICE9PSB1bmRlZmluZWRcbiAgICAgID8geyBjb3ZlckltYWdlOiBwYXlsb2FkLmNvdmVySW1hZ2UgfVxuICAgICAgOiB7fSksXG4gICAgLi4uKHVzZXIucm9sZSAhPT0gUm9sZS5BRE1JTiA/IHsgc3RhdHVzOiBQb3N0U3RhdHVzLkRSQUZUIH0gOiB7fSksXG4gIH07XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgICBkYXRhLFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG59O1xuXG4vLyA2LiBQdWJsaXNoL3VucHVibGlzaCBhIHBvc3QgKGFkbWluKS5cbmNvbnN0IGNoYW5nZVBvc3RTdGF0dXMgPSBhc3luYyAoXG4gIHBvc3RJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlUG9zdFN0YXR1c1BheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kVW5pcXVlT3JUaHJvdyh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICB9KTtcblxuICBpZiAocG9zdC5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkNhbm5vdCBjaGFuZ2UgdGhlIHN0YXR1cyBvZiBhIGRlbGV0ZWQgcG9zdC5cIik7XG4gIH1cblxuICByZXR1cm4gcHJpc21hLmJsb2dQb3N0LnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBvc3RJZCB9LFxuICAgIGRhdGE6IHsgc3RhdHVzOiBwYXlsb2FkLnN0YXR1cyB9LFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG59O1xuXG4vLyA3LiBTb2Z0IGRlbGV0ZSAoYWRtaW4gYW55LCBhZ2VudCBvd24pLlxuY29uc3Qgc29mdERlbGV0ZVBvc3QgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwb3N0SWQ6IHN0cmluZykgPT4ge1xuICBhd2FpdCBmaW5kT3duZWRQb3N0KHVzZXIsIHBvc3RJZCk7XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgICBkYXRhOiB7IGlzRGVsZXRlZDogdHJ1ZSB9LFxuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBibG9nU2VydmljZSA9IHtcbiAgY3JlYXRlUG9zdCxcbiAgZ2V0UHVibGljUG9zdHMsXG4gIGdldFBvc3RCeVNsdWcsXG4gIGdldEFsbFBvc3RzLFxuICBnZXRNeVBvc3RzLFxuICB1cGRhdGVQb3N0LFxuICBjaGFuZ2VQb3N0U3RhdHVzLFxuICBzb2Z0RGVsZXRlUG9zdCxcbn07XG4iLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgdGl0bGVTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJUaXRsZSBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigzLCBcIlRpdGxlIG11c3QgYmUgYXQgbGVhc3QgMyBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMjAwLCBcIlRpdGxlIG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgZXhjZXJwdFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkV4Y2VycHQgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMSwgXCJFeGNlcnB0IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gIC5tYXgoNTAwLCBcIkV4Y2VycHQgbXVzdCBiZSBhdCBtb3N0IDUwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBjb250ZW50U2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ29udGVudCBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigxLCBcIkNvbnRlbnQgbXVzdCBub3QgYmUgZW1wdHlcIilcbiAgLm1heCgxMDAwMCwgXCJDb250ZW50IG11c3QgYmUgYXQgbW9zdCAxMDAwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBjb3ZlckltYWdlU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ292ZXIgaW1hZ2UgaXMgcmVxdWlyZWRcIiB9KVxuICAudXJsKFwiQ292ZXIgaW1hZ2UgbXVzdCBiZSBhIHZhbGlkIFVSTFwiKTtcblxuY29uc3QgY3JlYXRlUG9zdFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgdGl0bGU6IHRpdGxlU2NoZW1hLFxuICAgIGV4Y2VycHQ6IGV4Y2VycHRTY2hlbWEsXG4gICAgY29udGVudDogY29udGVudFNjaGVtYSxcbiAgICBjb3ZlckltYWdlOiBjb3ZlckltYWdlU2NoZW1hLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHVwZGF0ZVBvc3RTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGV4Y2VycHQ6IGV4Y2VycHRTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBjb250ZW50OiBjb250ZW50U2NoZW1hLm9wdGlvbmFsKCksXG4gICAgY292ZXJJbWFnZTogY292ZXJJbWFnZVNjaGVtYS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KClcbiAgLnJlZmluZSgoZGF0YSkgPT4gT2JqZWN0LmtleXMoZGF0YSkubGVuZ3RoID4gMCwge1xuICAgIG1lc3NhZ2U6IFwiQXQgbGVhc3Qgb25lIGZpZWxkIG11c3QgYmUgcHJvdmlkZWQgdG8gdXBkYXRlXCIsXG4gIH0pO1xuXG5jb25zdCBwb3N0UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQb3N0IGlkIGlzIHJlcXVpcmVkXCIgfSkubWluKDEpLFxufSk7XG5cbmNvbnN0IHBvc3RTbHVnUGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBzbHVnOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBvc3Qgc2x1ZyBpcyByZXF1aXJlZFwiIH0pLnRyaW0oKS5taW4oMSksXG59KTtcblxuY29uc3QgdXBkYXRlU3RhdHVzU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBzdGF0dXM6IHouZW51bShbXCJEUkFGVFwiLCBcIlBVQkxJU0hFRFwiXSwge1xuICAgICAgcmVxdWlyZWRfZXJyb3I6IFwiU3RhdHVzIGlzIHJlcXVpcmVkXCIsXG4gICAgICBpbnZhbGlkX3R5cGVfZXJyb3I6IFwiU3RhdHVzIG11c3QgYmUgRFJBRlQgb3IgUFVCTElTSEVEXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuY29uc3QgcHVibGljUXVlcnlTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICAgIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIHNvcnRCeTogei5lbnVtKFtcIm5ld2VzdFwiLCBcIm9sZGVzdFwiLCBcInRpdGxlXCJdKS5kZWZhdWx0KFwibmV3ZXN0XCIpLFxuICAgIHNvcnRPcmRlcjogei5lbnVtKFtcImFzY1wiLCBcImRlc2NcIl0pLm9wdGlvbmFsKCksXG4gIH0pO1xuXG5jb25zdCBpbnRlcm5hbFF1ZXJ5U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gICAgc3RhdHVzOiB6XG4gICAgICAuZW51bShbXCJEUkFGVFwiLCBcIlBVQkxJU0hFRFwiXSlcbiAgICAgIC50cmFuc2Zvcm0oKHZhbCkgPT4gdmFsIGFzIFwiRFJBRlRcIiB8IFwiUFVCTElTSEVEXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgfSk7XG5cbmV4cG9ydCBjb25zdCBibG9nVmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVBvc3RTY2hlbWEsXG4gIHVwZGF0ZVBvc3RTY2hlbWEsXG4gIHBvc3RQYXJhbXNTY2hlbWEsXG4gIHBvc3RTbHVnUGFyYW1zU2NoZW1hLFxuICB1cGRhdGVTdGF0dXNTY2hlbWEsXG4gIHB1YmxpY1F1ZXJ5U2NoZW1hLFxuICBpbnRlcm5hbFF1ZXJ5U2NoZW1hLFxufTtcbiIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgZGFzaGJvYXJkQ29udHJvbGxlciB9IGZyb20gXCIuL2Rhc2hib2FyZC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBkYXNoYm9hcmRWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2Rhc2hib2FyZC52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBBZG1pbiBkYXNoYm9hcmQgXHUyMDE0IHBsYXRmb3JtLXdpZGUgYW5hbHl0aWNzXG5yb3V0ZXIuZ2V0KFxuICBcIi9hZG1pblwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogZGFzaGJvYXJkVmFsaWRhdGlvbnMuZGFzaGJvYXJkUXVlcnlTY2hlbWEgfSksXG4gIGRhc2hib2FyZENvbnRyb2xsZXIuZ2V0QWRtaW5EYXNoYm9hcmQsXG4pO1xuXG4vLyAyLiBBZ2VudCBkYXNoYm9hcmQgXHUyMDE0IG93biBwYWNrYWdlcy9ib29raW5ncy9yZXZlbnVlL3BlcmZvcm1hbmNlXG5yb3V0ZXIuZ2V0KFxuICBcIi9hZ2VudFwiLFxuICBhdXRoKFJvbGUuQUdFTlQpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogZGFzaGJvYXJkVmFsaWRhdGlvbnMuZGFzaGJvYXJkUXVlcnlTY2hlbWEgfSksXG4gIGRhc2hib2FyZENvbnRyb2xsZXIuZ2V0QWdlbnREYXNoYm9hcmQsXG4pO1xuXG4vLyAzLiBVc2VyIGRhc2hib2FyZCBcdTIwMTQgb3duIGJvb2tpbmdzL3VwY29taW5nL3NwZW5kXG5yb3V0ZXIuZ2V0KFwiL3VzZXJcIiwgYXV0aChSb2xlLlVTRVIpLCBkYXNoYm9hcmRDb250cm9sbGVyLmdldFVzZXJEYXNoYm9hcmQpO1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgZGFzaGJvYXJkU2VydmljZSB9IGZyb20gXCIuL2Rhc2hib2FyZC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQWRtaW4gZGFzaGJvYXJkIGNvbnRyb2xsZXIgKEFETUlOKVxuY29uc3QgZ2V0QWRtaW5EYXNoYm9hcmQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkYXNoYm9hcmRTZXJ2aWNlLmdldEFkbWluRGFzaGJvYXJkKFxuICAgICAgTnVtYmVyKHJlcS5xdWVyeS5kYXlzKSxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRhc2hib2FyZCBkYXRhIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gQWdlbnQgZGFzaGJvYXJkIGNvbnRyb2xsZXIgKEFHRU5UKVxuY29uc3QgZ2V0QWdlbnREYXNoYm9hcmQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkYXNoYm9hcmRTZXJ2aWNlLmdldEFnZW50RGFzaGJvYXJkKFxuICAgICAgdXNlcklkLFxuICAgICAgTnVtYmVyKHJlcS5xdWVyeS5kYXlzKSxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkRhc2hib2FyZCBkYXRhIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gVXNlciBkYXNoYm9hcmQgY29udHJvbGxlciAoVVNFUilcbmNvbnN0IGdldFVzZXJEYXNoYm9hcmQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmVxLnVzZXI/LmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkYXNoYm9hcmRTZXJ2aWNlLmdldFVzZXJEYXNoYm9hcmQodXNlcklkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRDb250cm9sbGVyID0ge1xuICBnZXRBZG1pbkRhc2hib2FyZCxcbiAgZ2V0QWdlbnREYXNoYm9hcmQsXG4gIGdldFVzZXJEYXNoYm9hcmQsXG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMsIFBhY2thZ2VTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7XG4gIElBZ2VudERhc2hib2FyZCxcbiAgSUFkbWluRGFzaGJvYXJkLFxuICBJQm9va2luZ3NCeVN0YXR1cyxcbiAgSVJldmVudWVQb2ludCxcbiAgSVVzZXJEYXNoYm9hcmQsXG59IGZyb20gXCIuL2Rhc2hib2FyZC5pbnRlcmZhY2VcIjtcblxuLy8gTW9uZXkgaXMgYERlY2ltYWwoMTAsMilgIGluIHRoZSBzY2hlbWEgKEFHRU5UUy5tZCkgXHUyMDE0IG1hcCB0byBOdW1iZXIgb24gcmV0dXJuLlxuY29uc3QgdG9OdW1iZXIgPSAodmFsdWU6IHVua25vd24pOiBudW1iZXIgPT4gTnVtYmVyKHZhbHVlID8/IDApO1xuXG4vLyBCb29raW5nLXN0YXR1cyBicmVha2Rvd24gdmlhIGdyb3VwQnkgKyBfY291bnQuIE9wdGlvbmFsIHBhY2thZ2UtaWQgc2NvcGVcbi8vIChgYWdlbnRJZGApIGxpbWl0cyBpdCB0byBhbiBhZ2VudCdzIG93biwgbm9uLWRlbGV0ZWQgcGFja2FnZXMuXG5jb25zdCBnZXRCb29raW5nc0J5U3RhdHVzID0gYXN5bmMgKFxuICBhZ2VudElkPzogc3RyaW5nLFxuKTogUHJvbWlzZTxJQm9va2luZ3NCeVN0YXR1c1tdPiA9PiB7XG4gIGNvbnN0IGdyb3VwZWQgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5ncm91cEJ5KHtcbiAgICBieTogW1wic3RhdHVzXCJdLFxuICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgd2hlcmU6IGFnZW50SWRcbiAgICAgID8geyBwYWNrYWdlOiB7IGFnZW50SWQsIGlzRGVsZXRlZDogZmFsc2UgfSB9XG4gICAgICA6IHVuZGVmaW5lZCxcbiAgfSk7XG5cbiAgcmV0dXJuIGdyb3VwZWRcbiAgICAubWFwKChnKSA9PiAoeyBzdGF0dXM6IGcuc3RhdHVzLCBjb3VudDogZy5fY291bnQuX2FsbCB9KSlcbiAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpO1xufTtcblxuLy8gUmV2ZW51ZSB0cmVuZDogb25lIHJvdyBwZXIgZGF5IGZvciB0aGUgbGFzdCBgZGF5c2AgZGF5cywgYnVja2V0aW5nIENPTVBMRVRFRFxuLy8gYm9va2luZ3MgYnkgdGhlaXIgYHVwZGF0ZWRBdGAgXHUyMDE0IHRoZSB0aW1lc3RhbXAgb2YgdGhlIHRyYW5zaXRpb24gaW50b1xuLy8gQ09NUExFVEVEIChhIHRlcm1pbmFsIHN0YXRlLCBzbyBpdCBpcyB0aGUgbGFzdCB3cml0ZSkuIGBjcmVhdGVkQXRgIGlzIHdoZW5cbi8vIHRoZSBib29raW5nIHdhcyBtYWRlIChQRU5ESU5HKSBhbmQgbmV2ZXIgbW92ZXMsIHdoaWNoIHdvdWxkIG1pcy1kYXRlIHJldmVudWVcbi8vIHdlZWtzIGxhdGVyLiBQb3N0Z3JlcyBnZW5lcmF0ZV9zZXJpZXMgZ3VhcmFudGVlcyBhIGRlbnNlIHNlcmllcyAoemVyby1maWxsZWRcbi8vIGRheXMpIFx1MjAxNCBiZXR0ZXIgYW5kIGZhc3RlciB0aGFuIGEgcGVyLWRheSBKUyBsb29wLlxuY29uc3QgZ2V0UmV2ZW51ZU92ZXJUaW1lID0gYXN5bmMgKFxuICBkYXlzOiBudW1iZXIsXG4gIGFnZW50SWQ/OiBzdHJpbmcsXG4pOiBQcm9taXNlPElSZXZlbnVlUG9pbnRbXT4gPT4ge1xuICBjb25zdCBzY29wZSA9IGFnZW50SWRcbiAgICA/IGBBTkQgYi5cInBhY2thZ2VJZFwiIElOIChcbiAgICAgICAgIFNFTEVDVCBwLlwiaWRcIlxuICAgICAgICAgRlJPTSBcInRvdXJfcGFja2FnZXNcIiBwXG4gICAgICAgICBXSEVSRSBwLlwiYWdlbnRJZFwiID0gJDJcbiAgICAgICAgICAgQU5EIHAuXCJpc0RlbGV0ZWRcIiA9IGZhbHNlXG4gICAgICAgKWBcbiAgICA6IFwiXCI7XG5cbiAgY29uc3Qgcm93cyA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdVbnNhZmU8XG4gICAgeyBkYXRlOiBzdHJpbmc7IHJldmVudWU6IG51bWJlciB9W11cbiAgPihcbiAgICBgXG4gICAgU0VMRUNUIHRvX2NoYXIoZGF5cy5kLCAnWVlZWS1NTS1ERCcpIEFTIGRhdGUsXG4gICAgICAgICAgIENPQUxFU0NFKFNVTShiLlwidG90YWxQcmljZVwiKSwgMCk6OmZsb2F0OCBBUyByZXZlbnVlXG4gICAgRlJPTSBnZW5lcmF0ZV9zZXJpZXMoXG4gICAgICBDVVJSRU5UX0RBVEUgLSBtYWtlX2ludGVydmFsKGRheXMgPT4gJDE6OmludCAtIDEpLFxuICAgICAgQ1VSUkVOVF9EQVRFLFxuICAgICAgJzEgZGF5Jzo6aW50ZXJ2YWxcbiAgICApIEFTIGRheXMoZClcbiAgICBMRUZUIEpPSU4gXCJib29raW5nc1wiIGJcbiAgICAgIE9OIGRhdGVfdHJ1bmMoJ2RheScsIGIuXCJ1cGRhdGVkQXRcIik6OmRhdGUgPSBkYXlzLmRcbiAgICAgIEFORCBiLlwic3RhdHVzXCIgPSAnQ09NUExFVEVEJ1xuICAgICAgJHtzY29wZX1cbiAgICBHUk9VUCBCWSBkYXlzLmRcbiAgICBPUkRFUiBCWSBkYXlzLmQgQVNDXG4gICAgYCxcbiAgICBkYXlzLFxuICAgIC4uLihhZ2VudElkID8gW2FnZW50SWRdIDogW10pLFxuICApO1xuXG4gIHJldHVybiByb3dzO1xufTtcblxuLy8gUGFja2FnZS1pZCBzY29wZSBmb3IgYm9va2luZyBxdWVyaWVzLiBDYWxsZXJzIHNob3J0LWNpcmN1aXQgdGhlIGVtcHR5IGNhc2Vcbi8vIChhbiBhZ2VudCB3aXRoIG5vIHBhY2thZ2VzKSwgYnV0IGFuIGBpbjogW11gIGZhbGxiYWNrIGtlZXBzIHRoZSB0eXBlXG4vLyBub24tbnVsbGFibGUgd2hpbGUgc3RpbGwgbWF0Y2hpbmcgbm90aGluZyBpZiBpdCBldmVyIHNsaXBzIHRocm91Z2guXG5jb25zdCB0b1BhY2thZ2VJZFNjb3BlID0gKFxuICBwYWNrYWdlSWRzOiBzdHJpbmdbXSxcbik6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9PlxuICBwYWNrYWdlSWRzLmxlbmd0aFxuICAgID8geyBwYWNrYWdlSWQ6IHsgaW46IHBhY2thZ2VJZHMgfSB9XG4gICAgOiB7IHBhY2thZ2VJZDogeyBpbjogW10gfSB9O1xuXG4vLyAxLiBBZG1pbiBkYXNoYm9hcmQgXHUyMDE0IHBsYXRmb3JtLXdpZGUgY291bnRzLCBicmVha2Rvd25zIGFuZCByZXZlbnVlIHRyZW5kLlxuY29uc3QgZ2V0QWRtaW5EYXNoYm9hcmQgPSBhc3luYyAoZGF5czogbnVtYmVyKTogUHJvbWlzZTxJQWRtaW5EYXNoYm9hcmQ+ID0+IHtcbiAgY29uc3QgW1xuICAgIHRvdGFsVXNlcnMsXG4gICAgdG90YWxQYWNrYWdlcyxcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsUmV2ZW51ZSxcbiAgICB1c2Vyc0J5Um9sZSxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHBhY2thZ2VzQnlDYXRlZ29yeSxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnVzZXIuY291bnQoeyB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0gfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9IH0pLFxuICAgIHByaXNtYS5ib29raW5nLmNvdW50KCksXG4gICAgcHJpc21hLmJvb2tpbmcuYWdncmVnYXRlKHtcbiAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCB9LFxuICAgIH0pLFxuICAgIHByaXNtYS51c2VyLmdyb3VwQnkoe1xuICAgICAgYnk6IFtcInJvbGVcIl0sXG4gICAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgIH0pLFxuICAgIGdldEJvb2tpbmdzQnlTdGF0dXMoKSxcbiAgICBwcmlzbWEudG91clBhY2thZ2VcbiAgICAgIC5ncm91cEJ5KHtcbiAgICAgICAgYnk6IFtcImNhdGVnb3J5SWRcIl0sXG4gICAgICAgIF9jb3VudDogeyBfYWxsOiB0cnVlIH0sXG4gICAgICAgIHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICAgIH0pXG4gICAgICAudGhlbihhc3luYyAoZ3JvdXBlZCkgPT4ge1xuICAgICAgICBjb25zdCBjYXRlZ29yeUlkcyA9IGdyb3VwZWQubWFwKChnKSA9PiBnLmNhdGVnb3J5SWQpO1xuICAgICAgICBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KHtcbiAgICAgICAgICB3aGVyZTogeyBpZDogeyBpbjogY2F0ZWdvcnlJZHMgfSB9LFxuICAgICAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9LFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgbmFtZU1hcCA9IG5ldyBNYXAoY2F0ZWdvcmllcy5tYXAoKGMpID0+IFtjLmlkLCBjLm5hbWVdKSk7XG5cbiAgICAgICAgcmV0dXJuIGdyb3VwZWRcbiAgICAgICAgICAubWFwKChnKSA9PiAoe1xuICAgICAgICAgICAgY2F0ZWdvcnk6IG5hbWVNYXAuZ2V0KGcuY2F0ZWdvcnlJZCkgPz8gXCJVbmtub3duXCIsXG4gICAgICAgICAgICBjb3VudDogZy5fY291bnQuX2FsbCxcbiAgICAgICAgICB9KSlcbiAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5jb3VudCAtIGEuY291bnQpO1xuICAgICAgfSksXG4gICAgZ2V0UmV2ZW51ZU92ZXJUaW1lKGRheXMpLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsVXNlcnMsXG4gICAgdG90YWxQYWNrYWdlcyxcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsUmV2ZW51ZTogdG9OdW1iZXIodG90YWxSZXZlbnVlLl9zdW0udG90YWxQcmljZSksXG4gICAgdXNlcnNCeVJvbGU6IHVzZXJzQnlSb2xlXG4gICAgICAubWFwKChnKSA9PiAoeyByb2xlOiBnLnJvbGUsIGNvdW50OiBnLl9jb3VudC5fYWxsIH0pKVxuICAgICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KSxcbiAgICBib29raW5nc0J5U3RhdHVzLFxuICAgIHBhY2thZ2VzQnlDYXRlZ29yeSxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIH07XG59O1xuXG4vLyAyLiBBZ2VudCBkYXNoYm9hcmQgXHUyMDE0IHNjb3BlZCB0byB0aGUgYWdlbnQncyBvd24gcGFja2FnZXMuIEZldGNoZXMgb3duZWRcbi8vICAgIHBhY2thZ2UgaWRzIG9uY2UsIHRoZW4gZXZlcnkgYWdncmVnYXRlIHJldXNlcyB0aGF0IHNjb3BlIHNvIHRoZSB3aG9sZVxuLy8gICAgYnVuZGxlIGlzIG9uZSBQcm9taXNlLmFsbCAobm8gcGVyLWl0ZW0gcXVlcmllcykuXG5jb25zdCBnZXRBZ2VudERhc2hib2FyZCA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIGRheXM6IG51bWJlcixcbik6IFByb21pc2U8SUFnZW50RGFzaGJvYXJkPiA9PiB7XG4gIGNvbnN0IFtvd25lZFBhY2thZ2VzLCBib29raW5nc0J5U3RhdHVzLCBhdmVyYWdlUmF0aW5nXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHsgYWdlbnRJZDogdXNlcklkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KSxcbiAgICBnZXRCb29raW5nc0J5U3RhdHVzKHVzZXJJZCksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmFnZ3JlZ2F0ZSh7XG4gICAgICBfYXZnOiB7IHJhdGluZzogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHtcbiAgICAgICAgYWdlbnRJZDogdXNlcklkLFxuICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgIH0pLFxuICBdKTtcblxuICBjb25zdCBwYWNrYWdlSWRzID0gb3duZWRQYWNrYWdlcy5tYXAoKHApID0+IHAuaWQpO1xuXG4gIC8vIEFuIGFnZW50IHdpdGggbm8gcGFja2FnZXMgbXVzdCBzZWUgemVyb3MgXHUyMDE0IHNjb3BlIGlzIHVuZGVmaW5lZCBmb3IgYW4gZW1wdHlcbiAgLy8gbGlzdCwgYW5kIGEgYmFyZSBgd2hlcmU6IHVuZGVmaW5lZGAgLyBgQU5EOiBbe31dYCB3b3VsZCBvdGhlcndpc2UgbWF0Y2ggdGhlXG4gIC8vIHdob2xlIHBsYXRmb3JtIChjcm9zcy1hZ2VudCBkYXRhIGxlYWspLiBTaG9ydC1jaXJjdWl0IGhlcmUgaW5zdGVhZC5cbiAgaWYgKHBhY2thZ2VJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRvdGFsUGFja2FnZXM6IDAsXG4gICAgICB0b3RhbEJvb2tpbmdzOiAwLFxuICAgICAgdG90YWxSZXZlbnVlOiAwLFxuICAgICAgYXZlcmFnZVJhdGluZzogTWF0aC5yb3VuZCgoYXZlcmFnZVJhdGluZy5fYXZnLnJhdGluZyA/PyAwKSAqIDEwKSAvIDEwLFxuICAgICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICAgIHJldmVudWVPdmVyVGltZTogYXdhaXQgZ2V0UmV2ZW51ZU92ZXJUaW1lKGRheXMsIHVzZXJJZCksXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHNjb3BlID0gdG9QYWNrYWdlSWRTY29wZShwYWNrYWdlSWRzKTtcblxuICBjb25zdCBbdG90YWxQYWNrYWdlcywgdG90YWxCb29raW5ncywgdG90YWxSZXZlbnVlLCByZXZlbnVlT3ZlclRpbWVdID1cbiAgICBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBwYWNrYWdlSWRzLmxlbmd0aCxcbiAgICAgIHByaXNtYS5ib29raW5nLmNvdW50KHsgd2hlcmU6IHNjb3BlIH0pLFxuICAgICAgcHJpc21hLmJvb2tpbmcuYWdncmVnYXRlKHtcbiAgICAgICAgX3N1bTogeyB0b3RhbFByaWNlOiB0cnVlIH0sXG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgQU5EOiBbc2NvcGUsIHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLkNPTVBMRVRFRCB9XSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgZ2V0UmV2ZW51ZU92ZXJUaW1lKGRheXMsIHVzZXJJZCksXG4gICAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbFBhY2thZ2VzLFxuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxSZXZlbnVlOiB0b051bWJlcih0b3RhbFJldmVudWUuX3N1bS50b3RhbFByaWNlKSxcbiAgICBhdmVyYWdlUmF0aW5nOiBNYXRoLnJvdW5kKChhdmVyYWdlUmF0aW5nLl9hdmcucmF0aW5nID8/IDApICogMTApIC8gMTAsXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICByZXZlbnVlT3ZlclRpbWUsXG4gIH07XG59O1xuXG4vLyAzLiBVc2VyIGRhc2hib2FyZCBcdTIwMTQgdGhlIHVzZXIncyBib29raW5ncywgc3BlbmQsIGFuZCB1cGNvbWluZyB0cmlwcy5cbmNvbnN0IGdldFVzZXJEYXNoYm9hcmQgPSBhc3luYyAodXNlcklkOiBzdHJpbmcpOiBQcm9taXNlPElVc2VyRGFzaGJvYXJkPiA9PiB7XG4gIGNvbnN0IFt0b3RhbEJvb2tpbmdzLCB0b3RhbFNwZW5kLCB1cGNvbWluZ10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJvb2tpbmcuY291bnQoeyB3aGVyZTogeyB1c2VySWQgfSB9KSxcbiAgICBwcmlzbWEuYm9va2luZy5hZ2dyZWdhdGUoe1xuICAgICAgX3N1bTogeyB0b3RhbFByaWNlOiB0cnVlIH0sXG4gICAgICB3aGVyZTogeyB1c2VySWQsIHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEuYm9va2luZy5maW5kTWFueSh7XG4gICAgICB3aGVyZToge1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHN0YXR1czoge1xuICAgICAgICAgIGluOiBbQm9va2luZ1N0YXR1cy5QRU5ESU5HLCBCb29raW5nU3RhdHVzLlBBSUQsIEJvb2tpbmdTdGF0dXMuQ09ORklSTUVEXSxcbiAgICAgICAgfSxcbiAgICAgICAgdHJhdmVsRGF0ZTogeyBndDogbmV3IERhdGUoKSB9LFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDoge1xuICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgdHJhdmVsRGF0ZTogdHJ1ZSxcbiAgICAgICAgdHJhdmVsZXJzOiB0cnVlLFxuICAgICAgICB0b3RhbFByaWNlOiB0cnVlLFxuICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgIHBhY2thZ2U6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCB0aXRsZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgICAgb3JkZXJCeTogeyB0cmF2ZWxEYXRlOiBcImFzY1wiIH0sXG4gICAgICB0YWtlOiA1LFxuICAgIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsQm9va2luZ3MsXG4gICAgdG90YWxTcGVuZDogdG9OdW1iZXIodG90YWxTcGVuZC5fc3VtLnRvdGFsUHJpY2UpLFxuICAgIHVwY29taW5nQ291bnQ6IHVwY29taW5nLmxlbmd0aCxcbiAgICB1cGNvbWluZzogdXBjb21pbmcubWFwKChiKSA9PiAoe1xuICAgICAgLi4uYixcbiAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihiLnRvdGFsUHJpY2UpLFxuICAgIH0pKSxcbiAgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRTZXJ2aWNlID0ge1xuICBnZXRBZG1pbkRhc2hib2FyZCxcbiAgZ2V0QWdlbnREYXNoYm9hcmQsXG4gIGdldFVzZXJEYXNoYm9hcmQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBkYXNoYm9hcmRRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgZGF5czogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCgzNjUpLmRlZmF1bHQoMzApLFxufSk7XG5cbmV4cG9ydCBjb25zdCBkYXNoYm9hcmRWYWxpZGF0aW9ucyA9IHtcbiAgZGFzaGJvYXJkUXVlcnlTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgcGF5bWVudENvbnRyb2xsZXIgfSBmcm9tIFwiLi9wYXltZW50LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IHBheW1lbnRWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3BheW1lbnQudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gT3BlbiBhIGdhdGV3YXkgc2Vzc2lvbiBmb3IgdGhlIHVzZXIncyBwZW5kaW5nIGJvb2tpbmcgKFVTRVIgb25seSkuXG5yb3V0ZXIucG9zdChcbiAgXCIvY3JlYXRlXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcGF5bWVudFZhbGlkYXRpb25zLmNyZWF0ZVNjaGVtYSB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuY3JlYXRlUGF5bWVudCxcbik7XG5cbi8vIFB1YmxpYyBcdTIwMTQgU1NMQ29tbWVyeiBQT1NUcyB0aGUgb3V0Y29tZSBoZXJlIChzdWNjZXNzL2ZhaWwvY2FuY2VsKSBhbmQgd2Vcbi8vIHJlZGlyZWN0IHRoZSBicm93c2VyIHRvIHRoZSBmcm9udGVuZCByZXN1bHQgcGFnZS5cbnJvdXRlci5wb3N0KFxuICBcIi9jb25maXJtXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcXVlcnk6IHBheW1lbnRWYWxpZGF0aW9ucy5jYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICAgIGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5nYXRld2F5UmVzdWx0U2NoZW1hLFxuICB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuY29uZmlybVBheW1lbnQsXG4pO1xuXG4vLyBQdWJsaWMgXHUyMDE0IFNTTENvbW1lcnogaW5zdGFudCBwYXltZW50IG5vdGlmaWNhdGlvbjsgc2FtZSBpZGVtcG90ZW50IHNldHRsZS5cbnJvdXRlci5wb3N0KFxuICBcIi9pcG5cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBxdWVyeTogcGF5bWVudFZhbGlkYXRpb25zLmNhbGxiYWNrUXVlcnlTY2hlbWEsXG4gICAgYm9keTogcGF5bWVudFZhbGlkYXRpb25zLmdhdGV3YXlSZXN1bHRTY2hlbWEsXG4gIH0pLFxuICBwYXltZW50Q29udHJvbGxlci5pcG4sXG4pO1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5pbXBvcnQgeyBJR2F0ZXdheVJlc3VsdCB9IGZyb20gXCIuL3BheW1lbnQuaW50ZXJmYWNlXCI7XG5pbXBvcnQgeyBwYXltZW50U2VydmljZSB9IGZyb20gXCIuL3BheW1lbnQuc2VydmljZVwiO1xuXG5jb25zdCBjcmVhdGVQYXltZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBwYXltZW50U2VydmljZS5jcmVhdGVQYXltZW50U2Vzc2lvbih1c2VySWQsIHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlBheW1lbnQgc2Vzc2lvbiBjcmVhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHNlc3Npb24sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBQdWJsaWMgY2FsbGJhY2sgdGFyZ2V0IFx1MjAxNCBTU0xDb21tZXJ6IFBPU1RzIGhlcmUgKHNlcnZlci10by1zZXJ2ZXIpIGFmdGVyIHRoZVxuLy8gc2hvcHBlciBmaW5pc2hlcyBhdCB0aGUgZ2F0ZXdheS4gV2Ugc2V0dGxlIHRoZSBwYXltZW50LCB0aGVuIGJvdW5jZSB0aGVcbi8vIGJyb3dzZXIgdG8gdGhlIGZyb250ZW5kIHJlc3VsdCBwYWdlLlxuY29uc3QgY29uZmlybVBheW1lbnQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBib29raW5nSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LmJvb2tpbmdJZCk7XG4gICAgY29uc3QgdHJhbklkID0gU3RyaW5nKHJlcS5xdWVyeS50cmFuSWQpO1xuICAgIGNvbnN0IHN0YXR1cyA9IFN0cmluZyhyZXEucXVlcnkuc3RhdHVzID8/IFwiZmFpbFwiKTtcblxuICAgIGF3YWl0IHBheW1lbnRTZXJ2aWNlLnByb2Nlc3NHYXRld2F5UmVzdWx0KFxuICAgICAgYm9va2luZ0lkLFxuICAgICAgdHJhbklkLFxuICAgICAgcmVxLmJvZHkgYXMgSUdhdGV3YXlSZXN1bHQsXG4gICAgKTtcblxuICAgIGNvbnN0IHJlZGlyZWN0QmFzZSA9XG4gICAgICBjb25maWcubm9kZV9lbnYgPT09IFwicHJvZHVjdGlvblwiXG4gICAgICAgID8gY29uZmlnLmZyb250ZW5kX3VybF9wcm9kXG4gICAgICAgIDogY29uZmlnLmZyb250ZW5kX3VybF9kZXY7XG4gICAgY29uc3QgcGFnZSA9IFtcInN1Y2Nlc3NcIiwgXCJmYWlsXCIsIFwiY2FuY2VsXCJdLmluY2x1ZGVzKHN0YXR1cykgPyBzdGF0dXMgOiBcImZhaWxcIjtcblxuICAgIHJlcy5yZWRpcmVjdCgzMDIsIGAke3JlZGlyZWN0QmFzZX0vcGF5bWVudC8ke3BhZ2V9P2Jvb2tpbmdJZD0ke2Jvb2tpbmdJZH1gKTtcbiAgfSxcbik7XG5cbi8vIFB1YmxpYyBJUE4gdGFyZ2V0IFx1MjAxNCB0aGUgZ2F0ZXdheSBub3RpZmllcyB1cyBoZXJlIGluZGVwZW5kZW50bHkgb2YgdGhlXG4vLyByZWRpcmVjdC4gU2FtZSBpZGVtcG90ZW50IHNldHRsZTsgYWx3YXlzIGFuc3dlcnMgMjAwIHNvIHRoZSBnYXRld2F5IHN0b3BzIHJldHJ5aW5nLlxuY29uc3QgaXBuID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgYm9va2luZ0lkID0gU3RyaW5nKHJlcS5xdWVyeS5ib29raW5nSWQpO1xuICAgIGNvbnN0IHRyYW5JZCA9IFN0cmluZyhyZXEucXVlcnkudHJhbklkKTtcblxuICAgIGF3YWl0IHBheW1lbnRTZXJ2aWNlLnByb2Nlc3NHYXRld2F5UmVzdWx0KFxuICAgICAgYm9va2luZ0lkLFxuICAgICAgdHJhbklkLFxuICAgICAgcmVxLmJvZHkgYXMgSUdhdGV3YXlSZXN1bHQsXG4gICAgKTtcblxuICAgIHJlcy5zdGF0dXMoMjAwKS50eXBlKFwidGV4dC9wbGFpblwiKS5zZW5kKFwiT0tcIik7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcGF5bWVudENvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBheW1lbnQsXG4gIGNvbmZpcm1QYXltZW50LFxuICBpcG4sXG59OyIsICJpbXBvcnQgeyBCb29raW5nU3RhdHVzLCBQYXltZW50U3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IFNzbGNvbW1lcnpJbml0UmVzdWx0LCBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCwgZ2VuZXJhdGVUcmFuSWQsIHNzbGNvbW1lcnpJbml0LCBzc2xjb21tZXJ6VmFsaWRhdGUgfSBmcm9tIFwiLi4vLi4vbGliL3NzbGNvbW1lcnpcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzZW5kQm9va2luZ0VtYWlsIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQgeyBJR2F0ZXdheVJlc3VsdCwgSVBheW1lbnRDcmVhdGVSZXF1ZXN0LCBJUGF5bWVudEdhdGV3YXlPdXRjb21lIH0gZnJvbSBcIi4vcGF5bWVudC5pbnRlcmZhY2VcIjtcblxuLy8gVGhlIGdhdGV3YXkgUE9TVHMgdG8gdGhlc2UgVVJMcyBzZXJ2ZXItdG8tc2VydmVyLCBzbyB0aGUgaG9zdCBtdXN0IGJlXG4vLyBwdWJsaWNseSByZWFjaGFibGUgXHUyMDE0IGNvbmZpZy5iYWNrZW5kX3B1YmxpY191cmwsIG5ldmVyIGxvY2FsaG9zdCBpbiBzYW5kYm94LlxuY29uc3QgYnVpbGRDYWxsYmFja1VybCA9IChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIHRyYW5JZDogc3RyaW5nLFxuICBraW5kOiBcInN1Y2Nlc3NcIiB8IFwiZmFpbFwiIHwgXCJjYW5jZWxcIiB8IFwiaXBuXCIsXG4pID0+XG4gIGAke2NvbmZpZy5iYWNrZW5kX3B1YmxpY191cmx9L2FwaS9wYXltZW50cy8ke2tpbmQgPT09IFwiaXBuXCIgPyBcImlwblwiIDogXCJjb25maXJtXCJ9P2Jvb2tpbmdJZD0ke2Jvb2tpbmdJZH0mdHJhbklkPSR7dHJhbklkfSR7XG4gICAga2luZCA9PT0gXCJpcG5cIiA/IFwiXCIgOiBgJnN0YXR1cz0ke2tpbmR9YFxuICB9YDtcblxuLy8gT3BlbnMgYW4gU1NMQ29tbWVyeiBzZXNzaW9uIGZvciBhIHBlbmRpbmcgYm9va2luZyB0aGUgdXNlciBvd25zLiBUaGUgYm9va2luZ1xuLy8gYW1vdW50IGlzIGZyb3plbiBhdCBpbml0aWF0aW9uOyBpdCBuZXZlciByZS1yZWFkcyB0aGUgcGFja2FnZSBwcmljZS5cbmNvbnN0IGNyZWF0ZVBheW1lbnRTZXNzaW9uID0gYXN5bmMgKFxuICB1c2VySWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVBheW1lbnRDcmVhdGVSZXF1ZXN0LFxuKTogUHJvbWlzZTx7IHBheW1lbnRJZDogc3RyaW5nOyB0cmFuSWQ6IHN0cmluZzsgcGF5bWVudFVybDogc3RyaW5nIHwgbnVsbCB9PiA9PiB7XG4gIGNvbnN0IHsgYm9va2luZ0lkIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogYm9va2luZ0lkIH0sXG4gICAgaW5jbHVkZTogeyBwYWNrYWdlOiB7IHNlbGVjdDogeyB0aXRsZTogdHJ1ZSB9IH0gfSxcbiAgfSk7XG4gIGlmICghYm9va2luZykge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiQm9va2luZyBub3QgZm91bmQuXCIpO1xuICB9XG4gIGlmIChib29raW5nLnVzZXJJZCAhPT0gdXNlcklkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBheSBmb3IgdGhpcyBib29raW5nLlwiKTtcbiAgfVxuICBpZiAoYm9va2luZy5zdGF0dXMgPT09IEJvb2tpbmdTdGF0dXMuUEFJRCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiVGhpcyBib29raW5nIGlzIGFscmVhZHkgcGFpZC5cIik7XG4gIH1cbiAgaWYgKGJvb2tpbmcuc3RhdHVzICE9PSBCb29raW5nU3RhdHVzLlBFTkRJTkcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBgQ2Fubm90IHBheSBmb3IgYSBib29raW5nIGluICR7Ym9va2luZy5zdGF0dXMudG9Mb3dlckNhc2UoKX0gc3RhdHVzLmAsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgc2VsZWN0OiB7IG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlLCBwaG9uZTogdHJ1ZSB9LFxuICB9KTtcbiAgaWYgKCF1c2VyKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBjb25zdCBhbW91bnQgPSBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKTtcbiAgY29uc3QgdHJhbklkID0gZ2VuZXJhdGVUcmFuSWQoKTtcblxuICAvLyBPbmUgbGl2ZSBzZXNzaW9uIHBlciBib29raW5nOiB0aGUgbGVkZ2VyIHJvdyBpcyBjcmVhdGVkIGF0b21pY2FsbHkgd2hpbGVcbiAgLy8gc3VwZXJzZWRpbmcgYW55IGFiYW5kb25lZCBzZXNzaW9uLCB0aGVuIHRoZSBnYXRld2F5IGlzIGFza2VkLiBUaGUgcm93XG4gIC8vIHN1cnZpdmVzIHJlZ2FyZGxlc3Mgb2YgdGhlIGdhdGV3YXkgcmVzcG9uc2UgXHUyMDE0IGluaXQgZmFpbHVyZSBmbGlwcyBpdCB0b1xuICAvLyBGQUlMRUQgYmVsb3cgc28gYSB0cnV0aGZ1bCBlbnRyeSBhbHdheXMgZXhpc3RzLlxuICBjb25zdCBwYXltZW50ID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBhd2FpdCB0eC5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgYm9va2luZ0lkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB0eC5wYXltZW50LmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIGJvb2tpbmdJZCxcbiAgICAgICAgdHJhbklkLFxuICAgICAgICBhbW91bnQsXG4gICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQsXG4gICAgICB9LFxuICAgIH0pO1xuICB9KTtcblxuICBsZXQgaW5pdDogU3NsY29tbWVyekluaXRSZXN1bHQ7XG4gIHRyeSB7XG4gICAgaW5pdCA9IGF3YWl0IHNzbGNvbW1lcnpJbml0KHtcbiAgICAgIHRvdGFsX2Ftb3VudDogYW1vdW50LFxuICAgICAgdHJhbl9pZDogdHJhbklkLFxuICAgICAgc3VjY2Vzc191cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwic3VjY2Vzc1wiKSxcbiAgICAgIGZhaWxfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImZhaWxcIiksXG4gICAgICBjYW5jZWxfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImNhbmNlbFwiKSxcbiAgICAgIGlwbl91cmw6IGJ1aWxkQ2FsbGJhY2tVcmwoYm9va2luZ0lkLCB0cmFuSWQsIFwiaXBuXCIpLFxuICAgICAgY3VzX25hbWU6IHVzZXIubmFtZSxcbiAgICAgIGN1c19lbWFpbDogdXNlci5lbWFpbCxcbiAgICAgIGN1c19waG9uZTogdXNlci5waG9uZSA/PyBcIjAxNzExMTExMTExXCIsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgLy8ga2VlcCB0aGUgbGVkZ2VyIHRydXRoZnVsIFx1MjAxNCB0aGUgc2Vzc2lvbiBuZXZlciByZWFjaGVkIHRoZSBnYXRld2F5LiBUaGVcbiAgICAvLyBzdGF0dXMgZ3VhcmQgbWFrZXMgYSBjb25jdXJyZW50IC9jcmVhdGUgdGhhdCBhbHJlYWR5IGNhbmNlbGxlZCB0aGlzIHJvd1xuICAgIC8vIHdpbiB0aGUgcmFjZSAodGhhdCByb3cgc3RheXMgY2FuY2VsbGVkLCB0aGlzIG9uZSBmYWlscyBvbmx5IGlmIGxpdmUpLlxuICAgIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgLy8gc3RvcmUgdGhlIGdhdGV3YXkgVVJMcyBvbmx5IGlmIHRoZSByb3cgaXMgc3RpbGwgdGhlIGxpdmUgc2Vzc2lvbi5cbiAgYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlTWFueSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQsIHN0YXR1czogUGF5bWVudFN0YXR1cy5JTklUSUFURUQgfSxcbiAgICBkYXRhOiB7IGdhdGV3YXlQYWdlVXJsOiBpbml0LkdhdGV3YXlQYWdlVVJMLCBzc2xTZXNzaW9uS2V5OiBpbml0LnNlc3Npb25rZXkgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXltZW50SWQ6IHBheW1lbnQuaWQsXG4gICAgdHJhbklkOiBwYXltZW50LnRyYW5JZCxcbiAgICBwYXltZW50VXJsOiBpbml0LkdhdGV3YXlQYWdlVVJMID8/IG51bGwsXG4gIH07XG59O1xuXG4vLyBTZXJ2ZXItc2lkZSB2ZXJpZmljYXRpb24gb2YgYSBjb21wbGV0ZWQgdHJhbnNhY3Rpb246IHRoZSB2YWxpZGF0b3IgcmV0dXJuc1xuLy8gVkFMSUQgKGZpcnN0IGNoZWNrKSBvciBWQUxJREFURUQgKGFscmVhZHkgdmVyaWZpZWQgYmVmb3JlKSB3aXRoIHRoZSBhbW91bnQuXG4vLyBBbnl0aGluZyBlbHNlIFx1MjAxNCBvciBhIG1pc21hdGNoZWQgYW1vdW50IFx1MjAxNCBmYWlscyB0aGUgcGF5bWVudC5cbmNvbnN0IHZlcmlmeVN1Y2Nlc3MgPSBhc3luYyAoXG4gIHZhbElkOiBzdHJpbmcsXG4gIGV4cGVjdGVkQW1vdW50OiBudW1iZXIsXG4pOiBQcm9taXNlPHsgdmVyaWZpZWQ6IFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHwgbnVsbDsgbWF0Y2hlc0Ftb3VudDogYm9vbGVhbiB9PiA9PiB7XG4gIGxldCB2ZXJpZmllZDogU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQgfCBudWxsID0gbnVsbDtcbiAgdHJ5IHtcbiAgICB2ZXJpZmllZCA9IGF3YWl0IHNzbGNvbW1lcnpWYWxpZGF0ZSh7IHZhbF9pZDogdmFsSWQgfSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIHZhbGlkYXRvciB1bnJlYWNoYWJsZSBcdTIwMTQgZmFpbCB0aGUgcGF5bWVudCByYXRoZXIgdGhhbiBjcmFzaCB0aGUgY2FsbGJhY2tcbiAgICByZXR1cm4geyB2ZXJpZmllZDogbnVsbCwgbWF0Y2hlc0Ftb3VudDogZmFsc2UgfTtcbiAgfVxuXG4gIGNvbnN0IHZhbGlkU3RhdHVzID1cbiAgICB2ZXJpZmllZC5zdGF0dXMgPT09IFwiVkFMSURcIiB8fCB2ZXJpZmllZC5zdGF0dXMgPT09IFwiVkFMSURBVEVEXCI7XG4gIGNvbnN0IG1hdGNoZXNBbW91bnQgPVxuICAgIHZlcmlmaWVkLmFtb3VudCAhPT0gdW5kZWZpbmVkICYmIE51bWJlcih2ZXJpZmllZC5hbW91bnQpID09PSBleHBlY3RlZEFtb3VudDtcblxuICByZXR1cm4geyB2ZXJpZmllZCwgbWF0Y2hlc0Ftb3VudDogdmFsaWRTdGF0dXMgJiYgbWF0Y2hlc0Ftb3VudCB9O1xufTtcblxuLy8gU2hhcmVkIGJ5IHRoZSBjb25maXJtIChzdWNjZXNzL2ZhaWwvY2FuY2VsKSBhbmQgSVBOIGVuZHBvaW50cy4gSWRlbXBvdGVudDogYVxuLy8gc2V0dGxlZCBwYXltZW50IHNob3J0LWNpcmN1aXRzLCBzbyB0aGUgZG91YmxlLWZpcmluZyBJUE4gbmV2ZXIgZG91YmxlLWNoYXJnZXMuXG5jb25zdCBwcm9jZXNzR2F0ZXdheVJlc3VsdCA9IGFzeW5jIChcbiAgYm9va2luZ0lkOiBzdHJpbmcsXG4gIHRyYW5JZDogc3RyaW5nLFxuICByZXN1bHQ6IElHYXRld2F5UmVzdWx0LFxuKTogUHJvbWlzZTxJUGF5bWVudEdhdGV3YXlPdXRjb21lPiA9PiB7XG4gIGNvbnN0IHBheW1lbnQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyB0cmFuSWQgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBib29raW5nOiB7XG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICB1c2VyOiB7IHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0sXG4gICAgICAgICAgcGFja2FnZTogeyBzZWxlY3Q6IHsgdGl0bGU6IHRydWUgfSB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIXBheW1lbnQgfHwgcGF5bWVudC5ib29raW5nSWQgIT09IGJvb2tpbmdJZCkge1xuICAgIC8vIEEgY2FsbGJhY2sgZm9yIGEgc2Vzc2lvbiB3ZSBuZXZlciBjcmVhdGVkIFx1MjAxNCBub3RoaW5nIHRvIHNldHRsZS5cbiAgICByZXR1cm4geyBwYXltZW50U3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCwgYm9va2luZ1N0YXR1czogbnVsbCwgY2hhbmdlZDogZmFsc2UgfTtcbiAgfVxuXG4gIGlmIChwYXltZW50LnN0YXR1cyA9PT0gUGF5bWVudFN0YXR1cy5TVUNDRVNTKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IFBheW1lbnRTdGF0dXMuU1VDQ0VTUyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiBmYWxzZSxcbiAgICB9O1xuICB9XG5cbiAgLy8gQ2FuY2VsIGNhbGxiYWNrIFx1MjAxNCB0aGUgc2hvcHBlciBhYmFuZG9uZWQgY2hlY2tvdXQsIG5vIGNoYXJnZSB3YXMgbWFkZS5cbiAgaWYgKHJlc3VsdC5mYWlsX3N0YXR1cyA9PT0gXCJDQU5DRUxMRURcIiB8fCByZXN1bHQuc3RhdHVzID09PSBcIkNBTkNFTExFRFwiKSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IHVwZGF0ZWQuc3RhdHVzLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IHVwZGF0ZWQuc3RhdHVzICE9PSBwYXltZW50LnN0YXR1cyxcbiAgICB9O1xuICB9XG5cbiAgLy8gTm8gdmFsX2lkIG1lYW5zIHRoZSBnYXRld2F5IHJlcG9ydGVkIGEgZmFpbHVyZSAoZmFpbF91cmwpIFx1MjAxNCBub3RoaW5nIHRvIHZlcmlmeS5cbiAgaWYgKCFyZXN1bHQudmFsX2lkKSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcGF5bWVudC5pZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuRkFJTEVEIH0sXG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBheW1lbnRTdGF0dXM6IHVwZGF0ZWQuc3RhdHVzLFxuICAgICAgYm9va2luZ1N0YXR1czogcGF5bWVudC5ib29raW5nLnN0YXR1cyxcbiAgICAgIGNoYW5nZWQ6IHVwZGF0ZWQuc3RhdHVzICE9PSBwYXltZW50LnN0YXR1cyxcbiAgICB9O1xuICB9XG5cbiAgLy8gU3VjY2VzcyBwYXRoOiB2ZXJpZnkgc2VydmVyLXNpZGUgYW5kIG9ubHkgdGhlbiBtYXJrIHRoZSBib29raW5nIGFzIHBhaWQuXG4gIGNvbnN0IHsgdmVyaWZpZWQsIG1hdGNoZXNBbW91bnQgfSA9IGF3YWl0IHZlcmlmeVN1Y2Nlc3MoXG4gICAgcmVzdWx0LnZhbF9pZCxcbiAgICBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICApO1xuXG4gIGlmICghbWF0Y2hlc0Ftb3VudCkge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB0cnVlLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBzZXR0bGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgdHgucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsXG4gICAgICAgIHZhbElkOiByZXN1bHQudmFsX2lkLFxuICAgICAgICBjYXJkVHlwZTogcmVzdWx0LmNhcmRfdHlwZSA/PyB2ZXJpZmllZD8uY2FyZF90eXBlLFxuICAgICAgICBiYW5rVHJhbklkOiByZXN1bHQuYmFua190cmFuX2lkID8/IHZlcmlmaWVkPy5iYW5rX3RyYW5faWQsXG4gICAgICAgIHBhaWRBdDogbmV3IERhdGUoKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBjb21wYXJlLWFuZC1zZXQ6IG9ubHkgYSBzdGlsbC1QRU5ESU5HIGJvb2tpbmcgYmVjb21lcyBQQUlEOyBhIGJvb2tpbmcgdGhhdFxuICAgIC8vIHdhcyBjb25jdXJyZW50bHkgY29uZmlybWVkIG9yIGNhbmNlbGxlZCBrZWVwcyBpdHMgc3RhdGUsIHRoZSBtb25leSBzdGF5cyBvbi5cbiAgICBhd2FpdCB0eC5ib29raW5nLnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCwgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBFTkRJTkcgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBBSUQgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB1cGRhdGVkO1xuICB9KTtcblxuICBjb25zdCBib29raW5nQWZ0ZXIgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCB9IH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IFwicGF5bWVudCByZWNlaXZlZFwiIGVtYWlsIFx1MjAxNCBuZXZlciBmYWlscyB0aGUgY2FsbGJhY2tcbiAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgIHNlbmRCb29raW5nRW1haWwoe1xuICAgICAgZW1haWw6IHBheW1lbnQuYm9va2luZy51c2VyLmVtYWlsLFxuICAgICAgbmFtZTogcGF5bWVudC5ib29raW5nLnVzZXIubmFtZSxcbiAgICAgIHBhY2thZ2VUaXRsZTogcGF5bWVudC5ib29raW5nLnBhY2thZ2UudGl0bGUsXG4gICAgICB0cmF2ZWxEYXRlOiBwYXltZW50LmJvb2tpbmcudHJhdmVsRGF0ZSxcbiAgICAgIHRyYXZlbGVyczogcGF5bWVudC5ib29raW5nLnRyYXZlbGVycyxcbiAgICAgIHRvdGFsUHJpY2U6IE51bWJlcihwYXltZW50LmFtb3VudCksXG4gICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEFJRCxcbiAgICB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXltZW50U3RhdHVzOiBzZXR0bGVkLnN0YXR1cyxcbiAgICBib29raW5nU3RhdHVzOiBib29raW5nQWZ0ZXI/LnN0YXR1cyA/PyBudWxsLFxuICAgIGNoYW5nZWQ6IHRydWUsXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFNlcnZpY2UgPSB7XG4gIGNyZWF0ZVBheW1lbnRTZXNzaW9uLFxuICBwcm9jZXNzR2F0ZXdheVJlc3VsdCxcbn07IiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgYm9va2luZ0lkOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkJvb2tpbmcgaWQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC51dWlkKFwiQm9va2luZyBpZCBtdXN0IGJlIGEgdmFsaWQgdXVpZFwiKSxcbn0pO1xuXG5jb25zdCBjYWxsYmFja1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBib29raW5nSWQ6IHouc3RyaW5nKCkudXVpZChcIkJvb2tpbmcgaWQgbXVzdCBiZSBhIHZhbGlkIHV1aWRcIiksXG4gIHRyYW5JZDogei5zdHJpbmcoKS5taW4oMSksXG4gIHN0YXR1czogei5lbnVtKFtcInN1Y2Nlc3NcIiwgXCJmYWlsXCIsIFwiY2FuY2VsXCJdKS5vcHRpb25hbCgpLFxufSk7XG5cbi8vIEJvZHkgb2YgdGhlIGdhdGV3YXkgUE9TVCBcdTIwMTQgb25seSBmaWVsZHMgd2UgY29uc3VtZSwgYWxsIG9wdGlvbmFsIGJlY2F1c2UgdGhlXG4vLyBzaGFwZSBkaWZmZXJzIGJldHdlZW4gc3VjY2VzcyAvIGZhaWwgLyBjYW5jZWwgLyBJUE4gY2FsbGJhY2tzLlxuY29uc3QgZ2F0ZXdheVJlc3VsdFNjaGVtYSA9IHoub2JqZWN0KHtcbiAgdmFsX2lkOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIHN0YXR1czogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBmYWlsX3N0YXR1czogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBjYXJkX3R5cGU6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgYmFua190cmFuX2lkOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGN1cnJlbmN5OiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGFtb3VudDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxufSk7XG5cbmV4cG9ydCB0eXBlIFRDcmVhdGVQYXltZW50U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY3JlYXRlU2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRDYWxsYmFja1F1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgY2FsbGJhY2tRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUR2F0ZXdheVJlc3VsdFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGdhdGV3YXlSZXN1bHRTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgcGF5bWVudFZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVTY2hlbWEsXG4gIGNhbGxiYWNrUXVlcnlTY2hlbWEsXG4gIGdhdGV3YXlSZXN1bHRTY2hlbWEsXG59OyIsICIvLyBWZXJjZWwgc2VydmVybGVzcyBlbnRyeXBvaW50IFx1MjAxNCByZS1leHBvcnRzIHRoZSBzYW1lIEV4cHJlc3MgYXBwIHRoZSBsb2NhbFxuLy8gYnVpbGQgdXNlcy4gVmVyY2VsJ3MgQHZlcmNlbC9ub2RlIHJ1bnRpbWUgY29tcGlsZXMgYW5kIHdyYXBzIGl0OyB0aGUgYXBwIGlzXG4vLyBzcGxpdCBmcm9tIHNlcnZlci50cyAod2hpY2ggb25seSBzdGFydHMgdGhlIGxpc3RlbmVyKSBzbyB0aGUgdHdvIGhvc3RzIHNoYXJlXG4vLyBvbmUgcm91dGUgcmVnaXN0cnkuXG5pbXBvcnQgYXBwIGZyb20gXCIuLi9zcmMvYXBwXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGFwcDsiXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7O0FBQUEsT0FBTyxhQUErRDtBQUN0RSxPQUFPLFVBQVU7QUFDakIsT0FBTyxrQkFBa0I7QUFDekIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sWUFBWTtBQUNuQixPQUFPLGVBQWU7OztBQ0x0QixPQUFPLFlBQVk7QUFDbkIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsU0FBUztBQUVsQixPQUFPLE9BQU87QUFBQSxFQUNaLE9BQU87QUFBQSxFQUNQLE1BQU0sS0FBSyxLQUFLLFFBQVEsSUFBSSxHQUFHLE1BQU07QUFDdkMsQ0FBQztBQUtELElBQU0sWUFBWSxFQUFFLE9BQU87QUFBQSxFQUN6QixNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsTUFBTTtBQUFBLEVBQy9CLFVBQVUsRUFBRSxLQUFLLENBQUMsZUFBZSxZQUFZLENBQUMsRUFBRSxRQUFRLGFBQWE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTXJFLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUztBQUFBLEVBQzVDLG1CQUFtQixFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUztBQUFBLEVBRTdDLGNBQWMsRUFBRSxPQUFPLEVBQUUsSUFBSSxHQUFHLDBCQUEwQjtBQUFBLEVBRTFELG9CQUFvQixFQUFFLE9BQU8sRUFBRSxRQUFRLElBQUk7QUFBQTtBQUFBO0FBQUEsRUFJM0MsYUFBYSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUztBQUFBLEVBQ3pDLGdCQUFnQixFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsRUFBRSxTQUFTO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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QyxJQUFJLElBQUksZ0JBQWdCLFlBQVk7QUFDcEMsSUFBSSxJQUFJLGlCQUFpQixhQUFhO0FBQ3RDLElBQUksSUFBSSxhQUFhLFVBQVU7QUFDL0IsSUFBSSxJQUFJLGtCQUFrQixlQUFlO0FBQ3pDLElBQUksSUFBSSxpQkFBaUIsYUFBYTtBQUV0QyxJQUFJLElBQUksZ0JBQWU7QUFDdkIsSUFBSSxJQUFJLDBCQUFrQjtBQUUxQixJQUFPLGNBQVE7OztBK0RuSGYsSUFBTyxnQkFBUTsiLAogICJuYW1lcyI6IFsicGF0aCIsICJjb25maWciLCAiQnVmZmVyIiwgIkFueU51bGwiLCAiRGJOdWxsIiwgIkRlY2ltYWwiLCAiSnNvbk51bGwiLCAiTnVsbFR5cGVzIiwgIlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IiLCAiUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IiLCAiUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3IiLCAiUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciIsICJQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IiLCAiU3FsIiwgImVtcHR5IiwgImpvaW4iLCAicmF3IiwgInJ1bnRpbWUiLCAiaHR0cFN0YXR1cyIsICJyZWZyZXNoVG9rZW4iLCAicmVmcmVzaFRva2VuIiwgInJlZ2lzdGVyVXNlciIsICJodHRwU3RhdHVzIiwgImxvZ2luVXNlciIsICJnb29nbGVMb2dpbiIsICJkZW1vTG9naW4iLCAieiIsICJ6IiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImJjcnlwdCIsICJiY3J5cHQiLCAidXBkYXRlUHJvZmlsZSIsICJodHRwU3RhdHVzIiwgImdldFVzZXJzIiwgImNoYW5nZVJvbGUiLCAiY2hhbmdlU3RhdHVzIiwgImRlbGV0ZVVzZXIiLCAieiIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgIm11bHRlciIsICJodHRwU3RhdHVzIiwgImh0dHBTdGF0dXMiLCAibXVsdGVyIiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlTWVzc2FnZSIsICJodHRwU3RhdHVzIiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVCb29raW5nIiwgImh0dHBTdGF0dXMiLCAiZ2V0TXlCb29raW5ncyIsICJnZXRBZ2VudEJvb2tpbmdzIiwgImdldEJvb2tpbmdEZXRhaWwiLCAiZ2V0QWxsQm9va2luZ3MiLCAidXBkYXRlQm9va2luZ1N0YXR1cyIsICJ6IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJjcmVhdGVSZXZpZXciLCAiaHR0cFN0YXR1cyIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlQ2F0ZWdvcnkiLCAiaHR0cFN0YXR1cyIsICJnZXRBbGxDYXRlZ29yaWVzIiwgInVwZGF0ZUNhdGVnb3J5IiwgImRlbGV0ZUNhdGVnb3J5IiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJyYW5kb21VVUlEIiwgInJhbmRvbVVVSUQiLCAiY3JlYXRlUGFja2FnZSIsICJodHRwU3RhdHVzIiwgImdldFB1YmxpY1BhY2thZ2VzIiwgImdldFBhY2thZ2VCeVNsdWciLCAiZ2V0QWxsUGFja2FnZXMiLCAiZ2V0TXlQYWNrYWdlcyIsICJ1cGRhdGVQYWNrYWdlIiwgImNoYW5nZVBhY2thZ2VTdGF0dXMiLCAic29mdERlbGV0ZVBhY2thZ2UiLCAieiIsICJ1cGRhdGVTdGF0dXNTY2hlbWEiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJyYW5kb21VVUlEIiwgImdlbmVyYXRlVW5pcXVlU2x1ZyIsICJyYW5kb21VVUlEIiwgImNyZWF0ZVBvc3QiLCAiaHR0cFN0YXR1cyIsICJnZXRQdWJsaWNQb3N0cyIsICJnZXRQb3N0QnlTbHVnIiwgImdldEFsbFBvc3RzIiwgImdldE15UG9zdHMiLCAidXBkYXRlUG9zdCIsICJjaGFuZ2VQb3N0U3RhdHVzIiwgInNvZnREZWxldGVQb3N0IiwgInoiLCAidGl0bGVTY2hlbWEiLCAidXBkYXRlU3RhdHVzU2NoZW1hIiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiZ2V0QWRtaW5EYXNoYm9hcmQiLCAiaHR0cFN0YXR1cyIsICJnZXRBZ2VudERhc2hib2FyZCIsICJnZXRVc2VyRGFzaGJvYXJkIiwgInoiLCAicm91dGVyIiwgIlJvdXRlciIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJodHRwU3RhdHVzIiwgInoiLCAiY3JlYXRlU2NoZW1hIiwgInJvdXRlciIsICJSb3V0ZXIiXQp9Cg==
