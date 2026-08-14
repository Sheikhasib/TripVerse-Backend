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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FwcC50cyIsICIuLi9zcmMvY29uZmlnL2luZGV4LnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL25vdEZvdW5kLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlci50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudC50cyIsICIuLi9nZW5lcmF0ZWQvcHJpc21hL2ludGVybmFsL2NsYXNzLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvaW50ZXJuYWwvcHJpc21hTmFtZXNwYWNlLnRzIiwgIi4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXMudHMiLCAiLi4vc3JjL3V0aWxzL2FwcEVycm9yLnRzIiwgIi4uL3NyYy9saWIvcHJpc21hLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9hdXRoL2F1dGguc2VydmljZS50cyIsICIuLi9zcmMvbGliL2dvb2dsZUF1dGgudHMiLCAiLi4vc3JjL3V0aWxzL2p3dC50cyIsICIuLi9zcmMvdXRpbHMvY2F0Y2hBc3luYy50cyIsICIuLi9zcmMvdXRpbHMvc2VuZFJlc3BvbnNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2F1dGgvYXV0aC52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdC50cyIsICIuLi9zcmMvbWlkZGxld2FyZS9hdXRoLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VzZXIvdXNlci5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy91c2VyL3VzZXIudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvdXBsb2Fkcy91cGxvYWRzLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL2xpYi9jbG91ZGluYXJ5LnRzIiwgIi4uL3NyYy9tb2R1bGVzL3VwbG9hZHMvdXBsb2Fkcy5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NvbnRhY3QvY29udGFjdC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jb250YWN0L2NvbnRhY3QuY29udHJvbGxlci50cyIsICIuLi9zcmMvdXRpbHMvZW1haWwudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvY29udGFjdC9jb250YWN0LnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvYm9va2luZy9ib29raW5nLnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5jb250cm9sbGVyLnRzIiwgIi4uL3NyYy9saWIvc3NsY29tbWVyei50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9ib29raW5nL2Jvb2tpbmcudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3Jldmlldy9yZXZpZXcuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9yZXZpZXcvcmV2aWV3LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcmV2aWV3L3Jldmlldy52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL3V0aWxzL3NsdWdpZnkudHMiLCAiLi4vc3JjL21vZHVsZXMvY2F0ZWdvcnkvY2F0ZWdvcnkuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9jYXRlZ29yeS9jYXRlZ29yeS52YWxpZGF0aW9uLnRzIiwgIi4uL3NyYy9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UuY29udHJvbGxlci50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2Uuc2VydmljZS50cyIsICIuLi9zcmMvbW9kdWxlcy9wYWNrYWdlL3BhY2thZ2UudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9ibG9nL2Jsb2cucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvYmxvZy9ibG9nLnZhbGlkYXRpb24udHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZS50cyIsICIuLi9zcmMvbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvZGFzaGJvYXJkL2Rhc2hib2FyZC5zZXJ2aWNlLnRzIiwgIi4uL3NyYy9tb2R1bGVzL2Rhc2hib2FyZC9kYXNoYm9hcmQudmFsaWRhdGlvbi50cyIsICIuLi9zcmMvbW9kdWxlcy9wYXltZW50L3BheW1lbnQucm91dGUudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LmNvbnRyb2xsZXIudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnNlcnZpY2UudHMiLCAiLi4vc3JjL21vZHVsZXMvcGF5bWVudC9wYXltZW50LnZhbGlkYXRpb24udHMiLCAiaW5kZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCBleHByZXNzLCB7IEFwcGxpY2F0aW9uLCBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcclxuaW1wb3J0IGNvcnMgZnJvbSBcImNvcnNcIjtcclxuaW1wb3J0IGNvb2tpZVBhcnNlciBmcm9tIFwiY29va2llLXBhcnNlclwiO1xyXG5pbXBvcnQgaGVsbWV0IGZyb20gXCJoZWxtZXRcIjtcclxuaW1wb3J0IG1vcmdhbiBmcm9tIFwibW9yZ2FuXCI7XHJcbmltcG9ydCByYXRlTGltaXQgZnJvbSBcImV4cHJlc3MtcmF0ZS1saW1pdFwiO1xyXG5pbXBvcnQgY29uZmlnIGZyb20gXCIuL2NvbmZpZ1wiO1xyXG5pbXBvcnQgbm90Rm91bmRIYW5kbGVyIGZyb20gXCIuL21pZGRsZXdhcmUvbm90Rm91bmRcIjtcclxuaW1wb3J0IGdsb2JhbEVycm9ySGFuZGxlciBmcm9tIFwiLi9taWRkbGV3YXJlL2dsb2JhbEVycm9ySGFuZGxlclwiO1xyXG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi9saWIvcHJpc21hXCI7XHJcbmltcG9ydCB7IGF1dGhSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2F1dGgvYXV0aC5yb3V0ZVwiO1xyXG5pbXBvcnQgeyB1c2VyUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy91c2VyL3VzZXIucm91dGVcIjtcclxuaW1wb3J0IHsgdXBsb2FkUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy91cGxvYWRzL3VwbG9hZHMucm91dGVcIjtcclxuaW1wb3J0IHsgY29udGFjdFJvdXRlcyB9IGZyb20gXCIuL21vZHVsZXMvY29udGFjdC9jb250YWN0LnJvdXRlXCI7XHJcbmltcG9ydCB7IGJvb2tpbmdSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2Jvb2tpbmcvYm9va2luZy5yb3V0ZVwiO1xyXG5pbXBvcnQgeyByZXZpZXdSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3Jldmlldy9yZXZpZXcucm91dGVcIjtcclxuaW1wb3J0IHsgY2F0ZWdvcnlSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL2NhdGVnb3J5L2NhdGVnb3J5LnJvdXRlXCI7XHJcbmltcG9ydCB7IHBhY2thZ2VSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3BhY2thZ2UvcGFja2FnZS5yb3V0ZVwiO1xyXG5pbXBvcnQgeyBibG9nUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9ibG9nL2Jsb2cucm91dGVcIjtcclxuaW1wb3J0IHsgZGFzaGJvYXJkUm91dGVzIH0gZnJvbSBcIi4vbW9kdWxlcy9kYXNoYm9hcmQvZGFzaGJvYXJkLnJvdXRlXCI7XHJcbmltcG9ydCB7IHBheW1lbnRSb3V0ZXMgfSBmcm9tIFwiLi9tb2R1bGVzL3BheW1lbnQvcGF5bWVudC5yb3V0ZVwiO1xyXG5cclxuY29uc3QgYXBwOiBBcHBsaWNhdGlvbiA9IGV4cHJlc3MoKTtcclxuXHJcbi8vIFJlbmRlci9SYWlsd2F5IHNpdCBiZWhpbmQgYSByZXZlcnNlIHByb3h5IFx1MjAxNCBtdXN0IGJlIHNldCBiZWZvcmUgdGhlXHJcbi8vIHJhdGUgbGltaXRlciBvciBpdCB3aWxsIHNlZSB0aGUgcHJveHkncyBJUCBmb3IgZXZlcnkgcmVxdWVzdCBhbmRcclxuLy8gZWZmZWN0aXZlbHkgcmF0ZS1saW1pdCBhbGwgdXNlcnMgdG9nZXRoZXIuXHJcbmFwcC5zZXQoXCJ0cnVzdCBwcm94eVwiLCAxKTtcclxuXHJcbmFwcC51c2UoaGVsbWV0KCkpO1xyXG5cclxuYXBwLnVzZShcclxuICBjb3JzKHtcclxuICAgIC8vIERldiBob3N0IChsb2NhbGhvc3QpICsgcHJvZCBob3N0IChWZXJjZWwpIGJvdGggYWxsb3dlZCBzaWRlLWJ5LXNpZGUuXHJcbiAgICAvLyBDb25maWcgcmVzb2x2ZXMgc2Vuc2libGUgZGVmYXVsdHMgc28gbmVpdGhlciBjYW4gYmUgZmFsc3kuXHJcbiAgICBvcmlnaW46IFtjb25maWcuZnJvbnRlbmRfdXJsX2RldiwgY29uZmlnLmZyb250ZW5kX3VybF9wcm9kXS5maWx0ZXIoXHJcbiAgICAgIChvKTogbyBpcyBzdHJpbmcgPT4gQm9vbGVhbihvKSxcclxuICAgICksXHJcbiAgICBjcmVkZW50aWFsczogdHJ1ZSxcclxuICB9KSxcclxuKTtcclxuXHJcbmlmIChjb25maWcubm9kZV9lbnYgIT09IFwicHJvZHVjdGlvblwiKSB7XHJcbiAgYXBwLnVzZShtb3JnYW4oXCJkZXZcIikpO1xyXG59XHJcblxyXG5hcHAudXNlKGV4cHJlc3MuanNvbih7IGxpbWl0OiBcIjEwMGtiXCIgfSkpO1xyXG5hcHAudXNlKGV4cHJlc3MudXJsZW5jb2RlZCh7IGV4dGVuZGVkOiB0cnVlLCBsaW1pdDogXCIxMDBrYlwiIH0pKTtcclxuYXBwLnVzZShjb29raWVQYXJzZXIoKSk7XHJcblxyXG4vLyBTdHJpY3QgbGltaXRlciBcdTIwMTQgYXV0aCBlbmRwb2ludHMsIGJydXRlLWZvcmNlIHByb3RlY3Rpb25cclxuY29uc3QgYXV0aExpbWl0ZXIgPSByYXRlTGltaXQoe1xyXG4gIHdpbmRvd01zOiAxNSAqIDYwICogMTAwMCxcclxuICBsaW1pdDogNSxcclxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXHJcbiAgbGVnYWN5SGVhZGVyczogZmFsc2UsXHJcbiAgbWVzc2FnZToge1xyXG4gICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICBtZXNzYWdlOiBcIlRvbyBtYW55IGF0dGVtcHRzLiBQbGVhc2UgdHJ5IGFnYWluIGluIDE1IG1pbnV0ZXMuXCIsXHJcbiAgfSxcclxufSk7XHJcblxyXG4vLyBTdGFuZGFyZCBsaW1pdGVyIFx1MjAxNCBldmVyeXRoaW5nIGVsc2UgdW5kZXIgL2FwaVxyXG5jb25zdCBhcGlMaW1pdGVyID0gcmF0ZUxpbWl0KHtcclxuICB3aW5kb3dNczogMTUgKiA2MCAqIDEwMDAsXHJcbiAgbGltaXQ6IDEwMCxcclxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXHJcbiAgbGVnYWN5SGVhZGVyczogZmFsc2UsXHJcbiAgbWVzc2FnZToge1xyXG4gICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICBtZXNzYWdlOiBcIlRvbyBtYW55IHJlcXVlc3RzLiBQbGVhc2UgdHJ5IGFnYWluIGxhdGVyLlwiLFxyXG4gIH0sXHJcbn0pO1xyXG5cclxuYXBwLnVzZShcIi9hcGkvYXV0aC9sb2dpblwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpL2F1dGgvcmVnaXN0ZXJcIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL2RlbW8tbG9naW5cIiwgYXV0aExpbWl0ZXIpO1xyXG5hcHAudXNlKFwiL2FwaS9hdXRoL2dvb2dsZVwiLCBhdXRoTGltaXRlcik7XHJcbmFwcC51c2UoXCIvYXBpXCIsIGFwaUxpbWl0ZXIpO1xyXG5cclxuLy8gUm9vdCByb3V0ZVxyXG5hcHAuZ2V0KFwiL1wiLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgcmVzLnNlbmQoXCJXZWxjb21lIHRvIHRoZSBUcmlwVmVyc2UgQVBJIVwiKTtcclxufSk7XHJcblxyXG4vLyBIZWFsdGggY2hlY2sgXHUyMDE0IHJlYWwgREIgY29ubmVjdGl2aXR5IGNoZWNrLCBub3QgYSBzdGF0aWMgMjAwLlxyXG5hcHAuZ2V0KFwiL2hlYWx0aFwiLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUIDFgO1xyXG4gICAgcmVzLnN0YXR1cygyMDApLmpzb24oe1xyXG4gICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICBtZXNzYWdlOiBcIk9LXCIsXHJcbiAgICAgIGRiOiBcImNvbm5lY3RlZFwiLFxyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgIH0pO1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICByZXMuc3RhdHVzKDUwMykuanNvbih7XHJcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICBtZXNzYWdlOiBcIlNlcnZpY2UgdW5hdmFpbGFibGVcIixcclxuICAgICAgZGI6IFwiZGlzY29ubmVjdGVkXCIsXHJcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59KTtcclxuXHJcbi8vIFx1MjUwMFx1MjUwMCBGZWF0dXJlIHJvdXRlcyByZWdpc3RlciBoZXJlIGFzIGVhY2ggbW9kdWxlIGlzIGJ1aWx0IFx1MjUwMFx1MjUwMFxyXG5hcHAudXNlKFwiL2FwaS9hdXRoXCIsIGF1dGhSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS91c2Vyc1wiLCB1c2VyUm91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvdXBsb2Fkc1wiLCB1cGxvYWRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jb250YWN0XCIsIGNvbnRhY3RSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9jYXRlZ29yaWVzXCIsIGNhdGVnb3J5Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvcGFja2FnZXNcIiwgcGFja2FnZVJvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL3Jldmlld3NcIiwgcmV2aWV3Um91dGVzKTtcclxuYXBwLnVzZShcIi9hcGkvYm9va2luZ3NcIiwgYm9va2luZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Jsb2dcIiwgYmxvZ1JvdXRlcyk7XHJcbmFwcC51c2UoXCIvYXBpL2Rhc2hib2FyZFwiLCBkYXNoYm9hcmRSb3V0ZXMpO1xyXG5hcHAudXNlKFwiL2FwaS9wYXltZW50c1wiLCBwYXltZW50Um91dGVzKTtcclxuXHJcbmFwcC51c2Uobm90Rm91bmRIYW5kbGVyKTtcclxuYXBwLnVzZShnbG9iYWxFcnJvckhhbmRsZXIpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgYXBwO1xyXG4iLCAiaW1wb3J0IGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuZG90ZW52LmNvbmZpZyh7XG4gIHF1aWV0OiB0cnVlLFxuICBwYXRoOiBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgXCIuZW52XCIpLFxufSk7XG5cbi8vIEV2ZXJ5IG1vZHVsZSByZWFkcyBjb25maWcgdGhyb3VnaCB0aGlzIHZhbGlkYXRlZCBvYmplY3QsIG5ldmVyXG4vLyBwcm9jZXNzLmVudiBkaXJlY3RseSBcdTIwMTQgYSBtaXNzaW5nL21hbGZvcm1lZCB2YXIgZmFpbHMgbG91ZGx5IGF0IGJvb3Rcbi8vIGluc3RlYWQgb2Ygc3VyZmFjaW5nIGFzIGEgY29uZnVzaW5nIHJ1bnRpbWUgZXJyb3IgbWlkLXJlcXVlc3QuXG5jb25zdCBlbnZTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIFBPUlQ6IHouc3RyaW5nKCkuZGVmYXVsdChcIjQwMDBcIiksXG4gIE5PREVfRU5WOiB6LmVudW0oW1wiZGV2ZWxvcG1lbnRcIiwgXCJwcm9kdWN0aW9uXCJdKS5kZWZhdWx0KFwiZGV2ZWxvcG1lbnRcIiksXG5cbiAgLy8gRnJvbnRlbmQgb3JpZ2lucyBmb3IgQ09SUyArIHBheW1lbnQgcmVkaXJlY3RzLiBUaGUgZnJvbnRlbmQgbWF5IG5vdCBiZVxuICAvLyBkZXBsb3llZCB5ZXQgKG9yIG1heSBiZSByZWJ1aWx0KSwgc28gYm90aCBhcmUgb3B0aW9uYWw6IHRoZSBiYWNrZW5kIG11c3RcbiAgLy8gbmV2ZXIgcmVmdXNlIHRvIGJvb3QganVzdCBiZWNhdXNlIGEgVUkgaG9zdCBpc24ndCBsaXZlLiBSb3V0ZXMgdGhhdCBuZWVkIGFcbiAgLy8gcmVhbCBvcmlnaW4gKHBheW1lbnQgY2FsbGJhY2sgcmVkaXJlY3RzKSBmYWxsIGJhY2sgdG8gdGhlIGJhY2tlbmQgVVJMLlxuICBGUk9OVEVORF9VUkxfREVWOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG4gIEZST05URU5EX1VSTF9QUk9EOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG5cbiAgREFUQUJBU0VfVVJMOiB6LnN0cmluZygpLm1pbigxLCBcIkRBVEFCQVNFX1VSTCBpcyByZXF1aXJlZFwiKSxcblxuICBCQ1JZUFRfU0FMVF9ST1VORFM6IHouc3RyaW5nKCkuZGVmYXVsdChcIjEwXCIpLFxuXG4gIC8vIE9wdGlvbmFsIGFkbWluIGNyZWRlbnRpYWxzIHVzZWQgYnkgdGhlIHNlZWQgc2NyaXB0IChTdGVwIDEzKS4gRmFsbHMgYmFja1xuICAvLyB0byBkZW1vLWFkbWluQHRyaXB2ZXJzZS5jb20gLyBkZW1vMTIzIHdoZW4gdW5zZXQuXG4gIEFETUlOX0VNQUlMOiB6LnN0cmluZygpLmVtYWlsKCkub3B0aW9uYWwoKSxcbiAgQURNSU5fUEFTU1dPUkQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG5cbiAgLy8gU1NMQ29tbWVyeiAoU3RlcCAxNikgXHUyMDE0IHNhbmRib3ggc3RvcmUgY3JlZHMgdW50aWwgZ28tbGl2ZS4gU1NMX0NPTU1FUlpfU0FOREJPWFxuICAvLyBwaWNrcyB0aGUgc2FuZGJveCB2cyBsaXZlIEFQSSBiYXNlIFVSTC4gT3B0aW9uYWwgc28gdGhlIEFQSSBib290cyAoaGVhbHRoLFxuICAvLyBhdXRoLCBjYXRhbG9nLCBldGMuKSBldmVuIHdoZW4gdGhlIHBheW1lbnQgc3RvcmUgaXNuJ3QgY29uZmlndXJlZCB5ZXQgXHUyMDE0IHRoZVxuICAvLyBwYXltZW50IGVuZHBvaW50cyB0aGVuIGZhaWwgd2l0aCBhIGNsZWFuIFwibm90IGNvbmZpZ3VyZWRcIiBlcnJvciBpbnN0ZWFkIG9mXG4gIC8vIHRha2luZyB0aGUgd2hvbGUgZGVwbG95bWVudCBkb3duLlxuICBTU0xfQ09NTUVSWl9TVE9SRV9JRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTU0xfQ09NTUVSWl9TVE9SRV9QQVNTV09SRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBTU0xfQ09NTUVSWl9TQU5EQk9YOiB6LnN0cmluZygpLmRlZmF1bHQoXCJ0cnVlXCIpLFxuICAvLyBPcHRpb25hbCBleHBsaWNpdCBnYXRld2F5L3ZhbGlkYXRvciBiYXNlIFVSTHMgKEdlYXJVcCBwYXR0ZXJuKS4gRGVmYXVsdHMgYXJlXG4gIC8vIGRlcml2ZWQgZnJvbSBTU0xfQ09NTUVSWl9TQU5EQk9YIHdoZW4gYWJzZW50LlxuICBTU0xDT01NRVJaX0lOSVRfVVJMOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG4gIFNTTENPTU1FUlpfVkFMSURBVEVfVVJMOiB6LnN0cmluZygpLnVybCgpLm9wdGlvbmFsKCksXG4gIFNTTENPTU1FUlpfUkVGVU5EX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuXG4gIC8vIFB1YmxpY2x5IHJlYWNoYWJsZSBiYXNlIFVSTCB0aGUgcGF5bWVudCBtb2R1bGUgdXNlcyB0byBidWlsZCB0aGVcbiAgLy8gU1NMQ29tbWVyeiBzdWNjZXNzL2ZhaWwvY2FuY2VsL0lQTiBjYWxsYmFjayBVUkxzLiBNdXN0IE5PVCBiZSBsb2NhbGhvc3QgaW5cbiAgLy8gc2FuZGJveCBcdTIwMTQgdGhlIGdhdGV3YXkgUE9TVHMgdG8gdGhlc2Ugc2VydmVyLXRvLXNlcnZlci4gT3B0aW9uYWwgbGlrZSB0aGVcbiAgLy8gc3RvcmUgY3JlZHMgYWJvdmUgKHBheW1lbnQtb25seSkuXG4gIEJBQ0tFTkRfUFVCTElDX1VSTDogei5zdHJpbmcoKS51cmwoKS5vcHRpb25hbCgpLFxuXG4gIEpXVF9BQ0NFU1NfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkpXVF9BQ0NFU1NfU0VDUkVUIGlzIHJlcXVpcmVkXCIpLFxuICBKV1RfUkVGUkVTSF9TRUNSRVQ6IHouc3RyaW5nKCkubWluKDEsIFwiSldUX1JFRlJFU0hfU0VDUkVUIGlzIHJlcXVpcmVkXCIpLFxuICBKV1RfQUNDRVNTX0VYUElSRVNfSU46IHouc3RyaW5nKCkuZGVmYXVsdChcIjFkXCIpLFxuICBKV1RfUkVGUkVTSF9FWFBJUkVTX0lOOiB6LnN0cmluZygpLmRlZmF1bHQoXCIzMGRcIiksXG5cbiAgLy8gR29vZ2xlIE9BdXRoIGlzIG9wdGlvbmFsIFx1MjAxNCBzZXJ2ZXIgYm9vdHMgd2l0aG91dCBpdDsgL2FwaS9hdXRoL2dvb2dsZVxuICAvLyByZXR1cm5zIGEgY2xlYW4gNDAwIHVudGlsIEdPT0dMRV9DTElFTlRfSUQgaXMgY29uZmlndXJlZC5cbiAgR09PR0xFX0NMSUVOVF9JRDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuXG4gIC8vIEJlc3QtZWZmb3J0IGNvbnRhY3QgZW1haWxzIChSZXNlbmQpIFx1MjAxNCBhbHdheXMgb3B0aW9uYWw7IHN1Ym1pc3Npb25zXG4gIC8vIHN1Y2NlZWQgYW5kIGVtYWlscyBiZWNvbWUgbm8tb3BzIHdoZW4gdGhlc2UgYXJlIG1pc3NpbmcuXG4gIFJFU0VORF9BUElfS0VZOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIENPTlRBQ1RfUkVDRUlWRVJfRU1BSUw6IHouc3RyaW5nKCkuZW1haWwoKS5vcHRpb25hbCgpLFxuICBFTUFJTF9GUk9NOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG5cbiAgQ0xPVURJTkFSWV9DTE9VRF9OQU1FOiB6LnN0cmluZygpLm1pbigxLCBcIkNMT1VESU5BUllfQ0xPVURfTkFNRSBpcyByZXF1aXJlZFwiKSxcbiAgQ0xPVURJTkFSWV9BUElfS0VZOiB6LnN0cmluZygpLm1pbigxLCBcIkNMT1VESU5BUllfQVBJX0tFWSBpcyByZXF1aXJlZFwiKSxcbiAgQ0xPVURJTkFSWV9BUElfU0VDUkVUOiB6LnN0cmluZygpLm1pbigxLCBcIkNMT1VESU5BUllfQVBJX1NFQ1JFVCBpcyByZXF1aXJlZFwiKSxcbn0pO1xuXG5jb25zdCBwYXJzZWQgPSBlbnZTY2hlbWEuc2FmZVBhcnNlKHByb2Nlc3MuZW52KTtcblxuaWYgKCFwYXJzZWQuc3VjY2Vzcykge1xuICBjb25zb2xlLmVycm9yKFwiXHUyNzRDIEludmFsaWQgZW52aXJvbm1lbnQgdmFyaWFibGVzOlwiKTtcbiAgY29uc29sZS5lcnJvcihwYXJzZWQuZXJyb3IuZmxhdHRlbigpLmZpZWxkRXJyb3JzKTtcbiAgcHJvY2Vzcy5leGl0KDEpO1xufVxuXG5jb25zdCBlbnYgPSBwYXJzZWQuZGF0YTtcblxuY29uc3QgY29uZmlnID0ge1xuICBwb3J0OiBlbnYuUE9SVCxcbiAgbm9kZV9lbnY6IGVudi5OT0RFX0VOVixcblxuICAvLyBGcm9udGVuZCBvcmlnaW5zIGZvciBDT1JTICsgcGF5bWVudCByZWRpcmVjdHMuIExvY2FsaG9zdCBhbHdheXMgd2lucyBmb3JcbiAgLy8gbG9jYWwgdGVzdGluZzsgcHJvZHVjdGlvbiB1c2VzIHRoZSBWZXJjZWwgZnJvbnRlbmQgVVJMLCBmYWxsaW5nIGJhY2sgdG8gdGhlXG4gIC8vIGJhY2tlbmQgVVJMIHNvIHRoZSBBUEkgc3RheXMgcmVhY2hhYmxlIGV2ZW4gYmVmb3JlIHRoZSBVSSBpcyBkZXBsb3llZC5cbiAgZnJvbnRlbmRfdXJsX2RldjogZW52LkZST05URU5EX1VSTF9ERVYgfHwgXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgZnJvbnRlbmRfdXJsX3Byb2Q6XG4gICAgZW52LkZST05URU5EX1VSTF9QUk9EIHx8IGVudi5CQUNLRU5EX1BVQkxJQ19VUkwgfHwgXCJcIixcblxuICBkYXRhYmFzZV91cmw6IGVudi5EQVRBQkFTRV9VUkwsXG5cbiAgYmNyeXB0X3NhbHRfcm91bmRzOiBlbnYuQkNSWVBUX1NBTFRfUk9VTkRTLFxuXG4gIGFkbWluX2VtYWlsOiBlbnYuQURNSU5fRU1BSUwsXG4gIGFkbWluX3Bhc3N3b3JkOiBlbnYuQURNSU5fUEFTU1dPUkQsXG5cbiAgc3NsX2NvbW1lcnpfc3RvcmVfaWQ6IGVudi5TU0xfQ09NTUVSWl9TVE9SRV9JRCxcbiAgc3NsX2NvbW1lcnpfc3RvcmVfcGFzc3dvcmQ6IGVudi5TU0xfQ09NTUVSWl9TVE9SRV9QQVNTV09SRCxcbiAgc3NsX2NvbW1lcnpfc2FuZGJveDogZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiLFxuICAvLyBzYW5kYm94IGJhc2UgVVJMcyAoZmFsbGJhY2sgd2hlbiB0aGUgZXhwbGljaXQgb3ZlcnJpZGUgdmFycyBhcmUgYWJzZW50KVxuICBzc2xjb21tZXJ6X2luaXRfdXJsOlxuICAgIGVudi5TU0xDT01NRVJaX0lOSVRfVVJMID8/XG4gICAgKGVudi5TU0xfQ09NTUVSWl9TQU5EQk9YID09PSBcInRydWVcIlxuICAgICAgPyBcImh0dHBzOi8vc2FuZGJveC5zc2xjb21tZXJ6LmNvbS9nd3Byb2Nlc3MvdjQvYXBpLnBocFwiXG4gICAgICA6IFwiaHR0cHM6Ly9zZWN1cmVwYXkuc3NsY29tbWVyei5jb20vZ3dwcm9jZXNzL3Y0L2FwaS5waHBcIiksXG4gIHNzbGNvbW1lcnpfdmFsaWRhdGVfdXJsOlxuICAgIGVudi5TU0xDT01NRVJaX1ZBTElEQVRFX1VSTCA/P1xuICAgIChlbnYuU1NMX0NPTU1FUlpfU0FOREJPWCA9PT0gXCJ0cnVlXCJcbiAgICAgID8gXCJodHRwczovL3NhbmRib3guc3NsY29tbWVyei5jb20vdmFsaWRhdG9yL2FwaS92YWxpZGF0aW9uc2VydmVyQVBJLnBocFwiXG4gICAgICA6IFwiaHR0cHM6Ly9zZWN1cmVwYXkuc3NsY29tbWVyei5jb20vdmFsaWRhdG9yL2FwaS92YWxpZGF0aW9uc2VydmVyQVBJLnBocFwiKSxcbiAgc3NsY29tbWVyel9yZWZ1bmRfdXJsOlxuICAgIGVudi5TU0xDT01NRVJaX1JFRlVORF9VUkwgPz9cbiAgICAoZW52LlNTTF9DT01NRVJaX1NBTkRCT1ggPT09IFwidHJ1ZVwiXG4gICAgICA/IFwiaHR0cHM6Ly9zYW5kYm94LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvbWVyY2hhbnRUcmFuc0lEdmFsaWRhdGlvbkFQSS5waHBcIlxuICAgICAgOiBcImh0dHBzOi8vc2VjdXJlcGF5LnNzbGNvbW1lcnouY29tL3ZhbGlkYXRvci9hcGkvbWVyY2hhbnRUcmFuc0lEdmFsaWRhdGlvbkFQSS5waHBcIiksXG4gIGJhY2tlbmRfcHVibGljX3VybDogZW52LkJBQ0tFTkRfUFVCTElDX1VSTCxcblxuICBqd3RfYWNjZXNzX3NlY3JldDogZW52LkpXVF9BQ0NFU1NfU0VDUkVULFxuICBqd3RfcmVmcmVzaF9zZWNyZXQ6IGVudi5KV1RfUkVGUkVTSF9TRUNSRVQsXG4gIGp3dF9hY2Nlc3NfZXhwaXJlc19pbjogZW52LkpXVF9BQ0NFU1NfRVhQSVJFU19JTixcbiAgand0X3JlZnJlc2hfZXhwaXJlc19pbjogZW52LkpXVF9SRUZSRVNIX0VYUElSRVNfSU4sXG5cbiAgZ29vZ2xlX2NsaWVudF9pZDogZW52LkdPT0dMRV9DTElFTlRfSUQsXG5cbiAgcmVzZW5kX2FwaV9rZXk6IGVudi5SRVNFTkRfQVBJX0tFWSxcbiAgY29udGFjdF9yZWNlaXZlcl9lbWFpbDogZW52LkNPTlRBQ1RfUkVDRUlWRVJfRU1BSUwsXG4gIGVtYWlsX2Zyb206IGVudi5FTUFJTF9GUk9NLFxuXG4gIGNsb3VkaW5hcnlfY2xvdWRfbmFtZTogZW52LkNMT1VESU5BUllfQ0xPVURfTkFNRSxcbiAgY2xvdWRpbmFyeV9hcGlfa2V5OiBlbnYuQ0xPVURJTkFSWV9BUElfS0VZLFxuICBjbG91ZGluYXJ5X2FwaV9zZWNyZXQ6IGVudi5DTE9VRElOQVJZX0FQSV9TRUNSRVQsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjb25maWc7XG4iLCAiaW1wb3J0IHsgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5jb25zdCBub3RGb3VuZEhhbmRsZXIgPSAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHJlcy5zdGF0dXMoNDA0KS5qc29uKHtcbiAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICBzdGF0dXNDb2RlOiA0MDQsXG4gICAgbWVzc2FnZTogXCJSb3V0ZSBub3QgZm91bmRcIixcbiAgICBwYXRoOiByZXEub3JpZ2luYWxVcmwsXG4gICAgZGF0ZTogbmV3IERhdGUoKSxcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBub3RGb3VuZEhhbmRsZXI7XG4iLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCBtdWx0ZXIgZnJvbSBcIm11bHRlclwiO1xuaW1wb3J0IHsgWm9kRXJyb3IgfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuY29uc3QgZ2xvYmFsRXJyb3JIYW5kbGVyID0gKFxuICBlcnI6IGFueSxcbiAgcmVxOiBSZXF1ZXN0LFxuICByZXM6IFJlc3BvbnNlLFxuICBuZXh0OiBOZXh0RnVuY3Rpb24sXG4pID0+IHtcbiAgaWYgKGNvbmZpZy5ub2RlX2VudiAhPT0gXCJwcm9kdWN0aW9uXCIpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3I6XCIsIGVycik7XG4gIH1cblxuICAvLyBkZWZhdWx0IGZhbGxiYWNrXG4gIGxldCBzdGF0dXNDb2RlOiBudW1iZXIgPSBodHRwU3RhdHVzLklOVEVSTkFMX1NFUlZFUl9FUlJPUjtcbiAgbGV0IGVycm9yTWVzc2FnZTogc3RyaW5nID0gZXJyPy5tZXNzYWdlIHx8IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCI7XG4gIGxldCBlcnJvck5hbWU6IHN0cmluZyA9IGVycj8ubmFtZSB8fCBcIkVycm9yXCI7XG5cbiAgLy8gWm9kIHZhbGlkYXRpb24gZXJyb3JcbiAgaWYgKGVyciBpbnN0YW5jZW9mIFpvZEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLmlzc3Vlcy5tYXAoKGkpID0+IGkubWVzc2FnZSkuam9pbihcIiwgXCIpO1xuICAgIGVycm9yTmFtZSA9IFwiWm9kRXJyb3JcIjtcbiAgfVxuXG4gIC8vIE11bHRlciBmaWxlIHVwbG9hZCBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBtdWx0ZXIuTXVsdGVyRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5CQURfUkVRVUVTVDtcbiAgICBlcnJvck5hbWUgPSBcIk11bHRlckVycm9yXCI7XG4gICAgZXJyb3JNZXNzYWdlID1cbiAgICAgIGVyci5jb2RlID09PSBcIkxJTUlUX0ZJTEVfU0laRVwiXG4gICAgICAgID8gXCJGaWxlIHRvbyBsYXJnZS4gTWF4aW11bSBzaXplIGlzIDVNQi5cIlxuICAgICAgICA6IGBVcGxvYWQgZmFpbGVkOiAke2Vyci5jb2RlfWA7XG4gIH1cblxuICAvLyBDdXN0b20gZmlsZSB0eXBlIHJlamVjdGlvbiBmcm9tIHRoZSBtdWx0ZXIgZmlsZUZpbHRlclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvciAmJiAoZXJyIGFzIGFueSkuY29kZSA9PT0gXCJJTlZBTElEX0ZJTEVfVFlQRVwiKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gIH1cblxuICAvLyBQcmlzbWEgdmFsaWRhdGlvbiBlcnJvclxuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgZXJyb3JNZXNzYWdlID1cbiAgICAgIFwiWW91IGhhdmUgcHJvdmlkZWQgaW5jb3JyZWN0IGZpZWxkIHR5cGUgb3IgbWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIjtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclwiO1xuICB9XG5cbiAgLy8gUHJpc21hIGtub3duIGVycm9yc1xuICBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBQcmlzbWEuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3IpIHtcbiAgICBlcnJvck5hbWUgPSBcIlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yXCI7XG5cbiAgICBpZiAoZXJyLmNvZGUgPT09IFwiUDIwMDJcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQ09ORkxJQ1Q7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBcIlRoaXMgdmFsdWUgYWxyZWFkeSBleGlzdHNcIjtcbiAgICB9IGVsc2UgaWYgKGVyci5jb2RlID09PSBcIlAyMDAzXCIpIHtcbiAgICAgIHN0YXR1c0NvZGUgPSBodHRwU3RhdHVzLkNPTkZMSUNUO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJGb3JlaWduIGtleSBjb25zdHJhaW50IGZhaWxlZFwiO1xuICAgIH0gZWxzZSBpZiAoZXJyLmNvZGUgPT09IFwiUDIwMjVcIikge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuTk9UX0ZPVU5EO1xuICAgICAgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgXCJBbiBvcGVyYXRpb24gZmFpbGVkIGJlY2F1c2Ugb25lIG9yIG1vcmUgcmVxdWlyZWQgcmVjb3JkcyB3ZXJlIG5vdCBmb3VuZC5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuQkFEX1JFUVVFU1Q7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICB9XG4gIH1cblxuICAvLyBQcmlzbWEgREIgY29ubmVjdGlvbi9pbml0IGVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIFByaXNtYS5QcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yKSB7XG4gICAgZXJyb3JOYW1lID0gXCJQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yXCI7XG5cbiAgICBpZiAoZXJyLmVycm9yQ29kZSA9PT0gXCJQMTAwMFwiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5VTkFVVEhPUklaRUQ7XG4gICAgICBlcnJvck1lc3NhZ2UgPVxuICAgICAgICBcIkF1dGhlbnRpY2F0aW9uIGZhaWxlZCBhZ2FpbnN0IHRoZSBkYXRhYmFzZSBzZXJ2ZXIuIFBsZWFzZSBjaGVjayB5b3VyIGRhdGFiYXNlIGNyZWRlbnRpYWxzLlwiO1xuICAgIH0gZWxzZSBpZiAoZXJyLmVycm9yQ29kZSA9PT0gXCJQMTAwMVwiKSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5TRVJWSUNFX1VOQVZBSUxBQkxFO1xuICAgICAgZXJyb3JNZXNzYWdlID0gXCJDYW4ndCByZWFjaCB0aGUgZGF0YWJhc2Ugc2VydmVyLlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gICAgICBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICB9XG4gIH1cblxuICAvLyBQcmlzbWEgdW5rbm93biByZXF1ZXN0IGVycm9yXG4gIGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIFByaXNtYS5QcmlzbWFDbGllbnRVbmtub3duUmVxdWVzdEVycm9yKSB7XG4gICAgc3RhdHVzQ29kZSA9IGh0dHBTdGF0dXMuSU5URVJOQUxfU0VSVkVSX0VSUk9SO1xuICAgIGVycm9yTmFtZSA9IFwiUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclwiO1xuICAgIGVycm9yTWVzc2FnZSA9IFwiRXJyb3Igb2NjdXJyZWQgZHVyaW5nIHF1ZXJ5IGV4ZWN1dGlvblwiO1xuICB9XG5cbiAgLy8gWW91ciBjdXN0b20gQXBwRXJyb3JcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgQXBwRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gZXJyLnN0YXR1c0NvZGU7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2U7XG4gICAgZXJyb3JOYW1lID0gZXJyLm5hbWUgfHwgXCJBcHBFcnJvclwiO1xuICB9XG5cbiAgLy8gRmFsbGJhY2sgZm9yIG90aGVyIHRocm93biBlcnJvcnNcbiAgZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICBzdGF0dXNDb2RlID0gaHR0cFN0YXR1cy5JTlRFUk5BTF9TRVJWRVJfRVJST1I7XG4gICAgZXJyb3JNZXNzYWdlID0gZXJyLm1lc3NhZ2UgfHwgXCJJbnRlcm5hbCBTZXJ2ZXIgRXJyb3JcIjtcbiAgICBlcnJvck5hbWUgPSBlcnIubmFtZSB8fCBcIkVycm9yXCI7XG4gIH1cblxuICByZXMuc3RhdHVzKHN0YXR1c0NvZGUpLmpzb24oe1xuICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgIHN0YXR1c0NvZGUsXG4gICAgbmFtZTogZXJyb3JOYW1lLFxuICAgIG1lc3NhZ2U6IGVycm9yTWVzc2FnZSxcbiAgICBlcnJvcjogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwiZGV2ZWxvcG1lbnRcIiA/IGVyci5zdGFjayA6IHVuZGVmaW5lZCxcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBnbG9iYWxFcnJvckhhbmRsZXI7XG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4gKiBUaGlzIGZpbGUgc2hvdWxkIGJlIHlvdXIgbWFpbiBpbXBvcnQgdG8gdXNlIFByaXNtYS4gVGhyb3VnaCBpdCB5b3UgZ2V0IGFjY2VzcyB0byBhbGwgdGhlIG1vZGVscywgZW51bXMsIGFuZCBpbnB1dCB0eXBlcy5cbiAqIElmIHlvdSdyZSBsb29raW5nIGZvciBzb21ldGhpbmcgeW91IGNhbiBpbXBvcnQgaW4gdGhlIGNsaWVudC1zaWRlIG9mIHlvdXIgYXBwbGljYXRpb24sIHBsZWFzZSByZWZlciB0byB0aGUgYGJyb3dzZXIudHNgIGZpbGUgaW5zdGVhZC5cbiAqXG4gKiBcdUQ4M0RcdURGRTIgWW91IGNhbiBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5LlxuICovXG5cbmltcG9ydCAqIGFzIHByb2Nlc3MgZnJvbSAnbm9kZTpwcm9jZXNzJ1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAnbm9kZTp1cmwnXG5nbG9iYWxUaGlzWydfX2Rpcm5hbWUnXSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpXG5cbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSBcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvY2xpZW50XCJcbmltcG9ydCAqIGFzICRFbnVtcyBmcm9tIFwiLi9lbnVtc1wiXG5pbXBvcnQgKiBhcyAkQ2xhc3MgZnJvbSBcIi4vaW50ZXJuYWwvY2xhc3NcIlxuaW1wb3J0ICogYXMgUHJpc21hIGZyb20gXCIuL2ludGVybmFsL3ByaXNtYU5hbWVzcGFjZVwiXG5cbmV4cG9ydCAqIGFzICRFbnVtcyBmcm9tICcuL2VudW1zJ1xuZXhwb3J0ICogZnJvbSBcIi4vZW51bXNcIlxuLyoqXG4gKiAjIyBQcmlzbWEgQ2xpZW50XG4gKiBcbiAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICogICBhZGFwdGVyOiBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nOiBwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwgfSlcbiAqIH0pXG4gKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ1Bvc3RzXG4gKiBjb25zdCBibG9nUG9zdHMgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoKVxuICogYGBgXG4gKiBcbiAqIFJlYWQgbW9yZSBpbiBvdXIgW2RvY3NdKGh0dHBzOi8vcHJpcy5seS9kL2NsaWVudCkuXG4gKi9cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnQgPSAkQ2xhc3MuZ2V0UHJpc21hQ2xpZW50Q2xhc3MoKVxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50PExvZ09wdHMgZXh0ZW5kcyBQcmlzbWEuTG9nTGV2ZWwgPSBuZXZlciwgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1tcIm9taXRcIl0gPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1tcIm9taXRcIl0sIEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzPiA9ICRDbGFzcy5QcmlzbWFDbGllbnQ8TG9nT3B0cywgT21pdE9wdHMsIEV4dEFyZ3M+XG5leHBvcnQgeyBQcmlzbWEgfVxuXG4vKipcbiAqIE1vZGVsIEJsb2dQb3N0XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQmxvZ1Bvc3QgPSBQcmlzbWEuQmxvZ1Bvc3RNb2RlbFxuLyoqXG4gKiBNb2RlbCBCb29raW5nXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQm9va2luZyA9IFByaXNtYS5Cb29raW5nTW9kZWxcbi8qKlxuICogTW9kZWwgQ2F0ZWdvcnlcbiAqIFxuICovXG5leHBvcnQgdHlwZSBDYXRlZ29yeSA9IFByaXNtYS5DYXRlZ29yeU1vZGVsXG4vKipcbiAqIE1vZGVsIENvbnRhY3RNZXNzYWdlXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgQ29udGFjdE1lc3NhZ2UgPSBQcmlzbWEuQ29udGFjdE1lc3NhZ2VNb2RlbFxuLyoqXG4gKiBNb2RlbCBQYXltZW50XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUGF5bWVudCA9IFByaXNtYS5QYXltZW50TW9kZWxcbi8qKlxuICogTW9kZWwgUmV2aWV3XG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgUmV2aWV3ID0gUHJpc21hLlJldmlld01vZGVsXG4vKipcbiAqIE1vZGVsIFRvdXJQYWNrYWdlXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgVG91clBhY2thZ2UgPSBQcmlzbWEuVG91clBhY2thZ2VNb2RlbFxuLyoqXG4gKiBNb2RlbCBVc2VyXG4gKiBcbiAqL1xuZXhwb3J0IHR5cGUgVXNlciA9IFByaXNtYS5Vc2VyTW9kZWxcbiIsICJcbi8qICEhISBUaGlzIGlzIGNvZGUgZ2VuZXJhdGVkIGJ5IFByaXNtYS4gRG8gbm90IGVkaXQgZGlyZWN0bHkuICEhISAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIGJpb21lLWlnbm9yZS1hbGwgbGludDogZ2VuZXJhdGVkIGZpbGVcbi8vIEB0cy1ub2NoZWNrIFxuLypcbiAqIFdBUk5JTkc6IFRoaXMgaXMgYW4gaW50ZXJuYWwgZmlsZSB0aGF0IGlzIHN1YmplY3QgdG8gY2hhbmdlIVxuICpcbiAqIFx1RDgzRFx1REVEMSBVbmRlciBubyBjaXJjdW1zdGFuY2VzIHNob3VsZCB5b3UgaW1wb3J0IHRoaXMgZmlsZSBkaXJlY3RseSEgXHVEODNEXHVERUQxXG4gKlxuICogUGxlYXNlIGltcG9ydCB0aGUgYFByaXNtYUNsaWVudGAgY2xhc3MgZnJvbSB0aGUgYGNsaWVudC50c2AgZmlsZSBpbnN0ZWFkLlxuICovXG5cbmltcG9ydCAqIGFzIHJ1bnRpbWUgZnJvbSBcIkBwcmlzbWEvY2xpZW50L3J1bnRpbWUvY2xpZW50XCJcbmltcG9ydCB0eXBlICogYXMgUHJpc21hIGZyb20gXCIuL3ByaXNtYU5hbWVzcGFjZVwiXG5cblxuY29uc3QgY29uZmlnOiBydW50aW1lLkdldFByaXNtYUNsaWVudENvbmZpZyA9IHtcbiAgXCJwcmV2aWV3RmVhdHVyZXNcIjogW10sXG4gIFwiY2xpZW50VmVyc2lvblwiOiBcIjcuOS4xXCIsXG4gIFwiZW5naW5lVmVyc2lvblwiOiBcImU5MjIwODliN2Q3NTAyYWZmNDI0OWQ1ZGEzNDIwZjZmYTU1ZmM2YWRcIixcbiAgXCJhY3RpdmVQcm92aWRlclwiOiBcInBvc3RncmVzcWxcIixcbiAgXCJpbmxpbmVTY2hlbWFcIjogXCJtb2RlbCBCbG9nUG9zdCB7XFxuICBpZCAgICAgICAgIFN0cmluZyAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIHRpdGxlICAgICAgU3RyaW5nXFxuICBzbHVnICAgICAgIFN0cmluZyAgICAgQHVuaXF1ZVxcbiAgZXhjZXJwdCAgICBTdHJpbmdcXG4gIGNvbnRlbnQgICAgU3RyaW5nXFxuICBjb3ZlckltYWdlIFN0cmluZ1xcbiAgc3RhdHVzICAgICBQb3N0U3RhdHVzIEBkZWZhdWx0KERSQUZUKVxcbiAgaXNEZWxldGVkICBCb29sZWFuICAgIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgYXV0aG9ySWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgYXV0aG9yIFVzZXIgQHJlbGF0aW9uKFxcXCJBdXRob3JQb3N0c1xcXCIsIGZpZWxkczogW2F1dGhvcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG5cXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQGluZGV4KFthdXRob3JJZF0pXFxuICBAQG1hcChcXFwiYmxvZ19wb3N0c1xcXCIpXFxufVxcblxcbm1vZGVsIEJvb2tpbmcge1xcbiAgaWQgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICB0cmF2ZWxEYXRlIERhdGVUaW1lXFxuICB0cmF2ZWxlcnMgIEludFxcbiAgdG90YWxQcmljZSBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKVxcbiAgc3RhdHVzICAgICBCb29raW5nU3RhdHVzIEBkZWZhdWx0KFBFTkRJTkcpXFxuXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgdXNlciAgICAgVXNlciAgICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lckJvb2tpbmdzXFxcIiwgZmllbGRzOiBbdXNlcklkXSwgcmVmZXJlbmNlczogW2lkXSlcXG4gIHBhY2thZ2UgIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcbiAgcGF5bWVudHMgUGF5bWVudFtdXFxuXFxuICBAQGluZGV4KFt1c2VySWRdKVxcbiAgQEBpbmRleChbcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQGluZGV4KFt1c2VySWQsIHBhY2thZ2VJZCwgdHJhdmVsRGF0ZV0pXFxuICBAQG1hcChcXFwiYm9va2luZ3NcXFwiKVxcbn1cXG5cXG5tb2RlbCBDYXRlZ29yeSB7XFxuICBpZCAgIFN0cmluZyBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgbmFtZSBTdHJpbmcgQHVuaXF1ZVxcbiAgc2x1ZyBTdHJpbmcgQHVuaXF1ZVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBhY2thZ2VzIFRvdXJQYWNrYWdlW11cXG5cXG4gIEBAbWFwKFxcXCJjYXRlZ29yaWVzXFxcIilcXG59XFxuXFxubW9kZWwgQ29udGFjdE1lc3NhZ2Uge1xcbiAgaWQgICAgICAgICBTdHJpbmcgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBuYW1lICAgICAgIFN0cmluZ1xcbiAgZW1haWwgICAgICBTdHJpbmdcXG4gIHN1YmplY3QgICAgU3RyaW5nXFxuICBtZXNzYWdlICAgIFN0cmluZ1xcbiAgaXNSZXNvbHZlZCBCb29sZWFuIEBkZWZhdWx0KGZhbHNlKVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIEBAaW5kZXgoW2lzUmVzb2x2ZWRdKVxcbiAgQEBtYXAoXFxcImNvbnRhY3RfbWVzc2FnZXNcXFwiKVxcbn1cXG5cXG5lbnVtIFJvbGUge1xcbiAgVVNFUlxcbiAgQUdFTlRcXG4gIEFETUlOXFxufVxcblxcbmVudW0gVXNlclN0YXR1cyB7XFxuICBBQ1RJVkVcXG4gIFNVU1BFTkRFRFxcbn1cXG5cXG5lbnVtIEF1dGhQcm92aWRlciB7XFxuICBDUkVERU5USUFMXFxuICBHT09HTEVcXG59XFxuXFxuZW51bSBQYWNrYWdlU3RhdHVzIHtcXG4gIFBFTkRJTkdcXG4gIEFQUFJPVkVEXFxuICBSRUpFQ1RFRFxcbn1cXG5cXG5lbnVtIEJvb2tpbmdTdGF0dXMge1xcbiAgUEVORElOR1xcbiAgUEFJRFxcbiAgQ09ORklSTUVEXFxuICBDQU5DRUxMRURcXG4gIENPTVBMRVRFRFxcbn1cXG5cXG5lbnVtIFBheW1lbnRTdGF0dXMge1xcbiAgSU5JVElBVEVEXFxuICBTVUNDRVNTXFxuICBGQUlMRURcXG4gIENBTkNFTExFRFxcbiAgUkVGVU5ERURcXG59XFxuXFxuZW51bSBQb3N0U3RhdHVzIHtcXG4gIERSQUZUXFxuICBQVUJMSVNIRURcXG59XFxuXFxubW9kZWwgUGF5bWVudCB7XFxuICBpZCAgICAgICAgICAgICBTdHJpbmcgICAgICAgIEBpZCBAZGVmYXVsdCh1dWlkKCkpXFxuICBib29raW5nSWQgICAgICBTdHJpbmdcXG4gIHRyYW5JZCAgICAgICAgIFN0cmluZyAgICAgICAgQHVuaXF1ZSAvLyBTU0xDb21tZXJ6IHRyYW5zYWN0aW9uIGlkLCBnZW5lcmF0ZWQgc2VydmVyLXNpZGVcXG4gIHZhbElkICAgICAgICAgIFN0cmluZz8gLy8gc2V0IGFmdGVyIGdhdGV3YXkgc3VjY2VzcywgdXNlZCBmb3Igc2VydmVyLXNpZGUgdmFsaWRhdGlvblxcbiAgYW1vdW50ICAgICAgICAgRGVjaW1hbCAgICAgICBAZGIuRGVjaW1hbCgxMCwgMikgLy8gPSBib29raW5nLnRvdGFsUHJpY2UgYXQgc2Vzc2lvbiBjcmVhdGlvblxcbiAgY3VycmVuY3kgICAgICAgU3RyaW5nICAgICAgICBAZGVmYXVsdChcXFwiQkRUXFxcIilcXG4gIHN0YXR1cyAgICAgICAgIFBheW1lbnRTdGF0dXMgQGRlZmF1bHQoSU5JVElBVEVEKVxcbiAgZ2F0ZXdheVBhZ2VVcmwgU3RyaW5nP1xcbiAgc3NsU2Vzc2lvbktleSAgU3RyaW5nP1xcbiAgY2FyZFR5cGUgICAgICAgU3RyaW5nP1xcbiAgYmFua1RyYW5JZCAgICAgU3RyaW5nP1xcbiAgcGFpZEF0ICAgICAgICAgRGF0ZVRpbWU/XFxuICByZWZ1bmRSZWZJZCAgICBTdHJpbmc/IC8vIFNTTENvbW1lcnogcmVmdW5kIHJlZmVyZW5jZSAoc2V0IHdoZW4gYSByZWZ1bmQgaXMgaW5pdGlhdGVkKVxcbiAgcmVmdW5kZWRBdCAgICAgRGF0ZVRpbWU/IC8vIHdoZW4gdGhlIHJlZnVuZCB3YXMgaW5pdGlhdGVkL3NldHRsZWRcXG5cXG4gIGNyZWF0ZWRBdCBEYXRlVGltZSBAZGVmYXVsdChub3coKSlcXG4gIHVwZGF0ZWRBdCBEYXRlVGltZSBAdXBkYXRlZEF0XFxuXFxuICBib29raW5nIEJvb2tpbmcgQHJlbGF0aW9uKGZpZWxkczogW2Jvb2tpbmdJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuXFxuICBAQGluZGV4KFtib29raW5nSWRdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAbWFwKFxcXCJwYXltZW50c1xcXCIpXFxufVxcblxcbm1vZGVsIFJldmlldyB7XFxuICBpZCAgICAgIFN0cmluZyBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgcmF0aW5nICBJbnRcXG4gIGNvbW1lbnQgU3RyaW5nXFxuXFxuICB1c2VySWQgICAgU3RyaW5nXFxuICBwYWNrYWdlSWQgU3RyaW5nXFxuXFxuICBjcmVhdGVkQXQgRGF0ZVRpbWUgQGRlZmF1bHQobm93KCkpXFxuICB1cGRhdGVkQXQgRGF0ZVRpbWUgQHVwZGF0ZWRBdFxcblxcbiAgdXNlciAgICBVc2VyICAgICAgICBAcmVsYXRpb24oXFxcIkN1c3RvbWVyUmV2aWV3c1xcXCIsIGZpZWxkczogW3VzZXJJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBwYWNrYWdlIFRvdXJQYWNrYWdlIEByZWxhdGlvbihmaWVsZHM6IFtwYWNrYWdlSWRdLCByZWZlcmVuY2VzOiBbaWRdKVxcblxcbiAgQEB1bmlxdWUoW3VzZXJJZCwgcGFja2FnZUlkXSlcXG4gIEBAaW5kZXgoW3BhY2thZ2VJZF0pXFxuICBAQG1hcChcXFwicmV2aWV3c1xcXCIpXFxufVxcblxcbi8vIFRoaXMgaXMgeW91ciBQcmlzbWEgc2NoZW1hIGZpbGUsXFxuLy8gbGVhcm4gbW9yZSBhYm91dCBpdCBpbiB0aGUgZG9jczogaHR0cHM6Ly9wcmlzLmx5L2QvcHJpc21hLXNjaGVtYVxcblxcbmdlbmVyYXRvciBjbGllbnQge1xcbiAgcHJvdmlkZXIgPSBcXFwicHJpc21hLWNsaWVudFxcXCJcXG4gIG91dHB1dCAgID0gXFxcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWFcXFwiXFxufVxcblxcbmRhdGFzb3VyY2UgZGIge1xcbiAgcHJvdmlkZXIgPSBcXFwicG9zdGdyZXNxbFxcXCJcXG59XFxuXFxubW9kZWwgVG91clBhY2thZ2Uge1xcbiAgaWQgICAgICAgICAgU3RyaW5nICAgICAgICBAaWQgQGRlZmF1bHQodXVpZCgpKVxcbiAgdGl0bGUgICAgICAgU3RyaW5nXFxuICBzbHVnICAgICAgICBTdHJpbmcgICAgICAgIEB1bmlxdWVcXG4gIGRlc2NyaXB0aW9uIFN0cmluZ1xcbiAgbG9jYXRpb24gICAgU3RyaW5nXFxuICBwcmljZSAgICAgICBEZWNpbWFsICAgICAgIEBkYi5EZWNpbWFsKDEwLCAyKVxcbiAgZHVyYXRpb24gICAgSW50XFxuICByYXRpbmcgICAgICBGbG9hdCAgICAgICAgIEBkZWZhdWx0KDApXFxuICBpbWFnZXMgICAgICBTdHJpbmdbXVxcbiAgc3RhdHVzICAgICAgUGFja2FnZVN0YXR1cyBAZGVmYXVsdChQRU5ESU5HKVxcbiAgaXNEZWxldGVkICAgQm9vbGVhbiAgICAgICBAZGVmYXVsdChmYWxzZSlcXG5cXG4gIGNhdGVnb3J5SWQgU3RyaW5nXFxuICBhZ2VudElkICAgIFN0cmluZ1xcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIGNhdGVnb3J5IENhdGVnb3J5ICBAcmVsYXRpb24oZmllbGRzOiBbY2F0ZWdvcnlJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBhZ2VudCAgICBVc2VyICAgICAgQHJlbGF0aW9uKFxcXCJBZ2VudFBhY2thZ2VzXFxcIiwgZmllbGRzOiBbYWdlbnRJZF0sIHJlZmVyZW5jZXM6IFtpZF0pXFxuICBib29raW5ncyBCb29raW5nW11cXG4gIHJldmlld3MgIFJldmlld1tdXFxuXFxuICBAQGluZGV4KFtjYXRlZ29yeUlkXSlcXG4gIEBAaW5kZXgoW2NhdGVnb3J5SWQsIHByaWNlXSlcXG4gIEBAaW5kZXgoW3ByaWNlXSlcXG4gIEBAaW5kZXgoW3N0YXR1c10pXFxuICBAQG1hcChcXFwidG91cl9wYWNrYWdlc1xcXCIpXFxufVxcblxcbm1vZGVsIFVzZXIge1xcbiAgaWQgICAgICAgICAgICBTdHJpbmcgICAgICAgQGlkIEBkZWZhdWx0KHV1aWQoKSlcXG4gIG5hbWUgICAgICAgICAgU3RyaW5nXFxuICBlbWFpbCAgICAgICAgIFN0cmluZyAgICAgICBAdW5pcXVlXFxuICBwYXNzd29yZCAgICAgIFN0cmluZz9cXG4gIGdvb2dsZUlkICAgICAgU3RyaW5nPyAgICAgIEB1bmlxdWVcXG4gIHBob25lICAgICAgICAgU3RyaW5nP1xcbiAgYXZhdGFyVXJsICAgICBTdHJpbmc/XFxuICByb2xlICAgICAgICAgIFJvbGUgICAgICAgICBAZGVmYXVsdChVU0VSKVxcbiAgc3RhdHVzICAgICAgICBVc2VyU3RhdHVzICAgQGRlZmF1bHQoQUNUSVZFKVxcbiAgYXV0aFByb3ZpZGVyICBBdXRoUHJvdmlkZXIgQGRlZmF1bHQoQ1JFREVOVElBTClcXG4gIGVtYWlsVmVyaWZpZWQgQm9vbGVhbiAgICAgIEBkZWZhdWx0KGZhbHNlKVxcbiAgaXNEZWxldGVkICAgICBCb29sZWFuICAgICAgQGRlZmF1bHQoZmFsc2UpXFxuICB0b2tlblZlcnNpb24gIEludCAgICAgICAgICBAZGVmYXVsdCgwKVxcblxcbiAgY3JlYXRlZEF0IERhdGVUaW1lIEBkZWZhdWx0KG5vdygpKVxcbiAgdXBkYXRlZEF0IERhdGVUaW1lIEB1cGRhdGVkQXRcXG5cXG4gIHBhY2thZ2VzIFRvdXJQYWNrYWdlW10gQHJlbGF0aW9uKFxcXCJBZ2VudFBhY2thZ2VzXFxcIilcXG4gIGJvb2tpbmdzIEJvb2tpbmdbXSAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lckJvb2tpbmdzXFxcIilcXG4gIHJldmlld3MgIFJldmlld1tdICAgICAgQHJlbGF0aW9uKFxcXCJDdXN0b21lclJldmlld3NcXFwiKVxcbiAgcG9zdHMgICAgQmxvZ1Bvc3RbXSAgICBAcmVsYXRpb24oXFxcIkF1dGhvclBvc3RzXFxcIilcXG5cXG4gIEBAaW5kZXgoW3JvbGVdKVxcbiAgQEBpbmRleChbc3RhdHVzXSlcXG4gIEBAbWFwKFxcXCJ1c2Vyc1xcXCIpXFxufVxcblwiLFxuICBcInJ1bnRpbWVEYXRhTW9kZWxcIjoge1xuICAgIFwibW9kZWxzXCI6IHt9LFxuICAgIFwiZW51bXNcIjoge30sXG4gICAgXCJ0eXBlc1wiOiB7fVxuICB9LFxuICBcInBhcmFtZXRlcml6YXRpb25TY2hlbWFcIjoge1xuICAgIFwic3RyaW5nc1wiOiBbXSxcbiAgICBcImdyYXBoXCI6IFwiXCJcbiAgfVxufVxuXG5jb25maWcucnVudGltZURhdGFNb2RlbCA9IEpTT04ucGFyc2UoXCJ7XFxcIm1vZGVsc1xcXCI6e1xcXCJCbG9nUG9zdFxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidGl0bGVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNsdWdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImV4Y2VycHRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNvbnRlbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNvdmVySW1hZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN0YXR1c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlBvc3RTdGF0dXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhdXRob3JJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhdXRob3JcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJBdXRob3JQb3N0c1xcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwiYmxvZ19wb3N0c1xcXCJ9LFxcXCJCb29raW5nXFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0cmF2ZWxEYXRlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRyYXZlbGVyc1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiSW50XFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidG90YWxQcmljZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN0YXR1c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2tpbmdTdGF0dXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VySWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1c2VyXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXltZW50c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJvYmplY3RcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiUGF5bWVudFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkJvb2tpbmdUb1BheW1lbnRcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcImJvb2tpbmdzXFxcIn0sXFxcIkNhdGVnb3J5XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJuYW1lXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzbHVnXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBhY2thZ2VzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkNhdGVnb3J5VG9Ub3VyUGFja2FnZVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwiY2F0ZWdvcmllc1xcXCJ9LFxcXCJDb250YWN0TWVzc2FnZVxcXCI6e1xcXCJmaWVsZHNcXFwiOlt7XFxcIm5hbWVcXFwiOlxcXCJpZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibmFtZVxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZW1haWxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN1YmplY3RcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm1lc3NhZ2VcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImlzUmVzb2x2ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwiY29udGFjdF9tZXNzYWdlc1xcXCJ9LFxcXCJQYXltZW50XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRyYW5JZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidmFsSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImFtb3VudFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGVjaW1hbFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImN1cnJlbmN5XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzdGF0dXNcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJQYXltZW50U3RhdHVzXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZ2F0ZXdheVBhZ2VVcmxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInNzbFNlc3Npb25LZXlcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNhcmRUeXBlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJiYW5rVHJhbklkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWlkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicmVmdW5kUmVmSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJlZnVuZGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiY3JlYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVwZGF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJib29raW5nXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvUGF5bWVudFxcXCJ9XSxcXFwiZGJOYW1lXFxcIjpcXFwicGF5bWVudHNcXFwifSxcXFwiUmV2aWV3XFxcIjp7XFxcImZpZWxkc1xcXCI6W3tcXFwibmFtZVxcXCI6XFxcImlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyYXRpbmdcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNvbW1lbnRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJJZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInVzZXJcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlVzZXJcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJDdXN0b21lclJldmlld3NcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYWNrYWdlXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJUb3VyUGFja2FnZVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIlJldmlld1RvVG91clBhY2thZ2VcXFwifV0sXFxcImRiTmFtZVxcXCI6XFxcInJldmlld3NcXFwifSxcXFwiVG91clBhY2thZ2VcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInRpdGxlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJzbHVnXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJkZXNjcmlwdGlvblxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwibG9jYXRpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInByaWNlXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEZWNpbWFsXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZHVyYXRpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJhdGluZ1xcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRmxvYXRcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpbWFnZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInN0YXR1c1xcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIlBhY2thZ2VTdGF0dXNcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjYXRlZ29yeUlkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhZ2VudElkXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJjcmVhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwidXBkYXRlZEF0XFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJEYXRlVGltZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNhdGVnb3J5XFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJDYXRlZ29yeVxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkNhdGVnb3J5VG9Ub3VyUGFja2FnZVxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImFnZW50XFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJVc2VyXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQWdlbnRQYWNrYWdlc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQm9va2luZ1RvVG91clBhY2thZ2VcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJyZXZpZXdzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJSZXZpZXdcXFwiLFxcXCJyZWxhdGlvbk5hbWVcXFwiOlxcXCJSZXZpZXdUb1RvdXJQYWNrYWdlXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJ0b3VyX3BhY2thZ2VzXFxcIn0sXFxcIlVzZXJcXFwiOntcXFwiZmllbGRzXFxcIjpbe1xcXCJuYW1lXFxcIjpcXFwiaWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcIm5hbWVcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJwYXNzd29yZFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiU3RyaW5nXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwiZ29vZ2xlSWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBob25lXFxcIixcXFwia2luZFxcXCI6XFxcInNjYWxhclxcXCIsXFxcInR5cGVcXFwiOlxcXCJTdHJpbmdcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJhdmF0YXJVcmxcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIlN0cmluZ1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJvbGVcXFwiLFxcXCJraW5kXFxcIjpcXFwiZW51bVxcXCIsXFxcInR5cGVcXFwiOlxcXCJSb2xlXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwic3RhdHVzXFxcIixcXFwia2luZFxcXCI6XFxcImVudW1cXFwiLFxcXCJ0eXBlXFxcIjpcXFwiVXNlclN0YXR1c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImF1dGhQcm92aWRlclxcXCIsXFxcImtpbmRcXFwiOlxcXCJlbnVtXFxcIixcXFwidHlwZVxcXCI6XFxcIkF1dGhQcm92aWRlclxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImVtYWlsVmVyaWZpZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJpc0RlbGV0ZWRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkJvb2xlYW5cXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ0b2tlblZlcnNpb25cXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkludFxcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImNyZWF0ZWRBdFxcXCIsXFxcImtpbmRcXFwiOlxcXCJzY2FsYXJcXFwiLFxcXCJ0eXBlXFxcIjpcXFwiRGF0ZVRpbWVcXFwifSx7XFxcIm5hbWVcXFwiOlxcXCJ1cGRhdGVkQXRcXFwiLFxcXCJraW5kXFxcIjpcXFwic2NhbGFyXFxcIixcXFwidHlwZVxcXCI6XFxcIkRhdGVUaW1lXFxcIn0se1xcXCJuYW1lXFxcIjpcXFwicGFja2FnZXNcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlRvdXJQYWNrYWdlXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQWdlbnRQYWNrYWdlc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcImJvb2tpbmdzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCb29raW5nXFxcIixcXFwicmVsYXRpb25OYW1lXFxcIjpcXFwiQ3VzdG9tZXJCb29raW5nc1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInJldmlld3NcXFwiLFxcXCJraW5kXFxcIjpcXFwib2JqZWN0XFxcIixcXFwidHlwZVxcXCI6XFxcIlJldmlld1xcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkN1c3RvbWVyUmV2aWV3c1xcXCJ9LHtcXFwibmFtZVxcXCI6XFxcInBvc3RzXFxcIixcXFwia2luZFxcXCI6XFxcIm9iamVjdFxcXCIsXFxcInR5cGVcXFwiOlxcXCJCbG9nUG9zdFxcXCIsXFxcInJlbGF0aW9uTmFtZVxcXCI6XFxcIkF1dGhvclBvc3RzXFxcIn1dLFxcXCJkYk5hbWVcXFwiOlxcXCJ1c2Vyc1xcXCJ9fSxcXFwiZW51bXNcXFwiOnt9LFxcXCJ0eXBlc1xcXCI6e319XCIpXG5jb25maWcucGFyYW1ldGVyaXphdGlvblNjaGVtYSA9IHtcbiAgc3RyaW5nczogSlNPTi5wYXJzZShcIltcXFwid2hlcmVcXFwiLFxcXCJvcmRlckJ5XFxcIixcXFwiY3Vyc29yXFxcIixcXFwicGFja2FnZXNcXFwiLFxcXCJfY291bnRcXFwiLFxcXCJjYXRlZ29yeVxcXCIsXFxcImFnZW50XFxcIixcXFwidXNlclxcXCIsXFxcInBhY2thZ2VcXFwiLFxcXCJib29raW5nXFxcIixcXFwicGF5bWVudHNcXFwiLFxcXCJib29raW5nc1xcXCIsXFxcInJldmlld3NcXFwiLFxcXCJwb3N0c1xcXCIsXFxcImF1dGhvclxcXCIsXFxcIkJsb2dQb3N0LmZpbmRVbmlxdWVcXFwiLFxcXCJCbG9nUG9zdC5maW5kVW5pcXVlT3JUaHJvd1xcXCIsXFxcIkJsb2dQb3N0LmZpbmRGaXJzdFxcXCIsXFxcIkJsb2dQb3N0LmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJCbG9nUG9zdC5maW5kTWFueVxcXCIsXFxcImRhdGFcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVPbmVcXFwiLFxcXCJCbG9nUG9zdC5jcmVhdGVNYW55XFxcIixcXFwiQmxvZ1Bvc3QuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU9uZVxcXCIsXFxcIkJsb2dQb3N0LnVwZGF0ZU1hbnlcXFwiLFxcXCJCbG9nUG9zdC51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiY3JlYXRlXFxcIixcXFwidXBkYXRlXFxcIixcXFwiQmxvZ1Bvc3QudXBzZXJ0T25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlT25lXFxcIixcXFwiQmxvZ1Bvc3QuZGVsZXRlTWFueVxcXCIsXFxcImhhdmluZ1xcXCIsXFxcIl9taW5cXFwiLFxcXCJfbWF4XFxcIixcXFwiQmxvZ1Bvc3QuZ3JvdXBCeVxcXCIsXFxcIkJsb2dQb3N0LmFnZ3JlZ2F0ZVxcXCIsXFxcIkJvb2tpbmcuZmluZFVuaXF1ZVxcXCIsXFxcIkJvb2tpbmcuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJCb29raW5nLmZpbmRGaXJzdFxcXCIsXFxcIkJvb2tpbmcuZmluZEZpcnN0T3JUaHJvd1xcXCIsXFxcIkJvb2tpbmcuZmluZE1hbnlcXFwiLFxcXCJCb29raW5nLmNyZWF0ZU9uZVxcXCIsXFxcIkJvb2tpbmcuY3JlYXRlTWFueVxcXCIsXFxcIkJvb2tpbmcuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkJvb2tpbmcudXBkYXRlT25lXFxcIixcXFwiQm9va2luZy51cGRhdGVNYW55XFxcIixcXFwiQm9va2luZy51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQm9va2luZy51cHNlcnRPbmVcXFwiLFxcXCJCb29raW5nLmRlbGV0ZU9uZVxcXCIsXFxcIkJvb2tpbmcuZGVsZXRlTWFueVxcXCIsXFxcIl9hdmdcXFwiLFxcXCJfc3VtXFxcIixcXFwiQm9va2luZy5ncm91cEJ5XFxcIixcXFwiQm9va2luZy5hZ2dyZWdhdGVcXFwiLFxcXCJDYXRlZ29yeS5maW5kVW5pcXVlXFxcIixcXFwiQ2F0ZWdvcnkuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJDYXRlZ29yeS5maW5kRmlyc3RcXFwiLFxcXCJDYXRlZ29yeS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQ2F0ZWdvcnkuZmluZE1hbnlcXFwiLFxcXCJDYXRlZ29yeS5jcmVhdGVPbmVcXFwiLFxcXCJDYXRlZ29yeS5jcmVhdGVNYW55XFxcIixcXFwiQ2F0ZWdvcnkuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNhdGVnb3J5LnVwZGF0ZU9uZVxcXCIsXFxcIkNhdGVnb3J5LnVwZGF0ZU1hbnlcXFwiLFxcXCJDYXRlZ29yeS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQ2F0ZWdvcnkudXBzZXJ0T25lXFxcIixcXFwiQ2F0ZWdvcnkuZGVsZXRlT25lXFxcIixcXFwiQ2F0ZWdvcnkuZGVsZXRlTWFueVxcXCIsXFxcIkNhdGVnb3J5Lmdyb3VwQnlcXFwiLFxcXCJDYXRlZ29yeS5hZ2dyZWdhdGVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kVW5pcXVlXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kRmlyc3RcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZmluZE1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5jcmVhdGVPbmVcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5jcmVhdGVNYW55XFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwZGF0ZU9uZVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLnVwZGF0ZU1hbnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UudXBzZXJ0T25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZGVsZXRlT25lXFxcIixcXFwiQ29udGFjdE1lc3NhZ2UuZGVsZXRlTWFueVxcXCIsXFxcIkNvbnRhY3RNZXNzYWdlLmdyb3VwQnlcXFwiLFxcXCJDb250YWN0TWVzc2FnZS5hZ2dyZWdhdGVcXFwiLFxcXCJQYXltZW50LmZpbmRVbmlxdWVcXFwiLFxcXCJQYXltZW50LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiUGF5bWVudC5maW5kRmlyc3RcXFwiLFxcXCJQYXltZW50LmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJQYXltZW50LmZpbmRNYW55XFxcIixcXFwiUGF5bWVudC5jcmVhdGVPbmVcXFwiLFxcXCJQYXltZW50LmNyZWF0ZU1hbnlcXFwiLFxcXCJQYXltZW50LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJQYXltZW50LnVwZGF0ZU9uZVxcXCIsXFxcIlBheW1lbnQudXBkYXRlTWFueVxcXCIsXFxcIlBheW1lbnQudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlBheW1lbnQudXBzZXJ0T25lXFxcIixcXFwiUGF5bWVudC5kZWxldGVPbmVcXFwiLFxcXCJQYXltZW50LmRlbGV0ZU1hbnlcXFwiLFxcXCJQYXltZW50Lmdyb3VwQnlcXFwiLFxcXCJQYXltZW50LmFnZ3JlZ2F0ZVxcXCIsXFxcIlJldmlldy5maW5kVW5pcXVlXFxcIixcXFwiUmV2aWV3LmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRGaXJzdFxcXCIsXFxcIlJldmlldy5maW5kRmlyc3RPclRocm93XFxcIixcXFwiUmV2aWV3LmZpbmRNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU9uZVxcXCIsXFxcIlJldmlldy5jcmVhdGVNYW55XFxcIixcXFwiUmV2aWV3LmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJSZXZpZXcudXBkYXRlT25lXFxcIixcXFwiUmV2aWV3LnVwZGF0ZU1hbnlcXFwiLFxcXCJSZXZpZXcudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlJldmlldy51cHNlcnRPbmVcXFwiLFxcXCJSZXZpZXcuZGVsZXRlT25lXFxcIixcXFwiUmV2aWV3LmRlbGV0ZU1hbnlcXFwiLFxcXCJSZXZpZXcuZ3JvdXBCeVxcXCIsXFxcIlJldmlldy5hZ2dyZWdhdGVcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kVW5pcXVlXFxcIixcXFwiVG91clBhY2thZ2UuZmluZFVuaXF1ZU9yVGhyb3dcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RcXFwiLFxcXCJUb3VyUGFja2FnZS5maW5kRmlyc3RPclRocm93XFxcIixcXFwiVG91clBhY2thZ2UuZmluZE1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVPbmVcXFwiLFxcXCJUb3VyUGFja2FnZS5jcmVhdGVNYW55XFxcIixcXFwiVG91clBhY2thZ2UuY3JlYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU9uZVxcXCIsXFxcIlRvdXJQYWNrYWdlLnVwZGF0ZU1hbnlcXFwiLFxcXCJUb3VyUGFja2FnZS51cGRhdGVNYW55QW5kUmV0dXJuXFxcIixcXFwiVG91clBhY2thZ2UudXBzZXJ0T25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlT25lXFxcIixcXFwiVG91clBhY2thZ2UuZGVsZXRlTWFueVxcXCIsXFxcIlRvdXJQYWNrYWdlLmdyb3VwQnlcXFwiLFxcXCJUb3VyUGFja2FnZS5hZ2dyZWdhdGVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVcXFwiLFxcXCJVc2VyLmZpbmRVbmlxdWVPclRocm93XFxcIixcXFwiVXNlci5maW5kRmlyc3RcXFwiLFxcXCJVc2VyLmZpbmRGaXJzdE9yVGhyb3dcXFwiLFxcXCJVc2VyLmZpbmRNYW55XFxcIixcXFwiVXNlci5jcmVhdGVPbmVcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlcXFwiLFxcXCJVc2VyLmNyZWF0ZU1hbnlBbmRSZXR1cm5cXFwiLFxcXCJVc2VyLnVwZGF0ZU9uZVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueVxcXCIsXFxcIlVzZXIudXBkYXRlTWFueUFuZFJldHVyblxcXCIsXFxcIlVzZXIudXBzZXJ0T25lXFxcIixcXFwiVXNlci5kZWxldGVPbmVcXFwiLFxcXCJVc2VyLmRlbGV0ZU1hbnlcXFwiLFxcXCJVc2VyLmdyb3VwQnlcXFwiLFxcXCJVc2VyLmFnZ3JlZ2F0ZVxcXCIsXFxcIkFORFxcXCIsXFxcIk9SXFxcIixcXFwiTk9UXFxcIixcXFwiaWRcXFwiLFxcXCJuYW1lXFxcIixcXFwiZW1haWxcXFwiLFxcXCJwYXNzd29yZFxcXCIsXFxcImdvb2dsZUlkXFxcIixcXFwicGhvbmVcXFwiLFxcXCJhdmF0YXJVcmxcXFwiLFxcXCJSb2xlXFxcIixcXFwicm9sZVxcXCIsXFxcIlVzZXJTdGF0dXNcXFwiLFxcXCJzdGF0dXNcXFwiLFxcXCJBdXRoUHJvdmlkZXJcXFwiLFxcXCJhdXRoUHJvdmlkZXJcXFwiLFxcXCJlbWFpbFZlcmlmaWVkXFxcIixcXFwiaXNEZWxldGVkXFxcIixcXFwidG9rZW5WZXJzaW9uXFxcIixcXFwiY3JlYXRlZEF0XFxcIixcXFwidXBkYXRlZEF0XFxcIixcXFwiZXF1YWxzXFxcIixcXFwiaW5cXFwiLFxcXCJub3RJblxcXCIsXFxcImx0XFxcIixcXFwibHRlXFxcIixcXFwiZ3RcXFwiLFxcXCJndGVcXFwiLFxcXCJub3RcXFwiLFxcXCJjb250YWluc1xcXCIsXFxcInN0YXJ0c1dpdGhcXFwiLFxcXCJlbmRzV2l0aFxcXCIsXFxcImV2ZXJ5XFxcIixcXFwic29tZVxcXCIsXFxcIm5vbmVcXFwiLFxcXCJ0aXRsZVxcXCIsXFxcInNsdWdcXFwiLFxcXCJkZXNjcmlwdGlvblxcXCIsXFxcImxvY2F0aW9uXFxcIixcXFwicHJpY2VcXFwiLFxcXCJkdXJhdGlvblxcXCIsXFxcInJhdGluZ1xcXCIsXFxcImltYWdlc1xcXCIsXFxcIlBhY2thZ2VTdGF0dXNcXFwiLFxcXCJjYXRlZ29yeUlkXFxcIixcXFwiYWdlbnRJZFxcXCIsXFxcImhhc1xcXCIsXFxcImhhc0V2ZXJ5XFxcIixcXFwiaGFzU29tZVxcXCIsXFxcImNvbW1lbnRcXFwiLFxcXCJ1c2VySWRcXFwiLFxcXCJwYWNrYWdlSWRcXFwiLFxcXCJib29raW5nSWRcXFwiLFxcXCJ0cmFuSWRcXFwiLFxcXCJ2YWxJZFxcXCIsXFxcImFtb3VudFxcXCIsXFxcImN1cnJlbmN5XFxcIixcXFwiUGF5bWVudFN0YXR1c1xcXCIsXFxcImdhdGV3YXlQYWdlVXJsXFxcIixcXFwic3NsU2Vzc2lvbktleVxcXCIsXFxcImNhcmRUeXBlXFxcIixcXFwiYmFua1RyYW5JZFxcXCIsXFxcInBhaWRBdFxcXCIsXFxcInJlZnVuZFJlZklkXFxcIixcXFwicmVmdW5kZWRBdFxcXCIsXFxcInN1YmplY3RcXFwiLFxcXCJtZXNzYWdlXFxcIixcXFwiaXNSZXNvbHZlZFxcXCIsXFxcInRyYXZlbERhdGVcXFwiLFxcXCJ0cmF2ZWxlcnNcXFwiLFxcXCJ0b3RhbFByaWNlXFxcIixcXFwiQm9va2luZ1N0YXR1c1xcXCIsXFxcImV4Y2VycHRcXFwiLFxcXCJjb250ZW50XFxcIixcXFwiY292ZXJJbWFnZVxcXCIsXFxcIlBvc3RTdGF0dXNcXFwiLFxcXCJhdXRob3JJZFxcXCIsXFxcInVzZXJJZF9wYWNrYWdlSWRcXFwiLFxcXCJpc1xcXCIsXFxcImlzTm90XFxcIixcXFwiY29ubmVjdE9yQ3JlYXRlXFxcIixcXFwidXBzZXJ0XFxcIixcXFwiY3JlYXRlTWFueVxcXCIsXFxcInNldFxcXCIsXFxcImRpc2Nvbm5lY3RcXFwiLFxcXCJkZWxldGVcXFwiLFxcXCJjb25uZWN0XFxcIixcXFwidXBkYXRlTWFueVxcXCIsXFxcImRlbGV0ZU1hbnlcXFwiLFxcXCJwdXNoXFxcIixcXFwiaW5jcmVtZW50XFxcIixcXFwiZGVjcmVtZW50XFxcIixcXFwibXVsdGlwbHlcXFwiLFxcXCJkaXZpZGVcXFwiXVwiKSxcbiAgZ3JhcGg6IFwibEFSUGdBRVBEZ0FBb1FJQUlKY0JBQUNmQWdBd21BRUFBQm9BRUprQkFBQ2ZBZ0F3bWdFQkFBQUFBYVFCQUFDZ0F1TUJJcWdCSUFENkFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlib0JBUUQxQVFBaHV3RUJBQUFBQWQ4QkFRRDFBUUFoNEFFQkFQVUJBQ0hoQVFFQTlRRUFJZU1CQVFEMUFRQWhBUUFBQUFFQUlCWUZBQUN3QWdBZ0JnQUFvUUlBSUFzQUFQNEJBQ0FNQUFEX0FRQWdsd0VBQUswQ0FEQ1lBUUFBQXdBUW1RRUFBSzBDQURDYUFRRUE5UUVBSWFRQkFBQ3ZBc01CSXFnQklBRDZBUUFocWdGQUFQd0JBQ0dyQVVBQV9BRUFJYm9CQVFEMUFRQWh1d0VCQVBVQkFDRzhBUUVBOVFFQUliMEJBUUQxQVFBaHZnRVFBS1lDQUNHX0FRSUEtd0VBSWNBQkNBQ3VBZ0Fod1FFQUFJUUNBQ0REQVFFQTlRRUFJY1FCQVFEMUFRQWhCQVVBQU9RREFDQUdBQURnQXdBZ0N3QUFyd01BSUF3QUFMQURBQ0FXQlFBQXNBSUFJQVlBQUtFQ0FDQUxBQUQtQVFBZ0RBQUFfd0VBSUpjQkFBQ3RBZ0F3bUFFQUFBTUFFSmtCQUFDdEFnQXdtZ0VCQUFBQUFhUUJBQUN2QXNNQklxZ0JJQUQ2QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJvQkFRRDFBUUFodXdFQkFBQUFBYndCQVFEMUFRQWh2UUVCQVBVQkFDRy1BUkFBcGdJQUliOEJBZ0Q3QVFBaHdBRUlBSzRDQUNIQkFRQUFoQUlBSU1NQkFRRDFBUUFoeEFFQkFQVUJBQ0VEQUFBQUF3QWdBUUFBQkFBd0FnQUFCUUFnQXdBQUFBTUFJQUVBQUFRQU1BSUFBQVVBSUFFQUFBQURBQ0FQQndBQW9RSUFJQWdBQUtRQ0FDQUtBQUNzQWdBZ2x3RUFBS29DQURDWUFRQUFDUUFRbVFFQUFLb0NBRENhQVFFQTlRRUFJYVFCQUFDckF0OEJJcW9CUUFEOEFRQWhxd0ZBQVB3QkFDSEpBUUVBOVFFQUljb0JBUUQxQVFBaDJ3RkFBUHdCQUNIY0FRSUEtd0VBSWQwQkVBQ21BZ0FoQXdjQUFPQURBQ0FJQUFEaEF3QWdDZ0FBNHdNQUlBOEhBQUNoQWdBZ0NBQUFwQUlBSUFvQUFLd0NBQ0NYQVFBQXFnSUFNSmdCQUFBSkFCQ1pBUUFBcWdJQU1Kb0JBUUFBQUFHa0FRQUFxd0xmQVNLcUFVQUFfQUVBSWFzQlFBRDhBUUFoeVFFQkFQVUJBQ0hLQVFFQTlRRUFJZHNCUUFEOEFRQWgzQUVDQVBzQkFDSGRBUkFBcGdJQUlRTUFBQUFKQUNBQkFBQUtBREFDQUFBTEFDQVVDUUFBcVFJQUlKY0JBQUNsQWdBd21BRUFBQTBBRUprQkFBQ2xBZ0F3bWdFQkFQVUJBQ0drQVFBQXB3TFJBU0txQVVBQV9BRUFJYXNCUUFEOEFRQWh5d0VCQVBVQkFDSE1BUUVBOVFFQUljMEJBUUQyQVFBaHpnRVFBS1lDQUNIUEFRRUE5UUVBSWRFQkFRRDJBUUFoMGdFQkFQWUJBQ0hUQVFFQTlnRUFJZFFCQVFEMkFRQWgxUUZBQUtnQ0FDSFdBUUVBOWdFQUlkY0JRQUNvQWdBaENRa0FBT0lEQUNETkFRQUFzUUlBSU5FQkFBQ3hBZ0FnMGdFQUFMRUNBQ0RUQVFBQXNRSUFJTlFCQUFDeEFnQWcxUUVBQUxFQ0FDRFdBUUFBc1FJQUlOY0JBQUN4QWdBZ0ZBa0FBS2tDQUNDWEFRQUFwUUlBTUpnQkFBQU5BQkNaQVFBQXBRSUFNSm9CQVFBQUFBR2tBUUFBcHdMUkFTS3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHl3RUJBUFVCQUNITUFRRUFBQUFCelFFQkFQWUJBQ0hPQVJBQXBnSUFJYzhCQVFEMUFRQWgwUUVCQVBZQkFDSFNBUUVBOWdFQUlkTUJBUUQyQVFBaDFBRUJBUFlCQUNIVkFVQUFxQUlBSWRZQkFRRDJBUUFoMXdGQUFLZ0NBQ0VEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQVFBQUFBMEFJQXdIQUFDaEFnQWdDQUFBcEFJQUlKY0JBQUNqQWdBd21BRUFBQklBRUprQkFBQ2pBZ0F3bWdFQkFQVUJBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWh3QUVDQVBzQkFDSElBUUVBOVFFQUlja0JBUUQxQVFBaHlnRUJBUFVCQUNFQ0J3QUE0QU1BSUFnQUFPRURBQ0FOQndBQW9RSUFJQWdBQUtRQ0FDQ1hBUUFBb3dJQU1KZ0JBQUFTQUJDWkFRQUFvd0lBTUpvQkFRQUFBQUdxQVVBQV9BRUFJYXNCUUFEOEFRQWh3QUVDQVBzQkFDSElBUUVBOVFFQUlja0JBUUQxQVFBaHlnRUJBUFVCQUNIa0FRQUFvZ0lBSUFNQUFBQVNBQ0FCQUFBVEFEQUNBQUFVQUNBQkFBQUFDUUFnQVFBQUFCSUFJQU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FEQUFBQUVnQWdBUUFBRXdBd0FnQUFGQUFnRHc0QUFLRUNBQ0NYQVFBQW53SUFNSmdCQUFBYUFCQ1pBUUFBbndJQU1Kb0JBUUQxQVFBaHBBRUFBS0FDNHdFaXFBRWdBUG9CQUNHcUFVQUFfQUVBSWFzQlFBRDhBUUFodWdFQkFQVUJBQ0c3QVFFQTlRRUFJZDhCQVFEMUFRQWg0QUVCQVBVQkFDSGhBUUVBOVFFQUllTUJBUUQxQVFBaEFRNEFBT0FEQUNBREFBQUFHZ0FnQVFBQUd3QXdBZ0FBQVFBZ0FRQUFBQU1BSUFFQUFBQUpBQ0FCQUFBQUVnQWdBUUFBQUJvQUlBRUFBQUFCQUNBREFBQUFHZ0FnQVFBQUd3QXdBZ0FBQVFBZ0F3QUFBQm9BSUFFQUFCc0FNQUlBQUFFQUlBTUFBQUFhQUNBQkFBQWJBREFDQUFBQkFDQU1EZ0FBM3dNQUlKb0JBUUFBQUFHa0FRQUFBT01CQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCM3dFQkFBQUFBZUFCQVFBQUFBSGhBUUVBQUFBQjR3RUJBQUFBQVFFVUFBQWxBQ0FMbWdFQkFBQUFBYVFCQUFBQTR3RUNxQUVnQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCdWdFQkFBQUFBYnNCQVFBQUFBSGZBUUVBQUFBQjRBRUJBQUFBQWVFQkFRQUFBQUhqQVFFQUFBQUJBUlFBQUNjQU1BRVVBQUFuQURBTURnQUEzZ01BSUpvQkFRQzNBZ0FocEFFQUFNMEM0d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlkOEJBUUMzQWdBaDRBRUJBTGNDQUNIaEFRRUF0d0lBSWVNQkFRQzNBZ0FoQWdBQUFBRUFJQlFBQUNvQUlBdWFBUUVBdHdJQUlhUUJBQUROQXVNQklxZ0JJQUM4QWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSWJvQkFRQzNBZ0FodXdFQkFMY0NBQ0hmQVFFQXR3SUFJZUFCQVFDM0FnQWg0UUVCQUxjQ0FDSGpBUUVBdHdJQUlRSUFBQUFhQUNBVUFBQXNBQ0FDQUFBQUdnQWdGQUFBTEFBZ0F3QUFBQUVBSUJzQUFDVUFJQndBQUNvQUlBRUFBQUFCQUNBQkFBQUFHZ0FnQXdRQUFOc0RBQ0FoQUFEZEF3QWdJZ0FBM0FNQUlBNlhBUUFBbXdJQU1KZ0JBQUF6QUJDWkFRQUFtd0lBTUpvQkFRRGFBUUFocEFFQUFKd0M0d0VpcUFFZ0FOOEJBQ0dxQVVBQTRRRUFJYXNCUUFEaEFRQWh1Z0VCQU5vQkFDRzdBUUVBMmdFQUlkOEJBUURhQVFBaDRBRUJBTm9CQUNIaEFRRUEyZ0VBSWVNQkFRRGFBUUFoQXdBQUFCb0FJQUVBQURJQU1DQUFBRE1BSUFNQUFBQWFBQ0FCQUFBYkFEQUNBQUFCQUNBQkFBQUFDd0FnQVFBQUFBc0FJQU1BQUFBSkFDQUJBQUFLQURBQ0FBQUxBQ0FEQUFBQUNRQWdBUUFBQ2dBd0FnQUFDd0FnQXdBQUFBa0FJQUVBQUFvQU1BSUFBQXNBSUF3SEFBQ2tBd0FnQ0FBQV9BSUFJQW9BQVAwQ0FDQ2FBUUVBQUFBQnBBRUFBQURmQVFLcUFVQUFBQUFCcXdGQUFBQUFBY2tCQVFBQUFBSEtBUUVBQUFBQjJ3RkFBQUFBQWR3QkFnQUFBQUhkQVJBQUFBQUJBUlFBQURzQUlBbWFBUUVBQUFBQnBBRUFBQURmQVFLcUFVQUFBQUFCcXdGQUFBQUFBY2tCQVFBQUFBSEtBUUVBQUFBQjJ3RkFBQUFBQWR3QkFnQUFBQUhkQVJBQUFBQUJBUlFBQUQwQU1BRVVBQUE5QURBTUJ3QUFvZ01BSUFnQUFPc0NBQ0FLQUFEc0FnQWdtZ0VCQUxjQ0FDR2tBUUFBNlFMZkFTS3FBVUFBdmdJQUlhc0JRQUMtQWdBaHlRRUJBTGNDQUNIS0FRRUF0d0lBSWRzQlFBQy1BZ0FoM0FFQ0FMMENBQ0hkQVJBQTZBSUFJUUlBQUFBTEFDQVVBQUJBQUNBSm1nRUJBTGNDQUNHa0FRQUE2UUxmQVNLcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoeVFFQkFMY0NBQ0hLQVFFQXR3SUFJZHNCUUFDLUFnQWgzQUVDQUwwQ0FDSGRBUkFBNkFJQUlRSUFBQUFKQUNBVUFBQkNBQ0FDQUFBQUNRQWdGQUFBUWdBZ0F3QUFBQXNBSUJzQUFEc0FJQndBQUVBQUlBRUFBQUFMQUNBQkFBQUFDUUFnQlFRQUFOWURBQ0FoQUFEWkF3QWdJZ0FBMkFNQUlETUFBTmNEQUNBMEFBRGFBd0FnREpjQkFBQ1hBZ0F3bUFFQUFFa0FFSmtCQUFDWEFnQXdtZ0VCQU5vQkFDR2tBUUFBbUFMZkFTS3FBVUFBNFFFQUlhc0JRQURoQVFBaHlRRUJBTm9CQUNIS0FRRUEyZ0VBSWRzQlFBRGhBUUFoM0FFQ0FPQUJBQ0hkQVJBQWdnSUFJUU1BQUFBSkFDQUJBQUJJQURBZ0FBQkpBQ0FEQUFBQUNRQWdBUUFBQ2dBd0FnQUFDd0FnQ1FNQUFQMEJBQ0NYQVFBQWxnSUFNSmdCQUFCUEFCQ1pBUUFBbGdJQU1Kb0JBUUFBQUFHYkFRRUFBQUFCcWdGQUFQd0JBQ0dyQVVBQV9BRUFJYnNCQVFBQUFBRUJBQUFBVEFBZ0FRQUFBRXdBSUFrREFBRDlBUUFnbHdFQUFKWUNBRENZQVFBQVR3QVFtUUVBQUpZQ0FEQ2FBUUVBOVFFQUlac0JBUUQxQVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJzQkFRRDFBUUFoQVFNQUFLNERBQ0FEQUFBQVR3QWdBUUFBVUFBd0FnQUFUQUFnQXdBQUFFOEFJQUVBQUZBQU1BSUFBRXdBSUFNQUFBQlBBQ0FCQUFCUUFEQUNBQUJNQUNBR0F3QUExUU1BSUpvQkFRQUFBQUdiQVFFQUFBQUJxZ0ZBQUFBQUFhc0JRQUFBQUFHN0FRRUFBQUFCQVJRQUFGUUFJQVdhQVFFQUFBQUJtd0VCQUFBQUFhb0JRQUFBQUFHckFVQUFBQUFCdXdFQkFBQUFBUUVVQUFCV0FEQUJGQUFBVmdBd0JnTUFBTXNEQUNDYUFRRUF0d0lBSVpzQkFRQzNBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYnNCQVFDM0FnQWhBZ0FBQUV3QUlCUUFBRmtBSUFXYUFRRUF0d0lBSVpzQkFRQzNBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYnNCQVFDM0FnQWhBZ0FBQUU4QUlCUUFBRnNBSUFJQUFBQlBBQ0FVQUFCYkFDQURBQUFBVEFBZ0d3QUFWQUFnSEFBQVdRQWdBUUFBQUV3QUlBRUFBQUJQQUNBREJBQUF5QU1BSUNFQUFNb0RBQ0FpQUFESkF3QWdDSmNCQUFDVkFnQXdtQUVBQUdJQUVKa0JBQUNWQWdBd21nRUJBTm9CQUNHYkFRRUEyZ0VBSWFvQlFBRGhBUUFocXdGQUFPRUJBQ0c3QVFFQTJnRUFJUU1BQUFCUEFDQUJBQUJoQURBZ0FBQmlBQ0FEQUFBQVR3QWdBUUFBVUFBd0FnQUFUQUFnQzVjQkFBQ1VBZ0F3bUFFQUFHZ0FFSmtCQUFDVUFnQXdtZ0VCQUFBQUFac0JBUUQxQVFBaG5BRUJBUFVCQUNHcUFVQUFfQUVBSWFzQlFBRDhBUUFoMkFFQkFQVUJBQ0haQVFFQTlRRUFJZG9CSUFENkFRQWhBUUFBQUdVQUlBRUFBQUJsQUNBTGx3RUFBSlFDQURDWUFRQUFhQUFRbVFFQUFKUUNBRENhQVFFQTlRRUFJWnNCQVFEMUFRQWhuQUVCQVBVQkFDR3FBVUFBX0FFQUlhc0JRQUQ4QVFBaDJBRUJBUFVCQUNIWkFRRUE5UUVBSWRvQklBRDZBUUFoQUFNQUFBQm9BQ0FCQUFCcEFEQUNBQUJsQUNBREFBQUFhQUFnQVFBQWFRQXdBZ0FBWlFBZ0F3QUFBR2dBSUFFQUFHa0FNQUlBQUdVQUlBaWFBUUVBQUFBQm13RUJBQUFBQVp3QkFRQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFkZ0JBUUFBQUFIWkFRRUFBQUFCMmdFZ0FBQUFBUUVVQUFCdEFDQUltZ0VCQUFBQUFac0JBUUFBQUFHY0FRRUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBSFlBUUVBQUFBQjJRRUJBQUFBQWRvQklBQUFBQUVCRkFBQWJ3QXdBUlFBQUc4QU1BaWFBUUVBdHdJQUlac0JBUUMzQWdBaG5BRUJBTGNDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoMkFFQkFMY0NBQ0haQVFFQXR3SUFJZG9CSUFDOEFnQWhBZ0FBQUdVQUlCUUFBSElBSUFpYUFRRUF0d0lBSVpzQkFRQzNBZ0FobkFFQkFMY0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWgyQUVCQUxjQ0FDSFpBUUVBdHdJQUlkb0JJQUM4QWdBaEFnQUFBR2dBSUJRQUFIUUFJQUlBQUFCb0FDQVVBQUIwQUNBREFBQUFaUUFnR3dBQWJRQWdIQUFBY2dBZ0FRQUFBR1VBSUFFQUFBQm9BQ0FEQkFBQXhRTUFJQ0VBQU1jREFDQWlBQURHQXdBZ0M1Y0JBQUNUQWdBd21BRUFBSHNBRUprQkFBQ1RBZ0F3bWdFQkFOb0JBQ0diQVFFQTJnRUFJWndCQVFEYUFRQWhxZ0ZBQU9FQkFDR3JBVUFBNFFFQUlkZ0JBUURhQVFBaDJRRUJBTm9CQUNIYUFTQUEzd0VBSVFNQUFBQm9BQ0FCQUFCNkFEQWdBQUI3QUNBREFBQUFhQUFnQVFBQWFRQXdBZ0FBWlFBZ0FRQUFBQThBSUFFQUFBQVBBQ0FEQUFBQURRQWdBUUFBRGdBd0FnQUFEd0FnQXdBQUFBMEFJQUVBQUE0QU1BSUFBQThBSUFNQUFBQU5BQ0FCQUFBT0FEQUNBQUFQQUNBUkNRQUF4QU1BSUpvQkFRQUFBQUdrQVFBQUFORUJBcW9CUUFBQUFBR3JBVUFBQUFBQnl3RUJBQUFBQWN3QkFRQUFBQUhOQVFFQUFBQUJ6Z0VRQUFBQUFjOEJBUUFBQUFIUkFRRUFBQUFCMGdFQkFBQUFBZE1CQVFBQUFBSFVBUUVBQUFBQjFRRkFBQUFBQWRZQkFRQUFBQUhYQVVBQUFBQUJBUlFBQUlNQkFDQVFtZ0VCQUFBQUFhUUJBQUFBMFFFQ3FnRkFBQUFBQWFzQlFBQUFBQUhMQVFFQUFBQUJ6QUVCQUFBQUFjMEJBUUFBQUFIT0FSQUFBQUFCendFQkFBQUFBZEVCQVFBQUFBSFNBUUVBQUFBQjB3RUJBQUFBQWRRQkFRQUFBQUhWQVVBQUFBQUIxZ0VCQUFBQUFkY0JRQUFBQUFFQkZBQUFoUUVBTUFFVUFBQ0ZBUUF3RVFrQUFNTURBQ0NhQVFFQXR3SUFJYVFCQUFEM0F0RUJJcW9CUUFDLUFnQWhxd0ZBQUw0Q0FDSExBUUVBdHdJQUljd0JBUUMzQWdBaHpRRUJBTGdDQUNIT0FSQUE2QUlBSWM4QkFRQzNBZ0FoMFFFQkFMZ0NBQ0hTQVFFQXVBSUFJZE1CQVFDNEFnQWgxQUVCQUxnQ0FDSFZBVUFBLUFJQUlkWUJBUUM0QWdBaDF3RkFBUGdDQUNFQ0FBQUFEd0FnRkFBQWlBRUFJQkNhQVFFQXR3SUFJYVFCQUFEM0F0RUJJcW9CUUFDLUFnQWhxd0ZBQUw0Q0FDSExBUUVBdHdJQUljd0JBUUMzQWdBaHpRRUJBTGdDQUNIT0FSQUE2QUlBSWM4QkFRQzNBZ0FoMFFFQkFMZ0NBQ0hTQVFFQXVBSUFJZE1CQVFDNEFnQWgxQUVCQUxnQ0FDSFZBVUFBLUFJQUlkWUJBUUM0QWdBaDF3RkFBUGdDQUNFQ0FBQUFEUUFnRkFBQWlnRUFJQUlBQUFBTkFDQVVBQUNLQVFBZ0F3QUFBQThBSUJzQUFJTUJBQ0FjQUFDSUFRQWdBUUFBQUE4QUlBRUFBQUFOQUNBTkJBQUF2Z01BSUNFQUFNRURBQ0FpQUFEQUF3QWdNd0FBdndNQUlEUUFBTUlEQUNETkFRQUFzUUlBSU5FQkFBQ3hBZ0FnMGdFQUFMRUNBQ0RUQVFBQXNRSUFJTlFCQUFDeEFnQWcxUUVBQUxFQ0FDRFdBUUFBc1FJQUlOY0JBQUN4QWdBZ0U1Y0JBQUNNQWdBd21BRUFBSkVCQUJDWkFRQUFqQUlBTUpvQkFRRGFBUUFocEFFQUFJMEMwUUVpcWdGQUFPRUJBQ0dyQVVBQTRRRUFJY3NCQVFEYUFRQWh6QUVCQU5vQkFDSE5BUUVBMndFQUljNEJFQUNDQWdBaHp3RUJBTm9CQUNIUkFRRUEyd0VBSWRJQkFRRGJBUUFoMHdFQkFOc0JBQ0hVQVFFQTJ3RUFJZFVCUUFDT0FnQWgxZ0VCQU5zQkFDSFhBVUFBamdJQUlRTUFBQUFOQUNBQkFBQ1FBUUF3SUFBQWtRRUFJQU1BQUFBTkFDQUJBQUFPQURBQ0FBQVBBQ0FCQUFBQUZBQWdBUUFBQUJRQUlBTUFBQUFTQUNBQkFBQVRBREFDQUFBVUFDQURBQUFBRWdBZ0FRQUFFd0F3QWdBQUZBQWdBd0FBQUJJQUlBRUFBQk1BTUFJQUFCUUFJQWtIQUFDWkF3QWdDQUFBM1FJQUlKb0JBUUFBQUFHcUFVQUFBQUFCcXdGQUFBQUFBY0FCQWdBQUFBSElBUUVBQUFBQnlRRUJBQUFBQWNvQkFRQUFBQUVCRkFBQW1RRUFJQWVhQVFFQUFBQUJxZ0ZBQUFBQUFhc0JRQUFBQUFIQUFRSUFBQUFCeUFFQkFBQUFBY2tCQVFBQUFBSEtBUUVBQUFBQkFSUUFBSnNCQURBQkZBQUFtd0VBTUFrSEFBQ1hBd0FnQ0FBQTJ3SUFJSm9CQVFDM0FnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljQUJBZ0M5QWdBaHlBRUJBTGNDQUNISkFRRUF0d0lBSWNvQkFRQzNBZ0FoQWdBQUFCUUFJQlFBQUo0QkFDQUhtZ0VCQUxjQ0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaHdBRUNBTDBDQUNISUFRRUF0d0lBSWNrQkFRQzNBZ0FoeWdFQkFMY0NBQ0VDQUFBQUVnQWdGQUFBb0FFQUlBSUFBQUFTQUNBVUFBQ2dBUUFnQXdBQUFCUUFJQnNBQUprQkFDQWNBQUNlQVFBZ0FRQUFBQlFBSUFFQUFBQVNBQ0FGQkFBQXVRTUFJQ0VBQUx3REFDQWlBQUM3QXdBZ013QUF1Z01BSURRQUFMMERBQ0FLbHdFQUFJc0NBRENZQVFBQXB3RUFFSmtCQUFDTEFnQXdtZ0VCQU5vQkFDR3FBVUFBNFFFQUlhc0JRQURoQVFBaHdBRUNBT0FCQUNISUFRRUEyZ0VBSWNrQkFRRGFBUUFoeWdFQkFOb0JBQ0VEQUFBQUVnQWdBUUFBcGdFQU1DQUFBS2NCQUNBREFBQUFFZ0FnQVFBQUV3QXdBZ0FBRkFBZ0FRQUFBQVVBSUFFQUFBQUZBQ0FEQUFBQUF3QWdBUUFBQkFBd0FnQUFCUUFnQXdBQUFBTUFJQUVBQUFRQU1BSUFBQVVBSUFNQUFBQURBQ0FCQUFBRUFEQUNBQUFGQUNBVEJRQUFwd01BSUFZQUFMZ0RBQ0FMQUFDb0F3QWdEQUFBcVFNQUlKb0JBUUFBQUFHa0FRQUFBTU1CQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCdkFFQkFBQUFBYjBCQVFBQUFBRy1BUkFBQUFBQnZ3RUNBQUFBQWNBQkNBQUFBQUhCQVFBQXBnTUFJTU1CQVFBQUFBSEVBUUVBQUFBQkFSUUFBSzhCQUNBUG1nRUJBQUFBQWFRQkFBQUF3d0VDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUc4QVFFQUFBQUJ2UUVCQUFBQUFiNEJFQUFBQUFHX0FRSUFBQUFCd0FFSUFBQUFBY0VCQUFDbUF3QWd3d0VCQUFBQUFjUUJBUUFBQUFFQkZBQUFzUUVBTUFFVUFBQ3hBUUF3RXdVQUFJd0RBQ0FHQUFDM0F3QWdDd0FBalFNQUlBd0FBSTREQUNDYUFRRUF0d0lBSWFRQkFBQ0tBOE1CSXFnQklBQzhBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYm9CQVFDM0FnQWh1d0VCQUxjQ0FDRzhBUUVBdHdJQUliMEJBUUMzQWdBaHZnRVFBT2dDQUNHX0FRSUF2UUlBSWNBQkNBQ0lBd0Fod1FFQUFJa0RBQ0REQVFFQXR3SUFJY1FCQVFDM0FnQWhBZ0FBQUFVQUlCUUFBTFFCQUNBUG1nRUJBTGNDQUNHa0FRQUFpZ1BEQVNLb0FTQUF2QUlBSWFvQlFBQy1BZ0FocXdGQUFMNENBQ0c2QVFFQXR3SUFJYnNCQVFDM0FnQWh2QUVCQUxjQ0FDRzlBUUVBdHdJQUliNEJFQURvQWdBaHZ3RUNBTDBDQUNIQUFRZ0FpQU1BSWNFQkFBQ0pBd0Fnd3dFQkFMY0NBQ0hFQVFFQXR3SUFJUUlBQUFBREFDQVVBQUMyQVFBZ0FnQUFBQU1BSUJRQUFMWUJBQ0FEQUFBQUJRQWdHd0FBcndFQUlCd0FBTFFCQUNBQkFBQUFCUUFnQVFBQUFBTUFJQVVFQUFDeUF3QWdJUUFBdFFNQUlDSUFBTFFEQUNBekFBQ3pBd0FnTkFBQXRnTUFJQktYQVFBQWdRSUFNSmdCQUFDOUFRQVFtUUVBQUlFQ0FEQ2FBUUVBMmdFQUlhUUJBQUNGQXNNQklxZ0JJQURmQVFBaHFnRkFBT0VCQUNHckFVQUE0UUVBSWJvQkFRRGFBUUFodXdFQkFOb0JBQ0c4QVFFQTJnRUFJYjBCQVFEYUFRQWh2Z0VRQUlJQ0FDR19BUUlBNEFFQUljQUJDQUNEQWdBaHdRRUFBSVFDQUNEREFRRUEyZ0VBSWNRQkFRRGFBUUFoQXdBQUFBTUFJQUVBQUx3QkFEQWdBQUM5QVFBZ0F3QUFBQU1BSUFFQUFBUUFNQUlBQUFVQUlCWURBQUQ5QVFBZ0N3QUFfZ0VBSUF3QUFQOEJBQ0FOQUFDQUFnQWdsd0VBQVBRQkFEQ1lBUUFBd3dFQUVKa0JBQUQwQVFBd21nRUJBQUFBQVpzQkFRRDFBUUFobkFFQkFBQUFBWjBCQVFEMkFRQWhuZ0VCQUFBQUFaOEJBUUQyQVFBaG9BRUJBUFlCQUNHaUFRQUE5d0dpQVNLa0FRQUEtQUdrQVNLbUFRQUEtUUdtQVNLbkFTQUEtZ0VBSWFnQklBRDZBUUFocVFFQ0FQc0JBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWhBUUFBQU1BQkFDQUJBQUFBd0FFQUlCWURBQUQ5QVFBZ0N3QUFfZ0VBSUF3QUFQOEJBQ0FOQUFDQUFnQWdsd0VBQVBRQkFEQ1lBUUFBd3dFQUVKa0JBQUQwQVFBd21nRUJBUFVCQUNHYkFRRUE5UUVBSVp3QkFRRDFBUUFoblFFQkFQWUJBQ0dlQVFFQTlnRUFJWjhCQVFEMkFRQWhvQUVCQVBZQkFDR2lBUUFBOXdHaUFTS2tBUUFBLUFHa0FTS21BUUFBLVFHbUFTS25BU0FBLWdFQUlhZ0JJQUQ2QVFBaHFRRUNBUHNCQUNHcUFVQUFfQUVBSWFzQlFBRDhBUUFoQ0FNQUFLNERBQ0FMQUFDdkF3QWdEQUFBc0FNQUlBMEFBTEVEQUNDZEFRQUFzUUlBSUo0QkFBQ3hBZ0FnbndFQUFMRUNBQ0NnQVFBQXNRSUFJQU1BQUFEREFRQWdBUUFBeEFFQU1BSUFBTUFCQUNBREFBQUF3d0VBSUFFQUFNUUJBREFDQUFEQUFRQWdBd0FBQU1NQkFDQUJBQURFQVFBd0FnQUF3QUVBSUJNREFBQ3FBd0FnQ3dBQXF3TUFJQXdBQUt3REFDQU5BQUN0QXdBZ21nRUJBQUFBQVpzQkFRQUFBQUdjQVFFQUFBQUJuUUVCQUFBQUFaNEJBUUFBQUFHZkFRRUFBQUFCb0FFQkFBQUFBYUlCQUFBQW9nRUNwQUVBQUFDa0FRS21BUUFBQUtZQkFxY0JJQUFBQUFHb0FTQUFBQUFCcVFFQ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQkFSUUFBTWdCQUNBUG1nRUJBQUFBQVpzQkFRQUFBQUdjQVFFQUFBQUJuUUVCQUFBQUFaNEJBUUFBQUFHZkFRRUFBQUFCb0FFQkFBQUFBYUlCQUFBQW9nRUNwQUVBQUFDa0FRS21BUUFBQUtZQkFxY0JJQUFBQUFHb0FTQUFBQUFCcVFFQ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQkFSUUFBTW9CQURBQkZBQUF5Z0VBTUJNREFBQ19BZ0FnQ3dBQXdBSUFJQXdBQU1FQ0FDQU5BQURDQWdBZ21nRUJBTGNDQUNHYkFRRUF0d0lBSVp3QkFRQzNBZ0FoblFFQkFMZ0NBQ0dlQVFFQXVBSUFJWjhCQVFDNEFnQWhvQUVCQUxnQ0FDR2lBUUFBdVFLaUFTS2tBUUFBdWdLa0FTS21BUUFBdXdLbUFTS25BU0FBdkFJQUlhZ0JJQUM4QWdBaHFRRUNBTDBDQUNHcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoQWdBQUFNQUJBQ0FVQUFETkFRQWdENW9CQVFDM0FnQWhtd0VCQUxjQ0FDR2NBUUVBdHdJQUlaMEJBUUM0QWdBaG5nRUJBTGdDQUNHZkFRRUF1QUlBSWFBQkFRQzRBZ0Fob2dFQUFMa0NvZ0VpcEFFQUFMb0NwQUVpcGdFQUFMc0NwZ0VpcHdFZ0FMd0NBQ0dvQVNBQXZBSUFJYWtCQWdDOUFnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlRSUFBQUREQVFBZ0ZBQUF6d0VBSUFJQUFBRERBUUFnRkFBQXp3RUFJQU1BQUFEQUFRQWdHd0FBeUFFQUlCd0FBTTBCQUNBQkFBQUF3QUVBSUFFQUFBRERBUUFnQ1FRQUFMSUNBQ0FoQUFDMUFnQWdJZ0FBdEFJQUlETUFBTE1DQUNBMEFBQzJBZ0FnblFFQUFMRUNBQ0NlQVFBQXNRSUFJSjhCQUFDeEFnQWdvQUVBQUxFQ0FDQVNsd0VBQU5rQkFEQ1lBUUFBMWdFQUVKa0JBQURaQVFBd21nRUJBTm9CQUNHYkFRRUEyZ0VBSVp3QkFRRGFBUUFoblFFQkFOc0JBQ0dlQVFFQTJ3RUFJWjhCQVFEYkFRQWhvQUVCQU5zQkFDR2lBUUFBM0FHaUFTS2tBUUFBM1FHa0FTS21BUUFBM2dHbUFTS25BU0FBM3dFQUlhZ0JJQURmQVFBaHFRRUNBT0FCQUNHcUFVQUE0UUVBSWFzQlFBRGhBUUFoQXdBQUFNTUJBQ0FCQUFEVkFRQXdJQUFBMWdFQUlBTUFBQUREQVFBZ0FRQUF4QUVBTUFJQUFNQUJBQ0FTbHdFQUFOa0JBRENZQVFBQTFnRUFFSmtCQUFEWkFRQXdtZ0VCQU5vQkFDR2JBUUVBMmdFQUlad0JBUURhQVFBaG5RRUJBTnNCQUNHZUFRRUEyd0VBSVo4QkFRRGJBUUFob0FFQkFOc0JBQ0dpQVFBQTNBR2lBU0trQVFBQTNRR2tBU0ttQVFBQTNnR21BU0tuQVNBQTN3RUFJYWdCSUFEZkFRQWhxUUVDQU9BQkFDR3FBVUFBNFFFQUlhc0JRQURoQVFBaERnUUFBT01CQUNBaEFBRHpBUUFnSWdBQTh3RUFJS3dCQVFBQUFBR3RBUUVBQUFBRXJnRUJBQUFBQks4QkFRQUFBQUd3QVFFQUFBQUJzUUVCQUFBQUFiSUJBUUFBQUFHekFRRUE4Z0VBSWJRQkFRQUFBQUcxQVFFQUFBQUJ0Z0VCQUFBQUFRNEVBQUR3QVFBZ0lRQUE4UUVBSUNJQUFQRUJBQ0NzQVFFQUFBQUJyUUVCQUFBQUJhNEJBUUFBQUFXdkFRRUFBQUFCc0FFQkFBQUFBYkVCQVFBQUFBR3lBUUVBQUFBQnN3RUJBTzhCQUNHMEFRRUFBQUFCdFFFQkFBQUFBYllCQVFBQUFBRUhCQUFBNHdFQUlDRUFBTzRCQUNBaUFBRHVBUUFnckFFQUFBQ2lBUUt0QVFBQUFLSUJDSzRCQUFBQW9nRUlzd0VBQU8wQm9nRWlCd1FBQU9NQkFDQWhBQURzQVFBZ0lnQUE3QUVBSUt3QkFBQUFwQUVDclFFQUFBQ2tBUWl1QVFBQUFLUUJDTE1CQUFEckFhUUJJZ2NFQUFEakFRQWdJUUFBNmdFQUlDSUFBT29CQUNDc0FRQUFBS1lCQXEwQkFBQUFwZ0VJcmdFQUFBQ21BUWl6QVFBQTZRR21BU0lGQkFBQTR3RUFJQ0VBQU9nQkFDQWlBQURvQVFBZ3JBRWdBQUFBQWJNQklBRG5BUUFoRFFRQUFPTUJBQ0FoQUFEakFRQWdJZ0FBNHdFQUlETUFBT1lCQUNBMEFBRGpBUUFnckFFQ0FBQUFBYTBCQWdBQUFBU3VBUUlBQUFBRXJ3RUNBQUFBQWJBQkFnQUFBQUd4QVFJQUFBQUJzZ0VDQUFBQUFiTUJBZ0RsQVFBaEN3UUFBT01CQUNBaEFBRGtBUUFnSWdBQTVBRUFJS3dCUUFBQUFBR3RBVUFBQUFBRXJnRkFBQUFBQks4QlFBQUFBQUd3QVVBQUFBQUJzUUZBQUFBQUFiSUJRQUFBQUFHekFVQUE0Z0VBSVFzRUFBRGpBUUFnSVFBQTVBRUFJQ0lBQU9RQkFDQ3NBVUFBQUFBQnJRRkFBQUFBQks0QlFBQUFBQVN2QVVBQUFBQUJzQUZBQUFBQUFiRUJRQUFBQUFHeUFVQUFBQUFCc3dGQUFPSUJBQ0VJckFFQ0FBQUFBYTBCQWdBQUFBU3VBUUlBQUFBRXJ3RUNBQUFBQWJBQkFnQUFBQUd4QVFJQUFBQUJzZ0VDQUFBQUFiTUJBZ0RqQVFBaENLd0JRQUFBQUFHdEFVQUFBQUFFcmdGQUFBQUFCSzhCUUFBQUFBR3dBVUFBQUFBQnNRRkFBQUFBQWJJQlFBQUFBQUd6QVVBQTVBRUFJUTBFQUFEakFRQWdJUUFBNHdFQUlDSUFBT01CQUNBekFBRG1BUUFnTkFBQTR3RUFJS3dCQWdBQUFBR3RBUUlBQUFBRXJnRUNBQUFBQks4QkFnQUFBQUd3QVFJQUFBQUJzUUVDQUFBQUFiSUJBZ0FBQUFHekFRSUE1UUVBSVFpc0FRZ0FBQUFCclFFSUFBQUFCSzRCQ0FBQUFBU3ZBUWdBQUFBQnNBRUlBQUFBQWJFQkNBQUFBQUd5QVFnQUFBQUJzd0VJQU9ZQkFDRUZCQUFBNHdFQUlDRUFBT2dCQUNBaUFBRG9BUUFnckFFZ0FBQUFBYk1CSUFEbkFRQWhBcXdCSUFBQUFBR3pBU0FBNkFFQUlRY0VBQURqQVFBZ0lRQUE2Z0VBSUNJQUFPb0JBQ0NzQVFBQUFLWUJBcTBCQUFBQXBnRUlyZ0VBQUFDbUFRaXpBUUFBNlFHbUFTSUVyQUVBQUFDbUFRS3RBUUFBQUtZQkNLNEJBQUFBcGdFSXN3RUFBT29CcGdFaUJ3UUFBT01CQUNBaEFBRHNBUUFnSWdBQTdBRUFJS3dCQUFBQXBBRUNyUUVBQUFDa0FRaXVBUUFBQUtRQkNMTUJBQURyQWFRQklnU3NBUUFBQUtRQkFxMEJBQUFBcEFFSXJnRUFBQUNrQVFpekFRQUE3QUdrQVNJSEJBQUE0d0VBSUNFQUFPNEJBQ0FpQUFEdUFRQWdyQUVBQUFDaUFRS3RBUUFBQUtJQkNLNEJBQUFBb2dFSXN3RUFBTzBCb2dFaUJLd0JBQUFBb2dFQ3JRRUFBQUNpQVFpdUFRQUFBS0lCQ0xNQkFBRHVBYUlCSWc0RUFBRHdBUUFnSVFBQThRRUFJQ0lBQVBFQkFDQ3NBUUVBQUFBQnJRRUJBQUFBQmE0QkFRQUFBQVd2QVFFQUFBQUJzQUVCQUFBQUFiRUJBUUFBQUFHeUFRRUFBQUFCc3dFQkFPOEJBQ0cwQVFFQUFBQUJ0UUVCQUFBQUFiWUJBUUFBQUFFSXJBRUNBQUFBQWEwQkFnQUFBQVd1QVFJQUFBQUZyd0VDQUFBQUFiQUJBZ0FBQUFHeEFRSUFBQUFCc2dFQ0FBQUFBYk1CQWdEd0FRQWhDNndCQVFBQUFBR3RBUUVBQUFBRnJnRUJBQUFBQmE4QkFRQUFBQUd3QVFFQUFBQUJzUUVCQUFBQUFiSUJBUUFBQUFHekFRRUE4UUVBSWJRQkFRQUFBQUcxQVFFQUFBQUJ0Z0VCQUFBQUFRNEVBQURqQVFBZ0lRQUE4d0VBSUNJQUFQTUJBQ0NzQVFFQUFBQUJyUUVCQUFBQUJLNEJBUUFBQUFTdkFRRUFBQUFCc0FFQkFBQUFBYkVCQVFBQUFBR3lBUUVBQUFBQnN3RUJBUElCQUNHMEFRRUFBQUFCdFFFQkFBQUFBYllCQVFBQUFBRUxyQUVCQUFBQUFhMEJBUUFBQUFTdUFRRUFBQUFFcndFQkFBQUFBYkFCQVFBQUFBR3hBUUVBQUFBQnNnRUJBQUFBQWJNQkFRRHpBUUFodEFFQkFBQUFBYlVCQVFBQUFBRzJBUUVBQUFBQkZnTUFBUDBCQUNBTEFBRC1BUUFnREFBQV93RUFJQTBBQUlBQ0FDQ1hBUUFBOUFFQU1KZ0JBQUREQVFBUW1RRUFBUFFCQURDYUFRRUE5UUVBSVpzQkFRRDFBUUFobkFFQkFQVUJBQ0dkQVFFQTlnRUFJWjRCQVFEMkFRQWhud0VCQVBZQkFDR2dBUUVBOWdFQUlhSUJBQUQzQWFJQklxUUJBQUQ0QWFRQklxWUJBQUQ1QWFZQklxY0JJQUQ2QVFBaHFBRWdBUG9CQUNHcEFRSUEtd0VBSWFvQlFBRDhBUUFocXdGQUFQd0JBQ0VMckFFQkFBQUFBYTBCQVFBQUFBU3VBUUVBQUFBRXJ3RUJBQUFBQWJBQkFRQUFBQUd4QVFFQUFBQUJzZ0VCQUFBQUFiTUJBUUR6QVFBaHRBRUJBQUFBQWJVQkFRQUFBQUcyQVFFQUFBQUJDNndCQVFBQUFBR3RBUUVBQUFBRnJnRUJBQUFBQmE4QkFRQUFBQUd3QVFFQUFBQUJzUUVCQUFBQUFiSUJBUUFBQUFHekFRRUE4UUVBSWJRQkFRQUFBQUcxQVFFQUFBQUJ0Z0VCQUFBQUFRU3NBUUFBQUtJQkFxMEJBQUFBb2dFSXJnRUFBQUNpQVFpekFRQUE3Z0dpQVNJRXJBRUFBQUNrQVFLdEFRQUFBS1FCQ0s0QkFBQUFwQUVJc3dFQUFPd0JwQUVpQkt3QkFBQUFwZ0VDclFFQUFBQ21BUWl1QVFBQUFLWUJDTE1CQUFEcUFhWUJJZ0tzQVNBQUFBQUJzd0VnQU9nQkFDRUlyQUVDQUFBQUFhMEJBZ0FBQUFTdUFRSUFBQUFFcndFQ0FBQUFBYkFCQWdBQUFBR3hBUUlBQUFBQnNnRUNBQUFBQWJNQkFnRGpBUUFoQ0t3QlFBQUFBQUd0QVVBQUFBQUVyZ0ZBQUFBQUJLOEJRQUFBQUFHd0FVQUFBQUFCc1FGQUFBQUFBYklCUUFBQUFBR3pBVUFBNUFFQUlRTzNBUUFBQXdBZ3VBRUFBQU1BSUxrQkFBQURBQ0FEdHdFQUFBa0FJTGdCQUFBSkFDQzVBUUFBQ1FBZ0E3Y0JBQUFTQUNDNEFRQUFFZ0FndVFFQUFCSUFJQU8zQVFBQUdnQWd1QUVBQUJvQUlMa0JBQUFhQUNBU2x3RUFBSUVDQURDWUFRQUF2UUVBRUprQkFBQ0JBZ0F3bWdFQkFOb0JBQ0drQVFBQWhRTERBU0tvQVNBQTN3RUFJYW9CUUFEaEFRQWhxd0ZBQU9FQkFDRzZBUUVBMmdFQUlic0JBUURhQVFBaHZBRUJBTm9CQUNHOUFRRUEyZ0VBSWI0QkVBQ0NBZ0FodndFQ0FPQUJBQ0hBQVFnQWd3SUFJY0VCQUFDRUFnQWd3d0VCQU5vQkFDSEVBUUVBMmdFQUlRMEVBQURqQVFBZ0lRQUFpZ0lBSUNJQUFJb0NBQ0F6QUFDS0FnQWdOQUFBaWdJQUlLd0JFQUFBQUFHdEFSQUFBQUFFcmdFUUFBQUFCSzhCRUFBQUFBR3dBUkFBQUFBQnNRRVFBQUFBQWJJQkVBQUFBQUd6QVJBQWlRSUFJUTBFQUFEakFRQWdJUUFBNWdFQUlDSUFBT1lCQUNBekFBRG1BUUFnTkFBQTVnRUFJS3dCQ0FBQUFBR3RBUWdBQUFBRXJnRUlBQUFBQks4QkNBQUFBQUd3QVFnQUFBQUJzUUVJQUFBQUFiSUJDQUFBQUFHekFRZ0FpQUlBSVFTc0FRRUFBQUFGeFFFQkFBQUFBY1lCQVFBQUFBVEhBUUVBQUFBRUJ3UUFBT01CQUNBaEFBQ0hBZ0FnSWdBQWh3SUFJS3dCQUFBQXd3RUNyUUVBQUFEREFRaXVBUUFBQU1NQkNMTUJBQUNHQXNNQklnY0VBQURqQVFBZ0lRQUFod0lBSUNJQUFJY0NBQ0NzQVFBQUFNTUJBcTBCQUFBQXd3RUlyZ0VBQUFEREFRaXpBUUFBaGdMREFTSUVyQUVBQUFEREFRS3RBUUFBQU1NQkNLNEJBQUFBd3dFSXN3RUFBSWNDd3dFaURRUUFBT01CQUNBaEFBRG1BUUFnSWdBQTVnRUFJRE1BQU9ZQkFDQTBBQURtQVFBZ3JBRUlBQUFBQWEwQkNBQUFBQVN1QVFnQUFBQUVyd0VJQUFBQUFiQUJDQUFBQUFHeEFRZ0FBQUFCc2dFSUFBQUFBYk1CQ0FDSUFnQWhEUVFBQU9NQkFDQWhBQUNLQWdBZ0lnQUFpZ0lBSURNQUFJb0NBQ0EwQUFDS0FnQWdyQUVRQUFBQUFhMEJFQUFBQUFTdUFSQUFBQUFFcndFUUFBQUFBYkFCRUFBQUFBR3hBUkFBQUFBQnNnRVFBQUFBQWJNQkVBQ0pBZ0FoQ0t3QkVBQUFBQUd0QVJBQUFBQUVyZ0VRQUFBQUJLOEJFQUFBQUFHd0FSQUFBQUFCc1FFUUFBQUFBYklCRUFBQUFBR3pBUkFBaWdJQUlRcVhBUUFBaXdJQU1KZ0JBQUNuQVFBUW1RRUFBSXNDQURDYUFRRUEyZ0VBSWFvQlFBRGhBUUFocXdGQUFPRUJBQ0hBQVFJQTRBRUFJY2dCQVFEYUFRQWh5UUVCQU5vQkFDSEtBUUVBMmdFQUlST1hBUUFBakFJQU1KZ0JBQUNSQVFBUW1RRUFBSXdDQURDYUFRRUEyZ0VBSWFRQkFBQ05BdEVCSXFvQlFBRGhBUUFocXdGQUFPRUJBQ0hMQVFFQTJnRUFJY3dCQVFEYUFRQWh6UUVCQU5zQkFDSE9BUkFBZ2dJQUljOEJBUURhQVFBaDBRRUJBTnNCQUNIU0FRRUEyd0VBSWRNQkFRRGJBUUFoMUFFQkFOc0JBQ0hWQVVBQWpnSUFJZFlCQVFEYkFRQWgxd0ZBQUk0Q0FDRUhCQUFBNHdFQUlDRUFBSklDQUNBaUFBQ1NBZ0FnckFFQUFBRFJBUUt0QVFBQUFORUJDSzRCQUFBQTBRRUlzd0VBQUpFQzBRRWlDd1FBQVBBQkFDQWhBQUNRQWdBZ0lnQUFrQUlBSUt3QlFBQUFBQUd0QVVBQUFBQUZyZ0ZBQUFBQUJhOEJRQUFBQUFHd0FVQUFBQUFCc1FGQUFBQUFBYklCUUFBQUFBR3pBVUFBandJQUlRc0VBQUR3QVFBZ0lRQUFrQUlBSUNJQUFKQUNBQ0NzQVVBQUFBQUJyUUZBQUFBQUJhNEJRQUFBQUFXdkFVQUFBQUFCc0FGQUFBQUFBYkVCUUFBQUFBR3lBVUFBQUFBQnN3RkFBSThDQUNFSXJBRkFBQUFBQWEwQlFBQUFBQVd1QVVBQUFBQUZyd0ZBQUFBQUFiQUJRQUFBQUFHeEFVQUFBQUFCc2dGQUFBQUFBYk1CUUFDUUFnQWhCd1FBQU9NQkFDQWhBQUNTQWdBZ0lnQUFrZ0lBSUt3QkFBQUEwUUVDclFFQUFBRFJBUWl1QVFBQUFORUJDTE1CQUFDUkF0RUJJZ1NzQVFBQUFORUJBcTBCQUFBQTBRRUlyZ0VBQUFEUkFRaXpBUUFBa2dMUkFTSUxsd0VBQUpNQ0FEQ1lBUUFBZXdBUW1RRUFBSk1DQURDYUFRRUEyZ0VBSVpzQkFRRGFBUUFobkFFQkFOb0JBQ0dxQVVBQTRRRUFJYXNCUUFEaEFRQWgyQUVCQU5vQkFDSFpBUUVBMmdFQUlkb0JJQURmQVFBaEM1Y0JBQUNVQWdBd21BRUFBR2dBRUprQkFBQ1VBZ0F3bWdFQkFQVUJBQ0diQVFFQTlRRUFJWndCQVFEMUFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlkZ0JBUUQxQVFBaDJRRUJBUFVCQUNIYUFTQUEtZ0VBSVFpWEFRQUFsUUlBTUpnQkFBQmlBQkNaQVFBQWxRSUFNSm9CQVFEYUFRQWhtd0VCQU5vQkFDR3FBVUFBNFFFQUlhc0JRQURoQVFBaHV3RUJBTm9CQUNFSkF3QUFfUUVBSUpjQkFBQ1dBZ0F3bUFFQUFFOEFFSmtCQUFDV0FnQXdtZ0VCQVBVQkFDR2JBUUVBOVFFQUlhb0JRQUQ4QVFBaHF3RkFBUHdCQUNHN0FRRUE5UUVBSVF5WEFRQUFsd0lBTUpnQkFBQkpBQkNaQVFBQWx3SUFNSm9CQVFEYUFRQWhwQUVBQUpnQzN3RWlxZ0ZBQU9FQkFDR3JBVUFBNFFFQUlja0JBUURhQVFBaHlnRUJBTm9CQUNIYkFVQUE0UUVBSWR3QkFnRGdBUUFoM1FFUUFJSUNBQ0VIQkFBQTR3RUFJQ0VBQUpvQ0FDQWlBQUNhQWdBZ3JBRUFBQURmQVFLdEFRQUFBTjhCQ0s0QkFBQUEzd0VJc3dFQUFKa0Mzd0VpQndRQUFPTUJBQ0FoQUFDYUFnQWdJZ0FBbWdJQUlLd0JBQUFBM3dFQ3JRRUFBQURmQVFpdUFRQUFBTjhCQ0xNQkFBQ1pBdDhCSWdTc0FRQUFBTjhCQXEwQkFBQUEzd0VJcmdFQUFBRGZBUWl6QVFBQW1nTGZBU0lPbHdFQUFKc0NBRENZQVFBQU13QVFtUUVBQUpzQ0FEQ2FBUUVBMmdFQUlhUUJBQUNjQXVNQklxZ0JJQURmQVFBaHFnRkFBT0VCQUNHckFVQUE0UUVBSWJvQkFRRGFBUUFodXdFQkFOb0JBQ0hmQVFFQTJnRUFJZUFCQVFEYUFRQWg0UUVCQU5vQkFDSGpBUUVBMmdFQUlRY0VBQURqQVFBZ0lRQUFuZ0lBSUNJQUFKNENBQ0NzQVFBQUFPTUJBcTBCQUFBQTR3RUlyZ0VBQUFEakFRaXpBUUFBblFMakFTSUhCQUFBNHdFQUlDRUFBSjRDQUNBaUFBQ2VBZ0FnckFFQUFBRGpBUUt0QVFBQUFPTUJDSzRCQUFBQTR3RUlzd0VBQUowQzR3RWlCS3dCQUFBQTR3RUNyUUVBQUFEakFRaXVBUUFBQU9NQkNMTUJBQUNlQXVNQklnOE9BQUNoQWdBZ2x3RUFBSjhDQURDWUFRQUFHZ0FRbVFFQUFKOENBRENhQVFFQTlRRUFJYVFCQUFDZ0F1TUJJcWdCSUFENkFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlib0JBUUQxQVFBaHV3RUJBUFVCQUNIZkFRRUE5UUVBSWVBQkFRRDFBUUFoNFFFQkFQVUJBQ0hqQVFFQTlRRUFJUVNzQVFBQUFPTUJBcTBCQUFBQTR3RUlyZ0VBQUFEakFRaXpBUUFBbmdMakFTSVlBd0FBX1FFQUlBc0FBUDRCQUNBTUFBRF9BUUFnRFFBQWdBSUFJSmNCQUFEMEFRQXdtQUVBQU1NQkFCQ1pBUUFBOUFFQU1Kb0JBUUQxQVFBaG13RUJBUFVCQUNHY0FRRUE5UUVBSVowQkFRRDJBUUFobmdFQkFQWUJBQ0dmQVFFQTlnRUFJYUFCQVFEMkFRQWhvZ0VBQVBjQm9nRWlwQUVBQVBnQnBBRWlwZ0VBQVBrQnBnRWlwd0VnQVBvQkFDR29BU0FBLWdFQUlha0JBZ0Q3QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWVVQkFBRERBUUFnNWdFQUFNTUJBQ0FDeVFFQkFBQUFBY29CQVFBQUFBRU1Cd0FBb1FJQUlBZ0FBS1FDQUNDWEFRQUFvd0lBTUpnQkFBQVNBQkNaQVFBQW93SUFNSm9CQVFEMUFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUljQUJBZ0Q3QVFBaHlBRUJBUFVCQUNISkFRRUE5UUVBSWNvQkFRRDFBUUFoR0FVQUFMQUNBQ0FHQUFDaEFnQWdDd0FBX2dFQUlBd0FBUDhCQUNDWEFRQUFyUUlBTUpnQkFBQURBQkNaQVFBQXJRSUFNSm9CQVFEMUFRQWhwQUVBQUs4Q3d3RWlxQUVnQVBvQkFDR3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHVnRUJBUFVCQUNHN0FRRUE5UUVBSWJ3QkFRRDFBUUFodlFFQkFQVUJBQ0ctQVJBQXBnSUFJYjhCQWdEN0FRQWh3QUVJQUs0Q0FDSEJBUUFBaEFJQUlNTUJBUUQxQVFBaHhBRUJBUFVCQUNIbEFRQUFBd0FnNWdFQUFBTUFJQlFKQUFDcEFnQWdsd0VBQUtVQ0FEQ1lBUUFBRFFBUW1RRUFBS1VDQURDYUFRRUE5UUVBSWFRQkFBQ25BdEVCSXFvQlFBRDhBUUFocXdGQUFQd0JBQ0hMQVFFQTlRRUFJY3dCQVFEMUFRQWh6UUVCQVBZQkFDSE9BUkFBcGdJQUljOEJBUUQxQVFBaDBRRUJBUFlCQUNIU0FRRUE5Z0VBSWRNQkFRRDJBUUFoMUFFQkFQWUJBQ0hWQVVBQXFBSUFJZFlCQVFEMkFRQWgxd0ZBQUtnQ0FDRUlyQUVRQUFBQUFhMEJFQUFBQUFTdUFSQUFBQUFFcndFUUFBQUFBYkFCRUFBQUFBR3hBUkFBQUFBQnNnRVFBQUFBQWJNQkVBQ0tBZ0FoQkt3QkFBQUEwUUVDclFFQUFBRFJBUWl1QVFBQUFORUJDTE1CQUFDU0F0RUJJZ2lzQVVBQUFBQUJyUUZBQUFBQUJhNEJRQUFBQUFXdkFVQUFBQUFCc0FGQUFBQUFBYkVCUUFBQUFBR3lBVUFBQUFBQnN3RkFBSkFDQUNFUkJ3QUFvUUlBSUFnQUFLUUNBQ0FLQUFDc0FnQWdsd0VBQUtvQ0FEQ1lBUUFBQ1FBUW1RRUFBS29DQURDYUFRRUE5UUVBSWFRQkFBQ3JBdDhCSXFvQlFBRDhBUUFocXdGQUFQd0JBQ0hKQVFFQTlRRUFJY29CQVFEMUFRQWgyd0ZBQVB3QkFDSGNBUUlBLXdFQUlkMEJFQUNtQWdBaDVRRUFBQWtBSU9ZQkFBQUpBQ0FQQndBQW9RSUFJQWdBQUtRQ0FDQUtBQUNzQWdBZ2x3RUFBS29DQURDWUFRQUFDUUFRbVFFQUFLb0NBRENhQVFFQTlRRUFJYVFCQUFDckF0OEJJcW9CUUFEOEFRQWhxd0ZBQVB3QkFDSEpBUUVBOVFFQUljb0JBUUQxQVFBaDJ3RkFBUHdCQUNIY0FRSUEtd0VBSWQwQkVBQ21BZ0FoQkt3QkFBQUEzd0VDclFFQUFBRGZBUWl1QVFBQUFOOEJDTE1CQUFDYUF0OEJJZ08zQVFBQURRQWd1QUVBQUEwQUlMa0JBQUFOQUNBV0JRQUFzQUlBSUFZQUFLRUNBQ0FMQUFELUFRQWdEQUFBX3dFQUlKY0JBQUN0QWdBd21BRUFBQU1BRUprQkFBQ3RBZ0F3bWdFQkFQVUJBQ0drQVFBQXJ3TERBU0tvQVNBQS1nRUFJYW9CUUFEOEFRQWhxd0ZBQVB3QkFDRzZBUUVBOVFFQUlic0JBUUQxQVFBaHZBRUJBUFVCQUNHOUFRRUE5UUVBSWI0QkVBQ21BZ0FodndFQ0FQc0JBQ0hBQVFnQXJnSUFJY0VCQUFDRUFnQWd3d0VCQVBVQkFDSEVBUUVBOVFFQUlRaXNBUWdBQUFBQnJRRUlBQUFBQks0QkNBQUFBQVN2QVFnQUFBQUJzQUVJQUFBQUFiRUJDQUFBQUFHeUFRZ0FBQUFCc3dFSUFPWUJBQ0VFckFFQUFBRERBUUt0QVFBQUFNTUJDSzRCQUFBQXd3RUlzd0VBQUljQ3d3RWlDd01BQVAwQkFDQ1hBUUFBbGdJQU1KZ0JBQUJQQUJDWkFRQUFsZ0lBTUpvQkFRRDFBUUFobXdFQkFQVUJBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWh1d0VCQVBVQkFDSGxBUUFBVHdBZzVnRUFBRThBSUFBQUFBQUFBQUhxQVFFQUFBQUJBZW9CQVFBQUFBRUI2Z0VBQUFDaUFRSUI2Z0VBQUFDa0FRSUI2Z0VBQUFDbUFRSUI2Z0VnQUFBQUFRWHFBUUlBQUFBQjhRRUNBQUFBQWZJQkFnQUFBQUh6QVFJQUFBQUI5QUVDQUFBQUFRSHFBVUFBQUFBQkN4c0FBUDRDQURBY0FBQ0RBd0F3NXdFQUFQOENBRERvQVFBQWdBTUFNT2tCQUFDQkF3QWc2Z0VBQUlJREFERHJBUUFBZ2dNQU1Pd0JBQUNDQXdBdzdRRUFBSUlEQUREdUFRQUFoQU1BTU84QkFBQ0ZBd0F3Q3hzQUFONENBREFjQUFEakFnQXc1d0VBQU44Q0FERG9BUUFBNEFJQU1Pa0JBQURoQWdBZzZnRUFBT0lDQUREckFRQUE0Z0lBTU93QkFBRGlBZ0F3N1FFQUFPSUNBRER1QVFBQTVBSUFNTzhCQUFEbEFnQXdDeHNBQU5BQ0FEQWNBQURWQWdBdzV3RUFBTkVDQUREb0FRQUEwZ0lBTU9rQkFBRFRBZ0FnNmdFQUFOUUNBRERyQVFBQTFBSUFNT3dCQUFEVUFnQXc3UUVBQU5RQ0FERHVBUUFBMWdJQU1POEJBQURYQWdBd0N4c0FBTU1DQURBY0FBRElBZ0F3NXdFQUFNUUNBRERvQVFBQXhRSUFNT2tCQUFER0FnQWc2Z0VBQU1jQ0FERHJBUUFBeHdJQU1Pd0JBQURIQWdBdzdRRUFBTWNDQUREdUFRQUF5UUlBTU84QkFBREtBZ0F3Q3BvQkFRQUFBQUdrQVFBQUFPTUJBcWdCSUFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWJvQkFRQUFBQUc3QVFFQUFBQUIzd0VCQUFBQUFlQUJBUUFBQUFIaEFRRUFBQUFCQWdBQUFBRUFJQnNBQU04Q0FDQURBQUFBQVFBZ0d3QUF6d0lBSUJ3QUFNNENBQ0FCRkFBQWxBUUFNQThPQUFDaEFnQWdsd0VBQUo4Q0FEQ1lBUUFBR2dBUW1RRUFBSjhDQURDYUFRRUFBQUFCcEFFQUFLQUM0d0VpcUFFZ0FQb0JBQ0dxQVVBQV9BRUFJYXNCUUFEOEFRQWh1Z0VCQVBVQkFDRzdBUUVBQUFBQjN3RUJBUFVCQUNIZ0FRRUE5UUVBSWVFQkFRRDFBUUFoNHdFQkFQVUJBQ0VDQUFBQUFRQWdGQUFBemdJQUlBSUFBQURMQWdBZ0ZBQUF6QUlBSUE2WEFRQUF5Z0lBTUpnQkFBRExBZ0FRbVFFQUFNb0NBRENhQVFFQTlRRUFJYVFCQUFDZ0F1TUJJcWdCSUFENkFRQWhxZ0ZBQVB3QkFDR3JBVUFBX0FFQUlib0JBUUQxQVFBaHV3RUJBUFVCQUNIZkFRRUE5UUVBSWVBQkFRRDFBUUFoNFFFQkFQVUJBQ0hqQVFFQTlRRUFJUTZYQVFBQXlnSUFNSmdCQUFETEFnQVFtUUVBQU1vQ0FEQ2FBUUVBOVFFQUlhUUJBQUNnQXVNQklxZ0JJQUQ2QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJvQkFRRDFBUUFodXdFQkFQVUJBQ0hmQVFFQTlRRUFJZUFCQVFEMUFRQWg0UUVCQVBVQkFDSGpBUUVBOVFFQUlRcWFBUUVBdHdJQUlhUUJBQUROQXVNQklxZ0JJQUM4QWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSWJvQkFRQzNBZ0FodXdFQkFMY0NBQ0hmQVFFQXR3SUFJZUFCQVFDM0FnQWg0UUVCQUxjQ0FDRUI2Z0VBQUFEakFRSUttZ0VCQUxjQ0FDR2tBUUFBelFMakFTS29BU0FBdkFJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNHNkFRRUF0d0lBSWJzQkFRQzNBZ0FoM3dFQkFMY0NBQ0hnQVFFQXR3SUFJZUVCQVFDM0FnQWhDcG9CQVFBQUFBR2tBUUFBQU9NQkFxZ0JJQUFBQUFHcUFVQUFBQUFCcXdGQUFBQUFBYm9CQVFBQUFBRzdBUUVBQUFBQjN3RUJBQUFBQWVBQkFRQUFBQUhoQVFFQUFBQUJCd2dBQU4wQ0FDQ2FBUUVBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUhBQVFJQUFBQUJ5QUVCQUFBQUFjb0JBUUFBQUFFQ0FBQUFGQUFnR3dBQTNBSUFJQU1BQUFBVUFDQWJBQURjQWdBZ0hBQUEyZ0lBSUFFVUFBQ1RCQUF3RFFjQUFLRUNBQ0FJQUFDa0FnQWdsd0VBQUtNQ0FEQ1lBUUFBRWdBUW1RRUFBS01DQURDYUFRRUFBQUFCcWdGQUFQd0JBQ0dyQVVBQV9BRUFJY0FCQWdEN0FRQWh5QUVCQVBVQkFDSEpBUUVBOVFFQUljb0JBUUQxQVFBaDVBRUFBS0lDQUNBQ0FBQUFGQUFnRkFBQTJnSUFJQUlBQUFEWUFnQWdGQUFBMlFJQUlBcVhBUUFBMXdJQU1KZ0JBQURZQWdBUW1RRUFBTmNDQURDYUFRRUE5UUVBSWFvQlFBRDhBUUFocXdGQUFQd0JBQ0hBQVFJQS13RUFJY2dCQVFEMUFRQWh5UUVCQVBVQkFDSEtBUUVBOVFFQUlRcVhBUUFBMXdJQU1KZ0JBQURZQWdBUW1RRUFBTmNDQURDYUFRRUE5UUVBSWFvQlFBRDhBUUFocXdGQUFQd0JBQ0hBQVFJQS13RUFJY2dCQVFEMUFRQWh5UUVCQVBVQkFDSEtBUUVBOVFFQUlRYWFBUUVBdHdJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNIQUFRSUF2UUlBSWNnQkFRQzNBZ0FoeWdFQkFMY0NBQ0VIQ0FBQTJ3SUFJSm9CQVFDM0FnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljQUJBZ0M5QWdBaHlBRUJBTGNDQUNIS0FRRUF0d0lBSVFVYkFBQ09CQUFnSEFBQWtRUUFJT2NCQUFDUEJBQWc2QUVBQUpBRUFDRHRBUUFBQlFBZ0J3Z0FBTjBDQUNDYUFRRUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBSEFBUUlBQUFBQnlBRUJBQUFBQWNvQkFRQUFBQUVER3dBQWpnUUFJT2NCQUFDUEJBQWc3UUVBQUFVQUlBb0lBQUQ4QWdBZ0NnQUFfUUlBSUpvQkFRQUFBQUdrQVFBQUFOOEJBcW9CUUFBQUFBR3JBVUFBQUFBQnlnRUJBQUFBQWRzQlFBQUFBQUhjQVFJQUFBQUIzUUVRQUFBQUFRSUFBQUFMQUNBYkFBRDdBZ0FnQXdBQUFBc0FJQnNBQVBzQ0FDQWNBQURxQWdBZ0FSUUFBSTBFQURBUEJ3QUFvUUlBSUFnQUFLUUNBQ0FLQUFDc0FnQWdsd0VBQUtvQ0FEQ1lBUUFBQ1FBUW1RRUFBS29DQURDYUFRRUFBQUFCcEFFQUFLc0Mzd0VpcWdGQUFQd0JBQ0dyQVVBQV9BRUFJY2tCQVFEMUFRQWh5Z0VCQVBVQkFDSGJBVUFBX0FFQUlkd0JBZ0Q3QVFBaDNRRVFBS1lDQUNFQ0FBQUFDd0FnRkFBQTZnSUFJQUlBQUFEbUFnQWdGQUFBNXdJQUlBeVhBUUFBNVFJQU1KZ0JBQURtQWdBUW1RRUFBT1VDQURDYUFRRUE5UUVBSWFRQkFBQ3JBdDhCSXFvQlFBRDhBUUFocXdGQUFQd0JBQ0hKQVFFQTlRRUFJY29CQVFEMUFRQWgyd0ZBQVB3QkFDSGNBUUlBLXdFQUlkMEJFQUNtQWdBaERKY0JBQURsQWdBd21BRUFBT1lDQUJDWkFRQUE1UUlBTUpvQkFRRDFBUUFocEFFQUFLc0Mzd0VpcWdGQUFQd0JBQ0dyQVVBQV9BRUFJY2tCQVFEMUFRQWh5Z0VCQVBVQkFDSGJBVUFBX0FFQUlkd0JBZ0Q3QVFBaDNRRVFBS1lDQUNFSW1nRUJBTGNDQUNHa0FRQUE2UUxmQVNLcUFVQUF2Z0lBSWFzQlFBQy1BZ0FoeWdFQkFMY0NBQ0hiQVVBQXZnSUFJZHdCQWdDOUFnQWgzUUVRQU9nQ0FDRUY2Z0VRQUFBQUFmRUJFQUFBQUFIeUFSQUFBQUFCOHdFUUFBQUFBZlFCRUFBQUFBRUI2Z0VBQUFEZkFRSUtDQUFBNndJQUlBb0FBT3dDQUNDYUFRRUF0d0lBSWFRQkFBRHBBdDhCSXFvQlFBQy1BZ0FocXdGQUFMNENBQ0hLQVFFQXR3SUFJZHNCUUFDLUFnQWgzQUVDQUwwQ0FDSGRBUkFBNkFJQUlRVWJBQUNIQkFBZ0hBQUFpd1FBSU9jQkFBQ0lCQUFnNkFFQUFJb0VBQ0R0QVFBQUJRQWdDeHNBQU8wQ0FEQWNBQUR5QWdBdzV3RUFBTzRDQUREb0FRQUE3d0lBTU9rQkFBRHdBZ0FnNmdFQUFQRUNBRERyQVFBQThRSUFNT3dCQUFEeEFnQXc3UUVBQVBFQ0FERHVBUUFBOHdJQU1POEJBQUQwQWdBd0Q1b0JBUUFBQUFHa0FRQUFBTkVCQXFvQlFBQUFBQUdyQVVBQUFBQUJ6QUVCQUFBQUFjMEJBUUFBQUFIT0FSQUFBQUFCendFQkFBQUFBZEVCQVFBQUFBSFNBUUVBQUFBQjB3RUJBQUFBQWRRQkFRQUFBQUhWQVVBQUFBQUIxZ0VCQUFBQUFkY0JRQUFBQUFFQ0FBQUFEd0FnR3dBQS1nSUFJQU1BQUFBUEFDQWJBQUQ2QWdBZ0hBQUEtUUlBSUFFVUFBQ0pCQUF3RkFrQUFLa0NBQ0NYQVFBQXBRSUFNSmdCQUFBTkFCQ1pBUUFBcFFJQU1Kb0JBUUFBQUFHa0FRQUFwd0xSQVNLcUFVQUFfQUVBSWFzQlFBRDhBUUFoeXdFQkFQVUJBQ0hNQVFFQUFBQUJ6UUVCQVBZQkFDSE9BUkFBcGdJQUljOEJBUUQxQVFBaDBRRUJBUFlCQUNIU0FRRUE5Z0VBSWRNQkFRRDJBUUFoMUFFQkFQWUJBQ0hWQVVBQXFBSUFJZFlCQVFEMkFRQWgxd0ZBQUtnQ0FDRUNBQUFBRHdBZ0ZBQUEtUUlBSUFJQUFBRDFBZ0FnRkFBQTlnSUFJQk9YQVFBQTlBSUFNSmdCQUFEMUFnQVFtUUVBQVBRQ0FEQ2FBUUVBOVFFQUlhUUJBQUNuQXRFQklxb0JRQUQ4QVFBaHF3RkFBUHdCQUNITEFRRUE5UUVBSWN3QkFRRDFBUUFoelFFQkFQWUJBQ0hPQVJBQXBnSUFJYzhCQVFEMUFRQWgwUUVCQVBZQkFDSFNBUUVBOWdFQUlkTUJBUUQyQVFBaDFBRUJBUFlCQUNIVkFVQUFxQUlBSWRZQkFRRDJBUUFoMXdGQUFLZ0NBQ0VUbHdFQUFQUUNBRENZQVFBQTlRSUFFSmtCQUFEMEFnQXdtZ0VCQVBVQkFDR2tBUUFBcHdMUkFTS3FBVUFBX0FFQUlhc0JRQUQ4QVFBaHl3RUJBUFVCQUNITUFRRUE5UUVBSWMwQkFRRDJBUUFoemdFUUFLWUNBQ0hQQVFFQTlRRUFJZEVCQVFEMkFRQWgwZ0VCQVBZQkFDSFRBUUVBOWdFQUlkUUJBUUQyQVFBaDFRRkFBS2dDQUNIV0FRRUE5Z0VBSWRjQlFBQ29BZ0FoRDVvQkFRQzNBZ0FocEFFQUFQY0MwUUVpcWdGQUFMNENBQ0dyQVVBQXZnSUFJY3dCQVFDM0FnQWh6UUVCQUxnQ0FDSE9BUkFBNkFJQUljOEJBUUMzQWdBaDBRRUJBTGdDQUNIU0FRRUF1QUlBSWRNQkFRQzRBZ0FoMUFFQkFMZ0NBQ0hWQVVBQS1BSUFJZFlCQVFDNEFnQWgxd0ZBQVBnQ0FDRUI2Z0VBQUFEUkFRSUI2Z0ZBQUFBQUFRLWFBUUVBdHdJQUlhUUJBQUQzQXRFQklxb0JRQUMtQWdBaHF3RkFBTDRDQUNITUFRRUF0d0lBSWMwQkFRQzRBZ0FoemdFUUFPZ0NBQ0hQQVFFQXR3SUFJZEVCQVFDNEFnQWgwZ0VCQUxnQ0FDSFRBUUVBdUFJQUlkUUJBUUM0QWdBaDFRRkFBUGdDQUNIV0FRRUF1QUlBSWRjQlFBRDRBZ0FoRDVvQkFRQUFBQUdrQVFBQUFORUJBcW9CUUFBQUFBR3JBVUFBQUFBQnpBRUJBQUFBQWMwQkFRQUFBQUhPQVJBQUFBQUJ6d0VCQUFBQUFkRUJBUUFBQUFIU0FRRUFBQUFCMHdFQkFBQUFBZFFCQVFBQUFBSFZBVUFBQUFBQjFnRUJBQUFBQWRjQlFBQUFBQUVLQ0FBQV9BSUFJQW9BQVAwQ0FDQ2FBUUVBQUFBQnBBRUFBQURmQVFLcUFVQUFBQUFCcXdGQUFBQUFBY29CQVFBQUFBSGJBVUFBQUFBQjNBRUNBQUFBQWQwQkVBQUFBQUVER3dBQWh3UUFJT2NCQUFDSUJBQWc3UUVBQUFVQUlBUWJBQUR0QWdBdzV3RUFBTzRDQUREcEFRQUE4QUlBSU8wQkFBRHhBZ0F3RVFVQUFLY0RBQ0FMQUFDb0F3QWdEQUFBcVFNQUlKb0JBUUFBQUFHa0FRQUFBTU1CQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCdkFFQkFBQUFBYjBCQVFBQUFBRy1BUkFBQUFBQnZ3RUNBQUFBQWNBQkNBQUFBQUhCQVFBQXBnTUFJTU1CQVFBQUFBRUNBQUFBQlFBZ0d3QUFwUU1BSUFNQUFBQUZBQ0FiQUFDbEF3QWdIQUFBaXdNQUlBRVVBQUNHQkFBd0ZnVUFBTEFDQUNBR0FBQ2hBZ0FnQ3dBQV9nRUFJQXdBQVA4QkFDQ1hBUUFBclFJQU1KZ0JBQUFEQUJDWkFRQUFyUUlBTUpvQkFRQUFBQUdrQVFBQXJ3TERBU0tvQVNBQS1nRUFJYW9CUUFEOEFRQWhxd0ZBQVB3QkFDRzZBUUVBOVFFQUlic0JBUUFBQUFHOEFRRUE5UUVBSWIwQkFRRDFBUUFodmdFUUFLWUNBQ0dfQVFJQS13RUFJY0FCQ0FDdUFnQWh3UUVBQUlRQ0FDRERBUUVBOVFFQUljUUJBUUQxQVFBaEFnQUFBQVVBSUJRQUFJc0RBQ0FDQUFBQWhnTUFJQlFBQUljREFDQVNsd0VBQUlVREFEQ1lBUUFBaGdNQUVKa0JBQUNGQXdBd21nRUJBUFVCQUNHa0FRQUFyd0xEQVNLb0FTQUEtZ0VBSWFvQlFBRDhBUUFocXdGQUFQd0JBQ0c2QVFFQTlRRUFJYnNCQVFEMUFRQWh2QUVCQVBVQkFDRzlBUUVBOVFFQUliNEJFQUNtQWdBaHZ3RUNBUHNCQUNIQUFRZ0FyZ0lBSWNFQkFBQ0VBZ0Fnd3dFQkFQVUJBQ0hFQVFFQTlRRUFJUktYQVFBQWhRTUFNSmdCQUFDR0F3QVFtUUVBQUlVREFEQ2FBUUVBOVFFQUlhUUJBQUN2QXNNQklxZ0JJQUQ2QVFBaHFnRkFBUHdCQUNHckFVQUFfQUVBSWJvQkFRRDFBUUFodXdFQkFQVUJBQ0c4QVFFQTlRRUFJYjBCQVFEMUFRQWh2Z0VRQUtZQ0FDR19BUUlBLXdFQUljQUJDQUN1QWdBaHdRRUFBSVFDQUNEREFRRUE5UUVBSWNRQkFRRDFBUUFoRHBvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTU1CQVFDM0FnQWhCZW9CQ0FBQUFBSHhBUWdBQUFBQjhnRUlBQUFBQWZNQkNBQUFBQUgwQVFnQUFBQUJBdW9CQVFBQUFBVHdBUUVBQUFBRkFlb0JBQUFBd3dFQ0VRVUFBSXdEQUNBTEFBQ05Bd0FnREFBQWpnTUFJSm9CQVFDM0FnQWhwQUVBQUlvRHd3RWlxQUVnQUx3Q0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaHVnRUJBTGNDQUNHN0FRRUF0d0lBSWJ3QkFRQzNBZ0FodlFFQkFMY0NBQ0ctQVJBQTZBSUFJYjhCQWdDOUFnQWh3QUVJQUlnREFDSEJBUUFBaVFNQUlNTUJBUUMzQWdBaEJSc0FBUFVEQUNBY0FBQ0VCQUFnNXdFQUFQWURBQ0RvQVFBQWd3UUFJTzBCQUFCTUFDQUxHd0FBbWdNQU1Cd0FBSjREQUREbkFRQUFtd01BTU9nQkFBQ2NBd0F3NlFFQUFKMERBQ0RxQVFBQTRnSUFNT3NCQUFEaUFnQXc3QUVBQU9JQ0FERHRBUUFBNGdJQU1PNEJBQUNmQXdBdzd3RUFBT1VDQURBTEd3QUFqd01BTUJ3QUFKTURBRERuQVFBQWtBTUFNT2dCQUFDUkF3QXc2UUVBQUpJREFDRHFBUUFBMUFJQU1Pc0JBQURVQWdBdzdBRUFBTlFDQUREdEFRQUExQUlBTU80QkFBQ1VBd0F3N3dFQUFOY0NBREFIQndBQW1RTUFJSm9CQVFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWNBQkFnQUFBQUhJQVFFQUFBQUJ5UUVCQUFBQUFRSUFBQUFVQUNBYkFBQ1lBd0FnQXdBQUFCUUFJQnNBQUpnREFDQWNBQUNXQXdBZ0FSUUFBSUlFQURBQ0FBQUFGQUFnRkFBQWxnTUFJQUlBQUFEWUFnQWdGQUFBbFFNQUlBYWFBUUVBdHdJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNIQUFRSUF2UUlBSWNnQkFRQzNBZ0FoeVFFQkFMY0NBQ0VIQndBQWx3TUFJSm9CQVFDM0FnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUljQUJBZ0M5QWdBaHlBRUJBTGNDQUNISkFRRUF0d0lBSVFVYkFBRDlBd0FnSEFBQWdBUUFJT2NCQUFELUF3QWc2QUVBQVA4REFDRHRBUUFBd0FFQUlBY0hBQUNaQXdBZ21nRUJBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJ3QUVDQUFBQUFjZ0JBUUFBQUFISkFRRUFBQUFCQXhzQUFQMERBQ0RuQVFBQV9nTUFJTzBCQUFEQUFRQWdDZ2NBQUtRREFDQUtBQUQ5QWdBZ21nRUJBQUFBQWFRQkFBQUEzd0VDcWdGQUFBQUFBYXNCUUFBQUFBSEpBUUVBQUFBQjJ3RkFBQUFBQWR3QkFnQUFBQUhkQVJBQUFBQUJBZ0FBQUFzQUlCc0FBS01EQUNBREFBQUFDd0FnR3dBQW93TUFJQndBQUtFREFDQUJGQUFBX0FNQU1BSUFBQUFMQUNBVUFBQ2hBd0FnQWdBQUFPWUNBQ0FVQUFDZ0F3QWdDSm9CQVFDM0FnQWhwQUVBQU9rQzN3RWlxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlja0JBUUMzQWdBaDJ3RkFBTDRDQUNIY0FRSUF2UUlBSWQwQkVBRG9BZ0FoQ2djQUFLSURBQ0FLQUFEc0FnQWdtZ0VCQUxjQ0FDR2tBUUFBNlFMZkFTS3FBVUFBdmdJQUlhc0JRQUMtQWdBaHlRRUJBTGNDQUNIYkFVQUF2Z0lBSWR3QkFnQzlBZ0FoM1FFUUFPZ0NBQ0VGR3dBQTl3TUFJQndBQVBvREFDRG5BUUFBLUFNQUlPZ0JBQUQ1QXdBZzdRRUFBTUFCQUNBS0J3QUFwQU1BSUFvQUFQMENBQ0NhQVFFQUFBQUJwQUVBQUFEZkFRS3FBVUFBQUFBQnF3RkFBQUFBQWNrQkFRQUFBQUhiQVVBQUFBQUIzQUVDQUFBQUFkMEJFQUFBQUFFREd3QUE5d01BSU9jQkFBRDRBd0FnN1FFQUFNQUJBQ0FSQlFBQXB3TUFJQXNBQUtnREFDQU1BQUNwQXdBZ21nRUJBQUFBQWFRQkFBQUF3d0VDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUc4QVFFQUFBQUJ2UUVCQUFBQUFiNEJFQUFBQUFHX0FRSUFBQUFCd0FFSUFBQUFBY0VCQUFDbUF3QWd3d0VCQUFBQUFRSHFBUUVBQUFBRUF4c0FBUFVEQUNEbkFRQUE5Z01BSU8wQkFBQk1BQ0FFR3dBQW1nTUFNT2NCQUFDYkF3QXc2UUVBQUowREFDRHRBUUFBNGdJQU1BUWJBQUNQQXdBdzV3RUFBSkFEQUREcEFRQUFrZ01BSU8wQkFBRFVBZ0F3QkJzQUFQNENBRERuQVFBQV93SUFNT2tCQUFDQkF3QWc3UUVBQUlJREFEQUVHd0FBM2dJQU1PY0JBQURmQWdBdzZRRUFBT0VDQUNEdEFRQUE0Z0lBTUFRYkFBRFFBZ0F3NXdFQUFORUNBRERwQVFBQTB3SUFJTzBCQUFEVUFnQXdCQnNBQU1NQ0FERG5BUUFBeEFJQU1Pa0JBQURHQWdBZzdRRUFBTWNDQURBQUFBQUFBQUFBQUFBRkd3QUE4QU1BSUJ3QUFQTURBQ0RuQVFBQThRTUFJT2dCQUFEeUF3QWc3UUVBQU1BQkFDQURHd0FBOEFNQUlPY0JBQUR4QXdBZzdRRUFBTUFCQUNBQUFBQUFBQUFBQUFBQUJSc0FBT3NEQUNBY0FBRHVBd0FnNXdFQUFPd0RBQ0RvQVFBQTdRTUFJTzBCQUFBTEFDQURHd0FBNndNQUlPY0JBQURzQXdBZzdRRUFBQXNBSUFBQUFBQUFBQXNiQUFETUF3QXdIQUFBMEFNQU1PY0JBQUROQXdBdzZBRUFBTTREQUREcEFRQUF6d01BSU9vQkFBQ0NBd0F3NndFQUFJSURBRERzQVFBQWdnTUFNTzBCQUFDQ0F3QXc3Z0VBQU5FREFERHZBUUFBaFFNQU1CRUdBQUM0QXdBZ0N3QUFxQU1BSUF3QUFLa0RBQ0NhQVFFQUFBQUJwQUVBQUFEREFRS29BU0FBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUc2QVFFQUFBQUJ1d0VCQUFBQUFid0JBUUFBQUFHOUFRRUFBQUFCdmdFUUFBQUFBYjhCQWdBQUFBSEFBUWdBQUFBQndRRUFBS1lEQUNERUFRRUFBQUFCQWdBQUFBVUFJQnNBQU5RREFDQURBQUFBQlFBZ0d3QUExQU1BSUJ3QUFOTURBQ0FCRkFBQTZnTUFNQUlBQUFBRkFDQVVBQURUQXdBZ0FnQUFBSVlEQUNBVUFBRFNBd0FnRHBvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTVFCQVFDM0FnQWhFUVlBQUxjREFDQUxBQUNOQXdBZ0RBQUFqZ01BSUpvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTVFCQVFDM0FnQWhFUVlBQUxnREFDQUxBQUNvQXdBZ0RBQUFxUU1BSUpvQkFRQUFBQUdrQVFBQUFNTUJBcWdCSUFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWJvQkFRQUFBQUc3QVFFQUFBQUJ2QUVCQUFBQUFiMEJBUUFBQUFHLUFSQUFBQUFCdndFQ0FBQUFBY0FCQ0FBQUFBSEJBUUFBcGdNQUlNUUJBUUFBQUFFRUd3QUF6QU1BTU9jQkFBRE5Bd0F3NlFFQUFNOERBQ0R0QVFBQWdnTUFNQUFBQUFBQUFBQUFCUnNBQU9VREFDQWNBQURvQXdBZzV3RUFBT1lEQUNEb0FRQUE1d01BSU8wQkFBREFBUUFnQXhzQUFPVURBQ0RuQVFBQTVnTUFJTzBCQUFEQUFRQWdDQU1BQUs0REFDQUxBQUN2QXdBZ0RBQUFzQU1BSUEwQUFMRURBQ0NkQVFBQXNRSUFJSjRCQUFDeEFnQWdud0VBQUxFQ0FDQ2dBUUFBc1FJQUlBUUZBQURrQXdBZ0JnQUE0QU1BSUFzQUFLOERBQ0FNQUFDd0F3QWdBd2NBQU9BREFDQUlBQURoQXdBZ0NnQUE0d01BSUFBQkF3QUFyZ01BSUJJREFBQ3FBd0FnQ3dBQXF3TUFJQXdBQUt3REFDQ2FBUUVBQUFBQm13RUJBQUFBQVp3QkFRQUFBQUdkQVFFQUFBQUJuZ0VCQUFBQUFaOEJBUUFBQUFHZ0FRRUFBQUFCb2dFQUFBQ2lBUUtrQVFBQUFLUUJBcVlCQUFBQXBnRUNwd0VnQUFBQUFhZ0JJQUFBQUFHcEFRSUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBRUNBQUFBd0FFQUlCc0FBT1VEQUNBREFBQUF3d0VBSUJzQUFPVURBQ0FjQUFEcEF3QWdGQUFBQU1NQkFDQURBQUNfQWdBZ0N3QUF3QUlBSUF3QUFNRUNBQ0FVQUFEcEF3QWdtZ0VCQUxjQ0FDR2JBUUVBdHdJQUlad0JBUUMzQWdBaG5RRUJBTGdDQUNHZUFRRUF1QUlBSVo4QkFRQzRBZ0Fob0FFQkFMZ0NBQ0dpQVFBQXVRS2lBU0trQVFBQXVnS2tBU0ttQVFBQXV3S21BU0tuQVNBQXZBSUFJYWdCSUFDOEFnQWhxUUVDQUwwQ0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaEVnTUFBTDhDQUNBTEFBREFBZ0FnREFBQXdRSUFJSm9CQVFDM0FnQWhtd0VCQUxjQ0FDR2NBUUVBdHdJQUlaMEJBUUM0QWdBaG5nRUJBTGdDQUNHZkFRRUF1QUlBSWFBQkFRQzRBZ0Fob2dFQUFMa0NvZ0VpcEFFQUFMb0NwQUVpcGdFQUFMc0NwZ0VpcHdFZ0FMd0NBQ0dvQVNBQXZBSUFJYWtCQWdDOUFnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlRNmFBUUVBQUFBQnBBRUFBQUREQVFLb0FTQUFBQUFCcWdGQUFBQUFBYXNCUUFBQUFBRzZBUUVBQUFBQnV3RUJBQUFBQWJ3QkFRQUFBQUc5QVFFQUFBQUJ2Z0VRQUFBQUFiOEJBZ0FBQUFIQUFRZ0FBQUFCd1FFQUFLWURBQ0RFQVFFQUFBQUJDd2NBQUtRREFDQUlBQUQ4QWdBZ21nRUJBQUFBQWFRQkFBQUEzd0VDcWdGQUFBQUFBYXNCUUFBQUFBSEpBUUVBQUFBQnlnRUJBQUFBQWRzQlFBQUFBQUhjQVFJQUFBQUIzUUVRQUFBQUFRSUFBQUFMQUNBYkFBRHJBd0FnQXdBQUFBa0FJQnNBQU9zREFDQWNBQUR2QXdBZ0RRQUFBQWtBSUFjQUFLSURBQ0FJQUFEckFnQWdGQUFBN3dNQUlKb0JBUUMzQWdBaHBBRUFBT2tDM3dFaXFnRkFBTDRDQUNHckFVQUF2Z0lBSWNrQkFRQzNBZ0FoeWdFQkFMY0NBQ0hiQVVBQXZnSUFJZHdCQWdDOUFnQWgzUUVRQU9nQ0FDRUxCd0FBb2dNQUlBZ0FBT3NDQUNDYUFRRUF0d0lBSWFRQkFBRHBBdDhCSXFvQlFBQy1BZ0FocXdGQUFMNENBQ0hKQVFFQXR3SUFJY29CQVFDM0FnQWgyd0ZBQUw0Q0FDSGNBUUlBdlFJQUlkMEJFQURvQWdBaEVnc0FBS3NEQUNBTUFBQ3NBd0FnRFFBQXJRTUFJSm9CQVFBQUFBR2JBUUVBQUFBQm5BRUJBQUFBQVowQkFRQUFBQUdlQVFFQUFBQUJud0VCQUFBQUFhQUJBUUFBQUFHaUFRQUFBS0lCQXFRQkFBQUFwQUVDcGdFQUFBQ21BUUtuQVNBQUFBQUJxQUVnQUFBQUFha0JBZ0FBQUFHcUFVQUFBQUFCcXdGQUFBQUFBUUlBQUFEQUFRQWdHd0FBOEFNQUlBTUFBQUREQVFBZ0d3QUE4QU1BSUJ3QUFQUURBQ0FVQUFBQXd3RUFJQXNBQU1BQ0FDQU1BQURCQWdBZ0RRQUF3Z0lBSUJRQUFQUURBQ0NhQVFFQXR3SUFJWnNCQVFDM0FnQWhuQUVCQUxjQ0FDR2RBUUVBdUFJQUlaNEJBUUM0QWdBaG53RUJBTGdDQUNHZ0FRRUF1QUlBSWFJQkFBQzVBcUlCSXFRQkFBQzZBcVFCSXFZQkFBQzdBcVlCSXFjQklBQzhBZ0FocUFFZ0FMd0NBQ0dwQVFJQXZRSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRVNDd0FBd0FJQUlBd0FBTUVDQUNBTkFBRENBZ0FnbWdFQkFMY0NBQ0diQVFFQXR3SUFJWndCQVFDM0FnQWhuUUVCQUxnQ0FDR2VBUUVBdUFJQUlaOEJBUUM0QWdBaG9BRUJBTGdDQUNHaUFRQUF1UUtpQVNLa0FRQUF1Z0trQVNLbUFRQUF1d0ttQVNLbkFTQUF2QUlBSWFnQklBQzhBZ0FocVFFQ0FMMENBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWhCWm9CQVFBQUFBR2JBUUVBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUc3QVFFQUFBQUJBZ0FBQUV3QUlCc0FBUFVEQUNBU0F3QUFxZ01BSUF3QUFLd0RBQ0FOQUFDdEF3QWdtZ0VCQUFBQUFac0JBUUFBQUFHY0FRRUFBQUFCblFFQkFBQUFBWjRCQVFBQUFBR2ZBUUVBQUFBQm9BRUJBQUFBQWFJQkFBQUFvZ0VDcEFFQUFBQ2tBUUttQVFBQUFLWUJBcWNCSUFBQUFBR29BU0FBQUFBQnFRRUNBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJBZ0FBQU1BQkFDQWJBQUQzQXdBZ0F3QUFBTU1CQUNBYkFBRDNBd0FnSEFBQS13TUFJQlFBQUFEREFRQWdBd0FBdndJQUlBd0FBTUVDQUNBTkFBRENBZ0FnRkFBQS13TUFJSm9CQVFDM0FnQWhtd0VCQUxjQ0FDR2NBUUVBdHdJQUlaMEJBUUM0QWdBaG5nRUJBTGdDQUNHZkFRRUF1QUlBSWFBQkFRQzRBZ0Fob2dFQUFMa0NvZ0VpcEFFQUFMb0NwQUVpcGdFQUFMc0NwZ0VpcHdFZ0FMd0NBQ0dvQVNBQXZBSUFJYWtCQWdDOUFnQWhxZ0ZBQUw0Q0FDR3JBVUFBdmdJQUlSSURBQUNfQWdBZ0RBQUF3UUlBSUEwQUFNSUNBQ0NhQVFFQXR3SUFJWnNCQVFDM0FnQWhuQUVCQUxjQ0FDR2RBUUVBdUFJQUlaNEJBUUM0QWdBaG53RUJBTGdDQUNHZ0FRRUF1QUlBSWFJQkFBQzVBcUlCSXFRQkFBQzZBcVFCSXFZQkFBQzdBcVlCSXFjQklBQzhBZ0FocUFFZ0FMd0NBQ0dwQVFJQXZRSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRUltZ0VCQUFBQUFhUUJBQUFBM3dFQ3FnRkFBQUFBQWFzQlFBQUFBQUhKQVFFQUFBQUIyd0ZBQUFBQUFkd0JBZ0FBQUFIZEFSQUFBQUFCRWdNQUFLb0RBQ0FMQUFDckF3QWdEUUFBclFNQUlKb0JBUUFBQUFHYkFRRUFBQUFCbkFFQkFBQUFBWjBCQVFBQUFBR2VBUUVBQUFBQm53RUJBQUFBQWFBQkFRQUFBQUdpQVFBQUFLSUJBcVFCQUFBQXBBRUNwZ0VBQUFDbUFRS25BU0FBQUFBQnFBRWdBQUFBQWFrQkFnQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFRSUFBQURBQVFBZ0d3QUFfUU1BSUFNQUFBRERBUUFnR3dBQV9RTUFJQndBQUlFRUFDQVVBQUFBd3dFQUlBTUFBTDhDQUNBTEFBREFBZ0FnRFFBQXdnSUFJQlFBQUlFRUFDQ2FBUUVBdHdJQUlac0JBUUMzQWdBaG5BRUJBTGNDQUNHZEFRRUF1QUlBSVo0QkFRQzRBZ0FobndFQkFMZ0NBQ0dnQVFFQXVBSUFJYUlCQUFDNUFxSUJJcVFCQUFDNkFxUUJJcVlCQUFDN0FxWUJJcWNCSUFDOEFnQWhxQUVnQUx3Q0FDR3BBUUlBdlFJQUlhb0JRQUMtQWdBaHF3RkFBTDRDQUNFU0F3QUF2d0lBSUFzQUFNQUNBQ0FOQUFEQ0FnQWdtZ0VCQUxjQ0FDR2JBUUVBdHdJQUlad0JBUUMzQWdBaG5RRUJBTGdDQUNHZUFRRUF1QUlBSVo4QkFRQzRBZ0Fob0FFQkFMZ0NBQ0dpQVFBQXVRS2lBU0trQVFBQXVnS2tBU0ttQVFBQXV3S21BU0tuQVNBQXZBSUFJYWdCSUFDOEFnQWhxUUVDQUwwQ0FDR3FBVUFBdmdJQUlhc0JRQUMtQWdBaEJwb0JBUUFBQUFHcUFVQUFBQUFCcXdGQUFBQUFBY0FCQWdBQUFBSElBUUVBQUFBQnlRRUJBQUFBQVFNQUFBQlBBQ0FiQUFEMUF3QWdIQUFBaFFRQUlBY0FBQUJQQUNBVUFBQ0ZCQUFnbWdFQkFMY0NBQ0diQVFFQXR3SUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRzdBUUVBdHdJQUlRV2FBUUVBdHdJQUlac0JBUUMzQWdBaHFnRkFBTDRDQUNHckFVQUF2Z0lBSWJzQkFRQzNBZ0FoRHBvQkFRQUFBQUdrQVFBQUFNTUJBcWdCSUFBQUFBR3FBVUFBQUFBQnF3RkFBQUFBQWJvQkFRQUFBQUc3QVFFQUFBQUJ2QUVCQUFBQUFiMEJBUUFBQUFHLUFSQUFBQUFCdndFQ0FBQUFBY0FCQ0FBQUFBSEJBUUFBcGdNQUlNTUJBUUFBQUFFU0JRQUFwd01BSUFZQUFMZ0RBQ0FNQUFDcEF3QWdtZ0VCQUFBQUFhUUJBQUFBd3dFQ3FBRWdBQUFBQWFvQlFBQUFBQUdyQVVBQUFBQUJ1Z0VCQUFBQUFic0JBUUFBQUFHOEFRRUFBQUFCdlFFQkFBQUFBYjRCRUFBQUFBR19BUUlBQUFBQndBRUlBQUFBQWNFQkFBQ21Bd0Fnd3dFQkFBQUFBY1FCQVFBQUFBRUNBQUFBQlFBZ0d3QUFod1FBSUEtYUFRRUFBQUFCcEFFQUFBRFJBUUtxQVVBQUFBQUJxd0ZBQUFBQUFjd0JBUUFBQUFITkFRRUFBQUFCemdFUUFBQUFBYzhCQVFBQUFBSFJBUUVBQUFBQjBnRUJBQUFBQWRNQkFRQUFBQUhVQVFFQUFBQUIxUUZBQUFBQUFkWUJBUUFBQUFIWEFVQUFBQUFCQXdBQUFBTUFJQnNBQUljRUFDQWNBQUNNQkFBZ0ZBQUFBQU1BSUFVQUFJd0RBQ0FHQUFDM0F3QWdEQUFBamdNQUlCUUFBSXdFQUNDYUFRRUF0d0lBSWFRQkFBQ0tBOE1CSXFnQklBQzhBZ0FocWdGQUFMNENBQ0dyQVVBQXZnSUFJYm9CQVFDM0FnQWh1d0VCQUxjQ0FDRzhBUUVBdHdJQUliMEJBUUMzQWdBaHZnRVFBT2dDQUNHX0FRSUF2UUlBSWNBQkNBQ0lBd0Fod1FFQUFJa0RBQ0REQVFFQXR3SUFJY1FCQVFDM0FnQWhFZ1VBQUl3REFDQUdBQUMzQXdBZ0RBQUFqZ01BSUpvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTU1CQVFDM0FnQWh4QUVCQUxjQ0FDRUltZ0VCQUFBQUFhUUJBQUFBM3dFQ3FnRkFBQUFBQWFzQlFBQUFBQUhLQVFFQUFBQUIyd0ZBQUFBQUFkd0JBZ0FBQUFIZEFSQUFBQUFCRWdVQUFLY0RBQ0FHQUFDNEF3QWdDd0FBcUFNQUlKb0JBUUFBQUFHa0FRQUFBTU1CQXFnQklBQUFBQUdxQVVBQUFBQUJxd0ZBQUFBQUFib0JBUUFBQUFHN0FRRUFBQUFCdkFFQkFBQUFBYjBCQVFBQUFBRy1BUkFBQUFBQnZ3RUNBQUFBQWNBQkNBQUFBQUhCQVFBQXBnTUFJTU1CQVFBQUFBSEVBUUVBQUFBQkFnQUFBQVVBSUJzQUFJNEVBQ0FEQUFBQUF3QWdHd0FBamdRQUlCd0FBSklFQUNBVUFBQUFBd0FnQlFBQWpBTUFJQVlBQUxjREFDQUxBQUNOQXdBZ0ZBQUFrZ1FBSUpvQkFRQzNBZ0FocEFFQUFJb0R3d0VpcUFFZ0FMd0NBQ0dxQVVBQXZnSUFJYXNCUUFDLUFnQWh1Z0VCQUxjQ0FDRzdBUUVBdHdJQUlid0JBUUMzQWdBaHZRRUJBTGNDQUNHLUFSQUE2QUlBSWI4QkFnQzlBZ0Fod0FFSUFJZ0RBQ0hCQVFBQWlRTUFJTU1CQVFDM0FnQWh4QUVCQUxjQ0FDRVNCUUFBakFNQUlBWUFBTGNEQUNBTEFBQ05Bd0FnbWdFQkFMY0NBQ0drQVFBQWlnUERBU0tvQVNBQXZBSUFJYW9CUUFDLUFnQWhxd0ZBQUw0Q0FDRzZBUUVBdHdJQUlic0JBUUMzQWdBaHZBRUJBTGNDQUNHOUFRRUF0d0lBSWI0QkVBRG9BZ0FodndFQ0FMMENBQ0hBQVFnQWlBTUFJY0VCQUFDSkF3QWd3d0VCQUxjQ0FDSEVBUUVBdHdJQUlRYWFBUUVBQUFBQnFnRkFBQUFBQWFzQlFBQUFBQUhBQVFJQUFBQUJ5QUVCQUFBQUFjb0JBUUFBQUFFS21nRUJBQUFBQWFRQkFBQUE0d0VDcUFFZ0FBQUFBYW9CUUFBQUFBR3JBVUFBQUFBQnVnRUJBQUFBQWJzQkFRQUFBQUhmQVFFQUFBQUI0QUVCQUFBQUFlRUJBUUFBQUFFQkRnQUNCUU1HQXdRQUN3c1lCZ3daQ1EwY0FRVUVBQW9GQUFRR0FBSUxEQVlNRlFrQ0F3Y0RCQUFGQVFNSUFBUUVBQWdIQUFJSUFBTUtFQWNCQ1FBR0FRb1JBQUlIQUFJSUFBTUNDeFlBREJjQUJBTWRBQXNlQUF3ZkFBMGdBQUFCRGdBQ0FRNEFBZ01FQUJBaEFCRWlBQklBQUFBREJBQVFJUUFSSWdBU0FnY0FBZ2dBQXdJSEFBSUlBQU1GQkFBWElRQWFJZ0FiTXdBWU5BQVpBQUFBQUFBRkJBQVhJUUFhSWdBYk13QVlOQUFaQUFBREJBQWdJUUFoSWdBaUFBQUFBd1FBSUNFQUlTSUFJZ0FBQUFNRUFDZ2hBQ2tpQUNvQUFBQURCQUFvSVFBcElnQXFBUWtBQmdFSkFBWUZCQUF2SVFBeUlnQXpNd0F3TkFBeEFBQUFBQUFGQkFBdklRQXlJZ0F6TXdBd05BQXhBZ2NBQWdnQUF3SUhBQUlJQUFNRkJBQTRJUUE3SWdBOE13QTVOQUE2QUFBQUFBQUZCQUE0SVFBN0lnQThNd0E1TkFBNkFnVUFCQVlBQWdJRkFBUUdBQUlGQkFCQklRQkVJZ0JGTXdCQ05BQkRBQUFBQUFBRkJBQkJJUUJFSWdCRk13QkNOQUJEQUFBRkJBQktJUUJOSWdCT013QkxOQUJNQUFBQUFBQUZCQUJLSVFCTklnQk9Nd0JMTkFCTUR3SUJFQ0VCRVNJQkVpTUJFeVFCRlNZQkZpZ01GeWtOR0NzQkdTME1HaTRPSFM4QkhqQUJIekVNSXpRUEpEVVRKVFlHSmpjR0p6Z0dLRGtHS1RvR0tqd0dLejRNTEQ4VUxVRUdMa01NTDBRVk1FVUdNVVlHTWtjTU5Vb1dOa3NjTjAwRU9FNEVPVkVFT2xJRU8xTUVQRlVFUFZjTVBsZ2RQMW9FUUZ3TVFWMGVRbDRFUTE4RVJHQU1SV01mUm1RalIyWWtTR2NrU1dva1Ntc2tTMndrVEc0a1RYQU1UbkVsVDNNa1VIVU1VWFltVW5ja1UzZ2tWSGtNVlh3blZuMHJWMzRIV0g4SFdZQUJCMXFCQVFkYmdnRUhYSVFCQjEyR0FReGVod0VzWDRrQkIyQ0xBUXhoakFFdFlvMEJCMk9PQVFka2p3RU1aWklCTG1hVEFUUm5sQUVKYUpVQkNXbVdBUWxxbHdFSmE1Z0JDV3lhQVFsdG5BRU1icDBCTlctZkFRbHdvUUVNY2FJQk5uS2pBUWx6cEFFSmRLVUJESFdvQVRkMnFRRTlkNm9CQTNpckFRTjVyQUVEZXEwQkEzdXVBUU44c0FFRGZiSUJESDZ6QVQ1X3RRRURnQUczQVF5QkFiZ0JQNElCdVFFRGd3RzZBUU9FQWJzQkRJVUJ2Z0ZBaGdHX0FVYUhBY0VCQW9nQndnRUNpUUhGQVFLS0FjWUJBb3NCeHdFQ2pBSEpBUUtOQWNzQkRJNEJ6QUZIandIT0FRS1FBZEFCREpFQjBRRklrZ0hTQVFLVEFkTUJBcFFCMUFFTWxRSFhBVW1XQWRnQlR3XCJcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGVjb2RlQmFzZTY0QXNXYXNtKHdhc21CYXNlNjQ6IHN0cmluZyk6IFByb21pc2U8V2ViQXNzZW1ibHkuTW9kdWxlPiB7XG4gIGNvbnN0IHsgQnVmZmVyIH0gPSBhd2FpdCBpbXBvcnQoJ25vZGU6YnVmZmVyJylcbiAgY29uc3Qgd2FzbUFycmF5ID0gQnVmZmVyLmZyb20od2FzbUJhc2U2NCwgJ2Jhc2U2NCcpXG4gIHJldHVybiBuZXcgV2ViQXNzZW1ibHkuTW9kdWxlKHdhc21BcnJheSlcbn1cblxuY29uZmlnLmNvbXBpbGVyV2FzbSA9IHtcbiAgZ2V0UnVudGltZTogYXN5bmMgKCkgPT4gYXdhaXQgaW1wb3J0KFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9xdWVyeV9jb21waWxlcl9mYXN0X2JnLnBvc3RncmVzcWwubWpzXCIpLFxuXG4gIGdldFF1ZXJ5Q29tcGlsZXJXYXNtTW9kdWxlOiBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgeyB3YXNtIH0gPSBhd2FpdCBpbXBvcnQoXCJAcHJpc21hL2NsaWVudC9ydW50aW1lL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcucG9zdGdyZXNxbC53YXNtLWJhc2U2NC5tanNcIilcbiAgICByZXR1cm4gYXdhaXQgZGVjb2RlQmFzZTY0QXNXYXNtKHdhc20pXG4gIH0sXG5cbiAgaW1wb3J0TmFtZTogXCIuL3F1ZXJ5X2NvbXBpbGVyX2Zhc3RfYmcuanNcIlxufVxuXG5cblxuZXhwb3J0IHR5cGUgTG9nT3B0aW9uczxDbGllbnRPcHRpb25zIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnM+ID1cbiAgJ2xvZycgZXh0ZW5kcyBrZXlvZiBDbGllbnRPcHRpb25zID8gQ2xpZW50T3B0aW9uc1snbG9nJ10gZXh0ZW5kcyBBcnJheTxQcmlzbWEuTG9nTGV2ZWwgfCBQcmlzbWEuTG9nRGVmaW5pdGlvbj4gPyBQcmlzbWEuR2V0RXZlbnRzPENsaWVudE9wdGlvbnNbJ2xvZyddPiA6IG5ldmVyIDogbmV2ZXJcblxuZXhwb3J0IGludGVyZmFjZSBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvciB7XG4gICAgLyoqXG4gICAqICMjIFByaXNtYSBDbGllbnRcbiAgICogXG4gICAqIFR5cGUtc2FmZSBkYXRhYmFzZSBjbGllbnQgZm9yIFR5cGVTY3JpcHRcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXI6IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICAgKiB9KVxuICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQmxvZ1Bvc3RzXG4gICAqIGNvbnN0IGJsb2dQb3N0cyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSgpXG4gICAqIGBgYFxuICAgKiBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvY2xpZW50KS5cbiAgICovXG5cbiAgbmV3IDxcbiAgICBPcHRpb25zIGV4dGVuZHMgUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnMgPSBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9ucyxcbiAgICBMb2dPcHRzIGV4dGVuZHMgTG9nT3B0aW9uczxPcHRpb25zPiA9IExvZ09wdGlvbnM8T3B0aW9ucz4sXG4gICAgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddID0gT3B0aW9ucyBleHRlbmRzIHsgb21pdDogaW5mZXIgVSB9ID8gVSA6IFByaXNtYS5QcmlzbWFDbGllbnRPcHRpb25zWydvbWl0J10sXG4gICAgRXh0QXJncyBleHRlbmRzIHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5JbnRlcm5hbEFyZ3MgPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuRGVmYXVsdEFyZ3NcbiAgPihvcHRpb25zOiBQcmlzbWEuUHJpc21hQ2xpZW50Q29uc3RydWN0b3JBcmdzPE9wdGlvbnM+KTogUHJpc21hQ2xpZW50PExvZ09wdHMsIE9taXRPcHRzLCBFeHRBcmdzPlxufVxuXG4vKipcbiAqICMjIFByaXNtYSBDbGllbnRcbiAqIFxuICogVHlwZS1zYWZlIGRhdGFiYXNlIGNsaWVudCBmb3IgVHlwZVNjcmlwdFxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogY29uc3QgcHJpc21hID0gbmV3IFByaXNtYUNsaWVudCh7XG4gKiAgIGFkYXB0ZXI6IG5ldyBQcmlzbWFQZyh7IGNvbm5lY3Rpb25TdHJpbmc6IHByb2Nlc3MuZW52LkRBVEFCQVNFX1VSTCB9KVxuICogfSlcbiAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBCbG9nUG9zdHNcbiAqIGNvbnN0IGJsb2dQb3N0cyA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSgpXG4gKiBgYGBcbiAqIFxuICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvY2xpZW50KS5cbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudDxcbiAgaW4gTG9nT3B0cyBleHRlbmRzIFByaXNtYS5Mb2dMZXZlbCA9IG5ldmVyLFxuICBpbiBvdXQgT21pdE9wdHMgZXh0ZW5kcyBQcmlzbWEuUHJpc21hQ2xpZW50T3B0aW9uc1snb21pdCddID0gUHJpc21hLlByaXNtYUNsaWVudE9wdGlvbnNbJ29taXQnXSxcbiAgaW4gb3V0IEV4dEFyZ3MgZXh0ZW5kcyBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuSW50ZXJuYWxBcmdzID0gcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzXG4+IHtcbiAgW0s6IHN5bWJvbF06IHsgdHlwZXM6IFByaXNtYS5UeXBlTWFwPEV4dEFyZ3M+WydvdGhlciddIH1cblxuICAkb248ViBleHRlbmRzIExvZ09wdHM+KGV2ZW50VHlwZTogViwgY2FsbGJhY2s6IChldmVudDogViBleHRlbmRzICdxdWVyeScgPyBQcmlzbWEuUXVlcnlFdmVudCA6IFByaXNtYS5Mb2dFdmVudCkgPT4gdm9pZCk6IFByaXNtYUNsaWVudDtcblxuICAvKipcbiAgICogQ29ubmVjdCB3aXRoIHRoZSBkYXRhYmFzZVxuICAgKi9cbiAgJGNvbm5lY3QoKTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8dm9pZD47XG5cbiAgLyoqXG4gICAqIERpc2Nvbm5lY3QgZnJvbSB0aGUgZGF0YWJhc2VcbiAgICovXG4gICRkaXNjb25uZWN0KCk6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuSnNQcm9taXNlPHZvaWQ+O1xuXG4vKipcbiAgICogRXhlY3V0ZXMgYSBwcmVwYXJlZCByYXcgcXVlcnkgYW5kIHJldHVybnMgdGhlIG51bWJlciBvZiBhZmZlY3RlZCByb3dzLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBcbiAgICogY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJpc21hLiRleGVjdXRlUmF3YFVQREFURSBVc2VyIFNFVCBjb29sID0gJHt0cnVlfSBXSEVSRSBlbWFpbCA9ICR7J3VzZXJAZW1haWwuY29tJ307YFxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJGV4ZWN1dGVSYXc8VCA9IHVua25vd24+KHF1ZXJ5OiBUZW1wbGF0ZVN0cmluZ3NBcnJheSB8IFByaXNtYS5TcWwsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxudW1iZXI+O1xuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyBhIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIHJvd3MuXG4gICAqIFN1c2NlcHRpYmxlIHRvIFNRTCBpbmplY3Rpb25zLCBzZWUgZG9jdW1lbnRhdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kZXhlY3V0ZVJhd1Vuc2FmZSgnVVBEQVRFIFVzZXIgU0VUIGNvb2wgPSAkMSBXSEVSRSBlbWFpbCA9ICQyIDsnLCB0cnVlLCAndXNlckBlbWFpbC5jb20nKVxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJGV4ZWN1dGVSYXdVbnNhZmU8VCA9IHVua25vd24+KHF1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxudW1iZXI+O1xuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBhIHByZXBhcmVkIHJhdyBxdWVyeSBhbmQgcmV0dXJucyB0aGUgYFNFTEVDVGAgZGF0YS5cbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByaXNtYS4kcXVlcnlSYXdgU0VMRUNUICogRlJPTSBVc2VyIFdIRVJFIGlkID0gJHsxfSBPUiBlbWFpbCA9ICR7J3VzZXJAZW1haWwuY29tJ307YFxuICAgKiBgYGBcbiAgICpcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvcmF3LXF1ZXJpZXMpLlxuICAgKi9cbiAgJHF1ZXJ5UmF3PFQgPSB1bmtub3duPihxdWVyeTogVGVtcGxhdGVTdHJpbmdzQXJyYXkgfCBQcmlzbWEuU3FsLCAuLi52YWx1ZXM6IGFueVtdKTogUHJpc21hLlByaXNtYVByb21pc2U8VD47XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIGEgcmF3IHF1ZXJ5IGFuZCByZXR1cm5zIHRoZSBgU0VMRUNUYCBkYXRhLlxuICAgKiBTdXNjZXB0aWJsZSB0byBTUUwgaW5qZWN0aW9ucywgc2VlIGRvY3VtZW50YXRpb24uXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCByZXN1bHQgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3VW5zYWZlKCdTRUxFQ1QgKiBGUk9NIFVzZXIgV0hFUkUgaWQgPSAkMSBPUiBlbWFpbCA9ICQyOycsIDEsICd1c2VyQGVtYWlsLmNvbScpXG4gICAqIGBgYFxuICAgKlxuICAgKiBSZWFkIG1vcmUgaW4gb3VyIFtkb2NzXShodHRwczovL3ByaXMubHkvZC9yYXctcXVlcmllcykuXG4gICAqL1xuICAkcXVlcnlSYXdVbnNhZmU8VCA9IHVua25vd24+KHF1ZXJ5OiBzdHJpbmcsIC4uLnZhbHVlczogYW55W10pOiBQcmlzbWEuUHJpc21hUHJvbWlzZTxUPjtcblxuXG4gIC8qKlxuICAgKiBBbGxvd3MgdGhlIHJ1bm5pbmcgb2YgYSBzZXF1ZW5jZSBvZiByZWFkL3dyaXRlIG9wZXJhdGlvbnMgdGhhdCBhcmUgZ3VhcmFudGVlZCB0byBlaXRoZXIgc3VjY2VlZCBvciBmYWlsIGFzIGEgd2hvbGUuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiBjb25zdCBbZ2VvcmdlLCBib2IsIGFsaWNlXSA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oW1xuICAgKiAgIHByaXNtYS51c2VyLmNyZWF0ZSh7IGRhdGE6IHsgbmFtZTogJ0dlb3JnZScgfSB9KSxcbiAgICogICBwcmlzbWEudXNlci5jcmVhdGUoeyBkYXRhOiB7IG5hbWU6ICdCb2InIH0gfSksXG4gICAqICAgcHJpc21hLnVzZXIuY3JlYXRlKHsgZGF0YTogeyBuYW1lOiAnQWxpY2UnIH0gfSksXG4gICAqIF0pXG4gICAqIGBgYFxuICAgKiBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3Mvb3JtL3ByaXNtYS1jbGllbnQvcXVlcmllcy90cmFuc2FjdGlvbnMpLlxuICAgKi9cbiAgJHRyYW5zYWN0aW9uPFAgZXh0ZW5kcyBQcmlzbWEuUHJpc21hUHJvbWlzZTxhbnk+W10+KGFyZzogWy4uLlBdLCBvcHRpb25zPzogeyBtYXhXYWl0PzogbnVtYmVyLCB0aW1lb3V0PzogbnVtYmVyLCBpc29sYXRpb25MZXZlbD86IFByaXNtYS5UcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsIH0pOiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxydW50aW1lLlR5cGVzLlV0aWxzLlVud3JhcFR1cGxlPFA+PlxuXG4gICR0cmFuc2FjdGlvbjxSPihmbjogKHByaXNtYTogT21pdDxQcmlzbWFDbGllbnQsIHJ1bnRpbWUuSVRYQ2xpZW50RGVueUxpc3Q+KSA9PiBydW50aW1lLlR5cGVzLlV0aWxzLkpzUHJvbWlzZTxSPiwgb3B0aW9ucz86IHsgbWF4V2FpdD86IG51bWJlciwgdGltZW91dD86IG51bWJlciwgaXNvbGF0aW9uTGV2ZWw/OiBQcmlzbWEuVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCB9KTogcnVudGltZS5UeXBlcy5VdGlscy5Kc1Byb21pc2U8Uj5cblxuICAkZXh0ZW5kczogcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkV4dGVuZHNIb29rPFwiZXh0ZW5kc1wiLCBQcmlzbWEuVHlwZU1hcENiPE9taXRPcHRzPiwgRXh0QXJncywgcnVudGltZS5UeXBlcy5VdGlscy5DYWxsPFByaXNtYS5UeXBlTWFwQ2I8T21pdE9wdHM+LCB7XG4gICAgZXh0QXJnczogRXh0QXJnc1xuICB9Pj5cblxuICAgICAgLyoqXG4gICAqIGBwcmlzbWEuYmxvZ1Bvc3RgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQmxvZ1Bvc3QqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIEJsb2dQb3N0c1xuICAgICogY29uc3QgYmxvZ1Bvc3RzID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBibG9nUG9zdCgpOiBQcmlzbWEuQmxvZ1Bvc3REZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmJvb2tpbmdgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqQm9va2luZyoqIG1vZGVsLlxuICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAqIGBgYHRzXG4gICAgKiAvLyBGZXRjaCB6ZXJvIG9yIG1vcmUgQm9va2luZ3NcbiAgICAqIGNvbnN0IGJvb2tpbmdzID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoKVxuICAgICogYGBgXG4gICAgKi9cbiAgZ2V0IGJvb2tpbmcoKTogUHJpc21hLkJvb2tpbmdEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmNhdGVnb3J5YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkNhdGVnb3J5KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBDYXRlZ29yaWVzXG4gICAgKiBjb25zdCBjYXRlZ29yaWVzID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBjYXRlZ29yeSgpOiBQcmlzbWEuQ2F0ZWdvcnlEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLmNvbnRhY3RNZXNzYWdlYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKkNvbnRhY3RNZXNzYWdlKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBDb250YWN0TWVzc2FnZXNcbiAgICAqIGNvbnN0IGNvbnRhY3RNZXNzYWdlcyA9IGF3YWl0IHByaXNtYS5jb250YWN0TWVzc2FnZS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgY29udGFjdE1lc3NhZ2UoKTogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5wYXltZW50YDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlBheW1lbnQqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFBheW1lbnRzXG4gICAgKiBjb25zdCBwYXltZW50cyA9IGF3YWl0IHByaXNtYS5wYXltZW50LmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCBwYXltZW50KCk6IFByaXNtYS5QYXltZW50RGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS5yZXZpZXdgOiBFeHBvc2VzIENSVUQgb3BlcmF0aW9ucyBmb3IgdGhlICoqUmV2aWV3KiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBSZXZpZXdzXG4gICAgKiBjb25zdCByZXZpZXdzID0gYXdhaXQgcHJpc21hLnJldmlldy5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgcmV2aWV3KCk6IFByaXNtYS5SZXZpZXdEZWxlZ2F0ZTxFeHRBcmdzLCB7IG9taXQ6IE9taXRPcHRzIH0+O1xuXG4gIC8qKlxuICAgKiBgcHJpc21hLnRvdXJQYWNrYWdlYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlRvdXJQYWNrYWdlKiogbW9kZWwuXG4gICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICogYGBgdHNcbiAgICAqIC8vIEZldGNoIHplcm8gb3IgbW9yZSBUb3VyUGFja2FnZXNcbiAgICAqIGNvbnN0IHRvdXJQYWNrYWdlcyA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSgpXG4gICAgKiBgYGBcbiAgICAqL1xuICBnZXQgdG91clBhY2thZ2UoKTogUHJpc21hLlRvdXJQYWNrYWdlRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9PjtcblxuICAvKipcbiAgICogYHByaXNtYS51c2VyYDogRXhwb3NlcyBDUlVEIG9wZXJhdGlvbnMgZm9yIHRoZSAqKlVzZXIqKiBtb2RlbC5cbiAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgKiBgYGB0c1xuICAgICogLy8gRmV0Y2ggemVybyBvciBtb3JlIFVzZXJzXG4gICAgKiBjb25zdCB1c2VycyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRNYW55KClcbiAgICAqIGBgYFxuICAgICovXG4gIGdldCB1c2VyKCk6IFByaXNtYS5Vc2VyRGVsZWdhdGU8RXh0QXJncywgeyBvbWl0OiBPbWl0T3B0cyB9Pjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFByaXNtYUNsaWVudENsYXNzKCk6IFByaXNtYUNsaWVudENvbnN0cnVjdG9yIHtcbiAgcmV0dXJuIHJ1bnRpbWUuZ2V0UHJpc21hQ2xpZW50KGNvbmZpZykgYXMgdW5rbm93biBhcyBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvclxufVxuIiwgIlxuLyogISEhIFRoaXMgaXMgY29kZSBnZW5lcmF0ZWQgYnkgUHJpc21hLiBEbyBub3QgZWRpdCBkaXJlY3RseS4gISEhICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gYmlvbWUtaWdub3JlLWFsbCBsaW50OiBnZW5lcmF0ZWQgZmlsZVxuLy8gQHRzLW5vY2hlY2sgXG4vKlxuICogV0FSTklORzogVGhpcyBpcyBhbiBpbnRlcm5hbCBmaWxlIHRoYXQgaXMgc3ViamVjdCB0byBjaGFuZ2UhXG4gKlxuICogXHVEODNEXHVERUQxIFVuZGVyIG5vIGNpcmN1bXN0YW5jZXMgc2hvdWxkIHlvdSBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5ISBcdUQ4M0RcdURFRDFcbiAqXG4gKiBBbGwgZXhwb3J0cyBmcm9tIHRoaXMgZmlsZSBhcmUgd3JhcHBlZCB1bmRlciBhIGBQcmlzbWFgIG5hbWVzcGFjZSBvYmplY3QgaW4gdGhlIGNsaWVudC50cyBmaWxlLlxuICogV2hpbGUgdGhpcyBlbmFibGVzIHBhcnRpYWwgYmFja3dhcmQgY29tcGF0aWJpbGl0eSwgaXQgaXMgbm90IHBhcnQgb2YgdGhlIHN0YWJsZSBwdWJsaWMgQVBJLlxuICpcbiAqIElmIHlvdSBhcmUgbG9va2luZyBmb3IgeW91ciBNb2RlbHMsIEVudW1zLCBhbmQgSW5wdXQgVHlwZXMsIHBsZWFzZSBpbXBvcnQgdGhlbSBmcm9tIHRoZSByZXNwZWN0aXZlXG4gKiBtb2RlbCBmaWxlcyBpbiB0aGUgYG1vZGVsYCBkaXJlY3RvcnkhXG4gKi9cblxuaW1wb3J0ICogYXMgcnVudGltZSBmcm9tIFwiQHByaXNtYS9jbGllbnQvcnVudGltZS9jbGllbnRcIlxuaW1wb3J0IHR5cGUgKiBhcyBQcmlzbWEgZnJvbSBcIi4uL21vZGVsc1wiXG5pbXBvcnQgeyB0eXBlIFByaXNtYUNsaWVudCB9IGZyb20gXCIuL2NsYXNzXCJcblxuZXhwb3J0IHR5cGUgKiBmcm9tICcuLi9tb2RlbHMnXG5cbmV4cG9ydCB0eXBlIERNTUYgPSB0eXBlb2YgcnVudGltZS5ETU1GXG5cbmV4cG9ydCB0eXBlIFByaXNtYVByb21pc2U8VD4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5QcmlzbWFQcm9taXNlPFQ+XG5cbi8qKlxuICogUHJpc21hIEVycm9yc1xuICovXG5cbmV4cG9ydCBjb25zdCBQcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50S25vd25SZXF1ZXN0RXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yID0gcnVudGltZS5QcmlzbWFDbGllbnRLbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuZXhwb3J0IHR5cGUgUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VW5rbm93blJlcXVlc3RFcnJvclxuXG5leHBvcnQgY29uc3QgUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRSdXN0UGFuaWNFcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50UnVzdFBhbmljRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcbmV4cG9ydCB0eXBlIFByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudEluaXRpYWxpemF0aW9uRXJyb3JcblxuZXhwb3J0IGNvbnN0IFByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvciA9IHJ1bnRpbWUuUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRWYWxpZGF0aW9uRXJyb3IgPSBydW50aW1lLlByaXNtYUNsaWVudFZhbGlkYXRpb25FcnJvclxuXG4vKipcbiAqIFJlLWV4cG9ydCBvZiBzcWwtdGVtcGxhdGUtdGFnXG4gKi9cbmV4cG9ydCBjb25zdCBzcWwgPSBydW50aW1lLnNxbHRhZ1xuZXhwb3J0IGNvbnN0IGVtcHR5ID0gcnVudGltZS5lbXB0eVxuZXhwb3J0IGNvbnN0IGpvaW4gPSBydW50aW1lLmpvaW5cbmV4cG9ydCBjb25zdCByYXcgPSBydW50aW1lLnJhd1xuZXhwb3J0IGNvbnN0IFNxbCA9IHJ1bnRpbWUuU3FsXG5leHBvcnQgdHlwZSBTcWwgPSBydW50aW1lLlNxbFxuXG5cblxuLyoqXG4gKiBEZWNpbWFsLmpzXG4gKi9cbmV4cG9ydCBjb25zdCBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5leHBvcnQgdHlwZSBEZWNpbWFsID0gcnVudGltZS5EZWNpbWFsXG5cbmV4cG9ydCB0eXBlIERlY2ltYWxKc0xpa2UgPSBydW50aW1lLkRlY2ltYWxKc0xpa2VcblxuLyoqXG4qIEV4dGVuc2lvbnNcbiovXG5leHBvcnQgdHlwZSBFeHRlbnNpb24gPSBydW50aW1lLlR5cGVzLkV4dGVuc2lvbnMuVXNlckFyZ3NcbmV4cG9ydCBjb25zdCBnZXRFeHRlbnNpb25Db250ZXh0ID0gcnVudGltZS5FeHRlbnNpb25zLmdldEV4dGVuc2lvbkNvbnRleHRcbmV4cG9ydCB0eXBlIEFyZ3M8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uPiA9IHJ1bnRpbWUuVHlwZXMuUHVibGljLkFyZ3M8VCwgRj5cbmV4cG9ydCB0eXBlIFBheWxvYWQ8VCwgRiBleHRlbmRzIHJ1bnRpbWUuT3BlcmF0aW9uID0gbmV2ZXI+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuUGF5bG9hZDxULCBGPlxuZXhwb3J0IHR5cGUgUmVzdWx0PFQsIEEsIEYgZXh0ZW5kcyBydW50aW1lLk9wZXJhdGlvbj4gPSBydW50aW1lLlR5cGVzLlB1YmxpYy5SZXN1bHQ8VCwgQSwgRj5cbmV4cG9ydCB0eXBlIEV4YWN0PEEsIFc+ID0gcnVudGltZS5UeXBlcy5QdWJsaWMuRXhhY3Q8QSwgVz5cblxuZXhwb3J0IHR5cGUgUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBzdHJpbmdcbiAgZW5naW5lOiBzdHJpbmdcbn1cblxuLyoqXG4gKiBQcmlzbWEgQ2xpZW50IEpTIHZlcnNpb246IDcuOS4xXG4gKiBRdWVyeSBFbmdpbmUgdmVyc2lvbjogZTkyMjA4OWI3ZDc1MDJhZmY0MjQ5ZDVkYTM0MjBmNmZhNTVmYzZhZFxuICovXG5leHBvcnQgY29uc3QgcHJpc21hVmVyc2lvbjogUHJpc21hVmVyc2lvbiA9IHtcbiAgY2xpZW50OiBcIjcuOS4xXCIsXG4gIGVuZ2luZTogXCJlOTIyMDg5YjdkNzUwMmFmZjQyNDlkNWRhMzQyMGY2ZmE1NWZjNmFkXCJcbn1cblxuLyoqXG4gKiBVdGlsaXR5IFR5cGVzXG4gKi9cblxuZXhwb3J0IHR5cGUgQnl0ZXMgPSBydW50aW1lLkJ5dGVzXG5leHBvcnQgdHlwZSBKc29uT2JqZWN0ID0gcnVudGltZS5Kc29uT2JqZWN0XG5leHBvcnQgdHlwZSBKc29uQXJyYXkgPSBydW50aW1lLkpzb25BcnJheVxuZXhwb3J0IHR5cGUgSnNvblZhbHVlID0gcnVudGltZS5Kc29uVmFsdWVcbmV4cG9ydCB0eXBlIElucHV0SnNvbk9iamVjdCA9IHJ1bnRpbWUuSW5wdXRKc29uT2JqZWN0XG5leHBvcnQgdHlwZSBJbnB1dEpzb25BcnJheSA9IHJ1bnRpbWUuSW5wdXRKc29uQXJyYXlcbmV4cG9ydCB0eXBlIElucHV0SnNvblZhbHVlID0gcnVudGltZS5JbnB1dEpzb25WYWx1ZVxuXG5cbmV4cG9ydCBjb25zdCBOdWxsVHlwZXMgPSB7XG4gIERiTnVsbDogcnVudGltZS5OdWxsVHlwZXMuRGJOdWxsIGFzIChuZXcgKHNlY3JldDogbmV2ZXIpID0+IHR5cGVvZiBydW50aW1lLkRiTnVsbCksXG4gIEpzb25OdWxsOiBydW50aW1lLk51bGxUeXBlcy5Kc29uTnVsbCBhcyAobmV3IChzZWNyZXQ6IG5ldmVyKSA9PiB0eXBlb2YgcnVudGltZS5Kc29uTnVsbCksXG4gIEFueU51bGw6IHJ1bnRpbWUuTnVsbFR5cGVzLkFueU51bGwgYXMgKG5ldyAoc2VjcmV0OiBuZXZlcikgPT4gdHlwZW9mIHJ1bnRpbWUuQW55TnVsbCksXG59XG4vKipcbiAqIEhlbHBlciBmb3IgZmlsdGVyaW5nIEpTT04gZW50cmllcyB0aGF0IGhhdmUgYG51bGxgIG9uIHRoZSBkYXRhYmFzZSAoZW1wdHkgb24gdGhlIGRiKVxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IERiTnVsbCA9IHJ1bnRpbWUuRGJOdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgaGF2ZSBKU09OIGBudWxsYCB2YWx1ZXMgKG5vdCBlbXB0eSBvbiB0aGUgZGIpXG4gKlxuICogQHNlZSBodHRwczovL3d3dy5wcmlzbWEuaW8vZG9jcy9jb25jZXB0cy9jb21wb25lbnRzL3ByaXNtYS1jbGllbnQvd29ya2luZy13aXRoLWZpZWxkcy93b3JraW5nLXdpdGgtanNvbi1maWVsZHMjZmlsdGVyaW5nLW9uLWEtanNvbi1maWVsZFxuICovXG5leHBvcnQgY29uc3QgSnNvbk51bGwgPSBydW50aW1lLkpzb25OdWxsXG5cbi8qKlxuICogSGVscGVyIGZvciBmaWx0ZXJpbmcgSlNPTiBlbnRyaWVzIHRoYXQgYXJlIGBQcmlzbWEuRGJOdWxsYCBvciBgUHJpc21hLkpzb25OdWxsYFxuICpcbiAqIEBzZWUgaHR0cHM6Ly93d3cucHJpc21hLmlvL2RvY3MvY29uY2VwdHMvY29tcG9uZW50cy9wcmlzbWEtY2xpZW50L3dvcmtpbmctd2l0aC1maWVsZHMvd29ya2luZy13aXRoLWpzb24tZmllbGRzI2ZpbHRlcmluZy1vbi1hLWpzb24tZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IEFueU51bGwgPSBydW50aW1lLkFueU51bGxcblxuXG50eXBlIFNlbGVjdEFuZEluY2x1ZGUgPSB7XG4gIHNlbGVjdDogYW55XG4gIGluY2x1ZGU6IGFueVxufVxuXG50eXBlIFNlbGVjdEFuZE9taXQgPSB7XG4gIHNlbGVjdDogYW55XG4gIG9taXQ6IGFueVxufVxuXG4vKipcbiAqIEZyb20gVCwgcGljayBhIHNldCBvZiBwcm9wZXJ0aWVzIHdob3NlIGtleXMgYXJlIGluIHRoZSB1bmlvbiBLXG4gKi9cbnR5cGUgUHJpc21hX19QaWNrPFQsIEsgZXh0ZW5kcyBrZXlvZiBUPiA9IHtcbiAgICBbUCBpbiBLXTogVFtQXTtcbn07XG5cbmV4cG9ydCB0eXBlIEVudW1lcmFibGU8VD4gPSBUIHwgQXJyYXk8VD47XG5cbi8qKlxuICogU3Vic2V0XG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAuIFNpbXBsZSB2ZXJzaW9uIG9mIEludGVyc2VjdGlvblxuICovXG5leHBvcnQgdHlwZSBTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlcjtcbn07XG5cbi8qKlxuICogUmVzb2x2ZWQgdHlwZSBvZiB0aGUgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBgUHJpc21hQ2xpZW50YCBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBXaGVuIGNhbGxlZCB3aXRob3V0IGEgbmFycm93ZXIgb3B0aW9ucyB0eXBlICh0aGUgY29tbW9uIGNhc2UpLCB0aGlzIHJlc29sdmVzXG4gKiB0byBgUHJpc21hQ2xpZW50T3B0aW9uc2AgZGlyZWN0bHksIHdoaWNoIHByb2R1Y2VzIGEgY2xlYXIgVHlwZVNjcmlwdCBlcnJvclxuICogbWVzc2FnZSAoYG5vdCBhc3NpZ25hYmxlIHRvIHBhcmFtZXRlciBvZiB0eXBlICdQcmlzbWFDbGllbnRPcHRpb25zJ2ApIHdoZW5cbiAqIHRoZSBhcmd1bWVudCBpcyBtaXNzaW5nIG9yIGluY29tcGxldGUuIFdoZW4gdGhlIHVzZXIgc3VwcGxpZXMgYSBuYXJyb3dlclxuICogb3B0aW9ucyB0eXBlIChlLmcuIHZpYSBhIGxpdGVyYWwpLCBpdCBmYWxscyBiYWNrIHRvIGBTdWJzZXRgIHRvIGtlZXBcbiAqIGZpbHRlcmluZyBvdXQgdW5rbm93biBwcm9wZXJ0aWVzLlxuICovXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRDb25zdHJ1Y3RvckFyZ3M8T3B0aW9ucyBleHRlbmRzIFByaXNtYUNsaWVudE9wdGlvbnM+ID1cbiAgW1ByaXNtYUNsaWVudE9wdGlvbnNdIGV4dGVuZHMgW09wdGlvbnNdID8gUHJpc21hQ2xpZW50T3B0aW9ucyA6IFN1YnNldDxPcHRpb25zLCBQcmlzbWFDbGllbnRPcHRpb25zPjtcblxuLyoqXG4gKiBTZWxlY3RTdWJzZXRcbiAqIEBkZXNjIEZyb20gYFRgIHBpY2sgcHJvcGVydGllcyB0aGF0IGV4aXN0IGluIGBVYC4gU2ltcGxlIHZlcnNpb24gb2YgSW50ZXJzZWN0aW9uLlxuICogQWRkaXRpb25hbGx5LCBpdCB2YWxpZGF0ZXMsIGlmIGJvdGggc2VsZWN0IGFuZCBpbmNsdWRlIGFyZSBwcmVzZW50LiBJZiB0aGUgY2FzZSwgaXQgZXJyb3JzLlxuICovXG5leHBvcnQgdHlwZSBTZWxlY3RTdWJzZXQ8VCwgVT4gPSB7XG4gIFtrZXkgaW4ga2V5b2YgVF06IGtleSBleHRlbmRzIGtleW9mIFUgPyBUW2tleV0gOiBuZXZlclxufSAmXG4gIChUIGV4dGVuZHMgU2VsZWN0QW5kSW5jbHVkZVxuICAgID8gJ1BsZWFzZSBlaXRoZXIgY2hvb3NlIGBzZWxlY3RgIG9yIGBpbmNsdWRlYC4nXG4gICAgOiBUIGV4dGVuZHMgU2VsZWN0QW5kT21pdFxuICAgICAgPyAnUGxlYXNlIGVpdGhlciBjaG9vc2UgYHNlbGVjdGAgb3IgYG9taXRgLidcbiAgICAgIDoge30pXG5cbi8qKlxuICogU3Vic2V0ICsgSW50ZXJzZWN0aW9uXG4gKiBAZGVzYyBGcm9tIGBUYCBwaWNrIHByb3BlcnRpZXMgdGhhdCBleGlzdCBpbiBgVWAgYW5kIGludGVyc2VjdCBgS2BcbiAqL1xuZXhwb3J0IHR5cGUgU3Vic2V0SW50ZXJzZWN0aW9uPFQsIFUsIEs+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiBrZXkgZXh0ZW5kcyBrZXlvZiBVID8gVFtrZXldIDogbmV2ZXJcbn0gJlxuICBLXG5cbnR5cGUgV2l0aG91dDxULCBVPiA9IHsgW1AgaW4gRXhjbHVkZTxrZXlvZiBULCBrZXlvZiBVPl0/OiBuZXZlciB9O1xuXG4vKipcbiAqIFhPUiBpcyBuZWVkZWQgdG8gaGF2ZSBhIHJlYWwgbXV0dWFsbHkgZXhjbHVzaXZlIHVuaW9uIHR5cGVcbiAqIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQyMTIzNDA3L2RvZXMtdHlwZXNjcmlwdC1zdXBwb3J0LW11dHVhbGx5LWV4Y2x1c2l2ZS10eXBlc1xuICovXG5leHBvcnQgdHlwZSBYT1I8VCwgVT4gPVxuICBUIGV4dGVuZHMgb2JqZWN0ID9cbiAgVSBleHRlbmRzIG9iamVjdCA/XG4gICAgKChXaXRob3V0PFQsIFU+ICYgVSkgfCAoV2l0aG91dDxVLCBUPiAmIFQpKSAmIG9iamVjdFxuICA6IFUgOiBUXG5cblxuLyoqXG4gKiBJcyBUIGEgUmVjb3JkP1xuICovXG50eXBlIElzT2JqZWN0PFQgZXh0ZW5kcyBhbnk+ID0gVCBleHRlbmRzIEFycmF5PGFueT5cbj8gRmFsc2VcbjogVCBleHRlbmRzIERhdGVcbj8gRmFsc2VcbjogVCBleHRlbmRzIFVpbnQ4QXJyYXlcbj8gRmFsc2VcbjogVCBleHRlbmRzIEJpZ0ludFxuPyBGYWxzZVxuOiBUIGV4dGVuZHMgb2JqZWN0XG4/IFRydWVcbjogRmFsc2VcblxuXG4vKipcbiAqIElmIGl0J3MgVFtdLCByZXR1cm4gVFxuICovXG5leHBvcnQgdHlwZSBVbkVudW1lcmF0ZTxUIGV4dGVuZHMgdW5rbm93bj4gPSBUIGV4dGVuZHMgQXJyYXk8aW5mZXIgVT4gPyBVIDogVFxuXG4vKipcbiAqIEZyb20gdHMtdG9vbGJlbHRcbiAqL1xuXG50eXBlIF9fRWl0aGVyPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gT21pdDxPLCBLPiAmXG4gIHtcbiAgICAvLyBNZXJnZSBhbGwgYnV0IEtcbiAgICBbUCBpbiBLXTogUHJpc21hX19QaWNrPE8sIFAgJiBrZXlvZiBPPiAvLyBXaXRoIEsgcG9zc2liaWxpdGllc1xuICB9W0tdXG5cbnR5cGUgRWl0aGVyU3RyaWN0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gU3RyaWN0PF9fRWl0aGVyPE8sIEs+PlxuXG50eXBlIEVpdGhlckxvb3NlPE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXk+ID0gQ29tcHV0ZVJhdzxfX0VpdGhlcjxPLCBLPj5cblxudHlwZSBfRWl0aGVyPFxuICBPIGV4dGVuZHMgb2JqZWN0LFxuICBLIGV4dGVuZHMgS2V5LFxuICBzdHJpY3QgZXh0ZW5kcyBCb29sZWFuXG4+ID0ge1xuICAxOiBFaXRoZXJTdHJpY3Q8TywgSz5cbiAgMDogRWl0aGVyTG9vc2U8TywgSz5cbn1bc3RyaWN0XVxuXG5leHBvcnQgdHlwZSBFaXRoZXI8XG4gIE8gZXh0ZW5kcyBvYmplY3QsXG4gIEsgZXh0ZW5kcyBLZXksXG4gIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxXG4+ID0gTyBleHRlbmRzIHVua25vd24gPyBfRWl0aGVyPE8sIEssIHN0cmljdD4gOiBuZXZlclxuXG5leHBvcnQgdHlwZSBVbmlvbiA9IGFueVxuXG5leHBvcnQgdHlwZSBQYXRjaFVuZGVmaW5lZDxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gIFtLIGluIGtleW9mIE9dOiBPW0tdIGV4dGVuZHMgdW5kZWZpbmVkID8gQXQ8TzEsIEs+IDogT1tLXVxufSAmIHt9XG5cbi8qKiBIZWxwZXIgVHlwZXMgZm9yIFwiTWVyZ2VcIiAqKi9cbmV4cG9ydCB0eXBlIEludGVyc2VjdE9mPFUgZXh0ZW5kcyBVbmlvbj4gPSAoXG4gIFUgZXh0ZW5kcyB1bmtub3duID8gKGs6IFUpID0+IHZvaWQgOiBuZXZlclxuKSBleHRlbmRzIChrOiBpbmZlciBJKSA9PiB2b2lkXG4gID8gSVxuICA6IG5ldmVyXG5cbmV4cG9ydCB0eXBlIE92ZXJ3cml0ZTxPIGV4dGVuZHMgb2JqZWN0LCBPMSBleHRlbmRzIG9iamVjdD4gPSB7XG4gICAgW0sgaW4ga2V5b2YgT106IEsgZXh0ZW5kcyBrZXlvZiBPMSA/IE8xW0tdIDogT1tLXTtcbn0gJiB7fTtcblxudHlwZSBfTWVyZ2U8VSBleHRlbmRzIG9iamVjdD4gPSBJbnRlcnNlY3RPZjxPdmVyd3JpdGU8VSwge1xuICAgIFtLIGluIGtleW9mIFVdLT86IEF0PFUsIEs+O1xufT4+O1xuXG50eXBlIEtleSA9IHN0cmluZyB8IG51bWJlciB8IHN5bWJvbDtcbnR5cGUgQXRTdHJpY3Q8TyBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIEtleT4gPSBPW0sgJiBrZXlvZiBPXTtcbnR5cGUgQXRMb29zZTxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgS2V5PiA9IE8gZXh0ZW5kcyB1bmtub3duID8gQXRTdHJpY3Q8TywgSz4gOiBuZXZlcjtcbmV4cG9ydCB0eXBlIEF0PE8gZXh0ZW5kcyBvYmplY3QsIEsgZXh0ZW5kcyBLZXksIHN0cmljdCBleHRlbmRzIEJvb2xlYW4gPSAxPiA9IHtcbiAgICAxOiBBdFN0cmljdDxPLCBLPjtcbiAgICAwOiBBdExvb3NlPE8sIEs+O1xufVtzdHJpY3RdO1xuXG5leHBvcnQgdHlwZSBDb21wdXRlUmF3PEEgZXh0ZW5kcyBhbnk+ID0gQSBleHRlbmRzIEZ1bmN0aW9uID8gQSA6IHtcbiAgW0sgaW4ga2V5b2YgQV06IEFbS107XG59ICYge307XG5cbmV4cG9ydCB0eXBlIE9wdGlvbmFsRmxhdDxPPiA9IHtcbiAgW0sgaW4ga2V5b2YgT10/OiBPW0tdO1xufSAmIHt9O1xuXG50eXBlIF9SZWNvcmQ8SyBleHRlbmRzIGtleW9mIGFueSwgVD4gPSB7XG4gIFtQIGluIEtdOiBUO1xufTtcblxuLy8gY2F1c2UgdHlwZXNjcmlwdCBub3QgdG8gZXhwYW5kIHR5cGVzIGFuZCBwcmVzZXJ2ZSBuYW1lc1xudHlwZSBOb0V4cGFuZDxUPiA9IFQgZXh0ZW5kcyB1bmtub3duID8gVCA6IG5ldmVyO1xuXG4vLyB0aGlzIHR5cGUgYXNzdW1lcyB0aGUgcGFzc2VkIG9iamVjdCBpcyBlbnRpcmVseSBvcHRpb25hbFxuZXhwb3J0IHR5cGUgQXRMZWFzdDxPIGV4dGVuZHMgb2JqZWN0LCBLIGV4dGVuZHMgc3RyaW5nPiA9IE5vRXhwYW5kPFxuICBPIGV4dGVuZHMgdW5rbm93blxuICA/IHwgKEsgZXh0ZW5kcyBrZXlvZiBPID8geyBbUCBpbiBLXTogT1tQXSB9ICYgTyA6IE8pXG4gICAgfCB7W1AgaW4ga2V5b2YgTyBhcyBQIGV4dGVuZHMgSyA/IFAgOiBuZXZlcl0tPzogT1tQXX0gJiBPXG4gIDogbmV2ZXI+O1xuXG50eXBlIF9TdHJpY3Q8VSwgX1UgPSBVPiA9IFUgZXh0ZW5kcyB1bmtub3duID8gVSAmIE9wdGlvbmFsRmxhdDxfUmVjb3JkPEV4Y2x1ZGU8S2V5czxfVT4sIGtleW9mIFU+LCBuZXZlcj4+IDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIFN0cmljdDxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X1N0cmljdDxVPj47XG4vKiogRW5kIEhlbHBlciBUeXBlcyBmb3IgXCJNZXJnZVwiICoqL1xuXG5leHBvcnQgdHlwZSBNZXJnZTxVIGV4dGVuZHMgb2JqZWN0PiA9IENvbXB1dGVSYXc8X01lcmdlPFN0cmljdDxVPj4+O1xuXG5leHBvcnQgdHlwZSBCb29sZWFuID0gVHJ1ZSB8IEZhbHNlXG5cbmV4cG9ydCB0eXBlIFRydWUgPSAxXG5cbmV4cG9ydCB0eXBlIEZhbHNlID0gMFxuXG5leHBvcnQgdHlwZSBOb3Q8QiBleHRlbmRzIEJvb2xlYW4+ID0ge1xuICAwOiAxXG4gIDE6IDBcbn1bQl1cblxuZXhwb3J0IHR5cGUgRXh0ZW5kczxBMSBleHRlbmRzIGFueSwgQTIgZXh0ZW5kcyBhbnk+ID0gW0ExXSBleHRlbmRzIFtuZXZlcl1cbiAgPyAwIC8vIGFueXRoaW5nIGBuZXZlcmAgaXMgZmFsc2VcbiAgOiBBMSBleHRlbmRzIEEyXG4gID8gMVxuICA6IDBcblxuZXhwb3J0IHR5cGUgSGFzPFUgZXh0ZW5kcyBVbmlvbiwgVTEgZXh0ZW5kcyBVbmlvbj4gPSBOb3Q8XG4gIEV4dGVuZHM8RXhjbHVkZTxVMSwgVT4sIFUxPlxuPlxuXG5leHBvcnQgdHlwZSBPcjxCMSBleHRlbmRzIEJvb2xlYW4sIEIyIGV4dGVuZHMgQm9vbGVhbj4gPSB7XG4gIDA6IHtcbiAgICAwOiAwXG4gICAgMTogMVxuICB9XG4gIDE6IHtcbiAgICAwOiAxXG4gICAgMTogMVxuICB9XG59W0IxXVtCMl1cblxuZXhwb3J0IHR5cGUgS2V5czxVIGV4dGVuZHMgVW5pb24+ID0gVSBleHRlbmRzIHVua25vd24gPyBrZXlvZiBVIDogbmV2ZXJcblxuZXhwb3J0IHR5cGUgR2V0U2NhbGFyVHlwZTxULCBPPiA9IE8gZXh0ZW5kcyBvYmplY3QgPyB7XG4gIFtQIGluIGtleW9mIFRdOiBQIGV4dGVuZHMga2V5b2YgT1xuICAgID8gT1tQXVxuICAgIDogbmV2ZXJcbn0gOiBuZXZlclxuXG50eXBlIEZpZWxkUGF0aHM8XG4gIFQsXG4gIFUgPSBPbWl0PFQsICdfYXZnJyB8ICdfc3VtJyB8ICdfY291bnQnIHwgJ19taW4nIHwgJ19tYXgnPlxuPiA9IElzT2JqZWN0PFQ+IGV4dGVuZHMgVHJ1ZSA/IFUgOiBUXG5cbmV4cG9ydCB0eXBlIEdldEhhdmluZ0ZpZWxkczxUPiA9IHtcbiAgW0sgaW4ga2V5b2YgVF06IE9yPFxuICAgIE9yPEV4dGVuZHM8J09SJywgSz4sIEV4dGVuZHM8J0FORCcsIEs+PixcbiAgICBFeHRlbmRzPCdOT1QnLCBLPlxuICA+IGV4dGVuZHMgVHJ1ZVxuICAgID8gLy8gaW5mZXIgaXMgb25seSBuZWVkZWQgdG8gbm90IGhpdCBUUyBsaW1pdFxuICAgICAgLy8gYmFzZWQgb24gdGhlIGJyaWxsaWFudCBpZGVhIG9mIFBpZXJyZS1BbnRvaW5lIE1pbGxzXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzMwMTg4I2lzc3VlY29tbWVudC00Nzg5Mzg0MzdcbiAgICAgIFRbS10gZXh0ZW5kcyBpbmZlciBUS1xuICAgICAgPyBHZXRIYXZpbmdGaWVsZHM8VW5FbnVtZXJhdGU8VEs+IGV4dGVuZHMgb2JqZWN0ID8gTWVyZ2U8VW5FbnVtZXJhdGU8VEs+PiA6IG5ldmVyPlxuICAgICAgOiBuZXZlclxuICAgIDoge30gZXh0ZW5kcyBGaWVsZFBhdGhzPFRbS10+XG4gICAgPyBuZXZlclxuICAgIDogS1xufVtrZXlvZiBUXVxuXG4vKipcbiAqIENvbnZlcnQgdHVwbGUgdG8gdW5pb25cbiAqL1xudHlwZSBfVHVwbGVUb1VuaW9uPFQ+ID0gVCBleHRlbmRzIChpbmZlciBFKVtdID8gRSA6IG5ldmVyXG50eXBlIFR1cGxlVG9VbmlvbjxLIGV4dGVuZHMgcmVhZG9ubHkgYW55W10+ID0gX1R1cGxlVG9VbmlvbjxLPlxuZXhwb3J0IHR5cGUgTWF5YmVUdXBsZVRvVW5pb248VD4gPSBUIGV4dGVuZHMgYW55W10gPyBUdXBsZVRvVW5pb248VD4gOiBUXG5cbi8qKlxuICogTGlrZSBgUGlja2AsIGJ1dCBhZGRpdGlvbmFsbHkgY2FuIGFsc28gYWNjZXB0IGFuIGFycmF5IG9mIGtleXNcbiAqL1xuZXhwb3J0IHR5cGUgUGlja0VudW1lcmFibGU8VCwgSyBleHRlbmRzIEVudW1lcmFibGU8a2V5b2YgVD4gfCBrZXlvZiBUPiA9IFByaXNtYV9fUGljazxULCBNYXliZVR1cGxlVG9VbmlvbjxLPj5cblxuLyoqXG4gKiBFeGNsdWRlIGFsbCBrZXlzIHdpdGggdW5kZXJzY29yZXNcbiAqL1xuZXhwb3J0IHR5cGUgRXhjbHVkZVVuZGVyc2NvcmVLZXlzPFQgZXh0ZW5kcyBzdHJpbmc+ID0gVCBleHRlbmRzIGBfJHtzdHJpbmd9YCA/IG5ldmVyIDogVFxuXG5cbmV4cG9ydCB0eXBlIEZpZWxkUmVmPE1vZGVsLCBGaWVsZFR5cGU+ID0gcnVudGltZS5GaWVsZFJlZjxNb2RlbCwgRmllbGRUeXBlPlxuXG50eXBlIEZpZWxkUmVmSW5wdXRUeXBlPE1vZGVsLCBGaWVsZFR5cGU+ID0gTW9kZWwgZXh0ZW5kcyBuZXZlciA/IG5ldmVyIDogRmllbGRSZWY8TW9kZWwsIEZpZWxkVHlwZT5cblxuXG5leHBvcnQgY29uc3QgTW9kZWxOYW1lID0ge1xuICBCbG9nUG9zdDogJ0Jsb2dQb3N0JyxcbiAgQm9va2luZzogJ0Jvb2tpbmcnLFxuICBDYXRlZ29yeTogJ0NhdGVnb3J5JyxcbiAgQ29udGFjdE1lc3NhZ2U6ICdDb250YWN0TWVzc2FnZScsXG4gIFBheW1lbnQ6ICdQYXltZW50JyxcbiAgUmV2aWV3OiAnUmV2aWV3JyxcbiAgVG91clBhY2thZ2U6ICdUb3VyUGFja2FnZScsXG4gIFVzZXI6ICdVc2VyJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBNb2RlbE5hbWUgPSAodHlwZW9mIE1vZGVsTmFtZSlba2V5b2YgdHlwZW9mIE1vZGVsTmFtZV1cblxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgVHlwZU1hcENiPEdsb2JhbE9taXRPcHRpb25zID0ge30+IGV4dGVuZHMgcnVudGltZS5UeXBlcy5VdGlscy5Gbjx7ZXh0QXJnczogcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyB9LCBydW50aW1lLlR5cGVzLlV0aWxzLlJlY29yZDxzdHJpbmcsIGFueT4+IHtcbiAgcmV0dXJuczogVHlwZU1hcDx0aGlzWydwYXJhbXMnXVsnZXh0QXJncyddLCBHbG9iYWxPbWl0T3B0aW9ucz5cbn1cblxuZXhwb3J0IHR5cGUgVHlwZU1hcDxFeHRBcmdzIGV4dGVuZHMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkludGVybmFsQXJncyA9IHJ1bnRpbWUuVHlwZXMuRXh0ZW5zaW9ucy5EZWZhdWx0QXJncywgR2xvYmFsT21pdE9wdGlvbnMgPSB7fT4gPSB7XG4gIGdsb2JhbE9taXRPcHRpb25zOiB7XG4gICAgb21pdDogR2xvYmFsT21pdE9wdGlvbnNcbiAgfVxuICBtZXRhOiB7XG4gICAgbW9kZWxQcm9wczogXCJibG9nUG9zdFwiIHwgXCJib29raW5nXCIgfCBcImNhdGVnb3J5XCIgfCBcImNvbnRhY3RNZXNzYWdlXCIgfCBcInBheW1lbnRcIiB8IFwicmV2aWV3XCIgfCBcInRvdXJQYWNrYWdlXCIgfCBcInVzZXJcIlxuICAgIHR4SXNvbGF0aW9uTGV2ZWw6IFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWxcbiAgfVxuICBtb2RlbDoge1xuICAgIEJsb2dQb3N0OiB7XG4gICAgICBwYXlsb2FkOiBQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuQmxvZ1Bvc3RGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRVbmlxdWVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZEZpcnN0T3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0RmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDcmVhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdENyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJsb2dQb3N0UGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdERlbGV0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3REZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdFVwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBkYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQmxvZ1Bvc3RQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0VXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCbG9nUG9zdFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgYWdncmVnYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJsb2dQb3N0QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlQmxvZ1Bvc3Q+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5CbG9nUG9zdEdyb3VwQnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5CbG9nUG9zdEdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQmxvZ1Bvc3RDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJsb2dQb3N0Q291bnRBZ2dyZWdhdGVPdXRwdXRUeXBlPiB8IG51bWJlclxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIEJvb2tpbmc6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQm9va2luZ1BheWxvYWQ8RXh0QXJncz5cbiAgICAgIGZpZWxkczogUHJpc21hLkJvb2tpbmdGaWVsZFJlZnNcbiAgICAgIG9wZXJhdGlvbnM6IHtcbiAgICAgICAgZmluZFVuaXF1ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRVbmlxdWVPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kVW5pcXVlT3JUaHJvd0FyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kRmlyc3RBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3RPclRocm93OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRmluZE1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJEJvb2tpbmdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0NyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDcmVhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1VwZGF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQm9va2luZ1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nRGVsZXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ1VwZGF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5bXVxuICAgICAgICB9XG4gICAgICAgIHVwc2VydDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nVXBzZXJ0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRCb29raW5nUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQm9va2luZ0FnZ3JlZ2F0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkFnZ3JlZ2F0ZUJvb2tpbmc+XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBCeToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Cb29raW5nR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJvb2tpbmdHcm91cEJ5T3V0cHV0VHlwZT5bXVxuICAgICAgICB9XG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkJvb2tpbmdDb3VudEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkJvb2tpbmdDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQ2F0ZWdvcnk6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5DYXRlZ29yeUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5Q3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ2F0ZWdvcnlQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDYXRlZ29yeVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENhdGVnb3J5UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ2F0ZWdvcnlBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVDYXRlZ29yeT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNhdGVnb3J5R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNhdGVnb3J5R3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5DYXRlZ29yeUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ2F0ZWdvcnlDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgQ29udGFjdE1lc3NhZ2U6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kQ29udGFjdE1lc3NhZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRDb250YWN0TWVzc2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJENvbnRhY3RNZXNzYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVDb250YWN0TWVzc2FnZT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLkNvbnRhY3RNZXNzYWdlR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLkNvbnRhY3RNZXNzYWdlR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Db250YWN0TWVzc2FnZUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQ29udGFjdE1lc3NhZ2VDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgUGF5bWVudDoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRQYXltZW50UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUGF5bWVudEZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudEZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUGF5bWVudFBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50Q3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnREZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRQYXltZW50UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnREZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50VXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudFVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFBheW1lbnRQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5QYXltZW50QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUGF5bWVudD5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlBheW1lbnRHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUGF5bWVudEdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUGF5bWVudENvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuUGF5bWVudENvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBSZXZpZXc6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kUmV2aWV3UGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuUmV2aWV3RmllbGRSZWZzXG4gICAgICBvcGVyYXRpb25zOiB7XG4gICAgICAgIGZpbmRVbmlxdWU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RmluZFVuaXF1ZU9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0T3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0ZpbmRNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld0NyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBkZWxldGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3RGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFJldmlld1BheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueUFuZFJldHVybjoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5SZXZpZXdVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRSZXZpZXdQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlJldmlld1Vwc2VydEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kUmV2aWV3UGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3QWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlUmV2aWV3PlxuICAgICAgICB9XG4gICAgICAgIGdyb3VwQnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3R3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlJldmlld0dyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuUmV2aWV3Q291bnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5SZXZpZXdDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgVG91clBhY2thZ2U6IHtcbiAgICAgIHBheWxvYWQ6IFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPEV4dEFyZ3M+XG4gICAgICBmaWVsZHM6IFByaXNtYS5Ub3VyUGFja2FnZUZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZFVuaXF1ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPiB8IG51bGxcbiAgICAgICAgfVxuICAgICAgICBmaW5kVW5pcXVlT3JUaHJvdzoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZEZpcnN0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRmluZEZpcnN0QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kRmlyc3RPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZmluZE1hbnk6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNyZWF0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICBjcmVhdGVNYW55QW5kUmV0dXJuOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlQ3JlYXRlTWFueUFuZFJldHVybkFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVG91clBhY2thZ2VQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlRGVsZXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZURlbGV0ZU1hbnlBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBCYXRjaFBheWxvYWRcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcGRhdGVNYW55QW5kUmV0dXJuQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRUb3VyUGFja2FnZVBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICB1cHNlcnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFRvdXJQYWNrYWdlUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBhZ2dyZWdhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVG91clBhY2thZ2VBZ2dyZWdhdGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLk9wdGlvbmFsPFByaXNtYS5BZ2dyZWdhdGVUb3VyUGFja2FnZT5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlRvdXJQYWNrYWdlR3JvdXBCeUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuT3B0aW9uYWw8UHJpc21hLlRvdXJQYWNrYWdlR3JvdXBCeU91dHB1dFR5cGU+W11cbiAgICAgICAgfVxuICAgICAgICBjb3VudDoge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Ub3VyUGFja2FnZUNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVG91clBhY2thZ2VDb3VudEFnZ3JlZ2F0ZU91dHB1dFR5cGU+IHwgbnVtYmVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgVXNlcjoge1xuICAgICAgcGF5bG9hZDogUHJpc21hLiRVc2VyUGF5bG9hZDxFeHRBcmdzPlxuICAgICAgZmllbGRzOiBQcmlzbWEuVXNlckZpZWxkUmVmc1xuICAgICAgb3BlcmF0aW9uczoge1xuICAgICAgICBmaW5kVW5pcXVlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kVW5pcXVlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD4gfCBudWxsXG4gICAgICAgIH1cbiAgICAgICAgZmluZFVuaXF1ZU9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRVbmlxdWVPclRocm93QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBmaW5kRmlyc3Q6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRGaXJzdEFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+IHwgbnVsbFxuICAgICAgICB9XG4gICAgICAgIGZpbmRGaXJzdE9yVGhyb3c6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckZpbmRGaXJzdE9yVGhyb3dBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGZpbmRNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJGaW5kTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+W11cbiAgICAgICAgfVxuICAgICAgICBjcmVhdGU6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IHJ1bnRpbWUuVHlwZXMuVXRpbHMuUGF5bG9hZFRvUmVzdWx0PFByaXNtYS4kVXNlclBheWxvYWQ+XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQ3JlYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNyZWF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlOiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJEZWxldGVBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5QYXlsb2FkVG9SZXN1bHQ8UHJpc21hLiRVc2VyUGF5bG9hZD5cbiAgICAgICAgfVxuICAgICAgICBkZWxldGVNYW55OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJEZWxldGVNYW55QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogQmF0Y2hQYXlsb2FkXG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTWFueToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyVXBkYXRlTWFueUFyZ3M8RXh0QXJncz5cbiAgICAgICAgICByZXN1bHQ6IEJhdGNoUGF5bG9hZFxuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZU1hbnlBbmRSZXR1cm46IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlclVwZGF0ZU1hbnlBbmRSZXR1cm5BcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPltdXG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJVcHNlcnRBcmdzPEV4dEFyZ3M+XG4gICAgICAgICAgcmVzdWx0OiBydW50aW1lLlR5cGVzLlV0aWxzLlBheWxvYWRUb1Jlc3VsdDxQcmlzbWEuJFVzZXJQYXlsb2FkPlxuICAgICAgICB9XG4gICAgICAgIGFnZ3JlZ2F0ZToge1xuICAgICAgICAgIGFyZ3M6IFByaXNtYS5Vc2VyQWdncmVnYXRlQXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuQWdncmVnYXRlVXNlcj5cbiAgICAgICAgfVxuICAgICAgICBncm91cEJ5OiB7XG4gICAgICAgICAgYXJnczogUHJpc21hLlVzZXJHcm91cEJ5QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVXNlckdyb3VwQnlPdXRwdXRUeXBlPltdXG4gICAgICAgIH1cbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBhcmdzOiBQcmlzbWEuVXNlckNvdW50QXJnczxFeHRBcmdzPlxuICAgICAgICAgIHJlc3VsdDogcnVudGltZS5UeXBlcy5VdGlscy5PcHRpb25hbDxQcmlzbWEuVXNlckNvdW50QWdncmVnYXRlT3V0cHV0VHlwZT4gfCBudW1iZXJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufSAmIHtcbiAgb3RoZXI6IHtcbiAgICBwYXlsb2FkOiBhbnlcbiAgICBvcGVyYXRpb25zOiB7XG4gICAgICAkZXhlY3V0ZVJhdzoge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgU3FsLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRleGVjdXRlUmF3VW5zYWZlOiB7XG4gICAgICAgIGFyZ3M6IFtxdWVyeTogc3RyaW5nLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRxdWVyeVJhdzoge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IFRlbXBsYXRlU3RyaW5nc0FycmF5IHwgU3FsLCAuLi52YWx1ZXM6IGFueVtdXSxcbiAgICAgICAgcmVzdWx0OiBhbnlcbiAgICAgIH1cbiAgICAgICRxdWVyeVJhd1Vuc2FmZToge1xuICAgICAgICBhcmdzOiBbcXVlcnk6IHN0cmluZywgLi4udmFsdWVzOiBhbnlbXV0sXG4gICAgICAgIHJlc3VsdDogYW55XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRW51bXNcbiAqL1xuXG5leHBvcnQgY29uc3QgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbCA9IHJ1bnRpbWUubWFrZVN0cmljdEVudW0oe1xuICBSZWFkVW5jb21taXR0ZWQ6ICdSZWFkVW5jb21taXR0ZWQnLFxuICBSZWFkQ29tbWl0dGVkOiAnUmVhZENvbW1pdHRlZCcsXG4gIFJlcGVhdGFibGVSZWFkOiAnUmVwZWF0YWJsZVJlYWQnLFxuICBTZXJpYWxpemFibGU6ICdTZXJpYWxpemFibGUnXG59IGFzIGNvbnN0KVxuXG5leHBvcnQgdHlwZSBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsID0gKHR5cGVvZiBUcmFuc2FjdGlvbklzb2xhdGlvbkxldmVsKVtrZXlvZiB0eXBlb2YgVHJhbnNhY3Rpb25Jc29sYXRpb25MZXZlbF1cblxuXG5leHBvcnQgY29uc3QgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBleGNlcnB0OiAnZXhjZXJwdCcsXG4gIGNvbnRlbnQ6ICdjb250ZW50JyxcbiAgY292ZXJJbWFnZTogJ2NvdmVySW1hZ2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICBpc0RlbGV0ZWQ6ICdpc0RlbGV0ZWQnLFxuICBhdXRob3JJZDogJ2F1dGhvcklkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBCbG9nUG9zdFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgQmxvZ1Bvc3RTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCbG9nUG9zdFNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgQm9va2luZ1NjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHRyYXZlbERhdGU6ICd0cmF2ZWxEYXRlJyxcbiAgdHJhdmVsZXJzOiAndHJhdmVsZXJzJyxcbiAgdG90YWxQcmljZTogJ3RvdGFsUHJpY2UnLFxuICBzdGF0dXM6ICdzdGF0dXMnLFxuICB1c2VySWQ6ICd1c2VySWQnLFxuICBwYWNrYWdlSWQ6ICdwYWNrYWdlSWQnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIEJvb2tpbmdTY2FsYXJGaWVsZEVudW0pW2tleW9mIHR5cGVvZiBCb29raW5nU2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBjcmVhdGVkQXQ6ICdjcmVhdGVkQXQnLFxuICB1cGRhdGVkQXQ6ICd1cGRhdGVkQXQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBDYXRlZ29yeVNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIENhdGVnb3J5U2NhbGFyRmllbGRFbnVtXVxuXG5cbmV4cG9ydCBjb25zdCBDb250YWN0TWVzc2FnZVNjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIG5hbWU6ICduYW1lJyxcbiAgZW1haWw6ICdlbWFpbCcsXG4gIHN1YmplY3Q6ICdzdWJqZWN0JyxcbiAgbWVzc2FnZTogJ21lc3NhZ2UnLFxuICBpc1Jlc29sdmVkOiAnaXNSZXNvbHZlZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIENvbnRhY3RNZXNzYWdlU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgQ29udGFjdE1lc3NhZ2VTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFBheW1lbnRTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBib29raW5nSWQ6ICdib29raW5nSWQnLFxuICB0cmFuSWQ6ICd0cmFuSWQnLFxuICB2YWxJZDogJ3ZhbElkJyxcbiAgYW1vdW50OiAnYW1vdW50JyxcbiAgY3VycmVuY3k6ICdjdXJyZW5jeScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGdhdGV3YXlQYWdlVXJsOiAnZ2F0ZXdheVBhZ2VVcmwnLFxuICBzc2xTZXNzaW9uS2V5OiAnc3NsU2Vzc2lvbktleScsXG4gIGNhcmRUeXBlOiAnY2FyZFR5cGUnLFxuICBiYW5rVHJhbklkOiAnYmFua1RyYW5JZCcsXG4gIHBhaWRBdDogJ3BhaWRBdCcsXG4gIHJlZnVuZFJlZklkOiAncmVmdW5kUmVmSWQnLFxuICByZWZ1bmRlZEF0OiAncmVmdW5kZWRBdCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGF5bWVudFNjYWxhckZpZWxkRW51bSA9ICh0eXBlb2YgUGF5bWVudFNjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFBheW1lbnRTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFJldmlld1NjYWxhckZpZWxkRW51bSA9IHtcbiAgaWQ6ICdpZCcsXG4gIHJhdGluZzogJ3JhdGluZycsXG4gIGNvbW1lbnQ6ICdjb21tZW50JyxcbiAgdXNlcklkOiAndXNlcklkJyxcbiAgcGFja2FnZUlkOiAncGFja2FnZUlkJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBSZXZpZXdTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFJldmlld1NjYWxhckZpZWxkRW51bSlba2V5b2YgdHlwZW9mIFJldmlld1NjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICB0aXRsZTogJ3RpdGxlJyxcbiAgc2x1ZzogJ3NsdWcnLFxuICBkZXNjcmlwdGlvbjogJ2Rlc2NyaXB0aW9uJyxcbiAgbG9jYXRpb246ICdsb2NhdGlvbicsXG4gIHByaWNlOiAncHJpY2UnLFxuICBkdXJhdGlvbjogJ2R1cmF0aW9uJyxcbiAgcmF0aW5nOiAncmF0aW5nJyxcbiAgaW1hZ2VzOiAnaW1hZ2VzJyxcbiAgc3RhdHVzOiAnc3RhdHVzJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgY2F0ZWdvcnlJZDogJ2NhdGVnb3J5SWQnLFxuICBhZ2VudElkOiAnYWdlbnRJZCcsXG4gIGNyZWF0ZWRBdDogJ2NyZWF0ZWRBdCcsXG4gIHVwZGF0ZWRBdDogJ3VwZGF0ZWRBdCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW0gPSAodHlwZW9mIFRvdXJQYWNrYWdlU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgVG91clBhY2thZ2VTY2FsYXJGaWVsZEVudW1dXG5cblxuZXhwb3J0IGNvbnN0IFVzZXJTY2FsYXJGaWVsZEVudW0gPSB7XG4gIGlkOiAnaWQnLFxuICBuYW1lOiAnbmFtZScsXG4gIGVtYWlsOiAnZW1haWwnLFxuICBwYXNzd29yZDogJ3Bhc3N3b3JkJyxcbiAgZ29vZ2xlSWQ6ICdnb29nbGVJZCcsXG4gIHBob25lOiAncGhvbmUnLFxuICBhdmF0YXJVcmw6ICdhdmF0YXJVcmwnLFxuICByb2xlOiAncm9sZScsXG4gIHN0YXR1czogJ3N0YXR1cycsXG4gIGF1dGhQcm92aWRlcjogJ2F1dGhQcm92aWRlcicsXG4gIGVtYWlsVmVyaWZpZWQ6ICdlbWFpbFZlcmlmaWVkJyxcbiAgaXNEZWxldGVkOiAnaXNEZWxldGVkJyxcbiAgdG9rZW5WZXJzaW9uOiAndG9rZW5WZXJzaW9uJyxcbiAgY3JlYXRlZEF0OiAnY3JlYXRlZEF0JyxcbiAgdXBkYXRlZEF0OiAndXBkYXRlZEF0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBVc2VyU2NhbGFyRmllbGRFbnVtID0gKHR5cGVvZiBVc2VyU2NhbGFyRmllbGRFbnVtKVtrZXlvZiB0eXBlb2YgVXNlclNjYWxhckZpZWxkRW51bV1cblxuXG5leHBvcnQgY29uc3QgU29ydE9yZGVyID0ge1xuICBhc2M6ICdhc2MnLFxuICBkZXNjOiAnZGVzYydcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgU29ydE9yZGVyID0gKHR5cGVvZiBTb3J0T3JkZXIpW2tleW9mIHR5cGVvZiBTb3J0T3JkZXJdXG5cblxuZXhwb3J0IGNvbnN0IFF1ZXJ5TW9kZSA9IHtcbiAgZGVmYXVsdDogJ2RlZmF1bHQnLFxuICBpbnNlbnNpdGl2ZTogJ2luc2Vuc2l0aXZlJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBRdWVyeU1vZGUgPSAodHlwZW9mIFF1ZXJ5TW9kZSlba2V5b2YgdHlwZW9mIFF1ZXJ5TW9kZV1cblxuXG5leHBvcnQgY29uc3QgTnVsbHNPcmRlciA9IHtcbiAgZmlyc3Q6ICdmaXJzdCcsXG4gIGxhc3Q6ICdsYXN0J1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBOdWxsc09yZGVyID0gKHR5cGVvZiBOdWxsc09yZGVyKVtrZXlvZiB0eXBlb2YgTnVsbHNPcmRlcl1cblxuXG5cbi8qKlxuICogRmllbGQgcmVmZXJlbmNlc1xuICovXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdTdHJpbmcnXG4gKi9cbmV4cG9ydCB0eXBlIFN0cmluZ0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1N0cmluZyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdTdHJpbmdbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdFN0cmluZ0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1N0cmluZ1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1Bvc3RTdGF0dXMnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Qb3N0U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUG9zdFN0YXR1cyc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdQb3N0U3RhdHVzW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUG9zdFN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1Bvc3RTdGF0dXNbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29sZWFuJ1xuICovXG5leHBvcnQgdHlwZSBCb29sZWFuRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQm9vbGVhbic+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEYXRlVGltZSdcbiAqL1xuZXhwb3J0IHR5cGUgRGF0ZVRpbWVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEYXRlVGltZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdEYXRlVGltZVtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RGF0ZVRpbWVGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdEYXRlVGltZVtdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0ludCdcbiAqL1xuZXhwb3J0IHR5cGUgSW50RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnSW50Jz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0ludFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0SW50RmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnSW50W10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGVjaW1hbCdcbiAqL1xuZXhwb3J0IHR5cGUgRGVjaW1hbEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RlY2ltYWwnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnRGVjaW1hbFtdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RGVjaW1hbEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0RlY2ltYWxbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdCb29raW5nU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtQm9va2luZ1N0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Jvb2tpbmdTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQm9va2luZ1N0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bUJvb2tpbmdTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdCb29raW5nU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGF5bWVudFN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBheW1lbnRTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYXltZW50U3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BheW1lbnRTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1QYXltZW50U3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGF5bWVudFN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Zsb2F0J1xuICovXG5leHBvcnQgdHlwZSBGbG9hdEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Zsb2F0Jz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0Zsb2F0W10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RGbG9hdEZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0Zsb2F0W10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnUGFja2FnZVN0YXR1cydcbiAqL1xuZXhwb3J0IHR5cGUgRW51bVBhY2thZ2VTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdQYWNrYWdlU3RhdHVzJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1BhY2thZ2VTdGF0dXNbXSdcbiAqL1xuZXhwb3J0IHR5cGUgTGlzdEVudW1QYWNrYWdlU3RhdHVzRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUGFja2FnZVN0YXR1c1tdJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ1JvbGUnXG4gKi9cbmV4cG9ydCB0eXBlIEVudW1Sb2xlRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnUm9sZSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdSb2xlW10nXG4gKi9cbmV4cG9ydCB0eXBlIExpc3RFbnVtUm9sZUZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1JvbGVbXSc+XG4gICAgXG5cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmaWVsZCBvZiB0eXBlICdVc2VyU3RhdHVzJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtVXNlclN0YXR1c0ZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ1VzZXJTdGF0dXMnPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnVXNlclN0YXR1c1tdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bVVzZXJTdGF0dXNGaWVsZFJlZklucHV0PCRQcmlzbWFNb2RlbD4gPSBGaWVsZFJlZklucHV0VHlwZTwkUHJpc21hTW9kZWwsICdVc2VyU3RhdHVzW10nPlxuICAgIFxuXG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIGEgZmllbGQgb2YgdHlwZSAnQXV0aFByb3ZpZGVyJ1xuICovXG5leHBvcnQgdHlwZSBFbnVtQXV0aFByb3ZpZGVyRmllbGRSZWZJbnB1dDwkUHJpc21hTW9kZWw+ID0gRmllbGRSZWZJbnB1dFR5cGU8JFByaXNtYU1vZGVsLCAnQXV0aFByb3ZpZGVyJz5cbiAgICBcblxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZpZWxkIG9mIHR5cGUgJ0F1dGhQcm92aWRlcltdJ1xuICovXG5leHBvcnQgdHlwZSBMaXN0RW51bUF1dGhQcm92aWRlckZpZWxkUmVmSW5wdXQ8JFByaXNtYU1vZGVsPiA9IEZpZWxkUmVmSW5wdXRUeXBlPCRQcmlzbWFNb2RlbCwgJ0F1dGhQcm92aWRlcltdJz5cbiAgICBcblxuLyoqXG4gKiBCYXRjaCBQYXlsb2FkIGZvciB1cGRhdGVNYW55ICYgZGVsZXRlTWFueSAmIGNyZWF0ZU1hbnlcbiAqL1xuZXhwb3J0IHR5cGUgQmF0Y2hQYXlsb2FkID0ge1xuICBjb3VudDogbnVtYmVyXG59XG5cbmV4cG9ydCBjb25zdCBkZWZpbmVFeHRlbnNpb24gPSBydW50aW1lLkV4dGVuc2lvbnMuZGVmaW5lRXh0ZW5zaW9uIGFzIHVua25vd24gYXMgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkV4dGVuZHNIb29rPFwiZGVmaW5lXCIsIFR5cGVNYXBDYiwgcnVudGltZS5UeXBlcy5FeHRlbnNpb25zLkRlZmF1bHRBcmdzPlxuZXhwb3J0IHR5cGUgRGVmYXVsdFByaXNtYUNsaWVudCA9IFByaXNtYUNsaWVudFxuZXhwb3J0IHR5cGUgRXJyb3JGb3JtYXQgPSAncHJldHR5JyB8ICdjb2xvcmxlc3MnIHwgJ21pbmltYWwnXG4vKipcbiAqIE9wdGlvbnMgY29tbW9uIHRvIGFsbCB2YXJpYW50cyBvZiBgUHJpc21hQ2xpZW50T3B0aW9uc2AsIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB5b3UgY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggYSBkcml2ZXIgYWRhcHRlciBvciB0aHJvdWdoIFByaXNtYSBBY2NlbGVyYXRlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudEJhc2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIEBkZWZhdWx0IFwiY29sb3JsZXNzXCJcbiAgICovXG4gIGVycm9yRm9ybWF0PzogRXJyb3JGb3JtYXRcbiAgLyoqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYFxuICAgKiAvLyBTaG9ydGhhbmQgZm9yIGBlbWl0OiAnc3Rkb3V0J2BcbiAgICogbG9nOiBbJ3F1ZXJ5JywgJ2luZm8nLCAnd2FybicsICdlcnJvciddXG4gICAqIFxuICAgKiAvLyBFbWl0IGFzIGV2ZW50cyBvbmx5XG4gICAqIGxvZzogW1xuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdxdWVyeScgfSxcbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAnaW5mbycgfSxcbiAgICogICB7IGVtaXQ6ICdldmVudCcsIGxldmVsOiAnd2FybicgfVxuICAgKiAgIHsgZW1pdDogJ2V2ZW50JywgbGV2ZWw6ICdlcnJvcicgfVxuICAgKiBdXG4gICAqIFxuICAgKiAvIEVtaXQgYXMgZXZlbnRzIGFuZCBsb2cgdG8gc3Rkb3V0XG4gICAqIG9nOiBbXG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ3F1ZXJ5JyB9LFxuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICdpbmZvJyB9LFxuICAgKiAgeyBlbWl0OiAnc3Rkb3V0JywgbGV2ZWw6ICd3YXJuJyB9XG4gICAqICB7IGVtaXQ6ICdzdGRvdXQnLCBsZXZlbDogJ2Vycm9yJyB9XG4gICAqIFxuICAgKiBgYGBcbiAgICogUmVhZCBtb3JlIGluIG91ciBbZG9jc10oaHR0cHM6Ly9wcmlzLmx5L2QvbG9nZ2luZykuXG4gICAqL1xuICBsb2c/OiAoTG9nTGV2ZWwgfCBMb2dEZWZpbml0aW9uKVtdXG4gIC8qKlxuICAgKiBUaGUgZGVmYXVsdCB2YWx1ZXMgZm9yIHRyYW5zYWN0aW9uT3B0aW9uc1xuICAgKiBtYXhXYWl0ID89IDIwMDBcbiAgICogdGltZW91dCA/PSA1MDAwXG4gICAqL1xuICB0cmFuc2FjdGlvbk9wdGlvbnM/OiB7XG4gICAgbWF4V2FpdD86IG51bWJlclxuICAgIHRpbWVvdXQ/OiBudW1iZXJcbiAgICBpc29sYXRpb25MZXZlbD86IFRyYW5zYWN0aW9uSXNvbGF0aW9uTGV2ZWxcbiAgfVxuICAvKipcbiAgICogR2xvYmFsIGNvbmZpZ3VyYXRpb24gZm9yIG9taXR0aW5nIG1vZGVsIGZpZWxkcyBieSBkZWZhdWx0LlxuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIG9taXQ6IHtcbiAgICogICAgIHVzZXI6IHtcbiAgICogICAgICAgcGFzc3dvcmQ6IHRydWVcbiAgICogICAgIH1cbiAgICogICB9XG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgb21pdD86IEdsb2JhbE9taXRDb25maWdcbiAgLyoqXG4gICAqIFNRTCBjb21tZW50ZXIgcGx1Z2lucyB0aGF0IGFkZCBtZXRhZGF0YSB0byBTUUwgcXVlcmllcyBhcyBjb21tZW50cy5cbiAgICogQ29tbWVudHMgZm9sbG93IHRoZSBzcWxjb21tZW50ZXIgZm9ybWF0OiBodHRwczovL2dvb2dsZS5naXRodWIuaW8vc3FsY29tbWVudGVyL1xuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXIsXG4gICAqICAgY29tbWVudHM6IFtcbiAgICogICAgIHRyYWNlQ29udGV4dCgpLFxuICAgKiAgICAgcXVlcnlJbnNpZ2h0cygpLFxuICAgKiAgIF0sXG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgY29tbWVudHM/OiBydW50aW1lLlNxbENvbW1lbnRlclBsdWdpbltdXG4gIC8qKlxuICAgKiBPcHRpb25hbCBtYXhpbXVtIHNpemUgZm9yIHRoZSBxdWVyeSBwbGFuIGNhY2hlLiBJZiBub3QgcHJvdmlkZWQsIGEgZGVmYXVsdCBzaXplIHdpbGwgYmUgdXNlZC5cbiAgICogQSB2YWx1ZSBvZiBgMGAgY2FuIGJlIHVzZWQgdG8gZGlzYWJsZSB0aGUgY2FjaGUgZW50aXJlbHkuIEEgaGlnaGVyIGNhY2hlIHNpemUgY2FuIGltcHJvdmVcbiAgICogcGVyZm9ybWFuY2UgZm9yIGFwcGxpY2F0aW9ucyB0aGF0IGV4ZWN1dGUgYSBsYXJnZSBudW1iZXIgb2YgdW5pcXVlIHF1ZXJpZXMsIHdoaWxlIGEgc21hbGxlclxuICAgKiBjYWNoZSBzaXplIGNhbiByZWR1Y2UgbWVtb3J5IHVzYWdlLlxuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoe1xuICAgKiAgIGFkYXB0ZXIsXG4gICAqICAgcXVlcnlQbGFuQ2FjaGVNYXhTaXplOiAxMDAsXG4gICAqIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgcXVlcnlQbGFuQ2FjaGVNYXhTaXplPzogbnVtYmVyXG59XG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgb3B0aW9ucyBmb3IgY29ubmVjdGluZyB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgaW5zdGVhZCBvZiBhIGRyaXZlciBhZGFwdGVyLlxuICogXG4gKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9hY2NlbGVyYXRlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBY2NlbGVyYXRlVXJsIGV4dGVuZHMgUHJpc21hQ2xpZW50QmFzZU9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIFByaXNtYSBBY2NlbGVyYXRlIGNvbm5lY3Rpb24gVVJMLiBVc2UgdGhpcyBvcHRpb24gdG8gY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgaW5zdGVhZCBvZiB1c2luZyBhIGRyaXZlciBhZGFwdGVyIHRvIGNvbm5lY3QgZGlyZWN0bHkuXG4gICAqIFxuICAgKiBMZWFybiBtb3JlOiBodHRwczovL3ByaXMubHkvZC9hY2NlbGVyYXRlXG4gICAqL1xuICBhY2NlbGVyYXRlVXJsOiBzdHJpbmdcbiAgYWRhcHRlcj86IG5ldmVyXG59XG5cbi8qKlxuICogYFByaXNtYUNsaWVudGAgb3B0aW9ucyBmb3IgY29ubmVjdGluZyB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggYSBkcml2ZXIgYWRhcHRlci4gVGhpcyBpcyB0aGUgY29tbW9uIGNhc2UgaW4gUHJpc21hIDcuXG4gKiBcbiAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWRhcHRlciBleHRlbmRzIFByaXNtYUNsaWVudEJhc2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIEEgZHJpdmVyIGFkYXB0ZXIgdGhhdCBQcmlzbWFDbGllbnQgdXNlcyB0byBjb25uZWN0IHRvIHlvdXIgZGF0YWJhc2UsIHN1Y2ggYXMgdGhlIG9uZXMgcHJvdmlkZWQgYnkgYEBwcmlzbWEvYWRhcHRlci1wZ2AsIGBAcHJpc21hL2FkYXB0ZXItbGlic3FsYCwgYEBwcmlzbWEvYWRhcHRlci1wbGFuZXRzY2FsZWAsIGV0Yy5cbiAgICogXG4gICAqIEEgZHJpdmVyIGFkYXB0ZXIgaXMgKipyZXF1aXJlZCoqIHVubGVzcyB5b3UgY29ubmVjdCB0byB5b3VyIGRhdGFiYXNlIHRocm91Z2ggUHJpc21hIEFjY2VsZXJhdGUgKGluIHdoaWNoIGNhc2UgdXNlIGBhY2NlbGVyYXRlVXJsYCBpbnN0ZWFkKS5cbiAgICogXG4gICAqIExlYXJuIG1vcmU6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICAgKiBcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgUHJpc21hUGcgfSBmcm9tICdAcHJpc21hL2FkYXB0ZXItcGcnXG4gICAqIGltcG9ydCB7IFByaXNtYUNsaWVudCB9IGZyb20gJy4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnQnXG4gICAqIFxuICAgKiBjb25zdCBhZGFwdGVyID0gbmV3IFByaXNtYVBnKHsgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMIH0pXG4gICAqIGNvbnN0IHByaXNtYSA9IG5ldyBQcmlzbWFDbGllbnQoeyBhZGFwdGVyIH0pXG4gICAqIGBgYFxuICAgKi9cbiAgYWRhcHRlcjogcnVudGltZS5TcWxEcml2ZXJBZGFwdGVyRmFjdG9yeVxuICBhY2NlbGVyYXRlVXJsPzogbmV2ZXJcbn1cblxuLyoqXG4gKiBPcHRpb25zIHBhc3NlZCB0byB0aGUgYFByaXNtYUNsaWVudGAgY29uc3RydWN0b3IuXG4gKiBcbiAqIEEgZHJpdmVyIGFkYXB0ZXIgKG9yLCBhbHRlcm5hdGl2ZWx5LCBhIFByaXNtYSBBY2NlbGVyYXRlIFVSTCkgaXMgKipyZXF1aXJlZCoqLiBTZWUge0BsaW5rIFByaXNtYUNsaWVudE9wdGlvbnNXaXRoQWRhcHRlcn0gYW5kIHtAbGluayBQcmlzbWFDbGllbnRPcHRpb25zV2l0aEFjY2VsZXJhdGVVcmx9IGZvciB0aGUgdHdvIHZhcmlhbnRzLiBBbGwgb3RoZXIgcHJvcGVydGllcyBsaXZlIGluIHtAbGluayBQcmlzbWFDbGllbnRCYXNlT3B0aW9uc30gYW5kIGFyZSBvcHRpb25hbC5cbiAqIFxuICogTGVhcm4gbW9yZSBhYm91dCBkcml2ZXIgYWRhcHRlcnM6IGh0dHBzOi8vcHJpcy5seS9kL2RyaXZlci1hZGFwdGVyc1xuICovXG5leHBvcnQgdHlwZSBQcmlzbWFDbGllbnRPcHRpb25zID0gUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBY2NlbGVyYXRlVXJsIHwgUHJpc21hQ2xpZW50T3B0aW9uc1dpdGhBZGFwdGVyXG5leHBvcnQgdHlwZSBHbG9iYWxPbWl0Q29uZmlnID0ge1xuICBibG9nUG9zdD86IFByaXNtYS5CbG9nUG9zdE9taXRcbiAgYm9va2luZz86IFByaXNtYS5Cb29raW5nT21pdFxuICBjYXRlZ29yeT86IFByaXNtYS5DYXRlZ29yeU9taXRcbiAgY29udGFjdE1lc3NhZ2U/OiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VPbWl0XG4gIHBheW1lbnQ/OiBQcmlzbWEuUGF5bWVudE9taXRcbiAgcmV2aWV3PzogUHJpc21hLlJldmlld09taXRcbiAgdG91clBhY2thZ2U/OiBQcmlzbWEuVG91clBhY2thZ2VPbWl0XG4gIHVzZXI/OiBQcmlzbWEuVXNlck9taXRcbn1cblxuLyogVHlwZXMgZm9yIExvZ2dpbmcgKi9cbmV4cG9ydCB0eXBlIExvZ0xldmVsID0gJ2luZm8nIHwgJ3F1ZXJ5JyB8ICd3YXJuJyB8ICdlcnJvcidcbmV4cG9ydCB0eXBlIExvZ0RlZmluaXRpb24gPSB7XG4gIGxldmVsOiBMb2dMZXZlbFxuICBlbWl0OiAnc3Rkb3V0JyB8ICdldmVudCdcbn1cblxuZXhwb3J0IHR5cGUgQ2hlY2tJc0xvZ0xldmVsPFQ+ID0gVCBleHRlbmRzIExvZ0xldmVsID8gVCA6IG5ldmVyO1xuXG5leHBvcnQgdHlwZSBHZXRMb2dUeXBlPFQ+ID0gQ2hlY2tJc0xvZ0xldmVsPFxuICBUIGV4dGVuZHMgTG9nRGVmaW5pdGlvbiA/IFRbJ2xldmVsJ10gOiBUXG4+O1xuXG5leHBvcnQgdHlwZSBHZXRFdmVudHM8VCBleHRlbmRzIGFueVtdPiA9IFQgZXh0ZW5kcyBBcnJheTxMb2dMZXZlbCB8IExvZ0RlZmluaXRpb24+XG4gID8gR2V0TG9nVHlwZTxUW251bWJlcl0+XG4gIDogbmV2ZXI7XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5RXZlbnQgPSB7XG4gIHRpbWVzdGFtcDogRGF0ZVxuICBxdWVyeTogc3RyaW5nXG4gIHBhcmFtczogc3RyaW5nXG4gIGR1cmF0aW9uOiBudW1iZXJcbiAgdGFyZ2V0OiBzdHJpbmdcbn1cblxuZXhwb3J0IHR5cGUgTG9nRXZlbnQgPSB7XG4gIHRpbWVzdGFtcDogRGF0ZVxuICBtZXNzYWdlOiBzdHJpbmdcbiAgdGFyZ2V0OiBzdHJpbmdcbn1cbi8qIEVuZCBUeXBlcyBmb3IgTG9nZ2luZyAqL1xuXG5cbmV4cG9ydCB0eXBlIFByaXNtYUFjdGlvbiA9XG4gIHwgJ2ZpbmRVbmlxdWUnXG4gIHwgJ2ZpbmRVbmlxdWVPclRocm93J1xuICB8ICdmaW5kTWFueSdcbiAgfCAnZmluZEZpcnN0J1xuICB8ICdmaW5kRmlyc3RPclRocm93J1xuICB8ICdjcmVhdGUnXG4gIHwgJ2NyZWF0ZU1hbnknXG4gIHwgJ2NyZWF0ZU1hbnlBbmRSZXR1cm4nXG4gIHwgJ3VwZGF0ZSdcbiAgfCAndXBkYXRlTWFueSdcbiAgfCAndXBkYXRlTWFueUFuZFJldHVybidcbiAgfCAndXBzZXJ0J1xuICB8ICdkZWxldGUnXG4gIHwgJ2RlbGV0ZU1hbnknXG4gIHwgJ2V4ZWN1dGVSYXcnXG4gIHwgJ3F1ZXJ5UmF3J1xuICB8ICdhZ2dyZWdhdGUnXG4gIHwgJ2NvdW50J1xuICB8ICdydW5Db21tYW5kUmF3J1xuICB8ICdmaW5kUmF3J1xuICB8ICdncm91cEJ5J1xuXG4vKipcbiAqIGBQcmlzbWFDbGllbnRgIHByb3h5IGF2YWlsYWJsZSBpbiBpbnRlcmFjdGl2ZSB0cmFuc2FjdGlvbnMuXG4gKi9cbmV4cG9ydCB0eXBlIFRyYW5zYWN0aW9uQ2xpZW50ID0gT21pdDxEZWZhdWx0UHJpc21hQ2xpZW50LCBydW50aW1lLklUWENsaWVudERlbnlMaXN0PlxuXG4iLCAiXG4vKiAhISEgVGhpcyBpcyBjb2RlIGdlbmVyYXRlZCBieSBQcmlzbWEuIERvIG5vdCBlZGl0IGRpcmVjdGx5LiAhISEgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vLyBiaW9tZS1pZ25vcmUtYWxsIGxpbnQ6IGdlbmVyYXRlZCBmaWxlXG4vLyBAdHMtbm9jaGVjayBcbi8qXG4qIFRoaXMgZmlsZSBleHBvcnRzIGFsbCBlbnVtIHJlbGF0ZWQgdHlwZXMgZnJvbSB0aGUgc2NoZW1hLlxuKlxuKiBcdUQ4M0RcdURGRTIgWW91IGNhbiBpbXBvcnQgdGhpcyBmaWxlIGRpcmVjdGx5LlxuKi9cblxuZXhwb3J0IGNvbnN0IFJvbGUgPSB7XG4gIFVTRVI6ICdVU0VSJyxcbiAgQUdFTlQ6ICdBR0VOVCcsXG4gIEFETUlOOiAnQURNSU4nXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFJvbGUgPSAodHlwZW9mIFJvbGUpW2tleW9mIHR5cGVvZiBSb2xlXVxuXG5cbmV4cG9ydCBjb25zdCBVc2VyU3RhdHVzID0ge1xuICBBQ1RJVkU6ICdBQ1RJVkUnLFxuICBTVVNQRU5ERUQ6ICdTVVNQRU5ERUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFVzZXJTdGF0dXMgPSAodHlwZW9mIFVzZXJTdGF0dXMpW2tleW9mIHR5cGVvZiBVc2VyU3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBBdXRoUHJvdmlkZXIgPSB7XG4gIENSRURFTlRJQUw6ICdDUkVERU5USUFMJyxcbiAgR09PR0xFOiAnR09PR0xFJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBBdXRoUHJvdmlkZXIgPSAodHlwZW9mIEF1dGhQcm92aWRlcilba2V5b2YgdHlwZW9mIEF1dGhQcm92aWRlcl1cblxuXG5leHBvcnQgY29uc3QgUGFja2FnZVN0YXR1cyA9IHtcbiAgUEVORElORzogJ1BFTkRJTkcnLFxuICBBUFBST1ZFRDogJ0FQUFJPVkVEJyxcbiAgUkVKRUNURUQ6ICdSRUpFQ1RFRCdcbn0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgUGFja2FnZVN0YXR1cyA9ICh0eXBlb2YgUGFja2FnZVN0YXR1cylba2V5b2YgdHlwZW9mIFBhY2thZ2VTdGF0dXNdXG5cblxuZXhwb3J0IGNvbnN0IEJvb2tpbmdTdGF0dXMgPSB7XG4gIFBFTkRJTkc6ICdQRU5ESU5HJyxcbiAgUEFJRDogJ1BBSUQnLFxuICBDT05GSVJNRUQ6ICdDT05GSVJNRUQnLFxuICBDQU5DRUxMRUQ6ICdDQU5DRUxMRUQnLFxuICBDT01QTEVURUQ6ICdDT01QTEVURUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIEJvb2tpbmdTdGF0dXMgPSAodHlwZW9mIEJvb2tpbmdTdGF0dXMpW2tleW9mIHR5cGVvZiBCb29raW5nU3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBQYXltZW50U3RhdHVzID0ge1xuICBJTklUSUFURUQ6ICdJTklUSUFURUQnLFxuICBTVUNDRVNTOiAnU1VDQ0VTUycsXG4gIEZBSUxFRDogJ0ZBSUxFRCcsXG4gIENBTkNFTExFRDogJ0NBTkNFTExFRCcsXG4gIFJFRlVOREVEOiAnUkVGVU5ERUQnXG59IGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFBheW1lbnRTdGF0dXMgPSAodHlwZW9mIFBheW1lbnRTdGF0dXMpW2tleW9mIHR5cGVvZiBQYXltZW50U3RhdHVzXVxuXG5cbmV4cG9ydCBjb25zdCBQb3N0U3RhdHVzID0ge1xuICBEUkFGVDogJ0RSQUZUJyxcbiAgUFVCTElTSEVEOiAnUFVCTElTSEVEJ1xufSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBQb3N0U3RhdHVzID0gKHR5cGVvZiBQb3N0U3RhdHVzKVtrZXlvZiB0eXBlb2YgUG9zdFN0YXR1c11cbiIsICIvLyBBcHBFcnJvciBrZWVwcyB0aGUgZXhhY3Qgc2FtZSBcImp1c3QgdGhyb3cgaXRcIiBlcmdvbm9taWNzIGJ1dCBjYXJyaWVzXG4vLyBhIHN0YXR1c0NvZGUgdGhlIGdsb2JhbCBoYW5kbGVyIGNhbiByZWFkIChzZWUgbWlkZGxld2FyZS9nbG9iYWxFcnJvckhhbmRsZXIudHMpLlxuZXhwb3J0IGNsYXNzIEFwcEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBzdGF0dXNDb2RlOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3Ioc3RhdHVzQ29kZTogbnVtYmVyLCBtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSBcIkFwcEVycm9yXCI7XG4gICAgdGhpcy5zdGF0dXNDb2RlID0gc3RhdHVzQ29kZTtcbiAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IFByaXNtYVBnIH0gZnJvbSBcIkBwcmlzbWEvYWRhcHRlci1wZ1wiO1xuaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcblxuY29uc3QgY29ubmVjdGlvblN0cmluZyA9IGNvbmZpZy5kYXRhYmFzZV91cmw7XG5cbi8vIFNlcnZlcmxlc3MtZnJpZW5kbHkgcG9vbDogb25lIGNvbm5lY3Rpb24gcGVyIHdhcm0gaW5zdGFuY2Ugc28gbWFueVxuLy8gY29uY3VycmVudCBpbnZvY2F0aW9ucyBjYW4ndCBleGhhdXN0IHRoZSBkYXRhYmFzZSdzIGNvbm5lY3Rpb24gbGltaXQuXG4vLyBMb2NhbC9WTSBydW5zIGFyZSB1bmFmZmVjdGVkIChhIHNpbmdsZSBwcm9jZXNzIHVzZXMgb25lIGNvbm5lY3Rpb24gYW55d2F5KS5cbmNvbnN0IGFkYXB0ZXIgPSBuZXcgUHJpc21hUGcoeyBjb25uZWN0aW9uU3RyaW5nLCBtYXg6IDEgfSk7XG5jb25zdCBwcmlzbWEgPSBuZXcgUHJpc21hQ2xpZW50KHsgYWRhcHRlciB9KTtcblxuZXhwb3J0IHsgcHJpc21hIH07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IGF1dGhDb250cm9sbGVyIH0gZnJvbSBcIi4vYXV0aC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBhdXRoVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9hdXRoLnZhbGlkYXRpb25cIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBSZWdpc3RlciBcdTIwMTQgcm9sZSBpcyBvcHRpb25hbCBhbmQgcmVzdHJpY3RlZCB0byBVU0VSL0FHRU5UIGluIHRoZSBzZXJ2aWNlXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVnaXN0ZXJcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLnJlZ2lzdGVyU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZWdpc3RlclVzZXIsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvbG9naW5cIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYXV0aFZhbGlkYXRpb25zLmxvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5sb2dpblVzZXIsXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZ29vZ2xlXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGF1dGhWYWxpZGF0aW9ucy5nb29nbGVMb2dpblNjaGVtYSB9KSxcbiAgYXV0aENvbnRyb2xsZXIuZ29vZ2xlTG9naW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvZGVtby1sb2dpblwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMuZGVtb0xvZ2luU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5kZW1vTG9naW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvcmVmcmVzaFwiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBhdXRoVmFsaWRhdGlvbnMucmVmcmVzaFRva2VuU2NoZW1hIH0pLFxuICBhdXRoQ29udHJvbGxlci5yZWZyZXNoVG9rZW4sXG4pO1xuXG5yb3V0ZXIucG9zdChcIi9sb2dvdXRcIiwgYXV0aCgpLCBhdXRoQ29udHJvbGxlci5sb2dvdXRVc2VyKTtcblxucm91dGVyLmdldChcIi9tZVwiLCBhdXRoKCksIGF1dGhDb250cm9sbGVyLmdldE1lKTtcblxuZXhwb3J0IGNvbnN0IGF1dGhSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBhdXRoU2VydmljZSB9IGZyb20gXCIuL2F1dGguc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbmNvbnN0IGlzUHJvZHVjdGlvbiA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcInByb2R1Y3Rpb25cIjtcblxuLy8gRGV2IChsb2NhbGhvc3Q6MzAwMCBcdTIxOTIgOjQwMDApIGlzIHNhbWUtc2l0ZSBcdTIxOTIgbGF4IHdvcmtzIHdpdGggc2VjdXJlOmZhbHNlLlxuLy8gUHJvZCAoY3Jvc3Mtc2l0ZSBmcm9udGVuZC9iYWNrZW5kKSByZXF1aXJlcyBTYW1lU2l0ZT1Ob25lICsgU2VjdXJlLlxuY29uc3QgY29va2llT3B0aW9uczoge1xuICBodHRwT25seTogdHJ1ZTtcbiAgc2VjdXJlOiBib29sZWFuO1xuICBzYW1lU2l0ZTogXCJsYXhcIiB8IFwibm9uZVwiO1xufSA9IHtcbiAgaHR0cE9ubHk6IHRydWUsXG4gIHNlY3VyZTogaXNQcm9kdWN0aW9uLFxuICBzYW1lU2l0ZTogaXNQcm9kdWN0aW9uID8gXCJub25lXCIgOiBcImxheFwiLFxufTtcblxuY29uc3QgQUNDRVNTX0NPT0tJRV9NQVhfQUdFID0gMjQgKiA2MCAqIDYwICogMTAwMDsgLy8gMSBkYXlcbmNvbnN0IFJFRlJFU0hfQ09PS0lFX01BWF9BR0UgPSAzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDA7IC8vIDMwIGRheXNcblxuY29uc3Qgc2V0QXV0aENvb2tpZXMgPSAoXG4gIHJlczogUmVzcG9uc2UsXG4gIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9OiB7IGFjY2Vzc1Rva2VuOiBzdHJpbmc7IHJlZnJlc2hUb2tlbjogc3RyaW5nIH0sXG4pID0+IHtcbiAgcmVzLmNvb2tpZShcImFjY2Vzc1Rva2VuXCIsIGFjY2Vzc1Rva2VuLCB7XG4gICAgLi4uY29va2llT3B0aW9ucyxcbiAgICBtYXhBZ2U6IEFDQ0VTU19DT09LSUVfTUFYX0FHRSxcbiAgfSk7XG4gIHJlcy5jb29raWUoXCJyZWZyZXNoVG9rZW5cIiwgcmVmcmVzaFRva2VuLCB7XG4gICAgLi4uY29va2llT3B0aW9ucyxcbiAgICBtYXhBZ2U6IFJFRlJFU0hfQ09PS0lFX01BWF9BR0UsXG4gIH0pO1xufTtcblxuY29uc3QgY2xlYXJBdXRoQ29va2llcyA9IChyZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHJlcy5jbGVhckNvb2tpZShcImFjY2Vzc1Rva2VuXCIsIGNvb2tpZU9wdGlvbnMpO1xuICByZXMuY2xlYXJDb29raWUoXCJyZWZyZXNoVG9rZW5cIiwgY29va2llT3B0aW9ucyk7XG59O1xuXG4vLyBSZWdpc3RlciBjb250cm9sbGVyXG5jb25zdCByZWdpc3RlclVzZXIgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgYXV0aFNlcnZpY2UucmVnaXN0ZXJVc2VyKHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgUmVnaXN0ZXJlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gTG9naW4gY29udHJvbGxlclxuY29uc3QgbG9naW5Vc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuIH0gPSBhd2FpdCBhdXRoU2VydmljZS5sb2dpblVzZXIocmVxLmJvZHkpO1xuXG4gICAgc2V0QXV0aENvb2tpZXMocmVzLCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIEdvb2dsZSBsb2dpbiAoSUQtdG9rZW4gZmxvdylcbmNvbnN0IGdvb2dsZUxvZ2luID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0gPSBhd2FpdCBhdXRoU2VydmljZS5nb29nbGVMb2dpbihcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHlcIixcbiAgICAgIGRhdGE6IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiwgdXNlciB9LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gRGVtbyBsb2dpbiBjb250cm9sbGVyXG5jb25zdCBkZW1vTG9naW4gPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4sIHVzZXIgfSA9IGF3YWl0IGF1dGhTZXJ2aWNlLmRlbW9Mb2dpbihcbiAgICAgIHJlcS5ib2R5LFxuICAgICk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbiB9KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEZW1vIHVzZXIgbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCB1c2VyIH0sXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBSZWZyZXNoIHRva2VuIGNvbnRyb2xsZXJcbmNvbnN0IHJlZnJlc2hUb2tlbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlZnJlc2hUb2tlbkZyb21Db29raWUgPSByZXEuY29va2llcy5yZWZyZXNoVG9rZW47XG4gICAgY29uc3QgcmVmcmVzaFRva2VuRnJvbUJvZHkgPSByZXEuYm9keT8ucmVmcmVzaFRva2VuO1xuXG4gICAgaWYgKCFyZWZyZXNoVG9rZW5Gcm9tQ29va2llICYmICFyZWZyZXNoVG9rZW5Gcm9tQm9keSkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuVU5BVVRIT1JJWkVELFxuICAgICAgICBtZXNzYWdlOiBcIlJlZnJlc2ggdG9rZW4gaXMgcmVxdWlyZWRcIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHsgYWNjZXNzVG9rZW4sIHJlZnJlc2hUb2tlbjogbmV3UmVmcmVzaFRva2VuIH0gPVxuICAgICAgYXdhaXQgYXV0aFNlcnZpY2UucmVmcmVzaFRva2VuKHtcbiAgICAgICAgcmVmcmVzaFRva2VuOiByZWZyZXNoVG9rZW5Gcm9tQ29va2llIHx8IHJlZnJlc2hUb2tlbkZyb21Cb2R5LFxuICAgICAgfSk7XG5cbiAgICBzZXRBdXRoQ29va2llcyhyZXMsIHtcbiAgICAgIGFjY2Vzc1Rva2VuLFxuICAgICAgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4sXG4gICAgfSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVG9rZW4gcmVmcmVzaGVkIHN1Y2Nlc3NmdWxseVwiLFxuICAgICAgZGF0YTogeyBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuOiBuZXdSZWZyZXNoVG9rZW4gfSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIExvZ291dCBjb250cm9sbGVyXG5jb25zdCBsb2dvdXRVc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGF3YWl0IGF1dGhTZXJ2aWNlLmxvZ291dCh1c2VySWQpO1xuICAgIGNsZWFyQXV0aENvb2tpZXMocmVzKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VyIGxvZ2dlZCBvdXQgc3VjY2Vzc2Z1bGx5XCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gR2V0IE1lIGNvbnRyb2xsZXJcbmNvbnN0IGdldE1lID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhdXRoU2VydmljZS5nZXRNZUZyb21EQih1c2VySWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGF1dGhDb250cm9sbGVyID0ge1xuICByZWdpc3RlclVzZXIsXG4gIGxvZ2luVXNlcixcbiAgZ29vZ2xlTG9naW4sXG4gIGRlbW9Mb2dpbixcbiAgcmVmcmVzaFRva2VuLFxuICBsb2dvdXRVc2VyLFxuICBnZXRNZSxcbn07IiwgImltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5pbXBvcnQgeyBKd3RQYXlsb2FkLCBTaWduT3B0aW9ucyB9IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uLy4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IGdvb2dsZUNsaWVudCB9IGZyb20gXCIuLi8uLi9saWIvZ29vZ2xlQXV0aFwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXBwRXJyb3JcIjtcbmltcG9ydCB7IGp3dFV0aWxzIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2p3dFwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQge1xuICBJQXV0aCxcbiAgSURlbW9Mb2dpblBheWxvYWQsXG4gIElHb29nbGVMb2dpblBheWxvYWQsXG4gIElMb2dpblVzZXIsXG4gIElSZWZyZXNoVG9rZW5QYXlsb2FkLFxufSBmcm9tIFwiLi9hdXRoLmludGVyZmFjZVwiO1xuXG5jb25zdCBidWlsZFRva2VuUGF5bG9hZCA9ICh1c2VyOiB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgcm9sZTogUm9sZTtcbiAgdG9rZW5WZXJzaW9uOiBudW1iZXI7XG59KSA9PiAoe1xuICBpZDogdXNlci5pZCxcbiAgbmFtZTogdXNlci5uYW1lLFxuICBlbWFpbDogdXNlci5lbWFpbCxcbiAgcm9sZTogdXNlci5yb2xlLFxuICB0b2tlblZlcnNpb246IHVzZXIudG9rZW5WZXJzaW9uLFxufSk7XG5cbmNvbnN0IGlzc3VlVG9rZW5zID0gKHVzZXI6IHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICByb2xlOiBSb2xlO1xuICB0b2tlblZlcnNpb246IG51bWJlcjtcbn0pID0+IHtcbiAgY29uc3QgdG9rZW5QYXlsb2FkID0gYnVpbGRUb2tlblBheWxvYWQodXNlcik7XG5cbiAgY29uc3QgYWNjZXNzVG9rZW4gPSBqd3RVdGlscy5jcmVhdGVUb2tlbihcbiAgICB0b2tlblBheWxvYWQsXG4gICAgY29uZmlnLmp3dF9hY2Nlc3Nfc2VjcmV0LFxuICAgIHsgZXhwaXJlc0luOiBjb25maWcuand0X2FjY2Vzc19leHBpcmVzX2luIH0gYXMgU2lnbk9wdGlvbnMsXG4gICk7XG4gIGNvbnN0IHJlZnJlc2hUb2tlbiA9IGp3dFV0aWxzLmNyZWF0ZVRva2VuKFxuICAgIHRva2VuUGF5bG9hZCxcbiAgICBjb25maWcuand0X3JlZnJlc2hfc2VjcmV0LFxuICAgIHsgZXhwaXJlc0luOiBjb25maWcuand0X3JlZnJlc2hfZXhwaXJlc19pbiB9IGFzIFNpZ25PcHRpb25zLFxuICApO1xuXG4gIHJldHVybiB7IGFjY2Vzc1Rva2VuLCByZWZyZXNoVG9rZW4gfTtcbn07XG5cbmNvbnN0IHNhbml0aXplVXNlciA9IDxUIGV4dGVuZHMgeyBwYXNzd29yZDogc3RyaW5nIHwgbnVsbCB9Pih1c2VyOiBUKSA9PiB7XG4gIGNvbnN0IHsgcGFzc3dvcmQsIC4uLnJlc3QgfSA9IHVzZXI7XG4gIHJldHVybiByZXN0O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZ2lzdGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcmVnaXN0ZXJVc2VyID0gYXN5bmMgKHBheWxvYWQ6IElBdXRoKSA9PiB7XG4gIGNvbnN0IHsgbmFtZSwgZW1haWwsIHBhc3N3b3JkLCBwaG9uZSwgcm9sZSB9ID0gcGF5bG9hZDtcblxuICAvLyBPbmx5IHVzZXJzL2FnZW50cyBjYW4gc2VsZi1yZWdpc3RlcjsgYWRtaW5zIGFyZSBjcmVhdGVkIHZpYSBkZW1vLWxvZ2luL3NlZWRcbiAgaWYgKHJvbGUgJiYgcm9sZSAhPT0gXCJVU0VSXCIgJiYgcm9sZSAhPT0gXCJBR0VOVFwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJSb2xlIG11c3QgYmUgZWl0aGVyIFVTRVIgb3IgQUdFTlRcIik7XG4gIH1cblxuICBjb25zdCBleGlzdGluZ1VzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBlbWFpbCB9LFxuICB9KTtcbiAgaWYgKGV4aXN0aW5nVXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDksIFwiVXNlciB3aXRoIHRoaXMgZW1haWwgYWxyZWFkeSBleGlzdHNcIik7XG4gIH1cblxuICBjb25zdCBoYXNoZWRQYXNzd29yZCA9IGF3YWl0IGJjcnlwdC5oYXNoKFxuICAgIHBhc3N3b3JkLFxuICAgIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSxcbiAgKTtcblxuICBjb25zdCBjcmVhdGVkVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgbmFtZSxcbiAgICAgIGVtYWlsLFxuICAgICAgcGFzc3dvcmQ6IGhhc2hlZFBhc3N3b3JkLFxuICAgICAgYXV0aFByb3ZpZGVyOiBcIkNSRURFTlRJQUxcIixcbiAgICAgIHJvbGU6IHJvbGUgfHwgXCJVU0VSXCIsXG4gICAgICBwaG9uZSxcbiAgICB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGNyZWF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIExvZ2luIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgbG9naW5Vc2VyID0gYXN5bmMgKHBheWxvYWQ6IElMb2dpblVzZXIpID0+IHtcbiAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGVtYWlsIH0sXG4gIH0pO1xuXG4gIGlmICghdXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiSW52YWxpZCBlbWFpbCBvciBwYXNzd29yZFwiKTtcbiAgfVxuICBpZiAodXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaGFzIGJlZW4gZGVsZXRlZFwiKTtcbiAgfVxuICBpZiAodXNlci5zdGF0dXMgPT09IFwiU1VTUEVOREVEXCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIkFjY291bnQgaXMgc3VzcGVuZGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLmF1dGhQcm92aWRlciA9PT0gXCJHT09HTEVcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIFwiVGhpcyBhY2NvdW50IHVzZXMgR29vZ2xlIGxvZ2luLiBQbGVhc2UgbG9nIGluIHdpdGggR29vZ2xlLlwiLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBpc1Bhc3N3b3JkVmFsaWQgPSBhd2FpdCBiY3J5cHQuY29tcGFyZShwYXNzd29yZCwgdXNlci5wYXNzd29yZCB8fCBcIlwiKTtcbiAgaWYgKCFpc1Bhc3N3b3JkVmFsaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIkludmFsaWQgZW1haWwgb3IgcGFzc3dvcmRcIik7XG4gIH1cblxuICByZXR1cm4gaXNzdWVUb2tlbnModXNlcik7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgR29vZ2xlIGxvZ2luIChJRC10b2tlbiBmbG93KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdvb2dsZUxvZ2luID0gYXN5bmMgKHBheWxvYWQ6IElHb29nbGVMb2dpblBheWxvYWQpID0+IHtcbiAgY29uc3QgeyBpZFRva2VuIH0gPSBwYXlsb2FkO1xuXG4gIGlmICghY29uZmlnLmdvb2dsZV9jbGllbnRfaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkdvb2dsZSBsb2dpbiBpcyBub3QgY29uZmlndXJlZC4gUGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cIixcbiAgICApO1xuICB9XG5cbiAgbGV0IHRpY2tldDtcbiAgdHJ5IHtcbiAgICB0aWNrZXQgPSBhd2FpdCBnb29nbGVDbGllbnQudmVyaWZ5SWRUb2tlbih7XG4gICAgICBpZFRva2VuLFxuICAgICAgYXVkaWVuY2U6IGNvbmZpZy5nb29nbGVfY2xpZW50X2lkLFxuICAgIH0pO1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAxLCBcIkludmFsaWQgR29vZ2xlIHRva2VuXCIpO1xuICB9XG5cbiAgY29uc3QgZ29vZ2xlRGF0YSA9IHRpY2tldC5nZXRQYXlsb2FkKCk7XG4gIGlmICghZ29vZ2xlRGF0YSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBHb29nbGUgdG9rZW4gcGF5bG9hZFwiKTtcbiAgfVxuXG4gIGNvbnN0IHsgZW1haWwsIG5hbWUsIHN1YiwgcGljdHVyZSB9ID0gZ29vZ2xlRGF0YTtcblxuICBpZiAoIWVtYWlsIHx8ICFnb29nbGVEYXRhLmVtYWlsX3ZlcmlmaWVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJHb29nbGUgYWNjb3VudCBlbWFpbCBpcyBub3QgdmVyaWZpZWRcIik7XG4gIH1cblxuICBsZXQgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBnb29nbGVJZDogc3ViIH0gfSk7XG5cbiAgLy8gRXhpc3RpbmcgdXNlciBcdTIxOTIgbGluayBHb29nbGUgYWNjb3VudCBpZiBub3QgYWxyZWFkeSBsaW5rZWRcbiAgaWYgKCF1c2VyICYmIGVtYWlsKSB7XG4gICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBlbWFpbCB9IH0pO1xuICAgIGlmICh1c2VyKSB7XG4gICAgICBpZiAodXNlci5nb29nbGVJZCAmJiB1c2VyLmdvb2dsZUlkICE9PSBzdWIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICAgIDQwOSxcbiAgICAgICAgICBcIkVtYWlsIGlzIGFscmVhZHkgbGlua2VkIHRvIGFub3RoZXIgR29vZ2xlIGFjY291bnRcIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogdXNlci5pZCB9LFxuICAgICAgICBkYXRhOiB7IGdvb2dsZUlkOiBzdWIsIGVtYWlsVmVyaWZpZWQ6IHRydWUgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIEJyYW5kIG5ldyB1c2VyXG4gIGlmICghdXNlcikge1xuICAgIGNvbnN0IGxvY2FsUGFydCA9IGVtYWlsLnNwbGl0KFwiQFwiKVswXSA/PyBlbWFpbDtcbiAgICBjb25zdCBkaXNwbGF5TmFtZSA9IChuYW1lID8/IFwiXCIpLnRyaW0oKSB8fCBsb2NhbFBhcnQ7XG4gICAgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIGVtYWlsLFxuICAgICAgICBuYW1lOiBkaXNwbGF5TmFtZSxcbiAgICAgICAgcGFzc3dvcmQ6IG51bGwsXG4gICAgICAgIGF1dGhQcm92aWRlcjogXCJHT09HTEVcIixcbiAgICAgICAgZ29vZ2xlSWQ6IHN1YixcbiAgICAgICAgZW1haWxWZXJpZmllZDogdHJ1ZSxcbiAgICAgICAgcm9sZTogXCJVU0VSXCIsXG4gICAgICAgIGF2YXRhclVybDogcGljdHVyZSB8fCBudWxsLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHRva2VucyA9IGlzc3VlVG9rZW5zKHVzZXIhKTtcbiAgY29uc3Qgc2FuaXRpemVkVXNlciA9IHNhbml0aXplVXNlcih1c2VyISk7XG5cbiAgcmV0dXJuIHsgLi4udG9rZW5zLCB1c2VyOiBzYW5pdGl6ZWRVc2VyIH07XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgRGVtbyBsb2dpbiAoZ3JhZGluZykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBERU1PX1BBU1NXT1JEID0gXCJkZW1vMTIzXCI7XG5cbmNvbnN0IGRlbW9Mb2dpbiA9IGFzeW5jIChwYXlsb2FkOiBJRGVtb0xvZ2luUGF5bG9hZCkgPT4ge1xuICBjb25zdCB7IHJvbGUgfSA9IHBheWxvYWQ7XG5cbiAgY29uc3QgZGVtb1VzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cHNlcnQoe1xuICAgIHdoZXJlOiB7IGVtYWlsOiBgZGVtby0ke3JvbGUudG9Mb3dlckNhc2UoKX1AdHJpcHZlcnNlLmNvbWAgfSxcbiAgICAvLyByZXN1cnJlY3QgZGVtbyBhY2NvdW50cyB0aGF0IGFuIGFkbWluIHN1c3BlbmRlZCBvciBzb2Z0LWRlbGV0ZWRcbiAgICB1cGRhdGU6IHsgc3RhdHVzOiBcIkFDVElWRVwiLCBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgY3JlYXRlOiB7XG4gICAgICBuYW1lOiBgRGVtbyAke3JvbGUuY2hhckF0KDApICsgcm9sZS5zbGljZSgxKS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBlbWFpbDogYGRlbW8tJHtyb2xlLnRvTG93ZXJDYXNlKCl9QHRyaXB2ZXJzZS5jb21gLFxuICAgICAgcGFzc3dvcmQ6IGF3YWl0IGJjcnlwdC5oYXNoKERFTU9fUEFTU1dPUkQsIE51bWJlcihjb25maWcuYmNyeXB0X3NhbHRfcm91bmRzKSksXG4gICAgICBhdXRoUHJvdmlkZXI6IFwiQ1JFREVOVElBTFwiLFxuICAgICAgcm9sZSxcbiAgICAgIHN0YXR1czogXCJBQ1RJVkVcIixcbiAgICAgIGVtYWlsVmVyaWZpZWQ6IHRydWUsXG4gICAgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7IC4uLmlzc3VlVG9rZW5zKGRlbW9Vc2VyKSwgdXNlcjogZGVtb1VzZXIgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBSZWZyZXNoIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgcmVmcmVzaFRva2VuID0gYXN5bmMgKHBheWxvYWQ6IElSZWZyZXNoVG9rZW5QYXlsb2FkKSA9PiB7XG4gIGNvbnN0IHsgcmVmcmVzaFRva2VuOiBwcm92aWRlZFJlZnJlc2hUb2tlbiB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB2ZXJpZmllZCA9IGp3dFV0aWxzLnZlcmlmeVRva2VuKFxuICAgIHByb3ZpZGVkUmVmcmVzaFRva2VuLFxuICAgIGNvbmZpZy5qd3RfcmVmcmVzaF9zZWNyZXQsXG4gICk7XG5cbiAgaWYgKCF2ZXJpZmllZC5zdWNjZXNzKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgdmVyaWZpZWQuZXJyb3IpO1xuICB9XG5cbiAgY29uc3QgeyBpZCwgdG9rZW5WZXJzaW9uOiB0b2tlblRva2VuVmVyc2lvbiB9ID1cbiAgICB2ZXJpZmllZC5kYXRhIGFzIEp3dFBheWxvYWQgJiB7IHRva2VuVmVyc2lvbjogbnVtYmVyIH07XG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuXG4gIGlmICghdXNlciB8fCB1c2VyLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBoYXMgYmVlbiBkZWxldGVkXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiQWNjb3VudCBpcyBzdXNwZW5kZWRcIik7XG4gIH1cblxuICAvLyB0b2tlblZlcnNpb24gY2hhbmdlZCBcdTIxOTIgdG9rZW5zIHdlcmUgcmV2b2tlZCAobG9nb3V0IC8gcGFzc3dvcmQgY2hhbmdlKVxuICBpZiAodXNlci50b2tlblZlcnNpb24gIT09IHRva2VuVG9rZW5WZXJzaW9uKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMSwgXCJUb2tlbiBpcyBubyBsb25nZXIgdmFsaWQuIFBsZWFzZSBsb2dpbiBhZ2Fpbi5cIik7XG4gIH1cblxuICByZXR1cm4gaXNzdWVUb2tlbnModXNlcik7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTG9nb3V0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgbG9nb3V0ID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIGRhdGE6IHsgdG9rZW5WZXJzaW9uOiB7IGluY3JlbWVudDogMSB9IH0sXG4gIH0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEdldCBtZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldE1lRnJvbURCID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogdXNlcklkIH0sXG4gICAgb21pdDogeyBwYXNzd29yZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgcmV0dXJuIHVzZXI7XG59O1xuXG5leHBvcnQgY29uc3QgYXV0aFNlcnZpY2UgPSB7XG4gIHJlZ2lzdGVyVXNlcixcbiAgbG9naW5Vc2VyLFxuICBnb29nbGVMb2dpbixcbiAgZGVtb0xvZ2luLFxuICByZWZyZXNoVG9rZW4sXG4gIGxvZ291dCxcbiAgZ2V0TWVGcm9tREIsXG59OyIsICJpbXBvcnQgeyBPQXV0aDJDbGllbnQgfSBmcm9tIFwiZ29vZ2xlLWF1dGgtbGlicmFyeVwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmV4cG9ydCBjb25zdCBnb29nbGVDbGllbnQgPSBuZXcgT0F1dGgyQ2xpZW50KHtcbiAgY2xpZW50SWQ6IGNvbmZpZy5nb29nbGVfY2xpZW50X2lkLFxufSk7IiwgImltcG9ydCBqd3QsIHsgSnd0UGF5bG9hZCwgU2lnbk9wdGlvbnMgfSBmcm9tIFwianNvbndlYnRva2VuXCI7XG5cbmNvbnN0IGNyZWF0ZVRva2VuID0gKFxuICBwYXlsb2FkOiBKd3RQYXlsb2FkLFxuICBzZWNyZXQ6IHN0cmluZyxcbiAgZXhwaXJlc0luOiBTaWduT3B0aW9ucyxcbikgPT4ge1xuICBjb25zdCB0b2tlbiA9IGp3dC5zaWduKHBheWxvYWQsIHNlY3JldCwgZXhwaXJlc0luKTtcblxuICByZXR1cm4gdG9rZW47XG59O1xuXG5jb25zdCB2ZXJpZnlUb2tlbiA9ICh0b2tlbjogc3RyaW5nLCBzZWNyZXQ6IHN0cmluZykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHZlcmlmaWVkVG9rZW4gPSBqd3QudmVyaWZ5KHRva2VuLCBzZWNyZXQpO1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgZGF0YTogdmVyaWZpZWRUb2tlbixcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgY29uc29sZS5sb2coXCJUb2tlbiBWZXJpZmljYXRpb24gRmFpbGVkOlwiLCBlcnJvcik7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgfTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGp3dFV0aWxzID0ge1xuICBjcmVhdGVUb2tlbixcbiAgdmVyaWZ5VG9rZW4sXG59O1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVxdWVzdEhhbmRsZXIsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGNvbnN0IGNhdGNoQXN5bmMgPSAoZm46IFJlcXVlc3RIYW5kbGVyKSA9PiB7XG4gIHJldHVybiBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZm4ocmVxLCByZXMsIG5leHQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICB9XG4gIH07XG59O1xuIiwgImltcG9ydCB7IFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxudHlwZSBUTWV0YSA9IHtcbiAgcGFnZTogbnVtYmVyO1xuICBsaW1pdDogbnVtYmVyO1xuICB0b3RhbDogbnVtYmVyO1xuICB0b3RhbFBhZ2VzOiBudW1iZXI7XG59O1xuXG50eXBlIFRSZXNwb25zZURhdGE8VD4gPSB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHN0YXR1c0NvZGU6IG51bWJlcjtcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBkYXRhOiBUO1xuICBtZXRhPzogVE1ldGE7XG59O1xuXG5leHBvcnQgY29uc3Qgc2VuZFJlc3BvbnNlID0gPFQ+KHJlczogUmVzcG9uc2UsIGRhdGE6IFRSZXNwb25zZURhdGE8VD4pID0+IHtcbiAgcmVzLnN0YXR1cyhkYXRhLnN0YXR1c0NvZGUpLmpzb24oe1xuICAgIHN1Y2Nlc3M6IGRhdGEuc3VjY2VzcyxcbiAgICBtZXNzYWdlOiBkYXRhLm1lc3NhZ2UsXG4gICAgZGF0YTogZGF0YS5kYXRhLFxuICAgIG1ldGE6IGRhdGEubWV0YSxcbiAgfSk7XG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcblxuY29uc3QgcmVnaXN0ZXJTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIG5hbWU6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTmFtZSBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5taW4oMiwgXCJOYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgLm1heCgxMDAsIFwiTmFtZSBtdXN0IGJlIGF0IG1vc3QgMTAwIGNoYXJhY3RlcnNcIiksXG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbFwiKSxcbiAgcGFzc3dvcmQ6IHpcbiAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFzc3dvcmQgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5taW4oNiwgXCJQYXNzd29yZCBtdXN0IGJlIGF0IGxlYXN0IDYgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoNzIsIFwiUGFzc3dvcmQgbXVzdCBiZSBhdCBtb3N0IDcyIGNoYXJhY3RlcnNcIiksXG4gIHBob25lOiB6XG4gICAgLnN0cmluZygpXG4gICAgLm1heCgyMCwgXCJQaG9uZSBudW1iZXIgaXMgdG9vIGxvbmdcIilcbiAgICAub3B0aW9uYWwoKSxcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgbG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGVtYWlsOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkVtYWlsIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLmVtYWlsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbFwiKSxcbiAgcGFzc3dvcmQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFzc3dvcmQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgZ29vZ2xlTG9naW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkVG9rZW46IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiR29vZ2xlIGlkVG9rZW4gaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgZGVtb0xvZ2luU2NoZW1hID0gei5vYmplY3Qoe1xuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSwge1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgcm9sZVwiLFxuICB9KSxcbn0pO1xuXG4vLyByZWZyZXNoVG9rZW4gbWF5IGNvbWUgZnJvbSB0aGUgaHR0cE9ubHkgY29va2llIE9SIHRoZSByZXF1ZXN0IGJvZHkgXHUyMDE0XG4vLyB2YWxpZGF0aW9uIGlzIGxlbmllbnQgaGVyZTsgdGhlIGNvbnRyb2xsZXIgaGFuZGxlcyBib3RoIHNvdXJjZXMuXG5jb25zdCByZWZyZXNoVG9rZW5TY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHJlZnJlc2hUb2tlbjogei5zdHJpbmcoKS5taW4oMSkub3B0aW9uYWwoKSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUUmVnaXN0ZXJTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiByZWdpc3RlclNjaGVtYT47XG5leHBvcnQgdHlwZSBUTG9naW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBsb2dpblNjaGVtYT47XG5leHBvcnQgdHlwZSBUR29vZ2xlTG9naW5TY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBnb29nbGVMb2dpblNjaGVtYT47XG5leHBvcnQgdHlwZSBUUmVmcmVzaFRva2VuU2NoZW1hID0gei5pbmZlcjx0eXBlb2YgcmVmcmVzaFRva2VuU2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IGF1dGhWYWxpZGF0aW9ucyA9IHtcbiAgcmVnaXN0ZXJTY2hlbWEsXG4gIGxvZ2luU2NoZW1hLFxuICBnb29nbGVMb2dpblNjaGVtYSxcbiAgZGVtb0xvZ2luU2NoZW1hLFxuICByZWZyZXNoVG9rZW5TY2hlbWEsXG59OyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFpvZFR5cGUgfSBmcm9tIFwiem9kXCI7XG5cbnR5cGUgVmFsaWRhdGlvblNjaGVtYSA9IHtcbiAgYm9keT86IFpvZFR5cGU7XG4gIHF1ZXJ5PzogWm9kVHlwZTtcbiAgcGFyYW1zPzogWm9kVHlwZTtcbn07XG5cbi8vIFJ1bnMgWm9kIHNjaGVtYXMgYWdhaW5zdCByZXEuYm9keS9xdWVyeS9wYXJhbXMgYW5kIHJlcGxhY2VzIHRoZSBwYXJzZWRcbi8vIHZhbHVlcyBzbyBkb3duc3RyZWFtIGhhbmRsZXJzIHdvcmsgd2l0aCB2YWxpZGF0ZWQgKGFuZCB0eXBlZCkgZGF0YS5cbi8vIEFueSBab2RFcnJvciB0aHJvd24gaGVyZSBpcyBtYXBwZWQgdG8gYSA0MDAgYnkgZ2xvYmFsRXJyb3JIYW5kbGVyLlxuLy9cbi8vIHJlcS5ib2R5IGlzIHNhZmVseSB3cml0YWJsZSwgYnV0IGluIEV4cHJlc3MgNSByZXEucXVlcnkvcmVxLnBhcmFtcyBhcmVcbi8vIGdldHRlci1vbmx5IFx1MjAxNCB0aGV5IG11c3QgYmUgcmVkZWZpbmVkIHZpYSBkZWZpbmVQcm9wZXJ0eSB0byBzd2FwIGluIHRoZVxuLy8gcGFyc2VkIHZhbHVlcy5cbmNvbnN0IHZhbGlkYXRlUmVxdWVzdCA9IChzY2hlbWE6IFZhbGlkYXRpb25TY2hlbWEpID0+IHtcbiAgcmV0dXJuIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGlmIChzY2hlbWEuYm9keSkge1xuICAgICAgcmVxLmJvZHkgPSBzY2hlbWEuYm9keS5wYXJzZShyZXEuYm9keSk7XG4gICAgfVxuICAgIGlmIChzY2hlbWEucXVlcnkpIHtcbiAgICAgIGNvbnN0IHBhcnNlZFF1ZXJ5ID0gc2NoZW1hLnF1ZXJ5LnBhcnNlKHJlcS5xdWVyeSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVxLCBcInF1ZXJ5XCIsIHtcbiAgICAgICAgdmFsdWU6IHBhcnNlZFF1ZXJ5LFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChzY2hlbWEucGFyYW1zKSB7XG4gICAgICBjb25zdCBwYXJzZWRQYXJhbXMgPSBzY2hlbWEucGFyYW1zLnBhcnNlKHJlcS5wYXJhbXMpO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHJlcSwgXCJwYXJhbXNcIiwge1xuICAgICAgICB2YWx1ZTogcGFyc2VkUGFyYW1zLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgbmV4dCgpO1xuICB9O1xufTtcblxuZXhwb3J0IGRlZmF1bHQgdmFsaWRhdGVSZXF1ZXN0OyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IEp3dFBheWxvYWQgfSBmcm9tIFwianNvbndlYnRva2VuXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZ1wiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IGp3dFV0aWxzIH0gZnJvbSBcIi4uL3V0aWxzL2p3dFwiO1xuXG4vLyBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pIFx1MjE5MiBvbmx5IHRob3NlIHJvbGVzIHBhc3Ncbi8vIGF1dGgoKSBcdTIxOTIgYW55IGF1dGhlbnRpY2F0ZWQgdXNlciBwYXNzZXNcbmNvbnN0IGF1dGggPSAoLi4ucmVxdWlyZWRSb2xlczogUm9sZVtdKSA9PiB7XG4gIHJldHVybiBjYXRjaEFzeW5jKGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLmNvb2tpZXMuYWNjZXNzVG9rZW5cbiAgICAgID8gcmVxLmNvb2tpZXMuYWNjZXNzVG9rZW5cbiAgICAgIDogcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbj8uc3RhcnRzV2l0aChcIkJlYXJlciBcIilcbiAgICAgICAgPyByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uLnNwbGl0KFwiIFwiKVsxXVxuICAgICAgICA6IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb247XG5cbiAgICAvLyAxLiB0b2tlbiBtdXN0IGJlIHByZXNlbnRcbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMSxcbiAgICAgICAgXCJZb3UgYXJlIG5vdCBsb2dnZWQgaW4uIFBsZWFzZSBsb2dpbiB0byBjb250aW51ZS5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gMi4gdmVyaWZ5IHRoZSBhY2Nlc3MgdG9rZW5cbiAgICBjb25zdCB2ZXJpZmllZFRva2VuID0gand0VXRpbHMudmVyaWZ5VG9rZW4oXG4gICAgICB0b2tlbixcbiAgICAgIGNvbmZpZy5qd3RfYWNjZXNzX3NlY3JldCxcbiAgICApO1xuXG4gICAgaWYgKCF2ZXJpZmllZFRva2VuLnN1Y2Nlc3MpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIHZlcmlmaWVkVG9rZW4uZXJyb3IpO1xuICAgIH1cblxuICAgIGNvbnN0IHsgaWQsIHRva2VuVmVyc2lvbiB9ID0gdmVyaWZpZWRUb2tlbi5kYXRhIGFzIEp3dFBheWxvYWQgJiB7XG4gICAgICB0b2tlblZlcnNpb246IG51bWJlcjtcbiAgICB9O1xuXG4gICAgLy8gMy4gcmUtZmV0Y2ggdXNlciB0byBlbmZvcmNlIGFjY291bnQgc3RhdGUgb24gZXZlcnkgcmVxdWVzdFxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHtcbiAgICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDEsIFwiVXNlciBub3QgZm91bmQuXCIpO1xuICAgIH1cblxuICAgIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDMsXG4gICAgICAgIFwiVXNlciBpcyBzdXNwZW5kZWQuIFBsZWFzZSBjb250YWN0IHN1cHBvcnQgc2VydmljZS5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gNC4gdG9rZW5WZXJzaW9uIG11c3QgbWF0Y2ggREIgKGxvZ291dCAvIHBhc3N3b3JkIGNoYW5nZSBraWxscyBvbGQgdG9rZW5zKVxuICAgIGlmICh1c2VyLnRva2VuVmVyc2lvbiAhPT0gdG9rZW5WZXJzaW9uKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMSxcbiAgICAgICAgXCJTZXNzaW9uIGlzIG5vIGxvbmdlciB2YWxpZC4gUGxlYXNlIGxvZ2luIGFnYWluLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA1LiBhdXRob3JpemF0aW9uIHVzZXMgdGhlIERCIHJvbGUsIG5vdCB0aGUgKHBvc3NpYmx5IHN0YWxlKSBKV1Qgcm9sZVxuICAgIGlmIChyZXF1aXJlZFJvbGVzLmxlbmd0aCAmJiAhcmVxdWlyZWRSb2xlcy5pbmNsdWRlcyh1c2VyLnJvbGUpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIGFjY2VzcyB0aGlzIHJvdXRlLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA2LiBhdHRhY2ggdGhlIGF1dGhlbnRpY2F0ZWQgdXNlciB0byB0aGUgcmVxdWVzdFxuICAgIHJlcS51c2VyID0ge1xuICAgICAgaWQ6IHVzZXIuaWQsXG4gICAgICBuYW1lOiB1c2VyLm5hbWUsXG4gICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgIHJvbGU6IHVzZXIucm9sZSxcbiAgICB9O1xuXG4gICAgbmV4dCgpO1xuICB9KTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGF1dGg7IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyB1c2VyQ29udHJvbGxlciB9IGZyb20gXCIuL3VzZXIuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgdXNlclZhbGlkYXRpb25zIH0gZnJvbSBcIi4vdXNlci52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBPd24gcHJvZmlsZSBcdTIwMTQgYW55IGF1dGhlbnRpY2F0ZWQgdXNlclxucm91dGVyLnBhdGNoKFxuICBcIi9wcm9maWxlXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogdXNlclZhbGlkYXRpb25zLnVwZGF0ZVByb2ZpbGVTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLnVwZGF0ZVByb2ZpbGUsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgbGlzdCB1c2VycyB3aXRoIGZpbHRlcnMgKyBwYWdpbmF0aW9uXG5yb3V0ZXIuZ2V0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHVzZXJWYWxpZGF0aW9ucy51c2VyUXVlcnlTY2hlbWEgfSksXG4gIHVzZXJDb250cm9sbGVyLmdldFVzZXJzLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IHJvbGUgbWFuYWdlbWVudFxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvcm9sZVwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogdXNlclZhbGlkYXRpb25zLnVzZXJQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogdXNlclZhbGlkYXRpb25zLmNoYW5nZVJvbGVTY2hlbWEsXG4gIH0pLFxuICB1c2VyQ29udHJvbGxlci5jaGFuZ2VSb2xlLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IHN0YXR1cyBtYW5hZ2VtZW50XG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZC9zdGF0dXNcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHVzZXJWYWxpZGF0aW9ucy51c2VyUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHVzZXJWYWxpZGF0aW9ucy5jaGFuZ2VTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICB1c2VyQ29udHJvbGxlci5jaGFuZ2VTdGF0dXMsXG4pO1xuXG4vLyBBZG1pbiBcdTIwMTQgc29mdCBkZWxldGVcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHVzZXJWYWxpZGF0aW9ucy51c2VyUGFyYW1zU2NoZW1hIH0pLFxuICB1c2VyQ29udHJvbGxlci5kZWxldGVVc2VyLFxuKTtcblxuZXhwb3J0IGNvbnN0IHVzZXJSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyB1c2VyU2VydmljZSB9IGZyb20gXCIuL3VzZXIuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIFVwZGF0ZSBwcm9maWxlIGNvbnRyb2xsZXJcbmNvbnN0IHVwZGF0ZVByb2ZpbGUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHVzZXJTZXJ2aWNlLnVwZGF0ZVByb2ZpbGUodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUHJvZmlsZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgYWxsIHVzZXJzIChhZG1pbilcbmNvbnN0IGdldFVzZXJzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXNlclNlcnZpY2UuZ2V0VXNlcnMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJVc2VycyBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBVcGRhdGUgdXNlciByb2xlIChhZG1pbilcbmNvbnN0IGNoYW5nZVJvbGUgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIC8vIGFuIGFkbWluIG11c3Qgbm90IGRvd25ncmFkZS9jaGFuZ2UgdGhlaXIgb3duIHJvbGVcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgY2hhbmdlIHlvdXIgb3duIHJvbGUuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuY2hhbmdlUm9sZShpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlVzZXIgcm9sZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBVcGRhdGUgdXNlciBzdGF0dXMgKGFkbWluKVxuY29uc3QgY2hhbmdlU3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICAvLyBhbiBhZG1pbiBtdXN0IG5vdCBzdXNwZW5kL2FjdGl2YXRlIHRoZWlyIG93biBhY2NvdW50XG4gICAgaWYgKGlkID09PSByZXEudXNlcj8uaWQpIHtcbiAgICAgIHJldHVybiBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkZPUkJJRERFTixcbiAgICAgICAgbWVzc2FnZTogXCJZb3UgY2Fubm90IGNoYW5nZSB5b3VyIG93biBzdGF0dXMuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuY2hhbmdlU3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiB1c2VyLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gU29mdCBkZWxldGUgdXNlciAoYWRtaW4pXG5jb25zdCBkZWxldGVVc2VyID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICAvLyBhbiBhZG1pbiBtdXN0IG5vdCBkZWxldGUgdGhlaXIgb3duIGFjY291bnRcbiAgICBpZiAoaWQgPT09IHJlcS51c2VyPy5pZCkge1xuICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuRk9SQklEREVOLFxuICAgICAgICBtZXNzYWdlOiBcIllvdSBjYW5ub3QgZGVsZXRlIHlvdXIgb3duIGFjY291bnQuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgdXNlclNlcnZpY2UuZGVsZXRlVXNlcihpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiVXNlciBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHVzZXIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgdXNlckNvbnRyb2xsZXIgPSB7XG4gIHVwZGF0ZVByb2ZpbGUsXG4gIGdldFVzZXJzLFxuICBjaGFuZ2VSb2xlLFxuICBjaGFuZ2VTdGF0dXMsXG4gIGRlbGV0ZVVzZXIsXG59OyIsICJpbXBvcnQgYmNyeXB0IGZyb20gXCJiY3J5cHRqc1wiO1xuaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgUm9sZSwgVXNlclN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQge1xuICBJQ2hhbmdlUm9sZSxcbiAgSUNoYW5nZVN0YXR1cyxcbiAgSVVwZGF0ZVByb2ZpbGUsXG4gIElVc2VyUXVlcnksXG59IGZyb20gXCIuL3VzZXIuaW50ZXJmYWNlXCI7XG5cbmNvbnN0IHZhbGlkYXRlQWN0aXZlVXNlciA9IGFzeW5jIChpZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcblxuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG4gIGlmICh1c2VyLnN0YXR1cyA9PT0gXCJTVVNQRU5ERURcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiVXNlciBpcyBzdXNwZW5kZWQuIFBsZWFzZSBjb250YWN0IHN1cHBvcnQgc2VydmljZS5cIik7XG4gIH1cblxuICByZXR1cm4gdXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBVcGRhdGUgcHJvZmlsZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHVwZGF0ZVByb2ZpbGUgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHBheWxvYWQ6IElVcGRhdGVQcm9maWxlKSA9PiB7XG4gIGNvbnN0IHsgbmFtZSwgcGhvbmUsIGF2YXRhclVybCwgY3VycmVudFBhc3N3b3JkLCBuZXdQYXNzd29yZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogdXNlcklkIH0gfSk7XG5cbiAgaWYgKHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJBY2NvdW50IGhhcyBiZWVuIGRlbGV0ZWRcIik7XG4gIH1cbiAgaWYgKHVzZXIuYXV0aFByb3ZpZGVyID09PSBcIkdPT0dMRVwiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAzLFxuICAgICAgXCJHb29nbGUgYWNjb3VudHMgY2Fubm90IGNoYW5nZSBwYXNzd29yZC4gVXNlIEdvb2dsZSBzaWduLWluIHRvIG1hbmFnZSB5b3VyIHByb2ZpbGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGRhdGE6IFByaXNtYS5Vc2VyVXBkYXRlSW5wdXQgPSB7fTtcblxuICBpZiAobmFtZSkgZGF0YS5uYW1lID0gbmFtZTtcbiAgaWYgKHBob25lKSBkYXRhLnBob25lID0gcGhvbmU7XG4gIGlmIChhdmF0YXJVcmwpIGRhdGEuYXZhdGFyVXJsID0gYXZhdGFyVXJsO1xuXG4gIC8vIFBhc3N3b3JkIGNoYW5nZSByZXF1aXJlcyBjdXJyZW50UGFzc3dvcmQgKyBuZXdQYXNzd29yZFxuICBpZiAobmV3UGFzc3dvcmQpIHtcbiAgICBpZiAoIWN1cnJlbnRQYXNzd29yZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDdXJyZW50IHBhc3N3b3JkIGlzIHJlcXVpcmVkXCIpO1xuICAgIH1cbiAgICBpZiAoY3VycmVudFBhc3N3b3JkID09PSBuZXdQYXNzd29yZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJOZXcgcGFzc3dvcmQgbXVzdCBiZSBkaWZmZXJlbnRcIik7XG4gICAgfVxuXG4gICAgY29uc3QgaXNNYXRjaCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKGN1cnJlbnRQYXNzd29yZCwgdXNlci5wYXNzd29yZCB8fCBcIlwiKTtcbiAgICBpZiAoIWlzTWF0Y2gpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBjdXJyZW50IHBhc3N3b3JkXCIpO1xuICAgIH1cblxuICAgIGRhdGEucGFzc3dvcmQgPSBhd2FpdCBiY3J5cHQuaGFzaChcbiAgICAgIG5ld1Bhc3N3b3JkLFxuICAgICAgTnVtYmVyKGNvbmZpZy5iY3J5cHRfc2FsdF9yb3VuZHMpLFxuICAgICk7XG4gICAgZGF0YS50b2tlblZlcnNpb24gPSB7IGluY3JlbWVudDogMSB9O1xuICB9XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiB1c2VySWQgfSxcbiAgICBkYXRhLFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHVwZGF0ZWRVc2VyO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBsaXN0IHVzZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0VXNlcnMgPSBhc3luYyAocXVlcnk6IElVc2VyUXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgfHwgMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCB8fCAxMDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLlVzZXJXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gIH07XG5cbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIHdoZXJlLk9SID0gW1xuICAgICAgeyBuYW1lOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICB7IGVtYWlsOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgXTtcbiAgfVxuICBpZiAocXVlcnkucm9sZSkgd2hlcmUucm9sZSA9IHF1ZXJ5LnJvbGU7XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcblxuICBjb25zdCBbdXNlcnMsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudXNlci5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIHNraXA6IChwYWdlIC0gMSkgKiBsaW1pdCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gICAgfSksXG4gICAgcHJpc21hLnVzZXIuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiB1c2VycyxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiB1cGRhdGUgcm9sZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNoYW5nZVJvbGUgPSBhc3luYyAoaWQ6IHN0cmluZywgcGF5bG9hZDogSUNoYW5nZVJvbGUpID0+IHtcbiAgY29uc3QgeyByb2xlIH0gPSBwYXlsb2FkO1xuXG4gIGF3YWl0IHZhbGlkYXRlQWN0aXZlVXNlcihpZCk7XG5cbiAgY29uc3QgdXBkYXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YTogeyByb2xlLCB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB1cGRhdGVkVXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogdXBkYXRlIHN0YXR1cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGNoYW5nZVN0YXR1cyA9IGFzeW5jIChpZDogc3RyaW5nLCBwYXlsb2FkOiBJQ2hhbmdlU3RhdHVzKSA9PiB7XG4gIGNvbnN0IHsgc3RhdHVzIH0gPSBwYXlsb2FkO1xuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQgfSB9KTtcbiAgaWYgKCF1c2VyIHx8IHVzZXIuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgfVxuXG4gIGNvbnN0IHVwZGF0ZWRVc2VyID0gYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGRhdGE6IHtcbiAgICAgIHN0YXR1cyxcbiAgICAgIC8vIHJlYWN0aXZhdGluZyBwcmVzZXJ2ZXMgdGhlIGFjY291bnQgd2hpbGUgc3VzcGVuZGluZyByZXZva2VzIGFsbCBzZXNzaW9uc1xuICAgICAgLi4uKHN0YXR1cyA9PT0gVXNlclN0YXR1cy5TVVNQRU5ERUQgJiYgeyB0b2tlblZlcnNpb246IHsgaW5jcmVtZW50OiAxIH0gfSksXG4gICAgfSxcbiAgICBvbWl0OiB7IHBhc3N3b3JkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIHJldHVybiB1cGRhdGVkVXNlcjtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBZG1pbjogc29mdCBkZWxldGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBkZWxldGVVc2VyID0gYXN5bmMgKGlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICBpZiAoIXVzZXIgfHwgdXNlci5pc0RlbGV0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgY29uc3QgZGVsZXRlZFVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUsIHRva2VuVmVyc2lvbjogeyBpbmNyZW1lbnQ6IDEgfSB9LFxuICAgIG9taXQ6IHsgcGFzc3dvcmQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGRlbGV0ZWRVc2VyO1xufTtcblxuZXhwb3J0IGNvbnN0IHVzZXJTZXJ2aWNlID0ge1xuICB1cGRhdGVQcm9maWxlLFxuICBnZXRVc2VycyxcbiAgY2hhbmdlUm9sZSxcbiAgY2hhbmdlU3RhdHVzLFxuICBkZWxldGVVc2VyLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcbmltcG9ydCB7IFJvbGUsIFVzZXJTdGF0dXMgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuXG5jb25zdCB1cGRhdGVQcm9maWxlU2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBuYW1lOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC50cmltKClcbiAgICAgIC5taW4oMiwgXCJOYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gICAgICAubWF4KDEwMCwgXCJOYW1lIG11c3QgYmUgYXQgbW9zdCAxMDAgY2hhcmFjdGVyc1wiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gICAgcGhvbmU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLnRyaW0oKVxuICAgICAgLm1heCgyMCwgXCJQaG9uZSBudW1iZXIgaXMgdG9vIGxvbmdcIilcbiAgICAgIC5vcHRpb25hbCgpLFxuICAgIGF2YXRhclVybDogei5zdHJpbmcoKS50cmltKCkudXJsKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBpbWFnZSBVUkxcIikub3B0aW9uYWwoKSxcbiAgICBjdXJyZW50UGFzc3dvcmQ6IHouc3RyaW5nKCkubWluKDEpLm9wdGlvbmFsKCksXG4gICAgbmV3UGFzc3dvcmQ6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLm1pbig2LCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzXCIpXG4gICAgICAubWF4KDcyLCBcIlBhc3N3b3JkIG11c3QgYmUgYXQgbW9zdCA3MiBjaGFyYWN0ZXJzXCIpXG4gICAgICAub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnJlZmluZShcbiAgICAoZGF0YSkgPT5cbiAgICAgIGRhdGEubmV3UGFzc3dvcmQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgZGF0YS5jdXJyZW50UGFzc3dvcmQgIT09IHVuZGVmaW5lZCxcbiAgICB7IG1lc3NhZ2U6IFwiQ3VycmVudCBwYXNzd29yZCBpcyByZXF1aXJlZCB0byBjaGFuZ2UgcGFzc3dvcmRcIiB9LFxuICApO1xuXG5jb25zdCB1c2VyUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIHNlYXJjaDogei5zdHJpbmcoKS50cmltKCkub3B0aW9uYWwoKSxcbiAgcm9sZTogei5uYXRpdmVFbnVtKFJvbGUpLm9wdGlvbmFsKCksXG4gIHN0YXR1czogei5uYXRpdmVFbnVtKFVzZXJTdGF0dXMpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgdXNlclBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVXNlciBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBjaGFuZ2VSb2xlU2NoZW1hID0gei5vYmplY3Qoe1xuICByb2xlOiB6Lm5hdGl2ZUVudW0oUm9sZSwgeyByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHJvbGVcIiB9KSxcbn0pO1xuXG5jb25zdCBjaGFuZ2VTdGF0dXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHN0YXR1czogei5uYXRpdmVFbnVtKFVzZXJTdGF0dXMsIHtcbiAgICByZXF1aXJlZF9lcnJvcjogXCJQbGVhc2UgcHJvdmlkZSBhIHN0YXR1c1wiLFxuICB9KSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUVXBkYXRlUHJvZmlsZVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHVwZGF0ZVByb2ZpbGVTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVFVzZXJRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIHVzZXJRdWVyeVNjaGVtYT47XG5cbmV4cG9ydCBjb25zdCB1c2VyVmFsaWRhdGlvbnMgPSB7XG4gIHVwZGF0ZVByb2ZpbGVTY2hlbWEsXG4gIHVzZXJRdWVyeVNjaGVtYSxcbiAgdXNlclBhcmFtc1NjaGVtYSxcbiAgY2hhbmdlUm9sZVNjaGVtYSxcbiAgY2hhbmdlU3RhdHVzU2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBtdWx0ZXIgZnJvbSBcIm11bHRlclwiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgeyB1cGxvYWRzQ29udHJvbGxlciB9IGZyb20gXCIuL3VwbG9hZHMuY29udHJvbGxlclwiO1xuXG5jb25zdCB1cGxvYWQgPSBtdWx0ZXIoe1xuICBzdG9yYWdlOiBtdWx0ZXIubWVtb3J5U3RvcmFnZSgpLFxuICBsaW1pdHM6IHsgZmlsZVNpemU6IDUgKiAxMDI0ICogMTAyNCB9LFxuICBmaWxlRmlsdGVyOiAoX3JlcSwgZmlsZSwgY2IpID0+IHtcbiAgICBpZiAoL15pbWFnZVxcLyhqcGVnfHBuZ3x3ZWJwKSQvLnRlc3QoZmlsZS5taW1ldHlwZSkpIHtcbiAgICAgIGNiKG51bGwsIHRydWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYihcbiAgICAgICAgT2JqZWN0LmFzc2lnbihuZXcgRXJyb3IoXCJPbmx5IGpwZywgcG5nIG9yIHdlYnAgaW1hZ2VzIGFyZSBhbGxvd2VkXCIpLCB7XG4gICAgICAgICAgY29kZTogXCJJTlZBTElEX0ZJTEVfVFlQRVwiLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfVxuICB9LFxufSk7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG5yb3V0ZXIucG9zdChcbiAgXCIvaW1hZ2VcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdXBsb2FkLnNpbmdsZShcImltYWdlXCIpLFxuICB1cGxvYWRzQ29udHJvbGxlci51cGxvYWRJbWFnZSxcbik7XG5cbmV4cG9ydCBjb25zdCB1cGxvYWRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeSB9IGZyb20gXCIuL3VwbG9hZHMuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuXG4vLyBVcGxvYWQgYSBzaW5nbGUgaW1hZ2UgKEFHRU5UL0FETUlOKSBcdTIxOTIgQ2xvdWRpbmFyeVxuY29uc3QgdXBsb2FkSW1hZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBpZiAoIXJlcS5maWxlKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBcIkltYWdlIGZpbGUgaXMgcmVxdWlyZWRcIik7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXBsb2FkSW1hZ2VUb0Nsb3VkaW5hcnkocmVxLmZpbGUpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiSW1hZ2UgdXBsb2FkZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHVwbG9hZHNDb250cm9sbGVyID0ge1xuICB1cGxvYWRJbWFnZSxcbn07IiwgImltcG9ydCB7IHYyIGFzIGNsb3VkaW5hcnkgfSBmcm9tIFwiY2xvdWRpbmFyeVwiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmNsb3VkaW5hcnkuY29uZmlnKHtcbiAgY2xvdWRfbmFtZTogY29uZmlnLmNsb3VkaW5hcnlfY2xvdWRfbmFtZSxcbiAgYXBpX2tleTogY29uZmlnLmNsb3VkaW5hcnlfYXBpX2tleSxcbiAgYXBpX3NlY3JldDogY29uZmlnLmNsb3VkaW5hcnlfYXBpX3NlY3JldCxcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBjbG91ZGluYXJ5OyIsICJpbXBvcnQgY2xvdWRpbmFyeSBmcm9tIFwiLi4vLi4vbGliL2Nsb3VkaW5hcnlcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5cbmV4cG9ydCBjb25zdCB1cGxvYWRJbWFnZVRvQ2xvdWRpbmFyeSA9IChcbiAgZmlsZTogRXhwcmVzcy5NdWx0ZXIuRmlsZSxcbik6IFByb21pc2U8eyB1cmw6IHN0cmluZzsgcHVibGljSWQ6IHN0cmluZyB9PiA9PiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3QgdXBsb2FkU3RyZWFtID0gY2xvdWRpbmFyeS51cGxvYWRlci51cGxvYWRfc3RyZWFtKFxuICAgICAgeyBmb2xkZXI6IFwidHJpcHZlcnNlXCIgfSxcbiAgICAgIChlcnJvciwgcmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChlcnJvciB8fCAhcmVzdWx0KSB7XG4gICAgICAgICAgcmVqZWN0KG5ldyBBcHBFcnJvcig0MDAsIFwiSW1hZ2UgdXBsb2FkIGZhaWxlZC4gUGxlYXNlIHRyeSBhZ2Fpbi5cIikpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICByZXNvbHZlKHsgdXJsOiByZXN1bHQuc2VjdXJlX3VybCwgcHVibGljSWQ6IHJlc3VsdC5wdWJsaWNfaWQgfSk7XG4gICAgICB9LFxuICAgICk7XG5cbiAgICB1cGxvYWRTdHJlYW0uZW5kKGZpbGUuYnVmZmVyKTtcbiAgfSk7XG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgY29udGFjdENvbnRyb2xsZXIgfSBmcm9tIFwiLi9jb250YWN0LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGNvbnRhY3RWYWxpZGF0aW9ucyB9IGZyb20gXCIuL2NvbnRhY3QudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSByb3V0ZSAocHVibGljLCBubyBhdXRoKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBjb250YWN0VmFsaWRhdGlvbnMuY3JlYXRlTWVzc2FnZVNjaGVtYSB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIuY3JlYXRlTWVzc2FnZSxcbik7XG5cbi8vIDIuIExpc3QgY29udGFjdCBtZXNzYWdlcyByb3V0ZSAoYWRtaW4gb25seSlcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogY29udGFjdFZhbGlkYXRpb25zLmNvbnRhY3RRdWVyeVNjaGVtYSB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIuZ2V0TWVzc2FnZXMsXG4pO1xuXG4vLyAzLiBNYXJrIHJlc29sdmVkL3VucmVzb2x2ZWQgcm91dGUgKGFkbWluIG9ubHkpXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogY29udGFjdFZhbGlkYXRpb25zLmNvbnRhY3RQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogY29udGFjdFZhbGlkYXRpb25zLnVwZGF0ZVJlc29sdmVkU2NoZW1hLFxuICB9KSxcbiAgY29udGFjdENvbnRyb2xsZXIudXBkYXRlUmVzb2x2ZWQsXG4pO1xuXG5leHBvcnQgY29uc3QgY29udGFjdFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGNvbnRhY3RTZXJ2aWNlIH0gZnJvbSBcIi4vY29udGFjdC5zZXJ2aWNlXCI7XG5pbXBvcnQgeyBjYXRjaEFzeW5jIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NhdGNoQXN5bmNcIjtcbmltcG9ydCB7IHNlbmRSZXNwb25zZSB9IGZyb20gXCIuLi8uLi91dGlscy9zZW5kUmVzcG9uc2VcIjtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSBjb250cm9sbGVyIChwdWJsaWMpXG5jb25zdCBjcmVhdGVNZXNzYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IGNvbnRhY3RTZXJ2aWNlLmNyZWF0ZU1lc3NhZ2UocmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiTWVzc2FnZSBzZW50IHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG1lc3NhZ2UsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAyLiBMaXN0IGNvbnRhY3QgbWVzc2FnZXMgY29udHJvbGxlciAoYWRtaW4gb25seSlcbmNvbnN0IGdldE1lc3NhZ2VzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGFjdFNlcnZpY2UubGlzdE1lc3NhZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQ29udGFjdCBtZXNzYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIE1hcmsgcmVzb2x2ZWQvdW5yZXNvbHZlZCBjb250cm9sbGVyIChhZG1pbiBvbmx5KVxuY29uc3QgdXBkYXRlUmVzb2x2ZWQgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCB7IGlzUmVzb2x2ZWQgfSA9IHJlcS5ib2R5O1xuXG4gICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IGNvbnRhY3RTZXJ2aWNlLnJlc29sdmVNZXNzYWdlKGlkLCBpc1Jlc29sdmVkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJNZXNzYWdlIHN0YXR1cyB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG1lc3NhZ2UsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgY29udGFjdENvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZU1lc3NhZ2UsXG4gIGdldE1lc3NhZ2VzLFxuICB1cGRhdGVSZXNvbHZlZCxcbn07IiwgImltcG9ydCB7IFJlc2VuZCB9IGZyb20gXCJyZXNlbmRcIjtcbmltcG9ydCB7IEJvb2tpbmdTdGF0dXMgfSBmcm9tIFwiLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGNvbmZpZyBmcm9tIFwiLi4vY29uZmlnXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRhY3RFbWFpbERldGFpbHMge1xuICBuYW1lOiBzdHJpbmc7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIHN1YmplY3Q6IHN0cmluZztcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBjcmVhdGVkQXQ/OiBEYXRlO1xufVxuXG4vLyBMYXppbHkgaW5pdGlhbGlzZWQgc28gdGhlIG1vZHVsZSBpcyBpbXBvcnRhYmxlIGV2ZW4gd2hlbiBSRVNFTkRfQVBJX0tFWVxuLy8gaXMgbm90IGNvbmZpZ3VyZWQgKGUuZy4gbG9jYWwgZGV2IC8gZGVtbyB3aXRob3V0IGVtYWlsKS5cbmxldCByZXNlbmQ6IFJlc2VuZCB8IG51bGwgPSBudWxsO1xuXG5mdW5jdGlvbiBnZXRSZXNlbmQoKTogUmVzZW5kIHwgbnVsbCB7XG4gIGlmIChyZXNlbmQpIHJldHVybiByZXNlbmQ7XG4gIGlmICghY29uZmlnLnJlc2VuZF9hcGlfa2V5KSByZXR1cm4gbnVsbDtcbiAgcmVzZW5kID0gbmV3IFJlc2VuZChjb25maWcucmVzZW5kX2FwaV9rZXkpO1xuICByZXR1cm4gcmVzZW5kO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVIdG1sKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdmFsdWVcbiAgICAucmVwbGFjZSgvJi9nLCBcIiZhbXA7XCIpXG4gICAgLnJlcGxhY2UoLzwvZywgXCImbHQ7XCIpXG4gICAgLnJlcGxhY2UoLz4vZywgXCImZ3Q7XCIpXG4gICAgLnJlcGxhY2UoL1wiL2csIFwiJnF1b3Q7XCIpXG4gICAgLnJlcGxhY2UoLycvZywgXCImIzAzOTtcIik7XG59XG5cbmNvbnN0IGVtYWlsTGF5b3V0ID0gKGNvbnRlbnQ6IHN0cmluZykgPT4gYFxuICA8ZGl2IHN0eWxlPVwiZm9udC1mYW1pbHk6IEFyaWFsLCBIZWx2ZXRpY2EsIHNhbnMtc2VyaWY7IG1heC13aWR0aDogNTYwcHg7IG1hcmdpbjogMCBhdXRvOyBjb2xvcjogIzFhMWExYTtcIj5cbiAgICA8ZGl2IHN0eWxlPVwiYmFja2dyb3VuZDogIzBmNzY2ZTsgcGFkZGluZzogMjRweDsgYm9yZGVyLXJhZGl1czogOHB4IDhweCAwIDA7XCI+XG4gICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAjZmZmZmZmOyBmb250LXNpemU6IDE4cHg7IGZvbnQtd2VpZ2h0OiBib2xkO1wiPlRyaXBWZXJzZTwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IHN0eWxlPVwiYm9yZGVyOiAxcHggc29saWQgI2U1ZTdlYjsgYm9yZGVyLXRvcDogbm9uZTsgcGFkZGluZzogMzJweDsgYm9yZGVyLXJhZGl1czogMCAwIDhweCA4cHg7XCI+XG4gICAgICAke2NvbnRlbnR9XG4gICAgPC9kaXY+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDEycHg7IGNvbG9yOiAjNmI3MjgwOyBtYXJnaW4tdG9wOiAxNnB4OyB0ZXh0LWFsaWduOiBjZW50ZXI7XCI+XG4gICAgICBZb3UgYXJlIHJlY2VpdmluZyB0aGlzIGVtYWlsIGJlY2F1c2Ugb2YgYWN0aXZpdHkgb24gVHJpcFZlcnNlLlxuICAgIDwvcD5cbiAgPC9kaXY+XG5gO1xuXG4vLyBOb3RpZmllcyB0aGUgc3VwcG9ydCBpbmJveCBhYm91dCBhIG5ldyBjb250YWN0IGZvcm0gc3VibWlzc2lvbi5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbiA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBjb250YWN0IG5vdGlmaWNhdGlvbi5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZnJvbSA9IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCI7XG4gIGNvbnN0IGNyZWF0ZWRBdCA9IGRldGFpbHMuY3JlYXRlZEF0Py50b0lTT1N0cmluZygpID8/IFwianVzdCBub3dcIjtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5OZXcgY29udGFjdCBtZXNzYWdlPC9oMj5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5OYW1lPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX08L3N0cm9uZz48L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0cj5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7IGNvbG9yOiAjNmI3MjgwO1wiPkVtYWlsPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGRldGFpbHMuZW1haWwpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+U3ViamVjdDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGRldGFpbHMuc3ViamVjdCl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWNlaXZlZDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPiR7ZXNjYXBlSHRtbChjcmVhdGVkQXQpfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgIDwvdGFibGU+XG4gICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6IDE2cHg7IHBhZGRpbmc6IDE2cHg7IGJhY2tncm91bmQ6ICNmOWZhZmI7IGJvcmRlci1yYWRpdXM6IDZweDsgd2hpdGUtc3BhY2U6IHByZS13cmFwO1wiPlxuICAgICAgJHtlc2NhcGVIdG1sKGRldGFpbHMubWVzc2FnZSl9XG4gICAgPC9kaXY+XG4gIGA7XG5cbiAgYXdhaXQgY2xpZW50LmVtYWlscy5zZW5kKHtcbiAgICBmcm9tLFxuICAgIHRvOiBbY29uZmlnLmNvbnRhY3RfcmVjZWl2ZXJfZW1haWxdLFxuICAgIHN1YmplY3Q6IGBOZXcgY29udGFjdCBtZXNzYWdlOiAke2RldGFpbHMuc3ViamVjdH1gLFxuICAgIGh0bWw6IGVtYWlsTGF5b3V0KGNvbnRlbnQpLFxuICB9KTtcbn07XG5cbi8vIFNlbmRzIGEgY29uZmlybWF0aW9uIHJlcGx5IHRvIHRoZSBwZXJzb24gd2hvIHN1Ym1pdHRlZCB0aGUgZm9ybS5cbmV4cG9ydCBjb25zdCBzZW5kQ29udGFjdEF1dG9SZXBseSA9IGFzeW5jIChcbiAgZGV0YWlsczogSUNvbnRhY3RFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIGNvbnRhY3QgYXV0by1yZXBseS5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZnJvbSA9IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCI7XG4gIGNvbnN0IHJlY2VpdmVyRW1haWwgPSBjb25maWcuY29udGFjdF9yZWNlaXZlcl9lbWFpbDtcblxuICBjb25zdCBjb250ZW50ID0gYFxuICAgIDxoMiBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZvbnQtc2l6ZTogMThweDtcIj5UaGFua3MgZm9yIHJlYWNoaW5nIG91dCwgJHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9ITwvaDI+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDE0cHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjMzc0MTUxO1wiPlxuICAgICAgV2UmYXBvczt2ZSByZWNlaXZlZCB5b3VyIG1lc3NhZ2UgYWJvdXRcbiAgICAgIDxzdHJvbmc+JmxkcXVvOyR7ZXNjYXBlSHRtbChkZXRhaWxzLnN1YmplY3QpfSZyZHF1bzs8L3N0cm9uZz4gYW5kIG91ciBzdXBwb3J0XG4gICAgICB0ZWFtIHdpbGwgZ2V0IGJhY2sgdG8geW91IHdpdGhpbiBvbmUgYnVzaW5lc3MgZGF5LlxuICAgIDwvcD5cbiAgYDtcblxuICBhd2FpdCBjbGllbnQuZW1haWxzLnNlbmQoe1xuICAgIGZyb20sXG4gICAgdG86IFtkZXRhaWxzLmVtYWlsXSxcbiAgICByZXBseVRvOiByZWNlaXZlckVtYWlsLFxuICAgIHN1YmplY3Q6IFwiV2UgcmVjZWl2ZWQgeW91ciBtZXNzYWdlIC0gVHJpcFZlcnNlXCIsXG4gICAgaHRtbDogZW1haWxMYXlvdXQoY29udGVudCksXG4gIH0pO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEJvb2tpbmcgZW1haWxzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZXhwb3J0IGludGVyZmFjZSBJQm9va2luZ0VtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG4gIHRyYXZlbGVyczogbnVtYmVyO1xuICB0b3RhbFByaWNlOiBudW1iZXI7XG4gIHN0YXR1czogQm9va2luZ1N0YXR1cztcbn1cblxuLy8gSW5mb3JtcyB0aGUgY3VzdG9tZXIgYWJvdXQgYSBib29raW5nIGNyZWF0ZS9jb25maXJtL2NhbmNlbC5cbi8vIEJlc3QtZWZmb3J0IGxpa2UgdGhlIGNvbnRhY3QgZW1haWxzIFx1MjAxNCBhIGZhaWx1cmUgbXVzdCBuZXZlciBmYWlsIHRoZSByZXF1ZXN0LlxuZXhwb3J0IGNvbnN0IHNlbmRCb29raW5nRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElCb29raW5nRW1haWxEZXRhaWxzLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNsaWVudCA9IGdldFJlc2VuZCgpO1xuICBpZiAoIWNsaWVudCB8fCAhZGV0YWlscy5lbWFpbCkge1xuICAgIGNvbnNvbGUud2FybihcIltlbWFpbF0gUmVzZW5kIG5vdCBjb25maWd1cmVkOyBza2lwcGluZyBib29raW5nIGVtYWlsLlwiKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBmcm9tID0gY29uZmlnLmVtYWlsX2Zyb20gfHwgXCJUcmlwVmVyc2UgPG9uYm9hcmRpbmdAcmVzZW5kLmRldj5cIjtcbiAgY29uc3QgdHJhdmVsRGF0ZSA9IGRldGFpbHMudHJhdmVsRGF0ZS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKTtcblxuICBjb25zdCBzdGF0dXNDb3B5OiBSZWNvcmQ8XG4gICAgQm9va2luZ1N0YXR1cyxcbiAgICB7IHN1YmplY3Q6IHN0cmluZzsgaGVhZGluZzogc3RyaW5nOyBib2R5OiBzdHJpbmcgfVxuICA+ID0ge1xuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgcmVjZWl2ZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyByZWNlaXZlZFwiLFxuICAgICAgYm9keTogXCJXZSd2ZSByZWNlaXZlZCB5b3VyIGJvb2tpbmcgcmVxdWVzdC4gVGhlIGFnZW50IHdpbGwgY29uZmlybSBpdCBzaG9ydGx5LlwiLFxuICAgIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuUEFJRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiUGF5bWVudCByZWNlaXZlZCAtIFRyaXBWZXJzZVwiLFxuICAgICAgaGVhZGluZzogXCJQYXltZW50IHJlY2VpdmVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgcGF5bWVudCBoYXMgYmVlbiByZWNlaXZlZCwgYW5kIHRoZSBhZ2VudCB3aWxsIGNvbmZpcm0geW91ciBib29raW5nIHNob3J0bHkuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DT05GSVJNRURdOiB7XG4gICAgICBzdWJqZWN0OiBcIkJvb2tpbmcgY29uZmlybWVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIkJvb2tpbmcgY29uZmlybWVkXCIsXG4gICAgICBib2R5OiBcIkdyZWF0IG5ld3MgXHUyMDE0IHlvdXIgYm9va2luZyBoYXMgYmVlbiBjb25maXJtZWQuIFdlIGxvb2sgZm9yd2FyZCB0byBob3N0aW5nIHlvdSFcIixcbiAgICB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHtcbiAgICAgIHN1YmplY3Q6IFwiQm9va2luZyBjYW5jZWxsZWQgLSBUcmlwVmVyc2VcIixcbiAgICAgIGhlYWRpbmc6IFwiQm9va2luZyBjYW5jZWxsZWRcIixcbiAgICAgIGJvZHk6IFwiWW91ciBib29raW5nIGhhcyBiZWVuIGNhbmNlbGxlZC4gSWYgdGhpcyB3YXNuJ3QgZXhwZWN0ZWQsIHBsZWFzZSBjb250YWN0IHN1cHBvcnQuXCIsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DT01QTEVURURdOiB7XG4gICAgICBzdWJqZWN0OiBcIlRyaXAgY29tcGxldGVkIC0gVHJpcFZlcnNlXCIsXG4gICAgICBoZWFkaW5nOiBcIlRyaXAgY29tcGxldGVkXCIsXG4gICAgICBib2R5OiBcIllvdXIgdHJpcCBoYXMgYmVlbiBtYXJrZWQgYXMgY29tcGxldGVkLiBUaGFuayB5b3UgZm9yIHRyYXZlbGxpbmcgd2l0aCBUcmlwVmVyc2UhXCIsXG4gICAgfSxcbiAgfTtcblxuICBjb25zdCBjb3B5ID0gc3RhdHVzQ29weVtkZXRhaWxzLnN0YXR1c107XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+JHtjb3B5LmhlYWRpbmd9PC9oMj5cbiAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTRweDsgbGluZS1oZWlnaHQ6IDEuNjsgY29sb3I6ICMzNzQxNTE7XCI+XG4gICAgICBIaSAke2VzY2FwZUh0bWwoZGV0YWlscy5uYW1lKX0sPGJyLz5cbiAgICAgICR7Y29weS5ib2R5fVxuICAgIDwvcD5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5QYWNrYWdlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5wYWNrYWdlVGl0bGUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VHJhdmVsIGRhdGU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwodHJhdmVsRGF0ZSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5UcmF2ZWxlcnM8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwoU3RyaW5nKGRldGFpbHMudHJhdmVsZXJzKSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5Ub3RhbDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwO1wiPjxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChkZXRhaWxzLnRvdGFsUHJpY2UudG9GaXhlZCgyKSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgPC90YWJsZT5cbiAgYDtcblxuICBhd2FpdCBjbGllbnQuZW1haWxzLnNlbmQoe1xuICAgIGZyb20sXG4gICAgdG86IFtkZXRhaWxzLmVtYWlsXSxcbiAgICBzdWJqZWN0OiBjb3B5LnN1YmplY3QsXG4gICAgaHRtbDogZW1haWxMYXlvdXQoY29udGVudCksXG4gIH0pO1xufTtcblxuLy8gSW5mb3JtcyB0aGUgY3VzdG9tZXIgdGhhdCBhIHBhaWQgYm9va2luZyB3YXMgY2FuY2VsbGVkIGFuZCB0aGUgcGF5bWVudCBoYXNcbi8vIGJlZW4gcmVmdW5kZWQuIEJlc3QtZWZmb3J0IGxpa2UgdGhlIG90aGVyIGVtYWlscy5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlZnVuZEVtYWlsRGV0YWlscyB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG4gIGFtb3VudDogbnVtYmVyO1xuICByZWZ1bmRSZWZJZD86IHN0cmluZyB8IG51bGw7XG59XG5cbmV4cG9ydCBjb25zdCBzZW5kUmVmdW5kRW1haWwgPSBhc3luYyAoXG4gIGRldGFpbHM6IElSZWZ1bmRFbWFpbERldGFpbHMsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0UmVzZW5kKCk7XG4gIGlmICghY2xpZW50IHx8ICFkZXRhaWxzLmVtYWlsKSB7XG4gICAgY29uc29sZS53YXJuKFwiW2VtYWlsXSBSZXNlbmQgbm90IGNvbmZpZ3VyZWQ7IHNraXBwaW5nIHJlZnVuZCBlbWFpbC5cIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZnJvbSA9IGNvbmZpZy5lbWFpbF9mcm9tIHx8IFwiVHJpcFZlcnNlIDxvbmJvYXJkaW5nQHJlc2VuZC5kZXY+XCI7XG4gIGNvbnN0IHRyYXZlbERhdGUgPSBkZXRhaWxzLnRyYXZlbERhdGUudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCk7XG5cbiAgY29uc3QgY29udGVudCA9IGBcbiAgICA8aDIgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmb250LXNpemU6IDE4cHg7XCI+UmVmdW5kIGlzc3VlZDwvaDI+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDE0cHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjMzc0MTUxO1wiPlxuICAgICAgSGkgJHtlc2NhcGVIdG1sKGRldGFpbHMubmFtZSl9LDxici8+XG4gICAgICBZb3VyIGJvb2tpbmcgd2FzIGNhbmNlbGxlZCwgYW5kIDxzdHJvbmc+JiMyNTQ3OyR7ZXNjYXBlSHRtbChcbiAgICAgICAgZGV0YWlscy5hbW91bnQudG9GaXhlZCgyKSxcbiAgICAgICl9PC9zdHJvbmc+IGhhcyBiZWVuIHJlZnVuZGVkIHRvIHlvdXIgb3JpZ2luYWwgcGF5bWVudCBtZXRob2QuIFBsZWFzZSBhbGxvd1xuICAgICAgNS0xMCBidXNpbmVzcyBkYXlzIGZvciB0aGUgbW9uZXkgdG8gYXBwZWFyLlxuICAgIDwvcD5cbiAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxNHB4O1wiPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7IHdpZHRoOiAxMjBweDtcIj5QYWNrYWdlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZGV0YWlscy5wYWNrYWdlVGl0bGUpfTwvc3Ryb25nPjwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDsgY29sb3I6ICM2YjcyODA7XCI+VHJhdmVsIGRhdGU8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj4ke2VzY2FwZUh0bWwodHJhdmVsRGF0ZSl9PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWZ1bmRlZCBhbW91bnQ8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHggMDtcIj48c3Ryb25nPiYjMjU0Nzske2VzY2FwZUh0bWwoZGV0YWlscy5hbW91bnQudG9GaXhlZCgyKSl9PC9zdHJvbmc+PC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICAke2RldGFpbHMucmVmdW5kUmVmSWRcbiAgICAgICAgPyBgXG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweCAwOyBjb2xvcjogIzZiNzI4MDtcIj5SZWZ1bmQgcmVmZXJlbmNlPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4IDA7XCI+JHtlc2NhcGVIdG1sKGRldGFpbHMucmVmdW5kUmVmSWQpfTwvdGQ+XG4gICAgICA8L3RyPmBcbiAgICAgICAgOiBcIlwifVxuICAgIDwvdGFibGU+XG4gICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDEzcHg7IGxpbmUtaGVpZ2h0OiAxLjY7IGNvbG9yOiAjNmI3MjgwOyBtYXJnaW4tdG9wOiAxNnB4O1wiPlxuICAgICAgSWYgeW91IGhhdmUgYW55IHF1ZXN0aW9ucyBhYm91dCB0aGlzIHJlZnVuZCwgcGxlYXNlIGNvbnRhY3Qgc3VwcG9ydC5cbiAgICA8L3A+XG4gIGA7XG5cbiAgYXdhaXQgY2xpZW50LmVtYWlscy5zZW5kKHtcbiAgICBmcm9tLFxuICAgIHRvOiBbZGV0YWlscy5lbWFpbF0sXG4gICAgc3ViamVjdDogXCJCb29raW5nIGNhbmNlbGxlZCAmIHJlZnVuZCBpc3N1ZWQgLSBUcmlwVmVyc2VcIixcbiAgICBodG1sOiBlbWFpbExheW91dChjb250ZW50KSxcbiAgfSk7XG59OyIsICJpbXBvcnQgeyBQcmlzbWEgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9jbGllbnRcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQge1xuICBzZW5kQ29udGFjdEF1dG9SZXBseSxcbiAgc2VuZENvbnRhY3ROb3RpZmljYXRpb24sXG59IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgSUNvbnRhY3RRdWVyeSwgSUNyZWF0ZUNvbnRhY3RQYXlsb2FkIH0gZnJvbSBcIi4vY29udGFjdC5pbnRlcmZhY2VcIjtcblxuLy8gMS4gQ3JlYXRlIGNvbnRhY3QgbWVzc2FnZSAocHVibGljKVxuY29uc3QgY3JlYXRlTWVzc2FnZSA9IGFzeW5jIChwYXlsb2FkOiBJQ3JlYXRlQ29udGFjdFBheWxvYWQpID0+IHtcbiAgY29uc3QgY3JlYXRlZE1lc3NhZ2UgPSBhd2FpdCBwcmlzbWEuY29udGFjdE1lc3NhZ2UuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICBuYW1lOiBwYXlsb2FkLm5hbWUsXG4gICAgICBlbWFpbDogcGF5bG9hZC5lbWFpbCxcbiAgICAgIHN1YmplY3Q6IHBheWxvYWQuc3ViamVjdCxcbiAgICAgIG1lc3NhZ2U6IHBheWxvYWQubWVzc2FnZSxcbiAgICB9LFxuICB9KTtcblxuICAvLyBFbWFpbHMgYXJlIGJlc3QtZWZmb3J0OiBhIGZhaWx1cmUgaGVyZSBtdXN0IG5ldmVyIGZhaWwgdGhlIHN1Ym1pc3Npb25cbiAgLy8gKHRoZSBtZXNzYWdlIGlzIGFscmVhZHkgc2F2ZWQgdG8gdGhlIGluYm94KS5cbiAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kQ29udGFjdE5vdGlmaWNhdGlvbih7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgICBzZW5kQ29udGFjdEF1dG9SZXBseSh7IC4uLmNyZWF0ZWRNZXNzYWdlLCBjcmVhdGVkQXQ6IGNyZWF0ZWRNZXNzYWdlLmNyZWF0ZWRBdCB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIGNyZWF0ZWRNZXNzYWdlO1xufTtcblxuLy8gMi4gTGlzdCBjb250YWN0IG1lc3NhZ2VzIChhZG1pbiBvbmx5LCBwYWdpbmF0ZWQsIGZpbHRlcmFibGUgYnkgaXNSZXNvbHZlZClcbmNvbnN0IGxpc3RNZXNzYWdlcyA9IGFzeW5jIChxdWVyeTogSUNvbnRhY3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQ29udGFjdE1lc3NhZ2VXaGVyZUlucHV0IHwgdW5kZWZpbmVkID1cbiAgICBxdWVyeS5pc1Jlc29sdmVkID09PSB1bmRlZmluZWRcbiAgICAgID8gdW5kZWZpbmVkXG4gICAgICA6IHsgaXNSZXNvbHZlZDogcXVlcnkuaXNSZXNvbHZlZCB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLmNvbnRhY3RNZXNzYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YSxcbiAgICBtZXRhOiB7XG4gICAgICBwYWdlLFxuICAgICAgbGltaXQsXG4gICAgICB0b3RhbCxcbiAgICAgIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSxcbiAgICB9LFxuICB9O1xufTtcblxuLy8gMy4gTWFyayBhIGNvbnRhY3QgbWVzc2FnZSByZXNvbHZlZC91bnJlc29sdmVkIChhZG1pbiBvbmx5KVxuY29uc3QgcmVzb2x2ZU1lc3NhZ2UgPSBhc3luYyAoaWQ6IHN0cmluZywgaXNSZXNvbHZlZDogYm9vbGVhbikgPT4ge1xuICByZXR1cm4gcHJpc21hLmNvbnRhY3RNZXNzYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBkYXRhOiB7IGlzUmVzb2x2ZWQgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgY29udGFjdFNlcnZpY2UgPSB7XG4gIGNyZWF0ZU1lc3NhZ2UsXG4gIGxpc3RNZXNzYWdlcyxcbiAgcmVzb2x2ZU1lc3NhZ2UsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVNZXNzYWdlU2NoZW1hID0gei5vYmplY3Qoe1xuICBuYW1lOiB6XG4gICAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIk5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC50cmltKClcbiAgICAubWluKDIsIFwiTmFtZSBtdXN0IGJlIGF0IGxlYXN0IDIgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMTAwLCBcIk5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpLFxuICBlbWFpbDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFbWFpbCBpcyByZXF1aXJlZFwiIH0pXG4gICAgLnRyaW0oKVxuICAgIC5lbWFpbChcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWwgYWRkcmVzc1wiKSxcbiAgc3ViamVjdDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJTdWJqZWN0IGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigyLCBcIlN1YmplY3QgbXVzdCBiZSBhdCBsZWFzdCAyIGNoYXJhY3RlcnNcIilcbiAgICAubWF4KDIwMCwgXCJTdWJqZWN0IG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKSxcbiAgbWVzc2FnZTogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJNZXNzYWdlIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudHJpbSgpXG4gICAgLm1pbigxMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbGVhc3QgMTAgY2hhcmFjdGVyc1wiKVxuICAgIC5tYXgoMjAwMCwgXCJNZXNzYWdlIG11c3QgYmUgYXQgbW9zdCAyMDAwIGNoYXJhY3RlcnNcIiksXG59KS5zdHJpY3QoKTtcblxuY29uc3QgY29udGFjdFF1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBpc1Jlc29sdmVkOiB6XG4gICAgLmVudW0oW1widHJ1ZVwiLCBcImZhbHNlXCJdKVxuICAgIC5vcHRpb25hbCgpXG4gICAgLnRyYW5zZm9ybSgodmFsKSA9PiAodmFsID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiB2YWwgPT09IFwidHJ1ZVwiKSksXG59KTtcblxuY29uc3QgY29udGFjdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiTWVzc2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVSZXNvbHZlZFNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgaXNSZXNvbHZlZDogei5ib29sZWFuKHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcImlzUmVzb2x2ZWQgaXMgcmVxdWlyZWRcIixcbiAgICAgIGludmFsaWRfdHlwZV9lcnJvcjogXCJpc1Jlc29sdmVkIG11c3QgYmUgYSBib29sZWFuXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKVxuICAucmVmaW5lKChkYXRhKSA9PiB0eXBlb2YgZGF0YS5pc1Jlc29sdmVkID09PSBcImJvb2xlYW5cIiwge1xuICAgIG1lc3NhZ2U6IFwiaXNSZXNvbHZlZCBtdXN0IGJlIGEgYm9vbGVhblwiLFxuICB9KTtcblxuZXhwb3J0IGNvbnN0IGNvbnRhY3RWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlTWVzc2FnZVNjaGVtYSxcbiAgY29udGFjdFF1ZXJ5U2NoZW1hLFxuICBjb250YWN0UGFyYW1zU2NoZW1hLFxuICB1cGRhdGVSZXNvbHZlZFNjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBib29raW5nQ29udHJvbGxlciB9IGZyb20gXCIuL2Jvb2tpbmcuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYm9va2luZ1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYm9va2luZy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBDcmVhdGUgYm9va2luZyAoY3VzdG9tZXIgb25seSBcdTIwMTQgYWdlbnRzIHNlbGwsIGFkbWlucyBtYW5hZ2UpXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5VU0VSKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogYm9va2luZ1ZhbGlkYXRpb25zLmNyZWF0ZVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuY3JlYXRlQm9va2luZyxcbik7XG5cbi8vIE15IGJvb2tpbmdzIFx1MjAxNCBvd24gYm9va2luZ3Mgd2l0aCBmaWx0ZXJzICsgcGFnaW5hdGlvbiAob3duZXIgaXMgYWx3YXlzIFVTRVIpXG4vLyBOT1RFOiByZWdpc3RlcmVkIGJlZm9yZSBcIi86aWRcIiBzbyB0aGUgcGFyYW0gcm91dGUgZG9lc24ndCBzd2FsbG93IGl0Llxucm91dGVyLmdldChcbiAgXCIvbXktYm9va2luZ3NcIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYm9va2luZ1ZhbGlkYXRpb25zLmJvb2tpbmdRdWVyeVNjaGVtYSB9KSxcbiAgYm9va2luZ0NvbnRyb2xsZXIuZ2V0TXlCb29raW5ncyxcbik7XG5cbi8vIEFnZW50IGJvb2tpbmdzIFx1MjAxNCBzY29wZWQgdG8gcGFja2FnZXMgdGhlIGFnZW50IG93bnNcbnJvdXRlci5nZXQoXG4gIFwiL2FnZW50LWJvb2tpbmdzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBZ2VudEJvb2tpbmdzLFxuKTtcblxuLy8gQm9va2luZyBkZXRhaWwgXHUyMDE0IG93bmVyIC8gcGFja2FnZSBhZ2VudCAvIGFkbWluXG5yb3V0ZXIuZ2V0KFxuICBcIi86aWRcIixcbiAgYXV0aCgpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRCb29raW5nRGV0YWlsLFxuKTtcblxuLy8gQWRtaW4gXHUyMDE0IGFsbCBib29raW5nc1xucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBib29raW5nVmFsaWRhdGlvbnMuYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hIH0pLFxuICBib29raW5nQ29udHJvbGxlci5nZXRBbGxCb29raW5ncyxcbik7XG5cbi8vIFN0YXR1cyB0cmFuc2l0aW9uIFx1MjAxNCB2YWxpZGF0ZWQgYWdhaW5zdCB0aGUgc3RhdGUgbWFjaGluZSBpbiB0aGUgc2VydmljZVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJvb2tpbmdWYWxpZGF0aW9ucy5ib29raW5nUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJvb2tpbmdWYWxpZGF0aW9ucy51cGRhdGVTdGF0dXNTY2hlbWEsXG4gIH0pLFxuICBib29raW5nQ29udHJvbGxlci51cGRhdGVCb29raW5nU3RhdHVzLFxuKTtcblxuZXhwb3J0IGNvbnN0IGJvb2tpbmdSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBib29raW5nU2VydmljZSB9IGZyb20gXCIuL2Jvb2tpbmcuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbmNvbnN0IGNyZWF0ZUJvb2tpbmcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmNyZWF0ZUJvb2tpbmcodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJCb29raW5nIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldE15Qm9va2luZ3MgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB1c2VySWQgPSByZXEudXNlcj8uaWQgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0TXlCb29raW5ncyh1c2VySWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5jb25zdCBnZXRBZ2VudEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gcmVxLnVzZXI/LmlkIGFzIHN0cmluZztcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEFnZW50Qm9va2luZ3ModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmdzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuY29uc3QgZ2V0Qm9va2luZ0RldGFpbCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGJvb2tpbmdTZXJ2aWNlLmdldEJvb2tpbmdEZXRhaWwoaWQsIHJlcS51c2VyISk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiQm9va2luZyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IGdldEFsbEJvb2tpbmdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYm9va2luZ1NlcnZpY2UuZ2V0QWxsQm9va2luZ3MocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJCb29raW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmNvbnN0IHVwZGF0ZUJvb2tpbmdTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcblxuICAgIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBib29raW5nU2VydmljZS51cGRhdGVCb29raW5nU3RhdHVzKFxuICAgICAgaWQsXG4gICAgICByZXEuYm9keSxcbiAgICAgIHJlcS51c2VyISxcbiAgICApO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkJvb2tpbmcgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogYm9va2luZyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBib29raW5nQ29udHJvbGxlciA9IHtcbiAgY3JlYXRlQm9va2luZyxcbiAgZ2V0TXlCb29raW5ncyxcbiAgZ2V0QWdlbnRCb29raW5ncyxcbiAgZ2V0Qm9va2luZ0RldGFpbCxcbiAgZ2V0QWxsQm9va2luZ3MsXG4gIHVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59OyIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5cbmltcG9ydCBjb25maWcgZnJvbSBcIi4uL2NvbmZpZy9pbmRleFwiO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi4vdXRpbHMvYXBwRXJyb3JcIjtcblxuLy8gUGF5bWVudCBpcyBhbiBvcHRpb25hbCBmZWF0dXJlOiB0aGUgQVBJIG11c3QgYm9vdCBhbmQgc2VydmUgZXZlcnl0aGluZyBlbHNlXG4vLyBldmVuIHdoZW4gdGhlIFNTTENvbW1lcnogc3RvcmUgaXNuJ3QgY29uZmlndXJlZCB5ZXQuIFRoZXNlIHRocm93IGEgY2xlYW4gNDAwXG4vLyBvbiB0aGUgcGF5bWVudC1vbmx5IHBhdGhzIHJhdGhlciB0aGFuIGNyYXNoIHRoZSB3aG9sZSBkZXBsb3ltZW50IGF0IGJvb3QuXG5jb25zdCByZXF1aXJlQ29uZmlnID0gKCkgPT4ge1xuICBpZiAoIWNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9pZCB8fCAhY29uZmlnLnNzbF9jb21tZXJ6X3N0b3JlX3Bhc3N3b3JkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJTU0xDb21tZXJ6IGlzIG5vdCBjb25maWd1cmVkLiBTZXQgU1NMX0NPTU1FUlpfU1RPUkVfSUQgYW5kIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELlwiLFxuICAgICk7XG4gIH1cbiAgaWYgKCFjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJTU0xDb21tZXJ6IGlzIG5vdCBjb25maWd1cmVkLiBTZXQgQkFDS0VORF9QVUJMSUNfVVJMIHRvIHRoZSBwdWJsaWNseSByZWFjaGFibGUgYmFja2VuZCBVUkwuXCIsXG4gICAgKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHN0b3JlSWQ6IGNvbmZpZy5zc2xfY29tbWVyel9zdG9yZV9pZCxcbiAgICBzdG9yZVBhc3N3b3JkOiBjb25maWcuc3NsX2NvbW1lcnpfc3RvcmVfcGFzc3dvcmQsXG4gIH07XG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpJbml0UmVzdWx0IHtcbiAgc3RhdHVzOiBzdHJpbmc7XG4gIGZhaWxlZHJlYXNvbj86IHN0cmluZztcbiAgc2Vzc2lvbmtleT86IHN0cmluZztcbiAgR2F0ZXdheVBhZ2VVUkw/OiBzdHJpbmc7XG4gIFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCB7XG4gIHN0YXR1czogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbiAgdmFsX2lkPzogc3RyaW5nO1xuICBhbW91bnQ/OiBzdHJpbmc7XG4gIGN1cnJlbmN5Pzogc3RyaW5nO1xuICBiYW5rX3RyYW5faWQ/OiBzdHJpbmc7XG4gIGNhcmRfdHlwZT86IHN0cmluZztcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQge1xuICBBUElDb25uZWN0Pzogc3RyaW5nO1xuICBzdGF0dXM/OiBzdHJpbmc7IC8vIHN1Y2Nlc3MgfCBmYWlsZWQgfCBwcm9jZXNzaW5nXG4gIGVycm9yUmVhc29uPzogc3RyaW5nO1xuICByZWZ1bmRfcmVmX2lkPzogc3RyaW5nO1xuICBiYW5rX3RyYW5faWQ/OiBzdHJpbmc7XG4gIHRyYW5zX2lkPzogc3RyaW5nO1xuICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbi8vIFNTTENvbW1lcnogdHJ1bmNhdGVzIHRyYW5faWQgdG8gMzAgY2hhcnMgXHUyMDE0IGRhdGUgKyB0aW1lICsgcmFuZG9tIHNhbHQgc3RheXMgc2FmZWx5IHVuZGVyLlxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlVHJhbklkKCk6IHN0cmluZyB7XG4gIHJldHVybiBgVFJOWF9JRC0ke0RhdGUubm93KCl9LSR7cmFuZG9tVVVJRCgpLnJlcGxhY2UoLy0vZywgXCJcIikuc2xpY2UoMCwgOCl9YDtcbn1cblxuLy8gSW5pdGlhdGVzIGEgZ2F0ZXdheSBzZXNzaW9uLiBTZXJ2ZXItdG8tc2VydmVyIFBPU1QsIGZvcm0tZW5jb2RlZC4gVGhlIGdhdGV3YXlcbi8vIHJlc3BvbmRzIHdpdGggdGhlIGhvc3RlZCBjaGVja291dCBVUkwgKEdhdGV3YXlQYWdlVVJMKSB0aGUgY3VzdG9tZXIgaXMgc2VudCB0by5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6SW5pdChvcHRpb25zOiB7XG4gIHRvdGFsX2Ftb3VudDogbnVtYmVyO1xuICB0cmFuX2lkOiBzdHJpbmc7XG4gIHN1Y2Nlc3NfdXJsOiBzdHJpbmc7XG4gIGZhaWxfdXJsOiBzdHJpbmc7XG4gIGNhbmNlbF91cmw6IHN0cmluZztcbiAgaXBuX3VybDogc3RyaW5nO1xuICBjdXNfbmFtZTogc3RyaW5nO1xuICBjdXNfZW1haWw6IHN0cmluZztcbiAgY3VzX3Bob25lOiBzdHJpbmc7XG59KTogUHJvbWlzZTxTc2xjb21tZXJ6SW5pdFJlc3VsdD4ge1xuICBjb25zdCB7IHN0b3JlSWQsIHN0b3JlUGFzc3dvcmQgfSA9IHJlcXVpcmVDb25maWcoKTtcbiAgY29uc3QgYm9keSA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICB0b3RhbF9hbW91bnQ6IG9wdGlvbnMudG90YWxfYW1vdW50LnRvRml4ZWQoMiksXG4gICAgY3VycmVuY3k6IFwiQkRUXCIsXG4gICAgdHJhbl9pZDogb3B0aW9ucy50cmFuX2lkLFxuICAgIHN1Y2Nlc3NfdXJsOiBvcHRpb25zLnN1Y2Nlc3NfdXJsLFxuICAgIGZhaWxfdXJsOiBvcHRpb25zLmZhaWxfdXJsLFxuICAgIGNhbmNlbF91cmw6IG9wdGlvbnMuY2FuY2VsX3VybCxcbiAgICBpcG5fdXJsOiBvcHRpb25zLmlwbl91cmwsXG4gICAgY3VzX25hbWU6IG9wdGlvbnMuY3VzX25hbWUsXG4gICAgY3VzX2VtYWlsOiBvcHRpb25zLmN1c19lbWFpbCxcbiAgICBjdXNfYWRkMTogXCJOL0FcIixcbiAgICBjdXNfYWRkMjogXCJOL0FcIixcbiAgICBjdXNfY2l0eTogXCJOL0FcIixcbiAgICBjdXNfc3RhdGU6IFwiTi9BXCIsXG4gICAgY3VzX3Bvc3Rjb2RlOiBcIjEwMDBcIixcbiAgICBjdXNfY291bnRyeTogXCJCYW5nbGFkZXNoXCIsXG4gICAgY3VzX3Bob25lOiBvcHRpb25zLmN1c19waG9uZSxcbiAgICBwcm9kdWN0X25hbWU6IFwiVHJpcFZlcnNlIFRvdXIgQm9va2luZ1wiLFxuICAgIHNoaXBwaW5nX21ldGhvZDogXCJOT1wiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChjb25maWcuc3NsY29tbWVyel9pbml0X3VybCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIH0sXG4gICAgYm9keTogYm9keS50b1N0cmluZygpLFxuICB9KTtcblxuICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIGBTU0xDb21tZXJ6IGluaXQgZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgdHJ5IHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyBTc2xjb21tZXJ6SW5pdFJlc3VsdDtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDUwMiwgXCJTU0xDb21tZXJ6IGluaXQgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuXG4gIC8vIFRoZSBnYXRld2F5IHJlcG9ydHMgc3RhdHVzIGluIFVQUEVSQ0FTRSAoXCJTVUNDRVNTXCIgLyBcIkZBSUxFRFwiKTsgYW55IG90aGVyXG4gIC8vIHN0YXR1cywgb3IgYSBzdWNjZXNzIHdpdGhvdXQgdGhlIGhvc3RlZCBjaGVja291dCBVUkwsIGlzIGEgZmFpbGVkIGluaXQuXG4gIGlmIChkYXRhLnN0YXR1cyAhPT0gXCJTVUNDRVNTXCIgfHwgIWRhdGEuR2F0ZXdheVBhZ2VVUkwpIHtcbiAgICBjb25zdCByZWFzb24gPSBkYXRhLmZhaWxlZHJlYXNvbiB8fCBkYXRhLnN0YXR1cyB8fCBcInVua25vd25cIjtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtzc2xjb21tZXJ6XSBpbml0IHJlamVjdGVkICh1cmw9JHtjb25maWcuc3NsY29tbWVyel9pbml0X3VybH0sIHNhbmRib3g9JHtjb25maWcuc3NsX2NvbW1lcnpfc2FuZGJveH0pOiAke3JlYXNvbn1gLFxuICAgICAgZGF0YSxcbiAgICApO1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDUwMixcbiAgICAgIGBTU0xDb21tZXJ6IGluaXQgcmVqZWN0ZWQ6ICR7cmVhc29ufS4gQ2hlY2sgU1NMX0NPTU1FUlpfU1RPUkVfSUQsIFNTTF9DT01NRVJaX1NUT1JFX1BBU1NXT1JELCBTU0xfQ09NTUVSWl9TQU5EQk9YIGFuZCBTU0xDT01NRVJaX0lOSVRfVVJMIChzZWUgc2VydmVyIGxvZ3MpLmAsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn1cblxuLy8gU2VydmVyLXNpZGUgdmVyaWZpY2F0aW9uIG9mIGEgY29tcGxldGVkIHRyYW5zYWN0aW9uLiBzdGF0dXM6IFZBTElEIC8gVkFMSURBVEVEIC9cbi8vIElOVkFMSURfVFJBTlNBQ1RJT04gLyBGQUlMRUQuIFZBTElEQVRFRCBtZWFucyB0aGUgdHJhbnNhY3Rpb24gd2FzIHZlcmlmaWVkIGJlZm9yZVxuLy8gKGlkZW1wb3RlbnQpLCBJTlZBTElEX1RSQU5TQUNUSU9OIG1lYW5zIHRoZSBhbW91bnQvdHJhbnNhY3Rpb24gbWlzbWF0Y2hlcy5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6VmFsaWRhdGUob3B0aW9uczoge1xuICB2YWxfaWQ6IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0PiB7XG4gIGNvbnN0IHsgc3RvcmVJZCwgc3RvcmVQYXNzd29yZCB9ID0gcmVxdWlyZUNvbmZpZygpO1xuICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICB2YWxfaWQ6IG9wdGlvbnMudmFsX2lkLFxuICAgIHN0b3JlX2lkOiBzdG9yZUlkLFxuICAgIHN0b3JlX3Bhc3N3ZDogc3RvcmVQYXNzd29yZCxcbiAgICBmb3JtYXQ6IFwianNvblwiLFxuICB9KTtcblxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHtjb25maWcuc3NsY29tbWVyel92YWxpZGF0ZV91cmx9PyR7cGFyYW1zLnRvU3RyaW5nKCl9YCwge1xuICAgIG1ldGhvZDogXCJHRVRcIixcbiAgfSk7XG5cbiAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBgU1NMQ29tbWVyeiB2YWxpZGF0aW9uIGZhaWxlZCAoJHtyZXMuc3RhdHVzfSlgKTtcblxuICBsZXQgZGF0YTogU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ7XG4gIHRyeSB7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UodGV4dCkgYXMgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQ7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIFwiU1NMQ29tbWVyeiB2YWxpZGF0aW9uIHJldHVybmVkIGEgbm9uLUpTT04gcmVzcG9uc2VcIik7XG4gIH1cbiAgcmV0dXJuIGRhdGE7XG59XG5cbi8vIEluaXRpYXRlcyBhIHJlZnVuZCBhZ2FpbnN0IGEgc2V0dGxlZCB0cmFuc2FjdGlvbi4gYmFua190cmFuX2lkIGlzIHRoZVxuLy8gb3JpZ2luYWwgdHJhbnNhY3Rpb24ncyBiYW5rIHRyYW5zYWN0aW9uIElEIGNhcHR1cmVkIGF0IHBheW1lbnQgdGltZS5cbi8vIHN0YXR1czogc3VjY2VzcyAoaW5pdGlhdGVkKSB8IGZhaWxlZCB8IHByb2Nlc3NpbmcgKGFscmVhZHkgaW5pdGlhdGVkKS5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzc2xjb21tZXJ6UmVmdW5kKG9wdGlvbnM6IHtcbiAgYmFua190cmFuX2lkOiBzdHJpbmc7XG4gIHJlZnVuZF9hbW91bnQ6IG51bWJlcjtcbiAgcmVmdW5kX3JlbWFya3M6IHN0cmluZztcbiAgcmVmZV9pZD86IHN0cmluZztcbn0pOiBQcm9taXNlPFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ+IHtcbiAgY29uc3QgeyBzdG9yZUlkLCBzdG9yZVBhc3N3b3JkIH0gPSByZXF1aXJlQ29uZmlnKCk7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIGJhbmtfdHJhbl9pZDogb3B0aW9ucy5iYW5rX3RyYW5faWQsXG4gICAgc3RvcmVfaWQ6IHN0b3JlSWQsXG4gICAgc3RvcmVfcGFzc3dkOiBzdG9yZVBhc3N3b3JkLFxuICAgIHJlZnVuZF9hbW91bnQ6IG9wdGlvbnMucmVmdW5kX2Ftb3VudC50b0ZpeGVkKDIpLFxuICAgIHJlZnVuZF9yZW1hcmtzOiBvcHRpb25zLnJlZnVuZF9yZW1hcmtzLFxuICAgIGZvcm1hdDogXCJqc29uXCIsXG4gICAgdjogXCIxXCIsXG4gIH0pO1xuICBpZiAob3B0aW9ucy5yZWZlX2lkKSBwYXJhbXMuc2V0KFwicmVmZV9pZFwiLCBvcHRpb25zLnJlZmVfaWQpO1xuXG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2NvbmZpZy5zc2xjb21tZXJ6X3JlZnVuZF91cmx9PyR7cGFyYW1zLnRvU3RyaW5nKCl9YCwge1xuICAgIG1ldGhvZDogXCJHRVRcIixcbiAgfSk7XG5cbiAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgQXBwRXJyb3IoNTAyLCBgU1NMQ29tbWVyeiByZWZ1bmQgZmFpbGVkICgke3Jlcy5zdGF0dXN9KWApO1xuXG4gIGxldCBkYXRhOiBTc2xjb21tZXJ6UmVmdW5kUmVzdWx0O1xuICB0cnkge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKHRleHQpIGFzIFNzbGNvbW1lcnpSZWZ1bmRSZXN1bHQ7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig1MDIsIFwiU1NMQ29tbWVyeiByZWZ1bmQgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZVwiKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn0iLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzLCBQYWNrYWdlU3RhdHVzLCBQYXltZW50U3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc3NsY29tbWVyelJlZnVuZCB9IGZyb20gXCIuLi8uLi9saWIvc3NsY29tbWVyelwiO1xuaW1wb3J0IHsgc2VuZEJvb2tpbmdFbWFpbCwgc2VuZFJlZnVuZEVtYWlsIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2VtYWlsXCI7XG5pbXBvcnQge1xuICBJQm9va2luZ1F1ZXJ5LFxuICBJQm9va2luZ1NlYXJjaFF1ZXJ5LFxuICBJQ3JlYXRlQm9va2luZyxcbiAgSVVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59IGZyb20gXCIuL2Jvb2tpbmcuaW50ZXJmYWNlXCI7XG5cbi8vIEEgUEVORElORyBib29raW5nIG9sZGVyIHRoYW4gdGhpcyBpcyB0cmVhdGVkIGFzIGFuIGFiYW5kb25lZCBjaGVja291dDpcbi8vIGl0J3MgYXV0by1jYW5jZWxsZWQgc28gdGhlIHVzZXIgY2FuIHJlYm9vayB0aGUgc2FtZSBwYWNrYWdlK2RhdGUuXG5jb25zdCBTVEFMRV9CT09LSU5HX0hPVVJTID0gMjQ7XG5cbmNvbnN0IHRvVVRDTWlkbmlnaHQgPSAoZGF0ZTogRGF0ZSkgPT5cbiAgbmV3IERhdGUoXG4gICAgRGF0ZS5VVEMoZGF0ZS5nZXRVVENGdWxsWWVhcigpLCBkYXRlLmdldFVUQ01vbnRoKCksIGRhdGUuZ2V0VVRDRGF0ZSgpKSxcbiAgKTtcblxuLy8gXHUyNTAwXHUyNTAwIEFjdG9yICsgb3duZXJzaGlwIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxudHlwZSBCb29raW5nQWN0b3IgPSB7IGlkOiBzdHJpbmc7IHJvbGU6IFJvbGUgfTtcblxuLy8gU3RydWN0dXJhbCBzdWJzZXQgXHUyMDE0IG9ubHkgd2hhdCB0aGUgb3duZXJzaGlwIGNoZWNrcyBuZWVkLlxudHlwZSBCb29raW5nT3duZXJJbmZvID0ge1xuICB1c2VySWQ6IHN0cmluZztcbiAgcGFja2FnZTogeyBhZ2VudElkOiBzdHJpbmcgfTtcbn07XG5cbi8vIEJvb2tpbmcgb3duZXIsIHRoZSBBR0VOVCB3aG8gb3ducyB0aGUgcGFja2FnZSwgb3IgQURNSU4gXHUyMDE0IGZ1bGwgbWFuYWdlIHNjb3BlLlxuY29uc3QgY2FuTWFuYWdlID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGJvb2tpbmcudXNlcklkID09PSBhY3Rvci5pZCB8fFxuICAoYWN0b3Iucm9sZSA9PT0gUm9sZS5BR0VOVCAmJiBib29raW5nLnBhY2thZ2UuYWdlbnRJZCA9PT0gYWN0b3IuaWQpIHx8XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU47XG5cbi8vIE9ubHkgdGhlIHBhY2thZ2Utb3duaW5nIEFHRU5UIG9yIEFETUlOIGNhbiBtb3ZlIGEgYm9va2luZydzIG1vbmV5IHN0YXR1c1xuLy8gKFBFTkRJTkdcdTIxOTJDT05GSVJNRUQsIENPTkZJUk1FRFx1MjE5MkNPTVBMRVRFRCwgQ09ORklSTUVEXHUyMTkyUEVORElORykuXG5jb25zdCBpc0FnZW50T3duZXJPckFkbWluID0gKGJvb2tpbmc6IEJvb2tpbmdPd25lckluZm8sIGFjdG9yOiBCb29raW5nQWN0b3IpID0+XG4gIGFjdG9yLnJvbGUgPT09IFJvbGUuQURNSU4gfHxcbiAgKGFjdG9yLnJvbGUgPT09IFJvbGUuQUdFTlQgJiYgYm9va2luZy5wYWNrYWdlLmFnZW50SWQgPT09IGFjdG9yLmlkKTtcblxuLy8gXHUyNTAwXHUyNTAwIFN0YXRlIG1hY2hpbmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG50eXBlIFRyYW5zaXRpb25SdWxlID0ge1xuICBhbGxvd2VkOiAoYm9va2luZzogQm9va2luZ093bmVySW5mbywgYWN0b3I6IEJvb2tpbmdBY3RvcikgPT4gYm9vbGVhbjtcbiAgcmVxdWlyZXNUcmF2ZWxEYXRlUGFzc2VkPzogYm9vbGVhbjtcbiAgYmVmb3JlVHJhdmVsRGF0ZT86IGJvb2xlYW47XG59O1xuXG5jb25zdCBUUkFOU0lUSU9OUzogUGFydGlhbDxcbiAgUmVjb3JkPEJvb2tpbmdTdGF0dXMsIFBhcnRpYWw8UmVjb3JkPEJvb2tpbmdTdGF0dXMsIFRyYW5zaXRpb25SdWxlPj4+XG4+ID0ge1xuICBbQm9va2luZ1N0YXR1cy5QRU5ESU5HXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTkZJUk1FRF06IHsgYWxsb3dlZDogaXNBZ2VudE93bmVyT3JBZG1pbiB9LFxuICAgIFtCb29raW5nU3RhdHVzLkNBTkNFTExFRF06IHsgYWxsb3dlZDogY2FuTWFuYWdlIH0sXG4gIH0sXG4gIFtCb29raW5nU3RhdHVzLlBBSURdOiB7XG4gICAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXTogeyBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluIH0sXG4gICAgW0Jvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEXTogeyBhbGxvd2VkOiBjYW5NYW5hZ2UgfSxcbiAgfSxcbiAgW0Jvb2tpbmdTdGF0dXMuQ09ORklSTUVEXToge1xuICAgIFtCb29raW5nU3RhdHVzLkNPTVBMRVRFRF06IHtcbiAgICAgIGFsbG93ZWQ6IGlzQWdlbnRPd25lck9yQWRtaW4sXG4gICAgICByZXF1aXJlc1RyYXZlbERhdGVQYXNzZWQ6IHRydWUsXG4gICAgfSxcbiAgICBbQm9va2luZ1N0YXR1cy5DQU5DRUxMRURdOiB7IGFsbG93ZWQ6IGNhbk1hbmFnZSB9LFxuICAgIFtCb29raW5nU3RhdHVzLlBFTkRJTkddOiB7XG4gICAgICBhbGxvd2VkOiBpc0FnZW50T3duZXJPckFkbWluLFxuICAgICAgYmVmb3JlVHJhdmVsRGF0ZTogdHJ1ZSxcbiAgICB9LFxuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlc3BvbnNlIG1hcHBpbmcgKERlY2ltYWwgXHUyMTkyIE51bWJlcikgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBib29raW5nUGFja2FnZVNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdGl0bGU6IHRydWUsXG4gICAgc2x1ZzogdHJ1ZSxcbiAgICBsb2NhdGlvbjogdHJ1ZSxcbiAgICBpbWFnZXM6IHRydWUsXG4gICAgcHJpY2U6IHRydWUsXG4gIH0sXG59IGFzIGNvbnN0O1xuXG4vLyBEZXRhaWwgdmlldyBhZGRzIGFnZW50SWQgKG5lZWRlZCBieSBvd25lcnNoaXAgY2hlY2tzIGluIHRoZSBzZXJ2aWNlKS5cbmNvbnN0IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHtcbiAgICBpZDogdHJ1ZSxcbiAgICB0aXRsZTogdHJ1ZSxcbiAgICBzbHVnOiB0cnVlLFxuICAgIGxvY2F0aW9uOiB0cnVlLFxuICAgIGltYWdlczogdHJ1ZSxcbiAgICBwcmljZTogdHJ1ZSxcbiAgICBhZ2VudElkOiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxuY29uc3QgYm9va2luZ1VzZXJTZWxlY3QgPSB7XG4gIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnQgbGVkZ2VyIHNob3duIG9uIHRoZSBib29raW5nIGRldGFpbCBwYWdlIChhbW91bnRzIHN0YXkgRGVjaW1hbCBpbiBEQikuXG5jb25zdCBib29raW5nUGF5bWVudFNlbGVjdCA9IHtcbiAgc2VsZWN0OiB7XG4gICAgaWQ6IHRydWUsXG4gICAgdHJhbklkOiB0cnVlLFxuICAgIGFtb3VudDogdHJ1ZSxcbiAgICBjdXJyZW5jeTogdHJ1ZSxcbiAgICBzdGF0dXM6IHRydWUsXG4gICAgY2FyZFR5cGU6IHRydWUsXG4gICAgYmFua1RyYW5JZDogdHJ1ZSxcbiAgICB2YWxJZDogdHJ1ZSxcbiAgICBwYWlkQXQ6IHRydWUsXG4gICAgcmVmdW5kUmVmSWQ6IHRydWUsXG4gICAgcmVmdW5kZWRBdDogdHJ1ZSxcbiAgfSxcbn0gYXMgY29uc3Q7XG5cbi8vIFBheW1lbnRzIG9yZGVyZWQgbmV3ZXN0LWZpcnN0IHNvIGNvbnN1bWVycyBjYW4gcmVseSBvbiBwYXltZW50c1swXSBiZWluZyB0aGVcbi8vIGxhdGVzdCBhdHRlbXB0ICh1c2VkIGZvciB0aGUgdXNlciBwYXltZW50LWhpc3RvcnkgXCJsYXRlc3Qgc3RhdHVzXCIgcm93KS5cbmNvbnN0IGJvb2tpbmdQYXltZW50c0luY2x1ZGUgPSB7XG4gIC4uLmJvb2tpbmdQYXltZW50U2VsZWN0LFxuICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgYXMgY29uc3QgfSxcbn0gYXMgY29uc3Q7XG5cbnR5cGUgQm9va2luZ1dpdFBhY2thZ2UgPSBQcmlzbWEuQm9va2luZ0dldFBheWxvYWQ8e1xuICBpbmNsdWRlOiB7IHBhY2thZ2U6IHR5cGVvZiBib29raW5nUGFja2FnZVNlbGVjdCB9O1xufT47XG5cbi8vIFBheW1lbnRzIHNob3cgb24gbGlzdCByb3dzIHRvbyAoRG9EOiBcImxpc3QvZGV0YWlsIG5vdyBpbmNsdWRlcyBwYXltZW50c1wiKSxcbi8vIG1hcHBlZCB0byBOdW1iZXIgYXQgdGhlIGJvdW5kYXJ5IGxpa2UgdGhlIHJlc3Qgb2YgdGhlIG1vbmV5IGZpZWxkcy5cbnR5cGUgQm9va2luZ1BheW1lbnRJdGVtID0ge1xuICBpZDogc3RyaW5nO1xuICB0cmFuSWQ6IHN0cmluZztcbiAgYW1vdW50OiB1bmtub3duO1xuICBjdXJyZW5jeTogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgY2FyZFR5cGU6IHN0cmluZyB8IG51bGw7XG4gIGJhbmtUcmFuSWQ6IHN0cmluZyB8IG51bGw7XG4gIHZhbElkOiBzdHJpbmcgfCBudWxsO1xuICBwYWlkQXQ6IERhdGUgfCBudWxsO1xufTtcblxuY29uc3QgbWFwQm9va2luZ0xpc3QgPSAoYm9va2luZzogQm9va2luZ1dpdFBhY2thZ2UgJiB7IHBheW1lbnRzPzogQm9va2luZ1BheW1lbnRJdGVtW10gfSkgPT4gKHtcbiAgLi4uYm9va2luZyxcbiAgdG90YWxQcmljZTogTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSksXG4gIHBhY2thZ2U6IHsgLi4uYm9va2luZy5wYWNrYWdlLCBwcmljZTogTnVtYmVyKGJvb2tpbmcucGFja2FnZS5wcmljZSkgfSxcbiAgcGF5bWVudHM6IGJvb2tpbmcucGF5bWVudHM/Lm1hcCgocCkgPT4gKHsgLi4ucCwgYW1vdW50OiBOdW1iZXIocC5hbW91bnQpIH0pKSxcbn0pO1xuXG4vLyBcdTI1MDBcdTI1MDAgQ3JlYXRlIGJvb2tpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBjcmVhdGVCb29raW5nID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBJQ3JlYXRlQm9va2luZykgPT4ge1xuICBjb25zdCB7IHBhY2thZ2VJZCwgdHJhdmVsZXJzIH0gPSBwYXlsb2FkO1xuICBjb25zdCB0cmF2ZWxEYXRlID0gdG9VVENNaWRuaWdodChwYXlsb2FkLnRyYXZlbERhdGUpO1xuXG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG4gIGlmIChcbiAgICAhdG91clBhY2thZ2UgfHxcbiAgICB0b3VyUGFja2FnZS5pc0RlbGV0ZWQgfHxcbiAgICB0b3VyUGFja2FnZS5zdGF0dXMgIT09IFBhY2thZ2VTdGF0dXMuQVBQUk9WRURcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJQYWNrYWdlIGlzIG5vdCBhdmFpbGFibGUgZm9yIGJvb2tpbmcuXCIpO1xuICB9XG5cbiAgLy8gdG90YWxQcmljZSBpcyBjb21wdXRlZCBzZXJ2ZXItc2lkZSBmcm9tIHRoZSBwYWNrYWdlJ3MgY3VycmVudCBwcmljZSBcdTIwMTRcbiAgLy8gYW55dGhpbmcgdGhlIGNsaWVudCBzZW5kcyBpcyBpZ25vcmVkLlxuICBjb25zdCB0b3RhbFByaWNlID0gTnVtYmVyKHRvdXJQYWNrYWdlLnByaWNlKSAqIHRyYXZlbGVycztcblxuICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJpc21hLiR0cmFuc2FjdGlvbihhc3luYyAodHgpID0+IHtcbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHR4LmJvb2tpbmcuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcGFja2FnZUlkLFxuICAgICAgICB0cmF2ZWxEYXRlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZykge1xuICAgICAgY29uc3QgaXNSZWNlbnQgPVxuICAgICAgICBleGlzdGluZy5jcmVhdGVkQXQuZ2V0VGltZSgpID49XG4gICAgICAgIERhdGUubm93KCkgLSBTVEFMRV9CT09LSU5HX0hPVVJTICogNjAgKiA2MCAqIDEwMDA7XG5cbiAgICAgIGlmIChpc1JlY2VudCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgNDA5LFxuICAgICAgICAgIFwiWW91IGFscmVhZHkgaGF2ZSBhIHBlbmRpbmcgYm9va2luZyBmb3IgdGhpcyBwYWNrYWdlIG9uIHRoaXMgZGF0ZS5cIixcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgLy8gYWJhbmRvbmVkIGNoZWNrb3V0IFx1MjAxNCBjYW5jZWwgaXQgaW4gdGhlIHNhbWUgdHJhbnNhY3Rpb24gYW5kIHJlYm9va1xuICAgICAgYXdhaXQgdHguYm9va2luZy51cGRhdGUoe1xuICAgICAgICB3aGVyZTogeyBpZDogZXhpc3RpbmcuaWQgfSxcbiAgICAgICAgZGF0YTogeyBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHguYm9va2luZy5jcmVhdGUoe1xuICAgICAgZGF0YTogeyB1c2VySWQsIHBhY2thZ2VJZCwgdHJhdmVsRGF0ZSwgdHJhdmVsZXJzLCB0b3RhbFByaWNlIH0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIGJlc3QtZWZmb3J0IGVtYWlsIFx1MjAxNCBuZXZlciBmYWlscyB0aGUgcmVxdWVzdFxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9LFxuICB9KTtcbiAgaWYgKHVzZXIpIHtcbiAgICB2b2lkIFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgICAgcGFja2FnZVRpdGxlOiB0b3VyUGFja2FnZS50aXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZSxcbiAgICAgICAgdHJhdmVsZXJzLFxuICAgICAgICB0b3RhbFByaWNlLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuUEVORElORyxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAuLi5jcmVhdGVkLFxuICAgIHRvdGFsUHJpY2U6IE51bWJlcihjcmVhdGVkLnRvdGFsUHJpY2UpLFxuICB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIExpc3QgaGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHBhZ2luYXRlQm9va2luZyA9IGFzeW5jIChcbiAgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCxcbiAgaW5jbHVkZTogUHJpc21hLkJvb2tpbmdJbmNsdWRlLFxuICBxdWVyeTogSUJvb2tpbmdRdWVyeSxcbikgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSB8fCAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0IHx8IDEwO1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBpbmNsdWRlLFxuICAgICAgc2tpcDogKHBhZ2UgLSAxKSAqIGxpbWl0LFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YToge1xuICAgICAgcGFnZSxcbiAgICAgIGxpbWl0LFxuICAgICAgdG90YWwsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCksXG4gICAgfSxcbiAgfTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBNeSBib29raW5ncyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldE15Qm9va2luZ3MgPSBhc3luYyAodXNlcklkOiBzdHJpbmcsIHF1ZXJ5OiBJQm9va2luZ1F1ZXJ5KSA9PiB7XG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPSB7IHVzZXJJZCB9O1xuICBpZiAocXVlcnkuc3RhdHVzKSB3aGVyZS5zdGF0dXMgPSBxdWVyeS5zdGF0dXM7XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHsgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFnZW50IGJvb2tpbmdzIChzY29wZWQgdG8gb3duIHBhY2thZ2VzKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldEFnZW50Qm9va2luZ3MgPSBhc3luYyAoXG4gIGFnZW50SWQ6IHN0cmluZyxcbiAgcXVlcnk6IElCb29raW5nU2VhcmNoUXVlcnksXG4pID0+IHtcbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5Cb29raW5nV2hlcmVJbnB1dCA9IHtcbiAgICBwYWNrYWdlOiB7IGFnZW50SWQgfSxcbiAgfTtcbiAgaWYgKHF1ZXJ5LnN0YXR1cykgd2hlcmUuc3RhdHVzID0gcXVlcnkuc3RhdHVzO1xuICBpZiAocXVlcnkuc2VhcmNoKSB7XG4gICAgd2hlcmUucGFja2FnZSA9IHtcbiAgICAgIGFnZW50SWQsXG4gICAgICB0aXRsZTogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFnaW5hdGVCb29raW5nKFxuICAgIHdoZXJlLFxuICAgIHsgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEFkbWluOiBhbGwgYm9va2luZ3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRBbGxCb29raW5ncyA9IGFzeW5jIChxdWVyeTogSUJvb2tpbmdTZWFyY2hRdWVyeSkgPT4ge1xuICBjb25zdCB3aGVyZTogUHJpc21hLkJvb2tpbmdXaGVyZUlucHV0ID0ge307XG4gIGlmIChxdWVyeS5zdGF0dXMpIHdoZXJlLnN0YXR1cyA9IHF1ZXJ5LnN0YXR1cztcbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIHdoZXJlLnBhY2thZ2UgPSB7IHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH07XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWdpbmF0ZUJvb2tpbmcoXG4gICAgd2hlcmUsXG4gICAge1xuICAgICAgcGFja2FnZTogYm9va2luZ1BhY2thZ2VTZWxlY3QsXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICAgIHBheW1lbnRzOiBib29raW5nUGF5bWVudHNJbmNsdWRlLFxuICAgIH0sXG4gICAgcXVlcnksXG4gICk7XG4gIHJldHVybiB7IC4uLnJlc3VsdCwgZGF0YTogcmVzdWx0LmRhdGEubWFwKG1hcEJvb2tpbmdMaXN0KSB9O1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIEJvb2tpbmcgZGV0YWlsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0Qm9va2luZ0RldGFpbCA9IGFzeW5jIChpZDogc3RyaW5nLCBhY3RvcjogQm9va2luZ0FjdG9yKSA9PiB7XG4gIGNvbnN0IGJvb2tpbmcgPSBhd2FpdCBwcmlzbWEuYm9va2luZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIHBhY2thZ2U6IGJvb2tpbmdQYWNrYWdlRGV0YWlsU2VsZWN0LFxuICAgICAgdXNlcjogYm9va2luZ1VzZXJTZWxlY3QsXG4gICAgICBwYXltZW50czogYm9va2luZ1BheW1lbnRzSW5jbHVkZSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuICBpZiAoIWNhbk1hbmFnZShib29raW5nLCBhY3RvcikpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBhcmUgbm90IGF1dGhvcml6ZWQgdG8gdmlldyB0aGlzIGJvb2tpbmcuXCIpO1xuICB9XG5cbiAgcmV0dXJuIG1hcEJvb2tpbmdMaXN0KGJvb2tpbmcpO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlZnVuZCAoYm9va2luZyBjYW5jZWxsZWQgd2l0aCBzZXR0bGVkIG1vbmV5KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFJ1bnMgQUZURVIgdGhlIHN0YXR1cy10cmFuc2l0aW9uIHRyYW5zYWN0aW9uIGNvbW1pdHMsIHNvIGEgZ2F0ZXdheSBmYWlsdXJlIGNhblxuLy8gbmV2ZXIgcm9sbCBiYWNrIHRoZSBjYW5jZWxsYXRpb24gaXRzZWxmLiBFYWNoIHNldHRsZWQgcGF5bWVudCBpcyByZWZ1bmRlZCB2aWFcbi8vIHRoZSBTU0xDb21tZXJ6IFJlZnVuZCBBUEkgYW5kIGl0cyBsZWRnZXIgcm93IHN0b3JlcyB0aGUgZ2F0ZXdheSByZWZlcmVuY2UuXG50eXBlIFJlZnVuZENvbnRleHQgPSB7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFja2FnZVRpdGxlOiBzdHJpbmc7XG4gIHRyYXZlbERhdGU6IERhdGU7XG59O1xuXG5jb25zdCBpc3N1ZVJlZnVuZHMgPSBhc3luYyAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICBjdHg6IFJlZnVuZENvbnRleHQsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXltZW50cyA9IGF3YWl0IHByaXNtYS5wYXltZW50LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7IGJvb2tpbmdJZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLlJFRlVOREVEIH0sXG4gICAgfSk7XG4gICAgaWYgKHBheW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgY29uc3QgcmVmdW5kUmVmczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBvdXRjb21lcyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChcbiAgICAgIHBheW1lbnRzLm1hcChhc3luYyAocGF5bWVudCkgPT4ge1xuICAgICAgICBpZiAoIXBheW1lbnQuYmFua1RyYW5JZCkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICBgW3JlZnVuZF0gcGF5bWVudCAke3BheW1lbnQuaWR9IGhhcyBubyBiYW5rX3RyYW5faWQ7IGdhdGV3YXkgcmVmdW5kIHNraXBwZWQuYCxcbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBnYXRld2F5ID0gYXdhaXQgc3NsY29tbWVyelJlZnVuZCh7XG4gICAgICAgICAgYmFua190cmFuX2lkOiBwYXltZW50LmJhbmtUcmFuSWQsXG4gICAgICAgICAgcmVmdW5kX2Ftb3VudDogTnVtYmVyKHBheW1lbnQuYW1vdW50KSxcbiAgICAgICAgICByZWZ1bmRfcmVtYXJrczogYEJvb2tpbmcgJHtib29raW5nSWR9IGNhbmNlbGxlZCAtIFRyaXBWZXJzZWAsXG4gICAgICAgICAgcmVmZV9pZDogYm9va2luZ0lkLFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGdhdGV3YXkuc3RhdHVzID09PSBcInN1Y2Nlc3NcIiAmJiBnYXRld2F5LnJlZnVuZF9yZWZfaWQpIHtcbiAgICAgICAgICBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgICAgICAgIGRhdGE6IHsgcmVmdW5kUmVmSWQ6IGdhdGV3YXkucmVmdW5kX3JlZl9pZCwgcmVmdW5kZWRBdDogbmV3IERhdGUoKSB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJlZnVuZFJlZnMucHVzaChnYXRld2F5LnJlZnVuZF9yZWZfaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICBgW3JlZnVuZF0gcGF5bWVudCAke3BheW1lbnQuaWR9IHJlamVjdGVkOiAke2dhdGV3YXkuZXJyb3JSZWFzb24gPz8gZ2F0ZXdheS5zdGF0dXMgPz8gXCJ1bmtub3duXCJ9YCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICAgIC8vIGluZGl2aWR1YWwgZmFpbHVyZXMgYXJlIGxvZ2dlZCBhYm92ZSBhbmQgc3dhbGxvd2VkIFx1MjAxNCBtb25leSBzdGF0dXMgYWxyZWFkeVxuICAgIC8vIGZsaXBwZWQgdG8gUkVGVU5ERUQsIHNvIHRoZSBjdXN0b21lciBzZWVzIGEgcmVmdW5kIHJlZ2FyZGxlc3MuXG4gICAgdm9pZCBvdXRjb21lcztcblxuICAgIGlmIChyZWZ1bmRSZWZzLmxlbmd0aCA+IDApIHtcbiAgICAgIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgICAgc2VuZFJlZnVuZEVtYWlsKHtcbiAgICAgICAgICBlbWFpbDogY3R4LmVtYWlsLFxuICAgICAgICAgIG5hbWU6IGN0eC5uYW1lLFxuICAgICAgICAgIHBhY2thZ2VUaXRsZTogY3R4LnBhY2thZ2VUaXRsZSxcbiAgICAgICAgICB0cmF2ZWxEYXRlOiBjdHgudHJhdmVsRGF0ZSxcbiAgICAgICAgICBhbW91bnQ6IHBheW1lbnRzLnJlZHVjZSgoc3VtLCBwKSA9PiBzdW0gKyBOdW1iZXIocC5hbW91bnQpLCAwKSxcbiAgICAgICAgICByZWZ1bmRSZWZJZDogcmVmdW5kUmVmc1swXSxcbiAgICAgICAgfSksXG4gICAgICBdKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGBbcmVmdW5kXSB1bmV4cGVjdGVkIGVycm9yOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gLFxuICAgICk7XG4gIH1cbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBTdGF0dXMgdHJhbnNpdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IHVwZGF0ZUJvb2tpbmdTdGF0dXMgPSBhc3luYyAoXG4gIGlkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVCb29raW5nU3RhdHVzLFxuICBhY3RvcjogQm9va2luZ0FjdG9yLFxuKSA9PiB7XG4gIGNvbnN0IHsgc3RhdHVzOiB0byB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBib29raW5nID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBwYWNrYWdlOiB7XG4gICAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgYWdlbnRJZDogdHJ1ZSwgdGl0bGU6IHRydWUgfSxcbiAgICAgIH0sXG4gICAgICB1c2VyOiBib29raW5nVXNlclNlbGVjdCxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGlmICghY2FuTWFuYWdlKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwZXJmb3JtIHRoaXMgYWN0aW9uLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHJ1bGUgPSBUUkFOU0lUSU9OU1tib29raW5nLnN0YXR1c10/Llt0b107XG4gIGlmICghcnVsZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIDQwMCxcbiAgICAgIGBDYW5ub3QgdHJhbnNpdGlvbiBib29raW5nIGZyb20gJHtib29raW5nLnN0YXR1c30gdG8gJHt0b30uYCxcbiAgICApO1xuICB9XG4gIGlmICghcnVsZS5hbGxvd2VkKGJvb2tpbmcsIGFjdG9yKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwZXJmb3JtIHRoaXMgYWN0aW9uLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHRyYXZlbERheSA9IHRvVVRDTWlkbmlnaHQoYm9va2luZy50cmF2ZWxEYXRlKS5nZXRUaW1lKCk7XG4gIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gIGlmIChydWxlLnJlcXVpcmVzVHJhdmVsRGF0ZVBhc3NlZCAmJiB0cmF2ZWxEYXkgPiBub3cpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDAsXG4gICAgICBcIkJvb2tpbmcgY2FuIG9ubHkgYmUgY29tcGxldGVkIGFmdGVyIHRoZSB0cmF2ZWwgZGF0ZSBoYXMgcGFzc2VkLlwiLFxuICAgICk7XG4gIH1cbiAgaWYgKHJ1bGUuYmVmb3JlVHJhdmVsRGF0ZSAmJiB0cmF2ZWxEYXkgPD0gbm93KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDAwLFxuICAgICAgXCJCb29raW5nIGNhbiBvbmx5IGJlIHJldmVydGVkIGJlZm9yZSB0aGUgdHJhdmVsIGRhdGUuXCIsXG4gICAgKTtcbiAgfVxuXG4gIC8vIGNvbXBhcmUtYW5kLXNldDogdGhlIHRyYW5zaXRpb24gYXBwbGllcyBvbmx5IGlmIHRoZSByZWNvcmRlZCBzdGF0dXMgc3RpbGxcbiAgLy8gbWF0Y2hlcyBcdTIwMTQgYSBjb25jdXJyZW50IGNoYW5nZSBtYWtlcyBjb3VudCAwIGFuZCB0aGUgcmVxdWVzdCBmYWlscyBzYWZlbHkuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEuJHRyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHR4LmJvb2tpbmcudXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyBpZCwgc3RhdHVzOiBib29raW5nLnN0YXR1cyB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IHRvIH0sXG4gICAgfSk7XG4gICAgaWYgKHJlc3VsdC5jb3VudCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICA0MDksXG4gICAgICAgIFwiQm9va2luZyBzdGF0dXMgY2hhbmdlZCBjb25jdXJyZW50bHkuIFBsZWFzZSB0cnkgYWdhaW4uXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIENhbmNlbGxpbmcgYSBwYWlkIGJvb2tpbmcgbWFya3MgaXRzIG1vbmV5IGFzIHJldHVybmVkIChSRUZVTkRFRCBmbGFnKS5cbiAgICAvLyBBYmFuZG9uZWQgc2Vzc2lvbnMgYXJlIGNhbmNlbGxlZC4gVGhlIGdhdGV3YXkgcmVmdW5kcyArIHJlZnVuZCBlbWFpbCBydW5cbiAgICAvLyBhZnRlciB0aGlzIHRyYW5zYWN0aW9uIGNvbW1pdHMgKGlzc3VlUmVmdW5kcyBpcyBiZXN0LWVmZm9ydCkuXG4gICAgaWYgKHRvID09PSBCb29raW5nU3RhdHVzLkNBTkNFTExFRCkge1xuICAgICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgICAgd2hlcmU6IHsgYm9va2luZ0lkOiBpZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MgfSxcbiAgICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuUkVGVU5ERUQgfSxcbiAgICAgIH0pO1xuICAgICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgICAgd2hlcmU6IHsgYm9va2luZ0lkOiBpZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5DQU5DRUxMRUQgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB0eC5ib29raW5nLmZpbmRVbmlxdWUoeyB3aGVyZTogeyBpZCB9IH0pO1xuICB9KTtcblxuICBpZiAoIXVwZGF0ZWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIC8vIGJlc3QtZWZmb3J0IGdhdGV3YXkgcmVmdW5kICsgcmVmdW5kIGVtYWlsIGZvciBzZXR0bGVkIG1vbmV5IChuZXZlciB0aHJvd3MpXG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DQU5DRUxMRUQpIHtcbiAgICBhd2FpdCBpc3N1ZVJlZnVuZHMoaWQsIHtcbiAgICAgIGVtYWlsOiBib29raW5nLnVzZXIuZW1haWwsXG4gICAgICBuYW1lOiBib29raW5nLnVzZXIubmFtZSxcbiAgICAgIHBhY2thZ2VUaXRsZTogYm9va2luZy5wYWNrYWdlLnRpdGxlLFxuICAgICAgdHJhdmVsRGF0ZTogYm9va2luZy50cmF2ZWxEYXRlLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gYmVzdC1lZmZvcnQgZW1haWwgZm9yIG1vbmV5LXN0YXR1cyBjaGFuZ2VzXG4gIGlmICh0byA9PT0gQm9va2luZ1N0YXR1cy5DT05GSVJNRUQgfHwgdG8gPT09IEJvb2tpbmdTdGF0dXMuQ0FOQ0VMTEVEKSB7XG4gICAgdm9pZCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgc2VuZEJvb2tpbmdFbWFpbCh7XG4gICAgICAgIGVtYWlsOiBib29raW5nLnVzZXIuZW1haWwsXG4gICAgICAgIG5hbWU6IGJvb2tpbmcudXNlci5uYW1lLFxuICAgICAgICBwYWNrYWdlVGl0bGU6IGJvb2tpbmcucGFja2FnZS50aXRsZSxcbiAgICAgICAgdHJhdmVsRGF0ZTogYm9va2luZy50cmF2ZWxEYXRlLFxuICAgICAgICB0cmF2ZWxlcnM6IGJvb2tpbmcudHJhdmVsZXJzLFxuICAgICAgICB0b3RhbFByaWNlOiBOdW1iZXIoYm9va2luZy50b3RhbFByaWNlKSxcbiAgICAgICAgc3RhdHVzOiB0byxcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9XG5cbiAgcmV0dXJuIHsgLi4udXBkYXRlZCwgdG90YWxQcmljZTogTnVtYmVyKHVwZGF0ZWQudG90YWxQcmljZSkgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBib29raW5nU2VydmljZSA9IHtcbiAgY3JlYXRlQm9va2luZyxcbiAgZ2V0TXlCb29raW5ncyxcbiAgZ2V0QWdlbnRCb29raW5ncyxcbiAgZ2V0QWxsQm9va2luZ3MsXG4gIGdldEJvb2tpbmdEZXRhaWwsXG4gIHVwZGF0ZUJvb2tpbmdTdGF0dXMsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuaW1wb3J0IHsgQm9va2luZ1N0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5cbmNvbnN0IGNyZWF0ZVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFja2FnZUlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG4gIHRyYXZlbERhdGU6IHouY29lcmNlLmRhdGUoe1xuICAgIHJlcXVpcmVkX2Vycm9yOiBcIlRyYXZlbCBkYXRlIGlzIHJlcXVpcmVkXCIsXG4gICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlRyYXZlbCBkYXRlIG11c3QgYmUgYSB2YWxpZCBkYXRlXCIsXG4gIH0pLnJlZmluZShcbiAgICAoZGF0ZSkgPT4ge1xuICAgICAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpO1xuICAgICAgY29uc3QgdHJhdmVsRGF5ID0gbmV3IERhdGUoXG4gICAgICAgIERhdGUuVVRDKFxuICAgICAgICAgIGRhdGUuZ2V0VVRDRnVsbFllYXIoKSxcbiAgICAgICAgICBkYXRlLmdldFVUQ01vbnRoKCksXG4gICAgICAgICAgZGF0ZS5nZXRVVENEYXRlKCksXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgY29uc3QgdG9kYXlVVEMgPSBuZXcgRGF0ZShcbiAgICAgICAgRGF0ZS5VVEMoXG4gICAgICAgICAgdG9kYXkuZ2V0VVRDRnVsbFllYXIoKSxcbiAgICAgICAgICB0b2RheS5nZXRVVENNb250aCgpLFxuICAgICAgICAgIHRvZGF5LmdldFVUQ0RhdGUoKSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICByZXR1cm4gdHJhdmVsRGF5LmdldFRpbWUoKSA+PSB0b2RheVVUQy5nZXRUaW1lKCk7XG4gICAgfSxcbiAgICB7IG1lc3NhZ2U6IFwiVHJhdmVsIGRhdGUgY2Fubm90IGJlIGluIHRoZSBwYXN0LlwiIH0sXG4gICksXG4gIHRyYXZlbGVyczogelxuICAgIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJUcmF2ZWxlcnMgaXMgcmVxdWlyZWRcIiB9KVxuICAgIC5pbnQoXCJUcmF2ZWxlcnMgbXVzdCBiZSBhIHdob2xlIG51bWJlclwiKVxuICAgIC5taW4oMSwgXCJUcmF2ZWxlcnMgbXVzdCBiZSBhdCBsZWFzdCAxXCIpXG4gICAgLm1heCgyMCwgXCJUcmF2ZWxlcnMgbXVzdCBiZSBhdCBtb3N0IDIwXCIpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkJvb2tpbmcgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgYm9va2luZ1F1ZXJ5U2NoZW1hID0gei5vYmplY3Qoe1xuICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICBzdGF0dXM6IHoubmF0aXZlRW51bShCb29raW5nU3RhdHVzKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IGJvb2tpbmdTZWFyY2hRdWVyeVNjaGVtYSA9IGJvb2tpbmdRdWVyeVNjaGVtYS5leHRlbmQoe1xuICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm9wdGlvbmFsKCksXG59KTtcblxuY29uc3QgdXBkYXRlU3RhdHVzU2NoZW1hID0gei5vYmplY3Qoe1xuICBzdGF0dXM6IHoubmF0aXZlRW51bShCb29raW5nU3RhdHVzLCB7XG4gICAgcmVxdWlyZWRfZXJyb3I6IFwiUGxlYXNlIHByb3ZpZGUgYSBzdGF0dXNcIixcbiAgfSksXG59KTtcblxuZXhwb3J0IHR5cGUgVENyZWF0ZUJvb2tpbmdTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBjcmVhdGVTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEJvb2tpbmdRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGJvb2tpbmdRdWVyeVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hID0gei5pbmZlcjx0eXBlb2YgYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hPjtcbmV4cG9ydCB0eXBlIFRVcGRhdGVTdGF0dXNTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiB1cGRhdGVTdGF0dXNTY2hlbWE+O1xuXG5leHBvcnQgY29uc3QgYm9va2luZ1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVTY2hlbWEsXG4gIGJvb2tpbmdQYXJhbXNTY2hlbWEsXG4gIGJvb2tpbmdRdWVyeVNjaGVtYSxcbiAgYm9va2luZ1NlYXJjaFF1ZXJ5U2NoZW1hLFxuICB1cGRhdGVTdGF0dXNTY2hlbWEsXG59OyIsICJpbXBvcnQgeyBSb3V0ZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHsgUm9sZSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS9hdXRoXCI7XG5pbXBvcnQgdmFsaWRhdGVSZXF1ZXN0IGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL3ZhbGlkYXRlUmVxdWVzdFwiO1xuaW1wb3J0IHsgcmV2aWV3Q29udHJvbGxlciB9IGZyb20gXCIuL3Jldmlldy5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyByZXZpZXdWYWxpZGF0aW9ucyB9IGZyb20gXCIuL3Jldmlldy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgKFVTRVIgb25seSlcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLlVTRVIpLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiByZXZpZXdWYWxpZGF0aW9ucy5jcmVhdGVSZXZpZXdTY2hlbWEgfSksXG4gIHJldmlld0NvbnRyb2xsZXIuY3JlYXRlUmV2aWV3LFxuKTtcblxuLy8gMi4gTGlzdCByZXZpZXdzIGZvciBhIHBhY2thZ2UgKHB1YmxpYylcbnJvdXRlci5nZXQoXG4gIFwiL3BhY2thZ2UvOnBhY2thZ2VJZFwiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcmV2aWV3VmFsaWRhdGlvbnMucmV2aWV3UGFyYW1zU2NoZW1hLFxuICAgIHF1ZXJ5OiByZXZpZXdWYWxpZGF0aW9ucy5yZXZpZXdRdWVyeVNjaGVtYSxcbiAgfSksXG4gIHJldmlld0NvbnRyb2xsZXIuZ2V0UGFja2FnZVJldmlld3MsXG4pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3Um91dGVzID0gcm91dGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyByZXZpZXdTZXJ2aWNlIH0gZnJvbSBcIi4vcmV2aWV3LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgYSByZXZpZXcgY29udHJvbGxlciAoVVNFUiBvbmx5KVxuY29uc3QgY3JlYXRlUmV2aWV3ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmV2aWV3U2VydmljZS5jcmVhdGVSZXZpZXcodXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJSZXZpZXcgc3VibWl0dGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIExpc3QgcGFja2FnZSByZXZpZXdzIGNvbnRyb2xsZXIgKHB1YmxpYylcbmNvbnN0IGdldFBhY2thZ2VSZXZpZXdzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUlkID0gU3RyaW5nKHJlcS5wYXJhbXMucGFja2FnZUlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXZpZXdTZXJ2aWNlLmxpc3RQYWNrYWdlUmV2aWV3cyhwYWNrYWdlSWQsIHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUmV2aWV3cyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCByZXZpZXdDb250cm9sbGVyID0ge1xuICBjcmVhdGVSZXZpZXcsXG4gIGdldFBhY2thZ2VSZXZpZXdzLFxufTtcbiIsICJpbXBvcnQgeyBQYWNrYWdlU3RhdHVzLCBCb29raW5nU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgSUNyZWF0ZVJldmlld1BheWxvYWQsIElSZXZpZXdRdWVyeSB9IGZyb20gXCIuL3Jldmlldy5pbnRlcmZhY2VcIjtcblxuLy8gMS4gQ3JlYXRlIGEgcmV2aWV3IChVU0VSIG9ubHkpIFx1MjAxNCBnYXRlZCwgdW5pcXVlIHBlciB1c2VyK3BhY2thZ2UsIGFuZFxuLy8gICAgcmVjYWxjdWxhdGVzIHRoZSBwYWNrYWdlIHJhdGluZyBpbiB0aGUgc2FtZSB0cmFuc2FjdGlvbi5cbmNvbnN0IGNyZWF0ZVJldmlldyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcGF5bG9hZDogSUNyZWF0ZVJldmlld1BheWxvYWQpID0+IHtcbiAgcmV0dXJuIHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgLy8gUGFja2FnZSBtdXN0IGV4aXN0LCBiZSBhcHByb3ZlZCwgYW5kIG5vdCBiZSBkZWxldGVkIFx1MjAxNCBhIHJldmlldyBvZiBhXG4gICAgLy8gcGVuZGluZy9yZWplY3RlZC9kZWxldGVkIHBhY2thZ2UgaXMgbm9uc2Vuc2UuXG4gICAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCB0eC50b3VyUGFja2FnZS5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgaWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBhZ2VudElkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXRvdXJQYWNrYWdlKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgICB9XG5cbiAgICAvLyBObyBzZWxmLXJldmlldyBcdTIwMTQgYW4gYWdlbnQgcmF0aW5nIHRoZWlyIG93biBwYWNrYWdlIGlzIGEgY29uZmxpY3Qgb2YgaW50ZXJlc3QuXG4gICAgaWYgKHRvdXJQYWNrYWdlLmFnZW50SWQgPT09IHVzZXJJZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgXCJZb3UgY2Fubm90IHJldmlldyB5b3VyIG93biBwYWNrYWdlLlwiKTtcbiAgICB9XG5cbiAgICAvLyBPbmx5IGN1c3RvbWVycyB3aXRoIGEgY29tcGxldGVkIGJvb2tpbmcgbWF5IHJldmlldy5cbiAgICBjb25zdCBjb21wbGV0ZWRCb29raW5nID0gYXdhaXQgdHguYm9va2luZy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkLFxuICAgICAgICBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVELFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFjb21wbGV0ZWRCb29raW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIDQwMyxcbiAgICAgICAgXCJZb3UgY2FuIG9ubHkgcmV2aWV3IGEgcGFja2FnZSBhZnRlciBjb21wbGV0aW5nIGEgYm9va2luZy5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gRnJpZW5kbHkgZHVwbGljYXRlIGNoZWNrIFx1MjAxNCBAQHVuaXF1ZShbdXNlcklkLCBwYWNrYWdlSWRdKSBiYWNrc3RvcHMgYW55XG4gICAgLy8gcmFjZSB2aWEgUDIwMDIgKG1hcHBlZCB0byA0MDkgYnkgdGhlIGdsb2JhbCBoYW5kbGVyKS5cbiAgICBjb25zdCBleGlzdGluZ1JldmlldyA9IGF3YWl0IHR4LnJldmlldy5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHsgdXNlcklkLCBwYWNrYWdlSWQ6IHBheWxvYWQucGFja2FnZUlkIH0sXG4gICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZ1Jldmlldykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwOSwgXCJZb3UgaGF2ZSBhbHJlYWR5IHJldmlld2VkIHRoaXMgcGFja2FnZS5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgY3JlYXRlZFJldmlldyA9IGF3YWl0IHR4LnJldmlldy5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICB1c2VySWQsXG4gICAgICAgIHBhY2thZ2VJZDogcGF5bG9hZC5wYWNrYWdlSWQsXG4gICAgICAgIHJhdGluZzogcGF5bG9hZC5yYXRpbmcsXG4gICAgICAgIGNvbW1lbnQ6IHBheWxvYWQuY29tbWVudCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBSZWNvbXB1dGUgdGhlIHBhY2thZ2UgcmF0aW5nIGZyb20gYWxsIG9mIGl0cyByZXZpZXdzLCByb3VuZGVkIHRvIG9uZVxuICAgIC8vIGRlY2ltYWwsIGluc2lkZSB0aGUgc2FtZSB0cmFuc2FjdGlvbiBzbyBhIHN0YWxlIGF2ZXJhZ2UgaXMgbmV2ZXIgd3JpdHRlbi5cbiAgICBjb25zdCB7IF9hdmcgfSA9IGF3YWl0IHR4LnJldmlldy5hZ2dyZWdhdGUoe1xuICAgICAgd2hlcmU6IHsgcGFja2FnZUlkOiBwYXlsb2FkLnBhY2thZ2VJZCB9LFxuICAgICAgX2F2ZzogeyByYXRpbmc6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJhdGluZyA9IE1hdGgucm91bmQoKF9hdmcucmF0aW5nID8/IDApICogMTApIC8gMTA7XG5cbiAgICBhd2FpdCB0eC50b3VyUGFja2FnZS51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheWxvYWQucGFja2FnZUlkIH0sXG4gICAgICBkYXRhOiB7IHJhdGluZyB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgcmV2aWV3OiBjcmVhdGVkUmV2aWV3LCByYXRpbmcgfTtcbiAgfSk7XG59O1xuXG4vLyAyLiBMaXN0IHJldmlld3MgZm9yIGEgcGFja2FnZSAocHVibGljKSBcdTIwMTQgcGFnaW5hdGVkOyB0aGUgcGFja2FnZSBtdXN0IGJlXG4vLyAgICBhcHByb3ZlZCBhbmQgbm90IGRlbGV0ZWQgc28gdW5wdWJsaXNoZWQgcGFja2FnZSByZXZpZXdzIG5ldmVyIGxlYWsuXG5jb25zdCBsaXN0UGFja2FnZVJldmlld3MgPSBhc3luYyAoXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuICBxdWVyeTogSVJldmlld1F1ZXJ5LFxuKSA9PiB7XG4gIGNvbnN0IHRvdXJQYWNrYWdlID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIGlkOiBwYWNrYWdlSWQsXG4gICAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgIH0sXG4gICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEucmV2aWV3LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7IHBhY2thZ2VJZCB9LFxuICAgICAgc2VsZWN0OiB7XG4gICAgICAgIGlkOiB0cnVlLFxuICAgICAgICByYXRpbmc6IHRydWUsXG4gICAgICAgIGNvbW1lbnQ6IHRydWUsXG4gICAgICAgIGNyZWF0ZWRBdDogdHJ1ZSxcbiAgICAgICAgdXBkYXRlZEF0OiB0cnVlLFxuICAgICAgICB1c2VyOiB7IHNlbGVjdDogeyBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5yZXZpZXcuY291bnQoeyB3aGVyZTogeyBwYWNrYWdlSWQgfSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHtcbiAgICAgIHBhZ2UsXG4gICAgICBsaW1pdCxcbiAgICAgIHRvdGFsLFxuICAgICAgdG90YWxQYWdlczogTWF0aC5jZWlsKHRvdGFsIC8gbGltaXQpLFxuICAgIH0sXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgcmV2aWV3U2VydmljZSA9IHtcbiAgY3JlYXRlUmV2aWV3LFxuICBsaXN0UGFja2FnZVJldmlld3MsXG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IGNyZWF0ZVJldmlld1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFja2FnZUlkOiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbiAgICByYXRpbmc6IHpcbiAgICAgIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJSYXRpbmcgaXMgcmVxdWlyZWRcIiB9KVxuICAgICAgLmludChcIlJhdGluZyBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyXCIpXG4gICAgICAubWluKDEsIFwiUmF0aW5nIG11c3QgYmUgYXQgbGVhc3QgMVwiKVxuICAgICAgLm1heCg1LCBcIlJhdGluZyBtdXN0IGJlIGF0IG1vc3QgNVwiKSxcbiAgICBjb21tZW50OiB6XG4gICAgICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiQ29tbWVudCBpcyByZXF1aXJlZFwiIH0pXG4gICAgICAudHJpbSgpXG4gICAgICAubWluKDEsIFwiQ29tbWVudCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAgICAgLm1heCgxMDAwLCBcIkNvbW1lbnQgbXVzdCBiZSBhdCBtb3N0IDEwMDAgY2hhcmFjdGVyc1wiKSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCByZXZpZXdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhY2thZ2VJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQYWNrYWdlIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAubWluKDEsIFwiUGFja2FnZSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKSxcbn0pO1xuXG5jb25zdCByZXZpZXdRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgcmV2aWV3VmFsaWRhdGlvbnMgPSB7XG4gIGNyZWF0ZVJldmlld1NjaGVtYSxcbiAgcmV2aWV3UGFyYW1zU2NoZW1hLFxuICByZXZpZXdRdWVyeVNjaGVtYSxcbn07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGNhdGVnb3J5Q29udHJvbGxlciB9IGZyb20gXCIuL2NhdGVnb3J5LmNvbnRyb2xsZXJcIjtcbmltcG9ydCB7IGNhdGVnb3J5VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9jYXRlZ29yeS52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyAxLiBMaXN0IGFsbCBjYXRlZ29yaWVzIChwdWJsaWMsIG5vIGF1dGgpXG5yb3V0ZXIuZ2V0KFwiL1wiLCBjYXRlZ29yeUNvbnRyb2xsZXIuZ2V0QWxsQ2F0ZWdvcmllcyk7XG5cbi8vIDIuIENyZWF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIucG9zdChcbiAgXCIvXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY3JlYXRlQ2F0ZWdvcnlTY2hlbWEgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci5jcmVhdGVDYXRlZ29yeSxcbik7XG5cbi8vIDMuIFVwZGF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5yb3V0ZXIucGF0Y2goXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogY2F0ZWdvcnlWYWxpZGF0aW9ucy5jYXRlZ29yeVBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBjYXRlZ29yeVZhbGlkYXRpb25zLnVwZGF0ZUNhdGVnb3J5U2NoZW1hLFxuICB9KSxcbiAgY2F0ZWdvcnlDb250cm9sbGVyLnVwZGF0ZUNhdGVnb3J5LFxuKTtcblxuLy8gNC4gRGVsZXRlIGNhdGVnb3J5IChhZG1pbilcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGNhdGVnb3J5VmFsaWRhdGlvbnMuY2F0ZWdvcnlQYXJhbXNTY2hlbWEgfSksXG4gIGNhdGVnb3J5Q29udHJvbGxlci5kZWxldGVDYXRlZ29yeSxcbik7XG5cbmV4cG9ydCBjb25zdCBjYXRlZ29yeVJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGNhdGVnb3J5U2VydmljZSB9IGZyb20gXCIuL2NhdGVnb3J5LnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyBDcmVhdGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCBjcmVhdGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGNhdGVnb3J5ID0gYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmNyZWF0ZUNhdGVnb3J5KHJlcS5ib2R5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLkNSRUFURUQsXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcnksXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBHZXQgYWxsIGNhdGVnb3JpZXMgY29udHJvbGxlciAocHVibGljKVxuY29uc3QgZ2V0QWxsQ2F0ZWdvcmllcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBhd2FpdCBjYXRlZ29yeVNlcnZpY2UuZ2V0QWxsQ2F0ZWdvcmllcygpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBjYXRlZ29yaWVzIGZldGNoZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcmllcyxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIFVwZGF0ZSBjYXRlZ29yeSBjb250cm9sbGVyIChhZG1pbilcbmNvbnN0IHVwZGF0ZUNhdGVnb3J5ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG5cbiAgICBjb25zdCBjYXRlZ29yeSA9IGF3YWl0IGNhdGVnb3J5U2VydmljZS51cGRhdGVDYXRlZ29yeShpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkNhdGVnb3J5IHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogY2F0ZWdvcnksXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyBEZWxldGUgY2F0ZWdvcnkgY29udHJvbGxlciAoYWRtaW4pXG5jb25zdCBkZWxldGVDYXRlZ29yeSA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuXG4gICAgYXdhaXQgY2F0ZWdvcnlTZXJ2aWNlLmRlbGV0ZUNhdGVnb3J5KGlkKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJDYXRlZ29yeSBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlDb250cm9sbGVyID0ge1xuICBjcmVhdGVDYXRlZ29yeSxcbiAgZ2V0QWxsQ2F0ZWdvcmllcyxcbiAgdXBkYXRlQ2F0ZWdvcnksXG4gIGRlbGV0ZUNhdGVnb3J5LFxufTsiLCAiLy8gQmFuZ2xhIChCZW5nYWxpKSBcdTIxOTIgTGF0aW4gY29uc29uYW50L3Zvd2VsIG1hcCwgYXBwbGllZCBiZWZvcmUga2ViYWItY2FzaW5nIHNvXG4vLyBCYW5nbGEtaGVhdnkgdGl0bGVzIHN0aWxsIHByb2R1Y2UgcmVhZGFibGUgc2x1Z3MgaW5zdGVhZCBvZiBiZWluZyBzdHJpcHBlZCB0b1xuLy8gYW4gZW1wdHkgc3RyaW5nLlxuY29uc3QgQkFOR0xBX1RPX0xBVElOOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBcdTA5ODU6IFwib1wiLFxuICBcdTA5ODY6IFwiYVwiLFxuICBcdTA5ODc6IFwiaVwiLFxuICBcdTA5ODg6IFwiaVwiLFxuICBcdTA5ODk6IFwidVwiLFxuICBcdTA5OEE6IFwidVwiLFxuICBcdTA5OEI6IFwicmlcIixcbiAgXHUwOThGOiBcImVcIixcbiAgXHUwOTkwOiBcIm9pXCIsXG4gIFx1MDk5MzogXCJvXCIsXG4gIFx1MDk5NDogXCJvdVwiLFxuICBcdTA5OTU6IFwia2FcIixcbiAgXHUwOTk2OiBcImtoYVwiLFxuICBcdTA5OTc6IFwiZ2FcIixcbiAgXHUwOTk4OiBcImdoYVwiLFxuICBcdTA5OTk6IFwibmdhXCIsXG4gIFx1MDk5QTogXCJjaGFcIixcbiAgXHUwOTlCOiBcImNoaGFcIixcbiAgXHUwOTlDOiBcImphXCIsXG4gIFx1MDk5RDogXCJqaGFcIixcbiAgXHUwOTlFOiBcIm55YVwiLFxuICBcdTA5OUY6IFwidGFcIixcbiAgXHUwOUEwOiBcInRoYVwiLFxuICBcdTA5QTE6IFwiZGFcIixcbiAgXHUwOUEyOiBcImRoYVwiLFxuICBcdTA5QTM6IFwibmFcIixcbiAgXHUwOUE0OiBcInRhXCIsXG4gIFx1MDlBNTogXCJ0aGFcIixcbiAgXHUwOUE2OiBcImRhXCIsXG4gIFx1MDlBNzogXCJkaGFcIixcbiAgXHUwOUE4OiBcIm5hXCIsXG4gIFx1MDlBQTogXCJwYVwiLFxuICBcdTA5QUI6IFwicGhhXCIsXG4gIFx1MDlBQzogXCJiYVwiLFxuICBcdTA5QUQ6IFwiYmhhXCIsXG4gIFx1MDlBRTogXCJtYVwiLFxuICBcdTA5QUY6IFwieWFcIixcbiAgXHUwOUIwOiBcInJhXCIsXG4gIFx1MDlCMjogXCJsYVwiLFxuICBcdTA5QjY6IFwic2hhXCIsXG4gIFx1MDlCNzogXCJzaGFcIixcbiAgXHUwOUI4OiBcInNhXCIsXG4gIFx1MDlCOTogXCJoYVwiLFxuICBcdTA5QTFcdTA5QkM6IFwicmFcIixcbiAgXHUwOUEyXHUwOUJDOiBcInJoYVwiLFxuICBcdTA5QUZcdTA5QkM6IFwieWFcIixcbiAgXCJcdTA5ODJcIjogXCJuZ1wiLFxuICBcIlx1MDk4M1wiOiBcImhcIixcbiAgXCJcdTA5ODFcIjogXCJcIixcbiAgXCJcdTA5Q0RcIjogXCJcIixcbiAgXCJcdTA5QzdcIjogXCJlXCIsXG4gIFwiXHUwOUM4XCI6IFwib2lcIixcbiAgXCJcdTA5Q0JcIjogXCJvXCIsXG4gIFwiXHUwOUNDXCI6IFwib3VcIixcbiAgXCJcdTA5QkVcIjogXCJhXCIsXG4gIFwiXHUwOUJGXCI6IFwiaVwiLFxuICBcIlx1MDlDMFwiOiBcImlcIixcbiAgXCJcdTA5QzFcIjogXCJ1XCIsXG4gIFwiXHUwOUMyXCI6IFwidVwiLFxuICBcIlx1MDlDM1wiOiBcInJpXCIsXG59O1xuXG5jb25zdCB0cmFuc2xpdGVyYXRlID0gKHRleHQ6IHN0cmluZyk6IHN0cmluZyA9PlxuICBbLi4udGV4dF0ubWFwKChjaGFyKSA9PiBCQU5HTEFfVE9fTEFUSU5bY2hhcl0gPz8gY2hhcikuam9pbihcIlwiKTtcblxuLy8gU2hhcmVkIGtlYmFiLWNhc2Ugc2x1Z2lmaWVyIHVzZWQgYnkgQ2F0ZWdvcnkgYW5kIFRvdXJQYWNrYWdlIHNsdWdzLiBOb24tTGF0aW5cbi8vIHNjcmlwdHMgKGUuZy4gQmFuZ2xhKSBhcmUgdHJhbnNsaXRlcmF0ZWQgZmlyc3Q7IGlmIHRoZSByZXN1bHQgaXMgc3RpbGwgZW1wdHlcbi8vIHRoZSBjYWxsZXIgbWF5IHN1cHBseSBhIGBmYWxsYmFja2AgKGUuZy4gXCJwYWNrYWdlLTxzaG9ydElkPlwiKS5cbmV4cG9ydCBjb25zdCBzbHVnaWZ5ID0gKHRleHQ6IHN0cmluZywgZmFsbGJhY2s/OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICBjb25zdCBzbHVnID0gdHJhbnNsaXRlcmF0ZSh0ZXh0KVxuICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgLnRyaW0oKVxuICAgIC5yZXBsYWNlKC9bXlxcd1xccy1dL2csIFwiXCIpXG4gICAgLnJlcGxhY2UoL1tcXHNfLV0rL2csIFwiLVwiKVxuICAgIC5yZXBsYWNlKC9eLSt8LSskL2csIFwiXCIpO1xuXG4gIHJldHVybiBzbHVnIHx8IGZhbGxiYWNrIHx8IFwiXCI7XG59OyIsICJpbXBvcnQgeyBQYWNrYWdlU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2x1Z2lmeSB9IGZyb20gXCIuLi8uLi91dGlscy9zbHVnaWZ5XCI7XG5pbXBvcnQgeyBJQ3JlYXRlQ2F0ZWdvcnksIElVcGRhdGVDYXRlZ29yeSB9IGZyb20gXCIuL2NhdGVnb3J5LmludGVyZmFjZVwiO1xuXG4vLyBGcmllbmRseSA0MDkgZm9yIEB1bmlxdWUgY29uZmxpY3RzIChuYW1lIG9yIHNsdWcpIGluc3RlYWQgb2YgYSByYXcgUDIwMDIuXG4vLyBleGNsdWRlSWQgbGV0cyB1cGRhdGVzIHNraXAgdGhlIHZlcnkgcm93IGJlaW5nIGVkaXRlZCBzbyBhIG5vLW9wIHJlbmFtZVxuLy8gZG9lc24ndCBmYWxzZS00MDkgYWdhaW5zdCBpdHNlbGYuXG5jb25zdCBhc3NlcnROYW1lQXZhaWxhYmxlID0gYXN5bmMgKFxuICBuYW1lOiBzdHJpbmcsXG4gIHNsdWc6IHN0cmluZyxcbiAgZXhjbHVkZUlkPzogc3RyaW5nLFxuKSA9PiB7XG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRGaXJzdCh7XG4gICAgd2hlcmU6IHtcbiAgICAgIE9SOiBbeyBuYW1lIH0sIHsgc2x1ZyB9XSxcbiAgICAgIC4uLihleGNsdWRlSWQgPyB7IE5PVDogeyBpZDogZXhjbHVkZUlkIH0gfSA6IHt9KSxcbiAgICB9LFxuICB9KTtcblxuICBpZiAoZXhpc3RpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIkEgY2F0ZWdvcnkgd2l0aCB0aGlzIG5hbWUgYWxyZWFkeSBleGlzdHNcIik7XG4gIH1cbn07XG5cbi8vIENyZWF0ZSBjYXRlZ29yeSAoYWRtaW4pXG5jb25zdCBjcmVhdGVDYXRlZ29yeSA9IGFzeW5jIChwYXlsb2FkOiBJQ3JlYXRlQ2F0ZWdvcnkpID0+IHtcbiAgY29uc3QgeyBuYW1lIH0gPSBwYXlsb2FkO1xuICBjb25zdCBzbHVnID0gc2x1Z2lmeShuYW1lKTtcblxuICBhd2FpdCBhc3NlcnROYW1lQXZhaWxhYmxlKG5hbWUsIHNsdWcpO1xuXG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkuY3JlYXRlKHtcbiAgICBkYXRhOiB7IG5hbWUsIHNsdWcgfSxcbiAgfSk7XG59O1xuXG4vLyBHZXQgYWxsIGNhdGVnb3JpZXMgKHB1YmxpYykgd2l0aCBjb3VudHMgb2YgYXBwcm92ZWQsIG5vbi1kZWxldGVkIHBhY2thZ2VzXG5jb25zdCBnZXRBbGxDYXRlZ29yaWVzID0gYXN5bmMgKCkgPT4ge1xuICByZXR1cm4gcHJpc21hLmNhdGVnb3J5LmZpbmRNYW55KHtcbiAgICBvcmRlckJ5OiB7IG5hbWU6IFwiYXNjXCIgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBfY291bnQ6IHtcbiAgICAgICAgc2VsZWN0OiB7XG4gICAgICAgICAgcGFja2FnZXM6IHtcbiAgICAgICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgICAgIHN0YXR1czogUGFja2FnZVN0YXR1cy5BUFBST1ZFRCxcbiAgICAgICAgICAgICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG59O1xuXG4vLyBVcGRhdGUgY2F0ZWdvcnkgbmFtZSAocmVnZW5lcmF0ZXMgc2x1ZykgKGFkbWluKVxuY29uc3QgdXBkYXRlQ2F0ZWdvcnkgPSBhc3luYyAoY2F0ZWdvcnlJZDogc3RyaW5nLCBwYXlsb2FkOiBJVXBkYXRlQ2F0ZWdvcnkpID0+IHtcbiAgY29uc3QgeyBuYW1lIH0gPSBwYXlsb2FkO1xuICBjb25zdCBzbHVnID0gc2x1Z2lmeShuYW1lKTtcblxuICBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZU9yVGhyb3coeyB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9IH0pO1xuICBhd2FpdCBhc3NlcnROYW1lQXZhaWxhYmxlKG5hbWUsIHNsdWcsIGNhdGVnb3J5SWQpO1xuXG4gIHJldHVybiBwcmlzbWEuY2F0ZWdvcnkudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogY2F0ZWdvcnlJZCB9LFxuICAgIGRhdGE6IHsgbmFtZSwgc2x1ZyB9LFxuICB9KTtcbn07XG5cbi8vIERlbGV0ZSBjYXRlZ29yeSAoYWRtaW4pIFx1MjAxNCA0MDkgd2hlbiBhbnkgcGFja2FnZSByZWZlcmVuY2VzIGl0XG5jb25zdCBkZWxldGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmZpbmRVbmlxdWVPclRocm93KHsgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSB9KTtcblxuICBjb25zdCBwYWNrYWdlQ291bnQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuY291bnQoe1xuICAgIHdoZXJlOiB7IGNhdGVnb3J5SWQgfSxcbiAgfSk7XG5cbiAgaWYgKHBhY2thZ2VDb3VudCA+IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICA0MDksXG4gICAgICBcIkNhbm5vdCBkZWxldGUgY2F0ZWdvcnkgd2l0aCBhc3NvY2lhdGVkIHBhY2thZ2VzLiBSZW5hbWUgaXQgaW5zdGVhZC5cIixcbiAgICApO1xuICB9XG5cbiAgYXdhaXQgcHJpc21hLmNhdGVnb3J5LmRlbGV0ZSh7IHdoZXJlOiB7IGlkOiBjYXRlZ29yeUlkIH0gfSk7XG59O1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlTZXJ2aWNlID0ge1xuICBjcmVhdGVDYXRlZ29yeSxcbiAgZ2V0QWxsQ2F0ZWdvcmllcyxcbiAgdXBkYXRlQ2F0ZWdvcnksXG4gIGRlbGV0ZUNhdGVnb3J5LFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgbmFtZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNhdGVnb3J5IG5hbWUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMiwgXCJDYXRlZ29yeSBuYW1lIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMTAwLCBcIkNhdGVnb3J5IG5hbWUgbXVzdCBiZSBhdCBtb3N0IDEwMCBjaGFyYWN0ZXJzXCIpO1xuXG5jb25zdCBjcmVhdGVDYXRlZ29yeVNjaGVtYSA9IHoub2JqZWN0KHsgbmFtZTogbmFtZVNjaGVtYSB9KS5zdHJpY3QoKTtcblxuY29uc3QgdXBkYXRlQ2F0ZWdvcnlTY2hlbWEgPSB6Lm9iamVjdCh7IG5hbWU6IG5hbWVTY2hlbWEgfSkuc3RyaWN0KCk7XG5cbmNvbnN0IGNhdGVnb3J5UGFyYW1zU2NoZW1hID0gei5vYmplY3Qoe1xuICBpZDogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgY2F0ZWdvcnlWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlQ2F0ZWdvcnlTY2hlbWEsXG4gIHVwZGF0ZUNhdGVnb3J5U2NoZW1hLFxuICBjYXRlZ29yeVBhcmFtc1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBwYWNrYWdlQ29udHJvbGxlciB9IGZyb20gXCIuL3BhY2thZ2UuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgcGFja2FnZVZhbGlkYXRpb25zIH0gZnJvbSBcIi4vcGFja2FnZS52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBOT1RFOiBgL2ludGVybmFsLypgIHJvdXRlcyBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgYEdFVCAvOnNsdWdgIGJlbG93IFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYSBsaXRlcmFsIHNlZ21lbnQgKGAvaW50ZXJuYWwvYWxsYCkgd291bGRcbi8vIG90aGVyd2lzZSBiZSBzd2FsbG93ZWQgYnkgdGhlIGA6c2x1Z2AgcGFyYW0gcm91dGUgYW5kIDQwNCBmb3JldmVyLlxuXG4vLyAxLiBNeSBwYWNrYWdlcyAoYWdlbnQpIFx1MjAxNCBzZWxmLXByZXZpZXcgb2YgUEVORElORy9SRUpFQ1RFRCBiZWZvcmUgYXBwcm92YWxcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL215LXBhY2thZ2VzXCIsXG4gIGF1dGgoUm9sZS5BR0VOVCksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMuaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldE15UGFja2FnZXMsXG4pO1xuXG4vLyAyLiBBbGwgcGFja2FnZXMgKGFkbWluIG1vZGVyYXRpb24gVUkpXG5yb3V0ZXIuZ2V0KFxuICBcIi9pbnRlcm5hbC9hbGxcIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IHBhY2thZ2VWYWxpZGF0aW9ucy5pbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIuZ2V0QWxsUGFja2FnZXMsXG4pO1xuXG4vLyAzLiBQdWJsaWMgcGFja2FnZSBkZXRhaWwgYnkgc2x1Z1xucm91dGVyLmdldChcbiAgXCIvOnNsdWdcIixcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcGFyYW1zOiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVNsdWdQYXJhbXNTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmdldFBhY2thZ2VCeVNsdWcsXG4pO1xuXG4vLyA0LiBDcmVhdGUgcGFja2FnZSAoYWdlbnQgY3JlYXRlcyBvd247IGFkbWluIGNhbiBjcmVhdGUgZm9yIGFueSBhZ2VudClcbnJvdXRlci5wb3N0KFxuICBcIi9cIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLmNyZWF0ZVBhY2thZ2VTY2hlbWEgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmNyZWF0ZVBhY2thZ2UsXG4pO1xuXG4vLyA1LiBBcHByb3ZlL3JlamVjdCBwYWNrYWdlIChhZG1pbikgXHUyMDE0IHJlZ2lzdGVyZWQgYmVmb3JlIFBBVENIIC86aWQgZm9yIGNsYXJpdHlcbnJvdXRlci5wYXRjaChcbiAgXCIvOmlkL3N0YXR1c1wiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHBhcmFtczogcGFja2FnZVZhbGlkYXRpb25zLnBhY2thZ2VQYXJhbXNTY2hlbWEsXG4gICAgYm9keTogcGFja2FnZVZhbGlkYXRpb25zLnVwZGF0ZVN0YXR1c1NjaGVtYSxcbiAgfSksXG4gIHBhY2thZ2VDb250cm9sbGVyLmNoYW5nZVBhY2thZ2VTdGF0dXMsXG4pO1xuXG4vLyA2LiBVcGRhdGUgcGFja2FnZSAoYWdlbnQgb3duIC8gYWRtaW4gYW55KVxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IHBhY2thZ2VWYWxpZGF0aW9ucy51cGRhdGVQYWNrYWdlU2NoZW1hLFxuICB9KSxcbiAgcGFja2FnZUNvbnRyb2xsZXIudXBkYXRlUGFja2FnZSxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBhY2thZ2UgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IHBhY2thZ2VWYWxpZGF0aW9ucy5wYWNrYWdlUGFyYW1zU2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5zb2Z0RGVsZXRlUGFja2FnZSxcbik7XG5cbi8vIDguIFB1YmxpYyBsaXN0aW5nIFx1MjAxNCBrZXB0IGxhc3Qgc28gbm9uZSBvZiB0aGUgYWJvdmUgcm91dGVzIGFyZSBzaGFkb3dlZFxucm91dGVyLmdldChcbiAgXCIvXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7IHF1ZXJ5OiBwYWNrYWdlVmFsaWRhdGlvbnMucGFja2FnZVF1ZXJ5U2NoZW1hIH0pLFxuICBwYWNrYWdlQ29udHJvbGxlci5nZXRQdWJsaWNQYWNrYWdlcyxcbik7XG5cbmV4cG9ydCBjb25zdCBwYWNrYWdlUm91dGVzID0gcm91dGVyOyIsICJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBodHRwU3RhdHVzIGZyb20gXCJodHRwLXN0YXR1c1wiO1xuaW1wb3J0IHsgcGFja2FnZVNlcnZpY2UgfSBmcm9tIFwiLi9wYWNrYWdlLnNlcnZpY2VcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuXG4vLyAxLiBDcmVhdGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVC9BRE1JTilcbmNvbnN0IGNyZWF0ZVBhY2thZ2UgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5jcmVhdGVQYWNrYWdlKHJlcS51c2VyISwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuQ1JFQVRFRCxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseS4gSXQgd2lsbCBiZSB2aXNpYmxlIGFmdGVyIGFkbWluIGFwcHJvdmFsLlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgY29udHJvbGxlciAoZmlsdGVycyArIHBhZ2luYXRpb24pXG5jb25zdCBnZXRQdWJsaWNQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldFB1YmxpY1BhY2thZ2VzKHJlcS5xdWVyeSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyAzLiBQdWJsaWMgcGFja2FnZSBkZXRhaWwgYnkgc2x1Z1xuY29uc3QgZ2V0UGFja2FnZUJ5U2x1ZyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHNsdWcgPSBTdHJpbmcocmVxLnBhcmFtcy5zbHVnKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRQYWNrYWdlQnlTbHVnKHNsdWcpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBhY2thZ2UgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDQuIEFsbCBwYWNrYWdlcyBjb250cm9sbGVyIChBRE1JTiBtb2RlcmF0aW9uKVxuY29uc3QgZ2V0QWxsUGFja2FnZXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5nZXRBbGxQYWNrYWdlcyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIkFsbCBwYWNrYWdlcyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICBtZXRhOiByZXN1bHQubWV0YSxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDUuIE15IHBhY2thZ2VzIGNvbnRyb2xsZXIgKEFHRU5UKVxuY29uc3QgZ2V0TXlQYWNrYWdlcyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyZXEudXNlcj8uaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhY2thZ2VTZXJ2aWNlLmdldE15UGFja2FnZXModXNlcklkLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIllvdXIgcGFja2FnZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA2LiBVcGRhdGUgcGFja2FnZSBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCB1cGRhdGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGFja2FnZVNlcnZpY2UudXBkYXRlUGFja2FnZShyZXEudXNlciEsIGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSB1cGRhdGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDcuIENoYW5nZSBwYWNrYWdlIHN0YXR1cyBjb250cm9sbGVyIChBRE1JTiBhcHByb3ZlL3JlamVjdClcbmNvbnN0IGNoYW5nZVBhY2thZ2VTdGF0dXMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhyZXEucGFyYW1zLmlkKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYWNrYWdlU2VydmljZS5jaGFuZ2VQYWNrYWdlU3RhdHVzKGlkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBzdGF0dXMgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA4LiBTb2Z0IGRlbGV0ZSBwYWNrYWdlIGNvbnRyb2xsZXIgKEFHRU5UIG93biAvIEFETUlOIGFueSlcbmNvbnN0IHNvZnREZWxldGVQYWNrYWdlID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgYXdhaXQgcGFja2FnZVNlcnZpY2Uuc29mdERlbGV0ZVBhY2thZ2UocmVxLnVzZXIhLCBpZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiUGFja2FnZSBkZWxldGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IG51bGwsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcGFja2FnZUNvbnRyb2xsZXIgPSB7XG4gIGNyZWF0ZVBhY2thZ2UsXG4gIGdldFB1YmxpY1BhY2thZ2VzLFxuICBnZXRQYWNrYWdlQnlTbHVnLFxuICBnZXRBbGxQYWNrYWdlcyxcbiAgZ2V0TXlQYWNrYWdlcyxcbiAgdXBkYXRlUGFja2FnZSxcbiAgY2hhbmdlUGFja2FnZVN0YXR1cyxcbiAgc29mdERlbGV0ZVBhY2thZ2UsXG59OyIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyBQYWNrYWdlU3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVQYWNrYWdlUGF5bG9hZCxcbiAgSUludGVybmFsUGFja2FnZVF1ZXJ5LFxuICBJUGFja2FnZVF1ZXJ5LFxuICBJUmVxdWVzdFVzZXIsXG4gIElVcGRhdGVQYWNrYWdlUGF5bG9hZCxcbiAgSVVwZGF0ZVN0YXR1c1BheWxvYWQsXG59IGZyb20gXCIuL3BhY2thZ2UuaW50ZXJmYWNlXCI7XG5cbi8vIE1vbmV5IGlzIGBEZWNpbWFsKDEwLDIpYCBpbiB0aGUgc2NoZW1hIChBR0VOVFMubWQpIFx1MjAxNCBtYXAgdG8gTnVtYmVyIG9uIHJldHVybi5cbmNvbnN0IHNlcmlhbGl6ZVByaWNlID0gPFQgZXh0ZW5kcyB7IHByaWNlOiBQcmlzbWEuRGVjaW1hbCB9Pihyb3c6IFQpOiBUID0+ICh7XG4gIC4uLnJvdyxcbiAgcHJpY2U6IE51bWJlcihyb3cucHJpY2UpLFxufSk7XG5cbi8vIFB1YmxpYyBwYXlsb2FkcyBjYXJyeSB0aGUgYWdlbnQncyBkaXNwbGF5IGluZm8gb25seSBcdTIwMTQgbmV2ZXIgZW1haWwuXG5jb25zdCBwdWJsaWNQYWNrYWdlSW5jbHVkZSA9IHtcbiAgY2F0ZWdvcnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBzbHVnOiB0cnVlIH0gfSxcbiAgYWdlbnQ6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBhdmF0YXJVcmw6IHRydWUgfSB9LFxufSBhcyBjb25zdDtcblxuY29uc3QgdmFsaWRhdGVDYXRlZ29yeSA9IGFzeW5jIChjYXRlZ29yeUlkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2F0ZWdvcnkgPSBhd2FpdCBwcmlzbWEuY2F0ZWdvcnkuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGNhdGVnb3J5SWQgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUgfSxcbiAgfSk7XG5cbiAgaWYgKCFjYXRlZ29yeSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiSW52YWxpZCBjYXRlZ29yeUlkXCIpO1xuICB9XG59O1xuXG4vLyBQYWNrYWdlcyBtdXN0IGJlIG93bmVkIGJ5IGEgbGl2ZSBBR0VOVCBcdTIwMTQgb3RoZXJ3aXNlIHRoZSBib29raW5nIHN0YXRlXG4vLyBtYWNoaW5lJ3MgXCJBR0VOVCAob3ducyBwYWNrYWdlKVwiIGJyYW5jaCBhbmQgYWdlbnQtYm9va2luZ3Mgc2NvcGluZyBicmVhay5cbmNvbnN0IHZhbGlkYXRlQWdlbnQgPSBhc3luYyAoYWdlbnRJZDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGFnZW50ID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGFnZW50SWQgfSxcbiAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIHJvbGU6IHRydWUsIGlzRGVsZXRlZDogdHJ1ZSB9LFxuICB9KTtcblxuICBpZiAoIWFnZW50IHx8IGFnZW50LnJvbGUgIT09IFJvbGUuQUdFTlQgfHwgYWdlbnQuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJJbnZhbGlkIGFnZW50SWRcIik7XG4gIH1cbn07XG5cbi8vIENvbGxpc2lvbi1zYWZlIHNsdWc6IGJhc2Ugc2x1ZyBmcm9tIHRoZSB0aXRsZSwgdGhlbiBgLTJgLCBgLTNgLCAuLi4gdXNpbmcgYVxuLy8gc2luZ2xlIHByZWZpeCBxdWVyeS4gUHVyZS1CYW5nbGEvZW1vamkgdGl0bGVzIGNhbid0IHNsdWdpZnkgXHUyMDE0IGZhbGwgYmFjayB0b1xuLy8gYHBhY2thZ2UtPHNob3J0SWQ+YCBzbyB0aGUgVVJMIGlzIGFsd2F5cyBtZWFuaW5nZnVsLlxuY29uc3QgZ2VuZXJhdGVVbmlxdWVTbHVnID0gYXN5bmMgKHRpdGxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICBjb25zdCBiYXNlID0gc2x1Z2lmeSh0aXRsZSkgfHwgYHBhY2thZ2UtJHtyYW5kb21VVUlEKCkuc2xpY2UoMCwgOCl9YDtcblxuICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kTWFueSh7XG4gICAgd2hlcmU6IHsgc2x1ZzogeyBzdGFydHNXaXRoOiBiYXNlIH0gfSxcbiAgICBzZWxlY3Q6IHsgc2x1ZzogdHJ1ZSB9LFxuICB9KTtcblxuICBjb25zdCB1c2VkID0gbmV3IFNldChleGlzdGluZy5tYXAoKHApID0+IHAuc2x1ZykpO1xuICBpZiAoIXVzZWQuaGFzKGJhc2UpKSB7XG4gICAgcmV0dXJuIGJhc2U7XG4gIH1cblxuICBsZXQgc3VmZml4ID0gMjtcbiAgd2hpbGUgKHVzZWQuaGFzKGAke2Jhc2V9LSR7c3VmZml4fWApKSB7XG4gICAgc3VmZml4ICs9IDE7XG4gIH1cbiAgcmV0dXJuIGAke2Jhc2V9LSR7c3VmZml4fWA7XG59O1xuXG4vLyAxLiBDcmVhdGUgYSBwYWNrYWdlIChBR0VOVC9BRE1JTikuIE5ldyBwYWNrYWdlcyBzdGFydCBQRU5ESU5HIGFuZCBuZXZlciBsZWFrXG4vLyAgICBpbnRvIHB1YmxpYyBxdWVyaWVzIHVudGlsIGFuIGFkbWluIGFwcHJvdmVzIHRoZW0uXG5jb25zdCBjcmVhdGVQYWNrYWdlID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcGF5bG9hZDogSUNyZWF0ZVBhY2thZ2VQYXlsb2FkKSA9PiB7XG4gIGF3YWl0IHZhbGlkYXRlQ2F0ZWdvcnkocGF5bG9hZC5jYXRlZ29yeUlkKTtcblxuICAvLyBBRE1JTiBtYXkgY3JlYXRlIG9uIGJlaGFsZiBvZiBhbiBhZ2VudCAob3B0aW9uYWwgYWdlbnRJZCk7IEFHRU5UIGFsd2F5c1xuICAvLyBvd25zIHdoYXQgdGhleSBjcmVhdGUgYW5kIG1heSBub3QgaW1wZXJzb25hdGUgYW5vdGhlciB1c2VyLlxuICBsZXQgYWdlbnRJZDogc3RyaW5nO1xuICBpZiAodXNlci5yb2xlID09PSBSb2xlLkFETUlOKSB7XG4gICAgaWYgKHBheWxvYWQuYWdlbnRJZCkge1xuICAgICAgYXdhaXQgdmFsaWRhdGVBZ2VudChwYXlsb2FkLmFnZW50SWQpO1xuICAgICAgYWdlbnRJZCA9IHBheWxvYWQuYWdlbnRJZDtcbiAgICB9IGVsc2Uge1xuICAgICAgYWdlbnRJZCA9IHVzZXIuaWQ7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChwYXlsb2FkLmFnZW50SWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiYWdlbnRJZCBjYW4gb25seSBiZSBzZXQgYnkgYW4gYWRtaW5cIik7XG4gICAgfVxuICAgIGFnZW50SWQgPSB1c2VyLmlkO1xuICB9XG5cbiAgY29uc3Qgc2x1ZyA9IGF3YWl0IGdlbmVyYXRlVW5pcXVlU2x1ZyhwYXlsb2FkLnRpdGxlKTtcblxuICBjb25zdCBjcmVhdGVkID0gYXdhaXQgcHJpc21hLnRvdXJQYWNrYWdlLmNyZWF0ZSh7XG4gICAgZGF0YToge1xuICAgICAgdGl0bGU6IHBheWxvYWQudGl0bGUsXG4gICAgICBkZXNjcmlwdGlvbjogcGF5bG9hZC5kZXNjcmlwdGlvbixcbiAgICAgIGxvY2F0aW9uOiBwYXlsb2FkLmxvY2F0aW9uLFxuICAgICAgcHJpY2U6IHBheWxvYWQucHJpY2UsXG4gICAgICBkdXJhdGlvbjogcGF5bG9hZC5kdXJhdGlvbixcbiAgICAgIGNhdGVnb3J5SWQ6IHBheWxvYWQuY2F0ZWdvcnlJZCxcbiAgICAgIGltYWdlczogcGF5bG9hZC5pbWFnZXMsXG4gICAgICBhZ2VudElkLFxuICAgICAgc2x1ZyxcbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4gc2VyaWFsaXplUHJpY2UoY3JlYXRlZCk7XG59O1xuXG4vLyAyLiBQdWJsaWMgZXhwbG9yZWQgbGlzdGluZyBcdTIwMTQgQVBQUk9WRUQgKyBub3QtZGVsZXRlZCBvbmx5LCBmaWx0ZXJzICsgc29ydGluZy5cbmNvbnN0IGdldFB1YmxpY1BhY2thZ2VzID0gYXN5bmMgKHF1ZXJ5OiBJUGFja2FnZVF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3QgZmlsdGVyczogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dFtdID0gW107XG5cbiAgaWYgKHF1ZXJ5LnNlYXJjaCkge1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICBPUjogW1xuICAgICAgICB7IHRpdGxlOiB7IGNvbnRhaW5zOiBxdWVyeS5zZWFyY2gsIG1vZGU6IFwiaW5zZW5zaXRpdmVcIiB9IH0sXG4gICAgICAgIHsgZGVzY3JpcHRpb246IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgeyBsb2NhdGlvbjogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubG9jYXRpb24pIHtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgbG9jYXRpb246IHsgY29udGFpbnM6IHF1ZXJ5LmxvY2F0aW9uLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSxcbiAgICB9KTtcbiAgfVxuICBpZiAocXVlcnkubWluUHJpY2UgIT09IHVuZGVmaW5lZCB8fCBxdWVyeS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZmlsdGVycy5wdXNoKHtcbiAgICAgIHByaWNlOiB7XG4gICAgICAgIC4uLihxdWVyeS5taW5QcmljZSAhPT0gdW5kZWZpbmVkID8geyBndGU6IHF1ZXJ5Lm1pblByaWNlIH0gOiB7fSksXG4gICAgICAgIC4uLihxdWVyeS5tYXhQcmljZSAhPT0gdW5kZWZpbmVkID8geyBsdGU6IHF1ZXJ5Lm1heFByaWNlIH0gOiB7fSksXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG4gIGlmIChxdWVyeS5taW5SYXRpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGZpbHRlcnMucHVzaCh7IHJhdGluZzogeyBndGU6IHF1ZXJ5Lm1pblJhdGluZyB9IH0pO1xuICB9XG4gIGlmIChxdWVyeS5tYXhEdXJhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZmlsdGVycy5wdXNoKHsgZHVyYXRpb246IHsgbHRlOiBxdWVyeS5tYXhEdXJhdGlvbiB9IH0pO1xuICB9XG4gIGlmIChxdWVyeS5jYXRlZ29yeSkge1xuICAgIGZpbHRlcnMucHVzaCh7IGNhdGVnb3J5OiB7IHNsdWc6IHF1ZXJ5LmNhdGVnb3J5IH0gfSk7XG4gIH1cblxuICBjb25zdCB3aGVyZTogUHJpc21hLlRvdXJQYWNrYWdlV2hlcmVJbnB1dCA9IHtcbiAgICBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICBBTkQ6IGZpbHRlcnMubGVuZ3RoID4gMCA/IGZpbHRlcnMgOiB1bmRlZmluZWQsXG4gIH07XG5cbiAgY29uc3Qgc29ydE9yZGVyID0gcXVlcnkuc29ydE9yZGVyID8/IChxdWVyeS5zb3J0QnkgPT09IFwibmV3ZXN0XCIgPyBcImRlc2NcIiA6IFwiYXNjXCIpO1xuXG4gIGNvbnN0IG9yZGVyQnlNYXA6IFJlY29yZDxzdHJpbmcsIFByaXNtYS5Ub3VyUGFja2FnZU9yZGVyQnlXaXRoUmVsYXRpb25JbnB1dD4gPSB7XG4gICAgbmV3ZXN0OiB7IGNyZWF0ZWRBdDogc29ydE9yZGVyIH0sXG4gICAgcHJpY2U6IHsgcHJpY2U6IHNvcnRPcmRlciB9LFxuICAgIHJhdGluZzogeyByYXRpbmc6IHNvcnRPcmRlciB9LFxuICAgIHRpdGxlOiB7IHRpdGxlOiBzb3J0T3JkZXIgfSxcbiAgfTtcblxuICBjb25zdCBvcmRlckJ5ID0gb3JkZXJCeU1hcFtxdWVyeS5zb3J0QnkgPz8gXCJuZXdlc3RcIl0gPz8gb3JkZXJCeU1hcC5uZXdlc3Q7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEudG91clBhY2thZ2UuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5LFxuICAgICAgaW5jbHVkZTogcHVibGljUGFja2FnZUluY2x1ZGUsXG4gICAgICBza2lwLFxuICAgICAgdGFrZTogbGltaXQsXG4gICAgfSksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmNvdW50KHsgd2hlcmUgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgZGF0YTogZGF0YS5tYXAoc2VyaWFsaXplUHJpY2UpLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFB1YmxpYyBkZXRhaWwgYnkgc2x1ZyBcdTIwMTQgQVBQUk9WRUQgKyBub3QtZGVsZXRlZCBvbmx5LlxuY29uc3QgZ2V0UGFja2FnZUJ5U2x1ZyA9IGFzeW5jIChzbHVnOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZEZpcnN0KHtcbiAgICB3aGVyZTogeyBzbHVnLCBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuQVBQUk9WRUQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBpbmNsdWRlOiBwdWJsaWNQYWNrYWdlSW5jbHVkZSxcbiAgfSk7XG5cbiAgaWYgKCF0b3VyUGFja2FnZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUGFja2FnZSBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKHRvdXJQYWNrYWdlKTtcbn07XG5cbi8vIDQuIEFsbCBwYWNrYWdlcyBmb3IgdGhlIGFkbWluIG1vZGVyYXRpb24gVUkgKGFueSBzdGF0dXMsIG9wdGlvbmFsIGZpbHRlcnMpLlxuY29uc3QgZ2V0QWxsUGFja2FnZXMgPSBhc3luYyAocXVlcnk6IElJbnRlcm5hbFBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgICAuLi4ocXVlcnkuYWdlbnRJZCA/IHsgYWdlbnRJZDogcXVlcnkuYWdlbnRJZCB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICAgICAgICBhZ2VudDogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGVtYWlsOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVQcmljZSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gNS4gQW4gYWdlbnQncyBvd24gcGFja2FnZXMgKGFueSBzdGF0dXMpIFx1MjAxNCBzZWxmLXByZXZpZXcgYmVmb3JlIGFwcHJvdmFsLlxuY29uc3QgZ2V0TXlQYWNrYWdlcyA9IGFzeW5jICh1c2VySWQ6IHN0cmluZywgcXVlcnk6IElJbnRlcm5hbFBhY2thZ2VRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuVG91clBhY2thZ2VXaGVyZUlucHV0ID0ge1xuICAgIGFnZW50SWQ6IHVzZXJJZCxcbiAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBjYXRlZ29yeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIHNsdWc6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEudG91clBhY2thZ2UuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhOiBkYXRhLm1hcChzZXJpYWxpemVQcmljZSksXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gRmV0Y2ggKyBvd25lcnNoaXAgZ2F0ZSBzaGFyZWQgYnkgUEFUQ0ggYW5kIERFTEVURS4gQURNSU4gYnlwYXNzZXMgb3duZXJzaGlwO1xuLy8gQUdFTlQgZWRpdHMgYXJlIGNvbmZpbmVkIHRvIHRoZWlyIG93biBwYWNrYWdlcy5cbmNvbnN0IGZpbmRPd25lZFBhY2thZ2UgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwYWNrYWdlSWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCB0b3VyUGFja2FnZSA9IGF3YWl0IHByaXNtYS50b3VyUGFja2FnZS5maW5kVW5pcXVlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gIH0pO1xuXG4gIGlmICghdG91clBhY2thZ2UpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIlBhY2thZ2Ugbm90IGZvdW5kLlwiKTtcbiAgfVxuXG4gIGlmICh1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gJiYgdG91clBhY2thZ2UuYWdlbnRJZCAhPT0gdXNlci5pZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGNhbiBvbmx5IGFjdCBvbiB5b3VyIG93biBwYWNrYWdlcy5cIik7XG4gIH1cblxuICByZXR1cm4gdG91clBhY2thZ2U7XG59O1xuXG4vLyA2LiBVcGRhdGUgYSBwYWNrYWdlLiBTbHVnIG5ldmVyIGNoYW5nZXMgKGtlZXBzIGxpbmtzL2Jvb2ttYXJrcyB2YWxpZCkuXG4vLyAgICBBR0VOVCBlZGl0cyByZXNldCBzdGF0dXMgdG8gUEVORElORzsgQURNSU4gZWRpdHMgcHJlc2VydmUgaXQuXG5jb25zdCB1cGRhdGVQYWNrYWdlID0gYXN5bmMgKFxuICB1c2VyOiBJUmVxdWVzdFVzZXIsXG4gIHBhY2thZ2VJZDogc3RyaW5nLFxuICBwYXlsb2FkOiBJVXBkYXRlUGFja2FnZVBheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBmaW5kT3duZWRQYWNrYWdlKHVzZXIsIHBhY2thZ2VJZCk7XG5cbiAgaWYgKHBheWxvYWQuY2F0ZWdvcnlJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgYXdhaXQgdmFsaWRhdGVDYXRlZ29yeShwYXlsb2FkLmNhdGVnb3J5SWQpO1xuICB9XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLlRvdXJQYWNrYWdlVXBkYXRlSW5wdXQgPSB7XG4gICAgLi4uKHBheWxvYWQudGl0bGUgIT09IHVuZGVmaW5lZCA/IHsgdGl0bGU6IHBheWxvYWQudGl0bGUgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5kZXNjcmlwdGlvbiAhPT0gdW5kZWZpbmVkID8geyBkZXNjcmlwdGlvbjogcGF5bG9hZC5kZXNjcmlwdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmxvY2F0aW9uICE9PSB1bmRlZmluZWQgPyB7IGxvY2F0aW9uOiBwYXlsb2FkLmxvY2F0aW9uIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQucHJpY2UgIT09IHVuZGVmaW5lZCA/IHsgcHJpY2U6IHBheWxvYWQucHJpY2UgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5kdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8geyBkdXJhdGlvbjogcGF5bG9hZC5kdXJhdGlvbiB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmltYWdlcyAhPT0gdW5kZWZpbmVkID8geyBpbWFnZXM6IHBheWxvYWQuaW1hZ2VzIH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuY2F0ZWdvcnlJZCAhPT0gdW5kZWZpbmVkXG4gICAgICA/IHsgY2F0ZWdvcnk6IHsgY29ubmVjdDogeyBpZDogcGF5bG9hZC5jYXRlZ29yeUlkIH0gfSB9XG4gICAgICA6IHt9KSxcbiAgICAuLi4odXNlci5yb2xlICE9PSBSb2xlLkFETUlOID8geyBzdGF0dXM6IFBhY2thZ2VTdGF0dXMuUEVORElORyB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YSxcbiAgICBpbmNsdWRlOiB7IGNhdGVnb3J5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgc2x1ZzogdHJ1ZSB9IH0gfSxcbiAgfSk7XG5cbiAgcmV0dXJuIHNlcmlhbGl6ZVByaWNlKHVwZGF0ZWQpO1xufTtcblxuLy8gNy4gQXBwcm92ZS9yZWplY3QgYSBwYWNrYWdlIChhZG1pbikuXG5jb25zdCBjaGFuZ2VQYWNrYWdlU3RhdHVzID0gYXN5bmMgKFxuICBwYWNrYWdlSWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVN0YXR1c1BheWxvYWQsXG4pID0+IHtcbiAgY29uc3QgdG91clBhY2thZ2UgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UuZmluZFVuaXF1ZU9yVGhyb3coe1xuICAgIHdoZXJlOiB7IGlkOiBwYWNrYWdlSWQgfSxcbiAgfSk7XG5cbiAgaWYgKHRvdXJQYWNrYWdlLmlzRGVsZXRlZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsIFwiQ2Fubm90IGNoYW5nZSB0aGUgc3RhdHVzIG9mIGEgZGVsZXRlZCBwYWNrYWdlLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEudG91clBhY2thZ2UudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcGFja2FnZUlkIH0sXG4gICAgZGF0YTogeyBzdGF0dXM6IHBheWxvYWQuc3RhdHVzIH0sXG4gIH0pO1xuXG4gIHJldHVybiBzZXJpYWxpemVQcmljZSh1cGRhdGVkKTtcbn07XG5cbi8vIDguIFNvZnQgZGVsZXRlIChhZG1pbiBhbnksIGFnZW50IG93bikuXG5jb25zdCBzb2Z0RGVsZXRlUGFja2FnZSA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBhY2thZ2VJZDogc3RyaW5nKSA9PiB7XG4gIGF3YWl0IGZpbmRPd25lZFBhY2thZ2UodXNlciwgcGFja2FnZUlkKTtcblxuICByZXR1cm4gcHJpc21hLnRvdXJQYWNrYWdlLnVwZGF0ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHBhY2thZ2VJZCB9LFxuICAgIGRhdGE6IHsgaXNEZWxldGVkOiB0cnVlIH0sXG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VTZXJ2aWNlID0ge1xuICBjcmVhdGVQYWNrYWdlLFxuICBnZXRQdWJsaWNQYWNrYWdlcyxcbiAgZ2V0UGFja2FnZUJ5U2x1ZyxcbiAgZ2V0QWxsUGFja2FnZXMsXG4gIGdldE15UGFja2FnZXMsXG4gIHVwZGF0ZVBhY2thZ2UsXG4gIGNoYW5nZVBhY2thZ2VTdGF0dXMsXG4gIHNvZnREZWxldGVQYWNrYWdlLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgdGl0bGVTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJUaXRsZSBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigzLCBcIlRpdGxlIG11c3QgYmUgYXQgbGVhc3QgMyBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMjAwLCBcIlRpdGxlIG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgZGVzY3JpcHRpb25TY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJEZXNjcmlwdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigxMCwgXCJEZXNjcmlwdGlvbiBtdXN0IGJlIGF0IGxlYXN0IDEwIGNoYXJhY3RlcnNcIilcbiAgLm1heCgxMDAwMCwgXCJEZXNjcmlwdGlvbiBtdXN0IGJlIGF0IG1vc3QgMTAwMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgbG9jYXRpb25TY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJMb2NhdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC50cmltKClcbiAgLm1pbigyLCBcIkxvY2F0aW9uIG11c3QgYmUgYXQgbGVhc3QgMiBjaGFyYWN0ZXJzXCIpXG4gIC5tYXgoMjAwLCBcIkxvY2F0aW9uIG11c3QgYmUgYXQgbW9zdCAyMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgcHJpY2VTY2hlbWEgPSB6XG4gIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJQcmljZSBpcyByZXF1aXJlZFwiIH0pXG4gIC5wb3NpdGl2ZShcIlByaWNlIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXJcIilcbiAgLnJlZmluZSgodmFsKSA9PiBNYXRoLnJvdW5kKHZhbCAqIDEwMCkgLyAxMDAgPT09IHZhbCwge1xuICAgIG1lc3NhZ2U6IFwiUHJpY2UgbXVzdCBoYXZlIGF0IG1vc3QgMiBkZWNpbWFsIHBsYWNlc1wiLFxuICB9KTtcblxuY29uc3QgZHVyYXRpb25TY2hlbWEgPSB6XG4gIC5udW1iZXIoeyByZXF1aXJlZF9lcnJvcjogXCJEdXJhdGlvbiBpcyByZXF1aXJlZFwiIH0pXG4gIC5pbnQoXCJEdXJhdGlvbiBtdXN0IGJlIGEgd2hvbGUgbnVtYmVyIG9mIGRheXNcIilcbiAgLm1pbigxLCBcIkR1cmF0aW9uIG11c3QgYmUgYXQgbGVhc3QgMSBkYXlcIik7XG5cbmNvbnN0IGNhdGVnb3J5SWRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJDYXRlZ29yeSBpZCBpcyByZXF1aXJlZFwiIH0pXG4gIC5taW4oMSwgXCJDYXRlZ29yeSBpZCBtdXN0IG5vdCBiZSBlbXB0eVwiKTtcblxuY29uc3QgaW1hZ2VzU2NoZW1hID0gelxuICAuYXJyYXkoei5zdHJpbmcoKS51cmwoXCJFYWNoIGltYWdlIG11c3QgYmUgYSB2YWxpZCBVUkxcIikpXG4gIC5taW4oMSwgXCJBdCBsZWFzdCBvbmUgaW1hZ2UgaXMgcmVxdWlyZWRcIilcbiAgLm1heCg2LCBcIkF0IG1vc3QgNiBpbWFnZXMgYXJlIGFsbG93ZWRcIik7XG5cbmNvbnN0IGNyZWF0ZVBhY2thZ2VTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYSxcbiAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb25TY2hlbWEsXG4gICAgbG9jYXRpb246IGxvY2F0aW9uU2NoZW1hLFxuICAgIHByaWNlOiBwcmljZVNjaGVtYSxcbiAgICBkdXJhdGlvbjogZHVyYXRpb25TY2hlbWEsXG4gICAgY2F0ZWdvcnlJZDogY2F0ZWdvcnlJZFNjaGVtYSxcbiAgICBpbWFnZXM6IGltYWdlc1NjaGVtYSxcbiAgICBhZ2VudElkOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHVwZGF0ZVBhY2thZ2VTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGxvY2F0aW9uOiBsb2NhdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIHByaWNlOiBwcmljZVNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGR1cmF0aW9uOiBkdXJhdGlvblNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNhdGVnb3J5SWQ6IGNhdGVnb3J5SWRTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBpbWFnZXM6IGltYWdlc1NjaGVtYS5vcHRpb25hbCgpLFxuICB9KVxuICAuc3RyaWN0KClcbiAgLnJlZmluZSgoZGF0YSkgPT4gT2JqZWN0LmtleXMoZGF0YSkubGVuZ3RoID4gMCwge1xuICAgIG1lc3NhZ2U6IFwiQXQgbGVhc3Qgb25lIGZpZWxkIG11c3QgYmUgcHJvdmlkZWQgdG8gdXBkYXRlXCIsXG4gIH0pO1xuXG5jb25zdCBwYWNrYWdlUXVlcnlTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICAgIGxpbWl0OiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkubWF4KDUwKS5kZWZhdWx0KDEwKSxcbiAgICBzZWFyY2g6IHouc3RyaW5nKCkudHJpbSgpLm1pbigxKS5tYXgoMjAwKS5vcHRpb25hbCgpLFxuICAgIGNhdGVnb3J5OiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBsb2NhdGlvbjogei5zdHJpbmcoKS50cmltKCkubWluKDEpLm1heCgyMDApLm9wdGlvbmFsKCksXG4gICAgbWluUHJpY2U6IHouY29lcmNlLm51bWJlcigpLnBvc2l0aXZlKCkub3B0aW9uYWwoKSxcbiAgICBtYXhQcmljZTogei5jb2VyY2UubnVtYmVyKCkucG9zaXRpdmUoKS5vcHRpb25hbCgpLFxuICAgIG1pblJhdGluZzogei5jb2VyY2UubnVtYmVyKCkubWluKDApLm1heCg1KS5vcHRpb25hbCgpLFxuICAgIG1heER1cmF0aW9uOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkub3B0aW9uYWwoKSxcbiAgICBzb3J0Qnk6IHpcbiAgICAgIC5lbnVtKFtcIm5ld2VzdFwiLCBcInByaWNlXCIsIFwicmF0aW5nXCIsIFwidGl0bGVcIl0pXG4gICAgICAuZGVmYXVsdChcIm5ld2VzdFwiKSxcbiAgICBzb3J0T3JkZXI6IHouZW51bShbXCJhc2NcIiwgXCJkZXNjXCJdKS5vcHRpb25hbCgpLFxuICB9KVxuICAucmVmaW5lKChkYXRhKSA9PiB7XG4gICAgaWYgKGRhdGEubWluUHJpY2UgIT09IHVuZGVmaW5lZCAmJiBkYXRhLm1heFByaWNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBkYXRhLm1pblByaWNlIDw9IGRhdGEubWF4UHJpY2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9LCB7XG4gICAgbWVzc2FnZTogXCJtaW5QcmljZSBtdXN0IGJlIGxlc3MgdGhhbiBvciBlcXVhbCB0byBtYXhQcmljZVwiLFxuICAgIHBhdGg6IFtcIm1pblByaWNlXCJdLFxuICB9KTtcblxuY29uc3QgaW50ZXJuYWxQYWNrYWdlUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBhZ2U6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5kZWZhdWx0KDEpLFxuICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gIHN0YXR1czogelxuICAgIC5lbnVtKFtcIlBFTkRJTkdcIiwgXCJBUFBST1ZFRFwiLCBcIlJFSkVDVEVEXCJdKVxuICAgIC50cmFuc2Zvcm0oKHZhbCkgPT4gdmFsIGFzIFwiUEVORElOR1wiIHwgXCJBUFBST1ZFRFwiIHwgXCJSRUpFQ1RFRFwiKVxuICAgIC5vcHRpb25hbCgpLFxuICBhZ2VudElkOiB6LnN0cmluZygpLm1pbigxKS5vcHRpb25hbCgpLFxufSk7XG5cbmNvbnN0IHBhY2thZ2VQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGlkOiB6LnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIlBhY2thZ2UgaWQgaXMgcmVxdWlyZWRcIiB9KS5taW4oMSksXG59KTtcblxuY29uc3QgcGFja2FnZVNsdWdQYXJhbXNTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHNsdWc6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUGFja2FnZSBzbHVnIGlzIHJlcXVpcmVkXCIgfSkudHJpbSgpLm1pbigxKSxcbn0pO1xuXG5jb25zdCB1cGRhdGVTdGF0dXNTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHN0YXR1czogei5lbnVtKFtcIkFQUFJPVkVEXCIsIFwiUkVKRUNURURcIl0sIHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcIlN0YXR1cyBpcyByZXF1aXJlZFwiLFxuICAgICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlN0YXR1cyBtdXN0IGJlIEFQUFJPVkVEIG9yIFJFSkVDVEVEXCIsXG4gICAgfSksXG4gIH0pXG4gIC5zdHJpY3QoKTtcblxuZXhwb3J0IGNvbnN0IHBhY2thZ2VWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlUGFja2FnZVNjaGVtYSxcbiAgdXBkYXRlUGFja2FnZVNjaGVtYSxcbiAgcGFja2FnZVF1ZXJ5U2NoZW1hLFxuICBpbnRlcm5hbFBhY2thZ2VRdWVyeVNjaGVtYSxcbiAgcGFja2FnZVBhcmFtc1NjaGVtYSxcbiAgcGFja2FnZVNsdWdQYXJhbXNTY2hlbWEsXG4gIHVwZGF0ZVN0YXR1c1NjaGVtYSxcbn07IiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgeyBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi8uLi9taWRkbGV3YXJlL2F1dGhcIjtcbmltcG9ydCB2YWxpZGF0ZVJlcXVlc3QgZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvdmFsaWRhdGVSZXF1ZXN0XCI7XG5pbXBvcnQgeyBibG9nQ29udHJvbGxlciB9IGZyb20gXCIuL2Jsb2cuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgYmxvZ1ZhbGlkYXRpb25zIH0gZnJvbSBcIi4vYmxvZy52YWxpZGF0aW9uXCI7XG5cbmNvbnN0IHJvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBOT1RFOiBgL2ludGVybmFsLypgIHJvdXRlcyBNVVNUIHN0YXkgcmVnaXN0ZXJlZCBiZWZvcmUgYEdFVCAvOnNsdWdgIGJlbG93IFx1MjAxNFxuLy8gRXhwcmVzcyBtYXRjaGVzIHRvcC1kb3duLCBhbmQgYSBsaXRlcmFsIHNlZ21lbnQgKGAvaW50ZXJuYWwvYWxsYCkgd291bGRcbi8vIG90aGVyd2lzZSBiZSBzd2FsbG93ZWQgYnkgdGhlIGA6c2x1Z2AgcGFyYW0gcm91dGUgYW5kIDQwNCBmb3JldmVyLlxuXG4vLyAxLiBBbGwgcG9zdHMgKGFkbWluIG1vZGVyYXRpb24gVUkpIFx1MjAxNCByZWdpc3RlcmVkIGJlZm9yZSAvOnNsdWdcbnJvdXRlci5nZXQoXG4gIFwiL2ludGVybmFsL2FsbFwiLFxuICBhdXRoKFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLmludGVybmFsUXVlcnlTY2hlbWEgfSksXG4gIGJsb2dDb250cm9sbGVyLmdldEFsbFBvc3RzLFxuKTtcblxuLy8gMWIuIE93biBwb3N0cyAoXCJNeSBQb3N0c1wiIFVJIGZvciBhZ2VudHMvYWRtaW5zKSBcdTIwMTQgYmVmb3JlIC86c2x1Z1xucm91dGVyLmdldChcbiAgXCIvbXktcG9zdHNcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGJsb2dWYWxpZGF0aW9ucy5pbnRlcm5hbFF1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRNeVBvc3RzLFxuKTtcblxuLy8gMi4gUHVibGljIGxpc3RpbmcgXHUyMDE0IFBVQkxJU0hFRCArIG5vdC1kZWxldGVkIG9ubHlcbnJvdXRlci5nZXQoXG4gIFwiL1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBxdWVyeTogYmxvZ1ZhbGlkYXRpb25zLnB1YmxpY1F1ZXJ5U2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5nZXRQdWJsaWNQb3N0cyxcbik7XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnXG5yb3V0ZXIuZ2V0KFxuICBcIi86c2x1Z1wiLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0U2x1Z1BhcmFtc1NjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuZ2V0UG9zdEJ5U2x1Zyxcbik7XG5cbi8vIDQuIENyZWF0ZSBwb3N0IChhZ2VudC9hZG1pbiBhdXRob3JzIG93biBwb3N0czsgbmV3IHBvc3RzIHN0YXJ0IERSQUZUKVxucm91dGVyLnBvc3QoXG4gIFwiL1wiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBib2R5OiBibG9nVmFsaWRhdGlvbnMuY3JlYXRlUG9zdFNjaGVtYSB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuY3JlYXRlUG9zdCxcbik7XG5cbi8vIDUuIFB1Ymxpc2gvdW5wdWJsaXNoIHBvc3QgKGFkbWluKSBcdTIwMTQgcmVnaXN0ZXJlZCBiZWZvcmUgUEFUQ0ggLzppZCBmb3IgY2xhcml0eVxucm91dGVyLnBhdGNoKFxuICBcIi86aWQvc3RhdHVzXCIsXG4gIGF1dGgoUm9sZS5BRE1JTiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcGFyYW1zOiBibG9nVmFsaWRhdGlvbnMucG9zdFBhcmFtc1NjaGVtYSxcbiAgICBib2R5OiBibG9nVmFsaWRhdGlvbnMudXBkYXRlU3RhdHVzU2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIuY2hhbmdlUG9zdFN0YXR1cyxcbik7XG5cbi8vIDYuIFVwZGF0ZSBwb3N0IChhZ2VudCBvd24gLyBhZG1pbiBhbnkpIFx1MjAxNCBhZ2VudCBlZGl0cyByZXNldCB0byBEUkFGVFxucm91dGVyLnBhdGNoKFxuICBcIi86aWRcIixcbiAgYXV0aChSb2xlLkFHRU5ULCBSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHtcbiAgICBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hLFxuICAgIGJvZHk6IGJsb2dWYWxpZGF0aW9ucy51cGRhdGVQb3N0U2NoZW1hLFxuICB9KSxcbiAgYmxvZ0NvbnRyb2xsZXIudXBkYXRlUG9zdCxcbik7XG5cbi8vIDcuIFNvZnQgZGVsZXRlIHBvc3QgKGFnZW50IG93biAvIGFkbWluIGFueSlcbnJvdXRlci5kZWxldGUoXG4gIFwiLzppZFwiLFxuICBhdXRoKFJvbGUuQUdFTlQsIFJvbGUuQURNSU4pLFxuICB2YWxpZGF0ZVJlcXVlc3QoeyBwYXJhbXM6IGJsb2dWYWxpZGF0aW9ucy5wb3N0UGFyYW1zU2NoZW1hIH0pLFxuICBibG9nQ29udHJvbGxlci5zb2Z0RGVsZXRlUG9zdCxcbik7XG5cbmV4cG9ydCBjb25zdCBibG9nUm91dGVzID0gcm91dGVyO1xuIiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgeyBibG9nU2VydmljZSB9IGZyb20gXCIuL2Jsb2cuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIENyZWF0ZSBwb3N0IGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgY3JlYXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmNyZWF0ZVBvc3QocmVxLnVzZXIhLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQb3N0IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5LiBJdCB3aWxsIGJlIHZpc2libGUgYWZ0ZXIgcHVibGlzaGluZy5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIFB1YmxpYyBsaXN0aW5nIGNvbnRyb2xsZXIgKHNlYXJjaCArIHNvcnQgKyBwYWdpbmF0aW9uKVxuY29uc3QgZ2V0UHVibGljUG9zdHMgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBibG9nU2VydmljZS5nZXRQdWJsaWNQb3N0cyhyZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gMy4gUHVibGljIHBvc3QgZGV0YWlsIGJ5IHNsdWdcbmNvbnN0IGdldFBvc3RCeVNsdWcgPSBjYXRjaEFzeW5jKFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBzbHVnID0gU3RyaW5nKHJlcS5wYXJhbXMuc2x1Zyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0UG9zdEJ5U2x1ZyhzbHVnKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJQb3N0IHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0LiBBbGwgcG9zdHMgY29udHJvbGxlciAoQURNSU4gbW9kZXJhdGlvbilcbmNvbnN0IGdldEFsbFBvc3RzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuZ2V0QWxsUG9zdHMocmVxLnF1ZXJ5KTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJBbGwgcG9zdHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgbWV0YTogcmVzdWx0Lm1ldGEsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA0Yi4gT3duIHBvc3RzIGNvbnRyb2xsZXIgKEFHRU5UL0FETUlOKVxuY29uc3QgZ2V0TXlQb3N0cyA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLmdldE15UG9zdHMocmVxLnVzZXIhLCByZXEucXVlcnkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3RzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgIG1ldGE6IHJlc3VsdC5tZXRhLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNS4gVXBkYXRlIHBvc3QgY29udHJvbGxlciAoQUdFTlQgb3duIC8gQURNSU4gYW55KVxuY29uc3QgdXBkYXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJsb2dTZXJ2aWNlLnVwZGF0ZVBvc3QocmVxLnVzZXIhLCBpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vLyA2LiBDaGFuZ2UgcG9zdCBzdGF0dXMgY29udHJvbGxlciAoQURNSU4gcHVibGlzaC91bnB1Ymxpc2gpXG5jb25zdCBjaGFuZ2VQb3N0U3RhdHVzID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgaWQgPSBTdHJpbmcocmVxLnBhcmFtcy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYmxvZ1NlcnZpY2UuY2hhbmdlUG9zdFN0YXR1cyhpZCwgcmVxLmJvZHkpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3Qgc3RhdHVzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlwiLFxuICAgICAgZGF0YTogcmVzdWx0LFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gNy4gU29mdCBkZWxldGUgcG9zdCBjb250cm9sbGVyIChBR0VOVCBvd24gLyBBRE1JTiBhbnkpXG5jb25zdCBzb2Z0RGVsZXRlUG9zdCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGlkID0gU3RyaW5nKHJlcS5wYXJhbXMuaWQpO1xuICAgIGF3YWl0IGJsb2dTZXJ2aWNlLnNvZnREZWxldGVQb3N0KHJlcS51c2VyISwgaWQpO1xuXG4gICAgc2VuZFJlc3BvbnNlKHJlcywge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIHN0YXR1c0NvZGU6IGh0dHBTdGF0dXMuT0ssXG4gICAgICBtZXNzYWdlOiBcIlBvc3QgZGVsZXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IGJsb2dDb250cm9sbGVyID0ge1xuICBjcmVhdGVQb3N0LFxuICBnZXRQdWJsaWNQb3N0cyxcbiAgZ2V0UG9zdEJ5U2x1ZyxcbiAgZ2V0QWxsUG9zdHMsXG4gIGdldE15UG9zdHMsXG4gIHVwZGF0ZVBvc3QsXG4gIGNoYW5nZVBvc3RTdGF0dXMsXG4gIHNvZnREZWxldGVQb3N0LFxufTtcbiIsICJpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSBcIm5vZGU6Y3J5cHRvXCI7XG5pbXBvcnQgeyBQb3N0U3RhdHVzLCBSb2xlIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IFByaXNtYSB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2NsaWVudFwiO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4uLy4uL2xpYi9wcmlzbWFcIjtcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FwcEVycm9yXCI7XG5pbXBvcnQgeyBzbHVnaWZ5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NsdWdpZnlcIjtcbmltcG9ydCB7XG4gIElDcmVhdGVQb3N0UGF5bG9hZCxcbiAgSUludGVybmFsUG9zdFF1ZXJ5LFxuICBJUG9zdFF1ZXJ5LFxuICBJUmVxdWVzdFVzZXIsXG4gIElVcGRhdGVQb3N0UGF5bG9hZCxcbiAgSVVwZGF0ZVBvc3RTdGF0dXNQYXlsb2FkLFxufSBmcm9tIFwiLi9ibG9nLmludGVyZmFjZVwiO1xuXG4vLyBQdWJsaWMgcGF5bG9hZHMgY2FycnkgdGhlIGF1dGhvcidzIGRpc3BsYXkgaW5mbyBvbmx5IFx1MjAxNCBuZXZlciBlbWFpbC9yb2xlLlxuY29uc3QgcHVibGljQXV0aG9yU2VsZWN0ID0ge1xuICBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUsIGF2YXRhclVybDogdHJ1ZSB9LFxufTtcblxuLy8gQ29sbGlzaW9uLXNhZmUgc2x1ZzogYmFzZSBzbHVnIGZyb20gdGhlIHRpdGxlLCB0aGVuIGAtMmAsIGAtM2AsIC4uLiB1c2luZyBhXG4vLyBzaW5nbGUgcHJlZml4IHF1ZXJ5LiBQdXJlLUJhbmdsYS9lbW9qaSB0aXRsZXMgY2FuJ3Qgc2x1Z2lmeSBcdTIwMTQgZmFsbCBiYWNrIHRvXG4vLyBgYmxvZy08c2hvcnRJZD5gIHNvIHRoZSBVUkwgaXMgYWx3YXlzIG1lYW5pbmdmdWwuXG5jb25zdCBnZW5lcmF0ZVVuaXF1ZVNsdWcgPSBhc3luYyAodGl0bGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gIGNvbnN0IGJhc2UgPSBzbHVnaWZ5KHRpdGxlKSB8fCBgYmxvZy0ke3JhbmRvbVVVSUQoKS5zbGljZSgwLCA4KX1gO1xuXG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICB3aGVyZTogeyBzbHVnOiB7IHN0YXJ0c1dpdGg6IGJhc2UgfSB9LFxuICAgIHNlbGVjdDogeyBzbHVnOiB0cnVlIH0sXG4gIH0pO1xuXG4gIGNvbnN0IHVzZWQgPSBuZXcgU2V0KGV4aXN0aW5nLm1hcCgocCkgPT4gcC5zbHVnKSk7XG4gIGlmICghdXNlZC5oYXMoYmFzZSkpIHtcbiAgICByZXR1cm4gYmFzZTtcbiAgfVxuXG4gIGxldCBzdWZmaXggPSAyO1xuICB3aGlsZSAodXNlZC5oYXMoYCR7YmFzZX0tJHtzdWZmaXh9YCkpIHtcbiAgICBzdWZmaXggKz0gMTtcbiAgfVxuICByZXR1cm4gYCR7YmFzZX0tJHtzdWZmaXh9YDtcbn07XG5cbi8vIDEuIENyZWF0ZSBhIHBvc3QgKEFHRU5UL0FETUlOKS4gTmV3IHBvc3RzIHN0YXJ0IERSQUZUIGFuZCBuZXZlciBsZWFrIGludG9cbi8vICAgIHB1YmxpYyBxdWVyaWVzIHVudGlsIGFuIGFkbWluIHB1Ymxpc2hlcyB0aGVtLlxuY29uc3QgY3JlYXRlUG9zdCA9IGFzeW5jICh1c2VyOiBJUmVxdWVzdFVzZXIsIHBheWxvYWQ6IElDcmVhdGVQb3N0UGF5bG9hZCkgPT4ge1xuICBjb25zdCBzbHVnID0gYXdhaXQgZ2VuZXJhdGVVbmlxdWVTbHVnKHBheWxvYWQudGl0bGUpO1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICB0aXRsZTogcGF5bG9hZC50aXRsZSxcbiAgICAgIGV4Y2VycHQ6IHBheWxvYWQuZXhjZXJwdCxcbiAgICAgIGNvbnRlbnQ6IHBheWxvYWQuY29udGVudCxcbiAgICAgIGNvdmVySW1hZ2U6IHBheWxvYWQuY292ZXJJbWFnZSxcbiAgICAgIHNsdWcsXG4gICAgICBhdXRob3JJZDogdXNlci5pZCxcbiAgICB9LFxuICAgIGluY2x1ZGU6IHsgYXV0aG9yOiBwdWJsaWNBdXRob3JTZWxlY3QgfSxcbiAgfSk7XG59O1xuXG4vLyAyLiBQdWJsaWMgYmxvZyBsaXN0aW5nIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5LCBzZWFyY2ggKyBzb3J0LlxuY29uc3QgZ2V0UHVibGljUG9zdHMgPSBhc3luYyAocXVlcnk6IElQb3N0UXVlcnkpID0+IHtcbiAgY29uc3QgcGFnZSA9IHF1ZXJ5LnBhZ2UgPz8gMTtcbiAgY29uc3QgbGltaXQgPSBxdWVyeS5saW1pdCA/PyAxMDtcbiAgY29uc3Qgc2tpcCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcblxuICBjb25zdCB3aGVyZTogUHJpc21hLkJsb2dQb3N0V2hlcmVJbnB1dCA9IHtcbiAgICBzdGF0dXM6IFBvc3RTdGF0dXMuUFVCTElTSEVELFxuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnNlYXJjaFxuICAgICAgPyB7XG4gICAgICAgICAgT1I6IFtcbiAgICAgICAgICAgIHsgdGl0bGU6IHsgY29udGFpbnM6IHF1ZXJ5LnNlYXJjaCwgbW9kZTogXCJpbnNlbnNpdGl2ZVwiIH0gfSxcbiAgICAgICAgICAgIHsgZXhjZXJwdDogeyBjb250YWluczogcXVlcnkuc2VhcmNoLCBtb2RlOiBcImluc2Vuc2l0aXZlXCIgfSB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH1cbiAgICAgIDoge30pLFxuICB9O1xuXG4gIGNvbnN0IHNvcnRPcmRlciA9IHF1ZXJ5LnNvcnRPcmRlciA/PyAocXVlcnkuc29ydEJ5ID09PSBcIm9sZGVzdFwiID8gXCJhc2NcIiA6IFwiZGVzY1wiKTtcblxuICBjb25zdCBvcmRlckJ5TWFwOiBSZWNvcmQ8c3RyaW5nLCBQcmlzbWEuQmxvZ1Bvc3RPcmRlckJ5V2l0aFJlbGF0aW9uSW5wdXQ+ID0ge1xuICAgIG5ld2VzdDogeyBjcmVhdGVkQXQ6IFwiZGVzY1wiIH0sXG4gICAgb2xkZXN0OiB7IGNyZWF0ZWRBdDogXCJhc2NcIiB9LFxuICAgIHRpdGxlOiB7IHRpdGxlOiBzb3J0T3JkZXIgfSxcbiAgfTtcblxuICBjb25zdCBvcmRlckJ5ID0gb3JkZXJCeU1hcFtxdWVyeS5zb3J0QnkgPz8gXCJuZXdlc3RcIl0gPz8gb3JkZXJCeU1hcC5uZXdlc3Q7XG5cbiAgY29uc3QgW2RhdGEsIHRvdGFsXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuZmluZE1hbnkoe1xuICAgICAgd2hlcmUsXG4gICAgICBvcmRlckJ5LFxuICAgICAgc2VsZWN0OiB7XG4gICAgICAgIGlkOiB0cnVlLFxuICAgICAgICB0aXRsZTogdHJ1ZSxcbiAgICAgICAgc2x1ZzogdHJ1ZSxcbiAgICAgICAgZXhjZXJwdDogdHJ1ZSxcbiAgICAgICAgY292ZXJJbWFnZTogdHJ1ZSxcbiAgICAgICAgY3JlYXRlZEF0OiB0cnVlLFxuICAgICAgICB1cGRhdGVkQXQ6IHRydWUsXG4gICAgICAgIGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0LFxuICAgICAgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDMuIFB1YmxpYyBwb3N0IGRldGFpbCBieSBzbHVnIFx1MjAxNCBQVUJMSVNIRUQgKyBub3QtZGVsZXRlZCBvbmx5LlxuY29uc3QgZ2V0UG9zdEJ5U2x1ZyA9IGFzeW5jIChzbHVnOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcG9zdCA9IGF3YWl0IHByaXNtYS5ibG9nUG9zdC5maW5kRmlyc3Qoe1xuICAgIHdoZXJlOiB7IHNsdWcsIHN0YXR1czogUG9zdFN0YXR1cy5QVUJMSVNIRUQsIGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xuXG4gIGlmICghcG9zdCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiUG9zdCBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc3Q7XG59O1xuXG4vLyA0LiBBbGwgcG9zdHMgZm9yIHRoZSBhZG1pbiBtb2RlcmF0aW9uIFVJIChhbnkgc3RhdHVzLCBvcHRpb25hbCBmaWx0ZXIpLlxuY29uc3QgZ2V0QWxsUG9zdHMgPSBhc3luYyAocXVlcnk6IElJbnRlcm5hbFBvc3RRdWVyeSkgPT4ge1xuICBjb25zdCBwYWdlID0gcXVlcnkucGFnZSA/PyAxO1xuICBjb25zdCBsaW1pdCA9IHF1ZXJ5LmxpbWl0ID8/IDEwO1xuICBjb25zdCBza2lwID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuXG4gIGNvbnN0IHdoZXJlOiBQcmlzbWEuQmxvZ1Bvc3RXaGVyZUlucHV0ID0ge1xuICAgIGlzRGVsZXRlZDogZmFsc2UsXG4gICAgLi4uKHF1ZXJ5LnN0YXR1cyA/IHsgc3RhdHVzOiBxdWVyeS5zdGF0dXMgfSA6IHt9KSxcbiAgfTtcblxuICBjb25zdCBbZGF0YSwgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ibG9nUG9zdC5maW5kTWFueSh7XG4gICAgICB3aGVyZSxcbiAgICAgIGluY2x1ZGU6IHsgYXV0aG9yOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9IH0sXG4gICAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgICAgIHNraXAsXG4gICAgICB0YWtlOiBsaW1pdCxcbiAgICB9KSxcbiAgICBwcmlzbWEuYmxvZ1Bvc3QuY291bnQoeyB3aGVyZSB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkYXRhLFxuICAgIG1ldGE6IHsgcGFnZSwgbGltaXQsIHRvdGFsLCB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBsaW1pdCkgfSxcbiAgfTtcbn07XG5cbi8vIDRiLiBUaGUgY2FsbGVyJ3Mgb3duIHBvc3RzIChBR0VOVC9BRE1JTiBcIk15IFBvc3RzXCIgVUkpIFx1MjAxNCBhbnkgc3RhdHVzLCBzaW5jZVxuLy8gICAgIGFnZW50cyBtdXN0IHNlZSB0aGVpciBvd24gZHJhZnRzIGJlZm9yZSBhbiBhZG1pbiBwdWJsaXNoZXMgdGhlbS5cbmNvbnN0IGdldE15UG9zdHMgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBxdWVyeTogSUludGVybmFsUG9zdFF1ZXJ5KSA9PiB7XG4gIGNvbnN0IHBhZ2UgPSBxdWVyeS5wYWdlID8/IDE7XG4gIGNvbnN0IGxpbWl0ID0gcXVlcnkubGltaXQgPz8gMTA7XG4gIGNvbnN0IHNraXAgPSAocGFnZSAtIDEpICogbGltaXQ7XG5cbiAgY29uc3Qgd2hlcmU6IFByaXNtYS5CbG9nUG9zdFdoZXJlSW5wdXQgPSB7XG4gICAgYXV0aG9ySWQ6IHVzZXIuaWQsXG4gICAgaXNEZWxldGVkOiBmYWxzZSxcbiAgICAuLi4ocXVlcnkuc3RhdHVzID8geyBzdGF0dXM6IHF1ZXJ5LnN0YXR1cyB9IDoge30pLFxuICB9O1xuXG4gIGNvbnN0IFtkYXRhLCB0b3RhbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLmJsb2dQb3N0LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlLFxuICAgICAgaW5jbHVkZTogeyBhdXRob3I6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9IH0gfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiBcImRlc2NcIiB9LFxuICAgICAgc2tpcCxcbiAgICAgIHRha2U6IGxpbWl0LFxuICAgIH0pLFxuICAgIHByaXNtYS5ibG9nUG9zdC5jb3VudCh7IHdoZXJlIH0pLFxuICBdKTtcblxuICByZXR1cm4ge1xuICAgIGRhdGEsXG4gICAgbWV0YTogeyBwYWdlLCBsaW1pdCwgdG90YWwsIHRvdGFsUGFnZXM6IE1hdGguY2VpbCh0b3RhbCAvIGxpbWl0KSB9LFxuICB9O1xufTtcblxuLy8gRmV0Y2ggKyBvd25lcnNoaXAgZ2F0ZSBzaGFyZWQgYnkgUEFUQ0ggYW5kIERFTEVURS4gQURNSU4gYnlwYXNzZXMgb3duZXJzaGlwO1xuLy8gQUdFTlQgZWRpdHMgYXJlIGNvbmZpbmVkIHRvIHRoZWlyIG93biBwb3N0cy5cbmNvbnN0IGZpbmRPd25lZFBvc3QgPSBhc3luYyAodXNlcjogSVJlcXVlc3RVc2VyLCBwb3N0SWQ6IHN0cmluZykgPT4ge1xuICBjb25zdCBwb3N0ID0gYXdhaXQgcHJpc21hLmJsb2dQb3N0LmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgfSk7XG5cbiAgaWYgKCFwb3N0KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgXCJQb3N0IG5vdCBmb3VuZC5cIik7XG4gIH1cblxuICBpZiAodXNlci5yb2xlICE9PSBSb2xlLkFETUlOICYmIHBvc3QuYXV0aG9ySWQgIT09IHVzZXIuaWQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCBcIllvdSBjYW4gb25seSBhY3Qgb24geW91ciBvd24gcG9zdHMuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHBvc3Q7XG59O1xuXG4vLyA1LiBVcGRhdGUgYSBwb3N0LiBTbHVnIG5ldmVyIGNoYW5nZXMgKGtlZXBzIGxpbmtzL2Jvb2ttYXJrcyB2YWxpZCkuXG4vLyAgICBBR0VOVCBlZGl0cyByZXNldCBzdGF0dXMgdG8gRFJBRlQgKHJlLXB1Ymxpc2ggdmlhIC86aWQvc3RhdHVzKTtcbi8vICAgIEFETUlOIGVkaXRzIHByZXNlcnZlIHN0YXR1cy5cbmNvbnN0IHVwZGF0ZVBvc3QgPSBhc3luYyAoXG4gIHVzZXI6IElSZXF1ZXN0VXNlcixcbiAgcG9zdElkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElVcGRhdGVQb3N0UGF5bG9hZCxcbikgPT4ge1xuICBhd2FpdCBmaW5kT3duZWRQb3N0KHVzZXIsIHBvc3RJZCk7XG5cbiAgY29uc3QgZGF0YTogUHJpc21hLkJsb2dQb3N0VXBkYXRlSW5wdXQgPSB7XG4gICAgLi4uKHBheWxvYWQudGl0bGUgIT09IHVuZGVmaW5lZCA/IHsgdGl0bGU6IHBheWxvYWQudGl0bGUgfSA6IHt9KSxcbiAgICAuLi4ocGF5bG9hZC5leGNlcnB0ICE9PSB1bmRlZmluZWQgPyB7IGV4Y2VycHQ6IHBheWxvYWQuZXhjZXJwdCB9IDoge30pLFxuICAgIC4uLihwYXlsb2FkLmNvbnRlbnQgIT09IHVuZGVmaW5lZCA/IHsgY29udGVudDogcGF5bG9hZC5jb250ZW50IH0gOiB7fSksXG4gICAgLi4uKHBheWxvYWQuY292ZXJJbWFnZSAhPT0gdW5kZWZpbmVkXG4gICAgICA/IHsgY292ZXJJbWFnZTogcGF5bG9hZC5jb3ZlckltYWdlIH1cbiAgICAgIDoge30pLFxuICAgIC4uLih1c2VyLnJvbGUgIT09IFJvbGUuQURNSU4gPyB7IHN0YXR1czogUG9zdFN0YXR1cy5EUkFGVCB9IDoge30pLFxuICB9O1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gNi4gUHVibGlzaC91bnB1Ymxpc2ggYSBwb3N0IChhZG1pbikuXG5jb25zdCBjaGFuZ2VQb3N0U3RhdHVzID0gYXN5bmMgKFxuICBwb3N0SWQ6IHN0cmluZyxcbiAgcGF5bG9hZDogSVVwZGF0ZVBvc3RTdGF0dXNQYXlsb2FkLFxuKSA9PiB7XG4gIGNvbnN0IHBvc3QgPSBhd2FpdCBwcmlzbWEuYmxvZ1Bvc3QuZmluZFVuaXF1ZU9yVGhyb3coe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgfSk7XG5cbiAgaWYgKHBvc3QuaXNEZWxldGVkKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgXCJDYW5ub3QgY2hhbmdlIHRoZSBzdGF0dXMgb2YgYSBkZWxldGVkIHBvc3QuXCIpO1xuICB9XG5cbiAgcmV0dXJuIHByaXNtYS5ibG9nUG9zdC51cGRhdGUoe1xuICAgIHdoZXJlOiB7IGlkOiBwb3N0SWQgfSxcbiAgICBkYXRhOiB7IHN0YXR1czogcGF5bG9hZC5zdGF0dXMgfSxcbiAgICBpbmNsdWRlOiB7IGF1dGhvcjogcHVibGljQXV0aG9yU2VsZWN0IH0sXG4gIH0pO1xufTtcblxuLy8gNy4gU29mdCBkZWxldGUgKGFkbWluIGFueSwgYWdlbnQgb3duKS5cbmNvbnN0IHNvZnREZWxldGVQb3N0ID0gYXN5bmMgKHVzZXI6IElSZXF1ZXN0VXNlciwgcG9zdElkOiBzdHJpbmcpID0+IHtcbiAgYXdhaXQgZmluZE93bmVkUG9zdCh1c2VyLCBwb3N0SWQpO1xuXG4gIHJldHVybiBwcmlzbWEuYmxvZ1Bvc3QudXBkYXRlKHtcbiAgICB3aGVyZTogeyBpZDogcG9zdElkIH0sXG4gICAgZGF0YTogeyBpc0RlbGV0ZWQ6IHRydWUgfSxcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgYmxvZ1NlcnZpY2UgPSB7XG4gIGNyZWF0ZVBvc3QsXG4gIGdldFB1YmxpY1Bvc3RzLFxuICBnZXRQb3N0QnlTbHVnLFxuICBnZXRBbGxQb3N0cyxcbiAgZ2V0TXlQb3N0cyxcbiAgdXBkYXRlUG9zdCxcbiAgY2hhbmdlUG9zdFN0YXR1cyxcbiAgc29mdERlbGV0ZVBvc3QsXG59O1xuIiwgImltcG9ydCB7IHogfSBmcm9tIFwiem9kXCI7XG5cbmNvbnN0IHRpdGxlU2NoZW1hID0gelxuICAuc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiVGl0bGUgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMywgXCJUaXRsZSBtdXN0IGJlIGF0IGxlYXN0IDMgY2hhcmFjdGVyc1wiKVxuICAubWF4KDIwMCwgXCJUaXRsZSBtdXN0IGJlIGF0IG1vc3QgMjAwIGNoYXJhY3RlcnNcIik7XG5cbmNvbnN0IGV4Y2VycHRTY2hlbWEgPSB6XG4gIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJFeGNlcnB0IGlzIHJlcXVpcmVkXCIgfSlcbiAgLnRyaW0oKVxuICAubWluKDEsIFwiRXhjZXJwdCBtdXN0IG5vdCBiZSBlbXB0eVwiKVxuICAubWF4KDUwMCwgXCJFeGNlcnB0IG11c3QgYmUgYXQgbW9zdCA1MDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY29udGVudFNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvbnRlbnQgaXMgcmVxdWlyZWRcIiB9KVxuICAudHJpbSgpXG4gIC5taW4oMSwgXCJDb250ZW50IG11c3Qgbm90IGJlIGVtcHR5XCIpXG4gIC5tYXgoMTAwMDAsIFwiQ29udGVudCBtdXN0IGJlIGF0IG1vc3QgMTAwMDAgY2hhcmFjdGVyc1wiKTtcblxuY29uc3QgY292ZXJJbWFnZVNjaGVtYSA9IHpcbiAgLnN0cmluZyh7IHJlcXVpcmVkX2Vycm9yOiBcIkNvdmVyIGltYWdlIGlzIHJlcXVpcmVkXCIgfSlcbiAgLnVybChcIkNvdmVyIGltYWdlIG11c3QgYmUgYSB2YWxpZCBVUkxcIik7XG5cbmNvbnN0IGNyZWF0ZVBvc3RTY2hlbWEgPSB6XG4gIC5vYmplY3Qoe1xuICAgIHRpdGxlOiB0aXRsZVNjaGVtYSxcbiAgICBleGNlcnB0OiBleGNlcnB0U2NoZW1hLFxuICAgIGNvbnRlbnQ6IGNvbnRlbnRTY2hlbWEsXG4gICAgY292ZXJJbWFnZTogY292ZXJJbWFnZVNjaGVtYSxcbiAgfSlcbiAgLnN0cmljdCgpO1xuXG5jb25zdCB1cGRhdGVQb3N0U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICB0aXRsZTogdGl0bGVTY2hlbWEub3B0aW9uYWwoKSxcbiAgICBleGNlcnB0OiBleGNlcnB0U2NoZW1hLm9wdGlvbmFsKCksXG4gICAgY29udGVudDogY29udGVudFNjaGVtYS5vcHRpb25hbCgpLFxuICAgIGNvdmVySW1hZ2U6IGNvdmVySW1hZ2VTY2hlbWEub3B0aW9uYWwoKSxcbiAgfSlcbiAgLnN0cmljdCgpXG4gIC5yZWZpbmUoKGRhdGEpID0+IE9iamVjdC5rZXlzKGRhdGEpLmxlbmd0aCA+IDAsIHtcbiAgICBtZXNzYWdlOiBcIkF0IGxlYXN0IG9uZSBmaWVsZCBtdXN0IGJlIHByb3ZpZGVkIHRvIHVwZGF0ZVwiLFxuICB9KTtcblxuY29uc3QgcG9zdFBhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgaWQ6IHouc3RyaW5nKHsgcmVxdWlyZWRfZXJyb3I6IFwiUG9zdCBpZCBpcyByZXF1aXJlZFwiIH0pLm1pbigxKSxcbn0pO1xuXG5jb25zdCBwb3N0U2x1Z1BhcmFtc1NjaGVtYSA9IHoub2JqZWN0KHtcbiAgc2x1Zzogei5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJQb3N0IHNsdWcgaXMgcmVxdWlyZWRcIiB9KS50cmltKCkubWluKDEpLFxufSk7XG5cbmNvbnN0IHVwZGF0ZVN0YXR1c1NjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgc3RhdHVzOiB6LmVudW0oW1wiRFJBRlRcIiwgXCJQVUJMSVNIRURcIl0sIHtcbiAgICAgIHJlcXVpcmVkX2Vycm9yOiBcIlN0YXR1cyBpcyByZXF1aXJlZFwiLFxuICAgICAgaW52YWxpZF90eXBlX2Vycm9yOiBcIlN0YXR1cyBtdXN0IGJlIERSQUZUIG9yIFBVQkxJU0hFRFwiLFxuICAgIH0pLFxuICB9KVxuICAuc3RyaWN0KCk7XG5cbmNvbnN0IHB1YmxpY1F1ZXJ5U2NoZW1hID0gelxuICAub2JqZWN0KHtcbiAgICBwYWdlOiB6LmNvZXJjZS5udW1iZXIoKS5pbnQoKS5taW4oMSkuZGVmYXVsdCgxKSxcbiAgICBsaW1pdDogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLm1heCg1MCkuZGVmYXVsdCgxMCksXG4gICAgc2VhcmNoOiB6LnN0cmluZygpLnRyaW0oKS5taW4oMSkubWF4KDIwMCkub3B0aW9uYWwoKSxcbiAgICBzb3J0Qnk6IHouZW51bShbXCJuZXdlc3RcIiwgXCJvbGRlc3RcIiwgXCJ0aXRsZVwiXSkuZGVmYXVsdChcIm5ld2VzdFwiKSxcbiAgICBzb3J0T3JkZXI6IHouZW51bShbXCJhc2NcIiwgXCJkZXNjXCJdKS5vcHRpb25hbCgpLFxuICB9KTtcblxuY29uc3QgaW50ZXJuYWxRdWVyeVNjaGVtYSA9IHpcbiAgLm9iamVjdCh7XG4gICAgcGFnZTogei5jb2VyY2UubnVtYmVyKCkuaW50KCkubWluKDEpLmRlZmF1bHQoMSksXG4gICAgbGltaXQ6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoNTApLmRlZmF1bHQoMTApLFxuICAgIHN0YXR1czogelxuICAgICAgLmVudW0oW1wiRFJBRlRcIiwgXCJQVUJMSVNIRURcIl0pXG4gICAgICAudHJhbnNmb3JtKCh2YWwpID0+IHZhbCBhcyBcIkRSQUZUXCIgfCBcIlBVQkxJU0hFRFwiKVxuICAgICAgLm9wdGlvbmFsKCksXG4gIH0pO1xuXG5leHBvcnQgY29uc3QgYmxvZ1ZhbGlkYXRpb25zID0ge1xuICBjcmVhdGVQb3N0U2NoZW1hLFxuICB1cGRhdGVQb3N0U2NoZW1hLFxuICBwb3N0UGFyYW1zU2NoZW1hLFxuICBwb3N0U2x1Z1BhcmFtc1NjaGVtYSxcbiAgdXBkYXRlU3RhdHVzU2NoZW1hLFxuICBwdWJsaWNRdWVyeVNjaGVtYSxcbiAgaW50ZXJuYWxRdWVyeVNjaGVtYSxcbn07XG4iLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IGRhc2hib2FyZENvbnRyb2xsZXIgfSBmcm9tIFwiLi9kYXNoYm9hcmQuY29udHJvbGxlclwiO1xuaW1wb3J0IHsgZGFzaGJvYXJkVmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9kYXNoYm9hcmQudmFsaWRhdGlvblwiO1xuXG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gMS4gQWRtaW4gZGFzaGJvYXJkIFx1MjAxNCBwbGF0Zm9ybS13aWRlIGFuYWx5dGljc1xucm91dGVyLmdldChcbiAgXCIvYWRtaW5cIixcbiAgYXV0aChSb2xlLkFETUlOKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGRhc2hib2FyZFZhbGlkYXRpb25zLmRhc2hib2FyZFF1ZXJ5U2NoZW1hIH0pLFxuICBkYXNoYm9hcmRDb250cm9sbGVyLmdldEFkbWluRGFzaGJvYXJkLFxuKTtcblxuLy8gMi4gQWdlbnQgZGFzaGJvYXJkIFx1MjAxNCBvd24gcGFja2FnZXMvYm9va2luZ3MvcmV2ZW51ZS9wZXJmb3JtYW5jZVxucm91dGVyLmdldChcbiAgXCIvYWdlbnRcIixcbiAgYXV0aChSb2xlLkFHRU5UKSxcbiAgdmFsaWRhdGVSZXF1ZXN0KHsgcXVlcnk6IGRhc2hib2FyZFZhbGlkYXRpb25zLmRhc2hib2FyZFF1ZXJ5U2NoZW1hIH0pLFxuICBkYXNoYm9hcmRDb250cm9sbGVyLmdldEFnZW50RGFzaGJvYXJkLFxuKTtcblxuLy8gMy4gVXNlciBkYXNoYm9hcmQgXHUyMDE0IG93biBib29raW5ncy91cGNvbWluZy9zcGVuZFxucm91dGVyLmdldChcIi91c2VyXCIsIGF1dGgoUm9sZS5VU0VSKSwgZGFzaGJvYXJkQ29udHJvbGxlci5nZXRVc2VyRGFzaGJvYXJkKTtcblxuZXhwb3J0IGNvbnN0IGRhc2hib2FyZFJvdXRlcyA9IHJvdXRlcjsiLCAiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgaHR0cFN0YXR1cyBmcm9tIFwiaHR0cC1zdGF0dXNcIjtcbmltcG9ydCB7IGRhc2hib2FyZFNlcnZpY2UgfSBmcm9tIFwiLi9kYXNoYm9hcmQuc2VydmljZVwiO1xuaW1wb3J0IHsgY2F0Y2hBc3luYyB9IGZyb20gXCIuLi8uLi91dGlscy9jYXRjaEFzeW5jXCI7XG5pbXBvcnQgeyBzZW5kUmVzcG9uc2UgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2VuZFJlc3BvbnNlXCI7XG5cbi8vIDEuIEFkbWluIGRhc2hib2FyZCBjb250cm9sbGVyIChBRE1JTilcbmNvbnN0IGdldEFkbWluRGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRBZG1pbkRhc2hib2FyZChcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDIuIEFnZW50IGRhc2hib2FyZCBjb250cm9sbGVyIChBR0VOVClcbmNvbnN0IGdldEFnZW50RGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRBZ2VudERhc2hib2FyZChcbiAgICAgIHVzZXJJZCxcbiAgICAgIE51bWJlcihyZXEucXVlcnkuZGF5cyksXG4gICAgKTtcblxuICAgIHNlbmRSZXNwb25zZShyZXMsIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBzdGF0dXNDb2RlOiBodHRwU3RhdHVzLk9LLFxuICAgICAgbWVzc2FnZTogXCJEYXNoYm9hcmQgZGF0YSBmZXRjaGVkIHN1Y2Nlc3NmdWxseS5cIixcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KTtcbiAgfSxcbik7XG5cbi8vIDMuIFVzZXIgZGFzaGJvYXJkIGNvbnRyb2xsZXIgKFVTRVIpXG5jb25zdCBnZXRVc2VyRGFzaGJvYXJkID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJlcS51c2VyPy5pZCk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGFzaGJvYXJkU2VydmljZS5nZXRVc2VyRGFzaGJvYXJkKHVzZXJJZCk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5PSyxcbiAgICAgIG1lc3NhZ2U6IFwiRGFzaGJvYXJkIGRhdGEgZmV0Y2hlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkQ29udHJvbGxlciA9IHtcbiAgZ2V0QWRtaW5EYXNoYm9hcmQsXG4gIGdldEFnZW50RGFzaGJvYXJkLFxuICBnZXRVc2VyRGFzaGJvYXJkLFxufTsiLCAiaW1wb3J0IHsgUHJpc21hIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvY2xpZW50XCI7XG5pbXBvcnQgeyBCb29raW5nU3RhdHVzLCBQYWNrYWdlU3RhdHVzIH0gZnJvbSBcIi4uLy4uLy4uL2dlbmVyYXRlZC9wcmlzbWEvZW51bXNcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQge1xuICBJQWdlbnREYXNoYm9hcmQsXG4gIElBZG1pbkRhc2hib2FyZCxcbiAgSUJvb2tpbmdzQnlTdGF0dXMsXG4gIElSZXZlbnVlUG9pbnQsXG4gIElVc2VyRGFzaGJvYXJkLFxufSBmcm9tIFwiLi9kYXNoYm9hcmQuaW50ZXJmYWNlXCI7XG5cbi8vIE1vbmV5IGlzIGBEZWNpbWFsKDEwLDIpYCBpbiB0aGUgc2NoZW1hIChBR0VOVFMubWQpIFx1MjAxNCBtYXAgdG8gTnVtYmVyIG9uIHJldHVybi5cbmNvbnN0IHRvTnVtYmVyID0gKHZhbHVlOiB1bmtub3duKTogbnVtYmVyID0+IE51bWJlcih2YWx1ZSA/PyAwKTtcblxuLy8gQm9va2luZy1zdGF0dXMgYnJlYWtkb3duIHZpYSBncm91cEJ5ICsgX2NvdW50LiBPcHRpb25hbCBwYWNrYWdlLWlkIHNjb3BlXG4vLyAoYGFnZW50SWRgKSBsaW1pdHMgaXQgdG8gYW4gYWdlbnQncyBvd24sIG5vbi1kZWxldGVkIHBhY2thZ2VzLlxuY29uc3QgZ2V0Qm9va2luZ3NCeVN0YXR1cyA9IGFzeW5jIChcbiAgYWdlbnRJZD86IHN0cmluZyxcbik6IFByb21pc2U8SUJvb2tpbmdzQnlTdGF0dXNbXT4gPT4ge1xuICBjb25zdCBncm91cGVkID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZ3JvdXBCeSh7XG4gICAgYnk6IFtcInN0YXR1c1wiXSxcbiAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgIHdoZXJlOiBhZ2VudElkXG4gICAgICA/IHsgcGFja2FnZTogeyBhZ2VudElkLCBpc0RlbGV0ZWQ6IGZhbHNlIH0gfVxuICAgICAgOiB1bmRlZmluZWQsXG4gIH0pO1xuXG4gIHJldHVybiBncm91cGVkXG4gICAgLm1hcCgoZykgPT4gKHsgc3RhdHVzOiBnLnN0YXR1cywgY291bnQ6IGcuX2NvdW50Ll9hbGwgfSkpXG4gICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KTtcbn07XG5cbi8vIFJldmVudWUgdHJlbmQ6IG9uZSByb3cgcGVyIGRheSBmb3IgdGhlIGxhc3QgYGRheXNgIGRheXMsIGJ1Y2tldGluZyBDT01QTEVURURcbi8vIGJvb2tpbmdzIGJ5IHRoZWlyIGB1cGRhdGVkQXRgIFx1MjAxNCB0aGUgdGltZXN0YW1wIG9mIHRoZSB0cmFuc2l0aW9uIGludG9cbi8vIENPTVBMRVRFRCAoYSB0ZXJtaW5hbCBzdGF0ZSwgc28gaXQgaXMgdGhlIGxhc3Qgd3JpdGUpLiBgY3JlYXRlZEF0YCBpcyB3aGVuXG4vLyB0aGUgYm9va2luZyB3YXMgbWFkZSAoUEVORElORykgYW5kIG5ldmVyIG1vdmVzLCB3aGljaCB3b3VsZCBtaXMtZGF0ZSByZXZlbnVlXG4vLyB3ZWVrcyBsYXRlci4gUG9zdGdyZXMgZ2VuZXJhdGVfc2VyaWVzIGd1YXJhbnRlZXMgYSBkZW5zZSBzZXJpZXMgKHplcm8tZmlsbGVkXG4vLyBkYXlzKSBcdTIwMTQgYmV0dGVyIGFuZCBmYXN0ZXIgdGhhbiBhIHBlci1kYXkgSlMgbG9vcC5cbmNvbnN0IGdldFJldmVudWVPdmVyVGltZSA9IGFzeW5jIChcbiAgZGF5czogbnVtYmVyLFxuICBhZ2VudElkPzogc3RyaW5nLFxuKTogUHJvbWlzZTxJUmV2ZW51ZVBvaW50W10+ID0+IHtcbiAgY29uc3Qgc2NvcGUgPSBhZ2VudElkXG4gICAgPyBgQU5EIGIuXCJwYWNrYWdlSWRcIiBJTiAoXG4gICAgICAgICBTRUxFQ1QgcC5cImlkXCJcbiAgICAgICAgIEZST00gXCJ0b3VyX3BhY2thZ2VzXCIgcFxuICAgICAgICAgV0hFUkUgcC5cImFnZW50SWRcIiA9ICQyXG4gICAgICAgICAgIEFORCBwLlwiaXNEZWxldGVkXCIgPSBmYWxzZVxuICAgICAgIClgXG4gICAgOiBcIlwiO1xuXG4gIGNvbnN0IHJvd3MgPSBhd2FpdCBwcmlzbWEuJHF1ZXJ5UmF3VW5zYWZlPFxuICAgIHsgZGF0ZTogc3RyaW5nOyByZXZlbnVlOiBudW1iZXIgfVtdXG4gID4oXG4gICAgYFxuICAgIFNFTEVDVCB0b19jaGFyKGRheXMuZCwgJ1lZWVktTU0tREQnKSBBUyBkYXRlLFxuICAgICAgICAgICBDT0FMRVNDRShTVU0oYi5cInRvdGFsUHJpY2VcIiksIDApOjpmbG9hdDggQVMgcmV2ZW51ZVxuICAgIEZST00gZ2VuZXJhdGVfc2VyaWVzKFxuICAgICAgQ1VSUkVOVF9EQVRFIC0gbWFrZV9pbnRlcnZhbChkYXlzID0+ICQxOjppbnQgLSAxKSxcbiAgICAgIENVUlJFTlRfREFURSxcbiAgICAgICcxIGRheSc6OmludGVydmFsXG4gICAgKSBBUyBkYXlzKGQpXG4gICAgTEVGVCBKT0lOIFwiYm9va2luZ3NcIiBiXG4gICAgICBPTiBkYXRlX3RydW5jKCdkYXknLCBiLlwidXBkYXRlZEF0XCIpOjpkYXRlID0gZGF5cy5kXG4gICAgICBBTkQgYi5cInN0YXR1c1wiID0gJ0NPTVBMRVRFRCdcbiAgICAgICR7c2NvcGV9XG4gICAgR1JPVVAgQlkgZGF5cy5kXG4gICAgT1JERVIgQlkgZGF5cy5kIEFTQ1xuICAgIGAsXG4gICAgZGF5cyxcbiAgICAuLi4oYWdlbnRJZCA/IFthZ2VudElkXSA6IFtdKSxcbiAgKTtcblxuICByZXR1cm4gcm93cztcbn07XG5cbi8vIFBhY2thZ2UtaWQgc2NvcGUgZm9yIGJvb2tpbmcgcXVlcmllcy4gQ2FsbGVycyBzaG9ydC1jaXJjdWl0IHRoZSBlbXB0eSBjYXNlXG4vLyAoYW4gYWdlbnQgd2l0aCBubyBwYWNrYWdlcyksIGJ1dCBhbiBgaW46IFtdYCBmYWxsYmFjayBrZWVwcyB0aGUgdHlwZVxuLy8gbm9uLW51bGxhYmxlIHdoaWxlIHN0aWxsIG1hdGNoaW5nIG5vdGhpbmcgaWYgaXQgZXZlciBzbGlwcyB0aHJvdWdoLlxuY29uc3QgdG9QYWNrYWdlSWRTY29wZSA9IChcbiAgcGFja2FnZUlkczogc3RyaW5nW10sXG4pOiBQcmlzbWEuQm9va2luZ1doZXJlSW5wdXQgPT5cbiAgcGFja2FnZUlkcy5sZW5ndGhcbiAgICA/IHsgcGFja2FnZUlkOiB7IGluOiBwYWNrYWdlSWRzIH0gfVxuICAgIDogeyBwYWNrYWdlSWQ6IHsgaW46IFtdIH0gfTtcblxuLy8gMS4gQWRtaW4gZGFzaGJvYXJkIFx1MjAxNCBwbGF0Zm9ybS13aWRlIGNvdW50cywgYnJlYWtkb3ducyBhbmQgcmV2ZW51ZSB0cmVuZC5cbmNvbnN0IGdldEFkbWluRGFzaGJvYXJkID0gYXN5bmMgKGRheXM6IG51bWJlcik6IFByb21pc2U8SUFkbWluRGFzaGJvYXJkPiA9PiB7XG4gIGNvbnN0IFtcbiAgICB0b3RhbFVzZXJzLFxuICAgIHRvdGFsUGFja2FnZXMsXG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFJldmVudWUsXG4gICAgdXNlcnNCeVJvbGUsXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICBwYWNrYWdlc0J5Q2F0ZWdvcnksXG4gICAgcmV2ZW51ZU92ZXJUaW1lLFxuICBdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS51c2VyLmNvdW50KHsgd2hlcmU6IHsgaXNEZWxldGVkOiBmYWxzZSB9IH0pLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5jb3VudCh7IHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSB9KSxcbiAgICBwcmlzbWEuYm9va2luZy5jb3VudCgpLFxuICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICBfc3VtOiB7IHRvdGFsUHJpY2U6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfSxcbiAgICB9KSxcbiAgICBwcmlzbWEudXNlci5ncm91cEJ5KHtcbiAgICAgIGJ5OiBbXCJyb2xlXCJdLFxuICAgICAgX2NvdW50OiB7IF9hbGw6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7IGlzRGVsZXRlZDogZmFsc2UgfSxcbiAgICB9KSxcbiAgICBnZXRCb29raW5nc0J5U3RhdHVzKCksXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlXG4gICAgICAuZ3JvdXBCeSh7XG4gICAgICAgIGJ5OiBbXCJjYXRlZ29yeUlkXCJdLFxuICAgICAgICBfY291bnQ6IHsgX2FsbDogdHJ1ZSB9LFxuICAgICAgICB3aGVyZTogeyBpc0RlbGV0ZWQ6IGZhbHNlIH0sXG4gICAgICB9KVxuICAgICAgLnRoZW4oYXN5bmMgKGdyb3VwZWQpID0+IHtcbiAgICAgICAgY29uc3QgY2F0ZWdvcnlJZHMgPSBncm91cGVkLm1hcCgoZykgPT4gZy5jYXRlZ29yeUlkKTtcbiAgICAgICAgY29uc3QgY2F0ZWdvcmllcyA9IGF3YWl0IHByaXNtYS5jYXRlZ29yeS5maW5kTWFueSh7XG4gICAgICAgICAgd2hlcmU6IHsgaWQ6IHsgaW46IGNhdGVnb3J5SWRzIH0gfSxcbiAgICAgICAgICBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IG5hbWVNYXAgPSBuZXcgTWFwKGNhdGVnb3JpZXMubWFwKChjKSA9PiBbYy5pZCwgYy5uYW1lXSkpO1xuXG4gICAgICAgIHJldHVybiBncm91cGVkXG4gICAgICAgICAgLm1hcCgoZykgPT4gKHtcbiAgICAgICAgICAgIGNhdGVnb3J5OiBuYW1lTWFwLmdldChnLmNhdGVnb3J5SWQpID8/IFwiVW5rbm93blwiLFxuICAgICAgICAgICAgY291bnQ6IGcuX2NvdW50Ll9hbGwsXG4gICAgICAgICAgfSkpXG4gICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KTtcbiAgICAgIH0pLFxuICAgIGdldFJldmVudWVPdmVyVGltZShkYXlzKSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbFVzZXJzLFxuICAgIHRvdGFsUGFja2FnZXMsXG4gICAgdG90YWxCb29raW5ncyxcbiAgICB0b3RhbFJldmVudWU6IHRvTnVtYmVyKHRvdGFsUmV2ZW51ZS5fc3VtLnRvdGFsUHJpY2UpLFxuICAgIHVzZXJzQnlSb2xlOiB1c2Vyc0J5Um9sZVxuICAgICAgLm1hcCgoZykgPT4gKHsgcm9sZTogZy5yb2xlLCBjb3VudDogZy5fY291bnQuX2FsbCB9KSlcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBiLmNvdW50IC0gYS5jb3VudCksXG4gICAgYm9va2luZ3NCeVN0YXR1cyxcbiAgICBwYWNrYWdlc0J5Q2F0ZWdvcnksXG4gICAgcmV2ZW51ZU92ZXJUaW1lLFxuICB9O1xufTtcblxuLy8gMi4gQWdlbnQgZGFzaGJvYXJkIFx1MjAxNCBzY29wZWQgdG8gdGhlIGFnZW50J3Mgb3duIHBhY2thZ2VzLiBGZXRjaGVzIG93bmVkXG4vLyAgICBwYWNrYWdlIGlkcyBvbmNlLCB0aGVuIGV2ZXJ5IGFnZ3JlZ2F0ZSByZXVzZXMgdGhhdCBzY29wZSBzbyB0aGUgd2hvbGVcbi8vICAgIGJ1bmRsZSBpcyBvbmUgUHJvbWlzZS5hbGwgKG5vIHBlci1pdGVtIHF1ZXJpZXMpLlxuY29uc3QgZ2V0QWdlbnREYXNoYm9hcmQgPSBhc3luYyAoXG4gIHVzZXJJZDogc3RyaW5nLFxuICBkYXlzOiBudW1iZXIsXG4pOiBQcm9taXNlPElBZ2VudERhc2hib2FyZD4gPT4ge1xuICBjb25zdCBbb3duZWRQYWNrYWdlcywgYm9va2luZ3NCeVN0YXR1cywgYXZlcmFnZVJhdGluZ10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgcHJpc21hLnRvdXJQYWNrYWdlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7IGFnZW50SWQ6IHVzZXJJZCwgaXNEZWxldGVkOiBmYWxzZSB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgfSksXG4gICAgZ2V0Qm9va2luZ3NCeVN0YXR1cyh1c2VySWQpLFxuICAgIHByaXNtYS50b3VyUGFja2FnZS5hZ2dyZWdhdGUoe1xuICAgICAgX2F2ZzogeyByYXRpbmc6IHRydWUgfSxcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGFnZW50SWQ6IHVzZXJJZCxcbiAgICAgICAgc3RhdHVzOiBQYWNrYWdlU3RhdHVzLkFQUFJPVkVELFxuICAgICAgICBpc0RlbGV0ZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSk7XG5cbiAgY29uc3QgcGFja2FnZUlkcyA9IG93bmVkUGFja2FnZXMubWFwKChwKSA9PiBwLmlkKTtcblxuICAvLyBBbiBhZ2VudCB3aXRoIG5vIHBhY2thZ2VzIG11c3Qgc2VlIHplcm9zIFx1MjAxNCBzY29wZSBpcyB1bmRlZmluZWQgZm9yIGFuIGVtcHR5XG4gIC8vIGxpc3QsIGFuZCBhIGJhcmUgYHdoZXJlOiB1bmRlZmluZWRgIC8gYEFORDogW3t9XWAgd291bGQgb3RoZXJ3aXNlIG1hdGNoIHRoZVxuICAvLyB3aG9sZSBwbGF0Zm9ybSAoY3Jvc3MtYWdlbnQgZGF0YSBsZWFrKS4gU2hvcnQtY2lyY3VpdCBoZXJlIGluc3RlYWQuXG4gIGlmIChwYWNrYWdlSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB7XG4gICAgICB0b3RhbFBhY2thZ2VzOiAwLFxuICAgICAgdG90YWxCb29raW5nczogMCxcbiAgICAgIHRvdGFsUmV2ZW51ZTogMCxcbiAgICAgIGF2ZXJhZ2VSYXRpbmc6IE1hdGgucm91bmQoKGF2ZXJhZ2VSYXRpbmcuX2F2Zy5yYXRpbmcgPz8gMCkgKiAxMCkgLyAxMCxcbiAgICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgICByZXZlbnVlT3ZlclRpbWU6IGF3YWl0IGdldFJldmVudWVPdmVyVGltZShkYXlzLCB1c2VySWQpLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBzY29wZSA9IHRvUGFja2FnZUlkU2NvcGUocGFja2FnZUlkcyk7XG5cbiAgY29uc3QgW3RvdGFsUGFja2FnZXMsIHRvdGFsQm9va2luZ3MsIHRvdGFsUmV2ZW51ZSwgcmV2ZW51ZU92ZXJUaW1lXSA9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgcGFja2FnZUlkcy5sZW5ndGgsXG4gICAgICBwcmlzbWEuYm9va2luZy5jb3VudCh7IHdoZXJlOiBzY29wZSB9KSxcbiAgICAgIHByaXNtYS5ib29raW5nLmFnZ3JlZ2F0ZSh7XG4gICAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIEFORDogW3Njb3BlLCB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5DT01QTEVURUQgfV0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIGdldFJldmVudWVPdmVyVGltZShkYXlzLCB1c2VySWQpLFxuICAgIF0pO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxQYWNrYWdlcyxcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsUmV2ZW51ZTogdG9OdW1iZXIodG90YWxSZXZlbnVlLl9zdW0udG90YWxQcmljZSksXG4gICAgYXZlcmFnZVJhdGluZzogTWF0aC5yb3VuZCgoYXZlcmFnZVJhdGluZy5fYXZnLnJhdGluZyA/PyAwKSAqIDEwKSAvIDEwLFxuICAgIGJvb2tpbmdzQnlTdGF0dXMsXG4gICAgcmV2ZW51ZU92ZXJUaW1lLFxuICB9O1xufTtcblxuLy8gMy4gVXNlciBkYXNoYm9hcmQgXHUyMDE0IHRoZSB1c2VyJ3MgYm9va2luZ3MsIHNwZW5kLCBhbmQgdXBjb21pbmcgdHJpcHMuXG5jb25zdCBnZXRVc2VyRGFzaGJvYXJkID0gYXN5bmMgKHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxJVXNlckRhc2hib2FyZD4gPT4ge1xuICBjb25zdCBbdG90YWxCb29raW5ncywgdG90YWxTcGVuZCwgdXBjb21pbmddID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIHByaXNtYS5ib29raW5nLmNvdW50KHsgd2hlcmU6IHsgdXNlcklkIH0gfSksXG4gICAgcHJpc21hLmJvb2tpbmcuYWdncmVnYXRlKHtcbiAgICAgIF9zdW06IHsgdG90YWxQcmljZTogdHJ1ZSB9LFxuICAgICAgd2hlcmU6IHsgdXNlcklkLCBzdGF0dXM6IEJvb2tpbmdTdGF0dXMuQ09NUExFVEVEIH0sXG4gICAgfSksXG4gICAgcHJpc21hLmJvb2tpbmcuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBzdGF0dXM6IHtcbiAgICAgICAgICBpbjogW0Jvb2tpbmdTdGF0dXMuUEVORElORywgQm9va2luZ1N0YXR1cy5QQUlELCBCb29raW5nU3RhdHVzLkNPTkZJUk1FRF0sXG4gICAgICAgIH0sXG4gICAgICAgIHRyYXZlbERhdGU6IHsgZ3Q6IG5ldyBEYXRlKCkgfSxcbiAgICAgIH0sXG4gICAgICBzZWxlY3Q6IHtcbiAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgIHRyYXZlbERhdGU6IHRydWUsXG4gICAgICAgIHRyYXZlbGVyczogdHJ1ZSxcbiAgICAgICAgdG90YWxQcmljZTogdHJ1ZSxcbiAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICBwYWNrYWdlOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgdGl0bGU6IHRydWUsIHNsdWc6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgdHJhdmVsRGF0ZTogXCJhc2NcIiB9LFxuICAgICAgdGFrZTogNSxcbiAgICB9KSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbEJvb2tpbmdzLFxuICAgIHRvdGFsU3BlbmQ6IHRvTnVtYmVyKHRvdGFsU3BlbmQuX3N1bS50b3RhbFByaWNlKSxcbiAgICB1cGNvbWluZ0NvdW50OiB1cGNvbWluZy5sZW5ndGgsXG4gICAgdXBjb21pbmc6IHVwY29taW5nLm1hcCgoYikgPT4gKHtcbiAgICAgIC4uLmIsXG4gICAgICB0b3RhbFByaWNlOiBOdW1iZXIoYi50b3RhbFByaWNlKSxcbiAgICB9KSksXG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkU2VydmljZSA9IHtcbiAgZ2V0QWRtaW5EYXNoYm9hcmQsXG4gIGdldEFnZW50RGFzaGJvYXJkLFxuICBnZXRVc2VyRGFzaGJvYXJkLFxufTsiLCAiaW1wb3J0IHsgeiB9IGZyb20gXCJ6b2RcIjtcblxuY29uc3QgZGFzaGJvYXJkUXVlcnlTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGRheXM6IHouY29lcmNlLm51bWJlcigpLmludCgpLm1pbigxKS5tYXgoMzY1KS5kZWZhdWx0KDMwKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgZGFzaGJvYXJkVmFsaWRhdGlvbnMgPSB7XG4gIGRhc2hib2FyZFF1ZXJ5U2NoZW1hLFxufTsiLCAiaW1wb3J0IHsgUm91dGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IFJvbGUgfSBmcm9tIFwiLi4vLi4vLi4vZ2VuZXJhdGVkL3ByaXNtYS9lbnVtc1wiO1xuaW1wb3J0IGF1dGggZnJvbSBcIi4uLy4uL21pZGRsZXdhcmUvYXV0aFwiO1xuaW1wb3J0IHZhbGlkYXRlUmVxdWVzdCBmcm9tIFwiLi4vLi4vbWlkZGxld2FyZS92YWxpZGF0ZVJlcXVlc3RcIjtcbmltcG9ydCB7IHBheW1lbnRDb250cm9sbGVyIH0gZnJvbSBcIi4vcGF5bWVudC5jb250cm9sbGVyXCI7XG5pbXBvcnQgeyBwYXltZW50VmFsaWRhdGlvbnMgfSBmcm9tIFwiLi9wYXltZW50LnZhbGlkYXRpb25cIjtcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8vIE9wZW4gYSBnYXRld2F5IHNlc3Npb24gZm9yIHRoZSB1c2VyJ3MgcGVuZGluZyBib29raW5nIChVU0VSIG9ubHkpLlxucm91dGVyLnBvc3QoXG4gIFwiL2NyZWF0ZVwiLFxuICBhdXRoKFJvbGUuVVNFUiksXG4gIHZhbGlkYXRlUmVxdWVzdCh7IGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5jcmVhdGVTY2hlbWEgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmNyZWF0ZVBheW1lbnQsXG4pO1xuXG4vLyBQdWJsaWMgXHUyMDE0IFNTTENvbW1lcnogUE9TVHMgdGhlIG91dGNvbWUgaGVyZSAoc3VjY2Vzcy9mYWlsL2NhbmNlbCkgYW5kIHdlXG4vLyByZWRpcmVjdCB0aGUgYnJvd3NlciB0byB0aGUgZnJvbnRlbmQgcmVzdWx0IHBhZ2UuXG5yb3V0ZXIucG9zdChcbiAgXCIvY29uZmlybVwiLFxuICB2YWxpZGF0ZVJlcXVlc3Qoe1xuICAgIHF1ZXJ5OiBwYXltZW50VmFsaWRhdGlvbnMuY2FsbGJhY2tRdWVyeVNjaGVtYSxcbiAgICBib2R5OiBwYXltZW50VmFsaWRhdGlvbnMuZ2F0ZXdheVJlc3VsdFNjaGVtYSxcbiAgfSksXG4gIHBheW1lbnRDb250cm9sbGVyLmNvbmZpcm1QYXltZW50LFxuKTtcblxuLy8gUHVibGljIFx1MjAxNCBTU0xDb21tZXJ6IGluc3RhbnQgcGF5bWVudCBub3RpZmljYXRpb247IHNhbWUgaWRlbXBvdGVudCBzZXR0bGUuXG5yb3V0ZXIucG9zdChcbiAgXCIvaXBuXCIsXG4gIHZhbGlkYXRlUmVxdWVzdCh7XG4gICAgcXVlcnk6IHBheW1lbnRWYWxpZGF0aW9ucy5jYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICAgIGJvZHk6IHBheW1lbnRWYWxpZGF0aW9ucy5nYXRld2F5UmVzdWx0U2NoZW1hLFxuICB9KSxcbiAgcGF5bWVudENvbnRyb2xsZXIuaXBuLFxuKTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRSb3V0ZXMgPSByb3V0ZXI7IiwgImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGh0dHBTdGF0dXMgZnJvbSBcImh0dHAtc3RhdHVzXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IGNhdGNoQXN5bmMgfSBmcm9tIFwiLi4vLi4vdXRpbHMvY2F0Y2hBc3luY1wiO1xuaW1wb3J0IHsgc2VuZFJlc3BvbnNlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3NlbmRSZXNwb25zZVwiO1xuaW1wb3J0IHsgSUdhdGV3YXlSZXN1bHQgfSBmcm9tIFwiLi9wYXltZW50LmludGVyZmFjZVwiO1xuaW1wb3J0IHsgcGF5bWVudFNlcnZpY2UgfSBmcm9tIFwiLi9wYXltZW50LnNlcnZpY2VcIjtcblxuY29uc3QgY3JlYXRlUGF5bWVudCA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IHVzZXJJZCA9IHJlcS51c2VyPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgcGF5bWVudFNlcnZpY2UuY3JlYXRlUGF5bWVudFNlc3Npb24odXNlcklkLCByZXEuYm9keSk7XG5cbiAgICBzZW5kUmVzcG9uc2UocmVzLCB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgc3RhdHVzQ29kZTogaHR0cFN0YXR1cy5DUkVBVEVELFxuICAgICAgbWVzc2FnZTogXCJQYXltZW50IHNlc3Npb24gY3JlYXRlZCBzdWNjZXNzZnVsbHkuXCIsXG4gICAgICBkYXRhOiBzZXNzaW9uLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLy8gUHVibGljIGNhbGxiYWNrIHRhcmdldCBcdTIwMTQgU1NMQ29tbWVyeiBQT1NUcyBoZXJlIChzZXJ2ZXItdG8tc2VydmVyKSBhZnRlciB0aGVcbi8vIHNob3BwZXIgZmluaXNoZXMgYXQgdGhlIGdhdGV3YXkuIFdlIHNldHRsZSB0aGUgcGF5bWVudCwgdGhlbiBib3VuY2UgdGhlXG4vLyBicm93c2VyIHRvIHRoZSBmcm9udGVuZCByZXN1bHQgcGFnZS5cbmNvbnN0IGNvbmZpcm1QYXltZW50ID0gY2F0Y2hBc3luYyhcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgYm9va2luZ0lkID0gU3RyaW5nKHJlcS5xdWVyeS5ib29raW5nSWQpO1xuICAgIGNvbnN0IHRyYW5JZCA9IFN0cmluZyhyZXEucXVlcnkudHJhbklkKTtcbiAgICBjb25zdCBzdGF0dXMgPSBTdHJpbmcocmVxLnF1ZXJ5LnN0YXR1cyA/PyBcImZhaWxcIik7XG5cbiAgICBhd2FpdCBwYXltZW50U2VydmljZS5wcm9jZXNzR2F0ZXdheVJlc3VsdChcbiAgICAgIGJvb2tpbmdJZCxcbiAgICAgIHRyYW5JZCxcbiAgICAgIHJlcS5ib2R5IGFzIElHYXRld2F5UmVzdWx0LFxuICAgICk7XG5cbiAgICBjb25zdCByZWRpcmVjdEJhc2UgPVxuICAgICAgY29uZmlnLm5vZGVfZW52ID09PSBcInByb2R1Y3Rpb25cIlxuICAgICAgICA/IGNvbmZpZy5mcm9udGVuZF91cmxfcHJvZFxuICAgICAgICA6IGNvbmZpZy5mcm9udGVuZF91cmxfZGV2O1xuICAgIGNvbnN0IHBhZ2UgPSBbXCJzdWNjZXNzXCIsIFwiZmFpbFwiLCBcImNhbmNlbFwiXS5pbmNsdWRlcyhzdGF0dXMpID8gc3RhdHVzIDogXCJmYWlsXCI7XG5cbiAgICByZXMucmVkaXJlY3QoMzAyLCBgJHtyZWRpcmVjdEJhc2V9L3BheW1lbnQvJHtwYWdlfT9ib29raW5nSWQ9JHtib29raW5nSWR9YCk7XG4gIH0sXG4pO1xuXG4vLyBQdWJsaWMgSVBOIHRhcmdldCBcdTIwMTQgdGhlIGdhdGV3YXkgbm90aWZpZXMgdXMgaGVyZSBpbmRlcGVuZGVudGx5IG9mIHRoZVxuLy8gcmVkaXJlY3QuIFNhbWUgaWRlbXBvdGVudCBzZXR0bGU7IGFsd2F5cyBhbnN3ZXJzIDIwMCBzbyB0aGUgZ2F0ZXdheSBzdG9wcyByZXRyeWluZy5cbmNvbnN0IGlwbiA9IGNhdGNoQXN5bmMoXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGNvbnN0IGJvb2tpbmdJZCA9IFN0cmluZyhyZXEucXVlcnkuYm9va2luZ0lkKTtcbiAgICBjb25zdCB0cmFuSWQgPSBTdHJpbmcocmVxLnF1ZXJ5LnRyYW5JZCk7XG5cbiAgICBhd2FpdCBwYXltZW50U2VydmljZS5wcm9jZXNzR2F0ZXdheVJlc3VsdChcbiAgICAgIGJvb2tpbmdJZCxcbiAgICAgIHRyYW5JZCxcbiAgICAgIHJlcS5ib2R5IGFzIElHYXRld2F5UmVzdWx0LFxuICAgICk7XG5cbiAgICByZXMuc3RhdHVzKDIwMCkudHlwZShcInRleHQvcGxhaW5cIikuc2VuZChcIk9LXCIpO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRDb250cm9sbGVyID0ge1xuICBjcmVhdGVQYXltZW50LFxuICBjb25maXJtUGF5bWVudCxcbiAgaXBuLFxufTsiLCAiaW1wb3J0IHsgQm9va2luZ1N0YXR1cywgUGF5bWVudFN0YXR1cyB9IGZyb20gXCIuLi8uLi8uLi9nZW5lcmF0ZWQvcHJpc21hL2VudW1zXCI7XG5pbXBvcnQgY29uZmlnIGZyb20gXCIuLi8uLi9jb25maWdcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCIuLi8uLi9saWIvcHJpc21hXCI7XG5pbXBvcnQgeyBTc2xjb21tZXJ6SW5pdFJlc3VsdCwgU3NsY29tbWVyelZhbGlkYXRpb25SZXN1bHQsIGdlbmVyYXRlVHJhbklkLCBzc2xjb21tZXJ6SW5pdCwgc3NsY29tbWVyelZhbGlkYXRlIH0gZnJvbSBcIi4uLy4uL2xpYi9zc2xjb21tZXJ6XCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCIuLi8uLi91dGlscy9hcHBFcnJvclwiO1xuaW1wb3J0IHsgc2VuZEJvb2tpbmdFbWFpbCB9IGZyb20gXCIuLi8uLi91dGlscy9lbWFpbFwiO1xuaW1wb3J0IHsgSUdhdGV3YXlSZXN1bHQsIElQYXltZW50Q3JlYXRlUmVxdWVzdCwgSVBheW1lbnRHYXRld2F5T3V0Y29tZSB9IGZyb20gXCIuL3BheW1lbnQuaW50ZXJmYWNlXCI7XG5cbi8vIFRoZSBnYXRld2F5IFBPU1RzIHRvIHRoZXNlIFVSTHMgc2VydmVyLXRvLXNlcnZlciwgc28gdGhlIGhvc3QgbXVzdCBiZVxuLy8gcHVibGljbHkgcmVhY2hhYmxlIFx1MjAxNCBjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsLCBuZXZlciBsb2NhbGhvc3QgaW4gc2FuZGJveC5cbmNvbnN0IGJ1aWxkQ2FsbGJhY2tVcmwgPSAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICB0cmFuSWQ6IHN0cmluZyxcbiAga2luZDogXCJzdWNjZXNzXCIgfCBcImZhaWxcIiB8IFwiY2FuY2VsXCIgfCBcImlwblwiLFxuKSA9PlxuICBgJHtjb25maWcuYmFja2VuZF9wdWJsaWNfdXJsfS9hcGkvcGF5bWVudHMvJHtraW5kID09PSBcImlwblwiID8gXCJpcG5cIiA6IFwiY29uZmlybVwifT9ib29raW5nSWQ9JHtib29raW5nSWR9JnRyYW5JZD0ke3RyYW5JZH0ke1xuICAgIGtpbmQgPT09IFwiaXBuXCIgPyBcIlwiIDogYCZzdGF0dXM9JHtraW5kfWBcbiAgfWA7XG5cbi8vIE9wZW5zIGFuIFNTTENvbW1lcnogc2Vzc2lvbiBmb3IgYSBwZW5kaW5nIGJvb2tpbmcgdGhlIHVzZXIgb3ducy4gVGhlIGJvb2tpbmdcbi8vIGFtb3VudCBpcyBmcm96ZW4gYXQgaW5pdGlhdGlvbjsgaXQgbmV2ZXIgcmUtcmVhZHMgdGhlIHBhY2thZ2UgcHJpY2UuXG5jb25zdCBjcmVhdGVQYXltZW50U2Vzc2lvbiA9IGFzeW5jIChcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHBheWxvYWQ6IElQYXltZW50Q3JlYXRlUmVxdWVzdCxcbik6IFByb21pc2U8eyBwYXltZW50SWQ6IHN0cmluZzsgdHJhbklkOiBzdHJpbmc7IHBheW1lbnRVcmw6IHN0cmluZyB8IG51bGwgfT4gPT4ge1xuICBjb25zdCB7IGJvb2tpbmdJZCB9ID0gcGF5bG9hZDtcblxuICBjb25zdCBib29raW5nID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IGJvb2tpbmdJZCB9LFxuICAgIGluY2x1ZGU6IHsgcGFja2FnZTogeyBzZWxlY3Q6IHsgdGl0bGU6IHRydWUgfSB9IH0sXG4gIH0pO1xuICBpZiAoIWJvb2tpbmcpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCBcIkJvb2tpbmcgbm90IGZvdW5kLlwiKTtcbiAgfVxuICBpZiAoYm9va2luZy51c2VySWQgIT09IHVzZXJJZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsIFwiWW91IGFyZSBub3QgYXV0aG9yaXplZCB0byBwYXkgZm9yIHRoaXMgYm9va2luZy5cIik7XG4gIH1cbiAgaWYgKGJvb2tpbmcuc3RhdHVzID09PSBCb29raW5nU3RhdHVzLlBBSUQpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA5LCBcIlRoaXMgYm9va2luZyBpcyBhbHJlYWR5IHBhaWQuXCIpO1xuICB9XG4gIGlmIChib29raW5nLnN0YXR1cyAhPT0gQm9va2luZ1N0YXR1cy5QRU5ESU5HKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgNDA5LFxuICAgICAgYENhbm5vdCBwYXkgZm9yIGEgYm9va2luZyBpbiAke2Jvb2tpbmcuc3RhdHVzLnRvTG93ZXJDYXNlKCl9IHN0YXR1cy5gLFxuICAgICk7XG4gIH1cblxuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIHNlbGVjdDogeyBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSwgcGhvbmU6IHRydWUgfSxcbiAgfSk7XG4gIGlmICghdXNlcikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsIFwiVXNlciBub3QgZm91bmQuXCIpO1xuICB9XG5cbiAgY29uc3QgYW1vdW50ID0gTnVtYmVyKGJvb2tpbmcudG90YWxQcmljZSk7XG4gIGNvbnN0IHRyYW5JZCA9IGdlbmVyYXRlVHJhbklkKCk7XG5cbiAgLy8gT25lIGxpdmUgc2Vzc2lvbiBwZXIgYm9va2luZzogdGhlIGxlZGdlciByb3cgaXMgY3JlYXRlZCBhdG9taWNhbGx5IHdoaWxlXG4gIC8vIHN1cGVyc2VkaW5nIGFueSBhYmFuZG9uZWQgc2Vzc2lvbiwgdGhlbiB0aGUgZ2F0ZXdheSBpcyBhc2tlZC4gVGhlIHJvd1xuICAvLyBzdXJ2aXZlcyByZWdhcmRsZXNzIG9mIHRoZSBnYXRld2F5IHJlc3BvbnNlIFx1MjAxNCBpbml0IGZhaWx1cmUgZmxpcHMgaXQgdG9cbiAgLy8gRkFJTEVEIGJlbG93IHNvIGEgdHJ1dGhmdWwgZW50cnkgYWx3YXlzIGV4aXN0cy5cbiAgY29uc3QgcGF5bWVudCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgYXdhaXQgdHgucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGJvb2tpbmdJZCwgc3RhdHVzOiBQYXltZW50U3RhdHVzLklOSVRJQVRFRCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXM6IFBheW1lbnRTdGF0dXMuQ0FOQ0VMTEVEIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHgucGF5bWVudC5jcmVhdGUoe1xuICAgICAgZGF0YToge1xuICAgICAgICBib29raW5nSWQsXG4gICAgICAgIHRyYW5JZCxcbiAgICAgICAgYW1vdW50LFxuICAgICAgICBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVELFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgbGV0IGluaXQ6IFNzbGNvbW1lcnpJbml0UmVzdWx0O1xuICB0cnkge1xuICAgIGluaXQgPSBhd2FpdCBzc2xjb21tZXJ6SW5pdCh7XG4gICAgICB0b3RhbF9hbW91bnQ6IGFtb3VudCxcbiAgICAgIHRyYW5faWQ6IHRyYW5JZCxcbiAgICAgIHN1Y2Nlc3NfdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcInN1Y2Nlc3NcIiksXG4gICAgICBmYWlsX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJmYWlsXCIpLFxuICAgICAgY2FuY2VsX3VybDogYnVpbGRDYWxsYmFja1VybChib29raW5nSWQsIHRyYW5JZCwgXCJjYW5jZWxcIiksXG4gICAgICBpcG5fdXJsOiBidWlsZENhbGxiYWNrVXJsKGJvb2tpbmdJZCwgdHJhbklkLCBcImlwblwiKSxcbiAgICAgIGN1c19uYW1lOiB1c2VyLm5hbWUsXG4gICAgICBjdXNfZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICBjdXNfcGhvbmU6IHVzZXIucGhvbmUgPz8gXCIwMTcxMTExMTExMVwiLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIGtlZXAgdGhlIGxlZGdlciB0cnV0aGZ1bCBcdTIwMTQgdGhlIHNlc3Npb24gbmV2ZXIgcmVhY2hlZCB0aGUgZ2F0ZXdheS4gVGhlXG4gICAgLy8gc3RhdHVzIGd1YXJkIG1ha2VzIGEgY29uY3VycmVudCAvY3JlYXRlIHRoYXQgYWxyZWFkeSBjYW5jZWxsZWQgdGhpcyByb3dcbiAgICAvLyB3aW4gdGhlIHJhY2UgKHRoYXQgcm93IHN0YXlzIGNhbmNlbGxlZCwgdGhpcyBvbmUgZmFpbHMgb25seSBpZiBsaXZlKS5cbiAgICBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQgfSxcbiAgICB9KTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIC8vIHN0b3JlIHRoZSBnYXRld2F5IFVSTHMgb25seSBpZiB0aGUgcm93IGlzIHN0aWxsIHRoZSBsaXZlIHNlc3Npb24uXG4gIGF3YWl0IHByaXNtYS5wYXltZW50LnVwZGF0ZU1hbnkoe1xuICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkLCBzdGF0dXM6IFBheW1lbnRTdGF0dXMuSU5JVElBVEVEIH0sXG4gICAgZGF0YTogeyBnYXRld2F5UGFnZVVybDogaW5pdC5HYXRld2F5UGFnZVVSTCwgc3NsU2Vzc2lvbktleTogaW5pdC5zZXNzaW9ua2V5IH0sXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgcGF5bWVudElkOiBwYXltZW50LmlkLFxuICAgIHRyYW5JZDogcGF5bWVudC50cmFuSWQsXG4gICAgcGF5bWVudFVybDogaW5pdC5HYXRld2F5UGFnZVVSTCA/PyBudWxsLFxuICB9O1xufTtcblxuLy8gU2VydmVyLXNpZGUgdmVyaWZpY2F0aW9uIG9mIGEgY29tcGxldGVkIHRyYW5zYWN0aW9uOiB0aGUgdmFsaWRhdG9yIHJldHVybnNcbi8vIFZBTElEIChmaXJzdCBjaGVjaykgb3IgVkFMSURBVEVEIChhbHJlYWR5IHZlcmlmaWVkIGJlZm9yZSkgd2l0aCB0aGUgYW1vdW50LlxuLy8gQW55dGhpbmcgZWxzZSBcdTIwMTQgb3IgYSBtaXNtYXRjaGVkIGFtb3VudCBcdTIwMTQgZmFpbHMgdGhlIHBheW1lbnQuXG5jb25zdCB2ZXJpZnlTdWNjZXNzID0gYXN5bmMgKFxuICB2YWxJZDogc3RyaW5nLFxuICBleHBlY3RlZEFtb3VudDogbnVtYmVyLFxuKTogUHJvbWlzZTx7IHZlcmlmaWVkOiBTc2xjb21tZXJ6VmFsaWRhdGlvblJlc3VsdCB8IG51bGw7IG1hdGNoZXNBbW91bnQ6IGJvb2xlYW4gfT4gPT4ge1xuICBsZXQgdmVyaWZpZWQ6IFNzbGNvbW1lcnpWYWxpZGF0aW9uUmVzdWx0IHwgbnVsbCA9IG51bGw7XG4gIHRyeSB7XG4gICAgdmVyaWZpZWQgPSBhd2FpdCBzc2xjb21tZXJ6VmFsaWRhdGUoeyB2YWxfaWQ6IHZhbElkIH0pO1xuICB9IGNhdGNoIHtcbiAgICAvLyB2YWxpZGF0b3IgdW5yZWFjaGFibGUgXHUyMDE0IGZhaWwgdGhlIHBheW1lbnQgcmF0aGVyIHRoYW4gY3Jhc2ggdGhlIGNhbGxiYWNrXG4gICAgcmV0dXJuIHsgdmVyaWZpZWQ6IG51bGwsIG1hdGNoZXNBbW91bnQ6IGZhbHNlIH07XG4gIH1cblxuICBjb25zdCB2YWxpZFN0YXR1cyA9XG4gICAgdmVyaWZpZWQuc3RhdHVzID09PSBcIlZBTElEXCIgfHwgdmVyaWZpZWQuc3RhdHVzID09PSBcIlZBTElEQVRFRFwiO1xuICBjb25zdCBtYXRjaGVzQW1vdW50ID1cbiAgICB2ZXJpZmllZC5hbW91bnQgIT09IHVuZGVmaW5lZCAmJiBOdW1iZXIodmVyaWZpZWQuYW1vdW50KSA9PT0gZXhwZWN0ZWRBbW91bnQ7XG5cbiAgcmV0dXJuIHsgdmVyaWZpZWQsIG1hdGNoZXNBbW91bnQ6IHZhbGlkU3RhdHVzICYmIG1hdGNoZXNBbW91bnQgfTtcbn07XG5cbi8vIFNoYXJlZCBieSB0aGUgY29uZmlybSAoc3VjY2Vzcy9mYWlsL2NhbmNlbCkgYW5kIElQTiBlbmRwb2ludHMuIElkZW1wb3RlbnQ6IGFcbi8vIHNldHRsZWQgcGF5bWVudCBzaG9ydC1jaXJjdWl0cywgc28gdGhlIGRvdWJsZS1maXJpbmcgSVBOIG5ldmVyIGRvdWJsZS1jaGFyZ2VzLlxuY29uc3QgcHJvY2Vzc0dhdGV3YXlSZXN1bHQgPSBhc3luYyAoXG4gIGJvb2tpbmdJZDogc3RyaW5nLFxuICB0cmFuSWQ6IHN0cmluZyxcbiAgcmVzdWx0OiBJR2F0ZXdheVJlc3VsdCxcbik6IFByb21pc2U8SVBheW1lbnRHYXRld2F5T3V0Y29tZT4gPT4ge1xuICBjb25zdCBwYXltZW50ID0gYXdhaXQgcHJpc21hLnBheW1lbnQuZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgdHJhbklkIH0sXG4gICAgaW5jbHVkZToge1xuICAgICAgYm9va2luZzoge1xuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgdXNlcjogeyBzZWxlY3Q6IHsgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9LFxuICAgICAgICAgIHBhY2thZ2U6IHsgc2VsZWN0OiB7IHRpdGxlOiB0cnVlIH0gfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKCFwYXltZW50IHx8IHBheW1lbnQuYm9va2luZ0lkICE9PSBib29raW5nSWQpIHtcbiAgICAvLyBBIGNhbGxiYWNrIGZvciBhIHNlc3Npb24gd2UgbmV2ZXIgY3JlYXRlZCBcdTIwMTQgbm90aGluZyB0byBzZXR0bGUuXG4gICAgcmV0dXJuIHsgcGF5bWVudFN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQsIGJvb2tpbmdTdGF0dXM6IG51bGwsIGNoYW5nZWQ6IGZhbHNlIH07XG4gIH1cblxuICBpZiAocGF5bWVudC5zdGF0dXMgPT09IFBheW1lbnRTdGF0dXMuU1VDQ0VTUykge1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiBQYXltZW50U3RhdHVzLlNVQ0NFU1MsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogZmFsc2UsXG4gICAgfTtcbiAgfVxuXG4gIC8vIENhbmNlbCBjYWxsYmFjayBcdTIwMTQgdGhlIHNob3BwZXIgYWJhbmRvbmVkIGNoZWNrb3V0LCBubyBjaGFyZ2Ugd2FzIG1hZGUuXG4gIGlmIChyZXN1bHQuZmFpbF9zdGF0dXMgPT09IFwiQ0FOQ0VMTEVEXCIgfHwgcmVzdWx0LnN0YXR1cyA9PT0gXCJDQU5DRUxMRURcIikge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkNBTkNFTExFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB1cGRhdGVkLnN0YXR1cyAhPT0gcGF5bWVudC5zdGF0dXMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIE5vIHZhbF9pZCBtZWFucyB0aGUgZ2F0ZXdheSByZXBvcnRlZCBhIGZhaWx1cmUgKGZhaWxfdXJsKSBcdTIwMTQgbm90aGluZyB0byB2ZXJpZnkuXG4gIGlmICghcmVzdWx0LnZhbF9pZCkge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBwcmlzbWEucGF5bWVudC51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHBheW1lbnQuaWQgfSxcbiAgICAgIGRhdGE6IHsgc3RhdHVzOiBQYXltZW50U3RhdHVzLkZBSUxFRCB9LFxuICAgIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBwYXltZW50U3RhdHVzOiB1cGRhdGVkLnN0YXR1cyxcbiAgICAgIGJvb2tpbmdTdGF0dXM6IHBheW1lbnQuYm9va2luZy5zdGF0dXMsXG4gICAgICBjaGFuZ2VkOiB1cGRhdGVkLnN0YXR1cyAhPT0gcGF5bWVudC5zdGF0dXMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIFN1Y2Nlc3MgcGF0aDogdmVyaWZ5IHNlcnZlci1zaWRlIGFuZCBvbmx5IHRoZW4gbWFyayB0aGUgYm9va2luZyBhcyBwYWlkLlxuICBjb25zdCB7IHZlcmlmaWVkLCBtYXRjaGVzQW1vdW50IH0gPSBhd2FpdCB2ZXJpZnlTdWNjZXNzKFxuICAgIHJlc3VsdC52YWxfaWQsXG4gICAgTnVtYmVyKHBheW1lbnQuYW1vdW50KSxcbiAgKTtcblxuICBpZiAoIW1hdGNoZXNBbW91bnQpIHtcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcHJpc21hLnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogUGF5bWVudFN0YXR1cy5GQUlMRUQgfSxcbiAgICB9KTtcbiAgICByZXR1cm4ge1xuICAgICAgcGF5bWVudFN0YXR1czogdXBkYXRlZC5zdGF0dXMsXG4gICAgICBib29raW5nU3RhdHVzOiBwYXltZW50LmJvb2tpbmcuc3RhdHVzLFxuICAgICAgY2hhbmdlZDogdHJ1ZSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgc2V0dGxlZCA9IGF3YWl0IHByaXNtYS4kdHJhbnNhY3Rpb24oYXN5bmMgKHR4KSA9PiB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IHR4LnBheW1lbnQudXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBwYXltZW50LmlkIH0sXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHN0YXR1czogUGF5bWVudFN0YXR1cy5TVUNDRVNTLFxuICAgICAgICB2YWxJZDogcmVzdWx0LnZhbF9pZCxcbiAgICAgICAgY2FyZFR5cGU6IHJlc3VsdC5jYXJkX3R5cGUgPz8gdmVyaWZpZWQ/LmNhcmRfdHlwZSxcbiAgICAgICAgYmFua1RyYW5JZDogcmVzdWx0LmJhbmtfdHJhbl9pZCA/PyB2ZXJpZmllZD8uYmFua190cmFuX2lkLFxuICAgICAgICBwYWlkQXQ6IG5ldyBEYXRlKCksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gY29tcGFyZS1hbmQtc2V0OiBvbmx5IGEgc3RpbGwtUEVORElORyBib29raW5nIGJlY29tZXMgUEFJRDsgYSBib29raW5nIHRoYXRcbiAgICAvLyB3YXMgY29uY3VycmVudGx5IGNvbmZpcm1lZCBvciBjYW5jZWxsZWQga2VlcHMgaXRzIHN0YXRlLCB0aGUgbW9uZXkgc3RheXMgb24uXG4gICAgYXdhaXQgdHguYm9va2luZy51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IGlkOiBib29raW5nSWQsIHN0YXR1czogQm9va2luZ1N0YXR1cy5QRU5ESU5HIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1czogQm9va2luZ1N0YXR1cy5QQUlEIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdXBkYXRlZDtcbiAgfSk7XG5cbiAgY29uc3QgYm9va2luZ0FmdGVyID0gYXdhaXQgcHJpc21hLmJvb2tpbmcuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGlkOiBib29raW5nSWQgfSB9KTtcblxuICAvLyBiZXN0LWVmZm9ydCBcInBheW1lbnQgcmVjZWl2ZWRcIiBlbWFpbCBcdTIwMTQgbmV2ZXIgZmFpbHMgdGhlIGNhbGxiYWNrXG4gIHZvaWQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICBzZW5kQm9va2luZ0VtYWlsKHtcbiAgICAgIGVtYWlsOiBwYXltZW50LmJvb2tpbmcudXNlci5lbWFpbCxcbiAgICAgIG5hbWU6IHBheW1lbnQuYm9va2luZy51c2VyLm5hbWUsXG4gICAgICBwYWNrYWdlVGl0bGU6IHBheW1lbnQuYm9va2luZy5wYWNrYWdlLnRpdGxlLFxuICAgICAgdHJhdmVsRGF0ZTogcGF5bWVudC5ib29raW5nLnRyYXZlbERhdGUsXG4gICAgICB0cmF2ZWxlcnM6IHBheW1lbnQuYm9va2luZy50cmF2ZWxlcnMsXG4gICAgICB0b3RhbFByaWNlOiBOdW1iZXIocGF5bWVudC5hbW91bnQpLFxuICAgICAgc3RhdHVzOiBCb29raW5nU3RhdHVzLlBBSUQsXG4gICAgfSksXG4gIF0pO1xuXG4gIHJldHVybiB7XG4gICAgcGF5bWVudFN0YXR1czogc2V0dGxlZC5zdGF0dXMsXG4gICAgYm9va2luZ1N0YXR1czogYm9va2luZ0FmdGVyPy5zdGF0dXMgPz8gbnVsbCxcbiAgICBjaGFuZ2VkOiB0cnVlLFxuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRTZXJ2aWNlID0ge1xuICBjcmVhdGVQYXltZW50U2Vzc2lvbixcbiAgcHJvY2Vzc0dhdGV3YXlSZXN1bHQsXG59OyIsICJpbXBvcnQgeyB6IH0gZnJvbSBcInpvZFwiO1xuXG5jb25zdCBjcmVhdGVTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIGJvb2tpbmdJZDogelxuICAgIC5zdHJpbmcoeyByZXF1aXJlZF9lcnJvcjogXCJCb29raW5nIGlkIGlzIHJlcXVpcmVkXCIgfSlcbiAgICAudXVpZChcIkJvb2tpbmcgaWQgbXVzdCBiZSBhIHZhbGlkIHV1aWRcIiksXG59KTtcblxuY29uc3QgY2FsbGJhY2tRdWVyeVNjaGVtYSA9IHoub2JqZWN0KHtcbiAgYm9va2luZ0lkOiB6LnN0cmluZygpLnV1aWQoXCJCb29raW5nIGlkIG11c3QgYmUgYSB2YWxpZCB1dWlkXCIpLFxuICB0cmFuSWQ6IHouc3RyaW5nKCkubWluKDEpLFxuICBzdGF0dXM6IHouZW51bShbXCJzdWNjZXNzXCIsIFwiZmFpbFwiLCBcImNhbmNlbFwiXSkub3B0aW9uYWwoKSxcbn0pO1xuXG4vLyBCb2R5IG9mIHRoZSBnYXRld2F5IFBPU1QgXHUyMDE0IG9ubHkgZmllbGRzIHdlIGNvbnN1bWUsIGFsbCBvcHRpb25hbCBiZWNhdXNlIHRoZVxuLy8gc2hhcGUgZGlmZmVycyBiZXR3ZWVuIHN1Y2Nlc3MgLyBmYWlsIC8gY2FuY2VsIC8gSVBOIGNhbGxiYWNrcy5cbmNvbnN0IGdhdGV3YXlSZXN1bHRTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHZhbF9pZDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBzdGF0dXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgZmFpbF9zdGF0dXM6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgY2FyZF90eXBlOiB6LnN0cmluZygpLm9wdGlvbmFsKCksXG4gIGJhbmtfdHJhbl9pZDogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBjdXJyZW5jeTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBhbW91bnQ6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbn0pO1xuXG5leHBvcnQgdHlwZSBUQ3JlYXRlUGF5bWVudFNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNyZWF0ZVNjaGVtYT47XG5leHBvcnQgdHlwZSBUQ2FsbGJhY2tRdWVyeVNjaGVtYSA9IHouaW5mZXI8dHlwZW9mIGNhbGxiYWNrUXVlcnlTY2hlbWE+O1xuZXhwb3J0IHR5cGUgVEdhdGV3YXlSZXN1bHRTY2hlbWEgPSB6LmluZmVyPHR5cGVvZiBnYXRld2F5UmVzdWx0U2NoZW1hPjtcblxuZXhwb3J0IGNvbnN0IHBheW1lbnRWYWxpZGF0aW9ucyA9IHtcbiAgY3JlYXRlU2NoZW1hLFxuICBjYWxsYmFja1F1ZXJ5U2NoZW1hLFxuICBnYXRld2F5UmVzdWx0U2NoZW1hLFxufTsiLCAiLy8gVmVyY2VsIHNlcnZlcmxlc3MgZW50cnlwb2ludCBcdTIwMTQgcmUtZXhwb3J0cyB0aGUgc2FtZSBFeHByZXNzIGFwcCB0aGUgbG9jYWxcbi8vIGJ1aWxkIHVzZXMuIFZlcmNlbCdzIEB2ZXJjZWwvbm9kZSBydW50aW1lIGNvbXBpbGVzIGFuZCB3cmFwcyBpdDsgdGhlIGFwcCBpc1xuLy8gc3BsaXQgZnJvbSBzZXJ2ZXIudHMgKHdoaWNoIG9ubHkgc3RhcnRzIHRoZSBsaXN0ZW5lcikgc28gdGhlIHR3byBob3N0cyBzaGFyZVxuLy8gb25lIHJvdXRlIHJlZ2lzdHJ5LlxuaW1wb3J0IGFwcCBmcm9tIFwiLi4vc3JjL2FwcFwiO1xuXG5leHBvcnQgZGVmYXVsdCBhcHA7Il0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7OztBQUFBLE9BQU8sYUFBK0Q7QUFDdEUsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFlBQVk7QUFDbkIsT0FBTyxlQUFlOzs7QUNMdEIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sVUFBVTtBQUNqQixTQUFTLFNBQVM7QUFFbEIsT0FBTyxPQUFPO0FBQUEsRUFDWixPQUFPO0FBQUEsRUFDUCxN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IiwgIkRiTnVsbCIsICJEZWNpbWFsIiwgIkpzb25OdWxsIiwgIk51bGxUeXBlcyIsICJQcmlzbWFDbGllbnRJbml0aWFsaXphdGlvbkVycm9yIiwgIlByaXNtYUNsaWVudEtub3duUmVxdWVzdEVycm9yIiwgIlByaXNtYUNsaWVudFJ1c3RQYW5pY0Vycm9yIiwgIlByaXNtYUNsaWVudFVua25vd25SZXF1ZXN0RXJyb3IiLCAiUHJpc21hQ2xpZW50VmFsaWRhdGlvbkVycm9yIiwgIlNxbCIsICJlbXB0eSIsICJqb2luIiwgInJhdyIsICJydW50aW1lIiwgImh0dHBTdGF0dXMiLCAicmVmcmVzaFRva2VuIiwgInJlZnJlc2hUb2tlbiIsICJyZWdpc3RlclVzZXIiLCAiaHR0cFN0YXR1cyIsICJsb2dpblVzZXIiLCAiZ29vZ2xlTG9naW4iLCAiZGVtb0xvZ2luIiwgInoiLCAieiIsICJSb3V0ZXIiLCAiaHR0cFN0YXR1cyIsICJiY3J5cHQiLCAiYmNyeXB0IiwgInVwZGF0ZVByb2ZpbGUiLCAiaHR0cFN0YXR1cyIsICJnZXRVc2VycyIsICJjaGFuZ2VSb2xlIiwgImNoYW5nZVN0YXR1cyIsICJkZWxldGVVc2VyIiwgInoiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJtdWx0ZXIiLCAiaHR0cFN0YXR1cyIsICJodHRwU3RhdHVzIiwgIm11bHRlciIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZU1lc3NhZ2UiLCAiaHR0cFN0YXR1cyIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlQm9va2luZyIsICJodHRwU3RhdHVzIiwgImdldE15Qm9va2luZ3MiLCAiZ2V0QWdlbnRCb29raW5ncyIsICJnZXRCb29raW5nRGV0YWlsIiwgImdldEFsbEJvb2tpbmdzIiwgInVwZGF0ZUJvb2tpbmdTdGF0dXMiLCAieiIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiY3JlYXRlUmV2aWV3IiwgImh0dHBTdGF0dXMiLCAieiIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImNyZWF0ZUNhdGVnb3J5IiwgImh0dHBTdGF0dXMiLCAiZ2V0QWxsQ2F0ZWdvcmllcyIsICJ1cGRhdGVDYXRlZ29yeSIsICJkZWxldGVDYXRlZ29yeSIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAicmFuZG9tVVVJRCIsICJyYW5kb21VVUlEIiwgImNyZWF0ZVBhY2thZ2UiLCAiaHR0cFN0YXR1cyIsICJnZXRQdWJsaWNQYWNrYWdlcyIsICJnZXRQYWNrYWdlQnlTbHVnIiwgImdldEFsbFBhY2thZ2VzIiwgImdldE15UGFja2FnZXMiLCAidXBkYXRlUGFja2FnZSIsICJjaGFuZ2VQYWNrYWdlU3RhdHVzIiwgInNvZnREZWxldGVQYWNrYWdlIiwgInoiLCAidXBkYXRlU3RhdHVzU2NoZW1hIiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAicmFuZG9tVVVJRCIsICJnZW5lcmF0ZVVuaXF1ZVNsdWciLCAicmFuZG9tVVVJRCIsICJjcmVhdGVQb3N0IiwgImh0dHBTdGF0dXMiLCAiZ2V0UHVibGljUG9zdHMiLCAiZ2V0UG9zdEJ5U2x1ZyIsICJnZXRBbGxQb3N0cyIsICJnZXRNeVBvc3RzIiwgInVwZGF0ZVBvc3QiLCAiY2hhbmdlUG9zdFN0YXR1cyIsICJzb2Z0RGVsZXRlUG9zdCIsICJ6IiwgInRpdGxlU2NoZW1hIiwgInVwZGF0ZVN0YXR1c1NjaGVtYSIsICJyb3V0ZXIiLCAiUm91dGVyIiwgIlJvdXRlciIsICJodHRwU3RhdHVzIiwgImdldEFkbWluRGFzaGJvYXJkIiwgImh0dHBTdGF0dXMiLCAiZ2V0QWdlbnREYXNoYm9hcmQiLCAiZ2V0VXNlckRhc2hib2FyZCIsICJ6IiwgInJvdXRlciIsICJSb3V0ZXIiLCAiUm91dGVyIiwgImh0dHBTdGF0dXMiLCAiaHR0cFN0YXR1cyIsICJ6IiwgImNyZWF0ZVNjaGVtYSIsICJyb3V0ZXIiLCAiUm91dGVyIl0KfQo=
